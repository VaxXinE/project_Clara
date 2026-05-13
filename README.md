# Clara

Clara adalah platform internal untuk membantu tim operasional, admin, dan owner mengolah percakapan WhatsApp menjadi:

- data operasional yang rapi,
- insight bisnis yang bisa dipakai untuk pengambilan keputusan,
- draft balasan AI yang lebih aman,
- dan knowledge base produk yang bisa dipakai sebagai grounding.

Project ini sekarang berbentuk **monorepo** dengan 3 aplikasi utama:

- `clara-backend` -> FastAPI backend + PostgreSQL + Redis
- `clara-dashboard` -> Next.js dashboard untuk operasional dan admin
- `clara-extension` -> Chrome extension untuk WhatsApp Web yang terhubung ke Clara

---

## Gambaran Produk

Clara dipakai untuk dua jalur kerja utama:

### 1. Dashboard workflow

User login ke dashboard, lalu:

1. upload export chat WhatsApp `.txt`,
2. backend parse chat menjadi conversation + messages,
3. Clara menjalankan AI extraction,
4. Clara generate draft reply,
5. owner/admin melihat insight agregat dan operasional.

### 2. WhatsApp extension workflow

User membuka WhatsApp Web, lalu:

1. extension membaca chat aktif,
2. snapshot chat dikirim ke backend Clara,
3. backend menyimpan/memperbarui mirror conversation,
4. Clara menjalankan AI extraction + reply suggestion,
5. hasil insight dan draft reply muncul di **Chrome Side Panel**,
6. user bisa `Copy`, `Masukkan`, atau `Kirim` draft dari extension,
7. extension hanya aktif kalau user sudah login di dashboard Clara,
8. jika user memilih `Masukkan` lalu mengirim manual dari WhatsApp, extension akan mencoba mendeteksi event kirim itu dan menyinkronkannya ke Clara sebagai `approved + sent`.

---

## Struktur Monorepo

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
├── clara-extension/
│   ├── assets/
│   ├── contents/
│   ├── server/
│   ├── types/
│   └── utils/
├── infra/
│   └── docker-compose.yml
└── README.md
```

---

## Fitur Utama

### Backend + Dashboard

- Auth dengan role `owner`, `admin`, `marketing`
- Session browser berbasis **HttpOnly cookie** + CSRF token
- Multi-tenant isolation berbasis `organization_id`
- Ownership conversation per user operasional
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
- Reply suggestion berbasis AI
- Product knowledge terpusat
- Marketing insight + snapshot trend
- Audit log untuk action penting
- Admin Ops read-only overview
- User management + activate/deactivate account
- Reset password oleh owner/admin sesuai boundary permission
- Self-service change password

### Chrome Extension

- Membaca chat aktif di WhatsApp Web
- Sync snapshot chat ke Clara backend
- Generate reply suggestion lewat backend Clara
- Menampilkan:
  - customer summary
  - risk level
  - next best action
  - reasoning per draft
- Menjalankan UI di **Chrome Side Panel**, bukan floating overlay
- Bisa `Masukkan` draft ke compose box WhatsApp tanpa auto send
- Bisa `Kirim` draft langsung dari extension
- Bisa mendeteksi **manual send** setelah draft dimasukkan dari extension
- Sinkronisasi status reply ke Clara sebagai:
  - approved
  - sent
- Fallback ke proxy lokal untuk reply suggestion jika backend Clara tidak tersedia

---

## Role & Access Model

### Owner

- akses global lintas organization
- bisa manage semua user
- bisa melihat marketing insights global
- bisa reset password semua user
- **hanya owner** yang boleh menambah, mengubah, dan menghapus product knowledge

### Admin

- akses terbatas ke organization miliknya
- bisa manage user di organization sendiri
- bisa reset password **hanya untuk akun yang dia buat sendiri**
- bisa membuka admin ops dan insight organization
- hanya bisa **melihat** product knowledge

### Marketing

- role operasional utama
- bisa upload chat
- bisa melihat conversation miliknya
- bisa trigger AI analysis dan reply suggestion untuk conversation yang dia pegang
- bisa memakai extension WhatsApp
- hanya bisa **melihat** product knowledge
- tidak bisa membuka marketing insights strategis

---

## Catatan Naming

Secara domain, role operasional sekarang adalah `marketing`.

Tetapi beberapa route/field historis masih memakai istilah `sales`, misalnya:

- `/dashboard/sales`
- `sales_user_id`

Secara business meaning, itu sekarang merepresentasikan user operasional yang memegang conversation.

---

## Stack

### Backend

- FastAPI
- SQLAlchemy 2.x
- Alembic
- PostgreSQL
- Redis
- Pydantic v2
- `pwdlib[argon2]`
- OpenAI API

### Dashboard

- Next.js
- React
- TypeScript

### Extension

- Plasmo
- React
- TypeScript
- Chrome Side Panel API

---

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

Default local service:

- PostgreSQL -> `localhost:5432`
- Redis -> `localhost:6379`

---

## Setup Backend

```bash
cd clara-backend
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run python scripts/bootstrap_owner.py
uv run uvicorn app.main:app --reload
```

Backend default:

- API: `http://127.0.0.1:8000`
- Docs: `http://127.0.0.1:8000/docs`
- Health: `http://127.0.0.1:8000/health`

Contoh env backend:

```env
APP_ENV=development
DATABASE_URL=postgresql+psycopg://clara_user:clara_password_dev_only@localhost:5432/clara_db
REDIS_URL=redis://localhost:6379/0
OPENAI_API_KEY=replace_with_your_openai_api_key
OPENAI_MODEL=gpt-4.1-mini
JWT_SECRET_KEY=replace_with_a_long_random_secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
AUTH_COOKIE_NAME=clara_access_token
CSRF_COOKIE_NAME=clara_csrf_token
AUTH_COOKIE_DOMAIN=
AUTH_COOKIE_SAMESITE=lax
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
LOGIN_RATE_LIMIT_PER_MINUTE=5
BOOTSTRAP_OWNER_NAME=Clara Owner
BOOTSTRAP_OWNER_EMAIL=owner@clara.local
BOOTSTRAP_OWNER_PASSWORD=OwnerPass123!
BOOTSTRAP_ORGANIZATION_NAME=Clara Local
BOOTSTRAP_ORGANIZATION_SLUG=clara-local
```

---

### Bootstrap owner otomatis

Script [bootstrap_owner.py](/Users/newsmaker23/Projects/clara/clara-backend/scripts/bootstrap_owner.py) dibuat untuk onboarding developer dan first deploy yang lebih nyaman.

Behavior-nya:

- kalau semua env `BOOTSTRAP_*` kosong, script akan **skip** dengan aman
- kalau env `BOOTSTRAP_*` diisi tidak lengkap, script akan **fail** dengan pesan jelas
- kalau owner dengan email yang sama sudah ada, script akan **skip** dan tidak membuat duplikat
- kalau organization slug belum ada, script akan membuat organization dulu lalu membuat owner pertama

Command:

```bash
cd clara-backend
uv run alembic upgrade head
uv run python scripts/bootstrap_owner.py
```

Untuk deploy environment seperti Railway, pola yang aman adalah:

```bash
uv run alembic upgrade head && uv run python scripts/bootstrap_owner.py
```

Catatan penting:

- ini **bukan** logic yang ditaruh di file migration Alembic
- migration tetap khusus untuk schema database
- bootstrap owner dipisah supaya lebih aman, idempotent, dan mudah dirawat

Kalau Anda tetap ingin flow manual/interaktif, script lama [create_owner.py](/Users/newsmaker23/Projects/clara/clara-backend/scripts/create_owner.py) masih bisa dipakai.

---

## Setup Dashboard

```bash
cd clara-dashboard
cp .env.example .env
npm install
npm run dev
```

Contoh env dashboard:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_CSRF_COOKIE_NAME=clara_csrf_token
```

Dashboard default:

- `http://localhost:3000`

---

## Setup Extension

```bash
cd clara-extension
cp .env.example .env
npm install
npm run dev
```

Contoh env extension:

```env
OPENAI_API_KEY=sk-ganti-dengan-api-key-openai-kamu
OPENAI_MODEL=gpt-5.4-mini
PORT=9898
PLASMO_PUBLIC_OPENAI_PROXY_URL=http://127.0.0.1:9898/reply-suggestions
PLASMO_PUBLIC_CLARA_API_BASE_URL=http://127.0.0.1:8000
PLASMO_PUBLIC_CLARA_API_TOKEN=isi-dengan-jwt-token-user-clara
```

### Load extension ke Chrome

1. Jalankan `npm run dev`
2. buka `chrome://extensions`
3. aktifkan `Developer mode`
4. klik `Load unpacked`
5. pilih folder build dev Plasmo yang sesuai
6. klik icon Clara di toolbar Chrome

Sekarang UI extension akan muncul di **Chrome Side Panel**.

---

## Cara Ambil Token Clara untuk Extension

Karena dashboard Clara sekarang memakai cookie session, extension memakai bearer token terpisah.

Langkah local development:

1. login dulu ke dashboard Clara
2. ambil cookie:
   - `clara_access_token`
   - `clara_csrf_token`
3. panggil endpoint:

```bash
curl -X POST http://127.0.0.1:8000/auth/access-token \
  -H "Cookie: clara_access_token=ISI_COOKIE_LOGIN_ANDA; clara_csrf_token=ISI_CSRF_COOKIE_ANDA" \
  -H "X-CSRF-Token: ISI_CSRF_COOKIE_ANDA"
```

4. copy `access_token` dari response
5. isi ke:

```env
PLASMO_PUBLIC_CLARA_API_TOKEN=eyJhbGciOi...
```

Catatan:
- ini praktis untuk local/dev
- untuk production, lebih baik nanti dibuat flow login extension yang dedicated

---

## Alur Integrasi Extension

Saat user menekan refresh/generate di extension:

1. extension membaca chat aktif dari WhatsApp Web
2. extension kirim snapshot ke:
   - `POST /extension/whatsapp/snapshots`
3. extension minta draft reply ke:
   - `POST /extension/whatsapp/reply-suggestions`
4. backend Clara akan:
   - sync/update conversation mirror
   - menjalankan AI extraction
   - generate reply suggestion
5. extension menampilkan:
   - risk level
   - customer summary
   - next best action
   - 3 draft reply
6. jika user klik `Kirim`, extension akan:
   - mengirim balasan ke WhatsApp
   - lalu menandai suggestion itu sebagai `approved + sent` di Clara
7. jika user klik `Masukkan` lalu mengirim manual dari tombol/Enter WhatsApp, extension akan mencoba mendeteksi event itu dan menyinkronkannya ke Clara
8. backend Clara akan membuat `sent_message` dan mengubah status conversation menjadi `replied`

Jika backend utama gagal, extension masih bisa fallback ke proxy lokal `9898`.

---

## Command Penting

### Backend

```bash
cd clara-backend
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
uv run pytest
```

### Dashboard

```bash
cd clara-dashboard
npm install
npm run dev
npm run build
```

### Extension

```bash
cd clara-extension
npm install
npm run dev
npm run build
npm run proxy
```

---

## Endpoint / Modul Penting

### Backend routes

- `app/api/routes_auth.py` -> auth, current user, password change/reset, extension token
- `app/api/routes_upload.py` -> upload `.txt` WhatsApp
- `app/api/routes_ai.py` -> AI extraction
- `app/api/routes_reply.py` -> reply suggestion flow
- `app/api/routes_dashboard.py` -> inbox, marketing insights, snapshot, admin ops
- `app/api/routes_product_knowledge.py` -> product knowledge
- `app/api/routes_organizations.py` -> organization management
- `app/api/routes_audit_logs.py` -> audit trail
- `app/api/routes_extension.py` -> snapshot sync + reply suggestion untuk extension

### Dashboard pages

- `/`
- `/login`
- `/dashboard`
- `/dashboard/sales`
- `/dashboard/sales/conversations/[conversationId]`
- `/dashboard/upload`
- `/dashboard/knowledge`
- `/dashboard/marketing`
- `/dashboard/admin/access`
- `/dashboard/admin/ops`

---

## Testing

Backend saat ini sudah punya test dasar untuk area yang paling risk:

- auth session dan cookie
- access control role
- inactive user login
- reset password boundary
- product knowledge owner-only
- marketing insight access
- extension snapshot sync
- extension reply suggestion flow
- extension send flow (`auto-approve + sent`)

Menjalankan test backend:

```bash
cd clara-backend
uv run pytest
```

---

## Deploy Production

### Rekomendasi arsitektur

- `clara-dashboard` -> Vercel atau Railway
- `clara-backend` -> Railway / Render / Fly.io
- PostgreSQL -> Railway Postgres / managed Postgres
- Redis -> Railway Redis / managed Redis
- `clara-extension` -> build dan distribusi manual / Chrome Web Store internal

### Railway backend

Set `Root Directory`:

```text
clara-backend
```

Start command MVP:

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
AUTH_COOKIE_NAME=clara_access_token
CSRF_COOKIE_NAME=clara_csrf_token
AUTH_COOKIE_DOMAIN=
AUTH_COOKIE_SAMESITE=none
ALLOWED_ORIGINS=https://your-frontend-domain
LOGIN_RATE_LIMIT_PER_MINUTE=5
```

### Frontend production

```env
NEXT_PUBLIC_API_BASE_URL=https://your-backend-domain
NEXT_PUBLIC_CSRF_COOKIE_NAME=clara_csrf_token
```

---

## Security Notes

Project ini sudah mengarah ke pendekatan yang lebih aman, tapi tetap harus diperlakukan sebagai aplikasi production:

- password di-hash dengan Argon2
- auth browser memakai HttpOnly cookie + CSRF token
- access control berbasis role + organization + ownership
- CORS dikontrol via `ALLOWED_ORIGINS`
- audit log untuk action penting
- login rate limit tersedia
- input upload dibatasi ke flow yang jelas

Hal yang wajib Anda jaga:

- jangan commit secret asli ke repo
- rotate secret yang pernah bocor
- bearer token extension jangan dianggap aman untuk jangka panjang
- jangan expose admin DB tool ke public internet
- review output AI sebelum dipakai ke customer
- pastikan extension hanya dipakai oleh akun yang berhak
- deteksi manual send di extension adalah **best-effort sync**, jadi tetap perlu monitoring karena DOM WhatsApp Web bisa berubah sewaktu-waktu

---

## Status Project Saat Ini

Clara saat ini sudah cukup kuat untuk **MVP internal** dengan capability:

- dashboard operasional
- insight marketing
- admin ops
- knowledge base terpusat
- auth dan permission boundary
- WhatsApp TXT ingestion
- WhatsApp Web extension integration
- AI extraction
- grounded reply suggestion

Area yang paling bagus untuk dilanjutkan berikutnya:

- Redis-backed login rate limiter
- dedicated login flow untuk extension
- evaluasi kualitas AI dengan dataset internal
- refactor naming historis `sales` -> domain yang lebih netral
- observability dan metrics yang lebih rapi

---

## Lisensi

Belum ditentukan.

Kalau repo ini akan dipublikasikan, tentukan lisensi secara eksplisit, misalnya:

- MIT
- Apache-2.0
- proprietary/internal
