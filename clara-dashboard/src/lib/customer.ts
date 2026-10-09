/**
 * Nomor WhatsApp yang belum disimpan datang sebagai judul chat berupa nomor telepon. Nomor seperti itu
 * ditampilkan rapi dan diberi tanda "belum disimpan", supaya Sales tahu perlu memberi nama.
 * Aturannya sama dengan backend (customer_naming.py).
 */

const PHONE_TEXT = /^\+?[\d\s().-]{7,24}$/;
const MIN_PHONE_DIGITS = 8;
const MAX_PHONE_DIGITS = 15;

export function normalizePhoneNumber(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  if (!text) {
    return null;
  }

  const digits = text.replace(/\D/g, "");
  if (digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) {
    return null;
  }

  if (text.startsWith("+")) {
    return `+${digits}`;
  }
  if (digits.startsWith("0")) {
    return `+62${digits.slice(1)}`;
  }
  return `+${digits}`;
}

export function looksLikePhoneNumber(value: string | null | undefined): boolean {
  const text = (value ?? "").trim();
  return PHONE_TEXT.test(text) && normalizePhoneNumber(text) !== null;
}

/** "+6282110957104" jadi "+62 821-1095-7104". Nomor non-Indonesia ditampilkan apa adanya dengan awalan +. */
export function formatPhoneNumber(value: string): string {
  const normalized = normalizePhoneNumber(value);
  if (!normalized) {
    return value;
  }

  if (normalized.startsWith("+62")) {
    const rest = normalized.slice(3);
    if (rest.length >= 9) {
      return `+62 ${rest.slice(0, 3)}-${rest.slice(3, 7)}-${rest.slice(7)}`;
    }
  }
  return normalized;
}

export type CustomerLabel = {
  /** Teks yang ditampilkan: nama customer, atau nomor yang sudah dirapikan. */
  text: string;
  /** True kalau customer belum punya nama dan hanya ada nomornya. */
  isUnsavedNumber: boolean;
};

export function customerLabel(title: string | null | undefined): CustomerLabel {
  const value = (title ?? "").trim();

  if (looksLikePhoneNumber(value)) {
    return { text: formatPhoneNumber(value), isUnsavedNumber: true };
  }
  return { text: value || "Customer tanpa nama", isUnsavedNumber: false };
}
