/**
 * Antrean review berisi dua jenis kasus yang berbeda untuk Manager:
 * - kasus yang menunggu keputusannya (eskalasi, draf yang perlu disetujui, draf yang perlu ditinjau);
 * - kasus yang giliran Sales untuk bertindak (belum dibaca Clara, belum ada draf, perlu diperbaiki, siap dikirim).
 * Memisahkannya membuat Manager tahu mana yang harus dia kerjakan sendiri.
 */
export const DECISION_BUCKETS = [
  "human_escalation",
  "pending_approval",
  "draft_review",
] as const;

export function isDecisionBucket(bucket: string): boolean {
  return (DECISION_BUCKETS as readonly string[]).includes(bucket);
}

/** Penjelasan satu kalimat untuk kasus yang sedang menunggu Sales. */
export const WAITING_FOR_SALES_TEXT: Record<string, string> = {
  needs_analysis: "Sales belum meminta Clara membaca chat ini.",
  needs_reply_suggestion: "Sales belum menyusun jawaban untuk pesan terbaru.",
  needs_rework:
    "Jawaban sebelumnya kurang kuat. Menunggu Sales memperbaikinya.",
  ready_to_send: "Jawaban sudah disetujui. Menunggu Sales mengirimnya.",
};
