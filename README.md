# SGB Sales Command Center

Repo ini adalah implementasi monorepo untuk **Sales Command Center (SCC)** dengan fondasi Clara yang disesuaikan ke model operasional pada [README (2).md](README%20(2).md).

## Fokus produk saat ini

- `Queue > Dashboard`
- lead sebagai operational truth
- timeline sebagai audit trail
- follow-up dan pressure harian terbaca dari action center
- head dan superadmin punya visibilitas lintas eksekusi

## Pemetaan modul repo ke konsep SCC

- `clara-dashboard`
  - `Queue` untuk execution queue
  - `Lead Management` untuk status, owner, follow-up, dan timeline
  - `Action Center` untuk overdue, hot lead, dan pressure harian
  - `Ops Dashboard` untuk visibilitas KPI operasional
- `clara-backend`
  - auth, access control, timeline event, lead/task workflow, notification, dan knowledge base
- `clara-extension`
  - ingest percakapan WhatsApp agar queue dan lead cepat ter-update

## Role yang dipakai di UI

- `sales`
- `head`
- `superadmin`

Catatan kompatibilitas:

- storage role lama `marketing/admin/owner` masih didukung
- UI menampilkan terminology SCC
- access control menerima alias role SCC tanpa memaksa migrasi data lama

## Dokumen acuan

- [README (2).md](README%20(2).md): spesifikasi operasional target
- [clara-vs-sales-command-center-comparison.md](clara-vs-sales-command-center-comparison.md): gap analysis Clara vs SCC

## Catatan implementasi

Belum semua domain di README target sudah punya modul penuh. Area yang masih perlu pendalaman jika ingin benar-benar 1:1 dengan SCC:

- hierarchy `unit -> team -> sales`
- chat review center khusus coaching manusia
- knowledge update queue formal
- discipline log harian manual per lead
