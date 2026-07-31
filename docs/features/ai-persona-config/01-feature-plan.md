# AI Persona Configuration — Feature Plan

## Tujuan

Superadmin dapat mengubah persona dan instruction Clara dari dashboard tanpa
mengedit source code. Perubahan harus versioned, dapat dipreview, dipublish,
diaudit, dan di-rollback.

## Scope yang Dapat Diedit

Variant:

- `mini`
- `reguler`

Section:

- `instruction`
- `guardrail`
- `flow`
- `personality_mode`
- `auto_adapt`

Guardrail permanen yang berada di `build_reply_system_prompt()` tetap dikunci
di kode. Konfigurasi dari dashboard hanya menambah atau mengganti playbook,
bukan mengeksekusi kode atau mengubah secret.

## Data Model

Setiap perubahan disimpan sebagai row immutable pada
`ai_persona_config_versions`.

Status:

- `draft`: masih dapat direvisi dengan membuat versi draft berikutnya.
- `published`: satu-satunya versi aktif untuk pasangan variant + section.
- `archived`: versi lama yang tetap tersedia untuk history dan rollback.

Constraint:

- Nomor versi unik per variant + section.
- Maksimal satu versi `published` per variant + section.
- Variant, section, dan status dibatasi enum yang terdokumentasi.
- Isi prompt disimpan sebagai plain text, bukan HTML.

## Runtime Contract

Urutan pemuatan instruction:

1. Baca versi `published` dari database.
2. Jika tidak ada atau database gagal dibaca, gunakan Markdown existing.
3. Guardrail permanen dari kode selalu diterapkan.
4. Konfigurasi database tidak di-cache, sehingga publish/rollback berlaku pada
   request AI berikutnya.

Fallback Markdown wajib dipertahankan agar kegagalan konfigurasi tidak
mematikan reply suggestion production.

## Authorization dan Audit

- Read/write endpoint persona hanya untuk `superadmin`.
- Authorization wajib diperiksa server-side.
- Mutating request mengikuti proteksi CSRF existing.
- Audit log menyimpan action, section, variant, version, actor, dan checksum.
- Audit log tidak menyimpan seluruh isi prompt.

## UX

Route dashboard:

```text
/admin/ai-config
```

Flow:

```text
Pilih variant
→ pilih section
→ edit draft
→ preview effective prompt
→ publish
→ rollback jika diperlukan
```

UI merender prompt sebagai plain text. Tidak memakai `dangerouslySetInnerHTML`.

## Tahapan Branch

1. `feature/ai-persona-config-foundation`
   - Dokumen, model, migration, dan test constraint.
2. `feature/ai-persona-config-api`
   - API draft/history/publish/rollback dan audit log.
3. `feature/ai-persona-config-runtime`
   - Loader database, fallback Markdown, dan cache invalidation.
4. `feature/ai-persona-config-ui`
   - Halaman superadmin, editor, preview, publish, dan rollback.
5. `feature/ai-persona-config-qa`
   - Integration test, security regression, dan runbook.

Setiap branch dibuat dari `tawk-integration` terbaru dan di-merge kembali
sebelum tahap berikutnya dimulai.

## Definition of Done

- Hanya superadmin dapat membaca dan mengubah konfigurasi persona.
- Draft tidak memengaruhi reply production.
- Publish mengaktifkan tepat satu versi per variant + section.
- Rollback tidak menghapus history.
- Fallback Markdown tetap bekerja.
- Guardrail permanen tidak dapat dinonaktifkan dari UI.
- Semua perubahan penting tercatat di audit log.
- Backend dan dashboard test/build lulus.

## Status Implementasi

- [x] Foundation: model, migration, dan constraint.
- [x] API superadmin: draft, history, publish, rollback, dan audit.
- [x] Runtime: published config dengan fallback Markdown.
- [x] UI: editor Mini/Reguler untuk lima section dan history.
- [x] QA: regression test, production build, dan runbook.

Test chat langsung dari halaman admin sengaja tidak termasuk implementasi awal.
Editor menampilkan effective prompt sebagai preview plain text. Endpoint test
chat baru perlu ditambahkan jika ada kebutuhan operasional, rate limit, dan
budget OpenAI yang disepakati.
