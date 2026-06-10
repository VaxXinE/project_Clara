import type { ClaraExtensionSessionUser } from "~/types/whatsapp"

const DEFAULT_PROXY_URL = "http://127.0.0.1:9898/reply-suggestions"
const DEFAULT_CHAT_SNAPSHOT_PROXY_URL = "http://127.0.0.1:9898/chat-snapshots"
const DEFAULT_CLARA_API_BASE_URL = "http://127.0.0.1:8000"
const DEFAULT_CLARA_DASHBOARD_URL = "http://localhost:3000"
const DEFAULT_AUTH_COOKIE_NAME = "clara_access_token"

const buildClaraApiUrl = (apiBaseUrl: string, routePath: string) => {
  const normalizedBaseUrl = (apiBaseUrl || DEFAULT_CLARA_API_BASE_URL).trim()
  const normalizedRoutePath = routePath.startsWith("/")
    ? routePath
    : `/${routePath}`

  const url = new URL(normalizedBaseUrl)
  const basePath = url.pathname.replace(/\/+$/, "")

  url.pathname = `${basePath}${normalizedRoutePath}` || normalizedRoutePath
  url.search = ""
  url.hash = ""

  return url.toString()
}

export const getConfiguredProxyUrl = () =>
  (process.env.PLASMO_PUBLIC_OPENAI_PROXY_URL || DEFAULT_PROXY_URL).trim()

export const getConfiguredClaraApiBaseUrl = () =>
  (process.env.PLASMO_PUBLIC_CLARA_API_BASE_URL || "").trim()

export const getConfiguredClaraApiToken = () =>
  (process.env.PLASMO_PUBLIC_CLARA_API_TOKEN || "").trim()

export const getConfiguredClaraDashboardUrl = () =>
  (
    process.env.PLASMO_PUBLIC_CLARA_DASHBOARD_URL || DEFAULT_CLARA_DASHBOARD_URL
  ).trim()

export const getClaraDashboardLoginUrl = () => {
  try {
    const url = new URL(getConfiguredClaraDashboardUrl())
    url.pathname = "/login"
    url.search = ""
    url.hash = ""

    return url.toString()
  } catch (_error) {
    return `${DEFAULT_CLARA_DASHBOARD_URL}/login`
  }
}

export const getConfiguredClaraAuthCookieName = () =>
  (
    process.env.PLASMO_PUBLIC_CLARA_AUTH_COOKIE_NAME || DEFAULT_AUTH_COOKIE_NAME
  ).trim()

const getOriginForCookieLookup = (url: string) => {
  try {
    const parsed = new URL(url)
    return parsed.origin
  } catch (_error) {
    return ""
  }
}

export const getClaraSessionOrigins = () =>
  Array.from(
    new Set(
      [
        getOriginForCookieLookup(getConfiguredClaraDashboardUrl()),
        getOriginForCookieLookup(getConfiguredClaraApiBaseUrl())
      ].filter(Boolean)
    )
  )

export const getChatSnapshotProxyUrl = (
  replySuggestionsUrl = DEFAULT_PROXY_URL
) => {
  try {
    const url = new URL((replySuggestionsUrl || DEFAULT_PROXY_URL).trim())
    url.pathname = "/chat-snapshots"
    url.search = ""
    url.hash = ""

    return url.toString()
  } catch (_error) {
    return DEFAULT_CHAT_SNAPSHOT_PROXY_URL
  }
}

export const getClaraSnapshotSyncUrl = (
  apiBaseUrl = getConfiguredClaraApiBaseUrl()
) => {
  if (!apiBaseUrl) {
    return ""
  }

  try {
    return buildClaraApiUrl(apiBaseUrl, "/extension/whatsapp/snapshots")
  } catch (_error) {
    return ""
  }
}

export const getClaraReplySuggestionsUrl = (
  apiBaseUrl = getConfiguredClaraApiBaseUrl()
) => {
  if (!apiBaseUrl) {
    return ""
  }

  try {
    return buildClaraApiUrl(apiBaseUrl, "/extension/whatsapp/reply-suggestions")
  } catch (_error) {
    return ""
  }
}

export const getClaraSendReplyUrl = (
  replySuggestionId: string,
  apiBaseUrl = getConfiguredClaraApiBaseUrl()
) => {
  if (!apiBaseUrl || !replySuggestionId.trim()) {
    return ""
  }

  try {
    return buildClaraApiUrl(
      apiBaseUrl,
      `/extension/whatsapp/reply-suggestions/${replySuggestionId.trim()}/send`
    )
  } catch (_error) {
    return ""
  }
}

export const getProxyCandidates = (url: string) => {
  const normalizedUrl = (url || DEFAULT_PROXY_URL).trim()
  const candidates = [normalizedUrl]

  if (normalizedUrl.includes("://localhost")) {
    candidates.push(normalizedUrl.replace("://localhost", "://127.0.0.1"))
  } else if (normalizedUrl.includes("://127.0.0.1")) {
    candidates.push(normalizedUrl.replace("://127.0.0.1", "://localhost"))
  }

  return Array.from(new Set(candidates.filter(Boolean)))
}

export const getSnapshotSyncCandidates = () => {
  const claraSnapshotUrl = getClaraSnapshotSyncUrl()

  if (claraSnapshotUrl) {
    return getProxyCandidates(claraSnapshotUrl)
  }

  return getProxyCandidates(DEFAULT_CHAT_SNAPSHOT_PROXY_URL)
}

export const getReplySuggestionCandidates = () => {
  const claraReplySuggestionsUrl = getClaraReplySuggestionsUrl()

  if (claraReplySuggestionsUrl) {
    return [
      ...getProxyCandidates(claraReplySuggestionsUrl),
      ...getProxyCandidates(getConfiguredProxyUrl())
    ]
  }

  return getProxyCandidates(getConfiguredProxyUrl())
}

export const getClaraSessionAccessToken = async () => {
  const configuredToken = getConfiguredClaraApiToken()

  if (!chrome.cookies?.get) {
    return configuredToken
  }

  const cookieName = getConfiguredClaraAuthCookieName()
  const origins = getClaraSessionOrigins()

  for (const origin of Array.from(new Set(origins))) {
    const cookie = await chrome.cookies.get({
      name: cookieName,
      url: origin
    })

    if (cookie?.value?.trim()) {
      return cookie.value.trim()
    }
  }

  return configuredToken
}

export const getClaraAuthHeaders = async () => {
  const token = await getClaraSessionAccessToken()

  if (!token) {
    return {}
  }

  return {
    Authorization: `Bearer ${token}`
  }
}

export const getCurrentClaraSessionUser =
  async (): Promise<ClaraExtensionSessionUser | null> => {
    const apiBaseUrl = getConfiguredClaraApiBaseUrl()

    if (!apiBaseUrl) {
      throw new Error("PLASMO_PUBLIC_CLARA_API_BASE_URL belum dikonfigurasi.")
    }

    const headers = await getClaraAuthHeaders()

    if (!("Authorization" in headers)) {
      return null
    }

    const meUrl = buildClaraApiUrl(apiBaseUrl, "/auth/me")
    const response = await fetch(meUrl, {
      headers
    })

    if (response.status === 401) {
      return null
    }

    const payload = await response.json()

    if (!response.ok) {
      throw new Error(
        payload?.detail || payload?.error || "Gagal membaca session Clara."
      )
    }

    return {
      email: String(payload.email || ""),
      id: String(payload.id || ""),
      name: String(payload.name || ""),
      organizationName:
        typeof payload.organization_name === "string"
          ? payload.organization_name
          : null,
      role: String(payload.role || "")
    }
  }
