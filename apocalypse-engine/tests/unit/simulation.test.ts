import { afterAll, describe, expect, it } from 'vitest';
import { createCity } from '../../src/city/CityData';
import { classify, integrateStructure, newStructure } from '../../src/city/BuildingDamage';
import { FloodSimulation } from '../../src/disasters/FloodSimulation';
import { defaults } from '../../src/disasters/settings';
import { earthquake } from '../../src/disasters/EarthquakeSimulation';
import { wind } from '../../src/disasters/WindSimulation';
import { FIXED_DT, SimulationClock } from '../../src/core/SimulationClock';
import { Simulation } from '../../src/core/Simulation';
import { SimulationStateMachine } from '../../src/state/SimulationStateMachine';
import { assessBuildings, MetricsCollector } from '../../src/analytics/MetricsCollector';
import { FAULTS, runFaultRegression } from '../../src/testing/FaultRegressions';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

describe('coastal digital twin', () => {
  const faultOutcomes: Awaited<ReturnType<typeof runFaultRegression>>[] = [];

  it('builds a seeded non-uniform city with complete infrastructure', () => {
    const first = createCity(43107);
    const second = createCity(43107);
    expect(first.buildings).toHaveLength(23);
    expect(first.terrain.heights).toHaveLength(61 * 55);
    expect(first.buildings.map(({ id, x, z, height }) => [id, x, z, height]))
      .toEqual(second.buildings.map(({ id, x, z, height }) => [id, x, z, height]));
    expect(new Set(first.buildings.map(item => item.style)).size).toBeGreaterThan(2);
    expect(new Set(first.buildings.map(item => item.structure)).size).toBe(3);
    expect(first.bridges).toHaveLength(3);
    expect(first.trees.length).toBeGreaterThan(50);
    expect(first.props).toHaveLength(15);
  });

  it('propagates shallow water without negative depths or creating mass', () => {
    const terrain = createCity().terrain;
    const flood = new FloodSimulation(terrain);
    const baseline = flood.volume();
    const settings = defaults().flood;
    for (let step = 0; step < 60; step++) flood.step({ ...settings, drain: 0 }, 0, null);
    expect(flood.depths.every(depth => Number.isFinite(depth) && depth >= 0)).toBe(true);
    expect(flood.volume()).toBeCloseTo(baseline, 1);
    expect(flood.depth(-120, -106)).toBe(0);
  });

  it('enforces flood boundary water levels and checkpoint copies', () => {
    const flood = new FloodSimulation(createCity().terrain);
    flood.setHead(5);
    expect(flood.head).toBe(5);
    expect(flood.depths.some((depth, index) => flood.source[index] === 1 && depth > 3)).toBe(true);
    const snapshot = flood.checkpoint();
    const head = flood.depths[100];
    flood.setHead(7);
    flood.restore(snapshot);
    expect(flood.head).toBe(5);
    expect(flood.depths[100]).toBe(head);
    expect(flood.surface[100]).toBeCloseTo(flood.terrain.heights[100] + head);
  });

  it('uses deterministic earthquake motion and bounded shaking', () => {
    const settings = defaults().quake;
    const first = earthquake(settings, 3.5);
    expect(earthquake(settings, 3.5)).toEqual(first);
    expect(Math.hypot(first.ax, first.az)).toBeLessThan(49);
    expect(first.envelope).toBeGreaterThan(0);
    expect(earthquake(settings, settings.duration)).toEqual({ x: 0, z: 0, ax: 0, az: 0, envelope: 0 });
  });

  it('uses seeded directional gusts and ends wind forcing', () => {
    const settings = defaults().wind;
    const first = wind(settings, 17, 43107);
    expect(wind(settings, 17, 43107)).toEqual(first);
    expect(wind(settings, 17, 43108)).not.toEqual(first);
    expect(first.speed).toBeGreaterThan(0);
    expect(Math.hypot(first.x, first.z)).toBeCloseTo(first.speed, 6);
    expect(wind(settings, 90, 43107)).toEqual({ speed: 0, x: 0, z: 0, direction: 0 });
  });

  it('applies building damage and distinct structural response', () => {
    const city = createCity();
    const buildings = [city.buildings.find(item => item.structure === 'frame')!, city.buildings.find(item => item.structure === 'isolated')!];
    const outputs = buildings.map(building => {
      const state = newStructure();
      for (let step = 0; step < 300; step++) integrateStructure(building, state, FIXED_DT, 45, 8, 0, true);
      return state;
    });
    expect(outputs[0].x).not.toBeCloseTo(outputs[1].x, 4);
    expect(outputs.every(item => item.damage > 0 && item.damage <= 1)).toBe(true);
    expect(classify(0.2, 0)).toBe('damaged');
    expect(classify(1, 0)).toBe('collapsed');
    expect(classify(0, 0.24)).toBe('inundated');
  });

  it('enforces legal state transitions and pause checkpoint guards', () => {
    const machine = new SimulationStateMachine();
    expect(machine.send('IMPACT')).toBe(false);
    expect(machine.allows('start')).toBe(false);
    expect(machine.send('READY')).toBe(true);
    expect(machine.send('ARM')).toBe(true);
    expect(machine.send('ESCALATE')).toBe(false);
    expect(machine.send('IMPACT')).toBe(true);
    expect(machine.send('PAUSE')).toBe(true);
    expect(machine.state).toBe('PAUSED');
    expect(machine.restore({ phase: 'INITIALIZING', paused: false })).toBe(false);
    expect(machine.send('END')).toBe(true);
    expect(machine.state).toBe('RECOVERY');
    expect(machine.send('SETTLED')).toBe(true);
    expect(machine.state).toBe('COMPLETED');
  });

  it('advances only fixed clock steps and keeps rate bounded', () => {
    const clock = new SimulationClock();
    expect(clock.advance(0.1, () => { clock.next(); return true; })).toBe(6);
    expect(clock.time).toBeCloseTo(6 * FIXED_DT, 9);
    clock.rate = 5;
    expect(clock.advance(0.24, () => { clock.next(); return true; })).toBe(72);
    const saved = clock.checkpoint();
    clock.advance(0.1, () => { clock.next(); return true; });
    clock.restore(saved);
    expect(clock.checkpoint()).toEqual(saved);
    expect(clock.advance(Number.NaN, () => { clock.next(); return true; })).toBe(0);
  });

  it('reports affected, damaged and collapsed structures from one source', () => {
    const first = newStructure();
    const second = newStructure();
    first.condition = 'inundated';
    second.condition = 'collapsed';
    second.damage = 1;
    expect(assessBuildings([first, second])).toEqual({ affected: 2, damaged: 1, collapsed: 1 });
    const collector = new MetricsCollector();
    collector.record({ time: 0, hazard: 'flood', state: 'NORMAL', intensity: 2, water: 2, wind: 0, affected: 0, damaged: 0, collapsed: 0, objects: 41 });
    collector.log(0, 'state', 'READY');
    const saved = collector.checkpoint();
    collector.reset();
    collector.restore(saved);
    expect(collector.events[0].label).toBe('READY');
    expect(collector.samples[0].objects).toBe(41);
  });

  it('keeps hazards synchronized through start, pause, reset and restore', async () => {
    const simulation = await Simulation.create(43107);
    try {
      expect(simulation.city.buildings).toHaveLength(23);
      expect(simulation.physics.joints).toBe(1);
      expect(simulation.start()).toBe(true);
      simulation.advance(0.24);
      expect(simulation.machine.phase).toBe('WARNING');
      expect(simulation.pause()).toBe(true);
      const frozen = simulation.clock.time;
      simulation.advance(0.24);
      expect(simulation.clock.time).toBe(frozen);
      expect(simulation.stepOnce()).toBe(true);
      expect(simulation.clock.time).toBeGreaterThan(frozen);
      const checkpoint = simulation.save();
      simulation.configure('initial', 5);
      expect(simulation.metrics().water).toBe(5);
      expect(simulation.restore(checkpoint!)).toBe(true);
      expect(simulation.settings.flood.initial).toBe(defaults().flood.initial);
      expect(simulation.metrics().state).toBe('PAUSED');
      simulation.select('wind');
      expect(simulation.metrics().hazard).toBe('wind');
      expect(simulation.rain).toBe(0);
      expect(simulation.wind.speed).toBe(0);
      simulation.reset();
      expect(simulation.metrics().state).toBe('NORMAL');
      expect(simulation.metrics().water).toBe(0.65);
      expect(simulation.flood.head).toBe(0.65);
      expect(simulation.physics.dynamics.size).toBe(16);
    } finally {
      simulation.dispose();
    }
  });

  it('replays parameter commands and restores the same Rapier state twice', async () => {
    const simulation = await Simulation.create(43107);
    try {
      simulation.configure('growth', 0.16);
      simulation.start();
      for (let step = 0; step < 13; step++) simulation.advance(0.24);
      simulation.configure('growth', 0.22);
      for (let step = 0; step < 5; step++) simulation.advance(0.24);
      const checkpoint = simulation.save()!;
      simulation.advance(0.24);
      expect(simulation.restore(checkpoint)).toBe(true);
      const first = {
        time: simulation.clock.time, phase: simulation.machine.phase, head: simulation.flood.head,
        growth: simulation.settings.flood.growth, bodies: simulation.physics.count,
      };
      expect(simulation.restore(checkpoint)).toBe(true);
      expect({
        time: simulation.clock.time, phase: simulation.machine.phase, head: simulation.flood.head,
        growth: simulation.settings.flood.growth, bodies: simulation.physics.count,
      }).toEqual(first);
      const reached = await simulation.seek(0.25);
      expect(reached).toBe(true);
      expect(simulation.clock.time).toBeGreaterThan(0);
      expect(simulation.machine.state).toBe('PAUSED');
      expect(simulation.canAdvance()).toBe(false);
    } finally {
      simulation.dispose();
    }
  });

  expect(FAULTS).toHaveLength(8);
  it.each(FAULTS)('detects, repairs and verifies $name', async fault => {
    const outcome = await runFaultRegression(fault.id);
    faultOutcomes.push(outcome);
    expect(outcome.injected.passed, outcome.injected.evidence).toBe(false);
    expect(outcome.repaired.passed, outcome.repaired.evidence).toBe(true);
    expect(outcome.passed, outcome.evidence).toBe(true);
    expect(outcome.reproduction.length).toBeGreaterThan(8);
    expect(outcome.rootCause.length).toBeGreaterThan(8);
    expect(outcome.evidence.length).toBeGreaterThan(8);
  });

  afterAll(async () => {
    if (!faultOutcomes.length) return;
    await mkdir(resolve(process.cwd(), 'reports'), { recursive: true });
    await writeFile(resolve(process.cwd(), 'reports/fault-regressions.json'), JSON.stringify({
      timestamp: new Date().toISOString(),
      total: faultOutcomes.length,
      passed: faultOutcomes.filter(item => item.passed).length,
      failed: faultOutcomes.filter(item => !item.passed).length,
      cases: faultOutcomes,
    }, null, 2));
  });
});
