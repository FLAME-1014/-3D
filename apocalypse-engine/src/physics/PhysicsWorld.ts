import RAPIER from '@dimforge/rapier3d-compat';
import type { City, Building } from '../city/CityData';
import { VIADUCT } from '../city/CityData';
import { clamp, seeded } from '../utils/math';

const GRAVITY = 9.81;
const MAX_DEBRIS = 144;
const DEBRIS_LIFETIME = 39;
type Vector = { x: number; y: number; z: number };
export type DynamicKind = 'debris' | 'crate' | 'container' | 'buoy';
export interface DynamicBody {
  id: number;
  handle: number;
  kind: DynamicKind;
  size: Vector;
  created: number;
}

export interface PhysicsSnapshot {
  bytes: Uint8Array;
  structures: [string, number][];
  dynamics: DynamicBody[];
  nextId: number;
  steps: number;
}

export interface Forcing {
  ground: { x: number; z: number };
  wind: { x: number; z: number };
  depth(x: number, z: number): number;
  level(x: number, z: number): number;
}

let runtime: Promise<void> | undefined;
export const initializeRapier = () => runtime ??= RAPIER.init();

export class PhysicsWorld {
  world: RAPIER.World;
  readonly structures = new Map<string, number>();
  readonly dynamics = new Map<number, DynamicBody>();
  private nextId = 1;
  steps = 0;
  private released = false;

  static async create(city: City, dt: number) {
    await initializeRapier();
    return new PhysicsWorld(city, dt);
  }

  private constructor(readonly city: City, readonly dt: number) {
    this.world = this.makeWorld();
    this.populate();
  }

  get count() { return this.released ? 0 : this.world.bodies.len(); }
  get colliders() { return this.released ? 0 : this.world.colliders.len(); }
  get joints() { return this.released ? 0 : this.world.impulseJoints.len(); }

  private makeWorld() {
    const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
    world.timestep = this.dt;
    world.numSolverIterations = 6;
    world.maxCcdSubsteps = 2;
    return world;
  }

  private populate() {
    const { vertices, triangles } = this.city.terrain.meshData();
    const ground = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, triangles,
      RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setFriction(0.83), ground);
    const staticBox = (x: number, y: number, z: number, width: number, height: number, depth: number) =>
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2)
        .setTranslation(x, y, z).setFriction(0.8), ground);
    for (const bridge of this.city.bridges) {
      staticBox(bridge.x, bridge.elevation - 0.45, bridge.z, bridge.span, 0.9, bridge.width);
    }
    staticBox(VIADUCT.x, VIADUCT.deck - 0.45, (VIADUCT.start + VIADUCT.end) / 2,
      VIADUCT.width, 0.9, VIADUCT.end - VIADUCT.start);
    for (const spec of this.city.buildings) {
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(spec.x, spec.y + spec.height / 2, spec.z));
      const collider = spec.style === 'round'
        ? RAPIER.ColliderDesc.cylinder(spec.height / 2, Math.min(spec.width, spec.depth) / 2)
        : RAPIER.ColliderDesc.cuboid(spec.width * 0.46, spec.height / 2, spec.depth * 0.46);
      this.world.createCollider(collider.setFriction(0.68), body);
      this.structures.set(spec.id, body.handle);
    }
    for (const prop of this.city.props) {
      const size = prop.kind === 'container'
        ? { x: 2.3, y: 1.12, z: 1.17 }
        : { x: prop.size, y: prop.size * 0.8, z: prop.size };
      const entry = this.spawn(prop.kind, { x: prop.x, y: this.city.terrain.height(prop.x, prop.z) + size.y / 2 + 0.07, z: prop.z },
        size, 0, prop.kind === 'container' ? 18 : 8);
      this.body(entry).setRotation({ x: 0, y: Math.sin(prop.yaw / 2), z: 0, w: Math.cos(prop.yaw / 2) }, false);
    }
    const buoy = this.spawn('buoy', { x: 9, y: 1.28, z: 66 }, { x: 1.13, y: 1.25, z: 1.13 }, 0, 2.5);
    const anchor = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(9, -1.35, 65));
    this.world.createImpulseJoint(RAPIER.JointData.rope(6.1,
      { x: 0, y: 0, z: 0 }, { x: 0, y: -0.4, z: 0 }), anchor, this.body(buoy), true);
  }

  private spawn(kind: DynamicKind, point: Vector, size: Vector, created: number, density: number) {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(point.x, point.y, point.z).setCcdEnabled(true)
      .setLinearDamping(kind === 'debris' ? 0.13 : 0.29).setAngularDamping(0.34));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
      .setDensity(density).setFriction(0.66).setRestitution(kind === 'debris' ? 0.19 : 0.22), body);
    const entry = { id: this.nextId++, handle: body.handle, created, size, kind };
    this.dynamics.set(entry.id, entry);
    return entry;
  }

  body(entry: DynamicBody) { return this.world.getRigidBody(entry.handle); }

  collapse(spec: Building, age: number, dx: number, dz: number) {
    const handle = this.structures.get(spec.id);
    if (handle === undefined) return;
    this.world.removeRigidBody(this.world.getRigidBody(handle));
    this.structures.delete(spec.id);
    const debris = Array.from(this.dynamics.values()).filter(item => item.kind === 'debris');
    const tiers = spec.height >= 29 ? 3 : 2;
    const count = tiers * 4;
    for (const item of debris.slice(0, Math.max(0, debris.length + count - MAX_DEBRIS))) this.removeDynamic(item.id);
    const random = seeded(this.city.seed + Number(spec.id.slice(2)) * 369);
    for (let row = 0; row < tiers; row++) {
      for (const xx of [-1, 1]) {
        for (const zz of [-1, 1]) {
          const size = { x: spec.width * (0.28 + random() * 0.12), y: Math.min(7.8, spec.height / tiers * (0.34 + random() * 0.17)),
            z: spec.depth * (0.29 + random() * 0.10) };
          const entry = this.spawn('debris', {
            x: spec.x + xx * spec.width * 0.227 + dx * row,
            y: spec.y + (row + 0.52) * spec.height / tiers,
            z: spec.z + zz * spec.depth * 0.227 + dz * row,
          }, size, age, 95 + random() * 75);
          const body = this.body(entry);
          body.setLinvel({ x: dx * 5 + xx * random() * 1.9, y: -0.4 - random() * 2.8, z: dz * 5 + zz * random() * 1.9 }, true);
          body.setAngvel({ x: (random() - 0.5) * 1.6, y: (random() - 0.5) * 1.2, z: (random() - 0.5) * 1.6 }, true);
        }
      }
    }
  }

  removeDynamic(id: number) {
    const entry = this.dynamics.get(id);
    if (!entry) return;
    this.world.removeRigidBody(this.body(entry));
    this.dynamics.delete(id);
  }

  step(time: number, forcing: Forcing) {
    const { ground, wind } = forcing;
    for (const entry of this.dynamics.values()) {
      const body = this.body(entry);
      const p = body.translation();
      if (entry.kind === 'debris' ? time - entry.created > DEBRIS_LIFETIME || p.y < -13 :
        Math.abs(p.x) > 115 || p.z > 104 || p.z < -101 || p.y < -13) {
        this.removeDynamic(entry.id);
        continue;
      }
      const velocity = body.linvel();
      const mass = body.mass();
      const air = entry.kind === 'debris' ? 0.00027 : entry.kind === 'container' ? 0.0087 : 0.027;
      const windX = wind.x - velocity.x;
      const windZ = wind.z - velocity.z;
      const windActive = Math.hypot(wind.x, wind.z) > 0.05;
      const water = forcing.depth(p.x, p.z) > 0.04
        ? clamp((forcing.level(p.x, p.z) - p.y + entry.size.y / 2) / entry.size.y, 0, 1)
        : 0;
      const ax = (windActive ? air * windX * Math.abs(windX) : 0) + ground.x - velocity.x * water * 1.65;
      const az = (windActive ? air * windZ * Math.abs(windZ) : 0) + ground.z - velocity.z * water * 1.65;
      const lift = GRAVITY * water * (entry.kind === 'debris' ? 0.36 : entry.kind === 'buoy' ? 2.3 : 1.48) - velocity.y * water * 2.6;
      body.resetForces(false);
      if (Math.abs(ax) + Math.abs(az) + Math.abs(lift) > 0.04) {
        body.addForce({ x: mass * ax, y: mass * lift, z: mass * az }, true);
      }
    }
    this.world.step();
    this.steps++;
  }

  checkpoint(): PhysicsSnapshot {
    return {
      bytes: this.world.takeSnapshot(), structures: Array.from(this.structures), nextId: this.nextId,
      dynamics: Array.from(this.dynamics.values(), item => ({ ...item, size: { ...item.size } })), steps: this.steps,
    };
  }

  restore(saved: PhysicsSnapshot) {
    const restored = RAPIER.World.restoreSnapshot(saved.bytes);
    this.world.free();
    this.world = restored;
    this.structures.clear();
    this.dynamics.clear();
    for (const [id, handle] of saved.structures) this.structures.set(id, handle);
    for (const item of saved.dynamics) this.dynamics.set(item.id, { ...item, size: { ...item.size } });
    this.nextId = saved.nextId;
    this.steps = saved.steps;
  }

  reset() {
    this.world.free();
    this.world = this.makeWorld();
    this.structures.clear();
    this.dynamics.clear();
    this.nextId = 1;
    this.steps = 0;
    this.populate();
  }

  dispose() {
    if (this.released) return;
    this.released = true;
    this.world.free();
    this.structures.clear();
    this.dynamics.clear();
  }
}
