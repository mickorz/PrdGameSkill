// Server-Rule-Verify Workflow（OSG-W4 S2.3，主编排，四子流程）
//
// 位置：本文件与四个子流程同在 server-rule-verify/ 子目录（注册表只扫描 workflows/ 一级目录，
// 本目录脚本均不进注册表）——调用本工作流用 workflow 工具的 scriptPath（相对项目根）：
//   ./.opencode-workflows/workflows/server-rule-verify/server-rule-verify.js
// 不能按 workflowId 被 Schedule 引用或被其他脚本按名调用（如需恢复按名调用，移回一级目录即可）。
//
// 职责链（对基线 v2 原子做服务端规则补证，四子流程内存链式传参，不经文件中转）：
//   server-rule-verify/1-scan-server.js        确定性重建服务端符号索引（build-symbol-index.mjs CLI）
//   server-rule-verify/2-match-atoms.js        按阶段分片并行：agent 查索引 + 读源码切片 → 匹配候选落盘
//   server-rule-verify/3-verify-scope.js       按分片并行：agent 逐原子作用域落判（scope 条目 + SVE +
//                                              DR 复核字段双写，S2.1 经验闸门）
//   server-rule-verify/4-review-difference.js  复核建议（pending）→ merge-verify-output.mjs 确定性合并
//                                              → classify-l7.mjs 重算 → verify-output-spec.mjs check-l7
//                                              五道闸门
//
// 产物（outDir）：正式产物 scope-index.json / server-evidence.json / difference-review.json /
//   l7-classify.json / symbol-index.json（人工样本 *_sample.json 只读不改）；中间产物
//   runtime/verify-input|match-output|verify-output|review-output/、runtime/spec-check/l7-check-report.md。
//
// 2026-11-14 生成前问询结论（落为常量与默认值，各子流程同款默认值）：
//   档位：速度优先（分析任务用快模型；质量靠确定性闸门兜底——classify 复跑 / merge 双写闸门 /
//         check-l7 五道闸门；verify 对抗复核留给 S3 人工裁决前）
//   分析类模型：biangfeng-gateway/deepseek-v4.1-flash-official（本仓库 5 个 workflow 已验证可用）
//   并发：16（主脚本 setConcurrency，四个子流程共享同一配额）
//   试运行：ST-C01 单阶段由用户自行触发（脚本就绪即交付，构建时不自跑）
//
// args（未标注的经 childArgs 原样透传给四个子流程）：
//   stageIds         必填，目标阶段 CSV（如 ST-C01 或 ST-C01,ST-C04）或 ALL（全量 15 阶段）
//   featureIndexPath 基线 feature_index（v2 只读），默认 spec-workflow/output-spec/2026-11-14/1-spec/feature_index.json
//   traceIndexPath   trace_index（闸门对齐主键），默认 spec-workflow/output-spec/2026-11-14/1-spec/trace_index.json
//   outDir           产物目录，默认 spec-workflow/output-spec/server-rule-verify
//   serverSrcRoot    服务端源码根（只读），默认 E:/WorkProjects/xc-flow/.xflow/xc/xcodeDev/game-mahjong/server/Logic/mahjong_server/src
//   date             运行日期 YYYY-MM-DD（脚本内禁止取当前时间），默认 2026-11-14
//   analysisModel    分析类模型，默认 biangfeng-gateway/deepseek-v4.1-flash-official（传空串用会话默认）
//   concurrency      并发上限，默认 16（运行时钳制到 16）
//
// 返回：
//   { ok, stageIds, symbolIndexPath, scopeIndexPath, serverEvidencePath, differenceReviewPath,
//     l7ClassifyPath, l7CheckReportPath, scanStats, stages, scopeStats, l7 }

export const meta = {
  id: 'server-rule-verify',
  name: 'server_rule_verify',
  description:
    '服务端规则补证四子流程：符号扫描 -> 原子匹配 -> 作用域落判（scope/SVE/DR 双写）-> 差异复核建议与装配闸门（merge/classify/check-l7 五道闸门）',
  phases: [
    { title: '扫描服务端' },
    { title: '原子匹配' },
    { title: '作用域落判' },
    { title: '差异复核与装配' },
  ],
}

const A = args || {}

const stageIds = String(A.stageIds || '').trim()
if (!stageIds) {
  throw new Error('stageIds 必填（如 ST-C01 或 ST-C01,ST-C04 或 ALL）')
}
const featureIndexPath =
  A.featureIndexPath || 'spec-workflow/output-spec/2026-11-14/1-spec/feature_index.json'
const traceIndexPath =
  A.traceIndexPath || 'spec-workflow/output-spec/2026-11-14/1-spec/trace_index.json'
const outDir = A.outDir || 'spec-workflow/output-spec/server-rule-verify'
const serverSrcRoot =
  A.serverSrcRoot ||
  'E:/WorkProjects/xc-flow/.xflow/xc/xcodeDev/game-mahjong/server/Logic/mahjong_server/src'
const date = A.date || '2026-11-14'
const analysisModel =
  A.analysisModel === undefined ? 'biangfeng-gateway/deepseek-v4.1-flash-official' : A.analysisModel

setConcurrency(A.concurrency || 16)

const childArgs = {
  stageIds: stageIds,
  featureIndexPath: featureIndexPath,
  traceIndexPath: traceIndexPath,
  outDir: outDir,
  serverSrcRoot: serverSrcRoot,
  date: date,
  analysisModel: analysisModel,
}

// ============================================================
// 输入就位检查
// ============================================================

await check(() => fileExists(featureIndexPath), '基线 feature_index 不存在：' + featureIndexPath)
await check(() => fileExists(traceIndexPath), 'trace_index 不存在：' + traceIndexPath)

// ============================================================
// 子流程 1：扫描服务端（确定性重建符号索引）
// ============================================================

const scan = await workflow(
  {
    scriptPath: './.opencode-workflows/workflows/server-rule-verify/1-scan-server.js',
    label: '扫描服务端',
  },
  childArgs
)
if (!scan || !scan.symbolIndexPath) {
  throw new Error('子流程 1 未返回 symbolIndexPath')
}

// ============================================================
// 子流程 2：原子匹配（agent 查索引 + 读源码切片）
// ============================================================

const match = await workflow(
  {
    scriptPath: './.opencode-workflows/workflows/server-rule-verify/2-match-atoms.js',
    label: '原子匹配',
  },
  Object.assign({}, childArgs, { symbolIndexPath: scan.symbolIndexPath })
)
if (!match || !Array.isArray(match.stages) || match.stages.length === 0) {
  throw new Error('子流程 2 未返回分片清单（stages）')
}

// ============================================================
// 子流程 3：作用域落判（scope 条目 + SVE + DR 复核字段双写）
// ============================================================

const verify = await workflow(
  {
    scriptPath: './.opencode-workflows/workflows/server-rule-verify/3-verify-scope.js',
    label: '作用域落判',
  },
  Object.assign({}, childArgs, {
    symbolIndexPath: scan.symbolIndexPath,
    stages: match.stages,
  })
)
if (!verify || !Array.isArray(verify.parts) || verify.parts.length === 0) {
  throw new Error('子流程 3 未返回落判分片摘要（parts）')
}

// ============================================================
// 子流程 4：差异复核建议 + 确定性装配闸门
// ============================================================

const review = await workflow(
  {
    scriptPath: './.opencode-workflows/workflows/server-rule-verify/4-review-difference.js',
    label: '差异复核与装配',
  },
  Object.assign({}, childArgs, { stages: match.stages })
)
if (!review || !review.l7ClassifyPath) {
  throw new Error('子流程 4 未返回 l7ClassifyPath')
}

log(
  '服务端规则补证完成：阶段 ' + stageIds + '，scope ' + JSON.stringify(verify.scopeStats) +
    '，l7 ' + JSON.stringify(review.l7)
)

return {
  ok: true,
  stageIds: stageIds,
  symbolIndexPath: scan.symbolIndexPath,
  scanStats: scan.stats,
  stages: match.stages,
  scopeIndexPath: review.scopeIndexPath,
  serverEvidencePath: review.serverEvidencePath,
  differenceReviewPath: review.differenceReviewPath,
  l7ClassifyPath: review.l7ClassifyPath,
  l7CheckReportPath: review.l7CheckReportPath,
  scopeStats: verify.scopeStats,
  l7: review.l7,
}
