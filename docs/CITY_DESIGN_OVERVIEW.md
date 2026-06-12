# Global Conflict v2 — From Throwing Missiles to Building Cities

*Design overview — revised after Paul's review, June 2026. Incorporates his comments and inline edits; remaining open items are in §10.*

---

## 1. The pitch

V1 proved the core: a 3D globe of real cities, one-button clicking, and live multiplayer pressure is a game people actually play. But missiles are a dead end — they're zero-sum, they reward griefing, and there's nowhere for the idea to grow.

V2 keeps the engine and redirects it: **clicks stop destroying and start building.** Every click produces resources and advances construction. The scoreboard shifts from body count to the size, wealth, and happiness of your city. Same globe, same accounts, same click muscle memory — a new game on top.

What carries over from v1: the globe, real cities, accounts, achievements (driven by clicks), and population as the headline number. What's replaced: missiles and the kill economy.

## 2. A session (the core loop)

A 5–10 minute session looks like this:

1. **Check your city** — population, happiness, resource inventories, construction progress. What does the city need? What do we have in excess?
2. **Check the market** — what's cheap, what's expensive, where's the opportunity.
3. **Purchase something from the shop** (optional) — e.g. an energy drink or an autoclicker.
4. **Click to make progress** — operate buildings to produce resources, push construction forward.
5. **Trade** — sell surplus to the global market, or set your own prices on city resources for city-to-city trades.
6. **Spend the city's cash** — if the city can afford a building or upgrade, start it.

The biggest single change from v1 hides in step 4: **clicking gains a choice.** V1 had one button; v2 asks *where* to spend your clicks — which building to operate, which construction to push. Same effort, but now it's a decision. Steps 5–6 are what make it multiplayer rather than parallel solitaire: trading against other cities, and steering what your shared city builds next.

## 3. The city

Every player has a **home city** — a real city on the globe, shared with every other player who chose it. Any other city can be selected to inspect its status (population, happiness, what it's building, what it trades), which is both spectator content and market intelligence.

Each city has:

- **Population** — the headline stat, and also the workforce: population staffs buildings. Population is **not** the number of players; it is a direct function of the residential buildings in the city. Each residential building built brings a specific number of new population — that is how the city grows. (Each new residential building also creates extra requirements: more food, more energy, and so on.)
- **Happiness (0–100%)** — a weighted score across subsections: **housing, food, energy, employment, fun, luxuries**. At the start only housing and food count (50%/50%, everything else 0%). Subsections switch on at population growth triggers — e.g. at 1,000 population energy joins (weights 40/40/20); at 5,000 employment joins (30/30/20/20); and so on. Requirements get more sophisticated as the city grows, so there is always a next problem to solve. Specific products meet specific needs.
- **Resource inventory, buildings, and a cash account** — the city's shared economy, directed by its residents. Cash comes in from selling surplus on the market (and, later, taxes scaled by happiness).

**Clicks produce activity units.** One base, unmodified click = **10 units of activity**; everything a click does (production, construction) is denominated in units. Multipliers scale this — a 2× energy drink makes one click worth 20 units.

Two rules make the loop self-balancing:

- **Happiness scales click effectiveness, on thresholds.** At 90–100% happiness an unmodified click = 10 units of activity; at 80–90% it's 9 units; and so on down. An unhappy population works badly. Neglect needs and growth stalls; this is the valve that forces players to build a rounded city rather than one giant factory.
- **Residential capacity gates population.** Build housing → population grows → more workers (and more needs) → more production. This is SimCity BuildIt's proven engine, and it gives population a *cause* instead of v1's bare counter.

## 4. Buildings and production

Buildings require **workers, energy, and inputs**, and produce **outputs** — products that either meet population needs or feed other buildings.

- **Construction**: pay from the city's cash to start, then a set number of **activity units** (not clicks) to complete. Money is the gate; clicking is the work. Same pattern for **upgrades**, which raise output per activity unit.
- **Production chains come from data, not from a hand-trimmed MVP list.** The building catalog is the supply-chain tech tree in [`gamer_supply_chain_tech_tree.csv`](gamer_supply_chain_tech_tree.csv): 10 branches (Food & Population, Apparel & Textiles, Metallurgy & Construction, Energy & Power Grids, Mining & Resource Refining, Chemicals & Plastics, Electronics & Semiconductors, Computing & AI Infrastructure, Logistics & Fleet Transport, Pharma & Biotech) × 10 tech tiers each, every tier a building with explicit inputs → outputs, from Crop Farm up to 2026-era AI buildings. Since the chains are just data, there's no development cost to depth — allocate the map and see what happens.
- **Country-specific resources.** Each country has 3 starting resources, defined in [`world_countries_game_resources.csv`](world_countries_game_resources.csv) (196 countries). Cities can generate their country's resources from the start, so every city can produce and sell from day one.

## 5. Market

Cities specialize and trade surplus. Two layers:

- **The global market, run by the game.** A common market for **all** resources — infinite source and infinite sink. It buys low and sells high, with different upper and lower prices set by us for each resource. Cities can buy from and sell to it immediately. Because every country generates 3 different resources from the start, any city can start selling into the global market (sub-optimally) with **no dependency on city-to-city trade**.
- **City-to-city trading, priced by players.** Players can set and modify whatever prices they want to sell their city's resources. The global market's buy/sell spread de facto bounds these prices — undercut the game's sell price or beat its buy price and you have a deal — which creates a dynamic market for city-to-city trading without an unconstrained free-float economy.

Transport (capacity, mass, speed/cost tradeoffs) is **not in the initial version** — see §10.

## 6. Spending the city's cash — no voting

There is **no voting**. Players just need choices of different things to click — and to build. If the city has enough money, **any resident can spend it** on an available building or upgrade. The city is steered by whoever acts: individual effort, collective property.

Disagree with where your city is heading? **Vote with your feet** — use an air ticket and move to a city that builds what you believe in (§7).

A player's inventory stays personal (energy drinks, autoclickers, air tickets, achievements) while the city — its buildings, resources, and cash — is common property.

## 7. Cities and locations

- **City generation**: pick a set of cities per country — bigger countries get more cities — choosing each country's biggest-population cities. This gives both local rivalry (between cities in a country) and international rivalry.
- **Allocation**: new players are allocated to the nearest available city in their country, based on their real location.
- **Air tickets**: an air ticket allows a player to change their home city; one change per ticket. Every player gets **1 free air ticket** at the start of the game (in their inventory, usable anytime). Further moves require buying extra air tickets from the shop.

## 8. Monetization MVP

Everything purchasable is priced in a **hard currency** ("Bucks" or somesuch). Players buy hard currency with real money; all shop items below cost Bucks. No subscription — a battle pass is the more powerful mechanism, but more complex, so explicitly **not a v1 thing**.

- **Free play is throttled, softly**: clicks are capped at a maximum rate, shown as a visible meter (v1's silent rate-limit drops feel like bugs; a meter feels like a rule). The cap is **not a hard design constant — tune it from data**.
- **Energy drinks (click multipliers)**: a menu of discrete items, each a combo of **multiplier × duration** — multipliers 2×, 5×, 10×; durations 1 min, 5 min, 15 min, 8 hrs. Energy drinks are inventory items: players can stockpile up to a reasonable max (say 20), use them whenever they want, and each one is consumed on use. While active, each click produces and builds at the multiplied rate.
- **Autoclickers ("employees")**: an autoclicker is an employee who clicks for you — a monetization item, sold in a range of durations and prices.
- **Air tickets**: extra home-city moves (§7), sold in the shop.
- **Gifting**: players can gift energy drinks to each other. And when a player buys the highest-value item, the game automatically gifts a low-value item to some other players.
- **Scripting is explicitly tolerated.** External autoclickers can only saturate the same capped rate as a fast human — automation buys comfort, not advantage. The only way to go *faster* is multipliers. This is the genre's proven "pay for convenience" model, and War Clicks goes as far as selling autoclickers itself — which is exactly what the employee item does.

That's the whole monetization story at MVP. If it flies, the obvious next levers exist (battle pass, cosmetics, market fees, season passes) — deliberately out of scope here.

## 9. Why this should work — proven precedents

| Mechanic in this design | Proven by |
|---|---|
| Needs → happiness → growth loop | SimCity BuildIt (happiness drives population and income; top-grossing for years) |
| Housing capacity gates population | SimCity BuildIt |
| Click → multiplier → automation progression, pay-for-convenience | Cookie Clicker, AdVenture Capitalist, War Clicks |
| Game-run market maker bounding a player economy | eRepublik's crises show what unconstrained player economies do; an infinite-source/sink market maker is the guardrail |
| Real-world geography as the board | eRepublik; v1 of this game |

## 10. Scope

**MVP:** shared home cities generated per country (biggest cities, more for bigger countries) with nearest-city allocation and 1 free air ticket; residential-building-driven population; needs/happiness subsections with population growth triggers; pay-cash-then-activity-units construction and upgrades; production chains and country resources from the two data files (§4); game-run global market for all resources + player-priced city-to-city trading; soft click throttle tuned from data; hard-currency shop (energy drinks, autoclickers/employees, air tickets) with gifting.

**Later:** battle pass, transport (capacity/mass/speed-cost tradeoffs between cities), deeper tech-tree tiers and chain tuning, city-vs-city competition without missiles (trade wars, embargoes), seasons and leaderboards, alliances, further monetization (cosmetics, market fees).

## 11. Open questions

Resolved from the last round, folded into the body above: voting (removed — §6), small cities (allocation + air tickets — §7), multiplier shape (energy-drink matrix — §8), market guardrails (game-run global market — §5).

Still open:

1. **Missiles**: removed entirely, or preserved as a late-game conflict layer on top of the economy?
2. **Hard-currency price points**: Bucks pack sizes and item prices across the energy-drink/autoclicker matrices.
3. **Throttle numbers**: the click cap is data-driven — what's the starting value and how do we adjust it?
4. **Tech-tree launch scope**: the tree spans Crop Farm → 2026 AI buildings; which tiers are reachable at launch vs. unlocked later?
