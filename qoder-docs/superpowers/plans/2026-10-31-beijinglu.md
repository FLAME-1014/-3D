# 北京路 · 千年古道 1:1 近景 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `canton-atlas` 里新增北京路 1:1 近景（`beijinglu.html`），包含中山五路十字星街、44 m 千年古道玻璃罩、拱北楼/铜壶滴漏、骑楼界面/红灯笼/古榕、惠福东路美食街、大佛寺大雄宝殿/普觉楼金顶、城隍庙忠佑广场七视点；三档时段、4K、移动端；接入图鉴与城市 POC。

**Architecture:** 沿用 `yongqingfang.html` / `memorial.html` 的单页近景架构：`beijinglu-textures.js` 程序化生成纹理，`beijinglu-model.js` 建街道/古道/骑楼/寺庙/背景，`beijinglu-main.js` 负责渲染、运镜、交互、时段、4K 与 `BeijingluDebug`；通过 `canton-open-beijinglu` / `canton-open-city` 与图鉴、城市 POC 互跳。核心段 1:1，中山四路/财厅前连接段压缩并在页面标注。

**Tech Stack:** Three.js（共享 `immersive/three.min.js`）、原生 JS/HTML/CSS、Node CDP 截图脚本、Chrome 1440×900 / 390×844 验证。

**Spec:** [docs/superpowers/specs/2026-10-31-beijinglu-design.md](file:///C:/Users/Administrator/Documents/Qoder/2026-10-31/beijinglu-build/docs/superpowers/specs/2026-10-31-beijinglu-design.md)

**Research:** [docs/superpowers/research/2026-10-31-beijinglu-facts.md](file:///C:/Users/Administrator/Documents/Qoder/2026-10-31/beijinglu-build/docs/superpowers/research/2026-10-31-beijinglu-facts.md)

## Global Constraints

- 工作目录：`C:\Users\Administrator\Documents\Qoder\2026-10-31\beijinglu-build`；**绝不修改**主项目 `C:\Users\Administrator\Documents\Qoder\2026-10-30\6ba62647`。
- 坐标：1 场景单位 = 1 米；原点为北京路 × 中山五路交叉口中心；+X 东、-X 西、+Z 南、-Z 北；y = 0 为北京路路面。
- 核心段 1:1：北京路 440 m（中山五路—惠福东路）、惠福东路 120–140 m、大佛寺轴线约 120–140 m、城隍庙节点；中山四路约 500 m → 180 m、财厅前约 300 m → 60–80 m 为压缩连接段，页面/关于面板必须标注“连接段压缩示意”。
- 所有纹理程序化生成，不引入外部图片/字体/品牌 logo；参考图只做内部比对，不进入站点资源。
- 三档时段内部名固定为 `day` / `dusk` / `night`；UI 文案「晴日」「黄昏」「夜览」；按钮循环 day → dusk → night → day。
- 性能预算：桌面 1440×900 固定视点 60fps；draw calls ≤ 600、triangles ≤ 220k；手机 390×844 60fps、draw calls ≤ 350、triangles ≤ 110k；移动端 DPR 1.5–1.6。
- 此工作区不是 git 仓库：不执行 commit；每个任务以“CDP 截图 + 控制台 0 报错 + TaskUpdate”作为检查点。
- 构建阶段端口 **4185**；CDP **9339**；截图/脚本统一写入 `.preview/`。研究阶段不启动服务/Chrome。
- 不发布；只在 build 副本验收，主会话统一合并/发布。
- 事实文案以研究文件为准；不确定的尺寸不写精确值，夜景/红灯笼标注“示意/节庆”。

## File Structure

- Create `canton-atlas/web/immersive/beijinglu.html` — 页面结构、HUD、视点栏、热点、关于面板、脚本引用。
- Create `canton-atlas/web/immersive/beijinglu.css` — 由 `yongqingfang.css` 复制，改街景/夜景配色变量。
- Create `canton-atlas/web/immersive/beijinglu-textures.js` — 铺地、玻璃、抹灰、砖、瓦、木、石、招牌图集、灯笼、叶/树皮、LED 屏、霓虹、餐饮灯箱等 canvas 纹理。
- Create `canton-atlas/web/immersive/beijinglu-model.js` — 地面/古道/拱北楼/骑楼/古榕/红灯笼/大佛寺/城隍庙/惠福东路/南越王宫/书院群/财厅背景/热点。
- Create `canton-atlas/web/immersive/beijinglu-main.js` — 渲染器、天空、灯光、视点、运镜、热点 DOM、时段、4K、互跳、`BeijingluDebug`。
- Create `.preview/cdp-beijinglu-smoke.js` — 页面加载/地面/相机/Debug 验收。
- Create `.preview/cdp-beijinglu-views.js` — 7 视点 × 3 时段 + 热点 + 4K + 报错验收。
- Create `.preview/cdp-beijinglu-perf.js` — draw calls/triangles/FPS 记录（7×3）。
- Create `.preview/cdp-beijinglu-mobile.js` — 390×844 验收。
- Create `.preview/cdp-beijinglu-integration.js` — 图鉴/城市互跳/深链验收。
- Modify `canton-atlas/web/app.js` — `beijinglu` 的 3D 近景按钮、`openImmersive` 分支、深链、`canton-open-beijinglu`。
- Modify `canton-atlas/web/immersive/main.js` — `beijinglu` 点位详情按钮与 `canton-open-beijinglu`、近景“城市全景”回跳。
- Do not modify `chen.*`、`sacred.*`、`baiyun.*`、`yuexiu.*`、`shamian.*`、`memorial.*`、`yongqingfang.*`。

---

### Task 1: 骨架 + 街景底色 + 主循环

**Files:**
- Create: `canton-atlas/web/immersive/beijinglu.html`
- Create: `canton-atlas/web/immersive/beijinglu.css`
- Create: `canton-atlas/web/immersive/beijinglu-textures.js`
- Create: `canton-atlas/web/immersive/beijinglu-model.js`
- Create: `canton-atlas/web/immersive/beijinglu-main.js`
- Test: `.preview/cdp-beijinglu-smoke.js`

**Interfaces:**
- Produces:
  - `window.BeijingluTextures.build(renderer)` → 纹理对象（见 spec §6）。
  - `window.BeijingluModel.build({ textures, low })` → `{ root, hotspots, materials, bounds, counts, animated }`。
  - `window.BeijingluDebug` getters：`fps, mode, view, time, renderer, scene, camera, model, counts, quality`；methods：`go(name), look(pos,target), timeOfDay(name), open(id)`。
- Consumes: 共享 `three.min.js`；研究文件的尺寸/文案。

- [ ] **Step 1: 从 yongqingfang 复制骨架**

```bash
cd "C:/Users/Administrator/Documents/Qoder/2026-10-31/beijinglu-build"
cp canton-atlas/web/immersive/yongqingfang.html canton-atlas/web/immersive/beijinglu.html
cp canton-atlas/web/immersive/yongqingfang.css canton-atlas/web/immersive/beijinglu.css
cp canton-atlas/web/immersive/yongqingfang-textures.js canton-atlas/web/immersive/beijinglu-textures.js
cp canton-atlas/web/immersive/yongqingfang-model.js canton-atlas/web/immersive/beijinglu-model.js
cp canton-atlas/web/immersive/yongqingfang-main.js canton-atlas/web/immersive/beijinglu-main.js
```

- [ ] **Step 2: 替换页面品牌/文案/视点栏**

在 `beijinglu.html` 中做精确替换（不改结构）：

- `<title>` → `北京路 · 千年古道 | CANTON ATLAS 近景`。
- description → `北京路 1:1 近景 3D：千年古道玻璃罩、骑楼界面、拱北楼/铜壶滴漏、惠福东路美食街、大佛寺普觉楼金顶、城隍庙；晴日/黄昏/夜览三档。`
- favicon 文字/填色 → 路/暖金或红。
- CSS/JS 引用 → `beijinglu.css`、`beijinglu-textures.js`、`beijinglu-model.js`、`beijinglu-main.js`。
- brand：`北京路` / `BEIJING ROAD · 1:1 近景`。
- scene-label → `千年商都 · 古道 / 骑楼 / 金顶`。
- stamp-strip 四行 → `古道 44 × 3.8 m`、`街宽 16 m`、`骑楼 376 栋`、`大佛寺 7F 金顶`。
- view-rail 7 按钮：
```html
<button type="button" data-view="crossing" class="active">十字街</button>
<button type="button" data-view="ancient">古道</button>
<button type="button" data-view="arcade">骑楼</button>
<button type="button" data-view="gongbei">拱北楼</button>
<button type="button" data-view="huifu">惠福东</button>
<button type="button" data-view="dafo">大佛寺</button>
<button type="button" data-view="chenghuang">城隍庙</button>
```
- intro：eyebrow `CANTON ATLAS · 近景档案 09`；h1 `北京路 · 千年古道<br><em>脚下是十一层路面</em>`；lede 按研究文件写；intro-meta 四行 → `44 × 3.8 m`、`11 层 / 5 朝`、`16 m 街宽`、`7F 金顶`。
- footer chapter → `01 / 中山五路 · 十字星街`；scale-note → `1 场景单位 = 1 米 · 核心段 1:1 · 中山四路/财厅前连接段压缩示意 · 非测绘`。
- about 面板四栏：尺度（44 × 3.8 m、420 m²、11 层、16 m、376 栋、36.32 × 25.36 × 18 m、500 m²/12 m）、取舍（古道两段、大佛寺三段、连接段压缩）、夜景（金顶/灯笼/LED/灯箱为照明示意）、来源（研究文件 S1–S60）。
- 顶部按钮：`timeBtn` 初始「晴日」；`shotBtn`/`aboutBtn` 不变；`cityBtn`「城市全景 ↗」。

- [ ] **Step 3: 建立配色**

`beijinglu.css` 只改 `:root` 变量，保留 yongqingfang 的布局/组件：

```css
:root {
  --ink: #0d0f12;
  --ink-2: #14171b;
  --paper: #f2eee6;
  --paper-soft: rgba(242, 238, 230, 0.74);
  --paper-faint: rgba(242, 238, 230, 0.44);
  --line: rgba(242, 238, 230, 0.18);
  --accent: #c8a15a;
  --accent-2: #e0c48a;
  --gold: #d8b26a;
  --teal: #4a6f6a;
  --red: #b53a2f;
}
```

- [ ] **Step 4: 清空模型，先做地面/天空/相机**

在 `beijinglu-model.js` 中保留 yongqingfang 的工具函数（`addBox`/`addCyl`/`addPlane`/`mergeOpaqueMeshes`），删除永庆坊的 `buildGate`/`buildLaneBuildings`/`buildMuseum`/`buildWaterfront`/`buildOldTreePlaza` 调用；`build(opts)` 先只做：

- 地面：北京路 16 m 宽 × 500 m、中山五路/中山四路 30 m 宽、惠福东路 10 m 宽、西湖路 12 m 宽；浅灰花岗岩 + 深灰收边。
- 天空：沿用 yongqingfang 的 shader/渐变；雾色按晴/黄昏/夜。
- 相机：`VIEWS` 7 个空视点（先放坐标，模型后补）。
- `buildHotspots()` 先空数组。

- [ ] **Step 5: 启动服务 + CDP 冒烟**

```bash
cd "C:/Users/Administrator/Documents/Qoder/2026-10-31/beijinglu-build"
PORT=4185 node .preview/atlas-server.mjs
# 另一个终端：Chrome --remote-debugging-port=9339 --user-data-dir=.preview/chrome-beijinglu
node .preview/cdp-nav.js 9339 "http://127.0.0.1:4185/immersive/beijinglu.html?embed=1"
node .preview/cdp-scene-check.js 9339 "http://127.0.0.1:4185/immersive/beijinglu.html?embed=1" BeijingluDebug .preview/beijinglu-smoke.png 9000
```

Expected：`info.title` 正确；`canvas` 尺寸 1440×900；`fps` ≥ 55；`errors: 0`；截图 `.preview/beijinglu-smoke.png` 可见地面/天空/视点 UI。

- [ ] **Step 6: 检查点**

更新 TaskUpdate；把 smoke 截图、fps、errors 记录到任务备注。

---

### Task 2: 千年古道 + 拱北楼/铜壶滴漏（考古线）

**Files:**
- Modify: `canton-atlas/web/immersive/beijinglu-model.js`
- Modify: `canton-atlas/web/immersive/beijinglu-textures.js`
- Test: `.preview/cdp-beijinglu-smoke.js`

**Interfaces:**
- Produces: `buildAncientRoad()`、`buildGongbei()`；`hotspots` 增加 `ancient`/`gongbei`；`animated` 不含水面。
- Consumes: Task 1 的地面/坐标。

- [ ] **Step 1: 古道层位纹理**

在 `beijinglu-textures.js` 增加：

```js
ancientLayers = [tangBrick, nanhanBrick, songYuanStone, mingQingSandstone, republicSlab]
```

每张 512×512 canvas：砖缝/石板缝/碎石/夯土；颜色从深灰褐到黄褐/红褐；不要写文字；文字用独立小平面/图集。

- [ ] **Step 2: 古道几何**

在 `beijinglu-model.js` 建：

- 坑体：44 × 1.8 × 3.8 m（可视深度 1.8 m，实际 3 m+ 标注）；内壁深灰。
- 11 层薄层：每层 0.08–0.18 m，材质按 `ancientLayers` 循环；顶面略低于 y=0；层位牌 8–10 块（0.5 × 0.3 m）嵌在玻璃边缘/侧壁。
- 玻璃顶面：44 × 3.8 m，分格 1.5 × 1.5 m；黑框（0.05 × 0.05 m）；透明 `MeshStandardMaterial`，roughness 0.08、metalness 0.15、transparent、opacity 0.35、`depthWrite:false`、renderOrder 2。
- 矮柱：InstancedMesh，圆柱/方柱 0.06 × 1.0 m + 黑色底座 0.18 m；x = ±2.6，z 每 1.5 m；约 60×2。
- 北端说明碑：2.5 × 2.0 × 0.15 m，黑底白字 canvas；设备箱 1.5 × 1.0 × 2.0 m，浅灰。
- 两侧深灰收边 0.4 m。

- [ ] **Step 3: 拱北楼 + 铜壶滴漏**

- 拱北楼玻璃基址：32 × 4.7 m，z ≈ +196..+228；5 层，层位说明牌；玻璃/黑框/矮柱同古道。
- 北京路牌坊：z ≈ +232，跨 x = -4..+4；灰砖双柱 + 横梁（9 m 高 × 8 m 宽）；红字“北京路”“始于公元前 214 年”；中央红色砂岩碑 3.5 × 1.2 × 0.4 m，刻“元代铜壶滴漏”。
- 铜壶滴漏：4 层铜壶（圆柱/圆台，总高 2.64 m）+ 红色石基座；圆形水池直径 8 m，深 0.3 m；12 生肖铜首低模沿池（12 × 约 40 tris）；水柱/水花用 sprite/细圆柱。
- 广百体量：x ≈ -30..-8，z ≈ +200..+232，6–8 层现代百货（浅灰/玻璃），不做内部。

- [ ] **Step 4: 视点 02/04**

在 `beijinglu-main.js` 设置：

```js
ancient: { pos: [4.5, 2.4, 96], target: [-1, 0.2, 44], fov: 58 }
gongbei: { pos: [-7, 2.2, 252], target: [2, 3.5, 230], fov: 58 }
```

- [ ] **Step 5: 验证**

```bash
node .preview/cdp-scene-check.js 9339 "http://127.0.0.1:4185/immersive/beijinglu.html?embed=1&view=ancient" BeijingluDebug .preview/beijinglu-ancient.png 9000
node .preview/cdp-scene-check.js 9339 "http://127.0.0.1:4185/immersive/beijinglu.html?embed=1&view=gongbei" BeijingluDebug .preview/beijinglu-gongbei.png 9000
```

Expected：玻璃带/层位/矮柱/说明碑可见；拱北楼 32 m 带 + 牌坊 + 铜壶滴漏可见；`errors: 0`；fps ≥ 55。

---

### Task 3: 骑楼界面 + 红灯笼 + 古榕（主街）

**Files:**
- Modify: `canton-atlas/web/immersive/beijinglu-model.js`
- Modify: `canton-atlas/web/immersive/beijinglu-textures.js`
- Test: `.preview/cdp-beijinglu-smoke.js`、`.preview/cdp-beijinglu-perf.js`

**Interfaces:**
- Produces: `buildArcadeRow(side, z0, z1)`、`buildLanternCeiling()`、`buildBanyans()`、`buildStreetLife()`；`counts.modules/arcadeBuildings/lanterns/bollards/trees/people`。
- Consumes: Task 1 地面、Task 2 古道坐标。

- [ ] **Step 1: 骑楼原型**

在 `beijinglu-model.js` 做 8–10 个原型（`facadeCream`/`facadeBeige`/`facadeWhite`/`facadeYellow`/`facadeRedBrick`/`facadeGrey`/`facadeArch`/`facadeDeco`）：

- 单开间 4–8 m；进深 14 m；3–4 层；首层 5–5.5 m；上层 3.2–3.6 m；檐高 14–17 m；女儿墙 0.8–1.2 m；局部 5 层 18–20 m。
- 方柱 0.55–0.7 m，柱距 4 m；廊深 3–4 m；深灰石柱础；简化柱头。
- 首层玻璃橱窗 80%；上层 1–2 扇窗/间；窗套/线脚/拱窗/方窗；空调/管线/雨棚/卷闸门随机。
- 竖招 0.6 × 3.0 m（每 6–10 m）；横招 3–6 × 0.8–1.2 m；玻璃橱窗暖光。

- [ ] **Step 2: 两侧连续排布**

- 东侧 x = +8..+22，z = +15..+214（中山五路—西湖路）和 z = +226..+435（西湖路—惠福东路）。
- 西侧 x = -8..-22，同 z；大佛寺段（z = +235..+435, x = -8..-22）背后是寺庙，骑楼仍做临街界面，但内侧不做商场体量。
- 西湖路口（z = +214..+226）、惠福东路口（z = +435..+445）、中山五路口（z = -15..+15）断开。
- 模块数 ≈ 2 × 440/8 ≈ 110；用 8–10 原型 + 随机招牌/窗/空调变化。

- [ ] **Step 3: 红灯笼顶棚**

- 跨街缆绳：z 每 8–10 m 一道，y ≈ 6.5 m；x = -7..+7。
- 灯笼：InstancedMesh，球/椭球 0.5–0.7 m，红色自发光；每道 8–12 个，总数 400–500；日间低 emissive，夜间高 emissive + 少量 glow sprite。
- 不要每个灯笼一个点光源；只给 2–3 个区域点光。

- [ ] **Step 4: 古榕 + 街景生活**

- 12–16 棵古榕：树干（圆柱 + 基部外扩）、3–5 个冠层团块（低模 icosahedron/sphere，叶色纹理）、3–5 棵大树加气根（细圆柱）、树池/护栏。
- 位置：z ≈ +60..+180（古道两侧 3–5 棵）、+200..+430（其余）；避免挡住视点 02/03 的主构图；树冠压街（y ≈ 8–14 m）。
- 行人：60–100 个低模人（头/身/腿/手臂，200–300 tris），实例/合并；颜色随机；视点附近 10–20 人。
- 街道家具：垃圾桶、长椅、导视牌、花箱、少量共享单车；中山五路 3–5 辆低模公交/出租车（静态）。
- 十字街：新大新 3D 曲面屏（约 40 × 18 m，canvas 动画）、旱喷 5 圆盘（水柱/sprite，正弦动画）。

- [ ] **Step 5: 视点 01/03**

```js
crossing: { pos: [10, 3.6, 30], target: [-4, 8, -12], fov: 60 }
arcade: { pos: [5.8, 1.8, 150], target: [4.0, 2.4, 300], fov: 62 }
```

- [ ] **Step 6: 性能检查**

```bash
node .preview/cdp-scene-check.js 9339 "http://127.0.0.1:4185/immersive/beijinglu.html?embed=1&view=arcade" BeijingluDebug .preview/beijinglu-arcade.png 9000
# 在页面里执行：JSON.stringify(BeijingluDebug.counts)
```

Expected：draw calls ≤ 600、triangles ≤ 220k（桌面）；`errors: 0`；fps ≥ 55；截图可见 16 m 街宽、4 m 柱距、红灯笼、古榕、竖招。

---

### Task 4: 大佛寺 + 城隍庙 + 南越王宫/书院群背景（寺庙线）

**Files:**
- Modify: `canton-atlas/web/immersive/beijinglu-model.js`
- Modify: `canton-atlas/web/immersive/beijinglu-textures.js`
- Test: `.preview/cdp-beijinglu-smoke.js`

**Interfaces:**
- Produces: `buildDafo()`、`buildChenghuang()`、`buildNanyueWall()`、`buildAcademyBackdrop()`、`buildCaizhengBackdrop()`；`hotspots` 增加 `dafo`/`chenghuang`。
- Consumes: Task 1 地面、Task 3 骑楼。

- [ ] **Step 1: 大佛寺轴线**

- 山门：x = -140, z = +433；石构门楼 8–10 × 7–8 m，瓦顶、金云纹/法轮、匾“大佛古寺”（右起）、石狮 2、红灯笼。
- 巷道：x = -140, z = +433..+405，宽 4–5 m；两侧民房/树；树干包金布（低模）。
- 天王殿：z = +405，20 × 12 m，高 12 m。
- 大雄宝殿：z = +370，36.32 × 25.36 m，高 18 m；重檐歇山/庑殿示意；灰绿瓦、红柱、金匾；门洞内三尊 6 m 铜佛暗部剪影。
- 普觉楼：z = +310，50 × 47 m，7F+2B，高 35–40 m；黄铜瓦五重檐歇山、层层阳台/栏杆/飞檐；夜间金顶/窗光。
- 前院/后院：香炉、石栏、古榕、红灯笼；不做殿内完整空间。

- [ ] **Step 2: 惠福东路**

- 街宽 10 m，z = +435..+445；x = 0..-260（重点 -8..-160）。
- 两侧 3–4 层住宅/商铺（12–16 m），首层餐饮；无骑楼。
- 12–16 间餐饮铺：大招牌（红/黄/绿/白）、LED 灯箱、外摆/塑料凳/折叠桌/雨棚、电线/空调/晾衣架。
- 榕树 8–10 棵，间距 8–12 m，冠幅 8–12 m。
- 西端大佛寺山门；上方可见普觉楼金顶（夜览）。

- [ ] **Step 3: 城隍庙 + 南越王宫**

- 中山四路压缩段：x = +8..+200，z = -15..+15；两侧街墙/树/低模车。
- 南越王宫南墙：x = +20..+160，z = -16，高 3–4 m；入口门楼/雨棚 x ≈ +80；墙内低层屋顶/树冠；不做内部。
- 忠佑大街：x = +180，z = -15..-55，宽 8 m。
- 忠佑广场：25 × 20 m，浅灰花岗岩。
- 牌楼：z = -20，10 × 9 m，三间，花岗岩/绿瓦/如意斗拱（简化）。
- 拜亭/大殿：z = -44，总面宽约 20 m，大殿净高 12 m；绿琉璃歇山、灰砖墙、石柱、深色木构、红灯笼；占地约 500 m²。
- 周围 6–10 层住宅/办公楼体量，形成“小庙被城市包围”。

- [ ] **Step 4: 背景**

- 书院群：x ≈ -220..-120，z ≈ +140..+220；低层灰砖屋顶/巷口 + 路牌“流水井/大小马站”。
- 财厅前：z = -30..-90，两侧 3–4 层骑楼背景；省财厅 x ≈ -20, z ≈ -80，古典立面 + 穹顶剪影 20–25 m。
- 北京路南段：z = +445..+500，40–60 m 渐隐骑楼 + 简单门楼。
- 远景：低层屋顶 + 少量高层剪影 + 雾；不做 CBD 地标。

- [ ] **Step 5: 视点 05/06/07**

```js
huifu: { pos: [-18, 2.0, 442], target: [-140, 6, 438], fov: 60 }
dafo: { pos: [-140, 2.0, 430], target: [-140, 14, 340], fov: 55 }
chenghuang: { pos: [180, 2.0, -8], target: [180, 5, -50], fov: 58 }
```

- [ ] **Step 6: 验证**

```bash
node .preview/cdp-scene-check.js 9339 "http://127.0.0.1:4185/immersive/beijinglu.html?embed=1&view=dafo" BeijingluDebug .preview/beijinglu-dafo.png 9000
node .preview/cdp-scene-check.js 9339 "http://127.0.0.1:4185/immersive/beijinglu.html?embed=1&view=chenghuang" BeijingluDebug .preview/beijinglu-chenghuang.png 9000
node .preview/cdp-scene-check.js 9339 "http://127.0.0.1:4185/immersive/beijinglu.html?embed=1&view=huifu" BeijingluDebug .preview/beijinglu-huifu.png 9000
```

Expected：大佛寺山门/宝殿/金顶、城隍庙小庙/广场、惠福东路 10 m 榕荫/灯箱可见；`errors: 0`；fps ≥ 55。

---

### Task 5: 三档时段 + 夜景（金顶/灯笼/LED/灯箱）

**Files:**
- Modify: `canton-atlas/web/immersive/beijinglu-main.js`
- Modify: `canton-atlas/web/immersive/beijinglu-model.js`
- Test: `.preview/cdp-beijinglu-views.js`

**Interfaces:**
- Produces: `setTime(name)`、`applyTime(name)`；夜间材质 emissive/灯光组；`animated.ledScreen/fountain/lanternGlow`。
- Consumes: Task 1–4 模型与材质。

- [ ] **Step 1: 时段参数**

```js
TIME = {
  day:  { sky:[...], fog:..., sun:..., ambient:..., exposure: 1.0 },
  dusk: { sky:[...], fog:..., sun:..., ambient:..., exposure: 1.05 },
  night:{ sky:[...], fog:..., sun:..., ambient:..., exposure: 1.1 }
}
```

- 日间：方向光暖白、半球光；灯笼低 emissive；LED 低亮；玻璃反射天空。
- 黄昏：低角度暖光 + 冷补光；灯笼/招牌渐亮；普觉楼金顶开始亮；旱喷蓝白灯。
- 夜览：低环境光；6–8 个点光源（古道/骑楼/大佛寺/城隍庙/惠福东路/十字街）；emissive 招牌/灯笼/金顶/LED；不做全局泛光。

- [ ] **Step 2: 夜间材质**

- 普觉楼金顶/黄铜瓦：`emissive` 金橙，强度随时段；窗光暖黄。
- 红灯笼：emissive 红，夜间 + glow sprite；数量不增加。
- 招牌：竖招/横招/灯箱 emissive；霓虹用高饱和红/青/金，但每屏 ≤ 3 色。
- 3D 屏：canvas 动画（抽象广州天际线 + “广州”），8–12 fps；夜间亮度提高。
- 旱喷：蓝白点光/水柱；正弦动画；夜间可见。
- 惠福东路：餐饮灯箱红/黄/绿/白；榕树暖光；大佛寺山门红灯笼。

- [ ] **Step 3: 三档截图**

```bash
node .preview/cdp-scene-check.js 9339 "http://127.0.0.1:4185/immersive/beijinglu.html?embed=1&view=ancient" BeijingluDebug .preview/beijinglu-ancient-day.png 9000
# 用 CDP 执行 BeijingluDebug.timeOfDay('dusk') / ('night') 后再截图
```

Expected：三档色调/光照明显不同；夜览金顶/灯笼/LED/灯箱亮；无过曝/死黑；fps ≥ 55。

---

### Task 6: 交互 + 热点 + 运镜 + 4K + 关于/来源

**Files:**
- Modify: `canton-atlas/web/immersive/beijinglu-main.js`
- Modify: `canton-atlas/web/immersive/beijinglu.html`
- Modify: `canton-atlas/web/immersive/beijinglu.css`
- Test: `.preview/cdp-beijinglu-views.js`

**Interfaces:**
- Produces: `VIEWS` 7 个、`CINE` 7 段、`HOTSPOTS` 7 个、`BeijingluDebug` 全字段、4K 导出、about/sources。
- Consumes: Task 1–5 场景。

- [ ] **Step 1: 7 视点 + 运镜**

- `VIEWS` 使用 spec §3.2 坐标。
- `CINE` 7 段（约 28–32 s）：南段高空 → 惠福东路/大佛寺金顶 → 中山五路十字街 → 古道 → 骑楼 → 惠福东路 → 城隍庙。
- `embed=1` 跳过 intro；`?view=` 直接进入；移动端镜头拉远 1.35–1.4×。

- [ ] **Step 2: 7 热点**

按 spec §3.3 写 `HOTSPOTS`：`id/title/body/pos`；DOM 锚点/遮挡/开关沿用 yongqingfang。热点文案必须来自研究文件，数字一致。

- [ ] **Step 3: 4K**

沿用 yongqingfang 的 3840×2160 渲染 + PNG blob；桌面显示“4K 截图”；移动端提示“建议桌面端”；记录 blob 尺寸/字节数。

- [ ] **Step 4: 关于/来源**

- 关于面板：尺度/取舍/夜景/来源四栏；写明“核心段 1:1、中山四路/财厅前连接段压缩、非测绘、夜景为照明示意、红灯笼为节庆/夜间示意”。
- 来源列表：S1–S60 摘要 + 链接（可折叠/滚动）。
- 页脚 scale-note 同上。

- [ ] **Step 5: Debug**

`BeijingluDebug` 字段与 `YongqingfangDebug` 对齐：`fps/mode/view/time/quality/counts/renderer/scene/camera/model`；方法 `go/look/timeOfDay/open`。`counts` 至少含 `modules/arcadeBuildings/lanterns/bollards/trees/people/vehicles/drawCalls/triangles`（后两项从 renderer.info 读）。

- [ ] **Step 6: 验证**

```bash
node .preview/cdp-beijinglu-views.js 9339 "http://127.0.0.1:4185/immersive/beijinglu.html?embed=1"
```

Expected：7 视点 × 3 时段全部可切换；热点 7 个；4K blob 3840×2160；`errors: 0`；截图齐全。

---

### Task 7: 图鉴/POC 接入 + 回归

**Files:**
- Modify: `canton-atlas/web/app.js`
- Modify: `canton-atlas/web/immersive/main.js`
- Test: `.preview/cdp-beijinglu-integration.js`

**Interfaces:**
- Consumes: Task 6 的 `beijinglu.html` 与 `?view=`。
- Produces: `canton-open-beijinglu`、`canton-open-city` 往返；深链 `?immersive=1&spot=beijinglu`。

- [ ] **Step 1: 图鉴**

- 详情按钮文案名单加入 `beijinglu`（约 447 行）。
- `openImmersive` 增加 `beijinglu` 分支 → `immersive/beijinglu.html?embed=1&from=atlas`（约 528 行）。
- `IMMERSIVE_MAP` 已有 `beijinglu`，不改。
- 深链解析加入 `beijinglu`（约 1216 行）。
- 新增 `openBeijingluDetail()` 与 `canton-open-beijinglu` 监听（约 582 行）。

- [ ] **Step 2: 城市 POC**

- `detailBtn` 可见性加入 `beijinglu`（约 2442 行）。
- 点击分支加入：
```js
var isBeijing = activeSpot && activeSpot.id === "beijinglu";
if (window.parent && window.parent !== window) {
  window.parent.postMessage({ type: isBeijing ? "canton-open-beijinglu" : ... }, "*");
} else {
  window.location.href = isBeijing ? "beijinglu.html?view=crossing" : ...;
}
```
- 近景“城市全景”发送 `canton-open-city`，spot 为 `beijinglu`。

- [ ] **Step 3: 互跳验收**

```bash
node .preview/cdp-beijinglu-integration.js 9339 "http://127.0.0.1:4185/"
```

Expected：图鉴详情 → 近景（embed/from=atlas）→ 关闭 overlay 归零；近景“城市全景” → POC `spot=beijinglu`；POC 详情 → 近景；深链直达；0 报错。

- [ ] **Step 4: 回归**

- 打开现有 7 个近景（chen/sacred/baiyun/yuexiu/shamian/memorial/yongqingfang），确认图鉴嵌入/城市互跳未受影响；0 新增报错。
- 不修改现有场景文件；`git` 不可用，用 `diff -rq` 对照主项目确认只改了 `app.js`、`immersive/main.js`、新增 `beijinglu.*`。

---

### Task 8: 移动端 + 性能 + 最终验收

**Files:**
- Modify: `canton-atlas/web/immersive/beijinglu-main.js`
- Modify: `canton-atlas/web/immersive/beijinglu-model.js`
- Test: `.preview/cdp-beijinglu-mobile.js`、`.preview/cdp-beijinglu-perf.js`

**Interfaces:**
- Produces: 移动端降级、性能报告、最终截图/数据。
- Consumes: Task 7 全部。

- [ ] **Step 1: 移动端**

- 390×844 DPR2 模拟；相机拉远 1.35–1.4×；视点栏横向滚动；热点卡片可点；无横向溢出；DPR 1.5–1.6。
- 降级：灯笼 160–220、树 8–10、人 40–60、关闭阴影、LED 6–8 fps、透明层减少。
- 固定视点 7/7 60fps；若初始低于 60fps，先降级（灯笼/树/人/阴影/DPR）直到 60fps，不以 55fps 作为通过标准。

- [ ] **Step 2: 性能报告**

```bash
node .preview/cdp-beijinglu-perf.js 9339 "http://127.0.0.1:4185/immersive/beijinglu.html?embed=1"
```

记录 7 视点 × 3 时段的 `renderer.info.render.calls/triangles`、fps、DPR；写入 `.preview/beijinglu-perf.json`/`.md`。若超预算，先减灯笼/树/人/背景体量，不降古道/大佛寺/城隍庙核心精度。

- [ ] **Step 3: 最终验收**

- 桌面 7×3 截图、手机 7 视点截图、4K PNG、热点/关于面板截图。
- 检查：0 console error；无横向溢出；玻璃层位/拱北楼/大佛寺金顶/城隍庙/惠福东路均可见；夜景分层；连接段标注。
- 回归现有 7 个近景；确认未修改主项目。

- [ ] **Step 4: 交付数据**

在最终回报中给：桌面/手机 fps、draw calls/triangles、4K 尺寸/字节、7 视点截图路径、残差（未做/简化项）。不发布，等主会话确认。

---

### Task 9: 残差与交接（可选，最多 2 次尝试/项）

**Files:**
- Modify: 仅 `beijinglu.*` 与必要的 `.preview/` 脚本。
- Test: 复用 Task 8 脚本。

- [ ] **Step 1: 列出残差**

- 例如：城隍庙牌楼/斗拱简化、大佛寺侧殿剪影、南越王宫只有南墙、书院群只有屋顶、财厅只有剪影、人群低模、LED 屏为抽象动画、夜景为照明示意、连接段压缩。
- 每项写“为什么简化/是否影响识别/是否可在下一期补”。

- [ ] **Step 2: 只修 2 项**

- 优先修影响识别的残差（如古道层位不清、金顶不够亮、骑楼重复明显）；每项最多 2 次尝试；完成即停。
- 不扩大范围，不重构共享文件。

- [ ] **Step 3: 交接**

- 给主会话：改动文件清单、验收数据、残差、截图路径、合并/发布建议。
- 不自行发布；主项目合并由主会话执行。

---

## 验证命令速查

```bash
# 服务
cd "C:/Users/Administrator/Documents/Qoder/2026-10-31/beijinglu-build"
PORT=4185 node .preview/atlas-server.mjs

# Chrome（另开）
chrome --remote-debugging-port=9339 --user-data-dir=".preview/chrome-beijinglu" about:blank

# 冒烟/视点/手机/互跳
node .preview/cdp-scene-check.js 9339 "http://127.0.0.1:4185/immersive/beijinglu.html?embed=1" BeijingluDebug .preview/beijinglu-smoke.png 9000
node .preview/cdp-beijinglu-views.js 9339 "http://127.0.0.1:4185/immersive/beijinglu.html?embed=1"
node .preview/cdp-beijinglu-mobile.js 9339 "http://127.0.0.1:4185/immersive/beijinglu.html?embed=1"
node .preview/cdp-beijinglu-integration.js 9339 "http://127.0.0.1:4185/"
```

## 性能/验收红线

- 桌面 1440×900：7 视点固定 60fps；7×3 切换瞬态 ≥50fps；draw calls ≤600；triangles ≤220k；0 console error。
- 手机 390×844：固定视点 60fps（降级后必须达到）；draw calls ≤350；triangles ≤110k；无横向溢出；DPR 1.5–1.6。
- 4K：3840×2160 PNG blob；记录字节数；下载落盘受策略影响时单独记录。
- 视觉：古道 11 层/5 期可见；拱北楼 32 × 4.7 m + 铜壶滴漏 2.64 m；大佛寺 36.32 × 25.36 × 18 m + 7F 金顶；城隍庙 500 m²/12 m；惠福东路 10 m 榕荫；16 m 街宽/4 m 柱距/5–5.5 m 廊下；红灯笼顶棚/古榕。
- 去重：不出现永庆坊的青砖满洲窗模板、水岸/月亮桥、粤剧戏台、麻石巷；北京路以古道/玻璃/红灯笼/金顶/LED/美食街为前景。
- 文案：核心段 1:1；中山四路/财厅前压缩；非测绘；夜景/红灯笼为示意。

## 风险与回退

- 玻璃透明排序：`depthWrite:false` + renderOrder；移动端减少透明层；若仍闪烁，改为“玻璃顶面 + 不透明层位盒体 + 黑色分格条”，不做透明侧面。
- 普觉楼高度不确定：按 7F+2B、35–40 m 示意；若比例不对，调高度/檐层，不改文案为实测。
- 城隍庙被周边高层压住：保持 500 m²/12 m；用广场/牌楼拉开层次；不要放大庙体。
- 骑楼重复：8–10 原型 + 招牌/窗/空调/树/灯笼变化；视点附近手工调整 3–5 个开间。
- 性能超预算：先减灯笼/树/人/背景/远景，保古道/大佛寺/城隍庙/骑楼主界面。
- 连接段压缩被看出：用街墙/树/雾/转角遮挡；页面标注；不声称全网 1:1。
- 4K 内存：沿用现有 4K 流程；若移动端崩溃，隐藏 4K 按钮/提示桌面端。

## 下一步

计划评审通过后，从 Task 1 开始，按“骨架→古道/骑楼→寺庙→夜景→交互/4K→移动/验收”顺序执行；每个 Task 以 CDP 截图 + 0 报错 + TaskUpdate 作为检查点。本文档不包含场景代码，不发布、不改主项目。
