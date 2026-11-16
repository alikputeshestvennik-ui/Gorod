# AGENTS.md — «Городской маршрут»

3D city transport-management strategy with a story, for Android. Game text is in Russian.

## Who you work with
- Owner: Алим. Not a programmer. Works ONLY from an Android phone (no PC). Talk to him in Russian, simply, in short steps.
- Never ask him to run terminal commands or install desktop tools. Everything must build in GitHub Actions and arrive as an APK artifact.

## Skills (in .agents/skills/) — use them
- `$game-architecture` — before creating or restructuring any code.
- `$city-simulation` — any work on demand, growth, transport, economy, events.
- `$story-and-chapters` — any work on plot, dialogs, chapters, endings.
- `$lowpoly-3d-mobile` — any rendering, camera, controls, UI-on-3D work.
- `$android-apk-build` — packaging, CI, signing, APK problems.

## Rules
1. Work in stages (see Roadmap). Finish and verify one stage before starting the next. Never rewrite the whole project at once.
2. After every stage: `npm test` and `npm run build` pass, and the CI produces an APK.
3. Simulation logic is separate from rendering (no three.js imports in `src/sim`).
4. All balance numbers and all story text live in `data/*.json`, not in code.
5. Game works fully offline. No runtime network calls, no analytics.
6. Target: mid-range Android phone, 30+ FPS, portrait and landscape.
7. Small commits with clear messages. Do not delete files you did not create.
8. If a requirement is unclear, choose the simplest option, state the assumption in your final message, continue.
9. Final message to Алим: what works now (1–3 lines), how to get the APK, what comes next.

## Roadmap
1. Prototype: flat map, one transport type (маршрутка), basic demand, population growth.
2. Core: bus, trolleybus/tram, economy, indicators, events.
3. 3D + atmosphere: low-poly city, day/night, camera, sound.
4. Story: characters, dialogs, chapters 1–3, choices, flags.
5. Metro, suburban rail, chapters 4–5, endings.
6. Polish: balance, tutorial, performance, save/load.

## Commands (after stage 1 exists)
- `npm ci`, `npm test`, `npm run build`, `npm run dev`
