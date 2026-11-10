# Workflow: apply-decisions

> 模式：Decision。目的：把人工裁决落盘为不可丢失的历史，并保持三方数据（decision-log / open-questions / approval-state）一致。属于 Game Decision Workbench（P6-A 数据层）。

## 触发方式

用户逐条或批量给出裁决（「OQ-013：采纳」「OQ-013：修改为 <口径>」「OQ-013：否决」「OQ-013：挂起」）；或 Decision Workbench 页面导出的裁决文件。

## 输入

- `game-spec/reviews/open-questions.json`（裁决对象）
- `game-spec/reviews/decision-log.json`（历史追加，永不覆盖旧条目）
- 人工裁决清单（对话文本或 decisions.json）

## 步骤

1. **整理裁决记录**：把每条人工裁决转成 decision.schema.json 结构。要点：
   - `reviewer` 固定为 `human`；`decision_status` ∈ approved / rejected / deferred；
   - `outcome` 细分 adopted / modified；`final_decision` 携带人工确认的最终口径（如公式、布尔、数值）；
   - 关联/重复问题放进 `related_question_ids`，一次裁决同批生效；
   - 重新裁决必须 `supersedes` 指向当前有效 decision_id（历史保留，最新有效）；
   - 涉及 IR 状态变化时写 `requirement_updates`（如 proposed->approved）。
2. **预演**：`node scripts/apply-decisions.mjs <game-spec> decisions.json --dry-run --json`，向用户展示将写入的内容与校验结果。
3. **确认落盘**：去掉 `--dry-run` 正式执行。
4. **审计**：`node scripts/validate-decisions.mjs <game-spec>`，必须 pass；再跑 `validate-ir` 确认状态流转合法。
5. **提交**：裁决落盘结果与 game-spec 一并 git commit（变更管理走 Git + Decision Log）。

## 红线

1. **AI 不允许代替人工提交正式裁决**：没有用户明确表态的问题，禁止写入 decision-log；`reviewer` 字段恒为 `human`。
2. **AI 推导口径不得批量默认批准**，尤其结算、番型、赔付类问题。
3. decision-log 只追加不修改不删除；翻案走 `supersedes` 新记录。
4. 裁决状态（decision）与需求状态（requirement status）两套体系不混用。
5. 校验失败（apply / validate-decisions / validate-ir 任一）不得提交。

## 输出

- `reviews/decision-log.json`（追加）、`reviews/open-questions.json`（状态升级 + decision_id 回链）、`reviews/approval-state.json`（进度与 last_position）。

## 质量门

- validate-decisions PASS；validate-ir PASS；进度数字三方一致。
