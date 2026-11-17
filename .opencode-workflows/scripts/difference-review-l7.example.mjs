// difference-review-l7.example.mjs —— S8 复核合并 + S9 L7 分类（断言式）
//
// 执行文档 §5 S8/S9、§8 D10/D11/D17/D23、§15（S8~S9 详细）、Gold Set G02/G03/G04 的 L7 侧断言。
// 覆盖：
//   A. S8 复核合并：reviewRule 白名单 / conflict 必带 evidenceScopes / ref 存在性 /
//      blocked 不出复核条目 / previousDifference 漂移检测
//   B. S8 审批状态机（D11）：新条目 pending；建议一致保持；建议变化重置 pending；
//      rejected → effective = baselineDifference（历史基线，不是"没问题"）
//   C. S8 升级原子专项（D23）：candidateDifference 与 S7 一致、降级建议须引用双端证据
//   D. S9 scope 解析五级回落 + 禁止证据反推 client（G03 番数反例）
//   E. S9 client verified 六前置条件全 AND（D17）：partial / observedBehavior 空 / 证据 stale 均不 verified
//   F. S9 升级候选隔离（D23）：pending/rejected 期间 effective = 历史基线，候选不参与 L7
//   G. S9 矩阵全枚举 + blocked 原子不入正式条目（派生口径）
//   H. 端到端 CLI：S6→S7→S8→S9 全链（含 G03 场景断言）
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mergeDifferenceReview } from './merge-difference-review.mjs'
import { classifyL7Audit } from './classify-l7-audit.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const TMP = path.join(REPO_ROOT, '.opencode-workflows/scripts/tmp-dr-l7')
const DATE = '2099-01-01'
const S9_CLI = path.join(REPO_ROOT, '.opencode-workflows/scripts/classify-l7-audit.mjs')

const writeJson = (p, data) => {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(data, null, 1) + '\n', 'utf8')
}
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))

// ---- 构造 run：registry + 双端 + unified-atoms + business-behavior ----
// atoms 规格：[{ atomId, scope(verificationScope), analysisPath, baseline, candidate?, upgraded?, priorRun? }]
function setupRun(runId, atomSpecs, opt = {}) {
  const runDir = path.join(TMP, 'runs', runId)
  fs.rmSync(runDir, { recursive: true, force: true })
  const regAtoms = atomSpecs.map((a) => ({
    atomId: a.atomId, name: '', rule: 'r ' + a.atomId, uiRequirement: '',
    verificationScope: a.scope, businessBehavior: { trigger: '', condition: '', action: '', result: '' },
    source: { chapter: 'ch', fromLine: 1, toLine: 2 },
  }))
  writeJson(path.join(runDir, '1-registry/requirement-registry.json'), {
    schemaVersion: 1, date: DATE,
    stages: [{ stageId: 'ST-C01', name: 's', chapter: 'ch', summary: '', featureCount: 1, atomCount: regAtoms.length }],
    features: [{ id: 'FP-ST-C01-001', stageId: 'ST-C01', name: 'f', description: '', scope: '', coordination: '', atoms: regAtoms }],
    stats: { stageCount: 1, featureCount: 1, atomCount: regAtoms.length, perStage: [], scopeStats: { client: 0, server: 0, both: 0 } },
  })

  const cle = []
  const sve = []
  const clientEntries = []
  const scopeEntries = []
  const uaAtoms = []
  const bbEntries = []

  for (const a of atomSpecs) {
    const cEvId = 'CLE-' + a.atomId + '-01'
    const sEvId = 'SVE-' + a.atomId + '-01'
    if (a.hasClientEvidence !== false) {
      cle.push({ id: cEvId, atomIds: [a.atomId], claimKey: 'k', repoId: 'c', layer: 'client_code', file: 'f.ts', location: 'f.ts:1', symbol: '', excerpt: '', configKeys: [], stale: a.stale === true })
      clientEntries.push({
        atomId: a.atomId, verdict: a.verdict || 'confirmed', evidenceIds: [cEvId],
        directConflict: false, conflictEvidenceIds: [],
        observedBehavior: a.observedEmpty ? {} : { trigger: 't', condition: 'c', action: 'a', result: 'r' },
      })
    } else {
      clientEntries.push({ atomId: a.atomId, verdict: 'not_found', evidenceIds: [], directConflict: false, conflictEvidenceIds: [], observedBehavior: {} })
    }
    if (a.applicability) {
      sve.push({ id: sEvId, atomIds: [a.atomId], claimKey: 'k', repoId: 's', layer: 'common_game', file: 'r.cpp', location: 'r.cpp:1', symbol: '', excerpt: '', configKeys: [] })
      scopeEntries.push({
        atomId: a.atomId, applicability: a.applicability, configVerified: true, callPathVerified: true,
        configCondition: a.applicability === 'conditional' ? 'cfgKey=1' : '', callPath: 'f',
        evidenceIds: [sEvId], unresolved: a.applicability === 'unknown' ? '缺证据' : '',
        noServerEvidence: false, directConflict: false, conflictEvidenceIds: [],
      })
    }
    uaAtoms.push({
      atomId: a.atomId,
      requirement: { rule: 'r', uiRequirement: '', source: {}, verificationScope: a.scope, businessBehavior: {} },
      client: {
        verdict: a.verdict || (a.hasClientEvidence === false ? 'not_found' : 'confirmed'),
        evidenceIds: a.hasClientEvidence === false ? [] : [cEvId],
        observedBehavior: a.observedEmpty ? {} : { trigger: 't', condition: 'c', action: 'a', result: 'r' },
        directConflict: false, conflictEvidenceIds: [], pending: false,
      },
      server: {
        applicability: a.applicability || '',
        evidenceIds: a.applicability ? [sEvId] : [], configCondition: '',
        directConflict: false, conflictEvidenceIds: [], pending: a.serverPending === true,
      },
      analysisPath: a.analysisPath,
      previousRunId: a.priorRun || '',
      baselineDifference: '',
      upgraded: a.upgraded === true,
    })
    if (a.analysisPath !== 'blocked') {
      bbEntries.push({
        atomId: a.atomId, analysisPath: a.analysisPath, analysisRunId: 'ar-' + DATE + '-002',
        previousRunId: a.upgraded ? a.priorRun : '', previousBaselineDifference: a.upgraded ? 'conflict' : '',
        trigger: '', condition: '', clientAction: '', serverAction: '', collaboration: '', result: '',
        baselineDifference: a.baseline, baselineDetail: a.baseline === 'conflict' ? '矛盾说明' : '',
        candidateDifference: a.candidate || '', candidateDetail: a.candidate ? '候选依据' : '',
        evidenceIds: a.hasClientEvidence === false ? [] : [cEvId],
      })
    }
  }

  writeJson(path.join(runDir, '2-client/client-evidence.json'), {
    schemaVersion: 1, date: DATE, source: [{ repoId: 'c' }], entries: clientEntries, evidence: cle,
    coverage: { expectedAtomCount: atomSpecs.length, entryCount: clientEntries.length, pendingAtomIds: [] }, stats: {},
  })
  writeJson(path.join(runDir, '3-server/scope-index.json'), {
    schemaVersion: 1, entries: scopeEntries,
    coverage: { expectedAtomCount: atomSpecs.length, entryCount: scopeEntries.length, pendingAtomIds: [] }, stats: {},
  })
  writeJson(path.join(runDir, '3-server/server-evidence.json'), { schemaVersion: 1, evidence: sve, stats: {} })
  writeJson(path.join(runDir, '4-analysis/unified-atoms.json'), {
    schemaVersion: 1, date: DATE, analysisRunId: 'ar-' + DATE + '-002', atoms: uaAtoms,
    stats: { atomCount: uaAtoms.length },
  })
  writeJson(path.join(runDir, '4-analysis/business-behavior.json'), {
    schemaVersion: 1, analysisRunId: 'ar-' + DATE + '-002', entries: bbEntries, stats: {},
  })
  if (opt.dr) writeJson(path.join(runDir, '4-analysis/difference-review.json'), { schemaVersion: 2, analysisRunId: 'ar-' + DATE + '-002', entries: opt.dr })
  if (opt.reviewShards) {
    for (const [name, doc] of Object.entries(opt.reviewShards)) {
      writeJson(path.join(runDir, '3-server/runtime/review-output', name), doc)
    }
  }
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
// A：S8 校验
// ============================================================
test('A1 reviewRule 前缀白名单：非法前缀 → fail', () => {
  const runDir = setupRun('run-a1', [{ atomId: 'AT-ST-C01-001', scope: 'both', analysisPath: 'full', baseline: 'consistent' }], {
    reviewShards: { 'ST-C01-cp01.json': { entries: [{ atomId: 'AT-ST-C01-001', reviewedDifference: 'partial', reviewRule: 'made-up-rule', reviewReason: 'x' }] } },
  })
  const r = mergeDifferenceReview({ runDir, date: DATE })
  assert.equal(r.ok, false)
  assert.ok(r.problems.some((p) => p.includes('reviewRule 前缀不在白名单')), JSON.stringify(r.problems))
})

test('A2 reviewedDifference=conflict 必带 evidenceScopes', () => {
  const runDir = setupRun('run-a2', [{ atomId: 'AT-ST-C01-001', scope: 'both', analysisPath: 'full', baseline: 'consistent' }], {
    reviewShards: { 'ST-C01-cp01.json': { entries: [{ atomId: 'AT-ST-C01-001', reviewedDifference: 'conflict', reviewRule: 'ui-conflict-stands-alone', reviewReason: 'x' }] } },
  })
  const r = mergeDifferenceReview({ runDir, date: DATE })
  assert.equal(r.ok, false)
  assert.ok(r.problems.some((p) => p.includes('必带 evidenceScopes')))
})

test('A3 evidenceScopes.ref 不存在 → fail', () => {
  const runDir = setupRun('run-a3', [{ atomId: 'AT-ST-C01-001', scope: 'both', analysisPath: 'full', baseline: 'consistent' }], {
    reviewShards: { 'ST-C01-cp01.json': { entries: [{ atomId: 'AT-ST-C01-001', reviewedDifference: 'conflict', reviewRule: 'ui-conflict-stands-alone', reviewReason: 'x', evidenceScopes: [{ ref: 'CLE-GHOST-99' }] }] } },
  })
  const r = mergeDifferenceReview({ runDir, date: DATE })
  assert.equal(r.ok, false)
  assert.ok(r.problems.some((p) => p.includes('evidenceScopes.ref 不存在')))
})

test('A4 blocked 原子不得出复核条目', () => {
  const runDir = setupRun('run-a4', [{ atomId: 'AT-ST-C01-001', scope: 'both', analysisPath: 'blocked', baseline: '' }], {
    reviewShards: { 'ST-C01-cp01.json': { entries: [{ atomId: 'AT-ST-C01-001', reviewedDifference: 'consistent', reviewRule: 'evidence-is-not-consistency', reviewReason: 'x' }] } },
  })
  const r = mergeDifferenceReview({ runDir, date: DATE })
  assert.equal(r.ok, false)
  assert.ok(r.problems.some((p) => p.includes('blocked 原子不得出复核条目')))
})

test('A5 previousDifference 漂移（≠ S7 基线）→ fail', () => {
  const runDir = setupRun('run-a5', [{ atomId: 'AT-ST-C01-001', scope: 'both', analysisPath: 'full', baseline: 'consistent' }], {
    reviewShards: { 'ST-C01-cp01.json': { entries: [{ atomId: 'AT-ST-C01-001', reviewedDifference: 'partial', reviewRule: 'evidence-is-not-consistency', reviewReason: 'x', previousDifference: 'conflict' }] } },
  })
  const r = mergeDifferenceReview({ runDir, date: DATE })
  assert.equal(r.ok, false)
  assert.ok(r.problems.some((p) => p.includes('previousDifference 漂移')))
})

// ============================================================
// B：审批状态机（D11）
// ============================================================
test('B1 新条目一律 pending；rejected → effective = baselineDifference（历史基线）', () => {
  const runDir = setupRun('run-b1', [{ atomId: 'AT-ST-C01-001', scope: 'both', analysisPath: 'full', baseline: 'conflict', applicability: 'active' }], {
    reviewShards: { 'ST-C01-cp01.json': { entries: [{ atomId: 'AT-ST-C01-001', reviewedDifference: 'consistent', reviewRule: 'evidence-is-not-consistency', reviewReason: '仅客户端证据，服务端 active 且行为一致' }] } },
  })
  const r8 = mergeDifferenceReview({ runDir, date: DATE })
  assert.equal(r8.ok, true, JSON.stringify(r8.problems))
  assert.equal(r8.differenceReview.entries[0].reviewStatus, 'pending', '新条目必须 pending')
  assert.equal(r8.differenceReview.entries[0].previousDifference, 'conflict')

  // 写盘后把条目改为 rejected，再跑 S9：effective 必须回退基线 conflict → decision_required
  writeJson(path.join(runDir, '4-analysis/difference-review.json'), {
    schemaVersion: 2, analysisRunId: 'ar-' + DATE + '-002',
    entries: [{ ...r8.differenceReview.entries[0], reviewStatus: 'rejected' }],
  })
  const r9 = classifyL7Audit({ runDir, date: DATE })
  assert.equal(r9.ok, true, JSON.stringify(r9.problems))
  const e = r9.l7.entries.find((x) => x.atomId === 'AT-ST-C01-001')
  assert.equal(e.effectiveDifference, 'conflict', 'rejected ≠ 需求没问题，effective 必须回退历史基线')
  assert.equal(e.l7Basis, 'rejected')
  assert.equal(e.l7, 'decision_required')
})

test('B2 建议变化 → 重置 pending；建议一致 → 保持既有 approved', () => {
  const base = { atomId: 'AT-ST-C01-001', scope: 'both', analysisPath: 'full', baseline: 'conflict', applicability: 'active' }
  const prevDr = [{
    atomId: 'AT-ST-C01-001', previousDifference: 'conflict', candidateDifference: '', clientVerdict: 'confirmed',
    serverApplicability: 'active', reviewedDifference: 'consistent', reviewReason: '理由', reviewRule: 'evidence-is-not-consistency',
    reviewStatus: 'approved', evidenceScopes: [],
  }]
  // 同建议 → 保持 approved
  const runDir1 = setupRun('run-b2a', [base], {
    dr: prevDr,
    reviewShards: { 'ST-C01-cp01.json': { entries: [{ atomId: 'AT-ST-C01-001', reviewedDifference: 'consistent', reviewRule: 'evidence-is-not-consistency', reviewReason: '理由' }] } },
  })
  const r1 = mergeDifferenceReview({ runDir: runDir1, date: DATE })
  assert.equal(r1.ok, true, JSON.stringify(r1.problems))
  assert.equal(r1.differenceReview.entries[0].reviewStatus, 'approved', '建议一致应保持 approved')

  // 建议变化 → 重置 pending
  const runDir2 = setupRun('run-b2b', [base], {
    dr: prevDr,
    reviewShards: { 'ST-C01-cp01.json': { entries: [{ atomId: 'AT-ST-C01-001', reviewedDifference: 'partial', reviewRule: 'evidence-is-not-consistency', reviewReason: '理由' }] } },
  })
  const r2 = mergeDifferenceReview({ runDir: runDir2, date: DATE })
  assert.equal(r2.differenceReview.entries[0].reviewStatus, 'pending', '建议变化必须重置 pending')
})

// ============================================================
// C：升级原子专项（D23）
// ============================================================
test('C1 升级原子降级建议必须引用双端证据（reviewReason 无依据 → fail）', () => {
  const runDir = setupRun('run-c1', [{
    atomId: 'AT-ST-C01-001', scope: 'both', analysisPath: 'full', baseline: 'conflict',
    candidate: 'consistent', upgraded: true, priorRun: 'ar-' + DATE + '-001', applicability: 'active',
  }], {
    reviewShards: { 'ST-C01-cp01.json': { entries: [{ atomId: 'AT-ST-C01-001', reviewedDifference: 'consistent', reviewRule: 'conflict-not-sustained', reviewReason: '无依据' }] } },
  })
  const r = mergeDifferenceReview({ runDir, date: DATE })
  assert.equal(r.ok, false)
  assert.ok(r.problems.some((p) => p.includes('未引用双端证据')), JSON.stringify(r.problems))
})

test('C2 升级原子 candidateDifference 与 S7 不一致 → fail', () => {
  const runDir = setupRun('run-c2', [{
    atomId: 'AT-ST-C01-001', scope: 'both', analysisPath: 'full', baseline: 'conflict',
    candidate: 'consistent', upgraded: true, priorRun: 'ar-' + DATE + '-001', applicability: 'active',
  }], {
    reviewShards: { 'ST-C01-cp01.json': { entries: [{ atomId: 'AT-ST-C01-001', reviewedDifference: 'consistent', reviewRule: 'conflict-not-sustained', reviewReason: 'CLE/SVE 双端证据显示一致', candidateDifference: 'partial' }] } },
  })
  const r = mergeDifferenceReview({ runDir, date: DATE })
  assert.equal(r.ok, false)
  assert.ok(r.problems.some((p) => p.includes('candidateDifference 与 S7 不一致')))
})

// ============================================================
// D：scope 解析 + G03 番数反例
// ============================================================
test('D1 G03 番数反例：server unknown + client confirmed（scope=both）→ scope=unknown + verification_required（绝不 verified）', () => {
  const runDir = setupRun('run-g03', [{
    atomId: 'AT-ST-C01-001', scope: 'both', analysisPath: 'full', baseline: 'consistent', applicability: 'unknown',
  }])
  const r = classifyL7Audit({ runDir, date: DATE })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  const e = r.l7.entries.find((x) => x.atomId === 'AT-ST-C01-001')
  assert.equal(e.scope, 'unknown', '禁止 server unknown + CLE 存在 → client')
  assert.equal(e.scopeSource, 'scope-index')
  assert.equal(e.l7, 'verification_required', 'consistent × unknown = verification_required（不是 verified）')
})

test('D2 缺省 scope 一律 unknown（禁止缺省 inactive）', () => {
  const runDir = setupRun('run-d2', [{ atomId: 'AT-ST-C01-001', scope: 'both', analysisPath: 'full', baseline: 'consistent' }])
  const r = classifyL7Audit({ runDir, date: DATE })
  const e = r.l7.entries[0]
  assert.equal(e.scope, 'unknown')
  assert.equal(e.scopeSource, 'default-unknown')
  assert.equal(e.l7, 'verification_required')
})

test('D3 verificationScope=client + 客户端已定位 → scope=client（合法来源可回溯 Registry）', () => {
  const runDir = setupRun('run-d3', [{ atomId: 'AT-ST-C01-001', scope: 'client', analysisPath: 'full', baseline: 'consistent' }])
  const r = classifyL7Audit({ runDir, date: DATE })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  const e = r.l7.entries[0]
  assert.equal(e.scope, 'client')
  assert.equal(e.scopeSource, 'registry-verification-scope')
  assert.equal(e.l7, 'verified', '满足六前置条件 → verified')
})

// ============================================================
// E：client verified 六前置条件（D17）
// ============================================================
test('E1 verdict=partial → 不 verified（找到代码 ≠ 实现正确）', () => {
  const runDir = setupRun('run-e1', [{ atomId: 'AT-ST-C01-001', scope: 'client', analysisPath: 'full', baseline: 'consistent', verdict: 'partial' }])
  const r = classifyL7Audit({ runDir, date: DATE })
  const e = r.l7.entries[0]
  assert.equal(e.l7, 'verification_required', 'partial 不得进 verified')
})

test('E2 observedBehavior 全空 → 不 verified（必要业务行为无证据支撑）', () => {
  const runDir = setupRun('run-e2', [{ atomId: 'AT-ST-C01-001', scope: 'client', analysisPath: 'full', baseline: 'consistent', observedEmpty: true }])
  const r = classifyL7Audit({ runDir, date: DATE })
  assert.equal(r.l7.entries[0].l7, 'verification_required')
})

test('E3 证据 stale → 不 verified', () => {
  const runDir = setupRun('run-e3', [{ atomId: 'AT-ST-C01-001', scope: 'client', analysisPath: 'full', baseline: 'consistent', stale: true }])
  const r = classifyL7Audit({ runDir, date: DATE })
  assert.equal(r.l7.entries[0].l7, 'verification_required', 'stale 证据不得作为当前实现证明')
})

test('E4 未复核原子 baseline=consistent → l7=verified 但 l7Basis=proposed 且不入 l7Approved', () => {
  const runDir = setupRun('run-e4', [{ atomId: 'AT-ST-C01-001', scope: 'client', analysisPath: 'full', baseline: 'consistent' }])
  const r = classifyL7Audit({ runDir, date: DATE })
  const e = r.l7.entries[0]
  assert.equal(e.l7Basis, 'proposed')
  assert.equal(e.l7, 'verified')
  assert.equal(r.l7.stats.l7Approved.verified, 0, 'proposed 不进 l7Approved 统计')
})

// ============================================================
// F：升级候选隔离（D23）
// ============================================================
test('F1 升级原子 pending：effective = 历史基线 conflict（候选 consistent 不参与）→ decision_required', () => {
  const runDir = setupRun('run-f1', [{
    atomId: 'AT-ST-C01-001', scope: 'both', analysisPath: 'full', baseline: 'conflict',
    candidate: 'consistent', upgraded: true, priorRun: 'ar-' + DATE + '-001', applicability: 'active',
  }], {
    dr: [{
      atomId: 'AT-ST-C01-001', previousDifference: 'conflict', candidateDifference: 'consistent',
      clientVerdict: 'confirmed', serverApplicability: 'active', reviewedDifference: 'consistent',
      reviewReason: '双端证据 CLE/SVE 显示一致', reviewRule: 'conflict-not-sustained',
      reviewStatus: 'pending', evidenceScopes: [],
    }],
  })
  const r = classifyL7Audit({ runDir, date: DATE })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  const e = r.l7.entries[0]
  assert.equal(e.effectiveDifference, 'conflict', 'pending 期间候选不生效')
  assert.equal(e.l7, 'decision_required')
  assert.equal(e.l7Basis, 'proposed')
})

test('F2 升级原子 approved 后降级生效（conflict → consistent）', () => {
  const runDir = setupRun('run-f2', [{
    atomId: 'AT-ST-C01-001', scope: 'both', analysisPath: 'full', baseline: 'conflict',
    candidate: 'consistent', upgraded: true, priorRun: 'ar-' + DATE + '-001', applicability: 'active',
  }], {
    dr: [{
      atomId: 'AT-ST-C01-001', previousDifference: 'conflict', candidateDifference: 'consistent',
      clientVerdict: 'confirmed', serverApplicability: 'active', reviewedDifference: 'consistent',
      reviewReason: '双端证据 CLE/SVE 显示一致', reviewRule: 'conflict-not-sustained',
      reviewStatus: 'approved', evidenceScopes: [],
    }],
  })
  const r = classifyL7Audit({ runDir, date: DATE })
  const e = r.l7.entries[0]
  assert.equal(e.effectiveDifference, 'consistent', 'approved 后降级生效')
  assert.equal(e.l7, 'verified', 'consistent × active = verified')
  assert.equal(e.l7Basis, 'approved')
  assert.equal(r.l7.stats.l7Approved.verified, 1)
})

// ============================================================
// G：矩阵 + blocked
// ============================================================
test('G1 矩阵：conflict×inactive = not_applicable；partial×active = verification_required', () => {
  const runDir = setupRun('run-g1', [
    { atomId: 'AT-ST-C01-001', scope: 'both', analysisPath: 'full', baseline: 'conflict', applicability: 'inactive' },
    { atomId: 'AT-ST-C01-002', scope: 'both', analysisPath: 'full', baseline: 'partial', applicability: 'active' },
  ])
  const r = classifyL7Audit({ runDir, date: DATE })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  const m1 = r.l7.entries.find((e) => e.atomId === 'AT-ST-C01-001')
  const m2 = r.l7.entries.find((e) => e.atomId === 'AT-ST-C01-002')
  assert.equal(m1.l7, 'not_applicable')
  assert.equal(m2.l7, 'verification_required')
})

test('G2 blocked 原子不入正式条目 + blockedAtoms 派生清单（S10 填 verification_required/pending-blocked）', () => {
  const runDir = setupRun('run-g2', [
    { atomId: 'AT-ST-C01-001', scope: 'both', analysisPath: 'blocked', baseline: '', serverPending: true, hasClientEvidence: false },
    { atomId: 'AT-ST-C01-002', scope: 'both', analysisPath: 'full', baseline: 'consistent', applicability: 'active' },
  ])
  const r = classifyL7Audit({ runDir, date: DATE })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  assert.equal(r.l7.entries.length, 1, 'blocked 不入正式条目')
  assert.deepEqual(r.l7.blockedAtoms, ['AT-ST-C01-001'])
  assert.equal(r.summary.blockedCount, 1)
})

// ============================================================
// H：端到端 CLI
// ============================================================
test('H1 端到端 CLI：S9 落盘 l7-classify.json（含 stats/baseline/blockedAtoms）', () => {
  const runDir = setupRun('run-h1', [
    { atomId: 'AT-ST-C01-001', scope: 'client', analysisPath: 'full', baseline: 'consistent' },
    { atomId: 'AT-ST-C01-002', scope: 'both', analysisPath: 'full', baseline: 'conflict', applicability: 'active' },
    { atomId: 'AT-ST-C01-003', scope: 'both', analysisPath: 'blocked', baseline: '', serverPending: true },
  ])
  const out = execFileSync('node', [S9_CLI, '--run-dir', runDir, '--date', DATE], { encoding: 'utf8', cwd: REPO_ROOT })
  assert.ok(out.includes('[成功]'), out)
  const l7 = readJson(path.join(runDir, '4-analysis/l7-classify.json'))
  assert.equal(l7.entries.length, 2)
  assert.deepEqual(l7.blockedAtoms, ['AT-ST-C01-003'])
  assert.equal(l7.stats.atomCount, 2)
  assert.equal(l7.baseline.differenceStats.conflict, 1)
  assert.equal(l7.baseline.effectiveDifferenceStats.conflict, 1)
})

fs.rmSync(TMP, { recursive: true, force: true })

console.log('difference-review-l7.example：' + (process.exitCode ? '存在失败' : '全部通过'))
for (const line of results) console.log('  ' + line)
process.exit(process.exitCode || 0)
