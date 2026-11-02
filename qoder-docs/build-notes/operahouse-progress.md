# 广州大剧院近景 · 建造进度

会话产物目录：`canton-atlas/web/immersive/operahouse.*`；测试服务端口 4186，CDP 9340。
只改本工作副本；不发布、不合并、不改共享文件。

## 阶段 1 · 页面骨架 / 渲染器 / 纹理 / Debug

- [x] operahouse.html（HUD、7 视点栏、intro、about、stamp-strip、页脚口径）
- [x] operahouse.css（由 canton-tower.css 派生，改深灰石/暖白/琥珀变量）
- [x] operahouse-textures.js（程序化纹理，无外部贴图）
- [x] operahouse-model.js 骨架（天空/地面/水池/城市占位 + shell 骨架）
- [x] operahouse-main.js 骨架（antialias:false / preserveDrawingBuffer:false / Debug）
- [ ] 冒烟验收（1440×900、intro 跳过、counts、console 0、无横向溢出）

## 阶段 2 · 双砾折面壳 + 5 m 平台

- [ ] 大砾石 43.1 m / 外壳最大长度约 120 m / 约 85 m 宽
- [ ] 小砾石约 28 m / 约 65×45 m（估算）
- [ ] 最近约 3 m（顶点采样 measureGap）
- [ ] 非几何折面、无直角、flatShading；三角板缝纹理
- [ ] 5 m 入口平台、缓坡、栏板/狭缝

## 阶段 3 · 玻璃口部 / 斜网格 / 浅层 lobby

- [ ] 大砾石南/东南三角玻璃口部（凹入石折檐下）
- [ ] 3D 斜网格（InstancedMesh）
- [ ] 玻璃口部后浅层 lobby 剪影（不做剖面/内部）
- [ ] 小砾石低长玻璃带；西侧石背狭长玻璃缝

## 阶段 4 · 广场 / 水池 / 草坡 / 树 / 光带

- [ ] 倒影池（主池 + 东支池，尺寸为估算）
- [ ] 草坡（东侧山丘 + 西侧草坡）
- [ ] 平台/草坡“水纹”光带（夜间暖白，非 RGB）
- [ ] 树阵/高草/灯柱/坐凳/签名墙

## 阶段 5 · 城市与文化轴

- [ ] 省博/图书馆体量
- [ ] IFC/CBD 低模 + 窗光
- [ ] 珠江/海心沙/广州塔剪影
- [ ] 300 m 外距离压缩 + 雾；页面标注

## 阶段 6 · 交互

- [ ] 7 视点（plaza/mouth/pool/west/small/axis/night）
- [ ] 开场运镜（可跳过、embed 跳过、reduced-motion）
- [ ] 7 热点 + 遮挡 + 键盘
- [ ] 三时段 day/dusk/night；night 强制夜景
- [ ] 4K（3840×2160，preserve=false 下非空白）
- [ ] 拖拽/缩放/双击复位；about/sources；城市全景 postMessage

## 阶段 7 · 验收

- [ ] 桌面 1440×900：7×3 组合、calls/tris/textures/lights、fps
- [ ] 手机 390×844 DPR≤1.35：7 视点、无横向溢出、0 console error
- [ ] 4K 尺寸/字节/方差记录
- [ ] 截图归档 `.preview/operahouse-*.png`
- [ ] 关闭 Chrome(9340) 与服务

## 残差 / 待办

- 待填。
