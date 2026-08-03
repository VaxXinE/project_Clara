# Clara Five-Prompt Bundle Contract

## Stage 7 roadmap mapping

Stage 7 governs the Mini behavioral prompt as one release unit. It does not
activate `HYBRID` or `PERSONA`, edit prompt prose, or change Reguler.

Contract version: `1.0`.

## Sections and order

Every complete bundle contains exactly one immutable version of:

1. `instruction`
2. `guardrail`
3. `flow`
4. `personality_mode`
5. `auto_adapt`

That is the runtime composition order. Governance review order is Guardrail,
Instruction, Flow, Personality Mode, then Auto Adapt. Review order metadata
never changes runtime order.

## Persistence and lifecycle

`AIPersonaBundle` records version, status, deterministic bundle hash,
validation report hash, provenance, and actors. `AIPersonaBundleSection`
references an existing immutable `AIPersonaConfigVersion`; prompt content is
not duplicated. Lifecycle is `draft -> validated -> published -> archived`,
with `rejected` available for discarded candidates.

The bundle hash includes contract version, variant, canonical section key,
section version ID, and section content hash. Only one published bundle is
allowed per variant.

## Validation boundary

Deterministic validation blocks incomplete, duplicated, blank, oversized,
wrong-variant, misordered, hash-mismatched, broken, merge-conflicted, or
obviously secret-bearing bundles. It warns about mutable product facts,
policy-like text outside Guardrail, legacy closing terminology, unavailable
system access, mixed import sources, and regulator identifiers.

Warnings require explicit acknowledgement. Lint is not proof of semantic
safety and does not call an LLM.

## Preview and diff

Preview returns the exact five candidate sections, their source/version/hash,
runtime and review order, current effective bundle, authority mode, legacy
overlay state, and separate lower-authority context counts. It exposes no
chain of thought or runtime secrets.

Diff supports candidate/current and bundle/bundle comparisons. Textual output
is bounded; audits store identifiers, hashes, counts, and changed keys rather
than full prompt diff text.

## Atomic publication and rollback

Publication locks current state, verifies the stored validation report and
optimistic current hash, archives the prior bundle, publishes all five selected
section versions, writes one audit record, and commits once. Any failure rolls
back the transaction.

Rollback targets a historical complete bundle, clones five section versions,
creates a new validated bundle with `source_bundle_id`, and atomically publishes
it. Partial rollback is forbidden while complete bundle authority is active.

## Effective-source precedence and fallback

1. Valid complete published bundle: `DATABASE_PUBLISHED_BUNDLE`.
2. No bundle: legacy per-section database publication.
3. No database section: `MARKDOWN_FALLBACK`.
4. No source: `MISSING`.

An invalid published bundle fails closed as
`INVALID_PUBLISHED_BUNDLE_FAIL_CLOSED`; runtime does not mix it with legacy or
Markdown sections.

## Authority boundaries and provenance

The five sections own behavioral playbooks only. Backend safety, policy,
product facts, process state, service routing, complaints, and extension
delivery remain higher authority. Supporting knowledge and response examples
remain separate lower-authority inputs.

New suggestions store bundle ID/version/hash/contract, five version IDs and
hashes, effective-source state, fallback reason, authority mode, and legacy
overlay presence. Full prompt text is never stored in bundle metadata or logs.
