// Game-Requirement-Audit 子流程 S4：客户端查证（agent 链路，评审 P1-1 整改）
//
// 执行文档 §5 S4、§13.2/§13.3、§19.2、§21。**Prompt 全文在本文件**（评审 P1-4 要求）。
//
// 职责链（确定性脚本与 agent 严格分工）：
//   1. prepare-verify-input.mjs（branch=client）→ 分片 + run-status 骨架（全 pending）
//   2. 每分片一个 agent：读分片 + 读真实客户端源码 → 写 verify-output 分片（含落盘闸门）
//   3. 落盘成功的分片 → run-status 置 completed（失败的保持 pending，不产 entry）
//   4. collect-source-manifest.mjs → 归集证据文件 + dependencyFiles，分仓 commit/contentHash
//   5. merge-branch-evidence.mjs → 确定性合并（M1~M8 + 统计不变式 + 版本回填）
//
// 铁律：agent 不得执行 git、不得自填 sourceRevision/contentHash/verifiedAt、不得写正式产物。
//
// 由主 workflow 经显式路径调用：
//   await workflow({ scriptPath: DIR + '/4-client-verify.js', label: '客户端查证' }, { runDir, date, codeDir, fguiDir, analysisModel, concurrency, stageIds })
//
// stageVersion：S4@1（specs：stage-specs.game-requirement-audit.json）

export const meta = {
  id: 'game-requirement-audit-client-verify',
  name: 'game_requirement_audit_client_verify',
  description: 'S4 客户端查证：分片准备 → agent 读源码产出 CLE 与 verdict → 源码清单采集 → 确定性合并',
  phases: [{ title: '准备查证输入' }, { title: '并行客户端查证' }, { title: '源码清单与合并' }],
}

const A = args || {}

const runDir = String(A.runDir || '').trim()
if (!runDir) throw new Error('runDir 必填（run 根目录，由主编排创建）')
const date = String(A.date || '').trim()
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date 必填 YYYY-MM-DD')
const codeDir = String(A.codeDir || 'source-code/client/Code')
const fguiDir = String(A.fguiDir || 'source-code/client/Fgui')
const analysisModel =
  A.analysisModel === undefined ? 'biangfeng-gateway/deepseek-v4.1-flash-official' : A.analysisModel
const stageIds = String(A.stageIds || 'ALL')

setConcurrency(A.concurrency || 16)

function withModel(opts) {
  return analysisModel ? { model: analysisModel, ...opts } : opts
}
const toPosix = (p) => String(p).replaceAll('\\', '/')

const BRANCH_DIR = '2-client'
const INPUT_DIR = runDir + '/' + BRANCH_DIR + '/runtime/verify-input'
const OUTPUT_DIR = runDir + '/' + BRANCH_DIR + '/runtime/verify-output'
const RUN_STATUS = runDir + '/' + BRANCH_DIR + '/runtime/run-status.json'
const MANIFEST = runDir + '/' + BRANCH_DIR + '/runtime/source-manifest.json'

const PART_RE = /^ST-C\d{2}-cp\d{2}\.json$/

// ============================================================
// 1. 准备查证输入（确定性）
// ============================================================

phase('准备查证输入')

const prepOk = await commandSuccess(
  'node ".opencode-workflows/scripts/prepare-verify-input.mjs" --run-dir "' + runDir +
    '" --branch client --stage-ids "' + stageIds + '" --date "' + date + '"',
  300000
)
if (!prepOk) throw new Error('S4 查证输入准备失败（见上方命令日志）')

const manifestRead = await agent(
  [
    '你是文件回读器，工作目录为项目根目录。只做读取与转写，不做解读。',
    '',
    '任务：用 read 工具读取 ' + INPUT_DIR + '/manifest.json（全文小文件），原样返回全部阶段分片清单。',
    '只输出结构化结果。',
  ].join('\n'),
  withModel({
    label: '回读查证输入清单',
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
              stageName: { type: 'string' },
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
    if (!PART_RE.test(f)) throw new Error('分片命名不符（期望 ST-Cxx-cpNN.json）：' + f)
    partFiles.push({ stageId: s.stageId, file: f })
  }
}
if (partFiles.length === 0) throw new Error('查证输入清单无分片')
log('S4 输入就绪：' + manifestRead.totalAtomCount + ' 原子 / ' + partFiles.length + ' 分片（run-status 初始 pending）')

// ============================================================
// 2. 并行客户端查证（每分片一个 agent，Prompt 全文如下）
// ============================================================

phase('并行客户端查证')

const VERIFY_SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    partFile: { type: 'string', description: '分片文件名（不含目录），如 ST-C01-cp01.json' },
    atomCount: { type: 'number', description: '本片落判原子数（应等于分片 atomCount）' },
    confirmed: { type: 'number' },
    partial: { type: 'number' },
    notFound: { type: 'number' },
    directConflict: { type: 'number', description: '本片 directConflict=true 的原子数' },
    evidenceCount: { type: 'number', description: '本片证据条目总数' },
  },
  required: ['partFile', 'atomCount', 'confirmed', 'partial', 'notFound', 'directConflict', 'evidenceCount'],
}

// ---- Prompt 全文（S4） ----
function clientVerifyPrompt(p) {
  const inPath = INPUT_DIR + '/' + p.file
  const outPath = OUTPUT_DIR + '/' + p.file
  return [
    '你是杭州麻将好友房需求的**客户端**实现查证员。工作目录为项目根目录。',
    '你的唯一职责是查证客户端实现并落判，不评判需求是否合理，不写其他文件。',
    '',
    '## 一、输入',
    '读取分片文件：' + inPath,
    '该文件含 featureGroups[]，每个原子含：atomId / name / rule / uiRequirement / verificationScope / businessBehavior / source。',
    '**必读全部原子**，逐个查证，不得跳过、不得合并原子。',
    '',
    '## 二、可读的客户端源码范围（只读这两个根）',
    '1. 代码工程：' + codeDir,
    '   - controller/cmd 目录：命令处理（服务端消息驱动）',
    '   - protocol/GameGlcProtocol.ts：协议消息定义（MsgXxx）',
    '   - fgui/ 目录：UI 绑定代码',
    '   - data/ 目录：数据层',
    '   - config/ 目录：配置表',
    '2. FairyGUI 工程：' + fguiDir,
    '   - assets/box_hzmj_*/**/*.xml：界面结构（按钮、列表、标签、动效）',
    '禁止读取范围外文件；禁止读取服务端源码（服务端由另一分支查证）。',
    '',
    '## 三、检索策略（按序尝试，命中即止）',
    '1. 关键词：用 Grep 搜 rule 中的中文关键词、界面文案、按钮名',
    '2. 协议名：uiRequirement/rule 提到的交互，搜 MsgXxx 定位处理链',
    '3. 组件名：UI 表现类需求，搜 FGUI 组件 XML 的组件名/控件名',
    '4. 邻近扫描：同阶段其他原子命中的文件，整读相关函数/组件',
    '每个原子都要给出 verdict，查不到就如实 not_found。',
    '',
    '## 四、verdict 三态判定（维度一：是否发现客户端实现证据）',
    '- confirmed：找到**直接**实现证据（该逻辑/表现就写在这里）',
    '- partial：只有间接或部分相关证据（相关模块存在但关键逻辑缺失/在别处）',
    '- not_found：未找到任何对应实现',
    '判定要点：confirmed 只表示「找到了代码」，**不表示实现正确**（正确性由 difference/directConflict 表达）。',
    '',
    '## 五、证据条目（evidence[]，CLE）',
    '每个证据条目字段：',
    '- claimKey：业务断言的规范化短标识（**必填**）。小写、单词用连字符，禁止空格与中文，如 caishen-mark-display / chi-button-gray-out',
    '  语义：这个证据在证明**哪条业务断言**。相同代码位置证明不同断言时，必须用不同 claimKey。',
    '- repoId：固定填 "client-code"（代码工程）或 "client-fgui"（FairyGUI 工程）',
    '- layer：固定填 "client_code"（代码工程）或 "client_fgui"（FairyGUI 工程）',
    '- file：仓库相对路径（不含源码根前缀），如 layer/GameMahView.ts / box_hzmj/main/ComMain.xml',
    '- location：**必填**，格式 `<与 file 完全一致的路径>:<行号>` 或 `:起-止`，如 layer/GameMahView.ts:123',
    '- symbol：命中的符号名（类名.方法名 / 组件名），无则空串',
    '- excerpt：关键代码或 XML 摘录，不超过 120 字',
    '- configKeys：涉及的配置 key（无则空数组）',
    '- atomIds：**这个证据支撑的原子列表**。同一证据服务多个原子时，只在**一个**原子的证据列表里出现一次，',
    '  并把所有支撑原子都写进 atomIds（禁止把同一条证据复制到多个原子下）。',
    '- dependencyFiles：调用链依赖文件（agent 只给 file 路径），如 [{"file":"layer/GameMahController.ts"}]',
    '  含义：证据所在 View 的行为取决于 Controller/Model，这些文件变化会影响结论，必须列出（1~5 个）。',
    '**严禁填写** sourceRevision / contentHash / verifiedAt —— 这三个字段由确定性脚本从源码清单回填。',
    '',
    '## 六、条目（entries[]，每原子恰一条）',
    '每个原子一条，字段：',
    '- atomId：分片中出现过的原子，不得新增、不得遗漏',
    '- verdict：三态，见上',
    '- clientLogic：客户端逻辑实现摘要（哪个模块做什么），无证据空串',
    '- uiInteraction：UI 交互表现（按钮、置灰、倒计时、字效、面板刷新），无证据空串',
    '- messages：涉及的协议消息名数组（MsgXxx），无则空数组',
    '- notes：与需求的差异或存疑点，无则空串',
    '- evidenceIds：本原子引用的证据 id 列表',
    '  引用规则：verdict != not_found 必须至少 1 条；verdict = not_found 必须为空数组（自相矛盾会被闸门拒绝）',
    '- observedBehavior：由证据归纳的**实际业务行为**四元组（trigger/condition/action/result），**玩家语言**',
    '  禁止类名、方法名、协议名、文件路径。无法归纳的字段填空串，不要编造。',
    '- directConflict：boolean。仅当发现**与需求直接矛盾的实现行为**时填 true',
    '   （例：需求「打出的财神按普通白板显示」、实现「牌河中打出的白板财神仍高亮」）',
    '   仅「没找到」「部分证据」不构成冲突，必须是明确的相反实现。',
    '- conflictEvidenceIds：directConflict=true 时**必填**，指向证明矛盾的那个证据 id（不能为空）',
    '',
    '## 七、证据 id 命名（重要）',
    '证据 id 由本步骤**自己分配**，格式：`CLE-<该证据支撑的 Registry 最早原子>-NN`',
    '- NN 从 01 起，在同一归属原子下递增；同一分片内不得重复',
    '- 归属原子 = atomIds 中在 Registry 顺序最靠前的那个（分片 featureGroups 顺序即 Registry 顺序）',
    '- 示例：证据支撑 AT-ST-C01-002 与 AT-ST-C01-003 → id = CLE-AT-ST-C01-002-01',
    '- 若正式产物已存在同 id 证据（幂等重跑），复用原 id，不要另起新号',
    '',
    '## 八、输出',
    '用 write 工具写文件：' + outPath + '（UTF-8，JSON，1 空格缩进），结构：',
    '{',
    '  "schemaVersion": 1,',
    '  "stageId": "<本片阶段>",',
    '  "partNo": "<本片两位序号>",',
    '  "entries": [ ... ],',
    '  "evidence": [ ... ]',
    '}',
    '只写这一个文件，不要写其他文件，不要执行 git 命令。',
    '',
    '## 九、返回摘要（不写进文件）',
    '写完后返回结构化摘要：partFile / atomCount / confirmed / partial / notFound / directConflict / evidenceCount。',
    '校验：confirmed + partial + notFound = atomCount。',
    '',
    '## 十、严禁事项',
    '- 严禁编造 file/location/excerpt：必须来自真实读到的内容',
    '- 严禁执行 git 命令',
    '- 严禁填写 sourceRevision/contentHash/verifiedAt',
    '- 严禁写 client-evidence.json 或 run-status.json（确定性脚本写）',
    '- 严禁跨原子复制同一条证据（用 atomIds 表达共享）',
  ].join('\n')
}

const results = await parallel(
  partFiles.map((p) => () =>
    agent(
      clientVerifyPrompt(p),
      withModel({
        label: '客户端查证 ' + p.stageId + ' ' + p.file,
        agentType: 'general',
        schema: VERIFY_SUMMARY_SCHEMA,
        timeoutMs: 7200000, // 沿用 v3 墙钟加固（查证是最耗时阶段）
        retries: 2,
      })
    )
  )
)

// ============================================================
// 3. 落盘闸门 + 分支状态更新（失败的保持 pending，不产 entry）
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
    log('告警：分片未落盘（不产 entry，该批原子进 pending）：' + p.file)
    continue
  }
  if (!r || !partFileMatches(r.partFile, p.file)) {
    unfinished.push({ file: p.file, reason: '摘要 partFile 不符：' + (r && r.partFile) })
    log('告警：摘要不符（按落盘文件为准，状态标 completed）：' + p.file)
    completed.push(p.file)
    continue
  }
  const sum = (r.confirmed || 0) + (r.partial || 0) + (r.notFound || 0)
  if (sum !== r.atomCount) {
    log('告警：agent 摘要计数不自洽（' + p.file + ' 三态合计=' + sum + ' atomCount=' + r.atomCount + '），以合并重算为准')
  }
  completed.push(p.file)
}

// run-status 更新：completed 分片置 completed（确定性；未落盘的保持 pending）
const rsText = JSON.stringify(
  {
    schemaVersion: 1,
    branch: 'client',
    date: date,
    runStatus: completed.length === partFiles.length ? 'completed' : completed.length > 0 ? 'partial' : 'failed',
    updatedBy: 'S4 client-verify（按落盘闸门结果）',
  },
  null,
  1
)
const rsPatch = await agent(
  [
    '你是分支状态更新器。工作目录为项目根目录。',
    '',
    '任务：读取 ' + RUN_STATUS + '（JSON），按下述结论修改 parts[].status 与 runStatus，然后**原地写回**该文件。',
    '要求：其余字段（partFile / stageId / atomIds）完全保持原样，只改 status；UTF-8；1 空格缩进。',
    '',
    '本片 completed（status 置 completed）：',
    completed.length ? completed.map((f) => '  - ' + f).join('\n') : '  （无）',
    '本片未完成（status 保持 pending，不要改成 completed）：',
    unfinished.length ? unfinished.map((x) => '  - ' + x.file).join('\n') : '  （无）',
    '',
    'runStatus 取值参考：' + rsText,
    '写完后返回 runStatus 与 partsCompleted 数量。',
  ].join('\n'),
  withModel({
    label: '更新客户端分支状态',
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

// 归集：从落盘分片提取全部 evidence.file 与 dependencyFiles[].file（去重后交给确定性脚本）
const fileList = await agent(
  [
    '你是证据文件归集器，工作目录为项目根目录。只做提取与去重，不做判断。',
    '',
    '任务：读取目录 ' + OUTPUT_DIR + ' 下全部 *-cp*.json 分片（可逐个 read），',
    '提取每个分片 evidence[] 条目的 file 字段与 dependencyFiles[].file 字段，',
    '按 "repoId:file" 形式去重后返回列表（repoId 取证据条目的 repoId 字段）。',
    '只要文件路径，不要其他信息。只输出结构化结果。',
  ].join('\n'),
  withModel({
    label: '归集证据文件清单',
    schema: {
      type: 'object',
      properties: { files: { type: 'array', items: { type: 'string' } } },
      required: ['files'],
    },
    timeoutMs: 1800000,
    retries: 2,
  })
)
if (!fileList || !Array.isArray(fileList.files)) throw new Error('证据文件归集回读异常')

// 合法空证据分支：全片 not_found 时没有 CLE 文件可采集。
// 这不是执行失败；写空 Source Manifest 后仍进入 merge，让 not_found 正常成为业务结论。
if (fileList.files.length === 0) {
  await agent(
    [
      '任务：将以下 JSON 逐字写入文件 ' + MANIFEST + '（UTF-8，1 空格缩进）。',
      '只写这个文件，不执行 git。',
      '',
      'PART-BEGIN',
      JSON.stringify({ schemaVersion: 1, branch: 'client', collectedAt: date, repos: [] }, null, 1),
      'PART-END',
    ].join('\n'),
    { label: '写空客户端源码清单', agentType: 'general', timeoutMs: 900000, retries: 2, ...withModel({}) }
  )
  log('S4：本轮没有客户端证据文件（全部 not_found），写空 Source Manifest 后继续合并')
} else {
  // 中文值不进 shell：文件清单经临时文本 + --files @path
  const filesTxtPath = runDir + '/' + BRANCH_DIR + '/runtime/evidence-files.txt'
  await agent(
    [
      '任务：把下面 PART-BEGIN 与 PART-END 之间的文本逐字写入文件 ' + filesTxtPath + '（每行一个文件路径，UTF-8）。',
      '要求：逐字复制，不得改写、排序、去重或增删任何字符。只写这一个文件，不执行 git。',
      '',
      'PART-BEGIN',
      fileList.files.join('\n'),
      'PART-END',
    ].join('\n'),
    { label: '写证据文件清单', agentType: 'general', timeoutMs: 900000, retries: 2, ...withModel({}) }
  )

  const collectOk = await commandSuccess(
    'node ".opencode-workflows/scripts/collect-source-manifest.mjs" --branch client' +
      ' --roots "' + codeDir + ',' + fguiDir + '" --repo-ids "client-code,client-fgui"' +
      ' --files "@' + filesTxtPath + '" --date "' + date + '" --out "' + MANIFEST + '"',
    300000
  )
  if (!collectOk) {
    throw new Error('S4 源码清单采集失败（证据文件不存在或不属于声明源码根，见上方命令日志）')
  }
}

const mergeOk = await commandSuccess(
  'node ".opencode-workflows/scripts/merge-branch-evidence.mjs" --run-dir "' + runDir +
    '" --branch client --date "' + date + '"',
  300000
)
if (!mergeOk) {
  throw new Error('S4 证据合并闸门未通过（自洽/引用一致性统计不变式，见上方命令日志）')
}

// 合并结果回读（统计以确定性脚本为准）
const merged = await agent(
  [
    '你是合并结果回读器，工作目录为项目根目录。只做读取与转写，不做解读。',
    '',
    '任务：用 read 工具读取 ' + runDir + '/' + BRANCH_DIR + '/runtime/branch-recount.json（全文小文件），',
    '原样返回 summary 内的数字字段。只输出结构化结果。',
  ].join('\n'),
  withModel({
    label: '回读客户端合并结果',
    schema: {
      type: 'object',
      properties: {
        entryCount: { type: 'number' },
        expectedAtomCount: { type: 'number' },
        evidenceCount: { type: 'number' },
        pendingCount: { type: 'number' },
        confirmed: { type: 'number' },
        partial: { type: 'number' },
        notFound: { type: 'number' },
        directConflict: { type: 'number' },
      },
      required: ['entryCount', 'expectedAtomCount', 'evidenceCount', 'pendingCount'],
    },
    timeoutMs: 600000,
    retries: 2,
  })
)
if (!merged || !Number.isInteger(merged.entryCount)) {
  throw new Error('合并结果回读异常：' + JSON.stringify(merged))
}

log(
  'S4 客户端查证完成：分片 ' + completed.length + '/' + partFiles.length +
    ' 完成（未完成 ' + unfinished.length + '）' +
    ' / entry ' + merged.entryCount + ' + pending ' + merged.pendingCount + ' = expected ' + merged.expectedAtomCount +
    ' / CLE ' + merged.evidenceCount + ' 条 -> ' + runDir + '/' + BRANCH_DIR + '/client-evidence.json'
)

return {
  branch: 'client',
  partCount: partFiles.length,
  completedParts: completed.length,
  unfinishedParts: unfinished,
  entryCount: merged.entryCount,
  expectedAtomCount: merged.expectedAtomCount,
  evidenceCount: merged.evidenceCount,
  pendingCount: merged.pendingCount,
  runStatus: rsPatch.runStatus,
  evidencePath: runDir + '/' + BRANCH_DIR + '/client-evidence.json',
  manifestPath: MANIFEST,
}
