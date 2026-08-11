# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Global Conflict — a competitive game built around a 3D globe and clicking. The repo holds **two versions that coexist on `main`**:

- **v1** — the original real-time multiplayer game: a Go backend + React client where players grow a city's population, earn missiles, and attack rivals. Lives at the repo root + `client/`.
- **v2** — the current prototype: a **client-only city-building PWA** (no backend) where clicks *build* instead of destroy. Lives entirely under `web/` and is what's deployed to GitHub Pages at https://aoprisan.github.io/click/.

The two are independent — v2 was a design pivot and does not share code with v1. When working in `web/`, treat v1 (`client/`, `*.go`) as untouched, and vice versa.

| | **v1** (root + `client/`) | **v2** (`web/`) |
|---|---|---|
| Kind | Real-time multiplayer | Client-only PWA, single player + bots |
| Stack | Go + React + WebSocket + SQLite | React + Vite, all logic in-browser |
| State | SQLite on the server | `localStorage` (key `gc.save.v1`) |
| Dev URL | `:5173` (client) → `:8080` (server) | `:5174` |
| Deployed | not deployed here | GitHub Pages (`aoprisan.github.io/click/`) |

---

# v1 — Global Conflict (Go backend + React, multiplayer)

A competitive multiplayer game with a 3D globe. Players pick a city, grow its population through clicking, earn missiles via achievements, and attack rival cities. Features three player modes (Spectator/Builder/Warrior), a missile combat system, achievement tracking, and a subscription model.

## Stack

- **Backend**: Go 1.24 with Chi router, SQLite (modernc.org/sqlite), WebSocket (coder/websocket)
- **Frontend**: React 19 + TypeScript, Vite, Three.js globe (react-globe.gl)
- **Auth**: Cookie-based (UUID in `user_id` cookie, no passwords)

## Commands

```bash
make seed           # Download GeoNames data + populate SQLite (required first run)
make dev-server     # Go backend on :8080 (Air hot-reload, -tags dev)
make dev-client     # Vite dev server on :5173 (proxies /api and /ws to :8080)
make build          # Production build: client dist + Go binary "clickcity"
make test           # Run all tests: go test ./... + cd client && npx vitest run
make clean          # Remove build artifacts
```

Run both `make dev-server` and `make dev-client` for local development.

**Production scripts** (use binary name `globalconflict`):
- `./scripts/build.sh` — npm ci + build client + `go build -o globalconflict`
- `./scripts/start.sh` — runs the binary (env: `ADDR=:8080`, `DB_PATH=globalconflict.db`)

**Prerequisites**: `make dev-server` requires [Air](https://github.com/air-verse/air) for hot-reload (`go install github.com/air-verse/air@latest`). Run `cd client && npm install` before first `make dev-client`.

**Running individual tests**:
- Single Go test: `go test -run TestName ./...`
- Single frontend test: `cd client && npx vitest run src/components/Globe.test.tsx`

## Architecture

**Data flow**: User click → optimistic client update → WebSocket `{"type":"click"}` → server rate-limits (100/60s token bucket) → SQLite transaction (increment user + city with multiplier) → broadcast `city_update` → check achievements → award missiles.

**Player Modes**: Spectators (unauthenticated, read-only WebSocket), Builders (1x click, achievement missiles), Warriors (2x click, click missiles + achievement missiles, requires subscription).

**Backend** (`*.go` in root):
- `main.go` - Chi routes + middleware + background workers
- `handlers.go` - REST endpoints
- `ws.go` - Hub-based WebSocket with spectator support + achievement/missile checks after clicks
- `db.go` - SQLite queries with WAL mode
- `models.go` - Shared structs (City, User, Missile, Subscription, WS message types)
- `migrations.go` - Schema migration system (versioned, transactional)
- `achievements.go` - Cumulative achievement checks, missile awarding
- `missile_types.go` - Static missile type definitions (9 types: Imp/Titan/Atlas I/II/III)
- `click_missiles.go` - Warrior click-threshold missile progression
- `subscription.go` - Builder→Warrior upgrade, expiry checking
- `snapshots.go` - Daily city population snapshots for % change
- `geo.go` - Haversine distance calculation
- `fire_missile.go` - Missile fire handler with range/damage validation
- `ratelimit.go` - Per-user token bucket limiting
- `seed.go` - GeoNames data parser

**Frontend** (`client/src/`):
- `App.tsx` - Top-level state, game mode derivation, WebSocket lifecycle
- `hooks/useWebSocket.ts` - Connects for all visitors (spectators included)
- `hooks/useClickHandler.ts` - Optimistic updates with multiplier support
- `components/Globe.tsx` - Three.js globe with city markers
- `components/ClickButton.tsx` - Mode-aware (LOGIN/GROW +1/GROW +2)
- `components/GlobalDataPanel.tsx` - World population, daily change %, missile count
- `components/InfoPanel.tsx` - City details (population, highest ever, dead, stockpile)
- `components/PlayerPanel.tsx` - Player stats (kills, bests, role)
- `components/MissilePanel.tsx` - Arsenal display with fire button
- `components/SubscriptionPanel.tsx` - Builder→Warrior upgrade flow
- `components/ToastSystem.tsx` - Achievement/missile/strike notifications

**REST API**: `GET /api/cities`, `GET /api/cities/:id`, `GET /api/leaderboard?limit=N`, `GET /api/stats`, `POST /api/register`, `GET /api/me`, `GET /api/me/missiles`, `POST /api/missiles/:id/fire`, `POST /api/subscribe`, `GET /api/me/subscription`, `POST /api/subscribe/renew`

**WebSocket**: `GET /ws` (accepts both authenticated and unauthenticated connections). Client sends `click`. Server broadcasts: `city_update`, `city_click`, `missile_strike`, `missile_incoming`, `achievement_earned`, `missile_awarded`, `missile_upgraded`.

## Build Modes

- **Dev**: `static_dev.go` (build tag `dev`) serves from filesystem. Vite proxies API/WS calls.
- **Prod**: `static.go` embeds `client/dist/` into the Go binary via `//go:embed`.

## Database

Schema uses migrations (`migrations.go`). Key tables: `cities`, `users`, `missiles`, `subscriptions`, `city_snapshots`, `schema_version`.

Achievements are NOT stored — they are computed from user fields (`total_clicks`, `best_10s`, `best_1day`, `last_cumulative_threshold`).

---

# v2 — Global Conflict v2 (client-only city-building PWA)

The current prototype, living entirely under `web/` (package `global-conflict-v2`). A standalone pilot of the [v2 city design](docs/CITY_DESIGN_OVERVIEW.md): clicks **build** instead of destroy. There is **no backend** — the whole world (your city plus ~190 bot-controlled rivals) runs in the browser via a single `MockGameClient`, persisted to `localStorage` (key `gc.save.v1`). This is what's deployed to GitHub Pages.

See `web/README.md` for the fullest description and `web/WHATS_NEXT.md` for the roadmap.

## Stack

- **Frontend**: React 19 + TypeScript, Vite, Three.js globe, `vite-plugin-pwa` (offline service worker)
- **No backend / no auth** — all state is in-browser; identity is implicit (single local player)
- **Tests**: Vitest (jsdom) over the pure game-logic modules

## Commands (run from `web/`)

```bash
cd web
npm install         # first time only
npm run dev         # Vite dev server on :5174 (or next free port)
npm test            # vitest — pure game-logic suites
npm run balance     # headless balance harness — band report + sane-band asserts
npm run build       # tsc -b + vite build (emits PWA service worker)
npm run preview     # serve the production build locally

# native app (macOS + Xcode; local only, never in CI — see web/scripts/README.md)
npm run ios:doctor  # environment check: Xcode, simulators, signing
npm run ios:run     # build + sync + compile + boot a simulator + launch
npm run ios:archive # .xcarchive → signed .ipa (-- --method ad-hoc --team ID)
```

There is no catalog-generation step: `docs/*.csv` are bundled as text and parsed
in the browser at boot, so game data can also be swapped at runtime (see **Live
game data** below).

No `make seed`, no Go backend, no second terminal — just `npm run dev`.

**Running a single test**: `cd web && npx vitest run src/game/economy.test.ts`

## Architecture

Three layers, designed so the in-browser mock can later be swapped for a server without touching the UI:

- **`src/client/`** — the seam. `GameClient.ts` is the interface; `MockGameClient.ts` holds all state, a `setInterval` tick loop, bot simulation, and `localStorage` persistence. A future `LiveGameClient` (fetch + WebSocket against a Go backend) drops in here.
- **`src/game/`** — pure, unit-tested logic (no React, no I/O): `config` (the live config store — active CSVs, apply/revert, persistence, change subscribers), `csv` + `catalogBuild` (CSV text → buildings/country resources/priced resources), `tuning` (the recipe-amounts and numeric-knob CSVs, and the built-in `DEFAULT_KNOBS`), `catalog` (merged building metas + economy curves, rebuilt on every config change — never cache its arrays across one), `recipes` (built-in per-building input/output **amounts** overlaid on the 1-in/1-out CSV recipes), `economy` (instant build/upgrade + input-gated production), `population`, `happiness`, `civic` (per-capita needs), `market` (global + city-to-city offers + gifting), `bots`, `throttle` (click-rate cap), `shop` (Bucks monetization), `seedCities`, and `balanceHarness` (headless deterministic world sim).
- **`src/components/`** — React UI in the v1 "tactical console" aesthetic: `Globe`, `ConfigPanel` (upload/download the game-data CSVs, reset the world), `BuildPanel`, `CityPanel`, `MarketPanel`, `TradePanel`, `ShopPanel`, `Leaderboard`, `ClickButton` (the GROW dial + throttle meter), `Tutorial`/`Onboarding`, `ToastSystem`, `PwaPrompts`, `ErrorBoundary`.
- **`src/hooks/`** — `useGameClient` (wires the client into React state), `usePwaUpdate` (service-worker update prompt), `useWalkMode` (Walk Mode: steps → clicks; an alternative input alongside the GROW button, throttled identically; claims + drip-feeds steps banked while the app was away).
- **`src/steps/`** — the step-source seam for Walk Mode: `DeviceMotionStepSource` (web: accelerometer → `game/pedometer` detection, foreground only) vs `NativePedometerStepSource` (Capacitor app: OS step counter, keeps counting in background). `selectStepSource()` picks by platform.
- **Capacitor wrapper** (`web/capacitor.config.ts`, `web/android/`, `web/ios/`) — the same build bundled as a native app so steps bank while the app is closed, via the app-local `Pedometer` plugin (Java + Swift). `npm run app:sync` rebuilds + syncs; open with `app:android`/`app:ios`. The web PWA deploy is unaffected.
- **`web/scripts/`** — local iOS build scripts (`ios:doctor`/`ios:build`/`ios:run`/`ios:archive`/`ios:clean`) that drive `xcodebuild`/`simctl` from the terminal instead of Xcode, plus the committed shared `App` scheme they need. **Local only** — iOS needs macOS + Xcode + signing, so it is deliberately not in GitHub Actions; CI packaging stays web-bundle (Pages) and Android APK. See `web/scripts/README.md`.

## The core loop

The game is **click-driven** (one click = one tick; only bots run on a background timer — see [`docs/CORE_LOOP.md`](docs/CORE_LOOP.md)). A click → activity units (`clickEffectiveness(happiness)` × any drink multiplier) → fed to the **active building**'s **production** (batches consume inputs **from the city's own stock** and yield outputs — a missing input **stalls** production, no auto-buy, until you produce/buy/trade for it) → and eats **1 food**. **Building and upgrading are instant cash purchases** (no click-build): buying/upgrading a **workplace** immediately raises **population** (= Σ building worker amounts; monotonic — never decreases); residential blocks add **housing**. Happiness = **50% housing** (are workers housed?) + **50% food** (food units vs population?) and scales click effectiveness, so a starving or homeless city builds slowly. Sell surplus to the game-run global market or list it for other cities; bots do the same. Tech tiers unlock by population (`tierUnlockPopulation()`: 1k/5k/20k/50k). The deeper happiness sections (energy/employment/fun/luxuries) are parked behind `DEEP_HAPPINESS` in `happiness.ts` until the tech tree is balanced.

## Live game data (no rebuild, no backend)

The four config files — the tech tree CSV, a recipe-amounts CSV, a tuning CSV (`key,value`) and the country-resources CSV — are read at runtime by `game/config.ts`. The **⚙ Config** panel downloads what the game is running on, takes an upload or a paste, applies it immediately, and remembers it in `localStorage` (`gc.config.v1`) until reverted; `docs/*.csv` and the built-in defaults in `recipes.ts`/`tuning.ts` are what ships.

Applying any file **restarts the world** (`GameClient.resetGame()` → wipes `gc.save.v1`, reseeds every city, emits `world_reset`) because building ids, prices and worker counts all move. "Reset game data" is the same path with the config untouched. A tech tree with nothing readable is rejected and the running config is kept; softer problems (unreadable cells, ingredients nothing produces, unknown tuning keys, recipe rows for missing buildings) surface as warnings in the panel.

## Monetization (design §8)

A hard-currency ("Bucks") shop in `game/shop.ts` + `components/ShopPanel.tsx`: energy-drink click multipliers (a 2×/5×/10× × duration matrix), autoclicker "employees" (auto-click at the *same* capped rate as a human — comfort, not advantage), and air tickets (move home city; the old one reverts to a bot). No real payments — the operator just starts with `STARTING_BUCKS`. Player-to-player gifting is real and free (`game/market.ts` → `giftResource`).

## Tuning knobs

Most numbers now live in the tuning CSV (`game/tuning.ts` → `DEFAULT_KNOBS`, editable live in the Config panel): workers per tier, `buildCost`/`upgradeCost`/`workPerBatch` curves, tier-unlock populations, resource price base/growth + market spread, residential cost/capacity, food per click and per-good food values, and the click cap. Still code-side: `game/recipes.ts` (built-in per-building amounts — the supply-chain weights that gate production), `game/happiness.ts` (`DEEP_HAPPINESS` flag), `game/civic.ts` (energy/fun/luxury good lists, country aliases), `game/catalogBuild.ts` (resource name `ALIASES`), `game/shop.ts` (Bucks prices, durations, `STARTING_BUCKS`). Watch `npm run balance` for sane bands after changes.

## Deployment

`.github/workflows/deploy-pages.yml` builds `web/` and publishes to GitHub Pages on every push to `main` that touches `web/**` (or via manual `workflow_dispatch`). The Pages build sets `VITE_BASE=/click/` so the app serves correctly from the repo subpath; locally `base` defaults to `/`. The v1 client/backend are not part of this deploy.
