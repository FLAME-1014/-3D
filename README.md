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
- 试点记录：`docs/陈家祠样板记录.md` / `docs/永庆坊样板记录.md`

已接入：

| 景点 | 级别 | 入口 | 记录 |
|---|---|---|---|
| 陈家祠 | A | `/spot.html?id=chenjiaci` | `docs/陈家祠样板记录.md` |
| 永庆坊 · 恩宁路 | B（通过） | `/spot.html?id=yongqingfang` | `docs/永庆坊样板记录.md` |
| 沙面 · 沙面岛 | B（待 lite） | `/spot.html?id=shamian` | `docs/沙面样板记录.md` |

机位参数：`&preset=overview|front|detail|courtyard|alley|street|gate|stage`

数据卡与模型：

- `canton-atlas/content/spots/chenjiaci/`
- `canton-atlas/content/spots/yongqingfang/`
- `canton-atlas/content/spots/shamian/`
- 模板：`canton-atlas/content/spots/_template/spot.json`
- 预览截图：各自 `refs/preview/`

验收工具：

- 陈家祠正立面剪影：`canton-atlas/content/spots/chenjiaci/refs/overlay/model-front-silhouette.png`
- 单殿剪影/叠图：`front-hall-silhouette.png` / `overlay-front-hall.png`
- 轮廓叠图工具：http://127.0.0.1:4188/silhouette.html
- 识别测试包：`chenjiaci/refs/recognition/`（A 级）、`yongqingfang/refs/recognition/`（B 级 lite）



不要分享 .local 文件，不要将开发 Key 写回源码或复制到 dist。前端开发配置仍会被本机浏览器读取；这不是生产级密钥保护。

## 发布边界

没有自动发布脚本，本地修改不会更新 Qoder 公网。后续发布前先确定托管平台、生产白名单和安全代理。不能直接全量覆盖旧 dist：源码默认禁用高德，生产配置应单独生成并验证。模型/API密钥需保存在后端；Qoder站点权限仍需另外确认。

## Git

根目录为 Git 仓库；GitHub 远程地址在首次推送后补充。检查改动用 git status / git diff。基线覆盖源码、开发工具、文档和模型预览截图；`.local` 凭据、`dist`、历史验收附件、`refs/overlay` 参考图保留本地，不进入 Git（见 `.gitignore`）。
