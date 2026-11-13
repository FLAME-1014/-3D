import { describe, expect, it } from 'vitest';
import { MAX_PRODUCTION_SECONDS } from '../core/clock';
import {
  getRobotState, getWeldingState, ROBOT_CONFIGS, ROBOT_COUNTS, ROBOT_KEYFRAMES,
  ROBOT_SPEED_LIMITS, STATION_POSITIONS, WELD_WINDOWS, OUTBOUND_EXIT_SECONDS,
  robotForwardKinematics, robotToolPoint, solveRobotIK, ROBOT_TCP_OFFSET,
  laserContactPoint, roofSurfaceY, robotCargoTarget,
} from './logic';

describe('welding transport and assembly', () => {
  it('bounds enormous finite times without hanging outbound-car evaluation', () => {
    const last = getWeldingState(MAX_PRODUCTION_SECONDS);
    expect(last.time).toBe(MAX_PRODUCTION_SECONDS);
    expect(last.stations.every(station => Number.isSafeInteger(station.serial))).toBe(true);
    for (const time of [1e20, Number.MAX_VALUE]) {
      expect(getWeldingState(time)).toEqual(last);
      for (const robot of ROBOT_CONFIGS) {
        expect(getRobotState(time, robot.index)).toEqual(getRobotState(MAX_PRODUCTION_SECONDS, robot.index));
      }
    }
  });
  it('uses the initial transport and robot state for negative or non-finite times', () => {
    const initial = getWeldingState(0);
    for (const time of [-Number.MAX_VALUE, NaN, Infinity, -Infinity]) {
      expect(getWeldingState(time)).toEqual(initial);
      expect(getRobotState(time, 0)).toEqual(getRobotState(0, 0));
    }
  });
  it('has eight stations 12 metres apart and exactly 22 assigned robots', () => {
    expect(ROBOT_COUNTS).toEqual([4, 4, 4, 4, 2, 4, 0, 0]);
    expect(ROBOT_CONFIGS).toHaveLength(22);
    STATION_POSITIONS.slice(1).forEach((x, index) => expect(x - STATION_POSITIONS[index]!).toBe(12));
  });
  it('moves every skid simultaneously with all clamps open', () => {
    const start = getWeldingState(0);
    const half = getWeldingState(3);
    const end = getWeldingState(6);
    half.stations.forEach((station, index) => {
      expect(station.carX - start.stations[index]!.carX).toBeCloseTo(6);
      expect(end.stations[index]!.carX - start.stations[index]!.carX).toBeCloseTo(12);
      expect(station.clamp).toBe(0);
      expect(station.carId).toBe(start.stations[index]!.carId);
      expect(station.skidId).toBe(start.stations[index]!.skidId);
    });
  });
  it('binds a unique car identity to its skid through each station boundary', () => {
    const before = getWeldingState(76 - 0.000001);
    const after = getWeldingState(76 + 0.000001);
    for (let station = 0; station < 7; station++) {
      const departing = before.stations[station]!;
      const arriving = after.stations[station + 1]!;
      expect(arriving.carId).toBe(departing.carId);
      expect(arriving.skidId).toBe(departing.skidId);
      expect(arriving.carX).toBeCloseTo(departing.carX, 6);
      expect(arriving.skidY).toBeCloseTo(departing.skidY, 6);
      expect(arriving.assembly).toEqual(departing.assembly);
    }
    expect(new Set(after.stations.map((station) => station.carId)).size).toBe(8);
  });
  it('closes fixtures before welding and clears fixtures before the next transfer', () => {
    const working = getWeldingState(26.4);
    expect(working.stations[2]!.clamp).toBe(1);
    expect(working.stations[3]!.clamp).toBe(1);
    expect(getWeldingState(70).stations[2]!.clamp).toBe(0);
    expect(getWeldingState(54).stations[2]!.stageComplete).toBe(true);
  });
  it('joins front floor, rear floor and engine bay before closing the SPR fixture', () => {
    const arriving = getWeldingState(6).stations[0]!;
    expect(arriving.assembly.floor).toBe(1);
    expect(arriving.assembly.frontFloor).toBe(0);
    expect(arriving.assembly.rearFloor).toBe(0);
    expect(arriving.assembly.engineBay).toBe(0);
    const front = getWeldingState(17).stations[0]!.assembly;
    expect(front.frontFloor).toBe(1);
    expect(front.rearFloor).toBeGreaterThan(0);
    expect(front.rearFloor).toBeLessThan(1);
    expect(front.engineBay).toBe(0);
    const clamping = getWeldingState(24.5).stations[0]!;
    expect(clamping.assembly.frontFloor).toBe(1);
    expect(clamping.assembly.rearFloor).toBe(1);
    expect(clamping.assembly.engineBay).toBe(1);
    expect(getWeldingState(23).stations[0]!.clamp).toBe(0);
    expect(clamping.clamp).toBeGreaterThan(0);
    expect(getWeldingState(26).stations[0]!.clamp).toBe(1);
    for (const join of [12, 16, 17, 19, 21, 24]) {
      const before = getWeldingState(join - 0.000001).stations[0]!.assembly;
      const after = getWeldingState(join + 0.000001).stations[0]!.assembly;
      for (const part of ['frontFloor', 'rearFloor', 'engineBay'] as const) {
        expect(after[part]).toBeCloseTo(before[part], 5);
      }
    }
  });
  it('keeps every fixture open during skid transfers and releases completed work before departure', () => {
    for (const time of [0, 0.5, 3, 5.99, 6, 76, 79]) {
      expect(getWeldingState(time).stations.every((station) => station.clamp === 0)).toBe(true);
    }
    for (const time of [26, 34, 42, 50]) {
      const stations = getWeldingState(time).stations;
      expect(stations[0]!.clamp).toBe(1);
      expect(stations[2]!.clamp).toBe(1);
      expect(stations[3]!.clamp).toBe(1);
    }
    expect(getWeldingState(70).stations.every((station) => station.clamp === 0)).toBe(true);
  });
  it('waits for side, framing and roof parts to arrive before closing their positioning gates', () => {
    const incomingSides = getWeldingState(26).stations[1]!;
    expect(incomingSides.assembly.sides).toBeLessThan(1);
    expect(incomingSides.clamp).toBe(0);
    expect(getWeldingState(27).stations[1]!.assembly.sides).toBe(1);
    expect(getWeldingState(31).stations[1]!.clamp).toBe(1);
    for (const index of [2, 4]) {
      expect(getWeldingState(22).stations[index]!.clamp).toBe(0);
      const part = index === 2 ? 'roofFrame' : 'roof';
      expect(getWeldingState(24).stations[index]!.assembly[part]).toBe(1);
      expect(getWeldingState(24).stations[index]!.clamp).toBe(0);
      expect(getWeldingState(25).stations[index]!.clamp).toBe(1);
    }
  });
  it('installs rear doors, front doors, then hood and tailgate', () => {
    const rear = getWeldingState(25).stations[5]!.assembly;
    expect(rear.rearDoors).toBe(1);
    expect(rear.frontDoors).toBe(0);
    expect(rear.hood).toBe(0);
    const front = getWeldingState(40).stations[5]!.assembly;
    expect(front.frontDoors).toBe(1);
    expect(front.hood).toBe(0);
    expect(getWeldingState(63).stations[5]!.assembly.tailgate).toBe(1);
  });
  it('raises a loaded skid to five metres, unloads, and descends empty', () => {
    expect(getWeldingState(6).lift.height).toBe(1);
    expect(getWeldingState(28).lift.height).toBe(5);
    expect(getWeldingState(28).lift.occupied).toBe(true);
    expect(getWeldingState(42).lift.occupied).toBe(false);
    expect(getWeldingState(50).lift.height).toBeGreaterThan(1);
    expect(getWeldingState(50).lift.height).toBeLessThan(5);
    expect(getWeldingState(62).lift.height).toBe(1);
    expect(getWeldingState(62).lift.occupied).toBe(false);
    expect(getWeldingState(42).lift.working).toBe(false);
    expect(getWeldingState(42).stations[7]!.working).toBe(false);
    expect(getWeldingState(42).stations[7]!.stageComplete).toBe(true);
    expect(getWeldingState(42).stations[7]!.progress).toBe(1);
  });
  it('hands off the same car and skid continuously to the elevated outbound bridge', () => {
    const before = getWeldingState(42 - 0.000001);
    const after = getWeldingState(42 + 0.000001);
    const departing = before.stations[7]!;
    const outgoing = after.outbound[0]!;
    expect(before.outbound).toHaveLength(0);
    expect(after.stations[7]!.occupied).toBe(false);
    expect(outgoing.carId).toBe(departing.carId);
    expect(outgoing.skidId).toBe(departing.skidId);
    expect(outgoing.assembly).toEqual(departing.assembly);
    expect(outgoing.carX).toBeCloseTo(departing.carX, 6);
    expect(outgoing.skidY).toBe(departing.skidY);
    expect(getWeldingState(70).outbound[0]!.carX).toBeGreaterThan(outgoing.carX);
    expect(getWeldingState(70).outbound[0]!.skidY).toBe(5);
  });
  it('retains departed identities across cycles until the complete car has cleared the bridge', () => {
    const before = getWeldingState(76 - 0.000001).outbound[0]!;
    const after = getWeldingState(76 + 0.000001).outbound[0]!;
    expect(after.carId).toBe(before.carId);
    expect(after.skidId).toBe(before.skidId);
    expect(after.carX).toBeCloseTo(before.carX, 4);
    expect(after.skidY).toBe(before.skidY);
    const last = getWeldingState(OUTBOUND_EXIT_SECONDS - 0.000001).outbound[0]!;
    expect(last.carX).toBeCloseTo(110, 6);
    expect(last.bridgeProgress).toBe(1);
    expect(getWeldingState(OUTBOUND_EXIT_SECONDS).outbound).toHaveLength(0);
    const next = getWeldingState(76 + 42).outbound[0]!;
    expect(next.serial).toBe(before.serial + 1);
    expect(next.carId).not.toBe(before.carId);
    for (const time of [42, 70, 76, 85, 94, 118, 152, 230]) {
      const state = getWeldingState(time);
      const ids = [...state.stations.filter((station) => station.occupied), ...state.outbound].map((car) => car.carId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
  it('counts completion at lift handoff without double-counting the cycle boundary', () => {
    expect(getWeldingState(41.99).completed).toBe(0);
    expect(getWeldingState(42).completed).toBe(1);
    expect(getWeldingState(75.99).completed).toBe(1);
    expect(getWeldingState(76).completed).toBe(1);
    expect(getWeldingState(118).completed).toBe(2);
  });
  it('evaluates seeked states identically without retaining previous calculations', () => {
    const state = getWeldingState(173.42);
    getWeldingState(0);
    getWeldingState(100000);
    expect(getWeldingState(173.42)).toEqual(state);
  });
});

describe('preplanned six axis robot motion', () => {
  it('includes the physical 180 mm TCP offset and all wrist axes in pure forward kinematics', () => {
    const config = ROBOT_CONFIGS[0]!;
    const straight = robotForwardKinematics(config, [0, 0, 0, 0, 0, 0]);
    expect(straight.toolPoint[0] - straight.wristPoint[0]).toBeCloseTo(ROBOT_TCP_OFFSET, 10);
    expect(straight.toolPoint[0] - config.base[0]).toBeCloseTo(2.73, 10);
    const pitched = robotForwardKinematics(config, [0, 0, 0, 0, Math.PI / 2, 0]);
    expect(pitched.toolPoint[1] - pitched.wristPoint[1]).toBeCloseTo(ROBOT_TCP_OFFSET, 10);
    const rolled = robotForwardKinematics(config, [0, 0, 0, Math.PI / 2, Math.PI / 2, 0]);
    expect(rolled.toolPoint[2] - rolled.wristPoint[2]).toBeCloseTo(ROBOT_TCP_OFFSET, 10);
    const toolRoll = robotForwardKinematics(config, [0, 0, 0, 0, 0, Math.PI / 2]);
    expect(toolRoll.toolPoint).toEqual(straight.toolPoint);
    expect(toolRoll.jawNormal[1]).toBeCloseTo(-1, 10);
    expect(toolRoll.jawNormal[2]).toBeCloseTo(0, 10);
  });
  it('rejects unreachable targets and exactly reaches every authored task and approach pose', () => {
    expect(() => solveRobotIK(ROBOT_CONFIGS[0]!, [100, 1.91, 0])).toThrow(RangeError);
    for (const [robotIndex, frames] of ROBOT_KEYFRAMES.entries()) {
      for (const frame of frames) {
        const actual = robotToolPoint(ROBOT_CONFIGS[robotIndex]!, frame.angles);
        actual.forEach((value, axis) => expect(value).toBeCloseTo(frame.target![axis]!, 8));
        expect(frame.angles[2]).toBeLessThanOrEqual(0);
      }
    }
  });
  it('keeps the analytical maximum interpolation speed below every axis limit', () => {
    for (const [robotIndex, frames] of ROBOT_KEYFRAMES.entries()) {
      for (let frame = 1; frame < frames.length; frame++) {
        const previous = frames[frame - 1]!;
        const current = frames[frame]!;
        expect(current.time).toBeGreaterThan(previous.time);
        current.angles.forEach((angle, axis) => {
          const maxDegreesPerSecond = 1.5 * Math.abs(angle - previous.angles[axis]!) / (current.time - previous.time) * 180 / Math.PI;
          expect(maxDegreesPerSecond, `Robot ${robotIndex} axis ${axis + 1}, ${previous.time}→${current.time}s`).toBeLessThanOrEqual(ROBOT_SPEED_LIMITS[axis]!);
        });
      }
    }
  });
  it('puts the electrode exactly on each authored contact point throughout welding windows', () => {
    for (const config of ROBOT_CONFIGS) {
      if (config.process !== 'spot' && config.process !== 'spr') continue;
      for (const start of WELD_WINDOWS) {
        const pose = getRobotState(start + 0.4, config.index);
        pose.toolPoint.forEach((value, axis) => expect(value).toBeCloseTo(pose.contactPoint[axis]!, 8));
      }
    }
  });
  it('traces both complementary halves of the real curved roof with downward laser tools', () => {
    for (const config of ROBOT_CONFIGS.filter((robot) => robot.process === 'laser')) {
      const points = [26, 32, 42, 52, 58].map((time) => laserContactPoint(config, time));
      expect(points[0]![2]).toBeCloseTo(0, 10);
      expect(points.at(-1)![2]).toBeCloseTo(0, 10);
      expect(points[1]![2]).toBe(config.side * 0.84);
      expect(points[3]![2]).toBe(config.side * 0.84);
      expect(Math.abs(points[0]![0] - points.at(-1)![0])).toBeCloseTo(2.68);
      for (let time = 26; time <= 58; time += 0.0625) {
        const pose = getRobotState(time, config.index);
        const authored = laserContactPoint(config, time);
        const distance = Math.hypot(...pose.toolPoint.map((value, axis) => value - authored[axis]!) as [number, number, number]);
        expect(distance).toBeLessThan(0.001);
        expect(Math.abs(pose.toolPoint[1] - roofSurfaceY(pose.toolPoint[0] - STATION_POSITIONS[config.station]!, pose.toolPoint[2]))).toBeLessThan(0.001);
        expect(pose.toolAxis[1]).toBeCloseTo(-1, 8);
        expect(pose.welding).toBe(false);
      }
    }
  });
  it('moves vacuum tools with side panels and the ordered door/hood/tailgate attachments', () => {
    for (const config of ROBOT_CONFIGS.filter((robot) => robot.process === 'handling' || robot.process === 'assembly')) {
      const times = config.process === 'handling' ? [14, 20.5, 26.5] : config.localIndex % 2 === 0 ? [27, 33.5, 39.5, 43, 49, 53.5] : [12, 18.5, 24.5, 52, 58, 62.5];
      for (const time of times) {
        const pose = getRobotState(time, config.index);
        expect(pose.carrying).toBe(true);
        const authored = robotCargoTarget(config, pose.cargoPart!, time);
        pose.toolPoint.forEach((value, axis) => expect(value).toBeCloseTo(authored[axis]!, 8));
        expect(pose.welding).toBe(false);
        expect(pose.riveting).toBe(false);
        if (pose.cargoPart === 'hood') expect(pose.toolAxis[1]).toBeCloseTo(-1, 8);
      }
    }
  });
  it('returns to the same standby joint pose at a cycle boundary', () => {
    for (const config of ROBOT_CONFIGS) {
      const before = getRobotState(75.999999, config.index);
      const after = getRobotState(76.000001, config.index);
      after.jointAngles.forEach((angle, axis) => expect(angle).toBeCloseTo(before.jointAngles[axis]!, 10));
    }
  });
  it('confines sparks to spot welding windows and excludes SPR, laser and assembly', () => {
    for (const config of ROBOT_CONFIGS) {
      const inside = getRobotState(26.4, config.index);
      expect(inside.welding).toBe(config.process === 'spot');
      expect(inside.riveting).toBe(config.process === 'spr');
      expect(getRobotState(26.8, config.index).welding).toBe(false);
      expect(getRobotState(25.9, config.index).welding).toBe(false);
      if (config.process === 'spot') {
        expect(inside.gunClosed).toBe(1);
        expect(inside.sparkAge).toBeCloseTo(0.4);
      }
    }
  });
});
