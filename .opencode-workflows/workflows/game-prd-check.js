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
//   outPath       报告输出路径，默认 examples/game-prd-check/report.md
//   date          检查日期（YYYY-MM-DD）；脚本内禁止取当前时间，需由调用方传入
//   maxIssuesPerGroup 每组最多报告的问题数，默认 20
//   analysisModel 分析阶段使用的模型，默认 biangfeng-gateway/deepseek-v4.1-flash-official（传空字符串则用会话默认模型）
//   concurrency   并发上限，默认 8（运行时钳制到 16）

export const meta = {
  id: 'game-prd-check',
  name: 'game_prd_check',
  description: '对照规则基准检查游戏 PRD 文档的完整性、一致性与逻辑正确性，生成结构化问题报告',
  phases: [
    { title: '扫描' },
    { title: '规则检查' },
    { title: '一致性检查' },
    { title: '汇总去重' },
    { title: '生成报告' },
    { title: '报告审核' },
  ],
}

const A = args || {}
const inputDir = A.inputDir || 'input'
const rulesDir = A.rulesDir || '.claude/skills/game-prd-check/references/rules'
const templatePath =
  A.templatePath || '.claude/skills/game-prd-check/references/templates/report.template.md'
const outPath = A.outPath || 'examples/game-prd-check/report.md'
const checkDate = A.date || '未提供（调用时请传 args.date，格式 YYYY-MM-DD）'
const maxIssuesPerGroup = A.maxIssuesPerGroup || 20

// 分析阶段（扫描 / 规则检查 / 一致性检查 / 去重）统一用快速模型，报告撰写与质检仍用会话默认模型
const analysisModel =
  A.analysisModel === undefined ? 'biangfeng-gateway/deepseek-v4.1-flash-official' : A.analysisModel
const analysisAgentOptions = analysisModel
  ? { model: analysisModel, timeoutMs: 3600000 }
  : { timeoutMs: 3600000 }

// 规则分组检查与一致性检查并发执行，默认放到 8 路；网关限流时可传 args.concurrency 调小
setConcurrency(A.concurrency || 8)

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
    problem: { type: 'string', description: '问题说明，指出违反了哪条规则基准或哪里矛盾' },
    impact: { type: 'string', description: '对开发 / 测试 / 验收的具体影响' },
    suggestion: { type: 'string', description: '具体可执行的补充或修正建议' },
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
        },
        required: ['title', 'files'],
      },
    },
  },
  required: ['inputFiles', 'ruleGroups'],
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
    '3. 不臆造：需求文档确实没写才算 MISSING；写了但含糊才是 AMBIGUOUS / INCOMPLETE。',
    '4. 不重复：同一问题只记一条，多处证据合并写进同一条的 location。',
    '5. 只报本范围规则能支撑的问题，不要越界检查别的模块。',
    '6. 按优先级从高到低自检一遍，最多输出 ' + maxIssuesPerGroup + ' 条最有价值的问题。',
    '7. 只输出结构化结果，不要输出报告正文。',
  ].join('\n')
}

phase('扫描')

const scan = await agent(
  [
    '你是 PRD 检查流程的扫描器，工作目录为项目根目录。',
    '',
    '任务：只做清单扫描，不读正文做判断。',
    '1. 列出需求文档目录 ' + inputDir + ' 下所有 Markdown 文档，返回相对项目根目录的路径（不含规则目录里的文件）。',
    '2. 遍历规则基准目录 ' + rulesDir + '，把规则文件按主题分成 5~8 组，每组给出 title、focus、files。',
    '   - files 必须是相对项目根目录的完整路径，组内文件要覆盖到每一份规则文档，不能漏。',
    '   - 规则按业务流程分章时，按阶段分组（例如 开局与发牌 / 摸打吃碰杠 / 结算与分数 / 配置与做牌 / 重连 / 广播与数据）。',
    '   - 总览、目录、索引类文件放进第一组；规则目录下独立的大文件规则文档单独成组。',
    '   - focus 用一句话说明这组规则管什么，便于后续检查员聚焦。',
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

phase('规则检查')

const groupTasks = parallel(
  ruleGroups.map((group) => () =>
    agent(
      [
        '你是资深游戏 PRD 审核员，正在对照规则基准检查需求文档。',
        '',
        '需求文档（务必全文逐段读完，文件较大可分多次读取）：',
        inputList,
        '',
        '本次负责的规则范围：' + group.title,
        '范围聚焦：' + (group.focus || '该组全部规则'),
        '规则文件（逐个读完）：',
        (group.files || []).map((f) => '- ' + f).join('\n'),
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
  )
)

phase('一致性检查')

const internalTask = agent(
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
const internalResult = await internalTask

phase('汇总去重')

const allIssues = []
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

if (allIssues.length > 0) {
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

  const dropped = new Set()
  const groups = (dedup && dedup.duplicateGroups) || []
  for (const g of groups) {
    if (!Array.isArray(g) || g.length < 2) continue
    const idxs = g.filter((n) => Number.isInteger(n) && n >= 0 && n < allIssues.length)
    if (idxs.length < 2) continue
    const keep = allIssues[idxs[0]]
    for (const idx of idxs.slice(1)) {
      if (dropped.has(idx) || idx === idxs[0]) continue
      dropped.add(idx)
      const loc = allIssues[idx].location
      if (loc && String(keep.location || '').indexOf(loc) < 0) {
        keep.location = (keep.location ? keep.location + '、' : '') + loc
      }
    }
  }
  for (let i = allIssues.length - 1; i >= 0; i--) {
    if (dropped.has(i)) allIssues.splice(i, 1)
  }
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
  }
})

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

phase('生成报告')

const writeResult = await agent(
  [
    '你是 PRD 检查报告撰写员。把下面的检查结果写成正式报告并落盘。',
    '',
    '报告模板（先读一遍，严格按它的四段结构）：' + templatePath,
    '输出路径（唯一交付物）：' + outPath,
    '',
    '报告头部信息：',
    '- 检查对象：' + inputFiles.join('、'),
    '- 规则基准：' + rulesDir,
    '- 检查日期：' + checkDate,
    '',
    '统计（必须原样使用，不得自行改数）：',
    JSON.stringify({ 统计: stats, 类型分布: typeStats, 模块分布: moduleRank }, null, 1),
    '',
    '问题清单（JSON，id 已编号，不要新增、删除或改写 id）：',
    JSON.stringify(issues, null, 1),
    '',
    '写作要求：',
    '1. 严格四段结构：1 检查概览（统计表） -> 2 问题清单（表格：ID | 类型 | 优先级 | 问题 | 原文位置 | 建议） -> 3 重点问题详情 -> 4 总体建议。',
    '2. 第 2 段必须列出全部问题，一条不漏，顺序与 JSON 一致；建议列取每条 suggestion 的精简版。',
    '3. 第 3 段：P0、P1 全部展开，再从 P2 中挑 3~5 条典型问题展开；每条按 原文（引用 quote 并标注 location）、问题、影响、建议、处理状态（默认 待确认）书写。',
    '4. 第 4 段：问题最多的模块取模块分布第一名，影响开发的问题列出 P0/P1 的 ID，是否建议进入下一阶段按“存在 P0 或 P1 数量较多则暂缓，否则建议”给出结论与理由。',
    '5. 只能使用上面 JSON 中的事实，不得编造原文引文或新增问题；引文必须来自 quote 字段。',
    '6. 使用 write 工具写入 ' + outPath + '，UTF-8 中文，不使用 Emoji。',
    '7. 完成后返回文件路径与写入的问题总条数。',
  ].join('\n'),
  { label: '撰写报告 ' + outPath, agentType: 'general', timeoutMs: 3600000 }
)

phase('报告审核')

const review = await agent(
  [
    '你是报告质检员。审核 PRD 检查报告是否符合模板与硬性要求。',
    '',
    '报告文件：' + outPath,
    '报告模板：' + templatePath,
    '期望问题总数：' + stats.total + '（P0 ' + stats.P0 + ' / P1 ' + stats.P1 + ' / P2 ' + stats.P2 + ' / P3 ' + stats.P3 + '）',
    '',
    '逐项检查并输出问题列表：',
    '1. 是否包含四段结构，标题与模板一致；',
    '2. 检查对象、规则基准、检查日期是否已填写（不能留占位符）；',
    '3. 概览统计数字是否与期望总数和优先级分布一致；',
    '4. 问题清单行数是否等于期望总数，ID 是否从 PRD-001 连续编号无跳号；',
    '5. 类型是否只用五种、优先级是否只用四级；',
    '6. 每条清单项是否都有原文位置与建议；重点问题详情是否有原文引文且不少于 3 条；',
    '7. 是否存在明显编造内容（引文与清单对不上、凭空新增问题）。',
    '',
    '全部通过返回 ok=true、problems 为空数组；有问题则 ok=false 并逐条写清问题与位置。',
  ].join('\n'),
  { label: '审核报告', schema: REVIEW_SCHEMA, timeoutMs: 1800000 }
)

let fixed = false
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
      JSON.stringify(issues, null, 1),
      '',
      '修改完成后返回修改摘要。',
    ].join('\n'),
    { label: '修正报告', agentType: 'general', timeoutMs: 1800000 }
  )
  fixed = true
}

await check(() => fileExists(outPath), '报告文件未生成：' + outPath)

return {
  reportPath: outPath,
  inputFiles: inputFiles,
  ruleGroups: ruleGroups.map((g) => ({ title: g.title, fileCount: (g.files || []).length })),
  stats: stats,
  typeStats: typeStats,
  moduleRank: moduleRank,
  reviewOk: review ? review.ok === true || fixed : false,
  reportWriteSummary: writeResult,
}
