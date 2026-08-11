#!/usr/bin/env bash
#
# ios-build.sh — compile the Capacitor iOS app locally (web bundle + Xcode).
#
# Local only, by design: iOS builds need a macOS host with Xcode (and, for
# devices, a signing identity), so this is never run in GitHub Actions.
#
#   npm run ios:build                    # Debug, iOS Simulator, unsigned
#   npm run ios:build -- --release       # Release, still simulator
#   npm run ios:build -- --device        # generic iOS device, signed
#   npm run ios:build -- --skip-web      # reuse the bundle already synced
#
# Options:
#   --debug | --release     build configuration (default: debug)
#   --simulator | --device  destination (default: simulator)
#   --skip-web              don't rebuild/sync the Vite bundle
#   --clean                 wipe DerivedData first
#   --team <id>             DEVELOPMENT_TEAM for device builds (or IOS_TEAM_ID)
#   -h, --help              this text
set -euo pipefail

# shellcheck source=./ios-common.sh
. "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/ios-common.sh"

configuration=Debug
destination=simulator
skip_web=0
clean=0
team="${IOS_TEAM_ID:-}"

usage() { print_header_doc "${BASH_SOURCE[0]}"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --debug)      configuration=Debug ;;
    --release)    configuration=Release ;;
    --simulator)  destination=simulator ;;
    --device)     destination=device ;;
    --skip-web)   skip_web=1 ;;
    --clean)      clean=1 ;;
    --team)       shift; team="${1:-}"; [ -n "$team" ] || die "--team needs a team id" ;;
    -h|--help)    usage; exit 0 ;;
    *)            die "unknown option: $1 (try --help)" ;;
  esac
  shift
done

require_macos
require_xcode

if [ "$skip_web" -eq 1 ]; then
  require_synced_web
  say "Reusing the web bundle already in ios/App/App/public"
else
  build_web
fi

if [ "$clean" -eq 1 ]; then
  say "Cleaning DerivedData"
  run rm -rf "$DERIVED_DATA"
fi

mkdir -p "$BUILD_DIR"

args=(
  -project "$XCODE_PROJECT"
  -scheme "$SCHEME"
  -configuration "$configuration"
  -derivedDataPath "$DERIVED_DATA"
)

if [ "$destination" = "simulator" ]; then
  # Unsigned: a simulator build needs no identity, so this works on a machine
  # that has never talked to an Apple developer account.
  args+=(
    -destination 'generic/platform=iOS Simulator'
    -sdk iphonesimulator
    CODE_SIGNING_ALLOWED=NO
    CODE_SIGNING_REQUIRED=NO
  )
  sdk_suffix=iphonesimulator
else
  args+=(
    -destination 'generic/platform=iOS'
    -sdk iphoneos
    -allowProvisioningUpdates
  )
  [ -n "$team" ] && args+=("DEVELOPMENT_TEAM=$team")
  sdk_suffix=iphoneos
fi

say "Building $SCHEME ($configuration, $destination)"
xcb "${args[@]}" build

app="$(built_app_path "$configuration" "$sdk_suffix")"
if [ -n "$app" ] && [ -d "$app" ]; then
  ok "built $app"
else
  warn "build finished but no .app found under $DERIVED_DATA/Build/Products"
fi

if [ "$destination" = "simulator" ]; then
  ok "install it with: npm run ios:run -- --skip-web"
else
  ok "package it with: npm run ios:archive"
fi
