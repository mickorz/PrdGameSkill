---
name: interactive-game-prd
description: 从原始游戏 PRD 生成结构化 Game Requirement IR、Interactive HTML PRD 与可回放规则模拟器；含需求审查、人工确认与一致性校验的完整闭环。支持 Create / Update / Review / Generate / Validate / Export 六种模式。
---

# Interactive Game PRD Skill

把一份原始游戏 PRD 转化为：结构化 Game Requirement IR（唯一事实源）→ 可离线运行的 Interactive HTML PRD → 按已确认规则运行的规则模拟器 → 机器可读的一致性校验报告。

## 三层职责边界（必须遵守）

| 层次 | 职责 | 例子 |
|---|---|---|
| Skill（本文件 + AI） | 理解任务、决策、组织执行 | 判断用户意图是 Create 还是 Update，选择工作流 |
| Workflow（workflows/） | 定义执行步骤与人工审批点 | parse-prd 五步顺序、人工确认节点 |
| Scripts（scripts/） | 确定性执行、校验、生成 | validate-ir、validate-html、build-html |

红线：

1. **IR 是否合法必须调用 `scripts/validate-ir` 判定**，禁止 AI 阅读提示词后自行下结论。
2. 需求文档 9.2 节全部确定性检查一律走 Scripts 层；AI 只负责 9.3 节语义检查（遗漏页面、隐性冲突、体验问题等）。
3. 任何模式都不得覆盖 `source/original-prd.md`；不得虚构原始 PRD 没有定义的规则。

## 六种模式入口

| 模式 | 工作流 | 功能 |
|---|---|---|
| Create | parse-prd → extract-requirements → generate-ir → review-requirements → generate-html → generate-simulator | 从原始 PRD 创建交互式 Game PRD |
| Update | extract-requirements（增量） | 根据新需求更新现有规格，必须追加 decision-log |
| Review | review-requirements | 只产出审查报告，不修改原始需求与 IR |
| Generate | generate-html / generate-simulator | 从 IR 重新生成 HTML 与模拟器，不修改 approved 规则 |
| Validate | validate-output | IR + HTML + 模拟器一致性，输出机器可读报告 |
| Export | validate-output（尾段） | 双校验通过后打 ZIP |

## 目录约定

```text
skills/interactive-game-prd/
├── references/game-prd-format.md   IR 格式唯一权威定义
├── schemas/                        manifest / requirement / ui / test 四份 JSON Schema
├── templates/                      IR 文件模板
├── workflows/                      七个工作流文档
├── assets/html-template/           HTML PRD 渲染模板
├── assets/simulator-template/      模拟器框架契约
└── scripts/                        validate-ir / build-html / validate-html / 测试
```

每个游戏一份 `examples/<game>/`：

```text
examples/<game>/
├── source/original-prd.md     原始 PRD（只读）
├── game-spec/                 Game Requirement IR
├── simulator/                 该游戏的模拟器实现
├── reviews/                   审查与决策记录（也在 game-spec/reviews）
├── tests/                     场景与用例（也在 game-spec/tests）
└── output/interactive-game-prd/  生成产物
```

## 命令速查

```bash
# IR 校验（Create/Update 后必须）
node skills/interactive-game-prd/scripts/validate-ir examples/<game>/game-spec

# 构建 HTML（先注入模拟器则带第三参数）
node skills/interactive-game-prd/scripts/build-html.mjs examples/<game>/game-spec examples/<game>/output/interactive-game-prd examples/<game>/simulator

# HTML 质量检查（Export 前必须）
node skills/interactive-game-prd/scripts/validate-html.mjs examples/<game>/output/interactive-game-prd examples/<game>/game-spec

# 模拟器场景回放
node skills/interactive-game-prd/scripts/simulator.test.mjs

# 端到端一致性（Validate 模式）
node skills/interactive-game-prd/scripts/validate-output.mjs examples/<game>
```

## 状态与授权（详见 references/game-prd-format.md 第 6 节）

- 每条需求 `status: proposed|approved|rejected|deprecated`，`authority: fixed|delegated|open`。
- AI 只能提 proposed；approved 只能由人工确认产生并记录 decision-log。
- 未确认（open）的规则，模拟器输出 `RULE_NOT_CONFIRMED`，禁止编造判定结果。
