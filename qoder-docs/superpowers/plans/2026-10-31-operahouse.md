# 广州大剧院 · 纯外观 1:1 近景 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `canton-atlas` 里新增广州大剧院纯外观 1:1 近景（`operahouse.html`）：南/东南前广场与水池、一黑一白双砾、大砾石三角玻璃口部/斜网格、5 m 入口平台/草坡/缓坡、西侧珠江西路石背、东侧小砾石、航拍文化轴（省博/图书馆/花城广场/广州塔/IFC/CBD）；三档时段、7 视点、7 热点、4K、移动端，接入图鉴 `opera-house` 与城市 POC `operahouse`。内部/舞台/后台不做。

**Architecture:** 沿用 `canton-tower.*` / `beijinglu.*` 的单页近景架构：`operahouse-textures.js` 程序化生成石材/玻璃/铺装/草/水/城市等纹理，`operahouse-model.js` 用折面 `BufferGeometry` + InstancedMesh 建双砾、斜网格、平台/草坡/水池、城市，`operahouse-main.js` 负责渲染、运镜、视点、时段、热点、4K 与 `OperaHouseDebug`。双砾/斜网格/树/城市窗光全部用合并几何或实例化；不修改现有 9 个近景与城市 POC 的模型。

**Tech Stack:** Three.js（共享 `immersive/three.min.js`）、原生 JS/HTML/CSS、Node 24（内置 WebSocket/fetch）CDP 验收、Chrome 1440×900 / 390×844、Node 静态服务器 `.preview/atlas-server.mjs`。

**Spec:** [docs/superpowers/specs/2026-10-31-operahouse-design.md](file:///C:/Users/Administrator/Documents/Qoder/2026-10-31/operahouse-build/docs/superpowers/specs/2026-10-31-operahouse-design.md)

## Global Constraints

- 坐标：1 场景单位 = 1 米；+X 东、+Z 南、+Y 上；地面/广场 y=0；原点在南/东南前广场与水池之间；大砾石中心约 (-35, 0, -55)，小砾石约 (+45, 0, -60)；入口平台 +5 m。
- 1:1/近似：双砾主要体量（大 120 m 最大长度 × 约 85 m 宽 × 43.1 m 高；小约 65 × 45 × 28 m 估算）、约 3 m 间距、5 m 平台、南/东南前广场/水池/草坡/缓坡（估算）；300 m 外城市按约 0.6–0.7× 压缩；所有页面标注「示意压缩，非测绘」。
- 内部/舞台/后台/观众厅/排练厅/餐厅/车库/落客区不做；玻璃口部后只做浅层 lobby 剪影；`axis` 是航拍示意视点，about 必须写明。
- 所有纹理程序化生成，不下载外部图片作为贴图；参考图只做内部观察，不进入站点资源。
- 三档时段内部名固定 `day` / `dusk` / `night`；UI 文案「晴日」「黄昏」「夜景」；按钮循环 day → dusk → night → day；`night` 视点强制夜景。
- 双砾/斜网格/树/城市必须用合并几何或 InstancedMesh；报告 `OperaHouseDebug.counts` 与 `OperaHouseDebug.shell`；桌面 draw calls ≤ 120、triangles ≤ 140k；移动 draw calls ≤ 80、triangles ≤ 80k。
- 性能目标：桌面 1440×900 固定视点 60fps；移动 390×844 固定视点 60fps；切换瞬态不低于 50fps；0 console error；无横向溢出。
- 4K：3840×2160 渲染 + PNG blob；移动端提示建议桌面；验收区分 blob 生成与文件落盘。
- 此工作区不是 git 仓库：不 commit；每个任务以「CDP 截图 + console 0 报错 + counts/fps + TaskUpdate」为检查点。
- 本计划在独立副本执行；Task 7 只在主会话批准后执行，共享文件（`app.js` / `immersive/main.js`）只通过主项目合并；不发布。
- 事实/尺寸以 `research/2026-10-31-operahouse-facts.md` 为准；座位 1,804（1,687+117）vs 官方 1,687、400 vs 官方 350 必须并列/注脚；120 m 写「最大长度」不写「最大跨度」；41/47 转角并列；水池/草坡/坡道/夜景色温标注「估算/示意」。
- 本地服务端口 **4186**；Chrome CDP 端口 **9340**；截图写 `.preview/`；研究阶段不启动服务/Chrome，建造阶段再执行。
- 本计划不执行；等主会话确认 A 范围、7 视点、2 个取舍、文件命名/Debug 后再从 Task 1 开始。

## File Structure

- Create: `canton-atlas/web/immersive/operahouse.html` — 页面结构、HUD、7 视点栏、intro、about、脚本引用。
- Create: `canton-atlas/web/immersive/operahouse.css` — 由 `canton-tower.css` 复制，改深灰石/暖白/琥珀变量；移动端断点。
- Create: `canton-atlas/web/immersive/operahouse-textures.js` — `window.OperaHouseTextures.build(renderer)`：深/浅石材、三角形板缝、玻璃斜网格、铺装、草/高草、水、树叶/树皮、城市窗光、水纹光带、glow、签名墙文字。
- Create: `canton-atlas/web/immersive/operahouse-model.js` — `window.OperaHouseModel.build({textures, low})`：双砾折面壳、玻璃口部/斜网格/浅层 lobby、5 m 平台/草坡/水池/缓坡、树、城市、灯光、热点锚点。
- Create: `canton-atlas/web/immersive/operahouse-main.js` — `window.OperaHouseDebug`：渲染、相机、视点、运镜、热点 DOM、时段、4K、移动端。
- Create: `.preview/cdp-operahouse-smoke.js` — 页面加载/骨架验收。
- Create: `.preview/cdp-operahouse-views.js` — 7 视点 × 3 时段、热点、counts/fps、console 验收。
- Create: `.preview/cdp-operahouse-mobile.js` — 390×844 验收。
- Create: `.preview/cdp-operahouse-4k.js` — 4K blob 尺寸验收。
- Create: `.preview/cdp-operahouse-integration.js` — 图鉴/城市互跳（Task 7）。
- Read-only reference: `docs/superpowers/research/2026-10-31-operahouse-facts.md`、`docs/superpowers/specs/2026-10-31-operahouse-design.md`、`canton-atlas/web/immersive/canton-tower.*`、`beijinglu.*`、`.preview/atlas-server.mjs`、`.preview/cdp-scene-check.js`、`.preview/operahouse-refs/`。
- Modify only Task 7 (after approval): `canton-atlas/web/app.js`、`canton-atlas/web/immersive/main.js`。

---

### Task 1: 页面骨架 + 天空/地面/水池 + Debug

**Files:**
- Create: `canton-atlas/web/immersive/operahouse.html`
- Create: `canton-atlas/web/immersive/operahouse.css`
- Create: `canton-atlas/web/immersive/operahouse-textures.js`
- Create: `canton-atlas/web/immersive/operahouse-model.js`
- Create: `canton-atlas/web/immersive/operahouse-main.js`
- Test: `.preview/cdp-operahouse-smoke.js`

**Interfaces:**
- Produces:
  - `window.OperaHouseTextures.build(renderer)` → `{ stoneDark, stoneLight, stoneSeam, glassGrid, glassMouth, paving, pavingWarm, grass, tallGrass, water, leaf, trunk, cityWindow, ribbon, glow, sign }`（THREE.Texture）。
  - `window.OperaHouseModel.build({ textures, low })` → `{ root, hotspots, materials, waterMat, shell, bounds }`。
  - `window.OperaHouseDebug` getters：`fps`, `mode`, `view`, `time`, `renderer`, `scene`, `camera`, `model`, `counts`, `shell`；方法：`go(name)`, `look(pos,target)`, `timeOfDay(name)`, `open(id)`, `shot4K()`。
- Consumes: 共享 `three.min.js`；facts/spec 的文案与尺寸；`canton-tower.html/css/main` 的 HUD/DOM 结构。

- [ ] **Step 1: 复制页面并替换文案**

Run:

```bash
cp canton-atlas/web/immersive/canton-tower.html canton-atlas/web/immersive/operahouse.html
cp canton-atlas/web/immersive/canton-tower.css canton-atlas/web/immersive/operahouse.css
```

在 `operahouse.html` 做精确替换：

- `<title>` → `广州大剧院 | CANTON ATLAS 近景`。
- description → `广州大剧院纯外观 1:1 近景 3D：珠江北岸花城广场西南角，一黑一白、一大一小两块砾石；大砾石 43.1 m、1,804 座歌剧厅外壳（1,687+117 乐池），小砾石约 400 座实验剧场（官方 350）；约 120 m 最大外壳长度、5,000+ 玻璃 / 75,000 石材；南入口 5 m 平台、草坡、缓坡、水池；7 视点、三档时段。内部/舞台/后台不做；周边城市压缩示意。`
- favicon 文字 `塔` → `砾`；填色 `%231b2f3a` → `%232a2d2e`。
- `canton-tower.css` → `operahouse.css`。
- brand：`<span class="seal">砾</span>`；`<strong>广州大剧院</strong>`；`<small>GUANGZHOU OPERA HOUSE · 1:1 近景</small>`。
- scene-label → `圆润双砾 · 珠江新城的文化起点`。
- stamp-strip → `43.1 m`、`1,804 + 400 座`、`5,000+ / 75,000`、`3 m 双砾间距`。
- top-actions：`timeBtn` 初始「晴日」；`replayBtn`「重播运镜」；`shotBtn`「4K 截图」；`aboutBtn`「考据」；`cityBtn`「城市全景 ↗」。
- view-rail 7 个按钮：

```html
<button type="button" data-view="plaza" class="active">广场</button>
<button type="button" data-view="mouth">入口</button>
<button type="button" data-view="pool">倒影</button>
<button type="button" data-view="west">石背</button>
<button type="button" data-view="small">小砾石</button>
<button type="button" data-view="axis">航拍</button>
<button type="button" data-view="night">夜景</button>
```

- intro：eyebrow `CANTON ATLAS · 近景档案 10`；h1 `广州大剧院<em>一黑一白，两块砾石</em>`；lede 按 facts 写「扎哈·哈迪德，2010-05-09 启幕；占地 4.2 万㎡、建筑面积 7.3 万㎡、总高 43.1 m；大砾石 1,804 座歌剧厅（1,687+117 乐池），小砾石约 400 座实验剧场（官方 350）；约 5,000+ 块玻璃、75,000 块石材组成三向斜交折板式网壳；南入口经草坡缓坡上到 5 m 平台，建筑置于水池之中。纯外观，不做观众厅/舞台/后台/内部；周边城市压缩示意。」
- intro-meta：`43.1 m`、`1,804 + 400`、`64 面 / 104 棱线`、`5,000 / 75,000`。
- footer chapter → `01 / 南广场 · 双砾与水池`；scale-note → `1 场景单位 = 1 米 · 双砾/5 m 平台/前广场 1:1 估算 · 周边城市压缩示意 · 内部/舞台/后台不做`。
- loading → `正在立双砾、铺水池…`。
- about 面板：尺度（43.1/120/85；小 65/45/28；3 m；1,804=1,687+117；400/官方 350；5,000+/75,000；64/104/41 + 37/54/18；5 m 平台；水池/草坡估算）、序列（7 视点）、取舍（纯外观、玻璃口部浅层剪影、城市压缩、夜景示意、纹理程序化）、资料（facts 文档官方链接）。
- 脚本引用 → `operahouse-textures.js`、`operahouse-model.js`、`operahouse-main.js`。
- 删除 canton-tower 专属文案/按钮；保留 `cityBtn`。

- [ ] **Step 2: 改 CSS 变量与移动端断点**

在 `operahouse.css` 只改 `:root` 和必要的移动端规则，其余沿用 canton-tower：

```css
:root {
  --ink: #0b0c0d;
  --ink-2: #141617;
  --paper: #f2efe8;
  --paper-soft: rgba(242, 239, 232, 0.76);
  --paper-faint: rgba(242, 239, 232, 0.44);
  --line: rgba(242, 239, 232, 0.18);
  --accent: #c9b79c;
  --accent-2: #e6d8c3;
  --gold: #d8b46a;
  --teal: #4f6f74;
  --stone: #55595a;
}
```

- 移动端保留 canton-tower 的 rail 横向滚动/卡片底部抽屉；确认 `canvas` 不被 HUD 遮挡；`--rail` 高度不超 64px。

- [ ] **Step 3: 程序化纹理骨架**

创建 `operahouse-textures.js`，用 canton-tower-textures 的 `canvasTexture(draw, w, h, repeatX, repeatY)` 方式生成。纹理清单：

- `stoneDark`：1024×1024，深灰 `#3b3e3f` 底 + 细颗粒 + 轻微冷暖斑驳 + 雨痕；每 128–256 px 一道三角形板缝（用 `moveTo/lineTo` 画大三角）；roughness/bump 同图或另做。
- `stoneLight`：1024×1024，暖白 `#d8d4c8` 底 + 灰斑 + 轻微污渍 + 三角板缝。
- `stoneSeam`：512×512，灰白/深灰细线 + 法线/凹凸；用于 bumpMap/normalMap。
- `glassGrid`：512×512，蓝灰 `#6f8794` 底 + 三角斜网格线（斜向 60°/120°）；透明由材质控制。
- `glassMouth`：512×512，更密/更亮的三角斜网格；用于大砾石口部玻璃背后/纹理层。
- `paving` / `pavingWarm`：512×512，浅灰/暖灰花岗岩 + 2px 板缝 + 细颗粒。
- `grass` / `tallGrass`：512×512，绿色斑驳 + 竖向草叶/高草纹理。
- `water`：512×512，深青灰 `#1e3538` + 细横向波纹/噪声。
- `leaf` / `trunk`：256×256，叶绿斑驳 / 树皮竖纹。
- `cityWindow`：512×512，暗底 `#121a20` + 2×3px 随机暖窗 `#ffd9a0` / 冷窗 `#bcd8ff`。
- `ribbon`：512×128，暖白渐变 + 波浪线/水纹；用于平台/草坡挡墙的 emissive 光带。
- `glow`：128×128，白色径向渐变到透明。
- `sign`：512×128 或 1024×256，金属灰底 + “广州大剧院 / Guangzhou Opera House” 文字（canvas 字体；仅用于签名墙可选）。

说明：以上为骨架；每个 key 必须画成对应纹理（不能全部指向一张）。不下载/不使用外部图片作为贴图。

- [ ] **Step 4: 模型/主循环/Debug 骨架**

创建 `operahouse-model.js`：

```js
(function () {
  "use strict";
  function build(opts) {
    var textures = opts.textures, low = !!opts.low;
    var root = new THREE.Group(); root.name = "operahouse";
    var materials = {};
    var hotspots = [];
    var waterMat = new THREE.MeshBasicMaterial({ color: 0x1b3438 });
    // buildGround(); buildPebbles(); buildMouths(); buildPlatform(); buildPool(); buildPlaza(); buildTrees(); buildContext(); buildHotspots();
    return { root: root, hotspots: hotspots, materials: materials, waterMat: waterMat, shell: null, bounds: new THREE.Box3(new THREE.Vector3(-400, 0, -500), new THREE.Vector3(400, 200, 900)) };
  }
  window.OperaHouseModel = { build: build };
})();
```

创建 `operahouse-main.js`，按 canton-tower-main 的结构（renderer/scene/camera/clock/sky/lights/loop）先接：

```js
(function () {
  "use strict";
  var canvas = document.getElementById("scene");
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.matchMedia("(max-width: 820px)").matches ? 1.35 : 1.85));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputEncoding = THREE.sRGBEncoding;
  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x9fb0b5, 0.0007);
  var camera = new THREE.PerspectiveCamera(window.innerWidth < 820 ? 62 : 55, window.innerWidth / window.innerHeight, 0.3, 5000);
  camera.position.set(0, 1.7, 95);
  camera.lookAt(-15, 22, -40);
  var sun = new THREE.DirectionalLight(0xfff3df, 2.0); sun.position.set(180, 320, 220); scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbcd7ea, 0x3b4a43, 1.0));
  scene.add(new THREE.AmbientLight(0xffffff, 0.22));
  var textures = window.OperaHouseTextures.build(renderer);
  var model = window.OperaHouseModel.build({ textures: textures, low: window.innerWidth < 820 });
  scene.add(model.root);
  function loop() { requestAnimationFrame(loop); renderer.render(scene, camera); }
  loop();
  window.OperaHouseDebug = {
    get fps() { return 60; }, get mode() { return "free"; }, get view() { return "plaza"; }, get time() { return "day"; },
    get renderer() { return renderer; }, get scene() { return scene; }, get camera() { return camera; }, get model() { return model; },
    get counts() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries }; },
    get shell() { return model.shell; },
    go: function () {}, look: function () {}, timeOfDay: function () {}, open: function () {},
    shot4K: function () { return Promise.resolve({ width: 0, height: 0, bytes: 0 }); }
  };
})();
```

说明：这是骨架；Task 2–6 会把 build/view/time/4K 填实。`fps` 先返回 60，Task 1 结束前用真实计数替换。

- [ ] **Step 5: 启动服务 + Chrome**

Run（后台）：

```bash
cd C:/Users/Administrator/Documents/Qoder/2026-10-31/operahouse-build
PORT=4186 node .preview/atlas-server.mjs
```

Chrome（端口 9340）：

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --remote-debugging-port=9340 --user-data-dir="C:/Users/Administrator/Documents/Qoder/2026-10-31/operahouse-build/.preview/chrome-profile-operahouse" --no-first-run --new-window "about:blank"
```

- [ ] **Step 6: 冒烟验收**

Run:

```bash
node .preview/cdp-scene-check.js 9340 "http://127.0.0.1:4186/immersive/operahouse.html?embed=1" OperaHouseDebug .preview/operahouse-smoke.png 12000
```

Expected JSON：

- `title` 含「广州大剧院」；`introHidden: true`；`canvas: [[1440,900]]`；`errors: 0`；`overflowX: false`；`hotspots: 0`（Task 6 前）或 7（Task 6 后）。
- `counts.calls` < 30（骨架：地面/水池/天空）；`counts.triangles` < 5k。

- [ ] **Step 7: 记录检查点**

更新 Task 1 完成；把 smoke JSON 与截图路径写入任务备注；若 WebGL 初始化失败，先检查 `three.min.js` 与 canvas id，不要继续 Task 2。

---

### Task 2: 双砾折面壳 + 5 m 平台

**Files:**
- Modify: `canton-atlas/web/immersive/operahouse-model.js`
- Modify: `canton-atlas/web/immersive/operahouse-textures.js`
- Test: `.preview/cdp-operahouse-smoke.js`

**Interfaces:**
- Consumes: Task 1 的 `textures`/`root`/`materials`。
- Produces: `model.shell = { group, large, small, stats, measure() }`；`OperaHouseDebug.shell` 返回 `{pebbles:2, large:{length:120,height:43.1,faces:64,ridges:104,corners:41}, small:{length:65,height:28,faces:37,ridges:54,corners:18}, gap:3, glass:5200, stone:75422, drawCalls:...}`。

- [ ] **Step 1: 写折面壳参数**

```js
var LARGE = { cx: -35, cz: -55, rx: 60, rz: 42.5, h: 43.1, rings: 11, seg: 20, seed: 7 };
var SMALL = { cx: 45, cz: -60, rx: 32.5, rz: 22.5, h: 28, rings: 9, seg: 16, seed: 13 };
var PLATFORM_Y = 5;

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ringPoint(p, ring, seg) {
  var t = ring / (p.rings - 1);
  // 壳从地面 y=0 到总高 h；5 m 平台在壳体外侧环绕/切入基座，不叠加到壳高
  var y = Math.sin(t * Math.PI * 0.5) * p.h; // 低处陡、顶部缓
  var shrink = Math.cos(t * Math.PI * 0.5) * 0.62 + 0.38;   // 顶部收小，但不为 0
  var rnd = mulberry32(p.seed + ring * 97);
  var angle = (seg / p.seg) * Math.PI * 2;
  var wobble = 1 + (rnd() - 0.5) * 0.18;
  // 非几何：每圈半径/偏心略有不同，避免规则椭球
  var ox = Math.sin(t * 5.3 + p.seed) * 2.2;
  var oz = Math.cos(t * 4.1 + p.seed) * 1.8;
  return new THREE.Vector3(
    p.cx + ox + Math.cos(angle) * p.rx * shrink * wobble,
    y,
    p.cz + oz + Math.sin(angle) * p.rz * shrink * wobble
  );
}
```

说明：`LARGE.h=43.1`、`SMALL.h=28` 是**从地面 y=0 起的总高**；平台 +5 m 是独立基座，不要把 +5 叠加到壳高（否则会变成 48.1/33）。长轴方向（西北—东南）在实现时用 `rotation.y` 或旋转环坐标调，建议约 -30°–-45°，按参考图微调；不要为了旋转而移动双砾中心。

- [ ] **Step 2: 生成折面壳**

用 `BufferGeometry` 手工连三角面（每圈 `seg` 个点；圈间两三角；顶部/底部封口）；`computeVertexNormals()` 后 `flatShading: true`；UV 用 `(seg / p.seg, ring / p.rings)`，让三角板缝纹理沿壳面展开。

```js
function buildShell(p, mat) {
  var pos = [], uv = [], idx = [], ringCount = p.rings, segCount = p.seg;
  for (var r = 0; r < ringCount; r++) {
    for (var s = 0; s < segCount; s++) {
      var v = ringPoint(p, r, s);
      pos.push(v.x, v.y, v.z);
      uv.push(s / segCount, r / (ringCount - 1));
    }
  }
  for (var r2 = 0; r2 < ringCount - 1; r2++) {
    for (var s2 = 0; s2 < segCount; s2++) {
      var a = r2 * segCount + s2;
      var b = r2 * segCount + (s2 + 1) % segCount;
      var c = (r2 + 1) * segCount + s2;
      var d = (r2 + 1) * segCount + (s2 + 1) % segCount;
      idx.push(a, c, b, b, c, d);
    }
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  var mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
```

- [ ] **Step 3: 大/小砾石 + 平台**

- 大砾石：`LARGE`；深灰石材 `stoneDark`；中心 (-35, 0, -55)；最大长度按 120 m 控制（`rx=60` 即长轴 120 m）；宽约 85 m（`rz=42.5`）；高 43.1 m（壳从 y=0 到 43.1，`h=43.1`；5 m 平台在壳体外侧环绕/切入基座，不要把 +5 叠加到壳高）。
- 小砾石：`SMALL`；浅色石材 `stoneLight`；中心 (+45, 0, -60)；长约 65 m、宽约 45 m、高约 28 m（壳从 y=0 到 28，`h=28`；平台同理）。
- 两体最近约 3 m：包围盒可重叠，以最近顶点/采样距离为准（实现 `measureGap`），不要用中心距硬算；若不在 2–4 m，先调小砾石中心/局部收缩，不改 43.1/120。
- 平台：不规则多边形，y=0→5；深灰/浅灰石材侧壁；顶面暖灰铺装；大/小砾石坐在平台上；平台南缘留入口/坡道缺口。
- 每个壳 1 个 draw call；平台 1–2 个。

- [ ] **Step 4: 测量与调参**

```js
function measureShell() {
  // 世界坐标包围盒 / 最近距离 / 顶高
  var boxL = new THREE.Box3().setFromObject(largeMesh);
  var boxS = new THREE.Box3().setFromObject(smallMesh);
  var sizeL = boxL.getSize(new THREE.Vector3());
  var sizeS = boxS.getSize(new THREE.Vector3());
  var gap = measureGap(largeMesh, smallMesh); // 采样顶点/近似
  return {
    large: { length: +Math.max(sizeL.x, sizeL.z).toFixed(1), width: +Math.min(sizeL.x, sizeL.z).toFixed(1), height: +sizeL.y.toFixed(1) },
    small: { length: +Math.max(sizeS.x, sizeS.z).toFixed(1), width: +Math.min(sizeS.x, sizeS.z).toFixed(1), height: +sizeS.y.toFixed(1) },
    gap: +gap.toFixed(1)
  };
}
```

Expected：大砾石长 118–122 m、高 42.5–43.5 m；小砾石长 63–67 m、高 27–29 m；gap 2–4 m。若不在范围，调中心/半径，不牺牲 43.1 m 与 3 m 量级。

- [ ] **Step 5: 材质/风化**

- `stoneDark`：深灰/近黑，`roughness 0.85`，`metalness 0.05`；`map` + `bumpMap`（`stoneSeam`）+ 轻微 `roughnessMap`；三角形板缝要清楚。
- `stoneLight`：暖白/浅灰，`roughness 0.8`；同样板缝/轻微污渍。
- 两体 `castShadow=true`；平台 `receiveShadow=true`；不做 600 m 阴影；只开近景 250 m。
- 石面轻微雨痕/风化；不要崭新展台，也不要大面积黑污。

- [ ] **Step 6: 验收**

Run:

```bash
node .preview/cdp-scene-check.js 9340 "http://127.0.0.1:4186/immersive/operahouse.html?embed=1" OperaHouseDebug .preview/operahouse-shell.png 12000
```

CDP：

```js
OperaHouseDebug.look([0, 1.7, 95], [-15, 22, -40]);
OperaHouseDebug.counts;
OperaHouseDebug.shell;
```

Expected：

- `shell.pebbles === 2`；大砾石 height ≈ 43.1；小砾石 height ≈ 28；gap 2–4 m；`counts.calls` < 35；`counts.triangles` < 45k。
- 截图 `operahouse-shell.png`：两块非几何折面砾石、一高一低、平台/基座可辨；无破面/黑面；不是两个光滑球。

---

### Task 3: 表皮/玻璃口部/斜网格/入口

**Files:**
- Modify: `canton-atlas/web/immersive/operahouse-model.js`
- Modify: `canton-atlas/web/immersive/operahouse-textures.js`

**Interfaces:**
- Consumes: Task 2 的 `largeMesh`/`smallMesh`/`shell`/materials。
- Produces: `model.mouthGroup`、`model.diagrid`、`model.entranceGroup`；`shell.stats` 增加 glass/stone/diagrid 计数。

- [ ] **Step 1: 玻璃口部（大砾石）**

- 在南/东南面选定一个三角形/四边形区域（约 45–60 m 宽 × 25–30 m 高），用 2–3 片折面玻璃覆盖；玻璃凹在石折檐下；玻璃面法线朝南/东南。
- 玻璃后做浅层 lobby：暗色地面/顶面 + 2–3 片钢构件/斜柱 + 1 片暖光 emissive 平面；不做座位/舞台/楼座。
- 玻璃材质：`MeshPhysicalMaterial` 或自定义 shader；`transparent:true`、`opacity 0.28–0.4`、`roughness 0.12–0.18`、`depthWrite:false`、`side:DoubleSide`；白天菲涅尔天空反射，夜间内透暖光。
- 石折檐/上缘：在玻璃口部上方保留一圈石面折檐/挑出（0.8–1.5 m 厚），形成“口部”阴影。

- [ ] **Step 2: 3D 斜网格（主口部）**

用 `InstancedMesh` 细杆（4 边/1 段，半径 0.08–0.15 m）沿玻璃口部的三角网格布置；约 120–240 根；深灰/黑金属；夜间受内部暖光/轻微 emissive；小砾石玻璃带用 `glassGrid` 纹理，不逐杆。

```js
var barGeo = new THREE.CylinderGeometry(0.09, 0.09, 1, 4, 1, true);
var bars = new THREE.InstancedMesh(barGeo, diagMat, count);
var up = new THREE.Vector3(0, 1, 0);
for (var i = 0; i < count; i++) {
  var a = gridA[i], b = gridB[i];
  var dir = b.clone().sub(a), len = dir.length();
  var q = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
  var m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, len, 1));
  bars.setMatrixAt(i, m);
}
bars.instanceMatrix.needsUpdate = true;
mouthGroup.add(bars);
```

- [ ] **Step 3: 小砾石玻璃带**

- 小砾石南/东面做 1–2 条低长玻璃带（宽 6–10 m、长 25–35 m）；用玻璃材质 + `glassGrid` 纹理；可少量 3D 杆件（≤ 40 根）。
- 玻璃带内透暖光；夜间比大砾石口部暗；保持“一黑一白”。

- [ ] **Step 4: 入口平台/缓坡/台阶/栏板**

- 5 m 平台：在 Task 2 平台基础上，南缘做入口开口；平台边缘做狭缝/细栏板（高 1.0–1.2 m），可用深色细条 + 浅色栏板；不做门厅室内。
- 南侧缓坡：从广场 y=0 到平台 y=5，宽 4–6 m，坡度约 1:12；两侧细金属栏杆（InstancedMesh 立柱 + 横杆）；局部台阶（低模）。
- 草坡：Task 4 做；这里先留平台边缘/挡墙接口。
- 签名墙（可选）：南/西侧金属墙 + “广州大剧院”文字 canvas；参考图；不要挡住主入口。

- [ ] **Step 5: 验收**

Run:

```bash
node .preview/cdp-scene-check.js 9340 "http://127.0.0.1:4186/immersive/operahouse.html?embed=1" OperaHouseDebug .preview/operahouse-mouth.png 12000
```

CDP：

```js
OperaHouseDebug.look([5, 1.7, 30], [-5, 22, -8]);
OperaHouseDebug.counts;
OperaHouseDebug.shell;
```

Expected：

- `counts.calls` < 45；`counts.triangles` < 65k；截图能看到大三角玻璃口部、斜网格、石折檐、5 m 平台/坡道；玻璃不是一块平蓝色墙；无透明排序闪烁。
- `shell.stats.glass` / `shell.stats.diagrid` 有实际数值；小砾石玻璃带可辨。

---

### Task 4: 广场/水池/草坡/树/光带

**Files:**
- Modify: `canton-atlas/web/immersive/operahouse-model.js`
- Modify: `canton-atlas/web/immersive/operahouse-textures.js`

**Interfaces:**
- Consumes: Task 2/3 的平台/入口；`textures.water/grass/tallGrass/ribbon/paving`。
- Produces: `model.poolGroup`、`model.grassGroup`、`model.plazaGroup`、`model.ribbons`；`hotspots` 增加 `water` 锚点 (5,2,20)。

- [ ] **Step 1: 水池**

- 主池约 90×25 m（x=-70..+20，z=+5..+30，估算）+ 东侧支池约 40×20 m（x=+25..+65，z=-10..+10，估算）；水 y≈+0.3 m；池底深色；池缘浅灰石材/曲线；不做真实反射。
- 水 shader：深青灰底 + 细波纹 + 玻璃暖光/水纹光带的竖向拖影；夜间把倒影颜色调暖；白天反射天空的浅蓝灰。
- 可选：1–2 个小喷泉/涌泉（低模 + Sprite/Points，慢速/静态）；不要做成大型喷泉表演。

- [ ] **Step 2: 草坡/挡墙/水纹光带**

- 草坡：南/东南/西侧的高草缓坡，从 y=0 升到 y=5；用带高度的网格 + `grass`/`tallGrass` 纹理；草坡上少量草簇实例。
- 挡墙：草坡边缘/平台边缘的浅色挡墙；夜间沿挡墙做暖白“水纹”光带（`ribbon` emissive 条带 + `uTime` 慢流动）；光带通过入口延伸到玻璃口部内侧。
- 草坡下开口：少量暗色玻璃/凹口示意咖啡/售票/研究；不做室内。
- 平台边缘：狭缝/栏板 + 细灯带；不要做成整圈亮边，保持“水纹”的断续/蜿蜒。

- [ ] **Step 3: 前广场/树阵/灯柱/坐凳**

- 前广场：浅灰/暖灰花岗岩铺装；主入口轴线留空；树阵沿东/南/北边缘；灯柱/坐凳低模；可选签名墙。
- 树：2–3 种低模阔叶/棕榈；InstancedMesh；桌面 150–250 棵、移动 80–120 棵；树池/支撑简化；不做每片叶。
- 西侧街道：行道树 + 白色护栏 + 少量静态低模车辆（可选）；不做车流动画。
- 广场尺度：人相对 43.1 m 建筑很小；可用 1–2 个低模人形/树作比例参照（可选；如做，保持极简）。

- [ ] **Step 4: 验收**

Run:

```bash
node .preview/cdp-scene-check.js 9340 "http://127.0.0.1:4186/immersive/operahouse.html?embed=1" OperaHouseDebug .preview/operahouse-pool.png 12000
```

CDP：

```js
OperaHouseDebug.look([-15, 1.2, 42], [-5, 18, -12]);
OperaHouseDebug.timeOfDay("dusk");
OperaHouseDebug.counts;
```

Expected：

- `counts.calls` < 80；`counts.triangles` < 105k；截图能看到水池/倒影、草坡、坡道、树阵、平台边缘水纹光带；无悬空/穿插；水池不是一块纯色板。
- 夜间光带暖白、连续/蜿蜒，不是整圈霓虹；白天草坡/铺装/树的层次可辨。

---

### Task 5: 城市/文化轴 + 性能

**Files:**
- Modify: `canton-atlas/web/immersive/operahouse-model.js`
- Modify: `canton-atlas/web/immersive/operahouse-textures.js`
- Test: `.preview/cdp-operahouse-views.js`（先建骨架）

**Interfaces:**
- Consumes: `textures.cityWindow`、`textures.glow`、`root`。
- Produces: `model.cityGroup`、`model.tower`、`model.museum`、`model.library`；`hotspots` 增加 `axis` 锚点 (170,10,60)。

- [ ] **Step 1: 省博/图书馆/IFC/CBD/广州塔/珠江/海心沙**

- 省博：约 220 m 东/东北，方盒体量（“月光宝盒”），高度约 45 m（示意）；只做体量/深色外墙 + 少量镂空纹理；不做细节（留给省博独立近景）。
- 图书馆：约 300 m 东北，方盒/双塔体量，高度约 50–60 m（示意）；只做体量/窗光。
- IFC（西塔）：约 450 m 北，438.6 m 高；低模圆润塔身 + 窗光；不做细节。
- 东塔（约 530 m）/中信（约 391 m）：北/东北远景，低模体量 + 窗光。
- 广州塔：南侧约 700–900 m（场景压缩；实际直线约 1.0–1.3 km），600 m 扭转网格/桅杆用低模/LineSegments/窗光；只做剪影，不做近景细节。
- 珠江/海心沙：南侧水面/沙洲；低看台/树阵/广场；不做亚运场馆内部。
- 城市压缩：`farZ = z > 300 ? 300 + (z - 300) * 0.65 : z`（只压缩 z 距离，x 不变；保持轴线）；300 m 外全部过 `farZ`；页面标注「示意压缩」。
- 城市窗光：canvas 纹理 + Points/Sprite；夜间亮、白天压暗；不做逐窗。

```js
function farZ(z) { return z > 300 ? 300 + (z - 300) * 0.65 : z; }
// 省博/图书馆/IFC/广州塔的 z 都过 farZ；x 保持，保证轴线关系
```

- [ ] **Step 2: `axis` 航拍取景**

- 相机 (300, 170, -300) → target (20, 10, 180)；东北高处向南看：大剧院左、省博/图书馆右、花城广场/珠江/海心沙/广州塔远景；双砾背面/屋顶为主；不要求玻璃口部在此视点可见。
- 检查广州塔在画面内、不被省博/图书馆完全遮挡；若不理想，先调 target/相机 x/相机高度，或把 fov 放宽到 58–62°，不压缩广州塔高度。
- 页面/热点标注「航拍示意，非步行；城市压缩」。

- [ ] **Step 3: 性能/雾**

- 雾：`FogExp2` 密度约 0.0006–0.0009；白天远景渐隐；夜间更暗。
- 城市 draw calls 控制在 12–16；树 3；天空/glow 4；总 calls ≤ 120、tris ≤ 140k。
- 移动端：城市块/窗光减半；广州塔用 1–2 条 LineSegments/低模；省博/图书馆体量简化。

- [ ] **Step 4: 验收**

Run:

```bash
node .preview/cdp-scene-check.js 9340 "http://127.0.0.1:4186/immersive/operahouse.html?embed=1" OperaHouseDebug .preview/operahouse-axis.png 12000
```

CDP：

```js
OperaHouseDebug.look([300, 170, -300], [20, 10, 180]);
OperaHouseDebug.timeOfDay("dusk");
OperaHouseDebug.counts;
```

Expected：

- `counts.calls` ≤ 120；`counts.triangles` ≤ 140k；截图能看到双砾（背面/屋顶）、省博/图书馆、花城广场、珠江/海心沙、广州塔剪影；城市明显更雾/更压缩；没有把广州塔做成近景细节。

---

### Task 6: 7 视点、运镜、热点、时段、4K、About

**Files:**
- Modify: `canton-atlas/web/immersive/operahouse-main.js`
- Modify: `canton-atlas/web/immersive/operahouse-model.js`（热点锚点/文案）
- Test: `.preview/cdp-operahouse-views.js`

**Interfaces:**
- Consumes: `model`、`OperaHouseDebug` 骨架。
- Produces: 完整 `VIEWS`、`CINE`、`applyTime`、`openInfo`、`shot4K`；`OperaHouseDebug` 全部 getter/方法。

- [ ] **Step 1: VIEWS + 状态**

```js
var VIEWS = {
  plaza: { id: "plaza", pos: [0, 1.7, 95], target: [-15, 22, -40], fov: 55, time: "day", type: "walk", chapter: "01 / 南广场 · 双砾与水池" },
  mouth: { id: "mouth", pos: [5, 1.7, 30], target: [-5, 22, -8], fov: 66, time: "day", type: "walk", chapter: "02 / 大砾石 · 玻璃口部" },
  pool:  { id: "pool", pos: [-15, 1.2, 42], target: [-5, 18, -12], fov: 48, time: "dusk", type: "walk", chapter: "03 / 倒影池 · 南侧" },
  west:  { id: "west", pos: [-165, 1.7, -50], target: [-35, 20, -55], fov: 55, time: "day", type: "walk", chapter: "04 / 珠江西路 · 石背" },
  small: { id: "small", pos: [115, 1.7, 10], target: [45, 12, -60], fov: 58, time: "day", type: "walk", chapter: "05 / 小砾石 · 草坡与坡道" },
  axis:  { id: "axis", pos: [300, 170, -300], target: [20, 10, 180], fov: 55, time: "dusk", type: "aerial", chapter: "06 / 文化轴 · 双砾与省博/广州塔" },
  night: { id: "night", pos: [0, 2.5, 90], target: [-10, 18, -20], fov: 58, time: "night", type: "walk", chapter: "07 / 夜景 · 水映双砾" }
};
var state = { view: "plaza", time: "day", mode: "intro", fps: 60, frames: 0, fpsAt: performance.now(), cinematic: true };
```

- `go(name)`：若 `view === "night"` 强制 `applyTime("night")`；否则保留当前时段（首次进入用 `VIEWS[name].time`）；飞行 1.4–2.0 s；到点后 `state.time` 同步。
- `look(pos,target)`：调试用，直接设置相机并更新 orbit target。
- 移动端：`fov = VIEWS[name].fov + 4`；`mouth` 的 pos 沿视线方向 +8%；`axis` 保持全屏比例。

- [ ] **Step 2: 开场运镜**

```js
var CINE = [
  { dur: 6.0, pos: [40, 90, 520], target: [20, 40, 200], toPos: [110, 60, 260], toTarget: [10, 20, 20], chapter: "01 / 珠江 · 海心沙与广州塔" },
  { dur: 5.0, pos: [110, 60, 260], target: [10, 20, 20], toPos: [60, 18, 120], toTarget: [0, 20, -20], chapter: "02 / 花城广场 · 南望双砾" },
  { dur: 5.0, pos: [60, 18, 120], target: [0, 20, -20], toPos: [0, 1.7, 95], toTarget: [-15, 22, -40], chapter: "03 / 南广场 · 双砾全景" },
  { dur: 5.0, pos: [0, 1.7, 95], target: [-15, 22, -40], toPos: [5, 1.7, 30], toTarget: [-5, 22, -8], chapter: "04 / 大砾石 · 玻璃口部" },
  { dur: 5.0, pos: [5, 1.7, 30], target: [-5, 22, -8], toPos: [115, 1.7, 10], toTarget: [45, 12, -60], chapter: "05 / 小砾石 · 草坡与坡道" },
  { dur: 5.0, pos: [115, 1.7, 10], target: [45, 12, -60], toPos: [300, 170, -300], toTarget: [20, 10, 180], chapter: "06 / 航拍 · 文化轴" },
  { dur: 6.0, pos: [300, 170, -300], target: [20, 10, 180], toPos: [0, 2.5, 90], toTarget: [-10, 18, -20], chapter: "07 / 夜景 · 水映双砾" }
];
```

- 总时长约 37 s；最后一段开始时 `applyTime("night")`；`prefers-reduced-motion`/skip 直接 `go("plaza")`。
- 相机路径不穿双砾：距大砾石外壳 ≥ 18 m（玻璃口部 ≥ 12 m），距小砾石 ≥ 12 m；`axis → night` 段用 0.8 s 淡入/快速下移，不穿建筑。
- 进度条按 `CINE` 累计时长更新。

- [ ] **Step 3: 时段**

```js
var TIME = {
  day:   { sky: [0xa8c8e8, 0xe8f0f8], fog: 0x9fb0b5, sun: 0xfff3df, sunInt: 2.0, hemi: 0xbcd7ea, ground: 0x3b4a43, exposure: 1.0, stoneGlow: 0, glassGlow: 0.08, cityGlow: 0.08, water: 0x2b4a4d },
  dusk:  { sky: [0xf2b07a, 0x5a4a6a], fog: 0xb58a7a, sun: 0xffb070, sunInt: 1.3, hemi: 0x8a8fb8, ground: 0x2f3038, exposure: 1.05, stoneGlow: 0.35, glassGlow: 0.45, cityGlow: 0.35, water: 0x2a2f3d },
  night: { sky: [0x050a16, 0x101a2e], fog: 0x0a1220, sun: 0x7f9fd0, sunInt: 0.16, hemi: 0x22304a, ground: 0x0b1018, exposure: 1.1, stoneGlow: 1.0, glassGlow: 1.0, cityGlow: 1.0, water: 0x08121c }
};
```

- `applyTime(name)` 更新天空 shader uniforms、雾色/密度、太阳/半球/环境光、曝光、石面 `uBottomWarm`、玻璃 `uInteriorWarm`、水纹光带 `uRipple`、水面颜色、城市窗光；不重建场景。
- 夜间：石面基座暖光 2700–3000 K；玻璃口部内透 3500–4000 K；水纹光带 2700–3000 K；CBD 窗光冷/暖；不做 RGB/激光。
- 时间按钮循环 day→dusk→night→day；`night` 视点强制夜景；`pool`/`axis` 首次黄昏；`plaza`/`mouth`/`west`/`small` 晴日。

- [ ] **Step 4: 热点**

- 7 个热点（`twin`, `shell`, `mouth`, `stage`, `small`, `water`, `axis`）；锚点与内容按 spec 3.3；DOM 由 `buildHotspots`/`updateHotspots` 投影，遮挡用与双砾包围盒/屏幕距离的简单判断。
- 点击卡片打开 `infoCard`；`open(id)` 供调试；`focusCraft` 调 `go` 到对应视点；`next` 循环。
- 文案必须来自 facts 文档；座位口径（1,804/1,687；400/350）并列/注脚；120 m 写「最大长度」；`stage` 卡片明确「内部不做」。

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
      var a = document.createElement("a"); a.href = url; a.download = "operahouse-4k.png"; a.click();
      renderer.setPixelRatio(oldRatio); renderer.setSize(oldSize.x, oldSize.y, false);
      camera.aspect = oldSize.x / oldSize.y; camera.updateProjectionMatrix();
      resolve({ width: 3840, height: 2160, bytes: blob ? blob.size : 0 });
    }, "image/png");
  });
}
```

- About 面板：尺度/序列/取舍/资料；明确「双砾/5 m 平台/前广场 1:1 估算；周边城市压缩；内部/舞台/后台不做；夜景‘水映双砾’示意；非测绘」；座位口径注脚；资料链接。
- 页脚同样标注。

- [ ] **Step 6: Debug API 完整实现**

```js
window.OperaHouseDebug = {
  get fps() { return state.fps; },
  get mode() { return state.mode; },
  get view() { return state.view; },
  get time() { return state.time; },
  get renderer() { return renderer; },
  get scene() { return scene; },
  get camera() { return camera; },
  get model() { return model; },
  get counts() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries }; },
  get shell() { return model.shell ? model.shell.stats : null; },
  go: function (name) { flyTo(VIEWS[name] || VIEWS.plaza); setActiveView(name); },
  look: function (pos, target) { flyTo({ pos: pos, target: target, id: null }); },
  timeOfDay: function (name) { applyTime(name || "day"); },
  open: function (id) { openInfo(id); },
  shot4K: shot4K
};
```

- fps 采样按 canton-tower 的方式（每 900 ms 计算）；不要写死 60。

- [ ] **Step 7: 7 视点 × 3 时段验收**

创建 `.preview/cdp-operahouse-views.js`（复用 `.preview/cdp-scene-check.js` 的 CDP 连接/截图逻辑），对 7 视点 × 3 时段：

```js
for (const view of ["plaza","mouth","pool","west","small","axis","night"]) {
  for (const time of ["day","dusk","night"]) {
    await evaluate(`OperaHouseDebug.go(${JSON.stringify(view)}); OperaHouseDebug.timeOfDay(${JSON.stringify(time)}); 1`);
    await wait(2200);
    const info = await evaluate(`({ fps: OperaHouseDebug.fps, counts: OperaHouseDebug.counts, shell: OperaHouseDebug.shell, view: OperaHouseDebug.view, time: OperaHouseDebug.time, overflowX: document.documentElement.scrollWidth > innerWidth + 1 })`);
    results.push({ view, time, ...info });
  }
}
```

Expected：

- 21 组 `errors === 0`；`overflowX === false`；`fps >= 58`（桌面 1440×900，固定视点；切换瞬态可 50–58，记录但不作为失败）。
- `counts.calls <= 120`；`counts.triangles <= 140000`；`shell.pebbles === 2`；`shell.gap` 2–4；`shell.large.height` 42.5–43.5。
- 截图：7 个视点各 1 张（默认时段）+ `pool`/`axis`/`night` 的 3 张不同时段；写入 `.preview/operahouse-<view>-<time>.png`。
- 目视：双砾一黑一白/一大一小；玻璃口部/斜网格；5 m 平台/草坡/坡道/水池；西侧石背；小砾石；文化轴/广州塔剪影；夜景暖白/倒影；无内部/舞台/后台。

---

### Task 7: 移动端、性能、最终验收 + 接入（主会话批准后）

**Files:**
- Modify: `canton-atlas/web/immersive/operahouse.css`
- Modify: `canton-atlas/web/immersive/operahouse-main.js`（DPR/LOD/移动相机）
- Modify: `canton-atlas/web/immersive/operahouse-model.js`（low 开关）
- Modify only Task 7 (after approval): `canton-atlas/web/app.js`、`canton-atlas/web/immersive/main.js`
- Test: `.preview/cdp-operahouse-mobile.js`、`.preview/cdp-operahouse-4k.js`、`.preview/cdp-operahouse-integration.js`

**Interfaces:**
- Consumes: Task 6 的 `VIEWS`/`applyTime`/`Debug`。
- Produces: 移动端可用的 390×844 页面；图鉴/城市互跳；最终验收记录。

- [ ] **Step 1: 移动端 CSS**

- `@media (max-width: 820px)`：视点栏横向滚动、热点卡片底部抽屉、about 单列、按钮触控 ≥ 44px；`canvas` 全屏；无横向溢出。
- 移动端 `fov = VIEWS[name].fov + 4`；`mouth` 后拉 8%；intro 可跳过；4K 按钮提示「建议桌面」。
- `axis` 航拍视点保持全屏比例，检查广州塔剪影不被裁掉。

- [ ] **Step 2: 移动端 LOD/DPR**

- `low = window.matchMedia("(max-width: 820px)").matches`；`renderer.setPixelRatio(Math.min(dpr, 1.35))`。
- 树 80–120、城市块/窗光减半、斜网格 60–70%、玻璃带纹理化、阴影关闭、玻璃层减少；双砾壳折面数降低但保留大三角硬边。
- `OperaHouseDebug.counts` 在移动端应 ≤ 80 calls / 80k tris；若超标，先减城市/树/斜网格，不减双砾 43.1/120/3 m 的核心比例。

- [ ] **Step 3: 移动端验收**

```bash
node .preview/cdp-operahouse-mobile.js 9340 "http://127.0.0.1:4186/immersive/operahouse.html?embed=1" .preview/operahouse-mobile
```

脚本用 CDP：

```js
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
```

Expected：

- 7 视点逐一 `go`，每个稳定 2.2 s 后 `fps >= 58`；`overflowX === false`；`errors === 0`；无热点卡片遮挡视点栏；触控目标可点。
- 截图 7 张；目视：双砾不变形、按钮不重叠、about 可滚动、4K 提示可见、`axis` 广州塔不裁切。
- 记录 DPR/城市/树/斜网格数量；若 60fps 不稳，先降 DPR 到 1.25/城市 250/树 80，不降双砾核心比例。

- [ ] **Step 4: 桌面最终验收**

- 重跑 `.preview/cdp-operahouse-views.js`，保存 21 组 JSON；固定视点 60fps；0 报错；counts 在预算内。
- 4K：`node .preview/cdp-operahouse-4k.js`；用 `OperaHouseDebug.shot4K()`，检查返回 `{width:3840,height:2160,bytes>0}`；如浏览器阻止下载，记录 blob 尺寸并注明「未落盘」。
- 截图：7 视点 + 3 时段 + about + 移动端；至少覆盖 `plaza`、`mouth`、`pool`、`west`、`small`、`axis`、`night`。
- 视觉检查：双砾非几何/无直角/一黑一白；玻璃口部/斜网格；5 m 平台/草坡/坡道/水池；西侧石背；小砾石；文化轴/省博/图书馆/广州塔；夜景暖白/倒影；无内部/舞台/后台。
- 记录 residual（玻璃透明度、城市密度、移动端 DPR、光带亮度）到任务备注；不要夸大未验证项。

- [ ] **Step 5: 图鉴路由（主会话批准后）**

- `app.js:447` 的“3D 近景”按钮列表加 `opera-house`。
- `app.js:528` `openImmersive` 加：

```js
: placeId === "opera-house"
? "immersive/operahouse.html?embed=1&from=atlas&view=plaza"
```

- `if (target && ...)` 的排除列表加 `placeId !== "opera-house"`。
- 新增 `openOperaHouseDetail()` 与 `canton-open-operahouse` 消息分支（沿用 `canton-open-tower` 模式）。
- 深链 `?immersive=1&spot=opera-house` 可用；关闭 overlay 归零。

- [ ] **Step 6: 城市 POC 路由（主会话批准后）**

- `immersive/main.js:2442` 的详情按钮可见性加 `spot.id !== "operahouse"`。
- `:2665` 点击分支加 `isOpera`；postMessage `canton-open-operahouse`；非 iframe 跳 `operahouse.html?view=plaza`。
- 近景“城市全景 ↗”发 `canton-open-city`，spot 为 `operahouse`；父页打开 `immersive/index.html?embed=1&spot=operahouse&jump=1`。
- 不替换/共享 POC 现有压缩双球（`main.js:964`）与光环（`main.js:1323`）；POC 坐标偏移不擅自修正。

- [ ] **Step 7: 集成验收**

```bash
node .preview/cdp-operahouse-integration.js 9340 "http://127.0.0.1:4186/" .preview/operahouse-integration
```

Expected：

- 图鉴卡片「广州大剧院」→ 3D 近景 → 关闭 → overlay 归零；深链可用。
- 近景 → 城市全景 → `spot=operahouse` → 返回近景；0 报错；iframe 尺寸/移动端无溢出。
- 回归 9 个现有近景的图鉴嵌入与城市互跳，0 异常；记录既有高 draw call 场景的帧率，不归因于本次改动。
- 不发布；发布由主会话在验收后统一处理。

---

## Self-Review

- **Spec coverage:** 7 视点/热点/时段/4K → Task 6；双砾折面壳/平台 → Task 2；表皮/玻璃口部/斜网格/入口 → Task 3；广场/水池/草坡/树/光带 → Task 4；城市/文化轴 → Task 5；性能/移动 → Task 7；图鉴/城市 → Task 7；facts/spec → Task 1 + 参考文档。无缺口。
- **Placeholder scan:** 计划中没有 TBD/TODO；纹理 key 明确要求逐个画成对应纹理；双砾参数、视点坐标、CDP 断言、4K 返回值均为实际值；水池/草坡/夜景色温的估算已在 facts/spec 标注。
- **Type consistency:** `OperaHouseTextures.build`、`OperaHouseModel.build`、`model.shell.stats`、`OperaHouseDebug.shell`、`VIEWS` keys 在 Task 1–7 中一致；`shell.large.height` 统一为 43.1（总高，含 5 m 平台时壳高 38.1，需在实现里写清）；`shell.small.height` 约 28（估算）。
- **Known risk:** 折面壳无法按公开资料精确复刻；接受“视觉近似”，保留 43.1/120/3 m 的核心比例；座位/面积/转角口径在 UI/about 并列；水池/草坡/夜景色温为估算/示意；POC 坐标偏移不擅自修正；玻璃透明排序需测试。
- **No build this session:** 本计划不执行 Task 1–7；等主会话确认 A 范围、7 视点、2 个取舍、文件命名 `operahouse.*`、Debug `OperaHouseDebug`、城市压缩边界后再开始。建造阶段用 4186/9340；研究阶段不启动服务/Chrome。
