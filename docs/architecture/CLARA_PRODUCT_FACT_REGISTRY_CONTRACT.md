# Clara Product Fact Registry Contract

> Stage 8: support knowledge is a separate store and cannot override or
> supply mutable product facts governed by this registry.

Status: Stage 6 implementation, contract version `1.0`.

## Authority boundary

The registry owns mutable customer-facing product facts. Persona playbooks own behavior, the policy engine owns action/review/send decisions, runtime context owns current conversation state, and supporting knowledge remains lower authority. Registry records never contain customer data, credentials, or prompts.

`CLARA_PRODUCT_FACT_MODE` accepts `LEGACY`, `SHADOW`, and `REGISTRY`; missing or invalid values normalize to `LEGACY`.

- `LEGACY`: the existing injection, knowledge, and validators remain customer-facing. Registry writes and inspection are allowed.
- `SHADOW`: registry resolution and validator comparison run in parallel; only safe keys, revision IDs, hashes, freshness, conflicts, and mismatch keys are logged. Legacy output is unchanged.
- `REGISTRY`: only fresh, effective `ACTIVE` facts are injected. Legacy product-fact injection, prioritized fact brief, product summary, grounded product knowledge, and supporting product examples are excluded from the composed prompt path.

No mode is enabled automatically.

## Data and lifecycle

Each `product_facts` row is an immutable business revision identified by `(organization, fact_key, account_category, product_code, revision)`. `supersedes_fact_id` links history.

Lifecycle:

1. `DRAFT`: editable only by creating another revision; never customer-facing.
2. `APPROVED`: verified by an authorized reviewer; not customer-facing.
3. `ACTIVE`: eligible only inside its effective period and while fresh.
4. `EXPIRED`: ineligible due to governance decision/end of validity.
5. `REVOKED`: immediately ineligible; use for unsafe or incorrect facts.

Allowed transitions are `DRAFT → APPROVED → ACTIVE`, `APPROVED|ACTIVE → EXPIRED`, and `APPROVED|ACTIVE → REVOKED`. Every route transition is authenticated, organization-scoped, and audited. Values are not edited in place.

## Resolution

Resolution order is deterministic:

1. organization + exact account category + exact product scope;
2. global organization + exact category/product scope;
3. organization + global category + product scope;
4. global organization + global category/product scope;
5. no fallback.

Modification time never selects authority. At a given instant, exactly one effective `ACTIVE` revision may resolve. More than one produces `CONFLICT` and no value is injected. Other closed outcomes are `MISSING`, `STALE`, `EXPIRED`, `REVOKED`, and `UNAPPROVED`.

Effective boundaries are `[effective_from, effective_until)`: start is inclusive and end is exclusive. All comparisons normalize to UTC.

## Freshness

Freshness uses `last_verified_at`, never repository modification time.

| Class | Default maximum age | Examples |
|---|---:|---|
| `HIGH_VOLATILITY` | 7 days | promotion, spread, commission, margin, swap, rollover, overnight terms |
| `MEDIUM_VOLATILITY` | 30 days | minimum opening amount, instruments, KYC and account procedures |
| `LOW_VOLATILITY` | 90 days | company and regulator identity |

Thresholds are configurable through `CLARA_PRODUCT_FACT_*_VOLATILITY_DAYS`. Missing verification is `UNVERIFIED`; an unverified or stale active record resolves as `STALE` and is excluded from injection.

## Prompt and validator integration

`clara_product_fact_service.py` is the only reply-facing registry abstraction. `reply_suggestion_service.py` does not query the table directly.

Registry prompt content includes customer-safe rendered values only. Provenance IDs, source references, and hashes remain internal metadata. A missing/stale/conflicting fact produces a deterministic draft-only verification message without internal keys or lifecycle names.

The fixed-sensitive-number validator keeps current behavior in `LEGACY`, compares registry behavior without changing the result in `SHADOW`, and accepts only resolved registry amounts in `REGISTRY`. Critical safety validators remain unchanged.

## Roles and APIs

- sales: list only fresh, effective, customer-safe facts;
- manager: inspect revisions, freshness, conflicts, and shadow comparison;
- configured compliance reviewer roles (default head/superadmin): create drafts and approve/activate/expire/revoke;
- superadmin: may additionally create global facts.

Endpoints are under `/product-facts`. Frontend controls are convenience only; backend authentication, CSRF protection, role checks, and organization scope are authoritative.

## Observability and privacy

Safe metadata: mode, resolved/missing/stale/conflicting/mismatch keys, revision IDs, content hashes, injection/fallback flags, and contract version. Logs must not contain full prompts, customer messages, secrets, private data, or unapproved values.

## Rollback

Set `CLARA_PRODUCT_FACT_MODE=LEGACY` and restart the backend. Do not delete registry history. Persona, semantic revalidation, policy enforcement, approval/send, and Tawk settings remain unchanged.

## Known limits

- Only three repository-supported legacy facts are initially active.
- Other canonical keys remain unresolved until a reviewer verifies an approved source.
- Shadow mismatch history is operational metadata, not a dedicated analytics ledger.
- Registry mode requires controlled UAT before production activation.
