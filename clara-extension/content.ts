import type { PlasmoCSConfig } from "plasmo"

import type { LegacyRuntimeMessage } from "~/types/channel"
import type { ExtensionBrowserSendResult } from "~/types/channel"
import { getActiveAdapter } from "~/utils/channel-adapters/adapter-registry"
import {
  buildDeliveryIdentity,
  sha256Hex
} from "~/utils/delivery-governance"

export const config: PlasmoCSConfig = {
  matches: [
    "https://web.whatsapp.com/*",
    "https://www.instagram.com/direct/*",
    "https://www.tiktok.com/messages*"
  ]
}

const MESSAGE_HANDLER_KEY = "__sgExtensionWhatsAppHandler__"
const MANUAL_SEND_LOCK_KEY = "__sgExtensionManualSendLock__"

const triggerManualSendSync = () => {
  const activeAdapter = getActiveAdapter()
  const composeText = activeAdapter?.getComposeText?.() || ""
  const chatTitle = activeAdapter?.getConversationTitle?.() || ""

  if (!composeText || !chatTitle) {
    return
  }

  const contentWindow = window as typeof window & {
    [MANUAL_SEND_LOCK_KEY]?: { text: string; timestamp: number }
  }
  const activeLock = contentWindow[MANUAL_SEND_LOCK_KEY]

  if (
    activeLock &&
    activeLock.text === composeText &&
    Date.now() - activeLock.timestamp < 1200
  ) {
    return
  }

  contentWindow[MANUAL_SEND_LOCK_KEY] = {
    text: composeText,
    timestamp: Date.now()
  }

  chrome.runtime.sendMessage({
    chatTitle,
    composeText,
    type: "WHATSAPP_MANUAL_SEND_TRIGGERED"
  })
}

const handleRuntimeMessage = (
  message: LegacyRuntimeMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => {
  const activeAdapter = getActiveAdapter()

  if (message?.type === "READ_WHATSAPP_CHAT") {
    if (!activeAdapter) {
      sendResponse({
        error: "Halaman chat aktif belum didukung.",
        ok: false
      })
      return false
    }

    Promise.resolve(activeAdapter.readOpenChat())
      .then((result) => {
        sendResponse(result)
      })
      .catch((error) => {
        sendResponse({
          error:
            error instanceof Error
              ? error.message
              : "Terjadi kendala saat membaca chat aktif.",
          ok: false
        })
      })

    return true
  }

  if (message?.type === "READ_ACTIVE_CHANNEL_CHAT") {
    if (!activeAdapter) {
      sendResponse({
        error: "Halaman chat aktif belum didukung.",
        ok: false
      })
      return false
    }

    Promise.resolve(activeAdapter.readOpenChat())
      .then((result) => {
        sendResponse(result)
      })
      .catch((error) => {
        sendResponse({
          error:
            error instanceof Error
              ? error.message
              : "Terjadi kendala saat membaca chat aktif.",
          ok: false
        })
      })

    return true
  }

  if (
    message?.type === "INSERT_WHATSAPP_REPLY" ||
    message?.type === "INSERT_ACTIVE_CHANNEL_REPLY"
  ) {
    if (!activeAdapter) {
      sendResponse({
        error: "Halaman chat aktif belum didukung.",
        ok: false
      })
      return false
    }

    sendResponse(activeAdapter.insertReply(String(message?.text || "")))
    return false
  }

  if (message?.type === "FOCUS_CHAT_COMPOSE") {
    if (!activeAdapter?.focusCompose) {
      sendResponse({
        error: "Kolom chat aktif belum bisa difokuskan di halaman ini.",
        ok: false
      })
      return false
    }

    sendResponse(activeAdapter.focusCompose())
    return false
  }

  if (
    message?.type === "SEND_WHATSAPP_REPLY" ||
    message?.type === "SEND_ACTIVE_CHANNEL_REPLY"
  ) {
    if (!activeAdapter) {
      sendResponse({
        error: "Halaman chat aktif belum didukung.",
        ok: false
      })
      return false
    }

    const send = async (): Promise<ExtensionBrowserSendResult> => {
      const text = String(message?.text || "")
      const governed = Boolean(message?.authorizationClaimReference)

      if (governed) {
        if (!message.userTriggered) {
          return {
            adapterResultCode: "EXPLICIT_HUMAN_ACTION_REQUIRED",
            error: "Governed send wajib berasal dari klik user.",
            ok: false,
            status: "FAILED"
          }
        }
        const current = await activeAdapter.readOpenChat()
        if (!current.ok || !current.data) {
          return {
            adapterResultCode: current.code || "ACTIVE_CHAT_READ_FAILED",
            error: current.error || "Chat aktif gagal diverifikasi.",
            ok: false,
            status: "FAILED"
          }
        }
        const identity = await buildDeliveryIdentity(current.data)
        const finalTextHash = await sha256Hex(text.trim())
        if (
          identity.snapshotFingerprint !== message.snapshotFingerprint ||
          identity.latestMessageFingerprint !==
            message.latestMessageFingerprint ||
          identity.activeChatFingerprint !== message.activeChatFingerprint ||
          finalTextHash !== message.finalTextHash
        ) {
          return {
            ...identity,
            adapterResultCode: "DELIVERY_BINDING_MISMATCH",
            error: "Chat aktif atau draft berubah setelah authorization.",
            finalTextHash,
            ok: false,
            status: "FAILED"
          }
        }
      }

      try {
        const result = await activeAdapter.sendReply(text)
        const identity = governed
          ? await Promise.resolve(activeAdapter.readOpenChat()).then((read) =>
              read.ok && read.data ? buildDeliveryIdentity(read.data) : null
            )
          : null
        return {
          ...(identity || {}),
          ...result,
          adapterResultCode: result.code || (result.ok ? "SEND_CONFIRMED" : "SEND_FAILED"),
          browserEventId: crypto.randomUUID(),
          channel: activeAdapter.channel,
          finalTextHash: governed ? await sha256Hex(text.trim()) : undefined,
          status: result.ok ? "SENT" : "FAILED"
        }
      } catch (error) {
        return {
          adapterResultCode: "SEND_OUTCOME_UNCERTAIN",
          browserEventId: crypto.randomUUID(),
          channel: activeAdapter.channel,
          error: error instanceof Error ? error.message : "Hasil kirim tidak dapat dipastikan.",
          finalTextHash: governed ? await sha256Hex(text.trim()) : undefined,
          ok: false,
          status: "UNKNOWN"
        }
      }
    }

    send()
      .then((result) => {
        sendResponse(result)
      })
      .catch((error) => {
        sendResponse({
          error:
            error instanceof Error
              ? error.message
              : "Terjadi kendala saat mengirim balasan ke WhatsApp.",
          ok: false
        })
      })

    return true
  }

  return false
}

const contentWindow = window as typeof window & {
  [MESSAGE_HANDLER_KEY]?: typeof handleRuntimeMessage
}

if (contentWindow[MESSAGE_HANDLER_KEY]) {
  chrome.runtime.onMessage.removeListener(contentWindow[MESSAGE_HANDLER_KEY]!)
}

contentWindow[MESSAGE_HANDLER_KEY] = handleRuntimeMessage
chrome.runtime.onMessage.addListener(handleRuntimeMessage)

document.addEventListener(
  "click",
  (event) => {
    const target = event.target as HTMLElement | null
    const activeAdapter = getActiveAdapter()
    const sendButton = target?.closest(
      '[data-testid="compose-btn-send"], button[aria-label="Send"], button[aria-label="Kirim"]'
    )

    if (sendButton && activeAdapter?.channel === "whatsapp") {
      triggerManualSendSync()
    }
  },
  true
)

document.addEventListener(
  "keydown",
  (event) => {
    const activeAdapter = getActiveAdapter()

    if (activeAdapter?.channel !== "whatsapp") {
      return
    }

    if (event.key !== "Enter" || event.shiftKey) {
      return
    }

    const composeBox = document.activeElement as HTMLElement | null

    if (!composeBox) {
      return
    }

    if (!composeBox.isContentEditable) {
      return
    }

    if (
      event.target !== composeBox &&
      !composeBox.contains(event.target as Node)
    ) {
      return
    }

    triggerManualSendSync()
  },
  true
)
