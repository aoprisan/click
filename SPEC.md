# ClickCity — Game Specification for Claude Code

## What This Is

A multiplayer idle clicker browser game. The entire UI is an interactive 3D spinning globe. Players pick a location (their hometown or city), tap a single button, and their clicks aggregate with everyone else at that location. Cities visibly grow on the globe as blocks/buildings. The core motivation is local pride and rivalry — Tampere vs Helsinki, Finland vs Sweden, Sibiu vs Bucharest.

Think of it as a navigable data visualization that you can also play. The globe IS the game — not a feature added later. It should feel like a toy: something to spin, explore, and poke at.

## Tech Stack

- **Frontend**: Single-page React app (Vite + TypeScript)
- **3D Globe**: Three.js (consider `three-globe` library or build from scratch — whichever gives better visual results)
- **Backend**: Go with Chi router, WebSocket (coder/websocket) for real-time click propagation
- **Database**: SQLite (via modernc.org/sqlite, pure Go) — simple, no setup
- **No auth for now**: Players pick a display name and location on first visit. Store identity in localStorage + cookie.

## The Globe (Central UI Element)

The globe fills the entire viewport. Everything else overlays it.

### Rendering
- Spherical Earth with visible country borders or land outlines (use a GeoJSON dataset — Natural Earth low-res is ideal)
- Dark aesthetic: dark ocean, subtly lit landmasses, glowing city markers
- Smooth interaction: auto-rotates slowly when idle, user can drag to spin, scroll/pinch to zoom
- Cities appear as glowing vertical bar markers on the globe surface, height scaled by total click count
- As a city accumulates more clicks, its marker grows taller and brighter — prominent cities should be visible from zoomed out
- Clicking on a city marker opens its stats (name, total clicks, rank, contributor count)

### City Markers / Building Visualization

Each city's visual representation follows a block-stacking rule:

- Blocks are rectangular units that stack in a pyramid pattern: fill the base row first, then stack upward when there's room (a block can only sit on top if it has two supporting blocks beneath it)
- Block tiers correspond to click thresholds and are color-coded by shade:
  - Tier 1 (darkest): 10k clicks per block
  - Tier 2 (medium-dark): 25k clicks per block
  - Tier 3 (light): 50k clicks per block
  - Tier 4 (lightest): 100k clicks per block
- Progressive stages (see reference below):
  - Stage 1: single small dark block
  - Stage 2: two blocks side by side
  - Stage 3–6: base fills, second tier begins, lighter blocks appear
  - Stage 7–10: multi-tiered pyramid skyline with mixed block types
- On the globe: simplified as glowing columns/bars scaled by total clicks
- In the city info panel: show the detailed block pyramid visualization (2D)

## Game Flow

### 1. Onboarding (First Visit)
- Player lands on the spinning globe
- Minimal overlay: "Pick your city" with a searchable dropdown of available cities
- Player selects city (e.g. "Sibiu, Romania"), enters a display name
- Overlay fades, globe rotates/zooms to their chosen city
- Click button appears

### 2. Core Loop
- Globe always visible and interactive
- Player's home city is highlighted distinctly (different marker color or ring)
- Prominent CLICK button always accessible (bottom-right, large circular button)
- Each click:
  - Increments personal count (optimistic, immediate UI feedback)
  - Sends to server via WebSocket
  - Server increments city total and broadcasts update to all clients
  - Satisfying micro-animation: ripple on button, particle burst, marker bump on globe
  - City marker on globe grows in real-time
- Other players' clicks update markers live via WebSocket

### 3. Exploring
- Drag/spin globe to browse other cities
- Click any city marker to view its stats
- Home city stats always visible in persistent side panel
- Leaderboard shows top cities globally

## UI Layout (all overlaid on the full-viewport globe)

- **Top-left**: Logo — "CLICKCITY" in monospace font
- **Top-right**: Leaderboard — top 5–10 cities, collapsible
- **Bottom-left**: City info panel — selected/home city name, country, total clicks, your contribution, rank, block pyramid visualization
- **Bottom-right**: Click button (large, circular, satisfying) + personal click counter
- **Top-center** (subtle): Global total click counter across all cities

## Anti-Bot / Rate Limiting

- Server-side: max 100 clicks per user per 60-second rolling window
- Excess clicks silently discarded (no error, just stop counting)
- Client-side: optional subtle cooldown indicator if clicking too fast

## Data Model

### SQLite Tables

```sql
CREATE TABLE cities (
  id TEXT PRIMARY KEY,          -- slug like "sibiu-ro"
  name TEXT NOT NULL,           -- "Sibiu"
  country TEXT NOT NULL,        -- "Romania"
  country_code TEXT NOT NULL,   -- "RO"
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  total_clicks INTEGER DEFAULT 0,
  contributor_count INTEGER DEFAULT 0
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,          -- uuid
  name TEXT NOT NULL,
  city_id TEXT NOT NULL REFERENCES cities(id),
  total_clicks INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_click_at DATETIME
);
```

### Seed Data
- Pre-populate cities with world cities over 100k population. Use a public dataset (GeoNames cities15000.txt or SimpleMaps worldcities.csv — both freely available).
- At minimum include all capital cities + cities > 100k population.
- Each city needs: name, country, country_code, latitude, longitude.

## API

### REST Endpoints
- `GET /api/cities` — all cities with click totals (for initial globe render)
- `GET /api/cities/:id` — single city detail with top contributors
- `GET /api/leaderboard` — top N cities by total clicks
- `POST /api/register` — body: `{ name, cityId }` → returns `{ userId }`, sets cookie

### WebSocket Events (native WebSocket via coder/websocket)
- **Client → Server**: `click` — user tapped the button
- **Server → All**: `city_update { cityId, totalClicks, contributorCount }` — broadcast after each click
- **Server → City Room** (nice-to-have): `city_click { cityId, userName }` — for showing other players clicking in real-time

## Visual / Aesthetic Direction

- **Dark and atmospheric**: satellite-imagery-at-night meets data visualization
- **Globe should feel alive**: subtle glow on landmasses, city markers pulse gently, ocean has slight animated gradient or texture
- **Accent color**: warm gold/amber (#f7c948) for interactive elements, city markers, click button
- **Typography**: monospace for numbers/data (Space Mono), clean sans-serif for labels (Outfit)
- **Click button must feel GOOD**: scale animation on press, ripple effect, particle burst, optimistic instant feedback
- **City markers glow/pulse when receiving clicks from other players in real-time**
- **Overall mood**: like looking at a living map of human activity

## Suggested File Structure

```
clickcity/
├── Makefile
├── go.mod / go.sum
├── main.go                   # Chi router, middleware, graceful shutdown
├── handlers.go               # REST endpoint handlers
├── ws.go                     # WebSocket hub + client management
├── db.go                     # SQLite setup + queries (WAL mode)
├── seed.go                   # Download GeoNames data + populate SQLite
├── ratelimit.go              # Per-user token bucket rate limiter
├── models.go                 # Shared Go struct definitions
├── static.go                 # Production: embeds client/dist/ via go:embed
├── static_dev.go             # Dev: serves from filesystem (build tag "dev")
├── client/
│   ├── index.html
│   ├── vite.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api.ts               # REST API client functions
│   │   ├── types.ts
│   │   ├── components/
│   │   │   ├── Globe.tsx         # Three.js globe (react-globe.gl)
│   │   │   ├── ClickButton.tsx   # The big satisfying button
│   │   │   ├── InfoPanel.tsx     # City stats + block viz
│   │   │   ├── Leaderboard.tsx   # Top cities list
│   │   │   ├── Onboarding.tsx    # City picker overlay
│   │   │   ├── BuildingViz.tsx   # Pyramid block visualization (SVG)
│   │   │   ├── GlobalCounter.tsx # Global click counter
│   │   │   ├── ConnectionStatus.tsx # WebSocket status indicator
│   │   │   └── ErrorBoundary.tsx # React error boundary
│   │   └── hooks/
│   │       ├── useWebSocket.ts   # ReconnectingWebSocket hook
│   │       └── useClickHandler.ts # Click + optimistic update + rate tracking
│   └── public/
└── data/                         # Downloaded during seed step
```

## Build Priority (do these in order)

1. **Server + DB + seed**: Get cities into SQLite, REST endpoints returning data
2. **Globe rendering**: Three.js globe with land outlines, draggable, zoomable, auto-rotate
3. **City markers**: Plot all seeded cities as dots/bars on globe, scaled by click count
4. **Onboarding**: Searchable city picker overlay, store selection in cookie
5. **Click + WebSocket**: Core mechanic — click, send to server, broadcast, see marker grow
6. **Info panel + leaderboard**: City stats panel, top cities list
7. **Building block viz**: Pyramid skyline in info panel (2D)
8. **Polish**: Animations, particles, glow effects, mobile responsiveness

## Reference: Block Pyramid Stages

How the skyline grows with accumulated clicks (from the reference image):

```
Stage 1:   ▪                          (~10k clicks)
Stage 2:   ▪ ▪                        (~20-30k)
Stage 3:   ▪▪▪ (one stacked)          (~40-50k)
Stage 4:   ▪▪ ▪▪ (wider base + stack) (~60-80k)
...
Stage 10:  Full multi-tier pyramid     (~500k+ clicks)
           with mixed block shades
           representing different
           click thresholds
```

The darkest blocks = cheapest (10k), lightest blocks = most expensive (100k). The pyramid grows organically — base first, then upward — giving each city a unique skyline profile.

## Important Notes

- This is a prototype. Don't over-engineer auth, scaling, or deployment.
- SQLite is intentionally chosen. No Redis, Postgres, Docker, etc.
- The globe is the hero — invest time making it look and feel great.
- Clicks should feel instant: optimistic UI update before server confirmation.
- Keep it lean: `make seed && make dev-server & make dev-client` should be all that's needed.
- For the city dataset, download during the seed step rather than checking in large files.
