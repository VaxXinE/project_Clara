const API_BASE_URL = "/api";
const CSRF_COOKIE_NAME =
  process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME ?? "clara_csrf_token";

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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: requestBody,
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const errorBody = await response.json();
      const detail = errorBody.detail;
      if (typeof detail === "string") {
        message = detail;
      } else if (Array.isArray(detail)) {
        message = detail
          .map((item) => {
            if (typeof item === "string") {
              return item;
            }
            if (item && typeof item === "object") {
              const fieldPath = Array.isArray(item.loc)
                ? item.loc.join(".")
                : "field";
              const reason =
                typeof item.msg === "string" ? item.msg : JSON.stringify(item);
              return `${fieldPath}: ${reason}`;
            }
            return String(item);
          })
          .join(" | ");
      } else if (detail && typeof detail === "object") {
        message = JSON.stringify(detail);
      }
    } catch {
      // Ignore JSON parse error.
    }

    if (response.status === 401 && typeof window !== "undefined") {
      window.location.href = "/login";
    }

    throw new Error(message);
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
