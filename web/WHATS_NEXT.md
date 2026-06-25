# What's next — Global Conflict v2 prototype

The `web/` prototype now covers a first MVP core loop **and** the §8
monetization layer, all client-side with bot rivals. This is the roadmap from
here, roughly in priority order. See `README.md` for how it's built and
`../docs/CITY_DESIGN_OVERVIEW.md` for the full design.

## Next — balance the new core loop

The click-driven core loop ([`../docs/CORE_LOOP.md`](../docs/CORE_LOOP.md)) is
implemented; the numbers are first-draft. Tune with `npm run balance`:

- **Worker amounts** (`catalog.ts` `workersForTier`) set how fast population
  climbs and how soon tech tiers unlock.
- **Food** — `FOOD_UNIT_VALUE` (`civic.ts`) and `FOOD_PER_CLICK` (`happiness.ts`)
  set how hard feeding the workforce bites. Today bots/players accumulate food
  easily, so happiness pins high — tighten if food should be a real squeeze.
- **Cash** — the harness shows cities run near-broke (they spend on building);
  revisit `buildCost`/`upgradeCost` and market prices.
- **Re-enable deeper happiness** (energy/employment/fun/luxuries) by flipping
  `DEEP_HAPPINESS` in `happiness.ts` once the tech tree is balanced; that
  restores the mid-band happiness valve.

## Done so far

- **Core loop (click-driven, CORE_LOOP.md)** — each click does work *and* eats
  1 food; population = Σ building worker amounts (monotonic, residential = 0);
  housing must keep pace or workers are homeless; happiness = 50% housing + 50%
  food and scales click effectiveness; deeper sections parked behind a flag.
- **Markets** — game-run global buy/sell (infinite source/sink) + player-priced
  city-to-city offers; ~190 bot cities produce, grow, build, and trade.
- **Monetization (§8)** — Bucks shop: energy-drink multiplier matrix,
  autoclicker "employees", air-ticket city moves.
- **Shell** — PWA, localStorage persistence, deterministic seeding, v1 tactical
  aesthetic. 42 vitest specs over the pure logic.
- **Balance harness** — `game/balanceHarness.ts` runs the whole world (bots + an
  optional clicking player) headless and deterministically for N ticks;
  `game/balanceHarness.test.ts` asserts population/cash/happiness stay in sane
  bands. `npm run balance` prints a band report. It caught a population-wipe bug
  (stacking a Housing Block evicted the city) — fixed in `game/population.ts`.
- **Tech-tier gating (§10 Q#4)** — `tierUnlockPopulation()` opens higher building
  tiers as a city grows (1k/5k/20k/50k); enforced in `economy.startBuild`,
  respected by bots, shown locked in the Build panel.
- **Deeper happiness needs** — `FUN_GOODS` / `LUXURY_GOODS` widened with real
  compute/AI + apparel/pharma goods, now gated behind tech tiers as late game.
- **Player-to-player gifting (§8)** — `market.giftResource()` on the GameClient
  seam; a Gift control in the Trade panel sends goods to any city, free.
- **Activity feedback (§7)** — live units-per-click badge on the GROW dial +
  `production` events surfaced as "▲ N good" toasts.
- **Globe (§8)** — cities tinted by happiness (red→amber→green); transient
  great-circle arcs flash on trades/gifts.
- **First-session tutorial (§6)** — milestone-driven coach card (work → feed →
  house), shown once.
- **Responsive pass (§5)** — media queries so the absolute HUD panels reflow on
  narrow / short viewports instead of overlapping.

## Next — toward a real backend

9. **`LiveGameClient`.** The `GameClient` seam (`src/client/GameClient.ts`) is
   the one place to swap the in-browser mock for a server. Implement a fetch +
   WebSocket client against the Go backend and the UI is unchanged. The Go side
   would own: city/resource/cash state, the production/market transactions
   (mirroring `*.go` patterns in the repo root), and broadcasting `city_update`
   / `trade` events. Bots would move server-side (a background worker) or be
   dropped once enough real players exist.
10. **Persistence & accounts.** Replace localStorage with server-side state and
    the existing cookie-based identity (`user_id`).

## Deferred (design §10 "Later")

Transport (capacity/mass/speed-cost between cities), trade wars / embargoes,
seasons & leaderboards, alliances, battle pass, cosmetics, market fees.

## Known rough edges

- Bot trading is stochastic and lightly tuned — offer books can thin out or pile
  up; no market-depth balancing yet.
- No reset/new-game control in the UI (clear `localStorage` key `gc.save.v1`).
- The three.js globe bundle is ~2.8 MB (single chunk); code-split before any
  real launch.
