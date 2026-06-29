import type {
  WhatsAppActionResponse,
  WhatsAppReadResponse
} from "~/types/whatsapp"

import type { Channel } from "~/types/channel"

export interface ChannelAdapter {
  channel: Channel
  focusCompose?(): WhatsAppActionResponse
  getComposeText?(): string
  getConversationTitle?(): string
  insertReply(text: string): WhatsAppActionResponse
  isSupportedPage(): boolean
  readOpenChat(): WhatsAppReadResponse
  sendReply(text: string): Promise<WhatsAppActionResponse> | WhatsAppActionResponse
}
