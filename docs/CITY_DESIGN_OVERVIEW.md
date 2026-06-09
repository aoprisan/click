# Global Conflict v2 — From Throwing Missiles to Building Cities

*Design overview for discussion — not a spec. Draft for Paul's edit, June 2026.*

---

## 1. The pitch

V1 proved the core: a 3D globe of real cities, one-button clicking, and live multiplayer pressure is a game people actually play. But missiles are a dead end — they're zero-sum, they reward griefing, and there's nowhere for the idea to grow.

V2 keeps the engine and redirects it: **clicks stop destroying and start building.** Every click produces resources, advances construction, and earns votes in your city's future. The scoreboard shifts from body count to the size, wealth, and happiness of your city. Same globe, same accounts, same click muscle memory — a new game on top.

What carries over from v1: the globe, real cities, accounts, achievements (driven by clicks), and population as the headline number. What's replaced: missiles and the kill economy.

## 2. A session (the core loop)

A 5–10 minute session looks like this:

1. **Check your city** — population, happiness, resource inventories, construction progress. What does the city need? What do we have in excess?
2. **Check the market** — what's cheap, what's expensive, where's the opportunity. Plus any current offers on click multipliers.
3. **Click to make progress** — operate buildings to produce resources, push construction forward.
4. **Trade** — place buy or sell offers for resources.
5. **Vote** — spend votes earned by clicking on the poll for the city's next construction.

The biggest single change from v1 hides in step 3: **clicking gains a choice.** V1 had one button; v2 asks *where* to spend your clicks — which building to operate, which construction to push. Same effort, but now it's a decision. Steps 4–5 are new and are what make it multiplayer rather than parallel solitaire.

## 3. The city

Every player has a **home city** — a real city on the globe, shared with every other player who chose it. Any other city can be selected to inspect its status (population, happiness, what it's building, what it trades), which is both spectator content and market intelligence.

Each city has:

- **Population** — the headline stat, and also the workforce: population staffs buildings.
- **Happiness (0–100%)** — a function of population needs being met. Needs drift over time (food, then housing, then goods, then luxuries), so there is always a next problem to solve. Specific products meet specific needs.
- **Resource inventory, buildings, and a cash account** — the city's shared economy, directed by its residents. Cash comes in from selling surplus on the market (and, later, taxes scaled by happiness).

Two rules make the loop self-balancing:

- **Happiness scales click effectiveness.** An unhappy population works badly — every click produces less. Neglect needs and growth stalls; this is the valve that forces players to build a rounded city rather than one giant factory.
- **Residential capacity gates population.** Build housing → population grows → more workers → more production. This is SimCity BuildIt's proven engine, and it gives population a *cause* instead of v1's bare counter.

## 4. Buildings and production

Buildings require **workers, energy, and inputs**, and produce **outputs** — products that either meet population needs or feed other buildings.

- **Construction**: pay from the city's cash to start, then a set number of clicks to complete. Money is the gate; clicking is the work. Same pattern for **upgrades**, which raise output per click.
- **Production chains stay short at MVP** (2–3 steps): farm → food; power plant → energy; factory consumes energy + raw material → goods. Deep chains are proven (Anno, Virtonomics) but are a later layer, not launch scope.

## 5. Market and transport

Cities specialize and trade surplus. Each resource has an open buy/sell offer book; **prices are set by players, not by an algorithm** — the approach that makes Virtonomics and EVE Online durable. One guardrail at MVP: simple price bands per resource, because eRepublik showed that a fully unconstrained player economy without self-balancing mechanisms ends in crises that drive players out.

**Transport** is what makes the globe matter: moving goods between cities involves capacity, mass, and speed/cost tradeoffs (ship vs train vs plane), and distance is already computable from v1. At MVP, keep it to a flat delivery delay by distance; transport tiers are the most cuttable feature and should ship later.

## 6. Votes — collective development

Clicks earn **votes** (alongside resources). Each city runs a rolling poll: *what do we build or upgrade next?* Residents cast votes; the winner gets the city's cash and becomes the next click target.

This is the multiplayer glue. Shared stakes create strategy debate, factions, and identity ("we're making Rotterdam an energy hub") — and collective decision-making alone has kept NationStates players engaged for two decades. It also means a player's inventory is personal (votes, multipliers, achievements) while the city is common property: individual effort, collective direction.

## 7. Monetization MVP

- **Free play is throttled**: clicks are capped at a maximum per minute, shown as a visible meter (v1's silent rate-limit drops feel like bugs; a meter feels like a rule).
- **Players pay for click multipliers**: ×2, ×5, ×10 — each click produces, builds, and earns votes at the multiplied rate. Sold as timed boosts and/or permanent tiers (pricing TBD; v1's Warrior subscription can convert into a multiplier bundle).
- **Scripting is explicitly tolerated.** Autoclickers can only saturate the same capped rate as a fast human — automation buys comfort, not advantage. The only way to go *faster* is to pay for multipliers. This is the genre's proven "pay for convenience" model, and War Clicks goes as far as selling autoclickers itself.

That's the whole monetization story at MVP. If it flies, the obvious next levers exist (cosmetics, market fees, premium transport, season passes) — deliberately out of scope here.

## 8. Why this should work — proven precedents

| Mechanic in this design | Proven by |
|---|---|
| Needs → happiness → growth loop | SimCity BuildIt (happiness drives population and income; top-grossing for years) |
| Housing capacity gates population | SimCity BuildIt |
| Click → multiplier → automation progression, pay-for-convenience | Cookie Clicker, AdVenture Capitalist, War Clicks |
| Player-driven market with light guardrails | EVE Online, Virtonomics (works); eRepublik (what happens without guardrails) |
| Collective votes steering a shared entity | NationStates, eRepublik politics |
| Real-world geography as the board | eRepublik; v1 of this game |

## 9. Scope

**MVP:** home city (shared), 5–8 building types, 4–6 resources, needs/happiness, pay-then-click construction and upgrades, inter-city market with flat delivery delay, city construction poll, click throttle + paid multipliers.

**Later:** transport tiers, deep production chains, city-vs-city competition without missiles (trade wars, embargoes), seasons and leaderboards, alliances, further monetization.

## 10. Open questions for Paul

1. **Missiles**: removed entirely, or preserved as a late-game conflict layer on top of the economy?
2. **Vote weight**: one player one vote, or proportional to clicks contributed (paying players steer cities — feature or bug)?
3. **Small cities**: a player alone in a small town effectively plays solo — fine as a difficulty choice, or do we need migration/merging?
4. **Multiplier shape**: consumable timed boosts, permanent tiers, or evolve the existing subscription?
5. **Market guardrails**: fixed price bands at launch, or free float from day one?
