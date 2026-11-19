export type Hazard = 'flood' | 'quake' | 'wind';
export type HazardSettings = {
  flood: { initial: number; growth: number; rain: number; spread: number; drain: number };
  quake: { magnitude: number; frequency: number; duration: number; displacement: number };
  wind: { speed: number; direction: number; gust: number; rain: number };
};

export const HAZARDS = {
  flood: { name: '洪水', english: 'FLOOD', icon: 'waves', unit: 'm', description: '河口 / 暴雨径流', tint: '#67d9d8' },
  quake: { name: '地震', english: 'EARTHQUAKE', icon: 'activity', unit: 'Mw', description: '地动 / 结构响应', tint: '#ff997c' },
  wind: { name: '台风', english: 'TYPHOON', icon: 'wind', unit: 'm/s', description: '阵风 / 风荷载', tint: '#ecc17c' },
} as const;

export interface Parameter {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  digits: number;
}

export const PARAMETERS: Record<Hazard, readonly Parameter[]> = {
  flood: [
    { key: 'initial', label: '初始水位', unit: 'm', min: 0.65, max: 9, step: 0.05, digits: 2 },
    { key: 'growth', label: '水位增长', unit: 'm/s', min: 0, max: 0.3, step: 0.005, digits: 3 },
    { key: 'rain', label: '降雨强度', unit: 'mm/h', min: 0, max: 300, step: 5, digits: 0 },
    { key: 'spread', label: '传播系数', unit: '×', min: 0.15, max: 3, step: 0.05, digits: 2 },
    { key: 'drain', label: '排水效率', unit: '%', min: 0, max: 100, step: 1, digits: 0 },
  ],
  quake: [
    { key: 'magnitude', label: '地震震级', unit: 'Mw', min: 3, max: 9, step: 0.1, digits: 1 },
    { key: 'frequency', label: '主震频率', unit: 'Hz', min: 0.4, max: 4, step: 0.1, digits: 1 },
    { key: 'duration', label: '持续时间', unit: 's', min: 5, max: 120, step: 1, digits: 0 },
    { key: 'displacement', label: '地面位移', unit: 'm', min: 0.02, max: 1.5, step: 0.02, digits: 2 },
  ],
  wind: [
    { key: 'speed', label: '基准风速', unit: 'm/s', min: 0, max: 85, step: 1, digits: 0 },
    { key: 'direction', label: '风向（来向）', unit: '°', min: 0, max: 359, step: 1, digits: 0 },
    { key: 'gust', label: '阵风变化', unit: '%', min: 0, max: 75, step: 1, digits: 0 },
    { key: 'rain', label: '降雨强度', unit: 'mm/h', min: 0, max: 300, step: 5, digits: 0 },
  ],
};

export const defaults = (): HazardSettings => ({
  flood: { initial: 2.4, growth: 0.065, rain: 85, spread: 1.2, drain: 38 },
  quake: { magnitude: 7.1, frequency: 1.1, duration: 32, displacement: 0.38 },
  wind: { speed: 40, direction: 128, gust: 30, rain: 130 },
});
