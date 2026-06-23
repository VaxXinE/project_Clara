import type { PlasmoCSConfig } from "plasmo"

import {
  insertReplyIntoComposeBox,
  readOpenChat,
  sendReplyThroughComposeBox
} from "~/utils/whatsapp-page"

export const config: PlasmoCSConfig = {
  matches: ["https://web.whatsapp.com/*"]
}

const MESSAGE_HANDLER_KEY = "__sgExtensionWhatsAppHandler__"
const MANUAL_SEND_LOCK_KEY = "__sgExtensionManualSendLock__"

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

const getComposeText = () =>
  getComposeBox()?.innerText.replace(/\s+/g, " ").trim() || ""

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

const getConversationTitle = () => {
  const chatRoot = getChatRoot()

  if (!chatRoot) {
    return ""
  }

  const titleSelectors = [
    '[data-testid="conversation-info-header-chat-title"]',
    "header [title]",
    'header [dir="auto"]'
  ]

  for (const selector of titleSelectors) {
    const node = chatRoot.querySelector<HTMLElement>(selector)
    const title =
      node?.getAttribute("title")?.trim() || node?.textContent?.trim()

    if (title) {
      return title
    }
  }

  return ""
}

const triggerManualSendSync = () => {
  const composeText = getComposeText()
  const chatTitle = getConversationTitle()

  if (!composeText || !chatTitle) {
    return
  }

  const contentWindow = window as typeof window & {
    [MANUAL_SEND_LOCK_KEY]?: { text: string; timestamp: number }
  }
  const activeLock = contentWindow[MANUAL_SEND_LOCK_KEY]

  if (
    activeLock &&
    activeLock.text === composeText &&
    Date.now() - activeLock.timestamp < 1200
  ) {
    return
  }

  contentWindow[MANUAL_SEND_LOCK_KEY] = {
    text: composeText,
    timestamp: Date.now()
  }

  chrome.runtime.sendMessage({
    chatTitle,
    composeText,
    type: "WHATSAPP_MANUAL_SEND_TRIGGERED"
  })
}

const handleRuntimeMessage = (
  message: { text?: string; type?: string },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => {
  if (message?.type === "READ_WHATSAPP_CHAT") {
    sendResponse(readOpenChat())
    return false
  }

  if (message?.type === "INSERT_WHATSAPP_REPLY") {
    sendResponse(insertReplyIntoComposeBox(String(message?.text || "")))
    return false
  }

  if (message?.type === "SEND_WHATSAPP_REPLY") {
    sendReplyThroughComposeBox(String(message?.text || ""))
      .then((result) => {
        sendResponse(result)
      })
      .catch((error) => {
        sendResponse({
          error:
            error instanceof Error
              ? error.message
              : "Terjadi kendala saat mengirim balasan ke WhatsApp.",
          ok: false
        })
      })

    return true
  }

  return false
}

const contentWindow = window as typeof window & {
  [MESSAGE_HANDLER_KEY]?: typeof handleRuntimeMessage
}

if (contentWindow[MESSAGE_HANDLER_KEY]) {
  chrome.runtime.onMessage.removeListener(contentWindow[MESSAGE_HANDLER_KEY]!)
}

contentWindow[MESSAGE_HANDLER_KEY] = handleRuntimeMessage
chrome.runtime.onMessage.addListener(handleRuntimeMessage)

document.addEventListener(
  "click",
  (event) => {
    const target = event.target as HTMLElement | null
    const sendButton = target?.closest(
      '[data-testid="compose-btn-send"], button[aria-label="Send"], button[aria-label="Kirim"]'
    )

    if (sendButton) {
      triggerManualSendSync()
    }
  },
  true
)

document.addEventListener(
  "keydown",
  (event) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return
    }

    const composeBox = getComposeBox()

    if (!composeBox) {
      return
    }

    if (event.target !== composeBox && !composeBox.contains(event.target as Node)) {
      return
    }

    triggerManualSendSync()
  },
  true
)
