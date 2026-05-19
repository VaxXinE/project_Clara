# Clara

Clara adalah platform internal untuk mengubah percakapan customer menjadi **operational workflow**, **CRM context**, **marketing insight**, dan **owner command center**.

Project ini dirancang untuk dipakai tim operasional, admin, marketing, dan owner dalam satu alur kerja yang sama:

- menangkap chat dari WhatsApp atau Telegram,
- mengubah chat menjadi conversation terstruktur,
- membaca intent dan risiko dengan AI,
- mengelola lead, task, approval, dan follow-up,
- menghasilkan insight marketing,
- lalu menutup loop ke KPI bisnis dan executive monitoring.

Saat ini Clara berbentuk **monorepo** dengan tiga aplikasi utama:

- `clara-backend` -> API, business logic, AI orchestration, PostgreSQL, Redis
- `clara-dashboard` -> dashboard web operasional berbasis Next.js
- `clara-extension` -> Chrome extension untuk WhatsApp Web

---

## Status Project

Clara saat ini sudah mencakup modul inti yang sebelumnya hanya ada di rancangan:

- AI sales copilot
- CRM & lead operations
- persistent follow-up task
- approval queue
- marketing insights
- marketing execution workflow
- KPI command center
- persistent alerts & notifications
- multi-channel ingestion
- unified customer identity
- role-based UX

Secara implementasi, project ini sudah sangat dekat dengan versi produk internal yang utuh, bukan lagi prototype dashboard sederhana.

---

## Gambaran Produk

Clara bekerja di atas tiga jalur utama:

### 1. Chat ingestion

Chat bisa masuk dari:

- WhatsApp export `.txt`
- Telegram export / paste chat
- copy-paste chat langsung dari UI upload
- WhatsApp Web lewat Chrome extension

Chat yang masuk diparse menjadi:

- `conversation`
- `messages`
- `lead`
- `customer profile`

### 2. Operational workflow

Setelah conversation masuk:

1. Clara menjalankan AI analysis
2. Clara memberi lead temperature, stage, risk, objection, next action
3. user bisa membuat / review reply suggestion
4. lead masuk ke CRM pipeline
5. follow-up task dan approval queue ikut terbentuk
6. notifikasi operasional dan SLA terbaca dari command center

### 3. Management & insight

Data operasional kemudian naik level menjadi:

- marketing insight
- content brief
- ads signal
- execution board
- KPI foundation
- persistent alerts
- owner/admin executive summary

---

## Monorepo Structure

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
│   ├── tests/
│   └── README.md
├── clara-dashboard/
│   ├── app/
│   ├── public/
│   ├── src/
│   └── README.md
├── clara-extension/
│   ├── assets/
│   ├── contents/
│   ├── server/
│   ├── types/
│   ├── utils/
│   └── README.md
├── clara_knowledge/
├── docs/
├── infra/
│   └── docker-compose.yml
├── scripts/
├── package.json
└── README.md
```

---

## Tech Stack

## Backend

- Python 3.14+
- FastAPI
- SQLAlchemy 2.x
- Alembic
- PostgreSQL 16
- Redis 7
- Pydantic v2
- Psycopg 3
- `pwdlib[argon2]` untuk password hashing
- JWT untuk auth token
- OpenAI API untuk AI analysis dan reply suggestion

## Dashboard

- Next.js 16
- React 19
- TypeScript 5
- Tailwind CSS 4
- ESLint
- Font Awesome

## Extension

- Plasmo
- React 18
- TypeScript
- Chrome Side Panel API
- Chrome Cookies / Storage / Tabs / Scripting APIs

## Infra & Tooling

- Docker Compose
- `uv` untuk Python package & command runner
- npm untuk frontend/extension
- Pytest untuk backend testing

---

## Core Features

## 1. Sales Copilot

- AI analysis per conversation
- reply suggestion dengan reasoning
- approval workflow
- send tracking
- WhatsApp extension side panel
- sync manual send dari WhatsApp ke backend

AI extraction yang sekarang dibaca Clara antara lain:

- buying intent
- lead temperature
- sentiment
- risk level
- pipeline stage
- objections
- next best action

## 2. CRM & Lead Operations

- lead pipeline
- lead detail page
- editable summary, notes, follow-up date, assignee
- deal metrics:
  - expected value
  - deposit amount
  - expected close date
  - closed at
- persistent follow-up task
- lead activity timeline
- unified customer identity lintas channel
- manual merge customer profile

## 3. Daily Operations

- AI worklist
- overdue follow-up monitoring
- hot lead alert
- approval queue
- operational notifications
- SLA bucket:
  - due today
  - overdue 24h
  - overdue 72h
  - completion rate

## 4. Marketing Intelligence

- top objections & market resistance
- recommended content angles
- ready-to-use content briefs
- ads signals
- monthly content plan
- execution board untuk brief dan ads signal
- outcome tracking campaign
- attributed business KPI dari aktivitas marketing

## 5. KPI Command Center

- KPI foundation per org / global
- sales leaderboard
- organization health
- business KPI:
  - pipeline value
  - won value
  - deposit amount
  - win rate
- persistent alerts
- snapshot history
- resolve / reopen alert
- source performance
- marketing-attributed KPI

## 6. Multi-Channel Operations

- WhatsApp TXT upload
- Telegram TXT upload
- direct paste chat
- auto-detect channel
- channel overview
- source normalization
- source/channel filter di dashboard

## 7. Role-Based UX

Dashboard sudah punya alur UX yang berbeda untuk:

- `marketing`
- `admin`
- `owner`

User baru diarahkan lewat:

- onboarding role-based
- next-step guidance
- operational empty state
- workflow-first navigation

---

## Role Model

## Owner

- akses global lintas organization
- melihat KPI global
- melihat marketing insights global
- manage seluruh user
- manage knowledge base
- melihat command center lintas tim

## Admin

- akses hanya ke organization miliknya
- manage user dalam organization sendiri
- melihat approvals, notifications, KPI org, pipeline, dan insight org
- reset password user sesuai boundary permission

## Marketing

- role operasional utama
- upload/paste chat
- buka inbox conversation
- jalankan AI analysis
- buat/review draft balasan
- update lead pipeline
- mengelola follow-up dan task
- memakai extension WhatsApp

---

## Domain Note

Beberapa nama route atau field historis masih memakai istilah `sales`, misalnya:

- `/dashboard/sales`
- `sales_user_id`

Secara domain saat ini, istilah itu merepresentasikan **user operasional yang memegang conversation**, bukan sistem terpisah.

---

## Local Development Setup

## Prerequisites

- Python `3.14+`
- Node.js `20+`
- npm
- Docker + Docker Compose
- `uv`

## 1. Start infra services

Dari root repo:

```bash
cd /Users/newsmaker23/Projects/clara
docker compose -f infra/docker-compose.yml up -d
```

Service default:

- PostgreSQL -> `localhost:5432`
- Redis -> `localhost:6379`

Isi `infra/docker-compose.yml` saat ini:

- service `postgres`
- service `redis`

## 2. Setup backend

```bash
cd clara-backend
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run python scripts/bootstrap_owner.py
uv run python scripts/import_clara_knowledge.py
uv run uvicorn app.main:app --reload
```

Backend default:

- API -> `http://127.0.0.1:8000`
- Docs -> `http://127.0.0.1:8000/docs`
- Health -> `http://127.0.0.1:8000/health`

Contoh `.env` backend:

```env
APP_ENV=development
DATABASE_URL=postgresql+psycopg://clara_user:clara_password_dev_only@localhost:5432/clara_db
REDIS_URL=redis://localhost:6379/0
OPENAI_API_KEY=replace_with_your_openai_api_key
OPENAI_MODEL=gpt-4.1-mini
JWT_SECRET_KEY=replace_with_a_long_random_secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
LOGIN_RATE_LIMIT_PER_MINUTE=5
BOOTSTRAP_OWNER_NAME=Clara Owner
BOOTSTRAP_OWNER_EMAIL=owner@clara.local
BOOTSTRAP_OWNER_PASSWORD=OwnerPass123!
BOOTSTRAP_ORGANIZATION_NAME=Clara Local
BOOTSTRAP_ORGANIZATION_SLUG=clara-local
CLARA_KNOWLEDGE_OWNER_EMAIL=owner@clara.local
```

## 3. Setup dashboard

```bash
cd clara-dashboard
cp .env.example .env
npm install
npm run dev
```

Dashboard default:

- `http://localhost:3000`

Contoh `.env` dashboard:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_CSRF_COOKIE_NAME=clara_csrf_token
```

## 4. Setup extension

```bash
cd clara-extension
cp .env.example .env
npm install
npm run dev
```

Contoh `.env` extension:

```env
OPENAI_API_KEY=replace_with_your_openai_api_key
OPENAI_MODEL=gpt-5.4-mini
PORT=9898
PLASMO_PUBLIC_OPENAI_PROXY_URL=http://127.0.0.1:9898/reply-suggestions
PLASMO_PUBLIC_CLARA_API_BASE_URL=http://127.0.0.1:8000
PLASMO_PUBLIC_CLARA_API_TOKEN=
```

### Load extension ke Chrome

1. jalankan `npm run dev`
2. buka `chrome://extensions`
3. aktifkan `Developer mode`
4. klik `Load unpacked`
5. pilih folder build dev dari Plasmo
6. buka WhatsApp Web
7. buka Clara Side Panel

---

## Recommended Local Run Order

Untuk developer baru, urutan aman paling sederhana:

```bash
cd /Users/newsmaker23/Projects/clara
docker compose -f infra/docker-compose.yml up -d

cd clara-backend
uv sync
uv run alembic upgrade head
uv run python scripts/bootstrap_owner.py
uv run python scripts/import_clara_knowledge.py
uv run uvicorn app.main:app --reload

cd ../clara-dashboard
npm install
npm run dev
```

Kalau extension juga mau dites:

```bash
cd ../clara-extension
npm install
npm run dev
```

---

## Root Scripts

Dari root monorepo:

```bash
npm install
npm run dev
npm run prod
npm run build
npm run start
npm run package:extension
```

Keterangan:

- `npm run dev` -> jalankan dashboard + extension helper flow untuk local development
- `npm run prod` -> flow production helper dari root script
- `npm run build` -> build dashboard + extension
- `npm run start` -> start dashboard production
- `npm run package:extension` -> package extension

Catatan:

- backend tetap dikelola dari folder `clara-backend`
- migration, bootstrap, dan import knowledge tetap dijalankan di backend

---

## Important Commands

## Backend

```bash
cd clara-backend
uv sync
uv run alembic upgrade head
uv run pytest
uv run uvicorn app.main:app --reload
python3 -m compileall app scripts
```

## Dashboard

```bash
cd clara-dashboard
npm install
npm run dev
npm run build
./node_modules/.bin/tsc --noEmit
```

## Extension

```bash
cd clara-extension
npm install
npm run dev
npm run build
npm run package
npm run proxy
```

---

## Main User Flows

## 1. Upload / paste chat

1. login ke dashboard
2. buka `Import Chat`
3. pilih channel:
   - WhatsApp
   - Telegram
4. pilih mode:
   - upload file
   - paste chat
5. submit
6. Clara membuat conversation dan lead

## 2. Review inbox & AI

1. buka `Chat Masuk`
2. pilih conversation
3. review timeline chat
4. jalankan AI analysis jika belum ada
5. generate / review reply suggestion
6. approve atau kirim

## 3. Operasional follow-up

1. buka `AI Worklist`
2. ambil item prioritas teratas
3. snooze / reopen / done task jika perlu
4. buka `Approvals` bila ada bottleneck
5. buka `Notifications` untuk alert operasional

## 4. CRM workflow

1. buka `Lead Pipeline`
2. buka detail lead
3. update stage, notes, follow-up, assignee
4. isi deal metrics
5. review timeline aktivitas
6. cek unified customer identity

## 5. Marketing workflow

1. buka `Marketing Insights`
2. review objection, content angle, ads signal
3. ubah brief/signal jadi execution item
4. assign PIC
5. update status
6. isi outcome campaign
7. cek dampaknya ke KPI

## 6. Owner/admin workflow

1. buka `KPI Command Center`
2. review KPI foundation dan business KPI
3. cek persistent alerts
4. acknowledge / resolve / reopen / escalate
5. cek source performance dan marketing-attributed KPI

---

## Key Dashboard Areas

Halaman utama yang sekarang penting:

- `/dashboard`
- `/dashboard/start`
- `/dashboard/upload`
- `/dashboard/sales`
- `/dashboard/sales/conversations/[conversationId]`
- `/dashboard/crm`
- `/dashboard/crm/[leadId]`
- `/dashboard/follow-up`
- `/dashboard/approvals`
- `/dashboard/notifications`
- `/dashboard/marketing`
- `/dashboard/kpi`
- `/dashboard/channels`
- `/dashboard/customers/[customerId]`

---

## Knowledge Layer

Folder `clara_knowledge` dipakai dalam dua fungsi berbeda:

### 1. Knowledge factual

Di-import ke tabel `product_knowledge`, misalnya:

- `SALES_KNOWLEDGE_BRIDGE_MINI.md`
- `POSITIONING.md`
- `OBJECTION.md`
- `OBJECTION_EXTREME.md`

### 2. Response playbook

Dipakai sebagai rule / strategy saat AI menyusun balasan:

- `instruction.md`
- `GUARDRAIL.md`
- `FLOW.md`
- `PERSONALITY_MODE.md`
- `AUTO_ADAPT.md`
- `CLOSING_ENGINE.md`

Alasan dipisah:

- factual knowledge = sumber fakta produk
- playbook = guardrail tone, style, closing, dan aturan respons

---

## Data & Security Notes

Beberapa prinsip penting yang dipakai Clara:

- auth berbasis browser session / token flow yang aman
- role-based access control
- isolasi multi-tenant berbasis `organization_id`
- password hashing dengan Argon2
- owner/admin permission dibatasi sesuai scope
- approval dan notifikasi penting memiliki audit trail

### Hal yang wajib Anda jaga saat development

- jangan commit `.env`
- jangan hard-code secret
- rotate API key yang pernah bocor
- jangan jalankan backend dengan config debug sembarangan di production
- review permission boundary saat menambah route baru
- validasi semua input dari upload, paste chat, dan extension snapshot

### Risiko yang perlu terus dijaga

- XSS pada UI yang menampilkan chat/customer content
- injection pada query/filter baru
- broken access control antar organization
- kebocoran data lintas role
- extension permission creep

---

## Testing

## Backend

```bash
cd clara-backend
uv run pytest
```

## Frontend type-check

```bash
cd clara-dashboard
./node_modules/.bin/tsc --noEmit
```

## Python compile sanity check

```bash
cd clara-backend
python3 -m compileall app scripts
```

---

## Troubleshooting

## `uv run alembic upgrade head` gagal `connection refused`

Biasanya PostgreSQL belum hidup.

Jalankan:

```bash
cd /Users/newsmaker23/Projects/clara
docker compose -f infra/docker-compose.yml up -d
```

Lalu ulang:

```bash
cd clara-backend
uv run alembic upgrade head
```

## Dashboard build error karena leftover merge conflict

Cek marker conflict:

```bash
rg -n '^(<<<<<<<|=======|>>>>>>>)' clara-dashboard
```

## Extension belum unlock

Pastikan:

- backend hidup
- dashboard login di browser yang sama
- extension membaca session yang benar

---

## Project README Lain

Untuk detail per aplikasi, lihat juga:

- [Backend README](./clara-backend/README.md)
- [Dashboard README](./clara-dashboard/README.md)
- [Extension README](./clara-extension/README.md)

---

## Final Notes

Clara bukan hanya dashboard chat atau AI reply generator. Clara sekarang adalah:

- sales copilot
- CRM operasional
- marketing insight workspace
- owner command center
- multi-channel operations platform

Kalau Anda mengembangkan Clara lebih lanjut, jaga tiga hal ini:

1. jangan campur UI concern dan business logic
2. jangan longgarkan batas authorization antar role / organization
3. jangan menambah “fitur pintar” tanpa memikirkan workflow operasional nyata
