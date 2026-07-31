# Clara Runtime Authority Map — Stage 0

Tanggal audit: 2026-07-31

Branch audit: `audit/clara-stage-0-baseline`

Base commit: `9ae6fee910bb6415552716e19b93a33564a7c296`

Dokumen ini memetakan perilaku yang **benar-benar dilewati runtime**. Isi Markdown yang tidak memiliki jalur panggilan runtime tidak dianggap sebagai backend enforcement.

## A. Executive Summary

Clara membentuk reply melalui dua analisis yang berbeda. `analyze_conversation()` meminta model membuat extraction terstruktur dan langsung menyimpan stage, temperature, risk, intent, serta account category. `create_reply_suggestion()` lalu mengambil extraction terbaru, menghitung policy, memilih variant, memuat persona dan knowledge, membangun prompt, meminta model membuat draft, memvalidasi sebagian output, lalu menyimpan suggestion berstatus `pending`.

Output dipengaruhi oleh lima lapisan:

1. aturan Python dan regex di `reply_suggestion_service.py`;
2. lima persona section (`INSTRUCTION`, `GUARDRAIL`, `FLOW`, `PERSONALITY_MODE`, `AUTO_ADAPT`) dari versi database yang published, dengan fallback Markdown per section;
3. supporting playbook Markdown yang dipilih menurut variant, intent, dan latency;
4. product knowledge aktif dari database ditambah ringkasan official-source;
5. extraction, riwayat percakapan, dan heuristic state/intent pada saat generation.

Authority paling besar bukan file persona, melainkan `reply_suggestion_service.py`. System prompt Python diletakkan sebelum effective persona. Karena itu versi persona database yang published menggantikan fallback Markdown untuk section yang sama, tetapi tidak menggantikan aturan Python. Supporting playbook juga tetap berasal dari Markdown.

Boundary yang dijamin kode antara lain schema output, panjang/jumlah bubble sesuai profile, akses conversation, status suggestion sebelum mark-sent dashboard, signature webhook Tawk, dan satu versi persona published per variant/section. Sebaliknya, banyak aturan sales/compliance—termasuk persona mode, anti-regression state, complaint handling, freshness knowledge, dan arti `human_approval_required`—masih prompt-only atau mixed.

## B. End-to-End Runtime Flow

Status:

- **CONFIRMED**: dipanggil dan enforced oleh runtime.
- **CONDITIONAL**: hanya terjadi pada channel/profile/state tertentu.
- **INCOMPLETE**: ada implementasi, tetapi tidak menutup seluruh boundary.
- **UNCLEAR**: memerlukan keputusan owner atau bukti operasional.
- **DOCUMENTED_ONLY**: tertulis, tetapi tidak dijamin backend.

1. **Incoming message — CONFIRMED/CONDITIONAL.** Upload/manual, extension snapshot, dan webhook Tawk membentuk/memperbarui `Conversation` dan `Message`. Tawk memvalidasi signature serta memetakan transcript pada `ingest_tawk_webhook()` (`clara-backend/app/services/tawk_webhook_service.py:184-547`). Extension hanya menyinkronkan active conversation (`clara-backend/app/services/extension_ingest_service.py:809-979`).
2. **Identity/context retrieval — CONFIRMED/INCOMPLETE.** Conversation menyimpan organization, owner, lead, channel/provider, stage, dan temperature (`clara-backend/app/models/conversation.py:10-105`). Reply context dipotong menurut latency profile (`reply_suggestion_service.py:2507-2562`). Identity juga diekstrak heuristik dari pesan dan dimasukkan ke prompt (`reply_suggestion_service.py:1160-1206,1293-1304,1665-1711`); tidak ada state machine identitas tunggal.
3. **Intent/state analysis — CONFIRMED/MIXED.** Extraction model menghasilkan schema terstruktur (`ai_extraction_service.py:75-140,264-405`). Saat reply, intent dihitung ulang dengan regex dan urutan prioritas (`reply_suggestion_service.py:825-914`), sedangkan process milestone juga dihitung ulang dari teks (`reply_suggestion_service.py:1155-1304`).
4. **Policy decision — CONFIRMED/INCOMPLETE.** `decide_reply_action()` mengembalikan `escalate_to_human`, `human_approval_required`, atau `auto_draft_only` (`policy_engine.py:12-46`). Nilai disimpan sebagai metadata, tetapi tidak menghentikan generation (`reply_suggestion_service.py:4304-4494`).
5. **Playbook loading — CONFIRMED.** Lima section system dipilih dari DB published per section, lalu fallback Markdown jika tidak ada/error (`clara_playbook_service.py:289-372`). Supporting playbook selalu Markdown dan dipilih berdasar intent/latency (`clara_playbook_service.py:168-222,376-396`). Variant `unknown/all` dapat memuat Mini dan Regular (`clara_playbook_service.py:132-156`).
6. **Knowledge retrieval — CONFIRMED/INCOMPLETE.** Product knowledge aktif global/organization diambil terbaru dahulu dan difilter variant melalui `source_type` (`product_knowledge_service.py:199-238`). Runtime menambah official-source entries (`reply_suggestion_service.py:2630-2671`), tetapi official fetch tidak memiliki TTL dan isi ringkasan utamanya hard-coded (`official_source_service.py:39-155`).
7. **Prompt construction — CONFIRMED.** User prompt menggabungkan core rules, runtime rule brief, intent/style, variant, supporting playbook, extraction, knowledge, dan conversation (`reply_suggestion_service.py:2163-2374`). System prompt Python menetapkan identitas, formula JAWAB/FRAME/DIRECTION, level minat, mode persona, format, dan compliance, lalu baru menambahkan effective persona (`reply_suggestion_service.py:2377-2504`).
8. **Model generation — CONFIRMED/CONDITIONAL.** OpenAI dipanggil dengan strict JSON schema jika API key tersedia (`reply_suggestion_service.py:3685-4288`). Kegagalan credential/infrastruktur menghasilkan error, bukan fake pass.
9. **Validation — INCOMPLETE.** Schema/Pydantic selalu dicek. Semantic validators dijalankan pada reply pertama tertentu dan dapat memicu satu retry (`reply_suggestion_service.py:3880-4202`). Output retry hanya melewati schema/Pydantic; semantic suite tidak dijalankan ulang (`reply_suggestion_service.py:4239-4288`).
10. **Suggestion persistence — CONFIRMED.** Suggestion disimpan `pending` bersama action mode dan metadata (`reply_suggestion_service.py:4304-4494`; `models/reply_suggestion.py:11-45`).
11. **Human review — CONDITIONAL/INCOMPLETE.** Endpoint approve/reject tersedia untuk user yang lolos access scope (`routes_reply.py:124-207`). Approval service memerlukan status pending, tetapi tidak memeriksa `action_mode`; `reviewer_name` berasal dari payload sementara user autentik hanya masuk metadata audit (`reply_suggestion_service.py:4510-4571`; `models/approval_log.py:10-31`).
12. **Send/manual action — CONDITIONAL.** Dashboard `mark_reply_suggestion_as_sent()` hanya menerima suggestion approved dan mencatat `manual_simulation` (`sent_message_service.py:165-237`). Extension send merupakan klik eksplisit, tetapi pending suggestion dapat di-auto-approve saat konfirmasi send (`extension_ingest_service.py:1126-1255`; `routes_extension.py:135-190`). Tawk adapter bersifat read-only (`clara-extension/utils/channel-adapters/tawk-adapter.ts:657-678`).
13. **State/CRM write-back — CONFIRMED/INCOMPLETE.** Analysis dan sent-message menulis stage/temperature ke conversation/lead (`ai_extraction_service.py:330-405`; `lead_service.py:187-277`; `sent_message_service.py:165-237`). Nilai dapat ditimpa extraction berikutnya tanpa transition table anti-regression.

## C. Authority Matrix

| Concern | Current Source(s) | Actual Runtime Precedence | Duplicate/Conflict | Enforcement Type | Risk | Recommended Future Owner | Evidence |
|---|---|---|---|---|---|---|---|
| Clara role | Python system prompt; persona DB/Markdown; Mini chatbox prompt | Python role lebih dulu, effective persona ditempel setelahnya | “AI Sales Copilot”, “advisor WhatsApp”, dan “customer support assistant” tersebar | MIXED | High | Versioned system persona | `reply_suggestion_service.py:2377-2504`; `clara_knowledge_mini/01_solid_prime_chatbox_system_prompt.md:1-18`; `clara_knowledge_regular/INSTRUCTION.md:1-5` |
| Instruction | Python core/runtime rules; DB published `instruction`; Markdown fallback/supporting | Python > DB-published system section > Markdown fallback; supporting Markdown tetap masuk | Satu konsep berulang di tiga lapisan | MIXED | High | Published prompt bundle | `reply_suggestion_service.py:1436-1662,2163-2504`; `clara_playbook_service.py:289-396` |
| Guardrail | Python prompt + semantic validators; DB/Markdown guardrail/compliance docs | Validator mengalahkan output awal; selebihnya model instruction | Retry tidak divalidasi semantik ulang | MIXED | Critical | Backend policy/validator + compliance-owned content | `reply_suggestion_service.py:2887-3682,3880-4288`; `clara_knowledge_mini/GUARDRAIL.md:1-17` |
| Conversation flow | Regex state rules; DB/Markdown flow; extraction state | Runtime heuristics membentuk brief; playbook memberi instruksi tambahan | Tidak ada FSM tunggal | MIXED | High | Durable process-state service | `reply_suggestion_service.py:1155-1304,1455-1662`; `ai_extraction_service.py:75-110` |
| Personality | Python RELAX/TRUST/AUTHORITY/CLOSING; DB/Markdown ACTION | Python system prompt selalu hadir, lalu persona section | ACTION vs CLOSING | PROMPT_ONLY | High | Persona schema/policy | `reply_suggestion_service.py:2441-2472`; `clara_knowledge_mini/PERSONALITY_MODE.md:1-65` |
| Auto adaptation | extraction; Python intent/style; DB/Markdown AUTO_ADAPT | Regex/derived runtime brief + appended playbook | COLD/WARM/HOT digunakan untuk intent dan temperature tanpa owner tunggal | MIXED | High | Classification service | `reply_suggestion_service.py:825-1119`; `clara_knowledge_mini/AUTO_ADAPT.md:1-65` |
| Output format | JSON schema/Pydantic; Python char/bubble constants; prompt contract | Backend schema/normalizer/limits | Golden max 500 berbeda dari runtime 110–420 per bubble/profile | BACKEND_ENFORCED | Medium | Reply schema service | `reply_suggestion_service.py:52-63,1360-1412,2127-2160` |
| COLD/WARM/HOT | AI extraction prompt/schema; Python system prompt; playbooks | Extraction tersimpan; generation juga membaca extraction dan prompt terminology | Tidak ada DELAY dalam persisted enum | MIXED | High | Lead qualification domain | `ai_extraction_service.py:75-140`; `reply_suggestion_service.py:2441-2472`; `AUTO_ADAPT.md` |
| Intent | AI extraction `customer_intent`; deterministic reply regex | Reply regex `infer_latest_customer_intent()` menang untuk generation | Dua classifier dapat berbeda; complaint tidak punya precedence khusus | MIXED | High | Intent classifier | `ai_extraction_service.py:75-110`; `reply_suggestion_service.py:825-914` |
| Process state | Conversation/lead fields; extraction; text heuristics; playbooks | Latest extraction overwrite persistence; heuristics memandu reply | Interest/stage/milestone tercampur | MIXED | Critical | Process-state FSM | `conversation.py:55-64`; `ai_extraction_service.py:330-405`; `lead_service.py:187-277` |
| CTA | Python intent/runtime briefs; closing/flow playbooks | Semua menjadi prompt; tidak ada typed CTA output | CTA bisa berkonflik dengan action mode | PROMPT_ONLY | High | Policy + response planner | `reply_suggestion_service.py:935-1119,1455-1662`; `CLOSING_ENGINE.md` |
| Objection | Supporting Markdown; extraction objection; prompt guidance | Intent-selected Markdown + extraction | Tidak ada backend objection state/action | KNOWLEDGE_ONLY | Medium | Playbook content owner | `clara_playbook_service.py:73-126,168-222`; `OBJECTION.md`; `OBJECTION_EXTREME.md` |
| Closing | Python mode/CTA; closing/conversion Markdown | Digabung dalam prompt | ACTION/CLOSING dan HOT/ready tidak sinkron | PROMPT_ONLY | High | Response planner | `reply_suggestion_service.py:2441-2472`; `CLOSING_ENGINE.md`; `CONVERSION_BEHAVIOR_ENGINE.md` |
| Product facts | Python constants/fallback; DB knowledge; Markdown/import; official summaries; tests | Selected knowledge diprioritaskan, tetapi Python hard-coded rules tetap dapat menang | Modal, legal, product list, process, biaya tersebar | MIXED | Critical | Versioned product-fact registry | `reply_suggestion_service.py:1436-1452,2026-2104,2630-2751`; `product_knowledge_service.py:199-238` |
| Legal information | Official-source hardcoded summary; DB/Markdown; Python prompt/validator | Official entries dan knowledge di-ground; Python mengizinkan klaim pengawasan | Fetched page bukan parser fakta; tidak ada effective date | MIXED | Critical | Compliance-approved fact registry | `official_source_service.py:89-155`; `reply_suggestion_service.py:3238-3277,2483-2484` |
| Risk disclosure | Guardrail/compliance Markdown; Python prompt; policy extraction risk | High risk mengubah action metadata; wording tetap model instruction | Tidak selalu menghasilkan mandatory disclosure | MIXED | Critical | Compliance policy engine | `policy_engine.py:12-46`; `reply_suggestion_service.py:2473-2485`; `03_solid_prime_compliance_guardrail_escalation.md:155-193` |
| Escalation | Policy engine; prompt/playbooks; extension send flow | Policy metadata tersimpan, tetapi channel send flow menentukan enforce | `escalate_to_human` tidak menghentikan draft/send approval path | MIXED | Critical | Backend action gate | `policy_engine.py:12-46`; `reply_suggestion_service.py:4304-4494`; `extension_ingest_service.py:1126-1255` |
| Complaint handling | Tidak ada dedicated backend classifier; knowledge/manual examples | Model/regex general path | Complaint tidak dijamin menghentikan sales generation | UNKNOWN | Critical | Complaint policy service | Tidak ada match complaint di `infer_latest_customer_intent()` (`reply_suggestion_service.py:825-859`); generation tetap pada `4304-4494` |
| Human approval | Policy metadata; approve/reject routes; dashboard/extension send | Dashboard butuh approved untuk mark-sent; extension dapat auto-approve pending | Policy tidak menentukan permission transition | MIXED | Critical | Backend approval state machine | `routes_reply.py:124-207`; `sent_message_service.py:165-237`; `extension_ingest_service.py:1126-1255` |
| Customer memory | Conversation/lead/customer profile/extraction; message history | Latest writes dan aggregation | Tidak ada anti-regression/fact provenance tunggal | BACKEND_ENFORCED | High | Customer state store | `ai_extraction_service.py:330-405`; `lead_service.py:187-277`; `models/conversation.py:10-105` |
| Tawk owner assignment | webhook sender match + env default mapping | Sender id/email/name, lalu property default; existing owner dapat ditulis ulang | Ownership transcript terakhir dapat mengubah owner | BACKEND_ENFORCED | High | Tawk integration ownership policy | `tawk_webhook_service.py:56-163,233-285,483-547` |
| Knowledge freshness | `is_active`, `updated_at`, ordering; official fetch cache | Active newest first; tidak ada expiry/effective date | “Official/latest” dapat stale | MIXED | Critical | Versioned knowledge publication | `product_knowledge.py:24-43`; `product_knowledge_service.py:199-238`; `official_source_service.py:39-55` |

## D. Collision Register

| ID | Concept | Location A | Location B | Current winning rule | Deterministic? | Business risk | Recommended Stage 1 action |
|---|---|---|---|---|---|---|---|
| COL-01 | ACTION vs CLOSING | Mini/Regular `PERSONALITY_MODE.md` memakai ACTION | Python system prompt memakai CLOSING | Keduanya masuk prompt; model memilih | No | CTA/tone tidak konsisten | Tetapkan satu enum dan mapper backward-compatible |
| COL-02 | Interest vs process state | Extraction menyimpan COLD/WARM/HOT dan stage | Reply heuristics menyimpulkan verified/activated/funded dari teks | Latest extraction menang di DB; heuristics menang di prompt tertentu | Partial | Reply mundur atau salah CTA | Pisahkan `interest_level` dari typed process FSM |
| COL-03 | Python prompt vs published persona | `build_reply_system_prompt()` hard-coded | DB published five-section persona | Python selalu lebih dahulu; persona appended | Yes untuk urutan, no untuk model resolution | UI memberi kesan authority penuh padahal tidak | Buat satu compiled prompt dengan precedence eksplisit |
| COL-04 | DB published vs Markdown | `load_effective_persona_sections()` | Markdown five-section fallback | Published menang per section; Markdown saat missing/error | Yes | Partial publication mencampur versi | Publish atomic bundle atau tampilkan effective bundle |
| COL-05 | Product fact knowledge vs Python | DB/Markdown knowledge | Rp5 juta dan fallback product mapping di Python | Python core/validator dapat memaksa/melarang terlepas KB | Mostly | Fakta stale sulit dicabut | Pindahkan mutable facts ke registry versioned |
| COL-06 | Policy action vs generation | `decide_reply_action()` | `create_reply_suggestion()` selalu generate | Generation tetap berjalan | Yes | High-risk/complaint tetap mendapat sales draft | Jadikan action policy gate sebelum generation |
| COL-07 | Human review vs extension send | `human_approval_required` metadata | Extension confirm-send auto-approve pending | Jalur extension menang setelah klik send | Yes | Review wajib dapat dilewati | Enforce allowed transitions by action mode |
| COL-08 | Intent classifier ganda | AI extraction prompt | `infer_latest_customer_intent()` regex | Regex dipakai saat reply generation | Yes | Analytics dan reply dapat berbeda | Satu typed classifier/result with provenance |
| COL-09 | `regular` vs `reguler` | External/golden vocabulary `regular` | DB persona constraint/runtime memakai `reguler` | Runtime normalization bervariasi per service | Partial | Variant salah/fallback dua knowledge set | Canonical enum + alias at boundary |
| COL-10 | First output vs retry validation | Semantic validators pada primary | Retry hanya schema validation | Retry diterima jika schema valid | Yes | Guardrail regression lolos pada retry | Jalankan validator yang sama setelah retry |

## E. Product-Fact Duplication Register

Stage 0 tidak memvalidasi kebenaran bisnis; tabel ini hanya mencatat nilai yang ditemukan.

| Fact | Value found | Locations | Source type | Effective-date support | Freshness metadata | Conflict risk |
|---|---|---|---|---|---|---|
| Modal awal Mini | `Rp5.000.000` / `Rp5 juta` | `reply_suggestion_service.py:1442-1443,2077-2080,3353-3385`; `clara_knowledge_mini/INSTRUCTION.md:8`; `CONVERSION_BEHAVIOR_ENGINE.md:42`; `SALES_KNOWLEDGE_BRIDGE_MINI.md:57-60`; Mini FAQ/examples/compliance; reply tests | Code, regex/validator, Markdown, imported DB copy, tests | No | File history / DB `updated_at` only | Critical |
| Status/pengawasan legal | PT Solid Gold Berjangka diawasi BAPPEBTI | `official_source_service.py:89-109,130-152`; `reply_suggestion_service.py:2483`; Mini/Regular instruction, bridge, objection, conversion, examples; tests | Code fallback, Markdown, DB import, tests | No | Official fetch cache, no fetched timestamp/TTL exposed | Critical |
| Tahun/profil perusahaan | Berdiri sejak 2002; anggota BBJ/KBI (ringkasan code) | `official_source_service.py:89-109`; Mini company/website KB | Code fallback, Markdown/import | No | None beyond deployment/file or DB update | High |
| Daftar instrumen | Gold, Silver, Brent Oil, Forex, indeks tertentu | `reply_suggestion_service.py:2674-2751`; Mini product contract/examples/FAQ; tests | Code mapping/fallback, Markdown/import, tests | No | DB `updated_at` only | High |
| Process onboarding | data awal → verifikasi → onboarding/aktivasi → operasional | `reply_suggestion_service.py:1455-1662`; Mini/Regular INSTRUCTION, FLOW, CLOSING, conversion, bridge, handoff KB | Code prompt, Markdown/import | No | Persona version timestamp hanya untuk 5 section | High |
| Spread/fee/margin | Jangan memberi angka tanpa sumber resmi | `reply_suggestion_service.py:1443,2077-2080,3364-3385`; Mini compliance/FAQ; Regular bridge/addon | Code validator/prompt, Markdown/import | No | No fact-level expiry | High |
| Swap/rollover | Narasi dan/atau angka biaya terdapat pada knowledge/conversation examples | Mini FAQ/examples/product contract and manual chat material; regex search surface | Markdown/import/test material | No | DB `updated_at` only | High |
| Deposit safety | Kanal/rekening resmi, bukan rekening pribadi | `official_source_service.py:115-128`; Mini compliance/examples/handoff KB; Python core prompt | Code fallback, Markdown/import | No | No attestation/effective date | Critical |
| Legal source URL | Solid website dan halaman detail BAPPEBTI `/049` | `official_source_service.py:11-12`; Mini/Regular instruction/bridge/addon | Code constants, Markdown/import | No | `lru_cache`, no TTL | High |
| Reply size | 110/120/280/420 character limits by profile | `reply_suggestion_service.py:52-63,2507-2562`; schema/prompt/tests | Code constant, tests | N/A | Deployment version | Medium |

Knowledge import menyalin Markdown menjadi `ProductKnowledge` dengan `source_type=markdown_import_<variant>` dan menonaktifkan entry lama yang tidak lagi ditemukan (`clara-backend/scripts/import_clara_knowledge.py:220-334`). Model hanya memiliki `is_active`, `created_at`, dan `updated_at`; tidak ada `effective_from`, `expires_at`, approver compliance, atau source revision (`models/product_knowledge.py:10-43`).

## F. Enforcement Gap Register

| ID | Rule/claim | Document/prompt evidence | Backend evidence | Gap |
|---|---|---|---|---|
| GAP-01 | No auto-send / human action required | System/playbooks menggambarkan draft dan handoff | Dashboard mark-sent butuh approved, tetapi extension confirm-send dapat auto-approve pending (`extension_ingest_service.py:1126-1255`) | Tidak ada satu universal approval gate. Kirim tetap eksplisit oleh user, tetapi approval terpisah dapat dilewati |
| GAP-02 | Complaint menghentikan sales generation | Compliance/escalation knowledge mengarahkan eskalasi | Intent regex tidak punya complaint branch (`reply_suggestion_service.py:825-859`) dan generation tidak digate (`4304-4494`) | Complaint dapat tetap menghasilkan normal sales draft |
| GAP-03 | Mandatory human review | Policy mengeluarkan `human_approval_required` (`policy_engine.py:12-46`) | Approve/send transition tidak memeriksa action mode | Policy adalah metadata, bukan authorization gate |
| GAP-04 | State tidak boleh mundur | FLOW/INSTRUCTION melarang kembali ke tahap lama | Latest extraction langsung overwrite conversation/lead (`ai_extraction_service.py:330-405`; `lead_service.py:187-277`) | Tidak ada transition table atau monotonic rule |
| GAP-05 | Fakta stale tidak boleh dipakai | Prompt meminta sumber resmi/terbaru | Product knowledge hanya `is_active` + newest order; official fetch cache tanpa TTL (`product_knowledge_service.py:199-238`; `official_source_service.py:39-55`) | Tidak ada expiry/effective-date enforcement |
| GAP-06 | Sensitive data tidak muncul | Core prompt meminta kehati-hatian dan extension privacy scope | Identity fields dari chat dimasukkan ke prompt (`reply_suggestion_service.py:1160-1206,1665-1711`) dan tidak ada output PII detector | Schema tidak menjamin redaction |
| GAP-07 | Approved prompt override fallback | UI menampilkan source database dan publish | Python prompt tetap precedes DB persona; supporting Markdown tetap ditambahkan (`reply_suggestion_service.py:2377-2504`; `clara_playbook_service.py:376-396`) | Published persona bukan authority penuh |
| GAP-08 | Guardrails tetap berlaku setelah retry | Semantic validators mendeteksi banyak violation | Retry tidak menjalankan ulang semantic validators (`reply_suggestion_service.py:4171-4288`) | Output retry dapat lolos hanya karena schema valid |
| GAP-09 | Reviewer identity auditable | Endpoint membutuhkan authenticated user | `ApprovalLog.reviewer_name` diisi dari client payload (`reply_suggestion_service.py:4510-4571`; `approval_log.py:10-31`) | Display reviewer dapat berbeda dari actor autentik |
| GAP-10 | Tawk owner stabil | Tawk property/agent mapping menentukan owner | Existing conversation owner ditulis berdasarkan transcript terbaru (`tawk_webhook_service.py:233-266`) | Tidak ada documented lock/transfer policy |

## Evidence Scope

Selain file utama di atas, audit memeriksa:

- seluruh lima system playbook Mini dan Regular;
- objection, closing, conversion, FAQ, product contract, examples, compliance, handoff, serta knowledge bridge;
- `MANUAL_TEST_CASES_CLARA.md` dan `TEST_CONVERSATIONS_CLARA.md`;
- persona UI `clara-dashboard/src/app/dashboard/(administration)/admin/ai-config/page.tsx:74-439`;
- automated reply, persona, import, extension, security, dan benchmark tests di `clara-backend/tests/`.

Kesimpulan Stage 0: nama file bukan penentu authority. Runtime precedence hanya dapat dipahami dari compiler prompt dan call path di service.

## G. Stage 1 Implementation Note

Bagian A–F di atas adalah **Stage 0 finding** dan dipertahankan sebagai catatan historis kondisi sebelum kontrak runtime dibuat.

**Stage 1 implementation** pada `feat/clara-stage-1-runtime-contract` menambahkan:

- canonical vocabulary dan normalizer di `clara-backend/app/core/clara_runtime_contract.py`;
- fixed authority order version `1.0`;
- fixed system-section order `INSTRUCTION → GUARDRAIL → FLOW → PERSONALITY_MODE → AUTO_ADAPT`;
- per-section provenance dengan source `DATABASE_PUBLISHED`, `MARKDOWN_FALLBACK`, atau `MISSING`;
- internal debug metadata tanpa full prompt content;
- label `LEGACY_BEHAVIOR_OVERLAY` untuk hard-coded Python behavior;
- explicit compatibility `CLOSING → ACTION`;
- explicit `DELAY → canonical UNKNOWN` sambil mempertahankan legacy signal;
- exclusion lima system Markdown files dari supporting-playbook layer.

Stage 1 belum menyelesaikan enforcement gaps GAP-01 sampai GAP-10. Policy, approval/send, complaint routing, process-state persistence, product facts, validator retry, dan Tawk ownership tetap seperti Stage 0.

Kontrak lengkap: `docs/architecture/CLARA_RUNTIME_CONTRACT_V1.md`.

## H. Stage 2 Implementation Note

Bagian A–F tetap merupakan **Stage 0 finding**. Bagian G merupakan **Stage 1 implementation**. Bagian ini mencatat **Stage 2 implementation**.

Stage 2 menambahkan `PersonaAuthorityMode`:

- `LEGACY` sebagai default aman;
- `HYBRID` untuk menjadikan five system playbooks sebagai behavioral authority utama;
- `PERSONA` untuk menghilangkan legacy behavioral fragments dari prompt efektif.

Free-form system overlay Stage 0 dipisahkan menjadi lima typed fragments di `clara_legacy_behavior_service.py`: instruction, guardrail, flow, personality mode, dan auto-adapt. Setiap fragment memiliki stable name, SHA-256 hash, source identifier, migration status, semantic markers, dan removal target.

Boundary Stage 2:

1. technical output schema/parser tetap Python-owned;
2. policy action hanya diteruskan sebagai metadata dan tidak diubah;
3. runtime customer context tetap data injection;
4. product/legal/variant facts tetap di `LEGACY_PRODUCT_FACT_INJECTION` dan knowledge path lama;
5. supporting knowledge/examples tetap lebih rendah dari five system playbooks;
6. full prompt dan customer message tidak masuk debug metadata;
7. endpoint, database schema, approval/send, dan Tawk flow tidak diubah.

Remaining gap: production default tetap `LEGACY`, sehingga legacy user-prompt helpers masih efektif. `HYBRID` dan `PERSONA` adalah opt-in configuration untuk validation sebelum Stage 3.
