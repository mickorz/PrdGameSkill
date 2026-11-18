// Game-Requirement-Audit 子流程 S5：服务端查证（agent 链路，评审 P1-1 整改）
//
// 执行文档 §5 S5、§13.2/§13.3、§19.2、§21。**Prompt 全文在本文件**。
//
// 与 S4 的差异（两套证据体系独立，§1 原则 2）：
//   - 落判维度是 applicability 四值（active/conditional/inactive/unknown），不是 verdict；
//   - SVE 只承载服务端三目录（common_game / hzmj_server / mah_frame），客户端证据不进 SVE；
//   - 每原子必须给出调用链与配置生效条件（conditional 必填 configCondition，unknown 必填 unresolved）；
//   - 旧的 3C 客户端补证链路**废弃**（纯客户端需求由 Registry verificationScope=client 表达）。
//
// 由主 workflow 经显式路径调用；stageVersion：S5@1

export const meta = {
  id: 'game-requirement-audit-server-verify',
  name: 'game_requirement_audit_server_verify',
  description: 'S5 服务端查证：分片准备 → agent 读服务端三目录产出 SVE 与 applicability 四值 → 源码清单采集 → 确定性合并',
  phases: [{ title: '准备查证输入' }, { title: '并行服务端查证' }, { title: '源码清单与合并' }],
}

const A = args || {}

const runDir = String(A.runDir || '').trim()
if (!runDir) throw new Error('runDir 必填（run 根目录，由主编排创建）')
const date = String(A.date || '').trim()
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date 必填 YYYY-MM-DD')
const serverSrcRoot = String(
  A.serverSrcRoot ||
    'E:/WorkProjects/xc-flow/.xflow/xc/xcodeDev/game-mahjong/server/Logic/mahjong_server/src'
)
// collect 解析根（双根）：hzmj 玩法层根（common_game/、hzmj_server/ 相对）+ src 根（mah_frame/ 相对）。
// SVE file 按层书写（无 game_hzmj/ 前缀）、repoId 固定 "server"——同 repoId 双根，文件按 roots 顺序解析。
const serverSrcRoots = serverSrcRoot + '/game_hzmj,' + serverSrcRoot
const analysisModel =
  A.analysisModel === undefined ? 'biangfeng-gateway/deepseek-v4.1-flash-official' : A.analysisModel
const stageIds = String(A.stageIds || 'ALL')

setConcurrency(A.concurrency || 16)

function withModel(opts) {
  return analysisModel ? { model: analysisModel, ...opts } : opts
}
const toPosix = (p) => String(p).replaceAll('\\', '/')

const BRANCH_DIR = '3-server'
const INPUT_DIR = runDir + '/' + BRANCH_DIR + '/runtime/verify-input'
const OUTPUT_DIR = runDir + '/' + BRANCH_DIR + '/runtime/verify-output'
const RUN_STATUS = runDir + '/' + BRANCH_DIR + '/runtime/run-status.json'
const MANIFEST = runDir + '/' + BRANCH_DIR + '/runtime/source-manifest.json'
const PART_RE = /^ST-C\d{2}-p\d{2}\.json$/

// ============================================================
// 1. 准备查证输入
// ============================================================

phase('准备查证输入')

const prepOk = await commandSuccess(
  'node ".opencode-workflows/scripts/prepare-verify-input.mjs" --run-dir "' + runDir +
    '" --branch server --stage-ids "' + stageIds + '" --date "' + date + '"',
  300000
)
if (!prepOk) throw new Error('S5 查证输入准备失败（见上方命令日志）')

const manifestRead = await agent(
  [
    '你是文件回读器，工作目录为项目根目录。只做读取与转写，不做解读。',
    '',
    '任务：用 read 工具读取 ' + INPUT_DIR + '/manifest.json（全文小文件），原样返回全部阶段分片清单。',
    '只输出结构化结果。',
  ].join('\n'),
  withModel({
    label: '回读服务端查证输入清单',
    schema: {
      type: 'object',
      properties: {
        totalAtomCount: { type: 'number' },
        stages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              stageId: { type: 'string' },
              atomCount: { type: 'number' },
              partFiles: { type: 'array', items: { type: 'string' } },
            },
            required: ['stageId', 'partFiles'],
          },
        },
      },
      required: ['totalAtomCount', 'stages'],
    },
    timeoutMs: 600000,
    retries: 2,
  })
)
if (!manifestRead || !Array.isArray(manifestRead.stages) || manifestRead.stages.length === 0) {
  throw new Error('查证输入清单回读异常：' + JSON.stringify(manifestRead))
}
const partFiles = []
for (const s of manifestRead.stages) {
  for (const f of s.partFiles || []) {
    if (!PART_RE.test(f)) throw new Error('分片命名不符（期望 ST-Cxx-pNN.json）：' + f)
    partFiles.push({ stageId: s.stageId, file: f })
  }
}
if (partFiles.length === 0) throw new Error('查证输入清单无分片')
log('S5 输入就绪：' + manifestRead.totalAtomCount + ' 原子 / ' + partFiles.length + ' 分片（run-status 初始 pending）')

// ============================================================
// 2. 并行服务端查证
// ============================================================

phase('并行服务端查证')

const VERIFY_SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    partFile: { type: 'string', description: '分片文件名（不含目录），如 ST-C01-p01.json' },
    atomCount: { type: 'number' },
    active: { type: 'number' },
    conditional: { type: 'number' },
    inactive: { type: 'number' },
    unknown: { type: 'number' },
    sveCount: { type: 'number' },
    directConflict: { type: 'number' },
  },
  required: ['partFile', 'atomCount', 'active', 'conditional', 'inactive', 'unknown', 'sveCount', 'directConflict'],
}

// ---- Prompt 全文（S5） ----
function serverVerifyPrompt(p) {
  const inPath = INPUT_DIR + '/' + p.file
  const outPath = OUTPUT_DIR + '/' + p.file
  return [
    '你是杭州麻将好友房需求的**服务端**规则查证员。工作目录为项目根目录。',
    '你的唯一职责是查证服务端规则实现并落判作用域，不评判需求是否合理，不写其他文件。',
    '',
    '## 一、输入',
    '读取分片文件：' + inPath,
    '含 featureGroups[]，每原子有 atomId / name / rule / uiRequirement / verificationScope / businessBehavior / source。',
    '**必读全部原子**，逐个查证。',
    '',
    '## 二、可读源码范围（只读三根目录，硬约束）',
    '根目录：' + serverSrcRoot,
    '1. common_game/：公共规则层（大部分规则计算在此）',
    '2. hzmj_server/：杭州麻将服务薄层（协议处理、房间逻辑）',
    '3. mah_frame/：框架层（网络、房间基础、定时器）',
    '禁止读取客户端源码（客户端由 S4 单独查证）。',
    '注意：部分规则由**玩法配置项**控制（好友房创房配置），必须核对配置 key 与默认值，',
    '不能只看代码里是否存在该分支。',
    '',
    '## 三、检索策略（按序尝试，命中即止）',
    '1. 配置 key：按规则语义找玩法配置项（如 banker_level_type / pung_as_tan / cai_shen_type），',
    '   用 Grep 搜配置 key、枚举名（ET_ / kEt 前缀）、常量名（C_ / KW_ 前缀）',
    '2. 调用链：从协议处理入口（hzmj_server 消息 handler）顺调用链读到规则实现函数，整读函数体',
    '3. 关键词：Grep 规则关键词（中文注释 / 拼音 / 英文术语），再 read 上下文',
    '4. 邻近扫描：同阶段其他原子命中的文件整读相关函数区',
    '每个原子给出 applicability，查不到也要按四值落到 unknown 并写清缺什么证据。',
    '',
    '## 四、applicability 四值判定（作用域维度）',
    '- active：规则在服务端**确实生效**（找到了执行该规则的代码路径，且当前默认配置会走到）',
    '- conditional：规则存在但**受配置项控制**，是否生效取决于配置；必须填 configCondition',
    '- inactive：服务端**明确不生效**（配置默认关闭 / 代码路径不可达 / 该规则明确不由服务端实现）',
    '- unknown：**已查证但证据不足**（找了但找不到关键实现），必须填 unresolved 说明缺什么',
    '',
    '重要：',
    '- unknown ≠ 执行失败。unknown 表示「查了但证据不足」，必须产出条目；执行失败（agent 超时）不产条目、进 pending。',
    '- 不要因为「客户端有对应逻辑」就填 inactive —— 两端口径独立。',
    '- inactive 必须有依据（配置默认值 / 不可达证明），不能因为「没找到」就填 inactive（那应填 unknown）。',
    '',
    '## 五、证据条目（evidence[]，SVE）',
    '字段：',
    '- claimKey：业务断言规范化短标识（**必填**，小写连字符，禁中文空格），如 banker-level-three',
    '- repoId：固定填 "server"',
    '- layer：只能是 "common_game" / "hzmj_server" / "mah_frame" 之一（与 file 首段一致）',
    '- file：**仓库相对路径，首段即 layer**，如 common_game/RuleEngine.cpp / hzmj_server/HzmjRoom.cpp',
    '- location：**必填**，`<与 file 完全一致的路径>:<行号>` 或 `:起-止`',
    '- symbol：函数/类名，无则空串',
    '- excerpt：关键代码/注释摘录（含直证语句），≤120 字',
    '- configKeys：涉及的配置 key 数组（如 ["banker_level_type"]）',
    '- atomIds：该证据支撑的原子列表（共享证据只写一条，全部支撑原子列入 atomIds）',
    '- dependencyFiles：调用链依赖文件路径数组，如 [{"file":"common_game/ScoreMgr.cpp"}]',
    '**严禁填写** sourceRevision / contentHash / verifiedAt（确定性脚本回填）。',
    '',
    '## 六、条目（entries[]，每原子恰一条）',
    '- atomId：分片内原子，不得新增或遗漏',
    '- applicability：四值',
    '- configVerified：是否核对了相关配置项的默认值（true/false）',
    '- callPathVerified：是否核对了完整调用链（true/false）',
    '- configCondition：applicability=conditional 时**必填**，写「配置 key + 默认值 + 可选值如何影响行为」',
    '- callPath：证据调用链，写「入口函数 → … → 实现函数（file:line）」',
    '- evidenceIds：本原子引用的证据 id 列表（inactive/unknown 可为空，但若 noServerEvidence=false 则不应为空）',
    '- unresolved：applicability=unknown 时**必填**，写清缺哪段证据',
    '- noServerEvidence：true 表示服务端确认无实现（inactive 类需求），此时 evidenceIds 可为空',
    '- directConflict：boolean。仅当发现**与需求直接矛盾的实现**时 true',
    '   （例：需求「流局连庄」、实现「流局换庄」）',
    '- conflictEvidenceIds：directConflict=true 时**必填**',
    '',
    '## 六A、引用一致性（硬约束，落盘前逐条自查）',
    '- evidenceIds / conflictEvidenceIds 中每个 id 必须是本片 evidence[] 里**真实存在**的 id，禁止引用未写出的 id',
    '- 被引用证据的 atomIds 必须包含本条目的 atomId；引用其他原子的证据前，先把本原子补进该证据的 atomIds',
    '- 写完 entries 与 evidence 后自查一遍交叉引用，不一致会被合并闸门整体拒绝（分片重跑）',
    '',
    '## 七、证据 id 命名（重要）',
    '格式：`SVE-<该证据支撑的 Registry 最早原子>-NN`',
    '- NN 从 01 起，同归属原子下递增；分片内不重复',
    '- 归属原子 = atomIds 中 Registry 顺序最靠前者（分片 featureGroups 顺序即 Registry 顺序）',
    '- 示例：支撑 AT-ST-C01-004 → SVE-AT-ST-C01-004-01',
    '- 幂等重跑时复用正式产物中同合并键（repoId+file+location+symbol+claimKey）的原 id',
    '',
    '## 八、输出',
    '用 write 写文件：' + outPath + '（UTF-8，JSON，1 空格缩进）：',
    '{',
    '  "schemaVersion": 1,',
    '  "stageId": "<本片阶段>",',
    '  "partNo": "<本片两位序号>",',
    '  "entries": [ ... ],',
    '  "evidence": [ ... ]',
    '}',
    '只写这一个文件，不写其他文件，不执行 git。',
    '',
    '## 九、返回摘要',
    'partFile / atomCount / active / conditional / inactive / unknown / sveCount / directConflict。',
    '校验：active + conditional + inactive + unknown = atomCount。',
    '',
    '## 十、严禁事项',
    '- 严禁编造 file/location/excerpt',
    '- 严禁执行 git',
    '- 严禁填写 sourceRevision/contentHash/verifiedAt',
    '- 严禁写入客户端证据到本分片（客户端证据唯一载体是 CLE）',
    '- 严禁写 scope-index.json / server-evidence.json / run-status.json（确定性脚本写）',
    '- 严禁跨原子复制同一证据（用 atomIds 表达共享）',
    '- 严禁引用 evidence[] 中不存在的证据 id；严禁引用 atomIds 未包含本条目原子的证据',
  ].join('\n')
}

const results = await parallel(
  partFiles.map((p) => () =>
    agent(
      serverVerifyPrompt(p),
      withModel({
        label: '服务端查证 ' + p.stageId + ' ' + p.file,
        agentType: 'general',
        schema: VERIFY_SUMMARY_SCHEMA,
        timeoutMs: 7200000,
        retries: 2,
      })
    )
  )
)

// ============================================================
// 3. 落盘闸门 + 分支状态更新
// ============================================================

const partFileMatches = (got, expected) => {
  if (typeof got !== 'string' || got === '') return false
  const g = toPosix(got)
  return g === expected || g.endsWith('/' + expected)
}

const completed = []
const unfinished = []
for (let i = 0; i < partFiles.length; i++) {
  const p = partFiles[i]
  const r = results[i]
  const onDisk = await check(() => fileExists(OUTPUT_DIR + '/' + p.file), '落盘闸门：' + p.file)
  if (!onDisk) {
    unfinished.push({ file: p.file, reason: 'agent 未落盘' })
    log('告警：分片未落盘（不产 entry，进 pending）：' + p.file)
    continue
  }
  if (!r || !partFileMatches(r.partFile, p.file)) {
    log('告警：摘要不符（以落盘文件为准）：' + p.file)
    completed.push(p.file)
    continue
  }
  const sum = (r.active || 0) + (r.conditional || 0) + (r.inactive || 0) + (r.unknown || 0)
  if (sum !== r.atomCount) log('告警：摘要四值合计不自洽（' + p.file + '），以合并重算为准')
  completed.push(p.file)
}

const rsPatch = await agent(
  [
    '你是分支状态更新器。工作目录为项目根目录。',
    '',
    '任务：读取 ' + RUN_STATUS + '（JSON），按下述结论修改 parts[].status 与 runStatus，然后**原地写回**该文件。',
    '要求：其余字段（partFile / stageId / atomIds）保持原样，只改 status；UTF-8；1 空格缩进。',
    '',
    '本片 completed（status 置 completed）：',
    completed.length ? completed.map((f) => '  - ' + f).join('\n') : '  （无）',
    '本片未完成（保持 pending）：',
    unfinished.length ? unfinished.map((x) => '  - ' + x.file).join('\n') : '  （无）',
    '',
    '写完后返回 runStatus / partsCompleted / partsTotal。',
  ].join('\n'),
  withModel({
    label: '更新服务端分支状态',
    agentType: 'general',
    schema: {
      type: 'object',
      properties: { runStatus: { type: 'string' }, partsCompleted: { type: 'number' }, partsTotal: { type: 'number' } },
      required: ['runStatus', 'partsCompleted', 'partsTotal'],
    },
    timeoutMs: 600000,
    retries: 2,
  })
)
if (!rsPatch || !Number.isInteger(rsPatch.partsTotal)) {
  throw new Error('run-status 更新回读异常：' + JSON.stringify(rsPatch))
}

// ============================================================
// 4. 源码清单采集 + 5. 确定性合并
// ============================================================

phase('源码清单与合并')

const fileList = await agent(
  [
    '你是证据文件归集器，工作目录为项目根目录。只做提取与去重，不做判断。',
    '',
    '任务：读取目录 ' + OUTPUT_DIR + ' 下全部 *-p*.json 分片，',
    '提取 evidence[] 的 file 与 dependencyFiles[].file，去重后返回列表（只需 file 路径，repoId 恒为 server）。',
    '只输出结构化结果。',
  ].join('\n'),
  withModel({
    label: '归集服务端证据文件清单',
    schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string' } } }, required: ['files'] },
    timeoutMs: 1800000,
    retries: 2,
  })
)
if (!fileList || !Array.isArray(fileList.files)) throw new Error('证据文件归集回读异常')

// 合法空证据分支：全片 unknown/noServerEvidence/inactive 时可没有 SVE 文件。
// 这属于业务结论而不是执行失败；写空 Source Manifest 后仍进入 merge。
if (fileList.files.length === 0) {
  await agent(
    [
      '任务：将以下 JSON 逐字写入文件 ' + MANIFEST + '（UTF-8，1 空格缩进）。',
      '只写这个文件，不执行 git。',
      '',
      'PART-BEGIN',
      JSON.stringify({ schemaVersion: 1, branch: 'server', collectedAt: date, repos: [] }, null, 1),
      'PART-END',
    ].join('\n'),
    { label: '写空服务端源码清单', agentType: 'general', timeoutMs: 900000, retries: 2, ...withModel({}) }
  )
  log('S5：本轮没有服务端证据文件（unknown/noServerEvidence/inactive），写空 Source Manifest 后继续合并')
} else {
  const filesTxtPath = runDir + '/' + BRANCH_DIR + '/runtime/evidence-files.txt'
  await agent(
    [
      '任务：把下面 PART-BEGIN 与 PART-END 之间的文本逐字写入文件 ' + filesTxtPath + '（每行一个路径，UTF-8）。',
      '逐字复制，不得改写或排序。只写这一个文件，不执行 git。',
      '',
      'PART-BEGIN',
      fileList.files.join('\n'),
      'PART-END',
    ].join('\n'),
    { label: '写服务端证据文件清单', agentType: 'general', timeoutMs: 900000, retries: 2, ...withModel({}) }
  )

  const collectOk = await commandSuccess(
    'node ".opencode-workflows/scripts/collect-source-manifest.mjs" --branch server' +
      ' --roots "' + serverSrcRoots + '" --repo-ids "server,server"' +
      ' --files "@' + filesTxtPath + '" --date "' + date + '" --out "' + MANIFEST + '"',
    300000
  )
  if (!collectOk) throw new Error('S5 源码清单采集失败（见上方命令日志）')
}

const mergeOk = await commandSuccess(
  'node ".opencode-workflows/scripts/merge-branch-evidence.mjs" --run-dir "' + runDir +
    '" --branch server --date "' + date + '"',
  300000
)
if (!mergeOk) throw new Error('S5 证据合并闸门未通过（见上方命令日志）')

const merged = await agent(
  [
    '你是合并结果回读器，工作目录为项目根目录。只做读取与转写，不做解读。',
    '',
    '任务：用 read 读取 ' + runDir + '/' + BRANCH_DIR + '/runtime/branch-recount.json，',
    '原样返回 summary 内数字字段。只输出结构化结果。',
  ].join('\n'),
  withModel({
    label: '回读服务端合并结果',
    schema: {
      type: 'object',
      properties: {
        entryCount: { type: 'number' },
        expectedAtomCount: { type: 'number' },
        evidenceCount: { type: 'number' },
        pendingCount: { type: 'number' },
        active: { type: 'number' },
        conditional: { type: 'number' },
        inactive: { type: 'number' },
        unknown: { type: 'number' },
      },
      required: ['entryCount', 'expectedAtomCount', 'evidenceCount', 'pendingCount'],
    },
    timeoutMs: 600000,
    retries: 2,
  })
)
if (!merged || !Number.isInteger(merged.entryCount)) throw new Error('合并结果回读异常：' + JSON.stringify(merged))

log(
  'S5 服务端查证完成：分片 ' + completed.length + '/' + partFiles.length + '（未完成 ' + unfinished.length + '）' +
    ' / entry ' + merged.entryCount + ' + pending ' + merged.pendingCount + ' = expected ' + merged.expectedAtomCount +
    ' / SVE ' + merged.evidenceCount + ' 条' +
    '（active ' + (merged.active || 0) + ' / conditional ' + (merged.conditional || 0) +
    ' / inactive ' + (merged.inactive || 0) + ' / unknown ' + (merged.unknown || 0) + '）' +
    ' -> ' + runDir + '/' + BRANCH_DIR
)

return {
  branch: 'server',
  partCount: partFiles.length,
  completedParts: completed.length,
  unfinishedParts: unfinished,
  entryCount: merged.entryCount,
  expectedAtomCount: merged.expectedAtomCount,
  evidenceCount: merged.evidenceCount,
  pendingCount: merged.pendingCount,
  runStatus: rsPatch.runStatus,
  scopeIndexPath: runDir + '/' + BRANCH_DIR + '/scope-index.json',
  serverEvidencePath: runDir + '/' + BRANCH_DIR + '/server-evidence.json',
  manifestPath: MANIFEST,
}
