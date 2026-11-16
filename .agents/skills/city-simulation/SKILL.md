---
name: city-simulation
description: Rules and formulas for the city growth, passenger demand, transport modes, economy, indicators and events of «Городской маршрут». Use whenever touching demand, population growth, districts, routes, tickets, money, satisfaction, events, balance or unlocking transport types.
---

# City simulation

Core idea: the city grows by itself; the player must serve demand faster than it grows. Good transport raises land value and density, which creates more demand ("infinite growth").

## Entities
- District: `type` (residential | industrial | business | commercial | leisure), `population`, `jobs`, `density`, `landValue`, `accessibility`, position.
- Attractor (railway station, hospital, university, market, stadium, mall, airport): adds `pull` to its district; can spike by events.
- Stop, Route (ordered stops, mode, vehicles, headway, fare), Vehicle (model, capacity, wear).
- Do NOT simulate every passenger as an agent. Simulate aggregated flows between district pairs. Individual people are drawn only near the camera, purely visual.

## Demand (per origin a → destination b, per hour h, day type d)
```
D(a,b,h,d) = P_a * wOrigin[type_a][h][d] * attract_b * wDest[type_b][h][d] * decay(dist(a,b))
decay(x) = 1 / (1 + x/x0)^2
```
Time-of-day weights live in `data/balance/districts.json`: morning residential→industrial/business, evening reverse, weekends → commercial/leisure. Event multipliers apply on top.

## Mode choice (transit vs private car vs walk)
```
U_mode = -(α*travelTime + β*fare + γ*discomfort + δ*transfers + ε*waitTime)
share_mode = exp(U_mode) / Σ exp(U_m)     # include "car" and "walk" as modes
```
Discomfort grows with load factor (sharply above 0.8). Car congestion rises with the number of car trips (feedback). Passengers lost to cars increase complaints.

## Growth loop (monthly step)
```
accessibility_d = weighted share of jobs/attractors reachable within T minutes by transit
landValue += k1 * (accessibility - landValue)
density   += k2 * max(0, landValue - density)   # only if housing capacity allows
population growth = base * (1 + satisfactionBonus), bounded by housing
new districts appear at the map edge when density saturates
```
Keep all k, α, β, γ… in JSON. Population has no hard cap; performance must not degrade linearly with population (aggregate by district, merge far districts).

## Transport modes (data in `data/balance/transport.json`)
| mode | typical population range | notes |
|---|---|---|
| marshrutka (минибус) | to ~20k | cheap, small capacity, adds congestion |
| bus | 20–100k | flexible routes |
| trolleybus / tram | 100–500k | costly infrastructure, cheap running cost |
| suburban rail | 300k+ | suburban links |
| metro | 500k+ | huge capex, takes main flows |
Unlocks are driven by need/thresholds from data, not timers. Interchange hubs redistribute flows; bad hubs create queues. Modes run in parallel.

## Economy
Income: tickets, advertising, city subsidy, station rent. Costs: wages, fuel/electricity, maintenance, depreciation, loan interest. Higher fare → fewer riders; the game shows a recommended fare range. Vehicles wear out and break; overdue maintenance raises breakdown chance.

## Indicators and failure
Money, citizen satisfaction, mayor trust, ecology. A low indicator triggers a crisis (strike, subsidy cut, dismissal). Game over only if money AND trust collapse; other crises are recoverable.

## Events (`data/balance/events.json`)
match/concert (demand spike), snow/ice (speed down, breakdowns up), bridge/road repair (reroute), accident, holiday/fair (predictable), driver strike, city inspection. Each event: trigger conditions, duration, effects on demand/speed/breakdowns/trust, optional player choices. Some are forecast in advance.

## Testing
Unit-test: logit shares sum to 1, growth monotonic with accessibility, economy never produces NaN, 10-year headless run deterministic for a fixed seed. Provide a debug overlay (heatmap: demand, load, complaints).
