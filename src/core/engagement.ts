import { MODES } from '../sim/config';
import { unlocked } from '../sim/commands';
import type { Mode, World } from '../sim/types';

/** Session-only diagnostics; no storage, network or effect on simulation. */
export class Engagement {
  elapsed = 0;
  private lastDecision = 0;
  private lastReward = 0;
  private lastNotable = 0;
  private eventKey: string;
  private available: Set<Mode>;
  private previousTrust: number;
  private completedGoals: number;
  private activeGoals: number;
  decisions = 0;
  rewards = 0;
  events = 0;
  longestIdle = 0;
  constructor(w: World) {
    this.eventKey = this.key(w);
    this.available = new Set(MODES.filter(mode => unlocked(w, mode)));
    this.previousTrust = w.trust;
    this.completedGoals = w.goals.completed; this.activeGoals = w.goals.active.length;
  }
  private key(w: World) { return w.event ? `${w.event.id}:${w.event.until}` : ''; }
  advance(dt: number, active: boolean) {
    if (!active) return;
    this.elapsed += Math.max(0, dt);
    this.longestIdle = Math.max(this.longestIdle, this.elapsed - this.lastNotable);
  }
  decision() { this.lastDecision = this.lastNotable = this.elapsed; this.decisions++; }
  observe(w: World): Mode[] {
    const key = this.key(w);
    if (key && key !== this.eventKey) { this.events++; this.lastNotable = this.elapsed; }
    const inspectionReward = this.eventKey.startsWith('inspection:') && !key && w.trust > this.previousTrust;
    this.eventKey = key;
    this.previousTrust = w.trust;
    const opened = MODES.filter(mode => !this.available.has(mode) && unlocked(w, mode));
    for (const mode of opened) this.available.add(mode);
    const goals = Math.max(0, w.goals.completed - this.completedGoals);
    this.completedGoals = w.goals.completed; this.activeGoals = w.goals.active.length;
    if (opened.length || inspectionReward || goals) { this.lastReward = this.lastNotable = this.elapsed; this.rewards += goals + Number(Boolean(opened.length || inspectionReward)); }
    return opened;
  }
  snapshot() {
    return { elapsed: Math.floor(this.elapsed), sinceDecision: Math.floor(this.elapsed - this.lastDecision),
      sinceReward: Math.floor(this.elapsed - this.lastReward), rewards: this.rewards, decisions: this.decisions,
      activeGoals: this.activeGoals, events: this.events, eventsPerHour: this.elapsed ? this.events * 3600 / this.elapsed : 0,
      longestIdle: Math.floor(this.longestIdle) };
  }
}
