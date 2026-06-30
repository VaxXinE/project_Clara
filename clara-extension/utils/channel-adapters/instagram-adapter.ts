import type {
  ChannelActionResponse,
  ChannelChatSnapshot,
  ChannelMessage
} from "~/types/channel"
import type { WhatsAppReadResponse } from "~/types/whatsapp"

import type { ChannelAdapter } from "./base"

const MAX_VISIBLE_MESSAGES = 80

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

const findComposeBox = (root: ParentNode = document) => {
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
  const root = getConversationPane()
  const composeBox = findComposeBox(root)

  if (!composeBox) {
    const fallbackRoot = root.getBoundingClientRect()

    return {
      centerX: fallbackRoot.left + fallbackRoot.width / 2,
      maxBottom: Math.min(window.innerHeight * 0.92, fallbackRoot.bottom),
      maxRight: Math.min(window.innerWidth - 16, fallbackRoot.right),
      minLeft: Math.max(window.innerWidth * 0.45, fallbackRoot.left),
      minTop: Math.max(0, fallbackRoot.top),
      root
    }
  }

  const composeRect = composeBox.getBoundingClientRect()
  const paneRect = root.getBoundingClientRect()

  return {
    centerX: composeRect.left + composeRect.width / 2,
    maxBottom: composeRect.top,
    maxRight: Math.min(window.innerWidth, Math.max(paneRect.right, composeRect.right + 24)),
    minLeft: Math.max(window.innerWidth * 0.45, Math.min(paneRect.left, composeRect.left - 24)),
    minTop: Math.max(0, paneRect.top),
    root
  }
}

const getTopRightTextCandidates = (
  root: ParentNode = document
): TopRightTextCandidate[] => {
  const candidates: TopRightTextCandidate[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)

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
      centerX < window.innerWidth * 0.45 ||
      rect.top > window.innerHeight * 0.22
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

const getConversationPane = () => {
  const root = getRoot()
  const composeBox = findComposeBox(root)
  const titleCandidate = getPrimaryTitleCandidate(root)

  if (!composeBox || !titleCandidate?.element) {
    return root
  }

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

  return root
}

const getTitle = () => {
  const directCandidates = getTopRightTextCandidates(getConversationPane())

  return directCandidates[0]?.text || "Instagram DM"
}

const getHeaderTextSet = (root: ParentNode = document) => {
  const candidates = getTopRightTextCandidates(root)
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

      if (childTextCount >= 1 || hasMedia) {
        bestCandidate = current
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

const collectBubbleText = (
  bubble: HTMLElement,
  bounds: ReturnType<typeof getConversationBounds>
) => {
  const bubbleRect = bubble.getBoundingClientRect()
  const parts: string[] = []
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
    parts.push(text)
    rects.push(rect)
  }

  const text = mergeMessageCandidateTexts(parts)

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

  return normalizeText(cleanedTexts.join(" "))
}

const readMessageCandidates = (): TextCandidate[] => {
  const bounds = getConversationBounds()
  const { maxBottom, maxRight, minLeft, root } = bounds
  const rootElement = root instanceof HTMLElement ? root : getConversationPane()
  const primaryTitleCandidate = getPrimaryTitleCandidate(root)
  const effectiveMinLeft = primaryTitleCandidate
    ? Math.max(minLeft, primaryTitleCandidate.rect.left - 36)
    : minLeft
  const headerCandidates = getTopRightTextCandidates(root).filter(
    (candidate) => candidate.text === (primaryTitleCandidate?.text || getTitle())
  )
  const composeBox = findComposeBox(root)
  const composeRect = composeBox?.getBoundingClientRect()
  const minTop = headerCandidates[0]?.rect.bottom ?? window.innerHeight * 0.08
  const effectiveMaxBottom = composeRect?.top ?? maxBottom
  const bubbleMap = new Map<string, BubbleCandidate>()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)

  while (walker.nextNode()) {
    const textNode = walker.currentNode
    const text = normalizeText(textNode.textContent || "")
    const parent = textNode.parentElement

    if (!text || !parent || !isVisibleElement(parent)) {
      continue
    }

    if (
      parent.closest("header") ||
      parent.closest("nav") ||
      parent.closest("aside") ||
      parent.closest("footer") ||
      parent.closest("form") ||
      parent.closest("button")
    ) {
      continue
    }

    if (isLikelyLinkPreviewTextNode(textNode, parent)) {
      continue
    }

    const mediaAncestor = parent.closest<HTMLElement>("article, section, div, li")
    const mediaRect = mediaAncestor?.getBoundingClientRect()

    if (
      mediaAncestor &&
      mediaRect &&
      mediaRect.width >= 180 &&
      mediaRect.height >= 180 &&
      mediaAncestor.querySelector("img, video, canvas, svg")
    ) {
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
      rect.top < minTop - 8 ||
      rect.bottom > effectiveMaxBottom + 8 ||
      centerX < effectiveMinLeft - 16 ||
      centerX > maxRight + 16
    ) {
      continue
    }

    const bubbleElement = getBubbleContainer(parent, rootElement)
    const bubbleKey = getBubbleKey(parent, rootElement)
    const bubbleRect = bubbleElement.getBoundingClientRect()

    if (!bubbleMap.has(bubbleKey)) {
      bubbleMap.set(bubbleKey, {
        bubbleKey,
        element: bubbleElement,
        rect: bubbleRect
      })
    }
  }

  return Array.from(bubbleMap.values())
    .map((bubble) => {
      const bubbleText = collectBubbleText(bubble.element, {
        centerX: bounds.centerX,
        maxBottom: effectiveMaxBottom,
        maxRight,
        minLeft: effectiveMinLeft,
        minTop,
        root
      })

      return bubbleText ?
          {
            bubbleKey: bubble.bubbleKey,
            rect: bubbleText.rect,
            text: bubbleText.text
          }
        : null
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

const buildSnapshot = (): ChannelChatSnapshot => {
  const chatTitle = getTitle()
  const bounds = getConversationBounds()
  const paneCenterX = bounds.centerX
  const composeBox = findComposeBox(getRoot())
  const titleCandidates = getTopRightTextCandidates(getRoot())
  const headerTexts = getHeaderTextSet(getConversationPane())
  const mergedCandidates = readMessageCandidates()

  const messages: ChannelMessage[] = mergedCandidates
    .map((candidate, index) => {
      const text = candidate.text

      if (!isUsefulMessageText(text, chatTitle) || headerTexts.has(text)) {
        return null
      }

      const direction =
        candidate.rect.left + candidate.rect.width / 2 > paneCenterX
          ? "outgoing"
          : "incoming"

      return {
        id: `instagram-${index}-${text.slice(0, 24)}`,
        author: direction === "outgoing" ? "Anda" : chatTitle,
        direction,
        text,
        timestampLabel: ""
      } satisfies ChannelMessage
    })
    .filter((message): message is ChannelMessage => Boolean(message))
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

  readOpenChat(): WhatsAppReadResponse {
    try {
      const snapshot = buildSnapshot()

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
