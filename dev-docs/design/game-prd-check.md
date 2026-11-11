# game-prd-check 第一阶段 MVP 执行需求

## 一、目标

第一阶段只做一件事：读取 `input/` 下的原始 PRD 需求文档，对照 `.claude/skills/game-prd-check/references/rules/` 下的检查规范，快速生成一份结构化问题报告。

不做的事（本阶段明确排除）：

- 不做自动修改 PRD
- 不做审批工作台
- 不做自动生成 GDD / Interaction
- 不做知识库、Benchmark、自动评测
- 不做复杂架构

## 二、输入与输出

输入：

```
input/
  原始需求.md          （待检查的 PRD）

.claude/skills/game-prd-check/references/rules/
  检查规范1.md
  检查规范2.md
  ...                  （产品规则基准，视为正确答案）
```

输出（唯一交付物）：

```
examples/game-prd-check/
  report.md            （问题报告）
```

## 三、检查方法

以 rules 为基准逐项检查 input 需求文档：

1. rules 中定义了、但需求文档缺失或未描述的 → MISSING
2. 需求文档内部两处描述互相矛盾的 → CONFLICT
3. 需求文档描述模糊、可多种理解的 → AMBIGUOUS
4. 需求文档规则与 rules 基准冲突或自身逻辑错误的 → LOGIC
5. 需求文档描述不完整、无法实现或无法验收的 → INCOMPLETE

优先级定义：

| 优先级 | 含义 | 判定标准 |
|---|---|---|
| P0 | 严重问题 | 关键流程/规则缺失或矛盾，直接阻塞开发或验收 |
| P1 | 高优先级 | 明确的冲突、逻辑错误，不解决会导致实现错误 |
| P2 | 一般问题 | 模糊、不完整，需要澄清后才能实现 |
| P3 | 优化建议 | 不影响正确性，但补充后文档质量更高 |

硬性要求：每个问题必须引用需求文档原文位置和原文证据，不允许无依据的推测。

## 四、报告结构（四部分）

1. **检查概览**：问题总数、P0/P1/P2/P3 数量的统计表。
2. **问题清单**：核心表格，列为 `ID | 类型 | 优先级 | 问题 | 原文位置 | 建议`。
3. **重点问题详情**：对每个问题展开，含原文、问题、影响、建议、处理状态（默认"待确认"）。
4. **总体建议**：问题最多的模块、影响开发的问题、是否建议进入下一阶段规格生成。

报告模板见 `.claude/skills/game-prd-check/references/templates/report.template.md`。

## 五、执行流程（四步）

1. 读取 `input/` 下的需求文档。
2. 读取 `references/rules/` 下的检查规范。
3. AI 逐项对照检查，发现缺失、冲突、模糊、逻辑、完整性问题。
4. 按 `references/templates/report.template.md` 结构生成 `examples/game-prd-check/report.md`。

## 六、目录结构

```
.claude/skills/game-prd-check/
├── SKILL.md
└── references/
    ├── rules/            检查规范（规则基准）
    └── templates/
        └── report.template.md

input/
  原始需求.md

examples/
  game-prd-check/
    report.md
```

## 七、验收标准（四条）

1. 能读取 input 下的需求文档。
2. 能读取 rules 下的检查规范。
3. 能找出问题，并给出原文位置和具体证据。
4. 能生成结构清晰的 report.md。

## 八、首跑验证

用杭州麻将这份原始需求跑通一次（规则基准：`references/rules/hzmj_game_flow_handler/` 与 `references/rules/杭州麻将产品需求文档PRD.md`），检查生成报告的质量，后续再逐步扩展能力。
