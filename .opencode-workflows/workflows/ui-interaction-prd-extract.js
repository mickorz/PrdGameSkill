// UI Interaction PRD Check Workflow
//
// 由 .claude/skills/ui-interaction-prd-extract/SKILL.md 转写；2026-11-11 拆分：
//   基准提取已独立为 ui-interaction-baseline-extract.js（产物固化到 skill 的
//   references/rules/{rulesName}/），本 workflow 只做对照检查，直接读取该目录基准。
//
// 2026-11-13 v2（FX 修正闭环提速，runId 见优化台账）：
//   A1 MISSING 类原文栏确定性归一化（quote 的 schema 口径对齐 SKILL.md 硬性要求，
//      agent 的缺失自述并入 problem 字段）——v1 中 schema 与报告口径冲突产生 10 条质检问题；
//   B1/B4 修正 agent 显式用 analysisModel（flash）与 1h 超时——v1 修正阶段 3241s 占全程 53%
//      （默认重型模型 attempt1 撞 30 分钟超时全量作废）。
//
// 流程：
//   [check] 扫描规则基准与需求文档
//     -> 按规则主题并行检查（严格 UI 交互口径）
//     -> 需求文档内部一致性检查
//     -> 汇总去重、确定性编号与统计
//     -> 生成 report.md（head/详情分片/tail 并行写入后确定性合并）
//     -> 报告审核（fast 档默认跳过）
//     -> 生成 HTML Dashboard
//
// 可选 args：
//   rulesDir          规则基准目录，默认 .claude/skills/ui-interaction-prd-extract/references/rules/{rulesName}
//   rulesName         规则基准子目录名，默认 hzmj_ui_interaction
//   inputDir          需求文档目录，默认 input
//   inputFiles        指定需求文档路径数组（给定时跳过目录扫描结果）
//   outDir            workflow 产物目录，默认 examples/ui-interaction-prd-extract-workflow
//   outPath           报告路径，默认 {outDir}/report.md
//   date              检查日期 YYYY-MM-DD（脚本内禁止取当前时间）
//   fast              true 为速度档；默认质量档（保留审核与修正闭环）
//   skipReview        跳过报告审核
//   analysisModel     检查/归类模型，默认 biangfeng-gateway/deepseek-v4.1-flash-official（传空串用会话默认）
//   reviewModel       报告审核模型，默认同 analysisModel
//   concurrency       并发上限，默认 16（运行时钳制到 16）
//   maxIssuesPerGroup 每组最多问题数，默认 10
//   maxRuleGroups     规则分组上限，默认质量档 24，fast 档 16
//   dashboard         false 跳过 Dashboard
//   dashboardScript   默认 .claude/skills/game-prd-check/scripts/build-dashboard.mjs
//   requirementsPath + extractionRunId 共享需求快照消费（v4 阶段 4，必项成对传入，只传其一直接报错）：
//                     快照完整性/extractionRunId 一致/源 PRD sha256 校验（check-shared-snapshot.mjs，变更即拒）；
//                     检查/一致性/审核 agent 附需求点清单（REQ ID 定位），issue 增加 requirementIds 关联

export const meta = {
  id: 'ui-interaction-prd-extract',
  name: 'ui_interaction_prd_extract',
  description: '读取客户端代码逆向提取的 UI 交互基准（由 ui-interaction-baseline-extract 维护），对照需求文档产出 UI 交互问题报告与 Dashboard',
  phases: [
    { title: '扫描规则与需求' },
    { title: '规则检查' },
    { title: '一致性检查' },
    { title: '汇总去重' },
    { title: '生成报告' },
    { title: '报告审核' },
    { title: '生成Dashboard' },
  ],
}

const A = args || {}

const clientDir = A.clientDir || 'input-ui/xuanwulobby/assets/42319'
// 基准由 ui-interaction-baseline-extract.js 固化到 skill 目录，本 workflow 只读取
const rulesDir = A.rulesDir || '.claude/skills/ui-interaction-prd-extract/references/rules/' + (A.rulesName || 'hzmj_ui_interaction')
const inputDir = A.inputDir || 'input'
const outDir = A.outDir || 'examples/ui-interaction-prd-extract-workflow'
const outPath = A.outPath || outDir + '/report.md'
const checkDate = A.date || '未提供（调用时请传 args.date，格式 YYYY-MM-DD）'
const maxIssuesPerGroup = A.maxIssuesPerGroup || 10
const fastMode = A.fast === true
const skipReview = A.skipReview === false ? false : A.skipReview === true || fastMode
const maxRuleGroups = A.maxRuleGroups || (fastMode ? 16 : 24)
const dashboardEnabled = A.dashboard !== false
const dashboardScript =
  A.dashboardScript || '.claude/skills/game-prd-check/scripts/build-dashboard.mjs'

const analysisModel =
  A.analysisModel === undefined ? 'biangfeng-gateway/deepseek-v4.1-flash-official' : A.analysisModel
const analysisAgentOptions = analysisModel
  ? { model: analysisModel, timeoutMs: 3600000 }
  : { timeoutMs: 3600000 }
const reviewModel = A.reviewModel === undefined ? analysisModel : A.reviewModel
const reviewAgentOptions = reviewModel
  ? { model: reviewModel, timeoutMs: 1800000 }
  : { timeoutMs: 1800000 }

setConcurrency(A.concurrency || 16)

// 共享需求快照消费（v4 阶段 4）：传 requirementsPath + extractionRunId 成对校验；
// 传时需求文档清单从快照 manifest.sourceFiles 确定性推导（跳过目录扫描），
// 检查/一致性/审核 agent 附需求点清单（REQ ID 定位），issue 增加 requirementIds 关联
const sharedRequirementsPath = A.requirementsPath || null
const sharedExtractionRunId = A.extractionRunId || null
if ((sharedRequirementsPath && !sharedExtractionRunId) || (!sharedRequirementsPath && sharedExtractionRunId)) {
  throw new Error('requirementsPath 与 extractionRunId 必须成对传入（共享需求快照消费，v4 契约；只传其一直接报错）')
}
let sharedManifestOk = false
if (sharedRequirementsPath) {
  // 沙箱无 readFile：快照完整性/runId 一致/源 sha256 校验下沉到 node 脚本（布尔回传，失败原因在 stderr 日志）
  const ok = commandSuccess('node .opencode-workflows/scripts/check-shared-snapshot.mjs "' + sharedRequirementsPath + '" "' + sharedExtractionRunId + '" --verify-source')
  if (!ok) {
    throw new Error('共享快照校验失败：' + sharedRequirementsPath + '（extractionRunId ' + sharedExtractionRunId + '；原因见上方命令日志，不猜测、不回退旧路径静默运行）')
  }
  // 需求清单瘦身：只含 requirementId/reqKey/title 的索引写到 outDir（快照目录保持只读），agent 读索引定位 + 按需 grep 回查
  const idxOk = commandSuccess('node .opencode-workflows/scripts/gen-req-index.mjs "' + sharedRequirementsPath + '" --out "' + outDir + '/requirements-index.json"')
  if (!idxOk) {
    throw new Error('需求索引生成失败：' + sharedRequirementsPath + '（快照 requirements.json 字段不完整）')
  }
  sharedManifestOk = true
  log('消费共享需求快照：' + sharedRequirementsPath + '（extractionRunId ' + sharedExtractionRunId + '），检查/一致性/审核 agent 用瘦身索引，按需回查原文')
}

const TYPE_RULE = [
  'MISSING：基准中定义了、但需求文档缺失或未描述',
  'CONFLICT：需求文档内部两处描述互相矛盾',
  'LOGIC：与 UI 交互基准冲突，或需求文档自身逻辑错误',
  'AMBIGUOUS：描述可多种理解，无法确定实现方式',
  'INCOMPLETE：描述不完整，无法实现或无法验收',
].join('\n')

const PRIORITY_RULE = [
  'P0：关键流程/交互缺失或矛盾，直接阻塞开发或验收',
  'P1：明确的冲突、逻辑错误，不解决会导致实现错误',
  'P2：模糊、不完整，需要澄清后才能实现',
  'P3：优化建议或新功能差异说明，不影响正确性',
].join('\n')

const TYPE_LABELS = {
  MISSING: '需求缺失',
  CONFLICT: '内容冲突',
  LOGIC: '逻辑错误',
  AMBIGUOUS: '定义歧义',
  INCOMPLETE: '描述不完整',
}

const CHECK_SCAN_SCHEMA = {
  type: 'object',
  properties: {
    inputFiles: { type: 'array', items: { type: 'string' } },
    ruleGroups: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          focus: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
          sections: {
            type: 'array',
            description: '大文件按章节拆分后的行范围片段',
            items: {
              type: 'object',
              properties: {
                file: { type: 'string' },
                fromLine: { type: 'number' },
                toLine: { type: 'number' },
                title: { type: 'string' },
              },
              required: ['file', 'fromLine', 'toLine'],
            },
          },
        },
        required: ['title', 'files'],
      },
    },
  },
  required: ['inputFiles', 'ruleGroups'],
}

const ISSUE_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['MISSING', 'CONFLICT', 'LOGIC', 'AMBIGUOUS', 'INCOMPLETE'] },
    priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
    scope: { type: 'string', enum: ['ui', 'out'], description: 'ui=有 UI 基准条款支撑；out=超出 UI 基准范围' },
    outReason: { type: 'string', description: 'scope=out 时的归口说明，如 玩法逻辑规则基准 / 纯文档质量；scope=ui 填 无' },
    module: { type: 'string', description: '问题所属模块或界面，如 吃碰杠胡 / 断线重连 / 小结算界面' },
    title: { type: 'string', description: '一句话问题，不超过 40 字' },
    location: { type: 'string', description: '需求文档原文位置（章节/小节标题），多处用、分隔' },
    quote: { type: 'string', description: '需求文档原文引文，不超过 200 字；MISSING 类固定写「需求文档无对应描述」，缺失原因说明写进 problem 字段，不要写进引文' },
    ruleRef: { type: 'string', description: 'UI 基准条款号，如 01#9,03#12；scope=out 填 无' },
    requirementIds: { type: 'array', items: { type: 'string' }, description: '共享快照需求点 ID 列表（REQ-xxx；未传共享快照或无法定位时填空数组）' },
    problem: { type: 'string', description: '问题说明，指出与哪条 UI 基准冲突或哪里缺失/矛盾' },
    impact: { type: 'string', description: '对开发 / 测试 / 验收的具体影响' },
    suggestion: { type: 'string', description: '具体可执行的补充或修正建议' },
    acceptance: { type: 'string', description: '补齐后的验收口径：怎样算达标、测试能否直接出用例' },
  },
  required: [
    'type',
    'priority',
    'scope',
    'outReason',
    'module',
    'title',
    'location',
    'quote',
    'ruleRef',
    'problem',
    'impact',
    'suggestion',
    'acceptance',
  ],
}

const ISSUES_SCHEMA = {
  type: 'object',
  properties: {
    issues: { type: 'array', items: ISSUE_ITEM_SCHEMA },
    summary: { type: 'string', description: '本次检查覆盖了哪些基准条款、是否有条款无法对照' },
  },
  required: ['issues'],
}

const DEDUP_SCHEMA = {
  type: 'object',
  properties: {
    duplicateGroups: { type: 'array', items: { type: 'array', items: { type: 'number' } } },
    notes: { type: 'string' },
  },
  required: ['duplicateGroups'],
}

const SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    overview: { type: 'string', description: '检查概览总体总结，200~350 字' },
    recommendations: { type: 'string', description: '总体建议，150~250 字，含问题最多模块与是否建议进入开发' },
  },
  required: ['overview', 'recommendations'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    problems: { type: 'array', items: { type: 'string' } },
  },
  required: ['ok', 'problems'],
}

const DASHBOARD_SCHEMA = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    htmlPath: { type: 'string', description: '生成成功的 HTML 路径，失败留空' },
    reportJsonPath: { type: 'string', description: '生成的 report.json 路径，失败留空' },
    errors: { type: 'array', items: { type: 'string' } },
    commandOutput: { type: 'string', description: '命令输出的最后 20 行' },
  },
  required: ['ok'],
}

function pad2(n) {
  return String(n).padStart(2, '0')
}


function compactKey(s) {
  return String(s || '')
    .replace(/[\s\p{P}\p{S}]/gu, '')
    .toLowerCase()
}

function exactDedup(list) {
  const seen = {}
  const out = []
  for (const it of list) {
    const key = it.type + '|' + compactKey(it.location) + '|' + compactKey(it.title).slice(0, 12)
    if (seen[key]) {
      const kept = seen[key]
      if (!kept._dups) kept._dups = []
      kept._dups.push(it)
      it._dupOf = kept
      if (it.location && String(kept.location || '').indexOf(it.location) < 0) {
        kept.location = (kept.location ? kept.location + '、' : '') + it.location
      }
      continue
    }
    seen[key] = it
    out.push(it)
  }
  return out
}

function ruleScopeText(group) {
  const lines = []
  const files = group.files || []
  const sections = group.sections || []
  if (files.length > 0) {
    lines.push('规则文件（逐个读完）：')
    for (const f of files) lines.push('- ' + f)
  }
  if (sections.length > 0) {
    lines.push('规则文件片段（用 read 的 offset/limit 精确读取下列行范围，不要整读大文件）：')
    for (const s of sections) {
      lines.push(
        '- ' + s.file + ' 第 ' + s.fromLine + '~' + s.toLine + ' 行' + (s.title ? '（' + s.title + '）' : '')
      )
    }
  }
  if (lines.length === 0) lines.push('（未提供规则文件，按组名在规则基准目录中检索相关条款）')
  return lines.join('\n')
}

function uiIssueRules() {
  return [
    '问题类型只允许这五种：',
    TYPE_RULE,
    '',
    '优先级只允许这四级：',
    PRIORITY_RULE,
    '',
    '检查口径（严格遵守）：',
    '1. 基准是客户端已实现的 UI 交互事实，是标尺；需求文档与基准冲突时记需求文档的问题。',
    '2. 需求文档明示“本期不做/按无托管处理”的项，不报缺失。',
    '3. 基准中标注“死代码/无消费方/已移除”的条款，不作为要求需求文档覆盖的依据；需求若描述了这些行为且与实现不符，记 CONFLICT。',
    '4. 交互限制四类（前置守卫/互斥/超时/失败与恢复）是重点检查维度，需求缺失即报 INCOMPLETE。',
    '5. 严格 UI 归因：ruleRef 必须指向 UI 基准的具体条款号（如 01#9、02#6）；玩法逻辑（何时可碰杠胡、番型、算分）与纯文档质量问题（编号悬空、术语不一致）scope 填 out，outReason 写归口，不计入统计。',
    '6. 需求有意新增、现网不存在的功能，记 P3 并建议补充“与现网实现的差异说明”，不要报 CONFLICT。',
    '7. 证据先行：每条必须有需求原文位置与引文；报 MISSING 前复核基准条款与需求确实未覆盖。' + (sharedRequirementsPath ? 'REQ 关联（必做步骤）：除「需求缺失」类外，每条问题必须先读需求点索引文件（' + outDir + '/requirements-index.json）定位涉及的需求点，requirementIds 列出对应 REQ ID（REQ-xxx，可多条）；「需求缺失」类是 PRD 未写、快照天然无条目，可填空数组。非缺失类不许整体留空。' : ''),
    '8. 不重复：同一缺陷只记一条，多处证据合并进同一条的 location。',
    '9. 按优先级从高到低自检，最多输出 ' + maxIssuesPerGroup + ' 条最有价值的问题。',
    '10. 只输出结构化结果，不要输出报告正文。',
  ].join('\n')
}

function cell(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '／')
    .trim()
}

function detailField(name, value) {
  const v = String(value === undefined || value === null ? '' : value).trim()
  return '- **' + name + '**：' + (v || '无')
}

// ============================================================
// check：对照 UI 交互基准检查需求文档
// ============================================================

await check(() => fileExists(rulesDir), '规则基准目录不存在：' + rulesDir)

phase('扫描规则与需求')

const scan = await agent(
  [
    '你是 UI 交互 PRD 检查流程的扫描器，工作目录为项目根目录。只做清单扫描，不读正文做判断。',
    '',
    '任务：',
    '1. 列出需求文档目录 ' + inputDir + ' 下所有 Markdown 文档，返回相对项目根目录的路径，写入 inputFiles。',
    '2. 遍历 UI 交互规则基准目录 ' + rulesDir + '，把规则文件按主题分组，每组给出 title、focus、files、sections。',
    '   - 每个规则文件（00-基准说明除外）默认一组，files 必须是相对项目根目录的完整路径。',
    '   - 单个规则文件超过 20KB（约 8000 字）时按一级章节拆分：一章一个片段、一个片段一组，files 留空数组，sections 填 { file, fromLine, toLine, title }。片段必须首尾相接覆盖全文（从第 1 行到文件最后一行），不能留空档。用 grep 查章节标题、read 带 offset 确认行号（read 显示的行号即真实行号）。',
    '   - 总组数上限 ' + maxRuleGroups + ' 组；超过时把相邻章节合并进同一组，sections 可包含多个连续片段，但必须覆盖全文。',
    '   - focus 用一句话说明这组规则管什么。',
    '3. 如果规则目录结构与本说明不同，按实际结构自适应分组，仍要覆盖全部规则文件（00-基准说明除外）。',
  ].join('\n'),
  { label: '扫描规则基准与需求文档', schema: CHECK_SCAN_SCHEMA, ...analysisAgentOptions, timeoutMs: 1200000 }
)

if (!scan || !Array.isArray(scan.ruleGroups) || scan.ruleGroups.length === 0) {
  throw new Error('扫描阶段失败：未取得规则分组清单，请检查规则目录 ' + rulesDir)
}

const inputFiles =
  A.inputFiles && A.inputFiles.length > 0 ? A.inputFiles : Array.isArray(scan.inputFiles) ? scan.inputFiles : []
if (inputFiles.length === 0) {
  throw new Error('未找到需求文档：请检查目录 ' + inputDir + ' 或通过 args.inputFiles 指定')
}

const prdDisplayPath = A.inputFiles && A.inputFiles.length > 0 ? A.inputFiles.join('、') : inputFiles[0]
const inputList = inputFiles.map((f) => '- ' + f).join('\n')
// 共享快照模式：检查/一致性/审核 agent 附需求点瘦身索引（REQ ID 定位；需要原文时 grep 回查，不整读全量）
const reqListHint = sharedRequirementsPath
  ? [
      '需求点索引文件（requirementId/reqKey/title 三字段，定位需求点）：',
      '- ' + outDir + '/requirements-index.json',
      '需要需求点原文佐证时，用 requirementId 在全量快照 grep 回查：- ' + sharedRequirementsPath + '/requirements.json（只按行回查，不要整读全量文件）。',
      '',
    ].join('\n')
  : ''
const ruleGroups = scan.ruleGroups
const ruleFileCount = ruleGroups.reduce((s, g) => s + (g.files || []).length, 0)

log('扫描完成：需求文档 ' + inputFiles.length + ' 份，规则分组 ' + ruleGroups.length + ' 组')

phase('规则检查')

const groupTasks = parallel(
  ruleGroups.map((group) => () =>
    agent(
      [
        '你是资深游戏 UI 交互审核员，正在对照客户端 UI 交互基准检查需求文档。',
        '',
        '需求文档（务必全文逐段读完，文件较大可分多次读取）：',
        inputList,
        sharedRequirementsPath ? reqListHint : '',
        '',
        '本次负责的规则范围：' + group.title,
        '范围聚焦：' + (group.focus || '该组全部规则'),
        ruleScopeText(group),
        '',
        '检查方式：把本组每条 UI 基准条款与需求文档逐条对照，找出需求文档的问题。',
        '注意：基准描述的是客户端已实现的正确交互，它是标尺；只报告需求文档的缺失、冲突、逻辑错误、模糊与不完整。',
        '其他规则组的问题不要报告，由其他检查员负责。',
        '',
        uiIssueRules(),
      ].join('\n'),
      {
        label: '检查 ' + group.title,
        schema: ISSUES_SCHEMA,
        ...analysisAgentOptions,
        retries: 1,
      }
    )
  )
)

phase('一致性检查')

const internalTask = agent(
  [
    '你是资深游戏 UI 交互审核员，本次只做需求文档内部一致性检查，不按基准条款逐条对照。',
    '',
    '需求文档（务必全文读完，可分多次读取）：',
    inputList,
    sharedRequirementsPath ? reqListHint : '',
    '',
    '只找以下三类问题：',
    '1. CONFLICT：文档内部两处（不同章节/表格/流程图）对 UI 交互的描述互相矛盾。',
    '2. AMBIGUOUS：同一处 UI 交互描述可多种理解，实现方式无法确定。',
    '3. INCOMPLETE：界面流程、状态、数值、异常分支缺失，导致无法实现或无法验收。',
    '',
    '不要报告基准里有、文档没写的内容（那属于规则覆盖检查，另有检查员负责）。',
    '只报 UI 交互相关问题；玩法逻辑与纯文档质量问题 scope 填 out，outReason 写归口。',
    '',
    uiIssueRules(),
  ].join('\n'),
  { label: '全文一致性检查', schema: ISSUES_SCHEMA, ...analysisAgentOptions, retries: 1 }
)

const groupResults = await groupTasks
const internalResult = await internalTask

phase('汇总去重')

let allIssues = []
let droppedGroup = 0
for (const r of groupResults || []) {
  if (!r || !Array.isArray(r.issues)) {
    droppedGroup += 1
    continue
  }
  for (const it of r.issues) allIssues.push(it)
}
if (internalResult && Array.isArray(internalResult.issues)) {
  for (const it of internalResult.issues) allIssues.push(it)
}
if (droppedGroup > 0) log('有 ' + droppedGroup + ' 个规则组检查失败，报告仅覆盖成功分组')

const outOfScope = allIssues.filter((it) => it.scope === 'out')
let inScopeIssues = allIssues.filter((it) => it.scope !== 'out')
if (outOfScope.length > 0) log('超出 UI 基准范围的发现 ' + outOfScope.length + ' 条，将移入附录，不计入统计')

if (inScopeIssues.length > 15) {
  const compact = inScopeIssues.map((it, i) => ({
    i: i,
    type: it.type,
    priority: it.priority,
    title: it.title,
    location: it.location,
  }))

  const dedup = await agent(
    [
      '你是 UI 交互问题清单合并员。下面是从不同检查员汇总的问题索引（i 为下标）：',
      JSON.stringify(compact, null, 1),
      '',
      '任务：找出指向同一处缺陷的重复条目（标题不同但描述同一缺陷也算重复）。',
      '只输出 duplicateGroups，每个子数组是同一条问题的下标，第一个下标为保留项，其余为重复项；',
      '不要把不同缺陷合并，也不要凭猜测合并。没有重复就返回空数组。',
    ].join('\n'),
    { label: '重复问题归并', schema: DEDUP_SCHEMA, ...analysisAgentOptions, timeoutMs: 1800000 }
  )

  const groups = (dedup && dedup.duplicateGroups) || []
  for (const g of groups) {
    if (!Array.isArray(g) || g.length < 2) continue
    const idxs = g.filter((n) => Number.isInteger(n) && n >= 0 && n < inScopeIssues.length)
    if (idxs.length < 2) continue
    const keep = inScopeIssues[idxs[0]]
    if (!keep._dups) keep._dups = []
    for (const idx of idxs.slice(1)) {
      if (idx === idxs[0]) continue
      const dup = inScopeIssues[idx]
      if (dup._dupOf || dup._dups) continue
      dup._dupOf = keep
      keep._dups.push(dup)
      const loc = dup.location
      if (loc && String(keep.location || '').indexOf(loc) < 0) {
        keep.location = (keep.location ? keep.location + '、' : '') + loc
      }
    }
  }
  const marked = inScopeIssues.filter((it) => it._dupOf).length
  if (marked > 0) log('问题归并完成：' + marked + ' 条重复问题将标注为同根因')
} else if (inScopeIssues.length > 0) {
  inScopeIssues = exactDedup(inScopeIssues)
  log('问题较少（≤15 条），使用确定性去重')
}

const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 }
const TYPE_ORDER = { MISSING: 0, CONFLICT: 1, LOGIC: 2, AMBIGUOUS: 3, INCOMPLETE: 4 }
inScopeIssues.sort((a, b) => {
  const p = (PRIORITY_ORDER[a.priority] || 0) - (PRIORITY_ORDER[b.priority] || 0)
  if (p !== 0) return p
  return (TYPE_ORDER[a.type] || 0) - (TYPE_ORDER[b.type] || 0)
})

const issues = inScopeIssues.map((it, i) => ({
  id: 'Q' + pad2(i + 1),
  type: it.type,
  priority: it.priority,
  title: it.title,
  module: it.module || '未分类',
  location: it.location,
  quote: it.quote,
  ruleRef: it.ruleRef,
  problem: it.problem,
  impact: it.impact,
  suggestion: it.suggestion,
  acceptance: it.acceptance || '',
  _src: it,
}))

const issueBySrc = new Map()
for (const it of issues) issueBySrc.set(it._src, it)
for (const it of issues) {
  const src = it._src
  if (src._dups && src._dups.length > 0) {
    const dupIds = src._dups
      .map((d) => issueBySrc.get(d))
      .filter(Boolean)
      .map((d) => d.id)
    if (dupIds.length > 0) {
      it.title = it.title + '（本类主条目，' + dupIds.join('、') + ' 同根因）'
    }
  }
  if (src._dupOf) {
    const keep = issueBySrc.get(src._dupOf)
    if (keep) {
      it.title = it.title + '（与 ' + keep.id + ' 同根因，重复登记，建议合并）'
      it.suggestion = '与 ' + keep.id + ' 合并处理：' + (it.suggestion || '')
    }
  }
}

const stats = { total: issues.length, P0: 0, P1: 0, P2: 0, P3: 0 }
const typeStats = { MISSING: 0, CONFLICT: 0, LOGIC: 0, AMBIGUOUS: 0, INCOMPLETE: 0 }
const moduleStats = {}
for (const it of issues) {
  stats[it.priority] = (stats[it.priority] || 0) + 1
  typeStats[it.type] = (typeStats[it.type] || 0) + 1
  moduleStats[it.module] = (moduleStats[it.module] || 0) + 1
}
const moduleRank = Object.keys(moduleStats)
  .map((name) => ({ name: name, count: moduleStats[name] }))
  .sort((a, b) => b.count - a.count)

const appendix = outOfScope.map((it, i) => ({
  id: '附' + pad2(i + 1),
  type: it.type,
  priority: it.priority,
  module: it.module || '未分类',
  title: it.title,
  location: it.location,
  quote: it.quote,
  outReason: it.outReason || '超出 UI 基准范围',
  problem: it.problem,
  suggestion: it.suggestion,
}))

log(
  '汇总完成：共 ' + stats.total + ' 条 UI 交互问题（P0 ' + stats.P0 + ' / P1 ' + stats.P1 + ' / P2 ' + stats.P2 + ' / P3 ' + stats.P3 + '）' +
    (appendix.length > 0 ? '，附录 ' + appendix.length + ' 条' : '')
)

phase('生成报告')

const overviewInput = {
  stats: stats,
  typeStats: typeStats,
  moduleRank: moduleRank,
  total: stats.total,
  appendixCount: appendix.length,
  issues: issues.map((it) => ({
    id: it.id,
    priority: it.priority,
    type: it.type,
    module: it.module,
    title: it.title,
    ruleRef: it.ruleRef,
  })),
}

let summary = null
if (stats.total > 0) {
  summary = await agent(
    [
      '你是游戏 UI 交互需求评审负责人。请基于下面的检查统计与问题索引，写两段中文结论。',
      JSON.stringify(overviewInput, null, 1),
      '',
      '要求：',
      '1. overview（检查概览总体总结，200~350 字）：概括基准覆盖范围、需求文档在视觉规格与交互行为两方面的表现差异、主要缺失集中在哪些交互链路、有无自相矛盾；只能使用给定数据，不得编造新问题。',
      '2. recommendations（总体建议，150~250 字）：指出问题最多的模块、最需要优先补齐的 P0/P1 条目编号，并明确给出“是否建议进入开发”的结论与理由。',
      '3. 纯文本，可用中文分号与句号，不要 Markdown 标题，不要列表符号，不要 Emoji。',
    ].join('\n'),
    { label: '生成总结与建议', schema: SUMMARY_SCHEMA, ...analysisAgentOptions, timeoutMs: 1800000 }
  )
}

const overviewText =
  summary && summary.overview
    ? summary.overview
    : '本次共发现 ' + stats.total + ' 条 UI 交互问题（P0 ' + stats.P0 + '、P1 ' + stats.P1 + '、P2 ' + stats.P2 + '、P3 ' + stats.P3 + '）。' +
      (moduleRank.length > 0 ? '问题最多的模块为' + moduleRank[0].name + '。' : '') +
      '建议先补齐 P0/P1 交互缺失与冲突，再澄清 P2 模糊项。'
const recommendText =
  summary && summary.recommendations
    ? summary.recommendations
    : moduleRank.length > 0
      ? '问题最多模块为' + moduleRank[0].name + '，建议优先补齐 P0/P1 条目后再进入开发。'
      : '建议按问题清单逐条补齐后进入开发。'

const matrixRows = ['P0', 'P1', 'P2', 'P3'].map((p) => {
  const label = {
    P0: 'P0（阻塞开发验收）',
    P1: 'P1（明确冲突错误）',
    P2: 'P2（模糊需澄清）',
    P3: 'P3（优化建议）',
  }[p]
  const count = stats[p] || 0
  return (
    '| ' + label + ' | ' +
    (issues.filter((it) => it.priority === p && it.type === 'MISSING').length) + ' | ' +
    (issues.filter((it) => it.priority === p && it.type === 'CONFLICT').length) + ' | ' +
    (issues.filter((it) => it.priority === p && it.type === 'LOGIC').length) + ' | ' +
    (issues.filter((it) => it.priority === p && it.type === 'AMBIGUOUS').length) + ' | ' +
    (issues.filter((it) => it.priority === p && it.type === 'INCOMPLETE').length) + ' | **' + count + '** |'
  )
})

const totalRow =
  '| **合计** | **' + typeStats.MISSING + '** | **' + typeStats.CONFLICT + '** | **' + typeStats.LOGIC +
  '** | **' + typeStats.AMBIGUOUS + '** | **' + typeStats.INCOMPLETE + '** | **' + stats.total + '** |'

const tableRows = issues.map((it) =>
  '| ' + it.id + ' | UI 交互 | ' + it.priority + ' | ' + it.type + ' | ' +
  cell(it.module) + ' | ' + cell(it.title) + ' | ' + cell(it.location) + ' | ' + cell(it.ruleRef) + ' |'
)

// A1：MISSING 类原文栏确定性归一化（SKILL.md 硬性要求），agent 的缺失自述并入 problem 字段；
// 消除 quote 的 schema 口径与报告口径不一致导致的质检-修正往返（v1 中 10 条质检问题由此产生）
const detailBlocks = issues.map((it) => {
  const isMissing = it.type === 'MISSING'
  const originText = isMissing
    ? '位置“' + (it.location || '') + '”。需求文档无对应描述。'
    : '位置“' + (it.location || '') + '”。引文：“' + (it.quote || '') + '”'
  const quoteNote = it.quote || ''
  const problemText =
    isMissing && quoteNote && quoteNote.indexOf('需求文档无对应描述') < 0
      ? (it.problem || '') + '。缺失说明：' + quoteNote
      : it.problem
  return [
    '### ' + it.id + '【' + it.priority + ' / ' + it.type + '】' + it.title,
    '',
    detailField('问题性质', TYPE_LABELS[it.type] || it.type),
    detailField('原文', originText),
    detailField('需求点', (it.requirementIds || []).join('、') || '无'),
    detailField('基准依据', it.ruleRef + '。' + (problemText || '')),
    detailField('问题', problemText),
    detailField('影响', it.impact),
    detailField('建议', it.suggestion),
    detailField('验收口径', it.acceptance),
    detailField('处理状态', '待确认'),
  ].join('\n')
})

const appendixBlocks = appendix.map((it) =>
  [
    '### ' + it.id + '【' + it.priority + ' / ' + it.type + '】' + it.title,
    '',
    detailField('归口', it.outReason),
    detailField('原文', '位置“' + (it.location || '') + '”。引文：“' + (it.quote || '') + '”'),
    detailField('问题', it.problem),
    detailField('建议', it.suggestion),
  ].join('\n')
)

const headParts = []
headParts.push('# UI 交互检查问题报告（基于客户端代码逆向基准）')
headParts.push('')
headParts.push('## 检查信息')
headParts.push('')
headParts.push('检查对象：' + prdDisplayPath)
headParts.push('')
headParts.push('规则基准：' + rulesDir + '（' + (ruleFileCount || ruleGroups.length) + ' 个规则文件）')
headParts.push('')
headParts.push('检查日期：' + checkDate)
headParts.push('')
headParts.push(
  '说明：基准来源为客户端源码 ' + clientDir + ' 逆向提取的 UI 交互事实。需求与基准冲突时记需求文档问题；需求有意新增（现网不存在）的功能记 P3 差异说明；标注死代码/无消费方的条款不作缺失依据。'
)
headParts.push('')
headParts.push(
  '归因口径：每条问题的基准依据必须指向 UI 交互基准的具体条款号；玩法逻辑问题与纯文档质量问题移入附录，不计入统计。'
)
headParts.push('')
headParts.push('---')
headParts.push('')
headParts.push('## 1. 检查概览')
headParts.push('')
headParts.push('### 1.1 问题统计')
headParts.push('')
headParts.push('| 优先级 | MISSING | CONFLICT | LOGIC | AMBIGUOUS | INCOMPLETE | 小计 |')
headParts.push('|---|---|---|---|---|---|---|')
for (const r of matrixRows) headParts.push(r)
headParts.push(totalRow)
headParts.push('')
headParts.push('### 1.2 总体总结')
headParts.push('')
headParts.push(overviewText)
headParts.push('')
headParts.push('---')
headParts.push('')
headParts.push('## 2. 问题清单')
headParts.push('')
headParts.push('| ID | 问题维度 | 优先级 | 类型 | 模块 | 问题 | 原文位置 | 基准依据 |')
headParts.push('|---|---|---|---|---|---|---|---|')
for (const r of tableRows) headParts.push(r)
headParts.push('')
headParts.push('---')
headParts.push('')
headParts.push('## 3. 问题详情')

const tailParts = []
tailParts.push('---')
tailParts.push('')
tailParts.push('## 4. 总体建议')
tailParts.push('')
tailParts.push(recommendText)
tailParts.push('')
if (appendixBlocks.length > 0) {
  tailParts.push('## 附录：超出 UI 基准范围的发现（不计入统计）')
  tailParts.push('')
  tailParts.push('以下发现无 UI 交互基准条款支撑，不计入统计表与问题清单，仅作参考。')
  tailParts.push('')
  for (const b of appendixBlocks) {
    tailParts.push(b)
    tailParts.push('')
  }
}

// 分片写入：单个大 prompt 容易触发上游 provider 长响应超时，
// 把报告拆成 head + 若干详情分片 + tail，每片独立子代理写出，再按文件名顺序拼接。
const HEAD_TEXT = headParts.join('\n') + '\n\n'
const TAIL_TEXT = tailParts.join('\n') + '\n'
const DETAIL_BUDGET = 7000
const DETAIL_MAX_COUNT = 5
const detailChunks = []
{
  let cur = []
  let size = 0
  for (const b of detailBlocks) {
    if (cur.length > 0 && (size + b.length > DETAIL_BUDGET || cur.length >= DETAIL_MAX_COUNT)) {
      detailChunks.push(cur)
      cur = []
      size = 0
    }
    cur.push(b)
    size += b.length + 2
  }
  if (cur.length > 0) detailChunks.push(cur)
}

const reportPieces = [HEAD_TEXT]
for (const chunk of detailChunks) reportPieces.push(chunk.join('\n\n') + '\n\n')
reportPieces.push(TAIL_TEXT)
const reportMarkdown = reportPieces.join('')

const partDir = outDir + '/.report-parts'
const partFiles = reportPieces.map((_, i) => partDir + '/part-' + pad2(i + 1) + '.md')

await parallel(
  reportPieces.map((content, i) => () =>
    agent(
      [
        '你的任务是把下面 PART-BEGIN 与 PART-END 之间的 Markdown 内容逐字写入文件：' + partFiles[i],
        '',
        '要求：',
        '1. 使用 write 工具写入，UTF-8 编码。',
        '2. 内容逐字复制，不得改写、增删、总结、翻译或加代码围栏；标题、表格、字段、编号、空行全部保留。',
        '3. 只写这一个分片文件，不要写其他文件，不要执行 git 命令。',
        '4. 写完后返回文件路径。',
        '',
        'PART-BEGIN',
        content,
        'PART-END',
      ].join('\n'),
      { label: '写入分片 ' + (i + 1) + '/' + reportPieces.length, agentType: 'general', timeoutMs: 900000, retries: 2 }
    )
  )
)

// 合并报告分片（确定性命令 merge-parts.mjs，替代合并 agent：无 LLM 转述命令、无单引号转义问题）
const mergeScript = '.opencode-workflows/scripts/merge-parts.mjs'
const mergeCmd = 'node "' + mergeScript + '" "' + outPath + '" ' + partFiles.map((p) => '"' + p + '"').join(' ')
const merged = await commandSuccess(mergeCmd)
if (!merged) throw new Error('报告分片合并失败（分片缺失或损坏，上次运行可能中断），请重跑 workflow')
// 乱码检查（确定性命令；发现乱码直接报错暴露）
const fffdClean = await commandSuccess(
  'node -e "process.exit(require(\'fs\').readFileSync(process.argv[1],\'utf8\').includes(\'\\uFFFD\')?1:0)" "' + outPath + '"'
)
if (!fffdClean) {
  throw new Error('报告 ' + outPath + ' 含乱码替换字符 U+FFFD（分片写入编码异常），请删除该文件后重跑 workflow')
}
const mergeResult = '已合并（确定性命令）：' + outPath
// 清理空分片目录（rmdirSync 仅空目录可删；目录不存在时失败可忽略）
await commandSuccess('node -e "require(\'fs\').rmdirSync(process.argv[1])" "' + partDir + '"')

await check(() => fileExists(outPath), '报告文件未生成：' + outPath)
log('报告已写入：' + outPath + '（问题 ' + stats.total + ' 条，' + reportPieces.length + ' 个分片）')
const writeResult = mergeResult

phase('报告审核')

let review = null
let fixed = false

if (skipReview) {
  log(fastMode ? 'fast 档默认跳过报告审核（可用 args.skipReview=false 保留）' : '已按 args.skipReview 跳过报告审核')
} else {
  const expectedIds = issues.map((it) => it.id).join('、')
  review = await agent(
    [
      '你是 UI 交互检查报告质检员。审核报告是否符合格式与硬性要求。',
      '',
      '报告文件：' + outPath,
      '规则基准目录：' + rulesDir,
      '需求文档：' + prdDisplayPath,
      '期望问题总数：' + stats.total + '（P0 ' + stats.P0 + ' / P1 ' + stats.P1 + ' / P2 ' + stats.P2 + ' / P3 ' + stats.P3 + '）',
      '期望 ID 序列：' + expectedIds,
      '期望详情条数：' + issues.length,
      '期望附录条数：' + appendix.length,
      '',
      '逐项检查并输出问题列表：',
      '1. 是否包含检查信息、1 检查概览（1.1 统计矩阵 + 1.2 总体总结）、2 问题清单、3 问题详情、4 总体建议；有附录时附录在 4 之后。',
      '2. 检查对象、规则基准、检查日期是否已填写，不能留占位符。',
      '3. 统计矩阵行格式是否为 P0~P3 四行 + 合计行，数字与期望总数和优先级分布一致。',
      '4. 问题清单表头是否为 ID | 问题维度 | 优先级 | 类型 | 模块 | 问题 | 原文位置 | 基准依据；行数是否等于期望总数；ID 是否从 Q01 连续编号；问题维度是否全部为“UI 交互”。',
      '5. 每条清单项是否都有模块、问题、原文位置、基准依据；基准依据是否为具体条款号（如 01#9）。',
      '6. 问题详情是否覆盖全部 ' + issues.length + ' 条，标题格式是否为 ### Q01【P0 / MISSING】标题；每条是否包含 问题性质、原文、基准依据、问题、影响、建议、验收口径、处理状态；原文与问题、影响不得为空。',
      '7. 附录条目是否使用 附xx 编号、是否在 4 之后、是否未混入问题清单与统计。',
      '8. 是否存在编造内容（引文与清单对不上、凭空新增问题）。',
      sharedRequirementsPath
        ? '9. REQ 关联率把关：统计问题详情中非「需求缺失」类问题的「需求点」行；非「无」的比例低于 50% 时 ok=false，problems 写明「REQ 关联率过低（x/y），非缺失类问题需回补需求点关联」（需求文档写了的问题必能对应快照需求点）。'
        : '',
      '',
      '全部通过返回 ok=true、problems 为空数组；有问题返回 ok=false 并逐条写清问题与位置。',
    ].join('\n'),
    { label: '审核报告', schema: REVIEW_SCHEMA, ...reviewAgentOptions }
  )

  if (review && review.ok === false) {
    const problems = (review.problems || []).join('\n- ')
    await agent(
      [
        '报告未通过质检，请修正。报告文件：' + outPath,
        '',
        '质检发现的问题：',
        '- ' + problems,
        '',
        '修正要求：只按质检意见修正格式与字段，保持事实与统计不变（总数 ' + stats.total + '，P0 ' + stats.P0 + '，P1 ' + stats.P1 + '，P2 ' + stats.P2 + '，P3 ' + stats.P3 + '），不得新增或删除问题条目，不得改动 ID 与基准依据条款号。',
        '问题清单数据以本 JSON 为准：',
        JSON.stringify(
          issues.map((it) => ({
            id: it.id,
            priority: it.priority,
            type: it.type,
            module: it.module,
            title: it.title,
            location: it.location,
            ruleRef: it.ruleRef,
            requirementIds: it.requirementIds || [],
          })),
          null,
          1
        ),
        '',
        '完成后返回修改摘要。只操作指定报告文件，不要执行 git 命令、不要提交或推送。',
      ].join('\n'),
      { label: '修正报告', agentType: 'general', ...analysisAgentOptions }
    )
    fixed = true
  }
}

phase('生成Dashboard')

let dashboardResult = null
if (dashboardEnabled) {
  dashboardResult = await agent(
    [
      '你在项目根目录执行 Dashboard 生成命令。只允许执行该命令并读取输出，不要 git 提交、不要修改 report.md 或其他文件。',
      '',
      '执行命令（一次执行完）：',
      'node "' + dashboardScript + '" "' + outPath + '" "' + outDir + '"',
      '',
      '结果判定：',
      '1. 退出码非 0 或输出含 [失败]：ok=false，errors 填错误行（去掉前缀），htmlPath 与 reportJsonPath 留空。',
      '2. 输出含 [成功]：ok=true，从「dashboard   -> 」行取 HTML 路径填入 htmlPath，从「report.json -> 」行取路径填入 reportJsonPath；路径统一转成相对项目根目录的形式（去掉项目根前缀），不要改写文件名。',
      '3. commandOutput 放命令输出的最后 20 行。',
      '4. 不执行 git 命令，不删除历史 Dashboard 产物（同名日期序号由脚本自动递增）。',
    ].join('\n'),
    { label: '生成 Dashboard', schema: DASHBOARD_SCHEMA, agentType: 'general', timeoutMs: 900000 }
  )

  if (!dashboardResult || dashboardResult.ok !== true || !dashboardResult.htmlPath) {
    const reason =
      dashboardResult && Array.isArray(dashboardResult.errors) && dashboardResult.errors.length > 0
        ? dashboardResult.errors.join('；')
        : '未返回成功的 HTML 路径'
    throw new Error(
      'Dashboard 生成失败：' + reason + '。请修复 report.md 后重跑，或传 args.dashboard=false 跳过 Dashboard。'
    )
  }

  await check(() => fileExists(dashboardResult.htmlPath), 'Dashboard 文件不存在：' + dashboardResult.htmlPath)
  log('Dashboard 生成完成：' + dashboardResult.htmlPath)
} else {
  log('已按 args.dashboard=false 跳过 Dashboard 生成')
}

return {
  reportPath: outPath,
  dashboardPath: dashboardResult ? dashboardResult.htmlPath : null,
  reportJsonPath: dashboardResult ? dashboardResult.reportJsonPath : null,
  dashboardSkipped: !dashboardEnabled,
  rulesDir: rulesDir,
  requirements: inputFiles,
  stats: stats,
  typeStats: typeStats,
  moduleRank: moduleRank,
  appendixCount: appendix.length,
  reviewSkipped: skipReview,
  fastMode: fastMode,
  reviewOk: skipReview ? null : review ? review.ok === true || fixed : false,
  reportWriteSummary: writeResult,
}
