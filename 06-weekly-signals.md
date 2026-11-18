# 外围信号：周报与相关项目速记

本文件收集与 hmAgent 相关的技术侧信号，作为选型和方案设计的输入，不代表已落地结论。

## 1. 折叠屏 / 多设备适配（2026-11-11）
原文：跨平台框架释放阔屏潜能：CPF-RN 在 Pura X Max 阔折叠 UI 的适配实践
https://mp.weixin.qq.com/s/PEIRklc7kIJubvHjT1Urwg

- CPF-RN 基于 RNOH，通过 TurboModule + Fabric 把折叠状态、避让区、系统手势桥接到 JS
- Pura X Max：折叠态外屏 10:14，1264×1848（459×672vp）；展开态内屏 14:10，1828×2584（664×939vp）
- 七项能力：断点、栅格分栏、形态感知导航、折叠三态与悬停、避让区、交互归一、自适应弹窗
- 平行视界（存量应用低成本路径）：随包 JSON 配置 + `@react-native-ohos/native-stack`；分栏阈值折叠展开态短边 480–700vp、平板 700vp 以上；`homePage` 与路由名必须完全一致（区分大小写）；改配置需清 Metro 缓存并重装
- 组件库：`@hadss/react_native_breakpoints`、`adaptive_layout`、`adaptive-sheet`、`avoid_area`、`uni_input`、`adaptive_video`
- 示例仓库：https://atomgit.com/CPF-RN/rn_multidevice_layout_scenepkg
- 同系列还有 CPF-Flutter、KMP&CMP 两篇

对原生 ArkTS 项目的参考价值：断点分级、平行视界阈值、悬停态分区思路可直接对照 `hmos-multidevice-*` 系列 Skill。

## 2. 悬浮类窗口 Skill（2026-11-12）
原文：【HarmonyOS SDK Skills】一个 Skill 搞定画中画/闪控窗/闪控球开发
https://mp.weixin.qq.com/s/oilvugM1GrUYyLzA-f9EPw

- Skill 名：`hmos-arkui-kit-window-floatwindow`
- 覆盖：画中画 PiPWindow、闪控窗 floatView（圆角卡片/细长横条）、闪控球 floatingBall、球窗绑定 bind、防窥 dlpAntiPeep
- 接入两步：从 Matrix 格物平台下载 → 放进 DevEco Code 的 Skill 目录；对话含关键词即触发
- AI 分四类任务：问答 / 定位（基于误用清单）/ 辅助编程 / 原型验证（胶水代码出 demo）
- 下载：https://matrix.openharmony.cn/#/skillSquare/details?id=6ae44bf02f935261e2a3f7ee
- SDK 类 Skill 列表：https://matrix.openharmony.cn/#/skillSquare?tag=SDK

## 3. API 26 分布式数字身份 DID（2026-11-09）
https://mp.weixin.qq.com/s/md6b_kSXveprHOWrSFXsow

- 能力归属：Online Authentication Kit，基于 W3C DID 标准，凭证存 **TEE**，生物认证授权出示
- 接口：
  - 身份：`importDid` / `queryDid` / `sign` / `deleteDid`
  - 凭证：`importDigitalCredential` / `queryDigitalCredential` / `deleteDigitalCredential`
  - 出示：`getDigitalCredential`
- 三特性：跨平台互认、按属性粒度披露（最小必要）、设备强认证证明本人出示
- 场景：金融开户/交易授权/风控、社交实名、出行文旅（酒店入住、景区入园、会员核销、教育优惠）、政务电子证照

## 4. DevEco Profiler 录制（2026-11-10）
https://mp.weixin.qq.com/s/DRfxQLYrMihHppViHbsArQ

13 种调优场景：Frame（丢帧）、Launch（启动耗时）、Snapshot（ArkTS 堆快照）、Allocation（内存分配调用栈）、ArkUI（组件/布局/状态变量卡顿）、ComMemory、Energy、ArkWeb、Network（HTTP 分段耗时）、Concurrency、GPU、Time（ArkTS→Native 跨语言栈）、CPU。

操作流：选设备 → 选进程（可运行中或已安装未启动）→ 选模板 Create Session → 配置泳道 → 录制（`initializing`→`recording`）→ 停止 → `analyzing`→`rendering` → 看详情。

两个坑：录制中不能切其他模板；泳道 No Data 时悬停三角告警图标看报错。
DFX 能力地图：https://developer.huawei.com/consumer/cn/best-practices/quality/

## 5. 穿戴支付（2026-11-10）
https://mp.weixin.qq.com/s/CZEb2mCI2ZT0qAc7UH4WsQ

- 方案一：分布式 HCE（NFC）
  - 前提：轻量穿戴无法实时联网、不支持 TEE 生态开放 → 中间件与支付 App 分离
  - 架构：TRA（Token Requestor Aggregator）手机侧 SDK 申请/刷新 token，经 **Wear Engine Kit** 传手表侧 SDK，手表侧存 token 并由 NFC 传给 POS
  - 支持 iOS / Android / HarmonyOS 手机
- 方案二：通用二维码（All in one）：标准资源包 + 标准 SDK 接口，华为标准支付 App 动态加载各支付商资源包
- 安全栈：AGC 签名校验安装 → 安全启动（Secure Boot，SHA256+RSA，Efuse 不可逆）→ JS runtime 隔离 → HUKS 三层密钥（根→主→业务）→ Wear Engine 通道加密 → 离腕锁屏 + 小额限额
- 二维码开发指导书：https://developer.huawei.com/consumer/cn/doc/lite-wearable-guides/lite-wearable-code-pay-guide

## 6. 鸿测 Agent（开源，2026-11）
仓库：https://atomgit.com/HarmonyPandaWorkshop/hongce-agent

定位：面向 AI Agent 的应用自动化测试库，把"测试执行"从 Agent 里剥出来做成服务。
- 底层复用 Maestro（鸿蒙/Android/iOS）+ Playwright Test（Web）
- 四种接入：Skill（7 项，按阶段交接）、MCP、CLI、HTTP
- 已验证：鸿蒙手机/平板真实执行、Android 10 USB 真机冒烟、Web 本地 Chrome（正常/失败/超时/取消）；iOS 只有软件级接入，无真机验收
- 工程质量亮点：
  - 截图 SHA-256 核验；PNG 校验 chunk、CRC、解压长度、扫描行 filter、PLTE 顺序
  - 证据预算 8MB/16MB/64MB，超限标"省略"且不计入有效截图
  - `request_id` 去重 + 响应丢失可找回 `run_id`；"查不到记录不等于可以另建请求重跑"
  - 通过率分母是原始计划用例集；`completed` 只表示运行结束
  - 模拟结果标 `simulation`，cleanup 未知不冒充 normal
- 与 hmAgent 的关系：这是"执行层与 Agent 解耦"的现成样本，其任务合同与证据规则可直接借鉴到验收层
- 本机缺口：需要 Python 3.11–3.13 + Java + Maestro HarmonyOS v0.1.2 发行版，目前都没装
