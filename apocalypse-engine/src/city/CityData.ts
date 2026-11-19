import { Terrain, canalX, crossings } from './Terrain';
import { seeded } from '../utils/math';

export const DEFAULT_SEED = 43107;
export const BRIDGE_DECK = 7.15;
export const VIADUCT = { x: 84, start: -88, end: 51, deck: 7.2, width: 5.5 };
export type Architecture = 'glass' | 'setback' | 'round' | 'masonry' | 'civic';
export type Structure = 'shear' | 'frame' | 'isolated';

export interface Building {
  id: string;
  name: string;
  district: string;
  x: number;
  z: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  style: Architecture;
  structure: Structure;
  frequency: number;
  damping: number;
  driftLimit: number;
  tint: number;
}

export interface Bridge { x: number; z: number; span: number; width: number; elevation: number }
export interface Tree { x: number; z: number; scale: number; phase: number }
export interface Prop { x: number; z: number; yaw: number; size: number; kind: 'crate' | 'container' }

const levels = [
  [16, 32, 41, 24, 11],
  [23, 45, 57, 37, 17],
  [14, 26, 37, 26, 13],
  [12, 17, 25, 19, 10],
  [9, 13, 15, 11, 8],
];
const titles = [
  ['望潮公寓', '北岸金融中心', '铂湾大厦', '海事通信楼', '东港仓储'],
  ['日晷酒店', '气象监测塔', '子午中心', '远洋航运总部', '东堤公寓'],
  ['林荫公寓', '海事博物馆', '数据交换中心', '环港商务楼', '东岸学校'],
  ['西街工坊', '港湾图书馆', '蓝湾公寓', '应急指挥所', '防潮调度中心'],
  ['西码头仓库', '港务服务楼', '南码头客运站', '滨海市场', '海湾泵站'],
];
const styles: Architecture[] = ['masonry', 'glass', 'setback', 'round', 'civic'];
const structures: Structure[] = ['frame', 'shear', 'isolated'];

export function createCity(seed = DEFAULT_SEED) {
  const terrain = new Terrain();
  const random = seeded(seed);
  const buildings: Building[] = [];
  const columns = [-79, -36, 32, 64, 95];
  const rows = [-76, -48, -20, 9, 38];
  for (const [row, zBase] of rows.entries()) {
    for (const [column, xBase] of columns.entries()) {
      if ((row === 3 && column === 0) || (row === 4 && column === 2)) continue;
      const x = xBase + (random() - 0.5) * 2.8;
      const z = zBase + (random() - 0.5) * 2.0;
      const width = (column === 4 ? 12.4 : 14.8) + random() * 5;
      const depth = 12.5 + random() * 5;
      const height = levels[row][column] + random() * 2.8;
      const structure = structures[(column + row * 2) % structures.length];
      buildings.push({
        id: `B-${String(row * columns.length + column + 1).padStart(2, '0')}`,
        name: titles[row][column],
        district: row === 4 ? '南岸码头' : column < 2 ? '西岸街区' : row < 3 ? '东岸商务区' : '滨海街区',
        x, z, y: terrain.height(x, z), width, depth, height,
        style: row === 4 ? (column === 1 ? 'civic' : 'masonry') : styles[(column + row * 3) % styles.length],
        structure, frequency: (structure === 'isolated' ? 0.72 : 1) * (0.72 + 17 / height),
        damping: structure === 'isolated' ? 0.28 : structure === 'shear' ? 0.13 : 0.075,
        driftLimit: (structure === 'frame' ? 0.0072 : structure === 'shear' ? 0.013 : 0.018) * (0.8 + random() * 0.4),
        tint: Math.floor(random() * 4),
      });
    }
  }
  const bridges: Bridge[] = crossings.map((z, index) => ({
    x: canalX(z), z, span: index === 2 ? 30 : 25, width: index === 2 ? 7 : 5.8,
    elevation: index === 2 ? BRIDGE_DECK : index === 0 ? 5.9 : 4.9,
  }));
  const trees: Tree[] = [];
  const tree = (x: number, z: number, scale = 1) => trees.push({ x, z, scale: scale * (0.71 + random() * 0.62), phase: random() * 6.283 });
  for (const z of [-58, -29, 0, 29, 47]) {
    for (const x of [-96, -61, -51, -23, 23, 43, 54, 76, 89, 104]) tree(x, z);
  }
  for (let index = 0; index < 31; index++) {
    const x = -97 + random() * 35;
    const z = -1 + random() * 20;
    if (x < -88 || x > -68 || z > 16 || z < 2) tree(x, z, 1.13);
  }
  for (let index = 0; index < 22; index++) {
    const x = -111 + index * 10.2;
    if (Math.abs(x) > 13) tree(x, 52 - random() * 3, 0.83);
  }
  const props: Prop[] = Array.from({ length: 15 }, (_, index) => ({
    x: (index < 7 ? 24 : -95) + (index % 7) * 3.3,
    z: 46 + (index % 2) * 2.5, yaw: (random() - 0.5) * 0.45,
    size: 0.82 + random() * 0.68, kind: index % 3 === 0 ? 'container' : 'crate',
  }));
  return { seed, terrain, buildings, bridges, trees, props };
}

export type City = ReturnType<typeof createCity>;
