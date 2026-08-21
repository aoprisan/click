# Native Android / iOS rewrite — assessment

*Question assessed: rewriting Global Conflict v2 as fully native apps — **one
codebase per platform** (Kotlin/Compose on Android, Swift/SwiftUI on iOS) —
replacing or paralleling the current Capacitor-wrapped web app.*

## Verdict

**Not now.** A per-platform native rewrite roughly triples the codebase
(web + Android + iOS) for a game whose design is still first-draft, and the
one capability that motivated going native — banking steps while the app is
closed — is **already solved** by the existing Capacitor plugin (hardware
step counters, no background service). Estimated cost is **4–8
engineer-months to reach feature parity**, after which every gameplay or
balance change lands three times. If true native becomes a hard requirement,
the cheap path is to **build the planned Go backend first** (WHATS_NEXT §9–10)
so native clients are thin UI shells, or to share one simulation via Kotlin
Multiplatform. Details below.

## 1. What exists today (measured)

| Layer | Size | Notes |
|---|---|---|
| `web/src/game/` — pure simulation | **2,149 LOC** TS | economy, happiness, population, market, bots, shop, throttle, tuning, catalog + CSV pipeline, recipes, civic, seeding, balance harness |
| Tests | **1,067 LOC**, 50 specs | vitest; includes the deterministic balance harness (`npm run balance`) that has already caught a population-wipe bug |
| `web/src/client/` — the seam | **627 LOC** | `GameClient` interface + `MockGameClient` (tick loop, bot scheduling, `localStorage` persistence, event bus) |
| UI (`components/` + `App.tsx`) | **~1,700 LOC** TSX + CSS | ~15 panels, tutorial/onboarding, toasts, config panel; three.js globe via `react-globe.gl` (~2.8 MB chunk) |
| Hooks / steps / misc | **573 LOC** | Walk Mode, PWA update, step-source seam |
| **Native code already written** | 202 LOC Java + 84 LOC Swift | `PedometerPlugin` both platforms: hardware `STEP_DETECTOR`/`STEP_COUNTER` on Android, `CMPedometer` on iOS — live steps **and** steps banked while the app was closed |
| Tooling | — | Capacitor 8 wrappers for both platforms, local `xcodebuild` scripts, Android APK in CI, Pages deploy of the PWA |

The web PWA on GitHub Pages is the shipped product; per `CLAUDE.md` it stays.
So "one codebase per platform" in practice means **three parallel products**.

## 2. What would have to be rewritten — twice

| # | Area | Today | Native Android | Native iOS | Difficulty |
|---|---|---|---|---|---|
| 1 | Game simulation | 2,149 LOC TS, pure | Kotlin port | Swift port | Moderate to port, **hard to keep in lockstep** |
| 2 | Balance parity | deterministic harness + band asserts | re-implement + cross-check | re-implement + cross-check | **High risk** (see §3) |
| 3 | Client/state layer | `MockGameClient`, `localStorage`, event bus | DataStore + coroutines/Flow | UserDefaults/files + Combine | Easy–moderate |
| 4 | UI | ~15 React panels + CSS | Jetpack Compose | SwiftUI | Moderate, wide |
| 5 | 3D globe | three.js + topojson polygons, arcs, orbit, auto-rotate | **no SceneKit equivalent** — Filament or raw GL/Vulkan (Sceneform is dead) | SceneKit (workable) | **Hardest single item**; weeks per platform |
| 6 | Walk Mode | Capacitor plugin (already native) | direct API use; could upgrade to Health Connect | direct `CMPedometer`; could upgrade to HealthKit | **Easy** — the native code exists |
| 7 | Live CSV config | runtime parse, warnings, apply/revert, persist | re-implement | re-implement | Moderate |
| 8 | Tests | 50 vitest specs | kotlin.test/JUnit | XCTest | Moderate |
| 9 | CI / release | Pages + APK; iOS deliberately local-only | Gradle + Play signing | **macOS runners + signing** (the thing CI currently avoids) | Moderate, ongoing |

## 3. The specific hazard: balance drift

The game is a tuned economy. Bots, prices, recipe amounts and happiness
curves are validated by one deterministic harness in one language. With three
implementations, "the same game" becomes a testing problem:

- Doubles are IEEE 754 in JS, Kotlin and Swift, but transcendental functions
  (`Math.pow`, `exp`) can differ per platform libm, and any difference in
  operation order compounds over thousands of ticks.
- Mitigation if a port ever happens: generate **golden-master fixtures** from
  the TS harness (seeded world, N ticks → band report JSON) and assert parity
  in Kotlin/Swift with tolerance bands, *before* writing any UI.
- Ongoing cost regardless: every mechanic change (`recipes.ts` amounts, the
  `DEEP_HAPPINESS` flip, anything in WHATS_NEXT) is triple work. Only the
  CSV-carried tuning knobs survive as shared data.

## 4. What native buys — and what you already have

**Already in hand via the PWA + Capacitor wrapper:** store-installable
builds (APK in CI), offline service worker, home-screen install, and
background step banking via hardware counters — the headline native feature.

**A true native rewrite would buy:** fast cold start (no 2.8 MB three.js
chunk through a WebView), platform-idiomatic UI, deep OS integration
(widgets, watch apps, Live Activities, HealthKit / Health Connect), lower
memory, and an escape from low-end-Android WebView jank.

**What it would not buy:** performance the game needs. A click-driven game
ticking ~190 bot cities is computationally trivial; the real perceived-perf
problem is the single 2.8 MB chunk, which code-splitting fixes in about a
day (already flagged in WHATS_NEXT "Known rough edges").

## 5. Strategic timing — why "not now" specifically

1. **The design is first-draft.** Balance is untuned, the shipped tech tree
   has 16 unobtainable ingredients, deeper happiness is parked behind a flag.
   Porting a moving simulation means triple-entry bookkeeping during exactly
   the phase with the most churn.
2. **A Go backend is the declared next step** (`LiveGameClient`, WHATS_NEXT
   §9–10). If the simulation moves server-side, native clients shrink to
   REST + WebSocket + UI — and the expensive part of a native port done today
   (the simulation, twice) gets thrown away. Backend-first makes any later
   native client roughly a third of the cost.

## 6. Options compared

| Option | What it is | Cost | Verdict |
|---|---|---|---|
| **A. Status quo+** | Keep Capacitor; code-split three.js; optionally swap step sources to Health Connect / HealthKit via small plugin additions | Days | **Recommended now** |
| **B. Backend-first, then native UIs** | Do WHATS_NEXT §9–10; then Kotlin/Swift apps are thin clients (UI + globe only) | Backend anyway + ~1–2 months per platform later | **Recommended path to true native** |
| **C. Kotlin Multiplatform** | Simulation once in KMP shared by both apps; Compose + SwiftUI shells | ~1 sim port + 2 UIs | Sensible middle if staying client-only; web stays TS, so still 2 sims |
| **D. React Native / Expo** | Reuse the TS sim **and its tests verbatim**; rewrite UI in RN; globe via expo-gl | ~UI only | Highest code reuse, but it's one shared codebase — not "one per platform" |
| **E. Full native ×2** (as asked) | Kotlin/Compose + Swift/SwiftUI, everything in §2 | **2–4 months per platform** (4–8 eng-months), then ×3 maintenance forever | Max fidelity, max cost; premature today |

## 7. If proceeding with E anyway — phased plan per platform

1. **Sim + harness first.** Port `src/game/` and the balance harness; prove
   golden-master parity against TS fixtures before any UI exists.
2. **Client/state.** Tick loop, persistence, event bus (Flow / Combine).
3. **UI panels.** Compose / SwiftUI in the tactical-console theme.
4. **Globe last, staged.** Texture-mapped sphere + lat/lng markers + tap
   first; country polygons and trade arcs after (Filament on Android,
   SceneKit on iOS).
5. **Walk Mode.** Lift the existing plugin code into the app directly;
   consider Health Connect / HealthKit for historical step claims.
6. **Release.** Play internal track is easy; iOS needs the macOS-runner +
   signing story CI has so far deliberately avoided.

**Top risks:** balance drift (high — golden masters mandatory); Android globe
(high — spike Filament before committing); design churn (high — freeze
mechanics before porting); iOS CI/signing (medium).
