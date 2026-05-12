const DEFAULT_PROXY_URL = "http://127.0.0.1:9898/reply-suggestions"
const DEFAULT_CHAT_SNAPSHOT_PROXY_URL = "http://127.0.0.1:9898/chat-snapshots"
const DEFAULT_CLARA_API_BASE_URL = "http://127.0.0.1:8000"

export const getConfiguredProxyUrl = () =>
  (process.env.PLASMO_PUBLIC_OPENAI_PROXY_URL || DEFAULT_PROXY_URL).trim()

export const getConfiguredClaraApiBaseUrl = () =>
  (process.env.PLASMO_PUBLIC_CLARA_API_BASE_URL || "").trim()

export const getChatSnapshotProxyUrl = (replySuggestionsUrl = DEFAULT_PROXY_URL) => {
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
    const url = new URL(apiBaseUrl.trim() || DEFAULT_CLARA_API_BASE_URL)
    url.pathname = "/extension/whatsapp/snapshots"
    url.search = ""
    url.hash = ""

    return url.toString()
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
    const url = new URL(apiBaseUrl.trim() || DEFAULT_CLARA_API_BASE_URL)
    url.pathname = "/extension/whatsapp/reply-suggestions"
    url.search = ""
    url.hash = ""

    return url.toString()
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

export const getClaraAuthHeaders = () => {
  const token = (process.env.PLASMO_PUBLIC_CLARA_API_TOKEN || "").trim()

  if (!token) {
    return {}
  }

  return {
    Authorization: `Bearer ${token}`
  }
}
