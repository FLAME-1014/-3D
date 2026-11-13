# 汽车工厂数字孪生

明亮现代工厂的浏览器工艺演示：园区总览、冲压车间和焊装车间。React 负责界面，原生 Three.js 负责 3D；生产动作由同一时钟计算，支持暂停、跳时和倍速。模型采用自编程序化简化路线，所有产量与质量数据都是演示数据。

## 本地打开

使用 Node.js 22.18+（本次验证为24.21.0），在此目录按锁文件安装依赖后运行：

```powershell
npm ci
npm run dev
```

浏览器打开 [园区 http://localhost:4200](http://localhost:4200)，或直接打开 [冲压车间](http://localhost:4200/?shop=stamping)、[焊装车间](http://localhost:4200/?shop=welding)。

```powershell
npm run build
npm run test
npm run verify:tools
npm run capture
```

`build` 检查类型并生成生产包，`test` 执行项目自动测试，`capture` 运行固定机位浏览器截图脚本。截图所需浏览器和启动服务要求以脚本输出为准；捕获静态 PNG 不等于已经输出 FFmpeg 视频。精确依赖版本见 package-lock.json。

## 怎么操作

在园区点击冲压或焊装厂房进入；工位菜单切换观察位置。鼠标左键旋转，Shift + 左键平移，滚轮缩放。使用播放控制暂停、seek 到指定秒和调节倍速；右上可切换屋架、工艺说明、看板和画质。悬停查看设备和稳定零件编号，点击设备观察单机，拆解后查看部件说明，再返回全线。

浏览器控制台可用 `window.__workshop` 的 `station()`、`seek()`、`speed()`、`play()`、`camera()`、`explode()`、`quality()` 和 `debug()`；具体支持的值及已实现能力以界面和调试输出为准。

## 验收与录像

项目已接入Blender角色作品集，统一静态入口为 `../portrait-portfolio/`，作品卡链接至 `/auto-twin/`。仓库根目录运行 `node scripts/build-workshop-site.mjs` 生成站点产物；Pages工作流会自动完成该步骤。在整合站点中车间顶部提供返回作品集入口。

本次完成情况见 [开发记录](docs/progress.md)、[前台性能记录](docs/performance-verification.md) 和 [交付说明](docs/delivery.md)。园区专项和两个车间的完整浏览器回归均有实际报告；录像见 [焊接近景](docs/captures/stage-09-welding-contact/capture.mp4)、[冲压4秒节拍](docs/captures/stage-09-stamping-cycle-v3/capture.mp4) 和 [焊装完整节拍流程](docs/captures/stage-09-welding-process-v2/capture.mp4)。最后一段为16倍生产时间的5秒录像，不能作为实时帧率证据。

已启动开发服务时可运行 `npm run verify:park`、`npm run verify`、`npm run verify:performance`。也可使用 `node scripts/with-server.mjs scripts/verify.mjs --strict-images`，自动启动服务、验收后关闭本次启动的服务。录像采集命令与FFmpeg准备方法见 [录制说明](docs/recording.md)。`npm run backup -- 8 --check` 只检查备份路径；去掉 `--check` 会创建不覆盖旧目录、附SHA-256清单的阶段快照。

## 维护与限制

后续改动先读 [架构规则](specs/architecture.md)、[生产工艺](specs/production-process.md)、[视觉交互](specs/visual-interaction.md) 和 [性能资产](specs/performance-assets.md)。来源与许可在 [资产说明](docs/asset-sources.md)，验收目标在 [分阶段计划](docs/acceptance-plan.md)；实际完成情况由过程记录和证据决定，不以清单存在作为完成。

本项目没有下载 NVIDIA SimReady 模型；机器人与车身是基于工业比例的程序化示意，不是官方 CAD、精密碰撞模型或机器人离线编程工具。它不能用于施工、夹具设计、安全验证或计量。涂装和总装是标明“规划中”的占位。真实设备性能、完整工艺接触与轨迹限制、LOD 细节及离线视频等条目须按验收记录确认，未验证项不得称为完成。
