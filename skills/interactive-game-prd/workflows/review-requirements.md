# Workflow: review-requirements

> 模式：Review。目的：检查需求完整性与一致性，产出问题报告。只读，不修改任何需求。

## 触发方式

Create 抽取完成后；或用户主动要求 Review。

## 输入

- `game-spec/` 全量
- validate-ir 报告（Scripts 层先跑）

## 步骤

1. **确定性检查（Scripts 层）**：运行 validate-ir，报告附入审查结论。
2. **AI 语义检查（需求文档 9.3 节）**：
   - 是否遗漏关键页面 / 规则；
   - 不同需求之间是否存在隐性冲突；
   - 异常流程是否覆盖；
   - 可测试性：每条核心规则能否建立验收条件；
   - 边界条件：极端情况是否覆盖。
3. 按需求文档 5.3 节格式登记问题（REVIEW-XXX、severity、related_requirements、evidence、suggestion）。
4. 写入 `game-spec/reviews/completeness.json` 与 `consistency.json`；未决问题写入 `open-questions.json`。
5. 判定是否存在阻塞项（需求文档 5.4 审批 Gate）：核心规则冲突 / 关键规则 open / 需求无来源 / 状态转换无法解释 / 核心流程缺验收条件。

## 质量门

- 三份报告齐全；critical/high 问题逐条有 evidence。

## 输出

- `reviews/completeness.json`、`reviews/consistency.json`、`reviews/open-questions.json` + 人工确认清单（供决策）。

## 禁止事项

- 不修改原始需求与 IR 条目本身。
- 不把 AI 推测当成事实写入报告结论。
