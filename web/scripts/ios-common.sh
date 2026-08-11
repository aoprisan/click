#!/usr/bin/env bash
# Shared helpers for the local iOS build scripts (web/scripts/ios-*.sh).
#
# Sourced, never executed. These scripts are deliberately LOCAL ONLY — iOS
# packaging needs a macOS host, an Xcode install and a signing identity, so
# nothing here is wired into GitHub Actions (the Android APK workflow stays the
# only CI packaging job).

# --- paths ------------------------------------------------------------------

IOS_COMMON_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd -- "$IOS_COMMON_DIR/.." && pwd)"
IOS_DIR="$WEB_DIR/ios"
XCODE_PROJECT="$IOS_DIR/App/App.xcodeproj"

# Everything the scripts generate lands under web/ios/build (git-ignored), so a
# clean is one `rm -rf` and nothing pollutes the committed native project.
BUILD_DIR="${IOS_BUILD_DIR:-$IOS_DIR/build}"
DERIVED_DATA="$BUILD_DIR/DerivedData"
ARCHIVE_DIR="$BUILD_DIR/archives"
EXPORT_DIR="$BUILD_DIR/export"

SCHEME="${IOS_SCHEME:-App}"

# --- output -----------------------------------------------------------------

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'; C_RED=$'\033[31m'
  C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_OFF=$'\033[0m'
else
  C_BOLD=''; C_DIM=''; C_RED=''; C_GREEN=''; C_YELLOW=''; C_OFF=''
fi

say()  { printf '%s==>%s %s\n' "$C_BOLD" "$C_OFF" "$*"; }
ok()   { printf '%s  ✓%s %s\n' "$C_GREEN" "$C_OFF" "$*"; }
warn() { printf '%s  !%s %s\n' "$C_YELLOW" "$C_OFF" "$*" >&2; }
die()  { printf '%s  ✗%s %s\n' "$C_RED" "$C_OFF" "$*" >&2; exit 1; }

# Echo a command, then run it.
run() {
  printf '%s   $ %s%s\n' "$C_DIM" "$*" "$C_OFF"
  "$@"
}

# Print a script's leading comment block (minus the shebang) as its --help text,
# so the usage lives in one place: the top of the file you're reading.
print_header_doc() {
  awk 'NR > 1 { if ($0 !~ /^#/) exit; sub(/^#[[:space:]]?/, ""); print }' "$1"
}

# --- preflight --------------------------------------------------------------

require_macos() {
  [ "$(uname -s)" = "Darwin" ] ||
    die "iOS builds need macOS (this is $(uname -s)). Use 'npm run build' for the web bundle."
}

require_xcode() {
  command -v xcodebuild >/dev/null 2>&1 ||
    die "xcodebuild not found — install Xcode from the App Store."
  # A bare Command Line Tools install has no iOS SDK; xcodebuild -version fails
  # with "requires Xcode" in that state, which is exactly what we want to catch.
  xcodebuild -version >/dev/null 2>&1 ||
    die "xcodebuild is pointed at the Command Line Tools. Fix with:
      sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
}

require_node() {
  command -v node >/dev/null 2>&1 || die "node not found — install Node 22+."
  command -v npm  >/dev/null 2>&1 || die "npm not found — install Node 22+."
}

# --- web bundle -------------------------------------------------------------

# Build the Vite bundle and copy it into the native project.
#
# VITE_BASE is intentionally left at its default (/): the app serves the bundle
# from its own root, unlike the GitHub Pages deploy which needs /click/.
build_web() {
  require_node
  if [ ! -d "$WEB_DIR/node_modules" ]; then
    say "Installing web dependencies"
    ( cd "$WEB_DIR" && run npm ci )
  fi
  say "Building web bundle"
  ( cd "$WEB_DIR" && run npm run build )
  say "Syncing into the Capacitor iOS project"
  ( cd "$WEB_DIR" && run npx cap sync ios )
}

# The sync above is what puts the bundle in App/App/public; without it Xcode
# builds an app that opens to a blank screen. Called by the build scripts when
# --skip-web was passed, so the failure is a clear message and not a white app.
require_synced_web() {
  [ -d "$IOS_DIR/App/App/public" ] ||
    die "No web bundle in ios/App/App/public — drop --skip-web (or run 'npm run app:sync')."
}

# --- project introspection --------------------------------------------------
#
# The awk one-liners below read their input to the end on purpose: an
# early-exiting `head`/`grep -q` would SIGPIPE the producer, and pipefail turns
# that into a failed command substitution under `set -e`. Same reason the
# simulator helpers further down never pipe into something that quits early.

# PRODUCT_BUNDLE_IDENTIFIER straight out of the pbxproj (all configurations use
# the same one). Used to launch/uninstall via simctl.
project_bundle_id() {
  awk '/PRODUCT_BUNDLE_IDENTIFIER/ {
         if (id == "") {
           id = $0
           sub(/.*PRODUCT_BUNDLE_IDENTIFIER[[:space:]]*=[[:space:]]*/, "", id)
           sub(/;.*/, "", id)
           gsub(/"/, "", id)
         }
       }
       END { print id }' "$XCODE_PROJECT/project.pbxproj"
}

# Path to the built .app for a configuration/sdk pair. With an explicit
# -derivedDataPath the location is deterministic; the find is a safety net for
# when Xcode changes the layout.
built_app_path() {
  local configuration="$1" sdk_suffix="$2" candidate
  candidate="$DERIVED_DATA/Build/Products/$configuration-$sdk_suffix/App.app"
  if [ -d "$candidate" ]; then
    printf '%s\n' "$candidate"
    return 0
  fi
  # `|| true`: nothing built yet is a normal answer (empty), not a failure —
  # callers under `set -e` want to print their own message.
  find "$DERIVED_DATA/Build/Products" -maxdepth 2 -name '*.app' -print -quit 2>/dev/null || true
}

# CFBundleIdentifier of a built .app, falling back to the project's.
app_bundle_id() {
  local app="$1" id=''
  if [ -f "$app/Info.plist" ]; then
    id="$(plutil -extract CFBundleIdentifier raw -o - "$app/Info.plist" 2>/dev/null || true)"
  fi
  [ -n "$id" ] && printf '%s\n' "$id" || project_bundle_id
}

# --- xcodebuild -------------------------------------------------------------

# Run xcodebuild, prettified by xcbeautify/xcpretty when either is installed.
# pipefail (set by every caller) keeps the xcodebuild exit status.
xcb() {
  printf '%s   $ xcodebuild %s%s\n' "$C_DIM" "$*" "$C_OFF"
  if command -v xcbeautify >/dev/null 2>&1; then
    xcodebuild "$@" | xcbeautify
  elif command -v xcpretty >/dev/null 2>&1; then
    xcodebuild "$@" | xcpretty
  else
    xcodebuild "$@"
  fi
}

# --- simulators -------------------------------------------------------------

# UDID of the first booted simulator, if any.
# One tab-separated "udid<TAB>state<TAB>name<TAB>runtime" line per simulator
# simctl lists. $1 is simctl's filter ("available", "booted", or empty for all).
#
# The greedy name group is what makes names that themselves contain parentheses
# ("iPad Pro 11-inch (M4)") parse correctly — the UDID is the last 36-char
# parenthesised group before the state. Runtime comes from the "-- iOS 18.2 --"
# section headers the devices are listed under.
sim_list() {
  local line runtime=''
  while IFS= read -r line; do
    if [[ $line =~ ^--[[:space:]]*(.+[^[:space:]])[[:space:]]*--[[:space:]]*$ ]]; then
      runtime="${BASH_REMATCH[1]}"
    elif [[ $line =~ ^[[:space:]]*(.+)\ \(([0-9A-Fa-f-]{36})\)\ \((.+)\)[[:space:]]*$ ]]; then
      printf '%s\t%s\t%s\t%s\n' \
        "${BASH_REMATCH[2]}" "${BASH_REMATCH[3]}" "${BASH_REMATCH[1]}" "$runtime"
    fi
  done < <(xcrun simctl list devices ${1:+"$1"} 2>/dev/null)
}

sim_booted_udid() {
  local udid
  udid="$(sim_list booted | awk -F'\t' 'NR == 1 { udid = $1 } END { print udid }')"
  [ -n "$udid" ] || return 1
  printf '%s\n' "$udid"
}

# UDID for an exact device name ("iPhone 16 Pro"), or for a UDID passed through.
sim_udid_for_name() {
  local want="$1" udid
  udid="$(sim_list available | awk -F'\t' -v want="$want" '
    $1 == want { by_udid = $1 }
    $3 == want && by_name == "" { by_name = $1 }
    END { print (by_udid != "" ? by_udid : by_name) }')"
  [ -n "$udid" ] || return 1
  printf '%s\n' "$udid"
}

# UDID of the best default iPhone simulator: newest iOS runtime, and within it
# the last device simctl lists (simctl orders device types oldest → newest).
sim_default_iphone_udid() {
  sim_list available | awk -F'\t' '
    $3 ~ /^iPhone/ {
      last = $1
      if ($4 ~ /^iOS /) {
        version = $4; sub(/^iOS +/, "", version)
        split(version, part, ".")
        score = part[1] * 10000 + part[2] * 100 + part[3]
        if (score >= best) { best = score; udid = $1 }
      }
    }
    END { print (udid ? udid : last) }'
}

sim_is_booted() {
  [ "$(sim_list booted | awk -F'\t' -v udid="$1" \
        '$1 == udid { found = 1 } END { print found + 0 }')" = "1" ]
}

sim_name_for_udid() {
  local name
  name="$(sim_list | awk -F'\t' -v udid="$1" \
    '$1 == udid && name == "" { name = $3 } END { print name }')"
  printf '%s\n' "${name:-$1}"
}
