---
name: game-architecture
description: Project structure, tech stack and engineering rules for the «Городской маршрут» mobile city-transport game. Use before creating files, adding a module, choosing a library, or restructuring code, even for small features.
---

# Game architecture

## Stack (fixed, do not change without a reason stated to the owner)
- TypeScript + Vite + three.js for rendering; Vitest for tests.
- Capacitor wraps the web build into an Android APK (see `$android-apk-build`).
- No backend. State saved in IndexedDB/localStorage.

## Layout
```
src/
  sim/        pure logic: city, demand, transport, economy, events (NO three.js, NO DOM)
  story/      chapter engine, flags, dialog state
  render/     three.js scene, camera, instancing, effects
  ui/         HUD, panels, dialogs (DOM/CSS overlay)
  core/       game loop, save/load, settings, audio, i18n
  main.ts
data/
  balance/    transport.json, economy.json, districts.json, events.json
  story/      characters.json, chapters/*.json, endings.json
  i18n/       ru.json
tests/
```

## Rules
- Fixed-timestep simulation (e.g. 1 game minute per tick), rendering interpolates. Sim must be deterministic given a seed: use one seeded PRNG in `core/rng.ts`, never `Math.random()` in `src/sim`.
- Sim exposes a small API: `createWorld(seed)`, `step(world, dtMinutes)`, `applyCommand(world, cmd)`, `getSnapshot(world)`. UI and render only read snapshots and send commands.
- Commands are plain objects (`{type:'buildRoute', ...}`) so they can be saved, replayed and tested.
- Data-driven: new transport type or event = new JSON entry, no new code where avoidable. Validate JSON at load; fail with a readable message.
- All user-visible strings go through `t('key')` with Russian in `data/i18n/ru.json`.
- Save format has a `version` field; write a migration when it changes.
- Tests: every sim function with a formula gets a unit test; add a test that runs 10 game years headless and asserts no NaN, no negative population, deterministic result for a fixed seed.
- Keep files under ~300 lines; split by responsibility.
