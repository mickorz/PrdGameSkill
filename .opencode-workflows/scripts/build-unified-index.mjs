// ============================================================
// build-unified-index.mjs —— S10 统一规格索引（五类交付物的确定性部分）
//
// 执行文档 §5 S10、§8 D34、§16（S10~S11 详细）。
//
// 职责（确定性；文档正文由 agent 写分片，本脚本产出索引/清单/校验报告）：
//   1. feature_index.json（schema v3，双端字段）：原子项含 clientVerification/serverVerification/
//      difference/l7；blocked 原子 difference 空 + l7 派生 verification_required（l7Basis=pending-blocked，
//      不入 l7-classify 统计）；
//   2. trace_index.json（需求追溯索引）：atomId → sourceStage/sourceRule/plannerSection/evidenceCount/
//      reviewStatus；
//   3. pending-list.md（待处理问题清单）：按 verificationScope 区分必要端缺口
//      （blocked 原子 / verification_required / decision_required / pending 复核 / stale 与依赖链提示）；
//   4. 机械校验（七维度子集：计数自洽 / 原子 ID 一致 / 清单覆盖 / pending-list 非空项可追溯）。
//
// 产物：<runDir>/5-specs/{feature_index.json, trace_index.json, pending-list.md, runtime/spec_check/verify-report.md}
//
// 可导入：export buildUnifiedIndex({ runDir, date })
//   返回 { ok, problems, summary, outputs }
//
// CLI：node build-unified-index.mjs --run-dir <dir> --date <YYYY-MM-DD>
//   退出码：0 成功 / 1 失败
// ============================================================

import fs from 'node:fs'
import path from 'node:path'

const toPosix = (p) => String(p).replaceAll('\\', '/')

function readJsonSafe(p) {
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(p, 'utf8')) }
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) }
  }
}

export function buildUnifiedIndex(input) {
  const problems = []
  const bad = (m) => problems.push(m)
  const I = input || {}
  const runDir = I.runDir
  const date = String(I.date || '')
  if (!runDir) bad('runDir 缺失')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) bad('date 非法：' + date)
  if (problems.length > 0) return { ok: false, problems, summary: null }

  const rd = (rel, label, optional) => {
    const r = readJsonSafe(path.join(runDir, rel))
    if (!r.ok && !optional) bad(label + ' 不可读：' + rel + ' -> ' + r.error)
    return r.ok ? r.data : null
  }
  const registry = rd('1-registry/requirement-registry.json', 'Registry')
  const clientEv = rd('2-client/client-evidence.json', 'client-evidence')
  const scopeIndex = rd('3-server/scope-index.json', 'scope-index')
  const serverEv = rd('3-server/server-evidence.json', 'server-evidence')
  const clientRs = rd('2-client/runtime/run-status.json', 'client run-status')
  const serverRs = rd('3-server/runtime/run-status.json', 'server run-status')
  const ua = rd('4-analysis/unified-atoms.json', 'unified-atoms')
  const bb = rd('4-analysis/business-behavior.json', 'business-behavior')
  const drRead = readJsonSafe(path.join(runDir, '4-analysis/difference-review.json'))
  const dr = drRead.ok ? drRead.data : { entries: [] }
  const l7 = rd('4-analysis/l7-classify.json', 'l7-classify')
  const manifestRead = readJsonSafe(path.join(runDir, '2-client/runtime/source-manifest.json'))
  const serverManifestRead = readJsonSafe(path.join(runDir, '3-server/runtime/source-manifest.json'))
  if (problems.length > 0) return { ok: false, problems, summary: null }

  const uaByAtom = new Map((ua.atoms || []).map((a) => [a.atomId, a]))
  const bbByAtom = new Map((bb.entries || []).map((e) => [e.atomId, e]))
  const drByAtom = new Map((dr.entries || []).map((e) => [e.atomId, e]))
  const l7ByAtom = new Map((l7.entries || []).map((e) => [e.atomId, e]))
  const blockedSet = new Set(l7.blockedAtoms || [])

  // ---- S10 文件级依赖清单（D34：实际读取的全部直接输入，逐一对照生成逻辑） ----
  const dependencyFiles = [
    '1-registry/requirement-registry.json',
    '2-client/client-evidence.json',
    '2-client/runtime/run-status.json',
    '2-client/runtime/source-manifest.json',
    '3-server/scope-index.json',
    '3-server/server-evidence.json',
    '3-server/runtime/run-status.json',
    '3-server/runtime/source-manifest.json',
    '4-analysis/unified-atoms.json',
    '4-analysis/business-behavior.json',
    '4-analysis/difference-review.json',
    '4-analysis/l7-classify.json',
  ]

  // ---- feature_index（schema v3） ----
  const features = []
  const traceEntries = []
  const pendingItems = []
  const stats = { atomCount: 0, verified: 0, verificationRequired: 0, decisionRequired: 0, notApplicable: 0, blocked: 0 }

  for (const f of registry.features) {
    const outFeature = {
      id: f.id,
      stageId: f.stageId,
      name: f.name,
      description: f.description,
      scope: f.scope,
      coordination: f.coordination,
      atoms: [],
    }
    for (const a of f.atoms || []) {
      const atom = uaByAtom.get(a.atomId)
      if (!atom) {
        bad('Registry 原子不在 unified-atoms（S6 未覆盖）：' + a.atomId)
        continue
      }
      const isBlocked = atom.analysisPath === 'blocked'
      const l7Entry = l7ByAtom.get(a.atomId)
      const bbEntry = bbByAtom.get(a.atomId)
      const drEntry = drByAtom.get(a.atomId)

      let difference = ''
      let l7Value
      let l7Basis
      if (isBlocked) {
        difference = ''
        l7Value = 'verification_required'
        l7Basis = 'pending-blocked'
      } else {
        if (!bbEntry) {
          bad('原子缺 business-behavior（S7 未覆盖）：' + a.atomId)
          continue
        }
        if (!l7Entry) {
          bad('原子缺 l7 分类（S9 未覆盖）：' + a.atomId)
          continue
        }
        difference = l7Entry.effectiveDifference
        l7Value = l7Entry.l7
        l7Basis = l7Entry.l7Basis
      }

      const outAtom = {
        id: a.atomId,
        name: a.name,
        rule: a.rule,
        uiRequirement: a.uiRequirement,
        verificationScope: a.verificationScope,
        clientVerification: {
          verdict: atom.client.verdict || '',
          evidenceIds: atom.client.evidenceIds || [],
          pending: atom.client.pending === true,
        },
        serverVerification: {
          applicability: atom.server.applicability || '',
          evidenceIds: atom.server.evidenceIds || [],
          configCondition: atom.server.configCondition || '',
          pending: atom.server.pending === true,
        },
        difference: difference,
        l7: l7Value,
        l7Basis: l7Basis,
        analysisPath: atom.analysisPath,
      }
      outFeature.atoms.push(outAtom)
      stats.atomCount++
      if (isBlocked) stats.blocked++
      else if (l7Value === 'verified') stats.verified++
      else if (l7Value === 'verification_required') stats.verificationRequired++
      else if (l7Value === 'decision_required') stats.decisionRequired++
      else if (l7Value === 'not_applicable') stats.notApplicable++

      // ---- trace_index ----
      traceEntries.push({
        atomId: a.atomId,
        sourceStage: f.stageId,
        sourceRule: String(a.rule || '').slice(0, 200),
        sourceLines: a.source ? [a.source.fromLine, a.source.toLine] : [],
        evidenceCount: (atom.client.evidenceIds || []).length + (atom.server.evidenceIds || []).length,
        required: a.verificationScope,
        l7: l7Value,
        l7Basis: l7Basis,
        reviewStatus: drEntry ? drEntry.reviewStatus : 'none',
        analysisPath: atom.analysisPath,
      })

      // ---- pending-list 归集 ----
      const item = pendingItemOf({ a, atom, isBlocked, l7Entry, bbEntry, drEntry, l7Basis })
      if (item) pendingItems.push(item)
    }
    features.push(outFeature)
  }

  if (problems.length > 0) return { ok: false, problems, summary: null }

  // ---- stale / 依赖链复核提示（§7 hash 优先） ----
  const staleNotes = collectStaleNotes(clientEv, serverEv, manifestRead.ok ? manifestRead.data : null, serverManifestRead.ok ? serverManifestRead.data : null)

  // ---- pending-list.md ----
  const pendingMarkdown = renderPendingList({ date, analysisRunId: ua.analysisRunId, pendingItems, staleNotes })

  const featureIndex = {
    schemaVersion: 3,
    date: date,
    analysisRunId: ua.analysisRunId,
    dependencyFiles: dependencyFiles,
    stages: registry.stages || [],
    features: features,
    stats: stats,
  }
  const traceIndex = {
    schemaVersion: 1,
    date: date,
    analysisRunId: ua.analysisRunId,
    entries: traceEntries,
  }

  // ---- 机械校验（本脚本可机械验证的维度） ----
  const checks = []
  const push = (name, ok, detail) => checks.push({ name, ok, detail })
  push('计数自洽（feature_index.stats.atomCount = 原子总数）', stats.atomCount === traceEntries.length,
    stats.atomCount + ' vs ' + traceEntries.length)
  push('原子 ID 一致（feature_index 原子 ⊆ Registry 原子）',
    traceEntries.length === (registry.features || []).reduce((n, f) => n + (f.atoms || []).length, 0),
    traceEntries.length + ' vs Registry 原子数')
  push('blocked 原子 difference 留空', features.every((f) => f.atoms.every((x) => x.analysisPath !== 'blocked' || x.difference === '')),
    'blocked 原子 difference 必须为空')
  push('blocked 原子 l7Basis=pending-blocked', features.every((f) => f.atoms.every((x) => x.analysisPath !== 'blocked' || x.l7Basis === 'pending-blocked')),
    'blocked 派生口径')
  push('所有原子 l7 非空', features.every((f) => f.atoms.every((x) => !!x.l7)), 'l7 必须全部有值')

  const verifyReport = renderVerifyReport({ date, analysisRunId: ua.analysisRunId, checks, stats, staleNotes })

  return {
    ok: true,
    problems: [],
    summary: { analysisRunId: ua.analysisRunId, stats, pendingCount: pendingItems.length, staleCount: staleNotes.length, checkFail: checks.filter((c) => !c.ok).length },
    outputs: { featureIndex, traceIndex, pendingMarkdown, verifyReport, checks },
  }
}

function pendingItemOf({ a, atom, isBlocked, l7Entry, bbEntry, drEntry, l7Basis }) {
  const needClient = a.verificationScope === 'client' || a.verificationScope === 'both'
  const needServer = a.verificationScope === 'server' || a.verificationScope === 'both'
  const retryScope = atom.client.pending && needClient && atom.server.pending && needServer
    ? 'both'
    : atom.client.pending && needClient
      ? 'client'
      : atom.server.pending && needServer
        ? 'server'
        : null

  if (isBlocked) {
    const gaps = []
    if (needClient && atom.client.pending) gaps.push('客户端')
    if (needServer && atom.server.pending) gaps.push('服务端')
    return {
      kind: 'blocked', atomId: a.atomId, scope: a.verificationScope,
      title: '查证未完成（' + gaps.join(' + ') + '）',
      detail: '必要端执行状态未完成，差异未判定',
      action: retryScope ? '补证 ' + retryScope : '人工确认',
    }
  }
  if (!l7Entry) return null
  const pendingReviewNote = drEntry && drEntry.reviewStatus === 'pending'
    ? '（另有待审批复核建议：' + drEntry.reviewedDifference + '）'
    : ''
  if (l7Entry.l7 === 'verification_required') {
    const missing = []
    if (atom.client.verdict === 'not_found' && needClient) missing.push('客户端无实现证据')
    else if (atom.client.verdict === 'partial' && needClient) missing.push('客户端仅部分证据')
    if (atom.server.applicability === 'unknown' && needServer) missing.push('服务端证据不足')
    if (atom.server.applicability === 'conditional' && needServer) missing.push('依赖配置：' + (atom.server.configCondition || '未标注'))
    return {
      kind: 'verification_required', atomId: a.atomId, scope: a.verificationScope,
      title: '规则待验证', detail: (missing.join('；') || '证据不足') + pendingReviewNote, action: '补证 ' + (retryScope || 'both'),
    }
  }
  if (l7Entry.l7 === 'decision_required') {
    return {
      kind: 'decision_required', atomId: a.atomId, scope: a.verificationScope,
      title: '需策划裁决',
      detail: '需求「' + String(a.rule || '').slice(0, 60) + '」vs 实际差异 ' + l7Entry.effectiveDifference +
        (bbEntry && bbEntry.baselineDetail ? '（' + bbEntry.baselineDetail + '）' : '') + pendingReviewNote,
      action: '裁决（采纳/改需求/否决/挂起）',
    }
  }
  // pending 复核建议（未审批）
  if (drEntry && drEntry.reviewStatus === 'pending') {
    return {
      kind: 'review_pending', atomId: a.atomId, scope: a.verificationScope,
      title: '待审批复核建议',
      detail: '建议 ' + drEntry.reviewedDifference + '（' + drEntry.reviewRule + '）' + (drEntry.reviewReason ? '：' + drEntry.reviewReason : ''),
      action: '审批（approve/reject/hold）',
    }
  }
  return null
}

// stale / 依赖链提示：证据文件 hash 与 manifest 不一致 → stale；依赖文件 hash 变化 → 依赖链复核
function collectStaleNotes(clientEv, serverEv, clientManifest, serverManifest) {
  const notes = []
  const check = (evidence, manifest, side) => {
    if (!manifest || !Array.isArray(manifest.repos)) return
    const hashIdx = new Map()
    for (const repo of manifest.repos) {
      for (const f of repo.files || []) hashIdx.set(repo.repoId + '\u0000' + f.file, f.contentHash)
    }
    for (const ev of evidence || []) {
      const key = (ev.repoId || '') + '\u0000' + (ev.file || '')
      const cur = hashIdx.get(key)
      if (!cur) {
        notes.push({ side, kind: 'reposition', atomIds: ev.atomIds || [], ref: ev.id, note: '证据文件不在源码清单内（路径/symbol 失效，需重新定位）' })
        continue
      }
      if (ev.contentHash && cur !== ev.contentHash) {
        notes.push({ side, kind: 'stale', atomIds: ev.atomIds || [], ref: ev.id, note: '证据文件内容已变（stale，不得作为当前实现证明）' })
      }
      for (const d of ev.dependencyFiles || []) {
        const dcur = hashIdx.get((ev.repoId || '') + '\u0000' + (d.file || ''))
        if (dcur && d.contentHash && dcur !== d.contentHash) {
          notes.push({ side, kind: 'dependency', atomIds: ev.atomIds || [], ref: ev.id, note: '依赖链文件已变：' + d.file + '（提示依赖链复核，不自动 stale）' })
        }
      }
    }
  }
  check(clientEv && clientEv.evidence, clientManifest, 'client')
  check(serverEv && serverEv.evidence, serverManifest, 'server')
  return notes
}

function renderPendingList({ date, analysisRunId, pendingItems, staleNotes }) {
  const byKind = new Map()
  for (const it of pendingItems) {
    if (!byKind.has(it.kind)) byKind.set(it.kind, [])
    byKind.get(it.kind).push(it)
  }
  const TITLES = {
    blocked: '查证未完成（必要端缺口）',
    verification_required: '规则待验证',
    decision_required: '需策划裁决',
    review_pending: '待审批复核建议',
  }
  const lines = [
    '# 待处理问题清单',
    '',
    '- 日期：' + date,
    '- 分析轮次：' + analysisRunId,
    '- 条目总数：' + pendingItems.length + '（stale/依赖链提示 ' + staleNotes.length + ' 条）',
    '',
  ]
  for (const kind of ['blocked', 'decision_required', 'verification_required', 'review_pending']) {
    const items = byKind.get(kind) || []
    lines.push('## ' + TITLES[kind] + '（' + items.length + '）')
    lines.push('')
    if (items.length === 0) {
      lines.push('- 无')
    } else {
      lines.push('| atomId | 验证范围 | 问题 | 说明 | 建议动作 |')
      lines.push('|---|---|---|---|---|')
      for (const it of items) {
        lines.push('| ' + it.atomId + ' | ' + it.scope + ' | ' + it.title + ' | ' + escapeCell(it.detail) + ' | ' + it.action + ' |')
      }
    }
    lines.push('')
  }
  if (staleNotes.length > 0) {
    lines.push('## 证据时效与依赖链提示（' + staleNotes.length + '）')
    lines.push('')
    lines.push('| 端 | atomIds | 证据 | 提示 |')
    lines.push('|---|---|---|---|')
    for (const n of staleNotes) {
      lines.push('| ' + n.side + ' | ' + (n.atomIds || []).join(',') + ' | ' + n.ref + ' | ' + escapeCell(n.note) + ' |')
    }
    lines.push('')
  }
  return lines.join('\n')
}

function escapeCell(s) {
  return String(s || '').replaceAll('|', '/').replaceAll('\n', ' ')
}

function renderVerifyReport({ date, analysisRunId, checks, stats, staleNotes }) {
  const lines = [
    '# 规格机械校验报告',
    '',
    '- 日期：' + date,
    '- 分析轮次：' + analysisRunId,
    '',
    '## 统计',
    '',
    '| 项 | 值 |',
    '|---|---|',
    '| 原子总数 | ' + stats.atomCount + ' |',
    '| verified | ' + stats.verified + ' |',
    '| verification_required | ' + stats.verificationRequired + ' |',
    '| decision_required | ' + stats.decisionRequired + ' |',
    '| not_applicable | ' + stats.notApplicable + ' |',
    '| blocked（派生 verification_required） | ' + stats.blocked + ' |',
    '',
    '## 机械校验',
    '',
    '| 校验项 | 结果 | 详情 |',
    '|---|---|---|',
  ]
  for (const c of checks) lines.push('| ' + c.name + ' | ' + (c.ok ? '通过' : '失败') + ' | ' + escapeCell(c.detail) + ' |')
  lines.push('')
  if (staleNotes.length > 0) {
    lines.push('## 证据时效提示')
    lines.push('')
    for (const n of staleNotes) lines.push('- [' + n.side + '] ' + n.ref + '：' + n.note)
    lines.push('')
  }
  return lines.join('\n')
}

// ============================================================
// CLI
// ============================================================

function main() {
  const argv = process.argv.slice(2)
  const a = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--run-dir') a.runDir = argv[++i]
    else if (argv[i] === '--date') a.date = argv[++i]
  }
  if (!a.runDir || !a.date) {
    console.error('用法：node build-unified-index.mjs --run-dir <dir> --date <YYYY-MM-DD>')
    process.exit(1)
  }
  const r = buildUnifiedIndex({ runDir: a.runDir, date: a.date })
  if (!r.ok) {
    console.log('[失败] S10 统一索引未通过，共 ' + r.problems.length + ' 项问题（不写产物）：')
    for (const p of r.problems) console.log('  - ' + p)
    process.exit(1)
  }
  const specDir = path.join(a.runDir, '5-specs')
  const checkDir = path.join(specDir, 'runtime', 'spec_check')
  fs.mkdirSync(checkDir, { recursive: true })
  fs.writeFileSync(path.join(specDir, 'feature_index.json'), JSON.stringify(r.outputs.featureIndex, null, 1) + '\n', 'utf8')
  fs.writeFileSync(path.join(specDir, 'trace_index.json'), JSON.stringify(r.outputs.traceIndex, null, 1) + '\n', 'utf8')
  fs.writeFileSync(path.join(specDir, 'pending-list.md'), r.outputs.pendingMarkdown + '\n', 'utf8')
  fs.writeFileSync(path.join(checkDir, 'verify-report.md'), r.outputs.verifyReport + '\n', 'utf8')
  const s = r.summary
  console.log(
    '[成功] S10 统一索引：原子 ' + s.stats.atomCount + '（verified ' + s.stats.verified +
      ' / verification_required ' + s.stats.verificationRequired + ' / decision_required ' + s.stats.decisionRequired +
      ' / not_applicable ' + s.stats.notApplicable + ' / blocked ' + s.stats.blocked + '）' +
      ' / 待处理 ' + s.pendingCount + ' 条 / stale 提示 ' + s.staleCount + ' / 校验失败 ' + s.checkFail + ' -> ' + toPosix(specDir)
  )
  process.exit(r.summary.checkFail > 0 ? 1 : 0)
}

if (process.argv[1] && toPosix(process.argv[1]).endsWith('build-unified-index.mjs')) main()
