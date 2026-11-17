import city from '../../data/balance/city.json' with { type: 'json' };
import type { District } from './types';
export type RoadPoint = readonly [number, number];
export const roadSegments = city.edges.map(edge => [city.nodes[edge.a], ...edge.via, city.nodes[edge.b]]);
const cache = new Map<string, RoadPoint[]>();
/** Both the renderer and travel times use this same road network. */
export function roadPath(a: Pick<District, 'x' | 'y'>, b: Pick<District, 'x' | 'y'>): RoadPoint[] {
  const key = `${a.x},${a.y}:${b.x},${b.y}`;
  const saved = cache.get(key); if (saved) return saved;
  const start = city.nodes.findIndex(p => p[0] === a.x && p[1] === a.y);
  const end = city.nodes.findIndex(p => p[0] === b.x && p[1] === b.y);
  if (start < 0 || end < 0) return [[a.x, a.y], [b.x, a.y], [b.x, b.y]];
  const distances = city.nodes.map(() => Infinity), visited = new Set<number>();
  const previous = new Map<number, { node: number; points: RoadPoint[] }>(); distances[start] = 0;
  while (!visited.has(end)) {
    let node = -1, best = Infinity;
    distances.forEach((d, i) => { if (!visited.has(i) && d < best) { node = i; best = d; } });
    if (node < 0) break;
    visited.add(node);
    for (const edge of city.edges) {
      if (edge.a !== node && edge.b !== node) continue;
      const other = edge.a === node ? edge.b : edge.a;
      const points = [city.nodes[edge.a], ...edge.via, city.nodes[edge.b]] as unknown as RoadPoint[];
      if (edge.b === node) points.reverse();
      const length = points.reduce((s, p, i) => i ? s + Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) : 0, 0);
      if (best + length < distances[other]) { distances[other] = best + length; previous.set(other, { node, points }); }
    }
  }
  const parts: RoadPoint[][] = []; let current = end;
  while (current !== start) { const part = previous.get(current); if (!part) return [[a.x, a.y], [b.x, b.y]]; parts.unshift(part.points); current = part.node; }
  const points = parts.flatMap((p, i) => i ? p.slice(1) : p); cache.set(key, points); return points;
}
export function roadDistance(a: District, b: District) {
  return roadPath(a, b).reduce((s, p, i, points) => i ? s + Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) : 0, 0);
}
