import { clamp01, positiveTime, rangeProgress, smoothstep } from '../core/clock';

export const WELDING_CYCLE = 76;
export const TRANSFER_SECONDS = 6;
export const LIFT_HANDOFF_SECONDS = 42;
export const OUTBOUND_EXIT_SECONDS = 94;
export const HIGH_BRIDGE_LENGTH = 52;
export const WELD_WINDOWS = [26, 34, 42, 50] as const;
export const WELD_WINDOW_DURATION = 0.8;
export const ROBOT_SPEED_LIMITS = [120, 100, 110, 140, 140, 210] as const;
export const ROBOT_LINKS = [1.3, 1.25] as const;
export const ROBOT_SHOULDER_HEIGHT = 1.5;
export const ROBOT_TCP_OFFSET = 0.18;
export const STATION_POSITIONS = [-42, -30, -18, -6, 6, 18, 30, 42] as const;
export const ROBOT_COUNTS = [4, 4, 4, 4, 2, 4, 0, 0] as const;

export type BodyStage = '下车体' | '侧围合拢' | '主拼顶框' | '补焊完成' | '顶盖连接' | '门盖装配' | '测量完成' | '涂装转运';
export type RobotProcess = 'spr' | 'handling' | 'spot' | 'laser' | 'assembly';
export type Vector3Tuple = [number, number, number];
export type JointAngles = [number, number, number, number, number, number];
export interface BodyAssembly {
  floor: number;
  frontFloor: number;
  rearFloor: number;
  engineBay: number;
  sides: number;
  roofFrame: number;
  roof: number;
  rearDoors: number;
  frontDoors: number;
  hood: number;
  tailgate: number;
}
export interface WeldingStationPose {
  index: number;
  code: string;
  name: string;
  x: number;
  robotCount: number;
  carId: string;
  skidId: string;
  serial: number;
  carX: number;
  skidY: number;
  occupied: boolean;
  stage: BodyStage;
  stageComplete: boolean;
  assembly: BodyAssembly;
  clamp: number;
  working: boolean;
  progress: number;
  measurement: number;
}
export interface OutboundCarPose {
  carId: string;
  skidId: string;
  serial: number;
  sourceCycle: number;
  carX: number;
  skidY: number;
  bridgeProgress: number;
  assembly: BodyAssembly;
}
export interface WeldingState {
  time: number;
  cycle: number;
  cycleTime: number;
  progress: number;
  transfer: { active: boolean; progress: number };
  stations: WeldingStationPose[];
  outbound: OutboundCarPose[];
  lift: { height: number; occupied: boolean; working: boolean; bridgeProgress: number; outboundCarId: string };
  completed: number;
}
export interface RobotConfig {
  index: number;
  station: number;
  localIndex: number;
  base: Vector3Tuple;
  side: -1 | 1;
  process: RobotProcess;
}
export interface JointKeyframe {
  time: number;
  angles: JointAngles;
  target?: Vector3Tuple;
}
export interface RobotPose {
  index: number;
  station: number;
  jointAngles: JointAngles;
  toolPoint: Vector3Tuple;
  toolAxis: Vector3Tuple;
  jawNormal: Vector3Tuple;
  contactPoint: Vector3Tuple;
  gunClosed: number;
  welding: boolean;
  riveting: boolean;
  laser: boolean;
  windowIndex: number;
  sparkAge: number;
  phase: string;
  carrying: boolean;
  cargoPart?: keyof BodyAssembly;
}

const STATIONS = [
  { code: 'UB-10', name: '下车体连接', stage: '下车体', complete: 54 },
  { code: 'BS-20', name: '侧围总成', stage: '侧围合拢', complete: 54 },
  { code: 'FR-30', name: '主拼', stage: '主拼顶框', complete: 54 },
  { code: 'RS-40', name: '补焊', stage: '补焊完成', complete: 54 },
  { code: 'RL-50', name: '顶盖连接', stage: '顶盖连接', complete: 60 },
  { code: 'CL-60', name: '四门两盖', stage: '门盖装配', complete: 63 },
  { code: 'QM-70', name: '在线测量', stage: '测量完成', complete: 62 },
  { code: 'LIFT-80', name: '升降出线', stage: '涂装转运', complete: LIFT_HANDOFF_SECONDS },
] as const;

export function weldingCarId(serial: number): string {
  return `BIW-${String(serial).padStart(6, '0')}`;
}
export function weldingSkidId(serial: number): string {
  return `SKID-${String(serial).padStart(6, '0')}`;
}

function assemblyForStation(station: number, t: number): BodyAssembly {
  return {
    floor: 1,
    frontFloor: station > 0 ? 1 : rangeProgress(t, 12, 17),
    rearFloor: station > 0 ? 1 : rangeProgress(t, 16, 21),
    engineBay: station > 0 ? 1 : rangeProgress(t, 19, 24),
    sides: station > 1 ? 1 : station === 1 ? rangeProgress(t, 14, 27) : 0,
    roofFrame: station > 2 ? 1 : station === 2 ? rangeProgress(t, 14, 23) : 0,
    roof: station > 4 ? 1 : station === 4 ? rangeProgress(t, 12, 23) : 0,
    rearDoors: station > 5 ? 1 : station === 5 ? rangeProgress(t, 12, 25) : 0,
    frontDoors: station > 5 ? 1 : station === 5 ? rangeProgress(t, 27, 40) : 0,
    hood: station > 5 ? 1 : station === 5 ? rangeProgress(t, 43, 54) : 0,
    tailgate: station > 5 ? 1 : station === 5 ? rangeProgress(t, 52, 63) : 0,
  };
}

/** Handoff clears the lift at x=54; the same skid then continues across the high bridge. */
function liftCarX(cycleTime: number): number {
  const arrival = STATION_POSITIONS[7] - 12 + 12 * rangeProgress(cycleTime, 0, TRANSFER_SECONDS);
  const handoff = 12 * rangeProgress(cycleTime, 30, LIFT_HANDOFF_SECONDS);
  const onwards = 56 * rangeProgress(cycleTime, LIFT_HANDOFF_SECONDS, OUTBOUND_EXIT_SECONDS);
  return arrival + handoff + onwards;
}

function outboundCars(time: number, cycle: number): OutboundCarPose[] {
  const cars: OutboundCarPose[] = [];
  // The outgoing journey spans a cycle boundary; derive previous departures from absolute time.
  // Iterate two candidates explicitly: incrementing a huge floating-point cycle may never advance it.
  for (const sourceCycle of [cycle - 1, cycle]) {
    if (sourceCycle < 0) continue;
    const localTime = time - sourceCycle * WELDING_CYCLE;
    if (localTime < LIFT_HANDOFF_SECONDS || localTime >= OUTBOUND_EXIT_SECONDS) continue;
    const serial = 1000 + sourceCycle - 7;
    const carX = liftCarX(localTime);
    cars.push({
      carId: weldingCarId(serial), skidId: weldingSkidId(serial), serial, sourceCycle,
      carX, skidY: 5, bridgeProgress: clamp01((carX - STATION_POSITIONS[7]) / HIGH_BRIDGE_LENGTH),
      assembly: assemblyForStation(7, localTime),
    });
  }
  return cars;
}

export function getWeldingState(time: number): WeldingState {
  const safeTime = positiveTime(time);
  const cycle = Math.floor(safeTime / WELDING_CYCLE);
  const cycleTime = safeTime % WELDING_CYCLE;
  const transferProgress = rangeProgress(cycleTime, 0, TRANSFER_SECONDS);
  const liftUp = rangeProgress(cycleTime, 8, 28);
  const bridgeProgress = rangeProgress(cycleTime, 30, LIFT_HANDOFF_SECONDS);
  const liftDown = rangeProgress(cycleTime, 45, 62);
  const liftHeight = 1 + 4 * liftUp * (1 - liftDown);
  const stations = STATIONS.map((station, index): WeldingStationPose => {
    const serial = 1000 + cycle - index;
    const assembly = assemblyForStation(index, cycleTime);
    const occupied = index !== 7 || cycleTime < LIFT_HANDOFF_SECONDS;
    const clampStart = index === 1 ? 27 : index === 0 || index === 2 || index === 4 ? 24 : 7;
    const clampEnd = index === 1 ? 31 : index === 0 || index === 2 || index === 4 ? 25 : 11;
    return {
      index, code: station.code, name: station.name, x: STATION_POSITIONS[index]!,
      robotCount: ROBOT_COUNTS[index]!, serial, carId: weldingCarId(serial), skidId: weldingSkidId(serial),
      carX: index === 7 ? liftCarX(cycleTime) : STATION_POSITIONS[index]! - 12 + 12 * transferProgress,
      skidY: index === 7 ? (cycleTime < 30 ? liftHeight : 5) : 1,
      occupied,
      stage: station.stage, stageComplete: cycleTime >= station.complete,
      assembly,
      clamp: index < 6 ? rangeProgress(cycleTime, clampStart, clampEnd) * (1 - rangeProgress(cycleTime, 64, 69)) : 0,
      working: occupied && cycleTime >= (index === 7 ? 8 : 11) && cycleTime < station.complete,
      progress: clamp01((cycleTime - TRANSFER_SECONDS) / (station.complete - TRANSFER_SECONDS)),
      measurement: index === 6 ? rangeProgress(cycleTime, 12, 62) : 0,
    };
  });
  return {
    time: safeTime, cycle, cycleTime, progress: cycleTime / WELDING_CYCLE,
    transfer: { active: cycleTime < TRANSFER_SECONDS, progress: transferProgress }, stations,
    outbound: outboundCars(safeTime, cycle),
    lift: { height: liftHeight, occupied: stations[7]!.occupied, working: stations[7]!.working, bridgeProgress, outboundCarId: stations[7]!.carId },
    completed: cycle + (cycleTime >= LIFT_HANDOFF_SECONDS ? 1 : 0),
  };
}

export const ROBOT_CONFIGS: readonly RobotConfig[] = ROBOT_COUNTS.flatMap((count, station) =>
  Array.from({ length: count }, (_, localIndex): Omit<RobotConfig, 'index'> => {
    const side: -1 | 1 = localIndex < count / 2 ? -1 : 1;
    const along = count === 2 ? 0.55 : localIndex % 2 === 0 ? -1.25 : 1.25;
    const process: RobotProcess = station === 0 ? 'spr' : station === 1 ? 'handling' :
      station === 4 ? 'laser' : station === 5 ? 'assembly' : 'spot';
    const distance = process === 'laser' ? 1.75 : process === 'assembly' ? 2 : 3.15;
    return { station, localIndex, side, process, base: [STATION_POSITIONS[station]! + along, process === 'assembly' ? 0.4 : 0, side * distance] };
  }),
).map((config, index) => ({ ...config, index }));

export function solveRobotIK(config: RobotConfig, target: Vector3Tuple, toolPitch = config.process === 'laser' ? -Math.PI / 2 : 0, toolRoll = config.side * Math.PI / 2): JointAngles {
  const dx = target[0] - config.base[0];
  const dz = target[2] - config.base[2];
  const horizontal = Math.hypot(dx, dz);
  const radial = horizontal - ROBOT_TCP_OFFSET * Math.cos(toolPitch);
  const dy = target[1] - config.base[1] - ROBOT_SHOULDER_HEIGHT - ROBOT_TCP_OFFSET * Math.sin(toolPitch);
  const [upper, lower] = ROBOT_LINKS;
  const distance = Math.hypot(radial, dy);
  if (radial < -1e-8 || distance > upper + lower + 1e-8 || distance < Math.abs(upper - lower) - 1e-8) {
    throw new RangeError(`Robot ${config.index} cannot reach TCP ${target.join(', ')} (wrist distance ${distance.toFixed(4)} m)`);
  }
  const elbowCos = (radial * radial + dy * dy - upper * upper - lower * lower) / (2 * upper * lower);
  // Only floating-point roundoff at the exact reach boundary is clamped.
  const elbow = -Math.acos(Math.max(-1, Math.min(1, elbowCos)));
  const shoulder = Math.atan2(dy, radial) - Math.atan2(lower * Math.sin(elbow), upper + lower * Math.cos(elbow));
  return [Math.atan2(dz, dx), shoulder, elbow, 0, toolPitch - shoulder - elbow, toolRoll];
}

function rotateX(point: Vector3Tuple, angle: number): Vector3Tuple {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [point[0], c * point[1] - s * point[2], s * point[1] + c * point[2]];
}
function rotateZ(point: Vector3Tuple, angle: number): Vector3Tuple {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [c * point[0] - s * point[1], s * point[0] + c * point[1], point[2]];
}
function rotateY(point: Vector3Tuple, angle: number): Vector3Tuple {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [c * point[0] + s * point[2], point[1], -s * point[0] + c * point[2]];
}
function add(a: Vector3Tuple, b: Vector3Tuple): Vector3Tuple {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/** Canonical hierarchy: Y(-q1), Z(q2), Z(q3), X(q4), Z(q5), X(q6), TCP(+0.18 X). */
export function robotForwardKinematics(config: RobotConfig, angles: JointAngles): { wristPoint: Vector3Tuple; toolPoint: Vector3Tuple; toolAxis: Vector3Tuple; jawNormal: Vector3Tuple } {
  const [yaw, shoulder, elbow, wristRoll, wristPitch, toolRoll] = angles;
  const shoulderPoint = add(config.base, [0, ROBOT_SHOULDER_HEIGHT, 0]);
  const upper = rotateY(rotateZ([ROBOT_LINKS[0], 0, 0], shoulder), -yaw);
  const lower = rotateY(rotateZ([ROBOT_LINKS[1], 0, 0], shoulder + elbow), -yaw);
  const wristPoint = add(add(shoulderPoint, upper), lower);
  const toolDirection = (point: Vector3Tuple) => rotateY(rotateZ(rotateX(rotateZ(rotateX(point, toolRoll), wristPitch), wristRoll), shoulder + elbow), -yaw);
  return {
    wristPoint, toolPoint: add(wristPoint, toolDirection([ROBOT_TCP_OFFSET, 0, 0])),
    toolAxis: toolDirection([1, 0, 0]), jawNormal: toolDirection([0, 0, 1]),
  };
}
export function robotToolPoint(config: RobotConfig, angles: JointAngles): Vector3Tuple {
  return robotForwardKinematics(config, angles).toolPoint;
}

/** Exact unchanged roof mesh surface, in absolute workshop coordinates. */
export function roofSurfaceY(carLocalX: number, z: number): number {
  return 2.485 + 0.052 * (1 - (z / 0.84) ** 2) + 0.023 * Math.cos((carLocalX - 0.55) * 1.2);
}

export function laserContactPoint(config: RobotConfig, cycleTime: number): Vector3Tuple {
  const front = -0.79, rear = 1.89;
  const start = config.side === -1 ? front : rear;
  const end = config.side === -1 ? rear : front;
  let x = start, z = 0;
  if (cycleTime < 32) z = config.side * 0.84 * rangeProgress(cycleTime, 26, 32);
  else if (cycleTime < 52) {
    x = start + (end - start) * rangeProgress(cycleTime, 32, 52); z = config.side * 0.84;
  } else {
    x = end; z = config.side * 0.84 * (1 - rangeProgress(cycleTime, 52, 58));
  }
  return [STATION_POSITIONS[config.station]! + x, roofSurfaceY(x, z), z];
}

interface CargoTask { part: keyof BodyAssembly; start: number; end: number }
function cargoTasks(config: RobotConfig): CargoTask[] {
  if (config.process === 'handling') return [{ part: 'sides', start: 14, end: 27 }];
  if (config.process !== 'assembly') return [];
  return config.localIndex % 2 === 0
    ? [{ part: 'frontDoors', start: 27, end: 40 }, { part: 'hood', start: 43, end: 54 }]
    : [{ part: 'rearDoors', start: 12, end: 25 }, { part: 'tailgate', start: 52, end: 63 }];
}
export function robotCargoTarget(config: RobotConfig, part: keyof BodyAssembly, cycleTime: number): Vector3Tuple {
  const assembly = assemblyForStation(config.station, cycleTime);
  const p = assembly[part];
  const stationX = STATION_POSITIONS[config.station]!;
  if (part === 'sides') {
    const alongSign = config.localIndex % 2 === 0 ? -1 : 1;
    return [config.base[0] + alongSign * 0.35, 1.91, config.side * (0.94 + 2.4 * (1 - p))];
  }
  if (part === 'rearDoors' || part === 'frontDoors') {
    return [stationX + (part === 'rearDoors' ? 0.65 : -0.55), 1.91, config.side * (0.949 + (part === 'rearDoors' ? 2 : 2.1) * (1 - p))];
  }
  if (part === 'hood') {
    return [stationX - 1.7 - 0.35 * (1 - p), 1.97 + 0.06 * (1 - (0.55 / 0.85) ** 2) + 1.55 * (1 - p), config.side * 0.55];
  }
  if (part === 'tailgate') return [stationX + 2.179 + 0.5 * (1 - p), 1.72 + 1.5 * (1 - p), config.side * 0.55];
  throw new RangeError(`Unsupported robot cargo ${part}`);
}

export function robotContactPoint(config: RobotConfig, weldIndex: number): Vector3Tuple {
  if (config.process === 'laser') return laserContactPoint(config, 26 + Math.max(0, Math.min(3, weldIndex)) * 32 / 3);
  const tasks = cargoTasks(config);
  if (tasks.length) return robotCargoTarget(config, tasks[0]!.part, tasks[0]!.end);
  const sign = config.localIndex % 2 === 0 ? -1 : 1;
  const longitudinal = sign * ([0.24, 0.3, 0.36, 0.28][weldIndex] ?? 0.3);
  return [config.base[0] + longitudinal, config.process === 'spr' ? 1.4 : 1.91, config.side * (config.process === 'spr' ? 0.87 : 0.94)];
}

export function createRobotKeyframes(config: RobotConfig): JointKeyframe[] {
  const inward = -config.side;
  const home: Vector3Tuple = [config.base[0], config.process === 'laser' ? 2.9 : 2.75, config.base[2] + inward * 1.1];
  const frames: JointKeyframe[] = [];
  const frame = (time: number, target: Vector3Tuple, roll = config.side * Math.PI / 2, toolPitch = config.process === 'laser' ? -Math.PI / 2 : 0) => frames.push({ time, target, angles: solveRobotIK(config, target, toolPitch, roll) });
  frame(0, home);
  const tasks = cargoTasks(config);
  if (config.process === 'laser') {
    frame(18, home);
    const first = laserContactPoint(config, 26), last = laserContactPoint(config, 58);
    frame(22, [first[0], roofSurfaceY(first[0] - STATION_POSITIONS[config.station]!, config.side * 0.84) + 0.25, config.side * 0.84]);
    frame(25, first);
    for (let t = 26; t <= 58; t += 0.125) frame(t, laserContactPoint(config, t));
    frame(60, [last[0], roofSurfaceY(last[0] - STATION_POSITIONS[config.station]!, config.side * 0.84) + 0.25, config.side * 0.84]);
  } else if (tasks.length) {
    const approach = (target: Vector3Tuple, part: keyof BodyAssembly): Vector3Tuple => [target[0], target[1] + (part === 'hood' || part === 'tailgate' ? 0 : 0.25), target[2] + config.side * 0.2];
    tasks.forEach((task, taskIndex) => {
      const first = robotCargoTarget(config, task.part, task.start);
      const pitch = task.part === 'hood' ? -Math.PI / 2 : 0;
      const previous = tasks[taskIndex - 1];
      if (!previous || task.start - previous.end > 8) {
        frame(task.start - 7, home);
        frame(task.start - 4, approach(first, task.part), undefined, pitch);
      } else frame(previous.end + 2.3, approach(first, task.part), undefined, pitch);
      frame(task.start - 0.4, first, undefined, pitch);
      for (let t = task.start; t <= task.end; t += 0.25) frame(t, robotCargoTarget(config, task.part, t), undefined, pitch);
      const last = robotCargoTarget(config, task.part, task.end);
      const next = tasks[taskIndex + 1];
      frame(task.end + (next && next.start - task.end <= 8 ? 0.4 : 2), approach(last, task.part), undefined, pitch);
      if (next && next.start - task.end > 8) frame(task.end + 6, home);
    });
  } else {
    WELD_WINDOWS.forEach((start, index) => {
      const contact = robotContactPoint(config, index);
      const above: Vector3Tuple = [contact[0], contact[1] + 0.38, contact[2] + config.side * 0.18];
      const roll = config.side * Math.PI / 2 + (index % 2 ? 0.12 : -0.12);
      frame(start - 6, above, roll); frame(start - 1, contact, roll);
      frame(start + WELD_WINDOW_DURATION, contact, roll); frame(start + 2, above, roll);
    });
  }
  frame(69, home); frame(WELDING_CYCLE, home);
  // Consecutive windows share an approach timestamp. Identical-time frames are collapsed.
  const sorted = frames.sort((a, b) => a.time - b.time);
  const unique = sorted.filter((frame, index) => index === sorted.length - 1 || frame.time !== sorted[index + 1]!.time);
  for (let index = 1; index < unique.length; index++) {
    const previous = unique[index - 1]!, current = unique[index]!;
    for (const axis of [0, 5]) {
      while (current.angles[axis]! - previous.angles[axis]! > Math.PI) current.angles[axis]! -= 2 * Math.PI;
      while (current.angles[axis]! - previous.angles[axis]! < -Math.PI) current.angles[axis]! += 2 * Math.PI;
    }
  }
  return unique;
}

export const ROBOT_KEYFRAMES: readonly JointKeyframe[][] = ROBOT_CONFIGS.map(createRobotKeyframes);

export function interpolateRobotJoints(frames: readonly JointKeyframe[], cycleTime: number): JointAngles {
  const t = clamp01(cycleTime / WELDING_CYCLE) * WELDING_CYCLE;
  const next = frames.findIndex((frame) => frame.time > t);
  if (next < 0) return [...frames[frames.length - 1]!.angles];
  if (next === 0) return [...frames[0]!.angles];
  const a = frames[next - 1]!;
  const b = frames[next]!;
  const u = smoothstep((t - a.time) / (b.time - a.time));
  return a.angles.map((angle, axis) => angle + (b.angles[axis]! - angle) * u) as JointAngles;
}

export function getRobotState(time: number, robotIndex: number): RobotPose {
  const config = ROBOT_CONFIGS[robotIndex];
  if (!config) throw new RangeError(`Robot ${robotIndex} does not exist`);
  const cycleTime = positiveTime(time) % WELDING_CYCLE;
  const joins = config.process === 'spot' || config.process === 'spr';
  const windowIndex = joins ? WELD_WINDOWS.findIndex((start) => cycleTime >= start && cycleTime < start + WELD_WINDOW_DURATION) : -1;
  const nearestWindow = Math.min(3, Math.max(0, Math.floor((cycleTime - 22) / 8)));
  const jointAngles = interpolateRobotJoints(ROBOT_KEYFRAMES[robotIndex]!, cycleTime);
  const kinematics = robotForwardKinematics(config, jointAngles);
  const active = windowIndex >= 0;
  const cargo = cargoTasks(config).find((task) => cycleTime >= task.start && cycleTime < task.end);
  const laser = config.process === 'laser' && cycleTime >= 26 && cycleTime < 58;
  const gunClosed = Math.max(...WELD_WINDOWS.map((start) => rangeProgress(cycleTime, start - 0.35, start) * (1 - rangeProgress(cycleTime, start + 0.8, start + 1.1))));
  return {
    index: robotIndex, station: config.station, jointAngles,
    toolPoint: kinematics.toolPoint, toolAxis: kinematics.toolAxis, jawNormal: kinematics.jawNormal,
    contactPoint: joins ? robotContactPoint(config, active ? windowIndex : nearestWindow) : cargo ? robotCargoTarget(config, cargo.part, cycleTime) : kinematics.toolPoint,
    gunClosed: config.process === 'spot' || config.process === 'spr' ? gunClosed : 0,
    welding: active && config.process === 'spot', riveting: active && config.process === 'spr',
    laser,
    windowIndex, sparkAge: active ? cycleTime - WELD_WINDOWS[windowIndex]! : -1,
    phase: cargo ? `${cargo.part === 'sides' ? '侧围' : cargo.part === 'rearDoors' ? '后门' : cargo.part === 'frontDoors' ? '前门' : cargo.part === 'hood' ? '前盖' : '尾门'}搬运 / 定位` : laser ? '沿顶盖边缘激光钎焊' : active ? (config.process === 'spr' ? '自冲铆接' : '点焊') : cycleTime > 63 ? '退回待机' : cycleTime < 10 ? '待机' : '接近 / 取件 / 移位',
    carrying: !!cargo, cargoPart: cargo?.part,
  };
}
