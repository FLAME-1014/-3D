import * as THREE from 'three';
import { box, cylinder, instances, label, mergeStatic, placement, type Point3 } from '../prefabs/factory';
import type { Pickable, World } from '../scene/types';

export const PARK_SIZE = [260, 180] as const;
export const PARK_CAMERA = { position: [-25, 315, 150] as Point3, target: [-25, 0, 0] as Point3 };

export interface ParkBuilding {
  id: 'stamping' | 'welding' | 'paint' | 'assembly';
  name: string;
  en: string;
  center: Point3;
  size: Point3;
  planned: boolean;
  number: string;
}

export const PARK_BUILDINGS: readonly ParkBuilding[] = [
  { id: 'stamping', name: '冲压车间', en: 'STAMPING SHOP', center: [-30, 0, -28], size: [62, 8.6, 37], planned: false, number: '01' },
  { id: 'welding', name: '焊装车间', en: 'BODY SHOP', center: [47, 0, -28], size: [62, 8.2, 37], planned: false, number: '02' },
  { id: 'paint', name: '涂装车间', en: 'PAINT SHOP', center: [47, 0, 30], size: [64, 7.8, 34], planned: true, number: '03' },
  { id: 'assembly', name: '总装车间', en: 'FINAL ASSEMBLY', center: [-30, 0, 30], size: [64, 7.8, 34], planned: true, number: '04' },
];

function grassTexture(): THREE.DataTexture {
  const size = 128, pixels = new Uint8Array(size * size * 4);
  let seed = 75211;
  for (let index = 0; index < size * size; index++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = (seed / 4294967296 - .5) * 14;
    pixels.set([112 + noise, 132 + noise, 91 + noise, 255], index * 4);
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(18, 12); texture.needsUpdate = true;
  return texture;
}

function palette() {
  const painted = (color: string, roughness = .86) => new THREE.MeshStandardMaterial({ color, roughness, metalness: .06 });
  return {
    grass: new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1, color: '#e7eadc' }),
    pavement: painted('#b4bcb5', .96), asphalt: painted('#65716c', .99), curb: painted('#d2d7cb'),
    white: painted('#edf0e9', .75), roof: painted('#d9e0da', .72), planned: painted('#cdd5cc', .84),
    steel: new THREE.MeshStandardMaterial({ color: '#8f9f9e', roughness: .56, metalness: .55 }),
    dark: painted('#475751'), window: painted('#91afb3', .54), yellow: painted('#e6bd48', .9),
    leaves: painted('#596f43', 1), trunks: painted('#73725d', 1), cargo: painted('#848e70'), orange: painted('#b77952'),
    tire: painted('#35453e', 1), car: painted('#e1e6dd', .7), glass: painted('#61797a', .55),
  };
}
type Palette = ReturnType<typeof palette>;

function roofSign(parent: THREE.Object3D, title: string, subtitle: string, position: Point3, width = 28, height = 5.2) {
  const sign = label(parent, title, subtitle, position, width, height);
  sign.rotation.x = -Math.PI / 2;
  return sign;
}

function road(parent: THREE.Object3D, center: Point3, width: number, depth: number, m: Palette) {
  box(parent, [width + .8, .12, depth + .8], [center[0], .025, center[2]], m.curb).castShadow = false;
  box(parent, [width, .13, depth], [center[0], .10, center[2]], m.asphalt).castShadow = false;
}

function factoryBuilding(parent: THREE.Group, building: ParkBuilding, m: Palette): THREE.Group {
  const group = new THREE.Group(); group.name = building.name; group.position.set(...building.center); parent.add(group);
  const [width, height, depth] = building.size, wall = building.planned ? m.planned : m.white;
  box(group, [width + 5, .15, depth + 5], [0, .04, 0], m.pavement);
  box(group, [width, height, depth], [0, height / 2 + .14, 0], wall);
  box(group, [width + .2, .25, depth + .2], [0, .32, 0], m.dark);
  for (const side of [-1, 1]) {
    box(group, [width - 1.6, 1.15, .08], [0, height - 1.55, side * (depth / 2 + .06)], m.window);
    box(group, [.08, 1.15, depth - 1.6], [side * (width / 2 + .06), height - 1.55, 0], m.window);
    for (let x = -width / 2 + 2; x < width / 2; x += 5) box(group, [.12, height - .8, .09], [x, height / 2, side * (depth / 2 + .12)], m.roof);
    for (let z = -depth / 2 + 2; z < depth / 2; z += 5) box(group, [.09, height - .8, .12], [side * (width / 2 + .12), height / 2, z], m.roof);
  }
  const band = depth / 5;
  for (let index = 0; index < 5; index++) {
    const z = -depth / 2 + (index + .5) * band;
    const sheet = box(group, [width + .7, .16, band + .04], [0, height + .38, z], building.planned ? m.planned : m.roof);
    sheet.rotation.x = .075;
    const skylight = box(group, [width - 3, .07, .95], [0, height + .64, z - band / 2 + .65], m.window);
    skylight.rotation.x = .075;
    box(group, [width + .7, .10, .15], [0, height + .14, z + band / 2], m.steel);
  }
  for (const x of [-width / 2 + 7, width / 2 - 7]) for (let z = -depth / 2 + 6; z < depth / 2; z += 8) {
    box(group, [2.4, .7, 1.8], [x, height + .9, z], m.steel);
    box(group, [2, .06, 1.45], [x, height + 1.3, z], m.dark);
  }
  for (const x of [-width / 2 + 7, -width / 2 + 15, width / 2 - 15, width / 2 - 7]) {
    box(group, [4, 3.6, .14], [x, 1.94, depth / 2 + .14], m.dark);
    for (let y = .4; y < 3.8; y += .45) box(group, [3.7, .06, .07], [x, y, depth / 2 + .24], m.steel);
    box(group, [5, .12, 2.5], [x, 4.1, depth / 2 + 1], m.yellow);
    for (const dx of [-2.3, 2.3]) cylinder(group, .12, 1.1, [x + dx, .75, depth / 2 + 1.6], m.yellow, 8);
  }
  if (building.id === 'stamping') for (const z of [-12, 0, 12]) {
    box(group, [.15, 3.8, 4], [-width / 2 - .17, 2, z], m.dark);
    box(group, [2.4, .3, 5.4], [-width / 2 - 1, .32, z], m.yellow);
  }
  mergeStatic(group);
  roofSign(group, `${building.number}  ${building.name}${building.planned ? ' · 规划中' : ''}`, building.planned ? `${building.en} / PHASE II` : `${building.en} / 点击进入`, [0, height + 1.15, -1], 40, 9);
  return group;
}

function corridor(parent: THREE.Object3D, from: Point3, to: Point3, m: Palette, width = 5) {
  const group = new THREE.Group(); parent.add(group);
  const length = Math.hypot(to[0] - from[0], to[2] - from[2]);
  group.position.set((from[0] + to[0]) / 2, 0, (from[2] + to[2]) / 2);
  group.rotation.y = -Math.atan2(to[2] - from[2], to[0] - from[0]);
  box(group, [length, .35, width], [0, 4.8, 0], m.white);
  box(group, [length, .18, width + .35], [0, 6.8, 0], m.roof);
  for (const side of [-1, 1]) {
    box(group, [length, 1.55, .1], [0, 5.85, side * width / 2], m.window);
    box(group, [length, .20, .2], [0, 5.05, side * width / 2], m.dark);
    for (let x = -length / 2 + 1; x < length / 2; x += 2.4) box(group, [.10, 1.65, .16], [x, 5.8, side * width / 2], m.white);
  }
  for (const x of [-length / 2 + 1, length / 2 - 1]) for (const z of [-width / 2 + .3, width / 2 - .3]) box(group, [.38, 4.5, .38], [x, 2.35, z], m.white);
  mergeStatic(group);
}

function carGeometry(): THREE.BufferGeometry {
  const side = new THREE.Shape();
  side.moveTo(-2.15, .38); side.lineTo(-1.95, .73); side.lineTo(-1.2, .82); side.lineTo(-.65, 1.24);
  side.lineTo(.83, 1.24); side.lineTo(1.4, .84); side.lineTo(2.04, .73); side.lineTo(2.18, .4); side.closePath();
  const geometry = new THREE.ExtrudeGeometry(side, {depth: 1.85, bevelEnabled: true, bevelSize: .10, bevelThickness: .08, bevelSegments: 1, steps: 1});
  geometry.translate(0, 0, -.925);
  return geometry;
}

function cars(parent: THREE.Object3D, locations: Point3[], m: Palette, prefix: string, heading = Math.PI / 2) {
  const rotations = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading);
  const bodies = instances(parent, carGeometry(), m.car, locations.map(location => placement(location, [1, 1, 1], rotations)));
  bodies.userData.instanceIds = locations.map((_, index) => `${prefix}-${String(index + 1).padStart(3, '0')}`);
  locations.forEach((_, index) => bodies.setColorAt(index, new THREE.Color(['#e8eade', '#b8c3bc', '#899b97', '#d4d6cb'][index % 4]!)));
  const glass: THREE.Matrix4[] = [], wheels: THREE.Matrix4[] = [];
  for (const location of locations) {
    const transform = placement(location, [1, 1, 1], rotations);
    glass.push(transform.clone().multiply(placement([.1, 1.25, 0], [1.6, .055, 1.45])));
    for (const x of [-1.35, 1.35]) for (const z of [-.97, .97]) wheels.push(transform.clone().multiply(placement([x, .38, z], [1, 1, 1], new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2))));
  }
  instances(parent, new THREE.BoxGeometry(1, 1, 1), m.glass, glass);
  instances(parent, new THREE.CylinderGeometry(.34, .34, .16, 8), m.tire, wheels);
  return bodies;
}

function truck(parent: THREE.Object3D, location: Point3, m: Palette, rotation = 0) {
  const group = new THREE.Group(); group.position.set(...location); group.rotation.y = rotation; parent.add(group);
  box(group, [9, 3, 2.85], [-1.4, 2, 0], m.white);
  box(group, [2.6, 2.1, 2.7], [4.45, 1.6, 0], m.white);
  box(group, [.1, .76, 2.2], [5.79, 2, 0], m.window);
  box(group, [2.1, .73, .07], [4.4, 2, 1.39], m.window);
  for (const x of [-4.3, -3.2, 3.2, 5.1]) for (const z of [-1.35, 1.35]) {
    const wheel = cylinder(group, .48, .26, [x, .53, z], m.tire, 8); wheel.rotation.x = Math.PI / 2;
  }
  box(group, [11.7, .25, 2.1], [.1, .6, 0], m.dark);
  for (let x = -5.5; x < 3; x += .8) for (const z of [-1.46, 1.46]) box(group, [.04, 2.5, .04], [x, 2, z], m.steel);
  mergeStatic(group);
}

export function createParkWorld(): World {
  const group = new THREE.Group(); group.name = '智能制造园区';
  const m = palette(), ground = new THREE.Group(), roads = new THREE.Group(), landscape = new THREE.Group();
  group.add(ground, roads, landscape);
  box(ground, [260, .45, 180], [0, -.28, 0], m.grass).castShadow = false;
  for (const z of [-79, 79]) road(roads, [0, 0, z], 250, 8, m);
  for (const x of [-121, 121]) road(roads, [x, 0, 0], 8, 158, m);
  road(roads, [0, 0, 0], 234, 10, m);
  for (const z of [-61.5, 59]) road(roads, [0, 0, z], 234, 7, m);
  road(roads, [8, 0, -.5], 6, 117, m);
  const markings: THREE.Matrix4[] = [];
  for (const z of [-79, 0, 79]) for (let x = -114; x <= 114; x += 7) markings.push(placement([x, .18, z], [3, .02, .12]));
  for (const x of [-121, 121]) for (let z = -69; z < 73; z += 7) markings.push(placement([x, .18, z], [.12, .02, 3]));
  for (const z of [-5.1, 5.1]) markings.push(placement([0, .17, z], [230, .02, .12]));
  instances(roads, new THREE.BoxGeometry(1, 1, 1), m.yellow, markings).castShadow = false;
  mergeStatic(ground); mergeStatic(roads);

  const pickables: Pickable[] = [];
  const halls = PARK_BUILDINGS.map(building => {
    const hall = factoryBuilding(group, building, m);
    const description = building.planned ? '规划中的二期车间。' : `点击进入${building.name}，查看连续工艺与设备数字孪生。`;
    hall.userData = {id: building.id, name: building.name, description, planned: building.planned, entryCamera: [building.center[0] + 12, 20, building.center[2] + 23], entryTarget: [building.center[0], 3, building.center[2]]};
    hall.traverse(object => {if (object instanceof THREE.Mesh) object.userData = {...object.userData, id: building.id, name: building.name, description, planned: building.planned}});
    pickables.push({object: hall, id: building.id, name: building.name, station: -1, description});
    return hall;
  });
  corridor(group, [1, 0, -28], [16, 0, -28], m);
  corridor(group, [47, 0, -9.5], [47, 0, 13], m, 5.8);
  corridor(group, [2, 0, 30], [15, 0, 30], m);

  // Office, entry court and visitor parking occupy the west side of the campus.
  const office = new THREE.Group(); group.add(office);
  box(office, [28, .15, 28], [-94, .03, 20], m.pavement);
  box(office, [23, 12, 24], [-94, 6.1, 20], m.white);
  for (const y of [2, 5, 8, 11]) {
    box(office, [21.5, 1.3, .1], [-94, y, 32.1], m.window);
    box(office, [.1, 1.3, 21.5], [-82.4, y, 20], m.window);
  }
  box(office, [23.8, .25, 24.8], [-94, 12.35, 20], m.roof);
  box(office, [6, .18, 4.2], [-94, 3.2, 34], m.yellow);
  box(office, [3, .65, 2], [-100, 12.8, 14], m.steel);
  for (let z = 33; z < 36; z += .5) box(office, [7, .17, .5], [-94, .3 - (z - 33) * .04, z], m.curb);
  mergeStatic(office); roofSign(office, '研发办公楼', 'ADMINISTRATION', [-94, 12.8, 19], 20, 4.2);
  box(landscape, [42, .13, 20], [-94, .06, 47], m.pavement);
  const visitors: Point3[] = [];
  for (const z of [42, 50]) for (let column = 0; column < 7; column++) visitors.push([-109 + column * 5, .1, z]);
  cars(group, visitors, m, 'VISITOR', 0);
  const parkingLines: THREE.Matrix4[] = [];
  for (const z of [42, 50]) for (let column = 0; column <= 7; column++) parkingLines.push(placement([-111.5 + column * 5, .15, z], [.09, .02, 5.6]));
  roofSign(group, '访客停车场', 'VISITOR PARKING', [-94, .28, 55.2], 24, 2.8);

  // Freight containers and docked trucks beside the stamping hall.
  box(landscape, [42, .14, 44], [-94, .06, -32], m.pavement);
  const freight = new THREE.Group(); group.add(freight);
  for (let row = 0; row < 3; row++) for (let column = 0; column < 2; column++) {
    const x = -105 + column * 13, z = -46 + row * 10, height = row === 0 ? 5.6 : 2.8;
    box(freight, [10.8, height, 3.1], [x, height / 2 + .2, z], column === 0 ? m.cargo : m.orange);
    for (let dx = -5; dx < 5.3; dx += .8) for (const side of [-1, 1]) box(freight, [.04, height - .15, .06], [x + dx, height / 2 + .2, z + side * 1.58], m.steel);
  }
  for (const z of [-40, -28, -16]) truck(freight, [-68.5, .1, z], m, Math.PI);
  mergeStatic(freight); roofSign(group, '原料 · 物流货场', 'INBOUND LOGISTICS', [-94, .3, -11.5], 28, 3.8);
  box(landscape, [29, .14, 42], [101, .06, -32], m.pavement);
  for (const x of [93, 101, 109]) truck(group, [x, .1, -32], m, Math.PI / 2);
  roofSign(group, '物流调度区', 'FREIGHT DISPATCH', [101, .3, -9.5], 25, 3.5);

  // Finished cars are separate from the office parking lot.
  box(landscape, [28, .14, 45], [101, .06, 29], m.pavement);
  const finished: Point3[] = [];
  for (let row = 0; row < 8; row++) for (let column = 0; column < 6; column++) finished.push([92.2 + column * 3.5, .1, 11.5 + row * 5]);
  cars(group, finished, m, 'FINISHED');
  for (let row = 0; row < 8; row++) for (let column = 0; column <= 6; column++) parkingLines.push(placement([90.45 + column * 3.5, .15, 11.5 + row * 5], [.09, .02, 4.5]));
  instances(group, new THREE.BoxGeometry(1, 1, 1), m.white, parkingLines).castShadow = false;
  roofSign(group, '成品车场', 'FINISHED VEHICLES', [101, .3, 53], 25, 3.8);

  const treePositions: Point3[] = [];
  for (const z of [-87, 87]) for (let x = -121; x <= 121; x += 8) treePositions.push([x, 0, z]);
  for (const x of [-127, 127]) for (let z = -71; z <= 71; z += 8) treePositions.push([x, 0, z]);
  for (const z of [-53, 51, 8]) for (let x = -58; x < 78; x += 9) if (Math.abs(x - 8) > 5 && (z !== 8 || Math.abs(x - 47) > 6)) treePositions.push([x, 0, z]);
  const trunks: THREE.Matrix4[] = [], canopies: THREE.Matrix4[] = [], lowerCanopies: THREE.Matrix4[] = [];
  for (const [index, position] of treePositions.entries()) {
    const height = 3.4 + (index % 5) * .26, radius = 1.45 + (index % 3) * .15;
    trunks.push(placement([position[0], 1.05, position[2]], [.22, 2.1, .22]));
    canopies.push(placement([position[0], height + .2, position[2]], [radius, height, radius]));
    lowerCanopies.push(placement([position[0], 2.5, position[2]], [radius * 1.17, height * .8, radius * 1.17]));
  }
  instances(group, new THREE.CylinderGeometry(1, 1, 1, 6), m.trunks, trunks);
  const trees = instances(group, new THREE.ConeGeometry(1, 1, 7), m.leaves, canopies);
  const lowerTrees = instances(group, new THREE.ConeGeometry(1, 1, 7), m.leaves, lowerCanopies);
  for (let index = 0; index < treePositions.length; index++) {
    const color = new THREE.Color(['#e2e6cd', '#b2c3a1', '#cad4b3'][index % 3]!); trees.setColorAt(index, color); lowerTrees.setColorAt(index, color);
  }
  const gate = new THREE.Group(); group.add(gate);
  box(gate, [4.5, 3, 4], [-112, 1.65, 8], m.white);
  box(gate, [3.3, 1.3, .08], [-112, 2.1, 10.04], m.window);
  box(gate, [5.1, .22, 4.8], [-112, 3.3, 8], m.roof);
  cylinder(gate, .18, 3.4, [-119, 1.8, 6], m.yellow, 8);
  box(gate, [.16, .16, 5.8], [-119, 1.05, 2.9], m.yellow);
  mergeStatic(gate); label(gate, 'AXIOM 智造园区', 'AUTOMOTIVE CAMPUS', [-111.5, 4.9, 10.5], 13, 2.2);
  mergeStatic(landscape);

  const destinations = PARK_BUILDINGS.map(building => ({id: building.id, name: building.name, en: building.en, center: [...building.center], size: [...building.size], planned: building.planned, entryCamera: [building.center[0] + 12, 20, building.center[2] + 23], entryTarget: [building.center[0], 3, building.center[2]]}));
  return {
    shop: 'park', group, stations: [], pickables, camera: PARK_CAMERA,
    update: () => {},
    debug: () => ({siteSize: [...PARK_SIZE], destinations, treeInstances: treePositions.length, visitorCars: visitors.length, finishedCars: finished.length, freightTrucks: 6, hallCount: halls.length, plannedShops: ['paint', 'assembly'], navigationShops: PARK_BUILDINGS.filter(building => !building.planned).map(building => building.id)}),
  };
}
