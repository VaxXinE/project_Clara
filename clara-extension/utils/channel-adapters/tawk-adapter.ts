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

const MESSAGE_LIST_SELECTORS = [
  '[data-testid="message-list"]',
  '[data-testid="chat-message-list"]',
  "[data-message-list]",
  '[role="log"]'
]

const MESSAGE_SELECTORS = [
  "[data-message-id]",
  '[data-testid="message"]',
  '[data-testid="chat-message"]',
  "[data-chat-message]",
  '[role="listitem"][data-sender-type]'
]

const MESSAGE_BODY_SELECTORS = [
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
) => (value || "").replace(/\s+/g, " ").trim().slice(0, max)

const isValidIdComponent = (value: string) =>
  ID_COMPONENT_PATTERN.test(value) &&
  !RESERVED_ID_COMPONENTS.has(value.toLowerCase())

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
    /\/(?:inbox|chat|chats)\/([A-Za-z0-9._-]{1,100})\/([A-Za-z0-9._-]{1,100})(?:\/|$)/
  )
  return {
    chatId: match?.[2] || "",
    propertyId: match?.[1] || ""
  }
}

const getAttributeId = (
  root: ParentNode,
  selectors: string[],
  attributeNames: string[]
) => {
  for (const selector of selectors) {
    const element = root.querySelector<HTMLElement>(selector)
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

const resolvePropertyId = () => {
  const fromUrl = getUrlValue(["propertyId", "property", "pid"])
  if (fromUrl) {
    return fromUrl
  }

  const fromRoute = getInboxRouteIdentity().propertyId
  if (fromRoute) {
    return fromRoute
  }

  return getAttributeId(document, PROPERTY_ATTRIBUTE_SELECTORS, [
    "data-property-id",
    "data-tawk-property-id"
  ])
}

const resolveChatId = (pane: HTMLElement) => {
  for (const attributeName of CHAT_ATTRIBUTE_NAMES) {
    const value = (pane.getAttribute(attributeName) || "").trim()
    if (isValidIdComponent(value)) {
      return value
    }
  }

  const descendant = getAttributeId(
    pane,
    CHAT_ATTRIBUTE_NAMES.map((name) => `[${name}]`),
    CHAT_ATTRIBUTE_NAMES
  )
  if (descendant) {
    return descendant
  }

  return (
    getUrlValue(["chatId", "chat", "conversationId"]) ||
    getInboxRouteIdentity().chatId
  )
}

const findActivePane = () => firstVisibleMatch(document, ACTIVE_PANE_SELECTORS)

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
  const text = normalizeText(body?.textContent)
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
  const title = firstVisibleMatch(pane, [
    '[data-testid="chat-title"]',
    '[data-testid="conversation-title"]',
    "[data-chat-title]",
    'header [role="heading"]',
    "header h1",
    "header h2"
  ])
  return normalizeText(
    title?.getAttribute("data-chat-title") || title?.textContent,
    255
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

  const propertyId = resolvePropertyId()
  if (!propertyId) {
    return readError(
      "TAWK_PROPERTY_ID_NOT_FOUND",
      "Property ID Tawk.to belum berhasil dikenali."
    )
  }

  const chatId = resolveChatId(pane)
  if (!chatId) {
    return readError(
      "TAWK_CHAT_ID_NOT_FOUND",
      "Chat ID percakapan aktif Tawk.to belum berhasil dikenali."
    )
  }

  const chatTitle = getChatTitle(pane)
  if (!chatTitle) {
    return readError(
      "TAWK_ACTIVE_CHAT_NOT_FOUND",
      "Judul percakapan aktif Tawk.to belum berhasil dikenali."
    )
  }

  const externalThreadId = `tawk:${propertyId}:${chatId}`
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
    return Boolean(pane && resolvePropertyId() && resolveChatId(pane))
  },
  readOpenChat,
  sendReply: replyActionUnavailable
}
