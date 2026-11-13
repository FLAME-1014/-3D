import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { applyOriginalBudget, LOD_LEVELS, type LODLevel } from '../core/lod';
import { getRobotState, getWeldingState, ROBOT_CONFIGS } from '../welding/logic';
import { createBody, type BodyModel } from './carBody';
import { createFactoryMaterials, type FactoryMaterials } from './materials';
import { createRobot, type RobotModel } from './robot';

const models: (BodyModel | RobotModel)[] = [], palettes: FactoryMaterials[] = [];
const palette = () => { const materials = createFactoryMaterials(); palettes.push(materials); return materials; };
afterEach(() => {
  models.splice(0).forEach(model => model.dispose());
  palettes.splice(0).forEach(materials => Object.values(materials).forEach(material => { material.map?.dispose(); material.dispose(); }));
});
const firstGeometry = (group: THREE.Group) => { let geometry: THREE.BufferGeometry | undefined; group.traverse(object => { if (!geometry && object instanceof THREE.Mesh) geometry = object.geometry; }); return geometry!; };
const assemblySnapshot = (body: BodyModel) => Object.fromEntries(Object.entries(body.parts).map(([key, part]) => [key, {
  position: part.position.toArray(), visible: part.visible,
  articulatedChildren: part.children.filter(child => child instanceof THREE.Group).map(child => child.position.toArray()),
}]));

describe('procedural model LOD invariants', () => {
  it('keeps all six joint origins, TCP and electrode contact for 22 robots through every level', () => {
    const materials = palette();
    for (const config of ROBOT_CONFIGS) {
      const robot = createRobot(config, materials); models.push(robot);
      const root = robot.group; root.userData.id = `ROBOT-${config.index}`;
      robot.apply(getRobotState(26.2, config.index));
      const origins = robot.joints.map(joint => joint.position.toArray());
      for (const [levelIndex, level] of LOD_LEVELS.entries()) {
        robot.setLOD(level, levelIndex);
        expect(robot.group).toBe(root); expect(root.children).toHaveLength(1);
        root.traverse(object => expect(object.userData.id).toBe(root.userData.id));
        for (const time of [26.2, 34.2, 42.2, 50.2]) {
          const pose = getRobotState(time, config.index); robot.apply(pose); root.updateWorldMatrix(true, true);
          expect(robot.joints.map(joint => joint.position.toArray())).toEqual(origins);
          const tcp = robot.tcp.getWorldPosition(new THREE.Vector3());
          expect(tcp.distanceTo(new THREE.Vector3(...pose.toolPoint))).toBeLessThan(1e-10);
          if (robot.electrodeTips.length === 2) {
            const midpoint = robot.electrodeTips[0]!.getWorldPosition(new THREE.Vector3()).add(robot.electrodeTips[1]!.getWorldPosition(new THREE.Vector3())).multiplyScalar(.5);
            expect(midpoint.distanceTo(tcp)).toBeLessThan(1e-10);
          }
        }
      }
    }
  });

  it('replays partial body assembly and identities while meeting actual geometry budgets', () => {
    const materials = palette(), body = createBody(materials), robot = createRobot(ROBOT_CONFIGS[8]!, materials);
    models.push(body, robot); const root = body.group; root.userData.id = 'BIW-TEST';
    body.update({ ...getWeldingState(55).stations[5]!.assembly, sides: .72, roof: .55, rearDoors: .38, frontDoors: .21 });
    const expected = assemblySnapshot(body), bodyTriangles: number[] = [], robotTriangles: number[] = [];
    for (const [index, level] of LOD_LEVELS.entries()) {
      body.setLOD(level, index); robot.setLOD(level, index);
      expect(body.group).toBe(root); expect(root.children).toHaveLength(1); expect(assemblySnapshot(body)).toEqual(expected);
      root.traverse(object => expect(object.userData.id).toBe('BIW-TEST'));
      bodyTriangles.push(body.lodStats.resident.find(entry => entry.level === level)!.triangles);
      robotTriangles.push(robot.lodStats.resident.find(entry => entry.level === level)!.triangles);
    }
    expect(bodyTriangles[0]).toBeLessThan(300); expect(robotTriangles[0]).toBeLessThan(100);
    for (const counts of [bodyTriangles, robotTriangles]) {
      expect(counts[1]).toBeGreaterThanOrEqual(5000); expect(counts[1]).toBeLessThanOrEqual(7000);
      expect(counts[2]).toBeGreaterThan(counts[1]!); expect(counts[3]).toBeGreaterThan(counts[2]!);
    }
  });

  it('creates variants lazily, reuses them, and expires inactive geometry after eight wall seconds despite production seeks', () => {
    const body = createBody(palette()); models.push(body);
    expect(body.lodStats.resident.map(entry => entry.level)).toEqual(['proxy']);
    const proxyRoot = body.group.children[0]!, geometry = firstGeometry(body.group); let disposed = 0;
    geometry.addEventListener('dispose', () => disposed++);
    body.setLOD('low', 10); const lowRoot = body.group.children[0]!;
    body.setLOD('proxy', 11); expect(body.group.children[0]).toBe(proxyRoot);
    body.setLOD('low', 12); expect(body.group.children[0]).toBe(lowRoot);
    body.update(getWeldingState(100000).stations[5]!.assembly);
    body.update(getWeldingState(0).stations[5]!.assembly);
    body.maintain(19.99); expect(disposed).toBe(0); expect(body.lodStats.resident).toHaveLength(2);
    body.maintain(20); expect(disposed).toBe(1); expect(body.lodStats.resident.map(entry => entry.level)).toEqual(['low']);
    body.maintain(5); body.maintain(1000); expect(body.lodStats.resident.map(entry => entry.level)).toEqual(['low']);
  });

  it('disposes displaced originals before admitting newly close robots, preserving a hard three-resident limit', () => {
    const materials = palette(), robots = ROBOT_CONFIGS.slice(0, 5).map(config => createRobot(config, materials)); models.push(...robots);
    const residentOriginals = () => robots.filter(robot => robot.lodStats.resident.some(entry => entry.level === 'original')).length;
    const reconcile = (distances: number[], wallSeconds: number) => {
      const levels: LODLevel[] = applyOriginalBudget(distances.map(() => 'original'), distances, 'fine');
      robots.forEach((robot, index) => { if (levels[index] !== 'original') robot.releaseOriginal(); expect(residentOriginals()).toBeLessThanOrEqual(3); });
      robots.forEach((robot, index) => { robot.setLOD(levels[index]!, wallSeconds); expect(residentOriginals()).toBeLessThanOrEqual(3); });
    };
    reconcile([2, 4, 6, 8, 10], 1); expect(residentOriginals()).toBe(3);
    reconcile([10, 9, 8, 1, 2], 2); expect(residentOriginals()).toBe(3);
    reconcile([Infinity, Infinity, Infinity, Infinity, Infinity], 3); expect(residentOriginals()).toBe(0);
  });
});
