# 鸿蒙 AI Agent 研发体系 · 资料汇总

本目录收集 DevEco Code / DevEco CLI / HarmonyOS Skills 及相关实践案例，用于 hmAgent 方向的研究与后续落地。
所有内容来自官方文档、官方公众号原文，以及本机实测；每条结论标注来源，未验证的部分单列。

## 工作区与分支

当前分支为 `codex/hmAgent-research`，仅保存本页与 6 份研究文档。它使用独立提交历史，不继承 3D 项目的目录，也不作为合入 `main` 的功能分支。

- 研究资料：[codex/hmAgent-research](https://github.com/FLAME-1014/-3D/tree/codex/hmAgent-research)。
- 工厂及其他 3D 项目：[codex/3d-source-archive](https://github.com/FLAME-1014/-3D/tree/codex/3d-source-archive)。
- 原始资料来自 `b2c9184` 的 `qoder-docs/hmAgent/`，于 2026-11-18 整理到本分支根目录。
- 本分支不包含阶段备份、输出截图、临时脚本、开发凭据或第三方依赖。

## 文档索引

| 文件 | 内容 |
|---|---|
| [01-deveco-code-agent.md](01-deveco-code-agent.md) | DevEco Code 的定位、三种 Agent 模式、模型配置、三循环验证 Harness |
| [02-deveco-cli.md](02-deveco-cli.md) | DevEco CLI 命令面、本机实测结果、增量部署与热重载的限制 |
| [03-skills-catalog.md](03-skills-catalog.md) | 56 个官方 Skill 分类、安装状态、命名与触发设计规律 |
| [04-case-v1v2-migration.md](04-case-v1v2-migration.md) | 案例一：灵动小组件 12 天迁移 41 模块 / 1000+ 文件 |
| [05-case-amap-ainative.md](05-case-amap-ainative.md) | 案例二：高德 × DevEco CLI 的 AI Native 规模化交付体系 |
| [06-weekly-signals.md](06-weekly-signals.md) | 外围信号：折叠屏适配、悬浮窗 Skill、DID、Profiler、穿戴支付、鸿测 Agent |

## 一句话总览

三个东西分工不同，不要混为一谈：

- **DevEco Code**：AI Agent 本体（华为 BitFun + OpenCode），决定"想什么、怎么编排"
- **DevEco CLI（`devecocli`）**：无头工程执行层，决定"能不能真的跑起来、验得了"
- **HarmonyOS Skills**：可复用专家经验包，决定"知不知道正确的做法"

两个案例给出的共同结论是：**生成质量决定单轮成功率，闭环能力决定最终完成率**（高德原文）。也就是说，模型强弱只影响一次写对与否，能否自动构建、签名、装真机、验证、修回，才决定任务能不能交付。

## 关键数据对照

| 指标 | 灵动小组件（中小团队） | 高德（大厂规模化） |
|---|---|---|
| 任务 | ArkTS V1→V2 整体迁移 | 鸿蒙 L6 适配，3000+ 项能力 |
| 规模 | 41 模块 / 1000+ 文件 | 千余项待补能力 |
| 原估算 vs 实际 | 半年以上 → 12 天 | 数千人日 → 数百人日 |
| 效率说法 | 未给倍数，只给"12 天 + 无明显 Bug" | 单点 15–40 倍，综合 20 倍以上，人力 -90% |
| 完成率 | 未量化 | 约五成 → 99% 以上 |

两篇口径都明确区分"已验证"和"未验证"，引用时不要互相外推。

## 可复用方法清单（两案例的共同骨架）

1. **先把规则写成 Skill**，不要把长提示词塞给模型。规则要包含：差异点、改动范围、出问题去哪里查文档。
2. **按耦合关系切模块**，让每个迁移单元尽量少依赖其他单元，否则无法并行、无法定位问题。
3. **一次只推进一个可验证单元**，用 Agent 的 Goal 类模式跑"生成→构建→验证→修复"闭环。
4. **人工卡点留在三处**：需求口径与优先级、架构取舍、最终验收与合入。
5. **状态外置**：目标、边界、进度、已尝试方案、证据写进 Spec/任务合同，不能只存在对话上下文里。
6. **失败要留证据、要有重试上限**，超过上限停止自动执行并转人工。
7. **降级链要预先定义**：`devecocli → deveco-mcp → hdc + hvigor`，每次降级都要保留失败原因和已完成步骤。
8. **完成标准要统一**：构建通过 ≠ 安装成功 ≠ 启动正常 ≠ UI 符合预期 ≠ 业务行为正确，四层证据要分开记录。

## 待验证清单

- [ ] `devecocli run --apply` 和 `--hotreload` 在本机 DevEco Studio 26.0.0.821 上是否满足版本门槛（文档写 ≥6.1.1）
- [ ] 官方 Skill 的 Goal 模式在 jkmall 这种多模块工程上的实际表现
- [ ] 元服务（原子化服务）是否可被 Maestro / 鸿测那类 UI 自动化驱动（目前无公开证据）
- [ ] DevEco Code 默认 GLM-5.x + 50 次/分钟限流对长任务的实际影响
- [ ] Skill 触发词密度过高时的互相抢占情况（本机已装 39 个 hmos 类 Skill）

## 相关链接

- DevEco Code 文档（安装）：https://developer.huawei.com/consumer/cn/doc/doccenter-deveco-studio/ide-deveco-code-install
- DevEco Code Agent 模式：https://developer.huawei.com/consumer/cn/doc/doccenter-deveco-studio/ide-deveco-code-agent
- DevEco Code 模型配置：https://developer.huawei.com/consumer/cn/doc/doccenter-deveco-studio/ide-deveco-code-model
- DevEco CLI 文档：https://developer.huawei.com/consumer/cn/doc/doccenter-deveco-studio/ide-deveco-cli-install
- Skill 市场（Matrix 格物平台）：https://matrix.openharmony.cn/#/skillSquare
- 官方 Skill 原始仓库：https://gitcode.com/HarmonyOS_Skills/harmonyos-agent-skills
- DFX 能力地图：https://developer.huawei.com/consumer/cn/best-practices/quality/
