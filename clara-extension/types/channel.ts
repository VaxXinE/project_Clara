import type {
  WhatsAppActionResponse,
  WhatsAppChatSnapshot,
  WhatsAppMessage
} from "~/types/whatsapp"

export type Channel = "whatsapp" | "instagram" | "tiktok" | "tawk"

export type LegacyRuntimeMessageType =
  | "READ_WHATSAPP_CHAT"
  | "INSERT_WHATSAPP_REPLY"
  | "SEND_WHATSAPP_REPLY"

export interface LegacyRuntimeMessage {
  activeChatFingerprint?: string
  authorizationClaimReference?: string
  finalTextHash?: string
  latestMessageFingerprint?: string
  snapshotFingerprint?: string
  text?: string
  type?: LegacyRuntimeMessageType | string
  userTriggered?: boolean
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

export interface ExtensionBrowserSendResult extends ChannelActionResponse {
  activeChatFingerprint?: string
  adapterResultCode?: string
  browserEventId?: string
  channel?: Channel
  finalTextHash?: string
  latestMessageFingerprint?: string
  status?: "SENT" | "FAILED" | "UNKNOWN"
}
