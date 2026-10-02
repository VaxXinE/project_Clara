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

const JARGON_REPLACEMENTS: Array<[RegExp, string]> = [
  [/discipline log/gi, "catatan aktivitas harian"],
  [/next follow-up/gi, "follow-up berikutnya"],
  [/bottleneck/gi, "hambatan"],
  [/queue task/gi, "tindak lanjut"],
  [/action center/gi, "halaman Tindak Lanjut"],
  [/tahap pipeline/gi, "tahap"],
  [/stage lead/gi, "tahap lead"],
  [/conversation/gi, "percakapan"],
];

/**
 * Teks bebas dari backend kadang memakai istilah internal ("Discipline log belum diisi").
 * Ganti dengan istilah yang dipakai di layar, tanpa mengubah huruf kapital di awal kata.
 */
export function plainJargon(text: string | null | undefined): string {
  let result = text ?? "";

  for (const [pattern, replacement] of JARGON_REPLACEMENTS) {
    result = result.replace(pattern, (match) =>
      match[0] === match[0].toUpperCase()
        ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
        : replacement,
    );
  }

  return result;
}

/** Hasil sebuah tindak lanjut, dipilih Sales saat menandai selesai. */
export const FOLLOW_UP_RESULTS: Array<{ value: string; label: string }> = [
  { value: "follow_up_executed", label: "Sudah saya hubungi" },
  { value: "waiting_customer", label: "Menunggu balasan customer" },
  { value: "needs_more_context", label: "Perlu informasi tambahan" },
  { value: "not_priority_now", label: "Belum jadi prioritas" },
  { value: "duplicate_or_noise", label: "Duplikat atau tidak relevan" },
];

export const DISCIPLINE_ACTIVITY: VocabTable = {
  follow_up_call: { label: "Telepon customer", tone: "neutral" },
  follow_up_chat: { label: "Chat dengan customer", tone: "neutral" },
  site_visit: { label: "Kunjungan", tone: "neutral" },
  proposal_sent: { label: "Kirim penawaran", tone: "neutral" },
  closing_push: { label: "Dorongan closing", tone: "neutral" },
  internal_coordination: { label: "Koordinasi internal", tone: "neutral" },
};

export const DISCIPLINE_RESULT: VocabTable = {
  waiting_customer: { label: "Menunggu balasan customer", tone: "neutral" },
  follow_up_scheduled: { label: "Follow-up dijadwalkan", tone: "info" },
  needs_escalation: { label: "Perlu eskalasi", tone: "danger" },
  won_progress: { label: "Mendekati deal", tone: "good" },
  lost_signal: { label: "Ada tanda-tanda batal", tone: "warn" },
  no_response: { label: "Customer belum merespons", tone: "warn" },
};

export const DISCIPLINE_MOOD: VocabTable = {
  positive: { label: "Positif", tone: "good" },
  neutral: { label: "Netral", tone: "neutral" },
  cautious: { label: "Ragu-ragu", tone: "warn" },
  resistant: { label: "Menolak", tone: "danger" },
  unresponsive: { label: "Tidak merespons", tone: "warn" },
};

export const DISCIPLINE_STATUS: VocabTable = {
  logged_today: { label: "Sudah diisi hari ini", tone: "good" },
  missing_today_log: { label: "Belum diisi hari ini", tone: "warn" },
  missing_today: { label: "Belum diisi hari ini", tone: "warn" },
  stale_log: { label: "Perlu diperbarui", tone: "warn" },
};

export const TASK_STATUS: VocabTable = {
  open: { label: "Terbuka", tone: "info" },
  snoozed: { label: "Ditunda", tone: "neutral" },
  done: { label: "Selesai", tone: "good" },
  cancelled: { label: "Dibatalkan", tone: "neutral" },
};

export const ACTIVITY_EVENT: VocabTable = {
  lead_created: { label: "Lead dibuat", tone: "neutral" },
  created: { label: "Dibuat", tone: "neutral" },
  stage_changed: { label: "Tahap berubah", tone: "info" },
  temperature_changed: { label: "Suhu berubah", tone: "info" },
  account_category_changed: { label: "Kategori akun berubah", tone: "neutral" },
  summary_updated: { label: "Ringkasan diubah", tone: "neutral" },
  notes_updated: { label: "Catatan diubah", tone: "neutral" },
  follow_up_updated: { label: "Jadwal follow-up diubah", tone: "info" },
  rescheduled: { label: "Jadwal dipindah", tone: "info" },
  status_changed: { label: "Status berubah", tone: "info" },
  reassigned: { label: "Pemilik diganti", tone: "warn" },
  assignee_changed: { label: "Pemilik diganti", tone: "warn" },
  task_event: { label: "Tugas", tone: "neutral" },
  queue_event: { label: "Tindak lanjut", tone: "neutral" },
  queue_created: { label: "Tindak lanjut dibuat", tone: "neutral" },
  system_auto_done_after_send: { label: "Selesai otomatis setelah jawaban dikirim", tone: "good" },
  system_sync: { label: "Disinkronkan sistem", tone: "neutral" },
  discipline_log_created: { label: "Catatan aktivitas", tone: "neutral" },
  discipline_log_updated: { label: "Catatan aktivitas diubah", tone: "neutral" },
  deal_created: { label: "Deal dibuat", tone: "good" },
  deal_status_changed: { label: "Status deal berubah", tone: "info" },
  deal_value_updated: { label: "Nilai deal berubah", tone: "info" },
  deposit_updated: { label: "Setoran berubah", tone: "info" },
  customer_profile_autofilled: { label: "Profil customer diisi otomatis", tone: "neutral" },
  conversation_appended: { label: "Chat ditambahkan", tone: "neutral" },
  conversation_reopened: { label: "Percakapan dibuka lagi", tone: "warn" },
  conversation_status_changed: { label: "Status percakapan berubah", tone: "neutral" },
};

const QUEUE_ACTION_TITLES: Record<string, string> = {
  done: "Tindak lanjut ditandai selesai",
  dismiss: "Tindak lanjut disembunyikan",
  reopen: "Tindak lanjut dibuka lagi",
  snooze: "Tindak lanjut ditunda",
};

/** Judul riwayat dari backend ("Queue action: done") jadi kalimat biasa. */
export function humanizeActivityTitle(title: string): string {
  const match = /^Queue action:\s*(\w+)/i.exec(title.trim());

  if (match) {
    return QUEUE_ACTION_TITLES[match[1].toLowerCase()] ?? "Tindak lanjut diperbarui";
  }

  return plainJargon(title);
}

/** Deskripsi riwayat seperti "queue_action=done | reason_tag=waiting_customer | reason_note=..." jadi kalimat. */
export function humanizeActivityDescription(description: string): string {
  if (!description.includes("queue_action=")) {
    return plainJargon(description);
  }

  const fields = Object.fromEntries(
    description.split("|").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, rest.join("=").trim()];
    }),
  ) as Record<string, string>;
  const result = FOLLOW_UP_RESULTS.find((item) => item.value === fields.reason_tag)?.label;
  const pieces = [result ? `Hasil: ${result}.` : "", fields.reason_note ? `Catatan: ${fields.reason_note}.` : ""];

  return pieces.filter(Boolean).join(" ") || "Tidak ada catatan tambahan.";
}

/** Nilai "dari" dan "menjadi" di riwayat: tahap dan suhu ditampilkan dengan kata biasa. */
export function humanizeActivityValue(eventType: string, value: string | null): string {
  if (!value) {
    return "-";
  }

  if (eventType === "stage_changed") return labelOf(STAGE, value);
  if (eventType === "temperature_changed") return labelOf(TEMPERATURE, value);
  if (eventType === "deal_status_changed") return labelOf(DEAL_STATUS, value);
  if (eventType === "task_event" || eventType === "queue_event") return labelOf(TASK_STATUS, value);

  return value;
}

/** Tahap proses nyata seorang customer, dari pertama bertanya sampai akunnya aktif. */
export const PROCESS_STATE: VocabTable = {
  unknown: { label: "Belum diketahui", tone: "neutral" },
  new_inquiry: { label: "Baru bertanya", tone: "info" },
  exploration: { label: "Sedang menjajaki", tone: "info" },
  ready_to_proceed: { label: "Siap lanjut", tone: "warn" },
  data_submitted: { label: "Data sudah dikirim", tone: "warn" },
  verification_in_progress: { label: "Sedang diverifikasi", tone: "warn" },
  verified: { label: "Sudah terverifikasi", tone: "good" },
  onboarding_or_activation: { label: "Proses aktivasi akun", tone: "good" },
  account_active: { label: "Akun aktif", tone: "good" },
  funded: { label: "Sudah setor dana", tone: "good" },
  active_support: { label: "Aktif, butuh dukungan", tone: "gold" },
};

export const PROCESS_DECISION: VocabTable = {
  observed: { label: "Terbaca dari chat", tone: "neutral" },
  applied: { label: "Diterapkan", tone: "good" },
  same_state_confirmed: { label: "Tahap yang sama dikonfirmasi", tone: "neutral" },
  rejected_regression: { label: "Ditolak: mundur dari tahap sebelumnya", tone: "warn" },
  rejected_low_confidence: { label: "Ditolak: Clara kurang yakin", tone: "warn" },
  rejected_insufficient_evidence: { label: "Ditolak: bukti kurang", tone: "warn" },
  requires_review: { label: "Perlu ditinjau", tone: "warn" },
  manual_correction: { label: "Dikoreksi manual", tone: "info" },
  merge_reconciliation_required: { label: "Perlu dicocokkan setelah penggabungan", tone: "danger" },
  merge_reconciled: { label: "Sudah dicocokkan setelah penggabungan", tone: "good" },
};

export const PROCESS_SOURCE: VocabTable = {
  automatic: { label: "Otomatis dari chat", tone: "neutral" },
  manual_forward: { label: "Diisi manual", tone: "neutral" },
  manual_correction: { label: "Koreksi manual", tone: "neutral" },
  system_confirmed: { label: "Dikonfirmasi sistem", tone: "neutral" },
  import_reconciliation: { label: "Impor data", tone: "neutral" },
  customer_merge_reconciliation: { label: "Penggabungan profil", tone: "neutral" },
  customer_profile_merge: { label: "Penggabungan profil", tone: "neutral" },
};

export const TRUST_LEVEL: VocabTable = {
  low: { label: "Rendah", tone: "warn" },
  medium: { label: "Sedang", tone: "neutral" },
  high: { label: "Tinggi", tone: "good" },
  authoritative: { label: "Pasti", tone: "good" },
};
