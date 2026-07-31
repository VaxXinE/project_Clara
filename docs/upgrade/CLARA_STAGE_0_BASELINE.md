# Clara Upgrade — Stage 0 Baseline

Audit date: 2026-07-31 11:57:21 WIB

Scope: baseline, runtime authority mapping, dan golden-test foundation saja.

## 1. Repository State

| Item | Result |
|---|---|
| Base branch | `tawk-integration` |
| Working branch | `audit/clara-stage-0-baseline` |
| Base/current commit before Stage 0 changes | `9ae6fee910bb6415552716e19b93a33564a7c296` |
| Working tree before changes | Clean |
| Runtime changes | None |
| Migration/schema changes | None |

**CONFIRMED:** branch audit dibuat dari working tree bersih pada commit di atas.

## 2. Environment

| Component | Version |
|---|---|
| OS | Darwin 25.5.0, arm64 (`Newss-MacBook-Air.local`) |
| Python | 3.14.4 |
| Node.js | v25.9.0 |
| npm | 11.12.1 |
| uv | 0.11.11 (Homebrew 2026-05-06, aarch64-apple-darwin) |

Lockfile SHA-256 sebelum dan setelah install:

| Lockfile | SHA-256 | Changed? |
|---|---|---|
| `clara-backend/uv.lock` | `fee143c81b55d5a0518f4006d5563e0f9286bc61131d42f590c99ff031c99d66` | No |
| `clara-dashboard/package-lock.json` | `8d5f550848b26e554869c2fb5a4f77df073f032dd86537c1c3895c54f5c93645` | No |
| `clara-extension/package-lock.json` | `b0deeed92cc728105ddf7ee314d533a6d001915e599f8c5faf7a92eea7234869` | No |

**CONFIRMED:** install tidak menghasilkan dependency/lockfile update yang perlu dikomit.

## 3. Official Quality Checks

Durasi adalah wall-clock yang teramati; pembulatan dua desimal.

| Area | Command | Result | Duration | Summary / environment dependency | Pre-existing? |
|---|---|---:|---:|---|---|
| Backend | `uv sync` | FAIL | 0.05s | Sandbox menolak akses cache default di `~/.cache/uv` | Environment-only, before Stage 0 |
| Backend | `UV_CACHE_DIR=/private/tmp/clara-stage0-uv-cache uv sync` | PASS | 0.10s | 46 packages resolved, 42 checked | N/A |
| Backend | `UV_CACHE_DIR=/private/tmp/clara-stage0-uv-cache uv run pytest` | FAIL | 95.08s | 302 collected: 299 passed, 1 failed, 2 skipped | Yes; config-dependent |
| Backend | `UV_CACHE_DIR=/private/tmp/clara-stage0-uv-cache uv run ruff check .` | PASS | 0.04s | No lint errors | N/A |
| Dashboard | `npm install` | PASS | 0.64s | Added local `node_modules` packages; lock unchanged | N/A |
| Dashboard | `npm run build` | FAIL | 44.66s | Turbopack CSS worker gagal bind port: `Operation not permitted` dalam sandbox | Environment-only |
| Dashboard | `npm run build` (approved unrestricted retry) | PASS | 6.25s | Compile/type/page generation berhasil; 28/28 pages | N/A |
| Dashboard | `npx tsc --noEmit` | PASS | 0.98s | No TypeScript errors | N/A |
| Extension | `npm install` | PASS | 0.71s | Up to date; lock unchanged | N/A |
| Extension | `npm run build` | FAIL | 0.95s | Build worker: `Operation not permitted` dalam sandbox | Environment-only |
| Extension | `npm run build` (approved unrestricted retry) | PASS | 1.63s | Plasmo build selesai | N/A |

Security skip detail dikonfirmasi dengan:

`UV_CACHE_DIR=/private/tmp/clara-stage0-uv-cache uv run pytest -q -rs tests/test_security_hygiene.py`

Hasil: 7 passed, 2 skipped. Dua test skip karena local environment menyediakan `OPENAI_API_KEY` non-placeholder; test sengaja tidak mencetak nilainya.

### Existing failure

**CONFIRMED:** `tests/test_extension_snapshot_sync.py::test_extension_config_reports_channel_flags` gagal di line 172. Test mengharapkan `payload["channels"]["tawk"]["enabled"] is False`, sedangkan local settings mengaktifkan Tawk sehingga nilai aktual `True`. Failure terjadi sebelum Stage 0 mengubah file apa pun dan bergantung environment/config. Stage 0 tidak mengubah runtime atau test tersebut.

### Test totals

- Backend official suite: **299 passed, 1 failed, 2 skipped** dari 302.
- Security hygiene focused run: **7 passed, 2 skipped** (subset dari suite di atas).
- Stage 0 golden schema test: dicatat pada bagian verifikasi akhir setelah fixture dibuat.
- Dashboard build/typecheck: pass pada environment yang mengizinkan worker.
- Extension build: pass pada environment yang mengizinkan worker.

## 4. Architecture Summary

**CONFIRMED:** alur utama reply adalah:

`Conversation/Message → AIExtraction → policy metadata → effective persona + supporting Markdown + product knowledge → Python prompt compiler → OpenAI schema output → partial semantic validation/retry → pending ReplySuggestion → approve/reject/send → Conversation/Lead write-back`.

**CONFIRMED:** behavioral authority tertinggi berada di `clara-backend/app/services/reply_suggestion_service.py`, bukan di persona UI atau satu file Markdown.

**CONFIRMED:** lima persona section mengambil versi database `published` lebih dahulu, lalu fallback Markdown per section. Supporting playbook tetap Markdown. Python system/core/runtime rules selalu tetap masuk prompt.

**CONFIRMED:** extraction dan reply generation memiliki classifier intent/state yang berbeda. Extraction menyimpan stage/temperature; reply service menghitung ulang intent dan milestone dari teks.

**CONFIRMED:** policy action disimpan, tetapi tidak menjadi hard gate generation/approval. Jalur dashboard dan extension memiliki transition send yang berbeda.

Detail dan evidence lengkap: `docs/architecture/CLARA_RUNTIME_AUTHORITY_MAP.md`.

## 5. Top Ten Risks

1. **CONFIRMED — Critical:** policy `human_approval_required`/`escalate_to_human` tidak mengunci generation atau state transition send.
2. **CONFIRMED — Critical:** extension send dapat auto-approve pending suggestion setelah aksi kirim eksplisit.
3. **CONFIRMED — Critical:** complaint tidak memiliki backend classifier/gate khusus sehingga normal sales draft masih mungkin dibuat.
4. **CONFIRMED — Critical:** semantic validators tidak dijalankan ulang pada hasil retry.
5. **CONFIRMED — Critical:** mutable product/legal facts tersebar di Python, Markdown, DB import, fallback, regex, validator, dan tests tanpa effective date.
6. **CONFIRMED — High:** published persona UI bukan authority penuh karena aturan Python mendahului dan supporting Markdown tetap ditambahkan.
7. **CONFIRMED — High:** latest extraction dapat menurunkan stage/temperature; tidak ada state-transition anti-regression.
8. **CONFIRMED — High:** intent extraction dan intent regex reply dapat berbeda tanpa provenance/rekonsiliasi.
9. **CONFIRMED — High:** ACTION vs CLOSING dan `regular` vs `reguler` menciptakan vocabulary collision.
10. **CONFIRMED — High:** reviewer display name berasal dari payload client, walau actor autentik tersedia pada metadata.

## 6. Top Ten Unknowns Requiring Owner Confirmation

1. **OPEN QUESTION:** Apakah `human_approval_required` harus melarang send sampai approval terpisah, termasuk di extension?
2. **OPEN QUESTION:** Apakah `escalate_to_human` masih boleh menghasilkan draft aman, atau generation harus berhenti total?
3. **OPEN QUESTION:** Apa definisi complaint yang resmi, kategorinya, SLA, dan tujuan handoff?
4. **OPEN QUESTION:** Enum persona canonical yang diinginkan: ACTION atau CLOSING?
5. **OPEN QUESTION:** Apakah DELAY merupakan interest level permanen atau hanya response strategy sementara?
6. **OPEN QUESTION:** Apa canonical process states dan transition yang tidak boleh mundur?
7. **OPEN QUESTION:** Siapa approver dan masa berlaku tiap fakta produk/legal/compliance?
8. **OPEN QUESTION:** Apakah angka modal Mini dan ringkasan legal saat ini sudah mendapat approval compliance yang masih berlaku?
9. **OPEN QUESTION:** Apakah ownership Tawk boleh berubah mengikuti agent terakhir pada transcript, atau harus lock/explicit transfer?
10. **OPEN QUESTION:** Apakah published persona harus menggantikan seluruh prompt, atau hanya lima section yang memang dimaksud sekarang?

## 7. Highest-Authority and Highest-Risk Files

### Highest behavioral authority

1. `clara-backend/app/services/reply_suggestion_service.py` — prompt compiler, intent/state heuristics, knowledge scoring, validators, generation, persistence, approval.
2. `clara-backend/app/services/ai_extraction_service.py` — extraction schema/prompt dan persistent stage/temperature.
3. `clara-backend/app/services/clara_playbook_service.py` — effective persona precedence dan supporting-playbook selection.
4. `clara-backend/app/services/policy_engine.py` — action mode decision.
5. `clara-backend/app/services/extension_ingest_service.py` dan `sent_message_service.py` — send/approval transition dan CRM write-back.

### Highest compliance risk

1. `reply_suggestion_service.py` — hard-coded legal/product/risk rules dan incomplete retry validation.
2. `official_source_service.py` — official URLs tetapi ringkasan fakta hard-coded dan cache tanpa TTL.
3. `policy_engine.py` — policy decision tidak menjadi enforcement gate.
4. `extension_ingest_service.py` — pending auto-approval pada extension send.
5. `clara_knowledge_mini/03_solid_prime_compliance_guardrail_escalation.md` — banyak aturan penting masih knowledge/prompt-only.

### Files containing mutable product facts

- `clara-backend/app/services/reply_suggestion_service.py`
- `clara-backend/app/services/official_source_service.py`
- `clara_knowledge/clara_knowledge_mini/*.md`
- `clara_knowledge/clara_knowledge_regular/*.md`
- `clara-backend/scripts/import_clara_knowledge.py` (menyalin Markdown ke DB)
- `clara-backend/tests/test_reply_suggestion_schema.py`
- `clara-backend/tests/test_reply_benchmark_scenarios.py`
- `TEST_CONVERSATIONS_CLARA.md` dan `MANUAL_TEST_CASES_CLARA.md` sebagai manual/test material

## 8. Golden-Test Foundation

**CONFIRMED:** fixture berada di `clara-backend/tests/golden/clara_mini_v1.json`, konsisten dengan suite backend yang sudah memakai pytest dan fixture files di bawah `tests/`.

Komposisi tepat 20 kasus:

- 4 SALES/product information;
- 3 LEGALITY/regulation;
- 3 RISK/cost;
- 4 PROCESS-STATE;
- 2 CS-general;
- 3 COMPLAINT/escalation;
- 1 adversarial prompt injection.

Kasus yang disusun untuk baseline baru memakai source `synthetic-baseline`. Kasus `existing-repo-example` adalah adaptasi non-PII dari pola pada FAQ/playbook/test conversations, bukan klaim chat customer nyata. Fixture tidak memanggil LLM dan tidak menilai kualitas reply.

Validator `clara-backend/tests/test_clara_golden_schema.py` memakai Python stdlib dan memeriksa:

- tepat 20 kasus dan ID unik;
- exact required fields;
- enum dan tipe;
- pesan non-empty;
- minimal satu required point/forbidden claim;
- batas maksimum reply;
- key/data sensitif yang obvious;
- seluruh ID complaint wajib `expected_handoff=true` dan `human_review`.

**INFERENCE:** expected semantic labels pada fixture adalah target baseline untuk Stage berikutnya, bukan bukti bahwa runtime sekarang selalu menghasilkan label/action tersebut.

## 9. Infrastructure Blockers and Skips

- **CONFIRMED:** sandbox default tidak mengizinkan uv cache home dan worker build yang bind local port. Retry memakai temp cache atau approved unrestricted execution tanpa mengubah source.
- **CONFIRMED:** dua security tests sengaja skip bila environment memiliki OpenAI key non-placeholder agar secret tidak diinspeksi/dicetak.
- **CONFIRMED:** satu backend test bergantung nilai feature flag Tawk lokal.
- **OPEN QUESTION:** CI canonical seharusnya mengunci environment flags apa untuk test extension config?

Tidak ada shared/production database yang di-bootstrap atau dimodifikasi. Tidak ada deployment. Tidak ada external AI call untuk golden test.

## 10. Recommended Stage 1 Order

1. Putuskan vocabulary canonical: variant, personality, interest, process state, action mode.
2. Definisikan typed authority contract dan precedence yang dapat ditampilkan sebagai effective compiled configuration.
3. Pisahkan immutable behavior/security rules dari mutable persona dan mutable product facts.
4. Jadikan policy action sebagai backend gate untuk generation/approval/send di semua channel.
5. Buat process-state transition rules dan provenance; hentikan overwrite/regression tanpa alasan.
6. Satukan intent classification atau tetapkan precedence/provenance eksplisit.
7. Pindahkan mutable product/legal facts ke registry versioned dengan approver, source, effective/expiry timestamps.
8. Hilangkan prompt collisions secara bertahap, dimulai Python vs published persona dan ACTION vs CLOSING.
9. Terapkan semantic validation yang sama pada primary dan retry.
10. Setelah authority stabil, jalankan 20 golden cases sebagai semantic regression—baru kemudian menambah scoring/LLM evaluation.

**OPEN QUESTION:** urutan 4 dan 7 memerlukan keputusan business/compliance sebelum implementasi.

## 11. Scope Confirmation

**CONFIRMED:** Stage 0 hanya menambah:

- dokumentasi audit;
- fixture JSON sintetis/anonymized;
- satu schema-validation test read-only.

Tidak ada runtime service, prompt/knowledge content, route, frontend behavior, ORM model, migration, webhook, policy, product value, auth, atau database behavior yang diubah. Stage 1 belum dimulai.
