// ============================================================
// build-stage-manifest.mjs —— S10 阶段速查表（确定性）
//
// 执行文档 §5 S10「stage_manifest.md（扩展）：速查表增双端分布列」。
// 职责：从 feature_index + l7-classify 确定性生成阶段速查表（含双端分布列 + L7 分布 + 处置建议）。
//
// 产物：<runDir>/5-specs/stage_manifest.md
//
// CLI：node build-stage-manifest.mjs --run-dir <dir> --date <YYYY-MM-DD>
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

const escapeCell = (s) => String(s == null ? '' : s).replaceAll('|', '/').replaceAll('\n', ' ')

export function buildStageManifest({ runDir, date }) {
  const fiRead = readJsonSafe(path.join(runDir, '5-specs', 'feature_index.json'))
  if (!fiRead.ok) return { ok: false, problems: ['feature_index.json 不可读：' + fiRead.error], markdown: null }
  const fi = fiRead.data
  const l7Read = readJsonSafe(path.join(runDir, '4-analysis', 'l7-classify.json'))
  const blocked = new Set((l7Read.ok && l7Read.data.blockedAtoms) || [])

  // 阶段聚合
  const byStage = new Map()
  for (const f of fi.features || []) {
    const stageId = f.stageId
    if (!byStage.has(stageId)) {
      byStage.set(stageId, {
        stageId,
        name: f.stageName || '',
        atomCount: 0,
        client: 0, server: 0, both: 0,
        clientLocated: 0, serverLocated: 0, dualLocated: 0,
        l7: { verified: 0, verification_required: 0, decision_required: 0, not_applicable: 0 },
        blocked: 0,
        conflictFast: 0,
      })
    }
    const agg = byStage.get(stageId)
    for (const a of f.atoms || []) {
      agg.atomCount++
      if (a.verificationScope === 'client') agg.client++
      else if (a.verificationScope === 'server') agg.server++
      else agg.both++
      const cl = (a.clientVerification && a.clientVerification.verdict && a.clientVerification.verdict !== 'not_found')
      const sv = (a.serverVerification && a.serverVerification.applicability && a.serverVerification.applicability !== 'unknown')
      if (cl) agg.clientLocated++
      if (sv) agg.serverLocated++
      if (cl && sv) agg.dualLocated++
      if (blocked.has(a.id)) agg.blocked++
      else if (a.l7 && agg.l7[a.l7] !== undefined) agg.l7[a.l7]++
      if (a.analysisPath === 'conflict-fast') agg.conflictFast++
    }
  }

  const stages = [...byStage.values()].sort((x, y) => (x.stageId < y.stageId ? -1 : 1))
  const totals = {
    atomCount: 0, client: 0, server: 0, both: 0,
    clientLocated: 0, serverLocated: 0, dualLocated: 0,
    l7: { verified: 0, verification_required: 0, decision_required: 0, not_applicable: 0 },
    blocked: 0, conflictFast: 0,
  }
  for (const s of stages) {
    totals.atomCount += s.atomCount
    totals.client += s.client
    totals.server += s.server
    totals.both += s.both
    totals.clientLocated += s.clientLocated
    totals.serverLocated += s.serverLocated
    totals.dualLocated += s.dualLocated
    totals.blocked += s.blocked
    totals.conflictFast += s.conflictFast
    for (const k of Object.keys(totals.l7)) totals.l7[k] += s.l7[k]
  }

  const actionOf = (s) => {
    if (s.blocked > 0) return '先补证（' + s.blocked + ' 条查证未完成）'
    if (s.l7.decision_required > 0) return '待策划裁决（' + s.l7.decision_required + '）'
    if (s.l7.verification_required > 0) return '待补证/确认（' + s.l7.verification_required + '）'
    if (s.atomCount > 0) return '可交付'
    return '-'
  }

  const lines = [
    '# 阶段速查表',
    '',
    '- 日期：' + date,
    '- 分析轮次：' + (fi.analysisRunId || ''),
    '- 原子总数：' + totals.atomCount,
    '',
    '## 阶段总览',
    '',
    '| 阶段 | 名称 | 原子 | 验证范围（c/s/both） | 双端定位（客户端/服务端/双端） | 已验证 | 待验证 | 待裁决 | 不适用 | 查证未完成 | 冲突立证 | 处置建议 |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
  ]
  for (const s of stages) {
    lines.push(
      '| ' + s.stageId + ' | ' + escapeCell(s.name) + ' | ' + s.atomCount +
        ' | ' + s.client + '/' + s.server + '/' + s.both +
        ' | ' + s.clientLocated + '/' + s.serverLocated + '/' + s.dualLocated +
        ' | ' + s.l7.verified + ' | ' + s.l7.verification_required +
        ' | ' + s.l7.decision_required + ' | ' + s.l7.not_applicable +
        ' | ' + s.blocked + ' | ' + s.conflictFast +
        ' | ' + actionOf(s) + ' |'
    )
  }
  lines.push(
    '| **合计** | - | ' + totals.atomCount +
      ' | ' + totals.client + '/' + totals.server + '/' + totals.both +
      ' | ' + totals.clientLocated + '/' + totals.serverLocated + '/' + totals.dualLocated +
      ' | ' + totals.l7.verified + ' | ' + totals.l7.verification_required +
      ' | ' + totals.l7.decision_required + ' | ' + totals.l7.not_applicable +
      ' | ' + totals.blocked + ' | ' + totals.conflictFast + ' | - |'
  )
  lines.push('')
  lines.push('## 口径说明')
  lines.push('')
  lines.push('- 验证范围：Registry 需求侧声明（client/server/both），由 S2 判定、S3 定稿，下游只读。')
  lines.push('- 双端定位：该端是否查到实现（客户端 verdict≠not_found / 服务端 applicability≠unknown）；**定位 ≠ 实现正确**。')
  lines.push('- 已验证：仅在人工确认或复核批准生效后计入；未审批的结论只作建议。')
  lines.push('- 查证未完成：必要端执行未完成（pending/timeout/failed），差异未判定，派生为「规则待验证」。')
  lines.push('- 冲突立证：以已完成端的直接矛盾证据先行成立的冲突条数（另一端 pending 不阻塞）。')
  lines.push('')

  return {
    ok: true,
    problems: [],
    markdown: lines.join('\n'),
    summary: { stageCount: stages.length, atomCount: totals.atomCount, ...totals },
  }
}

function main() {
  const argv = process.argv.slice(2)
  const a = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--run-dir') a.runDir = argv[++i]
    else if (argv[i] === '--date') a.date = argv[++i]
  }
  if (!a.runDir || !a.date) {
    console.error('用法：node build-stage-manifest.mjs --run-dir <dir> --date <YYYY-MM-DD>')
    process.exit(1)
  }
  const r = buildStageManifest({ runDir: a.runDir, date: a.date })
  if (!r.ok) {
    console.log('[失败] 阶段速查表生成失败：')
    for (const p of r.problems) console.log('  - ' + p)
    process.exit(1)
  }
  const outPath = path.join(a.runDir, '5-specs', 'stage_manifest.md')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, r.markdown + '\n', 'utf8')
  console.log('[成功] 阶段速查表：阶段 ' + r.summary.stageCount + ' / 原子 ' + r.summary.atomCount + ' -> ' + toPosix(outPath))
  process.exit(0)
}

if (process.argv[1] && toPosix(process.argv[1]).endsWith('build-stage-manifest.mjs')) main()
