---
name: lowpoly-3d-mobile
description: Rendering and controls rules for the low-poly 3D city of «Городской маршрут» on mid-range Android phones with three.js: performance budget, instancing, camera, touch gestures, day/night, tap picking. Use for any 3D scene, camera, controls, models, lighting, effects or FPS problem.
---

# Low-poly 3D for mobile

## Look
Low-poly, flat or soft shading, a limited palette per district type, readable silhouettes. Day/night via light colour/intensity and sky colour, windows glow at night. Weather and seasons: simple particles and tint, no heavy post-processing.

## Performance budget (mid-range Android, WebView)
- 30+ FPS target; cap `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`.
- ≤ ~150 draw calls, ≤ ~200k visible triangles.
- Use `InstancedMesh` for buildings, trees, vehicles, stops; merge static geometry per chunk.
- At most one shadow-casting directional light (or baked/fake blob shadows); shadows off on the "low" quality preset.
- Chunk the city; show only chunks in view; far chunks use simplified boxes (LOD) or a flat district colour.
- Never allocate in the render loop (reuse vectors/matrices). Dispose geometries/materials/textures you remove.
- Quality presets (low/medium/high) in settings; auto-lower if FPS < 25 for several seconds.
- Models: simple generated geometry or glTF ≤ 500 triangles per vehicle; share materials.

## Camera and touch
- One finger drag: pan. Two-finger pinch: zoom. Two-finger twist/drag: rotate/tilt. Smooth damping, clamp tilt and distance.
- Zoom levels: strategic (heatmap overlay, districts) → street level (vehicles, people).
- Tap picking: do NOT raycast every mesh. Use a ground-plane raycast → grid cell lookup → nearest stop/district/building from a spatial index.
- Minimum touch target 44 px. Support portrait and landscape.
- Route building: drag a finger from stop to stop with a preview line; confirm with a button.

## UI over 3D
HUD in DOM/CSS overlay (money, population, satisfaction, trust, speed controls 1×/2×/pause). Bottom bar: Fleet, Routes, Finance, Heatmap toggle. Heatmap layers: demand, load, complaints. Respect safe areas (notches, gesture bars).

## Visual agents
People and vehicles are decoration driven by simulation snapshots; spawn only near the camera, cap their count by quality preset. They must never affect simulation results.

## Verification
Add a dev FPS/draw-call/triangle counter toggle. When changing rendering, report the numbers in the final message.
