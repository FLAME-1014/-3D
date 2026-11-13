export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16] as const;
/** Keeps production cycles and identities within an exactly representable range. */
export const MAX_PRODUCTION_SECONDS = 1_000_000_000;

/** The only accumulated state in production. Equipment itself always evaluates pose(time). */
export class ProductionClock {
  private seconds = 0;
  private multiplier = 1;
  private running = true;

  get time(): number { return this.seconds; }
  get speed(): number { return this.multiplier; }
  get playing(): boolean { return this.running; }

  play(): void { this.running = true; }
  pause(): void { this.running = false; }
  seek(seconds: number): void {
    if (Number.isFinite(seconds)) this.seconds = positiveTime(seconds);
  }
  setSpeed(speed: number): void {
    if (Number.isFinite(speed)) this.multiplier = Math.min(16, Math.max(0.25, speed));
  }
  advance(dt: number): number {
    const safeDelta = Number.isFinite(dt) ? Math.min(0.1, Math.max(0, dt)) : 0;
    if (this.running) this.seconds = Math.min(MAX_PRODUCTION_SECONDS, this.seconds + safeDelta * this.multiplier);
    return this.seconds;
  }
}

export function clamp01(value: number): number { return Math.max(0, Math.min(1, value)); }
export function smoothstep(value: number): number {
  const u = clamp01(value);
  return u * u * (3 - 2 * u);
}
export function rangeProgress(time: number, start: number, end: number): number {
  return smoothstep((time - start) / (end - start));
}
export function positiveTime(time: number): number {
  return Number.isFinite(time) ? Math.min(MAX_PRODUCTION_SECONDS, Math.max(0, time)) : 0;
}
