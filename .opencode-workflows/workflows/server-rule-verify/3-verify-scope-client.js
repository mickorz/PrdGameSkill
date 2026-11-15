// Server-Rule-Verify 子流程 3C：客户端侧查证落判（S8，设计 7）
//
// 职责：agent 按分片并行——读客户端查证输入（verify-input，-pc 分片：原子事实 + gapNotes
//       服务端零实现缺口 + clientRoots 两根目录），在客户端代码（source-code/client/Code
//       TS 逻辑 + source-code/client/Fgui FairyGUI 工程）检索每原子的界面/交互实现，
//       逐原子落判（applicability=client + callPath/evidenceIds + 客户端层 SVE 条目
//       （layer=client_code/client_fgui，id SVE-<stageId>-PC<partNo>-NN 代际隔离）
//       + DR 复核字段双写），落盘 runtime/verify-output/<stageId>-pc<NN>.json（含落盘闸门），
//       再经确定性重算闸门（recount-verify-parts.mjs）聚合 scopeStats。
//
// 与 3-verify-scope.js（服务端落判）的差异：检索根为客户端两目录、作用域落 client、
//       SVE 层为 client_code/client_fgui、无 match 候选输入（agent 直接 grep/glob/read）。
//
// 调用（workflow 工具显式 scriptPath）：
//   await workflow({ scriptPath: './.opencode-workflows/workflows/server-rule-verify/3-verify-scope-client.js', label: '客户端落判' }, childArgs)
//
// args：
//   stages          prepare-client-verify-input.mjs manifest 的 stages（[{stageId, partFiles}]）
//   outDir / date / analysisModel 同子流程 3
//
// 返回：{ parts, scopeStats }（scopeStats = 全部分片落判分布合计，含 client）

export const meta = {
  id: 'server-rule-verify-verify-scope-client',
  name: 'server_rule_verify_verify_scope_client',
  description: 'S8 客户端侧查证：agent 按分片在客户端代码检索逐原子落判（client 作用域 + client 层 SVE + DR 双写）并落盘',
  phases: [{ title: '客户端并行落判' }],
}

const A = args || {}

const outDir = A.outDir || 'spec-workflow/output-spec/server-rule-verify'
const date = A.date || '2026-11-14'
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
    partFile: { type: 'string', description: '分片文件名，不含目录路径，与输入分片同名（如 ST-C11-pc01.json）' },
    atomCount: { type: 'number' },
    client: { type: 'number', description: '落判 client 的原子数（含定位与未果，本流程恒等于 atomCount）' },
    located: { type: 'number', description: '定位到客户端实现的原子数' },
    notLocated: { type: 'number', description: '系统性检索未果（双端零实现）的原子数' },
    sveCount: { type: 'number' },
  },
  required: ['partFile', 'atomCount', 'client', 'located', 'notLocated', 'sveCount'],
}

function partFileMatches(got, expected) {
  if (typeof got !== 'string' || got === '') return false
  const g = got.replaceAll('\\', '/')
  return g === expected || g.endsWith('/' + expected)
}

function clientVerifyPrompt(stageId, partFile) {
  return [
    '你是需求差异查证员（客户端侧），工作目录为项目根目录。任务：对一组「服务端零实现」的需求原子，',
    '在客户端代码中检索界面/交互实现并逐原子落判。这些规则属客户端壳/纯表现交互（服务端三目录无实现角色），',
    '验证载体在客户端（设计 7.1 作用域 client）。',
    '',
    '第一步，读输入分片（read 工具）：' + outDir + '/runtime/verify-input/' + partFile,
    '内含：瘦身原子列表（featureGroups.atoms：id/name/rule/ui_requirement/notes/verdict/difference）、',
    'gapNotes（每原子服务端零实现的缺口说明——说明服务端侧已查过什么、缺什么）、',
    'existingScopeEntries（现作用域条目幂等参考）、clientRoots（客户端两根目录）。',
    '',
    '第二步，逐原子检索客户端实现（工作目录为项目根目录，路径相对根）：',
    '- 根目录 1：source-code/client/Code（Cocos 客户端逻辑：controller/data/layer/fgui/interface 等 TS 代码）；',
    '- 根目录 2：source-code/client/Fgui（FairyGUI 工程：assets 组件 XML/TS_SCRIPT）。',
    '- 检索策略（按优先级）：',
    '  a. 关键词全文检索（grep 工具）：从 rule/ui_requirement/notes 提取界面词（中文词与拼音/英文符号线索，',
    '     如「杠字」「倒计时」「箭头」「爆飘」「横滑」「长按」「准备」「返回大厅」等），在两根目录检索；',
    '     组件/方法命名线索（如 Kong/Timer/Arrow/BaoPiao/Drag/LongPress/Ready）同样检索。',
    '  b. 文件定位（glob）：按组件命名约定定位疑似实现文件（如 layer/ 下的界面层、Fgui/assets 下的组件 XML），',
    '     read 定位关键逻辑行（file:line + 符号 + 摘录）。',
    '  c. 邻近扩展：同分片其他原子定位到的组件若与当前原子相关（同一界面/同一动画链），一并核对。',
    '  d. 诚实落判：系统性检索未果（多组关键词 + 命名线索 + 组件目录均无命中）即判未果，',
    '     不要为凑证据把「相关组件存在」当成「本规则实现已定位」。',
    '',
    '第三步，逐原子落判（applicability 一律 client，设计 7.1）：',
    '- 定位到实现（与规则语义同构）：callPathVerified=true，callPath 写客户端实现链（组件/方法名 + file:line），',
    '  evidenceIds 列出新 SVE id，unresolved 留空。',
    '- 实现与规则相反/不等价：同样落 client + SVE 证据，unresolved 写明相反表现（复核轮按规则 4 出 conflict 建议）。',
    '- 系统性检索未果：callPathVerified=false，callPath 写检索范围（如「检索：关键词 K1/K2 于 Code/layer、Fgui/assets，零命中」），',
    '  unresolved 写「客户端亦未定位实现（双端零实现，检索范围：…）」，evidenceIds 留空。',
    '- configVerified=true（服务端无配置依赖；实现读取服务端下发字段时在 configCondition 注明字段名与用途）。',
    '- noServerEvidence=true（本组原子服务端三根零实现，gapNotes 已注明）。',
    '',
    '第四步，产出客户端层 SVE 证据条目（仅定位到实现或相反实现的原子产出；未果原子不产出）：',
    '- id：SVE-' + stageId + '-PC<partNo>-NN（NN 两位从 01 递增，本片内不得重复；PC 代际前缀与既有 P/PR 段隔离，坑 8 教训；',
    '  复用同一原子既有 SVE id 仅限同 id 同证据指针，本组原子既有证据为空，正常全部新编号）。',
    '- layer：client_code（根 source-code/client/Code）或 client_fgui（根 source-code/client/Fgui），按实现文件所在根选择。',
    '- file：layer + \'/\' + 相对根路径（如 client_code/layer/GameMahView.ts、client_fgui/assets/hzmj/kong.xml）。',
    '- location：file + \':\' + 行号；symbol：类/组件/方法名；excerpt：关键逻辑摘录（原文片段）；configKeys: []。',
    '',
    '第五步，写落判分片（write 工具，UTF-8，JSON 1 空格缩进）：' + outDir + '/runtime/verify-output/' + partFile,
    '{ "schemaVersion": 1, "stageId": "' + stageId + '", "partNo": <分片 partNo>,',
    '  "entries": [ { "atomId": "...", "applicability": "client", "configVerified": true, "callPathVerified": true|false,',
    '    "configCondition": "...", "callPath": "...", "evidenceIds": ["SVE-..."], "unresolved": "...", "noServerEvidence": true,',
    '    "dr": { "scopeApplicability": "client", "scopeNote": "客户端检索结论（定位/未果 + 依据）" },',
    '    "sve": [ { "id": "...", "atomId": "...", "layer": "client_code|client_fgui", "file": "...", "location": "...",',
    '      "symbol": "...", "excerpt": "...", "configKeys": [] } ] } ] }',
    '每原子恰一条 entry（applicability=client）；分片内原子全覆盖（漏任一原子闸门失败）。',
    '',
    '第六步，只写这一个文件，不要写其他文件，不要执行 git / node / 构建装配命令。',
    '写完后返回结构化摘要（partFile 填分片文件名本身；atomCount = entries 条数；client = atomCount；',
    'located = 定位到实现的原子数；notLocated = 未果原子数；sveCount = SVE 条目总数）。',
  ].join('\n')
}

// ============================================================
// 客户端并行落判（每分片一个 agent）
// ============================================================

phase('客户端并行落判')

const partFiles = []
for (const s of stages) {
  for (const f of s.partFiles || []) partFiles.push({ stageId: s.stageId, file: f })
}
if (partFiles.length === 0) {
  throw new Error('stages 分片清单为空（prepare-client-verify-input 未透传或清单损坏）')
}

const verifyResults = await parallel(
  partFiles.map((p) => () =>
    agent(
      clientVerifyPrompt(p.stageId, p.file),
      withModel({
        label: '客户端落判 ' + p.stageId + ' ' + p.file,
        agentType: 'general',
        schema: VERIFY_SUMMARY_SCHEMA,
        timeoutMs: 3600000,
        retries: 2,
      })
    )
  )
)

// 落盘闸门
for (const p of partFiles) {
  const ok = await check(
    () => fileExists(outDir + '/runtime/verify-output/' + p.file),
    '落盘闸门：客户端落判未写盘 ' + p.file
  )
  if (!ok) {
    throw new Error('落盘闸门：客户端落判未写盘 ' + outDir + '/runtime/verify-output/' + p.file)
  }
}

let sveTotal = 0
for (let i = 0; i < partFiles.length; i++) {
  const r = verifyResults[i]
  if (!r || !partFileMatches(r.partFile, partFiles[i].file)) {
    throw new Error('落判摘要 partFile 不符：期望 ' + partFiles[i].file + ' 实际 ' + (r && r.partFile))
  }
  if (r.client !== r.atomCount) {
    throw new Error('客户端落判摘要异常：client != atomCount（' + r.partFile + '）')
  }
  sveTotal += r.sveCount || 0
}

// ============================================================
// 确定性重算闸门（recount-verify-parts.mjs：覆盖率/重复/枚举/分布）
// ============================================================

const filesCsv = partFiles.map((p) => p.file).join(',')
const recountPath = outDir + '/runtime/verify-recount.json'
const recountCmd =
  'node ".opencode-workflows/scripts/recount-verify-parts.mjs" "' + outDir + '" "' +
  filesCsv + '" "' + recountPath + '"'
const recountOk = await commandSuccess(recountCmd, 120000)
if (!recountOk) {
  throw new Error(
    '落判重算闸门失败（recount-verify-parts.mjs 退出码非 0；覆盖率/重复/枚举/分布问题见其输出）：' + recountCmd
  )
}

// 重算结果回读（聚合口径以 recount 文件为准）
const recount = await agent(
  [
    '任务：用 read 工具读取文件 ' + recountPath + '（全文），原样返回其中数字字段：',
    'partCount、atomCount、active、conditional、unknown、inactive、client、sveCount。',
    '只返回一个 JSON 对象，包含上述字段（数字），不加代码围栏与多余说明。',
  ].join('\n'),
  withModel({ label: '回读落判重算', agentType: 'general', timeoutMs: 900000, retries: 2 })
)

let recountData = null
try {
  const m = String(recount).match(/\{[\s\S]*\}/)
  recountData = m ? JSON.parse(m[0]) : null
} catch {
  recountData = null
}
if (
  !recountData ||
  recountData.partCount !== partFiles.length ||
  !Number.isInteger(recountData.atomCount) ||
  recountData.atomCount < partFiles.length
) {
  throw new Error('落判重算回读异常：' + JSON.stringify(recountData))
}

return {
  parts: partFiles.map((p, i) => ({
    partFile: p.file,
    atomCount: verifyResults[i] ? verifyResults[i].atomCount : undefined,
    located: verifyResults[i] ? verifyResults[i].located : undefined,
    notLocated: verifyResults[i] ? verifyResults[i].notLocated : undefined,
    sveCount: verifyResults[i] ? verifyResults[i].sveCount : undefined,
  })),
  scopeStats: {
    active: recountData.active,
    conditional: recountData.conditional,
    unknown: recountData.unknown,
    inactive: recountData.inactive,
    client: recountData.client,
  },
  sveTotal: sveTotal,
}
