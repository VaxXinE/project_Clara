# Clara Support Knowledge Contract

Status: Stage 8.1 stabilization.

Support knowledge is independent from product facts, marketing knowledge, and persona. Level 0 covers safe navigation and official-channel orientation. Level 1 covers verified general procedures for login/access, registration/documents, verification/activation, funding/withdrawal, platform/errors, and post-activation support. It never grants account access or transaction investigation authority.

Lifecycle is `DRAFT → APPROVED → ACTIVE → RETIRED`. Draft and approved articles are not customer-facing. An active article must be customer-safe, verified, effective at request time, and in the selected organization/global scope. Organization scope precedes global. Multiple active articles in the selected scope fail closed to a safe human handoff; activation is rejected while a conflict exists.

Content is limited to 50,000 characters and cannot duplicate mutable product facts such as monetary values, percentages, spread, commission, margin, swap, rollover, or minimum funding. No active records are seeded from assumptions.

Head/superadmin create drafts. Manager may approve; head/superadmin activate or retire. Sales sees only active customer-safe articles and cannot govern lifecycle. Backend organization scope is authoritative; superadmin cross-organization mutations require an explicit scope. Every route mutation writes an authenticated generic audit record with IDs, versions, lifecycle, and source hash—not content.
