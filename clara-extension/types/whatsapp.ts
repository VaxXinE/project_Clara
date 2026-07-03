export type WhatsAppMessageDirection = "incoming" | "outgoing"

export interface WhatsAppMessage {
  id: string
  author: string
  direction: WhatsAppMessageDirection
  text: string
  replyContextSenderName?: string
  replyContextSenderType?: "incoming" | "outgoing" | "unknown"
  replyContextText?: string
  timestampLabel: string
}

export interface WhatsAppChatSnapshot {
  capturedAt: string
  channel?: "whatsapp" | "instagram" | "tiktok"
  chatTitle: string
  chatSubtitle: string
  debugInfo?: {
    bounds?: string
    candidateCount?: number
    channel?: string
    composeBox?: string
    firstMessageText?: string
    lastMessageText?: string
    selectedTextbox?: string
    titleCandidateCount?: number
  }
  messages: WhatsAppMessage[]
  provider?: "extension" | "official_api" | "manual"
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
  cached?: boolean
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
