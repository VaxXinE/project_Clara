# SGB Sales Command Center (SCC)

Dokumen ini menjelaskan **spesifikasi sistem** SCC dari sisi operasional bisnis:
- peran pengguna
- fitur utama
- alur kerja
- domain data dan tabel

Dokumen ini **tidak membahas framework/stack**.

---

## 1) Tujuan Sistem

SCC adalah sistem operasional penjualan harian untuk:
- menangkap lead secepat mungkin
- memastikan follow-up konsisten
- memprioritaskan pekerjaan sales lewat queue
- mencatat semua aktivitas secara audit-ready
- memberi visibilitas eksekusi ke head dan superadmin

Prinsip inti:
- **SCC = operational truth**
- **Queue > Dashboard**
- **Human executes, system records**
- **Timeline is audit trail**

---

## 2) Peran dan Cakupan Akses

## sales
Fokus:
- eksekusi pekerjaan harian dari queue
- update lead dan follow-up
- catat aktivitas

Akses:
- melihat lead dalam scope miliknya
- mengubah status/follow-up lead miliknya
- menjalankan aksi queue (`done`, `snooze`, `dismiss`)

## head
Fokus:
- monitoring disiplin dan performa unit/tim
- identifikasi bottleneck operasional
- intervensi prioritas kerja

Akses:
- melihat data sesuai scope unit
- review dashboard, pipeline, action center, queue
- memantau timeline operasional

## superadmin
Fokus:
- governance data dan aturan sistem
- kontrol lintas unit/tim
- pengawasan kualitas operasional global

Akses:
- akses penuh seluruh data operasional
- manajemen user/master data
- review lintas modul

---

## 3) Fitur Utama yang Aktif

## A. Lead Management
Tujuan:
- menyimpan data lead sebagai sumber kebenaran utama

Kemampuan:
- quick capture lead
- edit detail lead
- ownership lead
- status progression lead

Output:
- data lead siap dieksekusi di queue

## B. Queue (Execution Queue)
Tujuan:
- menampilkan daftar kerja prioritas yang harus dikerjakan sekarang

Kemampuan:
- sort/filter prioritas
- aksi per item: `Chat`, `Done`, `Snooze`, `Dismiss`
- riwayat aksi queue per lead

Output:
- pekerjaan sales terstruktur dan terukur

## C. Queue Lifecycle
Tujuan:
- mencegah queue jadi daftar pasif

State:
- `active`
- `done`
- `snooze` (30m / 2h / besok)
- `dismiss` (sementara, wajib reason)

Aturan:
- setiap aksi lifecycle tersimpan ke history
- setiap aksi lifecycle masuk timeline event

## D. Action Center
Tujuan:
- ringkasan pressure operasional harian

Antrian sinyal:
- overdue
- warm uncontacted
- ghost risk
- hot opportunity

## E. Timeline Event System
Tujuan:
- audit trail semua event penting

Contoh event:
- lead dibuat
- status berubah
- follow-up dijadwalkan
- pesan WA masuk
- queue action dilakukan

## F. Snapshot Layer (Operational Snapshot)
Tujuan:
- mempercepat read model untuk queue/action center

Isi snapshot:
- priority score
- priority band
- overdue minutes
- response delay
- ghost risk score
- next action code

## G. Priority Scoring
Tujuan:
- mengurutkan lead berdasarkan urgensi kerja

Input score:
- stage/status
- overdue
- silence/responsiveness
- beban owner
- sinyal percakapan

## H. Follow-up Workflow
Tujuan:
- menjaga ritme tindak lanjut

Kemampuan:
- penjadwalan follow-up
- deteksi overdue
- pelacakan aktivitas lanjutan

## I. WhatsApp Integration
Tujuan:
- komunikasi lead terpusat dan tercatat

Kemampuan:
- menerima/menyimpan inbound-outbound message
- sinkron status pesan
- mapping ke lead/conversation
- trigger update snapshot/timeline

## J. Dashboard Operasional
Tujuan:
- visibilitas cepat kondisi tim

Isi:
- KPI operasional
- health indicator
- distribusi status
- sinyal backlog/overdue

## K. Tinjauan Obrolan (Chat Review)
Tujuan:
- review kualitas percakapan sales-customer

Output:
- insight pola keberatan
- bahan coaching

## L. Antrian Pengetahuan (Knowledge Queue)
Tujuan:
- menampung usulan pembaruan knowledge dari temuan chat

Output:
- proses review/approval knowledge update

---

## 4) Domain Data dan Tabel Utama

Berikut peta tabel data dari sisi domain bisnis.

## 4.1 Master Organisasi

### `units`
Menyimpan unit organisasi.

### `teams`
Menyimpan tim dalam unit.

### `roles`
Menyimpan definisi role.

### `users`
Menyimpan pengguna sistem, role, unit, team.

---

## 4.2 Domain Lead & Aktivitas

### `prospects` (Lead)
Entitas utama lead.

Data inti:
- identitas lead (nama, kontak, perusahaan)
- source dan kategori akun
- status operasional
- owner/team/unit
- follow-up date
- prioritas dan catatan

### `prospect_logs`
Log aktivitas harian terhadap lead.

Data inti:
- tanggal aktivitas
- tipe aktivitas
- ringkasan/hasil
- relasi ke lead dan user pelaku

---

## 4.3 Domain Percakapan

### `whats_app_conversations`
Wadah percakapan per lead/kontak.

Data inti:
- chat id
- prospect phone
- owner
- last inbound/outbound timestamps

### `whats_app_messages`
Riwayat pesan per percakapan/lead.

Data inti:
- arah pesan (`inbound/outbound`)
- tipe pesan
- body
- status kirim/terima/baca/gagal
- timestamp status

### `whatsapp_webhook_events`
Penyimpanan payload mentah webhook untuk audit/debug.

---

## 4.4 Domain Timeline & Audit

### `lead_timeline_events`
Audit trail event operasional lead.

Data inti:
- event type
- event at
- actor/source
- payload event
- dedupe key

---

## 4.5 Domain Snapshot & Queue

### `lead_operational_snapshots`
Read model operasional untuk prioritas dan queue.

Data inti:
- priority score/band
- ghost risk
- overdue/response delay
- next action
- computed timestamp

### `lead_queue_states`
State lifecycle queue per lead.

Data inti:
- state (`active/done/snooze/dismiss`)
- snoozed_until/dismissed_until
- reason tag/note
- acted by/acted at

### `lead_queue_action_histories`
Riwayat aksi queue untuk audit.

Data inti:
- action type
- reason
- payload tambahan
- pelaku dan waktu

---

## 4.6 Domain Insight AI (Advisory Layer)

### `ai_requests`
Log request analisis ke engine intelligence eksternal.

Data inti:
- request id
- trigger type
- status request
- attempt count
- sent/completed timestamp

### `lead_ai_insights`
Hasil insight AI per lead (advisory, non-authoritative).

Data inti:
- lead score
- temperature
- emotion
- top objection
- next best action
- confidence
- generated/expires timestamp

Catatan:
- insight AI tidak menggantikan ownership/status/follow-up truth SCC.

---

## 4.7 Domain Pembelajaran Obrolan

### `chat_reviews`
Data review percakapan penting.

### `manager_review_notes`
Catatan review oleh level manajerial.

### `knowledge_update_queues`
Queue usulan pembaruan pengetahuan dari hasil review.

---

## 5) Relasi Domain (Konseptual)

- Satu `user` memiliki banyak `prospects` (sebagai owner)
- Satu `prospect` memiliki banyak `prospect_logs`
- Satu `prospect` memiliki banyak `whats_app_messages` (via conversation)
- Satu `prospect` memiliki banyak `lead_timeline_events`
- Satu `prospect` memiliki satu `lead_operational_snapshot` aktif
- Satu `prospect` memiliki satu `lead_queue_state` aktif
- Satu `prospect` memiliki banyak `lead_queue_action_histories`
- Satu `prospect` dapat memiliki banyak `lead_ai_insights`

---

## 6) Alur Operasional Utama

1. Lead masuk (quick capture)
2. Lead punya owner dan status awal
3. Sistem hitung snapshot prioritas
4. Lead muncul di queue
5. Sales eksekusi aksi (chat/follow-up/status update)
6. Timeline event tercatat otomatis
7. Snapshot di-refresh
8. Queue disusun ulang
9. Siklus berulang sampai lead selesai (closing/lost)

---

## 7) Event Kritis yang Dicatat

Contoh event penting:
- `lead.created`
- `lead.status_changed`
- `lead.owner_changed`
- `lead.followup_scheduled`
- `lead.activity_logged`
- `whatsapp.message_received`
- `whatsapp.message_status_updated`
- `queue.action_done`
- `queue.action_snooze`
- `queue.action_dismiss`

---

## 8) Batas Tanggung Jawab Sistem

SCC memegang:
- kebenaran data operasional
- eksekusi workflow harian
- audit trail

Jika ada engine AI/copilot eksternal:
- hanya memberi rekomendasi
- tidak boleh mengubah owner/status/follow-up secara langsung
- override manual user tetap final

---

## 9) Catatan Onboarding Tim Baru

Saat masuk ke project ini, pahami urutan berikut:
1. Pahami domain `prospects` dan `prospect_logs`
2. Pahami lifecycle `lead_operational_snapshots` + `lead_queue_states`
3. Pahami `lead_timeline_events` sebagai sumber audit
4. Pahami WhatsApp message flow
5. Pahami batas antara action layer (SCC) vs advisory layer (AI insight)

Jika bingung prioritas kerja:
- mulai dari **Queue**
- validasi event di **Timeline**
- pakai dashboard untuk konteks, bukan untuk eksekusi harian.

---

## 10) Daftar Input Pengguna (Yang Diisi Manual)

Bagian ini merinci input apa saja yang diisi user pada tiap modul.

## 10.1 Input Lead (Quick Capture / Edit Lead)

### Wajib
- `name` (nama lead)
- `phone` (nomor kontak/WhatsApp)

### Umum (sering diisi)
- `company`
- `email`
- `source`
- `status`
- `owner_id` (oleh role yang berwenang)
- `next_follow_up_date`
- `notes`

### Klasifikasi operasional (opsional)
- `account_category` (`mini` / `reguler`)
- `priority`
- `estimation_value`
- `user_temperature`
- `dominant_emotion`
- `main_objection`
- `bridge_candidate`
- `bridge_status`
- `lost_reason`

## 10.2 Input Aktivitas Harian Lead

Saat user mengisi log aktivitas:
- `daily_activity_type`
- `daily_summary`
- `daily_result` (opsional)
- `objection_type` (opsional)
- `objection_detail` (opsional)
- `emotional_state` (opsional)

## 10.3 Input Quick Update dari Pipeline/Detail

- `status`
- `next_follow_up_date`
- `quick_note`
- `user_temperature` (opsional)
- `dominant_emotion` (opsional)
- `main_objection` (opsional)
- `bridge_candidate` (opsional)

## 10.4 Input Queue Lifecycle

### Done
- `reason_tag` (wajib)
- `reason_note` (opsional)

### Snooze
- `duration` (`30m`, `2h`, `tomorrow`) (wajib)
- `reason_tag` (wajib)
- `reason_note` (opsional)

### Dismiss
- `reason_tag` (wajib)
- `reason_note` (opsional)

## 10.5 Input Tinjauan Obrolan (Chat Review)

- `title`
- `channel`
- `customer_name`
- `customer_company` (opsional)
- `prospect_id`
- `chat_summary`
- `chat_excerpt` (opsional)
- `what_worked` (opsional)
- `what_failed` (opsional)
- `suggested_knowledge_update` (opsional)
- `outcome`
- `status`
- `objection_type` (opsional)
- `objection_detail` (opsional)
- `emotional_state` (opsional)

## 10.6 Input Antrian Pengetahuan (Knowledge Queue)

Umumnya diisi saat mengusulkan pembaruan:
- `priority`
- `problem_pattern`
- `recommended_update`
- `expected_impact` (opsional)

Saat review:
- `review_note` / `super_admin_note`
- `status` (`queued`, `in_review`, `approved`, `rejected`)

## 10.7 Input Integrasi Webhook/AI (Bukan Input Manual User)

Ini bukan diketik user, tetapi masuk dari sistem eksternal:
- payload webhook WhatsApp
- callback insight AI
- request log AI

Tujuannya:
- audit
- sinkronisasi
- advisory insight
