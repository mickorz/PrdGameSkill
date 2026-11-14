// classify-l7.mjs —— L7 分类计算器（确定性命令，OSG-W4 S1.1）
//
// 职责：按设计文档 4.1 矩阵（reviewedDifference × 证据级 scopeApplicability → l7）
//   对 difference-review 复核条目做确定性 L7 分类，产出 l7-classify.json。
//
// 数据流（设计文档 dev-docs/design/2026-11-14-OSG-W4-L7分类与玩法配置作用域设计.md）：
//
//   feature_index.json（v2 基线）──┐
//   scope-index.json（作用域判定）──┼─> classifyL7 ──> l7-classify.json
//   server-evidence.json（证据）───┤      │
//   difference-review.json（复核）─┘      └─ 逐条：scope 解析 → l7 矩阵 → effectiveDifference
//
// 输入四件套（缺一不可，设计文档 4.4）：
//   1. feature_index.json     —— v2 客户端基线（previousDifference 来源 + atom_count 自洽）
//   2. scope-index.json       —— 作用域判定（Atom 级 applicability + 证据级 evidenceScopes）
//   3. server-evidence.json   —— 服务端证据（evidenceIds 存在性校验）
//   4. difference-review.json —— 差异复核建议（reviewedDifference / reviewStatus 与手写统计交叉校验）
//
// 判定规则：
//   - l7 矩阵（设计 4.1）：consistent+active 才 verified；conflict 除 inactive 外一律
//     decision_required（客户端视觉冲突独立成立，不因 scope 未知而降级）；
//     inactive 列一律 not_applicable；consistent 在 conditional 下不算 verified。
//   - scope 解析优先级（设计 3.1）：复核条目 scopeApplicability > scope-index Atom 级
//     applicability > unknown；缺失作用域一律 unknown（未查证），禁止缺省 inactive。
//   - conflict 条目采用证据级 scope（设计 3.3）：有 evidenceScopes 时 client-visual
//     （客户端视觉证据）即冲突产生证据；仅全部证据 inactive 才可消除冲突判 not_applicable；
//     无 evidenceScopes 时 inactive 不可确认，按 unknown 处理，不得消除冲突。
//   - l7 与 reviewStatus 为独立维度（设计 4.1 二审固定）：effectiveDifference 在 approved
//     时取 reviewedDifference，pending/rejected 时取 previousDifference；未批准条目的 l7
//     仅为 proposed 建议（l7Basis），不入正式索引（正式索引只消费 l7Approved 统计）。
//
// 完整性校验（任一命中即 fail，不写输出）：
//   1. feature_index 可解析、atom_count 与实际原子数一致、原子 difference 齐全且枚举合法、ID 唯一
//   2. 复核条目 atomId 必须存在于基线；previousDifference 必须与基线一致（复核漂移检测）
//   3. 复核条目 evidenceIds 必须存在于 server-evidence；server-evidence / scope-index
//      的 atomId 同样必须在基线；evidenceScopes.ref 必须是 SVE id 或 client-visual
//   4. reviewedDifference / reviewStatus / scopeApplicability 枚举合法；复核条目 atomId 唯一
//   5. 手写统计交叉校验（禁止手工填预测值，二审意见 1 同源规则）：
//      条目 l7 / effectiveDifference / l7Basis 与矩阵重算不一致 → fail；
//      difference-review 顶层 baseline.differenceStats / afterReviewProjection / l7Projection
//      与确定性重算不一致 → fail；feature_index.difference_stats、scope-index.stats 同理
//
// 可导入：export classifyL7(data, opts) —— data 为四件套已解析 JSON 对象，
//         opts = { date?, inputs? }（inputs 为四件套路径，仅透传进输出 meta）
//         返回 { ok, problems, summary, output }，不直接退出进程
// CLI 用法：
//   node classify-l7.mjs <featureIndex> <scopeIndex> <serverEvidence> <differenceReview> <outputJson> [date]
//
// 输出（l7-classify.json）：仅覆盖已复核原子（未复核原子无 L7 分类，待 S3 复核）；
//   stats.l7Approved 为 approved 条目的 l7 分布（正式索引可见部分）。
//
// 退出码（CLI）：0 成功并写输出 / 1 参数缺失、文件读取或 JSON 解析失败、完整性校验失败（不写输出）

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const L7_MATRIX = {
  consistent: { active: 'verified', conditional: 'verification_required', unknown: 'verification_required', inactive: 'not_applicable' },
  partial: { active: 'verification_required', conditional: 'verification_required', unknown: 'verification_required', inactive: 'not_applicable' },
  conflict: { active: 'decision_required', conditional: 'decision_required', unknown: 'decision_required', inactive: 'not_applicable' },
  unverified: { active: 'verification_required', conditional: 'verification_required', unknown: 'verification_required', inactive: 'not_applicable' },
}
const DIFF_VALUES = ['consistent', 'partial', 'conflict', 'unverified']
const SCOPE_VALUES = ['active', 'conditional', 'unknown', 'inactive']
const L7_VALUES = ['verified', 'verification_required', 'decision_required', 'not_applicable']
const REVIEW_STATUS_VALUES = ['pending', 'approved', 'rejected']
const L7_BASIS_BY_STATUS = { pending: 'proposed', approved: 'approved', rejected: 'rejected' }

function isDiff(v) {
  return typeof v === 'string' && DIFF_VALUES.includes(v)
}

function isScope(v) {
  return typeof v === 'string' && SCOPE_VALUES.includes(v)
}

// scope 解析：conflict 条目采用证据级 scope（设计 3.3），其余按 3.1 优先级链
// 返回 { scope, scopeSource, scopeNote }：
//   scopeSource ∈ review-field / scope-index-atom / missing-unknown /
//                 evidence-level-client-visual / evidence-level-all-inactive /
//                 evidence-level-no-elimination / *-inactive-unconfirmed
function resolveScope(reviewEntry, scopeEntry) {
  const reviewScope = typeof reviewEntry.scopeApplicability === 'string' && reviewEntry.scopeApplicability.trim() !== '' ? reviewEntry.scopeApplicability : ''
  const atomScope = scopeEntry && typeof scopeEntry.applicability === 'string' && scopeEntry.applicability.trim() !== '' ? scopeEntry.applicability : ''
  const candidate = reviewScope !== '' ? reviewScope : atomScope !== '' ? atomScope : 'unknown'
  const candidateSource = reviewScope !== '' ? 'review-field' : atomScope !== '' ? 'scope-index-atom' : 'missing-unknown'

  if (reviewEntry.reviewedDifference !== 'conflict') {
    return { scope: candidate, scopeSource: candidateSource, scopeNote: '' }
  }

  const scopes = Array.isArray(scopeEntry && scopeEntry.evidenceScopes) ? scopeEntry.evidenceScopes.filter((s) => s && s.ref) : []
  if (scopes.length > 0) {
    const cv = scopes.find((s) => s.ref === 'client-visual')
    if (cv) {
      return {
        scope: cv.applicability,
        scopeSource: 'evidence-level-client-visual',
        scopeNote: '冲突判定采用证据级 scope：冲突产生证据为客户端视觉证据（client-visual），其作用域即判定依据，不受其他服务端证据 inactive/conditional 影响',
      }
    }
    if (scopes.every((s) => s.applicability === 'inactive')) {
      return {
        scope: 'inactive',
        scopeSource: 'evidence-level-all-inactive',
        scopeNote: '全部证据已确认 inactive，冲突产生证据必然 inactive，判 not_applicable',
      }
    }
    return {
      scope: scopes.some((s) => s.applicability === 'active') ? 'active' : 'conditional',
      scopeSource: 'evidence-level-no-elimination',
      scopeNote: '存在非 inactive 证据，无法定位冲突产生证据时冲突不降级（decision_required）',
    }
  }
  if (candidate === 'inactive') {
    return {
      scope: 'unknown',
      scopeSource: candidateSource + '-inactive-unconfirmed',
      scopeNote: 'conflict 条目无证据级 evidenceScopes，inactive 不可确认，按 unknown 处理，不得消除冲突',
    }
  }
  return { scope: candidate, scopeSource: candidateSource, scopeNote: '' }
}

export function classifyL7(data, opts = {}) {
  const problems = []
  const bad = (msg) => problems.push(msg)
  const { featureIndex, scopeIndex, serverEvidence, differenceReview } = data || {}
  if (!featureIndex || !scopeIndex || !serverEvidence || !differenceReview) {
    bad('输入四件套缺失：featureIndex / scopeIndex / serverEvidence / differenceReview 任一为空')
    return { ok: false, problems: problems, summary: null, output: null }
  }

  // 1. 基线展开：atomId -> { difference, stageId, featureId }；ID 唯一 + atom_count 自洽 + difference 齐全
  const atomMap = new Map()
  for (const fe of featureIndex.features || []) {
    for (const at of fe.atoms || []) {
      if (atomMap.has(at.id)) bad('基线原子 ID 重复：' + at.id)
      atomMap.set(at.id, { difference: at.difference, stageId: fe.stage_id, featureId: fe.id })
    }
  }
  if (featureIndex.atom_count !== undefined && featureIndex.atom_count !== atomMap.size) {
    bad('feature_index atom_count 自洽失败：header=' + featureIndex.atom_count + ' 实际=' + atomMap.size)
  }
  for (const [id, a] of atomMap) {
    if (!isDiff(a.difference)) bad('基线原子 difference 缺失或非法：' + id + ' -> ' + a.difference)
  }
  const baselineStats = { consistent: 0, partial: 0, conflict: 0, unverified: 0 }
  for (const a of atomMap.values()) if (isDiff(a.difference)) baselineStats[a.difference]++
  if (featureIndex.difference_stats) {
    for (const k of DIFF_VALUES) {
      if (featureIndex.difference_stats[k] !== baselineStats[k]) {
        bad('feature_index.difference_stats 与原子重算不一致：' + k + ' header=' + featureIndex.difference_stats[k] + ' 重算=' + baselineStats[k])
      }
    }
  }

  // 2. server-evidence：id 唯一 + atomId 在基线
  const sveIds = new Set()
  for (const e of serverEvidence.entries || []) {
    if (sveIds.has(e.id)) bad('server-evidence 证据 ID 重复：' + e.id)
    sveIds.add(e.id)
    if (!atomMap.has(e.atomId)) bad('server-evidence atomId 不在基线：' + e.id + ' -> ' + e.atomId)
  }

  // 3. scope-index：atomId 唯一且在基线、applicability 合法、evidenceScopes 合法、stats 重算
  const scopeMap = new Map()
  const scopeStats = { active: 0, conditional: 0, unknown: 0, inactive: 0 }
  for (const e of scopeIndex.entries || []) {
    if (scopeMap.has(e.atomId)) bad('scope-index 条目 atomId 重复：' + e.atomId)
    if (!atomMap.has(e.atomId)) bad('scope-index atomId 不在基线：' + e.atomId)
    if (!isScope(e.applicability)) bad('scope-index applicability 缺失或非法：' + e.atomId + ' -> ' + e.applicability)
    for (const es of e.evidenceScopes || []) {
      if (!es || !es.ref) bad('scope-index evidenceScopes 缺 ref：' + e.atomId)
      else if (!isScope(es.applicability)) bad('scope-index evidenceScopes applicability 缺失或非法：' + e.atomId + ' / ' + es.ref)
      else if (es.ref !== 'client-visual' && !sveIds.has(es.ref)) bad('scope-index evidenceScopes ref 不在 server-evidence：' + e.atomId + ' / ' + es.ref)
    }
    if (atomMap.has(e.atomId)) scopeMap.set(e.atomId, e)
    if (isScope(e.applicability)) scopeStats[e.applicability]++
  }
  if (scopeIndex.stats) {
    for (const k of SCOPE_VALUES) {
      if (scopeIndex.stats[k] !== scopeStats[k]) {
        bad('scope-index.stats 与条目重算不一致：' + k + ' 手写=' + scopeIndex.stats[k] + ' 重算=' + scopeStats[k])
      }
    }
  }

  // 4. difference-review 顶层 baseline.differenceStats 交叉校验
  if (differenceReview.baseline && differenceReview.baseline.differenceStats) {
    for (const k of DIFF_VALUES) {
      const v = differenceReview.baseline.differenceStats[k]
      if (v !== undefined && v !== baselineStats[k]) {
        bad('difference-review baseline.differenceStats 与基线重算不一致：' + k + ' 手写=' + v + ' 重算=' + baselineStats[k])
      }
    }
  }

  // 5. 逐条复核：完整性校验 + scope 解析 + l7 矩阵 + effectiveDifference/l7Basis 重算
  const reviewedIds = new Set()
  const outEntries = []
  const l7Stats = { verified: 0, verification_required: 0, decision_required: 0, not_applicable: 0 }
  const l7Approved = { verified: 0, verification_required: 0, decision_required: 0, not_applicable: 0 }
  const effStats = { consistent: 0, partial: 0, conflict: 0, unverified: 0 }
  const statusStats = { pending: 0, approved: 0, rejected: 0 }
  const transitions = []

  for (const e of differenceReview.entries || []) {
    if (!e || !e.atomId) {
      bad('复核条目缺 atomId')
      continue
    }
    if (reviewedIds.has(e.atomId)) {
      bad('复核条目 atomId 重复：' + e.atomId)
      continue
    }
    reviewedIds.add(e.atomId)
    const base = atomMap.get(e.atomId)
    if (!base) {
      bad('复核条目 atomId 不在基线：' + e.atomId)
      continue
    }
    if (!isDiff(e.previousDifference)) {
      bad('复核条目 previousDifference 缺失或非法：' + e.atomId + ' -> ' + e.previousDifference)
      continue
    }
    if (!isDiff(e.reviewedDifference)) {
      bad('复核条目 reviewedDifference 缺失或非法：' + e.atomId + ' -> ' + e.reviewedDifference)
      continue
    }
    if (!REVIEW_STATUS_VALUES.includes(e.reviewStatus)) {
      bad('复核条目 reviewStatus 缺失或非法：' + e.atomId + ' -> ' + e.reviewStatus)
      continue
    }
    if (e.previousDifference !== base.difference) {
      bad('复核条目 previousDifference 与基线漂移：' + e.atomId + ' 基线=' + base.difference + ' 复核=' + e.previousDifference)
    }
    if (e.scopeApplicability !== undefined && e.scopeApplicability !== '' && !isScope(e.scopeApplicability)) {
      bad('复核条目 scopeApplicability 非法：' + e.atomId + ' -> ' + e.scopeApplicability)
      continue
    }
    const evidenceIds = Array.isArray(e.evidenceIds) ? e.evidenceIds : []
    for (const id of evidenceIds) {
      if (!sveIds.has(id)) bad('复核条目 evidenceIds 不在 server-evidence：' + e.atomId + ' -> ' + id)
    }

    // 确定性分类：scope 解析 → 矩阵 → effectiveDifference / l7Basis
    const resolved = resolveScope(e, scopeMap.get(e.atomId))
    const l7 = L7_MATRIX[e.reviewedDifference][resolved.scope]
    const effectiveDifference = e.reviewStatus === 'approved' ? e.reviewedDifference : e.previousDifference
    const l7Basis = L7_BASIS_BY_STATUS[e.reviewStatus]

    // 手写字段交叉校验（禁止手工填预测值）
    if (e.l7 !== undefined && e.l7 !== l7) {
      bad('复核条目 l7 与矩阵重算不一致：' + e.atomId + ' 手写=' + e.l7 + ' 重算=' + l7)
    }
    if (e.effectiveDifference !== undefined && e.effectiveDifference !== effectiveDifference) {
      bad('复核条目 effectiveDifference 与重算不一致：' + e.atomId + ' 手写=' + e.effectiveDifference + ' 重算=' + effectiveDifference)
    }
    if (e.l7Basis !== undefined && e.l7Basis !== l7Basis) {
      bad('复核条目 l7Basis 与重算不一致：' + e.atomId + ' 手写=' + e.l7Basis + ' 重算=' + l7Basis)
    }

    if (e.reviewedDifference !== e.previousDifference) {
      transitions.push({ atomId: e.atomId, from: e.previousDifference, to: e.reviewedDifference })
    }
    l7Stats[l7]++
    if (e.reviewStatus === 'approved') l7Approved[l7]++
    effStats[effectiveDifference]++
    statusStats[e.reviewStatus]++

    const entry = {
      atomId: e.atomId,
      stageId: base.stageId,
      previousDifference: e.previousDifference,
      reviewedDifference: e.reviewedDifference,
      scopeApplicability: resolved.scope,
      scopeSource: resolved.scopeSource,
      l7: l7,
      reviewStatus: e.reviewStatus,
      effectiveDifference: effectiveDifference,
      l7Basis: l7Basis,
      evidenceIds: evidenceIds,
    }
    if (e.reviewRule !== undefined) entry.reviewRule = e.reviewRule
    if (e.reviewReason !== undefined) entry.reviewReason = e.reviewReason
    if (resolved.scopeNote) entry.scopeNote = resolved.scopeNote
    outEntries.push(entry)
  }

  // 6. afterReviewProjection 确定性迁移重算交叉校验（假设全部 approved）
  if (differenceReview.afterReviewProjection) {
    const proj = Object.assign({}, baselineStats)
    for (const t of transitions) {
      proj[t.from]--
      proj[t.to]++
    }
    const p = differenceReview.afterReviewProjection
    for (const k of DIFF_VALUES) {
      if (p[k] !== undefined && p[k] !== proj[k]) {
        bad('afterReviewProjection 与确定性迁移重算不一致：' + k + ' 手写=' + p[k] + ' 重算=' + proj[k])
      }
    }
    if (p.total !== undefined && p.total !== atomMap.size) {
      bad('afterReviewProjection.total 与基线原子数不一致：手写=' + p.total + ' 基线=' + atomMap.size)
    }
    if (Array.isArray(p.transitions)) {
      if (p.transitions.length !== transitions.length) {
        bad('afterReviewProjection.transitions 条数与重算不一致：手写=' + p.transitions.length + ' 重算=' + transitions.length)
      } else {
        const byId = new Map(transitions.map((t) => [t.atomId, t]))
        for (const t of p.transitions) {
          const m = byId.get(t.atomId)
          if (!m || m.from !== t.from || m.to !== t.to) {
            bad('afterReviewProjection.transitions 与重算不一致：' + t.atomId + '（from/to 不匹配）')
          }
        }
      }
    }
  }

  // 7. l7Projection 矩阵重算交叉校验
  if (differenceReview.l7Projection) {
    const p = differenceReview.l7Projection
    for (const k of L7_VALUES) {
      if (p[k] !== undefined && p[k] !== l7Stats[k]) {
        bad('l7Projection 与矩阵重算不一致：' + k + ' 手写=' + p[k] + ' 重算=' + l7Stats[k])
      }
    }
  }

  const atomCount = atomMap.size
  const reviewedCount = reviewedIds.size
  const unreviewedCount = atomCount - reviewedCount
  const output = {
    schemaVersion: 1,
    generatedBy: 'classify-l7.mjs（OSG-W4 S1.1）',
  }
  if (opts.date) output.date = opts.date
  if (opts.inputs) output.inputs = opts.inputs
  output.matrix = 'reviewedDifference × 证据级 scopeApplicability → l7（设计文档 4.1；conflict 证据级 scope 见 3.3）'
  if (scopeIndex.scopeTarget) output.scopeTarget = scopeIndex.scopeTarget
  output.note = '仅覆盖已复核原子，未复核原子无 L7 分类（待 S3 复核），消费方按无数据处理；l7 为业务分类、reviewStatus 为审批状态，二者独立；未批准条目 l7 仅为 proposed 建议（l7Basis），正式索引只消费 approved 条目（stats.l7Approved）'
  output.stats = {
    atomCount: atomCount,
    reviewedCount: reviewedCount,
    unreviewedCount: unreviewedCount,
    l7: l7Stats,
    l7Approved: l7Approved,
    effectiveDifference: effStats,
    reviewStatus: statusStats,
  }
  output.entries = outEntries

  const summary = {
    atomCount: atomCount,
    reviewedCount: reviewedCount,
    unreviewedCount: unreviewedCount,
    l7: l7Stats,
    l7Approved: l7Approved,
    effectiveDifference: effStats,
    reviewStatus: statusStats,
  }
  return { ok: problems.length === 0, problems: problems, summary: summary, output: output }
}

// ============================================================
// CLI
// ============================================================

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2)
  if (argv.length < 5 || argv.length > 6) {
    console.error('用法：node classify-l7.mjs <featureIndex> <scopeIndex> <serverEvidence> <differenceReview> <outputJson> [date]')
    process.exit(1)
  }
  const readJson = (p, label) => {
    let raw
    try {
      raw = fs.readFileSync(p, 'utf8')
    } catch {
      console.error('[失败] ' + label + ' 读取失败：' + p)
      process.exit(1)
    }
    try {
      return JSON.parse(raw)
    } catch (e) {
      console.error('[失败] ' + label + ' JSON 解析失败：' + p + '（' + e.message + '）')
      process.exit(1)
    }
  }
  const inputPaths = {
    featureIndex: argv[0],
    scopeIndex: argv[1],
    serverEvidence: argv[2],
    differenceReview: argv[3],
  }
  const r = classifyL7(
    {
      featureIndex: readJson(inputPaths.featureIndex, 'feature_index'),
      scopeIndex: readJson(inputPaths.scopeIndex, 'scope-index'),
      serverEvidence: readJson(inputPaths.serverEvidence, 'server-evidence'),
      differenceReview: readJson(inputPaths.differenceReview, 'difference-review'),
    },
    { date: argv[5], inputs: inputPaths }
  )
  if (!r.ok) {
    console.error('[失败] 完整性校验未通过，共 ' + r.problems.length + ' 项问题（不写输出）：')
    for (const p of r.problems) console.error('  - ' + p)
    process.exit(1)
  }
  const outPath = argv[4]
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(r.output, null, 1) + '\n', 'utf8')
  const s = r.summary
  console.log('[成功] L7 分类完成：复核 ' + s.reviewedCount + ' / 未复核 ' + s.unreviewedCount + '（共 ' + s.atomCount + '），输出 ' + outPath)
  console.log('  l7：verified ' + s.l7.verified + ' / verification_required ' + s.l7.verification_required + ' / decision_required ' + s.l7.decision_required + ' / not_applicable ' + s.l7.not_applicable)
  console.log('  l7Approved（正式索引可见）：verified ' + s.l7Approved.verified + ' / verification_required ' + s.l7Approved.verification_required + ' / decision_required ' + s.l7Approved.decision_required + ' / not_applicable ' + s.l7Approved.not_applicable)
  console.log('  effectiveDifference：consistent ' + s.effectiveDifference.consistent + ' / partial ' + s.effectiveDifference.partial + ' / conflict ' + s.effectiveDifference.conflict + ' / unverified ' + s.effectiveDifference.unverified)
  console.log('  reviewStatus：pending ' + s.reviewStatus.pending + ' / approved ' + s.reviewStatus.approved + ' / rejected ' + s.reviewStatus.rejected)
  process.exit(0)
}
