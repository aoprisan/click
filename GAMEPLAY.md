# Global Conflict — Gameplay Design Document

## Overview

Global Conflict is a massive multiplayer browser-based game in which each player has a home city, and clicking boosts the population of that city. Cities get bigger over time. Players can earn missiles and fire them at other cities to reduce population. The goal is to make your city the biggest on Earth.

The visualization is a 3D Earth sphere. Earth can be rotated by the player. Any city can be selected to see its current status, in terms of size and missile inventory. There is a simple single-button interface by which the player grows their city.

---

## Game Modes

There are three different modes in which players can view the game.

### Spectator Mode

Available to any unauthenticated visitor. Spectators can:

- See global data
- Spin the globe and click on cities to view individual city data
- **Big button** is purposed as a **Login/Signin** button with a tooltip explaining interactions available once signed in

### Builder Mode

Available to non-paying players when logged in. Builders:

- Have a home city, centred and selected by default on login
- See global data, city data for the selected city, and their own player data
- **Big button** is purposed as a **Grow** button — adds **+1** to the city's population per click
- Can hold **1 missile** at a time (achievement missile only)

**Achievement missile:** Earned by completing achievements. Only one can be held at a time. If an achievement is earned while a missile remains unfired, the old missile is discarded and the new one takes its place.

### Warrior Mode

Available to paying (subscribed) players when logged in. Warriors:

- Have a home city, centred and selected by default on login
- See global data, city data for the selected city, and their own player data
- **Big button** is purposed as a **Grow** button — adds **+2** to the city's population per click (2x click multiplier)
- Can hold **2 missiles** at a time (1 achievement missile + 1 click missile)

**Achievement missile:** Same as for Builders, earned with achievements.

**Click missile:** Earned after a certain number of clicks. Can be fired immediately or kept and automatically upgraded in range and damage by further clicks. Firing the missile resets the click missile count to zero.

---

## Data Displays

### Global Data

Visible to all users.

| Field | Description |
|---|---|
| World population | Sum of all city populations |
| Number of cities | Total cities in the game |
| Highest ever population | Largest population any city has achieved |
| Average city population | Mean population across all cities |
| Daily change in average city population (%) | Percentage change in average over the last 24 hours |
| World missile stockpile | Total unfired missiles across all players |

### City Data

Visible to all users for their currently selected city. All viewers should always have one city selected.

| Field | Description |
|---|---|
| Name | City name |
| City population | Current population |
| Daily change (%) | Population change over the last 24 hours |
| Highest ever population | Peak population this city has achieved |
| City missile stockpile | Total unfired missiles held by players in this city |
| Total dead | Total population lost to missile strikes |

### Player Data

Visible only to individual Builders and Warriors when signed in.

| Field | Description |
|---|---|
| Name | Player name |
| Home city | The player's chosen city |
| Total number of population added | Lifetime clicks contributing to city growth |
| Total number of kills | Lifetime kills inflicted via missiles |
| Most boosts in 10s | Personal best clicks in a 10-second window |
| Most boosts in 1 day + timer | Personal best clicks in a day, with time remaining in current period |

---

## Achievements

Achievements are a way for both Builders and Warriors to earn achievement missiles. They track regular progress but **do not need to be stored** — they are computed from user fields (`total_clicks`, `best_10s`, `best_1day`, `last_cumulative_threshold`).

When a player earns an achievement missile, the type of missile awarded depends on player mode:
- **Builders** receive an **Imp I** missile
- **Warriors** receive a **Titan I** missile

### Cumulative Achievements

Based on the player's total click count.

| Achievement | Trigger | Notes |
|---|---|---|
| A Good Start | Total clicks = 200 | One-time, early engagement hook |
| New Champion | Total clicks = 1,000 | One-time |
| Local Hero | Total clicks divisible by 5,000 | Repeating (every 5,000 clicks) |

The first couple of achievements are given quickly to get the player into the flow. After that, achievements follow a regular pattern.

### Timed Achievements

The player competes against their own best click count within a time window.

| Achievement | Trigger | Notes |
|---|---|---|
| Fast Finger | New personal best clicks in 10 seconds | 10-second cooldown after registering a result |
| Relentless | New personal best clicks in 1 day | Timer resets every 24 hours |

Each time the player breaks their previous best, they earn the timed achievement and a new missile.

**On subscription purchase or renewal**, the player's timed bests are reset to zero, making it easier to re-earn these achievements.

---

## Missiles

Missiles are fired contextually as you browse cities on the globe. When you select a city that you want to target, that is within range of one of your current missiles, you will be given the option to fire. If you fire, the missile hits that city and the population is reduced.

### Missile Characteristics

- **Range**: Distance in kilometres from your home city. Three range tiers: 500 km, 1,500 km, 5,000 km.
- **Damage**: Number of people killed. Casualty count is a **random integer between lower and upper bounds**, calculated on impact. Three damage tiers.
- Only one missile of each type can be held at any time.

### Missile Types

There are 9 missile types across 3 damage tiers and 3 range tiers:

| Type | Clicks to Earn (Warriors only) | Range (km) | Deaths (min) | Deaths (max) |
|---|---|---|---|---|
| **Imp I** | 300 | 500 | 300 | 700 |
| **Imp II** | 2,000 | 1,500 | 300 | 700 |
| **Imp III** | 4,000 | 5,000 | 300 | 700 |
| **Titan I** | 6,000 | 500 | 3,000 | 7,000 |
| **Titan II** | 8,000 | 1,500 | 3,000 | 7,000 |
| **Titan III** | 10,000 | 5,000 | 3,000 | 7,000 |
| **Atlas I** | 13,000 | 500 | 30,000 | 70,000 |
| **Atlas II** | 16,000 | 1,500 | 30,000 | 70,000 |
| **Atlas III** | 20,000 | 5,000 | 30,000 | 70,000 |

**Click missile progression (Warriors only):** The "Clicks to Earn" column defines the click thresholds at which the Warrior's click missile is earned or upgraded. Reaching a new threshold automatically upgrades the click missile to the next type. Firing the missile resets the click count to zero.

**Achievement missiles:** Randomly selected from the missile pool on achievement completion. The most powerful missiles (Atlas tier) are only available as click missiles.

---

## Subscription Model

The game runs on a subscription model. Paying the subscription fee promotes a Builder to a Warrior.

### Pricing

| Plan | Price |
|---|---|
| Weekly (7 days) | $1.99 |
| Monthly (30 days) | $4.99 |

### Early Renewal Discount

| Parameter | Value |
|---|---|
| Discount | 20% bonus time |
| Discount period | Within 2 days of expiry |

When renewing within the discount period, the player receives 20% additional time on their subscription.

### Subscription Benefits

| Benefit | Details |
|---|---|
| Click multiplier | 2x — each click adds 2 population instead of 1 |
| Click missiles | Every click counts toward earning a click missile that upgrades with further clicks |
| Maximum missiles | 2 (1 achievement + 1 click) instead of 1 |
| Powerful missiles | Atlas-tier missiles are only available as click missiles |
| Timed achievement reset | Best times reset on purchase/renewal for easier re-earning |

---

## UI Messaging

Notifications displayed to the player via toast messages.

| Trigger | Message Template |
|---|---|
| Achievement earned (Builder gets Imp I) | "Achievement: {achievement name}. New missile available, {missile name}" |
| Achievement earned (Warrior gets Titan I) | "Achievement: {achievement name}. New missile available, {missile name}" |
| First click missile threshold reached | "New missile available, {missile name}" |
| Subsequent click missile threshold | "Missile upgraded to {missile name}" |
| Your missile hits a target | "{number of deaths} killed in {target city name}" |
| A missile hits your home city | "{number of deaths} killed by missile from {attacking city name}" |

---

## Rate Limiting

| Parameter | Value |
|---|---|
| Click budget | 100 clicks per 60 seconds |
| Burst capacity | 10 clicks |
| Sustained rate | ~1.67 clicks/second |

Implemented as a per-user token bucket.
