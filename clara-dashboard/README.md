# Clara Dashboard

`clara-dashboard` adalah frontend operasional Clara yang dibangun dengan:

- Next.js 16
- React 19
- TypeScript

Dashboard ini dipakai untuk:

- membaca queue percakapan
- mengelola lead dan CRM
- menjalankan AI analysis dan draft reply
- mengisi discipline log
- melakukan coaching review
- mengelola knowledge proposal
- membaca manager insights
- mengakses control panel admin tertentu

## Role yang dipakai di UI

Role workspace utama:

- `sales`
- `manager`
- `head`
- `superadmin`

Behavior sidebar sekarang dibedakan per role supaya UI tidak terlalu ramai:

### `sales`

- `Beranda`
- `Queue`
- `Lead Management`
- `Lead Capture`

### `manager`

- `Beranda`
- `Queue`
- `Lead Management`
- `Chat Review Center`
- `Manager Insights`

### `head`

- `Beranda`
- `Queue`
- `Lead Management`
- `Chat Review Center`
- `Manager Insights`
- `Knowledge Base`
- `Ops Dashboard`
- `Access Control`

### `superadmin`

Mengikuti role paling luas:

- `Beranda`
- `Queue`
- `Lead Management`
- `Chat Review Center`
- `Manager Insights`
- `Knowledge Base`
- `Ops Dashboard`
- `Access Control`

## Halaman utama

Halaman paling penting saat ini:

- `/dashboard`
- `/dashboard/sales`
- `/dashboard/sales/conversations/:conversationId`
- `/dashboard/crm`
- `/dashboard/crm/:leadId`
- `/dashboard/follow-up`
- `/dashboard/approvals`
- `/dashboard/knowledge`
- `/dashboard/manager-insights`
- `/dashboard/admin/access`
- `/dashboard/admin/ops`

## Fitur UI yang sudah aktif

### 1. Queue / Sales Inbox

- daftar percakapan prioritas
- filter channel:
  - `Semua Channel`
  - `WhatsApp`
  - `Telegram`
- scope conversation:
  - `Aktif`
  - `Archived`
  - `Semua`
- informasi ownership chat untuk manager/head/superadmin
- badge archived untuk conversation lama yang tidak aktif

### 2. Conversation Detail

- timeline chat
- AI analysis
- generate reply suggestion
- mark as sent
- coaching review
- knowledge proposal

### 3. Lead Management

- list lead
- lead detail
- timeline
- deal metrics
- daily discipline log
- customer profile linkage

### 4. Follow-up / Action Center

- `Prioritas Hari Ini`
- `Prioritas Berikutnya`
- tombol cepat ke:
  - conversation detail
  - lead detail
- action `Done` / `Dismiss`

### 5. Chat Review Center

- queue coaching / review
- review case detail dari conversation
- AI prefill untuk coaching review

### 6. Knowledge Base

- knowledge entry
- knowledge proposal queue
- approval flow

### 7. Manager Insights

- boundary alerts
- coaching priority
- discipline by team
- objection trends

### 8. Global Alerts

Banner global di shell dashboard untuk:

- KPI / deal metrics yang belum sinkron
- worklist high priority tertentu

## Setup lokal

### Install dependency

```bash
cd clara-dashboard
npm install
```

### Jalankan dev server

```bash
npm run dev
```

Default:

- Dashboard: `http://localhost:3000`

## Script yang tersedia

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Koneksi ke backend

Dashboard mengandalkan backend Clara untuk:

- auth session
- data queue
- CRM
- knowledge
- notifications
- manager insights

Pastikan backend berjalan di environment lokal sebelum membuka dashboard.

Biasanya:

- frontend: `http://localhost:3000`
- backend: `http://127.0.0.1:8000`

## Catatan implementasi penting

### 1. Font

Dashboard saat ini tidak lagi bergantung penuh ke Google Fonts runtime.
Fallback font stack lokal dipakai supaya development lokal lebih stabil saat koneksi font external bermasalah.

### 2. Archived conversation

Tab `Archived` di queue tidak menghapus data chat.
Conversation lama hanya disembunyikan dari inbox aktif berdasarkan inactivity policy backend.

### 3. AI bukan auto-decision

Di UI, AI diposisikan sebagai:

- analyzer
- suggester
- prefill helper

bukan pengambil keputusan final.

### 4. Route detail tetap contextual

Beberapa halaman seperti:

- conversation detail
- lead detail
- knowledge proposal section

lebih ideal dibuka dari context workflow, bukan sebagai menu utama.

## Validasi / typecheck

Untuk memastikan frontend tetap sehat:

```bash
cd clara-dashboard
./node_modules/.bin/tsc --noEmit
```

## Referensi

- [README.md](/Users/newsmaker23/Projects/clara/README.md)
- [clara-backend/README.md](/Users/newsmaker23/Projects/clara/clara-backend/README.md)
- [MANUAL_TEST_CASES_CLARA.md](/Users/newsmaker23/Projects/clara/MANUAL_TEST_CASES_CLARA.md)
- [TEST_CONVERSATIONS_CLARA.md](/Users/newsmaker23/Projects/clara/TEST_CONVERSATIONS_CLARA.md)
