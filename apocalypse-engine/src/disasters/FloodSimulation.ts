import { GRID, TIDE, coastZ, canalX } from '../city/Terrain';
import type { Terrain } from '../city/Terrain';
import type { HazardSettings } from './settings';
import { clamp } from '../utils/math';

export const FLOOD_DT = 1 / 15;
const MAX_HEAD = 12;
const CELL_AREA = GRID.spacing ** 2;
const COUNT = GRID.width * GRID.height;

export interface FloodSnapshot {
  head: number;
  depths: Float32Array;
}

export class FloodSimulation {
  readonly depths = new Float32Array(COUNT);
  readonly source = new Uint8Array(COUNT);
  readonly surface = new Float32Array(COUNT);
  private fluxX = new Float32Array(COUNT);
  private fluxZ = new Float32Array(COUNT);
  private outgoing = new Float32Array(COUNT);
  private change = new Float32Array(COUNT);
  head = TIDE;

  constructor(readonly terrain: Terrain) {
    for (let row = 0; row < GRID.height; row++) {
      const z = terrain.z(row);
      for (let column = 0; column < GRID.width; column++) {
        const x = terrain.x(column);
        const marina = z > 41 && z < 51 && ((x > 54 && x < 103) || (x > 21 && x < 39));
        this.source[row * GRID.width + column] = terrain.ocean[row * GRID.width + column] ||
          z > coastZ(x) - 1.5 || (z > 38 && Math.abs(x - canalX(z)) < 10) || marina ? 1 : 0;
      }
    }
    this.reset();
  }

  reset(head = TIDE) {
    this.head = clamp(head, TIDE, MAX_HEAD);
    for (let index = 0; index < COUNT; index++) {
      this.depths[index] = this.source[index] ? Math.max(0, this.head - this.terrain.heights[index])
        : this.terrain.channels[index] ? Math.max(0, TIDE - this.terrain.heights[index]) : 0;
    }
    this.updateSurface();
  }

  setHead(head: number) {
    this.head = clamp(head, TIDE, MAX_HEAD);
    for (let index = 0; index < COUNT; index++) {
      if (this.source[index]) this.depths[index] = Math.max(0, this.head - this.terrain.heights[index]);
    }
    this.updateSurface();
  }

  private updateSurface() {
    for (let index = 0; index < COUNT; index++) this.surface[index] = this.terrain.heights[index] + this.depths[index];
  }

  depth(x: number, z: number) { return this.terrain.sample(this.depths, x, z); }
  level(x: number, z: number) { return this.terrain.sample(this.surface, x, z); }
  volume() { return this.depths.reduce((sum, depth) => sum + depth * CELL_AREA, 0); }

  step(settings: HazardSettings['flood'], rain: number, target: number | null, dt = FLOOD_DT) {
    const head = target === null ? this.head : clamp(target, TIDE, MAX_HEAD);
    if (target !== null && head !== this.head) this.setHead(head);
    this.outgoing.fill(0);
    this.change.fill(0);
    const fluxX = this.fluxX;
    const fluxZ = this.fluxZ;
    const runoff = rain / 3_600_000;
    const scale = settings.spread * dt * Math.sqrt(9.81) / GRID.spacing;
    const depths = this.depths;
    const surface = this.surface;
    const heights = this.terrain.heights;
    const outgoing = this.outgoing;
    const flow = (from: number, to: number) => {
      const headDiff = surface[from] - surface[to];
      const donor = headDiff >= 0 ? from : to;
      const wetCrossSection = Math.max(0, surface[donor] - Math.max(heights[from], heights[to]));
      if (depths[donor] < 1e-6 || wetCrossSection < 1e-6) return 0;
      const amount = headDiff * Math.sqrt(Math.min(wetCrossSection, 4)) * scale;
      outgoing[donor] += Math.abs(amount);
      return amount;
    };
    for (let row = 0; row < GRID.height; row++) {
      for (let column = 0; column < GRID.width; column++) {
        const index = row * GRID.width + column;
        if (column < GRID.width - 1) fluxX[index] = flow(index, index + 1);
        if (row < GRID.height - 1) fluxZ[index] = flow(index, index + GRID.width);
      }
    }
    const change = this.change;
    const exchange = (from: number, to: number, flowDepth: number) => {
      if (!flowDepth) return;
      const donor = flowDepth > 0 ? from : to;
      const limited = flowDepth * Math.min(1, depths[donor] * 0.94 / outgoing[donor]);
      change[from] -= limited;
      change[to] += limited;
    };
    for (let row = 0; row < GRID.height; row++) {
      for (let column = 0; column < GRID.width; column++) {
        const index = row * GRID.width + column;
        if (column < GRID.width - 1) exchange(index, index + 1, fluxX[index]);
        if (row < GRID.height - 1) exchange(index, index + GRID.width, fluxZ[index]);
      }
    }
    const efficiency = settings.drain / 100;
    for (let index = 0; index < COUNT; index++) {
      if (target !== null && this.source[index]) {
        depths[index] = Math.max(0, head - heights[index]);
      } else {
        const collected = runoff * (this.terrain.channels[index] ? 1 : 2 + 5 * this.terrain.drainage[index]);
        const pump = (1 - Math.exp(-depths[index] * 2.1)) * efficiency * this.terrain.drainage[index] * 0.085;
        depths[index] = Math.max(0, depths[index] + change[index] + (collected - pump) * dt);
      }
    }
    this.updateSurface();
  }

  checkpoint(): FloodSnapshot { return { head: this.head, depths: this.depths.slice() }; }
  restore(snapshot: FloodSnapshot) {
    this.head = snapshot.head;
    this.depths.set(snapshot.depths);
    this.updateSurface();
  }
}
