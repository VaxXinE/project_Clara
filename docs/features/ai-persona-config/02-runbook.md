# AI Persona Configuration — Runbook

## Deploy

1. Deploy backend dan jalankan migration Alembic terbaru.
2. Deploy dashboard.
3. Login sebagai `superadmin`.
4. Buka **Administration → AI Persona** atau `/admin/ai-config`.

Jika belum ada versi database, Clara tetap memakai file Markdown existing.

## Mengubah Persona

1. Pilih variant **Mini** atau **Reguler**.
2. Pilih section yang akan diubah.
3. Edit isi sebagai plain text.
4. Klik **Simpan draft**.
5. Periksa draft pada riwayat versi.
6. Klik **Publish** dan konfirmasi.

Draft tidak memengaruhi jawaban production. Versi published mulai dipakai pada
request generate berikutnya tanpa restart backend.

## Rollback

1. Pilih variant dan section.
2. Cari versi archived yang benar.
3. Klik **Rollback** dan konfirmasi.

Rollback membuat versi published baru dari isi lama. History sebelumnya tidak
dihapus.

## Batas Keamanan

- Endpoint hanya dapat dibaca dan diubah oleh `superadmin`.
- Request perubahan dilindungi CSRF.
- Isi dibatasi 20.000 karakter dan dirender sebagai plain text.
- Guardrail permanen di kode tidak dapat dihapus lewat UI.
- Audit log menyimpan checksum dan metadata versi, bukan isi prompt.
- Jangan menaruh password, API key, token, atau data customer pada persona.

## Troubleshooting

### UI menampilkan 403

Pastikan akun memiliki role `superadmin`, lalu login ulang jika role baru saja
diubah.

### Clara masih memakai file Markdown

Pastikan section memiliki status `published`. Draft saja belum aktif. Label
sumber di editor menunjukkan `database vN` atau `file Markdown bawaan`.

### Database persona tidak tersedia

Runtime otomatis fallback ke file Markdown dan menulis event
`ai_persona_config_database_fallback` tanpa isi prompt atau chat customer.
Periksa koneksi database dan status migration.

## Checklist Smoke Test

- [ ] Non-superadmin tidak dapat membuka API persona.
- [ ] Lima section muncul untuk Mini dan Reguler.
- [ ] Simpan draft tidak mengubah effective source.
- [ ] Publish mengubah source menjadi `database vN`.
- [ ] Generate jawaban berikutnya memakai isi published.
- [ ] Rollback membuat versi baru dan mempertahankan history.
- [ ] Isi seperti `<script>alert(1)</script>` tampil sebagai teks dan tidak
      dieksekusi.
- [ ] Saat query database gagal, reply tetap memakai Markdown fallback.
