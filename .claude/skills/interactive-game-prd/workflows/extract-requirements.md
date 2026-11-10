# Workflow: extract-requirements

> 模式：Create / Update 核心步骤。目的：从原始 PRD 抽取需求并结构化为 IR。

## 触发方式

- Create：parse-prd 完成后。
- Update：用户提供增量需求时（只处理增量，追加 decision-log）。

## 输入

- 原始 PRD 与结构盘点记录
- `references/game-prd-format.md`（ID 规范、来源三分类）
- `templates/` 模板

## 步骤（需求文档 5.2 节五步）

1. **材料解析**：章节、标题层级、表格、图片引用、数值配置、规则定义。
2. **领域抽取**：功能 / 玩法规则 / 状态 / 操作 / 数值概率 / UI 页面 / 页面交互 / 异常流程 / 验收条件。
3. **需求分类**：明确需求（source.kind=original）、隐含需求与 AI 建议（kind=derived + basis）、待确认问题（open-questions）、冲突需求（reviews 报告）。AI 推测内容一律 status=proposed，不得混入原始需求。
4. **结构化转换**：按模板生成 IR 文件，分配稳定 ID，逐条填写 source。
5. **每批完成后跑 `validate-ir`**，保持 IR 始终可校验。

## 质量门

- validate-ir errors=0。
- 每条 original 来源有非空 quote；每条 derived 有 basis 与关联需求。

## 输出

- `game-spec/requirements/`、`ui/`、`data/`、`tests/`、`source/source-map.json`

## 禁止事项

- 禁止虚构原始 PRD 没有定义的规则；找不到依据的内容登记 open question。
- 禁止给需求条目伪造 original 来源。
- 禁止修改已 approved 的需求（那是 Update + 人工确认的事）。
