#!/bin/sh
set -e

cd /app/clara-backend

uv run --no-dev --frozen alembic upgrade head
uv run --no-dev --frozen python scripts/bootstrap_owner.py
uv run --no-dev --frozen python scripts/import_clara_knowledge.py

exec uv run --no-dev --frozen uvicorn app.main:app --host 0.0.0.0 --port 8000
