import * as THREE from 'three';
import { GRID, MAX_X, MAX_Z, TIDE } from '../city/Terrain';
import type { Terrain } from '../city/Terrain';
import type { FloodSimulation } from '../disasters/FloodSimulation';

export class WaterView {
  readonly root = new THREE.Group();
  private depth: THREE.BufferAttribute;
  private readonly material: THREE.ShaderMaterial;
  private readonly sea: THREE.ShaderMaterial;

  constructor(terrain: Terrain) {
    const mesh = terrain.meshData();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(mesh.vertices, 3));
    this.depth = new THREE.BufferAttribute(new Float32Array(terrain.heights.length), 1).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('waterDepth', this.depth);
    geometry.setIndex(new THREE.BufferAttribute(mesh.triangles, 1));
    geometry.computeBoundingSphere();
    geometry.boundingSphere!.radius += 14;
    this.material = waterMaterial(false);
    this.sea = waterMaterial(true);
    const ocean = new THREE.PlaneGeometry(2200, 2200);
    ocean.rotateX(-Math.PI / 2);
    ocean.setAttribute('waterDepth', new THREE.BufferAttribute(new Float32Array(4), 1));
    const shelf = new THREE.Mesh(ocean, this.sea);
    shelf.renderOrder = 1;
    const simulated = new THREE.Mesh(geometry, this.material);
    simulated.renderOrder = 2;
    this.root.add(shelf, simulated);
  }

  apply(flood: FloodSimulation) {
    (this.depth.array as Float32Array).set(flood.depths);
    this.depth.needsUpdate = true;
    this.sea.uniforms.head.value = flood.head;
  }

  frame(time: number, weather: number, fog: THREE.Color, depthLayer: boolean) {
    for (const material of [this.material, this.sea]) {
      material.uniforms.time.value = time;
      material.uniforms.weather.value = weather;
      material.uniforms.fogTint.value.copy(fog);
      material.uniforms.depthLayer.value = depthLayer ? 1 : 0;
    }
  }
}

function waterMaterial(sea: boolean) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3,
    uniforms: {
      time: { value: 0 }, fogTint: { value: new THREE.Color() }, weather: { value: 0 },
      head: { value: TIDE }, farWater: { value: sea ? 1.0 : 0.0 }, depthLayer: { value: 0 },
      rectangle: { value: new THREE.Vector4(GRID.minX, MAX_X, GRID.minZ, MAX_Z) },
    },
    vertexShader: `
      attribute float waterDepth;
      uniform float farWater, time, weather, head;
      varying vec3 vLocal, vWorld;
      varying float vDepth;
      void main() {
        vec3 p = position;
        vDepth = mix(waterDepth, 5.0, farWater);
        p.y += mix(waterDepth, head, farWater);
        float ripple = sin(p.x * 0.4 + p.z * 0.16 + time * 1.55) * 0.047
          + cos(p.z * 0.74 - p.x * 0.21 - time * 2.11) * 0.035;
        p.y += 0.033 + ripple * (1.0 + weather * 2.1) * smoothstep(0.09, 0.7, vDepth);
        vLocal = p;
        vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
      }`,
    fragmentShader: `
      uniform float time, farWater, weather, depthLayer;
      uniform vec3 fogTint;
      uniform vec4 rectangle;
      varying vec3 vLocal, vWorld;
      varying float vDepth;
      void main() {
        bool inside = vLocal.x > rectangle.x && vLocal.x < rectangle.y &&
          vLocal.z > rectangle.z && vLocal.z < rectangle.w;
        if ((farWater > 0.5 && inside) || vDepth < 0.035) discard;
        vec2 p = vLocal.xz;
        float phase = p.x * 0.43 + p.y * 0.15 + time * 1.47;
        float crosswave = p.y * 0.71 - p.x * 0.19 - time * 2.14;
        vec3 normal = normalize(vec3(
          cos(phase) * 0.11 - sin(crosswave) * 0.068, 1.0,
          -cos(phase) * 0.065 + sin(crosswave) * 0.135) * vec3(1.0 + weather, 1.0, 1.0 + weather));
        vec3 eye = normalize(cameraPosition - vWorld);
        float fresnel = pow(1.0 - max(0.0, dot(normal, eye)), 3.6);
        vec3 light = normalize(vec3(-0.64, 0.56, 0.33));
        float sheen = pow(max(0.0, dot(reflect(-light, normal), eye)), 27.0) * (1.0 - weather * 0.6);
        float strands = pow(max(0.0, sin(phase + sin(crosswave * 0.35) * 0.4)), 12.0) * 0.022;
        float bank = (1.0 - smoothstep(0.05, 0.30, vDepth)) * (1.0 - farWater);
        vec3 deep = vec3(0.011, 0.087, 0.084);
        vec3 shallow = vec3(0.027, 0.20, 0.158);
        vec3 tint = mix(deep, shallow, 1.0 - smoothstep(0.12, 3.7, vDepth));
        tint += vec3(0.048, 0.18, 0.15) * fresnel + vec3(0.053, 0.062, 0.046) * sheen;
        tint += vec3(0.6, 1.0, 0.87) * (strands + bank * 0.07);
        vec2 grid = abs(fract(p / 8.0 - 0.5) - 0.5) / max(fwidth(p / 8.0), vec2(0.0001));
        float line = (1.0 - min(min(grid.x, grid.y), 1.0)) * (1.0 - farWater);
        float isoline = 1.0 - smoothstep(0.06, 0.17, abs(fract(vDepth * 2.0) - 0.5));
        vec3 alert = mix(vec3(0.05, 0.60, 0.59), vec3(0.22, 0.19, 0.53), smoothstep(0.4, 4.0, vDepth));
        tint = mix(tint, alert * (0.42 + isoline * 0.20), depthLayer * (1.0 - farWater) * 0.77);
        tint += vec3(0.06, 0.19, 0.15) * line * (0.16 + depthLayer * 0.51);
        float dist = distance(cameraPosition, vWorld);
        tint = mix(tint, fogTint, 1.0 - exp(-dist * dist * 0.0000030));
        gl_FragColor = vec4(tint, mix(0.47, 0.96, smoothstep(0.03, 1.8, vDepth)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
