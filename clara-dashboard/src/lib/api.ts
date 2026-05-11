const API_BASE_URL =
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

function getAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem("clara_access_token");
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const requestBody = buildRequestBody(options.body);
  const isFormData =
    typeof FormData !== "undefined" && requestBody instanceof FormData;

  const token = getAccessToken();

  const headers: Record<string, string> = {};

  if (requestBody !== undefined && !isFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: requestBody,
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const errorBody = await response.json();
      message = errorBody.detail ?? message;
    } catch {
      // Ignore JSON parse error.
    }

    if (response.status === 401 && typeof window !== "undefined") {
      window.localStorage.removeItem("clara_access_token");
      window.location.href = "/login";
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}
