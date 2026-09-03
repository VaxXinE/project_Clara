# Clara Extension Manual Send Runbook

## Normal governed send

1. Open and read the intended active customer chat.
2. Generate, review, and if allowed edit the visible draft.
3. Click **Approve & Send** or **Send Approved Reply** once.
4. Wait for authorization, claim, browser confirmation, and Clara reconciliation.
5. Treat the message as sent only when the extension reports reconciled `SENT`.

## Decision handling

- `REQUIRE_REFRESH`: read the active chat again and generate a new draft.
- `REQUIRE_REVIEW`: ask the required manager/head/compliance-authorized role to
  approve; do not reuse the pending draft as approval evidence.
- `BLOCK`: do not send; follow the policy or complaint escalation path.
- `ALREADY_SENT`: do not send again.
- `RECONCILIATION_REQUIRED`: stop retries and verify the customer chat manually.

## Browser outcomes

- `FAILED`: no `SentMessage` is created. Confirm the failure and request a new
  authorization only after the UI is stable.
- `UNKNOWN`: never retry immediately. Check the active chat for the exact
  outgoing message, then reconcile operationally before any new send.
- Extension reload after `CLAIMED`/`SENDING`: treat as unknown until manually
  reconciled. Opening another window does not create a second claim winner.

Never paste credentials, DOM HTML, customer identifiers, or raw authorization
tokens into tickets or logs. Use authorization ID, reason codes, and timestamps.

## Emergency rollback

1. Set `CLARA_EXTENSION_DELIVERY_MODE=LEGACY`.
2. Restart the backend.
3. Confirm `/extension/config` reports `delivery_mode=LEGACY`.
4. Record why rollback was needed and preserve authorization/event history.
5. Do not change persona, semantic, policy, facts, process-state, routing, or
   live-chat configuration as part of the rollback.
