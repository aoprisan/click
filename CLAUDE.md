# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Global Conflict — a competitive multiplayer game with a 3D globe. Players pick a city, grow its population through clicking, earn missiles via achievements, and attack rival cities. Features three player modes (Spectator/Builder/Warrior), a missile combat system, achievement tracking, and a subscription model.

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
