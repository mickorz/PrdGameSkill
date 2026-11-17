// ============================================================
// decision-fingerprint.mjs —— S11 决议适用性保护（evidenceFingerprint + stale 检查）
//
// 执行文档 §11.8、D33（评审 P0-2 整改）。
//
// 问题（评审报告 P0-2）：原实现只把决议落进 decisions.json，from-stage 重跑后历史决议会被
//   新证据静默沿用 —— 人工审批不能因「历史存在」自动生效。
//
// 本脚本提供三层能力（全部确定性）：
//   1. `bind`：为每条决议绑定 Atom 级证据指纹
//        { atomId, analysisRunId, approvedConclusion, evidenceFingerprint }
//      evidenceFingerprint 只聚合**该 Atom 实际引用的证据**（entry.evidenceIds /
//      conflictEvidenceIds 指向的 CLE/SVE 条目 + 其 dependencyFiles），按 M7 确定性排序后哈希
//      —— 无关文件变化不连坐过期（§11.8 原文要求）。
//   2. `check`：与当前 Run 对比，输出适用性清单
//        valid   ：指纹与结论均未变 → 决议继续有效
//        stale   ：指纹或结论变化 → **必须重新人工确认**（不自动沿用、不自动批准）
//        orphan  ：atomId 已不在 Registry → 决议失效
//   3. `stale` 决议在 apply-decisions 中的处置：跳过应用 + 写 pending-list 提示
//      （不静默丢弃，也不静默生效）。
//
// 可导入：export bindDecisionFingerprints({ runDir, date }) / checkDecisionApplicability({ runDir })
//
// CLI：
//   node decision-fingerprint.mjs bind --run-dir <dir> [--date <YYYY-MM-DD>]
//   node decision-fingerprint.mjs check --run-dir <dir>
//   退出码：0 成功 / 1 失败 / check 发现 stale 时退出码 0（stale 是业务状态不是错误，但会打印）
// ============================================================

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const toPosix = (p) => String(p).replaceAll('\\', '/')
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

function sha256Str(s) {
  return 'sha256:' + crypto.createHash('sha256').update(s, 'utf8').digest('hex')
}

function readJsonSafe(p) {
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(p, 'utf8')) }
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) }
  }
}

function writeJson(p, d) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(d, null, 1) + '\n', 'utf8')
}

// Atom 级证据指纹（§11.8）：只聚合该 Atom 实际引用的证据 + 其 dependencyFiles
function atomEvidenceFingerprint(atom, cleById, sveById, drEntry) {
  const ids = []
  const push = (arr) => {
    for (const id of arr || []) if (id) ids.push(id)
  }
  push(atom.client && atom.client.evidenceIds)
  push(atom.client && atom.client.conflictEvidenceIds)
  push(atom.server && atom.server.evidenceIds)
  push(atom.server && atom.server.conflictEvidenceIds)
  if (drEntry && Array.isArray(drEntry.evidenceScopes)) {
    for (const s of drEntry.evidenceScopes) if (s && s.ref) ids.push(s.ref)
  }

  const rows = []
  for (const id of [...new Set(ids)].sort(cmp)) {
    const ev = cleById.get(id) || sveById.get(id)
    if (!ev) {
      // 引用不到的证据：进入指纹（缺失本身是状态变化，必须导致 stale）
      rows.push([id, 'unresolved'])
      continue
    }
    const deps = (ev.dependencyFiles || [])
      .map((d) => [toPosix(String((d && d.file) || '')), String((d && d.contentHash) || '')])
      .sort((x, y) => cmp(x[0], y[0]))
    rows.push([
      id,
      String(ev.contentHash || ''),
      String(ev.location || ''),
      String(ev.claimKey || ''),
      // dependencyFiles 的 hash 已由 merge 回填；未回填时空串参与指纹（同样可检测变化）
      JSON.stringify(deps),
    ])
  }
  // 无证据的 Atom：指纹只由「无证据」这一事实决定（避免与有证据混淆）
  return sha256Str(JSON.stringify(rows))
}

function currentConclusionOf(drEntry, bbEntry) {
  if (drEntry && drEntry.reviewStatus === 'approved') return String(drEntry.reviewedDifference || '')
  if (bbEntry) return String(bbEntry.baselineDifference || '')
  return ''
}

function loadContext(runDir) {
  const rd = (rel) => {
    const r = readJsonSafe(path.join(runDir, rel))
    return r.ok ? r.data : null
  }
  return {
    registry: rd('1-registry/requirement-registry.json'),
    ua: rd('4-analysis/unified-atoms.json'),
    bb: rd('4-analysis/business-behavior.json'),
    dr: rd('4-analysis/difference-review.json'),
    cle: rd('2-client/client-evidence.json'),
    sve: rd('3-server/server-evidence.json'),
    decisions: rd('6-review/decisions.json'),
  }
}

function buildIndexes(ctx) {
  const cleById = new Map(((ctx.cle && ctx.cle.evidence) || []).map((e) => [e.id, e]))
  const sveById = new Map(((ctx.sve && ctx.sve.evidence) || []).map((e) => [e.id, e]))
  const uaByAtom = new Map((((ctx.ua && ctx.ua.atoms) || [])).map((a) => [a.atomId, a]))
  const bbByAtom = new Map((((ctx.bb && ctx.bb.entries) || [])).map((e) => [e.atomId, e]))
  const drByAtom = new Map((((ctx.dr && ctx.dr.entries) || [])).map((e) => [e.atomId, e]))
  const registryAtoms = new Set()
  for (const f of (ctx.registry && ctx.registry.features) || []) {
    for (const a of f.atoms || []) registryAtoms.add(a.atomId)
  }
  return { cleById, sveById, uaByAtom, bbByAtom, drByAtom, registryAtoms }
}

// ============================================================
// bind：为每条决议绑定证据指纹 + 结论 + analysisRunId
// ============================================================
export function bindDecisionFingerprints({ runDir, date }) {
  const problems = []
  const ctx = loadContext(runDir)
  if (!ctx.decisions) return { ok: false, problems: ['decisions.json 不可读'], summary: null }
  if (!ctx.ua) return { ok: false, problems: ['unified-atoms.json 不可读（S6 未跑）'], summary: null }
  const analysisRunId = String(ctx.ua.analysisRunId || '')
  if (!analysisRunId) return { ok: false, problems: ['unified-atoms.analysisRunId 缺失'], summary: null }

  const idx = buildIndexes(ctx)
  const decisions = Array.isArray(ctx.decisions.decisions) ? ctx.decisions.decisions : []
  let bound = 0
  let skipped = 0

  for (const d of decisions) {
    const atomId = String(d && d.atomId || '')
    const atom = idx.uaByAtom.get(atomId)
    if (!atom) {
      problems.push('决议 atomId 不在 unified-atoms：' + atomId)
      continue
    }
    // 只对「改变正式结论」的动作绑定指纹（re-verify 是补证请求，不需审批适用性保护）
    if (d.action === 'hold' || d.action === 're-verify') {
      skipped++
      continue
    }
    const drEntry = idx.drByAtom.get(atomId)
    const bbEntry = idx.bbByAtom.get(atomId)
    d.analysisRunId = analysisRunId
    d.evidenceFingerprint = atomEvidenceFingerprint(atom, idx.cleById, idx.sveById, drEntry)
    d.fingerprintAt = date || String(ctx.ua.date || '')
    // approvedConclusion：批准后的正式结论（modify 用改写值）
    // baselineAt：审批时依据的 S7 基线；reviewedAt：审批时依据的复核建议快照。
    // 二者都是「判断依据」，任一变化 → 须重新确认。approvedConclusion 只是审计字段（modify 时是改写值）。
    d.baselineAt = bbEntry ? String(bbEntry.baselineDifference || '') : ''
    d.reviewedAt = drEntry ? String(drEntry.reviewedDifference || '') : ''
    if (d.action === 'modify') {
      d.approvedConclusion = String(d.modifiedValue || '')
    } else if (d.action === 'approve') {
      d.approvedConclusion = drEntry ? String(drEntry.reviewedDifference || '') : currentConclusionOf(drEntry, bbEntry)
    } else if (d.action === 'reject') {
      d.approvedConclusion = bbEntry ? String(bbEntry.baselineDifference || '') : ''
    }
    bound++
  }
  if (problems.length > 0) return { ok: false, problems, summary: null }
  return {
    ok: true,
    problems: [],
    summary: { analysisRunId, decisionCount: decisions.length, bound, skipped },
    decisions: ctx.decisions,
  }
}

// ============================================================
// check：适用性清单（valid / stale / orphan），不自动沿用
// ============================================================
export function checkDecisionApplicability({ runDir }) {
  const ctx = loadContext(runDir)
  if (!ctx.decisions) {
    return { ok: true, problems: [], summary: { status: 'no-decisions', items: [] }, applicability: { schemaVersion: 1, items: [] } }
  }
  if (!ctx.ua) return { ok: false, problems: ['unified-atoms.json 不可读（S6 未跑）'], summary: null }

  const analysisRunId = String(ctx.ua.analysisRunId || '')
  const idx = buildIndexes(ctx)
  const decisions = Array.isArray(ctx.decisions.decisions) ? ctx.decisions.decisions : []
  const items = []

  for (const d of decisions) {
    const atomId = String(d && d.atomId || '')
    if (!idx.registryAtoms.has(atomId)) {
      items.push({ atomId, action: d.action, status: 'orphan', reason: 'atomId 已不在 Registry（重新拆解后失效）' })
      continue
    }
    if (!d.evidenceFingerprint) {
      // 未绑指纹（旧决议）：无法证明适用 → 必须人工确认（不自动沿用）
      items.push({ atomId, action: d.action, status: 'stale', reason: '决议未绑定 evidenceFingerprint（旧格式），须重新人工确认' })
      continue
    }
    const atom = idx.uaByAtom.get(atomId)
    if (!atom) {
      items.push({ atomId, action: d.action, status: 'stale', reason: 'unified-atoms 无该原子（本轮未覆盖）' })
      continue
    }
    const drEntry = idx.drByAtom.get(atomId)
    const bbEntry = idx.bbByAtom.get(atomId)
    const currentFp = atomEvidenceFingerprint(atom, idx.cleById, idx.sveById, drEntry)
    const currentBaseline = bbEntry ? String(bbEntry.baselineDifference || '') : ''

    const reasons = []
    if (currentFp !== d.evidenceFingerprint) reasons.push('证据指纹变化（证据内容/依赖链/引用集合已变）')
    // 判断依据（S7 基线）变化 → 人工结论的前提已变，必须重新确认。
    // 注意：不能拿 approvedConclusion 与当前 effective 结论比较 —— 审批本身就会改变结论（自反矛盾）。
    if (d.baselineAt !== undefined && d.baselineAt !== '' && currentBaseline !== '' && d.baselineAt !== currentBaseline) {
      reasons.push('审批依据基线变化（' + d.baselineAt + ' → ' + currentBaseline + '）')
    }
    // 决议作出所依据的复核建议被改动 → 判断依据已变，须重新确认
    if (drEntry && d.reviewedAt !== undefined && d.reviewedAt !== '' &&
        String(drEntry.reviewedDifference || '') !== '' && String(drEntry.reviewedDifference) !== String(d.reviewedAt)) {
      reasons.push('依据的复核建议已变（' + d.reviewedAt + ' → ' + drEntry.reviewedDifference + '）')
    }
    if (reasons.length > 0) {
      items.push({
        atomId, action: d.action,
        status: 'stale',
        reason: reasons.join('；'),
        boundRunId: String(d.analysisRunId || ''),
        currentRunId: analysisRunId,
        fingerprintBefore: d.evidenceFingerprint,
        fingerprintNow: currentFp,
      })
    } else {
      items.push({
        atomId, action: d.action,
        status: 'valid',
        reason: '指纹与结论均未变，决议继续有效',
        boundRunId: String(d.analysisRunId || ''),
        currentRunId: analysisRunId,
      })
    }
  }

  const staleCount = items.filter((i) => i.status === 'stale').length
  const orphanCount = items.filter((i) => i.status === 'orphan').length
  return {
    ok: true,
    problems: [],
    summary: { currentRunId: analysisRunId, itemCount: items.length, valid: items.filter((i) => i.status === 'valid').length, stale: staleCount, orphan: orphanCount, requiresReconfirm: staleCount + orphanCount },
    applicability: { schemaVersion: 1, currentRunId: analysisRunId, items },
  }
}

// ============================================================
// CLI
// ============================================================

function main() {
  const argv = process.argv.slice(2)
  const cmd = argv[0]
  const a = {}
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--run-dir') a.runDir = argv[++i]
    else if (argv[i] === '--date') a.date = argv[++i]
  }
  if (!a.runDir) {
    console.error('用法：node decision-fingerprint.mjs bind --run-dir <dir> [--date <YYYY-MM-DD>]')
    console.error('      node decision-fingerprint.mjs check --run-dir <dir>')
    process.exit(1)
  }
  if (cmd === 'bind') {
    const r = bindDecisionFingerprints({ runDir: a.runDir, date: a.date })
    if (!r.ok) {
      console.log('[失败] 决议指纹绑定失败：')
      for (const p of r.problems) console.log('  - ' + p)
      process.exit(1)
    }
    writeJson(path.join(a.runDir, '6-review', 'decisions.json'), r.decisions)
    console.log('[成功] 决议指纹绑定：' + r.summary.analysisRunId + ' / 决议 ' + r.summary.decisionCount + ' 条（绑定 ' + r.summary.bound + ' / 跳过 ' + r.summary.skipped + '）')
    process.exit(0)
  }
  if (cmd === 'check') {
    const r = checkDecisionApplicability({ runDir: a.runDir })
    if (!r.ok) {
      console.log('[失败] 决议适用性检查失败：')
      for (const p of r.problems) console.log('  - ' + p)
      process.exit(1)
    }
    writeJson(path.join(a.runDir, '6-review', 'runtime', 'decision-applicability.json'), r.applicability)
    const s = r.summary
    console.log(
      '[成功] 决议适用性：当前 ' + (s.currentRunId || '（无）') + ' / 条目 ' + s.itemCount +
        '（valid ' + s.valid + ' / stale ' + s.stale + ' / orphan ' + s.orphan + '）' +
        (s.requiresReconfirm > 0 ? ' —— ' + s.requiresReconfirm + ' 条须重新人工确认（不自动沿用）' : '')
    )
    for (const it of r.applicability.items) {
      if (it.status !== 'valid') console.log('  [' + it.status + '] ' + it.atomId + ' ' + it.action + '：' + it.reason)
    }
    process.exit(0)
  }
  console.error('未知子命令：' + cmd)
  process.exit(1)
}

if (process.argv[1] && toPosix(process.argv[1]).endsWith('decision-fingerprint.mjs')) main()
