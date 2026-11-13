import { describe, expect, it, vi } from 'vitest';
import { applyOriginalBudget, MeshVariantCache, OriginalResidencyBudget, rankOriginalBudget, selectLOD } from './lod';

describe('distance and quality LOD', () => {
  it('selects the four nominal detail levels and scales quality distances', () => {
    expect(selectLOD(null, 66, 'fine')).toBe('proxy');
    expect(selectLOD(null, 40, 'fine')).toBe('low');
    expect(selectLOD(null, 20, 'fine')).toBe('medium');
    expect(selectLOD(null, 10, 'fine')).toBe('original');
    expect(selectLOD(null, 40, 'smooth')).toBe('proxy');
    expect(selectLOD(null, 28, 'balanced')).toBe('low');
    expect(selectLOD(null, 10, 'balanced')).toBe('medium');
  });
  it('holds its previous level during small oscillations across 65 and 32 metre boundaries', () => {
    for (const distance of [64.9, 65.1, 64.8, 65.2]) expect(selectLOD('proxy', distance, 'fine')).toBe('proxy');
    expect(selectLOD('proxy', 58.49, 'fine')).toBe('low');
    expect(selectLOD('low', 71.49, 'fine')).toBe('low');
    expect(selectLOD('low', 71.51, 'fine')).toBe('proxy');
    for (const distance of [31.9, 32.1, 31.8, 32.2]) expect(selectLOD('medium', distance, 'fine')).toBe('medium');
    expect(selectLOD('medium', 35.21, 'fine')).toBe('low');
    expect(selectLOD('low', 28.81, 'fine')).toBe('low');
    expect(selectLOD('low', 28.79, 'fine')).toBe('medium');
  });
  it('uses a guarded original entry while enforcing fine quality and the strict 14 metre radius', () => {
    for (const distance of [13.8, 14.1, 13.9]) expect(selectLOD('medium', distance, 'fine')).toBe('medium');
    expect(selectLOD('medium', 12.59, 'fine')).toBe('original');
    expect(selectLOD('original', 13.99, 'fine')).toBe('original');
    expect(selectLOD('original', 14, 'fine')).toBe('medium');
    expect(selectLOD('original', 1, 'balanced')).toBe('medium');
    expect(selectLOD('original', 1, 'smooth')).toBe('medium');
    expect(selectLOD('proxy', 1, 'fine')).toBe('original');
    expect(selectLOD('original', 100, 'fine')).toBe('proxy');
  });
  it('uses a safe proxy for invalid distances', () => {
    for (const distance of [NaN, Infinity, -Infinity, -1]) {
      expect(selectLOD('original', distance, 'fine')).toBe('proxy');
    }
  });
});

describe('global original geometry budget', () => {
  it('picks the closest three eligible instances with stable ties', () => {
    expect(rankOriginalBudget([9, 4, 2, 8, 2, 14, NaN, -1])).toEqual([2, 4, 1]);
    expect(rankOriginalBudget([1, 2, 3, 4], 100)).toEqual([0, 1, 2]);
    expect(rankOriginalBudget([14, Infinity])).toEqual([]);
    expect(applyOriginalBudget(['original', 'original', 'original', 'original', 'medium'], [4, 3, 2, 1, 0.5], 'fine'))
      .toEqual(['medium', 'original', 'original', 'original', 'medium']);
    expect(applyOriginalBudget(['original', 'low'], [1, 2], 'balanced')).toEqual(['medium', 'low']);
  });
  it('reports eviction before allocation when the closest-three membership changes', () => {
    const budget = new OriginalResidencyBudget();
    expect(budget.reconcile([2, 4, 6, 8])).toEqual({ indices: [0, 1, 2], entered: [0, 1, 2], exited: [] });
    expect(budget.reconcile([2, 4, 10, 1])).toEqual({ indices: [3, 0, 1], entered: [3], exited: [2] });
    expect(budget.reconcile([2, 4, 10, 1], 'smooth')).toEqual({ indices: [], entered: [], exited: [3, 0, 1] });
    budget.reconcile([1, 2]);
    expect(budget.reset()).toEqual([0, 1]);
    expect(budget.reset()).toEqual([]);
  });
});

describe('deduplicated mesh variant leases', () => {
  it('shares one loading promise and retains assets until every reference releases', async () => {
    const dispose = vi.fn(), load = vi.fn(() => ({ id: 'robot-medium' }));
    const cache = new MeshVariantCache(dispose);
    const first = cache.acquire('robot-medium', load, 0);
    const second = cache.acquire('robot-medium', load, 0);
    expect(second).toBe(first);
    await first;
    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.refCount('robot-medium')).toBe(2);
    cache.release('robot-medium', 0);
    cache.collect(100);
    expect(dispose).not.toHaveBeenCalled();
    cache.release('robot-medium', 100);
    expect(cache.collect(107.99)).toEqual([]);
    expect(cache.collect(108)).toEqual(['robot-medium']);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(cache.stats()).toEqual({ entries: 0, ready: 0, pending: 0, references: 0, disposed: 1 });
  });
  it('cancels delayed release on reacquisition and ignores backward real-clock intervals', async () => {
    const dispose = vi.fn(), load = vi.fn(() => 'geometry');
    const cache = new MeshVariantCache(dispose);
    await cache.acquire('part', load, 10);
    cache.release('part', 2);
    cache.collect(17.99);
    await cache.acquire('part', load, 17.99);
    cache.collect(20);
    expect(dispose).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledTimes(1);
    cache.release('part', 20);
    cache.release('part', 25);
    expect(cache.collect(27.99)).toEqual([]);
    expect(cache.collect(28)).toEqual(['part']);
  });
  it('removes rejected loads so a later request can retry the same key', async () => {
    const cache = new MeshVariantCache<string>(() => {});
    const first = cache.acquire('failed', () => Promise.reject(new Error('missing variant')));
    const duplicate = cache.acquire('failed', () => 'unwanted duplicate');
    expect(duplicate).toBe(first);
    await expect(first).rejects.toThrow('missing variant');
    expect(cache.has('failed')).toBe(false);
    await expect(cache.acquire('failed', () => 'recovered')).resolves.toBe('recovered');
    expect(cache.refCount('failed')).toBe(1);
  });
  it('disposes pending values exactly once after eviction and disposes every ready value on shutdown', async () => {
    const disposed: string[] = [];
    const cache = new MeshVariantCache<string>((value) => disposed.push(value));
    let finish!: (value: string) => void;
    const pending = cache.acquire('pending', () => new Promise<string>((resolve) => { finish = resolve; }));
    await Promise.resolve();
    await cache.acquire('ready', () => 'ready-value');
    expect(cache.stats().pending).toBe(1);
    cache.disposeAll();
    expect(disposed).toEqual(['ready-value']);
    finish('late-value');
    await pending;
    cache.disposeAll();
    expect(disposed).toEqual(['ready-value', 'late-value']);
    expect(cache.stats().disposed).toBe(2);
    await expect(cache.acquire('closed', () => 'new')).rejects.toThrow('disposed');
  });
  it('allows immediate unused original eviction while preserving held variants', async () => {
    const dispose = vi.fn(), cache = new MeshVariantCache(dispose);
    await cache.acquire('original', () => 'original');
    expect(cache.evictUnused('original')).toBe(false);
    cache.release('original', 0);
    expect(cache.evictUnused('original')).toBe(true);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(cache.collect(100)).toEqual([]);
  });
  it('collects an abandoned pending request and disposes its eventual value', async () => {
    const dispose = vi.fn(), cache = new MeshVariantCache<string>(dispose);
    let finish!: (value: string) => void;
    const pending = cache.acquire('pending', () => new Promise<string>((resolve) => { finish = resolve; }));
    await Promise.resolve();
    cache.release('pending', 0);
    expect(cache.collect(8)).toEqual(['pending']);
    expect(cache.has('pending')).toBe(false);
    finish('old-load');
    await pending;
    expect(dispose).toHaveBeenCalledWith('old-load', 'pending');
    await expect(cache.acquire('pending', () => 'fresh-load', 8)).resolves.toBe('fresh-load');
  });
});
