// merge-verify-output.example.mjs —— merge-verify-output.mjs 自检（node 直接跑）
//
// 覆盖用例：
//   A. 全链基础：落判 + 建议合并 -> 正式三件套（scope/SVE/DR + stats/统计块/l7 矩阵回填）
//      -> classify-l7.mjs CLI 重算 -> verify-output-spec.mjs check-l7 CLI 五道闸门（端到端）
//   B. 幂等重跑：同输入再跑 -> 条目稳定、newSve=0
//   C. SVE 同 id 更新（原位替换放行）/ 同 id 跨原子 fail
//   D. reviewStatus 保全：approved 同建议保持 / 建议变化重置 pending / 既有无新建议保持
//   E. 非目标阶段落判分片 fail
//   F. 闸门 fail 集：双写不一致 / 阶段原子缺条目 / atomId 重复 / SVE 形状（layer 前缀、location、
//      atomId 基线）/ 本轮 SVE id 重复 / evidenceIds 不在 SVE / reviewRule 白名单 / evidenceScopes 坏 ref
//   G. 未处理阶段 DR 条目保全（分片移除后重跑，既有条目原样保留且全链闸门仍过）
//   H. CLI 成功与失败路径（退出码 0/1）

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mergeVerifyOutput } from './merge-verify-output.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(HERE, 'merge-verify-output.mjs')
const CLASSIFY = path.join(HERE, 'classify-l7.mjs')
const VERIFY = path.join(HERE, 'verify-output-spec.mjs')
const TMP = path.join(process.cwd(), '.tmp-merge-verify-output')

let pass = 0
let fail = 0
function check(name, cond) {
  if (cond) {
    pass++
    console.log('[通过] ' + name)
  } else {
    fail++
    console.error('[失败] ' + name)
  }
}

function reset() {
  fs.rmSync(TMP, { recursive: true, force: true })
  fs.mkdirSync(TMP, { recursive: true })
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(obj, null, 1), 'utf8')
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function runCli(script, args, expectOk) {
  try {
    const out = execFileSync('node', [script, ...args], { encoding: 'utf8' })
    if (!expectOk) throw new Error('期望失败但成功了：' + out.slice(0, 200))
    return out
  } catch (e) {
    if (expectOk) throw e
    return String(e.stdout || '') + String(e.stderr || '')
  }
}

// ---------- 基线与落判/建议夹具 ----------

function baselinePath() {
  return path.join(TMP, 'feature_index.json')
}

function writeBaseline() {
  const atom = (id, difference) => ({
    id: id, name: '原子' + id, rule: '规则' + id + '。', ui_requirement: '', owner: 'client',
    verdict: 'confirmed', client_logic: '', ui_interaction: '', messages: [], evidence: [],
    notes: '', difference: difference, difference_detail: '', schema_marked: true,
  })
  writeJson(baselinePath(), {
    schema_version: 2,
    atom_count: 4,
    difference_stats: { consistent: 1, partial: 1, conflict: 1, unverified: 1 },
    stages: [{ id: 'ST-C01', name: '定庄' }, { id: 'ST-C02', name: '财神' }],
    features: [
      {
        id: 'FP-1', stage_id: 'ST-C01', stage_name: '定庄', name: '定庄链路', atoms: [
          atom('AT-ST-C01-001', 'unverified'),
          atom('AT-ST-C01-002', 'partial'),
        ],
      },
      {
        id: 'FP-2', stage_id: 'ST-C02', stage_name: '财神', name: '财神链路', atoms: [
          atom('AT-ST-C02-001', 'conflict'),
          atom('AT-ST-C02-002', 'consistent'),
        ],
      },
    ],
  })
  writeJson(path.join(TMP, 'trace_index.json'), {
    entries: ['AT-ST-C01-001', 'AT-ST-C01-002', 'AT-ST-C02-001', 'AT-ST-C02-002'].map((id) => ({ atomId: id })),
  })
}

function sve(id, atomId, layer, file, line, symbol) {
  return {
    id: id, atomId: atomId, layer: layer, file: file, location: file + ':' + line,
    symbol: symbol, excerpt: symbol + ' 关键摘录', configKeys: layer === 'common_game' ? ['first_banker_type'] : [],
  }
}

function verifyEntry(atomId, applicability, opts = {}) {
  return Object.assign(
    {
      atomId: atomId,
      applicability: applicability,
      configVerified: true,
      callPathVerified: true,
      configCondition: applicability === 'conditional' ? 'first_banker_type=0 随机（client: RuleHzmj.ts:21）' : '',
      callPath: 'SymbolA -> SymbolB（' + atomId + '）',
      evidenceIds: [],
      unresolved: '',
      noServerEvidence: false,
      dr: { scopeApplicability: applicability, scopeNote: '复核依据（' + atomId + '）' },
      sve: [],
    },
    opts
  )
}

function writePart(outDir, sub, stageId, file, entries) {
  const p = path.join(outDir, 'runtime', sub, file)
  writeJson(p, { schemaVersion: 1, stageId: stageId, partNo: '01', entries: entries })
  return p
}

function buildFixtures(outDir, opts = {}) {
  const c1sve = sve('SVE-ST-C01-P01-01', 'AT-ST-C01-001', 'common_game', 'common_game/com_game/a.cpp', 10, 'UpdateBankerLevel')
  const c1sve2 = sve('SVE-ST-C01-P01-02', 'AT-ST-C01-002', 'common_game', 'common_game/com_game/b.cpp', 20, 'JudgeZhuang')
  const c2sve = sve('SVE-ST-C02-P01-01', 'AT-ST-C02-001', 'hzmj_server', 'hzmj_server/hzmj_x.cpp', 30, 'InitJoker')
  const c2sve2 = sve('SVE-ST-C02-P01-02', 'AT-ST-C02-002', 'mah_frame', 'mah_frame/base/base_data.cpp', 40, 'InitData')
  const e1 = verifyEntry('AT-ST-C01-001', 'conditional', { evidenceIds: ['SVE-ST-C01-P01-01'], sve: [c1sve] })
  const e2 = verifyEntry('AT-ST-C01-002', 'active', { evidenceIds: ['SVE-ST-C01-P01-02'], sve: [c1sve2] })
  const e3 = verifyEntry('AT-ST-C02-001', 'conditional', {
    evidenceIds: ['SVE-ST-C02-P01-01'],
    sve: [c2sve],
    evidenceScopes: [{ ref: 'client-visual', layer: 'client', applicability: 'active', note: '纯客户端视觉冲突' }],
  })
  const e4 = verifyEntry('AT-ST-C02-002', 'active', { evidenceIds: ['SVE-ST-C02-P01-02'], sve: [c2sve2] })
  const c01 = opts.c01 || [e1, e2]
  const c02 = opts.c02 || [e3, e4]
  writePart(outDir, 'verify-output', 'ST-C01', 'ST-C01-p01.json', c01)
  writePart(outDir, 'verify-output', 'ST-C02', 'ST-C02-p01.json', c02)
  writePart(outDir, 'review-output', 'ST-C01', 'ST-C01-p01.json', opts.reviewC01 || [
    { atomId: 'AT-ST-C01-001', reviewedDifference: 'consistent', reviewReason: '需求 X vs 实现 Y 同构（SVE-ST-C01-P01-01）', reviewRule: 'evidence-is-not-consistency（复核后确认实现与规则同构，允许升级）' },
  ])
  writePart(outDir, 'review-output', 'ST-C02', 'ST-C02-p01.json', opts.reviewC02 || [
    { atomId: 'AT-ST-C02-001', reviewedDifference: 'conflict', reviewReason: '客户端视觉冲突独立成立', reviewRule: 'ui-conflict-stands-alone' },
  ])
}

function mergeRun(outDir, stageIds) {
  return mergeVerifyOutput({ featureIndexPath: baselinePath(), outDir: outDir, date: '2026-11-14', stageIds: stageIds || 'ALL' })
}

function fullChain(outDir, label) {
  const classifyOut = runCli(CLASSIFY, [baselinePath(), path.join(outDir, 'scope-index.json'), path.join(outDir, 'server-evidence.json'), path.join(outDir, 'difference-review.json'), path.join(outDir, 'l7-classify.json'), '2026-11-14'], true)
  check(label + ' classify CLI 重算成功', classifyOut.includes('[成功]'))
  const checkOut = runCli(VERIFY, ['check-l7', baselinePath(), path.join(TMP, 'trace_index.json'), path.join(outDir, 'scope-index.json'), path.join(outDir, 'server-evidence.json'), path.join(outDir, 'difference-review.json'), path.join(outDir, 'l7-classify.json'), path.join(outDir, 'runtime', 'spec-check')], true)
  check(label + ' check-l7 CLI 五道闸门通过', checkOut.includes('[成功]'))
  check(label + ' l7-check 报告落盘', fs.existsSync(path.join(outDir, 'runtime', 'spec-check', 'l7-check-report.md')))
}

// ---------- 用例 A：全链基础 ----------

{
  reset()
  writeBaseline()
  const outDir = path.join(TMP, 'out-a')
  buildFixtures(outDir)
  const r = mergeRun(outDir)
  check('用例A 合并成功', r.ok && r.problems.length === 0)
  check('用例A 汇总计数', r.summary.judgeCount === 4 && r.summary.newScopeEntries === 4 && r.summary.newSve === 4 && r.summary.drTotal === 4)
  check('用例A scopeStats 重算', JSON.stringify(r.summary.scopeStats) === JSON.stringify({ active: 2, conditional: 2, unknown: 0, inactive: 0 }))

  const si = readJson(path.join(outDir, 'scope-index.json'))
  check('用例A scope 条目 4 条 + stats 一致', si.entries.length === 4 && JSON.stringify(si.stats) === JSON.stringify(si.stats) && si.stats.active === 2 && si.stats.conditional === 2)
  const e3 = si.entries.find((e) => e.atomId === 'AT-ST-C02-001')
  check('用例A conflict 条目 evidenceScopes 透传', e3 && e3.evidenceScopes && e3.evidenceScopes[0].ref === 'client-visual')
  const e1 = si.entries.find((e) => e.atomId === 'AT-ST-C01-001')
  check('用例A configCondition 保留', e1 && e1.configCondition.includes('first_banker_type'))

  const sv = readJson(path.join(outDir, 'server-evidence.json'))
  check('用例A SVE 4 条', sv.entries.length === 4)

  const dr = readJson(path.join(outDir, 'difference-review.json'))
  const byId = new Map(dr.entries.map((e) => [e.atomId, e]))
  const a1 = byId.get('AT-ST-C01-001')
  check('用例A 建议落条（previous unverified -> reviewed consistent, pending）', a1.previousDifference === 'unverified' && a1.reviewedDifference === 'consistent' && a1.reviewStatus === 'pending')
  check('用例A l7 矩阵回填（consistent x conditional -> verification_required）', a1.l7 === 'verification_required' && a1.effectiveDifference === 'unverified' && a1.l7Basis !== undefined)
  const a2 = byId.get('AT-ST-C01-002')
  check('用例A 无建议中性条目（维持 partial）', a2.previousDifference === 'partial' && a2.reviewedDifference === 'partial' && a2.reviewReason.includes('本轮未出复核建议') && a2.l7 === 'verification_required')
  const a3 = byId.get('AT-ST-C02-001')
  check('用例A conflict 条目（decision_required + evidenceScopes 双写一致）', a3.l7 === 'decision_required' && a3.scopeApplicability === 'conditional' && a3.evidenceIds.length === 1)
  const a4 = byId.get('AT-ST-C02-002')
  check('用例A consistent x active -> verified', a4.l7 === 'verified' && a4.reviewStatus === 'pending' && a4.effectiveDifference === 'consistent')
  check('用例A DR 双写（scopeApplicability 与 scope-index 条目一致）', a1.scopeApplicability === 'conditional' && a2.scopeApplicability === 'active' && a4.scopeApplicability === 'active')
  check('用例A baseline 块重算', JSON.stringify(dr.baseline.differenceStats) === JSON.stringify({ consistent: 1, partial: 1, conflict: 1, unverified: 1 }))
  check('用例A afterReviewProjection 迁移（unverified->consistent）', dr.afterReviewProjection.consistent === 2 && dr.afterReviewProjection.unverified === 0 && dr.afterReviewProjection.total === 4 && dr.afterReviewProjection.transitions.length === 1 && dr.afterReviewProjection.transitions[0].atomId === 'AT-ST-C01-001')
  check('用例A l7Projection 重算（1/2/1/0）', dr.l7Projection.verified === 1 && dr.l7Projection.verification_required === 2 && dr.l7Projection.decision_required === 1 && dr.l7Projection.not_applicable === 0)

  fullChain(outDir, '用例A')
}

// ---------- 用例 B：幂等重跑 ----------

{
  reset()
  writeBaseline()
  const outDir = path.join(TMP, 'out-b')
  buildFixtures(outDir)
  const r1 = mergeRun(outDir)
  const si1 = readJson(path.join(outDir, 'scope-index.json')).entries
  const dr1 = readJson(path.join(outDir, 'difference-review.json')).entries
  const r2 = mergeRun(outDir)
  check('用例B 幂等重跑成功', r2.ok)
  check('用例B newSve=0（既有复用）', r2.summary.newSve === 0 && r2.summary.replacedScopeEntries === 4 && r2.summary.newScopeEntries === 0)
  const si2 = readJson(path.join(outDir, 'scope-index.json')).entries
  const dr2 = readJson(path.join(outDir, 'difference-review.json')).entries
  check('用例B scope 条目稳定', JSON.stringify(si1) === JSON.stringify(si2))
  check('用例B DR 条目稳定（含 l7 回填）', JSON.stringify(dr1) === JSON.stringify(dr2))
  const sv = readJson(path.join(outDir, 'server-evidence.json'))
  check('用例B SVE 不重复累积', sv.entries.length === 4)
}

// ---------- 用例 C：SVE 同 id 更新 / 跨原子 fail ----------

{
  reset()
  writeBaseline()
  const outDir = path.join(TMP, 'out-c')
  buildFixtures(outDir)
  check('用例C 前置：首次合并成功', mergeRun(outDir).ok)
  // 同 id 同原子、摘录更新：原位替换放行
  buildFixtures(outDir, {
    c01: [
      verifyEntry('AT-ST-C01-001', 'conditional', {
        evidenceIds: ['SVE-ST-C01-P01-01'],
        sve: [Object.assign(sve('SVE-ST-C01-P01-01', 'AT-ST-C01-001', 'common_game', 'common_game/com_game/a.cpp', 12, 'UpdateBankerLevel'), { excerpt: '更新后的摘录' })],
      }),
      verifyEntry('AT-ST-C01-002', 'active', { evidenceIds: ['SVE-ST-C01-P01-02'], sve: [sve('SVE-ST-C01-P01-02', 'AT-ST-C01-002', 'common_game', 'common_game/com_game/b.cpp', 20, 'JudgeZhuang')] }),
    ],
  })
  const rUpd = mergeRun(outDir)
  check('用例C 同 id 摘录更新放行', rUpd.ok && rUpd.summary.newSve === 0)
  const sv = readJson(path.join(outDir, 'server-evidence.json'))
  const upd = sv.entries.find((e) => e.id === 'SVE-ST-C01-P01-01')
  check('用例C 原位替换生效', upd && upd.excerpt === '更新后的摘录' && sv.entries.length === 4)

  // 同 id 跨原子且内容不同：fail（id 劫持；同内容跨原子为共享证据，见用例 C2）
  reset()
  writeBaseline()
  const outDir2 = path.join(TMP, 'out-c2')
  buildFixtures(outDir2)
  const okFirst = mergeRun(outDir2).ok
  buildFixtures(outDir2, {
    c01: [
      verifyEntry('AT-ST-C01-001', 'conditional', {
        evidenceIds: ['SVE-ST-C01-P01-01'],
        sve: [sve('SVE-ST-C01-P01-01', 'AT-ST-C01-002', 'common_game', 'common_game/com_game/z.cpp', 99, 'HijackSymbol')],
      }),
      verifyEntry('AT-ST-C01-002', 'active', { evidenceIds: ['SVE-ST-C01-P01-02'], sve: [sve('SVE-ST-C01-P01-02', 'AT-ST-C01-002', 'common_game', 'common_game/com_game/b.cpp', 20, 'JudgeZhuang')] }),
    ],
  })
  const rHijack = mergeRun(outDir2)
  check('用例C 同 id 跨原子且内容不同 fail（id 劫持）', okFirst && !rHijack.ok && rHijack.problems.some((p) => p.includes('内容不同')))
}

// ---------- 用例 C2：共享证据同 id 跨原子复制（去重放行）/ 同 id 内容不同（fail） ----------

{
  reset()
  writeBaseline()
  const outDir = path.join(TMP, 'out-c2')
  buildFixtures(outDir)
  // 首跑：两条独立 SVE
  check('用例C2 前置：首次合并成功', mergeRun(outDir).ok)
  // 重跑：同一证据（同 id 同核心内容）被两个原子各写一条（atomId 不同）-> 去重放行，SVE 总数不变
  const shared = sve('SVE-ST-C01-P01-03', 'AT-ST-C01-001', 'common_game', 'common_game/com_game/c.cpp', 30, 'LoadBoxJsonConfig')
  buildFixtures(outDir, {
    c01: [
      verifyEntry('AT-ST-C01-001', 'conditional', {
        evidenceIds: ['SVE-ST-C01-P01-01', 'SVE-ST-C01-P01-03'],
        sve: [sve('SVE-ST-C01-P01-01', 'AT-ST-C01-001', 'common_game', 'common_game/com_game/a.cpp', 10, 'UpdateBankerLevel'), shared],
      }),
      verifyEntry('AT-ST-C01-002', 'active', {
        evidenceIds: ['SVE-ST-C01-P01-02', 'SVE-ST-C01-P01-03'],
        sve: [sve('SVE-ST-C01-P01-02', 'AT-ST-C01-002', 'common_game', 'common_game/com_game/b.cpp', 20, 'JudgeZhuang'), shared],
      }),
    ],
  })
  const rShared = mergeRun(outDir)
  const svShared = readJson(path.join(outDir, 'server-evidence.json'))
  check(
    '用例C2 共享证据跨原子复制去重放行',
    rShared.ok && svShared.entries.filter((e) => e.id === 'SVE-ST-C01-P01-03').length === 1 && svShared.entries.length === 5,
  )
  // 同 id 内容不同：fail
  buildFixtures(outDir, {
    c01: [
      verifyEntry('AT-ST-C01-001', 'conditional', {
        evidenceIds: ['SVE-ST-C01-P01-01', 'SVE-ST-C01-P01-03'],
        sve: [sve('SVE-ST-C01-P01-01', 'AT-ST-C01-001', 'common_game', 'common_game/com_game/a.cpp', 10, 'UpdateBankerLevel'), sve('SVE-ST-C01-P01-03', 'AT-ST-C01-001', 'common_game', 'common_game/com_game/c.cpp', 30, 'LoadBoxJsonConfig')],
      }),
      verifyEntry('AT-ST-C01-002', 'active', {
        evidenceIds: ['SVE-ST-C01-P01-02', 'SVE-ST-C01-P01-03'],
        sve: [sve('SVE-ST-C01-P01-02', 'AT-ST-C01-002', 'common_game', 'common_game/com_game/b.cpp', 20, 'JudgeZhuang'), sve('SVE-ST-C01-P01-03', 'AT-ST-C01-002', 'common_game', 'common_game/com_game/d.cpp', 40, 'OtherSymbol')],
      }),
    ],
  })
  const rDupBad = mergeRun(outDir)
  check('用例C2 同 id 内容不同 fail', !rDupBad.ok && rDupBad.problems.some((p) => p.includes('重复且内容不同')))

  // 同 id 同证据指针、摘录漂移（真实案例：agent 复制共享证据时摘录截断不同）-> 去重放行保留首个
  const sharedLong = sve('SVE-ST-C01-P01-03', 'AT-ST-C01-001', 'common_game', 'common_game/com_game/c.cpp', 30, 'LoadBoxJsonConfig')
  const sharedShort = Object.assign({}, sharedLong, { atomId: 'AT-ST-C01-002', excerpt: '// 截短的摘录' })
  buildFixtures(outDir, {
    c01: [
      verifyEntry('AT-ST-C01-001', 'conditional', {
        evidenceIds: ['SVE-ST-C01-P01-01', 'SVE-ST-C01-P01-03'],
        sve: [sve('SVE-ST-C01-P01-01', 'AT-ST-C01-001', 'common_game', 'common_game/com_game/a.cpp', 10, 'UpdateBankerLevel'), sharedLong],
      }),
      verifyEntry('AT-ST-C01-002', 'active', {
        evidenceIds: ['SVE-ST-C01-P01-02', 'SVE-ST-C01-P01-03'],
        sve: [sve('SVE-ST-C01-P01-02', 'AT-ST-C01-002', 'common_game', 'common_game/com_game/b.cpp', 20, 'JudgeZhuang'), sharedShort],
      }),
    ],
  })
  const rDrift = mergeRun(outDir)
  const svDrift = readJson(path.join(outDir, 'server-evidence.json'))
  const driftEntry = svDrift.entries.find((e) => e.id === 'SVE-ST-C01-P01-03')
  check(
    '用例C2 同 id 摘录漂移去重放行（保留首个）',
    rDrift.ok && driftEntry && driftEntry.excerpt === sharedLong.excerpt && svDrift.entries.length === 5,
  )
}

// ---------- 用例 D：reviewStatus 保全 ----------

{
  reset()
  writeBaseline()
  const outDir = path.join(TMP, 'out-d')
  buildFixtures(outDir)
  check('用例D 前置：首次合并成功', mergeRun(outDir).ok)
  // 模拟人工批准 AT-ST-C01-001（建议不变：consistent）
  const drPath = path.join(outDir, 'difference-review.json')
  const dr = readJson(drPath)
  dr.entries.find((e) => e.atomId === 'AT-ST-C01-001').reviewStatus = 'approved'
  dr.l7Projection = {} // 手改统计块应被重算覆盖
  writeJson(drPath, dr)
  const rKeep = mergeRun(outDir)
  check('用例D 同建议保持 approved', rKeep.ok)
  const drKeep = readJson(drPath)
  const a1 = drKeep.entries.find((e) => e.atomId === 'AT-ST-C01-001')
  check('用例D approved 保持 + effectiveDifference 生效 + l7Projection 重算', a1.reviewStatus === 'approved' && a1.effectiveDifference === 'consistent' && drKeep.l7Projection.verification_required === 2)

  // 建议变化：重置 pending
  buildFixtures(outDir, {
    reviewC01: [
      { atomId: 'AT-ST-C01-001', reviewedDifference: 'partial', reviewReason: '复核后细节差异', reviewRule: 'evidence-is-not-consistency' },
    ],
  })
  const rReset = mergeRun(outDir)
  const drReset = readJson(drPath)
  const a1r = drReset.entries.find((e) => e.atomId === 'AT-ST-C01-001')
  check('用例D 建议变化重置 pending + 结论更新', rReset.ok && a1r.reviewStatus === 'pending' && a1r.reviewedDifference === 'partial' && a1r.effectiveDifference === 'unverified')

  // 既有条目无新建议：保持原 reviewStatus 与结论
  writePart(outDir, 'review-output', 'ST-C01', 'ST-C01-p01.json', [])
  const rNoNew = mergeRun(outDir)
  const drNoNew = readJson(drPath)
  const a1n = drNoNew.entries.find((e) => e.atomId === 'AT-ST-C01-001')
  check('用例D 无新建议保持既有结论', rNoNew.ok && a1n.reviewedDifference === 'partial' && a1n.reviewStatus === 'pending' && a1n.reviewReason.includes('复核后细节差异'))
}

// ---------- 用例 E：非目标阶段落判分片 fail ----------

{
  reset()
  writeBaseline()
  const outDir = path.join(TMP, 'out-e')
  buildFixtures(outDir)
  const r = mergeRun(outDir, 'ST-C01')
  check('用例E 非目标阶段分片 fail', !r.ok && r.problems.some((p) => p.includes('阶段不在目标范围')))
}

// ---------- 用例 F：闸门 fail 集 ----------

{
  const cases = [
    {
      name: '双写闸门（dr 与 applicability 不一致）',
      mutate: (o) => buildFixtures(o, { c01: [verifyEntry('AT-ST-C01-001', 'conditional', { dr: { scopeApplicability: 'active' } }), verifyEntry('AT-ST-C01-002', 'active')] }),
      match: '双写闸门',
    },
    {
      name: '阶段原子缺落判条目',
      mutate: (o) => buildFixtures(o, { c01: [verifyEntry('AT-ST-C01-001', 'conditional')] }),
      match: '缺落判条目',
    },
    {
      name: 'atomId 重复',
      mutate: (o) => buildFixtures(o, { c01: [verifyEntry('AT-ST-C01-001', 'conditional'), verifyEntry('AT-ST-C01-001', 'active')] }),
      match: '重复',
    },
    {
      name: 'SVE layer/file 前缀不符',
      mutate: (o) => buildFixtures(o, { c01: [verifyEntry('AT-ST-C01-001', 'conditional', { evidenceIds: ['SVE-X'], sve: [sve('SVE-X', 'AT-ST-C01-001', 'common_game', 'hzmj_server/x.cpp', 1, 'S')] }), verifyEntry('AT-ST-C01-002', 'active')] }),
      match: 'layer 前缀不符',
    },
    {
      name: 'SVE location 与 file 不一致',
      mutate: (o) => buildFixtures(o, {
        c01: [
          verifyEntry('AT-ST-C01-001', 'conditional', { evidenceIds: ['SVE-X'], sve: [Object.assign(sve('SVE-X', 'AT-ST-C01-001', 'common_game', 'common_game/x.cpp', 1, 'S'), { location: 'common_game/y.cpp:1' })] }),
          verifyEntry('AT-ST-C01-002', 'active'),
        ],
      }),
      match: 'location 与 file 不一致',
    },
    {
      name: 'SVE atomId 不在基线',
      mutate: (o) => buildFixtures(o, { c01: [verifyEntry('AT-ST-C01-001', 'conditional', { evidenceIds: ['SVE-X'], sve: [sve('SVE-X', 'AT-ST-C99-001', 'common_game', 'common_game/x.cpp', 1, 'S')] }), verifyEntry('AT-ST-C01-002', 'active')] }),
      match: 'atomId 不在基线',
    },
    {
      name: '本轮 SVE id 重复',
      mutate: (o) => buildFixtures(o, {
        c01: [
          verifyEntry('AT-ST-C01-001', 'conditional', { evidenceIds: ['SVE-X'], sve: [sve('SVE-X', 'AT-ST-C01-001', 'common_game', 'common_game/x.cpp', 1, 'S')] }),
          verifyEntry('AT-ST-C01-002', 'active', { evidenceIds: ['SVE-X'], sve: [sve('SVE-X', 'AT-ST-C01-002', 'common_game', 'common_game/y.cpp', 2, 'S2')] }),
        ],
      }),
      match: '本轮 SVE id 重复',
    },
    {
      name: 'evidenceIds 不在 server-evidence',
      mutate: (o) => buildFixtures(o, { c01: [verifyEntry('AT-ST-C01-001', 'conditional', { evidenceIds: ['SVE-ST-C01-P01-01'] }), verifyEntry('AT-ST-C01-002', 'active')] }),
      match: 'evidenceIds 不在 server-evidence',
    },
    {
      name: 'reviewRule 前缀白名单',
      mutate: (o) => buildFixtures(o, { reviewC01: [{ atomId: 'AT-ST-C01-001', reviewedDifference: 'consistent', reviewReason: 'x', reviewRule: 'made-up-rule' }] }),
      match: '白名单',
    },
    {
      name: 'evidenceScopes 坏 ref',
      mutate: (o) => buildFixtures(o, { c01: [verifyEntry('AT-ST-C01-001', 'conditional', { evidenceScopes: [{ ref: 'SVE-NOT-EXIST', layer: 'common_game', applicability: 'active' }] }), verifyEntry('AT-ST-C01-002', 'active')] }),
      match: 'evidenceScopes.ref 非法',
    },
  ]
  for (const c of cases) {
    reset()
    writeBaseline()
    const outDir = path.join(TMP, 'out-f')
    c.mutate(outDir)
    const r = mergeRun(outDir)
    check('用例F ' + c.name + ' fail', !r.ok && r.problems.some((p) => p.includes(c.match)))
    check('用例F ' + c.name + ' 产物未写', !fs.existsSync(path.join(outDir, 'scope-index.json')))
  }
}

// ---------- 用例 G：未处理阶段 DR 条目保全 ----------

{
  reset()
  writeBaseline()
  const outDir = path.join(TMP, 'out-g')
  buildFixtures(outDir)
  check('用例G 前置：全量合并成功', mergeRun(outDir).ok)
  const drBefore = readJson(path.join(outDir, 'difference-review.json')).entries
  // 移除 ST-C02 落判与建议分片后重跑：ST-C02 未处理，既有条目保全
  fs.rmSync(path.join(outDir, 'runtime', 'verify-output', 'ST-C02-p01.json'))
  fs.rmSync(path.join(outDir, 'runtime', 'review-output', 'ST-C02-p01.json'))
  const r = mergeRun(outDir)
  check('用例G 部分重跑成功（ST-C01 处理 / ST-C02 保全）', r.ok && r.summary.judgeCount === 2)
  const drAfter = readJson(path.join(outDir, 'difference-review.json')).entries
  const c02After = drAfter.filter((e) => e.atomId.startsWith('AT-ST-C02'))
  const c02Before = drBefore.filter((e) => e.atomId.startsWith('AT-ST-C02'))
  check('用例G 未处理阶段条目原样保全', JSON.stringify(c02Before) === JSON.stringify(c02After))
  fullChain(outDir, '用例G')
}

// ---------- 用例 H：CLI 成功与失败路径 ----------

{
  reset()
  writeBaseline()
  const outDir = path.join(TMP, 'out-h')
  buildFixtures(outDir)
  const okOut = runCli(SCRIPT, [baselinePath(), outDir, '2026-11-14', 'ALL'], true)
  check('用例H CLI 成功 + 汇总输出', okOut.includes('[成功]') && okOut.includes('scopeStats'))

  const badOut = runCli(SCRIPT, [baselinePath(), path.join(TMP, 'out-none'), '2026-11-14', 'ALL'], false)
  check('用例H CLI 无落判分片失败', badOut.includes('无落判分片'))

  const usageOut = runCli(SCRIPT, [baselinePath()], false)
  check('用例H CLI 缺参用法提示', usageOut.includes('用法'))
}

// ---------- 收尾 ----------

fs.rmSync(TMP, { recursive: true, force: true })
if (fail > 0) {
  console.error('[失败] merge-verify-output.example：' + pass + ' 通过 / ' + fail + ' 失败')
  process.exit(1)
}
console.log('[成功] merge-verify-output.example 全部断言通过（' + pass + ' 项：全链端到端/幂等重跑/SVE 更新与劫持/reviewStatus 保全/阶段过滤/闸门 fail 集/未处理保全/CLI）')
