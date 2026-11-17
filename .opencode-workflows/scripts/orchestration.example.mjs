// orchestration.example.mjs —— 编排一致性 + S10 闸门脚本自检（断言式）
//
// 评审 P0-1 整改验收：主编排 S1~S11 与 stage-specs、子流程文件、脚本依赖的一致性。
// 覆盖：
//   A. STEPS 与 stage-specs 完全一致（order / label / 数量）
//   B. 每个 STEPS 的子流程文件存在；specs 的 configFiles 全部存在
//   C. S10 闸门脚本可用：check-spec-coverage（AT-ID 覆盖 / 串阶段 / 乱码 / blocked 标注）
//   D. S10 策划投影 + 泄漏扫描：business-view 无技术字段；策划版泄漏能被抓出
//   E. build-stage-manifest：双端分布列 + L7 分布 + 汇总合计自洽
//   F. assemble-behavior-parts：S7 分片汇总闸门（缺原子 / blocked 混入 / 升级锚点）
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkSpecCoverage } from './check-spec-coverage.mjs'
import { preparePlannerInput } from './prepare-planner-input.mjs'
import { checkPlannerLeak } from './check-planner-leak.mjs'
import { buildStageManifest } from './build-stage-manifest.mjs'
import { assembleBehaviorParts } from './assemble-behavior-parts.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const TMP = path.join(REPO_ROOT, '.opencode-workflows/scripts/tmp-orch')
const DATE = '2099-01-01'
const WF_DIR = path.join(REPO_ROOT, '.opencode-workflows/workflows/game-requirement-audit')
const SPECS = path.join(REPO_ROOT, '.opencode-workflows/scripts/stage-specs.game-requirement-audit.json')

const writeJson = (p, d) => {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(d, null, 1) + '\n', 'utf8')
}
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))

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
// A/B：编排一致性
// ============================================================
const specs = readJson(SPECS)
const mainSrc = fs.readFileSync(path.join(WF_DIR, 'game-requirement-audit.js'), 'utf8')
const stepsBlock = mainSrc.slice(mainSrc.indexOf('const STEPS = ['), mainSrc.indexOf(']', mainSrc.indexOf('const STEPS = [')))
const steps = [...stepsBlock.matchAll(/stageId: '(S\d+)', label: '([^']+)', script: DIR \+ '([^']+)'/g)].map((m) => ({
  stageId: m[1],
  label: m[2],
  script: m[3],
}))

test('A1 STEPS 覆盖 S1~S11（评审 P0-1）', () => {
  assert.deepEqual(steps.map((s) => s.stageId), ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11'])
})

test('A2 STEPS 与 stage-specs 的 order/label 完全一致（D38 双写校验）', () => {
  const specOrder = Object.keys(specs.stages).sort((a, b) => specs.stages[a].order - specs.stages[b].order)
  assert.deepEqual(steps.map((s) => s.stageId), specOrder)
  for (const s of steps) {
    assert.equal(specs.stages[s.stageId].label, s.label, 'label 不一致：' + s.stageId)
  }
})

test('B1 全部子流程文件存在', () => {
  for (const s of steps) {
    const p = path.join(WF_DIR, s.script)
    assert.ok(fs.existsSync(p), '子流程缺失：' + s.stageId + ' -> ' + s.script)
  }
})

test('B2 specs 的 configFiles 全部存在（指纹可采集）', () => {
  for (const [stageId, st] of Object.entries(specs.stages)) {
    for (const cf of st.configFiles || []) {
      assert.ok(cf.startsWith('proj:'), 'configFiles 必须为 proj: 前缀：' + stageId + ' ' + cf)
      const rel = cf.slice('proj:'.length)
      assert.ok(fs.existsSync(path.join(REPO_ROOT, rel)), '配置/脚本不存在：' + stageId + ' ' + rel)
    }
  }
})

test('B3 S10 的 12 项文件级依赖完整（D34）', () => {
  const expect = [
    'run:1-registry/requirement-registry.json',
    'run:2-client/client-evidence.json',
    'run:2-client/runtime/run-status.json',
    'run:2-client/runtime/source-manifest.json',
    'run:3-server/scope-index.json',
    'run:3-server/server-evidence.json',
    'run:3-server/runtime/run-status.json',
    'run:3-server/runtime/source-manifest.json',
    'run:4-analysis/unified-atoms.json',
    'run:4-analysis/business-behavior.json',
    'run:4-analysis/difference-review.json',
    'run:4-analysis/l7-classify.json',
  ]
  assert.deepEqual(specs.stages.S10.inputFiles, expect, 'S10 inputFiles 必须逐一对照生成逻辑（D34）')
})

test('B4 specs 声明的 agent 阶段与 docs 一致（S4/S5/S7/S8/S10 为 agent 阶段）', () => {
  const agentStages = Object.entries(specs.stages).filter(([, v]) => v.agentStage === true).map(([k]) => k)
  assert.deepEqual(agentStages.sort(), ['S10', 'S2', 'S4', 'S5', 'S7', 'S8', 'S1'].filter((x) => agentStages.includes(x)).sort())
  for (const s of ['S1', 'S2', 'S4', 'S5', 'S7', 'S8', 'S10']) assert.ok(agentStages.includes(s), '应标记为 agent 阶段：' + s)
  for (const s of ['S3', 'S6', 'S9', 'S11']) assert.ok(!agentStages.includes(s), '不应标记为 agent 阶段：' + s)
})

// ============================================================
// C：S10 AT-ID 覆盖闸门
// ============================================================
function setupSpecRun(runId, opt = {}) {
  const runDir = path.join(TMP, 'runs', runId)
  fs.rmSync(runDir, { recursive: true, force: true })
  writeJson(path.join(runDir, '5-specs/feature_index.json'), {
    schemaVersion: 3,
    analysisRunId: 'ar-' + DATE + '-001',
    features: [
      {
        id: 'FP-ST-C01-001', stageId: 'ST-C01', name: 'f1', atoms: [
          { id: 'AT-ST-C01-001', l7: 'verified', verificationScope: 'both', difference: 'consistent',
            clientVerification: { verdict: 'confirmed' }, serverVerification: { applicability: 'active' }, analysisPath: 'full' },
          { id: 'AT-ST-C01-002', l7: 'verification_required', verificationScope: 'both', difference: '',
            clientVerification: { verdict: 'not_found' }, serverVerification: { applicability: 'unknown' }, analysisPath: 'blocked' },
        ],
      },
      {
        id: 'FP-ST-C02-001', stageId: 'ST-C02', name: 'f2', atoms: [
          { id: 'AT-ST-C02-001', l7: 'decision_required', verificationScope: 'server', difference: 'conflict',
            clientVerification: { verdict: 'not_found' }, serverVerification: { applicability: 'active' }, analysisPath: 'full' },
        ],
      },
    ],
  })
  writeJson(path.join(runDir, '4-analysis/l7-classify.json'), {
    schemaVersion: 1, analysisRunId: 'ar-' + DATE + '-001',
    entries: [
      { atomId: 'AT-ST-C01-001', l7: 'verified', effectiveDifference: 'consistent', l7Basis: 'approved' },
      { atomId: 'AT-ST-C02-001', l7: 'decision_required', effectiveDifference: 'conflict', l7Basis: 'proposed' },
    ],
    blockedAtoms: ['AT-ST-C01-002'],
    stats: {},
  })
  const doc1 = opt.doc1 !== undefined ? opt.doc1 :
    '# ST-C01\n\n### AT-ST-C01-001 规则一\n验证范围 both\n\n### AT-ST-C01-002 规则二\n**查证未完成**（服务端 pending），差异未判定\n'
  const doc2 = opt.doc2 !== undefined ? opt.doc2 :
    '# ST-C02\n\n### AT-ST-C02-001 规则三\n实际冲突\n'
  fs.mkdirSync(path.join(runDir, '5-specs/stages'), { recursive: true })
  if (doc1 !== null) fs.writeFileSync(path.join(runDir, '5-specs/stages/spec_stage_ST-C01.md'), doc1, 'utf8')
  if (doc2 !== null) fs.writeFileSync(path.join(runDir, '5-specs/stages/spec_stage_ST-C02.md'), doc2, 'utf8')
  return runDir
}

test('C1 AT-ID 全覆盖 + blocked 标注 → 通过', () => {
  const runDir = setupSpecRun('run-c1')
  const r = checkSpecCoverage({ runDir })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  assert.equal(r.summary.stageCount, 2)
  assert.equal(r.summary.blockedCount, 1)
})

test('C2 文档缺原子 ID → fail', () => {
  const runDir = setupSpecRun('run-c2', { doc1: '# ST-C01\n\n### AT-ST-C01-001 只写一个\n查证未完成\n' })
  const r = checkSpecCoverage({ runDir })
  assert.equal(r.ok, false)
  assert.ok(r.problems.some((p) => p.includes('文档缺原子 ID')), JSON.stringify(r.problems))
})

test('C3 串阶段原子 → fail；乱码/分片标记 → fail', () => {
  const runDir = setupSpecRun('run-c3', {
    doc1: '# ST-C01\nAT-ST-C01-001 AT-ST-C01-002 AT-ST-C02-001\n查证未完成\n<<<<<<< HEAD\n',
  })
  const r = checkSpecCoverage({ runDir })
  assert.equal(r.ok, false)
  assert.ok(r.problems.some((p) => p.includes('混入其他阶段原子')))
  assert.ok(r.problems.some((p) => p.includes('分片标记或乱码')))
})

test('C4 blocked 原子缺「查证未完成」标注 → fail', () => {
  const runDir = setupSpecRun('run-c4', { doc1: '# ST-C01\nAT-ST-C01-001 AT-ST-C01-002\n都很好\n' })
  const r = checkSpecCoverage({ runDir })
  assert.equal(r.ok, false)
  assert.ok(r.problems.some((p) => p.includes('缺少「查证未完成」标注')), JSON.stringify(r.problems))
})

// ============================================================
// D：策划投影 + 泄漏扫描
// ============================================================
function setupPlannerRun(runId) {
  const runDir = path.join(TMP, 'runs', runId)
  fs.rmSync(runDir, { recursive: true, force: true })
  writeJson(path.join(runDir, '1-registry/requirement-registry.json'), {
    schemaVersion: 1,
    stages: [{ stageId: 'ST-C01', name: '定庄' }],
    features: [{
      id: 'FP-ST-C01-001', stageId: 'ST-C01', name: 'f', description: '', scope: '', coordination: '',
      atoms: [
        { atomId: 'AT-ST-C01-001', name: '首局坐庄', rule: '首局随机指定一名玩家为庄家。', uiRequirement: '庄家标识',
          verificationScope: 'both', businessBehavior: { trigger: '开局', condition: '首局', action: '', result: '一人成为庄家' },
          source: { chapter: 'c', fromLine: 1, toLine: 2 } },
        { atomId: 'AT-ST-C01-002', name: '流局连庄', rule: '流局时庄家连庄。', uiRequirement: '',
          verificationScope: 'server', businessBehavior: { trigger: '流局', condition: '', action: '', result: '庄家不变' },
          source: { chapter: 'c', fromLine: 3, toLine: 4 } },
      ],
    }],
    stats: {},
  })
  writeJson(path.join(runDir, '4-analysis/unified-atoms.json'), {
    schemaVersion: 1, analysisRunId: 'ar-' + DATE + '-001',
    atoms: [
      { atomId: 'AT-ST-C01-001', analysisPath: 'full', client: { verdict: 'confirmed', evidenceIds: ['CLE-AT-ST-C01-001-01'] },
        server: { applicability: 'active', evidenceIds: ['SVE-AT-ST-C01-001-01'] } },
      { atomId: 'AT-ST-C01-002', analysisPath: 'blocked', client: { verdict: 'not_found', evidenceIds: [], pending: true },
        server: { applicability: 'unknown', evidenceIds: [], pending: true } },
    ],
  })
  writeJson(path.join(runDir, '4-analysis/business-behavior.json'), {
    schemaVersion: 1, analysisRunId: 'ar-' + DATE + '-001',
    entries: [{
      atomId: 'AT-ST-C01-001', analysisPath: 'full', baselineDifference: 'consistent', baselineDetail: '',
      trigger: '开局', condition: '首局', clientAction: '客户端展示庄家标识', serverAction: '服务端随机指定庄家',
      collaboration: '服务端定庄后下发，客户端展示', result: '一名玩家显示为庄家', evidenceIds: [],
    }],
  })
  writeJson(path.join(runDir, '4-analysis/l7-classify.json'), {
    schemaVersion: 1, analysisRunId: 'ar-' + DATE + '-001',
    entries: [{ atomId: 'AT-ST-C01-001', scope: 'active', l7: 'verified', effectiveDifference: 'consistent', l7Basis: 'approved' }],
    blockedAtoms: ['AT-ST-C01-002'], stats: {},
  })
  return runDir
}

test('D1 策划投影：剥离技术字段（无 verdict/applicability/evidenceIds/analysisPath）', () => {
  const runDir = setupPlannerRun('run-d1')
  const r = preparePlannerInput({ runDir, date: DATE })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  const text = JSON.stringify(r.outputs)
  for (const banned of ['"verdict"', '"applicability"', '"evidenceIds"', '"analysisPath"', 'CLE-', 'SVE-', '"claimKey"']) {
    assert.ok(!text.includes(banned), '策划投影泄漏技术字段：' + banned)
  }
  assert.equal(r.outputs.stats.ruleCount, 2)
  assert.equal(r.outputs.stats.blocked, 1)
  // blocked 用业务语言
  const blockedRule = r.outputs.stages[0].rules.find((x) => x.atomId === 'AT-ST-C01-002')
  assert.equal(blockedRule.conclusion, '查证未完成')
})

test('D2 策划版干净文档 → 通过；含技术字段 → fail', () => {
  const runDir = setupPlannerRun('run-d2')
  preparePlannerInput({ runDir, date: DATE })

  const clean = path.join(runDir, '5-specs/策划版.md')
  fs.mkdirSync(path.dirname(clean), { recursive: true })
  fs.writeFileSync(clean, '# 杭州麻将好友房 — 规则说明（策划版）\n\n## 首局坐庄\n- 规则说明：首局随机指定一名玩家为庄家。\n- 实际表现：与规则一致\n- 结论：已验证\n', 'utf8')
  const ok = checkPlannerLeak({ runDir, plannerPath: clean })
  assert.equal(ok.ok, true, '干净文档不应报泄漏：' + JSON.stringify(ok.problems))

  const leaky = path.join(runDir, '5-specs/策划版-泄漏.md')
  fs.writeFileSync(leaky, '# 策划版\n\n客户端 GameMahView.ts:123 里 applyPlayLmtsGray 处理，evidence CLE-AT-ST-C01-001-01，verdict=confirmed，conflict-fast。\n', 'utf8')
  const bad = checkPlannerLeak({ runDir, plannerPath: leaky })
  assert.equal(bad.ok, false, '含技术字段必须报泄漏')
  assert.ok(bad.problems.length >= 3, '应多类命中：' + JSON.stringify(bad.problems))
})

// ============================================================
// E：阶段速查表
// ============================================================
test('E1 build-stage-manifest：双端分布 + L7 分布 + 合计自洽', () => {
  const runDir = setupSpecRun('run-e1')
  const r = buildStageManifest({ runDir, date: DATE })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  const md = r.markdown
  assert.ok(md.includes('验证范围（c/s/both）'))
  assert.ok(md.includes('双端定位（客户端/服务端/双端）'))
  assert.ok(md.includes('查证未完成'))
  assert.ok(md.includes('| **合计** |'))
  assert.equal(r.summary.atomCount, 3)
  assert.equal(r.summary.blocked, 1)
  assert.equal(r.summary.l7.verified, 1)
  assert.equal(r.summary.l7.decision_required, 1)
})

// ============================================================
// F：S7 分片汇总闸门
// ============================================================
function setupBehaviorRun(runId, entries, opt = {}) {
  const runDir = path.join(TMP, 'runs', runId)
  fs.rmSync(runDir, { recursive: true, force: true })
  writeJson(path.join(runDir, '4-analysis/unified-atoms.json'), {
    schemaVersion: 1, analysisRunId: 'ar-' + DATE + '-001',
    atoms: (opt.atoms || [
      { atomId: 'AT-ST-C01-001', analysisPath: 'full', upgraded: false, previousRunId: '' },
      { atomId: 'AT-ST-C01-002', analysisPath: 'blocked', upgraded: false, previousRunId: '' },
    ]),
  })
  writeJson(path.join(runDir, '4-analysis/runtime/behavior-output/ST-C01-bp01.json'), {
    schemaVersion: 1, analysisRunId: 'ar-' + DATE + '-001', entries,
  })
  return runDir
}

const okEntry = (atomId, extra) => Object.assign({
  atomId: atomId, analysisPath: 'full', analysisRunId: 'ar-' + DATE + '-001',
  previousRunId: '', previousBaselineDifference: '',
  trigger: 't', condition: 'c', clientAction: 'ca', serverAction: 'sa', collaboration: 'co', result: 'r',
  baselineDifference: 'consistent', baselineDetail: '', candidateDifference: '', candidateDetail: '', evidenceIds: [],
}, extra || {})

test('F1 正常汇总：只对 conflict-fast/full 原子，blocked 不要求条目', () => {
  const runDir = setupBehaviorRun('run-f1', [okEntry('AT-ST-C01-001')])
  const r = assembleBehaviorParts({ runDir, date: DATE, parts: 'ST-C01-bp01.json' })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  assert.equal(r.summary.stats.atomCount, 1)
})

test('F2 缺原子条目 → fail；blocked 原子混入条目 → fail', () => {
  const runDir = setupBehaviorRun('run-f2', [okEntry('AT-ST-C01-002', { analysisPath: 'blocked' })])
  const r = assembleBehaviorParts({ runDir, date: DATE, parts: 'ST-C01-bp01.json' })
  assert.equal(r.ok, false)
  assert.ok(r.problems.some((p) => p.includes('blocked 原子不得有')), JSON.stringify(r.problems))
  assert.ok(r.problems.some((p) => p.includes('原子缺 business-behavior 条目')), JSON.stringify(r.problems))
})

test('F3 升级原子 previousRunId 与 S6 不一致 → fail', () => {
  const runDir = setupBehaviorRun('run-f3', [
    okEntry('AT-ST-C01-001', { previousRunId: 'ar-x-999' }),
  ], {
    atoms: [{ atomId: 'AT-ST-C01-001', analysisPath: 'full', upgraded: true, previousRunId: 'ar-' + DATE + '-001' }],
  })
  const r = assembleBehaviorParts({ runDir, date: DATE, parts: 'ST-C01-bp01.json' })
  assert.equal(r.ok, false)
  assert.ok(r.problems.some((p) => p.includes('previousRunId 与 S6 不一致')), JSON.stringify(r.problems))
})

test('F4 conflict 缺 baselineDetail / 无证据 → fail', () => {
  const runDir = setupBehaviorRun('run-f4', [
    okEntry('AT-ST-C01-001', { baselineDifference: 'conflict', baselineDetail: '', evidenceIds: [] }),
  ])
  const r = assembleBehaviorParts({ runDir, date: DATE, parts: 'ST-C01-bp01.json' })
  assert.equal(r.ok, false)
  assert.ok(r.problems.some((p) => p.includes('baselineDetail 为空')))
})

fs.rmSync(TMP, { recursive: true, force: true })

console.log('orchestration.example：' + (process.exitCode ? '存在失败' : '全部通过'))
for (const line of results) console.log('  ' + line)
process.exit(process.exitCode || 0)
