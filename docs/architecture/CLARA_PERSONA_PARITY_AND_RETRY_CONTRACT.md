# Clara Persona Parity and Retry Contract

## Stage 7 bundle publication boundary

Stage 7 changes publication granularity, not retry authority. HYBRID/PERSONA
continue to consume the five canonical playbooks in the existing runtime
order. When a complete bundle is active, retry composition receives those five
versions as one coherent source; technical retry and validator ownership remain
unchanged. No bundle publication activates HYBRID or PERSONA.

Status: Stage 3 implementation

Contract version: `CLARA_RETRY_CONTRACT_VERSION = "1.0"`

Production default: `LEGACY`

## 1. Authority Boundary

Primary generation uses the Stage 2 authority order:

1. backend safety and policy decision;
2. technical output shell;
3. five effective system playbooks;
4. structured runtime context;
5. unchanged legacy product-fact injection;
6. supporting knowledge and response examples.

Retry generation uses `clara_reply_retry_service.py`. Detection remains
backend-owned, while behavioral communication follows `PersonaAuthorityMode`.
The plain-JSON repair path may only repair schema/parser compatibility and
must not add sales, personality, flow, closing, or product-positioning rules.

## 2. Retry Result

`RetryCompositionResult` contains:

- content, held internally;
- authority mode;
- validator IDs;
- technical instruction IDs;
- named behavioral fragments;
- legacy-behavior presence;
- deterministic SHA-256 content hash;
- retry contract version.

`debug_metadata()` intentionally excludes content. Runtime logs record hashes,
IDs, versions, mode, fallback use, and named fragments, never the full prompt,
customer message, knowledge content, secrets, or personal data.

## 3. Mode Behavior

### LEGACY

The five named retry compatibility fragments preserve the former retry
meaning: style, product selection, process continuity, concrete detail, and
legality grounding. The anonymous behavioral block was removed from
`reply_suggestion_service.py`.

### HYBRID

The five playbooks remain primary. Retry receives validator IDs, correction
target IDs, and canonical section references. The only approved compatibility
fallback is `legacy_retry_legality_grounding`, and it is included only when
the effective `GUARDRAIL` section is missing and a relevant validator fired.

### PERSONA

Retry contains technical output requirements, validator IDs, correction
target IDs, and canonical section references. It contains no legacy fragment,
sales-flow prose, personality selection, COLD/WARM/HOT guidance, objection
strategy, closing strategy, or Python-owned JAWAB/FRAME/DIRECTION instruction.
`ACTION` remains the canonical personality value.

## 4. Validator Registry

Each registry row defines `validator_id`, category, canonical authority owner,
severity, retry instruction type, correction target, and safe metadata.

| Category | Validator IDs | Canonical owners |
|---|---|---|
| Grounding/legal | missing_product_options, unsupported_variant, unnecessary_variant, missing_legality_authority, vague_legality_deflection, unsupported_fixed_sensitive_number | PRODUCT_FACT, GUARDRAIL, RUNTIME_CONTEXT |
| Continuity | post_signup_regression, repeated_product_selection, repeated_identity_request, abstract_data_requirement, vague_process_direction, repeated_onboarding, followup_topic_break, subject_focus_break, insufficient_concrete_detail, missing_latest_intent | FLOW, RUNTIME_CONTEXT |
| Style | mixed_register, repetitive_closing, response_similarity, generic_opening, unnecessary_question, source_dump_opening | PERSONALITY_MODE, AUTO_ADAPT |

The registry carries compact correction target IDs, not customer-facing prompt
prose. Backend validators remain defense-in-depth and were not removed.

## 5. Safety Coverage Matrix

| Required behavior | Backend validator | Playbook | Legacy fragment | L/H/P | Remaining gap |
|---|---|---|---|---|---|
| No guaranteed profit | None universal | GUARDRAIL | legacy_guardrail_safety | Yes/Yes/Yes | Prompt-only |
| No risk-free claim | None universal | GUARDRAIL | legacy_guardrail_safety | Yes/Yes/Yes | Prompt-only |
| No invented product fact | unsupported fixed number; unsupported variant | GUARDRAIL | legacy_guardrail_safety | Yes/Yes/Yes | Partial fact coverage |
| No buy/sell/all-in advice | None universal | GUARDRAIL | legacy_guardrail_safety | Yes/Yes/Yes | Prompt-only |
| No process regression | post-signup regression; vague direction | FLOW | legacy_flow_movement | Yes/Yes/Yes | No persisted FSM |
| No repeated verification | vague direction | FLOW | legacy_flow_movement | Yes/Yes/Yes | Heuristic only |
| No repeated onboarding | repeated onboarding | FLOW | legacy_flow_movement | Yes/Yes/Yes | Retry is not semantically revalidated |
| No unsupported fixed sensitive number | unsupported fixed number | GUARDRAIL | legacy_retry_legality_grounding | Yes/Yes/Yes | Configured patterns only |
| No fake verification access | None | GUARDRAIL | None | No/No/No | Dedicated enforcement/rule missing |
| No unsupported legal detail | legality authority; vague deflection | GUARDRAIL | legacy_retry_legality_grounding | Yes/Yes/Yes | Not every invented detail detected |

Availability means the behavior has an identified prompt or validator source;
it does not imply universal backend enforcement.

## 6. Shadow Evaluation

Run from the repository root:

```bash
uv run python scripts/evaluate_clara_persona_parity.py
```

The tool loads exactly 20 synthetic golden cases and composes all three modes
(60 compositions). It makes no OpenAI call and no database write. Default
outputs are ignored local files:

- `tmp/clara-persona-parity.json`
- `tmp/clara-persona-parity.md`

The report contains structural booleans, section names, fragment names, gaps,
and prompt hashes. It does not emit customer messages or full prompts.
`--include-safe-excerpts` adds only truncated structural identifiers.

## 7. Known Gaps and Readiness

HYBRID is structurally ready for controlled shadow/canary evaluation when all
five effective sections are present. It is not approved as production default
until semantic quality is reviewed and retry outputs are revalidated.

PERSONA has no detected Python retry behavior leak, but is not production-ready:
several safety behaviors remain prompt-only, fake verification-access claims
lack guaranteed coverage, process state is heuristic, and retry output is not
semantically revalidated.

Stage 4 recommendation: controlled semantic revalidation and non-production
quality review of retry results. Do not combine it with product-fact registry,
process FSM, mandatory human-review enforcement, or production mode switching.

## 8. Stage 4 Observation Update

The safety matrix now has deterministic observation coverage for clear
guaranteed-profit, risk-free, personalized buy/sell, all-in/full-margin,
fake-status-access, and unauthorized refund/compensation claims.

This does not convert prompt authority into an enforcement gate. New critical
validators are observation-only, retry results are revalidated only in
`OBSERVE`, and production selection remains unchanged. Detailed limitations
and canary gates are recorded in
`docs/quality/CLARA_STAGE_4_READINESS_REPORT.md`.

## 9. Stage 7 Process-State Interaction

The former “No persisted FSM” continuity gap is addressed by a separate
customer-level state contract. In FSM mode, retry validator IDs still describe
detected output failures while factual progress comes from structured runtime
state. Process state is not persona prose and adds no legacy behavioral retry
fragment. LEGACY and SHADOW prompt parity remains unchanged.

Sensitive-state correctness is still limited by available authoritative data
sources; Stage 7 does not claim external access to verification, activation,
or funding systems.
