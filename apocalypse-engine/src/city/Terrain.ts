import { clamp, mix } from '../utils/math';

export const TIDE = 0.65;
export const SHORE = 57;
export const GRID = { width: 61, height: 55, spacing: 4, minX: -120, minZ: -106 } as const;
export const MAX_X = GRID.minX + (GRID.width - 1) * GRID.spacing;
export const MAX_Z = GRID.minZ + (GRID.height - 1) * GRID.spacing;
export const canalX = (z: number) => -1 + Math.sin(z * 0.028) * 5;
export const coastZ = (x: number) => SHORE + Math.sin(x * 0.024) * 3.1;
export const roadX = [-101, -56, -17, 18, 48, 81, 109];
export const roadZ = [-89, -63, -35, -6, 23, 52];
export const crossings = [-35, 23, 52];
export const roadWidth = 6.6;

function elevation(x: number, z: number) {
  const coast = coastZ(x) - z;
  const canal = Math.abs(x - canalX(z));
  const land = 1.74 + 0.013 * Math.max(0, coast) +
    3.8 * Math.exp(-((x + 84) ** 2 + (z + 78) ** 2) / 2200) +
    2.2 * Math.exp(-((x - 95) ** 2 + (z + 86) ** 2) / 2500) +
    0.23 * Math.sin(x * 0.069) * Math.cos(z * 0.083) -
    0.94 * Math.exp(-((x - 35) ** 2 + (z - 31) ** 2) / 570);
  const bankBlend = clamp((canal - 4.7) / 5.5, 0, 1) * clamp((coast + 1.8) / 6, 0, 1);
  const seaBed = -2.1 - Math.max(0, -coast) * 0.027 + Math.sin(x * 0.041 + z * 0.035) * 0.18;
  return mix(seaBed, land, bankBlend);
}

export class Terrain {
  readonly heights = new Float32Array(GRID.width * GRID.height);
  readonly ocean = new Uint8Array(this.heights.length);
  readonly channels = new Uint8Array(this.heights.length);
  readonly drainage = new Float32Array(this.heights.length);

  constructor() {
    for (let row = 0; row < GRID.height; row++) {
      for (let column = 0; column < GRID.width; column++) {
        const index = row * GRID.width + column;
        const x = this.x(column);
        const z = this.z(row);
        this.heights[index] = elevation(x, z);
        this.ocean[index] = z > coastZ(x) + 8 ? 1 : 0;
        this.channels[index] = this.heights[index] < TIDE - 0.35 ? 1 : 0;
        const gutter = roadX.some(lane => Math.abs(x - lane) < 3.5) ||
          roadZ.some(lane => Math.abs(z - lane) < 3.5);
        const pumping = z > 0 && z < 48 && (Math.abs(x - 22) < 12 || Math.abs(x + 28) < 12);
        this.drainage[index] = this.channels[index] ? 0 : pumping ? 1 : gutter ? 0.52 : 0.20;
      }
    }
  }

  x(column: number) { return GRID.minX + column * GRID.spacing; }
  z(row: number) { return GRID.minZ + row * GRID.spacing; }

  sample(field: ArrayLike<number>, x: number, z: number) {
    const horizontal = clamp((x - GRID.minX) / GRID.spacing, 0, GRID.width - 1.000001);
    const vertical = clamp((z - GRID.minZ) / GRID.spacing, 0, GRID.height - 1.000001);
    const column = Math.floor(horizontal);
    const row = Math.floor(vertical);
    const index = row * GRID.width + column;
    const fx = horizontal - column;
    const fz = vertical - row;
    const topLeft = field[index];
    const topRight = field[index + 1];
    const bottomLeft = field[index + GRID.width];
    const bottomRight = field[index + GRID.width + 1];
    return fx + fz <= 1
      ? topLeft + fx * (topRight - topLeft) + fz * (bottomLeft - topLeft)
      : bottomRight + (1 - fx) * (bottomLeft - bottomRight) + (1 - fz) * (topRight - bottomRight);
  }

  height(x: number, z: number) { return this.sample(this.heights, x, z); }

  meshData() {
    const vertices = new Float32Array(this.heights.length * 3);
    const triangles = new Uint32Array((GRID.width - 1) * (GRID.height - 1) * 6);
    let offset = 0;
    for (let row = 0; row < GRID.height; row++) {
      for (let column = 0; column < GRID.width; column++) {
        const index = row * GRID.width + column;
        vertices.set([this.x(column), this.heights[index], this.z(row)], 3 * index);
        if (column < GRID.width - 1 && row < GRID.height - 1) {
          const nextRow = index + GRID.width;
          triangles.set([index, nextRow, index + 1, index + 1, nextRow, nextRow + 1], offset);
          offset += 6;
        }
      }
    }
    return { vertices, triangles };
  }
}
