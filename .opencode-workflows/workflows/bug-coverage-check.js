// Bug Coverage Check Workflow
//
// 用途：把 bugs/buglist 里的历史缺陷逐条对照目标 PRD，判断 PRD 是否缺失对应需求。
//   1. 确定性扫描（bug-scan-plan.mjs：清单抽取/PRD 大纲/分批/收集输入全部落盘，agent 只转发小摘要，
//      不再经模型 schema 转述全量清单——原扫描 agent 曾对 200+ 条逐条推理分类两轮 15 分钟超时）
//   2. 按模块分组分批并行审核（每条缺陷给出 PASS / PARTIAL / MISSING / NOT_APPLICABLE / INSUFFICIENT）
//      - 非好友房缺陷（金币场、大厅、登录、订阅等）与杭州麻将不存在的玩法环节判 NOT_APPLICABLE（不计入通过，单独统计）
//      - 判定不经模型 schema 返回：批次 agent 直接写分片 verdicts-parts/batch-XX.json，避免大数组转述失真
//   3. 判定收集与批次完整性校验（确定性脚本 bug-verdicts.mjs collect：执行状态与判定分离 + 五项校验；
//      批次失败/分片缺失登记 executionStatus=failed（verdict=null，不冒充判定）；仅 PASS 计入通过，覆盖率分母 = 总数 − 不适用 − 执行失败）
//   4. 缺口去重与定稿（代理归并或确定性去重 + 编号 PRD-001 起，确定性脚本 bug-verdicts.mjs finalize）
//   5. 分片并行撰写 report.md（概览 / 问题清单（含问题性质列）/ 重点详情 / 总体建议 / 附录判定表（含执行状态列））
//   6. 质量档可选报告质检
//   7. 复用 game-prd-check 的 build-dashboard.mjs 生成离线 HTML 报告
//
// 用户选择（生成前问询）：
//   档位：速度优先（默认 fast=true，跳过报告质检；传 args.fast=false 切质量档）
//   模型：分析用 biangfeng-gateway/deepseek-v4.1-flash-official，写作/质检用会话默认模型
//   并发：16（16 批一波跑完）
//
// 可选 args：
//   bugDir        缺陷目录，默认 bugs/buglist
//   prdPath       目标 PRD（非共享快照模式必传且必须存在，确定性校验缺失即失败不静默适配；
//                 共享快照模式下忽略，PRD 路径权威来源为快照 manifest.sourceFiles，全程 ASCII 参数）
//   prdFiles      指定 PRD 路径数组（给定时覆盖 prdPath，仅非共享快照模式使用）
//   requirementsPath + extractionRunId 共享需求快照消费（v4 阶段 5，必项成对传入，只传其一直接报错）：
//                 审核输入改为共享需求清单（REQ ID + 标题 + 原文 + 来源锚点）+ 按需回查 PRD 原文；
//                 快照完整性/runId 一致/源 sha256 校验（check-shared-snapshot.mjs，变更即拒）；
//                 PASS/PARTIAL 证据挂 REQ ID（requirementIds），附录判定表七列（含 REQ 关联列）
//   outDir        产物目录，默认 examples/bug-check-workflow
//   date          检查日期（YYYY-MM-DD）；脚本内禁止取当前时间，需由调用方传入
//   batchSize     每批缺陷数，默认 15
//   maxDetailP2   详情区最多展开的 P2 条数，默认 100
//   analysisModel 分析阶段模型，默认 biangfeng-gateway/deepseek-v4.1-flash-official（传空串用会话默认；扫描固定 bf-flash 不受此参数影响）
//   reviewModel   质检模型，默认同 analysisModel（传空串用会话默认）
//   concurrency   并发上限，默认 16（运行时钳制到 16）
//   fast          默认 true：跳过报告质检
//   skipReview    显式覆盖质检开关（false 强制质检）
//   dashboard     生成 HTML Dashboard，默认 true
//   dashboardScript Dashboard 生成脚本，默认 .claude/skills/game-prd-check/scripts/build-dashboard.mjs
//   autoPassModules 预判为不适用（单独统计）的模块名数组，默认空（完全由审核员判断）

export const meta = {
  id: 'bug-coverage-check',
  name: 'bug_coverage_check',
  description: '对照 buglist 检查 PRD 需求缺失（执行状态与判定分离；不适用/信息不足/执行失败单独统计），输出 report.md 与 HTML 报告',
  phases: [
    { title: '扫描' },
    { title: '缺陷审核' },
    { title: '判定收集与校验' },
    { title: '缺口去重' },
    { title: '缺口定稿' },
    { title: '生成报告' },
    { title: '报告审核' },
    { title: '生成Dashboard' },
  ],
}

const A = args || {}
const bugDir = A.bugDir || 'bugs/buglist'
const prdPath = A.prdPath || 'input/【杭州麻将】核心流程杭州麻将好友房AI.md'
const prdFiles = Array.isArray(A.prdFiles) && A.prdFiles.length > 0 ? A.prdFiles : [prdPath]
const outDir = A.outDir || 'examples/bug-check-workflow'
const outPath = A.outPath || outDir + '/report.md'
const checkDate = A.date || '未提供（调用时请传 args.date，格式 YYYY-MM-DD）'
const batchSize = A.batchSize || 15
const maxDetailP2 = A.maxDetailP2 === undefined ? 100 : A.maxDetailP2
const fastMode = A.fast !== false
const skipReview = A.skipReview === false ? false : A.skipReview === true || fastMode
const autoPassModules = Array.isArray(A.autoPassModules) ? A.autoPassModules : []
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

// 共享需求快照消费（v4 阶段 5）：传 requirementsPath + extractionRunId 成对校验（prdPath 保留为兼容旧路径）；
// 传时审核输入改为共享需求清单（REQ ID + 标题 + 原文 + 来源锚点）+ 按需回查 PRD 原文，判定挂 REQ 关系
const sharedRequirementsPath = A.requirementsPath || null
const sharedExtractionRunId = A.extractionRunId || null
if ((sharedRequirementsPath && !sharedExtractionRunId) || (!sharedRequirementsPath && sharedExtractionRunId)) {
  throw new Error('requirementsPath 与 extractionRunId 必须成对传入（共享需求快照消费，v4 契约；只传其一直接报错）')
}
if (sharedRequirementsPath) {
  // 沙箱无 readFile：快照完整性/runId 一致/源 sha256 校验下沉到 node 脚本（布尔回传，失败原因在 stderr 日志）
  const ok = commandSuccess('node .opencode-workflows/scripts/check-shared-snapshot.mjs "' + sharedRequirementsPath + '" "' + sharedExtractionRunId + '" --verify-source')
  if (!ok) {
    throw new Error('共享快照校验失败：' + sharedRequirementsPath + '（extractionRunId ' + sharedExtractionRunId + '；原因见上方命令日志，不猜测、不回退旧路径静默运行）')
  }
  // 需求清单瘦身：只含 requirementId/reqKey/title 的索引写到 outDir（快照目录保持只读），判定 agent 读索引定位 + 按需回查原文
  const idxOk = commandSuccess('node .opencode-workflows/scripts/gen-req-index.mjs "' + sharedRequirementsPath + '" --out "' + outDir + '/requirements-index.json"')
  if (!idxOk) {
    throw new Error('需求索引生成失败：' + sharedRequirementsPath + '（快照 requirements.json 字段不完整）')
  }
  log('消费共享需求快照：' + sharedRequirementsPath + '（extractionRunId ' + sharedExtractionRunId + '），判定用瘦身索引 + 按需回查 PRD，判定挂 REQ 关系')
}

const VERDICT_RULE = [
  '五类判定（每条缺陷必须选一个）：',
  'PASS：属于好友房范围，且 PRD 已有明确需求覆盖该场景（必须给出 PRD 章节标题与原文片段）。',
  'PARTIAL：属于好友房范围，PRD 提到该环节但缺少关键内容（分支、超时、异常、UI 细则、数值、来源标识等），需列出缺什么。',
  'MISSING：属于好友房范围，PRD 完全没有该场景的需求描述。',
  'NOT_APPLICABLE：非好友房范围（金币场、大厅、登录、订阅、小程序/浮窗、音效、平台适配等），或属于卡五星等其它玩法专有而杭州麻将不存在该环节（注明玩法差异）；不计入通过，单独统计。',
  'INSUFFICIENT：证据不足（如缺陷只有截图、标题与描述不足以判断）；不计入通过，待复核；禁止凭图片臆测。',
  '',
  '优先级（只对 MISSING / PARTIAL 有意义，其余填“不适用”）：',
  'P0：影响开局、行牌、吃碰杠胡、结算主流程，不补无法开发。',
  'P1：影响正确性、资损、断线重连、解散与再来一局等关键分支。',
  'P2：局内 UI、提示、动效、牌面展示等缺失，不影响主流程正确性。',
  'P3：体验优化建议。',
].join('\n')

const BUG_VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    bugId: { type: 'string', description: '缺陷编号（文件名前缀数字），如 7141390397' },
    title: { type: 'string', description: '缺陷标题，去掉文件名前缀' },
    module: { type: 'string', description: '缺陷所属模块，如 创房规则 / 小结算详情 / 亮牌' },
    scope: {
      type: 'string',
      enum: ['好友房', '非好友房', '玩法不适用', '无法判断'],
      description: '是否属于本次 PRD 覆盖的好友房范围',
    },
    verdict: {
      type: 'string',
      enum: ['PASS', 'PARTIAL', 'MISSING', 'NOT_APPLICABLE', 'INSUFFICIENT'],
    },
    prdRef: { type: 'string', description: 'PRD 章节标题定位，多处用、分隔；非缺口填“无”（共享快照模式下可填 REQ ID 定位）' },
    requirementIds: { type: 'array', items: { type: 'string' }, description: '命中的共享快照需求点 ID 列表（REQ-xxx；PASS/PARTIAL 必须给出命中需求点；未传共享快照或无法定位填空数组）' },
    prdQuote: { type: 'string', description: 'PRD 原文片段，不超过 60 字；非缺口填“无”' },
    reason: { type: 'string', description: '一句话判定依据（为什么覆盖 / 为什么是缺口 / 为什么不适用）' },
    gapTitle: { type: 'string', description: '需求缺口标题（≤40 字，需求视角，不是缺陷视角）；非缺口填“无”' },
    gap: { type: 'string', description: '缺失或不足的具体内容；非缺口填“无”' },
    impact: { type: 'string', description: '不补齐会导致的后果；非缺口填“无”' },
    suggestion: { type: 'string', description: '可直接补进 PRD 的需求写法（触发条件、处理方式、UI 表现、异常兜底）；非缺口填“无”' },
    priority: { type: 'string', description: 'P0/P1/P2/P3；非缺口填“不适用”' },
    acceptance: { type: 'string', description: '补齐后的验收口径；非缺口填“无”' },
  },
  required: [
    'bugId',
    'title',
    'module',
    'scope',
    'verdict',
    'prdRef',
    'requirementIds',
    'prdQuote',
    'reason',
    'gapTitle',
    'gap',
    'impact',
    'suggestion',
    'priority',
    'acceptance',
  ],
}

// 批次确认返回（判定数据不经 schema 返回，由批次 agent 直接写分片文件，避免大数组经模型转述失真）
const BATCH_CONFIRM_SCHEMA = {
  type: 'object',
  properties: {
    ok: { type: 'boolean', description: '分片文件是否写入成功' },
    bugCount: { type: 'number', description: '写入的判定条数' },
    message: { type: 'string', description: '失败原因（成功时留空）' },
  },
  required: ['ok'],
}

// 扫描摘要转发（清单/批次/大纲已由确定性脚本 bug-scan-plan.mjs 落盘，agent 只转发小摘要，不转述全量清单）
const SCAN_SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    ok: { type: 'boolean', description: 'scan-summary.json 是否读取并转发成功' },
    bugCount: { type: 'number', description: '待审核缺陷总数（autoPass 已剔除）' },
    prePassCount: { type: 'number', description: '预判不适用缺陷数' },
    batchCount: { type: 'number', description: '审核批次数' },
    batches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'number', description: '批次下标（与 batches.json 下标对齐）' },
          title: { type: 'string', description: '批次主题（模块名或合并模块名）' },
          count: { type: 'number', description: '本批缺陷数' },
        },
        required: ['index', 'title', 'count'],
      },
    },
    prdFiles: { type: 'array', items: { type: 'string' }, description: '实际 PRD 路径（共享快照模式来自快照 manifest.sourceFiles）' },
    message: { type: 'string', description: '失败原因（成功时留空）' },
  },
  required: ['ok', 'bugCount', 'batchCount', 'batches'],
}

const DEDUP_SCHEMA = {
  type: 'object',
  properties: {
    duplicateGroups: { type: 'array', items: { type: 'array', items: { type: 'number' } } },
    notes: { type: 'string' },
  },
  required: ['duplicateGroups'],
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
    htmlPath: { type: 'string' },
    reportJsonPath: { type: 'string' },
    errors: { type: 'array', items: { type: 'string' } },
    commandOutput: { type: 'string' },
  },
  required: ['ok'],
}

function verdictRules() {
  return [
    VERDICT_RULE,
    '',
    '硬性要求：',
    '1. 证据先行：PASS 与 PARTIAL 必须引用 PRD 章节标题与原文片段，禁止凭印象判定。' + (sharedRequirementsPath ? '共享快照模式下：证据改为命中需求点的 REQ ID（requirementIds 必填）+ 需求原文引文，无法定位写空数组。' : ''),
    '2. MISSING 必须写明已检索的 PRD 章节范围，确认没有等价或相反描述才能判缺失。',
    '3. 同类合并：同一批内多条缺陷指向同一需求缺口时，每条仍输出自己的判定，但 gapTitle / gap / suggestion 写成同一条，便于后续合并统计。',
    '4. 不臆测：缺陷图片在当前环境无法读取，禁止根据图片文件名或猜测补充信息；标题与描述都没有的信息不得编造。',
    '5. NOT_APPLICABLE 要克制：只有明显属于其它模块或其它玩法专有环节时才判；拿不准时按好友房处理，并在 reason 写明不确定点。',
    '6. suggestion 要可直接落地：写清触发条件、处理方式、UI 表现与异常兜底，不要说“补充一下”这类空话。',
    '7. 只输出结构化结果，不要输出报告正文。',
  ].join('\n')
}

phase('扫描')

// 确定性扫描（bug-scan-plan.mjs）：清单抽取（bug-catalog 同语义）/ PRD 大纲 / 分批 / 收集输入全部落盘，
// 模型不再转述全量清单（原扫描 agent 曾对 200+ 条逐条推理分类，两轮 15 分钟超时）
// PRD 路径来源：共享快照模式用快照 manifest.sourceFiles（权威，全程 ASCII 参数规避编码风险）；否则显式 prdFiles（缺失即失败不静默适配）
const scanPlanCmd =
  'node .opencode-workflows/scripts/bug-scan-plan.mjs "' + bugDir + '" "' + outDir + '" '
  + (sharedRequirementsPath
    ? '--prd-from-snapshot "' + sharedRequirementsPath + '"'
    : '--prd "' + prdFiles.join(',') + '"')
  + ' --batch-size ' + batchSize
  + autoPassModules.map((m) => ' --auto-pass-module "' + m + '"').join('')
if (!commandSuccess(scanPlanCmd)) {
  throw new Error('扫描计划生成失败：' + scanPlanCmd + '（原因见上方命令日志：缺陷目录/PRD 路径不存在或 bugId 重复即失败，不静默回退）')
}

const scan = await agent(
  [
    '你是扫描摘要转发员，工作目录为项目根目录。只读取一个 JSON 文件并原样转发摘要字段，不做判断、不改写、不合并。',
    '',
    '步骤：',
    '1. 读取 ' + outDir + '/scan-summary.json（UTF-8 JSON）；',
    '2. 按 schema 返回其中字段：ok / bugCount / prePassCount / batchCount / batches（数组逐条原样转发，一条不漏，顺序不变）/ prdFiles / message；',
    '3. 文件读取或解析失败时 ok=false 并在 message 写明原因；不要改动任何文件，不要执行 git 命令。',
  ].join('\n'),
  { label: '转发扫描摘要', schema: SCAN_SUMMARY_SCHEMA, retries: 2, timeoutMs: 600000 }
)

if (!scan || scan.ok !== true || !Array.isArray(scan.batches) || scan.batches.length === 0) {
  throw new Error('扫描阶段失败：未取得批次摘要（' + ((scan && scan.message) || '转发代理未成功') + '），请检查 ' + outDir + '/scan-summary.json 与上方命令日志')
}

const batches = scan.batches
const prdBrief = (Array.isArray(scan.prdFiles) && scan.prdFiles.length > 0 ? scan.prdFiles : prdFiles)
  .map((f) => '- ' + f)
  .join('\n')
log(
  '扫描完成：缺陷 ' + scan.bugCount + ' 条（预判不适用 ' + (scan.prePassCount || 0) + ' 条），分 ' + batches.length
  + ' 批审核；清单/批次/大纲/收集输入已落盘 ' + outDir + '（batches.json / prd-outline.txt / bug-verdicts-input.json）'
)

phase('缺陷审核')

// 判定分片目录：批次 agent 直接写盘（判定数据不经模型 schema 返回，避免大数组转述失真）
const verdictsPartsDir = outDir + '/verdicts-parts'

const batchTasks = parallel(
  batches.map((batch, batchIndex) => () => {
    const shardPath = verdictsPartsDir + '/batch-' + String(batchIndex + 1).padStart(2, '0') + '.json'
    return agent(
      [
        '你是资深游戏 QA 与 PRD 审核员，正在核对缺陷清单里的问题在目标 PRD 中是否有对应需求。',
        '',
        sharedRequirementsPath
          ? [
              '需求判定依据（共享需求索引，REQ ID + reqKey + 标题三字段；定位用，不整读全量）：',
              '- ' + outDir + '/requirements-index.json',
              '',
              '目标 PRD（索引不够定位时按需回查原文：source 锚点直达，或按 requirementId 在 ' + sharedRequirementsPath + '/requirements.json grep 回查）：',
              prdBrief,
            ].join('\n')
          : [
              '目标 PRD（务必完整读完，长行被截断时分段读取，不要只读开头）：',
              prdBrief,
            ].join('\n'),
        '',
        'PRD 章节大纲（便于定位与引用，读文件）：' + outDir + '/prd-outline.txt（读不到大纲再自行 grep PRD 章节标题）',
        '',
        '本批缺陷清单（先读批次定义再逐条读取缺陷 Markdown 文件；只读文字，不要尝试读图片）：',
        '  读 ' + outDir + '/batches.json，取 batches[' + batchIndex + ']（第 ' + (batchIndex + 1) + ' 批「' + batch.title + '」，'
        + (typeof batch.count === 'number' ? batch.count : '?') + ' 条）；其 files 数组每项含 bugId / path / title / module，按 path 逐条读取，一条不漏',
        '  若该下标的 title 或条数与上句不符（转发失真），不要写分片，直接按 schema 返回 ok=false 并在 message 写明差异',
        '',
        '本批模块主题：' + batch.title,
        '',
        '判定要求：',
        '- 先判断缺陷是否属于好友房范围：好友房创房/进房/准备/托管/行牌/吃碰杠胡/亮牌/买马/漂分/查叫/结算/再来一局/局内 UI/断线重连/好友房内回放。',
        '- 非好友房（金币场、大厅、登录、订阅、小程序浮窗、音效、平台适配）判 NOT_APPLICABLE。',
        '- 属于卡五星等其它玩法专有、杭州麻将不存在该环节的，判 NOT_APPLICABLE 并写明玩法差异。',
        '- 再在 PRD 中查找是否有覆盖该场景的需求；有就 PASS 并给出章节与原文，只有部分就 PARTIAL。',
        '',
        verdictRules(),
        '',
        '输出要求：',
        '1. 把本批全部判定写入 ' + shardPath + '（UTF-8 无 BOM，用 node -e 或 write 工具），内容为 {"bugs":[本批每条缺陷的判定对象]}，一条不漏，不要合并或省略；每条判定字段结构：',
        JSON.stringify(BUG_VERDICT_SCHEMA, null, 1),
        '2. 文件写完后按 schema 返回 ok=true 与写入条数；写文件失败时 ok=false 并在 message 写明原因；',
        '3. 只操作该输出文件，不要改动其他文件，不要执行 git 命令。',
      ].join('\n'),
      { label: '审核 ' + batch.title, schema: BATCH_CONFIRM_SCHEMA, ...analysisAgentOptions, retries: 1 }
    )
  })
)

const batchResults = await batchTasks
const shardOkCount = (batchResults || []).filter((r) => r && r.ok === true).length
log('批次审核分片写入完成 ' + shardOkCount + '/' + batches.length + '（分片缺失或损坏按批次失败登记，不冒充判定）')

// ---------- 判定收集与批次完整性校验（确定性脚本 bug-verdicts.mjs：执行状态与判定分离 + 五项校验） ----------
phase('判定收集与校验')

const verdictsScript = '.opencode-workflows/scripts/bug-verdicts.mjs'
const collectInputFile = outDir + '/bug-verdicts-input.json' // 扫描计划已确定性生成（allBugs/batches/prePassBugs/verdictsPartsDir）

const collectResult = await agent(
  [
    '你在项目根目录执行判定收集与批次完整性校验，然后按 schema 返回结果。',
    '',
    '步骤：',
    '1. 执行命令：node ' + verdictsScript + ' collect "' + collectInputFile + '" "' + outDir + '"（输入文件已预生成，不要改动）',
    '2. 命令输出含 [成功] 时：从 SUMMARY 行解析 stats（total/completed/failed/failedBatches/missingVerdict/distribution/applicable/passRate）、warningsCount、gapsRawCount 填入返回字段；',
    '3. 命令输出含 [失败] 时：ok 填 false，message 填错误内容；',
    '4. 不要修改脚本与数据文件，不要删除产物文件。',
  ].join('\n'),
  {
    label: '判定收集与批次校验',
    agentType: 'general',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        message: { type: 'string', description: '失败原因或结果说明' },
        stats: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            completed: { type: 'number' },
            failed: { type: 'number' },
            failedBatches: { type: 'number' },
            missingVerdict: { type: 'number' },
            distribution: {
              type: 'object',
              properties: {
                PASS: { type: 'number' },
                PARTIAL: { type: 'number' },
                MISSING: { type: 'number' },
                NOT_APPLICABLE: { type: 'number' },
                INSUFFICIENT: { type: 'number' },
              },
            },
            applicable: { type: 'number' },
            passRate: { type: 'number', description: '无适用时为 null' },
          },
        },
        warningsCount: { type: 'number' },
        gapsRawCount: { type: 'number' },
      },
      required: ['ok', 'message', 'stats'],
    },
    timeoutMs: 900000,
  }
)

if (!collectResult || collectResult.ok !== true || !collectResult.stats) {
  throw new Error('判定收集与批次校验失败：' + (collectResult && collectResult.message))
}
const stats = collectResult.stats
const gapsRawFile = outDir + '/gaps-raw.json'
await check(() => fileExists(outDir + '/bug-verdicts.json'), 'bug-verdicts.json 未生成')
await check(() => fileExists(outDir + '/appendix-rows.json'), 'appendix-rows.json 未生成')
await check(() => fileExists(gapsRawFile), 'gaps-raw.json 未生成')

log(
  '判定收集完成：' + stats.total + ' 条（执行完成 ' + stats.completed + ' / 执行失败 ' + stats.failed
    + '，批次失败 ' + stats.failedBatches + '，缺失补齐 ' + stats.missingVerdict + '，告警 ' + (collectResult.warningsCount || 0) + ' 条）；分布 已覆盖 '
    + stats.distribution.PASS + ' / 部分覆盖 ' + stats.distribution.PARTIAL + ' / 未覆盖 ' + stats.distribution.MISSING
    + ' / 不适用 ' + stats.distribution.NOT_APPLICABLE + ' / 信息不足 ' + stats.distribution.INSUFFICIENT
)

phase('缺口去重')

// 同一需求缺口可能被多条缺陷命中：数量多时用归并代理（读盘上 gaps-raw.json），数量少时走脚本内确定性去重
const gapsRawCount = collectResult.gapsRawCount || 0
let duplicateGroupsFile = 'none'
if (gapsRawCount > 12) {
  const dupFile = outDir + '/duplicate-groups.json'
  const dedup = await agent(
    [
      '你是需求缺口合并员。缺口原始清单在 ' + gapsRawFile + '（字段 gaps 数组，含 module / prdRef / gapTitle，数组下标即 i）。',
      '',
      '步骤：',
      '1. 用 node -e 读取 ' + gapsRawFile + '，输出每条的 i / module / prdRef / gapTitle 索引；',
      '2. 找出指向同一需求缺口的重复条目（标题不同但要求补的是同一处内容也算重复）；不要把不同缺口合并；',
      '3. 把结果写入 ' + dupFile + '（UTF-8 无 BOM，用 node -e 或 write 工具），格式 {"duplicateGroups": [[0,2],[5,7,9]]}，每个子数组是同一条缺口的下标、第一个为保留项；没有重复就写 {"duplicateGroups": []}；',
      '4. 按 schema 返回 duplicateGroups（与文件内容一致）；不要改动其他文件。',
    ].join('\n'),
    { label: '缺口归并', schema: DEDUP_SCHEMA, ...analysisAgentOptions, timeoutMs: 1800000 }
  )
  if (dedup && Array.isArray(dedup.duplicateGroups) && fileExists(dupFile)) {
    duplicateGroupsFile = dupFile
  } else {
    log('[警告] 缺口归并代理未成功落盘，回退确定性去重')
  }
}

// ---------- 缺口定稿（确定性脚本：归并、编号 PRD-001 起、统计与投影） ----------
phase('缺口定稿')

const finalizeResult = await agent(
  [
    '你在项目根目录执行缺口定稿命令，然后按 schema 返回结果。',
    '',
    '执行命令：node ' + verdictsScript + ' finalize "' + gapsRawFile + '" "' + duplicateGroupsFile + '" "' + outDir + '" --max-detail-p2 ' + maxDetailP2,
    '',
    '结果判定：',
    '1. 命令输出含 [成功] 时：从 SUMMARY 行解析 gapTotal、priorityStats、moduleRank、detailCount 填入返回字段；',
    '2. 命令输出含 [失败] 时：ok 填 false，message 填错误内容；',
    '3. 不要修改脚本与数据文件。',
  ].join('\n'),
  {
    label: '缺口定稿',
    agentType: 'general',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        message: { type: 'string', description: '失败原因或结果说明' },
        gapTotal: { type: 'number' },
        detailCount: { type: 'number' },
        priorityStats: {
          type: 'object',
          properties: {
            P0: { type: 'number' },
            P1: { type: 'number' },
            P2: { type: 'number' },
            P3: { type: 'number' },
          },
        },
        moduleRank: {
          type: 'array',
          items: {
            type: 'object',
            properties: { name: { type: 'string' }, count: { type: 'number' } },
          },
        },
      },
      required: ['ok', 'message', 'gapTotal', 'priorityStats'],
    },
    timeoutMs: 900000,
  }
)

if (!finalizeResult || finalizeResult.ok !== true) {
  throw new Error('缺口定稿失败：' + (finalizeResult && finalizeResult.message))
}
const gapTotal = finalizeResult.gapTotal
const priorityStats = finalizeResult.priorityStats
const moduleRank = finalizeResult.moduleRank || []
const detailCount = finalizeResult.detailCount || 0
await check(() => fileExists(outDir + '/gaps.json'), 'gaps.json 未生成')
await check(() => fileExists(outDir + '/table-rows.json'), 'table-rows.json 未生成')
await check(() => fileExists(outDir + '/detail-issues.json'), 'detail-issues.json 未生成')

log(
  '缺口定稿完成：' + gapTotal + ' 条（P0 ' + priorityStats.P0 + ' / P1 ' + priorityStats.P1
    + ' / P2 ' + priorityStats.P2 + ' / P3 ' + priorityStats.P3 + '），详情展开 ' + detailCount + ' 条；判定分布 已覆盖 '
    + stats.distribution.PASS + ' / 部分覆盖 ' + stats.distribution.PARTIAL
    + ' / 未覆盖 ' + stats.distribution.MISSING + ' / 不适用 ' + stats.distribution.NOT_APPLICABLE
    + ' / 信息不足 ' + stats.distribution.INSUFFICIENT
)

phase('生成报告')

// 报告数据文件（bug-verdicts.mjs 已落盘，报告分片 agent 直接读盘，判定数据不再经 prompt 转述）：
//   table-rows.json（七列清单）/ detail-issues.json（详情展开）/ appendix-rows.json（附录判定表）/ gaps.json（缺口索引）
const scopeText =
  '仅好友房相关缺陷；非好友房与杭州麻将不存在的玩法环节判不适用（单独统计，不计入问题清单与覆盖率分母）；执行失败的缺陷单独列出，不计入判定分布'

const overviewData = {
  缺陷总数: stats.total,
  执行状态: { 执行完成: stats.completed, 执行失败: stats.failed },
  判定分布: {
    PRD已覆盖: stats.distribution.PASS,
    PRD部分覆盖: stats.distribution.PARTIAL,
    PRD未覆盖: stats.distribution.MISSING,
    不适用: stats.distribution.NOT_APPLICABLE,
    信息不足: stats.distribution.INSUFFICIENT,
  },
  覆盖率口径: {
    适用且执行完成: stats.applicable,
    覆盖率:
      stats.passRate === null || stats.passRate === undefined
        ? '无（无适用且执行完成的缺陷）'
        : (stats.passRate * 100).toFixed(1) + '%（分母 = 总数 − 不适用 − 执行失败）',
  },
  发现缺口总数: gapTotal,
  优先级分布: priorityStats,
  模块分布: moduleRank,
}

const part1Path = outPath + '.part1.md'
const part2Path = outPath + '.part2.md'
const part3Path = outPath + '.part3.md'

const shardResults = await parallel([
  () =>
    agent(
      [
        '你是 PRD 缺陷复核报告撰写员，只写报告前半部分（头部 + 第 1、2 段）。',
        '',
        '本分片输出路径：' + part1Path,
        '',
        '报告头部信息（写在文件最开头，逐行照抄这些标签）：',
        '# PRD 缺陷覆盖复核报告',
        '检查对象：' + prdFiles.join('、'),
        '检查范围：' + scopeText,
        '缺陷来源：' + bugDir + '（共 ' + stats.total + ' 条）',
        '检查日期：' + checkDate,
        '',
        '统计（必须原样使用，不得自行改数）：',
        JSON.stringify(overviewData, null, 1),
        '',
        '问题清单表格数据在 ' + outDir + '/table-rows.json（字段 tableRows；先用 node -e 读取；全部缺口，id 已编号，不得增删或改写 id；问题性质取 kind 字段）：',
        '',
        '写作要求：',
        '1. 文件依次为：标题与头部信息、## 1. 检查概览、## 2. 问题清单（PRD 缺失需求点）。',
        '2. 第 1 段先写主统计表，表头必须是 | 指标 | 数量 |，并严格包含这些固定行（数字与统计一致）：发现问题总数（取发现缺口总数）、严重问题 P0、高优先级 P1、一般问题 P2、优化建议 P3。',
        '3. 主统计表之后补一节“缺陷判定与执行状态分布”，按 执行状态（执行完成、执行失败）与判定（PRD 已覆盖、PRD 部分覆盖、PRD 未覆盖、不适用、信息不足）分行列出数量（数字取统计 JSON），再列一行 覆盖率 与 适用且执行完成 数。',
        '4. 再补一节“模块分布”表格：| 模块 | 缺口数 |。',
        '5. 第 2 段标题固定为 ## 2. 问题清单（PRD 缺失需求点），表头固定为 | ID | 主题 | 问题性质 | 优先级 | 问题 | 原文位置 | 建议 |（七列，问题性质取 kind），列出全部缺口，一条不漏，顺序与数据一致；建议列取 suggestion 的精简版（不超过 60 字）。',
        '6. 不要写第 3、4 段，不要写附录与结尾总结。',
        '7. 使用 write 工具写入 ' + part1Path + '，UTF-8 中文，不使用 Emoji。',
        '只操作指定的输出文件，不要执行 git 命令、不要提交或推送、不要改动其他文件。',
      ].join('\n'),
      { label: '写报告-概览与清单', agentType: 'general', timeoutMs: 3600000 }
    ),
  () =>
    agent(
      [
        '你是 PRD 缺陷复核报告撰写员，只写第 3 段重点问题详情。',
        '',
        '本分片输出路径：' + part2Path,
        '',
        '缺口详情数据在 ' + outDir + '/detail-issues.json（字段 detailIssues；先用 node -e 读取；只展开这些条目，按文件内给定顺序）：',
        '',
        '写作要求：',
        '1. 文件第一行必须是 ## 3. 重点问题详情，并在下一行注明展开范围（全部 P0/P1 + 最多 ' + maxDetailP2 + ' 条典型 P2）。',
        '2. 每条固定格式：',
        '   ### PRD-001：{标题}',
        '   - 优先级：{priority}',
        '   - 主题：{topic}',
        '   - 问题性质：{kindLabel}',
        '',
        '   **原文**（{location}）：',
        '   > {quote；若 quote 为空，写“PRD 中无对应描述”并附 gap 的一句话摘要}',
        '',
        '   **问题**：{gap}',
        '',
        '   **影响**：{impact}',
        '',
        '   **建议**：{suggestion}',
        '',
        '   **验收口径**：{acceptance}',
        '',
        '   **关联缺陷**：{bugIds 与 bugTitles，逐条列成“缺陷号 标题”}',
        '',
        '   **处理状态**：待确认',
        '3. 不得新增、合并或删除条目；id 必须与数据完全一致；字段内容只能来自给定数据，不得编造 PRD 原文。',
        '4. impact 为空时写“不补齐会导致同类缺陷复现，测试无法据此出用例”，不得编造具体损失。',
        '5. 不要写报告标题、头部信息、第 1、2、4 段与附录。',
        '6. 使用 write 工具写入 ' + part2Path + '，UTF-8 中文，不使用 Emoji。',
        '只操作指定的输出文件，不要执行 git 命令、不要提交或推送、不要改动其他文件。',
      ].join('\n'),
      { label: '写报告-重点详情', agentType: 'general', timeoutMs: 3600000 }
    ),
  () =>
    agent(
      [
        '你是 PRD 缺陷复核报告撰写员，只写第 4 段总体建议与附录判定表。',
        '',
        '本分片输出路径：' + part3Path,
        '',
        '统计与结论依据：',
        JSON.stringify(overviewData, null, 1),
        '',
        '缺口索引在 ' + outDir + '/gaps.json（字段 issueRows，取 id / topic / priority / title，用于总体建议引用；先用 node -e 读取）。',
        '',
        '全部缺陷判定表数据在 ' + outDir + '/appendix-rows.json（字段 appendixRows，' + stats.total + ' 条，按缺陷号升序，必须全部列出；先用 node -e 读取）。',
        '',
        '写作要求：',
        '1. 文件第一行必须是 ## 4. 总体建议。',
        '2. 用三个要点书写，格式为“- **要点名**：内容”：',
        '   - **缺口最集中的模块**：模块分布第一名，写模块名与条数，并列出对应 PRD ID。',
        '   - **可能影响开发的问题**：从 P0/P1 中挑影响最大的若干条，附 ID 与理由；如涉及结算/计分/资产，注明可能导致资损或结算错误。',
        '   - **是否建议进入下一阶段规格生成**：存在 P0 或 P1 数量较多时写“暂缓”，否则写“建议”，并给出理由。',
        '3. 然后写附录：## 附录：全部缺陷判定表，表头固定为 | 缺陷ID | 模块 | 执行状态 | 判定 | ' + (sharedRequirementsPath ? 'REQ 关联 | ' : '') + 'PRD 位置 | 判定依据 |（' + (sharedRequirementsPath ? '七列，REQ 关联取 requirementIds 用、号连接、空数组写 无' : '六列') + '；执行状态取 executionStatus，completed 写 执行完成、failed 写 执行失败；verdict 为 null 的行判定写 执行失败（未判定）），把给定数据一条不漏地列成表格行，判定依据取 reason 原文，顺序与数据一致。',
        '4. 附录表格行不得改写为列表项，必须是表格行，且不要出现“（PRD-xxx）：N 条”这类写法。',
        '5. 只能使用给定数据中的事实，不得编造新的缺口或统计数字。',
        '6. 使用 write 工具写入 ' + part3Path + '，UTF-8 中文，不使用 Emoji。',
        '只操作指定的输出文件，不要执行 git 命令、不要提交或推送、不要改动其他文件。',
      ].join('\n'),
      { label: '写报告-建议与附录', agentType: 'general', timeoutMs: 3600000 }
    ),
])

const shardOk = (shardResults || []).filter((r) => typeof r === 'string' && r.length > 0).length
log('报告分片完成 ' + shardOk + '/3')

// 合并报告分片（确定性命令 merge-parts.mjs，替代合并 agent：无 LLM 转述命令、无 BOM 风险）
// 续跑（resume）时三个分片可能已被上一次运行删除：目标文件已存在且分片全无 → 保留现有产物
const mergeScript = '.opencode-workflows/scripts/merge-parts.mjs'
let mergeSummary = '已在上次运行合并（保留现有产物）'
if (fileExists(outPath) && !fileExists(part1Path) && !fileExists(part2Path) && !fileExists(part3Path)) {
  log('报告分片已在上次运行合并，保留现有 ' + outPath)
} else {
  const merged = await commandSuccess(
    'node "' + mergeScript + '" "' + outPath + '" "' + part1Path + '" "' + part2Path + '" "' + part3Path + '"'
  )
  if (!merged) throw new Error('报告分片合并失败（分片缺失或损坏，上次运行可能中断），请重跑 workflow')
  mergeSummary = '已合并（确定性命令）'
}

// 乱码检查（确定性命令；发现乱码才请 agent 修复，只改乱码处不重写报告）
const fffdClean = await commandSuccess(
  'node -e "process.exit(require(\'fs\').readFileSync(process.argv[1],\'utf8\').includes(\'\\uFFFD\')?1:0)" "' + outPath + '"'
)
if (!fffdClean) {
  log('[警告] 报告含乱码替换字符 U+FFFD，请修复 agent 处理')
  await agent(
    [
      '报告文件 ' + outPath + ' 中含乱码替换字符 U+FFFD（显示为“�”）。',
      '请逐处读取上下文，用 edit 工具只把这几处字符修正为原文正确汉字（常见为“好友房”“亮牌”“结算”等），不要重写整篇报告；',
      '修正后再次确认文件内 U+FFFD 数量为 0，返回修复的乱码处数。',
      '只操作指定的输出文件，不要执行 git 命令、不要提交或推送、不要改动其他文件。',
    ].join('\n'),
    { label: '修复乱码', agentType: 'general', timeoutMs: 900000 }
  )
  mergeSummary = mergeSummary + '，修复乱码字符'
}

await check(() => fileExists(outPath), '报告文件未生成：' + outPath)

phase('报告审核')

let review = null
let fixed = false

if (skipReview) {
  log(fastMode ? '速度档默认跳过报告审核（可用 args.skipReview=false 保留）' : '已按 args.skipReview 跳过报告审核')
} else {
  review = await agent(
    [
      '你是报告质检员。审核 PRD 缺陷覆盖复核报告是否完整、数字自洽、无编造。',
      '',
      '报告文件：' + outPath,
      '期望缺口总数：' + gapTotal + '（P0 ' + priorityStats.P0 + ' / P1 ' + priorityStats.P1 + ' / P2 ' + priorityStats.P2 + ' / P3 ' + priorityStats.P3 + '）',
      '期望缺陷总数：' + stats.total + '（执行完成 ' + stats.completed + ' / 执行失败 ' + stats.failed + '）',
      '期望判定分布：已覆盖 ' + stats.distribution.PASS + '、部分覆盖 ' + stats.distribution.PARTIAL + '、未覆盖 ' + stats.distribution.MISSING
        + '、不适用 ' + stats.distribution.NOT_APPLICABLE + '、信息不足 ' + stats.distribution.INSUFFICIENT,
      '期望详情条数：' + detailCount,
      '',
      '逐项检查并输出问题列表：',
      '1. 是否有固定四段结构（1 检查概览、2 问题清单、3 重点问题详情、4 总体建议）与附录判定表；',
      '2. 头部是否填好检查对象、检查范围、缺陷来源、检查日期，不能留占位符；',
      '3. 概览统计中 P0/P1/P2/P3 与缺口总数是否与期望一致，判定分布是否与期望一致；',
      '4. 问题清单行数是否等于缺口总数，ID 是否从 PRD-001 连续编号无跳号；表头是否为固定 7 列（含问题性质列）；',
      '5. 详情块 ID 是否都在清单内，每条是否有原文位置、问题、影响、建议、验收口径，是否出现数据里没有的缺口；',
      '6. 附录判定表行数是否等于缺陷总数，表头是否为固定 ' + (sharedRequirementsPath ? '七列（含 REQ 关联列）' : '六列') + '，执行状态列是否只用 执行完成/执行失败，判定是否只用“PRD 已覆盖/PRD 部分覆盖/PRD 未覆盖/不适用（单独统计）/信息不足（待复核）/执行失败（未判定）”六种；',
      '7. 是否存在明显编造（引文与清单对不上、凭空新增缺口）。',
      '',
      '全部通过返回 ok=true、problems 为空数组；有问题则 ok=false 并逐条写清位置与修改要求。',
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
        '修正要求：只按质检意见修改报告，事实与统计不变（缺口 ' + gapTotal + ' 条，P0 ' + priorityStats.P0
          + '，P1 ' + priorityStats.P1 + '，P2 ' + priorityStats.P2 + '，P3 ' + priorityStats.P3
          + '；缺陷总数 ' + stats.total + '），不得新增或删除条目。',
        '问题清单数据以 ' + outDir + '/table-rows.json 为准（先用 node -e 读取）：',
        '',
        '修改完成后返回修改摘要。',
        '只操作指定的报告文件，不要执行 git 命令、不要提交或推送、不要改动其他文件。',
      ].join('\n'),
      { label: '修正报告', agentType: 'general', timeoutMs: 1800000 }
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
      '2. 输出含 [成功]：ok=true，从「dashboard   -> 」行取 HTML 路径填入 htmlPath，从「report.json -> 」行取路径填入 reportJsonPath；路径统一转成相对项目根目录的形式。',
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
  verdictsFile: outDir + '/bug-verdicts.json',
  bugTotal: stats.total,
  executionStats: {
    completed: stats.completed,
    failed: stats.failed,
    failedBatches: stats.failedBatches,
    missingVerdict: stats.missingVerdict,
  },
  verdictStats: stats.distribution,
  applicable: stats.applicable,
  passRate: stats.passRate,
  warningsCount: collectResult.warningsCount || 0,
  gapTotal: gapTotal,
  priorityStats: priorityStats,
  moduleRank: moduleRank,
  batchCount: batches.length,
  fastMode: fastMode,
  reviewSkipped: skipReview,
  reviewOk: skipReview ? null : review ? review.ok === true || fixed : false,
  mergeSummary: mergeSummary,
}
