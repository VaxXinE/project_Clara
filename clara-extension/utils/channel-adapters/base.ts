import type { Channel } from "~/types/channel"
import type {
  WhatsAppActionResponse,
  WhatsAppReadResponse
} from "~/types/whatsapp"

export interface ChannelAdapter {
  capabilities?: {
    insertReply: boolean
    sendReply: boolean
  }
  channel: Channel
  focusCompose?(): WhatsAppActionResponse
  getComposeText?(): string
  getConversationTitle?(): string
  insertReply(text: string): WhatsAppActionResponse
  isSupportedPage(): boolean
  readOpenChat(): Promise<WhatsAppReadResponse> | WhatsAppReadResponse
  sendReply(
    text: string
  ): Promise<WhatsAppActionResponse> | WhatsAppActionResponse
}
