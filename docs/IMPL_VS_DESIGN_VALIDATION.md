# v2 Implementation vs Design — Validation Report

*Validated July 2026 against [`CITY_DESIGN_OVERVIEW.md`](CITY_DESIGN_OVERVIEW.md) (§1–§11) and
[`CORE_LOOP.md`](CORE_LOOP.md) (the authoritative mechanics spec). Scope: the `web/`
prototype only. Method: file-by-file review of `web/src/game/*`, `web/src/client/*`, the
catalog generator, and the two data CSVs; test suite (56/56 passing) and `npm run balance`
(all bands green) re-run as part of the validation.*

## Verdict

The core loop is implemented **faithfully and precisely** — every mechanic in
`CORE_LOOP.md` §0–§5 is verifiably in the code, most with dedicated tests. The market,
monetization, and tech-tree layers match the design closely. The deviations that exist are
concentrated in **§7 (cities and locations)**, two **gifting sub-features of §8**, and a few
**doc-level inconsistencies** — listed below with file references.

---

## 1. Confirmed faithful (design → code)

| Design rule | Where implemented | Notes |
|---|---|---|
| Population = Σ building worker amounts; residential = 0; monotonic (CORE_LOOP §1) | `population.ts` `workersOf`/`syncCity`; `catalog.ts` `workersPerLevel` (residential 0) | Counted by completed `level`; buildings never removed |
| Build/upgrade = instant cash purchase; workers count immediately (§1a) | `economy.ts` `startBuild`/`startUpgrade`; `MockGameClient.startBuild` calls `syncCity` same frame | Legacy `applyUnits` construction branch kept exactly as §1a describes, plus a save migration that finishes in-flight builds |
| Housing score = `min(1, H/P)`, pop 0 → 1 (§2) | `happiness.ts` `housingScore` | Capacity from residential `level × capacityPerLevel` |
| Food = Σ count × unit value; drained cheapest-first; floors at 0; the **only** food sink is a working click, 1 unit each (§3) | `civic.ts` `FOOD_UNIT_VALUE` (ascending 10→300); `happiness.ts` `drainFood`, `FOOD_PER_CLICK = 1`, `consumeClickFood` | `FOOD_GOODS` ordered cheapest→dearest so iteration order = drain order; float-error guard floors each good at 0 |
| Happiness = 50% housing + 50% food; deeper sections dormant (§4) | `happiness.ts` `computeHappiness`, `DEEP_HAPPINESS = false` | Staged model (1k/5k/20k/50k pop triggers) retained behind the flag, matching the "designed but dormant" claim |
| Click units = threshold ramp of happiness: 10 @ 90–100% … 1 at bottom, × drink multiplier (§5) | `happiness.ts` `clickEffectiveness`; `MockGameClient.click` | `floor(h/10)+1` clamped to [1,10] reproduces the ramp exactly |
| One click = one tick; no ambient timers for the player's city (§0) | `MockGameClient.tick` touches only bot cities + the autoclicker | Bots-on-a-timer is the documented exception; the autoclicker is the documented §8 exception |
| Hard input gate: a stalled building banks **no** work, click not counted (no throttle, no food), no burst on restock (§0, §5) | `economy.ts` `batchShortfall` + `applyUnits` (drops units, keeps ≤1 partial batch); `MockGameClient.click` checks the block **before** spending throttle/food | Mid-mega-click dry-out also drops the remainder — matches "never hoards clicks" |
| Chains from data, 10 branches × 10 tiers, no hand-trimmed MVP list (§4) | `scripts/gen-catalog.mjs` → `catalog.data.ts` (93 buildings) | Apparent "missing tiers" (e.g. Apparel 9–10, Mining 7–8) are literal `N/A` cells in the CSV — the generator is faithful |
| Per-batch amounts as a hand-authored overlay (§4) | `recipes.ts` + `catalog.ts` `mergeAmounts`; `recipeOverrideProblems` validated at load and in tests | Overlay can only re-weight ingredients the CSV lists — enforced |
| 3 country resources, every city can produce/sell day one (§4) | `civic.ts` `getCountryResources` (196-country CSV + aliases + fallback); `bots.seedStartingInventory` | Seed grants 40 of each |
| Global market: infinite source/sink, per-resource buy/sell spread set by the game (§5) | `market.ts` `marketBuy`/`marketSell`; prices in `catalog.data.ts` (depth-scaled, 30% spread) | |
| City-to-city offers, player-priced, bounded by the global spread (§5) | `market.ts` `postOffer`/`takeOffer`/`clampOfferPrice` | See deviation D7 — the bound is a hard clamp, stricter than the design's "de facto" bound |
| No voting; any resident spends city cash; personal vs common property split (§6) | `MockGameClient`: city holds cash/buildings/inventory, operator holds Bucks/items | Trivially satisfied single-player; the model is right for multiplayer |
| 1 free air ticket at start; extra tickets in shop; old city reverts to a bot (§7/§8) | `shop.ts` (`items: {'air-ticket': 1}`, 800-Buck ticket); `MockGameClient.moveHomeCity` | |
| Soft click throttle with a visible meter, data-tunable (§8) | `throttle.ts` `RateMeter` (100 burst, ~16.7/s refill); `ClickButton` meter + "Throttled" notice | |
| Energy drinks: full 2×/5×/10× × 1m/5m/15m/8h matrix, inventory items, stockpile cap ~20, consumed on use (§8) | `shop.ts` `buildDrinks()` (12 SKUs), `STOCKPILE_MAX = 20`, `useItem` | |
| Autoclicker = employee clicking at the **same capped rate** as a human (§8) | `MockGameClient.runAutoclicker` draws from the *same* `RateMeter` as the player | Automation is provably comfort-not-advantage: player + employee share one bucket |
| Tech tiers unlock by population — answers open Q#4 (§10/§11) | `catalog.ts` `tierUnlockPopulation` (0/1k/5k/20k/50k); enforced in `economy.startBuild`, keyed off `peakPopulation` so unlocks never re-lock | |
| Free resource gifting between cities (§8, partially — see D3/D4) | `market.ts` `giftResource`; Gift control in the Trade panel | |

Also verified: `npm test` — 12 files, 56 tests, all passing; `npm run balance` — invariants
hold, happiness/population/cash inside the asserted bands, player city grows over a long run.

---

## 2. Deviations and gaps

### D1 — §7 city generation is not per design *(gap, prototype seed)*
Design: "pick a set of cities per country — bigger countries get more cities — choosing each
country's biggest-population cities."
Implementation: `seedCities.ts` is a fixed ~190-entry list from "the prototype GeoNames set"
that does not follow either rule — Brazil has ~40 entries, many of which are **São Paulo
neighborhoods** (Artur Alvim, Cangaiba, Sapopemba, Vila Curuca…), Romania has 12 cities,
while China gets 4 and many countries none. Fine for a prototype backdrop; the generation
rule from §7 is simply not implemented.

### D2 — §7 nearest-city allocation is not implemented *(gap)*
Design: "new players are allocated to the nearest available city in their country, based on
their real location."
Implementation: `Onboarding.tsx` lets the player freely search and pick **any** city; there
is no geolocation and no allocation logic anywhere in `web/src`.

### D3 — §8 energy-drink gifting is not implemented *(gap)*
Design: "players can gift **energy drinks** to each other."
Implementation: only city **resources** are giftable (`market.giftResource`). Shop items
(drinks/autoclickers/tickets) live on the operator and have no gift path. `WHATS_NEXT.md`
cites `giftResource` as the §8 gifting item, but it covers a different thing than the design
sentence.

### D4 — §8 big-buy auto-gift is a cosmetic stub *(misleading)*
Design: "when a player buys the highest-value item, the game automatically gifts a low-value
item to some other players."
Implementation: `MockGameClient.buyItem` only shows the toast *"Your big buy gifted energy
drinks to other cities"* when `TOP_ITEM_ID` is bought — **no gift actually occurs** (bots
have no item inventory to receive one). The toast asserts something the game didn't do;
either implement a real effect or reword the toast.

### D5 — §1 carry-over claims (accounts, achievements) don't hold *(prototype scope)*
Design §1: "What carries over from v1: the globe, real cities, **accounts**, **achievements**
(driven by clicks), and population as the headline number."
Implementation: no accounts (implicit single local player, `localStorage` only — acknowledged
in `WHATS_NEXT.md` as backend work) and **no achievements system at all** in v2. Achievements
are not mentioned in `WHATS_NEXT.md` either — worth adding to the roadmap or striking from §1.

### D6 — CORE_LOOP §0 "can't be selected as the active target" is UI-enforced only *(weak invariant)*
Design (§0, §5): a building missing an input "can't be selected as the active target until
it's supplied."
Implementation: the BuildPanel does disable selection (`selectable = producing && !blocked`),
but the client API does not: `MockGameClient.click()` sets `activeBuildingId` **before** the
stall check, and `setActiveBuilding()` never validates. A stalled building can therefore
become the autoclicker's target through the API. Harmless today — `runAutoclicker` re-checks
`productionBlock` and no-ops — but the invariant lives only in the UI, which a future
`LiveGameClient`/server must not trust.

### D7 — §5 offer-price bound is a hard clamp, not a de-facto bound *(stricter than design)*
Design: players "set and modify whatever prices they want"; the global spread bounds them
*de facto* (an out-of-band price just never trades).
Implementation: `clampOfferPrice` **forces** every offer into `[global sell, global buy]`.
Same economic outcome, but posting at a price outside the band silently changes the price
rather than letting the market ignore it. Defensible simplification; worth knowing it's
stricter than written.

### D8 — §10 MVP text contradicts §4/§1a on construction *(doc bug)*
§10 still lists "**pay-cash-then-activity-units** construction and upgrades" while §4 and
CORE_LOOP §1a (and the code) define **instant** cash construction. §10 was not updated when
the instant-build pivot was folded into §4. Code follows §1a; fix §10's wording.

### D9 — Overview §3 "one base click = 10 units" is shorthand *(doc nit)*
§3 states a base click = 10 units flatly; §3's own happiness bullet, §5, and CORE_LOOP §5
make 10 the *top* of the happiness ramp (90–100%). The code implements the ramp. Only the
one §3 sentence is imprecise.

### D10 — Drink activation replaces, doesn't stack or queue *(design-silent, UX footgun)*
`useItem` overwrites `activeMultiplier`: popping a 10×·1m while a 2×·8h is running discards
the remaining 8 hours. The design doesn't specify; today's behavior silently destroys paid
value, so it deserves a deliberate decision (block, queue, or keep-best).

### Minor observations
- `needsWorkers` is parsed from the CSV into every `BuildingDef` but is dead — nothing reads
  it; the worker concept is carried by `workersPerLevel` instead.
- CORE_LOOP's worked examples (residential capacity 100, mine +50/+20/+30) are illustrative;
  impl values (capacity 400, `40 + tier×10` per level, linear per level) are the documented
  "first-draft, tunable" numbers — not a deviation.
- Bots eat 1 food per building operated per step (`bots.ts`), mirroring the player's
  1-per-click in spirit; bots intentionally bypass the throttle (they're stand-ins, not
  players).
- Taxes (§3 "later"), transport (§5/§10), battle pass, seasons, alliances — all correctly
  absent as designed.

---

## 3. Suggested follow-ups (in priority order)

1. **Fix the D4 toast** — one line, and it stops claiming a gift that never happened.
2. **Decide D10 drink-replacement semantics** before anyone pays real money.
3. **Move the stalled-target guard into the client** (D6): validate in
   `setActiveBuilding`/`click` so the invariant survives the `LiveGameClient` swap.
4. **Update the docs**: §10 wording (D8), §3 shorthand (D9), and either implement or
   re-scope the §1 accounts/achievements carry-over claim (D5) and §7 generation/allocation
   (D1/D2) — or mark them explicitly as backend-era work in `WHATS_NEXT.md`.
5. **Energy-drink gifting** (D3) is the one §8 monetization feature genuinely missing.
