#!/usr/bin/env node
// validate-rtm.mjs —— 统一 RTM 快照校验（v4 阶段 6，之前缺失项）
// 校验：结构完整 / ID 引用闭合（relation 的 REQ 与 target 必须存在于目录）/
//       verdict 枚举合法 / executionStatus 与 verdict 组合合法（failed 必须 verdict 为空）/
//       pass/partial 必须有证据 / 统计一致性（stats 可由 relations 重算）
// 用法：node validate-rtm.mjs <rtm.json>
// 退出码：0 通过 / 1 结构性失败（errors 非空；warnings 不影响退出码）
import fs from 'node:fs'

const file = process.argv[2]
if (!file) {
  console.error('用法: node validate-rtm.mjs <rtm.json>')
  process.exit(1)
}
const fail = []
const warn = []

let doc = null
try { doc = JSON.parse(fs.readFileSync(file, 'utf8')) } catch (e) { console.error('[失败] rtm.json 解析失败: ' + e.message); process.exit(1) }

// ---------- 1. 结构 ----------
const VERDICT_SET = new Set(['pass', 'partial', 'missing', 'conflict', 'incomplete', 'unverified', 'insufficient', 'na', 'logic', 'ambiguous'])
const TARGET_TYPES = new Set(['rule', 'issue', 'bug'])
if (!Array.isArray(doc.requirements) || doc.requirements.length === 0) fail.push('requirements 目录缺失或为空（REQ 实体必须来自共享快照）')
if (!Array.isArray(doc.relations)) fail.push('relations 必须是数组（关系为中心）')
for (const k of ['schemaVersion', 'projectKey', 'generatedAt', 'stats']) {
  if (doc[k] === undefined) fail.push('缺顶层字段: ' + k)
}

// ---------- 2. 目录唯一性 ----------
const reqIds = new Set()
for (const r of doc.requirements || []) {
  if (!r.requirementId || !/^REQ-\d+$/.test(r.requirementId)) { fail.push('非法 REQ ID: ' + JSON.stringify(r.requirementId)); continue }
  if (reqIds.has(r.requirementId)) fail.push('REQ ID 重复: ' + r.requirementId)
  reqIds.add(r.requirementId)
}
const catalogs = {
  rule: new Set((doc.rules || []).map((x) => x.ruleId).filter(Boolean)),
  issue: new Set((doc.issues || []).map((x) => x.id).filter(Boolean)),
  bug: new Set((doc.bugs || []).map((x) => x.bugId).filter(Boolean)),
}
for (const [type, set] of Object.entries(catalogs)) {
  if (set.size !== (doc[type === 'rule' ? 'rules' : type === 'issue' ? 'issues' : 'bugs'] || []).length) {
    warn.push(type + ' 目录存在重复 ID（按集合去重统计）')
  }
}

// ---------- 3. 逐条 relation 校验 ----------
const dist = { game: {}, ui: {}, bug: {} }
let count = 0
for (const rel of doc.relations || []) {
  count += 1
  const where = 'relation#' + count + '(' + (rel.dimension || '?') + ' ' + (rel.targetId || '?') + ')'
  if (!['game', 'ui', 'bug'].includes(rel.dimension)) { fail.push(where + ' 非法 dimension: ' + rel.dimension); continue }
  if (!rel.requirementId || !reqIds.has(rel.requirementId)) fail.push(where + ' REQ 引用不闭合: ' + rel.requirementId)
  if (!TARGET_TYPES.has(rel.targetType)) fail.push(where + ' 非法 targetType: ' + rel.targetType)
  else if (!rel.targetId || !catalogs[rel.targetType].has(rel.targetId)) fail.push(where + ' ' + rel.targetType + ' 引用不闭合: ' + rel.targetId)
  // 维度与 targetType 对应（game→rule、ui→issue、bug→bug）
  const expectType = { game: 'rule', ui: 'issue', bug: 'bug' }[rel.dimension]
  if (rel.targetType && rel.targetType !== expectType) fail.push(where + ' dimension 与 targetType 不匹配（' + rel.dimension + ' 应为 ' + expectType + '）')
  if (rel.executionStatus !== 'completed' && rel.executionStatus !== 'failed') fail.push(where + ' 非法 executionStatus: ' + rel.executionStatus)
  if (rel.executionStatus === 'failed') {
    if (rel.verdict !== null) fail.push(where + ' 执行失败必须 verdict 为 null（不冒充判定），实际: ' + rel.verdict)
  } else {
    if (rel.verdict === null || rel.verdict === undefined) fail.push(where + ' 完成判定 verdict 不得为空')
    else if (!VERDICT_SET.has(rel.verdict)) fail.push(where + ' 非法 verdict: ' + rel.verdict)
    if ((rel.verdict === 'pass' || rel.verdict === 'partial') && !String(rel.evidence || '').trim()) {
      fail.push(where + ' ' + rel.verdict + ' 必须有证据字段')
    }
  }
  if (rel.verdict) dist[rel.dimension][rel.verdict] = (dist[rel.dimension][rel.verdict] || 0) + 1
}

// ---------- 4. 统计一致性（可由明细重算） ----------
const stats = doc.stats || {}
const byDim = stats.byDimension || {}
for (const dim of ['game', 'ui', 'bug']) {
  const declared = byDim[dim]
  if (!declared) continue
  const actualTotal = (doc.relations || []).filter((r) => r.dimension === dim).length
  if (declared.total !== actualTotal) fail.push('stats.byDimension.' + dim + '.total 不一致: 声明 ' + declared.total + ' 实算 ' + actualTotal)
  for (const [v, n] of Object.entries(declared.verdictDist || {})) {
    const actual = dist[dim][v] || 0
    if (n !== actual) fail.push('stats.byDimension.' + dim + '.verdictDist.' + v + ' 不一致: 声明 ' + n + ' 实算 ' + actual)
  }
  // 反向：实算有而声明缺的
  for (const v of Object.keys(dist[dim])) {
    if ((declared.verdictDist || {})[v] === undefined) fail.push('stats.byDimension.' + dim + '.verdictDist 缺少实算存在的 ' + v + '（' + dist[dim][v] + ' 条）')
  }
}
const linkedActual = new Set((doc.relations || []).map((r) => r.requirementId)).size
if (stats.requirements && stats.requirements.linked !== undefined && stats.requirements.linked !== linkedActual) {
  fail.push('stats.requirements.linked 不一致: 声明 ' + stats.requirements.linked + ' 实算 ' + linkedActual)
}
if (stats.requirements && stats.requirements.total !== undefined && stats.requirements.total !== reqIds.size) {
  fail.push('stats.requirements.total 不一致: 声明 ' + stats.requirements.total + ' 实算 ' + reqIds.size)
}

if (fail.length) {
  console.error('[失败] RTM 快照校验未通过（' + fail.length + ' 项）:')
  fail.forEach((e) => console.error('  - ' + e))
  process.exit(1)
}
console.log('[成功] RTM 快照校验通过: REQ ' + reqIds.size + ' 条 / relations ' + (doc.relations || []).length + ' 条' + (warn.length ? '（警告 ' + warn.length + ' 条）' : ''))
warn.forEach((w) => console.log('  [警告] ' + w))
