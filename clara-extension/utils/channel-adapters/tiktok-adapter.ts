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

const describeComposeSubtree = (root: HTMLElement | null | undefined) => {
  if (!root) {
    return "n/a"
  }

  const descendants = Array.from(root.querySelectorAll<HTMLElement>("*"))
    .slice(0, 8)
    .map((node) => {
      const cls = (node.className || "").toString().trim().split(/\s+/).slice(0, 2).join(".")
      return `${node.tagName.toLowerCase()}${cls ? "." + cls : ""}`
    })

  return descendants.join(" > ") || "(no-children)"
}

const isDraftJsEditor = (root: HTMLElement) =>
  root.innerHTML.includes("public-DraftStyleDefault-") ||
  Boolean(
    root.querySelector(
      ".public-DraftStyleDefault-block, .DraftEditor-root, .DraftEditor-editorContainer"
    )
  )

const getDeepestExistingCaretTarget = (
  root: HTMLElement
): { node: Node; offset: number } => {
  let current: Node = root

  while (current.lastChild) {
    current = current.lastChild
  }

  if (current.nodeType === Node.TEXT_NODE) {
    return {
      node: current,
      offset: current.textContent?.length || 0
    }
  }

  if (current !== root && current.parentNode) {
    const siblings = Array.from(current.parentNode.childNodes)
    const currentIndex = siblings.indexOf(current)

    return {
      node: current.parentNode,
      offset: currentIndex >= 0 ? currentIndex + 1 : current.parentNode.childNodes.length
    }
  }

  return {
    node: root,
    offset: root.childNodes.length
  }
}

const tryInsertViaPasteEvent = (composeBox: HTMLElement, text: string) => {
  const dataTransfer = new DataTransfer()
  dataTransfer.setData("text/plain", text)

  const pasteEvent = new ClipboardEvent("paste", {
    bubbles: true,
    cancelable: true,
    clipboardData: dataTransfer
  })

  composeBox.dispatchEvent(pasteEvent)

  return normalizeText(composeBox.innerText || composeBox.textContent || "") ===
    normalizeText(text)
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

const getRoot = () =>
  document.querySelector<HTMLElement>('main[role="main"]') ||
  document.querySelector<HTMLElement>("main") ||
  document.body

const IGNORED_TEXT = new Set([
  "tiktok",
  "messages",
  "send",
  "kirim",
  "new chat",
  "message requests",
  "search",
  "home",
  "friends",
  "profile",
  "inbox",
  "send a message...",
  "type a message..."
])

const META_TEXT_PATTERNS = [
  /^send a message\.{0,3}$/i,
  /^type a message\.{0,3}$/i,
  /^this video isn['’]t available$/i,
  /^\d+\s+members?$/i,
  /^(seen|sent|delivered|diterima|dilihat)$/i,
  /^(today|yesterday|kemarin)$/i,
  /^[a-z]+ \d{1,2}, \d{4} \d{1,2}:\d{2}$/i,
  /^\d{1,2}:\d{2}(\s?[ap]\.?m\.?)?$/i
]

const isTikTokMessagesPage = () =>
  window.location.hostname === "www.tiktok.com" &&
  window.location.pathname.startsWith("/messages")

const findDraftJsComposeBox = (root: ParentNode = document) =>
  root.querySelector<HTMLElement>(
    '[data-e2e="dm-new-input-editor"] .public-DraftEditor-content[contenteditable="true"], ' +
      '[data-e2e="dm-new-input-editor"] [contenteditable="true"][role="textbox"], ' +
      '[data-e2e="dm-new-input-editor"][contenteditable="true"]'
  )

const getVisibleTextboxCandidates = (root: ParentNode = document) => {
  const selectors = [
    '[data-e2e="dm-new-input-editor"] .public-DraftEditor-content[contenteditable="true"]',
    '[data-e2e="dm-new-input-editor"] [contenteditable="true"][role="textbox"]',
    '[data-e2e="dm-new-input-editor"][contenteditable="true"]',
    'textarea[placeholder*="message" i]',
    'textarea[aria-label*="message" i]',
    'input[placeholder*="message" i]',
    'input[aria-label*="message" i]',
    '[data-e2e*="message"] textarea',
    '[data-e2e*="chat"] textarea',
    '[contenteditable="true"][role="textbox"]',
    '[contenteditable="true"]',
    "textarea",
    "input",
    'div[role="textbox"]',
    'input[placeholder*="message" i]'
  ]

  return selectors
    .flatMap((selector) => Array.from(root.querySelectorAll<HTMLElement>(selector)))
    .filter((node) => {
      if (!isVisibleElement(node)) {
        return false
      }

      const rect = node.getBoundingClientRect()
      const haystack = `${safeText(node)} ${node.getAttribute("aria-label") || ""} ${
        node.getAttribute("placeholder") || ""
      }`.toLowerCase()
      const tagName = node.tagName.toLowerCase()
      const isNativeTextbox =
        node instanceof HTMLTextAreaElement ||
        (node instanceof HTMLInputElement &&
          ["text", "search", ""].includes((node.type || "").toLowerCase()))
      const isEditableDiv =
        node.isContentEditable || node.getAttribute("contenteditable") === "true"

      if (rect.width < 160 || rect.height < 20) {
        return false
      }

      if (!isNativeTextbox && !isEditableDiv) {
        return false
      }

      if (
        haystack.includes("search") ||
        haystack.includes("cari") ||
        haystack.includes("filter")
      ) {
        return false
      }

      if (
        tagName === "input" &&
        !/(send a message|message|pesan|chat|reply|balas)/i.test(haystack)
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
      }`
      const haystackB = `${safeText(b)} ${b.getAttribute("aria-label") || ""} ${
        b.getAttribute("placeholder") || ""
      }`
      const scoreA =
        rectA.top * 4 +
        rectA.left * 2 +
        rectA.width +
        (/(send a message|message|pesan|chat|reply|balas)/i.test(haystackA)
          ? 800
          : 0)
      const scoreB =
        rectB.top * 4 +
        rectB.left * 2 +
        rectB.width +
        (/(send a message|message|pesan|chat|reply|balas)/i.test(haystackB)
          ? 800
          : 0)

      return scoreB - scoreA
    })
}

const findComposeBox = (root: ParentNode = document) => {
  const draftJsComposeBox = findDraftJsComposeBox(root)

  if (draftJsComposeBox && isVisibleElement(draftJsComposeBox)) {
    return draftJsComposeBox
  }

  const candidates = getVisibleTextboxCandidates(root)
  const preferred = candidates.find((node) => {
    const rect = node.getBoundingClientRect()
    const haystack = `${safeText(node)} ${node.getAttribute("aria-label") || ""} ${
      node.getAttribute("placeholder") || ""
    }`.toLowerCase()

    return (
      rect.left >= window.innerWidth * 0.28 &&
      rect.top >= window.innerHeight * 0.7 &&
      /(send a message|message|pesan|chat|reply|balas)/i.test(haystack)
    )
  })

  if (preferred) {
    return preferred
  }

  return (
    candidates.find((node) => {
      const rect = node.getBoundingClientRect()
      return (
        rect.left >= window.innerWidth * 0.28 &&
        rect.top >= window.innerHeight * 0.7
      )
    }) ||
    Array.from(
      root.querySelectorAll<HTMLElement>("textarea, input, [contenteditable='true']")
    )
      .filter((node) => {
        if (!isVisibleElement(node)) {
          return false
        }

        const rect = node.getBoundingClientRect()
        const haystack = `${safeText(node)} ${node.getAttribute("aria-label") || ""} ${
          node.getAttribute("placeholder") || ""
        }`.toLowerCase()

        return (
          rect.left >= window.innerWidth * 0.28 &&
          rect.top >= window.innerHeight * 0.7 &&
          rect.width >= 160 &&
          /(send a message|message|pesan|chat|reply|balas)/i.test(haystack)
        )
      })
      .sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0] ||
    candidates[0] ||
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

type TopRightTextCandidate = {
  element: HTMLElement
  fontSize: number
  rect: DOMRect
  text: string
}

type TextCandidate = {
  rect: DOMRect
  text: string
}

const getTopRightTextCandidates = (
  root: ParentNode = document
): TopRightTextCandidate[] => {
  const composeBox = findComposeBox(root)
  const composeRect = composeBox?.getBoundingClientRect()
  const minLeft = composeRect
    ? Math.max(window.innerWidth * 0.28, composeRect.left)
    : window.innerWidth * 0.28
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

    if (centerX < minLeft || rect.top > window.innerHeight * 0.22) {
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
      rect.width >= window.innerWidth * 0.3 &&
      rect.height >= window.innerHeight * 0.45 &&
      rect.left >= window.innerWidth * 0.22
    ) {
      return ancestor
    }
  }

  return root
}

const getMessageViewport = () => {
  const pane = getConversationPane()
  const composeBox = findComposeBox(pane)
  const titleCandidate = getPrimaryTitleCandidate(pane)
  const composeRect = composeBox?.getBoundingClientRect()
  const titleRect = titleCandidate?.rect

  if (!composeRect || !titleRect) {
    return pane
  }

  const candidates = Array.from(pane.querySelectorAll<HTMLElement>("div, section, article"))
    .filter((node) => {
      if (!isVisibleElement(node) || node === composeBox || node.contains(composeBox)) {
        return false
      }

      const rect = node.getBoundingClientRect()
      const style = window.getComputedStyle(node)
      const isScrollable =
        style.overflowY === "auto" ||
        style.overflowY === "scroll" ||
        node.scrollHeight > node.clientHeight + 80

      if (!isScrollable) {
        return false
      }

      if (
        rect.left > titleRect.left + 40 ||
        rect.right < composeRect.right - 120 ||
        rect.top > titleRect.bottom + 40 ||
        rect.bottom < composeRect.top - 40
      ) {
        return false
      }

      return rect.width >= composeRect.width * 0.75 && rect.height >= 160
    })
    .sort((a, b) => {
      const rectA = a.getBoundingClientRect()
      const rectB = b.getBoundingClientRect()
      const scoreA =
        rectA.height * rectA.width -
        Math.abs(rectA.top - titleRect.bottom) * 100 -
        Math.abs(rectA.bottom - composeRect.top) * 100
      const scoreB =
        rectB.height * rectB.width -
        Math.abs(rectB.top - titleRect.bottom) * 100 -
        Math.abs(rectB.bottom - composeRect.top) * 100

      return scoreB - scoreA
    })

  return candidates[0] || pane
}

const getConversationBounds = () => {
  const pane = getConversationPane()
  const messageViewport = getMessageViewport()
  const composeBox = findComposeBox(pane)

  if (!composeBox) {
    const fallbackRoot = messageViewport.getBoundingClientRect()

    return {
      centerX: fallbackRoot.left + fallbackRoot.width / 2,
      maxBottom: Math.min(window.innerHeight * 0.92, fallbackRoot.bottom),
      maxRight: Math.min(window.innerWidth - 16, fallbackRoot.right),
      minLeft: Math.max(window.innerWidth * 0.28, fallbackRoot.left),
      minTop: Math.max(0, fallbackRoot.top),
      root: messageViewport
    }
  }

  const composeRect = composeBox.getBoundingClientRect()
  const viewportRect = messageViewport.getBoundingClientRect()

  return {
    centerX: composeRect.left + composeRect.width / 2,
    maxBottom: Math.min(composeRect.top, viewportRect.bottom),
    maxRight: Math.min(window.innerWidth, Math.max(viewportRect.right, composeRect.right + 24)),
    minLeft: Math.max(window.innerWidth * 0.28, Math.min(viewportRect.left, composeRect.left - 24)),
    minTop: Math.max(0, viewportRect.top),
    root: messageViewport
  }
}

const getActiveConversationTitle = () =>
  getPrimaryTitleCandidate(getConversationPane())?.text || ""

const hasActiveConversationOpen = () => {
  const pane = getConversationPane()
  const composeBox = findComposeBox(pane) || findComposeBox(getRoot())
  const title = getActiveConversationTitle()

  if (!composeBox || !title) {
    return false
  }

  const composeRect = composeBox.getBoundingClientRect()
  const paneRect = pane.getBoundingClientRect()

  return (
    composeRect.width >= 160 &&
    composeRect.height >= 18 &&
    paneRect.width >= composeRect.width * 0.85 &&
    paneRect.left <= composeRect.left + 48 &&
    paneRect.right >= composeRect.right - 48
  )
}

const getTitle = () => getActiveConversationTitle() || "TikTok DM"

const getHeaderTextSet = (root: ParentNode = document) => {
  const candidates = getTopRightTextCandidates(root)
  const primary = candidates[0]

  if (!primary) {
    return new Set<string>()
  }

  return new Set(
    candidates
      .filter((candidate) => {
        const isNearTop = candidate.rect.top <= primary.rect.bottom + 40
        const isNearLeft = Math.abs(candidate.rect.left - primary.rect.left) <= 72

        return isNearTop && isNearLeft
      })
      .map((candidate) => candidate.text)
      .filter(Boolean)
  )
}

const isUsefulMessageText = (text: string, chatTitle: string) => {
  const normalized = normalizeText(text)
  const lower = normalized.toLowerCase()

  if (!normalized) {
    return false
  }

  if (normalized.length > 3000) {
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

const readMessageCandidates = (): TextCandidate[] => {
  const bounds = getConversationBounds()
  const root = bounds.root
  const composeBox = findComposeBox(getConversationPane())
  const composeRect = composeBox?.getBoundingClientRect()
  const titleCandidate = getPrimaryTitleCandidate(root)
  const minTop = titleCandidate?.rect.bottom ?? Math.max(bounds.minTop, window.innerHeight * 0.08)
  const effectiveMinLeft = titleCandidate
    ? Math.max(bounds.minLeft, titleCandidate.rect.left - 28)
    : bounds.minLeft
  const effectiveMaxBottom = composeRect?.top ?? bounds.maxBottom
  const viewportRect = root.getBoundingClientRect()
  const candidates: TextCandidate[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)

  while (walker.nextNode()) {
    const textNode = walker.currentNode
    const parent = textNode.parentElement
    const text = normalizeText(textNode.textContent || "")

    if (!parent || !text || !isVisibleElement(parent)) {
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
      rect.left < viewportRect.left - 12 ||
      rect.right > viewportRect.right + 12 ||
      centerX < effectiveMinLeft - 16 ||
      centerX > bounds.maxRight + 16
    ) {
      continue
    }

    const bubbleContainer = parent.closest<HTMLElement>("div, li, article, section")
    const bubbleRect = bubbleContainer?.getBoundingClientRect()

    if (
      bubbleRect &&
      (bubbleRect.top < minTop - 24 ||
        bubbleRect.bottom > effectiveMaxBottom + 24 ||
        bubbleRect.left < viewportRect.left - 24 ||
        bubbleRect.right > viewportRect.right + 24)
    ) {
      continue
    }

    candidates.push({
      rect,
      text
    })
  }

  const seen = new Set<string>()

  return candidates.filter((candidate) => {
    const key = `${candidate.text}-${Math.round(candidate.rect.top)}-${Math.round(
      candidate.rect.left
    )}`

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
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

const focusComposeBox = (): ChannelActionResponse => {
  const composeBox = findDraftJsComposeBox(getRoot()) || findComposeBox(getRoot())

  if (!composeBox) {
    return {
      ok: false,
      error: "Kolom ketik TikTok DM belum ditemukan.",
      code: "COMPOSE_BOX_NOT_FOUND"
    }
  }

  composeBox.focus()
  composeBox.click()

  return {
    ok: true
  }
}

const insertTextIntoComposeBox = (text: string): ChannelActionResponse => {
  const composeBox = findDraftJsComposeBox(getRoot()) || findComposeBox(getRoot())
  const normalizedText = text.trim()

  if (!composeBox) {
    return {
      ok: false,
      error: "Kolom ketik TikTok DM belum ditemukan.",
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

  if (isDraftJsEditor(composeBox)) {
    composeBox.click()

    const insertedWithPaste = tryInsertViaPasteEvent(composeBox, normalizedText)

    if (!insertedWithPaste) {
      return {
        ok: false,
        error:
          "Editor TikTok terdeteksi, tapi tidak menerima paste sintetis dari extension.",
        code: "COMPOSE_BOX_INSERT_FAILED"
      }
    }

    composeBox.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        data: normalizedText,
        inputType: "insertFromPaste"
      })
    )
    composeBox.dispatchEvent(new Event("change", { bubbles: true }))

    return {
      ok: true
    }
  }

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

  if (!composeBox.isContentEditable) {
    return {
      ok: false,
      error: "Kolom ketik TikTok DM terdeteksi, tapi elemennya bukan field editable.",
      code: "COMPOSE_BOX_NOT_EDITABLE"
    }
  }

  const selection = window.getSelection()
  const range = document.createRange()
  const caretTarget = getDeepestExistingCaretTarget(composeBox)
  range.setStart(caretTarget.node, caretTarget.offset)
  range.collapse(true)
  selection?.removeAllRanges()
  selection?.addRange(range)

  let insertedWithNativeCommand = false

  try {
    insertedWithNativeCommand = document.execCommand(
      "insertText",
      false,
      normalizedText
    )
  } catch (_error) {
    insertedWithNativeCommand = false
  }

  if (!insertedWithNativeCommand) {
    return {
      ok: false,
      error:
        "Kolom ketik TikTok DM ditemukan, tapi TikTok menolak insert text yang aman ke editor ini.",
      code: "COMPOSE_BOX_INSERT_FAILED"
    }
  }

  composeBox.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      data: normalizedText,
      inputType: "insertText"
    })
  )
  composeBox.dispatchEvent(new Event("change", { bubbles: true }))

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
    '[role="button"][aria-label*="Kirim"]',
    '[data-e2e*="send"]'
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
      error: "Tombol kirim TikTok DM belum ditemukan.",
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
  const pane = getConversationPane()
  const composeBox = findComposeBox(pane) || findComposeBox(getRoot())
  const chatTitle = getActiveConversationTitle()

  if (!composeBox || !hasActiveConversationOpen()) {
    throw new Error("TIKTOK_ACTIVE_CONVERSATION_NOT_OPEN")
  }

  if (!chatTitle) {
    throw new Error("TIKTOK_ACTIVE_CONVERSATION_TITLE_NOT_FOUND")
  }

  const bounds = getConversationBounds()
  const titleCandidates = getTopRightTextCandidates(pane)
  const headerTexts = getHeaderTextSet(pane)
  const rawCandidates = readMessageCandidates()

  const messages: ChannelMessage[] = rawCandidates
    .map((candidate, index) => {
      const text = candidate.text

      if (!isUsefulMessageText(text, chatTitle) || headerTexts.has(text)) {
        return null
      }

      const direction =
        candidate.rect.left + candidate.rect.width / 2 > bounds.centerX
          ? "outgoing"
          : "incoming"

      return {
        id: `tiktok-${index}-${text.slice(0, 24)}`,
        author: direction === "outgoing" ? "Anda" : chatTitle,
        direction,
        text,
        timestampLabel: ""
      } satisfies ChannelMessage
    })
    .filter((message): message is ChannelMessage => Boolean(message))
    .slice(-MAX_VISIBLE_MESSAGES)

  return {
    channel: "tiktok",
    provider: "extension",
    chatTitle,
    chatSubtitle: "TikTok DM",
    capturedAt: new Date().toISOString(),
    debugInfo: {
      bounds: `left>=${Math.round(bounds.minLeft)} right<=${Math.round(
        bounds.maxRight
      )} top>=${Math.round(bounds.minTop)} bottom<=${Math.round(bounds.maxBottom)}`,
      candidateCount: rawCandidates.length,
      channel: "tiktok",
      composeBox: formatRect(composeBox?.getBoundingClientRect()),
      selectedTextbox: composeBox
        ? `${composeBox.tagName.toLowerCase()} type="${
            composeBox instanceof HTMLInputElement ||
            composeBox instanceof HTMLTextAreaElement
              ? composeBox.type || ""
              : ""
          }" editable="${composeBox.isContentEditable}" | ${formatRect(
            composeBox.getBoundingClientRect()
          )} | text="${safeText(composeBox).slice(0, 40)}" | aria="${
            composeBox.getAttribute("aria-label") || ""
          }" | placeholder="${composeBox.getAttribute("placeholder") || ""}" | subtree="${describeComposeSubtree(
            composeBox
          )}"`
        : "n/a",
      titleCandidateCount: titleCandidates.length
    },
    messages
  }
}

export const tiktokAdapter: ChannelAdapter = {
  channel: "tiktok",

  focusCompose: () => focusComposeBox(),

  getComposeText: () => getComposeText(),

  getConversationTitle: () => getTitle(),

  insertReply(text: string) {
    return insertTextIntoComposeBox(text)
  },

  isSupportedPage() {
    return isTikTokMessagesPage()
  },

  readOpenChat(): WhatsAppReadResponse {
    try {
      const snapshot = buildSnapshot()

      if (!snapshot.messages.length) {
        return {
          ok: false,
          error:
            "Belum ada pesan TikTok DM yang terbaca. Buka satu percakapan DM dulu."
        }
      }

      return {
        ok: true,
        data: snapshot
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "TIKTOK_ACTIVE_CONVERSATION_NOT_OPEN"
      ) {
        return {
          ok: false,
          error:
            "Buka satu percakapan TikTok DM sampai kolom Send a message muncul dulu."
        }
      }

      if (
        error instanceof Error &&
        error.message === "TIKTOK_ACTIVE_CONVERSATION_TITLE_NOT_FOUND"
      ) {
        return {
          ok: false,
          error: "Judul percakapan TikTok DM aktif belum berhasil dikenali."
        }
      }

      return {
        ok: false,
        error: "Gagal membaca TikTok DM."
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
