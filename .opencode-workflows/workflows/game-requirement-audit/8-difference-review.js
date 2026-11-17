// Game-Requirement-Audit 子流程 S8：统一差异复核（agent 链路，评审 P1-1 整改）
//
// 执行文档 §5 S8、§15.1、§19.2。**Prompt 全文在本文件**。
//
// 职责链：按阶段分片 agent 出复核建议（pending）→ 写 review-output 分片 → merge-difference-review.mjs
// 确定性合并（审批状态保全 / 升级降级证据要求 / reviewRule 白名单）。
//
// 关键约束：复核建议**一律 pending**，不自动生效；agent 不得写 reviewStatus。
//
// stageVersion：S8@1

export const meta = {
  id: 'game-requirement-audit-difference-review',
  name: 'game_requirement_audit_difference_review',
  description: 'S8 统一差异复核：按阶段分片 agent 出双栏证据复核建议（pending），确定性合并并保全审批状态',
  phases: [{ title: '准备复核分片' }, { title: '并行差异复核' }, { title: '确定性合并' }],
}

const A = args || {}

const runDir = String(A.runDir || '').trim()
if (!runDir) throw new Error('runDir 必填（run 根目录，由主编排创建）')
const date = String(A.date || '').trim()
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date 必填 YYYY-MM-DD')
const analysisModel =
  A.analysisModel === undefined ? 'biangfeng-gateway/deepseek-v4.1-flash-official' : A.analysisModel

setConcurrency(A.concurrency || 16)
function withModel(opts) {
  return analysisModel ? { model: analysisModel, ...opts } : opts
}

const UA_PATH = runDir + '/4-analysis/unified-atoms.json'
const BB_PATH = runDir + '/4-analysis/business-behavior.json'
const REVIEW_DIR = runDir + '/3-server/runtime/review-output'

// ============================================================
// 1. 准备：确定需要复核的原子（conflict-fast + full，按阶段分组）
// ============================================================

phase('准备复核分片')

const plan = await agent(
  [
    '你是复核计划读取器，工作目录为项目根目录。只做读取与转写，不做解读。',
    '',
    '任务：read ' + BB_PATH + '（business-behavior.json），返回 analysisRunId 与每个 entry 的',
    'atomId / analysisPath / baselineDifference。不要返回正文。只输出结构化结果。',
  ].join('\n'),
  withModel({
    label: '读取待复核原子清单',
    schema: {
      type: 'object',
      properties: {
        analysisRunId: { type: 'string' },
        entries: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              atomId: { type: 'string' },
              analysisPath: { type: 'string' },
              baselineDifference: { type: 'string' },
            },
            required: ['atomId'],
          },
        },
      },
      required: ['analysisRunId', 'entries'],
    },
    timeoutMs: 1800000,
    retries: 2,
  })
)
if (!plan || !Array.isArray(plan.entries) || plan.entries.length === 0) {
  throw new Error('待复核原子清单回读异常或为空：' + JSON.stringify(plan && plan.analysisRunId))
}
const analysisRunId = String(plan.analysisRunId || '')

const byStage = new Map()
for (const e of plan.entries) {
  const m = /^AT-(ST-C\d{2})-\d{3}$/.exec(String(e.atomId || ''))
  const stageId = m ? m[1] : 'ST-C00'
  if (!byStage.has(stageId)) byStage.set(stageId, [])
  byStage.get(stageId).push(e.atomId)
}
const partDocs = [...byStage.entries()]
  .sort((x, y) => (x[0] < y[0] ? -1 : 1))
  .map(([stageId, ids]) => ({ stageId, file: stageId + '-dr01.json', atomIds: ids.slice().sort() }))

const ingestText = JSON.stringify(
  partDocs.map((p) => ({ schemaVersion: 1, stageId: p.stageId, partNo: '01', analysisRunId, atomIds: p.atomIds })),
  null,
  1
)
await agent(
  [
    '你是分片写盘器。把下列 JSON 数组按顺序拆成独立文件写盘（UTF-8，1 空格缩进）：',
    partDocs.map((p, i) => '  第 ' + (i + 1) + ' 个 → ' + REVIEW_DIR + '/input/' + p.file).join('\n'),
    '每个文件内容 = 数组对应元素，逐字复制。只写这些文件，不执行 git。',
    '',
    'PART-BEGIN',
    ingestText,
    'PART-END',
  ].join('\n'),
  { label: '写 S8 复核分片清单', agentType: 'general', timeoutMs: 900000, retries: 2, ...withModel({}) }
)

// ============================================================
// 2. 并行差异复核
// ============================================================

phase('并行差异复核')

const SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    partFile: { type: 'string' },
    entryCount: { type: 'number' },
    conflictRecommended: { type: 'number' },
    downgradeRecommended: { type: 'number' },
  },
  required: ['partFile', 'entryCount'],
}

// ---- Prompt 全文（S8） ----
function reviewPrompt(p) {
  const outPath = REVIEW_DIR + '/' + p.file
  return [
    '你是杭州麻将好友房需求的**统一差异复核员**。工作目录为项目根目录。',
    '职责：用双端证据复核 S7 的差异初判，给出**建议**（不是结论）。',
    '你不查证代码（证据已由 S4/S5 给出），不改需求，不写其他文件。',
    '',
    '## 一、输入',
    '1. 本片原子清单：' + REVIEW_DIR + '/input/' + p.file,
    '2. 统一原子视图：' + UA_PATH + '（双端证据快照：client.verdict / server.applicability / evidenceIds / pending / upgraded）',
    '3. 业务行为与初判：' + BB_PATH + '（baselineDifference / baselineDetail / candidateDifference）',
    '4. 证据原文（按需读）：' + runDir + '/2-client/client-evidence.json、' + runDir + '/3-server/server-evidence.json',
    '',
    '## 二、什么时候出条目（重要）',
    '只对**有把握或有变化**的原子出条目；其余原子**不要出现在输出里**（不要为每个原子都写一条）。',
    '典型应出条目的情形：',
    '- S7 初判 conflict，但双端证据综合后认为冲突不成立 → 建议 consistent（降级）',
    '- S7 初判 unverified，但补到的证据足以判定 → 建议 consistent / partial',
    '- S7 初判 partial / consistent，但发现遗漏的矛盾 → 建议 conflict（升级）',
    '- 升级原子（upgraded=true）历史基线为 conflict，本轮候选不同 → 建议采纳候选',
    '- 初判基本正确但需要记录复核规则依据',
    '',
    '## 三、复核规则白名单（reviewRule 必须以这些前缀开头，可带括号补充说明）',
    '- no-server-evidence-is-not-conflict：服务端无证据不等于冲突',
    '- evidence-is-not-consistency：有证据不等于一致（证据不足不能判 consistent）',
    '- common-capability-is-not-enabled：公共能力存在不等于本玩法启用',
    '- ui-conflict-stands-alone：客户端视觉冲突可单端成立',
    '- conflict-not-sustained：原冲突在双端证据综合后不成立（**降级专用**）',
    '- dual-side-collaboration-gap：双端协作断点定位',
    '',
    '## 四、字段要求',
    '- atomId：本片清单内原子',
    '- previousDifference：**必须等于 S7 的 baselineDifference**（升级原子即历史基线），不得自行填别的值',
    '- candidateDifference：仅升级原子填，且**必须等于 S7 的 candidateDifference**（不得改写）',
    '- clientVerdict / serverApplicability：双栏证据快照（照抄 unified-atoms 的值）',
    '- reviewedDifference：你的建议结论，四值 consistent / partial / conflict / unverified',
    '- reviewReason：**双栏证据摘要**，必须能追溯：写明需求语义 vs 客户端表现 vs 服务端规则，',
    '  并引用具体证据（file:line 或 CLE-xxx / SVE-xxx）。空泛理由不合格。',
    '- reviewRule：白名单前缀（可带括号补充）',
    '- evidenceScopes：数组。**reviewedDifference=conflict 时必填**；每项标一条证据能证明什么：',
    '  { "ref": "CLE-xxx | SVE-xxx | client-visual", "layer": "client_code|client_fgui|common_game|hzmj_server|mah_frame",',
    '    "applicability": "active|conditional|inactive|unknown", "note": "这条证据证明了什么" }',
    '  ref 必须真实存在于 CLE/SVE（或固定值 client-visual 表示纯客户端视觉冲突）',
    '- **不要填 reviewStatus**（一律由确定性脚本置 pending；人工审批在 S11）',
    '',
    '## 五、升级原子专项（upgraded=true）',
    '1. 历史基线是 conflict，本轮 S7 已写 candidateDifference（候选）。',
    '2. 若你认为候选成立 → reviewedDifference = candidateDifference，reviewRule 用 conflict-not-sustained，',
    '   reviewReason 必须**明确引用双端证据**（如「CLE-AT-…-01 显示客户端置灰，SVE-AT-…-01 显示服务端同步禁用，二者与需求一致」）。',
    '3. 若你认为候选不成立 → reviewedDifference = conflict（维持历史基线），说明理由。',
    '4. **严禁**把 previousDifference 填成候选值（那会破坏历史锚点）。',
    '5. 你的建议只是候选生效的前提；是否生效由人工审批决定。',
    '',
    '## 六、输出',
    '用 write 写文件：' + outPath + '（UTF-8，JSON，1 空格缩进）：',
    '{',
    '  "schemaVersion": 2,',
    '  "analysisRunId": "' + analysisRunId + '",',
    '  "entries": [ {',
    '    "atomId": "", "previousDifference": "", "candidateDifference": "",',
    '    "clientVerdict": "", "serverApplicability": "",',
    '    "reviewedDifference": "", "reviewReason": "", "reviewRule": "",',
    '    "evidenceScopes": [ { "ref": "", "layer": "", "applicability": "", "note": "" } ]',
    '  } ]',
    '}',
    '只写这一个文件，不写其他文件，不执行 git。',
    '',
    '## 七、返回摘要',
    'partFile / entryCount / conflictRecommended（建议 conflict 条数）/ downgradeRecommended（conflict→非 conflict 条数）。',
    '',
    '## 八、严禁事项',
    '- 严禁改 previousDifference（必须照抄 S7 baselineDifference）',
    '- 严禁改写 candidateDifference',
    '- 严禁填 reviewStatus / l7 / effectiveDifference（确定性脚本算）',
    '- 严禁无证据支撑的 conflict 建议（必须带 evidenceScopes 且 ref 真实存在）',
    '- 严禁执行 git',
  ].join('\n')
}

const results = await parallel(
  partDocs.map((p) => () =>
    agent(
      reviewPrompt(p),
      withModel({
        label: '差异复核 ' + p.stageId,
        agentType: 'general',
        schema: SUMMARY_SCHEMA,
        timeoutMs: 3600000,
        retries: 2,
      })
    )
  )
)

// 落盘闸门：分片必须存在；无建议时也允许写空 entries（但文件必须在）
const partCsv = partDocs.map((p) => p.file).join(',')
for (const p of partDocs) {
  const ok = await check(() => fileExists(REVIEW_DIR + '/' + p.file), '落盘闸门：' + p.file)
  if (!ok) throw new Error('S8 落盘闸门失败：分片未写盘 ' + REVIEW_DIR + '/' + p.file + '（请重跑 S8）')
}

// ============================================================
// 3. 确定性合并
// ============================================================

phase('确定性合并')

const mergeOk = await commandSuccess(
  'node ".opencode-workflows/scripts/merge-difference-review.mjs" --run-dir "' + runDir +
    '" --date "' + date + '"',
  300000
)
if (!mergeOk) throw new Error('S8 差异复核合并校验失败（见上方命令日志）')

const final = await agent(
  [
    '你是合并结果回读器，工作目录为项目根目录。只做读取与转写。',
    '',
    '任务：read ' + runDir + '/4-analysis/difference-review.json（只需统计，不要返回全部 entries），',
    '返回 analysisRunId 与 entries 总数、reviewStatus 分布（pending/approved/rejected）。',
    '只输出结构化结果。',
  ].join('\n'),
  withModel({
    label: '回读 S8 复核结果',
    schema: {
      type: 'object',
      properties: {
        analysisRunId: { type: 'string' },
        entryCount: { type: 'number' },
        pending: { type: 'number' },
        approved: { type: 'number' },
        rejected: { type: 'number' },
      },
      required: ['entryCount'],
    },
    timeoutMs: 900000,
    retries: 2,
  })
)
if (!final || !Number.isInteger(final.entryCount)) throw new Error('S8 汇总回读异常：' + JSON.stringify(final))

log(
  'S8 差异复核完成：' + analysisRunId + ' / 分片 ' + partDocs.length + ' / 复核条目 ' + final.entryCount +
    '（pending ' + (final.pending || 0) + ' / approved ' + (final.approved || 0) + ' / rejected ' + (final.rejected || 0) + '）' +
    ' -> ' + runDir + '/4-analysis/difference-review.json'
)

return {
  analysisRunId,
  partCount: partDocs.length,
  partFiles: partDocs.map((p) => p.file),
  entryCount: final.entryCount,
  reviewStatus: { pending: final.pending || 0, approved: final.approved || 0, rejected: final.rejected || 0 },
  reviewPath: runDir + '/4-analysis/difference-review.json',
}
