import { t } from '../core/i18n';
import { Tutorial, TUTORIAL_STEPS, type TutorialStep } from '../core/tutorial';

const targets: Partial<Record<TutorialStep, string>> = {
  camera: '.zoom', demand: '#layer-demand', plan: '#demand-suggest', build: '#confirm',
  layers: '.layer-buttons', finance: '[data-tab="finance"]', extend: '[data-tab="routes"]', extendBuild: '#confirm'
};
const icons: Record<TutorialStep, string> = { welcome: '⌁', camera: '↔', demand: '↗', plan: '⌁', build: '✓', layers: '◉', finance: '₽', extend: '↗', extendBuild: '＋', ready: '✦' };

export class TutorialGuide {
  readonly state: Tutorial;
  private root = document.createElement('section');
  private highlighted?: HTMLElement;
  private lastStep = '';
  onPrepare: () => void = () => {};
  onDone: () => void = () => {};
  constructor(private host: HTMLElement, storage: Pick<Storage, 'getItem' | 'setItem'>) {
    this.state = new Tutorial(storage);
    this.root.id = 'tutorial'; this.root.setAttribute('aria-label', t('tutorialLabel'));
    host.append(this.root);
    this.root.onclick = e => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (button?.dataset.tutorial === 'next') { this.state.next(); this.render(true); }
      if (button?.dataset.tutorial === 'skip') { this.state.move('done'); this.render(true); }
    };
    this.render();
  }
  get paused() { return this.state.active; }
  restart() { this.onPrepare(); this.state.move('welcome'); this.render(true); }
  signal(event: string) { this.state.signal(event); this.render(); }
  render(focus = false) {
    const step = this.state.step;
    // Panels may replace a highlighted button during a regular HUD update.
    if (step !== 'done') {
      const target = targets[step] ? document.querySelector<HTMLElement>(targets[step]!) ?? undefined : undefined;
      if (target !== this.highlighted) { this.highlighted?.classList.remove('tutorial-target'); this.highlighted = target; target?.classList.add('tutorial-target'); }
    }
    if (step === this.lastStep) return;
    this.lastStep = step;
    this.root.hidden = step === 'done';
    this.host.classList.toggle('tutorial-open', step !== 'done');
    this.host.classList.toggle('tutorial-welcome', step === 'welcome');
    this.host.dataset.tutorialStep = step;
    // Only the welcome screen blocks the map; subsequent steps use the real controls.
    for (const child of this.host.children) if (child !== this.root) (child as HTMLElement).inert = step === 'welcome';
    if (step === 'done') { this.highlighted?.classList.remove('tutorial-target'); this.highlighted = undefined; this.onDone(); return; }
    this.root.dataset.step = step;
    this.host.dataset.tutorialStep = step;
    const index = TUTORIAL_STEPS.indexOf(step);
    const title = 'tutorial' + step[0].toUpperCase() + step.slice(1);
    this.root.innerHTML = `<div class="tutorial-card" role="${step === 'welcome' ? 'dialog' : 'region'}" aria-labelledby="tutorial-title" ${step === 'welcome' ? 'aria-modal="true"' : ''}>
      <div class="tutorial-eyebrow"><span>${t('tutorialLabel')} · ${index + 1} / ${TUTORIAL_STEPS.length}</span><span class="tutorial-paused">Ⅱ ${t('tutorialPaused')}</span></div>
      <div class="tutorial-hero" aria-hidden="true"><svg viewBox="0 0 300 100"><path class="tutorial-road" d="M-10 83H65Q95 83 95 55V45Q95 20 125 20H200Q225 20 225 47V55Q225 80 260 80H310"/><path class="tutorial-route" d="M-10 83H65Q95 83 95 55V45Q95 20 125 20H200Q225 20 225 47V55Q225 80 260 80H310"/><g class="tutorial-buildings"><path d="M20 60V14H48V60M130 91V45H160V91M246 52V7H280V52"/><path d="M29 24V30M39 24V30M29 40V46M39 40V46M140 56V62M150 56V62M140 73V79M150 73V79M257 17V23M269 17V23M257 34V40M269 34V40"/></g><g class="tutorial-stations"><circle cx="60" cy="83" r="7"/><circle cx="151" cy="20" r="7"/><circle cx="263" cy="80" r="7"/></g><g class="tutorial-bus"><rect x="177" y="9" width="28" height="20" rx="5"/><path d="M183 14H199V21H183Z"/></g></svg></div>
      <div class="tutorial-heading"><span class="tutorial-icon" aria-hidden="true">${icons[step]}</span><h2 id="tutorial-title">${t(title)}</h2></div>
      <p id="tutorial-copy" aria-live="polite">${t(title + 'Text')}</p>
      <div class="tutorial-progress" aria-hidden="true">${TUTORIAL_STEPS.map((_, i) => `<i class="${i <= index ? 'filled' : ''}"></i>`).join('')}</div>
      <div class="tutorial-actions"><button data-tutorial="skip">${t('tutorialLater')}</button><button class="primary" data-tutorial="next">${t(step === 'welcome' ? 'tutorialStart' : step === 'ready' ? 'tutorialPlay' : step === 'camera' ? 'tutorialNext' : 'tutorialSkipStep')}</button></div>
    </div>`;
    if (focus || step === 'welcome') this.root.querySelector<HTMLButtonElement>('[data-tutorial="next"]')!.focus({ preventScroll: true });
  }
}
