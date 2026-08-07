const ID_COMPONENT_PATTERN = /^[A-Za-z0-9._-]{1,100}$/
const INBOX_CHAT_ROUTE_PATTERN =
  /^\/inbox\/([A-Za-z0-9._-]{1,100})\/(?:all\/)?(?:chats\/(?:chat\/)?|chat\/)([A-Za-z0-9._-]{1,100})\/?$/
const RESERVED_ID_COMPONENTS = new Set([
  "all",
  "analytics",
  "chat",
  "chats",
  "dashboard",
  "properties",
  "settings"
])

export interface TawkThreadIdentity {
  chatId: string
  propertyId: string
}

export const isValidTawkIdComponent = (value: string) =>
  ID_COMPONENT_PATTERN.test(value) &&
  !RESERVED_ID_COMPONENTS.has(value.toLowerCase())

export const parseTawkInboxRoute = (
  value: string | null
): TawkThreadIdentity | null => {
  const match = (value || "").trim().match(INBOX_CHAT_ROUTE_PATTERN)
  const propertyId = match?.[1] || ""
  const chatId = match?.[2] || ""

  return isValidTawkIdComponent(propertyId) && isValidTawkIdComponent(chatId)
    ? { chatId, propertyId }
    : null
}

export const isLikelyTawkConversationTitle = (value: string) => {
  const normalized = value.replace(/\s+/g, " ").trim()
  if (normalized.length < 2 || normalized.length > 100) {
    return false
  }

  return !(
    /^(?:today|yesterday|\d+\s+(?:minutes?|hours?|days?|weeks?|months?|years?)\s+ago)\b/i.test(
      normalized
    ) ||
    /^(?:about|details?|chat|inbox)$/i.test(normalized) ||
    /^(?:senin|selasa|rabu|kamis|jumat|sabtu|minggu),?\s/i.test(normalized)
  )
}
