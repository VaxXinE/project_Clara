import fs from "node:fs"
import http from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const envFilePath = path.join(repoRoot, ".env")
const chatSnapshotDirPath = path.join(repoRoot, "server", "data")
const chatSnapshotFilePath = path.join(
  chatSnapshotDirPath,
  "whatsapp-chat-snapshots.json"
)

const isPlaceholderEnvValue = (value) => {
  const normalizedValue = String(value || "").trim()

  return [
    "",
    "API_KEY_KAMU",
    "OPENAI_API_KEY_KAMU",
    "YOUR_OPENAI_API_KEY",
    "test-key"
  ].includes(normalizedValue)
}

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return
  }

  const fileContent = fs.readFileSync(filePath, "utf8")
  const lines = fileContent.split(/\r?\n/)

  for (const line of lines) {
    const trimmedLine = line.trim()

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue
    }

    const separatorIndex = trimmedLine.indexOf("=")

    if (separatorIndex <= 0) {
      continue
    }

    const key = trimmedLine.slice(0, separatorIndex).trim()
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim()
    const normalizedValue = rawValue.replace(/^['"]|['"]$/g, "")

    if (!process.env[key] || isPlaceholderEnvValue(process.env[key])) {
      process.env[key] = normalizedValue
    }
  }
}

loadEnvFile(envFilePath)

const port = Number.parseInt(process.env.PORT || "9898", 10)
const openaiApiKey = process.env.OPENAI_API_KEY
const openaiModel = process.env.OPENAI_MODEL || "gpt-5.4-mini"
const REPLY_SUGGESTIONS_PATH = "/reply-suggestions"
const CHAT_SNAPSHOTS_PATH = "/chat-snapshots"
const CHAT_SNAPSHOTS_LATEST_PATH = "/chat-snapshots/latest"
const SUGGESTION_TONES = ["Friendly", "Casual", "Profesional"]

if (!openaiApiKey) {
  console.warn("OPENAI_API_KEY belum di-set.")
  console.warn("Endpoint /reply-suggestions akan mengembalikan error sampai key diisi.")
}

const buildSuggestionPrompt = (chatData) => {
  const transcript = (chatData?.messages || [])
    .slice(-12)
    .map((message) => {
      const timestamp = message?.timestampLabel ? `[${message.timestampLabel}] ` : ""
      const author = message?.author || "Tanpa nama"
      const text = message?.text || ""

      return `${timestamp}${author}: ${text}`
    })
    .join("\n")

  return [
    `Judul chat: ${chatData?.chatTitle || "-"}`,
    chatData?.chatSubtitle ? `Info chat: ${chatData.chatSubtitle}` : "",
    "",
    "Pesan terbaru:",
    transcript
  ]
    .filter(Boolean)
    .join("\n")
}

const extractResponseText = (payload) => {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim()
  }

  const outputItems = Array.isArray(payload?.output) ? payload.output : []

  const contentTexts = outputItems
    .flatMap((item) => (Array.isArray(item?.content) ? item.content : []))
    .filter((item) => item?.type === "output_text" && typeof item?.text === "string")
    .map((item) => item.text.trim())
    .filter(Boolean)

  return contentTexts.join("\n").trim()
}

const parseSuggestions = (text) => {
  const suggestions = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\[SUGGESTION\]\s*/i, "").trim())
    .filter(Boolean)
    .slice(0, 3)

  return SUGGESTION_TONES.map((tone, index) => {
    const suggestion = suggestions[index] || ""

    return suggestion.replace(new RegExp(`^${tone}\\s*[:|-]\\s*`, "i"), "").trim()
  }).filter(Boolean)
}

const getRequestPath = (request) => {
  const host = request.headers.host || `127.0.0.1:${port}`
  const requestUrl = request.url || "/"

  return new URL(requestUrl, `http://${host}`).pathname
}

const parseJsonBody = async (request) => {
  const chunks = []

  for await (const chunk of request) {
    chunks.push(chunk)
  }

  const rawBody = Buffer.concat(chunks).toString("utf8")

  return rawBody ? JSON.parse(rawBody) : {}
}

const isValidChatData = (chatData) =>
  Boolean(
    chatData &&
      typeof chatData === "object" &&
      typeof chatData.chatTitle === "string" &&
      typeof chatData.chatSubtitle === "string" &&
      typeof chatData.capturedAt === "string" &&
      Array.isArray(chatData.messages)
  )

const readChatSnapshotRecord = () => {
  if (!fs.existsSync(chatSnapshotFilePath)) {
    return null
  }

  try {
    const rawFile = fs.readFileSync(chatSnapshotFilePath, "utf8")
    const parsedFile = JSON.parse(rawFile)

    if (Array.isArray(parsedFile)) {
      return parsedFile[parsedFile.length - 1] || null
    }

    return parsedFile && typeof parsedFile === "object" ? parsedFile : null
  } catch (_error) {
    return null
  }
}

const writeChatSnapshotRecord = (snapshot) => {
  fs.mkdirSync(chatSnapshotDirPath, { recursive: true })
  fs.writeFileSync(chatSnapshotFilePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8")
}

const clearChatSnapshotRecord = () => {
  if (fs.existsSync(chatSnapshotFilePath)) {
    fs.unlinkSync(chatSnapshotFilePath)
  }
}

const getSnapshotChatData = (record) => {
  if (isValidChatData(record?.chatData)) {
    return record.chatData
  }

  if (isValidChatData(record)) {
    return {
      capturedAt: record.capturedAt,
      chatSubtitle: record.chatSubtitle,
      chatTitle: record.chatTitle,
      messages: record.messages
    }
  }

  return {
    capturedAt: "",
    chatSubtitle: "",
    chatTitle: "",
    messages: []
  }
}

const sanitizeSnapshotRecord = (record) => ({
  ...getSnapshotChatData(record),
  id: record.id,
  savedAt: record.savedAt
})

const createChatSnapshotSignature = (chatData) =>
  JSON.stringify({
    chatSubtitle: chatData?.chatSubtitle || "",
    chatTitle: chatData?.chatTitle || "",
    messages: Array.isArray(chatData?.messages) ? chatData.messages : []
  })

const storeChatSnapshot = (chatData) => {
  const latestSnapshot = readChatSnapshotRecord()
  const nextSignature = createChatSnapshotSignature(chatData)

  if (latestSnapshot) {
    const latestSignature = createChatSnapshotSignature(
      getSnapshotChatData(latestSnapshot)
    )

    if (latestSignature === nextSignature) {
      return {
        duplicate: true,
        latestSnapshot: sanitizeSnapshotRecord(latestSnapshot)
      }
    }
  }

  const nextRecord = {
    ...chatData,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    savedAt: new Date().toISOString()
  }
  writeChatSnapshotRecord(nextRecord)

  return {
    duplicate: false,
    latestSnapshot: sanitizeSnapshotRecord(nextRecord)
  }
}

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Private-Network": "true",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=utf-8"
  })

  response.end(JSON.stringify(payload))
}

const server = http.createServer(async (request, response) => {
  const requestPath = getRequestPath(request)

  console.log(
    `[proxy] ${request.method} ${requestPath} origin=${request.headers.origin || "-"}`
  )

  if (request.method === "GET" && (requestPath === "/" || requestPath === "/health")) {
    sendJson(response, 200, {
      endpoints: {
        latestChatSnapshot: `http://127.0.0.1:${port}${CHAT_SNAPSHOTS_LATEST_PATH}`,
        replySuggestions: `http://127.0.0.1:${port}${REPLY_SUGGESTIONS_PATH}`,
        storeChatSnapshot: `http://127.0.0.1:${port}${CHAT_SNAPSHOTS_PATH}`
      },
      methods: {
        latestChatSnapshot: "GET",
        replySuggestions: "POST",
        storeChatSnapshot: "POST"
      },
      model: openaiModel,
      ok: true,
      status: "Proxy aktif"
    })
    return
  }

  if (request.method === "GET" && requestPath === REPLY_SUGGESTIONS_PATH) {
    sendJson(response, 200, {
      endpoint: REPLY_SUGGESTIONS_PATH,
      message: "Gunakan method POST ke endpoint ini dengan body JSON berisi chatData.",
      ok: true
    })
    return
  }

  if (request.method === "GET" && requestPath === CHAT_SNAPSHOTS_PATH) {
    const snapshotRecord = readChatSnapshotRecord()

    if (!snapshotRecord) {
      sendJson(response, 200, {
        ok: true,
        snapshot: null
      })
      return
    }

    sendJson(response, 200, {
      ok: true,
      snapshot: sanitizeSnapshotRecord(snapshotRecord)
    })
    return
  }

  if (request.method === "GET" && requestPath === CHAT_SNAPSHOTS_LATEST_PATH) {
    const latestSnapshot = readChatSnapshotRecord()

    if (!latestSnapshot) {
      sendJson(response, 200, {
        ok: true,
        snapshot: null
      })
      return
    }

    sendJson(response, 200, {
      ok: true,
      snapshot: sanitizeSnapshotRecord(latestSnapshot)
    })
    return
  }

  if (request.method === "OPTIONS") {
    sendJson(response, 200, {
      ok: true
    })
    return
  }

  if (
    request.method !== "POST" ||
    ![REPLY_SUGGESTIONS_PATH, CHAT_SNAPSHOTS_PATH].includes(requestPath)
  ) {
    sendJson(response, 404, {
      error: "Route tidak ditemukan."
    })
    return
  }

  try {
    const body = await parseJsonBody(request)
    const chatData = body?.chatData

    if (requestPath === CHAT_SNAPSHOTS_PATH && chatData === null) {
      clearChatSnapshotRecord()

      sendJson(response, 200, {
        cleared: true,
        ok: true,
        snapshot: null
      })
      return
    }

    if (!isValidChatData(chatData)) {
      sendJson(response, 400, {
        error:
          "Body wajib berisi chatData dengan capturedAt, chatTitle, chatSubtitle, dan messages[]."
      })
      return
    }

    if (requestPath === CHAT_SNAPSHOTS_PATH) {
      const { duplicate, latestSnapshot } = storeChatSnapshot(chatData)

      sendJson(response, duplicate ? 200 : 201, {
        duplicate,
        ok: true,
        snapshot: latestSnapshot
      })
      return
    }

    if (chatData.messages.length === 0) {
      sendJson(response, 400, {
        error: "chatData.messages wajib ada dan tidak boleh kosong."
      })
      return
    }

    if (!openaiApiKey) {
      sendJson(response, 503, {
        error: "OPENAI_API_KEY belum di-set. Endpoint /reply-suggestions belum bisa dipakai."
      })
      return
    }

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: buildSuggestionPrompt(chatData),
        instructions:
          "Kamu membantu menyusun saran balasan WhatsApp. Berikan tepat 3 opsi balasan singkat, natural, relevan, dan sesuai bahasa serta tone percakapan. Urutannya wajib: 1) Friendly, 2) Casual, 3) Profesional. Jangan menambahkan fakta baru. Setiap opsi harus berada di baris terpisah dan diawali persis dengan '[SUGGESTION] '. Isi tiap baris hanya teks balasannya saja, tanpa label tone, tanpa nomor, dan tanpa penjelasan tambahan.",
        max_output_tokens: 220,
        model: openaiModel
      }),
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json"
      },
      method: "POST"
    })

    const payload = await openaiResponse.json()

    if (!openaiResponse.ok) {
      sendJson(response, openaiResponse.status, {
        error:
          payload?.error?.message || "OpenAI gagal memproses permintaan saran jawaban."
      })
      return
    }

    const outputText = extractResponseText(payload)
    const suggestions = parseSuggestions(outputText)

    if (suggestions.length === 0) {
      sendJson(response, 502, {
        error: "OpenAI tidak mengembalikan saran jawaban yang valid."
      })
      return
    }

    sendJson(response, 200, {
      model: openaiModel,
      suggestions
    })
  } catch (error) {
    sendJson(response, 500, {
      error:
        error instanceof Error
          ? error.message
          : "Terjadi kendala internal pada proxy OpenAI."
    })
  }
})

server.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    console.error(`Port ${port} sedang dipakai proses lain.`)
    console.error("Matikan proses proxy/node lama atau ganti nilai PORT di file .env.")
    console.error("Contoh PowerShell untuk cek proses: Get-NetTCPConnection -LocalPort 9898")
    console.error("Contoh PowerShell untuk matikan proses: Stop-Process -Id <PID>")
    process.exit(1)
  }

  console.error("Gagal menjalankan proxy:", error)
  process.exit(1)
})

server.listen(port, () => {
  console.log(`OpenAI proxy aktif di http://127.0.0.1:${port}${REPLY_SUGGESTIONS_PATH}`)
  console.log(`API snapshot chat di http://127.0.0.1:${port}${CHAT_SNAPSHOTS_PATH}`)
  console.log(`Model default: ${openaiModel}`)
  console.log(`Sumber konfigurasi .env: ${fs.existsSync(envFilePath) ? envFilePath : "tidak ada"}`)
})
