# Clara Legacy Behavior Migration Map

Status: Stage 2 implementation

Source audited: `clara-backend/app/services/reply_suggestion_service.py`

Stage 2 memisahkan behavior dari technical output, runtime context, dan product facts. Default runtime tetap `LEGACY`; dokumen ini bukan persetujuan untuk mengubah fakta atau policy.

## Rule Classification

| Legacy Rule ID | Existing Location | Existing Rule Summary | Canonical Destination | Retained in Technical Shell? | Retained in Product Facts? | Legacy Fragment | Status | Removal Stage |
|---|---|---|---|---|---|---|---|---|
| LBR-I-01 | System identity | Clara sebagai AI Sales Copilot | INSTRUCTION | No | No | `legacy_instruction_role` | EXTRACTED | Stage 3 |
| LBR-I-02 | System identity | Bukan customer service generik | INSTRUCTION | No | No | `legacy_instruction_role` | EXTRACTED | Stage 3 |
| LBR-I-03 | System objective | Memahami kebutuhan dan next step ringan | INSTRUCTION | No | No | `legacy_instruction_role` | EXTRACTED | Stage 3 |
| LBR-I-04 | User core rules | Jawab customer secara relevan | INSTRUCTION | No | No | Legacy user prompt | UNRESOLVED | Stage 3 |
| LBR-G-01 | System guardrail | Tidak menjamin profit | GUARDRAIL | No | No | `legacy_guardrail_safety` | EXTRACTED | Stage 3 |
| LBR-G-02 | System guardrail | Tidak menyatakan bebas risiko | GUARDRAIL | No | No | `legacy_guardrail_safety` | EXTRACTED | Stage 3 |
| LBR-G-03 | System source rules | Tidak mengarang fakta | GUARDRAIL | No | No | `legacy_guardrail_safety` | EXTRACTED | Stage 3 |
| LBR-G-04 | System guardrail | Tidak hard selling/memaksa deposit | GUARDRAIL | No | No | `legacy_guardrail_safety` | EXTRACTED | Stage 3 |
| LBR-G-05 | System guardrail | Tidak memberi buy/sell/all-in advice | GUARDRAIL | No | No | `legacy_guardrail_safety` | EXTRACTED | Stage 3 |
| LBR-G-06 | Semantic validators | Product/risk/legal output validation | Backend enforcement | Yes | No | — | TECHNICAL | Validator stage |
| LBR-F-01 | System pattern | JAWAB → FRAME → DIRECTION | FLOW | No | No | `legacy_flow_movement` | EXTRACTED | Stage 3 |
| LBR-F-02 | System objective | Jawab pertanyaan terakhir lebih dahulu | FLOW | No | No | `legacy_flow_movement` | EXTRACTED | Stage 3 |
| LBR-F-03 | System movement | Ragu ditangani sebelum arah lanjut | FLOW | No | No | `legacy_flow_movement` | EXTRACTED | Stage 3 |
| LBR-F-04 | System movement | HOT tidak kembali ke edukasi umum | FLOW | No | No | `legacy_flow_movement` | EXTRACTED | Stage 3 |
| LBR-F-05 | Runtime rules | Tidak mundur setelah data diserahkan | FLOW | No | No | `legacy_flow_movement` | EXTRACTED | Stage 3 |
| LBR-F-06 | Runtime rules | Tidak ulang verifikasi setelah selesai | FLOW | No | No | `legacy_flow_movement` | EXTRACTED | Stage 3 |
| LBR-F-07 | Runtime rules | Tidak ulang onboarding setelah aktivasi | FLOW | No | No | `legacy_flow_movement` | EXTRACTED | Stage 3 |
| LBR-F-08 | Intent helpers | Intent-specific movement | FLOW | No | No | Legacy user prompt | UNRESOLVED | Stage 3 |
| LBR-P-01 | System style | Chat natural, singkat, tidak robotik | PERSONALITY_MODE | No | No | `legacy_personality_chat` | EXTRACTED | Stage 3 |
| LBR-P-02 | System analysis | RELAX / TRUST / AUTHORITY | PERSONALITY_MODE | No | No | `legacy_personality_chat` | EXTRACTED | Stage 3 |
| LBR-P-03 | System analysis | CLOSING compatibility term | PERSONALITY_MODE/ACTION | No | No | `legacy_personality_chat` (LEGACY only) | DUPLICATE | Stage 3 |
| LBR-P-04 | Register helpers | Register dan bentuk jawaban | PERSONALITY_MODE | No | No | Legacy user prompt | UNRESOLVED | Stage 3 |
| LBR-A-01 | System analysis | COLD / WARM / HOT adaptation | AUTO_ADAPT | No | No | `legacy_auto_adapt` | EXTRACTED | Stage 3 |
| LBR-A-02 | System analysis | Adaptasi emosi | AUTO_ADAPT | No | No | `legacy_auto_adapt` | EXTRACTED | Stage 3 |
| LBR-A-03 | System style | Ikuti panjang dan energi customer | AUTO_ADAPT | No | No | `legacy_auto_adapt` | EXTRACTED | Stage 3 |
| LBR-A-04 | Question discipline | Adaptasi kedalaman/CTA | AUTO_ADAPT | No | No | Legacy user prompt | UNRESOLVED | Stage 3 |
| LBR-T-01 | Output blocks | Tepat 1 atau 3 suggestions | TECHNICAL_OUTPUT_CONTRACT | Yes | No | — | TECHNICAL | Keep in Python |
| LBR-T-02 | Output blocks | JSON schema/tanpa teks tambahan | TECHNICAL_OUTPUT_CONTRACT | Yes | No | — | TECHNICAL | Keep in Python |
| LBR-T-03 | Output blocks | Bubble dan sentence limits | TECHNICAL_OUTPUT_CONTRACT | Yes | No | — | TECHNICAL | Keep in Python |
| LBR-T-04 | OpenAI/parser | Structured output dan fallback parser | TECHNICAL_OUTPUT_CONTRACT | Yes | No | — | TECHNICAL | Keep in Python |
| LBR-T-05 | Pydantic/validators | Shape, count, length validation | TECHNICAL_OUTPUT_CONTRACT | Yes | No | — | TECHNICAL | Keep in Python |
| LBR-R-01 | Active context | Intent/register/commitment | RUNTIME_CONTEXT | No | No | — | RUNTIME_CONTEXT | Keep as data |
| LBR-R-02 | Active context | Variant commitment/focus | RUNTIME_CONTEXT | No | No | — | RUNTIME_CONTEXT | Keep as data |
| LBR-R-03 | Active context | Identity submission flag | RUNTIME_CONTEXT | No | No | — | RUNTIME_CONTEXT | Keep as data |
| LBR-R-04 | Active context | Verification-completion flag | RUNTIME_CONTEXT | No | No | — | RUNTIME_CONTEXT | Keep as data |
| LBR-H-01 | System identity | Company/product scope | Product Fact Registry | No | Yes | — | PRODUCT_FACT | Product Fact Registry stage |
| LBR-H-02 | System variant focus | Mini/Reguler positioning | Product Fact Registry | No | Yes | — | PRODUCT_FACT | Product Fact Registry stage |
| LBR-H-03 | System legal block | BAPPEBTI supervision statement | Product Fact Registry | No | Yes | — | PRODUCT_FACT | Product Fact Registry stage |
| LBR-H-04 | Fact briefs | Amounts, instruments, process, legal details | Product Fact Registry | No | Yes | — | PRODUCT_FACT | Product Fact Registry stage |

## Totals

- Total rules classified: 39
- INSTRUCTION: 4
- GUARDRAIL/backend safety: 6
- FLOW: 8
- PERSONALITY_MODE: 4
- AUTO_ADAPT: 4
- TECHNICAL_OUTPUT_CONTRACT: 5
- RUNTIME_CONTEXT: 4
- PRODUCT_OR_OPERATIONAL_FACT: 4

Status: 20 `EXTRACTED`, 6 `TECHNICAL`, 4 `RUNTIME_CONTEXT`, 4 `PRODUCT_FACT`, 1 `DUPLICATE`, dan 4 `UNRESOLVED`. Satu guardrail enforcement rule termasuk dalam technical classification.

## Stage 2 Runtime Result

- `LEGACY` memakai lima structured fragments dan legacy user-prompt path.
- `HYBRID` memakai five system playbooks sebagai authority utama. Compatibility guardrail hanya masuk jika effective guardrail missing.
- `PERSONA` tidak memakai legacy fragments dan memakai user prompt data-only.
- Product facts tetap di `LEGACY_PRODUCT_FACT_INJECTION` dan knowledge/fact path lama.
- Schema, parser, validator, retry, policy, approval, send, dan channel flow tetap di backend.

## Unresolved Collisions

- Legacy user-prompt helpers masih aktif pada `LEGACY` untuk production parity.
- Intent extraction dan deterministic reply regex masih dapat berbeda.
- Process milestone masih heuristic, belum FSM.
- Product facts masih tersebar di Python, knowledge, official source, dan validator.
- Human-review action masih metadata, belum universal backend gate.
- Semantic validator retry gap dari Stage 0 belum diubah.

## Stage 3 Recommendations

1. Bandingkan `LEGACY` dan `HYBRID` memakai golden fixture tanpa mengaktifkan production mode.
2. Migrasikan empat kelompok `UNRESOLVED` ke published persona sections.
3. Hapus fragment per section hanya setelah published section memiliki parity dan provenance lengkap.
4. Jangan gabungkan pekerjaan ini dengan FSM, policy hard gate, atau Product Fact Registry.

Rules yang belum aman dihapus: legacy user-prompt helpers, product fact injections, runtime heuristic summaries, parser/schema enforcement, dan semantic validators.

## Stage 3 Retry Migration Result

| Retry area | Stage 2 status | Stage 3 result | Remaining authority |
|---|---|---|---|
| Anonymous retry behavior block | Python-owned | Removed from reply service | None in PERSONA |
| Style correction | Anonymous prose | `legacy_retry_style` in LEGACY | PERSONALITY_MODE playbook in HYBRID/PERSONA |
| Product selection | Anonymous prose | `legacy_retry_product_selection` in LEGACY | FLOW/product facts |
| Process continuity | Anonymous prose | `legacy_retry_process_continuity` in LEGACY | FLOW/runtime context |
| Concrete detail | Anonymous prose | `legacy_retry_concrete_detail` in LEGACY | FLOW |
| Legal grounding | Anonymous prose | `legacy_retry_legality_grounding`; approved HYBRID missing-GUARDRAIL fallback | GUARDRAIL/product facts |
| JSON repair | Mixed retry path | Technical-only repair contract | TECHNICAL_OUTPUT |

Empat kelompok legacy user-prompt helpers tetap aktif hanya pada production
`LEGACY` primary path. Pada `PERSONA`, retry tidak mengandung legacy fragments,
CLOSING alias, COLD/WARM/HOT adaptation prose, JAWAB/FRAME/DIRECTION prose,
objection strategy, atau sales-closing strategy.

Stage 3 tidak menghapus semantic validators. Gap yang masih terbuka adalah
semantic revalidation terhadap hasil retry, universal claim validators, fake
verification-access enforcement, process-state FSM, dan product-fact freshness.
