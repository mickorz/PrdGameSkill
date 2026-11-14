// verify-output-spec.mjs —— 1-spec 产出校验器（确定性命令，机械闸门）
//
// output-spec-generate workflow 的配套脚本：对 specDir 与补充版本文档做机械校验，
// 结果写 <specDir>/runtime/spec_check/verify-report.md（对齐原 1-spec 的 runtime/spec_check 产物形态）。
//
// v2 策划版扩展（2026-11-14，需求 R2/R6/R9，T3.3/T3.7）：
//   - 新增 checkPlannerLeakage(plannerPath, allowlist)：泄漏正则清单扫描策划版成品
//     （正则为三级验收第二级防线，清单见需求文档与执行计划第 9 节），命中即 fail；
//     allowlist 为业务允许词（从 build-config 传入），命中行先剔除白名单词再扫描。
//   - 新增 AT-ID 覆盖检查（R9）：以 trace_index.json（build-planner-trace.mjs 机械生成）
//     为基准，策划版分片合并文本中出现的 AT-ID 集合与其对比，覆盖率非 100% 时列缺失清单并 fail
//     （not_found 的待确认行同样带 AT-ID，覆盖检查不受 verdict 影响）。
//   - 新增 difference 覆盖统计段：从 feature_index.json 聚合 difference 分布进 verify-report
//     （v1 旧数据无 difference 字段按 unverified 计并注明「未经新 Schema 查证」，不冒充已验证）。
//   - verifyOutputSpec 签名加可选 opts：{ plannerPath, traceIndexPath, allowlist, skipPlanner }，
//     不传 opts 时行为与 v1 完全一致（向后兼容，CLI 老用法不炸）。
//
// OSG-W4 S1.3 复核自洽扩展（2026-11-14，设计文档 5 节 verify-output-spec 行 + 112 行实现约束）：
//   - 新增 checkL7Sidecars(files)：L7 Sidecar（scope-index / server-evidence / difference-review
//     / l7-classify）复核自洽校验——
//     1) classify 复跑（复用 classify-l7.mjs 的 classifyL7，矩阵/作用域/统计块逻辑不重复实现）：
//        覆盖四分类矩阵自洽（consistent+active 才 verified）、evidenceIds 存在性、枚举合法、
//        previousDifference 基线对齐、手写统计块交叉校验、缺 scope 一律 unknown 不判 not_applicable；
//     2) l7-classify 产物与复算逐条/逐块对比（防 classify 落盘后手改）；
//     3) Sidecar atomId 全部对齐 trace_index（设计 6：trace atomId 为三份 Sidecar 的对齐主键）；
//     4) conflict 条目必须带证据级 scope（设计 112：evidenceScopes 缺失即 fail；
//        classify 的 resolveScope 是降级处理，这里是硬闸门）；
//     5) 审批状态独立（pending/rejected 条目不得进正式索引：被验证索引原子 difference 必须等于
//        previousDifference；approved 条目必须等于 effectiveDifference）。
//   - verifyOutputSpec opts 新增可选 l7 = { baselineIndexPath?, traceIndexPath?, scopeIndexPath,
//     serverEvidencePath, differenceReviewPath, l7ClassifyPath }：传入时跑维度 7，
//     baseline/verified 索引默认 specDir/feature_index.json（v3 目录时显式传 v2 基线路径）。
//
// OSG-W4 S2.3 check-l7 CLI 模式（2026-11-14）：
//   - 新增 CLI 子模式 check-l7：只跑 L7 Sidecar 五道闸门，不跑维度 1-6、不写 specDir
//     （server-rule-verify 链路闸门，v2 基线只读不触碰）；报告写
//     <reportOutDir>/l7-check-report.md（缺省 l7-classify 同级 runtime/spec-check/）。
//
// 可导入：export verifyOutputSpec(specDir, supplementPath, templatePath, date, opts)
//         export checkPlannerLeakage(plannerPath, allowlist)
//         export checkL7Sidecars(files)
//         返回 { ok, problems, summary }，不直接退出进程
// CLI 用法：
//   node verify-output-spec.mjs <specDir> <supplementPath> <templatePath> <date>
//   （策划版检查参数只经 build-output-spec.mjs 配置文件链路传入，CLI 保持 v1 用法）
//   node verify-output-spec.mjs check-l7 <baselineIndex> <traceIndex> <scopeIndex> <serverEvidence> <differenceReview> <l7Classify> [reportOutDir]
//
// 校验维度：
//   1. feature_index.json 存在、可解析、计数自洽（stage/feature/atom 与实际数组一致）
//   2. 每阶段 stages/spec_stage_ST-Cxx.md 存在，原子项 ID 集合与 feature_index 完全一致
//   3. stage_manifest.md 存在且覆盖全部阶段 ID
//   4. 补充版本文档存在、含模板全部标题行（防章节静默丢失）、无乱码
//   5. 全部产出无 U+FFFD 乱码、无 PART-BEGIN/PART-END 分片标记残留
//   6.（v2）策划版泄漏正则扫描 + AT-ID 覆盖率 + difference 统计（opts 传入时）
//   7.（OSG-W4 S1.3）L7 Sidecar 复核自洽（opts.l7 传入时）：classify 复跑 + 产物对比 +
//      trace_index 对齐 + conflict 证据级 scope + 审批状态独立
//
// 退出码（CLI）：0 全部通过 / 1 任一维度失败（失败明细打印到 stderr，并写入 verify-report.md）

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { classifyL7 } from './classify-l7.mjs'

function writeReport(reportPath, problems, summaryText) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  const lines = []
  lines.push('# 产出校验（output-spec-generate）')
  lines.push('')
  lines.push('> 机械闸门：文件存在性 / 索引计数自洽 / 阶段文档原子 ID 一致性 / 清单覆盖 / 补充版本章节完整性 / 乱码与分片标记。')
  lines.push('')
  if (problems.length === 0) {
    if (summaryText) lines.push(summaryText)
    lines.push('')
    lines.push('**结论：放行。** 全部维度通过。')
  } else {
    lines.push('**结论：不放行。** 共 ' + problems.length + ' 项问题：')
    lines.push('')
    for (const p of problems) lines.push('- ' + p)
  }
  fs.writeFileSync(reportPath, lines.join('\n') + '\n', 'utf8')
}

function checkTextProblems(text, label, problems) {
  if (text.includes('\uFFFD')) problems.push(label + ' 含乱码替换字符 U+FFFD')
  if (text.includes('PART-BEGIN') || text.includes('PART-END')) problems.push(label + ' 残留分片标记 PART-BEGIN/PART-END')
}

function extractAtomIds(md) {
  const ids = []
  const re = /^#### `?(AT-[A-Za-z0-9-]+)/gm
  let m
  while ((m = re.exec(md)) !== null) ids.push(m[1])
  return ids
}

// ============================================================
// v2 策划版扩展（R2/R6/R9）
// ============================================================

// 泄漏正则清单（执行计划第 9 节，三级验收第二级防线：拦已知模式，不是根治）
const LEAK_PATTERNS = [
  { re: /source-code/, label: '源码路径' },
  { re: /\.[tj]s:\d+/, label: 'file:line 定位' },
  { re: /\b[A-Z][a-z]+[A-Z]\w*(Cmd|View|Data|Config|Protocol|Manager)\b/, label: '大驼峰类名' },
  { re: /\bMsg[A-Z]\w+/, label: '协议消息名' },
  { re: /\bCMD_[A-Z_]+/, label: '协议命令名' },
  { re: /\b(set|get|on)[A-Z]\w+/, label: '方法名' },
  { re: /\bC_[A-Za-z]/, label: '组件引用名' },
  { re: /\b[A-Z]{2,}(_[A-Z0-9]+)+\b/, label: 'SCREAMING_SNAKE 常量' },
  { re: /box_hzmj_|box_mah_/, label: 'FairyGUI 组件/包名' },
]

// 策划版泄漏检查：逐行剔除白名单词后跑正则清单，命中即 problem（附行号与命中内容）
// 可独立导入调用（build-output-spec.mjs planner-only 分支也用）
export function checkPlannerLeakage(plannerPath, allowlist) {
  const problems = []
  if (!fs.existsSync(plannerPath)) {
    problems.push('策划版文档不存在：' + plannerPath)
    return { ok: false, problems: problems, hits: [] }
  }
  const text = fs.readFileSync(plannerPath, 'utf8')
  if (text.includes('\uFFFD')) problems.push('策划版文档含乱码替换字符 U+FFFD')
  const allow = Array.isArray(allowlist) ? allowlist : []
  const hits = []
  text.split('\n').forEach((rawLine, i) => {
    const line = allow.length > 0 ? allow.reduce((s, w) => s.split(w).join(' '), rawLine) : rawLine
    for (const p of LEAK_PATTERNS) {
      const m = line.match(p.re)
      if (m) {
        hits.push({ line: i + 1, pattern: p.label, match: m[0] })
        problems.push('策划版泄漏（第 ' + (i + 1) + ' 行，' + p.label + '）：' + m[0])
      }
    }
  })
  return { ok: problems.length === 0, problems: problems, hits: hits }
}

// AT-ID 覆盖检查（R9）：以 trace_index.json 为基准，比对策划版文本中出现的 AT-ID 集合
// 覆盖率非 100% 列缺失清单；策划版出现基准外的 AT-ID 同样列为问题
// （导出供 build-output-spec.mjs planner-only 分支复用）
// v2.1 口径（与策划版 Prompt「不硬凑」规则对齐）：分母只计 required=true 的条目
// （uiInteraction 非空 / businessBehavior 四元组任一非空 / verdict=not_found——Prompt
// 必然要求写补充行的原子）；required=false 的原子（纯知识规则，Prompt 规则不硬凑）
// 实际缺失仅列提示行不计 fail，防漏写与防编造口径一致。
export function checkAtomCoverage(plannerPath, traceIndexPath) {
  const problems = []
  const notes = []
  if (!fs.existsSync(traceIndexPath)) {
    problems.push('trace_index.json 不存在（AT-ID 覆盖检查基准缺失）：' + traceIndexPath)
    return { coverage: 0, missing: [], extra: [], problems: problems, notes: notes }
  }
  let trace
  try {
    trace = JSON.parse(fs.readFileSync(traceIndexPath, 'utf8'))
  } catch (err) {
    problems.push('trace_index.json 解析失败：' + err.message)
    return { coverage: 0, missing: [], extra: [], problems: problems, notes: notes }
  }
  const entries = trace.entries || []
  const baseIds = entries.map((e) => e.atomId)
  if (baseIds.length === 0) {
    problems.push('trace_index.json entries 为空（追溯索引生成异常）')
    return { coverage: 0, missing: [], extra: [], problems: problems, notes: notes }
  }
  // required 缺失（旧版 trace 无 required 字段时按全量必查，向后兼容）
  const requiredIds = entries.filter((e) => e.required !== false).map((e) => e.atomId)
  const optionalIds = entries.filter((e) => e.required === false).map((e) => e.atomId)
  const plannerText = fs.readFileSync(plannerPath, 'utf8')
  const found = new Set()
  // 原子项 ID 格式：AT-ST-Cxx-nnn（阶段 C 后 2 位、原子项 3 位，如 AT-ST-C01-001）
  const re = /\bAT-ST-C\d{2}-\d{3}\b/g
  let m
  while ((m = re.exec(plannerText)) !== null) found.add(m[0])
  const baseSet = new Set(baseIds)
  const missing = requiredIds.filter((id) => !found.has(id))
  const optionalMissing = optionalIds.filter((id) => !found.has(id))
  const extra = Array.from(found).filter((id) => !baseSet.has(id))
  if (missing.length > 0) {
    problems.push('策划版 AT-ID 覆盖缺失 ' + missing.length + ' 个（AI 漏写补充内容）：' + missing.slice(0, 30).join('、') + (missing.length > 30 ? ' ...' : ''))
  }
  if (optionalMissing.length > 0) {
    notes.push('策划版未标注 AT-ID ' + optionalMissing.length + ' 个（无可写补充内容的原子，按「不硬凑」规则跳过，仅提示不计失败）：' + optionalMissing.slice(0, 30).join('、') + (optionalMissing.length > 30 ? ' ...' : ''))
  }
  if (extra.length > 0) {
    problems.push('策划版出现基准外 AT-ID ' + extra.length + ' 个：' + extra.slice(0, 30).join('、') + (extra.length > 30 ? ' ...' : ''))
  }
  const coverage = requiredIds.length > 0 ? (requiredIds.length - missing.length) / requiredIds.length : 1
  return { coverage: coverage, missing: missing, optionalMissing: optionalMissing, extra: extra, problems: problems, notes: notes }
}

// ============================================================
// OSG-W4 S1.3：L7 Sidecar 复核自洽校验（设计文档 5 节 + 112 行实现约束）
// ============================================================

// L7 Sidecar 复核自洽校验（五道闸门，任一命中即 fail）：
//   1. classify 复跑：classifyL7（classify-l7.mjs 导入，矩阵/作用域/统计块逻辑不重复实现）
//      ——覆盖四分类矩阵自洽（consistent+active 才 verified）、evidenceIds 存在、枚举合法、
//      previousDifference 基线对齐、手写统计块交叉校验、缺 scope 一律 unknown 不判 not_applicable
//   2. l7-classify 产物对比：磁盘 l7-classify.json 与复算 output 逐条/逐统计块比对
//      ——防 classify 落盘后手改（同款漂移坑见 dev-docs/experience/手写统计块漂移-l7Projection.md）
//   3. Atom ID 对齐 trace_index：Sidecar（scope-index / server-evidence / difference-review /
//      l7-classify）atomId 全部在 trace_index 内；trace_index 与基线原子集合同集（对齐主键自洽）
//   4. conflict 必须带证据级 scope：difference-review 条目 reviewedDifference=conflict 时，
//      对应 scope-index 条目必须存在且 evidenceScopes 非空（设计 112；classify resolveScope
//      对缺失 evidenceScopes 是降级处理，此处硬闸门 fail）
//   5. 审批状态独立（pending 条目不得进正式索引）：被验证索引（verifiedIndexPath）原子
//      difference —— pending/rejected 条目必须等于 previousDifference，
//      approved 条目必须等于 effectiveDifference
// files = {
//   baselineIndexPath,   // 必填：classify 基线（previousDifference 来源，v2）
//   verifiedIndexPath,   // 必填：被验证正式索引（v2 同基线；v3 目录时传 v3 路径，baseline 显式传 v2）
//   traceIndexPath,      // 必填：trace_index.json（对齐主键）
//   scopeIndexPath, serverEvidencePath, differenceReviewPath,  // 必填：三份 Sidecar
//   l7ClassifyPath,      // 必填：classify-l7.mjs 产物
// }
// 返回 { ok, problems, summary }，不直接退出进程
export function checkL7Sidecars(files) {
  const problems = []
  const bad = (m) => problems.push(m)
  const F = files || {}
  const paths = {
    baseline: F.baselineIndexPath || F.verifiedIndexPath || '',
    verified: F.verifiedIndexPath || F.baselineIndexPath || '',
    trace: F.traceIndexPath || '',
    scopeIndex: F.scopeIndexPath || '',
    serverEvidence: F.serverEvidencePath || '',
    differenceReview: F.differenceReviewPath || '',
    l7Classify: F.l7ClassifyPath || '',
  }
  const load = (p, label) => {
    if (!p) {
      bad(label + ' 路径缺失（checkL7Sidecars 必填项）')
      return null
    }
    let raw
    try {
      raw = fs.readFileSync(p, 'utf8')
    } catch {
      bad(label + ' 读取失败：' + p)
      return null
    }
    try {
      return JSON.parse(raw)
    } catch (e) {
      bad(label + ' JSON 解析失败：' + p + '（' + e.message + '）')
      return null
    }
  }
  const baseline = load(paths.baseline, '基线 feature_index')
  const verified = load(paths.verified, '正式索引 feature_index')
  const trace = load(paths.trace, 'trace_index')
  const scopeIndex = load(paths.scopeIndex, 'scope-index')
  const serverEvidence = load(paths.serverEvidence, 'server-evidence')
  const differenceReview = load(paths.differenceReview, 'difference-review')
  const l7Classify = load(paths.l7Classify, 'l7-classify')
  if ([baseline, verified, trace, scopeIndex, serverEvidence, differenceReview, l7Classify].some((x) => x === null)) {
    return { ok: false, problems: problems, summary: null }
  }

  // 1. classify 复跑（矩阵自洽/证据关联/枚举/基线漂移/手写统计块，全部由 classifyL7 覆盖）
  const rerun = classifyL7({ featureIndex: baseline, scopeIndex, serverEvidence, differenceReview })
  for (const p of rerun.problems) bad('classify 复跑：' + p)

  // 2. l7-classify 产物与复算对比（防落盘后手改）
  if (rerun.ok) {
    const freshById = new Map(rerun.output.entries.map((e) => [e.atomId, e]))
    for (const d of l7Classify.entries || []) {
      const f = freshById.get(d.atomId)
      if (!f) {
        bad('l7-classify 条目不在复算结果内（落盘后增改或输入漂移）：' + d.atomId)
        continue
      }
      if (JSON.stringify(d) !== JSON.stringify(f)) {
        bad('l7-classify 条目与复算不一致（落盘后手改）：' + d.atomId)
      }
    }
    for (const [id] of freshById) {
      if (!(l7Classify.entries || []).some((d) => d.atomId === id)) {
        bad('l7-classify 缺复算条目（落盘后删改）：' + id)
      }
    }
    const ds = l7Classify.stats || {}
    const fs2 = rerun.output.stats
    for (const g of ['l7', 'l7Approved', 'effectiveDifference', 'reviewStatus']) {
      const dGroup = ds[g] || {}
      const fGroup = fs2[g] || {}
      for (const k of Object.keys(fGroup)) {
        if (dGroup[k] !== fGroup[k]) {
          bad('l7-classify stats.' + g + '.' + k + ' 与复算不一致：落盘=' + dGroup[k] + ' 复算=' + fGroup[k])
        }
      }
      for (const k of Object.keys(dGroup)) {
        if (!(k in fGroup)) bad('l7-classify stats.' + g + '.' + k + ' 复算无此键（落盘后手改）：' + dGroup[k])
      }
    }
    for (const k of ['atomCount', 'reviewedCount', 'unreviewedCount']) {
      if (ds[k] !== undefined && ds[k] !== fs2[k]) {
        bad('l7-classify stats.' + k + ' 与复算不一致：落盘=' + ds[k] + ' 复算=' + fs2[k])
      }
    }
  }

  // 3. Atom ID 对齐 trace_index（设计 6：trace atomId 为三份 Sidecar 的对齐主键）
  const traceIds = new Set((trace.entries || []).map((e) => e.atomId))
  if (traceIds.size === 0) bad('trace_index entries 为空（对齐主键缺失）')
  const baselineAtomIds = new Set()
  for (const fe of baseline.features || []) for (const at of fe.atoms || []) baselineAtomIds.add(at.id)
  for (const id of baselineAtomIds) {
    if (!traceIds.has(id)) bad('trace_index 缺基线原子（对齐主键不全）：' + id)
  }
  for (const id of traceIds) {
    if (!baselineAtomIds.has(id)) bad('trace_index 含基线外原子：' + id)
  }
  const sidecarAtoms = []
  for (const e of scopeIndex.entries || []) sidecarAtoms.push(['scope-index', e.atomId])
  for (const e of serverEvidence.entries || []) sidecarAtoms.push(['server-evidence', e.atomId])
  for (const e of differenceReview.entries || []) sidecarAtoms.push(['difference-review', e.atomId])
  for (const e of l7Classify.entries || []) sidecarAtoms.push(['l7-classify', e.atomId])
  for (const [src, id] of sidecarAtoms) {
    if (id && !traceIds.has(id)) bad(src + ' atomId 不在 trace_index（对齐主键）：' + id)
  }

  // 4. conflict 条目必须带证据级 scope（设计 112 硬闸门；classify 是降级处理）
  const scopeById = new Map((scopeIndex.entries || []).map((e) => [e.atomId, e]))
  let conflictTotal = 0
  let conflictWithEvidenceScope = 0
  for (const e of differenceReview.entries || []) {
    if (!e || e.reviewedDifference !== 'conflict') continue
    conflictTotal++
    const se = scopeById.get(e.atomId)
    const hasScopes = se && Array.isArray(se.evidenceScopes) && se.evidenceScopes.some((s) => s && s.ref)
    if (!se) {
      bad('conflict 条目在 scope-index 无条目（必须带证据级 scope，设计 112）：' + e.atomId)
    } else if (!hasScopes) {
      bad('conflict 条目缺证据级 evidenceScopes（必须带证据级 scope，设计 112）：' + e.atomId)
    } else {
      conflictWithEvidenceScope++
    }
  }

  // 5. 审批状态独立（pending/rejected 条目不得进正式索引；approved 按 effectiveDifference 合并）
  if (rerun.ok) {
    const verifiedDiff = new Map()
    for (const fe of (verified.features || [])) {
      for (const at of fe.atoms || []) verifiedDiff.set(at.id, at.difference)
    }
    for (const e of rerun.output.entries) {
      if (!verifiedDiff.has(e.atomId)) {
        bad('正式索引缺复核原子：' + e.atomId)
        continue
      }
      const vd = verifiedDiff.get(e.atomId)
      const expect = e.reviewStatus === 'approved' ? e.effectiveDifference : e.previousDifference
      if (vd !== expect) {
        bad(
          '审批状态独立校验失败：' + e.atomId + ' reviewStatus=' + e.reviewStatus +
            ' 正式索引 difference=' + vd + ' 应为=' + expect +
            (e.reviewStatus === 'approved'
              ? '（approved 条目按 effectiveDifference 合并）'
              : '（pending/rejected 条目不得进正式索引，应保持 previousDifference）')
        )
      }
    }
  }

  const summary = rerun.ok
    ? {
        atomCount: rerun.summary.atomCount,
        reviewedCount: rerun.summary.reviewedCount,
        l7: rerun.summary.l7,
        l7Approved: rerun.summary.l7Approved,
        effectiveDifference: rerun.summary.effectiveDifference,
        reviewStatus: rerun.summary.reviewStatus,
        conflictTotal: conflictTotal,
        conflictWithEvidenceScope: conflictWithEvidenceScope,
        traceAtomCount: traceIds.size,
      }
    : null
  return { ok: problems.length === 0, problems: problems, summary: summary }
}

export function verifyOutputSpec(specDir, supplementPath, templatePath, date, opts) {
  const problems = []
  const reportPath = path.join(specDir, 'runtime', 'spec_check', 'verify-report.md')
  // v2 策划版检查参数（不传时行为与 v1 完全一致）
  const O = opts || {}
  const plannerPath = O.plannerPath || ''
  const skipPlanner = O.skipPlanner === true

  // 维度 1：feature_index.json
  const indexPath = path.join(specDir, 'feature_index.json')
  if (!fs.existsSync(indexPath)) {
    problems.push('feature_index.json 不存在：' + indexPath)
    writeReport(reportPath, problems)
    for (const p of problems) console.error('[失败] ' + p)
    console.error('[失败] 共 ' + problems.length + ' 项问题，详见 ' + reportPath)
    return { ok: false, problems: problems, summary: null }
  }
  let index
  try {
    index = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
  } catch (err) {
    problems.push('feature_index.json 解析失败：' + err.message)
    writeReport(reportPath, problems)
    for (const p of problems) console.error('[失败] ' + p)
    console.error('[失败] 共 ' + problems.length + ' 项问题，详见 ' + reportPath)
    return { ok: false, problems: problems, summary: null }
  }
  checkTextProblems(JSON.stringify(index), 'feature_index.json', problems)
  const stages = index.stages || []
  const features = index.features || []
  const atomTotal = features.reduce((s, f) => s + (f.atoms || []).length, 0)
  if (stages.length === 0) problems.push('feature_index.json stages 为空')
  if (index.stage_count !== stages.length) {
    problems.push('stage_count 不自洽：声明 ' + index.stage_count + '，实际 ' + stages.length)
  }
  if (index.feature_count !== features.length) {
    problems.push('feature_count 不自洽：声明 ' + index.feature_count + '，实际 ' + features.length)
  }
  if (index.atom_count !== atomTotal) {
    problems.push('atom_count 不自洽：声明 ' + index.atom_count + '，实际 ' + atomTotal)
  }
  const stageNameById = new Map(stages.map((s) => [s.id, s.name]))
  const atomIdsByStage = new Map()
  for (const s of stages) atomIdsByStage.set(s.id, new Set())
  for (const f of features) {
    if (!stageNameById.has(f.stage_id)) {
      problems.push('功能点 ' + f.id + ' 的 stage_id 不在 stages 清单：' + f.stage_id)
      continue
    }
    if ((f.atoms || []).length === 0) problems.push('功能点 ' + f.id + ' 无原子项')
    for (const a of f.atoms || []) {
      const set = atomIdsByStage.get(f.stage_id)
      if (set) set.add(a.id)
      if (a.verdict !== 'confirmed' && a.verdict !== 'partial' && a.verdict !== 'not_found') {
        problems.push('原子项 ' + a.id + ' verdict 不合法：' + a.verdict)
      }
    }
  }

  // 维度 2：阶段文档与原子项 ID 集合
  for (const s of stages) {
    const docPath = path.join(specDir, 'stages', 'spec_stage_' + s.id + '.md')
    if (!fs.existsSync(docPath)) {
      problems.push('阶段文档缺失：' + docPath)
      continue
    }
    const md = fs.readFileSync(docPath, 'utf8')
    checkTextProblems(md, '阶段文档 ' + s.id, problems)
    if (!md.includes(s.id)) problems.push('阶段文档 ' + s.id + ' 未包含自身阶段 ID')
    const docIds = extractAtomIds(md)
    const expected = atomIdsByStage.get(s.id) || new Set()
    const docSet = new Set(docIds)
    if (docIds.length !== docSet.size) {
      problems.push('阶段文档 ' + s.id + ' 原子项标题 ID 重复')
    }
    for (const id of expected) {
      if (!docSet.has(id)) problems.push('阶段文档 ' + s.id + ' 缺原子项 ' + id)
    }
    for (const id of docSet) {
      if (!expected.has(id)) problems.push('阶段文档 ' + s.id + ' 多出未登记原子项 ' + id)
    }
  }

  // 维度 3：stage_manifest.md
  const manifestPath = path.join(specDir, 'stage_manifest.md')
  if (!fs.existsSync(manifestPath)) {
    problems.push('stage_manifest.md 不存在：' + manifestPath)
  } else {
    const manifest = fs.readFileSync(manifestPath, 'utf8')
    checkTextProblems(manifest, 'stage_manifest.md', problems)
    for (const s of stages) {
      if (!manifest.includes(s.id)) problems.push('stage_manifest.md 缺阶段 ' + s.id)
    }
  }

  // 维度 4：补充版本文档（含模板标题行全覆盖检查，防章节静默丢失）
  if (!fs.existsSync(supplementPath)) {
    problems.push('补充版本文档不存在：' + supplementPath)
  } else {
    const sup = fs.readFileSync(supplementPath, 'utf8')
    checkTextProblems(sup, '补充版本文档', problems)
    if (fs.existsSync(templatePath)) {
      const tpl = fs.readFileSync(templatePath, 'utf8')
      const mainTitle = (tpl.split('\n').find((l) => l.startsWith('# ')) || '').slice(2).trim()
      if (mainTitle && !sup.includes(mainTitle)) {
        problems.push('补充版本文档缺模板主标题：' + mainTitle)
      }
      if (/^## 名词/m.test(tpl) && !/^## 名词/m.test(sup)) {
        problems.push('补充版本文档缺「## 名词」章节')
      }
      // 标题行全覆盖：模板每个标题行（去首尾空白）必须出现在补充版中
      const supLines = new Set(sup.split('\n').map((l) => l.trim()))
      const tplHeadings = tpl
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => /^#{1,6}\s/.test(l))
      for (const h of tplHeadings) {
        if (!supLines.has(h)) problems.push('补充版本文档缺模板标题行：' + h)
      }
    } else {
      problems.push('模板不存在，章节完整性检查跳过：' + templatePath)
    }
    for (const s of stages) {
      if (s.name && !sup.includes(s.name)) {
        problems.push('补充版本文档缺阶段章节标题：' + s.name)
      }
    }
  }

  // 维度 6（v2，opts 传入时）：策划版泄漏检查 + AT-ID 覆盖检查（R2/R6/R9）
  let plannerCoverage = null
  let plannerNotes = []
  if (plannerPath && !skipPlanner) {
    const leak = checkPlannerLeakage(plannerPath, O.allowlist)
    for (const p of leak.problems) problems.push(p)
    const traceIndexPath = O.traceIndexPath || path.join(specDir, 'trace_index.json')
    const cov = checkAtomCoverage(plannerPath, traceIndexPath)
    for (const p of cov.problems) problems.push(p)
    plannerNotes = cov.notes || []
    plannerCoverage = cov
  }

  // 维度 7（OSG-W4 S1.3，opts.l7 传入时）：L7 Sidecar 复核自洽校验
  // baseline/verified 索引默认 specDir/feature_index.json（v2 同基线场景）；
  // v3 目录验证时显式传 opts.l7.baselineIndexPath 指向 v2 基线
  let l7Sidecars = null
  if (O.l7) {
    const verifiedIndexPath = path.join(specDir, 'feature_index.json')
    const r = checkL7Sidecars({
      baselineIndexPath: O.l7.baselineIndexPath || verifiedIndexPath,
      verifiedIndexPath: verifiedIndexPath,
      traceIndexPath: O.l7.traceIndexPath || path.join(specDir, 'trace_index.json'),
      scopeIndexPath: O.l7.scopeIndexPath,
      serverEvidencePath: O.l7.serverEvidencePath,
      differenceReviewPath: O.l7.differenceReviewPath,
      l7ClassifyPath: O.l7.l7ClassifyPath,
    })
    for (const p of r.problems) problems.push(p)
    l7Sidecars = r
  }

  // 汇总与放行
  const verdictTotal = { confirmed: 0, partial: 0, not_found: 0 }
  for (const f of features) {
    for (const a of f.atoms || []) verdictTotal[a.verdict] = (verdictTotal[a.verdict] || 0) + 1
  }
  // v2 difference 统计（T3.3）：未标注口径 = 原始索引无 difference 字段（v1）或
  // 装配器兜底补的 unverified（schema_marked=false，v1 片段经装配），均不冒充已验证
  const diffTotal = { consistent: 0, partial: 0, conflict: 0, unverified: 0 }
  let diffUnmarked = 0
  for (const f of features) {
    for (const a of f.atoms || []) {
      const d = a.difference !== undefined ? a.difference : 'unverified'
      if (diffTotal[d] === undefined) {
        diffTotal.unverified++
      } else {
        diffTotal[d]++
      }
      if (a.difference === undefined || a.schema_marked === false) diffUnmarked++
    }
  }
  const summary = {
    stages: stages.length,
    features: features.length,
    atoms: atomTotal,
    verdictTotal: verdictTotal,
    differenceTotal: diffTotal,
    differenceUnmarked: diffUnmarked,
    supplementPath: supplementPath,
    plannerPath: plannerPath || null,
    plannerCoverage: plannerCoverage ? plannerCoverage.coverage : null,
    l7Sidecars: l7Sidecars ? l7Sidecars.summary : null,
  }

  if (problems.length > 0) {
    writeReport(reportPath, problems)
    for (const p of problems) console.error('[失败] ' + p)
    console.error('[失败] 共 ' + problems.length + ' 项问题，详见 ' + reportPath)
    return { ok: false, problems: problems, summary: summary }
  }

  const lines = []
  lines.push('- 原子项总数 ' + atomTotal + '（confirmed ' + verdictTotal.confirmed + ' / partial ' + verdictTotal.partial + ' / not_found ' + verdictTotal.not_found + '）')
  lines.push('- difference 分布：consistent ' + diffTotal.consistent + ' / partial ' + diffTotal.partial + ' / conflict ' + diffTotal.conflict + ' / unverified ' + diffTotal.unverified + (diffUnmarked > 0 ? '（其中 ' + diffUnmarked + ' 个为 v1 旧数据未标注 difference，按 unverified 计，未经新 Schema 查证）' : '（全部经新 Schema 查证标注）'))
  lines.push('- 阶段文档 ' + stages.length + '/' + stages.length + ' 齐全，原子项 ID 集合与 feature_index 一致')
  lines.push('- feature_index.json 解析通过，计数自洽（阶段 ' + stages.length + ' / 功能点 ' + features.length + '）')
  lines.push('- stage_manifest.md 覆盖全部 ' + stages.length + ' 个阶段')
  lines.push('- 补充版本文档 ' + supplementPath + ' 含模板全部标题行，无乱码')
  lines.push('- 全部产出无 U+FFFD 乱码、无分片标记残留')
  if (plannerPath && !skipPlanner) {
    if (plannerCoverage) {
      lines.push('- 策划版文档 ' + plannerPath + '：泄漏正则零命中（白名单 ' + JSON.stringify(O.allowlist || []) + '），AT-ID 覆盖率 ' + (plannerCoverage.coverage * 100).toFixed(1) + '%（必查口径：trace required 条目）')
    }
    for (const n of plannerNotes) lines.push('- 提示：' + n)
  }
  if (l7Sidecars && l7Sidecars.ok) {
    const s = l7Sidecars.summary
    lines.push(
      '- L7 Sidecar 复核自洽（OSG-W4）：复核 ' + s.reviewedCount + ' / ' + s.atomCount +
        '（l7：verified ' + s.l7.verified + ' / verification_required ' + s.l7.verification_required +
        ' / decision_required ' + s.l7.decision_required + ' / not_applicable ' + s.l7.not_applicable +
        '；l7Approved：verified ' + s.l7Approved.verified + ' / verification_required ' + s.l7Approved.verification_required +
        ' / decision_required ' + s.l7Approved.decision_required + ' / not_applicable ' + s.l7Approved.not_applicable + '）' +
        '，Sidecar atomId 全部对齐 trace_index（' + s.traceAtomCount + '），conflict 条目 ' + s.conflictWithEvidenceScope + '/' + s.conflictTotal + ' 带证据级 scope，审批状态独立校验通过（pending 条目未进正式索引）'
    )
  }
  lines.push('')
  lines.push('| 阶段 | 原子项 | 已证实 | 部分证实 | 未找到 |')
  lines.push('| --- | --- | --- | --- | --- |')
  for (const s of stages) {
    let c = 0
    let p = 0
    let n = 0
    let total = 0
    for (const f of features) {
      if (f.stage_id !== s.id) continue
      for (const a of f.atoms || []) {
        total++
        if (a.verdict === 'confirmed') c++
        else if (a.verdict === 'partial') p++
        else n++
      }
    }
    lines.push('| ' + s.id + ' ' + String(s.name || '').replace(/\|/g, '／') + ' | ' + total + ' | ' + c + ' | ' + p + ' | ' + n + ' |')
  }
  writeReport(reportPath, problems, lines.join('\n'))

  console.log('[成功] 产出校验通过：阶段 ' + stages.length + ' / 功能点 ' + features.length + ' / 原子项 ' + atomTotal)
  console.log('SUMMARY ' + JSON.stringify(summary))
  return { ok: true, problems: [], summary: summary }
}

// CLI 直调守卫（被 import 时不执行）
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  const argv = process.argv.slice(2)

  // check-l7 模式（OSG-W4 S2.3）：只跑 L7 Sidecar 五道闸门，不跑维度 1-6、
  // 不写 specDir（v2 基线只读）；报告写 <reportOutDir>/l7-check-report.md
  // （缺省 l7-classify 同级 runtime/spec-check/）。
  // 用法：node verify-output-spec.mjs check-l7 <baselineIndex> <traceIndex> <scopeIndex> <serverEvidence> <differenceReview> <l7Classify> [reportOutDir]
  if (argv[0] === 'check-l7') {
    const [mode, baselineIndexPath, traceIndexPath, scopeIndexPath, serverEvidencePath, differenceReviewPath, l7ClassifyPath, reportOutDir] = argv
    if (!baselineIndexPath || !traceIndexPath || !scopeIndexPath || !serverEvidencePath || !differenceReviewPath || !l7ClassifyPath) {
      console.error('用法: node verify-output-spec.mjs check-l7 <baselineIndex> <traceIndex> <scopeIndex> <serverEvidence> <differenceReview> <l7Classify> [reportOutDir]')
      process.exit(1)
    }
    const r = checkL7Sidecars({
      baselineIndexPath: baselineIndexPath,
      verifiedIndexPath: baselineIndexPath,
      traceIndexPath: traceIndexPath,
      scopeIndexPath: scopeIndexPath,
      serverEvidencePath: serverEvidencePath,
      differenceReviewPath: differenceReviewPath,
      l7ClassifyPath: l7ClassifyPath,
    })
    const reportDir =
      reportOutDir || path.join(path.dirname(path.resolve(l7ClassifyPath)), 'runtime', 'spec-check')
    const reportPath = path.join(reportDir, 'l7-check-report.md')
    const lines = ['# L7 Sidecar 五道闸门校验报告（check-l7 模式，OSG-W4 S2.3）', '']
    lines.push('- 基线：' + baselineIndexPath)
    lines.push('- Sidecar：scope-index / server-evidence / difference-review / l7-classify（' + path.dirname(path.resolve(l7ClassifyPath)) + '）')
    if (r.summary) {
      const s = r.summary
      lines.push(
        '- 复核 ' + s.reviewedCount + ' / ' + s.atomCount +
          '（l7：verified ' + s.l7.verified + ' / verification_required ' + s.l7.verification_required +
          ' / decision_required ' + s.l7.decision_required + ' / not_applicable ' + s.l7.not_applicable +
          '；conflict 条目 ' + s.conflictWithEvidenceScope + '/' + s.conflictTotal + ' 带证据级 scope；trace 对齐 ' + s.traceAtomCount + '）'
      )
    }
    if (r.problems.length > 0) {
      lines.push('')
      lines.push('## 问题（' + r.problems.length + ' 项）')
      for (const p of r.problems) lines.push('- ' + p)
    }
    fs.mkdirSync(reportDir, { recursive: true })
    fs.writeFileSync(reportPath, lines.join('\n') + '\n', 'utf8')
    if (!r.ok) {
      console.error('[失败] L7 Sidecar 五道闸门未通过，共 ' + r.problems.length + ' 项问题：')
      for (const p of r.problems) console.error('  - ' + p)
      console.error('报告 -> ' + reportPath)
      process.exit(1)
    }
    console.log('[成功] L7 Sidecar 五道闸门通过：' + JSON.stringify(r.summary))
    console.log('报告 -> ' + reportPath)
    process.exit(0)
  }

  const [specDir, supplementPath, templatePath, date] = argv
  if (!specDir || !supplementPath || !templatePath) {
    console.error('用法: node verify-output-spec.mjs <specDir> <supplementPath> <templatePath> <date>')
    console.error('     node verify-output-spec.mjs check-l7 <baselineIndex> <traceIndex> <scopeIndex> <serverEvidence> <differenceReview> <l7Classify> [reportOutDir]')
    process.exit(1)
  }
  const r = verifyOutputSpec(specDir, supplementPath, templatePath, date)
  process.exit(r.ok ? 0 : 1)
}
