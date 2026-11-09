# 产品需求文档（PRD）

<!--
  模板改编自 game-ui-design-workflow (MIT License)
  https://github.com/mickorz/game-ui-design-workflow templates/spec-kit/prd.md
  改编说明：增加「事实溯源」要求与 GDD 关联列。
-->

## 文档状态

- status: draft
- version: 0.1
- owner:
- last_updated:

> status 只允许 draft / pending-human / approved。approved 必须由人工确认，AI 不得自行标记。

## 事实溯源汇总

- 引用事实：SRC-xxx
- 推导内容（DERIVED）：
- 待确认（UNKNOWN/CONFLICT）：

## 概述

- 项目 ID：`{{PROJECT_ID}}`
- 产品目标：
- 成功指标（可验证）：
  1.
  2.
  3.
- 非目标（明确不做）：

## 用户与场景

| 角色 | 目标 | 关键场景 | 来源事实 |
|---|---|---|---|
| | | | SRC-xxx |

## 功能需求

按优先级列出。每条需求必须可被页面或组件承接，并关联 GDD 规则。

### P0（必须）

| ID | 需求 | 对应页面/系统 | 关联 GDD 规则 | 验收标准 | 来源事实 |
|---|---|---|---|---|---|
| PRD-001 | | | GDD-Rxxx | | SRC-xxx |

### P1（重要）

| ID | 需求 | 对应页面/系统 | 关联 GDD 规则 | 验收标准 | 来源事实 |
|---|---|---|---|---|---|
| PRD-101 | | | | | SRC-xxx |

### P2（可选）

| ID | 需求 | 对应页面/系统 | 关联 GDD 规则 | 验收标准 | 来源事实 |
|---|---|---|---|---|---|
| PRD-201 | | | | | SRC-xxx |

## 业务流程

<!-- 端到端流程：如创建房局 → 开局 → 对局 → 结算 → 下一局。每步标注触发与结果。 -->

## 配置功能

<!-- 创房/设置类功能的可配置项、默认值、范围，与 GDD 数值配置一致。 -->

## 异常场景

<!-- 掉线、人数不足、解散、超时等非正常路径。 -->

## 与下游文档关系

- 页面交互与状态机 → `Interaction.md`
- 事件与状态转移契约 → `Interaction-Contract.yaml`
- 玩法规则依据 → `GDD.md`
