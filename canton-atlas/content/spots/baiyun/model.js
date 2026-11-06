/*
 * 白云山 · 摩星岭山顶段 · 风格化场地 diorama（博物馆展柜方向）
 * 契约：1 单位 = 1 米；Y 向上；原点在底面中心；北 = -Z。
 * 范围：摩星岭石门—吉星石—陡石级—锦绣南天牌坊—栈道/扶梯—山顶平台—星形指北碑—白亭 + 广州城市远景剪影。
 * 不是 21.8 km² 白云山 1:1，也不是 382m 高差实测；台地、城市与珠江均为压缩示意。
 */

const THREE = window.THREE;
if (!THREE) throw new Error("Three.js is not loaded");
const PAL = window.CantonPalette;
if (!PAL) throw new Error("Canton palette is not loaded");

const SITE_W = 120;
const SITE_D = 90;
const BASE_Y = 0.9;
const GROUND_Y = 1.02;

const GATE_Z = 22.5;
const LOWER_Z0 = 21.0;
const LOWER_Z1 = 7.0;
const MID_Y = 7.2;
const UPPER_Z0 = -1.0;
const UPPER_Z1 = -13.0;
const SUMMIT_Y = 13.2;
const SUMMIT_Z = -22.5;
const STAR_Z = -23.5;
const PAVILION_X = 9.8;
const PAVILION_Z = -26.0;

// 台地：z0 为南侧、z1 为北侧，top 为台面标高；inner 为靠石级的内边
const TERRACES = [
  { z0: 21.0, z1: 17.2, top: 3.4, inner: 5.2 },
  { z0: 17.2, z1: 13.2, top: 5.1, inner: 5.2 },
  { z0: 13.2, z1: 9.2, top: 6.7, inner: 5.2 },
  { z0: 9.2, z1: 7.0, top: 7.2, inner: 6.4 },
  { z0: 7.0, z1: -1.0, top: 7.2, inner: 6.4 },
  { z0: -1.0, z1: -5.0, top: 9.3, inner: 5.2 },
  { z0: -5.0, z1: -9.0, top: 11.2, inner: 5.2 },
  { z0: -9.0, z1: -13.0, top: 13.2, inner: 8.2 },
  { z0: -13.0, z1: -28.5, top: 13.2, inner: 8.2 }
];

let seed = 382;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
function range(a, b) {
  return a + (b - a) * random();
}

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function colorTexture(canvas, repeatX, repeatY) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX || 1, repeatY || 1);
  t.anisotropy = 4;
  if ("colorSpace" in t && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  else if ("encoding" in t && THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
  return t;
}

/* ---------------- 贴图 ---------------- */

function makeStone(base, speck) {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1500; i++) {
    ctx.fillStyle = "rgba(" + speck + "," + range(0.03, 0.13).toFixed(3) + ")";
    const s = range(1, 3.5);
    ctx.fillRect(random() * 512, random() * 512, s, s);
  }
  // 料石砌缝
  for (let y = 0; y < 512; y += 96) {
    ctx.fillStyle = "rgba(52,50,44,0.24)";
    ctx.fillRect(0, y, 512, 2);
    const off = (y / 96) % 2 ? 88 : 0;
    for (let x = off; x < 512; x += 176) {
      ctx.fillStyle = "rgba(52,50,44,0.2)";
      ctx.fillRect(x, y, 2, 96);
    }
  }
  return colorTexture(c, 1, 1);
}

function makePaving() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#9a958a";
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 128) {
    for (let x = 0; x < 512; x += 128) {
      const off = (y / 128) % 2 ? 64 : 0;
      const v = 172 + Math.floor(random() * 26);
      ctx.fillStyle = "rgb(" + v + "," + (v - 4) + "," + (v - 12) + ")";
      ctx.fillRect(x + off + 2, y + 2, 124, 124);
    }
  }
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = "rgba(70,66,58," + range(0.02, 0.08).toFixed(3) + ")";
    ctx.fillRect(random() * 512, random() * 512, range(1, 3), range(1, 3));
  }
  return colorTexture(c, 3, 3);
}

function makeChecker() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  const n = 8;
  const s = 512 / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      ctx.fillStyle = (x + y) % 2 ? "#a9a294" : "#c0b9ab";
      ctx.fillRect(x * s, y * s, s, s);
    }
  }
  ctx.strokeStyle = "rgba(58,56,50,0.36)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= n; i++) {
    ctx.beginPath();
    ctx.moveTo(i * s, 0);
    ctx.lineTo(i * s, 512);
    ctx.moveTo(0, i * s);
    ctx.lineTo(512, i * s);
    ctx.stroke();
  }
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = "rgba(70,66,58," + range(0.02, 0.07).toFixed(3) + ")";
    ctx.fillRect(random() * 512, random() * 512, range(1, 4), range(1, 4));
  }
  return colorTexture(c, 4, 3);
}

function makeLawn() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#5b7440";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    const v = random();
    ctx.fillStyle = v > 0.55
      ? "rgba(38,54,26," + range(0.06, 0.2).toFixed(3) + ")"
      : "rgba(126,148,84," + range(0.05, 0.16).toFixed(3) + ")";
    ctx.fillRect(random() * 512, random() * 512, range(1, 5), range(1, 4));
  }
  return colorTexture(c, 6, 5);
}

function makeEscalatorTread() {
  const c = makeCanvas(128, 256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#3b413f";
  ctx.fillRect(0, 0, 128, 256);
  for (let y = 0; y < 256; y += 16) {
    ctx.fillStyle = "rgba(198,204,198,0.5)";
    ctx.fillRect(0, y, 128, 2);
    ctx.fillStyle = "rgba(18,20,19,0.55)";
    ctx.fillRect(0, y + 2, 128, 3);
  }
  return colorTexture(c, 1, 1);
}

function makeCityFacade() {
  const c = makeCanvas(128, 256);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#7c9198";
  ctx.fillRect(0, 0, 128, 256);
  for (let y = 6; y < 250; y += 14) {
    for (let x = 5; x < 122; x += 12) {
      const on = random();
      if (on > 0.42) {
        ctx.fillStyle = on > 0.82
          ? "rgba(232,214,168,0.55)"
          : "rgba(186,206,206,0.28)";
        ctx.fillRect(x, y, 7, 8);
      }
    }
  }
  return colorTexture(c, 1, 4);
}

function makeTextCanvas(text, opts) {
  const o = opts || {};
  const w = o.w || 512;
  const h = o.h || 128;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  if (o.bg) {
    ctx.fillStyle = o.bg;
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.clearRect(0, 0, w, h);
  }
  if (o.border) {
    ctx.strokeStyle = o.border;
    ctx.lineWidth = o.borderWidth || 10;
    ctx.strokeRect(ctx.lineWidth / 2 + 4, ctx.lineWidth / 2 + 4, w - ctx.lineWidth - 8, h - ctx.lineWidth - 8);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = (o.weight || "700") + " " + (o.size || 72) + 'px ' + (o.font || '"Songti SC","SimSun","STSong",serif');
  if (o.vertical) {
    const chars = String(text).split("");
    const step = h / (chars.length + 0.2);
    ctx.fillStyle = o.color || "#ead9a8";
    chars.forEach(function (ch, i) {
      ctx.fillText(ch, w / 2, step * (i + 0.6));
    });
  } else {
    if (o.shadow) {
      ctx.fillStyle = o.shadow;
      ctx.fillText(text, w / 2 + (o.shadowX || 3), h / 2 + (o.shadowY || 3));
    }
    ctx.fillStyle = o.color || "#ead9a8";
    ctx.fillText(text, w / 2, h / 2 + 2);
  }
  return c;
}

/* ---------------- 材质 ---------------- */

let MATS = null;

function std(opts) {
  return new THREE.MeshStandardMaterial(opts);
}

function createMaterials(textures) {
  return {
    base: std({ map: textures.stone, color: PAL.colors.earth, roughness: 0.97 }),
    rim: std({ map: textures.paving, color: 0xa69e8e, roughness: 0.96 }),
    stone: std({ map: textures.stone, color: 0xb8b1a2, roughness: 0.95 }),
    stoneLight: std({ map: textures.stone, color: 0xd6cfbf, roughness: 0.94 }),
    stoneDark: std({ color: 0x5e5c53, roughness: 0.94 }),
    granite: std({ map: textures.stone, color: 0x928d80, roughness: 0.9 }),
    paving: std({ map: textures.paving, color: PAL.colors.paving, roughness: 0.96 }),
    checker: std({ map: textures.checker, color: 0xffffff, roughness: 0.96 }),
    lawn: std({ map: textures.lawn, color: 0xffffff, roughness: 1 }),
    lawnDark: std({ map: textures.lawn, color: 0xa8b090, roughness: 1 }),
    foliage: std({ color: 0x2b4526, roughness: 0.98, flatShading: true }),
    foliage2: std({ color: 0x1d331c, roughness: 0.98, flatShading: true }),
    blossom: std({ color: 0xc07f8a, roughness: 0.9, flatShading: true }),
    trunk: std({ color: 0x493624, roughness: 0.98 }),
    white: std({ color: 0xe4ddd0, roughness: 0.9 }),
    whiteWarm: std({ color: 0xd8cbb4, roughness: 0.9 }),
    roofGold: std({ color: 0x9a6f24, roughness: 0.56, metalness: 0.2 }),
    roofGoldDark: std({ color: 0x644313, roughness: 0.68 }),
    gold: std({ color: 0xc7a34e, roughness: 0.42, metalness: 0.45 }),
    red: std({ color: 0xa2221a, roughness: 0.82 }),
    redDark: std({ color: 0x6c1712, roughness: 0.86 }),
    steel: std({ color: 0xcdd2ce, roughness: 0.48, metalness: 0.35 }),
    steelDark: std({ color: 0x454d49, roughness: 0.55, metalness: 0.35 }),
    glass: std({ color: 0xb8d2ce, roughness: 0.12, metalness: 0.12, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }),
    canopy: std({ color: 0xcfe1dd, roughness: 0.18, metalness: 0.08, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false }),
    escalator: std({ map: textures.escalator, color: 0xffffff, roughness: 0.62, metalness: 0.22 }),
    led: std({ color: 0xffe6b0, emissive: 0xc08a35, emissiveIntensity: 0.9, roughness: 0.4 }),
    starStone: std({ map: textures.stone, color: 0xcec6b3, roughness: 0.7 }),
    obelisk: std({ color: 0x1a231c, roughness: 0.9 }),
    roofDark: std({ color: 0x1c241d, roughness: 0.88 }),
    water: std({ color: 0x7c9494, roughness: 0.25, metalness: 0.1 }),
    cityGlass: std({ map: textures.city, color: 0xaec2c6, roughness: 0.5, metalness: 0.18 }),
    cityFacade: std({ map: textures.city, color: 0xffffff, roughness: 0.5, metalness: 0.15 }),
    cityLight: std({ map: textures.city, color: 0xc7d2d2, roughness: 0.55, metalness: 0.1 }),
    cityConcrete: std({ color: 0xb2b8b3, roughness: 0.8 }),
    cityDark: std({ color: 0x88999c, roughness: 0.7 }),
    tower: std({ color: 0xa9bcc0, roughness: 0.45, metalness: 0.25 }),
    mist: new THREE.MeshBasicMaterial({ color: 0xf4f1e8, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
    mistSoft: new THREE.MeshBasicMaterial({ color: 0xf4f1e8, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide })
  };
}

/* ---------------- 基础几何 ---------------- */

function addBox(parent, w, h, d, mat, x, y, z, cast, receive) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast !== false;
  mesh.receiveShadow = receive !== false;
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, rt, rb, h, seg, mat, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addBeam(parent, a, b, t, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  if (len < 0.01) return null;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(t, t, len), mat);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addQuad(parent, a, b, c, d, mat) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
    a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z,
    a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z
  ]), 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

function addTube(parent, points, radius, mat, segments) {
  const curve = new THREE.CatmullRomCurve3(points);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segments || 24, radius, 5, false), mat);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function addInstances(parent, geometry, material, entries, place, cast) {
  const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
  const dummy = new THREE.Object3D();
  entries.forEach(function (entry, i) {
    place(dummy, entry, i);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.castShadow = cast !== false;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addTextPlane(parent, text, opts) {
  const o = opts || {};
  const canvas = makeTextCanvas(text, o);
  const tex = colorTexture(canvas, 1, 1);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: !o.bg,
    depthWrite: Boolean(o.bg),
    roughness: 0.75,
    metalness: 0.04,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.width || 2, o.height || 0.5), mat);
  mesh.position.set(o.x || 0, o.y || 0, o.z || 0);
  if (o.rotationY) mesh.rotation.y = o.rotationY;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

/* ---------------- 主体 ---------------- */

function addBase(root) {
  addBox(root, SITE_W, BASE_Y, SITE_D, MATS.base, 0, BASE_Y / 2, 0, false, true);
  addBox(root, SITE_W - 1.6, 0.12, SITE_D - 1.6, MATS.lawn, 0, BASE_Y + 0.06, 0, false, true);
  const rimY = BASE_Y + 0.06;
  addBox(root, SITE_W, 0.12, 1.0, MATS.rim, 0, rimY, SITE_D / 2 - 0.5, false, true);
  addBox(root, SITE_W, 0.12, 1.0, MATS.rim, 0, rimY, -SITE_D / 2 + 0.5, false, true);
  addBox(root, 1.0, 0.12, SITE_D, MATS.rim, SITE_W / 2 - 0.5, rimY, 0, false, true);
  addBox(root, 1.0, 0.12, SITE_D, MATS.rim, -SITE_W / 2 + 0.5, rimY, 0, false, true);

  // 展柜前的小铭牌
  addBox(root, 9.2, 1.05, 0.18, MATS.stoneDark, 0, 0.62, SITE_D / 2 + 0.02, false, false);
  addTextPlane(root, "白云山 · 摩星岭", {
    w: 1024, h: 160, bg: "#243029", border: "#c3a25c", borderWidth: 8,
    color: "#e8d3a0", size: 84, width: 8.6, height: 0.82,
    x: 0, y: 0.63, z: SITE_D / 2 + 0.13
  });
}

function addTerrain(root) {
  const OUTER = 54;
  // 西侧扶梯切开的台地缺口：x 方向一条通廊，z -1 .. -13
  const CUT = { x0: -16.8, x1: -10.4, z0: -1.0, z1: -13.0 };
  const stoneBoxes = [];
  const lawnBoxes = [];
  const capBoxes = [];

  function push(list, w, h, d, x, y, z) {
    list.push({ w: w, h: h, d: d, x: x, y: y, z: z });
  }

  TERRACES.forEach(function (t) {
    const inner = t.inner || 5.2;
    [1, -1].forEach(function (side) {
      const zc = (t.z0 + t.z1) / 2;
      const depth = t.z0 - t.z1;
      let segs;
      if (side > 0) {
        segs = [[inner, OUTER]];
      } else {
        const cut = t.z1 <= CUT.z0 && t.z0 >= CUT.z1;
        segs = cut ? [[-OUTER, CUT.x0]] : [[-OUTER, -inner]];
        if (cut && CUT.x1 < -inner) segs.push([CUT.x1, -inner]);
      }
      segs.forEach(function (s) {
        const w = s[1] - s[0];
        if (w <= 0.05) return;
        const cx = (s[0] + s[1]) / 2;
        push(stoneBoxes, w, t.top - GROUND_Y, depth, cx, (t.top + GROUND_Y) / 2, zc);
        push(lawnBoxes, w - 0.06, 0.12, depth - 0.06, cx, t.top + 0.06, zc);
        // 靠石级 / 扶梯通廊一侧的压顶石（取每段靠近场地中轴的一端）
        const edgeX = Math.abs(s[0]) < Math.abs(s[1]) ? s[0] : s[1];
        push(capBoxes, 0.42, 0.26, depth, edgeX + (edgeX < 0 ? -0.21 : 0.21), t.top + 0.16, zc);
      });
      // 切开的台地两壁做浅石挡墙
      if (side < 0 && t.z1 <= CUT.z0 && t.z0 >= CUT.z1) {
        [CUT.x0, CUT.x1].forEach(function (wx) {
          push(capBoxes, 0.34, 1.15, depth, wx, t.top - 0.52, zc);
        });
      }
    });
  });

  // 扶梯通廊底部的斜石坡，避免露出黑色空洞
  const ramp = addBox(root, CUT.x1 - CUT.x0 - 0.1, 0.5, 12.65, MATS.stone, (CUT.x0 + CUT.x1) / 2, 10.75, -7.0, true, true);
  ramp.rotation.x = Math.atan2(4.0, 12.0);

  // 山脊北坡
  push(stoneBoxes, 100, 11.4 - GROUND_Y, 15.5, 0, (11.4 + GROUND_Y) / 2, -36.2);
  push(lawnBoxes, 99.8, 0.12, 15.4, 0, 11.46, -36.2);

  // 东西两肩的缓坡台地，压住 54m 外缘
  [1, -1].forEach(function (side) {
    push(stoneBoxes, 6.4, 9.4 - GROUND_Y, 66, side * 56.8, (9.4 + GROUND_Y) / 2, -3.5);
    push(lawnBoxes, 6.2, 0.12, 65.8, side * 56.8, 9.46, -3.5);
  });

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  function place(d, e) {
    d.position.set(e.x, e.y, e.z);
    d.rotation.set(0, 0, 0);
    d.scale.set(e.w, e.h, e.d);
  }
  addInstances(root, boxGeo, MATS.stone, stoneBoxes, place, true);
  addInstances(root, boxGeo.clone(), MATS.lawn, lawnBoxes, place, false);
  addInstances(root, boxGeo.clone(), MATS.stoneLight, capBoxes, place, false);
}

function addForecourt(root) {
  // 门前方格铺装广场
  addBox(root, 26, 0.14, 15.5, MATS.checker, 0, GROUND_Y + 0.07, 30.6, false, true);
  // 广场收边
  addBox(root, 27, 0.22, 0.5, MATS.stoneLight, 0, GROUND_Y + 0.11, 38.35, false, true);
  addBox(root, 27, 0.22, 0.5, MATS.stoneLight, 0, GROUND_Y + 0.11, 22.85, false, true);
  addBox(root, 0.5, 0.22, 15.5, MATS.stoneLight, 13.2, GROUND_Y + 0.11, 30.6, false, true);
  addBox(root, 0.5, 0.22, 15.5, MATS.stoneLight, -13.2, GROUND_Y + 0.11, 30.6, false, true);

  // 两条通往上山石级的引道
  addBox(root, 6.2, 0.1, 1.2, MATS.paving, 0, GROUND_Y + 0.06, 21.9, false, true);

  // 广场灯柱
  [[-10.5, 36.2], [10.5, 36.2], [-10.5, 24.6], [10.5, 24.6]].forEach(function (p) {
    addCylinder(root, 0.12, 0.18, 3.4, 6, MATS.steelDark, p[0], GROUND_Y + 1.7, p[1]);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), MATS.led);
    head.position.set(p[0], GROUND_Y + 3.55, p[1]);
    head.castShadow = false;
    root.add(head);
  });
}

function addGate(root) {
  const g = new THREE.Group();
  g.name = "moxingling-gate";
  g.position.set(0, 0, GATE_Z);
  root.add(g);

  const baseY = GROUND_Y;
  // 三间四柱石构门，方形石柱 + 平石梁
  const cols = [-5.4, -1.9, 1.9, 5.4];
  cols.forEach(function (x, i) {
    const central = i === 1 || i === 2;
    const h = central ? 6.7 : 5.4;
    addBox(g, 0.8, h, 1.1, MATS.stone, x, baseY + h / 2, 0);
    addBox(g, 1.05, 0.24, 1.3, MATS.stoneLight, x, baseY + h + 0.12, 0, true);
    addBox(g, 0.94, 0.22, 1.24, MATS.stoneDark, x, baseY + 0.11, 0, false);
  });
  // 中央与两侧石梁
  addBox(g, 4.4, 0.95, 1.25, MATS.stone, 0, baseY + 6.55, 0);
  addBox(g, 4.8, 0.2, 1.45, MATS.stoneLight, 0, baseY + 7.08, 0, true);
  [-3.65, 3.65].forEach(function (x) {
    addBox(g, 3.4, 0.78, 1.15, MATS.stone, x, baseY + 5.24, 0);
    addBox(g, 3.7, 0.18, 1.35, MATS.stoneLight, x, baseY + 5.7, 0, true);
  });
  // 竖匾“摩星岭”
  addBox(g, 1.55, 3.1, 0.3, MATS.stoneDark, 0, baseY + 8.75, 0.1, true);
  addTextPlane(g, "摩星岭", {
    w: 256, h: 700, bg: "#1f2a24", border: "#c3a25c", borderWidth: 9,
    color: "#e8c97a", size: 168, vertical: true,
    width: 1.3, height: 2.75, x: 0, y: baseY + 8.78, z: 0.28
  });
  addBox(g, 1.85, 0.22, 0.5, MATS.stoneLight, 0, baseY + 10.38, 0.06, true);

  // 两侧低石墙
  [1, -1].forEach(function (side) {
    const wallLen = 9.6;
    addBox(g, wallLen, 1.15, 0.85, MATS.stone, side * 10.6, baseY + 0.58, 0);
    addBox(g, wallLen + 0.4, 0.2, 1.05, MATS.stoneLight, side * 10.6, baseY + 1.24, 0, true);
    // 墙头小石灯
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), MATS.led);
    lamp.position.set(side * 14.5, baseY + 1.62, 0);
    g.add(lamp);
    addCylinder(g, 0.16, 0.2, 0.28, 6, MATS.stoneDark, side * 14.5, baseY + 1.43, 0);
  });

  // 门槛
  addBox(g, 4.1, 0.16, 1.4, MATS.granite, 0, baseY + 0.08, 0, false);
}

function addRock(root) {
  const g = new THREE.Group();
  g.name = "jixing-rock";
  g.position.set(18.0, GROUND_Y, 27.5);
  root.add(g);

  addBox(g, 5.2, 0.5, 4.2, MATS.stoneDark, 0, 0.25, 0, false, true);
  addBox(g, 4.7, 0.35, 3.7, MATS.granite, 0, 0.55, 0, false, true);

  const rockGeo = new THREE.DodecahedronGeometry(2.0, 0);
  const rock = new THREE.Mesh(rockGeo, MATS.stone);
  rock.position.set(0, 2.55, 0);
  rock.scale.set(1.0, 1.5, 0.78);
  rock.rotation.set(0.04, 0.35, -0.03);
  rock.castShadow = true;
  rock.receiveShadow = true;
  g.add(rock);

  const rock2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 0), MATS.stone);
  rock2.position.set(-2.35, 1.15, 0.95);
  rock2.scale.set(1.2, 0.9, 1.0);
  rock2.castShadow = true;
  g.add(rock2);

  // 刻石红字
  addTextPlane(g, "摩星岭", {
    w: 640, h: 260, color: "#b62a1e", size: 168, shadow: "rgba(60,16,12,0.55)",
    shadowX: 5, shadowY: 5, width: 2.7, height: 1.1,
    x: 0.15, y: 3.15, z: 1.58
  });

  // 一圈低石栏
  addBox(g, 6.0, 0.5, 0.35, MATS.stoneLight, 0, 0.75, 2.6, true);
  addBox(g, 6.0, 0.5, 0.35, MATS.stoneLight, 0, 0.75, -2.6, true);
  addBox(g, 0.35, 0.5, 5.4, MATS.stoneLight, 3.1, 0.75, 0, true);
  addBox(g, 0.35, 0.5, 5.4, MATS.stoneLight, -3.1, 0.75, 0, true);
}

function addStairRun(root, z0, z1, y0, y1, steps, width) {
  const rise = (y1 - y0) / steps;
  const run = (z0 - z1) / steps;
  const entries = [];
  for (let i = 0; i < steps; i++) {
    const z = z0 - (i + 0.5) * run;
    const top = y0 + (i + 1) * rise;
    entries.push({ x: 0, z: z, h: top - GROUND_Y, y: (top + GROUND_Y) / 2 });
  }
  addInstances(root, new THREE.BoxGeometry(width, 1, run + 0.05), MATS.paving, entries, function (d, e) {
    d.position.set(e.x, e.y, e.z);
    d.scale.set(1, e.h, 1);
    d.rotation.set(0, 0, 0);
  }, true).receiveShadow = true;

  // 两侧石栏 + 金属扶手
  const angle = Math.atan2(y1 - y0, z0 - z1);
  const len = Math.hypot(z0 - z1, y1 - y0);
  const zc = (z0 + z1) / 2;
  const yc = (y0 + y1) / 2;
  [1, -1].forEach(function (side) {
    const wall = addBox(root, 0.36, 0.82, len + 0.2, MATS.stone, side * (width / 2 + 0.24), yc + 0.45, zc);
    wall.rotation.x = angle;
    const cap = addBox(root, 0.52, 0.12, len + 0.3, MATS.stoneLight, side * (width / 2 + 0.24), yc + 0.88, zc);
    cap.rotation.x = angle;
    const rail = addBox(root, 0.07, 0.07, len, MATS.steelDark, side * (width / 2 + 0.24), yc + 1.15, zc, false, false);
    rail.rotation.x = angle;
    const posts = [];
    const n = Math.max(2, Math.round(len / 2.6));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      posts.push({ z: z0 + (z1 - z0) * t, y: y0 + (y1 - y0) * t });
    }
    addInstances(root, new THREE.BoxGeometry(0.1, 1.0, 0.1), MATS.stone, posts, function (d, e) {
      d.position.set(side * (width / 2 + 0.24), e.y + 0.5, e.z);
      d.rotation.set(0, 0, 0);
      d.scale.set(1, 1, 1);
    }, true);
  });

  // 中央金属扶手
  const rail = addBox(root, 0.08, 0.08, len, MATS.steelDark, 0, yc + 1.1, zc, false, false);
  rail.rotation.x = angle;
  const mids = [];
  const mn = Math.max(2, Math.round(len / 3.2));
  for (let i = 0; i <= mn; i++) {
    const t = i / mn;
    mids.push({ z: z0 + (z1 - z0) * t, y: y0 + (y1 - y0) * t });
  }
  addInstances(root, new THREE.BoxGeometry(0.07, 0.95, 0.07), MATS.steelDark, mids, function (d, e) {
    d.position.set(0, e.y + 0.475, e.z);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
  }, false);
}

function addStairs(root) {
  addStairRun(root, LOWER_Z0, LOWER_Z1, GROUND_Y + 0.02, MID_Y, 20, 5.4);
  addStairRun(root, UPPER_Z0, UPPER_Z1, MID_Y, SUMMIT_Y, 18, 5.4);

  // 中段牌坊平台
  addBox(root, 12.8, MID_Y - GROUND_Y, 8.0, MATS.stone, 0, (MID_Y + GROUND_Y) / 2, 3.0);
  addBox(root, 12.6, 0.1, 7.8, MATS.paving, 0, MID_Y + 0.05, 3.0, false, true);
  addBox(root, 12.9, 0.28, 0.5, MATS.stoneLight, 0, MID_Y + 0.14, 6.9, false, true);
  addBox(root, 12.9, 0.28, 0.5, MATS.stoneLight, 0, MID_Y + 0.14, -0.9, false, true);

  // 上山石级的起点小平台
  addBox(root, 6.2, 0.1, 1.2, MATS.paving, 0, GROUND_Y + 0.08, 21.4, false, true);
}

function addGableRoof(parent, x, y, z, width, depth, mat, ridgeMat) {
  const half = depth / 2;
  const slope = 0.52;
  const slabLen = Math.hypot(half, half * slope);
  [-1, 1].forEach(function (side) {
    const slab = addBox(parent, width, 0.18, slabLen + 0.12, mat, x, y - half * slope / 2, z + side * half / 2);
    slab.rotation.x = side * Math.atan(slope);
    const eave = addBox(parent, width + 0.5, 0.14, 0.34, ridgeMat || mat, x, y - half * slope + 0.02, z + side * (half + 0.06));
    eave.rotation.x = side * Math.atan(slope) * 0.25;
  });
  // 四角起翘，避免看起来像现代平顶
  [-1, 1].forEach(function (zs) {
    [-1, 1].forEach(function (xs) {
      const tip = addBox(parent, 0.72, 0.16, 0.36, ridgeMat || mat, x + xs * (width / 2 + 0.26), y - half * slope + 0.26, z + zs * (half + 0.05), true);
      tip.rotation.z = xs * 0.42;
    });
  });
  addBox(parent, width + 0.3, 0.26, 0.34, ridgeMat || mat, x, y + 0.12, z, true);
}

function addPaifang(root) {
  const g = new THREE.Group();
  g.name = "jinnan-paifang";
  g.position.set(0, MID_Y, 2.0);
  root.add(g);

  // 白石三间牌坊
  const cols = [-4.6, -1.5, 1.5, 4.6];
  cols.forEach(function (x, i) {
    const central = i === 1 || i === 2;
    const h = central ? 5.3 : 4.2;
    addBox(g, 0.58, h, 0.58, MATS.white, x, h / 2, 0);
    addBox(g, 0.78, 0.22, 0.78, MATS.whiteWarm, x, 0.12, 0, true);
    // 柱顶小石帽
    addBox(g, 0.72, 0.2, 0.72, MATS.whiteWarm, x, h + 0.1, 0, true);
  });

  // 中央与两侧石梁
  addBox(g, 5.6, 0.55, 0.8, MATS.white, 0, 5.35, 0);
  addBox(g, 5.9, 0.18, 0.95, MATS.whiteWarm, 0, 5.68, 0, true);
  [-3.05, 3.05].forEach(function (x) {
    addBox(g, 3.0, 0.45, 0.72, MATS.white, x, 4.25, 0);
    addBox(g, 3.3, 0.16, 0.86, MATS.whiteWarm, x, 4.52, 0, true);
  });

  // 金匾“锦绣南天”
  addBox(g, 0.5, 0.5, 0.24, MATS.gold, 0, 5.85, 0.3, true);
  addBox(g, 3.55, 1.08, 0.22, MATS.roofGoldDark, 0, 6.05, 0.3, true);
  addTextPlane(g, "锦绣南天", {
    w: 900, h: 260, bg: "#b08a3c", border: "#6b4a1c", borderWidth: 12,
    color: "#3a1d12", size: 140,
    width: 3.34, height: 0.94, x: 0, y: 6.05, z: 0.43
  });

  // 中央与两侧金瓦顶
  addGableRoof(g, 0, 7.15, 0, 6.6, 3.1, MATS.roofGold, MATS.roofGoldDark);
  addGableRoof(g, -3.95, 5.75, 0, 3.4, 2.5, MATS.roofGold, MATS.roofGoldDark);
  addGableRoof(g, 3.95, 5.75, 0, 3.4, 2.5, MATS.roofGold, MATS.roofGoldDark);

  // 对联板（不逐个复刻原文，只做暗红描金木板）
  [-1.5, 1.5].forEach(function (x) {
    addBox(g, 0.34, 2.2, 0.08, MATS.redDark, x, 4.0, 0.34, true);
    addBox(g, 0.4, 0.05, 0.1, MATS.gold, x, 5.08, 0.36, false);
    addBox(g, 0.4, 0.05, 0.1, MATS.gold, x, 2.92, 0.36, false);
  });

  // 台基
  addBox(g, 10.6, 0.28, 3.6, MATS.stoneLight, 0, 0.14, 0, false, true);
}

function addEscalatorRun(root, x, z0, z1, y0, y1) {
  const runLen = Math.hypot(z0 - z1, y1 - y0);
  const angle = Math.atan2(y1 - y0, z0 - z1);
  const zc = (z0 + z1) / 2;
  const yc = (y0 + y1) / 2;

  const band = addBox(root, 2.7, 0.42, runLen, MATS.escalator, x, yc + 0.06, zc, true, true);
  band.rotation.x = angle;

  // 两侧银色裙板
  [1, -1].forEach(function (side) {
    const skirt = addBox(root, 0.18, 0.82, runLen, MATS.steel, x + side * 1.46, yc + 0.12, zc, true, true);
    skirt.rotation.x = angle;
    const rail = addBox(root, 0.09, 0.09, runLen, MATS.steelDark, x + side * 1.46, yc + 1.02, zc, true, false);
    rail.rotation.x = angle;
    const led = addBox(root, 0.05, 0.05, runLen, MATS.led, x + side * 1.46, yc + 0.94, zc, false, false);
    led.rotation.x = angle;
  });

  // 底部与顶部平台
  addBox(root, 3.2, 0.22, 2.2, MATS.steel, x, y0 + 0.11, z0 - 0.9, true, true);
  addBox(root, 3.2, 0.22, 2.2, MATS.steel, x, y1 + 0.11, z1 + 0.9, true, true);

  // 白色 A 形钢架 + 玻璃顶棚
  const ridgeStart = new THREE.Vector3(x, y0 + 3.55, z0);
  const ridgeEnd = new THREE.Vector3(x, y1 + 3.55, z1);
  const leftStart = new THREE.Vector3(x - 2.05, y0 + 2.55, z0);
  const leftEnd = new THREE.Vector3(x - 2.05, y1 + 2.55, z1);
  const rightStart = new THREE.Vector3(x + 2.05, y0 + 2.55, z0);
  const rightEnd = new THREE.Vector3(x + 2.05, y1 + 2.55, z1);
  addQuad(root, ridgeStart, ridgeEnd, leftEnd, leftStart, MATS.canopy);
  addQuad(root, ridgeStart, ridgeEnd, rightEnd, rightStart, MATS.canopy);
  addBeam(root, ridgeStart, ridgeEnd, 0.1, MATS.steel);
  addBeam(root, leftStart, leftEnd, 0.09, MATS.steel);
  addBeam(root, rightStart, rightEnd, 0.09, MATS.steel);

  const frames = 5;
  for (let i = 0; i <= frames; i++) {
    const t = i / frames;
    const z = z0 + (z1 - z0) * t;
    const yb = y0 + (y1 - y0) * t;
    addBeam(root, new THREE.Vector3(x, yb + 3.55, z), new THREE.Vector3(x - 2.05, yb + 2.55, z), 0.08, MATS.steel);
    addBeam(root, new THREE.Vector3(x, yb + 3.55, z), new THREE.Vector3(x + 2.05, yb + 2.55, z), 0.08, MATS.steel);
    addBeam(root, new THREE.Vector3(x, yb + 3.55, z), new THREE.Vector3(x, yb + 0.2, z), 0.08, MATS.steel);
    addCylinder(root, 0.09, 0.09, 2.0, 6, MATS.steel, x, yb + 1.35, z);
  }

  // 支撑立柱落到台地
  const supports = 3;
  for (let i = 0; i <= supports; i++) {
    const t = i / supports;
    const z = z0 + (z1 - z0) * t;
    const yb = y0 + (y1 - y0) * t;
    const ground = terraceTopAt(z) || GROUND_Y;
    addCylinder(root, 0.1, 0.14, Math.max(0.2, yb - ground + 0.1), 6, MATS.steel, x, (yb + ground) / 2, z);
  }
}

function terraceTopAt(z) {
  for (let i = 0; i < TERRACES.length; i++) {
    const t = TERRACES[i];
    if (z <= t.z0 && z >= t.z1) return t.top;
  }
  if (z > TERRACES[0].z0) return GROUND_Y;
  return 12.2;
}

function addEscalator(root) {
  const X = -13.6;
  // 下段：广场 → 中段平台
  addEscalatorRun(root, X, 29.0, 9.0, GROUND_Y + 0.15, MID_Y);
  // 上段：中段平台 → 山顶
  addEscalatorRun(root, X, 5.0, -11.0, MID_Y, SUMMIT_Y);

  // 中段换乘平台与栈道
  addBox(root, 6.2, 0.24, 5.0, MATS.steel, X, MID_Y + 0.12, 7.0, true, true);
  addBox(root, 5.4, 0.18, 4.2, MATS.paving, X, MID_Y + 0.32, 7.0, false, true);
  addBox(root, 3.0, 0.2, 3.0, MATS.steel, X, SUMMIT_Y + 0.1, -11.8, true, true);

  // 山脚入口栈道：浅灰钢梁 + 竖向密条栏杆
  addBox(root, 4.0, 0.28, 4.0, MATS.steel, X, GROUND_Y + 0.28, 31.2, true, true);
  [-1.9, 1.9].forEach(function (dx) {
    const rail = addBox(root, 0.06, 0.06, 4.0, MATS.steelDark, X + dx, GROUND_Y + 1.35, 31.2, false, false);
    rail.receiveShadow = false;
  });
  const bars = [];
  [-1.9, 1.9].forEach(function (dx) {
    for (let i = 0; i < 9; i++) bars.push({ x: X + dx, z: 29.3 + i * 0.45 });
  });
  addInstances(root, new THREE.BoxGeometry(0.045, 1.0, 0.045), MATS.steelDark, bars, function (d, e) {
    d.position.set(e.x, GROUND_Y + 0.85, e.z);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
  }, false);
}

function starShape(outer, inner) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = Math.PI / 2 + i * Math.PI / 5;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function addSummit(root) {
  // 山顶平台
  addBox(root, 15.0, SUMMIT_Y - GROUND_Y + 0.4, 15.6, MATS.stone, 0, (SUMMIT_Y + GROUND_Y) / 2 - 0.2, SUMMIT_Z + 0.3);
  addBox(root, 14.8, 0.1, 15.4, MATS.paving, 0, SUMMIT_Y + 0.05, SUMMIT_Z + 0.3, false, true);

  // 三面矮石墙（西侧南段断开，接扶梯到达平台）
  addBox(root, 15.0, 0.62, 0.4, MATS.stoneLight, 0, SUMMIT_Y + 0.31, SUMMIT_Z - 7.4, true);
  addBox(root, 0.4, 0.62, 7.8, MATS.stoneLight, -7.3, SUMMIT_Y + 0.31, -25.9, true);
  addBox(root, 0.4, 0.62, 15.2, MATS.stoneLight, 7.3, SUMMIT_Y + 0.31, SUMMIT_Z + 0.3, true);

  // 石级上口与山顶平台之间的接驳平台
  addBox(root, 6.2, 0.5, 3.2, MATS.stone, 0, SUMMIT_Y - 0.25, -13.6, false, true);
  addBox(root, 6.0, 0.1, 3.0, MATS.paving, 0, SUMMIT_Y + 0.05, -13.6, false, true);

  // 南侧观景口：金属栏杆，中间留出石级上口（±3.0）
  const railY = SUMMIT_Y + 1.0;
  [-1, 1].forEach(function (side) {
    const cx = side * 5.15;
    addBox(root, 4.3, 0.09, 0.09, MATS.steelDark, cx, railY, SUMMIT_Z + 7.7, false, false);
    addBox(root, 4.3, 0.07, 0.07, MATS.steelDark, cx, railY - 0.42, SUMMIT_Z + 7.7, false, false);
    [3.1, 5.15, 7.2].forEach(function (px) {
      addBox(root, 0.09, 1.0, 0.09, MATS.steelDark, side * px, SUMMIT_Y + 0.5, SUMMIT_Z + 7.7, false, false);
    });
  });

  // 东西两侧观景栏杆
  [-7.3, 7.3].forEach(function (x) {
    addBox(root, 0.08, 0.08, 14.4, MATS.steelDark, x, railY, SUMMIT_Z + 0.4, false, false);
    addBox(root, 0.07, 0.07, 14.4, MATS.steelDark, x, railY - 0.42, SUMMIT_Z + 0.4, false, false);
    const posts = [];
    for (let i = 0; i < 7; i++) posts.push({ z: SUMMIT_Z - 6.6 + i * 2.2 });
    addInstances(root, new THREE.BoxGeometry(0.08, 1.0, 0.08), MATS.steelDark, posts, function (d, e) {
      d.position.set(x, SUMMIT_Y + 0.5, e.z);
      d.rotation.set(0, 0, 0);
      d.scale.set(1, 1, 1);
    }, false);
  });

  // 扶梯到达平台：西侧铺装层，接主平台与锁爱台
  addBox(root, 9.0, 0.42, 11.4, MATS.stone, -12.1, SUMMIT_Y - 0.21, -17.1, false, true);
  addBox(root, 8.8, 0.1, 11.2, MATS.paving, -12.1, SUMMIT_Y + 0.05, -17.1, false, true);
  addBox(root, 0.3, 0.55, 11.4, MATS.stoneLight, -16.6, SUMMIT_Y + 0.28, -17.1, true);

  // 星形指北碑
  const base = addBox(root, 3.2, 1.0, 3.2, MATS.granite, 0, SUMMIT_Y + 0.5, STAR_Z, true, true);
  addBox(root, 3.7, 0.22, 3.7, MATS.stoneLight, 0, SUMMIT_Y + 1.1, STAR_Z, true, true);

  const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 1.12, 6.2, 4), MATS.obelisk);
  obelisk.rotation.y = Math.PI / 4;
  obelisk.position.set(0, SUMMIT_Y + 4.2, STAR_Z);
  obelisk.castShadow = true;
  obelisk.receiveShadow = true;
  root.add(obelisk);

  const collar = addBox(root, 1.55, 0.3, 1.55, MATS.stoneLight, 0, SUMMIT_Y + 7.4, STAR_Z, true, true);

  const starGeo = new THREE.ExtrudeGeometry(starShape(1.62, 0.68), {
    depth: 0.56, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 1
  });
  starGeo.translate(0, 0, -0.28);
  const star = new THREE.Mesh(starGeo, MATS.starStone);
  star.position.set(0, SUMMIT_Y + 9.1, STAR_Z);
  star.castShadow = true;
  star.receiveShadow = true;
  root.add(star);

  // 星面“1900km 北京”（朝北，望向北京）
  addTextPlane(root, "1900km 北京", {
    w: 640, h: 180, color: "#8f1f18", size: 92, weight: "700",
    width: 1.85, height: 0.52,
    x: 0, y: SUMMIT_Y + 9.1, z: STAR_Z - 0.34, rotationY: Math.PI
  });
  // 碑身“海拔382米”（朝南，面向城市）
  addTextPlane(root, "海拔382米", {
    w: 200, h: 760, color: "#c0261c", size: 100, vertical: true, weight: "700",
    width: 0.62, height: 2.6,
    x: 0, y: SUMMIT_Y + 4.3, z: STAR_Z + 0.82
  });

  // 基座上的红色许愿带与金锁
  const ribbons = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    ribbons.push({ x: Math.cos(a) * 1.86, z: STAR_Z + Math.sin(a) * 1.86, h: range(0.35, 0.75) });
  }
  addInstances(root, new THREE.BoxGeometry(0.1, 1, 0.045), MATS.red, ribbons, function (d, e) {
    d.position.set(e.x, SUMMIT_Y + 0.95 - e.h / 2, e.z);
    d.rotation.set(0, Math.atan2(e.x, e.z - STAR_Z), 0);
    d.scale.set(1, e.h, 1);
  }, false);
  addInstances(root, new THREE.BoxGeometry(0.16, 0.12, 0.06), MATS.gold, ribbons.slice(0, 14), function (d, e) {
    d.position.set(e.x, SUMMIT_Y + 0.98, e.z);
    d.rotation.set(0, Math.atan2(e.x, e.z - STAR_Z), 0);
    d.scale.set(1, 1, 1);
  }, false);

  // 锁爱台：西侧小平台 + 祈福牌
  addBox(root, 6.4, 0.6, 8.0, MATS.stone, -10.4, SUMMIT_Y - 0.3, -26.0);
  addBox(root, 6.2, 0.1, 7.8, MATS.paving, -10.4, SUMMIT_Y + 0.05, -26.0, false, true);
  addBox(root, 6.4, 0.55, 0.3, MATS.stoneLight, -10.4, SUMMIT_Y + 0.32, -29.9, true);
  addBox(root, 6.4, 0.55, 0.3, MATS.stoneLight, -10.4, SUMMIT_Y + 0.32, -22.1, true);

  // 祈福木架
  addBox(root, 3.6, 0.12, 0.12, MATS.trunk, -10.4, SUMMIT_Y + 2.5, -29.4, true);
  addBox(root, 0.12, 2.4, 0.12, MATS.trunk, -12.0, SUMMIT_Y + 1.2, -29.4, true);
  addBox(root, 0.12, 2.4, 0.12, MATS.trunk, -8.8, SUMMIT_Y + 1.2, -29.4, true);
  const plaques = [];
  for (let i = 0; i < 12; i++) {
    plaques.push({ x: -11.8 + i * 0.27, y: SUMMIT_Y + 2.16 + (i % 3) * 0.1 });
  }
  addInstances(root, new THREE.BoxGeometry(0.2, 0.34, 0.03), MATS.red, plaques, function (d, e) {
    d.position.set(e.x, e.y, -29.35);
    d.rotation.set(0, 0, (e.x + 10.4) * 0.02);
    d.scale.set(1, 1, 1);
  }, false);
  const locks = [];
  for (let i = 0; i < 8; i++) locks.push({ x: -12.0 + i * 0.48 });
  addInstances(root, new THREE.TorusGeometry(0.11, 0.035, 5, 8), MATS.gold, locks, function (d, e) {
    d.position.set(e.x, SUMMIT_Y + 1.55, -30.0);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1.4, 1);
  }, false);
}

function addPavilion(root) {
  const g = new THREE.Group();
  g.name = "summit-pavilion";
  g.position.set(PAVILION_X, SUMMIT_Y, PAVILION_Z);
  root.add(g);

  addBox(g, 9.2, 0.5, 9.2, MATS.stone, 0, -0.25, 0, false, true);
  addBox(g, 9.0, 0.1, 9.0, MATS.paving, 0, 0.02, 0, false, true);
  addCylinder(g, 3.1, 3.2, 0.3, 20, MATS.whiteWarm, 0, 0.16, 0);

  const R = 2.55;
  const heights = 3.35;
  const colPos = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + i * Math.PI / 3;
    const x = Math.cos(a) * R;
    const z = Math.sin(a) * R;
    colPos.push({ x: x, z: z });
    addBox(g, 0.28, heights, 0.28, MATS.white, x, heights / 2 + 0.2, z);
    addBox(g, 0.38, 0.16, 0.38, MATS.whiteWarm, x, heights + 0.28, z, true);
  }
  // 坐凳栏杆
  for (let i = 0; i < 6; i++) {
    const a0 = Math.PI / 6 + i * Math.PI / 3;
    const a1 = a0 + Math.PI / 3;
    const p0 = new THREE.Vector3(Math.cos(a0) * R, 0.75, Math.sin(a0) * R);
    const p1 = new THREE.Vector3(Math.cos(a1) * R, 0.75, Math.sin(a1) * R);
    addBeam(g, p0, p1, 0.12, MATS.whiteWarm);
    addBeam(g, new THREE.Vector3(p0.x, 0.45, p0.z), new THREE.Vector3(p1.x, 0.45, p1.z), 0.1, MATS.white);
  }

  // 深灰六角攒尖顶
  addCylinder(g, 3.65, 3.75, 0.22, 6, MATS.whiteWarm, 0, heights + 0.42, 0);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.55, 1.55, 6), MATS.roofDark);
  roof.position.set(0, heights + 1.22, 0);
  roof.castShadow = true;
  roof.receiveShadow = true;
  g.add(roof);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), MATS.gold);
  finial.position.set(0, heights + 2.08, 0);
  g.add(finial);
  addCylinder(g, 0.05, 0.07, 0.55, 6, MATS.gold, 0, heights + 2.3, 0);
}

function addCity(root) {
  // 珠江与城市带：压在台座南缘，仅作压缩剪影，不表示实测方位与距离
  addBox(root, 112, 0.16, 1.6, MATS.stoneDark, 0, GROUND_Y + 0.08, 43.9, false, false);
  addBox(root, 112, 0.12, 1.4, MATS.water, 0, GROUND_Y + 0.2, 43.9, false, true);
  addBox(root, 112, 0.2, 0.5, MATS.stoneLight, 0, GROUND_Y + 0.1, 43.0, false, false);

  const facades = [];
  const caps = [];
  function tower(x, z, w, d, h, color) {
    facades.push({ x: x, z: z, w: w, d: d, h: h, color: color });
    caps.push({ x: x, z: z, w: w + 0.3, d: d + 0.3, y: GROUND_Y + h + 0.15 });
  }

  // 后排：珠江新城（压缩剪影，高度按展柜比例压低）
  tower(16.0, 41.9, 4.0, 4.0, 10.0, 0xc7d2d2);
  addCylinder(root, 0.07, 0.07, 1.8, 5, MATS.cityConcrete, 15.7, GROUND_Y + 10.9, 41.9);
  addCylinder(root, 0.07, 0.07, 1.8, 5, MATS.cityConcrete, 16.3, GROUND_Y + 10.9, 41.9);
  tower(27.5, 42.1, 4.4, 4.4, 11.5, 0xaec2c6);
  tower(33.0, 42.0, 4.0, 4.0, 10.5, 0xaec2c6);
  tower(-23.0, 42.0, 3.4, 3.4, 6.4, 0x88999c);
  tower(-31.0, 42.2, 2.8, 2.8, 5.2, 0xb2b8b3);
  // 中轴留出低矮缺口，避免挡住石门与台座铭牌
  tower(-8.5, 43.2, 2.4, 2.2, 2.2, 0x88999c);
  tower(8.5, 43.2, 2.4, 2.2, 2.0, 0xb2b8b3);

  // 中排
  tower(-39.0, 40.4, 3.8, 3.0, 4.6, 0x88999c);
  tower(-15.0, 40.5, 3.4, 3.0, 5.2, 0xb2b8b3);
  tower(-8.0, 40.4, 3.2, 2.8, 4.2, 0xc7d2d2);
  tower(9.0, 40.6, 3.4, 3.0, 5.4, 0x88999c);
  tower(21.0, 40.5, 3.2, 2.8, 4.4, 0xb2b8b3);
  tower(38.0, 40.6, 3.6, 3.2, 5.0, 0xc7d2d2);

  // 前排低层
  tower(-45.0, 39.0, 3.2, 2.6, 3.2, 0xb2b8b3);
  tower(-25.0, 39.1, 3.4, 2.8, 3.6, 0x88999c);
  tower(18.0, 39.1, 3.0, 2.6, 3.8, 0xb2b8b3);
  tower(43.0, 39.2, 3.4, 2.8, 3.3, 0xc7d2d2);

  const unit = new THREE.BoxGeometry(1, 1, 1);
  const towerMeshInst = new THREE.InstancedMesh(unit, MATS.cityFacade, facades.length);
  const dummy = new THREE.Object3D();
  facades.forEach(function (e, i) {
    dummy.position.set(e.x, GROUND_Y + e.h / 2, e.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(e.w, e.h, e.d);
    dummy.updateMatrix();
    towerMeshInst.setMatrixAt(i, dummy.matrix);
    towerMeshInst.setColorAt(i, new THREE.Color(e.color));
  });
  towerMeshInst.castShadow = true;
  towerMeshInst.receiveShadow = true;
  root.add(towerMeshInst);

  const capMesh = new THREE.InstancedMesh(unit.clone(), MATS.cityConcrete, caps.length);
  caps.forEach(function (e, i) {
    dummy.position.set(e.x, e.y, e.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(e.w, 0.3, e.d);
    dummy.updateMatrix();
    capMesh.setMatrixAt(i, dummy.matrix);
  });
  capMesh.castShadow = false;
  capMesh.receiveShadow = false;
  root.add(capMesh);

  // 广州塔：双曲塔身 + 螺旋桁架 + 天线（压到展柜比例）
  const towerGroup = new THREE.Group();
  towerGroup.position.set(31.0, GROUND_Y, 42.4);
  towerGroup.scale.set(0.8, 0.65, 0.8);
  root.add(towerGroup);
  const profile = [
    [0.0, 0.0], [1.5, 0.0], [1.38, 1.4], [1.04, 3.9], [0.63, 7.3],
    [0.43, 10.0], [0.42, 12.3], [0.61, 14.6], [1.01, 16.9], [1.32, 18.4],
    [1.36, 19.0], [1.09, 19.6], [0.71, 20.2], [0.38, 20.6]
  ];
  const pts = profile.map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  const towerMesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), MATS.tower);
  towerMesh.castShadow = true;
  towerMesh.receiveShadow = true;
  towerGroup.add(towerMesh);
  addCylinder(towerGroup, 0.08, 0.13, 2.6, 6, MATS.cityConcrete, 0, 21.7, 0);

  const helix = [];
  for (let i = 0; i <= 90; i++) {
    const t = i / 90;
    const y = 1.6 + t * 17.2;
    let r = 1.25;
    if (y > 7.3 && y < 12.3) r = 0.66;
    else if (y >= 12.3) r = 0.66 + (y - 12.3) * 0.1;
    const a = t * Math.PI * 5;
    helix.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  addTube(towerGroup, helix, 0.045, MATS.cityConcrete, 90);

  // 城市雾带，压低远景（每片独立材质，避免互相覆盖透明度）
  [[3.2, 40.8, 0.22, 9], [5.4, 41.6, 0.14, 12]].forEach(function (m) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xf4f1e8, transparent: true, opacity: m[2],
      depthWrite: false, side: THREE.DoubleSide
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(110, m[3]), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(0, m[0], m[1]);
    root.add(plane);
  });
  const hazeMat = new THREE.MeshBasicMaterial({
    color: 0xf4f1e8, transparent: true, opacity: 0.2,
    depthWrite: false, side: THREE.DoubleSide
  });
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(112, 12), hazeMat);
  haze.position.set(0, 5.0, 44.8);
  haze.rotation.y = Math.PI;
  root.add(haze);
}

function addTrees(root) {
  const trunks = [];
  const crownsA = [];
  const crownsB = [];
  const blossoms = [];

  function plant(x, z, y, s) {
    if (Math.abs(x) < 9.5 && z < 23 && z > -14) return;
    if (x > -17.5 && x < -9.5 && z > -13 && z < 30) return;
    if (x > -17.2 && x < -7.0 && z > -31 && z < -13) return;
    if (Math.abs(x) < 13.5 && z > 22 && z < 39) return;
    if (Math.abs(x) < 9.0 && z < -13) return;
    if (Math.abs(x - 9.8) < 6.0 && Math.abs(z + 26.0) < 6.0) return;
    if (x > 14 && x < 22 && z > 23 && z < 32) return;
    if (z > 39.5) return;
    trunks.push({ x: x, z: z, y: y, s: s });
    crownsA.push({ x: x, z: z, y: y + 2.45 * s, s: s });
    crownsB.push({ x: x + 0.35 * s, z: z - 0.3 * s, y: y + 3.25 * s, s: s * 0.72 });
  }

  TERRACES.forEach(function (t) {
    for (let i = 0; i < 11; i++) {
      const side = i % 2 ? 1 : -1;
      plant(side * range(9, 49), range(t.z1 + 0.8, t.z0 - 0.8), t.top + 0.12, range(0.7, 1.3));
    }
  });
  // 北坡
  for (let i = 0; i < 16; i++) {
    plant(range(-46, 46), range(-43.5, -29.5), 11.5, range(0.8, 1.3));
  }
  // 广场两侧
  [[-20, 32], [-24, 36], [-31, 28], [20, 33], [25, 37], [33, 29], [-36, 34], [38, 35]].forEach(function (p) {
    plant(p[0], p[1], GROUND_Y, range(0.9, 1.2));
  });
  // 东西两肩
  for (let i = 0; i < 8; i++) {
    plant(51.5, range(-32, 18), 9.4, range(0.7, 1.0));
    plant(-51.5, range(-32, 18), 9.4, range(0.7, 1.0));
  }

  addInstances(root, new THREE.CylinderGeometry(0.24, 0.36, 2.8, 5), MATS.trunk, trunks, function (d, e) {
    d.position.set(e.x, e.y + 1.4 * e.s, e.z);
    d.rotation.set(0, 0, 0);
    d.scale.set(e.s, e.s, e.s);
  }, true);
  addInstances(root, new THREE.IcosahedronGeometry(1.65, 0), MATS.foliage, crownsA, function (d, e) {
    d.position.set(e.x, e.y, e.z);
    d.rotation.set(0, e.s * 2.1, 0.05);
    d.scale.set(e.s * 1.18, e.s * 0.98, e.s * 1.18);
  }, true);
  addInstances(root, new THREE.IcosahedronGeometry(1.3, 0), MATS.foliage2, crownsB, function (d, e) {
    d.position.set(e.x, e.y, e.z);
    d.rotation.set(0.1, e.s * 3.0, 0);
    d.scale.set(e.s * 1.1, e.s * 0.92, e.s * 1.1);
  }, true);

  // 山顶几株粉色花树
  [[13.4, -29.9, 1.05], [16.0, -24.0, 0.9], [-14.6, -30.2, 0.95]].forEach(function (p, i) {
    blossoms.push({ x: p[0], z: p[1], y: SUMMIT_Y, s: p[2] });
  });
  addInstances(root, new THREE.CylinderGeometry(0.16, 0.24, 2.2, 5), MATS.trunk, blossoms, function (d, e) {
    d.position.set(e.x, e.y + 1.1 * e.s, e.z);
    d.rotation.set(0, 0, 0);
    d.scale.set(e.s, e.s, e.s);
  }, true);
  addInstances(root, new THREE.IcosahedronGeometry(1.55, 0), MATS.blossom, blossoms, function (d, e) {
    d.position.set(e.x, e.y + 2.5 * e.s, e.z);
    d.rotation.set(0, e.s * 2.6, 0.08);
    d.scale.set(e.s * 1.15, e.s * 0.85, e.s * 1.15);
  }, true);

  // 台地边缘灌木
  const shrubs = [];
  TERRACES.forEach(function (t) {
    [1, -1].forEach(function (side) {
      for (let i = 0; i < 9; i++) {
        const x = side * range(6.6, 47);
        const z = range(t.z1 + 0.5, t.z0 - 0.5);
        if (Math.abs(x) < 9.0 && z < -13) continue;
        if (x > -17.5 && x < -9.5 && z > -13 && z < 30) continue;
        if (x > -17.2 && x < -7.0 && z > -31 && z < -13) continue;
        if (Math.abs(x - 9.8) < 5.4 && Math.abs(z + 26.0) < 5.4) continue;
        shrubs.push({ x: x, z: z, y: t.top });
      }
    });
  });
  addInstances(root, new THREE.IcosahedronGeometry(0.62, 0), MATS.foliage2, shrubs, function (d, e) {
    d.position.set(e.x, e.y + 0.35, e.z);
    d.rotation.set(0, e.x * 0.7, 0);
    d.scale.set(1.15, 0.75, 1.1);
  }, false);
}

function addSummitDecor(root) {
  // 山顶路灯/石凳
  [[-5.6, -15.5], [5.6, -15.5], [-5.6, -29.0], [5.6, -29.0]].forEach(function (p) {
    addCylinder(root, 0.08, 0.12, 2.2, 6, MATS.steelDark, p[0], SUMMIT_Y + 1.1, p[1]);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), MATS.led);
    head.position.set(p[0], SUMMIT_Y + 2.25, p[1]);
    root.add(head);
  });
  [[-4.2, -29.2], [4.2, -29.2]].forEach(function (p) {
    addBox(root, 1.8, 0.16, 0.5, MATS.whiteWarm, p[0], SUMMIT_Y + 0.5, p[1], true, true);
    addBox(root, 0.18, 0.42, 0.42, MATS.stoneDark, p[0] - 0.7, SUMMIT_Y + 0.22, p[1], true, true);
    addBox(root, 0.18, 0.42, 0.42, MATS.stoneDark, p[0] + 0.7, SUMMIT_Y + 0.22, p[1], true, true);
  });
}

export function create() {
  seed = 382;

  const textures = {
    stone: makeStone("#b8b1a2", "72,68,58"),
    paving: makePaving(),
    checker: makeChecker(),
    lawn: makeLawn(),
    escalator: makeEscalatorTread(),
    city: makeCityFacade()
  };
  MATS = createMaterials(textures);

  const root = new THREE.Group();
  root.name = "baiyun-model";

  addBase(root);
  addTerrain(root);
  addForecourt(root);
  addGate(root);
  addRock(root);
  addStairs(root);
  addPaifang(root);
  addEscalator(root);
  addSummit(root);
  addPavilion(root);
  addCity(root);
  addTrees(root);
  addSummitDecor(root);

  const anchors = {
    overview: new THREE.Vector3(0, 9.0, 2.0),
    gate: new THREE.Vector3(0, GROUND_Y + 5.6, GATE_Z),
    rock: new THREE.Vector3(18.0, GROUND_Y + 5.2, 27.5),
    paifang: new THREE.Vector3(0, MID_Y + 5.0, 2.0),
    escalator: new THREE.Vector3(-13.6, MID_Y + 3.2, 8.0),
    star: new THREE.Vector3(0, SUMMIT_Y + 7.8, STAR_Z),
    pavilion: new THREE.Vector3(PAVILION_X, SUMMIT_Y + 2.2, PAVILION_Z),
    detail: new THREE.Vector3(0, SUMMIT_Y + 7.6, STAR_Z)
  };

  return {
    group: root,
    anchors: anchors,
    dispose: function () { dispose(root); }
  };
}

function dispose(root) {
  const geos = new Set();
  const mats = new Set();
  const texs = new Set();
  root.traverse(function (obj) {
    if (obj.geometry) geos.add(obj.geometry);
    if (obj.material) {
      const list = Array.isArray(obj.material) ? obj.material : [obj.material];
      list.forEach(function (m) {
        mats.add(m);
        Object.keys(m).forEach(function (k) {
          const v = m[k];
          if (v && v.isTexture) texs.add(v);
        });
      });
    }
  });
  geos.forEach(function (g) { g.dispose(); });
  mats.forEach(function (m) { m.dispose(); });
  texs.forEach(function (t) { t.dispose(); });
}
