// Game-Requirement-Audit 子流程 S3：注册表定稿（薄编排）
//
// 执行文档 §12.3。核心逻辑全部在确定性脚本 build-requirement-registry.mjs（唯一写者），
// 本子流程只做：commandSuccess 调度（full 模式）-> read-back agent 读 registry stats 返回。
//
// 由主 workflow 经显式路径调用（本目录不在注册表扫描范围）：
//   await workflow({ scriptPath: './.opencode-workflows/workflows/game-requirement-audit/3-build-registry.js', label: '注册表定稿' }, childArgs)
//
// args：
//   runDir   必填，run 根目录
//   date     必填，运行日期 YYYY-MM-DD（写入 registry.date；脚本内禁止取当前时间）
//
// 返回：
//   { registryPath, identityMapPath, stageCount, featureCount, atomCount, scopeStats }
//
// stageVersion：S3@1（specs：.opencode-workflows/scripts/stage-specs.game-requirement-audit.json）

export const meta = {
  id: 'game-requirement-audit-build-registry',
  name: 'game_requirement_audit_build_registry',
  description: '确定性合并原子分片定稿需求注册表（requirement-registry.json + identity-map.json）并回读统计',
  phases: [{ title: '注册表定稿' }],
}

const A = args || {}

const runDir = String(A.runDir || '').trim()
if (!runDir) {
  throw new Error('runDir 必填（run 根目录，由主编排 game-requirement-audit 创建后传入）')
}
const date = String(A.date || '').trim()
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  throw new Error('date 必填（YYYY-MM-DD，脚本内禁止取当前时间）')
}

phase('注册表定稿')

const registryPath = runDir + '/1-registry/requirement-registry.json'
const identityMapPath = runDir + '/1-registry/identity-map.json'

// 确定性合并（唯一写者 build-requirement-registry.mjs；校验失败 fail fast）
const buildCmd =
  'node ".opencode-workflows/scripts/build-requirement-registry.mjs" --run-dir "' + runDir +
  '" --date "' + date + '"'
const buildOk = await commandSuccess(buildCmd, 300000)
if (!buildOk) {
  throw new Error('Registry 合并闸门未通过（ID/行号落界/枚举/覆盖/统计问题，明细见上方命令日志；重跑 from-stage=S3 幂等）')
}

// registry stats 回读（read-back agent 读小文件 stats 快照，沿用 recount 回读先例）
const stats = await agent(
  [
    '你是注册表统计回读器，工作目录为项目根目录。只做读取与转写，不做解读。',
    '',
    '任务：用 read 工具读取文件 ' + runDir + '/1-registry/runtime/registry-stats.json（全文小文件），',
    '原样返回其中数字字段：stageCount / featureCount / atomCount，以及 scopeStats 的 client / server / both。',
    '只输出结构化结果。',
  ].join('\n'),
  {
    label: '回读注册表统计',
    schema: {
      type: 'object',
      properties: {
        stageCount: { type: 'number' },
        featureCount: { type: 'number' },
        atomCount: { type: 'number' },
        client: { type: 'number' },
        server: { type: 'number' },
        both: { type: 'number' },
      },
      required: ['stageCount', 'featureCount', 'atomCount', 'client', 'server', 'both'],
    },
    timeoutMs: 600000,
    retries: 2,
  }
)
if (!stats || !Number.isInteger(stats.atomCount) || stats.atomCount < 1) {
  throw new Error('注册表统计回读异常：' + JSON.stringify(stats))
}

log(
  '注册表定稿：阶段 ' + stats.stageCount + ' / 功能点 ' + stats.featureCount + ' / 原子 ' + stats.atomCount +
    '（scope：client ' + stats.client + ' / server ' + stats.server + ' / both ' + stats.both + '）-> ' + registryPath
)

return {
  registryPath: registryPath,
  identityMapPath: identityMapPath,
  stageCount: stats.stageCount,
  featureCount: stats.featureCount,
  atomCount: stats.atomCount,
  scopeStats: { client: stats.client, server: stats.server, both: stats.both },
}
