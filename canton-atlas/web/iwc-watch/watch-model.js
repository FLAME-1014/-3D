import * as THREE from 'three';

// Procedural visual reference: IWC Portugieser Automatic 40, IW358303.
// One model unit equals 10 mm. This is an independently modelled educational
// interpretation, not manufacturer CAD or a service/assembly drawing.
const TAU = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function seededRandom(seed = 158024) {
  return () => {
    seed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    seed ^= seed + Math.imul(seed ^ (seed >>> 7), 61 | seed);
    return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(size, paint, color = true) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  paint(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function brushedTexture() {
  return canvasTexture(512, (ctx, n) => {
    const random = seededRandom(143);
    ctx.fillStyle = '#929292';
    ctx.fillRect(0, 0, n, n);
    for (let i = 0; i < 2800; i++) {
      const y = random() * n;
      const light = 105 + random() * 75;
      ctx.strokeStyle = `rgba(${light},${light},${light},${0.08 + random() * 0.2})`;
      ctx.lineWidth = 0.25 + random() * 0.55;
      ctx.beginPath();
      ctx.moveTo(random() * n, y);
      ctx.lineTo(random() * n, y + random() * 0.5);
      ctx.stroke();
    }
  }, false);
}

function leatherTexture() {
  return canvasTexture(1024, (ctx, n) => {
    const random = seededRandom(7284);
    ctx.fillStyle = '#080f19';
    ctx.fillRect(0, 0, n, n);
    const columns = [0, 120, 290, 522, 755, 905, 1024];
    for (let column = 0; column < columns.length - 1; column++) {
      let y = -60 + (column % 2) * 60;
      while (y < n) {
        const h = 98 + random() * 104;
        const x1 = columns[column] + 5;
        const x2 = columns[column + 1] - 5;
        const inset = 8 + random() * 6;
        const gradient = ctx.createLinearGradient(x1, y, x2, y + h);
        gradient.addColorStop(0, '#1d293b');
        gradient.addColorStop(0.3, '#162131');
        gradient.addColorStop(1, '#0b1320');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(x1 + inset, y + 6);
        ctx.bezierCurveTo(x1 + (x2 - x1) * 0.4, y + 1, x2 - inset, y + 4, x2 - 3, y + inset);
        ctx.bezierCurveTo(x2 + 2, y + h * 0.4, x2 - 3, y + h * 0.7, x2 - inset, y + h - 9);
        ctx.bezierCurveTo(x2 - (x2 - x1) * 0.4, y + h - 1, x1 + inset, y + h - 3, x1 + 2, y + h - inset);
        ctx.bezierCurveTo(x1 - 2, y + h * 0.6, x1 + 1, y + h * 0.3, x1 + inset, y + 6);
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = '#344153';
        ctx.stroke();
        y += h;
      }
    }
    for (let i = 0; i < 35000; i++) {
      const v = random() > 0.5 ? 145 : 0;
      ctx.fillStyle = `rgba(${v},${v},${v},${random() * 0.12})`;
      ctx.fillRect(random() * n, random() * n, 0.8, 0.8 + random());
    }
  });
}

function textTexture(text, { width = 1024, height = 256, font = 'Arial', weight = 400, color = '#172133', spacing = 0, size = 150 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (spacing) {
    const chars = [...text];
    const widths = chars.map(char => ctx.measureText(char).width);
    let x = (width - widths.reduce((a, b) => a + b, 0) - spacing * (chars.length - 1)) / 2;
    ctx.textAlign = 'left';
    chars.forEach((char, i) => {
      ctx.fillText(char, x, height / 2 + size * 0.035);
      x += widths[i] + spacing;
    });
  } else {
    ctx.fillText(text, width / 2, height / 2 + size * 0.035);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function label(text, width, height, options) {
  const material = new THREE.MeshStandardMaterial({
    map: textTexture(text, options),
    transparent: true,
    alphaTest: 0.05,
    depthWrite: false,
    roughness: 0.65,
    metalness: 0.1,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
}

function simplifyContour(points, tolerance = 0.55) {
  if (points.length < 5) return points;
  // Remove collinear pixel edges before simplifying the raster outline.
  const clean = points.filter((p, i) => {
    const a = points[(i + points.length - 1) % points.length];
    const b = points[(i + 1) % points.length];
    return (p.x - a.x) * (b.y - p.y) !== (p.y - a.y) * (b.x - p.x);
  });
  const simplify = arr => {
    if (arr.length <= 2) return arr;
    const a = arr[0], b = arr[arr.length - 1];
    let maxDistance = 0, index = 0;
    const denominator = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    for (let i = 1; i < arr.length - 1; i++) {
      const p = arr[i];
      const d = Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x) / denominator;
      if (d > maxDistance) { maxDistance = d; index = i; }
    }
    return maxDistance > tolerance
      ? [...simplify(arr.slice(0, index + 1)).slice(0, -1), ...simplify(arr.slice(index))]
      : [a, b];
  };
  const half = Math.floor(clean.length / 2);
  return [...simplify(clean.slice(0, half + 1)).slice(0, -1), ...simplify([...clean.slice(half), clean[0]]).slice(0, -1)];
}

// Raster outlines are traced once into real bevelled metal geometry.
// This keeps the Arabic numerals independent from installed font loaders.
function numeralGeometry(text, width, height) {
  const size = 160;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.font = `400 ${text.length > 1 ? 110 : 135}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size / 2, size / 2 + 3);
  const pixels = ctx.getImageData(0, 0, size, size).data;
  const filled = (x, y) => x >= 0 && y >= 0 && x < size && y < size && pixels[(y * size + x) * 4 + 3] >= 110;
  const edges = new Map();
  let minX = size, minY = size, maxX = 0, maxY = 0;
  const key = (x, y) => `${x},${y}`;
  const edge = (ax, ay, bx, by) => {
    const k = key(ax, ay);
    if (!edges.has(k)) edges.set(k, []);
    edges.get(k).push({ x: bx, y: by });
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!filled(x, y)) continue;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x + 1);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y + 1);
      if (!filled(x, y - 1)) edge(x, y, x + 1, y);
      if (!filled(x + 1, y)) edge(x + 1, y, x + 1, y + 1);
      if (!filled(x, y + 1)) edge(x + 1, y + 1, x, y + 1);
      if (!filled(x - 1, y)) edge(x, y + 1, x, y);
    }
  }
  const path = new THREE.ShapePath();
  while (edges.size) {
    const startKey = edges.keys().next().value;
    const [sx, sy] = startKey.split(',').map(Number);
    let currentKey = startKey;
    const contour = [{ x: sx, y: sy }];
    for (let count = 0; count < size * size; count++) {
      const nexts = edges.get(currentKey);
      if (!nexts?.length) break;
      const next = nexts.pop();
      if (!nexts.length) edges.delete(currentKey);
      currentKey = key(next.x, next.y);
      if (currentKey === startKey) break;
      contour.push(next);
    }
    if (contour.length < 4) continue;
    const outline = simplifyContour(contour);
    outline.forEach((p, i) => {
      const x = ((p.x - minX) / (maxX - minX) - 0.5) * width;
      const y = (0.5 - (p.y - minY) / (maxY - minY)) * height;
      if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
    });
    path.currentPath.closePath();
  }
  return new THREE.ExtrudeGeometry(path.toShapes(false), {
    depth: 0.014,
    bevelEnabled: true,
    bevelSize: 0.0027,
    bevelThickness: 0.0027,
    bevelSegments: 2,
    curveSegments: 3,
    steps: 1,
  });
}

function lathe(points, segments = 128) {
  const geometry = new THREE.LatheGeometry(points.map(p => new THREE.Vector2(p[0], p[1])), segments);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

function discGeometry(radius, depth, segments = 96) {
  const geometry = new THREE.CylinderGeometry(radius, radius, depth, segments);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

function tubeBetween(a, b, radius, material, segments = 8) {
  const delta = b.clone().sub(a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), segments), material);
  mesh.quaternion.setFromUnitVectors(Y_AXIS, delta.normalize());
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  return mesh;
}

function leafGeometry(length, width) {
  const shape = new THREE.Shape();
  shape.moveTo(0, length);
  shape.bezierCurveTo(width * 0.1, length * 0.83, width, length * 0.58, width * 0.76, length * 0.39);
  shape.bezierCurveTo(width * 0.6, length * 0.22, width * 0.35, 0.09, width * 0.31, -0.12);
  shape.quadraticCurveTo(0, -0.215, -width * 0.31, -0.12);
  shape.bezierCurveTo(-width * 0.35, 0.09, -width * 0.6, length * 0.22, -width * 0.76, length * 0.39);
  shape.bezierCurveTo(-width, length * 0.58, -width * 0.1, length * 0.83, 0, length);
  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.012, bevelEnabled: true, bevelThickness: 0.0045, bevelSize: 0.004,
    bevelSegments: 2, curveSegments: 18, steps: 1,
  });
}

function subdivideForCurve(source, maxEdge = .17) {
  // Curving a large triangulated cap without subdivisions produces visible
  // diagonal folds. Split the longest edge while preserving holes and groups.
  const geometry = source.index ? source.toNonIndexed() : source;
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const output = [], coordinates = [], groups = [];
  const vertex = index => [position.getX(index), position.getY(index), position.getZ(index), uv.getX(index), uv.getY(index)];
  const edgeLength = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const split = (a, b, c, depth) => {
    const ab = edgeLength(a, b), bc = edgeLength(b, c), ca = edgeLength(c, a);
    if (Math.max(ab, bc, ca) <= maxEdge || depth >= 10) {
      for (const point of [a, b, c]) {
        output.push(point[0], point[1], point[2]);
        coordinates.push(point[3], point[4]);
      }
      return;
    }
    const mid = (p, q) => p.map((n, index) => (n + q[index]) / 2);
    if (ab >= bc && ab >= ca) {
      const m = mid(a, b); split(a, m, c, depth + 1); split(m, b, c, depth + 1);
    } else if (bc >= ca) {
      const m = mid(b, c); split(a, b, m, depth + 1); split(a, m, c, depth + 1);
    } else {
      const m = mid(c, a); split(a, b, m, depth + 1); split(m, b, c, depth + 1);
    }
  };
  for (const group of geometry.groups.length ? geometry.groups : [{ start: 0, count: position.count, materialIndex: 0 }]) {
    const start = output.length / 3;
    for (let i = group.start; i < group.start + group.count; i += 3) split(vertex(i), vertex(i + 1), vertex(i + 2), 0);
    groups.push({ start, count: output.length / 3 - start, materialIndex: group.materialIndex });
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(output, 3));
  result.setAttribute('uv', new THREE.Float32BufferAttribute(coordinates, 2));
  for (const group of groups) result.addGroup(group.start, group.count, group.materialIndex);
  result.computeVertexNormals();
  source.dispose();
  return result;
}

function batchStaticMeshes(group) {
  // Keep every registered component independent while batching its decorative
  // surfaces. In particular, 124 stitches do not need 124 draw calls.
  const buckets = new Map();
  for (const object of group.children) {
    if (!object.isMesh || Array.isArray(object.material) || object.material.transparent) continue;
    const key = object.material.uuid;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(object);
  }
  for (const objects of buckets.values()) {
    if (objects.length < 2) continue;
    const geometries = objects.map(object => {
      object.updateMatrix();
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      geometry.applyMatrix4(object.matrix);
      return geometry;
    });
    const geometry = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'uv']) {
      if (!geometries.every(source => source.attributes[name])) continue;
      const size = geometries[0].attributes[name].itemSize;
      const data = new Float32Array(geometries.reduce((sum, source) => sum + source.attributes[name].array.length, 0));
      let offset = 0;
      for (const source of geometries) {
        data.set(source.attributes[name].array, offset);
        offset += source.attributes[name].array.length;
      }
      geometry.setAttribute(name, new THREE.BufferAttribute(data, size));
    }
    geometry.computeBoundingSphere();
    const combined = new THREE.Mesh(geometry, objects[0].material);
    combined.castShadow = objects.some(object => object.castShadow);
    combined.receiveShadow = objects.some(object => object.receiveShadow);
    combined.name = `${group.name} · combined detail`;
    for (const object of objects) group.remove(object);
    group.add(combined);
    for (const source of geometries) source.dispose();
  }
}

export function createWatch() {
  const root = new THREE.Group();
  root.name = 'IWC Portugieser Automatic 40 · procedural reference';
  const parts = [];
  const brush = brushedTexture();
  brush.wrapS = brush.wrapT = THREE.RepeatWrapping;
  brush.repeat.set(2, 1);
  const leatherMap = leatherTexture();
  const materials = {
    steel: new THREE.MeshPhysicalMaterial({ color: 0xc8ced5, metalness: 1, roughness: 0.19, clearcoat: 0.24, clearcoatRoughness: 0.18, envMapIntensity: 1.05 }),
    brushed: new THREE.MeshStandardMaterial({ color: 0xadb6c1, metalness: 1, roughness: 0.31, bumpMap: brush, bumpScale: 0.0012, envMapIntensity: 0.95 }),
    brightSteel: new THREE.MeshStandardMaterial({ color: 0xe5e9ef, metalness: 1, roughness: 0.125, envMapIntensity: 1.15 }),
    blue: new THREE.MeshPhysicalMaterial({ color: 0x113566, metalness: 0.96, roughness: 0.23, clearcoat: 0.45, clearcoatRoughness: 0.12, envMapIntensity: 1.35 }),
    blueFacet: new THREE.MeshStandardMaterial({ color: 0x356395, metalness: 1, roughness: 0.24, envMapIntensity: 1.1 }),
    ink: new THREE.MeshStandardMaterial({ color: 0x1b2431, metalness: 0.1, roughness: 0.7 }),
    dial: new THREE.MeshStandardMaterial({ color: 0xf0efe9, metalness: 0.35, roughness: 0.49, bumpMap: brush, bumpScale: 0.0008 }),
    smallDial: new THREE.MeshStandardMaterial({ color: 0xd9dbd7, metalness: 0.48, roughness: 0.42 }),
    groove: new THREE.MeshStandardMaterial({ color: 0xb5bab8, metalness: 0.5, roughness: 0.46 }),
    leather: new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: leatherMap, bumpMap: leatherMap, bumpScale: 0.012, roughness: 0.54, clearcoat: 0.15, clearcoatRoughness: 0.4 }),
    leatherEdge: new THREE.MeshStandardMaterial({ color: 0x111824, roughness: 0.8 }),
    leatherLining: new THREE.MeshStandardMaterial({ color: 0x514239, roughness: 0.85, bumpMap: brush, bumpScale: 0.003 }),
    thread: new THREE.MeshStandardMaterial({ color: 0x777e87, roughness: 0.92 }),
    gasket: new THREE.MeshStandardMaterial({ color: 0x12181d, roughness: 0.89 }),
    sapphire: new THREE.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 0, roughness: 0.001, transmission: 1, thickness: 0.055,
      ior: 1.77, transparent: true, opacity: 1, depthWrite: false,
      attenuationColor: new THREE.Color(0xe3f1ff), attenuationDistance: 12,
      envMapIntensity: 0.6, specularIntensity: 0.45, clearcoat: 0.08, clearcoatRoughness: 0.03,
    }),
  };

  function part(id, name, nameEn, category, description, material, explode, position = [0, 0, 0], dimensions) {
    const object = new THREE.Group();
    object.name = nameEn;
    object.position.set(...position);
    object.userData.partId = id;
    root.add(object);
    const entry = { id, name, nameEn, category, description, material, dimensions, object, explode: new THREE.Vector3(...explode), basePosition: object.position.clone() };
    parts.push(entry);
    return object;
  }

  function mesh(parent, geometry, material, position = [0, 0, 0]) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(...position);
    m.castShadow = material !== materials.sapphire;
    m.receiveShadow = material !== materials.sapphire;
    parent.add(m);
    return m;
  }

  const caseBody = part('case-middle', '精钢表壳中框', 'Stainless steel case', 'case', '40.4 mm 抛光精钢表壳，侧壁以微细拉丝形成柔和的定向反光。内部中空，为独立机芯提供安装空间。', '316L 精钢 · 拉丝 / 抛光', [0, 0, 0], [0, 0, 0], 'Ø 40.4 mm');
  mesh(caseBody, lathe([[1.81, -.45], [1.87, -.50], [1.95, -.46], [2.008, -.34], [2.02, -.12], [2.012, .16], [1.98, .34], [1.93, .43], [1.81, .43], [1.785, .31], [1.785, -.38], [1.81, -.45]]), materials.brushed);
  const lowerLip = mesh(caseBody, new THREE.TorusGeometry(1.929, .025, 12, 128), materials.steel, [0, 0, -.452]);
  lowerLip.castShadow = false;

  const bezel = part('bezel', '抛光表圈', 'Polished bezel', 'case', '窄边弧面表圈以连续车削曲面建模。抛光外缘与拉丝中框形成清晰的光泽层次。', '316L 精钢 · 镜面抛光', [0, 0, 1.3], [0, 0, 0], 'Ø 39.7 mm');
  mesh(bezel, lathe([[1.773, .43], [1.944, .43], [1.985, .465], [1.968, .508], [1.906, .563], [1.804, .592], [1.781, .575], [1.763, .547], [1.763, .455], [1.773, .43]]), materials.steel);
  const frontSeal = part('front-gasket', '表镜密封垫圈', 'Crystal gasket', 'case', '位于蓝宝石表镜与表圈之间的环形密封组件。此可视化未模拟实际防水性能。', '合成橡胶', [0, 0, 1.62]);
  mesh(frontSeal, new THREE.TorusGeometry(1.775, .014, 8, 128), materials.gasket, [0, 0, .558]);
  const crystal = part('front-sapphire', '拱形蓝宝石表镜', 'Sapphire crystal', 'case', '采用物理透射材质模拟蓝宝石玻璃，折射率 1.77。微弧边缘保留透明层次与环境反射。', '蓝宝石玻璃 · IOR 1.77', [0, 0, 2.22], [0, 0, 0], '厚约 0.55 mm');
  const frontGlass = mesh(crystal, lathe([[0, .558], [1.745, .558], [1.768, .566], [1.785, .585], [1.777, .604], [1.757, .615], [0, .615]], 160), materials.sapphire);
  frontGlass.renderOrder = 8;
  crystal.userData.isGlass = true;

  const dial = part('silver-dial', '镀银主表盘', 'Silver plated dial', 'dial', '独立镀银表盘，细腻表面纹理承托立体阿拉伯数字。小秒盘位于六点钟方位。', '镀银黄铜 · 细纹饰面', [0, 0, .7], [0, 0, 0], 'Ø 35.7 mm');
  mesh(dial, discGeometry(1.785, .055, 128), materials.dial, [0, 0, .4025]);
  const iwc = label('IWC', .61, .24, { width: 512, font: 'Georgia', size: 194, weight: 700 });
  iwc.position.set(0, .735, .433);
  dial.add(iwc);
  const brand = label('SCHAFFHAUSEN', .86, .11, { size: 113, spacing: 8, weight: 500 });
  brand.position.set(0, .555, .434);
  dial.add(brand);
  const automatic = label('AUTOMATIC', .58, .087, { size: 103, spacing: 15, weight: 400 });
  automatic.position.set(0, -.244, .434);
  dial.add(automatic);
  const swiss = label('SWISS   MADE', .45, .058, { size: 98, spacing: 9 });
  swiss.position.set(0, -1.625, .434);
  dial.add(swiss);

  const chapter = part('chapter-ring', '轨道式分钟刻度', 'Minute chapter ring', 'dial', '60 个独立几何刻度构成分钟轨道，整五分钟位置加长。刻度与指针长度按实际读时关系布置。', '深蓝印记 · 几何刻度', [0, 0, 1.01]);
  const minuteGeometry = new THREE.BoxGeometry(.010, .049, .006);
  const hourGeometry = new THREE.BoxGeometry(.015, .082, .008);
  for (let i = 0; i < 60; i++) {
    const angle = i * TAU / 60;
    const index = mesh(chapter, i % 5 ? minuteGeometry : hourGeometry, materials.ink, [Math.sin(angle) * 1.655, Math.cos(angle) * 1.655, .436]);
    index.rotation.z = -angle;
    index.castShadow = false;
  }
  mesh(chapter, new THREE.TorusGeometry(1.707, .003, 5, 180), materials.ink, [0, 0, .434]);
  mesh(chapter, new THREE.TorusGeometry(1.602, .002, 5, 180), materials.groove, [0, 0, .434]);

  for (let number = 1; number <= 12; number++) {
    if (number === 6) continue;
    const angle = number * TAU / 12;
    const x = Math.sin(angle) * 1.355;
    const y = Math.cos(angle) * 1.355;
    const numeral = part(`numeral-${number}`, `${number} 时立体数字`, `Applied Arabic ${number}`, 'dial', '根据字形轮廓生成的独立立体数字，具有实体侧壁与微倒角。抛光深蓝表面在转动时呈现不同反光。', '蓝色金属 · 立体抛光', [x * .22, y * .22, 1.12 + number * .014], [x, y, .439]);
    mesh(numeral, numeralGeometry(String(number), number > 9 ? .354 : number === 1 ? .105 : .202, .302), materials.blue);
  }

  const secondsDial = part('small-seconds-dial', '小秒盘', 'Small seconds subdial', 'dial', '六点方向的下沉式小秒盘，以多层同心纹理与独立分钟轨道呈现机械仪表的精细层次。', '镀银黄铜 · 同心圆纹', [0, -.25, .9], [0, -.83, 0], 'Ø 9.6 mm');
  mesh(secondsDial, discGeometry(.478, .008), materials.smallDial, [0, 0, .435]);
  for (let ring = 1; ring <= 24; ring++) {
    const line = mesh(secondsDial, new THREE.TorusGeometry(.025 + ring * .0174, .00125, 4, 80), materials.groove, [0, 0, .441]);
    line.castShadow = false;
  }
  mesh(secondsDial, new THREE.TorusGeometry(.477, .005, 6, 96), materials.groove, [0, 0, .44]);
  const secondsTrack = part('small-seconds-track', '小秒盘刻度', 'Small seconds scale', 'dial', '60 秒刻度与四组方位数字分开建模，秒针每 60 秒连续扫动一周。', '深蓝刻度', [0, -.25, 1.17], [0, -.83, 0]);
  const secondMarker = new THREE.BoxGeometry(.005, .023, .003);
  const secondMajor = new THREE.BoxGeometry(.009, .042, .003);
  for (let i = 0; i < 60; i++) {
    const angle = i * TAU / 60;
    const index = mesh(secondsTrack, i % 5 ? secondMarker : secondMajor, materials.ink, [Math.sin(angle) * .427, Math.cos(angle) * .427, .447]);
    index.rotation.z = -angle;
    index.castShadow = false;
  }
  for (const [text, x, y] of [['60', 0, .335], ['15', .33, 0], ['30', 0, -.335], ['45', -.33, 0]]) {
    const number = label(text, .12, .085, { width: 256, height: 192, size: 140, font: 'Arial' });
    number.position.set(x, y, .45);
    secondsTrack.add(number);
  }

  function makeHand(id, name, nameEn, length, width, z, explosion) {
    const group = part(id, name, nameEn, 'hands', '实体叶形指针，主体、倒角与中心轴孔分别塑造。与系统时间同步，包含毫秒分量并连续运动。', '热蓝钢 · 抛光切面', explosion, [0, 0, z]);
    mesh(group, leafGeometry(length, width), materials.blue);
    const ridgeShape = new THREE.Shape();
    ridgeShape.moveTo(-.003, -.11);
    ridgeShape.lineTo(-width * .14, length * .45);
    ridgeShape.lineTo(0, length * .94);
    ridgeShape.lineTo(.005, length * .45);
    ridgeShape.closePath();
    mesh(group, new THREE.ShapeGeometry(ridgeShape), materials.blueFacet, [0, 0, .017]);
    mesh(group, new THREE.TorusGeometry(.054, .014, 8, 32), materials.blue, [0, 0, .006]);
    return group;
  }
  const hourHand = makeHand('hour-hand', '叶形时针', 'Blued steel hour hand', 1.065, .061, .486, [0, 0, 1.48]);
  const minuteHand = makeHand('minute-hand', '叶形分针', 'Blued steel minute hand', 1.525, .047, .529, [0, 0, 1.76]);
  const secondHand = part('second-hand', '小秒针', 'Small seconds hand', 'hands', '六点钟小秒盘上的真实立体秒针，每分钟扫动一周。角度由系统时间的秒与毫秒计算。', '热蓝钢', [0, -.25, 1.43], [0, -.83, .472]);
  const secondsShape = new THREE.Shape();
  secondsShape.moveTo(0, .404);
  secondsShape.lineTo(.012, .08);
  secondsShape.lineTo(.014, -.092);
  secondsShape.quadraticCurveTo(0, -.123, -.014, -.092);
  secondsShape.lineTo(-.012, .08);
  secondsShape.closePath();
  mesh(secondHand, new THREE.ExtrudeGeometry(secondsShape, { depth: .008, bevelEnabled: true, bevelSize: .002, bevelThickness: .002, bevelSegments: 1 }), materials.blue);
  mesh(secondHand, discGeometry(.029, .015, 32), materials.blue, [0, 0, .008]);
  mesh(secondHand, discGeometry(.011, .006, 20), materials.brightSteel, [0, 0, .019]);
  const centerPin = part('central-pinion-cap', '中央轴帽', 'Hand pinion cap', 'hands', '覆盖时针和分针共轴连接位置的抛光中心帽，包含独立蓝钢中心与金属外圈。', '抛光精钢 / 蓝钢', [0, 0, 1.98], [0, 0, .563]);
  mesh(centerPin, discGeometry(.055, .021, 48), materials.steel);
  mesh(centerPin, discGeometry(.035, .025, 40), materials.blue, [0, 0, .004]);
  mesh(centerPin, new THREE.BoxGeometry(.032, .006, .0015), materials.ink, [0, 0, .017]);

  for (const signY of [1, -1]) {
    for (const signX of [1, -1]) {
      const name = `${signY > 0 ? '上' : '下'}${signX > 0 ? '右' : '左'}`;
      const lug = part(`lug-${signY > 0 ? 'upper' : 'lower'}-${signX > 0 ? 'right' : 'left'}`, `${name}弧形表耳`, `${signY > 0 ? 'Upper' : 'Lower'} ${signX > 0 ? 'right' : 'left'} lug`, 'case', '独立曲面表耳从表壳自然过渡至表带接口，抛光倒角沿外缘连续延伸。', '316L 精钢 · 抛光', [signX * .7, signY * .45, -.08]);
      const shape = new THREE.Shape();
      shape.moveTo(1.08, 1.47);
      shape.bezierCurveTo(1.26, 1.55, 1.31, 1.75, 1.265, 1.97);
      shape.bezierCurveTo(1.215, 2.27, 1.17, 2.43, 1.085, 2.49);
      shape.bezierCurveTo(.985, 2.535, .95, 2.46, .97, 2.36);
      shape.bezierCurveTo(1.015, 2.12, .98, 1.91, .88, 1.74);
      shape.closePath();
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: .16, bevelSize: .045, bevelThickness: .045, bevelSegments: 4, curveSegments: 20 });
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const y = positions.getY(i);
        positions.setXYZ(i, positions.getX(i) * signX, y * signY, positions.getZ(i) + .055 - Math.max(0, y - 1.5) * .40);
      }
      if (signX * signY < 0) {
        // Mirroring one axis changes triangle winding; reverse vertex order.
        for (let i = 0; i < positions.count; i += 3) {
          const ax = positions.getX(i), ay = positions.getY(i), az = positions.getZ(i);
          positions.setXYZ(i, positions.getX(i + 2), positions.getY(i + 2), positions.getZ(i + 2));
          positions.setXYZ(i + 2, ax, ay, az);
        }
      }
      geometry.computeVertexNormals();
      mesh(lug, geometry, materials.steel);
    }
    const bar = part(`springbar-${signY > 0 ? 'upper' : 'lower'}`, `${signY > 0 ? '上' : '下'}表带生耳`, `${signY > 0 ? 'Upper' : 'Lower'} spring bar`, 'strap', '连接表带与表耳的可伸缩金属杆，主体与两端弹簧头以独立几何体组成。', '不锈钢', [0, signY * .85, -.25], [0, signY * 2.26, -.19]);
    bar.add(tubeBetween(new THREE.Vector3(-.99, 0, 0), new THREE.Vector3(.99, 0, 0), .035, materials.brushed));
    bar.add(tubeBetween(new THREE.Vector3(-1.15, 0, 0), new THREE.Vector3(1.15, 0, 0), .019, materials.brightSteel));
  }

  function strapZ(y) { return -.20 - Math.pow(Math.max(0, y) / 2.98, 1.55) * .57; }
  function createStrap(sign) {
    const strap = part(`strap-${sign > 0 ? 'upper' : 'lower'}`, `${sign > 0 ? '上' : '下'}鳄鱼纹表带`, `${sign > 0 ? 'Upper' : 'Lower'} alligator leather strap`, 'strap', '深蓝鳄鱼纹皮革表带，具有程序化皮纹、微表面凹凸、独立边缘缝线与弯曲内衬。', '鳄鱼纹皮革 · 深午夜蓝', [0, sign * 1.38, -.42], [0, sign * 2.17, 0], '宽 20 mm');
    if (sign < 0) strap.rotation.z = Math.PI;
    const length = sign > 0 ? 2.77 : 2.98;
    const shape = new THREE.Shape();
    shape.moveTo(-.98, 0);
    shape.lineTo(.98, 0);
    shape.lineTo(.795, length - .27);
    shape.quadraticCurveTo(.77, length - .02, .49, length);
    shape.lineTo(-.49, length);
    shape.quadraticCurveTo(-.77, length - .02, -.795, length - .27);
    shape.closePath();
    if (sign < 0) {
      for (let i = 0; i < 5; i++) {
        const hole = new THREE.Path();
        hole.absellipse(0, 1.46 + i * .26, .041, .061, 0, TAU, true);
        shape.holes.push(hole);
      }
    }
    const geometry = subdivideForCurve(new THREE.ExtrudeGeometry(shape, { depth: .112, bevelEnabled: true, bevelSize: .027, bevelThickness: .025, bevelSegments: 3, curveSegments: 12, steps: 1 }));
    const positions = geometry.attributes.position;
    const uvs = geometry.attributes.uv;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i);
      positions.setZ(i, positions.getZ(i) + strapZ(y) + .035 * (1 - Math.min(1, Math.pow(x / .98, 2))));
      uvs.setXY(i, (x + 1) / 2, y / 2.98);
    }
    geometry.computeVertexNormals();
    const band = mesh(strap, geometry, [materials.leather, materials.leatherEdge]);
    // ExtrudeGeometry uses material 0 for front/back and 1 for the side wall.
    band.receiveShadow = true;
    const lining = geometry.clone();
    const liningPositions = lining.attributes.position;
    for (let i = 0; i < liningPositions.count; i++) liningPositions.setZ(i, liningPositions.getZ(i) - .017);
    mesh(strap, lining, materials.leatherLining);
    // Real thread geometry follows the curved leather surface.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 31; i++) {
        const y = .12 + i * (length - .41) / 30;
        const x = side * (.892 - y / length * .145);
        const a = new THREE.Vector3(x, y, strapZ(y) + .148);
        const b = new THREE.Vector3(x - side * .004, y + .042, strapZ(y + .042) + .148);
        strap.add(tubeBetween(a, b, .0055, materials.thread, 5));
      }
    }
    const rolled = part(`strap-end-${sign > 0 ? 'upper' : 'lower'}`, `${sign > 0 ? '上' : '下'}卷边接口`, `${sign > 0 ? 'Upper' : 'Lower'} rolled strap end`, 'strap', '围绕生耳形成的圆润皮革卷边，与表带主体独立，拆解后可观察连接方式。', '深蓝皮革', [0, sign * 1.04, -.15], [0, sign * 2.24, -.155]);
    rolled.add(tubeBetween(new THREE.Vector3(-.96, 0, 0), new THREE.Vector3(.96, 0, 0), .087, materials.leather, 24));
    return strap;
  }
  createStrap(1);
  createStrap(-1);

  for (let i = 0; i < 2; i++) {
    const y = 3.5 + i * .29;
    const loop = part(`keeper-${i + 1}`, `皮革表带环 ${i + 1}`, `Leather keeper ${i + 1}`, 'strap', '环抱表带的独立皮革固定环，具有可观察的厚度、侧面与表面纹理。', '深蓝皮革', [0, .8 + i * .2, .35], [0, y, strapZ(y - 2.17) + .08]);
    mesh(loop, new THREE.BoxGeometry(1.93, .185, .085, 8, 1, 1), materials.leather, [0, 0, .13]);
    mesh(loop, new THREE.BoxGeometry(1.93, .185, .05), materials.leatherEdge, [0, 0, -.14]);
    for (const x of [-.93, .93]) mesh(loop, new THREE.BoxGeometry(.085, .185, .25), materials.leather, [x, 0, 0]);
  }

  const buckle = part('buckle-frame', '精钢针扣框', 'Stainless steel pin buckle', 'strap', '弧面精钢针扣由独立扣框、扣针和横杆构成。边缘抛光处理与表壳保持一致。', '316L 精钢 · 抛光', [0, 1.75, -.30], [0, 4.89, -.72]);
  const buckleShape = new THREE.Shape();
  buckleShape.moveTo(-.92, -.20);
  buckleShape.lineTo(.92, -.20);
  buckleShape.quadraticCurveTo(1.01, -.20, 1.01, -.10);
  buckleShape.lineTo(1.01, .12);
  buckleShape.quadraticCurveTo(1.01, .26, .84, .26);
  buckleShape.lineTo(-.84, .26);
  buckleShape.quadraticCurveTo(-1.01, .26, -1.01, .12);
  buckleShape.lineTo(-1.01, -.10);
  buckleShape.quadraticCurveTo(-1.01, -.20, -.92, -.20);
  const buckleHole = new THREE.Path();
  buckleHole.moveTo(-.82, -.115);
  buckleHole.lineTo(-.82, .115);
  buckleHole.lineTo(.82, .115);
  buckleHole.lineTo(.82, -.115);
  buckleHole.closePath();
  buckleShape.holes.push(buckleHole);
  mesh(buckle, new THREE.ExtrudeGeometry(buckleShape, { depth: .10, bevelSize: .025, bevelThickness: .025, bevelSegments: 3 }), materials.steel);
  const buckleMark = label('IWC', .31, .085, { width: 512, height: 192, font: 'Georgia', weight: 700, size: 150 });
  buckleMark.position.set(.53, .186, .128);
  buckle.add(buckleMark);
  const buckleTongue = part('buckle-tongue', '精钢扣针', 'Buckle tongue', 'strap', '独立扣针与表带孔配合，细小弧形轮廓可以在拆解视图中单独查看。', '316L 精钢', [.25, 1.9, -.1], [0, 4.89, -.61]);
  buckleTongue.add(tubeBetween(new THREE.Vector3(0, -.20, -.015), new THREE.Vector3(0, .21, .035), .026, materials.steel, 12));

  const crownStem = part('crown-stem', '上链柄轴', 'Winding stem', 'case', '连接表冠与机芯侧面的细金属轴，用于说明上链与校时的传动位置。', '钢', [1.25, 0, -.05], [1.93, 0, -.02]);
  crownStem.add(tubeBetween(new THREE.Vector3(-.18, 0, 0), new THREE.Vector3(.31, 0, 0), .043, materials.brushed, 16));
  const crown = part('crown', '齿纹表冠', 'Fluted winding crown', 'case', '具有 48 道防滑齿纹的独立表冠，端面带有 IWC 标识与抛光边缘。', '316L 精钢 · 抛光', [1.65, 0, 0], [2.23, 0, -.02], 'Ø 5.0 mm');
  const crownBody = mesh(crown, lathe([[0, -.19], [.18, -.19], [.227, -.15], [.238, -.11], [.238, .13], [.215, .18], [.17, .195], [0, .195]], 96), materials.steel);
  crownBody.rotation.y = Math.PI / 2;
  for (let i = 0; i < 48; i++) {
    const angle = i * TAU / 48;
    const y = Math.cos(angle) * .238, z = Math.sin(angle) * .238;
    crown.add(tubeBetween(new THREE.Vector3(-.115, y, z), new THREE.Vector3(.12, y, z), .0085, materials.brushed, 5));
  }
  const crownFace = label('IWC', .28, .12, { width: 512, height: 256, font: 'Georgia', weight: 700, size: 170 });
  crownFace.position.x = .197;
  crownFace.rotation.y = Math.PI / 2;
  crown.add(crownFace);

  const caseback = part('caseback-ring', '透底表背环', 'Exhibition caseback ring', 'case', '带环形铭文的精钢表背，螺丝与蓝宝石视窗分别建模。机芯可以通过中央透底玻璃观察。', '316L 精钢 · 拉丝 / 抛光', [0, 0, -1.30]);
  mesh(caseback, lathe([[1.565, -.49], [1.90, -.49], [1.94, -.525], [1.921, -.572], [1.86, -.615], [1.596, -.615], [1.56, -.58], [1.565, -.49]]), materials.brushed);
  mesh(caseback, new THREE.TorusGeometry(1.58, .012, 8, 128), materials.steel, [0, 0, -.60]);
  mesh(caseback, new THREE.TorusGeometry(1.895, .011, 8, 128), materials.steel, [0, 0, -.578]);
  const engravingMap = canvasTexture(1024, (ctx, n) => {
    const text = 'IWC · SCHAFFHAUSEN · PORTUGIESER · AUTOMATIC · STAINLESS STEEL · SWISS MADE · ';
    ctx.translate(n / 2, n / 2);
    ctx.fillStyle = '#313b47';
    ctx.font = '500 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    [...text].forEach((char, i) => {
      const angle = i * TAU / text.length;
      ctx.save();
      ctx.rotate(angle);
      ctx.translate(0, -445);
      ctx.fillText(char, 0, 0);
      ctx.restore();
    });
  });
  const engraving = mesh(caseback, new THREE.PlaneGeometry(4.04, 4.04), new THREE.MeshStandardMaterial({ map: engravingMap, transparent: true, alphaTest: .15, roughness: .8, depthWrite: false }), [0, 0, -.617]);
  engraving.rotation.x = Math.PI;
  const rearGlass = part('rear-sapphire', '蓝宝石透底视窗', 'Sapphire exhibition back', 'case', '独立蓝宝石后盖视窗，允许观察自动摆陀、夹板和轮系。后盖与前表镜共用物理透射材质。', '蓝宝石玻璃 · IOR 1.77', [0, 0, -1.65]);
  const backGlass = mesh(rearGlass, lathe([[0, -.568], [1.555, -.568], [1.575, -.554], [1.56, -.528], [0, -.528]], 128), materials.sapphire);
  backGlass.renderOrder = 8;
  rearGlass.userData.isGlass = true;
  const rearSeal = part('caseback-gasket', '表背密封圈', 'Caseback gasket', 'case', '后盖与中框之间的独立环形密封件，可在拆解视图中观察其装配位置。', '合成橡胶', [0, 0, -1.03]);
  mesh(rearSeal, new THREE.TorusGeometry(1.825, .021, 8, 128), materials.gasket, [0, 0, -.494]);

  const screwHead = discGeometry(.048, .021, 28);
  const screwShaft = discGeometry(.024, .11, 16);
  const screwSlot = new THREE.BoxGeometry(.066, .010, .0025);
  for (let i = 0; i < 6; i++) {
    const angle = i * TAU / 6 + Math.PI / 6;
    const x = Math.sin(angle) * 1.748;
    const y = Math.cos(angle) * 1.748;
    const screw = part(`caseback-screw-${i + 1}`, `表背螺丝 ${i + 1}`, `Caseback screw ${i + 1}`, 'case', '独立平头精钢螺丝，包含一字槽、轴杆与微小螺纹环。可单独选中查看。', '抛光精钢', [x * .13, y * .13, -1.72 - i * .04], [x, y, -.611]);
    mesh(screw, screwHead, materials.steel);
    mesh(screw, screwShaft, materials.brushed, [0, 0, .06]);
    const slot = mesh(screw, screwSlot, materials.ink, [0, 0, -.0118]);
    slot.rotation.z = angle + .3;
    for (let thread = 0; thread < 5; thread++) mesh(screw, new THREE.TorusGeometry(.025, .003, 4, 16), materials.steel, [0, 0, .025 + thread * .017]);
  }

  for (const entry of parts) batchStaticMeshes(entry.object);
  root.traverse(object => {
    if (!object.isMesh) return;
    let parent = object.parent;
    while (parent && !parent.userData.partId) parent = parent.parent;
    if (parent) object.userData.partId = parent.userData.partId;
    if (object.material === materials.sapphire) object.userData.isGlass = true;
  });

  function tick(date = new Date()) {
    const seconds = date.getSeconds() + date.getMilliseconds() / 1000;
    const minutes = date.getMinutes() + seconds / 60;
    const hours = date.getHours() % 12 + minutes / 60;
    hourHand.rotation.z = -hours / 12 * TAU;
    minuteHand.rotation.z = -minutes / 60 * TAU;
    secondHand.rotation.z = -seconds / 60 * TAU;
  }
  tick();
  return {
    root, parts, hands: { hour: hourHand, minute: minuteHand, second: secondHand }, tick, materials,
    stats: { diameterMm: 40.4, thicknessMm: 12.3, sapphireIor: 1.77, outerParts: parts.length },
  };
}
