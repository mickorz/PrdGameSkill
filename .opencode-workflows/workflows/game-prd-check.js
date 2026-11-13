// Game PRD Check Workflow（由 .claude/skills/game-prd-check/SKILL.md 转写）
//
// 流程：
//   扫描 input 与 rules
//     -> 按规则主题分组并行检查（每组一个只读子代理）
//     -> 全文一致性检查（内部矛盾 / 模糊 / 不完整）
//     -> 汇总去重 + 确定性编号与统计
//     -> 生成 report.md（general 子代理写文件）
//     -> 报告审核（不合格则自动修正）
//
// 可选 args：
//   inputDir      需求文档目录，默认 input
//   inputFiles    指定需求文档路径数组（给定时跳过 inputDir 扫描结果）
//   rulesDir      规则基准目录，默认 .claude/skills/game-prd-check/references/rules
//   templatePath  报告模板，默认 .claude/skills/game-prd-check/references/templates/report.template.md
//   outPath       报告输出路径，默认 examples/game-prd-check-workflow/report.md（与 skill 产物隔离）
//   date          检查日期（YYYY-MM-DD）；脚本内禁止取当前时间，需由调用方传入
//   maxIssuesPerGroup 每组最多报告的问题数，默认 10
//   analysisModel 分析阶段使用的模型，默认 biangfeng-gateway/deepseek-v4.1-flash-official（传空字符串则用会话默认模型）
//   reviewModel   报告质检使用的模型，默认同 analysisModel（传空字符串则用会话默认模型）
//   concurrency   并发上限，默认 16（运行时钳制到 16）
//   fast          最快档：规则组压到 16 组以内、报告分片并行写、默认跳过质检（去重与标注仍执行）
//   excludeKeywords 本期不检查的主题关键词数组，默认 ["金币场"]；命中 module/title/location/ruleRef 即剔除
//   dashboard     生成 HTML Dashboard，默认 true；传 false 跳过
//   dashboardScript Dashboard 生成脚本，默认 .claude/skills/game-prd-check/scripts/build-dashboard.mjs
//   skipReview   传 true 跳过报告质检阶段，直接出报告（更快，少一轮串行读文件）
//   skipConsistency 传 true 跳过全文一致性检查（大文档易触发长响应超时）；fast 档默认跳过
//   rtm         生成 RTM 追踪矩阵（需求点×规则点覆盖记录+证据校验），默认 true；传 false 关闭
//               需求文档见 dev-docs/design/game-prd-check-workflow-评审改进需求.md（v4）
//   rtmScript   RTM 矩阵组装脚本，默认 .opencode-workflows/scripts/rtm-assemble.mjs
//   runsDir     RTM 快照根目录，默认 examples/game-prd-check-workflow/rtm/runs
//   runId       运行 ID（快照目录名后缀），默认取 date 数字串；需保留多次快照时由调用方传唯一值
//   requirementsPath + extractionRunId 共享需求快照消费（v4 阶段 3，必項成对传入，只传其一直接报错）：
//               跳过自提取，检查与矩阵直接消费共享快照（requirementId 与 requirements-build 一致，
//               identity-map 不读不写）；extractionRunId 与快照 manifest 校验一致，不一致 fail-fast

export const meta = {
  id: 'game-prd-check',
  name: 'game_prd_check',
  description: '对照规则基准检查游戏 PRD 文档的完整性、一致性与逻辑正确性，生成结构化问题报告，并输出需求点×规则点全量追踪矩阵（RTM）',
  phases: [
    { title: '扫描' },
    { title: '需求与规则原子化' },
    { title: '规则检查' },
    { title: '一致性检查' },
    { title: '汇总去重' },
    { title: '矩阵组装' },
    { title: '主题归类' },
    { title: '生成报告' },
    { title: '报告审核' },
    { title: '生成Dashboard' },
  ],
}

const A = args || {}
const inputDir = A.inputDir || 'input'
const rulesDir = A.rulesDir || '.claude/skills/game-prd-check/references/rules'
const templatePath =
  A.templatePath || '.claude/skills/game-prd-check/references/templates/report.template.md'
const outPath = A.outPath || 'examples/game-prd-check-workflow/report.md'
const checkDate = A.date || '未提供（调用时请传 args.date，格式 YYYY-MM-DD）'
const maxIssuesPerGroup = A.maxIssuesPerGroup || 10
const fastMode = A.fast === true
// fast 档默认跳过质检，可用 args.skipReview=false 强制保留
const skipReview = A.skipReview === false ? false : A.skipReview === true || fastMode
// fast 档默认跳过全文一致性检查：整篇大 PRD 单次请求容易触发上游长响应超时
const skipConsistency = A.skipConsistency === false ? false : A.skipConsistency === true || fastMode
// fast 档把规则组压到并发上限以内，避免排第二波
const maxRuleGroups = fastMode ? 16 : 24
// 本期不检查的主题关键词：命中的问题在汇总后剔除，不计入统计
const excludeKeywords = Array.isArray(A.excludeKeywords) ? A.excludeKeywords : ['金币场']
// 报告生成的最后一步：把 report.md 转成离线 HTML Dashboard
const dashboardEnabled = A.dashboard !== false
const dashboardScript =
  A.dashboardScript || '.claude/skills/game-prd-check/scripts/build-dashboard.mjs'

// RTM 追踪矩阵（需求点×规则点覆盖记录）；关闭时流程与旧版一致
const rtmEnabled = A.rtm !== false

// 共享需求快照消费（v4 阶段 3）：传 requirementsPath + extractionRunId 成对校验；
// 传时跳过自提取，检查与矩阵直接消费共享快照（requirementId 与 requirements-build 一致，不碰 identity-map）
const sharedRequirementsPath = A.requirementsPath || null
const sharedExtractionRunId = A.extractionRunId || null
if ((sharedRequirementsPath && !sharedExtractionRunId) || (!sharedRequirementsPath && sharedExtractionRunId)) {
  throw new Error('requirementsPath 与 extractionRunId 必须成对传入（共享需求快照消费，v4 契约；只传其一直接报错）')
}
if (sharedRequirementsPath && !fileExists(sharedRequirementsPath + '/requirements.json')) {
  throw new Error('共享快照缺 requirements.json：' + sharedRequirementsPath + '（不猜测、不回退旧路径静默运行，请确认路径）')
}
if (sharedRequirementsPath) {
  log('消费共享需求快照：' + sharedRequirementsPath + '（extractionRunId ' + sharedExtractionRunId + '），跳过自提取')
}
const rtmScript = A.rtmScript || '.opencode-workflows/scripts/rtm-assemble.mjs'
const runsDir = A.runsDir || 'examples/game-prd-check-workflow/rtm/runs'
const runId =
  A.runId || (/^\d{4}-\d{2}-\d{2}$/.test(String(checkDate)) ? String(checkDate).replace(/-/g, '') : 'undated')
const runDir = runsDir + '/run-' + runId

// 分析阶段（扫描 / 规则检查 / 一致性检查 / 去重）统一用快速模型，报告撰写用会话默认模型
const analysisModel =
  A.analysisModel === undefined ? 'biangfeng-gateway/deepseek-v4.1-flash-official' : A.analysisModel
const analysisAgentOptions = analysisModel
  ? { model: analysisModel, timeoutMs: 7200000 }
  : { timeoutMs: 7200000 }

const reviewModel = A.reviewModel === undefined ? analysisModel : A.reviewModel
const reviewAgentOptions = reviewModel
  ? { model: reviewModel, timeoutMs: 1800000 }
  : { timeoutMs: 1800000 }

// 规则分组检查与一致性检查并发执行，默认放到 16 路；网关限流时可传 args.concurrency 调小
setConcurrency(A.concurrency || 16)

const TYPE_RULE = [
  'MISSING：规则中定义了、但需求文档缺失或未描述',
  'CONFLICT：需求文档内部两处描述互相矛盾',
  'LOGIC：与规则基准冲突，或需求文档自身逻辑错误',
  'AMBIGUOUS：描述可多种理解，无法确定实现方式',
  'INCOMPLETE：描述不完整，无法实现或无法验收',
].join('\n')

const PRIORITY_RULE = [
  'P0：关键流程/规则缺失或矛盾，直接阻塞开发或验收',
  'P1：明确的冲突、逻辑错误，不解决会导致实现错误',
  'P2：模糊、不完整，需要澄清后才能实现',
  'P3：优化建议，不影响正确性但补充后文档质量更高',
].join('\n')

const ISSUE_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['MISSING', 'CONFLICT', 'LOGIC', 'AMBIGUOUS', 'INCOMPLETE'] },
    priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
    title: { type: 'string', description: '一句话问题，不超过 40 字' },
    module: { type: 'string', description: '问题所属模块或章节主题，如 发牌 / 结算 / 重连' },
    location: { type: 'string', description: '需求文档原文位置（章节/小节标题），多处用、分隔' },
    quote: { type: 'string', description: '需求文档原文引文，不超过 200 字；MISSING 类写缺失说明' },
    ruleRef: { type: 'string', description: '对应规则文件与规则点（相对路径 + 章节或条目）' },
    requirementRefs: {
      type: 'array',
      items: { type: 'string' },
      description: '本问题涉及的需求点 reqKey 数组（来自需求点清单文件）；无法定位填空数组',
    },
    problem: { type: 'string', description: '问题说明，指出违反了哪条规则基准或哪里矛盾；涉及专有术语时先说清术语含义' },
    impact: { type: 'string', description: '对开发 / 测试 / 验收的具体影响' },
    suggestion: { type: 'string', description: '具体可执行的补充或修正建议' },
    term_explain: { type: 'string', description: '本条涉及的专有名词解释，格式「术语＝一句话定义」；无专有名词填「无」' },
    required_format: { type: 'string', description: '修复必须采用的格式：必填列或章节结构；非格式类问题填「无」' },
    example: { type: 'string', description: '可直接照抄进需求文档的完整示例，正常与异常各一条；非格式类问题填「无」' },
    acceptance: { type: 'string', description: '补齐后的验收口径：怎样算达标、测试能否直接出用例' },
  },
  required: [
    'type',
    'priority',
    'title',
    'module',
    'location',
    'quote',
    'ruleRef',
    'problem',
    'impact',
    'suggestion',
    'term_explain',
    'required_format',
    'example',
    'acceptance',
  ],
}

const ISSUES_SCHEMA = {
  type: 'object',
  properties: {
    issues: { type: 'array', items: ISSUE_ITEM_SCHEMA },
    summary: { type: 'string', description: '本次检查覆盖了哪些规则、是否有规则无法对照' },
  },
  required: ['issues'],
}

const SCAN_SCHEMA = {
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

const DEDUP_SCHEMA = {  type: 'object',
  properties: {
    duplicateGroups: { type: 'array', items: { type: 'array', items: { type: 'number' } } },
    notes: { type: 'string' },
  },
  required: ['duplicateGroups'],
}

const TOPIC_SCHEMA = {
  type: 'object',
  properties: {
    topics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '业务主题短语，如 金币场整体缺失' },
          issueIndexes: { type: 'array', items: { type: 'number' } },
        },
        required: ['name', 'issueIndexes'],
      },
    },
  },
  required: ['topics'],
}

// 五种检查类型只做内部统计，报告里以中文性质名称呈现
const TYPE_LABELS = {
  MISSING: '需求缺失',
  CONFLICT: '内容冲突',
  LOGIC: '逻辑错误',
  AMBIGUOUS: '定义歧义',
  INCOMPLETE: '描述不完整',
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

function issueRules() {
  return [
    '问题类型只允许这五种：',
    TYPE_RULE,
    '',
    '优先级只允许这四级：',
    PRIORITY_RULE,
    '',
    '硬性要求：',
    '1. 证据先行：每条问题必须给出需求文档原文位置（章节/小节标题）和原文引文，禁止无依据推测。',
    '2. 以 rules 为准：需求文档与 rules 冲突时，记问题的是需求文档，不要质疑规则本身。',
    '3. 报前复核：报 MISSING 或 LOGIC 前先回规则基准确认没有相反要求。规则没要求的内容不得当问题（例如规则写明“桌面上没有常驻显示，只记录数据”，就不能报“缺少局内展示”）。',
    '4. 不臆造：需求文档确实没写才算 MISSING；写了但含糊才是 AMBIGUOUS / INCOMPLETE。',
    '5. 不重复：同一问题只记一条，多处证据合并写进同一条的 location。',
    '6. 术语先解释：标题或问题里出现专有名词、缩写或自造词（如 跨层通知、进张、幂等、原版/修改对比版、无表、口径）时，term_explain 写「术语＝一句话定义」，problem 首句用解释后的说法。',
    '7. 缺失类必须给格式：缺章节、缺表、格式不清时，required_format 写必填列或章节结构；example 给正常与异常各一条可照抄的完整示例（真实内容，禁止 {占位符}，示例数值注明“示例值以产品确认为准”）。',
    '8. 冲突类必须定位：写明两版分别在哪一节哪张表、逐点列出差异；建议给出“生效声明”写法与版本差异对照表。',
    '9. 每条都要写 acceptance：补齐后如何判定合格，测试能否直接转成用例。',
    '10. 只报本范围规则能支撑的问题，不要越界检查别的模块。',
    '11. 按优先级从高到低自检一遍，最多输出 ' + maxIssuesPerGroup + ' 条最有价值的问题。',
    '12. 只输出结构化结果，不要输出报告正文。',
  ].join('\n')
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
  if (lines.length === 0) lines.push('（未提供规则文件，按组名在规则目录中检索相关规则）')
  return lines.join('\n')
}

function compactKey(s) {
  return String(s || '')
    .replace(/[\s\p{P}\p{S}]/gu, '')
    .toLowerCase()
}

// 确定性去重：同 type + location + 标题前缀（前 12 字）视为同一条。
// 重复项不删除，登记到主条目的 _dups，由后续标注为“同根因，建议合并”。
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

phase('扫描')

const scan = await agent(
  [
    '你是 PRD 检查流程的扫描器，工作目录为项目根目录。',
    '',
    '任务：只做清单扫描，不读正文做判断。',
    '1. 列出需求文档目录 ' + inputDir + ' 下所有 Markdown 文档，返回相对项目根目录的路径（不含规则目录里的文件）。',
    '2. 遍历规则基准目录 ' + rulesDir + '，把规则文件按主题分组，每组给出 title、focus、files、sections。',
    '   - 普通规则文件按主题成组，files 必须是相对项目根目录的完整路径，组内文件要覆盖到每一份规则文档，不能漏。',
    '   - 单个规则文件超过 20KB（约 8000 字）时按一级章节拆分：一章一个片段、一个片段一组，files 留空数组，sections 填 { file, fromLine, toLine, title }。片段必须首尾相接覆盖全文（从第 1 行到文件最后一行），不能留空档。用 grep 查章节标题、read 带 offset 确认行号（read 显示的行号即真实行号）。',
    '   - 小文件（≤20KB）按业务流程阶段合并成组（例如 开局与发牌 / 摸打吃碰杠 / 结算与分数 / 配置与做牌 / 重连 / 广播与数据），总览、目录、索引类文件放进第一组。',
    '   - 组间均衡：估算每组规则条数（小文件按每份约 30-60 条，大文件按章节行数占比），单组不超过 120 条；超出时必须拆成两组（同主题可拆上下半，title 加后缀区分）。检查工作按组并发，超大组会撞单组超时墙导致整次 run 失败。',
    '   - focus 用一句话说明这组规则管什么。',
    '   - 总组数上限 ' + maxRuleGroups + ' 组。章节数超过上限时，把相邻章节合并进同一组：同一组的 sections 可包含多个连续片段，fromLine/toLine 必须衔接覆盖全文，不得漏内容；章节数不超过上限时保持一章一组。',
    '3. 如果规则目录结构与本说明不同，按实际结构自适应分组，仍要覆盖全部规则文件。',
  ].join('\n'),
  { label: '扫描输入与规则', schema: SCAN_SCHEMA, ...analysisAgentOptions, timeoutMs: 900000 }
)

if (!scan || !Array.isArray(scan.ruleGroups) || scan.ruleGroups.length === 0) {
  throw new Error('扫描阶段失败：未取得规则分组清单，请检查规则目录 ' + rulesDir)
}

const inputFiles = A.inputFiles && A.inputFiles.length > 0 ? A.inputFiles : scan.inputFiles || []
if (inputFiles.length === 0) {
  throw new Error('未找到需求文档：请检查目录 ' + inputDir + ' 或通过 args.inputFiles 指定')
}

const inputList = inputFiles.map((f) => '- ' + f).join('\n')
const ruleGroups = scan.ruleGroups

// ---------- RTM T1：需求与规则原子化（提取分片，供检查对照与矩阵组装） ----------
// 块外声明（T0 修复：此前 const 声明在 if 块内、块外引用会 ReferenceError）
let reqResults = []
let catalogResults = []
if (rtmEnabled) {
  phase('需求与规则原子化')
  // 需求点提取：每个 PRD 文件一个 agent，按"独立可验证需求行为"拆原子点并写分片；
  // 共享快照模式（requirementsPath）下跳过，直接消费共享 requirements.json
  if (rtmEnabled && !sharedRequirementsPath) {
  reqResults = await parallel(
    inputFiles.map((f, i) => () => {
      const base = String(f).replace(/^.*\//, '').replace(/\.md$/i, '')
      const planFile = runDir + '/requirements/plans/part-' + String(i + 1).padStart(2, '0') + '.plan.json'
      const partFile = runDir + '/requirements/parts/part-' + String(i + 1).padStart(2, '0') + '.json'
      return agent(
        [
          '你是需求分析师。工作目录为项目根目录。',
          '',
          '任务：通读需求文档 ' + f + '，把它拆解为原子需求点清单。',
          '',
          '拆分标准：一个原子需求点 = 能独立判断是否满足某项预期行为或验收条件。',
          '- 例："玩家可以碰牌，碰牌后需要广播给其他玩家，并更新手牌"拆为 ①满足条件可碰 ②碰后广播 ③碰后更新手牌 三条；',
          '- 不要机械逐句切分，避免无业务价值的碎片；总览/目录类内容不提取。',
          '',
          '产出方式（两步，不要自己写脚本切原文）：',
          '1. 用 write 工具写提取计划到 ' + planFile + '（UTF-8，小 JSON，不含任何原文）：',
          '   { "sourceFile": ' + JSON.stringify(f) + ', "outFile": ' + JSON.stringify(partFile) + ', "items": [',
          '     { "reqKey": "' + base + '-<三位序号>", "title": "≤20 字小标题", "section": "章节号或标题", "fromLine": <起始行>, "toLine": <结束行> } ] }',
          '   reqKey 在本文件内从 001 连续编号；fromLine/toLine 用 read 工具显示的真实行号（1 基）。',
          '2. 执行命令：node .opencode-workflows/scripts/slice-part.mjs "' + planFile + '"',
          '   切片脚本会从源文件按行范围机械切原文组装分片（text 与源文件一致由脚本保证，禁止手抄原文）；',
          '   命令输出含 [失败] 时：按错误修正计划文件后重跑，直到 [成功]；',
          '3. 只写计划文件与分片产物，不要执行 git，不要修改源文件与脚本。',
          '',
          '完成后返回：{ partFile: <分片产物路径>, count: <需求点条数> }',
        ].join('\n'),
        {
          label: '提取需求 ' + base,
          agentType: 'general',
          schema: {
            type: 'object',
            properties: { partFile: { type: 'string' }, count: { type: 'number' } },
            required: ['partFile', 'count'],
          },
          timeoutMs: 1800000,
          retries: 1,
        }
      )
    })
  )
  } // 共享快照模式需求提取结束
  // 规则目录提取：每个规则组一个 agent，拆原子检查点并写分片
  catalogResults = await parallel(
    ruleGroups.map((group, gi) => () => {
      const partFile = runDir + '/catalog/parts/group-' + String(gi + 1).padStart(2, '0') + '.json'
      const rulePrefix = 'R' + String(gi + 1).padStart(2, '0')
      return agent(
        [
          '你是规则工程师。工作目录为项目根目录。',
          '',
          '任务：把下列规则文件拆解为原子检查点清单，并写入指定 JSON 文件。',
          '',
          ruleScopeText(group),
          '',
          '拆分标准：一个原子检查点 = 一条可独立判定的规则要求（基准中的编号条款、表格行、明确的行为约束）。',
          '- 总览、目录、索引类条款 mandatory 填 false；其余 true。',
          '',
          '产出方式：用 write 工具直接写 JSON 文件（禁止写临时脚本拼 JSON）：',
          '输出文件（只写这一个文件，UTF-8）：' + partFile,
          'JSON 数组，每个元素：',
          '{ "ruleId": "' + rulePrefix + '-<三位序号>", "file": "<规则文件相对路径>", "section": "章节或条款号", "fromLine": <行>, "toLine": <行>, "text": "规则原文摘要（与源文件一致，≤100 字）", "mandatory": true }',
          '',
          '硬性要求：',
          '1. ruleId 用前缀 ' + rulePrefix + '- 从 001 连续编号；',
          '2. 必须覆盖组内全部规则内容，不得遗漏章节；',
          '3. 只写这一个文件，不要执行 git。',
          '',
          '完成后返回：{ partFile: <写的文件路径>, clauseCount: <检查点条数> }',
        ].join('\n'),
        {
          label: '提取规则 ' + group.title,
          agentType: 'general',
          schema: {
            type: 'object',
            properties: { partFile: { type: 'string' }, clauseCount: { type: 'number' } },
            required: ['partFile', 'clauseCount'],
          },
          timeoutMs: 1800000,
          retries: 1,
        }
      )
    })
  )
}

const reqPartFiles = rtmEnabled
  ? sharedRequirementsPath
    ? [sharedRequirementsPath + '/requirements.json']
    : (reqResults || []).filter(Boolean).map((r) => r.partFile).filter(Boolean)
  : []
const catalogPartFiles = rtmEnabled
  ? (catalogResults || []).filter(Boolean).map((r) => r.partFile).filter(Boolean)
  : []
if (rtmEnabled && (reqPartFiles.length === 0 || catalogPartFiles.length === 0)) {
  throw new Error(
    'RTM 原子化阶段失败：需求分片 ' + reqPartFiles.length + ' 个 / 规则目录分片 ' + catalogPartFiles.length + ' 个，至少各需 1 个'
  )
}
if (rtmEnabled) {
  if (sharedRequirementsPath) {
    log('需求来源：共享快照 ' + reqPartFiles[0] + '（extractionRunId ' + sharedExtractionRunId + '）')
  } else {
    const reqCount = (reqResults || []).filter(Boolean).reduce((s, r) => s + (r.count || 0), 0)
    log('RTM 原子化完成：需求点 ' + reqCount + ' 条（' + reqPartFiles.length + ' 片）')
  }
  const clauseCount = (catalogResults || []).filter(Boolean).reduce((s, r) => s + (r.clauseCount || 0), 0)
  log('规则检查点 ' + clauseCount + ' 条（' + catalogPartFiles.length + ' 片）')
}

phase('规则检查')

const groupTasks = parallel(
  ruleGroups.map((group, gi) => () => {
    const groupId = 'group-' + String(gi + 1).padStart(2, '0')
    const catalogPart = rtmEnabled ? runDir + '/catalog/parts/' + groupId + '.json' : null
    const checkFile = rtmEnabled ? runDir + '/checks/' + groupId + '.json' : null
    return agent(
      [
        '你是资深游戏 PRD 审核员，正在对照规则基准检查需求文档。',
        '',
        '需求文档（务必全文逐段读完，文件较大可分多次读取）：',
        inputList,
        '',
        '本次负责的规则范围：' + group.title,
        '范围聚焦：' + (group.focus || '该组全部规则'),
        ruleScopeText(group),
        rtmEnabled && catalogPart
          ? [
              '',
              '本组规则原子检查点清单（先读该文件，逐条对照检查）：',
              '- ' + catalogPart,
              '',
              '需求点清单文件（检查时用于定位需求点 reqKey；共享快照含 requirementId/identityStatus 等额外字段，忽略即可）：',
              reqPartFiles.map((f) => '- ' + f).join('\n'),
              '',
              'RTM 覆盖记录（必须完成，与找问题同等重要）：',
              '1. 本组每个规则原子检查点（ruleId）都必须输出一条 coverage 记录，包括完全没问题的（status=pass）；',
              '   { "ruleId": "<清单中的 ruleId>", "reqKey": "<需求点键或 null>", "status": "pass|incomplete|conflict|missing|unverified|na", "evidence": "判断依据（需求原文位置与理由，≤200 字）" }；',
              '   - reqKey 来自需求点清单；规则点不涉及任何需求点时 reqKey 填 null、status 填 na；',
              '   - 一条规则涉及多个需求点时输出多条 coverage。',
              '2. issues 每条加 requirementRefs 字段（字符串数组，列出该问题涉及的 reqKey；无法定位填空数组）。',
              '3. 全部完成后，用 write 工具把 issues 与 coverage 合并写入一个 JSON 文件（UTF-8；禁止写临时脚本拼 JSON）：' + checkFile,
              '   结构：{ "groupId": ' + JSON.stringify(groupId) + ', "status": "completed", "checkVersion": "v1", "coverage": [...], "issues": [...与返回值一致] }',
            ].join('\n')
          : '',
        '',
        '检查方式：把本组每条规则与需求文档逐条对照，找出需求文档的问题。',
        '注意：规则文件描述的是应有的正确行为，它是基准；只需报告需求文档的缺失、冲突、逻辑错误、模糊与不完整。',
        '其他规则组的问题不要报告，由其他检查员负责。',
        '',
        issueRules(),
      ].join('\n'),
      {
        label: '检查 ' + group.title,
        schema: ISSUES_SCHEMA,
        ...analysisAgentOptions,
        retries: 1,
      }
    )
  })
)

phase('一致性检查')

if (skipConsistency) {
  log(fastMode ? 'fast 档默认跳过全文一致性检查（可用 args.skipConsistency=false 保留）' : '已按 args.skipConsistency 跳过全文一致性检查')
}

const internalTask = skipConsistency ? null : agent(
  [
    '你是资深游戏 PRD 审核员，本次只做需求文档内部一致性检查，不按规则清单逐条对照。',
    '',
    '需求文档（务必全文读完，可分多次读取）：',
    inputList,
    '',
    '只找以下三类问题：',
    '1. CONFLICT：文档内部两处（不同章节/不同表格/不同流程图）描述互相矛盾。',
    '2. AMBIGUOUS：同一处描述可多种理解，实现方式无法确定。',
    '3. INCOMPLETE：流程、状态、数值、异常分支缺失，导致无法实现或无法验收。',
    '',
    '不要报告规则基准里有、文档没写的内容（那属于规则覆盖检查，另有检查员负责）。',
    '',
    issueRules(),
  ].join('\n'),
  { label: '全文一致性检查', schema: ISSUES_SCHEMA, ...analysisAgentOptions, retries: 1 }
)

const groupResults = await groupTasks
const internalResult = internalTask ? await internalTask : null

phase('汇总去重')

let allIssues = []
let droppedGroup = 0
const failedGroupTitles = []
for (let gi = 0; gi < (groupResults || []).length; gi++) {
  const r = groupResults[gi]
  if (!r || !Array.isArray(r.issues)) {
    droppedGroup += 1
    failedGroupTitles.push(ruleGroups[gi] ? ruleGroups[gi].title : 'group-' + (gi + 1))
    continue
  }
  for (const it of r.issues) allIssues.push(it)
}
if (internalResult && Array.isArray(internalResult.issues)) {
  for (const it of internalResult.issues) allIssues.push(it)
}
if (droppedGroup > 0) log('有 ' + droppedGroup + ' 个规则组检查失败，报告仅覆盖成功分组')

let excludedCount = 0
if (excludeKeywords.length > 0) {
  const kept = []
  for (const it of allIssues) {
    const haystack = [it.module, it.title, it.location, it.ruleRef].join(' ')
    if (excludeKeywords.some((k) => k && haystack.indexOf(k) >= 0)) {
      excludedCount += 1
      continue
    }
    kept.push(it)
  }
  allIssues = kept
}
if (excludedCount > 0) {
  log('按本期检查范围排除 ' + excludedCount + ' 条涉及 ' + excludeKeywords.join('、') + ' 的问题')
}

if (allIssues.length > 15) {
  const compact = allIssues.map((it, i) => ({
    i: i,
    type: it.type,
    priority: it.priority,
    title: it.title,
    location: it.location,
  }))

  const dedup = await agent(
    [
      '你是问题清单合并员。下面是从不同检查员汇总的问题索引（i 为下标）：',
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
    const idxs = g.filter((n) => Number.isInteger(n) && n >= 0 && n < allIssues.length)
    if (idxs.length < 2) continue
    const keep = allIssues[idxs[0]]
    if (!keep._dups) keep._dups = []
    for (const idx of idxs.slice(1)) {
      if (idx === idxs[0]) continue
      const dup = allIssues[idx]
      if (dup._dupOf || dup._dups) continue
      dup._dupOf = keep
      keep._dups.push(dup)
      const loc = dup.location
      if (loc && String(keep.location || '').indexOf(loc) < 0) {
        keep.location = (keep.location ? keep.location + '、' : '') + loc
      }
    }
  }
  const marked = allIssues.filter((it) => it._dupOf).length
  if (marked > 0) log('问题归并完成：' + marked + ' 条重复问题将标注为同根因，建议合并')
} else if (allIssues.length > 0) {
  allIssues = exactDedup(allIssues)
  log('问题较少（≤15 条），使用确定性去重')
}

const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 }
const TYPE_ORDER = { MISSING: 0, CONFLICT: 1, LOGIC: 2, AMBIGUOUS: 3, INCOMPLETE: 4 }
allIssues.sort((a, b) => {
  const p = (PRIORITY_ORDER[a.priority] || 0) - (PRIORITY_ORDER[b.priority] || 0)
  if (p !== 0) return p
  return (TYPE_ORDER[a.type] || 0) - (TYPE_ORDER[b.type] || 0)
})

const issues = allIssues.map((it, i) => {
  const id = 'PRD-' + String(i + 1).padStart(3, '0')
  return {
    id: id,
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
    term_explain: it.term_explain || '无',
    required_format: it.required_format || '无',
    example: it.example || '无',
    acceptance: it.acceptance || '',
    _src: it,
  }
})

// 同根因重复项不删除，只标注主条目与重复条目，保留证据同时避免清单冗余
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

log('汇总完成：共 ' + stats.total + ' 条问题（P0 ' + stats.P0 + ' / P1 ' + stats.P1 + ' / P2 ' + stats.P2 + ' / P3 ' + stats.P3 + '）')

// ---------- RTM T2/T3：矩阵组装与校验（确定性脚本，AI 只负责执行命令与落盘） ----------
let rtmResult = null
if (rtmEnabled) {
  phase('矩阵组装')
  // 步骤 1：规范化问题清单（精简字段，含 requirementRefs）与运行元信息落盘
  const issuesSlim = issues.map((it) => ({
    id: it.id,
    type: it.type,
    priority: it.priority,
    title: it.title,
    module: it.module,
    requirementRefs: (it._src && it._src.requirementRefs) || [],
  }))
  const rtmMeta = { checkDate, failedGroups: failedGroupTitles, excludeKeywords, extractionRunId: sharedExtractionRunId || null }
  const issuesRawFile = runDir + '/issues-raw.json'
  const metaFile = runDir + '/meta.json'
  await agent(
    [
      '你在项目根目录执行两次文件写入（用 write 工具，UTF-8）：',
      '',
      '文件 1：' + issuesRawFile,
      '内容为以下 JSON 原样写入：',
      JSON.stringify(issuesSlim),
      '',
      '文件 2：' + metaFile,
      '内容为以下 JSON 原样写入：',
      JSON.stringify(rtmMeta),
      '',
      '完成后返回 { done: true }。不要修改 JSON 内容。',
    ].join('\n'),
    {
      label: 'RTM 数据落盘',
      agentType: 'general',
      schema: {
        type: 'object',
        properties: { done: { type: 'boolean' } },
        required: ['done'],
      },
      timeoutMs: 600000,
    }
  )
  await check(() => fileExists(issuesRawFile), 'issues-raw 未写入: ' + issuesRawFile)
  await check(() => fileExists(metaFile), 'meta 未写入: ' + metaFile)

  // 步骤 2：执行确定性组装脚本（分片合并/ID 匹配/证据校验/矩阵/双指标统计）
  rtmResult = await agent(
    [
      '你在项目根目录执行以下命令，然后按 schema 返回结果：',
      '',
      'node ' + rtmScript + ' ' + runDir + ' --issues-raw ' + issuesRawFile + ' --meta ' + metaFile
        + (sharedRequirementsPath
            ? ' --shared-requirements "' + sharedRequirementsPath + '" --extraction-run-id "' + sharedExtractionRunId + '"'
            : ''),
      '',
      '要求：',
      '1. 命令输出 [成功] 时，从输出中提取需求点数/检查完成率/规则通过率，填入返回字段；',
      '2. 命令输出 [失败] 时，原样记录错误清单到 message，ok 填 false；',
      '3. 不要修改脚本与数据文件。',
    ].join('\n'),
    {
      label: 'RTM 矩阵组装',
      agentType: 'general',
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          requirementTotal: { type: 'number' },
          checkCompleteRate: { type: 'number' },
          rulePassRate: { type: 'number' },
          message: { type: 'string', description: '结果说明或失败原因' },
        },
        required: ['ok', 'message'],
      },
      timeoutMs: 600000,
    }
  )
  if (rtmResult && rtmResult.ok) {
    log(
      'RTM 矩阵完成：需求点 ' + (rtmResult.requirementTotal || '?') + '，完成率 ' +
        (rtmResult.checkCompleteRate != null ? (rtmResult.checkCompleteRate * 100).toFixed(1) + '%' : '?') +
        '，通过率 ' + (rtmResult.rulePassRate != null ? (rtmResult.rulePassRate * 100).toFixed(1) + '%' : '?')
    )
  } else {
    log('[降级] RTM 矩阵组装失败：' + (rtmResult && rtmResult.message))
  }

  // 步骤 3：矩阵章节追加进报告尾部（报告主体结构不变）
  if (rtmResult && rtmResult.ok) {
    await agent(
      [
        '你在项目根目录执行一段 node 命令：把 RTM 矩阵章节追加到报告文件尾部。',
        '',
        '要求：',
        '1. 读取 ' + runDir + '/matrix-report.md 全文；',
        '2. 把首行 "# 需求全量检查矩阵" 替换为 "## 需求全量检查矩阵（RTM）"；',
        '3. 在 ' + outPath + ' 文件末尾追加：先加一行 "\\n---\\n"，再接替换后的全文；',
        '4. 用 node -e 完成读写（fs.readFileSync/writeFileSync，utf8），写完后确认 ' + outPath + ' 包含 "需求全量检查矩阵（RTM）"；',
        '5. 不要改动报告其他内容。',
      ].join('\n'),
      {
        label: '矩阵章节合并',
        agentType: 'general',
        timeoutMs: 300000,
      }
    )
  }
}

phase('主题归类')

const issueIndexes = issues.map((it, i) => ({
  i: i,
  title: it.title,
  module: it.module,
  type: it.type,
  location: it.location,
  ruleRef: it.ruleRef,
}))

const topicResult = await agent(
  [
    '你是 PRD 问题清单的主题归类员。下面每条问题都已编号（i 为下标）。',
    JSON.stringify(issueIndexes, null, 1),
    '',
    '任务：把问题归入可读的业务主题，替代 MISSING、CONFLICT 这类抽象检查类型。',
    '要求：',
    '1. 主题是“业务对象 + 问题性质”的短语，4~12 字，例如 金币场规则缺失、断线重连缺失、结算流程不完整、三摊承包口径冲突、超时兜底缺失。',
    '2. 禁止使用 MISSING、CONFLICT 等英文检查类型，也禁止“文档规范要素缺失”“局内展示细节缺失”这类抽象主题；主题必须让人一眼看出是哪个业务对象出了什么问题。',
    '3. 同一缺陷簇必须使用完全相同的主题写法；每个问题只能归入一个主题。',
    '4. 标题含“（与 PRD-xxx 同根因，重复登记）”的问题，必须与被引用的主条目使用同一主题。',
    '5. 主题数量控制在 8~25 个，既能区分重点，又不要一条问题一个主题。',
    '6. issueIndexes 必须覆盖全部下标 0 到 ' + (issues.length - 1) + '，不能遗漏、不能重复。',
    '7. 只做归类，不要改写问题标题。',
  ].join('\n'),
  { label: '主题归类', schema: TOPIC_SCHEMA, ...analysisAgentOptions, timeoutMs: 1800000 }
)

const topicByIndex = {}
const topicCounts = {}
let topicFallback = 0
for (const t of (topicResult && topicResult.topics) || []) {
  const name = String((t && t.name) || '').trim()
  if (!name) continue
  for (const idx of (t && t.issueIndexes) || []) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= issues.length) continue
    if (topicByIndex[idx]) continue
    topicByIndex[idx] = name
    topicCounts[name] = (topicCounts[name] || 0) + 1
  }
}
for (let i = 0; i < issues.length; i++) {
  if (!topicByIndex[i]) {
    topicFallback += 1
    const fallback = issues[i].module || '未分类'
    topicByIndex[i] = fallback
    topicCounts[fallback] = (topicCounts[fallback] || 0) + 1
  }
  issues[i].topic = topicByIndex[i]
}

const topicRank = Object.keys(topicCounts)
  .map((name) => ({ name: name, count: topicCounts[name] }))
  .sort((a, b) => b.count - a.count)

log(
  '主题归类完成：' +
    topicRank.length +
    ' 个主题' +
    (topicFallback > 0 ? '，' + topicFallback + ' 条问题走模块兜底' : '')
)

phase('生成报告')

const scopeLine =
  excludeKeywords.length > 0
    ? '检查范围：排除 ' + excludeKeywords.join('、') + '（本期不检查，未计入统计）'
    : '检查范围：全量'

// 报告输入瘦身：清单表只给精简字段，详情只给 P0/P1 + 3 条典型 P2
const tableRows = issues.map((it) => ({
  id: it.id,
  topic: it.topic,
  priority: it.priority,
  title: it.title,
  location: it.location,
  suggestion: it.suggestion,
}))
const detailIssues = issues
  .filter((it) => it.priority === 'P0' || it.priority === 'P1')
  .concat(issues.filter((it) => it.priority === 'P2').slice(0, 3))
  .map((it) => ({
    id: it.id,
    topic: it.topic,
    priority: it.priority,
    type_label: TYPE_LABELS[it.type] || it.type,
    title: it.title,
    location: it.location,
    quote: it.quote,
    ruleRef: it.ruleRef,
    problem: it.problem,
    impact: it.impact,
    suggestion: it.suggestion,
    term_explain: it.term_explain,
    required_format: it.required_format,
    example: it.example,
    acceptance: it.acceptance,
  }))

// fast 档报告分片并行写 + 命令拼接；默认档单代理整篇写
let writeResult = null

if (fastMode) {
  const part1Path = outPath + '.part1.md'
  const part2Path = outPath + '.part2.md'
  const keyIssues = issues.filter((it) => it.priority === 'P0' || it.priority === 'P1')

  const partResults = await parallel([
    () =>
      agent(
        [
          '你是 PRD 检查报告撰写员，只写报告的前半部分（第 1、2 段）。',
          '',
          '报告模板（先读一遍，严格按它的结构）：' + templatePath,
          '本分片输出路径：' + part1Path,
          '',
          '报告头部信息（写在文件最开头）：',
          '- 检查对象：' + inputFiles.join('、'),
          '- ' + scopeLine,
          '- 规则基准：' + rulesDir,
          '- 检查日期：' + checkDate,
          '',
          '统计（必须原样使用，不得自行改数）：',
          JSON.stringify({ 统计: stats, 主题分布: topicRank }, null, 1),
          '',
          '问题清单表格数据（全部条目，id 已编号，不要增删或改写 id）：',
          JSON.stringify(tableRows, null, 1),
          '',
          '写作要求：',
          '1. 文件依次为：# PRD 检查问题报告、检查对象/规则基准/检查日期、## 1. 检查概览（统计表）、## 2. 问题清单（表格：ID | 主题 | 优先级 | 问题 | 原文位置 | 建议）。',
          '2. 问题清单必须列出全部条目，一条不漏，顺序与数据一致；建议列取 suggestion 的精简版。',
          '3. 不要写第 3、4 段，也不要写结尾总结。',
          '4. 使用 write 工具写入 ' + part1Path + '，UTF-8 中文，不使用 Emoji。',
          '5. 完成后返回写入的条数。',
          '只操作指定的输出文件，不要执行 git 命令、不要提交或推送、不要改动其他文件。',
        ].join('\n'),
        { label: '写报告-概览与清单', agentType: 'general', timeoutMs: 3600000 }
      ),
    () =>
      agent(
        [
          '你是 PRD 检查报告撰写员，只写报告的后半部分（第 3、4 段）。',
          '',
          '报告模板（先读一遍，严格按它的结构）：' + templatePath,
          '本分片输出路径：' + part2Path,
          '',
          '统计与结论依据：',
          JSON.stringify(
            {
              统计: stats,
              主题分布: topicRank,
              严重问题: keyIssues.map((it) => ({ id: it.id, topic: it.topic, priority: it.priority, title: it.title })),
            },
            null,
            1
          ),
          '',
          '重点问题详情数据（只展开这些条目）：',
          JSON.stringify(detailIssues, null, 1),
          '',
          '写作要求：',
          '1. 文件第一行必须是 ## 3. 重点问题详情，然后按数据逐条展开，顺序固定：主题、问题性质（type_label）、术语解释（term_explain 不为“无”时保留）、原文（引用 quote 并标注 location）、问题、影响、需要补的内容与必填格式（required_format 不为“无”时保留）、范例（example 不为“无”时原样保留，保证可照抄）、建议、验收口径（acceptance）、处理状态（默认 待确认）。',
          '2. term_explain、required_format、example、acceptance 为“无”或空时跳过该小节，不要编造；example 中的示例值保留原样。',
          '3. 随后写 ## 4. 总体建议：问题最多的主题取主题分布第一名，影响开发的问题列出 P0/P1 的 ID，是否建议进入下一阶段按“存在 P0 或 P1 数量较多则暂缓，否则建议”给出结论与理由。',
          '4. 不要重复报告标题与头部信息，不要写第 1、2 段。',
          '5. 只能使用给定数据中的事实，不得编造引文或新增问题；引文必须来自 quote 字段。',
          '6. 使用 write 工具写入 ' + part2Path + '，UTF-8 中文，不使用 Emoji。',
          '7. 完成后返回写入的条数。',
          '只操作指定的输出文件，不要执行 git 命令、不要提交或推送、不要改动其他文件。',
        ].join('\n'),
        { label: '写报告-详情与建议', agentType: 'general', timeoutMs: 3600000 }
      ),
  ])

  // 合并报告分片（确定性命令 merge-parts.mjs，替代合并 agent；顺带消灭 PowerShell 5.1 写入 UTF-8 BOM 隐患）
  // 续跑（resume）时分片可能已被上次运行删除：目标已存在且分片全无 → 保留现有产物
  const mergeScript = '.opencode-workflows/scripts/merge-parts.mjs'
  if (fileExists(outPath) && !fileExists(part1Path) && !fileExists(part2Path)) {
    log('报告分片已在上次运行合并，保留现有 ' + outPath)
  } else {
    const merged = await commandSuccess(
      'node "' + mergeScript + '" "' + outPath + '" "' + part1Path + '" "' + part2Path + '"'
    )
    if (!merged) throw new Error('报告分片合并失败（分片缺失或损坏，上次运行可能中断），请重跑 workflow')
  }
  // 乱码检查（确定性命令；发现乱码直接报错暴露，人工确认后重跑对应分片）
  const fffdClean = await commandSuccess(
    'node -e "process.exit(require(\'fs\').readFileSync(process.argv[1],\'utf8\').includes(\'\\uFFFD\')?1:0)" "' + outPath + '"'
  )
  if (!fffdClean) {
    throw new Error('报告 ' + outPath + ' 含乱码替换字符 U+FFFD（分片写入编码异常），请删除该文件后重跑 workflow')
  }
  writeResult = '已合并（确定性命令）：' + outPath
} else {
  writeResult = await agent(
    [
      '你是 PRD 检查报告撰写员。把下面的检查结果写成正式报告并落盘。',
      '',
      '报告模板（先读一遍，严格按它的四段结构）：' + templatePath,
      '输出路径（唯一交付物）：' + outPath,
      '',
      '报告头部信息：',
      '- 检查对象：' + inputFiles.join('、'),
      '- ' + scopeLine,
      '- 规则基准：' + rulesDir,
      '- 检查日期：' + checkDate,
      '',
      '统计（必须原样使用，不得自行改数）：',
      JSON.stringify({ 统计: stats, 主题分布: topicRank }, null, 1),
      '',
      '问题清单表格数据（全部条目，id 已编号，不要新增、删除或改写 id）：',
      JSON.stringify(tableRows, null, 1),
      '',
      '重点问题详情数据（只展开这些条目）：',
      JSON.stringify(detailIssues, null, 1),
      '',
      '写作要求：',
      '1. 严格四段结构：1 检查概览（统计表） -> 2 问题清单（表格：ID | 主题 | 优先级 | 问题 | 原文位置 | 建议） -> 3 重点问题详情 -> 4 总体建议。',
      '2. 第 2 段必须列出全部问题，一条不漏，顺序与表格数据一致；建议列取每条 suggestion 的精简版。',
      '3. 第 3 段只展开“重点问题详情数据”里的条目；每条按固定顺序书写：主题、问题性质（type_label）、术语解释（term_explain 不为“无”时保留）、原文（引用 quote 并标注 location）、问题、影响、需要补的内容与必填格式（required_format 不为“无”时保留）、范例（example 不为“无”时原样保留）、建议、验收口径（acceptance）、处理状态（默认 待确认）。',
      '4. term_explain、required_format、example、acceptance 为“无”或空时跳过该小节，不要编造。',
      '5. 第 4 段：问题最多的主题取主题分布第一名，影响开发的问题列出 P0/P1 的 ID，是否建议进入下一阶段按“存在 P0 或 P1 数量较多则暂缓，否则建议”给出结论与理由。',
      '6. 只能使用上面数据中的事实，不得编造原文引文或新增问题；引文必须来自 quote 字段。',
      '7. 使用 write 工具写入 ' + outPath + '，UTF-8 中文，不使用 Emoji。',
      '8. 完成后返回文件路径与写入的问题总条数。',
      '只操作指定的输出文件，不要执行 git 命令、不要提交或推送、不要改动其他文件。',
    ].join('\n'),
    { label: '撰写报告 ' + outPath, agentType: 'general', timeoutMs: 3600000 }
  )
}

phase('报告审核')

let review = null
let fixed = false

if (skipReview) {
  log(fastMode ? 'fast 档默认跳过报告审核（可用 args.skipReview=false 保留）' : '已按 args.skipReview 跳过报告审核')
} else {
  review = await agent(
    [
      '你是报告质检员。审核 PRD 检查报告是否符合模板与硬性要求。',
      '',
      '报告文件：' + outPath,
      '报告模板：' + templatePath,
      '期望问题总数：' + stats.total + '（P0 ' + stats.P0 + ' / P1 ' + stats.P1 + ' / P2 ' + stats.P2 + ' / P3 ' + stats.P3 + '）',
      '期望重点详情条数：' + detailIssues.length,
      '',
      '逐项检查并输出问题列表：',
      '1. 是否包含四段结构，标题与模板一致；',
      '2. 检查对象、规则基准、检查日期是否已填写（不能留占位符）；',
      '3. 概览统计数字是否与期望总数和优先级分布一致；',
      '4. 问题清单行数是否等于期望总数，ID 是否从 PRD-001 连续编号无跳号；',
      '5. 清单表头是否为 ID | 主题 | 优先级 | 问题 | 原文位置 | 建议；主题列是否为具体业务主题（不得出现 MISSING、CONFLICT、LOGIC、AMBIGUOUS、INCOMPLETE 等英文检查类型），优先级是否只用四级；',
      '6. 每条清单项是否都有主题、原文位置与建议；重点问题详情是否包含主题与中文问题性质，且有原文引文，条数不少于期望详情条数；涉及专有术语的是否有术语解释，缺章节/缺表类是否写了必填列与可照抄范例；',
      '7. 是否存在明显编造内容（引文与清单对不上、凭空新增问题）。',
      '',
      '全部通过返回 ok=true、problems 为空数组；有问题则 ok=false 并逐条写清问题与位置。',
    ].join('\n'),
    { label: '审核报告', schema: REVIEW_SCHEMA, ...reviewAgentOptions }
  )

  if (review && review.ok === false) {
    const problems = (review.problems || []).join('\n- ')
    await agent(
      [
        '报告未通过质检，请修正。报告文件：' + outPath,
        '模板：' + templatePath,
        '',
        '质检发现的问题：',
        '- ' + problems,
        '',
        '修正要求：只按质检意见修改报告，保持事实与统计不变（总数 ' + stats.total + '，P0 ' + stats.P0 + '，P1 ' + stats.P1 + '，P2 ' + stats.P2 + '，P3 ' + stats.P3 + '），不得新增或删除问题条目。',
        '问题清单数据以本 JSON 为准：',
        JSON.stringify(tableRows, null, 1),
        '',
        '修改完成后返回修改摘要。',
        '只操作指定的报告文件，不要执行 git 命令、不要提交或推送、不要改动其他文件。',
      ].join('\n'),
      { label: '修正报告', agentType: 'general', timeoutMs: 1800000 }
    )
    fixed = true
  }
}

await check(() => fileExists(outPath), '报告文件未生成：' + outPath)

phase('生成Dashboard')

let dashboardResult = null
if (dashboardEnabled) {
  dashboardResult = await agent(
    [
      '你在项目根目录执行 Dashboard 生成命令。只允许执行该命令并读取输出，不要 git 提交、不要修改 report.md 或其他文件。',
      '',
      '执行命令（一次执行完）：',
      'node "' + dashboardScript + '" "' + outPath + '"',
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
  rtmRunDir: runDir,
  dashboardPath: dashboardResult ? dashboardResult.htmlPath : null,
  reportJsonPath: dashboardResult ? dashboardResult.reportJsonPath : null,
  dashboardSkipped: !dashboardEnabled,
  requirementsSource: sharedRequirementsPath ? 'shared-snapshot' : 'self-extract',
  extractionRunId: sharedExtractionRunId || null,
  inputFiles: inputFiles,
  ruleGroups: ruleGroups.map((g) => ({
    title: g.title,
    fileCount: (g.files || []).length,
    sectionCount: (g.sections || []).length,
  })),
  stats: stats,
  typeStats: typeStats,
  topicRank: topicRank,
  moduleRank: moduleRank,
  excludedCount: excludedCount,
  excludeKeywords: excludeKeywords,
  reviewSkipped: skipReview,
  consistencySkipped: skipConsistency,
  fastMode: fastMode,
  reviewOk: skipReview ? null : review ? review.ok === true || fixed : false,
  reportWriteSummary: writeResult,
  rtm: rtmEnabled
    ? {
        ok: !!(rtmResult && rtmResult.ok),
        runDir: runDir,
        matrixPath: runDir + '/requirements-matrix.json',
        issuesPath: runDir + '/issues.json',
        manifestPath: runDir + '/manifest.json',
        requirementTotal: rtmResult ? rtmResult.requirementTotal || null : null,
        checkCompleteRate: rtmResult ? rtmResult.checkCompleteRate || null : null,
        rulePassRate: rtmResult ? rtmResult.rulePassRate || null : null,
        failedGroups: failedGroupTitles,
        message: rtmResult ? rtmResult.message : '',
      }
    : { disabled: true },
}
