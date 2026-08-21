# Walk-and-Click Spinoffs — five concepts

Five spinoff ideas that keep this game's core pairing — **clicking as the action,
walking as the fuel** — and aim it at getting kids moving. All five inherit the
same technical spine already built in `web/`:

- **The step-source seam** (`src/steps/`): web `DeviceMotion` detection vs. the
  native OS pedometer, selected per platform, so steps count even while the app
  is closed (native).
- **The throttle** (`game/throttle.ts` + `useWalkMode`): every step fires the
  same rate-capped action a click would — walking is never a cheat code, and
  banked away-time steps drip in at walking pace (`BANK_DRIP_MS`), so a big
  walk is *queued play*, not an instant windfall. That drip is the key kid
  mechanic: **movement earns future play time**.
- **The client seam** (`GameClient` / `MockGameClient`): each spinoff is a
  different world sitting on the same tick + persistence + bot machinery.
- **The CSV catalog** (`game/config.ts`): content — creatures, trails, plants,
  missions — as data files, tunable without a rebuild.

The shared design inversion: in this game, walking is an *alternative* input to
clicking. In the spinoffs for kids, **walking is the primary resource and
clicking is how you spend it** — you can always click, but the tank only
refills with real steps.

---

## 1. Step Pets — a creature that runs on your walks

**Pitch.** A virtual pet whose energy *is* your step count. Walking fills the
pet's energy meter; clicks spend it — feed, groom, train, play fetch. A pet
that gets walked every day evolves; one that doesn't just gets sleepy and naps
(never dies, never guilt-trips — it perks up the moment you walk again).

- **Walk loop:** steps → pet energy (banked while the app is closed, exactly
  like today's banked steps). Cadence matters: the existing `ActivityMeter`'s
  walking/jogging classification becomes pet "moods" — jogging steps hatch
  rare eggs.
- **Click loop:** each care action costs energy and is throttled at today's
  click rate, so a 6,000-step day is a long, satisfying care session — not one
  mega-tap.
- **Movement hook:** daily-streak evolution. Three days of a modest,
  age-appropriate step goal evolves the pet; the goal auto-calibrates to the
  kid's own recent average (compete with yourself, not with fitter kids).
- **Reuse:** `useWalkMode` almost unchanged; the pet is a re-skin of the city
  (energy = stock, care actions = production batches); pet species and
  evolution tiers live in a CSV like the tech tree.

## 2. Trail Quest — walk the map, click the adventure

**Pitch.** A fantasy expedition where your caravan advances along a trail *only
by real steps* — 1,000 steps to the lighthouse, 5,000 across the Ember Pass.
Arriving at a waypoint unlocks a clicking scene: chop the bridge timber, mine
the cave, build the camp, then walk on.

- **Walk loop:** steps = distance. The trail map is the globe re-skinned as a
  fictional continent; the banked-step drip animates your caravan walking while
  you watch.
- **Click loop:** waypoint scenes are the existing input-gated production —
  each camp needs materials produced by clicks, and a missing input stalls you
  (so kids plan: "I need 800 more steps *and* 50 timber").
- **Movement hook:** distance framing makes movement legible — kids brag in
  landmarks ("I walked to the volcano!"), and chapter gates are walks a kid can
  actually do in a day. Optional "family expedition" sums household steps.
- **Reuse:** globe + city markers become trail + waypoints; `seedCities` seeds
  the trail; trails/waypoints/costs are a CSV campaign file, so new chapters
  ship as data.

## 3. Garden World — steps are the weather

**Pitch.** A co-op gardening game: your steps are the garden's sunshine and
water. Clicks plant seeds, pull weeds, and harvest; walking is what actually
makes things grow. A classroom or family tends one shared plot.

- **Walk loop:** steps convert to "sun" (live steps) and "rain" (banked steps)
  — two resources from one pedometer, using the live-vs-banked split that
  already exists. No steps, no growth; plants pause (never wilt to death).
- **Click loop:** planting and harvesting are instant purchases (today's
  build/upgrade path); tending is throttled clicks. Harvests feed a village
  that visibly flourishes — the same happiness-scales-effectiveness loop.
- **Movement hook:** *collective* growth. Everyone's steps water the same
  garden, so the kid who walks least still sees their steps matter, and the
  class goal ("10 million steps blooms the cherry orchard") makes recess a
  team event. Leaderboards are gardens-vs-gardens, never kid-vs-kid.
- **Reuse:** `MockGameClient` bots become neighboring gardens; plant species =
  buildings CSV; growth curves = tuning knobs; the market becomes a seed-swap
  between gardens.

## 4. Rescue Runners — walking powers the missions

**Pitch.** Kids run a rescue-and-delivery service in a storybook town. Walking
charges the delivery dragon (or van, or sled); clicking packs the parcels,
plots the route, and completes the drop. Missions are sized as "walk windows":
a recess, a walk to school, a Saturday-morning loop.

- **Walk loop:** steps → charge. Missions declare their cost up front ("the
  lighthouse run needs a 1,200-step charge"), so kids choose a walk to match.
  Background banking means the walk to school *is* the mission prep.
- **Click loop:** packing is recipe production (a med-kit = bandages + water,
  from the recipes system); dispatch and unlocking new districts are instant
  purchases. Completed missions rebuild the town, block by visible block.
- **Movement hook:** urgency without punishment — a mission never fails from
  not walking, it just waits, and "streak contracts" (three school-walk
  deliveries this week) earn cosmetic badges rather than power.
- **Reuse:** missions are market orders (`market.ts` offers re-themed as
  delivery contracts); districts are tech tiers unlocked by cumulative steps
  instead of population; town state persists via the same save path.

## 5. Playground Leagues — the class builds a city with its feet

**Pitch.** The closest spinoff to this game: the city-builder itself, but a
*team* city. A class, club, or family is one city; every member's banked steps
flow into a shared step treasury, and each kid spends their own contribution
via clicks on the projects they care about — one kid grows the farms, another
the observatory.

- **Walk loop:** each kid's device banks steps (the native pedometer path);
  contributions sync when they open the app. Individual counts stay private —
  the city only shows team totals and each kid's *own* contribution to them.
- **Click loop:** unchanged from today — buildings, recipes, stalled inputs,
  markets — but purchase costs are priced in team steps, so the economy runs
  on collective movement.
- **Movement hook:** league seasons between anonymous rival cities (this
  week's rivals are bot-or-real, indistinguishable by design). Team framing is
  the safety feature: no individual kid is ever ranked, named, or located, and
  a season reset every few weeks keeps late joiners competitive.
- **Reuse:** this is `MockGameClient` evolved into the planned
  `LiveGameClient` — the first genuine use of the client seam, with bots
  backfilling leagues so a lone classroom still has rivals.

---

## Designing for kids — rules all five share

- **Movement is the fuel, never the punishment.** Not walking pauses progress;
  it never destroys it. Pets nap, plants pause, missions wait.
- **Compete with yourself or as a team.** Step goals calibrate to each kid's
  own baseline; public comparison is only team-vs-team. No individual step
  leaderboards — they reward the already-active kid and shame the rest, and
  they leak health data.
- **No location, no strangers.** The pedometer counts steps; it never needs
  GPS. No free-text chat — trades and gifts use fixed, friendly phrases.
  (COPPA/GDPR-K: steps are the only sensor, stored locally like `gc.save.v1`,
  synced only as team aggregates.)
- **The throttle is the ethics.** Capping conversion at walking pace (the
  existing `BANK_DRIP_MS` drip) means there's no incentive to shake the phone,
  strap it to the dog, or grind — a day's honest walking is a day's play.
- **Session-bounded by design.** When the banked tank is empty, the game
  gently says "go bank some more steps" — the stopping point is built in,
  which is the anti-dark-pattern parents will actually notice.
- **Accessibility fallback.** Kids who can't walk (injury, wheelchair, no
  device at recess) get an equivalent input — timer-based "activity minutes" a
  parent can grant, or wheelchair-push detection where the OS supports it —
  at the same throttled rate, so nobody is locked out of the fun.

**Which first?** Step Pets is the smallest build (one screen, no map, maximal
emotional pull) and the fastest way to test the core bet — that banked steps
dripping into play time actually changes how much a kid walks. Trail Quest is
the strongest fit for what's already built (globe, waypoints, input-gated
production). Playground Leagues is the long-term one — it's the existing
roadmap's multiplayer step, aimed at schools.
