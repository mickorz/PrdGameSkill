// Output-Spec Generate 子流程 2/4：原子拆分与代码查证
//
// 从主 workflow output-spec-generate.js 拆分而来（2026-11-13，拆分方案见主文件头注释）。
// 职责：按阶段并行执行「拆原子需求 + 客户端代码查证」（explore 只读 + JSON schema），
//       逐阶段校验 ID 规范与 verdict/证据自洽，汇总统计返回。
//
// v3 查证墙钟加固（2026-11-13，备份 2-verify-stages.v1-org-20261113.js）：
//   首跑实测（run-mwep59gd-1，journal 27 次失败 attempt 中 20 次在本阶段）：
//   15 个查证 agent 中 14 个至少一次撞 1h 墙钟超时（agent超时 18 次）+ 结构化降级失败
//   （网关缓存 format unsupported (cached)）2 次，全部靠重试/续跑续命才成功；
//   成功 attempt 平均 2398s / 最大 3355s，原 3600s 墙钟裕度仅 1.07x，超时是常态而非异常。
//   加固：timeoutMs 3600000 -> 7200000（2x 裕度）；retries 1 -> 2（覆盖网关缓存错误与偶发超时）。
//   效果结论待下次真实执行补充（本次为机制落地，未重跑验证）。
//
// 由主 workflow 经显式路径调用（本目录不在注册表扫描范围）：
//   await workflow({ scriptPath: './.opencode-workflows/workflows/output-spec-generate/2-verify-stages.js', label: '原子拆分与代码查证' }, { ...childArgs, scan })
// args：
//   scan           必填，子流程 1 的返回值（{ sections, termsSection, stageSections, ... }），缺失直接报错
//   templatePath   需求模板路径，默认 templates/【杭州麻将】核心流程杭州麻将好友房AI-核心简化版本.md
//   codeDir        客户端代码工程，默认 source-code/client/Code
//   fguiDir        FairyGUI 工程，默认 source-code/client/Fgui
//   analysisModel  分析类模型，默认 biangfeng-gateway/deepseek-v4.1-flash-official（传空串用会话默认）
//
// 返回（供主 workflow 内存链式传给子流程 3）：
//   { stageCount, featureTotal, atomTotal, verdictStats, perStage, byStage }
//   byStage: [{ stageId, title, result }]，result 为该阶段完整查证结果 JSON

export const meta = {
  id: 'output-spec-verify-stages',
  name: 'output_spec_verify_stages',
  description: '按阶段并行拆原子需求并对照客户端代码查证，校验后返回各阶段证据结果',
  phases: [{ title: '原子拆分与代码查证' }],
}

const A = args || {}

const templatePath =
  A.templatePath || 'templates/【杭州麻将】核心流程杭州麻将好友房AI-核心简化版本.md'
const codeDir = A.codeDir || 'source-code/client/Code'
const fguiDir = A.fguiDir || 'source-code/client/Fgui'
const analysisModel =
  A.analysisModel === undefined ? 'biangfeng-gateway/deepseek-v4.1-flash-official' : A.analysisModel

setConcurrency(A.concurrency || 16)

function withModel(opts) {
  return analysisModel ? { model: analysisModel, ...opts } : opts
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function readRangeHint(sec) {
  return 'read 用 offset=' + sec.fromLine + ', limit=' + (sec.toLine - sec.fromLine + 1) + '（覆盖第 ' + sec.fromLine + '~' + sec.toLine + ' 行）'
}

// ============================================================
// 上游输入校验（scan 由主 workflow 内存传入）
// ============================================================

const scan = A.scan
if (!scan || !Array.isArray(scan.sections) || !Array.isArray(scan.stageSections) || scan.stageSections.length === 0) {
  throw new Error('缺少上游扫描结果 args.scan（含 sections/stageSections），请经主 workflow output-spec-generate 调度本子流程')
}
const stageSections = scan.stageSections
const termsSection = scan.termsSection || null

// ============================================================
// 原子拆分与代码查证（按阶段并行）
// ============================================================

phase('原子拆分与代码查证')

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
        timeoutMs: 7200000,
        retries: 2,
      })
    )
  )
)

// 查证结果校验：ID 规范、verdict 与证据自洽
const perStage = []
const byStage = []
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
  byStage.push({ stageId: s.stageId, title: s.title, result: r })
}

log(
  '原子拆分与查证完成：' + stageSections.length + ' 阶段 / ' + featureTotal + ' 功能点 / ' + atomTotal +
    ' 原子项（confirmed ' + verdictStats.confirmed + ' / partial ' + verdictStats.partial + ' / not_found ' + verdictStats.not_found + '）'
)

return {
  stageCount: stageSections.length,
  featureTotal: featureTotal,
  atomTotal: atomTotal,
  verdictStats: verdictStats,
  perStage: perStage,
  byStage: byStage,
}
