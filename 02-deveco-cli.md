# DevEco CLI（devecocli）：Agent 的工程执行层

来源：本机安装的 `deveco-cli` Skill 说明（完整命令规约）、官方安装文档、高德案例（2026-09-28）。

## 1. 定位

面向 AI Agent 的 HarmonyOS 命令行工具集，把 DevEco Studio 的 `hvigor`、`ohpm`、`hdc`、模拟器工具链和 Skill 安装器封装为**可调用、可组合、可判断**的接口。

它的价值不在"命令数量"，而在把工程动作转成**结构化命令 + 退出码 + 日志 + 产物路径**，让 Agent 能连续执行：
`改代码 → 构建 → 签名 → 安装 → 启动 → 验证 → 基于证据修复`

## 2. 本机环境（实测）

- `devecocli` 版本：**1.3.0-stable**（npm 全局 `@deveco/deveco-cli`）
- DevEco Studio：`D:\DevEco Studio`，版本 26.0.0.821（build DS-261.23567.138.36.2600821）
- `DEVECO_HOME` 未设置，Studio 不在默认路径，但工具链能被自动发现
- 环境要求（官方）：Node.js 22+；DevEco Studio ≥6.0.0 或 Command Line Tools ≥26.0.0

实测通过：

| 命令 | 结果 |
|---|---|
| `devecocli device list` | 识别真机 HUAWEI Mate 60 Pro（2LQ0224125000632）+ 模拟器 Mate 90 Pro（127.0.0.1:5555） |
| `devecocli ui layout --device <serial> --format json` | 成功 dump ArkUI 无障碍布局树（含 id/type/bounds/text） |
| `devecocli docs catalog` | 6 个本地文档库：harmonyos-guides / references / best-practices / faqs / releases / roadmap |

## 3. 命令面（按用途分组）

### 构建与检查
- `build`：模块构建、整包 `--product`、`build clean`
- `check lint`：DevEco Code Linter（`--fix`、`--incremental`、`--format json`）
- `check compat`：跨 SDK 版本 API 破坏性变更扫描，基于 arkanalyzer-apiscan；先 `versions` 再指定 `--source-version/--target-version`

### 部署与迭代
- `run`：构建+安装+启动；`--uninstall` 解决签名不一致
- `run --apply <file>`：**快速增量部署**。只重编改动文件 → 签 hqf → `bm quickfix -a -f -o` 安装 → 重启应用。要求 DevEco Studio ≥6.1.1，且必须先跑过一次完整 `run` 生成 `buildConfig.json`
- `run --hotreload` + `--hotreload-apply <file>`：**不重启应用**热更。需后台进程持住 watch 会话；只支持单模块；`@State` 等状态装饰器改动不生效；资源与 native 改动需完整 run

### 设备与模拟器
- `device list/view`
- `emulator list/start/stop/create/delete`、`image list/download/remove`
- 场景注入：`fold`（折叠屏三态，支持 foldable / 2in1_foldable / triplefold）、`battery`、`geolocation`、`sensor`、`scene`（跑步/骑行/导航）、`rotate`、`volume`、`shake`

### UI 巡检与操作
- `ui layout`：布局树，`--mode simplified` 折掉无意义容器，`--depth` 截断，`--format json` 可配 jq
- `ui screenshot`：`--path` 必填，底层 `hdc shell snapshot_display` + `hdc file recv`
- `ui click/doubleclick/longclick/swipe/fling/drag/text`：支持按节点 `--id` 定位（自动取中心），无需手算坐标
- 注意：`layout` 只返回**屏幕上可见**节点，需要先滚动到目标位置

### 诊断与其他
- `log`：hilog / `--crash`、`--level`、`--bundle-name`、`--keyword`、`--from/--to`、`--tail/--follow`
- `signature generate`：自动生成 p12/csr/云证书/test profile，写入 `build-profile.json5`；需先 `auth login`
- `docs search/read/catalog`：本地文档检索
- `skills list/find/add/remove`：Skill 分发（支持 agent：atomcode、codebuddy、cursor、opencode、qoder、trae-cn）
- `init --skill | --mcp`：把 Skill 或 `deveco-mcp` 装进 AI 工具
- `serve mcp`：stdio MCP server（暴露 `check` 能力）
- `create`：脚手架；`update`：自升级

## 4. 高德案例给出的关键结论

### 4.1 自动签名是端到端闭环的断点

代码能自动生成、工程能自动构建，但签名要人工开 IDE 选证书，自动化就断在真机安装之前——Agent 只能证明"能编译"，无法证明"能运行"。
高德提出需求后，华为加了 `devecocli signature generate`，打通了 `编译—签名—真机运行—验证`。

### 4.2 面向 Agent 的 CLI 有 5 条硬要求

1. 输入参数明确，不依赖隐含状态
2. 输出结构化，能判断成功/失败
3. 错误信息可定位，能驱动下一轮修复
4. 构建产物与日志位置明确，便于继续处理
5. 相同命令在不同环境保持稳定语义

### 4.3 预设降级链

`devecocli → deveco-mcp → hdc + hvigor`

每次降级必须保留失败原因、当前状态、已完成步骤；降级不是无条件重试。

## 5. 使用要点

- 多设备时必须显式 `--device` / `-t`
- 增量与热更都要注意"har 依赖改动会自动路由到主模块"，但 `feature` 依赖模块改动不可热更
- `emulator image download` 可能 30 分钟以上、失败不要自动重试，交给人工
- 模拟器协议类命令需要 Emulator 7.0+；`DEVECO_CLI_DEBUG=1` 可看底层命令映射
