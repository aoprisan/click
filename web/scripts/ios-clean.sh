#!/usr/bin/env bash
#
# ios-clean.sh — delete everything the local iOS build scripts generate.
#
#   npm run ios:clean          # DerivedData, archives, exports, synced bundle
#   npm run ios:clean -- --all # …plus web/dist and the SPM checkout caches
#
# Only touches generated paths; the committed native project is left alone.
set -euo pipefail

# shellcheck source=./ios-common.sh
. "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/ios-common.sh"

all=0
while [ $# -gt 0 ]; do
  case "$1" in
    --all)     all=1 ;;
    -h|--help) print_header_doc "${BASH_SOURCE[0]}"; exit 0 ;;
    *)         die "unknown option: $1 (try --help)" ;;
  esac
  shift
done

targets=(
  "$BUILD_DIR"                 # DerivedData + archives + export + ExportOptions
  "$IOS_DIR/App/build"         # Xcode's default output location
  "$IOS_DIR/App/DerivedData"
  "$IOS_DIR/App/App/public"    # the synced web bundle
)

if [ "$all" -eq 1 ]; then
  targets+=(
    "$WEB_DIR/dist"
    "$IOS_DIR/App/CapApp-SPM/.build"
    "$IOS_DIR/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm"
  )
fi

say "Cleaning"
for target in "${targets[@]}"; do
  if [ -e "$target" ]; then
    run rm -rf "$target"
  else
    printf '%s   - %s (absent)%s\n' "$C_DIM" "${target#"$WEB_DIR/"}" "$C_OFF"
  fi
done

ok "clean — next build starts from scratch (npm run ios:build)"
