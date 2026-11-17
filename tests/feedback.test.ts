import { describe, expect, it } from 'vitest';
import { createWorld, step, applyCommand } from '../src/sim/world';
import { demand } from '../src/sim/demand';
import { demandFlows, suggestedFlow } from '../src/sim/insights';
import { Engagement } from '../src/core/engagement';

describe('понятный спрос', () => {
  it('показывает ожидаемые поездки за час сразу, не меняя мир и генератор', () => {
    const w = createWorld(), before = structuredClone(w), flows = demandFlows(w);
    expect(flows).toHaveLength(w.districts.length * (w.districts.length - 1));
    expect(flows[0].perHour).toBeGreaterThan(0);
    for (const flow of flows) expect(flow.perHour).toBeCloseTo(demand(w.districts[flow.from], w.districts[flow.to], w.minute));
    expect(w).toEqual(before);
    expect(demandFlows(w)).toEqual(flows);
  });
  it('рекомендует работающую прямую связь, учитывает ремонт и нулевой парк', () => {
    const w = createWorld(), flow = suggestedFlow(demandFlows(w))!;
    expect(flow.connected).toBe(false);
    expect(applyCommand(w, { type: 'buildRoute', stops: [flow.from, flow.to] }).ok).toBe(true);
    expect(demandFlows(w).find(f => f.from === flow.from && f.to === flow.to)!.connected).toBe(true);
    w.routes[1].vehicles = 0;
    expect(demandFlows(w).find(f => f.from === flow.from && f.to === flow.to)!.connected).toBe(false);
    w.event = { id: 'repair', until: 1000 };
    expect(demandFlows(w).find(f => f.from === 0 && f.to === 1)!.connected).toBe(false);
  });
  it('следует часу, выходным и событию вместо выдуманных очередей', () => {
    const w = createWorld(), flows = demandFlows(w);
    w.event = { id: 'match', until: 1000 };
    const match = demandFlows(w);
    const normal = flows.find(f => f.from === 1 && f.to === 9)!;
    expect(match.find(f => f.from === 1 && f.to === 9)!.perHour).toBeCloseTo(normal.perHour * 3.8);
    w.event = null; step(w, 720);
    expect(demandFlows(w)).not.toEqual(flows);
  });
});

describe('местные показатели темпа', () => {
  it('исключает паузу, считает решения и повторные события одного типа', () => {
    const w = createWorld(), metrics = new Engagement(w);
    metrics.advance(50, false); expect(metrics.snapshot().elapsed).toBe(0);
    metrics.advance(20, true); metrics.decision(); metrics.advance(12, true);
    expect(metrics.snapshot()).toMatchObject({ elapsed: 32, sinceDecision: 12, sinceReward: 32, rewards: 0, decisions: 1, activeGoals: 0 });
    w.event = { id: 'snow', until: 1200 }; metrics.observe(w); metrics.observe(w);
    expect(metrics.snapshot().events).toBe(1);
    w.event = { id: 'snow', until: 2400 }; metrics.observe(w);
    expect(metrics.snapshot().events).toBe(2);
    expect(metrics.snapshot().eventsPerHour).toBeCloseTo(225);
  });
  it('не выдаёт исходно открытый автобус за награду и фиксирует новые открытия', () => {
    const w = createWorld(), metrics = new Engagement(w);
    expect(metrics.observe(w)).toEqual([]);
    metrics.advance(90, true); w.served = 600;
    expect(metrics.observe(w)).toEqual(['trolleybus']);
    metrics.advance(3, true); expect(metrics.observe(w)).toEqual([]);
    expect(metrics.snapshot()).toMatchObject({ rewards: 1, sinceReward: 3, longestIdle: 90 });
  });
});
