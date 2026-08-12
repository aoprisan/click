# "Mine While You Walk" — the extracted concept, and game variants built on it

A brainstorm document. Walk Mode (`web/src/hooks/useWalkMode.ts` +
`web/src/steps/`) turned out to contain a design pattern that is bigger than
the feature. This doc names the pattern, states its invariants, and explores
what else can be built on it — both inside Global Conflict v2 and as
standalone game concepts.

## 1. The extracted concept

**Embodied idle input**: a real-world physical signal (steps) is converted
into the game's primary verb (the click) at a *fair, capped* rate, with
away-time *banked* and replayed as queued work.

What makes the implementation worth generalizing is not "steps make clicks" —
it's four invariants that keep it fair and swappable:

1. **Parity, not advantage.** Every step routes through the *same* throttle as
   a manual click (`RateMeter`). Walking earns *comfort* (hands-free play),
   never a higher ceiling. Activity classification (walking vs jogging) is
   flavor on the meter, never a multiplier — multipliers stay a shop item.
2. **Bounded banking.** Time away converts to progress, but capped
   (`BANK_MAX = 12_000`, a generous day's walk) and drip-fed at human cadence
   (`BANK_DRIP_MS = 250`, ~4/s). A 10k-step day is *queued work*, not an
   instant windfall — it lands like an employee shift, not a jackpot.
3. **An opt-in alternative input, never a replacement.** The GROW button stays.
   Players who can't or won't walk lose nothing.
4. **The seam.** Game logic never knows steps exist — a `StepSource` delivers
   `onStep()` calls, and the platform picks the source (accelerometer on web,
   OS pedometer in the native app). Swapping *what* physical signal drives the
   game is a one-interface change.

Shorthand for the rest of the doc: **signal → verb, at parity, banked and
bounded, behind a seam.**

## 2. Variants inside Global Conflict v2

Ordered roughly by how well they fit what's already built.

### 2.1 Prospecting expeditions (steps → discovery)
Make walking literally *mining*. With Walk Mode on, steps also fill an
**expedition meter**; every N steps completes a survey with a chance to
discover a new deposit of a country resource (the
`world_countries_game_resources.csv` axis), temporarily boosting your city's
extraction or unlocking a resource your country lacks. Clicks still do what
they do — the expedition is a *second, walking-only* output, but one that
yields variety, not rate, so parity holds (a clicker can buy the same
resource on the market; the walker just found it). Fits the fantasy directly:
you walk the earth, you find things in it.

### 2.2 Caravans on the globe (steps → distance)
The globe is already there, and v1 even has haversine (`geo.go`). Let the
player load a **caravan** with surplus goods and pick a destination city;
their real steps move it along the great-circle arc — visible crawling across
the 3D globe. Arrival trades at better-than-market spread (you did the
logistics), or delivers a gift to another player's city. Banked steps mean the
caravan kept moving while you were away, up to a day's march. This is the
strongest thematic variant: it makes walking *spatial* in a game that already
renders space, and it plugs into the existing market/gift economy
(`game/market.ts`) rather than adding a new one.

### 2.3 Citizens walk with you (steps → happiness)
Your walk feeds a small, capped **wellbeing** contribution to the happiness
formula (or, once `DEEP_HAPPINESS` unlocks, generates the fun/energy civic
goods). "Your citizens jog when you jog." Cheap to build, but it bends
invariant 1 — happiness scales click effectiveness, so walking would multiply
clicks indirectly. Only viable if the contribution is tiny and capped;
otherwise skip.

### 2.4 Step-powered energy (steps → a resource)
When the energy tier of deep happiness is unparked: steps generate the
`energy` civic good directly (human-powered turbines, pleasingly literal).
Same parity question as 2.3 — safe only if energy is also producible/buyable
at equivalent effort.

### 2.5 More sources behind the same seam
`StepSource` generalizes to `SignalSource`. Candidates, same contract
(live events + banked claim + permission-gated):
- **Sleep / rest** (screen-off overnight, or HealthKit sleep): banks a "rested
  city" morning bonus — bounded, dripped, cosmetic-leaning.
- **Cycling / workouts** (HealthKit/Google Fit): more banked "steps" per the
  same cap — activity variety, not a higher ceiling.
- **Coarse location change** (city-level, opt-in): traveling in real life
  discovers trade routes or discounts an air ticket (`game/shop.ts`).
- **Barometer / altitude**: climbing surveys mountain resources (ties into 2.1).
- **Weather** (one API call, no sensor): your real weather as globe cosmetics
  and a ±nothing flavor event ("rain in your city today").

## 3. Standalone game variants of the concept

Same pattern, different games — sketches, each one game-sized.

1. **The Bottomless Mine** — the concept played straight. Each step digs one
   unit deeper in an infinite vertical mine; strata and ores change by depth;
   cadence shows as drill RPM (display only). Banked steps are your crew
   digging while you're away — capped at one shift. Clicking also digs, at the
   same rate; walking is just the nicer way to do it. Prestige = collapse the
   shaft, keep the geology knowledge.
2. **Pilgrim** — steps advance an avatar along *real* historical routes
   (Camino de Santiago, the Tōkaidō, the Silk Road) drawn on a real map.
   Landmarks are story beats; banked steps mean the caravan kept walking.
   Calm, narrative, near-zero economy — the anti-clicker.
3. **Grove** — steps water and grow a persistent ecosystem (Forest-style
   commitment device, but an actual game: species unlock by cumulative
   distance, seasons by real calendar). Away-time doesn't bank — the grove
   *needs* you to walk today — deliberately breaking invariant 2 to make a
   habit game instead of an idle game.
4. **Stride & Dungeon** — a daily roguelike whose stamina pool *is*
   yesterday's steps, capped. You spend real-world walking as dungeon moves.
   Banking is the whole game; the cap is the difficulty knob.
5. **The Long Siege** — co-op: a guild's combined steps power a siege engine
   against a world boss. The parity cap is what makes contribution fair — a
   marathoner and a mall-walker both top out at the same per-day ceiling, so
   the guild wants *many* walkers, not one athlete.
6. **Cadence Line** — the one place cadence is allowed to matter: a rhythm
   game where you keep a train/beat running by holding a target steps-per-
   minute. Cadence is *gameplay* here, not a multiplier on an economy, so the
   fairness invariant doesn't apply.
7. **Ghost Walk** — race your own banked past self: yesterday's step
   timeline replays as a ghost pacing you today.
8. **Seeded by Footfall** — your day's walk (count + cadence signature) is
   the procedural seed for today's level. Steps as entropy, not currency.

## 4. Recommendation

For Global Conflict v2, the two variants that respect all four invariants
*and* use what's already on screen are **2.1 Prospecting expeditions** and
**2.2 Caravans** — both make walking spatial on a game that already renders a
globe, both output *variety* (resources, trade position) rather than *rate*,
so the parity invariant survives untouched. Caravans first: it needs no new
economy, just an arc on the globe, a distance ledger fed by the existing
`onStep`, and a market trade on arrival.

As a standalone spin-off, **The Bottomless Mine** is the purest expression of
the extracted concept and could reuse the entire `steps/` seam, the throttle,
and the banking logic as-is.
