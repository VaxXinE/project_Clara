import type {
  WhatsAppChatSnapshot,
  WhatsAppSuggestionDetail,
  WhatsAppSuggestionResult
} from "~/types/whatsapp"
import {
  getClaraAuthHeaders,
  getConfiguredProxyUrl,
  getReplySuggestionCandidates
} from "~/utils/proxy"

const OPENAI_PROXY_URL = getConfiguredProxyUrl()

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

initializeSidePanelBehavior()

chrome.runtime.onInstalled.addListener(() => {
  initializeSidePanelBehavior()
})

chrome.runtime.onStartup.addListener(() => {
  initializeSidePanelBehavior()
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
    customerSummary:
      typeof payload?.customer_summary === "string"
        ? payload.customer_summary
        : undefined,
    nextBestAction:
      typeof payload?.next_best_action === "string"
        ? payload.next_best_action
        : undefined,
    riskLevel:
      typeof payload?.risk_level === "string" ? payload.risk_level : undefined,
    suggestionDetails,
    suggestions: suggestions.slice(0, 3)
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "GENERATE_REPLY_SUGGESTIONS") {
    return
  }

  const run = async () => {
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
            error instanceof Error ? error.message : "Koneksi ke proxy OpenAI gagal."
        }
      }

      sendResponse({
        error: `Gagal menghubungi Clara/proxy reply di ${OPENAI_PROXY_URL}. Detail: ${lastFetchError || "Failed to fetch"}`,
        ok: false
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Koneksi ke proxy OpenAI gagal."

      sendResponse({
        error: `Gagal menghubungi Clara/proxy reply di ${OPENAI_PROXY_URL}. Detail: ${message}`,
        ok: false
      })
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
