// run-state.example.mjs —— 失败恢复与状态机自检（断言式）
//
// 执行文档 §7 失败与状态转换、§17（失败恢复与状态机）。覆盖：
//   A. 分片级 → 分支级状态语义（completed/partial/failed/timeout → runStatus 推导）
//   B. check 诊断：已完成阶段/下一阶段/建议 mode+startStage/失败分片计数
//   C. 屏障级状态（unified-atoms analysisPath 分布）
//   D. 正式产物缺失检测（run-status 有但 evidence 无 → 警告"需重跑 merge"）
//   E. advance：run 级状态推进（completed/partial）+ 失败历史累积
//   F. 旧 run（无 run-state）警告 + 非法参数 fail
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { checkRunState, advanceRunState } from './run-state.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = path.join(REPO_ROOT, '.opencode-workflows/scripts/run-state.mjs')
const TMP = path.join(REPO_ROOT, '.opencode-workflows/scripts/tmp-run-state')
const DATE = '2099-01-01'

const writeJson = (p, d) => {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(d, null, 1) + '\n', 'utf8')
}
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
const cli = (args) => {
  try {
    return { code: 0, out: execFileSync('node', args, { encoding: 'utf8', cwd: REPO_ROOT }) }
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }
  }
}

function setupRun(runId, opt = {}) {
  const runDir = path.join(TMP, 'runs', runId)
  fs.rmSync(runDir, { recursive: true, force: true })
  fs.mkdirSync(path.join(runDir, 'runtime'), { recursive: true })
  const stages = {}
  for (const [sid, v] of Object.entries(opt.stages || {})) {
    stages[sid] = { status: 'completed', stageVersion: sid + '@1', reusable: true, ...v }
  }
  writeJson(path.join(runDir, 'runtime/stage-manifest.json'), { schemaVersion: 1, runId, stages })
  if (opt.clientRs) writeJson(path.join(runDir, '2-client/runtime/run-status.json'), opt.clientRs)
  if (opt.serverRs) writeJson(path.join(runDir, '3-server/runtime/run-status.json'), opt.serverRs)
  if (opt.clientEvidence) writeJson(path.join(runDir, '2-client/client-evidence.json'), { schemaVersion: 1, evidence: [], entries: [] })
  if (opt.serverEvidence) writeJson(path.join(runDir, '3-server/server-evidence.json'), { schemaVersion: 1, evidence: [] })
  if (opt.ua) writeJson(path.join(runDir, '4-analysis/unified-atoms.json'), opt.ua)
  if (opt.runState) writeJson(path.join(runDir, 'runtime/run-state.json'), opt.runState)
  return runDir
}

const rs = (parts, runStatus) => ({ schemaVersion: 1, branch: 'client', date: DATE, runStatus, parts })

const results = []
const test = (name, fn) => {
  try {
    fn()
    results.push('[通过] ' + name)
  } catch (e) {
    results.push('[失败] ' + name + ' -> ' + e.message)
    process.exitCode = 1
  }
}

fs.rmSync(TMP, { recursive: true, force: true })

// ============================================================
// A/B
// ============================================================
test('A1 分片级状态统计：completed/partial 混合 + 失败分片计数', () => {
  const runDir = setupRun('run-a1', {
    stages: { S1: {}, S2: {}, S3: {}, S4: {} },
    clientRs: rs([
      { partFile: 'ST-C01-cp01.json', status: 'completed', atomIds: ['a'] },
      { partFile: 'ST-C01-cp02.json', status: 'timeout', atomIds: ['b'] },
      { partFile: 'ST-C01-cp03.json', status: 'failed', atomIds: ['c'] },
    ], 'partial'),
  })
  const r = checkRunState({ runDir })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  assert.equal(r.diagnosis.branches.client.runStatus, 'partial')
  assert.equal(r.diagnosis.branches.client.parts.completed, 1)
  assert.equal(r.diagnosis.branches.client.parts.timeout, 1)
  assert.equal(r.diagnosis.branches.client.parts.failed, 1)
  assert.equal(r.diagnosis.failedShards.client, 2, 'timeout + failed 均计入失败分片')
})

test('B1 check 诊断：lastCompletedStage / nextStage / 建议 mode=from-stage', () => {
  const runDir = setupRun('run-b1', { stages: { S1: {}, S2: {}, S3: {} } })
  const r = checkRunState({ runDir })
  assert.equal(r.diagnosis.lastCompletedStage, 'S3')
  assert.equal(r.diagnosis.nextStage, 'S4')
  assert.equal(r.diagnosis.recoverable.mode, 'from-stage')
  assert.equal(r.diagnosis.recoverable.startStage, 'S4')
})

test('B2 空 run（无阶段）→ 建议 mode=all；全链完成 → mode=none', () => {
  const empty = setupRun('run-b2a', {})
  assert.equal(checkRunState({ runDir: empty }).diagnosis.recoverable.mode, 'all')

  const all = {}
  for (const s of ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11']) all[s] = {}
  const full = setupRun('run-b2b', { stages: all })
  const d = checkRunState({ runDir: full }).diagnosis
  assert.equal(d.nextStage, null)
  assert.ok(d.recoverable.mode.includes('none'))
})

// ============================================================
// C/D
// ============================================================
test('C1 屏障级状态：unified-atoms analysisPath 三分统计', () => {
  const runDir = setupRun('run-c1', {
    stages: { S6: {} },
    ua: {
      schemaVersion: 1, analysisRunId: 'ar-x-001',
      atoms: [
        { atomId: 'a', analysisPath: 'conflict-fast' },
        { atomId: 'b', analysisPath: 'full' },
        { atomId: 'c', analysisPath: 'full' },
        { atomId: 'd', analysisPath: 'blocked' },
      ],
    },
  })
  const d = checkRunState({ runDir }).diagnosis
  assert.equal(d.barrier.analysisRunId, 'ar-x-001')
  assert.deepEqual(d.barrier.analysisPaths, { 'conflict-fast': 1, full: 2, blocked: 1 })
})

test('D1 正式产物缺失：run-status 有但 evidence 无 → 警告需重跑 merge', () => {
  const runDir = setupRun('run-d1', {
    clientRs: rs([{ partFile: 'p', status: 'completed', atomIds: [] }], 'completed'),
    // 故意不建 client-evidence.json
  })
  const d = checkRunState({ runDir }).diagnosis
  assert.ok(d.warnings.some((w) => w.includes('client-evidence.json 缺失')), JSON.stringify(d.warnings))

  const runDir2 = setupRun('run-d1b', {
    clientRs: rs([{ partFile: 'p', status: 'completed', atomIds: [] }], 'completed'),
    clientEvidence: true,
  })
  const d2 = checkRunState({ runDir: runDir2 }).diagnosis
  assert.equal(d2.warnings.some((w) => w.includes('client-evidence.json 缺失')), false)
})

// ============================================================
// E/F
// ============================================================
test('E1 advance：阶段推进累积 + runStatus 推导（partial → completed）', () => {
  const runDir = setupRun('run-e1', {})
  let r = advanceRunState({ runDir, date: DATE, stageId: 'S1', outcome: 'completed' })
  assert.equal(r.ok, true)
  assert.equal(r.state.runStatus, 'partial')
  writeJson(path.join(runDir, 'runtime/run-state.json'), r.state)

  r = advanceRunState({ runDir, date: DATE, stageId: 'S2', outcome: 'failed' })
  assert.equal(r.state.failures.length, 1, '失败历史必须累积')
  assert.equal(r.state.runStatus, 'partial')

  // 全部阶段 completed → completed
  const allRun = setupRun('run-e1b', {})
  let st = null
  for (const s of ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11']) {
    const rr = advanceRunState({ runDir: allRun, date: DATE, stageId: s, outcome: 'completed' })
    st = rr.state
    writeJson(path.join(allRun, 'runtime/run-state.json'), st) // 调用方契约：advance 后落盘
  }
  assert.equal(st.runStatus, 'completed')
})

test('F1 旧 run（无 run-state）→ 警告；非法参数 → fail', () => {
  const runDir = setupRun('run-f1', { stages: { S1: {} } })
  const d = checkRunState({ runDir }).diagnosis
  assert.ok(d.warnings.some((w) => w.includes('run-state.json 缺失')), JSON.stringify(d.warnings))

  const bad = advanceRunState({ runDir, date: DATE, stageId: 'S99', outcome: 'completed' })
  assert.equal(bad.ok, false)
  assert.ok(bad.problems.some((p) => p.includes('stageId 非法')))

  const bad2 = advanceRunState({ runDir, date: DATE, stageId: 'S1', outcome: 'weird' })
  assert.equal(bad2.ok, false)
  assert.ok(bad2.problems.some((p) => p.includes('outcome 非法')))
})

// ============================================================
// G：CLI
// ============================================================
test('G1 CLI check/advance 正常路径 + 缺 run-dir 退出码 1', () => {
  const runDir = setupRun('run-g1', { stages: { S1: {}, S2: {} } })
  const c1 = cli([SCRIPT, 'check', '--run-dir', runDir])
  assert.equal(c1.code, 0, c1.out)
  assert.ok(c1.out.includes('已完成至 S2') && c1.out.includes('from-stage'))

  const c2 = cli([SCRIPT, 'advance', '--run-dir', runDir, '--date', DATE, '--stage', 'S3', '--outcome', 'completed'])
  assert.equal(c2.code, 0, c2.out)
  assert.equal(readJson(path.join(runDir, 'runtime/run-state.json')).stageOutcomes.length, 1)

  const c3 = cli([SCRIPT, 'check'])
  assert.equal(c3.code, 1)
})

fs.rmSync(TMP, { recursive: true, force: true })

console.log('run-state.example：' + (process.exitCode ? '存在失败' : '全部通过'))
for (const line of results) console.log('  ' + line)
process.exit(process.exitCode || 0)
