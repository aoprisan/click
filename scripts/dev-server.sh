#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

export PATH="${GOPATH:-$HOME/go}/bin:$PATH"

if ! command -v air &>/dev/null; then
  echo "Air is not installed."
  echo "Install it with: go install github.com/air-verse/air@latest"
  exit 1
fi

exec air
