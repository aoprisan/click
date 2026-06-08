# Global Conflict — Research & Roadmap: Features, Clicker Design & Spinoffs

> Research report + phased implementation plan for advancing the game. Covers how
> the clicker works today, how "work"/cooldown should be redesigned, a feature
> roadmap, spinoff (incl. fantasy) opportunities, comparable games on the market,
> and a file-level implementation plan across four phases.

## Context

How to grow *Global Conflict* — a real-world-map, competitive multiplayer clicker
where you grow a city's population by clicking and lob missiles at rivals.
Questions addressed: (1) how should the clicker "simulate work" and is there a
cooldown, (2) what feature directions advance the game, (3) what spinoffs are
viable (esp. fantasy), and (4) what comparable games already exist.

---

## 1. How the clicker works today (from the code)

- **One click = `{type:"click"}` over WebSocket.** Server multiplies by role
  (Builder = 1x, Warrior = 2x), then a single SQLite transaction increments
  `users.total_clicks` and `cities.total_clicks` and updates
  `highest_ever_population`. (`ws.go:200-240`, `db.go:178-209`)
- **There is NO per-click cooldown.** Pacing is a **token-bucket rate limit**:
  `rate.Limit(100/60)` ≈ 1.67 clicks/sec sustained, **burst 10**
  (`ratelimit.go:26,39`). Over-limit clicks are **silently dropped** server-side
  (`ws.go:204-205`). The client mirrors the 100/60s window only to show a
  "Slow down!" message — UI-only, not enforcement (`useClickHandler.ts:4-35`).
- **No energy / idle / auto / passive income exists.** Progression is 100% manual
  clicking. Confirmed: no work/energy/upgrade mechanic in the codebase.
- **Clicks feed three reward tracks:** cumulative achievements (200, 1000, every
  5000 → `achievements.go:10-45`), time-window achievements (Fast Finger /10s,
  Relentless /day → `ws.go:283-358`), and Warrior-only click-missile tiers
  (300→2k→4k→6k→8k→10k→13k→16k→20k → `missile_types.go:24-37`).
- **Missiles** = 9 static types (Imp/Titan/Atlas × I/II/III), range 500–5000km,
  damage 300–70000 (`missile_types.go:11-21`), fired with Haversine range checks
  (`geo.go`, `fire_missile.go`).

**Implication:** "simulating work" today literally means physical clicking gated
by a generous rate limit. That is fragile (autoclickers trivially max it, and
silent drops feel broken). This is the core thing to redesign.

---

## 2. What "simulate work" / cooldown should mean (design options)

The market splits into three archetypes; the recommendation is a **hybrid**.

| Model | How "work" is paced | Pros | Cons |
|---|---|---|---|
| **Pure rate limit (current)** | token bucket, drop excess | simple | autoclicker-exploitable, silent drops feel buggy |
| **Energy/fuel per click** (War Clicks: each click burns 0.05% fuel; refills over time) | clicks cost a depleting resource | rewards bursts, throttles autoclickers, natural monetization (refill) | needs UI + refill loop |
| **Idle/auto production** (Cookie Clicker / NGU: buy "workers" that generate per second) | offline & passive growth | retention when not playing, deep upgrade tree | changes core loop, needs offline calc |

**Recommended hybrid "work" model:**
1. **Energy meter** — each click spends 1 energy; energy regenerates (e.g. 1/sec,
   cap scalable by upgrades). Replaces the silent-drop rate limit with a *visible*
   gauge. Bursts feel good; sustained autoclicking just drains to empty.
2. **Idle "workers/infrastructure"** — spend population to buy passive
   population/sec (farms, housing, hospitals). Gives offline progress and an
   upgrade economy — the single biggest retention lever incremental games have.
3. **Click multiplier upgrades** — generalize the existing 1x/2x role multiplier
   into a purchasable curve (clicks/achievements buy +click power).
4. **Cooldowns where they create decisions** — not on the grow-click, but on
   *abilities* (missile fire already implicitly; add boosts like "2x for 30s,
   5min cooldown"). Cooldowns are best as ability gates, not core-loop gates.

This keeps the click satisfying, defangs autoclickers, and adds the missing
long-tail (idle + upgrades) that every comparable game relies on.

---

## 3. Feature roadmap to advance the game

**Near-term (deepen the loop):**
- Energy gauge + visible feedback replacing silent drops.
- Upgrade tree: click power, energy cap/regen, passive pop/sec (idle).
- Offline progress (compute elapsed × passive rate on reconnect).
- City defenses / anti-missile (interceptors, shields) — currently attack-only.

**Mid-term (social/competitive):**
- **Alliances/teams** (countries or factions) with shared goals — War Clicks'
  "Country Invasions" and Grepolis/OGame alliances are the proven retention model.
- **Seasons & leaderboards with resets** + cosmetic/permanent rewards (War Clicks
  weekly competitions). There's already a leaderboard endpoint to build on.
- **Events** — limited-time global bosses or "world war" weekends.

**Long-term (monetization & meta):**
- Generalize the subscription (`subscription.go`) into Warrior + cosmetic tiers,
  energy refills, battle pass.
- Prestige/rebirth (Territory Idle "abdicate for gold") — reset for permanent
  multipliers; classic incremental long-tail.

---

## 4. Spinoff opportunities (engine is reskinnable)

The core engine is **generic**: nodes on a globe + click-to-grow + ranged
attacks + achievement/upgrade economy. The map/theme is the thin skin. Spinoffs:

- **Fantasy — "Realms" / "Mana Wars"** (strongest fit): cities→kingdoms,
  population→mana/army, missiles→spells/dragons, range→spell tier, subscription→
  archmage. Same globe (or a fantasy map) + reskinned assets. Validated demand:
  Idle Kingdom, Idle Magic Clicker, Firestone all occupy this space.
- **Sci-fi / space** — planets instead of cities, fleets instead of missiles
  (OGame-adjacent).
- **Economic / tycoon** — grow GDP, "attack" via trade/sanctions (less violent,
  broader audience).
- **Zombie/outbreak** — grow survivor settlements, infection spreads between
  nodes (uses the Haversine range mechanic naturally).

**Reskin strategy:** factor theme into a config/content layer (names, asset
packs, missile→ability table in `missile_types.go`, copy strings) so a spinoff is
a content pack + asset swap rather than a fork. This is the cheapest path to a
fantasy spinoff and worth designing for now.

---

## 5. Comparable games on the market

- **War Clicks** (warclicks.com) — closest analog: browser idle *war* clicker,
  fuel-limited clicking (0.05%/click), autoclicker upgrades, trainers for
  automation, country invasions, weekly competitions, gold premium currency.
  Direct template for the energy + idle + team + monetization model.
- **Cookie Clicker** — canonical idle/upgrade/passive-income loop & prestige.
- **NGU Idle** — energy-allocation resource model.
- **Territory Idle** (Steam) — territory expansion + prestige ("abdicate").
- **Idle Nation / Idle Kingdom** — map/nation growth.
- **OGame / Grepolis / Travian** — alliance-driven competitive MMO strategy
  (team/season meta to emulate).
- **Firestone / Idle Magic Clicker / Idle Kingdom Clicker** — fantasy idle proof
  of demand for the spinoff.

Sources: [War Clicks](https://warclicks.com/) & [dev blog](https://blog.warclicks.com/how-war-clicks-actually-works);
[War Clicks Wiki](https://war-clicks.fandom.com/wiki/Autoclicker);
[Territory Idle](https://store.steampowered.com/app/1017100/Territory_Idle/),
[Idle Kingdom](https://store.steampowered.com/app/3423800/Idle_Kingdom/) (Steam);
[Incremental game (Wikipedia)](https://en.wikipedia.org/wiki/Incremental_game);
[PCGamesN best clicker games](https://www.pcgamesn.com/best-idle-games-clicker-games-pc);
[strafe.com idle browser games](https://www.strafe.com/browser-games/idle-clicker-games/);
[Firestone](https://www.crazygames.com/game/firestone-idle-rpg).

---

## 6. Phased implementation plan (all four directions)

Sequenced so the core click transaction is rebuilt once (Phase 1), then layered.
Phase 4 (theming) is threaded through Phases 1–3 — always add new copy to a config
layer, never inline — and finalized last.

### Cross-cutting conventions to follow
- **Migrations:** add `migration2/3/4` funcs and append to the slice in
  `runMigrations()` (`migrations.go:27-29`); use `addColumnIfNotExists` /
  `CREATE TABLE IF NOT EXISTS`; never edit `migration1`. Initialize new
  `*_updated_at` columns to `CURRENT_TIMESTAMP` for existing rows (mirror
  `migration1` `cities` backfill).
- **Background workers:** `startXWorker()` with a `time.NewTicker` goroutine wired
  in `main.go:39-41` (pattern from `snapshots.go`, `subscription.go` expiry checker).
- **WS:** outgoing `WSOutgoing{Type,Data}`; broadcast via the hub. Keep economy
  *mutations* on REST (atomic, testable) and broadcast results — like
  `wsHub.handleFireMissile` wired at `main.go:61`.
- **Static defs in Go, per-user state in DB** — mirror `missile_types.go`
  (`allMissileTypes`). Definitions/cost curves are code; DB stores owned levels.

### PHASE 1 — "Work" redesign (FOUNDATION: energy + idle + click-power)
Replaces the silent-drop rate limit with a visible, server-authoritative economy.

- **DB (`migration2`):** add to `users`: `energy REAL DEFAULT 100`,
  `energy_max INT DEFAULT 100`, `energy_regen_per_sec REAL DEFAULT 1`,
  `energy_updated_at`, `click_power INT DEFAULT 1`, `population_balance REAL DEFAULT 0`,
  `idle_rate_per_sec REAL DEFAULT 0`, `idle_updated_at`. New tables `user_upgrades`
  (user_id, upgrade_key, level) and `user_generators` (user_id, generator_key, count).
- **New `economy_config.go`:** static `UpgradeDef`/`GeneratorDef` tables + cost-curve
  helpers (`cost = BaseCost * Factor^level`). Currency = `total_clicks` (population)
  for v1; note it so Phase 3 season resets handle it cleanly.
- **New `economy.go`:** `settleEnergy` (lazy regen from `energy_updated_at`, cap at
  max), `settleIdle` (accrue `idle_rate_per_sec * elapsed`, **cap elapsed at
  OFFLINE_CAP ≈ 8h**, flush whole units via existing `recordClick` shape, keep
  remainder in `population_balance`), `buyUpgrade`, `buyGenerator`. All single-tx.
- **Click handler (`ws.go:200-240`):** remove `limiter.allow` drop (`ws.go:204-206`);
  repurpose `ratelimit.go` as a hard *anti-abuse burst ceiling* only. New flow:
  settleEnergy → if `<1` send `energy_empty` (no DB write) and skip → else `energy-=1`,
  `multiplier = click_power (×2 if warrior)` → `recordClick` (unchanged signature,
  `db.go:180`) persisting energy in the same tx → broadcast `city_update` + new
  `energy_update`. Cache `click_power`/energy fields on the `client` struct
  (`ws.go:14-22`) via the existing periodic role refresh (`ws.go:208-214`).
- **`models.go`/`db.go`:** extend `User` + `userCols`/`scanUser` (COALESCE defaults
  like role/best_10s). New payloads `EnergyState`, `IdleProgress`; new WS types
  `energy_update`, `energy_empty`, `idle_progress`.
- **REST (`handlers.go`/`main.go`):** `GET /api/me/economy`,
  `POST /api/upgrades/{key}/buy`, `POST /api/generators/{key}/buy`. Make
  `handleGetMe` call settleIdle+settleEnergy so `/api/me` reflects offline gains.
- **Worker:** `startEnergyWorker()` — lazy model (compute on demand; low-freq flush
  of online users' `population_balance`).
- **Frontend:** replace client rate limit in `useClickHandler.ts:4-36` with energy
  gating (optimistic decrement + local regen + reconcile from WS); `multiplier`→
  `user.clickPower`. Energy bar + "Out of energy" in `ClickButton.tsx`. New
  `WorkPanel.tsx` (model on `MissilePanel.tsx`) for upgrades/generators. Add rows to
  `PlayerPanel.tsx`. Extend `types.ts` `User` + `WSMessage` union, add API calls.
- **Risks:** offline abuse → server-only time math, clamp negative elapsed,
  OFFLINE_CAP; autoclicker → energy throttles + keep burst ceiling, `energy_empty`
  must be cheap; float drift → REAL + flush only whole ints; concurrent settlement
  (multi-tab) → read-modify-write inside one tx, set `*_updated_at` to read time.

### PHASE 2 — Defense systems (builds on Phase 1 purchase pattern)
- **DB (`migration3`):** `cities.shield_hp/shield_max/interceptor_count`. New
  `defense_config.go` (`DefenseDef{InterceptChance, ShieldHP,...}`).
- **Backend:** `defense.go` `buyDefense`. Modify damage application in
  `fire_missile.go:89-124` (same tx): roll interceptor (server `math/rand`,
  already used `fire_missile.go:90`) → else shields absorb (`MAX(0, hp-damage)`,
  overflow to population). Extend `MissileStrike` with `Intercepted`/`ShieldAbsorbed`;
  broadcast `missile_intercepted`/`shield_absorbed`. REST `POST /api/defenses/{key}/buy`.
- **Frontend:** `DefensePanel.tsx`, shield/interceptor in `InfoPanel.tsx`, toasts.
- **Risks:** intercept RNG server-side; concurrent hits resolved in-tx with MAX guards;
  cap shields to prevent infinite defense.

### PHASE 3 — Social/competitive (alliances, seasons, events)
- **DB (`migration4`):** `alliances`, `alliance_members`, `seasons`,
  `season_results`, `events` tables; `users.alliance_id`, `users.season_clicks`.
- **Backend:** `alliances.go` (create/join/leave + alliance leaderboard),
  `seasons.go` `startSeasonWorker()` (on `ends_at`, **single idempotent tx**:
  archive standings → reset `season_clicks` only, keep lifetime `total_clicks`),
  `events.go` `startEventWorker()` (active-event multiplier cached in memory, folded
  into the click `multiplier`). New broadcasts `season_ended`/`event_started`/etc.
- **Frontend:** `AlliancePanel.tsx`, `SeasonBanner.tsx`, `EventBanner.tsx`,
  leaderboard tabs.
- **Risks:** season reset must be one idempotent tx (guard on `seasons.active`) to
  avoid half-wipes/double-archive on restart; decide population-vs-season-clicks
  reset scope explicitly (recommend reset season counter only).

### PHASE 4 — Fantasy spinoff (theme = content/config layer)
- **Backend `theme.go`:** a `Theme` struct aggregating the now-centralized static
  tables (abilities = `missile_types.go`, generators/upgrades, defenses) + copy
  strings (roles, verbs, currency name). Load active theme from env/config in
  `main.go` (default `conflict`). Lookups (`getMissileTypeDef` `missile_types.go:39`,
  award/threshold logic) read from `theme`. **Keep DB columns & WS `type` strings
  theme-neutral** — only display labels change.
- **Frontend `client/src/theme.ts`** + React context; `GET /api/theme` consumed at
  boot in `App.tsx`. Replace every hard-coded label (`ClickButton.tsx:51`,
  `MissilePanel.tsx`, `SubscriptionPanel.tsx`, `PlayerPanel.tsx`, toast copy). Asset
  packs (globe texture, gradients) keyed by theme.
- **Risks:** prevent leakage of theme into DB/WS keys; separate `DB_PATH` per theme
  deployment (mana costs ≠ population costs); keep ability shape identical across
  themes so Phase 1–3 logic never branches on theme.

### Critical files
- `migrations.go` (append `migration2/3/4` at the slice, ~line 27)
- `ws.go` (click handler 200-240; remove rate-drop 204-206; `client` struct 14-22)
- `db.go` (`recordClick` 180-209 reused; `userCols`/`scanUser` 140-154)
- `models.go` (`User` 21-35; new payloads + WS types)
- `client/src/hooks/useClickHandler.ts` (rate limit 4-36 → energy gating; line 23)
- New: `economy.go`, `economy_config.go`, `defense.go`, `defense_config.go`,
  `alliances.go`, `seasons.go`, `events.go`, `theme.go`; React `WorkPanel.tsx`,
  `DefensePanel.tsx`, `AlliancePanel.tsx`, `theme.ts`.

## 7. Verification
- **Migrations:** start server fresh + against an existing DB; confirm
  `schema_version` advances and existing users get full energy / correct
  `*_updated_at` (no since-1970 idle credit). `go test ./...`.
- **Phase 1:** `make dev-server` + `make dev-client`; click until energy drains →
  bar empties, `energy_empty` shows, regen refills. Buy a generator → population
  rises per second; disconnect, wait, reconnect → `idle_progress` credits capped
  offline gains (verify OFFLINE_CAP). Buy click-power → `+N` per click increases.
  Autoclicker test: sustained clicks just drain energy, burst ceiling holds.
- **Phase 2:** fire missiles at a shielded/intercepted city → confirm intercept RNG,
  shield absorption, overflow to population, correct toasts.
- **Phase 3:** force a short season → standings archived to `season_results`,
  `season_clicks` reset, lifetime stats intact; restart mid-reset → no double-archive.
  Trigger an event → click multiplier changes globally.
- **Phase 4:** boot with theme env unset (default) and set to `fantasy` → labels/
  assets swap, DB/WS unchanged, balance identical.
- Add Go tests beside existing ones (`handlers_test.go` style) for `settleEnergy`/
  `settleIdle` (time math, caps, clamps) and defense resolution; frontend `vitest`
  for energy gating in `useClickHandler`.
