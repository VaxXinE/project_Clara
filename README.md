# Clara

Clara adalah platform internal untuk mengubah chat WhatsApp sales/marketing menjadi data operasional dan insight bisnis yang bisa dipakai untuk:

- membaca objection, intent, sentiment, dan tahap pipeline dari customer,
- membantu tim operasional menyusun draft balasan yang lebih aman,
- membangun knowledge base produk yang bisa dipakai AI sebagai grounding,
- memberi owner/admin marketing insight lintas percakapan,
- menjaga isolasi data per organisasi dan per user.

Project ini berbentuk monorepo:

- `clara-backend` -> FastAPI + SQLAlchemy + Alembic
- `clara-dashboard` -> Next.js dashboard untuk operasional dan admin
- `infra` -> container lokal untuk PostgreSQL dan Redis
- `docs` -> dokumen tambahan jika nanti dibutuhkan

## Fitur Utama

- Login berbasis JWT dengan role `owner`, `admin`, dan `marketing`
- Multi-tenant isolation berbasis `organization_id`
- Ownership per conversation
- Upload file `.txt` export WhatsApp
- Parsing chat menjadi message terstruktur
- AI extraction per conversation:
  - buying intent
  - lead temperature
  - sentiment
  - risk level
  - pipeline stage
  - main objections
  - next best action
- AI reply suggestion dengan approval flow
- Product knowledge:
  - entry global dari owner
  - entry organization-scoped dari admin/marketing
- Marketing insights + snapshot trend
- Audit log untuk action penting
- Admin Ops read-only overview untuk inspeksi data penting
- User management:
  - create user
  - edit user
  - activate/deactivate user

## Arsitektur Singkat

Flow utama Clara saat ini:

1. User `marketing` atau `admin` upload file `.txt` WhatsApp.
2. Backend parse isi file menjadi `Conversation` dan `Message`.
3. AI menganalisis conversation lalu menyimpan `AIExtraction`.
4. Sistem menghasilkan `ReplySuggestion` yang bisa di-approve.
5. Owner/admin melihat agregasi di dashboard marketing.
6. Insight snapshot bisa digenerate untuk tracking perubahan dari waktu ke waktu.

## Struktur Repo

```text
clara/
├── clara-backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── db/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── schemas/
│   │   └── services/
│   ├── alembic/
│   ├── scripts/
│   ├── samples/
│   └── tests/
├── clara-dashboard/
│   ├── app/
│   ├── src/
│   └── public/
├── infra/
│   └── docker-compose.yml
└── README.md
```

## Stack

### Backend

- FastAPI
- SQLAlchemy 2.x
- Alembic
- PostgreSQL
- Redis
- OpenAI API
- Pydantic v2
- `pwdlib[argon2]` untuk hashing password

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4

## Role & Access Model

### Owner

- akses global lintas organization
- bisa create organization
- bisa manage semua user
- bisa melihat marketing insights global
- bisa membuat product knowledge global
- hanya owner yang boleh mengubah knowledge global

### Admin

- akses terbatas ke organization miliknya
- bisa manage user di organization sendiri
- bisa mengakses inbox operasional
- bisa melihat marketing insights organization
- bisa membuat dan mengelola product knowledge organization

### Marketing

- role operasional utama pengganti role `sales`
- bisa upload chat
- bisa lihat conversation miliknya
- bisa trigger AI analysis dan reply suggestion untuk conversation yang dia miliki
- bisa melihat product knowledge global + organization sendiri
- tidak bisa membuka marketing insights strategis

## Catatan Naming

Secara domain, role operasional sekarang adalah `marketing`.  
Namun beberapa path dan field historis masih memakai kata `sales`, misalnya:

- route frontend/backend: `/dashboard/sales`
- field DB: `sales_user_id`

Itu masih berfungsi, tapi secara business meaning sekarang artinya adalah user operasional yang memegang conversation.

## Menjalankan Secara Lokal

### Prasyarat

- Python 3.14+
- Node.js 20+
- Docker + Docker Compose
- `uv`
- npm

### 1. Jalankan PostgreSQL dan Redis

Dari root repo:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Service lokal default:

- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

### 2. Setup backend

```bash
cd clara-backend
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run python scripts/create_owner.py
uv run uvicorn app.main:app --reload
```

Backend akan berjalan di:

```text
http://127.0.0.1:8000
```

Swagger docs:

```text
http://127.0.0.1:8000/docs
```

Health check:

```text
http://127.0.0.1:8000/health
```

### 3. Setup frontend

```bash
cd clara-dashboard
cp .env.example .env
npm install
npm run dev
```

Isi `.env` frontend:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

Frontend akan berjalan di:

```text
http://127.0.0.1:3000
```

Root route saat ini diarahkan ke halaman login.

## Environment Variables

### Backend

Contoh minimal:

```env
APP_ENV=development
DATABASE_URL=postgresql+psycopg://clara_user:clara_password_dev_only@localhost:5432/clara_db
REDIS_URL=redis://localhost:6379/0
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4.1-mini
JWT_SECRET_KEY=replace_with_random_secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
LOGIN_RATE_LIMIT_PER_MINUTE=5
```

Keterangan singkat:

- `DATABASE_URL` -> koneksi PostgreSQL
- `REDIS_URL` -> rate limit / cache infra pendukung
- `OPENAI_API_KEY` -> kredensial untuk AI extraction dan suggestion
- `JWT_SECRET_KEY` -> secret untuk sign token
- `ALLOWED_ORIGINS` -> daftar origin frontend untuk CORS

### Frontend

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

## Command Penting

### Backend

```bash
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
uv run pytest
```

### Frontend

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Modul Utama Backend

- `app/api/routes_auth.py` -> login, current user, user management
- `app/api/routes_upload.py` -> upload `.txt` WhatsApp
- `app/api/routes_ai.py` -> AI extraction
- `app/api/routes_reply.py` -> reply suggestion flow
- `app/api/routes_dashboard.py` -> inbox, marketing insights, snapshot, admin ops
- `app/api/routes_product_knowledge.py` -> knowledge base
- `app/api/routes_organizations.py` -> organization management
- `app/api/routes_audit_logs.py` -> audit trail

## Halaman Utama Frontend

- `/login`
- `/dashboard/sales`
- `/dashboard/sales/conversations/[conversationId]`
- `/dashboard/upload`
- `/dashboard/knowledge`
- `/dashboard/marketing`
- `/dashboard/admin/access`
- `/dashboard/admin/ops`

## Deploy Production

### Rekomendasi arsitektur

- `clara-dashboard` -> Vercel atau Railway
- `clara-backend` -> Railway / Render / Fly.io
- PostgreSQL -> Railway Postgres / managed Postgres
- Redis -> Railway Redis / managed Redis

### Railway backend

Set `Root Directory` ke:

```text
clara-backend
```

Start command yang aman untuk MVP:

```bash
uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Contoh env production backend:

```env
APP_ENV=production
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:PORT/DBNAME
REDIS_URL=redis://USER:PASSWORD@HOST:PORT
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4.1-mini
JWT_SECRET_KEY=replace_with_strong_random_secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
ALLOWED_ORIGINS=https://your-frontend-domain
LOGIN_RATE_LIMIT_PER_MINUTE=5
```

### Frontend production

Set env:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-backend-domain
```

## Security Notes

Beberapa prinsip yang sudah dipakai di project ini:

- password di-hash dengan Argon2
- access control berbasis role + organization + ownership
- CORS dikontrol via `ALLOWED_ORIGINS`
- security headers middleware
- audit log untuk action penting
- rate limit login
- validasi upload file `.txt`

Hal yang wajib Anda jaga saat lanjut ke production:

- jangan commit secret asli ke repo
- rotate secret yang pernah bocor
- gunakan secret manager / environment variable
- jangan expose database admin tool langsung ke public internet
- pertimbangkan migrasi token dari `localStorage` ke `HttpOnly cookie`
- review kembali output AI agar tidak halusinasi atau memberi klaim yang tidak didukung knowledge base

## Status Project Saat Ini

Clara saat ini sudah berada di fase MVP internal dengan capability:

- auth & user management
- multi-tenant organization isolation
- conversation ownership
- WhatsApp TXT ingestion
- AI extraction
- grounded reply suggestion
- product knowledge global + organization
- marketing insight dashboard
- marketing insight snapshot tracking
- admin ops overview

Yang masih bagus untuk dilanjutkan:

- automated tests untuk access control dan permission boundary
- refactor naming historis `sales` -> domain yang lebih netral
- auth berbasis cookie yang lebih aman
- evaluasi kualitas AI dengan dataset internal
- automation untuk snapshot periodik

## Lisensi

Belum ditentukan.

Jika project ini akan dibuka publik di GitHub, tentukan lisensi secara eksplisit, misalnya:

- MIT untuk permissive open source
- Apache-2.0 jika ingin tambahan proteksi paten
- proprietary/internal jika project tetap private
