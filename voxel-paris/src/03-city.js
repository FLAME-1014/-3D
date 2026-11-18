// ---------- Haussmann city blocks, trees, work yard props ----------
const occupied = new Set();
const CHIMS = [];
const WALLS = [0xead9b8, 0xe4d2ae, 0xeedfc4, 0xdfcba6, 0xe8d6bc];
function canBuild(x0, z0, w, d) {
  for (let x = x0 - 1; x < x0 + w + 1; x++) for (let z = z0 - 1; z < z0 + d + 1; z++) {
    const c = cols.get(ckey(x, z));
    if (!c || (c.type !== T_PAVE && c.type !== T_GRASS) || occupied.has(ckey(x, z))) return false;
  }
  return true;
}
function building(x0, z0, w, d, h) {
  for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + d; z++) occupied.add(ckey(x, z));
  const wall = pick(WALLS), zinc = pick([0x8d98a4, 0x8791a0, 0x959ea8]);
  const per = (x, z) => x === x0 || x === x0 + w - 1 || z === z0 || z === z0 + d - 1;
  for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + d; z++) {
    if (per(x, z)) {
      for (let y = 0; y < h; y++) {
        const col = y === 0 ? tint(wall, 0.84) : y === h - 1 ? tint(wall, 1.05) : wall;
        VOX.box(x + 0.5, y + 0.5, z + 0.5, 1, 1, 1, tint(col, 0.97 + 0.06 * hash3(x, y, z)));
      }
      VOX.box(x + 0.5, h + 0.5, z + 0.5, 1, 1, 1, tint(zinc, 0.95 + 0.1 * hash2(x, z)));
    }
    const inset = x > x0 && x < x0 + w - 1 && z > z0 && z < z0 + d - 1;
    if (inset) VOX.box(x + 0.5, h + 1.4, z + 0.5, 1, 0.8, 1, tint(zinc, 0.86 + 0.08 * hash2(x, z)));
  }
  // facades: windows, balconies, dormers
  const sides = [[x0, z0 + d, 1, 0, w, 0, 1], [x0, z0, 1, 0, w, 0, -1], [x0, z0, 0, 1, d, -1, 0], [x0 + w, z0, 0, 1, d, 1, 0]];
  for (const [sx, sz, ax, az, len, nx, nz] of sides) {
    for (let u = 0; u < len; u++) for (let k = 0; k < 2; k++) {
      const a = u + 0.27 + k * 0.46, px = sx + ax * a + nx * 0.03, pz = sz + az * a + nz * 0.03;
      const ww = ax ? 0.26 : 0.1, wd = az ? 0.26 : 0.1;
      for (let y = 1; y < h; y++) {
        const hsh = hash3(Math.round(px * 7), y, Math.round(pz * 7));
        const col = hsh > 0.93 ? 0xf2b667 : hsh > 0.5 ? 0x4b5360 : 0x3e4450;
        WOOD.box(px, y + 0.48, pz, ww, 0.62, wd, col);
      }
      // ground floor: shopfronts / doors
      WOOD.box(px, 0.42, pz, ax ? 0.36 : 0.1, 0.7, az ? 0.36 : 0.1, 0x4a3628);
      WOOD.box(px, h + 0.5, pz, ax ? 0.3 : 0.14, 0.5, az ? 0.3 : 0.14, 0xe6dcc6); // dormer
    }
    for (const by of [2, h - 1]) { // wrought-iron balcony lines
      WOOD.box(sx + ax * len / 2 + nx * 0.1, by + 0.08, sz + az * len / 2 + nz * 0.1, ax ? len : 0.2, 0.1, az ? len : 0.2, 0x2f2c2e);
    }
    if (hash2(sx * 3 + nx, sz * 5 + nz) > 0.45) { // awning
      const a = 1 + Math.floor(hash2(sx, sz) * Math.max(1, len - 3));
      WOOD.box(sx + ax * (a + 1) + nx * 0.3, 1.0, sz + az * (a + 1) + nz * 0.3, ax ? 2 : 0.6, 0.12, az ? 2 : 0.6, pick([0xa63d32, 0x2f5d50, 0xc9a24a, 0x7a3040]));
    }
  }
  // chimney stacks
  const along = w >= d;
  for (let u = 1.5; u < (along ? w : d) - 1; u += 3) {
    const cx = along ? x0 + u : x0 + w / 2, cz = along ? z0 + d / 2 : z0 + u;
    WOOD.box(cx, h + 2.3, cz, along ? 0.6 : 1.3, 1.2, along ? 1.3 : 0.6, 0xa2644a);
    for (let k = -1; k <= 1; k++) WOOD.box(cx + (along ? 0 : k * 0.4), h + 3.1, cz + (along ? k * 0.4 : 0), 0.2, 0.4, 0.2, 0xc67d55);
    if (rnd() < 0.22) CHIMS.push([cx, h + 3.3, cz]);
  }
}
function row(along, fixed, depth, from, to, fixedFn) {
  let p = from, n = 0;
  while (p < to - 5) {
    const w = Math.min(ri(6, 10), to - p), h = ri(5, 7);
    const f = fixedFn ? fixedFn(p + w / 2) : fixed;
    const [x0, z0, bw, bd] = along === 'x' ? [p, f, w, depth] : [f, p, depth, w];
    if (canBuild(x0, z0, bw, bd)) { building(x0, z0, bw, bd, h); n++; }
    p += w;
    if (n % 3 === 2 && rnd() < 0.8) { p += 3; n++; }
  }
}
row('z', -41, 7, -46, 24); row('z', 34, 7, -46, 24);
row('z', -53, 7, -34, 22); row('z', 46, 7, -34, 22);
row('x', -42, 7, -32, 32); row('x', -54, 7, -24, 24);
row('x', 0, 6, -40, -5, (xc) => Math.ceil(riverZ(xc) + 10.5));
row('x', 0, 6, 5, 40, (xc) => Math.ceil(riverZ(xc) + 10.5));

const GREENS = [0x6f9a48, 0x7ea84f, 0x5f8b43, 0x93a64a, 0x86a04a];
function tree(x, z, s = 1) {
  const c = colAt(x, z);
  if (!c || c.type === T_WATER || c.type === T_DIRT || occupied.has(ckey(Math.floor(x), Math.floor(z)))) return;
  WOOD.box(x, 0.8 * s, z, 0.28, 1.6 * s, 0.28, 0x5d4330);
  const g = pick(GREENS);
  VOX.box(x, 2.1 * s, z, 1.5 * s, 1.4 * s, 1.5 * s, g);
  VOX.box(x + rr(-0.4, 0.4), 2.9 * s, z + rr(-0.4, 0.4), 1.0 * s, 0.9 * s, 1.0 * s, tint(g, 1.1));
  VOX.box(x + rr(-0.6, 0.6), 1.9 * s, z + rr(-0.6, 0.6), 0.9 * s, 0.9 * s, 0.9 * s, tint(g, 0.9));
}
for (let z = -33; z <= 21; z += 3) { tree(-29.5, z); tree(29.5, z); tree(-33, z + 1.5, 0.9); tree(33, z + 1.5, 0.9); }
for (let x = -27; x <= 27; x += 3) { tree(x, -32.5); if (Math.abs(x) > 5) tree(x, riverZ(x) - 8.6, 0.9); }
for (let x = -44; x <= 44; x += 3) if (Math.abs(x) > 5) tree(x + 0.5, riverZ(x) + 8.8, 0.9);
for (let i = 0; i < 70; i++) { // scattered trees on the grassy rim
  const a = rnd() * TAU, r = islandR(Math.cos(a), Math.sin(a)) - rr(1.5, 4), x = Math.cos(a) * r, z = Math.sin(a) * r;
  const c = colAt(x, z); if (c && c.type === T_GRASS) tree(x, z, rr(0.8, 1.2));
}

// ----- work yard -----
const IRON_COLS = [0x6e3324, 0x7a3a28, 0x64301f, 0x82402c];
const TIMBER = [0xb08955, 0xa57d4b, 0xbb9360, 0x9a7444];
// fence
for (let x = YARD.x0; x <= YARD.x1; x += 1.5) for (const z of [YARD.z0, YARD.z1]) {
  if (z === YARD.z1 && Math.abs(x) < 5) continue;
  WOOD.box(x, 0.55, z, 0.16, 1.1, 0.16, 0x8a6a45); WOOD.box(x + 0.75, 0.8, z, 1.5, 0.1, 0.08, 0x9a7a52);
}
for (let z = YARD.z0; z <= YARD.z1; z += 1.5) for (const x of [YARD.x0, YARD.x1]) {
  if (Math.abs(z + 4) < 4) continue;
  WOOD.box(x, 0.55, z, 0.16, 1.1, 0.16, 0x8a6a45); WOOD.box(x, 0.8, z + 0.75, 0.08, 0.1, 1.5, 0x9a7a52);
}
function girderStack(x, z, ry, n = 4, layers = 3, len = 7) {
  const c = Math.cos(ry), s = Math.sin(ry);
  for (let l = 0; l < layers; l++) {
    for (let i = 0; i < n - (l > 1 ? 1 : 0); i++) {
      const o = (i - (n - 1) / 2) * 0.62, j = rr(-0.3, 0.3);
      IRON.box(x + s * o + c * j, 0.32 + l * 0.6, z + c * o - s * j, len, 0.36, 0.3, pick(IRON_COLS), ry);
    }
    for (const k of [-0.35, 0.35]) WOOD.box(x + c * len * k, 0.06 + l * 0.6, z - s * len * k, 0.2, 0.12, n * 0.7, 0x9a7444, ry);
  }
}
girderStack(-19, -23, 0.1); girderStack(-10, -25, -0.05, 5, 4); girderStack(8, -24, 0.02, 4, 2, 9); girderStack(20, -21, 0.4);
girderStack(22, 9, 1.5, 4, 3, 6); girderStack(-22, 13, 1.62, 5, 2, 8); girderStack(-21, 3, 1.5, 3, 2, 5); girderStack(13, 19, 0.03, 4, 2, 6);
function shed(x0, z0, w, d, h) {
  for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + d; z++) {
    const p = x === x0 || x === x0 + w - 1 || z === z0 || z === z0 + d - 1;
    if (p) for (let y = 0; y < h; y++) VOX.box(x + 0.5, y + 0.5, z + 0.5, 1, 1, 1, tint(pick(TIMBER), 0.9 + 0.15 * hash3(x, y, z)));
    const ridge = Math.min(z - z0, z0 + d - 1 - z);
    VOX.box(x + 0.5, h + 0.3 + ridge * 0.5, z + 0.5, 1.15, 0.6, 1.1, tint(0x6e5a4a, 0.9 + 0.15 * hash2(x, z)));
  }
  WOOD.box(x0 + w / 2, 0.8, z0 + d + 0.03, 0.9, 1.6, 0.1, 0x4a3524);
  WOOD.box(x0 + w / 2 + 1.6, 1.4, z0 + d + 0.03, 0.7, 0.6, 0.1, 0x55606a);
}
shed(-24, -14, 6, 4, 3); shed(-25, -6, 5, 4, 2); shed(17, -4, 7, 4, 3); shed(-8, -29, 5, 3, 2);
// steam engine (hoisting winch house): brick base, boiler, tall chimney
const ENGINE = { x: 19, z: -13 };
(function () {
  const { x, z } = ENGINE;
  for (let i = -2; i < 3; i++) for (let k = -1; k < 1; k++) VOX.box(x + i + 0.5, 0.3, z + k + 0.5, 1, 0.6, 1, tint(0x9c5a45, 0.9 + 0.2 * hash2(i, k)));
  for (let i = -2; i < 1; i++) VOX.box(x + i + 0.5, 1.3, z, 1, 1.4, 1.4, 0x33353a);
  VOX.box(x - 2.2, 1.3, z, 0.5, 1.1, 1.1, 0x8a6a3a);
  WOOD.box(x - 0.5, 2.15, z, 0.4, 0.5, 0.4, 0xc79a45);
  VOX.box(x + 1.6, 1.0, z, 1.2, 0.9, 1.2, 0x2b2c30);
  for (let y = 0; y < 7; y++) VOX.box(x + 2.5, 0.6 + y + 0.5, z - 0.5, 0.9 - y * 0.03, 1, 0.9 - y * 0.03, tint(0x8e4f3d, 0.9 + 0.2 * hash2(y, 3)));
  VOX.box(x + 2.5, 7.75, z - 0.5, 1.0, 0.3, 1.0, 0x3a3030);
  ENGINE.chim = [x + 2.5, 8.0, z - 0.5];
})();
// dirt mounds and timber piles
for (const [x, z, s] of [[-12, 20, 2], [24, -27, 2.4], [-25, -27, 1.8], [10, -18, 1.4], [24, 17, 1.6]]) {
  for (let i = 0; i < 9; i++) VOX.box(x + rr(-s, s), rr(0.2, s * 0.45), z + rr(-s, s), rr(0.8, 1.5), rr(0.6, 1.2), rr(0.8, 1.5), tint(0xa98558, rr(0.85, 1.05)));
}
for (const [x, z, ry] of [[-16, -18, 0.3], [14, 12, 1.2], [-24, 20, 0.1], [5, -27, 0]]) {
  for (let i = 0; i < 8; i++) WOOD.box(x + rr(-0.2, 0.2), 0.15 + Math.floor(i / 4) * 0.28, z + (i % 4) * 0.33, 4.5, 0.26, 0.28, pick(TIMBER), ry);
}
