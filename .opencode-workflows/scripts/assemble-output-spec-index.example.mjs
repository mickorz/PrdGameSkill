// assemble-output-spec-index.example.mjs —— assemble-output-spec-index.mjs 自检（断言式，跑完打印结果退出）
// 覆盖：正常装配（feature_index 计数/字段映射 + stage_manifest 行）/ 空目录退出码 1 /
//       stage.id 与文件名不一致退出码 1 / 原子项 ID 重复退出码 1 / 期望阶段数不符退出码 1 /
//       功能点无原子项退出码 1 / UI 模块与协议消息提取 /
//       v3 复核合并（OSG-W4 S3.3）：approved 生效/rejected 与 pending 维持基线/l7 终局视图/
//       v2 hash 不变/DR 与 v2 漂移 fail/输出目录等于 v2 fail/正式三件缺失 fail/CLI
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mergeVerifyOutput } from './merge-verify-output.mjs'
import { assembleV3FromReview } from './assemble-output-spec-index.mjs'

const SCRIPT = '.opencode-workflows/scripts/assemble-output-spec-index.mjs'

const run = (args) => {
  try {
    const out = execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8' })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }
  }
}

const root = '.opencode-workflows/scripts/tmp-assemble-index'
fs.rmSync(root, { recursive: true, force: true })
fs.mkdirSync(root, { recursive: true })

function makePart(name, obj) {
  const p = root + '/runtime/parts/' + name
  fs.mkdirSync(root + '/runtime/parts', { recursive: true })
  fs.writeFileSync(p, JSON.stringify(obj), 'utf8')
  return p
}

function atom(id, over) {
  return Object.assign(
    {
      id: id,
      name: '原子' + id,
      rule: '规则' + id,
      uiRequirement: '',
      verdict: 'confirmed',
      clientLogic: '客户端逻辑' + id,
      uiInteraction: 'UI 交互' + id,
      evidence: [{ file: 'source-code/client/Code/fgui/box_hzmj_main/x.ts', location: 'x.ts:10', excerpt: 'doX()' }],
      messages: ['MsgJuData'],
      notes: '',
    },
    over || {}
  )
}

// 场景 1：正常装配（两阶段，含 partial/not_found、多消息、UI 模块提取）
{
  makePart('ST-C01.json', {
    stage: { id: 'ST-C01', name: '定庄与轮庄', chapter: '开局 > 定庄与轮庄', summary: '概述一', terms: [{ term: '连庄', definition: '同一庄家连续坐庄', source: '模板名词章节' }], crossCutting: ['快照跨局保留'] },
    features: [
      { id: 'FP-ST-C01-001', name: '首局定庄', description: '首局庄家来源', scope: '', coordination: '', atoms: [atom('AT-ST-C01-001'), atom('AT-ST-C01-002', { verdict: 'not_found', evidence: [], clientLogic: '', uiInteraction: '' })] },
    ],
  })
  makePart('ST-C02.json', {
    stage: { id: 'ST-C02', name: '掷骰与定财神', chapter: '开局 > 掷骰与定财神', summary: '概述二', terms: [], crossCutting: [] },
    features: [
      { id: 'FP-ST-C02-001', name: '掷骰', description: '掷骰定开牌位置', scope: '', coordination: '', atoms: [atom('AT-ST-C02-001', { verdict: 'partial', messages: ['MsgThrowChip', 'MsgJuData'] })] },
    ],
  })
  const r = run([root, '2026-11-13', '模板+代码', '2'])
  assert.equal(r.code, 0)
  assert.match(r.out, /\[成功\] feature_index\.json：2 阶段 \/ 2 功能点 \/ 3 原子项/)
  assert.match(r.out, /\[成功\] stage_manifest\.md：2 行阶段表（confirmed 1 \/ partial 1 \/ not_found 1）/)

  const idx = JSON.parse(fs.readFileSync(root + '/feature_index.json', 'utf8'))
  assert.equal(idx.stage_count, 2)
  assert.equal(idx.feature_count, 2)
  assert.equal(idx.atom_count, 3)
  assert.equal(idx.stages[0].id, 'ST-C01')
  assert.equal(idx.features[0].atoms[1].owner, 'client')
  assert.equal(idx.features[0].atoms[1].verdict, 'not_found')
  assert.deepEqual(idx.features[1].atoms[0].messages, ['MsgThrowChip', 'MsgJuData'])
  // 索引证据不带摘录（摘录保留在阶段文档）
  assert.deepEqual(idx.features[0].atoms[0].evidence, [{ file: 'source-code/client/Code/fgui/box_hzmj_main/x.ts', location: 'x.ts:10' }])
  // UTF-8 无 BOM
  assert.equal(fs.readFileSync(root + '/feature_index.json')[0], 0x7b) // '{'

  const manifest = fs.readFileSync(root + '/stage_manifest.md', 'utf8')
  assert.match(manifest, /\| ST-C01 \| 定庄与轮庄 \| 开局 > 定庄与轮庄 \| 1 \| 2 \| 1 \| 0 \| 1 \| MsgJuData \| box_hzmj_main \|/)
  assert.match(manifest, /\| \*\*合计\*\* \| \| \| \*\*2\*\* \| \*\*3\*\* \| \*\*1\*\* \| \*\*1\*\* \| \*\*1\*\* \| \| \|/)
}

// 场景 2：期望阶段数不符（残留片段） → 退出码 1
{
  const r = run([root, '2026-11-13', '模板+代码', '3'])
  assert.equal(r.code, 1)
  assert.match(r.out, /片段数与期望阶段数不符：期望 3，实际 2/)
}

// 场景 3：stage.id 与文件名不一致 → 退出码 1
{
  makePart('ST-C09.json', { stage: { id: 'ST-C08', name: '错位', chapter: '', summary: '', terms: [], crossCutting: [] }, features: [{ id: 'FP-ST-C08-001', name: 'f', description: 'd', atoms: [atom('AT-ST-C08-001')] }] })
  const r = run([root, '2026-11-13', '模板+代码'])
  assert.equal(r.code, 1)
  assert.match(r.out, /stage\.id 与文件名不一致：ST-C09\.json \/ ST-C08/)
  fs.rmSync(root + '/runtime/parts/ST-C09.json')
}

// 场景 4：原子项 ID 跨阶段重复 → 退出码 1
{
  makePart('ST-C03.json', {
    stage: { id: 'ST-C03', name: '重复原子', chapter: '', summary: '', terms: [], crossCutting: [] },
    features: [{ id: 'FP-ST-C03-001', name: 'f', description: 'd', atoms: [atom('AT-ST-C01-001')] }],
  })
  const r = run([root, '2026-11-13', '模板+代码'])
  assert.equal(r.code, 1)
  assert.match(r.out, /原子项 ID 重复：AT-ST-C01-001/)
  fs.rmSync(root + '/runtime/parts/ST-C03.json')
}

// 场景 5：功能点无原子项 → 退出码 1
{
  makePart('ST-C03.json', {
    stage: { id: 'ST-C03', name: '空功能点', chapter: '', summary: '', terms: [], crossCutting: [] },
    features: [{ id: 'FP-ST-C03-001', name: 'f', description: 'd', atoms: [] }],
  })
  const r = run([root, '2026-11-13', '模板+代码'])
  assert.equal(r.code, 1)
  assert.match(r.out, /功能点无原子项：FP-ST-C03-001/)
  fs.rmSync(root + '/runtime/parts/ST-C03.json')
}

// 场景 6：片段目录为空 → 退出码 1
{
  fs.rmSync(root + '/runtime/parts', { recursive: true, force: true })
  fs.mkdirSync(root + '/runtime/parts', { recursive: true })
  const r = run([root, '2026-11-13', '模板+代码'])
  assert.equal(r.code, 1)
  assert.match(r.out, /片段目录为空/)
}

// 场景 7：片段目录不存在 → 退出码 1
{
  fs.rmSync(root, { recursive: true, force: true })
  const r = run([root + '/不存在', '2026-11-13', '模板+代码'])
  assert.equal(r.code, 1)
  assert.match(r.out, /片段目录不存在/)
}

// 场景 8（v2）：v2 片段新字段透传 + v1 片段兜底 + schema_version/difference_stats
{
  fs.rmSync(root, { recursive: true, force: true })
  fs.mkdirSync(root + '/runtime/parts', { recursive: true })
  makePart('ST-C01.json', {
    stage: { id: 'ST-C01', name: '定庄与轮庄', chapter: '开局', summary: '概述', terms: [], crossCutting: [] },
    features: [
      {
        id: 'FP-ST-C01-001', name: '定庄', description: 'd', scope: '', coordination: '',
        atoms: [
          atom('AT-ST-C01-001', {
            businessBehavior: { trigger: '开局', condition: '首局', action: '点亮庄家标志', result: '玩家看到庄家' },
            difference: 'consistent',
            differenceDetail: '',
            verification: { businessRuleVerified: false, unverifiedReason: '服务端行为不可证', clientObserved: true },
          }),
          atom('AT-ST-C01-002', {
            verdict: 'not_found', evidence: [], clientLogic: '', uiInteraction: '',
            difference: 'conflict', differenceDetail: '需求按白板展示，实际高亮',
            verification: { businessRuleVerified: false, unverifiedReason: '差异待确认' },
          }),
        ],
      },
    ],
  })
  makePart('ST-C02.json', {
    stage: { id: 'ST-C02', name: '算分', chapter: '算分', summary: '概述', terms: [], crossCutting: [] },
    features: [
      {
        id: 'FP-ST-C02-001', name: '底分', description: 'd', scope: '', coordination: '',
        atoms: [atom('AT-ST-C02-001')], // v1 片段：无新字段
      },
    ],
  })
  const r = run([root, '2026-11-14', '模板+代码', '2'])
  assert.equal(r.code, 0)
  const idx = JSON.parse(fs.readFileSync(root + '/feature_index.json', 'utf8'))
  assert.equal(idx.schema_version, 2)
  assert.deepEqual(idx.difference_stats, { consistent: 1, partial: 0, conflict: 1, unverified: 1, unmarked_v1: 1 })

  const a1 = idx.features[0].atoms[0]
  assert.deepEqual(a1.business_behavior, { trigger: '开局', condition: '首局', action: '点亮庄家标志', result: '玩家看到庄家' })
  assert.equal(a1.difference, 'consistent')
  assert.equal(a1.difference_detail, '')
  assert.equal(a1.schema_marked, true)
  assert.deepEqual(a1.verification, { business_rule_verified: false, unverified_reason: '服务端行为不可证', client_observed: true })

  // conflict 且 verdict=not_found：装配器不重判（校验归 workflow 校验循环），透传原值
  const a2 = idx.features[0].atoms[1]
  assert.equal(a2.difference, 'conflict')
  assert.equal(a2.difference_detail, '需求按白板展示，实际高亮')
  assert.equal(a2.verification.client_observed, false, 'not_found 派生 client_observed=false')

  // v1 片段：difference 兜底 unverified + schema_marked=false + business_behavior 空对象（不冒充已验证）
  const a3 = idx.features[1].atoms[0]
  assert.equal(a3.difference, 'unverified')
  assert.equal(a3.schema_marked, false)
  assert.deepEqual(a3.business_behavior, {})
  assert.equal(a3.verification.business_rule_verified, false)
  assert.ok(a3.verification.unverified_reason.includes('v1 旧 Schema 数据'))
}

// ---------- 场景 9-10（v3，OSG-W4 S3.3）：approved 复核结论合并进 v3 新目录，v2 只读 ----------

const v3root = root + '-v3'
fs.rmSync(v3root, { recursive: true, force: true })
const v2Dir = v3root + '/1-spec'
const verifyDir = v3root + '/verify'
fs.mkdirSync(v2Dir, { recursive: true })
fs.mkdirSync(verifyDir, { recursive: true })

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(obj, null, 1), 'utf8')
}

function v3Atom(id, difference) {
  return {
    id: id, name: '原子' + id, rule: '规则' + id + '。', ui_requirement: '', owner: 'client',
    verdict: 'confirmed', client_logic: '', ui_interaction: '', messages: [], evidence: [],
    notes: '', difference: difference, difference_detail: '', schema_marked: true,
  }
}

function v3Sve(id, atomId, file, line, symbol) {
  return {
    id: id, atomId: atomId, layer: 'common_game', file: file, location: file + ':' + line,
    symbol: symbol, excerpt: symbol + ' 关键摘录', configKeys: ['first_banker_type'],
  }
}

function v3VerifyEntry(atomId, applicability, sve) {
  return {
    atomId: atomId, applicability: applicability, configVerified: true, callPathVerified: true,
    configCondition: applicability === 'conditional' ? 'first_banker_type=0 随机（client: RuleHzmj.ts:21）' : '',
    callPath: 'SymbolA -> SymbolB（' + atomId + '）',
    evidenceIds: sve ? [sve.id] : [], unresolved: '', noServerEvidence: false,
    dr: { scopeApplicability: applicability, scopeNote: '复核依据（' + atomId + '）' },
    sve: sve ? [sve] : [],
  }
}

function v3WritePart(sub, stageId, file, entries) {
  writeJson(path.join(verifyDir, 'runtime', sub, file), { schemaVersion: 1, stageId: stageId, partNo: '01', entries: entries })
}

// 场景 9：v3 全链——v2 基线 + merge 产正式三件 → 翻转裁决状态 → v3 合并
{
  // v2 基线：A1 unverified / A2 partial / A3 conflict / A4 consistent
  writeJson(path.join(v2Dir, 'feature_index.json'), {
    schema_version: 2, atom_count: 4,
    difference_stats: { consistent: 1, partial: 1, conflict: 1, unverified: 1, unmarked_v1: 0 },
    stages: [{ id: 'ST-C01', name: '定庄' }, { id: 'ST-C02', name: '财神' }],
    features: [
      { id: 'FP-1', stage_id: 'ST-C01', stage_name: '定庄', name: '定庄链路', atoms: [v3Atom('AT-ST-C01-001', 'unverified'), v3Atom('AT-ST-C01-002', 'partial')] },
      { id: 'FP-2', stage_id: 'ST-C02', stage_name: '财神', name: '财神链路', atoms: [v3Atom('AT-ST-C02-001', 'conflict'), v3Atom('AT-ST-C02-002', 'consistent')] },
    ],
  })
  const s1 = v3Sve('SVE-ST-C01-P01-01', 'AT-ST-C01-001', 'common_game/com_game/a.cpp', 10, 'SymbolA')
  const s2 = v3Sve('SVE-ST-C01-P01-02', 'AT-ST-C01-002', 'common_game/com_game/b.cpp', 20, 'SymbolB')
  const s3 = v3Sve('SVE-ST-C02-P01-01', 'AT-ST-C02-001', 'common_game/com_game/c.cpp', 30, 'SymbolC')
  const s4 = v3Sve('SVE-ST-C02-P01-02', 'AT-ST-C02-002', 'common_game/com_game/d.cpp', 40, 'SymbolD')
  v3WritePart('verify-output', 'ST-C01', 'ST-C01-p01.json', [
    v3VerifyEntry('AT-ST-C01-001', 'conditional', s1),
    v3VerifyEntry('AT-ST-C01-002', 'active', s2),
  ])
  v3WritePart('verify-output', 'ST-C02', 'ST-C02-p01.json', [
    v3VerifyEntry('AT-ST-C02-001', 'conditional', s3),
    v3VerifyEntry('AT-ST-C02-002', 'active', s4),
  ])
  v3WritePart('review-output', 'ST-C01', 'ST-C01-p01.json', [
    { atomId: 'AT-ST-C01-001', reviewedDifference: 'consistent', reviewReason: '证据同构（SymbolA）', reviewRule: 'evidence-is-not-consistency（复核后确认实现与规则同构，允许升级）' },
    { atomId: 'AT-ST-C01-002', reviewedDifference: 'consistent', reviewReason: '证据同构（SymbolB）', reviewRule: 'evidence-is-not-consistency（复核后确认实现与规则同构，允许升级）' },
  ])
  v3WritePart('review-output', 'ST-C02', 'ST-C02-p01.json', [])

  const rMerge = mergeVerifyOutput({ featureIndexPath: path.join(v2Dir, 'feature_index.json'), outDir: verifyDir, date: '2026-11-14', stageIds: 'ALL' })
  assert.ok(rMerge.ok, '场景9 前置 merge 成功：' + JSON.stringify(rMerge.problems))

  // 翻转裁决状态：A1 approved / A2 rejected / A3、A4 维持 pending
  const drPath = path.join(verifyDir, 'difference-review.json')
  const dr = JSON.parse(fs.readFileSync(drPath, 'utf8'))
  assert.equal(dr.entries.length, 4, '场景9 merge 产 4 条 DR（含无建议中性条目）')
  dr.entries.find((e) => e.atomId === 'AT-ST-C01-001').reviewStatus = 'approved'
  dr.entries.find((e) => e.atomId === 'AT-ST-C01-002').reviewStatus = 'rejected'
  writeJson(drPath, dr)

  const v2HashBefore = crypto.createHash('sha256').update(fs.readFileSync(path.join(v2Dir, 'feature_index.json'))).digest('hex')
  const v3Dir = path.join(v3root, '3-spec')
  const r3 = assembleV3FromReview({ v2IndexPath: path.join(v2Dir, 'feature_index.json'), verifyDir: verifyDir, outDir: v3Dir, date: '2026-11-14' })
  assert.ok(r3.ok, '场景9 v3 合并成功：' + JSON.stringify(r3.problems))
  assert.deepEqual(r3.summary.reviewStatus, { approved: 1, rejected: 1, pending: 2 })
  // 终局统计：A1 unverified→consistent 生效；A2 rejected 维持 partial；A3/A4 pending 维持
  assert.deepEqual(r3.summary.v3Stats, { consistent: 2, partial: 1, conflict: 1, unverified: 0 })

  const v3 = JSON.parse(fs.readFileSync(path.join(v3Dir, 'feature_index.json'), 'utf8'))
  assert.equal(v3.schema_version, 3)
  assert.deepEqual(v3.difference_stats, { consistent: 2, partial: 1, conflict: 1, unverified: 0, unmarked_v1: 0 })
  assert.deepEqual(v3.v3_merge.transitions, [{ atomId: 'AT-ST-C01-001', from: 'unverified', to: 'consistent' }])

  const aBy = new Map()
  for (const fe of v3.features) for (const at of fe.atoms) aBy.set(at.id, at)
  const a1 = aBy.get('AT-ST-C01-001')
  assert.equal(a1.difference, 'consistent')
  assert.equal(a1.difference_v2, 'unverified')
  assert.equal(a1.review_status, 'approved')
  assert.equal(a1.reviewed_difference, 'consistent')
  assert.equal(a1.l7, 'verification_required', 'approved：consistent × conditional → verification_required（conditional 语义需配置确认）')
  assert.equal(a1.l7_basis, 'approved')
  assert.equal(a1.scope_applicability, 'conditional')
  assert.equal(a1.scope_source, 'review-field')
  const a2 = aBy.get('AT-ST-C01-002')
  assert.equal(a2.difference, 'partial', 'rejected 维持基线')
  assert.equal(a2.reviewed_difference, 'consistent')
  assert.equal(a2.review_status, 'rejected')
  assert.equal(a2.l7, 'verification_required', 'rejected：partial × active → verification_required')
  assert.equal(a2.l7_basis, 'rejected')
  const a3 = aBy.get('AT-ST-C02-001')
  assert.equal(a3.difference, 'conflict', 'pending 维持基线')
  assert.equal(a3.review_status, 'pending')
  assert.equal(a3.l7, 'decision_required', 'pending：conflict × conditional → decision_required')
  assert.equal(a3.l7_basis, 'baseline')
  const a4 = aBy.get('AT-ST-C02-002')
  assert.equal(a4.difference, 'consistent')
  assert.equal(a4.l7, 'verified', 'pending：consistent × active → verified（基线差异本身可证）')
  assert.equal(a4.l7_basis, 'baseline')

  // v2 只读闸门：hash 前后不变
  const v2HashAfter = crypto.createHash('sha256').update(fs.readFileSync(path.join(v2Dir, 'feature_index.json'))).digest('hex')
  assert.equal(v2HashAfter, v2HashBefore, 'v2 hash 不变')

  // 场景 10a：DR baseline 漂移 → classifyL7 交叉校验 fail
  const dr2 = JSON.parse(fs.readFileSync(drPath, 'utf8'))
  const tamperedBaseline = JSON.parse(JSON.stringify(dr2))
  tamperedBaseline.baseline.differenceStats.consistent = 99
  writeJson(drPath, tamperedBaseline)
  const rBad1 = assembleV3FromReview({ v2IndexPath: path.join(v2Dir, 'feature_index.json'), verifyDir: verifyDir, outDir: path.join(v3root, 'bad'), date: '2026-11-14' })
  assert.ok(!rBad1.ok && rBad1.problems.some((p) => p.includes('baseline.differenceStats')), '场景10a DR baseline 漂移 fail')
  writeJson(drPath, dr2)

  // 场景 10b：v2 difference_stats 漂移 → fail
  const v2Tampered = path.join(v3root, '1-spec-bad')
  fs.mkdirSync(v2Tampered, { recursive: true })
  const v2Obj = JSON.parse(fs.readFileSync(path.join(v2Dir, 'feature_index.json'), 'utf8'))
  v2Obj.difference_stats.partial = 99
  writeJson(path.join(v2Tampered, 'feature_index.json'), v2Obj)
  const rBad2 = assembleV3FromReview({ v2IndexPath: path.join(v2Tampered, 'feature_index.json'), verifyDir: verifyDir, outDir: path.join(v3root, 'bad2'), date: '2026-11-14' })
  assert.ok(!rBad2.ok && rBad2.problems.some((p) => p.includes('difference_stats 与原子重算不一致')), '场景10b v2 stats 漂移 fail')

  // 场景 10c：v3 输出目录等于 v2 目录 → fail（v2 只读）
  const rBad3 = assembleV3FromReview({ v2IndexPath: path.join(v2Dir, 'feature_index.json'), verifyDir: verifyDir, outDir: v2Dir, date: '2026-11-14' })
  assert.ok(!rBad3.ok && rBad3.problems.some((p) => p.includes('不得等于 v2 目录')), '场景10c 输出目录守卫 fail')

  // 场景 10d：正式三件缺失 → fail
  const emptyVerify = path.join(v3root, 'empty-verify')
  fs.mkdirSync(emptyVerify, { recursive: true })
  const rBad4 = assembleV3FromReview({ v2IndexPath: path.join(v2Dir, 'feature_index.json'), verifyDir: emptyVerify, outDir: path.join(v3root, 'bad3'), date: '2026-11-14' })
  assert.ok(!rBad4.ok && rBad4.problems.some((p) => p.includes('正式三件缺失')), '场景10d 正式三件缺失 fail')

  // 场景 10e：CLI v3 模式成功 + 缺参用法
  const rCli = run(['v3', v2Dir, verifyDir, path.join(v3root, '3-spec-cli'), '2026-11-14'])
  assert.equal(rCli.code, 0, '场景10e CLI v3 成功：' + rCli.out)
  assert.match(rCli.out, /\[成功\] v3 feature_index\.json：原子 4（复核 4：approved 1 \/ rejected 1 \/ pending 2，生效迁移 1 条）/)
  const cliV3 = JSON.parse(fs.readFileSync(path.join(v3root, '3-spec-cli', 'feature_index.json'), 'utf8'))
  assert.equal(cliV3.difference_stats.unverified, 0)
  const rUsage = run(['v3'])
  assert.equal(rUsage.code, 1)
  assert.match(rUsage.out, /用法: node assemble-output-spec-index\.mjs v3/)
}

fs.rmSync(root, { recursive: true, force: true })
fs.rmSync(v3root, { recursive: true, force: true })
console.log('[成功] assemble-output-spec-index.example 全部断言通过（正常装配/阶段数不符/ID错位/原子ID重复/空功能点/空目录/目录缺失/v2 新字段透传与 v1 兜底/v3 approved 合并与 rejected-pending 维持/l7 终局视图/v2 hash 不变/漂移与目录守卫与缺件 fail/CLI）')
