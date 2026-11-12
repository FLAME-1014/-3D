# Blender → GLB → Three.js 演示

此目录是独立示例，不修改已有景点页。它展示 Blender Python API 自动建模、`.blend` 源文件保存、GLB 导出，以及 Three.js 的模型加载、OrbitControls 和点击信息卡。

## 一键建模与验证

环境：Windows PowerShell、Node.js 18+、Blender 5.2.1 LTS、项目原有 Playwright 开发依赖。当前 Blender 安装于 `D:\blender.exe`，Chrome 安装于标准路径。

在仓库根目录执行：

```powershell
.\scripts\run-seaside-workflow.ps1
```

安装路径不同可以指定：

```powershell
.\scripts\run-seaside-workflow.ps1 -BlenderPath 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
```

也支持 `BLENDER_PATH` 环境变量。脚本以后台模式启动独立 Blender 进程，不操作当前打开的 Blender 窗口。任何生成或验证失败都会返回非零退出码。每次生成会覆盖本示例的同名输出；如在 `.blend` 里手动精修，请先另存副本。

验证优先使用系统 Chrome，可用 `CHROME_PATH` 指定其他 Chromium 可执行文件；没有系统 Chrome 时使用 Playwright 安装的 Chromium（先运行 `npx playwright install chromium`）。若项目依赖尚未安装，先运行 `npm ci`。

## 单独生成模型

在仓库根目录运行：

```powershell
& 'D:\blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/build_seaside_blender.py
```

如 Blender 安装位置不同，替换可执行文件路径。脚本会生成：

- `canton-atlas/web/blender-workflow/seaside-hotel.blend`：可继续编辑的 Blender 工程
- `canton-atlas/web/blender-workflow/seaside-hotel.glb`：网页加载的 GLB
- `canton-atlas/web/blender-workflow/seaside-hotel.png`：Blender 渲染预览

## 运行网页

从仓库根目录启动现有预览服务：

```powershell
npm run dev
```

访问 `http://127.0.0.1:4188/blender-workflow/`。页面使用 Three.js 0.179.1、GLTFLoader 和 OrbitControls；所需模块已保存在 `vendor/`，保留原 MIT 许可，无 CDN 或在线字体请求，可离线浏览。原项目的旧版 Three.js 不受影响。

如默认端口已占用，使用 `$env:PORT = '4189'` 后启动；也可直接访问已经运行的预览服务。请通过 HTTP 服务器打开，不能双击 HTML 使用 `file://`。

鼠标左键拖动旋转，滚轮缩放，右键拖动平移，点击场景中的建筑会显示基础信息。

## 验证和输出

单独重跑网页验证：

```powershell
node scripts/verify-seaside-workflow.mjs
```

验证会自动启动并关闭一个随机端口的本地服务器，不依赖 4188 服务。检查 GLB 文件头、模型和材质数量、尺寸、面数、点击信息卡、旋转、缩放、平移、手机布局，以及控制台错误和失败请求；同时禁止外部网络请求，验证离线依赖完整。

```text
scripts/
  build_seaside_blender.py        自动建模、保存、渲染、导出
  run-seaside-workflow.ps1        Blender 定位 + 生成 + 浏览器验证
  verify-seaside-workflow.mjs     GLB 与真实浏览器验证
canton-atlas/web/blender-workflow/
  README.md                      工作流说明
  index.html                     独立演示页
  style.css                      页面样式
  viewer.js                      GLTFLoader、灯光、OrbitControls、Raycaster
  seaside-hotel.blend             可编辑 Blender 源文件（含相机与灯光）
  seaside-hotel.glb               网页用模型
  seaside-hotel.png               Blender 渲染图
  web-preview.png                 网页截图（打开建筑信息卡）
  web-mobile.png                  手机视口截图
  verification.json              自动验证报告
  vendor/                        Three.js 0.179.1 模块与 LICENSE
```

一个单位代表一米。建筑主体宽约 13 米、高约 6 米；含海面与地面的整个场景约 30 × 21.5 米。玻璃使用蓝绿色低粗糙度 PBR 材质作风格化表达，未制作室内。对象按 Hotel / Lobby / Facade / Atrium / Landscape / Palm 等命名；建筑对象通过 GLB extras 携带 `building` 标记，用于区分建筑点击和地面、植物点击。

GLB 仅导出网格及材质，灯光与相机保留于 `.blend`，网页自行设置灯光与相机。Blender 的 Z 向上坐标由 glTF 导出器转换为 Three.js 的 Y 向上坐标。

当前生成结果：93 个独立网格、9 种材质、1,524 个三角面、168,616 字节 GLB。具体本轮检测结果见 `verification.json`。这是一套示范工作流，建筑为原创概念模型，未对应现实中的测绘建筑。
