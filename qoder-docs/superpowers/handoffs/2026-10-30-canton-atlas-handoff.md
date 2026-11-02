# Canton Atlas 交接 · 2026-10-30

> 2026-10-31 更新：广州大剧院、广东省博物馆已合入主工程并通过回归，近景累计 11 个；发布状态见「第三批（广州大剧院 + 广东省博物馆）」。

> 2026-10-31 早前：中山纪念堂、永庆坊、广州塔、北京路已完成并发布，当时 9 个近景。

> 给新会话用。先读本文件；需要细节时再读白云山的研究/规格/计划，它们是最新模板。

## 当前完成

- [x] 32 地点图鉴：`canton-atlas/web`
- [x] 11 个城市 3D POC 点位（广州塔、天际线、珠江、白云山、陈家祠、石室、沙面、永庆坊、北京路、琶醍、大剧院）
- [x] 11 个近景：陈家祠、石室圣心、白云山摩星岭、越秀公园（五羊—城墙—镇海楼）、沙面一期 C、中山纪念堂、永庆坊、广州塔、北京路、广州大剧院、广东省博物馆
- [x] 图鉴深链、embed、城市往返、postMessage 联动
- [x] 公网发布：https://canton-atlas-117yhjmxn8j.qoder.zone

## 入口

- 公网图鉴：https://canton-atlas-117yhjmxn8j.qoder.zone/
- 白云山深链：https://canton-atlas-117yhjmxn8j.qoder.zone/?immersive=1&spot=baiyun
- 越秀深链：https://canton-atlas-117yhjmxn8j.qoder.zone/?immersive=1&spot=yuexiu-park
- 镇海楼（同页 `view=tower`）：https://canton-atlas-117yhjmxn8j.qoder.zone/?immersive=1&spot=zhenhai
- 沙面深链：https://canton-atlas-117yhjmxn8j.qoder.zone/?immersive=1&spot=shamian
- 中山纪念堂深链：https://canton-atlas-117yhjmxn8j.qoder.zone/?immersive=1&spot=memorial-hall
- 永庆坊深链：https://canton-atlas-117yhjmxn8j.qoder.zone/?immersive=1&spot=yongqingfang
- 广州塔深链：https://canton-atlas-117yhjmxn8j.qoder.zone/?immersive=1&spot=canton-tower
- 北京路深链：https://canton-atlas-117yhjmxn8j.qoder.zone/?immersive=1&spot=beijinglu
- 广州大剧院深链：https://canton-atlas-117yhjmxn8j.qoder.zone/?immersive=1&spot=opera-house
- 广东省博物馆深链：https://canton-atlas-117yhjmxn8j.qoder.zone/?immersive=1&spot=gd-museum
- 本地：`node .preview/atlas-server.mjs` → http://127.0.0.1:4178/（root 为 `canton-atlas/web`）
- CDP：Chrome 以 `--remote-debugging-port=9333` 启动；测试脚本在 `.preview/cdp-*.js`，截图在 `.preview/*.png`
- 验收视口：桌面 1440×900；手机 390×844 DPR2

## 文件地图

- 图鉴：`web/index.html`、`styles.css`、`data.js`、`app.js`
- 近景模板（白云山）：`web/immersive/baiyun.html` / `.css` / `-textures.js` / `-model.js` / `-main.js`
- 新增近景：`memorial.*`（中山纪念堂，7 视点，Debug `MemorialDebug`）、`yongqingfang.*`（永庆坊，7 视点，Debug `YongqingfangDebug`）、`canton-tower.*`（广州塔，7 视点，Debug `CantonTowerDebug`）、`beijinglu.*`（北京路，7 视点，Debug `BeijingluDebug`）、`operahouse.*`（广州大剧院，7 视点，Debug `OperaHouseDebug`）、`gd-museum.*`（广东省博物馆，7 视点，Debug `GdMuseumDebug`）
- 城市 POC：`web/immersive/index.html`、`main.js`（`SPOT_DATA` 11 个点位）
- 发布输出：`dist/`，不要手改；`web` 验收通过后 `cp -a web/. dist/`
- 站点 descriptor：`canton-atlas/.广州城市图鉴 · CANTON ATLAS.qoder.site`（工具生成，勿手改）

## 接入一个近景要改哪里

- 图鉴卡片按钮文案：`web/app.js:447`（新增两个 id 后行号可能变化，搜 `data-immersive`）
- 图鉴打开逻辑：`openImmersive`（`web/app.js:528` 附近）；深链解析在 `web/app.js:1216` 附近
- 深链格式：`?immersive=1&spot=<atlas id>`；embed 参数 `?embed=1&from=atlas`
- 城市 POC（可选）：在 `SPOT_DATA` 增加点位；详情按钮可见性 `web/immersive/main.js:2442` 附近；点击分支 `web/immersive/main.js:2667` 附近；atlas 监听 `web/app.js:582` 附近
- 已有 postMessage 类型：`canton-open-baiyun`、`canton-open-shamian`、`canton-open-yongqingfang`、`canton-open-city`、`canton-open-sacred`、`canton-open-chen`、`canton-open-tower`、`canton-open-beijinglu`
- 近景页自身：intro 自动跳过（`embed=1`）、七视点、热点遮挡、三时段、4K、about/sources、移动端镜头拉远（`baiyun-main.js:460`）
- 互链：越秀页 `#memorialBtn` → `memorial.html?view=lawn`；纪念堂页「越秀顶层 ↗」→ `yuexiu.html?view=tower`
- 广州塔默认 `view=base`；北京路默认使用 `view=ancient`（图鉴与城市都直接落到古道）

## 并行建造与运行上限（2026-10-31 实测）

- 独立副本 + 独立端口 + 独立 Chrome profile 可以并行；这次用 4180/9334（越秀）和 4181/9335（沙面）。
- 长会话（研究+建造+收尾）会在 30–40 分钟 / 数百次工具调用后撞运行上限中断；失败时页面和文件通常已落盘，先检查产物，不要从零重写。
- 修复方式：新开“收尾会话”，只做前置清单、每项最多 2 次尝试，完成就停；最后由主会话统一验收、合并、发布。
- 多个 Chrome 窗口会抢 GPU，FPS 会假性降到 20–30；测速时只留一个测试窗口，其余导航到 `about:blank`。
- 共享文件只在主项目合并；隔离副本不要发布。

## 发布流程

1. 本地验收：桌面 + 手机截图、60fps、0 console error、无横向溢出；4K 为 3840×2160。
2. 同步发布目录：`cp -a web/. dist/`，确认 `diff -rq web dist` 为空。
3. Qoder Sites：`get_context` → `prepare_site`（`projectRoot` 为 `canton-atlas`，`webDirectory` 为 `dist`，带现有 `projectId`，每次新 `actionId`）→ `publish_site` → `get_publish_status` 确认 `published: true`。
4. 公网 `cache-control: no-cache`，同一地址更新；发布后实测 `/immersive/<name>.html` 为 200，并打开深链验证。
5. 公网当前已包含 sacred 与 baiyun，旧版缺页问题已修复。

## 事实与设计纪律

- 先写 `docs/superpowers/research/YYYY-MM-DD-<name>-facts.md`：确认事实、冲突、参考图观察、场景决策、来源链接。
- 不确定的写保守；游记口径要标注（如 188㎡）；未证实构件不加（如“摘斗亭”）。
- 1 unit = 1m；核心地面/平台 y=0；远景可压缩，但画面要标注“示意”。
- 视觉验收：先截图、看 console、测 FPS、手机视口，再交付；不夸大未验证项。
- 一次只做一个近景；先给方向与取舍，再写 spec/plan/实施。
- 规格、计划、研究分别放 `docs/superpowers/{specs,plans,research}/`。

## 2026-10-31 双场景交付数据

- 中山纪念堂：7 视点（门楼/草坪/铜像/南抱厦/八角蓝顶/北侧/东南角）、三时段、7 热点、4K。桌面 7×3 58–60fps（19/21 恰好 60），手机 7/7 60fps，4K 3840×2160。残差：东/西/北抱厦仍是素面，上层檐口偏暗，铜像为低模、无面部细节。
- 永庆坊：7 视点（门楼/主巷/广福台水岸/月亮桥/八和/骑楼/古树广场）、三时段、7 热点、4K。桌面 7 视点 60fps，21 组合切换瞬态最低 53fps、门楼/主巷黄昏稳态 59–60fps；手机 21/21 60fps、无溢出，DPR 1.6（为清晰度保留）。真实 4K PNG 3840×2160、3,266,197 字节。残差：水岸对岸与游船/舞台体量做了简化，夜景为照明示意，非实景照度。
- 发布后公网复测：图鉴深链 → 近景 → 城市 POC → 近景往返 60fps、0 报错；手机 390×844 两场景各 3 视点 60fps、无溢出。
- 回归观察：陈家祠仍为 3510 draw calls，本机 1440×900 约 44–46fps（与发布版本逐字节相同，非本次合并引入）；其余 6 个近景 60fps。

## 2026-10-31 第二批（广州塔 + 北京路）

- 广州塔：7 视点（base/lattice/deck/crown/river/axis/night），塔身 24 柱 × 46 环 × 1104 斜撑，合并为 4 draw calls、约 36.3k tris；桌面 80 calls / 63.9k tris / 16 textures，手机 74 calls / 35k tris、DPR 1.35。单 Chrome 扫视 20/21 为 60fps（night-day 一次 58），手机 3 视点 60fps，4K 3840×2160 / 2,780,673 bytes。`deck`/`crown` 是“示意视点，非步行可达”；`river` 为北岸江面回望（示意）；北岸 CBD 0.6× 压缩。
- 北京路：7 视点（crossing/ancient/arcade/gongbei/huifu/dafo/chenghuang），千年古道南北两段、大佛寺山门/大雄宝殿/普觉楼、城隍庙、惠福东。桌面 64–83 calls / 221k–252k tris；手机 59–60fps、DPR 1.6、无溢出。优化后单 Chrome 稳态：交叉街/大佛寺/惠福东 58–60，古道白天 57–60、黄昏 58–60、夜间 60；连续 21 组合扫视后受本机热降频影响会掉到 52–59。4K 3840×2160 / 6.1–7.2MB（`preserveDrawingBuffer:false` 下仍真实）。
- 北京路性能优化（相对建造版）：桌面关 MSAA、点光 11→3、`preserveDrawingBuffer:false`、桌面渲染倍率 0.9（画布 1296×810 放大到 1440×900）；前三项把白天从 48–57 提升到 60、夜间 36–45 提升到 58–60，0.9 倍率补齐古道视点。4K 导出已验证非空。必须只保留一个测试 Chrome；第二个 CDP Chrome 会让所有场景假性掉到 48–57。
- 北京路残差：正午金瓦偏土黄；山门匾额在 44 m 主视点不辨字；骑楼白天底层店招偏暗；北岸/中山四路为压缩示意；外摆与部分竖招为示意。
- 广州塔残差：`axis` 北岸三馆/三塔在 1.3–1.6 km 处体量偏小、CBD 盒子仍密；黄昏窗光偏弱；江面为程序化条带；映塔水池无真实镜面；移动端 base/axis 无热点圆点；`lattice` 为远眺而非近塔仰视。

## 2026-10-31 第三批（广州大剧院 + 广东省博物馆）

- 广州大剧院：7 视点（plaza/mouth/pool/west/small/axis/night）、三时段、7 热点、4K。主工程 embed 回归：桌面 21/21 组合 60fps，49–65 calls、28.4k–29.3k tris；手机 12/12 组合 60fps，40–64 calls、19.8k–20.5k tris、无横向溢出；0 console error。4K 3840×2160 / 5,709,429 bytes / 非空。深链 `?immersive=1&spot=opera-house` 落到 `view=plaza`。
- 广东省博物馆：7 视点（west/southwest/entry/skin/axis/roof/night）、三时段、7 热点、4K。主工程 embed 回归：桌面 21/21 组合 60fps，43–57 calls、18,494–18,986 tris；手机 12/12 组合 60fps，39–58 calls、17,568–18,412 tris、无横向溢出；0 console error。4K 3840×2160 / 5,819,541 bytes / 非空。深链 `?immersive=1&spot=gd-museum` 落到 `view=west`。
- 集成验证：图鉴深链 → 省博 embed → 「城市全景」→ 城市 POC → 返回；大剧院深链；手机 390×844 embed；广州塔/北京路深链 smoke，均 0 报错。省博不新增城市 POC 点位，城市全景走通用 `immersive/index.html`。
- 合并范围：`web/immersive/operahouse.*`、`web/immersive/gd-museum.*`、`dist/` 已与 `web/` 同步（`diff -rq web dist` 为空）；`app.js` 的 `opera-house`/`gd-museum` 路由与「3D 近景」文案为既有主工程改动，本次未改共享文件。
- 省博开场运镜按用户评审改为西南低空（`01 / 西南角 · 方形宝盒`），总长约 31 s；夜间 07 热点上移避开字牌，移动端夜景改为西南低角。自定义夜间玻璃 emissiveMap 会产生摩尔纹，已回退均匀内透。
- 残差：大剧院观众厅/舞台/后台/室内不做，玻璃口部只做浅层 lobby 剪影，文化轴城市体量为压缩示意；省博展厅内部不做，周边城市压缩示意（广州塔 0.75×、CBD 0.7×），夜景照明为 emissive + 点光示意，立面洞口/1.5 m 模数/中央天窗/入口抬升为估算，西广场红色低棚（可选）未做。
- 发布：2026-10-31 已发布到 https://canton-atlas-117yhjmxn8j.qoder.zone（同一地址更新）。公网实测：省博深链（west，49 calls / 18,528 tris / 60fps）、城市全景往返、大剧院深链（plaza，56 calls / 29,220 tris / 60fps）、手机省博（39 calls / 17,568 tris / 60fps / 无溢出），0 console error；`/immersive/gd-museum.html` 与 `/immersive/operahouse.html` 均 200。

## 下一步

- 沙面二期：从一期 C 向南扩到沙面公园/白鹅潭江岸，补白天鹅剪影（研究文档方案 A）。
- 越秀可选优化：顶层南望的老城中轴仍偏方块，可再识别中山纪念堂/市政府/海珠广场/海珠桥；五羊仍是低模示意。
- 陈家祠可选优化：合并屋脊/瓦面网格，把 3510 calls 降下来以稳定 60fps。
- 广州塔可选优化：把 `axis` 的三馆/三塔做成可识别轮廓，补黄昏窗光与江面反射；移动端 base/axis 热点圆点。
- 北京路可选优化：降低古道夜间在长时负载下的热降频影响（继续减几何或纹理），修正金瓦正午色偏、山门匾额可读性。
- 其他可做：花城广场、珠江夜游、琶醍。
- 已知视觉限制：中山纪念堂东/西/北抱厦素面、铜像低模；永庆坊水岸对岸/游船简化、夜景为照明示意、移动端 DPR 1.6；越秀五羊/城墙根为低模示意、顶层城市为压缩示意；沙面一期不含江岸/白天鹅 1:1，旗昌立面做了简化；白云山云海偏晨雾、城市远景压缩、牌坊/星碑简化；广州塔、北京路、广州大剧院、广东省博物馆的残差见上两节；POI 仍为示例数据，未接高德（Key 域名白名单仍待用户在高德控制台添加）。

## 新会话启动提示词

```text
你是 Canton Atlas 的新会话，接手沙面二期（江岸扩展）。

先读：
- docs/superpowers/handoffs/2026-10-30-canton-atlas-handoff.md
- docs/superpowers/research/2026-10-30-shamian-facts.md
- docs/superpowers/specs/2026-10-31-shamian-design.md
- docs/superpowers/plans/2026-10-31-shamian.md
- 一期源码：canton-atlas/web/immersive/shamian.*

范围：在一期 C（露德—券廊—街心花园）基础上，向南扩到沙面公园/白鹅潭江岸；白天鹅只做边缘剪影；不重做已验收的教堂/券廊，不改一期视点。先给 2 个扩展范围和取舍，等我确认后再写 spec/plan/实施。

验收：桌面 1440×900 + 手机 390×844；视点/时段/4K/about/sources 延续一期；0 console error、固定视点 60fps、无横向溢出。发布前先给截图和数据，不要直接发布。
注意：工作区不是 git 仓库；本地服务与 CDP 按交接文档重启。以 web 为准，dist 只在验收通过后同步。
```
