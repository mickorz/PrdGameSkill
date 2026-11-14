// Server-Rule-Verify 子流程 4/4：差异复核建议 + 确定性装配闸门
//
// 职责：agent 按分片出差异复核建议（pending，人工批准前不生效）落盘
//       runtime/review-output/，随后确定性装配闸门链：
//       merge-verify-output.mjs（合并 scope/SVE/DR + 双写闸门 + classifyL7 矩阵回填）
//       -> classify-l7.mjs（重算 l7-classify.json 正式产物）
//       -> verify-output-spec.mjs check-l7（五道闸门，报告 runtime/spec-check/l7-check-report.md）
//       -> agent 回读 l7-classify.json 统计块。
//
// 由主 workflow 经显式路径调用（本目录不在注册表扫描范围）：
//   await workflow({ scriptPath: './.opencode-workflows/workflows/server-rule-verify/4-review-difference.js', label: '差异复核与装配' }, childArgs + { stages })
//
// args（主 workflow 透传）：
//   stages            子流程 2 返回的 manifest 阶段分片清单
//   stageIds          目标阶段 CSV 或 ALL
//   featureIndexPath  基线 feature_index（v2 只读）
//   traceIndexPath    trace_index（闸门对齐主键）
//   outDir / date / analysisModel 同子流程 2
//
// 返回：{ scopeIndexPath, serverEvidencePath, differenceReviewPath, l7ClassifyPath,
//         l7CheckReportPath, l7, mergeSummary }

export const meta = {
  id: 'server-rule-verify-review-difference',
  name: 'server_rule_verify_review_difference',
  description: '差异复核建议（pending）+ merge/classify/check-l7 确定性装配闸门链',
  phases: [
    { title: '差异复核建议' },
    { title: '装配与校验' },
  ],
}

const A = args || {}

const stageIds = String(A.stageIds || 'ALL').trim()
const featureIndexPath =
  A.featureIndexPath || 'spec-workflow/output-spec/2026-11-14/1-spec/feature_index.json'
const traceIndexPath =
  A.traceIndexPath || 'spec-workflow/output-spec/2026-11-14/1-spec/trace_index.json'
const outDir = A.outDir || 'spec-workflow/output-spec/server-rule-verify'
const date = A.date || '2026-11-14'
const analysisModel =
  A.analysisModel === undefined ? 'biangfeng-gateway/deepseek-v4.1-flash-official' : A.analysisModel
const stages = Array.isArray(A.stages) ? A.stages : []

setConcurrency(A.concurrency || 16)

function withModel(opts) {
  return analysisModel ? { model: analysisModel, ...opts } : opts
}

const REVIEW_SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    partFile: { type: 'string' },
    atomCount: { type: 'number' },
    suggestionCount: { type: 'number' },
  },
  required: ['partFile', 'atomCount', 'suggestionCount'],
}

const L7_STATS_SCHEMA = {
  type: 'object',
  properties: {
    atomCount: { type: 'number' },
    reviewedCount: { type: 'number' },
    unreviewedCount: { type: 'number' },
    l7: {
      type: 'object',
      properties: {
        verified: { type: 'number' },
        verification_required: { type: 'number' },
        decision_required: { type: 'number' },
        not_applicable: { type: 'number' },
      },
      required: ['verified', 'verification_required', 'decision_required', 'not_applicable'],
    },
    l7Approved: {
      type: 'object',
      properties: {
        verified: { type: 'number' },
        verification_required: { type: 'number' },
        decision_required: { type: 'number' },
        not_applicable: { type: 'number' },
      },
      required: ['verified', 'verification_required', 'decision_required', 'not_applicable'],
    },
  },
  required: ['atomCount', 'reviewedCount', 'unreviewedCount', 'l7', 'l7Approved'],
}

function reviewPrompt(partFile) {
  return [
    '你是服务端规则补证的差异复核员，工作目录为项目根目录。只对有把握的原子出建议；建议一律 pending（人工批准前不生效），不要自行改判生效。',
    '',
    '复核规则（reviewRule 前缀白名单，四选一可带补充说明括号）：',
    '1. no-server-evidence-is-not-conflict：缺服务端证据不改判 conflict（维持 unverified/partial 原判）',
    '2. evidence-is-not-consistency：查到实现 ≠ 需求一致（细节差异维持原判；服务端证据确证与规则同构时可建议升 consistent，',
    '   reviewRule 写 evidence-is-not-consistency（复核后确认实现与规则同构，允许升级））',
    '3. common-capability-is-not-enabled：通用能力（其他玩法可用）不自动判好友房启用/冲突（先核对创房下发值口径）',
    '4. ui-conflict-stands-alone：客户端视觉冲突独立成立（服务端证据不改判消冲突，维持 conflict）',
    '',
    '出建议范围（其余原子不出条目，merge 自动维持基线差异）：',
    '- 基线 difference ∈ { conflict, partial } 的原子：给出复核结论（维持或升级，冲突消解须客户端证据变化才可，服务端证据不足消解）',
    '- 基线 difference = unverified 且本轮服务端证据已确证与规则同构：可建议升 consistent（规则 2 升级口径）',
    '',
    '步骤：',
    '1. 读取 ' + outDir + '/runtime/verify-input/' + partFile + '（原子 difference 基线 difference_detail）。',
    '2. 读取 ' + outDir + '/runtime/verify-output/' + partFile + '（子流程 3 落判证据：SVE 摘录 + scope 结论）。',
    '3. 按上述范围与规则出建议，写入 ' + outDir + '/runtime/review-output/' + partFile + '（write 工具，UTF-8，JSON 1 空格缩进）：',
    '   { "schemaVersion": 1, "stageId": <分片 stageId>, "partNo": <分片 partNo>,',
    '     "entries": [ { "atomId": "...", "reviewedDifference": "consistent|partial|conflict|unverified",',
    '       "reviewReason": "双栏证据摘要：需求语义 vs 服务端实现（引 file:line / SVE id）",',
    '       "reviewRule": "<前缀>（可选补充说明）" } ] }',
    '   reviewStatus 由 merge 脚本自动落 pending，不要写在条目里。无建议的分片写 entries: []。',
    '4. 只写这一个文件，不要写其他文件，不要执行 git 命令。',
    '5. 写完后返回结构化摘要（suggestionCount = entries 条数，可为 0）。',
  ].join('\n')
}

// ============================================================
// 差异复核建议（每分片一个 agent）
// ============================================================

phase('差异复核建议')

const partFiles = []
for (const s of stages) {
  for (const f of s.partFiles || []) partFiles.push({ stageId: s.stageId, file: f })
}
if (partFiles.length === 0) {
  throw new Error('stages 分片清单为空（子流程 2 未透传或清单损坏）')
}

const reviewResults = await parallel(
  partFiles.map((p) => () =>
    agent(
      reviewPrompt(p.file),
      withModel({
        label: '复核建议 ' + p.stageId + ' ' + p.file,
        agentType: 'general',
        schema: REVIEW_SUMMARY_SCHEMA,
        timeoutMs: 3600000,
        retries: 1,
      })
    )
  )
)

// 落盘闸门（建议分片可以为空 entries，但文件必须存在）
for (const p of partFiles) {
  const ok = await check(
    () => fileExists(outDir + '/runtime/review-output/' + p.file),
    '落盘闸门：复核建议未写盘 ' + p.file
  )
  if (!ok) {
    throw new Error('落盘闸门：复核建议未写盘 ' + outDir + '/runtime/review-output/' + p.file)
  }
}

let suggestionTotal = 0
for (let i = 0; i < partFiles.length; i++) {
  const r = reviewResults[i]
  if (!r || r.partFile !== partFiles[i].file) {
    throw new Error(
      '复核摘要 partFile 不符：期望 ' + partFiles[i].file + ' 实际 ' + (r && r.partFile)
    )
  }
  suggestionTotal += r.suggestionCount || 0
}

// ============================================================
// 装配与校验（确定性闸门链）
// ============================================================

phase('装配与校验')

// 1. merge-verify-output.mjs：合并 scope/SVE/DR（双写闸门 + classifyL7 矩阵回填 + 全量复核）
const mergeCmd =
  'node ".opencode-workflows/scripts/merge-verify-output.mjs" "' +
  featureIndexPath + '" "' + outDir + '" "' + date + '" "' + stageIds + '"'
const mergeOk = await commandSuccess(mergeCmd, 120000)
if (!mergeOk) {
  throw new Error('落判合并失败（merge-verify-output.mjs 退出码非 0，问题明细见其输出；产物未写）')
}

// 2. classify-l7.mjs：重算 l7-classify.json 正式产物
const classifyCmd =
  'node ".opencode-workflows/scripts/classify-l7.mjs" "' +
  featureIndexPath + '" "' + outDir + '/scope-index.json" "' + outDir + '/server-evidence.json" "' +
  outDir + '/difference-review.json" "' + outDir + '/l7-classify.json" "' + date + '"'
const classifyOk = await commandSuccess(classifyCmd, 120000)
if (!classifyOk) {
  throw new Error('L7 重算失败（classify-l7.mjs 退出码非 0，完整性问题见其输出）')
}

// 3. verify-output-spec.mjs check-l7：五道闸门（不触碰 v2 基线目录；报告 runtime/spec-check/）
const checkCmd =
  'node ".opencode-workflows/scripts/verify-output-spec.mjs" check-l7 "' +
  featureIndexPath + '" "' + traceIndexPath + '" "' + outDir + '/scope-index.json" "' +
  outDir + '/server-evidence.json" "' + outDir + '/difference-review.json" "' +
  outDir + '/l7-classify.json" "' + outDir + '/runtime/spec-check"'
const checkOk = await commandSuccess(checkCmd, 120000)
if (!checkOk) {
  throw new Error(
    'L7 Sidecar 五道闸门未通过（报告 ' + outDir + '/runtime/spec-check/l7-check-report.md）'
  )
}

// 4. l7-classify 统计块回读（agent 读头部）
const l7Stats = await agent(
  [
    '你是统计回读器，工作目录为项目根目录。只做读取与转写。',
    '',
    '任务：用 read 工具读取 ' + outDir + '/l7-classify.json 的前 40 行（offset 1，limit 40），',
    '找到 stats 对象并原样返回：atomCount / reviewedCount / unreviewedCount / l7 四值 /',
    'l7Approved 四值（verified / verification_required / decision_required / not_applicable）。',
    '只输出结构化结果。',
  ].join('\n'),
  withModel({ label: '回读 L7 统计', schema: L7_STATS_SCHEMA, timeoutMs: 600000, retries: 2 })
)
if (!l7Stats || !Number.isInteger(l7Stats.reviewedCount) || l7Stats.reviewedCount < 1) {
  throw new Error('L7 统计回读异常：' + JSON.stringify(l7Stats))
}

log(
  '差异复核与装配完成：建议 ' + suggestionTotal + ' 条（pending 人工批准），l7 ' +
    JSON.stringify(l7Stats.l7) + '（reviewed ' + l7Stats.reviewedCount + ' / ' + l7Stats.atomCount +
    '），五道闸门通过'
)

return {
  scopeIndexPath: outDir + '/scope-index.json',
  serverEvidencePath: outDir + '/server-evidence.json',
  differenceReviewPath: outDir + '/difference-review.json',
  l7ClassifyPath: outDir + '/l7-classify.json',
  l7CheckReportPath: outDir + '/runtime/spec-check/l7-check-report.md',
  suggestionTotal: suggestionTotal,
  l7: l7Stats.l7,
  l7Approved: l7Stats.l7Approved,
  reviewedCount: l7Stats.reviewedCount,
  atomCount: l7Stats.atomCount,
}
