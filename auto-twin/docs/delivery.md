# 汽车工厂数字孪生交付

项目位于工作区的auto-twin目录。已实现园区总览、冲压和焊装两个可进入车间，单时钟生产演示、工位导航、KPI与工艺看板、设备拾取、单机拆解、部件说明和三档画质。涂装、总装保持标明“规划中”的占位。

## 当前验收证据

- 园区14项专项检查及最终浏览器21项检查通过，同一时刻PNG重放1600000像素差异为0。
- 74项Vitest逻辑/模型/资源测试；工具回归覆盖采集参数、媒体内容和真实备份复制。最终命令与运行结果保存在verification/stage-10-validation.json。
- 七个真实前台场景测量有效。园区、冲压和焊装全景约60 FPS，精细焊接近景约32 FPS；最高细节机器人最多3台。完整焊装节拍从0推进到76.0119秒。详见[性能说明](performance-verification.md)。
- 三段MP4均为1600 × 1000、60 fps、H.264/yuv420p，全部解码通过，帧数、时长和blackdetect验证通过；[录像汇总](verification/stage-09-summary.json)保留SHA-256及逐帧时钟证据。

| 录像 | 输出 | 内容 |
|---|---|---|
| [焊接近景](captures/stage-09-welding-contact/capture.mp4) | 2秒 / 120帧 | 33.8–35.783秒主拼焊窗、精细画质 |
| [冲压节拍](captures/stage-09-stamping-cycle-v3/capture.mp4) | 4秒 / 240帧 | OP10从0–3.983秒的完整4秒节拍采样 |
| [焊装流程](captures/stage-09-welding-process-v2/capture.mp4) | 5秒 / 300帧 | 16倍生产时间，覆盖0–79.733秒；用于流程说明 |

帧采集逐张检查DOM时间、加载状态和恰好一次渲染，亮度检查抽样首、中、尾三帧。MP4做完整解码和黑屏检查。流程录像的16倍生产时间不作为实时性能证据；实时性能使用独立前台测量报告。

## 启动与恢复

需要Node.js 22.18+，本次使用24.21.0。运行npm ci后npm run dev，访问http://127.0.0.1:4200；冲压和焊装可使用?shop=stamping、?shop=welding直达。生产构建由npm run build生成至dist，部署dist需独立静态服务器。本次交付为本地项目和可恢复快照，远程发布另行执行。

验收可用node scripts/with-server.mjs scripts/verify.mjs --strict-images自动启动服务；前台性能用scripts/performance.mjs。录像需要Chrome和FFmpeg，可通过录制说明中的imageio-ffmpeg固定版本恢复项目工具目录。依赖、工具和采集命令见[README](../README.md)及[录制说明](recording.md)。

工作区工厂备份目录按阶段保存源代码、锁文件、构建、规范、截图、原始逐帧PNG和MP4，排除node_modules、.npm-cache、.tools。每个正式目录的backup-manifest.json保存文件数、字节数和关键文件SHA-256；它是备份完成的依据。一次第7步复制失败保留为.incomplete审计目录，不能视为正式阶段。不会覆盖已有备份。

## 已知范围和未测字段

模型与数据采用程序化简化演示路线，未接PLC/MES及真实生产数据。模型用于演示，不用于施工、夹具设计、机器人离线编程或安全计量；外部官方CAD/SimReady没有作为本项目资产。四档LOD的代表三角面与精度边界见[lod-verification.md](lod-verification.md)及[资产说明](asset-sources.md)。

GPU执行时间、精确显存、其他显卡和移动设备持续帧率未测；CPU提交耗时和资源对象数量分别记录。精细近景在当前集成显卡约32 FPS，最终JS总量约1.045 MB且有构建体积提示。当前实测、未测与规划功能在[过程记录](progress.md)中分别标明。
