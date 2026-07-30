import type { ChannelChatSnapshot, ChannelMessage } from "~/types/channel"
import type {
  WhatsAppActionResponse,
  WhatsAppReadResponse
} from "~/types/whatsapp"

import type { ChannelAdapter } from "./base"

const TAWK_HOSTNAME = "dashboard.tawk.to"
const MAX_MESSAGES = 80
const MAX_SCROLL_SWEEPS = 6
const SCROLL_SETTLE_MS = 80
const MAX_TEXT_LENGTH = 5000
const ID_COMPONENT_PATTERN = /^[A-Za-z0-9._-]{1,100}$/
const INBOX_CHAT_ROUTE_PATTERN =
  /^\/inbox\/([A-Za-z0-9._-]{1,100})\/chats\/([A-Za-z0-9._-]{1,100})\/?$/
const RESERVED_ID_COMPONENTS = new Set([
  "all",
  "analytics",
  "dashboard",
  "properties",
  "settings"
])

const ACTIVE_PANE_SELECTORS = [
  '[data-testid="active-chat"]',
  '[data-testid="chat-view"]',
  '[data-testid="conversation-view"]',
  '[data-active-chat="true"]',
  '[role="main"] [data-chat-id]',
  '[role="main"] [data-conversation-id]'
]

const REAL_ACTIVE_CHATS_SELECTOR = "#active-chats"
const REAL_CHAT_HEADER_SELECTOR = ".tawk-chat-header"
const REAL_CHAT_BODY_SELECTOR = ".tawk-chat-body"
const REAL_MESSAGE_CONTAINER_SELECTOR = ".tawk-chat-message-container"
const EXCLUDED_NAVIGATION_SELECTOR =
  "#tawk-live-chats-navigation, #tawk-chat-navigation-list"
const SCOPED_ROUTE_SELECTOR = '[to^="/inbox/"][to*="/chats/"]'
const HEADER_CONTROL_SELECTOR =
  'button, [role="button"], [role="menu"], .tawk-dropdown, .tawk-dropdown-menu'

const MESSAGE_LIST_SELECTORS = [
  ".tawk-smooth-scroll",
  '[data-testid="message-list"]',
  '[data-testid="chat-message-list"]',
  "[data-message-list]",
  '[role="log"]'
]

const MESSAGE_SELECTORS = [
  '[id^="messageId-"].tawk-message-bubble',
  "[data-message-id]",
  '[data-testid="message"]',
  '[data-testid="chat-message"]',
  "[data-chat-message]",
  '[role="listitem"][data-sender-type]'
]

const MESSAGE_BODY_SELECTORS = [
  ".tawk-message",
  '[data-testid="message-text"]',
  '[data-testid="chat-message-text"]',
  "[data-message-text]",
  '[data-qa="message-text"]',
  "[data-message-body]",
  '[class~="message-body"]',
  '[class~="message-text"]',
  '[dir="auto"]'
]

const TIMESTAMP_SELECTORS = [
  ".tawk-time",
  '[data-testid="message-time"]',
  "[data-message-time]",
  "time"
]

const ATTACHMENT_SELECTORS = [
  "[data-attachment-name]",
  '[data-testid="attachment"]',
  '[data-testid="message-attachment"]',
  "a[download]"
]

const PROPERTY_ATTRIBUTE_SELECTORS = [
  "[data-property-id]",
  "[data-tawk-property-id]"
]

const CHAT_ATTRIBUTE_NAMES = [
  "data-chat-id",
  "data-conversation-id",
  "data-active-chat-id"
]

const normalizeText = (
  value: string | null | undefined,
  max = MAX_TEXT_LENGTH
) =>
  (value || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)

const isValidIdComponent = (value: string) =>
  ID_COMPONENT_PATTERN.test(value) &&
  !RESERVED_ID_COMPONENTS.has(value.toLowerCase())

interface TawkThreadIdentity {
  chatId: string
  propertyId: string
}

const isVisible = (element: Element) => {
  const bounds = element.getBoundingClientRect()
  return bounds.width > 0 && bounds.height > 0
}

const firstVisibleMatch = (
  root: ParentNode,
  selectors: string[]
): HTMLElement | null => {
  for (const selector of selectors) {
    const candidates = Array.from(root.querySelectorAll<HTMLElement>(selector))
    const visible = candidates.find(isVisible)
    if (visible) {
      return visible
    }
  }
  return null
}

const parseInboxChatRoute = (
  value: string | null
): TawkThreadIdentity | null => {
  const match = (value || "").trim().match(INBOX_CHAT_ROUTE_PATTERN)
  const propertyId = match?.[1] || ""
  const chatId = match?.[2] || ""

  if (!isValidIdComponent(propertyId) || !isValidIdComponent(chatId)) {
    return null
  }

  return { chatId, propertyId }
}

const getRouteElements = (root: ParentNode) => {
  const elements = Array.from(
    root.querySelectorAll<HTMLElement>(SCOPED_ROUTE_SELECTOR)
  )
  if (root instanceof HTMLElement && root.matches(SCOPED_ROUTE_SELECTOR)) {
    elements.unshift(root)
  }
  return Array.from(new Set(elements)).filter(isVisible)
}

const getSingleRouteIdentity = (
  elements: HTMLElement[]
): TawkThreadIdentity | null => {
  const identities = new Map<string, TawkThreadIdentity>()
  for (const element of elements) {
    const identity = parseInboxChatRoute(element.getAttribute("to"))
    if (identity) {
      identities.set(`${identity.propertyId}:${identity.chatId}`, identity)
    }
  }
  return identities.size === 1 ? Array.from(identities.values())[0] : null
}

const getScopedRouteIdentity = (pane: HTMLElement) =>
  getSingleRouteIdentity(getRouteElements(pane))

const getDocumentRouteIdentity = (
  pane: HTMLElement
): TawkThreadIdentity | null => {
  const matchingRoutes = getRouteElements(document).filter((element) =>
    parseInboxChatRoute(element.getAttribute("to"))
  )
  if (matchingRoutes.length !== 1) {
    return null
  }

  const routeElement = matchingRoutes[0]
  const header = pane.querySelector<HTMLElement>(REAL_CHAT_HEADER_SELECTOR)
  const isStructurallyLinked =
    pane.contains(routeElement) ||
    Boolean(header && routeElement.contains(header))

  return isStructurallyLinked
    ? parseInboxChatRoute(routeElement.getAttribute("to"))
    : null
}

const getUrlValue = (names: string[]) => {
  const url = new URL(window.location.href)
  const hashQuery = url.hash.includes("?")
    ? new URLSearchParams(url.hash.slice(url.hash.indexOf("?") + 1))
    : new URLSearchParams()

  for (const name of names) {
    const value = url.searchParams.get(name) || hashQuery.get(name)
    if (value && isValidIdComponent(value)) {
      return value
    }
  }
  return ""
}

const getInboxRouteIdentity = () => {
  const route = `${window.location.pathname}/${window.location.hash.split("?")[0]}`
  const match = route.match(
    /\/inbox\/([A-Za-z0-9._-]{1,100})\/chats\/([A-Za-z0-9._-]{1,100})(?:\/|$)/
  )
  return parseInboxChatRoute(
    match ? `/inbox/${match[1]}/chats/${match[2]}` : null
  )
}

const getAttributeId = (
  root: ParentNode,
  selectors: string[],
  attributeNames: string[]
) => {
  for (const selector of selectors) {
    const element =
      root instanceof HTMLElement && root.matches(selector)
        ? root
        : root.querySelector<HTMLElement>(selector)
    if (!element) {
      continue
    }
    for (const attributeName of attributeNames) {
      const value = (element.getAttribute(attributeName) || "").trim()
      if (isValidIdComponent(value)) {
        return value
      }
    }
  }
  return ""
}

const resolveScopedDataIdentity = (
  pane: HTMLElement
): TawkThreadIdentity | null => {
  const propertyId = getAttributeId(pane, PROPERTY_ATTRIBUTE_SELECTORS, [
    "data-property-id",
    "data-tawk-property-id"
  ])
  let chatId = ""
  for (const attributeName of CHAT_ATTRIBUTE_NAMES) {
    const value = (pane.getAttribute(attributeName) || "").trim()
    if (isValidIdComponent(value)) {
      chatId = value
      break
    }
  }

  if (!chatId) {
    chatId = getAttributeId(
      pane,
      CHAT_ATTRIBUTE_NAMES.map((name) => `[${name}]`),
      CHAT_ATTRIBUTE_NAMES
    )
  }

  return propertyId && chatId ? { chatId, propertyId } : null
}

const resolveUrlIdentity = (): TawkThreadIdentity | null => {
  const routeIdentity = getInboxRouteIdentity()
  if (routeIdentity) {
    return routeIdentity
  }

  const propertyId = getUrlValue(["propertyId", "property", "pid"])
  const chatId = getUrlValue(["chatId", "chat", "conversationId"])
  return propertyId && chatId ? { chatId, propertyId } : null
}

const resolveKnownPropertyId = (pane: HTMLElement) =>
  getScopedRouteIdentity(pane)?.propertyId ||
  getDocumentRouteIdentity(pane)?.propertyId ||
  getAttributeId(pane, PROPERTY_ATTRIBUTE_SELECTORS, [
    "data-property-id",
    "data-tawk-property-id"
  ]) ||
  getInboxRouteIdentity()?.propertyId ||
  getUrlValue(["propertyId", "property", "pid"])

const resolveThreadIdentity = (pane: HTMLElement): TawkThreadIdentity | null =>
  getScopedRouteIdentity(pane) ||
  getDocumentRouteIdentity(pane) ||
  resolveScopedDataIdentity(pane) ||
  resolveUrlIdentity()

const resolveRouteIdentity = (pane: HTMLElement) =>
  getScopedRouteIdentity(pane) || getDocumentRouteIdentity(pane)

const hasRealChatStructure = (element: HTMLElement) =>
  Boolean(
    element.querySelector(REAL_CHAT_HEADER_SELECTOR) &&
      element.querySelector(REAL_CHAT_BODY_SELECTOR) &&
      element.querySelector(REAL_MESSAGE_CONTAINER_SELECTOR)
  )

const getRealChatCard = (
  messageContainer: HTMLElement,
  activeChats: HTMLElement
) => {
  let candidate = messageContainer.parentElement
  while (candidate && candidate !== activeChats) {
    if (
      isVisible(candidate) &&
      !candidate.closest(EXCLUDED_NAVIGATION_SELECTOR) &&
      hasRealChatStructure(candidate)
    ) {
      return candidate
    }
    candidate = candidate.parentElement
  }
  return null
}

const isFocusedChatCard = (card: HTMLElement) =>
  card.matches(":focus-within") ||
  card.getAttribute("aria-selected") === "true" ||
  card.getAttribute("data-active") === "true" ||
  card.classList.contains("active") ||
  card.classList.contains("focused") ||
  card.classList.contains("is-active") ||
  card.classList.contains("is-focused") ||
  card.classList.contains("tawk-chat-active") ||
  card.classList.contains("tawk-chat-focused")

const findRealActivePane = (): HTMLElement | null => {
  const activeChats = document.querySelector<HTMLElement>(
    REAL_ACTIVE_CHATS_SELECTOR
  )
  if (!activeChats || !isVisible(activeChats)) {
    return null
  }

  const cards = Array.from(
    activeChats.querySelectorAll<HTMLElement>(REAL_MESSAGE_CONTAINER_SELECTOR)
  )
    .map((container) => getRealChatCard(container, activeChats))
    .filter((card): card is HTMLElement => Boolean(card))
  const uniqueCards = Array.from(new Set(cards))
  const focusedCards = uniqueCards.filter(isFocusedChatCard)
  const selectedCard =
    focusedCards.length === 1
      ? focusedCards[0]
      : focusedCards.length === 0 && uniqueCards.length === 1
        ? uniqueCards[0]
        : null

  return selectedCard && resolveRouteIdentity(selectedCard)
    ? selectedCard
    : null
}

const findSemanticActivePane = () => {
  for (const selector of ACTIVE_PANE_SELECTORS) {
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(selector)
    ).filter(
      (candidate) =>
        isVisible(candidate) && !candidate.closest(EXCLUDED_NAVIGATION_SELECTOR)
    )
    const validCandidates = candidates.filter(resolveThreadIdentity)
    if (validCandidates.length === 1) {
      return validCandidates[0]
    }
    if (validCandidates.length > 1) {
      return null
    }
  }
  return null
}

const findActivePane = () => findRealActivePane() || findSemanticActivePane()

const findMessageElements = (pane: HTMLElement) => {
  const unique = new Set<HTMLElement>()
  for (const selector of MESSAGE_SELECTORS) {
    pane.querySelectorAll<HTMLElement>(selector).forEach((element) => {
      if (isVisible(element)) {
        unique.add(element)
      }
    })
  }
  return Array.from(unique)
}

const getScrollContainer = (pane: HTMLElement) => {
  const candidate = firstVisibleMatch(pane, MESSAGE_LIST_SELECTORS)
  if (candidate && candidate.scrollHeight > candidate.clientHeight) {
    return candidate
  }
  return pane.scrollHeight > pane.clientHeight ? pane : null
}

const waitForScrollSettle = () =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, SCROLL_SETTLE_MS)
  })

const collectActiveMessageElements = async (pane: HTMLElement) => {
  const scrollContainer = getScrollContainer(pane)
  if (!scrollContainer) {
    return findMessageElements(pane).slice(-MAX_MESSAGES)
  }

  const originalScrollTop = scrollContainer.scrollTop
  let previousCount = -1
  let stableCount = 0

  try {
    for (let sweep = 0; sweep < MAX_SCROLL_SWEEPS; sweep += 1) {
      const count = findMessageElements(pane).length
      stableCount = count === previousCount ? stableCount + 1 : 0
      if (stableCount >= 1 || scrollContainer.scrollTop === 0) {
        break
      }
      previousCount = count
      scrollContainer.scrollTop = Math.max(
        0,
        scrollContainer.scrollTop - scrollContainer.clientHeight
      )
      await waitForScrollSettle()
    }
    return findMessageElements(pane).slice(-MAX_MESSAGES)
  } finally {
    scrollContainer.scrollTop = originalScrollTop
  }
}

const getMessageDirection = (element: HTMLElement) => {
  if (element.querySelector(".tawk-outgoing-chat")) {
    return "outgoing" as const
  }
  if (element.querySelector(".tawk-incoming-chat")) {
    return "incoming" as const
  }

  const marker = [
    element.getAttribute("data-direction"),
    element.getAttribute("data-sender-type"),
    element.getAttribute("data-message-type"),
    element.getAttribute("aria-label")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  if (
    /\b(outgoing|agent|self|operator|sent)\b/.test(marker) ||
    element.classList.contains("outgoing") ||
    element.classList.contains("message-out")
  ) {
    return "outgoing" as const
  }
  return "incoming" as const
}

const getMessageTimestamp = (element: HTMLElement) => {
  const timestamp = firstVisibleMatch(element, TIMESTAMP_SELECTORS)
  return normalizeText(
    timestamp?.textContent ||
      timestamp?.getAttribute("datetime") ||
      element.getAttribute("data-message-time"),
    255
  )
}

const getAttachmentText = (element: HTMLElement) => {
  const labels = new Set<string>()
  for (const selector of ATTACHMENT_SELECTORS) {
    element.querySelectorAll<HTMLElement>(selector).forEach((attachment) => {
      const label = normalizeText(
        attachment.getAttribute("data-attachment-name") ||
          attachment.getAttribute("download") ||
          attachment.getAttribute("aria-label") ||
          attachment.textContent,
        120
      )
      if (label) {
        labels.add(/(?:https?:\/\/|www\.)/i.test(label) ? "file" : label)
      }
    })
  }
  return labels.size
    ? `[Attachment] ${Array.from(labels).slice(0, 3).join(", ")}`
    : ""
}

const getMessageText = (element: HTMLElement) => {
  const body = firstVisibleMatch(element, MESSAGE_BODY_SELECTORS)
  const text = normalizeText(body?.innerText || body?.textContent)
  const attachment = getAttachmentText(element)
  return [text, attachment].filter(Boolean).join("\n").slice(0, MAX_TEXT_LENGTH)
}

const digest = async (value: string) => {
  const bytes = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

const getStableMessageId = async (
  element: HTMLElement,
  externalThreadId: string,
  direction: "incoming" | "outgoing",
  timestampLabel: string,
  text: string,
  duplicateNumber: number
) => {
  const domId =
    element.getAttribute("data-message-id") ||
    element.getAttribute("data-id") ||
    element.getAttribute("data-event-id") ||
    element.id
  const stableSource = domId
    ? `${externalThreadId}|dom|${domId}`
    : `${externalThreadId}|${direction}|${direction === "outgoing" ? "agent" : "visitor"}|${timestampLabel}|${text}`
  const hash = await digest(stableSource)

  // Identical messages without a DOM ID or timestamp cannot have perfect
  // cross-snapshot identity. The occurrence suffix preserves both in order.
  return `tawk:${hash}${!domId && !timestampLabel && duplicateNumber > 1 ? `:${duplicateNumber}` : ""}`
}

const readMessages = async (
  pane: HTMLElement,
  externalThreadId: string,
  chatTitle: string
) => {
  const elements = await collectActiveMessageElements(pane)
  const messages: ChannelMessage[] = []
  const fallbackOccurrences = new Map<string, number>()

  for (const element of elements) {
    const direction = getMessageDirection(element)
    const timestampLabel = getMessageTimestamp(element)
    const text = getMessageText(element)
    if (!text) {
      continue
    }

    const fallbackKey = `${direction}|${timestampLabel}|${text}`
    const duplicateNumber = (fallbackOccurrences.get(fallbackKey) || 0) + 1
    fallbackOccurrences.set(fallbackKey, duplicateNumber)

    messages.push({
      author: direction === "outgoing" ? "Anda" : chatTitle,
      direction,
      id: await getStableMessageId(
        element,
        externalThreadId,
        direction,
        timestampLabel,
        text,
        duplicateNumber
      ),
      text,
      timestampLabel
    })
  }
  return messages.slice(-MAX_MESSAGES)
}

const getChatTitle = (pane: HTMLElement) => {
  const header = pane.querySelector<HTMLElement>(REAL_CHAT_HEADER_SELECTOR)
  const title = firstVisibleMatch(pane, [
    '[data-testid="chat-title"]',
    '[data-testid="conversation-title"]',
    "[data-chat-title]",
    ".tawk-chat-header .tawk-chat-title",
    ".tawk-chat-header .tawk-chat-name",
    ".tawk-chat-header .tawk-text-truncate",
    'header [role="heading"]',
    "header h1",
    "header h2"
  ])
  const semanticTitle = normalizeText(
    title && !title.closest(HEADER_CONTROL_SELECTOR)
      ? title.getAttribute("data-chat-title") || title.textContent
      : "",
    255
  )
  if (semanticTitle) {
    return semanticTitle
  }
  if (!header) {
    return ""
  }

  const candidates: string[] = []
  const walker = document.createTreeWalker(header, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    const parent = node.parentElement
    const text = normalizeText(node.textContent, 255)
    if (
      parent &&
      text.length > 1 &&
      isVisible(parent) &&
      !parent.closest(HEADER_CONTROL_SELECTOR)
    ) {
      candidates.push(text)
    }
    node = walker.nextNode()
  }

  const joinedCandidates = normalizeText(candidates.join(" "), 255)
  return (
    candidates.find((candidate) => candidate.includes(" - ")) ||
    (joinedCandidates.includes(" - ") ? joinedCandidates : "") ||
    candidates.sort((left, right) => right.length - left.length)[0] ||
    ""
  )
}

const readError = (code: string, error: string): WhatsAppReadResponse => ({
  code,
  error,
  ok: false
})

const readOpenChat = async (): Promise<WhatsAppReadResponse> => {
  if (window.location.hostname !== TAWK_HOSTNAME) {
    return readError(
      "TAWK_ACTIVE_CHAT_NOT_FOUND",
      "Buka satu percakapan aktif di dashboard Tawk.to."
    )
  }

  const pane = findActivePane()
  if (!pane) {
    return readError(
      "TAWK_ACTIVE_CHAT_NOT_FOUND",
      "Pane percakapan aktif Tawk.to belum ditemukan."
    )
  }

  const identity = resolveThreadIdentity(pane)
  if (!identity) {
    const propertyId = resolveKnownPropertyId(pane)
    return readError(
      propertyId ? "TAWK_CHAT_ID_NOT_FOUND" : "TAWK_PROPERTY_ID_NOT_FOUND",
      propertyId
        ? "Chat ID percakapan aktif Tawk.to belum berhasil dikenali."
        : "Property ID Tawk.to belum berhasil dikenali."
    )
  }

  const chatTitle = getChatTitle(pane)
  if (!chatTitle) {
    return readError(
      "TAWK_ACTIVE_CHAT_NOT_FOUND",
      "Judul percakapan aktif Tawk.to belum berhasil dikenali."
    )
  }

  const externalThreadId = `tawk:${identity.propertyId}:${identity.chatId}`
  const messages = await readMessages(pane, externalThreadId, chatTitle)
  if (!messages.length) {
    return readError(
      "TAWK_MESSAGES_NOT_FOUND",
      "Pesan pada percakapan aktif Tawk.to belum berhasil dibaca."
    )
  }

  const bounds = pane.getBoundingClientRect()
  const snapshot: ChannelChatSnapshot = {
    capturedAt: new Date().toISOString(),
    channel: "tawk",
    chatSubtitle: "Tawk.to Live Chat",
    chatTitle,
    debugInfo: {
      bounds: `${Math.round(bounds.width)}x${Math.round(bounds.height)}`,
      candidateCount: messages.length,
      channel: "tawk"
    },
    externalThreadId,
    messages,
    provider: "extension"
  }

  return {
    data: snapshot,
    ok: true
  }
}

const replyActionUnavailable = (): WhatsAppActionResponse => ({
  code: "TAWK_REPLY_ACTION_NOT_AVAILABLE",
  error: "Aksi balasan Tawk.to akan tersedia pada TAWK-03.",
  ok: false
})

export const tawkAdapter: ChannelAdapter = {
  capabilities: {
    insertReply: false,
    sendReply: false
  },
  channel: "tawk",
  insertReply: replyActionUnavailable,
  isSupportedPage: () => {
    if (window.location.hostname !== TAWK_HOSTNAME) {
      return false
    }
    const pane = findActivePane()
    return Boolean(pane && resolveThreadIdentity(pane))
  },
  readOpenChat,
  sendReply: replyActionUnavailable
}
