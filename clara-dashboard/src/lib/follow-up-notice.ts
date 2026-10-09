const STORAGE_KEY = "clara.follow-up-notice.v1";
const MAX_AGE_MS = 10 * 60 * 1000;

/** Simpan kabar singkat untuk ditampilkan di halaman Tindak Lanjut, misalnya setelah catatan harian diisi. */
export function rememberFollowUpNotice(text: string) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ text, at: Date.now() }));
  } catch {
    // Tanpa penyimpanan browser, halaman Tindak Lanjut cukup tidak menampilkan kabar ini.
  }
}

/** Ambil kabar itu satu kali. Kabar yang sudah lewat 10 menit dibuang supaya tidak membingungkan. */
export function takeFollowUpNotice(): string | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    window.sessionStorage.removeItem(STORAGE_KEY);
    const parsed = JSON.parse(raw) as { text?: unknown; at?: unknown };

    if (typeof parsed.text !== "string" || typeof parsed.at !== "number" || Date.now() - parsed.at > MAX_AGE_MS) {
      return null;
    }

    return parsed.text;
  } catch {
    return null;
  }
}
