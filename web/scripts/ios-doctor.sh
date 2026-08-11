#!/usr/bin/env bash
#
# ios-doctor.sh — check this machine can build the Capacitor iOS app.
#
# Local only: reports on macOS/Xcode/simulators/signing, none of which exist on
# the CI runners, which is why the iOS build is not wired into GitHub Actions.
#
#   npm run ios:doctor
#
# Exits non-zero if something would stop a build; warnings alone exit 0.
set -uo pipefail

# shellcheck source=./ios-common.sh
. "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/ios-common.sh"

problems=0
note_problem() { problems=$((problems + 1)); }

say "Host"
if [ "$(uname -s)" = "Darwin" ]; then
  ok "macOS $(sw_vers -productVersion 2>/dev/null || echo '?') ($(uname -m))"
else
  printf '%s  ✗%s %s\n' "$C_RED" "$C_OFF" "$(uname -s) — iOS builds need macOS" >&2
  note_problem
fi

say "Xcode"
if command -v xcodebuild >/dev/null 2>&1 && xcodebuild -version >/dev/null 2>&1; then
  ok "$(xcodebuild -version | tr '\n' ' ')"
  ok "developer dir: $(xcode-select -p 2>/dev/null)"
  if xcodebuild -showsdks 2>/dev/null | grep -q iphoneos; then
    ok "iOS SDK: $(xcodebuild -showsdks 2>/dev/null | sed -n 's/.*-sdk \(iphoneos[0-9.]*\).*/\1/p' | tail -1)"
  else
    warn "no iOS SDK found in this Xcode install"
  fi
else
  printf '%s  ✗%s %s\n' "$C_RED" "$C_OFF" \
    "xcodebuild unusable — install Xcode, then: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer" >&2
  note_problem
fi

say "Simulators"
if command -v xcrun >/dev/null 2>&1; then
  sim_count="$(sim_list available | wc -l | tr -d ' ')"
  if [ "${sim_count:-0}" -gt 0 ]; then
    ok "$sim_count available"
    booted="$(sim_booted_udid || true)"
    [ -n "$booted" ] && ok "booted: $(sim_name_for_udid "$booted")"
    default="$(sim_default_iphone_udid || true)"
    [ -n "$default" ] && ok "ios:run default: $(sim_name_for_udid "$default")"
  else
    warn "no simulators installed — Xcode ▸ Settings ▸ Components"
  fi
else
  warn "xcrun not found; simulator checks skipped"
fi

say "Signing (device builds / archives only)"
identities="$(security find-identity -v -p codesigning 2>/dev/null | grep -c '"Apple Develop' || true)"
if [ "${identities:-0}" -gt 0 ]; then
  ok "$identities codesigning identit$([ "$identities" -eq 1 ] && echo y || echo ies) in the keychain"
else
  warn "no Apple Development identity — simulator builds still work; 'ios:archive' will not"
fi
if [ -n "${IOS_TEAM_ID:-}" ]; then
  ok "IOS_TEAM_ID=$IOS_TEAM_ID"
else
  warn "IOS_TEAM_ID unset — pass --team to ios:archive (Xcode ▸ Settings ▸ Accounts shows the ID)"
fi

say "Toolchain"
if command -v node >/dev/null 2>&1; then ok "node $(node --version)"; else
  printf '%s  ✗%s node not found\n' "$C_RED" "$C_OFF" >&2; note_problem; fi
if command -v npm >/dev/null 2>&1; then ok "npm $(npm --version)"; else
  printf '%s  ✗%s npm not found\n' "$C_RED" "$C_OFF" >&2; note_problem; fi
[ -d "$WEB_DIR/node_modules" ] && ok "node_modules present" || warn "node_modules missing — scripts will 'npm ci' first"
if command -v xcbeautify >/dev/null 2>&1; then ok "xcbeautify (pretty logs)"
elif command -v xcpretty >/dev/null 2>&1; then ok "xcpretty (pretty logs)"
else warn "neither xcbeautify nor xcpretty — raw xcodebuild logs (brew install xcbeautify)"; fi

say "Project"
[ -d "$XCODE_PROJECT" ] && ok "$XCODE_PROJECT" || { printf '%s  ✗%s missing %s\n' "$C_RED" "$C_OFF" "$XCODE_PROJECT" >&2; note_problem; }
[ -f "$XCODE_PROJECT/xcshareddata/xcschemes/$SCHEME.xcscheme" ] \
  && ok "shared scheme '$SCHEME'" \
  || warn "no shared '$SCHEME' scheme — xcodebuild may not see it"
ok "bundle id: $(project_bundle_id)"
[ -d "$IOS_DIR/App/App/public" ] && ok "web bundle synced into the app" \
  || warn "no web bundle yet — the build scripts run 'npm run build && cap sync ios' for you"

echo
if [ "$problems" -eq 0 ]; then
  ok "ready — try: npm run ios:run"
else
  die "$problems blocking problem(s) above"
fi
