// decision-fingerprint.example.mjs —— 决议适用性保护 + 影响集合新旧证据 diff（断言式）
//
// 执行文档 §11.8 / D33 / D20 / D24；评审报告 P0-2、P1-2 整改验收。
// 覆盖：
//   A. bind：只绑定改变正式结论的动作（hold/re-verify 跳过）；写入 analysisRunId + approvedConclusion
//      + evidenceFingerprint；指纹只聚合该 Atom 实际引用的证据（无关证据变化不连坐）
//   B. check：valid / stale（指纹变、结论变）/ orphan（atomId 已不在 Registry）
//   C. stale 门：apply-decisions 跳过 stale 决议（不自动沿用），输出须重新确认清单
//   D. 同 run 重跑：指纹未变 → valid → 决议正常应用（幂等，不误判 stale）
//   E. 影响集合 diff：changed（contentHash/claimKey/atomIds 变）/ added / removed；
//      移除证据只存在于旧索引也必须牵连（old ∪ new atomIds）
//   F. previous-evidence-index 缺失 → degraded 标注（不静默偏小）
//   G. CLI：bind / check 落盘 + 退出码
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { bindDecisionFingerprints, checkDecisionApplicability } from './decision-fingerprint.mjs'
import { applyDecisions } from './apply-decisions.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const FP_CLI = path.join(REPO_ROOT, '.opencode-workflows/scripts/decision-fingerprint.mjs')
const TMP = path.join(REPO_ROOT, '.opencode-workflows/scripts/tmp-dec-fp')
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

// atoms: [{ atomId, verdict, evidence:[{id,atomIds,contentHash,claimKey,excerpt,dep}] }]
function setupRun(runId, atoms, opt = {}) {
  const runDir = path.join(TMP, 'runs', runId)
  fs.rmSync(runDir, { recursive: true, force: true })
  const regAtoms = atoms.map((a) => ({
    atomId: a.atomId, name: '', rule: 'r', uiRequirement: '', verificationScope: a.scope || 'both',
    businessBehavior: {}, source: { chapter: 'c', fromLine: 1, toLine: 2 },
  }))
  writeJson(path.join(runDir, '1-registry/requirement-registry.json'), {
    schemaVersion: 1, date: DATE,
    stages: [{ stageId: 'ST-C01', name: 's', chapter: 'c', summary: '', featureCount: 1, atomCount: regAtoms.length }],
    features: [{ id: 'FP-ST-C01-001', stageId: 'ST-C01', name: 'f', description: '', scope: '', coordination: '', atoms: regAtoms }],
    stats: {},
  })

  const cle = []
  const sve = []
  const clientEntries = []
  const uaAtoms = []
  const drEntries = []
  const bbEntries = []

  for (const a of atoms) {
    const ids = []
    for (const ev of a.evidence || []) {
      cle.push({
        id: ev.id, atomIds: ev.atomIds || [a.atomId], claimKey: ev.claimKey || 'k', repoId: 'c',
        layer: 'client_code', file: ev.file || 'f.ts', location: ev.location || 'f.ts:1',
        symbol: '', excerpt: ev.excerpt || '', configKeys: [], contentHash: ev.contentHash || 'sha256:a',
        dependencyFiles: ev.dep || [],
      })
      ids.push(ev.id)
    }
    clientEntries.push({
      atomId: a.atomId, verdict: a.verdict || 'confirmed', evidenceIds: ids,
      directConflict: false, conflictEvidenceIds: [], observedBehavior: {},
    })
    uaAtoms.push({
      atomId: a.atomId,
      requirement: { rule: 'r', uiRequirement: '', source: {}, verificationScope: a.scope || 'both', businessBehavior: {} },
      client: { verdict: a.verdict || 'confirmed', evidenceIds: ids, observedBehavior: {}, directConflict: false, conflictEvidenceIds: [], pending: false },
      server: { applicability: a.applicability || 'active', evidenceIds: [], configCondition: '', directConflict: false, conflictEvidenceIds: [], pending: false },
      analysisPath: 'full', previousRunId: '', baselineDifference: '', upgraded: false,
    })
    bbEntries.push({ atomId: a.atomId, analysisPath: 'full', analysisRunId: opt.analysisRunId || 'ar-' + DATE + '-001', baselineDifference: a.baseline || 'conflict', baselineDetail: 'd', candidateDifference: '', candidateDetail: '', evidenceIds: ids })
    drEntries.push({
      atomId: a.atomId, previousDifference: a.baseline || 'conflict', candidateDifference: '', clientVerdict: a.verdict || 'confirmed',
      serverApplicability: a.applicability || 'active', reviewedDifference: a.reviewed || 'consistent',
      reviewReason: '理由', reviewRule: 'evidence-is-not-consistency', reviewStatus: opt.drStatus || 'pending', evidenceScopes: [],
    })
  }

  writeJson(path.join(runDir, '2-client/client-evidence.json'), { schemaVersion: 1, date: DATE, source: [{ repoId: 'c' }], entries: clientEntries, evidence: cle, coverage: {}, stats: {} })
  writeJson(path.join(runDir, '3-server/server-evidence.json'), { schemaVersion: 1, evidence: sve, stats: {} })
  writeJson(path.join(runDir, '4-analysis/unified-atoms.json'), { schemaVersion: 1, date: DATE, analysisRunId: opt.analysisRunId || 'ar-' + DATE + '-001', atoms: uaAtoms, stats: {} })
  writeJson(path.join(runDir, '4-analysis/business-behavior.json'), { schemaVersion: 1, analysisRunId: opt.analysisRunId || 'ar-' + DATE + '-001', entries: bbEntries, stats: {} })
  writeJson(path.join(runDir, '4-analysis/difference-review.json'), { schemaVersion: 2, analysisRunId: opt.analysisRunId || 'ar-' + DATE + '-001', entries: drEntries })
  if (opt.decisions) writeJson(path.join(runDir, '6-review/decisions.json'), { schemaVersion: 1, date: DATE, decisions: opt.decisions })
  if (opt.prevIdx) writeJson(path.join(runDir, '6-review/runtime/previous-evidence-index.json'), opt.prevIdx)
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

const baseAtoms = [
  { atomId: 'AT-ST-C01-001', evidence: [{ id: 'CLE-AT-ST-C01-001-01', contentHash: 'sha256:a1' }] },
  { atomId: 'AT-ST-C01-002', evidence: [{ id: 'CLE-AT-ST-C01-002-01', contentHash: 'sha256:b1' }] },
]

// ============================================================
// A：bind
// ============================================================
test('A1 bind：只绑定改变正式结论的动作，写入 runId/结论/指纹', () => {
  const runDir = setupRun('run-bind', baseAtoms, {
    decisions: [
      { atomId: 'AT-ST-C01-001', action: 'approve', target: 'difference-review' },
      { atomId: 'AT-ST-C01-002', action: 'hold', target: 'difference-review' },
      { atomId: 'AT-ST-C01-002', action: 're-verify', target: 'pending', retryScope: 'both' },
    ],
  })
  const r = bindDecisionFingerprints({ runDir, date: DATE })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  assert.equal(r.summary.bound, 1, 'approve 绑定；hold/re-verify 跳过')
  assert.equal(r.summary.skipped, 2)
  const d = r.decisions.decisions.find((x) => x.action === 'approve')
  assert.equal(d.analysisRunId, 'ar-' + DATE + '-001')
  assert.equal(d.approvedConclusion, 'consistent', 'approve 的结论取 reviewedDifference')
  assert.match(d.evidenceFingerprint, /^sha256:[0-9a-f]{64}$/)
})

test('A2 指纹只聚合该 Atom 实际引用的证据：无关证据变化不导致 stale', () => {
  const runDir = setupRun('run-bind2', [
    ...baseAtoms,
    { atomId: 'AT-ST-C01-003', evidence: [{ id: 'CLE-AT-ST-C01-003-01', contentHash: 'sha256:c1' }] },
  ], {
    decisions: [{ atomId: 'AT-ST-C01-001', action: 'approve', target: 'difference-review' }],
  })
  const b = bindDecisionFingerprints({ runDir, date: DATE })
  writeJson(path.join(runDir, '6-review/decisions.json'), b.decisions)
  const fpBefore = b.decisions.decisions[0].evidenceFingerprint

  // 改 003 的证据（001 未引用它）→ 001 决议仍 valid
  const cle = readJson(path.join(runDir, '2-client/client-evidence.json'))
  cle.evidence.find((e) => e.id === 'CLE-AT-ST-C01-003-01').contentHash = 'sha256:CHANGED-OTHER'
  writeJson(path.join(runDir, '2-client/client-evidence.json'), cle)

  const c = checkDecisionApplicability({ runDir })
  assert.equal(c.ok, true, JSON.stringify(c.problems))
  const it = c.applicability.items.find((x) => x.atomId === 'AT-ST-C01-001')
  assert.equal(it.status, 'valid', '无关证据变化不得连坐（§11.8 原文要求）')
  assert.equal(c.summary.stale, 0)
  assert.equal(fpBefore, readJson(path.join(runDir, '6-review/decisions.json')).decisions[0].evidenceFingerprint)
})

// ============================================================
// B：check 三态
// ============================================================
test('B1 check：被引用证据 hash 变 → stale（须重新确认）', () => {
  const runDir = setupRun('run-stale', baseAtoms, {
    decisions: [{ atomId: 'AT-ST-C01-001', action: 'approve', target: 'difference-review' }],
  })
  const b = bindDecisionFingerprints({ runDir, date: DATE })
  writeJson(path.join(runDir, '6-review/decisions.json'), b.decisions)

  const cle = readJson(path.join(runDir, '2-client/client-evidence.json'))
  cle.evidence.find((e) => e.id === 'CLE-AT-ST-C01-001-01').contentHash = 'sha256:NEWHASH'
  writeJson(path.join(runDir, '2-client/client-evidence.json'), cle)

  const c = checkDecisionApplicability({ runDir })
  const it = c.applicability.items[0]
  assert.equal(it.status, 'stale')
  assert.ok(it.reason.includes('证据指纹变化'), it.reason)
  assert.equal(c.summary.requiresReconfirm, 1)
})

test('B2 check：依赖链文件 hash 变 → stale（dependencyFiles 进指纹）', () => {
  const runDir = setupRun('run-stale-dep', [
    { atomId: 'AT-ST-C01-001', evidence: [{ id: 'CLE-AT-ST-C01-001-01', contentHash: 'sha256:a1', dep: [{ file: 'Ctrl.ts', contentHash: 'sha256:dep1' }] }] },
  ], { decisions: [{ atomId: 'AT-ST-C01-001', action: 'approve', target: 'difference-review' }] })
  const b = bindDecisionFingerprints({ runDir, date: DATE })
  writeJson(path.join(runDir, '6-review/decisions.json'), b.decisions)

  const cle = readJson(path.join(runDir, '2-client/client-evidence.json'))
  cle.evidence[0].dependencyFiles = [{ file: 'Ctrl.ts', contentHash: 'sha256:dep2' }]
  writeJson(path.join(runDir, '2-client/client-evidence.json'), cle)

  const c = checkDecisionApplicability({ runDir })
  assert.equal(c.applicability.items[0].status, 'stale', '依赖链变化必须使决议过期（行为可能已变）')
})

test('B3 check：被审批结论变化 → stale', () => {
  const runDir = setupRun('run-stale-concl', baseAtoms, {
    decisions: [{ atomId: 'AT-ST-C01-001', action: 'approve', target: 'difference-review' }],
  })
  const b = bindDecisionFingerprints({ runDir, date: DATE })
  writeJson(path.join(runDir, '6-review/decisions.json'), b.decisions)

  // 结论被改成 conflict（证据未变）
  const dr = readJson(path.join(runDir, '4-analysis/difference-review.json'))
  dr.entries[0].reviewedDifference = 'conflict'
  writeJson(path.join(runDir, '4-analysis/difference-review.json'), dr)

  const c = checkDecisionApplicability({ runDir })
  assert.equal(c.applicability.items[0].status, 'stale')
  assert.ok(c.applicability.items[0].reason.includes('复核建议已变'), c.applicability.items[0].reason)
})

test('B4 check：atomId 已不在 Registry → orphan；未绑指纹的旧决议 → stale', () => {
  const runDir = setupRun('run-orphan', baseAtoms, {
    decisions: [
      { atomId: 'AT-ST-C99-001', action: 'approve', target: 'difference-review' },
      { atomId: 'AT-ST-C01-002', action: 'approve', target: 'difference-review' }, // 未绑指纹
    ],
  })
  const c = checkDecisionApplicability({ runDir })
  assert.equal(c.ok, true, JSON.stringify(c.problems))
  assert.equal(c.applicability.items.find((x) => x.atomId === 'AT-ST-C99-001').status, 'orphan')
  const unbound = c.applicability.items.find((x) => x.atomId === 'AT-ST-C01-002')
  assert.equal(unbound.status, 'stale')
  assert.ok(unbound.reason.includes('未绑定 evidenceFingerprint'), unbound.reason)
})

// ============================================================
// C/D：stale 门 + 同 run 幂等
// ============================================================
test('C1 stale 门：证据变化后 approve 决议被跳过（不自动沿用），并进须重新确认清单', () => {
  const runDir = setupRun('run-gate', baseAtoms, {
    decisions: [{ atomId: 'AT-ST-C01-001', action: 'approve', target: 'difference-review' }],
  })
  const b = bindDecisionFingerprints({ runDir, date: DATE })
  writeJson(path.join(runDir, '6-review/decisions.json'), b.decisions)

  // 证据变化 → 决议 stale
  const cle = readJson(path.join(runDir, '2-client/client-evidence.json'))
  cle.evidence[0].contentHash = 'sha256:NEW'
  writeJson(path.join(runDir, '2-client/client-evidence.json'), cle)

  const r = applyDecisions({ runDir, date: DATE })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  assert.equal(r.summary.requiresReconfirm, 1, 'stale 决议必须被拦截')
  const dr = r.differenceReview.entries.find((e) => e.atomId === 'AT-ST-C01-001')
  assert.equal(dr.reviewStatus, 'pending', 'stale 决议不得生效，保持 pending')
  assert.ok(r.summary.skippedStale[0].reason.includes('证据指纹变化'))
})

test('D1 同 run 重跑幂等：指纹未变 → valid → 决议正常应用', () => {
  const runDir = setupRun('run-idem', baseAtoms, {
    decisions: [{ atomId: 'AT-ST-C01-001', action: 'approve', target: 'difference-review' }],
  })
  const b = bindDecisionFingerprints({ runDir, date: DATE })
  writeJson(path.join(runDir, '6-review/decisions.json'), b.decisions)

  const c = checkDecisionApplicability({ runDir })
  assert.equal(c.summary.valid, 1, '刚绑定的决议必须 valid')

  const r = applyDecisions({ runDir, date: DATE })
  assert.equal(r.summary.requiresReconfirm, 0, '同 run 不应误判 stale')
  assert.equal(r.differenceReview.entries.find((e) => e.atomId === 'AT-ST-C01-001').reviewStatus, 'approved')
})

test('D2 re-verify / hold 不受 stale 门拦截（补证请求与挂起无需适用性保护）', () => {
  const runDir = setupRun('run-reverify', baseAtoms, {
    decisions: [
      { atomId: 'AT-ST-C01-001', action: 're-verify', target: 'pending', retryScope: 'both' },
      { atomId: 'AT-ST-C01-002', action: 'hold', target: 'difference-review' },
    ],
  })
  // 不 bind（旧格式 → 若走门会被判 stale）
  const r = applyDecisions({ runDir, date: DATE })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  assert.equal(r.summary.requiresReconfirm, 0, 're-verify/hold 不应被 stale 门拦截')
  assert.equal(r.differenceReview.entries.find((e) => e.atomId === 'AT-ST-C01-002').reviewStatus, 'pending')
})

// ============================================================
// E/F：影响集合 diff
// ============================================================
const prevIdxOf = (evidence) => ({
  schemaVersion: 1, analysisRunId: 'ar-' + DATE + '-001', date: DATE,
  client: { evidence }, server: { evidence: [] },
})

test('E1 diff：证据 atomIds 变化 → changed，old ∪ new 均牵连进影响集合', () => {
  const runDir = setupRun('run-diff', [
    { atomId: 'AT-ST-C01-001', evidence: [{ id: 'CLE-AT-ST-C01-001-01', atomIds: ['AT-ST-C01-001'], contentHash: 'sha256:a1' }] },
    { atomId: 'AT-ST-C01-002', evidence: [{ id: 'CLE-AT-ST-C01-002-01', contentHash: 'sha256:b1' }] },
  ], {
    decisions: [{ atomId: 'AT-ST-C01-001', action: 're-verify', target: 'pending', retryScope: 'client' }],
    prevIdx: prevIdxOf([{
      id: 'CLE-AT-ST-C01-001-01', mergeKey: '', contentHash: 'sha256:a1', location: 'f.ts:1', claimKey: 'k', excerpt: '',
      dependencyFiles: '[]', atomIds: ['AT-ST-C01-001', 'AT-ST-C01-002'], // 上轮共享给 002
    }]),
  })
  const r = applyDecisions({ runDir, date: DATE })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  assert.equal(r.impactSet.evidenceDiff.degraded, false)
  assert.equal(r.impactSet.evidenceDiff.client.changed.length, 1, 'atomIds 变化应检出')
  assert.ok(r.impactSet.evidenceDiff.client.changed[0].changedFields.includes('atomIds'))
  assert.ok(r.impactSet.impactSet.client.includes('AT-ST-C01-002'), '上轮 atomIds 中的 002 必须牵连（old ∪ new）')
})

test('E2 diff：证据被移除 → removed，其旧 atomIds 仍牵连', () => {
  const runDir = setupRun('run-diff-rm', [
    { atomId: 'AT-ST-C01-001', evidence: [{ id: 'CLE-AT-ST-C01-001-01', contentHash: 'sha256:a1' }] },
    { atomId: 'AT-ST-C01-002', evidence: [] },
  ], {
    decisions: [{ atomId: 'AT-ST-C01-001', action: 're-verify', target: 'pending', retryScope: 'client' }],
    prevIdx: prevIdxOf([{
      id: 'CLE-OLD-99', mergeKey: '', contentHash: 'sha256:old', location: 'old.ts:1', claimKey: 'old', excerpt: '',
      dependencyFiles: '[]', atomIds: ['AT-ST-C01-002'],
    }]),
  })
  const r = applyDecisions({ runDir, date: DATE })
  assert.equal(r.impactSet.evidenceDiff.client.removed.length, 1)
  assert.ok(r.impactSet.impactSet.client.includes('AT-ST-C01-002'), '被移除证据的旧 atomIds 必须牵连')
})

test('E3 diff：新增证据 → added；无上轮快照 → degraded 标注', () => {
  const runDir = setupRun('run-diff-add', [
    { atomId: 'AT-ST-C01-001', evidence: [{ id: 'CLE-NEW-01', contentHash: 'sha256:n' }] },
    { atomId: 'AT-ST-C01-002', evidence: [] },
  ], {
    decisions: [{ atomId: 'AT-ST-C01-001', action: 're-verify', target: 'pending', retryScope: 'client' }],
    prevIdx: prevIdxOf([]),
  })
  const r1 = applyDecisions({ runDir, date: DATE })
  assert.equal(r1.impactSet.evidenceDiff.client.added.length, 1)
  assert.equal(r1.impactSet.evidenceDiff.degraded, false)

  // 换新 run，不给 prevIdx
  const runDir2 = setupRun('run-diff-deg', [
    { atomId: 'AT-ST-C01-001', evidence: [{ id: 'CLE-NEW-01', contentHash: 'sha256:n' }] },
  ], { decisions: [{ atomId: 'AT-ST-C01-001', action: 're-verify', target: 'pending', retryScope: 'client' }] })
  const r2 = applyDecisions({ runDir: runDir2, date: DATE })
  assert.equal(r2.impactSet.evidenceDiff.degraded, true, '无上轮快照必须标注 degraded（不静默偏小）')
  assert.ok(r2.impactSet.evidenceDiff.degradedReason.includes('previous-evidence-index.json 缺失'))
})

test('E4 apply-decisions 落盘 previous-evidence-index（供下一轮 diff）', () => {
  const runDir = setupRun('run-snap', baseAtoms, {
    decisions: [{ atomId: 'AT-ST-C01-001', action: 're-verify', target: 'pending', retryScope: 'client' }],
  })
  const out = cli([path.join(REPO_ROOT, '.opencode-workflows/scripts/apply-decisions.mjs'), '--run-dir', runDir, '--date', DATE])
  assert.equal(out.code, 0, out.out)
  const snap = readJson(path.join(runDir, '6-review/runtime/previous-evidence-index.json'))
  assert.equal(snap.analysisRunId, 'ar-' + DATE + '-001')
  assert.equal(snap.client.evidence.length, 2, '快照应含当前全部客户端证据')
  assert.ok(snap.client.evidence.every((e) => Array.isArray(e.atomIds)))
})

// ============================================================
// G：CLI
// ============================================================
test('G1 CLI bind/check：落盘 decisions + decision-applicability，退出码 0', () => {
  const runDir = setupRun('run-cli', baseAtoms, {
    decisions: [{ atomId: 'AT-ST-C01-001', action: 'approve', target: 'difference-review' }],
  })
  const b = cli([FP_CLI, 'bind', '--run-dir', runDir, '--date', DATE])
  assert.equal(b.code, 0, b.out)
  assert.ok(b.out.includes('绑定 1'))
  const d = readJson(path.join(runDir, '6-review/decisions.json')).decisions[0]
  assert.ok(d.evidenceFingerprint)

  const c = cli([FP_CLI, 'check', '--run-dir', runDir])
  assert.equal(c.code, 0, c.out)
  assert.ok(c.out.includes('valid 1'))
  assert.ok(fs.existsSync(path.join(runDir, '6-review/runtime/decision-applicability.json')))
})

test('G2 CLI 缺参 → 退出码 1；无 decisions 时 check 返回 no-decisions 不报错', () => {
  assert.equal(cli([FP_CLI, 'bind']).code, 1)
  const runDir = setupRun('run-nod', baseAtoms)
  const c = checkDecisionApplicability({ runDir })
  assert.equal(c.ok, true)
  assert.equal(c.summary.status, 'no-decisions')
})

fs.rmSync(TMP, { recursive: true, force: true })

console.log('decision-fingerprint.example：' + (process.exitCode ? '存在失败' : '全部通过'))
for (const line of results) console.log('  ' + line)
process.exit(process.exitCode || 0)
