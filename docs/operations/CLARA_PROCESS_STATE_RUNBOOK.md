# Clara Process-State Runbook

Status: Stage 7 implementation

## Review a customer state

1. Open customer detail and read **Process state canonical**.
2. Compare it with source, confidence, trust, and last confirmation.
3. Read decision history, especially `REJECTED_REGRESSION`,
   `REQUIRES_REVIEW`, and `MERGE_RECONCILIATION_REQUIRED`.
4. Treat pipeline stage and temperature as separate context, never as proof.

## Confirm forward movement

Choose the target state, use an uppercase safe reason code such as
`AGENT_CONFIRMED_DATA`, and submit. If the API returns a version conflict,
reload the page and review the newer event before retrying. Sales may advance
only through DATA_SUBMITTED. Higher states require manager/head/superadmin.

## Correct a wrong state

Manager/head/superadmin selects the factual target and enters a mandatory code
such as `MANAGER_CORRECTION_INVALID_VERIFICATION`. Never place names, phone
numbers, message text, or free-form evidence in the reason code. The correction
creates a new immutable event and manual lock; it never deletes old history.

## Handle rejected regression

Confirm whether the lower candidate is a new-channel greeting, question,
negation, stale message, or actual data correction. Leave it rejected when it
is only conversational context. If the authoritative factual state was wrong,
perform an authorized manual correction instead of editing an event.

## Handle profile merges

Before merge, verify both identities and inspect both state histories. After
merge:

- `MERGE_RECONCILED`: verify the chosen state and source trust;
- `MERGE_RECONCILIATION_REQUIRED`: manager/head reviews both histories and
  records the resolved state through a manual transition with a merge-specific
  reason code beginning with `MERGE_`;
- never update the merged-away profile.

## Audit procedure

Filter process-state events by customer/organization and verify: event order,
actor, previous/proposed/applied states, evidence codes, trust, reason codes,
correlation ID, and matching state version. Do not copy raw chats into audit
notes. Historical events are not edited or deleted through application APIs.

## Roll back runtime behavior

1. Set `CLARA_PROCESS_STATE_MODE=LEGACY`.
2. Restart backend instances.
3. Verify generation logs show `process_state_mode=LEGACY`.
4. Confirm pipeline extraction, approval, send, product-fact, policy, persona,
   and live-chat paths are unchanged.

Do not downgrade the migration merely to disable FSM. Downgrade removes the
Stage 7 state/history tables and should be reserved for a coordinated database
deployment rollback with an audit export.
