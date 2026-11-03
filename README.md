# Canton Atlas 开发工作区

当前项目是待继续开发的原型。历史验收记录不代表产品或模型质量已完成。

## 启动与检查

需要 Node.js 18+；无第三方依赖，不需要 npm install。

```powershell
npm run dev
npm run check
npm test
```

默认访问 http://127.0.0.1:4188/ 。Ctrl+C 停止服务。端口冲突时不要结束未知进程，可指定新端口：

```powershell
$env:PORT = '4189'
npm run dev
```

## 源码与凭据

- canton-atlas/web：运行时源码（图鉴、3D 场景、模型页模板）。
- canton-atlas/content：模型册内容（每个景点的数据卡与模型模块）。
- qoder-docs：历史考据、设计与交接。
- docs：当前接手记录与建模规范。
- .local/amap.development.json：开发凭据（不进入 Git）。
- .local/amap.production.json：从旧 dist 保存的生产凭据备份（不进入 Git，未验证当前可用性）。
- canton-atlas/dist：历史部署产物，不进入 Git；本轮未修改。

本地预览按原 URL 动态生成 poi-config.js；源码中的同名文件默认关闭高德，不含真实凭据。直接使用其他静态服务器打开源码时，高德会关闭，避免误发布开发 Key。预览服务同时以 `/content/` 暴露 `canton-atlas/content`，供模型页读取数据卡与模型模块；如果 4188 端口还是旧进程，需要重启 `npm run dev` 才会生效。

## 模型册样板

- 规范：`docs/景点建模规范.md`
- 验收工作记录：`docs/验收工作记录-2026-11-02.md`
- 试点记录：`docs/陈家祠样板记录.md` / `docs/永庆坊样板记录.md` / `docs/沙面样板记录.md` / `docs/北京路样板记录.md` / `docs/越秀公园样板记录.md` / `docs/荔枝湾样板记录.md` / `docs/上下九样板记录.md` / `docs/粤剧艺术博物馆样板记录.md` / `docs/光孝寺样板记录.md` / `docs/六榕寺样板记录.md` / `docs/中山纪念堂样板记录.md`

已接入：

| 景点 | 级别 | 入口 | 记录 |
|---|---|---|---|
| 陈家祠 | A | `/spot.html?id=chenjiaci` | `docs/陈家祠样板记录.md` |
| 永庆坊 · 恩宁路 | B（通过） | `/spot.html?id=yongqingfang` | `docs/永庆坊样板记录.md` |
| 沙面 · 沙面岛 | B（通过） | `/spot.html?id=shamian` | `docs/沙面样板记录.md` |
| 北京路 · 千年古道 | B（通过） | `/spot.html?id=beijinglu` | `docs/北京路样板记录.md` |
| 越秀公园 · 五羊石像 | B（通过） | `/spot.html?id=yuexiu-park` | `docs/越秀公园样板记录.md` |
| 荔枝湾 · 西关水岸 | B（通过） | `/spot.html?id=lizhiwan` | `docs/荔枝湾样板记录.md` |
| 上下九 · 骑楼街 | B（通过） | `/spot.html?id=shangxiajiu` | `docs/上下九样板记录.md` |
| 粤剧艺术博物馆 · 广福台 | B（通过） | `/spot.html?id=opera-museum` | `docs/粤剧艺术博物馆样板记录.md` |
| 光孝寺 · 岭南第一古刹 | B（通过） | `/spot.html?id=guangxiao` | `docs/光孝寺样板记录.md` |
| 六榕寺 · 六榕花塔 | B（通过） | `/spot.html?id=six-banyan` | `docs/六榕寺样板记录.md` |
| 中山纪念堂 · 蓝顶会堂 | B（通过） | `/spot.html?id=memorial-hall` | `docs/中山纪念堂样板记录.md` |

机位参数：`&preset=overview|front|detail|courtyard|alley|street|gate|stage|avenue|church|hotel|park|ancient-road|temple|wuyang|wall|zhenhai|canal|bridge|tower|house|opera|qilou|taotao|lianxiang`

数据卡与模型：

- `canton-atlas/content/spots/chenjiaci/`
- `canton-atlas/content/spots/yongqingfang/`
- `canton-atlas/content/spots/shamian/`
- `canton-atlas/content/spots/beijinglu/`
- `canton-atlas/content/spots/yuexiu-park/`
- `canton-atlas/content/spots/lizhiwan/`
- `canton-atlas/content/spots/shangxiajiu/`
- `canton-atlas/content/spots/opera-museum/`
- `canton-atlas/content/spots/guangxiao/`
- `canton-atlas/content/spots/six-banyan/`
- `canton-atlas/content/spots/memorial-hall/`
- 模板：`canton-atlas/content/spots/_template/spot.json`
- 预览截图：各自 `refs/preview/`

验收工具：

- 陈家祠正立面剪影：`canton-atlas/content/spots/chenjiaci/refs/overlay/model-front-silhouette.png`
- 单殿剪影/叠图：`front-hall-silhouette.png` / `overlay-front-hall.png`
- 轮廓叠图工具：http://127.0.0.1:4188/silhouette.html
- 识别测试包：`chenjiaci/refs/recognition/`（A 级）、`yongqingfang/refs/recognition/`（B 级 lite）、`shamian/refs/recognition/`（B 级 lite）、`beijinglu/refs/recognition/`（B 级 lite）、`yuexiu-park/refs/recognition/`（B 级 lite）、`lizhiwan/refs/recognition/`（B 级 lite）、`shangxiajiu/refs/recognition/`（B 级 lite）、`opera-museum/refs/recognition/`（B 级 lite）、`guangxiao/refs/recognition/`（B 级 lite）、`six-banyan/refs/recognition/`（B 级 lite）、`memorial-hall/refs/recognition/`（B 级 lite）



不要分享 .local 文件，不要将开发 Key 写回源码或复制到 dist。前端开发配置仍会被本机浏览器读取；这不是生产级密钥保护。

## 发布边界

没有自动发布脚本，本地修改不会更新 Qoder 公网。后续发布前先确定托管平台、生产白名单和安全代理。不能直接全量覆盖旧 dist：源码默认禁用高德，生产配置应单独生成并验证。模型/API密钥需保存在后端；Qoder站点权限仍需另外确认。

## Git

根目录为 Git 仓库，已配置 `origin` 远程；本地提交不会自动推送。检查改动用 `git status` / `git diff`。旧图片及验收附件保留原地但未纳入版本控制；模型预览图按景点内容包管理。
