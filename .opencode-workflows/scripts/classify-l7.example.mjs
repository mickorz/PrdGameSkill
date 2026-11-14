// classify-l7.example.mjs —— classify-l7.mjs 自检（断言式，跑完打印结果退出）
// 覆盖：
//   A. 真实样本重跑（v2 基线 319 原子 + scope 样本 34 条目（ST-C01/02/04 全部 33 原子 +
//      ST-C15-018 conflict 条目，S1.3 补据）+ 14 条复核样本，CLI 落盘 l7-classify_sample.json）：
//      14 条 l7 / reviewStatus / effectiveDifference / l7Basis 与 difference-review_sample 逐条一致（S1.1 验收：
//      33 原子样本重跑与 difference-review_sample 的 l7 分布一致）；分布 verified 1 / verification_required 11 /
//      decision_required 2 / not_applicable 0 与 l7Projection 一致；全部 pending → effectiveDifference 分布
//      = previousDifference 分布（1/2/2/9）、l7Approved 全 0、未复核 305；
//      S1.4 回归锚点：scope 样本 34 条目、stats active 2 / conditional 9 / unknown 23 / inactive 0；
//      关键口径：C04-013 verified+pending+proposed；C02-008 证据级 client-visual → active → decision_required；
//      C15-018 补据后同样走证据级 client-visual → active → decision_required（S1.3 前缺 scope-index 条目为
//      unknown 不降级）；C02-004 consistent×conditional 不算 verified
//   B. 矩阵 4×4 全枚举（scope-index Atom 级作用域路径）：非冲突按 4.1 矩阵逐格断言；
//      conflict×inactive 无 evidenceScopes 时不可消除冲突（降 unknown → decision_required）；
//      consistent×inactive（review-field 直填）→ not_applicable；非冲突条目不受 evidenceScopes 影响
//   C. 缺失作用域：无 scopeApplicability 且无 scope-index 条目 → 一律 unknown（缺失不缺省 inactive）；
//      conflict 缺 scope → decision_required（不判 not_applicable）
//   D. conflict 证据级 scope（3.3）：client-visual 优先（其他证据 inactive 也不覆盖）；
//      全部证据 inactive → not_applicable；无 client-visual 且存在非 inactive 证据 → 不降级 decision_required；
//      无 evidenceScopes 且候选 inactive → unknown 不消除冲突（review-field 路径）
//   E. approved / rejected 条目：effectiveDifference、l7Basis、l7Approved 统计、afterReviewProjection 重算一致；
//      rejected 条目 l7 保留矩阵结果仅作追溯，不入 l7Approved
//   F. 完整性校验失败路径：atomId 不在基线 / previousDifference 漂移 / evidenceIds 缺失 / 枚举非法 /
//      复核条目 atomId 重复 / 手写 l7、effectiveDifference、l7Basis 与重算不符 / 顶层统计块漂移
//      （baseline.differenceStats、afterReviewProjection、l7Projection、scope-index.stats、
//      feature_index.difference_stats、atom_count）/ 基线原子缺 difference / evidenceScopes ref 不在
//      server-evidence / SVE 与 scope 的 atomId 不在基线 / scope applicability 非法 / 输入四件套缺失
//   G. CLI 失败路径：参数缺失 → 退出码 1；输入文件不存在 → 退出码 1；完整性失败 → 退出码 1 且不写输出
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { classifyL7 } from './classify-l7.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = path.join(REPO_ROOT, '.opencode-workflows/scripts/classify-l7.mjs')
const BASE_DIR = path.join(REPO_ROOT, 'spec-workflow/output-spec/2026-11-14/1-spec')
const SAMPLE_DIR = path.join(REPO_ROOT, 'spec-workflow/output-spec/server-rule-verify')
const OUT_PATH = path.join(SAMPLE_DIR, 'l7-classify_sample.json')
const TMP = path.join(REPO_ROOT, '.opencode-workflows/scripts/tmp-classify-l7')

const runCli = (args) => {
  try {
    const out = execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }
  }
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))

// ============================================================
// A. 真实样本重跑（CLI，产出交付物 l7-classify_sample.json）
// ============================================================
{
  const r = runCli([
    path.join(BASE_DIR, 'feature_index.json'),
    path.join(SAMPLE_DIR, 'scope-index_sample.json'),
    path.join(SAMPLE_DIR, 'server-evidence_sample.json'),
    path.join(SAMPLE_DIR, 'difference-review_sample.json'),
    OUT_PATH,
    '2026-11-14',
  ])
  assert.equal(r.code, 0, '真实样本 CLI 运行应成功：\n' + r.out)

  const out = readJson(OUT_PATH)
  const drSample = readJson(path.join(SAMPLE_DIR, 'difference-review_sample.json'))
  assert.equal(out.date, '2026-11-14')
  assert.equal(out.scopeTarget.game, 'hzmj')
  assert.equal(out.scopeTarget.roomType, 'friend')
  assert.equal(out.inputs.differenceReview.endsWith('difference-review_sample.json'), true)

  assert.equal(out.stats.atomCount, 319)
  assert.equal(out.stats.reviewedCount, 14)
  assert.equal(out.stats.unreviewedCount, 305)

  // 逐条与 difference-review_sample 一致（S1.1 验收：重跑分布一致）
  assert.equal(out.entries.length, drSample.entries.length)
  const byId = new Map(drSample.entries.map((e) => [e.atomId, e]))
  for (const e of out.entries) {
    const s = byId.get(e.atomId)
    assert.ok(s, '条目应存在于复核样本：' + e.atomId)
    assert.equal(e.l7, s.l7, e.atomId + ' l7 应与样本一致')
    assert.equal(e.reviewStatus, s.reviewStatus, e.atomId + ' reviewStatus 应与样本一致')
    assert.equal(e.effectiveDifference, s.effectiveDifference, e.atomId + ' effectiveDifference 应与样本一致')
    assert.equal(e.l7Basis, s.l7Basis, e.atomId + ' l7Basis 应与样本一致')
    assert.equal(e.previousDifference, s.previousDifference, e.atomId + ' previousDifference 应与样本一致')
    assert.equal(e.reviewedDifference, s.reviewedDifference, e.atomId + ' reviewedDifference 应与样本一致')
    assert.ok(e.stageId, e.atomId + ' 应带 stageId')
  }

  // 分布与 l7Projection 一致（S1.1 修复后的确定性口径）
  assert.deepEqual(out.stats.l7, { verified: 1, verification_required: 11, decision_required: 2, not_applicable: 0 })
  assert.deepEqual(
    { verified: drSample.l7Projection.verified, verification_required: drSample.l7Projection.verification_required, decision_required: drSample.l7Projection.decision_required, not_applicable: drSample.l7Projection.not_applicable },
    out.stats.l7,
    '样本 l7Projection 应与重算分布一致（统计块禁止手工填写）'
  )
  // 全部 pending：effectiveDifference=previousDifference，正式索引可见部分为空
  assert.deepEqual(out.stats.effectiveDifference, { consistent: 1, partial: 2, conflict: 2, unverified: 9 })
  assert.deepEqual(out.stats.reviewStatus, { pending: 14, approved: 0, rejected: 0 })
  assert.deepEqual(out.stats.l7Approved, { verified: 0, verification_required: 0, decision_required: 0, not_applicable: 0 })

  // S1.4 回归锚点：scope 样本（34 条目：ST-C01/02/04 全部 33 原子 + ST-C15-018 conflict 条目，S1.3 补据）
  // 人工预期（二审修订 + S1.3 补据）钉死，样本数据变化必须显式更新此锚点
  const siSample = readJson(path.join(SAMPLE_DIR, 'scope-index_sample.json'))
  assert.equal(siSample.entries.length, 34)
  assert.deepEqual(siSample.stats, { active: 2, conditional: 9, unknown: 23, inactive: 0 })

  // 关键口径逐条
  const find = (id) => out.entries.find((e) => e.atomId === id)
  const c04_013 = find('AT-ST-C04-013')
  assert.equal(c04_013.l7, 'verified') // consistent × active
  assert.equal(c04_013.effectiveDifference, 'unverified') // pending 未批准，不进正式结论
  assert.equal(c04_013.l7Basis, 'proposed')
  const c02_008 = find('AT-ST-C02-008')
  assert.equal(c02_008.l7, 'decision_required')
  assert.equal(c02_008.scopeApplicability, 'active') // 冲突判定采用证据级 scope：client-visual 即冲突产生证据
  assert.equal(c02_008.scopeSource, 'evidence-level-client-visual')
  assert.ok(c02_008.scopeNote.includes('client-visual'))
  const c15_018 = find('AT-ST-C15-018')
  assert.equal(c15_018.scopeApplicability, 'active') // S1.3 补据：证据级 client-visual（此前缺 scope-index 条目为 unknown）
  assert.equal(c15_018.scopeSource, 'evidence-level-client-visual')
  assert.equal(c15_018.l7, 'decision_required') // conflict 不因 scope 未知而降级（补据前后 l7 均为 decision_required）
  const c02_004 = find('AT-ST-C02-004')
  assert.equal(c02_004.l7, 'verification_required') // consistent × conditional 不算 verified
  assert.equal(c02_004.effectiveDifference, 'consistent') // pending → 生效结论仍为 previous
}

// ============================================================
// 合成输入工具
// ============================================================
const synthBase = (atoms) => {
  const stats = { consistent: 0, partial: 0, conflict: 0, unverified: 0 }
  for (const a of atoms) stats[a.difference]++
  return {
    module: 'test',
    atom_count: atoms.length,
    difference_stats: Object.assign({ unmarked_v1: 0 }, stats),
    stages: [{ id: 'ST-T01', name: '测试阶段', chapter: '测试' }],
    features: [{ id: 'FP-T-001', name: '测试功能', stage_id: 'ST-T01', stage_name: '测试阶段', atoms }],
  }
}
const synthScope = (entries) => {
  const stats = { active: 0, conditional: 0, unknown: 0, inactive: 0 }
  for (const e of entries) stats[e.applicability]++
  return { schemaVersion: 1, scopeTarget: { game: 't', roomType: 'friend', gameId: '0' }, stats, entries }
}
const synthEvidence = (entries) => ({ schemaVersion: 1, entries })
const synthReview = (entries, extra) => Object.assign({ schemaVersion: 1, entries }, extra || {})
const runData = (base, scope, evidence, review) => classifyL7({ featureIndex: base, scopeIndex: scope, serverEvidence: evidence, differenceReview: review })
const expectFail = (r, keyword) => {
  assert.equal(r.ok, false, '应失败（' + keyword + '）')
  assert.ok(r.problems.some((p) => p.includes(keyword)), '应命中问题：' + keyword + '，实际：' + r.problems.join(' | '))
}

// ============================================================
// B. 矩阵 4×4 全枚举（scope-index Atom 级路径）
// ============================================================
{
  const EXPECT = {
    consistent: { active: 'verified', conditional: 'verification_required', unknown: 'verification_required', inactive: 'not_applicable' },
    partial: { active: 'verification_required', conditional: 'verification_required', unknown: 'verification_required', inactive: 'not_applicable' },
    unverified: { active: 'verification_required', conditional: 'verification_required', unknown: 'verification_required', inactive: 'not_applicable' },
  }
  const atoms = []
  const scopeEntries = []
  const reviewEntries = []
  const cells = []
  let n = 0
  for (const diff of ['consistent', 'partial', 'conflict', 'unverified']) {
    for (const sc of ['active', 'conditional', 'unknown', 'inactive']) {
      n++
      const id = 'AT-T-M' + String(n).padStart(2, '0')
      atoms.push({ id, difference: 'unverified' })
      scopeEntries.push({ atomId: id, applicability: sc })
      reviewEntries.push({ atomId: id, previousDifference: 'unverified', reviewedDifference: diff, reviewStatus: 'pending', evidenceIds: [] })
      cells.push({ id, diff, sc })
    }
  }
  const r = runData(synthBase(atoms), synthScope(scopeEntries), synthEvidence([]), synthReview(reviewEntries))
  assert.equal(r.ok, true, '矩阵枚举应通过：' + (r.problems || []).join(' | '))
  assert.equal(r.output.entries.length, 16)
  for (const c of cells) {
    const e = r.output.entries.find((x) => x.atomId === c.id)
    if (c.diff === 'conflict' && c.sc === 'inactive') {
      // 3.3：conflict×inactive 仅限证据级确认；Atom 级 inactive 无 evidenceScopes 不可消除冲突
      assert.equal(e.scopeApplicability, 'unknown', c.id + ' 应降 unknown')
      assert.equal(e.scopeSource, 'scope-index-atom-inactive-unconfirmed')
      assert.equal(e.l7, 'decision_required', c.id + ' 冲突不得被消除')
      assert.ok(e.scopeNote)
    } else {
      assert.equal(e.scopeApplicability, c.sc, c.id + ' scope 应为 ' + c.sc)
      assert.equal(e.scopeSource, 'scope-index-atom', c.id + ' scope 来源应为 scope-index')
      if (c.diff === 'conflict') {
        assert.equal(e.l7, 'decision_required', c.id + ' conflict 不降级')
      } else {
        assert.equal(e.l7, EXPECT[c.diff][c.sc], c.id + '（' + c.diff + '×' + c.sc + '）')
      }
    }
  }
  // 分布自检：16 格中 verified 1 / not_applicable 3 / decision_required 4 / verification_required 8
  assert.deepEqual(r.summary.l7, { verified: 1, verification_required: 8, decision_required: 4, not_applicable: 3 })

  // consistent×inactive（review-field 直填）→ not_applicable；非冲突条目不受 evidenceScopes 影响
  const r2 = runData(
    synthBase([{ id: 'AT-T-021', difference: 'unverified' }]),
    synthScope([{ atomId: 'AT-T-021', applicability: 'active', evidenceScopes: [{ ref: 'SVE-T-021', applicability: 'inactive' }] }]),
    synthEvidence([{ id: 'SVE-T-021', atomId: 'AT-T-021' }]),
    synthReview([{ atomId: 'AT-T-021', previousDifference: 'unverified', reviewedDifference: 'consistent', reviewStatus: 'pending', evidenceIds: ['SVE-T-021'], scopeApplicability: 'inactive' }])
  )
  assert.equal(r2.ok, true)
  assert.equal(r2.output.entries[0].l7, 'not_applicable') // 非冲突：inactive 即不适用（review-field 路径）
  assert.equal(r2.output.entries[0].scopeSource, 'review-field')

  const r3 = runData(
    synthBase([{ id: 'AT-T-022', difference: 'unverified' }]),
    synthScope([{ atomId: 'AT-T-022', applicability: 'active', evidenceScopes: [{ ref: 'SVE-T-022', applicability: 'inactive' }] }]),
    synthEvidence([{ id: 'SVE-T-022', atomId: 'AT-T-022' }]),
    synthReview([{ atomId: 'AT-T-022', previousDifference: 'unverified', reviewedDifference: 'consistent', reviewStatus: 'pending', evidenceIds: ['SVE-T-022'] }])
  )
  assert.equal(r3.ok, true)
  assert.equal(r3.output.entries[0].l7, 'verified') // 非冲突条目不受 evidenceScopes 影响（Atom 级 active 生效）
}

// ============================================================
// C. 缺失作用域 → 一律 unknown（缺失不缺省 inactive）
// ============================================================
{
  // 无 scopeApplicability + 无 scope-index 条目
  const r = runData(
    synthBase([{ id: 'AT-T-031', difference: 'unverified' }, { id: 'AT-T-032', difference: 'unverified' }]),
    synthScope([]),
    synthEvidence([]),
    synthReview([
      { atomId: 'AT-T-031', previousDifference: 'unverified', reviewedDifference: 'unverified', reviewStatus: 'pending', evidenceIds: [] },
      { atomId: 'AT-T-032', previousDifference: 'unverified', reviewedDifference: 'conflict', reviewStatus: 'pending', evidenceIds: [] },
    ])
  )
  assert.equal(r.ok, true)
  const e1 = r.output.entries.find((e) => e.atomId === 'AT-T-031')
  const e2 = r.output.entries.find((e) => e.atomId === 'AT-T-032')
  assert.equal(e1.scopeApplicability, 'unknown')
  assert.equal(e1.scopeSource, 'missing-unknown')
  assert.equal(e1.l7, 'verification_required') // unverified × unknown
  assert.equal(e2.scopeApplicability, 'unknown')
  assert.equal(e2.scopeSource, 'missing-unknown')
  assert.equal(e2.l7, 'decision_required') // conflict 缺 scope 不降级、不判 not_applicable

  // 无 scopeApplicability 但 scope-index 有条目 → 用 Atom 级 applicability
  const r2 = runData(
    synthBase([{ id: 'AT-T-033', difference: 'unverified' }]),
    synthScope([{ atomId: 'AT-T-033', applicability: 'conditional' }]),
    synthEvidence([]),
    synthReview([{ atomId: 'AT-T-033', previousDifference: 'unverified', reviewedDifference: 'unverified', reviewStatus: 'pending', evidenceIds: [] }])
  )
  assert.equal(r2.ok, true)
  assert.equal(r2.output.entries[0].scopeApplicability, 'conditional')
  assert.equal(r2.output.entries[0].scopeSource, 'scope-index-atom')
}

// ============================================================
// D. conflict 证据级 scope（3.3）
// ============================================================
{
  const mk = (scopeEntry, reviewScope) =>
    runData(
      synthBase([{ id: 'AT-T-041', difference: 'conflict' }]),
      synthScope([scopeEntry]),
      synthEvidence([{ id: 'SVE-T-041', atomId: 'AT-T-041' }, { id: 'SVE-T-042', atomId: 'AT-T-041' }]),
      synthReview([{ atomId: 'AT-T-041', previousDifference: 'conflict', reviewedDifference: 'conflict', reviewStatus: 'pending', evidenceIds: ['SVE-T-041'], scopeApplicability: reviewScope }])
    )
  // D1：client-visual 优先，其他证据 inactive 也不覆盖
  const d1 = mk({ atomId: 'AT-T-041', applicability: 'unknown', evidenceScopes: [{ ref: 'SVE-T-041', applicability: 'inactive' }, { ref: 'client-visual', applicability: 'active' }] }, undefined)
  assert.equal(d1.ok, true)
  assert.equal(d1.output.entries[0].scopeApplicability, 'active')
  assert.equal(d1.output.entries[0].scopeSource, 'evidence-level-client-visual')
  assert.equal(d1.output.entries[0].l7, 'decision_required')
  // D2：全部证据 inactive → not_applicable（唯一可消除冲突的路径）
  const d2 = mk({ atomId: 'AT-T-041', applicability: 'unknown', evidenceScopes: [{ ref: 'SVE-T-041', applicability: 'inactive' }, { ref: 'SVE-T-042', applicability: 'inactive' }] }, undefined)
  assert.equal(d2.ok, true)
  assert.equal(d2.output.entries[0].scopeApplicability, 'inactive')
  assert.equal(d2.output.entries[0].scopeSource, 'evidence-level-all-inactive')
  assert.equal(d2.output.entries[0].l7, 'not_applicable')
  // D3：无 client-visual，存在 conditional 证据 → 不降级
  const d3 = mk({ atomId: 'AT-T-041', applicability: 'unknown', evidenceScopes: [{ ref: 'SVE-T-041', applicability: 'conditional' }] }, undefined)
  assert.equal(d3.ok, true)
  assert.equal(d3.output.entries[0].scopeApplicability, 'conditional')
  assert.equal(d3.output.entries[0].scopeSource, 'evidence-level-no-elimination')
  assert.equal(d3.output.entries[0].l7, 'decision_required')
  // D4：无 client-visual，存在 active 证据 → 不降级
  const d4 = mk({ atomId: 'AT-T-041', applicability: 'unknown', evidenceScopes: [{ ref: 'SVE-T-041', applicability: 'active' }] }, undefined)
  assert.equal(d4.ok, true)
  assert.equal(d4.output.entries[0].scopeApplicability, 'active')
  assert.equal(d4.output.entries[0].l7, 'decision_required')
  // D5：无 evidenceScopes，review 直填 inactive → 不可确认，降 unknown 不消除冲突
  const d5 = mk({ atomId: 'AT-T-041', applicability: 'unknown' }, 'inactive')
  assert.equal(d5.ok, true)
  assert.equal(d5.output.entries[0].scopeApplicability, 'unknown')
  assert.equal(d5.output.entries[0].scopeSource, 'review-field-inactive-unconfirmed')
  assert.equal(d5.output.entries[0].l7, 'decision_required')
}

// ============================================================
// E. approved / rejected 条目
// ============================================================
{
  const base = synthBase([
    { id: 'AT-T-051', difference: 'unverified' },
    { id: 'AT-T-052', difference: 'unverified' },
  ])
  const scope = synthScope([
    { atomId: 'AT-T-051', applicability: 'active' },
    { atomId: 'AT-T-052', applicability: 'active' },
  ])
  const evidence = synthEvidence([])
  const review = synthReview(
    [
      { atomId: 'AT-T-051', previousDifference: 'unverified', reviewedDifference: 'consistent', reviewStatus: 'approved', evidenceIds: [], scopeApplicability: 'active' },
      { atomId: 'AT-T-052', previousDifference: 'unverified', reviewedDifference: 'consistent', reviewStatus: 'rejected', evidenceIds: [], scopeApplicability: 'active' },
    ],
    {
      afterReviewProjection: {
        // 假设全部 approved 的确定性迁移：两条 unverified→consistent → consistent 2 / unverified 0
        consistent: 2,
        partial: 0,
        conflict: 0,
        unverified: 0,
        total: 2,
        transitions: [{ atomId: 'AT-T-051', from: 'unverified', to: 'consistent' }, { atomId: 'AT-T-052', from: 'unverified', to: 'consistent' }],
      },
    }
  )
  const r = runData(base, scope, evidence, review)
  assert.equal(r.ok, true, 'approved/rejected 场景应通过：' + (r.problems || []).join(' | '))
  const e1 = r.output.entries.find((e) => e.atomId === 'AT-T-051')
  const e2 = r.output.entries.find((e) => e.atomId === 'AT-T-052')
  // approved：生效结论取 reviewedDifference，l7 进正式索引
  assert.equal(e1.effectiveDifference, 'consistent')
  assert.equal(e1.l7Basis, 'approved')
  assert.equal(e1.l7, 'verified')
  // rejected：生效结论回退 previousDifference；l7 保留矩阵结果仅作追溯，不入 l7Approved
  assert.equal(e2.effectiveDifference, 'unverified')
  assert.equal(e2.l7Basis, 'rejected')
  assert.equal(e2.l7, 'verified')
  assert.deepEqual(r.summary.l7Approved, { verified: 1, verification_required: 0, decision_required: 0, not_applicable: 0 })
  assert.deepEqual(r.summary.reviewStatus, { pending: 0, approved: 1, rejected: 1 })
  assert.deepEqual(r.summary.effectiveDifference, { consistent: 1, partial: 0, conflict: 0, unverified: 1 })
}

// ============================================================
// F. 完整性校验失败路径
// ============================================================
{
  const defaultData = () => ({
    featureIndex: synthBase([{ id: 'AT-T-001', difference: 'unverified' }]),
    scopeIndex: synthScope([{ atomId: 'AT-T-001', applicability: 'active' }]),
    serverEvidence: synthEvidence([{ id: 'SVE-T-001', atomId: 'AT-T-001' }]),
    differenceReview: synthReview([{ atomId: 'AT-T-001', previousDifference: 'unverified', reviewedDifference: 'unverified', reviewStatus: 'pending', evidenceIds: ['SVE-T-001'], scopeApplicability: 'active' }]),
  })
  const clone = (d) => JSON.parse(JSON.stringify(d))
  const run = (d) => classifyL7(d)
  const withEntry = (d, patch) => {
    const c = clone(d)
    Object.assign(c.differenceReview.entries[0], patch)
    return run(c)
  }

  // atomId 不在基线
  {
    const d = clone(defaultData())
    d.differenceReview.entries[0].atomId = 'AT-T-999'
    expectFail(run(d), 'atomId 不在基线')
  }
  // previousDifference 与基线漂移
  expectFail(withEntry(defaultData(), { previousDifference: 'consistent' }), 'previousDifference 与基线漂移')
  // evidenceIds 不在 server-evidence
  expectFail(withEntry(defaultData(), { evidenceIds: ['SVE-T-999'] }), 'evidenceIds 不在 server-evidence')
  // 枚举非法
  expectFail(withEntry(defaultData(), { reviewedDifference: 'maybe' }), 'reviewedDifference 缺失或非法')
  expectFail(withEntry(defaultData(), { reviewStatus: 'done' }), 'reviewStatus 缺失或非法')
  expectFail(withEntry(defaultData(), { scopeApplicability: 'sometimes' }), 'scopeApplicability 非法')
  // 复核条目 atomId 重复
  {
    const d = clone(defaultData())
    d.featureIndex = synthBase([{ id: 'AT-T-001', difference: 'unverified' }, { id: 'AT-T-002', difference: 'unverified' }])
    d.differenceReview.entries.push(JSON.parse(JSON.stringify(d.differenceReview.entries[0])))
    expectFail(run(d), '复核条目 atomId 重复')
  }
  // 手写字段与重算不符
  expectFail(withEntry(defaultData(), { l7: 'verified' }), 'l7 与矩阵重算不一致')
  expectFail(withEntry(defaultData(), { effectiveDifference: 'consistent' }), 'effectiveDifference 与重算不一致')
  expectFail(withEntry(defaultData(), { l7Basis: 'approved' }), 'l7Basis 与重算不一致')
  // 顶层统计块漂移
  {
    const d = clone(defaultData())
    d.differenceReview.baseline = { differenceStats: { consistent: 9, partial: 0, conflict: 0, unverified: 1 } }
    expectFail(run(d), 'baseline.differenceStats 与基线重算不一致')
  }
  {
    const d = clone(defaultData())
    d.differenceReview.afterReviewProjection = { consistent: 1, partial: 0, conflict: 0, unverified: 0, total: 1, transitions: [] }
    expectFail(run(d), 'afterReviewProjection 与确定性迁移重算不一致')
  }
  {
    const d = clone(defaultData())
    d.differenceReview.l7Projection = { verified: 1, verification_required: 0, decision_required: 0, not_applicable: 0 }
    expectFail(run(d), 'l7Projection 与矩阵重算不一致')
  }
  {
    const d = clone(defaultData())
    d.scopeIndex.stats.active = 9
    expectFail(run(d), 'scope-index.stats 与条目重算不一致')
  }
  {
    const d = clone(defaultData())
    d.featureIndex.difference_stats.consistent = 9
    expectFail(run(d), 'difference_stats 与原子重算不一致')
  }
  {
    const d = clone(defaultData())
    d.featureIndex.atom_count = 5
    expectFail(run(d), 'atom_count 自洽失败')
  }
  // 基线原子缺 difference
  {
    const d = clone(defaultData())
    delete d.featureIndex.features[0].atoms[0].difference
    expectFail(run(d), 'difference 缺失或非法')
  }
  // evidenceScopes ref 不在 server-evidence
  {
    const d = clone(defaultData())
    d.scopeIndex.entries[0].evidenceScopes = [{ ref: 'SVE-T-888', applicability: 'active' }]
    expectFail(run(d), 'evidenceScopes ref 不在 server-evidence')
  }
  // SVE / scope 的 atomId 不在基线
  {
    const d = clone(defaultData())
    d.serverEvidence.entries[0].atomId = 'AT-T-999'
    expectFail(run(d), 'server-evidence atomId 不在基线')
  }
  {
    const d = clone(defaultData())
    d.scopeIndex.entries[0].atomId = 'AT-T-999'
    expectFail(run(d), 'scope-index atomId 不在基线')
  }
  // scope applicability 非法
  {
    const d = clone(defaultData())
    d.scopeIndex.entries[0].applicability = 'sometimes'
    expectFail(run(d), 'scope-index applicability 缺失或非法')
  }
  // 输入四件套缺失
  {
    const d = defaultData()
    expectFail(classifyL7({ featureIndex: d.featureIndex, scopeIndex: d.scopeIndex, serverEvidence: d.serverEvidence }), '输入四件套缺失')
  }
}

// ============================================================
// G. CLI 失败路径
// ============================================================
{
  fs.rmSync(TMP, { recursive: true, force: true })
  fs.mkdirSync(TMP, { recursive: true })

  // 参数缺失
  const rUsage = runCli([])
  assert.equal(rUsage.code, 1)
  assert.ok(rUsage.out.includes('用法'))

  // 输入文件不存在
  const rMissing = runCli([
    path.join(BASE_DIR, 'feature_index.json'),
    path.join(SAMPLE_DIR, 'scope-index_sample.json'),
    path.join(SAMPLE_DIR, 'server-evidence_sample.json'),
    path.join(TMP, 'not-exist.json'),
    path.join(TMP, 'out.json'),
    '2026-11-14',
  ])
  assert.equal(rMissing.code, 1)
  assert.ok(rMissing.out.includes('读取失败'))

  // 完整性失败 → 退出码 1 且不写输出
  const badReview = {
    schemaVersion: 1,
    entries: [{ atomId: 'AT-T-001', previousDifference: 'unverified', reviewedDifference: 'unverified', reviewStatus: 'pending', evidenceIds: [], scopeApplicability: 'active', l7: 'verified' }],
  }
  const badBase = synthBase([{ id: 'AT-T-001', difference: 'unverified' }])
  const badScope = synthScope([{ atomId: 'AT-T-001', applicability: 'active' }])
  const badEvidence = synthEvidence([])
  fs.writeFileSync(path.join(TMP, 'base.json'), JSON.stringify(badBase), 'utf8')
  fs.writeFileSync(path.join(TMP, 'scope.json'), JSON.stringify(badScope), 'utf8')
  fs.writeFileSync(path.join(TMP, 'evidence.json'), JSON.stringify(badEvidence), 'utf8')
  fs.writeFileSync(path.join(TMP, 'review.json'), JSON.stringify(badReview), 'utf8')
  const outPath = path.join(TMP, 'should-not-exist.json')
  const rBad = runCli([path.join(TMP, 'base.json'), path.join(TMP, 'scope.json'), path.join(TMP, 'evidence.json'), path.join(TMP, 'review.json'), outPath, '2026-11-14'])
  assert.equal(rBad.code, 1)
  assert.ok(rBad.out.includes('l7 与矩阵重算不一致'))
  assert.equal(fs.existsSync(outPath), false, '完整性失败时不得写输出')

  fs.rmSync(TMP, { recursive: true, force: true })
}

console.log('[成功] classify-l7.example 全部断言通过（真实样本重跑分布一致/矩阵4x4全枚举/缺失作用域一律unknown/conflict证据级scope/approved与rejected/完整性校验失败路径/CLI失败路径）')
