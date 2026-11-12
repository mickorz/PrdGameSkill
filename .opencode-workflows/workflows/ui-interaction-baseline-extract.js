// UI Interaction Baseline Extract Workflow
//
// 由 ui-interaction-prd-extract.js 的 extract 段拆分而来（2026-11-11 拆分）：
//   基准提取独立成 workflow，产物直接固化到 skill 目录
//   .claude/skills/ui-interaction-prd-extract/references/rules/{rulesName}/，
//   ui-interaction-prd-extract.js（检查 workflow）只读取该目录做对照检查，不再重复提取。
//
// 流程：
//   [扫描代码与FGUI] 列 42319 代码文件与 FGUI 包，按预置主题分组
//   [逆向提取]       按 UI 主题并行逆向提取，写规则基准文件
//   [基准说明]       生成 00-基准说明.md
//
// 用户选择（拆分决策）：
//   基准统一固化到 skill 目录（不再写 examples 产物目录）；
//   代码没变时不要重跑本 workflow，检查路直接复用已有基准。
//
// 可选 args：
//   clientDir       客户端代码根目录，默认 input-ui/xuanwulobby/assets/42319
//   fguiDir         FGUI 工程目录，默认 input-ui/kawuxing-fgui
//   rulesName       规则基准子目录名，默认 hzmj_ui_interaction
//   rulesDir        直接指定基准输出目录（覆盖默认推导的 skill 目录）
//   date            提取日期 YYYY-MM-DD（脚本内禁止取当前时间，需由调用方传入）
//   themes          自定义提取主题数组 [{ title, focus }]，默认 8 个预置主题
//   analysisModel   提取/扫描模型，默认 biangfeng-gateway/deepseek-v4.1-flash-official（传空串用会话默认）
//   concurrency     并发上限，默认 16（运行时钳制到 16）
//
// 返回：
//   { rulesDir, baseDocPath, ruleFiles[], clauseTotal, clientFiles, themes[] }

export const meta = {
  id: 'ui-interaction-baseline-extract',
  name: 'ui_interaction_baseline_extract',
  description: '从 Cocos + FairyGUI 客户端代码逆向提取 UI 交互基准，固化到 skill 的 references/rules 目录供检查 workflow 复用',
  phases: [
    { title: '扫描代码与FGUI' },
    { title: '逆向提取' },
    { title: '基准说明' },
  ],
}

const A = args || {}

const clientDir = A.clientDir || 'input-ui/xuanwulobby/assets/42319'
const fguiDir = A.fguiDir || 'input-ui/kawuxing-fgui'
const rulesName = A.rulesName || 'hzmj_ui_interaction'
// 基准统一固化到 skill 目录（检查 workflow 默认从这里读取）
const rulesDir = A.rulesDir || '.claude/skills/ui-interaction-prd-extract/references/rules/' + rulesName
const checkDate = A.date || '未提供（调用时请传 args.date，格式 YYYY-MM-DD）'

const analysisModel =
  A.analysisModel === undefined ? 'biangfeng-gateway/deepseek-v4.1-flash-official' : A.analysisModel
const analysisAgentOptions = analysisModel
  ? { model: analysisModel, timeoutMs: 3600000 }
  : { timeoutMs: 3600000 }

setConcurrency(A.concurrency || 16)

const DEFAULT_THEMES = [
  {
    title: '操作按钮与权限',
    focus: 'layer/ 主界面按钮、权限位定义、手牌交互、置灰、操作区开合',
  },
  {
    title: '听牌提示',
    focus: '查听/打听、听牌列表弹窗、听牌箭头、听牌按钮显隐、提牌联动',
  },
  {
    title: '结算链与胡牌展示',
    focus: '局终动画链、小/大结算、摊牌、飘分、番型动画、流局',
  },
  {
    title: '断线重连与场景恢复',
    focus: 'RecoverCmd/sceneCmd、恢复顺序、end_wait 应答、托管态重连',
  },
  {
    title: '托管与超时',
    focus: 'bot/auto 相关、超时提示、DelayCall 兜底、托管遮罩与惩罚提醒',
  },
  {
    title: '界面清单与弹层生命周期',
    focus: '@FguiView 定义、showFgui/hideFgui 调用、防抖、换房清理',
  },
  {
    title: '桌面常驻元素',
    focus: '倒计时、方位盘、剩余牌数、庄标、财神指示、出牌放大',
  },
  {
    title: '开局流程',
    focus: '开局动画、定庄、掷骰、牌墙、发牌、洗牌道具',
  },
]

const themes = Array.isArray(A.themes) && A.themes.length > 0 ? A.themes : DEFAULT_THEMES

const EXTRACT_SCAN_SCHEMA = {
  type: 'object',
  properties: {
    gameIdNote: { type: 'string', description: 'GameDefine.ts 中目标玩法 ID 与目录的对应说明' },
    clientFiles: { type: 'array', items: { type: 'string' } },
    fguiPackages: { type: 'array', items: { type: 'string' } },
    themes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          focus: { type: 'string' },
          codeFiles: { type: 'array', items: { type: 'string' } },
          fguiFiles: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'codeFiles'],
      },
    },
  },
  required: ['themes', 'clientFiles'],
}

const EXTRACT_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    file: { type: 'string', description: '写出的规则文件，相对项目根目录' },
    title: { type: 'string' },
    clauseCount: { type: 'number' },
    clauseRefs: { type: 'array', items: { type: 'string' } },
    deadCodeNotes: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['file', 'title', 'clauseCount'],
}

const BASE_DOC_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    ruleFileCount: { type: 'number' },
    clauseTotal: { type: 'number' },
    summary: { type: 'string' },
  },
  required: ['file', 'ruleFileCount', 'clauseTotal'],
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function themeFileName(index, title) {
  const safe = String(title || '主题')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim()
  return pad2(index + 1) + '-' + safe + '.md'
}

await check(() => fileExists(clientDir), '客户端代码目录不存在：' + clientDir)
await check(() => fileExists(fguiDir), 'FGUI 工程目录不存在：' + fguiDir)

phase('扫描代码与FGUI')

const themeListText = themes
  .map((t, i) => pad2(i + 1) + '. ' + t.title + '：' + (t.focus || '该主题全部交互'))
  .join('\n')

const scan = await agent(
  [
    '你是 Cocos + FairyGUI 客户端逆向扫描器，工作目录为项目根目录。只做文件清单扫描，不读正文做判断。',
    '',
    '客户端代码根目录：' + clientDir,
    'FGUI 工程目录：' + fguiDir,
    '',
    '任务：',
    '1. 先从大厅工程 common_game/config/GameDefine.ts 的 GameIDList 确认 ' + clientDir + ' 对应的玩法 ID 与含义，写入 gameIdNote。',
    '2. 列出 ' + clientDir + ' 下所有 .ts 文件（相对项目根目录的完整路径），写入 clientFiles。只要核心打牌模块，不要大厅 lobby 其他模块。',
    '3. 列出 ' + fguiDir + ' 下所有包目录（含 package.xml 的目录），写入 fguiPackages。',
    '4. 按下列主题把代码文件分组，每个主题返回 title、focus、codeFiles、fguiFiles：',
    themeListText,
    '',
    '分组要求：',
    '- codeFiles 必须是相对项目根目录的完整路径，逐个文件读完后再分配，不能凭文件名猜测；一个文件可属于多个主题。',
    '- layer/ 主界面与按钮交互归“操作按钮与权限”；protocol/gameCmd、recoverCmd 按语义归“断线重连与场景恢复”或对应主题。',
    '- fguiFiles 填该主题相关 FGUI 包内组件 XML 或 package.xml 路径；不确定可以留空数组。',
    '- 所有主题都要出现在返回结果里，title 与上面列表完全一致。',
  ].join('\n'),
  { label: '扫描客户端代码与 FGUI', schema: EXTRACT_SCAN_SCHEMA, ...analysisAgentOptions, timeoutMs: 1800000 }
)

if (!scan || !Array.isArray(scan.themes) || scan.themes.length === 0) {
  throw new Error('扫描阶段失败：未取得代码文件分组，请检查目录 ' + clientDir)
}

const scanByTitle = {}
for (const t of scan.themes) {
  if (t && t.title) scanByTitle[String(t.title).trim()] = t
}
const allClientFiles = Array.isArray(scan.clientFiles) ? scan.clientFiles : []

log('扫描完成：代码文件 ' + allClientFiles.length + ' 个，主题 ' + themes.length + ' 组')

phase('逆向提取')

const extractResults = await parallel(
  themes.map((theme, index) => () => {
    const matched = scanByTitle[String(theme.title).trim()] || {}
    let codeFiles = Array.isArray(matched.codeFiles) ? matched.codeFiles : []
    if (codeFiles.length === 0) codeFiles = allClientFiles
    const fguiFiles = Array.isArray(matched.fguiFiles) ? matched.fguiFiles : []
    const fileName = themeFileName(index, theme.title)
    const targetFile = rulesDir + '/' + fileName
    const clausePrefix = pad2(index + 1)

    return agent(
      [
        '你是资深 Cocos + FairyGUI 客户端逆向工程师。工作目录为项目根目录。',
        '',
        '任务：把本主题的 UI 交互事实整理成规则基准文档，并写入指定文件。',
        '',
        '目标游戏目录：' + clientDir + (scan.gameIdNote ? '（' + scan.gameIdNote + '）' : ''),
        'FGUI 工程目录：' + fguiDir,
        '本次主题：' + theme.title,
        '聚焦范围：' + (theme.focus || '该主题全部交互'),
        '',
        '负责的代码文件（必须逐个读完，可分多次 read）：',
        codeFiles.length > 0 ? codeFiles.map((f) => '- ' + f).join('\n') : '（未分配到文件，请按主题在 ' + clientDir + ' 中检索）',
        fguiFiles.length > 0 ? '相关 FGUI 文件：\n' + fguiFiles.map((f) => '- ' + f).join('\n') : '',
        '',
        '输出文件（只写这一个文件）：' + targetFile,
        '',
        '文档结构：',
        '# ' + theme.title + '（客户端 UI 交互基准）',
        '',
        '> 来源：' + clientDir + ' 代码逆向，提取日期 ' + checkDate + '。锚点格式：文件 → 方法。检查需求文档对' + theme.title + '相关交互的描述是否完整、与实现一致。',
        '',
        '## 一、<子主题>',
        '1. <一条 UI 事实>。锚点：<文件 → 方法/字段>',
        '2. ...',
        '',
        '## 二、<子主题>',
        '...',
        '',
        '硬性要求：',
        '1. 每条规则按“UI 事实”陈述：界面区域、变化、触发条件、边界；优先覆盖交互限制四类（前置守卫 / 互斥 / 超时 / 失败与恢复）。',
        '2. 每条必须带真实代码锚点（文件 → 方法/字段），禁止推测；代码里找不到的规则不要写。',
        '3. 死代码、无消费方、已移除的代码必须显式标注（如“（死代码，无消费方）”），作为报告防误报依据。',
        '4. 条款在本文件内从 1 连续编号，不跳号；报告会用「' + clausePrefix + '#条款号」引用。',
        '5. 数据源映射：@FguiView → 界面清单；addClick/onBtnXxx → 按钮交互；@gf.listen/dispatch → 内部事件；pfbm.uiFgui().showFgui() → 弹层生命周期；gameCmd dealData → 网络收；Controller sendXxx → 网络发；recoverCmd/sceneCmd → 重连恢复；代码注释 → 边界规则。',
        '6. 中文书写，禁止 Emoji。',
        '7. 只写目标文件，不要修改其他文件，不要执行 git 命令。',
        '',
        '完成后返回：file（目标文件相对项目根路径）、title、clauseCount、clauseRefs（如 ' + clausePrefix + '#1）、deadCodeNotes、summary。',
      ]
        .filter(Boolean)
        .join('\n'),
      {
        label: '提取 ' + theme.title,
        agentType: 'general',
        schema: EXTRACT_RESULT_SCHEMA,
        timeoutMs: 3600000,
        retries: 1,
      }
    )
  })
)

const extractOk = (extractResults || []).filter(Boolean)
if (extractOk.length === 0) {
  throw new Error('逆向提取阶段失败：没有任何主题产出规则文件')
}
const clauseTotalFromExtract = extractOk.reduce((s, r) => s + (Number(r.clauseCount) || 0), 0)
log('逆向提取完成：' + extractOk.length + ' 个主题文件，约 ' + clauseTotalFromExtract + ' 条条款')

phase('基准说明')

const ruleFileList = extractOk.map((r) => '- ' + r.file + '：' + r.title + '（' + (Number(r.clauseCount) || 0) + ' 条）').join('\n')

const baseDoc = await agent(
  [
    '你是 UI 交互基准文档编辑。工作目录为项目根目录。',
    '',
    '请阅读下列已生成的规则基准文件，写出基准说明文档：' + rulesDir + '/00-基准说明.md',
    '',
    '规则文件清单：',
    ruleFileList || '（无）',
    '',
    '必须包含：',
    '1. 基准来源：客户端源码目录 ' + clientDir + '，提取日期 ' + checkDate + (scan.gameIdNote ? '，' + scan.gameIdNote : '') + '。',
    '2. 基准性质：本文档是客户端已实现的 UI 交互事实，作为检查需求文档的标尺。需求与基准冲突时记需求的问题；需求明确有意不同的（新需求改版）记 P3 差异建议，提示补充“与现网实现的差异说明”。',
    '3. 文件清单：Markdown 表格，两列“文件 / 范围”，逐行列出上面所有规则文件。',
    '4. 检查口径：',
    '   - 每条规则按 UI 事实陈述（界面区域、变化、条件），检查需求是否定义、定义是否一致、是否遗漏边界（失败/超时/重连）表现。',
    '   - 需求写明“本期不做”的项不报缺失。',
    '   - 交互限制四类（前置守卫/互斥/超时/失败与恢复）是重点检查维度，需求缺失即报 INCOMPLETE。',
    '   - 标注“死代码/无消费方”的项不作为要求需求覆盖的依据；需求若描述这些行为且与实现不符记 CONFLICT。',
    '',
    '要求：中文，禁止 Emoji；只写 00-基准说明.md，不要修改 01 及之后的规则文件，不要执行 git。',
    '返回 file、ruleFileCount、clauseTotal、summary。',
  ].join('\n'),
  {
    label: '生成基准说明',
    agentType: 'general',
    schema: BASE_DOC_RESULT_SCHEMA,
    timeoutMs: 1800000,
  }
)

await check(() => fileExists(rulesDir + '/00-基准说明.md'), '基准说明未生成：' + rulesDir + '/00-基准说明.md')

return {
  rulesDir: rulesDir,
  baseDocPath: baseDoc ? baseDoc.file : rulesDir + '/00-基准说明.md',
  ruleFiles: extractOk.map((r) => ({ file: r.file, title: r.title, clauseCount: r.clauseCount })),
  clauseTotal: clauseTotalFromExtract,
  clientFiles: allClientFiles.length,
  themes: themes.map((t) => t.title),
}
