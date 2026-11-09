# game-spec-generator Skill — V1 开发与卡五星实测计划

> 来源：外部评审建议（2026-11-09）
> 定位：独立 Skill 实验计划，暂不改造现有 PrdGameSkill；用卡五星 8 份原始需求作为真实测试数据验证转换质量。
> 结论先行：确定为 **GDD + PRD + Interaction + Interaction-Contract** 四份文档。

## 验证目标

这次实验的核心目标不是生成四份看起来完整的文档，而是验证：

1. 原始需求能否被准确提取，不丢失规则。
2. GDD、PRD、Interaction、Contract 能否合理分工。
3. 文档之间能否建立关联和追溯。
4. 缺失、冲突、歧义能否被识别，而不是让 AI 自行补全。
5. 最终文档能否直接用于后续 AI 开发和测试。

## 一、Skill 定位

建议名称：`game-spec-generator`。

职责：把原始游戏需求转换成四层工程规格。

| 输出                        | 解决的问题   | 主要内容                 |
| ------------------------- | ------- | -------------------- |
| GDD.md                    | 游戏怎么玩？  | 核心玩法、规则、数值、结算        |
| PRD.md                    | 产品要做什么？ | 功能、场景、流程、验收标准        |
| Interaction.md            | 玩家如何操作？ | 页面、控件、交互、反馈、状态       |
| Interaction-Contract.yaml | 系统如何响应？ | 事件、前置条件、状态转移、数据影响、异常 |

特别注意：Interaction Contract 不应该直接等同于代码 API。第一轮先定义平台无关的业务事件和状态契约，避免过早绑定 Unity、Cocos 或 FairyGUI。

## 二、执行流程：五步流水线

不一次性让 AI 写四份文档，而是分五步：

1. **Step 1：Source Analysis**
   读取原始需求，建立需求事实清单。
   输出：`source-analysis.md`。记录原文、来源位置、事实类型、推导内容、歧义和冲突。
2. **Step 2：Generate GDD**
   提取玩法、规则、数值、流程、结算。输出 `GDD.md`。不确定的规则必须保留待确认状态。
3. **Step 3：Generate PRD**
   从 GDD 和原始需求提取产品功能。输出 `PRD.md`。每项功能关联对应的规则和验收条件。
4. **Step 4：Generate Interaction**
   从 PRD 和原始 UI 需求提取页面、操作、反馈。输出 `Interaction.md`。
5. **Step 5：Generate Interaction Contract**
   把交互转换为机器可读的契约。输出 `Interaction-Contract.yaml`。检查事件、状态机、数据影响、异常和互斥规则。

每一步都保留中间产物，方便判断是哪一层出现了信息丢失。

## 三、卡五星项目作为 Benchmark

原始需求与测试点的对应关系：

| 文件 | 测试点 |
| --- | --- |
| `01-基础规则.md` | 测试 GDD |
| `02-游戏流程.md` | 测试游戏生命周期 |
| `03-打牌操作.md` | 测试操作规则和 Contract |
| `04-番型.md` | 测试复杂规则与互斥关系 |
| `05-胡牌类型.md` | 测试条件判定与状态约束 |
| `06-结算.md` | 测试复杂计算规则 |
| `07-配置.md` | 测试配置和规则联动 |
| `08-UI交互.md` | 测试 Interaction |

原始目录中的 `source-map.json` 和 `_map_*.json` 也应纳入读取范围，用来建立来源追溯。

**一个特别重要的测试约束**：不要让新 Skill 直接读取现有的 131 条 IR 来生成四份文档。第一轮必须主要从 `source/` 独立生成，再拿现有 IR 和已有的 31 项待确认问题作为对照评测数据。否则测试出来的可能只是现有 IR 的重新排版，而不是验证 Skill 是否真正具备需求理解能力。

## 四、Skill 目录结构

先独立开发，不动现有 PrdGameSkill 的核心代码。

```
game-spec-generator/
├── SKILL.md
├── references/
│   ├── gdd-format.md
│   ├── prd-format.md
│   ├── interaction-format.md
│   ├── interaction-contract-format.md
│   └── traceability-rules.md
├── templates/
│   ├── GDD.template.md
│   ├── PRD.template.md
│   ├── Interaction.template.md
│   └── Interaction-Contract.template.yaml
└── evals/
    ├── evaluation-criteria.md
    └── mahjong-benchmark.md
```

卡五星测试产物单独放置：

```
examples/mahjong/spec-generation/
├── source-analysis.md
├── GDD.md
├── PRD.md
├── Interaction.md
├── Interaction-Contract.yaml
├── traceability-matrix.yaml
└── evaluation-report.md
```

## 五、交给编码 Agent 的开发任务：Game Spec Generator Skill — V1

### 1. 项目目标

开发独立 Skill：`game-spec-generator`，将原始游戏 PRD 转换为四层工程规格（GDD / PRD / Interaction / Interaction Contract）。本次以 `PrdGameSkill/examples/mahjong/game-spec/source/` 下的卡五星麻将原始需求作为测试输入。只开发 Skill 和测试产物，不修改 PrdGameSkill 现有业务代码。

### 2. 输入数据

读取：

- `01-基础规则.md`、`02-游戏流程.md`、`03-打牌操作.md`、`04-番型.md`、`05-胡牌类型.md`、`06-结算.md`、`07-配置.md`、`08-UI交互.md`
- `source-map.json`、`_map_base.json`、`_map_fan.json`、`_map_husettle.json`、`_map_ops.json`

读取相关需求附图及说明。不能读取的图片或缺失资料必须明确标记，不得推测。

现有 IR、open-questions.json、decision-log.json 等只能作为独立评测参考，不得作为第一轮生成的主要输入。原始 Source 只读。

### 3. Skill 目录

见「四、Skill 目录结构」。

### 4. 执行工作流

**Step 1：Source Analysis**

提取原始需求中的全部事实。每条记录至少包含：唯一 ID、原始文件、章节和行号、原始内容、事实类型、是否为推导、是否存在歧义、是否存在冲突、依赖关系。

区分：EXPLICIT（原文明示）/ DERIVED（根据原文推导）/ UNKNOWN（原文没有定义）/ CONFLICT（不同位置存在冲突）。不得将 DERIVED 自动升级为 EXPLICIT。

**Step 2：Generate GDD**

覆盖：游戏概述、核心玩法、游戏循环、玩家与游戏实体、基础规则、操作规则、番型和胡牌条件、结算规则、数值与配置、特殊规则、规则优先级。

**Step 3：Generate PRD**

覆盖：产品定位和范围、功能模块、玩家使用场景、功能需求、业务流程、配置功能、异常场景、验收标准、与 GDD 的关联。

**Step 4：Generate Interaction**

覆盖：页面清单、全局导航、全局 UI 状态、页面布局、控件和操作、显示与隐藏条件、操作前置条件、成功和失败反馈、动画与时序、弹窗和 Toast、页面间流程、UI 验收标准。

充分复用原始 `08-UI交互.md` 的内容，不要重复发明已有交互。

**Step 5：Generate Interaction Contract**

使用 YAML。每条契约至少包含：

- contract_id
- related_requirement_ids
- trigger
- preconditions
- guards
- state_transition
- data_effects
- ui_effects
- failure_handling
- timeout_handling
- mutual_exclusion
- test_scenarios
- source_references
- confirmation_status

区分业务行为和具体技术实现。不确定的事件、状态和数据变化不得擅自补全。

**Step 6：Traceability**

生成 `traceability-matrix.yaml`，建立 Source → GDD → PRD → Interaction → Contract → Test 链路。支持：一对多关联、多对一关联、缺失关联、孤立需求、待确认依赖。

**Step 7：Quality Review**

检查：1) 原始需求覆盖情况；2) 规则是否丢失；3) 是否产生未经授权的推导；4) 文档之间是否冲突；5) 交互是否缺少状态和反馈；6) Contract 是否缺少前置条件和异常；7) 是否存在无法追溯的内容。

### 5. 输出目录

`examples/mahjong/spec-generation/`（见「四」）。不得覆盖现有 game-spec 和 source。

### 6. 评测标准

| 指标           | 权重  |
| ------------ | --- |
| 原始需求覆盖率      | 25% |
| 规则准确性        | 25% |
| 文档职责分离       | 15% |
| 交互完整性        | 15% |
| Contract 完整性 | 10% |
| 来源追溯率        | 10% |

硬性门禁：

- 不允许虚构游戏规则。
- 不允许把未确认事项标记为已确认。
- 不允许丢失关键结算公式。
- 不允许关键规则出现未解释的文档冲突。
- 不允许 Contract 与 GDD 规则冲突。

评测时与现有 PrdGameSkill IR 和 31 项待确认问题进行独立对照。

### 7. 实施约束

- 第一版以 Prompt、Markdown 模板和 Skill 工作流为主。
- 不急于开发复杂脚本。
- 不急于接入 HTML 工作台。
- 不修改 PrdGameSkill。
- 不使用现有 IR 作为主要生成输入。
- 每一阶段保留中间结果。
- 最后输出详细的质量评测报告。

### 8. 最终验收目标

完成一次完整的：原始需求 → GDD → PRD → Interaction → Interaction Contract。

重点回答：

1. 四份文档的职责划分是否合理？
2. 原始需求是否有信息丢失？
3. AI 是否能够正确识别歧义和冲突？
4. Contract 是否足够支持后续 AI 编程？
5. 哪些工作适合交给 AI，哪些必须人工确认？

根据实测结果决定是否将 Skill 集成进 PrdGameSkill。

## 六、特别关注的三个结果

不要只看生成出来的文档是否漂亮。

**评测一：需求有没有丢失？**
例如，原始需求有 84 张牌、三种杠、十四种番型、复杂的结算公式，最终是否都能找到对应章节？

**评测二：AI 有没有擅自做决定？**
例如之前的 OQ-013～OQ-016，涉及字分、番型叠加和亮倒赔付口径。AI 必须保留未决状态。

**评测三：Contract 能不能真正用于开发？**
例如碰、杠、胡的操作优先级，超时托管、抢杠胡、多人同时操作等场景，是否有完整的状态和异常处理定义？

## 最终建议

先用这个 Skill 跑通卡五星，暂时不要开发 HTML，也不要急着集成 IR。

先看四份文档的质量。如果这套生成方式确实能把原始需求转化成开发人员可以直接使用的规格，再把它接入现有 PrdGameSkill，那时才有必要设计统一的 IR 和文档同步机制。
