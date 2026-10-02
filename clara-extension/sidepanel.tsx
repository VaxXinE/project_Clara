import { useEffect, useMemo, useRef, useState } from "react"

import type {
  ClaraExtensionSessionUser,
  WhatsAppActionResponse,
  WhatsAppChatSnapshot,
  WhatsAppMessage,
  WhatsAppMessageDirection,
  WhatsAppReadResponse,
  WhatsAppSuggestionResult
} from "~/types/whatsapp"
import {
  getChatSnapshotProxyUrl,
  getClaraAuthHeaders,
  getClaraDashboardLoginUrl,
  getClaraDeliveryAuthorizationUrl,
  getClaraDeliveryClaimUrl,
  getClaraDeliveryResultUrl,
  getClaraReplySuggestionsUrl,
  getClaraSendReplyUrl,
  getClaraSessionOrigins,
  getConfiguredClaraApiBaseUrl,
  getConfiguredClaraAuthCookieName,
  getConfiguredProxyUrl,
  getCurrentClaraSessionUser,
  getProxyCandidates,
  getSnapshotSyncCandidates,
  isDevFallbackAllowed
} from "~/utils/proxy"
import {
  buildDeliveryIdentity,
  canStartGovernedSend,
  sha256Hex
} from "~/utils/delivery-governance"
import { readWhatsAppFromPage } from "~/utils/whatsapp-page"
import { toUserMessage } from "~/utils/user-messages"
import { panelCss } from "~/utils/sidepanel-styles"


const OPENAI_PROXY_URL = getConfiguredProxyUrl()
const CHAT_SNAPSHOT_PROXY_URL = getChatSnapshotProxyUrl(OPENAI_PROXY_URL)
const INSERT_LOCK_KEY = "__sgExtensionSidePanelInsertLock__"
const AUTO_REFRESH_INTERVAL_MS = 2500
const LOGIN_MESSAGE =
  "Login dulu di dashboard Clara supaya extension terhubung ke akun yang sama."
const AUTH_REFRESH_INTERVAL_MS = 2000
const EXTENSION_BUILD_LABEL = "v0.1.11-production-api"
const OWNERSHIP_CONFLICT_CODE = "CONVERSATION_OWNED_BY_OTHER_SALES"
const CHATGPT_EMBED_URL =
  "https://chatgpt.com/g/g-69cde65d2fa081919907393fcd892e6e-solid-prime-sales"
const CHATGPT_CONTEXT_MESSAGE_LIMIT = 12
const CHATGPT_CONTEXT_TEXT_LIMIT = 280
const CHATGPT_CONTEXT_REGION_ID = "clara-chatgpt-context-details"
const CHATGPT_CONTEXT_PROMPT_ID = "clara-chatgpt-context-prompt"
const DRAFT_REPLY_TEXTAREA_ID = "clara-draft-reply"

// Tab ChatGPT menyalin isi chat customer ke layanan di luar Clara, jadi default-nya mati.
// Nyalakan dengan PLASMO_PUBLIC_CLARA_ENABLE_CHATGPT_WORKSPACE=true di .env extension.
const ENABLE_CHATGPT_WORKSPACE =
  (process.env.PLASMO_PUBLIC_CLARA_ENABLE_CHATGPT_WORKSPACE || "")
    .trim()
    .toLowerCase() === "true"

class ConversationOwnershipError extends Error {}

const getBackendErrorMessage = (payload: any) =>
  (typeof payload?.error === "string" && payload.error.trim()) ||
  (typeof payload?.detail === "string" && payload.detail.trim()) ||
  (typeof payload?.detail?.message === "string" &&
    payload.detail.message.trim()) ||
  ""


const panelStyle = {
  background:
    "radial-gradient(circle at 10% 10%, rgba(240,203,115,0.18), rgba(240,203,115,0) 24%), radial-gradient(circle at 88% 14%, rgba(194,144,50,0.16), rgba(194,144,50,0) 26%), radial-gradient(circle at 18% 78%, rgba(240,203,115,0.1), rgba(240,203,115,0) 24%), linear-gradient(160deg, #120d08 0%, #0b0805 38%, #070503 100%)",
  color: "#f7e7b7",
  fontFamily:
    "'Aptos', 'Segoe UI Variable Display', 'Trebuchet MS', 'Segoe UI', sans-serif",
  minHeight: "100vh",
  overflowX: "hidden",
  padding: 16,
  width: "100%"
} as const

const primaryButtonStyle = {
  background:
    "linear-gradient(135deg, rgba(246,217,140,0.98) 0%, rgba(194,144,50,0.96) 100%)",
  border: "1px solid rgba(255, 240, 201, 0.18)",
  borderRadius: 18,
  boxShadow:
    "0 18px 36px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255,248,224,0.22)",
  color: "#140f08",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 800,
  letterSpacing: "0.01em",
  minHeight: 48,
  padding: "14px 16px",
  width: "100%"
} as const

const secondaryButtonStyle = {
  background:
    "linear-gradient(180deg, rgba(33,24,16,0.9), rgba(19,13,10,0.82))",
  border: "1px solid rgba(240, 203, 115, 0.16)",
  borderRadius: 18,
  boxShadow:
    "0 12px 28px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255,240,201,0.06)",
  color: "#f0cb73",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 700,
  minHeight: 48,
  padding: "14px 16px",
  width: "100%"
} as const

const actionButtonStyle = {
  background: "rgba(255,240,201,0.06)",
  border: "1px solid rgba(240,203,115,0.16)",
  borderRadius: 14,
  color: "#f0cb73",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
  minHeight: 40,
  padding: "10px 12px"
} as const

const softCardStyle = {
  background:
    "linear-gradient(180deg, rgba(31,22,15,0.88), rgba(18,13,10,0.7))",
  backdropFilter: "blur(18px) saturate(155%)",
  border: "1px solid rgba(240, 203, 115, 0.14)",
  borderRadius: 24,
  boxShadow:
    "0 18px 40px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255,240,201,0.06)",
  padding: 16
} as const

const chipStyle = {
  alignItems: "center",
  background: "rgba(255,240,201,0.08)",
  border: "1px solid rgba(240,203,115,0.16)",
  borderRadius: 999,
  color: "#f3d694",
  display: "inline-flex",
  fontSize: 11,
  fontWeight: 700,
  justifyContent: "center",
  letterSpacing: "0.04em",
  padding: "7px 11px",
  textAlign: "center",
  textTransform: "uppercase"
} as const

const insertReplyIntoPage = (text: string): WhatsAppActionResponse => {
  const getChatRoot = () => {
    const selectors = [
      '#main[data-testid="conversation-panel-wrapper"]',
      "#main",
      '[data-testid="conversation-panel-wrapper"]'
    ]

    for (const selector of selectors) {
      const node = document.querySelector<HTMLElement>(selector)

      if (node) {
        return node
      }
    }

    return null
  }

  const getConversationTitle = (chatRoot: HTMLElement) => {
    const titleSelectors = [
      '[data-testid="conversation-info-header-chat-title"]',
      "header [title]",
      'header [dir="auto"]'
    ]

    for (const selector of titleSelectors) {
      const node = chatRoot.querySelector<HTMLElement>(selector)
      const title =
        node?.getAttribute("title")?.trim() || node?.textContent?.trim()

      if (title) {
        return title
      }
    }

    return ""
  }

  const getComposeBox = () => {
    const selectors = [
      '[data-testid="conversation-compose-box-input"][contenteditable="true"]',
      '[contenteditable="true"][data-lexical-editor="true"]',
      'footer [contenteditable="true"][role="textbox"]'
    ]

    for (const selector of selectors) {
      const node = document.querySelector<HTMLElement>(selector)

      if (node) {
        return node
      }
    }

    return null
  }

  const getComposeText = (composeBox: HTMLElement) =>
    composeBox.innerText.replace(/\s+/g, " ").trim()

  const getComposeFooter = () => getComposeBox()?.closest("footer") || document

  const clickElement = (node: HTMLElement) => {
    node.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        view: window
      })
    )
    node.dispatchEvent(
      new MouseEvent("mouseup", {
        bubbles: true,
        cancelable: true,
        view: window
      })
    )
    node.click()
  }

  const getSendButtonTarget = (): HTMLElement | null => {
    const searchRoot = getComposeFooter()
    const selectors = [
      '[data-testid="compose-btn-send"]',
      'button[aria-label="Send"]',
      'button[aria-label="Kirim"]',
      '[aria-label="Send"]',
      '[aria-label="Kirim"]',
      '[data-icon="send"]'
    ]

    for (const selector of selectors) {
      const node = searchRoot.querySelector<HTMLElement>(selector)

      if (!node) {
        continue
      }

      const clickableTarget =
        node.tagName === "BUTTON"
          ? node
          : node.closest<HTMLElement>('button, [role="button"], [tabindex]')

      const target = clickableTarget || node

      if (
        target instanceof HTMLButtonElement &&
        (target.disabled || target.hasAttribute("disabled"))
      ) {
        continue
      }

      return target
    }

    return null
  }

  const chatRoot = getChatRoot()

  if (!chatRoot || !getConversationTitle(chatRoot)) {
    return {
      error:
        "Buka percakapan WhatsApp yang aktif dulu sebelum memasukkan balasan.",
      ok: false
    }
  }

  const composeBox = getComposeBox()

  if (!composeBox) {
    return {
      error: "Kolom ketik WhatsApp belum ditemukan.",
      ok: false
    }
  }

  const normalizedText = text.trim()

  if (!normalizedText) {
    return {
      error: "Teks balasan kosong.",
      ok: false
    }
  }

  const activeLock = (
    window as typeof window & {
      [INSERT_LOCK_KEY]?: { text: string; timestamp: number }
    }
  )[INSERT_LOCK_KEY]

  if (
    activeLock &&
    activeLock.text === normalizedText &&
    Date.now() - activeLock.timestamp < 1200
  ) {
    return {
      ok: true
    }
  }

  if (getComposeText(composeBox) === normalizedText) {
    return {
      ok: true
    }
  }

  ;(
    window as typeof window & {
      [INSERT_LOCK_KEY]?: { text: string; timestamp: number }
    }
  )[INSERT_LOCK_KEY] = {
    text: normalizedText,
    timestamp: Date.now()
  }

  composeBox.focus()

  const selection = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(composeBox)
  selection?.removeAllRanges()
  selection?.addRange(range)

  let insertedWithNativeCommand = false

  try {
    insertedWithNativeCommand = document.execCommand(
      "insertText",
      false,
      normalizedText
    )
  } catch (_error) {
    // Ignore and fall back to manual insertion below.
  }

  if (
    insertedWithNativeCommand &&
    getComposeText(composeBox) === normalizedText
  ) {
    const afterRange = document.createRange()
    afterRange.selectNodeContents(composeBox)
    afterRange.collapse(false)
    selection?.removeAllRanges()
    selection?.addRange(afterRange)
    composeBox.focus()

    return {
      ok: true
    }
  }

  if (getComposeText(composeBox) !== normalizedText) {
    const paragraph = document.createElement("p")
    paragraph.setAttribute("dir", "auto")
    paragraph.appendChild(document.createTextNode(normalizedText))
    composeBox.replaceChildren(paragraph)
  }

  composeBox.dispatchEvent(new Event("input", { bubbles: true }))
  composeBox.dispatchEvent(new Event("change", { bubbles: true }))

  const afterRange = document.createRange()
  afterRange.selectNodeContents(composeBox)
  afterRange.collapse(false)
  selection?.removeAllRanges()
  selection?.addRange(afterRange)
  composeBox.focus()

  return {
    ok: true
  }
}

const sendReplyFromPanel = async (
  text: string
): Promise<WhatsAppActionResponse> => {
  const wait = (ms: number) =>
    new Promise((resolve) => {
      window.setTimeout(resolve, ms)
    })

  const normalizeMessageText = (value: string) =>
    value.replace(/\s+/g, " ").trim().toLowerCase()

  const getMessageDirection = (container: HTMLElement) =>
    container.classList.contains("message-out") ||
    Boolean(container.closest(".message-out"))
      ? "outgoing"
      : "incoming"

  const getMessageText = (container: HTMLElement) =>
    container
      .querySelector<HTMLElement>(
        '[data-testid="msg-text"], [data-testid="selectable-text"], .copyable-text'
      )
      ?.innerText.replace(/\s+/g, " ")
      .trim() || ""

  const getSendButtonTarget = () =>
    document.querySelector<HTMLElement>(
      '[data-testid="compose-btn-send"], button[aria-label="Send"], button[aria-label="Kirim"]'
    )

  const clickElement = (node: HTMLElement) => node.click()

  const getMessageContainers = () =>
    Array.from(
      new Set(
        Array.from(
          (
            document.querySelector<HTMLElement>(
              '[data-testid="conversation-panel-messages"]'
            ) || document
          ).querySelectorAll<HTMLElement>('[data-testid="msg-container"]')
        )
      )
    )

  const getLatestOutgoingMessageSnapshot = () => {
    const outgoingMessages = getMessageContainers()
      .map((container, index) => ({
        direction: getMessageDirection(container),
        index,
        text: getMessageText(container)
      }))
      .filter(
        (message) => message.direction === "outgoing" && message.text.trim()
      )

    const latestOutgoingMessage = outgoingMessages[outgoingMessages.length - 1]

    return {
      count: outgoingMessages.length,
      text: latestOutgoingMessage?.text.trim() || ""
    }
  }

  const waitForOutgoingMessageConfirmation = async (expectedText: string) => {
    const normalizedExpected = normalizeMessageText(expectedText)
    const beforeSendSnapshot = getLatestOutgoingMessageSnapshot()

    for (let attempt = 0; attempt < 12; attempt += 1) {
      await wait(250)

      const composeBox = document.querySelector<HTMLElement>(
        '[data-testid="conversation-compose-box-input"][contenteditable="true"], [contenteditable="true"][data-lexical-editor="true"], footer [contenteditable="true"][role="textbox"]'
      )
      const composeText =
        composeBox?.innerText.replace(/\s+/g, " ").trim() || ""
      const afterSendSnapshot = getLatestOutgoingMessageSnapshot()
      const normalizedLatestOutgoing = normalizeMessageText(
        afterSendSnapshot.text
      )

      const outgoingMessageAppended =
        afterSendSnapshot.count > beforeSendSnapshot.count &&
        normalizedLatestOutgoing === normalizedExpected

      const latestOutgoingReplaced =
        afterSendSnapshot.count === beforeSendSnapshot.count &&
        afterSendSnapshot.text !== beforeSendSnapshot.text &&
        normalizedLatestOutgoing === normalizedExpected

      if (outgoingMessageAppended || latestOutgoingReplaced) {
        return true
      }

      if (
        !composeText.trim() &&
        normalizedLatestOutgoing === normalizedExpected
      ) {
        return true
      }
    }

    return false
  }

  const insertResult = insertReplyIntoPage(text)

  if (!insertResult.ok) {
    return insertResult
  }

  const sendButtonTarget = getSendButtonTarget()

  if (sendButtonTarget) {
    clickElement(sendButtonTarget)

    const isConfirmed = await waitForOutgoingMessageConfirmation(text)

    if (!isConfirmed) {
      return {
        error:
          "Tombol kirim sudah ditekan, tapi WhatsApp belum menampilkan pesan baru. Pesan belum dianggap terkirim.",
        ok: false
      }
    }

    return {
      ok: true
    }
  }

  const composeBox = document.querySelector<HTMLElement>(
    '[data-testid="conversation-compose-box-input"][contenteditable="true"], [contenteditable="true"][data-lexical-editor="true"], footer [contenteditable="true"][role="textbox"]'
  )

  if (!composeBox) {
    return {
      error: "Kolom ketik WhatsApp belum ditemukan.",
      ok: false
    }
  }

  composeBox.focus()
  composeBox.dispatchEvent(
    new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Enter",
      code: "Enter"
    })
  )
  composeBox.dispatchEvent(
    new KeyboardEvent("keyup", {
      bubbles: true,
      cancelable: true,
      key: "Enter",
      code: "Enter"
    })
  )

  const isConfirmed = await waitForOutgoingMessageConfirmation(text)

  if (!isConfirmed) {
    return {
      error:
        "Enter sudah dipicu, tapi WhatsApp belum menampilkan pesan baru. Pesan belum dianggap terkirim.",
      ok: false
    }
  }

  return {
    ok: true
  }
}

const normalizeSuggestionPayload = (payload: any): WhatsAppSuggestionResult => {
  const suggestions = Array.isArray(payload?.suggestions)
    ? payload.suggestions.filter(
        (item: unknown): item is string =>
          typeof item === "string" && item.trim().length > 0
      )
    : []

  return {
    actionMode:
      typeof payload?.actionMode === "string"
        ? payload.actionMode
        : typeof payload?.action_mode === "string"
          ? payload.action_mode
          : undefined,
    cached: typeof payload?.cached === "boolean" ? payload.cached : undefined,
    conversationId:
      typeof payload?.conversationId === "string"
        ? payload.conversationId
        : typeof payload?.conversation_id === "string"
          ? payload.conversation_id
          : undefined,
    customerSummary:
      typeof payload?.customerSummary === "string"
        ? payload.customerSummary
        : typeof payload?.customer_summary === "string"
          ? payload.customer_summary
          : undefined,
    nextBestAction:
      typeof payload?.nextBestAction === "string"
        ? payload.nextBestAction
        : typeof payload?.next_best_action === "string"
          ? payload.next_best_action
          : undefined,
    replySuggestionId:
      typeof payload?.replySuggestionId === "string"
        ? payload.replySuggestionId
        : typeof payload?.reply_suggestion_id === "string"
          ? payload.reply_suggestion_id
          : undefined,
    activeChatFingerprint:
      typeof payload?.active_chat_fingerprint === "string"
        ? payload.active_chat_fingerprint
        : undefined,
    latestMessageFingerprint:
      typeof payload?.latest_message_fingerprint === "string"
        ? payload.latest_message_fingerprint
        : undefined,
    riskLevel:
      typeof payload?.riskLevel === "string"
        ? payload.riskLevel
        : typeof payload?.risk_level === "string"
          ? payload.risk_level
          : undefined,
    snapshotFingerprint:
      typeof payload?.snapshot_fingerprint === "string"
        ? payload.snapshot_fingerprint
        : undefined,
    suggestionVersion:
      typeof payload?.suggestion_version === "number"
        ? payload.suggestion_version
        : 1,
    suggestions: suggestions.slice(0, 1)
  }
}

const getActiveTab = async () => {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  })

  return tab
}

const isWhatsAppTabUrl = (url: string | undefined) =>
  Boolean(url?.startsWith("https://web.whatsapp.com/"))

const isInstagramDmTabUrl = (url: string | undefined) =>
  Boolean(url?.startsWith("https://www.instagram.com/direct/"))

const isTikTokMessagesTabUrl = (url: string | undefined) =>
  Boolean(
    url?.startsWith("https://www.tiktok.com/messages") ||
      url?.startsWith("https://www.tiktok.com/business-suite/messages")
  )

const isSupportedLiveSyncTabUrl = (url: string | undefined) =>
  isWhatsAppTabUrl(url) ||
  isInstagramDmTabUrl(url) ||
  isTikTokMessagesTabUrl(url)

const getSupportedLiveSyncTabMessage = () =>
  "Buka WhatsApp Web, Instagram DM, atau TikTok Messages dulu di tab aktif."

const getContentScriptUnavailableMessage = (url: string | undefined) =>
  isInstagramDmTabUrl(url)
    ? "Content script Clara belum aktif di halaman Instagram ini. Refresh halaman Instagram DM lalu coba lagi."
    : isTikTokMessagesTabUrl(url)
      ? "Content script Clara belum aktif di halaman TikTok Messages ini. Refresh halaman lalu coba lagi."
      : "Content script Clara belum aktif di halaman ini. Refresh tab lalu coba lagi."

const getChannelLabel = (channel?: string | null) =>
  channel === "instagram"
    ? "Instagram DM"
    : channel === "tiktok"
      ? "TikTok DM"
      : "WhatsApp Web"

const getPromptSafeText = (
  value: string,
  maxLength = CHATGPT_CONTEXT_TEXT_LIMIT
) => {
  const normalized = value.replace(/\s+/g, " ").trim()

  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

const getContextSpeakerLabel = (direction: WhatsAppMessageDirection) =>
  direction === "outgoing" ? "Sales" : "Customer"

const buildChatGptContextPrompt = (chatData: WhatsAppChatSnapshot | null) => {
  if (!chatData?.messages.length) {
    return ""
  }

  const lastIncomingMessage = [...chatData.messages]
    .reverse()
    .find((message) => message.direction === "incoming")

  const transcriptLines = chatData.messages
    .slice(-CHATGPT_CONTEXT_MESSAGE_LIMIT)
    .map((message) => {
      const replyContext = message.replyContextText
        ? ` | reply-context: ${getPromptSafeText(message.replyContextText, 120)}`
        : ""

      return `- ${getContextSpeakerLabel(message.direction)}${
        message.timestampLabel ? ` [${message.timestampLabel}]` : ""
      }: ${getPromptSafeText(message.text)}${replyContext}`
    })

  return [
    "Kamu adalah sales assistant yang membantu membalas chat customer berdasarkan konteks tab aktif.",
    "Gunakan konteks di bawah ini sebagai sumber utama jawaban.",
    "",
    `Channel: ${getChannelLabel(chatData.channel)}`,
    `Nama percakapan: ${chatData.chatTitle || "-"}`,
    `Subtitle: ${chatData.chatSubtitle || "-"}`,
    `Pesan customer terbaru: ${lastIncomingMessage ? getPromptSafeText(lastIncomingMessage.text) : "-"}`,
    "",
    "Transkrip terbaru:",
    ...transcriptLines,
    "",
    "Tugas:",
    "1. Pahami intent customer dari percakapan terbaru.",
    "2. Tulis jawaban singkat, natural, sopan, dan siap kirim dalam Bahasa Indonesia.",
    "3. Jangan mengarang fakta di luar konteks chat. Kalau data kurang, minta klarifikasi singkat.",
    "4. Fokus pada membantu sales menjawab chat customer, bukan menjelaskan proses internal."
  ].join("\n")
}

const syncChatSnapshotToProxy = async (chatData: WhatsAppChatSnapshot) => {
  let lastFetchError = ""
  const snapshotCandidates = getSnapshotSyncCandidates(chatData.channel)

  if (snapshotCandidates.length === 0) {
    throw new Error(toUserMessage("PLASMO_PUBLIC_CLARA_API_BASE_URL belum diisi", "snapshot"))
  }

  for (const proxyUrl of snapshotCandidates) {
    try {
      const response = await fetch(proxyUrl, {
        body: JSON.stringify({
          chatData
        }),
        headers: {
          "Content-Type": "application/json",
          ...(await getClaraAuthHeaders())
        },
        method: "POST"
      })

      const payload = await response.json()

      const backendErrorMessage = getBackendErrorMessage(payload)

      if (!response.ok) {
        if (payload?.detail?.code === OWNERSHIP_CONFLICT_CODE) {
          throw new ConversationOwnershipError(backendErrorMessage)
        }
        throw new Error(
          backendErrorMessage ||
            `API snapshot chat gagal memproses data scraping di ${proxyUrl}.`
        )
      }

      return {
        duplicate: Boolean(payload?.duplicate),
        snapshotId:
          typeof payload?.conversation_id === "string"
            ? payload.conversation_id
            : typeof payload?.snapshot?.id === "string"
              ? payload.snapshot.id
              : ""
      }
    } catch (error) {
      if (error instanceof ConversationOwnershipError) {
        throw error
      }
      lastFetchError =
        error instanceof Error ? error.message : "Failed to fetch"
    }
  }

  console.warn("[Clara] sinkron snapshot gagal:", lastFetchError)
  throw new Error(toUserMessage(lastFetchError || "Failed to fetch", "snapshot"))
}

const clearChatSnapshotInProxy = async () => {
  let lastFetchError = ""
  const snapshotCandidates = getSnapshotSyncCandidates()

  if (snapshotCandidates.length === 0) {
    return
  }

  for (const proxyUrl of snapshotCandidates) {
    try {
      const response = await fetch(proxyUrl, {
        body: JSON.stringify({
          chatData: null
        }),
        headers: {
          "Content-Type": "application/json",
          ...(await getClaraAuthHeaders())
        },
        method: "POST"
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            `API snapshot chat gagal mengosongkan data di ${proxyUrl}.`
        )
      }

      return
    } catch (error) {
      lastFetchError =
        error instanceof Error ? error.message : "Failed to fetch"
    }
  }

  console.warn("[Clara] sinkron snapshot gagal:", lastFetchError)
  throw new Error(toUserMessage(lastFetchError || "Failed to fetch", "snapshot"))
}

const fetchSuggestionsFromClaraBackendOnly = async (
  chatData: WhatsAppChatSnapshot
) => {
  const claraReplySuggestionsUrl = getClaraReplySuggestionsUrl(chatData.channel)

  if (!claraReplySuggestionsUrl) {
    if (!isDevFallbackAllowed()) {
      throw new Error(
        toUserMessage("Endpoint reply suggestion belum dikonfigurasi", "suggest")
      )
    }
    return null
  }

  let lastFetchError = ""

  for (const proxyUrl of getProxyCandidates(claraReplySuggestionsUrl)) {
    try {
      const response = await fetch(proxyUrl, {
        body: JSON.stringify({
          chatData
        }),
        headers: {
          "Content-Type": "application/json",
          ...(await getClaraAuthHeaders())
        },
        method: "POST"
      })

      const payload = await response.json()

      if (!response.ok) {
        const backendErrorMessage = getBackendErrorMessage(payload)
        if (payload?.detail?.code === OWNERSHIP_CONFLICT_CODE) {
          throw new ConversationOwnershipError(backendErrorMessage)
        }
        throw new Error(
          backendErrorMessage ||
            `Backend Clara gagal memproses saran jawaban di ${proxyUrl}.`
        )
      }

      const normalized = normalizeSuggestionPayload(payload)

      if (normalized.suggestions.length === 0) {
        throw new Error("Backend Clara tidak mengembalikan saran jawaban.")
      }

      return normalized
    } catch (error) {
      if (error instanceof ConversationOwnershipError) {
        throw error
      }
      lastFetchError =
        error instanceof Error ? error.message : "Failed to fetch"
    }
  }

  console.warn("[Clara] ambil jawaban gagal:", lastFetchError)
  throw new Error(toUserMessage(lastFetchError || "Failed to fetch", "suggest"))
}

const shouldClearSnapshotForError = (message: string) =>
  [
    "Belum ada percakapan yang sedang dibuka.",
    "Buka WhatsApp Web dulu di tab aktif.",
    "Panel chat WhatsApp Web belum ditemukan.",
    "Buka satu percakapan TikTok DM sampai kolom Send a message muncul dulu.",
    "Judul percakapan TikTok DM aktif belum berhasil dikenali."
  ].some((pattern) => message.includes(pattern))

const normalizeMessageFingerprintText = (value: string) =>
  value.replace(/\s+/g, " ").trim()

const getMessageFingerprint = (message: WhatsAppMessage) =>
  `${message.direction}::${normalizeMessageFingerprintText(message.text)}`

const getSnapshotLastFingerprint = (snapshot: WhatsAppChatSnapshot | null) => {
  const lastMessage = snapshot?.messages[snapshot.messages.length - 1]
  return lastMessage ? getMessageFingerprint(lastMessage) : ""
}

const isIncomingSnapshotLikelyStale = (
  current: WhatsAppChatSnapshot,
  incoming: WhatsAppChatSnapshot
) => {
  if (incoming.messages.length >= current.messages.length) {
    return false
  }

  const incomingFingerprints = new Set(
    incoming.messages.map(getMessageFingerprint)
  )
  const currentLastFingerprint = getSnapshotLastFingerprint(current)

  if (
    currentLastFingerprint &&
    !incomingFingerprints.has(currentLastFingerprint)
  ) {
    return true
  }

  const incomingFirstFingerprint = incoming.messages[0]
    ? getMessageFingerprint(incoming.messages[0])
    : ""

  const currentFirstFingerprint = current.messages[0]
    ? getMessageFingerprint(current.messages[0])
    : ""

  if (incomingFirstFingerprint && currentFirstFingerprint) {
    const startsLaterThanCurrent =
      current.messages.findIndex(
        (message) => getMessageFingerprint(message) === incomingFirstFingerprint
      ) > 0

    if (startsLaterThanCurrent) {
      return true
    }
  }

  return false
}

const findBestMessageOverlap = (
  existing: WhatsAppMessage[],
  incoming: WhatsAppMessage[]
) => {
  const existingKeys = existing.map(getMessageFingerprint)
  const incomingKeys = incoming.map(getMessageFingerprint)
  let best: {
    existingStart: number
    incomingStart: number
    length: number
  } | null = null

  for (
    let existingStart = 0;
    existingStart < existingKeys.length;
    existingStart += 1
  ) {
    for (
      let incomingStart = 0;
      incomingStart < incomingKeys.length;
      incomingStart += 1
    ) {
      let length = 0

      while (
        existingStart + length < existingKeys.length &&
        incomingStart + length < incomingKeys.length &&
        existingKeys[existingStart + length] ===
          incomingKeys[incomingStart + length]
      ) {
        length += 1
      }

      if (!length) {
        continue
      }

      if (!best || length > best.length) {
        best = {
          existingStart,
          incomingStart,
          length
        }
      }
    }
  }

  return best
}

const dedupeMessagesByFingerprint = (messages: WhatsAppMessage[]) => {
  const seen = new Set<string>()

  return messages.filter((message) => {
    const fingerprint = getMessageFingerprint(message)

    if (seen.has(fingerprint)) {
      return false
    }

    seen.add(fingerprint)
    return true
  })
}

const buildSnapshotSignature = (snapshot: WhatsAppChatSnapshot | null) =>
  JSON.stringify({
    channel: snapshot?.channel || "",
    provider: snapshot?.provider || "",
    externalThreadId: snapshot?.externalThreadId || "",
    chatTitle: snapshot?.chatTitle || "",
    chatSubtitle: snapshot?.chatSubtitle || "",
    lastMessageId: snapshot?.messages[snapshot.messages.length - 1]?.id || "",
    lastMessageText:
      snapshot?.messages[snapshot.messages.length - 1]?.text || "",
    messageCount: snapshot?.messages.length || 0
  })

const chooseMoreCompleteSnapshot = (
  current: WhatsAppChatSnapshot,
  incoming: WhatsAppChatSnapshot
) => {
  if (incoming.messages.length > current.messages.length) {
    return incoming
  }

  if (incoming.messages.length < current.messages.length) {
    return current
  }

  const currentLastText =
    current.messages[current.messages.length - 1]?.text.trim() || ""
  const incomingLastText =
    incoming.messages[incoming.messages.length - 1]?.text.trim() || ""

  if (incomingLastText.length > currentLastText.length) {
    return incoming
  }

  if (incomingLastText.length < currentLastText.length) {
    return current
  }

  return incoming
}

const mergeChatSnapshots = (
  current: WhatsAppChatSnapshot | null,
  incoming: WhatsAppChatSnapshot
) => {
  if (!current) {
    return incoming
  }

  if (
    current.channel !== incoming.channel ||
    current.provider !== incoming.provider ||
    (current.externalThreadId || incoming.externalThreadId
      ? current.externalThreadId !== incoming.externalThreadId
      : current.chatTitle !== incoming.chatTitle)
  ) {
    return incoming
  }

  if (isIncomingSnapshotLikelyStale(current, incoming)) {
    return current
  }

  const overlap = findBestMessageOverlap(current.messages, incoming.messages)

  if (!overlap) {
    return chooseMoreCompleteSnapshot(current, incoming)
  }

  const mergedSnapshot = {
    ...incoming,
    messages: dedupeMessagesByFingerprint([
      ...incoming.messages.slice(0, overlap.incomingStart),
      ...current.messages,
      ...incoming.messages.slice(overlap.incomingStart + overlap.length)
    ]).slice(-80)
  }

  const currentLastFingerprint = getSnapshotLastFingerprint(current)
  const mergedFingerprints = new Set(
    mergedSnapshot.messages.map(getMessageFingerprint)
  )

  if (
    currentLastFingerprint &&
    current.messages.length > mergedSnapshot.messages.length &&
    !mergedFingerprints.has(currentLastFingerprint)
  ) {
    return current
  }

  return mergedSnapshot
}

function ClaraSidePanel() {
  const [activeWorkspace, setActiveWorkspace] = useState<"clara" | "chatgpt">(
    "clara"
  )
  const [chatData, setChatData] = useState<WhatsAppChatSnapshot | null>(null)
  const [authStatus, setAuthStatus] = useState<
    "checking" | "authenticated" | "unauthenticated" | "misconfigured"
  >("checking")
  const [authUser, setAuthUser] = useState<ClaraExtensionSessionUser | null>(
    null
  )
  const [hasAutoReadAttempted, setHasAutoReadAttempted] = useState(false)
  const [error, setError] = useState("")
  const [feedback, setFeedback] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isInsertingIndex, setIsInsertingIndex] = useState<number | null>(null)
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [isConfirmingSend, setIsConfirmingSend] = useState(false)
  const [chatReadAt, setChatReadAt] = useState<Date | null>(null)
  const [hasEditedSuggestion, setHasEditedSuggestion] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [draftSuggestions, setDraftSuggestions] = useState<string[]>([])
  const [editingSuggestionIndex, setEditingSuggestionIndex] = useState<
    number | null
  >(null)
  const [replySuggestionId, setReplySuggestionId] = useState("")
  const [deliveryContext, setDeliveryContext] = useState<{
    activeChatFingerprint: string
    conversationId: string
    latestMessageFingerprint: string
    snapshotFingerprint: string
    suggestionVersion: number
  } | null>(null)
  const [tabUrl, setTabUrl] = useState("")
  const [chatGptContextData, setChatGptContextData] =
    useState<WhatsAppChatSnapshot | null>(null)
  const [chatGptContextError, setChatGptContextError] = useState("")
  const [chatGptContextFeedback, setChatGptContextFeedback] = useState("")
  const [isRefreshingChatGptContext, setIsRefreshingChatGptContext] =
    useState(false)
  const [isChatGptContextExpanded, setIsChatGptContextExpanded] =
    useState(false)
  const chatDataRef = useRef<WhatsAppChatSnapshot | null>(null)
  const chatSignatureRef = useRef("")
  const chatGptAutoContextKeyRef = useRef("")
  const panelRef = useRef<HTMLDivElement | null>(null)
  const panelScrollTopRef = useRef(0)
  const authStatusRef = useRef(authStatus)
  const authUserRef = useRef<ClaraExtensionSessionUser | null>(authUser)
  const editSuggestionButtonRef = useRef<HTMLButtonElement | null>(null)
  const sendInFlightRef = useRef(false)

  const isClaraWorkspace =
    !ENABLE_CHATGPT_WORKSPACE || activeWorkspace === "clara"
  const isAuthenticated = authStatus === "authenticated"
  const shouldShowLoginGate = !isAuthenticated

  const latestMessage = useMemo(
    () =>
      chatData?.messages.length
        ? chatData.messages[chatData.messages.length - 1]
        : null,
    [chatData]
  )
  const primarySuggestion = suggestions[0] || ""
  const primaryDraftSuggestion = draftSuggestions[0] || primarySuggestion
  const latestChatGptContextMessage = useMemo(
    () =>
      chatGptContextData?.messages.length
        ? chatGptContextData.messages[chatGptContextData.messages.length - 1]
        : null,
    [chatGptContextData]
  )
  const chatGptContextPrompt = useMemo(
    () => buildChatGptContextPrompt(chatGptContextData),
    [chatGptContextData]
  )

  const chatSignature = useMemo(
    () => buildSnapshotSignature(chatData),
    [chatData]
  )

  useEffect(() => {
    chatDataRef.current = chatData
    chatSignatureRef.current = chatSignature
  }, [chatData, chatSignature])

  useEffect(() => {
    authStatusRef.current = authStatus
    authUserRef.current = authUser
  }, [authStatus, authUser])

  useEffect(() => {
    if (isClaraWorkspace || !isAuthenticated) {
      return
    }

    const panel = panelRef.current

    if (!panel) {
      return
    }

    if (Math.abs(panel.scrollTop - panelScrollTopRef.current) <= 1) {
      return
    }

    panel.scrollTop = panelScrollTopRef.current
  })

  const syncActiveTabUrl = async () => {
    const tab = await getActiveTab()
    const nextTabUrl = tab?.url || ""

    setTabUrl((currentTabUrl) =>
      currentTabUrl === nextTabUrl ? currentTabUrl : nextTabUrl
    )

    return tab
  }

  useEffect(() => {
    syncActiveTabUrl().catch(() => {
      setTabUrl("")
    })
  }, [])

  useEffect(() => {
    setHasAutoReadAttempted(false)
  }, [tabUrl])

  useEffect(() => {
    if (isClaraWorkspace || !isAuthenticated) {
      return
    }

    if (isRefreshingChatGptContext) {
      return
    }

    syncActiveTabUrl()
      .then((tab) => {
        const activeTabUrl = tab?.url || ""

        if (!isSupportedLiveSyncTabUrl(activeTabUrl)) {
          setChatGptContextData(null)
          setChatGptContextFeedback("")
          setChatGptContextError(getSupportedLiveSyncTabMessage())
          chatGptAutoContextKeyRef.current = ""
          return
        }

        const nextAutoContextKey = `${activeTabUrl}::${chatDataRef.current?.chatTitle || ""}`

        if (chatGptAutoContextKeyRef.current === nextAutoContextKey) {
          return
        }

        chatGptAutoContextKeyRef.current = nextAutoContextKey
        handleRefreshChatGptContext().catch(() => {
          // Error state already handled inside the refresh handler.
        })
      })
      .catch(() => {
        setChatGptContextError("Tab aktif belum berhasil dibaca.")
      })
  }, [isAuthenticated, isClaraWorkspace, isRefreshingChatGptContext, tabUrl])

  const refreshAuthState = async (options?: { silent?: boolean }) => {
    if (!getConfiguredClaraApiBaseUrl()) {
      if (authUserRef.current !== null) {
        setAuthUser(null)
      }
      if (authStatusRef.current !== "misconfigured") {
        setAuthStatus("misconfigured")
      }
      return false
    }

    if (!options?.silent && authStatusRef.current !== "checking") {
      setAuthStatus("checking")
    }

    try {
      const user = await getCurrentClaraSessionUser()

      if (!user) {
        if (authUserRef.current !== null) {
          setAuthUser(null)
        }
        if (authStatusRef.current !== "unauthenticated") {
          setAuthStatus("unauthenticated")
        }
        return false
      }

      if (
        !authUserRef.current ||
        authUserRef.current.id !== user.id ||
        authUserRef.current.email !== user.email ||
        authUserRef.current.role !== user.role ||
        authUserRef.current.organizationName !== user.organizationName
      ) {
        setAuthUser(user)
      }
      if (authStatusRef.current !== "authenticated") {
        setAuthStatus("authenticated")
      }
      return true
    } catch (sessionError) {
      if (authUserRef.current !== null) {
        setAuthUser(null)
      }
      if (authStatusRef.current !== "unauthenticated") {
        setAuthStatus("unauthenticated")
      }
      setError(
        sessionError instanceof Error
          ? sessionError.message
          : "Gagal membaca session Clara dari dashboard."
      )
      return false
    }
  }

  useEffect(() => {
    refreshAuthState().catch(() => {
      setAuthStatus("unauthenticated")
    })
  }, [])

  useEffect(() => {
    if (isAuthenticated || authStatus === "misconfigured") {
      return
    }

    const intervalId = window.setInterval(() => {
      refreshAuthState({ silent: true }).catch(() => {
        setAuthStatus("unauthenticated")
      })
    }, AUTH_REFRESH_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [authStatus, isAuthenticated])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return
      }

      refreshAuthState({ silent: true }).catch(() => {
        setAuthStatus("unauthenticated")
      })
    }

    const handleFocus = () => {
      refreshAuthState({ silent: true }).catch(() => {
        setAuthStatus("unauthenticated")
      })
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleFocus)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleFocus)
    }
  }, [])

  useEffect(() => {
    if (!chrome.cookies?.onChanged) {
      return
    }

    const authCookieName = getConfiguredClaraAuthCookieName()
    const allowedOrigins = getClaraSessionOrigins()

    const listener = (changeInfo: chrome.cookies.CookieChangeInfo) => {
      if (changeInfo.cookie.name !== authCookieName) {
        return
      }

      const cookieOrigin = `http${changeInfo.cookie.secure ? "s" : ""}://${changeInfo.cookie.domain.replace(/^\./, "")}`

      if (!allowedOrigins.some((origin) => origin.startsWith(cookieOrigin))) {
        return
      }

      refreshAuthState({ silent: true }).catch(() => {
        setAuthStatus("unauthenticated")
      })
    }

    chrome.cookies.onChanged.addListener(listener)

    return () => {
      chrome.cookies.onChanged.removeListener(listener)
    }
  }, [])

  const openDashboardLogin = async () => {
    await chrome.tabs.create({
      url: getClaraDashboardLoginUrl()
    })
  }

  const openChatGptInNewTab = async () => {
    await chrome.tabs.create({
      url: CHATGPT_EMBED_URL
    })
  }

  const ensureAuthenticated = async () => {
    if (isAuthenticated) {
      return true
    }

    const ok = await refreshAuthState()

    if (!ok) {
      setError(LOGIN_MESSAGE)
    }

    return ok
  }

  const readActiveChatFromActiveTab = async (options?: {
    requireAuthentication?: boolean
  }) => {
    if (options?.requireAuthentication && !(await ensureAuthenticated())) {
      throw new Error(LOGIN_MESSAGE)
    }

    const tab = await getActiveTab()

    if (!tab?.id) {
      throw new Error("Tab aktif tidak ditemukan.")
    }

    if (!isSupportedLiveSyncTabUrl(tab.url)) {
      throw new Error(getSupportedLiveSyncTabMessage())
    }

    let response: WhatsAppReadResponse | undefined

    try {
      response = (await chrome.tabs.sendMessage(tab.id, {
        type: "READ_ACTIVE_CHANNEL_CHAT"
      })) as WhatsAppReadResponse
    } catch (messageError) {
      const message =
        messageError instanceof Error
          ? messageError.message
          : String(messageError)

      if (!message.includes("Receiving end does not exist")) {
        throw messageError
      }

      if (isWhatsAppTabUrl(tab.url)) {
        const [result] = await chrome.scripting.executeScript({
          func: readWhatsAppFromPage,
          target: {
            tabId: tab.id
          }
        })

        response = result?.result as WhatsAppReadResponse | undefined
      } else {
        throw new Error(getContentScriptUnavailableMessage(tab.url))
      }
    }

    if (!response?.ok || !response.data) {
      throw new Error(response?.error || "Chat belum bisa dibaca.")
    }

    setTabUrl(tab.url)

    return response.data
  }

  const readChatFromActiveTab = async () =>
    readActiveChatFromActiveTab({
      requireAuthentication: true
    })

  const handleReadChat = async () => {
    setIsLoading(true)
    setError("")
    setFeedback("")
    setSuggestions([])
    setDraftSuggestions([])
    setHasEditedSuggestion(false)
    setEditingSuggestionIndex(null)
    setReplySuggestionId("")
    setDeliveryContext(null)

    try {
      const data = await readChatFromActiveTab()
      const mergedData = mergeChatSnapshots(chatDataRef.current, data)
      setChatData(mergedData)
      setChatReadAt(new Date())

      try {
        const syncResult = await syncChatSnapshotToProxy(mergedData)
        setFeedback(
          syncResult.duplicate
            ? "Chat aktif berhasil dibaca. Snapshot yang sama sudah ada di API."
            : "Chat aktif berhasil dibaca dan disimpan ke API."
        )
      } catch (syncError) {
        setError(
          syncError instanceof ConversationOwnershipError
            ? syncError.message
            : syncError instanceof Error
            ? `Chat berhasil dibaca, tapi belum tersimpan ke Clara. ${syncError.message}`
            : "Chat berhasil dibaca, tapi belum tersimpan ke Clara. Coba klik Baca Ulang Chat lagi."
        )
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Terjadi kendala saat membaca chat WhatsApp Web."

      setChatData(null)

      if (shouldClearSnapshotForError(message)) {
        clearChatSnapshotInProxy().catch(() => {
          // Keep the original read error as the main feedback for the user.
        })
      }

      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshChatSilently = async () => {
    try {
      const data = await readChatFromActiveTab()
      const mergedData = mergeChatSnapshots(chatDataRef.current, data)

      const nextSignature = buildSnapshotSignature(mergedData)

      if (nextSignature !== chatSignatureRef.current) {
        setChatData(mergedData)

        syncChatSnapshotToProxy(mergedData).catch(() => {
          // Silent refresh should not interrupt the current side panel experience.
        })
      }

      setError((currentError) =>
        currentError.includes("Buka WhatsApp Web") ||
        currentError.includes("Tab aktif tidak ditemukan.") ||
        currentError.includes("Chat belum bisa dibaca.")
          ? ""
          : currentError
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      if (shouldClearSnapshotForError(message)) {
        setChatData(null)

        clearChatSnapshotInProxy().catch(() => {
          // Silent refresh should not interrupt the current side panel experience.
        })
      }

      // Silent refresh should not interrupt the current side panel experience.
    }
  }

  useEffect(() => {
    if (
      !isClaraWorkspace ||
      hasAutoReadAttempted ||
      isLoading ||
      !isSupportedLiveSyncTabUrl(tabUrl)
    ) {
      return
    }

    setHasAutoReadAttempted(true)

    handleReadChat().catch(() => {
      // Error state is already handled inside handleReadChat.
    })
  }, [hasAutoReadAttempted, isClaraWorkspace, isLoading, tabUrl])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (!isClaraWorkspace) {
        return
      }

      if (isLoading || isSuggesting || isInsertingIndex !== null) {
        return
      }

      syncActiveTabUrl()
        .then((tab) => {
          if (!isSupportedLiveSyncTabUrl(tab?.url)) {
            return
          }

          refreshChatSilently().catch(() => {
            // Silent refresh should stay silent.
          })
        })
        .catch(() => {
          // Silent refresh should stay silent.
        })
    }, AUTO_REFRESH_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [
    chatSignature,
    isClaraWorkspace,
    isInsertingIndex,
    isLoading,
    isSuggesting
  ])

  const handleSuggestReplies = async () => {
    if (isSuggesting) {
      return
    }

    setIsSuggesting(true)
    setIsConfirmingSend(false)
    setError("")
    setFeedback("")

    try {
      // Selalu baca chat yang sedang terbuka supaya jawaban tidak dibuat dari tampilan lama.
      const currentChatData = await readChatFromActiveTab()
      const mergedChatData = mergeChatSnapshots(
        chatDataRef.current,
        currentChatData
      )

      if (mergedChatData.messages.length === 0) {
        throw new Error(
          "Belum ada pesan teks yang bisa dibaca dari chat ini. Buka chat yang berisi teks, gulir ke atas sebentar, lalu klik Buat Jawaban lagi."
        )
      }

      setChatData(mergedChatData)
      setChatReadAt(new Date())
      const suggestionResult =
        await fetchSuggestionsFromClaraBackendOnly(mergedChatData)
      const bestSuggestion = suggestionResult?.suggestions[0]?.trim()

      if (!bestSuggestion) {
        throw new Error("Clara belum mengembalikan jawaban terbaik.")
      }

      setSuggestions([bestSuggestion])
      setDraftSuggestions([bestSuggestion])
      setHasEditedSuggestion(false)
      setEditingSuggestionIndex(null)
      setReplySuggestionId(suggestionResult.replySuggestionId || "")
      setDeliveryContext(
        suggestionResult.activeChatFingerprint &&
          suggestionResult.conversationId &&
          suggestionResult.latestMessageFingerprint &&
          suggestionResult.snapshotFingerprint
          ? {
              activeChatFingerprint:
                suggestionResult.activeChatFingerprint,
              conversationId: suggestionResult.conversationId,
              latestMessageFingerprint:
                suggestionResult.latestMessageFingerprint,
              snapshotFingerprint: suggestionResult.snapshotFingerprint,
              suggestionVersion: suggestionResult.suggestionVersion || 1
            }
          : null
      )
      setFeedback(
        suggestionResult.cached
          ? "Jawaban terbaik tetap sama karena isi chat belum berubah."
          : "Jawaban terbaik Clara sudah siap dipakai."
      )
    } catch (err) {
      const message = toUserMessage(
        err instanceof Error ? err.message : "",
        "suggest"
      )

      setSuggestions([])
      setDraftSuggestions([])
      setHasEditedSuggestion(false)
      setEditingSuggestionIndex(null)
      setReplySuggestionId("")
      setDeliveryContext(null)
      setError(message)
    } finally {
      setIsSuggesting(false)
    }
  }

  const handleRefreshChatGptContext = async () => {
    if (!(await ensureAuthenticated())) {
      return
    }

    setIsRefreshingChatGptContext(true)
    setChatGptContextError("")
    setChatGptContextFeedback("")

    try {
      const data = await readActiveChatFromActiveTab()
      setChatGptContextData((current) => mergeChatSnapshots(current, data))
      setIsChatGptContextExpanded(true)
      setChatGptContextFeedback(
        `Context ${getChannelLabel(data.channel)} berhasil dibaca dari tab aktif.`
      )
    } catch (contextError) {
      setChatGptContextData(null)
      setChatGptContextError(
        contextError instanceof Error
          ? contextError.message
          : "Gagal membaca context tab aktif."
      )
    } finally {
      setIsRefreshingChatGptContext(false)
    }
  }

  const handleCopyChatGptContextPrompt = async () => {
    if (!chatGptContextPrompt.trim()) {
      setChatGptContextError(
        "Context prompt belum tersedia. Klik Refresh Context dulu."
      )
      return
    }

    try {
      await navigator.clipboard.writeText(chatGptContextPrompt)
      setChatGptContextError("")
      setChatGptContextFeedback(
        "Context prompt sudah disalin. Tinggal paste ke input ChatGPT."
      )
    } catch (_error) {
      setChatGptContextFeedback("")
      setChatGptContextError(
        "Gagal menyalin context prompt ke clipboard browser."
      )
    }
  }

  const handleInsertSuggestion = async (suggestion: string, index: number) => {
    setIsConfirmingSend(false)
    if (isInsertingIndex !== null) {
      return
    }

    if (!(await ensureAuthenticated())) {
      return
    }

    setIsInsertingIndex(index)
    setError("")
    setFeedback("")

    try {
      const tab = await getActiveTab()

      if (!tab?.id) {
        throw new Error("Tab aktif tidak ditemukan.")
      }

      if (!isSupportedLiveSyncTabUrl(tab.url)) {
        throw new Error(getSupportedLiveSyncTabMessage())
      }

      let response: WhatsAppActionResponse | undefined

      try {
        response = (await chrome.tabs.sendMessage(tab.id, {
          text: suggestion,
          type: "INSERT_WHATSAPP_REPLY"
        })) as WhatsAppActionResponse
      } catch (messageError) {
        const message =
          messageError instanceof Error
            ? messageError.message
            : String(messageError)

        if (!message.includes("Receiving end does not exist")) {
          throw messageError
        }

        if (isWhatsAppTabUrl(tab.url)) {
          const [result] = await chrome.scripting.executeScript({
            args: [suggestion],
            func: insertReplyIntoPage,
            target: {
              tabId: tab.id
            }
          })

          response = result?.result as WhatsAppActionResponse | undefined
        } else {
          throw new Error(getContentScriptUnavailableMessage(tab.url))
        }
      }

      if (!response?.ok) {
        throw new Error(response?.error || "Gagal memasukkan saran ke chatbox.")
      }

      if (replySuggestionId) {
        await chrome.runtime.sendMessage({
          chatTitle: chatData?.chatTitle || "",
          replySuggestionId,
          selectedReplyText: suggestion,
          tabId: tab.id,
          type: "REGISTER_PENDING_REPLY"
        })
      }

      setFeedback(
        "Draft sudah dimasukkan ke kolom balasan. Periksa kembali lalu kirim manual; Clara akan menyinkronkan status jika didukung."
      )
    } catch (err) {
      setError(
        toUserMessage(
          err instanceof Error ? err.message : "",
          "suggest"
        )
      )
    } finally {
      setIsInsertingIndex(null)
    }
  }

  const handleStartEditingSuggestion = (index: number) => {
    setIsConfirmingSend(false)
    setEditingSuggestionIndex(index)
    setError("")
    setFeedback("")
  }

  const handleDraftSuggestionChange = (index: number, value: string) => {
    setDraftSuggestions((currentDrafts) =>
      currentDrafts.map((draft, draftIndex) =>
        draftIndex === index ? value : draft
      )
    )
  }

  const handleSaveEditedSuggestion = (index: number) => {
    const editedSuggestion = draftSuggestions[index]?.trim()

    if (!editedSuggestion) {
      setError("Draft balasan tidak boleh kosong.")
      return
    }

    setSuggestions((currentSuggestions) =>
      currentSuggestions.map((suggestion, suggestionIndex) =>
        suggestionIndex === index ? editedSuggestion : suggestion
      )
    )
    setDraftSuggestions((currentDrafts) =>
      currentDrafts.map((draft, draftIndex) =>
        draftIndex === index ? editedSuggestion : draft
      )
    )
    setEditingSuggestionIndex(null)
    setHasEditedSuggestion(true)
    setError("")
    setFeedback("Draft balasan berhasil diperbarui.")
    window.requestAnimationFrame(() => editSuggestionButtonRef.current?.focus())
  }

  const handleCancelEditingSuggestion = (index: number) => {
    setDraftSuggestions((currentDrafts) =>
      currentDrafts.map((draft, draftIndex) =>
        draftIndex === index ? suggestions[index] || draft : draft
      )
    )
    setEditingSuggestionIndex(null)
    setError("")
    setFeedback("")
    window.requestAnimationFrame(() => editSuggestionButtonRef.current?.focus())
  }

  const handleSendSuggestion = async (suggestion: string, index: number) => {
    setIsConfirmingSend(false)
    if (
      isInsertingIndex !== null ||
      !canStartGovernedSend({
        explicitHumanAction: true,
        finalTextVisible: Boolean(suggestion.trim()),
        sendInFlight: sendInFlightRef.current
      })
    ) {
      return
    }

    if (!(await ensureAuthenticated())) {
      return
    }

    sendInFlightRef.current = true
    let wasSent = false
    setIsInsertingIndex(index)
    setError("")
    setFeedback("")

    try {
      const tab = await getActiveTab()

      if (!tab?.id) {
        throw new Error("Tab aktif tidak ditemukan.")
      }

      if (!isSupportedLiveSyncTabUrl(tab.url)) {
        throw new Error(getSupportedLiveSyncTabMessage())
      }

      if (!replySuggestionId) {
        throw new Error("Reply suggestion id tidak tersedia. Generate ulang draft.")
      }

      const authHeaders = await getClaraAuthHeaders()
      const postJson = async (url: string, body: object) => {
        const response = await fetch(url, {
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json", ...authHeaders },
          method: "POST"
        })
        const payload = await response.json()
        if (!response.ok) {
          const detail = payload?.detail
          throw new Error(
            typeof detail === "string"
              ? detail
              : detail?.message || payload?.error || "Backend Clara menolak delivery."
          )
        }
        return payload
      }
      const sendThroughBrowser = async (
        governedPayload?: object
      ): Promise<WhatsAppActionResponse & Record<string, any>> => {
        try {
          return (await chrome.tabs.sendMessage(tab.id, {
            ...governedPayload,
            text: suggestion,
            type: "SEND_ACTIVE_CHANNEL_REPLY"
          })) as WhatsAppActionResponse & Record<string, any>
        } catch (messageError) {
          const message =
            messageError instanceof Error
              ? messageError.message
              : String(messageError)
          if (governedPayload || !message.includes("Receiving end does not exist")) {
            throw messageError
          }
          if (!isWhatsAppTabUrl(tab.url)) {
            throw new Error(getContentScriptUnavailableMessage(tab.url))
          }
          const [result] = await chrome.scripting.executeScript({
            args: [suggestion],
            func: sendReplyFromPanel,
            target: { tabId: tab.id }
          })
          return result?.result as WhatsAppActionResponse & Record<string, any>
        }
      }

      let deliveryMode = "LEGACY"
      let authorization: any = null
      let currentIdentity = deliveryContext

      if (deliveryContext) {
        const currentSnapshot = await readChatFromActiveTab()
        currentIdentity = {
          ...(await buildDeliveryIdentity(currentSnapshot)),
          conversationId: deliveryContext.conversationId,
          suggestionVersion: deliveryContext.suggestionVersion
        }
        const authorizationUrl = getClaraDeliveryAuthorizationUrl(
          replySuggestionId,
          chatData?.channel
        )
        if (!authorizationUrl) {
          throw new Error("Endpoint delivery authorization belum dikonfigurasi.")
        }
        authorization = await postJson(authorizationUrl, {
          activeChatFingerprint: currentIdentity.activeChatFingerprint,
          explicitHumanAction: true,
          finalReplyText: suggestion,
          idempotencyKey: crypto.randomUUID(),
          latestMessageFingerprint: currentIdentity.latestMessageFingerprint,
          snapshotFingerprint: currentIdentity.snapshotFingerprint,
          suggestionVersion: currentIdentity.suggestionVersion
        })
        deliveryMode = String(authorization.mode || "LEGACY")
      }

      if (deliveryMode === "GOVERNED") {
        const permission = String(authorization?.delivery_permission || "BLOCK")
        if (permission !== "ALLOW_MANUAL_SEND") {
          const messages: Record<string, string> = {
            ALREADY_SENT: "Draft ini sudah pernah terkirim.",
            BLOCK: "Draft diblokir oleh governance Clara.",
            RECONCILIATION_REQUIRED:
              "Hasil pengiriman sebelumnya belum pasti. Lakukan rekonsiliasi manual.",
            REQUIRE_REFRESH:
              "Chat berubah setelah draft dibuat. Baca chat dan generate ulang.",
            REQUIRE_REVIEW: "Draft masih membutuhkan review yang berwenang."
          }
          throw new Error(messages[permission] || "Delivery tidak diizinkan.")
        }
        if (!authorization.authorization_id || !authorization.authorization_token) {
          throw new Error("Token delivery tidak tersedia. Minta authorization baru.")
        }

        const recheckedSnapshot = await readChatFromActiveTab()
        const recheckedIdentity = await buildDeliveryIdentity(recheckedSnapshot)
        const finalTextHash = await sha256Hex(suggestion.trim())
        if (
          recheckedIdentity.snapshotFingerprint !==
            authorization.snapshot_fingerprint ||
          recheckedIdentity.latestMessageFingerprint !==
            authorization.latest_message_fingerprint ||
          recheckedIdentity.activeChatFingerprint !==
            authorization.active_chat_fingerprint ||
          finalTextHash !== authorization.final_text_hash
        ) {
          throw new Error("Chat atau draft berubah sebelum claim. Generate ulang draft.")
        }

        const claimUrl = getClaraDeliveryClaimUrl(authorization.authorization_id)
        await postJson(claimUrl, {
          activeChatFingerprint: recheckedIdentity.activeChatFingerprint,
          authorizationToken: authorization.authorization_token,
          conversationId: authorization.conversation_id,
          finalTextHash,
          latestMessageFingerprint: recheckedIdentity.latestMessageFingerprint,
          snapshotFingerprint: recheckedIdentity.snapshotFingerprint,
          suggestionId: authorization.suggestion_id
        })

        const browserResult = await sendThroughBrowser({
          activeChatFingerprint: recheckedIdentity.activeChatFingerprint,
          authorizationClaimReference: authorization.authorization_id,
          finalTextHash,
          latestMessageFingerprint: recheckedIdentity.latestMessageFingerprint,
          snapshotFingerprint: recheckedIdentity.snapshotFingerprint,
          userTriggered: true
        })
        const browserStatus = String(browserResult?.status || "UNKNOWN")
        wasSent = browserStatus === "SENT"
        const resultUrl = getClaraDeliveryResultUrl(authorization.authorization_id)
        const resultPayload = await postJson(resultUrl, {
          activeChatFingerprint: recheckedIdentity.activeChatFingerprint,
          adapterResultCode:
            String(
              browserResult?.adapterResultCode ||
                browserResult?.code ||
                "UNSPECIFIED"
            )
              .toUpperCase()
              .replace(/[^A-Z0-9_]/g, "_")
              .slice(0, 80),
          authorizationToken: authorization.authorization_token,
          browserEventId: browserResult?.browserEventId || crypto.randomUUID(),
          finalTextHash,
          latestMessageFingerprint: recheckedIdentity.latestMessageFingerprint,
          result: browserStatus
        })

        if (resultPayload.status === "SENT") {
          await chrome.runtime.sendMessage({
            tabId: tab.id,
            type: "CLEAR_PENDING_REPLY"
          })
          setFeedback("Pesan terkonfirmasi terkirim dan sudah direkonsiliasi di Clara.")
          return
        }
        if (resultPayload.reconciliation_required) {
          throw new Error(
            "Hasil kirim belum dapat dipastikan. Jangan kirim ulang; lakukan rekonsiliasi manual."
          )
        }
        throw new Error(browserResult?.error || "Pengiriman browser gagal.")
      }

      const response = await sendThroughBrowser()
      if (!response?.ok) {
        throw new Error(response?.error || "Gagal mengirim draft ke chat aktif.")
      }
      wasSent = true
      const claraSendUrl = getClaraSendReplyUrl(
        replySuggestionId,
        chatData?.channel
      )
      if (!claraSendUrl) {
        throw new Error("Sinkronisasi status sent belum dikonfigurasi.")
      }
      const syncPayload = await postJson(claraSendUrl, {
        finalReplyText: suggestion,
        selectedReplyText: suggestion,
        sentByName: "extension_user"
      })
      await chrome.runtime.sendMessage({
        tabId: tab.id,
        type: "CLEAR_PENDING_REPLY"
      })
      setFeedback(
        deliveryMode === "OBSERVE"
          ? "Pesan terkirim lewat alur legacy; keputusan governed dicatat sebagai observasi."
          : syncPayload?.auto_approved
            ? "Pesan terkirim dan otomatis dianggap approved + sent di Clara."
            : "Pesan terkirim dan status sent sudah tercatat di Clara."
      )
    } catch (err) {
      const message = toUserMessage(
        err instanceof Error
          ? err.message
          : wasSent
            ? "Pesan terkirim, tetapi status sent gagal disinkronkan ke Clara."
            : "Terjadi kendala saat mengirim draft ke chat aktif.",
        "suggest"
      )

      setError(
        wasSent && !message.toLowerCase().includes("terkirim")
          ? `Pesan terkirim, tetapi sinkronisasi Clara gagal: ${message}`
          : message
      )
    } finally {
      sendInFlightRef.current = false
      setIsInsertingIndex(null)
    }
  }

  const isSupportedTab = isSupportedLiveSyncTabUrl(tabUrl)
  const activeChannelLabel = chatData
    ? getChannelLabel(chatData.channel)
    : isInstagramDmTabUrl(tabUrl)
      ? "Instagram DM"
      : isTikTokMessagesTabUrl(tabUrl)
        ? "TikTok DM"
        : isWhatsAppTabUrl(tabUrl)
          ? "WhatsApp Web"
          : "Belum terdeteksi"
  const authStatusLabel =
    authStatus === "authenticated"
      ? "Terhubung"
      : authStatus === "checking"
        ? "Memeriksa"
        : authStatus === "misconfigured"
          ? "Perlu pengaturan"
          : "Perlu login"
  const chatReadTimeLabel = chatReadAt
    ? chatReadAt.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit"
      })
    : ""
  const chatStatusText = isSuggesting
    ? "Clara sedang membaca chat dan menyusun jawaban..."
    : isLoading
      ? "Membaca chat yang sedang terbuka..."
      : chatData
        ? chatData.messages.length === 0
          ? `${getChannelLabel(chatData.channel)}: belum ada pesan teks yang terbaca.`
          : `${getChannelLabel(chatData.channel)} · ${chatData.messages.length} pesan terbaca${chatReadTimeLabel ? ` · ${chatReadTimeLabel}` : ""}`
        : isSupportedTab
          ? "Chat belum dibaca. Klik Buat Jawaban dan Clara akan membacanya."
          : "Buka chat di WhatsApp Web, Instagram DM, atau TikTok Messages dulu."
  const draftStatusLabel = suggestions.length
    ? hasEditedSuggestion
      ? "Draft diedit"
      : "Siap dicek"
    : isSuggesting
      ? "Sedang disusun"
      : "Belum ada draft"

  return (
    <div
      onScroll={(event) => {
        if (isClaraWorkspace) {
          return
        }

        panelScrollTopRef.current = event.currentTarget.scrollTop
      }}
      ref={panelRef}
      className={`clara-panel ${!isClaraWorkspace ? "clara-panel--chatgpt" : ""}`}>
      <style>{panelCss}</style>

      <div
        className={`clara-stage ${!isClaraWorkspace ? "clara-stage--chatgpt" : ""}`}>
        <section className="clara-hero">
          {ENABLE_CHATGPT_WORKSPACE ? (
            <div className="clara-workspace-switcher">
              <button
                aria-pressed={isClaraWorkspace}
                className={`clara-workspace-tab ${isClaraWorkspace ? "clara-workspace-tab--active" : ""}`}
                onClick={() => setActiveWorkspace("clara")}
                type="button">
                Clara
              </button>
              <button
                aria-pressed={!isClaraWorkspace}
                className={`clara-workspace-tab ${!isClaraWorkspace ? "clara-workspace-tab--active" : ""}`}
                onClick={() => setActiveWorkspace("chatgpt")}
                type="button">
                ChatGPT
              </button>
            </div>
          ) : null}
          <div className="clara-hero__footer">
            <div className="clara-chip clara-chip--soft" role="status">
              {authStatusLabel} · {activeChannelLabel}
            </div>
          </div>
        </section>

        {shouldShowLoginGate ? (
          <section className="clara-pane">
            <div className="clara-pane__header">
              <div>
                <div className="clara-pane__eyebrow">Login Clara</div>
                <div className="clara-pane__title">
                  Login dashboard Clara dulu
                </div>
                <p className="clara-pane__copy">
                  {authStatus === "misconfigured"
                    ? "Extension belum terhubung ke server Clara. Hubungi admin untuk memperbarui extension."
                    : authStatus === "checking"
                      ? "Sedang memeriksa session login Clara."
                      : "Seluruh fitur extension dikunci sampai kamu login di web Clara dengan akun yang benar."}
                </p>
                <p className="clara-pane__copy">
                  Setelah login berhasil, Clara Ops dan workspace ChatGPT baru
                  bisa dipakai.
                </p>
              </div>

              <div
                aria-live="polite"
                className="clara-chip clara-chip--warn"
                role={authStatus === "misconfigured" ? "alert" : "status"}>
                {authStatusLabel}
              </div>
            </div>

            <button
              className="clara-button clara-button--primary clara-button--block"
              onClick={openDashboardLogin}
              type="button">
              Buka Dashboard Login
            </button>
          </section>
        ) : !isClaraWorkspace ? (
          <section className="clara-pane clara-pane--chatgpt">
            <div className="clara-embed-shell clara-embed-shell--chatgpt">
              <iframe
                allow="clipboard-read; clipboard-write"
                className="clara-embed-frame clara-embed-frame--chatgpt"
                referrerPolicy="strict-origin-when-cross-origin"
                sandbox="allow-downloads allow-forms allow-popups allow-same-origin allow-scripts"
                src={CHATGPT_EMBED_URL}
                title="ChatGPT sales workspace"
              />
            </div>
            <div
              className={`clara-chatgpt-context ${
                isChatGptContextExpanded
                  ? ""
                  : "clara-chatgpt-context--collapsed"
              }`}>
              <div className="clara-chatgpt-context__top">
                <div className="clara-chatgpt-context__summary">
                  <div>
                    <div className="clara-pane__eyebrow">Active Context</div>
                    <div className="clara-pane__title">
                      Bawa konteks tab aktif ke ChatGPT
                    </div>
                    <p className="clara-pane__copy">
                      Clara baca chat aktif dari WhatsApp, Instagram DM, atau
                      TikTok DM lalu menyiapkan prompt yang siap dipaste
                      ke ChatGPT.
                    </p>
                  </div>
                </div>
                <div className="clara-chip clara-chip--soft">
                  {chatGptContextData
                    ? `${chatGptContextData.messages.length} pesan`
                    : "Belum ada context"}
                </div>
              </div>

              <button
                aria-controls={CHATGPT_CONTEXT_REGION_ID}
                aria-expanded={isChatGptContextExpanded}
                className="clara-chatgpt-context__toggle"
                onClick={() =>
                  setIsChatGptContextExpanded((current) => !current)
                }
                type="button">
                <span className="clara-chatgpt-context__toggle-icon">
                  {isChatGptContextExpanded ? "▴" : "▾"}
                </span>
                {isChatGptContextExpanded
                  ? "Sembunyikan detail context"
                  : "Tampilkan detail context"}
              </button>

              <div
                className="clara-chatgpt-context__details"
                id={CHATGPT_CONTEXT_REGION_ID}>
                {chatGptContextError ? (
                  <div className="clara-note clara-note--error" role="alert">
                    {chatGptContextError}
                  </div>
                ) : null}

                {chatGptContextFeedback ? (
                  <div
                    aria-live="polite"
                    className="clara-note clara-note--success"
                    role="status">
                    {chatGptContextFeedback}
                  </div>
                ) : null}

                <div className="clara-chatgpt-context__actions">
                  <button
                    aria-busy={isRefreshingChatGptContext}
                    className="clara-button clara-button--ghost clara-button--block"
                    disabled={isRefreshingChatGptContext}
                    onClick={handleRefreshChatGptContext}
                    type="button">
                    {isRefreshingChatGptContext
                      ? "Membaca context..."
                      : "Refresh Context"}
                  </button>
                  <button
                    className="clara-button clara-button--primary clara-button--block"
                    disabled={!chatGptContextPrompt.trim()}
                    onClick={handleCopyChatGptContextPrompt}
                    type="button">
                    Copy Context Prompt
                  </button>
                </div>

                {isChatGptContextExpanded && chatGptContextData ? (
                  <>
                    <div className="clara-chatgpt-context__meta">
                      <div>
                        <strong>Channel:</strong>{" "}
                        {getChannelLabel(chatGptContextData.channel)}
                      </div>
                      <div>
                        <strong>Percakapan:</strong>{" "}
                        {chatGptContextData.chatTitle || "-"}
                      </div>
                      <div>
                        <strong>Pesan terbaru:</strong>{" "}
                        {latestChatGptContextMessage?.text || "-"}
                      </div>
                    </div>

                    <label
                      className="clara-field-label"
                      htmlFor={CHATGPT_CONTEXT_PROMPT_ID}>
                      Context prompt siap salin
                    </label>
                    <textarea
                      className="clara-input clara-input--textarea clara-chatgpt-context__prompt"
                      id={CHATGPT_CONTEXT_PROMPT_ID}
                      readOnly
                      value={chatGptContextPrompt}
                    />
                  </>
                ) : isChatGptContextExpanded ? (
                  <div className="clara-note clara-note--warn" role="status">
                    Buka chat aktif di WhatsApp Web, Instagram DM, atau TikTok
                    Messages, lalu klik{" "}
                    <strong>Refresh Context</strong>. Clara hanya membaca
                    percakapan aktif, bukan seluruh inbox.
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {!isClaraWorkspace || shouldShowLoginGate ? null : (
          <>
            <section className="clara-actionbar" aria-label="Aksi utama">
              <p
                aria-live="polite"
                className="clara-actionbar__status"
                role="status">
                {chatStatusText}
              </p>
              <div className="clara-actionbar__buttons">
                <button
                  aria-busy={isSuggesting}
                  className="clara-button clara-button--primary clara-button--block"
                  disabled={
                    isSuggesting || isLoading || isInsertingIndex !== null
                  }
                  onClick={handleSuggestReplies}
                  type="button">
                  {isSuggesting
                    ? "Clara sedang menyusun..."
                    : suggestions.length
                      ? "Buat Ulang Jawaban"
                      : "Buat Jawaban"}
                </button>
                <button
                  aria-busy={isLoading}
                  className="clara-button clara-button--ghost clara-button--block"
                  disabled={
                    isLoading || isSuggesting || isInsertingIndex !== null
                  }
                  onClick={handleReadChat}
                  type="button">
                  {isLoading ? "Membaca chat..." : "Baca Ulang Chat"}
                </button>
              </div>
              {feedback ? (
                <div
                  aria-live="polite"
                  className="clara-note clara-note--success"
                  role="status">
                  {feedback}
                </div>
              ) : null}

              {error ? (
                <div className="clara-note clara-note--error" role="alert">
                  {error}
                </div>
              ) : null}
            </section>

            <section className="clara-pane clara-pane--reply">
              <div className="clara-pane__header">
                <div>
                  <div className="clara-pane__eyebrow">Balasan AI</div>
                  <div className="clara-pane__title">Draft jawaban</div>
                </div>

                <div
                  aria-live="polite"
                  className="clara-chip clara-chip--soft"
                  role="status">
                  {draftStatusLabel}
                </div>
              </div>

              {primarySuggestion ? (
                <>
                  <div className="clara-draft-list">
                    <article className="clara-draft">
                      <div className="clara-draft__head">
                        <div>
                          <div className="clara-draft__number">
                            Draft dari Clara
                          </div>
                          <div className="clara-draft__tone">
                            Periksa dulu sebelum dipakai
                          </div>
                        </div>
                      </div>

                      {editingSuggestionIndex === 0 ? (
                        <div className="clara-draft__editor">
                          <label
                            className="clara-field-label"
                            htmlFor={DRAFT_REPLY_TEXTAREA_ID}>
                            Edit draft balasan
                          </label>
                          <textarea
                            autoFocus
                            className="clara-input clara-input--textarea"
                            id={DRAFT_REPLY_TEXTAREA_ID}
                            onChange={(event) =>
                              handleDraftSuggestionChange(0, event.target.value)
                            }
                            rows={6}
                            value={primaryDraftSuggestion}
                          />
                          <div className="clara-draft__actions clara-draft__actions--pair">
                            <button
                              className="clara-button clara-button--ghost"
                              onClick={() => handleCancelEditingSuggestion(0)}
                              type="button">
                              Batal
                            </button>
                            <button
                              className="clara-button clara-button--insert"
                              onClick={() => handleSaveEditedSuggestion(0)}
                              type="button">
                              Simpan
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="clara-draft__text">
                          {primarySuggestion}
                        </div>
                      )}

                      {editingSuggestionIndex !== 0 ? (
                        <>
                          <div className="clara-draft__actions clara-draft__actions--pair">
                            <button
                              className="clara-button clara-button--ghost"
                              disabled={isInsertingIndex !== null}
                              onClick={() => handleStartEditingSuggestion(0)}
                              ref={editSuggestionButtonRef}
                              type="button">
                              Edit
                            </button>
                            <button
                              className="clara-button clara-button--insert"
                              disabled={isInsertingIndex !== null}
                              onClick={() =>
                                handleInsertSuggestion(primarySuggestion, 0)
                              }
                              type="button">
                              {isInsertingIndex === 0
                                ? "Memasukkan..."
                                : "Masukkan ke Chat"}
                            </button>
                          </div>
                          <p className="clara-draft__hint-text">
                            Teks dimasukkan ke kolom balasan. Kamu cek dulu, lalu
                            kirim sendiri di WhatsApp.
                          </p>

                          {isConfirmingSend ? (
                            <div
                              className="clara-confirm"
                              role="alertdialog"
                              aria-label="Konfirmasi kirim langsung">
                              <p className="clara-confirm__text">
                                Kirim ke{" "}
                                <strong>
                                  {chatData?.chatTitle || "chat ini"}
                                </strong>{" "}
                                sekarang? Pesan langsung terkirim dan tidak bisa
                                ditarik dari sini.
                              </p>
                              <div className="clara-draft__actions clara-draft__actions--pair">
                                <button
                                  autoFocus
                                  className="clara-button clara-button--ghost"
                                  onClick={() => setIsConfirmingSend(false)}
                                  type="button">
                                  Batal
                                </button>
                                <button
                                  className="clara-button clara-button--send"
                                  disabled={isInsertingIndex !== null}
                                  onClick={() =>
                                    handleSendSuggestion(primarySuggestion, 0)
                                  }
                                  type="button">
                                  {isInsertingIndex === 0
                                    ? "Mengirim..."
                                    : "Ya, kirim sekarang"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              className="clara-linkbutton"
                              disabled={isInsertingIndex !== null}
                              onClick={() => setIsConfirmingSend(true)}
                              type="button">
                              Kirim langsung tanpa dicek di chat
                            </button>
                          )}
                        </>
                      ) : null}
                    </article>
                  </div>
                </>
              ) : (
                <div className="clara-empty">
                  <div className="clara-empty__title">
                    Belum ada draft jawaban
                  </div>
                  <div className="clara-empty__meta">
                    Klik <strong>Buat Jawaban</strong>. Clara membaca chat yang
                    sedang terbuka lalu menyiapkan satu draft balasan untuk
                    kamu cek.
                  </div>
                </div>
              )}
            </section>

            <section className="clara-pane">
              <div className="clara-pane__header">
                <div>
                  <div className="clara-pane__eyebrow">Chat Aktif</div>
                  <div className="clara-pane__title">Chat yang terbaca</div>
                </div>
              </div>

              {!isSupportedTab && !chatData && (
                <div className="clara-note clara-note--warn" role="status">
                  Buka percakapan di WhatsApp Web, Instagram DM, atau TikTok
                  Messages, lalu klik Buat Jawaban.
                </div>
              )}

              {chatData ? (
                <div className="clara-overview">
                  <div className="clara-chat-shell">
                    <div className="clara-chat-appbar">
                      <div className="clara-chat-avatar">
                        {chatData.chatTitle.slice(0, 1).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="clara-chat-appbar__title">
                          {chatData.chatTitle}
                        </div>
                        <div className="clara-chat-appbar__meta">
                          {chatData.chatSubtitle ||
                            getChannelLabel(chatData.channel)}
                        </div>
                      </div>
                      <div className="clara-chip clara-chip--soft">
                        {getChannelLabel(chatData.channel)} ·{" "}
                        {chatData.messages.length} pesan
                      </div>
                    </div>

                    {latestMessage ? (
                      <div className="clara-chat-latest">
                        <strong>Pesan terbaru:</strong> {latestMessage.text}
                      </div>
                    ) : null}

                    <ol
                      aria-label="Pesan dalam percakapan aktif"
                      className="clara-thread">
                      {chatData.messages.length === 0 ? (
                        <li className="clara-empty">
                          Belum ada pesan teks yang terbaca. Pastikan chat
                          berisi teks (bukan hanya gambar atau stiker), lalu
                          klik Baca Ulang Chat.
                        </li>
                      ) : (
                        chatData.messages.map((message) => (
                          <li
                            className={`clara-thread-message clara-thread-message--${message.direction === "outgoing" ? "out" : "in"}`}
                            key={message.id}>
                            {message.direction !== "outgoing" ? (
                              <div className="clara-thread-message__author">
                                {message.author || "Tanpa nama"}
                              </div>
                            ) : null}
                            {message.replyContextText ? (
                              <div className="clara-thread-message__reply-context">
                                <div className="clara-thread-message__reply-label">
                                  Membalas{" "}
                                  {message.replyContextSenderType === "outgoing"
                                    ? "pesan sales"
                                    : message.replyContextSenderType ===
                                        "incoming"
                                      ? "pesan customer"
                                      : "pesan sebelumnya"}
                                </div>
                                <div className="clara-thread-message__reply-text">
                                  {message.replyContextText}
                                </div>
                              </div>
                            ) : null}
                            <div className="clara-thread-message__text">
                              {message.text}
                            </div>
                            <div className="clara-thread-message__footer">
                              {message.direction === "outgoing"
                                ? "Pesan keluar"
                                : "Pesan masuk"}
                              {message.timestampLabel
                                ? ` · ${message.timestampLabel}`
                                : ""}
                            </div>
                          </li>
                        ))
                      )}
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="clara-empty">
                  <div className="clara-empty__title">
                    Belum ada chat yang terbaca
                  </div>
                  <div className="clara-empty__meta">
                    Klik <strong>Buat Jawaban</strong> atau{" "}
                    <strong>Baca Ulang Chat</strong> di atas. Clara hanya
                    membaca chat yang sedang terbuka, bukan seluruh inbox.
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}

export default ClaraSidePanel
