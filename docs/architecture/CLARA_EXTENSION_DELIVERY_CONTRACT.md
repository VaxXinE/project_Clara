# Clara Extension Delivery Contract

Status: Tahap 6 implementation. Contract version `1.0`.

## Roadmap and authority

This is the approved extension-first adaptation of Tahap 6. The extension reads
the active chat and performs the browser action, the backend owns authorization
and reconciliation, and a human owns the final click. No callback, timer,
background task, generation response, or webhook may initiate delivery.

Authority order remains backend security, policy/critical validation, reviewer
requirement, product facts, process state, service routing, then extension
delivery. Delivery consumes these decisions and cannot change them. Tawk webhook
ownership and signature verification are unchanged; Tawk extension reply stays
read-only.

## Modes

`CLARA_EXTENSION_DELIVERY_MODE` accepts `LEGACY`, `OBSERVE`, and `GOVERNED`.
Missing or invalid values normalize to `LEGACY`; mixed case is accepted.

- `LEGACY`: keeps the previous send-then-sync endpoint and implicit extension
  approval behavior for rollback compatibility.
- `OBSERVE`: persists a safe governed decision but issues no usable token,
  changes no approval, and does not block the legacy customer-facing flow.
- `GOVERNED`: authorization and atomic claim are required before DOM send. The
  old post-send endpoint returns `DELIVERY_AUTHORIZATION_REQUIRED`.

Production default remains `LEGACY`.

## Identity and freshness

Generation stores only SHA-256 fingerprints for the normalized visible
snapshot, latest visible inbound message, and active chat. Normalization uses
channel, safe thread key (external ID when available, otherwise normalized chat
title), message direction, and whitespace-normalized message text. Timestamp
labels and UI layout are excluded to avoid rendering-only churn.

Authorization binds organization, authenticated user, conversation, suggestion,
suggestion version, channel, three context fingerprints, and final-text hash.
Any mismatch returns `REQUIRE_REFRESH`; an approved final-text mismatch returns
`REQUIRE_REVIEW`. A tab URL alone is never accepted as chat identity.

## Authorization and lifecycle

`ExtensionDeliveryAuthorization` stores only the token hash. The raw
cryptographically random token is returned once, expires after a configurable
15–300 second bounded TTL (default 60 seconds), and is bound to the complete
delivery identity. Atomic compare-and-update permits one claim winner.

Lifecycle statuses are `OBSERVED`, `AUTHORIZED`, `CLAIMED`, `SENDING`, `SENT`,
`FAILED`, `UNKNOWN`, `EXPIRED`, `CANCELLED`, and
`RECONCILIATION_REQUIRED`. Claim records append-only `CLAIMED` and `SENDING`
events. `SENT` is terminal. An active or unresolved authorization prevents a
second delivery attempt; an expired or definitive failed attempt may be
authorized again.

## Approval

Generation is never approval. In `GOVERNED`, low-risk `SALES_REVIEW` may use one
explicitly labelled human “Approve & Send” click; the backend records
`approved_explicit_extension` before authorization. Elevated requirements must
already have an authorized approval audit. A sales user cannot silently approve
an elevated draft, and blocked/rejected/critical drafts cannot be authorized.
`approved_via_extension_send` remains only inside the rollback-only legacy path.

## Idempotency and reconciliation

Authorization requests use an organization/user-scoped idempotency key. Token
claim uses an atomic status/version predicate. Browser events are stored only as
hashes. `SentMessage.reply_suggestion_id` is unique.

- `SENT`: positive adapter confirmation creates exactly one `SentMessage` using
  the central sent-message service, then reconciles the authorization.
- `FAILED`: records a definitive failure and creates no `SentMessage`.
- `UNKNOWN`: creates no `SentMessage`, becomes `RECONCILIATION_REQUIRED`, and
  blocks immediate retry.

Result replay with the same browser-event hash is idempotent. A different event
cannot overwrite an existing result.

## Privacy and observability

Allowed metadata is limited to modes, statuses, permissions, reason codes,
internal UUIDs, versions, match booleans, hashes, age, duplicate/reconciliation
flags, and adapter result codes. Authorization/event rows and application logs
exclude transcripts, customer identifiers, DOM, prompts, full reply text,
credentials, raw tokens, and token hashes.

## Rollback

Set `CLARA_EXTENSION_DELIVERY_MODE=LEGACY` and restart the backend. Existing
authorization/event history remains available. Do not downgrade the migration
for operational rollback. Older extension builds remain compatible while mode
is `LEGACY`; a governed rollout must require extension `0.1.2` or newer.
