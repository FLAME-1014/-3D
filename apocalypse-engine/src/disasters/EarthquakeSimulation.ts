import type { HazardSettings } from './settings';
import { clamp } from '../utils/math';

export interface QuakeResult {
  x: number;
  z: number;
  ax: number;
  az: number;
  envelope: number;
}

export const calmQuake = (): QuakeResult => ({ x: 0, z: 0, ax: 0, az: 0, envelope: 0 });

export function earthquake(params: HazardSettings['quake'], age: number): QuakeResult {
  if (age < 0 || age >= params.duration) return calmQuake();
  const envelope = clamp(age / 1.4, 0, 1) * clamp((params.duration - age) / 3, 0, 1) *
    (0.76 + 0.24 * Math.sin(age * 0.81) ** 2);
  const amplitude = params.displacement * Math.pow(10, (params.magnitude - 7) * 0.32) * envelope;
  const omega = 2 * Math.PI * params.frequency;
  const phase = age * omega;
  const x = amplitude * (0.73 * Math.sin(phase) + 0.22 * Math.sin(phase * 0.61 + 0.4));
  const z = amplitude * (0.63 * Math.sin(phase * 0.84 + 1.1) + 0.17 * Math.cos(phase * 1.37));
  const ax = -amplitude * omega ** 2 * (0.73 * Math.sin(phase) + 0.22 * 0.61 ** 2 * Math.sin(phase * 0.61 + 0.4));
  const az = -amplitude * omega ** 2 * (0.63 * 0.84 ** 2 * Math.sin(phase * 0.84 + 1.1) + 0.17 * 1.37 ** 2 * Math.cos(phase * 1.37));
  return { x, z, ax: clamp(ax, -34, 34), az: clamp(az, -34, 34), envelope };
}
