import type { WhatsAppChatSnapshot } from "~/types/whatsapp"
import { getConfiguredProxyUrl, getProxyCandidates } from "~/utils/proxy"

const OPENAI_PROXY_URL = getConfiguredProxyUrl()

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
            sendResponse({
              error:
                payload?.error ||
                `Proxy OpenAI gagal memproses permintaan saran jawaban di ${proxyUrl}.`,
              ok: false
            })
            return
          }

          const suggestions = Array.isArray(payload?.suggestions)
            ? payload.suggestions.filter(
                (item: unknown) => typeof item === "string" && item.trim()
              )
            : []

          if (suggestions.length === 0) {
            sendResponse({
              error: "Proxy tidak mengembalikan saran jawaban.",
              ok: false
            })
            return
          }

          sendResponse({
            ok: true,
            suggestions: suggestions.slice(0, 3)
          })
          return
        } catch (error) {
          lastFetchError =
            error instanceof Error ? error.message : "Koneksi ke proxy OpenAI gagal."
        }
      }

      sendResponse({
        error: `Gagal menghubungi proxy di ${OPENAI_PROXY_URL}. Detail: ${lastFetchError || "Failed to fetch"}`,
        ok: false
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Koneksi ke proxy OpenAI gagal."

      sendResponse({
        error: `Gagal menghubungi proxy di ${OPENAI_PROXY_URL}. Detail: ${message}`,
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
