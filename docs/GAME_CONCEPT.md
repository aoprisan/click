# Global Conflict — Game Concept

## One-line pitch

A competitive, real-time multiplayer **clicker set on a 3D globe**: pick a real
city, grow its population by clicking, earn missiles through achievements, and
strike rival cities across the world.

## Vision

Global Conflict turns the familiar incremental-clicker loop into a **shared,
persistent world**. Every player's clicks feed a living planet — populations
rise and fall in real time, missiles arc between continents, and a global
leaderboard reflects the collective tug-of-war between thousands of cities.
It blends the low-friction satisfaction of a clicker (Cookie Clicker) with the
adversarial, social pull of a browser strategy MMO (OGame, War Clicks).

## Core fantasy

You are the steward of a city. Through sheer effort (clicking) you make it grow
into the largest population on Earth — but so is everyone else. The endgame is
not just growth; it's **conflict**: spending the power you've accumulated to
knock rivals down and defend your own people.

---

## Core gameplay loop

1. **Click to grow.** Each click increases your city's population (and your
   personal contribution). Updates are optimistic on the client and confirmed by
   the server over WebSocket.
2. **Earn missiles.** Hitting achievement thresholds (and, for Warriors, click
   milestones) awards missiles to your arsenal.
3. **Strike rivals.** Fire missiles at enemy cities within range, killing
   population and climbing the kill leaderboard.
4. **Climb & defend.** Watch the global leaderboard, daily % change, and your
   own bests — and keep clicking to recover and retaliate.

Today the loop is **purely active** (manual clicking, server rate-limited).
A planned redesign adds energy, idle/passive growth, and upgrades — see
`docs/ROADMAP.md`.

---

## Player modes

The game supports three tiers of participation, each with different power:

| Mode | Auth | Click power | Missiles | Notes |
|---|---|---|---|---|
| **Spectator** | none (unauthenticated) | — (read-only) | — | Watches the live world over WebSocket; can explore the globe but not act. |
| **Builder** | cookie identity (`user_id`) | **1×** per click | Achievement missiles (Imp tier) | Default role for any registered player. |
| **Warrior** | subscription | **2×** per click | Achievement missiles (Titan tier) **+** click-milestone missiles (Imp → Titan → Atlas) | Premium combatant; the offensive powerhouse. |

Auth is intentionally frictionless: a UUID stored in a `user_id` cookie, no
passwords. Spectators can watch instantly; registering creates a Builder.

---

## Progression systems

### Achievements (computed, not stored)
Achievements are derived on the fly from user fields (`total_clicks`,
`best_10s`, `best_1day`, `last_cumulative_threshold`):

- **Cumulative** — "A Good Start" (200 clicks), "New Champion" (1,000), then
  "Local Hero" every 5,000 clicks (repeatable).
- **Fast Finger** — beat your best clicks-in-10-seconds.
- **Relentless** — beat your best clicks-in-a-day.

Each achievement awards a missile (replacing any prior unfired achievement
missile — one at a time).

### Click-milestone missiles (Warriors only)
A separate progression that **upgrades a single click-missile in place** as the
Warrior's lifetime clicks pass thresholds:

`300 → 2k → 4k` (Imp I/II/III) → `6k → 8k → 10k` (Titan I/II/III) →
`13k → 16k → 20k` (Atlas I/II/III).

---

## Combat system

- **9 missile types** across 3 families × 3 tiers:

  | Family | Damage range | Role context |
  |---|---|---|
  | **Imp** I/II/III | 300–700 | Builder achievement / low Warrior |
  | **Titan** I/II/III | 3,000–7,000 | Warrior |
  | **Atlas** I/II/III | 30,000–70,000 | Top-tier Warrior |

  Tier (I/II/III) sets **range**: 500 km / 1,500 km / 5,000 km.

- **Firing** validates range using **Haversine distance** between the firing and
  target cities. Damage is rolled within the missile's band and subtracted from
  the target's population; kills accrue to the attacker.
- **Today the game is attack-only** — no defenses yet (planned: shields /
  interceptors, see roadmap).
- Real-time broadcasts keep everyone in sync: `missile_strike`,
  `missile_incoming`, `city_update`, etc.

---

## The world & data

- **Cities** are seeded from real **GeoNames** data (real coordinates, names,
  countries) and rendered as markers on a Three.js globe.
- Each city tracks: current population (`total_clicks`), highest-ever
  population, total dead, contributor count, and missile stockpile.
- **Daily snapshots** capture city populations so the UI can show a 24-hour
  **% change**.

---

## Monetization

- **Subscription** upgrades a Builder to **Warrior** (weekly or monthly plans),
  unlocking the 2× multiplier and click-missile progression.
- Early renewal (within 48h of expiry) grants a **+20% duration bonus**.
- On expiry, the player is automatically downgraded to Builder and their
  click-missile is removed.

(Future monetization options — cosmetic tiers, energy refills, battle pass —
are explored in `docs/ROADMAP.md`.)

---

## What makes it distinctive

- **Real geography as the board** — distance genuinely matters (missile range vs.
  Haversine distance), so alliances and targets are shaped by the real map.
- **Shared persistent world** — unlike single-player clickers, your growth is
  always relative to live opponents.
- **Three-tier access** — spectators lower the barrier to "try it"; the
  Builder→Warrior subscription is the natural conversion funnel.
- **Computed achievements** — progression is cheap to evolve (no achievement
  tables to migrate; it's all derived from a few user counters).

---

## Technical foundation (for context)

- **Backend:** Go 1.24, Chi router, SQLite (WAL), WebSocket hub; versioned,
  transactional migrations; background workers for snapshots and subscription
  expiry.
- **Frontend:** React 19 + TypeScript, Vite, Three.js globe (react-globe.gl);
  optimistic updates reconciled over a single WebSocket that serves spectators
  and players alike.
- **Real-time core:** click → optimistic update → WebSocket → server rate-limit →
  SQLite transaction → broadcast → achievement/missile checks.

See `CLAUDE.md` for the full architecture and `docs/ROADMAP.md` for where the
concept is headed (energy/idle "work" model, defenses, alliances & seasons, and
a reskinnable fantasy spinoff).
