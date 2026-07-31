# Clara Product Fact Migration Map

Status: Stage 6 inventory. Legacy values remain until shadow parity is approved.

| Fact Key | Current Value | Current Location | Current Authority | Registry Candidate | Source | Risk | Migration Status |
|---|---|---|---|---|---|---|---|
| `account.minimum_opening_amount` (mini) | Rp5.000.000 | `clara_legacy_behavior_service.py`, `reply_suggestion_service.py`, Mini `INSTRUCTION.md`, FAQ/examples/guardrail Markdown, regex/tests | Legacy Python + knowledge | 5,000,000 IDR | Existing approved repository statements | Medium | `SEEDED_APPROVED` |
| `company.regulator` | BAPPEBTI | legacy injection, `official_source_service.py`, Mini/Regular Markdown, regex/tests | Legacy Python + official summary + knowledge | BAPPEBTI | BAPPEBTI source reference already in repository | Low | `SEEDED_APPROVED` |
| `company.regulatory_status` | PT Solid Gold Berjangka diawasi BAPPEBTI | legacy injection, official summary, Mini/Regular Markdown/tests | Legacy Python + knowledge | Exact existing sentence | Existing repository official-source summary | Low | `SEEDED_APPROVED` |
| `company.license_reference` | Repository mentions `161/BAPPEBTI/SI/IX/2002` and `1156/BAPPEBTI/SI/3/2007` | `05_solid_prime_website_official_source_kb.md` | Supporting knowledge | Candidate after current-source verification | BAPPEBTI URL | High/legal | `UNRESOLVED` |
| `account.minimum_lot` | No single approved current value | scattered educational/product references | Supporting knowledge | Yes | Current official product source required | High | `UNRESOLVED` |
| `account.eligible_products` | Mini/Regular and instrument examples vary by source | Markdown, product-summary extraction, tests | Supporting knowledge | Yes | Current official product catalog required | Medium | `INVENTORIED` |
| `account.currency` | No single approved registry value | knowledge/examples | Supporting knowledge | Yes | Current account contract required | Medium | `UNRESOLVED` |
| `trading.spread` | Definition only; fixed value intentionally absent | prompt rules, Markdown, official-source fallback, tests | Knowledge + guardrail | Yes | Current official contract/quote required | High | `UNRESOLVED` |
| `trading.commission` | No approved fixed value | prompt rules, Markdown, validators/tests | Guardrail + knowledge | Yes | Current official fee schedule required | High | `UNRESOLVED` |
| `trading.margin` | Educational definition; fixed values absent | Markdown, prompt/intent helpers, tests | Knowledge | Yes | Current official contract required | High | `UNRESOLVED` |
| `trading.swap` | No approved fixed value | golden cases and fallback prohibitions | Guardrail/test | Yes | Current official contract required | High | `UNRESOLVED` |
| `trading.rollover` | No approved fixed value | golden cases and fallback prohibitions | Guardrail/test | Yes | Current official contract required | High | `UNRESOLVED` |
| `trading.overnight_requirement` | No approved fixed value | knowledge/fallback prohibitions | Supporting knowledge | Yes | Current official contract required | High | `UNRESOLVED` |
| `trading.instruments` | Gold/oil/forex/index/SPA/JFX examples, availability not guaranteed | product-summary parser, Markdown, tests | Supporting knowledge | Yes | Current official product catalog required | Medium | `INVENTORIED` |
| `process.initial_data` | Identity, active phone, domicile/data support examples | Mini/Regular instruction and addon Markdown, prompt helper | Flow + knowledge | Yes | Approved onboarding procedure required | Medium | `INVENTORIED` |
| `process.kyc_requirements` | General identity/supporting-data wording | Markdown and prompt helper | Flow + knowledge | Yes | Approved KYC checklist required | Medium | `UNRESOLVED` |
| `process.verification_steps` | Registration/data verification/onboarding descriptions vary | official-source summary and Markdown | Flow + knowledge | Yes | Current official procedure required | Medium | `INVENTORIED` |
| `process.activation_steps` | Onboarding then activation; detail not canonical | Mini/Regular flow/instruction Markdown | Flow | Yes | Approved operating procedure required | Medium | `UNRESOLVED` |
| `process.funding_steps` | Safety direction only; no canonical full procedure | official-source safety entry and Markdown | Guardrail + knowledge | Yes | Approved funding procedure required | High | `UNRESOLVED` |
| `process.withdrawal_steps` | Refer to official current procedure; no canonical steps | official-source summary and Markdown | Knowledge | Yes | Approved withdrawal procedure required | High | `UNRESOLVED` |
| `promotion.current_terms` | No approved active promotion value | prompt prohibitions/tests | Guardrail | Yes | Approved time-bounded promotion document required | High | `UNRESOLVED` |

## Seed rule

Migration `f0a1b2c3d4e5` inserts only the three exact supported facts above with deterministic IDs, source paths, hashes, effective/verification timestamps, revision 1, and `ACTIVE` lifecycle. Insert is guarded by ID existence, so repeated execution cannot duplicate those rows. No zero fee, spread, commission, margin, swap, rollover, overnight, or promotion claim is activated.

## Removal gate

Legacy constants, Markdown statements, regex, fallback text, and tests are intentionally retained. Remove them only after SHADOW produces approved parity evidence, every required fact is fresh, conflict-free, and organization-scoped, and REGISTRY UAT confirms safe fallback and validator behavior.
