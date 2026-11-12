import * as THREE from 'three';

const TAU = Math.PI * 2;

/**
 * An illustrative educational high-bypass turbofan.
 * Dimensions are model units; this is a procedural study, not manufacturer CAD.
 * All functional modules retain their own local coordinate systems.
 */
export function createEngineModel() {
  const root = new THREE.Group();
  root.name = 'AXIAL / Turbofan study';
  const parts = new Map();
  const features = new Map();
  const rotors = [];
  const removableShells = [];
  const casingGroups = [];
  const batches = new Map();
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  let running = false;
  let rotorSpeed = 0;
  let disposed = false;

  // These are authored procedural finishes, not scans of a particular engine.
  const finishes = new Map(['steel', 'titanium', 'hot'].map(family => {
    const finish = makeSurfaceTextures(family);
    Object.values(finish).forEach(texture => textures.add(texture));
    return [family, finish];
  }));

  function metal(color, roughness = 0.3, options = {}) {
    const { surface = 'steel', ...shaderOptions } = options;
    const finish = finishes.get(surface);
    const material = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.93,
      roughness,
      map: finish.color,
      roughnessMap: finish.roughness,
      bumpMap: finish.height,
      bumpScale: surface === 'hot' ? 0.006 : surface === 'titanium' ? 0.0022 : 0.0033,
      envMapIntensity: 1.15,
      ...shaderOptions,
    });
    material.userData.surfaceFamily = surface;
    material.userData.proceduralFinish = true;
    materials.add(material);
    return material;
  }

  const silver = metal('#c6cdd4', 0.29);
  const polished = metal('#dce4ec', 0.21);
  const titanium = metal('#8f9ca8', 0.34, { surface: 'titanium' });
  const darkMetal = metal('#38444d', 0.36);
  const graphite = metal('#252e36', 0.4);
  const bronze = metal('#ab8256', 0.36, { surface: 'hot' });
  const warmSteel = metal('#b7a28c', 0.31, { surface: 'hot' });
  const copper = metal('#b07847', 0.3, { surface: 'titanium' });
  const black = metal('#131b22', 0.64, { metalness: 0.48 });
  const teal = metal('#467b85', 0.36, { metalness: 0.75 });
  const linerMetal = metal('#8f795e', 0.49, { side: THREE.DoubleSide, surface: 'hot' });
  const shellMetal = metal('#69747d', 0.32, { side: THREE.DoubleSide });
  const innerShellMetal = metal('#424e58', 0.42, { side: THREE.DoubleSide });

  function part(id, x, explodeX, explodeY = 0, explodeZ = 0) {
    const group = new THREE.Group();
    group.name = id;
    group.position.x = x;
    group.userData = {
      partId: id,
      assembled: new THREE.Vector3(x, 0, 0),
      explosion: new THREE.Vector3(explodeX, explodeY, explodeZ),
    };
    root.add(group);
    parts.set(id, group);
    return group;
  }

  function subgroup(parent, name) {
    const group = new THREE.Group();
    group.name = name;
    group.userData.partId = parent.userData.partId;
    parent.add(group);
    return group;
  }

  function add(parent, geometry, material, x = 0, y = 0, z = 0, rotation) {
    if (rotation) geometry.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(rotation));
    if (x || y || z) geometry.translate(x, y, z);
    if (!batches.has(parent)) batches.set(parent, new Map());
    const byMaterial = batches.get(parent);
    if (!byMaterial.has(material)) byMaterial.set(material, []);
    byMaterial.get(material).push(geometry);
  }

  function instance(parent, geometry, material, matrices, name = '') {
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    mesh.name = name;
    mesh.userData.partId = parent.userData.partId;
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    geometries.add(geometry);
    return mesh;
  }

  function directMesh(parent, geometry, material, name = '', featureId) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.userData.partId = parent.userData.partId;
    if (featureId) mesh.userData.featureId = featureId;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    geometries.add(geometry);
    return mesh;
  }

  function feature(id, parentPart, mesh, anchor) {
    mesh.userData.featureId = id;
    features.set(id, { id, parentPart, mesh, anchor: new THREE.Vector3(...anchor) });
    return mesh;
  }

  // Each section stays attached to its module during a guided disassembly.
  // The HP outer tube is sectioned without rotating its inspection window;
  // its rotationally symmetric wall and the rotating discs share the same axis.
  function shaftSection(parent, front, rear, radius, material, innerRadius = 0) {
    const profile = [[front, radius], [rear, radius]];
    if (innerRadius > 0) {
      const fixed = subgroup(parent, 'HP concentric outer shaft / inspection section');
      const removable = subgroup(parent, 'HP shaft inspection cover');
      directMesh(fixed, shellGeometry(profile, Math.PI + 0.18, TAU + 0.19, 36, radius - innerRadius), material, 'High-pressure hollow shaft', 'drive-shafts');
      directMesh(removable, shellGeometry(profile, 0.19, Math.PI + 0.18, 36, radius - innerRadius), material, 'High-pressure shaft inspection sector', 'drive-shafts');
      removable.visible = false;
      removableShells.push(removable);
      return fixed.children[0];
    }
    const geometry = new THREE.CylinderGeometry(radius, radius, rear - front, 32);
    geometry.rotateZ(-Math.PI / 2);
    geometry.translate((front + rear) / 2, 0, 0);
    return directMesh(parent, geometry, material, 'Low-pressure through shaft', 'drive-shafts');
  }

  function cylinder(parent, frontRadius, rearRadius, length, x, material, radialSegments = 48) {
    const geometry = new THREE.CylinderGeometry(
      rearRadius, frontRadius, length, radialSegments, 1, false,
    );
    geometry.rotateZ(-Math.PI / 2);
    add(parent, geometry, material, x);
  }

  function ring(parent, radius, thickness, x, material, segments = 80) {
    const geometry = new THREE.TorusGeometry(radius, thickness, 7, segments);
    geometry.rotateY(Math.PI / 2);
    add(parent, geometry, material, x);
  }

  function sleeve(parent, frontX, rearX, frontRadius, rearRadius, material, thickness = 0.025) {
    add(parent, shellGeometry(
      [[frontX, frontRadius], [rearX, rearRadius]],
      0, TAU, 80, thickness,
    ), material);
  }

  function boltRing(parent, x, radius, count, size = 0.036, material = polished, offset = 0) {
    const geometry = new THREE.CylinderGeometry(size, size, size * 0.75, 6);
    geometry.rotateZ(-Math.PI / 2);
    const matrices = [];
    for (let i = 0; i < count; i++) {
      const theta = i / count * TAU + offset;
      matrices.push(new THREE.Matrix4().makeTranslation(x, Math.cos(theta) * radius, Math.sin(theta) * radius));
    }
    instance(parent, geometry, material, matrices, 'Captive hex fasteners');
  }

  function radialBoxes(parent, x, radius, count, size, material, offset = 0) {
    const geometry = new THREE.BoxGeometry(...size);
    const matrices = [];
    for (let i = 0; i < count; i++) {
      const theta = i / count * TAU + offset;
      const matrix = new THREE.Matrix4().makeRotationX(theta);
      matrix.setPosition(x, radius * Math.cos(theta), radius * Math.sin(theta));
      matrices.push(matrix);
    }
    instance(parent, geometry, material, matrices);
  }

  function tube(parent, points, radius, material, segments = 30, featureId) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal');
    const geometry = new THREE.TubeGeometry(curve, segments, radius, 6, false);
    if (featureId) return directMesh(parent, geometry, material, 'Routed lubrication service line', featureId);
    add(parent, geometry, material);
  }

  function casing(parent, profile, material, thickness = 0.035) {
    const fixed = subgroup(parent, 'Sectioned outer case');
    const removable = subgroup(parent, 'Removable inspection sector');
    const start = 0.19;
    const end = Math.PI + 0.18;
    add(fixed, shellGeometry(profile, end, TAU + start, 66, thickness), material);
    add(removable, shellGeometry(profile, start, end, 66, thickness), material);
    removable.visible = false;
    removableShells.push(removable);
    casingGroups.push(fixed);
    return { fixed, removable };
  }

  function rotor(parent, name, speed = 1) {
    const group = subgroup(parent, name);
    group.userData.speed = speed;
    rotors.push(group);
    return group;
  }

  function bladeRing(parent, x, count, options, material, offset = 0) {
    const geometry = bladeGeometry(options);
    geometry.computeBoundingBox();
    const matrices = [];
    for (let i = 0; i < count; i++) {
      const matrix = new THREE.Matrix4().makeRotationX(i / count * TAU + offset);
      matrix.setPosition(x, 0, 0);
      matrices.push(matrix);
    }
    const mesh = instance(parent, geometry, material, matrices, 'Swept airfoil array');
    mesh.userData.axialInterval = [x + geometry.boundingBox.min.x, x + geometry.boundingBox.max.x];
    return mesh;
  }

  const fan = part('fan', -3.2, -3.45);
  const compressor = part('compressor', -1.36, -1.52);
  const combustor = part('combustor', 0.79, 0.2);
  const turbine = part('turbine', 2.14, 1.7);
  const nozzle = part('nozzle', 3.62, 3.35);
  const accessories = part('accessories', -0.12, 0.12, -1.55, 0.75);

  // Fan: a rolled intake lip, broad twisted titanium airfoils, and spinner.
  const fanRotor = rotor(fan, 'Fan and low-pressure shaft', 0.73);
  const fanBlades = bladeRing(fanRotor, -0.53, 26, {
    rootRadius: 0.49, tipRadius: 1.9,
    rootChord: 0.36, tipChord: 0.57,
    rootPitch: 0.96, tipPitch: 0.39,
    sweep: 0.31, axialSweep: 0.17, thickness: 0.027,
    spanSteps: 16, chordSteps: 7,
  }, polished);
  feature('fan-blade', 'fan', fanBlades, [-0.46, 1.34, 0.94]);
  shaftSection(fanRotor, -0.45, 0.65, 0.105, titanium);
  add(fanRotor, latheX([
    [-1.38, 0.015], [-1.32, 0.075], [-1.17, 0.19],
    [-0.95, 0.32], [-0.69, 0.435], [-0.46, 0.5], [-0.24, 0.51],
  ], 80), titanium);
  ring(fanRotor, 0.495, 0.022, -0.43, polished, 64);
  cylinder(fanRotor, 0.5, 0.58, 0.44, -0.06, darkMetal);
  boltRing(fanRotor, -0.31, 0.437, 12, 0.021);
  sleeve(fan, -0.93, -0.68, 1.975, 1.978, silver, 0.06);
  ring(fan, 1.974, 0.066, -0.94, polished, 112);
  ring(fan, 1.985, 0.023, -0.69, darkMetal, 112);
  ring(fan, 2.008, 0.015, -0.82, titanium, 112);
  boltRing(fan, -0.71, 1.976, 42, 0.022, darkMetal);
  casing(fan, [
    [-0.68, 1.985], [-0.38, 2.0], [0.1, 1.99], [0.53, 1.84], [0.91, 1.63],
  ], innerShellMetal, 0.045);
  sleeve(fan, 0.78, 0.92, 1.64, 1.63, titanium, 0.045);
  ring(fan, 1.647, 0.037, 0.77, silver);
  boltRing(fan, 0.94, 1.596, 32, 0.028);
  bladeRing(fan, 0.34, 34, {
    rootRadius: 0.64, tipRadius: 1.83,
    rootChord: 0.2, tipChord: 0.24,
    rootPitch: -0.4, tipPitch: -0.22,
    sweep: -0.08, axialSweep: 0.01, thickness: 0.014,
    spanSteps: 7, chordSteps: 4,
  }, titanium, 0.07);
  cylinder(fan, 0.56, 0.65, 0.62, 0.45, graphite);
  radialBoxes(fan, 0.79, 1.39, 8, [0.21, 0.48, 0.065], darkMetal, Math.PI / 8);
  for (let i = 0; i < 8; i++) {
    const angle = Math.PI + i / 7 * Math.PI;
    tube(fan, [
      [-0.62, 2.01 * Math.cos(angle), 2.01 * Math.sin(angle)],
      [0.09, 2.015 * Math.cos(angle), 2.015 * Math.sin(angle)],
      [0.77, 1.69 * Math.cos(angle), 1.69 * Math.sin(angle)],
    ], 0.024, darkMetal, 13);
  }
  // The splitter nose separates the core entrance from the short outer duct.
  const splitter = casing(fan, [[0.43, 1.4], [0.62, 1.365], [0.96, 1.38]], titanium, 0.025);
  splitter.fixed.name = 'Core / bypass splitter';
  splitter.removable.name = 'Splitter inspection sector';
  ring(fan, 1.397, 0.019, 0.435, polished);

  // GE's public CF6–80C2 comparison lists four LP and fourteen HP stages.
  // Individual blade counts, airfoils and axial spacing remain illustrative.
  const lowPressureCompressorRotor = rotor(compressor, 'Four-stage low-pressure compressor', 0.73);
  const highPressureCompressorRotor = rotor(compressor, 'Fourteen-stage high-pressure compressor', 1.45);
  sleeve(lowPressureCompressorRotor, -1.3, -0.32, 0.48, 0.55, darkMetal, 0.032);
  sleeve(highPressureCompressorRotor, -0.3, 1.3, 0.55, 0.675, darkMetal, 0.035);
  shaftSection(lowPressureCompressorRotor, -1.19, 1.41, 0.105, titanium);
  shaftSection(compressor, -0.36, 1.41, 0.215, warmSteel, 0.147);
  ring(lowPressureCompressorRotor, 0.12, 0.014, -1.13, teal, 40);
  ring(highPressureCompressorRotor, 0.23, 0.015, 1.27, bronze, 40);
  const compressorStagePositions = [
    -1.16, -0.91, -0.66, -0.41,
    ...Array.from({ length: 14 }, (_, index) => -0.245 + index * 0.11),
  ];
  for (let stage = 0; stage < compressorStagePositions.length; stage++) {
    const lowPressure = stage < 4;
    const compressorRotor = lowPressure ? lowPressureCompressorRotor : highPressureCompressorRotor;
    const x = compressorStagePositions[stage];
    const t = (x + 1.16) / 2.345;
    const inner = 0.485 + t * 0.174;
    const outer = 1.29 - t * 0.245;
    const blades = bladeRing(compressorRotor, x, 38 + stage * 2, {
      rootRadius: inner, tipRadius: outer,
      rootChord: lowPressure ? 0.105 : 0.055,
      tipChord: lowPressure ? 0.135 : 0.068 - t * 0.008,
      rootPitch: 0.83, tipPitch: 0.43,
      sweep: lowPressure ? 0.085 : 0.06,
      axialSweep: lowPressure ? 0.009 : 0.004,
      thickness: lowPressure ? 0.01 : 0.006,
      spanSteps: lowPressure ? 6 : 4, chordSteps: 3,
    }, stage < 4 ? silver : warmSteel, stage * 0.08);
    blades.userData.axialAssembly = 'compressor';
    blades.userData.bladeRow = { kind: 'rotor', stage: stage + 1, spool: lowPressure ? 'LP' : 'HP' };
    if (stage === 4) feature('compressor-rotor', 'compressor', blades, [x, 0.81, 0.67]);
    const halfHubWidth = lowPressure ? 0.046 : 0.028;
    sleeve(compressorRotor, x - halfHubWidth, x + halfHubWidth, inner + 0.018, inner + 0.026, titanium, 0.02);
    // Annular wheel webs terminate at the appropriate concentric shaft.
    const halfWebWidth = lowPressure ? 0.017 : 0.012;
    sleeve(compressorRotor, x - halfWebWidth, x + halfWebWidth, inner, inner, darkMetal, inner - (lowPressure ? 0.105 : 0.215));
    ring(compressor, outer + 0.025, lowPressure ? 0.016 : 0.01, x, titanium, 64);
    if (stage < compressorStagePositions.length - 1) {
      const stator = bladeRing(compressor, (x + compressorStagePositions[stage + 1]) / 2, 42 + stage * 2, {
        rootRadius: inner + 0.05, tipRadius: outer - 0.015,
        rootChord: lowPressure ? 0.058 : 0.04,
        tipChord: lowPressure ? 0.075 : 0.052,
        rootPitch: -0.63, tipPitch: -0.42,
        sweep: -0.035, axialSweep: lowPressure ? 0.006 : 0.003,
        thickness: lowPressure ? 0.007 : 0.005,
        spanSteps: lowPressure ? 4 : 3, chordSteps: 3,
      }, titanium, 0.035);
      stator.userData.axialAssembly = 'compressor';
      stator.userData.bladeRow = { kind: 'stator', afterStage: stage + 1 };
    }
  }
  casing(compressor, [
    [-1.36, 1.39], [-1.12, 1.365], [-0.45, 1.29], [0.38, 1.18], [1.29, 1.112],
  ], shellMetal);
  sleeve(compressor, -1.39, -1.25, 1.39, 1.383, silver, 0.055);
  sleeve(compressor, 1.18, 1.33, 1.117, 1.116, silver, 0.055);
  ring(compressor, 1.4, 0.028, -1.32, polished);
  ring(compressor, 1.128, 0.032, 1.27, polished);
  boltRing(compressor, -1.403, 1.355, 36, 0.029);
  boltRing(compressor, 1.345, 1.082, 30, 0.027);
  for (let i = 0; i < 7; i++) {
    const angle = 3.45 + i * 0.4;
    tube(compressor, [
      [-1.25, 1.402 * Math.cos(angle), 1.402 * Math.sin(angle)],
      [-0.15, 1.278 * Math.cos(angle), 1.278 * Math.sin(angle)],
      [1.22, 1.143 * Math.cos(angle), 1.143 * Math.sin(angle)],
    ], 0.024, darkMetal, 16);
  }
  ring(compressor, 1.258, 0.021, -0.1, darkMetal);
  const bypassDuct = casing(compressor, [
    [-0.92, 1.63], [-0.56, 1.65], [0.26, 1.625], [0.95, 1.55],
  ], innerShellMetal, 0.026);
  bypassDuct.fixed.name = 'Short bypass duct / sectioned outer wall';
  bypassDuct.removable.name = 'Bypass inspection sector';
  ring(compressor, 1.55, 0.023, 0.95, titanium);
  ring(compressor, 1.57, 0.012, 0.87, darkMetal);
  radialBoxes(compressor, 0.72, 1.385, 8, [0.16, 0.32, 0.028], titanium, 0.12);

  // A single annular combustion cavity bounded by continuous inner/outer liners.
  const lowPressureShaftRotor = rotor(combustor, 'LP shaft crossing the combustion section', 0.73);
  const lowPressureShaft = shaftSection(lowPressureShaftRotor, -0.74, 0.76, 0.105, titanium);
  shaftSection(combustor, -0.74, 0.76, 0.215, warmSteel, 0.147);
  feature('drive-shafts', 'combustor', lowPressureShaft, [0.15, 0.035, 0.13]);
  ring(lowPressureShaftRotor, 0.119, 0.013, -0.55, teal, 40);
  ring(lowPressureShaftRotor, 0.119, 0.013, 0.56, teal, 40);
  ring(combustor, 0.278, 0.042, -0.66, titanium, 48);
  ring(combustor, 0.278, 0.042, 0.65, titanium, 48);
  const combustorProfile = [[-0.73, 1.11], [-0.53, 1.16], [0.45, 1.14], [0.75, 1.055]];
  casing(combustor, combustorProfile, warmSteel, 0.035);
  const innerLiner = casing(combustor, [[-0.61, 0.72], [0.58, 0.74]], linerMetal, 0.025);
  innerLiner.fixed.name = 'Annular inner liner / shaft inspection section';
  innerLiner.removable.name = 'Inner liner inspection sector';
  const annularLiner = casing(combustor, [
    [-0.58, 1.025], [-0.35, 1.036], [0.3, 1.026], [0.58, 1.013],
  ], linerMetal, 0.022);
  annularLiner.fixed.name = 'Continuous annular outer combustion liner';
  annularLiner.removable.name = 'Annular liner inspection sector';
  sleeve(combustor, -0.76, -0.62, 1.113, 1.114, titanium, 0.045);
  sleeve(combustor, 0.64, 0.76, 1.064, 1.057, silver, 0.045);
  ring(combustor, 1.13, 0.038, -0.66, bronze);
  ring(combustor, 1.078, 0.035, 0.68, bronze);
  boltRing(combustor, -0.775, 1.076, 30, 0.028);
  boltRing(combustor, 0.78, 1.022, 28, 0.027);

  const swirlCupMatrices = [];
  const injectorMatrices = [];
  for (let i = 0; i < 14; i++) {
    const theta = i / 14 * TAU;
    const matrix = new THREE.Matrix4().makeTranslation(-0.49, Math.cos(theta) * 0.9, Math.sin(theta) * 0.9);
    swirlCupMatrices.push(matrix);
    injectorMatrices.push(new THREE.Matrix4().makeTranslation(-0.57, Math.cos(theta) * 0.9, Math.sin(theta) * 0.9));
    tube(combustor, [
      [-0.59, 1.12 * Math.cos(theta), 1.12 * Math.sin(theta)],
      [-0.5, 1.16 * Math.cos(theta), 1.16 * Math.sin(theta)],
      [-0.42, 0.99 * Math.cos(theta), 0.99 * Math.sin(theta)],
      [-0.32, 0.93 * Math.cos(theta), 0.93 * Math.sin(theta)],
    ], 0.022, copper, 10);
  }
  const swirlCupGeometry = new THREE.CylinderGeometry(0.092, 0.119, 0.15, 14, 1, true);
  swirlCupGeometry.rotateZ(-Math.PI / 2);
  const swirlCups = instance(combustor, swirlCupGeometry, bronze, swirlCupMatrices, 'Fourteen illustrative injector swirl cups');
  swirlCups.userData.featureId = 'fuel-injector';
  const injectorGeometry = new THREE.TorusGeometry(0.103, 0.027, 6, 14);
  injectorGeometry.rotateY(Math.PI / 2);
  const injectors = instance(combustor, injectorGeometry, copper, injectorMatrices, 'Fuel injectors');
  feature('fuel-injector', 'combustor', injectors, [-0.57, 0.7, 0.56]);
  ring(combustor, 1.127, 0.024, -0.5, copper);
  ring(combustor, 0.747, 0.023, -0.42, warmSteel);
  ring(combustor, 0.757, 0.019, 0.22, warmSteel);
  ring(combustor, 0.76, 0.022, 0.51, copper);
  ring(combustor, 1.029, 0.019, -0.53, bronze);
  ring(combustor, 1.037, 0.013, -0.29, warmSteel);
  ring(combustor, 1.031, 0.011, 0.12, warmSteel);
  ring(combustor, 1.02, 0.014, 0.47, bronze);

  const innerLinerFixedApertures = [];
  const innerLinerRemovableApertures = [];
  const holeGeometry = new THREE.CircleGeometry(0.024, 7);
  const normal = new THREE.Vector3(0, 0, 1);
  for (let row = 0; row < 7; row++) {
    for (let i = 0; i < 42; i++) {
      const theta = (i + (row % 2) * 0.5) / 42 * TAU;
      const radius = 0.726 + row * 0.0027;
      const rotation = new THREE.Quaternion().setFromUnitVectors(normal, new THREE.Vector3(0, Math.cos(theta), Math.sin(theta)));
      const matrices = theta >= 0.19 && theta <= Math.PI + 0.18
        ? innerLinerRemovableApertures : innerLinerFixedApertures;
      matrices.push(new THREE.Matrix4().compose(
        new THREE.Vector3(-0.48 + row * 0.151, radius * Math.cos(theta), radius * Math.sin(theta)),
        rotation, new THREE.Vector3(1, 1, 1),
      ));
    }
  }
  instance(innerLiner.fixed, holeGeometry, black, innerLinerFixedApertures, 'Inner liner cooling apertures');
  instance(innerLiner.removable, holeGeometry, black, innerLinerRemovableApertures, 'Inner liner cooling apertures');
  const outerLinerFixedApertures = [];
  const outerLinerRemovableApertures = [];
  for (let row = 0; row < 7; row++) {
    const x = -0.42 + row * 0.143;
    const outerRadius = x < -0.35
      ? THREE.MathUtils.lerp(1.025, 1.036, (x + 0.58) / 0.23)
      : x < 0.3
        ? THREE.MathUtils.lerp(1.036, 1.026, (x + 0.35) / 0.65)
        : THREE.MathUtils.lerp(1.026, 1.013, (x - 0.3) / 0.28);
    for (let i = 0; i < 48; i++) {
      const theta = (i + (row % 2) * 0.5) / 48 * TAU;
      const matrices = theta >= 0.19 && theta <= Math.PI + 0.18
        ? outerLinerRemovableApertures : outerLinerFixedApertures;
      for (const face of [1, -1]) {
        const radius = face === 1 ? outerRadius + 0.0018 : outerRadius - 0.0238;
        const outward = new THREE.Vector3(0, Math.cos(theta) * face, Math.sin(theta) * face);
        matrices.push(new THREE.Matrix4().compose(
          new THREE.Vector3(x, radius * Math.cos(theta), radius * Math.sin(theta)),
          new THREE.Quaternion().setFromUnitVectors(normal, outward),
          new THREE.Vector3(1, 1, 1),
        ));
      }
    }
  }
  instance(annularLiner.fixed, new THREE.CircleGeometry(0.022, 7), black, outerLinerFixedApertures, 'Outer liner cooling apertures');
  instance(annularLiner.removable, new THREE.CircleGeometry(0.022, 7), black, outerLinerRemovableApertures, 'Outer liner cooling apertures');
  radialBoxes(combustor, -0.07, 1.172, 14, [0.8, 0.042, 0.035], titanium, 0.05);

  // Public CF6–80C2 stage counts: two HP and five LP turbine discs.
  const highPressureTurbineRotor = rotor(turbine, 'High-pressure turbine', 1.45);
  const lowPressureTurbineRotor = rotor(turbine, 'Low-pressure turbine', 0.73);
  shaftSection(lowPressureTurbineRotor, -0.59, 0.73, 0.105, titanium);
  shaftSection(turbine, -0.59, -0.02, 0.215, warmSteel, 0.147);
  sleeve(highPressureTurbineRotor, -0.745, 0, 0.56, 0.5, darkMetal, 0.033);
  sleeve(lowPressureTurbineRotor, 0, 0.745, 0.5, 0.44, darkMetal, 0.033);
  const turbineStagePositions = [-0.55, -0.185, 0.15, 0.275, 0.4, 0.525, 0.65];
  for (let stage = 0; stage < turbineStagePositions.length; stage++) {
    const highPressure = stage < 2;
    const turbineRotor = stage < 2 ? highPressureTurbineRotor : lowPressureTurbineRotor;
    const x = turbineStagePositions[stage];
    const inner = highPressure ? 0.54 - stage * 0.025 : 0.49 - (stage - 2) * 0.0125;
    const outer = highPressure ? 1.04 : 1.03 - (stage - 2) * 0.0125;
    const blades = bladeRing(turbineRotor, x, 48 - stage * 2, {
      rootRadius: inner, tipRadius: outer,
      rootChord: highPressure ? 0.15 : 0.058,
      tipChord: highPressure ? 0.185 : 0.07,
      rootPitch: 0.91, tipPitch: 0.61,
      sweep: highPressure ? 0.065 : 0.04,
      axialSweep: highPressure ? 0.005 : 0.003,
      thickness: highPressure ? 0.015 : 0.006,
      spanSteps: highPressure ? 6 : 5, chordSteps: 3,
    }, stage < 2 ? warmSteel : silver, stage * 0.057);
    blades.userData.axialAssembly = 'turbine';
    blades.userData.bladeRow = { kind: 'rotor', stage: stage + 1, spool: highPressure ? 'HP' : 'LP' };
    const halfWebWidth = highPressure ? 0.038 : 0.019;
    sleeve(turbineRotor, x - halfWebWidth, x + halfWebWidth, inner + 0.025, inner + 0.025, bronze, inner + 0.025 - (highPressure ? 0.215 : 0.105));
    ring(turbine, outer + 0.016, highPressure ? 0.019 : 0.012, x, titanium, 64);
    if (stage < turbineStagePositions.length - 1) {
      const stator = bladeRing(turbine, (x + turbineStagePositions[stage + 1]) / 2, 42, {
        rootRadius: inner - 0.005, tipRadius: outer - 0.01,
        rootChord: highPressure ? 0.09 : 0.041,
        tipChord: highPressure ? 0.14 : 0.052,
        rootPitch: -0.67, tipPitch: -0.4,
        sweep: highPressure ? -0.055 : -0.03,
        axialSweep: highPressure ? 0.012 : 0.003,
        thickness: highPressure ? 0.01 : 0.005,
        spanSteps: 4, chordSteps: 3,
      }, bronze);
      stator.userData.axialAssembly = 'turbine';
      stator.userData.bladeRow = { kind: 'stator', afterStage: stage + 1 };
    }
  }
  casing(turbine, [[-0.74, 1.085], [-0.47, 1.105], [0.36, 1.06], [0.8, 1.015]], shellMetal);
  sleeve(turbine, -0.78, -0.65, 1.096, 1.099, silver, 0.045);
  sleeve(turbine, 0.71, 0.84, 1.029, 1.019, silver, 0.045);
  boltRing(turbine, -0.792, 1.057, 30, 0.027);
  boltRing(turbine, 0.85, 0.982, 28, 0.026);
  radialBoxes(turbine, 0.02, 1.115, 14, [1.2, 0.05, 0.045], darkMetal);
  ring(turbine, 1.096, 0.02, -0.31, bronze);
  ring(turbine, 1.075, 0.02, 0.12, bronze);

  // Open exhaust, fluted petals, thermal discoloration bands and centre plug.
  sleeve(nozzle, -0.69, -0.49, 1.028, 1.031, silver, 0.04);
  ring(nozzle, 1.037, 0.03, -0.65, polished);
  boltRing(nozzle, -0.705, 0.996, 28, 0.025);
  const petalGeometry = flutedShellGeometry(
    [[-0.49, 1.023], [-0.33, 1.022], [0.23, 0.92], [0.76, 0.779]],
    36, 0.021, 0.035,
  );
  add(nozzle, petalGeometry, titanium);
  sleeve(nozzle, 0.71, 0.79, 0.789, 0.773, warmSteel, 0.035);
  ring(nozzle, 0.777, 0.022, 0.79, silver);
  const exhaustCone = directMesh(nozzle, latheX([
    [-0.62, 0.43], [-0.2, 0.458], [0.14, 0.435],
    [0.52, 0.33], [0.86, 0.17], [1.11, 0.021],
  ], 64), darkMetal, 'Exhaust centrebody', 'exhaust-cone');
  feature('exhaust-cone', 'nozzle', exhaustCone, [0.72, 0.12, 0.17]);
  ring(nozzle, 0.449, 0.019, -0.07, bronze, 64);
  ring(nozzle, 0.37, 0.011, 0.4, warmSteel, 64);
  radialBoxes(nozzle, -0.4, 0.707, 9, [0.25, 0.58, 0.045], titanium, 0.19);
  for (let i = 0; i < 36; i++) {
    const theta = i / 36 * TAU;
    tube(nozzle, [
      [-0.41, 1.046 * Math.cos(theta), 1.046 * Math.sin(theta)],
      [0.21, 0.945 * Math.cos(theta), 0.945 * Math.sin(theta)],
      [0.72, 0.808 * Math.cos(theta), 0.808 * Math.sin(theta)],
    ], 0.009, silver, 9);
  }

  // Accessory drive, electrical harnesses and individually routed service lines.
  add(accessories, new THREE.BoxGeometry(1.15, 0.38, 0.57), titanium, -1.14, -1.3, 0.76);
  add(accessories, roundedBox(0.77, 0.29, 0.49), graphite, -1.25, -1.49, 0.79);
  add(accessories, new THREE.BoxGeometry(0.64, 0.45, 0.42), warmSteel, -0.23, -1.15, 0.84);
  add(accessories, new THREE.BoxGeometry(0.57, 0.045, 0.38), darkMetal, -0.23, -1.39, 0.84);
  for (let i = 0; i < 11; i++) {
    add(accessories, new THREE.BoxGeometry(0.04, 0.1, 0.48), darkMetal, -1.72 + i * 0.105, -1.48, 0.76);
  }
  const starter = new THREE.CylinderGeometry(0.195, 0.195, 0.77, 30);
  starter.rotateZ(-Math.PI / 2);
  add(accessories, starter, darkMetal, -0.28, -1.44, 0.27);
  for (let i = 0; i < 7; i++) {
    const fin = new THREE.TorusGeometry(0.198, 0.014, 5, 30);
    fin.rotateY(Math.PI / 2);
    add(accessories, fin, titanium, -0.56 + i * 0.087, -1.44, 0.27);
  }
  add(accessories, new THREE.BoxGeometry(0.47, 0.3, 0.22), graphite, 1.06, -0.83, 1.02);
  add(accessories, new THREE.BoxGeometry(0.39, 0.23, 0.025), silver, 1.06, -0.83, 1.145);
  add(accessories, new THREE.BoxGeometry(0.09, 0.5, 0.12), titanium, -1.6, -1.02, 0.77);
  add(accessories, new THREE.BoxGeometry(0.09, 0.4, 0.12), titanium, -0.68, -1.02, 0.77);

  const serviceRoutes = [
    { r: 0.032, m: silver, p: [[-2.35, -0.46, 1.29], [-1.94, -0.44, 1.36], [-1.4, -0.43, 1.32], [-0.57, -0.41, 1.2], [0.33, -0.36, 1.2], [1.06, -0.31, 1.18], [1.43, -0.12, 1.1]] },
    { r: 0.027, m: copper, p: [[-2.19, -0.64, 1.18], [-1.84, -0.58, 1.34], [-1.06, -0.53, 1.34], [-0.36, -0.51, 1.25], [0.36, -0.49, 1.23], [0.69, -0.39, 1.18]] },
    { r: 0.024, m: silver, p: [[-1.48, -1.27, 1.02], [-1.51, -1.02, 1.19], [-1.47, -0.77, 1.35], [-0.92, -0.68, 1.34], [-0.36, -0.64, 1.25], [0.51, -0.62, 1.21], [1.31, -0.45, 1.11], [2.35, -0.33, 0.99]] },
    { r: 0.035, m: darkMetal, p: [[-1.13, -1.47, 0.99], [-0.79, -1.47, 1.06], [-0.61, -1.15, 1.17], [-0.28, -0.88, 1.22], [0.56, -0.77, 1.14], [1.15, -0.66, 1.1]] },
    { r: 0.024, m: bronze, p: [[-0.25, -1.21, 1.06], [-0.1, -0.96, 1.15], [0.13, -0.84, 1.25], [0.61, -0.78, 1.25], [0.78, -0.56, 1.22], [0.8, -0.05, 1.19]] },
    { r: 0.02, m: silver, p: [[-1.96, 0.57, 1.24], [-1.65, 0.67, 1.25], [-0.75, 0.66, 1.17], [0.09, 0.6, 1.13], [0.61, 0.53, 1.16], [1.38, 0.41, 1.11], [1.82, 0.35, 1.05]] },
    { r: 0.018, m: darkMetal, p: [[-1.95, 0.65, 1.2], [-1.65, 0.75, 1.22], [-0.73, 0.74, 1.16], [0.08, 0.68, 1.11], [0.63, 0.61, 1.13], [1.38, 0.49, 1.08]] },
    { r: 0.026, m: silver, p: [[-0.32, -1.4, 0.31], [0.06, -1.44, 0.35], [0.41, -1.29, 0.46], [0.75, -1.18, 0.62], [1.56, -1.01, 0.67], [1.91, -0.86, 0.75]] },
    { r: 0.019, m: copper, p: [[1.08, -0.82, 1.17], [1.41, -0.72, 1.13], [1.48, -0.38, 1.16], [1.72, -0.2, 1.08], [2.19, -0.15, 1.05]] },
  ];
  serviceRoutes.forEach((route, index) => {
    const mesh = tube(accessories, route.p, route.r, route.m, 46, index === 7 ? 'oil-line' : undefined);
    if (index === 7) feature('oil-line', 'accessories', mesh, [0.75, -1.18, 0.62]);
  });

  const couplingMatrices = [];
  for (const [x, y, z] of [
    [-1.85, -0.44, 1.36], [-0.53, -0.41, 1.2], [0.32, -0.36, 1.2],
    [-1.65, -0.57, 1.34], [-0.34, -0.51, 1.25], [0.35, -0.49, 1.23],
    [-0.84, -0.67, 1.33], [0.51, -0.62, 1.21], [1.96, -0.35, 1.02],
    [-0.94, 0.67, 1.2], [0.2, 0.59, 1.15], [1.3, 0.43, 1.13],
  ]) couplingMatrices.push(new THREE.Matrix4().makeTranslation(x, y, z));
  const couplingGeometry = new THREE.CylinderGeometry(0.052, 0.052, 0.09, 6);
  couplingGeometry.rotateZ(-Math.PI / 2);
  instance(accessories, couplingGeometry, bronze, couplingMatrices, 'Service-line unions');

  for (const x of [-1.55, -0.91, -0.26, 0.4, 1.14]) {
    add(accessories, new THREE.BoxGeometry(0.055, 0.075, 0.12), darkMetal, x, 0.665 - (x + 1.55) * 0.068, 1.21 - (x + 1.55) * 0.04);
    add(accessories, new THREE.BoxGeometry(0.06, 0.29, 0.045), titanium, x, -0.53, 1.3 - (x + 1.55) * 0.073);
  }
  add(accessories, new THREE.BoxGeometry(0.34, 0.13, 0.012), black, -1.25, -1.43, 1.044);
  add(accessories, new THREE.BoxGeometry(0.22, 0.019, 0.014), silver, -1.25, -1.404, 1.052);
  add(accessories, new THREE.BoxGeometry(0.14, 0.012, 0.014), silver, -1.29, -1.444, 1.052);
  add(accessories, new THREE.BoxGeometry(0.045, 0.06, 0.015), teal, -1.125, -1.447, 1.053);
  const screwMatrices = [];
  for (const x of [-1.62, -0.69]) {
    for (const y of [-1.2, -1.38]) {
      const matrix = new THREE.Matrix4().makeRotationX(Math.PI / 2);
      matrix.setPosition(x, y, 1.055);
      screwMatrices.push(matrix);
    }
  }
  instance(accessories, new THREE.CylinderGeometry(0.028, 0.028, 0.025, 6), polished, screwMatrices);

  // Merge static pieces per material and functional group; blade arrays stay instanced.
  for (const [parent, materialBatches] of batches) {
    for (const [material, source] of materialBatches) {
      const geometry = mergeGeometries(source);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.partId = parent.userData.partId;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `${parent.name} / ${material.color.getHexString()}`;
      parent.add(mesh);
      geometries.add(geometry);
      source.forEach(item => item.dispose());
    }
  }
  batches.clear();

  root.traverse(object => {
    if (object.isMesh && !object.userData.partId) {
      let parent = object.parent;
      while (parent && !parent.userData.partId) parent = parent.parent;
      if (parent) object.userData.partId = parent.userData.partId;
    }
  });
  root.userData.dimensions = { length: 9.31, fanDiameter: 4.15, unit: 'model units' };
  root.userData.proceduralStudy = true;
  root.userData.axis = 'X';
  root.userData.front = -4.58;
  root.userData.rear = 4.73;
  root.userData.materialSource = 'Procedural steel, titanium and hot-section finishes; not scanned originals';
  root.userData.spoolLayout = {
    lowPressure: ['fan', 'compressor stages 1–4', 'inner shaft', 'low-pressure turbine'],
    highPressure: ['compressor stages 5–18', 'outer hollow shaft', 'high-pressure turbine'],
    illustrativeGeometry: true,
  };
  root.userData.stageReference = {
    sourceUrl: 'https://www.geaerospace.com/commercial/aircraft-engines/cf6',
    verifiedOn: '2026-11-11',
    family: 'CF6–80C2',
    fanStages: 1,
    lowPressureCompressorStages: 4,
    highPressureCompressorStages: 14,
    highPressureTurbineStages: 2,
    lowPressureTurbineStages: 5,
    scope: 'Stage counts only; blade counts, airfoils, dimensions, spacing and surfaces remain illustrative.',
  };
  root.userData.axialClearance = {};
  for (const assembly of ['compressor', 'turbine']) {
    const rows = [];
    root.traverse(mesh => {
      if (mesh.userData.axialAssembly === assembly) {
        rows.push({ ...mesh.userData.bladeRow, interval: [...mesh.userData.axialInterval] });
      }
    });
    rows.sort((a, b) => a.interval[0] - b.interval[0]);
    const gaps = rows.slice(1).map((row, index) => row.interval[0] - rows[index].interval[1]);
    root.userData.axialClearance[assembly] = { minimumGap: Math.min(...gaps), rows };
  }

  const finiteComponent = (value, index) => Number.isFinite(value?.[index]) ? value[index] : 0;

  /**
   * Pure pose factory. Positions are offsets from each part's assembled origin;
   * rotations are absolute Euler angles (radians, XYZ) for the functional group.
   */
  function getDefaultExplodePoses(amount) {
    const t = THREE.MathUtils.clamp(Number(amount) || 0, 0, 1);
    return Object.fromEntries([...parts].map(([id, group]) => [
      id,
      {
        position: group.userData.explosion.toArray().map(component => component * t),
        rotation: [0, 0, 0],
      },
    ]));
  }

  function applyPartPoses(poses = {}) {
    for (const [id, group] of parts) {
      const pose = poses?.[id];
      group.position.copy(group.userData.assembled);
      group.position.x += finiteComponent(pose?.position, 0);
      group.position.y += finiteComponent(pose?.position, 1);
      group.position.z += finiteComponent(pose?.position, 2);
      group.rotation.set(
        finiteComponent(pose?.rotation, 0),
        finiteComponent(pose?.rotation, 1),
        finiteComponent(pose?.rotation, 2),
        'XYZ',
      );
    }
    for (const group of casingGroups) {
      const owner = parts.get(group.userData.partId);
      const travel = owner.position.distanceTo(owner.userData.assembled);
      const nominal = owner.userData.explosion.length();
      const t = nominal > 0 ? THREE.MathUtils.clamp(travel / nominal, 0, 1) : 0;
      group.position.set(0, t * 0.08, -t * 0.12);
    }
  }

  return {
    root,
    parts,
    rotors,
    features,
    getDefaultExplodePoses,
    applyPartPoses,
    setExplode(amount) {
      applyPartPoses(getDefaultExplodePoses(amount));
    },
    setCutaway(enabled) {
      removableShells.forEach(group => { group.visible = !enabled; });
    },
    setRunning(enabled) {
      running = Boolean(enabled);
    },
    isAnimating() {
      return !disposed && (running || rotorSpeed > 1e-4);
    },
    getMotionState() {
      return { running, rotorSpeed };
    },
    update(dt) {
      if (disposed) return false;
      const delta = Math.min(0.05, Math.max(0, Number(dt) || 0));
      rotorSpeed = THREE.MathUtils.damp(rotorSpeed, running ? 1.35 : 0, running ? 1.8 : 3, delta);
      if (!running && rotorSpeed < 1e-4) rotorSpeed = 0;
      for (const group of rotors) group.rotation.x = (group.rotation.x + delta * rotorSpeed * group.userData.speed) % TAU;
      return running || rotorSpeed > 0;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      textures.forEach(texture => texture.dispose());
      root.removeFromParent();
    },
  };
}

function makeSurfaceTextures(family) {
  const width = 512;
  const height = 256;
  const channels = ['color', 'roughness', 'height'];
  const surfaces = Object.fromEntries(channels.map(channel => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    return [channel, { canvas, context, image: context.createImageData(width, height) }];
  }));
  let seed = family === 'hot' ? 26561 : family === 'titanium' ? 104729 : 7919;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let y = 0; y < height; y++) {
    const machiningLine = (random() - 0.5) * 11 + 3 * Math.sin(y * 0.35);
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const grain = (random() - 0.5) * 2;
      const swirl = Math.sin(x * 0.037 + Math.sin(y * 0.043) * 1.9);
      const crossing = Math.sin(x * 0.18 + y * 0.035) * 0.5;
      const finish = family === 'hot'
        ? grain * 7 + swirl * 5 + Math.sin(y * 0.07) * 3
        : family === 'titanium'
          ? machiningLine * 0.45 + crossing * 4 + grain * 2
          : machiningLine + grain * 2.7;
      const base = family === 'hot' ? 230 : 240;
      const rough = family === 'hot'
        ? 211 + grain * 19 + swirl * 12
        : family === 'titanium'
          ? 218 + machiningLine * 1.3 + grain * 6
          : 218 + machiningLine * 1.8 + grain * 5;
      const relief = 128 + (family === 'hot' ? grain * 15 + swirl * 3 : machiningLine * 1.4 + grain * 4);
      const warmth = family === 'hot' ? (swirl + 1) * 3 : 0;
      surfaces.color.image.data[index] = base + finish + warmth;
      surfaces.color.image.data[index + 1] = base + finish;
      surfaces.color.image.data[index + 2] = base + finish - warmth;
      surfaces.color.image.data[index + 3] = 255;
      for (const [channel, value] of [['roughness', rough], ['height', relief]]) {
        const data = surfaces[channel].image.data;
        data[index] = data[index + 1] = data[index + 2] = value;
        data[index + 3] = 255;
      }
    }
  }
  return Object.fromEntries(channels.map(channel => {
    const { canvas, context, image } = surfaces[channel];
    context.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.name = `Procedural ${family} / ${channel}`;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(family === 'hot' ? 2 : 3, family === 'titanium' ? 4 : 2);
    texture.colorSpace = channel === 'color' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.anisotropy = 4;
    return [channel, texture];
  }));
}

function latheX(profile, segments = 64) {
  const geometry = new THREE.LatheGeometry(profile.map(([x, radius]) => new THREE.Vector2(radius, x)), segments);
  geometry.rotateZ(-Math.PI / 2);
  return geometry;
}

function roundedBox(width, height, depth) {
  // Small chamfers are more legible than rounded corners at assembly scale.
  const shape = new THREE.Shape();
  const r = Math.min(width, height) * 0.12;
  shape.moveTo(-width / 2 + r, -height / 2);
  shape.lineTo(width / 2 - r, -height / 2);
  shape.lineTo(width / 2, -height / 2 + r);
  shape.lineTo(width / 2, height / 2 - r);
  shape.lineTo(width / 2 - r, height / 2);
  shape.lineTo(-width / 2 + r, height / 2);
  shape.lineTo(-width / 2, height / 2 - r);
  shape.lineTo(-width / 2, -height / 2 + r);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function bladeGeometry({
  rootRadius, tipRadius, rootChord, tipChord, rootPitch, tipPitch,
  sweep, axialSweep, thickness, spanSteps, chordSteps,
}) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const sideSize = (spanSteps + 1) * (chordSteps + 1);
  for (let side = 0; side < 2; side++) {
    for (let row = 0; row <= spanSteps; row++) {
      const t = row / spanSteps;
      const radius = THREE.MathUtils.lerp(rootRadius, tipRadius, t);
      const chord = THREE.MathUtils.lerp(rootChord, tipChord, t) * (1 - 0.08 * Math.pow(t, 6));
      const pitch = THREE.MathUtils.lerp(rootPitch, tipPitch, t);
      for (let column = 0; column <= chordSteps; column++) {
        const u = column / chordSteps;
        const chordPosition = (u - 0.5) * chord;
        const envelope = Math.sin(Math.PI * u);
        const camber = envelope * chord * 0.085;
        const halfThickness = envelope * thickness * (1 - 0.45 * t) * (side ? -1 : 1);
        const x = axialSweep * Math.pow(t, 1.6) + chordPosition * Math.sin(pitch) + camber + halfThickness;
        const angle = sweep * Math.pow(t, 1.25) + (chordPosition * Math.cos(pitch) - camber * 0.4) / radius;
        positions.push(x, radius * Math.cos(angle), radius * Math.sin(angle));
        uvs.push(u, t);
      }
    }
  }
  for (let side = 0; side < 2; side++) {
    const offset = side * sideSize;
    for (let row = 0; row < spanSteps; row++) {
      for (let column = 0; column < chordSteps; column++) {
        const a = offset + row * (chordSteps + 1) + column;
        const b = a + 1;
        const c = a + chordSteps + 1;
        const d = c + 1;
        if (side === 0) indices.push(a, c, b, b, c, d);
        else indices.push(a, b, c, b, d, c);
      }
    }
  }
  // Close the tip and root so nearby blades retain their solid airfoil profile.
  for (const row of [0, spanSteps]) {
    for (let column = 0; column < chordSteps; column++) {
      const a = row * (chordSteps + 1) + column;
      const b = a + 1;
      indices.push(a, b, a + sideSize, b, b + sideSize, a + sideSize);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function shellGeometry(profile, start, end, segments, thickness) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const stride = segments + 1;
  const sideSize = profile.length * stride;
  for (let side = 0; side < 2; side++) {
    for (let row = 0; row < profile.length; row++) {
      const [x, radius] = profile[row];
      for (let i = 0; i <= segments; i++) {
        const theta = THREE.MathUtils.lerp(start, end, i / segments);
        const r = radius - side * thickness;
        positions.push(x, r * Math.cos(theta), r * Math.sin(theta));
        uvs.push(i / segments, row / (profile.length - 1));
      }
    }
  }
  for (let side = 0; side < 2; side++) {
    const offset = side * sideSize;
    for (let row = 0; row < profile.length - 1; row++) {
      for (let i = 0; i < segments; i++) {
        const a = offset + row * stride + i;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        if (side === 0) indices.push(a, b, c, b, d, c);
        else indices.push(a, c, b, b, c, d);
      }
    }
  }
  for (const row of [0, profile.length - 1]) {
    for (let i = 0; i < segments; i++) {
      const a = row * stride + i;
      if (row === 0) indices.push(a, a + sideSize, a + 1, a + 1, a + sideSize, a + sideSize + 1);
      else indices.push(a, a + 1, a + sideSize, a + 1, a + sideSize + 1, a + sideSize);
    }
  }
  for (const col of [0, segments]) {
    for (let row = 0; row < profile.length - 1; row++) {
      const a = row * stride + col;
      const b = a + stride;
      indices.push(a, b, a + sideSize, b, b + sideSize, a + sideSize);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function flutedShellGeometry(profile, flutes, amplitude, thickness) {
  const segments = flutes * 4;
  const geometry = shellGeometry(profile, 0, TAU, segments, thickness);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const angle = Math.atan2(z, y);
    const originalRadius = Math.hypot(y, z);
    const ripple = amplitude * (0.5 + 0.5 * Math.cos(angle * flutes));
    positions.setXYZ(i, x, y * (1 + ripple / originalRadius), z * (1 + ripple / originalRadius));
  }
  geometry.computeVertexNormals();
  return geometry;
}

function mergeGeometries(source) {
  let vertexCount = 0;
  let indexCount = 0;
  for (const geometry of source) {
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
    vertexCount += geometry.getAttribute('position').count;
    indexCount += geometry.index ? geometry.index.count : geometry.getAttribute('position').count;
  }
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices = new Uint32Array(indexCount);
  let vertexOffset = 0;
  let indexOffset = 0;
  for (const geometry of source) {
    const p = geometry.getAttribute('position');
    const n = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('uv');
    positions.set(p.array, vertexOffset * 3);
    normals.set(n.array, vertexOffset * 3);
    if (uv) uvs.set(uv.array, vertexOffset * 2);
    const count = geometry.index ? geometry.index.count : p.count;
    for (let i = 0; i < count; i++) {
      indices[indexOffset + i] = vertexOffset + (geometry.index ? geometry.index.getX(i) : i);
    }
    vertexOffset += p.count;
    indexOffset += count;
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  result.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  result.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  result.setIndex(new THREE.BufferAttribute(indices, 1));
  result.computeBoundingSphere();
  return result;
}
