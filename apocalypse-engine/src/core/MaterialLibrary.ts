import * as THREE from 'three';
import { seeded } from '../utils/math';

export class MaterialLibrary {
  readonly box = new THREE.BoxGeometry(1, 1, 1);
  readonly cylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
  readonly pole = new THREE.CylinderGeometry(0.5, 0.5, 1, 5);
  readonly canopy = new THREE.IcosahedronGeometry(0.5, 1);
  readonly roof = new THREE.MeshStandardMaterial({ color: 0x6d7777, roughness: 0.84 });
  readonly concrete = new THREE.MeshStandardMaterial({ color: 0x8d9490, roughness: 0.82 });
  readonly steel = new THREE.MeshStandardMaterial({ color: 0x496165, metalness: 0.64, roughness: 0.47 });
  readonly bronze = new THREE.MeshStandardMaterial({ color: 0xb47743, metalness: 0.39, roughness: 0.52 });
  readonly asphalt = new THREE.MeshStandardMaterial({ color: 0x292f30, roughness: 0.97 });
  readonly concreteDark = new THREE.MeshStandardMaterial({ color: 0x4b5450, roughness: 0.89 });
  readonly paint = new THREE.MeshStandardMaterial({ color: 0xf5e7c8, roughness: 0.8 });
  readonly amber = new THREE.MeshStandardMaterial({ color: 0xd9a352, emissive: 0xf18a31, emissiveIntensity: 0.22 });
  readonly foliage = new THREE.MeshStandardMaterial({ color: 0x5c7755, roughness: 0.95, flatShading: true });
  readonly bark = new THREE.MeshStandardMaterial({ color: 0x6e5541, roughness: 1 });
  readonly chalk = new THREE.MeshStandardMaterial({ color: 0xa74e36, roughness: 0.68 });
  readonly rubble = new THREE.MeshStandardMaterial({ color: 0x837168, roughness: 0.95, flatShading: true });
  readonly crate = new THREE.MeshStandardMaterial({ color: 0xb77f46, roughness: 0.87 });
  readonly container = new THREE.MeshStandardMaterial({ color: 0x3f8586, metalness: 0.35, roughness: 0.69 });
  readonly glass: THREE.MeshStandardMaterial[];
  readonly masonry: THREE.MeshStandardMaterial[];

  constructor() {
    this.glass = Array.from({ length: 4 }, (_, index) => facade(false, index));
    this.masonry = Array.from({ length: 4 }, (_, index) => facade(true, index));
  }
}

function facade(solid: boolean, variant: number) {
  const random = seeded(112 + variant * 41 + Number(solid) * 33);
  const canvas = document.createElement('canvas');
  const lights = document.createElement('canvas');
  canvas.width = lights.width = 192;
  canvas.height = lights.height = 256;
  const paint = canvas.getContext('2d')!;
  const emission = lights.getContext('2d')!;
  paint.fillStyle = (solid ? ['#a8aba4', '#a69b89', '#aab2b2', '#848987'] :
    ['#627c88', '#8d9fa4', '#66868c', '#66777b'])[variant];
  paint.fillRect(0, 0, 192, 256);
  emission.fillStyle = '#000';
  emission.fillRect(0, 0, 192, 256);
  for (let row = 0; row < 16; row++) {
    const top = row * 16;
    paint.fillStyle = solid ? '#707976' : '#829498';
    paint.fillRect(0, top, 192, 1);
    for (let column = 0; column < 8; column++) {
      const left = column * 24 + (solid ? 4 : 1);
      const width = solid ? 16 : 22;
      const lit = random() < (solid ? 0.17 : 0.24);
      const rose = random() * 19;
      paint.fillStyle = lit ? '#a08959' : `rgb(${31 + rose},${54 + rose},${65 + rose})`;
      paint.fillRect(left, top + 2, width, solid ? 9 : 12);
      paint.fillStyle = lit ? '#c6ae77' : `rgba(153,196,202,${0.09 + random() * 0.24})`;
      paint.fillRect(left + 1, top + 3, width - 2, 2);
      paint.fillStyle = 'rgba(10,24,27,.37)';
      paint.fillRect(left + width * 0.67, top + 3, 1, solid ? 8 : 10);
      if (lit) {
        emission.fillStyle = random() < 0.65 ? '#ffc276' : '#76aeb5';
        emission.fillRect(left + 1, top + 3, width - 2, 6);
      }
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  const emissiveMap = new THREE.CanvasTexture(lights);
  map.colorSpace = emissiveMap.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return new THREE.MeshStandardMaterial({
    map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 0.66,
    metalness: solid ? 0.13 : 0.55, roughness: solid ? 0.74 : 0.33,
    envMapIntensity: solid ? 0.26 : 0.72,
  });
}
