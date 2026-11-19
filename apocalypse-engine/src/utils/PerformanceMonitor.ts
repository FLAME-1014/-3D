export interface PerformanceSample {
  fps: number;
  p95: number;
  frames: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  bodies: number;
  heap: number | null;
}

export const EMPTY_PERFORMANCE: PerformanceSample = {
  fps: 0, p95: 0, frames: 0, drawCalls: 0, triangles: 0,
  geometries: 0, textures: 0, bodies: 0, heap: null,
};

export class PerformanceMonitor {
  private durations: number[] = [];
  private previous = 0;
  private epoch = 0;
  sample: PerformanceSample = { ...EMPTY_PERFORMANCE };

  frame(now: number, delta: number, draw: Omit<PerformanceSample, 'fps' | 'p95' | 'frames' | 'heap'>) {
    if (!this.epoch) this.previous = this.epoch = now;
    if (delta > 0) this.durations.push(delta * 1000);
    if (this.durations.length > 300) this.durations.shift();
    if (now - this.previous < 0.8 || !this.durations.length) return false;
    this.previous = now;
    const last = this.durations;
    const order = last.slice().sort((first, second) => first - second);
    const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    this.sample = {
      fps: 1000 * last.length / last.reduce((sum, duration) => sum + duration, 0),
      p95: order[Math.ceil(order.length * 0.95) - 1],
      frames: last.length,
      ...draw, heap: heap ? heap.usedJSHeapSize : null,
    };
    return true;
  }

  reset() {
    this.durations = [];
    this.previous = this.epoch = 0;
    this.sample = { ...EMPTY_PERFORMANCE };
  }
}
