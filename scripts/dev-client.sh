#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../client"

if [ ! -d "node_modules" ]; then
  echo "node_modules not found, running npm install..."
  npm install
fi

exec npm run dev
