# Clara

Clara adalah monorepo untuk **sales operations platform** yang dipakai untuk membaca chat customer, mengubahnya menjadi lead yang bisa dieksekusi, membantu follow-up harian, memudahkan coaching manager, dan menjaga knowledge tim tetap rapi.

Clara bukan CRM biasa. Fokus utamanya adalah **alur kerja operasional sehari-hari**:

- chat customer masuk dari upload, paste chat, extension, atau webhook
- sistem membuat atau menyinkronkan `conversation`, `lead`, dan `customer profile`
- AI membantu membaca intent, objection, stage, next action, account category, dan draft balasan
- sales mengeksekusi dari queue, CRM, action center, dan customer profile
- manager dan head melakukan review, coaching, monitoring, dan intervensi
- knowledge baru bisa diangkat dari percakapan nyata lalu dipublikasikan

## Siapa yang Perlu Membaca README Ini

README ini dibuat untuk:

- developer yang ingin menjalankan Clara secara lokal
- developer yang ingin mengubah backend, dashboard, atau extension
- QA / tester yang butuh peta fitur dan alur manual test
- tim produk / operasional yang ingin memahami arsitektur dan flow Clara

Kalau kamu butuh panduan untuk **user akhir**, lihat manual ini:

- [docs/CLARA_USER_MANUAL.md](docs/CLARA_USER_MANUAL.md)
- [docs/CLARA_USER_MANUAL.pdf](docs/CLARA_USER_MANUAL.pdf)

## Dokumen Terkait

- Manual user:
  - [docs/CLARA_USER_MANUAL.md](docs/CLARA_USER_MANUAL.md)
  - [docs/CLARA_USER_MANUAL.pdf](docs/CLARA_USER_MANUAL.pdf)
- Manual per role:
  - [docs/CLARA_SUPERADMIN_MANUAL.md](docs/CLARA_SUPERADMIN_MANUAL.md)
  - [docs/CLARA_HEAD_MANUAL.md](docs/CLARA_HEAD_MANUAL.md)
  - [docs/CLARA_MANAGER_MANUAL.md](docs/CLARA_MANAGER_MANUAL.md)
  - [docs/CLARA_SALES_MANUAL.md](docs/CLARA_SALES_MANUAL.md)
- Use case onboarding per role:
  - [docs/CLARA_ROLE_USE_CASES.md](docs/CLARA_ROLE_USE_CASES.md)
- Tutorial detail per role:
  - [docs/CLARA_SUPERADMIN_TUTORIAL.md](docs/CLARA_SUPERADMIN_TUTORIAL.md)
  - [docs/CLARA_HEAD_TUTORIAL.md](docs/CLARA_HEAD_TUTORIAL.md)
  - [docs/CLARA_MANAGER_TUTORIAL.md](docs/CLARA_MANAGER_TUTORIAL.md)
  - [docs/CLARA_SALES_TUTORIAL.md](docs/CLARA_SALES_TUTORIAL.md)
- Tutorial deploy:
  - [docs/CLARA_DEPLOY_SERVER_TUTORIAL.md](docs/CLARA_DEPLOY_SERVER_TUTORIAL.md)
  - [docs/CLARA_DOCKER_PRODUCTION.md](docs/CLARA_DOCKER_PRODUCTION.md)
- Flowchart arsitektur dan operasional:
  - [docs/CLARA_PROJECT_FLOWCHART.md](docs/CLARA_PROJECT_FLOWCHART.md)
- Manual test:
  - [MANUAL_TEST_CASES_CLARA.md](MANUAL_TEST_CASES_CLARA.md)
  - [TEST_CONVERSATIONS_CLARA.md](TEST_CONVERSATIONS_CLARA.md)
- Spesifikasi:
  - [SCC_Spesifikasi_Master.md](SCC_Spesifikasi_Master.md)
- Referensi pembanding dengan sistem lama:
  - [clara-vs-sales-command-center-comparison.md](clara-vs-sales-command-center-comparison.md)

## Gambaran Produk

Secara sederhana, Clara berjalan seperti ini:

```text
Customer Chat
  -> Upload / Paste Chat / Extension / Webhook
  -> Clara Backend (FastAPI)
  -> PostgreSQL + Redis
  -> Clara Dashboard (Next.js)
  -> Human workflow: sales / manager / head / superadmin
  -> AI analysis + knowledge routing
  -> CRM / follow-up / coaching / customer intelligence / knowledge loop
```

### Masalah yang Diselesaikan Clara

Clara dibuat untuk mengatasi masalah operasional seperti:

- chat masuk banyak, tapi tim bingung mana yang harus dikerjakan dulu
- satu customer terbaca sebagai beberapa orang karena datang dari banyak channel / lead
- sales kesulitan menulis balasan yang konsisten
- manager sulit tahu chat mana yang macet dan perlu coaching
- head sulit melihat bottleneck tim dan boundary alert
- knowledge penting hanya tersimpan di kepala sales, bukan di sistem

## Struktur Monorepo

```text
.
├── clara-backend
├── clara-dashboard
├── clara-extension
├── clara_knowledge
├── docs
├── infra
├── sales-command-center
├── scripts
├── MANUAL_TEST_CASES_CLARA.md
├── TEST_CONVERSATIONS_CLARA.md
└── SCC_Spesifikasi_Master.md
```

### Penjelasan Folder Utama

- `clara-backend`
  - FastAPI API server, auth, role access, CRM, customer intelligence, AI analysis, knowledge import, webhook, dashboard aggregation
- `clara-dashboard`
  - Next.js dashboard operasional untuk role sales, manager, head, dan superadmin
- `clara-extension`
  - browser extension untuk membantu ingest context dari WhatsApp Web dan mengirim request AI suggestion
- `clara_knowledge`
  - knowledge source berbentuk markdown, termasuk knowledge `mini` dan `regular`
- `docs`
  - manual user, PDF manual, dan aset dokumentasi
- `infra`
  - service lokal seperti PostgreSQL dan Redis
- `sales-command-center`
  - sistem lama yang masih dipakai sebagai referensi flow atau data structure tertentu
- `scripts`
  - helper script untuk jalanin dashboard/extension dari root repo

## Stack Teknologi

### Backend

- FastAPI
- SQLAlchemy
- Alembic
- PostgreSQL
- Redis
- OpenAI SDK
- `uv` untuk dependency management dan command runner

### Dashboard

- Next.js `16.2.6`
- React `19.2.4`
- TypeScript
- Tailwind CSS 4

### Extension

- Plasmo
- React `18.2.0`
- local OpenAI proxy

## Role dan Model Akses

Role yang dipakai saat ini:

- `sales`
- `manager`
- `head`
- `superadmin`

Hierarchy akses:

```text
superadmin > head > manager > sales
```

Catatan penting:

- role lama seperti `marketing`, `admin`, `owner`, dan `super_admin` masih dinormalisasi oleh sistem
- `superadmin` punya visibilitas global lintas organization
- `manager` dan `head` tetap dibatasi scope team / unit / organization sesuai policy backend
- dashboard juga punya route guard di frontend, tapi **source of truth tetap backend authorization**

## Workflow Utama Clara

### 1. Chat Intake

Chat bisa masuk dari:

- upload file TXT
- paste chat manual
- Clara extension
- WhatsApp Meta webhook

Hasil dari tahap ini:

- conversation baru dibuat atau ditemukan
- lead baru dibuat atau disambungkan
- customer profile awal dibuat atau dicocokkan
- chat siap dianalisis oleh Clara

### 2. Queue

Queue dipakai terutama oleh `sales`.

Tujuannya:

- melihat chat yang aktif
- tahu chat mana yang perlu dibaca atau dibalas
- menjalankan AI analysis
- generate draft balasan
- membuka conversation detail

### 3. Conversation Detail

Halaman ini dipakai untuk:

- membaca transcript chat
- melihat hasil AI analysis
- melihat draft reply
- melihat account category
- melihat customer / lead context
- melihat coaching / review status
- membuka lead detail atau customer detail

### 4. Lead Management / CRM

CRM Clara dipakai untuk:

- melihat daftar lead
- memonitor stage dan temperature
- melihat owner / PIC
- membaca next follow-up
- melihat overdue, discipline stale, need sync, dan worklog gap
- membuka lead detail

### 5. Lead Detail

Lead detail dipakai untuk:

- update stage
- update next follow-up
- update account category
- melihat activity timeline
- melihat deal metrics
- mengisi discipline log
- melihat task follow-up
- melihat customer profile terkait

### 6. Customer Intelligence

Clara sekarang punya modul customer tersendiri:

- `Customer List`
- `Customer Detail`

Tujuannya:

- menyatukan identitas customer lintas lead dan channel
- menghindari satu orang terbaca sebagai banyak customer
- menyimpan data customer yang lebih rapi
- menampilkan account category dan temperature customer
- memberi user tempat untuk koreksi manual kalau AI salah baca

### 7. Action Center

Action Center dipakai untuk:

- melihat overdue follow-up
- melihat task yang harus dikerjakan hari ini
- membaca worklist harian
- membantu sales fokus ke item paling urgent dulu

### 8. Alert Center

Alert Center dipakai untuk:

- sinyal operasional aktif
- overdue follow-up
- sync issue
- alert boundary untuk manager atau head

### 9. Chat Review / Coaching

Manager dan head bisa:

- melihat chat yang perlu direview
- memberi feedback ke sales
- membuat coaching case
- menandai approval, rework, atau escalation

### 10. Knowledge Workflow

Clara mendukung:

- product knowledge
- proposal knowledge dari conversation
- review / approve / reject proposal
- publish ke knowledge base
- routing knowledge berdasarkan account category

### 11. Manager Insights dan KPI

Dipakai untuk:

- discipline by team
- coaching priority
- objection trend
- alert boundary
- KPI operasional
- snapshot performa tim

## Fitur yang Sudah Aktif

### Sales operations

- queue conversation
- conversation detail
- AI analysis
- reply suggestion
- sent message tracking
- action center
- lead capture

### CRM dan execution

- lead list
- lead detail
- stage update
- next follow-up
- owner assignment
- activity timeline
- deal metrics
- discipline log
- task follow-up

### Customer intelligence

- customer list
- customer detail
- merge candidates
- account category summary
- manual account category override
- temperature auto-sync dari analisis / lead
- manual temperature override
- AI autofill untuk field customer tertentu

### Coaching dan review

- chat review center
- manager note
- review queue
- approval / rework / escalation

### Knowledge

- import markdown knowledge
- routing `mini` vs `reguler`
- proposal knowledge dari operasi
- publish ke product knowledge

### Access control

- role-aware navigation
- scoped backend access
- frontend redirect untuk route yang tidak boleh diakses

## Knowledge Routing: Mini vs Reguler

Clara sekarang memakai knowledge source yang berbeda berdasarkan `account_category`.

Kategori yang dipakai:

- `mini`
- `reguler`
- `unknown`

Routing yang berlaku:

- kalau lead / customer masuk kategori `mini`, Clara memakai knowledge mini
- kalau kategori `reguler`, Clara memakai knowledge regular
- kalau `unknown`, sistem fallback ke flow default yang aman

Knowledge source lokal utama:

- [clara_knowledge/clara_knowledge_mini](clara_knowledge/clara_knowledge_mini)
- [clara_knowledge/clara_knowledge_regular](clara_knowledge/clara_knowledge_regular)

Ini penting untuk:

- AI reply suggestion
- positioning produk
- objection handling
- legalitas dan narasi produk

## AI Autofill Customer Profile

Clara bisa mengisi sebagian data customer otomatis dari hasil analisis chat.

Field yang bisa diisi otomatis:

- nama customer
- phone
- email
- address
- account category
- customer temperature

Aturan amannya:

- data hanya diisi kalau confidence cukup
- nilai manual tidak boleh sembarang dioverwrite otomatis
- perubahan penting dicatat ke activity timeline
- user tetap bisa koreksi manual dari customer detail

## Halaman Dashboard Penting

Halaman yang paling sering dipakai saat ini:

- `/dashboard`
- `/dashboard/sales`
- `/dashboard/sales/conversations/:conversationId`
- `/dashboard/crm`
- `/dashboard/crm/:leadId`
- `/dashboard/customers`
- `/dashboard/customers/:customerId`
- `/dashboard/follow-up`
- `/dashboard/notifications`
- `/dashboard/approvals`
- `/dashboard/manager-insights`
- `/dashboard/knowledge`
- `/dashboard/kpi`
- `/dashboard/admin/access`

## Prasyarat Lokal

Sebelum menjalankan Clara, siapkan:

- Node.js modern
- npm
- Python `>= 3.14`
- `uv`
- Docker dan Docker Compose untuk infra lokal

Kalau mau development yang stabil:

- pakai browser Chrome untuk testing dashboard dan extension
- pastikan PostgreSQL `5432` dan Redis `6379` tidak bentrok dengan service lain

## Setup Lokal Cepat

### 1. Jalankan Infra

Dari root repo:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Service default:

- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

Default credential lokal:

- database: `clara_db`
- user: `clara_user`
- password: `clara_password_dev_only`

Catatan:

- compose di `infra/docker-compose.yml` fokus untuk local/dev workflow
- untuk deploy server/testing bersama, lihat:
  - [docs/CLARA_DEPLOY_SERVER_TUTORIAL.md](docs/CLARA_DEPLOY_SERVER_TUTORIAL.md)
  - [docs/CLARA_DOCKER_PRODUCTION.md](docs/CLARA_DOCKER_PRODUCTION.md)

### 2. Setup Backend

```bash
cd clara-backend
cp .env.example .env
uv sync
uv run python scripts/setup_local_environment.py
uv run uvicorn app.main:app --reload
```

Endpoint default:

- API: `http://127.0.0.1:8000`
- Swagger / OpenAPI: `http://127.0.0.1:8000/docs`

### 3. Setup Dashboard

```bash
cd clara-dashboard
cp .env.example .env.local
npm install
npm run dev
```

Frontend default:

- Dashboard: `http://localhost:3000`

### 4. Setup Extension

```bash
cd clara-extension
cp .env.example .env
npm install
npm run dev
```

Mode dev extension juga menjalankan local proxy untuk AI suggestion.

Catatan:

- extension tidak dijalankan sebagai service server seperti backend/dashboard
- extension dibuild terpisah lalu dipasang ke browser user
- kalau Clara dijalankan di VPS/IP/domain lain, env extension dan `host_permissions` perlu disesuaikan sebelum build/package

### 5. Jalankan dari Root Repo

Kalau mau jalanin helper dari root:

```bash
npm install
npm run dev
```

Script root yang tersedia:

- `npm run dev`
- `npm run dev:dashboard`
- `npm run dev:extension`
- `npm run prod`
- `npm run build`
- `npm run build:dashboard`
- `npm run build:extension`
- `npm run package:extension`
- `npm run start`
- `npm run start:dashboard`
- `npm run start:extension-proxy`

## Environment Variables Penting

### Backend

Minimal yang perlu diisi:

```env
APP_ENV=development
DATABASE_URL=postgresql+psycopg://clara_user:clara_password_dev_only@localhost:5432/clara_db
REDIS_URL=redis://localhost:6379/0
OPENAI_API_KEY=replace_with_your_openai_api_key
OPENAI_MODEL=gpt-4.1-mini
JWT_SECRET_KEY=replace_with_a_long_random_secret
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Variable backend penting lain:

- `SGCC_INTEGRATION_API_KEY`
- `SGCC_INTEGRATION_RATE_LIMIT_PER_MINUTE`
- `JWT_ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `AUTH_COOKIE_NAME`
- `CSRF_COOKIE_NAME`
- `AUTH_COOKIE_DOMAIN`
- `AUTH_COOKIE_SAMESITE`
- `LOGIN_RATE_LIMIT_PER_MINUTE`
- `BOOTSTRAP_OWNER_NAME`
- `BOOTSTRAP_OWNER_EMAIL`
- `BOOTSTRAP_OWNER_PASSWORD`
- `BOOTSTRAP_ORGANIZATION_NAME`
- `BOOTSTRAP_ORGANIZATION_SLUG`
- `CLARA_KNOWLEDGE_OWNER_EMAIL`
- `WHATSAPP_META_VERIFY_TOKEN`
- `WHATSAPP_META_APP_SECRET`
- `WHATSAPP_META_DEFAULT_ORGANIZATION_SLUG`
- `WHATSAPP_META_DEFAULT_SALES_USER_EMAIL`

Catatan:

- jangan commit `.env`
- ganti semua secret default sebelum dipakai di staging / production

### Dashboard

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_CSRF_COOKIE_NAME=clara_csrf_token
```

### Extension

```env
OPENAI_API_KEY=sk-ganti-dengan-api-key-openai-kamu
OPENAI_MODEL=gpt-5.4-mini
PORT=9898
PLASMO_PUBLIC_OPENAI_PROXY_URL=http://127.0.0.1:9898/reply-suggestions
PLASMO_PUBLIC_CLARA_API_BASE_URL=http://127.0.0.1:8000
PLASMO_PUBLIC_CLARA_DASHBOARD_URL=http://localhost:3000
PLASMO_PUBLIC_CLARA_AUTH_COOKIE_NAME=clara_access_token
```

Catatan penting:

- untuk testing via VPS/IP:
  - `PLASMO_PUBLIC_CLARA_API_BASE_URL=http://IP_SERVER/api`
  - `PLASMO_PUBLIC_CLARA_DASHBOARD_URL=http://IP_SERVER`
- untuk production domain:
  - `PLASMO_PUBLIC_CLARA_API_BASE_URL=https://domain-kamu/api`
  - `PLASMO_PUBLIC_CLARA_DASHBOARD_URL=https://domain-kamu`
- extension sekarang memakai session cookie Clara, jadi origin dashboard dan API harus benar

## Database Migration

### Penting: cek state Alembic head sebelum migrasi manual

Repo ini sempat punya riwayat multi-head Alembic. Karena itu:

- untuk setup lokal paling aman, pakai `scripts/setup_local_environment.py`
- untuk migrasi manual, cek dulu hasil `uv run alembic heads`
- kalau muncul error multi-head, gunakan `uv run alembic upgrade heads`

Command yang berguna:

```bash
uv run alembic current
uv run alembic heads
uv run alembic history
```

Kalau ada error backend seperti:

```text
psycopg.errors.UndefinedColumn: column lead_tasks.workflow_scope does not exist
```

itu biasanya berarti migration branch lain belum diaplikasikan. Solusinya:

```bash
uv run alembic upgrade heads
```

## Bootstrap, Seed, dan Knowledge Import

Script penting di backend:

- `scripts/setup_local_environment.py`
- `scripts/bootstrap_owner.py`
- `scripts/create_owner.py`
- `scripts/import_clara_knowledge.py`
- `scripts/migrate_legacy_roles.py`

Urutan awal yang disarankan:

```bash
uv run python scripts/setup_local_environment.py
```

Fungsi script:

- `setup_local_environment.py`
  - menjalankan migration `heads`, bootstrap owner, dan import knowledge dalam satu proses supaya startup lokal tidak membayar overhead `uv run` berulang
- `bootstrap_owner.py`
  - membuat owner / organization awal untuk local setup
- `create_owner.py`
  - helper pembuatan owner tambahan
- `import_clara_knowledge.py`
  - import knowledge markdown ke database
- `migrate_legacy_roles.py`
  - migrasi role lama ke model role baru

## Command Harian yang Sering Dipakai

### Backend

```bash
cd clara-backend
uv sync
uv run python scripts/setup_local_environment.py
uv run uvicorn app.main:app --reload
uv run python scripts/import_clara_knowledge.py
```

### Dashboard

```bash
cd clara-dashboard
npm install
npm run dev
npx tsc --noEmit
```

### Extension

```bash
cd clara-extension
npm install
npm run dev
npm run package
```

## Quality Check dan Testing

### Backend

```bash
cd clara-backend
uv run pytest
uv run ruff check .
```

### Dashboard

```bash
cd clara-dashboard
npm run build
npx tsc --noEmit
```

### Extension

```bash
cd clara-extension
npm run build
```

### Manual Test

Gunakan file berikut:

- [MANUAL_TEST_CASES_CLARA.md](MANUAL_TEST_CASES_CLARA.md)
- [TEST_CONVERSATIONS_CLARA.md](TEST_CONVERSATIONS_CLARA.md)

## Catatan Access Control

Beberapa guard yang penting:

- `sales` fokus ke kerja operasional harian
- `manager` fokus ke review, coaching, monitoring tim, dan lead visibility yang scoped
- `head` fokus ke monitoring, insight, access control, dan governance organisasi
- `superadmin` punya akses penuh lintas organization

Prinsip security:

- jangan hanya mengandalkan hidden menu di frontend
- route sensitif harus tetap divalidasi di backend
- quick action tetap harus lewat authorization backend
- update penting seperti owner, stage, account category, dan profile sync harus tercatat

## Catatan Lead Capture

Lead Capture sekarang mewajibkan **judul conversation diisi dengan nama customer**.

Tujuannya:

- conversation baru tidak punya title generik
- identity awal customer lebih rapi
- AI analysis punya konteks awal yang lebih baik
- data downstream di CRM dan customer profile lebih konsisten

## Catatan Customer Intelligence

Beberapa hal penting di area customer:

- customer profile bisa diisi otomatis oleh Clara dari analisis chat
- user tetap bisa koreksi manual
- account category bisa tampil lintas queue, chat review, conversation detail, lead detail, dan customer detail
- customer temperature bisa otomatis dari Clara, tapi tetap bisa dioverride manual

Ini sengaja dibuat supaya user tetap punya kontrol operasional dan tidak buta pada keputusan AI.

## Troubleshooting

### 1. `git push` ditolak karena `non-fast-forward`

Biasanya branch lokal tertinggal dari remote.

Pakai:

```bash
git pull --rebase origin sgcc
git push origin sgcc
```

Kalau ada conflict:

```bash
git add .
git rebase --continue
```

### 2. `alembic upgrade head` gagal karena multiple heads

Gunakan:

```bash
uv run alembic upgrade heads
```

### 3. Halaman dashboard error karena kolom database tidak ada

Contoh:

```text
column lead_tasks.workflow_scope does not exist
```

Solusi:

```bash
cd clara-backend
uv run alembic upgrade heads
```

### 4. Dashboard runtime error `isHeadRole is not a function`

Kalau ini sempat muncul setelah update role helper:

- pastikan dependency frontend sudah bersih
- restart dev server
- hard refresh browser

```bash
cd clara-dashboard
npm run dev
```

### 5. Backend jalan, tapi dashboard tidak bisa login / fetch data

Cek:

- backend hidup di `http://127.0.0.1:8000`
- `NEXT_PUBLIC_API_BASE_URL` benar
- cookie / CSRF name sama antara backend dan dashboard
- `ALLOWED_ORIGINS` mengizinkan `http://localhost:3000`

### 6. Extension tidak bisa kirim request AI

Cek:

- `OPENAI_API_KEY` di extension
- proxy extension hidup di port yang benar
- `PLASMO_PUBLIC_OPENAI_PROXY_URL` benar
- `PLASMO_PUBLIC_CLARA_API_BASE_URL` benar
- `PLASMO_PUBLIC_CLARA_DASHBOARD_URL` benar
- `PLASMO_PUBLIC_CLARA_AUTH_COOKIE_NAME` benar
- `host_permissions` extension mengizinkan IP/domain Clara yang sedang dipakai

### 7. Clara jalan di server, tapi browser luar tidak bisa akses

Cek:

- Nginx listen di `0.0.0.0:80`
- backend dan dashboard sehat dari `127.0.0.1`
- IP yang dipakai benar-benar IP public, bukan `192.168.x.x`
- firewall VPS / security group provider membuka port `80` atau `443`

### 8. Docker production backend unhealthy

Cek:

- `docker compose -f infra/docker-compose.prod.yml logs backend`
- password PostgreSQL di `infra/.env`
- kalau password DB mengandung `@` atau `#`, pastikan `DATABASE_URL` dibentuk dengan benar
- sinkronkan password asli PostgreSQL dan password yang dipakai backend container

## Known Issues Saat Ini

Beberapa hal yang perlu diingat:

- repo sempat punya multi-head migration Alembic, jadi migration command harus hati-hati
- ada kemungkinan masih ada pekerjaan TypeScript yang belum bersih total di halaman dashboard tertentu jika branch berubah lagi
- beberapa flow masih bergantung pada integrasi knowledge dan data operasional yang terus berkembang

Kalau kamu sedang mengerjakan fitur besar, **selalu cek state branch, migration, dan role helper** sebelum menyimpulkan bug berasal dari UI.

## Rekomendasi Cara Kerja Developer

Kalau kamu baru pegang repo ini, urutan kerja yang paling aman:

1. Jalankan infra
2. Setup backend dan migration
3. Bootstrap owner dan import knowledge
4. Jalankan dashboard
5. Jalankan extension bila perlu
6. Login sebagai role yang sesuai
7. Jalankan manual test dari file test case

Kalau mau mengubah fitur:

1. pahami role yang terdampak
2. cek apakah ada impact ke backend authorization
3. cek apakah ada impact ke customer profile / lead / conversation linkage
4. cek apakah knowledge routing `mini` vs `reguler` ikut terdampak
5. cek migration kalau ada perubahan schema

## Ringkasan Singkat

Clara adalah platform operasional sales berbasis chat dengan fokus pada:

- ingest chat
- CRM execution
- follow-up worklist
- customer intelligence
- coaching dan review
- knowledge loop
- role-aware monitoring

Repo ini sudah berkembang cukup besar, jadi README ini sengaja dibuat detail supaya developer baru bisa:

- cepat jalanin sistem
- paham modul utamanya
- tahu command harian yang benar
- tidak salah langkah di migration, role access, dan workflow operasional

Kalau targetmu sudah bergeser dari local dev ke server/testing bersama, lanjut ke:

- [docs/CLARA_DEPLOY_SERVER_TUTORIAL.md](docs/CLARA_DEPLOY_SERVER_TUTORIAL.md) untuk jalur non-Docker
- [docs/CLARA_DOCKER_PRODUCTION.md](docs/CLARA_DOCKER_PRODUCTION.md) untuk jalur Docker production
