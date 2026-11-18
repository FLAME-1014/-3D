# HarmonyOS Skills 目录与安装状态

来源：`devecocli skills list -l`（2026-11-17 实测）、官方 Skill 仓库、悬浮窗 Skill 案例文章。

## 1. 是什么

官方定义（灵动小组件案例原文）：**Skill 是 DevEco Code 的核心原子能力单元，可理解为"可复用的专家经验包"**，把高频鸿蒙开发操作固化为精确指令集。

官方宣称的四点价值：
- **模型无关性**：指令集不绑定特定模型版本
- **Token 消耗降低 70%+**，任务完成速度提升 3 倍以上
- **保持"当下最佳实践"**：知识库随 IDE 版本更新
- 原始仓库：https://gitcode.com/HarmonyOS_Skills/harmonyos-agent-skills
- 分发市场：Matrix 格物平台 https://matrix.openharmony.cn/#/skillSquare

## 2. 命名规律

`hmos-<领域或 Kit>-<能力>`，例如：
- `hmos-arkts-syntax-checker`（语言层）
- `hmos-arkui-statemgt-migration`（框架层）
- `hmos-multidevice-fold-state`（场景层）
- `hmos-account-kit-quicklogin-client`（Kit 层）
- `hmos-dfx-analyzer`（跨领域总入口）

少数不以 hmos 开头：`app-metadata-audit-skill`。

## 3. 全量清单（56 个，按用途分组）

### 语言与框架基础
- `hmos-arkts-knowledge-retriever`：ArkTS 语言指南检索，提供可追溯引用
- `hmos-arkts-syntax-checker`：语法检查 + 自动修复 + 循环构建直到成功，P0/P1/P2 分级
- `hmos-arkts-deprecated-interface-checker`：废弃接口扫描 + 迁移方案
- `hmos-arkui-develop-skill`：写/审 ArkUI 代码的规范与陷阱清单
- `hmos-arkui-knowledge-retriever`：ArkUI API 证据检索
- `hmos-arkui-mvvm-pattern`：MVVM 分层与数据流规范
- `hmos-arkui-statemgt-migration`：V1→V2 迁移动作
- `hmos-arkui-v1-v2-migration-and-mixusage`：整仓迁移与 V1/V2 混用
- `hmos-one-sdk-skill`：25 个 Kit 的 API 签名/导入路径/错误码/权限速查
- `hmos-design-visual-mobile`：移动端高保真 HTML 还原
- `hmos-runtime-fix-skill`：运行期崩溃前置路由（先加载再扫代码）

### 多设备与窗口
- `hmos-multidevice-scenario-entry`：多设备适配总入口，按场景路由
- `hmos-multidevice-screen-window-size`：断点、GridRow/GridCol、平行视界/EasyGo、应用内分屏
- `hmos-multidevice-fold-state`：折叠状态、悬停分屏、折痕避让
- `hmos-multidevice-avoid-areas`：安全区、挖孔、键盘避让
- `hmos-multidevice-hardware-access`：相机选择/旋转、canIUse/SysCap 降级
- `hmos-multidevice-interaction-methods`：触摸/鼠标/键盘/手写笔归一
- `hmos-multidevice-natural-orientation`：屏幕方向与旋转
- `hmos-window-smart-orientation`：智感旋转，18 种 Orientation 映射与选型决策树
- `hmos-window-immersive`：沉浸式状态栏/导航条、扩展沉浸式
- `hmos-window-hover-state`：折叠悬停态（HALF_FOLD）布局与折痕避让
- `hmos-arkui-kit-window-floatwindow`：画中画 / 闪控窗 / 闪控球 / 球窗绑定 / 防窥
- `hmos-app-continuity-skill`：应用接续，跨设备状态迁移

### 动效与转场
- `hmos-arkui-navigation-transition`：NavDestination 四类转场
- `hmos-arkui-longtake-transition`：一镜到底连续转场

### DFX 故障分析
- `hmos-dfx-analyzer`：总入口，输入归一化→分诊→仲裁→路由→报告；设计为在隔离 subagent 中加载
- `hmos-cppcrash-analysis`：Native 崩溃（SIGSEGV/SIGABRT/SIGILL/SIGBUS）
- `hmos-jscrash-analysis`：JS/ArkTS 闪退，支持 SourceMap 反解混淆堆栈
- `hmos-appfreeze-analysis`：冻屏/ANR，先排除系统级异常再查线程栈/Binder/EventHandler
- `hmos-jsleak-analysis`：rawheap/heapsnapshot 聚类，内置转换与聚类脚本
- `hmos-native-memleak-analysis`：sample/smaps/火焰图/NMD，覆盖 PSS/DMA/GPU 泄漏
- `hmos-memleak-analysis`：源码静态查泄漏（ArkTS/JS/C++，重点 NAPI 生命周期）
- `hmos-fdleak-analysis`：FD/句柄泄漏，解析 FdTrack 申请栈
- `hmos-apifault-analysis`：错误码 / 错误信息定位

### Kit 接入
- 账号：`hmos-account-kit-quicklogin-client`（一键登录）、`hmos-account-kit-login-button-client`（标准按钮）、`hmos-account-kit-login-api-client`（自定义按钮）
- 地图：`hmos-map-kit-map-creation`、`hmos-map-kit-poi-search`、`hmos-map-kit-route-planning`
- 扫码：`hmos-scan-kit-defaultscan`、`hmos-scan-kit-customscan`
- 支付：`hmos-payment-kit-huawei-payment-integration`
- 推送：`hmos-push-kit`（Master Skill 大路由）
- 广告：`hmos-ads-kit-access`
- 实况窗：`hmos-live-view-kit-build-location`
- 分享：`hmos-share-kit-knock-share`、`hmos-share-kit-gestures-share`

### 元服务与工程
- `hmos-atomicservice-assistant`：元服务创建/改造、隐私托管、可信域名、包体积、Navigation 分包、上架
- `hmos-ascf-assistant`：ASCF 工具链
- `hmos-ascf-convert-taro`、`hmos-ascf-convert-uniapp`：小程序/Taro/uni-app 转元服务
- `hmos-connect-api-cli-skill`：内嵌 connect-api-cli 操作 AGC
- `hmos-local-test`、`hmos-instrument-test`：单元测试与仪器测试
- `app-metadata-audit-skill`：AGC 上架元数据合规审查

## 4. 本机安装状态

- 官方总数：56
- 装到 Qoder CN（`C:\Users\Administrator\.qoder-cn\skills`）：22 原有 + 17 新增 = **39**
- 新增的 17 个：账号 3、支付、推送、扫码 2、分享 2、POI 检索、实况窗、dfx-analyzer、jscrash、apifault、runtime-fix、废弃接口检查、上架元数据审查

安装命令（注意必须用 `--path` 才能落到 Qoder CN 目录，`--agent qoder` 会装到 `C:\Users\Administrator\.qoder\skills`）：

```bash
devecocli skills add --skill <skill-name> --path "C:/Users/Administrator/.qoder-cn/skills"
```

仍未安装的 17 个：cppcrash、appfreeze、三个内存/句柄泄漏、地图 creation/route、ads、6 个窗口转场类、app-continuity、v1v2-mixusage。

## 5. 设计上值得借鉴的三点

1. **总入口 + 专项路由**：`dfx-analyzer` 做分诊，`push-kit` 做 Master Skill，避免单个 Skill 承担所有场景
2. **前置路由省上下文**：`runtime-fix-skill` 明确写"在崩溃类任务上先加载本 Skill，避免广泛 Read/Glob"
3. **触发词写得极密**：描述里塞满同义词、错误码、文件后缀，提高命中率——但也带来多 Skill 抢占的风险，装太多要留意
