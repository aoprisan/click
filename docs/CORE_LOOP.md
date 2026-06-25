# Global Conflict v2 — Core Loop (population · housing · food · happiness · clicks)

*Authoritative mechanics spec, June 2026. Derived from design notes; refines
[`CITY_DESIGN_OVERVIEW.md`](CITY_DESIGN_OVERVIEW.md) §3–§4.*

> **Status.** **Implemented** in the `web/` prototype (June 2026). The numbers —
> worker amounts per tier (`catalog.ts`), food values (`civic.ts`), food-per-click
> (`happiness.ts`) — are first-draft and still to be play-balanced. The deeper
> happiness sections remain dormant behind the `DEEP_HAPPINESS` flag in
> `happiness.ts`. Balance follow-ups are in [`../web/WHATS_NEXT.md`](../web/WHATS_NEXT.md).

---

## 0. Foundational principle — the game is click-driven

**One click = one tick. There are no ambient game timers for the player's city.**
A click both *does work* (production / construction) **and** *advances state*
(food drops). Nothing about the player's city changes between clicks.

Each city is driven by exactly one player. Bots are stand-ins for absent
players; for a live-feeling planet they are **simulated on a background timer**
(the one exception to "no timers" — it animates the rivals, not the player).

## 1. Population = workers (and why it never goes down)

- Every **building and every upgrade level** carries a **fixed worker amount**.
  Workplaces (mines, farms, factories…) have worker amounts; **residential
  blocks have 0** — they are housing, not jobs.
- **Population `P` = Σ of the worker amounts of everything built**, across all
  buildings and their current levels.
- You never demolish, so this sum only grows. **Population is monotonic by
  construction** — it doesn't *choose* not to fall, it *can't*, because it is
  just the running total of fixed worker counts on buildings that never go away.
- Building and upgrading **workplaces** is therefore how the city's population
  rises. Population gates the tech tree (unlocks keyed off population).

## 2. Housing → the housing half of happiness

- **Housing `H`** = Σ capacity of all residential blocks.
- **Homeless** = `max(0, P − H)`.
- **Housing score** = `P > 0 ? min(1, H / P) : 1` — the fraction of the workforce
  that has a home. Building residential raises `H`; building workplaces raises
  `P` and can push people into homelessness until you build more housing.

## 3. Food → the food half of happiness (the only thing that drops)

- Each food good has a **unit value** (illustrative: wheat 10, bread 30, steak
  100, …). Actual values map onto `FOOD_GOODS` in `web/src/game/civic.ts` and are
  tunable.
- **Food owned `F`** = `Σ count(good) × value(good)`. *(3 wheat + 2 steak =
  3×10 + 2×100 = 230.)*
- **Each click consumes food** — "a worker is eating." **1 food unit per click**
  for now (flat; to be re-balanced), drained from the **cheapest good upward**
  (population eats its cheapest supplies first). Floors at 0.
- This is the **only** food sink — there is no ambient per-tick drain.
- **Food score** = `P > 0 ? min(1, F / P) : 1`.

## 4. Happiness = 50% housing + 50% food

```
happiness = 100 × (0.5 × housingScore + 0.5 × foodScore)
```

Deeper subsections from the broader design — **energy, employment, fun,
luxuries** — are **dormant for now**. They re-enter the weighting once the tech
tree is properly checked and balanced (see [`CITY_DESIGN_OVERVIEW.md`](CITY_DESIGN_OVERVIEW.md) §3).

## 5. Click efficiency is a direct function of happiness

The happier the workforce, the more a single click produces. **Units per click =
`f(happiness)`** — the existing ramp (1 unit at the bottom up to 10 units at
90–100%), times any energy-drink multiplier.

This is the self-balancing valve: let food run dry or leave workers homeless and
happiness falls, so **every click gets weaker and less gets built**. Food and
housing never *hard-block* clicking — they bite **through happiness**.

## The loop

```
click ─┬─→ produces units, scaled by happiness   (unhappy = wasted labour)
       └─→ eats 1 food                            (the only food sink)

food falls → food-happiness falls → weaker clicks      ← restock food to recover
build workplace → +workers (population); if P > H → homeless → housing-happiness falls
build residential → +housing → fewer homeless → housing-happiness rises
produce / buy food → F rises → food-happiness rises
```

## Worked examples (from the design notes)

**Housing.** Build a residential block (housing for 100, population still 0).
Build a mine: +50 workers; upgrade L2 +20, L3 +30 → 100. Do the same with a farm
→ **P = 200**, **H = 100**. Half the city is homeless → housing score `100/200 =
0.5` → contributes `0.5 × 50% = 25%` of overall happiness.

**Food.** Population 200. Stored food `F = 230` units → food score `min(1,
230/200) = 1` → the food half is full, 50%. Let it fall to `F = 100` → score
`100/200 = 0.5` → the food half is `0.5 × 50% = 25%`.

## Deferred / to re-balance later

- **Food per click** is flat 1; expected to scale (with workers active / output)
  once the economy is re-tuned.
- **Energy / employment / fun / luxuries** happiness sections return to the
  formula after the tech tree is balanced.
