// Server-Rule-Verify 子流程 2/4：原子匹配
//
// 职责：prepare-verify-atoms.mjs 确定性生成分片输入（runtime/verify-input/），
//       agent 按分片并行——查符号索引（query CLI）+ 读服务端源码切片确认语义相关性，
//       匹配候选落盘 runtime/match-output/<stageId>-p<NN>.json（含落盘闸门）。
//
// 由主 workflow 经显式路径调用（本目录不在注册表扫描范围）：
//   await workflow({ scriptPath: './.opencode-workflows/workflows/server-rule-verify/2-match-atoms.js', label: '原子匹配' }, childArgs)
//
// args（主 workflow 透传）：
//   stageIds         目标阶段 CSV 或 ALL
//   featureIndexPath 基线 feature_index（v2 只读）
//   outDir           产物目录
//   date             运行日期
//   symbolIndexPath  子流程 1 产物路径
//   analysisModel    分析类模型（缺省 deepseek flash）
//
// 返回：{ parts, stages }（stages = manifest 阶段分片清单，供子流程 3/4 复用）

export const meta = {
  id: 'server-rule-verify-match-atoms',
  name: 'server_rule_verify_match_atoms',
  description: '分片输入准备 + agent 查符号索引与读源码切片，产出匹配候选并落盘',
  phases: [
    { title: '准备匹配输入' },
    { title: '并行匹配' },
  ],
}

const A = args || {}

const stageIds = String(A.stageIds || 'ALL').trim()
const featureIndexPath =
  A.featureIndexPath || 'spec-workflow/output-spec/2026-11-14/1-spec/feature_index.json'
const outDir = A.outDir || 'spec-workflow/output-spec/server-rule-verify'
const serverSrcRoot =
  A.serverSrcRoot ||
  'E:/WorkProjects/xc-flow/.xflow/xc/xcodeDev/game-mahjong/server/Logic/mahjong_server/src'
const date = A.date || '2026-11-14'
const symbolIndexPath = A.symbolIndexPath || outDir + '/symbol-index.json'
const analysisModel =
  A.analysisModel === undefined ? 'biangfeng-gateway/deepseek-v4.1-flash-official' : A.analysisModel

setConcurrency(A.concurrency || 16)

function withModel(opts) {
  return analysisModel ? { model: analysisModel, ...opts } : opts
}

const MANIFEST_SCHEMA = {
  type: 'object',
  properties: {
    stages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          stageId: { type: 'string' },
          stageName: { type: 'string' },
          atomCount: { type: 'number' },
          partCount: { type: 'number' },
          partFiles: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['stageId', 'atomCount', 'partCount', 'partFiles'],
      },
    },
  },
  required: ['stages'],
}

const MATCH_SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    partFile: { type: 'string', description: '分片文件名，不含目录路径，与输入分片同名（如 ST-C01-p01.json）' },
    atomCount: { type: 'number' },
    matched: { type: 'number' },
    partial: { type: 'number' },
    none: { type: 'number' },
  },
  required: ['partFile', 'atomCount', 'matched', 'partial', 'none'],
}

// partFile 校验归一化：agent 可能回完整路径，取与期望文件名一致即通过
function partFileMatches(got, expected) {
  if (typeof got !== 'string' || got === '') return false
  const g = got.replaceAll('\\', '/')
  return g === expected || g.endsWith('/' + expected)
}

function matchPrompt(partFile) {
  return [
    '你是服务端规则补证的匹配器，工作目录为项目根目录。只做检索、读取与结构化转写，不做落判（落判是下一子流程的职责）。',
    '服务端源码根（只读）：' + serverSrcRoot,
    '',
    '任务：为分片 ' + partFile + ' 中的每个原子定位服务端代码证据候选，落盘匹配结果。',
    '',
    '步骤：',
    '1. 读取 ' + outDir + '/runtime/verify-input/' + partFile + '（分片输入：原子业务字段 + 既有正式条目',
    '   existingScopeEntries / existingSve——幂等重跑参考：已覆盖证据的 file:line 可直接复用，但须读源码复核行号仍有效）。',
    '2. 对每个原子：从 rule / ui_requirement / difference_detail 提炼 2~4 个检索词（英文函数名/类名/配置 key',
    '   优先，如 JudgeZhuang / UpdateBankerLevel / first_banker_type；中文语义词翻译成英文标识符猜测），逐个执行：',
    '   node ".opencode-workflows/scripts/build-symbol-index.mjs" query "' + symbolIndexPath + '" "<term>"',
    '   （命中输出 file:line + 符号名；term 精确匹配，可试大小写变体与限定名 ClassName::Method）。',
    '3. 对 query 命中的候选：用 read 工具读源码行段确认语义相关性——完整路径 = ' + serverSrcRoot + '/ + 符号索引的',
    '   file 字段（形如 game_hzmj/common_game/...），read 参数 offset = 命中行号 - 30，limit 120。',
    '   与原子规则语义无关的命中（同名不同义）标记 relevant=false 或直接不保留。',
    '4. 把每个原子的匹配结果写入 ' + outDir + '/runtime/match-output/' + partFile + '（write 工具，UTF-8，JSON 1 空格缩进）：',
    '   { "schemaVersion": 1, "stageId": <分片的 stageId>, "partNo": <分片的 partNo>,',
    '     "entries": [ { "atomId": "...", "conclusion": "matched|partial|none",',
    '       "queries": [ { "term": "...", "hits": 0 } ],',
    '       "matches": [ { "file": "game_hzmj/...", "line": 0, "symbol": "...", "kind": "method|class|function|config-key", "relevant": true, "note": "一句话语义相关性" } ],',
    '       "configKeys": [ "first_banker_type" ] } ] }',
    '   matches 只保留 relevant=true 的候选；无命中的原子 conclusion="none"、matches=[]。',
    '   file 字段用符号索引里的相对路径原样（game_hzmj/ 前缀保留）。',
    '5. 只写这一个文件，不要写其他文件，不要执行 git 命令。',
    '6. 写完后返回结构化摘要（partFile 填分片文件名本身，不含目录路径，如 ST-C01-p01.json；',
    '   matched/partial/none 为各 conclusion 的原子数，三者之和 = atomCount）。',
  ].join('\n')
}

// ============================================================
// 准备匹配输入（确定性）
// ============================================================

phase('准备匹配输入')

const prepCmd =
  'node ".opencode-workflows/scripts/prepare-verify-atoms.mjs" "' +
  featureIndexPath + '" "' + outDir + '" "' + stageIds + '" "' + date + '"'
const prepOk = await commandSuccess(prepCmd, 120000)
if (!prepOk) {
  throw new Error('匹配输入准备失败（prepare-verify-atoms.mjs 退出码非 0，见其输出）')
}

// manifest 回读（agent 读小文件转写分片清单）
const manifest = await agent(
  [
    '你是清单回读器，工作目录为项目根目录。只做读取与转写。',
    '',
    '任务：用 read 工具读取 ' + outDir + '/runtime/verify-input/manifest.json（小文件），',
    '返回其中的 stages 数组（每项 stageId / stageName / atomCount / partCount / partFiles 原样转写）。',
    '只输出结构化结果。',
  ].join('\n'),
  withModel({ label: '回读分片清单', schema: MANIFEST_SCHEMA, timeoutMs: 600000, retries: 2 })
)
if (!manifest || !Array.isArray(manifest.stages) || manifest.stages.length === 0) {
  throw new Error('分片清单回读失败：' + JSON.stringify(manifest))
}
const partFiles = []
for (const s of manifest.stages) {
  if (!Array.isArray(s.partFiles) || s.partFiles.length === 0) {
    throw new Error('阶段无分片：' + s.stageId)
  }
  for (const f of s.partFiles) partFiles.push({ stageId: s.stageId, file: f })
}

// ============================================================
// 并行匹配（每分片一个 agent）
// ============================================================

phase('并行匹配')

const matchResults = await parallel(
  partFiles.map((p) => () =>
    agent(
      matchPrompt(p.file),
      withModel({
        label: '匹配 ' + p.stageId + ' ' + p.file,
        agentType: 'general',
        schema: MATCH_SUMMARY_SCHEMA,
        timeoutMs: 3600000,
        retries: 1,
      })
    )
  )
)

// 落盘闸门：agent 返回但未写盘当场拦截（S1.2 经验：跳过问题推迟到装配才暴露）
for (const p of partFiles) {
  const ok = await check(
    () => fileExists(outDir + '/runtime/match-output/' + p.file),
    '落盘闸门：匹配结果未写盘 ' + p.file
  )
  if (!ok) {
    throw new Error('落盘闸门：匹配结果未写盘 ' + outDir + '/runtime/match-output/' + p.file)
  }
}

const matchParts = []
let totalMatched = 0
let totalNone = 0
for (let i = 0; i < partFiles.length; i++) {
  const r = matchResults[i]
  if (!r || !partFileMatches(r.partFile, partFiles[i].file)) {
    throw new Error(
      '匹配摘要 partFile 不符：期望 ' + partFiles[i].file + ' 实际 ' + (r && r.partFile)
    )
  }
  const sum = (r.matched || 0) + (r.partial || 0) + (r.none || 0)
  if (sum !== r.atomCount) {
    throw new Error(
      '匹配摘要计数不自洽：' + r.partFile + ' matched+partial+none=' + sum + ' atomCount=' + r.atomCount
    )
  }
  matchParts.push(r)
  totalMatched += (r.matched || 0) + (r.partial || 0)
  totalNone += r.none || 0
}

log(
  '原子匹配完成：分片 ' + partFiles.length + ' 片 / 原子 ' +
    matchParts.reduce((n, r) => n + r.atomCount, 0) +
    '（有候选 ' + totalMatched + ' / 无候选 ' + totalNone + '）-> ' + outDir + '/runtime/match-output/'
)

return { parts: matchParts, stages: manifest.stages }
