// Bug Coverage Check Workflow
//
// 用途：把 bugs/buglist 里的历史缺陷逐条对照目标 PRD，判断 PRD 是否缺失对应需求。
//   1. 扫描缺陷清单与 PRD 目录
//   2. 按模块分组分批并行审核（每条缺陷给出 PASS / PARTIAL / MISSING / NOT_APPLICABLE / INSUFFICIENT）
//      - 非好友房缺陷（金币场、大厅、登录、订阅等）与杭州麻将不存在的玩法环节直接 NOT_APPLICABLE，等同 pass
//   3. 缺口去重与编号（PRD-001 起）
//   4. 分片并行撰写 report.md（概览 / 问题清单 / 重点详情 / 总体建议 / 附录判定表）
//   5. 质量档可选报告质检
//   6. 复用 game-prd-check 的 build-dashboard.mjs 生成离线 HTML 报告
//
// 用户选择（生成前问询）：
//   档位：速度优先（默认 fast=true，跳过报告质检；传 args.fast=false 切质量档）
//   模型：分析用 biangfeng-gateway/deepseek-v4.1-flash-official，写作/质检用会话默认模型
//   并发：16（16 批一波跑完）
//
// 可选 args：
//   bugDir        缺陷目录，默认 bugs/buglist
//   prdPath       目标 PRD，默认 input/【杭州麻将】核心流程杭州麻将好友房AI.md
//   prdFiles      指定 PRD 路径数组（给定时覆盖 prdPath）
//   outDir        产物目录，默认 examples/bug-check-workflow
//   date          检查日期（YYYY-MM-DD）；脚本内禁止取当前时间，需由调用方传入
//   batchSize     每批缺陷数，默认 15
//   maxDetailP2   详情区最多展开的 P2 条数，默认 5
//   analysisModel 分析阶段模型，默认 biangfeng-gateway/deepseek-v4.1-flash-official（传空串用会话默认）
//   reviewModel   质检模型，默认同 analysisModel（传空串用会话默认）
//   concurrency   并发上限，默认 16（运行时钳制到 16）
//   fast          默认 true：跳过报告质检
//   skipReview    显式覆盖质检开关（false 强制质检）
//   dashboard     生成 HTML Dashboard，默认 true
//   dashboardScript Dashboard 生成脚本，默认 .claude/skills/game-prd-check/scripts/build-dashboard.mjs
//   autoPassModules 直接判 NOT_APPLICABLE 的模块名数组，默认空（完全由审核员判断）

export const meta = {
  id: 'bug-coverage-check',
  name: 'bug_coverage_check',
  description: '对照 buglist 检查 PRD 需求缺失，非好友房缺陷直接 pass，输出 report.md 与 HTML 报告',
  phases: [
    { title: '扫描' },
    { title: '缺陷审核' },
    { title: '缺口去重' },
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

// 注意：P0 的序号是 0，不能用 `|| 兜底`，否则 P0 会被排到最后
const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 }

function priorityIndex(p) {
  return PRIORITY_ORDER[p] === undefined ? 9 : PRIORITY_ORDER[p]
}

const VERDICT_RULE = [
  '五类判定（每条缺陷必须选一个）：',
  'PASS：属于好友房范围，且 PRD 已有明确需求覆盖该场景（必须给出 PRD 章节标题与原文片段）。',
  'PARTIAL：属于好友房范围，PRD 提到该环节但缺少关键内容（分支、超时、异常、UI 细则、数值、来源标识等），需列出缺什么。',
  'MISSING：属于好友房范围，PRD 完全没有该场景的需求描述。',
  'NOT_APPLICABLE：非好友房范围（金币场、大厅、登录、订阅、小程序/浮窗、音效、平台适配等），或属于卡五星等其它玩法专有而杭州麻将不存在该环节（注明玩法差异）；相当于直接 pass。',
  'INSUFFICIENT：缺陷只有截图，标题与描述不足以判断，只能按 PASS 处理并注明“仅图片信息”；禁止凭图片臆测。',
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
    prdRef: { type: 'string', description: 'PRD 章节标题定位，多处用、分隔；非缺口填“无”' },
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

const BATCH_SCHEMA = {
  type: 'object',
  properties: {
    bugs: { type: 'array', items: BUG_VERDICT_SCHEMA },
    summary: { type: 'string', description: '本批覆盖情况与不确定点' },
  },
  required: ['bugs'],
}

const SCAN_SCHEMA = {
  type: 'object',
  properties: {
    bugs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '相对项目根目录的缺陷文件路径' },
          title: { type: 'string' },
          module: {
            type: 'string',
            description: '文件名第二层【】标签；没有标签时按标题关键词归类（结算 / 创房 / 亮牌 / 行牌 / 桌面 / 流程 / 其他）',
          },
        },
        required: ['path', 'title', 'module'],
      },
    },
    prdOutline: { type: 'string', description: 'PRD 一级到三级标题清单，每行“行号 标题”' },
  },
  required: ['bugs', 'prdOutline'],
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
    '1. 证据先行：PASS 与 PARTIAL 必须引用 PRD 章节标题与原文片段，禁止凭印象判定。',
    '2. MISSING 必须写明已检索的 PRD 章节范围，确认没有等价或相反描述才能判缺失。',
    '3. 同类合并：同一批内多条缺陷指向同一需求缺口时，每条仍输出自己的判定，但 gapTitle / gap / suggestion 写成同一条，便于后续合并统计。',
    '4. 不臆测：缺陷图片在当前环境无法读取，禁止根据图片文件名或猜测补充信息；标题与描述都没有的信息不得编造。',
    '5. NOT_APPLICABLE 要克制：只有明显属于其它模块或其它玩法专有环节时才判；拿不准时按好友房处理，并在 reason 写明不确定点。',
    '6. suggestion 要可直接落地：写清触发条件、处理方式、UI 表现与异常兜底，不要说“补充一下”这类空话。',
    '7. 只输出结构化结果，不要输出报告正文。',
  ].join('\n')
}

function bugLine(b) {
  return '- ' + b.path + '（缺陷 ' + b.bugId + '｜模块 ' + b.module + '）'
}

function compactKey(s) {
  return String(s || '')
    .replace(/[\s\p{P}\p{S}]/gu, '')
    .toLowerCase()
}

// 按模块分桶后切成固定容量批次，再把小批次并入相邻批次，保证同一波并发跑完
function buildBatches(bugs, capacity) {
  const order = []
  const buckets = {}
  for (const b of bugs) {
    const m = b.module || '其他'
    if (!buckets[m]) {
      buckets[m] = []
      order.push(m)
    }
    buckets[m].push(b)
  }
  const chunks = []
  for (const m of order) {
    const list = buckets[m]
    for (let i = 0; i < list.length; i += capacity) {
      chunks.push({ title: m, files: list.slice(i, i + capacity) })
    }
  }
  const batches = []
  for (const c of chunks) {
    const last = batches[batches.length - 1]
    const mergeThreshold = Math.floor(capacity / 3)
    if (last && c.files.length <= mergeThreshold && last.files.length + c.files.length <= capacity) {
      last.files = last.files.concat(c.files)
      if (last.title.indexOf(c.title) < 0) last.title = last.title + '、' + c.title
      continue
    }
    batches.push({ title: c.title, files: c.files.slice() })
  }
  return batches
}

function bugIdOf(path) {
  const name = String(path || '').split(/[\\/]/).pop() || ''
  const m = name.match(/^(\d+)/)
  return m ? m[1] : name
}

phase('扫描')

const scan = await agent(
  [
    '你是缺陷清单扫描器，工作目录为项目根目录。只做清单扫描，不读缺陷正文做判断。',
    '',
    '任务：',
    '1. 用 glob 或 Get-ChildItem 列出缺陷目录 ' + bugDir + ' 下所有 .md 文件（不含 attachments、_batch.log），返回相对项目根目录的路径、标题（去掉文件名前缀数字与 .md）与模块。',
    '   模块取文件名第二层【】标签；没有第二层标签时按标题关键词归类为：结算 / 创房 / 亮牌 / 行牌 / 桌面 / 流程 / 其他。',
    '2. 用 grep 匹配 "^#{1,3} " 或 Get-Content 过滤，给出 PRD 的章节大纲（一级到三级标题，每行“行号 标题”），PRD 路径：' + prdFiles.join('、'),
    '3. 输出必须覆盖全部缺陷文件，一条不漏，不要合并文件。',
  ].join('\n'),
  { label: '扫描缺陷与 PRD 大纲', schema: SCAN_SCHEMA, ...analysisAgentOptions, timeoutMs: 900000 }
)

if (!scan || !Array.isArray(scan.bugs) || scan.bugs.length === 0) {
  throw new Error('扫描阶段失败：未取得缺陷清单，请检查目录 ' + bugDir)
}

const allBugs = scan.bugs.map((b) => ({
  path: b.path,
  title: b.title || '',
  module: b.module || '其他',
  bugId: bugIdOf(b.path),
}))
const prdOutline = scan.prdOutline || ''
const prdBrief = prdFiles.map((f) => '- ' + f).join('\n')

let prePassBugs = []
if (autoPassModules.length > 0) {
  const kept = []
  for (const b of allBugs) {
    if (autoPassModules.indexOf(b.module) >= 0) prePassBugs.push(b)
    else kept.push(b)
  }
  if (prePassBugs.length > 0) log('按 args.autoPassModules 直接 pass ' + prePassBugs.length + ' 条缺陷')
  allBugs.splice.apply(allBugs, [0, allBugs.length].concat(kept))
}

const batches = buildBatches(allBugs, batchSize)
log('缺陷共 ' + allBugs.length + ' 条，分 ' + batches.length + ' 批审核')

phase('缺陷审核')

const batchTasks = parallel(
  batches.map((batch) => () =>
    agent(
      [
        '你是资深游戏 QA 与 PRD 审核员，正在核对缺陷清单里的问题在目标 PRD 中是否有对应需求。',
        '',
        '目标 PRD（务必完整读完，长行被截断时分段读取，不要只读开头）：',
        prdBrief,
        '',
        'PRD 章节大纲（便于定位与引用）：',
        prdOutline || '（未取得大纲，请自行 grep 章节标题）',
        '',
        '本批缺陷（逐条读取下列 Markdown 文件；只读文字，不要尝试读图片）：',
        batch.files.map(bugLine).join('\n'),
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
      ].join('\n'),
      { label: '审核 ' + batch.title, schema: BATCH_SCHEMA, ...analysisAgentOptions, retries: 1 }
    )
  )
)

const batchResults = await batchTasks

let verdicts = []
let failedBatches = 0
for (const r of batchResults || []) {
  if (!r || !Array.isArray(r.bugs)) {
    failedBatches += 1
    continue
  }
  for (const v of r.bugs) verdicts.push(v)
}
if (failedBatches > 0) log('有 ' + failedBatches + ' 个批次审核失败，报告仅覆盖成功批次')

for (const b of prePassBugs) {
  verdicts.push({
    bugId: b.bugId,
    title: b.title,
    module: b.module,
    scope: '非好友房',
    verdict: 'NOT_APPLICABLE',
    prdRef: '无',
    prdQuote: '无',
    reason: '按 args.autoPassModules 直接 pass',
    gapTitle: '无',
    gap: '无',
    impact: '无',
    suggestion: '无',
    priority: '不适用',
    acceptance: '无',
  })
}

// 兜底补齐：扫描到但审核未返回的缺陷按信息不足登记，保证 223 条都有判定
const seenIds = {}
for (const v of verdicts) seenIds[String(v.bugId)] = true
let missingVerdict = 0
for (const b of allBugs) {
  if (seenIds[String(b.bugId)]) continue
  missingVerdict += 1
  verdicts.push({
    bugId: b.bugId,
    title: b.title,
    module: b.module,
    scope: '无法判断',
    verdict: 'INSUFFICIENT',
    prdRef: '无',
    prdQuote: '无',
    reason: '审核未返回该条判定，按信息不足登记',
    gapTitle: '无',
    gap: '无',
    impact: '无',
    suggestion: '无',
    priority: '不适用',
    acceptance: '无',
  })
}
if (missingVerdict > 0) log('有 ' + missingVerdict + ' 条缺陷未返回判定，已按信息不足登记')

const VERDICT_LABELS = {
  PASS: 'PRD 已覆盖',
  PARTIAL: 'PRD 部分覆盖',
  MISSING: 'PRD 未覆盖',
  NOT_APPLICABLE: '直接 pass',
  INSUFFICIENT: '信息不足',
}

// 按缺陷编号排序，保证报告与附录稳定
verdicts.sort((a, b) => String(a.bugId).localeCompare(String(b.bugId)))

const verdictStats = { PASS: 0, PARTIAL: 0, MISSING: 0, NOT_APPLICABLE: 0, INSUFFICIENT: 0 }
for (const v of verdicts) {
  if (verdictStats[v.verdict] === undefined) verdictStats[v.verdict] = 0
  verdictStats[v.verdict] += 1
}

phase('缺口去重')

const PRIORITY_SET = { P0: true, P1: true, P2: true, P3: true }
let gaps = []
for (const v of verdicts) {
  if (v.verdict !== 'MISSING' && v.verdict !== 'PARTIAL') continue
  gaps.push({
    kind: v.verdict,
    kindLabel: v.verdict === 'MISSING' ? '需求缺失' : '描述不完整',
    bugIds: [v.bugId],
    bugTitles: [v.title],
    module: v.module || '未分类',
    gapTitle: v.gapTitle && v.gapTitle !== '无' ? v.gapTitle : v.title,
    prdRef: v.prdRef && v.prdRef !== '无' ? v.prdRef : 'PRD 未覆盖',
    prdQuote: v.prdQuote && v.prdQuote !== '无' ? v.prdQuote : '',
    gap: v.gap && v.gap !== '无' ? v.gap : v.reason,
    impact: v.impact && v.impact !== '无' ? v.impact : '',
    suggestion: v.suggestion && v.suggestion !== '无' ? v.suggestion : '',
    priority: PRIORITY_SET[v.priority] ? v.priority : 'P2',
    acceptance: v.acceptance && v.acceptance !== '无' ? v.acceptance : '',
  })
}

// 同一需求缺口可能被多条缺陷命中：数量多时用归并代理，数量少时用确定性去重
if (gaps.length > 12) {
  const compact = gaps.map((g, i) => ({
    i: i,
    module: g.module,
    title: g.gapTitle,
    prdRef: g.prdRef,
  }))
  const dedup = await agent(
    [
      '你是需求缺口合并员。下面是 PRD 缺失需求点的索引（i 为下标）：',
      JSON.stringify(compact, null, 1),
      '',
      '任务：找出指向同一需求缺口的重复条目（标题不同但要求补的是同一处内容也算重复）。',
      '只输出 duplicateGroups，每个子数组是同一条缺口的索引，第一个为保留项；不要把不同缺口合并，没有重复就返回空数组。',
    ].join('\n'),
    { label: '缺口归并', schema: DEDUP_SCHEMA, ...analysisAgentOptions, timeoutMs: 1800000 }
  )
  const removed = {}
  for (const group of (dedup && dedup.duplicateGroups) || []) {
    if (!Array.isArray(group) || group.length < 2) continue
    const idxs = group.filter((n) => Number.isInteger(n) && n >= 0 && n < gaps.length)
    if (idxs.length < 2) continue
    const keep = gaps[idxs[0]]
    if (removed[idxs[0]]) continue
    for (const idx of idxs.slice(1)) {
      if (removed[idx] || idx === idxs[0]) continue
      const dup = gaps[idx]
      keep.bugIds = keep.bugIds.concat(dup.bugIds)
      keep.bugTitles = keep.bugTitles.concat(dup.bugTitles)
      if (dup.prdRef && keep.prdRef.indexOf(dup.prdRef) < 0) {
        keep.prdRef = keep.prdRef + '、' + dup.prdRef
      }
      if (dup.kind === 'MISSING') {
        keep.kind = 'MISSING'
        keep.kindLabel = '需求缺失'
      }
      if (priorityIndex(dup.priority) < priorityIndex(keep.priority)) {
        keep.priority = dup.priority
      }
      removed[idx] = true
    }
  }
  gaps = gaps.filter((g, i) => !removed[i])
} else if (gaps.length > 0) {
  const seen = {}
  const kept = []
  for (const g of gaps) {
    const key = compactKey(g.module) + '|' + compactKey(g.prdRef) + '|' + compactKey(g.gapTitle).slice(0, 12)
    if (seen[key]) {
      const keep = seen[key]
      keep.bugIds = keep.bugIds.concat(g.bugIds)
      keep.bugTitles = keep.bugTitles.concat(g.bugTitles)
      if (g.kind === 'MISSING') keep.kind = 'MISSING'
      continue
    }
    seen[key] = g
    kept.push(g)
  }
  gaps = kept
}

gaps.sort((a, b) => {
  const p = priorityIndex(a.priority) - priorityIndex(b.priority)
  if (p !== 0) return p
  return String(a.module).localeCompare(String(b.module))
})

const issueRows = gaps.map((g, i) => {
  const id = 'PRD-' + String(i + 1).padStart(3, '0')
  return {
    id: id,
    kind: g.kind,
    kindLabel: g.kindLabel,
    topic: g.module,
    priority: g.priority,
    title: g.gapTitle,
    location: g.prdRef,
    quote: g.prdQuote,
    gap: g.gap,
    impact: g.impact,
    suggestion: g.suggestion,
    acceptance: g.acceptance,
    bugIds: g.bugIds,
    bugTitles: g.bugTitles,
  }
})

const priorityStats = { P0: 0, P1: 0, P2: 0, P3: 0 }
for (const it of issueRows) priorityStats[it.priority] += 1

const moduleStats = {}
for (const it of issueRows) moduleStats[it.topic] = (moduleStats[it.topic] || 0) + 1
const moduleRank = Object.keys(moduleStats)
  .map((name) => ({ name: name, count: moduleStats[name] }))
  .sort((a, b) => b.count - a.count)

log(
  '缺口汇总：' + issueRows.length + ' 条（P0 ' + priorityStats.P0 + ' / P1 ' + priorityStats.P1
    + ' / P2 ' + priorityStats.P2 + ' / P3 ' + priorityStats.P3 + '），判定分布 '
    + '已覆盖 ' + verdictStats.PASS + ' / 部分覆盖 ' + verdictStats.PARTIAL
    + ' / 未覆盖 ' + verdictStats.MISSING + ' / pass ' + verdictStats.NOT_APPLICABLE
    + ' / 信息不足 ' + verdictStats.INSUFFICIENT
)

phase('生成报告')

const tableRows = issueRows.map((it) => ({
  id: it.id,
  topic: it.topic,
  priority: it.priority,
  title: it.title,
  location: it.location,
  suggestion: it.suggestion,
}))

const detailIssues = issueRows
  .filter((it) => it.priority === 'P0' || it.priority === 'P1')
  .concat(issueRows.filter((it) => it.priority === 'P2').slice(0, maxDetailP2))
  .map((it) => ({
    id: it.id,
    topic: it.topic,
    priority: it.priority,
    kindLabel: it.kindLabel,
    title: it.title,
    location: it.location,
    quote: it.quote,
    gap: it.gap,
    impact: it.impact,
    suggestion: it.suggestion,
    acceptance: it.acceptance,
    bugIds: it.bugIds,
    bugTitles: it.bugTitles,
  }))

const appendixRows = verdicts.map((v) => ({
  bugId: v.bugId,
  module: v.module,
  verdict: VERDICT_LABELS[v.verdict] || v.verdict,
  location: v.prdRef === '无' ? '无' : v.prdRef,
  reason: v.reason,
}))

const scopeText =
  '仅好友房相关缺陷；非好友房与杭州麻将不存在的玩法环节直接 pass（不计入问题清单）'

const overviewData = {
  缺陷总数: verdicts.length,
  判定分布: verdictStats,
  发现缺口总数: issueRows.length,
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
        '缺陷来源：' + bugDir + '（共 ' + verdicts.length + ' 条）',
        '检查日期：' + checkDate,
        '',
        '统计（必须原样使用，不得自行改数）：',
        JSON.stringify(overviewData, null, 1),
        '',
        '问题清单表格数据（全部缺口，id 已编号，不得增删或改写 id）：',
        JSON.stringify(tableRows, null, 1),
        '',
        '写作要求：',
        '1. 文件依次为：标题与头部信息、## 1. 检查概览、## 2. 问题清单（PRD 缺失需求点）。',
        '2. 第 1 段先写主统计表，表头必须是 | 指标 | 数量 |，并严格包含这些固定行（数字与统计一致）：发现问题总数（取发现缺口总数）、严重问题 P0、高优先级 P1、一般问题 P2、优化建议 P3。',
        '3. 主统计表之后补一节“缺陷判定分布”，列出 缺陷总数、PRD 已覆盖、PRD 部分覆盖、PRD 未覆盖、直接 pass（非好友房或玩法不适用）、信息不足 六行数量。',
        '4. 再补一节“模块分布”表格：| 模块 | 缺口数 |。',
        '5. 第 2 段标题固定为 ## 2. 问题清单（PRD 缺失需求点），表头固定为 | ID | 主题 | 优先级 | 问题 | 原文位置 | 建议 |，列出全部缺口，一条不漏，顺序与数据一致；建议列取 suggestion 的精简版（不超过 60 字）。',
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
        '缺口详情数据（只展开这些条目，按给定顺序）：',
        JSON.stringify(detailIssues, null, 1),
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
        '缺口索引（用于总体建议引用）：',
        JSON.stringify(
          issueRows.map((it) => ({ id: it.id, topic: it.topic, priority: it.priority, title: it.title })),
          null,
          1
        ),
        '',
        '全部缺陷判定表数据（' + appendixRows.length + ' 条，按缺陷号升序，必须全部列出）：',
        JSON.stringify(appendixRows),
        '',
        '写作要求：',
        '1. 文件第一行必须是 ## 4. 总体建议。',
        '2. 用三个要点书写，格式为“- **要点名**：内容”：',
        '   - **缺口最集中的模块**：模块分布第一名，写模块名与条数，并列出对应 PRD ID。',
        '   - **可能影响开发的问题**：从 P0/P1 中挑影响最大的若干条，附 ID 与理由；如涉及结算/计分/资产，注明可能导致资损或结算错误。',
        '   - **是否建议进入下一阶段规格生成**：存在 P0 或 P1 数量较多时写“暂缓”，否则写“建议”，并给出理由。',
        '3. 然后写附录：## 附录：全部缺陷判定表，表头固定为 | 缺陷ID | 模块 | 判定 | PRD 位置 | 判定依据 |，把给定数据一条不漏地列成表格行，判定依据取 reason 原文，顺序与数据一致。',
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

const mergeResult = await agent(
  [
    '把三个报告分片按顺序合并成一个文件，并清理临时文件。',
    '分片 1：' + part1Path,
    '分片 2：' + part2Path,
    '分片 3：' + part3Path,
    '目标文件：' + outPath,
    '',
    '在项目根目录一次执行下面的命令（用 node 合并，避免 PowerShell 5.1 写入 UTF-8 BOM）：',
    'node -e "const fs=require(\'fs\');const ps=[\'' +
      part1Path +
      '\',\'' +
      part2Path +
      '\',\'' +
      part3Path +
      '\'];fs.writeFileSync(\'' +
      outPath +
      '\',ps.map(p=>fs.readFileSync(p,\'utf8\')).join(\'\\n\\n\'),\'utf8\');ps.forEach(p=>fs.unlinkSync(p))"',
    '',
    '续跑（resume）时三个分片可能已被上一次运行删除：若三个分片都不存在且目标文件 ' + outPath + ' 已存在，',
    '则不要重新合并，直接进入下面的乱码检查与修复步骤，保留现有目标文件。',
    '只有命令执行失败时，才自行读取三个分片并用 write 合并（分片之间空一行）。',
    '合并后必须做乱码检查：用 Select-String 或 node 检查目标文件是否含替换字符 U+FFFD（显示为“�”）；',
    '若有，逐处读取上下文，用 edit 工具只把这几处字符修正为原文正确汉字（常见为“好友房”“亮牌”“结算”等），不要重写整篇报告；',
    '修正后再次确认文件内 U+FFFD 数量为 0。',
    '最终返回：合并是否成功、文件行数与字节数、修复的乱码处数（没有则写 0）。',
    '只操作指定的输出文件，不要执行 git 命令、不要提交或推送、不要改动其他文件。',
  ].join('\n'),
  { label: '合并报告分片', agentType: 'general', timeoutMs: 900000 }
)

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
      '期望缺口总数：' + issueRows.length + '（P0 ' + priorityStats.P0 + ' / P1 ' + priorityStats.P1 + ' / P2 ' + priorityStats.P2 + ' / P3 ' + priorityStats.P3 + '）',
      '期望缺陷总数：' + verdicts.length,
      '期望判定分布：已覆盖 ' + verdictStats.PASS + '、部分覆盖 ' + verdictStats.PARTIAL + '、未覆盖 ' + verdictStats.MISSING
        + '、直接 pass ' + verdictStats.NOT_APPLICABLE + '、信息不足 ' + verdictStats.INSUFFICIENT,
      '期望详情条数：' + detailIssues.length,
      '',
      '逐项检查并输出问题列表：',
      '1. 是否有固定四段结构（1 检查概览、2 问题清单、3 重点问题详情、4 总体建议）与附录判定表；',
      '2. 头部是否填好检查对象、检查范围、缺陷来源、检查日期，不能留占位符；',
      '3. 概览统计中 P0/P1/P2/P3 与缺口总数是否与期望一致，判定分布是否与期望一致；',
      '4. 问题清单行数是否等于缺口总数，ID 是否从 PRD-001 连续编号无跳号；表头是否为固定 6 列；',
      '5. 详情块 ID 是否都在清单内，每条是否有原文位置、问题、影响、建议、验收口径，是否出现数据里没有的缺口；',
      '6. 附录判定表行数是否等于缺陷总数，判定是否只用“PRD 已覆盖/PRD 部分覆盖/PRD 未覆盖/直接 pass/信息不足”五种；',
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
        '修正要求：只按质检意见修改报告，事实与统计不变（缺口 ' + issueRows.length + ' 条，P0 ' + priorityStats.P0
          + '，P1 ' + priorityStats.P1 + '，P2 ' + priorityStats.P2 + '，P3 ' + priorityStats.P3
          + '；缺陷总数 ' + verdicts.length + '），不得新增或删除条目。',
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
  bugTotal: verdicts.length,
  verdictStats: verdictStats,
  gapTotal: issueRows.length,
  priorityStats: priorityStats,
  moduleRank: moduleRank,
  batchCount: batches.length,
  failedBatches: failedBatches,
  fastMode: fastMode,
  reviewSkipped: skipReview,
  reviewOk: skipReview ? null : review ? review.ok === true || fixed : false,
  mergeSummary: mergeResult,
}
