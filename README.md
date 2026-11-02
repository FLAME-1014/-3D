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

- canton-atlas/web：唯一开发源码。
- qoder-docs：历史考据、设计与交接。
- docs：当前接手记录。
- .local/amap.development.json：开发凭据（不进入 Git）。
- .local/amap.production.json：从旧 dist 保存的生产凭据备份（不进入 Git，未验证当前可用性）。
- canton-atlas/dist：历史部署产物，不进入 Git；本轮未修改。

本地预览按原 URL 动态生成 poi-config.js；源码中的同名文件默认关闭高德，不含真实凭据。直接使用其他静态服务器打开源码时，高德会关闭，避免误发布开发 Key。

不要分享 .local 文件，不要将开发 Key 写回源码或复制到 dist。前端开发配置仍会被本机浏览器读取；这不是生产级密钥保护。

## 发布边界

没有自动发布脚本，本地修改不会更新 Qoder 公网。后续发布前先确定托管平台、生产白名单和安全代理。不能直接全量覆盖旧 dist：源码默认禁用高德，生产配置应单独生成并验证。模型/API密钥需保存在后端；Qoder站点权限仍需另外确认。

## Git

根目录为本地 Git 仓库，不连接任何远程。检查改动用 git status / git diff。基线仅覆盖源码、开发工具和文档；旧图片及验收附件保留原地但未纳入基线。
