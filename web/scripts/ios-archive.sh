#!/usr/bin/env bash
#
# ios-archive.sh — archive the app and export a signed .ipa, locally.
#
# Local only: this needs a macOS host, Xcode and an Apple developer identity in
# the keychain, so it is deliberately not wired into GitHub Actions.
#
#   npm run ios:archive                          # development .ipa (your devices)
#   npm run ios:archive -- --method ad-hoc       # ad-hoc distribution
#   npm run ios:archive -- --method app-store-connect --team ABCDE12345
#
# Options:
#   --method <m>       development (default) | ad-hoc | app-store-connect | enterprise
#   --team <id>        Apple team id; defaults to $IOS_TEAM_ID
#   --configuration <c>  build configuration (default: Release)
#   --output <dir>     where the .ipa lands (default: web/ios/build/export)
#   --skip-web         don't rebuild/sync the Vite bundle
#   --archive-only     stop after the .xcarchive, don't export
#   -h, --help         this text
set -euo pipefail

# shellcheck source=./ios-common.sh
. "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/ios-common.sh"

method=development
team="${IOS_TEAM_ID:-}"
configuration=Release
output="$EXPORT_DIR"
skip_web=0
archive_only=0

usage() { print_header_doc "${BASH_SOURCE[0]}"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --method)        shift; method="${1:-}"; [ -n "$method" ] || die "--method needs a value" ;;
    --team)          shift; team="${1:-}"; [ -n "$team" ] || die "--team needs a team id" ;;
    --configuration) shift; configuration="${1:-}"; [ -n "$configuration" ] || die "--configuration needs a value" ;;
    --output)        shift; output="${1:-}"; [ -n "$output" ] || die "--output needs a directory" ;;
    --skip-web)      skip_web=1 ;;
    --archive-only)  archive_only=1 ;;
    -h|--help)       usage; exit 0 ;;
    *)               die "unknown option: $1 (try --help)" ;;
  esac
  shift
done

case "$method" in
  development|ad-hoc|app-store-connect|enterprise) ;;
  *) die "unknown --method '$method' (development | ad-hoc | app-store-connect | enterprise)" ;;
esac

require_macos
require_xcode

if [ "$archive_only" -eq 0 ] && [ -z "$team" ]; then
  die "no Apple team id — pass --team <id> or export IOS_TEAM_ID.
      Xcode ▸ Settings ▸ Accounts ▸ your account shows it next to the team name."
fi

if [ "$skip_web" -eq 1 ]; then
  require_synced_web
  say "Reusing the web bundle already in ios/App/App/public"
else
  build_web
fi

mkdir -p "$ARCHIVE_DIR"
archive="$ARCHIVE_DIR/$SCHEME-$configuration.xcarchive"
rm -rf "$archive"

say "Archiving $SCHEME ($configuration)"
archive_args=(
  -project "$XCODE_PROJECT"
  -scheme "$SCHEME"
  -configuration "$configuration"
  -destination 'generic/platform=iOS'
  -archivePath "$archive"
  -derivedDataPath "$DERIVED_DATA"
  -allowProvisioningUpdates
)
[ -n "$team" ] && archive_args+=("DEVELOPMENT_TEAM=$team")
xcb "${archive_args[@]}" archive

[ -d "$archive" ] || die "archive step produced no .xcarchive"
ok "archived $archive"

if [ "$archive_only" -eq 1 ]; then
  ok "stopping before export (--archive-only). Open it with: open '$archive'"
  exit 0
fi

# Automatic signing: Xcode picks/creates the profile matching the team + method.
plist="$BUILD_DIR/ExportOptions-$method.plist"
mkdir -p "$BUILD_DIR" "$output"
cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>$method</string>
  <key>teamID</key>
  <string>$team</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>destination</key>
  <string>export</string>
  <key>stripSwiftSymbols</key>
  <true/>
  <key>compileBitcode</key>
  <false/>
</dict>
</plist>
PLIST
ok "export options: $plist"

say "Exporting .ipa ($method)"
xcb -exportArchive \
  -archivePath "$archive" \
  -exportPath "$output" \
  -exportOptionsPlist "$plist" \
  -allowProvisioningUpdates

ipa="$(find "$output" -maxdepth 1 -name '*.ipa' -print -quit 2>/dev/null)"
if [ -n "$ipa" ]; then
  ok "$ipa"
  ok "install on a tethered device with: xcrun devicectl device install app --device <udid> '$ipa'"
else
  warn "export finished but no .ipa found in $output"
fi
