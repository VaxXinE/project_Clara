# Clara CS and Complaint Runbook

## Rollout

1. Keep persona `LEGACY`, semantic revalidation `OFF`, policy `OBSERVE`, product facts `LEGACY`, process state `LEGACY`, and service routing `LEGACY`.
2. Apply migrations through head.
3. Create support drafts only from verified official sources. Approve, then activate explicitly.
4. Run routing in `SHADOW`; inspect route/reason/hash counts and false positives. No reply or case may change.
5. Enable `ROUTED` only after controlled UAT. Restart after configuration changes.

## CS operations

- Draft/approved/retired/expired/unverified/unsafe/conflicting articles are ineligible.
- Missing knowledge and status/access requests use deterministic human handoff.
- Never improvise account status, transaction outcome, or mutable product fact.
- Retire a stale article; do not edit an active record into a different authority.

## Complaint operations

- Triage category and severity, then assign an authorized reviewer.
- Append only canonical safe fields. Never paste raw transcript, password, OTP, PIN, API key/token, bank/card credential, identity number, remote-access credential, or unnecessary PII.
- Escalate fraud, legal/regulator, refund/compensation, and financial-loss cases.
- Use the latest optimistic version. A conflict means refresh and retry.
- `RESOLVED` means review work completed; `CLOSED` requires authorized confirmation. Reopen only a matching incident.

Monitor safe route IDs, decision/intake hashes, missing topics, article IDs/source hashes, and complaint category/severity/status/event counts. Never log messages, article content, case summaries, credentials, secrets, or PII.

Rollback: set `CLARA_SERVICE_ROUTING_MODE=LEGACY` and restart. Do not delete case, event, or support history. Live-chat ownership and approval/send configuration are untouched.
