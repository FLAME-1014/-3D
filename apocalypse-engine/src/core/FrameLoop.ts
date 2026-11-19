export interface FrameScheduler {
  request(callback: FrameRequestCallback): number;
  cancel(id: number): void;
}

export class FrameLoop {
  private pending: number | null = null;
  private previous: number | null = null;
  private running = false;
  private generation = 0;
  get isRunning() { return this.running; }

  constructor(private scheduler: FrameScheduler, private frame: (delta: number, now: number) => void) {}

  start() {
    if (this.running) return;
    this.running = true;
    const current = ++this.generation;
    const tick = (now: number) => {
      if (!this.running || current !== this.generation) return;
      this.pending = null;
      const delta = this.previous === null ? 0 : (now - this.previous) / 1000;
      this.previous = now;
      this.frame(delta, now / 1000);
      if (this.running && current === this.generation) this.pending = this.scheduler.request(tick);
    };
    this.pending = this.scheduler.request(tick);
  }

  stop() {
    this.running = false;
    this.previous = null;
    if (this.pending !== null) this.scheduler.cancel(this.pending);
    this.pending = null;
  }
}
