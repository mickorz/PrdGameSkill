#!/usr/bin/env node
// build-dashboard.example.mjs
// build-dashboard.mjs 的最小自检：用内嵌 mini report 跑 parse + validate + 关键断言。
// 用法：node build-dashboard.example.mjs

import { parseReport, validateReport } from './build-dashboard.mjs';
import assert from 'node:assert';

// 构造一份覆盖全部结构的最小报告（含范围写法 PRD-001~002、斜线连写、模块、资损句、暂缓结论）
const miniReport = `# PRD 检查问题报告

检查对象：input/【测试麻将】测试玩法.md
检查日期：2026-11-10

- .claude/skills/game-prd-check/references/rules/测试规范1.md

## 1. 检查概览

| 指标 | 数量 |
| --- | --- |
| 发现问题总数 | 3 |
| 严重问题 P0 | 1 |
| 高优先级 P1 | 1 |
| 一般问题 P2 | 1 |
| 优化建议 P3 | 0 |

类型分布：MISSING 1、CONFLICT 1、LOGIC 1、AMBIGUOUS 0、INCOMPLETE 0。

## 2. 问题清单

| ID | 类型 | 优先级 | 问题 | 原文位置 | 建议 |
| --- | --- | --- | --- | --- | --- |
| PRD-001 | MISSING | P0 | 测试问题一 | 全文 | 补充描述 |
| PRD-002 | CONFLICT | P1 | 测试问题二 | 第2章 | 统一口径 |
| PRD-003 | LOGIC | P2 | 测试问题三 | 第3章 | 修正逻辑 |

## 3. 重点问题详情

### PRD-001：测试问题一

- 优先级：P0
- 类型：MISSING

**原文**：

> 未找到相关描述

**问题**：

基准要求的内容缺失。

**影响**：

无法开发。

**建议**：

补充描述。

**处理状态**：待确认

### PRD-002：测试问题二

- 优先级：P1
- 类型：CONFLICT

**原文**：

> 第一处描述。
> 第二处描述。

**问题**：

两处矛盾。

**影响**：

实现分歧。

**建议**：

统一口径。

**处理状态**：待确认

### PRD-003：测试问题三

- 优先级：P2
- 类型：LOGIC

**原文**：

> 某段原文。

**问题**：

逻辑错误。

**影响**：

结算错误。

**建议**：

修正逻辑。

**处理状态**：待确认

## 4. 总体建议

- **问题最多的模块**：结算链路（PRD-002/003）：2 条
- **可能影响开发的问题**：P0 一条（PRD-001~002 取第一条）阻塞开发；PRD-002 属资损风险，建议先裁决
- **是否建议进入下一阶段规格生成**：**暂缓**。内容缺失（PRD-001）。裁决资损后再进入。
`;

// --- 断言 ---
const data = parseReport(miniReport);
const errors = validateReport(data);

assert.strictEqual(errors.length, 0, '校验应零错误，实际：' + errors.join('；'));
assert.strictEqual(data.report.project_name, '测试麻将', '项目名应取自【】');
assert.strictEqual(data.report.document_name, '测试玩法', '文档名应去扩展名');
assert.strictEqual(data.issues.length, 3, '应解析 3 条问题');
assert.strictEqual(data.statistics.total, 3, '总数应为 3');
assert.deepStrictEqual(data.statistics.priority, { P0: 1, P1: 1, P2: 1, P3: 0 }, '优先级统计错误');
assert.strictEqual(data.statistics.types['需求缺失'], 1, 'MISSING 应映射为需求缺失');
assert.strictEqual(data.issues[0].original_text, '未找到相关描述', '原文引文应保留');
assert.strictEqual(data.issues[1].original_text, '第一处描述。\n第二处描述。', '多行引文应合并');
assert.strictEqual(data.issues[0].status, '待确认', '处理状态应保留');
assert.strictEqual(data.report.overall_conclusion.status, 'BLOCKED', '含暂缓应判定 BLOCKED');
assert.ok(data.report.overall_conclusion.reasons.length >= 1, '应提取暂缓原因');

// 风险组：阻塞组 = P0（001）；资损组 = 含"资损"子句中的 002
const blocker = data.risk_groups.find((g) => g.key === 'blocker');
const fin = data.risk_groups.find((g) => g.key === 'financial');
assert.ok(blocker && blocker.issue_ids.includes('PRD-001'), '阻塞组应含全部 P0');
assert.ok(fin && fin.issue_ids.includes('PRD-002') && !fin.issue_ids.includes('PRD-001'), '资损组应只含资损子句中的 ID');

// TOP5：P0 优先 + 资损剩余补足
assert.deepStrictEqual(data.featured_issues, ['PRD-001', 'PRD-002'], 'TOP5 排序错误');

// 模块归属（含斜线连写展开）
const mod = data.modules.find((m) => m.name === '结算链路');
assert.ok(mod && mod.issue_ids.length === 2, '模块应展开斜线连写');
assert.ok(data.issues[1].module.includes('结算链路'), '问题应挂模块标签');

// 范围写法展开（PRD-001~002 出现在"影响开发"句中，用于风险组，不在资损子句）
assert.ok(!fin.issue_ids.includes('PRD-003'), '范围写法 ID 不应混入资损组');

console.log('[成功] build-dashboard.example 全部断言通过（parse/validate/风险组/TOP5/模块/结论）');
