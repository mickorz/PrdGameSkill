# 需求全量检查矩阵

## 覆盖统计

| 指标 | 数值 |
|---|---|
| 需求点总数 | 4 |
| 规则原子检查点总数 | 4（适用 4） |
| 已完成检查 | 2（检查完成率 50.0%） |
| 已通过 | 1（已检查规则通过率 50.0%，分母=已完成检查） |
| 规则完整通过率 | 25.0%（1/4，以全部适用规则为分母） |
| 规则七状态分布 | 完整通过 1 / 部分满足 0 / 冲突 0 / 需求缺失 0 / 未验证 3 / 待确认 0 / 不适用 0 |
| 关联问题 | 2 |
| 失败检查组 | group-2（Bug覆盖） |

> 口径说明：检查完成率 ≠ 规则通过率；未完成检查的规则点状态为未验证，不计入通过率分母。

## 全量需求追踪矩阵

| 需求点 | 标题 | 来源 | 关联规则 | 检查结果 | 关联问题 |
|---|---|---|---|---|---|
| REQ-001 | 开局发牌 | E:/WorkProjects/PrdGameSkill/examples/game-prd-check-workflow/rtm-mock/input/mock-prd.md §2.1 | R01-001、R01-999 | 未验证 |  |
| REQ-002 | 碰牌条件 | E:/WorkProjects/PrdGameSkill/examples/game-prd-check-workflow/rtm-mock/input/mock-prd.md §2.2 | R01-002 | 通过 | PRD-002 |
| REQ-003 | 碰牌广播（文本不一致样例） | E:/WorkProjects/PrdGameSkill/examples/game-prd-check-workflow/rtm-mock/input/mock-prd.md §2.2 | R01-002 | 未验证 | PRD-001 |
| REQ-004 | 无效行号样例 | E:/WorkProjects/PrdGameSkill/examples/game-prd-check-workflow/rtm-mock/input/mock-prd.md | R02-404 | 未验证 |  |

## Rule 覆盖矩阵

| 规则点 | 来源 | 内容摘要 | 对应需求 | 检查结果 |
|---|---|---|---|---|
| R01-001 | E:/WorkProjects/PrdGameSkill/examples/game-prd-check-workflow/rtm-mock/rules/mock-rule.md §1 | 发牌规则 | REQ-001 | 通过 |
| R01-002 | E:/WorkProjects/PrdGameSkill/examples/game-prd-check-workflow/rtm-mock/rules/mock-rule.md §2 | 碰牌规则 | REQ-002、REQ-003 | 冲突 |
| R02-003 | E:/WorkProjects/PrdGameSkill/examples/game-prd-check-workflow/rtm-mock/rules/mock-rule.md §2 | 不适用规则样例 |  | 未验证（无对应需求，待确认） |
| R02-404 | E:/WorkProjects/PrdGameSkill/examples/game-prd-check-workflow/rtm-mock/rules/mock-rule.md §2 | 检查组失败的规则点 | REQ-004 | 未验证 |
