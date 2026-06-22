#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

echo "==> [1/3] Backend UAT smoke tests"
cd "$ROOT_DIR/clara-backend"
UV_CACHE_DIR="$ROOT_DIR/tmp/uv-cache" uv run pytest \
  tests/test_reply_observability.py \
  tests/test_reply_suggestion_schema.py \
  tests/test_extension_snapshot_sync.py \
  tests/test_auth_access_control.py \
  -q

echo "==> [2/3] Dashboard production build"
cd "$ROOT_DIR/clara-dashboard"
npm run build

echo "==> [3/3] Extension production build"
cd "$ROOT_DIR/clara-extension"
npm run build

echo "==> UAT smoke check selesai"
