export type Channel = "whatsapp" | "instagram" | "tiktok"

import type {
  WhatsAppActionResponse,
  WhatsAppChatSnapshot,
  WhatsAppMessage
} from "~/types/whatsapp"

export type LegacyRuntimeMessageType =
  | "READ_WHATSAPP_CHAT"
  | "INSERT_WHATSAPP_REPLY"
  | "SEND_WHATSAPP_REPLY"

export interface LegacyRuntimeMessage {
  text?: string
  type?: LegacyRuntimeMessageType | string
}

export type MessageDirection = "incoming" | "outgoing"

export interface ChannelMessage extends WhatsAppMessage {
  externalMessageId?: string
}

export interface ChannelChatSnapshot extends WhatsAppChatSnapshot {
  channel: Channel
  externalThreadId?: string
  messages: ChannelMessage[]
  provider: "extension" | "official_api" | "manual"
}

export interface ChannelActionResponse extends WhatsAppActionResponse {
  code?: string
}
