/* 阶段 0 Spike 测量：18 件模型 build 耗时 / 三角面 / 尺度。
   Node 中模拟 window 与最小 canvas 2D 桩；仅测 CPU 构建，不含 GPU 渲染。 */
global.window = global;

// 2D 桩：模型只用 canvas 生成程序化贴图，Node 里吞掉所有绘制调用即可
function fakeCtx() {
  const grad = { addColorStop() {} };
  const target = {
    canvas: { width: 512, height: 512 },
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', globalAlpha: 1,
    fillRect() {}, strokeRect() {}, clearRect() {}, drawImage() {},
    fillText() {}, strokeText() {}, measureText: () => ({ width: 0 }),
    createLinearGradient: () => grad, createRadialGradient: () => grad,
    createPattern: () => null, createImageData: () => ({ data: new Uint8ClampedArray(4) }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {},
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, transform() {}, setTransform() {}, resetTransform() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, bezierCurveTo() {},
    quadraticCurveTo() {}, arc() {}, arcTo() {}, ellipse() {}, rect() {},
    fill() {}, stroke() {}, clip() {}, isPointInPath: () => false
  };
  return new Proxy(target, {
    get(t, k) { return k in t ? t[k] : () => undefined; },
    set(t, k, v) { t[k] = v; return true; }
  });
}
global.document = {
  createElement() { return { width: 0, height: 0, getContext: fakeCtx, style: {} }; },
  createElementNS() { return { width: 0, height: 0, getContext: fakeCtx, style: {} }; },
  querySelector: () => null, querySelectorAll: () => []
};
global.window.document = global.document;
Object.defineProperty(global, 'navigator', { value: { userAgent: 'node', hardwareConcurrency: 8 }, configurable: true });
global.devicePixelRatio = 1;
global.window.devicePixelRatio = 1;

const THREE = await import('../canton-atlas/web/immersive/three.min.js');
const T = THREE.default || THREE;
global.THREE = T;
global.window.THREE = T;

const PAL = (await import('../canton-atlas/web/js/palette.js')).default || {};
global.CantonPalette = PAL;
global.window.CantonPalette = PAL;

const fs = await import('node:fs');
const dir = new URL('../canton-atlas/content/spots/', import.meta.url);
const ids = fs.readdirSync(dir).filter(d => d !== '_template').sort();

const rows = [];
for (const id of ids) {
  for (let attempt = 0; attempt < 3; attempt++) { // 取最好一次，隔离 JIT 冷启动
    const t0 = performance.now();
    try {
      const mod = await import(`../canton-atlas/content/spots/${id}/model.js`);
      const model = mod.create();
      const t1 = performance.now();
      if (attempt === 2) {
        let tris = 0, meshes = 0;
        model.group.traverse(o => {
          if (o.geometry && o.geometry.attributes && o.geometry.attributes.position) {
            meshes++;
            const n = o.geometry.attributes.position.count;
            tris += o.index ? o.index.count / 3 : n / 3;
          }
        });
        const box = new T.Box3().setFromObject(model.group);
        const size = box.getSize(new T.Vector3());
        rows.push({ id, buildMs: Math.round(t1 - t0), tris: Math.round(tris), meshes, m: Math.round(Math.max(size.x, size.y, size.z)) });
      }
      if (typeof model.dispose === 'function') model.dispose();
    } catch (e) {
      rows.push({ id, buildMs: -1, tris: 0, meshes: 0, m: 0, err: e.message });
      break;
    }
  }
}
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('id', 16) + pad('buildMs', 9) + pad('tris', 10) + pad('meshes', 8) + 'maxDim(m)');
for (const r of rows) {
  console.log(pad(r.id, 16) + pad(r.buildMs < 0 ? 'FAIL' : r.buildMs + 'ms', 9) + pad(r.tris.toLocaleString('en-US'), 10) + pad(r.meshes, 8) + (r.m || '-') + (r.err ? '  ' + r.err : ''));
}
const slow = rows.filter(r => r.buildMs > 120);
const failed = rows.filter(r => r.buildMs < 0);
console.log(`\n合计 ${rows.length} 件 · 失败 ${failed.length} · >120ms ${slow.length}${slow.length ? '：' + slow.map(r => `${r.id} ${r.buildMs}ms`).join(', ') : ''}`);
