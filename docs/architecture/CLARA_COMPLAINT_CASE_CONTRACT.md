# Clara Complaint Case Contract

Status: Stage 8.1 stabilization.

Only `ROUTED` creates or updates a case. `LEGACY` and `SHADOW` never write cases. Complaint reply generation skips the sales LLM and uses the Stage 5 deterministic safe handoff; suggestions stay pending review.

## Safe intake

`ComplaintIntakeResult` records category/severity, category-derived safe summary, canonical requested outcome, required/missing information, sensitive type labels, create/update action, case ID/fingerprint, handoff/reviewer, reason codes, and hash. It retains no raw message.

Safe intake dimensions are what happened, approximate time, channel, affected process, money indicator, account-access indicator, requested outcome, and explicit human request. Credential detectors cover password, OTP, PIN, access token, API key, card/bank credential, full identity-document number, and remote-access credential. Values are discarded; only labels are stored. Customer handoffs remind users not to send credentials.

## Identity and lifecycle

Incident identity uses organization, canonical customer, category, source conversation/channel, normalized issue signature, and a bounded time bucket. Default window is 30 days via `CLARA_COMPLAINT_INCIDENT_WINDOW_DAYS`. Matching active observations update one case; a different signature or observation beyond the window creates another. A closed case reopens only when the same identity still matches within the window.

Statuses are `OPEN`, `TRIAGE_REQUIRED`, `IN_REVIEW`, `WAITING_CUSTOMER`, `ESCALATED`, `RESOLVED`, `CLOSED`, and `REOPENED`. Severity is `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL`; financial loss, refund/compensation, fraud, and legal/regulator incidents are high risk.

Events are append-only and cover `CREATED`, `REOBSERVED`, `ASSIGNED`, `STATUS_CHANGED`, `SEVERITY_CHANGED`, `SAFE_INTAKE_APPENDED`, `ESCALATED`, `RESOLVED`, `CLOSED`, and `REOPENED`. Mutations use optimistic versions. Sales may append only canonical safe intake. Manager handles low/medium cases. High-risk operations and severity downgrades require head/superadmin plus a reason. Cross-organization action requires explicit backend scope.

Complaint intake never changes canonical process state, product facts, policy decisions, approval/send behavior, or live-chat ownership.
