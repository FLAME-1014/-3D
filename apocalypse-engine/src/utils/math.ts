export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const mix = (from: number, to: number, weight: number) => from + (to - from) * weight;

export function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
