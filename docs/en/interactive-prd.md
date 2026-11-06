# Interactive Game PRD 使用指南

> 面向使用者：如何用本技能把一份原始游戏 PRD 变成结构化规格、可离线运行的交互式 HTML 需求文档与规则模拟器。

## 它解决什么问题

传统游戏 PRD 是给人读的自然语言文档，AI 难以准确理解需求边界，文档与原型容易不一致。本技能把需求变成结构化中间表示（Game Requirement IR）作为唯一事实源，再从它生成需求网页与可玩的规则模拟器，并用确定性脚本校验三者一致。

## 快速上手（以仓库自带迷你样例为例）

```bash
# 1. 安装工具依赖（一次性）
cd skills/interactive-game-prd && npm install

# 2. 校验一份已有的 Game Spec（IR）
node scripts/validate-ir ../../examples/mini-game/game-spec

# 3. 构建 Interactive HTML PRD（第三参数为模拟器目录，可选）
node scripts/build-html.mjs ../../examples/mini-game/game-spec ../../examples/mini-game/output/interactive-game-prd ../../examples/mini-game/simulator

# 4. HTML 质量检查
node scripts/validate-html.mjs ../../examples/mini-game/output/interactive-game-prd ../../examples/mini-game/game-spec

# 5. 一键端到端（IR 校验 + 模拟器回放 + 构建 + HTML 检查 + 冒烟 + Validate 汇总）
npm run test:e2e
```

构建产物是单个 `index.html`：双击即可在 Chrome 中离线打开，无需任何服务。

## 产出的 HTML 里有什么

- **PRD 视图**：按功能 / 规则 / 状态机 / 配置分组的需求卡片，每条带需求 ID、状态徽标（proposed / approved / rejected / deprecated）与授权徽标（fixed / delegated / open）。
- **UI Demo**：按 UI 规格渲染的可操作游戏页面（注入模拟器时为可玩版本，判定日志实时显示每步命中的规则 ID）。
- **Flow**：状态机图与核心循环。
- **Tests**：四类验收用例（正常 / 非法 / 边界 / 状态异常）与预设场景。
- **双向定位**：PRD 条目点「查看 UI」跳转并高亮对应组件；在 UI 中右键组件反向定位关联需求。

## 从零创建一个新游戏（Create 模式概要）

1. 准备原始 PRD：`examples/<game>/game-spec/source/original-prd.md`（只读，永不改写）。
2. 按 `workflows/parse-prd.md` → `extract-requirements.md` 五步抽取，产出 IR（每条需求必须有来源：原文引用 / 推导依据 / 人工决策三选一）。
3. `workflows/review-requirements.md` 生成完整性 / 一致性 / 未决问题报告。
4. `workflows/generate-ir.md` 人工确认核心规则（AI 只能提 proposed，确认后才能 approved），冻结 Golden Sample。
5. `workflows/generate-html.md` 与 `generate-simulator.md` 生成产物；`validate-output` 通过后才能 Export ZIP。

## 核心约束（务必理解）

1. **结构化需求是唯一事实源**：HTML 与模拟器只是 IR 的展示与消费形式。
2. **每条需求必须有稳定 ID 与来源**，引用一律用 ID。
3. **未确认（open）的规则不能当正式规则**：模拟器遇到会输出 `RULE_NOT_CONFIRMED`，拒绝编造判定。
4. **确定性检查由脚本执行**：IR 是否合法问 `validate-ir`，不听信任何人的口头判断。

## 常见问题

- **构建产物打不开？** 确认是双击 `index.html`（file:// 协议），数据已内嵌无需服务；若页面空白运行 `validate-html` 检查。
- **模拟器拒绝某操作并提示 RULE_NOT_CONFIRMED？** 说明该规则未人工确认，走人工确认流程后重新构建。
- **想修改需求？** 走 Update 模式（增量抽取 + decision-log 记录），不要直接手改 approved 条目。

## 相关文档

- [快速开始](getting-started.md)：仓库结构与环境
- [贡献者指南](development.md)：如何参与开发
- 需求依据：`dev-docs/requirements/2026-11-06-interactive-game-prd.md`
