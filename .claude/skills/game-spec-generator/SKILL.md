---
name: game-spec-generator
description: >-
  把原始游戏需求转换成四层工程规格：GDD（怎么玩）、PRD（做什么）、Interaction（如何操作）、
  Interaction-Contract（系统如何响应，平台无关 YAML 契约）。含需求事实分析、全链路追溯矩阵、
  质量评测报告。适用于已有原始 PRD 文档的游戏项目规格化。Use when 用户要求 生成游戏规格、
  GDD、PRD、交互规格、交互契约、spec-generation、需求转四层文档.
---

# Game Spec Generator（GSG）

把一份原始游戏 PRD 转换为四层工程规格：

| 层 | 文件 | 回答的问题 |
|---|---|---|
| GDD | `GDD.md` | 游戏怎么玩？（玩法、规则、数值、结算） |
| PRD | `PRD.md` | 产品要做什么？（功能、场景、流程、验收） |
| Interaction | `Interaction.md` | 玩家如何操作？（页面、控件、交互、反馈、状态） |
| Interaction Contract | `Interaction-Contract.yaml` | 系统如何响应？（事件、前置条件、状态转移、数据影响、异常） |

方法论与模板改编自 game-ui-design-workflow（MIT License，https://github.com/mickorz/game-ui-design-workflow），详见 `dev-docs/research/2026-11-09-game-ui-design-workflow-research.md`。

## 红线（任一违反即产物不合格）

1. **禁止虚构游戏规则**。原文、上游文档没有定义的，标 UNKNOWN / pending-human，不得补全。
2. **禁止把未确认事项标记为已确认**。文档 status=approved 与 confirmation_status=confirmed-human 只能由人工标记。
3. **禁止丢失关键规则**（结算公式、番型全量、操作优先级必须逐条照录）。
4. **禁止把 DERIVED 升级为 EXPLICIT**；推导必须写依据。
5. **禁止读取评测对照数据作为生成输入**（当前为卡五星：现有 IR、open-questions.json、decision-log.json 仅 Step 7 评测对照用）。
6. 原始 Source 只读；产物只写入 `examples/<game>/spec-generation/`。
7. 依据为截图的事实，必须标注「AI 无法读取截图数值，需人工提供文本补充」，并把附图引用登记在 source-analysis.md 附图表。

## 七步工作流

每步开始时说明：当前步骤与目标、读取的输入、将产生的文件、停止条件。
每步结束时固定输出：当前步骤 / 完成状态 / 本步产物 / 需要你检查 / 可选操作 / 进入下一步的条件 / 可直接复制的下一步调用文本。

```text
进度:
- [ ] 1. Source Analysis   需求事实清单（EXPLICIT/DERIVED/UNKNOWN/CONFLICT）
- [ ] 2. Generate GDD      玩法规则层
- [ ] 3. Generate PRD      产品功能层
- [ ] 4. Generate Interaction  交互层（复用原始 UI 需求，不重复发明）
- [ ] 5. Generate Interaction Contract  事件与状态转移契约
- [ ] 6. Traceability      全链路追溯矩阵
- [ ] 7. Quality Review    覆盖/丢失/越权推导/冲突/完整性检查 + 评测报告
```

### Step 0：初始化工作区

```bash
python .claude/skills/game-spec-generator/scripts/init_project.py <game-id>
# 生成 examples/<game-id>/spec-generation/ 七份脚手架文件
```

### Step 1：Source Analysis

逐份读取原始需求（含 source-map、_map_*.json 锚点与需求附图说明），产出 `source-analysis.md` 事实清单。
格式：`references/` 下各格式规范 + `templates/Source-Analysis.template.md`。
事实分类：EXPLICIT（原文明示）/ DERIVED（推导，必须写依据）/ UNKNOWN（原文未定义）/ CONFLICT（冲突，双源并列）。
停止条件：事实清单完成，等待用户抽查确认后进入第 2 步。

### Step 2-5：逐层生成

按 `references/gdd-format.md`、`prd-format.md`、`interaction-format.md`、`interaction-contract-format.md` 逐层生成，每层引用上层 ID 与 SRC 事实。层与层之间停顿等用户确认；用户明确要求连续生成时保留每层草稿状态（status=draft）。

### Step 6：Traceability

按 `references/traceability-rules.md` 生成 `traceability-matrix.yaml`（gaps 只登记不修复）。

### Step 7：Quality Review

按 `evals/evaluation-criteria.md` 检查七项（覆盖/丢失/越权推导/冲突/交互完整性/Contract 完整性/可追溯），产出 `evaluation-report.md`；先运行：

```bash
python .claude/skills/game-spec-generator/scripts/validate_docs.py examples/<game>/spec-generation
```

评测对照（如卡五星）：与现有 IR + 31 项 OQ 独立对照，方法见 `evals/mahjong-benchmark.md`。

## 目录结构

```text
game-spec-generator/
├── SKILL.md
├── references/          # 五份格式规范
├── templates/           # 七份产物模板（改编自 game-ui-design-workflow，MIT）
├── scripts/
│   ├── init_project.py  # 脚手架（改编自上游 MIT 脚本）
│   └── validate_docs.py # 轻量文档校验（状态头/契约字段/追溯摘要）
└── evals/               # 评测标准与卡五星基准
```

## 与 interactive-game-prd 的关系

独立 Skill，不修改 interactive-game-prd 的任何文件。产物目录独立（spec-generation/），互不覆盖。评测通过后是否合并 IR 体系，由评测报告结论决定。
