import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useMemo, useState } from "react"

import type { WhatsAppChatSnapshot } from "~/types/whatsapp"
import {
  getClaraAuthHeaders,
  getChatSnapshotProxyUrl,
  getConfiguredProxyUrl,
  getProxyCandidates,
  getSnapshotSyncCandidates
} from "~/utils/proxy"
import { insertReplyIntoComposeBox, readOpenChat } from "~/utils/whatsapp-page"

export const config: PlasmoCSConfig = {
  matches: ["https://web.whatsapp.com/*"]
}

export const getShadowHostId = () => "sg-extension-whatsapp-sidebar"

export const getOverlayAnchor = async () => document.body

export const getStyle = () => {
  const style = document.createElement("style")

  style.textContent = `
    :host, * {
      box-sizing: border-box;
    }

    .sg-shell {
      align-items: stretch;
      bottom: 20px;
      display: flex;
      gap: 12px;
      pointer-events: none;
      position: fixed;
      right: 18px;
      top: 20px;
      z-index: 2147483646;
    }

    .sg-shell[data-collapsed="true"] {
      align-items: flex-end;
      top: auto;
    }

    .sg-rail,
    .sg-panel,
    .sg-floating-bubble {
      backdrop-filter: blur(18px) saturate(130%);
      background:
        linear-gradient(180deg, rgba(16, 18, 28, 0.96), rgba(8, 10, 16, 0.98)),
        radial-gradient(circle at top, rgba(165, 99, 255, 0.18), transparent 38%);
      border: 1px solid rgba(181, 191, 255, 0.16);
      box-shadow:
        0 24px 52px rgba(0, 0, 0, 0.34),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
      pointer-events: auto;
    }

    .sg-rail {
      border-radius: 24px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px 10px;
      width: 68px;
    }

    .sg-rail[data-hidden="true"] {
      display: none;
    }

    .sg-panel {
      border-radius: 30px;
      color: #f6f8ff;
      display: flex;
      flex-direction: column;
      min-height: 100%;
      overflow: hidden;
      width: min(380px, calc(100vw - 120px));
    }

    .sg-panel[data-collapsed="true"] {
      display: none;
    }

    .sg-floating-bubble {
      align-items: center;
      border-radius: 999px;
      color: #f6f8ff;
      cursor: pointer;
      display: none;
      gap: 12px;
      min-height: 64px;
      padding: 10px 18px 10px 10px;
      transition:
        transform 150ms ease,
        border-color 150ms ease,
        filter 150ms ease;
    }

    .sg-floating-bubble[data-visible="true"] {
      display: inline-flex;
      pointer-events: auto;
    }

    .sg-floating-bubble:hover {
      border-color: rgba(199, 208, 255, 0.24);
      filter: brightness(1.04);
      transform: translateY(-1px);
    }

    .sg-floating-bubble-mark {
      align-items: center;
      background: linear-gradient(135deg, #d9ff35, #5eaefc);
      border-radius: 999px;
      color: #09111d;
      display: inline-flex;
      font-family: "Aptos Display", "Segoe UI Variable Display", "Trebuchet MS", sans-serif;
      font-size: 14px;
      font-weight: 900;
      height: 42px;
      justify-content: center;
      letter-spacing: 0.08em;
      width: 42px;
    }

    .sg-floating-copy {
      display: grid;
      gap: 2px;
      text-align: left;
    }

    .sg-floating-title {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .sg-floating-subtitle {
      color: rgba(216, 224, 255, 0.74);
      font-size: 11px;
      line-height: 1.3;
    }

    .sg-rail-button {
      align-items: center;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 18px;
      color: #eef2ff;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      font-family: "Aptos", "Segoe UI Variable Display", "Trebuchet MS", sans-serif;
      font-size: 10px;
      font-weight: 700;
      gap: 8px;
      min-height: 64px;
      justify-content: center;
      letter-spacing: 0.06em;
      padding: 10px 8px;
      text-transform: uppercase;
      transition: transform 150ms ease, background 150ms ease, border-color 150ms ease;
      width: 100%;
    }

    .sg-rail-button:hover,
    .sg-rail-button[data-active="true"] {
      background: linear-gradient(180deg, rgba(166, 125, 255, 0.18), rgba(72, 198, 255, 0.1));
      border-color: rgba(199, 208, 255, 0.22);
      transform: translateY(-1px);
    }

    .sg-icon {
      align-items: center;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 14px;
      display: inline-flex;
      height: 28px;
      justify-content: center;
      width: 28px;
    }

    .sg-header {
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding: 22px 22px 18px;
    }

    .sg-kicker {
      color: #d9ff35;
      font-family: "Aptos Display", "Segoe UI Variable Display", "Trebuchet MS", sans-serif;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.16em;
      margin-bottom: 10px;
      text-transform: uppercase;
    }

    .sg-title-row {
      align-items: flex-start;
      display: flex;
      gap: 12px;
      justify-content: space-between;
    }

    .sg-title {
      font-family: "Aptos Display", "Segoe UI Variable Display", "Trebuchet MS", sans-serif;
      font-size: 27px;
      font-weight: 800;
      letter-spacing: -0.04em;
      line-height: 1.02;
      margin: 0;
    }

    .sg-subtitle {
      color: rgba(228, 234, 255, 0.72);
      font-size: 12px;
      line-height: 1.55;
      margin-top: 10px;
      max-width: 260px;
    }

    .sg-badge {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 999px;
      color: #d5dcff;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      padding: 8px 11px;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .sg-body {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 16px;
      min-height: 0;
      padding: 18px;
    }

    .sg-card {
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02)),
        rgba(12, 16, 24, 0.78);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 22px;
      padding: 16px;
    }

    .sg-card-title {
      color: #ffffff;
      font-size: 15px;
      font-weight: 800;
      margin: 0 0 6px;
    }

    .sg-card-copy {
      color: rgba(216, 224, 255, 0.74);
      font-size: 12px;
      line-height: 1.55;
      margin: 0;
    }

    .sg-actions {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-top: 14px;
    }

    .sg-button {
      border: 0;
      border-radius: 16px;
      cursor: pointer;
      font-family: "Aptos", "Segoe UI Variable Display", "Trebuchet MS", sans-serif;
      font-size: 13px;
      font-weight: 800;
      min-height: 44px;
      padding: 12px 14px;
      transition: transform 150ms ease, opacity 150ms ease, filter 150ms ease;
      width: 100%;
    }

    .sg-button:hover:not(:disabled) {
      filter: brightness(1.04);
      transform: translateY(-1px);
    }

    .sg-button:disabled {
      cursor: wait;
      opacity: 0.68;
    }

    .sg-button-primary {
      background: linear-gradient(135deg, #8b6df8, #5eaefc);
      box-shadow: 0 16px 28px rgba(94, 126, 252, 0.24);
      color: #ffffff;
    }

    .sg-button-secondary {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #eef2ff;
    }

    .sg-status {
      border-radius: 18px;
      font-size: 12px;
      line-height: 1.5;
      padding: 12px 14px;
    }

    .sg-status[data-tone="error"] {
      background: rgba(255, 84, 84, 0.1);
      border: 1px solid rgba(255, 115, 115, 0.22);
      color: #ffbbbb;
    }

    .sg-status[data-tone="success"] {
      background: rgba(128, 255, 178, 0.08);
      border: 1px solid rgba(128, 255, 178, 0.2);
      color: #b6ffd0;
    }

    .sg-chat-scroll,
    .sg-suggestion-scroll {
      display: grid;
      gap: 10px;
      max-height: 100%;
      min-height: 0;
      overflow: auto;
      padding-right: 4px;
    }

    .sg-message {
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 18px;
      padding: 12px;
    }

    .sg-message[data-direction="outgoing"] {
      background: linear-gradient(180deg, rgba(222, 255, 140, 0.12), rgba(166, 125, 255, 0.08));
    }

    .sg-message[data-direction="incoming"] {
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.03));
    }

    .sg-message-meta {
      color: rgba(220, 227, 255, 0.72);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.07em;
      margin-bottom: 7px;
      text-transform: uppercase;
    }

    .sg-message-text,
    .sg-suggestion-text {
      color: #f7f9ff;
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .sg-metric-row {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-top: 14px;
    }

    .sg-metric {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 16px;
      padding: 12px;
    }

    .sg-metric-label {
      color: rgba(216, 224, 255, 0.68);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .sg-metric-value {
      color: #ffffff;
      font-size: 18px;
      font-weight: 800;
      line-height: 1.2;
      margin-top: 8px;
    }

    .sg-suggestion {
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.03));
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 18px;
      display: grid;
      gap: 12px;
      padding: 14px;
    }

    .sg-suggestion-head {
      align-items: center;
      display: flex;
      gap: 10px;
      justify-content: space-between;
    }

    .sg-suggestion-label {
      color: #d9ff35;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .sg-suggestion-note {
      color: rgba(216, 224, 255, 0.6);
      font-size: 10px;
    }

    .sg-suggestion-actions {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .sg-empty {
      align-items: center;
      color: rgba(228, 234, 255, 0.72);
      display: flex;
      font-size: 13px;
      justify-content: center;
      line-height: 1.6;
      min-height: 140px;
      text-align: center;
    }

    @media (max-width: 900px) {
      .sg-shell {
        bottom: 12px;
        left: 12px;
        right: 12px;
        top: auto;
      }

      .sg-shell[data-collapsed="true"] {
        left: auto;
      }

      .sg-panel {
        max-height: min(76vh, 760px);
        width: min(100%, 420px);
      }

      .sg-floating-bubble {
        min-height: 58px;
        padding-right: 16px;
      }
    }
  `

  return style
}

const OPENAI_PROXY_URL = getConfiguredProxyUrl()
const CHAT_SNAPSHOT_PROXY_URL = getChatSnapshotProxyUrl(OPENAI_PROXY_URL)
const AUTO_REFRESH_INTERVAL_MS = 2500
const SUGGESTION_TONE_LABELS = ["Friendly", "Casual", "Profesional"] as const

type ActiveView = "chat" | "ai"

const shouldClearSnapshotForError = (message: string) =>
  [
    "Belum ada percakapan yang sedang dibuka.",
    "Buka WhatsApp Web dulu di tab aktif.",
    "Panel chat WhatsApp Web belum ditemukan."
  ].some((pattern) => message.includes(pattern))

const fetchSuggestionsFromProxyDirectly = async (
  chatData: WhatsAppChatSnapshot
) => {
  let lastFetchError = ""

  for (const proxyUrl of getProxyCandidates(OPENAI_PROXY_URL)) {
    try {
      const response = await fetch(proxyUrl, {
        body: JSON.stringify({
          chatData
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            `Proxy OpenAI gagal memproses permintaan saran jawaban di ${proxyUrl}.`
        )
      }

      const suggestions = Array.isArray(payload?.suggestions)
        ? payload.suggestions.filter(
            (item: unknown): item is string =>
              typeof item === "string" && item.trim().length > 0
          )
        : []

      if (suggestions.length === 0) {
        throw new Error("Proxy tidak mengembalikan saran jawaban.")
      }

      return suggestions.slice(0, 3)
    } catch (error) {
      lastFetchError =
        error instanceof Error ? error.message : "Failed to fetch"
    }
  }

  throw new Error(
    `Gagal menghubungi proxy di ${OPENAI_PROXY_URL}. Detail: ${lastFetchError || "Failed to fetch"}`
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

  throw new Error(
    `Gagal menghubungi API snapshot di ${CHAT_SNAPSHOT_PROXY_URL}. Detail: ${lastFetchError || "Failed to fetch"}`
  )
}

const formatCapturedAt = (value?: string) => {
  if (!value) {
    return "-"
  }

  try {
    return new Date(value).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit"
    })
  } catch (_error) {
    return value
  }
}

const RailIcon = ({ children }: { children: string }) => (
  <span className="sg-icon">{children}</span>
)

const Sidebar = () => {
  const [activeView, setActiveView] = useState<ActiveView>("chat")
  const [chatData, setChatData] = useState<WhatsAppChatSnapshot | null>(null)
  const [error, setError] = useState("")
  const [feedback, setFeedback] = useState("")
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isInsertingIndex, setIsInsertingIndex] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])

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

  const handleReadChat = async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsLoading(true)
      setError("")
      setFeedback("")
      setSuggestions([])
    }

    try {
      const response = readOpenChat()

      if (!response.ok || !response.data) {
        throw new Error(response.error || "Chat belum bisa dibaca.")
      }

      setChatData(response.data)

      try {
        const syncResult = await syncChatSnapshotToProxy(response.data)

        if (!options?.silent) {
          setFeedback(
            syncResult.duplicate
              ? "Chat aktif berhasil dibaca. Snapshot yang sama sudah ada di API."
              : "Chat aktif berhasil dibaca dan disimpan ke API."
          )
        }
      } catch (syncError) {
        if (!options?.silent) {
          setError(
            syncError instanceof Error
              ? `Chat berhasil dibaca, tapi gagal dikirim ke API: ${syncError.message}`
              : "Chat berhasil dibaca, tapi gagal dikirim ke API."
          )
        }
      }
    } catch (readError) {
      const message =
        readError instanceof Error
          ? readError.message
          : "Terjadi kendala saat membaca chat WhatsApp Web."

      if (shouldClearSnapshotForError(message)) {
        setChatData(null)

        clearChatSnapshotInProxy().catch(() => {
          // Keep the original read error as the main feedback for the user.
        })
      }

      if (!options?.silent) {
        setError(message)
      }
    } finally {
      if (!options?.silent) {
        setIsLoading(false)
      }
    }
  }

  const refreshChatSilently = async () => {
    try {
      const response = readOpenChat()

      if (!response.ok || !response.data) {
        throw new Error(response.error || "Chat belum bisa dibaca.")
      }

      const nextSignature = JSON.stringify({
        chatTitle: response.data.chatTitle,
        lastMessageId:
          response.data.messages[response.data.messages.length - 1]?.id || "",
        lastMessageText:
          response.data.messages[response.data.messages.length - 1]?.text || "",
        messageCount: response.data.messages.length
      })

      if (nextSignature !== chatSignature) {
        setChatData(response.data)

        syncChatSnapshotToProxy(response.data).catch(() => {
          // Silent refresh should not interrupt the current sidebar experience.
        })
      }

      setError((currentError) =>
        currentError.includes("Chat belum bisa dibaca.") ? "" : currentError
      )
    } catch (readError) {
      const message =
        readError instanceof Error ? readError.message : String(readError)

      if (shouldClearSnapshotForError(message)) {
        setChatData(null)

        clearChatSnapshotInProxy().catch(() => {
          // Silent refresh should not interrupt the current sidebar experience.
        })
      }
    }
  }

  const handleSuggestReplies = async () => {
    setActiveView("ai")
    setIsSuggesting(true)
    setError("")
    setFeedback("")

    try {
      const currentChatData =
        chatData && chatData.messages.length > 0
          ? chatData
          : (() => {
              const response = readOpenChat()

              if (!response.ok || !response.data) {
                throw new Error(response.error || "Chat belum bisa dibaca.")
              }

              return response.data
            })()

      if (currentChatData.messages.length === 0) {
        throw new Error(
          "Chat aktif belum punya pesan teks yang bisa dipakai untuk saran."
        )
      }

      setChatData(currentChatData)

      syncChatSnapshotToProxy(currentChatData).catch(() => {
        // Suggestion flow should continue even when snapshot sync is unavailable.
      })

      const nextSuggestions =
        await fetchSuggestionsFromProxyDirectly(currentChatData)
      setSuggestions(nextSuggestions)
      setFeedback("Saran balasan siap dipakai.")
    } catch (suggestError) {
      const message =
        suggestError instanceof Error
          ? suggestError.message
          : "Terjadi kendala saat membuat saran jawaban."

      setSuggestions([])
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
      const response = insertReplyIntoComposeBox(suggestion)

      if (!response.ok) {
        throw new Error(response.error || "Gagal memasukkan saran ke chatbox.")
      }

      setFeedback("Saran jawaban sudah dimasukkan ke chatbox. Belum terkirim.")
    } catch (insertError) {
      setError(
        insertError instanceof Error
          ? insertError.message
          : "Terjadi kendala saat memasukkan saran ke chatbox."
      )
    } finally {
      setIsInsertingIndex(null)
    }
  }

  useEffect(() => {
    handleReadChat().catch(() => {
      // Error state is already handled inside handleReadChat.
    })
  }, [])

  useEffect(() => {
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
  }, [chatSignature, isInsertingIndex, isLoading, isSuggesting])

  const statusText = feedback || error
  const statusTone = feedback ? "success" : "error"

  return (
    <div className="sg-shell" data-collapsed={isCollapsed}>
      <div className="sg-rail" data-hidden={isCollapsed}>
        <button
          className="sg-rail-button"
          data-active={activeView === "chat"}
          onClick={() => {
            setIsCollapsed(false)
            setActiveView("chat")
          }}>
          <RailIcon>CH</RailIcon>
          Chat
        </button>

        <button
          className="sg-rail-button"
          data-active={activeView === "ai"}
          onClick={() => {
            setIsCollapsed(false)
            setActiveView("ai")
          }}>
          <RailIcon>AI</RailIcon>
          Reply
        </button>

        <button
          className="sg-rail-button"
          onClick={() => {
            setIsCollapsed((currentValue) => !currentValue)
          }}>
          <RailIcon>{isCollapsed ? "<<" : ">>"}</RailIcon>
          {isCollapsed ? "Open" : "Hide"}
        </button>
      </div>

      <aside
        className="sg-panel"
        data-collapsed={isCollapsed}
        aria-label="SG tools sidebar">
        <header className="sg-header">
          <div className="sg-kicker">SG Tools Sidebar</div>
          <div className="sg-title-row">
            <div>
              <h1 className="sg-title">
                {activeView === "chat"
                  ? "WhatsApp Live View"
                  : "AI Reply Assist"}
              </h1>
              <div className="sg-subtitle">
                Baca chat aktif, sinkronkan snapshot, lalu hasilkan balasan AI
                tanpa keluar dari halaman WhatsApp Web.
              </div>
            </div>
            <div className="sg-badge">
              {chatData?.chatTitle ? "Live" : "Standby"}
            </div>
          </div>
        </header>

        <div className="sg-body">
          <section className="sg-card">
            <h2 className="sg-card-title">
              {chatData?.chatTitle || "Belum ada chat aktif"}
            </h2>
            <p className="sg-card-copy">
              {chatData?.chatSubtitle ||
                "Buka percakapan dulu di WhatsApp Web untuk menampilkan isi chat di sidebar ini."}
            </p>

            <div className="sg-metric-row">
              <div className="sg-metric">
                <div className="sg-metric-label">Pesan terbaca</div>
                <div className="sg-metric-value">
                  {chatData?.messages.length || 0}
                </div>
              </div>

              <div className="sg-metric">
                <div className="sg-metric-label">Snapshot</div>
                <div className="sg-metric-value">
                  {formatCapturedAt(chatData?.capturedAt)}
                </div>
              </div>
            </div>

            <div className="sg-actions">
              <button
                className="sg-button sg-button-primary"
                disabled={isLoading}
                onClick={() => {
                  handleReadChat().catch(() => {
                    // Error state is already handled inside handleReadChat.
                  })
                }}>
                {isLoading ? "Membaca chat..." : "Refresh Chat"}
              </button>

              <button
                className="sg-button sg-button-secondary"
                disabled={isSuggesting || isLoading}
                onClick={() => {
                  handleSuggestReplies().catch(() => {
                    // Error state is already handled inside handleSuggestReplies.
                  })
                }}>
                {isSuggesting ? "Membuat saran..." : "Buat Saran AI"}
              </button>
            </div>
          </section>

          {statusText ? (
            <div className="sg-status" data-tone={statusTone}>
              {statusText}
            </div>
          ) : null}

          {activeView === "chat" ? (
            <section className="sg-card sg-chat-scroll">
              {latestMessage ? (
                <div
                  className="sg-message"
                  data-direction={latestMessage.direction}>
                  <div className="sg-message-meta">Pesan terbaru</div>
                  <div className="sg-message-text">{latestMessage.text}</div>
                </div>
              ) : null}

              {chatData?.messages.length ? (
                chatData.messages.map((message) => (
                  <article
                    key={message.id}
                    className="sg-message"
                    data-direction={message.direction}>
                    <div className="sg-message-meta">
                      {message.author || "Tanpa nama"}
                      {message.timestampLabel
                        ? ` | ${message.timestampLabel}`
                        : ""}
                    </div>
                    <div className="sg-message-text">{message.text}</div>
                  </article>
                ))
              ) : (
                <div className="sg-empty">
                  Sidebar siap, tapi belum ada percakapan terbuka yang bisa
                  dibaca.
                </div>
              )}
            </section>
          ) : (
            <section className="sg-card sg-suggestion-scroll">
              {suggestions.length ? (
                suggestions.map((suggestion, index) => (
                  <article
                    className="sg-suggestion"
                    key={`${suggestion}-${index}`}>
                    <div className="sg-suggestion-head">
                      <div className="sg-suggestion-label">
                        {SUGGESTION_TONE_LABELS[index] || `Saran ${index + 1}`}
                      </div>
                      <div className="sg-suggestion-note">
                        Siap insert manual
                      </div>
                    </div>

                    <div className="sg-suggestion-text">{suggestion}</div>

                    <div className="sg-suggestion-actions">
                      <button
                        className="sg-button sg-button-secondary"
                        onClick={() => {
                          void handleCopySuggestion(suggestion)
                        }}>
                        Copy
                      </button>

                      <button
                        className="sg-button sg-button-primary"
                        disabled={isInsertingIndex === index}
                        onClick={() => {
                          handleInsertSuggestion(suggestion, index).catch(
                            () => {
                              // Error state is already handled inside handleInsertSuggestion.
                            }
                          )
                        }}>
                        {isInsertingIndex === index
                          ? "Memasukkan..."
                          : "Masukkan"}
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="sg-empty">
                  Klik "Buat Saran AI" untuk menampilkan balasan yang bisa kamu
                  copy atau masukkan langsung ke chatbox.
                </div>
              )}
            </section>
          )}
        </div>
      </aside>

      <button
        className="sg-floating-bubble"
        data-visible={isCollapsed}
        aria-expanded={!isCollapsed}
        aria-label="Buka SG tools sidebar"
        onClick={() => {
          setIsCollapsed(false)
        }}>
        <span className="sg-floating-bubble-mark">SG</span>
        <span className="sg-floating-copy">
          <span className="sg-floating-title">Open Sidebar</span>
          <span className="sg-floating-subtitle">
            {activeView === "chat" ? "Chat live view" : "AI reply assist"}
          </span>
        </span>
      </button>
    </div>
  )
}

export default Sidebar
