import type { HazardSettings } from './settings';
import { clamp } from '../utils/math';

export interface WindResult { speed: number; x: number; z: number; direction: number }
export const calmWind = (): WindResult => ({ speed: 0, x: 0, z: 0, direction: 0 });
export const WIND_DURATION = 86;

export function wind(params: HazardSettings['wind'], age: number, seed: number): WindResult {
  if (age < 0 || age >= WIND_DURATION) return calmWind();
  const phase = (seed % 163) * 0.19;
  const gust = 0.69 * Math.sin(age * 0.71 + phase) + 0.31 * Math.sin(age * 2.31 - phase);
  const onset = clamp(age / 2.8, 0, 1) * clamp((WIND_DURATION - age) / 4, 0, 1);
  const speed = params.speed * onset * (1 + params.gust / 100 * gust);
  const direction = (params.direction + 360 + params.gust * 0.19 * Math.sin(age * 0.29 + phase)) % 360;
  const angle = direction * Math.PI / 180;
  return { speed, x: -speed * Math.sin(angle), z: speed * Math.cos(angle), direction };
}
