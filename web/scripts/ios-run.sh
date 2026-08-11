#!/usr/bin/env bash
#
# ios-run.sh — build, install and launch the app on an iOS Simulator.
#
# Local only (macOS + Xcode); nothing here runs in CI.
#
#   npm run ios:run                              # newest/booted iPhone sim
#   npm run ios:run -- --device "iPhone 16 Pro"  # a named simulator or a UDID
#   npm run ios:run -- --skip-web                # reuse the synced bundle
#   npm run ios:run -- --logs                    # stay attached to app stdout
#
# Note: Walk Mode's banked steps come from CMPedometer, which the simulator
# does not provide — background step banking can only be tested on a real
# device (npm run ios:build -- --device, then run from Xcode).
#
# Options:
#   --device <name|udid>  simulator to use (default: booted, else newest iPhone)
#   --debug | --release   build configuration (default: debug)
#   --skip-web            don't rebuild/sync the Vite bundle
#   --reinstall           uninstall the app first (clears localStorage saves)
#   --logs                launch attached to the console
#   -h, --help            this text
set -euo pipefail

# shellcheck source=./ios-common.sh
. "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/ios-common.sh"

configuration=Debug
device="${IOS_SIMULATOR:-}"
skip_web=0
reinstall=0
logs=0

usage() { print_header_doc "${BASH_SOURCE[0]}"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --device)    shift; device="${1:-}"; [ -n "$device" ] || die "--device needs a name or UDID" ;;
    --debug)     configuration=Debug ;;
    --release)   configuration=Release ;;
    --skip-web)  skip_web=1 ;;
    --reinstall) reinstall=1 ;;
    --logs)      logs=1 ;;
    -h|--help)   usage; exit 0 ;;
    *)           die "unknown option: $1 (try --help)" ;;
  esac
  shift
done

require_macos
require_xcode

# --- pick a simulator -------------------------------------------------------

if [ -n "$device" ]; then
  udid="$(sim_udid_for_name "$device" || true)"
  [ -n "$udid" ] || die "no available simulator named '$device'. See: xcrun simctl list devices available"
else
  udid="$(sim_booted_udid || true)"
  [ -n "$udid" ] || udid="$(sim_default_iphone_udid || true)"
  [ -n "$udid" ] || die "no iPhone simulators installed — add one in Xcode ▸ Settings ▸ Components"
fi
sim_name="$(sim_name_for_udid "$udid")"
say "Simulator: $sim_name ($udid)"

# --- build ------------------------------------------------------------------

build_args=(--"$(printf '%s' "$configuration" | tr '[:upper:]' '[:lower:]')" --simulator)
[ "$skip_web" -eq 1 ] && build_args+=(--skip-web)
bash "$IOS_COMMON_DIR/ios-build.sh" "${build_args[@]}"

app="$(built_app_path "$configuration" iphonesimulator)"
[ -n "$app" ] && [ -d "$app" ] || die "no built .app to install — the build step produced nothing"
bundle_id="$(app_bundle_id "$app")"

# --- boot, install, launch --------------------------------------------------

say "Booting"
if sim_is_booted "$udid"; then
  ok "already booted"
else
  run xcrun simctl boot "$udid"
fi
run open -a Simulator --args -CurrentDeviceUDID "$udid"
run xcrun simctl bootstatus "$udid" -b

if [ "$reinstall" -eq 1 ]; then
  say "Uninstalling $bundle_id (wipes its saved game)"
  run xcrun simctl uninstall "$udid" "$bundle_id" || true
fi

say "Installing $bundle_id"
run xcrun simctl install "$udid" "$app"

say "Launching"
if [ "$logs" -eq 1 ]; then
  ok "attached — Ctrl-C to detach (the app keeps running)"
  exec xcrun simctl launch --console-pty "$udid" "$bundle_id"
else
  run xcrun simctl launch "$udid" "$bundle_id"
  ok "running on $sim_name"
  ok "logs: xcrun simctl spawn '$udid' log stream --level debug --predicate 'subsystem CONTAINS \"$bundle_id\"'"
fi
