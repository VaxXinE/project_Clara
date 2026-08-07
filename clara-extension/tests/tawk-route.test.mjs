import assert from "node:assert/strict"
import test from "node:test"

import {
  isLikelyTawkConversationTitle,
  parseTawkInboxRoute
} from "../utils/tawk-route.ts"

test("parses live-chat and inbox conversation routes", () => {
  assert.deepEqual(parseTawkInboxRoute("/inbox/property-a/chats/chat-a"), {
    chatId: "chat-a",
    propertyId: "property-a"
  })
  assert.deepEqual(
    parseTawkInboxRoute("/inbox/property-a/all/chats/chat/chat-a"),
    { chatId: "chat-a", propertyId: "property-a" }
  )
  assert.deepEqual(parseTawkInboxRoute("/inbox/property-a/all/chat/chat-a"), {
    chatId: "chat-a",
    propertyId: "property-a"
  })
  assert.equal(parseTawkInboxRoute("/inbox/property-a/all/chats"), null)
})

test("rejects inbox history labels as conversation titles", () => {
  assert.equal(isLikelyTawkConversationTitle("Dessy Syafitrie"), true)
  assert.equal(
    isLikelyTawkConversationTitle("6 days ago - UDAH GAUSAH NANYA LAGI"),
    false
  )
  assert.equal(isLikelyTawkConversationTitle("Kamis, Juli 30 2026"), false)
})
