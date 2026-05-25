# Clara

Clara adalah monorepo untuk **sales operations platform** yang menghubungkan:

- conversation / chat customer
- lead execution di CRM
- coaching manager
- knowledge update workflow
- manager oversight dan KPI operasional

Clara dirancang untuk dipakai di workflow sales nyata, bukan cuma sebagai parser chat atau CRM sederhana.

## Modul repo

- `clara-backend`
  - FastAPI, SQLAlchemy, Alembic
  - auth, role/scope access, CRM, AI analysis, worklist, knowledge queue, notifications, webhook
- `clara-dashboard`
  - Next.js dashboard operasional untuk sales, manager, head, dan superadmin
- `clara-extension`
  - extension ingest untuk snapshot WhatsApp Web
- `clara_knowledge`
  - factual knowledge source yang bisa di-import ke `product_knowledge`
- `infra`
  - docker compose untuk service lokal seperti PostgreSQL dan Redis

## Role utama

Role workspace yang dipakai sekarang:

- `sales`
- `manager`
- `head`
- `superadmin`

Hierarchy akses:

```text
superadmin > head > manager > sales
```

Catatan kompatibilitas:

- role lama seperti `marketing`, `admin`, dan `owner` masih dinormalisasi sebagai alias
- `superadmin` punya visibilitas global lintas organisasi
- `manager` dan `head` tetap dibatasi oleh scope team/unit bila relevan

## Alur produk utama

Clara paling mudah dipahami sebagai alur berikut:

1. chat masuk dari upload, extension, atau webhook
2. Clara membuat / menyinkronkan `conversation` dan `lead`
3. AI membaca chat lalu memberi:
   - pipeline stage
   - sentiment
   - objection
   - next best action
   - draft balasan
4. sales menindaklanjuti dari queue / conversation detail
5. lead diperbarui di CRM:
   - stage
   - next follow-up
   - discipline log
   - deal metrics
6. manager/head bisa review case coaching
7. case coaching bisa diangkat jadi knowledge proposal
8. head/superadmin bisa approve knowledge ke knowledge base
9. manager insights dan KPI command center membaca data operasional yang sama

## Fitur yang sudah aktif

### 1. Sales hierarchy dan scope access

- `sales_unit`
- `sales_team`
- relasi `user -> team`
- role/scope enforcement ke:
  - dashboard
  - queue
  - CRM
  - conversation access

### 2. Lead Management / CRM

- list lead
- lead detail
- timeline / audit trail
- next follow-up
- assignee / PIC
- customer profile linkage
- deal metrics
- segmentasi bisnis `account_category` (`mini`, `reguler`, `unknown`)

### 3. Queue dan worklist operasional

- sales inbox / queue
- approval queue
- action center / follow-up worklist
- pemisahan:
  - `Prioritas Hari Ini`
  - `Prioritas Berikutnya`
- global alert untuk data KPI / follow-up yang belum sinkron

### 4. AI chat operations

- AI analysis per conversation
- reply suggestion
- sent message tracking
- reply yang ditandai terkirim ikut masuk ke timeline chat
- cache invalidation untuk chat extension yang terus berkembang

### 5. Daily discipline log

- log harian per lead
- summary compliance
- stale / missing discipline signal
- AI prefill untuk discipline log

### 6. Coaching review

- persistent coaching review case
- manager note
- reviewer assignment
- status lifecycle review
- AI prefill untuk review case

### 7. Knowledge update queue

- proposal knowledge dari conversation / coaching case
- status:
  - `draft`
  - `pending_approval`
  - `approved`
  - `rejected`
- publish ke `product_knowledge`

### 8. Manager Insights

- discipline by team
- coaching priority
- objection trends
- boundary alert
- stale lead / compliance summary

### 9. WhatsApp ingestion

- upload TXT
- extension snapshot sync
- server-side WhatsApp Meta webhook:
  - verify handshake
  - signature validation
  - inbound message ingest

### 10. Auto-archive conversation

Conversation yang tidak aktif selama beberapa hari bisa otomatis keluar dari queue aktif.

Sekarang tersedia tab:

- `Aktif`
- `Archived`
- `Semua`

Default auto-archive saat ini:

- `7 hari`

diatur lewat env:

```env
CONVERSATION_AUTO_ARCHIVE_DAYS=7
```

Ini **bukan hard delete**. Data tetap ada untuk audit dan bisa aktif lagi kalau pesan baru masuk.

## Struktur halaman penting di dashboard

Untuk user akhir, halaman yang paling penting sekarang:

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

## Setup lokal cepat

### 1. Jalankan dependency infra

Dari root repo:

```bash
docker compose -f infra/docker-compose.yml up -d
```

### 2. Backend

```bash
cd clara-backend
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run python scripts/bootstrap_owner.py
uv run python scripts/import_clara_knowledge.py
uv run uvicorn app.main:app --reload
```

Endpoint default:

- API: `http://127.0.0.1:8000`
- Docs: `http://127.0.0.1:8000/docs`
- Health: `http://127.0.0.1:8000/health`

### 3. Frontend dashboard

```bash
cd clara-dashboard
npm install
npm run dev
```

Frontend default:

- Dashboard: `http://localhost:3000`

## Bootstrap awal

Script `bootstrap_owner.py` sekarang dipakai untuk membuat:

- 1 organization awal
- 1 user `superadmin` awal

Contoh env:

```env
BOOTSTRAP_OWNER_NAME="Clara Owner"
BOOTSTRAP_OWNER_EMAIL=owner@clara.local
BOOTSTRAP_OWNER_PASSWORD=OwnerPass123!
BOOTSTRAP_ORGANIZATION_NAME="Clara Local"
BOOTSTRAP_ORGANIZATION_SLUG=clara-local
CLARA_KNOWLEDGE_OWNER_EMAIL=owner@clara.local
```

Catatan:

- kalau env bootstrap kosong, script akan skip dengan aman
- jangan taruh logic bootstrap user di migration

## Knowledge import

```bash
cd clara-backend
uv run python scripts/import_clara_knowledge.py
```

Import ini akan melakukan upsert factual knowledge dari folder `clara_knowledge`.

## Testing

Contoh test backend:

```bash
cd clara-backend
.venv/bin/pytest -q
```

Contoh typecheck frontend:

```bash
cd clara-dashboard
./node_modules/.bin/tsc --noEmit
```

## Dokumen yang relevan

- [MANUAL_TEST_CASES_CLARA.md](MANUAL_TEST_CASES_CLARA.md)
- [TEST_CONVERSATIONS_CLARA.md](TEST_CONVERSATIONS_CLARA.md)
- [clara-vs-sales-command-center-comparison.md](clara-vs-sales-command-center-comparison.md)
- [README (2).md](README%20(2).md)

## Catatan desain penting

Beberapa keputusan produk yang disengaja:

- follow-up tidak dihapus permanen, tapi dipisah antara prioritas hari ini dan berikutnya
- AI dipakai sebagai **assistant / prefill**, bukan pengambil keputusan final
- conversation lama lebih aman di-archive daripada hard delete
- KPI dan deal metrics harus sinkron dengan pipeline stage supaya reporting tidak menyesatkan
- `superadmin` harus bisa melihat semua data lintas organisasi

## Arah pengembangan berikutnya

Area yang masih layak diperdalam:

- restore / unarchive conversation dari UI
- tab archived di modul lain selain sales inbox
- retention policy yang lebih formal
- provider WhatsApp tambahan selain Meta webhook
- dashboard UX yang lebih scalable untuk user yang menangani 50-100 chat per hari
