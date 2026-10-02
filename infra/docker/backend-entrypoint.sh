#!/bin/sh
set -e

cd /app/clara-backend

uv run --no-dev --frozen alembic upgrade head
uv run --no-dev --frozen python scripts/bootstrap_owner.py
uv run --no-dev --frozen python scripts/import_clara_knowledge.py

# Port backend hanya dipublish ke 127.0.0.1 host, jadi hanya reverse proxy di host yang bisa
# mengirim X-Forwarded-For. Isi FORWARDED_ALLOW_IPS dengan IP proxy kalau topologinya berbeda.
exec uv run --no-dev --frozen uvicorn app.main:app --host 0.0.0.0 --port 8000 \
  --proxy-headers --forwarded-allow-ips "${FORWARDED_ALLOW_IPS:-*}"
