#!/usr/bin/env node
// bug-verdicts.mjs —— Bug 判定收集、批次完整性校验与缺口定稿（确定性脚本）
//
// 用途（v4 架构收敛阶段 1，P0-2 / P0-3）：
//   1. 收集批次审核结果，做批次完整性五项校验，把执行状态与业务判定分离
//      （executionStatus: completed/failed；failed 条目 verdict=null，不冒充 INSUFFICIENT）
//   2. 投影缺口原始清单（MISSING/PARTIAL → 需求缺口视角）与附录判定表
//   3. 消费缺口归并代理的 duplicateGroups，完成缺口定稿（编号 PRD-001 起）与统计
//
// 用法：
//   node bug-verdicts.mjs collect <input.json> <outDir>
//     input.json : { allBugs, batches, prePassBugs, verdictsPartsDir? , batchResults? }
//       allBugs          待审核缺陷全集（autoPass 已剔除），元素 {title?,module?,bugId}
//       batches          审核批次（与分片文件按下标对齐），元素 {title,files:[{bugId}或完整对象]}
//       prePassBugs      按 autoPassModules 预判的缺陷，元素同 allBugs
//       verdictsPartsDir 分片目录（优先）：批次 agent 直接写入 batch-01.json、batch-02.json…
//                        （内容 {bugs:[判定]}；缺文件/损坏按批次失败登记并告警）
//       batchResults     分片目录未提供时使用：与 batches 同序的返回数组（null=批次失败）
//     产物（写入 outDir）：
//       bug-verdicts.json   { verdicts }（归一化判定全集，含 executionStatus；阶段 5/7 Bug RTM 直接消费）
//       appendix-rows.json  { appendixRows }（附录判定表投影）
//       gaps-raw.json       { gaps }（缺口原始清单，供归并代理与 finalize 消费）
//       verdict-stats.json  { stats, warnings }
//
//   node bug-verdicts.mjs finalize <gaps-raw.json> <duplicate-groups.json|none> <outDir> [--max-detail-p2 N]
//     duplicate-groups.json : 归并代理返回 { duplicateGroups:[[i,i,...]] }；
//                              传 none（或缺文件）时走确定性去重（同 模块+位置+标题前12字）
//     --max-detail-p2      详情区最多展开的 P2 条数，默认 100
//     产物（写入 outDir）：
//       gaps.json         { issueRows }（编号后的缺口全集）
//       table-rows.json   { tableRows }（问题清单表行，含问题性质列）
//       detail-issues.json{ detailIssues }（重点详情数据）
//       gap-stats.json    { priorityStats, moduleRank, gapTotal }
//
// 输出：成功打印 [成功] 一行 + SUMMARY {json} 一行；结构性失败打印 [失败] 并退出码 1。
// 状态口径（v4 共享快照消费契约）：
//   PASS 计入通过；PARTIAL / MISSING / NOT_APPLICABLE / INSUFFICIENT 均不计入；
//   NOT_APPLICABLE（不适用）与 INSUFFICIENT（待复核）单独统计；failed（执行失败）不产生 verdict。
//   覆盖率分母 = 总数 − 不适用 − 执行失败。

'use strict'

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ---------- 常量 ----------

export const VERDICT_LABELS = {
  PASS: 'PRD 已覆盖',
  PARTIAL: 'PRD 部分覆盖',
  MISSING: 'PRD 未覆盖',
  NOT_APPLICABLE: '不适用（单独统计）',
  INSUFFICIENT: '信息不足（待复核）',
}

const VERDICT_SET = { PASS: 1, PARTIAL: 1, MISSING: 1, NOT_APPLICABLE: 1, INSUFFICIENT: 1 }
const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 }
const PRIORITY_SET = { P0: true, P1: true, P2: true, P3: true }

// ---------- 工具 ----------

export function bugIdOf(p) {
  const name = String(p || '').split(/[\\/]/).pop() || ''
  const m = name.match(/^(\d+)/)
  return m ? m[1] : name
}

// 批次 files 元素兼容两种形式：字符串（bugId 本身）或对象（{bugId} 或 {path}）
export function fileIdOf(f) {
  if (typeof f === 'string') return f
  return String(f.bugId || bugIdOf(f.path))
}

function priorityIndex(p) {
  return PRIORITY_ORDER[p] === undefined ? 9 : PRIORITY_ORDER[p]
}

function compactKey(s) {
  return String(s || '')
    .replace(/[\s\p{P}\p{S}]/gu, '')
    .toLowerCase()
}

function failedEntry(bug, reason) {
  return {
    bugId: String(bug.bugId),
    title: bug.title || '',
    module: bug.module || '未分类',
    scope: '无法判断',
    executionStatus: 'failed',
    verdict: null,
    prdRef: '无',
    prdQuote: '无',
    reason,
    gapTitle: '无',
    gap: '无',
    impact: '无',
    suggestion: '无',
    priority: '不适用',
    acceptance: '无',
  }
}

function prePassEntry(bug) {
  return {
    bugId: String(bug.bugId),
    title: bug.title || '',
    module: bug.module || '未分类',
    scope: '非好友房',
    executionStatus: 'completed',
    verdict: 'NOT_APPLICABLE',
    prdRef: '无',
    prdQuote: '无',
    reason: '按 args.autoPassModules 预判不适用',
    gapTitle: '无',
    gap: '无',
    impact: '无',
    suggestion: '无',
    priority: '不适用',
    acceptance: '无',
  }
}

// ---------- 收集与批次完整性校验 ----------
// 五项校验：缺失 ID 补 failed / 重复 ID 保留首条 / 非法 ID 剔除 / 跨批次错位告警 / 总数一致。
// 附带：判定值非法（不在五枚举内）按执行失败登记，不编造判定。

export function collectVerdicts({ allBugs, batches, batchResults, prePassBugs }) {
  const universe = new Map()
  for (const b of allBugs || []) universe.set(String(b.bugId), b)
  const prePassIds = new Set((prePassBugs || []).map((b) => String(b.bugId)))

  // 批次归属索引（跨批次错位检查用）
  const batchList = batches || []
  const batchOf = new Map()
  batchList.forEach((batch, i) => {
    for (const f of (batch && batch.files) || []) {
      const id = fileIdOf(f)
      if (!batchOf.has(id)) batchOf.set(id, batch.title || '批次 ' + (i + 1))
    }
  })

  const verdicts = []
  const seen = new Set()
  const warnings = []
  let failedBatches = 0

  ;(batchResults || []).forEach((r, i) => {
    const batch = batchList[i]
    const batchTitle = (batch && batch.title) || '批次 ' + (i + 1)
    const batchFiles = (batch && batch.files) || []
    if (!r || !Array.isArray(r.bugs)) {
      // 批次失败：该批全部缺陷登记执行失败（verdict=null），不冒充 INSUFFICIENT
      failedBatches += 1
      for (const f of batchFiles) {
        const id = fileIdOf(f)
        if (seen.has(id)) continue
        seen.add(id)
        verdicts.push(failedEntry(universe.get(id) || f, '审核批次未返回结果（批次：' + batchTitle + '）'))
      }
      return
    }
    for (const v of r.bugs) {
      if (!v || typeof v !== 'object') {
        warnings.push('批次「' + batchTitle + '」返回非法条目，已剔除')
        continue
      }
      const id = String(v.bugId || '')
      if (prePassIds.has(id)) {
        warnings.push('缺陷 ' + id + ' 已按 autoPassModules 预判，忽略批次返回')
        continue
      }
      if (!universe.has(id)) {
        warnings.push('非法缺陷 ID：' + (id || '（空）') + '（不在扫描清单中，已剔除）')
        continue
      }
      if (seen.has(id)) {
        warnings.push('重复判定：缺陷 ' + id + ' 被多次返回，保留首条')
        continue
      }
      const verdictRaw = String(v.verdict || '').trim().toUpperCase()
      if (!VERDICT_SET[verdictRaw]) {
        seen.add(id)
        warnings.push('缺陷 ' + id + ' 判定值非法：' + (v.verdict || '空') + '，按执行失败登记')
        verdicts.push(failedEntry(universe.get(id), '判定值非法：' + (v.verdict || '空')))
        continue
      }
      const owner = batchOf.get(id)
      if (owner && owner !== batchTitle) {
        warnings.push('跨批次错位：缺陷 ' + id + ' 属于批次「' + owner + '」，由批次「' + batchTitle + '」返回')
      }
      seen.add(id)
      verdicts.push({ ...v, bugId: id, verdict: verdictRaw, executionStatus: 'completed' })
    }
  })

  // autoPassModules 预判条目（确定性预判，executionStatus=completed）
  for (const b of prePassBugs || []) {
    const id = String(b.bugId)
    if (seen.has(id)) {
      warnings.push('缺陷 ' + id + ' 已有批次判定，忽略 autoPassModules 预判')
      continue
    }
    seen.add(id)
    verdicts.push(prePassEntry(b))
  }

  // 缺失补齐：扫描到但无任何返回 → 执行失败（verdict=null）
  let missingVerdict = 0
  for (const b of allBugs || []) {
    const id = String(b.bugId)
    if (seen.has(id)) continue
    missingVerdict += 1
    seen.add(id)
    verdicts.push(failedEntry(b, '审核未返回该条判定'))
  }

  // 总数一致性：登记数必须等于扫描全集（含预判），多一条少一条都是结构性错误
  const universeSize = (allBugs || []).length + (prePassBugs || []).length
  if (verdicts.length !== universeSize) {
    throw new Error(
      '总数一致性校验失败：登记 ' + verdicts.length + ' 条 ≠ 扫描全集 ' + universeSize + ' 条（含 autoPass 预判）'
    )
  }

  verdicts.sort((a, b) => String(a.bugId).localeCompare(String(b.bugId)))

  // 统计：executionStatus 与 verdict 分列；不适用与执行失败不进覆盖率分母
  const stats = {
    total: verdicts.length,
    completed: 0,
    failed: 0,
    failedBatches,
    missingVerdict,
    distribution: { PASS: 0, PARTIAL: 0, MISSING: 0, NOT_APPLICABLE: 0, INSUFFICIENT: 0 },
  }
  for (const v of verdicts) {
    if (v.executionStatus === 'failed') {
      stats.failed += 1
      continue
    }
    stats.completed += 1
    if (v.verdict && stats.distribution[v.verdict] !== undefined) stats.distribution[v.verdict] += 1
  }
  stats.applicable = stats.completed - stats.distribution.NOT_APPLICABLE
  stats.passRate = stats.applicable > 0 ? stats.distribution.PASS / stats.applicable : null

  return { verdicts, stats, warnings }
}

// ---------- 投影：缺口原始清单 / 附录判定表 ----------

export function projectGapsRaw(verdicts) {
  const gaps = []
  for (const v of verdicts) {
    if (v.verdict !== 'MISSING' && v.verdict !== 'PARTIAL') continue
    gaps.push({
      kind: v.verdict,
      kindLabel: v.verdict === 'MISSING' ? '需求缺失' : '描述不完整',
      bugIds: [v.bugId],
      bugTitles: [v.title],
      module: v.module || '未分类',
      gapTitle: v.gapTitle && v.gapTitle !== '无' ? v.gapTitle : v.title,
      prdRef: v.prdRef && v.prdRef !== '无' ? v.prdRef : 'PRD 未覆盖',
      prdQuote: v.prdQuote && v.prdQuote !== '无' ? v.prdQuote : '',
      gap: v.gap && v.gap !== '无' ? v.gap : v.reason,
      impact: v.impact && v.impact !== '无' ? v.impact : '',
      suggestion: v.suggestion && v.suggestion !== '无' ? v.suggestion : '',
      priority: PRIORITY_SET[v.priority] ? v.priority : 'P2',
      acceptance: v.acceptance && v.acceptance !== '无' ? v.acceptance : '',
    })
  }
  return gaps
}

export function projectAppendixRows(verdicts) {
  return verdicts.map((v) => ({
    bugId: v.bugId,
    module: v.module,
    executionStatus: v.executionStatus,
    verdict:
      v.executionStatus === 'failed' ? '执行失败（未判定）' : VERDICT_LABELS[v.verdict] || String(v.verdict),
    location: v.prdRef === '无' ? '无' : v.prdRef,
    reason: v.reason,
  }))
}

// ---------- 缺口定稿 ----------

export function finalizeGaps({ gapsRaw, duplicateGroups, maxDetailP2 }) {
  let gaps = (gapsRaw || []).map((g) => ({
    ...g,
    bugIds: (g.bugIds || []).slice(),
    bugTitles: (g.bugTitles || []).slice(),
  }))

  if (Array.isArray(duplicateGroups) && duplicateGroups.length > 0) {
    // 归并代理路径：按 duplicateGroups 合并（保留组内首条，其余并入）
    const removed = {}
    for (const group of duplicateGroups) {
      if (!Array.isArray(group) || group.length < 2) continue
      const idxs = group.filter((n) => Number.isInteger(n) && n >= 0 && n < gaps.length)
      if (idxs.length < 2) continue
      const keepIdx = idxs[0]
      if (removed[keepIdx]) continue
      const keep = gaps[keepIdx]
      for (const idx of idxs.slice(1)) {
        if (removed[idx] || idx === keepIdx) continue
        const dup = gaps[idx]
        keep.bugIds = keep.bugIds.concat(dup.bugIds)
        keep.bugTitles = keep.bugTitles.concat(dup.bugTitles)
        if (dup.prdRef && keep.prdRef.indexOf(dup.prdRef) < 0) keep.prdRef = keep.prdRef + '、' + dup.prdRef
        if (dup.kind === 'MISSING') {
          keep.kind = 'MISSING'
          keep.kindLabel = '需求缺失'
        }
        if (priorityIndex(dup.priority) < priorityIndex(keep.priority)) keep.priority = dup.priority
        removed[idx] = true
      }
    }
    gaps = gaps.filter((g, i) => !removed[i])
  } else if (gaps.length > 0) {
    // 确定性去重路径：同 模块 + PRD 位置 + 标题前 12 字 视为同一条
    const seen = {}
    const kept = []
    for (const g of gaps) {
      const key = compactKey(g.module) + '|' + compactKey(g.prdRef) + '|' + compactKey(g.gapTitle).slice(0, 12)
      if (seen[key]) {
        const keep = seen[key]
        keep.bugIds = keep.bugIds.concat(g.bugIds)
        keep.bugTitles = keep.bugTitles.concat(g.bugTitles)
        if (g.kind === 'MISSING') {
          keep.kind = 'MISSING'
          keep.kindLabel = '需求缺失'
        }
        continue
      }
      seen[key] = g
      kept.push(g)
    }
    gaps = kept
  }

  gaps.sort((a, b) => {
    const p = priorityIndex(a.priority) - priorityIndex(b.priority)
    if (p !== 0) return p
    return String(a.module).localeCompare(String(b.module))
  })

  const issueRows = gaps.map((g, i) => ({
    id: 'PRD-' + String(i + 1).padStart(3, '0'),
    kind: g.kind,
    kindLabel: g.kindLabel,
    topic: g.module,
    priority: g.priority,
    title: g.gapTitle,
    location: g.prdRef,
    quote: g.prdQuote,
    gap: g.gap,
    impact: g.impact,
    suggestion: g.suggestion,
    acceptance: g.acceptance,
    bugIds: g.bugIds,
    bugTitles: g.bugTitles,
  }))

  const priorityStats = { P0: 0, P1: 0, P2: 0, P3: 0 }
  for (const it of issueRows) priorityStats[it.priority] += 1
  const moduleStats = {}
  for (const it of issueRows) moduleStats[it.topic] = (moduleStats[it.topic] || 0) + 1
  const moduleRank = Object.keys(moduleStats)
    .map((name) => ({ name: name, count: moduleStats[name] }))
    .sort((a, b) => b.count - a.count)

  const tableRows = issueRows.map((it) => ({
    id: it.id,
    topic: it.topic,
    kind: it.kindLabel,
    priority: it.priority,
    title: it.title,
    location: it.location,
    suggestion: it.suggestion,
  }))

  const detailIssues = issueRows
    .filter((it) => it.priority === 'P0' || it.priority === 'P1')
    .concat(issueRows.filter((it) => it.priority === 'P2').slice(0, maxDetailP2))
    .map((it) => ({
      id: it.id,
      topic: it.topic,
      priority: it.priority,
      kindLabel: it.kindLabel,
      title: it.title,
      location: it.location,
      quote: it.quote,
      gap: it.gap,
      impact: it.impact,
      suggestion: it.suggestion,
      acceptance: it.acceptance,
      bugIds: it.bugIds,
      bugTitles: it.bugTitles,
    }))

  return { issueRows, tableRows, detailIssues, priorityStats, moduleRank, gapTotal: issueRows.length }
}

// ---------- CLI ----------

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 1), 'utf8')
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function die(msg) {
  console.log('[失败] ' + msg)
  process.exit(1)
}

function argVal(name, fallback) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : fallback
}

function main() {
  const mode = process.argv[2]
  if (mode === 'collect') {
    const inputPath = process.argv[3]
    const outDir = process.argv[4]
    if (!inputPath || !outDir) die('用法：node bug-verdicts.mjs collect <input.json> <outDir>')
    let input
    try {
      input = readJson(inputPath)
    } catch (e) {
      die('input.json 解析失败：' + e.message)
    }
    // 分片目录模式：批次 agent 已直接写盘，这里只读文件（缺文件/损坏 → 批次失败 + 告警）
    let batchResults = Array.isArray(input.batchResults) ? input.batchResults : null
    const shardWarnings = []
    if (input.verdictsPartsDir) {
      const batchList = input.batches || []
      batchResults = batchList.map((b, i) => {
        const shard = path.join(input.verdictsPartsDir, 'batch-' + String(i + 1).padStart(2, '0') + '.json')
        if (!fs.existsSync(shard)) return null
        try {
          const j = JSON.parse(fs.readFileSync(shard, 'utf8'))
          return j && Array.isArray(j.bugs) ? j : null
        } catch (e) {
          shardWarnings.push('批次分片损坏（' + path.basename(shard) + '）：' + e.message + '，按批次失败登记')
          return null
        }
      })
      for (let i = 0; i < batchList.length; i++) {
        if (batchResults[i] === null) {
          shardWarnings.push('批次分片缺失：batch-' + String(i + 1).padStart(2, '0') + '.json，按批次失败登记（' + ((batchList[i] && batchList[i].title) || '批次 ' + (i + 1)) + '）')
        }
      }
    }
    let result
    try {
      result = collectVerdicts({
        allBugs: input.allBugs,
        batches: input.batches,
        batchResults,
        prePassBugs: input.prePassBugs,
      })
    } catch (e) {
      die(e.message)
    }
    const { verdicts, stats, warnings } = result
    const allWarnings = shardWarnings.concat(warnings)
    const gaps = projectGapsRaw(verdicts)
    const appendixRows = projectAppendixRows(verdicts)
    writeJson(path.join(outDir, 'bug-verdicts.json'), { verdicts })
    writeJson(path.join(outDir, 'appendix-rows.json'), { appendixRows })
    writeJson(path.join(outDir, 'gaps-raw.json'), { gaps })
    writeJson(path.join(outDir, 'verdict-stats.json'), { stats, warnings: allWarnings })
    const d = stats.distribution
    console.log(
      '[成功] 判定收集：' + stats.total + ' 条（执行完成 ' + stats.completed + ' / 执行失败 ' + stats.failed
        + '，批次失败 ' + stats.failedBatches + '，缺失补齐 ' + stats.missingVerdict + '），分布 已覆盖 ' + d.PASS
        + ' / 部分覆盖 ' + d.PARTIAL + ' / 未覆盖 ' + d.MISSING + ' / 不适用 ' + d.NOT_APPLICABLE
        + ' / 信息不足 ' + d.INSUFFICIENT + '；适用且执行完成 ' + stats.applicable
        + '，覆盖率 ' + (stats.passRate === null ? '无' : (stats.passRate * 100).toFixed(1) + '%')
        + '；缺口原始 ' + gaps.length + ' 条，告警 ' + allWarnings.length + ' 条'
    )
    console.log('SUMMARY ' + JSON.stringify({ stats: stats, warningsCount: allWarnings.length, gapsRawCount: gaps.length }))
    return
  }
  if (mode === 'finalize') {
    const gapsRawPath = process.argv[3]
    const dupGroupsPath = process.argv[4]
    const outDir = process.argv[5]
    if (!gapsRawPath || !dupGroupsPath || !outDir) {
      die('用法：node bug-verdicts.mjs finalize <gaps-raw.json> <duplicate-groups.json|none> <outDir> [--max-detail-p2 N]')
    }
    let gapsRaw
    let duplicateGroups = null
    try {
      gapsRaw = readJson(gapsRawPath).gaps || []
      if (dupGroupsPath !== 'none') duplicateGroups = readJson(dupGroupsPath).duplicateGroups || []
    } catch (e) {
      die('输入解析失败：' + e.message)
    }
    const maxDetailP2 = parseInt(argVal('--max-detail-p2', '100'), 10)
    const out = finalizeGaps({ gapsRaw, duplicateGroups, maxDetailP2 })
    writeJson(path.join(outDir, 'gaps.json'), { issueRows: out.issueRows })
    writeJson(path.join(outDir, 'table-rows.json'), { tableRows: out.tableRows })
    writeJson(path.join(outDir, 'detail-issues.json'), { detailIssues: out.detailIssues })
    writeJson(path.join(outDir, 'gap-stats.json'), {
      priorityStats: out.priorityStats,
      moduleRank: out.moduleRank,
      gapTotal: out.gapTotal,
    })
    console.log(
      '[成功] 缺口定稿：' + out.gapTotal + ' 条（P0 ' + out.priorityStats.P0 + ' / P1 ' + out.priorityStats.P1
        + ' / P2 ' + out.priorityStats.P2 + ' / P3 ' + out.priorityStats.P3 + '），归并方式 '
        + (Array.isArray(duplicateGroups) && duplicateGroups.length > 0 ? '代理分组' : '确定性去重')
    )
    console.log('SUMMARY ' + JSON.stringify({
      gapTotal: out.gapTotal,
      priorityStats: out.priorityStats,
      moduleRank: out.moduleRank,
      detailCount: out.detailIssues.length,
    }))
    return
  }
  die('未知模式：' + (mode || '（空）') + '。用法见文件头注释（collect / finalize）')
}

// 直接执行时跑 CLI；被 import 时只暴露纯函数
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
