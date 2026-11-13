export type LODLevel = 'proxy' | 'low' | 'medium' | 'original';
export type LODQuality = 'smooth' | 'balanced' | 'fine';

export const LOD_LEVELS: readonly LODLevel[] = ['proxy', 'low', 'medium', 'original'];
export const LOD_THRESHOLDS = [65, 32, 14] as const;
export const LOD_HYSTERESIS = 0.1;
export const ORIGINAL_RESIDENCY_LIMIT = 3;
export const ASSET_RELEASE_SECONDS = 8;
const QUALITY_DISTANCE_SCALE: Record<LODQuality, number> = { smooth: 1.7, balanced: 1.25, fine: 1 };

function validDistance(distance: number): boolean { return Number.isFinite(distance) && distance >= 0; }

/** The original cap is strict at 14 m; other transitions use a symmetric 10% dead band. */
export function selectLOD(previous: LODLevel | null, distance: number, quality: LODQuality): LODLevel {
  if (!validDistance(distance) || !(quality in QUALITY_DISTANCE_SCALE)) return 'proxy';
  const scaledDistance = distance * QUALITY_DISTANCE_SCALE[quality];
  const maximum = quality === 'fine' && distance < LOD_THRESHOLDS[2] ? 3 : 2;
  if (previous === null) {
    const desired = scaledDistance >= 65 ? 0 : scaledDistance >= 32 ? 1 : scaledDistance >= 14 ? 2 : 3;
    return LOD_LEVELS[Math.min(desired, maximum)]!;
  }
  let level = Math.min(Math.max(0, LOD_LEVELS.indexOf(previous)), maximum);
  while (level > 0) {
    const threshold = LOD_THRESHOLDS[level - 1]!;
    if (scaledDistance <= threshold * (1 + LOD_HYSTERESIS)) break;
    level--;
  }
  while (level < maximum && scaledDistance < LOD_THRESHOLDS[level]! * (1 - LOD_HYSTERESIS)) level++;
  return LOD_LEVELS[level]!;
}

/** Stable tie-breaking by instance index keeps equal-distance models from swapping seats. */
export function rankOriginalBudget(distances: readonly number[], limit = ORIGINAL_RESIDENCY_LIMIT): number[] {
  const capacity = Number.isFinite(limit) ? Math.max(0, Math.min(ORIGINAL_RESIDENCY_LIMIT, Math.floor(limit))) : ORIGINAL_RESIDENCY_LIMIT;
  return distances.map((distance, index) => ({ distance, index }))
    .filter(({ distance }) => validDistance(distance) && distance < LOD_THRESHOLDS[2])
    .sort((a, b) => a.distance - b.distance || a.index - b.index)
    .slice(0, capacity).map(({ index }) => index);
}

export function applyOriginalBudget(levels: readonly LODLevel[], distances: readonly number[], quality: LODQuality): LODLevel[] {
  const selected = new Set(quality === 'fine' ? rankOriginalBudget(distances.map((distance, index) => levels[index] === 'original' ? distance : Infinity)) : []);
  return levels.map((level, index) => level === 'original' && !selected.has(index) ? 'medium' : level);
}

/** Dispose exited originals before allocating entered originals to preserve the hard resident cap. */
export class OriginalResidencyBudget {
  private current: number[] = [];
  reconcile(distances: readonly number[], quality: LODQuality = 'fine'): { indices: number[]; entered: number[]; exited: number[] } {
    const indices = quality === 'fine' ? rankOriginalBudget(distances) : [];
    const previous = new Set(this.current), next = new Set(indices);
    const entered = indices.filter((index) => !previous.has(index));
    const exited = this.current.filter((index) => !next.has(index));
    this.current = [...indices];
    return { indices, entered, exited };
  }
  reset(): number[] { const exited = this.current; this.current = []; return [...exited]; }
}

interface VariantEntry<T> {
  key: string;
  promise: Promise<T>;
  references: number;
  releaseAt: number | null;
  ready: boolean;
  value?: T;
  removed: boolean;
  disposed: boolean;
}

/** Explicit monotonic real time keeps asset eviction independent of pause, speed and seek. */
export class MeshVariantCache<T> {
  private entries = new Map<string, VariantEntry<T>>();
  private clockTime = 0;
  private closed = false;
  private disposalCount = 0;
  private readonly releaseDelay: number;

  constructor(private readonly onDispose: (value: T, key: string) => void, releaseDelaySeconds = ASSET_RELEASE_SECONDS) {
    this.releaseDelay = Number.isFinite(releaseDelaySeconds) && releaseDelaySeconds >= 0 ? releaseDelaySeconds : ASSET_RELEASE_SECONDS;
  }

  private time(now: number): number {
    if (Number.isFinite(now)) this.clockTime = Math.max(this.clockTime, now, 0);
    return this.clockTime;
  }

  acquire(key: string, loader: () => T | Promise<T>, nowSeconds = 0): Promise<T> {
    if (this.closed) return Promise.reject(new Error('MeshVariantCache has been disposed'));
    this.time(nowSeconds);
    const existing = this.entries.get(key);
    if (existing) {
      existing.references++; existing.releaseAt = null;
      return existing.promise;
    }
    const entry: VariantEntry<T> = { key, promise: undefined as unknown as Promise<T>, references: 1, releaseAt: null, ready: false, removed: false, disposed: false };
    entry.promise = Promise.resolve().then(loader).then((value) => {
      entry.value = value; entry.ready = true;
      if (entry.removed || this.closed) this.disposeValue(entry);
      return value;
    }, (error: unknown) => {
      if (this.entries.get(key) === entry) this.entries.delete(key);
      entry.removed = true;
      throw error;
    });
    this.entries.set(key, entry);
    return entry.promise;
  }

  release(key: string, nowSeconds = 0): void {
    const now = this.time(nowSeconds), entry = this.entries.get(key);
    if (!entry || entry.references === 0) return;
    entry.references--;
    if (entry.references === 0) entry.releaseAt = now + this.releaseDelay;
  }

  collect(nowSeconds: number): string[] {
    const now = this.time(nowSeconds), released: string[] = [];
    for (const entry of this.entries.values()) {
      if (entry.references === 0 && entry.releaseAt !== null && entry.releaseAt <= now) {
        this.remove(entry); released.push(entry.key);
      }
    }
    return released;
  }

  /** An original-variant budget displacement can override the ordinary eight-second grace. */
  evictUnused(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry || entry.references !== 0) return false;
    this.remove(entry); return true;
  }

  private disposeValue(entry: VariantEntry<T>): void {
    if (!entry.ready || entry.disposed) return;
    entry.disposed = true; this.disposalCount++;
    this.onDispose(entry.value as T, entry.key);
  }

  private remove(entry: VariantEntry<T>): void {
    if (this.entries.get(entry.key) === entry) this.entries.delete(entry.key);
    entry.removed = true; this.disposeValue(entry);
  }

  disposeAll(): void {
    this.closed = true;
    const entries = [...this.entries.values()]; this.entries.clear();
    const errors: unknown[] = [];
    for (const entry of entries) {
      entry.removed = true;
      try { this.disposeValue(entry); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, 'One or more mesh variants failed disposal');
  }

  refCount(key: string): number { return this.entries.get(key)?.references ?? 0; }
  has(key: string): boolean { return this.entries.has(key); }
  stats(): { entries: number; ready: number; pending: number; references: number; disposed: number } {
    const entries = [...this.entries.values()];
    return {
      entries: entries.length, ready: entries.filter((entry) => entry.ready).length,
      pending: entries.filter((entry) => !entry.ready).length,
      references: entries.reduce((sum, entry) => sum + entry.references, 0), disposed: this.disposalCount,
    };
  }
}
