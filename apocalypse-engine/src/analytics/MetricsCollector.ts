import type { Hazard } from '../disasters/settings';
import type { StructureState } from '../city/BuildingDamage';
import type { SimulationState } from '../state/SimulationStateMachine';

export interface Metrics {
  time: number;
  hazard: Hazard;
  state: SimulationState;
  intensity: number;
  water: number;
  wind: number;
  affected: number;
  damaged: number;
  collapsed: number;
  objects: number;
}

export type EventKind = 'system' | 'state' | 'impact' | 'damage' | 'collapse' | 'water' | 'checkpoint';
export interface JournalEvent { id: number; time: number; kind: EventKind; label: string }

export function assessBuildings(structures: Iterable<StructureState>) {
  let affected = 0;
  let damaged = 0;
  let collapsed = 0;
  for (const item of structures) {
    if (item.condition !== 'intact') affected++;
    if (item.condition === 'damaged' || item.condition === 'collapsed') damaged++;
    if (item.condition === 'collapsed') collapsed++;
  }
  return { affected, damaged, collapsed };
}

export class MetricsCollector {
  readonly samples: Metrics[] = [];
  readonly events: JournalEvent[] = [];
  private lastId = 0;

  record(metrics: Metrics) {
    if (this.samples.at(-1)?.time === metrics.time) this.samples[this.samples.length - 1] = metrics;
    else this.samples.push(metrics);
    if (this.samples.length > 1500) this.samples.shift();
  }

  log(time: number, kind: EventKind, label: string) {
    this.events.push({ id: ++this.lastId, time, kind, label });
    if (this.events.length > 220) this.events.shift();
  }

  reset() { this.samples.length = 0; this.events.length = 0; this.lastId = 0; }

  checkpoint() { return structuredClone({ samples: this.samples, events: this.events, lastId: this.lastId }); }
  restore(snapshot: ReturnType<MetricsCollector['checkpoint']>) {
    this.reset();
    this.samples.push(...snapshot.samples.map(item => ({ ...item })));
    this.events.push(...snapshot.events.map(item => ({ ...item })));
    this.lastId = snapshot.lastId;
  }
}
