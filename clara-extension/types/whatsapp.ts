export type WhatsAppMessageDirection = "incoming" | "outgoing"

export interface WhatsAppMessage {
  id: string
  author: string
  direction: WhatsAppMessageDirection
  text: string
  timestampLabel: string
}

export interface WhatsAppChatSnapshot {
  capturedAt: string
  chatTitle: string
  chatSubtitle: string
  messages: WhatsAppMessage[]
}

export interface WhatsAppReadResponse {
  data?: WhatsAppChatSnapshot
  error?: string
  ok: boolean
}

export interface WhatsAppActionResponse {
  error?: string
  ok: boolean
}
