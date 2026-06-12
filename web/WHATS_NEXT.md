# What's next — Global Conflict v2 prototype

The `web/` prototype now covers the design's MVP core loop **and** the §8
monetization layer, all client-side with bot rivals. This is the roadmap from
here, roughly in priority order. See `README.md` for how it's built and
`../docs/CITY_DESIGN_OVERVIEW.md` for the full design.

## Done so far

- **Core loop** — clicks → activity units → construction → production batches
  (inputs bought from the market when short); residential blocks → population;
  happiness (housing/food, then energy/employment/fun/luxuries) scales click
  effectiveness; soft throttle meter.
- **Markets** — game-run global buy/sell (infinite source/sink) + player-priced
  city-to-city offers; ~190 bot cities produce, grow, build, and trade.
- **Monetization (§8)** — Bucks shop: energy-drink multiplier matrix,
  autoclicker "employees", air-ticket city moves.
- **Shell** — PWA, localStorage persistence, deterministic seeding, v1 tactical
  aesthetic. 27 vitest specs over the pure logic.

## Next — gameplay & balance

1. **Economy balance pass (highest value).** The numbers are first-draft and
   easy to wander into starvation or runaway. Tune from play:
   - `game/civic.ts` — `FOOD_PER_CAPITA` / `ENERGY_PER_CAPITA`.
   - `game/catalog.ts` — `buildCost` / `constructionUnits` / `workPerBatch`.
   - `game/throttle.ts` — the click cap.
   - `game/shop.ts` — Bucks prices, durations.
   - Consider a "balance harness": run the bot sim headless for N ticks and
     assert population/cash/happiness stay in sane bands.
2. **Deeper happiness needs.** Fun/luxuries subsections exist but are thin —
   wire more goods into `FUN_GOODS` / `LUXURY_GOODS` and add their buildings to
   the buildable set so large cities have real late-game problems to solve.
3. **Tech-tier gating (§10 open Q#4).** Today every non-residential building is
   buildable from the start. Gate higher tiers behind population / prerequisite
   buildings so the tree unlocks over a session.
4. **Player-to-player gifting (§8).** Real gifting UI (currently the top-item
   purchase only fires a flavor notice). Needs a notion of other *players* —
   trivial against bots, meaningful once multiplayer is real.

## Next — UX & polish

5. **Mobile / short-viewport layout.** Panels overlap on short screens; the
   left build+city stack and the right market+trade+shop stack need a responsive
   pass (drawers or tabs on narrow widths).
6. **Onboarding tutorial.** A first-session nudge: "pick a building → click →
   build housing → feed your city." The starvation valve is unintuitive cold.
7. **Activity feedback.** Surface batch completions / production ticks on the
   active building; show the units-per-click number live (it changes with
   happiness).
8. **Globe.** Color/size markers by happiness or wealth, not just population;
   show trade flows between cities.

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
