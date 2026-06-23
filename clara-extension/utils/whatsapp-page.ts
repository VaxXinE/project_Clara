import type {
  WhatsAppActionResponse,
  WhatsAppChatSnapshot,
  WhatsAppMessage,
  WhatsAppMessageDirection,
  WhatsAppReadResponse
} from "~/types/whatsapp"

const INSERT_LOCK_KEY = "__sgExtensionInsertLock__"

const parsePrePlainText = (value: string) => {
  const trimmedValue = value.trim()
  const match = trimmedValue.match(
    /^\[(?<timestamp>[^\]]+)\]\s?(?<author>.*?)(?::)?$/
  )

  return {
    author: match?.groups?.author?.trim() || "",
    timestampLabel: match?.groups?.timestamp?.trim() || ""
  }
}

const SELF_AUTHOR_PATTERN = /^(you|anda|me|saya)$/i

const getChatRoot = () => {
  const selectors = [
    '#main[data-testid="conversation-panel-wrapper"]',
    "#main",
    '[data-testid="conversation-panel-wrapper"]'
  ]

  for (const selector of selectors) {
    const node = document.querySelector<HTMLElement>(selector)

    if (node) {
      return node
    }
  }

  return null
}

const getConversationTitle = (chatRoot: HTMLElement) => {
  const titleSelectors = [
    '[data-testid="conversation-info-header-chat-title"]',
    'header [title]',
    'header [dir="auto"]'
  ]

  for (const selector of titleSelectors) {
    const node = chatRoot.querySelector<HTMLElement>(selector)
    const title = node?.getAttribute("title")?.trim() || node?.textContent?.trim()

    if (title) {
      return title
    }
  }

  return ""
}

const getConversationSubtitle = (chatRoot: HTMLElement) => {
  const subtitleSelectors = [
    '[data-testid="chat-subtitle"]',
    "header span[title]"
  ]

  for (const selector of subtitleSelectors) {
    const node = chatRoot.querySelector<HTMLElement>(selector)
    const subtitle = node?.getAttribute("title")?.trim() || node?.textContent?.trim()

    if (subtitle) {
      return subtitle
    }
  }

  return ""
}

const queryUniqueMessageContainers = (root: ParentNode) => {
  const panelRoot =
    root.querySelector<HTMLElement>('[data-testid="conversation-panel-messages"]') ||
    root

  return Array.from(
    new Set(
      Array.from(
        panelRoot.querySelectorAll<HTMLElement>('[data-testid="msg-container"]')
      )
    )
  )
}

const getMessageDirection = (container: HTMLElement): WhatsAppMessageDirection => {
  const metaSource =
    container
      .querySelector<HTMLElement>("[data-pre-plain-text]")
      ?.getAttribute("data-pre-plain-text") || ""
  const parsedMeta = parsePrePlainText(metaSource)
    const directionNode =
    container.matches(".message-out, .message-in")
      ? container
      : container.querySelector<HTMLElement>(".message-out, .message-in") ||
        container.closest<HTMLElement>(".message-out, .message-in") ||
        container.parentElement?.closest<HTMLElement>(".message-out, .message-in") ||
        null

  if (directionNode?.classList.contains("message-out")) {
    return "outgoing"
  }

  if (directionNode?.classList.contains("message-in")) {
    return "incoming"
  }

  if (
    container.querySelector(
      '[data-icon="msg-check"], [data-icon="msg-dblcheck"], [data-icon="status-dblcheck"], [data-icon="msg-time"]'
    ) &&
    SELF_AUTHOR_PATTERN.test(parsedMeta.author)
  ) {
    return "outgoing"
  }

  if (SELF_AUTHOR_PATTERN.test(parsedMeta.author)) {
    return "outgoing"
  }

  const alignmentNodes = [
    container,
    container.parentElement,
    container.parentElement?.parentElement
  ].filter((node): node is HTMLElement => Boolean(node))

  for (const node of alignmentNodes) {
    const computedStyle = window.getComputedStyle(node)

    if (computedStyle.justifyContent === "flex-end") {
      return "outgoing"
    }

    if (computedStyle.justifyContent === "flex-start") {
      return "incoming"
    }

    if (node.classList.contains("xuk3077")) {
      return "outgoing"
    }

    if (node.classList.contains("x1cy8zhl")) {
      return "incoming"
    }
  }

  const rect = container.getBoundingClientRect()
  const leftSpace = rect.left
  const rightSpace = window.innerWidth - rect.right

  if (rightSpace < leftSpace) {
    return "outgoing"
  }

  return "incoming"
}

const normalizeMessageBlockText = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim()

const getPreferredMessageTexts = (nodes: HTMLElement[]) => {
  const uniqueTexts = Array.from(
    new Set(
      nodes
        .map((node) => normalizeMessageBlockText(node.innerText || ""))
        .filter(Boolean)
    )
  )

  return uniqueTexts.filter(
    (text) =>
      !uniqueTexts.some(
        (otherText) =>
          otherText !== text &&
          otherText.length > text.length &&
          otherText.includes(text)
      )
  )
}

const splitReplyAwareMessageText = (candidates: string[]) => {
  if (candidates.length === 0) {
    return ""
  }

  if (candidates.length > 1) {
    return candidates[candidates.length - 1]
  }

  const singleCandidate = candidates[0]
  const lines = singleCandidate
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length >= 2) {
    const replyContext = lines.slice(0, -1).join(" ").trim()
    const bodyText = lines[lines.length - 1]?.trim() || ""

    if (replyContext.length >= 18 && bodyText) {
      return bodyText
    }
  }

  return singleCandidate
}

const getMessageText = (container: HTMLElement) => {
  const primaryCandidates = getPreferredMessageTexts(
    Array.from(container.querySelectorAll<HTMLElement>('[data-testid="msg-text"]'))
  )
  const fallbackCandidates = getPreferredMessageTexts(
    Array.from(
      container.querySelectorAll<HTMLElement>(
        '[data-testid="selectable-text"], .copyable-text'
      )
    )
  )
  const candidates =
    primaryCandidates.length > 0 ? primaryCandidates : fallbackCandidates

  if (candidates.length > 0) {
    return splitReplyAwareMessageText(candidates)
  }

  const mediaLabel = container
    .querySelector<HTMLElement>('[data-testid="media-caption"], [aria-label]')
    ?.innerText

  const normalizedMediaLabel = mediaLabel
    ? normalizeMessageBlockText(mediaLabel)
    : ""

  return normalizedMediaLabel || ""
}

const getComposeBox = () => {
  const selectors = [
    '[data-testid="conversation-compose-box-input"][contenteditable="true"]',
    '[contenteditable="true"][data-lexical-editor="true"]',
    'footer [contenteditable="true"][role="textbox"]'
  ]

  for (const selector of selectors) {
    const node = document.querySelector<HTMLElement>(selector)

    if (node) {
      return node
    }
  }

  return null
}

const getComposeFooter = () => getComposeBox()?.closest("footer") || document

const getComposeText = (composeBox: HTMLElement) =>
  composeBox.innerText.replace(/\s+/g, " ").trim()

const clickElement = (node: HTMLElement) => {
  node.dispatchEvent(
    new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      view: window
    })
  )
  node.dispatchEvent(
    new MouseEvent("mouseup", {
      bubbles: true,
      cancelable: true,
      view: window
    })
  )
  node.click()
}

const getSendButtonTarget = (): HTMLElement | null => {
  const searchRoot = getComposeFooter()
  const selectors = [
    '[data-testid="compose-btn-send"]',
    'button[aria-label="Send"]',
    'button[aria-label="Kirim"]',
    '[aria-label="Send"]',
    '[aria-label="Kirim"]',
    '[data-icon="send"]'
  ]

  for (const selector of selectors) {
    const node = searchRoot.querySelector<HTMLElement>(selector)

    if (!node) {
      continue
    }

    const clickableTarget =
      node.tagName === "BUTTON"
        ? node
        : node.closest<HTMLElement>('button, [role="button"], [tabindex]')

    const target = clickableTarget || node

    if (
      target instanceof HTMLButtonElement &&
      (target.disabled || target.hasAttribute("disabled"))
    ) {
      continue
    }

    return target
  }

  return null
}

export const readOpenChat = (): WhatsAppReadResponse => {
  const chatRoot = getChatRoot()

  if (!chatRoot) {
    return {
      error: "Panel chat WhatsApp Web belum ditemukan.",
      ok: false
    }
  }

  const chatTitle = getConversationTitle(chatRoot)

  if (!chatTitle) {
    return {
      error: "Belum ada percakapan yang sedang dibuka.",
      ok: false
    }
  }

  const messageContainers = queryUniqueMessageContainers(chatRoot)

  const messages: WhatsAppMessage[] = messageContainers
    .map((container, index) => {
      const metaSource =
        container
          .querySelector<HTMLElement>("[data-pre-plain-text]")
          ?.getAttribute("data-pre-plain-text") || ""
      const parsedMeta = parsePrePlainText(metaSource)
      const text = getMessageText(container)

      if (!text) {
        return null
      }

      return {
        author:
          parsedMeta.author ||
          (getMessageDirection(container) === "outgoing" ? "Anda" : chatTitle),
        direction: getMessageDirection(container),
        id: `${parsedMeta.timestampLabel}-${index}`,
        text,
        timestampLabel: parsedMeta.timestampLabel
      }
    })
    .filter((message): message is WhatsAppMessage => Boolean(message))

  const snapshot: WhatsAppChatSnapshot = {
    capturedAt: new Date().toISOString(),
    chatSubtitle: getConversationSubtitle(chatRoot),
    chatTitle,
    messages
  }

  return {
    data: snapshot,
    ok: true
  }
}

export const insertReplyIntoComposeBox = (
  text: string
): WhatsAppActionResponse => {
  const chatRoot = getChatRoot()

  if (!chatRoot || !getConversationTitle(chatRoot)) {
    return {
      error: "Buka percakapan WhatsApp yang aktif dulu sebelum memasukkan balasan.",
      ok: false
    }
  }

  const composeBox = getComposeBox()

  if (!composeBox) {
    return {
      error: "Kolom ketik WhatsApp belum ditemukan.",
      ok: false
    }
  }

  const normalizedText = text.trim()

  if (!normalizedText) {
    return {
      error: "Teks balasan kosong.",
      ok: false
    }
  }

  const activeLock = (window as typeof window & {
    [INSERT_LOCK_KEY]?: { text: string; timestamp: number }
  })[INSERT_LOCK_KEY]

  if (
    activeLock &&
    activeLock.text === normalizedText &&
    Date.now() - activeLock.timestamp < 1200
  ) {
    return {
      ok: true
    }
  }

  if (getComposeText(composeBox) === normalizedText) {
    return {
      ok: true
    }
  }

  ;(window as typeof window & {
    [INSERT_LOCK_KEY]?: { text: string; timestamp: number }
  })[INSERT_LOCK_KEY] = {
    text: normalizedText,
    timestamp: Date.now()
  }

  composeBox.focus()

  const selection = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(composeBox)
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
    // Ignore and fall back to manual insertion below.
  }

  if (insertedWithNativeCommand && getComposeText(composeBox) === normalizedText) {
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

  if (getComposeText(composeBox) !== normalizedText) {
    const paragraph = document.createElement("p")
    paragraph.setAttribute("dir", "auto")
    paragraph.appendChild(document.createTextNode(normalizedText))
    composeBox.replaceChildren(paragraph)
  }

  composeBox.dispatchEvent(new Event("input", { bubbles: true }))
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

const wait = (ms: number) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })

const normalizeMessageText = (value: string) =>
  value.replace(/\s+/g, " ").trim().toLowerCase()

const getMessageContainers = () => {
  const chatRoot = getChatRoot()

  if (!chatRoot) {
    return []
  }

  return Array.from(
    queryUniqueMessageContainers(chatRoot)
  )
}

const getLatestOutgoingMessageSnapshot = () => {
  const outgoingMessages = getMessageContainers()
    .map((container, index) => ({
      direction: getMessageDirection(container),
      index,
      text: getMessageText(container)
    }))
    .filter((message) => message.direction === "outgoing" && message.text.trim())

  const latestOutgoingMessage = outgoingMessages[outgoingMessages.length - 1]

  return {
    count: outgoingMessages.length,
    text: latestOutgoingMessage?.text.trim() || ""
  }
}

const waitForOutgoingMessageConfirmation = async (expectedText: string) => {
  const normalizedExpected = normalizeMessageText(expectedText)
  const beforeSendSnapshot = getLatestOutgoingMessageSnapshot()

  for (let attempt = 0; attempt < 12; attempt += 1) {
    await wait(250)

    const composeBox = getComposeBox()
    const composeText = composeBox ? getComposeText(composeBox) : ""
    const afterSendSnapshot = getLatestOutgoingMessageSnapshot()
    const normalizedLatestOutgoing = normalizeMessageText(afterSendSnapshot.text)

    const outgoingMessageAppended =
      afterSendSnapshot.count > beforeSendSnapshot.count &&
      normalizedLatestOutgoing === normalizedExpected

    const latestOutgoingReplaced =
      afterSendSnapshot.count === beforeSendSnapshot.count &&
      afterSendSnapshot.text !== beforeSendSnapshot.text &&
      normalizedLatestOutgoing === normalizedExpected

    if (outgoingMessageAppended || latestOutgoingReplaced) {
      return true
    }

    if (!composeText.trim() && normalizedLatestOutgoing === normalizedExpected) {
      return true
    }
  }

  return false
}

export const sendReplyThroughComposeBox = async (
  text: string
): Promise<WhatsAppActionResponse> => {
  const insertResult = insertReplyIntoComposeBox(text)

  if (!insertResult.ok) {
    return insertResult
  }

  const sendButtonTarget = getSendButtonTarget()

  if (sendButtonTarget) {
    clickElement(sendButtonTarget)

    const isConfirmed = await waitForOutgoingMessageConfirmation(text)

    if (!isConfirmed) {
      return {
        error:
          "Tombol kirim sudah ditekan, tapi WhatsApp belum menampilkan pesan baru. Pesan belum dianggap terkirim.",
        ok: false
      }
    }

    return {
      ok: true
    }
  }

  const composeBox = getComposeBox()

  if (!composeBox) {
    return {
      error: "Kolom ketik WhatsApp belum ditemukan.",
      ok: false
    }
  }

  composeBox.focus()
  composeBox.dispatchEvent(
    new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Enter",
      code: "Enter"
    })
  )
  composeBox.dispatchEvent(
    new KeyboardEvent("keyup", {
      bubbles: true,
      cancelable: true,
      key: "Enter",
      code: "Enter"
    })
  )

  const isConfirmed = await waitForOutgoingMessageConfirmation(text)

  if (!isConfirmed) {
    return {
      error:
        "Enter sudah dipicu, tapi WhatsApp belum menampilkan pesan baru. Pesan belum dianggap terkirim.",
      ok: false
    }
  }

  return {
    ok: true
  }
}
