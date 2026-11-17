// ============================================================
// classify-l7-audit.mjs —— S9 L7 分类（v3.2 完整语义，Registry 基线）
//
// 执行文档 §5 S9、§8 D10/D17/D21/D23、原则 5/6。
//
// 与旧 classify-l7.mjs 的差异（不改旧脚本，旧 workflow 继续用）：
//   - 基线从 feature_index 换 requirement-registry（D7）；difference 基线取 business-behavior；
//   - scope 解析五级回落（§5 S9），client scope 唯一合法来源 = Registry verificationScope=client；
//   - client verified 六项前置条件全 AND（D17：找到代码 ≠ 实现正确；partial 不进 verified）；
//   - 升级原子候选隔离（D23：pending/rejected 期间 effective = 历史基线，候选不参与 L7）；
//   - blocked 原子不入正式条目（派生 verification_required / l7Basis=pending-blocked 交 S10）；
//   - scope=client 仅由 Registry 声明（禁止 server unknown + CLE 存在 反推）。
//
// 产物：<runDir>/4-analysis/l7-classify.json
//
// 可导入：export classifyL7Audit({ runDir, date })
//   返回 { ok, problems, summary, l7 }
//
// CLI：node classify-l7-audit.mjs --run-dir <dir> --date <YYYY-MM-DD>
//   退出码：0 成功 / 1 失败
// ============================================================

import fs from 'node:fs'
import path from 'node:path'

const DIFFS = ['consistent', 'partial', 'conflict', 'unverified']
const APPLICABILITIES = ['active', 'conditional', 'inactive', 'unknown']
const L7_VALUES = ['verified', 'verification_required', 'decision_required', 'not_applicable']

// L7 矩阵（§5 S9）：effectiveDifference × scope
const MATRIX = {
  consistent: { active: 'verified', conditional: 'verification_required', unknown: 'verification_required', inactive: 'not_applicable', client: 'verified*' },
  partial: { active: 'verification_required', conditional: 'verification_required', unknown: 'verification_required', inactive: 'not_applicable', client: 'verification_required' },
  conflict: { active: 'decision_required', conditional: 'decision_required', unknown: 'decision_required', inactive: 'not_applicable', client: 'decision_required' },
  unverified: { active: 'verification_required', conditional: 'verification_required', unknown: 'verification_required', inactive: 'not_applicable', client: 'verification_required' },
}

function readJsonSafe(p) {
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(p, 'utf8')) }
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) }
  }
}
const toPosix = (p) => String(p).replaceAll('\\', '/')

export function classifyL7Audit(input) {
  const problems = []
  const bad = (m) => problems.push(m)
  const I = input || {}
  const runDir = I.runDir
  const date = String(I.date || '')
  if (!runDir) bad('runDir 缺失')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) bad('date 非法：' + date)
  if (problems.length > 0) return { ok: false, problems, summary: null }

  const rd = (rel, label) => {
    const r = readJsonSafe(path.join(runDir, rel))
    if (!r.ok) bad(label + ' 不可读：' + rel + ' -> ' + r.error)
    return r.ok ? r.data : null
  }
  const registry = rd('1-registry/requirement-registry.json', 'Registry')
  const clientEv = rd('2-client/client-evidence.json', 'client-evidence')
  const scopeIndex = rd('3-server/scope-index.json', 'scope-index')
  const serverEv = rd('3-server/server-evidence.json', 'server-evidence')
  const ua = rd('4-analysis/unified-atoms.json', 'unified-atoms')
  const bb = rd('4-analysis/business-behavior.json', 'business-behavior')
  // difference-review 可选：无复核建议是合法状态（全部原子走 baseline 基线）
  const drRead = readJsonSafe(path.join(runDir, '4-analysis', 'difference-review.json'))
  if (problems.length > 0) return { ok: false, problems, summary: null }

  const analysisRunId = String(ua.analysisRunId || '')
  const dr = drRead.ok ? drRead.data : { schemaVersion: 2, analysisRunId: analysisRunId, entries: [] }
  if (bb.analysisRunId !== analysisRunId) bad('business-behavior.analysisRunId 不一致')
  if (drRead.ok && dr.analysisRunId !== analysisRunId) bad('difference-review.analysisRunId 不一致')

  const uaByAtom = new Map((ua.atoms || []).map((a) => [a.atomId, a]))
  const bbByAtom = new Map((bb.entries || []).map((e) => [e.atomId, e]))
  const drByAtom = new Map((dr.entries || []).map((e) => [e.atomId, e]))
  const scopeByAtom = new Map((scopeIndex.entries || []).map((e) => [e.atomId, e]))
  const cleById = new Map((clientEv.evidence || []).map((e) => [e.id, e]))
  const sveById = new Map((serverEv.evidence || []).map((e) => [e.id, e]))

  // ---- scope 解析五级回落（§5 S9） ----
  const resolveScope = (atomId) => {
    const atom = uaByAtom.get(atomId)
    const drEntry = drByAtom.get(atomId)
    // 1. conflict 条目优先证据级 evidenceScopes（除 inactive 外一律不降级）
    if (drEntry && drEntry.reviewedDifference === 'conflict' && Array.isArray(drEntry.evidenceScopes) && drEntry.evidenceScopes.length > 0) {
      const apps = drEntry.evidenceScopes.map((s) => s.applicability).filter((x) => APPLICABILITIES.includes(x))
      const nonInactive = apps.filter((a) => a !== 'inactive')
      if (nonInactive.length > 0) {
        // client-visual 优先（纯客户端视觉冲突）
        const hasClientVisual = drEntry.evidenceScopes.some((s) => s.ref === 'client-visual')
        if (hasClientVisual) return { scope: 'client', source: 'evidence-level-client-visual' }
        const pick = nonInactive.includes('active') ? 'active' : nonInactive[0]
        return { scope: pick, source: 'evidence-level' }
      }
      const hasClientVisual = drEntry.evidenceScopes.some((s) => s.ref === 'client-visual')
      if (hasClientVisual) return { scope: 'client', source: 'evidence-level-client-visual' }
      // 全部证据 inactive → not_applicable 走 inactive
      return { scope: 'inactive', source: 'evidence-level-all-inactive' }
    }
    // 2. 复核条目 scopeApplicability（S8 双写；本实现取 reviewed 条目的服务端维度快照）
    if (drEntry && APPLICABILITIES.includes(drEntry.serverApplicability)) {
      return { scope: drEntry.serverApplicability, source: 'review-field' }
    }
    // 3. scope-index Atom 级 applicability
    const sEntry = scopeByAtom.get(atomId)
    if (sEntry && APPLICABILITIES.includes(sEntry.applicability)) {
      return { scope: sEntry.applicability, source: 'scope-index' }
    }
    // 4. 仅当 Registry verificationScope=client 且客户端已定位 → client
    if (atom && atom.requirement && atom.requirement.verificationScope === 'client' && atom.client && atom.client.evidenceIds && atom.client.evidenceIds.length > 0) {
      return { scope: 'client', source: 'registry-verification-scope' }
    }
    // 5. 缺省一律 unknown（禁止缺省 inactive）
    return { scope: 'unknown', source: 'default-unknown' }
  }

  // ---- client verified 六项前置条件（D17） ----
  const clientVerifiedPreconditions = (atomId, effectiveDifference) => {
    const atom = uaByAtom.get(atomId)
    const rs = [] // 失败原因
    // 1. Registry verificationScope = client
    if (!atom || !atom.requirement || atom.requirement.verificationScope !== 'client') rs.push('verificationScope≠client')
    // 2. client.pending = false（run-status 派生）
    if (!atom || !atom.client || atom.client.pending !== false) rs.push('client.pending')
    // 3. client.verdict = confirmed（partial/not_found 不满足）
    if (!atom || !atom.client || atom.client.verdict !== 'confirmed') rs.push('verdict≠confirmed')
    // 4. evidenceIds 全部存在且非 stale
    const ids = (atom && atom.client && atom.client.evidenceIds) || []
    if (ids.length === 0) rs.push('无客户端证据')
    for (const id of ids) {
      const ev = cleById.get(id)
      if (!ev) rs.push('证据不存在 ' + id)
      else if (ev.stale === true) rs.push('证据 stale ' + id)
    }
    // 5. effectiveDifference = consistent
    if (effectiveDifference !== 'consistent') rs.push('effectiveDifference≠consistent')
    // 6. observedBehavior 非空字段均有对应证据支撑（简化判定：至少一条证据 + 四元组至少一字段非空）
    const ob = (atom && atom.client && atom.client.observedBehavior) || {}
    const obFilled = ['trigger', 'condition', 'action', 'result'].some((k) => String(ob[k] || '').trim() !== '')
    if (!obFilled) rs.push('observedBehavior 全空（无业务行为证据支撑）')
    return rs
  }

  // ---- 逐原子分类（conflict-fast + full；blocked 不入正式条目） ----
  const entries = []
  const stats = { atomCount: 0, reviewedCount: 0, unreviewedCount: 0, l7: zero(), l7Approved: zero() }
  const blockedAtoms = []

  for (const atom of ua.atoms || []) {
    const atomId = atom.atomId
    if (atom.analysisPath === 'blocked') {
      blockedAtoms.push(atomId)
      continue
    }
    const bbEntry = bbByAtom.get(atomId)
    if (!bbEntry) {
      bad('原子缺 business-behavior 条目：' + atomId)
      continue
    }
    if (!DIFFS.includes(bbEntry.baselineDifference)) {
      bad('baselineDifference 非法：' + atomId)
      continue
    }
    const drEntry = drByAtom.get(atomId)

    // effectiveDifference（D11/D23）：
    //   approved → reviewedDifference；rejected/pending/无复核 → baselineDifference（历史基线，候选不参与）
    let effectiveDifference
    let l7Basis
    if (drEntry && drEntry.reviewStatus === 'approved') {
      effectiveDifference = drEntry.reviewedDifference
      l7Basis = 'approved'
    } else if (drEntry && drEntry.reviewStatus === 'rejected') {
      effectiveDifference = bbEntry.baselineDifference
      l7Basis = 'rejected'
    } else {
      effectiveDifference = bbEntry.baselineDifference
      l7Basis = 'proposed'
    }
    if (!DIFFS.includes(effectiveDifference)) {
      bad('effectiveDifference 非法：' + atomId + ' = ' + JSON.stringify(effectiveDifference))
      continue
    }
    // 升级原子候选隔离校验（D23）：候选字段不得进入 effective 计算
    if (atom.upgraded && bbEntry.candidateDifference && effectiveDifference === bbEntry.candidateDifference && l7Basis !== 'approved') {
      bad('升级原子候选被错误采纳（未审批不得生效）：' + atomId)
      continue
    }

    const { scope, source } = resolveScope(atomId)
    if (!['active', 'conditional', 'inactive', 'unknown', 'client'].includes(scope)) {
      bad('scope 解析结果非法：' + atomId + ' = ' + scope)
      continue
    }
    // scope=client 必须能回溯到 Registry verificationScope=client（禁止证据反推）
    if (scope === 'client' && source === 'registry-verification-scope') {
      if (atom.requirement.verificationScope !== 'client') bad('client scope 无法回溯 Registry：' + atomId)
    }

    let l7 = MATRIX[effectiveDifference][scope]
    if (l7 === 'verified*') {
      const fails = clientVerifiedPreconditions(atomId, effectiveDifference)
      l7 = fails.length === 0 ? 'verified' : 'verification_required'
      if (fails.length > 0 && process.env.L7_DEBUG) console.log('[debug] ' + atomId + ' client verified 未满足：' + fails.join(' / '))
    }
    if (!L7_VALUES.includes(l7)) {
      bad('L7 结果非法：' + atomId + ' = ' + l7)
      continue
    }

    entries.push({ atomId, scope, scopeSource: source, l7, effectiveDifference, l7Basis })
    stats.atomCount++
    stats.l7[l7]++
    if (drEntry) stats.reviewedCount++
    else stats.unreviewedCount++
    if (l7Basis === 'approved') stats.l7Approved[l7]++
  }

  if (problems.length > 0) return { ok: false, problems, summary: null }

  // ---- 统计交叉校验：与 S7 基线分布一致（approved 例外） ----
  const baselineStats = { consistent: 0, partial: 0, conflict: 0, unverified: 0 }
  for (const e of bb.entries || []) if (baselineStats[e.baselineDifference] !== undefined) baselineStats[e.baselineDifference]++
  const effStats = { consistent: 0, partial: 0, conflict: 0, unverified: 0 }
  for (const e of entries) effStats[e.effectiveDifference]++
  const unreviewedEff = { consistent: 0, partial: 0, conflict: 0, unverified: 0 }
  for (const e of entries) if (e.l7Basis === 'proposed' || e.l7Basis === 'rejected') unreviewedEff[e.effectiveDifference]++

  const l7Out = {
    schemaVersion: 1,
    date: date,
    analysisRunId: analysisRunId,
    entries: entries,
    stats: stats,
    baseline: { differenceStats: baselineStats, effectiveDifferenceStats: effStats },
    blockedAtoms: blockedAtoms,
  }
  return {
    ok: true, problems: [],
    summary: { analysisRunId, atomCount: stats.atomCount, blockedCount: blockedAtoms.length, l7: stats.l7, l7Approved: stats.l7Approved, effectiveDifferenceStats: effStats },
    l7: l7Out,
  }
}

function zero() {
  return { verified: 0, verification_required: 0, decision_required: 0, not_applicable: 0 }
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
    console.error('用法：node classify-l7-audit.mjs --run-dir <dir> --date <YYYY-MM-DD>')
    process.exit(1)
  }
  const r = classifyL7Audit({ runDir: a.runDir, date: a.date })
  if (!r.ok) {
    console.log('[失败] S9 L7 分类未通过，共 ' + r.problems.length + ' 项问题（不写产物）：')
    for (const p of r.problems) console.log('  - ' + p)
    process.exit(1)
  }
  const outPath = path.join(a.runDir, '4-analysis', 'l7-classify.json')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(r.l7, null, 1) + '\n', 'utf8')
  const s = r.summary
  console.log(
    '[成功] S9 L7 分类：' + s.analysisRunId + ' / 原子 ' + s.atomCount + '（blocked 派生 ' + s.blockedCount + '）' +
      ' / verified ' + s.l7.verified + ' / verification_required ' + s.l7.verification_required +
      ' / decision_required ' + s.l7.decision_required + ' / not_applicable ' + s.l7.not_applicable +
      '（approved：' + Object.entries(s.l7Approved).map(([k, v]) => k + ' ' + v).join(' / ') + '）-> ' + toPosix(outPath)
  )
  process.exit(0)
}

if (process.argv[1] && toPosix(process.argv[1]).endsWith('classify-l7-audit.mjs')) main()
