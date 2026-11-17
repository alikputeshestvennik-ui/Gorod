export const TUTORIAL_KEY = 'gorodskoy-marshrut:tutorial:v1';
export const TUTORIAL_STEPS = ['welcome', 'camera', 'demand', 'plan', 'build', 'layers', 'finance', 'extend', 'extendBuild', 'ready'] as const;
export type TutorialStep = typeof TUTORIAL_STEPS[number];
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;

/** Kept separately from the city: updating or replaying the guide never resets a save. */
export class Tutorial {
  step: TutorialStep | 'done' = 'welcome';
  constructor(private storage: StoragePort) {
    try {
      const value = JSON.parse(storage.getItem(TUTORIAL_KEY) ?? 'null');
      if (value?.version === 1 && [...TUTORIAL_STEPS, 'done'].includes(value.step)) this.step = value.step;
      // A draft is intentionally transient. Reopen its planning step after a reload.
      if (this.step === 'build') this.step = 'plan';
      if (this.step === 'extendBuild') this.step = 'extend';
    } catch { /* A blocked or corrupt tutorial save must not block the city. */ }
  }
  get active() { return this.step !== 'done'; }
  move(step: TutorialStep | 'done') {
    this.step = step;
    try { this.storage.setItem(TUTORIAL_KEY, JSON.stringify({ version: 1, step })); } catch { /* Session guide still works. */ }
  }
  next() {
    if (this.step === 'done') return;
    this.move(TUTORIAL_STEPS[TUTORIAL_STEPS.indexOf(this.step) + 1] ?? 'done');
  }
  signal(event: string) {
    const expected: Partial<Record<TutorialStep, string>> = { demand: 'demand', plan: 'planned', build: 'built', layers: 'layers', finance: 'finance', extend: 'extending', extendBuild: 'extended' };
    if (this.step === 'extendBuild' && event === 'cancel') this.move('extend');
    else if (this.step === 'build' && event === 'cancel') this.move('plan');
    else if (this.step !== 'done' && expected[this.step] === event) this.next();
  }
}
