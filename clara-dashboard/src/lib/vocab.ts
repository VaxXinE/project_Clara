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
  [
    /jalankan ai analysis lagi agar next action dan draft ikut refresh\.?/gi,
    "Minta Clara membaca chat ini lagi, supaya langkah berikutnya dan jawabannya ikut diperbarui.",
  ],
  [/belum dibaca ulang oleh AI/gi, "belum dibaca ulang oleh Clara"],
  // Teks rekomendasi KPI dari backend memakai istilah Inggris. Aturan ini harus lebih dulu dari "delivery" dan "overdue".
  [/delivery rendah atau overdue tinggi/gi, "balasan terkirim sedikit atau banyak follow-up yang terlambat"],
  [/\bhealth\b/gi, "kondisi"],
  [/\borg ini\b/gi, "organisasi ini"],
  [/discipline log/gi, "catatan aktivitas harian"],
  [/next follow-up/gi, "follow-up berikutnya"],
  [/bottleneck/gi, "hambatan"],
  [/queue task/gi, "tindak lanjut"],
  [/action center/gi, "halaman Tindak Lanjut"],
  [/tahap pipeline/gi, "tahap"],
  [/stage lead/gi, "tahap lead"],
  [/conversation/gi, "percakapan"],
  [/disiplin crm/gi, "kerapian catatan lead"],
  [/kerapian crm/gi, "kerapian catatan lead"],
  [/(log|update) crm/gi, "catatan lead"],
  [/next action di crm/gi, "langkah berikutnya di catatan lead"],
  [/next action/gi, "langkah berikutnya"],
  [/follow-up overdue/gi, "follow-up yang terlambat"],
  [/overdue/gi, "terlambat"],
  [/score turun/gi, "nilai kinerja turun"],
  [/\bcrm\b/gi, "data lead"],
  [/approval queue/gi, "Chat perlu keputusan"],
  [/sudah stale/gi, "sudah lama"],
  [/\bstale\b/gi, "lama"],
  [/\blog\b/gi, "catatan"],
  [/boundary alert/gi, "peringatan tim"],
  [/(\d[\d.,]*) IDR/g, "Rp $1"],
  [/reply sent rate/gi, "tingkat balasan terkirim"],
  [/approved-ready-to-send/gi, "siap dikirim"],
  [/high-severity alert/gi, "alert penting"],
  [/won value/gi, "nilai closing"],
  [/pipeline value/gi, "nilai pipeline"],
  [/hot leads?/gi, "lead panas"],
  [/stage closing/gi, "tahap closing"],
  [/scale pola/gi, "tiru pola"],
  [/coaching targeted/gi, "pendampingan langsung"],
  [/quality reply/gi, "kualitas balasan"],
  [/angle marketing/gi, "pendekatan pemasaran"],
  [/kpi center/gi, "Dashboard Operasional"],
  [/inbox\/worklist/gi, "Chat Masuk dan Tindak Lanjut"],
  [/\bworklist\b/gi, "daftar Tindak Lanjut"],
  [/\binbox\b/gi, "Chat Masuk"],
  [/\borganization\b/gi, "organisasi"],
  [/\bbaseline\b/gi, "acuan"],
  [/\bdelivery\b/gi, "pengiriman"],
  [/\breply\b/gi, "balasan"],
  [/\bdraft\b/gi, "draf"],
  [/\bapproval\b/gi, "persetujuan"],
  [/\bobjections?\b/gi, "keberatan"],
  [/social proof/gi, "bukti sosial"],
  [/\bretargeting\b/gi, "menjangkau ulang audiens"],
  [/\bcreative\b/gi, "materi iklan"],
  [/\baudience\b/gi, "audiens"],
  [/\bwarm\b/gi, "hangat"],
  [/\bcold\b/gi, "dingin"],
  [/\bcontent brief\b/gi, "brief konten"],
  [/\bcontent\b/gi, "konten"],
  [/\bhigh-risk\b/gi, "berisiko tinggi"],
  [/\bhigh risk\b/gi, "berisiko tinggi"],
  [/\bleads\b/gi, "lead"],
  [/\bsales enablement\b/gi, "bekal untuk Sales"],
  [/\btrust-building\b/gi, "membangun kepercayaan"],
  [/\btrust layer\b/gi, "dasar kepercayaan"],
  [/\btrust\b/gi, "kepercayaan"],
  [/\btop funnel\b/gi, "tahap awal penjualan"],
  [/\bbroad test\b/gi, "uji audiens luas"],
  [/\bhype\b/gi, "bombastis"],
  [/\bengage\b/gi, "terlibat"],
  [/\breassuring\b/gi, "menenangkan"],
  [/\bempathetic\b/gi, "empatik"],
  [/\bprofessional\b/gi, "profesional"],
  [/\bplaybook\b/gi, "panduan"],
  [/\basset\b/gi, "bahan"],
  [/\bangle\b/gi, "pendekatan"],
  [/\bcautious\b/gi, "ragu-ragu"],
  [/\bintent\b/gi, "minat beli"],
  [/\bfunnel\b/gi, "alur penjualan"],
];

/** Label periode dari backend ("7d", "prev_7d", "prev_weekly") jadi kalimat. */
export function describeRangeLabel(label: string | null | undefined): string {
  const value = (label ?? "").trim();
  const match = /^(prev_)?(\d+)d$/.exec(value);

  if (match) {
    return match[1] ? `${match[2]} hari sebelumnya` : `${match[2]} hari terakhir`;
  }
  if (value === "prev_weekly") return "minggu sebelumnya";
  if (value === "weekly") return "minggu ini";

  return value || "-";
}

/** Label cakupan data dari backend jadi kata yang dipakai user. */
export function describeScopeLabel(label: string | null | undefined): string {
  switch ((label ?? "").trim()) {
    case "Scoped team or unit manager view":
      return "Timmu";
    case "Organization-wide manager view":
      return "Semua tim";
    case "No organization scope":
      return "Belum terhubung ke organisasi";
    default:
      return label?.trim() || "-";
  }
}

/**
 * Teks bebas dari backend kadang memakai istilah internal ("Discipline log belum diisi").
 * Ganti dengan istilah yang dipakai di layar, tanpa mengubah huruf kapital di awal kata.
 */
export function plainJargon(text: string | null | undefined): string {
  let result = text ?? "";

  for (const [pattern, replacement] of JARGON_REPLACEMENTS) {
    result = result.replace(pattern, (match) => {
      const replaced = match.replace(pattern, replacement);

      return match[0] === match[0].toUpperCase()
        ? replaced.charAt(0).toUpperCase() + replaced.slice(1)
        : replaced;
    });
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
  customer_named: { label: "Nama customer diperbarui", tone: "neutral" },
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

/** Kelompok antrean review untuk manager dan head. */
export const REVIEW_BUCKET: VocabTable = {
  needs_analysis: { label: "Belum dibaca Clara", tone: "warn", hint: "Chat belum dianalisis, jadi belum ada yang bisa direview." },
  needs_reply_suggestion: { label: "Belum ada draft jawaban", tone: "warn" },
  pending_approval: { label: "Menunggu keputusan", tone: "gold", hint: "Draft jawaban menunggu persetujuan." },
  draft_review: { label: "Draft siap ditinjau", tone: "gold" },
  human_escalation: { label: "Perlu keputusan manusia", tone: "danger", hint: "Topiknya terlalu sensitif untuk dilepas sendiri." },
  ready_to_send: { label: "Siap dikirim", tone: "good" },
  needs_rework: { label: "Perlu diperbaiki", tone: "warn", hint: "Draft sebelumnya kurang kuat dan perlu disusun ulang." },
};

export const REVIEW_NEXT_STEP: Record<string, { sales: string; head: string }> = {
  needs_analysis: {
    sales: "Minta Clara membaca chat ini dulu.",
    head: "Biarkan Clara membaca chat ini dulu sebelum diputuskan.",
  },
  needs_reply_suggestion: {
    sales: "Minta Clara menyusun draft jawaban, lalu tinjau hasilnya.",
    head: "Draft belum ada. Biasanya cukup diserahkan ke manager.",
  },
  needs_rework: {
    sales: "Susun ulang draft-nya, lalu tinjau lagi.",
    head: "Draft sebelumnya kurang kuat. Tanyakan ke manager apakah perlu dibantu.",
  },
  pending_approval: {
    sales: "Buka chat, cek apakah jawabannya aman dan tepat, lalu putuskan.",
    head: "Pastikan arah jawabannya aman dan konsisten sebelum diteruskan.",
  },
  draft_review: {
    sales: "Buka chat dan tinjau draft jawabannya.",
    head: "Draft sudah ada. Nilai apakah mutunya cukup untuk dilanjutkan.",
  },
  human_escalation: {
    sales: "Buka chat dan putuskan arahan untuk Sales ini.",
    head: "Buka kasusnya dan putuskan: cukup diarahkan ke manager atau perlu langkah lebih tegas.",
  },
  ready_to_send: {
    sales: "Sudah aman. Cukup validasi akhir kalau mau menjaga kualitas.",
    head: "Relatif aman. Pastikan tidak ada pola risiko yang terlewat.",
  },
};

export const PRIORITY: VocabTable = {
  urgent: { label: "Sangat mendesak", tone: "danger" },
  high: { label: "Mendesak", tone: "warn" },
  normal: { label: "Biasa", tone: "neutral" },
  low: { label: "Santai", tone: "neutral" },
  medium: { label: "Sedang", tone: "warn" },
  stable: { label: "Stabil", tone: "good" },
  tinggi: { label: "Tinggi", tone: "danger" },
  sedang: { label: "Sedang", tone: "warn" },
  rendah: { label: "Rendah", tone: "neutral" },
};

export const MOMENTUM: VocabTable = {
  improving: { label: "Membaik", tone: "good" },
  stable: { label: "Stabil", tone: "neutral" },
  declining: { label: "Menurun", tone: "danger" },
};

export const SLA_STATUS: VocabTable = {
  healthy: { label: "Balasan cepat", tone: "good", hint: "Rata-rata waktu membalas masih dalam batas." },
  warning: { label: "Balasan mulai lambat", tone: "warn" },
  critical: { label: "Balasan terlalu lambat", tone: "danger" },
};

export const CRM_DISCIPLINE: VocabTable = {
  disciplined: { label: "Catatan rapi", tone: "good" },
  needs_attention: { label: "Catatan perlu dirapikan", tone: "warn" },
};

export const SCORE_LABEL: VocabTable = {
  excellent: { label: "Sangat baik", tone: "good" },
  good: { label: "Baik", tone: "good" },
  stable: { label: "Cukup", tone: "neutral" },
  needs_attention: { label: "Perlu perhatian", tone: "warn" },
  critical: { label: "Kritis", tone: "danger" },
};

export const FOCUS_AREA: VocabTable = {
  reply_backlog: { label: "Chat belum dibalas", tone: "neutral" },
  follow_up: { label: "Follow-up", tone: "neutral" },
  discipline: { label: "Kerapian catatan", tone: "neutral" },
  analysis: { label: "Chat belum dibaca Clara", tone: "neutral" },
  conversion: { label: "Menuju closing", tone: "neutral" },
};

export const ACTION_STATUS: VocabTable = {
  open: { label: "Belum dimulai", tone: "warn" },
  in_progress: { label: "Sedang dikerjakan", tone: "info" },
  done: { label: "Selesai", tone: "good" },
  skipped: { label: "Dilewati", tone: "neutral" },
};

export const ACTION_TYPE: VocabTable = {
  coaching: { label: "Pembinaan", tone: "neutral" },
  follow_up_recovery: { label: "Kejar follow-up yang tertinggal", tone: "neutral" },
  reply_backlog_review: { label: "Bereskan chat yang belum dibalas", tone: "neutral" },
  crm_cleanup: { label: "Rapikan catatan lead", tone: "neutral" },
  weekly_review: { label: "Review mingguan", tone: "neutral" },
};

export const REVIEW_STATUS: VocabTable = {
  draft: { label: "Draf kasus", tone: "neutral" },
  in_review: { label: "Sedang ditinjau", tone: "info" },
  needs_rework: { label: "Perlu diperbaiki", tone: "warn" },
  coaching_done: { label: "Pembinaan selesai", tone: "good" },
  escalated: { label: "Dieskalasi", tone: "danger" },
};

export const ALERT_SEVERITY: VocabTable = {
  high: { label: "Penting", tone: "danger" },
  medium: { label: "Perlu dicek", tone: "warn" },
  low: { label: "Info", tone: "neutral" },
  critical: { label: "Kritis", tone: "danger" },
  warning: { label: "Perlu dicek", tone: "warn" },
  info: { label: "Info", tone: "neutral" },
};

export const PERFORMANCE_SOURCE: VocabTable = {
  sales_performance: { label: "Dari performa Sales", tone: "neutral" },
  team_performance: { label: "Dari performa tim", tone: "neutral" },
  weekly_review: { label: "Dari review mingguan", tone: "neutral" },
  manual: { label: "Dibuat manual", tone: "neutral" },
};

/** Perubahan angka dibanding periode lalu, dalam kata. `lowerIsBetter` untuk beban kerja seperti backlog. */
export function describeDelta(value: number, lowerIsBetter = false): { text: string; tone: Tone } {
  if (value === 0) {
    return { text: "tidak berubah", tone: "neutral" };
  }

  const better = lowerIsBetter ? value < 0 : value > 0;

  return {
    text: `${value > 0 ? "naik" : "turun"} ${Math.abs(value)}`,
    tone: better ? "good" : "warn",
  };
}

export const ALERT_STATUS: VocabTable = {
  active: { label: "Baru", tone: "warn", hint: "Belum ada yang menanganinya." },
  acknowledged: { label: "Sudah dibaca", tone: "info" },
  resolved: { label: "Selesai", tone: "good" },
  ignored: { label: "Diabaikan", tone: "neutral" },
};

export const TABLE_COUNT_LABEL: Record<string, string> = {
  organizations: "Organisasi",
  users: "Pengguna",
  conversations: "Percakapan",
  ai_extractions: "Hasil baca Clara",
  reply_suggestions: "Saran balasan",
  sent_messages: "Balasan terkirim",
  product_knowledge: "Pengetahuan produk",
  audit_logs: "Catatan aktivitas",
  marketing_snapshots: "Catatan insight pasar",
};

const AUDIT_RESOURCE: Record<string, string> = {
  auth: "akun",
  user: "pengguna",
  conversation: "percakapan",
  ops_notification: "alert",
  kpi_alert: "alert KPI",
  kpi_command_center: "Dashboard Operasional",
  reply_suggestion: "saran balasan",
  organization: "organisasi",
  customer_profile: "profil customer",
  customer_process_state: "tahap customer",
  chat_review_case: "kasus review",
  product_knowledge: "pengetahuan produk",
  product_fact: "fakta produk",
  marketing_execution_item: "kegiatan pemasaran",
  marketing_insight_snapshot: "insight pasar",
  ai_persona_bundle: "persona AI",
  ai_persona_config: "persona AI",
  extension: "ekstensi",
  extension_build: "berkas ekstensi",
  sales_structure: "struktur tim",
  integration: "integrasi",
  webhook: "chat masuk otomatis",
};

const AUDIT_ACTION_TEXT: Record<string, string> = {
  "auth.login": "Masuk ke Clara",
  "auth.access_token.issue": "Ekstensi diberi akses sementara",
  "auth.user.create": "Menambah pengguna",
  "auth.user.update": "Mengubah data pengguna",
  "auth.user.activate": "Mengaktifkan pengguna",
  "auth.user.deactivate": "Menonaktifkan pengguna",
  "auth.user.delete": "Menghapus pengguna",
  "auth.user.reset_password": "Mengatur ulang kata sandi pengguna",
  "auth.user.change_password_self": "Mengganti kata sandi sendiri",
  "auth.user.update_self": "Mengubah profil sendiri",
  "ops_notification.acknowledge": "Menandai alert sudah dibaca",
  "ops_notification.resolve": "Menandai alert selesai",
  "ops_notification.ignore": "Mengabaikan alert",
  "ops_notification.reopen": "Membuka lagi alert",
  "ops_notification.escalate": "Menaikkan alert ke atasan",
  "kpi_alert.acknowledge": "Menandai alert KPI sudah dibaca",
  "kpi_alert.resolve": "Menandai alert KPI selesai",
  "kpi_alert.reopen": "Membuka lagi alert KPI",
  "kpi_command_center.refresh": "Memperbarui data Dashboard Operasional",
  "conversation.upload_whatsapp_text": "Menambah chat WhatsApp (tempel teks)",
  "conversation.upload_whatsapp_txt": "Menambah chat WhatsApp (berkas)",
  "conversation.upload_telegram_text": "Menambah chat Telegram (tempel teks)",
  "conversation.upload_telegram_txt": "Menambah chat Telegram (berkas)",
  "reply_suggestion.generate": "Meminta Clara menyusun saran balasan",
  "reply_suggestion.generate_failed": "Saran balasan gagal disusun",
  "reply_suggestion.approve": "Menyetujui saran balasan",
  "reply_suggestion.reject": "Menolak saran balasan",
  "reply_suggestion.mark_sent": "Menandai balasan sudah terkirim",
  "extension.reply.inserted": "Balasan dimasukkan ke kolom chat",
  "extension.manual_reply.sent_synced": "Balasan manual tersinkron dari ekstensi",
  "extension_build.upload": "Mengunggah berkas ekstensi baru",
  "customer_name.update": "Memberi nama customer",
  "extension_build.download": "Mengunduh berkas ekstensi",
  "customer_profile.update": "Mengubah profil customer",
  "customer_profile.merge": "Menggabungkan profil customer",
  "customer_process_state.transition": "Memindahkan tahap customer",
  "chat_review_case.upsert": "Menyimpan keputusan review",
  "chat_review_case.note.create": "Menambah catatan review",
  "product_knowledge.create": "Menambah pengetahuan produk",
  "product_knowledge.update": "Mengubah pengetahuan produk",
  "product_knowledge.deactivate": "Menonaktifkan pengetahuan produk",
  "organization.create": "Menambah organisasi",
  "organization.update": "Mengubah organisasi",
  "marketing_insight_snapshot.generate": "Memperbarui insight pasar",
  "ai_persona_bundle.publish": "Menerbitkan persona AI",
  "ai_persona_bundle.rollback": "Mengembalikan persona AI ke versi sebelumnya",
  "ai_persona_config.publish": "Menerbitkan persona AI",
  "ai_persona_config.rollback": "Mengembalikan persona AI ke versi sebelumnya",
};

const AUDIT_VERB: Record<string, string> = {
  create: "Menambah",
  update: "Mengubah",
  delete: "Menghapus",
  upsert: "Menyimpan",
  publish: "Menerbitkan",
  rollback: "Mengembalikan",
  approve: "Menyetujui",
  reject: "Menolak",
  generate: "Menyusun",
  ingest: "Menerima",
  validate: "Memeriksa",
};

/** Kode aksi audit ("ops_notification.resolve") jadi kalimat yang bisa dibaca. */
export function describeAuditAction(action: string | null | undefined): string {
  const key = (action ?? "").trim();

  if (!key) {
    return "Aktivitas tidak dikenal";
  }
  if (AUDIT_ACTION_TEXT[key]) {
    return AUDIT_ACTION_TEXT[key];
  }

  const [resource, ...rest] = key.split(".");
  const verb = AUDIT_VERB[rest[rest.length - 1] ?? ""];
  const noun = AUDIT_RESOURCE[resource];

  if (verb && noun) {
    return `${verb} ${noun}`;
  }

  return noun ? `Aktivitas pada ${noun}` : "Aktivitas sistem";
}

export const SNAPSHOT_SCOPE: VocabTable = {
  global: { label: "Semua organisasi", tone: "neutral" },
  organization: { label: "Satu organisasi", tone: "neutral" },
};

const SOURCE_LABEL: Record<string, string> = {
  whatsapp_extension: "Ekstensi WhatsApp",
  whatsapp_webhook: "WhatsApp otomatis",
  whatsapp_txt: "Berkas chat WhatsApp",
  telegram_txt: "Berkas chat Telegram",
  telegram_extension: "Ekstensi Telegram",
  telegram_manual: "Input manual Telegram",
  instagram_extension: "Ekstensi Instagram DM",
  instagram_dm: "Instagram DM",
  instagram_comment: "Komentar Instagram",
  tiktok_extension: "Ekstensi TikTok DM",
  website_live_chat: "Live chat website",
  email_inbox: "Email masuk",
  csv_import: "Impor berkas CSV",
  unknown: "Sumber tidak diketahui",
};

/** Kunci sumber dari backend ("whatsapp_txt") jadi nama yang dipakai user. */
export function describeSource(key: string | null | undefined, fallback?: string | null): string {
  const normalized = (key ?? "").trim().toLowerCase().replace(/ /g, "_");

  return SOURCE_LABEL[normalized] ?? (fallback?.trim() || normalized.replaceAll("_", " ") || "Sumber tidak diketahui");
}

export const CHANNEL_DESCRIPTION: Record<string, string> = {
  whatsapp: "Chat WhatsApp masuk lewat Ekstensi Clara, berkas chat, atau tempel teks.",
  telegram: "Chat Telegram masuk lewat berkas chat atau tempel teks.",
  live_chat: "Percakapan live chat dari website kamu, diterima otomatis.",
};

export const EXECUTION_STATUS: VocabTable = {
  draft: { label: "Draf", tone: "neutral" },
  assigned: { label: "Sudah ditugaskan", tone: "info" },
  in_progress: { label: "Sedang dikerjakan", tone: "warn" },
  done: { label: "Selesai", tone: "good" },
};

export const EXECUTION_TYPE: VocabTable = {
  content_brief: { label: "Brief konten", tone: "info" },
  ads_signal: { label: "Saran iklan", tone: "gold" },
};

const CONTENT_FORMAT: Record<string, string> = {
  carousel_instagram: "Carousel Instagram",
  video_testimonial: "Video testimoni",
  internal_sales_enablement: "Bahan internal untuk Sales",
  short_video_or_carousel: "Video pendek atau carousel",
  testimonial_video: "Video testimoni",
  faq_landing_snippet: "Ringkasan FAQ di halaman web",
  faq_reels_or_landing_snippet: "Reels FAQ atau ringkasan di halaman web",
  carousel_and_short_video: "Carousel dan video pendek",
  best_angle_recut: "Potong ulang dari pendekatan terbaik",
};

/** Format konten dari backend ("carousel instagram") jadi nama yang enak dibaca. */
export function describeContentFormat(value: string | null | undefined): string {
  const key = (value ?? "").trim().toLowerCase().replace(/[ /]+/g, "_");

  return CONTENT_FORMAT[key] ?? plainJargon((value ?? "").replaceAll("_", " "));
}

const KNOWLEDGE_SOURCE: Record<string, string> = {
  manual_note: "Catatan manual",
  coaching_review: "Hasil review chat",
  imported_document: "Dokumen impor",
  markdown: "Berkas bawaan",
  manual: "Input manual",
  manual_verified: "Dicek manual oleh tim",
  approved_repository_source: "Sumber resmi perusahaan",
};

/** Jenis sumber pengetahuan ("manual_note") jadi nama yang bisa dibaca. */
export function describeKnowledgeSource(value: string | null | undefined): string {
  const key = (value ?? "").trim();

  return KNOWLEDGE_SOURCE[key] ?? (key.replaceAll("_", " ") || "-");
}

/** Cakupan data ("global" atau "organization") dalam kata sehari-hari. */
export function describeKnowledgeScope(value: string | null | undefined): string {
  return value === "global" ? "Semua organisasi" : value === "organization" ? "Organisasi ini" : (value ?? "-");
}

export const FACT_KEY_LABEL: Record<string, string> = {
  "account.minimum_opening_amount": "Setoran minimal buka akun",
  "account.minimum_lot": "Lot minimal",
  "account.eligible_products": "Produk yang bisa dipakai",
  "account.currency": "Mata uang akun",
  "trading.spread": "Spread",
  "trading.commission": "Komisi",
  "trading.margin": "Margin",
  "trading.swap": "Swap",
  "trading.rollover": "Rollover",
  "trading.storage_fee": "Biaya penyimpanan",
  "trading.overnight_requirement": "Syarat posisi semalam",
  "trading.instruments": "Instrumen yang tersedia",
  "company.regulatory_status": "Status pengawasan perusahaan",
  "company.regulator": "Regulator",
  "company.license_reference": "Nomor izin",
  "process.initial_data": "Data awal yang diminta",
  "process.kyc_requirements": "Syarat verifikasi identitas",
  "process.verification_steps": "Langkah verifikasi",
  "process.activation_steps": "Langkah aktivasi akun",
  "process.funding_steps": "Langkah setor dana",
  "process.withdrawal_steps": "Langkah tarik dana",
  "promotion.current_terms": "Syarat promo saat ini",
};

/** Kunci fakta ("account.minimum_lot") jadi nama yang bisa dibaca. */
export function describeFactKey(key: string | null | undefined): string {
  const value = (key ?? "").trim();

  return FACT_KEY_LABEL[value] ?? (value.replaceAll(".", " ").replaceAll("_", " ") || "-");
}

export const FACT_LIFECYCLE: VocabTable = {
  draft: { label: "Draf", tone: "neutral", hint: "Belum dipakai Clara." },
  approved: { label: "Disetujui", tone: "info", hint: "Sudah disetujui, belum diaktifkan." },
  active: { label: "Dipakai Clara", tone: "good" },
  expired: { label: "Kedaluwarsa", tone: "warn" },
  revoked: { label: "Dinonaktifkan", tone: "danger" },
};

export const FACT_FRESHNESS: VocabTable = {
  fresh: { label: "Masih baru", tone: "good" },
  stale: { label: "Perlu dicek ulang", tone: "warn" },
  unverified: { label: "Belum diverifikasi", tone: "neutral" },
};

export const FACT_VOLATILITY: Record<string, string> = {
  HIGH_VOLATILITY: "Sering berubah",
  MEDIUM_VOLATILITY: "Kadang berubah",
  LOW_VOLATILITY: "Jarang berubah",
};

export const FACT_VALUE_TYPE: Record<string, string> = {
  text: "Teks",
  integer: "Angka bulat",
  decimal: "Angka desimal",
  boolean: "Ya / Tidak",
  date: "Tanggal",
  json: "Data terstruktur (JSON)",
};

export const FACT_SCOPE: Record<string, string> = {
  global: "Semua jenis akun",
  mini: "Akun Mini",
  regular: "Akun Reguler",
};

export const SUPPORT_TOPIC: Record<string, string> = {
  GENERAL_NAVIGATION: "Panduan umum",
  OFFICIAL_CHANNEL: "Kanal resmi",
  ACCOUNT_ACCESS_GENERAL: "Akses akun",
  LOGIN_GENERAL: "Masuk (login)",
  PASSWORD_SAFETY: "Keamanan kata sandi",
  REGISTRATION_GENERAL: "Pendaftaran",
  DOCUMENT_PREPARATION_GENERAL: "Menyiapkan dokumen",
  VERIFICATION_GENERAL: "Verifikasi",
  ACTIVATION_GENERAL: "Aktivasi akun",
  FUNDING_GENERAL: "Setor dana",
  WITHDRAWAL_GENERAL: "Tarik dana",
  PLATFORM_GENERAL: "Platform trading",
  ERROR_MESSAGE_GENERAL: "Pesan error",
  POST_ACTIVATION_GENERAL: "Setelah akun aktif",
  STATUS_REQUEST: "Tanya status",
  SECURITY_CONCERN: "Kekhawatiran keamanan",
};

export function describeSupportTopic(value: string | null | undefined): string {
  const key = (value ?? "").trim();

  return SUPPORT_TOPIC[key] ?? key.replaceAll("_", " ").toLowerCase();
}

export const SUPPORT_LEVEL: VocabTable = {
  level_0: { label: "Clara jawab sendiri", tone: "good", hint: "Aman dijawab Clara tanpa bantuan manusia." },
  level_1: { label: "Clara jawab, Sales cek", tone: "warn", hint: "Clara menyusun jawaban, Sales yang memastikan." },
  human_required: { label: "Harus manusia", tone: "danger", hint: "Hanya boleh dijawab manusia." },
};

export const SUPPORT_RISK: VocabTable = {
  low: { label: "Risiko rendah", tone: "good" },
  medium: { label: "Risiko sedang", tone: "warn" },
  high: { label: "Risiko tinggi", tone: "danger" },
};

export const ARTICLE_LIFECYCLE: VocabTable = {
  draft: { label: "Draf", tone: "neutral", hint: "Belum dipakai Clara." },
  approved: { label: "Disetujui", tone: "info", hint: "Sudah disetujui, belum diaktifkan." },
  active: { label: "Dipakai Clara", tone: "good" },
  retired: { label: "Dihentikan", tone: "danger" },
};
