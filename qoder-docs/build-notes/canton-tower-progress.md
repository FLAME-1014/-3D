# 广州塔近景 · 建造进度（2026-10-31）

目录：`C:\Users\Administrator\Documents\Qoder\2026-10-31\canton-tower-build`
只改：`canton-atlas/web/immersive/canton-tower.*`、`.preview/`。未改 `app.js` / `immersive/main.js` / `index.html` 等共享文件，未发布、未合并、未新建项目副本。

## 范围（已拍板，未改）

- 塔身精度优先：底部 80×60 m、腰部约 30 m、顶部 54×40.5 m；24 直斜柱 + 46 组环梁（47 条环线）+ 1104 斜撑；塔身网格 draw calls ≤ 4。
- 塔基/南岸/海心桥 1:1；北岸 CBD 在 800 m 外压至 0.6×，6 个地标 + 实例化块 + 雾，页面/About 标注压缩。
- 外观 + 7 视点：base、lattice、deck、crown、river、axis、night；deck/crown 标注「示意视点，非步行可达」；axis 为 450 m 平台固定视点；night 强制夜景；不做电梯/内部/餐厅/乘坐动画。

## 阶段状态（全部完成）

- [x] 阶段 1：页面骨架 + CSS + 13 种程序化纹理 + 天空/江面 + 主循环 + Debug 骨架
- [x] 阶段 2：24/46/1104 塔身网格 + 塔基裙摆/玻璃大厅/核心筒
- [x] 阶段 3：450 m 平台 + 16 舱摩天轮 + 488 平台 + 455–485 速降 + 465→600 桅杆（铜色上段 + 航空色顶）
- [x] 阶段 4：二层平台 + 滨水大台阶 + 南广场/映塔水池 + 树阵/灯柱
- [x] 阶段 5：珠江（南北陆地留江） + 海心桥（488/198/15） + 海心沙 + 花城中轴 + 压缩 CBD + 城市地面/窗光
- [x] 阶段 6：7 视点 + 42 s 运镜 + 7 热点 + 三时段 + 4K + About/深链
- [x] 阶段 7：桌面 21 组合 + 4K 验收
- [x] 阶段 8：移动 390×844 + UI/交互自测 + 收尾

## 最终数字（CDP 9338，1440×900 / 390×844）

### 塔身网格（CantonTowerDebug.lattice）

| 项 | 值 |
|---|---:|
| 直斜柱 | 24 |
| 环梁组 | 46（环线 47 = 46 + 顶部端环） |
| 斜撑 | 1104（46 环间 × 24） |
| 塔身网格 draw calls | 4（柱/环/斜撑/节点） |
| 塔身网格 triangles | 36,288 |
| 腰部测量 | 27.3 m @ y=278（公开口径约 30 m；落在计划的 26–36 m 容差内） |

### 桌面 7 视点 × 3 时段（21 组合）

- FPS：20/21 组合 60；`night-night` 一次采样 56（另一次 59），随后连续 4 次复测 60/60/60/60 → 判定为双 Chrome（北京路 CDP 9339）抢 GPU 的瞬时波动；最终单 Chrome 复测留给主会话。
- 切换瞬态：最低 60（另一次 59）。
- draw calls：最大 80（预算 ≤150）。
- triangles：最大 63,890（预算 ≤150k）。
- textures：16（预算 ≤20）。
- console errors：0；overflowX：false。
- 21 组合均可切换，`counts/lattice` 全程稳定。

### 移动端 390×844（DPR 上限 1.35）

- FPS：7 视点全部 60。
- 渲染 DPR：1.35；canvas 526×1139（CSS 390×844）。
- draw calls：最大 74（预算 ≤100）。
- triangles：最大 35,070（预算 ≤90k）。
- textures：16；console errors：0；overflowX：false。
- 视点栏 7 个按钮可横向滚动 / 全部可达；热点在移动端为 44px 命中区 + 编号圆点。
- 截图：`.preview/canton-tower-mobile-{base,lattice,deck,crown,river,axis,night}.png`

### 4K

- `CantonTowerDebug.shot4K({download:false})`：3840×2160，约 2,779,720 bytes（PNG blob）。
- 真实落盘（CDP 下载目录）：`.preview/downloads/canton-tower-4k.png`，3840×2160，2,780,673 bytes。
- 渲染后 canvas 恢复 1440×900、DPR 1.0，0 报错。

### 开场运镜 / 交互 / 深链

- 42 s 运镜：2.2/8/16/26/36/44 s 采样 60fps、0 报错；结束进入 `night` 视点的自由模式。
- 7 热点在 DOM；热点卡可开/关；About 可开/关；时段按钮循环 day→dusk→night→day；`night` 视点内时段按钮被阻止并提示。
- 深链：
  - `?embed=1&view=night` → night / 夜景
  - `?embed=1&view=axis` → axis / 黄昏
  - `?embed=1` → base / 晴日
  - `?view=crown`（非 embed）→ crown / 黄昏，intro 自动跳过
  - 0 报错，无横向溢出。
- 城市全景按钮：`#cityBtn` 在 iframe 内发 `postMessage({type:"canton-open-city", spot:"tower"})`；顶层回退 `index.html?spot=tower&jump=1`。父页联调由主会话做（未改共享文件）。

## 与 spec 坐标的偏差（有原因，已记录）

1. **axis**：spec `(0, 452, -20)` → 实际 `(0, 452, -40)`。spec 点落在塔身包络内（452 m 处 z 范围约 ±26.8 m），射线在 2.6 m 处命中钢构，且位于摩天轮轨迹内；外移到平台外沿之外，保持 450 m 固定视点与北望目标。
2. **night**：spec `(-380, 14, -260)` → 实际 `(-470, 3, -105)`（桥头示意视点）。spec 点距海心桥面中心 20 m，已在 15 m 宽桥面之外，且原目标看不到桥体；改到桥头可看到桥面/灯带、塔与城市。章节文案同步为「桥头示意视点」。
3. **river**：保留 spec `(-300, 2, -70)`；该点在内陆一侧，固定画面看不到江面（珠江在其身后）。江面/倒影在开场运镜、高空自由视角与 `canton-tower-water-night.png` 中可见；如主会话要求 river 固定帧必须带江面，可再调机位。
4. 腰部几何 27.3 m（公开口径约 30 m），在计划容差内；页面写「约 30 m」并注明视觉近似。
5. 海心桥主拱按 198 m、全长 488 m、宽 15 m、桥面 12–14 m 建；此前临时草稿的 234 m 拱跨已修正。
6. 花瓣/球舱、玻璃带、摩天轮、速降与夜景均为低模/程序化示意；夜景色板 A/B/C 缓慢循环，不逐灯、不做默认激光。

## 残差 / 未完成

- **未做**：图鉴 `app.js` 与城市 POC `immersive/main.js` 的接入（Task 8，主会话批准后执行）；未发布/未合并。
- **未做**：城市按钮的父页消息联调（代码已就位，父页未改）；iframe 集成测试留给主会话。
- 视觉残差：城市块为通用体量、重复感较强；水纹为程序化条带；水池为纯色/高金属度，无真实镜面反射；夜景塔身竖向渐变偏淡（ACES + 雾）；热点在桌面某些视点会纵向堆叠。
- 性能：一次 56/59 的采样由双 Chrome 抢 GPU 引起，已复测 60；最终单 Chrome 复测由主会话执行。
- 4K 测试脚本会下载到 `.preview/downloads/`；主会话如不需要可删除该目录。

## 文件

- `C:\Users\Administrator\Documents\Qoder\2026-10-31\canton-tower-build\canton-atlas\web\immersive\canton-tower.html`
- `...\canton-atlas\web\immersive\canton-tower.css`
- `...\canton-atlas\web\immersive\canton-tower-textures.js`
- `...\canton-atlas\web\immersive\canton-tower-model.js`
- `...\canton-atlas\web\immersive\canton-tower-main.js`
- 测试：`.preview\cdp-canton-tower-views.js`、`-mobile.js`、`-4k.js`、`-intro.js`、`-deeplink.js`、`cdp-scene-check.js`、`cdp-eval.js`
- JSON：`.preview\canton-tower-views.json`、`canton-tower-mobile.json`、`canton-tower-intro.json`、`canton-tower-deeplink.json`
- 截图：`.preview\canton-tower-{base-day,base-night,lattice-day,deck-day,crown-dusk,river-day,river-dusk,river-night,axis-day,axis-dusk,night-day,night-dusk,night-night}.png`；`.preview\canton-tower-about.png`；`.preview\canton-tower-hotspot.png`；`.preview\canton-tower-water-night.png`；移动端 7 张；4K：`.preview\downloads\canton-tower-4k.png`
- 4K 字节：**2,780,673 bytes**（3840×2160）

## 测试环境

- 静态服务：`PORT=4184 node .preview/atlas-server.mjs`（root `canton-atlas/web`）
- Chrome CDP 9338，专属 profile `.preview/chrome-profile-canton-tower`
- 桌面 1440×900；移动 390×844 DPR 上限 1.35；4K 3840×2160
- 并行会话：北京路建造使用 CDP 9339，双 Chrome 可能抢 GPU（已注明）
