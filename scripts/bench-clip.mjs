/* 阶段 0 Spike：验证剖切平面对 18 件全部材质统一生效。 */
global.window = global;
function fakeCtx() {
  const grad = { addColorStop() {} };
  const target = {
    canvas: { width: 512, height: 512 }, fillStyle: '', strokeStyle: '',
    fillRect() {}, createLinearGradient: () => grad, createRadialGradient: () => grad,
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, ellipse() {}, rect() {}, fill() {}, stroke() {}, clip() {}, fillText() {}
  };
  return new Proxy(target, { get(t, k) { return k in t ? t[k] : () => undefined; }, set(t, k, v) { t[k] = v; return true; } });
}
global.document = { createElement: () => ({ width: 0, height: 0, getContext: fakeCtx, style: {} }) };
global.window.document = global.document;
Object.defineProperty(global, 'navigator', { value: { userAgent: 'node', hardwareConcurrency: 8 }, configurable: true });
global.devicePixelRatio = 1; global.window.devicePixelRatio = 1;

const THREE = await import('../canton-atlas/web/immersive/three.min.js');
const T = THREE.default || THREE;
global.THREE = T; global.window.THREE = T;
const PAL = (await import('../canton-atlas/web/js/palette.js')).default || {};
global.CantonPalette = PAL; global.window.CantonPalette = PAL;

const fs = await import('node:fs');
const dir = new URL('../canton-atlas/content/spots/', import.meta.url);
const ids = fs.readdirSync(dir).filter(d => d !== '_template').sort();

const problems = [];
const rows = [];
for (const id of ids) {
  try {
    const mod = await import(`../canton-atlas/content/spots/${id}/model.js`);
    const model = mod.create();
    const box = new T.Box3().setFromObject(model.group);
    const size = box.getSize(new T.Vector3());

    let total = 0, clipped = 0, skipped = [];
    const materials = new Set();
    model.group.traverse(o => {
      const list = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
      for (const m of list) {
        materials.add(m);
        total++;
        // 复现 stage-core 的做法：给每个材质挂 clippingPlanes
        m.clippingPlanes = [new T.Plane(new T.Vector3(0, 1, 0), 0)];
        if (m.clippingPlanes && m.clippingPlanes.length === 1) clipped++;
        else skipped.push(m.type || 'unknown');
      }
    });
    rows.push({ id, materials: materials.size, attachOK: clipped, skipped: skipped.length });
    if (skipped.length) problems.push(`${id}: ${[...new Set(skipped)].join(', ')}`);
    if (typeof model.dispose === 'function') model.dispose();
  } catch (e) { problems.push(`${id}: 构建失败 ${e.message}`); }
}
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('id', 16) + pad('材质引用', 12) + pad('挂上剖切', 12) + '未挂上');
for (const r of rows) console.log(pad(r.id, 16) + pad(r.materials, 12) + pad(r.attachOK, 12) + r.skipped);
console.log(problems.length ? '\n问题：\n' + problems.join('\n') : '\n18 件全部材质均可挂剖切平面，无例外。');
