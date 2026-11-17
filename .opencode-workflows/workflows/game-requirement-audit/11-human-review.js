// Game-Requirement-Audit 子流程 S11：人工裁决（评审 P0-2/P1-2 整改版）
//
// 执行文档 §5 S11、§16.2、§11.8。职责：
//   1. decisions.json 是否存在？不存在 → 返回待人工输入（不产 impact-set）
//   2. bind：为决议绑定 Atom 级 evidenceFingerprint + 审批依据基线（decision-fingerprint.mjs）
//   3. check：适用性清单（valid / stale / orphan）—— stale 决议**不自动沿用**
//   4. apply：应用审批（stale 跳过）+ 影响集合新旧证据 diff + 补证分片 + 证据快照
//
// stageVersion：S11@1

export const meta = {
  id: 'game-requirement-audit-human-review',
  name: 'game_requirement_audit_human_review',
  description: 'S11 人工裁决：决议指纹绑定 → 适用性检查（stale 不自动沿用）→ 审批应用 + 影响集合证据 diff',
  phases: [{ title: '决议指纹与适用性' }, { title: '应用决议' }],
}

const A = args || {}
const runDir = String(A.runDir || '').trim()
if (!runDir) throw new Error('runDir 必填')
const date = String(A.date || '').trim()
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date 必填 YYYY-MM-DD')
const analysisModel =
  A.analysisModel === undefined ? 'biangfeng-gateway/deepseek-v4.1-flash-official' : A.analysisModel
setConcurrency(A.concurrency || 16)
const withModel = (o) => (analysisModel ? { model: analysisModel, ...o } : o)

const DECISIONS = runDir + '/6-review/decisions.json'

phase('决议指纹与适用性')

const hasDecisions = await check(() => fileExists(DECISIONS), 'decisions.json')
if (!hasDecisions) {
  log(
    'S11 待人工输入：' + DECISIONS + ' 不存在。\n' +
      '  请按以下结构写入决议后重跑（mode=from-stage startStage=S11）：\n' +
      '  { "schemaVersion": 1, "date": "' + date + '", "decisions": [\n' +
      '    { "atomId": "AT-ST-C01-001",\n' +
      '      "action": "approve|modify|reject|hold|re-verify",\n' +
      '      "target": "difference-review|l7|pending",\n' +
      '      "retryScope": "client|server|both",\n' +
      '      "modifiedValue": "", "reason": "", "decidedAt": "' + date + '" } ] }\n' +
      '  待裁决条目见 5-specs/pending-list.md。'
  )
  return {
    status: 'awaiting-human-input',
    decisionsPath: DECISIONS,
    pendingListPath: runDir + '/5-specs/pending-list.md',
  }
}

// ---- 1. 绑定证据指纹（幂等：重复绑定按当前证据重算） ----
const bindOk = await commandSuccess(
  'node ".opencode-workflows/scripts/decision-fingerprint.mjs" bind --run-dir "' + runDir + '" --date "' + date + '"',
  300000
)
if (!bindOk) throw new Error('S11 决议指纹绑定失败（atomId 不在 unified-atoms 等，见上方命令日志）')

// ---- 2. 适用性检查（stale/orphan 须重新人工确认） ----
const checkOk = await commandSuccess(
  'node ".opencode-workflows/scripts/decision-fingerprint.mjs" check --run-dir "' + runDir + '"',
  300000
)
if (!checkOk) throw new Error('S11 决议适用性检查失败（见上方命令日志）')

const applic = await agent(
  [
    '你是文件回读器，工作目录为项目根目录。只做读取与转写。',
    '',
    '任务：read ' + runDir + '/6-review/runtime/decision-applicability.json（小文件），返回：',
    'currentRunId、valid / stale / orphan 三个计数，以及 items 中 status 为 stale 或 orphan 的',
    'atomId + status + reason 列表（最多 30 条）。只输出结构化结果。',
  ].join('\n'),
  withModel({
    label: '回读决议适用性',
    schema: {
      type: 'object',
      properties: {
        currentRunId: { type: 'string' },
        valid: { type: 'number' },
        stale: { type: 'number' },
        orphan: { type: 'number' },
        staleItems: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              atomId: { type: 'string' },
              status: { type: 'string' },
              reason: { type: 'string' },
            },
            required: ['atomId', 'status'],
          },
        },
      },
      required: ['valid', 'stale', 'orphan'],
    },
    timeoutMs: 900000,
    retries: 2,
  })
)
if (!applic || !Number.isInteger(applic.valid)) {
  throw new Error('决议适用性回读异常：' + JSON.stringify(applic))
}
const staleTotal = (applic.stale || 0) + (applic.orphan || 0)
if (staleTotal > 0) {
  log('S11 注意：' + staleTotal + ' 条决议已过期（不自动沿用，须重新人工确认）：')
  for (const x of applic.staleItems || []) log('  - ' + x.atomId + '（' + x.status + '）：' + (x.reason || ''))
}

// ---- 3. 应用决议（stale 由 apply-decisions 跳过） ----
phase('应用决议')

const applyOk = await commandSuccess(
  'node ".opencode-workflows/scripts/apply-decisions.mjs" --run-dir "' + runDir + '" --date "' + date + '"',
  300000
)
if (!applyOk) throw new Error('S11 决议应用失败（decisions 校验未通过，见上方命令日志）')

const applied = await agent(
  [
    '你是文件回读器，工作目录为项目根目录。只做读取与转写。',
    '',
    '任务：read ' + runDir + '/6-review/runtime/impact-set.json（小文件），返回：',
    'analysisRunId；retryScopeTargets.client 与 .server 数组长度；impactSet.client 与 .server 数组长度；',
    'evidenceDiff.client 与 .server 的 changed/added/removed 数组长度；evidenceDiff.degraded（布尔）。',
    '只输出结构化结果。',
  ].join('\n'),
  withModel({
    label: '回读影响集合',
    schema: {
      type: 'object',
      properties: {
        analysisRunId: { type: 'string' },
        retryClient: { type: 'number' },
        retryServer: { type: 'number' },
        impactClient: { type: 'number' },
        impactServer: { type: 'number' },
        changedClient: { type: 'number' },
        changedServer: { type: 'number' },
        addedClient: { type: 'number' },
        addedServer: { type: 'number' },
        removedClient: { type: 'number' },
        removedServer: { type: 'number' },
        degraded: { type: 'boolean' },
      },
      required: ['impactClient', 'impactServer'],
    },
    timeoutMs: 900000,
    retries: 2,
  })
)
if (!applied || !Number.isInteger(applied.impactClient)) {
  throw new Error('影响集合回读异常：' + JSON.stringify(applied))
}

log(
  'S11 人工裁决完成：决议 valid ' + applic.valid + ' / stale ' + (applic.stale || 0) + ' / orphan ' + (applic.orphan || 0) +
    ' / 补证目标 client ' + (applied.retryClient || 0) + ' server ' + (applied.retryServer || 0) +
    ' / 影响集合 client ' + applied.impactClient + ' server ' + applied.impactServer +
    '（证据 diff 客户端 改' + (applied.changedClient || 0) + '/增' + (applied.addedClient || 0) +
    '/删' + (applied.removedClient || 0) +
    ' 服务端 改' + (applied.changedServer || 0) + '/增' + (applied.addedServer || 0) +
    '/删' + (applied.removedServer || 0) +
    (applied.degraded ? '；降级：无上轮证据快照' : '') + '）'
)

return {
  status: 'applied',
  currentRunId: applic.currentRunId || '',
  applicability: {
    valid: applic.valid,
    stale: applic.stale || 0,
    orphan: applic.orphan || 0,
    staleItems: applic.staleItems || [],
  },
  impactSet: {
    retryTargets: { client: applied.retryClient || 0, server: applied.retryServer || 0 },
    impact: { client: applied.impactClient, server: applied.impactServer },
    evidenceDiff: {
      client: {
        changed: applied.changedClient || 0,
        added: applied.addedClient || 0,
        removed: applied.removedClient || 0,
      },
      server: {
        changed: applied.changedServer || 0,
        added: applied.addedServer || 0,
        removed: applied.removedServer || 0,
      },
      degraded: applied.degraded === true,
    },
  },
  impactSetPath: runDir + '/6-review/runtime/impact-set.json',
  retryInputDir: runDir + '/6-review/runtime/retry-input',
  decisionsPath: DECISIONS,
  requiresReconfirm: staleTotal,
}
