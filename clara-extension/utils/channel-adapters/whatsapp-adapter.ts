import {
  getWhatsAppComposeText,
  getWhatsAppConversationTitle,
  insertReplyIntoComposeBox,
  isWhatsAppSupportedPage,
  readOpenChat,
  sendReplyThroughComposeBox
} from "~/utils/whatsapp-page"

import type { ChannelAdapter } from "./base"

export const whatsappAdapter: ChannelAdapter = {
  channel: "whatsapp",
  getComposeText: () => getWhatsAppComposeText(),
  getConversationTitle: () => getWhatsAppConversationTitle(),
  insertReply: (text) => insertReplyIntoComposeBox(text),
  isSupportedPage: () => isWhatsAppSupportedPage(),
  readOpenChat: () => readOpenChat(),
  sendReply: (text) => sendReplyThroughComposeBox(text)
}
