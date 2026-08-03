# Clara Runtime Contract V1

## Stage 7 addendum: five-prompt bundle

The five playbooks may be sourced from one governed Mini bundle. Runtime order
remains `instruction`, `guardrail`, `flow`, `personality_mode`, `auto_adapt`;
roadmap review order is recorded separately as `guardrail`, `instruction`,
`flow`, `personality_mode`, `auto_adapt`.

Safe runtime provenance includes bundle ID/version/hash/contract, section
version IDs and hashes, effective-source state, and fallback reason. It never
contains prompt content. `CLARA_PERSONA_AUTHORITY_MODE` remains the sole
persona runtime switch and defaults to `LEGACY`.

Status: Stage 1 implementation

Version: `1.0`
Module: `clara-backend/app/core/clara_runtime_contract.py`

## 1. Purpose

Kontrak ini memberikan vocabulary, urutan authority, normalisasi legacy, urutan system playbook, dan provenance yang deterministic. Stage 1 tidak mengubah policy decision, approval/send gate, product facts, Tawk ownership, process-state persistence, atau public API values.

## 2. Canonical Authority Order

Urutan dari authority tertinggi ke terendah:

1. `BACKEND_SAFETY_ENFORCEMENT`
2. `POLICY_DECISION`
3. `FIVE_PUBLISHED_SYSTEM_PLAYBOOKS`
4. `STRUCTURED_RUNTIME_STATE`
5. `APPROVED_PRODUCT_FACTS`
6. `SUPPORTING_KNOWLEDGE`
7. `RESPONSE_EXAMPLES`

Makna boundary:

- backend enforcement menentukan hal yang tidak boleh terjadi;
- policy menentukan action mode yang diperbolehkan;
- system playbook menentukan perilaku dan komunikasi Clara;
- runtime state memberikan konteks customer saat ini;
- approved product facts menjadi authority nilai faktual mutable;
- supporting knowledge memberikan detail domain;
- response examples hanya contoh gaya dan tidak boleh mengalahkan fakta atau guardrail.

Stage 1 mendefinisikan urutan ini. Policy dan safety hard gate baru direncanakan untuk stage berikutnya.

## 3. Canonical Vocabulary

### 3.1 Top-level route intent

Route intent menentukan sub-flow utama dan tidak boleh digabung dengan conversation intent:

- `SALES`
- `COMPLIANCE_GENERAL`
- `CS_GENERAL`
- `COMPLAINT`
- `OFF_TOPIC`
- `UNKNOWN`

### 3.2 Conversation intent

Conversation intent menentukan isi reply:

- `INFO_SEEKING`
- `LEGALITY_CHECK`
- `RISK_CHECK`
- `COST_CHECK`
- `PRODUCT_FIT_CHECK`
- `PROCESS_CHECK`
- `READINESS_VALIDATION`
- `OBJECTION`
- `CLOSING_SIGNAL`
- `POST_ACTIVATION_SUPPORT`
- `COMPLAINT_OR_PROBLEM`
- `UNKNOWN`

### 3.3 Interest level

- `COLD`
- `WARM`
- `HOT`
- `UNKNOWN`

Interest level bukan process state. `DELAY` bukan canonical interest level.

### 3.4 Process state

- `NEW_INQUIRY`
- `EXPLORATION`
- `READY_TO_PROCEED`
- `DATA_SUBMITTED`
- `VERIFICATION_IN_PROGRESS`
- `VERIFIED`
- `ONBOARDING_OR_ACTIVATION`
- `ACCOUNT_ACTIVE`
- `FUNDED`
- `ACTIVE_SUPPORT`
- `UNKNOWN`

`PROCESS_STATE_METADATA` menyediakan description dan ordering metadata untuk observability/desain berikutnya. Stage 1 belum menerapkan transition atau anti-regression dan tidak menulis ulang field database lama.

### 3.5 Personality mode

- `RELAX`
- `TRUST`
- `AUTHORITY`
- `ACTION`

`CLOSING` bukan canonical personality mode. Input legacy `CLOSING` dinormalisasi menjadi `ACTION`, sementara original value dan legacy signal tetap tersedia.

### 3.6 Action mode

- `NORMAL`
- `HUMAN_REVIEW`
- `SAFE_HANDOFF`
- `BLOCK`
- `UNKNOWN`

Compatibility aliases:

| Legacy input | Canonical value |
|---|---|
| `auto_draft_only`, `reply_direct`, `reply_now` | `NORMAL` |
| `human_approval_required` | `HUMAN_REVIEW` |
| `escalate_to_human` | `SAFE_HANDOFF` |

Runtime policy masih menyimpan/mengirim legacy strings yang sama. Normalizer belum digunakan sebagai policy gate.

## 4. Legacy Normalization Contract

Semua helper menerima casing campuran, tidak crash pada unknown value, dan mengembalikan:

```json
{
  "canonical_value": "ACTION",
  "original_value": "closing",
  "was_normalized": true,
  "is_legacy": true,
  "is_unknown": false,
  "legacy_signal": "CLOSING",
  "warning": "Legacy value CLOSING normalized to ACTION."
}
```

Aturan penting:

- original input tidak dihancurkan;
- input unknown menjadi canonical `UNKNOWN`;
- `DELAY` dipertahankan sebagai `legacy_signal=DELAY`;
- canonical interest untuk `DELAY` adalah `UNKNOWN`;
- tidak ada implicit mapping `DELAY` ke COLD/WARM/HOT.

## 5. System Playbook Order and Precedence

Urutan system section selalu:

1. `INSTRUCTION`
2. `GUARDRAIL`
3. `FLOW`
4. `PERSONALITY_MODE`
5. `AUTO_ADAPT`

Untuk setiap variant dan section:

1. versi database dengan status `published` dipakai jika tersedia;
2. jika tidak tersedia atau database gagal dibaca, hanya section itu yang fallback ke Markdown;
3. jika keduanya tidak tersedia, section dicatat sebagai `MISSING`;
4. kegagalan satu section tidak memaksa section lain ikut fallback;
5. supporting playbook disusun setelah system playbook dan tidak mencakup ulang lima system files;
6. urutan tidak bergantung filesystem enumeration.

Public admin endpoint `/ai-persona-config/effective` tetap backward-compatible: `source` masih `database|markdown` dan prompt content tetap tersedia hanya pada endpoint superadmin tersebut.

## 6. Provenance Model

Internal `PromptSectionProvenance` mencatat:

- `section_name`;
- `effective_source`: `DATABASE_PUBLISHED`, `MARKDOWN_FALLBACK`, atau `MISSING`;
- source identifier DB atau repository-relative Markdown path;
- version number jika ada;
- publication timestamp jika ada;
- SHA-256 content hash;
- load timestamp;
- fallback reason.

Contoh fallback reason:

- `NO_DATABASE_PUBLISHED_VERSION`;
- `DATABASE_UNAVAILABLE`;
- `DATABASE_NOT_REQUESTED`;
- `NO_DATABASE_PUBLISHED_VERSION_AND_MARKDOWN_MISSING`.

Full content tidak dimasukkan ke `debug_metadata()` dan tidak ditulis ke log provenance.

## 7. Runtime Debug Representation

`ClaraPlaybookComposition.debug_metadata()` mengembalikan data internal aman:

- runtime contract version;
- authority order;
- active system-section provenance;
- legacy overlay presence/name;
- supporting knowledge count;
- missing required sections.

Representation ini tidak memiliki endpoint publik baru dan tidak mengandung prompt content atau customer data.

## 8. Legacy Python Overlay

Hard-coded Python behavior di `build_reply_system_prompt()` dan helper terkait tetap dipertahankan sebagai:

`LEGACY_BEHAVIOR_OVERLAY`

Stage 1 hanya memberi boundary dan visibility. Overlay belum dipindahkan atau dihapus agar business outcome tidak berubah tanpa golden semantic evaluation.

Runtime contract version dan overlay marker masuk ke safe reply-generation logs serta authenticated audit metadata. Version belum ditambahkan ke `reply_suggestions` karena itu memerlukan perubahan persistence/schema.

## 9. Minor Composition Change

Sebelum Stage 1, `load_clara_response_playbook()` dengan multi-reply dapat memasukkan kembali lima Markdown system files melalui mekanisme “remaining files”. Akibatnya published DB section bisa didampingi salinan Markdown lama pada supporting layer.

Stage 1 mengecualikan lima system files dari supporting composition. System section tetap memuat content yang sama melalui canonical DB-per-section/Markdown fallback. Perubahan ini diperlukan agar published precedence deterministic dan tercakup unit test.

Tidak ada product fact, policy decision, approval/send behavior, atau Tawk behavior yang diubah.

## 10. Unresolved Business Decisions

- Apakah `DELAY` merupakan sales timing signal, follow-up state, atau nilai lain?
- Kapan canonical route/conversation intent menggantikan classifier legacy?
- Apa process-state transition dan anti-regression rules?
- Apakah `HUMAN_REVIEW` dan `SAFE_HANDOFF` harus menjadi universal backend hard gate?
- Apakah `COMPLAINT` masih boleh menghasilkan safe draft?
- Kapan legacy API action-mode strings dapat dimigrasikan?
- Kapan contract version perlu dipersist pada suggestion?

## 11. Stage 2 Extraction Plan

Recommended scope Stage 2:

1. inventarisasi setiap rule dalam `LEGACY_BEHAVIOR_OVERLAY`;
2. klasifikasikan rule ke safety enforcement, policy, system behavior, runtime state, product fact, supporting knowledge, atau example;
3. pindahkan behavioral prose ke published system sections tanpa mengubah fakta;
4. pertahankan backend validator/security rule sebagai code;
5. gunakan golden fixture untuk regression sebelum menghapus overlay;
6. hapus duplikasi satu kelompok rule per perubahan kecil;
7. jangan sekaligus membuat policy hard gate, state FSM, atau product-fact migration.

Stage 2 tidak dimulai oleh dokumen ini.

## 12. Stage 2 Persona Authority Modes

Stage 2 menambahkan `CLARA_PERSONA_AUTHORITY_MODE` melalui settings dengan default `LEGACY`.

### LEGACY

Urutan efektif: technical output contract, runtime context, legacy product-fact injection, lima structured legacy behavior fragments, five system playbooks, supporting knowledge, lalu response examples. Legacy user-prompt path tetap dipakai untuk production compatibility.

### HYBRID

Urutan efektif: technical/safety constraints, policy metadata, five system playbooks, runtime context, product facts, approved compatibility fragment bila canonical section terkait missing, supporting knowledge, lalu response examples.

Full `LEGACY_BEHAVIOR_OVERLAY` tidak ikut. Published/Markdown effective section menang atas compatibility fragment dengan canonical destination yang sama.

### PERSONA

Urutan efektif: technical/safety constraints, policy metadata, five system playbooks, runtime context, product facts, supporting knowledge, lalu examples.

Tidak ada legacy fragment, marker overlay, atau instruksi personality `CLOSING`. Personality canonical menggunakan `ACTION`. Python user prompt pada mode ini hanya membawa technical/policy metadata, runtime data, facts, knowledge, dan conversation context.

## 13. Stage 2 Boundaries and Metadata

Technical shell version `1.0` tetap Python-owned dan mencakup schema compatibility, jumlah draft, bubble/length instruction, Bahasa Indonesia, JSON-only output, serta larangan menampilkan chain-of-thought.

Product facts belum dimigrasikan. Scope perusahaan/produk, variant focus lama, dan legal supervision statement ditandai sebagai `LEGACY_PRODUCT_FACT_INJECTION`. Nilainya tidak diubah dan tidak diduplikasi ke behavioral fragments.

Safe internal metadata mencakup runtime contract version, normalized/original persona authority mode, system provenance, legacy overlay presence, included fragment names, technical shell version, product-fact injection presence, supporting/example counts, dan deterministic prompt SHA-256.

Prompt content dan customer message tidak disimpan dalam metadata. Metadata generation masih in-memory/log-only karena persistence baru membutuhkan migration.

Classification lengkap: `docs/architecture/CLARA_LEGACY_BEHAVIOR_MIGRATION_MAP.md`.

## 14. Stage 3 Retry Contract

Stage 3 menambahkan retry contract terpisah version `1.0`.

- Technical retry authority: JSON-only, schema, reply count, parser
  compatibility, validator IDs, correction target IDs, dan no-Markdown.
- Behavioral retry authority: named legacy fragments pada `LEGACY`, explicit
  missing-section fallback pada `HYBRID`, dan five playbooks saja pada
  `PERSONA`.
- Plain-JSON repair tidak menambahkan behavior.
- Retry debug metadata mengekspos hash/IDs/names, bukan content.

Validator registry memetakan setiap detector ke salah satu:
`BACKEND_SAFETY`, `GUARDRAIL`, `FLOW`, `PERSONALITY_MODE`, `AUTO_ADAPT`,
`PRODUCT_FACT`, `TECHNICAL_OUTPUT`, atau `RUNTIME_CONTEXT`.

Production default tetap `LEGACY`. Contract ini tidak mengubah product facts,
policy outcome, approval/send, complaint routing, Tawk, model ORM, atau schema
database.

Detail parity dan safety coverage:
`docs/architecture/CLARA_PERSONA_PARITY_AND_RETRY_CONTRACT.md`.

## 15. Stage 4 Semantic Validation Contract

`CLARA_VALIDATION_CONTRACT_VERSION = "1.0"` defines typed validator results,
reply hashes, failed/passed IDs, critical failures, warnings, reason codes,
authority owners, safe diagnostics, and retry eligibility. Debug metadata
excludes evaluated reply text.

`CLARA_SEMANTIC_REVALIDATION_MODE`:

- `OFF` is the default and preserves Stage 3 output selection;
- `OBSERVE` validates retry and JSON-repair output without enforcing a result;
- unknown values normalize to `OFF`;
- `ENFORCE` does not exist in Stage 4.

Runtime capabilities default to no access/no authority. Claiming a system
status or refund authority while the corresponding capability is unavailable
is reported as a critical observation. Metadata remains log-only because no
ORM or database migration is introduced.

## 16. Stage 5 Policy Enforcement Contract

Stage 5 introduces `CLARA_ENFORCEMENT_CONTRACT_VERSION = "1.0"` and the
`OFF`, `OBSERVE`, and `ENFORCE` rollout modes. Default is `OBSERVE`.

The backend decision owns generation strategy, reviewer requirement, and send
permission. In `ENFORCE`, critical semantic failures cannot become normal
drafts, contextual complaints use a deterministic safe handoff, and blocked
records contain no customer-facing draft. Approval and send services enforce
the same decision boundary; extension explicit send cannot auto-approve a
pending suggestion.

Safe decision metadata uses IDs and hashes only. Observation history remains
log-only because no migration is added. See
`docs/architecture/CLARA_POLICY_ENFORCEMENT_CONTRACT.md`.

## 17. Stage 6 Product Fact Contract

`CLARA_PRODUCT_FACT_MODE` supports `LEGACY`, `SHADOW`, and `REGISTRY`, default
`LEGACY`. The product-fact service owns lifecycle, effective time, freshness,
scope precedence, conflict detection, safe fallback, prompt rendering, and
mutable-fact validator values. Full values/provenance are not logged.

The runtime authority order remains: backend security/policy, technical output,
persona behavior, runtime context, product facts, then supporting knowledge.
Stage 6 does not change persona (`LEGACY`), semantic (`OFF`), or policy
(`OBSERVE`) defaults. See
`docs/architecture/CLARA_PRODUCT_FACT_REGISTRY_CONTRACT.md`.

## 18. Stage 7 Process-State Contract

`CLARA_PROCESS_STATE_MODE` supports `LEGACY`, `SHADOW`, and `FSM`, default
`LEGACY`. The Stage 1 `ProcessState` vocabulary is now persisted once per
canonical customer profile with append-only decision history and optimistic
versioning. UNKNOWN is not inferred from, nor replaced by, pipeline stage or
temperature.

LEGACY and SHADOW preserve prompt/validator output. FSM adds
`canonical_process_state` to structured runtime context and continuity
validation only. It does not enter persona playbooks and cannot override
backend security, product facts, policy, reviewer, approval/send, complaint,
or Tawk authority. See
`docs/architecture/CLARA_PROCESS_STATE_FSM_CONTRACT.md`.

## 19. Stage 8/8.1 Service Routing Contract

Stage 8 adds `CLARA_SERVICE_ROUTING_MODE` with safe default `LEGACY`.
`SHADOW` records only deterministic route metadata. `ROUTED` separates CS
L0/L1 and contextual complaints from sales generation; complaints reuse the
Stage 5 handoff and create an idempotent case ledger. Missing CS knowledge
fails to human handoff. Other defaults, facts, process state, policy,
approval/send, and Tawk behavior remain unchanged.

Stage 8.1 stabilizes this as routing contract `1.1`: complete typed decisions,
structured credential-safe complaint intake, bounded incident identity,
append-only mutation events, support conflict fail-closed behavior, and an
audited restoration of formatter-only Stage 8 files. The default is unchanged.

## 20. Tahap 6 Extension Delivery Contract

`CLARA_EXTENSION_DELIVERY_MODE` supports `LEGACY`, `OBSERVE`, and `GOVERNED`,
default `LEGACY`. `GOVERNED` binds the reviewed suggestion to user,
organization, conversation, version, active chat, snapshot, latest inbound
message, and final-text hashes. A short-lived token is stored only as SHA-256,
claimed atomically before DOM send, and reconciled as `SENT`, `FAILED`, or
`RECONCILIATION_REQUIRED`. Delivery consumes existing policy, fact, state, and
routing authority without overriding it. See
`docs/architecture/CLARA_EXTENSION_DELIVERY_CONTRACT.md`.
