# GLOBE — Game Design Document

**Working title:** *GLOBE* (alternatives: *Common Ground*, *Daylight*)
**Version:** GDD v1.0 — builds on `CITY_DESIGN_OVERVIEW.md` (concept) and `CITY_DESIGN_MARKET_RESEARCH.md` (evidence base).
**One-liner:** *The whole planet, building itself in real time. Pick a real city, work it with your own hands, and steer it together with everyone else who calls it home.*

---

## 0. Reading guide

Every system below is tagged **[MVP]** or **[Later]**, and where a design choice answers a research finding, the finding is cited inline as *(R: …)*. Numbers in §13 are first-pass tuning values, not commitments.

---

## 1. Vision & design pillars

The five pillars. Every feature must serve at least one; any feature that violates one gets cut.

1. **The globe is alive.** Day sweeps across a real planet; cities wake, work, and sleep in their real time zones. You can *see* the world playing from orbit. No competitor has this — it is the moat *(R: geography is an identity anchor, not a retention moat by itself — so we make it a mechanic, not a backdrop)*.
2. **Your hands matter, your absence doesn't punish.** The city works while you're away (idle baseline); your clicks are the *hero moments* on top *(R: no-idle clickers are viral fads; idle stickiness ~18% vs 10.5%)*.
3. **The city is ours, the credit is yours.** Everything the city owns is common property; everything you *did* is permanently, visibly yours *(R: free-riding is default; Foxhole's strike — uncredited collective labor breeds revolt)*.
4. **Money buys speed, never the steering wheel.** Paid boosts multiply production only. Votes cannot be bought, multiplied, or transferred — ever *(R: purchasable governance has zero successful precedent; DAO plutocracy; Diablo Immortal backlash)*.
5. **Nothing is destroyed, everything is spent.** Conflict-free doesn't mean stake-free: races, leagues, rivalries, and festivals burn resources and create winners. The economy always has more drains than the faucet fills *(R: UO faucet-drain; eRepublik's zero-marginal-cost collapse; EVE stagflation)*.

---

## 2. The frame: a planet with a clock

The single biggest innovation in this design, and it comes free with the globe we already render:

### 2.1 The Terminator **[MVP]**

The day/night line (solar terminator) is drawn live on the 3D globe. Cities in daylight glow and run at full idle output; cities at night dim to **60%** idle output and their windows light up. This is purely the *city's local time* — never the player's. Effects:

- The globe becomes a living dashboard: from orbit you watch the world wake up in a wave, west to east, forever. Spectator content that no screenshot of SimCity can match.
- It creates **regional play identity**: European players' cities boom during European hours. Your city's "workday" aligns with *your* workday, because you picked a city near you (or deliberately didn't — see Night Owls, §2.3).
- It is gentle (60%, not 0%) so no one is hard-punished for playing at their city's night.

### 2.2 The Dawn Relay **[MVP — the signature ritual]**

Once per real day, as dawn crosses each city, that city gets a **15-minute Dawn window**: clicks are worth **+100%** and the first 25 players present each plant a flag on the day's relay map. The bonus *carries momentum*: if a city's residents showed up for its Dawn, the *next* city west on the relay gets +10% on top, stackable up to +50% — dawn literally gathers strength as it sweeps the planet, handed from time zone to time zone by strangers.

- This is the game's daily appointment *(R: appointment mechanics are the cheapest D7 lever)* — but it's a **planetary, collective** appointment, not a lonely login calendar. "Don't break the relay" is a world-scale streak owned by everyone.
- A world-record counter tracks the longest unbroken relay (consecutive cities that hit their Dawn). Breaking the record is a global event with a feed moment.

### 2.3 Night Shift **[Later]**

Some buildings (§5) can be voted into **night-shift mode**: full output at night, but they consume Luxuries (overtime pay) and shave happiness. Lets hardcore cities run 24h at a real economic cost — a sink and a strategic identity ("Shenzhen never sleeps").

---

## 3. The player: Citizens, not clickers

Three modes, evolving v1's structure:

| Mode | Who | Can do |
|---|---|---|
| **Visitor** | unauthenticated | Watch the live globe, inspect any city, watch the Dawn Relay, **cheer** (free, rate-limited emote that briefly sparkles on the globe — a conversion hook, not an economy input) |
| **Citizen** | registered, free | Everything: work, build, trade, vote, migrate |
| **Patron** | paying (§11) | Citizen + production multipliers, comfort features, cosmetics. **No extra votes.** |

**Identity:** every Citizen has a passport — home city, citizenship date, career level (§9), titles, and a contribution ledger. v1 accounts carry over with achievements intact; v1 Warriors are grandfathered into 3 months of Patron.

---

## 4. The city

Each real city (GeoNames data, carried from v1) that has at least one resident Citizen is **alive**. A city has:

- **Population** — headline stat *and* workforce. Grown by building/upgrading Housing (capacity) *and* filled over time at a rate scaled by happiness *(R: SCBI — housing+materials gate population; happiness drives income, not population directly. We follow the verified mechanic)*.
- **Happiness (0–100)** — weighted fulfillment of the needs ladder (§4.1). Happiness multiplies **click effectiveness** and **tax income**. It does *not* directly shrink population (unverified in SCBI; punishing and opaque). Low happiness slows population *inflow* instead.
- **Treasury (cash)** + **warehouse (resources)** — common property, spent only by vote (§7) and automatic upkeep.
- **A skyline.** Buildings exist visually on the globe marker; growth is *seen* from orbit. Cosmetic landmark skins (§11) render for everyone — public proof of pride.

### 4.1 The needs ladder **[MVP]**

Needs unlock by population size, so there is always exactly one "current problem":

1. **Food** (from pop 0) — consumed continuously per capita. *This consumption is a designed faucet-drain, sized so a balanced city eats ~70% of its own food output* (R: needs system as deliberate sink).
2. **Housing** (pop 500+) — capacity, not consumable.
3. **Goods** (pop 2,000+) — consumed per capita, slower than food.
4. **Luxuries** (pop 10,000+) — consumed slowest, biggest happiness weight.

Happiness = weighted % of needs met over a rolling 24h. Display it as four meter bars, not a mystery number — players must always see *what to fix next*.

### 4.2 City Eras **[MVP-lite, expand Later]**

Cities advance through Eras at population thresholds (Village → Town → City → Metropolis → World City). Each Era unlocks buildings, needs, and one **Era choice** — a permanent specialization voted by residents (e.g., Town era: *Port* or *Junction* — cheaper sea or land logistics). Eras give shared long-term goals and make every city's build distinct. Era-up is a celebration event with fireworks (§8.4) and a global feed announcement.

---

## 5. Buildings & production

### 5.1 The work model: idle base + Shifts **[MVP]**

This is the heart of the redesign, fixing the research's most damning finding:

- **Idle base:** every staffed building produces automatically, 24/7 (×0.6 at night). Staffing comes from population. *The city always grows a little overnight; the morning check-in always has good news* (R: offline progression is the genre's retention engine).
- **Shifts (active clicking):** a player walks into a building and clicks to **work a shift**. Each click adds a unit of work; a shift bar (e.g., 50 clicks) fills, and completing it pays a **burst**: ~30 minutes of that building's idle output, instantly, plus personal XP and the player's name on the building's "shift log". Clicking *is* choosing where the city's effort goes — the concept doc's "clicking gains a choice", made concrete.
- **Overdrive:** completing 3 shift bars on one building within an hour puts it into Overdrive (+50% idle output for 2h, visible glow on the skyline). Coordinated groups can chain Overdrives — visible, juicy teamwork.

**The click meter** (free rate cap) is a visible stamina bar, refilling per minute *(R: silent rate-limit drops read as bugs — verified instinct from the concept doc, kept)*. Automation up to the cap is tolerated, *War Clicks-style*; at Career level 5 every player unlocks the built-in **Foreman** (auto-clicks at 70% of cap while the tab is open) so automation is a feature, not a cheat *(R: War Clicks sells exactly this; caps + tolerated autoclickers means everyone reaches the cap — which is fine here, because the cap is no longer the whole game; idle base and choice-of-where dominate)*.

### 5.2 Building roster **[MVP: 8]**

Chains are exactly **2 steps** deep at launch *(R: SCBI's depth is 2 levels; depth comes from time, not graph complexity)*. Every building has an input — **no zero-marginal-cost production exists anywhere in the game** *(R: eRepublik "Work as Manager" deflationary collapse)*.

| Building | Workers | Inputs | Output |
|---|---|---|---|
| Farm | low | Energy (small) | **Food** |
| Power Plant | med | Materials (small) | **Energy** |
| Quarry/Mine | med | Energy | **Materials** |
| Factory | high | Materials + Energy | **Goods** |
| Atelier | med | Food + Goods | **Luxuries** |
| Housing | — | Goods (upkeep) | population capacity |
| Plaza | low | — | happiness aura + festival venue (§8.4) |
| Depot | med | — | unlocks market access; each level cuts the city's trade fees |

**Construction & upgrades:** treasury cash starts the project (vote-gated, §7), then a large shared click-pool finishes it ("pay is the gate, clicking is the work" — kept from the concept). Contributors to a construction are permanently listed on the building's plaque; the top contributor names it (from a curated list) *(R: personal recognition for shared labor — the Foxhole lesson, made into a brag)*.

**Upkeep:** every building drains small upkeep (cash/Goods). Unpaid upkeep → building dims to 50%. This is the always-on cash sink and the decay mechanic for dying cities (§10).

---

## 6. Market & logistics

### 6.1 The exchange **[MVP]**

Open buy/sell order book per resource, **player-set prices, free float** — with two guardrails that are *not* price caps *(R: SCBI's hard caps destroyed price signaling; Township passed $1B with no trading at all — the market is a differentiator, not a launch-blocker, so it must not be able to poison the game)*:

1. **Fees as the stabilizer:** listing fee (0.5%, burned) + transaction tax (3%, burned; reduced by Depot level). These are the primary cash sinks *(R: EVE's broker fee + sales tax model)*.
2. **Bands as tripwires, not walls:** orders priced outside ±5× the 7-day rolling median are *allowed* but flagged to the anomaly queue (anti-multi enforcement, §12). Bands detect abuse; they never block price discovery *(R: OGame/Travian bands are anti-collusion tools enforced by bans, not price stabilizers)*.

### 6.2 Logistics **[MVP-lite]**

Goods take real time to arrive: delivery delay = f(haversine distance) — the v1 `geo.go` code reused. Coastal↔coastal routes are 25% faster ("sea lanes") so the map matters immediately. **[Later]** transport tiers add *capacity and risk*, not just speed — chartered convoys with insurance choices, seasonal storms closing routes *(R: Screeps' cost-only friction produced dull neighbor-trade; EVE's hauling is engaging because something is at stake)*.

### 6.3 Sister Cities **[Later]**

Two cities can vote to twin: a standing trade route with halved fees and a shared feed channel. Diplomacy primitive — and the seed of trade blocs, embargoes, and economic rivalry (the conflict layer that replaces missiles).

---

## 7. Governance: the Town Hall

The multiplayer glue, redesigned around every governance failure in the research.

### 7.1 Civic Voice **[MVP]**

- You earn **1 Voice per active day** in your home city (any meaningful action), stockpile cap **7**. Voice is *flat per day* — not per click, not per dollar *(R: contribution-weighted voting → plutocracy; the concept doc's "votes earned by clicking" + paid multipliers would have let Patrons buy city control — severed completely, per pillar 4)*.
- Spending more Voice on one option = louder, with **quadratic pricing**: 1 Voice = 1 point, 4 = 2 points, 9 = 3 points. Passion costs, whales can't dominate, and stockpiling for a decisive vote is a real (but bounded) strategy.
- **Tenure:** voting in a city requires 3 days' residency; a migration cooldown (§10) backs this up *(R: eRepublik's documented "political takeover" meta; r/place brigades organize off-platform — assume Discord raids will happen and make them slow)*.

### 7.2 The rolling ballot **[MVP]**

Each city always has one open ballot (24–48h): *what do we fund next?* Options are auto-generated from valid choices (affordable constructions/upgrades, policy toggles) — **[Later]** the elected Planner curates the slate. Winner gets the treasury allocation and becomes the city's pinned click target. Results post to the city feed with voter counts (not identities).

### 7.3 The Planner **[Later]**

A weekly elected role (1-citizen-1-vote, two-term limit): curates ballot slates, sets one "city priority" buff (+10% to one building class), writes the city motto. Deliberately weak — a megaphone, not a throne. *(R: A Tale in the Desert shows player governance can work for decades at niche scale; EVE's CSM shows organized blocs win elections anyway — so the prize for capturing it must be small.)*

### 7.4 Policies **[Later]**

Votable sliders with teeth: tax rate (income vs happiness), night shift (§2.3), open/closed migration, festival budget. Policies are where city identities ("low-tax trade haven" vs "high-happiness fortress") become real.

---

## 8. Competition without missiles

Four layers of stakes, replacing the kill economy. All of them are resource **sinks** (pillar 5).

### 8.1 The World League **[MVP]**

Weekly league of cities in divisions of 10, matched by Era/size *(R: SCBI Contest of Mayors / Township Regatta / FoE weekly cadence is the proven city-builder rhythm)*. Score = blend of population growth %, average happiness, trade volume, and shift participation breadth (rewards *many hands*, not whale cities). Monday promotion/relegation with division banners on the globe marker, treasury prizes, and personal tokens for every participating resident. Uses v1's daily snapshot machinery.

### 8.2 Wonders **[Later — the endgame]**

Era-V cities can bid to build **Wonders** — unique, planet-singular megaprojects (the Atlas Spire, the Pan-Oceanic Garden). Only one of each exists *per world*. Construction consumes colossal resources (the great late-game sink) and months of shifts. Finished Wonders are permanent monuments on the globe with the builders' names — geography-scale prestige. Wonder races are the trade wars' engine: rival cities bidding up Materials prices is conflict, expressed economically.

### 8.3 Rivalries **[Later]**

A city may declare one **Rival** (mutual or one-sided): head-to-head weekly scoreboard vs that specific city, feed trash-talk channel, bonus league points for beating them. Lightweight, opt-in, zero-destruction conflict.

### 8.4 Festivals & Fireworks **[MVP-lite]**

A city can vote to throw a **Festival**: burns a chosen pile of Luxuries/Goods → timed happiness boost + a visible party at the Plaza on the globe. Pure celebratory sink. And the migration path for v1's arsenal: **every leftover v1 missile converts into Festival Fireworks** — the old weapons literally become the new party. One-time, thematically perfect, and it honors veterans' stockpiles instead of deleting them.

---

## 9. Personal progression

The shared city must never eat the personal game *(pillar 3)*.

- **Career [MVP]:** account-level XP from any action → Career levels → titles (Apprentice → Foreman → Engineer → Architect → Luminary), meter capacity bumps, Foreman unlock (L5), cosmetic frames. Career is global — it survives migration.
- **Ledger [MVP]:** permanent personal record: shifts worked per city, constructions plaqued, Dawn flags planted, votes cast, league medals. Public on the passport.
- **v1 achievements carry over [MVP]** and the achievement system (computed, not stored) keeps working — new achievement families for shifts, trades, votes, relays.
- **Legacy [Later — the prestige answer]:** a *personal, optional* reset: retire your passport to "Emeritus", convert career into permanent +X% personal XP and a statue in your home city's Plaza, start a fresh career. The city is never reset — only *you* are *(R: prestige is proven but optional — Melvor thrives without it; a shared persistent world can't reset, so prestige must be personal)*.
- **Daily Orders [MVP]:** 3 light daily tasks drawn from real city needs ("work 2 shifts at the Farm — food is at 40%") + a 7-day streak chest. Two tasks max from any one system, 10-minute completable *(R: daily quests ≈ +25% DAU retained at D30; academic warning about "feels like a job" — keep it tiny)*.

---

## 10. Living world hygiene: migration & dying cities

- **Migration [MVP]:** moving home city is free, with a 7-day cooldown and tenure reset (§7.1). A player alone in a small town is a *difficulty choice* only because leaving is cheap *(R: open question #3 answered)*.
- **City decay [MVP]:** with zero active residents, upkeep goes unpaid → buildings dim → after 30 days the city goes **Dormant**: skyline grays out, treasury frozen, a "Refound this city" beacon appears (first 5 settlers get a Founder bonus + plaque). Ghost towns become *opportunities*, not litter *(R: Wurm Online garbage-collects lapsed deeds; CoC rotates dead leadership)*.
- **Heritage:** a refounded city keeps its history — old plaques, old Wonder progress at 50%. Cities remember.

---

## 11. Monetization

Pay for speed and style. Never for steering. *(R: conversion ~1–5%, whales 50–70% of revenue; hybrid sub+consumable is the standard; one SKU is too thin.)*

| Product | Shape | What it does |
|---|---|---|
| **Citizen's Pass** [MVP] | subscription (evolves v1 Warrior) | ×2 personal shift output, Foreman runs at 100% of cap, +2 Daily Order rerolls, passport flair, monthly cosmetic. **Zero Voice impact.** |
| **Boosts** [MVP] | consumable | ×5 shift output for 1h. Personal production only. |
| **Cosmetics** [MVP-lite] | one-time | Landmark skins, statue styles, flag designs, firework patterns — rendered on the globe for everyone (status is social, supply is infinite, economy untouched). |
| **Season Pass** [Later] | seasonal | Free + paid track over the League season; rewards are cosmetics/boosts/XP, gated on play not payment *(R: passes monetize more than they retain; needs events tooling first — deferred)*. |

The free click meter stays generous enough that an unpaid active citizen is always a *welcome* contributor, never dead weight: free players fill shift bars, plant Dawn flags, and vote with identical Voice. **The ceiling on paid advantage is explicit: a Patron is worth at most ~2 free players' production and exactly 1 free player's vote.** Print that sentence in the store UI — it's the trust contract *(R: Playsaurus's ethics critique; the backlash literature)*.

## 12. Anti-abuse **[MVP — not optional]**

The research's bluntest lesson: eRepublik died of multis before it died of anything else, and v1's passwordless cookie auth is a multi factory.

- **Identity hardening:** optional email attach (doubles as account recovery and the re-engagement channel — web push + email digests: "your construction finished", "Dawn in 20 minutes", "the ballot closes tonight" *(R: push ≈ 3× retention, correlational but the only channel web has)*). Voice and market access above small limits require an attached, verified contact.
- **Anomaly queue:** band-tripwire trades (§6.1), same-IP vote clusters, click-pattern twins → human review → bans. Budget moderation time from day one.
- **Tenure + cooldowns** (§7.1, §10) make brigading slow; **quadratic Voice** makes it expensive; **division matchmaking by Era** makes farming small cities pointless.
- **Economic observability:** an auto-published per-city and global **Economic Report** (faucets, sinks, money supply, median prices) — players self-police with data, and we retune sinks continuously *(R: EVE's MER; inflation is never solved, only managed)*.

---

## 13. First-pass numbers (tune in beta)

- Click meter: 100 clicks / 60s refill (v1 parity); Foreman 70 cps-equivalent of cap.
- Shift bar: 50 clicks → burst = 30 min of building idle output. Overdrive: 3 bars/hour → +50% for 2h.
- Night idle factor 0.6; Dawn window 15 min, +100% clicks, relay momentum +10%/city, cap +50%.
- Needs consumption sized to absorb ~70% of a balanced city's Food output, ~50% of Goods, ~30% of Luxuries.
- Market: 0.5% listing (burn), 3% transaction (burn), Depot −0.3%/level (floor 1%).
- Voice: 1/active day, stockpile 7, quadratic spend. Tenure 3 days, migration cooldown 7.
- Happiness: click effectiveness ×(0.5 + happiness/200) → range ×0.5–×1.0; tax bracket 0–20% stepped at 50/70/90 happiness (SCBI-verified shape).
- League: divisions of 10, Mon–Sun, score = 0.4·growth% + 0.25·avg happiness + 0.2·trade volume + 0.15·participation breadth.

## 14. MVP scope (build order)

**Phase 1 — the living city:** city model + needs/happiness, 8 buildings, idle base + shifts + meter + Foreman, construction click-pools with plaques, terminator on globe, migration, decay/Dormant, anti-multi basics, v1 account/achievement migration, missiles→fireworks conversion.
**Phase 2 — the living world:** exchange + fees + tripwires, flat-delay logistics, Civic Voice + rolling ballot, city feed + cheers, Daily Orders + streak, email/web-push.
**Phase 3 — the heartbeat:** Dawn Relay, World League, Festivals, Citizen's Pass + boosts + first cosmetics, Economic Report.
**Later:** Planner & policies, Sister Cities & rivalries, Wonders, transport tiers, Night Shift, Legacy, Season Pass, Eras beyond Town.

## 15. Open design risks

1. **Dawn Relay cold-start:** with few players, relays break constantly and the ritual reads as failure. Mitigation: at low population, relay counts *regions* (continental bands) instead of cities; tighten to cities as DAU grows.
2. **Shift-burst inflation:** bursts are a faucet multiplier; if tuned hot, active cities runaway. The Economic Report exists to catch this in week 1, and burst size is a server-side constant.
3. **Voice apathy:** flat daily Voice assumes people vote. If ballots stagnate, add Voice expiry (use it or lose it past the 7 cap) before adding incentives — paying people to vote invites farming.
4. **Globe performance** with per-city skylines/terminator on low-end devices — budget a flat 2D fallback early.
5. **The name.** "Global Conflict" no longer describes the game. Decide branding before Phase 3 marketing, not after.
