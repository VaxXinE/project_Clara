# Clara Process-State FSM Contract

> Stage 8/8.1: complaint/support context cannot transition or infer canonical
> process state.

Status: Stage 7 implementation
Contract version: `1.0`

## Purpose and authority

The canonical process state is factual customer progress and belongs to the
canonical `CustomerProfile`. It is shared by all linked leads, conversations,
and channels. It is not a CRM pipeline stage, interest level, current intent,
or emotional state.

| Concept | Examples | Authority |
|---|---|---|
| `pipeline_stage` | qualification, education, closing, won | `Conversation.current_stage`, `Lead.current_stage`, `AIExtraction.pipeline_stage` |
| `interest_level` | COLD, WARM, HOT | customer/lead temperature |
| `process_state` | DATA_SUBMITTED, VERIFIED, FUNDED | `CustomerProcessState` |
| intent | legality, next step, verification status | current message/runtime classifier |
| emotional state | neutral, cautious, angry | extraction/runtime context |

No automatic mapping treats HOT as FUNDED, closing as ACCOUNT_ACTIVE, won as
VERIFIED, education as EXPLORATION, or a verification question as VERIFIED.

## Vocabulary and order

`UNKNOWN → NEW_INQUIRY → EXPLORATION → READY_TO_PROCEED → DATA_SUBMITTED →
VERIFICATION_IN_PROGRESS → VERIFIED → ONBOARDING_OR_ACTIVATION →
ACCOUNT_ACTIVE → FUNDED → ACTIVE_SUPPORT`

`UNKNOWN` has rank 0 only for deterministic storage. It is not positive proof
of an early state. `ACTIVE_SUPPORT` is operational post-activation support.

## Modes

`CLARA_PROCESS_STATE_MODE` accepts `LEGACY`, `SHADOW`, and `FSM`. Missing or
invalid values normalize to `LEGACY`; production is not switched by Stage 7.

- `LEGACY`: existing pipeline writes, prompts, validators, policy, approval,
  and send behavior are unchanged.
- `SHADOW`: safe observation/event metadata is stored, but current canonical
  state is not advanced and no customer-facing runtime changes.
- `FSM`: valid transitions update customer state; prompt runtime context and
  continuity validators consume it.

## Transition matrix

| Candidate relative to current | Automatic result |
|---|---|
| UNKNOWN/no explicit evidence | `REJECTED_INSUFFICIENT_EVIDENCE` |
| same state, confidence >= 0.65 | `SAME_STATE_CONFIRMED` |
| one step forward, confidence >= 0.75 | `APPLIED` |
| multi-step, confidence >= 0.90 and HIGH/AUTHORITATIVE trust | `APPLIED` |
| any regression | `REJECTED_REGRESSION` |
| lower trust and confidence than current authority | `REJECTED_LOW_CONFIDENCE` |
| automatic candidate while manually locked | `REQUIRES_REVIEW` |
| two conflicting HIGH/AUTHORITATIVE states during merge | `MERGE_RECONCILIATION_REQUIRED` |

Questions, hypothetical/future statements, negation, denial, and uncertainty
produce no confirming state. Automatic regression never rewrites history.

## Evidence and trust

Evidence codes are safe identifiers only: `EXPLICIT_CUSTOMER_STATEMENT`,
`AUTHORIZED_AGENT_CONFIRMATION`, `SYSTEM_STATUS_CONFIRMATION`,
`DOCUMENT_RECEIVED`, `DATA_SUBMISSION_CONFIRMED`,
`VERIFICATION_STARTED_CONFIRMED`, `VERIFICATION_COMPLETED_CONFIRMED`,
`ACCOUNT_ACTIVATION_CONFIRMED`, `FUNDING_CONFIRMED`,
`SUPPORT_CONTEXT_CONFIRMED`, `AI_INFERENCE_ONLY`, `PIPELINE_STAGE_HINT`,
`MANUAL_OVERRIDE`, `IMPORTED_VERIFIED_RECORD`, and
`CUSTOMER_PROFILE_MERGE`.

Trust order: `LOW < MEDIUM < HIGH < AUTHORITATIVE`. AI inference and legacy
pipeline hints are context only. They cannot independently confirm VERIFIED,
ACCOUNT_ACTIVE, FUNDED, or ACTIVE_SUPPORT. Sensitive states require HIGH or
AUTHORITATIVE trust plus matching confirmation evidence.

No raw message, prompt, identity details, or product fact is stored in either
state table. Events use IDs, codes, confidence, trust, and correlation IDs.

## Persistence and concurrency

`customer_process_states` has one row per active canonical customer profile.
`version` is checked in the update predicate for optimistic concurrency.
`customer_process_state_events` is append-only through normal application
APIs; correction creates a new event rather than editing past events.

Migration backfills `UNKNOWN` only for non-merged profiles. It does not map or
modify lead/conversation stages, temperature, account category, approval, send,
or product facts.

## Customer merge reconciliation

Both histories remain attached to their original profile IDs. The source
authority is locked after merge. A clearly higher-trust confirmed source can
be copied to the target with `MERGE_RECONCILED`; equal high-trust disagreement
keeps the target unchanged and creates `MERGE_RECONCILIATION_REQUIRED`.
Neither newest timestamp nor highest rank wins by itself. Merged-away profiles
reject new authority updates.

## Manual authorization

- sales: read history and move forward only through DATA_SUBMITTED; no regressions;
- manager/head/superadmin: confirm higher states and correct state with a
  mandatory safe reason code;
- cross-organization access remains scoped by existing backend access control.

Manual correction preserves the previous state in an event and sets a manual
lock so later automation cannot silently overwrite the correction.

## Prompt, validator, and policy boundary

Only FSM mode adds `canonical_process_state` to structured runtime context.
State at/after DATA_SUBMITTED prevents repeated identity requests; VERIFIED
supports verification continuity; ACCOUNT_ACTIVE/FUNDED/ACTIVE_SUPPORT reject
backward onboarding language. LEGACY and SHADOW omit the field entirely.

Process state grants no system capability. It cannot bypass safety validators,
complaint escalation, policy enforcement, reviewers, product-fact authority,
approval, or send gates.

## Safe observability

Allowed metadata: mode, current/proposed/applied states, decision/reason codes,
version, source/trust/evidence codes, regression/manual/merge flags, and
decision hash. Full customer text, prompt, knowledge, credentials, identity
details, and product values are forbidden.

## Rollback

Set `CLARA_PROCESS_STATE_MODE=LEGACY` and restart the backend. Existing state
and history stay queryable, but no process-state value changes generation or
validation. Database rollback is only for deployment rollback: downgrade one
Alembic revision after exporting required audit records; it removes both Stage
7 tables and is therefore destructive to Stage 7 history.

## Known gaps

- candidate derivation is intentionally conservative and static;
- there is no authoritative external verification/funding connector yet;
- reconciliation resolution uses the normal authorized manual transition path;
- no automatic production rollout or quality scoring is included.
