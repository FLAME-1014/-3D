import * as THREE from 'three';

// A proportioned, working visual interpretation of the 82200 architecture.
// It is not an IWC manufacturing drawing or a service/disassembly reference.
// The dial faces +Z; the display back and all readable engravings face -Z.
const TAU = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function seededRandom(seed = 82200) {
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function machiningTexture(style) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const random = seededRandom(style === 'perlage' ? 22 : 82);
  ctx.fillStyle = '#eeeeee';
  ctx.fillRect(0, 0, 512, 512);
  if (style === 'perlage') {
    for (let row = -1; row < 17; row++) {
      for (let col = -1; col < 17; col++) {
        const x = col * 35 + (row % 2) * 17.5;
        const y = row * 31;
        const gradient = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 23);
        gradient.addColorStop(0, '#e2e5e6');
        gradient.addColorStop(0.36, '#e9ebec');
        gradient.addColorStop(0.7, '#dfe2e4');
        gradient.addColorStop(1, '#d0d5d8');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, 23, 0, TAU);
        ctx.fill();
        for (let ring = 1; ring <= 22; ring += 1.3) {
          ctx.strokeStyle = `rgba(255,255,255,${0.14 + random() * 0.17})`;
          ctx.lineWidth = 0.45;
          ctx.beginPath();
          ctx.arc(x, y, ring, -1, 4.2);
          ctx.stroke();
        }
      }
    }
  } else {
    for (let y = 0; y < 512; y++) {
      const light = Math.round(213 + 17 * Math.sin(y * TAU / 105) + random() * 10);
      ctx.fillStyle = `rgb(${light},${light + 2},${Math.min(255, light + 4)})`;
      ctx.fillRect(0, y, 512, 1);
    }
    for (let i = 0; i < 950; i++) {
      const x = random() * 512;
      const y = random() * 512;
      ctx.strokeStyle = random() > 0.5 ? 'rgba(255,255,255,.16)' : 'rgba(80,90,100,.08)';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 15 + random() * 110, y + 0.8);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function circleShape(radius, hole = 0) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius, 0, TAU, false);
  if (hole > 0) {
    const cutout = new THREE.Path();
    cutout.absarc(0, 0, hole, 0, TAU, true);
    shape.holes.push(cutout);
  }
  return shape;
}

function extrude(shape, depth, bevel = 0.002, segments = 48) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    curveSegments: segments,
    bevelEnabled: bevel > 0,
    bevelSegments: bevel > 0 ? 2 : 0,
    bevelSize: bevel,
    bevelThickness: bevel,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function cylinder(radius, depth, material, segments = 48, inner = 0) {
  return new THREE.Mesh(extrude(circleShape(radius, inner), depth, 0.001, segments), material);
}

function sectorShape(inner, outer, from, to) {
  const shape = new THREE.Shape();
  shape.moveTo(Math.cos(from) * outer, Math.sin(from) * outer);
  shape.absarc(0, 0, outer, from, to, false);
  shape.lineTo(Math.cos(to) * inner, Math.sin(to) * inner);
  shape.absarc(0, 0, inner, to, from, true);
  shape.closePath();
  return shape;
}

function bevelledBar(length, width, depth, material) {
  const shape = new THREE.Shape();
  const r = Math.min(width / 2, 0.025);
  const x = -length / 2;
  const y = -width / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + length - r, y);
  shape.quadraticCurveTo(x + length, y, x + length, y + r);
  shape.lineTo(x + length, y + width - r);
  shape.quadraticCurveTo(x + length, y + width, x + length - r, y + width);
  shape.lineTo(x + r, y + width);
  shape.quadraticCurveTo(x, y + width, x, y + width - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return new THREE.Mesh(extrude(shape, depth, 0.002, 5), material);
}

function toothShape(radius, teeth, inner, escape = false) {
  const shape = new THREE.Shape();
  // Separate radial flanks give the wheel a real toothed outline, not a decal.
  const profile = escape
    ? [[0, 0.76], [0.25, 0.78], [0.57, 1], [0.68, 1], [0.75, 0.78]]
    : [[0, 0.91], [0.22, 0.91], [0.36, 1], [0.64, 1], [0.78, 0.91]];
  for (let tooth = 0; tooth < teeth; tooth++) {
    for (let i = 0; i < profile.length; i++) {
      const [fraction, factor] = profile[i];
      const angle = TAU * (tooth + fraction) / teeth;
      const x = Math.cos(angle) * radius * factor;
      const y = Math.sin(angle) * radius * factor;
      if (tooth === 0 && i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
  }
  shape.closePath();
  if (inner > 0) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, inner, 0, TAU, true);
    shape.holes.push(hole);
  }
  return shape;
}

function engraving(text, width, height, color = '#525451', fontSize = 62) {
  const canvas = document.createElement('canvas');
  const lines = text.split('\n');
  const textSize = fontSize * (lines.length === 1 ? 1.65 : 1.45);
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const font = index => `${index === 0 ? 600 : 400} ${index === 0 ? textSize : textSize * 0.55}px Georgia, "Times New Roman", serif`;
  canvas.width = Math.ceil(Math.max(256, ...lines.map((line, index) => {
    ctx.font = font(index);
    return ctx.measureText(line).width + 40;
  })));
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, index) => {
    ctx.font = font(index);
    ctx.fillText(line, canvas.width / 2, 128 + (index - (lines.length - 1) / 2) * textSize * 1.2);
  });
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.rotation.y = Math.PI;
  return mesh;
}

// Merge only within a selectable component. This keeps every part independent
// while avoiding a draw call for every thread, spoke and bearing ball.
function consolidateComponent(group) {
  const buckets = new Map();
  for (const child of group.children) {
    if (!child.isMesh || Array.isArray(child.material)) continue;
    if (!buckets.has(child.material)) buckets.set(child.material, []);
    buckets.get(child.material).push(child);
  }
  for (const [material, meshes] of buckets) {
    if (meshes.length < 2) continue;
    const geometries = meshes.map(mesh => {
      mesh.updateMatrix();
      return mesh.geometry.clone().applyMatrix4(mesh.matrix);
    });
    const vertexCount = geometries.reduce((total, geometry) => total + geometry.attributes.position.count, 0);
    const indexCount = geometries.reduce((total, geometry) => total + (geometry.index?.count ?? geometry.attributes.position.count), 0);
    const merged = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'uv']) {
      const size = geometries[0].attributes[name]?.itemSize;
      if (!size || geometries.some(geometry => !geometry.attributes[name])) continue;
      const values = new Float32Array(vertexCount * size);
      let offset = 0;
      for (const geometry of geometries) {
        values.set(geometry.attributes[name].array, offset);
        offset += geometry.attributes[name].array.length;
      }
      merged.setAttribute(name, new THREE.BufferAttribute(values, size));
    }
    const indices = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
    let indexOffset = 0;
    let vertexOffset = 0;
    for (const geometry of geometries) {
      const count = geometry.index?.count ?? geometry.attributes.position.count;
      for (let i = 0; i < count; i++) {
        indices[indexOffset++] = (geometry.index ? geometry.index.array[i] : i) + vertexOffset;
      }
      vertexOffset += geometry.attributes.position.count;
      geometry.dispose();
    }
    merged.setIndex(new THREE.BufferAttribute(indices, 1));
    merged.computeBoundingSphere();
    meshes.forEach(mesh => group.remove(mesh));
    group.add(new THREE.Mesh(merged, material));
  }
}

export function createMovement() {
  const root = new THREE.Group();
  root.name = 'Calibre 82200 · Mechanical interpretation';
  const parts = [];
  const animations = [];
  const texturePerlage = machiningTexture('perlage');
  texturePerlage.repeat.set(1.2, 1.2);
  const textureStripes = machiningTexture('stripes');
  const steel = new THREE.MeshStandardMaterial({
    color: '#b9bec3', metalness: 0.96, roughness: 0.32,
    map: textureStripes, bumpMap: textureStripes, bumpScale: 0.0007,
  });
  const plateMetal = new THREE.MeshStandardMaterial({
    color: '#d2d3cc', metalness: 0.92, roughness: 0.37,
    map: texturePerlage, bumpMap: texturePerlage, bumpScale: 0.00045,
  });
  const polished = new THREE.MeshStandardMaterial({ color: '#d9e0e6', metalness: 1, roughness: 0.16 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: '#3c4248', metalness: 0.95, roughness: 0.28 });
  const brass = new THREE.MeshStandardMaterial({
    color: '#b99a53', metalness: 0.94, roughness: 0.29,
    map: textureStripes, bumpMap: textureStripes, bumpScale: 0.00045,
  });
  const gold = new THREE.MeshStandardMaterial({ color: '#d9bb78', metalness: 1, roughness: 0.2 });
  const blueSteel = new THREE.MeshStandardMaterial({ color: '#263a56', metalness: 0.97, roughness: 0.22 });
  const ceramic = new THREE.MeshStandardMaterial({ color: '#25272a', metalness: 0.18, roughness: 0.2 });
  const ruby = new THREE.MeshPhysicalMaterial({
    color: '#ae2551', metalness: 0.02, roughness: 0.12, transmission: 0.25,
    transparent: true, opacity: 0.96, ior: 1.76, thickness: 0.025,
    clearcoat: 1, clearcoatRoughness: 0.06,
  });

  let sequence = 0;
  function part(id, name, nameEn, description, material, x, y, z, distance = 0.35) {
    const object = new THREE.Group();
    object.name = nameEn;
    object.position.set(x, y, z);
    const item = {
      id: `movement-${id}`,
      name,
      nameEn,
      category: 'movement',
      description,
      material,
      object,
      basePosition: object.position.clone(),
      explode: new THREE.Vector3(
        x * 0.28 + Math.cos(sequence * 2.399) * 0.14,
        y * 0.28 + Math.sin(sequence * 2.399) * 0.14,
        -distance,
      ),
    };
    sequence++;
    root.add(object);
    parts.push(item);
    return object;
  }

  function wheel(id, name, nameEn, x, y, z, radius, teeth, spokes, rate, escape = false) {
    const group = part(id, name, nameEn,
      `${teeth} 枚独立轮齿、${spokes} 根镂空轮辐与立体轴榫；按轮系传动比例连续运行。此结构为机械原理可视化重建。`,
      escape ? '抛光钢 / 黄铜轴套' : '拉丝黄铜 / 抛光钢轴', x, y, z, 0.48 + parts.length * 0.009);
    const inner = radius * (escape ? 0.65 : 0.73);
    const rim = new THREE.Mesh(extrude(toothShape(radius, teeth, inner, escape), 0.021, 0.001, 40), escape ? polished : brass);
    group.add(rim);
    for (let i = 0; i < spokes; i++) {
      const angle = TAU * i / spokes;
      const span = inner - radius * 0.12;
      const arm = bevelledBar(span, radius * 0.085, 0.021, escape ? polished : brass);
      arm.position.set(Math.cos(angle) * (span / 2 + radius * 0.1), Math.sin(angle) * (span / 2 + radius * 0.1), 0);
      arm.rotation.z = angle;
      group.add(arm);
    }
    group.add(cylinder(radius * 0.16, 0.033, gold, 28));
    group.add(cylinder(0.012, 0.081, polished, 16));
    const bevelRing = new THREE.Mesh(new THREE.TorusGeometry(inner + 0.005, 0.0028, 5, 64), gold);
    bevelRing.position.z = -0.013;
    group.add(bevelRing);
    animations.push({ object: group, rate, offset: ((parts.length * 0.71) % TAU) });
    return group;
  }

  function pinion(id, name, x, y, z, radius, teeth, rate) {
    const group = part(id, name, 'Steel pinion', '独立钢制小齿轴，与对应大轮同轴连接；立体齿槽在拆解视图中清晰可见。',
      '硬化抛光钢', x, y, z, 0.9 + parts.length * 0.006);
    group.add(new THREE.Mesh(extrude(toothShape(radius, teeth, 0), 0.052, 0.001, 12), polished));
    group.add(cylinder(0.012, 0.09, polished, 14));
    animations.push({ object: group, rate, offset: 0 });
    return group;
  }

  function screw(id, x, y, z, size = 1, blue = false) {
    const group = part(`screw-${id}`, `机芯螺丝 ${id}`, `Movement screw ${id}`,
      '一字槽螺丝独立建模，包含倒角头部、凹入槽口、螺杆和环形螺纹，可单独分离检查。',
      blue ? '热蓝钢' : '镜面抛光钢', x, y, z, 1.22 + (sequence % 5) * 0.13);
    const head = circleShape(0.035 * size);
    const slot = new THREE.Path();
    const halfLength = 0.027 * size;
    const halfWidth = 0.0045 * size;
    slot.moveTo(-halfLength, -halfWidth);
    slot.lineTo(-halfLength, halfWidth);
    slot.lineTo(halfLength, halfWidth);
    slot.lineTo(halfLength, -halfWidth);
    slot.closePath();
    head.holes.push(slot);
    const headMesh = new THREE.Mesh(extrude(head, 0.02, 0.0015 * size, 20), blue ? blueSteel : polished);
    group.add(headMesh);
    const recess = new THREE.Mesh(new THREE.BoxGeometry(halfLength * 2, halfWidth * 2, 0.004), darkSteel);
    recess.position.z = 0.005;
    group.add(recess);
    const stem = cylinder(0.014 * size, 0.052, darkSteel, 12);
    stem.position.z = 0.03;
    group.add(stem);
    const threadGeometry = new THREE.TorusGeometry(0.014 * size, 0.0023 * size, 4, 14);
    for (let i = 0; i < 5; i++) {
      const thread = new THREE.Mesh(threadGeometry, polished);
      thread.position.z = 0.013 + i * 0.009;
      group.add(thread);
    }
    group.rotation.z = sequence * 1.417;
    return group;
  }

  function jewel(id, x, y, z, radius = 0.036) {
    const chaton = part(`chaton-${id}`, `宝石轴承座 ${id}`, 'Polished jewel setting',
      '倒角金属轴承座保持宝石与轮轴同心，独立于红宝石轴承建模。',
      '镀金黄铜 / 抛光倒角', x, y, z + 0.003, 1.15 + sequence * 0.003);
    chaton.add(cylinder(radius * 1.5, 0.016, gold, 32, radius * 0.99));
    const stone = part(`jewel-${id}`, `红宝石轴承 ${id}`, 'Synthetic ruby bearing',
      '合成红宝石环形轴承降低轴榫摩擦；中心油槽、通孔和金属轴榫均为立体几何。',
      '合成红宝石，折射率 1.76', x, y, z - 0.002, 1.32 + sequence * 0.003);
    stone.add(cylinder(radius, 0.016, ruby, 32, radius * 0.26));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.72, 0.0026, 5, 32), ruby);
    rim.position.z = -0.009;
    stone.add(rim);
    return stone;
  }

  function bridge(id, name, nameEn, points, z, label) {
    const center = points.reduce((acc, p) => acc.add(new THREE.Vector2(...p)), new THREE.Vector2()).multiplyScalar(1 / points.length);
    const group = part(id, name, nameEn,
      '独立镀铑夹板，具有日内瓦条纹、抛光倒角与刻字；轮轴由夹板上的宝石轴承定位。',
      '镀铑黄铜 / 日内瓦条纹', center.x, center.y, z, 0.94 + parts.length * 0.008);
    const shape = new THREE.Shape();
    points.forEach((p, i) => {
      const method = i === 0 ? 'moveTo' : 'lineTo';
      shape[method](p[0] - center.x, p[1] - center.y);
    });
    shape.closePath();
    group.add(new THREE.Mesh(extrude(shape, 0.038, 0.007, 10), steel));
    if (label) {
      const inscription = engraving(label, 0.43, 0.105, '#525351', 61);
      inscription.position.z = -0.027;
      group.add(inscription);
    }
    return group;
  }

  // Main plate: a full, pearled base with through-bored bearing apertures.
  const plate = part('main-plate', '珍珠纹主夹板', 'Perlage main plate',
    '珍珠圆纹主夹板承载轮系，开孔、沉孔与独立夹板共同构成有深度的机械层次。尺寸参照 30 mm 级自动机芯比例。',
    '镀铑黄铜 / 珍珠圆纹', 0, 0, 0.09, 0.24);
  const plateShape = circleShape(1.60);
  [[-0.98, -0.38, 0.265], [0.72, 0.93, 0.12], [1.13, 0.2, 0.105], [-0.25, -1.25, 0.075]].forEach(([x, y, radius]) => {
    const hole = new THREE.Path();
    hole.absarc(x, y, radius, 0, TAU, true);
    plateShape.holes.push(hole);
  });
  plate.add(new THREE.Mesh(extrude(plateShape, 0.045, 0.003, 96), plateMetal));
  const plateLip = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.009, 6, 128), polished);
  plateLip.position.z = -0.025;
  plate.add(plateLip);
  const plateInscription = engraving('SWISS · 28 800 A/h', 0.56, 0.12, '#72736c', 54);
  plateInscription.position.set(0.58, -1.13, -0.027);
  plateInscription.rotation.z = -0.33;
  plate.add(plateInscription);

  // Mainspring barrel, cover and spring are independent explodable components.
  const barrel = part('barrel', '发条盒与大钢轮', 'Mainspring barrel',
    '发条盒储存走时能量，外围 80 齿将扭矩传递至走时轮系。拆下盒盖可查看盘绕发条。',
    '拉丝黄铜', -0.72, 0.72, 0.035, 0.4);
  barrel.add(new THREE.Mesh(extrude(toothShape(0.50, 80, 0.425), 0.044, 0.001, 40), brass));
  const barrelFloor = cylinder(0.436, 0.012, brass, 64);
  barrelFloor.position.z = 0.023;
  barrel.add(barrelFloor);
  barrel.add(cylinder(0.045, 0.075, polished, 24));
  const spring = part('mainspring', '盘绕主发条', 'Coiled mainspring',
    '独立盘绕钢带可在发条盒拆开后观察，表现机械储能的基本结构。',
    '弹性合金钢', -0.72, 0.72, 0.023, 0.72);
  const springPoints = [];
  for (let i = 0; i <= 520; i++) {
    const t = i / 520;
    const angle = t * TAU * 8;
    const radius = 0.065 + t * 0.345;
    springPoints.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
  }
  spring.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(springPoints), 520, 0.0047, 4, false), blueSteel));
  const barrelCover = part('barrel-cover', '发条盒盖', 'Barrel cover',
    '薄型金属盒盖保护主发条，环形机加工纹理与中央轴套均独立构建。',
    '太阳纹黄铜', -0.72, 0.72, -0.009, 0.83);
  barrelCover.add(cylinder(0.435, 0.011, brass, 64, 0.045));
  for (const radius of [0.35, 0.39, 0.418]) {
    const groove = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.0018, 4, 64), gold);
    groove.position.z = -0.007;
    barrelCover.add(groove);
  }

  // The train is spatially arranged with meshing rims and coaxial pinions.
  // Rates are angular velocities: centre wheel 1/hour, fourth wheel 1/minute.
  const train = [
    ['center', '中心轮', 'Centre wheel', 0.15, 0.30, 0.48, 64, 6, -TAU / 3600],
    ['third', '三轮', 'Third wheel', 0.68, -0.35, 0.31, 60, 5, TAU / 450],
    ['fourth', '秒轮', 'Fourth / seconds wheel', 0.18, -0.92, 0.44, 70, 6, -TAU / 60],
    ['escape', '擒纵轮', 'Escape wheel', -0.49, -0.79, 0.25, 15, 5, TAU * 4 / 15],
  ];
  train.forEach(([id, name, nameEn, x, y, radius, teeth, spokes, rate], index) => {
    wheel(id, name, nameEn, x, y, 0.005 - index * 0.009, radius, teeth, spokes, rate, id === 'escape');
    pinion(`${id}-pinion`, `${name}小齿轴`, x, y, -0.03 - index * 0.006, 0.051 - index * 0.004, index === 3 ? 7 : 8, rate);
  });

  bridge('barrel-bridge', '发条盒夹板', 'Barrel bridge', [
    [-1.39, 0.61], [-1.30, 0.82], [-1.01, 1.12], [-0.74, 1.15],
    [-0.48, 0.98], [-0.46, 0.79], [-0.64, 0.59], [-1.02, 0.52],
  ], -0.087, 'IWC · 82200');
  bridge('train-bridge', '走时轮系夹板', 'Going-train bridge', [
    [0.01, 0.48], [0.24, 0.48], [0.32, 0.04], [0.64, -0.17],
    [0.83, -0.29], [0.81, -0.44], [0.61, -0.48], [0.35, -0.24],
    [0.27, -0.57], [0.31, -0.94], [0.18, -1.05], [0.04, -0.93],
    [0.09, -0.56], [0.09, -0.19], [-0.03, 0.12],
  ], -0.10, null);
  bridge('balance-cock', '摆轮夹板', 'Balance cock', [
    [-1.43, -0.57], [-1.34, -0.75], [-1.17, -0.65],
    [-0.91, -0.47], [-0.86, -0.35], [-1.02, -0.29], [-1.21, -0.45],
  ], -0.12, null);
  bridge('winding-bridge', '自动上链夹板', 'Automatic winding bridge', [
    [0.52, 0.66], [0.54, 0.99], [0.70, 1.17], [0.95, 1.15],
    [1.22, 0.88], [1.32, 0.62], [1.15, 0.43], [0.90, 0.48], [0.73, 0.66],
  ], -0.102, 'PELLATON');

  // The balance, hairspring, lever and pallet stones are physically distinct.
  const balance = part('balance', '无卡度摆轮', 'Free-sprung balance',
    '镂空金属摆轮以 4 Hz 往复摆动，对应 28,800 次/小时的振频；摆轮、游丝和擒纵叉可分别查看。',
    '镀金铜合金 / 精磨钢轴', -0.98, -0.38, -0.035, 1.08);
  balance.add(cylinder(0.40, 0.024, gold, 72, 0.365));
  const balanceOuter = new THREE.Mesh(new THREE.TorusGeometry(0.392, 0.009, 7, 96), gold);
  balance.add(balanceOuter);
  for (let i = 0; i < 3; i++) {
    const angle = i * TAU / 3;
    const spoke = bevelledBar(0.335, 0.032, 0.022, brass);
    spoke.position.set(Math.cos(angle) * 0.19, Math.sin(angle) * 0.19, 0);
    spoke.rotation.z = angle;
    balance.add(spoke);
    const weight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, 0.026), gold);
    weight.position.set(Math.cos(angle + 0.25) * 0.376, Math.sin(angle + 0.25) * 0.376, 0);
    weight.rotation.z = angle + 0.25;
    balance.add(weight);
  }
  balance.add(cylinder(0.043, 0.041, polished, 24));
  balance.add(cylinder(0.011, 0.11, polished, 14));

  const hairspring = part('hairspring', '螺旋游丝', 'Balance hairspring',
    '六圈同心螺旋游丝与摆轮协同摆动。细管几何表现游丝的连续实体曲线。',
    '弹性合金 / 蓝钢视觉处理', -0.98, -0.38, -0.075, 1.27);
  const hairPoints = [];
  for (let i = 0; i <= 420; i++) {
    const t = i / 420;
    const angle = t * TAU * 6;
    const radius = 0.045 + t * 0.242;
    hairPoints.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
  }
  hairspring.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hairPoints), 420, 0.0024, 4, false), blueSteel));
  const stud = part('hairspring-stud', '游丝外桩', 'Hairspring stud',
    '游丝外端固定于独立外桩，游丝在其内侧振荡。',
    '抛光钢', -0.691, -0.38, -0.09, 1.38);
  stud.add(cylinder(0.023, 0.045, polished, 18));
  const regulator = part('regulator', '微调偏心轮', 'Fine adjustment eccentric',
    '夹板上的偏心调节件展示精密调校结构；此造型为可视化演绎。',
    '抛光钢 / 激光刻度', -1.20, -0.49, -0.145, 1.43);
  regulator.add(cylinder(0.045, 0.015, polished, 28));
  const regSlot = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.007, 0.002), darkSteel);
  regSlot.position.z = -0.01;
  regulator.add(regSlot);

  const lever = part('pallet-fork', '擒纵叉', 'Pallet lever',
    '擒纵叉将擒纵轮的周期释放传至摆轮，叉瓦由独立合成红宝石组件构成。',
    '抛光钢', -0.69, -0.56, -0.052, 1.1);
  const leverShape = new THREE.Shape();
  [[-0.12,0.13],[-0.09,0.11],[-0.055,0.025],[0.01,-0.045],[0.115,-0.07],[0.135,-0.13],
    [0.095,-0.14],[0.08,-0.10],[-0.015,-0.08],[-0.09,-0.005],[-0.145,0.09]].forEach(([x,y], i) => {
    if (i === 0) leverShape.moveTo(x,y); else leverShape.lineTo(x,y);
  });
  leverShape.closePath();
  lever.add(new THREE.Mesh(extrude(leverShape, 0.013, 0.0015, 5), polished));
  lever.add(cylinder(0.025, 0.035, polished, 16));
  [
    [-0.575, -0.678, -0.048, 0.4], [-0.802, -0.455, -0.048, -0.55],
  ].forEach(([x, y, z, angle], i) => {
    const pallet = part(`pallet-stone-${i + 1}`, `擒纵叉瓦 ${i + 1}`, 'Ruby pallet stone',
      '长方体合成红宝石叉瓦，展示擒纵接触面的立体结构。',
      '合成红宝石', x, y, z, 1.5 + i * 0.12);
    pallet.add(new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.022, 0.024), ruby));
    pallet.rotation.z = angle;
  });

  // Pawl winding is represented by ceramic contact pieces and an eccentric.
  wheel('winding-wheel', '自动上链轮', 'Automatic winding wheel', 0.98, 0.74, -0.015, 0.245, 42, 5, TAU / 210);
  wheel('reduction-wheel', '上链减速轮', 'Reduction wheel', 0.56, 0.80, 0.004, 0.19, 36, 5, -TAU / 340);
  wheel('ratchet-wheel', '棘轮', 'Ratchet wheel', -0.13, 0.90, -0.019, 0.205, 40, 4, -TAU / 480);
  const eccentric = part('eccentric', '上链偏心轮', 'Pellaton-style eccentric',
    '偏心轮驱动双向棘爪上链机构；形态参考啄木鸟自动上链原理。',
    '耐磨陶瓷 / 抛光钢', 0.30, 0.65, -0.059, 0.98);
  eccentric.add(cylinder(0.105, 0.027, ceramic, 40, 0.024));
  const eccentricPin = cylinder(0.025, 0.036, polished, 20);
  eccentricPin.position.set(0.05, 0, -0.009);
  eccentric.add(eccentricPin);
  animations.push({ object: eccentric, rate: TAU / 35, offset: 0 });
  [-1, 1].forEach((sign, i) => {
    const pawl = part(`winding-pawl-${i + 1}`, `自动上链棘爪 ${i + 1}`, 'Ceramic winding pawl',
      '双棘爪机构将摆陀两个方向的转动转换为单向上链，深色接触部件表现耐磨陶瓷材质。',
      '陶瓷接触片 / 钢制支臂', 0.54, 0.56 + sign * 0.09, -0.068, 1.12 + i * 0.1);
    const arm = bevelledBar(0.31, 0.034, 0.019, polished);
    arm.rotation.z = sign * 0.24;
    pawl.add(arm);
    const tip = bevelledBar(0.07, 0.04, 0.025, ceramic);
    tip.position.set(0.145, sign * 0.035, -0.004);
    tip.rotation.z = sign * 0.5;
    pawl.add(tip);
    pawl.add(cylinder(0.018, 0.028, polished, 16));
  });

  // Independently selectable jewels and settings sit on top of the bridges.
  [
    ['barrel', -0.72, 0.72, -0.113, 0.038],
    ['center', 0.15, 0.30, -0.125, 0.035],
    ['third', 0.68, -0.35, -0.125, 0.032],
    ['fourth', 0.18, -0.92, -0.125, 0.032],
    ['escape', -0.49, -0.79, -0.053, 0.028],
    ['balance', -0.98, -0.38, -0.146, 0.042],
    ['winding', 0.98, 0.74, -0.127, 0.031],
    ['reduction', 0.56, 0.80, -0.127, 0.028],
  ].forEach(args => jewel(...args));

  [
    ['01', -1.25, 0.68, -0.116, 1.15],
    ['02', -0.80, 1.055, -0.116, 1.1],
    ['03', -0.51, 0.855, -0.116, 0.88],
    ['04', 0.13, 0.435, -0.13, 0.85],
    ['05', 0.745, -0.30, -0.13, 0.8],
    ['06', 0.20, -1.0, -0.13, 0.77],
    ['07', -1.325, -0.62, -0.15, 1.2, true],
    ['08', 1.18, 0.68, -0.132, 1],
    ['09', 0.79, 1.08, -0.132, 1.1],
    ['10', 0.59, 0.97, -0.132, 0.8],
    ['11', -1.43, -0.15, 0.055, 1],
    ['12', -0.95, -1.11, 0.055, 1],
    ['13', 0.88, -1.10, 0.055, 1],
    ['14', 1.43, 0.14, 0.055, 1],
    ['15', 0.05, 1.45, 0.055, 1],
    ['16', -0.27, 1.29, 0.055, 0.8],
    ['17', -0.18, -0.40, 0.055, 0.8],
    ['18', 1.15, -0.64, 0.055, 0.8],
  ].forEach(args => screw(...args));

  // A wide, openworked half-rotor leaves the movement visible through the back.
  const rotor = part('rotor', '镂空自动上链摆陀', 'Openworked automatic rotor',
    '半圆形摆陀由镂空支臂与外缘配重组成，随时间缓慢转动。IWC / 82200 字样朝向透底表背。',
    '缎面精钢 / 高密度外缘配重', 0, 0, -0.215, 2.05);
  const rotorWeight = new THREE.Mesh(extrude(sectorShape(1.26, 1.54, Math.PI * 1.03, Math.PI * 1.97), 0.039, 0.005, 72), steel);
  rotor.add(rotorWeight);
  const outerBead = new THREE.Mesh(new THREE.TorusGeometry(1.505, 0.013, 8, 80, Math.PI * 0.94), polished);
  outerBead.rotation.z = Math.PI * 1.03;
  rotor.add(outerBead);
  const innerBead = new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.007, 6, 80, Math.PI * 0.94), polished);
  innerBead.rotation.z = Math.PI * 1.03;
  innerBead.position.z = -0.023;
  rotor.add(innerBead);
  for (const angle of [Math.PI * 1.08, Math.PI * 1.5, Math.PI * 1.92]) {
    const arm = bevelledBar(1.18, angle === Math.PI * 1.5 ? 0.22 : 0.10, 0.035, steel);
    arm.rotation.z = angle;
    arm.position.set(Math.cos(angle) * 0.72, Math.sin(angle) * 0.72, 0.008);
    rotor.add(arm);
  }
  rotor.add(cylinder(0.19, 0.044, steel, 48, 0.102));
  const rotorMark = engraving('IWC\nSCHAFFHAUSEN', 0.46, 0.155, '#454842', 82);
  rotorMark.position.set(0, -1.405, -0.027);
  rotor.add(rotorMark);
  const calibreMark = engraving('82200', 0.22, 0.08, '#57594f', 85);
  calibreMark.position.set(0, -0.68, -0.016);
  rotor.add(calibreMark);
  for (let i = 0; i < 9; i++) {
    const angle = Math.PI * (1.1 + i * 0.1);
    const dot = cylinder(0.007, 0.002, darkSteel, 10);
    dot.position.set(Math.cos(angle) * 1.44, Math.sin(angle) * 1.44, -0.023);
    rotor.add(dot);
  }

  const bearing = part('rotor-bearing', '摆陀滚珠轴承', 'Rotor ball bearing',
    '双圈轴承与十二枚钢珠为三维实体，维持自动摆陀顺畅旋转。',
    '硬化轴承钢 / 镜面钢珠', 0, 0, -0.204, 1.8);
  bearing.add(cylinder(0.10, 0.052, polished, 48, 0.077));
  bearing.add(cylinder(0.047, 0.055, polished, 32, 0.026));
  const ballGeometry = new THREE.SphereGeometry(0.0145, 10, 8);
  for (let i = 0; i < 12; i++) {
    const angle = i * TAU / 12;
    const ball = new THREE.Mesh(ballGeometry, polished);
    ball.position.set(Math.cos(angle) * 0.063, Math.sin(angle) * 0.063, -0.012);
    bearing.add(ball);
  }
  screw('rotor', 0, 0, -0.238, 1.1, true);

  // Selection works on any descendant; each assembly lives directly under root.
  for (const item of parts) consolidateComponent(item.object);
  root.traverse(object => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  for (const item of parts) {
    item.object.userData.partId = item.id;
    item.object.traverse(child => {
      child.userData.partId = item.id;
    });
  }

  return {
    root,
    parts,
    stats: {
      parts: parts.length,
      frequency: 4,
      beatRate: 28800,
      interpretation: 'Stylized mechanical reconstruction inspired by IWC calibre 82200; not manufacturing CAD.',
    },
    tick(elapsed) {
      for (const animation of animations) {
        animation.object.rotation.z = animation.offset + elapsed * animation.rate;
      }
      const oscillation = Math.sin(elapsed * TAU * 4);
      balance.rotation.z = oscillation * 2.8;
      hairspring.rotation.z = oscillation * 0.12;
      const springScale = 1 + oscillation * 0.035;
      hairspring.scale.set(springScale, springScale, 1);
      lever.rotation.z = Math.tanh(oscillation * 3) * 0.10;
      rotor.rotation.z = 0.17 + Math.sin(elapsed * 0.27) * 0.39 + Math.sin(elapsed * 0.11) * 0.13;
    },
  };
}
