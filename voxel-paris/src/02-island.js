// ---------- island terrain, Seine, bridge ----------
const GR = 68;
const riverZ = (x) => 30 + 8 * Math.cos(x / 28);
const RIVER_HW = 5.5;
function islandR(x, z) {
  const a = Math.atan2(z, x);
  return 57 + 4.5 * Math.sin(a * 3 + 0.6) + 2.5 * Math.sin(a * 7 + 2.1) + 1.5 * Math.sin(a * 13 + 4);
}
const T_VOID = 0, T_DIRT = 1, T_PAVE = 2, T_GRASS = 3, T_QUAY = 4, T_WATER = 5;
const YARD = { x0: -27, x1: 27, z0: -30, z1: 22 };
function columnInfo(x, z) { // integer cell
  const cx = x + 0.5, cz = z + 0.5, r = Math.hypot(cx, cz), R = islandR(cx, cz);
  if (r >= R) return null;
  const e = 1 - (r / R) * (r / R);
  let depth = 3 + 34 * Math.pow(e, 0.72) * (0.7 + 0.6 * fbm(cx / 15 + 3, cz / 15 - 8));
  depth += 9 * Math.max(0, noise2(cx / 2.7 + 40, cz / 2.7) - 0.68) / 0.32 * Math.min(1, e * 4);
  const dz = cz - riverZ(cx), adz = Math.abs(dz);
  let type, top = 0;
  if (adz < RIVER_HW) { type = T_WATER; top = -2; }
  else if (adz < RIVER_HW + 2) type = T_QUAY;
  else if (cx > YARD.x0 && cx < YARD.x1 && cz > YARD.z0 && cz < YARD.z1) type = T_DIRT;
  else if (r > R - 3.5 - 2 * noise2(cx / 5, cz / 5)) type = T_GRASS;
  else type = T_PAVE;
  return { top, bottom: -Math.max(3, Math.round(depth)), type };
}
const cols = new Map();
const ckey = (x, z) => (x + 200) * 512 + (z + 200);
for (let x = -GR; x < GR; x++) for (let z = -GR; z < GR; z++) { const c = columnInfo(x, z); if (c) cols.set(ckey(x, z), c); }
const colAt = (x, z) => cols.get(ckey(Math.floor(x), Math.floor(z)));
const isLand = (x, z) => { const c = colAt(x, z); return !!c && c.type !== T_WATER; };

const STRATA = [0xb39263, 0x9c7b52, 0xa88a66, 0x8b8078, 0x77706e, 0x625c63, 0x4f4852, 0x5d5560];
function voxColor(c, x, y, z) {
  const j = 0.9 + 0.2 * hash3(x, y, z);
  if (y === c.top - 1) {
    if (c.type === T_WATER) return tint(0x3f8fa6, 0.92 + 0.16 * noise2(x / 3 + 5, z / 1.5));
    if (c.type === T_DIRT) return tint(0xc09a6a, 0.86 + 0.26 * fbm(x / 6, z / 6) + 0.06 * hash2(x, z));
    if (c.type === T_PAVE) return tint(0xcbbfa6, 0.93 + 0.12 * hash2(x, z));
    if (c.type === T_GRASS) return tint(0x86a653, 0.85 + 0.3 * noise2(x / 4, z / 4));
    if (c.type === T_QUAY) return tint(0xc4bba8, 0.92 + 0.12 * hash2(x, z));
  }
  if (c.type === T_QUAY && y >= -4) return tint(0xb3aa98, 0.85 + 0.2 * hash3(x, y, z));
  if (y >= -2) return tint(0x8c6b47, j);
  if (y >= -4) return tint(0x775739, j);
  const band = Math.floor((-y - 4 + 5 * noise2(x / 11 + 20, z / 11)) / 3.2);
  return tint(STRATA[Math.min(STRATA.length - 1, Math.max(0, band)) ], j);
}
const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];
let riverXL = 0, riverXR = 0;
for (let x = -GR; x < GR; x++) for (let z = -GR; z < GR; z++) {
  const c = cols.get(ckey(x, z)); if (!c) continue;
  if (c.type === T_WATER) { riverXL = Math.min(riverXL, x); riverXR = Math.max(riverXR, x + 1); }
  const nb = NB.map(([dx, dz]) => cols.get(ckey(x + dx, z + dz)));
  for (let y = c.bottom; y < c.top; y++) {
    let exposed = y === c.top - 1 || y === c.bottom;
    if (!exposed) for (const n of nb) if (!n || y < n.bottom || y >= n.top) { exposed = true; break; }
    if (exposed) VOX.box(x + 0.5, y + 0.5, z + 0.5, 1, 1, 1, voxColor(c, x, y, z));
  }
}

// ---------- Pont d'Iena style arched bridge ----------
const BRIDGE = { x0: -3, x1: 3, zc: riverZ(0) };
// deck surface height at world z (carriages follow this)
function bridgeY(z) {
  const d = Math.abs(z - BRIDGE.zc);
  return 2 * smooth((RIVER_HW + 5.5 - d) / 4.5);
}
(function buildBridge() {
  const zc = Math.round(BRIDGE.zc - 0.5);
  for (let x = BRIDGE.x0; x < BRIDGE.x1; x++) for (let dz = -10; dz <= 10; dz++) {
    const z = zc + dz, deckTop = Math.round(bridgeY(z + 0.5));
    const edge = x === BRIDGE.x0 || x === BRIDGE.x1 - 1;
    const over = Math.abs(dz) <= 5;
    if (!over) { // ramps on land
      for (let y = 0; y < deckTop; y++) VOX.box(x + 0.5, y + 0.5, z + 0.5, 1, 1, 1, tint(0xc9c0ad, 0.94 + 0.1 * hash3(x, y, z)));
    } else {
      const a = ((dz + 5) % 4); // 0,1,2 arch cells, 3 = pier
      const open = a === 3 ? 0 : (a === 1 ? 3 : 2);
      for (let y = -2 + open; y < 2; y++) VOX.box(x + 0.5, y + 0.5, z + 0.5, 1, 1, 1, tint(y === 1 ? 0xcfc6b2 : 0xbcb3a0, 0.94 + 0.1 * hash3(x, y, z)));
      if (a === 3) for (let y = -4; y < -2; y++) VOX.box(x + 0.5, y + 0.5, z + 0.5, 1, 1, 1, 0xa9a08e);
    }
    if (edge && deckTop > 0) { // parapet
      const px = x === BRIDGE.x0 ? x + 0.2 : x + 0.8;
      WOOD.box(px, deckTop + 0.3, z + 0.5, 0.4, 0.6, 1.02, 0xd6cdb9);
      if (dz % 5 === 0) { WOOD.box(px, deckTop + 1.2, z + 0.5, 0.14, 1.6, 0.14, 0x33312f); WOOD.box(px, deckTop + 2.1, z + 0.5, 0.34, 0.34, 0.34, 0xf2e3b0); }
    }
  }
})();

// waterfalls spilling off both ends of the Seine (static sheet; animated drops are added per frame)
const FALLS = [];
for (const xe of [riverXL, riverXR - 1]) {
  const zc = riverZ(xe + 0.5), sgn = xe < 0 ? -1 : 1;
  FALLS.push({ x: xe + 0.5 + sgn * 1.0, z: zc, sgn });
  for (let dz = -5; dz <= 5; dz++) for (let k = 0; k < 2; k++)
    VOX.box(xe + 0.5 + sgn * (1 + k * 0.3), -2.5 - k, Math.floor(zc) + dz + 0.5, 1, 1, 1, tint(0x6fb3c4, 0.95 + 0.1 * hash2(dz, k)));
}
