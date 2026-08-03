# Clara Rollout Metrics Dictionary

Metric contract version: `1.0`. Default reporting window is plan lifetime; promotion gates select only the current stage. Pending/unlabelled observations are excluded where stated. Customer movement is observational and must never be described as causal impact.

| Metric | Numerator | Denominator | Exclusions |
|---|---|---|---|
| approval rate | approved completed candidate reviews | all completed candidate reviews | pending |
| human edit rate | approved drafts with normalized distance > 0 | approved candidate drafts | rejected/pending |
| average normalized edit distance | sum stored normalized Levenshtein distance | approved observations with authorized comparison | missing comparison |
| rejection rate | rejected completed reviews | all completed candidate reviews | pending |
| escalation precision | expected and selected escalations | selected escalations | unlabelled |
| escalation miss | expected but not selected escalations | expected escalations | unlabelled |
| factual correction rate | observations labelled `FACTUAL_CORRECTION` | observations | none |
| process-state regression rate | regression validator occurrences | observations | none |
| generation latency | sum generation milliseconds | observations with latency | missing latency |
| reviewer turnaround | sum review milliseconds | completed reviews with timing | pending/missing timing |
| delivery authorization failure rate | failed candidate delivery authorizations | observations | shadow/internal interpretation required |
| customer movement observation | count by reviewer-provided movement label | eligible post-send observations | never causal attribution |
| complaint leakage | complaint-sales-leak validator occurrences | observations | none |
| sensitive-data leakage | sensitive-leak validator occurrences | observations | none |
| prompt leakage | prompt-leak validator occurrences | observations | none |
| critical validator failure | observations with critical validator IDs | observations | none |
| rollback/pause count | `PAUSED` and `ROLLED_BACK` events | plan | none |

Original and edited reply text are read only from the existing authorized suggestion when a reviewer submits a label; only the aggregate distance is added to rollout observations. Observations contain identifiers, hashes, decisions, counts, timings, labels, and safe reason codes—not prompts, transcripts, raw DOM, credentials, or customer PII.
