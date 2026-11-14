// merge-verify-output.mjs（OSG-W4 S2.3）
//
// 职责：server-rule-verify workflow 的确定性装配闸门——
//   读 <outDir>/runtime/verify-output/*.json（agent 落判分片）与
//      <outDir>/runtime/review-output/*.json（agent 复核建议分片，可选），
//   校验后合并进正式产物 <outDir>/scope-index.json / server-evidence.json /
//   difference-review.json（upsert，stats/统计块确定性重算），再调
//   classifyL7 矩阵回填 DR 条目 l7/effectiveDifference/l7Basis。
//
// 校验闸门（任一命中 fail，不写产物）：
//   1. 落判条目：atomId 在基线且其基线阶段属目标范围；applicability 枚举合法；
//      已处理阶段原子全覆盖（每原子恰一条，缺/重皆 fail）
//   2. 双写闸门（S2.1 经验：scope 优先级 复核字段 > scope-index Atom 级）：
//      落判条目 dr.scopeApplicability 必须等于 applicability
//      （既有条目带 evidenceScopes 的 conflict 证据级原子除外——
//        evidenceScopes 优先于复核字段，见设计 3.3）
//   3. SVE：本轮 id 不重复；形状完备（atomId 在基线 / layer 枚举 / file 以 layer 目录
//      前缀开头 / location = file:行号 / symbol / excerpt / configKeys）；
//      与正式既有同 id 同原子 = 幂等重跑或摘录更新（原位替换放行），
//      同 id 跨原子 fail（id 劫持）
//   4. evidenceIds ⊆ 正式既有 + 本轮提交 SVE id；evidenceScopes.ref
//      ∈ SVE id ∪ { client-visual } 且 applicability 枚举合法
//   5. 复核建议：atomId 属已处理原子；reviewedDifference 枚举；
//      reviewRule 前缀白名单（no-server-evidence-is-not-conflict /
//      evidence-is-not-consistency / common-capability-is-not-enabled /
//      ui-conflict-stands-alone）
//   6. 装配后整体经 classifyL7（矩阵/漂移/统计块/evidenceIds 全量复核）
//
// reviewStatus 保全规则（确定性）：
//   - 新条目一律 pending；既有条目本轮无新建议 → 保持原 reviewStatus 与结论
//   - 既有条目本轮建议与原结论一致（reviewedDifference/reviewRule 同）→ 保持 reviewStatus
//   - 既有条目本轮建议变化 → 更新结论并重置 pending（新建议需人工重新批准）
//
// 可导入：export mergeVerifyOutput({ featureIndexPath, outDir, date, stageIds })
//   返回 { ok, problems, summary }，不退进程。
//
// CLI：node merge-verify-output.mjs <featureIndexPath> <outDir> <date> [stageIdsCsv|ALL]
//   退出码 0 成功 / 1 失败。
//
// 约定：date 经参数传入；JSON 输出 1 空格缩进 UTF-8 LF；DR 条目的
//   l7/effectiveDifference/l7Basis 与三个统计块永远由本脚本重算，禁止手工填写。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { classifyL7 } from './classify-l7.mjs'

const SCOPE_VALUES = ['active', 'conditional', 'unknown', 'inactive']
const DIFF_VALUES = ['consistent', 'partial', 'conflict', 'unverified']
const LAYER_DIRS = ['common_game', 'hzmj_server', 'mah_frame']
const REVIEW_RULE_PREFIXES = [
  'no-server-evidence-is-not-conflict',
  'evidence-is-not-consistency',
  'common-capability-is-not-enabled',
  'ui-conflict-stands-alone',
]

const readJsonOrNull = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

const isScope = (v) => SCOPE_VALUES.includes(v)
const isDiff = (v) => DIFF_VALUES.includes(v)

export function mergeVerifyOutput(input) {
  const problems = []
  const bad = (m) => problems.push(m)
  const I = input || {}
  const featureIndexPath = I.featureIndexPath || ''
  const outDir = I.outDir || ''
  const date = I.date || ''
  const stageIdsCsv = I.stageIds || 'ALL'
  if (!featureIndexPath) bad('featureIndexPath 缺失')
  if (!outDir) bad('outDir 缺失')
  if (problems.length > 0) return { ok: false, problems: problems, summary: null }

  const featureIndex = readJsonOrNull(featureIndexPath)
  if (!featureIndex) {
    bad('feature_index 读取/解析失败：' + featureIndexPath)
    return { ok: false, problems: problems, summary: null }
  }

  // 基线原子表 + 各阶段原子集
  const atomMap = new Map()
  const stageAtoms = new Map()
  for (const fe of featureIndex.features || []) {
    for (const at of fe.atoms || []) {
      atomMap.set(at.id, { difference: at.difference, stageId: fe.stage_id })
      if (!stageAtoms.has(fe.stage_id)) stageAtoms.set(fe.stage_id, new Set())
      stageAtoms.get(fe.stage_id).add(at.id)
    }
  }
  if (atomMap.size === 0) {
    bad('基线无原子')
    return { ok: false, problems: problems, summary: null }
  }
  const wantAll = stageIdsCsv.trim().toUpperCase() === 'ALL'
  const targetSet = new Set(
    wantAll ? [...stageAtoms.keys()] : stageIdsCsv.split(',').map((s) => s.trim()).filter(Boolean)
  )

  // ---------- 1. 读落判分片 ----------
  const verifyDir = path.join(outDir, 'runtime', 'verify-output')
  const verifyFiles = fs.existsSync(verifyDir)
    ? fs.readdirSync(verifyDir).filter((f) => f.endsWith('.json')).sort()
    : []
  if (verifyFiles.length === 0) {
    bad('verify-output 目录无落判分片：' + verifyDir)
    return { ok: false, problems: problems, summary: null }
  }
  const judgeByAtom = new Map()
  const sveNew = []
  const processedStages = new Set()
  for (const file of verifyFiles) {
    const doc = readJsonOrNull(path.join(verifyDir, file))
    if (!doc || !Array.isArray(doc.entries)) {
      bad('落判分片非法（缺 entries）：' + file)
      continue
    }
    for (const e of doc.entries) {
      if (!e || !atomMap.has(e.atomId)) {
        bad('落判条目 atomId 不在基线：' + file + ' -> ' + (e && e.atomId))
        continue
      }
      if (judgeByAtom.has(e.atomId)) {
        bad('落判条目 atomId 重复：' + e.atomId)
        continue
      }
      const base = atomMap.get(e.atomId)
      if (!targetSet.has(base.stageId)) {
        bad('落判条目原子阶段不在目标范围：' + e.atomId + ' -> ' + base.stageId)
        continue
      }
      if (!isScope(e.applicability)) {
        bad('落判条目 applicability 非法：' + e.atomId + ' -> ' + e.applicability)
        continue
      }
      if (!e.dr || !isScope(e.dr.scopeApplicability)) {
        bad('落判条目 dr.scopeApplicability 缺失或非法：' + e.atomId)
        continue
      }
      processedStages.add(base.stageId)
      judgeByAtom.set(e.atomId, e)
      for (const s of Array.isArray(e.sve) ? e.sve : []) sveNew.push(s)
    }
  }

  // 已处理阶段原子全覆盖
  for (const stageId of processedStages) {
    for (const id of stageAtoms.get(stageId) || []) {
      if (!judgeByAtom.has(id)) bad('阶段原子缺落判条目：' + stageId + ' / ' + id)
    }
  }

  // ---------- 2. 读复核建议分片（可选） ----------
  const reviewDir = path.join(outDir, 'runtime', 'review-output')
  const reviewFiles = fs.existsSync(reviewDir)
    ? fs.readdirSync(reviewDir).filter((f) => f.endsWith('.json')).sort()
    : []
  const suggestByAtom = new Map()
  for (const file of reviewFiles) {
    const doc = readJsonOrNull(path.join(reviewDir, file))
    if (!doc || !Array.isArray(doc.entries)) {
      bad('复核建议分片非法（缺 entries）：' + file)
      continue
    }
    for (const e of doc.entries) {
      if (!e || !judgeByAtom.has(e.atomId)) {
        bad('复核建议 atomId 不在已处理原子：' + file + ' -> ' + (e && e.atomId))
        continue
      }
      if (!isDiff(e.reviewedDifference)) {
        bad('复核建议 reviewedDifference 非法：' + e.atomId + ' -> ' + e.reviewedDifference)
        continue
      }
      if (
        e.reviewRule !== undefined &&
        !REVIEW_RULE_PREFIXES.some((p) => String(e.reviewRule).startsWith(p))
      ) {
        bad('复核建议 reviewRule 前缀不在白名单：' + e.atomId + ' -> ' + e.reviewRule)
        continue
      }
      if (suggestByAtom.has(e.atomId)) {
        bad('复核建议 atomId 重复：' + e.atomId)
        continue
      }
      suggestByAtom.set(e.atomId, e)
    }
  }

  // ---------- 3. 既有正式产物骨架 ----------
  const sampleScope = readJsonOrNull(path.join(outDir, 'scope-index_sample.json'))
  const sampleSve = readJsonOrNull(path.join(outDir, 'server-evidence_sample.json'))
  const formalScopePath = path.join(outDir, 'scope-index.json')
  const formalSvePath = path.join(outDir, 'server-evidence.json')
  const formalDrPath = path.join(outDir, 'difference-review.json')
  let scopeIndex = readJsonOrNull(formalScopePath)
  let serverEvidence = readJsonOrNull(formalSvePath)
  let differenceReview = readJsonOrNull(formalDrPath)
  if (!scopeIndex) {
    scopeIndex = {
      schemaVersion: 1,
      sampleNote:
        'OSG-W4 正式产物：server-rule-verify workflow 生成（人工样本见 scope-index_sample.json）。stats 由 merge-verify-output.mjs 重算，禁止手工填写；判定规则见 dev-docs/design/2026-11-14-OSG-W4-L7分类与玩法配置作用域设计.md',
      scopeTarget: (sampleScope && sampleScope.scopeTarget) || { game: 'hzmj', roomType: 'friend', gameId: 42320 },
      stats: { active: 0, conditional: 0, unknown: 0, inactive: 0 },
      entries: [],
    }
  }
  if (!serverEvidence) {
    serverEvidence = {
      schemaVersion: 1,
      sampleNote: 'OSG-W4 正式产物：server-rule-verify workflow 生成（人工样本见 server-evidence_sample.json）',
      sourceRepos: (sampleSve && sampleSve.sourceRepos) || [
        { path: 'E:/WorkProjects/xc-flow/.xflow/xc/xcodeDev/game-mahjong/server/Logic/mahjong_server', role: '服务端源码（只读）' },
      ],
      entries: [],
    }
  }
  if (!differenceReview) {
    differenceReview = {
      schemaVersion: 1,
      sampleNote:
        'OSG-W4 正式产物：server-rule-verify workflow 生成（人工样本见 difference-review_sample.json）。baseline / afterReviewProjection / l7Projection 与条目 l7/effectiveDifference/l7Basis 由 merge-verify-output.mjs 确定性重算，禁止手工填写',
      baseline: { indexPath: '', differenceStats: { consistent: 0, partial: 0, conflict: 0, unverified: 0 } },
      afterReviewProjection: {},
      l7Projection: {},
      entries: [],
    }
  }

  // ---------- 4. SVE 校验（同 id 同原子为幂等重跑/摘录更新放行，跨原子 fail） ----------
  const formalSveIds = new Set((serverEvidence.entries || []).map((e) => e.id))
  const sveNewIds = new Set()
  for (const s of sveNew) {
    if (!s || !s.id) {
      bad('落判分片 SVE 缺 id')
      continue
    }
    if (sveNewIds.has(s.id)) {
      bad('本轮 SVE id 重复：' + s.id)
      continue
    }
    if (!atomMap.has(s.atomId)) {
      bad('SVE atomId 不在基线：' + s.id + ' -> ' + s.atomId)
      continue
    }
    if (!LAYER_DIRS.includes(s.layer)) {
      bad('SVE layer 非法：' + s.id + ' -> ' + s.layer)
      continue
    }
    if (typeof s.file !== 'string' || !s.file.startsWith(s.layer + '/')) {
      bad('SVE file 与 layer 前缀不符：' + s.id + ' -> ' + s.file)
      continue
    }
    if (typeof s.location !== 'string' || !s.location.startsWith(s.file + ':')) {
      bad('SVE location 与 file 不一致：' + s.id + ' -> ' + s.location)
      continue
    }
    if (!s.symbol || !s.excerpt) {
      bad('SVE symbol/excerpt 缺失：' + s.id)
      continue
    }
    if (!Array.isArray(s.configKeys)) {
      bad('SVE configKeys 非数组：' + s.id)
      continue
    }
    if (formalSveIds.has(s.id)) {
      const existingFormal = (serverEvidence.entries || []).find((e) => e.id === s.id)
      if (existingFormal && existingFormal.atomId !== s.atomId) {
        bad('SVE id 与正式既有冲突且 atomId 不同：' + s.id)
        continue
      }
      // 同 id 同原子：幂等重跑或摘录更新（以落判版为准，step 8 原位替换）
    }
    sveNewIds.add(s.id)
  }
  const allSveIds = new Set([...formalSveIds, ...sveNewIds])
  const newSveCount = [...sveNewIds].filter((id) => !formalSveIds.has(id)).length

  // ---------- 5. scope 条目校验 + upsert ----------
  const scopeByAtom = new Map((scopeIndex.entries || []).map((e) => [e.atomId, e]))
  const judgeScopes = new Map()
  let newScopeCount = 0
  let replacedScopeCount = 0
  for (const [atomId, e] of judgeByAtom) {
    for (const id of Array.isArray(e.evidenceIds) ? e.evidenceIds : []) {
      if (!allSveIds.has(id)) bad('落判条目 evidenceIds 不在 server-evidence：' + atomId + ' -> ' + id)
    }
    const evidenceScopes = Array.isArray(e.evidenceScopes) ? e.evidenceScopes : []
    for (const es of evidenceScopes) {
      if (!es || !es.ref || (es.ref !== 'client-visual' && !allSveIds.has(es.ref))) {
        bad('落判条目 evidenceScopes.ref 非法：' + atomId + ' -> ' + (es && es.ref))
      } else if (!isScope(es.applicability)) {
        bad('落判条目 evidenceScopes.applicability 非法：' + atomId + ' / ' + es.ref)
      }
    }
    const existing = scopeByAtom.get(atomId)
    const existingHasEvidenceScopes =
      existing && Array.isArray(existing.evidenceScopes) && existing.evidenceScopes.length > 0
    const finalScopes =
      evidenceScopes.length > 0 ? evidenceScopes : existingHasEvidenceScopes ? existing.evidenceScopes : []
    const scopeEntryHasEvidenceScopes = finalScopes.length > 0
    if (!scopeEntryHasEvidenceScopes && e.dr.scopeApplicability !== e.applicability) {
      bad(
        '双写闸门：dr.scopeApplicability 与 applicability 不一致：' +
          atomId +
          ' dr=' +
          e.dr.scopeApplicability +
          ' atom=' +
          e.applicability
      )
    }
    const merged = {
      atomId: atomId,
      applicability: e.applicability,
      configVerified: e.configVerified === true,
      callPathVerified: e.callPathVerified === true,
      configCondition: e.configCondition || '',
      callPath: e.callPath || '',
      evidenceIds: Array.isArray(e.evidenceIds) ? e.evidenceIds : [],
      unresolved: e.unresolved || '',
      noServerEvidence: e.noServerEvidence === true,
    }
    if (scopeEntryHasEvidenceScopes) merged.evidenceScopes = finalScopes
    if (existing) replacedScopeCount++
    else newScopeCount++
    judgeScopes.set(atomId, merged)
  }
  if (problems.length > 0) return { ok: false, problems: problems, summary: null }

  // scope 条目顺序：既有顺序在前，新增追加（upsert 原位替换）
  const scopeEntries = []
  const seen = new Set()
  for (const e of scopeIndex.entries || []) {
    if (judgeScopes.has(e.atomId)) {
      scopeEntries.push(judgeScopes.get(e.atomId))
      seen.add(e.atomId)
    } else {
      scopeEntries.push(e)
      seen.add(e.atomId)
    }
  }
  for (const [atomId, e] of judgeScopes) {
    if (!seen.has(atomId)) scopeEntries.push(e)
  }

  // ---------- 6. DR 条目装配（未处理原子保全 + reviewStatus 保全规则） ----------
  const drEntries = []
  for (const e of differenceReview.entries || []) {
    if (e && e.atomId && !judgeByAtom.has(e.atomId)) drEntries.push(e)
  }
  for (const atomId of [...judgeByAtom.keys()].sort()) {
    const e = judgeByAtom.get(atomId)
    const prev = atomMap.get(atomId).difference
    const suggestion = suggestByAtom.get(atomId) || null
    const existing = (differenceReview.entries || []).find((x) => x && x.atomId === atomId) || null
    let reviewedDifference
    let reviewReason
    let reviewRule
    let reviewStatus
    if (existing && !suggestion) {
      reviewedDifference = existing.reviewedDifference || prev
      reviewReason = existing.reviewReason
      reviewRule = existing.reviewRule
      reviewStatus = existing.reviewStatus || 'pending'
    } else if (existing && suggestion) {
      const sameConclusion =
        suggestion.reviewedDifference === existing.reviewedDifference &&
        (suggestion.reviewRule !== undefined ? suggestion.reviewRule : existing.reviewRule) === existing.reviewRule
      reviewedDifference = suggestion.reviewedDifference
      reviewReason = suggestion.reviewReason || existing.reviewReason
      reviewRule = suggestion.reviewRule !== undefined ? suggestion.reviewRule : existing.reviewRule
      reviewStatus = sameConclusion ? existing.reviewStatus || 'pending' : 'pending'
    } else if (suggestion) {
      reviewedDifference = suggestion.reviewedDifference
      reviewReason = suggestion.reviewReason || ''
      reviewRule = suggestion.reviewRule
      reviewStatus = 'pending'
    } else {
      reviewedDifference = prev
      reviewReason = '本轮未出复核建议，维持基线差异'
      reviewRule = undefined
      reviewStatus = 'pending'
    }
    const scopeEntry = judgeScopes.get(atomId)
    drEntries.push({
      atomId: atomId,
      previousDifference: prev,
      reviewedDifference: reviewedDifference,
      reviewReason: reviewReason,
      ...(reviewRule !== undefined ? { reviewRule: reviewRule } : {}),
      scopeApplicability: e.dr.scopeApplicability,
      ...(e.dr.scopeNote ? { scopeNote: e.dr.scopeNote } : {}),
      evidenceIds: scopeEntry ? scopeEntry.evidenceIds : [],
      reviewStatus: reviewStatus,
    })
  }
  // l7/effectiveDifference/l7Basis 永远重算：装配阶段一律不写，待 classifyL7 回填

  // ---------- 7. classifyL7 全量复核 + 矩阵回填 ----------
  const baselineStats = { consistent: 0, partial: 0, conflict: 0, unverified: 0 }
  for (const a of atomMap.values()) if (isDiff(a.difference)) baselineStats[a.difference]++

  // stats 与 SVE 先装配进内存对象（classifyL7 交叉校验需要自洽输入：
  // scope-index.stats 与条目重算一致、DR evidenceIds ⊆ server-evidence ids）
  const scopeStats = { active: 0, conditional: 0, unknown: 0, inactive: 0 }
  for (const e of scopeEntries) if (isScope(e.applicability)) scopeStats[e.applicability]++
  const assembledScope = Object.assign({}, scopeIndex, { entries: scopeEntries, stats: scopeStats })
  const sveEntriesFinal = [...(serverEvidence.entries || [])]
  for (const s of sveNew) {
    if (!s || !sveNewIds.has(s.id)) continue
    const idx = sveEntriesFinal.findIndex((e) => e.id === s.id)
    if (idx >= 0) {
      // 同 id 更新（幂等重跑/摘录更新，step 4 已校验同原子）：原位替换
      sveEntriesFinal[idx] = s
    } else {
      sveEntriesFinal.push(s)
    }
  }
  const assembledSve = Object.assign({}, serverEvidence, { entries: sveEntriesFinal })
  const assembledDr = Object.assign({}, differenceReview, {
    baseline: { indexPath: featureIndexPath, differenceStats: baselineStats },
    entries: drEntries,
    afterReviewProjection: {},
    l7Projection: {},
  })
  const r = classifyL7({
    featureIndex: featureIndex,
    scopeIndex: assembledScope,
    serverEvidence: assembledSve,
    differenceReview: assembledDr,
  })
  for (const p of r.problems) bad('classifyL7：' + p)
  if (problems.length > 0) return { ok: false, problems: problems, summary: null }

  const l7ByAtom = new Map(r.output.entries.map((x) => [x.atomId, x]))
  const transitions = []
  const drFinal = []
  for (const e of drEntries) {
    const c = l7ByAtom.get(e.atomId)
    if (!c) {
      bad('classifyL7 未覆盖 DR 条目：' + e.atomId)
      continue
    }
    if (e.reviewedDifference !== e.previousDifference) {
      transitions.push({ atomId: e.atomId, from: e.previousDifference, to: e.reviewedDifference })
    }
    drFinal.push({
      atomId: e.atomId,
      previousDifference: e.previousDifference,
      reviewedDifference: e.reviewedDifference,
      reviewReason: e.reviewReason,
      ...(e.reviewRule !== undefined ? { reviewRule: e.reviewRule } : {}),
      scopeApplicability: e.scopeApplicability,
      ...(e.scopeNote ? { scopeNote: e.scopeNote } : {}),
      evidenceIds: e.evidenceIds,
      l7: c.l7,
      reviewStatus: e.reviewStatus,
      effectiveDifference: c.effectiveDifference,
      l7Basis: c.l7Basis,
    })
  }
  if (problems.length > 0) return { ok: false, problems: problems, summary: null }

  const proj = Object.assign({}, baselineStats)
  for (const t of transitions) {
    proj[t.from]--
    proj[t.to]++
  }
  assembledDr.afterReviewProjection = {
    consistent: proj.consistent,
    partial: proj.partial,
    conflict: proj.conflict,
    unverified: proj.unverified,
    total: atomMap.size,
    computedBy:
      'previousDifference→reviewedDifference 确定性迁移（假设全部 approved），merge-verify-output.mjs 重算，禁止手工填写预测值',
    transitions: transitions,
  }
  assembledDr.l7Projection = Object.assign({}, r.summary.l7, {
    note: 'merge-verify-output.mjs 按 classifyL7 矩阵确定性重算（设计 4.1），禁止手工填写',
  })
  assembledDr.entries = drFinal

  // ---------- 8. sampleNote 记录 + 落盘 ----------
  const stageList = [...processedStages].sort().join(',')
  const runNote =
    '；run ' + (date || 'undated') + '：' + stageList + ' 落判 ' + judgeByAtom.size +
    ' 条（新增 ' + newScopeCount + ' / 替换 ' + replacedScopeCount + '，SVE 新增 ' + newSveCount + '）'
  assembledScope.sampleNote = (assembledScope.sampleNote || '') + runNote
  assembledSve.sampleNote = (assembledSve.sampleNote || '') + runNote
  assembledDr.sampleNote = (assembledDr.sampleNote || '') + runNote

  fs.writeFileSync(formalScopePath, JSON.stringify(assembledScope, null, 1) + '\n', 'utf8')
  fs.writeFileSync(formalSvePath, JSON.stringify(assembledSve, null, 1) + '\n', 'utf8')
  fs.writeFileSync(formalDrPath, JSON.stringify(assembledDr, null, 1) + '\n', 'utf8')

  const summary = {
    processedStages: stageList,
    judgeCount: judgeByAtom.size,
    scopeStats: scopeStats,
    newScopeEntries: newScopeCount,
    replacedScopeEntries: replacedScopeCount,
    sveTotal: sveEntriesFinal.length,
    newSve: newSveCount,
    drTotal: drFinal.length,
    l7: r.summary.l7,
    l7Approved: r.summary.l7Approved,
    paths: {
      scopeIndex: formalScopePath.replaceAll('\\', '/'),
      serverEvidence: formalSvePath.replaceAll('\\', '/'),
      differenceReview: formalDrPath.replaceAll('\\', '/'),
    },
  }
  return { ok: true, problems: problems, summary: summary }
}

// ============================================================
// CLI
// ============================================================

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2)
  if (argv.length < 3 || argv.length > 4) {
    console.error('用法：node merge-verify-output.mjs <featureIndexPath> <outDir> <date> [stageIdsCsv|ALL]')
    process.exit(1)
  }
  const r = mergeVerifyOutput({
    featureIndexPath: argv[0],
    outDir: argv[1],
    date: argv[2],
    stageIds: argv[3] || 'ALL',
  })
  if (!r.ok) {
    console.error('[失败] 落判合并未通过，共 ' + r.problems.length + ' 项问题（不写产物）：')
    for (const p of r.problems) console.error('  - ' + p)
    process.exit(1)
  }
  console.log('[成功] 落判合并完成：' + JSON.stringify(r.summary))
  process.exit(0)
}
