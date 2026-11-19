import { clamp } from '../utils/math';

export const FIXED_DT = 1 / 60;
export type ClockRate = 1 | 2 | 5;
export interface ClockStamp { ticks: number; remainder: number; rate: ClockRate }

export class SimulationClock {
  ticks = 0;
  private remainder = 0;
  rate: ClockRate = 1;
  get time() { return this.ticks * FIXED_DT; }

  next() { return ++this.ticks * FIXED_DT; }

  advance(wallSeconds: number, consume: () => boolean) {
    if (!Number.isFinite(wallSeconds)) return 0;
    this.remainder += clamp(wallSeconds, 0, 0.24) * this.rate;
    let steps = 0;
    while (this.remainder >= FIXED_DT - 1e-9 && steps < 72) {
      this.remainder = Math.max(0, this.remainder - FIXED_DT);
      steps++;
      if (!consume()) { this.remainder = 0; break; }
    }
    return steps;
  }

  reset() { this.ticks = this.remainder = 0; this.rate = 1; }
  checkpoint(): ClockStamp { return { ticks: this.ticks, remainder: this.remainder, rate: this.rate }; }
  restore(saved: ClockStamp) { this.ticks = saved.ticks; this.remainder = saved.remainder; this.rate = saved.rate; }
}
