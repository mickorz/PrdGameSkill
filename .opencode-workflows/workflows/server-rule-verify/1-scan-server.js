// Server-Rule-Verify 子流程 1/4：扫描服务端（确定性）
//
// 职责：重建服务端符号索引 <outDir>/symbol-index.json（build-symbol-index.mjs CLI，
//       确定性扫描无 LLM；同名覆盖，内容确定性），回读 stats 供主编排汇总。
//
// 由主 workflow 经显式路径调用（本目录不在注册表扫描范围）：
//   await workflow({ scriptPath: './.opencode-workflows/workflows/server-rule-verify/1-scan-server.js', label: '扫描服务端' }, childArgs)
//
// args（主 workflow 透传）：
//   outDir        产物目录，默认 spec-workflow/output-spec/server-rule-verify
//   serverSrcRoot 服务端源码根（只读），默认 E:/WorkProjects/xc-flow/.xflow/xc/xcodeDev/game-mahjong/server/Logic/mahjong_server/src
//   date          运行日期，默认 2026-11-14
//
// 返回：{ symbolIndexPath, stats }

export const meta = {
  id: 'server-rule-verify-scan-server',
  name: 'server_rule_verify_scan_server',
  description: '确定性重建服务端符号索引（build-symbol-index.mjs）并回读统计',
  phases: [{ title: '扫描服务端' }],
}

const A = args || {}

const outDir = A.outDir || 'spec-workflow/output-spec/server-rule-verify'
const serverSrcRoot =
  A.serverSrcRoot ||
  'E:/WorkProjects/xc-flow/.xflow/xc/xcodeDev/game-mahjong/server/Logic/mahjong_server/src'
const date = A.date || '2026-11-14'
const analysisModel =
  A.analysisModel === undefined ? 'biangfeng-gateway/deepseek-v4.1-flash-official' : A.analysisModel

const symbolIndexPath = outDir + '/symbol-index.json'

function withModel(opts) {
  return analysisModel ? { model: analysisModel, ...opts } : opts
}

phase('扫描服务端')

// 确定性重建（源码根不存在/扫描出错 CLI 退出码非 0，此处 fail fast）
const buildCmd =
  'node ".opencode-workflows/scripts/build-symbol-index.mjs" build "' +
  serverSrcRoot + '" "' + symbolIndexPath + '" "' + date + '"'
const buildOk = await commandSuccess(buildCmd, 300000)
if (!buildOk) {
  throw new Error('符号索引构建失败（源码根不存在或扫描出错）：' + serverSrcRoot)
}
const written = await check(() => fileExists(symbolIndexPath), 'symbol-index.json 未生成：' + symbolIndexPath)
if (!written) {
  throw new Error('落盘闸门：symbol-index.json 未生成：' + symbolIndexPath)
}

// stats 回读（agent 读头部统计块，结构化返回）
const stats = await agent(
  [
    '你是符号索引统计回读器，工作目录为项目根目录。只做读取与转写，不做解读。',
    '',
    '任务：用 read 工具读取文件 ' + symbolIndexPath + ' 的前 40 行（offset 1，limit 40），',
    '找到 stats 对象并原样返回其中的数字字段：files / excludedGenerated / classes / methods /',
    'functions / configKeys / symbols。只输出结构化结果。',
  ].join('\n'),
  withModel({
    label: '回读索引统计',
    schema: {
      type: 'object',
      properties: {
        files: { type: 'number' },
        excludedGenerated: { type: 'number' },
        classes: { type: 'number' },
        methods: { type: 'number' },
        functions: { type: 'number' },
        configKeys: { type: 'number' },
        symbols: { type: 'number' },
      },
      required: ['files', 'classes', 'methods', 'functions', 'configKeys', 'symbols'],
    },
    timeoutMs: 600000,
    retries: 2,
  })
)
if (!stats || !Number.isInteger(stats.symbols) || stats.symbols < 1000) {
  throw new Error('符号索引统计回读异常：' + JSON.stringify(stats))
}

log(
  '符号索引就绪：' + stats.symbols + ' 符号 / ' + stats.files + ' 文件（classes ' + stats.classes +
    ' / methods ' + stats.methods + ' / functions ' + stats.functions + ' / configKeys ' + stats.configKeys +
    '，排除 pb 生成文件 ' + (stats.excludedGenerated || 0) + '）-> ' + symbolIndexPath
)

return { symbolIndexPath: symbolIndexPath, stats: stats }
