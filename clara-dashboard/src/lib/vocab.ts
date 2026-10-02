/**
 * Kamus nilai dari backend (warm, draft_ready, objection, ...) ke kata yang dipakai user.
 * Satu tempat supaya "warm" tidak tampil sebagai WARM di satu halaman dan "Hangat" di halaman lain.
 * `hint` adalah penjelasan satu kalimat yang boleh ditampilkan sebagai tooltip.
 */

export type Tone = "neutral" | "good" | "warn" | "danger" | "info" | "gold";

export type VocabEntry = { label: string; tone: Tone; hint?: string };
export type VocabTable = Record<string, VocabEntry>;

export const TEMPERATURE: VocabTable = {
  hot: { label: "Panas", tone: "danger", hint: "Siap membeli. Hubungi hari ini." },
  warm: { label: "Hangat", tone: "warn", hint: "Tertarik, tapi masih perlu diyakinkan." },
  cold: { label: "Dingin", tone: "neutral", hint: "Belum menunjukkan minat." },
  unknown: { label: "Belum dinilai", tone: "neutral", hint: "Clara belum membaca chat ini." },
};

export const RISK: VocabTable = {
  high: {
    label: "Risiko tinggi",
    tone: "danger",
    hint: "Topiknya sensitif (komplain, legalitas, uang). Cek dulu sebelum membalas.",
  },
  medium: { label: "Risiko sedang", tone: "warn", hint: "Ada hal yang perlu hati-hati saat membalas." },
  low: { label: "Risiko rendah", tone: "good", hint: "Aman dibalas dengan jawaban biasa." },
};

export const STAGE: VocabTable = {
  new_lead: { label: "Baru masuk", tone: "info" },
  qualification: { label: "Penjajakan", tone: "info", hint: "Menggali kebutuhan dan kecocokan customer." },
  education: { label: "Edukasi", tone: "info", hint: "Customer sedang belajar tentang produk." },
  objection: { label: "Keberatan", tone: "warn", hint: "Customer ragu atau keberatan. Jawab keraguannya dulu." },
  negotiation: { label: "Negosiasi", tone: "warn" },
  closing: { label: "Siap closing", tone: "good", hint: "Tinggal menyelesaikan pembukaan akun atau transaksi." },
  won: { label: "Deal berhasil", tone: "good" },
  lost: { label: "Batal", tone: "neutral" },
  unknown: { label: "Belum ditentukan", tone: "neutral" },
};

export const BUYING_INTENT: VocabTable = {
  high: { label: "Minat tinggi", tone: "good" },
  medium: { label: "Minat sedang", tone: "warn" },
  low: { label: "Minat rendah", tone: "neutral" },
};

export const SENTIMENT: VocabTable = {
  positive: { label: "Positif", tone: "good" },
  neutral: { label: "Netral", tone: "neutral" },
  cautious: { label: "Ragu-ragu", tone: "warn" },
  negative: { label: "Kurang senang", tone: "warn" },
  angry: { label: "Marah", tone: "danger" },
};

export const REPLY_TONE: VocabTable = {
  friendly: { label: "Ramah", tone: "neutral" },
  professional: { label: "Profesional", tone: "neutral" },
  empathetic: { label: "Empatik", tone: "neutral" },
  urgent: { label: "Mendesak", tone: "neutral" },
  best: { label: "Rekomendasi Clara", tone: "gold" },
};

/** Posisi sebuah chat dalam alur balas: dari belum dibaca Clara sampai siap dikirim. */
export const REPLY_STATE: VocabTable = {
  needs_analysis: { label: "Belum dibaca Clara", tone: "warn", hint: "Jalankan analisis supaya Clara bisa menyarankan jawaban." },
  needs_reply_suggestion: { label: "Belum ada draft jawaban", tone: "warn", hint: "Chat sudah dibaca, tinggal minta Clara menyusun jawaban." },
  needs_escalation: { label: "Perlu ke manager", tone: "danger", hint: "Topiknya terlalu sensitif untuk dijawab sendiri." },
  needs_approval: { label: "Draft menunggu persetujuan", tone: "warn" },
  draft_ready: { label: "Draft jawaban siap", tone: "gold", hint: "Cek draft, ubah kalau perlu, lalu kirim sendiri dari WhatsApp." },
  approved_ready_to_send: { label: "Disetujui, tinggal kirim", tone: "good" },
  reply_rejected: { label: "Draft ditolak", tone: "neutral", hint: "Minta Clara menyusun draft baru." },
  reply_sent: { label: "Sudah dibalas", tone: "good" },
  unknown: { label: "Belum jelas", tone: "neutral" },
};

export const APPROVAL: VocabTable = {
  pending: { label: "Menunggu persetujuan", tone: "warn" },
  approved: { label: "Disetujui", tone: "good" },
  rejected: { label: "Ditolak", tone: "danger" },
};

/** Status draft jawaban dari sisi Sales (bukan istilah persetujuan manager). */
export const SUGGESTION_STATE: VocabTable = {
  pending: { label: "Draft jawaban siap", tone: "gold", hint: "Cek draft, ubah kalau perlu, lalu pakai." },
  approved: { label: "Jawaban siap dikirim", tone: "good", hint: "Salin jawabannya dan kirim dari WhatsApp." },
  rejected: { label: "Draft ditolak", tone: "neutral" },
};

export const CONVERSATION_STATUS: VocabTable = {
  uploaded: { label: "Belum dibaca Clara", tone: "warn" },
  analyzed: { label: "Sudah dibaca Clara", tone: "info" },
  replied: { label: "Sudah dibalas", tone: "good" },
  reopened: { label: "Dibuka lagi", tone: "warn" },
  archived: { label: "Diarsipkan", tone: "neutral" },
  active: { label: "Aktif", tone: "info" },
};

export const AGE: VocabTable = {
  fresh: { label: "Baru", tone: "good" },
  aging: { label: "Mulai lama", tone: "warn", hint: "Belum ada aktivitas lebih dari 1 hari." },
  stale: { label: "Terlalu lama", tone: "danger", hint: "Belum ada aktivitas lebih dari 3 hari." },
};

export const DEAL_STATUS: VocabTable = {
  open: { label: "Berjalan", tone: "info" },
  won: { label: "Berhasil", tone: "good" },
  lost: { label: "Batal", tone: "neutral" },
};

export const USER_STATUS: VocabTable = {
  active: { label: "Aktif", tone: "good" },
  inactive: { label: "Nonaktif", tone: "neutral" },
};

export const ACCOUNT_CATEGORY: VocabTable = {
  mini: { label: "Akun Mini", tone: "neutral" },
  reguler: { label: "Akun Reguler", tone: "neutral" },
  unknown: { label: "Kategori akun belum ditentukan", tone: "neutral" },
};

function humanize(value: string): string {
  const text = value.replaceAll("_", " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "-";
}

/** Ambil label, nada, dan petunjuk. Nilai yang belum ada di kamus tetap terbaca (bukan kode mentah). */
export function describe(table: VocabTable, value: string | null | undefined): VocabEntry {
  const key = (value ?? "").trim().toLowerCase();
  return table[key] ?? { label: key ? humanize(key) : "-", tone: "neutral" };
}

export function labelOf(table: VocabTable, value: string | null | undefined): string {
  return describe(table, value).label;
}
