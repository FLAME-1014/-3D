import { positiveTime, rangeProgress, smoothstep } from './clock';

export const STAMPING_CYCLE = 4;
export const PRESS_STROKE = 1.35;
export const PRESS_POSITIONS = [-13.5, -4.5, 4.5, 13.5] as const;
export const PRESS_NAMES = ['OP10 拉延', 'OP20 修边冲孔', 'OP30 修边整形', 'OP40 冲孔翻边切断'] as const;
export const RACK_FILL_SECONDS = 480;
export const RACK_EXCHANGE_SECONDS = 42;
export const RACK_CAPACITY = RACK_FILL_SECONDS / STAMPING_CYCLE;
export const RACK_BUFFER_TRANSFER_SECONDS = 0.8;
const INITIAL_PART_SERIAL = 1000;
const FIRST_STORED_PART_SERIAL = INITIAL_PART_SERIAL - 5;
const VISIBLE_STORED_RACKS = 6;

export type PressPhase = '送料' | '快下' | '慢压' | '保压' | '回程' | '待机';
export interface PressPose {
  index: number;
  x: number;
  name: string;
  /** Distance below top dead centre, metres. */
  downstroke: number;
  sliderY: number;
  phase: PressPhase;
  forming: number;
}
export interface StampingPart {
  id: string;
  serial: number;
  slot: number;
  x: number;
  y: number;
  z: number;
  /** Continuous die shape from 0 (blank) through 4 (finished panel). */
  shape: number;
  stage: number;
}
export interface CoilHoistPose {
  stage: string;
  hook: [number, number, number];
  coil: [number, number, number];
  carrying: boolean;
  progress: number;
}
export interface RackPart {
  id: string;
  serial: number;
  /** Two line-tail robots alternate the two 60-part line racks. */
  line: 0 | 1;
  rackSlot: number;
  arrivedAt: number;
  /** FIFO handling finishes at this absolute production time. */
  loadedAt: number;
  rackId: string;
  lineRackId: string;
  shape: 4;
  stage: 4;
}
export interface StoredRackBatch {
  id: string;
  batch: number;
  capacity: number;
  filled: number;
  storedParts: RackPart[];
}
export interface RackPose {
  id: string;
  filled: number;
  capacity: number;
  exchanging: boolean;
  exchangeProgress: number;
  agvX: number;
  agvZ: number;
  fullRackX: number;
  bufferCount: number;
  storedParts: RackPart[];
  bufferParts: RackPart[];
  lines: { id: string; z: number; capacity: number; filled: number; storedParts: RackPart[] }[];
  /** Recent parked racks; older membership remains available through getRackBatch(). */
  completedRacks: StoredRackBatch[];
  archivedRackCount: number;
  shippedCount: number;
}
export interface StampingState {
  time: number;
  cycle: number;
  cycleTime: number;
  progress: number;
  presses: PressPose[];
  parts: StampingPart[];
  transfer: { active: boolean; progress: number; lift: number };
  coil: CoilHoistPose;
  rack: RackPose;
  completed: number;
}

export function stampingPartId(serial: number): string {
  return `SP-SIDE-L-${String(serial).padStart(5, '0')}`;
}

export function getPressPose(cycleTime: number, index = 0): PressPose {
  const t = ((positiveTime(cycleTime) % STAMPING_CYCLE) + STAMPING_CYCLE) % STAMPING_CYCLE;
  let downstroke = 0;
  let phase: PressPhase = '待机';
  if (t < 0.9) phase = '送料';
  else if (t < 1.45) {
    phase = '快下';
    downstroke = 1.05 * rangeProgress(t, 0.9, 1.45);
  } else if (t < 2.05) {
    phase = '慢压';
    downstroke = 1.05 + 0.3 * rangeProgress(t, 1.45, 2.05);
  } else if (t < 2.3) {
    phase = '保压';
    downstroke = PRESS_STROKE;
  } else if (t < 3.3) {
    phase = '回程';
    downstroke = PRESS_STROKE * (1 - rangeProgress(t, 2.3, 3.3));
  }
  return {
    index, x: PRESS_POSITIONS[index] ?? PRESS_POSITIONS[0],
    name: PRESS_NAMES[index] ?? PRESS_NAMES[0],
    downstroke, sliderY: 5.35 - downstroke, phase,
    forming: rangeProgress(t, 1.45, 2.05),
  };
}

const HOIST_KEYS = [
  { time: 0, hook: [-49, 7.7, 5.3], coil: [-49, 0.95, 3.7], stage: '卷外侧待机' },
  { time: 12, hook: [-49, 1.85, 5.3], coil: [-49, 0.95, 3.7], stage: '卷外侧下降' },
  { time: 20, hook: [-49, 1.85, 3.7], coil: [-49, 0.95, 3.7], stage: 'C 钩插入钢卷' },
  { time: 30, hook: [-49, 6.7, 3.7], coil: [-49, 5.8, 3.7], stage: '起吊钢卷' },
  { time: 52, hook: [-36, 6.7, 0], coil: [-36, 5.8, 0], stage: '平移至开卷机' },
  { time: 64, hook: [-36, 2.6, 0], coil: [-36, 1.7, 0], stage: '放置钢卷' },
  { time: 74, hook: [-36, 2.6, 1.6], coil: [-36, 1.7, 0], stage: '退出卷芯' },
  { time: 84, hook: [-36, 7.7, 1.6], coil: [-36, 1.7, 0], stage: '空钩升起' },
  { time: 96, hook: [-49, 7.7, 5.3], coil: [-36, 1.7, 0], stage: '空钩返回' },
] as const;

export function getCoilHoistPose(time: number): CoilHoistPose {
  const t = positiveTime(time) % 96;
  const nextIndex = HOIST_KEYS.findIndex((key) => key.time > t);
  const index = Math.max(0, nextIndex - 1);
  const a = HOIST_KEYS[index]!;
  const b = HOIST_KEYS[index + 1]!;
  const u = rangeProgress(t, a.time, b.time);
  const interpolate = (from: readonly number[], to: readonly number[]): [number, number, number] => [
    from[0]! + (to[0]! - from[0]!) * u,
    from[1]! + (to[1]! - from[1]!) * u,
    from[2]! + (to[2]! - from[2]!) * u,
  ];
  return {
    stage: b.stage, hook: interpolate(a.hook, b.hook), coil: interpolate(a.coil, b.coil),
    carrying: t >= 20 && t < 64, progress: t / 96,
  };
}

function rackId(batch: number): string {
  return `RACK-${String(batch).padStart(4, '0')}`;
}

function rackPart(outputIndex: number): RackPart {
  const serial = FIRST_STORED_PART_SERIAL + outputIndex;
  const batch = Math.floor(outputIndex / RACK_CAPACITY) + 1;
  const batchSlot = outputIndex % RACK_CAPACITY;
  const line: 0 | 1 = serial % 2 === 0 ? 0 : 1;
  const arrivedAt = (outputIndex + 1) * STAMPING_CYCLE;
  const rackAvailableAt = batch === 1 ? 0 : (batch - 1) * RACK_FILL_SECONDS + RACK_EXCHANGE_SECONDS;
  return {
    id: stampingPartId(serial), serial, line, rackSlot: Math.floor(batchSlot / 2), arrivedAt,
    loadedAt: Math.max(arrivedAt, rackAvailableAt + (batchSlot + 1) * RACK_BUFFER_TRANSFER_SECONDS),
    rackId: rackId(batch), lineRackId: `${rackId(batch)}-${line === 0 ? 'A' : 'B'}`,
    shape: 4, stage: 4,
  };
}

/** A batch is an immutable serial range, so past rack identities need no simulation history. */
export function getRackBatch(batchNumber: number): StoredRackBatch {
  const batch = Math.max(1, Math.floor(positiveTime(batchNumber)));
  return {
    id: rackId(batch), batch, capacity: RACK_CAPACITY, filled: RACK_CAPACITY,
    storedParts: Array.from({ length: RACK_CAPACITY }, (_, slot) => rackPart((batch - 1) * RACK_CAPACITY + slot)),
  };
}

export function getRackPose(time: number): RackPose {
  const safeTime = positiveTime(time);
  const fullBatches = Math.floor(safeTime / RACK_FILL_SECONDS);
  const local = safeTime % RACK_FILL_SECONDS;
  const exchanging = fullBatches > 0 && local < RACK_EXCHANGE_SECONDS;
  const exchangeTime = exchanging ? local : 0;
  const batch = exchanging ? fullBatches : fullBatches + 1;
  const producedCount = Math.floor(safeTime / STAMPING_CYCLE);
  const shippedBatches = exchanging ? fullBatches - 1 : fullBatches;
  const firstOutput = (batch - 1) * RACK_CAPACITY;
  const available = producedCount - firstOutput;
  // The tolerance aligns exact decimal handling timestamps (e.g. 522.8) with their completed slot.
  const bufferTransferCount = batch === 1 ? available : Math.floor(Math.max(0, local - RACK_EXCHANGE_SECONDS) / RACK_BUFFER_TRANSFER_SECONDS + 1e-9);
  const filled = exchanging ? RACK_CAPACITY : Math.min(available, bufferTransferCount, RACK_CAPACITY);
  const storedParts = Array.from({ length: filled }, (_, slot) => rackPart(firstOutput + slot));
  const firstBufferedOutput = shippedBatches * RACK_CAPACITY + filled;
  const bufferParts = Array.from({ length: producedCount - firstBufferedOutput }, (_, slot) => rackPart(firstBufferedOutput + slot));
  const archivedRackCount = Math.max(0, shippedBatches - VISIBLE_STORED_RACKS);
  const completedRacks = Array.from({ length: Math.min(shippedBatches, VISIBLE_STORED_RACKS) }, (_, index) => getRackBatch(archivedRackCount + index + 1));
  const departure = rangeProgress(exchangeTime, 10, 30);
  const returning = rangeProgress(exchangeTime, 30, 42);
  return {
    id: rackId(batch), filled, capacity: RACK_CAPACITY,
    exchanging, exchangeProgress: exchanging ? exchangeTime / RACK_EXCHANGE_SECONDS : 0,
    agvX: exchanging ? 33 + 16 * departure * (1 - returning) : 33,
    agvZ: exchanging ? 8 + 4 * rangeProgress(exchangeTime, 0, 10) * (1 - returning) : 8,
    fullRackX: 33 + 16 * departure,
    bufferCount: bufferParts.length, storedParts, bufferParts,
    lines: [-3.4, 3.4].map((z, line) => {
      const lineParts = storedParts.filter((part) => part.line === line);
      return { id: `${rackId(batch)}-${line === 0 ? 'A' : 'B'}`, z, capacity: RACK_CAPACITY / 2, filled: lineParts.length, storedParts: lineParts };
    }),
    completedRacks, archivedRackCount, shippedCount: shippedBatches * RACK_CAPACITY,
  };
}

export function getStampingState(time: number): StampingState {
  const safeTime = positiveTime(time);
  const cycle = Math.floor(safeTime / STAMPING_CYCLE);
  const cycleTime = safeTime % STAMPING_CYCLE;
  const transferProgress = rangeProgress(cycleTime, 0.12, 0.8);
  const transferLift = 0.35 * Math.sin(Math.PI * rangeProgress(cycleTime, 0, 0.9));
  const presses = PRESS_POSITIONS.map((_, index) => getPressPose(cycleTime, index));
  const destinations = [-13.5, -4.5, 4.5, 13.5, 24, 33];
  const parts = destinations.map((x, slot): StampingPart => {
    const source = slot === 0 ? -25 : destinations[slot - 1]!;
    const serial = INITIAL_PART_SERIAL + cycle - slot;
    const previousShape = Math.min(4, slot);
    return {
      id: stampingPartId(serial), serial, slot,
      x: source + (x - source) * transferProgress,
      y: 1.62 + transferLift,
      z: slot >= 4 ? (serial % 2 === 0 ? -3.4 : 3.4) * (slot === 4 ? smoothstep(transferProgress) : 1) : 0,
      stage: previousShape,
      shape: slot < 4 ? previousShape + presses[slot]!.forming : 4,
    };
  });
  return {
    time: safeTime, cycle, cycleTime, progress: cycleTime / STAMPING_CYCLE,
    presses, parts, transfer: { active: cycleTime < 0.9, progress: transferProgress, lift: transferLift },
    coil: getCoilHoistPose(safeTime), rack: getRackPose(safeTime), completed: cycle,
  };
}
