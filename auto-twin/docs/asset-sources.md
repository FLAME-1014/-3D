# 模型、纹理与依赖来源

## 当前选择

本项目采用**自编程序化简化模型**，这是原需求明确允许的替代路线。机器人由底座、转台、臂杆、手腕及工具几何体组成；车身用钢板截面、地板、立柱、顶框、门洞等组合；厂房、压机、滑橇、辊床、料架、护栏、AGV、升降台和园区由参数化函数生成。

未下载、转换或使用 NVIDIA SimReady USD、Comau N-220-27 资产包或 `sm_carFrame_car_frame_assembled_a01`。Comau N-220 的型号名称仅用作尺寸和运动比例参考，不表示使用官方 CAD、通过厂家认证或具备官方精度。项目不附加或虚构 NVIDIA、Comau 资产许可证。

## 版本和来源清单

| 内容 | 来源与版本 | 说明 |
| --- | --- | --- |
| 机器人、车身、设备、厂房、园区 | 本项目源代码，模型版本 `procedural-v1` | 确切源路径、字节数和 SHA-256 见 assets-manifest.json |
| 地坪与拉丝纹理 | 本项目程序生成，纹理版本 `procedural-v1` | 没有外部图片下载；无 document 时应有回退 |
| 图表 | DOM / CSS / SVG 与项目代码 | 自编演示图表 |
| Lucide React 图标 | 0.468.0，ISC | 软件图标库，不是设备模型资产 |
| React / React DOM | 19.3.1 / 19.3.1，MIT | 解析版本核对自 package-lock.json |
| Three.js | 0.186.1，MIT | 原生 Three.js 与 examples/jsm；软件依赖不等于模型资产 |
| Zustand | 5.1.0，MIT | 界面状态软件依赖 |
| Vite / React 插件 | 7.3.8 / 5.2.0，MIT | 构建软件依赖 |
| TypeScript | 5.9.3，Apache-2.0 | 类型检查软件依赖 |
| Vitest | 5.1.0，MIT | 自动测试软件依赖 |
| Playwright | 1.65.0，Apache-2.0 | 浏览器验证和确定性录制软件依赖 |
| React / React DOM 类型声明 | 19.3.0 / 19.3.0，MIT | TypeScript 开发依赖 |
| Three.js 类型声明 | 0.183.1，MIT | 类型版本独立于运行时 Three.js 0.186.1 |
| 浏览器截图与采集脚本 | 本项目 scripts/，最终运行环境见过程记录 | 用于验证，不提供设备模型 |

模型源由 `scripts/assets.mjs` 实际扫描并写入 [assets-manifest.json](assets-manifest.json)。扫描范围是 `src/prefabs/**/*.ts`（排除测试）、`src/scene/stamping.ts`、`src/welding/scene.ts`、`src/park/**/*.ts`，以及生产时钟、冲压/焊装纯逻辑和 `lod*.ts` 策略。当前生成时不存在的园区或独立 LOD 源组会在 `scan.optionalGroups` 明确记录；后续新增后重跑清单。清单只记录实际文件，不预填不存在的模型或虚构校验值。

| 源模块 | 内容 |
| --- | --- |
| `src/prefabs/factory.ts` | 地坪、厂房、屋架、预制几何、实例和静态合并 |
| `src/prefabs/materials.ts` | 程序化地坪、拉丝纹理和物理材质；Node DataTexture 回退 |
| `src/prefabs/robot.ts` | 自编六轴机器人与工具 |
| `src/prefabs/carBody.ts` | 分阶段组合的示意白车身 |
| `src/prefabs/sparks.ts` | 程序化粒子与点焊效果 |
| `src/scene/stamping.ts`、`src/welding/scene.ts` | 各车间参数化设备和场景 |
| `src/core/clock.ts`、`src/core/production.ts`、`src/welding/logic.ts` | 确定性生产时间、身份和工艺状态 |
| `src/core/lod.ts` | LOD 选择、细节预算和回收策略源；实施与实测结论另见阶段记录 |
| `src/park/*.ts` | 园区源，以后续清单扫描结果为准 |

上述依赖版本在 2026-11-12 从锁文件核对；安装或升级后以新的锁文件为准并同步本表。许可证字段同样来自锁文件；完整许可文本以实际软件包 LICENSE 为准。

## 校验和变更

构建锁定依赖后运行 `npm run assets`（也可直接 `node scripts/assets.mjs`），生成 package.json、package-lock.json 和当前程序化源文件的 SHA-256。清单包含每个源的稳定 ID、`procedural-v1` 版本、来源类别、字节数、生成时间和全部直接依赖的锁定版本/许可字段。运行 `npm run assets -- --check` 可检查清单是否仍与当前文件一致，不修改清单。

修改模型或依赖后更新模型版本（发生版本变更时同步脚本常量）并重跑清单；源代码继续变化时先前清单只对应之前的文件快照。最终交付和各阶段备份前都应重跑。校验值只证明对应文件内容一致，不证明来源许可或工艺精度。当前几何和纹理在运行时生成，没有 USD 包、GLB 转换产物或外部纹理图；因此清单校验生成源，不虚构不存在的二进制资产。

后续若采用外部 USD / GLB，应新增单独资产条目，保留原始下载包及许可证，记录来源 URL、资产版本、下载日期、转换软件版本、坐标/单位/关节整理、meshopt 压缩设置与导出文件 SHA-256。没有验证完来源和转换前，不更改当前自编来源说明。

## 模型精度边界

模型面向可视化和工艺教学，不能用作工厂施工尺寸、机器人离线编程、碰撞安全验证、夹具设计或车身计量。程序化最高细节档也没有 SimReady 的真实碰撞体、物理参数、制造曲面或原始 USD 元数据。工艺时间、数据和偏差是演示设置，需结合验收记录判断实现程度。

四档 LOD、轮廓一致性、距离回差、最高细节最多 3 台及真实前台性能是验收目标。源文件存在和 SHA-256 不证明它们已经实现或实测；manifest 中的 LOD 面数、驻留数量和运行证据默认为空，实际数据必须来自 engine debug 与阶段记录。本项目最高细节档指自编程序化原精度，不能称为官方 SimReady 原精度。
