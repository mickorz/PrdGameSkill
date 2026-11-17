// ============================================================
// run-state.mjs —— 失败恢复与状态机（各阶段失败/超时/恢复/重跑的完整状态转换）
//
// 执行文档 §7「失败与状态转换」、§10 待写清单「失败恢复与状态机」、§11.3 strict。
//
// 职责（确定性）：
//   1. 状态机定义与校验（分片级 → 分支级 → S6 屏障级/路径级 → run 级）；
//   2. `check`：读取 run 现状，输出可恢复性诊断（哪些阶段已完成/可复用、哪些需重跑、
//      建议的 mode 与 startStage）；
//   3. `advance`：阶段完成后推进 run 级状态（写 runtime/run-state.json，与 stage-manifest 互补：
//      manifest 记指纹，run-state 记可恢复性视图与失败历史）；
//   4. Schema 版本兼容矩阵：旧 run（缺新字段）禁止 resume 冒充已验证（§7 Schema 版本警示）。
//
// 状态定义（§7）：
//   分片级：pending | completed | failed | timeout（run-status.parts[].status）
//   分支级：completed | partial | failed | pending（run-status.runStatus）
//   屏障级：conflict-fast | full | blocked（unified-atoms.atoms[].analysisPath）
//   run 级：pending | running | partial | completed | failed（run-state.json）
//
// 可导入：export checkRunState({ runDir }) / advanceRunState({ runDir, date, stageId, outcome })
//
// CLI：
//   node run-state.mjs check --run-dir <dir>
//   node run-state.mjs advance --run-dir <dir> --date <YYYY-MM-DD> --stage <Sx> --outcome <completed|partial|failed>
//   退出码：0 成功 / 1 失败
// ============================================================

import fs from 'node:fs'
import path from 'node:path'

const runStateFile = 'runtime/run-state.json'
const STAGE_ORDER = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11']
const OUTCOMES = ['completed', 'partial', 'failed']

// Schema 版本兼容矩阵（§7）：stageVersion 主版本一致才允许 resume 复用；否则必须 from-stage 重跑
const SCHEMA_COMPAT = {
  note: 'stageVersion 主版本（@ 后数字）不一致 → 该阶段不可 resume 复用，必须 from-stage 重跑；旧 run 缺新字段一律按「未经新 Schema 查证」处理，禁止兜底冒充已验证',
  majorOf: (v) => String(v || '').split('@')[1] || '',
}

const toPosix = (p) => String(p).replaceAll('\\', '/')
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

function exists(runDir, rel) {
  return fs.existsSync(path.join(runDir, rel))
}

// 分支级可恢复性：从 run-status 推导
function branchState(runDir, branch) {
  const rel = (branch === 'client' ? '2-client' : '3-server') + '/runtime/run-status.json'
  const r = readJsonSafe(path.join(runDir, rel))
  if (!r.ok) return { present: false, runStatus: 'missing', parts: { completed: 0, failed: 0, timeout: 0, pending: 0 } }
  const parts = { completed: 0, failed: 0, timeout: 0, pending: 0 }
  for (const p of r.data.parts || []) if (parts[p.status] !== undefined) parts[p.status]++
  const evidenceRel = branch === 'client' ? '2-client/client-evidence.json' : '3-server/server-evidence.json'
  return { present: true, runStatus: r.data.runStatus, parts, evidencePresent: exists(runDir, evidenceRel) }
}

export function checkRunState(input) {
  const problems = []
  const I = input || {}
  const runDir = I.runDir
  if (!runDir) return { ok: false, problems: ['runDir 缺失'], diagnosis: null }
  if (!fs.existsSync(runDir)) return { ok: false, problems: ['run 目录不存在：' + toPosix(runDir)], diagnosis: null }

  const manifestRead = readJsonSafe(path.join(runDir, 'runtime', 'stage-manifest.json'))
  const manifest = manifestRead.ok ? manifestRead.data : { stages: {} }
  const stateRead = readJsonSafe(path.join(runDir, runStateFile))

  const stages = {}
  for (const sid of STAGE_ORDER) {
    const rec = manifest.stages && manifest.stages[sid]
    stages[sid] = {
      recorded: !!rec,
      status: rec ? rec.status : 'not-run',
      stageVersion: rec ? rec.stageVersion : null,
      reusable: !!(rec && rec.reusable),
      reusedFrom: rec && rec.reuse ? rec.reuse.sourceRunId : null,
    }
  }

  // 屏障级：unified-atoms 分析路径分布
  const uaRead = readJsonSafe(path.join(runDir, '4-analysis', 'unified-atoms.json'))
  let barrier = null
  if (uaRead.ok) {
    const paths = { 'conflict-fast': 0, full: 0, blocked: 0 }
    for (const a of uaRead.data.atoms || []) if (paths[a.analysisPath] !== undefined) paths[a.analysisPath]++
    barrier = { analysisRunId: uaRead.data.analysisRunId, analysisPaths: paths }
  }

  const client = branchState(runDir, 'client')
  const server = branchState(runDir, 'server')

  // ---- 可恢复性诊断 ----
  const doneStages = STAGE_ORDER.filter((s) => stages[s].status === 'completed')
  const lastDone = doneStages.length > 0 ? doneStages[doneStages.length - 1] : null
  const nextStage = lastDone ? STAGE_ORDER[STAGE_ORDER.indexOf(lastDone) + 1] || null : 'S1'

  const warnings = []
  // Schema 警示（§7）：manifest 记录版本与当前 specs 主版本比较由 stage-reuse 负责；此处只提示旧 run
  if (manifestRead.ok && !stateRead.ok) {
    warnings.push('run-state.json 缺失（旧 run 或未推进过状态）：仅依据 stage-manifest 判定，resume 前请先 run-state advance 补齐')
  }
  if (client.present && !client.evidencePresent && client.runStatus !== 'pending') {
    warnings.push('client run-status 存在但正式产物 client-evidence.json 缺失：分支 merge 未完成，需重跑 S4 merge')
  }
  if (server.present && !server.evidencePresent && server.runStatus !== 'pending') {
    warnings.push('server run-status 存在但 server-evidence.json 缺失：需重跑 S5 merge')
  }

  const diagnosis = {
    schemaVersion: 1,
    runId: path.basename(runDir),
    stages: stages,
    lastCompletedStage: lastDone,
    nextStage: nextStage,
    branches: { client, server },
    barrier: barrier,
    failedShards: {
      client: client.parts.failed + client.parts.timeout,
      server: server.parts.failed + server.parts.timeout,
    },
    recoverable: {
      mode: lastDone === null ? 'all' : nextStage === null ? 'none（已完成全链）' : 'from-stage',
      startStage: nextStage,
      note: nextStage === null ? '全链完成；如需重跑请用 from-stage 指定起点' : '从 ' + nextStage + ' 起重跑，上游经 strict 指纹校验复用',
    },
    warnings: warnings,
  }
  return { ok: true, problems, diagnosis }
}

export function advanceRunState(input) {
  const problems = []
  const I = input || {}
  const runDir = I.runDir
  const date = String(I.date || '')
  const stageId = String(I.stageId || '')
  const outcome = String(I.outcome || '')
  if (!runDir) problems.push('runDir 缺失')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) problems.push('date 非法：' + date)
  if (!STAGE_ORDER.includes(stageId)) problems.push('stageId 非法（S1~S11）：' + stageId)
  if (!OUTCOMES.includes(outcome)) problems.push('outcome 非法（completed|partial|failed）：' + outcome)
  if (problems.length > 0) return { ok: false, problems, state: null }

  const stateRead = readJsonSafe(path.join(runDir, runStateFile))
  const state = stateRead.ok
    ? stateRead.data
    : { schemaVersion: 1, runId: path.basename(runDir), date: date, runStatus: 'pending', stageOutcomes: [], failures: [] }
  state.date = date
  state.stageOutcomes = Array.isArray(state.stageOutcomes) ? state.stageOutcomes : []
  state.stageOutcomes.push({ stageId: stageId, outcome: outcome, at: date })

  if (outcome !== 'completed') {
    state.failures = Array.isArray(state.failures) ? state.failures : []
    state.failures.push({ stageId: stageId, outcome: outcome, date: date })
  }

  // run 级状态：全部 completed → completed；有 failed 且无后续 → partial/failed
  const done = new Set(state.stageOutcomes.filter((s) => s.outcome === 'completed').map((s) => s.stageId))
  const anyFailed = state.stageOutcomes.some((s) => s.outcome === 'failed')
  if (STAGE_ORDER.every((s) => done.has(s))) state.runStatus = 'completed'
  else if (anyFailed) state.runStatus = 'partial'
  else if (done.size > 0) state.runStatus = 'partial'
  else state.runStatus = 'running'

  return { ok: true, problems: [], state }
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
    else if (argv[i] === '--stage') a.stage = argv[++i]
    else if (argv[i] === '--outcome') a.outcome = argv[++i]
  }
  if (!a.runDir) {
    console.error('用法：node run-state.mjs check --run-dir <dir>')
    console.error('      node run-state.mjs advance --run-dir <dir> --date <YYYY-MM-DD> --stage <Sx> --outcome <completed|partial|failed>')
    process.exit(1)
  }
  if (cmd === 'check') {
    const r = checkRunState({ runDir: a.runDir })
    if (!r.ok) {
      console.log('[失败] 状态检查失败：')
      for (const p of r.problems) console.log('  - ' + p)
      process.exit(1)
    }
    const d = r.diagnosis
    console.log(
      '[成功] 状态检查：' + d.runId +
        ' / 已完成至 ' + (d.lastCompletedStage || '（无）') +
        ' / 建议 ' + d.recoverable.mode + (d.recoverable.startStage && d.recoverable.mode === 'from-stage' ? ' startStage=' + d.recoverable.startStage : '') +
        ' / 失败分片 client ' + d.failedShards.client + ' server ' + d.failedShards.server
    )
    for (const w of d.warnings) console.log('  [提示] ' + w)
    process.exit(0)
  }
  if (cmd === 'advance') {
    const r = advanceRunState({ runDir: a.runDir, date: a.date, stageId: a.stage, outcome: a.outcome })
    if (!r.ok) {
      console.log('[失败] 状态推进失败：')
      for (const p of r.problems) console.log('  - ' + p)
      process.exit(1)
    }
    writeJson(path.join(a.runDir, runStateFile), r.state)
    console.log('[成功] 状态推进：' + a.stage + '=' + a.outcome + ' → runStatus=' + r.state.runStatus)
    process.exit(0)
  }
  console.error('未知子命令：' + cmd)
  process.exit(1)
}

if (process.argv[1] && toPosix(process.argv[1]).endsWith('run-state.mjs')) main()
