# 架构规则

修改前先读本文件、生产工艺和视觉交互规则；实际完成情况以 `docs/acceptance-plan.md` 和过程记录为准。规则描述目标，不代表所有条目已验收。

## 技术与职责

- Vite + React 19 + TypeScript；原生 Three.js，不使用 React Three Fiber。
- React 负责按钮、下拉、说明、图表和信息卡等 DOM。Three.js 负责场景、摄像机、拾取、材质和特效。
- Zustand 只保存界面状态：当前车间、选择工位、面板、屋架、画质和选中对象标识等。禁止保存 Object3D、Renderer、Material、Geometry 等 Three.js 对象。
- 当前页面仅有一个 WebGLRenderer、一个 requestAnimationFrame 调度入口、一个生产时钟；两个车间不同时创建。
- `?shop=stamping` 进入冲压，`?shop=welding` 进入焊装，无参数显示园区。切换前先销毁旧场景，再创建新场景。

## 目录约定

| 目录 | 职责 |
| --- | --- |
| `src/app` | React 界面、界面状态、DOM 图表 |
| `src/core` | 生产时钟、冲压纯计算、可独立测试的数学逻辑 |
| `src/scene` | 冲压场景、公共渲染管理 |
| `src/welding` | 焊装节拍、关节轨迹、场景 |
| `src/prefabs` | 厂房、设备、机器人、车身、标牌、火花等参数化模型 |
| `src/park` | 园区总览 |
| `specs` | 长期约束；变更时同步更新 |
| `docs` | 验收、资产来源、性能和过程证据 |
| `scripts` | 自动测试、固定机位截图和离线采集工具 |

## 确定性时钟

所有生产状态与姿态由 `pose = f(time)` 得到。滑块高度、关节角度、滑橇位置、零件形态、火花年龄都由同一个时刻求值，禁止逐帧累加生产位移或把上帧姿态作为下一帧输入。相同时间、相同配置必须得到相同状态；随机效果使用稳定编号和种子。

支持暂停、播放、任意秒 seek，以及 0.25 / 0.5 / 1 / 2 / 4 / 8 / 16 倍速。实时调度的 dt 先检验有限值，再限制在 `[0, 0.1]` 秒；seek 的目标时间不受此上限影响。暂停且画面无变化时不继续绘制；相机、面板、选中状态或画质变化要触发刷新。

## 渲染与生命周期

生产时间统一限制在 0–1,000,000,000 秒，有限超范围 seek 裁剪到边界，NaN / Infinity seek 保持原时间；播放到上限后饱和。纯计算状态函数采用相同范围；录制参数超范围直接拒绝，避免编号失去整数精度或循环无法前进。

背景为 `#d9dfe2`。使用 MeshStandardMaterial / MeshPhysicalMaterial，RoomEnvironment + PMREM 环境贴图，ACES 或 PBR Neutral 色调映射。后处理顺序为 EffectComposer → 高阈值 Bloom → SMAA → OutputPass。Bloom 输入须避免负亮度、无穷值和 NaN。

切换和卸载时回收几何体、材质、纹理、PMREM、后处理目标、控制器、事件监听和调度资源。共享资源采用显式引用或资源清单，避免重复释放与遗漏释放。Canvas 纹理生成要检查 `document` 是否存在，在 Node 测试环境提供回退。

## 自动化调试接口

`window.__workshop` 提供 `station(id)`、`seek(seconds)`、`speed(multiplier)`、`play()`、`camera([x,y,z], [tx,ty,tz])`、`explode()`、`quality(level)`、`debug()`。具体支持的工位和画质值由 `debug()` 或界面给出。接口须使用同一时钟与场景，不另建渲染器。测试应覆盖非法输入处理、seek 重放一致性和资源切换。
