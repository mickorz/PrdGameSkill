// Game-Requirement-Audit 子流程 S7：业务行为还原与差异初判（agent 链路，评审 P1-1 整改）
//
// 执行文档 §5 S7、§14.2、§19.2。**Prompt 全文在本文件**。
//
// 职责链：
//   1. 读 unified-atoms.json，取 conflict-fast + full 原子（blocked 原子**不参与**）
//   2. 按阶段分片，每片一个 agent：还原业务行为 + 双路径差异初判 → 写 business-behavior 分片
//   3. 确定性汇总分片 → business-behavior.json
//   4. append-analysis-history.mjs：append-only 落历史（agent 不写历史）
//
// 双路径（§5 S7）：
//   - conflict-fast：只做冲突判定，四元组可空，禁止为满足 Schema 编造完整行为
//   - full：完整还原（四元组 + 双端职责 + 协作链）+ 完整差异初判
//   - 升级原子（S6 upgraded=true）：baselineDifference 保持历史基线，本轮重判写 candidateDifference
//
// stageVersion：S7@1

export const meta = {
  id: 'game-requirement-audit-business-behavior',
  name: 'game_requirement_audit_business_behavior',
  description: 'S7 业务行为还原：按阶段分片 agent 双路径初判（conflict-fast 只判冲突 / full 完整还原），确定性汇总并 append 历史',
  phases: [{ title: '准备分析分片' }, { title: '并行业务行为还原' }, { title: '汇总与历史落档' }],
}

const A = args || {}

const runDir = String(A.runDir || '').trim()
if (!runDir) throw new Error('runDir 必填（run 根目录，由主编排创建）')
const date = String(A.date || '').trim()
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date 必填 YYYY-MM-DD')
const analysisModel =
  A.analysisModel === undefined ? 'biangfeng-gateway/deepseek-v4.1-flash-official' : A.analysisModel
const trigger = ['initial', 'retry', 'resume', 'decision'].includes(A.trigger) ? A.trigger : 'initial'

setConcurrency(A.concurrency || 16)
function withModel(opts) {
  return analysisModel ? { model: analysisModel, ...opts } : opts
}

const UA_PATH = runDir + '/4-analysis/unified-atoms.json'
const BB_PATH = runDir + '/4-analysis/business-behavior.json'
const PARTS_DIR = runDir + '/4-analysis/runtime/behavior-parts'

// ============================================================
// 1. 准备分片（确定性：按阶段分组 conflict-fast + full 原子）
// ============================================================

phase('准备分析分片')

const ua = await agent(
  [
    '你是 unified-atoms 读取器，工作目录为项目根目录。只做读取与转写，不做解读。',
    '',
    '任务：用 read 读取 ' + UA_PATH + '（可能较大，可分段读）。返回：analysisRunId，',
    '以及每个 atomId 对应的 analysisPath（conflict-fast / full / blocked）、verificationScope、upgraded、previousRunId。',
    '不要返回 requirement 正文（太大）。只输出结构化结果。',
  ].join('\n'),
  withModel({
    label: '读取统一原子视图',
    schema: {
      type: 'object',
      properties: {
        analysisRunId: { type: 'string' },
        atoms: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              atomId: { type: 'string' },
              analysisPath: { type: 'string' },
              verificationScope: { type: 'string' },
              upgraded: { type: 'boolean' },
              previousRunId: { type: 'string' },
            },
            required: ['atomId', 'analysisPath'],
          },
        },
      },
      required: ['analysisRunId', 'atoms'],
    },
    timeoutMs: 1800000,
    retries: 2,
  })
)
if (!ua || !Array.isArray(ua.atoms)) throw new Error('unified-atoms 回读异常')
const analysisRunId = String(ua.analysisRunId || '')
if (!analysisRunId) throw new Error('unified-atoms.analysisRunId 缺失（S6 未跑？）')

const eligible = ua.atoms.filter((a) => a.analysisPath === 'conflict-fast' || a.analysisPath === 'full')
const blockedCount = ua.atoms.filter((a) => a.analysisPath === 'blocked').length
if (eligible.length === 0) {
  log('S7 无需分析：全部原子 blocked（' + blockedCount + '），跳过 agent 调度')
}

// 按阶段分组（atomId 形如 AT-ST-Cxx-nnn）
const byStage = new Map()
for (const a of eligible) {
  const m = /^AT-(ST-C\d{2})-\d{3}$/.exec(a.atomId)
  const stageId = m ? m[1] : 'ST-C00'
  if (!byStage.has(stageId)) byStage.set(stageId, [])
  byStage.get(stageId).push(a.atomId)
}
const stageGroups = [...byStage.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1))

// 分片写盘（确定性：主编排用 echo agent 写，agent 只读）
const partDocs = []
for (const [stageId, atomIds] of stageGroups) {
  const sortedIds = atomIds.slice().sort()
  const file = stageId + '-bp01.json'
  partDocs.push({ stageId, file, atomIds: sortedIds, path: PARTS_DIR + '/' + file })
}
if (partDocs.length > 0) {
  const echoText = JSON.stringify(
    partDocs.map((p) => ({ schemaVersion: 1, stageId: p.stageId, partNo: '01', analysisRunId, atomIds: p.atomIds })),
    null,
    1
  )
  await agent(
    [
      '你是分片写盘器。任务：把下列 JSON 数组按顺序拆成独立文件写盘（UTF-8，1 空格缩进）：',
      partDocs.map((p, i) => '  第 ' + (i + 1) + ' 个 → ' + p.path).join('\n'),
      '每个文件内容 = 数组中对应元素。逐字复制，不得改写字段。只写这些文件，不执行 git。',
      '',
      'PART-BEGIN',
      echoText,
      'PART-END',
    ].join('\n'),
    { label: '写 S7 分片清单', agentType: 'general', timeoutMs: 900000, retries: 2, ...withModel({}) }
  )
}

// ============================================================
// 2. 并行业务行为还原
// ============================================================

phase('并行业务行为还原')

const SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    partFile: { type: 'string' },
    atomCount: { type: 'number' },
    consistent: { type: 'number' },
    partial: { type: 'number' },
    conflict: { type: 'number' },
    unverified: { type: 'number' },
    conflictFast: { type: 'number' },
    upgraded: { type: 'number' },
  },
  required: ['partFile', 'atomCount', 'consistent', 'partial', 'conflict', 'unverified'],
}

// ---- Prompt 全文（S7） ----
function behaviorPrompt(p) {
  const outPath = runDir + '/4-analysis/runtime/behavior-output/' + p.file
  return [
    '你是杭州麻将好友房需求的**业务行为还原员**。工作目录为项目根目录。',
    '职责：把双端实现证据还原成玩家语言的实际业务行为，并做需求 vs 实际的差异初判。',
    '你不查证代码（证据已由 S4/S5 给出），不修改需求，不写其他文件。',
    '',
    '## 一、输入',
    '1. 本片清单：' + p.path + '（含 atomId 列表、analysisPath、analysisRunId）',
    '2. 统一原子视图：' + UA_PATH
      + '（每原子含 requirement{rule,uiRequirement,verificationScope,businessBehavior}、'
      + 'client{verdict,evidenceIds,observedBehavior,directConflict,conflictEvidenceIds,pending}、'
      + 'server{applicability,evidenceIds,configCondition,directConflict,conflictEvidenceIds,pending}、upgraded、previousRunId）',
    '3. 历史基线（升级原子必看）：' + runDir + '/4-analysis/analysis-history.json（若存在）',
    '只需处理本片清单里的原子，**逐个处理，不得遗漏**。',
    '',
    '## 二、双路径规则（按原子 analysisPath 分流）',
    '',
    '### 路径 A：conflict-fast（只做冲突判定）',
    '- 已完成端（pending=false）已给出 directConflict=true 的直接矛盾证据。',
    '- 你的任务是把这个矛盾**用玩家语言表述清楚**：需求怎么说的、实际表现是什么。',
    '- 必填：baselineDifference = "conflict"、baselineDetail（需求原文 vs 实际表现）、evidenceIds（引用矛盾证据）。',
    '- **trigger / condition / clientAction / serverAction / collaboration / result 允许全部空串** ——',
    '  快速路径只要求冲突判定字段，**禁止为了满足 Schema 编造完整业务行为**。',
    '- 若另一端已完成且证据可用，可在 detail 中补充双端断点位置；另一端 pending 时不要臆测其行为。',
    '',
    '### 路径 B：full（完整还原 + 完整差异初判）',
    '必填业务行为字段（玩家语言，禁止类名/方法名/协议名/文件路径）：',
    '- trigger：什么事件触发该行为',
    '- condition：什么条件下生效（含配置生效条件，若服务端 applicability=conditional 必须写清）',
    '- clientAction：客户端负责做什么',
    '- serverAction：服务端负责做什么（含配置项影响）',
    '- collaboration：双端协作链（消息流叙述，如「客户端点击 → 发 MsgChi → 服务端校验 → 回 MsgChiResult → 客户端刷新」但用行为语言）',
    '- result：玩家最终看到什么',
    '差异判定 baselineDifference 四值：',
    '- consistent：明确符合需求，且判定所依赖的必要端证据充分',
    '- partial：部分子要求已验证满足、其余未验证（未证实 ≠ 证实不符）',
    '- conflict：发现明确与需求矛盾的实现（必须填 baselineDetail + 对应职责域证据）',
    '- unverified：证据不足以判定符合性（含只有一端证据、另一端 unknown/pending）',
    '',
    '## 三、判定纪律（关键）',
    '1. **conflict 判定不受 verificationScope 限制**：任一端矛盾证据即可立 conflict。',
    '2. **consistent 受 verificationScope 约束**：',
    '   - verificationScope=both：必须两端证据都充分才能判 consistent；任一端 unknown/pending → 只能 unverified',
    '   - verificationScope=client：只看客户端证据（服务端 unknown 不降级，但也不得因服务端缺失判 conflict）',
    '   - verificationScope=server：只看服务端证据（客户端 not_found 不构成问题）',
    '3. **client verdict 语义**：confirmed 只表示「找到了代码」，不代表实现正确；partial 表示只有部分证据。',
    '   客户端 confirmed 但服务端 unknown（如番数计算类需求）→ 必须 unverified，**绝不可 consistent**。',
    '4. **conflict 证据域要求**（证据必须覆盖冲突发生的职责域）：',
    '   - 客户端视觉冲突 → CLE 直接证据即可（如牌河财神高亮）',
    '   - 服务端规则冲突 → SVE 直接证据即可（如流局换庄）',
    '   - 双端协作冲突 → 按断点所在职责域要求相关端证据',
    '   - 只有间接证据 → 不得判 conflict，归 unverified 或 partial',
    '',
    '## 四、升级原子专项（upgraded=true 时必读）',
    '此类原子上轮是 conflict-fast，本轮已升级为 full 重判。铁律：',
    '1. **baselineDifference 必须保持历史基线**（通常为 conflict），**不要**用本轮重判结果覆盖它。',
    '2. 本轮重判结果写入 candidateDifference（可与历史基线不同，如发现原冲突不成立 → candidateDifference="consistent"）。',
    '3. candidateDifference ≠ baselineDifference 时，candidateDetail **必填**（说明候选依据，引用双端证据）。',
    '4. previousRunId / previousBaselineDifference 必须原样填 S6 给出的值（严禁改写、严禁跨原子取值）。',
    '5. 候选只是候选：改变正式结论必须走 S8 复核 + 人工批准，你不得自行判定生效。',
    '6. baselineDetail 仍要写清历史冲突内容（从 analysis-history 该原子最近记录或 S6 数据取）。',
    '',
    '## 五、证据引用',
    '- evidenceIds：CLE 与 SVE **混引**（前缀区分：CLE-* / SVE-*），必须来自该原子 S4/S5 的 evidenceIds。',
    '- 追加引用会由确定性脚本校正；你只需填该原子实际用于判定的证据。',
    '- analysisRunId：填本片清单给的 analysisRunId（必须一致）。',
    '',
    '## 六、输出',
    '用 write 写文件：' + outPath + '（UTF-8，JSON，1 空格缩进）：',
    '{',
    '  "schemaVersion": 1,',
    '  "analysisRunId": "<本片 analysisRunId>",',
    '  "entries": [',
    '    {',
    '      "atomId": "", "analysisPath": "conflict-fast|full", "analysisRunId": "",',
    '      "previousRunId": "", "previousBaselineDifference": "",',
    '      "trigger": "", "condition": "", "clientAction": "", "serverAction": "",',
    '      "collaboration": "", "result": "",',
    '      "baselineDifference": "consistent|partial|conflict|unverified", "baselineDetail": "",',
    '      "candidateDifference": "", "candidateDetail": "",',
    '      "evidenceIds": []',
    '    }',
    '  ]',
    '}',
    '只写这一个文件，不写其他文件，不执行 git。',
    '',
    '## 七、返回摘要',
    'partFile / atomCount / consistent / partial / conflict / unverified / conflictFast / upgraded。',
    '校验：四个差异值合计 = atomCount。',
    '',
    '## 八、严禁事项',
    '- 严禁为满足 Schema 编造业务行为（尤其 conflict-fast 路径）',
    '- 严禁把 verdict=confirmed 当实现正确',
    '- 严禁覆盖升级原子的历史基线',
    '- 严禁执行 git、严禁写 business-behavior.json / analysis-history.json（确定性脚本写）',
  ].join('\n')
}

const results = await parallel(
  partDocs.map((p) => () =>
    agent(
      behaviorPrompt(p),
      withModel({
        label: '业务行为还原 ' + p.stageId,
        agentType: 'general',
        schema: SUMMARY_SCHEMA,
        timeoutMs: 3600000,
        retries: 2,
      })
    )
  )
)

// 落盘闸门
const outDir = runDir + '/4-analysis/runtime/behavior-output'
const missing = []
for (const p of partDocs) {
  const ok = await check(() => fileExists(outDir + '/' + p.file), '落盘闸门：' + p.file)
  if (!ok) missing.push(p.file)
}
if (missing.length > 0) {
  throw new Error('S7 落盘闸门失败：' + missing.length + ' 个分片未写盘（' + missing.join(',') + '），请重跑 S7')
}

// ============================================================
// 3. 确定性汇总 + 历史落档
// ============================================================

phase('汇总与历史落档')

const partCsv = partDocs.map((p) => p.file).join(',')
const assembleOk = await commandSuccess(
  'node ".opencode-workflows/scripts/assemble-behavior-parts.mjs" --run-dir "' + runDir +
    '" --date "' + date + '" --parts "' + partCsv + '"',
  300000
)
if (!assembleOk) throw new Error('S7 分片汇总校验失败（见上方命令日志）')

const histOk = await commandSuccess(
  'node ".opencode-workflows/scripts/append-analysis-history.mjs" --run-dir "' + runDir +
    '" --date "' + date + '" --trigger ' + trigger,
  300000
)
if (!histOk) throw new Error('S7 分析历史追加校验失败（见上方命令日志）')

const final = await agent(
  [
    '你是汇总结果回读器，工作目录为项目根目录。只做读取与转写。',
    '',
    '任务：read ' + runDir + '/4-analysis/runtime/behavior-recount.json（全文小文件），原样返回 stats 字段：',
    'atomCount / consistent / partial / conflict / unverified / conflictFast / upgraded。',
    '只输出结构化结果。',
  ].join('\n'),
  withModel({
    label: '回读 S7 汇总',
    schema: {
      type: 'object',
      properties: {
        atomCount: { type: 'number' },
        consistent: { type: 'number' },
        partial: { type: 'number' },
        conflict: { type: 'number' },
        unverified: { type: 'number' },
        conflictFast: { type: 'number' },
        upgraded: { type: 'number' },
      },
      required: ['atomCount', 'consistent', 'partial', 'conflict', 'unverified'],
    },
    timeoutMs: 600000,
    retries: 2,
  })
)
if (!final || !Number.isInteger(final.atomCount)) throw new Error('S7 汇总回读异常：' + JSON.stringify(final))

log(
  'S7 业务行为还原完成：' + analysisRunId + ' / 原子 ' + final.atomCount +
    '（conflict-fast ' + (final.conflictFast || 0) + ' / 升级 ' + (final.upgraded || 0) + '）' +
    ' / 差异初判 consistent ' + final.consistent + ' / partial ' + final.partial +
    ' / conflict ' + final.conflict + ' / unverified ' + final.unverified +
    (blockedCount > 0 ? '（blocked ' + blockedCount + ' 不入判定）' : '') +
    ' -> ' + BB_PATH
)

return {
  analysisRunId,
  atomCount: final.atomCount,
  blockedCount,
  partCount: partDocs.length,
  stats: {
    consistent: final.consistent,
    partial: final.partial,
    conflict: final.conflict,
    unverified: final.unverified,
    conflictFast: final.conflictFast || 0,
    upgraded: final.upgraded || 0,
  },
  behaviorPath: BB_PATH,
  historyPath: runDir + '/4-analysis/analysis-history.json',
}
