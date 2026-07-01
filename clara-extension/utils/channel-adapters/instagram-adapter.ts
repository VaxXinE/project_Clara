import type {
  ChannelActionResponse,
  ChannelChatSnapshot,
  ChannelMessage
} from "~/types/channel"
import type { WhatsAppReadResponse } from "~/types/whatsapp"

import type { ChannelAdapter } from "./base"

const MAX_VISIBLE_MESSAGES = 80
const HISTORY_SWEEP_STEP_RATIO = 0.82
const HISTORY_SWEEP_SETTLE_MS = 180
const HISTORY_SWEEP_MAX_STEPS = 24
const HISTORY_SWEEP_STABLE_LIMIT = 3

const normalizeText = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim()

const safeText = (node: HTMLElement | null | undefined) =>
  normalizeText(node?.innerText || node?.textContent || "")

const formatRect = (rect: DOMRect | null | undefined) => {
  if (!rect) {
    return "n/a"
  }

  return `x=${Math.round(rect.left)} y=${Math.round(rect.top)} w=${Math.round(
    rect.width
  )} h=${Math.round(rect.height)}`
}

const isEditableComposeElement = (node: HTMLElement | null | undefined) =>
  Boolean(
    node &&
      (node.isContentEditable ||
        node.getAttribute("contenteditable") === "true" ||
        node instanceof HTMLTextAreaElement ||
        node instanceof HTMLInputElement)
  )

const resolveEditableComposeBox = (node: HTMLElement | null) => {
  if (!node) {
    return null
  }

  if (isEditableComposeElement(node)) {
    return node
  }

  const descendant = node.querySelector<HTMLElement>(
    '[contenteditable="true"], textarea, input'
  )

  if (descendant && isEditableComposeElement(descendant)) {
    return descendant
  }

  let current = node.parentElement

  while (current) {
    if (isEditableComposeElement(current)) {
      return current
    }

    const nested = current.querySelector<HTMLElement>(
      '[contenteditable="true"], textarea, input'
    )

    if (nested && isEditableComposeElement(nested)) {
      return nested
    }

    current = current.parentElement
  }

  return null
}

const queryFirst = <T extends HTMLElement>(
  root: ParentNode,
  selectors: string[]
): T | null => {
  for (const selector of selectors) {
    const node = root.querySelector<T>(selector)

    if (node) {
      return node
    }
  }

  return null
}

const isVisibleElement = (node: HTMLElement) => {
  const rect = node.getBoundingClientRect()

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom >= 0 &&
    rect.top <= window.innerHeight
  )
}

const hasRenderableBox = (node: HTMLElement) => {
  const rect = node.getBoundingClientRect()

  return rect.width > 0 && rect.height > 0
}

const IGNORED_TEXT = new Set([
  "home",
  "search",
  "explore",
  "reels",
  "messages",
  "notifications",
  "create",
  "profile",
  "more",
  "instagram",
  "view profile",
  "lihat profil",
  "send",
  "kirim"
])

const META_TEXT_PATTERNS = [
  /^(mon|tue|wed|thu|fri|sat|sun)\s+\d{1,2}:\d{2}\s*(am|pm)$/i,
  /^(today|yesterday|kemarin)$/i,
  /^\d{1,2}:\d{2}\s*(am|pm)$/i,
  /^\d+\s*(m|h|d|w)$/i,
  /^\d+\s*(m|h|d|w)\s+ago$/i,
  /^\d+\s+new\s+messages?$/i,
  /^message\.{0,3}$/i,
  /^pesan\.{0,3}$/i,
  /^(seen|sent|delivered|diterima|dilihat)$/i,
  /^(seen|sent|delivered|diterima|dilihat)\s+\d+\s*(m|h|d|w)\s+ago$/i,
  /^(seen|sent|delivered|diterima|dilihat)\s+just\s+now$/i,
  /^you sent an attachment\.?$/i
]

const COMPOSER_HINT_PATTERNS = [/message/i, /pesan/i]
const URL_LIKE_PATTERN =
  /(https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s]*)?)/i

const isUsefulMessageText = (text: string, chatTitle: string) => {
  const normalized = normalizeText(text)
  const lower = normalized.toLowerCase()

  if (!normalized) {
    return false
  }

  if (normalized.length > 5000) {
    return false
  }

  if (IGNORED_TEXT.has(lower)) {
    return false
  }

  if (META_TEXT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false
  }

  if (chatTitle && normalized === chatTitle) {
    return false
  }

  return true
}

const isInstagramDmPage = () =>
  window.location.hostname === "www.instagram.com" &&
  window.location.pathname.startsWith("/direct")

const getRoot = () =>
  document.querySelector<HTMLElement>('main[role="main"]') ||
  document.querySelector<HTMLElement>("main") ||
  document.querySelector<HTMLElement>('[role="main"]') ||
  document.body

const getVisibleTextboxCandidates = (root: ParentNode = document) => {
  const selectors = [
    '[contenteditable="true"][role="textbox"]',
    '[contenteditable="true"]',
    "textarea",
    'div[role="textbox"]'
  ]

  return selectors
    .flatMap((selector) => Array.from(root.querySelectorAll<HTMLElement>(selector)))
    .filter((node) => {
      if (!isVisibleElement(node)) {
        return false
      }

      const rect = node.getBoundingClientRect()
      const text = safeText(node).toLowerCase()
      const ariaLabel = node.getAttribute("aria-label")?.toLowerCase() || ""
      const placeholder = node.getAttribute("placeholder")?.toLowerCase() || ""
      const haystack = `${text} ${ariaLabel} ${placeholder}`.trim()

      if (rect.width < 120 || rect.height < 24) {
        return false
      }

      if (
        haystack.includes("search") ||
        haystack.includes("cari") ||
        haystack.includes("note")
      ) {
        return false
      }

      return true
    })
    .sort((a, b) => {
      const rectA = a.getBoundingClientRect()
      const rectB = b.getBoundingClientRect()
      const haystackA = `${safeText(a)} ${a.getAttribute("aria-label") || ""} ${
        a.getAttribute("placeholder") || ""
      }`.toLowerCase()
      const haystackB = `${safeText(b)} ${b.getAttribute("aria-label") || ""} ${
        b.getAttribute("placeholder") || ""
      }`.toLowerCase()
      const scoreA =
        rectA.top * 4 +
        rectA.left * 2 +
        rectA.width +
        (haystackA.includes("message") || haystackA.includes("pesan") ? 600 : 0)
      const scoreB =
        rectB.top * 4 +
        rectB.left * 2 +
        rectB.width +
        (haystackB.includes("message") || haystackB.includes("pesan") ? 600 : 0)

      return scoreB - scoreA
    })
}

const getComposePlaceholderCandidates = (root: ParentNode = document) =>
  Array.from(root.querySelectorAll<HTMLElement>("div, span, p"))
    .filter((node) => {
      if (!isVisibleElement(node)) {
        return false
      }

      const rect = node.getBoundingClientRect()
      const text = safeText(node)
      const ariaLabel = node.getAttribute("aria-label") || ""
      const placeholder = node.getAttribute("placeholder") || ""
      const haystack = `${text} ${ariaLabel} ${placeholder}`.trim()

      if (!haystack || !COMPOSER_HINT_PATTERNS.some((pattern) => pattern.test(haystack))) {
        return false
      }

      if (rect.width < 140 || rect.height < 18) {
        return false
      }

      return (
        rect.left >= window.innerWidth * 0.4 &&
        rect.top >= window.innerHeight * 0.7
      )
    })
    .sort((a, b) => {
      const rectA = a.getBoundingClientRect()
      const rectB = b.getBoundingClientRect()
      const scoreA = rectA.top * 4 + rectA.left * 2 + rectA.width
      const scoreB = rectB.top * 4 + rectB.left * 2 + rectB.width

      return scoreB - scoreA
    })

const getViewportProbeElement = (xRatio: number, yRatio: number) => {
  const x = Math.min(window.innerWidth - 2, Math.max(2, window.innerWidth * xRatio))
  const y = Math.min(window.innerHeight - 2, Math.max(2, window.innerHeight * yRatio))

  return document.elementFromPoint(x, y) as HTMLElement | null
}

const findComposeBoxFromViewportProbe = () => {
  const probeTargets = [
    getViewportProbeElement(0.76, 0.93),
    getViewportProbeElement(0.72, 0.9),
    getViewportProbeElement(0.68, 0.88)
  ].filter((node): node is HTMLElement => Boolean(node))

  for (const target of probeTargets) {
    const resolved = resolveEditableComposeBox(target)

    if (resolved) {
      return resolved
    }

    const ancestor = target.closest<HTMLElement>("div, section, form, footer")
    const nested = ancestor?.querySelector<HTMLElement>(
      '[contenteditable="true"], textarea, input, div[role="textbox"]'
    )

    if (nested) {
      const resolvedNested = resolveEditableComposeBox(nested)

      if (resolvedNested) {
        return resolvedNested
      }
    }
  }

  return null
}

const getMessagesListPagelet = () => {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>('[data-pagelet="IGDMessagesList"]')
  ).filter((node) => isVisibleElement(node))

  candidates.sort((a, b) => {
    const rectA = a.getBoundingClientRect()
    const rectB = b.getBoundingClientRect()

    if (Math.abs(rectB.left - rectA.left) > 8) {
      return rectB.left - rectA.left
    }

    if (Math.abs(rectB.width - rectA.width) > 8) {
      return rectB.width - rectA.width
    }

    return rectA.top - rectB.top
  })

  return candidates[0] || null
}

const getComposerPagelet = () => {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>('[data-pagelet="IGDComposerForCannes"]')
  ).filter((node) => isVisibleElement(node))

  candidates.sort((a, b) => {
    const rectA = a.getBoundingClientRect()
    const rectB = b.getBoundingClientRect()

    if (Math.abs(rectB.left - rectA.left) > 8) {
      return rectB.left - rectA.left
    }

    if (Math.abs(rectB.width - rectA.width) > 8) {
      return rectB.width - rectA.width
    }

    return rectB.top - rectA.top
  })

  return candidates[0] || null
}

const getMessageScanRoot = () => getMessagesListPagelet() || getConversationPane()

const isScrollableElement = (node: HTMLElement) => {
  const style = window.getComputedStyle(node)

  return (
    (style.overflowY === "auto" || style.overflowY === "scroll") &&
    node.scrollHeight - node.clientHeight > 40
  )
}

const getHistoryScrollContainer = () => {
  const root = getMessagesListPagelet()

  if (!root) {
    return null
  }

  const messageGroup = root.querySelector<HTMLElement>('div[role="group"][tabindex="-1"]')

  if (messageGroup) {
    for (const ancestor of getAncestorChain(messageGroup.parentElement)) {
      if (!isScrollableElement(ancestor) || !hasRenderableBox(ancestor)) {
        continue
      }

      const rect = ancestor.getBoundingClientRect()

      if (
        rect.height >= 180 &&
        rect.width >= 220 &&
        rect.left >= root.getBoundingClientRect().left - 24
      ) {
        return ancestor
      }
    }
  }

  const descendants = [
    root,
    ...Array.from(root.querySelectorAll<HTMLElement>("div, section, main"))
  ]

  const candidates = descendants.filter((node) => {
    if (!isVisibleElement(node) || !isScrollableElement(node)) {
      return false
    }

    const rect = node.getBoundingClientRect()

    return rect.height >= 180 && rect.width >= 220
  })

  candidates.sort((a, b) => {
    const rectA = a.getBoundingClientRect()
    const rectB = b.getBoundingClientRect()
    const scoreA = a.scrollHeight - a.clientHeight + rectA.height
    const scoreB = b.scrollHeight - b.clientHeight + rectB.height

    if (Math.abs(scoreB - scoreA) > 12) {
      return scoreB - scoreA
    }

    return rectB.height - rectA.height
  })

  return candidates[0] || root
}

const findComposeBox = (root: ParentNode = document) => {
  const composerRoot = root === document ? getComposerPagelet() : null

  if (composerRoot) {
    const composerCandidates = getVisibleTextboxCandidates(composerRoot)
    const composerPreferred = composerCandidates.find((node) => {
      const haystack = `${safeText(node)} ${node.getAttribute("aria-label") || ""} ${
        node.getAttribute("placeholder") || ""
      }`.toLowerCase()

      return haystack.includes("message") || haystack.includes("pesan")
    })

    const resolvedComposerBox =
      resolveEditableComposeBox(composerPreferred) ||
      resolveEditableComposeBox(composerCandidates[0] || null) ||
      resolveEditableComposeBox(getComposePlaceholderCandidates(composerRoot)[0] || null)

    if (resolvedComposerBox) {
      return resolvedComposerBox
    }
  }

  const candidates = getVisibleTextboxCandidates(root)
  const preferred = candidates.find((node) => {
    const rect = node.getBoundingClientRect()
    const haystack = `${safeText(node)} ${node.getAttribute("aria-label") || ""} ${
      node.getAttribute("placeholder") || ""
    }`.toLowerCase()

    return (
      rect.left >= window.innerWidth * 0.35 &&
      rect.top >= window.innerHeight * 0.55 &&
      (haystack.includes("message") || haystack.includes("pesan"))
    )
  })

  return (
    resolveEditableComposeBox(preferred) ||
    resolveEditableComposeBox(candidates[0] || null) ||
    resolveEditableComposeBox(getComposePlaceholderCandidates(root)[0] || null) ||
    findComposeBoxFromViewportProbe() ||
    null
  )
}

const getAncestorChain = (node: HTMLElement | null) => {
  const chain: HTMLElement[] = []
  let current = node

  while (current) {
    chain.push(current)
    current = current.parentElement
  }

  return chain
}

const getConversationBounds = () => {
  const root = getMessageScanRoot()
  const composeBox = findComposeBox(document)
  const composerRoot = getComposerPagelet()
  const rootRect = root.getBoundingClientRect()
  const composerRect = composerRoot?.getBoundingClientRect()

  if (!composeBox) {
    return {
      centerX: rootRect.left + rootRect.width / 2,
      maxBottom: Math.min(
        window.innerHeight * 0.94,
        composerRect?.top ?? rootRect.bottom
      ),
      maxRight: Math.min(window.innerWidth - 16, rootRect.right + 8),
      minLeft: Math.max(0, rootRect.left),
      minTop: Math.max(0, rootRect.top),
      root
    }
  }

  const composeRect = composeBox.getBoundingClientRect()

  return {
    centerX: composeRect.left + composeRect.width / 2,
    maxBottom: composerRect?.top ?? composeRect.top,
    maxRight: Math.min(window.innerWidth, Math.max(rootRect.right + 8, composeRect.right + 24)),
    minLeft: Math.max(0, Math.min(rootRect.left, composeRect.left - 48)),
    minTop: Math.max(0, rootRect.top),
    root
  }
}

const getTopRightTextCandidates = (
  root: ParentNode = document
): TopRightTextCandidate[] => {
  const candidates: TopRightTextCandidate[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const rootRect =
    root instanceof HTMLElement
      ? root.getBoundingClientRect()
      : getRoot().getBoundingClientRect()
  const titleBandBottom = rootRect.top + Math.min(170, rootRect.height * 0.24)
  const minLeft = rootRect.left + Math.min(28, rootRect.width * 0.08)
  const maxRight = rootRect.right - 16

  while (walker.nextNode()) {
    const textNode = walker.currentNode
    const parent = textNode.parentElement
    const text = normalizeText(textNode.textContent || "")

    if (!parent || !text || !isVisibleElement(parent)) {
      continue
    }

    if (
      parent.closest("nav") ||
      parent.closest("aside") ||
      parent.closest("footer") ||
      parent.closest("button")
    ) {
      continue
    }

    if (IGNORED_TEXT.has(text.toLowerCase()) || META_TEXT_PATTERNS.some((pattern) => pattern.test(text))) {
      continue
    }

    const range = document.createRange()
    range.selectNodeContents(textNode)
    const rect = range.getBoundingClientRect()

    if (!rect.width || !rect.height) {
      continue
    }

    const centerX = rect.left + rect.width / 2

    if (
      rect.left < minLeft ||
      rect.right > maxRight ||
      centerX < rootRect.left + rootRect.width * 0.12 ||
      rect.top > titleBandBottom
    ) {
      continue
    }

    const fontSize = Number.parseFloat(window.getComputedStyle(parent).fontSize || "0")

    candidates.push({
      element: parent,
      fontSize,
      rect,
      text
    })
  }

  return candidates.sort((a, b) => {
    if (Math.abs(b.fontSize - a.fontSize) > 0.5) {
      return b.fontSize - a.fontSize
    }

    if (Math.abs(a.rect.top - b.rect.top) > 8) {
      return a.rect.top - b.rect.top
    }

    return a.rect.left - b.rect.left
  })
}

const getPrimaryTitleCandidate = (root: ParentNode = document) =>
  getTopRightTextCandidates(root)[0] || null

const getConversationPaneFromViewportProbe = () => {
  const probeTargets = [
    getViewportProbeElement(0.75, 0.2),
    getViewportProbeElement(0.76, 0.45),
    getViewportProbeElement(0.76, 0.72)
  ].filter((node): node is HTMLElement => Boolean(node))

  for (const target of probeTargets) {
    for (const ancestor of getAncestorChain(target)) {
      const rect = ancestor.getBoundingClientRect()

      if (
        rect.width >= window.innerWidth * 0.32 &&
        rect.height >= window.innerHeight * 0.52 &&
        rect.left >= window.innerWidth * 0.24 &&
        rect.right >= window.innerWidth * 0.68
      ) {
        return ancestor
      }
    }
  }

  return null
}

const getConversationPane = () => {
  const root = getRoot()
  const composeBox = findComposeBox(root)
  const titleCandidate = getPrimaryTitleCandidate(root)

  if (composeBox && titleCandidate?.element) {
    const composeAncestors = new Set(getAncestorChain(composeBox))

    for (const ancestor of getAncestorChain(titleCandidate.element)) {
      if (!composeAncestors.has(ancestor)) {
        continue
      }

      const rect = ancestor.getBoundingClientRect()

      if (
        rect.width >= window.innerWidth * 0.25 &&
        rect.height >= window.innerHeight * 0.45 &&
        rect.left >= window.innerWidth * 0.2
      ) {
        return ancestor
      }
    }
  }

  const viewportPane = getConversationPaneFromViewportProbe()

  if (viewportPane) {
    return viewportPane
  }

  return root
}

const getInboxHeaderPagelet = () => {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>('[data-pagelet="IGDInboxHeaderOffMsys"]')
  ).filter((node) => isVisibleElement(node))

  candidates.sort((a, b) => {
    const rectA = a.getBoundingClientRect()
    const rectB = b.getBoundingClientRect()

    if (Math.abs(rectB.left - rectA.left) > 8) {
      return rectB.left - rectA.left
    }

    if (Math.abs(rectA.top - rectB.top) > 8) {
      return rectA.top - rectB.top
    }

    return rectB.width - rectA.width
  })

  return candidates[0] || null
}

const getDedicatedHeaderTitle = () => {
  const headerRoot = getInboxHeaderPagelet()

  if (!headerRoot) {
    return ""
  }

  const explicitTitle = queryFirst<HTMLElement>(headerRoot, [
    'h2 span[title]',
    'a[aria-label^="Open the profile page of"] span[title]',
    'a[href^="/"] h2 span[title]'
  ])

  const explicitText =
    explicitTitle?.getAttribute("title")?.trim() || safeText(explicitTitle)

  if (explicitText) {
    return explicitText
  }

  const profileLink = headerRoot.querySelector<HTMLElement>(
    'a[aria-label^="Open the profile page of"]'
  )
  const profileLabel = profileLink?.getAttribute("aria-label") || ""
  const profileMatch = profileLabel.match(/Open the profile page of\s+(.+)$/i)

  if (profileMatch?.[1]?.trim()) {
    return profileMatch[1].trim()
  }

  return ""
}

const getConversationHeaderContainer = (pane: HTMLElement) => {
  const dedicatedHeader = getInboxHeaderPagelet()

  if (dedicatedHeader) {
    return dedicatedHeader
  }

  const paneRect = pane.getBoundingClientRect()
  const directCandidates = Array.from(pane.children).filter(
    (node): node is HTMLElement => node instanceof HTMLElement
  )
  const nestedCandidates = directCandidates.flatMap((node) =>
    Array.from(node.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement
    )
  )
  const candidates = [...directCandidates, ...nestedCandidates].filter((node) => {
    if (!isVisibleElement(node)) {
      return false
    }

    const rect = node.getBoundingClientRect()

    if (!rect.width || !rect.height) {
      return false
    }

    if (rect.top < paneRect.top - 2) {
      return false
    }

    if (rect.top > paneRect.top + Math.min(110, paneRect.height * 0.14)) {
      return false
    }

    if (Math.abs(rect.left - paneRect.left) > 20) {
      return false
    }

    if (
      rect.width < paneRect.width * 0.78 ||
      rect.height < 44 ||
      rect.height > 120
    ) {
      return false
    }

    if (Math.abs(rect.right - paneRect.right) > 20) {
      return false
    }

    if (!safeText(node)) {
      return false
    }

    return true
  })

  candidates.sort((a, b) => {
    const rectA = a.getBoundingClientRect()
    const rectB = b.getBoundingClientRect()
    const scoreA =
      Math.abs(rectA.top - paneRect.top) * 10 +
      Math.abs(rectA.left - paneRect.left) * 6 +
      Math.abs(rectA.right - paneRect.right) * 6 +
      Math.abs(paneRect.width - rectA.width)
    const scoreB =
      Math.abs(rectB.top - paneRect.top) * 10 +
      Math.abs(rectB.left - paneRect.left) * 6 +
      Math.abs(rectB.right - paneRect.right) * 6 +
      Math.abs(paneRect.width - rectB.width)

    if (Math.abs(scoreA - scoreB) > 1) {
      return scoreA - scoreB
    }

    return rectB.width - rectA.width
  })

  return candidates[0] || null
}

const getConversationHeaderCandidates = (pane: HTMLElement) => {
  const headerContainer = getConversationHeaderContainer(pane)
  const searchRoot = headerContainer || pane
  const searchRect = searchRoot.getBoundingClientRect()
  const candidates: TopRightTextCandidate[] = []
  const walker = document.createTreeWalker(searchRoot, NodeFilter.SHOW_TEXT)

  while (walker.nextNode()) {
    const textNode = walker.currentNode
    const parent = textNode.parentElement
    const text = normalizeText(textNode.textContent || "")

    if (!parent || !text || !isVisibleElement(parent)) {
      continue
    }

    if (
      parent.closest("nav") ||
      parent.closest("aside") ||
      parent.closest("footer") ||
      parent.closest("button")
    ) {
      continue
    }

    if (
      text.length > 80 ||
      IGNORED_TEXT.has(text.toLowerCase()) ||
      META_TEXT_PATTERNS.some((pattern) => pattern.test(text))
    ) {
      continue
    }

    const range = document.createRange()
    range.selectNodeContents(textNode)
    const rect = range.getBoundingClientRect()

    if (!rect.width || !rect.height) {
      continue
    }

    if (
      rect.top < searchRect.top - 2 ||
      rect.bottom > searchRect.bottom + 2 ||
      rect.left < searchRect.left + 18 ||
      rect.right > searchRect.right - 72
    ) {
      continue
    }

    const fontSize = Number.parseFloat(window.getComputedStyle(parent).fontSize || "0")

    candidates.push({
      element: parent,
      fontSize,
      rect,
      text
    })
  }

  return candidates.sort((a, b) => {
    if (Math.abs(b.fontSize - a.fontSize) > 0.5) {
      return b.fontSize - a.fontSize
    }

    if (Math.abs(a.rect.top - b.rect.top) > 8) {
      return a.rect.top - b.rect.top
    }

    if (Math.abs(a.rect.left - b.rect.left) > 8) {
      return a.rect.left - b.rect.left
    }

    return a.text.length - b.text.length
  })
}

const getTitle = () => {
  const dedicatedTitle = getDedicatedHeaderTitle()

  if (dedicatedTitle) {
    return dedicatedTitle
  }

  const pane = getConversationPane()
  const headerCandidates = getConversationHeaderCandidates(pane)

  return (
    headerCandidates[0]?.text ||
    getTopRightTextCandidates(pane)[0]?.text ||
    "Instagram DM"
  )
}

const getHeaderTextSet = (root: ParentNode = document) => {
  const pane =
    getInboxHeaderPagelet() ||
    (root instanceof HTMLElement ? root : getConversationPane())
  const candidates = getConversationHeaderCandidates(pane)
  const primary = candidates[0]

  if (!primary) {
    return new Set<string>()
  }

  return new Set(
    candidates
      .filter((candidate) => {
        const isNearTop = candidate.rect.top <= primary.rect.bottom + 36
        const isNearLeft = Math.abs(candidate.rect.left - primary.rect.left) <= 48

        return isNearTop && isNearLeft
      })
      .map((candidate) => candidate.text)
      .filter(Boolean)
  )
}

type TextCandidate = {
  bubbleKey: string
  rect: DOMRect
  text: string
}

type BubbleTextPart = {
  rect: DOMRect
  text: string
}

type TopRightTextCandidate = {
  element: HTMLElement
  fontSize: number
  rect: DOMRect
  text: string
}

type BubbleCandidate = {
  bubbleKey: string
  element: HTMLElement
  rect: DOMRect
}

type SnapshotMessageDraft = {
  direction: "incoming" | "outgoing"
  text: string
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })

const isLikelyLinkPreviewTextNode = (textNode: Node, parent: HTMLElement) => {
  const text = normalizeText(textNode.textContent || "")

  if (!text || URL_LIKE_PATTERN.test(text) || text.length > 180) {
    return false
  }

  let current: HTMLElement | null = parent

  for (let depth = 0; current && depth < 6; depth += 1) {
    const hasMedia = Boolean(current.querySelector("img, video, canvas, svg"))
    const anchor =
      current.matches("a[href], [role='link']") ?
        current
      : current.querySelector<HTMLElement>("a[href], [role='link']")

    if (hasMedia && anchor) {
      const anchorHref = anchor.getAttribute("href") || ""
      const subtreeText = normalizeText(current.textContent || "")
      const nodeInsideAnchor =
        anchor === parent ||
        anchor.contains(parent) ||
        parent.closest("a[href], [role='link']") === anchor
      const subtreeLooksCompact =
        subtreeText === text ||
        subtreeText.length <= Math.max(140, text.length + 48)
      const currentLooksCompact = current.childElementCount <= 6

      if (
        subtreeLooksCompact &&
        currentLooksCompact &&
        (
          nodeInsideAnchor ||
          subtreeText.toLowerCase().includes("official website")
        ) &&
        (
          anchorHref ||
          URL_LIKE_PATTERN.test(subtreeText) ||
          subtreeText.toLowerCase().includes("official website")
        )
      ) {
        return true
      }
    }

    current = current.parentElement
  }

  return false
}

const getBubbleContainer = (node: HTMLElement, root: HTMLElement) => {
  const rootRect = root.getBoundingClientRect()
  let current: HTMLElement | null = node
  let bestCandidate: HTMLElement | null = null

  while (current && current !== root) {
    const rect = current.getBoundingClientRect()
    const parentRect = current.parentElement?.getBoundingClientRect() || null
    const withinRoot =
      rect.left >= rootRect.left - 24 &&
      rect.right <= rootRect.right + 24 &&
      rect.top >= rootRect.top - 24 &&
      rect.bottom <= rootRect.bottom + 24

    if (
      withinRoot &&
      rect.width >= 56 &&
      rect.height >= 18 &&
      rect.width <= rootRect.width * 0.98 &&
      !current.closest("header, nav, aside, footer, form, button")
    ) {
      const childTextCount = Array.from(current.childNodes).filter((child) =>
        Boolean(normalizeText(child.textContent || ""))
      ).length
      const hasMedia = Boolean(current.querySelector("img, video, canvas, svg"))
      const expansionWidth =
        parentRect && rect.width > 0 ? parentRect.width / rect.width : 1
      const expansionHeight =
        parentRect && rect.height > 0 ? parentRect.height / rect.height : 1
      const parentExpandsSubstantially =
        expansionWidth >= 1.28 || expansionHeight >= 1.55
      const looksTooLargeForSingleBubble =
        rect.width >= rootRect.width * 0.9 &&
        rect.height >= Math.max(220, window.innerHeight * 0.22)

      if (childTextCount >= 1 || hasMedia) {
        if (looksTooLargeForSingleBubble && bestCandidate) {
          return bestCandidate
        }

        bestCandidate = current

        if (parentExpandsSubstantially) {
          return bestCandidate
        }
      }
    }

    current = current.parentElement
  }

  return bestCandidate || node
}

const getBubbleKey = (node: HTMLElement, root: HTMLElement) => {
  const container = getBubbleContainer(node, root)
  const rect = container.getBoundingClientRect()

  return [
    container.tagName.toLowerCase(),
    Math.round(rect.left),
    Math.round(rect.top),
    Math.round(rect.width),
    Math.round(rect.height)
  ].join(":")
}

const getNodeRect = (node: Node) => {
  const range = document.createRange()
  range.selectNodeContents(node)

  return range.getBoundingClientRect()
}

const isBubbleTextNodeVisible = (
  bubbleRect: DOMRect,
  textRect: DOMRect,
  bounds: ReturnType<typeof getConversationBounds>
) => {
  if (!textRect.width || !textRect.height) {
    return false
  }

  if (
    textRect.top < bounds.minTop - 8 ||
    textRect.bottom > bounds.maxBottom + 8 ||
    textRect.left < bounds.minLeft - 24 ||
    textRect.right > bounds.maxRight + 24
  ) {
    return false
  }

  return (
    textRect.left >= bubbleRect.left - 8 &&
    textRect.right <= bubbleRect.right + 8 &&
    textRect.top >= bubbleRect.top - 8 &&
    textRect.bottom <= bubbleRect.bottom + 8
  )
}

const mergeBubbleTextParts = (parts: BubbleTextPart[]) => {
  const sortedParts = [...parts].sort((a, b) => {
    if (Math.abs(a.rect.top - b.rect.top) > 6) {
      return a.rect.top - b.rect.top
    }

    return a.rect.left - b.rect.left
  })
  const rows: BubbleTextPart[][] = []

  for (const part of sortedParts) {
    const lastRow = rows[rows.length - 1]

    if (!lastRow) {
      rows.push([part])
      continue
    }

    const rowTop = Math.min(...lastRow.map((item) => item.rect.top))
    const rowBottom = Math.max(...lastRow.map((item) => item.rect.bottom))
    const isSameVisualRow =
      Math.abs(part.rect.top - rowTop) <= 12 ||
      (part.rect.top <= rowBottom + 6 && part.rect.bottom >= rowTop - 6)

    if (isSameVisualRow) {
      lastRow.push(part)
      continue
    }

    rows.push([part])
  }

  const lines = rows
    .map((row) =>
      row
        .sort((a, b) => a.rect.left - b.rect.left)
        .map((part) => part.text)
        .filter(Boolean)
        .map((text, index) => (index === 0 ? text : text.replace(/^[.:\-]+\s*/u, "")))
        .join(" ")
    )
    .filter(Boolean)

  return mergeMessageCandidateTexts(lines)
}

const collectBubbleText = (
  bubble: HTMLElement,
  bounds: ReturnType<typeof getConversationBounds>
) => {
  const bubbleRect = bubble.getBoundingClientRect()
  const parts: BubbleTextPart[] = []
  const rects: DOMRect[] = []
  const seen = new Set<string>()
  const walker = document.createTreeWalker(bubble, NodeFilter.SHOW_TEXT)

  while (walker.nextNode()) {
    const textNode = walker.currentNode
    const parent = textNode.parentElement
    const text = normalizeText(textNode.textContent || "")

    if (!parent || !text || !isVisibleElement(parent)) {
      continue
    }

    if (isLikelyLinkPreviewTextNode(textNode, parent)) {
      continue
    }

    const rect = getNodeRect(textNode)

    if (!isBubbleTextNodeVisible(bubbleRect, rect, bounds)) {
      continue
    }

    const key = `${text}-${Math.round(rect.top)}-${Math.round(rect.left)}`

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    parts.push({
      rect,
      text
    })
    rects.push(rect)
  }

  const text = mergeBubbleTextParts(parts)

  if (!text || rects.length === 0) {
    return null
  }

  const mergedRect = {
    bottom: Math.max(...rects.map((rect) => rect.bottom)),
    height: 0,
    left: Math.min(...rects.map((rect) => rect.left)),
    right: Math.max(...rects.map((rect) => rect.right)),
    top: Math.min(...rects.map((rect) => rect.top)),
    width: 0,
    x: 0,
    y: 0,
    toJSON: () => bubbleRect.toJSON()
  } as DOMRect

  mergedRect.width = mergedRect.right - mergedRect.left
  mergedRect.height = mergedRect.bottom - mergedRect.top
  mergedRect.x = mergedRect.left
  mergedRect.y = mergedRect.top

  return {
    rect: mergedRect,
    text
  }
}

const getTextCandidateDirection = (
  candidate: TextCandidate,
  centerX: number
): "incoming" | "outgoing" =>
  candidate.rect.left + candidate.rect.width / 2 > centerX ? "outgoing" : "incoming"

const shouldDropSubsetCandidate = (
  current: TextCandidate,
  other: TextCandidate,
  centerX: number
) => {
  if (current === other) {
    return false
  }

  if (getTextCandidateDirection(current, centerX) !== getTextCandidateDirection(other, centerX)) {
    return false
  }

  if (current.text.length >= other.text.length) {
    return false
  }

  const normalizedCurrent = normalizeText(current.text)
  const normalizedOther = normalizeText(other.text)

  if (!normalizedCurrent || !normalizedOther.includes(normalizedCurrent)) {
    return false
  }

  const horizontallyNear =
    Math.abs(current.rect.left - other.rect.left) <= 48 ||
    Math.abs(current.rect.right - other.rect.right) <= 48
  const verticallyNear =
    Math.abs(current.rect.top - other.rect.top) <= 160 ||
    Math.abs(current.rect.bottom - other.rect.bottom) <= 160

  return horizontallyNear && verticallyNear
}

const mergeMessageCandidateTexts = (texts: string[]) => {
  const uniqueTexts = Array.from(
    new Set(texts.map((text) => normalizeText(text)).filter(Boolean))
  )
  const trimmedBoundaryMetaTexts = [...uniqueTexts]

  while (
    trimmedBoundaryMetaTexts.length > 0 &&
    META_TEXT_PATTERNS.some((pattern) => pattern.test(trimmedBoundaryMetaTexts[0]))
  ) {
    trimmedBoundaryMetaTexts.shift()
  }

  while (
    trimmedBoundaryMetaTexts.length > 0 &&
    META_TEXT_PATTERNS.some((pattern) =>
      pattern.test(trimmedBoundaryMetaTexts[trimmedBoundaryMetaTexts.length - 1])
    )
  ) {
    trimmedBoundaryMetaTexts.pop()
  }

  const hasRicherText = uniqueTexts.some((text) => /[\p{L}\p{N}]/u.test(text) && text.length > 2)

  const cleanedTexts = trimmedBoundaryMetaTexts
    .filter((text) => {
      if (!hasRicherText) {
        return true
      }

      return !/^[.]+$/u.test(text)
    })
    .map((text, index) => {
      if (index === 0) {
        return text
      }

      return text.replace(/^[.:\-]+\s*/u, "")
    })

  return normalizeText(cleanedTexts.join("\n"))
}

const collectGroupTextParts = (
  group: HTMLElement,
  bounds: ReturnType<typeof getConversationBounds>,
  includeOffscreen: boolean
) => {
  const groupRect = group.getBoundingClientRect()
  const textNodes = Array.from(
    group.querySelectorAll<HTMLElement>("div[dir='auto'], span[dir='auto']")
  )
  const parts: BubbleTextPart[] = []
  const seen = new Set<string>()

  for (const node of textNodes) {
    const text = normalizeText(node.textContent || "")
    const rect = node.getBoundingClientRect()

    if (!text || !rect.width || !rect.height || !hasRenderableBox(node)) {
      continue
    }

    if (
      !includeOffscreen &&
      !isBubbleTextNodeVisible(groupRect, rect, bounds)
    ) {
      continue
    }

    if (
      rect.left < groupRect.left - 12 ||
      rect.right > groupRect.right + 12 ||
      rect.top < groupRect.top - 12 ||
      rect.bottom > groupRect.bottom + 12
    ) {
      continue
    }

    if (
      rect.left < bounds.minLeft - 24 ||
      rect.right > bounds.maxRight + 24
    ) {
      continue
    }

    const key = `${text}-${Math.round(rect.top)}-${Math.round(rect.left)}`

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    parts.push({
      rect,
      text
    })
  }

  return parts
}

const getMergedPartsRect = (parts: BubbleTextPart[]) => {
  const rects = parts.map((part) => part.rect)
  const firstRect = rects[0]

  if (!firstRect) {
    return null
  }

  const mergedRect = {
    bottom: Math.max(...rects.map((rect) => rect.bottom)),
    height: 0,
    left: Math.min(...rects.map((rect) => rect.left)),
    right: Math.max(...rects.map((rect) => rect.right)),
    top: Math.min(...rects.map((rect) => rect.top)),
    width: 0,
    x: 0,
    y: 0,
    toJSON: () => firstRect.toJSON()
  } as DOMRect

  mergedRect.width = mergedRect.right - mergedRect.left
  mergedRect.height = mergedRect.bottom - mergedRect.top
  mergedRect.x = mergedRect.left
  mergedRect.y = mergedRect.top

  return mergedRect
}

const getGroupCandidateDirection = (
  group: HTMLElement,
  textRect: DOMRect,
  centerX: number
): "incoming" | "outgoing" => {
  const hasIncomingProfileLink = Boolean(
    group.querySelector('a[aria-label^="Open the profile page of "]')
  )

  if (hasIncomingProfileLink) {
    return "incoming"
  }

  return textRect.left + textRect.width / 2 > centerX ? "outgoing" : "incoming"
}

const readMessageCandidates = ({
  includeOffscreen = false
}: {
  includeOffscreen?: boolean
} = {}): TextCandidate[] => {
  const bounds = getConversationBounds()
  const { maxBottom, maxRight, minLeft, root } = bounds
  const rootElement = root instanceof HTMLElement ? root : getMessageScanRoot()
  const dedicatedHeader = getInboxHeaderPagelet()
  const dedicatedHeaderRect = dedicatedHeader?.getBoundingClientRect()
  const composeBox = findComposeBox(document)
  const composeRect = composeBox?.getBoundingClientRect()
  const minTop =
    dedicatedHeaderRect?.bottom ??
    Math.max(rootElement.getBoundingClientRect().top, window.innerHeight * 0.08)
  const effectiveMaxBottom = composeRect?.top ?? maxBottom
  const groups = Array.from(
    rootElement.querySelectorAll<HTMLElement>('div[role="group"][tabindex="-1"]')
  )

  return groups
    .map((group, index) => {
      if (!(includeOffscreen ? hasRenderableBox(group) : isVisibleElement(group))) {
        return null
      }

      const rect = group.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const isClippedByViewport =
        rect.top <= minTop + 6 || rect.bottom >= effectiveMaxBottom - 6

      if (
        (!includeOffscreen && rect.top < minTop - 8) ||
        (!includeOffscreen && rect.bottom > effectiveMaxBottom + 8) ||
        (!includeOffscreen && isClippedByViewport) ||
        centerX < minLeft - 16 ||
        centerX > maxRight + 16
      ) {
        return null
      }

      const parts = collectGroupTextParts(
        group,
        {
          centerX: bounds.centerX,
          maxBottom: effectiveMaxBottom,
          maxRight,
          minLeft,
          minTop,
          root
        },
        includeOffscreen
      )
      const text = mergeBubbleTextParts(parts)
      const textRect = getMergedPartsRect(parts)

      if (!text || !textRect) {
        return null
      }

      const direction = getGroupCandidateDirection(group, textRect, bounds.centerX)

      return {
        bubbleKey: `${direction}:${Math.round(textRect.top)}:${Math.round(textRect.left)}:${index}`,
        rect: textRect,
        text
      } satisfies TextCandidate
    })
    .filter((candidate): candidate is TextCandidate => Boolean(candidate))
    .sort((a, b) => {
      if (Math.abs(a.rect.top - b.rect.top) > 6) {
        return a.rect.top - b.rect.top
      }

      return a.rect.left - b.rect.left
    })
    .filter(
      (candidate, _index, list) =>
        !list.some((other) => shouldDropSubsetCandidate(candidate, other, bounds.centerX))
    )
}

const getComposeText = () => {
  const composeBox = findComposeBox(getRoot())

  if (
    composeBox instanceof HTMLTextAreaElement ||
    composeBox instanceof HTMLInputElement
  ) {
    return normalizeText(composeBox.value || "")
  }

  return normalizeText(composeBox?.innerText || composeBox?.textContent || "")
}

const composeBoxContainsExactText = (composeBox: HTMLElement, expectedText: string) => {
  if (
    composeBox instanceof HTMLTextAreaElement ||
    composeBox instanceof HTMLInputElement
  ) {
    return normalizeText(composeBox.value || "") === normalizeText(expectedText)
  }

  return normalizeText(composeBox.innerText || composeBox.textContent || "") ===
    normalizeText(expectedText)
}

const insertTextIntoComposeBox = (text: string): ChannelActionResponse => {
  const composeBox = findComposeBox(getRoot())
  const normalizedText = text.trim()

  if (!composeBox) {
    return {
      ok: false,
      error: "Kolom ketik Instagram DM belum ditemukan.",
      code: "COMPOSE_BOX_NOT_FOUND"
    }
  }

  if (!normalizedText) {
    return {
      ok: false,
      error: "Teks balasan kosong.",
      code: "EMPTY_REPLY_TEXT"
    }
  }

  composeBox.focus()

  let insertedWithNativeCommand = false

  if (
    composeBox instanceof HTMLTextAreaElement ||
    composeBox instanceof HTMLInputElement
  ) {
    const prototype = composeBox instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
    const valueSetter = Object.getOwnPropertyDescriptor(
      prototype,
      "value"
    )?.set

    if (valueSetter) {
      valueSetter.call(composeBox, normalizedText)
    } else {
      composeBox.value = normalizedText
    }

    composeBox.setSelectionRange(normalizedText.length, normalizedText.length)
    composeBox.dispatchEvent(new Event("input", { bubbles: true }))
    composeBox.dispatchEvent(new Event("change", { bubbles: true }))

    return {
      ok: true
    }
  }

  const selection = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(composeBox)
  selection?.removeAllRanges()
  selection?.addRange(range)

  composeBox.click()

  if (!insertedWithNativeCommand) {
    const textNode = document.createTextNode(normalizedText)

    composeBox.replaceChildren(textNode)

    const fallbackRange = document.createRange()
    fallbackRange.setStart(textNode, textNode.textContent?.length || 0)
    fallbackRange.collapse(true)
    selection?.removeAllRanges()
    selection?.addRange(fallbackRange)
    insertedWithNativeCommand = true
  }

  composeBox.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      data: normalizedText,
      inputType: "insertText"
    })
  )
  composeBox.dispatchEvent(new Event("change", { bubbles: true }))

  const afterRange = document.createRange()
  afterRange.selectNodeContents(composeBox)
  afterRange.collapse(false)
  selection?.removeAllRanges()
  selection?.addRange(afterRange)
  composeBox.focus()

  return {
    ok: true
  }
}

const findSendButton = (root: ParentNode = document) => {
  const selectors = [
    'button[type="submit"]',
    'button[aria-label="Send"]',
    'button[aria-label="Kirim"]',
    '[role="button"][aria-label*="Send"]',
    '[role="button"][aria-label*="Kirim"]'
  ]

  for (const selector of selectors) {
    const node = root.querySelector<HTMLElement>(selector)

    if (!node || !isVisibleElement(node)) {
      continue
    }

    const button = node.closest<HTMLElement>("button, [role='button'], [tabindex]")

    return button || node
  }

  return null
}

const clickSendButton = (): ChannelActionResponse => {
  const sendButton = findSendButton(getRoot())

  if (!sendButton) {
    return {
      ok: false,
      error: "Tombol kirim Instagram DM belum ditemukan.",
      code: "SEND_BUTTON_NOT_FOUND"
    }
  }

  sendButton.dispatchEvent(
    new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      view: window
    })
  )
  sendButton.dispatchEvent(
    new MouseEvent("mouseup", {
      bubbles: true,
      cancelable: true,
      view: window
    })
  )
  sendButton.click()

  return {
    ok: true
  }
}

const toSnapshotMessageDrafts = (
  mergedCandidates: TextCandidate[],
  chatTitle: string,
  paneCenterX: number,
  headerTexts: Set<string>
) =>
  mergedCandidates
    .map((candidate) => {
      const text = candidate.text

      if (!isUsefulMessageText(text, chatTitle) || headerTexts.has(text)) {
        return null
      }

      const direction =
        candidate.rect.left + candidate.rect.width / 2 > paneCenterX
          ? "outgoing"
          : "incoming"

      return {
        direction,
        text
      } satisfies SnapshotMessageDraft
    })
    .filter((message): message is SnapshotMessageDraft => Boolean(message))

const areDraftMessagesEqual = (
  left: SnapshotMessageDraft,
  right: SnapshotMessageDraft
) => left.direction === right.direction && left.text === right.text

const prependChunkWithOverlap = (
  existing: SnapshotMessageDraft[],
  incoming: SnapshotMessageDraft[]
) => {
  if (!incoming.length) {
    return existing
  }

  if (!existing.length) {
    return incoming
  }

  const maxOverlap = Math.min(existing.length, incoming.length)

  for (let overlap = maxOverlap; overlap >= 1; overlap -= 1) {
    let matches = true

    for (let index = 0; index < overlap; index += 1) {
      if (!areDraftMessagesEqual(incoming[incoming.length - overlap + index]!, existing[index]!)) {
        matches = false
        break
      }
    }

    if (matches) {
      return [...incoming.slice(0, incoming.length - overlap), ...existing]
    }
  }

  if (incoming.some((message) => existing.some((current) => areDraftMessagesEqual(message, current)))) {
    const existingSet = new Set(existing.map((message) => `${message.direction}:${message.text}`))

    return [
      ...incoming.filter((message) => !existingSet.has(`${message.direction}:${message.text}`)),
      ...existing
    ]
  }

  return [...incoming, ...existing]
}

const collectVisibleSnapshotDrafts = (chatTitle: string) => {
  const bounds = getConversationBounds()
  const headerTexts = getHeaderTextSet(getConversationPane())
  const mergedCandidates = readMessageCandidates()

  return {
    bounds,
    headerTexts,
    mergedCandidates,
    messages: toSnapshotMessageDrafts(mergedCandidates, chatTitle, bounds.centerX, headerTexts)
  }
}

const collectDomWideSnapshotDrafts = (chatTitle: string) => {
  const bounds = getConversationBounds()
  const headerTexts = getHeaderTextSet(getConversationPane())
  const mergedCandidates = readMessageCandidates({ includeOffscreen: true })

  return {
    bounds,
    headerTexts,
    mergedCandidates,
    messages: toSnapshotMessageDrafts(mergedCandidates, chatTitle, bounds.centerX, headerTexts)
  }
}

const collectConversationHistoryDrafts = async (chatTitle: string) => {
  const domWideDrafts = collectDomWideSnapshotDrafts(chatTitle)

  if (domWideDrafts.messages.length > 0) {
    return domWideDrafts
  }

  return collectVisibleSnapshotDrafts(chatTitle)
}

const buildSnapshot = async (): Promise<ChannelChatSnapshot> => {
  const chatTitle = getTitle()
  const { bounds, mergedCandidates, messages: collectedMessages } =
    await collectConversationHistoryDrafts(chatTitle)
  const composeBox = findComposeBox(getRoot())
  const titleCandidates = getTopRightTextCandidates(getRoot())

  const messages: ChannelMessage[] = collectedMessages
    .map((candidate, index) => {
      return {
        id: `instagram-${index}-${candidate.text.slice(0, 24)}`,
        author: candidate.direction === "outgoing" ? "Anda" : chatTitle,
        direction: candidate.direction,
        text: candidate.text,
        timestampLabel: ""
      } satisfies ChannelMessage
    })
    .slice(-MAX_VISIBLE_MESSAGES)

  return {
    channel: "instagram",
    provider: "extension",
    chatTitle,
    chatSubtitle: "Instagram DM",
    capturedAt: new Date().toISOString(),
    debugInfo: {
      bounds: `left>=${Math.round(bounds.minLeft)} right<=${Math.round(
        bounds.maxRight
      )} top>=${Math.round(bounds.minTop)} bottom<=${Math.round(bounds.maxBottom)}`,
      candidateCount: mergedCandidates.length,
      channel: "instagram",
      composeBox: formatRect(composeBox?.getBoundingClientRect()),
      selectedTextbox: composeBox
        ? `${composeBox.tagName.toLowerCase()} editable="${composeBox.isContentEditable}" | ${formatRect(
            composeBox.getBoundingClientRect()
          )} | text="${safeText(composeBox).slice(0, 40)}" | aria="${
            composeBox.getAttribute("aria-label") || ""
          }" | placeholder="${composeBox.getAttribute("placeholder") || ""}"`
        : "n/a",
      titleCandidateCount: titleCandidates.length
    },
    messages
  }
}

export const instagramAdapter: ChannelAdapter = {
  channel: "instagram",

  getComposeText: () => getComposeText(),

  getConversationTitle: () => getTitle(),

  insertReply(text: string) {
    return insertTextIntoComposeBox(text)
  },

  isSupportedPage() {
    return isInstagramDmPage()
  },

  async readOpenChat(): Promise<WhatsAppReadResponse> {
    try {
      const snapshot = await buildSnapshot()

      if (!snapshot.messages.length) {
        return {
          ok: false,
          error:
            "Belum ada pesan Instagram DM yang terbaca. Buka satu percakapan DM dulu."
        }
      }

      return {
        ok: true,
        data: snapshot
      }
    } catch (_error) {
      return {
        ok: false,
        error: "Gagal membaca Instagram DM."
      }
    }
  },

  async sendReply(text: string) {
    const insertResult = insertTextIntoComposeBox(text)

    if (!insertResult.ok) {
      return insertResult
    }

    return clickSendButton()
  }
}
