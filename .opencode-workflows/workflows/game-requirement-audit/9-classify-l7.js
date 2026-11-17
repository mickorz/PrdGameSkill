// Game-Requirement-Audit 子流程 S9：L7 分类（确定性，无 agent）
//
// 执行文档 §5 S9、§15.2。scope 五级回落 + client verified 六前置 + 升级候选隔离 + blocked 派生。
// stageVersion：S9@1

export const meta = {
  id: 'game-requirement-audit-classify-l7',
  name: 'game_requirement_audit_classify_l7',
  description: 'S9 L7 分类：effectiveDifference × scope 矩阵（scope 五级回落 + client verified 六前置 + blocked 派生）',
  phases: [{ title: 'L7 分类' }],
}

const A = args || {}
const runDir = String(A.runDir || '').trim()
if (!runDir) throw new Error('runDir 必填')
const date = String(A.date || '').trim()
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date 必填 YYYY-MM-DD')
const analysisModel = A.analysisModel === undefined ? 'biangfeng-gateway/deepseek-v4.1-flash-official' : A.analysisModel
setConcurrency(A.concurrency || 16)
const withModel = (o) => (analysisModel ? { model: analysisModel, ...o } : o)

phase('L7 分类')

const ok = await commandSuccess(
  'node ".opencode-workflows/scripts/classify-l7-audit.mjs" --run-dir "' + runDir + '" --date "' + date + '"',
  300000
)
if (!ok) throw new Error('S9 L7 分类闸门未通过（矩阵/scope 回溯/client verified 前置，见上方命令日志）')

const stats = await agent(
  [
    '你是文件回读器，工作目录为项目根目录。只做读取与转写。',
    '',
    '任务：read ' + runDir + '/4-analysis/l7-classify.json（可能较大，只读 stats 与 blockedAtoms 长度），返回：',
    'analysisRunId、blockedCount（blockedAtoms 长度）、l7 四值计数、l7Approved 四值计数。',
    '只输出结构化结果。',
  ].join('\n'),
  withModel({
    label: '回读 S9 统计',
    schema: {
      type: 'object',
      properties: {
        analysisRunId: { type: 'string' },
        blockedCount: { type: 'number' },
        verified: { type: 'number' },
        verificationRequired: { type: 'number' },
        decisionRequired: { type: 'number' },
        notApplicable: { type: 'number' },
        approvedVerified: { type: 'number' },
        approvedDecisionRequired: { type: 'number' },
      },
      required: ['analysisRunId', 'blockedCount'],
    },
    timeoutMs: 1800000,
    retries: 2,
  })
)
if (!stats || !stats.analysisRunId) throw new Error('S9 统计回读异常：' + JSON.stringify(stats))

log(
  'S9 L7 分类完成：' + stats.analysisRunId +
    ' / verified ' + (stats.verified || 0) + ' / verification_required ' + (stats.verificationRequired || 0) +
    ' / decision_required ' + (stats.decisionRequired || 0) + ' / not_applicable ' + (stats.notApplicable || 0) +
    '（blocked 派生 ' + stats.blockedCount + '；approved verified ' + (stats.approvedVerified || 0) + '）'
)

return {
  analysisRunId: stats.analysisRunId,
  blockedCount: stats.blockedCount,
  l7: {
    verified: stats.verified || 0,
    verificationRequired: stats.verificationRequired || 0,
    decisionRequired: stats.decisionRequired || 0,
    notApplicable: stats.notApplicable || 0,
  },
  l7Path: runDir + '/4-analysis/l7-classify.json',
}
