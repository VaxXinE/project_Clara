# Clara Backend

Backend Clara dibangun dengan:

- FastAPI
- SQLAlchemy 2.x
- Alembic
- PostgreSQL
- Redis

Backend ini menangani:

- auth dan role access
- conversation ingest
- AI extraction dan reply suggestion
- lead CRM
- follow-up task / worklist
- discipline log
- coaching review
- knowledge update queue
- manager insights
- ops notifications
- WhatsApp webhook

## Role yang dipakai

Role workspace utama:

- `sales`
- `manager`
- `head`
- `superadmin`

Catatan:

- role lama seperti `marketing`, `admin`, dan `owner` masih dinormalisasi agar data lama tidak langsung rusak
- `superadmin` punya visibilitas global lintas organisasi

## Setup lokal cepat

### 1. Jalankan service pendukung dari root monorepo

```bash
docker compose -f infra/docker-compose.yml up -d
```

### 2. Setup backend

```bash
cd clara-backend
cp .env.example .env
uv sync
uv run python scripts/setup_local_environment.py
uv run uvicorn app.main:app --reload
```

Endpoint default:

- API: `http://127.0.0.1:8000`
- Docs: `http://127.0.0.1:8000/docs`
- Health: `http://127.0.0.1:8000/health`

## Env penting

Selain env dasar seperti `DATABASE_URL`, `JWT_SECRET_KEY`, dan `OPENAI_API_KEY`, ada beberapa env penting lain:

```env
BOOTSTRAP_OWNER_NAME="Clara Owner"
BOOTSTRAP_OWNER_EMAIL=owner@clara.local
BOOTSTRAP_OWNER_PASSWORD=CHANGE_ME_TEMP_OWNER_PASSWORD
BOOTSTRAP_ORGANIZATION_NAME="Clara Local"
BOOTSTRAP_ORGANIZATION_SLUG=clara-local
CLARA_KNOWLEDGE_OWNER_EMAIL=owner@clara.local

WHATSAPP_META_VERIFY_TOKEN=replace_with_meta_verify_token
WHATSAPP_META_APP_SECRET=replace_with_meta_app_secret
WHATSAPP_META_DEFAULT_ORGANIZATION_SLUG=clara-local
WHATSAPP_META_DEFAULT_SALES_USER_EMAIL=owner@clara.local

CONVERSATION_AUTO_ARCHIVE_DAYS=7
```

## Bootstrap superadmin

Script:

- [scripts/bootstrap_owner.py](/Users/newsmaker23/Projects/clara/clara-backend/scripts/bootstrap_owner.py)
- [scripts/setup_local_environment.py](/Users/newsmaker23/Projects/clara/clara-backend/scripts/setup_local_environment.py)

Fungsi:

- membuat organization awal
- membuat user `superadmin` awal

Behavior:

- kalau env `BOOTSTRAP_*` kosong -> script skip aman
- kalau env diisi tidak lengkap -> script fail dengan pesan jelas
- kalau superadmin sudah ada -> script skip dan tidak bikin duplikat
- `setup_local_environment.py` menjalankan migration `heads`, bootstrap superadmin, dan import knowledge dalam satu proses dengan progress/timing yang jelas

## Import knowledge

Script:

- [scripts/import_clara_knowledge.py](/Users/newsmaker23/Projects/clara/clara-backend/scripts/import_clara_knowledge.py)

Command:

```bash
cd clara-backend
uv run python scripts/import_clara_knowledge.py
```

Tujuan:

- import factual knowledge dari folder `clara_knowledge`
- source disimpan sebagai `markdown_import`
- aman dijalankan berulang karena modelnya upsert

## Fitur backend yang sudah aktif

### 1. Sales hierarchy dan access control

- `sales_units`
- `sales_teams`
- relasi `users.team_id`
- scope access per role dan hierarchy

### 2. CRM foundation

- `leads`
- `lead_tasks`
- `lead_activity_events`
- `customer_profiles`
- `lead_deals`
- `account_category`

### 3. Daily discipline log

- `lead_discipline_logs`
- compliance summary
- worklist signal untuk missing / stale log

### 4. Coaching review

- `chat_review_cases`
- `chat_review_notes`
- review lifecycle
- reviewer assignment

### 5. Knowledge update queue

- `knowledge_update_proposals`
- publish ke `product_knowledge`

### 6. Manager insights dan ops notifications

- manager insight aggregation
- worklist
- approval queue
- global ops notification

### 7. WhatsApp ingestion

- upload TXT
- extension snapshot sync
- Meta webhook verify + signature validation

### 8. Auto-archive conversation

Conversation lama tidak dihapus permanen. Backend sekarang mendukung auto-archive virtual berdasarkan inactivity, sehingga:

- chat lama hilang dari inbox aktif
- tetap ada di database
- bisa tampil lagi kalau ada aktivitas baru

## Testing

Jalankan semua test:

```bash
cd clara-backend
.venv/bin/pytest -q
```

Contoh test targeted:

```bash
.venv/bin/pytest tests/test_leads_crm.py -q
.venv/bin/pytest tests/test_sales_worklist.py -q
.venv/bin/pytest tests/test_sent_messages.py -q
```

## Catatan implementasi penting

- jangan taruh logic bootstrap user di migration Alembic
- migration harus fokus ke schema
- seed / bootstrap data lebih aman dipisah ke script idempotent
- AI hanya membantu analisis dan prefill, bukan override keputusan bisnis final
- follow-up dan KPI harus dijaga sinkron supaya dashboard tidak menyesatkan

## Referensi dokumen

- [README.md](/Users/newsmaker23/Projects/clara/README.md)
- [MANUAL_TEST_CASES_CLARA.md](/Users/newsmaker23/Projects/clara/MANUAL_TEST_CASES_CLARA.md)
- [TEST_CONVERSATIONS_CLARA.md](/Users/newsmaker23/Projects/clara/TEST_CONVERSATIONS_CLARA.md)
