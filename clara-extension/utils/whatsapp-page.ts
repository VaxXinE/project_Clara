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

const getMessageDirection = (container: HTMLElement): WhatsAppMessageDirection => {
  const bubble = container.closest(".message-out, .message-in")

  return bubble?.classList.contains("message-out") ? "outgoing" : "incoming"
}

const getLeafTextCandidates = (nodes: HTMLElement[]) => {
  return nodes.filter(
    (node) => !nodes.some((otherNode) => otherNode !== node && node.contains(otherNode))
  )
}

const getMessageText = (container: HTMLElement) => {
  const primaryCandidates = getLeafTextCandidates(
    Array.from(container.querySelectorAll<HTMLElement>('[data-testid="msg-text"]'))
  )
  const fallbackCandidates = getLeafTextCandidates(
    Array.from(
      container.querySelectorAll<HTMLElement>(
        '[data-testid="selectable-text"], .copyable-text'
      )
    )
  )
  const candidates =
    primaryCandidates.length > 0 ? primaryCandidates : fallbackCandidates

  const uniqueTexts = Array.from(
    new Set(
      candidates
        .map((node) => node.innerText.replace(/\s+/g, " ").trim())
        .filter(Boolean)
    )
  )

  if (uniqueTexts.length > 0) {
    return uniqueTexts.join("\n")
  }

  const mediaLabel = container
    .querySelector<HTMLElement>('[data-testid="media-caption"], [aria-label]')
    ?.innerText?.trim()

  return mediaLabel || ""
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

const getComposeText = (composeBox: HTMLElement) =>
  composeBox.innerText.replace(/\s+/g, " ").trim()

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

  const messageContainers = Array.from(
    chatRoot.querySelectorAll<HTMLElement>(
      '[data-testid="conversation-panel-messages"] [data-testid="msg-container"], [data-testid="msg-container"]'
    )
  )

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
