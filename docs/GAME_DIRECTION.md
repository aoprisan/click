# Global Conflict — Direction Recommendation

*Synthesis of the implementation audit (June 2026), the v1-deepening roadmap
(`ROADMAP.md`), the v2 city-economy pitch (`CITY_DESIGN_OVERVIEW.md`), and its
market fact-check (`CITY_DESIGN_MARKET_RESEARCH.md`). This doc takes a position:
which direction to actually take, and in what order.*

---

## 1. The recommendation in one paragraph

Don't pivot to the full v2 build/trade/vote economy yet, and don't just bolt
more systems onto the war clicker. **Lean into the one thing this game has that
nothing on the market has: real-city rivalry on a live globe** — the
"Tampere vs Helsinki, Sibiu vs Bucharest" hook from the original SPEC.md that
v1's missile layer partially buried. Concretely: fix the four foundations that
block every direction (auth, payments, the silent rate limit, a re-engagement
channel), add the genre-mandatory idle layer, give cities a social substrate
(feed + contributor identity), then build the actual game on top: **weekly
city-vs-city and country-vs-country leagues with missiles kept as the
high-stakes endgame**, not removed. Adopt v2's economy pieces selectively and
late, gated on evidence — starting with construction votes (the cheapest,
highest-value piece), deferring the player market entirely.

## 2. Why this and not the alternatives

The repo currently contains two competing directions:

| | `ROADMAP.md` (deepen v1) | `CITY_DESIGN_OVERVIEW.md` (pivot to v2 economy) |
|---|---|---|
| Core bet | Energy/idle/upgrades make the war clicker sticky | Build/trade/vote economy replaces missiles |
| Strength | Builds on what's shipped; incremental | Strong social/collective hook; growth ceiling is higher |
| Weakness | More numbers on the same loop; doesn't answer "why do I care?" | Huge scope (market, transport, happiness, votes); unproven; three structural flaws per the fact-check |

The fact-check (`CITY_DESIGN_MARKET_RESEARCH.md`) is the tiebreaker, and it's
worth reading what it actually establishes:

1. **The best-evidenced retention levers are not the economy.** They are: an
   idle/offline layer (~18% DAU/MAU vs ~10.5% without), a social substrate
   (per-city chat/feed/identity — NationStates' real engine), a weekly
   competitive cadence (SCBI's Contest of Mayors, Township's Regatta), and a
   re-engagement channel (~3x retention). **Township passed $1B with no
   player-to-player trading at all** — the market is a differentiator, not a
   retention requirement.
2. **The v2 economy's hardest parts are its riskiest parts.** Player-driven
   markets need sinks, anti-multi enforcement, and guardrail tuning that killed
   eRepublik when done wrong — and this codebase has cookie-UUID auth with no
   passwords, which makes multi-accounts (and therefore vote capture and market
   manipulation) trivially free.
3. **Removing missiles removes the economy's best sink and the game's only
   emotional stake.** The fact-check itself concedes this (its answer to open
   question #1 was "don't delete the code").

Meanwhile the implementation audit says v1 is **feature-complete and clean**
(no TODOs, coherent design, tested) but **commercially inert**: payments are
fully stubbed, there is no account recovery, no push/email channel, no social
features of any kind, and the rate limiter silently eats clicks — the one
mechanic every player hits in their first minute reads as a bug.

So the honest assessment: **v1 is a finished prototype that proved the globe
and the click loop. Neither prior doc starts from what the audit shows is
actually missing.** The gap isn't depth (ROADMAP) or a new genre (v2) — it's
that there is no reason to come back tomorrow and no way to pay even if you
wanted to.

## 3. What's distinctive here (build around this)

- **Real cities on a live 3D globe.** Nobody in the clicker/idle space has
  this. The fact-check correctly calls geography a "weak moat" for retention
  by itself — but it's the identity glue, and identity is what the weekly
  league and city feed convert into retention.
- **Live multiplayer pressure.** `missile_strike` broadcasts to everyone,
  spectators included. Watching a strike land on the globe is the game's best
  moment and its built-in spectacle/virality surface. Double down: the globe
  should be worth watching even logged out.
- **The missile system is sunk cost in the good sense.** 9 types, range
  validation, click progression, strike broadcasts — all working. Repricing it
  as an economy sink with counterplay is cheap; rebuilding an equivalent
  emotional stake later is not.

## 4. The plan

### Phase 0 — Foundations (blocks everything; do regardless of direction)

1. **Real auth**: optional email on the existing cookie account (magic-link).
   This is account recovery, the anti-multi baseline, *and* the re-engagement
   channel in one feature. Cookie-only accounts remain fine for spectating and
   casual play.
2. **Real payments**: Stripe behind the existing `POST /api/subscribe` /
   `renew` endpoints. The subscription lifecycle (expiry worker, early-renewal
   bonus, role downgrade) already works end-to-end; only the charge is fake.
   Until this ships, every monetization debate is theoretical.
3. **Visible energy meter** replacing the silent token-bucket drop, per
   ROADMAP Phase 1 (the design there is solid and file-level; reuse it).
   Silent drops feel broken; a draining gauge feels like a rule.
4. **Web push + email digests** ("your city was struck", "Helsinki overtook
   Tampere overnight"). Browser games without a channel lose the D1→D7 war
   before any mechanic matters.

### Phase 1 — Retention core (the genre-mandatory layer)

5. **Idle production**: population generates a passive trickle while away;
   clicks are the active multiplier on top. Use ROADMAP's `economy.go` /
   `settleIdle` design (offline cap ~8h). This makes "what happened to my
   city overnight" the daily appointment — and it defuses the
   autoclicker-at-the-cap problem because the cap stops being the whole game.
6. **Per-city feed, then chat**: a scrolling feed of who clicked/struck/earned
   in your city is nearly free (the WS hub already broadcasts per-city
   events). This is the social substrate everything in Phase 2 needs.
7. **Contributor recognition**: per-city weekly leaderboard ("top builders of
   Rotterdam"), lifetime contribution on the city panel. Bridges v1's personal
   achievements into shared-city identity, and is the proven antidote to
   free-riding.
8. **City switching / migration** with a cooldown. Currently impossible; a
   player alone in a small town is stuck forever. Cheap migration is also the
   prerequisite for league fairness and (later) any vote mechanic.

### Phase 2 — The actual game: rivalry as the core loop

9. **Weekly city-vs-city leagues**: cities bucketed with ~comparable rivals,
   scored on growth (and later happiness/defense), with bragging-rights
   rewards and a Monday reset. This is the SCBI/Township weekly cadence
   applied to the game's native hook, it reuses `snapshots.go`, and it *is*
   the "city-vs-city competition without missiles" v2 deferred.
10. **Country aggregation**: country totals on the leaderboard and globe.
    Finland vs Sweden costs a GROUP BY and is the original spec's soul.
11. **Defense systems** (ROADMAP Phase 2: shields/interceptors) so missiles
    gain counterplay, plus **missile repricing as a sink**: firing should cost
    something the idle economy produces, not just reset a click counter.
    Keep missiles. They are the stake, the spectacle, and the sink.
12. **Seasons** once leagues prove out: archive standings, reset season
    counters (never lifetime stats), cosmetic rewards.

### Phase 3 — Selective v2 adoption (evidence-gated)

13. **Construction votes first**: clicks earn votes; each city runs a rolling
    poll on its next visible build (cosmetic/landmark at first — the
    `BuildingViz.tsx` block pyramid is sitting there waiting to be the thing
    you're collectively building). Capped, non-purchasable vote weight,
    residency tenure required — the fact-check's hard-won answers. This is
    v2's strongest piece at perhaps a tenth of v2's cost.
14. **Buildings/needs/happiness** only if the city feed + votes show players
    treat cities as shared property rather than parallel score counters.
15. **Player market: deferred indefinitely.** Revisit only with real auth,
    proven retention, and sinks in production. (Township precedent: it may
    never be needed.)
16. **Theming/spinoff layer** (ROADMAP Phase 4) stays on the shelf until the
    base game retains; a reskin of a game nobody returns to is two such games.

## 5. Monetization direction

Keep the subscription as the anchor (Warrior = permanent multiplier + click
missiles), add **timed boosts** as the consumable once energy exists, and
follow the fact-check's red lines: multipliers apply to *production only* —
never to votes, never to league scoring weight beyond what production itself
contributes visibly. Defer battle pass until events/seasons exist (P2 in the
fact-check). The realistic shape of revenue is the standard hybrid:
subscription + boosts now, pass later.

## 6. What I would explicitly *not* do

- **Full v2 pivot now** — scope and structural risks above; its best pieces
  are extractable (votes, happiness later) without betting the game.
- **Remove missiles** — they're the sink, the stake, and the spectacle.
- **More missile/achievement tiers on v1 as-is** — deepening a loop with no
  retention floor compounds the wrong thing.
- **Sell vote power or hard-cap market prices** — the two no-precedent /
  bad-precedent mechanics the fact-check flagged.
- **Ship any vote/governance mechanic before auth hardening** — with
  passwordless cookie accounts, polls are won by whoever opens the most
  incognito tabs.

## 7. Success gates between phases

- **Phase 0 → 1**: payments processing real charges; energy meter live with no
  complaint spike; push opt-in rate measurable.
- **Phase 1 → 2**: D7 retention moves vs pre-idle baseline (browser-game
  median ~7–8% is the bar to clear); city feed shows organic same-city
  activity clustering.
- **Phase 2 → 3**: weekly league participation >30% of WAU; players in
  contested league brackets retain better than uncontested ones (validates
  rivalry as the core loop before investing in governance).
