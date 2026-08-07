# Global Conflict v2 — city-building prototype (client-only PWA)

A standalone pilot of the [v2 city design](../docs/CITY_DESIGN_OVERVIEW.md): clicks
stop destroying and start **building**. No backend — the whole world (your city
plus ~190 bot-controlled rival cities) runs in the browser via a single
`MockGameClient`, persisted to `localStorage`. Mirrors the architecture of the
sibling `foom` project.

The v1 game (`../client`, `../*.go`) is untouched; this lives entirely under `web/`.

> **Core loop (click-driven model).** Population is the sum of building worker
> amounts (monotonic; residential = housing only), food is consumed **1 unit per
> click**, and happiness is 50% housing + 50% food (deeper sections dormant
> behind a flag). The authoritative spec is
> [`../docs/CORE_LOOP.md`](../docs/CORE_LOOP.md); numbers are first-draft and
> balance follow-ups live in [`WHATS_NEXT.md`](WHATS_NEXT.md).

## Run

```bash
cd web
npm install
npm run dev        # http://localhost:5174 (or next free port)
npm test           # vitest — pure game-logic suites
npm run balance    # headless balance harness — band report + sane-band asserts
npm run build      # tsc + vite (PWA service worker)
```

## How it's built

- **`src/client/`** — `GameClient` interface (the seam) + `MockGameClient` (all
  state, a `setInterval` tick loop, bot simulation, persistence). Swap in a
  `LiveGameClient` later without touching the UI.
- **`src/game/`** — pure, unit-tested logic: `config` (the live config store),
  `catalogBuild` (CSV → buildings/prices), `tuning` (recipe amounts + the numeric
  knobs, both as CSV), `catalog` (the merged building metas + economy curves),
  `recipes` (built-in per-building amounts), `economy` (construction +
  production), `population`, `happiness`, `market` (global + city-to-city),
  `bots`, `throttle`, `pedometer` (step detection for Walk Mode).
- **`src/components/`** — React UI in the v1 "tactical console" aesthetic: Globe,
  Build, City, Market, Trade, Leaderboard, the GROW dial + throttle meter, and
  the Walk Mode toggle (on devices with motion sensors — see below).

## The loop

Click → activity units (10 at full happiness, fewer as it drops) → fed to your
**active building**'s **production** (batches consume inputs **from the city's
own stock** and yield outputs — a missing input **stalls** production until you
produce, buy, or trade for it; nothing is auto-bought). Every click also eats
**1 food** (a worker is eating). **Building and upgrading are instant cash
purchases** (no click-build): buying/upgrading a **workplace** immediately raises
**population** (the sum of building worker amounts — it never goes down);
residential blocks add **housing**. Happiness = 50% housing (are workers housed?)
+ 50% food (is food stocked vs population?), and happiness scales click
effectiveness — so a starving or homeless city builds slowly. Sell surplus to the
game-run global market or list it for other cities; bots do the same. See
[`../docs/CORE_LOOP.md`](../docs/CORE_LOOP.md) for the full rules.

## Walk Mode (mine while you walk)

On phones the GROW dial gains a **🚶 MINE WHILE WALKING** toggle — an
*alternative* input alongside tapping, never a replacement. Switching it on
(iOS asks for motion permission at that moment) feeds the accelerometer into a
step detector (`game/pedometer.ts`, orientation-free so a pocket works) and
every detected step fires a normal click at the active building, through the
**same throttle** as tapping — walking mines at human rates, like the
autoclicker it's comfort, not advantage. Each mined step buzzes the phone; the
toggle shows a live step count. The toggle only renders on devices with motion
sensors (`hooks/useWalkMode.ts`).

Like a fitness tracker, the one toggle recognizes the **activity** from step
cadence — 🚶 walking vs 🏃 jogging (`ActivityMeter`) — and labels itself
accordingly. Jogging mines more only because you take more steps; activity
never multiplies clicks — **multipliers stay monetized** (energy drinks, §8).

## Game data is live (the Config panel)

There is no generated data file and no build step for the design data: the CSVs
in `../docs` are bundled as **text** and parsed in the browser at boot
(`game/catalogBuild.ts`), which means they can be swapped at runtime. The
**⚙ Config** button (top-left) opens a console for exactly that:

| File | What it is |
|---|---|
| `gamer_supply_chain_tech_tree.csv` | the tree: one row per branch, one column per tier, cells like `Blast Furnace (Iron Bricks + Coal->Steel Alloys)` |
| `recipes.csv` | per-batch **amounts** — `building_id,kind,resource,amount` |
| `tuning.csv` | the numbers — `key,value`: costs, workers per tier, price curve, food values, tier unlocks, click cap |
| `world_countries_game_resources.csv` | country → its 3 raw goods |

Per file you can **download** what the game is running on now, edit it in a
spreadsheet, **upload** (or paste) it back, and **revert** to the built-in one.
An upload takes effect immediately and is remembered in `localStorage`
(`gc.config.v1`) across reloads until reverted.

Applying any file **restarts the world** — building ids, prices and worker counts
all move, so the cities in memory would be nonsense. That reset is also a button
of its own (**Reset game data**): it wipes the save (`gc.save.v1`), reseeds every
city from the current config and drops you back at the enlistment terminal.

Bad data never bricks the game: a tech tree with nothing readable is rejected and
the running config is kept, and everything softer (a typo'd cell, an ingredient
nothing produces, an unknown tuning key, a recipe row for a building that no
longer exists) shows up in the panel's **Warnings** list.

## Monetization (design §8)

A hard-currency ("Bucks") shop, in `game/shop.ts` + `components/ShopPanel.tsx`:

- **Energy drinks** — a 2×/5×/10× × 1m/5m/15m/8h matrix of click multipliers;
  consumed on use, time-boxed (the dial shows a `⚡N×` badge + countdown).
- **Autoclickers ("employees")** — auto-click the active building at the *same*
  capped rate as a human (automation buys comfort, not advantage, §8).
- **Air tickets** — 1 free at start; spend one to move home city. The old city
  reverts to bot control.

Bucks would be bought with real money; here the operator just starts with a
balance (`STARTING_BUCKS`). No payments. Player-to-player gifting is real: the
Trade panel can send goods to any city for free (`game/market.ts` →
`giftResource`).

## Known tuning knobs (prototype)

Most of them are now the `tuning.csv` above — editable from the Config panel with
no rebuild. `game/tuning.ts` holds the built-in values (`DEFAULT_KNOBS`): worker
counts per tier, build/upgrade cost curves, work per batch, resource price curve
and market spread, residential cost/capacity, food per click and per-good food
values, tier-unlock populations, and the click-rate cap.

Still code-side:

- `game/happiness.ts` — `DEEP_HAPPINESS` flag (parks the deeper sections).
- `game/civic.ts` — which goods count as energy / fun / luxuries, country aliases.
- `game/shop.ts` — Bucks prices, durations, `STARTING_BUCKS`.
- `game/catalogBuild.ts` — resource name `ALIASES`.

## Not yet

Prerequisite-building tech gating (population gating is in), transport, seasons,
battle pass, and a real backend. See the design doc §8/§10 and `WHATS_NEXT.md`.
