# 固定机位截图、验证和离线视频

先启动 `npm run dev`，服务默认位于 `http://127.0.0.1:4200`。脚本使用 Playwright 和本机安装的 Chrome；首次运行需安装项目依赖。可用 `--chrome` 指定真实 Chrome 可执行文件。脚本不设置软件 GPU、虚构 GPU 或绕过 WebGL 的启动参数。

## 确定性帧采集

```powershell
npm run capture -- --shop welding --start 34 --duration 2 --fps 60
npm run capture -- --shop stamping --start 0 --duration 2 --fps 60 --video
```

默认采集焊装，从 34 秒开始，2 秒、60 fps、1600 × 1000、devicePixelRatio = 1；输出到带时间戳的 `docs/captures/` 子目录。`--shop park` 可采集园区。`--start` 为生产起始秒，`--duration`（或 `--seconds`）为视频时长，`--fps` 为采样率，`--speed` 为生产时间倍率，`--quality` 传给画质调试接口，`--output` 指定新的输出目录。已有目录不会被删除或覆盖。

`--station N` 为0起始工位序号；冲压OP10为3，焊装主拼为2。`--close` 配合工位选择设置焊接/压机近景。时间范围为0–1,000,000,000秒，视频宽高须为偶数，非法参数在建立输出目录和启动浏览器前拒绝。

脚本在导航之前用 `addInitScript` 覆写 `performance.now`、`Date.now`、`requestAnimationFrame` 和取消方法。RAF 回调进入单一虚拟队列，每次手动推进 1000 / fps 毫秒，执行当前队列快照；新申请的回调留到下一帧。默认每步为 1/60 秒，因此不依赖后台标签页的实时 RAF 调度。

页面初始化后调用 `pause()`，每一帧明确调用 `seek(start + frameIndex / fps × speed)`，等待React提交的 `main[data-production-time]` 与该时间一致，再推进一次虚拟 RAF，断言生产时间准确且恰好绘制一帧后截图。初始化检查车间、画质、标签和加载遮罩就绪。暂停后主动 seek 的方式使生产状态由指定时间求值，也避免实际截图耗时改变生产进度。生产时钟没有用录制墙钟驱动；React/浏览器网络和加载仍用真实事件循环。字体加载完成后开始采集，截图禁用 CSS 动画并隐藏输入光标。

输出包含 `frame-000000.png` 等帧、首尾 SHA-256、虚拟时钟计数、实际诊断及错误的 `manifest.json`。最后一帧的生产时间是 `start + (frameCount - 1) / fps × speed`，不是结束边界。初始化的零毫秒虚拟步仅用于初始绘制，不计入视频帧数。

`--video` 检查 FFmpeg，存在时用 PNG 序列合成 H.264 / yuv420p MP4；默认采样和输出都是 60 fps。明确请求视频但FFmpeg不可用时保留完整帧，manifest标记视频 `skipped`、整体 `failed` 并返回非零退出码。可用 `--ffmpeg` 指定可执行文件；编码失败会返回非零退出码并保留帧和错误记录。编码后使用同一FFmpeg完整解码，核对帧数、尺寸、fps、时长、编码和像素格式，并做blackdetect黑屏检查。首、中、尾三张PNG另外检查尺寸和亮度；每张PNG均检查DOM时间与单次绘制。仅截图模式不会产生视频。

本机通过 `imageio-ffmpeg==0.6.0` 在项目内 `.tools/python` 准备了FFmpeg 7.1。工具目录不进入Git与阶段备份，可重新安装或使用已有FFmpeg。PowerShell示例：

```powershell
python -m pip install --target .tools/python imageio-ffmpeg==0.6.0 --no-deps
node scripts/with-server.mjs scripts/capture.mjs --shop welding --start 33.8 --duration 2 --fps 60 --quality fine --station 2 --close --video --ffmpeg .tools/python/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe
```

本次实际生成：主拼焊接近景120帧/2秒、冲压OP10完整周期240帧/4秒、焊装流程300帧/5秒（16倍生产时间，覆盖0–79.733秒）。每段的命令、虚拟时钟、抽检帧、视频SHA-256和完整解码结果在相邻manifest中。原始逐帧PNG保留本地和阶段备份，Git仅保存MP4与manifest。

## 真实前台验证

```powershell
npm run verify
```

`verify.mjs` 用带界面的 Chrome、真实浏览器时钟和 1600 × 1000 视口检查三个 URL、调试方法、固定时刻姿态重放、暂停停绘制、界面按钮、原生 RAF 间隔采样和反复切换。输出截图及 `docs/verification/<时间戳>/report.json`；出错会返回非零退出码。性能采样前把页面置前台，记录浏览器版本、系统、实际 WebGL renderer/vendor、画质、视口、LOD（接口有提供时）、draw calls、三角形、geometry/texture 对象数量和帧时间。

原生 RAF 观察间隔含浏览器调度；调试接口 `frameMs` 是 CPU 提交渲染耗时，不能当 GPU 时间。测试期间有一个短时采样观察器，它不创建第二个生产时钟或渲染器。对象数量不是显存 MB；脚本不估算或虚构显存。若实际 WebGL renderer 是软件渲染器，报告会警示该结果不能证明物理 GPU 性能达标。无头截图不替代此项检查。

验证需要 `debug()` 暴露 `poses`、`pose` 或 `productionState` 等可序列化生产姿态，不能仅比较 time 便宣称所有动作可重放。截图重放另外保存 a/b 图和哈希；`--strict-images` 要求它们逐字节一致。默认不同哈希会要求人工查看，姿态对比仍是强制测试。

按钮使用稳定 `data-testid`，缺少选择器默认失败。`--allow-missing-controls` 仅用于分阶段开发，缺失项写为 `skipped`，整体报告最多 `partial`，不能当最终验收。切换时检查只有一个活跃 canvas、调试资源计数和相同场景的几何/纹理数量不持续增长；事件监听与外部缓存回收还需要源码/诊断审计。

脚本存在、语法正确或输出计划清单都不代表已经执行通过。阶段过程记录须附实际运行命令、输出目录、失败/跳过项和视频是否真正生成。
