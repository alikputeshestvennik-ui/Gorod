/** Quiet procedural ambience, generated offline and unlocked only by a user gesture. */
export class CityAudio {
  private context?: AudioContext;
  private gain?: GainNode;
  private hum?: OscillatorNode;
  private air?: OscillatorNode;
  private enabled = false;
  private blocked = false;
  private lastCue = -10;
  async setEnabled(enabled: boolean): Promise<boolean> {
    this.enabled = enabled;
    if (!enabled || this.blocked) { if (this.context?.state === 'running') await this.context.suspend().catch(() => {}); return true; }
    try {
      if (!this.context) {
        this.context = new AudioContext(); this.gain = this.context.createGain(); this.gain.gain.value = 0.025; this.gain.connect(this.context.destination);
        this.hum = this.context.createOscillator(); this.hum.type = 'sine'; this.hum.frequency.value = 82; this.hum.connect(this.gain); this.hum.start();
        this.air = this.context.createOscillator(); this.air.type = 'sine'; this.air.frequency.value = 123; this.air.connect(this.gain); this.air.start();
      }
      await this.context.resume(); return true;
    } catch { this.enabled = false; return false; }
  }
  setBlocked(blocked: boolean) { this.blocked = blocked; void this.setEnabled(this.enabled); }
  update(day: number, active: boolean) {
    if (!this.context || !this.gain || !this.hum || !this.air) return;
    const now = this.context.currentTime;
    this.gain.gain.setTargetAtTime(active && this.enabled ? 0.018 + day * 0.012 : 0, now, 0.3);
    this.hum.frequency.setTargetAtTime(55 + day * 27, now, 1); this.air.frequency.setTargetAtTime(110 + day * 13, now, 1);
    if (active && this.enabled && day > 0.6 && now - this.lastCue > 12) { this.lastCue = now; this.tone(1500, 0.13, 0.015); }
  }
  cue() { if (this.enabled) this.tone(660, 0.16, 0.07); }
  private tone(frequency: number, seconds: number, volume: number) {
    const context = this.context; if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator(), gain = context.createGain(), now = context.currentTime;
    oscillator.frequency.setValueAtTime(frequency, now); oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.4, now + seconds);
    gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(now + seconds);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
}
