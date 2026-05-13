import { useEffect, useMemo, useState } from "react"

import type {
  WhatsAppActionResponse,
  WhatsAppChatSnapshot,
  WhatsAppMessage,
  WhatsAppMessageDirection,
  WhatsAppReadResponse,
  WhatsAppSuggestionDetail,
  WhatsAppSuggestionResult
} from "~/types/whatsapp"
import {
  getClaraAuthHeaders,
  getChatSnapshotProxyUrl,
  getConfiguredProxyUrl,
  getReplySuggestionCandidates,
  getSnapshotSyncCandidates
} from "~/utils/proxy"

const OPENAI_PROXY_URL = getConfiguredProxyUrl()
const CHAT_SNAPSHOT_PROXY_URL = getChatSnapshotProxyUrl(OPENAI_PROXY_URL)
const INSERT_LOCK_KEY = "__sgExtensionPopupInsertLock__"
const AUTO_REFRESH_INTERVAL_MS = 2500
const SUGGESTION_TONE_LABELS = ["Friendly", "Casual", "Profesional"] as const

const popupStyle = {
  background:
    "radial-gradient(circle at 10% 10%, rgba(255,255,255,0.95), rgba(255,255,255,0) 24%), radial-gradient(circle at 88% 14%, rgba(112,199,255,0.34), rgba(112,199,255,0) 26%), radial-gradient(circle at 18% 78%, rgba(79,255,195,0.20), rgba(79,255,195,0) 24%), linear-gradient(160deg, #f7fbff 0%, #edf4ff 34%, #eefaf6 100%)",
  color: "#14212f",
  fontFamily:
    "'SF Pro Display', 'Segoe UI Variable Display', 'Segoe UI', sans-serif",
  minHeight: 560,
  padding: 18,
  width: 500
} as const

const primaryButtonStyle = {
  background:
    "linear-gradient(135deg, rgba(19,138,117,0.96) 0%, rgba(16,84,130,0.94) 100%)",
  border: "1px solid rgba(255, 255, 255, 0.28)",
  borderRadius: 18,
  boxShadow:
    "0 18px 36px rgba(36, 96, 128, 0.22), inset 0 1px 0 rgba(255,255,255,0.28)",
  color: "#ffffff",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 800,
  letterSpacing: "0.02em",
  padding: "14px 16px",
  width: "100%"
} as const

const secondaryButtonStyle = {
  background: "rgba(255, 255, 255, 0.68)",
  border: "1px solid rgba(255, 255, 255, 0.8)",
  borderRadius: 18,
  boxShadow:
    "0 12px 28px rgba(51, 77, 107, 0.08), inset 0 1px 0 rgba(255,255,255,0.7)",
  color: "#15344d",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 700,
  padding: "14px 16px",
  width: "100%"
} as const

const actionButtonStyle = {
  background: "rgba(255,255,255,0.62)",
  border: "1px solid rgba(255,255,255,0.85)",
  borderRadius: 14,
  color: "#1c3954",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
  padding: "10px 12px"
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

const softCardStyle = {
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.50))",
  backdropFilter: "blur(18px) saturate(155%)",
  border: "1px solid rgba(255, 255, 255, 0.72)",
  borderRadius: 24,
  boxShadow:
    "0 18px 44px rgba(64, 87, 109, 0.12), inset 0 1px 0 rgba(255,255,255,0.82)",
  padding: 16
} as const

const chipStyle = {
  background: "rgba(255,255,255,0.54)",
  border: "1px solid rgba(255,255,255,0.72)",
  borderRadius: 999,
  color: "#35546d",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  padding: "7px 11px",
  textTransform: "uppercase",
  textAlign: "center"
} as const

const normalizeSuggestionPayload = (payload: any): WhatsAppSuggestionResult => {
  const suggestions = Array.isArray(payload?.suggestions)
    ? payload.suggestions.filter(
        (item: unknown): item is string =>
          typeof item === "string" && item.trim().length > 0
      )
    : []

  const suggestionDetails = Array.isArray(payload?.suggestion_details)
    ? payload.suggestion_details
        .filter(
          (item: unknown): item is WhatsAppSuggestionDetail =>
            Boolean(item) &&
            typeof item === "object" &&
            typeof (item as { text?: unknown }).text === "string" &&
            (item as { text: string }).text.trim().length > 0
        )
        .map((item) => ({
          reasoning:
            typeof item.reasoning === "string" && item.reasoning.trim().length > 0
              ? item.reasoning
              : undefined,
          text: item.text,
          tone:
            typeof item.tone === "string" && item.tone.trim().length > 0
              ? item.tone
              : undefined
        }))
    : []

  return {
    actionMode:
      typeof payload?.actionMode === "string"
        ? payload.actionMode
        : typeof payload?.action_mode === "string"
          ? payload.action_mode
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
    riskLevel:
      typeof payload?.riskLevel === "string"
        ? payload.riskLevel
        : typeof payload?.risk_level === "string"
          ? payload.risk_level
          : undefined,
    suggestionDetails,
    suggestions: suggestions.slice(0, 3)
  }
}

const getActiveTab = async () => {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  })

  return tab
}

const readWhatsAppFromPage = (): WhatsAppReadResponse => {
  const parsePrePlainText = (value: string) => {
    const trimmedValue = value.trim()
    const match = trimmedValue.match(
      /^\[(?<timestamp>[^\]]+)\]\s?(?<author>.*?)(?::)?$/
    )

    return {
      author: match?.groups?.author?.trim() || "",
      timestampLabel: match?.groups?.timestamp?.trim() || ""
    }
  }

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

  const getConversationSubtitle = (chatRoot: HTMLElement) => {
    const subtitleSelectors = [
      '[data-testid="chat-subtitle"]',
      "header span[title]"
    ]

    for (const selector of subtitleSelectors) {
      const node = chatRoot.querySelector<HTMLElement>(selector)
      const subtitle =
        node?.getAttribute("title")?.trim() || node?.textContent?.trim()

      if (subtitle) {
        return subtitle
      }
    }

    return ""
  }

  const getMessageDirection = (
    container: HTMLElement
  ): WhatsAppMessageDirection => {
    const bubble = container.closest(".message-out, .message-in")

    return bubble?.classList.contains("message-out") ? "outgoing" : "incoming"
  }

  const getLeafTextCandidates = (nodes: HTMLElement[]) => {
    return nodes.filter(
      (node) =>
        !nodes.some((otherNode) => otherNode !== node && node.contains(otherNode))
    )
  }

  const getMessageText = (container: HTMLElement) => {
    const primaryCandidates = getLeafTextCandidates(
      Array.from(container.querySelectorAll<HTMLElement>('[data-testid="msg-text"]'))
    )
    const fallbackCandidates = getLeafTextCandidates(
      Array.from(
        container.querySelectorAll<HTMLElement>(
          '[data-testid="selectable-text"], .copyable-text'
        )
      )
    )
    const candidates =
      primaryCandidates.length > 0 ? primaryCandidates : fallbackCandidates

    const uniqueTexts = Array.from(
      new Set(
        candidates
          .map((node) => node.innerText.replace(/\s+/g, " ").trim())
          .filter(Boolean)
      )
    )

    if (uniqueTexts.length > 0) {
      return uniqueTexts.join("\n")
    }

    const mediaLabel = container
      .querySelector<HTMLElement>('[data-testid="media-caption"], [aria-label]')
      ?.innerText?.trim()

    return mediaLabel || ""
  }

  const chatRoot = getChatRoot()
  if (!chatRoot) {
    return {
      error: "Panel chat WhatsApp Web belum ditemukan.",
      ok: false
    }
  }

  const chatTitle = getConversationTitle(chatRoot)

  if (!chatTitle) {
    return {
      error: "Belum ada percakapan yang sedang dibuka.",
      ok: false
    }
  }

  const messageContainers = Array.from(
    chatRoot.querySelectorAll<HTMLElement>(
      '[data-testid="conversation-panel-messages"] [data-testid="msg-container"], [data-testid="msg-container"]'
    )
  )

  const messages: WhatsAppMessage[] = messageContainers
    .map((container, index) => {
      const metaSource =
        container
          .querySelector<HTMLElement>("[data-pre-plain-text]")
          ?.getAttribute("data-pre-plain-text") || ""
      const parsedMeta = parsePrePlainText(metaSource)
      const text = getMessageText(container)

      if (!text) {
        return null
      }

      return {
        author:
          parsedMeta.author ||
          (getMessageDirection(container) === "outgoing" ? "Anda" : chatTitle),
        direction: getMessageDirection(container),
        id: `${parsedMeta.timestampLabel}-${index}`,
        text,
        timestampLabel: parsedMeta.timestampLabel
      }
    })
    .filter((message): message is WhatsAppMessage => Boolean(message))

  return {
    data: {
      capturedAt: new Date().toISOString(),
      chatSubtitle: getConversationSubtitle(chatRoot),
      chatTitle,
      messages
    },
    ok: true
  }
}

const fetchSuggestionsFromProxyDirectly = async (
  chatData: WhatsAppChatSnapshot
) => {
  let lastFetchError = ""

  for (const proxyUrl of getReplySuggestionCandidates()) {
    try {
      const response = await fetch(proxyUrl, {
        body: JSON.stringify({
          chatData
        }),
        headers: {
          "Content-Type": "application/json",
          ...getClaraAuthHeaders()
        },
        method: "POST"
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            `API Clara/proxy gagal memproses permintaan saran jawaban di ${proxyUrl}.`
        )
      }

      const normalized = normalizeSuggestionPayload(payload)
      const suggestions = normalized.suggestions

      if (suggestions.length === 0) {
        throw new Error("Proxy tidak mengembalikan saran jawaban.")
      }

      return normalized
    } catch (error) {
      lastFetchError =
        error instanceof Error ? error.message : "Failed to fetch"
    }
  }

  throw new Error(
    `Gagal menghubungi Clara/proxy reply di ${OPENAI_PROXY_URL}. Detail: ${lastFetchError || "Failed to fetch"}`
  )
}

const syncChatSnapshotToProxy = async (chatData: WhatsAppChatSnapshot) => {
  let lastFetchError = ""

  for (const proxyUrl of getSnapshotSyncCandidates()) {
    try {
      const response = await fetch(proxyUrl, {
        body: JSON.stringify({
          chatData
        }),
        headers: {
          "Content-Type": "application/json",
          ...getClaraAuthHeaders()
        },
        method: "POST"
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          payload?.error ||
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
      lastFetchError =
        error instanceof Error ? error.message : "Failed to fetch"
    }
  }

  throw new Error(
    `Gagal menghubungi API snapshot di ${CHAT_SNAPSHOT_PROXY_URL}. Detail: ${lastFetchError || "Failed to fetch"}`
  )
}

const clearChatSnapshotInProxy = async () => {
  let lastFetchError = ""

  for (const proxyUrl of getSnapshotSyncCandidates()) {
    try {
      const response = await fetch(proxyUrl, {
        body: JSON.stringify({
          chatData: null
        }),
        headers: {
          "Content-Type": "application/json",
          ...getClaraAuthHeaders()
        },
        method: "POST"
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          payload?.error || `API snapshot chat gagal mengosongkan data di ${proxyUrl}.`
        )
      }

      return
    } catch (error) {
      lastFetchError =
        error instanceof Error ? error.message : "Failed to fetch"
    }
  }

  throw new Error(
    `Gagal menghubungi API snapshot di ${CHAT_SNAPSHOT_PROXY_URL}. Detail: ${lastFetchError || "Failed to fetch"}`
  )
}

const shouldClearSnapshotForError = (message: string) =>
  [
    "Belum ada percakapan yang sedang dibuka.",
    "Buka WhatsApp Web dulu di tab aktif.",
    "Panel chat WhatsApp Web belum ditemukan."
  ].some((pattern) => message.includes(pattern))

const requestSuggestionCandidates = async (chatData: WhatsAppChatSnapshot) => {
  try {
    const response = (await chrome.runtime.sendMessage({
      chatData,
      type: "GENERATE_REPLY_SUGGESTIONS"
    })) as
      | {
          actionMode?: string
          customerSummary?: string
          error?: string
          nextBestAction?: string
          ok: boolean
          riskLevel?: string
          suggestionDetails?: WhatsAppSuggestionDetail[]
          suggestions?: string[]
        }
      | undefined

    if (!response?.ok || !response.suggestions) {
      throw new Error(
        response?.error ||
          "Background worker gagal mengambil saran jawaban dari Clara/proxy."
      )
    }

    return normalizeSuggestionPayload(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (!message.includes("Receiving end does not exist")) {
      throw error
    }

    return fetchSuggestionsFromProxyDirectly(chatData)
  }
}

function IndexPopup() {
  const [chatData, setChatData] = useState<WhatsAppChatSnapshot | null>(null)
  const [hasAutoReadAttempted, setHasAutoReadAttempted] = useState(false)
  const [error, setError] = useState("")
  const [feedback, setFeedback] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isInsertingIndex, setIsInsertingIndex] = useState<number | null>(null)
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggestionDetails, setSuggestionDetails] = useState<
    WhatsAppSuggestionDetail[]
  >([])
  const [customerSummary, setCustomerSummary] = useState("")
  const [nextBestAction, setNextBestAction] = useState("")
  const [riskLevel, setRiskLevel] = useState("")
  const [actionMode, setActionMode] = useState("")
  const [tabUrl, setTabUrl] = useState("")

  const latestMessage = useMemo(
    () =>
      chatData?.messages.length
        ? chatData.messages[chatData.messages.length - 1]
        : null,
    [chatData]
  )

  const chatSignature = useMemo(
    () =>
      JSON.stringify({
        chatTitle: chatData?.chatTitle || "",
        lastMessageId:
          chatData?.messages[chatData.messages.length - 1]?.id || "",
        lastMessageText:
          chatData?.messages[chatData.messages.length - 1]?.text || "",
        messageCount: chatData?.messages.length || 0
      }),
    [chatData]
  )

  useEffect(() => {
    const syncTab = async () => {
      const tab = await getActiveTab()
      setTabUrl(tab?.url || "")
    }

    syncTab().catch(() => {
      setError("Gagal membaca tab aktif.")
    })
  }, [])

  const readChatFromActiveTab = async () => {
    const tab = await getActiveTab()

    if (!tab?.id) {
      throw new Error("Tab aktif tidak ditemukan.")
    }

    if (!tab.url?.startsWith("https://web.whatsapp.com/")) {
      throw new Error("Buka WhatsApp Web dulu di tab aktif.")
    }

    let response: WhatsAppReadResponse | undefined

    try {
      response = (await chrome.tabs.sendMessage(tab.id, {
        type: "READ_WHATSAPP_CHAT"
      })) as WhatsAppReadResponse
    } catch (messageError) {
      const message =
        messageError instanceof Error
          ? messageError.message
          : String(messageError)

      if (!message.includes("Receiving end does not exist")) {
        throw messageError
      }

      const [result] = await chrome.scripting.executeScript({
        func: readWhatsAppFromPage,
        target: {
          tabId: tab.id
        }
      })

      response = result?.result as WhatsAppReadResponse | undefined
    }

    if (!response?.ok || !response.data) {
      throw new Error(response?.error || "Chat belum bisa dibaca.")
    }

    setTabUrl(tab.url)

    return response.data
  }

  const handleReadChat = async () => {
    setIsLoading(true)
    setError("")
    setFeedback("")
    setSuggestions([])
    setSuggestionDetails([])
    setCustomerSummary("")
    setNextBestAction("")
    setRiskLevel("")
    setActionMode("")

    try {
      const data = await readChatFromActiveTab()
      setChatData(data)

      try {
        const syncResult = await syncChatSnapshotToProxy(data)
        setFeedback(
          syncResult.duplicate
            ? "Chat aktif berhasil dibaca. Snapshot yang sama sudah ada di API."
            : "Chat aktif berhasil dibaca dan disimpan ke API."
        )
      } catch (syncError) {
        setError(
          syncError instanceof Error
            ? `Chat berhasil dibaca, tapi gagal dikirim ke API: ${syncError.message}`
            : "Chat berhasil dibaca, tapi gagal dikirim ke API."
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

      const nextSignature = JSON.stringify({
        chatTitle: data.chatTitle,
        lastMessageId: data.messages[data.messages.length - 1]?.id || "",
        lastMessageText: data.messages[data.messages.length - 1]?.text || "",
        messageCount: data.messages.length
      })

      if (nextSignature !== chatSignature) {
        setChatData(data)

        syncChatSnapshotToProxy(data).catch(() => {
          // Silent refresh should not interrupt the current popup experience.
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
          // Silent refresh should not interrupt the current popup experience.
        })
      }

      // Silent refresh should not interrupt the current popup experience.
    }
  }

  useEffect(() => {
    if (hasAutoReadAttempted || isLoading || !tabUrl) {
      return
    }

    setHasAutoReadAttempted(true)

    if (!tabUrl.startsWith("https://web.whatsapp.com/")) {
      return
    }

    handleReadChat().catch(() => {
      // Error state is already handled inside handleReadChat.
    })
  }, [hasAutoReadAttempted, isLoading, tabUrl])

  useEffect(() => {
    if (!tabUrl.startsWith("https://web.whatsapp.com/")) {
      return
    }

    const intervalId = window.setInterval(() => {
      if (isLoading || isSuggesting || isInsertingIndex !== null) {
        return
      }

      refreshChatSilently().catch(() => {
        // Silent refresh should stay silent.
      })
    }, AUTO_REFRESH_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [chatSignature, isInsertingIndex, isLoading, isSuggesting, tabUrl])

  const handleSuggestReplies = async () => {
    setIsSuggesting(true)
    setError("")
    setFeedback("")

    try {
      const currentChatData =
        chatData && chatData.messages.length > 0
          ? chatData
          : await readChatFromActiveTab()

      if (currentChatData.messages.length === 0) {
        throw new Error(
          "Chat aktif belum punya pesan teks yang bisa dipakai untuk saran."
        )
      }

      setChatData(currentChatData)

      syncChatSnapshotToProxy(currentChatData).catch(() => {
        // Suggestion flow should continue even when snapshot sync is unavailable.
      })

      const nextSuggestionResult =
        await requestSuggestionCandidates(currentChatData)

      setSuggestions(nextSuggestionResult.suggestions)
      setSuggestionDetails(nextSuggestionResult.suggestionDetails || [])
      setCustomerSummary(nextSuggestionResult.customerSummary || "")
      setNextBestAction(nextSuggestionResult.nextBestAction || "")
      setRiskLevel(nextSuggestionResult.riskLevel || "")
      setActionMode(nextSuggestionResult.actionMode || "")
      setFeedback("Saran balasan Clara siap dipakai.")
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Terjadi kendala saat membuat saran jawaban."

      setSuggestions([])
      setSuggestionDetails([])
      setCustomerSummary("")
      setNextBestAction("")
      setRiskLevel("")
      setActionMode("")
      setError(message)
    } finally {
      setIsSuggesting(false)
    }
  }

  const handleCopySuggestion = async (suggestion: string) => {
    try {
      await navigator.clipboard.writeText(suggestion)
      setFeedback("Saran jawaban berhasil disalin.")
      setError("")
    } catch (_error) {
      setError("Clipboard tidak bisa diakses. Coba copy manual dulu.")
    }
  }

  const handleInsertSuggestion = async (suggestion: string, index: number) => {
    setIsInsertingIndex(index)
    setError("")
    setFeedback("")

    try {
      const tab = await getActiveTab()

      if (!tab?.id) {
        throw new Error("Tab aktif tidak ditemukan.")
      }

      if (!tab.url?.startsWith("https://web.whatsapp.com/")) {
        throw new Error("Buka WhatsApp Web dulu di tab aktif.")
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

        const [result] = await chrome.scripting.executeScript({
          args: [suggestion],
          func: insertReplyIntoPage,
          target: {
            tabId: tab.id
          }
        })

        response = result?.result as WhatsAppActionResponse | undefined
      }

      if (!response?.ok) {
        throw new Error(response?.error || "Gagal memasukkan saran ke chatbox.")
      }

      setFeedback("Saran jawaban sudah dimasukkan ke chatbox. Belum terkirim.")
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kendala saat memasukkan saran ke chatbox."
      )
    } finally {
      setIsInsertingIndex(null)
    }
  }

  return (
    <div style={popupStyle}>
      <div
        style={{
          ...softCardStyle,
          background:
            "linear-gradient(145deg, rgba(17, 31, 58, 0.86), rgba(35, 94, 120, 0.72) 52%, rgba(33, 145, 131, 0.68) 100%)",
          color: "#f7fbff",
          marginBottom: 16,
          overflow: "hidden",
          position: "relative"
        }}>
        <div
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.38), rgba(255,255,255,0) 62%)",
            filter: "blur(4px)",
            height: 180,
            pointerEvents: "none",
            position: "absolute",
            right: -50,
            top: -76,
            width: 180
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            position: "relative"
          }}>
          <div>
            <div
              style={{
                fontSize: 25,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1.04
              }}>
              WhatsApp Reply Mate
            </div>
            <div
              style={{
                color: "rgba(241, 249, 255, 0.84)",
                fontSize: 12,
                lineHeight: 1.55,
                marginTop: 10,
                maxWidth: 300
              }}>
              Baca chat aktif, minta saran balasan dari AI, lalu copy atau
              masukkan ke chatbox WhatsApp tanpa auto send.
            </div>
          </div>
          <div
            style={{
              ...chipStyle,
              alignSelf: "flex-start",
              background: "rgba(255,255,255,0.16)",
              border: "1px solid rgba(255,255,255,0.18)",
              color: "#f8fcff"
            }}>
            Clara
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <button
          disabled={isLoading}
          onClick={handleReadChat}
          style={primaryButtonStyle}>
          {isLoading
            ? "Membaca chat..."
            : chatData
              ? "Refresh Chat Aktif"
              : "Baca Chat Aktif"}
        </button>

        <div style={{ ...softCardStyle, maxHeight: 320, overflowY: "auto" }}>
          {!tabUrl.startsWith("https://web.whatsapp.com/") && !chatData && (
            <div style={{ color: "#6a7d76", fontSize: 13, lineHeight: 1.5 }}>
              Tab aktif saat ini bukan WhatsApp Web. Buka
              `https://web.whatsapp.com/`, pilih percakapan, lalu klik tombol di
              atas.
            </div>
          )}

          {chatData && (
            <div style={{ display: "grid", gap: 12 }}>
              <div
                style={{
                  borderBottom: "1px solid #e4ece8",
                  display: "grid",
                  gap: 6,
                  paddingBottom: 12
                }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12
                  }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 800 }}>
                      {chatData.chatTitle}
                    </div>
                  </div>
                  <div style={chipStyle}>{chatData.messages.length} pesan</div>
                </div>

                {latestMessage && (
                  <div
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.62), rgba(243,249,255,0.5))",
                      border: "1px solid rgba(255,255,255,0.84)",
                      borderRadius: 16,
                      color: "#52697c",
                      fontSize: 12,
                      lineHeight: 1.5,
                      padding: 10
                    }}>
                    <strong>Pesan terbaru:</strong> {latestMessage.text}
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {chatData.messages.length === 0 && (
                  <div style={{ color: "#6a7d76", fontSize: 13 }}>
                    Belum ada pesan teks yang berhasil diambil dari percakapan
                    ini.
                  </div>
                )}

                {chatData.messages.map((message) => (
                  <div
                    key={message.id}
                    style={{
                      background:
                        message.direction === "outgoing"
                          ? "linear-gradient(180deg, rgba(221,247,208,0.9), rgba(240,253,231,0.84))"
                          : "linear-gradient(180deg, rgba(255,255,255,0.82), rgba(244,247,252,0.72))",
                      border: "1px solid rgba(255,255,255,0.9)",
                      borderRadius: 18,
                      boxShadow:
                        "0 8px 22px rgba(72, 91, 115, 0.06), inset 0 1px 0 rgba(255,255,255,0.78)",
                      padding: 10
                    }}>
                    <div
                      style={{
                        color: "#4c6375",
                        fontSize: 11,
                        fontWeight: 800,
                        marginBottom: 6
                      }}>
                      {message.author || "Tanpa nama"}
                      {message.timestampLabel
                        ? ` | ${message.timestampLabel}`
                        : ""}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        lineHeight: 1.5,
                        whiteSpace: "pre-wrap"
                      }}>
                      {message.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ ...softCardStyle, display: "grid", gap: 12 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12
            }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>
                Saran Jawaban AI
              </div>
              <div
                style={{
                  color: "#587067",
                  fontSize: 12,
                  lineHeight: 1.45,
                  marginTop: 4
                }}>
                Clara akan mencoba generate saran dari backend utama dulu, lalu
                fallback ke proxy lokal kalau diperlukan.
              </div>
            </div>
            <div style={chipStyle}>3 saran</div>
          </div>

          <button
            disabled={isSuggesting || isLoading}
            onClick={handleSuggestReplies}
            style={secondaryButtonStyle}>
            {isSuggesting ? "Membuat saran jawaban..." : "Buat Saran Jawaban"}
          </button>

          {suggestions.length > 0 && (
            <div style={{ display: "grid", gap: 10 }}>
              {(customerSummary || nextBestAction || riskLevel) && (
                <div
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(246,250,255,0.78), rgba(236,243,251,0.7))",
                    border: "1px solid rgba(255,255,255,0.88)",
                    borderRadius: 18,
                    boxShadow:
                      "0 10px 26px rgba(71, 94, 120, 0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
                    display: "grid",
                    gap: 10,
                    padding: 13
                  }}>
                  <div
                    style={{
                      color: "#3e6278",
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase"
                    }}>
                    Insight Clara
                  </div>

                  {riskLevel && (
                    <div
                      style={{ color: "#183245", fontSize: 12, lineHeight: 1.55 }}>
                      <strong>Risk level:</strong> {riskLevel}
                      {actionMode ? ` • ${actionMode}` : ""}
                    </div>
                  )}

                  {customerSummary && (
                    <div
                      style={{ color: "#183245", fontSize: 12, lineHeight: 1.6 }}>
                      <strong>Ringkasan customer:</strong> {customerSummary}
                    </div>
                  )}

                  {nextBestAction && (
                    <div
                      style={{ color: "#183245", fontSize: 12, lineHeight: 1.6 }}>
                      <strong>Aksi berikutnya:</strong> {nextBestAction}
                    </div>
                  )}
                </div>
              )}

              {suggestions.map((suggestion, index) => (
                <div
                  key={`${suggestion}-${index}`}
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.74), rgba(246,250,255,0.62))",
                    border: "1px solid rgba(255,255,255,0.88)",
                    borderRadius: 18,
                    boxShadow:
                      "0 10px 26px rgba(71, 94, 120, 0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
                    display: "grid",
                    gap: 10,
                    padding: 13
                  }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10
                    }}>
                    <div
                      style={{
                        color: "#3e6278",
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: "0.02em"
                      }}>
                      {SUGGESTION_TONE_LABELS[index] || `Saran ${index + 1}`}
                    </div>
                    <div style={{ color: "#7a8c98", fontSize: 11 }}>
                      Siap dipakai tanpa auto send
                    </div>
                  </div>
                  <div
                    style={{
                      color: "#183245",
                      fontSize: 13,
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap"
                    }}>
                    {suggestion}
                  </div>
                  {suggestionDetails[index]?.reasoning && (
                    <div
                      style={{
                        color: "#587067",
                        fontSize: 12,
                        lineHeight: 1.55
                      }}>
                      <strong>Kenapa draft ini:</strong>{" "}
                      {suggestionDetails[index]?.reasoning}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => handleCopySuggestion(suggestion)}
                      style={{ ...actionButtonStyle, flex: 1 }}>
                      Copy
                    </button>
                    <button
                      disabled={isInsertingIndex === index}
                      onClick={() => handleInsertSuggestion(suggestion, index)}
                      style={{
                        ...actionButtonStyle,
                        background:
                          "linear-gradient(135deg, rgba(21,48,79,0.96), rgba(24,114,121,0.9))",
                        border: "1px solid rgba(255,255,255,0.22)",
                        boxShadow:
                          "0 10px 18px rgba(23, 72, 111, 0.18), inset 0 1px 0 rgba(255,255,255,0.18)",
                        color: "#f7fbff",
                        flex: 1
                      }}>
                      {isInsertingIndex === index
                        ? "Memasukkan..."
                        : "Masukkan"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(feedback || error) && (
            <div
              style={{
                background: feedback
                  ? "rgba(236, 249, 242, 0.72)"
                  : "rgba(254, 241, 239, 0.82)",
                border: `1px solid ${feedback ? "rgba(178,221,198,0.9)" : "rgba(240,192,183,0.92)"}`,
                borderRadius: 16,
                color: feedback ? "#215c54" : "#b42318",
                fontSize: 12,
                lineHeight: 1.5,
                padding: "10px 12px",
                textAlign: "center",
                textDecoration: "underline"
              }}>
              {feedback || error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default IndexPopup
