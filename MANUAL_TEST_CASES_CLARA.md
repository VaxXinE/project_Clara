# Clara Manual Test Cases

Dokumen ini dipakai untuk:

1. mengosongkan database lokal Clara
2. bootstrap ulang data minimum
3. menguji fitur Clara secara manual lewat dashboard

Asumsi:

- backend Clara berjalan di `http://127.0.0.1:8000`
- dashboard Clara berjalan di `http://localhost:3000`
- database lokal adalah PostgreSQL dev Clara
- Anda ingin test sebagai operator manual, bukan automation suite

---

## 1. Reset Database Lokal

### Opsi A: PostgreSQL lokal langsung

```bash
cd /Users/newsmaker23/Projects/clara/clara-backend
psql "postgresql://clara_user:clara_password_dev_only@localhost:5432/clara_db" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
uv run alembic upgrade head
```

### Opsi B: Kalau database Anda dari Docker Compose

```bash
cd /Users/newsmaker23/Projects/clara
docker compose -f infra/docker-compose.yml down -v
docker compose -f infra/docker-compose.yml up -d
cd clara-backend
uv run alembic upgrade head
```

---

## 2. Bootstrap Data Dasar

Pastikan file [clara-backend/.env](/Users/newsmaker23/Projects/clara/clara-backend/.env) punya nilai `BOOTSTRAP_*` yang valid.

Contoh yang aman:

```env
BOOTSTRAP_OWNER_NAME="Clara Superadmin"
BOOTSTRAP_OWNER_EMAIL=superadmin@clara.local
BOOTSTRAP_OWNER_PASSWORD=SuperAdminPass123!
BOOTSTRAP_ORGANIZATION_NAME="Clara Local"
BOOTSTRAP_ORGANIZATION_SLUG=clara-local
CLARA_KNOWLEDGE_OWNER_EMAIL=superadmin@clara.local
```

Jalankan:

```bash
cd /Users/newsmaker23/Projects/clara/clara-backend
set -a
source .env
set +a
uv run python scripts/bootstrap_owner.py
uv run python scripts/import_clara_knowledge.py
uv run uvicorn app.main:app --reload
```

Di terminal lain:

```bash
cd /Users/newsmaker23/Projects/clara/clara-dashboard
rm -rf .next
npm run dev
```

---

## 3. Data Manual yang Perlu Dibuat Sebelum Test

Login sebagai `superadmin`, lalu siapkan data ini dari dashboard:

### User

- `head.a@clara.local` role `head`
- `manager.a@clara.local` role `manager`
- `manager.b@clara.local` role `manager`
- `sales.a@clara.local` role `sales`
- `sales.b@clara.local` role `sales`

### Structure

- Unit `Unit A`
- Unit `Unit B`
- Team `Team A` di `Unit A`, manager = `manager.a`
- Team `Team B` di `Unit B`, manager = `manager.b`
- assign `sales.a` ke `Team A`
- assign `sales.b` ke `Team B`

### Chat/lead yang perlu dibuat

Minimal buat 3 lead/conversation:

- Lead A, source WhatsApp, owner `sales.a`, category `mini`
- Lead B, source WhatsApp, owner `sales.a`, category `reguler`
- Lead C, source Telegram atau WhatsApp, owner `sales.b`, category `reguler`

Gunakan menu `Lead Capture` untuk membuatnya.

---

## 4. Checklist Test Manual

Gunakan status:

- `PASS`
- `FAIL`
- `BLOCKED`

Disarankan mencatat:

- tanggal test
- role yang dipakai
- browser
- screenshot kalau ada bug

---

## 5. Test Case Auth & Session

### TC-AUTH-001 Login superadmin berhasil

- Role: `superadmin`
- Langkah:
  1. buka `/login`
  2. login pakai akun superadmin
- Expected:
  - redirect ke `/dashboard`
  - sidebar muncul
  - nama user tampil benar

### TC-AUTH-002 Logout berhasil

- Role: `superadmin`
- Langkah:
  1. klik `Logout`
- Expected:
  - redirect ke `/login`
  - akses `/dashboard` lagi harus mental ke login

### TC-AUTH-003 Session tetap aktif saat refresh

- Role: semua
- Langkah:
  1. login
  2. refresh halaman dashboard
- Expected:
  - tetap login
  - tidak balik ke login

---

## 6. Test Case Hierarchy & Access Control

### TC-HIER-001 Superadmin bisa kelola user

- Role: `superadmin`
- Langkah:
  1. buka `/dashboard/admin/access`
  2. buat user `head`, `manager`, `sales`
- Expected:
  - user berhasil dibuat
  - role tersimpan sesuai pilihan

### TC-HIER-002 Superadmin bisa buat unit

- Role: `superadmin`
- Langkah:
  1. buat `Unit A`
  2. buat `Unit B`
- Expected:
  - unit muncul di daftar

### TC-HIER-003 Superadmin bisa buat team dan assign manager

- Role: `superadmin`
- Langkah:
  1. buat `Team A`
  2. pilih `Unit A`
  3. assign `manager.a`
- Expected:
  - team muncul
  - manager tampil di card team

### TC-HIER-004 User manager tampil di dropdown assign team

- Role: `superadmin`
- Langkah:
  1. buka create/edit team
  2. cek dropdown manager
- Expected:
  - user role `manager` muncul
  - user role lain tidak muncul

### TC-HIER-005 Manager scope hanya team sendiri

- Role: `manager.a`
- Langkah:
  1. login sebagai `manager.a`
  2. buka queue, CRM, conversation detail
- Expected:
  - hanya lihat data `Team A`
  - data `sales.b` tidak terlihat

### TC-HIER-006 Sales hanya lihat data sendiri

- Role: `sales.a`
- Langkah:
  1. login sebagai `sales.a`
  2. buka queue, CRM
- Expected:
  - hanya lead/conversation milik `sales.a`

### TC-HIER-007 Head bisa lihat org-wide

- Role: `head`
- Langkah:
  1. login sebagai `head`
  2. buka queue dan CRM
- Expected:
  - bisa lihat semua team dalam organization

---

## 7. Test Case Lead Capture

### TC-CAP-001 Upload WhatsApp TXT

- Role: `sales`
- Langkah:
  1. buka `/dashboard/upload`
  2. upload file WhatsApp TXT
- Expected:
  - conversation berhasil dibuat
  - lead otomatis terbentuk
  - source = WhatsApp

### TC-CAP-002 Paste WhatsApp text

- Role: `sales`
- Langkah:
  1. paste raw chat WhatsApp
  2. submit
- Expected:
  - conversation baru terbentuk
  - lead otomatis terbentuk

### TC-CAP-003 Upload Telegram TXT

- Role: `sales`
- Langkah:
  1. upload file Telegram TXT
- Expected:
  - conversation baru terbentuk
  - source channel = Telegram

### TC-CAP-004 Channel detection benar

- Role: `sales`
- Langkah:
  1. paste contoh WhatsApp
  2. paste contoh Telegram
- Expected:
  - sistem mengenali channel yang sesuai

---

## 8. Test Case CRM / Lead Management

### TC-CRM-001 Lead list tampil

- Role: `sales`, `manager`, `head`
- Langkah:
  1. buka `/dashboard/crm`
- Expected:
  - lead list tampil sesuai scope role

### TC-CRM-002 Detail lead tampil lengkap

- Role: `sales`
- Langkah:
  1. buka detail lead
- Expected:
  - summary
  - stage
  - temperature
  - timeline
  - discipline log
  - task
  - deal
  tampil

### TC-CRM-003 Update stage lead

- Role: `sales`
- Langkah:
  1. ubah stage lead
- Expected:
  - perubahan tersimpan
  - timeline mencatat perubahan stage

### TC-CRM-004 Update temperature lead

- Role: `sales`
- Langkah:
  1. ubah temperature lead
- Expected:
  - perubahan tersimpan
  - timeline mencatat perubahan

### TC-CRM-005 Update account category lead

- Role: `sales` atau `manager`
- Langkah:
  1. ubah lead jadi `mini`
  2. ubah lagi jadi `reguler`
- Expected:
  - nilai tersimpan
  - timeline mencatat perubahan segmentasi bisnis

### TC-CRM-006 Filter lead by account category via UI/API

- Role: `manager` atau `head`
- Langkah:
  1. jika UI belum ada, test lewat API `GET /leads?account_category=mini`
- Expected:
  - hanya lead kategori `mini` yang kembali

---

## 8A. Test Case Conversation Continuity Manual Upload

Section ini khusus untuk menguji apakah chat hasil upload/paste bisa berkembang
terus di conversation yang sama, bukan selalu membuat thread baru.

### Data uji dasar

Gunakan customer contoh berikut:

- Nama: `Rina Pratama`
- Channel utama: `WhatsApp`
- Nomor: `081288997766`
- Email: `rina.pratama@gmail.com`

### Chat A - upload pertama

```text
[03/06/26, 09.10] Customer: Halo kak, saya Rina Pratama.
[03/06/26, 09.11] Customer: Saya tertarik program mini.
[03/06/26, 09.12] Sales: Siap kak Rina, saya bantu jelaskan ya.
```

### Chat B - chat lanjutan dengan customer yang sama

```text
[03/06/26, 09.10] Customer: Halo kak, saya Rina Pratama.
[03/06/26, 09.11] Customer: Saya tertarik program mini.
[03/06/26, 09.12] Sales: Siap kak Rina, saya bantu jelaskan ya.
[03/06/26, 09.18] Customer: Kalau untuk pemula ini aman nggak kak?
[03/06/26, 09.19] Customer: Terus legalitasnya gimana?
```

### Chat C - chat lanjutan dengan nomor dan email eksplisit

```text
[03/06/26, 09.10] Customer: Halo kak, saya Rina Pratama.
[03/06/26, 09.10] Customer: Nomor saya 081288997766 ya kak.
[03/06/26, 09.11] Customer: Email saya rina.pratama@gmail.com
[03/06/26, 09.12] Sales: Siap kak Rina, saya bantu jelaskan ya.
[03/06/26, 09.23] Customer: Saya mau tahu step lanjutnya juga.
```

### Chat D - upload duplikat

Gunakan isi yang sama persis dengan `Chat B`.

### Chat E - customer yang sama tapi judul sedikit berubah

Gunakan isi `Chat C`, tetapi isi `Nama Customer / Judul Conversation` dengan
`Rina P`.

### Chat F - customer sama tapi channel berbeda

```text
Customer: Halo kak, saya Rina Pratama.
Customer: Saya lanjut tanya dari Telegram ya.
Customer: Email saya rina.pratama@gmail.com
Sales: Siap kak, saya bantu.
```

### TC-CONT-001 Upload pertama membuat conversation baru

- Role: `sales`
- Langkah:
  1. buka `/dashboard/upload`
  2. pilih channel `WhatsApp`
  3. isi judul `Rina Pratama`
  4. paste `Chat A`
  5. submit
- Expected:
  - redirect ke detail conversation
  - response upload status = `created`
  - `message_count = 3`
  - lead baru terbentuk
  - belum ada banner stale

### TC-CONT-002 AI analysis dan draft awal berhasil dibuat

- Role: `sales`
- Langkah:
  1. dari detail conversation hasil `TC-CONT-001`
  2. klik `Analyze Conversation`
  3. klik `Generate Reply Suggestion`
- Expected:
  - AI analysis muncul
  - draft muncul
  - tidak ada warning `analysis perlu diperbarui`
  - tidak ada warning `draft lama`

### TC-CONT-003 Chat lanjutan masuk ke conversation yang sama

- Role: `sales`
- Langkah:
  1. dari detail conversation, klik `Tambah Chat Lanjutan`
  2. pastikan judul customer tetap `Rina Pratama`
  3. paste `Chat B`
  4. submit
- Expected:
  - redirect kembali ke conversation yang sama
  - response upload status = `updated`
  - `appended_message_count = 2`
  - timeline chat bertambah 2 pesan customer baru
  - status conversation berubah jadi `reopened`

### TC-CONT-004 Analysis dan draft lama ditandai stale

- Role: `sales`
- Prasyarat:
  - `TC-CONT-002` dan `TC-CONT-003` sudah lolos
- Langkah:
  1. buka lagi detail conversation
- Expected:
  - muncul banner bahwa chat berkembang
  - muncul sinyal `Analysis perlu diperbarui`
  - muncul sinyal `Draft lama`
  - panel AI memberi warning bahwa ada pesan customer baru
  - panel reply memberi warning bahwa draft dibuat sebelum chat terbaru

### TC-CONT-005 Upload duplikat tidak menambah pesan baru

- Role: `sales`
- Langkah:
  1. klik `Tambah Chat Lanjutan`
  2. paste `Chat D` yang isinya sama persis dengan upload sebelumnya
  3. submit
- Expected:
  - response upload status = `unchanged`
  - `appended_message_count = 0`
  - tidak ada pesan baru di timeline
  - muncul info bahwa upload terakhir tidak menambah pesan baru

### TC-CONT-006 Identity phone/email membantu continuity meski judul berubah

- Role: `sales`
- Langkah:
  1. buat satu conversation baru dulu dari `Chat C` dengan judul `Rina Pratama`
  2. lalu upload lagi isi `Chat E` dengan judul `Rina P`
- Expected:
  - Clara tetap bisa menemukan conversation/customer yang sama
  - tidak membuat thread ganda kalau phone/email berhasil dibaca
  - response upload biasanya `updated`, bukan `created`

### TC-CONT-007 Fallback ke title tetap jalan kalau tidak ada phone/email

- Role: `sales`
- Langkah:
  1. buat customer baru tanpa nomor/email di isi chat
  2. upload ulang chat lanjutan dengan judul yang sama
- Expected:
  - Clara tetap menemukan conversation lama lewat title fallback
  - response upload = `updated`

### TC-CONT-008 Channel berbeda tidak boleh auto-merge thread

- Role: `sales`
- Langkah:
  1. setelah punya conversation WhatsApp `Rina Pratama`
  2. buka upload lagi
  3. pilih channel `Telegram`
  4. isi judul `Rina Pratama`
  5. paste `Chat F`
- Expected:
  - Clara membuat conversation baru untuk channel berbeda
  - response upload = `created`
  - tidak menempel ke thread WhatsApp

### TC-CONT-009 Lead activity mencatat conversation reopened

- Role: `sales` atau `manager`
- Prasyarat:
  - `TC-CONT-003` sudah lolos
- Langkah:
  1. buka `Lead Detail` dari conversation terkait
  2. cek activity timeline
- Expected:
  - ada event `Conversation aktif lagi`
  - kalau status conversation berubah, ada event perubahan status

### TC-CONT-010 Task follow-up atau queue ikut bangun lagi

- Role: `sales`
- Prasyarat:
  - conversation sudah pernah ditindaklanjuti
- Langkah:
  1. upload chat lanjutan dengan pesan customer baru
  2. buka `Action Center` atau `Lead Detail`
- Expected:
  - lead kembali muncul sebagai item yang perlu dibaca
  - kalau lead sudah punya `next_follow_up_at`, task follow-up tersinkron ulang
  - kalau belum punya jadwal, queue task dibuat atau dibuka lagi

### TC-CONT-011 Customer profile temperature tetap sinkron otomatis

- Role: `sales`
- Langkah:
  1. biarkan Clara/AI update temperature lead lewat analisis
  2. upload chat lanjutan yang memicu lead tetap aktif
  3. buka `Customer Detail`
- Expected:
  - profile customer tetap menampilkan temperature hasil sinkron otomatis
  - tidak berubah jadi manual kecuali memang pernah diubah manual user

### TC-CONT-012 Tombol Tambah Chat Lanjutan membawa context yang benar

- Role: `sales`
- Langkah:
  1. buka detail conversation
  2. klik `Tambah Chat Lanjutan`
- Expected:
  - diarahkan ke `/dashboard/upload`
  - mode `continue` aktif
  - judul customer sudah terisi
  - channel sudah terpilih otomatis
  - ada link kembali ke detail conversation

### Catatan interpretasi hasil

- `created`:
  conversation benar-benar baru dibuat.
- `updated`:
  conversation lama ditemukan dan ada pesan baru yang ditambahkan.
- `unchanged`:
  conversation lama ditemukan, tetapi isi upload tidak menambah pesan baru.

### Risiko yang masih dianggap wajar di versi sekarang

- kalau tidak ada phone/email dan judul berubah total, Clara masih bisa gagal
  mengenali thread yang sama
- upload manual tetap tidak sekuat jalur webhook realtime
- false match harus sangat dihindari, jadi matching sekarang memang dibuat
  konservatif

---

## 9. Test Case Daily Discipline Log

### TC-DISC-001 Tambah discipline log manual

- Role: `sales`
- Langkah:
  1. buka detail lead
  2. isi form discipline log
  3. klik simpan
- Expected:
  - log tersimpan
  - list log bertambah
  - summary compliance berubah

### TC-DISC-002 AI prefill discipline log

- Role: `sales`
- Langkah:
  1. buka detail lead
  2. klik `Prefill dengan Clara`
- Expected:
  - field `activity_type`, `result_status`, `customer_mood`, `main_objection`, `notes`, `next_follow_up` terisi
  - tidak auto-save

### TC-DISC-003 Simpan discipline log hasil AI prefill

- Role: `sales`
- Langkah:
  1. prefill
  2. review
  3. simpan
- Expected:
  - log tersimpan normal

### TC-DISC-004 Next follow-up sinkron ke lead

- Role: `sales`
- Langkah:
  1. isi `next follow-up`
  2. simpan log
- Expected:
  - lead `next_follow_up_at` ikut berubah

### TC-DISC-005 Missing/stale log masuk worklist

- Role: `manager`
- Langkah:
  1. biarkan salah satu lead tanpa log hari ini
  2. buka action center / worklist
- Expected:
  - muncul sinyal `missing_discipline_log` atau `stale_discipline_log`

---

## 10. Test Case Action Center / Follow-up Queue

### TC-ACT-001 Overdue follow-up muncul

- Role: `sales` / `manager`
- Langkah:
  1. set `next_follow_up_at` ke masa lalu
  2. buka `/dashboard/follow-up`
- Expected:
  - lead masuk ke overdue queue

### TC-ACT-002 Queue action berhasil

- Role: `sales`
- Langkah:
  1. lakukan queue action dari lead/task
- Expected:
  - task state berubah
  - event task tercatat

---

## 11. Test Case Chat Review Center

### TC-REVIEW-001 Conversation masuk chat review center

- Role: `manager`
- Langkah:
  1. buka `/dashboard/approvals`
- Expected:
  - conversation yang relevan tampil

### TC-REVIEW-002 Buka detail conversation dari review center

- Role: `manager`
- Langkah:
  1. pilih item
  2. buka detail
- Expected:
  - detail conversation tampil
  - section coaching review tampil

### TC-REVIEW-003 Buat coaching review manual

- Role: `manager`
- Langkah:
  1. isi status
  2. isi label
  3. assign reviewer
  4. isi review summary
  5. simpan
- Expected:
  - review case persisten tersimpan

### TC-REVIEW-004 AI prefill coaching review

- Role: `manager`
- Langkah:
  1. klik `Prefill dengan Clara`
- Expected:
  - field review terisi
  - tidak auto-save

### TC-REVIEW-005 Tambah manager note

- Role: `manager`
- Langkah:
  1. tambah note
- Expected:
  - note tersimpan
  - refresh halaman, note tetap ada

---

## 12. Test Case Knowledge Update Queue

### TC-KNOW-001 Buat proposal knowledge dari coaching case

- Role: `manager`
- Langkah:
  1. buka conversation detail
  2. isi section `Knowledge Update Queue`
  3. simpan sebagai `draft`
- Expected:
  - proposal tersimpan

### TC-KNOW-002 Ubah proposal ke pending approval

- Role: `manager`
- Langkah:
  1. ubah status proposal jadi `pending_approval`
  2. simpan
- Expected:
  - proposal masuk antrian review

### TC-KNOW-003 Approve & publish proposal

- Role: `head` atau `superadmin`
- Langkah:
  1. buka `/dashboard/knowledge`
  2. cari proposal `pending_approval`
  3. klik approve
- Expected:
  - status proposal jadi `approved`
  - entry `product_knowledge` baru tercipta

### TC-KNOW-004 Reject proposal

- Role: `head` atau `superadmin`
- Langkah:
  1. pilih proposal `pending_approval`
  2. klik reject
- Expected:
  - status jadi `rejected`
  - tidak publish ke product knowledge

### TC-KNOW-005 CRUD knowledge base manual

- Role: `superadmin`
- Langkah:
  1. tambah knowledge entry manual
  2. edit
  3. deactivate atau delete jika flow mendukung
- Expected:
  - perubahan tampil di knowledge base

---

## 13. Test Case Manager Insights

### TC-MGR-001 Route manager insights bisa dibuka

- Role: `manager`
- Langkah:
  1. buka `/dashboard/manager-insights`
- Expected:
  - route tidak 404
  - halaman tampil normal

### TC-MGR-002 Scope manager benar

- Role: `manager.a`
- Langkah:
  1. buka manager insights
- Expected:
  - hanya data `Team A`
  - tidak ada data `Team B`

### TC-MGR-003 Boundary alerts tampil

- Role: `manager`
- Langkah:
  1. buat lead overdue / stale
  2. buka manager insights
- Expected:
  - boundary alert muncul

### TC-MGR-004 Coaching priority tampil

- Role: `manager`
- Langkah:
  1. buat coaching case aktif
  2. buka manager insights
- Expected:
  - coaching priority list terisi

### TC-MGR-005 Objection trends tampil

- Role: `manager`
- Langkah:
  1. pastikan ada AI extraction dengan objection
  2. buka manager insights
- Expected:
  - top objection tampil

### TC-MGR-006 Filter by account category via API

- Role: `manager`
- Langkah:
  1. panggil `GET /dashboard/manager-insights?account_category=mini`
- Expected:
  - hanya data kategori `mini`

---

## 14. Test Case KPI Command Center

### TC-KPI-001 KPI dashboard tampil

- Role: `head`
- Langkah:
  1. buka `/dashboard/kpi`
- Expected:
  - summary card tampil
  - sales performance tampil
  - source performance tampil

### TC-KPI-002 KPI reflect source channel

- Role: `head`
- Langkah:
  1. panggil `GET /dashboard/kpi/command-center?source_channel=whatsapp`
- Expected:
  - hasil hanya menghitung WhatsApp

### TC-KPI-003 KPI reflect account category

- Role: `head`
- Langkah:
  1. panggil `GET /dashboard/kpi/command-center?account_category=mini`
- Expected:
  - hasil hanya menghitung lead kategori `mini`

---

## 15. Test Case Knowledge / AI Grounding

### TC-AI-001 Generate draft dengan knowledge grounding

- Role: `sales` atau `manager`
- Langkah:
  1. buka conversation yang sudah dianalisis
  2. generate draft
- Expected:
  - draft dibuat
  - tetap grounded ke knowledge base aktif

### TC-AI-002 Mark sent message

- Role: `sales`
- Langkah:
  1. approve draft
  2. tandai terkirim
- Expected:
  - sent status berubah
  - sent message tercatat

---

## 16. Test Case WhatsApp Server-side Webhook

Bagian ini tidak lewat dashboard, tapi wajib untuk Tahap 6.

### TC-WEBHOOK-001 Verify handshake

- Langkah:
  1. panggil endpoint verify Meta
- Expected:
  - challenge dibalas

### TC-WEBHOOK-002 Reject invalid signature

- Langkah:
  1. kirim payload dengan signature palsu
- Expected:
  - `401`

### TC-WEBHOOK-003 Ingest inbound message

- Langkah:
  1. kirim payload valid Meta webhook
- Expected:
  - conversation baru tercipta atau ditemukan
  - message baru masuk
  - lead tersambung
  - `account_category` ikut terisi kalau dikirim lewat `clara_context`

### TC-WEBHOOK-004 Idempotency

- Langkah:
  1. kirim payload yang sama dua kali
- Expected:
  - message tidak double insert
  - response duplicate count naik

---

## 17. Test Case Customer Identity

### TC-CUST-001 Lead dari source berbeda bisa disatukan profile-nya

- Role: `sales`
- Langkah:
  1. buat 2 conversation dengan customer yang sama tapi source beda
- Expected:
  - customer profile merge logic bekerja

### TC-CUST-002 Detail customer tampil

- Role: `manager` atau `head`
- Langkah:
  1. buka detail customer
- Expected:
  - source channels
  - related leads
  - identity confidence
  tampil

---

## 18. Test Case Security & Authorization

### TC-SEC-001 User tidak bisa akses scope di luar team

- Role: `manager.a`
- Langkah:
  1. coba buka conversation/lead milik `sales.b`
- Expected:
  - `404` atau tidak terlihat

### TC-SEC-002 Role sales tidak bisa buka admin access

- Role: `sales`
- Langkah:
  1. buka `/dashboard/admin/access`
- Expected:
  - ditolak

### TC-SEC-003 Role manager tidak bisa approve knowledge jika policy memang head/superadmin only

- Role: `manager`
- Langkah:
  1. buka queue proposal approval
- Expected:
  - tidak ada action approve/reject jika tidak berhak

---

## 19. Urutan Test yang Paling Waras

Urutan yang saya sarankan:

1. reset DB
2. bootstrap
3. login superadmin
4. buat user + hierarchy
5. test auth
6. test lead capture
7. test CRM
8. test discipline log
9. test action center
10. test chat review
11. test knowledge queue
12. test manager insights
13. test KPI
14. test customer identity
15. test webhook WhatsApp
16. test security boundary

---

## 20. Command Verifikasi Tambahan

### Cek user

```sql
select id, name, email, role, organization_id, team_id from users order by created_at;
```

### Cek unit/team

```sql
select id, name, code, organization_id from sales_units;
select id, name, code, unit_id, manager_user_id from sales_teams;
```

### Cek lead

```sql
select id, display_name, source, account_category, current_stage, lead_temperature, assigned_user_id
from leads
order by created_at desc;
```

### Cek webhook message idempotency

```sql
select id, conversation_id, external_message_id, sender_name, message_text
from messages
where external_message_id is not null
order by created_at desc;
```

### Cek knowledge proposals

```sql
select id, title, status, proposed_by_user_id, reviewed_by_user_id, published_product_knowledge_id
from knowledge_update_proposals
order by created_at desc;
```

---

## 21. Catatan Penting

- Jangan test webhook production dengan secret dummy.
- Jangan commit `.env`.
- Kalau test manual banyak role, pakai browser profile terpisah atau incognito supaya cookie session tidak bentrok.
- Kalau route dashboard terasa aneh, restart dashboard dev server dan hapus `.next`.
