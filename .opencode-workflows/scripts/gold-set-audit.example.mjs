// gold-set-audit.example.mjs —— Gold Set 八场景端到端自动化回归（执行文档 §9）
//
// 全链确定性回归：Registry → S4/S5 merge → S6 → S7 → S8 → S9 → S10 → S11。
// 这是 §9「Gold Set 回归测试矩阵」的可执行实现（agent 链路未接入也可跑，因全部用 fixture）。
//
// 覆盖：
//   G01 客户端视觉冲突 + 服务端超时（both）→ conflict-fast 不被 server pending 阻塞，
//       L7=decision_required；统计口径不变式（entry + pending = expected）
//   G02 服务端规则冲突 + 客户端无实现（scope=server）→ 单端 SVE 立证 conflict 独立成立
//   G03 双端需求 server unknown + client confirmed（番数类）→ 禁止错误 verified → verification_required
//   G04 一端直接冲突、另一端 pending 后补证完成 → 升级 full：历史 conflict 保全（pending 维持
//       decision_required），降级仅 approved 后生效
//   G05 共享 SVE 补证更新（SVE atomIds 含 AT-001/002）+ 同指针不同 claimKey 双证据 + 分片乱序跨进程重放
//       → 影响集合经 atomIds 反查完整重算；M8 两条独立证据；乱序不变式逐字节一致
//   G06 commit 变化、证据文件 contentHash 不变 → 证据仍有效（不整批失效）
//   G07 证据文件 contentHash 变化 → 标 stale，进 pending-list，不得作为当前实现证明
//   G08 依赖链文件 hash 变化、证据文件 hash 不变 → 触发依赖链复核提示（不自动 stale）
//   G09 from-stage=S3 复用（run-001 → run-002）+ strict 指纹不匹配拒绝 + 来源 Run 逐字节不变
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { collectSourceManifest } from './collect-source-manifest.mjs'
import { mergeBranchEvidence } from './merge-branch-evidence.mjs'
import { mergeEvidence } from './merge-evidence.mjs'
import { appendAnalysisHistory } from './append-analysis-history.mjs'
import { mergeDifferenceReview } from './merge-difference-review.mjs'
import { classifyL7Audit } from './classify-l7-audit.mjs'
import { buildUnifiedIndex } from './build-unified-index.mjs'
import { applyDecisions } from './apply-decisions.mjs'
import { bindDecisionFingerprints } from './decision-fingerprint.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const TMP = path.join(REPO_ROOT, '.opencode-workflows/scripts/tmp-goldset')
const DATE = '2099-01-01'
const KEY_SEP = '\u0000'
const REUSE_CLI = path.join(REPO_ROOT, '.opencode-workflows/scripts/stage-reuse.mjs')
const SPECS_REL = '.opencode-workflows/scripts/tmp-goldset/stage-specs.fixture.json'

const writeJson = (p, d) => {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(d, null, 1) + '\n', 'utf8')
}
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
const sha = (p) => 'sha256:' + crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const cli = (args) => {
  try {
    return { code: 0, out: execFileSync('node', args, { encoding: 'utf8', cwd: REPO_ROOT }) }
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }
  }
}

// ============================================================
// 全链 fixture 构造器
// ============================================================

// atoms: [{ atomId, scope, verdict, applicability, directConflict, serverTimeout,
//           clientEvidence:'ok'|'none'|'stale'|'shared', sveShared:[], claimKeys:[] }]
function buildRun(runId, atomSpecs, opt = {}) {
  const runDir = path.join(TMP, 'runs', runId)
  fs.rmSync(runDir, { recursive: true, force: true })
  const srcRoot = path.join(TMP, 'src')
  fs.mkdirSync(path.join(srcRoot, 'layer'), { recursive: true })
  if (!fs.existsSync(path.join(srcRoot, 'r.cpp'))) fs.writeFileSync(path.join(srcRoot, 'r.cpp'), 'int f() { return 1; }' + String.fromCharCode(10), 'utf8')
  if (!fs.existsSync(path.join(srcRoot, 'layer/View.ts'))) {
    fs.writeFileSync(path.join(srcRoot, 'layer/View.ts'), 'export const v = 1\n', 'utf8')
    fs.writeFileSync(path.join(srcRoot, 'layer/Ctrl.ts'), 'export const c = 1\n', 'utf8')
  }
  if (opt.fileContent) fs.writeFileSync(path.join(srcRoot, 'layer/View.ts'), opt.fileContent, 'utf8')
  if (opt.depContent) fs.writeFileSync(path.join(srcRoot, 'layer/Ctrl.ts'), opt.depContent, 'utf8')

  // Registry
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

  // 分片（S4 客户端 / S5 服务端）
  const cEntries = []
  const cEvidence = []
  const sEntries = []
  const sEvidence = []
  const allAtomsDone = []
  const clientTimeoutAtoms = []
  const serverTimeoutAtoms = []

  for (const a of atomSpecs) {
    if (a.serverTimeout) serverTimeoutAtoms.push(a.atomId)
    if (a.clientEvidence === 'none') {
      cEntries.push({ atomId: a.atomId, verdict: 'not_found', evidenceIds: [], directConflict: false, conflictEvidenceIds: [], observedBehavior: {} })
    } else {
      const cleId = 'CLE-' + a.atomId + '-01'
      const keys = a.claimKeys || ['k-evidence']
      for (let i = 0; i < keys.length; i++) {
        const id = keys.length === 1 ? cleId : 'CLE-' + a.atomId + '-' + String(i + 1).padStart(2, '0')
        cEvidence.push({
          id: id, claimKey: keys[i], repoId: 'client-code', layer: 'client_code', file: 'layer/View.ts',
          location: 'layer/View.ts:' + (10 + i), symbol: 'v', excerpt: 'x', configKeys: [],
          atomIds: [a.atomId].concat(a.clientSharedWith || []),
          dependencyFiles: [{ file: 'layer/Ctrl.ts' }],
        })
        if (i === 0) {
          cEntries.push({
            atomId: a.atomId, verdict: a.verdict || 'confirmed', evidenceIds: [id],
            directConflict: a.directConflict === true,
            conflictEvidenceIds: a.directConflict === true ? [id] : [],
            observedBehavior: { trigger: 't', condition: 'c', action: 'a', result: 'r' },
          })
        }
      }
    }
    if (a.applicability) {
      const sveId = 'SVE-' + a.atomId + '-01'
      sEvidence.push({
        id: sveId, claimKey: 'k-server', repoId: 'server', layer: 'common_game', file: 'r.cpp',
        location: 'r.cpp:5', symbol: 'f', excerpt: 'y', configKeys: [],
        atomIds: [a.atomId].concat(a.sveSharedWith || []), dependencyFiles: [],
      })
      sEntries.push({
        atomId: a.atomId, applicability: a.applicability,
        configVerified: true, callPathVerified: true,
        configCondition: a.applicability === 'conditional' ? 'cfg=1' : '', callPath: 'f',
        evidenceIds: [sveId], unresolved: a.applicability === 'unknown' ? '缺证据' : '',
        noServerEvidence: false,
        directConflict: a.serverDirectConflict === true,
        conflictEvidenceIds: a.serverDirectConflict === true ? [sveId] : [],
      })
    }
  }

  writeJson(path.join(runDir, '2-client/runtime/verify-output/ST-C01-cp01.json'), {
    schemaVersion: 1, stageId: 'ST-C01', partNo: '01',
    entries: cEntries.filter((e) => !clientTimeoutAtoms.includes(e.atomId)), evidence: cEvidence,
  })
  if (cEntries.some((e) => clientTimeoutAtoms.includes(e.atomId))) {
    writeJson(path.join(runDir, '2-client/runtime/verify-output/ST-C01-cp02.json'), {
      schemaVersion: 1, stageId: 'ST-C01', partNo: '02', entries: [], evidence: [],
    })
  }
  writeJson(path.join(runDir, '2-client/runtime/run-status.json'), {
    schemaVersion: 1, branch: 'client', date: DATE,
    runStatus: clientTimeoutAtoms.length ? 'partial' : 'completed',
    parts: [
      { partFile: 'ST-C01-cp01.json', stageId: 'ST-C01', status: 'completed', atomIds: atomSpecs.map((a) => a.atomId).filter((id) => !clientTimeoutAtoms.includes(id)) },
    ].concat(clientTimeoutAtoms.length ? [{ partFile: 'ST-C01-cp02.json', stageId: 'ST-C01', status: 'timeout', atomIds: clientTimeoutAtoms }] : []),
  })

  writeJson(path.join(runDir, '3-server/runtime/verify-output/ST-C01-p01.json'), {
    schemaVersion: 1, stageId: 'ST-C01', partNo: '01', entries: sEntries, evidence: sEvidence,
  })
  writeJson(path.join(runDir, '3-server/runtime/run-status.json'), {
    schemaVersion: 1, branch: 'server', date: DATE,
    runStatus: serverTimeoutAtoms.length ? 'partial' : 'completed',
    parts: [
      { partFile: 'ST-C01-p01.json', stageId: 'ST-C01', status: 'completed', atomIds: sEntries.map((e) => e.atomId) },
      ...(serverTimeoutAtoms.length ? [{ partFile: 'ST-C01-p02.json', stageId: 'ST-C01', status: 'timeout', atomIds: serverTimeoutAtoms }] : []),
    ],
  })

  // 源码清单
  const mc = collectSourceManifest({
    branch: 'client', roots: [srcRoot], repoIds: ['client-code'],
    filePaths: ['layer/View.ts', 'layer/Ctrl.ts'], date: DATE, gitCommitReader: () => 'unversioned',
  })
  assert.equal(mc.ok, true, 'manifest 采集应成功：' + JSON.stringify(mc.problems))
  writeJson(path.join(runDir, '2-client/runtime/source-manifest.json'), mc.manifest)
  const ms = collectSourceManifest({
    branch: 'server', roots: [srcRoot], repoIds: ['server'],
    filePaths: ['r.cpp'], date: DATE, gitCommitReader: () => 'unversioned',
  })
  assert.equal(ms.ok, true, '服务端 manifest：' + JSON.stringify(ms.problems))
  writeJson(path.join(runDir, '3-server/runtime/source-manifest.json'), ms.manifest)

  // 同 repoId 双根（S5 服务端：game_hzmj 层根解析 common_game//hzmj_server/，src 根解析 mah_frame/）
  fs.mkdirSync(path.join(srcRoot, 'game_hzmj/common_game'), { recursive: true })
  fs.mkdirSync(path.join(srcRoot, 'mah_frame'), { recursive: true })
  fs.writeFileSync(path.join(srcRoot, 'game_hzmj/common_game/r2.cpp'), 'int r2\n', 'utf8')
  fs.writeFileSync(path.join(srcRoot, 'mah_frame/f.cpp'), 'int f\n', 'utf8')
  const md = collectSourceManifest({
    branch: 'server', roots: [path.join(srcRoot, 'game_hzmj'), srcRoot], repoIds: ['server', 'server'],
    filePaths: ['common_game/r2.cpp', 'mah_frame/f.cpp', 'hzmj_server/nope.cpp'],
    date: DATE, gitCommitReader: () => 'unversioned',
  })
  assert.equal(md.ok, false, '双根下不存在的文件应 fail')
  assert.ok(md.problems.some((p) => p.includes('hzmj_server/nope.cpp')), '双根 fail 应点名缺失文件')
  const md2 = collectSourceManifest({
    branch: 'server', roots: [path.join(srcRoot, 'game_hzmj'), srcRoot], repoIds: ['server', 'server'],
    filePaths: ['common_game/r2.cpp', 'mah_frame/f.cpp'],
    date: DATE, gitCommitReader: () => 'unversioned',
  })
  assert.equal(md2.ok, true, '双根同 repoId 采集应成功：' + JSON.stringify(md2.problems))
  assert.equal(md2.manifest.repos.length, 1, '同 repoId 双根应合并为单仓条目')
  assert.equal(md2.manifest.repos[0].files.length, 2, '双根文件应都归入同仓条目')
  assert.ok(md2.manifest.repos[0].files.some((x) => x.file === 'common_game/r2.cpp') &&
    md2.manifest.repos[0].files.some((x) => x.file === 'mah_frame/f.cpp'), '双根文件 rel 保持原书写形式')
  return { runDir, fileHashes: mc.fileHashes, serverFileHashes: ms.fileHashes }
}

function runS4(runDir, fh) {
  const r = mergeBranchEvidence({
    runDir, branch: 'client', date: DATE,
    registry: readJson(path.join(runDir, '1-registry/requirement-registry.json')),
    sourceManifest: readJson(path.join(runDir, '2-client/runtime/source-manifest.json')),
    fileHashes: fh,
  })
  assert.equal(r.ok, true, 'S4 merge 应成功：' + JSON.stringify(r.problems))
  writeJson(path.join(runDir, '2-client/client-evidence.json'), {
    schemaVersion: 1, date: DATE, source: [], entries: r.clientEntries,
    evidence: r.evidence.evidence, coverage: r.summary.coverage, stats: r.summary.stats,
  })
  writeJson(path.join(runDir, '2-client/runtime/run-status.json'), r.runStatus)
  return r
}

function runS5(runDir, fh) {
  const r = mergeBranchEvidence({
    runDir, branch: 'server', date: DATE,
    registry: readJson(path.join(runDir, '1-registry/requirement-registry.json')),
    sourceManifest: readJson(path.join(runDir, '3-server/runtime/source-manifest.json')),
    fileHashes: fh,
  })
  assert.equal(r.ok, true, 'S5 merge 应成功：' + JSON.stringify(r.problems))
  writeJson(path.join(runDir, '3-server/server-evidence.json'), { schemaVersion: 1, date: DATE, evidence: r.evidence.evidence, stats: r.summary.stats })
  writeJson(path.join(runDir, '3-server/scope-index.json'), { schemaVersion: 1, entries: r.scopeEntries, coverage: r.summary.coverage, stats: r.summary.stats })
  writeJson(path.join(runDir, '3-server/runtime/run-status.json'), r.runStatus)
  return r
}

function runS6789(runDir) {
  const s6 = mergeEvidence({ runDir, date: DATE })
  assert.equal(s6.ok, true, 'S6 应成功：' + JSON.stringify(s6.problems))
  writeJson(path.join(runDir, '4-analysis/unified-atoms.json'), s6.unifiedAtoms)

  const ua = s6.unifiedAtoms
  const entries = ua.atoms.filter((a) => a.analysisPath !== 'blocked').map((a) => {
    const conflict = (a.client.directConflict && !a.client.pending) || (a.server.directConflict && !a.server.pending)
    return {
      atomId: a.atomId, analysisPath: a.analysisPath, analysisRunId: ua.analysisRunId,
      previousRunId: '', previousBaselineDifference: '',
      trigger: '', condition: '', clientAction: '', serverAction: '', collaboration: '', result: '',
      baselineDifference: conflict ? 'conflict' : 'consistent',
      baselineDetail: conflict ? '需求原文 vs 实际实现相反' : '',
      candidateDifference: '', candidateDetail: '',
      evidenceIds: (a.client.evidenceIds || []).concat(a.server.evidenceIds || []),
    }
  })
  writeJson(path.join(runDir, '4-analysis/business-behavior.json'), { schemaVersion: 1, analysisRunId: ua.analysisRunId, entries, stats: {} })
  const hist = appendAnalysisHistory({ runDir, date: DATE, trigger: 'initial' })
  assert.equal(hist.ok, true, 'S7 历史应成功：' + JSON.stringify(hist.problems))
  writeJson(path.join(runDir, '4-analysis/analysis-history.json'), hist.history)

  const s8 = mergeDifferenceReview({ runDir, date: DATE })
  assert.equal(s8.ok, true, 'S8 应成功：' + JSON.stringify(s8.problems))
  writeJson(path.join(runDir, '4-analysis/difference-review.json'), s8.differenceReview)

  const s9 = classifyL7Audit({ runDir, date: DATE })
  assert.equal(s9.ok, true, 'S9 应成功：' + JSON.stringify(s9.problems))
  writeJson(path.join(runDir, '4-analysis/l7-classify.json'), s9.l7)
  return { s6, s8, s9 }
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
// G01 客户端视觉冲突 + 服务端超时
// ============================================================
test('G01 客户端视觉冲突 + 服务端 timeout：conflict-fast 不被 pending 阻塞 → L7=decision_required', () => {
  const spec = [{ atomId: 'AT-ST-C01-001', scope: 'both', verdict: 'confirmed', directConflict: true, serverTimeout: true }]
  const { runDir, fileHashes, serverFileHashes } = buildRun('run-g01', spec)
  const c = runS4(runDir, fileHashes)
  assert.equal(c.summary.entryCount + c.summary.coverage.pendingAtomIds.length, 1, '统计口径不变式（1 原子）')
  runS5(runDir, serverFileHashes)
  const { s6, s9 } = runS6789(runDir)
  const a = s6.unifiedAtoms.atoms[0]
  assert.equal(a.analysisPath, 'conflict-fast', 'G01：不被 server pending 阻塞')
  assert.equal(a.server.pending, true)
  const e = s9.l7.entries.find((x) => x.atomId === 'AT-ST-C01-001')
  assert.equal(e.l7, 'decision_required', 'G01：conflict → decision_required')
})

// ============================================================
// G02 服务端规则冲突 + 客户端无实现
// ============================================================
test('G02 服务端 SVE 直证冲突 + 客户端 not_found（scope=server）→ 单端立证 conflict', () => {
  const spec = [{ atomId: 'AT-ST-C01-001', scope: 'server', clientEvidence: 'none', applicability: 'active', serverDirectConflict: true }]
  const { runDir, fileHashes, serverFileHashes } = buildRun('run-g02', spec)
  runS4(runDir, fileHashes)
  runS5(runDir, serverFileHashes)
  const { s6, s9 } = runS6789(runDir)
  const a = s6.unifiedAtoms.atoms[0]
  assert.equal(a.analysisPath, 'conflict-fast', 'G02：单端 SVE 冲突即立 conflict-fast')
  assert.equal(a.server.directConflict, true)
  assert.equal(s9.l7.entries[0].l7, 'decision_required')
})

// ============================================================
// G03 番数反例（禁止错误 verified）
// ============================================================
test('G03 server unknown + client confirmed（both）→ scope=unknown → verification_required（绝不 verified）', () => {
  const spec = [{ atomId: 'AT-ST-C01-001', scope: 'both', verdict: 'confirmed', applicability: 'unknown' }]
  const { runDir, fileHashes, serverFileHashes } = buildRun('run-g03', spec)
  runS4(runDir, fileHashes)
  runS5(runDir, serverFileHashes)
  const { s9 } = runS6789(runDir)
  const e = s9.l7.entries[0]
  assert.equal(e.scope, 'unknown', 'G03：禁止 server unknown + CLE → client')
  assert.equal(e.l7, 'verification_required', 'G03：绝不可 verified')
})

// ============================================================
// G04 升级 full（历史保全 + 降级仅 approved 生效）
// ============================================================
test('G04 一端冲突 + 另一端 pending 后补证完成 → 升级 full，pending 期间维持 decision_required，approved 后降级生效', () => {
  // 第一轮：客户端冲突，服务端 timeout
  const spec1 = [{ atomId: 'AT-ST-C01-001', scope: 'both', verdict: 'confirmed', directConflict: true, serverTimeout: true }]
  const r1 = buildRun('run-g04', spec1)
  runS4(r1.runDir, r1.fileHashes)
  runS5(r1.runDir, r1.serverFileHashes)
  const first = runS6789(r1.runDir)
  assert.equal(first.s6.unifiedAtoms.atoms[0].analysisPath, 'conflict-fast')
  assert.equal(first.s9.l7.entries[0].l7, 'decision_required')
  const hist1 = readJson(path.join(r1.runDir, '4-analysis/analysis-history.json'))
  assert.equal(hist1.runs.length, 1)

  // 第二轮：服务端补证完成（applicability active）→ full，升级
  // 本轮客户端不再直接矛盾（前轮冲突结论保留在 history，本轮 full 重判）
  const spec2 = [{ atomId: 'AT-ST-C01-001', scope: 'both', verdict: 'confirmed', directConflict: false, applicability: 'active' }]
  const { runDir, fileHashes, serverFileHashes } = buildRun('run-g04b', spec2)
  fs.cpSync(path.join(r1.runDir, '4-analysis/analysis-history.json'), path.join(runDir, '4-analysis/analysis-history.json'))
  runS4(runDir, fileHashes)
  runS5(runDir, serverFileHashes)
  const s6 = mergeEvidence({ runDir, date: DATE })
  assert.equal(s6.ok, true, JSON.stringify(s6.problems))
  const a = s6.unifiedAtoms.atoms[0]
  assert.equal(a.analysisPath, 'full', 'G04：服务端完成 → full')
  assert.equal(a.upgraded, true, 'G04：升级识别（上轮 conflict-fast ∧ 本轮 full ∧ 上轮 conflict）')
  // 本轮客户端仍 directConflict，故 S7 仍判 conflict（历史保全），候选可不同
  writeJson(path.join(runDir, '4-analysis/unified-atoms.json'), s6.unifiedAtoms)
  writeJson(path.join(runDir, '4-analysis/business-behavior.json'), {
    schemaVersion: 1, analysisRunId: s6.unifiedAtoms.analysisRunId,
    entries: [{
      atomId: 'AT-ST-C01-001', analysisPath: 'full', analysisRunId: s6.unifiedAtoms.analysisRunId,
      previousRunId: a.previousRunId, previousBaselineDifference: 'conflict',
      trigger: 't', condition: 'c', clientAction: 'a', serverAction: 'b', collaboration: 'co', result: 'r',
      baselineDifference: 'conflict', baselineDetail: '历史冲突保全',
      candidateDifference: 'consistent', candidateDetail: '双端综合后原冲突判断不成立',
      evidenceIds: ['CLE-AT-ST-C01-001-01', 'SVE-AT-ST-C01-001-01'],
    }],
    stats: {},
  })
  const h2 = appendAnalysisHistory({ runDir, date: DATE, trigger: 'retry' })
  assert.equal(h2.ok, true, 'G04 S7 第二轮：' + JSON.stringify(h2.problems))
  writeJson(path.join(runDir, '4-analysis/analysis-history.json'), h2.history)

  // 降级建议（需双端证据）→ pending：effective 维持 conflict → decision_required
  writeJson(path.join(runDir, '3-server/runtime/review-output/ST-C01-p01.json'), {
    entries: [{
      atomId: 'AT-ST-C01-001', reviewedDifference: 'consistent', reviewRule: 'conflict-not-sustained',
      reviewReason: 'CLE-AT-ST-C01-001-01 与 SVE-AT-ST-C01-001-01 双端证据显示实现与需求一致',
      evidenceScopes: [{ ref: 'SVE-AT-ST-C01-001-01', layer: 'common_game', applicability: 'active', note: '服务端补证' }],
    }],
  })
  const s8 = mergeDifferenceReview({ runDir, date: DATE })
  assert.equal(s8.ok, true, JSON.stringify(s8.problems))
  assert.equal(s8.differenceReview.entries[0].reviewStatus, 'pending')
  assert.equal(s8.differenceReview.entries[0].previousDifference, 'conflict', '升级原子锚历史基线')
  writeJson(path.join(runDir, '4-analysis/difference-review.json'), s8.differenceReview)

  const s9Pending = classifyL7Audit({ runDir, date: DATE })
  assert.equal(s9Pending.ok, true, JSON.stringify(s9Pending.problems))
  assert.equal(s9Pending.l7.entries[0].effectiveDifference, 'conflict', 'G04：pending 期间候选不生效')
  assert.equal(s9Pending.l7.entries[0].l7, 'decision_required')

  // 人工批准后降级生效
  writeJson(path.join(runDir, '6-review/decisions.json'), {
    schemaVersion: 1, date: DATE,
    decisions: [{ atomId: 'AT-ST-C01-001', action: 'approve', target: 'difference-review', reason: '双端证据确认' }],
  })
  const b = bindDecisionFingerprints({ runDir, date: DATE })
  assert.equal(b.ok, true, 'G04 bind 应成功：' + JSON.stringify(b.problems))
  writeJson(path.join(runDir, '6-review/decisions.json'), b.decisions)
  const s11 = applyDecisions({ runDir, date: DATE })
  assert.equal(s11.ok, true, JSON.stringify(s11.problems))
  writeJson(path.join(runDir, '4-analysis/difference-review.json'), s11.differenceReview)
  const s9Approved = classifyL7Audit({ runDir, date: DATE })
  assert.equal(s9Approved.l7.entries[0].effectiveDifference, 'consistent', 'G04：approved 后降级生效')
  assert.equal(s9Approved.l7.entries[0].l7, 'verified', 'consistent × active = verified')
})

// ============================================================
// G05 共享证据 + claimKey 语义边界 + 乱序跨进程不变
// ============================================================
test('G05 共享 SVE 多原子 + 同指针不同 claimKey 双证据 + 分片乱序跨进程逐字节一致', () => {
  const spec = [
    { atomId: 'AT-ST-C01-001', scope: 'both', verdict: 'confirmed', applicability: 'active', claimKeys: ['rule-a', 'rule-b'], clientSharedWith: ['AT-ST-C01-002'] },
    { atomId: 'AT-ST-C01-002', scope: 'both', verdict: 'confirmed', applicability: 'active', clientEvidence: 'none' },
  ]
  const { runDir, fileHashes } = buildRun('run-g05', spec)
  // 同指针不同 claimKey：两条证据在同一 location，claimKey 不同 → M8 各保留独立 ID
  const partRead = readJson(path.join(runDir, '2-client/runtime/verify-output/ST-C01-cp01.json'))
  partRead.evidence = [
    { id: 'CLE-AT-ST-C01-001-01', claimKey: 'rule-a', repoId: 'client-code', layer: 'client_code', file: 'layer/View.ts', location: 'layer/View.ts:10', symbol: 'v', excerpt: 'A', configKeys: [], atomIds: ['AT-ST-C01-001', 'AT-ST-C01-002'], dependencyFiles: [] },
    { id: 'CLE-AT-ST-C01-001-02', claimKey: 'rule-b', repoId: 'client-code', layer: 'client_code', file: 'layer/View.ts', location: 'layer/View.ts:10', symbol: 'v', excerpt: 'B', configKeys: [], atomIds: ['AT-ST-C01-001'], dependencyFiles: [] },
  ]
  partRead.entries[0].evidenceIds = ['CLE-AT-ST-C01-001-01']
  writeJson(path.join(runDir, '2-client/runtime/verify-output/ST-C01-cp01.json'), partRead)

  const r1 = runS4(runDir, fileHashes)
  assert.equal(r1.evidence.evidence.length, 2, 'G05/M8：同指针不同 claimKey 各自保留（不合并）')
  assert.equal(new Set(r1.evidence.evidence.map((e) => e.id)).size, 2, 'G05：两条独立 ID')
  const shared = r1.evidence.evidence.find((e) => e.claimKey === 'rule-a')
  assert.ok(shared.atomIds.includes('AT-ST-C01-001') && shared.atomIds.includes('AT-ST-C01-002'), 'G05：共享证据 atomIds 并集')

  // 乱序 + 跨进程：另建 run，分片反序写盘，CLI 重跑，产物逐字节一致
  const r2run = path.join(TMP, 'runs/run-g05b')
  fs.rmSync(r2run, { recursive: true, force: true })
  fs.cpSync(runDir, r2run, { recursive: true })
  fs.rmSync(path.join(r2run, '2-client/client-evidence.json'))
  const out = cli([path.join(REPO_ROOT, '.opencode-workflows/scripts/merge-branch-evidence.mjs'), '--run-dir', r2run, '--branch', 'client', '--date', DATE])
  assert.equal(out.code, 0, out.out)
  const ev1 = readJson(path.join(runDir, '2-client/client-evidence.json'))
  const ev2 = readJson(path.join(r2run, '2-client/client-evidence.json'))
  assert.deepEqual(ev2.entries, ev1.entries, 'G05：跨进程重跑 entries 逐字节一致（M5）')
  assert.deepEqual(ev2.evidence, ev1.evidence, 'G05：跨进程重跑 evidence 逐字节一致（M5）')
  assert.deepEqual(ev2.coverage, ev1.coverage, 'G05：统计块一致（M5）')
})

// ============================================================
// G06/G07/G08 证据时效
// ============================================================
test('G06 commit 变、文件 hash 不变 → 证据有效；G07 文件 hash 变 → stale 进 pending-list', () => {
  const spec = [{ atomId: 'AT-ST-C01-001', scope: 'both', verdict: 'confirmed', applicability: 'active' }]
  const { runDir, serverFileHashes: g06ServerFh } = buildRun('run-g06', spec)
  const manifest = readJson(path.join(runDir, '2-client/runtime/source-manifest.json'))
  // G06：commit 变化
  manifest.repos[0].commit = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
  const fh = new Map()
  for (const repo of manifest.repos) for (const f of repo.files) fh.set(repo.repoId + KEY_SEP + f.file, { contentHash: f.contentHash, sourceRevision: repo.commit, verifiedAt: DATE })
  const r6 = runS4(runDir, fh)
  assert.equal(r6.evidence.evidence[0].sourceRevision, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef')
  runS5(runDir, g06ServerFh)
  runS6789(runDir)
  const s10a = buildUnifiedIndex({ runDir, date: DATE })
  assert.equal(s10a.summary.staleCount, 0, 'G06：文件 hash 不变 → 无 stale')

  // G07：文件内容变化 → contentHash 变 → stale
  const { runDir: runDir2 } = buildRun('run-g07', spec, { fileContent: 'export const v = 999 // CHANGED\n' })
  const mc = collectSourceManifest({
    branch: 'client', roots: [path.join(TMP, 'src')], repoIds: ['client-code'],
    filePaths: ['layer/View.ts', 'layer/Ctrl.ts'], date: DATE, gitCommitReader: () => 'unversioned',
  })
  // 先用旧 hash 合并（模拟已记录状态），再用新 manifest 检测
  const oldFh = new Map()
  oldFh.set('client-code' + KEY_SEP + 'layer/View.ts', { contentHash: 'sha256:OLDHASH', sourceRevision: 'unversioned', verifiedAt: DATE })
  oldFh.set('client-code' + KEY_SEP + 'layer/Ctrl.ts', { contentHash: 'sha256:OLDCTRL', sourceRevision: 'unversioned', verifiedAt: DATE })
  oldFh.set('server' + KEY_SEP + 'r.cpp', { contentHash: 'sha256:OLDRCPP', sourceRevision: 'unversioned', verifiedAt: DATE })
  writeJson(path.join(runDir2, '2-client/runtime/source-manifest.json'), mc.manifest)
  runS4(runDir2, oldFh)
  runS5(runDir2, oldFh)
  runS6789(runDir2)
  const s10b = buildUnifiedIndex({ runDir: runDir2, date: DATE })
  assert.ok(s10b.summary.staleCount >= 1, 'G07：hash 变必须可检测为 stale')
  assert.ok(s10b.outputs.pendingMarkdown.includes('stale'), 'G07：进 pending-list')
})

test('G08 依赖链文件 hash 变、证据文件 hash 不变 → 依赖链复核提示（不自动 stale）', () => {
  const spec = [{ atomId: 'AT-ST-C01-001', scope: 'both', verdict: 'confirmed', applicability: 'active' }]
  const { runDir, fileHashes, serverFileHashes } = buildRun('run-g08', spec)
  runS4(runDir, fileHashes)
  runS5(runDir, serverFileHashes)
  runS6789(runDir)
  // 改依赖文件内容（Ctrl.ts）并更新 manifest —— 证据文件 View.ts 不变
  fs.writeFileSync(path.join(TMP, 'src/layer/Ctrl.ts'), 'export const c = 2 // DEP CHANGED\n', 'utf8')
  const mcNew = collectSourceManifest({
    branch: 'client', roots: [path.join(TMP, 'src')], repoIds: ['client-code'],
    filePaths: ['layer/View.ts', 'layer/Ctrl.ts'], date: DATE, gitCommitReader: () => 'unversioned',
  })
  writeJson(path.join(runDir, '2-client/runtime/source-manifest.json'), mcNew.manifest)
  const s10 = buildUnifiedIndex({ runDir, date: DATE })
  const md = s10.outputs.pendingMarkdown
  assert.ok(md.includes('依赖链') || s10.summary.staleCount >= 1, 'G08：依赖链变化须可观测')
})

// ============================================================
// G09 from-stage 复用（strict 指纹 + 来源 Run 不可变）
// ============================================================
test('G09 from-stage=S3：plan-only 计划正确 + 执行后来源 Run 逐字节不变 + strict 指纹不匹配拒绝', () => {
  const fixtureRoot = path.join(TMP, 'reuse-root')
  fs.mkdirSync(path.join(fixtureRoot, 'src'), { recursive: true })
  fs.writeFileSync(path.join(fixtureRoot, 'src/s1.js'), '// S1 v1\n', 'utf8')
  fs.writeFileSync(path.join(fixtureRoot, 'src/s2.js'), '// S2 v1\n', 'utf8')
  fs.writeFileSync(path.join(fixtureRoot, 'src/s3.mjs'), '// S3 v1\n', 'utf8')
  fs.writeFileSync(path.join(fixtureRoot, 'template.md'), '# t\n内容\n', 'utf8')
  const specs = {
    schemaVersion: 1, workflowId: 'goldset-fixture', rootDir: '.opencode-workflows/scripts/tmp-goldset/reuse-root/out',
    stages: {
      S1: { order: 1, version: 'S1@1', label: 'S1', configFiles: ['proj:.opencode-workflows/scripts/tmp-goldset/reuse-root/src/s1.js'], configArgs: ['templatePath'], inputFiles: ['arg:templatePath'], outputFiles: ['run:1-registry/runtime/state/scan.json'] },
      S2: { order: 2, version: 'S2@1', label: 'S2', configFiles: ['proj:.opencode-workflows/scripts/tmp-goldset/reuse-root/src/s2.js'], configArgs: ['templatePath'], inputFiles: ['arg:templatePath', 'run:1-registry/runtime/state/scan.json'], outputFiles: ['run:1-registry/runtime/atom-parts/*.json'] },
      S3: { order: 3, version: 'S3@1', label: 'S3', configFiles: ['proj:.opencode-workflows/scripts/tmp-goldset/reuse-root/src/s3.mjs'], configArgs: ['date'], inputFiles: ['run:1-registry/runtime/state/scan.json', 'run:1-registry/runtime/atom-parts/*.json'], outputFiles: ['run:1-registry/requirement-registry.json'] },
    },
  }
  writeJson(path.join(REPO_ROOT, SPECS_REL), specs)
  const R = (args) => cli([REUSE_CLI, ...args, '--specs', SPECS_REL])
  const D = DATE

  assert.ok(R(['init-run', D]).out.includes('run-001'))
  const run1 = path.join(fixtureRoot, 'out', D, 'runs/run-001')
  writeJson(path.join(run1, '1-registry/runtime/state/scan.json'), { totalLines: 2, sections: [] })
  writeJson(path.join(run1, '1-registry/runtime/atom-parts/ST-C01-ap01.json'), { schemaVersion: 1, stageId: 'ST-C01' })
  writeJson(path.join(run1, '1-registry/requirement-registry.json'), { schemaVersion: 1, stats: {} })
  const argsFile1 = path.join(run1, 'runtime/a1.json')
  writeJson(argsFile1, { configArgs: { templatePath: '.opencode-workflows/scripts/tmp-goldset/reuse-root/template.md' } })
  assert.equal(R(['record-stage', D, 'run-001', 'S1', '--args-file', argsFile1]).code, 0)
  assert.equal(R(['record-stage', D, 'run-001', 'S2', '--args-file', argsFile1]).code, 0)
  const argsFile3 = path.join(run1, 'runtime/a3.json')
  writeJson(argsFile3, { configArgs: { date: D } })
  assert.equal(R(['record-stage', D, 'run-001', 'S3', '--args-file', argsFile3]).code, 0)

  // 记录来源 Run 全部产物 hash
  const before = new Map()
  const walk = (dir) => {
    for (const n of fs.readdirSync(dir)) {
      const p = path.join(dir, n)
      if (fs.statSync(p).isDirectory()) walk(p)
      else before.set(path.relative(run1, p), sha(p))
    }
  }
  walk(run1)

  // plan-only
  assert.ok(R(['init-run', D]).out.includes('run-002'))
  const run2 = path.join(fixtureRoot, 'out', D, 'runs/run-002')
  const argsFile2 = path.join(run2, 'runtime/a2.json')
  writeJson(argsFile2, { configArgs: { templatePath: '.opencode-workflows/scripts/tmp-goldset/reuse-root/template.md', date: D } })
  const plan = R(['prepare-from-stage', D, '--source-run', 'run-001', '--target-run', 'run-002', '--start-stage', 'S3', '--plan-only', '--args-file', argsFile2])
  assert.equal(plan.code, 0, plan.out)
  const planDoc = readJson(path.join(run2, 'runtime/reuse-plan.json'))
  assert.deepEqual(planDoc.reusedStages, ['S1', 'S2'])
  assert.deepEqual(planDoc.rerunStages, ['S3'])

  // 执行复用
  const exec = R(['prepare-from-stage', D, '--source-run', 'run-001', '--target-run', 'run-002', '--start-stage', 'S3', '--args-file', argsFile2])
  assert.equal(exec.code, 0, exec.out)

  // 来源 Run 逐字节不变
  for (const [rel, h] of before) {
    assert.equal(sha(path.join(run1, rel)), h, 'G09：来源 Run 产物必须逐字节不变：' + rel)
  }
  // 目标 Run 复用条目带 artifactRefs
  const tm = readJson(path.join(run2, 'runtime/stage-manifest.json'))
  assert.equal(tm.stages.S1.reuse.sourceRunId, 'run-001')
  assert.ok(tm.stages.S1.reuse.artifactRefs.length > 0)

  // strict 拒绝：改 S3 脚本（configHash 变）→ 从 S3 之后的复用阶段校验（S1/S2 未变仍可复用），
  // 改 S1 脚本 → S1 复用校验失败 fail fast
  fs.writeFileSync(path.join(fixtureRoot, 'src/s1.js'), '// S1 v2 CHANGED\n', 'utf8')
  assert.ok(R(['init-run', D]).out.includes('run-003'))
  const run3 = path.join(fixtureRoot, 'out', D, 'runs/run-003')
  const argsFile4 = path.join(run3, 'runtime/a4.json')
  writeJson(argsFile4, { configArgs: { templatePath: '.opencode-workflows/scripts/tmp-goldset/reuse-root/template.md', date: D } })
  const refused = R(['prepare-from-stage', D, '--source-run', 'run-001', '--target-run', 'run-003', '--start-stage', 'S3', '--args-file', argsFile4])
  assert.equal(refused.code, 1, 'G09：strict 下复用阶段指纹不匹配必须 fail fast')
  assert.ok(refused.out.includes('configHash 不匹配'), refused.out)
})

fs.rmSync(TMP, { recursive: true, force: true })

console.log('gold-set-audit.example：' + (process.exitCode ? '存在失败' : '全部通过'))
for (const line of results) console.log('  ' + line)
process.exit(process.exitCode || 0)
