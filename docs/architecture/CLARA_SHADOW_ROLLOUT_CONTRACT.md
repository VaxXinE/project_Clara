# Clara Shadow Rollout Contract

Stage 9 contract version: `1.0`.

## Authority and defaults

`CLARA_ROLLOUT_CONTROL_MODE` accepts `OFF`, `OBSERVE`, and `GOVERNED`; missing or invalid values normalize to `OFF`. `OFF` does not attach a rollout profile and preserves the seven existing defaults. `OBSERVE` reports safe plan/cohort metadata but always selects `BASELINE`. Only `GOVERNED` plus an explicitly activated, current, certified plan can select candidate behavior. Selection is request-scoped and never mutates global settings.

The plan binds the exact published Mini bundle ID/hash and Golden V2 certification run/report hash. A stale, archived, changed, or superseded binding fails readiness and triggers baseline fallback. Readiness references are identifiers only; they are not proof that external operational work was completed.

## Lifecycle

Statuses are `DRAFT`, `READY`, `ACTIVE`, `PAUSED`, `STOPPED`, `ROLLED_BACK`, `COMPLETED`, and `REJECTED`. Stages progress only in this order:

`INTERNAL_SIMULATION → SHADOW → REVIEWER_CANARY_10 → REVIEWER_CANARY_30 → SEMI_AUTOMATIC_100`.

Creation is always `DRAFT`. Readiness, activation, every promotion, resume, stop, and rollback require an authorized explicit request with optimistic version matching. No timer promotes or resumes a plan. One active Mini plan is allowed per organization.

## Generation lanes

- `BASELINE`: current production defaults; reviewer/customer-facing.
- `SHADOW_CANDIDATE`: sampled and budget-bounded; hash/length/validator evidence only; no persisted reply suggestion; never approvable or sendable; failures are caught independently from baseline.
- `CANARY_CANDIDATE`: selected only for an authenticated, active, authorized reviewer in the deterministic cohort. Approval/edit and explicit manual send remain mandatory.

Every rollout-associated suggestion records safe plan/stage/lane/profile/bundle/cohort/send/decision metadata in the existing suggestion metadata column. It never stores a duplicate transcript or shadow reply text.

## Cohorts and evidence

The bucket is `SHA-256(plan_id:reviewer_user_id:cohort_seed) mod 100`. Eligibility is organization-scoped and limited to active sales, manager, head, or superadmin users. Buckets below 10 are necessarily contained in buckets below 30 and 100. Customer identity is not an input. No override API exists in Stage 9.

Promotion evaluates only observations from the current stage. Internal fixtures do not become production evidence. The required sample count, completed human-review count, configured thresholds, current certification/readiness, and absence of unresolved critical incidents are checked together. Canary promotion also requires an explicitly configured `GOVERNED` extension-delivery profile and its readiness reference.

## Send boundary and rollback

Approval, `SentMessage`, and extension authorization all re-check rollout status, stage, bundle hash, lane, and send eligibility. Shadow is rejected unconditionally. Paused/stopped/rolled-back candidate suggestions become unsendable immediately. Rollback changes only plan state; baseline is selected for subsequent requests and global environment settings remain untouched.

See the runbook, metric dictionary, and stop-condition catalog for operations.
