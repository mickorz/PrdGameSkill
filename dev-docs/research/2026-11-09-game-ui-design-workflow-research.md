# game-ui-design-workflow 调研笔记（REF-007 深入研究）

> 日期：2026-11-09 | 仓库：thirdparties/game-ui-design-workflow（MIT）| 目的：为 game-spec-generator（GSG-V1）提供结构与方法参照

## 一、这个库是怎么做的

### 1. 总体架构：spec-kit 四文档 + 契约目录 + 资产流水线

```
specs/<project-id>/
├── spec.md / research.md / plan.md / quickstart.md   # Spec-Kit 风格项目事实
├── gdd.md            # 游戏策划方案（定位/核心循环/系统清单/经济养成）
├── prd.md            # 产品需求（P0/P1/P2 + 验收标准）
├── interaction.md    # UI 交互逻辑（导航/主流程/控件行为/状态机/跨页链路）
├── contracts/        # 7 类机器可读契约 YAML
│   ├── style-contract.yaml      # 设计令牌
│   ├── screen-contract.yaml     # 屏幕清单（布局分区/组件/状态/edge_cases）
│   ├── component-contract.yaml  # 组件契约
│   ├── sprite-contract.yaml     # 雪碧图切片
│   ├── atlas-contract.yaml      # 图集
│   ├── asset-manifest.yaml      # 资产清单
│   └── export-contract.yaml     # 引擎交付（unity/godot/cocos）
├── assets/ pages/ sprites/ atlases/ packages/ exports/
├── mappings/         # 语义命名映射
└── prompts/          # 页面/组件生图提示词（引用契约字段）
```

与我们 GSG-V1 的四层规格（GDD/PRD/Interaction/Interaction-Contract）**完全同构**，且它多走了资产流水线（生图→切图→Atlas→引擎 JSON）。

### 2. 七个关键机制（值得吸收）

| 机制 | 做法 | 对 GSG-V1 的启发 |
|---|---|---|
| 项目事实落盘 | 一切写入 `specs/<id>/`，不留在对话里 | 产物进 `examples/mahjong/spec-generation/` |
| 分步技能 + 总控路由 | `game-ui-workflow` 总控按请求路由到 7 个子技能，最小充分路径 | GSG 按七步流水线组织 SKILL.md |
| 文档状态门禁 | 每份文档头部 `文档状态.status: draft→approved`；未批准不得进入下一步；跳过门禁必须记录原因 | GSG 每步产物同样带状态头；未决问题保持 pending-human |
| 固定输出格式 | 每步结束输出：当前步骤/完成状态/本步产物/需要你检查/可选操作/进入下一步的条件/下一步调用文本 | GSG 各步采用同样收尾格式 |
| 初始化脚本 | `init_project.py` 从 templates 复制脚手架，`{{PROJECT_ID}}` 占位替换，`--force` 覆盖但永不删生成资产 | GSG `init_project.py` 同款，脚手架改为 spec-generation 七文件 |
| 校验脚本 | `validate_project.py`（820 行）校验文档状态头、契约 schema、PNG 尺寸、切片、Atlas、导出清单 | 其文档/契约部分思想由 GSG `validate_docs.py`（轻量版）承接；PNG/Atlas 校验与四层规格无关，不复制 |
| 完整实例 | `specs/guofeng-card-rpg` 与 `examples/factory-v2-shop` 是走完全链路的真实产物 | 作为 GSG 评测时对照的「格式参考答案」 |

### 3. 四文档模板的具体设计（templates/spec-kit/）

- `gdd.md`（79 行）：文档状态头 → 一句话定位 → 目标用户与卖点 → 核心循环表 → 系统清单（must-have/genre-specific/optional）→ 资源经济（明确禁止假装有服务端公式）→ 养成进度 → 世界观最小集 → 风险约束 → 与下游文档关系
- `prd.md`（96 行）：概述（含非目标）→ 用户场景表 → 功能需求按 P0/P1/P2 表格（每条带对应页面与验收标准）→ 信息架构 → 交付范围 → 验收清单
- `interaction.md`（94 行）：全局交互原则 → 全局导航表 → 全局状态表 → 每页模板（目的/进入来源/离开去向/主流程/控件与行为表/状态机表/弹窗确认/视觉约束）→ 跨页链路 → 验收清单
- `plan.md` / `research.md` / `spec.md` / `tasks.md` / `quickstart.md`：Spec-Kit 风格的辅助文档

### 4. 契约模板设计（templates/contracts/screen-contract.yaml 等）

YAML 优先，字段扁平、枚举明确（priority: must-have、status: planned、states: [default, loading, error]），头部带 `schema_version + project_id`。这与我们 Interaction-Contract 的 14 字段设计（contract_id/trigger/preconditions/guards/state_transition/data_effects/ui_effects/failure_handling/timeout_handling/mutual_exclusion/test_scenarios/source_references/confirmation_status）同构，我们多了 guards/timeout/mutual_exclusion（游戏规则更强），它多了视觉/资产字段（生图域）。

## 二、移植清单（MIT，保留版权声明）

| 来源 | 目标 | 处理方式 |
|---|---|---|
| `templates/spec-kit/gdd.md` | `skills/game-spec-generator/templates/GDD.template.md` | 复制 + 增加事实溯源（SRC-xxx 引用）与待确认标记要求 |
| `templates/spec-kit/prd.md` | `.../templates/PRD.template.md` | 同上 |
| `templates/spec-kit/interaction.md` | `.../templates/Interaction.template.md` | 同上 + 强调复用原始 08-UI交互.md |
| （无对应，新增） | `.../templates/Interaction-Contract.template.yaml` | 按 GSG-V1 14 字段新建，风格参照 screen-contract.yaml |
| （新增） | `.../templates/Source-Analysis.template.md`、`Traceability-Matrix.template.yaml`、`Evaluation-Report.template.md` | 按 GSG-V1 计划新建 |
| `scripts/init_project.py` | `skills/game-spec-generator/scripts/init_project.py` | 复制改造：脚手架改为 spec-generation 七文件 |
| `scripts/validate_project.py` | `skills/game-spec-generator/scripts/validate_docs.py` | **不整体复制**（820 行主要是 PNG/Atlas/切片校验，与文档规格无关）；新写轻量文档校验（状态头/契约必填字段/追溯可解析） |
| `skills/game-ui-workflow/SKILL.md` 的门禁与固定输出格式 | `skills/game-spec-generator/SKILL.md` | 思想移植，流程改为七步 |
| `specs/guofeng-card-rpg/`（完整实例） | evals 评测时的格式对照参考（不复制文件，按需查阅） | 只读 |

## 三、与 PrdGameSkill interactive-game-prd 的差异（评测对照时的看点）

| 维度 | interactive-game-prd | game-ui-design-workflow |
|---|---|---|
| 产物 | Game Requirement IR（YAML，131 条结构化条目）+ HTML PRD + 模拟器 | 四份 Markdown 文档 + 契约 YAML + 视觉资产 |
| 事实溯源 | source-map.json 锚点 + quote_hash（SHA-1 校验） | source-map 引用，无哈希校验 |
| 待确认机制 | open-questions.json + decision-log + 人工裁决工作台 | 文档状态 draft/approved 门禁 |
| 自动校验 | validate-ir/validate-html/validate-output（Node） | validate_project.py（Python） |
| 生成输入 | 原始 PRD（GSG-V1 与其一致） | 对话需求（面向从零构思的新游戏） |

GSG-V1 用卡五星（已有成熟 PRD 的真实项目）测试，正好补上 game-ui-design-workflow 只面向「从零构思」场景的空档。
