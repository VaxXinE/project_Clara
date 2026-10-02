import type { SalesInboxItem } from "@/types/dashboard";

export type QueueBucketKey =
  | "reply_now"
  | "waiting_customer"
  | "needs_analysis"
  | "needs_draft"
  | "pending_review"
  | "high_risk"
  | "archived";

/** Urutan kerja: yang paling butuh perhatian di atas. */
export const BUCKET_ORDER: QueueBucketKey[] = [
  "high_risk",
  "needs_analysis",
  "needs_draft",
  "pending_review",
  "reply_now",
  "waiting_customer",
];

/** Kelompok yang masih menunggu tindakan Sales (bukan menunggu customer atau arsip). */
export const ACTIONABLE_BUCKETS: QueueBucketKey[] = [
  "high_risk",
  "needs_analysis",
  "needs_draft",
  "pending_review",
  "reply_now",
];

export const BUCKETS: Record<QueueBucketKey, { label: string; chip: string; description: string }> = {
  high_risk: {
    label: "Risiko tinggi",
    chip: "Risiko tinggi",
    description: "Topiknya sensitif. Baca dengan teliti sebelum membalas.",
  },
  needs_analysis: {
    label: "Belum dibaca Clara",
    chip: "Belum dibaca Clara",
    description: "Minta Clara membaca chat ini supaya bisa menyarankan jawaban.",
  },
  needs_draft: {
    label: "Belum ada draft jawaban",
    chip: "Belum ada draft",
    description: "Chat sudah dibaca. Minta Clara menyusun draft jawaban.",
  },
  pending_review: {
    label: "Menunggu persetujuan",
    chip: "Menunggu persetujuan",
    description: "Draft jawabannya masih menunggu keputusan reviewer.",
  },
  reply_now: {
    label: "Siap dibalas",
    chip: "Siap dibalas",
    description: "Draft sudah ada. Cek, ubah kalau perlu, lalu kirim sendiri dari WhatsApp.",
  },
  waiting_customer: {
    label: "Menunggu balasan customer",
    chip: "Menunggu customer",
    description: "Kamu sudah membalas. Tidak perlu dibalas lagi sampai customer menjawab.",
  },
  archived: {
    label: "Chat lama (arsip)",
    chip: "Arsip",
    description: "Chat yang sudah lama tidak aktif. Datanya tetap aman.",
  },
};

export function getQueueBucket(item: SalesInboxItem): QueueBucketKey {
  if (item.is_archived) {
    return "archived";
  }

  if (item.latest_ai_extraction?.risk_level === "high") {
    return "high_risk";
  }

  if (!item.latest_ai_extraction) {
    return "needs_analysis";
  }

  if (item.latest_reply_suggestion?.approval_status === "pending_approval") {
    return "pending_review";
  }

  if (!item.latest_reply_suggestion && item.ui_status !== "reply_sent") {
    return "needs_draft";
  }

  if (item.ui_status === "reply_sent") {
    return "waiting_customer";
  }

  return "reply_now";
}

/** Chat yang paling perlu dikerjakan lebih dulu; urutan sama dengan halaman Chat Masuk. */
export function pickNextChat(items: SalesInboxItem[]): SalesInboxItem | null {
  for (const bucket of ACTIONABLE_BUCKETS) {
    const match = items.find((item) => getQueueBucket(item) === bucket);

    if (match) {
      return match;
    }
  }

  return null;
}
