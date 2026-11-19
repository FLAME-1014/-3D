import * as THREE from 'three';
import type { City } from './CityData';
import { VIADUCT } from './CityData';
import { coastZ, roadWidth, roadX, roadZ, SHORE } from './Terrain';
import type { MaterialLibrary } from '../core/MaterialLibrary';
import { clamp, seeded } from '../utils/math';

interface Placement { x: number; y: number; z: number; sx: number; sy: number; sz: number; yaw?: number; tint?: number }

export function batch(geometry: THREE.BufferGeometry, material: THREE.Material, placements: Placement[], shadow = false) {
  const instance = new THREE.InstancedMesh(geometry, material, placements.length);
  const form = new THREE.Object3D();
  for (const [index, item] of placements.entries()) {
    form.position.set(item.x, item.y, item.z);
    form.scale.set(item.sx, item.sy, item.sz);
    form.rotation.set(0, item.yaw ?? 0, 0);
    form.updateMatrix();
    instance.setMatrixAt(index, form.matrix);
    if (item.tint !== undefined) instance.setColorAt(index, new THREE.Color(item.tint));
  }
  instance.castShadow = shadow;
  instance.receiveShadow = true;
  instance.computeBoundingSphere();
  return instance;
}

export function infrastructure(city: City, assets: MaterialLibrary) {
  const root = new THREE.Group();
  const { terrain, bridges } = city;
  const { vertices, triangles } = terrain.meshData();
  const relief = new THREE.BufferGeometry();
  relief.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  const shade = new Float32Array(vertices.length);
  const color = new THREE.Color();
  const moss = new THREE.Color(0x66705a);
  const earth = new THREE.Color(0x8b8a72);
  const stone = new THREE.Color(0x3b5150);
  for (let offset = 0; offset < vertices.length; offset += 3) {
    const [x, y, z] = vertices.subarray(offset, offset + 3);
    const variation = (Math.sin(x * 0.23 + z * 0.104) + Math.cos(z * 0.217)) * 0.13 + 0.47;
    color.copy(y < 0.5 ? stone : moss).lerp(earth, y < 0.5 ? 0.12 : variation).toArray(shade, offset);
  }
  relief.setAttribute('color', new THREE.BufferAttribute(shade, 3));
  relief.setIndex(new THREE.BufferAttribute(triangles, 1));
  relief.computeVertexNormals();
  const land = new THREE.Mesh(relief, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: 1,
  }));
  land.receiveShadow = true;
  root.add(land);
  const boxes = (material: THREE.Material, destinations: Placement[], shadows = false) => root.add(batch(assets.box, material, destinations, shadows));
  const curbs: Placement[] = [];
  const paint: Placement[] = [];
  const yellow: Placement[] = [];
  const pillars: Placement[] = [];
  const piers: Placement[] = [];
  const fittings: Placement[] = [];
  const lampPosts: Placement[] = [];
  const lamps: Placement[] = [];
  const decks: Placement[] = [];
  const greenery: Placement[] = [];
  const range = (start: number, end: number, width: number, fixed: number, alongZ: boolean,
    lift: (point: number) => number = () => 0, paintLane = true) => {
    const points: number[] = [];
    const index: number[] = [];
    const steps = Math.ceil((end - start) / 2);
    for (let step = 0; step <= steps; step++) {
      const axis = start + (end - start) * step / steps;
      for (let across = 0; across < 5; across++) {
        const side = width * (across / 4 - 0.5);
        const x = alongZ ? fixed + side : axis;
        const z = alongZ ? axis : fixed + side;
        points.push(x, terrain.height(x, z) + lift(axis) + 0.10, z);
        if (across < 4 && step < steps) {
          const vertex = step * 5 + across;
          index.push(...(alongZ
            ? [vertex, vertex + 5, vertex + 1, vertex + 1, vertex + 5, vertex + 6]
            : [vertex, vertex + 1, vertex + 5, vertex + 1, vertex + 6, vertex + 5]));
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    const surface = new THREE.Mesh(geometry, assets.asphalt);
    surface.receiveShadow = true;
    root.add(surface);
    for (let axis = start + 2; axis < end - 1; axis += 4) {
      const junction = (alongZ ? roadZ : roadX).some(intersection => Math.abs(intersection - axis) < 4.7);
      if (junction) continue;
      const x = alongZ ? fixed : axis;
      const z = alongZ ? axis : fixed;
      if (paintLane) yellow.push({ x, z, y: terrain.height(x, z) + lift(axis) + 0.14,
        sx: alongZ ? 0.15 : 1.92, sy: 0.035, sz: alongZ ? 1.92 : 0.15 });
      for (const sign of [-1, 1]) {
        const cx = alongZ ? fixed + sign * (width / 2 + 0.45) : axis;
        const cz = alongZ ? axis : fixed + sign * (width / 2 + 0.45);
        curbs.push({ x: cx, z: cz, y: terrain.height(cx, cz) + lift(axis) + 0.11,
          sx: alongZ ? 0.85 : 3.98, sy: 0.18, sz: alongZ ? 3.98 : 0.85 });
      }
    }
  };
  for (const x of roadX) range(-101, Math.min(coastZ(x) - 2.5, 53), roadWidth, x, true);
  for (const z of roadZ) {
    const bridge = bridges.find(spec => spec.z === z);
    if (bridge) {
      const start = bridge.x - bridge.span / 2;
      const end = bridge.x + bridge.span / 2;
      const ramp = (axis: number) => {
        const height = terrain.height(axis, z);
        const blend = Math.max(0, 1 - Math.min(Math.abs(axis - start), Math.abs(axis - end)) / 10);
        return (bridge.elevation - height - 0.13) * blend;
      };
      range(-115, start, roadWidth, z, false, ramp);
      range(end, 115, roadWidth, z, false, ramp);
      decks.push({ x: bridge.x, y: bridge.elevation - 0.45, z, sx: bridge.span, sy: 0.9, sz: bridge.width });
      for (const sign of [-1, 1]) {
        const side = z + sign * (bridge.width / 2 - 0.12);
        piers.push({ x: bridge.x, y: bridge.elevation + 0.43, z: side, sx: bridge.span, sy: 0.24, sz: 0.22 });
        for (let offset = -bridge.span / 2 + 1; offset < bridge.span / 2; offset += 2.65) {
          pillars.push({ x: bridge.x + offset, y: bridge.elevation + 0.26, z: side, sx: 0.16, sy: 0.65, sz: 0.17 });
        }
        const towerX = bridge.x + sign * bridge.span * 0.23;
        const base = terrain.height(towerX, z);
        const height = (z === 52 ? 16 : 7) + bridge.elevation - base;
        for (const edge of [-1, 1]) {
          const pz = z + edge * (bridge.width / 2 - 0.51);
          fittings.push({ x: towerX, y: base + height / 2, z: pz, sx: 0.72, sy: height, sz: 0.62 });
          if (z === 52) {
            for (let cable = 1; cable <= 5; cable++) {
              const tip = new THREE.Vector3(towerX + sign * (cable - 2.5) * 2.4, bridge.elevation + 0.16, pz);
              const top = new THREE.Vector3(towerX, base + height - 1.1 - cable * 0.45, pz);
              const link = new THREE.Mesh(assets.pole, assets.bronze);
              link.position.copy(tip).lerp(top, 0.5);
              link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(tip).normalize());
              link.scale.set(0.10, top.distanceTo(tip), 0.10);
              root.add(link);
            }
          }
        }
        fittings.push({ x: towerX, y: base + height - 0.55, z, sx: 0.58, sy: 0.54, sz: bridge.width });
      }
    } else {
      range(-115, -12, roadWidth, z, false);
      range(12, 115, roadWidth, z, false);
    }
    for (const x of roadX) {
      for (const sign of [-1, 1]) {
        for (let bar = -2; bar <= 2; bar++) {
          const px = x + 0.87 * bar;
          const pz = z + sign * 4.28;
          paint.push({ x: px, z: pz, y: terrain.height(px, pz) + 0.146, sx: 0.40, sy: 0.029, sz: 1.28 });
        }
      }
    }
  }
  const viaduct = VIADUCT;
  decks.push({ x: viaduct.x, y: viaduct.deck - 0.45, z: (viaduct.start + viaduct.end) / 2,
    sx: viaduct.width, sy: 0.9, sz: viaduct.end - viaduct.start });
  for (const sign of [-1, 1]) {
    piers.push({ x: viaduct.x + sign * viaduct.width * 0.48, y: viaduct.deck + 0.38,
      z: (viaduct.start + viaduct.end) / 2, sx: 0.28, sy: 0.56, sz: viaduct.end - viaduct.start });
  }
  for (let z = viaduct.start + 3; z < viaduct.end; z += 13) {
    const bottom = terrain.height(viaduct.x, z);
    pillars.push({ x: viaduct.x, z, y: (bottom + viaduct.deck) / 2, sx: 1.34, sy: viaduct.deck - bottom, sz: 1.34 });
  }
  for (let x = -115; x < 115; x += 3.74) {
    if (Math.abs(x) < 10) continue;
    const z = coastZ(x) - 2.1;
    piers.push({ x, z, y: terrain.height(x, z) + 0.26, sx: 3.78, sy: 0.76, sz: 1.76,
      yaw: -Math.atan2(coastZ(x + 2) - coastZ(x - 2), 4) });
  }
  for (const start of [-92, -59, 34, 67]) {
    const z = SHORE + 7.8;
    decks.push({ x: start, z, y: 1.55, sx: 7, sy: 0.53, sz: 24 });
    for (const offset of [-2.8, 2.8]) {
      for (const reach of [-8, 1, 9]) pillars.push({ x: start + offset, z: z + reach, y: -0.18, sx: 0.66, sy: 3.3, sz: 0.66 });
    }
    for (const dx of [-2.7, 2.7]) {
      for (const dz of [-7, 1, 8]) fittings.push({ x: start + dx, z: z + dz, y: 1.97, sx: 0.56, sy: 0.34, sz: 0.56 });
    }
  }
  const rng = seeded(city.seed ^ 442);
  for (const b of city.buildings) {
    const z = b.z + b.depth / 2 + 3.4;
    greenery.push({ x: b.x, z, y: terrain.height(b.x, z) + 0.12, sx: b.width + 1, sy: 0.22, sz: 2.3, tint: rng() < 0.5 ? 0xa6b292 : 0x748c79 });
    const x = b.x + b.width * 0.57 + 0.6;
    const y = terrain.height(x, z);
    lampPosts.push({ x, z, y: y + 2.2, sx: 0.11, sy: 4.4, sz: 0.11 });
    lamps.push({ x, z, y: y + 4.4, sx: 0.52, sy: 0.14, sz: 0.36 });
  }
  const square = { x: -79, z: 9, y: terrain.height(-79, 9) + 0.2 };
  piers.push({ ...square, sx: 23.5, sy: 0.30, sz: 18.5 });
  for (let grid = -4; grid <= 4; grid++) {
    paint.push({ x: square.x + grid * 2.4, y: square.y + 0.159, z: square.z, sx: 0.07, sy: 0.014, sz: 17.4 });
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.8, 4.05, 40), new THREE.MeshBasicMaterial({ color: 0xf0bb70, side: THREE.DoubleSide }));
  ring.position.set(square.x, square.y + 0.16, square.z);
  ring.rotation.x = -Math.PI / 2;
  root.add(ring);
  for (const x of [-28, 22]) {
    for (const z of [1, 16, 31, 46]) {
      const y = terrain.height(x, z);
      fittings.push({ x, y: y + 0.08, z, sx: 1.65, sy: 0.16, sz: 1.08 });
      for (let slot = -2; slot <= 2; slot++) paint.push({ x: x + slot * 0.27, y: y + 0.17, z, sx: 0.08, sy: 0.02, sz: 0.88 });
    }
  }
  boxes(assets.concrete, curbs);
  boxes(assets.concrete, piers, true);
  boxes(assets.asphalt, decks, true);
  boxes(assets.steel, pillars, true);
  boxes(assets.bronze, fittings, true);
  boxes(assets.paint, paint);
  boxes(assets.amber, yellow);
  boxes(assets.foliage, greenery);
  root.add(batch(assets.pole, assets.steel, lampPosts), batch(assets.box, assets.amber, lamps));
  return root;
}

export function drainageView(city: City, assets: MaterialLibrary) {
  const pipes: Placement[] = [];
  for (const x of [-28, 22]) {
    for (let z = 1; z <= 58; z += 2) {
      pipes.push({ x, z, y: city.terrain.height(x, z) + 0.24, sx: 0.22, sz: 1.43, sy: 0.05,
        tint: 0x67f4ff });
    }
  }
  const pipeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false });
  const overlay = batch(assets.box, pipeMaterial, pipes);
  overlay.renderOrder = 9;
  overlay.visible = false;
  return overlay;
}

export function farTerrain() {
  const geometry = new THREE.PlaneGeometry(950, 470, 96, 45);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  const palette = new Float32Array(position.count * 3);
  const peaks = [
    [-420, -485, 84, 96], [-320, -381, 51, 82], [-227, -365, 64, 100], [-133, -448, 73, 78],
    [-43, -410, 36, 67], [28, -423, 48, 120], [158, -395, 67, 91], [281, -365, 46, 75], [372, -412, 84, 114],
    [-236, -246, 33, 54], [-142, -271, 48, 85], [117, -273, 61, 71], [220, -260, 32, 60],
  ];
  const sand = new THREE.Color(0x5b6458);
  const greenery = new THREE.Color(0x32453f);
  const tint = new THREE.Color();
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index);
    const z = position.getZ(index) - 327;
    let h = -9;
    for (const [px, pz, altitude, slope] of peaks) {
      const reach = ((x - px) / slope) ** 2 + ((z - pz) / (slope * 0.65)) ** 2;
      h += altitude * Math.exp(-reach * 1.23);
    }
    h += (Math.sin(x * 0.081 + z * 0.053) + Math.sin(x * 0.016 - z * 0.081)) * 4 * clamp(h / 32, 0, 1);
    position.setXYZ(index, x, h, z);
    tint.copy(sand).lerp(greenery, clamp(h / 70, 0.25, 0.98)).toArray(palette, index * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(palette, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
}
