const API_BASE_URL = "/api";
const CSRF_COOKIE_NAME =
  process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME ?? "clara_csrf_token";
const BACKEND_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
};

function buildRequestBody(body: unknown): BodyInit | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (typeof FormData !== "undefined" && body instanceof FormData) {
    return body;
  }

  return JSON.stringify(body);
}

function getCookieValue(name: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const cookies = document.cookie.split(";").map((cookie) => cookie.trim());
  const target = cookies.find((cookie) => cookie.startsWith(`${name}=`));

  if (!target) {
    return null;
  }

  return decodeURIComponent(target.slice(name.length + 1));
}

function isUnsafeMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(message: string, status: number, detail = "") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

const NETWORK_ERROR_MESSAGE =
  "Tidak bisa terhubung ke Clara. Cek koneksi internet kamu, lalu coba lagi. Kalau masih gagal, hubungi admin.";
const SERVER_ERROR_MESSAGE =
  "Clara sedang bermasalah di sisi server. Coba lagi beberapa saat. Kalau berulang, hubungi admin.";
const UNREACHABLE_MESSAGE =
  "Clara belum bisa dijangkau. Coba lagi beberapa saat. Kalau berulang, hubungi admin.";

const KNOWN_DETAIL_TRANSLATIONS: Record<string, string> = {
  "user not found.": "Pengguna tidak ditemukan.",
  "conversation not found.": "Percakapan tidak ditemukan.",
  "chat text cannot be empty.": "Isi chat tidak boleh kosong.",
  "only .txt files are allowed.": "Hanya file .txt yang bisa diunggah.",
  "file too large. maximum size is 5mb.":
    "Ukuran file terlalu besar. Maksimal 5MB.",
  "file must be utf-8 encoded text.":
    "File harus berupa teks UTF-8. Simpan ulang file chat dalam format UTF-8.",
  "text too large. maximum size is 5mb.":
    "Teks terlalu panjang. Maksimal 5MB.",
  "you cannot delete your own account.":
    "Kamu tidak bisa menghapus akunmu sendiri.",
  "you cannot deactivate your own account.":
    "Kamu tidak bisa menonaktifkan akunmu sendiri.",
  "you cannot change your own role.":
    "Kamu tidak bisa mengubah role akunmu sendiri.",
  "head has no organization assigned.":
    "Akun ini belum terhubung ke organisasi. Hubungi admin.",
  "user has no organization assigned.":
    "Akun ini belum terhubung ke organisasi. Hubungi admin.",
  "organization scope is required.": "Pilih organisasi terlebih dahulu.",
  "invalid user id.": "ID pengguna tidak valid.",
  "user with this email already exists.":
    "Email ini sudah terdaftar untuk pengguna lain.",
  "too many login attempts. please try again later.":
    "Terlalu banyak percobaan masuk. Tunggu beberapa menit lalu coba lagi.",
  "snapshot messages cannot be empty.":
    "Belum ada pesan yang bisa dibaca dari chat ini.",
  "current password is incorrect.": "Password saat ini salah.",
  "assigned user is invalid or inactive.":
    "Pengguna yang dipilih tidak valid atau sedang nonaktif.",
  "assigned user must belong to the same organization.":
    "Pengguna yang dipilih harus berasal dari organisasi yang sama.",
  "effective-until must be after effective-from.":
    "Tanggal berakhir harus setelah tanggal mulai.",
  "conversation has no messages.": "Percakapan ini belum punya pesan.",
  "conversation is not available.": "Percakapan ini tidak tersedia.",
  "expired effective period cannot be activated.":
    "Periode berlaku yang sudah lewat tidak bisa diaktifkan.",
  "conflicting active support article exists.":
    "Sudah ada artikel aktif untuk topik ini. Nonaktifkan yang lama dulu.",
  "blocked suggestion cannot be approved.":
    "Draft ini diblokir sistem dan tidak bisa disetujui.",
  "blocked suggestion cannot be sent.":
    "Draft ini diblokir sistem dan tidak bisa ditandai terkirim.",
};

const AI_UNAVAILABLE_MESSAGE =
  "Clara belum bisa membantu saat ini. Coba lagi sebentar lagi. Kalau masih gagal, hubungi admin.";

/** Jalur yang memanggil AI. Kegagalannya hampir selalu karena layanan AI, bukan isian user. */
function isAiRequest(path: string): boolean {
  return /\/(analyze|reply-suggestions|ai)(\/|\?|$)/.test(path);
}

/** Nama variabel environment, kelas error, atau URL tidak boleh sampai ke layar user. */
function looksInternal(detail: string): boolean {
  return /\b[A-Z][A-Z0-9]*(_[A-Z0-9]+)+\b|https?:\/\/|Traceback|Exception|[{}<>]/.test(detail);
}

const INDONESIAN_HINT =
  /\b(belum|tidak|harus|wajib|terlalu|maksimum|maksimal|gagal|sudah|silakan|tersedia|ditemukan|mohon|akun|anda|kamu)\b/i;

function isLoginRequest(path: string): boolean {
  return path.startsWith("/auth/login");
}

function describeInvalidFields(detail: unknown): string {
  if (!Array.isArray(detail)) {
    return "";
  }

  const fields = detail
    .map((item) => {
      if (item && typeof item === "object" && Array.isArray(item.loc)) {
        const last = item.loc[item.loc.length - 1];
        return typeof last === "string" ? last.replaceAll("_", " ") : "";
      }
      return "";
    })
    .filter(Boolean);

  return Array.from(new Set(fields)).join(", ");
}

function toFriendlyMessage(
  status: number,
  path: string,
  rawDetail: string,
  invalidFields: string,
): string {
  if (status === 401) {
    if (isLoginRequest(path)) {
      return /nonaktif|inactive|deactivated/i.test(rawDetail)
        ? "Akun ini sedang nonaktif. Hubungi admin tim kamu."
        : "Email atau password salah. Periksa lagi lalu coba masuk kembali.";
    }
    return "Sesi kamu sudah berakhir. Silakan masuk lagi.";
  }

  if (status === 403) {
    return "Kamu tidak punya akses untuk melakukan ini. Hubungi admin kalau kamu memerlukannya.";
  }

  if (status === 429) {
    return (
      KNOWN_DETAIL_TRANSLATIONS[rawDetail.trim().toLowerCase()] ??
      "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi."
    );
  }

  if (status === 413) {
    return "Ukuran data terlalu besar. Kecilkan ukurannya lalu coba lagi.";
  }

  if (status === 409) {
    return "Data ini baru saja diubah. Muat ulang halaman lalu coba lagi.";
  }

  if (status === 422 && isLoginRequest(path)) {
    return "Email atau password salah. Periksa lagi lalu coba masuk kembali.";
  }

  if (status === 422 && invalidFields) {
    return `Ada isian yang belum benar: ${invalidFields}. Periksa lalu coba lagi.`;
  }

  if (isAiRequest(path) && status >= 400) {
    return AI_UNAVAILABLE_MESSAGE;
  }

  if (status >= 500) {
    return SERVER_ERROR_MESSAGE;
  }

  const translated = KNOWN_DETAIL_TRANSLATIONS[rawDetail.trim().toLowerCase()];
  if (translated) {
    return translated;
  }

  if (status === 404) {
    return "Data yang dicari tidak ditemukan. Mungkin sudah dihapus atau dipindahkan.";
  }

  if (rawDetail && INDONESIAN_HINT.test(rawDetail) && !looksInternal(rawDetail)) {
    return rawDetail;
  }

  // Detail berbahasa Inggris dari backend tidak ditampilkan: tidak membantu dan bisa membocorkan internal.
  return "Permintaan belum bisa diproses. Periksa data yang dikirim lalu coba lagi. Kalau berulang, hubungi admin.";
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const method = options.method ?? "GET";
  const requestBody = buildRequestBody(options.body);
  const isFormData =
    typeof FormData !== "undefined" && requestBody instanceof FormData;

  const headers: Record<string, string> = {};

  if (requestBody !== undefined && !isFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (isUnsafeMethod(method)) {
    const csrfToken = getCookieValue(CSRF_COOKIE_NAME);
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: requestBody,
      cache: "no-store",
      credentials: "include",
    });
  } catch (networkError) {
    console.warn(
      `[apiFetch] ${method} ${path} gagal terhubung ke ${BACKEND_BASE_URL}`,
      networkError,
    );
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0, "network_error");
  }

  if (!response.ok) {
    let rawDetail = "";
    let invalidFields = "";
    let responseText = "";

    try {
      responseText = await response.text();
    } catch {
      // Body unreadable; fall back to status-based message.
    }

    try {
      const detail = responseText ? JSON.parse(responseText)?.detail : undefined;
      if (typeof detail === "string") {
        rawDetail = detail;
      } else if (Array.isArray(detail)) {
        invalidFields = describeInvalidFields(detail);
        rawDetail = detail
          .map((item) =>
            typeof item === "string" ? item : JSON.stringify(item),
          )
          .join(" | ");
      } else if (detail && typeof detail === "object") {
        rawDetail = JSON.stringify(detail);
      }
    } catch {
      // Not JSON (for example a proxy error page); responseText is still used below.
    }

    let message = toFriendlyMessage(
      response.status,
      path,
      rawDetail,
      invalidFields,
    );

    if (response.status >= 500 && !rawDetail) {
      const lowerText = responseText.toLowerCase();
      if (
        lowerText.includes("failed to proxy") ||
        lowerText.includes("aggregateerror") ||
        lowerText.includes("econnrefused") ||
        lowerText.includes("econnreset") ||
        lowerText.includes("socket hang up")
      ) {
        console.warn(
          `[apiFetch] backend tidak bisa dijangkau di ${BACKEND_BASE_URL}`,
        );
        message = UNREACHABLE_MESSAGE;
      }
    }

    if (
      response.status === 401 &&
      !isLoginRequest(path) &&
      typeof window !== "undefined" &&
      window.location.pathname !== "/login"
    ) {
      window.location.href = "/login";
    }

    throw new ApiError(
      message,
      response.status,
      rawDetail || `status ${response.status}`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
