# 寺庙 · 可交互立体模型

这是具有完整前后侧面与实体厚度的三维场景，模型可以旋转、缩放和继续编辑。
整体为原创中式寺庙微缩设计，包含重檐主殿、山门、钟鼓亭、围墙、庭院、石阶、香炉、石灯、盆景与挤出的中文匾额。

## 交付文件

- `temple-diorama.glb`：可直接导入 Blender、Three.js 或其他支持 glTF 2.0 的工具，材质和法线贴图均内嵌。
- `temple-diorama.blend`：可编辑源文件，保留分部件网格、PBR 材质、摄影灯光与正交相机。
- `temple-diorama-1080.png`：由实际三维场景渲染的 1080×1080 预览图。
- `index.html`、`style.css`、`viewer.js`：交互预览页面。
- `model-info.json`、`asset-verification.json`：模型结构与独立资产检查记录。
- `textures/`：三张程序生成的细微表面法线贴图；GLB 已内嵌，Blender 源文件也已打包。

模型约 9.35 MiB，包含 138 个网格、261,068 个三角面、20 种 PBR 材质。
GLB 为 Y 轴向上，正面朝 +Z；Blender 源文件为 Z 轴向上。
整体尺寸约为 12.6 × 12.08 × 7.22 个设计单位，并非测绘数据。

## 交互预览

在工作区根目录运行：

```powershell
npm run dev
```

然后打开 `http://127.0.0.1:4188/temple-diorama/`。
不要通过 `file://` 直接打开 HTML；GLB 需要由本地静态服务加载。

页面使用已有 `../blender-workflow/vendor/` 中的 Three.js 0.179.1，无 CDN 请求。
若将预览页面移出本项目，需要同时复制这份库，并调整 HTML 的 import map。

- 拖拽旋转；滚轮或双指缩放。
- 45°复位、正面、背面和俯视预设。
- 自动旋转与线框查看。
- 画布聚焦后，方向键旋转，加减键缩放，`0` 恢复默认视角。
- “保存 1080 方图”将当前视角与加粗暖白标题导出为 PNG。

## 重新建模与检查

```powershell
& 'D:\blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/build_temple_diorama.py
node scripts/verify-temple-assets.mjs
```

构建脚本为工作区的 `scripts/build_temple_diorama.py`，通过参数化几何生成真实瓦垄、曲面屋顶、柱梁、门窗格栅和金属香炉。
预览的默认相机使用正交投影，方位角 45°，俯视角 45°；标题使用加粗、明亮的暖白字体。
静态检查覆盖 GLB 结构、有限顶点、有效索引、法线、三维范围、材质及贴图内嵌；检查无退化三角面。
