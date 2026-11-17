// ============================================================
// append-analysis-history.mjs —— S7 分析历史 append-only 落盘
//
// 执行文档 §5 S7 产物 2、§7 历史保全、D23/D25。
//
// 职责（确定性，agent 不写本文件）：
//   1. 输入：business-behavior.json（S7 agent 产出）+ unified-atoms.json（S6 路径与升级判定）；
//   2. 校验（任一 fail 不写）：analysisRunId 与 unified-atoms 一致、覆盖全部 conflict-fast/full/blocked 原子、
//      升级原子的 previousRunId 逐原子锚定 history 最近记录、候选≠基线时 candidateDetail 非空、
//      枚举合法、conflict 必带 baselineDetail + 证据、conflict-fast 条目四元组可空（不因编造非空 fail）；
//   3. 追加：history.runs 末尾追加本轮记录（**只增不改**）；同一 analysisRunId 重放不重复追加（幂等）；
//   4. 输出 <runDir>/4-analysis/analysis-history.json（append-only）。
//
// 可导入：export appendAnalysisHistory({ runDir, date, trigger })
//   返回 { ok, problems, summary, history }
//
// CLI：node append-analysis-history.mjs --run-dir <dir> --date <YYYY-MM-DD> [--trigger initial|retry|resume|decision]
//   退出码：0 成功（含幂等跳过）/ 1 失败
// ============================================================

import fs from 'node:fs'
import path from 'node:path'

const DIFFS = ['consistent', 'partial', 'conflict', 'unverified']
const PATHS = ['conflict-fast', 'full', 'blocked']
const TRIGGERS = ['initial', 'retry', 'resume', 'decision']

function readJsonSafe(p) {
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(p, 'utf8')) }
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) }
  }
}

const toPosix = (p) => String(p).replaceAll('\\', '/')

export function appendAnalysisHistory(input) {
  const problems = []
  const bad = (m) => problems.push(m)
  const I = input || {}
  const runDir = I.runDir
  const date = String(I.date || '')
  const trigger = TRIGGERS.includes(I.trigger) ? I.trigger : 'initial'

  if (!runDir) bad('runDir 缺失')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) bad('date 非法：' + date)
  if (problems.length > 0) return { ok: false, problems, summary: null }

  const uaRead = readJsonSafe(path.join(runDir, '4-analysis', 'unified-atoms.json'))
  const bbRead = readJsonSafe(path.join(runDir, '4-analysis', 'business-behavior.json'))
  if (!uaRead.ok) bad('unified-atoms.json 不可读（先跑 S6）：' + uaRead.error)
  if (!bbRead.ok) bad('business-behavior.json 不可读（S7 产出）：' + bbRead.error)
  const histPath = path.join(runDir, '4-analysis', 'analysis-history.json')
  const histRead = readJsonSafe(histPath)
  const history = histRead.ok && Array.isArray(histRead.data.runs) ? histRead.data : { schemaVersion: 1, runs: [] }
  if (problems.length > 0) return { ok: false, problems, summary: null }

  const ua = uaRead.data
  const bb = bbRead.data
  const analysisRunId = String(ua.analysisRunId || '')
  if (!analysisRunId) bad('unified-atoms.analysisRunId 缺失')
  if (bb.analysisRunId !== analysisRunId) {
    bad('business-behavior.analysisRunId 与 unified-atoms 不一致：' + bb.analysisRunId + ' vs ' + analysisRunId)
  }
  if (!Array.isArray(bb.entries)) bad('business-behavior.entries 非数组')
  if (problems.length > 0) return { ok: false, problems, summary: null }

  // ---- 幂等：同一 analysisRunId 已落档则跳过（不重复追加） ----
  if (history.runs.some((r) => r.analysisRunId === analysisRunId)) {
    return {
      ok: true,
      problems: [],
      summary: { analysisRunId, appended: false, reason: '同 analysisRunId 已落档（重放幂等跳过）', runCount: history.runs.length },
      history,
    }
  }

  // ---- 原子索引：S6 路径 + 升级判定 ----
  const atomMap = new Map((ua.atoms || []).map((a) => [a.atomId, a]))
  const expectPaths = new Map() // atomId -> analysisPath（conflict-fast / full / blocked）
  for (const a of ua.atoms || []) {
    if (!PATHS.includes(a.analysisPath)) bad('unified-atoms analysisPath 非法：' + a.atomId + ' = ' + a.analysisPath)
    expectPaths.set(a.atomId, a.analysisPath)
  }

  const entryByAtom = new Map()
  for (const e of bb.entries) {
    const atomId = String(e && e.atomId || '')
    if (!atomMap.has(atomId)) {
      bad('business-behavior 条目 atomId 不在 unified-atoms：' + atomId)
      continue
    }
    if (entryByAtom.has(atomId)) {
      bad('business-behavior 条目重复：' + atomId)
      continue
    }
    entryByAtom.set(atomId, e)
  }

  // 覆盖校验：blocked 原子除外，conflict-fast + full 原子每恰一条
  for (const [atomId, ap] of expectPaths) {
    if (ap === 'blocked') {
      if (entryByAtom.has(atomId)) bad('blocked 原子不应有 business-behavior 条目：' + atomId)
      continue
    }
    if (!entryByAtom.has(atomId)) bad('原子缺 business-behavior 条目：' + atomId + '（' + ap + '）')
  }

  // ---- 条目校验 ----
  const upgradedAtoms = []
  for (const e of bb.entries) {
    const atomId = e.atomId
    const uaAtom = atomMap.get(atomId)
    if (!uaAtom) continue
    if (e.analysisPath !== uaAtom.analysisPath) {
      bad('条目 analysisPath 与 S6 判定不一致：' + atomId + ' ' + e.analysisPath + ' vs ' + uaAtom.analysisPath)
    }
    if (e.analysisRunId !== analysisRunId) bad('条目 analysisRunId 不一致：' + atomId)
    if (!DIFFS.includes(e.baselineDifference)) {
      bad('baselineDifference 枚举非法：' + atomId + ' = ' + JSON.stringify(e.baselineDifference))
    }
    if (e.baselineDifference === 'conflict' && !String(e.baselineDetail || '').trim()) {
      bad('baselineDifference=conflict 但 baselineDetail 为空：' + atomId)
    }
    if (e.baselineDifference === 'conflict' && (!Array.isArray(e.evidenceIds) || e.evidenceIds.length === 0)) {
      bad('baselineDifference=conflict 但无证据：' + atomId)
    }
    if (e.candidateDifference && !DIFFS.includes(e.candidateDifference)) {
      bad('candidateDifference 枚举非法：' + atomId + ' = ' + JSON.stringify(e.candidateDifference))
    }

    // ---- 升级原子锚点校验（D25） ----
    if (uaAtom.upgraded) {
      upgradedAtoms.push(atomId)
      if (e.previousRunId !== uaAtom.previousRunId) {
        bad('升级原子 previousRunId 与 S6 解析不一致：' + atomId + ' ' + e.previousRunId + ' vs ' + uaAtom.previousRunId)
      }
      const prevRun = history.runs.find((r) => r.analysisRunId === uaAtom.previousRunId)
      if (!prevRun) {
        bad('升级原子 previousRunId 在 history 中不存在：' + atomId + ' -> ' + uaAtom.previousRunId)
      } else {
        // previousRunId 必须指向该原子自己的记录（禁止跨原子取值）
        const self = (prevRun.atomSummaries || []).find((s) => s.atomId === atomId)
        if (!self) bad('升级原子 previousRunId 指向的 run 不含该原子（跨原子取值）：' + atomId)
        else {
          if (self.analysisPath !== 'conflict-fast') bad('升级原子上轮 analysisPath 非 conflict-fast：' + atomId)
          if (self.baselineDifference !== 'conflict') bad('升级原子上轮 baselineDifference 非 conflict：' + atomId)
          if (e.previousBaselineDifference !== self.baselineDifference) {
            bad('previousBaselineDifference 与 history 记录不一致：' + atomId)
          }
        }
      }
      if (e.candidateDifference && e.candidateDifference !== e.baselineDifference && !String(e.candidateDetail || '').trim()) {
        bad('候选 ≠ 基线时 candidateDetail 必填：' + atomId)
      }
    } else {
      if (e.candidateDifference) bad('非升级原子 candidateDifference 必须为空串：' + atomId)
      if (e.previousRunId) bad('非升级原子 previousRunId 必须为空串：' + atomId)
    }
  }

  if (problems.length > 0) return { ok: false, problems, summary: null }

  // ---- 追加记录（只增不改） ----
  const atomSummaries = []
  for (const a of ua.atoms || []) {
    const e = entryByAtom.get(a.atomId)
    atomSummaries.push({
      atomId: a.atomId,
      analysisPath: a.analysisPath,
      baselineDifference: e ? e.baselineDifference : '',
      candidateDifference: e ? e.candidateDifference || '' : '',
      evidenceIds: e ? e.evidenceIds || [] : [],
    })
  }
  history.runs.push({
    analysisRunId: analysisRunId,
    date: date,
    trigger: trigger,
    upgradedFrom: upgradedAtoms,
    atomSummaries: atomSummaries,
  })

  return {
    ok: true,
    problems: [],
    summary: {
      analysisRunId,
      appended: true,
      trigger: trigger,
      upgradedFrom: upgradedAtoms,
      atomSummaryCount: atomSummaries.length,
      runCount: history.runs.length,
    },
    history,
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
    else if (argv[i] === '--trigger') a.trigger = argv[++i]
  }
  if (!a.runDir || !a.date) {
    console.error('用法：node append-analysis-history.mjs --run-dir <dir> --date <YYYY-MM-DD> [--trigger initial|retry|resume|decision]')
    process.exit(1)
  }
  const r = appendAnalysisHistory({ runDir: a.runDir, date: a.date, trigger: a.trigger })
  if (!r.ok) {
    console.log('[失败] 分析历史追加校验未通过，共 ' + r.problems.length + ' 项问题（不写产物）：')
    for (const p of r.problems) console.log('  - ' + p)
    process.exit(1)
  }
  const outPath = path.join(a.runDir, '4-analysis', 'analysis-history.json')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(r.history, null, 1) + '\n', 'utf8')
  const s = r.summary
  console.log(
    s.appended
      ? '[成功] 分析历史追加：' + s.analysisRunId + '（trigger=' + s.trigger + ' / 升级 ' + s.upgradedFrom.length +
        ' / 原子摘要 ' + s.atomSummaryCount + ' / 累计 ' + s.runCount + ' 轮）-> ' + toPosix(outPath)
      : '[成功] 分析历史跳过：' + s.reason + '（' + s.analysisRunId + '）'
  )
  process.exit(0)
}

if (process.argv[1] && toPosix(process.argv[1]).endsWith('append-analysis-history.mjs')) main()
