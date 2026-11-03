# 北京路 · 千年古道 1:1 近景 — 第一版验收

- 日期：2026-10-31
- 状态：第一版可玩；桌面 7 视点 × 3 时段、7 个热点、4K、考据面板、图鉴/城市 POC 接入、手机 390×844 均已实测；按约定停在这里，等反馈
- 工作区：`C:\Users\Administrator\Documents\Qoder\2026-10-31\beijinglu-build`
- 未发布、未合并、未 commit；未动 `dist` / `.qoder.site`
- 附件：`C:\Users\Administrator\Desktop\北京路近景_第一版验收_2026-10-31_附件`

## 怎么打开

- 本地服务：`http://127.0.0.1:4178`（root = `canton-atlas/web`；本次自动占用 4178）
- 重启：在 `beijinglu-build` 下执行 `node .preview/atlas-server.mjs`
- 近景直开：`http://127.0.0.1:4178/immersive/beijinglu.html`
- 深链视点：`?view=crossing|ancient|arcade|gongbei|huifu|dafo|chenghuang`
- 嵌入模式：`?embed=1`（跳过开场、显示「城市全景」）
- 图鉴：图鉴 → 北京路 → 详情「3D 看这里」→ `immersive/beijinglu.html?embed=1&from=atlas`
- 城市 POC：近景右上「城市全景 ↗」→ `immersive/index.html?embed=1&spot=beijinglu&jump=1`
- 验收截图与数据：桌面 `北京路近景_第一版验收_2026-10-31_附件`

## 这版做了什么

### 场景

- [x] 骨架：`beijinglu.html / beijinglu.css / beijinglu-textures.js / beijinglu-model.js / beijinglu-main.js`；地面、渐变天空、雾、7 个默认视点
- [x] 尺度：核心段约 440 m、街宽 16 m，1 场景单位 = 1 米；中山四路、财厅前连接段压缩示意
- [x] 千年古道：玻璃罩 44 × 3.8 m、11 层 / 5 期叠压、黑色矮柱与说明碑（示意）
- [x] 拱北楼：32 × 4.7 m 基址、5 层城楼、牌坊、铜壶滴漏 2.64 m、十二生肖铜首与水池（示意）
- [x] 骑楼界面：129 组简化骑楼体量、连续柱廊、店招、橱窗、灯笼；全场景 488 盏灯笼实例、37 棵树、96 根矮柱
- [x] 十字街/中山五路路口：斑马线、路牌、5 圆盘旱喷广场与城市背景
- [x] 大佛寺：山门、大雄宝殿、普觉楼（7F + 2B 体量、五重檐金顶）；夜间殿内与门洞暖光示意
- [x] 城隍庙：大殿、拜亭、忠佑广场；周边 6–10 层住宅/办公体量示意，不做大寺庙式中轴
- [x] 惠福东路：东端约 120 m 核心段、美食花街、两侧榕荫、外摆白桌凳与暖光；511 m 全长压缩
- [x] 背景街区、远景体块、路灯、行人/车辆低模体块（行人 120 个，移动端 54 个）

### 视点与运镜

- [x] 7 视点：十字街、千年古道、骑楼、拱北楼、惠福东、大佛寺、城隍庙；桌面/手机两套机位与 FOV
- [x] 7 段开场运镜；跳过开场后进入自由探索
- [x] 骑楼桌面机位由 z=148 前移至 z=150：避开画面左缘一根近景树撑，构图不变；手机机位 z=146 未改
- [x] 热点「带我去看」使用各热点独立机位（`hotspots[].view`），不再复用默认视点

### 热点与交互

- [x] 7 个热点：01 千年古道 · 11 层路面、02 北京路 · 骑楼界面、03 拱北楼 · 铜壶滴漏、04 大佛寺 · 大雄宝殿、05 普觉楼 · 金顶、06 惠福东路 · 美食花街、07 城隍庙 · 忠佑广场；每个 3 条事实
- [x] 热点徽标投影锚定、距离/可见性剔除；热点卡含 kicker、标题、导语、3 条事实、详述
- [x] 热点卡「带我去看 / 下一处 / 关闭」；下一处循环 01–07
- [x] 时段循环：晴日 / 黄昏 / 夜览；按钮 `aria-pressed`、toast、夜景点光与灯笼亮起
- [x] 考据面板：6 条来源链接、Esc 关闭、点遮罩关闭
- [x] 4K 截图：3840 × 2160 PNG；桌面端 toast 显示文件大小，导出后画布恢复原尺寸；手机端提示「4K 导出建议在桌面端使用」，不执行渲染
- [x] 重播运镜、7 视点横向栏、双击复位、拖动环绕、滚轮缩放
- [x] `prefers-reduced-motion` 降级：CSS 动画与运镜时长相应收敛
- [x] WebGL 不可用时的 fallback 文案

### 手机端

- [x] 390 × 844、DPR2；画布 624 × 1350（渲染像素比 1.6）；`low` 模型、无阴影、无抗锯齿
- [x] 7 视点横向栏可滚动、无横向溢出；热点可点
- [x] 热点卡 370 × 434，完整在视口内；考据面板 342 × 709，可滚动（内容高 997）
- [x] 横屏 844 × 390 无横向溢出；4K 与重播按钮在窄屏隐藏；导出逻辑仍拦截移动端（QA 程序化点击验证 toast，`toBlob` 0 次、画布不变）
- [x] 夜览惠福东稳态 57–60 fps

### 图鉴 / 城市 POC 接入

- [x] 图鉴北京路详情 → 「3D 看这里」→ `beijinglu.html?embed=1&from=atlas`；嵌入后 7 热点、城市按钮可见、开场隐藏
- [x] 近景「城市全景 ↗」→ 父层收到 `{type:"canton-open-city", spot:"beijinglu"}` → POC `immersive/index.html?embed=1&spot=beijinglu&jump=1`
- [x] 往返实测 0 报错；`app.js` 北京路路由见 `canton-atlas/web/app.js:520`、`:547`

## 本轮收尾修复

- [x] **热点聚焦导致相机 NaN**：`focusCraft()` 曾按对象读取热点的 `view.pos.x/.y/.z`，而热点视图是数组，导致相机 NaN、画面空白、4K 仅约 124 KB；改为 `h.view.pos.slice()` / `h.view.target.slice()`（`beijinglu-main.js:709`）。修复后「03 拱北楼」聚焦相机为 `[5.8, 2.8, 255]`，4K 恢复 4.8–6.5 MB
- [x] **行人头部实例错位**：头部 `InstancedMesh` 被循环写入自身 `position/rotation/scale`，且实例矩阵误用身体 dummy，导致 120 个头聚到惠福东一角、近景像「浮头/无头」；改用独立 `headDummy` 合成矩阵（`beijinglu-model.js:1124`、`:1158`），头部落点 y≈1.49 m。用品红头验证全部贴合，再恢复肤色重拍
- [x] **惠福东外摆桌凳发黑**：深色木纹 × 深色材质导致桌凳近黑；改为白石桌面 + 木腿/木脚 + 红/绿坐凳，与「美食花街」白桌体系一致（`beijinglu-model.js:1216` 附近），重拍日/夜
- [x] **骑楼桌面视点左缘黑条**：画面左下原有一根近景树撑，截图像杂散线；桌面骑楼机位 z 148→150 移出画面，手机不受影响
- [x] **全画质截图口径**：新增仅调试用的 `BeijingluDebug.lockQuality(true)`（`beijinglu-main.js:1048`），截图/4K 时锁定 full，避免自适应降质改变灯/人数量与阴影；无任何用户可见 UI 或交互变化
- [x] 上述改动后重跑交互、手机、图集接入与 4K 全量回归

## 验收指标

### 桌面 1440×900（无头 Chrome 156 / 本机 Windows 10）

- [x] 21 组（7 视点 × 3 时段）全画质锁定截图；0 console error；无横向溢出
- [x] 晴日：59–60 fps（7/7 视点，6 个 60、1 个 59）
- [x] 黄昏：35–57 fps；最低为骑楼 35
- [x] 夜览：43–58 fps；最低为古道 43
- [x] draw calls 41–83；triangles 221,174–251,874
- [x] 自适应降质：自由模式下 fps < 50 持续 3 s 会关闭阴影、灯笼 ×0.55、行人 ×0.5、像素比封顶，并提示「已自动降低画质以保持流畅」；降质后黄昏/夜览稳态约 42–60 fps，且只触发一次
- [x] 交互：时段循环 3 档标签/aria/toast 正确；7 个热点可点；卡片字段完整；下一处/聚焦/关闭正常；考据 6 链接、Esc 可关；4K 3840×2160、toast「4775 KB」、画布恢复 1440×900；重播运镜回到第 1 段；0 报错
- [x] 4K 原图：`4K_骑楼_晴日_3840x2160.png`，6,532,148 字节；PNG 头 3840 × 2160 校验通过；导出不含 DOM HUD

### 手机 390×844 DPR2（无头 Chrome 移动仿真）

- [x] 21 组均 ≥60 fps（黄昏路口一处采样 62，按 60 口径记录）；0 console error；无横向溢出
- [x] 画布 624 × 1350；`isMobile=true`、low 模型、阴影关闭；draw calls 42–82；triangles 177,784–206,386
- [x] 4K：提示「4K 导出建议在桌面端使用」，`toBlob` 调用 0 次，画布尺寸不变
- [x] 热点卡 370 × 434 在视口内；考据面板 342 × 709、可滚动；横屏 844 × 390 无溢出

### 图鉴 / 城市 POC

- [x] 详情「3D 看这里」可见，点击后 iframe src = `immersive/beijinglu.html?embed=1&from=atlas`
- [x] 嵌入页：`mode=free`、7 热点、城市按钮可见、开场隐藏
- [x] 点击城市按钮后父层 iframe src = `immersive/index.html?embed=1&spot=beijinglu&jump=1`
- [x] 全流程 0 console error

## 资料口径与限制

- 核心段 1:1；中山四路约 500 m 压缩为约 180 m 连接段，财厅前约 300 m 压缩为 60–90 m 背景，北京路南段只做渐隐背景；不做南越王博物院内部、大佛寺殿内、城隍庙 24 司与壁画
- 非测绘；骑楼店招、灯笼、LED 屏、灯光、十二生肖、金身均为示意，招牌不使用品牌 logo；夜景为照明示意，红灯笼为夜间/节庆示意
- 行人与车辆为静态低模体块，头部为球体，非真实人物；无人群动画
- 手机端为 low 模型；桌面黄昏/夜间全画质在无头 Chrome 下最低 35 fps，实机性能未验证，不应把 60 fps 当作全硬件承诺；自适应降质会兜底
- 4K 导出在低内存桌面端可能失败；移动端已禁用并提示
- 未做真实读屏软件与完整键盘遍历验收；仅实测 Esc 关闭考据；无音频
- 考据面板 6 条来源中 4 条为官网/政府站，惠福东路长度与城隍庙尺寸 2 条为百度百科辅助来源，未找到同口径官方页；完整来源 S1–S60、R1–R12 见研究文件 `docs/superpowers/research/2026-10-31-beijinglu-facts.md`
- 周边 POI/距离仍沿用图集示例数据，本页未接高德

## 文件

- 页面：`C:\Users\Administrator\Documents\Qoder\2026-10-31\beijinglu-build\canton-atlas\web\immersive\beijinglu.html`
- 样式：`...\immersive\beijinglu.css`
- 纹理：`...\immersive\beijinglu-textures.js`
- 模型与热点：`...\immersive\beijinglu-model.js`
- 主逻辑（视点/运镜/时段/热点/4K）：`...\immersive\beijinglu-main.js`
- 共享层：`...\canton-atlas\web\app.js`（北京路路由与城市回跳）
- 交付附件：`C:\Users\Administrator\Desktop\北京路近景_第一版验收_2026-10-31_附件`
  - 桌面 21 张：`桌面_{day|dusk|night}_{7 视点}.jpg`
  - 手机 21 张：`手机_{day|dusk|night}_{7 视点}.jpg`
  - 手机 UI 5 张：首屏、热点卡、考据、夜览惠福东、横屏
  - 接入 2 张：图鉴近景、城市全景
  - 4K 1 张：`4K_骑楼_晴日_3840x2160.png`
  - 无热点遮挡骑楼晴日 1 张
  - 数据：`final-desktop.json`、`final-mobile.json`、`interactions.log`、`mobile-qa.log`、`atlas-integration.log`、`fps-fresh-{day,dusk,night}.log`
- QA 脚本：`beijinglu-build\.preview\` 下 `cdp-sweep.js`、`cdp-fps-fresh.js`、`cdp-mobile-qa.js`、`cdp-interactions.js`、`cdp-atlas-integration.js`、`cdp-4k-save.js`、`cdp-people-annotate.js`
