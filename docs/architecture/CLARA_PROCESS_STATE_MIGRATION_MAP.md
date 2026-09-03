# Clara Process-State Migration Map

Status: Stage 7 implementation

| Existing signal | Meaning before Stage 7 | Stage 7 treatment | Canonical authority? |
|---|---|---|---|
| `AIExtraction.pipeline_stage` | AI sales-funnel classification | preserved; optional `PIPELINE_STAGE_HINT` context only | No |
| `Conversation.current_stage` | latest extracted sales pipeline stage | existing overwrite remains for compatibility | No |
| `Lead.current_stage` | CRM/sales pipeline state | existing synchronization remains | No |
| customer/lead temperature | COLD/WARM/HOT sales interest | displayed separately | No |
| prompt milestone heuristics | transcript-local identity/verification hints | unchanged in LEGACY/SHADOW; supplemented by canonical state in FSM | No |
| continuity validators | heuristic anti-repeat/anti-regression checks | same validator IDs; FSM supplies persistent state context | Enforcement detector only |
| `CustomerProcessState` | did not exist | persistent current factual progress per canonical profile | Yes in FSM |
| `CustomerProcessStateEvent` | did not exist | immutable observations, transitions, rejections, corrections, merges | Audit authority |

## Migration behavior

Revision `c7d8e9f0a1b2` creates the two Stage 7 tables and backfills `UNKNOWN`
for active, non-merged customer profiles. It deliberately does not infer from
pipeline stage, temperature, account category, or transcript. New profiles
receive UNKNOWN when linked through the existing identity service.

Upgrade and downgrade do not modify legacy pipeline columns, product facts,
policy fields, approval/send state, or live-chat data. Downgrade deletes Stage 7
state/history tables, so runtime rollback should use mode `LEGACY` instead.

## Future migration boundary

Authoritative external verification, activation, and funding connectors may
later emit HIGH/AUTHORITATIVE evidence. They must use this transition contract,
organization scope, optimistic concurrency, and safe IDs; they must not write
state columns directly.
