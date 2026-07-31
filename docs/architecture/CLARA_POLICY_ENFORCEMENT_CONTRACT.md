# Clara Policy Enforcement Contract

> Stage 8: service routing does not override this contract. Backend security
> and policy stay higher authority; complaint routing reuses its contextual
> classifier and deterministic handoff categories.

Status: Stage 5 implementation

Contract version: `CLARA_ENFORCEMENT_CONTRACT_VERSION = "1.0"`

Production rollout default: `CLARA_POLICY_ENFORCEMENT_MODE=OBSERVE`

## Enforcement modes

- `OFF`: emergency rollback. Legacy generation, approval, and extension-send
  behavior remains unchanged.
- `OBSERVE`: calculates and logs the deterministic decision but does not alter
  draft selection, status, approval, or send behavior.
- `ENFORCE`: applies backend action modes, reviewer authorization, safe handoff,
  blocked-draft handling, and explicit approval before extension send.

Missing, empty, mixed-case, and invalid configuration values normalize safely;
missing or invalid values become `OBSERVE`. Safe metadata retains the original
configuration value.

## Authority precedence

1. Backend security and access control.
2. Unresolved critical semantic validation.
3. Contextual complaint and escalation policy.
4. General policy engine.
5. Persona and prompt behavior.
6. Knowledge and examples.

Lower layers cannot override a decision from a higher layer. The decision hash
is deterministic and covers only action IDs, reason codes, risk, reviewer
requirement, generation strategy, send permission, category, and contract
version.

## Canonical decisions

| Action | Generation | Initial send permission | Reviewer |
|---|---|---|---|
| `NORMAL` | `NORMAL_GENERATION` | `PENDING_REVIEW` | `SALES_REVIEW` |
| `HUMAN_REVIEW` | `NORMAL_GENERATION` | `AUTHORIZED_REVIEW_REQUIRED` | Manager or compliance requirement |
| `SAFE_HANDOFF` | `SAFE_HANDOFF_TEMPLATE` | `AUTHORIZED_REVIEW_REQUIRED` | `SUPERVISOR_OR_COMPLIANCE_REVIEW` |
| `BLOCK` | `NO_CUSTOMER_DRAFT` | `BLOCKED` | `NO_REVIEW_ALLOWED` |

All normal customer-facing AI suggestions remain `pending` in `ENFORCE`.
`BLOCK` records contain no customer-facing draft and use status `blocked`.

## Safe-handoff categories

- `PERSONAL_COMPLAINT`
- `FINANCIAL_LOSS_CLAIM`
- `REFUND_OR_COMPENSATION`
- `LEGAL_OR_REGULATOR_THREAT`
- `FRAUD_ALLEGATION`
- `HUMAN_REQUEST`
- `HIGH_EMOTION`

Classification requires contextual evidence. Generic questions such as “ini
modus?” or general regulator education do not become complaints solely because
they contain a keyword. The backend template is deterministic and does not use
the normal sales prompt or model.

## Critical validator mapping

The unresolved Stage 4 validators for guaranteed profit, risk-free claims,
personalized buy/sell, all-in/full-margin, and fake verification/account/fund
access map to `BLOCK`. Unsupported refund/compensation promises map to
`SAFE_HANDOFF` only when complaint context is present; otherwise they map to
`BLOCK`.

The final generated or repaired text is independently validated before an
`ENFORCE` action is applied. Unsafe rejected text is not copied to public API
metadata.

## Reviewer requirements and existing roles

| Requirement | Runtime roles |
|---|---|
| `SALES_REVIEW` | sales, manager, head, superadmin |
| `MANAGER_REVIEW` | manager, head, superadmin |
| `COMPLIANCE_REVIEW` | configured by `CLARA_COMPLIANCE_REVIEWER_ROLES`; default head, superadmin |
| `SUPERVISOR_OR_COMPLIANCE_REVIEW` | manager, head, superadmin plus configured compliance roles |
| `NO_REVIEW_ALLOWED` | none |

There is no dedicated compliance role in the current organization model.
`COMPLIANCE_REVIEW` remains a requirement category mapped to existing roles.

## Approval and send gate

Approval and send checks live in the shared backend enforcement service.
Routes pass the authenticated actor role; payload reviewer names do not grant
authorization. In `ENFORCE`:

- generation is never approval;
- an actor without a runtime role cannot approve;
- elevated drafts require the mapped reviewer role;
- critical or blocked drafts cannot be approved;
- an unapproved draft cannot be sent;
- pending drafts are withheld from extension responses;
- extension send cannot auto-approve and must match the approved final text;
- final send rechecks critical semantic safety.

The existing organization/conversation scope check still runs before these
policy checks.

## Audit and persistence boundary

Application logs carry safe decision metadata and hashes. Existing
`action_mode`, `approval_status`, and `policy_reasons` fields persist applied
`ENFORCE` state and stable reason/reviewer codes. Authenticated audit logs carry
actor identity and role. Full prompts, customer messages, unsafe replies,
knowledge, secrets, passwords, and OTPs are excluded.

`OBSERVE` decisions are log-only because Stage 5 adds no migration. A process
restart does not provide a queryable historical shadow-decision ledger.

## Rollback

Set `CLARA_POLICY_ENFORCEMENT_MODE=OBSERVE` and restart the backend to stop
applying new enforcement while retaining decision observation. Use `OFF` only
as an emergency compatibility rollback. Do not change persona authority or
semantic revalidation defaults during rollback.

## Known gaps

- No dedicated compliance database role.
- Observation decisions are not persisted as queryable records.
- Complaint detection is conservative static context matching.
- Process state remains heuristic.
- Product facts do not yet have freshness/effective-date enforcement.
- Stage 5 does not enforce automatic sending or production rollout.

## Stage 6 product-fact interaction

Stage 6 closes the freshness/effective-date authority gap through a separate
registry. It does not change policy action, generation strategy, reviewer
requirements for reply approval, or send permission. Fact governance reuses
the configured compliance reviewer-role mapping for lifecycle changes, while
reply approval/send continues through the Stage 5 gate unchanged.

## Stage 7 process-state interaction

Process state supplies factual continuity context only. FUNDED does not permit
personalized trading advice, VERIFIED does not bypass a reviewer, ACCOUNT_ACTIVE
does not bypass complaints, and ACTIVE_SUPPORT does not grant fabricated system
access. Existing policy action, generation strategy, reviewer requirement,
approval, and send gates are unchanged. Default process-state mode is LEGACY.
