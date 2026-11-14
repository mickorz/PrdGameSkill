// assemble-output-spec-index.mjs —— 1-spec 索引装配器（确定性命令）
//
// output-spec-generate workflow 的配套脚本：读取 <specDir>/runtime/parts/ST-C*.json
// （每阶段一份原子拆分+代码查证结果片段），装配 feature_index.json 与 stage_manifest.md。
// 片段由 workflow 内 echo agent 逐字写入（脚本侧不做 LLM 转述，数据保真）。
//
// v2 业务语义透传（2026-11-14，需求 R4/R5，T3.4）：
//   - feature_index 顶层新增 schema_version: 2 与 difference_stats
//     （consistent/partial/conflict/unverified 计数，conflict 优先原则：单值字段直接按值计数）。
//   - 原子项透传新字段（camel 转 snake）：business_behavior{trigger,condition,action,result}、
//     difference、difference_detail、verification{business_rule_verified,unverified_reason,client_observed}。
//   - v1 旧片段（原子项无 difference/verification 字段）兼容：difference 按 unverified 计入
//     difference_stats 并计入 difference_unmarked（未经新 Schema 查证，不冒充已验证，
//     需求 6.4）；business_behavior 视为空对象。
//
// v3 复核合并模式（2026-11-14，OSG-W4 S3.3）：
//   - 子命令 `v3`：读取 v2 feature_index.json（只读，写前后 hash 校验不变）+
//     server-rule-verify 正式三件（scope-index.json / server-evidence.json /
//     difference-review.json），把 reviewStatus=approved 条目的复核结论合并进 v3 新目录。
//   - 合并语义：approved 条目 difference 采 reviewedDifference（effectiveDifference）；
//     pending/rejected 条目维持 v2 基线差异；未复核原子不动。
//   - 每个复核原子新增字段：difference_v2 / review_status / reviewed_difference /
//     review_rule / review_reason / l7（终局矩阵视图：scope × 终局 difference，经
//     classifyL7 合成终局 DR 重算）/ l7_basis（approved/rejected/baseline）/
//     scope_applicability / scope_source / evidence_ids。
//   - 闸门：classifyL7 全量交叉校验（基线漂移/evidenceIds/scope stats）；v3 差异统计
//     双路互验（基线-迁移调整 vs 逐原子重算）；DR baseline.differenceStats 与 v2 一致；
//     v3 输出目录不得等于 v2 目录（v2 只读）。
//
// 可导入：export assembleIndex(specDir, date, sourceDesc, expectedStageCount)
//         export assembleV3FromReview({ v2IndexPath, verifyDir, outDir, date })
//         均返回 { ok, problems, summary }，不直接退出进程
// CLI 用法：
//   node assemble-output-spec-index.mjs <specDir> <date> <sourceDesc> [expectedStageCount]
//   node assemble-output-spec-index.mjs v3 <v2SpecDir> <verifyDir> <outDir> <date>
//
// 行为：
//   - 解析全部片段，校验文件名与 stage.id 一致、stage/feature/atom ID 全局唯一
//   - expectedStageCount 给定时校验片段数一致（防上次运行残留片段混入）
//   - 写 <specDir>/feature_index.json（UTF-8 无 BOM，结构对齐原 1-spec 总入口）
//   - 写 <specDir>/stage_manifest.md（阶段速查表：原子数/证实分布/协议消息/UI 模块）
//   - v3 模式写 <outDir>/feature_index.json（schema_version 3 + v3_merge 溯源块）
//
// 退出码（CLI）：0 成功 / 1 结构错误（无片段、JSON 损坏、ID 冲突、空阶段、阶段数不符、
//                v3 闸门失败、v2 hash 变化）

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { classifyL7 } from './classify-l7.mjs'

function cell(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '／')
    .trim()
}

function stageNo(id) {
  const m = String(id || '').match(/^ST-C(\d+)$/)
  return m ? Number(m[1]) : -1
}

// 从证据文件路径提取 UI 模块名（box_hzmj_* 等）
function uiModulesFromFeatures(features) {
  const mods = new Set()
  for (const fe of features) {
    for (const at of fe.atoms || []) {
      for (const e of at.evidence || []) {
        const m = String(e.file || '').match(/box_[a-zA-Z0-9_]+/)
        if (m) mods.add(m[0])
      }
    }
  }
  return Array.from(mods).sort()
}

function messagesFromFeatures(features) {
  const msgs = new Set()
  for (const fe of features) {
    for (const at of fe.atoms || []) {
      for (const m of at.messages || []) msgs.add(String(m))
    }
  }
  return Array.from(msgs).sort()
}

export function assembleIndex(specDir, date, sourceDesc, expectedStageCount) {
  const problems = []
  const bad = (msg) => {
    problems.push(msg)
    console.error('[失败] ' + msg)
    return { ok: false, problems: problems, summary: null }
  }

  const partsDir = path.join(specDir, 'runtime', 'parts')
  if (!fs.existsSync(partsDir)) {
    return bad('片段目录不存在：' + partsDir + '（产出编写阶段可能中断，请重跑 workflow）')
  }
  const files = fs
    .readdirSync(partsDir)
    .filter((f) => /^ST-C\d+\.json$/.test(f))
    .sort((a, b) => stageNo(a) - stageNo(b))
  if (files.length === 0) {
    return bad('片段目录为空：' + partsDir + '（产出编写阶段可能中断，请重跑 workflow）')
  }
  if (expectedStageCount !== undefined && Number(expectedStageCount) !== files.length) {
    return bad(
      '片段数与期望阶段数不符：期望 ' + expectedStageCount + '，实际 ' + files.length +
        '（可能残留上次运行片段，请清理 ' + partsDir + ' 后重跑）'
    )
  }

  const stages = []
  const features = []
  const stats = []
  const stageIds = new Set()
  const featureIds = new Set()
  const atomIds = new Set()

  for (const f of files) {
    let part
    try {
      part = JSON.parse(fs.readFileSync(path.join(partsDir, f), 'utf8'))
    } catch (err) {
      return bad('片段 JSON 解析失败：' + f + '（' + err.message + '）')
    }
    const st = (part && part.stage) || {}
    if (!st.id || st.id + '.json' !== f) {
      return bad('片段 stage.id 与文件名不一致：' + f + ' / ' + st.id)
    }
    if (stageNo(st.id) < 0) return bad('阶段 ID 格式不合法：' + st.id)
    if (stageIds.has(st.id)) return bad('阶段 ID 重复：' + st.id)
    stageIds.add(st.id)

    const stageFeatures = []
    for (const fe of part.features || []) {
      if (!fe.id || !fe.name) return bad('功能点 id/name 缺失：' + JSON.stringify({ id: fe.id }))
      if (featureIds.has(fe.id)) return bad('功能点 ID 重复：' + fe.id)
      featureIds.add(fe.id)
      const atoms = []
      for (const at of fe.atoms || []) {
        if (!at.id || !at.name) return bad('原子项 id/name 缺失：' + JSON.stringify({ id: at.id }))
        if (atomIds.has(at.id)) return bad('原子项 ID 重复：' + at.id)
        atomIds.add(at.id)
        // v2 新字段透传（T3.4）：v1 旧片段无 difference/verification/businessBehavior 时按
        // 「未经新 Schema 查证」处理（difference 兜底 unverified，不冒充已验证，需求 6.4）
        const hasV2 = at.difference !== undefined || at.verification !== undefined || at.businessBehavior !== undefined
        const verification = at.verification || { businessRuleVerified: false, unverifiedReason: 'v1 旧 Schema 数据（未经新 Schema 查证）' }
        atoms.push({
          id: at.id,
          name: at.name,
          rule: at.rule || '',
          ui_requirement: at.uiRequirement || '',
          owner: 'client',
          verdict: at.verdict,
          client_logic: at.clientLogic || '',
          ui_interaction: at.uiInteraction || '',
          messages: at.messages || [],
          // 索引证据只留 file/location（摘录保留在阶段文档），确定性剥离，防止片段带摘录混入
          evidence: (at.evidence || []).map((e) => ({ file: e.file, location: e.location })),
          notes: at.notes || '',
          business_behavior: at.businessBehavior
            ? {
                trigger: at.businessBehavior.trigger || '',
                condition: at.businessBehavior.condition || '',
                action: at.businessBehavior.action || '',
                result: at.businessBehavior.result || '',
              }
            : {},
          difference: at.difference !== undefined ? at.difference : 'unverified',
          difference_detail: at.differenceDetail || '',
          verification: {
            business_rule_verified: verification.businessRuleVerified === true,
            unverified_reason: verification.unverifiedReason || '',
            client_observed: at.verdict !== 'not_found',
          },
          schema_marked: hasV2,
        })
      }
      if (atoms.length === 0) return bad('功能点无原子项：' + fe.id)
      stageFeatures.push({
        id: fe.id,
        name: fe.name,
        stage_id: st.id,
        stage_name: st.name,
        description: fe.description || '',
        scope: fe.scope || '',
        coordination: fe.coordination || '',
        atoms: atoms,
      })
    }
    const flat = stageFeatures.flatMap((x) => x.atoms)
    if (flat.length === 0) return bad('阶段无任何原子项：' + st.id)

    stages.push({ id: st.id, name: st.name, chapter: st.chapter || '' })
    features.push(...stageFeatures)
    stats.push({
      id: st.id,
      name: st.name,
      chapter: st.chapter || '',
      featureCount: stageFeatures.length,
      atomCount: flat.length,
      confirmed: flat.filter((a) => a.verdict === 'confirmed').length,
      partial: flat.filter((a) => a.verdict === 'partial').length,
      notFound: flat.filter((a) => a.verdict === 'not_found').length,
      messages: messagesFromFeatures(stageFeatures),
      uiModules: uiModulesFromFeatures(stageFeatures),
    })
  }

  // v2 差异统计（T3.4）：v1 旧片段无 difference 字段按 unverified 计（schema_marked=false 区分）
  const diffStats = { consistent: 0, partial: 0, conflict: 0, unverified: 0 }
  let diffUnmarked = 0
  for (const fe of features) {
    for (const at of fe.atoms || []) {
      if (diffStats[at.difference] === undefined) at.difference = 'unverified'
      diffStats[at.difference]++
      if (at.schema_marked !== true) diffUnmarked++
    }
  }

  const index = {
    module: '42320',
    source:
      sourceDesc ||
      'templates/【杭州麻将】核心流程杭州麻将好友房AI-核心简化版本.md（需求模板）+ source-code/client/Code + source-code/client/Fgui（客户端代码证据）',
    generated_by: 'output-spec-generate workflow',
    date: date || '未提供',
    // v2 新增（T3.4/T2.2）：Schema 版本（2 = 含 businessBehavior/difference/verification）
    schema_version: 2,
    stage_count: stages.length,
    feature_count: features.length,
    atom_count: atomIds.size,
    // v2 新增（T3.4）：difference 分布（v1 未标注原子按 unverified 计，diff_unmarked 为其数量）
    difference_stats: {
      consistent: diffStats.consistent,
      partial: diffStats.partial,
      conflict: diffStats.conflict,
      unverified: diffStats.unverified,
      unmarked_v1: diffUnmarked,
    },
    stages: stages,
    features: features,
  }
  fs.writeFileSync(path.join(specDir, 'feature_index.json'), JSON.stringify(index, null, 1), 'utf8')

  const total = stats.reduce(
    (acc, s) => ({
      f: acc.f + s.featureCount,
      a: acc.a + s.atomCount,
      c: acc.c + s.confirmed,
      p: acc.p + s.partial,
      n: acc.n + s.notFound,
    }),
    { f: 0, a: 0, c: 0, p: 0, n: 0 }
  )

  const lines = []
  lines.push('# 阶段清单')
  lines.push('')
  lines.push('> 来源：' + index.source)
  lines.push('> 生成：output-spec-generate workflow，' + index.date + '。客户端视角规格，verdict 分布见下表。')
  lines.push('')
  lines.push('| 阶段 ID | 阶段 | 来源章节 | 功能点 | 原子项 | 已证实 | 部分证实 | 未找到 | 涉及协议消息 | 涉及 UI 模块 |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const s of stats) {
    lines.push(
      '| ' + s.id + ' | ' + cell(s.name) + ' | ' + cell(s.chapter) +
        ' | ' + s.featureCount + ' | ' + s.atomCount +
        ' | ' + s.confirmed + ' | ' + s.partial + ' | ' + s.notFound +
        ' | ' + cell(s.messages.join('、')) + ' | ' + cell(s.uiModules.join('、')) + ' |'
    )
  }
  lines.push(
    '| **合计** | | | **' + total.f + '** | **' + total.a + '** | **' + total.c + '** | **' +
      total.p + '** | **' + total.n + '** | | |'
  )
  lines.push('')
  fs.writeFileSync(path.join(specDir, 'stage_manifest.md'), lines.join('\n') + '\n', 'utf8')

  const summary = {
    specDir: specDir,
    stageCount: stages.length,
    featureCount: features.length,
    atomCount: atomIds.size,
    confirmed: total.c,
    partial: total.p,
    notFound: total.n,
    differenceStats: diffStats,
    differenceUnmarked: diffUnmarked,
  }
  console.log(
    '[成功] feature_index.json：' + stages.length + ' 阶段 / ' + features.length + ' 功能点 / ' + atomIds.size + ' 原子项'
  )
  console.log(
    '[成功] stage_manifest.md：' + stats.length + ' 行阶段表（confirmed ' + total.c + ' / partial ' + total.p + ' / not_found ' + total.n + '）'
  )
  console.log('SUMMARY ' + JSON.stringify(summary))
  return { ok: true, problems: [], summary: summary }
}

// ---------- v3 复核合并模式（OSG-W4 S3.3）：approved 条目合并进 v3 新目录，v2 只读 ----------

// 终局 l7Basis 语义：approved=已批准生效 / rejected=驳回维持基线 / pending=未裁决维持基线
const L7_BASIS_FINAL = { approved: 'approved', rejected: 'rejected', pending: 'baseline' }

export function assembleV3FromReview({ v2IndexPath, verifyDir, outDir, date }) {
  const problems = []
  const bad = (msg) => {
    problems.push(msg)
    console.error('[失败] ' + msg)
    return { ok: false, problems: problems, summary: null }
  }
  if (!v2IndexPath || !verifyDir || !outDir) {
    return bad('v3 参数缺失：v2IndexPath / verifyDir / outDir 任一为空')
  }
  const v2Abs = path.resolve(v2IndexPath)
  const outAbs = path.resolve(outDir)
  if (!fs.existsSync(v2Abs)) return bad('v2 feature_index.json 不存在：' + v2Abs)
  if (path.dirname(v2Abs) === outAbs) {
    return bad('v3 输出目录不得等于 v2 目录（v2 只读，hash 必须不变）')
  }
  const v2HashBefore = crypto.createHash('sha256').update(fs.readFileSync(v2Abs)).digest('hex')
  let v2Index
  try {
    v2Index = JSON.parse(fs.readFileSync(v2Abs, 'utf8'))
  } catch (err) {
    return bad('v2 feature_index.json 解析失败：' + err.message)
  }

  const readJson = (p) => {
    if (!fs.existsSync(p)) return null
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'))
    } catch (err) {
      return { __parseError: err.message }
    }
  }
  const scopeIndex = readJson(path.join(verifyDir, 'scope-index.json'))
  const serverEvidence = readJson(path.join(verifyDir, 'server-evidence.json'))
  const differenceReview = readJson(path.join(verifyDir, 'difference-review.json'))
  if (!scopeIndex || !serverEvidence || !differenceReview) {
    return bad('server-rule-verify 正式三件缺失（scope-index.json / server-evidence.json / difference-review.json）：' + verifyDir)
  }
  if (scopeIndex.__parseError || serverEvidence.__parseError || differenceReview.__parseError) {
    return bad('server-rule-verify 正式三件 JSON 解析失败：' + verifyDir)
  }

  // 基线差异统计 + 原子索引
  const DIFF_KEYS = ['consistent', 'partial', 'conflict', 'unverified']
  const baselineStats = { consistent: 0, partial: 0, conflict: 0, unverified: 0 }
  const atomById = new Map()
  for (const fe of v2Index.features || []) {
    for (const at of fe.atoms || []) {
      if (atomById.has(at.id)) return bad('v2 原子 ID 重复：' + at.id)
      atomById.set(at.id, at)
      if (DIFF_KEYS.includes(at.difference)) baselineStats[at.difference]++
      else return bad('v2 原子 difference 非法：' + at.id + ' -> ' + at.difference)
    }
  }
  if (v2Index.difference_stats) {
    for (const k of DIFF_KEYS) {
      if (v2Index.difference_stats[k] !== baselineStats[k]) {
        bad('v2 difference_stats 与原子重算不一致：' + k + ' header=' + v2Index.difference_stats[k] + ' 重算=' + baselineStats[k])
      }
    }
  }

  // 合成终局视图 DR：approved 保留 reviewedDifference，pending/rejected 回退 previousDifference；
  // 剥离 classifyL7 会重算的字段（l7/effectiveDifference/l7Basis）与假设全 approved 的投影块，
  // 使 classifyL7 按「终局差异」输出每原子 l7（矩阵：scope × 终局 difference）
  const drEntries = differenceReview.entries || []
  const drByAtom = new Map()
  for (const e of drEntries) {
    if (!e || !e.atomId) return bad('复核条目缺 atomId')
    if (drByAtom.has(e.atomId)) return bad('复核条目 atomId 重复：' + e.atomId)
    drByAtom.set(e.atomId, e)
  }
  const synthEntries = drEntries.map((e) => {
    const final = e.reviewStatus === 'approved' ? e.reviewedDifference : e.previousDifference
    const s = Object.assign({}, e, { reviewedDifference: final })
    delete s.l7
    delete s.effectiveDifference
    delete s.l7Basis
    return s
  })
  const synthDr = Object.assign({}, differenceReview, { entries: synthEntries })
  delete synthDr.afterReviewProjection
  delete synthDr.l7Projection

  const r = classifyL7({ featureIndex: v2Index, scopeIndex: scopeIndex, serverEvidence: serverEvidence, differenceReview: synthDr })
  for (const p of r.problems) bad('classifyL7：' + p)
  if (problems.length) return { ok: false, problems: problems, summary: null }
  const l7ByAtom = new Map(r.output.entries.map((e) => [e.atomId, e]))

  // 终局差异统计双路互验：路径一（基线 - previous + final 调整）vs 路径二（逐原子重算）
  const finalStats = Object.assign({}, baselineStats)
  const transitions = []
  for (const e of drEntries) {
    const final = e.reviewStatus === 'approved' ? e.reviewedDifference : e.previousDifference
    finalStats[e.previousDifference]--
    finalStats[final]++
    if (e.reviewStatus === 'approved' && final !== e.previousDifference) {
      transitions.push({ atomId: e.atomId, from: e.previousDifference, to: final })
    }
  }
  const recount = { consistent: 0, partial: 0, conflict: 0, unverified: 0 }
  for (const [id, at] of atomById) {
    const e = drByAtom.get(id)
    const final = e ? (e.reviewStatus === 'approved' ? e.reviewedDifference : e.previousDifference) : at.difference
    recount[final]++
  }
  for (const k of DIFF_KEYS) {
    if (finalStats[k] !== recount[k]) bad('v3 差异统计双路不一致：' + k + ' 调整法=' + finalStats[k] + ' 重算法=' + recount[k])
  }

  // v3 索引构建（深拷贝 v2，逐复核原子合并）
  const v3 = JSON.parse(JSON.stringify(v2Index))
  v3.schema_version = 3
  v3.generated_by = 'assemble-output-spec-index.mjs v3 merge（OSG-W4 S3.3：approved 复核结论合并，v2 只读）'
  v3.date = date || v2Index.date
  let approvedCount = 0
  let rejectedCount = 0
  let pendingCount = 0
  for (const fe of v3.features || []) {
    for (const at of fe.atoms || []) {
      const e = drByAtom.get(at.id)
      if (!e) continue
      const c = l7ByAtom.get(at.id)
      at.difference_v2 = e.previousDifference
      at.difference = e.reviewStatus === 'approved' ? e.reviewedDifference : e.previousDifference
      at.review_status = e.reviewStatus
      at.reviewed_difference = e.reviewedDifference
      if (e.reviewRule !== undefined) at.review_rule = e.reviewRule
      if (e.reviewReason !== undefined) at.review_reason = e.reviewReason
      if (c) {
        at.l7 = c.l7
        at.l7_basis = L7_BASIS_FINAL[e.reviewStatus] || 'baseline'
        at.scope_applicability = c.scopeApplicability
        at.scope_source = c.scopeSource
        at.evidence_ids = c.evidenceIds
      }
      if (e.reviewStatus === 'approved') approvedCount++
      else if (e.reviewStatus === 'rejected') rejectedCount++
      else pendingCount++
    }
  }
  v3.difference_stats = {
    consistent: recount.consistent,
    partial: recount.partial,
    conflict: recount.conflict,
    unverified: recount.unverified,
    unmarked_v1: (v2Index.difference_stats && v2Index.difference_stats.unmarked_v1) || 0,
  }
  v3.v3_merge = {
    from: v2IndexPath,
    verifyDir: verifyDir,
    date: v3.date,
    reviewStatus: { approved: approvedCount, rejected: rejectedCount, pending: pendingCount },
    transitions: transitions,
    baseline_stats: baselineStats,
    v3_stats: v3.difference_stats,
    note: 'S3.3 approved 合并：approved 条目 difference 采 reviewedDifference，pending/rejected 维持 v2 基线；l7 为终局矩阵视图（scope × 终局 difference）',
  }

  // v2 只读闸门：写 v3 前后 v2 hash 必须不变
  const v2HashAfter = crypto.createHash('sha256').update(fs.readFileSync(v2Abs)).digest('hex')
  if (v2HashAfter !== v2HashBefore) return bad('v2 文件 hash 变化（v2 只读被破坏）')
  if (problems.length) return { ok: false, problems: problems, summary: null }

  fs.mkdirSync(outAbs, { recursive: true })
  const v3Path = path.join(outAbs, 'feature_index.json')
  fs.writeFileSync(v3Path, JSON.stringify(v3, null, 1), 'utf8')

  const summary = {
    outDir: outAbs,
    indexPath: v3Path,
    atomCount: atomById.size,
    reviewedCount: drEntries.length,
    reviewStatus: { approved: approvedCount, rejected: rejectedCount, pending: pendingCount },
    approvedTransitions: transitions.length,
    baselineStats: baselineStats,
    v3Stats: recount,
    v2Sha256: v2HashBefore,
  }
  console.log(
    '[成功] v3 feature_index.json：原子 ' + atomById.size + '（复核 ' + drEntries.length + '：approved ' + approvedCount +
      ' / rejected ' + rejectedCount + ' / pending ' + pendingCount + '，生效迁移 ' + transitions.length + ' 条）'
  )
  console.log(
    '[成功] 差异统计 ' + baselineStats.consistent + '/' + baselineStats.partial + '/' + baselineStats.conflict + '/' + baselineStats.unverified +
      ' -> ' + recount.consistent + '/' + recount.partial + '/' + recount.conflict + '/' + recount.unverified + '；v2 hash 不变'
  )
  console.log('SUMMARY ' + JSON.stringify(summary))
  return { ok: true, problems: [], summary: summary }
}

// CLI 直调守卫（被 import 时不执行，见 dev-docs/experience/workflow扫描agent全量转述超时-确定性扫描替代.md）
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  const [mode, ...rest] = process.argv.slice(2)
  if (mode === 'v3') {
    // v3 复核合并：node assemble-output-spec-index.mjs v3 <v2SpecDir> <verifyDir> <outDir> <date>
    const [v2SpecDir, verifyDir, outDir, date] = rest
    if (!v2SpecDir || !verifyDir || !outDir) {
      console.error('用法: node assemble-output-spec-index.mjs v3 <v2SpecDir> <verifyDir> <outDir> <date>')
      process.exit(1)
    }
    const r = assembleV3FromReview({
      v2IndexPath: path.join(v2SpecDir, 'feature_index.json'),
      verifyDir: verifyDir,
      outDir: outDir,
      date: date,
    })
    process.exit(r.ok ? 0 : 1)
  }
  const [specDir, date, sourceDesc, expectedStageCount] = process.argv.slice(2)
  if (!specDir) {
    console.error('用法: node assemble-output-spec-index.mjs <specDir> <date> <sourceDesc> [expectedStageCount]')
    console.error('      node assemble-output-spec-index.mjs v3 <v2SpecDir> <verifyDir> <outDir> <date>')
    process.exit(1)
  }
  const r = assembleIndex(specDir, date, sourceDesc, expectedStageCount)
  process.exit(r.ok ? 0 : 1)
}
