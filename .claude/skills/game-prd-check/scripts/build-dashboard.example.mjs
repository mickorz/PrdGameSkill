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

// ================= workflow 格式自检 =================
// 特征：清单第二列=中文主题、第三列=问题性质（新 7 列格式）、详情块「- 主题：」+「- 问题性质：」、「**原文**（位置）：」、基准单行、清单条目多于详情块
const wfReport = `# PRD 检查问题报告

检查对象：input\\【测试麻将】测试玩法.md
检查范围：排除 金币场（本期不检查）
规则基准：.claude/skills/game-prd-check/references/rules
检查日期：2026-11-10

## 1. 检查概览

| 指标 | 数量 |
| --- | --- |
| 发现问题总数 | 3 |
| 严重问题 P0 | 1 |
| 高优先级 P1 | 1 |
| 一般问题 P2 | 1 |
| 优化建议 P3 | 0 |

### 主题分布

| 主题 | 数量 |
| --- | --- |
| 结算链路缺陷 | 2 |
| 展示细节缺失 | 1 |

## 2. 问题清单

| ID | 主题 | 问题性质 | 优先级 | 问题 | 原文位置 | 建议 |
| --- | --- | --- | --- | --- | --- | --- |
| PRD-001 | 结算链路缺陷 | 需求缺失 | P0 | 测试问题一 | 全文 | 补充描述 |
| PRD-002 | 结算链路缺陷 | 内容冲突 | P1 | 测试问题二 | 第2章 | 统一口径 |
| PRD-003 | 展示细节缺失 | 描述不完整 | P2 | 测试问题三 | 第3章 | 修正展示 |

## 3. 重点问题详情

### PRD-001：测试问题一

- 优先级：P0
- 主题：结算链路缺陷
- 问题性质：需求缺失

**原文**（全文（无结算章节））：

> 「结算流程见外部文档」

**问题**：

结算章节缺失。

**影响**：

无法验收。

**建议**：

补充描述。

**处理状态**：待确认

## 4. 总体建议

- **问题最多的主题**：结算链路缺陷，共 2 条
- **可能影响开发的问题**：PRD-001 阻塞开发；PRD-002 直接导致金额算错，建议先裁决
- **是否建议进入下一阶段规格生成**：暂缓。先补齐结算章节。
`;

const wf = parseReport(wfReport);
const wfErrors = validateReport(wf);
assert.strictEqual(wfErrors.length, 0, 'workflow 格式校验应零错误，实际：' + wfErrors.join('；'));
// 清单为全集：3 条全进 issues（仅 1 条有详情）
assert.strictEqual(wf.issues.length, 3, '清单条目应全部进入 issues');
assert.strictEqual(wf.issues.filter((i) => i.has_detail).length, 1, '仅 1 条有详情块');
// 详情块字段：问题性质->类型、原文括号位置、主题挂模块
assert.strictEqual(wf.issues[0].type, '需求缺失', '问题性质应映射为中文类型');
assert.strictEqual(wf.issues[0].source_location, '全文（无结算章节）', '原文括号位置应提取');
assert.ok(wf.issues[0].original_text.includes('外部文档'), '引文应保留');
// 无详情条目：类型取自清单问题性质列（新 7 列格式），不再落入未分类
assert.strictEqual(wf.issues[1].type, '内容冲突', '无详情条目应取清单问题性质列');
assert.strictEqual(wf.issues[2].type, '描述不完整', '清单问题性质列中文应原样保留');
assert.strictEqual(wf.issues[1].suggestion, '统一口径', '清单建议应保留');
// 旧 6 列格式（无问题性质列）：无详情条目回退未分类
const legacyReport = wfReport.replace(/ \| (?:需求缺失|内容冲突|逻辑错误|定义歧义|描述不完整)(?= \| P[0-3])/g, '');
const legacy = parseReport(legacyReport);
assert.strictEqual(legacy.issues.length, 3, '旧格式清单条目应全部进入 issues');
assert.strictEqual(legacy.issues[1].type, '未分类', '旧 6 列无问题性质列且无详情应为未分类');
assert.strictEqual(legacy.issues[0].type, '需求缺失', '旧格式详情块问题性质仍应生效');
// 主题挂模块 + modules 聚合
assert.deepStrictEqual(wf.issues[0].module, ['结算链路缺陷'], '清单主题列应挂模块');
const wfMod = wf.modules.find((m) => m.name === '结算链路缺陷');
assert.ok(wfMod && wfMod.issue_ids.length === 2, '模块应按主题聚合');
// 基准单行 + 反斜杠路径
assert.ok(wf.report.rule_baselines.some((b) => b.includes('references/rules')), '单行基准应提取');
assert.strictEqual(wf.report.project_name, '测试麻将', '反斜杠路径项目名应正确');
// 类型总和含未分类 = 总数
const wfTypeSum = Object.values(wf.statistics.types).reduce((a, b) => a + b, 0);
assert.strictEqual(wfTypeSum, 3, '类型总和（含未分类）应等于总数');
// 资损关键词（金额算错）
const wfFin = wf.risk_groups.find((g) => g.key === 'financial');
assert.ok(wfFin && wfFin.issue_ids.includes('PRD-002') && !wfFin.issue_ids.includes('PRD-001'), '金额类关键词应提取资损组');
// TOP5：P0 全部 + 资损补足
assert.deepStrictEqual(wf.featured_issues, ['PRD-001', 'PRD-002'], 'TOP5 排序错误');

console.log('[成功] workflow 格式断言全部通过（清单全集/详情合并/问题性质/主题模块/单行基准/未分类/资损关键词）');

// ================= 文件名序号自检 =================
import { nextDashboardName } from './build-dashboard.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prd-dash-'));
const fakeNow = new Date(2026, 10, 10, 15, 0); // 2026-11-10 本地时间
const n1 = nextDashboardName(tmpDir, '杭州麻将', fakeNow);
assert.strictEqual(n1, '杭州麻将分析-Dashboard-20261110-01.html', '首次生成应为 01');
fs.writeFileSync(path.join(tmpDir, n1), '');
const n2 = nextDashboardName(tmpDir, '杭州麻将', fakeNow);
assert.strictEqual(n2, '杭州麻将分析-Dashboard-20261110-02.html', '同日再次生成应递增为 02');
fs.writeFileSync(path.join(tmpDir, n2), '');
const n3 = nextDashboardName(tmpDir, '杭州麻将', new Date(2026, 10, 11, 9, 0));
assert.strictEqual(n3, '杭州麻将分析-Dashboard-20261111-01.html', '跨日应重新从 01 起');
const n4 = nextDashboardName(tmpDir, '测试/麻将:二', fakeNow);
assert.strictEqual(n4, '测试麻将二分析-Dashboard-20261110-01.html', '非法字符应被清理');
const n5 = nextDashboardName(tmpDir, '', fakeNow);
assert.ok(n5.startsWith('PRD分析-Dashboard-'), '空项目名应回退为 PRD');
fs.rmSync(tmpDir, { recursive: true, force: true });

console.log('[成功] 文件名序号断言全部通过（同日递增/跨日重置/非法字符/空项目名回退）');

// ================= 建议字段附加小节（范例）自检 =================
// workflow 版 PRD-005 场景：**建议** 之后有 **范例（...）** 小节（含表格），不能在下一个 **小节** 截断
const fanliReport = `# PRD 检查问题报告

检查对象：input/【测试麻将】测试玩法.md
检查日期：2026-11-10

## 1. 检查概览

| 指标 | 数量 |
| --- | --- |
| 发现问题总数 | 1 |
| 严重问题 P0 | 1 |

## 2. 问题清单

| ID | 主题 | 优先级 | 问题 | 原文位置 | 建议 |
| --- | --- | --- | --- | --- | --- |
| PRD-001 | 文档规范章节缺失 | P0 | 测试问题一 | 全文 | 补充章节 |

## 3. 重点问题详情

### PRD-001：测试问题一

- 优先级：P0
- 主题：文档规范章节缺失
- 问题性质：需求缺失

**原文**（全文）：

> 「无验收章节」

**问题**：

缺验收章节。

**影响**：

无法验收。

**建议**：

1. 新增验收章节。

**范例（需求必须按此格式写）**：

可直接抄进 PRD。

| AC 编号 | 场景名称 |
| --- | --- |
| AC-001 | 四人坐满自动开局 |

**处理状态**：待确认

## 4. 总体建议

- **是否建议进入下一阶段规格生成**：暂缓。先补齐章节。
`;

const ex = parseReport(fanliReport);
const exErr = validateReport(ex);
assert.strictEqual(exErr.length, 0, '范例格式校验应零错误：' + exErr.join('；'));
const sug = ex.issues[0].suggestion;
assert.ok(sug.includes('1. 新增验收章节。'), '建议主体应保留');
assert.ok(sug.includes('范例（需求必须按此格式写）'), '范例小节标题应并入建议字段');
assert.ok(sug.includes('AC-001'), '范例表格内容不应丢失');
assert.ok(sug.includes('四人坐满自动开局'), '范例表格行内容不应丢失');
assert.ok(!sug.includes('处理状态'), '不应把处理状态吃进建议');

console.log('[成功] 建议字段附加范例小节断言通过（不截断/表格保留/处理状态不吃入）');

// ================= 模板新字段（必填格式/验收口径）自检 =================
// 新模板详情块顺序：...影响、**需要补的内容与必填格式**、**范例**、**建议**、**验收口径**、处理状态
const nfReport = `# PRD 检查问题报告

检查对象：input/【测试麻将】测试玩法.md
检查日期：2026-11-10

## 1. 检查概览

| 指标 | 数量 |
| --- | --- |
| 发现问题总数 | 1 |

## 2. 问题清单

| ID | 主题 | 优先级 | 问题 | 原文位置 | 建议 |
| --- | --- | --- | --- | --- | --- |
| PRD-001 | 验收场景缺失 | P0 | 缺验收章节 | 全文 | 新增章节 |

## 3. 重点问题详情

### PRD-001：缺验收章节

- 优先级：P0
- 主题：验收场景缺失
- 问题性质：需求缺失

**原文**（全文）：

> 「无验收章节」

**问题**：

缺验收章节。

**影响**：

无法出用例。

**需要补的内容与必填格式**：

必填列：AC 编号 / 场景名称 / 前置条件。

**范例（需求必须按此格式写）**：

| AC 编号 | 场景名称 |
| --- | --- |
| AC-001 | 开局场景 |

**建议**：

文末新增验收场景章节。

**验收口径**：

任一条 AC 都能让测试直接写出手工用例。

**处理状态**：待确认

## 4. 总体建议

- **是否建议进入下一阶段规格生成**：暂缓。先补齐验收章节。
`;

const nf = parseReport(nfReport);
const nfErr = validateReport(nf);
assert.strictEqual(nfErr.length, 0, '新模板校验应零错误：' + nfErr.join('；'));
const nsug = nf.issues[0].suggestion;
assert.ok(nsug.includes('**需要补的内容与必填格式**'), '建议前的必填格式块应保留');
assert.ok(nsug.includes('AC 编号 / 场景名称 / 前置条件'), '必填格式内容应保留');
assert.ok(nsug.includes('**范例（需求必须按此格式写）**'), '范例块应保留');
assert.ok(nsug.includes('AC-001'), '范例表格应保留');
assert.ok(nsug.startsWith('文末新增验收场景章节。'), '建议正文应在最前');
// 验收口径解析到独立 acceptance 字段（不混入 suggestion，Dashboard 抽屉单独渲染）
assert.ok(nf.issues[0].acceptance && nf.issues[0].acceptance.includes('直接写出手工用例'), '验收口径应解析到独立 acceptance 字段');
assert.ok(!nsug.includes('验收口径'), '验收口径不应混入建议字段');
assert.strictEqual(nf.issues[0].status, '待确认', '处理状态正确');

console.log('[成功] 模板新字段断言通过（必填格式/范例保留/验收口径独立字段/顺序正确）');

// ================= 需求点行（v4 阶段 4 REQ 关联）自检 =================
// UI 报告详情块新增「- **需求点**：REQ-101、REQ-102」→ report.json issues[].requirementIds
const reqReport = `# UI 交互检查问题报告

检查对象：input/测试玩法.md
检查日期：2026-11-13

## 2. 问题清单

| ID | 问题维度 | 优先级 | 类型 | 模块 | 问题 | 原文位置 | 基准依据 |
|---|---|---|---|---|---|---|---|
| Q01 | UI 交互 | P1 | MISSING | 发牌 | 缺张数 | 2.1 | 01#9 |

## 3. 问题详情

### Q01【P1 / MISSING】缺张数

- **问题性质**：需求缺失
- **原文**：位置“2.1”。引文：“庄家发牌。”
- **需求点**：REQ-101、REQ-102
- **基准依据**：01#9。基准要求明确张数
- **问题**：未写张数
- **影响**：无法验收
- **建议**：补张数
- **验收口径**：写出具体张数
- **处理状态**：待确认
`;
const rq = parseReport(reqReport);
const rqErr = validateReport(rq);
assert.strictEqual(rqErr.length, 0, '需求点报告校验应零错误：' + rqErr.join('；'));
assert.deepStrictEqual(rq.issues[0].requirementIds, ['REQ-101', 'REQ-102'], '需求点行应解析为 requirementIds');
assert.ok(!rq.issues[0].suggestion.includes('需求点'), '需求点不应混入建议字段');
const reqNo = parseReport(reqReport.replace('REQ-101、REQ-102', '无'));
assert.deepStrictEqual(reqNo.issues[0].requirementIds, [], '需求点为 无 时解析为空数组');

console.log('[成功] 需求点行断言通过（REQ 关联解析/无→空数组/不混入建议）');
