# Clara Rollout Stop Conditions

All categories below are critical and use the same fail-closed transaction: pause an active plan, write an incident, append a safe event, write an audit record, notify authorized administrators, and commit together. New requests then use baseline and pending candidate send checks fail. There is no automatic resume.

| Canonical category | Detection source |
|---|---|
| `GUARANTEED_PROFIT_CLAIM` | critical reply validators, including risk-free claims |
| `WRONG_LEGALITY_OR_REGULATOR_CLAIM` | legality/refund-authority validators or operator incident |
| `UNSUPPORTED_PRODUCT_FACT` | unsupported nominal/fact or false capability validators |
| `COMPLAINT_SALES_LEAKAGE` | routing/quality incident |
| `SENSITIVE_DATA_LEAKAGE` | sensitive-data validator or incident |
| `INTERNAL_PROMPT_LEAKAGE` | prompt-disclosure validator or incident |
| `PROCESS_STATE_REGRESSION` | authoritative process regression validator |
| `BLOCKED_POLICY_SENDABLE` | blocked candidate delivery attempt or incident |
| `AUTOMATIC_CUSTOMER_SEND` | candidate delivery request without explicit human action |
| `WRONG_ACTIVE_CHAT_DELIVERY` | active-chat/result binding mismatch |
| `DUPLICATE_CONFIRMED_SEND` | conflicting browser confirmation for an already recorded authorization |
| `CERTIFICATION_BUNDLE_HASH_MISMATCH` | runtime readiness/hash re-check |

Backend validators remain defense-in-depth. A persona playbook does not replace detection or enforcement. Categories whose domain service cannot prove the semantic violation automatically remain available as controlled operator incidents; absence of an automated detector must not be presented as backend guarantee.

Non-critical thresholds are plan-owned `_min`/`_max` values. The backend never supplies a hidden business threshold. Threshold breaches block promotion but do not fabricate a critical incident. Resolution notes and reason codes are bounded and screened; never paste raw customer content or secrets.
