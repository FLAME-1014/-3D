import * as THREE from 'three';
import { clamp, mix, seeded } from '../utils/math';

export type Daylight = 'dusk' | 'day' | 'night';
export type Quality = 'low' | 'medium' | 'high';
export type QualityMode = Quality | 'auto';

const skyFields = {
  dusk: { horizon: '#8c9a8a', zenith: '#283f44', fog: '#536e69', sun: '#ffe0ad', strength: 2.6, ambient: 1.75, exposure: 1.25 },
  day: { horizon: '#bfd1ca', zenith: '#476a89', fog: '#8ba6a6', sun: '#fff0da', strength: 3.1, ambient: 2, exposure: 1.26 },
  night: { horizon: '#3a555b', zenith: '#131b2a', fog: '#294447', sun: '#b5cff2', strength: 1.05, ambient: 0.73, exposure: 0.97 },
};
const stormFog = new THREE.Color('#435963');

export class EnvironmentView {
  readonly fog = new THREE.FogExp2('#536e69', 0.00178);
  readonly sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  readonly sun = new THREE.DirectionalLight(0xffd4a0, 2.6);
  readonly ambient = new THREE.HemisphereLight(0xc2dcda, 0x5d5349, 1.7);
  readonly rain: THREE.LineSegments<THREE.BufferGeometry, THREE.ShaderMaterial>;
  daylight: Daylight = 'dusk';
  quality: Quality = 'medium';
  weather = 0;
  exposure = 1.25;
  private readonly skyLight = new THREE.Color();

  constructor(scene: THREE.Scene, seed: number) {
    scene.fog = this.fog;
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 12),
      new THREE.ShaderMaterial({
        depthWrite: false, side: THREE.BackSide,
        uniforms: {
          horizon: { value: new THREE.Color() }, zenith: { value: new THREE.Color() },
          time: { value: 0 }, cloud: { value: 0 }, night: { value: 0 }, complexity: { value: 1 },
        },
        vertexShader: `varying vec3 ray;
          void main() { ray = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          varying vec3 ray;
          uniform vec3 horizon, zenith;
          uniform float time, cloud, night, complexity;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float noise(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            f = f*f*(3.0-2.0*f);
            return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
              mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
          }
          void main() {
            vec3 n = normalize(ray);
            float height = max(n.y, 0.0);
            vec3 base = mix(horizon, zenith, smoothstep(0.0, 0.75, height));
            vec2 drift = n.xz / (height + 0.32) * 4.9 + vec2(time * 0.008, time * 0.005);
            float shape = noise(drift) * 0.58 + noise(drift * 2.14 + 3.1) * 0.30;
            if (complexity > 0.0) shape += noise(drift * 5.3 + 9.4) * 0.12;
            float cover = smoothstep(0.48 - cloud * 0.22, 0.84, shape) * smoothstep(0.0, 0.12, height);
            vec3 cloudTint = mix(vec3(0.49, 0.49, 0.37), vec3(0.085, 0.127, 0.14), 0.35 + cloud * 0.65);
            float light = pow(max(dot(n, normalize(vec3(-0.64,0.38,0.2))), 0.0), 30.0);
            base = mix(base, cloudTint * (1.0 - night * 0.75), cover * 0.71);
            base += vec3(0.37, 0.19, 0.076) * light * ((1.0 - night) * (1.0 - cloud));
            gl_FragColor = vec4(base, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }));
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.sun.position.set(-115, 145, 108);
    this.sun.castShadow = true;
    this.sun.shadow.camera.left = -135;
    this.sun.shadow.camera.right = 135;
    this.sun.shadow.camera.bottom = -110;
    this.sun.shadow.camera.top = 125;
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 365;
    this.sun.shadow.normalBias = 0.22;
    this.sun.shadow.bias = -0.00011;
    this.sun.shadow.radius = 2.3;
    this.sun.shadow.intensity = 0.77;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.target.position.set(0, 0, -12);
    this.rain = rain(seed);
    scene.add(this.sky, this.sun, this.sun.target, this.ambient, this.rain);
  }

  setQuality(quality: Quality) {
    this.quality = quality;
    const size = quality === 'high' ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
      this.sun.shadow.needsUpdate = true;
    }
    this.sun.castShadow = quality !== 'low';
  }

  frame(camera: THREE.PerspectiveCamera, time: number, rainRate: number, wind: { x: number; z: number; speed: number }, depthMode: boolean) {
    const preset = skyFields[this.daylight];
    const lightPositions: Record<Daylight, [number, number, number]> = {
      dusk: [-115, 145, 108], day: [-84, 225, 43], night: [122, 116, -89],
    };
    this.weather = clamp(rainRate / 220 + wind.speed / 220, 0, 1);
    this.exposure = preset.exposure;
    this.sun.position.set(...lightPositions[this.daylight]);
    this.fog.color.set(preset.fog).lerp(stormFog, this.weather * 0.72);
    this.fog.density = 0.00178 + this.weather * 0.0019;
    this.sun.color.set(preset.sun);
    this.sun.intensity = preset.strength * (1 - this.weather * 0.7);
    this.ambient.intensity = preset.ambient * (1 - this.weather * 0.26);
    this.sky.position.copy(camera.position);
    const skyUniforms = this.sky.material.uniforms;
    skyUniforms.horizon.value.set(preset.horizon).lerp(stormFog, this.weather * 0.56);
    skyUniforms.zenith.value.set(preset.zenith).lerp(this.skyLight.set('#33434b'), this.weather * 0.73);
    skyUniforms.time.value = time;
    skyUniforms.cloud.value = this.weather;
    skyUniforms.night.value = this.daylight === 'night' ? 1 : 0;
    skyUniforms.complexity.value = this.quality === 'low' ? 0 : 1;
    const rainUniforms = this.rain.material.uniforms;
    this.rain.visible = rainRate > 0 && !depthMode;
    rainUniforms.time.value = time;
    rainUniforms.air.value.set(wind.x * 0.37, wind.z * 0.37);
    rainUniforms.alpha.value = mix(0.09, 0.34, clamp(rainRate / 250, 0, 1));
    const budget = this.quality === 'high' ? 2000 : this.quality === 'medium' ? 1120 : 500;
    this.rain.geometry.setDrawRange(0, Math.floor(budget * clamp(rainRate / 120, 0.15, 1)) * 2);
  }
}

function rain(seed: number) {
  const random = seeded(seed ^ 438524);
  const geometry = new THREE.BufferGeometry();
  const points = new Float32Array(2000 * 6);
  const tails = new Float32Array(2000 * 2);
  for (let drop = 0; drop < 2000; drop++) {
    const point = [random(), random(), random()];
    points.set(point, drop * 6);
    points.set(point, drop * 6 + 3);
    tails[drop * 2 + 1] = 1;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
  geometry.setAttribute('tail', new THREE.BufferAttribute(tails, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { time: { value: 0 }, air: { value: new THREE.Vector2() }, alpha: { value: 0 } },
    vertexShader: `
      attribute float tail;
      uniform float time;
      uniform vec2 air;
      varying float fade;
      void main() {
        float factor = 1.0 + position.z * 0.45;
        vec2 xz = (fract(position.xz + (air + vec2(0.7, 0.35)) * time / 280.0) - 0.5) * 280.0;
        float y = fract(position.y - time * 0.59 * factor) * 90.0;
        vec3 pos = vec3(xz.x - tail * air.x * 0.085, y + tail * factor * 3.1, xz.y - tail * air.y * 0.085);
        fade = smoothstep(0.0, 12.0, y) * smoothstep(0.0, 10.0, 90.0-y) * (1.0-tail*0.84);
        gl_Position = projectionMatrix * viewMatrix * vec4(pos,1.0);
      }`,
    fragmentShader: `uniform float alpha; varying float fade;
      void main() { gl_FragColor = vec4(0.71,0.84,0.90,alpha*fade); }`,
  });
  const mesh = new THREE.LineSegments(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 8;
  mesh.visible = false;
  return mesh;
}
