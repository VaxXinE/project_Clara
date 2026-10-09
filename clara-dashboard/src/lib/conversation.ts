import type { SalesConversationDetail } from "@/types/dashboard";

export function getLatestConversationMessage(detail: SalesConversationDetail) {
  return [...detail.messages].sort((left, right) =>
    left.message_timestamp.localeCompare(right.message_timestamp),
  )[detail.messages.length - 1] ?? null;
}

export function getLatestCustomerMessage(detail: SalesConversationDetail) {
  const customerMessages = detail.messages.filter(
    (message) => message.sender_type === "customer",
  );
  return [...customerMessages].sort((left, right) =>
    left.message_timestamp.localeCompare(right.message_timestamp),
  )[customerMessages.length - 1] ?? null;
}

export function isSalesConversationMessage(message: { sender_type: string }): boolean {
  const normalizedSenderType = message.sender_type.trim().toLowerCase();

  return ["sales", "outgoing", "agent", "admin"].includes(
    normalizedSenderType,
  );
}

export function getLatestSentMessage(detail: SalesConversationDetail) {
  return [...detail.sent_messages].sort((left, right) =>
    left.sent_at.localeCompare(right.sent_at),
  )[detail.sent_messages.length - 1] ?? null;
}

export function isAnalysisStale(detail: SalesConversationDetail): boolean {
  const extraction = detail.latest_ai_extraction;
  const latestMessage = getLatestConversationMessage(detail);
  if (!extraction || !latestMessage || latestMessage.sender_type !== "customer") {
    return false;
  }
  return extraction.created_at < latestMessage.message_timestamp;
}

export function isReplySuggestionStale(detail: SalesConversationDetail): boolean {
  const suggestion = detail.latest_reply_suggestion;
  const latestMessage = getLatestConversationMessage(detail);
  if (!suggestion || !latestMessage || latestMessage.sender_type !== "customer") {
    return false;
  }
  return suggestion.created_at < latestMessage.message_timestamp;
}

export function hasFreshCustomerReply(detail: SalesConversationDetail): boolean {
  const latestMessage = getLatestConversationMessage(detail);
  const latestSent = getLatestSentMessage(detail);
  if (!latestMessage || latestMessage.sender_type !== "customer" || !latestSent) {
    return false;
  }
  return latestMessage.message_timestamp > latestSent.sent_at;
}

export function buildContinuationHref(detail: SalesConversationDetail): string {
  const params = new URLSearchParams({
    mode: "continue",
    title: detail.title,
    channel: detail.source_channel || "whatsapp",
    conversationId: detail.conversation_id,
  });
  return `/upload?${params.toString()}`;
}

export type OpenChatLink = { label: string; href: string };

/** Nomor telepon dari teks yang mungkin berisi nomor (judul chat, nama pengirim). Kembalikan angka saja. */
function phoneFromCandidates(candidates: string[]): string | null {
  for (const candidate of candidates) {
    const compact = candidate.replace(/[\s().-]/g, "");

    if (/^\+?\d{8,15}$/.test(compact)) {
      const digits = compact.replace("+", "");
      return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
    }
  }

  return null;
}

/** Tautan ke web chat asli. Halaman Sales tidak bisa mengirim pesan, jadi ini jalan pintas ke tempat mengirimnya. */
export function buildOpenChatLinkFor(channel: string, candidates: string[]): OpenChatLink | null {
  switch (channel) {
    case "whatsapp": {
      const phone = phoneFromCandidates(candidates);
      return {
        label: "Buka WhatsApp Web",
        href: phone ? `https://web.whatsapp.com/send?phone=${phone}` : "https://web.whatsapp.com/",
      };
    }
    case "instagram":
      return { label: "Buka Instagram DM", href: "https://www.instagram.com/direct/inbox/" };
    case "tiktok":
      return { label: "Buka TikTok DM", href: "https://www.tiktok.com/messages" };
    case "telegram":
      return { label: "Buka Telegram Web", href: "https://web.telegram.org/" };
    default:
      return null;
  }
}

export function buildOpenChatLink(detail: SalesConversationDetail): OpenChatLink | null {
  return buildOpenChatLinkFor(detail.source_channel, [
    detail.title,
    ...detail.messages
      .filter((message) => message.sender_type === "customer")
      .slice(-3)
      .map((message) => message.sender_name),
  ]);
}
