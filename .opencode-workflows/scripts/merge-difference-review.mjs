// ============================================================
// merge-difference-review.mjs —— S8 统一差异复核合并（双栏证据 + 审批状态机）
//
// 执行文档 §5 S8、§8 D11/D23、§1 原则 8。
//
// 职责（确定性装配，唯一写者；agent 只写 runtime/review-output 分片）：
//   1. 归集 review-output/<stageId>-<cp|p><NN>.json（分支码元序）；
//   2. 校验：atomId 属 unified-atoms 的 conflict-fast/full 原子（blocked 不出条目）、
//      reviewedDifference 枚举、reviewRule 白名单前缀、conflict 必带 evidenceScopes、
//      evidenceScopes.ref 存在性；
//   3. 审批状态机（D11/§5 S8 表）：新条目一律 pending；既有条目本轮建议一致 → 保持 reviewStatus；
//      建议变化 → 重置 pending；rejected → effectiveDifference = baselineDifference（历史基线）；
//   4. 升级原子专项（D23）：previousDifference 锚历史基线（不取候选）、候选不参与 effective、
//      降级建议（conflict → 非 conflict）必须引用 candidateDifference + 双端证据；
//   5. 回填 l7/effectiveDifference/l7Basis 交由 S9 classify-l7-audit（本脚本只保证 S8 字段自洽）。
//
// 产物：<runDir>/4-analysis/difference-review.json
//
// 可导入：export mergeDifferenceReview({ runDir, date })
//   返回 { ok, problems, summary, differenceReview }
//
// CLI：node merge-difference-review.mjs --run-dir <dir> --date <YYYY-MM-DD>
//   退出码：0 成功 / 1 失败
// ============================================================

import fs from 'node:fs'
import path from 'node:path'

const DIFFS = ['consistent', 'partial', 'conflict', 'unverified']
const REVIEW_STATUSES = ['pending', 'approved', 'rejected']
// reviewRule 前缀白名单（v3.2：双端合并口径 + 升级降级专用）
const RULE_PREFIXES = [
  'no-server-evidence-is-not-conflict',
  'evidence-is-not-consistency',
  'common-capability-is-not-enabled',
  'ui-conflict-stands-alone',
  'conflict-not-sustained',
  'dual-side-collaboration-gap',
]

function readJsonSafe(p) {
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(p, 'utf8')) }
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) }
  }
}
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
const toPosix = (p) => String(p).replaceAll('\\', '/')

export function mergeDifferenceReview(input) {
  const problems = []
  const bad = (m) => problems.push(m)
  const I = input || {}
  const runDir = I.runDir
  const date = String(I.date || '')
  if (!runDir) bad('runDir 缺失')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) bad('date 非法：' + date)
  if (problems.length > 0) return { ok: false, problems, summary: null }

  const uaRead = readJsonSafe(path.join(runDir, '4-analysis', 'unified-atoms.json'))
  const bbRead = readJsonSafe(path.join(runDir, '4-analysis', 'business-behavior.json'))
  const cleRead = readJsonSafe(path.join(runDir, '2-client', 'client-evidence.json'))
  const sveRead = readJsonSafe(path.join(runDir, '3-server', 'server-evidence.json'))
  const drPath = path.join(runDir, '4-analysis', 'difference-review.json')
  const drRead = readJsonSafe(drPath)
  if (!uaRead.ok) bad('unified-atoms.json 不可读（先跑 S6）：' + uaRead.error)
  if (!bbRead.ok) bad('business-behavior.json 不可读（先跑 S7）：' + bbRead.error)
  if (!cleRead.ok) bad('client-evidence.json 不可读：' + cleRead.error)
  if (!sveRead.ok) bad('server-evidence.json 不可读：' + sveRead.error)
  if (problems.length > 0) return { ok: false, problems, summary: null }

  const ua = uaRead.data
  const bb = bbRead.data
  const analysisRunId = String(ua.analysisRunId || '')
  if (bb.analysisRunId !== analysisRunId) bad('business-behavior.analysisRunId 与 unified-atoms 不一致')

  const atomMap = new Map((ua.atoms || []).map((a) => [a.atomId, a]))
  const bbByAtom = new Map((bb.entries || []).map((e) => [e.atomId, e]))
  const cleIds = new Set((cleRead.data.evidence || []).map((e) => e.id))
  const sveIds = new Set((sveRead.data.evidence || []).map((e) => e.id))

  // ---- 既有条目（幂等 + 审批状态保全） ----
  const formal = drRead.ok && Array.isArray(drRead.data.entries) ? drRead.data.entries : []
  const formalByAtom = new Map(formal.map((e) => [e.atomId, e]))

  // ---- 归集分片（分支码元序） ----
  const reviewDir = path.join(runDir, '3-server', 'runtime', 'review-output')
  let partNames = []
  if (fs.existsSync(reviewDir)) {
    partNames = fs.readdirSync(reviewDir).filter((n) => n.endsWith('.json')).sort(cmp)
  }
  const shardEntries = []
  for (const name of partNames) {
    const r = readJsonSafe(path.join(reviewDir, name))
    if (!r.ok) {
      bad('复核分片不可读：' + name + ' -> ' + r.error)
      continue
    }
    for (const e of Array.isArray(r.data.entries) ? r.data.entries : []) {
      shardEntries.push({ partName: name, e })
    }
  }

  // ---- 逐条校验 + 装配 ----
  const seen = new Set()
  const entriesOut = []
  const stats = { entryCount: 0, pending: 0, approved: 0, rejected: 0 }
  const byAtom = new Map()

  for (const { partName, e } of shardEntries) {
    const atomId = String(e && e.atomId || '')
    const atom = atomMap.get(atomId)
    if (!atom) {
      bad(partName + '：复核条目 atomId 不在 unified-atoms：' + atomId)
      continue
    }
    if (atom.analysisPath === 'blocked') {
      bad(partName + '：blocked 原子不得出复核条目（不入差异判定）：' + atomId)
      continue
    }
    if (seen.has(atomId)) {
      bad(partName + '：复核条目重复：' + atomId)
      continue
    }
    seen.add(atomId)

    const bbEntry = bbByAtom.get(atomId)
    if (!bbEntry) {
      bad(partName + '：原子缺 business-behavior 条目（S7 未覆盖）：' + atomId)
      continue
    }
    const reviewed = String(e.reviewedDifference || '')
    if (!DIFFS.includes(reviewed)) {
      bad(partName + '：reviewedDifference 非法：' + atomId + ' = ' + JSON.stringify(e.reviewedDifference))
      continue
    }
    const rule = String(e.reviewRule || '')
    if (!RULE_PREFIXES.some((p) => rule.startsWith(p))) {
      bad(partName + '：reviewRule 前缀不在白名单：' + atomId + ' -> ' + rule)
      continue
    }

    // previousDifference 锚 S7 基线（升级原子即历史基线，不取候选）
    if (e.previousDifference !== undefined && e.previousDifference !== bbEntry.baselineDifference) {
      bad(partName + '：previousDifference 漂移（应 = S7 baselineDifference）：' + atomId +
        ' ' + e.previousDifference + ' vs ' + bbEntry.baselineDifference)
      continue
    }

    // conflict 必带证据级 evidenceScopes（含 ref 存在性）
    const scopes = Array.isArray(e.evidenceScopes) ? e.evidenceScopes : []
    if (reviewed === 'conflict' && scopes.length === 0) {
      bad(partName + '：reviewedDifference=conflict 必带 evidenceScopes：' + atomId)
      continue
    }
    let scopeRefBad = false
    for (const s of scopes) {
      const ref = String(s && s.ref || '')
      if (ref === 'client-visual') continue
      if (!cleIds.has(ref) && !sveIds.has(ref)) {
        bad(partName + '：evidenceScopes.ref 不存在于 CLE/SVE：' + atomId + ' -> ' + ref)
        scopeRefBad = true
      }
    }
    if (scopeRefBad) continue

    // ---- 升级原子专项（D23） ----
    const isUpgraded = atom.upgraded === true
    if (isUpgraded) {
      // 候选快照必须与 S7 一致（不手写漂移）
      if (e.candidateDifference !== undefined && e.candidateDifference !== (bbEntry.candidateDifference || '')) {
        bad(partName + '：升级原子 candidateDifference 与 S7 不一致：' + atomId)
        continue
      }
      // 降级建议（历史 conflict → 非 conflict）必须引用候选 + 双端证据
      if (bbEntry.baselineDifference === 'conflict' && reviewed !== 'conflict') {
        const reason = String(e.reviewReason || '')
        if (!reason.trim()) {
          bad(partName + '：升级原子降级建议必须给 reviewReason（引用候选 + 双端证据）：' + atomId)
          continue
        }
        const hasDualRef = /CLE-|SVE-|client|server/i.test(reason)
        if (!hasDualRef) {
          bad(partName + '：升级原子降级建议 reviewReason 未引用双端证据（CLE/SVE 或 client/server）：' + atomId)
          continue
        }
      }
    } else if (e.candidateDifference) {
      bad(partName + '：非升级原子 candidateDifference 必须为空：' + atomId)
      continue
    }

    // ---- 审批状态机（D11） ----
    const prev = formalByAtom.get(atomId)
    let reviewStatus = 'pending'
    if (prev) {
      if (REVIEW_STATUSES.includes(prev.reviewStatus)) reviewStatus = prev.reviewStatus
      // 建议变化（结论或规则不同）→ 重置 pending（新建议需人工重新批准）
      if (prev.reviewedDifference !== reviewed || prev.reviewRule !== rule) reviewStatus = 'pending'
    }
    if (e.reviewStatus !== undefined && !REVIEW_STATUSES.includes(e.reviewStatus)) {
      bad(partName + '：reviewStatus 非法：' + atomId + ' = ' + JSON.stringify(e.reviewStatus))
      continue
    }

    const entry = {
      atomId: atomId,
      previousDifference: bbEntry.baselineDifference,
      candidateDifference: isUpgraded ? bbEntry.candidateDifference || '' : '',
      clientVerdict: atom.client.verdict || '',
      serverApplicability: atom.server.applicability || '',
      reviewedDifference: reviewed,
      reviewReason: String(e.reviewReason || ''),
      reviewRule: rule,
      reviewStatus: reviewStatus,
      evidenceScopes: scopes.map((s) => ({
        ref: String(s.ref || ''),
        layer: String(s.layer || ''),
        applicability: String(s.applicability || ''),
        note: String(s.note || ''),
      })),
    }
    entriesOut.push(entry)
    byAtom.set(atomId, entry)
    stats.entryCount++
    stats[reviewStatus]++
  }

  // 既有已审批条目（本轮无新建议）保全：保留原条目（幂等，不因未提交分片而丢失审批结果）
  for (const prev of formal) {
    if (byAtom.has(prev.atomId)) continue
    const atom = atomMap.get(prev.atomId)
    if (!atom || atom.analysisPath === 'blocked') continue
    entriesOut.push(prev)
    byAtom.set(prev.atomId, prev)
    stats.entryCount++
    if (REVIEW_STATUSES.includes(prev.reviewStatus)) stats[prev.reviewStatus]++
  }

  if (problems.length > 0) return { ok: false, problems, summary: null }

  // 稳定排序（atomId 码元序）—— 顺序无关性
  entriesOut.sort((a, b) => cmp(a.atomId, b.atomId))

  const differenceReview = {
    schemaVersion: 2,
    analysisRunId: analysisRunId,
    date: date,
    entries: entriesOut,
    baseline: { differenceStats: computeBaselineStats(bb) },
  }
  return { ok: true, problems: [], summary: { analysisRunId, stats }, differenceReview }
}

function computeBaselineStats(bb) {
  const s = { consistent: 0, partial: 0, conflict: 0, unverified: 0 }
  for (const e of bb.entries || []) {
    if (s[e.baselineDifference] !== undefined) s[e.baselineDifference]++
  }
  return s
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
    console.error('用法：node merge-difference-review.mjs --run-dir <dir> --date <YYYY-MM-DD>')
    process.exit(1)
  }
  const r = mergeDifferenceReview({ runDir: a.runDir, date: a.date })
  if (!r.ok) {
    console.log('[失败] S8 差异复核合并未通过，共 ' + r.problems.length + ' 项问题（不写产物）：')
    for (const p of r.problems) console.log('  - ' + p)
    process.exit(1)
  }
  const outPath = path.join(a.runDir, '4-analysis', 'difference-review.json')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(r.differenceReview, null, 1) + '\n', 'utf8')
  const s = r.summary.stats
  console.log(
    '[成功] S8 差异复核：' + r.summary.analysisRunId + ' / 条目 ' + s.entryCount +
      '（pending ' + s.pending + ' / approved ' + s.approved + ' / rejected ' + s.rejected + '）-> ' + toPosix(outPath)
  )
  process.exit(0)
}

if (process.argv[1] && toPosix(process.argv[1]).endsWith('merge-difference-review.mjs')) main()
