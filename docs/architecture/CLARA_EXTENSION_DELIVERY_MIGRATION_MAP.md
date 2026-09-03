# Clara Extension Delivery Migration Map

| Concern | Previous behavior | Governed Tahap 6 owner |
|---|---|---|
| Send order | Browser send, then backend sync | Backend authorize + atomic claim, then browser send |
| Approval | Pending draft became `approved_via_extension_send` | Explicit low-risk approval or existing elevated approval |
| SentMessage | Created by post-send confirmation without prior authority | Created only after confirmed governed `SENT` |
| Snapshot identity | Conversation title/thread used during ingest | Generation snapshot, inbound message, and chat fingerprints |
| Final text | Compared only in policy `ENFORCE` | SHA-256 bound in every governed authorization |
| Duplicate click | UI state/short local lock | UI lock + request idempotency + atomic token claim + unique sent row |
| Uncertain delivery | Sync error after possible customer delivery | `UNKNOWN → RECONCILIATION_REQUIRED`; retry blocked |
| Content messaging | `{type, text}` | Claim reference, user-action marker, and expected hashes |
| Token storage | None | Raw token returned once; only SHA-256 stored |

Migration `fa0b1c2d3e4f` adds three nullable generation fingerprints and a version
to `reply_suggestions`, makes the existing sent-suggestion index unique, and
adds authorization/event ledgers. It does not rewrite operational rows or
customer content. Downgrade removes only Tahap 6 ledger/fingerprint/version
state and restores the previous non-unique sent-message index.
