#!/usr/bin/env node
// bug-verdicts.example.mjs
// bug-verdicts.mjs 的最小自检：collectVerdicts（执行状态分离 + 批次完整性五项校验）
// 与 finalizeGaps（归并/编号/投影）的关键断言。用法：node bug-verdicts.example.mjs

import {
  collectVerdicts,
  finalizeGaps,
  projectGapsRaw,
  projectAppendixRows,
  bugIdOf,
  VERDICT_LABELS,
} from './bug-verdicts.mjs'
import assert from 'node:assert'

// ---------- 测试数据工厂 ----------
function bug(id, module, title) {
  return { path: 'bugs/buglist/' + id + '-【卡五星】【' + module + '】' + (title || '测试缺陷') + '.md', title: title || '测试缺陷', module: module, bugId: String(id) }
}
function verdict(id, v, extra) {
  return {
    bugId: String(id),
    title: '缺陷 ' + id,
    module: '创房规则',
    scope: '好友房',
    verdict: v,
    prdRef: v === 'MISSING' ? '无' : '2.1 创房',
    prdQuote: v === 'MISSING' ? '无' : '创建房间后进入准备',
    reason: '测试判定',
    gapTitle: v === 'MISSING' || v === 'PARTIAL' ? '测试缺口 ' + id : '无',
    gap: v === 'MISSING' || v === 'PARTIAL' ? '缺测试内容' : '无',
    impact: '无',
    suggestion: v === 'MISSING' || v === 'PARTIAL' ? '补充测试内容' : '无',
    priority: v === 'MISSING' || v === 'PARTIAL' ? 'P1' : '不适用',
    acceptance: '无',
    ...(extra || {}),
  }
}
function batchOf(list) {
  return { title: '批次一', files: list }
}
function run(label, fn) {
  fn()
  console.log('[成功] ' + label)
}

// ---------- 场景 1：全部正常返回 ----------
run('场景1 全部完成：统计分列与覆盖率分母', () => {
  const allBugs = [bug(1, '创房规则'), bug(2, '创房规则'), bug(3, '亮牌')]
  const batches = [batchOf(allBugs)]
  const batchResults = [{ bugs: [verdict(1, 'PASS'), verdict(2, 'MISSING'), verdict(3, 'PARTIAL')] }]
  const { verdicts, stats, warnings } = collectVerdicts({ allBugs, batches, batchResults, prePassBugs: [] })
  assert.strictEqual(verdicts.length, 3, '应登记 3 条')
  assert.strictEqual(stats.completed, 3, '全部执行完成')
  assert.strictEqual(stats.failed, 0, '无执行失败')
  assert.deepStrictEqual(stats.distribution, { PASS: 1, PARTIAL: 1, MISSING: 1, NOT_APPLICABLE: 0, INSUFFICIENT: 0 })
  assert.strictEqual(stats.applicable, 3, '适用且执行完成 = 3')
  assert.strictEqual(stats.passRate, 1 / 3, '覆盖率 = PASS/适用')
  assert.strictEqual(warnings.length, 0, '无告警')
  assert.ok(verdicts.every((v) => v.executionStatus === 'completed'), '全部 completed')
})

// ---------- 场景 2：批次失败 → 执行失败不冒充 INSUFFICIENT ----------
run('场景2 批次失败：failed 条目 verdict=null', () => {
  const allBugs = [bug(1, '创房规则'), bug(2, '创房规则')]
  const batches = [batchOf(allBugs)]
  const batchResults = [null]
  const { verdicts, stats } = collectVerdicts({ allBugs, batches, batchResults, prePassBugs: [] })
  assert.strictEqual(stats.failedBatches, 1, '批次失败计数')
  assert.strictEqual(stats.failed, 2, '两条执行失败')
  assert.strictEqual(stats.completed, 0)
  assert.ok(verdicts.every((v) => v.executionStatus === 'failed' && v.verdict === null), 'failed 且 verdict 为 null')
  assert.strictEqual(stats.distribution.INSUFFICIENT, 0, '不得冒充信息不足')
  assert.strictEqual(stats.applicable, 0, '执行失败不进覆盖率分母')
  assert.strictEqual(stats.passRate, null, '无适用时分母为空')
})

// ---------- 场景 3：批次部分缺失 + 缺失补齐 ----------
run('场景3 缺失补齐：未返回缺陷按执行失败登记', () => {
  const allBugs = [bug(1, '创房规则'), bug(2, '创房规则'), bug(3, '亮牌')]
  const batches = [batchOf(allBugs)]
  const batchResults = [{ bugs: [verdict(1, 'PASS')] }] // 缺 2、3
  const { verdicts, stats } = collectVerdicts({ allBugs, batches, batchResults, prePassBugs: [] })
  assert.strictEqual(stats.missingVerdict, 2, '两条缺失补齐')
  assert.strictEqual(stats.failed, 2)
  assert.strictEqual(verdicts.length, 3, '总数一致（缺失不丢条）')
  const failed = verdicts.filter((v) => v.executionStatus === 'failed')
  assert.ok(failed.every((v) => v.reason.indexOf('审核未返回该条判定') >= 0), '缺失补齐的 failed 要写明原因')
})

// ---------- 场景 4：重复 ID 保留首条 ----------
run('场景4 重复判定：保留首条并告警', () => {
  const allBugs = [bug(1, '创房规则')]
  const batches = [batchOf(allBugs), { title: '批次二', files: [bug(1, '创房规则')] }]
  const batchResults = [{ bugs: [verdict(1, 'PASS')] }, { bugs: [verdict(1, 'MISSING')] }]
  const { verdicts, warnings } = collectVerdicts({ allBugs, batches, batchResults, prePassBugs: [] })
  assert.strictEqual(verdicts.length, 1, '去重后 1 条')
  assert.strictEqual(verdicts[0].verdict, 'PASS', '保留首条')
  assert.ok(warnings.some((w) => w.indexOf('重复判定') >= 0), '有重复告警')
})

// ---------- 场景 5：非法 ID 剔除 ----------
run('场景5 非法缺陷 ID：剔除并告警', () => {
  const allBugs = [bug(1, '创房规则')]
  const batches = [batchOf(allBugs)]
  const batchResults = [{ bugs: [verdict(1, 'PASS'), verdict(999, 'MISSING')] }]
  const { verdicts, warnings } = collectVerdicts({ allBugs, batches, batchResults, prePassBugs: [] })
  assert.strictEqual(verdicts.length, 1, '非法 ID 已剔除')
  assert.ok(warnings.some((w) => w.indexOf('非法缺陷 ID') >= 0), '有非法 ID 告警')
  // 剔除不破坏总数一致：1 = 1
  assert.strictEqual(verdicts.length, allBugs.length)
})

// ---------- 场景 6：跨批次错位告警 ----------
run('场景6 跨批次错位：告警但保留判定', () => {
  const b1 = bug(1, '创房规则')
  const b2 = bug(2, '亮牌')
  const allBugs = [b1, b2]
  const batches = [{ title: '批次甲', files: [b1] }, { title: '批次乙', files: [b2] }]
  // 批次甲返回了批次乙的缺陷 2
  const batchResults = [{ bugs: [verdict(1, 'PASS'), verdict(2, 'PASS')] }, { bugs: [verdict(2, 'PASS')] }]
  const { verdicts, warnings } = collectVerdicts({ allBugs, batches, batchResults, prePassBugs: [] })
  assert.ok(warnings.some((w) => w.indexOf('跨批次错位') >= 0), '有跨批次告警')
  assert.ok(warnings.some((w) => w.indexOf('重复判定') >= 0), '跨批次重复也有重复告警')
  assert.strictEqual(verdicts.length, 2, '判定保留不丢')
})

// ---------- 场景 7：autoPassModules 预判 ----------
run('场景7 autoPass 预判：completed 的 NOT_APPLICABLE', () => {
  const allBugs = [bug(1, '创房规则')]
  const prePassBugs = [bug(2, '大厅'), bug(3, '登录')]
  const batches = [batchOf(allBugs)]
  const batchResults = [{ bugs: [verdict(1, 'PASS')] }]
  const { verdicts, stats } = collectVerdicts({ allBugs, batches, batchResults, prePassBugs })
  assert.strictEqual(verdicts.length, 3, '预判条目也入全集')
  assert.strictEqual(stats.total, 3)
  assert.strictEqual(stats.distribution.NOT_APPLICABLE, 2, '预判计不适用')
  assert.strictEqual(stats.applicable, 1, '不适用不进分母')
  const pre = verdicts.find((v) => v.bugId === '2')
  assert.strictEqual(pre.executionStatus, 'completed', '确定性预判是执行完成')
  assert.ok(pre.reason.indexOf('autoPassModules') >= 0, '预判要写明依据')
})

// ---------- 场景 8：判定值非法 → 执行失败 ----------
run('场景8 判定值非法：按执行失败登记', () => {
  const allBugs = [bug(1, '创房规则')]
  const batches = [batchOf(allBugs)]
  const batchResults = [{ bugs: [verdict(1, 'UNKNOWN')] }]
  const { verdicts, warnings } = collectVerdicts({ allBugs, batches, batchResults, prePassBugs: [] })
  assert.strictEqual(verdicts[0].executionStatus, 'failed', '非法判定按执行失败')
  assert.strictEqual(verdicts[0].verdict, null)
  assert.ok(warnings.some((w) => w.indexOf('判定值非法') >= 0))
})

// ---------- 场景 9：总数一致性与排序 ----------
run('场景9 总数一致：登记数=扫描全集，且按缺陷号排序', () => {
  const allBugs = [bug(300, '创房规则'), bug(100, '亮牌'), bug(200, '行牌')]
  const batches = [batchOf(allBugs)]
  const batchResults = [{ bugs: [verdict(300, 'PASS'), verdict(100, 'PASS'), verdict(200, 'PASS')] }]
  const { verdicts, stats } = collectVerdicts({ allBugs, batches, batchResults, prePassBugs: [] })
  assert.strictEqual(verdicts.length, allBugs.length, '一条不丢')
  assert.strictEqual(stats.completed + stats.failed, stats.total, '执行状态分列之和=总数')
  // localeCompare 数字感知排序
  assert.deepStrictEqual(verdicts.map((v) => v.bugId).slice(0, 2).sort((a, b) => a.localeCompare(b)), ['100', '200'])
})

// ---------- 场景 10：投影与标签口径 ----------
run('场景10 投影：gapsRaw 只取 MISSING 与 PARTIAL，附录含执行失败行', () => {
  const allBugs = [bug(1, '创房规则'), bug(2, '创房规则'), bug(3, '创房规则'), bug(4, '大厅')]
  const batches = [batchOf([allBugs[0], allBugs[1], allBugs[2]])]
  const batchResults = [{ bugs: [verdict(1, 'MISSING'), verdict(2, 'PASS')] }] // 3 缺失补齐
  const { verdicts } = collectVerdicts({ allBugs: [allBugs[0], allBugs[1], allBugs[2]], batches, batchResults, prePassBugs: [allBugs[3]] })
  const gaps = projectGapsRaw(verdicts)
  assert.strictEqual(gaps.length, 1, '只有 MISSING 进缺口')
  assert.strictEqual(gaps[0].kind, 'MISSING')
  assert.strictEqual(gaps[0].kindLabel, '需求缺失')
  const appendix = projectAppendixRows(verdicts)
  assert.strictEqual(appendix.length, 4, '附录含全部 4 条（含预判与执行失败）')
  const failedRow = appendix.find((r) => r.bugId === '3')
  assert.strictEqual(failedRow.verdict, '执行失败（未判定）', '执行失败行不出现五判定标签')
  const naRow = appendix.find((r) => r.bugId === '4')
  assert.strictEqual(naRow.verdict, VERDICT_LABELS.NOT_APPLICABLE, '不适用标签不再写直接 pass')
  assert.ok(VERDICT_LABELS.NOT_APPLICABLE.indexOf('直接 pass') < 0, '标签口径：不适用单独统计')
})

// ---------- 场景 11：finalizeGaps 代理归并路径 ----------
run('场景11 定稿-代理归并：并组、升级、编号、投影', () => {
  const gapsRaw = [
    { kind: 'PARTIAL', kindLabel: '描述不完整', bugIds: ['1'], bugTitles: ['缺陷 1'], module: '创房规则', gapTitle: '超时口径缺失', prdRef: '2.1', prdQuote: '', gap: '缺超时', impact: '', suggestion: '补超时', priority: 'P2', acceptance: '' },
    { kind: 'MISSING', kindLabel: '需求缺失', bugIds: ['2'], bugTitles: ['缺陷 2'], module: '创房规则', gapTitle: '同缺口另一写法', prdRef: '2.2', prdQuote: '', gap: '同处缺口', impact: '', suggestion: '同补', priority: 'P1', acceptance: '' },
    { kind: 'MISSING', kindLabel: '需求缺失', bugIds: ['3'], bugTitles: ['缺陷 3'], module: '亮牌', gapTitle: '亮牌展示缺失', prdRef: '3.2', prdQuote: '', gap: '缺展示', impact: '', suggestion: '补展示', priority: 'P0', acceptance: '' },
  ]
  // 代理判定 0 与 1 同根因
  const out = finalizeGaps({ gapsRaw, duplicateGroups: [[0, 1]], maxDetailP2: 100 })
  assert.strictEqual(out.gapTotal, 2, '归并后 2 条')
  const merged = out.issueRows.find((r) => r.bugId === '1') // 保留首条 PRD 编号最小者靠排序
  const first = out.issueRows[0]
  assert.strictEqual(first.priority, 'P0', 'P0 排最前')
  const mergedRow = out.issueRows.find((r) => r.bugIds.length === 2)
  assert.ok(mergedRow, '归并条目 bugIds 合并')
  assert.deepStrictEqual(mergedRow.bugIds, ['1', '2'])
  assert.strictEqual(mergedRow.kind, 'MISSING', '组内有 MISSING 时整体升级')
  assert.strictEqual(mergedRow.kindLabel, '需求缺失')
  assert.strictEqual(mergedRow.priority, 'P1', '取组内最高优先级')
  assert.ok(mergedRow.location.indexOf('、') >= 0, 'prdRef 拼接（投影为 location）')
  assert.ok(out.issueRows.every((r, i) => r.id === 'PRD-' + String(i + 1).padStart(3, '0')), 'PRD-001 连续编号')
  assert.ok(out.tableRows.every((r) => r.kind === '需求缺失' || r.kind === '描述不完整'), '表行含问题性质列')
})

// ---------- 场景 12：finalizeGaps 确定性去重路径 + maxDetailP2 ----------
run('场景12 定稿-确定性去重：同模块同位置同标题合并，P2 详情截断', () => {
  const g = (id, module, prdRef, title, priority) => ({
    kind: 'PARTIAL', kindLabel: '描述不完整', bugIds: [id], bugTitles: ['缺陷 ' + id], module,
    gapTitle: title, prdRef, prdQuote: '', gap: '缺', impact: '', suggestion: '补', priority, acceptance: '',
  })
  const gapsRaw = [
    g('1', '创房规则', '2.1 超时', '超时口径缺失与兑底处理和提示文案的完整口径', 'P0'),
    g('2', '创房规则', '2.1 超时', '超时口径缺失与兑底处理和提示文案的另一写法', 'P1'), // 压缩后前 12 字相同 → 合并
    g('3', '亮牌', '3.2', '亮牌展示缺失', 'P2'),
    g('4', '亮牌', '3.3', '亮牌动画缺失', 'P2'),
    g('5', '亮牌', '3.4', '亮牌音效缺失', 'P2'),
  ]
  const out = finalizeGaps({ gapsRaw, duplicateGroups: null, maxDetailP2: 2 })
  assert.strictEqual(out.gapTotal, 4, '确定性合并后 4 条')
  const merged = out.issueRows.find((r) => r.bugIds.length === 2)
  assert.ok(merged, '确定性去重合并同键条目')
  assert.strictEqual(merged.kind, 'PARTIAL', '同为 PARTIAL 不升级')
  // P2 详情截断：3 条 P2 只展开 2 条
  assert.strictEqual(out.detailIssues.filter((it) => it.priority === 'P2').length, 2, 'P2 详情按上限截断')
  assert.strictEqual(out.detailIssues.filter((it) => it.priority === 'P0' || it.priority === 'P1').length, 1, 'P0/P1 全展开')
  assert.strictEqual(out.priorityStats.P2, 3, '统计按归并前缺口全量：P2 共 3 条')
})

// ---------- 场景 13：bugIdOf ----------
run('场景13 bugIdOf：从文件名取缺陷号', () => {
  assert.strictEqual(bugIdOf('bugs/buglist/7141390397-【卡五星】【创房规则】默认规则配置错误.md'), '7141390397')
  assert.strictEqual(bugIdOf('D:\\x\\7141542375-标题.md'), '7141542375')
  assert.strictEqual(bugIdOf('无数字开头.md'), '无数字开头.md')
})

console.log('[成功] bug-verdicts.example 全部断言通过（收集/五项校验/执行状态分离/预判/非法判定/投影/归并/编号/截断）')
