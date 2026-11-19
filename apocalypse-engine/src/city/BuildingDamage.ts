import type { Building } from './CityData';
import { clamp } from '../utils/math';

export type Condition = 'intact' | 'inundated' | 'damaged' | 'collapsed';
export interface StructureState {
  damage: number;
  depth: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  condition: Condition;
}

export const newStructure = (): StructureState => ({
  damage: 0, depth: 0, x: 0, z: 0, vx: 0, vz: 0, condition: 'intact',
});

export function classify(damage: number, depth: number): Condition {
  if (damage >= 1) return 'collapsed';
  if (damage >= 0.2) return 'damaged';
  return depth > 0.23 ? 'inundated' : 'intact';
}

export function integrateStructure(
  building: Building, state: StructureState, dt: number,
  loadX: number, loadZ: number, depth: number, fatigue: boolean,
) {
  state.depth = depth;
  if (state.condition === 'collapsed') return state.condition;
  const omega = 2 * Math.PI * building.frequency;
  const spring = omega ** 2 * (1 - 0.52 * state.damage);
  const damping = 2 * building.damping * omega;
  const isolation = building.structure === 'isolated' ? 0.52 : 1;
  state.vx += (loadX * isolation - spring * state.x - damping * state.vx) * dt;
  state.vz += (loadZ * isolation - spring * state.z - damping * state.vz) * dt;
  state.x += state.vx * dt;
  state.z += state.vz * dt;
  const demand = Math.hypot(state.x, state.z) / (building.height * building.driftLimit);
  if (fatigue) {
    const structural = Math.max(0, demand - 0.85) ** 1.5 * 0.18;
    const surcharge = Math.max(0, depth - (building.structure === 'isolated' ? 1.8 : 1.15)) * 0.024;
    state.damage = clamp(state.damage + dt * (structural + surcharge), 0, 1);
  }
  return state.condition = classify(state.damage, depth);
}
