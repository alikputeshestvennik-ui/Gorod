import { describe, expect, it } from 'vitest';
import { RouteDraft } from '../src/core/route-draft';
import { applyCommand, createWorld } from '../src/sim/world';
import { E } from '../src/sim/config';
import { restore, save, SAVE_KEY } from '../src/core/save';
describe('продление без потери действующего пути', () => {
  it('строит с обоих концов, не меняя оригинал до подтверждения', () => {
    const original = [0, 1, 2, 3], draft = new RouteDraft(original, true);
    expect(draft.changed).toBe(false);
    draft.add(6); draft.side = 'start'; draft.add(7);
    expect(draft.stops).toEqual([7, 0, 1, 2, 3, 6]);
    expect(original).toEqual([0, 1, 2, 3]);
    expect(draft.changed).toBe(true);
    draft.undo(); expect(draft.stops).toEqual([0, 1, 2, 3, 6]);
    draft.clear(); expect(draft.stops).toEqual(original); expect(draft.changed).toBe(false);
  });
  it('не удаляет старые остановки и объясняет повторный выбор', () => {
    const draft = new RouteDraft([0, 1, 2, 3], true);
    draft.undo(); draft.remove(1); expect(draft.stops).toEqual([0, 1, 2, 3]);
    expect(draft.add(1)).toBe('existing');
    expect(draft.add(0)).toBe('endpoint'); expect(draft.side).toBe('start');
    draft.add(6); expect(draft.stops).toEqual([6, 0, 1, 2, 3]);
    draft.add(3); expect(draft.side).toBe('end');
    draft.add(7); expect(new Set(draft.stops).size).toBe(draft.stops.length);
  });
  it('продлевает без свободной машины, списывает только новые остановки и загружается', () => {
    const w = createWorld(); w.routes[0].vehicles = w.fleet;
    const draft = new RouteDraft(w.routes[0].stops, true), before = w.money;
    draft.add(6); draft.side = 'start'; draft.add(7);
    expect(applyCommand(w, { type: 'editRoute', routeId: 1, stops: draft.stops }).ok).toBe(true);
    expect(w.money).toBe(before - 2 * E.stopCost);
    expect(w.routes[0]).toMatchObject({ id: 1, vehicles: w.fleet, stops: [7, 0, 1, 2, 3, 6] });
    const memory = new Map<string, string>(); save(w, {setItem: (k,v) => { memory.set(k,v); }});
    expect(restore(memory.get(SAVE_KEY)!)).toEqual(w);
  });
  it('не затрагивает город при отмене или нехватке денег; обычное редактирование сохранено', () => {
    const w = createWorld(); w.money = 0;
    const before = structuredClone(w), draft = new RouteDraft(w.routes[0].stops, true);
    draft.add(6); expect(w).toEqual(before);
    expect(applyCommand(w, { type:'editRoute', routeId:1, stops:draft.stops }).ok).toBe(false); expect(w).toEqual(before);
    const edit = new RouteDraft(w.routes[0].stops); edit.remove(0); edit.clear(); expect(edit.stops).toEqual([]);
  });
});
