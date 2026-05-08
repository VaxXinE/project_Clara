const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
};

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  let requestBody: BodyInit | null | undefined;

  if (options.body === undefined) {
    requestBody = undefined;
  } else if (options.body === null) {
    requestBody = null;
  } else if (typeof FormData !== "undefined" && options.body instanceof FormData) {
    requestBody = options.body;
  } else {
    requestBody = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: isFormData
      ? undefined
      : {
          "Content-Type": "application/json",
        },
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

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}
