#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Installing client dependencies..."
cd client && npm ci
echo "==> Building client..."
npm run build
cd ..

echo "==> Building server..."
go build -o globalconflict .

echo "==> Build complete: ./globalconflict"
