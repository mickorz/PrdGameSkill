#!/usr/bin/env node
// rtm-assemble.mjs —— RTM 追踪矩阵确定性组装与校验
//
// 用途：读取一次运行产出的分片数据（需求点/规则点/检查覆盖记录），完成：
//   1. 分片合并（requirements / rule-catalog / checks）
//   2. 稳定 ID 匹配（identity-map：来源锚点 + 规范化文本哈希，跨运行复用 REQ ID）
//   3. 证据校验 6 条（v4 需求 1.4 节）：不合格记录降级 unverified
//   4. 矩阵组装：需求点 × ruleRefs、Rule 覆盖、规范化问题关联
//   5. 双指标统计：检查完成率 / 规则通过率（严格分列，见 v4 2.3）
//   6. 产出 requirements-matrix.json / issues.json / manifest.json / matrix-report.md
//
// 用法：node rtm-assemble.mjs <runDir> [--issues-raw <path>] [--meta <path>] [--identity-map <path>]
//   <runDir>       本次运行快照目录（内含 requirements/parts、catalog/parts、checks/）
//   --issues-raw   workflow 汇总去重后的规范化问题清单 JSON（含最终编号与 requirementRefs）
//   --meta         运行元信息 JSON（checkDate、failedGroups、excludeKeywords 等）
//   --identity-map 跨运行共享的 ID 映射表路径（缺省 <runDir>/../identity-map.json）
//
// 输入分片契约：
//   requirements/parts/*.json : [{ reqKey, title, source:{file,section?,fromLine?,toLine?}, text }]
//   catalog/parts/*.json      : [{ ruleId, file, section?, fromLine?, toLine?, text, mandatory? }]
//   checks/*.json             : { groupId, status:"completed"|"failed",
//                               inputFingerprint?, ruleFingerprint?, checkVersion?,
//                               coverage:[{ ruleId, reqKey|null, status, evidence }] }
//   issues-raw                : [{ id, type, priority, ..., requirementRefs:[reqKey] }]
//
// 退出码 0 成功；1 结构性失败（分片缺失/JSON 损坏）。校验不合格不视为失败，降级 unverified 并记入 warnings。

'use strict'

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

// ---------- 参数 ----------
const argv = process.argv.slice(2)
const runDir = argv[0]
if (!runDir || !fs.existsSync(runDir)) {
  console.error('[失败] runDir 不存在: ' + runDir)
  process.exit(1)
}
function argVal(name) {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : null
}
const issuesRawPath = argVal('--issues-raw')
const metaPath = argVal('--meta')
const identityMapPath = argVal('--identity-map') || path.join(path.dirname(path.resolve(runDir)), 'identity-map.json')

const warnings = []
const errors = []

// ---------- 工具 ----------
const normText = (s) => String(s || '').replace(/\s+/g, '')
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex')
const STATUS_ORDER = ['missing', 'conflict', 'incomplete', 'unverified', 'pending-confirm', 'na', 'pass']
// 状态严重度：越靠前越严重；overallStatus 取所有关联状态中最严重的
function worstStatus(a, b) {
  if (!a) return b
  if (!b) return a
  return STATUS_ORDER.indexOf(a) <= STATUS_ORDER.indexOf(b) ? a : b
}
// 问题类型 -> 映射状态（P3 建议类不算需求错误，由调用方决定不降状态）
const TYPE_STATUS = { MISSING: 'missing', CONFLICT: 'conflict', LOGIC: 'conflict', AMBIGUOUS: 'incomplete', INCOMPLETE: 'incomplete' }
const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 }

function readJsonArray(dir, label) {
  const out = []
  if (!fs.existsSync(dir)) {
    warnings.push(label + ' 目录不存在: ' + dir)
    return out
  }
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const p = path.join(dir, f)
    try {
      const arr = JSON.parse(fs.readFileSync(p, 'utf8'))
      if (Array.isArray(arr)) out.push(...arr)
      else warnings.push(label + ' 分片非数组，已跳过: ' + f)
    } catch (e) {
      errors.push(label + ' 分片 JSON 解析失败: ' + f + ' -> ' + e.message)
    }
  }
  return out
}

function readChecks(dir) {
  const out = []
  if (!fs.existsSync(dir)) {
    warnings.push('checks 目录不存在: ' + dir)
    return out
  }
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const p = path.join(dir, f)
    try {
      const obj = JSON.parse(fs.readFileSync(p, 'utf8'))
      if (obj && typeof obj === 'object') out.push(obj)
      else warnings.push('checks 分片非对象，已跳过: ' + f)
    } catch (e) {
      errors.push('checks 分片 JSON 解析失败: ' + f + ' -> ' + e.message)
    }
  }
  return out
}

// ---------- 1. 合并需求点分片 ----------
const requirementsParts = readJsonArray(path.join(runDir, 'requirements', 'parts'), 'requirements')
const reqByKey = new Map()
for (const r of requirementsParts) {
  if (!r || !r.reqKey || !r.title) {
    warnings.push('需求点缺少 reqKey/title，已跳过: ' + JSON.stringify(r).slice(0, 80))
    continue
  }
  if (reqByKey.has(r.reqKey)) warnings.push('reqKey 重复: ' + r.reqKey + '（保留首个）')
  else reqByKey.set(r.reqKey, r)
}

// ---------- 2. 合并规则目录分片 ----------
const catalogParts = readJsonArray(path.join(runDir, 'catalog', 'parts'), 'catalog')
const ruleById = new Map()
for (const c of catalogParts) {
  if (!c || !c.ruleId || !c.file) {
    warnings.push('规则点缺少 ruleId/file，已跳过: ' + JSON.stringify(c).slice(0, 80))
    continue
  }
  if (ruleById.has(c.ruleId)) warnings.push('ruleId 重复: ' + c.ruleId + '（保留首个）')
  else ruleById.set(c.ruleId, c)
}

// ---------- 3. identity-map：稳定 ID 匹配 ----------
let idMap = { byHash: {}, next: 1 }
if (fs.existsSync(identityMapPath)) {
  try {
    const prev = JSON.parse(fs.readFileSync(identityMapPath, 'utf8'))
    if (prev && typeof prev === 'object') {
      idMap.byHash = prev.byHash || {}
      idMap.next = prev.next || (Object.keys(idMap.byHash).length + 1)
    }
  } catch (e) {
    warnings.push('identity-map 解析失败，将重建: ' + e.message)
  }
}
// 已有 ID 最大序号兜底（防 byHash 丢失后 ID 回退重复）
let maxSeq = 0
for (const v of Object.values(idMap.byHash)) {
  const m = String(v).match(/REQ-(\d+)/)
  if (m) maxSeq = Math.max(maxSeq, Number(m[1]))
}
idMap.next = Math.max(idMap.next || 1, maxSeq + 1)

// 匹配键：源文件 + 规范化文本哈希（行号漂移不影响）
for (const [reqKey, r] of reqByKey) {
  const h = sha((r.source && r.source.file || '') + '|' + normText(r.text))
  if (idMap.byHash[h]) {
    r.requirementId = idMap.byHash[h]
  } else {
    r.requirementId = 'REQ-' + String(idMap.next).padStart(3, '0')
    idMap.byHash[h] = r.requirementId
    idMap.next += 1
  }
}
const idByReqKey = new Map([...reqByKey].map(([k, v]) => [k, v.requirementId]))

// ---------- 4. 读取检查分片与规范化问题 ----------
const checkShards = readChecks(path.join(runDir, 'checks'))
const failedGroups = []
if (metaPath && fs.existsSync(metaPath)) {
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    if (Array.isArray(meta.failedGroups)) failedGroups.push(...meta.failedGroups)
  } catch (e) {
    warnings.push('meta 解析失败: ' + e.message)
  }
}

let issuesRaw = []
if (issuesRawPath && fs.existsSync(issuesRawPath)) {
  try {
    issuesRaw = JSON.parse(fs.readFileSync(issuesRawPath, 'utf8'))
    if (!Array.isArray(issuesRaw)) { warnings.push('issues-raw 非数组，按空处理'); issuesRaw = [] }
  } catch (e) {
    warnings.push('issues-raw 解析失败，按空处理: ' + e.message)
  }
}

// ---------- 5. 证据校验（v4 1.4 六条）+ 矩阵组装 ----------
const fileIdCache = new Map()
function fileLines(f) {
  if (fileIdCache.has(f)) return fileIdCache.get(f)
  let lines = null
  try {
    if (fs.existsSync(f)) lines = fs.readFileSync(f, 'utf8').split('\n')
  } catch (e) { lines = null }
  fileIdCache.set(f, lines)
  return lines
}

// coverage 合并：ruleId -> [records]；reqKey -> [records]
const covByRule = new Map()
const covByReq = new Map()
let covTotal = 0
for (const shard of checkShards) {
  const groupFailed = shard.status !== 'completed'
  const covs = Array.isArray(shard.coverage) ? shard.coverage : []
  for (const c of covs) {
    covTotal += 1
    let status = c.status || 'unverified'
    const evidence = c.evidence || ''
    const w = []
    // 校验 4：ruleId 存在于 rule-catalog
    if (!c.ruleId || !ruleById.has(c.ruleId)) {
      w.push('ruleId 不存在于 rule-catalog: ' + c.ruleId)
    }
    // 校验 6：组失败 -> unverified
    if (groupFailed) {
      w.push('所属检查组未完成: ' + (shard.groupId || '?'))
    }
    // 校验 1/2/3：reqKey 对应需求点的 source 核验
    const req = c.reqKey ? reqByKey.get(c.reqKey) : null
    if (c.reqKey && !req) {
      w.push('reqKey 不存在于 requirements: ' + c.reqKey)
    }
    if (req && req.source) {
      const lines = fileLines(req.source.file)
      if (!lines) {
        w.push('source.file 不存在: ' + req.source.file)
      } else {
        const from = Number(req.source.fromLine)
        const to = Number(req.source.toLine)
        if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > lines.length) {
          w.push('fromLine/toLine 无效: ' + from + '~' + to + '（文件共 ' + lines.length + ' 行）')
        } else {
          const seg = normText(lines.slice(from - 1, to).join('\n'))
          if (normText(req.text) && seg.indexOf(normText(req.text)) < 0) {
            w.push('需求文本与源文件行范围内容不一致: ' + req.requirementId)
          }
        }
      }
    }
    if (groupFailed) status = 'unverified'
    const rec = { ruleId: c.ruleId || null, reqKey: c.reqKey || null, requirementId: c.reqKey ? (idByReqKey.get(c.reqKey) || null) : null, status, evidence, evidenceInvalid: w.length > 0, warnings: w }
    if (w.length) {
      status = 'unverified'
      for (const x of w) warnings.push('[' + (c.ruleId || '?') + ' -> ' + (c.reqKey || '-') + '] ' + x)
    }
    if (!covByRule.has(rec.ruleId)) covByRule.set(rec.ruleId, [])
    covByRule.get(rec.ruleId).push(rec)
    if (!covByReq.has(rec.reqKey)) covByReq.set(rec.reqKey, [])
    covByReq.get(rec.reqKey).push(rec)
  }
}

// 问题关联：requirementRefs -> 需求点 issueIds；取最严重映射状态
// 注意：P3（优化建议/新功能差异）不影响需求正确性，只记 issueIds 不降状态（v4 2.3）
const issuesOut = issuesRaw.map((it, i) => {
  const refs = Array.isArray(it.requirementRefs) ? it.requirementRefs : []
  for (const k of refs) {
    const req = reqByKey.get(k)
    if (!req) { warnings.push('issue ' + (it.id || i) + ' 引用不存在的 reqKey: ' + k); continue }
    req._issueIds = req._issueIds || []
    req._issueIds.push(it.id || 'ISSUE-' + (i + 1))
    if (it.priority !== 'P3') req._issueStatus = worstStatus(req._issueStatus, TYPE_STATUS[it.type] || 'incomplete')
  }
  return it
})

// 需求矩阵条目
// 证据校验失败（evidenceInvalid）的记录：引用不可信 -> 整条需求结论强制 unverified，
// 不被更严重的语义状态（如 missing）覆盖——否则校验信号会被吞掉
const matrix = [...reqByKey.values()].map((r) => {
  const covs = covByReq.get(r.reqKey) || []
  const ruleRefs = covs.map((c) => ({
    ruleId: c.ruleId,
    status: c.status,
    evidence: c.evidence,
    evidenceInvalid: c.evidenceInvalid || false,
  }))
  let overall = null
  for (const c of covs) overall = worstStatus(overall, c.status)
  if (r._issueStatus) overall = worstStatus(overall, r._issueStatus)
  if (!overall) overall = covs.length ? 'pass' : 'unverified'
  if (covs.some((c) => c.evidenceInvalid)) overall = 'unverified'
  return {
    requirementId: r.requirementId,
    reqKey: r.reqKey,
    title: r.title,
    source: r.source || null,
    text: r.text || '',
    ruleRefs,
    overallStatus: overall,
    issueIds: r._issueIds || [],
  }
})

// Rule 覆盖矩阵：catalog 全量列出；无 coverage 的标 unverified + orphan
const ruleCoverage = [...ruleById.values()].map((c) => {
  const covs = covByRule.get(c.ruleId) || []
  const linkedReqIds = [...new Set(covs.map((x) => x.requirementId).filter(Boolean))]
  let status = null
  for (const x of covs) status = worstStatus(status, x.status)
  if (!status) status = 'unverified'
  return {
    ruleId: c.ruleId,
    file: c.file,
    section: c.section || null,
    text: c.text || '',
    mandatory: c.mandatory !== false,
    status,
    linkedRequirementIds: linkedReqIds,
    orphan: linkedReqIds.length === 0 && (status === 'pass' || status === 'unverified'),
  }
})

// ---------- 6. 双指标统计（v4 2.3）----------
const totalRulePoints = ruleCoverage.length
const applicableRulePoints = ruleCoverage.filter((r) => r.mandatory).length
const checkedRulePoints = ruleCoverage.filter((r) => r.status !== 'unverified').length
const passedRulePoints = ruleCoverage.filter((r) => r.status === 'pass').length
const stats = {
  requirementTotal: matrix.length,
  requirementByStatus: matrix.reduce((m, r) => { m[r.overallStatus] = (m[r.overallStatus] || 0) + 1; return m }, {}),
  rulePointTotal: totalRulePoints,
  applicableRulePoints,
  checkedRulePoints,
  passedRulePoints,
  issueTotal: issuesOut.length,
  // 完成率 = 已完成检查的适用规则点 / 全部适用规则点
  checkCompleteRate: applicableRulePoints ? Number((checkedRulePoints / applicableRulePoints).toFixed(4)) : 0,
  // 通过率 = 已通过 / 已完成检查（分母不含未检查项）
  rulePassRate: checkedRulePoints ? Number((passedRulePoints / checkedRulePoints).toFixed(4)) : 0,
  failedGroups: [...new Set(failedGroups)],
  coverageRecords: covTotal,
}

// ---------- 7. 矩阵 Markdown ----------
function esc(s) { return String(s == null ? '' : s).replace(/\|/g, '／').replace(/\r?\n/g, ' ') }
const statusText = {
  pass: '通过', incomplete: '不完整', conflict: '冲突', missing: '缺失',
  unverified: '未验证', na: '不适用', 'pending-confirm': '待确认',
}
const reqRows = matrix.map((r) =>
  '| ' + r.requirementId + ' | ' + esc(r.title) + ' | ' + esc(r.source && r.source.file) +
  (r.source && r.source.section ? ' §' + r.source.section : '') + ' | ' +
  esc(r.ruleRefs.map((x) => x.ruleId).join('、')) + ' | ' +
  (statusText[r.overallStatus] || r.overallStatus) + ' | ' + esc(r.issueIds.join('、')) + ' |'
).join('\n')
const ruleRows = ruleCoverage.map((r) =>
  '| ' + r.ruleId + ' | ' + esc(r.file) + (r.section ? ' §' + r.section : '') + ' | ' + esc(r.text).slice(0, 60) + ' | ' +
  esc(r.linkedRequirementIds.join('、')) + ' | ' + (statusText[r.status] || r.status) +
  (r.orphan ? '（无对应需求，待确认）' : '') + ' |'
).join('\n')

const matrixReport = [
  '# 需求全量检查矩阵',
  '',
  '## 覆盖统计',
  '',
  '| 指标 | 数值 |',
  '|---|---|',
  '| 需求点总数 | ' + stats.requirementTotal + ' |',
  '| 规则原子检查点总数 | ' + stats.rulePointTotal + '（适用 ' + stats.applicableRulePoints + '） |',
  '| 已完成检查 | ' + stats.checkedRulePoints + '（检查完成率 ' + (stats.checkCompleteRate * 100).toFixed(1) + '%） |',
  '| 已通过 | ' + stats.passedRulePoints + '（规则通过率 ' + (stats.rulePassRate * 100).toFixed(1) + '%，分母=已完成检查） |',
  '| 关联问题 | ' + stats.issueTotal + ' |',
  '| 失败检查组 | ' + (stats.failedGroups.join('、') || '无') + ' |',
  '',
  '> 口径说明：检查完成率 ≠ 规则通过率；未完成检查的规则点状态为未验证，不计入通过率分母。',
  '',
  '## 全量需求追踪矩阵',
  '',
  '| 需求点 | 标题 | 来源 | 关联规则 | 检查结果 | 关联问题 |',
  '|---|---|---|---|---|---|',
  reqRows || '|（无）||||||',
  '',
  '## Rule 覆盖矩阵',
  '',
  '| 规则点 | 来源 | 内容摘要 | 对应需求 | 检查结果 |',
  '|---|---|---|---|---|',
  ruleRows || '|（无）||||',
  '',
].join('\n')

// ---------- 8. 写出 ----------
function write(rel, content) {
  fs.writeFileSync(path.join(runDir, rel), content, 'utf8')
}
write('requirements.json', JSON.stringify(matrix, null, 2))
write('rule-catalog.json', JSON.stringify(ruleCoverage, null, 2))
write('requirements-matrix.json', JSON.stringify({ stats, requirements: matrix, ruleCoverage }, null, 2))
write('issues.json', JSON.stringify(issuesOut, null, 2))
write('matrix-report.md', matrixReport)
fs.writeFileSync(identityMapPath, JSON.stringify(idMap, null, 2), 'utf8')

const manifest = {
  runDir: path.basename(runDir),
  generatedAt: new Date().toISOString(),
  stats,
  warningsCount: warnings.length,
  warnings: warnings.slice(0, 200),
  errors,
}
write('manifest.json', JSON.stringify(manifest, null, 2))

if (errors.length) {
  console.log('[失败] 结构性错误 ' + errors.length + ' 条（分片损坏等），已写出 manifest，请修复后重跑')
  errors.forEach((e) => console.log('  - ' + e))
  process.exit(1)
}
console.log('[成功] RTM 矩阵组装完成')
console.log('  需求点: ' + stats.requirementTotal + '，规则点: ' + stats.rulePointTotal + '（适用 ' + stats.applicableRulePoints + '）')
console.log('  检查完成率: ' + (stats.checkCompleteRate * 100).toFixed(1) + '%（' + stats.checkedRulePoints + '/' + stats.applicableRulePoints + '）')
console.log('  规则通过率: ' + (stats.rulePassRate * 100).toFixed(1) + '%（' + stats.passedRulePoints + '/' + stats.checkedRulePoints + '，分母=已完成检查）')
console.log('  警告: ' + warnings.length + ' 条（详见 manifest.json），失败组: ' + (stats.failedGroups.join('、') || '无'))
console.log('  产物: requirements-matrix.json / issues.json / matrix-report.md / manifest.json / identity-map 已更新')
