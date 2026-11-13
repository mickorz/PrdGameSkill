// Output-Spec Generate Workflow
//
// 由 dev-docs/design/outputspec生成工作流计划.md 转写（2026-11-13）：
//   读取需求模板（杭州麻将好友房AI 核心简化版本）拆分原子需求，对照客户端代码
//   （Code 代码工程 + Fgui FairyGUI 工程）查证，补充客户端逻辑与 UI 交互，产出：
//   1. specDir（默认 spec-workflow/output-spec/2026-11-13/1-spec/）—— 结构对齐原 1-spec
//      （stages/spec_stage_ST-Cxx.md + feature_index.json + stage_manifest.md + runtime/）
//   2. 补充版需求文档（模板复制后补充完整版，默认 spec-workflow/output-spec/核心流程杭州麻将好友房AI-补充版本.md）
//
// 结构依据：dev-docs/research/2026-11-13-v3-1spec-结构分析.md（Stage/Feature/Atom 数据层级、
// 阶段文档字段模板、runtime/ 产物形态；本产出的职责域为 client，来源指向客户端代码证据）。
//
// 2026-11-13 生成前问询结论（落为本文件常量与默认值）：
//   档位：速度优先（不做审核/修正闭环，靠确定性装配 + verify-output-spec 机械闸门收尾）
//   分析类模型：biangfeng-gateway/deepseek-v4.1-flash-official（本仓库 5 个 workflow 已验证可用）
//   写作类模型：会话默认（阶段规格文档与补充版章节写作不显式传 model）
//   并发：16
//
// 流程：
//   [check] 模板 / 代码工程 / Fgui 工程就位
//     -> 扫描模板章节（intro / 名词 / stage 划分 ST-C01..）
//     -> 按阶段并行：拆原子 + 客户端代码查证（explore 只读 + JSON schema）
//     -> 并行产出：阶段规格文档 + 索引片段 echo + 补充版章节分片 + 构建配置 echo
//     -> 确定性构建：build-output-spec.mjs 一步完成合并补充版、装配索引、机械校验
//        （中文路径全经 runtime/build-config.json 传递，CLI 参数保持 ASCII，
//         规避中文路径经命令行的编码风险，见 dev-docs/experience/workflow扫描agent全量转述超时-确定性扫描替代.md）
//
// 可选 args：
//   templatePath    需求模板，默认 templates/【杭州麻将】核心流程杭州麻将好友房AI-核心简化版本.md
//   codeDir         客户端代码工程，默认 source-code/client/Code
//   fguiDir         FairyGUI 工程，默认 source-code/client/Fgui
//   specDir         1-spec 产出目录，默认 spec-workflow/output-spec/2026-11-13/1-spec
//   supplementPath  补充版文档输出路径，默认 spec-workflow/output-spec/核心流程杭州麻将好友房AI-补充版本.md
//   date            产出日期 YYYY-MM-DD（脚本内禁止取当前时间），默认 2026-11-13
//   analysisModel   分析类模型，默认 biangfeng-gateway/deepseek-v4.1-flash-official（传空串用会话默认）
//   concurrency     并发上限，默认 16（运行时钳制到 16）

export const meta = {
  id: 'output-spec-generate',
  name: 'output_spec_generate',
  description: '读取需求模板拆分原子需求，对照客户端代码（Code/Fgui）查证补充客户端逻辑与 UI 交互，产出 1-spec 规格目录与补充版需求文档',
  phases: [
    { title: '扫描模板' },
    { title: '原子拆分与代码查证' },
    { title: '产出编写' },
    { title: '装配与校验' },
  ],
}

const A = args || {}

const templatePath =
  A.templatePath || 'templates/【杭州麻将】核心流程杭州麻将好友房AI-核心简化版本.md'
const codeDir = A.codeDir || 'source-code/client/Code'
const fguiDir = A.fguiDir || 'source-code/client/Fgui'
const specDir = A.specDir || 'spec-workflow/output-spec/2026-11-13/1-spec'
const supplementPath =
  A.supplementPath || 'spec-workflow/output-spec/核心流程杭州麻将好友房AI-补充版本.md'
const checkDate = A.date || '2026-11-13'
const analysisModel =
  A.analysisModel === undefined ? 'biangfeng-gateway/deepseek-v4.1-flash-official' : A.analysisModel
// 来源描述进 feature_index.source（echo 进构建配置，不经 CLI 传中文）
const sourceDesc =
  templatePath + '（需求模板）+ ' + codeDir + ' + ' + fguiDir + '（客户端代码证据）'

setConcurrency(A.concurrency || 16)

function withModel(opts) {
  return analysisModel ? { model: analysisModel, ...opts } : opts
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

// ============================================================
// schema 定义
// ============================================================

const SCAN_SCHEMA = {
  type: 'object',
  properties: {
    totalLines: { type: 'number', description: '模板文件总行数（最后一行的行号）' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          no: { type: 'number', description: '文档顺序序号，从 1 起' },
          title: { type: 'string', description: '章节标题（不含 # 标记）' },
          fromLine: { type: 'number' },
          toLine: { type: 'number' },
          kind: { type: 'string', enum: ['intro', 'terms', 'stage'] },
          stageId: { type: 'string', description: 'kind=stage 必填，ST-C01 起按文档顺序连续编号' },
          container: { type: 'string', description: '所属上级 ## 标题，顶级章节留空串' },
          sourceTitle: { type: 'string', description: '章节路径，如 行牌 > 吃碰杠' },
        },
        required: ['no', 'title', 'fromLine', 'toLine', 'kind'],
      },
    },
  },
  required: ['sections', 'totalLines'],
}

const STAGE_EVIDENCE_SCHEMA = {
  type: 'object',
  properties: {
    stage: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        chapter: { type: 'string', description: '来源章节路径，如 行牌 > 吃碰杠' },
        summary: { type: 'string', description: '一句话阶段概述' },
        terms: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              term: { type: 'string' },
              definition: { type: 'string' },
              source: { type: 'string', description: '模板名词章节 或 代码证据 file:line' },
            },
            required: ['term', 'definition', 'source'],
          },
        },
        crossCutting: { type: 'array', items: { type: 'string' }, description: '跨切面客户端行为，无则空数组' },
      },
      required: ['id', 'name', 'chapter', 'summary', 'terms', 'crossCutting'],
    },
    features: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'FP-ST-Cxx-nnn' },
          name: { type: 'string' },
          description: { type: 'string', description: '功能点主描述' },
          scope: { type: 'string', description: '范围与边界，无则空串' },
          coordination: { type: 'string', description: '总体协作，无则空串' },
          atoms: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'AT-ST-Cxx-nnn' },
                name: { type: 'string' },
                rule: { type: 'string', description: '规则语义，忠实模板原文' },
                uiRequirement: { type: 'string', description: '规则中 UI 表现相关语句，无则空串' },
                verdict: { type: 'string', enum: ['confirmed', 'partial', 'not_found'] },
                clientLogic: { type: 'string', description: '客户端逻辑实现摘要，无证据空串' },
                uiInteraction: { type: 'string', description: 'UI 交互表现，无证据空串' },
                evidence: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      file: { type: 'string', description: '相对项目根路径' },
                      location: { type: 'string', description: 'file:line' },
                      excerpt: { type: 'string', description: '代码摘录，不超过 120 字' },
                    },
                    required: ['file', 'location', 'excerpt'],
                  },
                },
                messages: { type: 'array', items: { type: 'string' }, description: '涉及协议消息名 MsgXxx' },
                notes: { type: 'string', description: '与模板规则的差异或存疑点，无则空串' },
              },
              required: [
                'id', 'name', 'rule', 'uiRequirement', 'verdict',
                'clientLogic', 'uiInteraction', 'evidence', 'messages', 'notes',
              ],
            },
          },
        },
        required: ['id', 'name', 'description', 'atoms'],
      },
    },
  },
  required: ['stage', 'features'],
}

// ============================================================
// 输入就位检查
// ============================================================

await check(() => fileExists(templatePath), '需求模板不存在：' + templatePath)
await check(() => fileExists(codeDir), '客户端代码工程不存在：' + codeDir)
await check(() => fileExists(fguiDir), 'FairyGUI 工程不存在：' + fguiDir)

// ============================================================
// Phase 1：扫描模板
// ============================================================

phase('扫描模板')

const scan = await agent(
  [
    '你是需求规格工作流的模板结构扫描器，工作目录为项目根目录。只做章节扫描与归类，不解读内容。',
    '',
    '任务：完整读取模板文件 ' + templatePath + '（可分多次读取），识别文档章节结构，返回有序章节列表。',
    '',
    '章节归类规则：',
    '1. 从第 1 行到第一个「## 」标题之前为文档引言（标题 + 概述段落），kind=intro，title 填文档主标题。',
    '2. 「## 名词」术语章节 kind=terms；模板没有名词章节时不输出 terms 条目。',
    '3. 全部「### 」级小节 kind=stage；某 ### 是其「## 」容器下第一个子节时，fromLine 取该 ## 标题行行号（把容器标题与容器直属引语折入本节范围）。',
    '4. 没有 ### 子节、且不是名词章节的「## 」级章节 kind=stage。',
    '5. kind=stage 条目按文档顺序编 stageId：ST-C01、ST-C02……连续编号。',
    '6. 字段：no（文档顺序序号从 1 起）、title（章节标题，不含 # 标记）、fromLine/toLine（起止行号，read 显示的行号即真实行号）、kind、stageId（stage 必填）、container（上级 ## 标题，顶级留空串）、sourceTitle（章节路径，如 行牌 > 吃碰杠）。',
    '7. 章节列表必须覆盖全文：首节从第 1 行起，末节 toLine 为文档最后一行；相邻章节之间只允许隔空白行，不允许隔内容行。',
    '8. 另填 totalLines：模板文件总行数（最后一行的行号）。',
    '',
    '只输出结构化结果。',
  ].join('\n'),
  withModel({ label: '扫描模板章节', schema: SCAN_SCHEMA, timeoutMs: 1200000, retries: 1 })
)

if (!scan || !Array.isArray(scan.sections) || scan.sections.length === 0) {
  throw new Error('扫描失败：未取得章节列表，请检查模板 ' + templatePath)
}

const sections = scan.sections.slice().sort((a, b) => a.no - b.no)
const noSet = new Set()
for (const sec of sections) {
  if (!Number.isInteger(sec.no) || noSet.has(sec.no)) {
    throw new Error('章节序号非法或重复：' + JSON.stringify(sec))
  }
  noSet.add(sec.no)
  if (!sec.title || !Number.isInteger(sec.fromLine) || !Number.isInteger(sec.toLine) || sec.fromLine < 1 || sec.toLine < sec.fromLine) {
    throw new Error('章节行号非法：' + JSON.stringify(sec))
  }
  if (!['intro', 'terms', 'stage'].includes(sec.kind)) {
    throw new Error('章节 kind 非法：' + JSON.stringify(sec))
  }
}

// 覆盖全文校验（防漏章节导致补充版静默丢内容）
if (!Number.isInteger(scan.totalLines) || scan.totalLines < 1) {
  throw new Error('模板总行数非法：' + scan.totalLines)
}
const byFrom = sections.slice().sort((a, b) => a.fromLine - b.fromLine)
if (byFrom[0].fromLine !== 1) {
  throw new Error('首个章节未从第 1 行开始：' + byFrom[0].title + ' 起于第 ' + byFrom[0].fromLine + ' 行')
}
for (let i = 1; i < byFrom.length; i++) {
  const gap = byFrom[i].fromLine - byFrom[i - 1].toLine
  if (gap < 1 || gap > 3) {
    throw new Error(
      '章节覆盖存在缺口或重叠：' + byFrom[i - 1].title + ' 止于第 ' + byFrom[i - 1].toLine + ' 行，' +
        byFrom[i].title + ' 起于第 ' + byFrom[i].fromLine + ' 行（间隔 ' + gap + ' 行）'
    )
  }
}
if (byFrom[byFrom.length - 1].toLine !== scan.totalLines) {
  throw new Error(
    '末章节未覆盖到模板最后一行：' + byFrom[byFrom.length - 1].title + ' 止于第 ' +
      byFrom[byFrom.length - 1].toLine + ' 行，模板共 ' + scan.totalLines + ' 行'
  )
}

const termsSection = sections.find((s) => s.kind === 'terms') || null
const stageSections = sections.filter((s) => s.kind === 'stage')
if (stageSections.length === 0) {
  throw new Error('未识别到任何 stage 章节（### 小节或顶级规则章节），请检查模板结构')
}
for (let i = 0; i < stageSections.length; i++) {
  const expect = 'ST-C' + pad2(i + 1)
  if (stageSections[i].stageId !== expect) {
    throw new Error('阶段编号不连续：期望 ' + expect + '，实际 ' + stageSections[i].stageId)
  }
}

function readRangeHint(sec) {
  return 'read 用 offset=' + sec.fromLine + ', limit=' + (sec.toLine - sec.fromLine + 1) + '（覆盖第 ' + sec.fromLine + '~' + sec.toLine + ' 行）'
}

function partPath(sec) {
  return specDir + '/runtime/supplement-parts/part-' + pad2(sec.no) + '.md'
}

// ============================================================
// Phase 2：原子拆分与代码查证（按阶段并行）
// ============================================================

phase('原子拆分与代码查证')

log('模板扫描完成：stage 章节 ' + stageSections.length + ' 个' + (termsSection ? '，名词章节第 ' + termsSection.fromLine + '~' + termsSection.toLine + ' 行' : ''))

function stageVerifyPrompt(s) {
  return [
    '你是游戏需求拆解与客户端代码查证员，正在为杭州麻将好友房需求做客户端视角规格化。工作目录为项目根目录。',
    '',
    '本阶段：' + s.stageId + ' ' + s.title + '（来源章节：' + (s.sourceTitle || s.title) + '）',
    '',
    '第一步，拆原子需求：',
    '1. 读模板文件 ' + templatePath + ' 本阶段章节原文，' + readRangeHint(s) + '。' + (termsSection ? '可另读名词章节（第 ' + termsSection.fromLine + '~' + termsSection.toLine + ' 行）帮助理解术语。' : ''),
    '2. 把章节内每条可独立验证的规则语句拆成原子项：一条规则语句一个原子项；包含多个并列子规则的复合长句可拆多条。',
    '3. 原子项按子主题归入功能点，每功能点 1~8 个原子项。',
    '4. 编号：功能点从 FP-' + s.stageId + '-001 起；原子项从 AT-' + s.stageId + '-001 起，在阶段内跨功能点连续编号。',
    '5. 每个原子项填 rule（规则语义，忠实原文）与 uiRequirement（规则中 UI 表现相关语句，无则空串）。',
    '6. stage 字段：id=' + s.stageId + '、name=' + s.title + '、chapter=' + (s.sourceTitle || s.title) + '、summary 一句话概述；terms 填与本阶段相关的术语（优先取名词章节定义，source 注明来源；无则空数组）；crossCutting 填查证中发现的跨切面客户端行为（无则空数组）。',
    '',
    '第二步，客户端代码查证（每个原子项都要查证）：',
    '代码工程 ' + codeDir + '：controller/cmd 是命令处理、protocol/GameGlcProtocol.ts 是协议消息定义、fgui/* 是 UI 绑定代码、data/ 是数据层、config/ 是配置。',
    'FairyGUI 工程 ' + fguiDir + '：assets/box_hzmj_* 各包的组件 XML 定义界面结构（按钮、列表、标签、动效等）。',
    '查证方式：用 grep 搜中文关键词、协议消息名、组件名定位，再 read 相关文件确认；每个原子项给出 verdict：',
    '- confirmed：找到直接实现证据',
    '- partial：只有间接或部分相关证据',
    '- not_found：未找到对应实现',
    '每个原子项填：',
    '- clientLogic：客户端逻辑实现摘要（哪个模块处理、做什么），无证据填空串',
    '- uiInteraction：UI 交互表现（按钮、压暗、倒计时、字效、面板刷新等），无证据填空串',
    '- evidence：证据列表（file 填相对项目根路径，location 填 file:line，excerpt 摘录不超过 120 字），confirmed/partial 给 1~5 条，not_found 为空数组',
    '- messages：涉及协议消息名（MsgXxx，可从 GameGlcProtocol.ts 或调用处确认），无则空数组',
    '- notes：与模板规则的差异或存疑点，无则空串',
    '',
    '严禁编造：所有 file/location/excerpt 必须来自真实读到的文件内容；查不到就如实 not_found，不要硬凑证据。',
    '只输出结构化结果。',
  ].join('\n')
}

const stageResults = await parallel(
  stageSections.map((s) => () =>
    agent(
      stageVerifyPrompt(s),
      withModel({
        label: '查证 ' + s.stageId + ' ' + s.title,
        schema: STAGE_EVIDENCE_SCHEMA,
        timeoutMs: 3600000,
        retries: 1,
      })
    )
  )
)

// 查证结果校验：ID 规范、verdict 与证据自洽
const byId = new Map()
const perStage = []
let atomTotal = 0
let featureTotal = 0
const verdictStats = { confirmed: 0, partial: 0, not_found: 0 }
for (let i = 0; i < stageSections.length; i++) {
  const s = stageSections[i]
  const r = stageResults[i]
  if (!r || !r.stage || !Array.isArray(r.features) || r.features.length === 0) {
    throw new Error('阶段 ' + s.stageId + ' 查证结果无效（agent 失败或返回空），请重跑 workflow')
  }
  if (r.stage.id !== s.stageId) {
    throw new Error('阶段 ' + s.stageId + ' 查证结果 stage.id 不符：' + String(r.stage.id))
  }
  const atomRe = new RegExp('^AT-' + s.stageId + '-\\d{3}$')
  const fpRe = new RegExp('^FP-' + s.stageId + '-\\d{3}$')
  const ids = new Set()
  let count = 0
  let c = 0
  let p = 0
  let n = 0
  for (const fe of r.features) {
    if (!fpRe.test(fe.id || '')) throw new Error('阶段 ' + s.stageId + ' 功能点 ID 非法：' + fe.id)
    if (ids.has(fe.id)) throw new Error('阶段 ' + s.stageId + ' 功能点 ID 重复：' + fe.id)
    ids.add(fe.id)
    if (!Array.isArray(fe.atoms) || fe.atoms.length === 0) {
      throw new Error('阶段 ' + s.stageId + ' 功能点 ' + fe.id + ' 无原子项')
    }
    for (const at of fe.atoms) {
      if (!atomRe.test(at.id || '')) throw new Error('阶段 ' + s.stageId + ' 原子项 ID 非法：' + at.id)
      if (ids.has(at.id)) throw new Error('阶段 ' + s.stageId + ' 原子项 ID 重复：' + at.id)
      ids.add(at.id)
      if (!['confirmed', 'partial', 'not_found'].includes(at.verdict)) {
        throw new Error('原子项 ' + at.id + ' verdict 非法：' + at.verdict)
      }
      if (at.verdict !== 'not_found' && (!Array.isArray(at.evidence) || at.evidence.length === 0)) {
        throw new Error('原子项 ' + at.id + ' verdict=' + at.verdict + ' 但证据列表为空（不允许无证据断言）')
      }
      if (at.verdict === 'not_found' && Array.isArray(at.evidence) && at.evidence.length > 0) {
        throw new Error('原子项 ' + at.id + ' verdict=not_found 却带证据，自相矛盾')
      }
      count++
      if (at.verdict === 'confirmed') c++
      else if (at.verdict === 'partial') p++
      else n++
    }
  }
  atomTotal += count
  featureTotal += r.features.length
  verdictStats.confirmed += c
  verdictStats.partial += p
  verdictStats.not_found += n
  perStage.push({ id: s.stageId, name: s.title, features: r.features.length, atoms: count, confirmed: c, partial: p, notFound: n })
  byId.set(s.stageId, r)
}

log(
  '原子拆分与查证完成：' + stageSections.length + ' 阶段 / ' + featureTotal + ' 功能点 / ' + atomTotal +
    ' 原子项（confirmed ' + verdictStats.confirmed + ' / partial ' + verdictStats.partial + ' / not_found ' + verdictStats.not_found + '）'
)

// 索引片段（feature_index 用，证据不带摘录，摘录保留在阶段文档）
function indexFragment(r) {
  return {
    stage: r.stage,
    features: r.features.map((fe) => ({
      id: fe.id,
      name: fe.name,
      description: fe.description || '',
      scope: fe.scope || '',
      coordination: fe.coordination || '',
      atoms: fe.atoms.map((at) => ({
        id: at.id,
        name: at.name,
        rule: at.rule || '',
        uiRequirement: at.uiRequirement || '',
        verdict: at.verdict,
        clientLogic: at.clientLogic || '',
        uiInteraction: at.uiInteraction || '',
        messages: at.messages || [],
        evidence: (at.evidence || []).map((e) => ({ file: e.file, location: e.location })),
        notes: at.notes || '',
      })),
    })),
  }
}

// 补充版章节写作用的瘦身证据（供原文语句匹配）
function slimEvidence(r) {
  return {
    stage: r.stage.id + ' ' + r.stage.name,
    atoms: r.features.flatMap((fe) =>
      fe.atoms.map((at) => ({
        id: at.id,
        name: at.name,
        rule: at.rule || '',
        verdict: at.verdict,
        clientLogic: at.clientLogic || '',
        uiInteraction: at.uiInteraction || '',
        refs: (at.evidence || []).map((e) => e.location),
        messages: at.messages || [],
      }))
    ),
  }
}

// ============================================================
// Phase 3：产出编写（阶段规格文档 + 索引片段 echo + 补充版章节分片，一轮并行）
// ============================================================

phase('产出编写')

const STAGE_DOC_FORMAT = [
  '# {阶段名}',
  '',
  '> 阶段 ID：`' + '{stageId}' + '`。来源：模板「{来源章节}」章节。客户端视角规格，客户端逻辑与 UI 交互以 Code/Fgui 代码证据支撑。',
  '',
  '## 0. 阶段',
  '',
  '- **阶段 ID**：`{stageId}`',
  '- **阶段**：{阶段名}',
  '- **来源章节**：{来源章节}',
  '- **涉及协议消息**：{本阶段全部 messages 去重，顿号分隔；无则写 无}',
  '- **涉及 UI 模块**：{证据文件中 box_hzmj_* 等模块名去重，顿号分隔；无则写 无}',
  '- **阶段概述**：{stage.summary}',
  '',
  '## 术语与单位（有则填）',
  '',
  '| 术语 | 定义 | 单位/量纲 | 作用域 | 来源 |',
  '| --- | --- | --- | --- | --- |',
  '{stage.terms 每条一行；数组为空时本节只写一行 无}',
  '',
  '## 跨切面行为（无原子也列）',
  '',
  '{stage.crossCutting 每条一行：- **{要点}**：{说明} —— 跨切面（{file:line}）；数组为空时写 - 无}',
  '',
  '（以下按 JSON 中 features 顺序，每个功能点一节）',
  '',
  '## `{FP-ST-Cxx-nnn}` {功能点名}',
  '',
  '- **主描述**：{features[].description}',
  '- **范围与边界**：{features[].scope，空则写 无特殊边界}',
  '- **总体协作**：{features[].coordination，空则按本功能点原子项概括客户端如何消费与呈现}',
  '',
  '### 原子项',
  '',
  '#### `{AT-ST-Cxx-nnn}` {原子项名}',
  '',
  '- **规则说明**：{基于 rule 的忠实展开}',
  '- **触发条件**：{由 rule 推导的触发时机}',
  '- **配置影响**：{相关配置，无则写 本原子项无独立配置}',
  '- **客户端交互**：{uiRequirement 与 uiInteraction 综合表述；not_found 时写 客户端代码未找到对应实现（待确认）}',
  '- **限制与禁止**：{rule 中的禁止性约束，无则写 无}',
  '- **异常与边界**：{rule 中的例外/边界与证据中的边界行为，无则写 无}',
  '- **验收**：{可验证的验收口径}',
  '- **职责域**：client',
  '- **职责依据**：{证据 file:line 分号分隔；not_found 写 无（客户端代码未找到）}',
  '- **服务端职责**：{有 messages 时写 下发 MsgXxx（按 JSON 概括）；无则写 本次仅依据客户端代码，服务端行为未还原}',
  '- **客户端职责**：{clientLogic；not_found 写 待确认}',
  '- **协作边界**：{客户端消费哪些服务端消息、本地判断哪些}',
  '- **来源文件**：`{evidence[0].file}`（not_found 写 无）',
  '- **来源定位**：{evidence[0].location}（not_found 写 无）',
  '- **原文摘录**：`{evidence[0].excerpt}`（not_found 写 无）',
].join('\n')

function stageDocPrompt(s, result) {
  return [
    '你是游戏需求规格编写员，为阶段 ' + s.stageId + ' 撰写客户端视角的阶段规格文档。',
    '',
    '写入目标文件（write 工具，UTF-8）：' + specDir + '/stages/spec_stage_' + s.stageId + '.md',
    '',
    '输入一，阶段信息：',
    '- 阶段 ID：' + s.stageId,
    '- 阶段名：' + s.title,
    '- 来源章节：' + (s.sourceTitle || s.title),
    '- 可读模板 ' + templatePath + ' 本阶段原文核对语义，' + readRangeHint(s),
    '',
    '输入二，本阶段原子拆分与代码查证结果 JSON（唯一事实依据）：',
    JSON.stringify(result, null, 1),
    '',
    '文档格式骨架（严格遵循结构与标题层级，花括号为占位说明不是要写出的内容）：',
    STAGE_DOC_FORMAT,
    '',
    '硬性规则：',
    '1. 功能点与原子项必须与 JSON 的 features/atoms 一一对应：数量、ID、顺序一致，不得增删、合并、改名。',
    '2. evidence 的 file/location/excerpt 原样保留（excerpt 超长可截断到 120 字内）；第一条证据填 来源文件/来源定位/原文摘录 三字段，其余证据并入 职责依据（分号分隔）。',
    '3. 触发条件/配置影响/限制与禁止/异常与边界/验收 由 rule 加证据推导，禁止引入 JSON 之外的新事实。',
    '4. verdict=not_found 的原子项：职责依据写 无（客户端代码未找到），来源文件/来源定位/原文摘录 各写 无，客户端交互写 客户端代码未找到对应实现（待确认）。',
    '5. 中文书写，无 Emoji，不要用代码围栏包裹整份文档；表格保留 Markdown 表格语法。',
    '6. 写完后只返回文件路径与一句话摘要，不要输出文档全文，不要执行 git 命令。',
  ].join('\n')
}

function echoPrompt(text, targetPath) {
  return [
    '你的任务是把下面 PART-BEGIN 与 PART-END 之间的 JSON 文本逐字写入文件：' + targetPath,
    '',
    '要求：',
    '1. 使用 write 工具写入，UTF-8 编码。',
    '2. 内容逐字复制，不得改写、增删、总结、翻译或加代码围栏；缩进、引号、空行全部保留。',
    '3. 只写这一个文件，不要写其他文件，不要执行 git 命令。',
    '4. 写完后返回文件路径。',
    '',
    'PART-BEGIN',
    text,
    'PART-END',
  ].join('\n')
}

function supplementPartPrompt(sec, evidence) {
  return [
    '你是需求文档补充编写员。任务：把模板的一个章节复制并补充成客户端实现与 UI 交互增强版分片。',
    '',
    '1. 读模板文件 ' + templatePath + ' 本章节原文，' + readRangeHint(sec) + '，原文全部保留。',
    '2. 分片文件直接以本章节原文开头（含章节标题行）；章节标题行（# 开头的行）必须逐字保留，不得增删原有标题层级、不得改动原语义；可修明显笔误但不改规则含义。',
    '3. 在每条规则语句（列表项/段落）之后补充缩进两个空格的子列表项：',
    '   - 有证据：写「  - 客户端实现：{要点}（{file:line}）」，UI 表现另起一条「  - UI 交互：{要点}」',
    '   - verdict=not_found 的：写「  - 待确认：客户端代码未找到对应实现」',
    '   - 一条原文语句对应多个原子项时合并成补充行，不重复；没有原子项对应的语句不补充，保留原样。',
    '4. 只允许使用下面查证结果 JSON 里的证据，禁止新增未经查证的内容。',
    '5. 中文书写，无 Emoji，不要用代码围栏包裹分片；写入目标文件（write 工具，UTF-8）：' + partPath(sec),
    '6. 写完后只返回文件路径，不要输出分片全文，不要执行 git 命令。',
    '',
    '本章节查证结果 JSON（原子项、verdict 与证据）：',
    JSON.stringify(evidence, null, 1),
  ].join('\n')
}

function copyPartPrompt(sec) {
  return [
    '你是文档复制员。读模板文件 ' + templatePath + ' 指定行范围的内容，' + readRangeHint(sec) + '，把内容逐字写入：' + partPath(sec),
    '',
    '要求：使用 write 工具写入，UTF-8 编码。内容逐字复制，不得改写、增删、总结、翻译或加代码围栏；标题、空行、列表符号全部保留。只写这一个文件，不要执行 git 命令。写完后返回文件路径。',
  ].join('\n')
}

const writeTasks = []

// A. 阶段规格文档（写作类，会话默认模型）
for (const s of stageSections) {
  const result = byId.get(s.stageId)
  writeTasks.push(() =>
    agent(stageDocPrompt(s, result), {
      label: '规格文档 ' + s.stageId,
      agentType: 'general',
      timeoutMs: 3600000,
      retries: 1,
    })
  )
}

// B. 索引片段 echo（机械逐字写入，分析模型即可）
for (const s of stageSections) {
  const fragmentText = JSON.stringify(indexFragment(byId.get(s.stageId)), null, 1)
  writeTasks.push(() =>
    agent(echoPrompt(fragmentText, specDir + '/runtime/parts/' + s.stageId + '.json'), {
      label: '索引片段 ' + s.stageId,
      agentType: 'general',
      timeoutMs: 900000,
      retries: 2,
      ...withModel({}),
    })
  )
}

// C. 补充版章节分片（stage 章节为写作任务；intro/nouns 为机械复制）
for (const sec of sections) {
  if (sec.kind === 'stage') {
    const evidence = slimEvidence(byId.get(sec.stageId))
    writeTasks.push(() =>
      agent(supplementPartPrompt(sec, evidence), {
        label: '补充版 ' + sec.stageId,
        agentType: 'general',
        timeoutMs: 3600000,
        retries: 1,
      })
    )
  } else {
    writeTasks.push(() =>
      agent(copyPartPrompt(sec), {
        label: '复制 ' + (sec.kind === 'intro' ? '引言' : '名词'),
        agentType: 'general',
        timeoutMs: 900000,
        retries: 2,
        ...withModel({}),
      })
    )
  }
}

// D. 构建配置 echo（中文路径经配置文件传给确定性脚本，CLI 参数保持 ASCII）
const buildConfigText = JSON.stringify(
  {
    specDir: specDir,
    supplementPath: supplementPath,
    templatePath: templatePath,
    date: checkDate,
    sourceDesc: sourceDesc,
    expectedStageCount: stageSections.length,
    supplementParts: sections.map((sec) => partPath(sec)),
  },
  null,
  1
)
writeTasks.push(() =>
  agent(echoPrompt(buildConfigText, specDir + '/runtime/build-config.json'), {
    label: '构建配置',
    agentType: 'general',
    timeoutMs: 900000,
    retries: 2,
    ...withModel({}),
  })
)

await parallel(writeTasks)

log('产出编写完成：阶段文档 ' + stageSections.length + ' 份，索引片段 ' + stageSections.length + ' 份，补充版分片 ' + sections.length + ' 份')

// ============================================================
// Phase 4：装配与校验（确定性命令，无 LLM 转述；CLI 参数保持 ASCII）
// ============================================================

phase('装配与校验')

// build-output-spec.mjs 一步完成：合并补充版分片 -> 装配 feature_index/stage_manifest -> 机械校验
// （中文路径全经 runtime/build-config.json 传递，规避中文路径经命令行的编码风险）
const buildCmd =
  'node ".opencode-workflows/scripts/build-output-spec.mjs" "' + specDir + '/runtime/build-config.json"'
const buildOk = await commandSuccess(buildCmd)
if (!buildOk) {
  throw new Error(
    '产出装配与校验失败（合并补充版/装配索引/机械校验某步失败，见上方命令日志；校验明细见 ' +
      specDir + '/runtime/spec_check/verify-report.md），请重跑 workflow'
  )
}

await check(() => fileExists(specDir + '/feature_index.json'), 'feature_index.json 未生成')
await check(() => fileExists(specDir + '/stage_manifest.md'), 'stage_manifest.md 未生成')
await check(() => fileExists(supplementPath), '补充版文档未生成')

log('装配与校验完成：' + specDir + ' 与 ' + supplementPath)

return {
  specDir: specDir,
  supplementPath: supplementPath,
  featureIndexPath: specDir + '/feature_index.json',
  stageManifestPath: specDir + '/stage_manifest.md',
  verifyReportPath: specDir + '/runtime/spec_check/verify-report.md',
  stageCount: stageSections.length,
  featureCount: featureTotal,
  atomCount: atomTotal,
  verdictStats: verdictStats,
  perStage: perStage,
}
