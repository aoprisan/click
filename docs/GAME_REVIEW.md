# Global Conflict — Review of the Game Implementation & Concept

> Date: 2026-07-02 · Scope: the full repo — v1 (Go + React multiplayer, root + `client/`)
> and v2 (client-only city-building PWA, `web/`) — plus the design/research docs.
> Method: four independent deep-dives (concept docs, v1 backend, v2 game logic,
> v2 client/UI), findings cross-checked against source; `web/` test suite
> (50 vitest specs) and `npm run balance` were run and pass.

---

## Executive summary

**v2 is a smarter, more ethical, more extensible concept than v1, built on an
unusually disciplined codebase — but the current prototype quietly abandoned the
two things its own market research identified as the design's strongest asset
(multiplayer sociality) and most damning gap (an idle retention layer), and no
document acknowledges either departure.**

On the implementation side, both versions show the same signature: careful,
well-tested work on the core loop, with correctness and economy discipline
thinning out at the edges added later.

- **v1** has genuinely careful Go in the Phase-1 core (clicks, globe, WebSocket
  fan-out, migrations, rate limiting), but the combat/subscription layer is
  exploitable: a missile double-fire race, a free and infinitely stackable
  Warrior subscription, and sybil missile farming. Its economy is structurally
  tilted toward destruction (one Atlas erases 5–11 hours of capped clicking).
- **v2** has an exemplary pure-logic layer and a clean client seam, but carries
  one economy-breaking bug (production outputs scale with building level while
  inputs don't — leveled processors print value), a fragile save-migration
  story for a game whose *only* state is one localStorage key, and a happiness
  system that is currently saturated (median 100 in the balance run) and so
  exerts no pressure on the game's central feedback dial.

The single most important non-code finding: **the docs stopped talking to each
other at the pivot.** `CITY_DESIGN_OVERVIEW.md` still promises shared cities;
`CORE_LOOP.md` flatly says one player per city. `CITY_DESIGN_MARKET_RESEARCH.md`'s
P0 recommendations (idle layer, economy sinks, anti-multi) are neither adopted
nor rebutted anywhere. `ROADMAP.md` and `SPEC.md` describe games that no longer
exist and aren't marked historical.

---

# Part I — Concept

## 1. Three concepts, not two

The repo actually contains **three** designs, and the drift between them is
undocumented:

1. **`SPEC.md` — "ClickCity."** A wholesome, no-auth, no-combat civic-pride
   clicker: "a navigable data visualization you can also play." This is the
   strongest hook in the repo — legible in five seconds, viral by nature
   ("click for Sibiu"), broadly appealing.
2. **`GAMEPLAY.md` — v1 as shipped.** The same globe with missiles, kills, and
   a paid Warrior tier bolted on. Emotionally punchy but structurally confused:
   the mass-casualty framing ("{N} killed in {city}") attached to *real* cities
   is a marketing and platform liability, and it inverts the pride hook — the
   reason you care about your city is the reason you rage-quit when someone
   deletes 70,000 of its people.
3. **`docs/CITY_DESIGN_OVERVIEW.md` + `CORE_LOOP.md` — v2.** "Your clicks build
   a real city into an economy." More durable and more monetizable, with a
   CSV-driven 10-branch × 10-tier tech tree giving aspirational depth at near-zero
   authoring cost. But as implemented it is a **single-player game wearing
   multiplayer clothing**, and its audience is ambiguous: idle-game players
   bounce off "no offline progress"; city-builder players bounce off "the
   interface is one button."

## 2. The v1 → v2 pivot

The stated rationale is crisp and mostly right: "missiles are a dead end —
they're zero-sum, they reward griefing, and there's nowhere for the idea to
grow" (OVERVIEW §1). What was gained: a positive-sum loop, a data-driven
content pipeline, a real economy design, and a monetization story that isn't
"pay to kill better."

What was lost, and not replaced:

- **Stakes.** v1 had loss aversion — the strongest emotion in the game. v2's
  population is *monotonic by construction* (CORE_LOOP §1); nothing bad can
  ever permanently happen to your city. The research doc explicitly warns
  against this: "Don't remove conflict forever without replacing the sink.
  Missiles were a resource/cash sink *and an emotional stake*"
  (MARKET_RESEARCH §4). The replacement (trade wars, weekly leagues) is
  deferred to "Later."
- **Multiplayer itself** — the pivot's quiet second pivot. OVERVIEW §3 still
  says a home city is "shared with every other player who chose it"; CORE_LOOP
  §0 states flatly "each city is driven by exactly one player. Bots are
  stand-ins for absent players." The shipped prototype is you plus ~190 bots
  in localStorage. v1, whatever its flaws, was genuinely live multiplayer; v2
  currently is not, and no doc reconciles the claims. This contradiction is
  upstream of every other design decision, including the planned
  `LiveGameClient` backend.

## 3. The core loop (click = tick, input gating, happiness valve)

**Strengths.** `CORE_LOOP.md` is exemplary as a mechanics spec — precise
formulas, worked examples, clean role separation ("cash grows the city, clicks
run the factories"). Turning the click into a *decision* (where to spend it) is
the single best idea in the pivot. The stall rule (no banked work on missing
inputs, no burst-dump on restock) is thoughtfully anti-exploit. The visible
throttle meter replacing v1's silent drops is correct and validated by the
team's own research.

**Risks — the big one is self-inflicted.** The market-research doc's #1
finding, in bold, in its own verdict: "a clicker with a capped click rate and
*no offline/idle progression* contradicts the genre's main retention engine"
(P0 #1, "the single most damning gap"). `CORE_LOOP.md`, written *after* that
research, doubles down the other way: "nothing about the player's city changes
between clicks" (§0) — and never argues against the research; it simply
ignores it. Without idle accrual there is no "what did my city do overnight"
appointment hook, and every comparable the research cites (Cookie Clicker,
AdVenture Capitalist, War Clicks, Melvor) added an idle layer.

Other loop risks:

- **Knife-edge happiness valve.** Low happiness → 1 unit/click, but every
  working click still eats 1 flat food (CORE_LOOP §3) — a starving city can
  have negative food ROI per click (death spiral). Meanwhile the *current*
  tuning has the opposite failure: food is trivially net-positive, happiness
  pins at ~100, and the valve does nothing (confirmed empirically — see
  Part II §2). The mechanic only works inside a narrow band that the game is
  not currently in, and the deeper happiness sections that would widen it are
  parked behind `DEEP_HAPPINESS`.
- **Stall friction.** A hard-gated building that can't even be selected until
  supplied is honest economics but reads as "the game refuses my input." The
  new-player path out of a stalled tier-2 building is: understand the recipe
  graph → find the market → buy the input → return. That's a lot of friction
  for a genre whose core promise is "number goes up when I tap." The research
  itself validated 2–3-step chains (SCBI's depth); the design ships the whole
  10-tier graph with hard stalls and no auto-buy — Factorio-grade logistics on
  a one-button interface.
- **Multipliers break the food constant.** A 10× energy-drink click does 100
  units of work but still eats 1 food — payers get 10× output at 1/10 upkeep.
  Probably unintended; undocumented either way.

## 4. Economy & progression

- **Tier unlocks by population are circular.** Population = Σ worker amounts of
  buildings bought with cash; tiers unlock at population 1k/5k/20k/50k. So
  "population" is literally *cumulative cash spent on workplaces* — a spend
  meter, not a living statistic — and the headline scoreboard number measures
  purchasing, which paid multipliers accelerate. Monotonicity also means the
  leaderboard can only ossify.
- **The global market is the price-cap the research warned about.** An infinite
  source/sink whose spread bounds all player prices (OVERVIEW §5) is exactly
  what the research documents destroying price signaling in SimCity BuildIt
  (MARKET_RESEARCH §2), and v2 has no transaction fees and almost no designed
  sinks (no decay, no maintenance, no consumption beyond 1 food/click) — the
  inflation setup the research's P0 #3 warned about.
- **Bots as fake multiplayer: fine as scaffolding, hollow as a concept.**
  ~190 bots make the world look alive and let the market function, but
  "player-to-player gifting is real" in a world where every other player is a
  bot is a category error, and bot trading is admittedly "stochastic and
  lightly tuned." As "market intelligence" gameplay, bots can't sustain it —
  no meta to read, no rival psychology, no scarcity events.

## 5. Monetization (design §8)

Coherent and comparatively ethical on paper — visible throttle, tolerated
scripting, "automation buys comfort, not advantage," multipliers as the only
speed lever, real free gifting. Two cracks underneath:

1. **The paid autoclicker is the missing idle layer, sold for money.** Because
   the design refuses offline/idle progression, the "employee" that clicks for
   you *is* the genre's standard free retention mechanic, withheld and
   monetized. Ship idle baseline production and the SKU collapses — which
   tells you the SKU depends on a design gap.
2. **At the cap, the only differentiator is money.** The research says it
   precisely: with autoclickers tolerated, every active player converges on
   the cap, so the paid multiplier is the only edge left. Harmless while v2 is
   single-player; the moment `LiveGameClient` makes leaderboards real,
   10×/8-hour drinks are straight pay-to-win on the headline metric. The
   research's own answer (production-only boosts anchored on a membership,
   §6 Q4) is not reflected anywhere.

v1's subscription ($1.99/wk for 2× clicks + exclusive Atlas missiles, plus
resetting timed bests on renewal so payers can re-earn achievements) is plainly
pay-to-win in a destructive PvP game; v2 is a clear ethical upgrade.

## 6. Market positioning

`CITY_DESIGN_MARKET_RESEARCH.md` is genuinely good — adversarial, sourced,
willing to kill its own citations. But its verdict endorsed a design ("the
shared-city + voting layer is genuinely the design's strongest asset") that no
longer exists: voting was removed (OVERVIEW §6) and cities became single-player
(CORE_LOOP §0). That deletes both differentiators the research rated strongest
and leaves positioning resting on real-world geography (which the research
itself rates "identity glue, not retention") and the deep tech tree. Against
SimCity BuildIt (idle + social + events), War Clicks (idle + teams + the same
monetization), and Melvor (content breadth), the current v2 is "SCBI without
idle, without co-op, without events, on the web with no push channel." The
positioning was credible *as researched*; it is not credible *as currently
specified* unless the social/conflict layer returns.

## 7. Documentation coherence

Individually strong (CORE_LOOP.md and MARKET_RESEARCH.md are better than most
professional equivalents); collectively inconsistent:

1. OVERVIEW §3 ("shared with every other player") vs CORE_LOOP §0 ("exactly
   one player") — the central social premise contradicted by the authoritative
   spec.
2. MARKET_RESEARCH is stale post-voting-removal; nothing marks it superseded.
3. Research P0s #1 (idle), #3 (sinks), #4 (chat), #5 (contribution
   recognition), #6 (anti-multi) appear nowhere in the MVP scope or
   WHATS_NEXT — no acceptance, no rebuttal.
4. `ROADMAP.md` is a dead v1-only branch (energy meters, missile defenses,
   alliances, fantasy reskin) that ignores the pivot; nothing labels it
   historical. Same for `SPEC.md` vs `GAMEPLAY.md`.
5. Small but telling: OVERVIEW §2 still says "advance construction" though
   construction became instant-cash; §11 claims voting was "resolved
   (removed)" while the companion research argues it's the strongest asset.

---

# Part II — Implementation

## 1. v1 — Go backend + React client

**Strengths.** Clean, small, idiomatic Go: file-per-concern layout, Chi with
graceful shutdown, WAL + busy_timeout, dev/prod static split via build tags.
Migrations are versioned, transactional, idempotent. Rate limiting is a real
per-user token bucket with TTL eviction. The hottest paths are atomic where it
counts: `recordClick` is transactional with a correct
`highest_ever_population = MAX(...)` (db.go:191-199), and personal-best updates
use conditional `UPDATE ... WHERE < ?` (achievements.go:94-111). The hub is
mostly race-free, and spectator mode is well executed. `ws_test.go`'s three
real WebSocket integration tests are the best test file in v1.

**Security / exploits (the layer added after Phase 1 is where discipline
thinned):**

- **Missile double-fire race — damage duplication.** `fire_missile.go:49-51`
  checks `m.Fired` from an earlier read; the update at `fire_missile.go:102`
  has **no `AND fired = 0` guard** (confirmed in source). Two concurrent POSTs
  both pass and both apply damage — one Atlas III becomes N strikes,
  trivially scriptable.
- **Free, infinitely stackable Warrior.** `POST /api/subscribe`
  (subscription.go:176-196) has no payment gate or dedup; `renew` stacks time
  on the latest expiry with a +20% bonus, callable in a loop. Every player is
  a de-facto Warrior, so the Builder tier is untestable as designed.
- **Timed-achievement farm.** Subscribe/renew resets `best_10s`/`best_1day`
  (subscription.go:51,104) — click fast → Fast Finger missile → fire →
  re-subscribe to reset → repeat. Infinite missiles.
- **Sybil missile farming.** `/api/register` is unauthenticated and
  un-rate-limited; each throwaway account gets its own click bucket and a
  missile at 200 clicks (~2 min at the cap). No IP limit, captcha, or
  proof-of-work.
- Cookie lacks `Secure` (handlers.go:77-84); default `WS_ORIGINS="*"`
  disables origin checks. Click forgery itself *is* prevented (identity from
  the server-side cookie, rate-limited per user), and fire validation
  (ownership, range via haversine) is otherwise solid.

**Correctness bugs:**

- **Personal-clicks pipeline conflates city and personal totals.**
  `App.tsx:96-98` feeds `reconcile()` the *city* total; in any multi-player
  city "your contribution" jumps to the whole city's population and other
  players' clicks erase your pending optimistic clicks. Server-dropped clicks
  are never reconciled, so `pendingClicks` permanently inflates (client
  mirrors a 100/60s window; the server bucket is burst-10 at 1.67/s — they
  disagree at the margins).
- **Duplicate cumulative-achievement awards.** `checkAchievementsAfterClick`
  (ws.go:244-259) is read→compute→unconditional update; two tabs can both
  observe the old threshold and both award (achievements.go:47-49).
- **Daily clicks are in-memory and wiped on disconnect** (ws.go:71-77) — the
  "Relentless" achievement effectively can't be re-earned after a mid-day
  disconnect, and everything resets on server restart.
- **Stockpile counters drift**: `awardAchievementMissile` is four independent
  statements with errors ignored (achievements.go:56-90); `MAX(0, ...)` then
  hides desync. The world stockpile should just be
  `SELECT COUNT(*) FROM missiles WHERE fired=0`.
- **Kill accounting overshoots**: population floors at 0 but `total_dead` and
  attacker kills are credited the full rolled damage (fire_missile.go:109-116)
  — an Atlas on a 500-pop town records tens of thousands of "kills."
- **Daily-change % is frozen at snapshot time** (snapshots.go:44-60), not a
  rolling 24h window as GAMEPLAY.md specifies.
- Spec drift: achievement missiles ignore the role parameter and pick randomly
  from the whole Imp/Titan pool (achievements.go:56-65) vs GAMEPLAY.md's
  Builder→Imp / Warrior→Titan.
- **Scalability**: each click runs 5–7 SQLite statements synchronously in the
  read loop, then an O(N-clients) sequential broadcast with up to a 5s write
  timeout per slow client (ws.go:107-132) — one slow consumer stalls
  everyone's clicks. The hub pattern is missing its second half (per-client
  send queues).

**Design as implemented.** The loop is coherent and the pacing knobs sensible
(fast early achievements, geography-tied missile ranges is a genuinely nice
touch), but the economy is fundamentally asymmetric: clicking caps at ~6k
population/hour while a single Titan deletes 3k–7k and an Atlas 30k–70k, with
no defense mechanic, no cost to fire, and no retaliation beyond a toast. The
equilibrium is a griefing race to zero, with small cities pinned at 0.

**Tests.** Solid on Phase-1 basics (db, register/me validation, rate limiter,
WS integration). Entirely untested: `fire_missile.go`, `achievements.go`,
`click_missiles.go`, `subscription.go`, `snapshots.go`, `migrations.go`,
`geo.go` — i.e. the whole combat/monetization layer, exactly where the bugs
are. Client hook tests cover only the single-user happy path, which is why the
reconcile bug survives.

## 2. v2 — pure game logic (`web/src/game/`)

Status: 50/50 vitest specs pass; the balance harness passes and reports
192 cities, world pop 19,640 → 71,880 over 60 ticks, happiness min 91 /
median 100, cash min 0 / median 53.

**Strengths.** The layering genuinely holds — everything is React-free and
I/O-free, with injected randomness (`bots.ts` ctx.rand) and an injectable
clock (`throttle.ts`), which is exactly what makes the harness deterministic.
Defensive clamping in `market.ts` is consistent and correct. The generated
`catalog.data.ts` + hand-tuned `recipes.ts` overlay, validated at load by
`recipeOverrideProblems()` and asserted empty in tests, is a nice pattern.
Comments cite the design-doc sections they implement. The stall mechanic and
the clamped offer spread (player prices bounded by the game market, so P2P
trade can't be griefed with absurd prices) are standout designs.

**The one economy-breaking flaw.** `economy.ts:92-93` (confirmed in source):

```ts
for (const [r, qty] of Object.entries(def.inputs)) addInv(city, r, -qty)
for (const [r, qty] of Object.entries(def.outputs)) addInv(city, r, qty * b.level)
```

Outputs scale with building level; inputs don't. A level-5 blast furnace
consumes 2 Iron Bricks + 1 Coal and emits **5** Steel Alloys — every upgrade
multiplies conversion efficiency for free, directly contradicting the balance
note in `recipes.ts` ("processors consume a little more than they emit").
A leveled processor is a value printer: buy inputs at market, sell L× outputs.
A test (`economy.test.ts:98-102`) asserts this behavior, so it's
intentional-as-coded — but it undermines the entire recipes/market pricing
layer and makes "over-level one cheap building forever" the optimal strategy
instead of climbing the tree. Scale inputs (or work-per-batch) with level.

**Other correctness concerns:**

- **No `normalizeCity()` and no save version field.** `shop.ts` normalizes the
  operator but cities are loaded raw; a pre-`peakPopulation` save yields
  `undefined >= 0 → false` in `isBuildingUnlocked` (economy.ts:24), blocking
  **all** construction; a save missing `offers` crashes bot trading.
- **`addInv` clamps at 0 silently** (market.ts:7), so the harness's negative-
  inventory invariant can never fire — over-drafts mint goods instead of
  surfacing. A debug assert would catch real accounting bugs.
- **Monotonic population holds by construction but is asserted nowhere** — a
  future demolish/move feature could break it silently.
- **Bots ignore happiness** (bots.ts:22-24 feeds flat units) — bot difficulty
  is decoupled from the game's central feedback loop.
- Non-determinism leak: module-level `offerSeq` + `performance.now()` in
  "pure" `market.ts:39-43`; both reset per session while offers persist —
  cross-session offer-id collisions are possible.
- Shop wrinkles: using a 2× drink while a 10× is active silently destroys the
  10× (shop.ts:100, autoclickers correctly extend instead); the 6,000-Buck
  `TOP_ITEM_ID` exceeds `STARTING_BUCKS` (2,000), so the "gifting flourish"
  item is unreachable in the prototype.

**Balance findings (empirical, from the harness run):**

- **Happiness is saturated — the central dial is inert.** Min 91 / median 100
  across 192 cities: one crop-farm batch (4 clicks) yields 10 food units while
  eating 4, so food is trivially net-positive and everyone sits at max click
  effectiveness. The harness band (`> 50`) would pass a world stuck at 55 *or*
  100. The parked `DEEP_HAPPINESS` block that would re-pressurize it has an
  incompatible housing formula (happiness.ts:59-61 vs :125 — at pop == cap
  they score 1.0 vs 0.2), so "one-line flip" re-enablement isn't actually true.
- **The throttle is decorative for humans**: ~16.7 clicks/sec sustained cap is
  beyond human clicking; the visible meter will rarely move for real players
  (consistent with "comfort, not advantage," but worth knowing).
- **The harness measures a simpler game than players get**: the simulated
  player farms Grain only (`playerTarget()` returns `'crop-farm'`
  unconditionally, balanceHarness.ts:92-94) — stalls, recipes, and multi-step
  chains (the signature mechanic) are unmeasured; drink multipliers are never
  simulated. And the harness duplicates `MockGameClient.seed()` and the bot
  build-selection logic by copy-paste, so it can silently diverge from the
  shipped world — the exact failure mode a harness exists to prevent.
- **Bots run at subsistence** (cash median 53, min 0): almost no market
  liquidity, and any future upkeep cost would bankrupt the world.

**Tests.** `economy.ts` coverage is the star (12 focused cases including stall
semantics and mega-click remainder). Gaps: no `population.test.ts` (the
monotonicity-bearing module), `bots.test.ts` is a 26-line smoke test,
`cancelOffer`/drink-overwrite/air-ticket paths untested, and save migration
lives untested in `MockGameClient.load()` outside the pure layer.

## 3. v2 — client seam, React UI, PWA

**Strengths.** The `GameClient` interface is small, typed (discriminated-union
events), and singleton-wired so a `LiveGameClient` is a one-line swap on paper.
`useGameClient`'s handlers-in-ref pattern avoids stale closures. The mock is
orchestration-only over the pure layer, with deterministic FNV-1a seeding and
an autoclicker that shares the human `RateMeter` (so automation genuinely
can't out-click a human). Game-feel details are polished: globe auto-rotate
with idle pause, sound + haptics + particles on the GROW dial, milestone-driven
tutorial, update-prompt PWA flow, base-path handling for GitHub Pages.

**But the seam is behaviorally leaky — a real `LiveGameClient` could not drop
in today:**

- The UI requires the **full world in memory**: `leaderboard()`, `stats()`,
  and `getCity()` exist on the interface but are never called; `WorldReadout`,
  `Leaderboard`, and `TradePanel` all recompute world aggregates by scanning
  all ~190 full city objects client-side. A server would never ship that.
- The mock **mutates shared `City` references** and emits the same objects;
  React state holds objects mutated between renders. It works only because
  nothing uses `React.memo` — adding memoization would silently break updates,
  and a snapshot-sending live client would behave differently.
- `connectionState()` is polled twice at mount and never again; there is no
  `connection` event in `GameEvent`, so disconnects could never reach the UI.
- Synchronous event delivery is load-bearing (the dial's responsiveness
  depends on zero latency), and no async call site has a rejection path.

**Robustness / bugs:**

- **Persistence is the biggest gap for a deployed PWA whose only state is one
  localStorage key**: the entire ~190-city world is `JSON.stringify`'d every
  ~2.1s forever (tick always schedules a save, and the 600ms debounce is
  shorter than the 1500ms tick), there is no version field, no
  `normalizeCity` on load, no flush on `visibilitychange` (last ~2s of play
  lost when mobile kills the tab), and new seed cities never merge into
  existing saves.
- **Offline promise is broken**: the globe's earth/sky textures load from
  unpkg.com (Globe.tsx:173-174) with no service-worker runtime-caching rule —
  offline, the earth renders textureless. Bundle them like the atlas.
- **Everything re-renders on everything**: all state in `App`, a 1 Hz clock,
  6–12 city updates per tick, zero `memo` — react-globe.gl re-evaluates all
  ~190 points per click. Tolerable now; first thing to fix before adding
  features.
- Assorted real bugs: bot purchases of your offers draw no trade arc
  (bots omit `counterpartyId`, bots.ts:102); TradePanel's affordability check
  tests one unit's price but the buy is for `o.qty` with a silent partial
  fill (TradePanel.tsx:52); duplicate toasts on every player build; the
  throttle meter goes stale between clicks; the "your big buy gifted energy
  drinks to other cities" toast is a lie — no gifting code path exists
  (MockGameClient.ts:433-435); a stalled click emits a no-op `city_update`
  (full re-render per blocked click).
- **Accessibility**: collapsible panel headers are plain `div onClick` with no
  keyboard support; the onboarding overlay has no dialog semantics or focus
  trap; `index.html` sets `user-scalable=no` (WCAG 1.4.4 failure).

---

# Part III — Cross-cutting themes

1. **Core-first discipline, edge decay.** In both versions the first-built
   core (v1's click/WS path, v2's economy module) is careful and tested; the
   layers added later (v1 combat/subscriptions, v2 save migration/harness
   fidelity/shop edge cases) are where atomicity, tests, and balance were not
   carried through. The bugs cluster exactly where the tests aren't.
2. **The research → spec → prototype process is good; the artifacts stopped
   talking to each other.** Excellent market research was commissioned, then
   its verdict-level recommendations were silently dropped in the very next
   document. Decisions this consequential (no idle, no shared cities, no
   sinks) deserve an explicit argued rejection, not omission.
3. **Both economies have a value-printing flaw at their center**: v1 credits
   kills for population that never existed and lets Warriors be minted for
   free; v2 lets leveled processors create goods from nothing. Neither
   economy's headline number measures what it claims.
4. **Monetization keeps colliding with design gaps**: v1 sells power in a
   destructive PvP world; v2 sells the idle layer it refused to build. The
   ethical instincts in v2's §8 are genuinely better — the remaining problems
   are structural, not intentional.

---

# Part IV — Prioritized recommendations

## Concept (highest leverage)

1. **Decide what "multiplayer" means and write it down.** Shared cities
   (OVERVIEW §3) vs one-player-per-city with bots (CORE_LOOP §0) lead to
   different games — different backend, different anti-abuse, different
   social features. This contradiction is upstream of everything, including
   `LiveGameClient`.
2. **Adopt your own research's P0 #1: idle baseline production, clicks as the
   active boost.** It fixes retention, defuses the autoclicker-monetization
   ethics problem, makes "population = workforce" mechanically real, and
   neutralizes at-the-cap pay-to-win. If "no timers" stays, the docs owe an
   explicit argued rejection of the research.
3. **Give the economy stakes and sinks before any live launch**: market
   transaction fees, upkeep/maintenance as a deliberate sink, and a seasonal
   or catch-up mechanism so the leaderboard isn't cumulative-spend-forever.
   Reconsider whether "population" should be the scoreboard while it is
   arithmetically equal to spending.
4. **Restore conflict as economic warfare on a weekly cadence, sooner than
   "Later"** — weekly city-vs-city leagues on growth/happiness/trade volume,
   trade wars/embargoes (research P1 #8). Without it the title is false
   advertising for a solitaire city sim.
5. **Reconcile the doc set**: mark ROADMAP.md and SPEC.md historical; append a
   post-pivot addendum to MARKET_RESEARCH.md stating which P0s were
   adopted/rejected and why; fix OVERVIEW §2/§3 to match CORE_LOOP; document
   or fix the multiplier/food interaction.

## v2 implementation (the live product)

1. **Fix the input/output level-scaling asymmetry** (economy.ts:92-93) —
   scale inputs or work-per-batch with level. Highest-leverage economy change
   in the repo.
2. **Version the save and normalize cities on load**: `version` field in
   `SaveState`, a `normalizeCity()` mirroring `normalizeOperator()`, merge
   newly added seed cities, flush on `visibilitychange`, and only save when
   state actually changed.
3. **Make the balance harness measure the real game**: share seeding/build
   selection with `MockGameClient` instead of copy-paste, have the simulated
   player run an actual supply chain (and a drink run), tighten the happiness
   band so it catches saturation as well as collapse, and assert population
   monotonicity.
4. **Re-pressurize happiness** — retune `FOOD_UNIT_VALUE`/`FOOD_PER_CLICK` or
   flip a reduced `DEEP_HAPPINESS` (after reconciling the two incompatible
   housing formulas) so the game's central feedback dial actually moves.
5. **Make the seam honest before `LiveGameClient` exists**: UI consumes
   `leaderboard()`/`stats()` instead of full-world scans, a `connection` event
   in `GameEvent`, cloned snapshots instead of shared mutable references,
   rejection handling at every async call site — then `memo` the panels and
   bundle the globe textures so the offline promise holds.

## v1 implementation (if it is ever revived)

1. **Make missile fire atomic** (`UPDATE ... WHERE id=? AND fired=0` +
   `RowsAffected`) and apply the same conditional-update pattern to
   achievement thresholds; fold missile award into one transaction.
2. **Close the free-Warrior loop**: gate `/api/subscribe` behind even a stub
   payment token, dedupe active subscriptions, rate-limit `/api/register` per
   IP, and stop resetting timed bests on renewal.
3. **Fix the personal-clicks reconcile pipeline** (ack the clicking user's own
   totals; expire un-acked optimistic clicks).
4. **Decouple broadcast from the click path** (per-client buffered send
   queues, coalesced `city_update`s) — the single biggest scalability fix.
5. **Rebalance destruction vs growth** (cap kills at actual population lost,
   add defensive counterplay) before real players ever meet an Atlas.

---

## Verdict

A thoughtful project with an unusually strong process — real market research,
a rigorous loop spec, a deterministic balance harness, and a clean logic/UI
split most prototypes never achieve. v1 is a well-built Phase-1 core wearing
an exploitable, griefing-prone combat layer; v2 is the right pivot with three
load-bearing gaps: an economy bug at its center (level-scaled outputs), a
retention contradiction its own research flagged as fatal (no idle layer), and
a multiplayer identity crisis no document resolves. Fix those three and the
"clicks build a real city on a real globe" concept has genuine legs.
