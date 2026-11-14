// Server-Rule-Verify 子流程 3/4：作用域落判
//
// 职责：agent 按分片并行——读分片输入（verify-input）与匹配候选（match-output），
//       需要时补查符号索引与源码行段，逐原子作用域落判（active/conditional/inactive/
//       unknown + configCondition/callPath + SVE 证据条目 + DR 复核字段双写），
//       落盘 runtime/verify-output/<stageId>-p<NN>.json（含落盘闸门），
//       再经确定性重算闸门（recount-verify-parts.mjs：覆盖率/重复/枚举/分布，
//       agent 摘要计数仅告警）聚合 scopeStats。
//
// 由主 workflow 经显式路径调用（本目录不在注册表扫描范围）：
//   await workflow({ scriptPath: './.opencode-workflows/workflows/server-rule-verify/3-verify-scope.js', label: '作用域落判' }, childArgs + { symbolIndexPath, stages })
//
// args（主 workflow 透传）：
//   stages          子流程 2 返回的 manifest 阶段分片清单（内存链式传参，不重读 manifest）
//   outDir / serverSrcRoot / date / symbolIndexPath / analysisModel 同子流程 2
//
// 返回：{ parts, scopeStats }（scopeStats = 全部分片落判分布合计）

export const meta = {
  id: 'server-rule-verify-verify-scope',
  name: 'server_rule_verify_verify_scope',
  description: 'agent 按分片逐原子作用域落判：scope 条目 + SVE 证据 + DR 复核字段双写并落盘',
  phases: [{ title: '并行落判' }],
}

const A = args || {}

const outDir = A.outDir || 'spec-workflow/output-spec/server-rule-verify'
const serverSrcRoot =
  A.serverSrcRoot ||
  'E:/WorkProjects/xc-flow/.xflow/xc/xcodeDev/game-mahjong/server/Logic/mahjong_server/src'
const date = A.date || '2026-11-14'
const symbolIndexPath = A.symbolIndexPath || outDir + '/symbol-index.json'
const analysisModel =
  A.analysisModel === undefined ? 'biangfeng-gateway/deepseek-v4.1-flash-official' : A.analysisModel
const stages = Array.isArray(A.stages) ? A.stages : []

setConcurrency(A.concurrency || 16)

function withModel(opts) {
  return analysisModel ? { model: analysisModel, ...opts } : opts
}

const VERIFY_SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    partFile: { type: 'string', description: '分片文件名，不含目录路径，与输入分片同名（如 ST-C01-p01.json）' },
    atomCount: { type: 'number' },
    active: { type: 'number' },
    conditional: { type: 'number' },
    unknown: { type: 'number' },
    inactive: { type: 'number' },
    sveCount: { type: 'number' },
  },
  required: ['partFile', 'atomCount', 'active', 'conditional', 'unknown', 'inactive', 'sveCount'],
}

// partFile 校验归一化：agent 可能回完整路径，取与期望文件名一致即通过
function partFileMatches(got, expected) {
  if (typeof got !== 'string' || got === '') return false
  const g = got.replaceAll('\\', '/')
  return g === expected || g.endsWith('/' + expected)
}

// 客户端创房下发值口径（OSG-W4 S2.2 已核对，杭州麻将 42320 好友房）：
// 大厅 xuanwulobby RuleHzmj.ts（DefaultConfigHZMJ 全量下发，UI 未暴露项恒发默认值）
const CLIENT_DEFAULTS = [
  'first_banker_type=0（首局随机坐庄；UI 未暴露恒 0）',
  'rotate_banker_type=0（非首局赢家坐庄；UI 未暴露恒 0）',
  'draw_continue_banker=1（流局连庄；UI 未暴露恒 1）',
  'cai_shen_type=0（白板财神默认，玩家可选翻财神=1）',
  'banker_level_type=2（笃三老庄默认 -> 服务端三牢起步 8 倍；可选 0 平庄起/1 笃二老庄）',
  'enable_banker_discard_hu=1（庄闲放铳(庄三)默认；可选 0 自摸胡）',
  'enable_three_tan_bao=1 / pung_as_tan=1 / must_bao_tou_with_cai=0 / enable_three_cai_double=0 / enable_four_cai_double=0',
  'enable_ten_wind=1 / del_feng=0（无风牌默认不勾）',
  'enable_two_suit=1（缺一色：仅 2/3 人局展示且默认勾选 -> 服务端 ≤3 人剔万字；4 人局不展示）',
  'cai_for_hao_qi=0 / guard_dealer=0 / follow_banker=0 / lian_zhuang_bu_zhan=0 / base_score=1 / rule_chi_peng=0',
].join('；')

function verifyPrompt(partFile) {
  return [
    '你是服务端规则补证的作用域落判员，工作目录为项目根目录。判定证据必须真实：file:line 来自符号索引或实读源码，禁止编造。',
    '服务端源码根（只读）：' + serverSrcRoot,
    '',
    '判定口径（设计文档 3.1/3.3 摘要）：',
    '- active：服务端恒实现该规则，无玩法配置依赖（时序/常量/固定机制直证）',
    '- conditional：受玩法配置或人数等条件影响（configCondition 必填：配置 key + 创房默认值 + 可选值及其影响）',
    '- inactive：服务端实现了该能力但好友房恒不可达（需强证据：无 JSON 下发入口且无其他入口）',
    '- unknown：服务端证据不足（noServerEvidence=true，unresolved 写明缺什么证据；诚实落判，不猜）',
    '',
    '证据文件范围（硬约束）：仅限三根目录（相对服务端源码根）：game_hzmj/common_game/、',
    'game_hzmj/hzmj_server/、mah_frame/。变体目录（game_hzmj/chunanmj_server / hzmj2r_server /',
    'tonglumj_server / xiaoshanmj_server）与其他玩法目录（game_gzmj / game_scmj / game_simple /',
    'ai_model 等）是其他游戏/变体的实现，不是杭州麻将（42320）的证据，禁止引用其文件与行号。',
    '',
    '客户端创房下发值口径（S2.2 已核对，conditional 条件的默认值以此为准，引用写 client: RuleHzmj.ts）：',
    CLIENT_DEFAULTS,
    '',
    '步骤：',
    '1. 读取 ' + outDir + '/runtime/verify-input/' + partFile + '（原子业务字段 + 既有正式条目 existingScopeEntries /',
    '   existingSve——幂等重跑：结论一致时直接复用既有 SVE id 与条目字段）。',
    '2. 读取 ' + outDir + '/runtime/match-output/' + partFile + '（子流程 2 的匹配候选）。',
    '3. 证据不足时补查：node ".opencode-workflows/scripts/build-symbol-index.mjs" query "' + symbolIndexPath + '" "<term>"，',
    '   并用 read 工具读源码行段（完整路径 = ' + serverSrcRoot + '/ + file，offset 命中行号 - 30，limit 120）。',
    '4. 逐原子落判，写入 ' + outDir + '/runtime/verify-output/' + partFile + '（write 工具，UTF-8，JSON 1 空格缩进）：',
    '   { "schemaVersion": 1, "stageId": <分片 stageId>, "partNo": <分片 partNo>, "entries": [ {',
    '     "atomId": "...",',
    '     "applicability": "active|conditional|inactive|unknown",',
    '     "configVerified": true, "callPathVerified": true,',
    '     "configCondition": "（conditional 必填；其余空串）",',
    '     "callPath": "证据调用链摘要：函数名+file:line",',
    '     "evidenceIds": [ "SVE-..." ],',
    '     "unresolved": "（unknown 必填缺失说明；其余空串）",',
    '     "noServerEvidence": false,',
    '     "dr": { "scopeApplicability": "必须等于 applicability", "scopeNote": "一句话复核依据（引 SVE id 或源码行号）" },',
    '     "sve": [ { "id": "SVE-<stageId>-P<partNo>-<两位序号>", "atomId": "...",',
    '       "layer": "common_game|hzmj_server|mah_frame", "file": "<layer>/...",',
    '       "location": "<file>:<行号>", "symbol": "符号名", "excerpt": "关键代码/注释摘录（含直证语句）", "configKeys": [] } ] } ] }',
    '   规则：',
    '   - 双写要求（S2.1 经验闸门）：dr.scopeApplicability 必须等于 applicability。',
    '   - SVE.file 路径映射：符号索引 file 形如 game_hzmj/common_game/... -> SVE 写 common_game/...；',
    '     game_hzmj/hzmj_server/... -> hzmj_server/...；mah_frame/... 原样。location 必须以 file 开头（file:行号）。',
    '     file 必须与 location 冒号前的路径部分逐字符一致（含 com_game 等中间目录，不得省略任何目录段）；',
    '     校验闸门会逐条比对 file 与 location 前缀，漏写目录段整轮合并失败。',
    '   - 新增 SVE 编号 SVE-<stageId>-P<partNo>-NN（NN 从 01 起递增，本片内不得重复）；既有正式条目已覆盖的证据复用原 id（摘录可更新）。',
    '   - 共享证据（同一 file:line 服务多个原子，如同一配置 key 同时支撑两个规则原子）：SVE 只写一条',
    '     （放在首个引用的原子下，atomId 填该原子），其余原子在各自 evidenceIds 里引用同一个 id，',
    '     禁止把同 id 条目复制到多个原子下。',
    '   - 基线 difference=conflict 的原子（客户端视觉冲突类）：条目加 "evidenceScopes":',
    '     [ { "ref": "client-visual", "layer": "client", "applicability": "active", "note": "纯客户端冲突说明" } ]。',
    '   - unknown 落判也要全字段（sve 可为空数组，evidenceIds 可为空）。',
    '5. 只写这一个文件，不要写其他文件，不要执行 git 命令。',
    '6. 写完后返回结构化摘要（partFile 填分片文件名本身，不含目录路径，如 ST-C01-p01.json；',
    '   active+conditional+unknown+inactive = atomCount；sveCount = 本片 sve 条目总数）。',
  ].join('\n')
}

// ============================================================
// 并行落判（每分片一个 agent）
// ============================================================

phase('并行落判')

const partFiles = []
for (const s of stages) {
  for (const f of s.partFiles || []) partFiles.push({ stageId: s.stageId, file: f })
}
if (partFiles.length === 0) {
  throw new Error('stages 分片清单为空（子流程 2 未透传或清单损坏）')
}

const verifyResults = await parallel(
  partFiles.map((p) => () =>
    agent(
      verifyPrompt(p.file),
      withModel({
        label: '落判 ' + p.stageId + ' ' + p.file,
        agentType: 'general',
        schema: VERIFY_SUMMARY_SCHEMA,
        timeoutMs: 3600000,
        retries: 1,
      })
    )
  )
)

// 落盘闸门
for (const p of partFiles) {
  const ok = await check(
    () => fileExists(outDir + '/runtime/verify-output/' + p.file),
    '落盘闸门：落判结果未写盘 ' + p.file
  )
  if (!ok) {
    throw new Error('落盘闸门：落判结果未写盘 ' + outDir + '/runtime/verify-output/' + p.file)
  }
}

// 确定性重算闸门（S4.1 第三批坑 6：agent 返回的摘要计数可手误，
// 以落判分片文件为准重算覆盖率/重复/枚举/分布；agent 摘要仅用于告警）
const filesCsv = partFiles.map((p) => p.file).join(',')
const recountPath = outDir + '/runtime/verify-recount.json'
const recountCmd =
  'node ".opencode-workflows/scripts/recount-verify-parts.mjs" "' + outDir + '" "' +
  filesCsv + '" "' + recountPath + '"'
const recountOk = await commandSuccess(recountCmd, 120000)
if (!recountOk) {
  throw new Error(
    '落判分片重算闸门未通过（期望原子缺条目/混入外来原子/重复/枚举非法等问题，明细重跑：' +
      recountCmd
  )
}

// 重算结果回读（聚合口径以 recount 文件为准）
const recount = await agent(
  [
    '你是落判重算结果回读器，工作目录为项目根目录。只做读取与转写，不做解读。',
    '',
    '任务：用 read 工具读取文件 ' + recountPath + '（全文），原样返回其中数字字段：',
    'partCount / atomCount / sveCount / active / conditional / unknown / inactive。',
    '只输出结构化结果。',
  ].join('\n'),
  withModel({
    label: '回读落判重算',
    schema: {
      type: 'object',
      properties: {
        partCount: { type: 'number' },
        atomCount: { type: 'number' },
        sveCount: { type: 'number' },
        active: { type: 'number' },
        conditional: { type: 'number' },
        unknown: { type: 'number' },
        inactive: { type: 'number' },
      },
      required: ['partCount', 'atomCount', 'sveCount', 'active', 'conditional', 'unknown', 'inactive'],
    },
    timeoutMs: 600000,
    retries: 2,
  })
)
if (
  !recount ||
  recount.partCount !== partFiles.length ||
  !Number.isInteger(recount.atomCount) ||
  recount.atomCount < partFiles.length
) {
  throw new Error('落判重算回读异常：' + JSON.stringify(recount))
}

const parts = []
const scopeStats = {
  active: recount.active,
  conditional: recount.conditional,
  unknown: recount.unknown,
  inactive: recount.inactive,
}
for (let i = 0; i < partFiles.length; i++) {
  const r = verifyResults[i]
  if (!r || !partFileMatches(r.partFile, partFiles[i].file)) {
    throw new Error(
      '落判摘要 partFile 不符：期望 ' + partFiles[i].file + ' 实际 ' + (r && r.partFile)
    )
  }
  const sum = (r.active || 0) + (r.conditional || 0) + (r.unknown || 0) + (r.inactive || 0)
  if (sum !== r.atomCount) {
    log(
      '告警：agent 摘要计数不自洽（' + r.partFile + ' 四类合计=' + sum +
        ' atomCount=' + r.atomCount + '），以分片重算为准'
    )
  }
  parts.push(r)
}

log(
  '作用域落判完成：分片 ' + parts.length + ' 片，active ' + scopeStats.active +
    ' / conditional ' + scopeStats.conditional + ' / unknown ' + scopeStats.unknown +
    ' / inactive ' + scopeStats.inactive + ' -> ' + outDir + '/runtime/verify-output/'
)

return { parts: parts, scopeStats: scopeStats }
