import { createCity, DEFAULT_SEED } from '../city/CityData';
import type { Building, City } from '../city/CityData';
import { integrateStructure, newStructure } from '../city/BuildingDamage';
import type { StructureState } from '../city/BuildingDamage';
import { TIDE } from '../city/Terrain';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { FloodSimulation } from '../disasters/FloodSimulation';
import { calmQuake, earthquake } from '../disasters/EarthquakeSimulation';
import { calmWind, wind, WIND_DURATION } from '../disasters/WindSimulation';
import { defaults, HAZARDS, PARAMETERS } from '../disasters/settings';
import type { Hazard, HazardSettings } from '../disasters/settings';
import { SimulationStateMachine, STATE_UI } from '../state/SimulationStateMachine';
import type { Transition } from '../state/SimulationStateMachine';
import { SimulationStore } from '../state/SimulationStore';
import { MetricsCollector, assessBuildings } from '../analytics/MetricsCollector';
import type { Metrics, EventKind } from '../analytics/MetricsCollector';
import { FIXED_DT, SimulationClock } from './SimulationClock';
import type { ClockRate } from './SimulationClock';
import { clamp } from '../utils/math';

const WARNING_TIME = 2.5;
const FLOOD_TIME = 92;
const RECOVERY_TIME = 18;
const FLOOD_SUBSTEPS = 4;
const METRICS_EVERY = 15;

type ModelSnapshot = ReturnType<Simulation['snapshot']>;
export interface CheckpointInfo { id: number; time: number; hazard: Hazard }
interface ReplayCommand { tick: number; kind: 'configure' | 'stop'; key?: string; value?: number }
interface SavedCheckpoint extends CheckpointInfo {
  data: ModelSnapshot;
  replayBase: ModelSnapshot | null;
  commands: ReplayCommand[];
}

export class Simulation {
  readonly structures = new Map<string, StructureState>();
  readonly clock = new SimulationClock();
  readonly machine = new SimulationStateMachine();
  readonly journal = new MetricsCollector();
  readonly flood: FloodSimulation;
  readonly store: SimulationStore<Metrics>;
  private readonly saved: SavedCheckpoint[] = [];
  private nextCheckpoint = 0;
  private replayBase: ModelSnapshot | null = null;
  private commands: ReplayCommand[] = [];
  private applyingReplay = false;
  private replayEpoch = 0;
  replaying = false;
  private phaseAt = 0;
  private impactAt = 0;
  private floodStep = 0;
  private lastWaterMark = 0;
  private needsSample = false;
  private dirty = false;
  private released = false;
  revision = 0;
  session = 0;
  hazard: Hazard = 'flood';
  settings: HazardSettings = defaults();
  quake = calmQuake();
  wind = calmWind();
  rain = 0;
  get remainingWarning() { return Math.max(0, WARNING_TIME - (this.clock.time - this.phaseAt)); }
  get duration() {
    return WARNING_TIME + RECOVERY_TIME + (this.hazard === 'flood' ? FLOOD_TIME
      : this.hazard === 'wind' ? WIND_DURATION : this.settings.quake.duration);
  }

  static async create(seed = DEFAULT_SEED) {
    const city = createCity(seed);
    return new Simulation(city, await PhysicsWorld.create(city, FIXED_DT));
  }

  private constructor(readonly city: City, readonly physics: PhysicsWorld) {
    this.flood = new FloodSimulation(city.terrain);
    this.store = new SimulationStore(this.metrics());
    this.machine.send('READY');
    this.initializeBaseline('子午港数字孪生就绪', false);
  }

  private initializeBaseline(message: string, rebuild = true) {
    this.machine.send('REBASE');
    if (rebuild) this.physics.reset();
    this.clock.reset();
    this.journal.reset();
    this.structures.clear();
    for (const b of this.city.buildings) this.structures.set(b.id, newStructure());
    this.phaseAt = this.impactAt = this.floodStep = 0;
    this.replayBase = null;
    this.commands = [];
    this.wind = calmWind();
    this.quake = calmQuake();
    this.rain = 0;
    this.flood.reset(this.hazard === 'flood' ? this.settings.flood.initial : TIDE);
    this.lastWaterMark = this.flood.head;
    this.updateStructures(false, false);
    this.record('system', message);
    this.session++;
    this.revision++;
    this.publish();
  }

  private record(kind: EventKind, label: string) {
    this.journal.log(this.clock.time, kind, label);
    this.needsSample = true;
  }

  private transition(event: Transition, label?: string) {
    const before = this.machine.phase;
    if (!this.machine.send(event)) return false;
    if (before !== this.machine.phase) {
      this.phaseAt = this.clock.time;
    }
    const state = this.machine.state;
    this.record(event === 'IMPACT' ? 'impact' : 'state', label ?? STATE_UI[state].title);
    return true;
  }

  start() {
    if (!this.machine.allows('start')) return false;
    if (this.machine.phase === 'COMPLETED') {
      const rate = this.clock.rate;
      this.initializeBaseline('新一轮演练就绪');
      this.clock.rate = rate;
    }
    if (!this.transition('ARM', `${HAZARDS[this.hazard].name}预警开始`)) return false;
    this.replayBase = this.snapshot();
    this.publish();
    return true;
  }

  pause() {
    if (!this.transition('PAUSE', '暂停模拟')) return false;
    this.publish();
    return true;
  }

  resume() {
    if (!this.transition('RESUME', '继续模拟')) return false;
    this.publish();
    return true;
  }

  stop() {
    if (!this.machine.allows('stop')) return false;
    this.rememberCommand({ tick: this.clock.ticks, kind: 'stop' });
    if (!this.transition('END', `${HAZARDS[this.hazard].name}结束，进入恢复`)) return false;
    this.wind = calmWind();
    this.quake = calmQuake();
    this.rain = 0;
    this.revision++;
    this.publish();
    return true;
  }

  reset() {
    if (!this.machine.allows('reset')) return;
    this.cancelReplay();
    this.settings = defaults();
    this.initializeBaseline('已重置场景与灾害参数');
  }

  select(hazard: Hazard) {
    if (!this.machine.allows('configure') || !Object.hasOwn(HAZARDS, hazard) || hazard === this.hazard) return;
    this.cancelReplay();
    this.hazard = hazard;
    this.initializeBaseline(`已载入${HAZARDS[hazard].name}情景`);
  }

  configure(key: string, value: number) {
    if (!this.machine.allows('configure') || !Number.isFinite(value)) return;
    const spec = PARAMETERS[this.hazard].find(param => param.key === key);
    if (!spec) return;
    if (this.replaying && !this.applyingReplay) return;
    this.rememberCommand({ tick: this.clock.ticks, kind: 'configure', key, value });
    const params: Record<string, number> = this.settings[this.hazard];
    params[key] = clamp(value, spec.min, spec.max);
    const running = this.isImpact();
    if (this.hazard === 'flood') {
      if (this.machine.phase === 'NORMAL' || this.machine.phase === 'WARNING') this.flood.reset(this.settings.flood.initial);
      else if (running && (key === 'initial' || key === 'growth')) this.flood.setHead(this.floodTarget());
      if (running) this.rain = this.settings.flood.rain;
      this.updateStructures(false, false);
    } else if (running) {
      this.evaluateForcing();
    }
    if (this.hazard === 'flood' && (key === 'initial' || key === 'growth')) {
      this.record('water', `边界水位 ${this.flood.head.toFixed(2)} m`);
    }
    this.revision++;
    this.publish();
  }

  speed(rate: ClockRate) {
    if (rate !== 1 && rate !== 2 && rate !== 5) return;
    this.clock.rate = rate;
    this.publish();
  }

  canAdvance() { return !this.released && !this.replaying && this.machine.isTicking() && this.machine.state !== 'PAUSED'; }

  advance(wall: number) {
    if (!this.canAdvance()) return 0;
    const count = this.clock.advance(wall, () => {
      this.tick();
      return this.machine.isTicking();
    });
    if (this.dirty) this.publish();
    return count;
  }

  stepOnce() {
    if (this.replaying || !this.machine.allows('step')) return false;
    this.tick();
    this.publish();
    return true;
  }

  async seek(fraction: number, onProgress?: (fraction: number) => void) {
    if (!Number.isFinite(fraction) || !this.machine.allows('configure') || !this.replayBase) return false;
    const request = ++this.replayEpoch;
    const target = Math.round(clamp(fraction, 0, 1) * this.duration / FIXED_DT);
    const source = this.replayBase;
    const commands = this.commands.slice();
    const rate = this.clock.rate;
    this.replaying = true;
    try {
      this.loadSnapshot(source);
      let cursor = 0;
      const applyCommands = () => {
        this.applyingReplay = true;
        try {
          while (cursor < commands.length && commands[cursor].tick <= this.clock.ticks) {
            const command = commands[cursor++];
            if (command.kind === 'configure') this.configure(command.key!, command.value!);
            else this.stop();
          }
        } finally { this.applyingReplay = false; }
      };
      while (this.clock.ticks < target && this.machine.isTicking()) {
        if (request !== this.replayEpoch || this.released) return false;
        const end = Math.min(target, this.clock.ticks + 90);
        while (this.clock.ticks < end && this.machine.isTicking()) {
          applyCommands();
          this.tick();
        }
        onProgress?.(Math.min(1, this.clock.ticks / Math.max(target, 1)));
        await new Promise<void>(resolve => setTimeout(resolve, 0));
      }
      if (request !== this.replayEpoch || this.released) return false;
      applyCommands();
      this.replaying = false;
      this.clock.rate = rate;
      if (this.machine.allows('pause')) this.transition('PAUSE', '时间轴已定位并暂停');
      this.revision++;
      this.record('checkpoint', `回放定位 ${this.clock.time.toFixed(1)} s`);
      this.publish();
      return true;
    } finally {
      if (request === this.replayEpoch) this.replaying = false;
    }
  }

  private rememberCommand(command: ReplayCommand) {
    if (!this.replayBase || this.replaying) return;
    this.commands = this.commands.filter(item => item.tick <= this.clock.ticks);
    this.commands.push(command);
  }

  cancelReplay() {
    this.replayEpoch++;
    this.replaying = false;
  }

  private isImpact() {
    return this.machine.phase === 'DISASTER_ACTIVE' || this.machine.phase === 'CRITICAL';
  }

  private floodTarget() { return this.settings.flood.initial + this.settings.flood.growth * (this.clock.time - this.impactAt); }

  private evaluateForcing() {
    const age = this.clock.time - this.impactAt;
    if (this.isImpact() && this.hazard === 'quake') this.quake = earthquake(this.settings.quake, age);
    else this.quake = calmQuake();
    if (this.isImpact() && this.hazard === 'wind') this.wind = wind(this.settings.wind, age, this.city.seed);
    else this.wind = calmWind();
    this.rain = this.isImpact() && this.hazard !== 'quake' ? this.settings[this.hazard].rain : 0;
  }

  private tick() {
    const time = this.clock.next();
    if (this.machine.phase === 'WARNING' && time >= this.phaseAt + WARNING_TIME - 1e-8) {
      this.impactAt = time;
      this.transition('IMPACT', `${HAZARDS[this.hazard].name}发生`);
    }
    if (this.isImpact()) {
      const duration = this.hazard === 'quake' ? this.settings.quake.duration : this.hazard === 'wind' ? WIND_DURATION : FLOOD_TIME;
      if (time >= this.impactAt + duration - 1e-8) this.transition('END', `${HAZARDS[this.hazard].name}结束，进入恢复`);
    }
    this.evaluateForcing();
    if (this.isImpact() || this.machine.phase === 'RECOVERY') {
      if (++this.floodStep === FLOOD_SUBSTEPS) {
        this.floodStep = 0;
        const target = this.isImpact() && this.hazard === 'flood' ? this.floodTarget()
          : Math.max(TIDE, this.flood.head - 0.23 * FIXED_DT * FLOOD_SUBSTEPS);
        this.flood.step(this.settings.flood, this.rain, target);
        if (Math.abs(this.flood.head - this.lastWaterMark) >= 1) {
          this.lastWaterMark = this.flood.head;
          this.record('water', `边界水位 ${this.flood.head.toFixed(2)} m`);
        }
      }
    }
    this.updateStructures(true, this.isImpact());
    this.physics.step(time, {
      ground: { x: -this.quake.ax, z: -this.quake.az },
      wind: this.wind,
      depth: (x, z) => this.flood.depth(x, z),
      level: (x, z) => this.flood.level(x, z),
    });
    if (this.machine.phase === 'DISASTER_ACTIVE') {
      const stats = assessBuildings(this.structures.values());
      if (stats.collapsed > 0 || stats.damaged >= 5 || this.flood.head >= 5.6 || this.wind.speed >= 56) {
        this.transition('ESCALATE', '进入危险状态');
      }
    }
    if (this.machine.phase === 'RECOVERY' && time >= this.phaseAt + RECOVERY_TIME - 1e-8) {
      this.transition('SETTLED', '本轮模拟完成');
    }
    this.revision++;
    if (this.needsSample || this.clock.ticks % METRICS_EVERY === 0) {
      this.journal.record(this.metrics());
      this.needsSample = false;
      this.dirty = true;
    }
  }

  depthAtBuilding(spec: Building) {
    const depth = (x: number, z: number) => this.flood.depth(x, z);
    return (depth(spec.x, spec.z) * 2 +
      depth(spec.x + spec.width * 0.37, spec.z) + depth(spec.x - spec.width * 0.37, spec.z) +
      depth(spec.x, spec.z + spec.depth * 0.45) + depth(spec.x, spec.z - spec.depth * 0.45)) / 6;
  }

  private updateStructures(integrate: boolean, fatigue: boolean) {
    for (const b of this.city.buildings) {
      const state = this.structures.get(b.id)!;
      const before = state.condition;
      const exposure = 0.74 + b.height / 96;
      const loadX = -this.quake.ax + 0.0072 * this.wind.speed * this.wind.x * exposure;
      const loadZ = -this.quake.az + 0.0072 * this.wind.speed * this.wind.z * exposure;
      integrateStructure(b, state, integrate ? FIXED_DT : 0, loadX, loadZ, this.depthAtBuilding(b), fatigue);
      if (before !== state.condition) {
        if (state.condition === 'collapsed') {
          this.physics.collapse(b, this.clock.time, clamp(state.x, -1.7, 1.7), clamp(state.z, -1.7, 1.7));
          this.record('collapse', `${b.id} ${b.name}坍塌`);
        } else if (state.condition === 'damaged') this.record('damage', `${b.id} ${b.name}结构受损`);
        else if (state.condition === 'inundated' && integrate) this.record('water', `${b.id} ${b.name}积水`);
      }
    }
  }

  metrics(): Metrics {
    const intensity = this.hazard === 'flood' ? this.flood.head
      : this.hazard === 'quake' ? this.settings.quake.magnitude * this.quake.envelope : this.wind.speed;
    return {
      time: this.clock.time, hazard: this.hazard, state: this.machine.state, intensity, water: this.flood.head,
      wind: this.wind.speed, ...assessBuildings(this.structures.values()), objects: this.physics.count,
    };
  }

  private publish() {
    if (this.replaying) return;
    const data = this.metrics();
    this.journal.record(data);
    this.store.publish(data);
    this.needsSample = this.dirty = false;
  }

  private snapshot() {
    return {
      clock: this.clock.checkpoint(), machine: this.machine.checkpoint(), flood: this.flood.checkpoint(),
      physics: this.physics.checkpoint(), journal: this.journal.checkpoint(), hazard: this.hazard,
      settings: structuredClone(this.settings), structures: Array.from(this.structures, ([id, state]) => [id, { ...state }] as const),
      phaseAt: this.phaseAt, impactAt: this.impactAt,
      floodStep: this.floodStep, lastWaterMark: this.lastWaterMark,
    };
  }

  checkpoints(): CheckpointInfo[] { return this.saved.map(({ id, time, hazard }) => ({ id, time, hazard })); }

  save() {
    if (this.replaying || !this.machine.allows('save')) return null;
    const id = ++this.nextCheckpoint;
    this.record('checkpoint', `保存检查点 CP-${String(id).padStart(2, '0')}`);
    const checkpoint: SavedCheckpoint = {
      id, time: this.clock.time, hazard: this.hazard, data: this.snapshot(),
      replayBase: this.replayBase, commands: structuredClone(this.commands),
    };
    this.saved.unshift(checkpoint);
    if (this.saved.length > 6) this.saved.pop();
    this.publish();
    checkpoint.data = this.snapshot();
    return id;
  }

  restore(id: number) {
    const checkpoint = this.saved.find(item => item.id === id);
    if (!checkpoint || !this.machine.allows('restore')) return false;
    this.cancelReplay();
    this.loadSnapshot(checkpoint.data);
    this.replayBase = checkpoint.replayBase;
    this.commands = structuredClone(checkpoint.commands);
    this.session++;
    this.record('checkpoint', `恢复检查点 CP-${String(id).padStart(2, '0')}`);
    this.publish();
    return true;
  }

  private loadSnapshot(saved: ModelSnapshot) {
    this.physics.restore(saved.physics);
    this.machine.restore(saved.machine);
    this.flood.restore(saved.flood);
    this.clock.restore(saved.clock);
    this.journal.restore(saved.journal);
    this.hazard = saved.hazard;
    this.settings = structuredClone(saved.settings);
    this.structures.clear();
    for (const [id, state] of saved.structures) this.structures.set(id, { ...state });
    this.phaseAt = saved.phaseAt;
    this.impactAt = saved.impactAt;
    this.floodStep = saved.floodStep;
    this.lastWaterMark = saved.lastWaterMark;
    this.evaluateForcing();
    this.revision++;
  }

  dispose() {
    if (this.released) return;
    this.released = true;
    this.cancelReplay();
    this.physics.dispose();
    this.store.dispose();
    this.saved.length = 0;
  }
}
