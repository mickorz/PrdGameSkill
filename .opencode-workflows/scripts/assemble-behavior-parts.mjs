// ============================================================
// assemble-behavior-parts.mjs —— S7 business-behavior 分片确定性汇总
//
// 执行文档 §5 S7、§14.2。职责（agent 只写 runtime 分片，本脚本唯一写正式产物）：
//   1. 按 --parts 清单读取 behavior-output 分片（文件名字典序处理）；
//   2. 校验：analysisRunId 一致、条目唯一、atomId 属 unified-atoms 的 conflict-fast/full 原子、
//      枚举合法、conflict 必带 baselineDetail + 证据、升级原子锚点（previousRunId 与 S6 一致）；
//   3. 汇总写 <runDir>/4-analysis/business-behavior.json + runtime/behavior-recount.json。
//
// CLI：node assemble-behavior-parts.mjs --run-dir <dir> --date <YYYY-MM-DD> --parts <f1,f2,...>
//   退出码：0 成功 / 1 失败
// ============================================================

import fs from 'node:fs'
import path from 'node:path'

const DIFFS = ['consistent', 'partial', 'conflict', 'unverified']
const PATHS_OK = ['conflict-fast', 'full']
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
const toPosix = (p) => String(p).replaceAll('\\', '/')

function readJsonSafe(p) {
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(p, 'utf8')) }
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) }
  }
}

export function assembleBehaviorParts(input) {
  const problems = []
  const bad = (m) => problems.push(m)
  const I = input || {}
  const runDir = I.runDir
  const date = String(I.date || '')
  const parts = String(I.parts || '').split(',').map((s) => s.trim()).filter(Boolean)

  if (!runDir) bad('runDir 缺失')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) bad('date 非法：' + date)
  if (parts.length === 0) bad('--parts 为空')
  if (problems.length > 0) return { ok: false, problems, summary: null }

  const uaRead = readJsonSafe(path.join(runDir, '4-analysis', 'unified-atoms.json'))
  if (!uaRead.ok) return { ok: false, problems: ['unified-atoms.json 不可读：' + uaRead.error], summary: null }
  const ua = uaRead.data
  const analysisRunId = String(ua.analysisRunId || '')
  const uaByAtom = new Map((ua.atoms || []).map((a) => [a.atomId, a]))

  const outDir = path.join(runDir, '4-analysis', 'runtime', 'behavior-output')
  const entries = []
  const seen = new Set()

  for (const file of parts.slice().sort(cmp)) {
    const r = readJsonSafe(path.join(outDir, file))
    if (!r.ok) {
      bad('分片不可读：' + file + ' -> ' + r.error)
      continue
    }
    const doc = r.data
    if (doc.analysisRunId !== analysisRunId) {
      bad(file + '：analysisRunId 与 unified-atoms 不一致：' + doc.analysisRunId)
      continue
    }
    if (!Array.isArray(doc.entries)) {
      bad(file + '：entries 非数组')
      continue
    }
    for (const e of doc.entries) {
      const atomId = String(e && e.atomId || '')
      const atom = uaByAtom.get(atomId)
      if (!atom) {
        bad(file + '：条目 atomId 不在 unified-atoms：' + atomId)
        continue
      }
      if (atom.analysisPath === 'blocked') {
        bad(file + '：blocked 原子不得有 business-behavior 条目：' + atomId)
        continue
      }
      if (seen.has(atomId)) {
        bad(file + '：条目重复：' + atomId)
        continue
      }
      seen.add(atomId)
      if (!PATHS_OK.includes(e.analysisPath)) {
        bad(file + '：analysisPath 非法：' + atomId + ' = ' + JSON.stringify(e.analysisPath))
        continue
      }
      if (e.analysisPath !== atom.analysisPath) {
        bad(file + '：analysisPath 与 S6 判定不一致：' + atomId + ' ' + e.analysisPath + ' vs ' + atom.analysisPath)
        continue
      }
      if (!DIFFS.includes(e.baselineDifference)) {
        bad(file + '：baselineDifference 枚举非法：' + atomId + ' = ' + JSON.stringify(e.baselineDifference))
        continue
      }
      if (e.baselineDifference === 'conflict' && !String(e.baselineDetail || '').trim()) {
        bad(file + '：baselineDifference=conflict 但 baselineDetail 为空：' + atomId)
        continue
      }
      if (e.baselineDifference === 'conflict' && (!Array.isArray(e.evidenceIds) || e.evidenceIds.length === 0)) {
        bad(file + '：baselineDifference=conflict 但无证据：' + atomId)
        continue
      }
      if (e.candidateDifference && !DIFFS.includes(e.candidateDifference)) {
        bad(file + '：candidateDifference 枚举非法：' + atomId)
        continue
      }
      // 升级原子锚点（D25）：previousRunId 必须与 S6 一致
      if (atom.upgraded) {
        if (String(e.previousRunId || '') !== String(atom.previousRunId || '')) {
          bad(file + '：升级原子 previousRunId 与 S6 不一致：' + atomId + ' ' + e.previousRunId + ' vs ' + atom.previousRunId)
          continue
        }
        if (e.candidateDifference && e.candidateDifference !== e.baselineDifference && !String(e.candidateDetail || '').trim()) {
          bad(file + '：升级原子候选 ≠ 基线时 candidateDetail 必填：' + atomId)
          continue
        }
      } else if (e.candidateDifference) {
        bad(file + '：非升级原子 candidateDifference 必须为空：' + atomId)
        continue
      }
      entries.push({
        atomId: atomId,
        analysisPath: e.analysisPath,
        analysisRunId: analysisRunId,
        previousRunId: String(e.previousRunId || ''),
        previousBaselineDifference: String(e.previousBaselineDifference || ''),
        trigger: String(e.trigger || ''),
        condition: String(e.condition || ''),
        clientAction: String(e.clientAction || ''),
        serverAction: String(e.serverAction || ''),
        collaboration: String(e.collaboration || ''),
        result: String(e.result || ''),
        baselineDifference: e.baselineDifference,
        baselineDetail: String(e.baselineDetail || ''),
        candidateDifference: String(e.candidateDifference || ''),
        candidateDetail: String(e.candidateDetail || ''),
        evidenceIds: Array.isArray(e.evidenceIds) ? e.evidenceIds.filter(Boolean) : [],
      })
    }
  }

  // 覆盖校验：conflict-fast + full 原子每恰一条
  for (const a of ua.atoms || []) {
    if (a.analysisPath === 'blocked') continue
    if (!seen.has(a.atomId)) bad('原子缺 business-behavior 条目：' + a.atomId + '（' + a.analysisPath + '）')
  }
  if (problems.length > 0) return { ok: false, problems, summary: null }

  entries.sort((a, b) => cmp(a.atomId, b.atomId))
  const stats = { atomCount: entries.length, consistent: 0, partial: 0, conflict: 0, unverified: 0, conflictFast: 0, upgraded: 0 }
  for (const e of entries) {
    stats[e.baselineDifference]++
    if (e.analysisPath === 'conflict-fast') stats.conflictFast++
    const atom = uaByAtom.get(e.atomId)
    if (atom && atom.upgraded) stats.upgraded++
  }

  return {
    ok: true,
    problems: [],
    summary: { analysisRunId, stats, partCount: parts.length },
    businessBehavior: { schemaVersion: 1, analysisRunId: analysisRunId, date: date, entries: entries, stats: stats },
  }
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
    else if (argv[i] === '--parts') a.parts = argv[++i]
  }
  if (!a.runDir || !a.date || !a.parts) {
    console.error('用法：node assemble-behavior-parts.mjs --run-dir <dir> --date <YYYY-MM-DD> --parts <f1,f2,...>')
    process.exit(1)
  }
  const r = assembleBehaviorParts({ runDir: a.runDir, date: a.date, parts: a.parts })
  if (!r.ok) {
    console.log('[失败] S7 分片汇总校验未通过，共 ' + r.problems.length + ' 项问题（不写产物）：')
    for (const p of r.problems) console.log('  - ' + p)
    process.exit(1)
  }
  const bbPath = path.join(a.runDir, '4-analysis', 'business-behavior.json')
  fs.mkdirSync(path.dirname(bbPath), { recursive: true })
  fs.writeFileSync(bbPath, JSON.stringify(r.businessBehavior, null, 1) + '\n', 'utf8')
  const recountPath = path.join(a.runDir, '4-analysis', 'runtime', 'behavior-recount.json')
  fs.writeFileSync(recountPath, JSON.stringify({ schemaVersion: 1, generatedBy: 'assemble-behavior-parts.mjs', date: a.date, analysisRunId: r.summary.analysisRunId, partCount: r.summary.partCount, stats: r.summary.stats }, null, 1) + '\n', 'utf8')
  const s = r.summary.stats
  console.log(
    '[成功] S7 分片汇总：' + r.summary.analysisRunId + ' / 分片 ' + r.summary.partCount + ' / 原子 ' + s.atomCount +
      '（consistent ' + s.consistent + ' / partial ' + s.partial + ' / conflict ' + s.conflict +
      ' / unverified ' + s.unverified + '；conflict-fast ' + s.conflictFast + ' / 升级 ' + s.upgraded + '）-> ' + toPosix(bbPath)
  )
  process.exit(0)
}

if (process.argv[1] && toPosix(process.argv[1]).endsWith('assemble-behavior-parts.mjs')) main()
