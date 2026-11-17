// spec-decisions.example.mjs —— S10 统一索引 + S11 人工裁决（断言式）
//
// 执行文档 §5 S10/S11、§8 D12/D20/D24/D34、§16。覆盖：
//   A. S10 feature_index schema v3：双端字段、blocked 原子 difference 空 + l7 派生 verification_required
//      + l7Basis=pending-blocked（不入 l7 统计）、dependencyFiles 文件级清单（D34）
//   B. S10 trace_index：追溯条目（来源阶段/行号/证据数/审批状态）
//   C. S10 pending-list：按类分组（blocked / decision_required / verification_required / review_pending）
//      + stale 与依赖链提示（§7 hash 优先）
//   D. S10 机械校验七维度子集 + verify-report
//   E. S11 决议校验：action/target/retryScope/modifiedValue、atomId 属 Registry、retryScope 与必要端一致性
//   F. S11 审批应用：approve → approved；modify → approved + 改写值；reject → rejected；hold → pending
//   G. S11 影响集合（D20/D24）：T ∪ 共享证据 atomIds 反查（含非补证目标原子）
//   H. S11 补证分片：端级 -rc/-rp + retryHint + 共享证据牵连标注
//   I. 端到端 CLI：S10 落盘四产物；S11 落盘 impact-set + 分片 + 回写 DR
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildUnifiedIndex } from './build-unified-index.mjs'
import { applyDecisions } from './apply-decisions.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const TMP = path.join(REPO_ROOT, '.opencode-workflows/scripts/tmp-spec-dec')
const DATE = '2099-01-01'
const S10_CLI = path.join(REPO_ROOT, '.opencode-workflows/scripts/build-unified-index.mjs')
const S11_CLI = path.join(REPO_ROOT, '.opencode-workflows/scripts/apply-decisions.mjs')

const writeJson = (p, data) => {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(data, null, 1) + '\n', 'utf8')
}
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))

// atoms: [{ atomId, scope, analysisPath, verdict, applicability, l7, effective, l7Basis, drStatus?, clientEvidence?, sharedWith? }]
function setupRun(runId, atomSpecs, opt = {}) {
  const runDir = path.join(TMP, 'runs', runId)
  fs.rmSync(runDir, { recursive: true, force: true })
  const regAtoms = atomSpecs.map((a) => ({
    atomId: a.atomId, name: 'n', rule: '规则 ' + a.atomId, uiRequirement: '',
    verificationScope: a.scope, businessBehavior: {}, source: { chapter: 'ch', fromLine: 3, toLine: 4 },
  }))
  writeJson(path.join(runDir, '1-registry/requirement-registry.json'), {
    schemaVersion: 1, date: DATE,
    stages: [{ stageId: 'ST-C01', name: 's', chapter: 'ch', summary: '', featureCount: 1, atomCount: regAtoms.length }],
    features: [{ id: 'FP-ST-C01-001', stageId: 'ST-C01', name: 'f', description: '', scope: '', coordination: '', atoms: regAtoms }],
    stats: { stageCount: 1, featureCount: 1, atomCount: regAtoms.length, perStage: [], scopeStats: {} },
  })

  const cle = []
  const sve = []
  const clientEntries = []
  const scopeEntries = []
  const uaAtoms = []
  const bbEntries = []
  const drEntries = []
  const l7Entries = []
  const blockedAtoms = []

  for (const a of atomSpecs) {
    const cEv = 'CLE-' + a.atomId + '-01'
    const sEv = 'SVE-' + a.atomId + '-01'
    // 客户端证据（atomIds 可含共享原子：a.sharedWith）
    if (a.verdict && a.verdict !== 'not_found') {
      cle.push({
        id: cEv, atomIds: [a.atomId].concat(a.sharedWith || []), claimKey: 'k', repoId: 'c',
        layer: 'client_code', file: 'f.ts', location: 'f.ts:1', symbol: '', excerpt: '', configKeys: [],
        contentHash: opt.clientHash || 'sha256:aaa', dependencyFiles: a.depChanged ? [{ file: 'dep.ts', contentHash: 'sha256:old' }] : [],
      })
      clientEntries.push({ atomId: a.atomId, verdict: a.verdict, evidenceIds: [cEv], directConflict: false, conflictEvidenceIds: [], observedBehavior: {} })
    } else {
      clientEntries.push({ atomId: a.atomId, verdict: 'not_found', evidenceIds: [], directConflict: false, conflictEvidenceIds: [], observedBehavior: {} })
    }
    if (a.applicability && a.applicability !== 'unknown') {
      sve.push({ id: sEv, atomIds: [a.atomId], claimKey: 'k', repoId: 's', layer: 'common_game', file: 'r.cpp', location: 'r.cpp:1', symbol: '', excerpt: '', configKeys: [], contentHash: 'sha256:sss' })
      scopeEntries.push({
        atomId: a.atomId, applicability: a.applicability, configVerified: true, callPathVerified: true,
        configCondition: a.applicability === 'conditional' ? 'cfg=1' : '', callPath: 'f', evidenceIds: [sEv],
        unresolved: '', noServerEvidence: false, directConflict: false, conflictEvidenceIds: [],
      })
    } else {
      scopeEntries.push({
        atomId: a.atomId, applicability: 'unknown', configVerified: false, callPathVerified: false,
        configCondition: '', callPath: '', evidenceIds: [], unresolved: '缺配置证据',
        noServerEvidence: true, directConflict: false, conflictEvidenceIds: [],
      })
    }
    uaAtoms.push({
      atomId: a.atomId,
      requirement: { rule: '规则 ' + a.atomId, uiRequirement: '', source: {}, verificationScope: a.scope, businessBehavior: {} },
      client: { verdict: a.verdict || 'not_found', evidenceIds: a.verdict && a.verdict !== 'not_found' ? [cEv] : [], observedBehavior: {}, directConflict: false, conflictEvidenceIds: [], pending: a.analysisPath === 'blocked' && a.scope !== 'server' },
      server: { applicability: a.applicability || '', evidenceIds: a.applicability && a.applicability !== 'unknown' ? [sEv] : [], configCondition: '', directConflict: false, conflictEvidenceIds: [], pending: a.analysisPath === 'blocked' && a.scope !== 'client' },
      analysisPath: a.analysisPath, previousRunId: '', baselineDifference: '', upgraded: false,
    })
    if (a.analysisPath === 'blocked') {
      blockedAtoms.push(a.atomId)
    } else {
      bbEntries.push({
        atomId: a.atomId, analysisPath: a.analysisPath, analysisRunId: 'ar-' + DATE + '-001',
        baselineDifference: a.baseline, baselineDetail: a.baseline === 'conflict' ? '需求 vs 实现' : '',
        candidateDifference: '', candidateDetail: '', evidenceIds: [],
      })
      l7Entries.push({ atomId: a.atomId, scope: a.l7scope || a.scope, scopeSource: 'scope-index', l7: a.l7, effectiveDifference: a.effective, l7Basis: a.l7Basis || 'proposed' })
      if (a.drStatus) {
        drEntries.push({
          atomId: a.atomId, previousDifference: a.baseline, candidateDifference: '', clientVerdict: a.verdict || '',
          serverApplicability: a.applicability || '', reviewedDifference: a.effective,
          reviewReason: '理由', reviewRule: 'evidence-is-not-consistency', reviewStatus: a.drStatus, evidenceScopes: [],
        })
      }
    }
  }

  writeJson(path.join(runDir, '2-client/client-evidence.json'), { schemaVersion: 1, date: DATE, source: [{ repoId: 'c' }], entries: clientEntries, evidence: cle, coverage: {}, stats: {} })
  writeJson(path.join(runDir, '3-server/scope-index.json'), { schemaVersion: 1, entries: scopeEntries, coverage: {}, stats: {} })
  writeJson(path.join(runDir, '3-server/server-evidence.json'), { schemaVersion: 1, evidence: sve, stats: {} })
  writeJson(path.join(runDir, '2-client/runtime/run-status.json'), { schemaVersion: 1, branch: 'client', date: DATE, runStatus: 'completed', parts: [{ partFile: 'ST-C01-cp01.json', stageId: 'ST-C01', status: 'completed', atomIds: atomSpecs.map((a) => a.atomId) }] })
  writeJson(path.join(runDir, '3-server/runtime/run-status.json'), { schemaVersion: 1, branch: 'server', date: DATE, runStatus: 'completed', parts: [{ partFile: 'ST-C01-p01.json', stageId: 'ST-C01', status: 'completed', atomIds: atomSpecs.map((a) => a.atomId) }] })
  if (opt.clientManifest) writeJson(path.join(runDir, '2-client/runtime/source-manifest.json'), opt.clientManifest)
  writeJson(path.join(runDir, '4-analysis/unified-atoms.json'), { schemaVersion: 1, date: DATE, analysisRunId: 'ar-' + DATE + '-001', atoms: uaAtoms, stats: {} })
  writeJson(path.join(runDir, '4-analysis/business-behavior.json'), { schemaVersion: 1, analysisRunId: 'ar-' + DATE + '-001', entries: bbEntries, stats: {} })
  writeJson(path.join(runDir, '4-analysis/difference-review.json'), { schemaVersion: 2, analysisRunId: 'ar-' + DATE + '-001', entries: drEntries })
  writeJson(path.join(runDir, '4-analysis/l7-classify.json'), {
    schemaVersion: 1, date: DATE, analysisRunId: 'ar-' + DATE + '-001', entries: l7Entries,
    stats: {}, baseline: {}, blockedAtoms: blockedAtoms,
  })
  if (opt.decisions) writeJson(path.join(runDir, '6-review/decisions.json'), { schemaVersion: 1, date: DATE, decisions: opt.decisions })
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
// A/B/C/D：S10
// ============================================================
const baseSpecs = [
  { atomId: 'AT-ST-C01-001', scope: 'both', analysisPath: 'full', verdict: 'confirmed', applicability: 'active', baseline: 'consistent', l7: 'verified', effective: 'consistent', l7Basis: 'approved' },
  { atomId: 'AT-ST-C01-002', scope: 'both', analysisPath: 'full', verdict: 'confirmed', applicability: 'active', baseline: 'conflict', l7: 'decision_required', effective: 'conflict', drStatus: 'pending' },
  { atomId: 'AT-ST-C01-003', scope: 'both', analysisPath: 'full', verdict: 'not_found', applicability: 'unknown', baseline: 'unverified', l7: 'verification_required', effective: 'unverified' },
  { atomId: 'AT-ST-C01-004', scope: 'both', analysisPath: 'blocked', verdict: 'not_found' },
]

test('A1 feature_index v3：双端字段 + 计数自洽', () => {
  const runDir = setupRun('run-s10a', baseSpecs)
  const r = buildUnifiedIndex({ runDir, date: DATE })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  const fi = r.outputs.featureIndex
  assert.equal(fi.schemaVersion, 3)
  assert.equal(fi.stats.atomCount, 4)
  const a1 = fi.features[0].atoms.find((x) => x.id === 'AT-ST-C01-001')
  assert.deepEqual(a1.clientVerification, { verdict: 'confirmed', evidenceIds: ['CLE-AT-ST-C01-001-01'], pending: false })
  assert.equal(a1.serverVerification.applicability, 'active')
  assert.equal(a1.difference, 'consistent')
  assert.equal(a1.l7, 'verified')
  assert.equal(fi.stats.verified, 1)
  assert.equal(fi.stats.decisionRequired, 1)
  assert.equal(fi.stats.verificationRequired, 1)
  assert.equal(fi.stats.blocked, 1)
})

test('A2 blocked 原子：difference 留空 + l7 派生 verification_required + l7Basis=pending-blocked（不入 l7 统计）', () => {
  const runDir = setupRun('run-s10a2', baseSpecs)
  const r = buildUnifiedIndex({ runDir, date: DATE })
  const fi = r.outputs.featureIndex
  const a4 = fi.features[0].atoms.find((x) => x.id === 'AT-ST-C01-004')
  assert.equal(a4.difference, '', 'blocked 原子 difference 留空')
  assert.equal(a4.l7, 'verification_required')
  assert.equal(a4.l7Basis, 'pending-blocked')
  assert.equal(a4.analysisPath, 'blocked')
  // blocked 不计入 l7 classify 的 verified/verification_required 分类统计口径（单独计数）
  assert.equal(fi.stats.blocked, 1)
})

test('A3 dependencyFiles 文件级清单（D34：S10 实际消费的全部直接输入）', () => {
  const runDir = setupRun('run-s10a3', baseSpecs)
  const r = buildUnifiedIndex({ runDir, date: DATE })
  const dep = r.outputs.featureIndex.dependencyFiles
  assert.equal(dep.length, 12, 'D34 列出的 12 个文件级输入')
  for (const must of [
    '1-registry/requirement-registry.json',
    '2-client/client-evidence.json',
    '2-client/runtime/run-status.json',
    '2-client/runtime/source-manifest.json',
    '3-server/scope-index.json',
    '3-server/server-evidence.json',
    '3-server/runtime/run-status.json',
    '3-server/runtime/source-manifest.json',
    '4-analysis/unified-atoms.json',
    '4-analysis/business-behavior.json',
    '4-analysis/difference-review.json',
    '4-analysis/l7-classify.json',
  ]) assert.ok(dep.includes(must), '缺少文件级依赖：' + must)
})

test('B1 trace_index：来源阶段/行号/证据数/审批状态齐全', () => {
  const runDir = setupRun('run-s10b', baseSpecs)
  const r = buildUnifiedIndex({ runDir, date: DATE })
  const t = r.outputs.traceIndex.entries
  assert.equal(t.length, 4)
  const e2 = t.find((x) => x.atomId === 'AT-ST-C01-002')
  assert.equal(e2.sourceStage, 'ST-C01')
  assert.deepEqual(e2.sourceLines, [3, 4])
  assert.equal(e2.reviewStatus, 'pending')
  assert.equal(e2.l7, 'decision_required')
  const e1 = t.find((x) => x.atomId === 'AT-ST-C01-001')
  assert.equal(e1.evidenceCount, 2, '客户端 + 服务端证据数')
})

test('C1 pending-list：分类分组（blocked/decision_required/verification_required/review_pending）', () => {
  const runDir = setupRun('run-s10c', baseSpecs)
  const r = buildUnifiedIndex({ runDir, date: DATE })
  const md = r.outputs.pendingMarkdown
  assert.ok(md.includes('## 查证未完成（必要端缺口）（1）'), md.slice(0, 400))
  assert.ok(md.includes('## 需策划裁决（1）'))
  assert.ok(md.includes('## 规则待验证（1）'))
  assert.ok(md.includes('另有待审批复核建议'), 'decision_required 原子的 pending 复核须在同一行标注')
  for (const id of ['AT-ST-C01-002', 'AT-ST-C01-003', 'AT-ST-C01-004']) assert.ok(md.includes(id), '清单覆盖：' + id)
})

test('C2 stale 与依赖链提示：证据 hash 变化 → stale；依赖文件 hash 变化 → 依赖链复核（§7）', () => {
  const runDir = setupRun('run-s10c2', [
    { atomId: 'AT-ST-C01-001', scope: 'both', analysisPath: 'full', verdict: 'confirmed', applicability: 'active', baseline: 'consistent', l7: 'verified', effective: 'consistent', depChanged: true },
  ], {
    clientHash: 'sha256:aaa',
    clientManifest: {
      schemaVersion: 1, branch: 'client', collectedAt: DATE,
      repos: [{ repoId: 'c', repoRoot: 'c', commit: 'unversioned', files: [{ file: 'f.ts', contentHash: 'sha256:CHANGED' }, { file: 'dep.ts', contentHash: 'sha256:NEWDEP' }] }],
    },
  })
  const r = buildUnifiedIndex({ runDir, date: DATE })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  const notes = r.summary.staleCount
  assert.ok(notes >= 2, '应有 stale + 依赖链两类提示，实际 ' + notes)
  assert.ok(r.outputs.pendingMarkdown.includes('证据时效与依赖链提示'))
  assert.ok(r.outputs.pendingMarkdown.includes('stale'), '含 stale 提示')
  assert.ok(r.outputs.pendingMarkdown.includes('依赖链'), '含依赖链复核提示')
})

test('D1 机械校验：blocked 派生口径 + l7 全有值 + 计数自洽全部通过', () => {
  const runDir = setupRun('run-s10d', baseSpecs)
  const r = buildUnifiedIndex({ runDir, date: DATE })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  assert.equal(r.summary.checkFail, 0, '机械校验应全过：' + JSON.stringify(r.outputs.checks.filter((c) => !c.ok)))
  assert.ok(r.outputs.verifyReport.includes('机械校验'))
  assert.ok(r.outputs.verifyReport.includes('| blocked（派生 verification_required） | 1 |'), '统计表用 blocked 名并给出派生口径')
})

// ============================================================
// E/F/G/H：S11
// ============================================================
const s11Specs = [
  // 001 与 002 共享 SVE（atomIds 含两者）→ 补证 001 时影响集合必须含 002
  { atomId: 'AT-ST-C01-001', scope: 'both', analysisPath: 'full', verdict: 'confirmed', applicability: 'active', baseline: 'conflict', l7: 'decision_required', effective: 'conflict', drStatus: 'pending', sharedWith: ['AT-ST-C01-002'] },
  { atomId: 'AT-ST-C01-002', scope: 'both', analysisPath: 'full', verdict: 'confirmed', applicability: 'active', baseline: 'consistent', l7: 'verified', effective: 'consistent', drStatus: 'pending' },
]

test('E1 决议校验：action 非法 / retryScope 与必要端矛盾 / modify 缺 modifiedValue 均 fail', () => {
  const bad1 = setupRun('run-s11e1', s11Specs, { decisions: [{ atomId: 'AT-ST-C01-001', action: 'nonsense', target: 'difference-review' }] })
  const r1 = applyDecisions({ runDir: bad1, date: DATE })
  assert.equal(r1.ok, false)
  assert.ok(r1.problems.some((p) => p.includes('action 非法')))

  const bad2 = setupRun('run-s11e2', [{ atomId: 'AT-ST-C01-001', scope: 'client', analysisPath: 'full', verdict: 'confirmed', baseline: 'consistent', l7: 'verified', effective: 'consistent' }], {
    decisions: [{ atomId: 'AT-ST-C01-001', action: 're-verify', target: 'pending', retryScope: 'server' }],
  })
  const r2 = applyDecisions({ runDir: bad2, date: DATE })
  assert.equal(r2.ok, false)
  assert.ok(r2.problems.some((p) => p.includes('与需求验证范围（client）矛盾')))

  const bad3 = setupRun('run-s11e3', s11Specs, { decisions: [{ atomId: 'AT-ST-C01-001', action: 'modify', target: 'difference-review' }] })
  const r3 = applyDecisions({ runDir: bad3, date: DATE })
  assert.equal(r3.ok, false)
  assert.ok(r3.problems.some((p) => p.includes('需 modifiedValue')))
})

test('F1 审批应用：approve / modify / reject / hold 语义正确', () => {
  const runDir = setupRun('run-s11f', s11Specs, {
    decisions: [
      { atomId: 'AT-ST-C01-001', action: 'approve', target: 'difference-review', reason: '确认冲突' },
      { atomId: 'AT-ST-C01-002', action: 'reject', target: 'difference-review', reason: '证据不足' },
    ],
  })
  const r = applyDecisions({ runDir, date: DATE })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  const byAtom = new Map(r.differenceReview.entries.map((e) => [e.atomId, e]))
  assert.equal(byAtom.get('AT-ST-C01-001').reviewStatus, 'approved')
  assert.equal(byAtom.get('AT-ST-C01-002').reviewStatus, 'rejected')

  // modify：改写结论并 approved
  const runDir2 = setupRun('run-s11f2', s11Specs, {
    decisions: [{ atomId: 'AT-ST-C01-002', action: 'modify', target: 'difference-review', modifiedValue: 'partial', reason: '人工判断' }],
  })
  const r2 = applyDecisions({ runDir: runDir2, date: DATE })
  assert.equal(r2.ok, true, JSON.stringify(r2.problems))
  const e = r2.differenceReview.entries.find((x) => x.atomId === 'AT-ST-C01-002')
  assert.equal(e.reviewStatus, 'approved')
  assert.equal(e.reviewedDifference, 'partial')
  assert.ok(e.reviewReason.includes('人工改写'))

  // hold：保持 pending
  const runDir3 = setupRun('run-s11f3', s11Specs, {
    decisions: [{ atomId: 'AT-ST-C01-001', action: 'hold', target: 'difference-review', reason: '待讨论' }],
  })
  const r3 = applyDecisions({ runDir: runDir3, date: DATE })
  assert.equal(r3.differenceReview.entries.find((x) => x.atomId === 'AT-ST-C01-001').reviewStatus, 'pending')
})

test('G1 影响集合（D20/D24）：补证目标 T ∪ 共享证据 atomIds 反查（含非目标原子）', () => {
  const runDir = setupRun('run-s11g', s11Specs, {
    decisions: [{ atomId: 'AT-ST-C01-001', action: 're-verify', target: 'pending', retryScope: 'both', reason: '补证' }],
  })
  const r = applyDecisions({ runDir, date: DATE })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  // T = {001}；001 的 CLE 证据 atomIds 含 001 + 002（共享）→ 反查得 002 → 影响集合 = {001, 002}
  assert.deepEqual(r.impactSet.retryScopeTargets.client, ['AT-ST-C01-001'])
  assert.ok(r.impactSet.impactSet.client.includes('AT-ST-C01-002'), '共享证据牵连的 002 必须在影响集合内')
  assert.ok(r.summary.sharedEvidenceCount >= 1, '必须记录共享证据牵连来源')
  assert.deepEqual(r.impactSet.rerunStages, ['S6', 'S7', 'S8', 'S9', 'S10'])
})

test('H1 补证分片：端级 -rc/-rp + retryHint + 共享证据牵连标注', () => {
  const runDir = setupRun('run-s11h', s11Specs, {
    decisions: [{ atomId: 'AT-ST-C01-001', action: 're-verify', target: 'pending', retryScope: 'both' }],
  })
  const out = execFileSync('node', [S11_CLI, '--run-dir', runDir, '--date', DATE], { encoding: 'utf8', cwd: REPO_ROOT })
  assert.ok(out.includes('[成功]'), out)
  const retryDir = path.join(runDir, '6-review/runtime/retry-input')
  const files = fs.readdirSync(retryDir).sort()
  assert.ok(files.some((f) => f.endsWith('-rc01.json')), '客户端补证分片 -rc：' + JSON.stringify(files))
  assert.ok(files.some((f) => f.endsWith('-rp01.json')), '服务端补证分片 -rp')
  const rc = readJson(path.join(retryDir, files.find((f) => f.endsWith('-rc01.json'))))
  const target = rc.atoms.find((x) => x.atomId === 'AT-ST-C01-001')
  const shared = rc.atoms.find((x) => x.atomId === 'AT-ST-C01-002')
  assert.equal(target.isRetryTarget, true)
  assert.ok(target.retryHint.includes('前轮缺口'))
  assert.equal(shared.isRetryTarget, false)
  assert.ok(shared.retryHint.includes('共享证据牵连'))
  const impact = readJson(path.join(runDir, '6-review/runtime/impact-set.json'))
  assert.ok(Array.isArray(impact.impactSet.client))
})

// ============================================================
// I：端到端 CLI
// ============================================================
test('I1 端到端 CLI：S10 落盘四产物 + 退出码 0', () => {
  const runDir = setupRun('run-e2e', baseSpecs)
  const out = execFileSync('node', [S10_CLI, '--run-dir', runDir, '--date', DATE], { encoding: 'utf8', cwd: REPO_ROOT })
  assert.ok(out.includes('[成功]'), out)
  assert.ok(fs.existsSync(path.join(runDir, '5-specs/feature_index.json')))
  assert.ok(fs.existsSync(path.join(runDir, '5-specs/trace_index.json')))
  assert.ok(fs.existsSync(path.join(runDir, '5-specs/pending-list.md')))
  assert.ok(fs.existsSync(path.join(runDir, '5-specs/runtime/spec_check/verify-report.md')))
  const fi = readJson(path.join(runDir, '5-specs/feature_index.json'))
  assert.equal(fi.schemaVersion, 3)
  assert.deepEqual(fi.dependencyFiles.length, 12)
})

test('I2 端到端：S11 回写 difference-review 审批状态（approved 生效）', () => {
  const runDir = setupRun('run-e2e2', s11Specs, {
    decisions: [{ atomId: 'AT-ST-C01-001', action: 'approve', target: 'difference-review' }],
  })
  const out = execFileSync('node', [S11_CLI, '--run-dir', runDir, '--date', DATE], { encoding: 'utf8', cwd: REPO_ROOT })
  assert.ok(out.includes('[成功]'), out)
  const dr = readJson(path.join(runDir, '4-analysis/difference-review.json'))
  assert.equal(dr.entries.find((e) => e.atomId === 'AT-ST-C01-001').reviewStatus, 'approved', '审批状态必须回写 DR')
  assert.ok(fs.existsSync(path.join(runDir, '6-review/runtime/impact-set.json')))
})

fs.rmSync(TMP, { recursive: true, force: true })

console.log('spec-decisions.example：' + (process.exitCode ? '存在失败' : '全部通过'))
for (const line of results) console.log('  ' + line)
process.exit(process.exitCode || 0)
