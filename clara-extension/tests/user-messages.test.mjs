import assert from "node:assert/strict"
import test from "node:test"

import { toUserMessage } from "../utils/user-messages.ts"

const hasNoTechnicalLeak = (message) =>
  !/https?:\/\/|127\.0\.0\.1|Failed to fetch|PLASMO_PUBLIC|sk-proj|OPENAI|AuthenticationError/i.test(
    message
  )

test("network failures become a retryable instruction", () => {
  const message = toUserMessage("Failed to fetch", "snapshot")
  assert.match(message, /Tidak bisa terhubung ke Clara/)
  assert.match(message, /Baca Ulang Chat/)
  assert.ok(hasNoTechnicalLeak(message))

  assert.match(toUserMessage("Failed to fetch", "suggest"), /Buat Jawaban/)
})

test("an empty snapshot tells the sales what to try", () => {
  const message = toUserMessage("Snapshot messages cannot be empty.", "snapshot")
  assert.match(message, /Buka chat yang berisi teks/)
  assert.ok(hasNoTechnicalLeak(message))
})

test("AI provider errors never expose key fragments or provider internals", () => {
  const raw =
    "Failed to call OpenAI. Check OPENAI_API_KEY, OPENAI_MODEL. AuthenticationError: Error code: 401 - Incorrect API key provided: sk-proj-****a_QA"
  const message = toUserMessage(raw, "suggest")
  assert.match(message, /Layanan AI Clara sedang bermasalah/)
  assert.ok(hasNoTechnicalLeak(message))
})

test("session, config, permission and server errors are mapped", () => {
  assert.match(toUserMessage("Not authenticated", "snapshot"), /Sesi login kamu berakhir/)
  assert.match(
    toUserMessage("PLASMO_PUBLIC_CLARA_API_BASE_URL belum diisi.", "snapshot"),
    /Extension belum terhubung/
  )
  assert.match(toUserMessage("403 Forbidden", "suggest"), /belum punya akses/)
  assert.match(toUserMessage("Internal Server Error", "suggest"), /sisi server/)
})

test("friendly Indonesian messages pass through unchanged", () => {
  const message = "Buka WhatsApp Web dulu di tab aktif."
  assert.equal(toUserMessage(message, "snapshot"), message)
})

test("Indonesian messages that contain a URL are replaced", () => {
  const message = toUserMessage(
    "Backend Clara gagal memproses saran jawaban di http://127.0.0.1:8000/x.",
    "suggest"
  )
  assert.ok(hasNoTechnicalLeak(message))
})

test("unknown English errors and empty input fall back to a generic message", () => {
  assert.equal(
    toUserMessage("Something odd happened", "suggest"),
    "Jawaban belum bisa dibuat. Coba lagi beberapa saat."
  )
  assert.equal(
    toUserMessage("", "snapshot"),
    "Chat belum bisa disimpan ke Clara. Coba lagi beberapa saat."
  )
})
