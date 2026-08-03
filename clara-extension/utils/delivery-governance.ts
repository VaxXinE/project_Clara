import type { WhatsAppChatSnapshot } from "~/types/whatsapp"

const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim()

export const canStartGovernedSend = ({
  explicitHumanAction,
  finalTextVisible,
  sendInFlight
}: {
  explicitHumanAction: boolean
  finalTextVisible: boolean
  sendInFlight: boolean
}) => explicitHumanAction && finalTextVisible && !sendInFlight

export const sha256Hex = async (value: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")
}

export const buildDeliveryIdentity = async (
  snapshot: WhatsAppChatSnapshot
) => {
  const channel = snapshot.channel || "whatsapp"
  const activeChatKey =
    snapshot.externalThreadId?.trim() ||
    normalizeText(snapshot.chatTitle).toLowerCase()
  const latestInbound = [...snapshot.messages]
    .reverse()
    .find((message) => message.direction === "incoming")

  return {
    activeChatFingerprint: await sha256Hex(
      JSON.stringify({ channel, threadKey: activeChatKey })
    ),
    latestMessageFingerprint: await sha256Hex(
      JSON.stringify({
        direction: "incoming",
        text: normalizeText(latestInbound?.text || "")
      })
    ),
    snapshotFingerprint: await sha256Hex(
      JSON.stringify({
        channel,
        activeChatKey,
        messages: snapshot.messages.map((message) => ({
          direction: message.direction,
          text: normalizeText(message.text)
        }))
      })
    )
  }
}
