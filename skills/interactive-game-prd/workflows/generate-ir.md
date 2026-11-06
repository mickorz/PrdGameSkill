# Workflow: generate-ir

> 模式：Create / Generate。目的：将抽取结果固化为结构化 IR 并冻结 Golden Sample。

## 触发方式

extract-requirements + review-requirements 完成后；或 Generate 模式（重建 IR 索引）。

## 输入

- 抽取产物、审查报告、人工确认决策（decision-log）

## 步骤

1. 人工确认核心规则：产出确认清单（proposed + open 问题），用户逐条决定采纳 / 修改 / 否决 / 挂起。
2. 确认结果写回 IR：status → approved/rejected，authority 按用户口径设 fixed/delegated；每次变更追加 `reviews/decision-log.json`。
3. 补全全部 ui_refs / test_refs / dependencies 双向引用。
4. 跑 `validate-ir` 至 errors=0。
5. 冻结：记录 manifest.version 与 game-spec 整体 SHA-256 到 `FROZEN.md`。冻结后修改必须走 Update 流程。

## 质量门

- validate-ir PASS。
- 核心规则清单无遗留 open（或明确记录为已知未决并标记 HTML 中显示未确认标识）。
- decision-log 与 IR 状态一致。

## 输出

- 可冻结的 `game-spec/` + `FROZEN.md`。

## 禁止事项

- 未经人工确认不得把任何需求置为 approved。
- 不得在 decision-log 伪造决策人。
