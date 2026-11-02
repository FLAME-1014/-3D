# 广州塔 · 纯外观 1:1 近景 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `canton-atlas` 里新增广州塔纯外观 1:1 近景（`canton-tower.html`）：塔基/南广场、滨水大台阶、仰视 24 柱 × 46 环 × 1104 斜撑的扭转网格、450 m 观景层外景、塔顶摩天轮/488 m 平台/桅杆、珠江南岸与海心桥、花城中轴北望；三档时段、7 视点、7 热点、4K、移动端，接入图鉴 `canton-tower` 与城市 POC `tower`。

**Architecture:** 沿用 `memorial.*` / `yongqingfang.*` 的单页近景架构：`canton-tower-textures.js` 程序化生成纹理，`canton-tower-model.js` 用参数化直柱 + 环梁 + 实例化斜撑建塔身与场景，`canton-tower-main.js` 负责渲染、运镜、视点、时段、热点、4K 与 `CantonTowerDebug`。塔身网格全部用 InstancedMesh 或手工合并 BufferGeometry，不依赖 `BufferGeometryUtils`；城市/树/斜撑/球舱用实例化；不修改现有 7 个近景与城市 POC 的模型。

**Tech Stack:** Three.js（共享 `immersive/three.min.js`）、原生 JS/HTML/CSS、Node 24（内置 WebSocket/fetch）CDP 验收、Chrome 1440×900 / 390×844、Node 静态服务器 `.preview/atlas-server.mjs`。

**Spec:** [docs/superpowers/specs/2026-10-31-canton-tower-design.md](file:///C:/Users/Administrator/Documents/Qoder/2026-10-31/canton-tower-build/docs/superpowers/specs/2026-10-31-canton-tower-design.md)

## Global Constraints

- 坐标：1 场景单位 = 1 米；塔中心 (0,0,0)；+Z 南、-Z 北、+X 东、-X 西；地面/广场 y=0；塔身主体 454 m；桅杆顶 600 m。
- 塔身/塔基/南岸/海心桥 1:1；北岸 CBD 在 z ≤ -800 m 后按约 0.6× 压缩；所有页面标注「示意压缩，非测绘」。
- 内部/电梯/旋转餐厅/影院/商店/登塔流程不做；`deck`/`crown` 是无人机示意视点，`axis` 是 450 m 平台固定视点；about 必须写明。
- 所有纹理程序化生成，不下载外部图片作为贴图；参考图只做内部观察，不进入站点资源。
- 三档时段内部名固定 `day` / `dusk` / `night`；UI 文案「晴日」「黄昏」「夜景」；按钮循环 day → dusk → night → day；`night` 视点强制夜景。
- 塔身网格必须用 InstancedMesh 或合并几何；报告 `CantonTowerDebug.lattice` 与 `counts`；桌面 draw calls ≤ 150、triangles ≤ 150k；移动 draw calls ≤ 100、triangles ≤ 90k。
- 性能目标：桌面 1440×900 固定视点 60fps；移动 390×844 固定视点 60fps；切换瞬态不低于 50fps；0 console error；无横向溢出。
- 4K：3840×2160 渲染 + PNG blob；移动端提示建议桌面；验收区分 blob 生成与文件落盘。
- 此工作区不是 git 仓库：不 commit；每个任务以「CDP 截图 + console 0 报错 + counts/fps + TaskUpdate」为检查点。
- 本计划在独立副本执行；Task 8 只在主会话批准后执行，共享文件（`app.js` / `immersive/main.js`）只通过主项目合并；不发布。
- 事实/尺寸以 `research/2026-10-31-canton-tower-facts.md` 为准；营销高度（摩天轮 460 m、速降 480 m）必须与设施高度（450–454 m、455–485 m）同时出现。
- 本地服务端口 4184；Chrome CDP 端口 9338；截图写 `.preview/`；研究阶段不启动服务/Chrome，建造阶段再执行。

## File Structure

- Create: `canton-atlas/web/immersive/canton-tower.html` — 页面结构、HUD、7 视点栏、intro、about、脚本引用。
- Create: `canton-atlas/web/immersive/canton-tower.css` — 由 `memorial.css` 复制，改深青/钢灰/暖金变量；移动端断点。
- Create: `canton-atlas/web/immersive/canton-tower-textures.js` — `window.CantonTowerTextures.build(renderer)`：钢、玻璃分格、花岗岩/涟漪铺装、混凝土、水、树叶/树皮、城市窗光、航空条纹、glow。
- Create: `canton-atlas/web/immersive/canton-tower-model.js` — `window.CantonTowerModel.build({textures, low})`：塔身、塔基、广场、滨水、江/桥、城市、灯光、热点锚点。
- Create: `canton-atlas/web/immersive/canton-tower-main.js` — `window.CantonTowerDebug`：渲染、相机、视点、运镜、热点 DOM、时段、4K、移动端。
- Create: `.preview/cdp-canton-tower-smoke.js` — 页面加载/骨架验收。
- Create: `.preview/cdp-canton-tower-views.js` — 7 视点 × 3 时段、热点、counts/fps、console 验收。
- Create: `.preview/cdp-canton-tower-mobile.js` — 390×844 验收。
- Create: `.preview/cdp-canton-tower-4k.js` — 4K blob 尺寸验收。
- Create: `.preview/cdp-canton-tower-integration.js` — 图鉴/城市互跳（Task 8）。
- Read-only reference: `docs/superpowers/research/2026-10-31-canton-tower-facts.md`、`docs/superpowers/specs/2026-10-31-canton-tower-design.md`、`canton-atlas/web/immersive/memorial.*`、`.preview/atlas-server.mjs`、`.preview/cdp-scene-check.js`。
- Modify only Task 8 (after approval): `canton-atlas/web/app.js`、`canton-atlas/web/immersive/main.js`。

---

### Task 1: 页面骨架 + 天空/江面/主循环 + Debug

**Files:**
- Create: `canton-atlas/web/immersive/canton-tower.html`
- Create: `canton-atlas/web/immersive/canton-tower.css`
- Create: `canton-atlas/web/immersive/canton-tower-textures.js`
- Create: `canton-atlas/web/immersive/canton-tower-model.js`
- Create: `canton-atlas/web/immersive/canton-tower-main.js`
- Test: `.preview/cdp-canton-tower-smoke.js`

**Interfaces:**
- Produces:
  - `window.CantonTowerTextures.build(renderer)` → `{ steel, steelDark, glassGrid, granite, ripplePaving, concrete, water, leaf, trunk, cityWindow, aviation, glow }`（THREE.Texture）。
  - `window.CantonTowerModel.build({ textures, low })` → `{ root, hotspots, materials, waterMat, lattice, cityMats, bounds }`。
  - `window.CantonTowerDebug` getters：`fps`, `mode`, `view`, `time`, `renderer`, `scene`, `camera`, `model`, `counts`, `lattice`；方法：`go(name)`, `look(pos,target)`, `timeOfDay(name)`, `open(id)`, `shot4K()`。
- Consumes: 共享 `three.min.js`；facts/spec 的文案与尺寸；`memorial.html/css/main` 的 HUD/DOM 结构。

- [ ] **Step 1: 复制页面并替换文案**

Run:

```bash
cp canton-atlas/web/immersive/memorial.html canton-atlas/web/immersive/canton-tower.html
cp canton-atlas/web/immersive/memorial.css canton-atlas/web/immersive/canton-tower.css
```

在 `canton-tower.html` 做精确替换：

- `<title>` → `广州塔 | CANTON ATLAS 近景`。
- description → `广州塔纯外观 1:1 近景 3D：塔基/南广场、滨水大台阶、24 柱 × 46 环 × 1104 斜撑扭转网格、450 m 观景层、塔顶摩天轮/488 m 平台/146 m 桅杆、珠江南岸与海心桥、花城中轴北望；晴日/黄昏/夜景三档。内部/电梯/餐厅不做，北岸 CBD 为示意压缩。`
- favicon 文字 `堂` → `塔`；填色 `%232f5f8a` → `%231b2f3a`。
- `memorial.css` → `canton-tower.css`。
- brand：`<span class="seal">塔</span>`；`<strong>广州塔</strong>`；`<small>CANTON TOWER · 1:1 近景</small>`。
- scene-label → `600 米扭转双曲面 · 珠江边的城市坐标`。
- stamp-strip → `600 m 总高`、`454 + 146 m`、`24 / 46 / 1104`、`450 / 488 m`。
- top-actions：`timeBtn` 初始「晴日」；`replayBtn`「重播运镜」；`shotBtn`「4K 截图」；`aboutBtn`「考据」；把 memorial 的 `<button id="yuexiuBtn" type="button">越秀顶层 ↗</button>` 精确替换为 `<button id="cityBtn" type="button">城市全景 ↗</button>`；不要再保留 `yuexiuBtn`。
- view-rail 7 个按钮：

```html
<button type="button" data-view="base" class="active">塔基</button>
<button type="button" data-view="lattice">塔身</button>
<button type="button" data-view="deck">观景层</button>
<button type="button" data-view="crown">塔顶</button>
<button type="button" data-view="river">南岸</button>
<button type="button" data-view="axis">中轴</button>
<button type="button" data-view="night">夜景</button>
```

- intro：eyebrow `CANTON ATLAS · 近景档案 08`；h1 `广州塔<em>600 米的扭转与收腰</em>`；lede 按 facts 写「总高 600 m、塔身 454 m、天线 146 m；24 根直斜柱扭转成 24/46/1104 的镂空网格；450 m 观景层、450–454 m 摩天轮、488 m 桅杆平台；纯外观，不做内部/电梯/餐厅。」
- intro-meta：`600 m`、`454 + 146 m`、`24 / 46 / 1104`、`450 / 488 m`。
- footer chapter → `01 / 塔基 · 南广场与滨水`；scale-note → `1 场景单位 = 1 米 · 塔身/塔基/南岸 1:1 · 北岸 CBD 距离压缩示意 · 内部/电梯/餐厅不做`。
- loading → `正在立塔、铺江岸…`。
- about 面板：尺度（600/454/146/80×60/30/54×40.5/24/46/1104）、序列（7 视点）、取舍（纯外观、北岸压缩、灯光示意、纹理程序化）、资料（facts 文档官方链接）。
- 脚本引用 → `canton-tower-textures.js`、`canton-tower-model.js`、`canton-tower-main.js`。
- 删除 memorial 专属的「越秀顶层 ↗」按钮，改 `cityBtn`；如果没有 `cityBtn`，在 `top-actions` 加一个 `<button id="cityBtn" type="button">城市全景 ↗</button>`。

- [ ] **Step 2: 改 CSS 变量与移动端断点**

在 `canton-tower.css` 只改 `:root` 和必要的移动端规则，其余沿用 memorial：

```css
:root {
  --ink: #050a10;
  --ink-2: #0a121a;
  --paper: #eef2f4;
  --paper-soft: rgba(238, 242, 244, 0.74);
  --paper-faint: rgba(238, 242, 244, 0.42);
  --line: rgba(238, 242, 244, 0.18);
  --accent: #6fb7c8;
  --accent-2: #9fd3dd;
  --gold: #d8b46a;
  --teal: #2f7f86;
}
```

- 移动端保留 memorial 的 rail 横向滚动/卡片底部抽屉；确认 `canvas` 不被 HUD 遮挡；`--rail` 高度不超 64px。

- [ ] **Step 3: 程序化纹理骨架**

创建 `canton-tower-textures.js`，用 memorial-textures 的 `canvasTexture(draw, w, h, repeatX, repeatY)` 方式生成：

```js
(function () {
  "use strict";
  function canvasTexture(draw, w, h, rx, ry) {
    var c = document.createElement("canvas");
    c.width = w || 512; c.height = h || 512;
    draw(c.getContext("2d"), c.width, c.height);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx || 1, ry || 1);
    t.anisotropy = 4;
    return t;
  }
  function build(renderer) {
    var steel = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#d9dde0"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 900; i++) {
        ctx.fillStyle = "rgba(90,105,115," + (0.02 + Math.random() * 0.05) + ")";
        ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
      }
    }, 256, 256, 2, 2);
    var glassGrid = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#6f96a8"; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(225,240,245,0.35)"; ctx.lineWidth = 2;
      for (var x = 0; x < w; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (var y = 0; y < h; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.strokeStyle = "rgba(225,240,245,0.22)";
      for (var d = -h; d < w; d += 96) { ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + h, h); ctx.stroke(); }
    }, 512, 512, 4, 8);
    // 其余纹理按同一模式：granite / ripplePaving / concrete / water / leaf / trunk / cityWindow / aviation / glow
    return { steel: steel, steelDark: steel, glassGrid: glassGrid, granite: steel, ripplePaving: steel, concrete: steel, water: steel, leaf: steel, trunk: steel, cityWindow: steel, aviation: steel, glow: steel };
  }
  window.CantonTowerTextures = { build: build };
})();
```

说明：上面为骨架，实际每个 key 必须画成对应纹理（不能全部指向 steel）。纹理清单：

- `steel` / `steelDark`：256×256，浅灰 `#d9dde0` 底 + 1px 颗粒 + 轻微竖向拉丝；`steelDark` 用 `#9aa4aa`（环梁/节点/杆件阴影面）。
- `glassGrid`：512×512，蓝灰 `#6f96a8` 底 + 64px 竖梃 / 48px 横梃 + 斜向分格线；透明度由材质控制。
- `granite`：512×512，浅灰 `#c9c5bc` + 1–2px 颗粒 + 每 128px 一道板缝。
- `ripplePaving`：512×512，暖灰 `#cfcac0` + 3–4 圈同心弧线（`#b8b2a6`）+ 细颗粒；用于广场涟漪/台阶。
- `concrete`：256×256，中灰 `#9e9e98` + 孔隙/水渍条纹。
- `water`：512×512，深青灰 `#1e3a46` + 横向细波纹/噪声；配合水面 shader。
- `leaf`：256×256，绿色斑驳 `#4f6b47`/`#6f8a58`；`trunk`：`#6b5642` 竖向条纹。
- `cityWindow`：512×512，暗底 `#1a2530` + 2×3px 随机暖窗 `#ffd9a0` / 冷窗 `#bcd8ff`；白天用材质 color 压暗。
- `aviation`：256×256，红 `#d9483b` / 白 `#f2f2f2` 横条；用于桅杆顶部/航空色。
- `glow`：128×128，白色径向渐变到透明；用于灯带/光斑 Sprite。

- [ ] **Step 4: 模型/主循环/Debug 骨架**

创建 `canton-tower-model.js`：

```js
(function () {
  "use strict";
  function build(opts) {
    var textures = opts.textures, low = !!opts.low;
    var root = new THREE.Group(); root.name = "canton-tower";
    var materials = {};
    var hotspots = [];
    var waterMat = new THREE.MeshBasicMaterial({ color: 0x1b3a46 });
    // buildGround(); buildRiver(); buildTower(); buildBase(); buildPlaza(); buildBridges(); buildCity(); buildHotspots();
    return { root: root, hotspots: hotspots, materials: materials, waterMat: waterMat, lattice: null, cityMats: {}, bounds: new THREE.Box3(new THREE.Vector3(-1600, 0, -2600), new THREE.Vector3(1600, 620, 400)) };
  }
  window.CantonTowerModel = { build: build };
})();
```

创建 `canton-tower-main.js`，按 memorial-main 的结构（renderer/scene/camera/clock/sky/lights/loop）先接：

```js
(function () {
  "use strict";
  var canvas = document.getElementById("scene");
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.matchMedia("(max-width: 820px)").matches ? 1.35 : 1.85));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.outputEncoding = THREE.sRGBEncoding;
  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x9fb8c8, 0.00028);
  var camera = new THREE.PerspectiveCamera(window.innerWidth < 820 ? 62 : 55, window.innerWidth / window.innerHeight, 0.5, 6000);
  camera.position.set(-300, 2, -70);
  camera.lookAt(0, 190, 0);
  var sun = new THREE.DirectionalLight(0xfff3df, 2.2); sun.position.set(-320, 520, 240); scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbcd7ea, 0x3b4a43, 1.1));
  scene.add(new THREE.AmbientLight(0xffffff, 0.22));
  var textures = window.CantonTowerTextures.build(renderer);
  var model = window.CantonTowerModel.build({ textures: textures, low: window.innerWidth < 820 });
  scene.add(model.root);
  function loop() { requestAnimationFrame(loop); renderer.render(scene, camera); }
  loop();
  window.CantonTowerDebug = {
    get fps() { return 60; }, get mode() { return "free"; }, get view() { return "river"; }, get time() { return "day"; },
    get renderer() { return renderer; }, get scene() { return scene; }, get camera() { return camera; }, get model() { return model; },
    get counts() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries }; },
    get lattice() { return model.lattice; },
    go: function () {}, look: function () {}, timeOfDay: function () {}, open: function () {},
    shot4K: function () { return Promise.resolve({ width: 0, height: 0, bytes: 0 }); }
  };
})();
```

说明：这是骨架；Task 2–6 会把 build/view/time/4K 填实。`fps` 先返回 60，Task 1 结束前用真实计数替换（见 Step 6）。

- [ ] **Step 5: 启动服务 + Chrome**

Run（后台）：

```bash
cd C:/Users/Administrator/Documents/Qoder/2026-10-31/canton-tower-build
PORT=4184 node .preview/atlas-server.mjs
```

Chrome（按主会话现有路径，端口 9338）：

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --remote-debugging-port=9338 --user-data-dir="C:/Users/Administrator/Documents/Qoder/2026-10-31/canton-tower-build/.preview/chrome-profile-canton-tower" --no-first-run --new-window "about:blank"
```

- [ ] **Step 6: 冒烟验收**

Run:

```bash
node .preview/cdp-scene-check.js 9338 "http://127.0.0.1:4184/immersive/canton-tower.html?embed=1" CantonTowerDebug .preview/canton-tower-smoke.png 12000
```

Expected JSON：

- `title` 含「广州塔」；`introHidden: true`；`canvas: [[1440,900]]`；`errors: 0`；`overflowX: false`；`hotspots: 0`（Task 6 前）或 7（Task 6 后）。
- `counts.calls` < 30（骨架：地面/江面/天空）；`counts.triangles` < 5k。

- [ ] **Step 7: 记录检查点**

更新 Task 1 完成；把 smoke JSON 与截图路径写入任务备注；若 WebGL 初始化失败，先检查 `three.min.js` 与 canvas id，不要继续 Task 2。

---

### Task 2: 塔身参数化网格 + 塔基

**Files:**
- Modify: `canton-atlas/web/immersive/canton-tower-model.js`
- Modify: `canton-atlas/web/immersive/canton-tower-textures.js`
- Test: `.preview/cdp-canton-tower-smoke.js`

**Interfaces:**
- Consumes: Task 1 的 `textures`/`root`/`materials`。
- Produces: `model.lattice = { group, columns, rings, diagonals, nodes, stats, measureWaist() }`；`CantonTowerDebug.lattice` 返回 `{columns:24, rings:46, ringLevels:47, diagonals:1104, drawCalls:4, triangles:...}`。

- [ ] **Step 1: 写塔身参数化代码**

在 `canton-tower-model.js` 插入（替换 `build` 里的塔身注释）：

```js
var N = 24, BODY_H = 454, RING_GROUPS = 46, RING_LEVELS = 47;
var BASE = { a: 40, b: 30, rot: 135 * Math.PI / 180 };   // 底部椭圆，长轴 NW
var TOP  = { a: 27, b: 20.25, rot: 180 * Math.PI / 180 }; // 顶部椭圆，长轴 N
var TOP_CENTER = new THREE.Vector3(10, 0, 0);            // 中心相错 10 m（方向示意）
var ZERO = new THREE.Vector3(0, 0, 0);

function ellipsePoint(e, t, y, center) {
  var x = e.b * Math.cos(t) * Math.cos(e.rot) - e.a * Math.sin(t) * Math.sin(e.rot);
  var z = e.b * Math.cos(t) * Math.sin(e.rot) + e.a * Math.sin(t) * Math.cos(e.rot);
  return new THREE.Vector3(center.x + x, y, center.z + z);
}
function bottomPoint(i) { return ellipsePoint(BASE, (90 + i * 15) * Math.PI / 180, 0, ZERO); }
function topPoint(i) { return ellipsePoint(TOP, (180 + i * 15) * Math.PI / 180, BODY_H, TOP_CENTER); }
function pointAt(i, y) {
  var t = y / BODY_H;
  return bottomPoint(i).lerp(topPoint(i), t);
}
function ringYs() {
  var ys = [];
  for (var i = 0; i < RING_LEVELS; i++) ys.push(i * BODY_H / (RING_LEVELS - 1));
  return ys;
}
```

- [ ] **Step 2: 24 柱 InstancedMesh（1 draw call）**

先建塔身组和共享材质：

```js
var latticeGroup = new THREE.Group();
latticeGroup.name = "lattice";
root.add(latticeGroup);
```

然后：

```js
var colGeo = new THREE.CylinderGeometry(0.6, 1, 1, 6, 1, true);
var steelMat = new THREE.MeshStandardMaterial({ map: textures.steel, color: 0xffffff, roughness: 0.45, metalness: 0.5 });
var columns = new THREE.InstancedMesh(colGeo, steelMat, N);
var up = new THREE.Vector3(0, 1, 0);
for (var i = 0; i < N; i++) {
  var a = bottomPoint(i), b = topPoint(i);
  var dir = b.clone().sub(a), len = dir.length();
  var mid = a.clone().add(b).multiplyScalar(0.5);
  var q = new THREE.Quaternion().setFromUnitVectors(up, dir.normalize());
  var m = new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, len, 1));
  columns.setMatrixAt(i, m);
}
columns.instanceMatrix.needsUpdate = true;
columns.castShadow = false; columns.receiveShadow = false;
latticeGroup.add(columns);
```

- [ ] **Step 3: 46 组环梁手工合并（1 draw call）**

用 47 个标高（46 组 + 顶部端环），每环 24 个柱点、Catmull-Rom 闭合曲线、48 段、4 径向；用 `THREE.TubeGeometry(curve, 48, 0.35, 4, true)` 生成后手工合并：

```js
function mergeGeos(geos) {
  var pos = [], nor = [], uv = [], idx = [], off = 0;
  geos.forEach(function (g) {
    var p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv, ix = g.index;
    for (var i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); if (u) uv.push(u.getX(i), u.getY(i)); }
    for (var j = 0; j < ix.count; j++) idx.push(ix.getX(j) + off);
    off += p.count;
  });
  var out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  if (uv.length) out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}
var ringGeos = [];
ringYs().forEach(function (y) {
  var pts = [];
  for (var i = 0; i < N; i++) pts.push(pointAt(i, y));
  var curve = new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.5);
  ringGeos.push(new THREE.TubeGeometry(curve, 48, 0.35, 4, true));
});
var rings = new THREE.Mesh(mergeGeos(ringGeos), steelMat);
ringGeos.forEach(function (g) { g.dispose(); });
latticeGroup.add(rings);
```

- [ ] **Step 4: 1104 斜撑 InstancedMesh（1 draw call）**

```js
var diagGeo = new THREE.CylinderGeometry(0.32, 0.32, 1, 4, 1, true);
var diagonals = new THREE.InstancedMesh(diagGeo, steelMat, 1104);
var ys = ringYs(), di = 0;
for (var j = 0; j < RING_LEVELS - 1; j++) {
  var sign = (j % 2 === 0) ? 1 : -1;
  for (var i = 0; i < N; i++) {
    var a = pointAt(i, ys[j]);
    var b = pointAt((i + sign + N) % N, ys[j + 1]);
    var dir = b.clone().sub(a), len = dir.length();
    var mid = a.clone().add(b).multiplyScalar(0.5);
    var q = new THREE.Quaternion().setFromUnitVectors(up, dir.normalize());
    diagonals.setMatrixAt(di++, new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, len, 1)));
  }
}
diagonals.count = di; diagonals.instanceMatrix.needsUpdate = true;
latticeGroup.add(diagonals);
```

Expected `di === 1104`（46 bays × 24）。若用 47 levels，bays=46；不要用 46 levels 得 1080。

- [ ] **Step 5: 节点（可选，1 draw call）**

```js
var nodeGeo = new THREE.OctahedronGeometry(0.45, 0);
var nodes = new THREE.InstancedMesh(nodeGeo, steelMat, N * RING_LEVELS);
var ni = 0;
ys.forEach(function (y) {
  for (var i = 0; i < N; i++) {
    var p = pointAt(i, y);
    nodes.setMatrixAt(ni++, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z));
  }
});
nodes.instanceMatrix.needsUpdate = true;
latticeGroup.add(nodes);
```

移动端可 `nodes.visible = false` 或 count 减半；桌面保留。

- [ ] **Step 6: 腰部测量与调参**

```js
function measureWaist() {
  var best = Infinity, at = 0, samples = [];
  for (var k = 0; k <= 452; k += 2) {
    var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (var i = 0; i < N; i++) {
      var p = pointAt(i, k);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    }
    var width = Math.max(maxX - minX, maxZ - minZ);
    if (width < best) { best = width; at = k; }
    if (k % 40 === 0) samples.push({ y: k, width: +width.toFixed(1) });
  }
  return { waist: +best.toFixed(1), at: at, samples: samples };
}
```

Expected：`waist` 在 26–36 m 之间（目标约 30 m），`at` 在 240–320 m。若不在范围，先调 `TOP_CENTER.x`（8–12 m）或 `BASE.rot`（120–150°），不要改 24/46/1104；每次调参后重新截图，记录最终值。

- [ ] **Step 7: 塔基裙摆/玻璃大厅/核心筒**

- 塔基：24 根白色斜柱/肋，从底部椭圆向外张开，顶部收在 y≈25 m 的环；用 InstancedMesh 或手工管；白色/浅灰钢；底部玻璃大厅（椭圆筒，透明玻璃，深色框架），不做内部。
- 核心筒：17 × 14 m 椭圆筒，深灰，顶部 454 m；用 `CylinderGeometry` 椭圆缩放或自定义椭圆筒；加 5–6 条功能带（浅灰/深色水平环）和窗带程序纹理。
- 玻璃带：5–6 条半透明蓝灰玻璃壳（`MeshStandardMaterial`，transparent，opacity 0.18–0.28，depthWrite:false，side:DoubleSide），只覆盖功能段，不覆盖整个塔身。
- 塔身 `latticeGroup` 命名 `lattice`；`model.lattice = { group: latticeGroup, columns: columns, rings: rings, diagonals: diagonals, nodes: nodes, stats: { columns: 24, rings: 46, ringLevels: 47, diagonals: di, drawCalls: 4, triangles: 0 }, measureWaist: measureWaist }`。
- `triangles` 在构建后算：
```js
function triCount(geo, instances) {
  var per = ((geo.index ? geo.index.count : geo.attributes.position.count) / 3);
  return per * instances;
}
var statsTriangles = triCount(columns.geometry, 24) + triCount(rings.geometry, 1) + triCount(diagGeo, di) + triCount(nodeGeo, ni);
```
写入 stats；`nodeGeo` 可选时按实际 instances 计算。

- [ ] **Step 8: 验收**

Run:

```bash
node .preview/cdp-scene-check.js 9338 "http://127.0.0.1:4184/immersive/canton-tower.html?embed=1" CantonTowerDebug .preview/canton-tower-lattice.png 12000
```

然后在 CDP 中执行：

```js
CantonTowerDebug.look([60,2,65],[0,240,0]);
CantonTowerDebug.counts;
CantonTowerDebug.lattice.stats;
```

Expected：

- `lattice.stats.columns === 24`；`rings === 46`；`diagonals === 1104`；`drawCalls <= 4`（columns/rings/diagonals/nodes）。
- `counts.calls` < 30（塔身+基座+骨架）；`counts.triangles` < 60k。
- 截图 `canton-tower-lattice.png`：能看出 24 柱、46 环、斜撑菱形、腰部收分、塔基裙摆；无破面/黑面。
- `measureWaist().waist` 26–36 m；记录到任务备注。

---

### Task 3: 观景层、摩天轮、488 平台与桅杆

**Files:**
- Modify: `canton-atlas/web/immersive/canton-tower-model.js`
- Modify: `canton-atlas/web/immersive/canton-tower-textures.js`

**Interfaces:**
- Consumes: `latticeGroup`、`steelMat`、`textures`、`pointAt`。
- Produces: `model.deckGroup`、`model.wheelGroup`、`model.mastGroup`；`CantonTowerDebug.lattice` 不变；新增 `model.crown`（可选）。

- [ ] **Step 1: 450 m 平台与玻璃厅**

- 平台外环：椭圆环（约 60 × 46 m，宽 5–6 m，厚 1.2 m），y=450 m；深灰楼板 + 浅灰边缘；玻璃栏杆 1.2 m（半透明 + 细金属立柱，立柱用 InstancedMesh 或低模）。
- 107F/108F 玻璃厅：428/433 m 两条玻璃带，蓝灰玻璃 + 白色竖框；不建内部；玻璃带可复用 Task 2 的功能带材质。
- 塔顶 450–454 m 屋顶环：深灰金属屋面 + 白色边缘；摩天轮轨道固定在屋顶外缘。

- [ ] **Step 2: 16 舱摩天轮**

- 轨道：椭圆环（半径约 26 × 20 m，y=451 m，管径 0.5 m），金属格栅/深灰；
- 球舱：低模胶囊（圆柱 + 半球/圆角），橙红 `#e2553f`、白顶、蓝色条带；正面/侧面玻璃；每舱约 3 × 2.2 m；
- 用 `InstancedMesh` 16 个舱（1 draw call），按椭圆均匀分布，朝向切向；夜间舱体 emissive 暖色；
- 转动：`wheelGroup.rotation.y += dt * (Math.PI * 2 / (20 * 60))`，约 20 min/圈；移动端可降低到静态或 1/2 速度；
- 不做上下客/机械结构/座椅/人物。

- [ ] **Step 3: 488 m 平台、极速云霄、桅杆**

- 488 平台：白色八角/多边形环台（外径约 12 m，内径约 4 m），y=488 m；底面放射梁 + 细栏杆 + 灯；用低模环 + 栏杆 InstancedMesh。
- 极速云霄：455–485 m 两根垂直导轨 + 一个小轿厢（低模），贴在桅杆南侧；不做完整坠落动画（可静态或 8 s 缓慢上下）。
- 桅杆：454–600 m，下段 454–550 m 白色格构（4–8 根主杆 + 交叉撑，InstancedMesh/合并），上段 550–600 m 白/红白航空条纹锥形/箱形；顶部细尖 + 避雷针；夜间桅杆暖白/金。
- 桅杆底部 10 × 10 m、顶部约 1 × 1 m；用低模锥台 + 格构表达，不逐构件。
- 488 平台在桅杆 488 m，极速云霄在 455–485 m；两者不要与 450 m 平台混淆。

- [ ] **Step 4: 材质/夜间**

- 平台/桅杆白色/浅灰钢；玻璃蓝灰；球舱橙红/白/蓝；488 平台白色；夜间用 emissive/共享 shader 的暖白/金。
- 塔顶 beacon：红色/白色航空灯（夜间闪烁，1 Hz；可用 Sprite/Point，不建灯）。
- 所有塔顶构件 `castShadow=false`；不参与 600 m 阴影。

- [ ] **Step 5: 验收**

Run:

```bash
node .preview/cdp-scene-check.js 9338 "http://127.0.0.1:4184/immersive/canton-tower.html?embed=1" CantonTowerDebug .preview/canton-tower-crown.png 12000
```

CDP：

```js
CantonTowerDebug.look([105,468,100],[0,448,0]);
CantonTowerDebug.look([120,570,160],[0,520,0]);
CantonTowerDebug.counts;
```

Expected：`counts.calls` < 45；`counts.triangles` < 75k；截图中 450 m 平台、16 舱摩天轮、488 平台、速降轨道、桅杆顶可辨；无穿模/黑面；球舱不是透明气泡。

---

### Task 4: 塔基广场、二层平台、滨水大台阶、南广场

**Files:**
- Modify: `canton-atlas/web/immersive/canton-tower-model.js`
- Modify: `canton-atlas/web/immersive/canton-tower-textures.js`

**Interfaces:**
- Consumes: Task 2 的塔基/`textures`；Task 1 的 `root`。
- Produces: `model.plazaGroup`；`model.hotspots` 增加 `steps` 锚点 (0,8,-80)。

- [ ] **Step 1: 二层平台**

- 约 120 × 100 m 的塔周台地，y=7 m；浅灰花岗岩/混凝土铺装；边缘玻璃/金属栏杆；连接塔基玻璃大厅、滨水大台阶、南侧二层市民广场。
- 南侧二层市民广场 y≈7 m、z≈+80 → +260 m（`base` 视点在 z≈185）；z≈+50 → +80 m 为塔基地面前场（`lattice` 视点在 z≈65），两者用台阶/坡道连接。
- 用低模平台 + 台阶/坡道 + 栏杆 InstancedMesh；不建内部商场。
- 平台下可做深色基座/柱子，避免悬空。

- [ ] **Step 2: 滨水大台阶（缤纷粤秀台）**

- 北侧，宽约 150–200 m（按参考图估算），从 y=7 m 落到 y=0.5 m；12–15 级宽踏步，踏步高约 0.15 m、深约 0.4–0.5 m；浅灰石材。
- 细金属扶手（每 6–8 m 一道，InstancedMesh）；白色弧形挡墙/花池；顶部绿化带；中段可做薄型白色悬挑遮阳（示意）。
- 「琴键台阶」暖光灯带：用 emissive 条带/贴图，不逐灯；夜间 2700K。
- 不建人流/座椅/商铺。

- [ ] **Step 3: 南广场/广州塔广场北部**

- 南侧台地/铺装：浅灰/暖灰；中央映塔水池约 30 × 20 m（深色镜面/反射 shader），周围圆形涟漪环（2–3 圈浅色环带）；树阵；白色弧形矮墙/服务亭（低模）。
- 商业体量：两翼 L 形/弧形玻璃+石材盒子，留出中央轴线；只做外壳，不做内部；高度 12–20 m；屋顶绿化可选。
- 树：棕榈/阔叶 2–3 种，InstancedMesh；桌面 80–120 棵，移动 40–60 棵；树池/支撑简化。
- 映塔水池的倒影用假的垂直拖影/深色镜面，不做实时平面反射。

- [ ] **Step 4: 南岸滨水步道/栏杆/花池**

- 南岸线 z≈-125 m，步道 y=0–4 m；白色/浅灰栏杆（细密竖杆，InstancedMesh）、花池、灯柱（球形灯）、树阵；与滨水大台阶衔接。
- 不做车流/行人/商铺。

- [ ] **Step 5: 验收**

Run:

```bash
node .preview/cdp-scene-check.js 9338 "http://127.0.0.1:4184/immersive/canton-tower.html?embed=1" CantonTowerDebug .preview/canton-tower-base.png 12000
```

CDP：

```js
CantonTowerDebug.look([0,9,185],[0,65,0]);
CantonTowerDebug.look([-300,2,-70],[0,190,0]);
CantonTowerDebug.counts;
```

Expected：`counts.calls` < 75；`counts.triangles` < 110k；截图能看到映塔水池/涟漪环/树阵/塔基裙摆/台阶/栏杆；无悬空/穿插；滨水台阶不是一面光墙。

---

### Task 5: 珠江、海心桥、海心沙、花城中轴与 CBD

**Files:**
- Modify: `canton-atlas/web/immersive/canton-tower-model.js`
- Modify: `canton-atlas/web/immersive/canton-tower-textures.js`
- Test: `.preview/cdp-canton-tower-views.js`（先建骨架）

**Interfaces:**
- Consumes: `textures.water`、`textures.cityWindow`、`root`。
- Produces: `model.waterMat`、`model.bridgeGroup`、`model.cityGroup`；`hotspots` 增加 `bridge`、`axis`。

- [ ] **Step 1: 江面 + 南岸线**

- 水面 z=-125 → -700 m（约 575 m），y=-3 m；深青灰；自定义 `ShaderMaterial` 做「塔身颜色竖向拖影 + 细碎波光」，不做实时反射。
- 南岸线/步道/栏杆在 Task 4；补水面与岸线的衔接、台阶/驳岸，不露黑边。
- 雾：`FogExp2` 密度 0.00025–0.00035；远景渐隐。

- [ ] **Step 2: 海心桥**

- 塔西约 400 m（示意）；南起媒体港附近 z≈-90，北接二沙岛艺术公园 z≈-570；全长 488 m、主拱 198 m、桥面宽 15 m。
- 白色钢拱（曲线管/合并管）+ 曲线桥面 + 少量吊杆（InstancedMesh 细圆柱/线）+ 花池/栏杆；桥面高度约 12–15 m（示意）。
- 夜景白色拱 + 暖白灯带；不做桥面铺装细节/人流；不要与黄埔涌桥混做。

- [ ] **Step 3: 海心沙 + 花城中轴**

- 海心沙：z≈-700 → -1300 m；低看台/广场/树阵体量（2–3 个盒子 + 树带），不做亚运场馆内部。
- 花城中轴：z≈-1300 → -2300 m（压缩后）；花城广场绿轴（约 120 × 400 m）、广州大剧院（白色曲面体量）、广东省博物馆（深色盒子）、图书馆（盒子）、东塔 530 m、西塔 438.6 m、中信 391 m。
- 参考摆位（压缩后，示意）：海心沙看台 `(0, 8, -900)`；花城广场轴线 `(0, 0, -1500)`；广州大剧院 `(-110, 0, -1250)`；广东省博物馆 `(+120, 0, -1280)`；广州图书馆 `(+150, 0, -1350)`；西塔 `(-180, 0, -1600)`；东塔 `(+220, 0, -1650)`；中信 `(0, 0, -1950)`。可按画面微调，但必须保持「轴线居中、双塔分列、北端中信」的关系。
- 城市压缩：`farZ = function(z){ return z > -800 ? z : -800 + (z + 800) * 0.6; }`；只压缩 z 距离，x 不变，保持轴线对齐；所有地标 z 值过 `farZ`。
- 实例化城市块：桌面 600、移动 300；高度 20–180 m；避开江面/轴线/地标；窗光纹理/Points；白天剪影 + 雾。
- 地标 6–8 个低模，不做每栋细节；双塔/中信高度按常用值，标注「示意」。

- [ ] **Step 4: 海心桥/猎德/黄埔涌桥的远景**

- 猎德大桥：东侧远景，斜拉/悬索剪影；1–2 个 draw calls；可选。
- 黄埔涌桥：东侧近景白色拱（Task 4/5 可选）；不要与海心桥共用同一拱形位置。
- 游船：1–2 个低模剪影（可选）；不做航线/人流。

- [ ] **Step 5: 验收**

Run:

```bash
node .preview/cdp-scene-check.js 9338 "http://127.0.0.1:4184/immersive/canton-tower.html?embed=1" CantonTowerDebug .preview/canton-tower-city.png 12000
```

CDP：

```js
CantonTowerDebug.look([-300,2,-70],[0,190,0]);
CantonTowerDebug.timeOfDay("dusk");
CantonTowerDebug.look([0,452,-20],[0,250,-1300]);
CantonTowerDebug.counts;
```

Expected：`counts.calls` < 110；`counts.triangles` < 150k；截图中江面/海心桥/海心沙/双塔/中信/花城广场轴线可辨；北岸明显比近景更雾/更压缩；没有把海心桥做成黄埔涌桥。

---

### Task 6: 7 视点、运镜、热点、时段、4K、About

**Files:**
- Modify: `canton-atlas/web/immersive/canton-tower-main.js`
- Modify: `canton-atlas/web/immersive/canton-tower-model.js`（热点锚点/文案）
- Test: `.preview/cdp-canton-tower-views.js`

**Interfaces:**
- Consumes: `model`、`CantonTowerDebug` 骨架。
- Produces: 完整 `VIEWS`、`CINE`、`applyTime`、`openInfo`、`shot4K`；`CantonTowerDebug` 全部 getter/方法。

- [ ] **Step 1: VIEWS + 状态**

```js
var VIEWS = {
  base:    { id: "base",    pos: [0, 9, 185],      target: [0, 65, 0],       fov: 64, time: "day",   type: "walk", chapter: "01 / 塔基 · 南广场与滨水" },
  lattice: { id: "lattice", pos: [60, 2, 65],      target: [0, 240, 0],      fov: 72, time: "day",   type: "walk", chapter: "02 / 仰视 · 塔身网格" },
  deck:    { id: "deck",    pos: [105, 468, 100],  target: [0, 448, 0],      fov: 52, time: "day",   type: "aerial", chapter: "03 / 450 m · 观景层外景" },
  crown:   { id: "crown",   pos: [120, 570, 160], target: [0, 520, 0],      fov: 52, time: "dusk",  type: "aerial", chapter: "04 / 塔顶 · 桅杆与摩天轮" },
  river:   { id: "river",   pos: [-300, 2, -70],   target: [0, 190, 0],      fov: 70, time: "dusk",  type: "walk", chapter: "05 / 珠江南岸 · 滨水回望" },
  axis:    { id: "axis",    pos: [0, 452, -20],    target: [0, 250, -1300],  fov: 58, time: "dusk",  type: "fixed", chapter: "06 / 花城中轴 · 北望" },
  night:   { id: "night",   pos: [-380, 14, -260], target: [0, 250, 0],      fov: 62, time: "night", type: "walk", chapter: "07 / 海心桥 · 夜景灯光" }
};
var state = { view: "base", time: "day", mode: "intro", fps: 60, frames: 0, fpsAt: performance.now(), cinematic: true };
```

- `go(name)`：若 `view === "night"` 强制 `applyTime("night")`；否则保留当前时段（首次进入用 `VIEWS[name].time`）；飞行 1.4–2.0 s；到点后 `state.time` 同步。
- `look(pos,target)`：调试用，直接设置相机并更新 orbit target。
- 移动端：`fov = VIEWS[name].fov + 4`；`pos` 可以 `camera.position.multiplyScalar(1.08)`？不要缩放 y；用 `fov` 即可。

- [ ] **Step 2: 开场运镜**

```js
var CINE = [
  { dur: 6.0, pos: [-120, 120, -760], target: [0, 300, 0], toPos: [-420, 40, -420], toTarget: [0, 260, 0], chapter: "01 / 珠江 · 南岸" },
  { dur: 5.0, pos: [-420, 40, -420], target: [0, 260, 0], toPos: [-300, 2, -70], toTarget: [0, 190, 0], chapter: "02 / 珠江南岸" },
  { dur: 5.0, pos: [-300, 2, -70], target: [0, 190, 0], toPos: [0, 9, 185], toTarget: [0, 65, 0], chapter: "03 / 塔基 · 南广场" },
  { dur: 5.0, pos: [0, 9, 185], target: [0, 65, 0], toPos: [60, 2, 65], toTarget: [0, 240, 0], chapter: "04 / 仰视 · 塔身网格" },
  { dur: 5.0, pos: [60, 2, 65], target: [0, 240, 0], toPos: [105, 468, 100], toTarget: [0, 448, 0], chapter: "05 / 450 m 观景层" },
  { dur: 5.0, pos: [105, 468, 100], target: [0, 448, 0], toPos: [120, 570, 160], toTarget: [0, 520, 0], chapter: "06 / 塔顶 · 桅杆与摩天轮" },
  { dur: 5.0, pos: [120, 570, 160], target: [0, 520, 0], toPos: [0, 452, -20], toTarget: [0, 250, -1300], chapter: "07 / 花城中轴 · 北望" },
  { dur: 6.0, pos: [0, 452, -20], target: [0, 250, -1300], toPos: [-380, 14, -260], toTarget: [0, 250, 0], chapter: "08 / 海心桥 · 夜景" }
];
```

- 总时长 42 s；最后一段开始时 `applyTime("night")`；`prefers-reduced-motion`/skip 直接 `go("base")` 或 `go("river")`。
- 相机路径不得穿塔：所有 pos 距塔中心 ≥ 120 m（塔基/南广场 ≥ 60 m）；`crown → axis` 段用 0.8 s 快速下移 + 短淡入（或硬切），不穿塔身；`axis → night` 段从 450 m 平台外侧绕到桥面。
- 进度条按 `CINE` 累计时长更新。

- [ ] **Step 3: 时段**

```js
var TIME = {
  day:   { sky: [0xa8c8e8, 0xe8f0f8], fog: 0x9fb8c8, sun: 0xfff3df, sunInt: 2.2, hemi: 0xbcd7ea, ground: 0x3b4a43, exposure: 1.02, towerGlow: 0, cityGlow: 0.08, water: 0x2f4a55 },
  dusk:  { sky: [0xf2b07a, 0x5a4a6a], fog: 0xb58a7a, sun: 0xffb070, sunInt: 1.4, hemi: 0x8a8fb8, ground: 0x2f3038, exposure: 1.06, towerGlow: 0.45, cityGlow: 0.35, water: 0x2a2f3d },
  night: { sky: [0x050a16, 0x101a2e], fog: 0x0a1220, sun: 0x7f9fd0, sunInt: 0.18, hemi: 0x22304a, ground: 0x0b1018, exposure: 1.12, towerGlow: 1.0, cityGlow: 1.0, water: 0x08121c }
};
```

- 用 `applyTime(name)` 更新天空 shader uniforms、雾色/密度、太阳/半球/环境光、曝光、塔身 shader `uMode`、城市窗光、水面颜色、灯光强度；不重建场景。
- 夜景色板 A/B/C（spec 3.5）；`uTime` 驱动；桅杆暖白/金；顶部 beacon 红光 1 Hz。
- 时间按钮循环 day→dusk→night→day；`night` 视点强制夜景；`axis` 首次黄昏；`deck`/`crown` 晴日。

- [ ] **Step 4: 热点**

- 7 个热点（`height`, `lattice`, `deck`, `mast`, `steps`, `bridge`, `axis`）；锚点与内容按 spec 3.3；DOM 由 `buildHotspots`/`updateHotspots` 投影，遮挡用与塔身包围盒/屏幕距离的简单判断。
- 点击卡片打开 `infoCard`；`open(id)` 供调试；`focusCraft` 调 `go` 到对应视点；`next` 循环。
- 文案必须来自 facts 文档；营销高度（460/480）与设施高度并列。

- [ ] **Step 5: 4K 与 About**

```js
function shot4K() {
  return new Promise(function (resolve) {
    var oldRatio = renderer.getPixelRatio();
    var oldSize = renderer.getSize(new THREE.Vector2());
    renderer.setPixelRatio(1);
    renderer.setSize(3840, 2160, false);
    camera.aspect = 3840 / 2160; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    canvas.toBlob(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a"); a.href = url; a.download = "canton-tower-4k.png"; a.click();
      renderer.setPixelRatio(oldRatio); renderer.setSize(oldSize.x, oldSize.y, false);
      camera.aspect = oldSize.x / oldSize.y; camera.updateProjectionMatrix();
      resolve({ width: 3840, height: 2160, bytes: blob ? blob.size : 0 });
    }, "image/png");
  });
}
```

- About 面板：尺度/序列/取舍/资料；明确「1:1/压缩/不做内部/灯光示意」；来源链接；页脚同样标注。

- [ ] **Step 6: Debug API 完整实现**

```js
window.CantonTowerDebug = {
  get fps() { return state.fps; },
  get mode() { return state.mode; },
  get view() { return state.view; },
  get time() { return state.time; },
  get renderer() { return renderer; },
  get scene() { return scene; },
  get camera() { return camera; },
  get model() { return model; },
  get counts() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries }; },
  get lattice() { return model.lattice ? model.lattice.stats : null; },
  go: function (name) { flyTo(VIEWS[name] || VIEWS.base); setActiveView(name); },
  look: function (pos, target) { flyTo({ pos: pos, target: target, id: null }); },
  timeOfDay: function (name) { applyTime(name || "day"); },
  open: function (id) { openInfo(id); },
  shot4K: shot4K
};
```

- fps 采样按 memorial 的方式（每 900 ms 计算）；不要写死 60。

- [ ] **Step 7: 7 视点 × 3 时段验收**

创建 `.preview/cdp-canton-tower-views.js`（复用 `cdp-scene-check.js` 的 CDP 连接/截图逻辑），对 7 视点 × 3 时段：

```js
for (const view of ["base","lattice","deck","crown","river","axis","night"]) {
  for (const time of ["day","dusk","night"]) {
    await evaluate(`CantonTowerDebug.go(${JSON.stringify(view)}); CantonTowerDebug.timeOfDay(${JSON.stringify(time)}); 1`);
    await wait(2200);
    const info = await evaluate(`({ fps: CantonTowerDebug.fps, counts: CantonTowerDebug.counts, lattice: CantonTowerDebug.lattice, view: CantonTowerDebug.view, time: CantonTowerDebug.time, overflowX: document.documentElement.scrollWidth > innerWidth + 1 })`);
    results.push({ view, time, ...info });
  }
}
```

Expected：

- 21 组 `errors === 0`；`overflowX === false`；`fps >= 58`（桌面 1440×900，固定视点；切换瞬态可 50–58，记录但不作为失败）。
- `counts.calls <= 150`；`counts.triangles <= 150000`；`lattice.columns === 24`；`lattice.rings === 46`；`lattice.diagonals === 1104`。
- 截图：7 个视点各 1 张（默认时段）+ `river`/`axis`/`night` 的 3 张不同时段；写入 `.preview/canton-tower-<view>-<time>.png`。
- 目视：塔身收腰/扭转/网格；450 平台/16 舱/488/桅杆；塔基/台阶/水池；江/桥/中轴；夜景竖向渐变；无内部/电梯/餐厅。

---

### Task 7: 移动端、性能、最终验收

**Files:**
- Modify: `canton-atlas/web/immersive/canton-tower.css`
- Modify: `canton-atlas/web/immersive/canton-tower-main.js`（DPR/LOD/移动相机）
- Modify: `canton-atlas/web/immersive/canton-tower-model.js`（low 开关）
- Test: `.preview/cdp-canton-tower-mobile.js`

**Interfaces:**
- Consumes: Task 6 的 `VIEWS`/`applyTime`/`Debug`。
- Produces: 移动端可用的 390×844 页面；最终验收记录。

- [ ] **Step 1: 移动端 CSS**

- `@media (max-width: 820px)`：视点栏横向滚动、隐藏 scale-note 的部分长文、热点卡片底部抽屉、about 单列、按钮触控 ≥ 44px；`canvas` 全屏；无横向溢出。
- 移动端 `fov = VIEWS[name].fov + 4`；intro 可跳过；4K 按钮提示「建议桌面」。

- [ ] **Step 2: 移动端 LOD/DPR**

- `low = window.matchMedia("(max-width: 820px)").matches`；`renderer.setPixelRatio(Math.min(dpr, 1.35))`。
- 城市块 300、树 100、环梁径向段 3、斜撑径向段 3、节点隐藏或减半、阴影关闭、玻璃带 3–4 条、摩天轮静态或 1/2 速。
- `CantonTowerDebug.counts` 在移动端应 ≤ 100 calls / 90k tris；若超标，先减城市块/树，不减塔身 24/46/1104。

- [ ] **Step 3: 移动端验收**

```bash
node .preview/cdp-canton-tower-mobile.js 9338 "http://127.0.0.1:4184/immersive/canton-tower.html?embed=1" .preview/canton-tower-mobile
```

脚本用 CDP：

```js
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
```

Expected：

- 7 视点逐一 `go`，每个稳定 2.2 s 后 `fps >= 58`；`overflowX === false`；`errors === 0`；无热点卡片遮挡视点栏；触控目标可点。
- 截图 7 张；目视：塔身不变形、按钮不重叠、about 可滚动、4K 提示可见。
- 记录 DPR/城市块/树数量；若 60fps 不稳，先降 DPR 到 1.25/城市 250，不降塔身。

- [ ] **Step 4: 桌面最终验收**

- 重跑 `.preview/cdp-canton-tower-views.js`，保存 21 组 JSON；固定视点 60fps；0 报错；counts 在预算内。
- 4K：`node .preview/cdp-canton-tower-4k.js`；用 `CantonTowerDebug.shot4K()`，检查返回 `{width:3840,height:2160,bytes>0}`；如浏览器阻止下载，记录 blob 尺寸并注明「未落盘」。
- 截图：7 视点 + 3 时段 + about + 移动端；至少覆盖 `base`、`lattice`、`deck`、`crown`、`river`、`axis`、`night`。
- 视觉检查：塔身轮廓/网格、塔基/台阶/水池、桥/江/中轴、夜景；确认没有内部/电梯/餐厅、没有把 460/480 写成设施高度、没有把北岸压缩说成实测。
- 记录 residual（如玻璃带透明度、城市块密度、移动端 DPR）到任务备注；不要夸大未验证项。

---

### Task 8: 图鉴/城市接入 + 回归（主会话批准后）

**Files:**
- Modify: `canton-atlas/web/app.js`（按钮列表、`openImmersive`、深链、消息）
- Modify: `canton-atlas/web/immersive/main.js`（`tower` 点位详情/回跳）
- Test: `.preview/cdp-canton-tower-integration.js`

**Interfaces:**
- Consumes: `canton-tower.html` 的 `embed/from/view` 参数；`CantonTowerDebug`；城市 POC `tower` 点位。
- Produces: 图鉴「3D 近景」→ 近景；近景「城市全景」→ 城市 POC `spot=tower`；深链 `?immersive=1&spot=canton-tower`。

- [ ] **Step 1: 图鉴路由**

- `app.js:447` 的按钮列表加 `canton-tower`，显示「3D 近景」。
- `openImmersive` 加：

```js
: placeId === "canton-tower"
? "immersive/canton-tower.html?embed=1&from=atlas"
```

- 深链解析已支持 `spot`，确认 `canton-tower` 能直接打开；关闭 overlay 归零。
- 新增 `openCantonTowerDetail()` 与 `canton-open-tower` 消息分支（如果城市 POC 需要打开近景详情）；沿用 `canton-open-baiyun` 的模式。

- [ ] **Step 2: 城市 POC 路由**

- `tower` 点位详情按钮可见；点击发 `canton-open-tower`；非 iframe 直接跳 `canton-tower.html?view=base`。
- 近景「城市全景 ↗」发 `canton-open-city`，spot 为 `tower`；父页打开 `immersive/index.html?embed=1&spot=tower&jump=1`。
- 不替换城市 POC 现有压缩塔；不共享几何/坐标；不改其他 7 个近景路由。

- [ ] **Step 3: 集成验收**

```bash
node .preview/cdp-canton-tower-integration.js 9338 "http://127.0.0.1:4184/" .preview/canton-tower-integration
```

Expected：

- 图鉴卡片「广州塔」→ 3D 近景 → 关闭 → overlay 归零；深链可用。
- 近景 → 城市全景 → `spot=tower` → 返回近景；0 报错；iframe 尺寸/移动端无溢出。
- 回归现有 7 个近景的图鉴嵌入与城市互跳，0 异常；记录陈家祠等高 draw call 场景的既有帧率，不归因于本次改动。
- 不发布；发布由主会话在验收后统一处理。

---

## Self-Review

- **Spec coverage:** 7 视点/热点/时段/4K → Task 6；塔身网格/塔基 → Task 2；观景层/摩天轮/488/桅杆 → Task 3；塔基广场/滨水/南广场 → Task 4；珠江/海心桥/海心沙/花城中轴/CBD → Task 5；性能/移动 → Task 7；图鉴/城市 → Task 8；facts/spec → Task 1 + 参考文档。无缺口。
- **Placeholder scan:** 计划中没有 TBD/TODO；纹理 key 的骨架明确要求逐个画成对应纹理；塔身公式、视点坐标、CDP 断言、4K 返回值均为实际值。
- **Type consistency:** `CantonTowerTextures.build`、`CantonTowerModel.build`、`model.lattice.stats`、`CantonTowerDebug.lattice`、`VIEWS` keys 在 Task 1–8 中一致；`rings:46` 与内部 `RING_LEVELS:47` 的差异已在 Task 2/界面 `lattice.stats` 说明（46 组环梁 + 顶部端环，斜撑 46 个环间×24=1104）。
- **Known risk:** 腰部 26–36 m 是参数化调参目标；若调不到，接受 25–40 m 并在 about 注「扭转按公开口径视觉近似」，不牺牲 24/46/1104。
- **No build this session:** 本计划不执行 Task 1–8；等主会话确认 A 范围、7 视点、2 个取舍、城市压缩 0.6×、文件命名后再开始。
