import assert from "node:assert/strict"
import test from "node:test"

import {
  buildDeliveryIdentity,
  canStartGovernedSend
} from "../utils/delivery-governance.ts"

test("governed send requires an explicit click, visible text, and no active send", () => {
  assert.equal(
    canStartGovernedSend({
      explicitHumanAction: true,
      finalTextVisible: true,
      sendInFlight: false
    }),
    true
  )
  assert.equal(
    canStartGovernedSend({
      explicitHumanAction: false,
      finalTextVisible: true,
      sendInFlight: false
    }),
    false
  )
  assert.equal(
    canStartGovernedSend({
      explicitHumanAction: true,
      finalTextVisible: true,
      sendInFlight: true
    }),
    false
  )
})

test("delivery identity is deterministic and changes with active chat context", async () => {
  const snapshot = {
    capturedAt: "2026-08-03T00:00:00Z",
    channel: "whatsapp",
    chatSubtitle: "online",
    chatTitle: "Customer A",
    messages: [
      {
        author: "Customer A",
        direction: "incoming",
        id: "1",
        text: "Halo   Clara",
        timestampLabel: "10:00"
      }
    ]
  }
  assert.deepEqual(
    await buildDeliveryIdentity(snapshot),
    await buildDeliveryIdentity(snapshot)
  )
  assert.notDeepEqual(
    await buildDeliveryIdentity(snapshot),
    await buildDeliveryIdentity({ ...snapshot, chatTitle: "Customer B" })
  )
})
