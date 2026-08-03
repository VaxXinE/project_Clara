# Clara Stage 9 Rollout Runbook

## Readiness levels

- **Engineering-ready:** migration round-trip, Stage 0–9 regression, dashboard/extension builds, and Golden V2 regression pass. This does not authorize a live rollout.
- **Internal simulation:** an authorized administrator creates, validates, and explicitly activates the exact certified Mini plan. Only synthetic/approved evidence is used; no candidate customer draft is exposed.
- **Shadow evidence:** explicitly promote to `SHADOW`, configure sampling and daily budget, review candidate observations, and confirm baseline availability. Shadow output is never sendable.
- **10% evidence:** confirm current-stage sample/human-review coverage, thresholds, reconciliation, certification, readiness references, and zero open critical incidents; then explicitly promote to `REVIEWER_CANARY_10`.
- **30% evidence:** repeat the same gate using evidence produced during the 10% stage; explicitly promote to `REVIEWER_CANARY_30`.
- **100% semi-automatic:** repeat the gate using 30% evidence and explicitly promote to `SEMI_AUTOMATIC_100`. “Semi-automatic” is AI draft → human review/edit → explicit human send.

## Before any activation

1. Keep `CLARA_ROLLOUT_CONTROL_MODE=OFF` until deployment, migration, and monitoring are verified.
2. Confirm the plan’s published Mini bundle/hash and Golden certification run/report hashes.
3. Review every difference between baseline and candidate profiles.
4. Supply real readiness references for every non-default component. In particular, do not select Product Fact `REGISTRY`, process `FSM`, routing `ROUTED`, or extension `GOVERNED` until their operational readiness is independently confirmed.
5. Configure sample size and thresholds explicitly. Empty thresholds block production-canary promotion.
6. Change the environment to `GOVERNED` only through the normal deployment process; the UI never changes it.

## Emergency pause

Use **Emergency pause** or `POST /clara-rollouts/{id}/pause` with the current version and safe reason codes. New requests immediately select baseline; pending candidate authorization is rejected. Preserve observations, incidents, and events. Investigate without placing prompts, transcripts, PII, credentials, or full replies in notes.

## Incident review and resume

A hard stop creates a critical incident, audit record, append-only event, and administrator notification. Acknowledge and resolve each incident with a bounded, non-sensitive note. Resume is separate and explicit; resolving an incident never resumes automatically. Re-check certification and all readiness sources before resume.

## Rollback

Use **Immediate rollback** or `POST /clara-rollouts/{id}/rollback`. Verify two append-only events (`ROLLBACK_STARTED`, `ROLLED_BACK`) and an audit entry. Confirm cohort requests return baseline and old candidate suggestions cannot receive send authorization. Rollback never rewrites global configuration.

## Operational completion evidence

Operational Stage 9 is complete only after separately approved internal, shadow, 10%, 30%, and 100% evidence exists and no critical incident remains unresolved. Automated test results alone are engineering evidence, not operational authorization.
