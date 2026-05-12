import type { PlasmoCSConfig } from "plasmo"

import {
  insertReplyIntoComposeBox,
  readOpenChat
} from "~/utils/whatsapp-page"

export const config: PlasmoCSConfig = {
  matches: ["https://web.whatsapp.com/*"]
}

const MESSAGE_HANDLER_KEY = "__sgExtensionWhatsAppHandler__"

const handleRuntimeMessage = (
  message: { text?: string; type?: string },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => {
  if (message?.type === "READ_WHATSAPP_CHAT") {
    sendResponse(readOpenChat())
    return
  }

  if (message?.type === "INSERT_WHATSAPP_REPLY") {
    sendResponse(insertReplyIntoComposeBox(String(message?.text || "")))
  }
}

const contentWindow = window as typeof window & {
  [MESSAGE_HANDLER_KEY]?: typeof handleRuntimeMessage
}

if (contentWindow[MESSAGE_HANDLER_KEY]) {
  chrome.runtime.onMessage.removeListener(contentWindow[MESSAGE_HANDLER_KEY]!)
}

contentWindow[MESSAGE_HANDLER_KEY] = handleRuntimeMessage
chrome.runtime.onMessage.addListener(handleRuntimeMessage)
