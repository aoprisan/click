# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ClickCity — a multiplayer idle clicker game with a 3D globe. Players pick a city, click to accumulate points, and watch their city's marker grow on the globe in real-time via WebSocket broadcasts.

## Stack

- **Backend**: Go 1.25 with Chi router, SQLite (modernc.org/sqlite), WebSocket (coder/websocket)
- **Frontend**: React 19 + TypeScript, Vite, Three.js globe (react-globe.gl)
- **Auth**: Cookie-based (UUID in `user_id` cookie, no passwords)

## Commands

```bash
make seed           # Download GeoNames data + populate SQLite (required first run)
make dev-server     # Go backend on :8080 (with -tags dev for filesystem serving)
make dev-client     # Vite dev server on :5173 (proxies /api and /ws to :8080)
make build          # Production build: client dist + Go binary "clickcity"
make clean          # Remove build artifacts
```

Run both `make dev-server` and `make dev-client` for local development.

## Architecture

**Data flow**: User click → optimistic client update → WebSocket `{"type":"click"}` → server rate-limits (100/60s token bucket) → SQLite transaction (increment user + city) → broadcast `city_update` to all clients.

**Backend** (`*.go` in root): `main.go` sets up Chi routes + middleware. `handlers.go` has REST endpoints. `ws.go` implements a hub-based broadcast pattern (Hub manages Client connections). `db.go` handles all SQLite queries with WAL mode. `ratelimit.go` does per-user token bucket limiting. `seed.go` parses GeoNames data.

**Frontend** (`client/src/`): `App.tsx` owns top-level state and WebSocket lifecycle. `hooks/useWebSocket.ts` wraps ReconnectingWebSocket. `hooks/useClickHandler.ts` handles optimistic updates + client-side rate tracking. `components/Globe.tsx` renders the Three.js globe with city markers scaled by log of click count.

**REST API**: `GET /api/cities`, `GET /api/cities/:id`, `GET /api/leaderboard?limit=N`, `POST /api/register`, `GET /api/me`

**WebSocket**: `GET /ws` (requires auth cookie). Client sends `click`, server broadcasts `city_update`.

## Build Modes

- **Dev**: `static_dev.go` (build tag `dev`) serves from filesystem. Vite proxies API/WS calls.
- **Prod**: `static.go` embeds `client/dist/` into the Go binary via `//go:embed`.
