# Eiffel Tower — Landmark Atelier

可旋转、缩放的埃菲尔铁塔三维建筑展台。完整实体桁架包含四座基础、四条外扩塔腿、四面双拱、两层主体平台、顶部观景台、升降轨道和天线。三维模型、依赖与页面均位于本地，无 CDN、外部字体或模型服务请求。

## 预览

已接入相邻Blender角色作品集的第六张项目卡，入口为 `../portrait-portfolio/#work`；铁塔页顶部提供返回作品集链接。GitHub Pages统一上传 `canton-atlas/web`，页面和已生成的GLB/Blender资产随仓库发布，无需在部署时运行Blender。

在仓库根目录运行：

```powershell
npm run dev:eiffel
```

打开 **http://127.0.0.1:4194/eiffel-tower/**。专用启动命令也将 `/` 转向铁塔；已有普通预览服务可访问 `http://127.0.0.1:4188/eiffel-tower/`。端口冲突时可设置 `$env:PORT = '4195'` 后重试。

## 操作

- 拖拽旋转，滚轮或双指缩放，右键拖拽平移；工具栏提供放大、缩小和自动旋转。
- Perspective、Elevation、From above、The lattice 提供完整透视感、正立面、俯视和桁架细节机位。
- 点击楼层或画面标记，聚焦 57 m、115 m、276 m 观景区域；关闭说明恢复整体视角。
- 月亮按钮切换昼夜灯光；网格按钮显示线框。
- Watch it take shape 显示六章搭建过程；播放、暂停、重置与进度滑块控制真实结构的逐层显现。这是建筑装配示意，不表示历史施工工序或日期。
- 相机按钮保存 1600 × 1600 PNG，保留当前视角、显示方式和昼夜光照。
- 画布聚焦后，方向键旋转，`+` / `−` 缩放，`R` / `0` 复位，`N` 切换夜景，`W` 切换线框，搭建模式下空格播放或暂停，`Esc` 关闭楼层说明。

交互静止后停止持续绘制；后台标签页暂停动画。系统启用减少动态效果时机位立即切换。WebGL 不可用时保留资产下载入口。

## 文件与尺寸

| 文件 | 用途 |
| --- | --- |
| `index.html` / `style.css` / `viewer.js` | 响应式展台、交互、灯光、镜头及图片导出 |
| `model.js` | 程序化模型与六个结构组，实例化重复桁架 |
| `eiffel-tower.glb` | glTF 2.0，嵌入几何和 PBR 材质，可导入 Blender、Three.js 等工具 |
| `eiffel-tower.blend` | 可编辑模型，保留六个结构集合及摄影机、灯光 |
| `eiffel-tower-preview.png` | 实际三维场景导出的 1600 × 1600 预览图 |
| `model-info.json` / `asset-verification.json` | 模型参数、构建来源哈希、资产验证结果 |

模型共有 **27 个网格批次、7 种材质、5,046 个实例、66,024 个三角面**。GLB 约 **3.22 MiB**，Blender 源文件约 **1.31 MiB**。标称高度 330 m；基础略低于地面。GLB 为 Y 轴向上，Blender 为 Z 轴向上。

模型依据铁塔的典型外形和大致尺寸程序化制作，细节为建筑可视化简化，未经过实测校准。展示底座只存在于预览页面，下载资产包含铁塔本身。页面中的 1889 指铁塔开放年份，330 m 指包括现代天线的标称总高度。

## 重建与验证

本机已安装 Blender，默认路径为 `D:/blender.exe`；可通过 `EIFFEL_BLENDER` 指定其他可执行文件。

```powershell
npm run build:eiffel
npm run test:eiffel
npm run check
```

构建先将生产 `model.js` 的几何、实例矩阵及材质导出，再用 Blender 生成对应 GLB 和源文件。两个下载文件与生产模型共用同一份几何来源。

`scripts/verify-eiffel-assets.mjs` 检查 GLB 头、内嵌缓冲、所有顶点和法线、索引范围、三维包围盒、轮廓收分、结构组、源模型哈希及 Blender 保存后重新读取的结果。

`scripts/verify-eiffel-viewer.mjs` 使用已有 Playwright 和本机 Chrome，检查 WebGL、实际相机变化、楼层说明、昼夜、线框、分层显现与播放、下载和 PNG，并验证 390 px 手机视口无横向溢出。报告和截图写入 `output/eiffel-tower/`。模拟手机视口用于检查布局，不代替实际手机的 GPU 性能验证。

Three.js 及 OrbitControls 引用相邻 `../blender-workflow/vendor/` 的本地 MIT 依赖。移动页面时需保留或复制这部分库并相应更新 import map。通过 HTTP 访问页面，浏览器不支持直接用 `file://` 运行这些 ES modules。

## 2026-11-16 整合验证

资产验证17项通过，铁塔浏览器9项检查通过，作品集13项回归通过；桌面/手机在模拟GitHub仓库子路径下完成作品集→铁塔→作品集与GLB/Blender下载验证。整合脚本：scripts/verify-eiffel-portfolio.mjs。
