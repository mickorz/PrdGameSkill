# Interaction-Contract 格式规范

> 模板：`templates/Interaction-Contract.template.yaml`

## 职责

回答「系统如何响应」。把交互转换为机器可读的业务事件与状态转移契约，供后续 AI 编程与测试直接消费。

## 每条契约的 14 个字段

| 字段 | 含义 |
|---|---|
| contract_id | CT-xxx 唯一 ID |
| related_requirement_ids | 关联 PRD-xxx / GDD-Rxxx / INT-xxx |
| trigger | 触发（玩家点击「碰」、超时、系统事件） |
| preconditions | 前置条件（轮到该玩家、牌权成立） |
| guards | 守卫（优先级不满足则拒绝执行） |
| state_transition | 状态机 from → to |
| data_effects | 数据影响（手牌变化、副露区、分数） |
| ui_effects | UI 影响（按钮置灰、弹窗、音效占位） |
| failure_handling | 失败处理（提示文案、回滚） |
| timeout_handling | 超时处理（托管、自动过） |
| mutual_exclusion | 互斥规则（碰/杠/胡同时可触发时的优先级） |
| test_scenarios | 可推导的测试场景 |
| source_references | SRC-xxx 事实引用 |
| confirmation_status | draft / pending-human / confirmed-human |

## 硬性规则

1. **平台无关**：只定义业务行为，不绑定 Unity / Cocos / FairyGUI / 具体组件库；不出现引擎 API 名。
2. **区分业务行为与技术实现**：如「碰牌后手牌移除两张同牌、副露区增加一组」是业务行为；「调用 Hand.RemoveTile()」是实现，禁止出现。
3. **不确定不得补全**：事件、状态、数据变化原文或上游文档没有定义的，留空并标 pending-human。
4. **confirmation_status=confirmed-human 必须由人工标记**，AI 不得自行升级。
5. Contract 之间、Contract 与 GDD 规则之间不得冲突；互斥与优先级必须显式写 mutual_exclusion。
