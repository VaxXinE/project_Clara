# Clara Product Fact Governance Runbook

Status: Stage 6 controlled governance.

## Create and verify

1. Open **Knowledge Base → Product Fact Registry**.
2. Choose an existing canonical key and the narrowest correct account/product scope.
3. Copy the value without reinterpretation from an approved current source.
4. Record the source type/reference, effective period, value type/unit, and correct freshness class.
5. Save as `DRAFT`. Never place customer data, tokens, screenshots, or private documents in a fact.
6. A configured compliance reviewer independently checks the source, scope, value, and dates, then selects **Approve**.
7. Confirm `last_verified_at` and activate only when the approved revision should become usable.

Do not activate a zero fee/swap/rollover/margin/promotion claim without explicit approved evidence.

## Expiry and emergency revocation

- **Expire** when the planned validity ends or a replacement is ready.
- **Revoke** immediately when a value/source is incorrect, withdrawn, unsafe, or legally questionable.
- Create a new revision for corrections. Never overwrite history.
- If no safe active replacement exists, allow the resolver to fail closed and let the reviewer confirm the current official source.

Every lifecycle action must have an authenticated audit entry with fact key, revision, status, actor, and source hash—never the full customer conversation.

## Stale facts

1. Filter the registry for `STALE`/`UNVERIFIED`.
2. Re-open the recorded official source.
3. If unchanged, create a new revision or approved re-verification according to the operating policy; do not alter timestamps without checking the source.
4. If changed, preserve the old revision, create the exact replacement, approve it, then activate without overlapping periods.
5. Keep customer replies in draft/manual review while the critical fact is unavailable.

## Conflicts

`CONFLICT` means multiple active revisions overlap for the same organization/key/category/product scope. The resolver returns no value.

1. Do not pick the newest `updated_at` manually.
2. Compare revision, source, and effective period.
3. Revoke or expire the invalid overlap.
4. Confirm exactly one fresh active revision resolves.
5. Record the correction in the incident/change log.

## Shadow mismatch review

Use `/product-facts/shadow-mismatches?account_category=mini` or the registry dashboard. Review only mismatch keys and hashes; retrieve values through the authenticated fact detail endpoint. A mismatch is not permission to change production output. Resolve source authority first.

## Rollback

1. Set `CLARA_PRODUCT_FACT_MODE=LEGACY`.
2. Restart the backend through normal deployment control.
3. Confirm logs show `product_fact_mode=LEGACY` and `registry_injection_used=false`.
4. Keep registry records and audit history intact.
5. Continue human review and file a rollback incident.

Do not change persona, semantic validation, policy enforcement, approval/send, or Tawk settings as part of this rollback.
