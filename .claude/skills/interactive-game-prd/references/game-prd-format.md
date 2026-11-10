# Game Requirement IR 格式规范

> 版本：v1.0（对应需求文档 v1.1）  
> 日期：2026-11-06  
> 本文档是 IR 的唯一权威定义：目录结构、manifest 字段、ID 规范、来源溯源、状态与授权机制、引用规则。Schema 文件（`../schemas/`）与本规范同步维护，冲突时以本规范为准并修订 Schema。

## 1. game-spec 目录结构

每个游戏一份 `game-spec/`，顶层目录固定如下：

```text
game-spec/
├── manifest.yaml               游戏清单（必需）
├── source/
│   ├── original-prd.md         原始 PRD（只读，禁止改写）
│   └── source-map.json         需求溯源映射（必需）
├── game/
│   ├── overview.yaml           游戏概述
│   ├── core-loop.yaml          核心玩法循环
│   └── glossary.yaml           术语表（领域术语先进术语表再被引用）
├── requirements/
│   ├── features/               功能需求（GAME-FR）
│   ├── rules/                  业务规则（GAME-RULE）
│   ├── states/                 状态机（GAME-STATE）
│   └── constraints/            非功能需求与约束（GAME-NFR）
├── ui/
│   ├── navigation.yaml         页面导航关系
│   ├── pages/                  UI 页面（GAME-UI）
│   ├── components/             UI 组件（GAME-COMP）
│   └── interactions/           交互事件（GAME-EVENT）
├── data/
│   ├── entities.yaml           实体定义
│   ├── configs/                数值配置（GAME-CFG）
│   └── enums.yaml              枚举定义
├── flows/                      业务流程（每流程一个 yaml）
├── tests/
│   ├── scenarios/              测试场景
│   └── cases/                  测试用例（GAME-TC）
├── reviews/
│   ├── completeness.json       完整性审查报告
│   ├── consistency.json        一致性审查报告
│   ├── open-questions.json     未决问题
│   └── decision-log.json       人工决策记录
└── output/                     生成产物（html/、reports/），不入 git 由 .gitignore 管理
```

放什么、不放什么：

- `requirements/` 只放需求条目，每文件一个需求对象；缺失需求、冲突问题放 `reviews/`，不登记为需求。
- `output/` 只放生成产物，任何手工内容不得写入。
- 除上述目录外不得新建顶层目录；不够用时先改本规范再扩目录。

## 2. manifest.yaml

```yaml
format: GAME-SPEC/1          # 格式自描述头，格式变更必须升版本
ir_version: 1.0.0            # IR 规范版本（对应本文档版本）
game_name: ""
game_version: ""
created_at: ""               # YYYY-MM-DD
updated_at: ""
source_files:                # 原始材料清单
  - file: source/original-prd.md
    sha256: ""
    received_at: ""
entry_points:                # 入口页面 ID
  - ""
stats:                      # 构建时统计，手工维护可留空
  requirements: 0
  ui_pages: 0
  test_cases: 0
```

## 3. 需求 ID 规范

| type | ID 前缀 | 存放目录 | 示例 |
|---|---|---|---|
| game_feature | GAME-FR | requirements/features/ | GAME-FR-001 |
| game_rule | GAME-RULE | requirements/rules/ | GAME-RULE-001 |
| state | GAME-STATE | requirements/states/ | GAME-STATE-001 |
| nfr | GAME-NFR | requirements/constraints/ | GAME-NFR-001 |
| ui_page | GAME-UI | ui/pages/ | GAME-UI-001 |
| ui_component | GAME-COMP | ui/components/ | GAME-COMP-001 |
| ui_event | GAME-EVENT | ui/interactions/ | GAME-EVENT-001 |
| config | GAME-CFG | data/configs/ | GAME-CFG-001 |
| test_case | GAME-TC | tests/cases/ | GAME-TC-001 |
| task | GAME-TASK | 生成产物，不落盘 | GAME-TASK-001 |

规则：

1. ID 格式固定为 `前缀-三位数字`，如 `GAME-RULE-001`；三位不够用时升到四位，不允许其他格式。
2. 编号递增分配，新 ID 取该前缀当前最大值 +1。
3. ID 一经分配永不改变；需求删除用 `status: deprecated` 保留文件，不物理删除、不回收编号。
4. 所有跨条目关联一律用 ID 引用，禁止用标题或名称当关联键。

## 4. 需求条目标准字段

见 `../templates/requirement.yaml`。字段语义（需求文档 4.4）：

- `preconditions`：执行前提；`business_rules`：业务规则；`normal_flow` / `exception_flow`：正常与异常流程；`state_transitions`：状态变化（引用 GAME-STATE）。
- `ui_refs` / `test_refs` / `dependencies`：全部为 ID 引用数组。
- `open_questions`：本条需求遗留的未决问题，同步登记到 `reviews/open-questions.json`。

## 5. 来源溯源（source 三分类）

每条需求的 `source.kind` 必为以下三类之一，各 kind 必填字段：

| kind | 适用 | 必填字段 |
|---|---|---|
| original | 从原文直接提取 | document、section、quote（非空原文引用） |
| derived | 隐含需求、AI 建议、冲突分析、遗漏识别 | basis（推导依据）、related_requirements（关联原始需求 ID，至少 1 条） |
| human_decision | 人工确认产生或修改 | decision_log_ref（指向 decision-log 条目 ID）、decided_by |

约束：

- 禁止伪造来源：找不到依据的内容要么登记 open question，要么标 derived 并写清 basis，不得编造 original 引用。
- derived 需求（AI 建议）默认 `status: proposed`，人工确认后才可 approved。

### source-map.json 溯源映射

```json
[
  {
    "requirement_id": "GAME-RULE-001",
    "anchors": [
      {
        "file": "source/original-prd.md",
        "heading": "第三章 出牌规则",
        "line_start": 42,
        "line_end": 47,
        "quote_hash": "sha1:..."
      }
    ]
  }
]
```

- 定位粒度到「标题 + 行区间」，保证能回到原文段落。
- `quote_hash` 为引用文本的 sha1，用于检测原始 PRD 变动后溯源失效；validate-ir 校验 anchors 指向的文件与行区间存在。

## 6. 需求状态与授权

### status（需求确认状态）

| 状态 | 含义 | AI 行为 |
|---|---|---|
| proposed | AI 提取或建议，尚未确认 | 可展示，不得作为确定规则 |
| approved | 人工确认 | 可作为正式规格 |
| rejected | 人工否决 | 不得进入正式规格 |
| deprecated | 已废弃 | 保留历史，不再生效 |

### 合法状态流转

```text
proposed  -> approved
proposed  -> rejected
rejected  -> proposed      （可重新提取或修正后再次提交）
approved  -> deprecated
rejected  -> deprecated
```

禁止流转：`approved -> proposed`（确认过的规则只能废弃，不能退回未确认）；`deprecated -> 任何状态`。

### authority（决策权限，与 status 正交）

| authority | 含义 |
|---|---|
| fixed | 必须遵循的固定规则 |
| delegated | 可在约束内由 AI 决定 |
| open | 需要人工补充确认 |

约束：

- `authority` 只能由人工确认动作改变；AI 只能在 `delegated` 范围内决策，不得把 open 改成 delegated/fixed。
- 所有状态与授权变更必须记录到 `reviews/decision-log.json`：

```json
{
  "id": "DECISION-001",
  "requirement_id": "GAME-RULE-001",
  "field": "status",
  "from": "proposed",
  "to": "approved",
  "rationale": "用户确认出牌规则",
  "decided_by": "user",
  "date": "2026-11-06"
}
```

## 7. 引用与单一事实源

- 一个业务事实只在一处定义：规则在 requirement 定义，UI Spec 与 Test Spec 只引用 ID。
- 禁止：UI Spec 自带一套规则数值；Test Spec 使用与 Rule 不同的条件；HTML Demo 自行推断规则。
- validate-ir 强制校验全部 ID 引用存在（悬空引用即 error）。
