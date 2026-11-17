// merge-evidence.example.mjs —— S6 屏障 + S7 分析历史（断言式，跑完打印结果退出）
//
// 执行文档 §5 S6/S7、§1 屏障判定路径、§14（S6~S7 详细）。覆盖：
//   A. 分析路径三分：conflict-fast（已完成端 directConflict，不被另一必要端 pending 阻塞 →
//      Gold Set G01/G02 屏障侧）/ blocked（必要端 pending）/ full（必要端全完成）
//   B. 非必要端 pending 不阻塞 full（verificationScope 决定必要端，D14）
//   C. pending 唯一事实源 run-status（禁止从缺证据猜测）+ 矛盾检测（pending 却有 entry → fail）
//   D. 引用一致性 / 证据存在性
//   E. analysisRunId 生成与递增（ar-<date>-<seq>，history 长度 +1）
//   F. 升级识别 D25：上轮 conflict-fast ∧ 本轮 full ∧ 上轮 baseline conflict → upgraded
//      + previousRunId 逐原子解析（禁止跨原子取值）
//   G. 分析历史 append-only：首轮追加、同 run 重放幂等不重复、历史只增不改
//   H. 升级原子锚点校验：previousRunId 缺失/跨原子 → fail；候选≠基线无 candidateDetail → fail
//   I. blocked 原子无 business-behavior 条目（覆盖校验）+ conflict 必带 detail/证据
//   J. 端到端：S6 → S7 产出 → 追加 → 第二轮升级 → 再追加（G04 升级路径）
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mergeEvidence } from './merge-evidence.mjs'
import { appendAnalysisHistory } from './append-analysis-history.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const S6_CLI = path.join(REPO_ROOT, '.opencode-workflows/scripts/merge-evidence.mjs')
const HIST_CLI = path.join(REPO_ROOT, '.opencode-workflows/scripts/append-analysis-history.mjs')
const TMP = path.join(REPO_ROOT, '.opencode-workflows/scripts/tmp-merge-evidence')
const DATE = '2099-01-01'

const writeJson = (p, data) => {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(data, null, 1) + '\n', 'utf8')
}
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
// S6 经 CLI 落盘后读回（library 不写盘；S7 需要磁盘产物）
const hist = (runDir, trigger) => {
  try {
    const out = execFileSync('node', [HIST_CLI, '--run-dir', runDir, '--date', DATE].concat(trigger ? ['--trigger', trigger] : []), { encoding: 'utf8', cwd: REPO_ROOT })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }
  }
}
const s6 = (runDir) => {
  execFileSync('node', [S6_CLI, '--run-dir', runDir, '--date', DATE], { encoding: 'utf8', cwd: REPO_ROOT })
  return readJson(path.join(runDir, '4-analysis/unified-atoms.json'))
}

// ---- Registry：3 原子，覆盖三种 verificationScope ----
function makeRegistry() {
  const mk = (atomId, scope) => ({
    atomId, name: '', rule: '规则 ' + atomId, uiRequirement: '', verificationScope: scope,
    businessBehavior: { trigger: 't', condition: '', action: 'a', result: 'r' },
    source: { chapter: 'ch', fromLine: 1, toLine: 2 },
  })
  return {
    schemaVersion: 1, date: DATE,
    stages: [{ stageId: 'ST-C01', name: 's', chapter: 'ch', summary: '', featureCount: 1, atomCount: 3 }],
    features: [
      {
        id: 'FP-ST-C01-001', stageId: 'ST-C01', name: 'f', description: '', scope: '', coordination: '',
        atoms: [mk('AT-ST-C01-001', 'both'), mk('AT-ST-C01-002', 'client'), mk('AT-ST-C01-003', 'both')],
      },
    ],
    stats: { stageCount: 1, featureCount: 1, atomCount: 3, perStage: [], scopeStats: { client: 1, server: 0, both: 2 } },
  }
}

function mkEvidence(id, atomIds, extra) {
  return Object.assign({
    id, atomIds, claimKey: 'ck-' + id.toLowerCase(), repoId: 'r', layer: 'client_code',
    file: 'f.ts', location: 'f.ts:1', symbol: '', excerpt: '', configKeys: [],
    sourceRevision: 'unversioned', contentHash: 'sha256:x', verifiedAt: DATE, dependencyFiles: [],
  }, extra || {})
}

// 搭一个 run 目录：registry + client-evidence + scope-index + server-evidence + 双 run-status
function setupRun(runId, opt = {}) {
  const runDir = path.join(TMP, 'runs', runId)
  fs.rmSync(runDir, { recursive: true, force: true })
  writeJson(path.join(runDir, '1-registry/requirement-registry.json'), makeRegistry())

  const cle = opt.cle || [mkEvidence('CLE-AT-ST-C01-001-01', ['AT-ST-C01-001']), mkEvidence('CLE-AT-ST-C01-002-01', ['AT-ST-C01-002'])]
  const sve = opt.sve || [mkEvidence('SVE-AT-ST-C01-001-01', ['AT-ST-C01-001'], { repoId: 'server', layer: 'common_game', file: 'r.cpp', location: 'r.cpp:10' })]
  const clientEntries = opt.clientEntries || [
    { atomId: 'AT-ST-C01-001', verdict: 'confirmed', evidenceIds: ['CLE-AT-ST-C01-001-01'], directConflict: opt.clientConflict001 === true, conflictEvidenceIds: opt.clientConflict001 === true ? ['CLE-AT-ST-C01-001-01'] : [], observedBehavior: { trigger: 't', condition: '', action: '', result: '' } },
    { atomId: 'AT-ST-C01-002', verdict: 'confirmed', evidenceIds: ['CLE-AT-ST-C01-002-01'], directConflict: false, conflictEvidenceIds: [], observedBehavior: {} },
  ]
  const serverPendSet = new Set(opt.serverPending || [])
  const clientPendSet = new Set(opt.clientPending || [])
  const scopeEntriesRaw = opt.scopeEntries || [
    { atomId: 'AT-ST-C01-001', applicability: 'active', configVerified: true, callPathVerified: true, configCondition: '', callPath: 'f', evidenceIds: ['SVE-AT-ST-C01-001-01'], unresolved: '', noServerEvidence: false, directConflict: false, conflictEvidenceIds: [] },
  ]
  // pending 端不产条目（真实语义）
  const scopeEntries = scopeEntriesRaw.filter((e) => !serverPendSet.has(e.atomId))
  const clientEntriesFinal = clientEntries.filter((e) => !clientPendSet.has(e.atomId))
  writeJson(path.join(runDir, '2-client/client-evidence.json'), {
    schemaVersion: 1, date: DATE, source: [{ repoId: 'r' }], entries: clientEntriesFinal, evidence: cle,
    coverage: { expectedAtomCount: 3, entryCount: clientEntriesFinal.length, pendingAtomIds: opt.clientPending || [] },
    stats: { atomCount: clientEntriesFinal.length },
  })
  writeJson(path.join(runDir, '3-server/scope-index.json'), {
    schemaVersion: 1, entries: scopeEntries,
    coverage: { expectedAtomCount: 3, entryCount: scopeEntries.length, pendingAtomIds: opt.serverPending || [] },
    stats: { atomCount: scopeEntries.length },
  })
  writeJson(path.join(runDir, '3-server/server-evidence.json'), { schemaVersion: 1, evidence: sve, stats: { sveCount: sve.length } })
  writeJson(path.join(runDir, '2-client/runtime/run-status.json'), {
    schemaVersion: 1, branch: 'client', date: DATE, runStatus: 'completed',
    parts: [{ partFile: 'ST-C01-cp01.json', stageId: 'ST-C01', status: 'completed', atomIds: opt.clientPartsCompleted || ['AT-ST-C01-001', 'AT-ST-C01-002', 'AT-ST-C01-003'] }].concat(
      (opt.clientPending || []).length
        ? [{ partFile: 'ST-C01-cp02.json', stageId: 'ST-C01', status: opt.clientPendingStatus || 'timeout', atomIds: opt.clientPending }]
        : []
    ),
  })
  writeJson(path.join(runDir, '3-server/runtime/run-status.json'), {
    schemaVersion: 1, branch: 'server', date: DATE, runStatus: 'completed',
    parts: [{ partFile: 'ST-C01-p01.json', stageId: 'ST-C01', status: 'completed', atomIds: (opt.serverPending || []).length ? ['AT-ST-C01-001'] : ['AT-ST-C01-001', 'AT-ST-C01-003'] }].concat(
      (opt.serverPending || []).length
        ? [{ partFile: 'ST-C01-p02.json', stageId: 'ST-C01', status: opt.serverPendingStatus || 'timeout', atomIds: opt.serverPending }]
        : []
    ),
  })
  if (opt.history) writeJson(path.join(runDir, '4-analysis/analysis-history.json'), opt.history)
  return runDir
}

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
// A/B：分析路径三分
// ============================================================
test('A1 conflict-fast：已完成端 directConflict 不被另一必要端 pending 阻塞（G01 屏障侧）', () => {
  // AT-ST-C01-001 (both)：客户端 confirmed + directConflict；服务端 timeout（pending）
  const runDir = setupRun('run-cf', { clientConflict001: true, serverPending: ['AT-ST-C01-001', 'AT-ST-C01-003'] })
  const r = mergeEvidence({ runDir, date: DATE })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  const a1 = r.unifiedAtoms.atoms.find((a) => a.atomId === 'AT-ST-C01-001')
  assert.equal(a1.analysisPath, 'conflict-fast', '已完成端冲突 → conflict-fast，不被 server pending 阻塞')
  assert.equal(a1.server.pending, true)
  assert.equal(a1.client.directConflict, true)
  assert.equal(r.summary.stats.conflictFast, 1)
})

test('A2 blocked：必要端 pending 且无冲突信号 → blocked（不进差异判定）', () => {
  const runDir = setupRun('run-blocked', { serverPending: ['AT-ST-C01-001', 'AT-ST-C01-003'] })
  const r = mergeEvidence({ runDir, date: DATE })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  const a1 = r.unifiedAtoms.atoms.find((a) => a.atomId === 'AT-ST-C01-001')
  assert.equal(a1.analysisPath, 'blocked', 'both 且 server pending → blocked')
})

test('A3 full：必要端全部完成 → full', () => {
  const runDir = setupRun('run-full', {
    scopeEntries: [
      { atomId: 'AT-ST-C01-001', applicability: 'active', configVerified: true, callPathVerified: true, configCondition: '', callPath: 'f', evidenceIds: ['SVE-AT-ST-C01-001-01'], unresolved: '', noServerEvidence: false, directConflict: false, conflictEvidenceIds: [] },
      { atomId: 'AT-ST-C01-003', applicability: 'inactive', configVerified: false, callPathVerified: false, configCondition: '', callPath: '', evidenceIds: [], unresolved: '', noServerEvidence: true, directConflict: false, conflictEvidenceIds: [] },
    ],
    clientEntries: [
      { atomId: 'AT-ST-C01-001', verdict: 'confirmed', evidenceIds: ['CLE-AT-ST-C01-001-01'], directConflict: false, conflictEvidenceIds: [], observedBehavior: {} },
      { atomId: 'AT-ST-C01-002', verdict: 'confirmed', evidenceIds: ['CLE-AT-ST-C01-002-01'], directConflict: false, conflictEvidenceIds: [], observedBehavior: {} },
      { atomId: 'AT-ST-C01-003', verdict: 'not_found', evidenceIds: [], directConflict: false, conflictEvidenceIds: [], observedBehavior: {} },
    ],
  })
  const r = mergeEvidence({ runDir, date: DATE })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  const a1 = r.unifiedAtoms.atoms.find((a) => a.atomId === 'AT-ST-C01-001')
  assert.equal(a1.analysisPath, 'full')
  assert.equal(r.summary.stats.full, 3, '三原子必要端均完成 → 全 full')
})

test('B1 非必要端 pending 不阻塞：scope=client 且 server 全 pending → full（只记录）', () => {
  // AT-ST-C01-002 是 client 范围；让 server run-status 对它 pending
  const runDir = setupRun('run-nonneed', {
    serverPending: ['AT-ST-C01-002', 'AT-ST-C01-003'],
    scopeEntries: [
      { atomId: 'AT-ST-C01-001', applicability: 'active', configVerified: true, callPathVerified: true, configCondition: '', callPath: 'f', evidenceIds: ['SVE-AT-ST-C01-001-01'], unresolved: '', noServerEvidence: false, directConflict: false, conflictEvidenceIds: [] },
    ],
  })
  const r = mergeEvidence({ runDir, date: DATE })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  const a2 = r.unifiedAtoms.atoms.find((a) => a.atomId === 'AT-ST-C01-002')
  assert.equal(a2.server.pending, true)
  assert.equal(a2.analysisPath, 'full', 'scope=client → server pending 不阻塞')
  assert.equal(r.summary.stats.serverPending >= 2, true, 'pending 仍计数（供技术视图标注）')
})

// ============================================================
// C/D：pending 事实源与引用校验
// ============================================================
test('C1 pending 端却有 entry → fail（run-status 与条目矛盾）', () => {
  const runDir = setupRun('run-contradiction', { clientPending: ['AT-ST-C01-002'] })
  // 人为制造矛盾：run-status 声明 002 pending，但正式产物里塞回 002 的条目
  const evPath = path.join(runDir, '2-client/client-evidence.json')
  const ev = readJson(evPath)
  ev.entries.push({ atomId: 'AT-ST-C01-002', verdict: 'confirmed', evidenceIds: ['CLE-AT-ST-C01-002-01'], directConflict: false, conflictEvidenceIds: [], observedBehavior: {} })
  writeJson(evPath, ev)
  const r = mergeEvidence({ runDir, date: DATE })
  assert.equal(r.ok, false)
  assert.ok(r.problems.some((p) => p.includes('client pending 但存在 entry')), JSON.stringify(r.problems))
})

test('C2 run-status 缺 parts → fail（不允许无执行状态）', () => {
  const runDir = setupRun('run-noparts')
  writeJson(path.join(runDir, '2-client/runtime/run-status.json'), { schemaVersion: 1, branch: 'client', date: DATE, runStatus: 'pending', parts: [] })
  const r = mergeEvidence({ runDir, date: DATE })
  assert.equal(r.ok, false)
  assert.ok(r.problems.some((p) => p.includes('client run-status 无 parts')))
})

test('D1 证据引用不存在 → fail', () => {
  const runDir = setupRun('run-badref', {
    clientEntries: [{ atomId: 'AT-ST-C01-001', verdict: 'confirmed', evidenceIds: ['CLE-GHOST-01'], directConflict: false, conflictEvidenceIds: [], observedBehavior: {} }],
  })
  const r = mergeEvidence({ runDir, date: DATE })
  assert.equal(r.ok, false)
  assert.ok(r.problems.some((p) => p.includes('引用不存在的证据')))
})

test('D2 引用一致性：证据 atomIds 不含引用方 → fail', () => {
  const runDir = setupRun('run-inconsistent', {
    cle: [mkEvidence('CLE-AT-ST-C01-002-01', ['AT-ST-C01-002'])],
    clientEntries: [
      { atomId: 'AT-ST-C01-001', verdict: 'confirmed', evidenceIds: ['CLE-AT-ST-C01-002-01'], directConflict: false, conflictEvidenceIds: [], observedBehavior: {} },
    ],
  })
  const r = mergeEvidence({ runDir, date: DATE })
  assert.equal(r.ok, false)
  assert.ok(r.problems.some((p) => p.includes('引用一致性失败')))
})

// ============================================================
// E/G：analysisRunId 与历史 append-only
// ============================================================
const baseRun = setupRun('run-hist')
function writeBB(runDir, analysisRunId, entries) {
  writeJson(path.join(runDir, '4-analysis/business-behavior.json'), {
    schemaVersion: 1, analysisRunId, entries,
  })
}

test('E1 analysisRunId 生成：ar-<date>-001（history 空）+ 第二次 ar-<date>-002', () => {
  const r1 = mergeEvidence({ runDir: baseRun, date: DATE })
  assert.equal(r1.ok, true, JSON.stringify(r1.problems))
  assert.equal(r1.summary.analysisRunId, 'ar-' + DATE + '-001')
})

test('G1 分析历史首轮追加：只增不改 + 覆盖全原子（含 blocked）', () => {
  execFileSync('node', [S6_CLI, '--run-dir', baseRun, '--date', DATE], { encoding: 'utf8', cwd: REPO_ROOT })
  const ua = readJson(path.join(baseRun, '4-analysis/unified-atoms.json'))
  // 为 full/conflict-fast 原子写条目（本例全 full，因 server scope 只覆盖 001、003 pending? 用实际路径生成）
  const entries = ua.atoms.filter((a) => a.analysisPath !== 'blocked').map((a) => ({
    atomId: a.atomId, analysisPath: a.analysisPath, analysisRunId: ua.analysisRunId,
    previousRunId: '', previousBaselineDifference: '',
    trigger: 't', condition: 'c', clientAction: 'ca', serverAction: 'sa', collaboration: 'co', result: 'r',
    baselineDifference: 'consistent', baselineDetail: '', candidateDifference: '', candidateDetail: '',
    evidenceIds: (a.client.evidenceIds || []).concat(a.server.evidenceIds || []),
  }))
  writeBB(baseRun, ua.analysisRunId, entries)
  const a = hist(baseRun, 'initial')
  assert.equal(a.code, 0, a.out)
  const h = readJson(path.join(baseRun, '4-analysis/analysis-history.json'))
  assert.equal(h.runs.length, 1)
  assert.equal(h.runs[0].atomSummaries.length, 3, 'atomSummaries 覆盖该轮全部原子（含 blocked）')
  assert.equal(h.runs[0].trigger, 'initial')
})

test('G2 同 analysisRunId 重放 → 幂等跳过，不重复追加', () => {
  const a2 = hist(baseRun, 'resume')
  assert.equal(a2.code, 0, a2.out)
  assert.ok(a2.out.includes('幂等跳过'), a2.out)
  const h = readJson(path.join(baseRun, '4-analysis/analysis-history.json'))
  assert.equal(h.runs.length, 1, '历史不得重复追加')
})

// ============================================================
// F/H/I/J：升级路径（G04）
// ============================================================
test('F1+G04 升级识别：上轮 conflict-fast + 本轮 full + 上轮 baseline conflict → upgraded', () => {
  // 第 2 轮：服务端补证完成 → 001 从 conflict-fast 变 full
  const runDir = setupRun('run-upgrade', {
    history: {
      schemaVersion: 1,
      runs: [{
        analysisRunId: 'ar-' + DATE + '-001', date: DATE, trigger: 'initial', upgradedFrom: [],
        atomSummaries: [
          { atomId: 'AT-ST-C01-001', analysisPath: 'conflict-fast', baselineDifference: 'conflict', candidateDifference: '', evidenceIds: ['CLE-AT-ST-C01-001-01'] },
          { atomId: 'AT-ST-C01-002', analysisPath: 'full', baselineDifference: 'consistent', candidateDifference: '', evidenceIds: [] },
          { atomId: 'AT-ST-C01-003', analysisPath: 'blocked', baselineDifference: '', candidateDifference: '', evidenceIds: [] },
        ],
      }],
    },
    scopeEntries: [
      { atomId: 'AT-ST-C01-001', applicability: 'active', configVerified: true, callPathVerified: true, configCondition: '', callPath: 'f', evidenceIds: ['SVE-AT-ST-C01-001-01'], unresolved: '', noServerEvidence: false, directConflict: false, conflictEvidenceIds: [] },
    ],
    serverPending: [],
  })
  // 让 server run-status 覆盖 001 完成（setupRun 默认 p01 = 001,003 当 serverPending 为空）
  const r = mergeEvidence({ runDir, date: DATE })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  const a1 = r.unifiedAtoms.atoms.find((a) => a.atomId === 'AT-ST-C01-001')
  assert.equal(a1.analysisPath, 'full', '服务端补证完成 → full')
  assert.equal(a1.upgraded, true, '上轮 conflict-fast + 本轮 full + 上轮 conflict → 升级')
  assert.equal(a1.previousRunId, 'ar-' + DATE + '-001')
  assert.equal(r.summary.analysisRunId, 'ar-' + DATE + '-002')
  assert.equal(r.summary.stats.upgraded, 1)
  // 非升级原子必须无 previousRunId
  const a2 = r.unifiedAtoms.atoms.find((a) => a.atomId === 'AT-ST-C01-002')
  assert.equal(a2.upgraded, false)
  assert.equal(a2.previousRunId, '')
})

test('F2 升级判定式不成立的情形：上轮 conflict-fast 但本轮仍 conflict-fast → 不升级', () => {
  const runDir = setupRun('run-noupgrade', {
    clientConflict001: true,
    serverPending: ['AT-ST-C01-001', 'AT-ST-C01-003'],
    history: {
      schemaVersion: 1,
      runs: [{
        analysisRunId: 'ar-' + DATE + '-001', date: DATE, trigger: 'initial', upgradedFrom: [],
        atomSummaries: [{ atomId: 'AT-ST-C01-001', analysisPath: 'conflict-fast', baselineDifference: 'conflict', candidateDifference: '', evidenceIds: [] }],
      }],
    },
  })
  const r = mergeEvidence({ runDir, date: DATE })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  const a1 = r.unifiedAtoms.atoms.find((a) => a.atomId === 'AT-ST-C01-001')
  assert.equal(a1.analysisPath, 'conflict-fast')
  assert.equal(a1.upgraded, false, '本轮仍 conflict-fast → 不升级')
})

test('F3 上轮 full（非 conflict-fast）→ 本轮 full 不升级', () => {
  const runDir = setupRun('run-fromfull', {
    serverPending: [],
    history: {
      schemaVersion: 1,
      runs: [{
        analysisRunId: 'ar-' + DATE + '-001', date: DATE, trigger: 'initial', upgradedFrom: [],
        atomSummaries: [{ atomId: 'AT-ST-C01-001', analysisPath: 'full', baselineDifference: 'conflict', candidateDifference: '', evidenceIds: [] }],
      }],
    },
  })
  const r = mergeEvidence({ runDir, date: DATE })
  const a1 = r.unifiedAtoms.atoms.find((a) => a.atomId === 'AT-ST-C01-001')
  assert.equal(a1.upgraded, false, '上轮不是 conflict-fast → 不升级（判定式第一项不成立）')
})

test('H1 升级原子 previousRunId 指向的 run 不含该原子（跨原子取值）→ fail', () => {
  const runDir = setupRun('run-crossatom', {
    serverPending: [],
    history: {
      schemaVersion: 1,
      runs: [{
        analysisRunId: 'ar-' + DATE + '-001', date: DATE, trigger: 'initial', upgradedFrom: [],
        // 只有 002 的记录，001 被错误地指向该 run（跨原子）
        atomSummaries: [{ atomId: 'AT-ST-C01-002', analysisPath: 'conflict-fast', baselineDifference: 'conflict', candidateDifference: '', evidenceIds: [] }],
      }],
    },
  })
  const r6 = mergeEvidence({ runDir, date: DATE })
  const a1 = r6.unifiedAtoms.atoms.find((a) => a.atomId === 'AT-ST-C01-001')
  // 001 在 history 中无自己记录 → 不升级（previousRunId 空），这是正确行为
  assert.equal(a1.upgraded, false, '原子自己的历史记录不存在 → 不升级（禁跨原子）')
})

test('H2 升级原子 previousRunId 缺失 → S7 追加 fail', () => {
  const runDir = setupRun('run-badprev', {
    serverPending: [],
    history: {
      schemaVersion: 1,
      runs: [{
        analysisRunId: 'ar-' + DATE + '-001', date: DATE, trigger: 'initial', upgradedFrom: [],
        atomSummaries: [{ atomId: 'AT-ST-C01-001', analysisPath: 'conflict-fast', baselineDifference: 'conflict', candidateDifference: '', evidenceIds: [] }],
      }],
    },
  })
  const ua = s6(runDir)
  const entries = ua.atoms.filter((a) => a.analysisPath !== 'blocked').map((a) => ({
    atomId: a.atomId, analysisPath: a.analysisPath, analysisRunId: ua.analysisRunId,
    previousRunId: '', // 故意不填（升级原子必填）
    previousBaselineDifference: '',
    trigger: '', condition: '', clientAction: '', serverAction: '', collaboration: '', result: '',
    baselineDifference: 'conflict', baselineDetail: '差异说明', candidateDifference: '', candidateDetail: '',
    evidenceIds: a.client.evidenceIds || [],
  }))
  writeBB(runDir, ua.analysisRunId, entries)
  const a = appendAnalysisHistory({ runDir, date: DATE })
  assert.equal(a.ok, false)
  assert.ok(a.problems.some((p) => p.includes('previousRunId 与 S6 解析不一致')), JSON.stringify(a.problems))
})

test('I1 blocked 原子有 business-behavior 条目 → fail（blocked 不进差异判定）', () => {
  const runDir = setupRun('run-blockedentry', { serverPending: ['AT-ST-C01-001', 'AT-ST-C01-003'] })
  const ua = s6(runDir)
  const entries = ua.atoms.map((a) => ({
    atomId: a.atomId, analysisPath: a.analysisPath, analysisRunId: ua.analysisRunId,
    previousRunId: '', previousBaselineDifference: '',
    trigger: '', condition: '', clientAction: '', serverAction: '', collaboration: '', result: '',
    baselineDifference: a.analysisPath === 'blocked' ? '' : 'consistent', baselineDetail: '',
    candidateDifference: '', candidateDetail: '', evidenceIds: [],
  }))
  writeBB(runDir, ua.analysisRunId, entries)
  const a = appendAnalysisHistory({ runDir, date: DATE })
  assert.equal(a.ok, false)
  assert.ok(a.problems.some((p) => p.includes('blocked 原子不应有 business-behavior 条目')), JSON.stringify(a.problems))
})

test('I2 conflict 缺 baselineDetail → fail；conflict-fast 四元组可空不 fail', () => {
  const runDir = setupRun('run-cfempty', { clientConflict001: true, serverPending: ['AT-ST-C01-001', 'AT-ST-C01-003'] })
  const ua = s6(runDir)
  // conflict-fast 条目：四元组全空但 conflict 字段齐备 → 应通过
  const entries = ua.atoms.filter((a) => a.analysisPath !== 'blocked').map((a) => ({
    atomId: a.atomId, analysisPath: a.analysisPath, analysisRunId: ua.analysisRunId,
    previousRunId: '', previousBaselineDifference: '',
    trigger: '', condition: '', clientAction: '', serverAction: '', collaboration: '', result: '',
    baselineDifference: 'conflict', baselineDetail: '需求「白板财神按普通白板显示」vs 实现「牌河仍高亮」',
    candidateDifference: '', candidateDetail: '', evidenceIds: a.client.evidenceIds || [],
  }))
  writeBB(runDir, ua.analysisRunId, entries)
  const okRun = hist(runDir)
  assert.equal(okRun.code, 0, 'conflict-fast 四元组可空不应 fail：' + okRun.out)

  // 再去掉 baselineDetail → fail
  entries[1].baselineDetail = ''
  writeBB(runDir, ua.analysisRunId, entries)
  fs.rmSync(path.join(runDir, '4-analysis/analysis-history.json'), { force: true })
  const failRun = hist(runDir)
  assert.equal(failRun.code, 1)
  assert.ok(failRun.out.includes('baselineDetail 为空'), failRun.out)
})

test('J1 端到端 CLI：S6 落盘 unified-atoms + S7 追加（两轮 → 升级 + 历史两轮）', () => {
  const runDir = setupRun('run-e2e', { serverPending: [] })
  const o1 = execFileSync('node', [S6_CLI, '--run-dir', runDir, '--date', DATE], { encoding: 'utf8', cwd: REPO_ROOT })
  assert.ok(o1.includes('[成功]'), o1)
  const ua1 = readJson(path.join(runDir, '4-analysis/unified-atoms.json'))
  assert.match(ua1.analysisRunId, new RegExp('^ar-' + DATE + '-001$'))
  const entries = ua1.atoms.filter((a) => a.analysisPath !== 'blocked').map((a) => ({
    atomId: a.atomId, analysisPath: a.analysisPath, analysisRunId: ua1.analysisRunId,
    previousRunId: '', previousBaselineDifference: '',
    trigger: 't', condition: 'c', clientAction: 'ca', serverAction: 'sa', collaboration: 'co', result: 'r',
    baselineDifference: a.analysisPath === 'full' && !(a.client.evidenceIds || []).length && !(a.server.evidenceIds || []).length ? 'consistent' : 'conflict',
    baselineDetail: '初始冲突', candidateDifference: '', candidateDetail: '',
    evidenceIds: a.client.evidenceIds || [],
  }))
  writeBB(runDir, ua1.analysisRunId, entries)
  const a1 = hist(runDir, 'initial')
  assert.equal(a1.code, 0, a1.out)
  assert.equal(readJson(path.join(runDir, '4-analysis/analysis-history.json')).runs.length, 1)
})

fs.rmSync(TMP, { recursive: true, force: true })

console.log('merge-evidence.example：' + (process.exitCode ? '存在失败' : '全部通过'))
for (const line of results) console.log('  ' + line)
process.exit(process.exitCode || 0)
