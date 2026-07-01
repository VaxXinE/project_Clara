import type {
  WhatsAppChatSnapshot,
  WhatsAppSuggestionDetail,
  WhatsAppSuggestionResult
} from "~/types/whatsapp"
import {
  getClaraAuthHeaders,
  getClaraSendReplyUrl,
  getConfiguredProxyUrl,
  getReplySuggestionCandidates
} from "~/utils/proxy"

const OPENAI_PROXY_URL = getConfiguredProxyUrl()
const PENDING_REPLIES_STORAGE_KEY = "clara.pendingReplies"
const CHATGPT_FRAME_EMBED_RULE_ID = 1001
const CHATGPT_EMBED_RULE: chrome.declarativeNetRequest.Rule = {
  action: {
    responseHeaders: [
      {
        header: "content-security-policy",
        operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
      },
      {
        header: "x-frame-options",
        operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
      },
      {
        header: "frame-ancestors",
        operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
      }
    ],
    type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS
  },
  condition: {
    requestDomains: ["chatgpt.com", "chat.openai.com"],
    resourceTypes: [chrome.declarativeNetRequest.ResourceType.SUB_FRAME]
  },
  id: CHATGPT_FRAME_EMBED_RULE_ID,
  priority: 1
}

type PendingReplyRecord = {
  chatTitle: string
  registeredAt: number
  replySuggestionId: string
  selectedReplyText: string
  syncing?: boolean
}

const inMemoryPendingReplies: Record<string, PendingReplyRecord> = {}

const initializeSidePanelBehavior = () => {
  if (!chrome.sidePanel?.setPanelBehavior) {
    return
  }

  chrome.sidePanel
    .setPanelBehavior({
      openPanelOnActionClick: true
    })
    .catch(() => {
      // Ignore unsupported/runtime-sidepanel issues in non-Chrome environments.
    })
}

const ensureChatGptEmbedRules = () => {
  if (!chrome.declarativeNetRequest?.updateDynamicRules) {
    return
  }

  chrome.declarativeNetRequest
    .updateDynamicRules({
      addRules: [CHATGPT_EMBED_RULE],
      removeRuleIds: [CHATGPT_FRAME_EMBED_RULE_ID]
    })
    .catch(() => {
      // Ignore runtime issues on browsers without declarativeNetRequest support.
    })
}

initializeSidePanelBehavior()
ensureChatGptEmbedRules()

chrome.runtime.onInstalled.addListener(() => {
  initializeSidePanelBehavior()
  ensureChatGptEmbedRules()
})

chrome.runtime.onStartup.addListener(() => {
  initializeSidePanelBehavior()
  ensureChatGptEmbedRules()
})

const normalizeSuggestionPayload = (payload: any): WhatsAppSuggestionResult => {
  const suggestions = Array.isArray(payload?.suggestions)
    ? payload.suggestions.filter(
        (item: unknown): item is string => typeof item === "string" && item.trim().length > 0
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
      typeof payload?.action_mode === "string" ? payload.action_mode : undefined,
    cached: Boolean(payload?.cached),
    conversationId:
      typeof payload?.conversation_id === "string"
        ? payload.conversation_id
        : undefined,
    customerSummary:
      typeof payload?.customer_summary === "string"
        ? payload.customer_summary
        : undefined,
    nextBestAction:
      typeof payload?.next_best_action === "string"
        ? payload.next_best_action
        : undefined,
    replySuggestionId:
      typeof payload?.reply_suggestion_id === "string"
        ? payload.reply_suggestion_id
        : undefined,
    riskLevel:
      typeof payload?.risk_level === "string" ? payload.risk_level : undefined,
    suggestionDetails,
    suggestions: suggestions.slice(0, 3)
  }
}

const normalizeReplyText = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()

const getStorageApi = () => chrome.storage?.session

const getPendingReplies = async (): Promise<Record<string, PendingReplyRecord>> => {
  const storage = getStorageApi()

  if (!storage) {
    return { ...inMemoryPendingReplies }
  }

  const result = await storage.get(PENDING_REPLIES_STORAGE_KEY)

  return (result?.[PENDING_REPLIES_STORAGE_KEY] as Record<
    string,
    PendingReplyRecord
  >) || {}
}

const setPendingReplies = async (
  value: Record<string, PendingReplyRecord>
): Promise<void> => {
  const storage = getStorageApi()

  if (!storage) {
    Object.keys(inMemoryPendingReplies).forEach((key) => {
      delete inMemoryPendingReplies[key]
    })
    Object.assign(inMemoryPendingReplies, value)
    return
  }

  await storage.set({
    [PENDING_REPLIES_STORAGE_KEY]: value
  })
}

const registerPendingReply = async (
  tabId: number,
  record: PendingReplyRecord
): Promise<void> => {
  const pendingReplies = await getPendingReplies()
  pendingReplies[String(tabId)] = record
  await setPendingReplies(pendingReplies)
}

const clearPendingReply = async (tabId: number): Promise<void> => {
  const pendingReplies = await getPendingReplies()
  delete pendingReplies[String(tabId)]
  await setPendingReplies(pendingReplies)
}

const getPendingReply = async (
  tabId: number
): Promise<PendingReplyRecord | null> => {
  const pendingReplies = await getPendingReplies()
  return pendingReplies[String(tabId)] || null
}

const markPendingReplySyncing = async (
  tabId: number,
  pendingReply: PendingReplyRecord
): Promise<void> => {
  const pendingReplies = await getPendingReplies()
  pendingReplies[String(tabId)] = {
    ...pendingReply,
    syncing: true
  }
  await setPendingReplies(pendingReplies)
}

const isLikelyDerivedFromPendingReply = (
  composeText: string,
  selectedReplyText: string
) => {
  const current = normalizeReplyText(composeText)
  const original = normalizeReplyText(selectedReplyText)

  if (!current || !original) {
    return false
  }

  if (current === original) {
    return true
  }

  if (current.includes(original) || original.includes(current)) {
    return true
  }

  const currentPrefix = current.slice(0, Math.min(24, current.length))
  const originalPrefix = original.slice(0, Math.min(24, original.length))

  return (
    current.startsWith(originalPrefix) || original.startsWith(currentPrefix)
  )
}

const syncPendingReplyAsSent = async (
  pendingReply: PendingReplyRecord,
  finalReplyText: string
) => {
  const claraSendUrl = getClaraSendReplyUrl(pendingReply.replySuggestionId)

  if (!claraSendUrl) {
    throw new Error("Endpoint Clara untuk sinkronisasi sent belum dikonfigurasi.")
  }

  const response = await fetch(claraSendUrl, {
    body: JSON.stringify({
      finalReplyText,
      selectedReplyText: pendingReply.selectedReplyText,
      sentByName: "extension_manual_send"
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
      payload?.detail ||
        payload?.error ||
        "Gagal sinkronisasi sent message ke Clara."
    )
  }

  return payload
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const run = async () => {
    if (message?.type === "GENERATE_REPLY_SUGGESTIONS") {
      const chatData = message?.chatData as WhatsAppChatSnapshot | undefined

      if (!chatData) {
        sendResponse({
          error: "chatData tidak ditemukan.",
          ok: false
        })
        return
      }

      try {
        let lastFetchError = ""
        const replyCandidates = getReplySuggestionCandidates()

        if (replyCandidates.length === 0) {
          sendResponse({
            error:
              "Extension butuh koneksi ke backend Clara. Fallback proxy lokal hanya boleh dipakai saat development dan jika diaktifkan eksplisit.",
            ok: false
          })
          return
        }

        for (const proxyUrl of replyCandidates) {
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
              sendResponse({
                error:
                  payload?.error ||
                  `API Clara/proxy gagal memproses permintaan saran jawaban di ${proxyUrl}.`,
                ok: false
              })
              return
            }

            const normalized = normalizeSuggestionPayload(payload)
            const suggestions = normalized.suggestions

            if (suggestions.length === 0) {
              sendResponse({
                error: "Proxy tidak mengembalikan saran jawaban.",
                ok: false
              })
              return
            }

            sendResponse({
              ok: true,
              ...normalized
            })
            return
          } catch (error) {
            lastFetchError =
              error instanceof Error
                ? error.message
                : "Koneksi ke proxy OpenAI gagal."
          }
        }

        sendResponse({
          error: `Gagal menghubungi endpoint reply Clara di ${replyCandidates[0] || OPENAI_PROXY_URL}. Detail: ${lastFetchError || "Failed to fetch"}`,
          ok: false
        })
        return
      } catch (error) {
        const nextError =
          error instanceof Error ? error.message : "Koneksi ke proxy OpenAI gagal."

        sendResponse({
          error: `Gagal menghubungi Clara/proxy reply di ${OPENAI_PROXY_URL}. Detail: ${nextError}`,
          ok: false
        })
        return
      }
    }

    if (message?.type === "REGISTER_PENDING_REPLY") {
      const tabId = Number(message?.tabId)
      const selectedReplyText = String(message?.selectedReplyText || "").trim()
      const replySuggestionId = String(message?.replySuggestionId || "").trim()
      const chatTitle = String(message?.chatTitle || "").trim()

      if (!Number.isFinite(tabId) || tabId <= 0) {
        sendResponse({ ok: false, error: "Tab id tidak valid." })
        return
      }

      if (!selectedReplyText || !replySuggestionId) {
        sendResponse({ ok: false, error: "Pending reply tidak lengkap." })
        return
      }

      await registerPendingReply(tabId, {
        chatTitle,
        registeredAt: Date.now(),
        replySuggestionId,
        selectedReplyText
      })

      sendResponse({ ok: true })
      return
    }

    if (message?.type === "CLEAR_PENDING_REPLY") {
      const tabId = Number(message?.tabId)

      if (Number.isFinite(tabId) && tabId > 0) {
        await clearPendingReply(tabId)
      }

      sendResponse({ ok: true })
      return
    }

    if (message?.type === "WHATSAPP_MANUAL_SEND_TRIGGERED") {
      const tabId = sender.tab?.id
      const composeText = String(message?.composeText || "").trim()
      const chatTitle = String(message?.chatTitle || "").trim()

      if (!tabId || !composeText) {
        sendResponse({ ignored: true, ok: false })
        return
      }

      const pendingReply = await getPendingReply(tabId)

      if (!pendingReply) {
        sendResponse({ ignored: true, ok: true })
        return
      }

      if (pendingReply.syncing) {
        sendResponse({ ignored: true, ok: true })
        return
      }

      if (
        pendingReply.chatTitle &&
        chatTitle &&
        pendingReply.chatTitle !== chatTitle
      ) {
        sendResponse({ ignored: true, ok: true })
        return
      }

      if (!isLikelyDerivedFromPendingReply(composeText, pendingReply.selectedReplyText)) {
        sendResponse({ ignored: true, ok: true })
        return
      }

      await markPendingReplySyncing(tabId, pendingReply)

      try {
        const payload = await syncPendingReplyAsSent(pendingReply, composeText)
        await clearPendingReply(tabId)
        sendResponse({ ok: true, payload })
        return
      } catch (error) {
        await registerPendingReply(tabId, pendingReply)
        sendResponse({
          error:
            error instanceof Error
              ? error.message
              : "Gagal sinkron manual send ke Clara.",
          ok: false
        })
        return
      }
    }
  }

  run().catch((error) => {
    sendResponse({
      error:
        error instanceof Error ? error.message : "Terjadi kendala di background worker.",
      ok: false
    })
  })

  return true
})
