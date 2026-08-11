# `web/scripts` — local iOS build scripts

Command-line builds of the Capacitor iOS app (`../ios`), so you can compile,
run on a simulator and export an `.ipa` without driving Xcode by hand.

**Local only, on purpose.** iOS packaging needs a macOS host, an Xcode install
and (for anything on a real device) an Apple signing identity — none of which
exist on the repo's CI runners. Nothing here is wired into GitHub Actions: the
[Android APK workflow](../../.github/workflows/android-apk.yml) stays the only
CI packaging job, and the Pages deploy only ever builds the web bundle.

## Use

```bash
cd web
npm run ios:doctor    # is this machine ready? (Xcode, simulators, signing)
npm run ios:run       # build + install + launch on a simulator
npm run ios:build     # compile only
npm run ios:archive   # .xcarchive → signed .ipa
npm run ios:clean     # delete everything the scripts generated
```

Pass flags through npm with `--`, e.g. `npm run ios:run -- --device "iPhone 16 Pro"`.
Every script self-documents with `--help`.

| Script | What it does | Useful flags |
|---|---|---|
| `ios-doctor.sh` | Environment report; non-zero exit if a build would fail | — |
| `ios-build.sh` | `npm run build` → `cap sync ios` → `xcodebuild build` | `--release`, `--device`, `--skip-web`, `--clean`, `--team <id>` |
| `ios-run.sh` | Build, boot a simulator, install, launch | `--device <name\|udid>`, `--reinstall`, `--logs`, `--skip-web` |
| `ios-archive.sh` | `xcodebuild archive` + `exportArchive` | `--method development\|ad-hoc\|app-store-connect\|enterprise`, `--team <id>`, `--archive-only`, `--output <dir>` |
| `ios-clean.sh` | Remove DerivedData, archives, exports, synced bundle | `--all` (also `dist/` + SPM caches) |
| `ios-common.sh` | Shared helpers — sourced by the others, not run | — |

## Notes

- **Every build starts from the web bundle.** The scripts run `npm run build`
  and `npx cap sync ios` first, so what you launch is never a stale bundle;
  `--skip-web` opts out when you're only changing Swift.
- **`VITE_BASE` stays at its default (`/`).** The app serves the bundle from its
  own root — the `/click/` base is a GitHub Pages concern only.
- **Simulator builds are unsigned** (`CODE_SIGNING_ALLOWED=NO`), so
  `ios:build`/`ios:run` work on a machine that has never signed in to an Apple
  developer account. Device builds and archives need a team: pass `--team` or
  export `IOS_TEAM_ID`.
- **Walk Mode's background steps can't be tested on a simulator** — `CMPedometer`
  has no simulated data. Build to a device (`npm run ios:build -- --device`, then
  run from Xcode) to exercise banked steps.
- **Output lands in `../ios/build/`** (git-ignored): `DerivedData/`,
  `archives/`, `export/`, and the generated `ExportOptions-*.plist`. Override
  with `IOS_BUILD_DIR`.
- **`xcbeautify` or `xcpretty`**, if installed, are used to prettify xcodebuild
  logs; otherwise you get the raw output.

## Environment variables

| Variable | Effect |
|---|---|
| `IOS_TEAM_ID` | Default Apple team id for device builds and archives |
| `IOS_SIMULATOR` | Default simulator name/UDID for `ios:run` |
| `IOS_BUILD_DIR` | Where generated build output goes (default `../ios/build`) |
| `IOS_SCHEME` | Xcode scheme to build (default `App`) |

The shared `App` scheme lives in
`../ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme` — committed so
`xcodebuild -scheme App` resolves on a fresh clone, before Xcode has ever
opened the project.
