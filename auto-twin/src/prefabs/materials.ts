import * as THREE from 'three';

export interface FactoryMaterials {
  floor: THREE.MeshStandardMaterial;
  white: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  darkSteel: THREE.MeshStandardMaterial;
  orange: THREE.MeshStandardMaterial;
  yellow: THREE.MeshStandardMaterial;
  green: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  black: THREE.MeshStandardMaterial;
  light: THREE.MeshStandardMaterial;
  red: THREE.MeshStandardMaterial;
  blue: THREE.MeshStandardMaterial;
}

function surfaceTexture(kind: 'floor' | 'brushed'): THREE.Texture {
  if (typeof document === 'undefined') {
    const fallback = new THREE.DataTexture(new Uint8Array([180, 185, 183, 255]), 1, 1);
    fallback.needsUpdate = true;
    return fallback;
  }
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d')!;
  const pixels = context.createImageData(256, 256);
  let seed = 91617;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = (seed / 4294967296 - 0.5) * (kind === 'floor' ? 14 : 20);
    const base = kind === 'floor' ? 183 : 200 + Math.sin(y * 1.81) * 7;
    const index = (y * 256 + x) * 4;
    pixels.data[index] = base + noise;
    pixels.data[index + 1] = base + noise + (kind === 'floor' ? 3 : 0);
    pixels.data[index + 2] = base + noise + (kind === 'floor' ? 1 : 0);
    pixels.data[index + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === 'floor' ? 28 : 2, kind === 'floor' ? 12 : 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function createFactoryMaterials(): FactoryMaterials {
  const painted = (color: string, roughness = 0.67) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.12 });
  return {
    floor: new THREE.MeshStandardMaterial({ color: '#c2c7c4', map: surfaceTexture('floor'), roughness: 0.78, metalness: 0.04 }),
    white: painted('#e9edeb'),
    steel: new THREE.MeshStandardMaterial({ color: '#b9c1c4', map: surfaceTexture('brushed'), metalness: 0.84, roughness: 0.32 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: '#4c5d63', metalness: 0.72, roughness: 0.48 }),
    orange: painted('#e65f25', 0.55), yellow: painted('#f4c83a'), green: painted('#5b9276', 0.9),
    glass: new THREE.MeshPhysicalMaterial({ color: '#aed1d9', metalness: 0.18, roughness: 0.23, transparent: true, opacity: 0.48, transmission: 0.12 }),
    black: painted('#263035', 0.78), light: new THREE.MeshStandardMaterial({ color: '#f3f6ef', emissive: '#e4efe7', emissiveIntensity: 0.6, roughness: 0.4 }),
    red: painted('#c64339'), blue: painted('#528b9a'),
  };
}
