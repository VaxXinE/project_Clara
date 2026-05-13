# Clara Backend

Backend Clara dibangun dengan:

- FastAPI
- SQLAlchemy 2.x
- Alembic
- PostgreSQL
- Redis

## Setup lokal cepat

Jalankan service pendukung dari root monorepo:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Lalu dari folder backend:

```bash
cd clara-backend
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run python scripts/bootstrap_owner.py
uv run uvicorn app.main:app --reload
```

Endpoint default:

- API: `http://127.0.0.1:8000`
- Docs: `http://127.0.0.1:8000/docs`
- Health: `http://127.0.0.1:8000/health`

## Bootstrap owner

Script [bootstrap_owner.py](/Users/newsmaker23/Projects/clara/clara-backend/scripts/bootstrap_owner.py) dipakai untuk membuat:

- 1 organization awal
- 1 user `owner` awal

Env yang dipakai:

```env
BOOTSTRAP_OWNER_NAME=Clara Owner
BOOTSTRAP_OWNER_EMAIL=owner@clara.local
BOOTSTRAP_OWNER_PASSWORD=OwnerPass123!
BOOTSTRAP_ORGANIZATION_NAME=Clara Local
BOOTSTRAP_ORGANIZATION_SLUG=clara-local
```

Behavior:

- kalau semua env `BOOTSTRAP_*` kosong -> script skip dengan aman
- kalau env diisi tidak lengkap -> script fail dengan pesan jelas
- kalau owner sudah ada -> script skip dan tidak membuat duplikat

## Catatan penting

- Jangan taruh logic create user di migration Alembic.
- Migration harus tetap fokus ke schema database.
- Bootstrap data awal lebih aman dipisah ke script idempotent seperti ini.
