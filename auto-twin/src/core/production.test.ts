import { describe, expect, it } from 'vitest';
import { MAX_PRODUCTION_SECONDS, PLAYBACK_SPEEDS, ProductionClock } from './clock';
import { getCoilHoistPose, getPressPose, getRackBatch, getRackPose, getStampingState, PRESS_STROKE, RACK_CAPACITY } from './production';

describe('one production clock', () => {
  it('clamps negative, infinite and excessive real frame intervals', () => {
    const clock = new ProductionClock();
    clock.advance(-2);
    clock.advance(Number.NaN);
    clock.advance(Number.POSITIVE_INFINITY);
    expect(clock.time).toBe(0);
    clock.advance(10);
    expect(clock.time).toBeCloseTo(0.1);
  });
  it('pause freezes the simulation and seeking is independent of playback history', () => {
    const clock = new ProductionClock();
    clock.pause();
    clock.advance(0.1);
    expect(clock.time).toBe(0);
    clock.seek(124.2);
    expect(getStampingState(clock.time)).toEqual(getStampingState(124.2));
    clock.play();
    clock.advance(0.1);
    expect(clock.time).toBeCloseTo(124.3);
    clock.seek(-20);
    expect(clock.time).toBe(0);
  });
  it('supports all requested speeds without multiplying the frame clamp', () => {
    for (const speed of PLAYBACK_SPEEDS) {
      const clock = new ProductionClock();
      clock.setSpeed(speed);
      clock.advance(20);
      expect(clock.time).toBeCloseTo(0.1 * speed);
    }
  });
});

describe('deterministic stamping', () => {
  it('normalizes out-of-range times consistently for parts and rack identities', () => {
    const last = getStampingState(MAX_PRODUCTION_SECONDS);
    for (const time of [1e20, Number.MAX_VALUE]) {
      expect(getStampingState(time)).toEqual(last);
    }
    const initial = getStampingState(0);
    for (const time of [-Number.MAX_VALUE, NaN, Infinity, -Infinity]) {
      expect(getStampingState(time)).toEqual(initial);
    }
  });
  it('reaches the exact 1.35 metre stroke and returns to top dead centre', () => {
    expect(getPressPose(2.1).downstroke).toBe(PRESS_STROKE);
    expect(getPressPose(0).downstroke).toBe(0);
    expect(getPressPose(3.4).downstroke).toBe(0);
    for (let t = 0; t < 4; t += 0.01) {
      const pose = getPressPose(t);
      expect(pose.downstroke).toBeGreaterThanOrEqual(0);
      expect(pose.downstroke).toBeLessThanOrEqual(PRESS_STROKE);
      if (getStampingState(t).transfer.active) expect(pose.downstroke).toBe(0);
    }
  });
  it('has continuous press positions and zero speed at profile joins', () => {
    for (const join of [0.9, 1.45, 2.05, 2.3, 3.3, 4]) {
      const epsilon = 0.00001;
      expect(Math.abs(getPressPose(join + epsilon).downstroke - getPressPose(join - epsilon).downstroke)).toBeLessThan(0.00001);
      expect(Math.abs((getPressPose(join + epsilon).downstroke - getPressPose(join - epsilon).downstroke) / (2 * epsilon))).toBeLessThan(0.001);
    }
    expect(1.05 / 0.55).toBeGreaterThan(0.3 / 0.6);
  });
  it('keeps the same part identity, position and finished shape between stations', () => {
    const before = getStampingState(4 - 0.000001);
    const after = getStampingState(4 + 0.000001);
    for (let slot = 0; slot < 5; slot++) {
      const oldPart = before.parts[slot]!;
      const nextPart = after.parts[slot + 1]!;
      expect(nextPart.id).toBe(oldPart.id);
      expect(nextPart.x).toBeCloseTo(oldPart.x, 6);
      expect(nextPart.y).toBeCloseTo(oldPart.y, 6);
      expect(nextPart.z).toBeCloseTo(oldPart.z, 6);
      expect(nextPart.shape).toBeCloseTo(oldPart.shape, 6);
    }
    expect(new Set(after.parts.map((part) => part.id)).size).toBe(after.parts.length);
  });
  it('can seek backward and forward without changing the result', () => {
    const expected = getStampingState(387.52);
    getStampingState(99999);
    getStampingState(0);
    expect(getStampingState(387.52)).toEqual(expected);
  });
  it('executes all hoist stages with continuous motion and a physically attached load', () => {
    const stages = new Set<string>();
    for (let t = 0; t < 96; t += 0.2) {
      const pose = getCoilHoistPose(t);
      stages.add(pose.stage);
      if (pose.carrying) {
        expect(pose.hook[0]).toBeCloseTo(pose.coil[0]);
        expect(pose.hook[2]).toBeCloseTo(pose.coil[2]);
        expect(pose.hook[1] - pose.coil[1]).toBeCloseTo(0.9);
      }
    }
    expect(stages.size).toBe(8);
    for (const join of [12, 20, 30, 52, 64, 74, 84, 96]) {
      const left = getCoilHoistPose(join - 0.000001).hook;
      const right = getCoilHoistPose(join + 0.000001).hook;
      left.forEach((value, axis) => expect(right[axis]).toBeCloseTo(value, 5));
    }
  });
  it('exchanges a full 120 part rack after eight minutes for exactly 42 seconds', () => {
    expect(getRackPose(479.9).exchanging).toBe(false);
    expect(getRackPose(480).filled).toBe(120);
    expect(getRackPose(480).exchanging).toBe(true);
    expect(getRackPose(521.99).exchanging).toBe(true);
    expect(getRackPose(522).exchanging).toBe(false);
    expect(getRackPose(522).filled).toBe(0);
    expect(getRackPose(522).id).not.toBe(getRackPose(480).id);
    expect(getRackPose(500).bufferCount).toBe(5);
  });
  it('preserves the line-tail identity when a part enters its assigned line rack', () => {
    const leaving = getStampingState(4 - 0.000001).parts[5]!;
    const stored = getRackPose(4).storedParts[0]!;
    expect(stored.id).toBe(leaving.id);
    expect(stored.serial).toBe(leaving.serial);
    expect(stored.shape).toBe(leaving.shape);
    expect(getRackPose(4).lines[stored.line]!.z).toBe(leaving.z);
    expect(getStampingState(4).parts.some((part) => part.id === stored.id)).toBe(false);
    const startingBlank = getStampingState(0).parts[0]!;
    expect(getRackPose(24).storedParts.at(-1)!.id).toBe(startingBlank.id);
  });
  it('keeps 120 permanent unique identities per batch and 60 per alternating line', () => {
    const first = getRackBatch(1);
    const second = getRackBatch(2);
    expect(first.storedParts).toHaveLength(RACK_CAPACITY);
    expect(first.storedParts[0]!.id).toBe('SP-SIDE-L-00995');
    expect(first.storedParts.at(-1)!.id).toBe('SP-SIDE-L-01114');
    expect(second.storedParts[0]!.id).toBe('SP-SIDE-L-01115');
    expect(new Set([...first.storedParts, ...second.storedParts].map((part) => part.id)).size).toBe(2 * RACK_CAPACITY);
    for (const line of getRackPose(480).lines) {
      expect(line.capacity).toBe(60);
      expect(line.filled).toBe(60);
      expect(new Set(line.storedParts.map((part) => part.rackSlot)).size).toBe(60);
      expect(line.storedParts.every((part) => part.lineRackId === line.id)).toBe(true);
    }
    getRackPose(6000);
    expect(getRackBatch(1)).toEqual(first);
  });
  it('conserves exchange-buffer identities and drains them FIFO after the empty rack arrives', () => {
    const beforeArrival = getRackPose(522 - 0.000001);
    const emptyRack = getRackPose(522);
    expect(emptyRack.filled).toBe(0);
    expect(emptyRack.bufferCount).toBe(10);
    expect(emptyRack.bufferParts.map((part) => part.id)).toEqual(beforeArrival.bufferParts.map((part) => part.id));
    expect(emptyRack.completedRacks[0]!.storedParts).toEqual(beforeArrival.storedParts);
    expect(emptyRack.completedRacks[0]!.id).toBe(beforeArrival.id);
    const firstLoaded = getRackPose(522.8);
    expect(firstLoaded.filled).toBe(1);
    expect(firstLoaded.storedParts[0]!.id).toBe(emptyRack.bufferParts[0]!.id);
    expect(firstLoaded.bufferParts[0]!.id).toBe(emptyRack.bufferParts[1]!.id);
    expect(getRackPose(532.4).bufferCount).toBe(0);
    expect(getRackPose(532.4).filled).toBe(13);
    expect(getRackPose(959.99).exchanging).toBe(false);
    expect(getRackPose(960).exchanging).toBe(true);
    expect(getRackPose(960).storedParts).toEqual(getRackBatch(2).storedParts);
  });
  it('accounts for every produced part in active, buffered or completed racks across repeated exchanges', () => {
    const times = [0, 4, 479.99, 480, 480.01, 500, 521.99, 522, 522.8, 524, 532.4, 540, 959.99, 960, 1002, 6000];
    for (const time of times) {
      const rack = getRackPose(time);
      const visibleParts = [...rack.storedParts, ...rack.bufferParts, ...rack.completedRacks.flatMap((batch) => batch.storedParts)];
      const producedCount = Math.floor(time / 4);
      expect(rack.filled + rack.bufferCount + rack.shippedCount).toBe(producedCount);
      expect(visibleParts.length + rack.archivedRackCount * RACK_CAPACITY).toBe(producedCount);
      expect(new Set(visibleParts.map((part) => part.id)).size).toBe(visibleParts.length);
      expect(rack.storedParts.every((part) => part.loadedAt <= time + 1e-9)).toBe(true);
      expect(rack.bufferParts.every((part) => part.loadedAt > time)).toBe(true);
      const activeIds = new Set(getStampingState(time).parts.map((part) => part.id));
      expect(visibleParts.some((part) => activeIds.has(part.id))).toBe(false);
    }
    const expected = getRackPose(532.4);
    getRackPose(0);
    getRackPose(99999);
    expect(getRackPose(532.4)).toEqual(expected);
  });
});
