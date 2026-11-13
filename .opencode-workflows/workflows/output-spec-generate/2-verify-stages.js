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
// v4 业务语义与差异 Schema（2026-11-14，备份 2-verify-stages.v3-org-20261114.js，需求 R4/R5，
//   见 dev-docs/requirements/2026-11-14-outputspec策划需求视图与技术实现视图分离.md 6/6.1/6.4 节）：
//   - 原子项 Schema 新增：businessBehavior{trigger,condition,action,result}（业务语义四元组，
//     玩家语言）、difference（consistent/partial/conflict/unverified，与 verdict 语义分离：
//     verdict=是否发现客户端实现证据，difference=实现与需求在已验证范围内的关系）、
//     differenceDetail、verification{businessRuleVerified,unverifiedReason}；
//     clientObserved 不进 Schema——校验代码从 verdict != not_found 派生后填入返回值。
//   - stageVerifyPrompt 增加第三步业务语义与差异判定（差异判定规则见需求 6.1：
//     部分证据不足以判定 = unverified 不等同 partial；conflict 必给 differenceDetail + 证据；
//     禁止把 verdict=confirmed 直接写成 businessRuleVerified=true）。
//   - 校验循环扩展：not_found ⇒ difference 兜底 unverified（缺省兜底不报错，兼容旧 journal 重放）；
//     conflict ⇒ differenceDetail 与 evidence 非空；differenceStats 进返回值与 perStage。
//   - 返回值顶层 schemaVersion: 2。
//   - 警示：Schema 变更后不要用旧 run 的 resumeFromRunId 重放本子流程（旧 agent 输出缺新字段，
//     差异判定会被兜底成 unverified 冒充已跑过；v1 数据新字段按「未经新 Schema 查证」处理，
//     见需求 6.4，不补空串冒充已验证）。
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
//   { schemaVersion, stageCount, featureTotal, atomTotal, verdictStats, differenceStats, perStage, byStage }
//   byStage: [{ stageId, title, result }]，result 为该阶段完整查证结果 JSON
//   （v4 起原子项含 businessBehavior/difference/differenceDetail/verification，verification.clientObserved 为派生值）

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
                // v4 新增（R4/R5）：业务语义四元组与差异关系，全部玩家语言
                businessBehavior: {
                  type: 'object',
                  description: '业务语义四元组（玩家语言，禁止技术词），无法从证据归纳的字段填空串',
                  properties: {
                    trigger: { type: 'string', description: '什么事件触发该行为，无则空串' },
                    condition: { type: 'string', description: '什么条件下行为生效，无则空串' },
                    action: { type: 'string', description: '客户端做什么，无则空串' },
                    result: { type: 'string', description: '玩家看到什么结果，无则空串' },
                  },
                  required: ['trigger', 'condition', 'action', 'result'],
                },
                difference: {
                  type: 'string',
                  enum: ['consistent', 'partial', 'conflict', 'unverified'],
                  description: '实际实现与需求的关系（与 verdict 语义分离，判定规则见需求 6.1）',
                },
                differenceDetail: { type: 'string', description: '差异说明：conflict 时必填（需求原文 vs 实际表现），其余无则空串' },
                verification: {
                  type: 'object',
                  description: '业务规则验证结论（禁止从 verdict=confirmed 直接推导 businessRuleVerified=true）',
                  properties: {
                    businessRuleVerified: { type: 'boolean', description: '完整业务规则是否得到确认（含服务端行为可证性）' },
                    unverifiedReason: { type: 'string', description: 'businessRuleVerified=false 时的原因，true 时空串' },
                  },
                  required: ['businessRuleVerified', 'unverifiedReason'],
                },
              },
              required: [
                'id', 'name', 'rule', 'uiRequirement', 'verdict',
                'clientLogic', 'uiInteraction', 'evidence', 'messages', 'notes',
                'businessBehavior', 'difference', 'differenceDetail', 'verification',
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
    '第三步，业务语义与差异判定（每个原子项都要填，全部用玩家语言）：',
    '- businessBehavior 业务语义四元组（trigger 什么事件触发 / condition 什么条件下生效 / action 客户端做什么 / result 玩家看到什么结果）：由证据归纳的业务语义，禁止出现类名、方法名、协议名、常量、文件路径等技术词；无法从证据归纳的字段填空串，不要编造。',
    '- difference 实际实现与需求的关系（与 verdict 语义独立，verdict 只回答「是否发现客户端实现证据」）：',
    '  - consistent：可观察范围内符合需求，且用于判定的每项要求均有充分证据',
    '  - partial：同一原子需求中部分子要求已验证满足、其余子要求未验证（未证实不等于证实不符）',
    '  - conflict：发现明确与需求矛盾的实现行为（例：需求「财神打出按普通白板展示」、实现「牌河中打出的白板财神仍高亮」）',
    '  - unverified：没有足以判定需求符合性的证据（含只有间接证据、无法支撑判定的情况）',
    '  判定注意：客户端只有部分证据（如仅前端按钮）不等于 partial——证据不足以判定需求符合性时归 unverified；verdict=not_found 时 difference 必为 unverified。',
    '- differenceDetail：difference=conflict 时必填（描述需求原文 vs 实际表现，并指向证据）；其余无则空串。',
    '- verification：',
    '  - businessRuleVerified：完整业务规则是否得到确认（boolean）。verdict=confirmed 只证明「客户端存在实现证据」，禁止因此直接填 true；典型反例：客户端显示吃牌按钮（confirmed）但服务端吃牌优先级规则不可由客户端代码证实，此时填 false。',
    '  - unverifiedReason：businessRuleVerified=false 时填原因（如「缺少服务端吃牌资格判定证据」），true 时填空串。',
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
// v4 差异统计（T2.4）：difference 分布，conflict 优先原则（单值字段直接计数）
const differenceStats = { consistent: 0, partial: 0, conflict: 0, unverified: 0 }
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
  const dStats = { consistent: 0, partial: 0, conflict: 0, unverified: 0 }
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
      // v4 差异自洽校验与兜底（T2.4，兼容旧 journal 重放：缺失/非法按 unverified 兜底，不报错）
      const DIFF_VALUES = ['consistent', 'partial', 'conflict', 'unverified']
      if (!DIFF_VALUES.includes(at.difference)) {
        at.difference = 'unverified'
      }
      if (at.verdict === 'not_found') {
        at.difference = 'unverified'
      }
      if (at.difference === 'conflict') {
        if (!at.differenceDetail) {
          throw new Error('原子项 ' + at.id + ' difference=conflict 但 differenceDetail 为空（必须描述需求原文 vs 实际表现）')
        }
        if (!Array.isArray(at.evidence) || at.evidence.length === 0) {
          throw new Error('原子项 ' + at.id + ' difference=conflict 但证据为空（conflict 必须携带证据）')
        }
      }
      // v4 clientObserved 派生（T2.2：不进 Schema 减少输出负担，校验代码派生后填入返回值）
      if (!at.verification || typeof at.verification !== 'object') {
        at.verification = { businessRuleVerified: false, unverifiedReason: '查证结果缺 verification 字段（旧 Schema 数据兜底）' }
      }
      at.verification.clientObserved = at.verdict !== 'not_found'
      count++
      if (at.verdict === 'confirmed') c++
      else if (at.verdict === 'partial') p++
      else n++
      // v4 差异统计（conflict 优先原则：difference 单值，直接按值计数）
      dStats[at.difference] = (dStats[at.difference] || 0) + 1
    }
  }
  atomTotal += count
  featureTotal += r.features.length
  verdictStats.confirmed += c
  verdictStats.partial += p
  verdictStats.not_found += n
  for (const k of Object.keys(dStats)) differenceStats[k] += dStats[k]
  perStage.push({
    id: s.stageId,
    name: s.title,
    features: r.features.length,
    atoms: count,
    confirmed: c,
    partial: p,
    notFound: n,
    difference: dStats,
  })
  byStage.push({ stageId: s.stageId, title: s.title, result: r })
}

log(
  '原子拆分与查证完成：' + stageSections.length + ' 阶段 / ' + featureTotal + ' 功能点 / ' + atomTotal +
    ' 原子项（confirmed ' + verdictStats.confirmed + ' / partial ' + verdictStats.partial + ' / not_found ' + verdictStats.not_found + '）' +
    '（difference：consistent ' + differenceStats.consistent + ' / partial ' + differenceStats.partial + ' / conflict ' + differenceStats.conflict + ' / unverified ' + differenceStats.unverified + '）'
)

return {
  schemaVersion: 2,
  stageCount: stageSections.length,
  featureTotal: featureTotal,
  atomTotal: atomTotal,
  verdictStats: verdictStats,
  differenceStats: differenceStats,
  perStage: perStage,
  byStage: byStage,
}
