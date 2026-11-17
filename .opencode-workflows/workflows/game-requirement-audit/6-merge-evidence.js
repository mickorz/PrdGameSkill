// Game-Requirement-Audit 子流程 S6：证据汇总（同步屏障，确定性，无 agent 语义判断）
//
// 执行文档 §5 S6、§14.1。directConflict 是 S4/S5 已落的语义信号，本步只做布尔消费。
// stageVersion：S6@1

export const meta = {
  id: 'game-requirement-audit-merge-evidence',
  name: 'game_requirement_audit_merge_evidence',
  description: 'S6 证据汇总：同步屏障 + 分析路径三分（conflict-fast/full/blocked）+ 升级识别 + analysisRunId',
  phases: [{ title: '证据汇总' }],
}

const A = args || {}
const runDir = String(A.runDir || '').trim()
if (!runDir) throw new Error('runDir 必填')
const date = String(A.date || '').trim()
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date 必填 YYYY-MM-DD')
const analysisModel = A.analysisModel === undefined ? 'biangfeng-gateway/deepseek-v4.1-flash-official' : A.analysisModel
setConcurrency(A.concurrency || 16)
const withModel = (o) => (analysisModel ? { model: analysisModel, ...o } : o)

phase('证据汇总')

const ok = await commandSuccess(
  'node ".opencode-workflows/scripts/merge-evidence.mjs" --run-dir "' + runDir + '" --date "' + date + '"',
  300000
)
if (!ok) throw new Error('S6 证据汇总闸门未通过（pending 矛盾/引用一致性/analysisRunId 冲突，见上方命令日志）')

const stats = await agent(
  [
    '你是文件回读器，工作目录为项目根目录。只做读取与转写。',
    '',
    '任务：read ' + runDir + '/4-analysis/unified-atoms.json（可能较大，可分段），返回 analysisRunId 与 stats 块数字字段：',
    'atomCount / conflictFast / full / blocked / upgraded / clientPending / serverPending / dualLocated / clientOnly / serverOnly。',
    '只输出结构化结果。',
  ].join('\n'),
  withModel({
    label: '回读 S6 统计',
    schema: {
      type: 'object',
      properties: {
        analysisRunId: { type: 'string' },
        atomCount: { type: 'number' },
        conflictFast: { type: 'number' },
        full: { type: 'number' },
        blocked: { type: 'number' },
        upgraded: { type: 'number' },
        clientPending: { type: 'number' },
        serverPending: { type: 'number' },
        dualLocated: { type: 'number' },
        clientOnly: { type: 'number' },
        serverOnly: { type: 'number' },
      },
      required: ['analysisRunId', 'atomCount'],
    },
    timeoutMs: 1800000,
    retries: 2,
  })
)
if (!stats || !stats.analysisRunId) throw new Error('S6 统计回读异常：' + JSON.stringify(stats))

log(
  'S6 证据汇总完成：' + stats.analysisRunId + ' / 原子 ' + stats.atomCount +
    '（conflict-fast ' + (stats.conflictFast || 0) + ' / full ' + (stats.full || 0) +
    ' / blocked ' + (stats.blocked || 0) + ' / 升级 ' + (stats.upgraded || 0) + '；' +
    'pending client ' + (stats.clientPending || 0) + ' server ' + (stats.serverPending || 0) + '）'
)

return {
  analysisRunId: stats.analysisRunId,
  stats: {
    atomCount: stats.atomCount,
    conflictFast: stats.conflictFast || 0,
    full: stats.full || 0,
    blocked: stats.blocked || 0,
    upgraded: stats.upgraded || 0,
    clientPending: stats.clientPending || 0,
    serverPending: stats.serverPending || 0,
  },
  unifiedAtomsPath: runDir + '/4-analysis/unified-atoms.json',
}
