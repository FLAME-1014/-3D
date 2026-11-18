# DevEco Code：鸿蒙 AI Agent 本体

来源：华为开发者文档（2026-11-11 更新）、灵动小组件案例（2026-09-08）。

## 1. 定位

DevEco Code 是华为在 HDC 2026（2026-06-12）发布的 AI 编程助手，**基于华为自研 BitFun（毕方）+ 开源 OpenCode 构建**，专为鸿蒙场景定制。

判断依据：
- 官方案例原文明确写了 BitFun + OpenCode
- `deveco.jsonc` 配置文件的 `$schema` 直接指向 `https://opencode.ai/config.json`

本机安装：`~/.local/bin/deveco`，版本 0.2.5（独立二进制，不是 npm 全局包）。
启动：终端执行 `deveco`，未登录会引导华为账号登录；`deveco auth logout` 退出。

## 2. 三种 Agent 模式

对话内输入 `/agents` 查看列表，`Tab` 快速切换。

| 模式 | 行为 | 适用 |
|---|---|---|
| **Build** | 输入需求直接执行：理解→生成→修 bug→构建出包→推模拟器 | 小改动、明确需求 |
| **Plan + Build** | 先 Plan 只读只分析，产出可执行任务列表（不改文件），遇到模糊点用 **Question 工具**交互补全；确认后切 Build 跑流水线 | 中等复杂度需求 |
| **Goal** | 需求分析→架构设计→任务拆分→生成结构化文档→闭环（代码生成/语法校验/打包/部署/自动验证/自动修复）迭代到完成 | 完整特性、关键质量模块、多人协作、从零搭项目 |

约束：
- Goal 模式要求 DevEco Studio ≥ 6.1.0
- Windows/macOS 版用模拟器推包验证；鸿蒙电脑版用本地真机验证

## 3. 三循环验证 Harness（案例一贡献的关键认知）

DevEco Code 的 Harness 有三层递进验证：

1. **语法校验**：轻量语法工具先过滤并修复明显错误；再用 **LSP** 做依赖分析、调用链分析、引用关系分析，帮助 AI 建立项目结构认知（这一步直接决定跨模块重构的准确性）
2. **编译诊断**：调编译工具，错误回传 Agent 修复，直到编译通过
3. **UI 意图校验**：编译过 ≠ 功能对 ≠ UI 对。基于多模态模型，自动拉起模拟器，模拟真实用户的点击/滑动/长按/输入，过程中主动截图，生成对比报告；发现问题自动回传修复

对应到自建体系时的结论：**"能构建"只是第二层，真正的验收在第三层**。

## 4. 模型与配置

来源：DevEco Code 配置 Models 文档（2026-11-11）。

- 内置 **GLM-5.1 / GLM-5.3**，登录即用，**单账号默认 50 次请求/分钟**
- `/models` 进模型切换界面；`/connect` 接第三方 Provider（ZhipuAI、Alibaba 等），输入 API Key 选模型
- 多模态模型仅支持 Qwen 系列，用于图片输入
- 配置文件优先级（Windows）：
  - 项目级 `.deveco/deveco.jsonc`
  - 用户级 `C:/Users/<用户名>/.config/deveco/deveco.jsonc`
  - 鸿蒙电脑用户级为 `~/.deveco/deveco.jsonc`

配置片段示例（官方）：

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "deveco": {
      "name": "DevEco Code",
      "models": {
        "glm-5.1": {
          "tool_call": true,
          "limit": { "context": 200000, "output": 8192 }
        }
      },
      "options": {
        "baseURL": "https://api.openbitfun.com/v1",
        "apiKey": "{env:DEVECO_API_KEY}"
      }
    }
  },
  "agent": {
    "ui_verification": {
      "mode": "subagent",
      "model": "myprovider/qwen3-vl-plus",
      "hidden": true
    }
  }
}
```

## 5. UI 检查的真实边界

- `ui_verification` 是**可选的 subagent**，已登录时默认用内置 Qwen3-VL，未登录则**跳过 UI 检查**
- 职责只有一条：验证界面**是否符合需求描述**
- 也就是说它是"描述比对"，不是像素级回归、也不是结构 diff。间距错位、控件遮挡这类问题，判断力有限

结论：如果要用它做验收，需要自己补"截图 + 布局树 diff"这类硬证据。

## 6. 已知短板（基于文档与本机观测）

1. 默认模型 GLM-5.x + 50 RPM：Goal 类长任务动辄上百次工具调用，限流是硬瓶颈
2. UI 验证为多模态描述比对，深度不足
3. 配置入口分散在 `/connect`、`/models`、`deveco.jsonc` 三处
4. 第三方多模态只支持 Qwen 系列

## 7. 与自建 Agent 的关系

DevEco Code 把"决策（模型）"和"执行（工具）"捆在一个产品里；DevEco CLI 把执行层抽成独立可调用接口。
自建方案更合理的组合是：**自选模型编排 + devecocli 工具面 + 官方 Skills + 更硬的验证手段**，而不是复刻 DevEco Code。
