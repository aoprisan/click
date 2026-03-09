#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

BINARY="./globalconflict"

if [ ! -f "$BINARY" ]; then
  echo "Binary not found. Run ./scripts/build.sh first."
  exit 1
fi

ADDR="${ADDR:-:8080}"
DB_PATH="${DB_PATH:-globalconflict.db}"

echo "Starting Global Conflict on ${ADDR} (db: ${DB_PATH})"
exec "$BINARY" -addr "$ADDR" -db "$DB_PATH"
