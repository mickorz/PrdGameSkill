// Game-Requirement-Audit 子流程 S2：原子拆解（只拆解、不查证）
//
// 自 output-spec-generate/2-verify-stages.js 的「第一步 拆原子需求」独立成步（2026-11-17，
// 执行文档 §12.2 / 头部 §5 S2）。职责：按阶段并行拆解 agent 写分片 ->
// 落盘闸门 -> validate-only 结构重算闸门（复用 build-requirement-registry.mjs，D40）。
//
// 与旧链路的关键差异（统一工作流契约）：
//   - 只拆解、不查证：不读任何代码，只读模板行段 + 名词章节；
//   - businessBehavior 是需求侧声明（从模板原文归纳，玩家语言），不是证据归纳；
//   - 新增 verificationScope（client/server/both，需求验证范围，只看需求原文，无法判定一律 both）；
//   - 新增 source 行号追溯（fromLine/toLine 必须落在本阶段章节行段内，越界闸门失败）；
//   - 分片头部 stage 四字段（D36：为 registry stages[] 供料）。
//
// 由主 workflow 经显式路径调用（本目录不在注册表扫描范围）：
//   await workflow({ scriptPath: './.opencode-workflows/workflows/game-requirement-audit/2-atomize-requirements.js', label: '原子拆解' }, { ...childArgs, scan })
//
// args：
//   scan           必填，S1 返回值（{ sections, termsSection, stageSections, ... }），缺失直接报错
//   runDir         必填，run 根目录
//   templatePath   需求模板路径，默认 templates/【杭州麻将】核心流程杭州麻将好友房AI-核心策划补齐版.md
//   analysisModel  分析类模型，默认 biangfeng-gateway/deepseek-v4.1-flash-official（传空串用会话默认）
//
// 返回：
//   { shardDir, stageCount, featureTotal, atomTotal, scopeStats }（统计以 validate-only 重算为准，agent 摘要仅告警）
//
// stageVersion：S2@1（specs：.opencode-workflows/scripts/stage-specs.game-requirement-audit.json）

export const meta = {
  id: 'game-requirement-audit-atomize-requirements',
  name: 'game_requirement_audit_atomize_requirements',
  description: '按阶段并行拆解原子需求写分片（只拆解不查证），经落盘闸门与 validate-only 结构重算闸门',
  phases: [{ title: '原子拆解' }],
}

const A = args || {}

const runDir = String(A.runDir || '').trim()
if (!runDir) {
  throw new Error('runDir 必填（run 根目录，由主编排 game-requirement-audit 创建后传入）')
}
const date = String(A.date || '').trim()
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  throw new Error('date 必填（YYYY-MM-DD，结构重算闸门 --date 需要；由主编排传入）')
}
const templatePath =
  A.templatePath || 'templates/【杭州麻将】核心流程杭州麻将好友房AI-核心策划补齐版.md'
const analysisModel =
  A.analysisModel === undefined ? 'biangfeng-gateway/deepseek-v4.1-flash-official' : A.analysisModel

const scan = A.scan
if (!scan || !Array.isArray(scan.sections) || !Array.isArray(scan.stageSections) || scan.stageSections.length === 0) {
  throw new Error('缺少上游扫描结果 args.scan（含 sections/stageSections），请经主 workflow game-requirement-audit 调度本子流程')
}
const stageSections = scan.stageSections
const termsSection = scan.termsSection || null

setConcurrency(A.concurrency || 16)

function withModel(opts) {
  return analysisModel ? { model: analysisModel, ...opts } : opts
}

function readRangeHint(sec) {
  return 'read 用 offset=' + sec.fromLine + ', limit=' + (sec.toLine - sec.fromLine + 1) + '（覆盖第 ' + sec.fromLine + '~' + sec.toLine + ' 行）'
}

const shardDir = runDir + '/1-registry/runtime/atom-parts'

// ============================================================
// 拆解摘要 Schema（agent 自己写分片文件，只返回摘要——坑 6 口径：摘要仅告警）
// ============================================================

const ATOMIZE_SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    partFile: { type: 'string', description: '分片文件名，不含目录路径（如 ST-C01-ap01.json）' },
    stageId: { type: 'string', description: '本片阶段 ID' },
    featureCount: { type: 'number', description: '本片功能点数' },
    atomCount: { type: 'number', description: '本片原子项数' },
    client: { type: 'number', description: 'verificationScope=client 的原子数' },
    server: { type: 'number', description: 'verificationScope=server 的原子数' },
    both: { type: 'number', description: 'verificationScope=both 的原子数' },
  },
  required: ['partFile', 'stageId', 'featureCount', 'atomCount', 'client', 'server', 'both'],
}

function partFileMatches(got, expected) {
  if (typeof got !== 'string' || got === '') return false
  const g = got.replaceAll('\\', '/')
  return g === expected || g.endsWith('/' + expected)
}

function atomizePrompt(s) {
  const partFile = s.stageId + '-ap01.json'
  const partPath = shardDir + '/' + partFile
  return [
    '你是游戏需求原子拆解员，正在为杭州麻将好友房需求做需求侧原子拆解。工作目录为项目根目录。',
    '只拆解、不查证：不读任何代码文件，只读需求模板原文。',
    '',
    '本阶段：' + s.stageId + ' ' + s.title + '（来源章节：' + (s.sourceTitle || s.title) + '）',
    '',
    '第一步，读原文：',
    '1. 读模板文件 ' + templatePath + ' 本阶段章节原文，' + readRangeHint(s) + '。',
    termsSection ? '2. 可另读名词章节（第 ' + termsSection.fromLine + '~' + termsSection.toLine + ' 行）帮助理解术语。' : null,
    '',
    '第二步，拆原子需求：',
    '1. 把章节内每条可独立验证的规则语句拆成原子项：一条规则语句一个原子项；包含多个并列子规则的复合长句可拆多条。',
    '2. 原子项按子主题归入功能点，每功能点 1~8 个原子项。',
    '3. 编号：功能点从 FP-' + s.stageId + '-001 起；原子项从 AT-' + s.stageId + '-001 起，在阶段内跨功能点连续编号（三位零填充）。',
    '4. 每个原子项填：',
    '   - name：原子项短名（中文短语）。',
    '   - rule：规则语义，忠实模板原文。',
    '   - uiRequirement：规则中 UI 表现相关语句，无则空串。',
    '   - verificationScope：需求验证范围，只看需求原文判定（判定指引见下）。',
    '   - businessBehavior：需求声明的业务语义四元组（trigger 什么事件触发 / condition 什么条件下生效 /',
    '     action 做什么 / result 玩家看到什么结果）。全部用玩家语言，禁止类名、方法名、协议名、文件路径等技术词；',
    '     从模板原文归纳，无法归纳的字段填空串，不要编造。',
    '   - source：原文来源追溯。chapter 填章节路径（如 ' + (s.sourceTitle || s.title) + '）；',
    '     fromLine/toLine 填该原子对应原文的行号区间，必须落在本阶段章节行段 [' + s.fromLine + ', ' + s.toLine + '] 内，越界整片校验失败。',
    '5. 每个功能点填：id（FP-' + s.stageId + '-nnn）、name、description（功能点主描述）、scope（范围与边界，无则空串）、coordination（总体协作，无则空串）。',
    '',
    'verificationScope 判定指引（只看需求原文，不看代码）：',
    '- client：纯界面/交互表现类——UI 展示、动效、按钮状态、纯客户端壳逻辑，服务端无规则角色。',
    '  示例：「牌河中财神标记显示方式」「禁打牌时对应牌置灰」。',
    '- server：纯规则计算/判定类——客户端仅展示服务端结果，需求正确性取决于服务端。',
    '  示例：「胡牌番数计算规则」「流局判黄庄条件」。',
    '- both：双端协作类——客户端交互与服务端规则共同构成完整行为。',
    '  示例：「点击吃牌按钮后完成吃牌」。',
    '- 无法判定时一律 both（宁可多查证，不可少查证）。',
    '',
    '第三步，写分片文件 ' + partPath + '（UTF-8、JSON、1 空格缩进），结构如下（stage 字段填本阶段头信息）：',
    '{',
    ' "schemaVersion": 1,',
    ' "stageId": "' + s.stageId + '",',
    ' "partNo": 1,',
    ' "stage": { "stageId": "' + s.stageId + '", "name": "' + s.title + '", "chapter": "' + (s.sourceTitle || s.title) + '", "summary": "一句话阶段概述" },',
    ' "features": [',
    '  { "id": "FP-' + s.stageId + '-001", "name": "", "description": "", "scope": "", "coordination": "",',
    '    "atoms": [',
    '     { "atomId": "AT-' + s.stageId + '-001", "name": "", "rule": "", "uiRequirement": "",',
    '       "verificationScope": "client|server|both",',
    '       "businessBehavior": { "trigger": "", "condition": "", "action": "", "result": "" },',
    '       "source": { "chapter": "", "fromLine": 0, "toLine": 0 } } ] } ]',
    '}',
    '',
    '要求：',
    '1. 只写这一个分片文件，不要写其他文件，不要执行 git 命令。',
    '2. 写完后返回结构化摘要（partFile 填分片文件名本身，不含目录路径，如 ' + partFile + '；',
    '   client+server+both = atomCount）。',
  ].filter((line) => line !== null).join('\n')
}

// ============================================================
// 按阶段并行拆解（每阶段一个 agent，写自己的分片）
// ============================================================

phase('原子拆解')

const atomizeResults = await parallel(
  stageSections.map((s) => () =>
    agent(
      atomizePrompt(s),
      withModel({
        label: '拆解 ' + s.stageId + ' ' + s.title,
        agentType: 'general',
        schema: ATOMIZE_SUMMARY_SCHEMA,
        timeoutMs: 3600000,
        retries: 2,
      })
    )
  )
)

// 摘要自洽告警（统计以 validate-only 重算为准）
for (let i = 0; i < stageSections.length; i++) {
  const s = stageSections[i]
  const r = atomizeResults[i]
  if (!r || !partFileMatches(r.partFile, s.stageId + '-ap01.json')) {
    throw new Error('拆解摘要 partFile 不符：期望 ' + s.stageId + '-ap01.json 实际 ' + (r && r.partFile))
  }
  if (r.stageId !== s.stageId) {
    throw new Error('拆解摘要 stageId 不符：期望 ' + s.stageId + ' 实际 ' + r.stageId)
  }
  const sum = (r.client || 0) + (r.server || 0) + (r.both || 0)
  if (sum !== r.atomCount) {
    log('告警：agent 摘要 scopeStats 不自洽（' + r.partFile + ' 三值合计=' + sum + ' atomCount=' + r.atomCount + '），以重算为准')
  }
}

// ============================================================
// 落盘闸门：每阶段分片必须写盘
// ============================================================

for (const s of stageSections) {
  const partPath = shardDir + '/' + s.stageId + '-ap01.json'
  const ok = await check(() => fileExists(partPath), '落盘闸门：拆解分片未写盘 ' + partPath)
  if (!ok) {
    throw new Error('落盘闸门：拆解分片未写盘 ' + partPath + '（重跑 from-stage=S2 幂等覆写分片）')
  }
}

// ============================================================
// 结构重算闸门：复用 build-requirement-registry.mjs --validate-only
// （ID 规范/唯一、行号落界、verificationScope 枚举、全覆盖、统计重算——D40 单一实现）
// ============================================================

const recountPath = runDir + '/1-registry/runtime/atom-recount.json'
const validateCmd =
  'node ".opencode-workflows/scripts/build-requirement-registry.mjs" --run-dir "' + runDir +
  '" --date "' + date + '" --validate-only --recount-out "' + recountPath + '"'
const validateOk = await commandSuccess(validateCmd, 300000)
if (!validateOk) {
  throw new Error('拆解分片结构重算闸门未通过（ID/行号落界/枚举/覆盖/统计问题，明细见上方命令日志；重跑 from-stage=S2 幂等覆写分片）')
}

// 重算摘要回读（聚合口径以 recount 文件为准）
const recount = await agent(
  [
    '你是拆解重算结果回读器，工作目录为项目根目录。只做读取与转写，不做解读。',
    '',
    '任务：用 read 工具读取文件 ' + recountPath + '（全文），原样返回其中数字字段：',
    'stageCount / featureTotal / atomTotal / client / server / both。',
    '只输出结构化结果。',
  ].join('\n'),
  withModel({
    label: '回读拆解重算',
    schema: {
      type: 'object',
      properties: {
        stageCount: { type: 'number' },
        featureTotal: { type: 'number' },
        atomTotal: { type: 'number' },
        client: { type: 'number' },
        server: { type: 'number' },
        both: { type: 'number' },
      },
      required: ['stageCount', 'featureTotal', 'atomTotal', 'client', 'server', 'both'],
    },
    timeoutMs: 600000,
    retries: 2,
  })
)
if (!recount || recount.stageCount !== stageSections.length || !Number.isInteger(recount.atomTotal) || recount.atomTotal < stageSections.length) {
  throw new Error('拆解重算回读异常：' + JSON.stringify(recount))
}

log(
  '原子拆解完成：' + recount.stageCount + ' 阶段 / ' + recount.featureTotal + ' 功能点 / ' + recount.atomTotal +
    ' 原子项（scope：client ' + recount.client + ' / server ' + recount.server + ' / both ' + recount.both + '）-> ' + shardDir
)

return {
  shardDir: shardDir,
  stageCount: recount.stageCount,
  featureTotal: recount.featureTotal,
  atomTotal: recount.atomTotal,
  scopeStats: { client: recount.client, server: recount.server, both: recount.both },
}
