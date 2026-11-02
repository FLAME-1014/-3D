# 白云山 · 摩星岭登顶段 1:1 近景 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `canton-atlas` 里新增摩星岭登顶段 1:1 近景（`baiyun.html`），包含吉星石、锦绣南天牌坊、栈道 + 扶梯、382 米山顶平台/亭、风格化城市与珠江远景、云海晨曦/晴日/夜览三档，并接入图鉴与城市 POC。

**Architecture:** 沿用 `chen.html` / `sacred.html` 的单页近景架构：`baiyun-textures.js` 程序化生成纹理，`baiyun-model.js` 建地形、登顶段、山顶、城市与云海，`baiyun-main.js` 负责渲染、运镜、交互、时段与 4K；通过 `BaiyunDebug` 暴露 CDP 验收所需的只读状态。城市 POC 与图鉴只增加 baiyun 的路由，不改 chen/sacred 的模型与主逻辑。

**Tech Stack:** Three.js（共享 `immersive/three.min.js`）、原生 JS/HTML/CSS、Node CDP 截图脚本、Chrome 1440×900 / 390×844 验证。

**Spec:** [docs/superpowers/specs/2026-10-30-baiyun-moxingling-summit-design.md](file:///C:/Users/Administrator/Documents/Qoder/2026-10-30/6ba62647/docs/superpowers/specs/2026-10-30-baiyun-moxingling-summit-design.md)

## Global Constraints

- 坐标：1 场景单位 = 1 米；+Z 为南（城市方向），-Z 为北；山顶平台面为 y = 0。
- 此工作区不是 git 仓库：不执行 commit。每个任务以“CDP 截图 + 控制台 0 报错 + TaskUpdate”作为检查点。
- 所有纹理程序化生成，不引入外部图片；城市/地形为示意复原，关于面板与页脚必须标注。
- 三档时段内部名固定为 `dawn` / `day` / `night`；UI 文案固定为「云海晨曦」「晴日」「夜览」；按钮循环 dawn → day → night → dawn。
- 性能预算：1440×900 ≥60fps；draw calls <900；triangles <120k；移动端降采样。
- 不修改 chen/sacred 的模型与主逻辑；只按 Task 8 修改 `app.js` 与城市 `main.js` 的 baiyun 路由。
- 验证环境：静态服务器 `http://127.0.0.1:4178`，Chrome CDP `http://127.0.0.1:9333`；截图统一写入 `.preview/`。
- 文案中的事实必须来自 Task 1 的资料记录；不确定的尺寸不写精确值。

## File Structure

- Create `canton-atlas/web/immersive/baiyun.html` — 页面结构、HUD、视点栏、关于面板、脚本引用。
- Create `canton-atlas/web/immersive/baiyun.css` — 由 `sacred.css` 复制，改山景配色变量。
- Create `canton-atlas/web/immersive/baiyun-textures.js` — 石、草、岩、混凝土、木、瓦、叶、树皮、城市窗光等 canvas 纹理。
- Create `canton-atlas/web/immersive/baiyun-model.js` — 地形、登顶段、山顶、植被、城市、珠江、云海、热点数据。
- Create `canton-atlas/web/immersive/baiyun-main.js` — 渲染器、天空、灯光、视点、运镜、热点 DOM、时段、4K、城市回跳、`BaiyunDebug`。
- Create `docs/superpowers/research/2026-10-30-baiyun-facts.md` — 事实与来源记录、冲突决策。
- Create `.preview/cdp-baiyun-smoke.js` — 页面加载/地形验收。
- Create `.preview/cdp-baiyun-views.js` — 7 视点 + 3 时段 + 热点 + 4K + 报错验收。
- Create `.preview/cdp-baiyun-mobile.js` — 390×844 验收。
- Create `.preview/cdp-baiyun-integration.js` — 图鉴/城市互跳验收。
- Modify `canton-atlas/web/app.js` — baiyun 的 3D 近景按钮、深链、详情回跳。
- Modify `canton-atlas/web/immersive/main.js` — baiyun 点位的详情按钮与互跳。

---

### Task 1: 事实核对与参考图

**Files:**
- Create: `docs/superpowers/research/2026-10-30-baiyun-facts.md`

**Interfaces:**
- Produces: 一份带来源的事实清单，供 Task 2–7 的文案、尺寸和布局使用；每条事实有来源 URL、可信度、场景决策。

- [ ] **Step 1: 核对核心尺寸与路径**

用 WebSearch / WebFetch 核对以下条目，记录来源与原文关键句：

- 白云山总面积约 21.8 km²、30 多座山峰、主峰摩星岭 382 m。
- 吉星石：门岗约 100 m 处，高 6 m、宽 4 m，合计 10 m，刻「摩星岭」。
- 2024 年栈道 + 扶梯：150 m 栈道 + 两段总长 60 m 自动扶梯，垂直抬升 26 m；扶梯在步梯左侧。
- 山顶平台：公开游记记约 188 ㎡；有锁爱台、指北针（标注广州距北京 1900 km）、祈福牌/许愿区。
- 锦绣南天牌坊：朱德 1965 年题；位置多数游记称在快到山顶的石级上。
- 山顶亭：公开描述为橙瓦飞檐；名称（摘斗亭/山顶亭）有冲突。
- 白云索道终点为山顶广场，距摩星岭约 2 km。

- [ ] **Step 2: 参考图比对**

用 ImageSearch 分别检索「摩星岭 门岗 吉星石」「摩星岭 锦绣南天 牌坊」「摩星岭 扶梯」「摩星岭 山顶平台」「摩星岭 山顶亭」，只看构图、材质、颜色、比例；不下载、不把外部图片用于站点。每条记录写成“看到什么 + 用于场景的决策”，例如“吉星石是浅灰黄整石，字为阴刻，前置小平台”。

- [ ] **Step 3: 写事实记录**

创建 `docs/superpowers/research/2026-10-30-baiyun-facts.md`，按以下结构写（每条 1–3 行，带来源 URL）：

```md
# 白云山 · 摩星岭 事实记录（2026-10-30）

## 已确认
- 主峰摩星岭 382 m；白云山约 21.8 km²、30+ 峰。来源：… 可信度：高。
- 吉星石 6 × 4 m，门岗约 100 m。来源：… 可信度：中高（多篇游记一致）。
...

## 需复核 / 冲突
- 锦绣南天牌坊位置：…
- 山顶亭名称：…

## 场景决策
- 牌坊：只做一座，放在石级步道中段（z ≈ -45）；若官方图明确在别处，再改位置。
- 山顶亭：统一命名「山顶观景亭」；不写“摘斗亭”。
- 平台面积：文案用“约 188 ㎡（游记，待官方复核）”，几何按 15 × 13 m。
- 索道：不进入山顶场景；只在关于面板与城市远景中提到山顶广场。
- 城市远景：示意压缩，不写方位角/距离为实测值。
```

- [ ] **Step 4: 验证**

Run: `sed -n '1,120p' docs/superpowers/research/2026-10-30-baiyun-facts.md`
Expected: 每条事实后有来源 URL；冲突条目都有“场景决策”；没有未处理的“待定”。

- [ ] **Step 5: 记录检查点**

更新任务状态，并把关键决策（牌坊位置、亭命名、平台面积口径）复述在任务备注里。

---

### Task 2: 页面骨架 + 地形/天空/主循环

**Files:**
- Create: `canton-atlas/web/immersive/baiyun.html`
- Create: `canton-atlas/web/immersive/baiyun.css`
- Create: `canton-atlas/web/immersive/baiyun-textures.js`
- Create: `canton-atlas/web/immersive/baiyun-model.js`
- Create: `canton-atlas/web/immersive/baiyun-main.js`
- Test: `.preview/cdp-baiyun-smoke.js`

**Interfaces:**
- Produces:
  - `window.BaiyunTextures.build(renderer)` → `{ stone, stoneDark, grass, rock, concrete, wood, tile, leaf, trunk, paving, cityWindow }`（THREE.Texture）。
  - `window.BaiyunModel.build({ textures, low })` → `{ root, hotspots, materials, cityWinMats, riverMat, cloudMats, platformLights, pathLights, landmarkMats, bounds }`。
  - `window.BaiyunDebug` getters：`fps`, `mode`, `view`, `time`, `renderer`, `scene`, `camera`, `model`, `counts`；方法：`go(name)`, `look(pos,target)`, `timeOfDay(name)`, `open(id)`。
- Consumes: 共享 `three.min.js`；Task 1 的事实（页面文案）。

- [ ] **Step 1: 复制页面并替换文案**

Run: `cp canton-atlas/web/immersive/sacred.html canton-atlas/web/immersive/baiyun.html`

在 `baiyun.html` 中做这些精确替换：

- `<html lang="zh-CN">` 不变；`<title>` → `白云山 · 摩星岭 | CANTON ATLAS 近景`。
- description → `白云山摩星岭登顶段 1:1 近景 3D：吉星石、锦绣南天牌坊、2024 栈道与扶梯、382 米山顶平台、锁爱台与指北针，南望珠江与广州城市天际线；云海晨曦/晴日/夜览三档。`
- favicon 文字 `石` → `云`；填色 `%235b6472` → `%234f6b4f`。
- `<link rel="stylesheet" href="sacred.css">` → `baiyun.css`。
- brand：`<span class="seal">石</span>` → `云`；`<strong>石室圣心大教堂</strong>` → `白云山 · 摩星岭`；`<small>SHISHI SACRED HEART CATHEDRAL · 1:1 近景</small>` → `BAIYUN MOUNTAIN · MOXINGLING · 1:1 近景`。
- scene-label → `羊城第一秀 · 382 米的城市高点`。
- stamp-strip 四行 → `主峰 382 m`、`吉星石 6 × 4 m`、`栈道 150 m + 扶梯 60 m`、`抬升 26 m · 1900 km 北京`。
- view-rail 按钮改为：
```html
<button type="button" data-view="gate" class="active">门岗</button>
<button type="button" data-view="paifang">牌坊</button>
<button type="button" data-view="escalator">扶梯</button>
<button type="button" data-view="platform">平台</button>
<button type="button" data-view="pavilion">亭</button>
<button type="button" data-view="city">城市</button>
<button type="button" data-view="cloudsea">云海</button>
```
- intro：eyebrow `CANTON ATLAS · 近景档案 03`；h1 `白云山 · 摩星岭<br><em>382 米的城市高点</em>`；intro-lede `白云山 21.8 平方公里、三十多座山峰，主峰摩星岭 382 米。从门岗与吉星石起，经锦绣南天牌坊或 150 米栈道 + 60 米扶梯，登顶 188 ㎡ 观察平台；向南是珠江与广州城市天际线。`；intro-meta 四行 → `382 m`、`6 × 4 m 吉星石`、`150 + 60 m`、`1900 km · 北京`；intro-note → `实时 3D · 云海/晴日/夜览 · 支持 4K 截图 · 移动端自动降级`。
- footer chapter → `01 / 门岗 · 吉星石`；scale-note → `1 场景单位 = 1 米 · 登顶段示意复原 · 城市远景为压缩示意`。
- loading 文案 → `正在起山、铺石阶…`。
- about 面板标题 → `这版依据什么复原`；四栏按 Task 1 的事实写：尺度（382 m、21.8 km²、吉星石 6×4 m、平台约 188 ㎡ 游记口径）、路径（150+60 m、26 m、牌坊/亭命名的保守处理）、取舍（索道不进山顶、城市远景压缩、纹理程序化）、资料（来源链接）。
- 脚本引用改为 `baiyun-textures.js`、`baiyun-model.js`、`baiyun-main.js`。
- 顶部按钮文案：`timeBtn` 初始 `云海晨曦`，`shotBtn` 不变，`aboutBtn` 不变，`cityBtn` 初始 `城市全景 ↗`。

- [ ] **Step 2: 建立配色**

Run: `cp canton-atlas/web/immersive/sacred.css canton-atlas/web/immersive/baiyun.css`

只改 `baiyun.css` 的 `:root` 变量：

```css
:root {
  --ink: #0a100c;
  --ink-2: #101813;
  --paper: #f1eee3;
  --paper-soft: rgba(241, 238, 227, 0.72);
  --paper-faint: rgba(241, 238, 227, 0.42);
  --line: rgba(241, 238, 227, 0.18);
  --accent: #5a7157;
  --accent-2: #8ea088;
  --gold: #c9a86a;
  --teal: #3f6f5f;
}
```

其余样式不改；`baiyun.html` 中不出现 `sacred.css`。

- [ ] **Step 3: 生成纹理**

创建 `baiyun-textures.js`，用与 `sacred-textures.js` 相同的 canvas 方式生成以下纹理（每张 512×512，除注明外）：

```js
(function () {
  "use strict";
  function canvasTexture(draw, w, h, repeatX, repeatY) {
    var c = document.createElement("canvas");
    c.width = w || 512; c.height = h || 512;
    draw(c.getContext("2d"), c.width, c.height);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX || 1, repeatY || 1);
    t.anisotropy = 4;
    return t;
  }
  function build(renderer) {
    var stone = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#b9b3a6"; ctx.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 32) {
        for (var x = 0; x < w; x += 64) {
          var o = (Math.floor(y / 32) % 2) * 32;
          var v = 168 + Math.floor(Math.random() * 34);
          ctx.fillStyle = "rgb(" + v + "," + (v - 4) + "," + (v - 12) + ")";
          ctx.fillRect(x + o + 1, y + 1, 62, 30);
        }
      }
      ctx.strokeStyle = "rgba(70,66,58,0.35)"; ctx.lineWidth = 2;
      for (var yy = 0; yy < h; yy += 32) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke(); }
    }, 512, 512, 2, 2);
    var grass = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#41583a"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 5200; i++) {
        var g = 70 + Math.floor(Math.random() * 60);
        ctx.fillStyle = "rgba(" + (g - 26) + "," + g + "," + (g - 34) + ",0.5)";
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    }, 512, 512, 24, 24);
    var rock = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#8a8579"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 2600; i++) {
        var v = 96 + Math.floor(Math.random() * 70);
        ctx.fillStyle = "rgba(" + v + "," + (v - 3) + "," + (v - 10) + ",0.55)";
        ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 7, 0, 6.3); ctx.fill();
      }
    }, 512, 512, 4, 4);
    var paving = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#a9a294"; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(60,56,48,0.35)"; ctx.lineWidth = 3;
      for (var x = 0; x <= w; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (var y = 0; y <= h; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    }, 512, 512, 8, 8);
    var wood = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#6b4a31"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 160; i++) {
        ctx.strokeStyle = "rgba(40,26,16,0.35)";
        ctx.beginPath(); ctx.moveTo(0, i * 3.2); ctx.lineTo(w, i * 3.2 + Math.sin(i) * 6); ctx.stroke();
      }
    }, 512, 512, 3, 3);
    var tile = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#a85b36"; ctx.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 16) {
        for (var x = 0; x < w; x += 24) {
          ctx.fillStyle = "rgba(" + (150 + Math.random() * 42) + "," + (74 + Math.random() * 22) + "," + (44 + Math.random() * 18) + ",0.9)";
          ctx.fillRect(x, y, 22, 14);
        }
      }
    }, 512, 512, 6, 4);
    var leaf = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#2d4a2c"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 1400; i++) {
        var g = 60 + Math.floor(Math.random() * 60);
        ctx.fillStyle = "rgba(" + (g - 24) + "," + g + "," + (g - 30) + ",0.5)";
        ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 5, 0, 6.3); ctx.fill();
      }
    }, 512, 512, 2, 2);
    var trunk = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#4a3828"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 80; i++) {
        ctx.strokeStyle = "rgba(24,16,10,0.4)";
        ctx.beginPath(); ctx.moveTo(i * 6.4, 0); ctx.lineTo(i * 6.4 + 8, h); ctx.stroke();
      }
    }, 256, 512, 2, 3);
    var cityWindow = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#1a2026"; ctx.fillRect(0, 0, w, h);
      for (var y = 6; y < h; y += 14) {
        for (var x = 6; x < w; x += 12) {
          ctx.fillStyle = Math.random() > 0.42 ? "rgba(255,208,140,0.85)" : "rgba(30,38,44,0.9)";
          ctx.fillRect(x, y, 7, 6);
        }
      }
    }, 256, 256, 8, 12);
    return { stone: stone, grass: grass, rock: rock, paving: paving, wood: wood, tile: tile, leaf: leaf, trunk: trunk, cityWindow: cityWindow };
  }
  function makeTextTexture(text, w, h, color, bg) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var ctx = c.getContext("2d");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color;
    ctx.font = "bold " + Math.floor(h * 0.62) + "px 'Songti SC', 'SimSun', serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, h / 2 + h * 0.02);
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }
  window.BaiyunTextures = { build: build, makeTextTexture: makeTextTexture };
})();
```

- [ ] **Step 4: 建地形与最小模型**

创建 `baiyun-model.js`，先只实现地形、天空背景所需的地面与山脊，`build()` 返回空数组占位（Task 3–6 再补）：

```js
(function () {
  "use strict";
  var root, materials, textures;

  function sstep(a, b, x) {
    var t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function heightAt(x, z) {
    var y = -26 * sstep(-80, 10, z);
    y -= 18 * sstep(120, 280, z);
    var ridge = 12 * Math.exp(-Math.pow((Math.abs(x) - 62) / 30, 2)) * sstep(-150, -70, z);
    y += ridge;
    var noise = (Math.sin(x * 0.055) * Math.cos(z * 0.043) + Math.sin(z * 0.11 + x * 0.07)) * 0.9;
    y += noise * sstep(8, 30, Math.abs(x));
    var d = Math.max(Math.abs(x) - 12, Math.abs(z + 90) - 16, 0);
    var flat = 1 - sstep(0, 14, d);
    y = y * (1 - flat);
    return y;
  }

  function buildTerrain(low) {
    var W = 400, D = 400, SX = low ? 70 : 120, SZ = low ? 70 : 120;
    var positions = [], uvs = [], indices = [];
    for (var iz = 0; iz <= SZ; iz++) {
      var z = -D / 2 + (iz / SZ) * D + 20;
      for (var ix = 0; ix <= SX; ix++) {
        var x = -W / 2 + (ix / SX) * W;
        positions.push(x, heightAt(x, z), z);
        uvs.push(ix / SX * 12, iz / SZ * 12);
        if (ix < SX && iz < SZ) {
          var a = iz * (SX + 1) + ix, b = a + 1, c = a + SX + 1, d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    var mat = new THREE.MeshStandardMaterial({
      map: textures.grass, roughness: 1, metalness: 0, color: 0x9aa78c
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  }

  function build(opts) {
    textures = opts.textures;
    var low = !!opts.low;
    root = new THREE.Group();
    root.name = "baiyun-moxingling";
    materials = {};
    buildTerrain(low);
    return {
      root: root, hotspots: [], materials: materials,
      cityWinMats: [], riverMat: null, cloudMats: [],
      platformLights: [], pathLights: [], landmarkMats: [],
      bounds: new THREE.Box3(new THREE.Vector3(-200, -320, -200), new THREE.Vector3(200, 40, 3000))
    };
  }
  window.BaiyunModel = { build: build, heightAt: heightAt };
})();
```

- [ ] **Step 5: 主循环与验收 API**

Run: `cp canton-atlas/web/immersive/sacred-main.js canton-atlas/web/immersive/baiyun-main.js`

在 `baiyun-main.js` 做以下精确修改，其余（渲染器、拖拽、热点 DOM、intro、embed、4K 导出）保持 sacred 的实现：

- 文件头注释 → `白云山 · 摩星岭近景 · 渲染、运镜与交互`。
- `var sacred = null;` → `var baiyun = null;`；所有 `sacred.` → `baiyun.`（仅本文件内）。
- `window.SacredTextures` → `window.BaiyunTextures`；`window.SacredModel` → `window.BaiyunModel`。
- `build({ textures, low: isMobile })` 的返回赋给 `baiyun`；`modelRoot = baiyun.root`。
- 相机远裁剪：`new THREE.PerspectiveCamera(..., 0.1, 30000)`。
- 初始雾：`scene.fog = new THREE.FogExp2(0x9fb0c2, 0.00026);`（城市在 3 km，不能用 sacred 的 0.0026）。
- `VIEWS` 暂时只用 7 个最终视点（Task 7 会再核对文案）：
```js
var VIEWS = {
  gate: { id: "gate", pos: [46, 16, 168], target: [0, -22, 70], fov: 56, chapter: "门岗 · 吉星石" },
  paifang: { id: "paifang", pos: [0, -4, -12], target: [0, -8, -46], fov: 52, chapter: "锦绣南天 · 石级" },
  escalator: { id: "escalator", pos: [-44, -14, 4], target: [-18, -8, -56], fov: 52, chapter: "栈道 · 两段扶梯" },
  platform: { id: "platform", pos: [0, 4, -66], target: [0, 2, -96], fov: 50, chapter: "山顶平台 · 382 米" },
  pavilion: { id: "pavilion", pos: [-10, 4, -78], target: [0, 4, -95], fov: 48, chapter: "山顶观景亭" },
  city: { id: "city", pos: [0, 7, -80], target: [0, -120, 1600], fov: 55, chapter: "南望 · 城市与珠江" },
  cloudsea: { id: "cloudsea", pos: [64, 18, -112], target: [-60, -70, 380], fov: 55, chapter: "云海 · 山脊" },
  intro: { pos: [150, 70, 220], target: [0, -10, -20], fov: 50, chapter: "" }
};
```
- `CINE` 先用 4 段占位（Task 7 完整化）：
```js
var CINE = [
  { dur: 5.0, chapter: "01 / 白云山 · 摩星岭", pos: [180, 90, 300], target: [0, -10, 0], toPos: [80, 30, 200], toTarget: [0, -20, 40] },
  { dur: 5.0, chapter: "02 / 门岗 · 吉星石", pos: [80, 30, 200], target: [0, -20, 40], toPos: [20, 2, 140], toTarget: [0, -22, 110] },
  { dur: 5.0, chapter: "03 / 石级 · 锦绣南天", pos: [20, 2, 140], target: [0, -22, 110], toPos: [0, -6, -10], toTarget: [0, -10, -44] },
  { dur: 6.0, chapter: "04 / 山顶 · 382 米", pos: [0, -6, -10], target: [0, -10, -44], toPos: [0, 7, -80], toTarget: [0, -120, 1600] }
];
```
- `TIME_PRESETS`：按 Task 6 Step 2 的三档数值写入 `baiyun-main.js`（键名 `dawn/day/night`）；Task 2 验收时页面应用 `dawn` 即可。
- `applyTime` 的 `sacred` 分支改为：
```js
if (baiyun) {
  (baiyun.cityWinMats || []).forEach(function (m) { m.emissiveIntensity = (p.city || 0) * 1.4; });
  if (baiyun.riverMat) baiyun.riverMat.emissiveIntensity = (p.city || 0) * 0.55;
  (baiyun.cloudMats || []).forEach(function (m) { m.opacity = (p.cloud || 0) * (m.userData.baseOpacity || 1); });
  (baiyun.platformLights || []).forEach(function (l) { l.intensity = p.platform || 0; });
  (baiyun.pathLights || []).forEach(function (l) { l.intensity = (p.platform || 0) * 0.7; });
  (baiyun.landmarkMats || []).forEach(function (m) { m.emissiveIntensity = p.city || 0; });
}
```
- `timeOfDay` 的默认值 → `"dawn"`；初始化调用 `applyTime("dawn")`。
- `BaiyunDebug` 替换 `SacredDebug`，getters/方法同名；`go` 使用新的 VIEWS。
- 城市按钮：
```js
function goCity() {
  if (inFrame) window.parent.postMessage({ type: "canton-open-city", spot: "baiyun" }, "*");
  else window.location.href = "index.html?spot=baiyun&jump=1";
}
```
- 删除 sacred 专属的 `interiorLights`、`facadeLights`、`flickerLights` 引用；`applyTime` 不再设置它们（baiyun 的灯组由 Task 4/6 提供）。
- `document.body.classList.toggle("night-mode", name === "night")` 保留。

创建 `.preview/cdp-baiyun-smoke.js`（复制 `.preview/cdp-probe-apse3.js` 的连接部分，改 URL 与检查）：

```js
// ... 连接 CDP 后：
await send('Page.navigate', { url: 'http://127.0.0.1:4178/immersive/baiyun.html?view=gate&cb=' + Date.now() });
await new Promise(r => setTimeout(r, 7000));
const smoke = await evalv(`(() => ({
  fps: BaiyunDebug.fps,
  mode: BaiyunDebug.mode,
  view: BaiyunDebug.view,
  time: BaiyunDebug.time,
  counts: BaiyunDebug.counts,
  intro: document.getElementById('intro').classList.contains('hidden'),
  canvas: Array.from(document.querySelectorAll('canvas')).map(c => [c.width, c.height]),
  chapter: document.getElementById('chapter').textContent
}))()`);
console.log('SMOKE', JSON.stringify(smoke));
const errors = events.filter(e => e.method === 'Runtime.exceptionThrown' || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error'));
console.log('ERRORS', errors.length);
```

- [ ] **Step 6: 验证**

先确认服务：`curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4178/immersive/baiyun.html`。若 404，先在 `canton-atlas/web` 启动静态服务（沿用 4178）。

Run: `node .preview/cdp-baiyun-smoke.js`
Expected: `SMOKE` 里 `fps` ≥ 55，`mode` 为 `free`，`view` 为 `gate`，`time` 为 `dawn`，`counts.calls` < 200，`counts.triangles` < 60000，`ERRORS 0`；截图 `.preview/baiyun-smoke.png` 能看到绿色山坡与天空。

- [ ] **Step 7: 记录检查点**

保存截图，更新任务状态。

---

### Task 3: 登顶段（门岗、吉星石、石级、牌坊、栈道、扶梯）

**Files:**
- Modify: `canton-atlas/web/immersive/baiyun-model.js`
- Modify: `canton-atlas/web/immersive/baiyun-main.js`（仅在需要时调整视点）
- Test: `.preview/cdp-baiyun-smoke.js` 扩展到 gate/paifang/escalator 三视点

**Interfaces:**
- Consumes: `heightAt(x, z)`、`materials`、`textures`、`root`。
- Produces: `buildApproach()`；热点条目 `jixing`、`paifang`、`escalator`；石级高度函数 `stairY(z)`（供相机和牌坊使用）。

- [ ] **Step 1: 加材质与辅助函数**

在 `baiyun-model.js` 的 `makeMaterials()` 中加入：

```js
function makeMaterials() {
  var m = {};
  m.stone = new THREE.MeshStandardMaterial({ map: textures.stone, roughness: 0.92, metalness: 0.02, color: 0xd8d2c4 });
  m.stoneDark = new THREE.MeshStandardMaterial({ color: 0x5d5a52, roughness: 0.95 });
  m.paving = new THREE.MeshStandardMaterial({ map: textures.paving, roughness: 0.9, color: 0xb8b0a0 });
  m.wood = new THREE.MeshStandardMaterial({ map: textures.wood, roughness: 0.86, color: 0xa07652 });
  m.tile = new THREE.MeshStandardMaterial({ map: textures.tile, roughness: 0.78, color: 0xb97a4e });
  m.rock = new THREE.MeshStandardMaterial({ map: textures.rock, roughness: 0.98, color: 0xaaa496 });
  m.metal = new THREE.MeshStandardMaterial({ color: 0x4b4f50, roughness: 0.45, metalness: 0.6 });
  m.glassRail = new THREE.MeshStandardMaterial({ color: 0x9ec4bd, roughness: 0.18, metalness: 0.05, transparent: true, opacity: 0.35 });
  m.gold = new THREE.MeshStandardMaterial({ color: 0xb08a4e, roughness: 0.4, metalness: 0.55 });
  m.plaque = new THREE.MeshStandardMaterial({ color: 0x2c241c, roughness: 0.6 });
  return m;
}
```

加通用辅助（与 sacred 的 addBox/addCyl 同签名，但这里直接写在本文件）：

```js
function addBox(parent, w, h, d, mat, x, y, z, ry) {
  var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  if (ry) mesh.rotation.y = ry;
  mesh.castShadow = true; mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function addCyl(parent, rt, rb, h, seg, mat, x, y, z) {
  var mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
```

- [ ] **Step 2: 建立登顶段坐标与石级函数**

在 `baiyun-model.js` 顶部加常量：

```js
var GATE_Z = 120;
var ROCK_Z = 20;
var STAIR_TOP_Z = -83;
var STAIR_BOTTOM_Z = 10;
var STAIR_RISE = 26;
var PLATFORM_Z = -90;
```

石级高度（从 z=10 的 -26 m 到 z=-83 的 0 m）：

```js
function stairY(z) {
  var t = (STAIR_BOTTOM_Z - z) / (STAIR_BOTTOM_Z - STAIR_TOP_Z);
  return -STAIR_RISE * (1 - Math.max(0, Math.min(1, t)));
}
```

- [ ] **Step 3: 门岗与吉星石**

```js
function buildGate() {
  var g = new THREE.Group();
  var y0 = heightAt(0, GATE_Z);
  [-6, 6].forEach(function (x) {
    addBox(g, 1.4, 4.2, 1.4, materials.stone, x, y0 + 2.1, GATE_Z);
    addBox(g, 1.8, 0.5, 1.8, materials.stoneDark, x, y0 + 4.35, GATE_Z);
  });
  addBox(g, 14.6, 0.7, 1.6, materials.wood, 0, y0 + 4.9, GATE_Z);
  addBox(g, 16.0, 0.35, 2.6, materials.tile, 0, y0 + 5.35, GATE_Z);
  addBox(g, 2.2, 0.9, 0.18, materials.plaque, 0, y0 + 4.9, GATE_Z + 0.82);
  var sign = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.62), new THREE.MeshBasicMaterial({
    map: BaiyunTextures.makeTextTexture("摩星岭", 512, 160, "#e8dcc4", "#26302a"), transparent: true
  }));
  sign.position.set(0, y0 + 4.9, GATE_Z + 0.93);
  g.add(sign);
  addBox(g, 18, 0.4, 0.5, materials.stoneDark, 0, y0 + 0.2, GATE_Z + 2.4);
  [-8.5, 8.5].forEach(function (x) {
    addCyl(g, 0.18, 0.24, 2.4, 8, materials.metal, x, y0 + 1.2, GATE_Z);
    addBox(g, 0.4, 0.4, 0.4, materials.gold, x, y0 + 2.5, GATE_Z);
  });
  root.add(g);
}

function buildJixingStone() {
  var g = new THREE.Group();
  var x = 8, z = ROCK_Z;
  var y = heightAt(x, z);
  var rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), materials.rock);
  rock.scale.set(2.0, 3.2, 1.2);
  rock.position.set(x, y + 3.0, z);
  rock.rotation.set(0.08, -0.35, 0.06);
  rock.castShadow = true; rock.receiveShadow = true;
  g.add(rock);
  var text = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 5.4), new THREE.MeshBasicMaterial({
    map: BaiyunTextures.makeTextTexture("摩星岭", 512, 768, "#d9c9a7", "#8b2e26"), transparent: true
  }));
  text.position.set(x - 0.4, y + 3.1, z + 1.34);
  text.rotation.y = -0.18;
  g.add(text);
  addBox(g, 5.6, 0.25, 3.4, materials.paving, x, y + 0.12, z + 0.6);
  root.add(g);
}
```

- [ ] **Step 4: 石级、栏杆、牌坊**

```js
function buildStairs() {
  var steps = [];
  var count = 180;
  for (var i = 0; i < count; i++) {
    var z = STAIR_BOTTOM_Z - (i / count) * (STAIR_BOTTOM_Z - STAIR_TOP_Z);
    var y = stairY(z);
    steps.push({ z: z, y: y });
  }
  var geo = new THREE.BoxGeometry(3.8, 0.16, 0.52);
  var mesh = new THREE.InstancedMesh(geo, materials.stone, steps.length);
  var dummy = new THREE.Object3D();
  steps.forEach(function (s, i) {
    dummy.position.set(0, s.y - 0.08, s.z);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);
  [20, 60, 100, 140].forEach(function (i) {
    var s = steps[i];
    addBox(root, 6.0, 0.2, 2.4, materials.paving, 0, s.y + 0.02, s.z);
  });
  [-2.0, 2.0].forEach(function (x) {
    var pts = steps.filter(function (_, i) { return i % 6 === 0; }).map(function (s) {
      return new THREE.Vector3(x, s.y + 1.0, s.z);
    });
    var curve = new THREE.CatmullRomCurve3(pts);
    var rail = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.06, 5, false), materials.metal);
    root.add(rail);
    steps.forEach(function (s, i) {
      if (i % 6 === 0) addCyl(root, 0.05, 0.05, 1.0, 5, materials.metal, x, s.y + 0.5, s.z);
    });
  });
}

function buildPaifang() {
  var z = -45;
  var y0 = stairY(z);
  var g = new THREE.Group();
  [-3.3, 3.3].forEach(function (x) {
    addBox(g, 0.9, 5.4, 0.9, materials.stone, x, y0 + 2.7, z);
    addBox(g, 1.3, 0.4, 1.3, materials.stoneDark, x, y0 + 5.55, z);
  });
  addBox(g, 8.2, 0.65, 1.3, materials.stone, 0, y0 + 6.1, z);
  addBox(g, 9.4, 0.35, 2.2, materials.tile, 0, y0 + 6.55, z);
  addBox(g, 2.6, 0.9, 0.16, materials.plaque, 0, y0 + 5.7, z + 0.66);
  var plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.62), new THREE.MeshBasicMaterial({
    map: BaiyunTextures.makeTextTexture("锦绣南天", 768, 220, "#e5d5b2", "#3a2a1c"), transparent: true
  }));
  plaque.position.set(0, y0 + 5.7, z + 0.75);
  g.add(plaque);
  root.add(g);
}
```

- [ ] **Step 5: 栈道与两段扶梯**

```js
function buildBoardwalk() {
  var pts = [
    new THREE.Vector3(-10, heightAt(-10, 115) + 0.35, 115),
    new THREE.Vector3(-28, heightAt(-28, 80) + 0.35, 80),
    new THREE.Vector3(-14, heightAt(-14, 45) + 0.35, 45),
    new THREE.Vector3(-30, heightAt(-30, 5) + 0.35, 5),
    new THREE.Vector3(-16, heightAt(-16, -20) + 0.35, -20)
  ];
  var curve = new THREE.CatmullRomCurve3(pts);
  var N = 120;
  var verts = [], uvs = [], idx = [];
  for (var i = 0; i <= N; i++) {
    var p = curve.getPointAt(i / N);
    var tan = curve.getTangentAt(i / N);
    var nx = -tan.z, nz = tan.x;
    var len = Math.sqrt(nx * nx + nz * nz) || 1;
    nx /= len; nz /= len;
    verts.push(p.x + nx * 1.1, p.y, p.z + nz * 1.1);
    verts.push(p.x - nx * 1.1, p.y, p.z - nz * 1.1);
    uvs.push(0, i / N * 18, 1, i / N * 18);
    if (i < N) {
      var a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, c, b, b, c, d);
    }
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  var deck = new THREE.Mesh(geo, materials.wood);
  deck.castShadow = true; deck.receiveShadow = true;
  root.add(deck);
  for (var k = 0; k <= 50; k++) {
    var p = curve.getPointAt(k / 50);
    var ground = heightAt(p.x, p.z);
    if (p.y - ground > 0.3) addCyl(root, 0.08, 0.11, p.y - ground, 6, materials.wood, p.x, ground + (p.y - ground) / 2, p.z);
    if (k % 2 === 0) {
      addCyl(root, 0.05, 0.05, 1.1, 5, materials.metal, p.x, p.y + 0.55, p.z);
    }
  }
  [-1, 1].forEach(function (side) {
    var railPts = [];
    for (var i = 0; i <= N; i += 2) {
      var p = curve.getPointAt(i / N);
      var tan = curve.getTangentAt(i / N);
      var nx = -tan.z, nz = tan.x;
      var len = Math.sqrt(nx * nx + nz * nz) || 1;
      railPts.push(new THREE.Vector3(p.x + side * nx / len * 1.0, p.y + 1.0, p.z + side * nz / len * 1.0));
    }
    var rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts), 100, 0.045, 5, false), materials.metal);
    root.add(rail);
  });
  return curve;
}

function buildEscalator() {
  var lower = new THREE.Vector3(-16, heightAt(-16, -18) + 0.6, -18);
  var mid = new THREE.Vector3(-23, -12, -50);
  var top = new THREE.Vector3(-14, 0.2, -80);
  [[lower, mid], [mid, top]].forEach(function (leg) {
    var a = leg[0], b = leg[1];
    var dir = b.clone().sub(a);
    var len = dir.length();
    var angle = Math.atan2(dir.y, Math.sqrt(dir.x * dir.x + dir.z * dir.z));
    var flat = Math.sqrt(dir.x * dir.x + dir.z * dir.z);
    var g = new THREE.Group();
    var base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.8, len), materials.metal);
    base.position.copy(a).add(b).multiplyScalar(0.5);
    base.rotation.x = -angle;
    base.rotation.y = Math.atan2(dir.x, dir.z);
    g.add(base);
    var steps = new THREE.InstancedMesh(new THREE.BoxGeometry(2.8, 0.18, 0.42), materials.stoneDark, Math.floor(len / 0.55));
    var dummy = new THREE.Object3D();
    for (var i = 0; i < steps.count; i++) {
      var t = (i + 0.5) / steps.count;
      dummy.position.lerpVectors(a, b, t);
      dummy.position.y += 0.25;
      dummy.rotation.x = -angle;
      dummy.updateMatrix();
      steps.setMatrixAt(i, dummy.matrix);
    }
    g.add(steps);
    [-1.6, 1.6].forEach(function (x) {
      var side = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, len), materials.glassRail);
      side.position.copy(a).add(b).multiplyScalar(0.5);
      side.position.x += x;
      side.rotation.x = -angle;
      side.rotation.y = Math.atan2(dir.x, dir.z);
      g.add(side);
    });
    var roof = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.18, len), materials.glassRail);
    roof.position.copy(a).add(b).multiplyScalar(0.5);
    roof.position.y += 2.4;
    roof.rotation.x = -angle;
    roof.rotation.y = Math.atan2(dir.x, dir.z);
    g.add(roof);
    root.add(g);
  });
  addBox(root, 6, 3.4, 5, materials.stone, -16, heightAt(-16, -18) + 1.7, -18);
  addBox(root, 6, 3.4, 5, materials.stone, -14, 1.7, -80);
  addBox(root, 6, 0.4, 5.5, materials.tile, -14, 3.6, -80);
  addBox(root, 4, 0.25, 4, materials.paving, -14, 0.1, -82);
}
```

扶梯底部和顶部的小屋是机房体量；扶梯角度与“两段 60 m、抬升 26 m”一致（每段约 30 m 长、12–13 m 抬升）。

- [ ] **Step 6: 接入 build 与热点**

在 `build()` 里依次调用 `buildGate(); buildJixingStone(); buildStairs(); buildPaifang(); buildBoardwalk(); buildEscalator();`，并在返回的 `hotspots` 里加入：

```js
hotspots = [
  {
    id: "jixing", craft: "jixing", no: "01", name: "吉星石",
    pos: new THREE.Vector3(8, heightAt(8, ROCK_Z) + 3, ROCK_Z),
    view: { pos: new THREE.Vector3(22, heightAt(8, ROCK_Z) + 3, ROCK_Z + 18), target: new THREE.Vector3(8, heightAt(8, ROCK_Z) + 3, ROCK_Z) },
    lede: "门岗约 100 米处的大型塑石，高 6 米、宽 4 米，合为 10 米，取“十全十美、吉星高照”。",
    facts: [["高", "6 m"], ["宽", "4 m"], ["距门岗", "约 100 m"]],
    detail: "石上刻“摩星岭”三字，游客常在此留影再登顶。尺寸与位置来自公开游记，场景按 1:1 示意复原。"
  },
  {
    id: "paifang", craft: "paifang", no: "02", name: "锦绣南天牌坊",
    pos: new THREE.Vector3(0, stairY(-45) + 5.7, -45),
    view: { pos: new THREE.Vector3(0, stairY(-45) + 2.4, -24), target: new THREE.Vector3(0, stairY(-45) + 4.2, -45) },
    lede: "石级中段的牌坊，正面“锦绣南天”四字为朱德 1965 年登临白云山时所题。",
    facts: [["题写", "1965 年"], ["题字", "朱德"], ["位置", "登顶石级"]],
    detail: "牌坊位置在不同游记中有“快到山顶的石级上”与“吉星石旁”两种说法；本场景按前者布置，并以资料阶段核对为准。"
  },
  {
    id: "escalator", craft: "escalator", no: "03", name: "栈道与扶梯",
    pos: new THREE.Vector3(-20, -6, -34),
    view: { pos: new THREE.Vector3(-46, -14, -2), target: new THREE.Vector3(-18, -8, -52) },
    lede: "2024 年建成的登顶辅助设施：150 米栈道 + 两段总长 60 米的自动扶梯，垂直抬升 26 米。",
    facts: [["栈道", "150 m"], ["扶梯", "60 m"], ["抬升", "26 m"]],
    detail: "扶梯在步梯左侧，游客可选石级或“栈道 + 扶梯”登顶。场景按公开游记的尺度做示意复原。"
  }
];
```

- [ ] **Step 7: 验证**

扩展 `.preview/cdp-baiyun-smoke.js`，依次 `BaiyunDebug.go('gate'|'paifang'|'escalator')`，每站截图 `.preview/baiyun-gate.png`、`baiyun-paifang.png`、`baiyun-escalator.png`，检查 `fps ≥ 55`、`counts.calls < 500`、`ERRORS 0`。目视检查：石级连续、牌坊不悬空、扶梯两段连续、没有穿模。

- [ ] **Step 8: 记录检查点**

保存三张截图，更新任务状态。

---

### Task 4: 山顶平台、亭、指北针与植被

**Files:**
- Modify: `canton-atlas/web/immersive/baiyun-model.js`
- Test: 截图 `baiyun-platform.png`、`baiyun-pavilion.png`

**Interfaces:**
- Consumes: `materials`、`heightAt`、平台常量 `PLATFORM_Z`。
- Produces: `buildSummit()`、`buildVegetation(low)`；热点 `peak`、`locks`；平台灯数组 `platformLights`、`pathLights`。

- [ ] **Step 1: 平台与栏杆**

```js
function buildSummit() {
  addBox(root, 15, 0.3, 13, materials.paving, 0, 0, PLATFORM_Z);
  addBox(root, 15.8, 0.5, 13.8, materials.stoneDark, 0, -0.35, PLATFORM_Z);
  // 南侧留出观景口，其余三边栏杆
  [[-7.2, -6.5, 0.2, 13], [7.2, -6.5, 0.2, 13], [0, -6.5, 15, 0.2]].forEach(function (r) {
    addBox(root, r[2], 0.5, r[3], materials.stoneDark, r[0], 0.25, PLATFORM_Z + r[1]);
  });
  for (var i = 0; i < 18; i++) {
    var t = i / 17;
    var x = -7 + t * 14;
    if (i % 2 === 0) addCyl(root, 0.07, 0.07, 1.05, 6, materials.metal, x, 0.55, PLATFORM_Z - 6.4);
  }
  addBox(root, 14, 0.08, 0.08, materials.metal, 0, 1.05, PLATFORM_Z - 6.4);
  // 382 标高 / 指北针
  var marker = addCyl(root, 1.9, 2.1, 0.35, 32, materials.stoneDark, 0, 0.18, PLATFORM_Z + 3.2);
  var compass = new THREE.Mesh(new THREE.CircleGeometry(1.55, 48), new THREE.MeshBasicMaterial({
    map: BaiyunTextures.makeTextTexture("北 · 1900 km", 512, 512, "#e8dcc4", "#2f332e"), transparent: true
  }));
  compass.rotation.x = -Math.PI / 2;
  compass.position.set(0, 0.37, PLATFORM_Z + 3.2);
  root.add(compass);
  addCyl(root, 0.06, 0.06, 0.5, 6, materials.gold, 0, 0.62, PLATFORM_Z + 3.2);
  var needle = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.2, 4), materials.gold);
  needle.position.set(0, 1.1, PLATFORM_Z + 3.2);
  root.add(needle);
}
```

平台南侧（z = PLATFORM_Z + 6.5，面向城市）留空作为观景口，不设栏杆；其他三边做石矮墙 + 金属栏杆。

- [ ] **Step 2: 锁爱台、祈福牌、标识牌**

```js
function buildRitualProps() {
  addCyl(root, 1.9, 2.1, 0.28, 24, materials.stone, 5.2, 0.14, PLATFORM_Z - 1.5);
  for (var i = 0; i < 14; i++) {
    var a = (i / 14) * Math.PI * 2;
    addCyl(root, 0.03, 0.03, 1.0, 4, materials.gold, 5.2 + Math.cos(a) * 1.7, 0.75, PLATFORM_Z - 1.5 + Math.sin(a) * 1.7);
  }
  addBox(root, 0.9, 1.2, 0.12, materials.rock, 5.2, 0.75, PLATFORM_Z - 3.0);
  // 许愿牌架
  [-4.6, -6.6].forEach(function (x) {
    addBox(root, 0.16, 2.4, 0.16, materials.wood, x, 1.2, PLATFORM_Z - 2.4);
    addBox(root, 2.2, 0.12, 0.12, materials.wood, x + 0.9, 2.2, PLATFORM_Z - 2.4);
    for (var j = 0; j < 6; j++) {
      addBox(root, 0.18, 0.3, 0.04, materials.gold, x + 0.15 + j * 0.32, 1.95 - j * 0.05, PLATFORM_Z - 2.4);
    }
  });
  // 382 石碑
  addBox(root, 1.7, 2.2, 0.5, materials.stone, -2.0, 1.1, PLATFORM_Z + 5.2);
  var sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.1), new THREE.MeshBasicMaterial({
    map: BaiyunTextures.makeTextTexture("摩星岭 382m", 512, 400, "#e8dcc4", "#3b3a32"), transparent: true
  }));
  sign.position.set(-2.0, 1.25, PLATFORM_Z + 5.47);
  root.add(sign);
}
```

- [ ] **Step 3: 山顶观景亭**

```js
function buildPavilion() {
  var y = 0;
  var g = new THREE.Group();
  g.position.set(0, y, PLATFORM_Z - 4.2);
  addBox(g, 5.2, 0.35, 5.2, materials.stoneDark, 0, 0.18, 0);
  [[-2.1, -2.1], [2.1, -2.1], [2.1, 2.1], [-2.1, 2.1]].forEach(function (p) {
    addCyl(g, 0.16, 0.2, 3.4, 8, materials.wood, p[0], 1.9, p[1]);
  });
  addBox(g, 4.8, 0.22, 4.8, materials.wood, 0, 3.55, 0);
  var roof1 = new THREE.Mesh(new THREE.ConeGeometry(4.2, 1.6, 4), materials.tile);
  roof1.rotation.y = Math.PI / 4;
  roof1.position.y = 4.45;
  g.add(roof1);
  var roof2 = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.0, 4), materials.tile);
  roof2.rotation.y = Math.PI / 4;
  roof2.position.y = 5.35;
  g.add(roof2);
  addCyl(g, 0.05, 0.05, 1.8, 6, materials.metal, 0, 6.4, 0);
  addBox(g, 0.8, 0.04, 0.5, new THREE.MeshBasicMaterial({ color: 0xb9312a }), 0.5, 6.9, 0);
  addBox(g, 2.6, 0.45, 0.5, materials.wood, 0, 0.55, 1.4);
  addCyl(g, 0.16, 0.2, 2.6, 8, materials.metal, 0, 1.3, 2.25);
  addCyl(g, 0.55, 0.55, 0.1, 24, materials.stoneDark, 0, 2.6, 2.25);
  root.add(g);
  platformLights.push(new THREE.PointLight(0xffc98a, 0, 22, 2));
  platformLights[platformLights.length - 1].position.set(0, 4.2, PLATFORM_Z - 4);
  root.add(platformLights[platformLights.length - 1]);
}
```

亭为方形重檐（近似橙瓦飞檐），中心在 z = PLATFORM_Z - 4.2；不写“摘斗亭”。红布/小旗是体量点缀，不做动态。

- [ ] **Step 4: 平台夜灯与步道灯**

```js
function buildLamps() {
  [[-5.8, PLATFORM_Z + 4.8], [5.8, PLATFORM_Z + 4.8], [-5.8, PLATFORM_Z - 5.2], [5.8, PLATFORM_Z - 5.2]].forEach(function (p) {
    addCyl(root, 0.06, 0.08, 2.6, 6, materials.metal, p[0], 1.3, p[1]);
    var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd6a0 }));
    lamp.position.set(p[0], 2.7, p[1]);
    root.add(lamp);
    var light = new THREE.PointLight(0xffc98a, 0, 16, 2);
    light.position.set(p[0], 2.5, p[1]);
    root.add(light);
    platformLights.push(light);
  });
  [80, 40, -10].forEach(function (z) {
    var x = z > 50 ? -8 : z > 10 ? -20 : -2;
    addCyl(root, 0.05, 0.07, 2.4, 6, materials.metal, x, heightAt(x, z) + 1.2, z);
    var light = new THREE.PointLight(0xffc98a, 0, 14, 2);
    light.position.set(x, heightAt(x, z) + 2.4, z);
    root.add(light);
    pathLights.push(light);
  });
}
```

- [ ] **Step 5: 植被与山石**

```js
function buildVegetation(low) {
  var rand = mulberry32(20261030);
  var target = low ? 260 : 900;
  var trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 1.4, 5);
  trunkGeo.translate(0, 0.7, 0);
  var canopyGeo = new THREE.ConeGeometry(1.0, 2.8, 6);
  canopyGeo.translate(0, 1.4, 0);
  var trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ map: textures.trunk, color: 0x6b5944, roughness: 1 }), target);
  var canopyMat = new THREE.MeshStandardMaterial({ map: textures.leaf, color: 0x72936a, roughness: 1 });
  var canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, target);
  var dummy = new THREE.Object3D();
  var placed = 0, guard = 0;
  while (placed < target && guard < target * 8) {
    guard++;
    var x = rand() * 360 - 180;
    var z = rand() * 330 - 160;
    var y = heightAt(x, z);
    if (y > -1 || y < -60) continue;
    if (Math.abs(x) < 9 && z > -90 && z < 130) continue;
    if (x > -36 && x < -8 && z > -85 && z < 125) continue;
    if (Math.abs(x) < 17 && z > -110 && z < -70) continue;
    if (z > -70 && Math.abs(x) < 0.16 * (z + 70) + 8) continue;
    var s = 0.6 + rand() * 0.9;
    dummy.position.set(x, y, z);
    dummy.scale.set(s, s * (0.9 + rand() * 0.3), s);
    dummy.rotation.y = rand() * Math.PI * 2;
    dummy.updateMatrix();
    trunks.setMatrixAt(placed, dummy.matrix);
    canopies.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  trunks.count = canopies.count = placed;
  trunks.castShadow = canopies.castShadow = !low;
  trunks.receiveShadow = canopies.receiveShadow = true;
  root.add(trunks); root.add(canopies);
  // 岩石
  var rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.9, 0), materials.rock, low ? 30 : 70);
  var rc = 0;
  while (rc < rocks.count && guard < target * 12) {
    guard++;
    var rx = rand() * 340 - 170, rz = rand() * 300 - 140;
    var ry = heightAt(rx, rz);
    if (ry > -2 || ry < -40) continue;
    var rs = 0.4 + rand() * 1.2;
    dummy.position.set(rx, ry + rs * 0.2, rz);
    dummy.scale.set(rs, rs * 0.7, rs);
    dummy.rotation.set(rand(), rand() * 6.3, rand());
    dummy.updateMatrix();
    rocks.setMatrixAt(rc, dummy.matrix);
    rc++;
  }
  rocks.count = rc;
  root.add(rocks);
}
```

需要 `mulberry32`（从城市 main.js 复制）：

```js
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 6: 接入与热点**

在 `build()` 里调用 `buildSummit(); buildRitualProps(); buildPavilion(); buildLamps(); buildVegetation(low);`，并加入热点：

```js
{
  id: "peak", craft: "peak", no: "04", name: "摩星岭 · 382 米",
  pos: new THREE.Vector3(0, 1.4, PLATFORM_Z + 3.2),
  view: { pos: new THREE.Vector3(0, 4, PLATFORM_Z + 15), target: new THREE.Vector3(0, 0.6, PLATFORM_Z + 3) },
  lede: "白云山主峰，广州城区最高点；旧称碧云峰，清康熙《广东志》以“高可摩星”得名。",
  facts: [["海拔", "382 m"], ["旧称", "碧云峰"], ["山顶", "指北针 · 1900 km"]],
  detail: "山顶平台设有指北针地标，指向北京并标注广州距北京 1900 km。平台面积约 188 ㎡ 为公开游记口径，场景按 15 × 13 m 示意复原。"
},
{
  id: "locks", craft: "locks", no: "05", name: "锁爱台 · 祈福牌",
  pos: new THREE.Vector3(5.2, 1.6, PLATFORM_Z - 1.5),
  view: { pos: new THREE.Vector3(10, 2.4, PLATFORM_Z + 4), target: new THREE.Vector3(5.2, 0.8, PLATFORM_Z - 1.5) },
  lede: "山顶的许愿区：锁爱台、祈福牌与风铃，把“登高”变成一件可以留下的事情。",
  facts: [["位置", "山顶平台"], ["做法", "锁爱台 · 祈福牌"], ["提示", "以现场为准"]],
  detail: "锁爱台与祈福牌是山顶平台上的常见打卡点；具体形式会随景区维护调整，本场景只做示意。"
}
```

- [ ] **Step 7: 验证**

Run: `node .preview/cdp-baiyun-smoke.js`，切到 `platform` 与 `pavilion`，截图 `.preview/baiyun-platform.png`、`baiyun-pavilion.png`；检查平台栏杆不断、亭不悬空、树不穿平台/步道、`fps ≥ 55`、`ERRORS 0`。

- [ ] **Step 8: 记录检查点**

保存截图，更新任务状态。

---

### Task 5: 城市、珠江与地标

**Files:**
- Modify: `canton-atlas/web/immersive/baiyun-model.js`
- Test: `.preview/baiyun-city-day.png`

**Interfaces:**
- Produces: `cityWinMats`（城市块/地标窗光的材质数组）、`riverMat`、`landmarkMats`、`midground`；城市几何不参与阴影，实例不设 `frustumCulled` 例外。

- [ ] **Step 1: 城市块**

```js
function buildCity(low) {
  var rand = mulberry32(3020);
  var count = low ? 180 : 420;
  var geo = new THREE.BoxGeometry(1, 1, 1);
  var mat = new THREE.MeshStandardMaterial({
    map: textures.cityWindow,
    color: 0x9aa4a6,
    roughness: 0.82,
    metalness: 0.08,
    emissive: 0xffcf8a,
    emissiveMap: textures.cityWindow,
    emissiveIntensity: 0
  });
  cityWinMats.push(mat);
  var blocks = new THREE.InstancedMesh(geo, mat, count);
  var dummy = new THREE.Object3D();
  var n = 0, guard = 0;
  while (n < count && guard < count * 6) {
    guard++;
    var x = rand() * 3600 - 1800;
    var z = 2850 + rand() * 1300;
    if (z > 2350 && z < 2650 && Math.abs(x) < 2600) continue;
    if (Math.abs(x) < 8 && z < 3200) continue;
    if (Math.hypot(x + 260, z - 3050) < 90) continue;
    if (Math.hypot(x - 280, z - 3150) < 80) continue;
    if (Math.hypot(x - 360, z - 3230) < 80) continue;
    if (Math.hypot(x - 40, z - 3000) < 70) continue;
    var h = 22 + Math.pow(rand(), 1.6) * 130;
    dummy.position.set(x, -300 + h / 2, z);
    dummy.scale.set(28 + rand() * 50, h, 28 + rand() * 50);
    dummy.rotation.y = 0;
    dummy.updateMatrix();
    blocks.setMatrixAt(n, dummy.matrix);
    n++;
  }
  blocks.count = n;
  root.add(blocks);
}
```

城市地面 `-300` 是压缩后的“江面/平原”高度；城市块不投影、不接收阴影。窗户纹理在实例上会被拉伸，但在 3 km 距离下只剩明暗点，符合风格化远景。

- [ ] **Step 2: 广州塔与双塔、中信**

```js
function buildLandmarks() {
  var g = new THREE.Group();
  var glass = new THREE.MeshStandardMaterial({
    color: 0x2c3946, roughness: 0.3, metalness: 0.4,
    emissive: 0xffcf8a, emissiveMap: textures.cityWindow, emissiveIntensity: 0
  });
  landmarkMats.push(glass);
  cityWinMats.push(glass);
  // 广州塔：旋转体剪影
  var profile = [
    new THREE.Vector2(26, 0), new THREE.Vector2(19, 60), new THREE.Vector2(15, 140),
    new THREE.Vector2(13, 220), new THREE.Vector2(17, 300), new THREE.Vector2(22, 380),
    new THREE.Vector2(19, 440), new THREE.Vector2(11, 500), new THREE.Vector2(5, 560),
    new THREE.Vector2(2, 600)
  ];
  var tower = new THREE.Mesh(new THREE.LatheGeometry(profile, 20), glass);
  tower.position.set(-260, -300, 3050);
  g.add(tower);
  var antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 90, 6), materials.metal);
  antenna.position.set(-260, 345, 3050);
  g.add(antenna);
  for (var i = 0; i < 10; i++) {
    var y = 40 + i * 52;
    var r = 20 - i * 1.1;
    var ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.8, 4, 24), new THREE.MeshBasicMaterial({ color: 0x8fa7b8, transparent: true, opacity: 0.35 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(-260, -300 + y, 3050);
    g.add(ring);
  }
  // 东塔 / 西塔 / 中信：阶梯体量
  function towerBox(x, z, w, h, color) {
    var m = new THREE.MeshStandardMaterial({
      color: color, roughness: 0.35, metalness: 0.45,
      emissive: 0xffcf8a, emissiveMap: textures.cityWindow, emissiveIntensity: 0
    });
    landmarkMats.push(m);
    cityWinMats.push(m);
    var t = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), m);
    t.position.set(x, -300 + h / 2, z);
    g.add(t);
    var crown = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.12, w * 0.45, h * 0.08, 4), m);
    crown.position.set(x, -300 + h + h * 0.04, z);
    crown.rotation.y = Math.PI / 4;
    g.add(crown);
  }
  towerBox(280, 3150, 46, 530, 0x33475a);
  towerBox(360, 3230, 42, 520, 0x33475a);
  towerBox(40, 3000, 38, 390, 0x374b52);
  root.add(g);
}
```

广州塔、双塔、中信的高度按公开资料取 600/530/390 m 级别（Task 1 复核），水平位置为示意压缩，不写为实测方位。

- [ ] **Step 3: 中景山脊、珠江与城市地面**

```js
function buildMidground(low) {
  var geo = new THREE.PlaneGeometry(4600, 3000, low ? 30 : 60, low ? 20 : 40);
  geo.rotateX(-Math.PI / 2);
  var pos = geo.attributes.position;
  for (var i = 0; i < pos.count; i++) {
    var x = pos.getX(i);
    var zLocal = pos.getZ(i);
    var z = zLocal + 1650;
    var y = -44 - 256 * sstep(150, 2300, z)
      + 26 * Math.sin(x * 0.0022 + 1.7) * Math.cos(z * 0.0019);
    pos.setY(i, y);
  }
  geo.computeVertexNormals();
  var mat = new THREE.MeshStandardMaterial({ color: 0x33453a, roughness: 1 });
  var mesh = new THREE.Mesh(geo, mat);
  mesh.position.z = 1650;
  root.add(mesh);
  [[-520, -560, 620, 120], [380, -660, 760, 150], [780, -420, 520, 100]].forEach(function (r) {
    var ridge = new THREE.Mesh(new THREE.ConeGeometry(r[2], r[3], 6), new THREE.MeshStandardMaterial({ color: 0x263a30, roughness: 1 }));
    ridge.position.set(r[0], -60, r[1]);
    ridge.scale.z = 0.55;
    root.add(ridge);
  });
}

function buildRiver() {
  riverMat = new THREE.MeshStandardMaterial({
    color: 0x24424a, roughness: 0.32, metalness: 0.35,
    emissive: 0xff9a5a, emissiveIntensity: 0
  });
  var river = new THREE.Mesh(new THREE.PlaneGeometry(5200, 420, 1, 1), riverMat);
  river.rotation.x = -Math.PI / 2;
  river.position.set(0, -299.5, 2480);
  root.add(river);
  var ground = new THREE.Mesh(new THREE.PlaneGeometry(5000, 2600), new THREE.MeshBasicMaterial({ color: 0x0c1418 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -300.2, 3500);
  root.add(ground);
}
```

- [ ] **Step 4: 接入**

在 `build()` 中初始化 `cityWinMats = []; riverMat = null;`，调用 `buildMidground(low); buildCity(low); buildLandmarks(); buildRiver();`；返回 `cityWinMats`、`riverMat`、`landmarkMats`。

- [ ] **Step 5: 验证**

在 `BaiyunDebug.go('city')` 后截图 `.preview/baiyun-city-day.png`。检查：核心山坡与中景/城市地面没有断崖、城市在雾中可见、广州塔/双塔/中信轮廓可辨、珠江带在城前、没有城市块穿过江面、`calls < 700`、`ERRORS 0`。

- [ ] **Step 6: 记录检查点**

保存截图，更新任务状态。

---

### Task 6: 云海与三档时段

**Files:**
- Modify: `canton-atlas/web/immersive/baiyun-model.js`
- Modify: `canton-atlas/web/immersive/baiyun-main.js`
- Test: `.preview/baiyun-dawn.png`、`baiyun-day.png`、`baiyun-night.png`

**Interfaces:**
- Consumes: `cityWinMats`、`riverMat`、`landmarkMats`、`platformLights`、`pathLights`。
- Produces: `cloudMats`（每张 sprite 带 `userData.baseOpacity`）；`TIME_PRESETS` 三档；`applyTime` 对模型数组的驱动。

- [ ] **Step 1: 云海**

```js
function buildClouds(low) {
  var c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  var ctx = c.getContext("2d");
  for (var i = 0; i < 16; i++) {
    var x = 60 + Math.random() * 392;
    var y = 70 + Math.random() * 116;
    var r = 50 + Math.random() * 80;
    var grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(235,242,246,0.34)");
    grad.addColorStop(1, "rgba(235,242,246,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);
  }
  var tex = new THREE.CanvasTexture(c);
  var rand = mulberry32(7712);
  var count = low ? 10 : 20;
  for (var k = 0; k < count; k++) {
    var mat = new THREE.SpriteMaterial({
      map: tex, color: 0xdfe9ef, transparent: true, opacity: 0,
      depthWrite: false
    });
    mat.userData.baseOpacity = 0.28 + rand() * 0.18;
    var sprite = new THREE.Sprite(mat);
    var x = rand() * 2400 - 1200;
    var z = 100 + rand() * 2400;
    var y = -95 + rand() * 45;
    sprite.position.set(x, y, z);
    var s = 320 + rand() * 480;
    sprite.scale.set(s, s * 0.34, 1);
    root.add(sprite);
    cloudMats.push(mat);
  }
}
```

- [ ] **Step 2: 三档时段数值**

把 `baiyun-main.js` 的 `TIME_PRESETS` 改为：

```js
var TIME_PRESETS = {
  dawn: {
    label: "云海晨曦", next: "day",
    exposure: 1.02,
    fog: 0x9fb0c2, fogDensity: 0.00026,
    top: 0x2c4a68, horizon: 0xe8c6a4, glow: 0xffb877, sunPower: 1.1,
    sunColor: 0xffd6a4, sunIntensity: 1.4, sunPos: [420, 60, 300],
    hemiSky: 0x8fa8c8, hemiGround: 0x2a2c24, hemiIntensity: 0.38,
    ambient: 0.22, fill: 0.12,
    city: 0.35, stars: 0.18, moon: 0.1, sunSprite: 0.8,
    sunDir: [0.8, 0.1, 0.5], cloud: 0.55, platform: 0.35
  },
  day: {
    label: "晴日", next: "night",
    exposure: 1.0,
    fog: 0xc8d3d8, fogDensity: 0.00018,
    top: 0x3a7cab, horizon: 0xdfe9ee, glow: 0xfff2cf, sunPower: 1.0,
    sunColor: 0xfff2d8, sunIntensity: 3.0, sunPos: [180, 160, 220],
    hemiSky: 0xb7d0e0, hemiGround: 0x3d3830, hemiIntensity: 0.46,
    ambient: 0.3, fill: 0.18,
    city: 0, stars: 0, moon: 0, sunSprite: 0.85,
    sunDir: [0.35, 0.75, 0.4], cloud: 0, platform: 0
  },
  night: {
    label: "夜览", next: "dawn",
    exposure: 1.08,
    fog: 0x0a1420, fogDensity: 0.00032,
    top: 0x02060e, horizon: 0x132433, glow: 0x6f5a45, sunPower: 0.4,
    sunColor: 0x9db8ff, sunIntensity: 0.2, sunPos: [-260, 200, -120],
    hemiSky: 0x22344a, hemiGround: 0x0e0e0b, hemiIntensity: 0.14,
    ambient: 0.06, fill: 0.04,
    city: 1, stars: 1, moon: 0.85, sunSprite: 0,
    sunDir: [-0.5, 0.55, -0.3], cloud: 0.12, platform: 1
  }
};
```

`applyTime` 已按 Task 2 的 baiyun 分支处理 `city/cloud/platform`；补充 `moon.intensity = name === "night" ? 0.32 : 0;`（sacred 已有）。`timeBtn` 的 `next` 循环由现有事件处理。

- [ ] **Step 3: 云层与城市的联动**

检查 Task 2 的 `applyTime` 分支已经驱动：
```js
(baiyun.cityWinMats || []).forEach(function (m) { m.emissiveIntensity = (p.city || 0) * 1.4; });
if (baiyun.riverMat) baiyun.riverMat.emissiveIntensity = (p.city || 0) * 0.55;
```
预期：dawn 城市灯火 0.35、day 0、night 1；云层 dawn 0.55、day 0、night 0.12。云层在 dawn 遮住城市下半部、塔尖露出；day 无云；night 只有薄云。

- [ ] **Step 4: 验证三档**

在 `.preview/cdp-baiyun-views.js` 的循环后加：
```js
for (const t of ['dawn', 'day', 'night']) {
  await evalv(`BaiyunDebug.timeOfDay('${t}')`);
  await new Promise(r => setTimeout(r, 1200));
  const s = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync('.preview/baiyun-' + t + '.png', Buffer.from(s.data, 'base64'));
  console.log(t.toUpperCase(), JSON.stringify(await evalv(`({ fps: BaiyunDebug.fps, time: BaiyunDebug.time, counts: BaiyunDebug.counts, btn: document.getElementById('timeBtn').textContent })`)));
}
```
Run: `node .preview/cdp-baiyun-views.js`
Expected: 三张图有明显差异；`timeBtn` 分别显示 `云海晨曦`、`晴日`、`夜览`；`fps ≥ 55`；`ERRORS 0`。目视：晨曦云层低于山顶、城市半掩；晴日城市清晰；夜览城市与珠江有灯带。

- [ ] **Step 5: 记录检查点**

保存三张截图，更新任务状态。

---

### Task 7: 运镜、热点文案、4K、移动端

**Files:**
- Modify: `canton-atlas/web/immersive/baiyun-main.js`
- Modify: `canton-atlas/web/immersive/baiyun.html`（about 文案）
- Test: `.preview/cdp-baiyun-views.js`、`.preview/cdp-baiyun-mobile.js`

**Interfaces:**
- Consumes: 所有模型热点、三档时段、7 个视点。
- Produces: 完整 CINE（6–7 段）、7 视点、6 热点、4K 导出、`BaiyunDebug` 最终 API、移动端布局。

- [ ] **Step 1: 完整 CINE**

把 Task 2 的 4 段占位替换为 7 段（时长合计约 30 s）：

```js
var CINE = [
  { dur: 5.0, chapter: "01 / 白云山 · 摩星岭", pos: [180, 90, 300], target: [0, -10, 0], toPos: [90, 34, 190], toTarget: [0, -20, 40] },
  { dur: 4.5, chapter: "02 / 门岗 · 吉星石", pos: [90, 34, 190], target: [0, -20, 40], toPos: [24, 2, 140], toTarget: [0, -22, 112] },
  { dur: 4.5, chapter: "03 / 石级 · 锦绣南天", pos: [24, 2, 140], target: [0, -22, 112], toPos: [0, -8, -14], toTarget: [0, -10, -44] },
  { dur: 4.5, chapter: "04 / 栈道 · 两段扶梯", pos: [0, -8, -14], target: [0, -10, -44], toPos: [-44, -14, 0], toTarget: [-18, -8, -52] },
  { dur: 4.5, chapter: "05 / 山顶平台 · 382 米", pos: [-44, -14, 0], target: [-18, -8, -52], toPos: [0, 4, -66], toTarget: [0, 2, -96] },
  { dur: 4.5, chapter: "06 / 山顶观景亭", pos: [0, 4, -66], target: [0, 2, -96], toPos: [-10, 4, -78], toTarget: [0, 4, -95] },
  { dur: 6.0, chapter: "07 / 南望 · 城市与珠江", pos: [-10, 4, -78], target: [0, 4, -95], toPos: [0, 7, -80], toTarget: [0, -120, 1600] }
];
```

- [ ] **Step 2: 热点内容定稿**

在 `baiyun-model.js` 的 hotspots 中补全 6 条：`jixing`、`paifang`、`escalator`、`peak`、`locks`，再补一条 `city`：

```js
{
  id: "city", craft: "city", no: "06", name: "城市中轴 · 珠江",
  pos: new THREE.Vector3(0, 3.2, PLATFORM_Z + 6.6),
  view: { pos: [0, 7, PLATFORM_Z + 10], target: [0, -120, 1600] },
  lede: "从摩星岭向南，珠江与广州塔、东西塔、中信一起出现在山脚；晴天能望到珠江三角洲平原。",
  facts: [["方向", "南望"], ["地标", "广州塔 · 东西塔"], ["水面", "珠江"]],
  detail: "城市与珠江为示意压缩：高度按公开地标数据，水平距离缩短并加雾，不作为测绘或导航依据。"
}
```

`openInfo` 使用 `hotspot.craft` 作为按钮 `data-craft`，沿用 sacred 的 DOM 结构；无需改 main.js 的热点 DOM 逻辑。

- [ ] **Step 3: 关于面板与声明**

在 `baiyun.html` 的 about 面板写入：
- 尺度：382 m、21.8 km²、吉星石 6×4 m、平台约 188 ㎡（游记口径）。
- 路径：150 m 栈道 + 60 m 扶梯、抬升 26 m；牌坊位置按公开游记放在石级中段；山顶亭统一称“山顶观景亭”。
- 取舍：索道不进山顶（终点山顶广场）、城市/珠江水平压缩、纹理程序化；不是测绘级。
- 资料：Task 1 的 4–6 个来源链接。

页脚 scale-note 保持 Task 2 的文案；intro 的说明也保留“示意复原”。

- [ ] **Step 4: 4K 与移动端**

4K 沿用 sacred-main 的 `exportShot` 实现（`renderer.setSize(3840, 2160)` + `canvas.toBlob` + 下载）。移动端在 `baiyun.css` 末尾补：
```css
@media (max-width: 820px) {
  .stamp-strip { display: none; }
  .view-rail { overflow-x: auto; flex-wrap: nowrap; justify-content: flex-start; }
  .view-rail button { flex: 0 0 auto; }
}
```
`sacred.css` 已有移动端规则；只补 view-rail 横向滚动与 stamp-strip 隐藏，避免 7 个视点挤压。

创建 `.preview/cdp-baiyun-mobile.js`，复制 `.preview/cdp-mobile-sacred.js`，改 URL 为 `baiyun.html?view=platform&embed=1`，检查：
- `innerWidth=390`、`scrollWidth <= 391`、`BaiyunDebug.fps ≥ 30`、`intro hidden`、`ERRORS 0`。
- 截图 `.preview/baiyun-mobile-platform.png`。

- [ ] **Step 5: 全量视点验收**

扩展 `.preview/cdp-baiyun-views.js`：循环 7 个视点，记录 `chapter/fps/counts/hotspots` 并截图；打开 `[data-craft="peak"]` 热点，检查 `infoCard.open`、标题为“摩星岭 · 382 米”，关闭；点击 `shotBtn`，用 URL.createObjectURL 钩子读取 blob PNG 头，确认为 `3840x2160`；检查 `ERRORS 0`。

Run: `node .preview/cdp-baiyun-views.js`
Expected: 7 个视点 60fps；每个视点截图；热点面板正确；4K blob 3840×2160；`ERRORS 0`。

- [ ] **Step 6: 记录检查点**

保存截图与输出，更新任务状态。

---

### Task 8: 图鉴/城市接入与最终验收

**Files:**
- Modify: `canton-atlas/web/app.js`
- Modify: `canton-atlas/web/immersive/main.js`
- Test: `.preview/cdp-baiyun-integration.js`；回归 `.preview/cdp-atlas-sacred.js`

**Interfaces:**
- Consumes: `baiyun.html` 的 embed/`from=atlas|city`、城市 POC 的 baiyun spot。
- Produces: `openBaiyunDetail()`、`canton-open-baiyun` 消息；城市 detailBtn 的 baiyun 分支；深链 `?immersive=1&spot=baiyun`。

- [ ] **Step 1: 图鉴按钮与路由**

在 `canton-atlas/web/app.js`：

1. 按钮文案（约 447 行）：
```js
(p.id === "chenjiaci" || p.id === "sacred-heart" || p.id === "baiyun" ? "3D 近景" : "3D 看这里")
```
2. `openImmersive` 的 URL 分支：
```js
var url = placeId === "chenjiaci"
  ? "immersive/chen.html?embed=1&from=atlas"
  : placeId === "sacred-heart"
  ? "immersive/sacred.html?embed=1&from=atlas"
  : placeId === "baiyun"
  ? "immersive/baiyun.html?embed=1&from=atlas"
  : "immersive/index.html?embed=1";
if (target && placeId !== "chenjiaci" && placeId !== "sacred-heart" && placeId !== "baiyun") {
  url += "&spot=" + encodeURIComponent(target) + "&jump=1";
}
```
3. 新增：
```js
function openBaiyunDetail() {
  var url = "immersive/baiyun.html?embed=1&from=city";
  immersiveLoading.hidden = false;
  immersiveFrame.onload = function () { immersiveLoading.hidden = true; };
  immersiveFrame.src = url;
  immersiveOverlay.hidden = false;
  document.body.classList.add("lock");
}
```
4. 消息分支：
```js
} else if (data.type === "canton-open-baiyun") {
  openBaiyunDetail();
} else if (data.type === "canton-open-city") {
```

- [ ] **Step 2: 城市 POC 的 baiyun 详情节**

在 `canton-atlas/web/immersive/main.js`：

1. `openSpot`（约 2442 行）：
```js
if (ui.detailBtn) ui.detailBtn.hidden = spot.id !== "chenjiaci" && spot.id !== "sacredheart" && spot.id !== "baiyun";
```
2. detailBtn 点击（约 2665 行）：
```js
ui.detailBtn.addEventListener("click", function () {
  var isSacred = activeSpot && activeSpot.id === "sacredheart";
  var isBaiyun = activeSpot && activeSpot.id === "baiyun";
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: isBaiyun ? "canton-open-baiyun" : isSacred ? "canton-open-sacred" : "canton-open-chen" }, "*");
  } else {
    window.location.href = isBaiyun ? "baiyun.html?view=gate" : isSacred ? "sacred.html?view=street" : "chen.html?view=gate";
  }
});
```

城市 POC 的白云山 spot 数据与模型不改；列表计数仍动态为 11。

- [ ] **Step 3: 集成验收脚本**

创建 `.preview/cdp-baiyun-integration.js`（复制 `.preview/cdp-integration-sacred.js`，替换 sacred 为 baiyun）：

1. `?immersive=1&spot=baiyun` → 检查 `immersiveFrame.src === "immersive/baiyun.html?embed=1&from=atlas"`、intro hidden、`BaiyunDebug.fps ≥ 60`、cityBtn visible。
2. 点击近景页 `cityBtn` → 检查 `immersive/index.html?embed=1&spot=baiyun&jump=1`、spot card open、detailBtn 可见。
3. 点击城市 detailBtn → 检查 `immersive/baiyun.html?embed=1&from=city`、60fps。
4. 关闭 overlay → `about:blank`、body 解锁。
5. 图鉴详情 `#place=baiyun` → 3D 按钮文案为“3D 近景”，点击后进入 baiyun 近景。
6. `ERRORS 0`。

Run: `node .preview/cdp-baiyun-integration.js`
Expected: 六项全部通过，0 报错。

- [ ] **Step 4: 回归 chen/sacred**

Run: `node .preview/cdp-atlas-sacred.js`（chen 路径）
Run: `.preview` 内既有的 sacred 验收脚本或重新执行 `node .preview/cdp-sacred-views.js`
Expected: chen 图鉴嵌入与城市互跳正常；sacred 7 视点 60fps；0 报错。

- [ ] **Step 5: 最终数字与截图**

记录：7 视点 fps/calls/triangles、3 时段截图、热点面板、4K blob 尺寸、移动端 390×844、图鉴/城市互跳、chen/sacred 回归。截图保存在 `.preview/baiyun-*.png`、`.preview/atlas-baiyun-*.png`。

- [ ] **Step 6: 更新事实与记忆**

如果 Task 1 的事实有更新，同步到 `docs/superpowers/research/2026-10-30-baiyun-facts.md` 与页面 about 文案；把“11 个地标 + 三个近景（陈家祠、石室、摩星岭）”的当前状态更新到项目记忆。

- [ ] **Step 7: 最终检查点**

所有任务 checkbox 勾选；报告里只写已验证的数字，4K 区分“blob 生成”和“文件落盘”。

---

## Self-Review

- **Spec coverage:** 1:1 登顶段（Task 3/4）、城市与珠江（Task 5）、云海与三档（Task 6）、交互/7 视点/4K/移动端（Task 7）、图鉴/城市接入（Task 8）、事实与来源（Task 1）、页面骨架/地形（Task 2）。无遗漏。
- **Placeholder scan:** 无 TBD/TODO；研究任务用“待复核”但每条都有默认决策与来源要求。
- **Type consistency:** `BaiyunTextures.build`、`BaiyunTextures.makeTextTexture`、`BaiyunModel.build`、`cityWinMats`、`riverMat`、`cloudMats[].userData.baseOpacity`、`platformLights`、`pathLights`、`landmarkMats`、`BaiyunDebug` 在各任务中命名一致。
- **Workspace note:** 不是 git 仓库，故没有 commit 步骤；每个任务以截图/报错数/计数作为验收证据。
