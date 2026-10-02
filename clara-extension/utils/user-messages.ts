export type MessageContext = "snapshot" | "suggest"

const NETWORK_PATTERN =
  /failed to fetch|networkerror|load failed|network request failed|econnrefused|err_connection/i
const EMPTY_SNAPSHOT_PATTERN =
  /snapshot messages cannot be empty|messages? (?:list )?(?:is|are|cannot be) empty/i
const AI_PROVIDER_PATTERN =
  /openai|api[_ ]?key|authenticationerror|invalid_api_key|insufficient_quota|rate limit|quota/i
const SESSION_PATTERN =
  /not authenticated|unauthorized|token expired|invalid token|\b401\b/i
const CONFIG_PATTERN =
  /PLASMO_PUBLIC|belum dikonfigurasi|belum diisi|fallback proxy/i
const FORBIDDEN_PATTERN = /forbidden|\b403\b/i
const SERVER_PATTERN =
  /internal server error|unexpected .*error|bad gateway|service unavailable|\b5\d\d\b/i
const URL_PATTERN = /https?:\/\//i
const INDONESIAN_HINT =
  /\b(belum|tidak|harus|wajib|gagal|sudah|silakan|buka|pilih|chat|percakapan|kamu|coba)\b/i

const RETRY_ACTION: Record<MessageContext, string> = {
  snapshot: "klik Baca Ulang Chat",
  suggest: "klik Buat Jawaban lagi"
}

const GENERIC_MESSAGE: Record<MessageContext, string> = {
  snapshot: "Chat belum bisa disimpan ke Clara. Coba lagi beberapa saat.",
  suggest: "Jawaban belum bisa dibuat. Coba lagi beberapa saat."
}

/**
 * Mengubah pesan teknis (error jaringan, error backend berbahasa Inggris, nama variabel
 * environment, URL, potongan API key) menjadi kalimat yang bisa dipahami sales dan memberi
 * langkah berikutnya. Pesan yang sudah ramah (Bahasa Indonesia tanpa URL) dibiarkan.
 */
export const toUserMessage = (
  rawMessage: string | null | undefined,
  context: MessageContext
): string => {
  const raw = (rawMessage || "").trim()

  if (!raw) {
    return GENERIC_MESSAGE[context]
  }

  if (NETWORK_PATTERN.test(raw)) {
    return `Tidak bisa terhubung ke Clara. Pastikan internet aktif dan kamu masih login di dashboard Clara, lalu ${RETRY_ACTION[context]}.`
  }

  if (EMPTY_SNAPSHOT_PATTERN.test(raw)) {
    return "Belum ada pesan teks yang bisa dibaca dari chat ini. Buka chat yang berisi teks, gulir ke atas sebentar, lalu klik Buat Jawaban."
  }

  if (AI_PROVIDER_PATTERN.test(raw)) {
    return "Layanan AI Clara sedang bermasalah, jadi jawaban belum bisa dibuat. Coba lagi beberapa saat. Kalau berulang, hubungi admin."
  }

  if (SESSION_PATTERN.test(raw)) {
    return `Sesi login kamu berakhir. Login lagi di dashboard Clara, lalu ${RETRY_ACTION[context]}.`
  }

  if (CONFIG_PATTERN.test(raw)) {
    return "Extension belum terhubung ke server Clara. Hubungi admin untuk memperbarui extension."
  }

  if (FORBIDDEN_PATTERN.test(raw)) {
    return "Akun kamu belum punya akses untuk fitur ini. Hubungi admin kalau kamu memerlukannya."
  }

  if (SERVER_PATTERN.test(raw)) {
    return "Clara sedang bermasalah di sisi server. Coba lagi beberapa saat. Kalau berulang, hubungi admin."
  }

  if (!URL_PATTERN.test(raw) && INDONESIAN_HINT.test(raw)) {
    return raw
  }

  return GENERIC_MESSAGE[context]
}
