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

export interface WhatsAppSuggestionDetail {
  reasoning?: string
  text: string
  tone?: string
}

export interface WhatsAppSuggestionResult {
  actionMode?: string
  conversationId?: string
  customerSummary?: string
  nextBestAction?: string
  replySuggestionId?: string
  riskLevel?: string
  suggestionDetails?: WhatsAppSuggestionDetail[]
  suggestions: string[]
}

export interface ClaraExtensionSessionUser {
  email: string
  id: string
  name: string
  organizationName?: string | null
  role: string
}
