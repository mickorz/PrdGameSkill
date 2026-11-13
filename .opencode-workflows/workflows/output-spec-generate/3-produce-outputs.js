// Output-Spec Generate 子流程 3/4：产出编写
//
// 从主 workflow output-spec-generate.js 拆分而来（2026-11-13，拆分方案见主文件头注释）。
// 职责：一轮并行产出全部文件——阶段规格文档（v2 起重阶段分片写盘）、索引片段 echo、
//       补充版章节分片、构建配置 echo。
//       写作类任务用会话默认模型，机械 echo 类任务用分析模型。
//
// v2 分片写盘（2026-11-13，备份 3-produce-outputs.v1-org-20261113.js）：
//   首跑实测原子项 56/31/59 的重章节（ST-C11/C05/C15）单 agent 单会话写 60KB 级文档
//   连续 provider_timeout 重试耗尽 / 输出中断（outputTokens=0 脑内整理不落盘），
//   见 dev-docs/experience/outputspec大文档agent输出中断分片写盘.md。
//   修复脚本（fix-st-c11-doc-2/3）真实执行验证分片方案可行后回填：
//   - 原子项 > MAX_ATOMS_PER_DOC_PART（24）的阶段按功能点贪心分组分片编写（不拆散功能点），
//     分片写 runtime/state/doc-parts/<stageId>/part-N.md，全部落盘后 merge-stage-doc-parts.mjs
//     确定性合并（含 U+FFFD 检查）成 stages/spec_stage_<stageId>.md
//   - 单片阶段保持直写 stages/spec_stage_<stageId>.md
//   - 全部阶段紧跟落盘闸门：check(spec_stage 文件存在)，agent 返回但未写盘当场拦截
//     （首跑 ST-C11 被跳过后问题推迟到装配校验才暴露，见
//     dev-docs/experience/outputspec续跑不重执行重试耗尽agent.md）
//   - 写作 prompt 硬性规则强化：直接逐个功能点边写边落盘，禁止先全量脑内整理再写盘
//
// v3 策划版投影（2026-11-14，备份 3-produce-outputs.v2-org-20261114.js，需求 R1/R2/R3/R7/R10，
//   见 dev-docs/requirements/2026-11-14-outputspec策划需求视图与技术实现视图分离.md）：
//   - 新增策划版分片产出（runtime/planner-parts/，与技术补充版分片并行的第二套投影）：
//     slimPlannerEvidence 结构化字段隔离（写作输入只含业务字段 id/name/rule/uiRequirement/
//     uiInteraction/notes/verdict + businessBehavior 若有，不含 clientLogic/evidence/messages），
//     plannerPartPrompt 以阶段 0 实验定稿 Prompt 为蓝本（experiment-planner-projection.js T0.2，
//     三检查点评审已通过：无技术泄漏/信息不丢失/AT-ID 可追溯）。
//   - 投影任务开关（R7 模式契约）：skipPlanner=true 不进策划版任务（legacy 行为=v2）；
//     plannerOnly=true 只进策划版任务（跳过阶段规格/索引片段/技术补充版），两者互斥。
//   - build-config.json 增加 mode/plannerPath/plannerParts/sourceSpecDir/allowlist，
//     供 build-output-spec.mjs（v2 起）分模式装配与泄漏检查。
//
// 由主 workflow 经显式路径调用（本目录不在注册表扫描范围）：
//   await workflow({ scriptPath: './.opencode-workflows/workflows/output-spec-generate/3-produce-outputs.js', label: '产出编写' }, { ...childArgs, scan, verify })
// args：
//   scan           必填，子流程 1 的返回值（{ sections, termsSection, stageSections, ... }），缺失直接报错
//   verify         必填，子流程 2 的返回值（{ byStage, ... }），缺失直接报错
//   templatePath   需求模板路径，默认 templates/【杭州麻将】核心流程杭州麻将好友房AI-核心简化版本.md
//   codeDir        客户端代码工程，默认 source-code/client/Code（用于 sourceDesc）
//   fguiDir        FairyGUI 工程，默认 source-code/client/Fgui（用于 sourceDesc）
//   specDir        1-spec 产出目录，默认 spec-workflow/output-spec/2026-11-13/1-spec
//   supplementPath 补充版文档输出路径，默认 spec-workflow/output-spec/核心流程杭州麻将好友房AI-补充版本.md
//   plannerPath    策划版文档输出路径（v3 新增），默认 spec-workflow/output-spec/核心流程杭州麻将好友房AI-策划版.md
//   skipPlanner    true 时不产出策划版（legacy 模式，行为等同 v2），默认 false
//   plannerOnly    true 时只产出策划版（跳过技术文档/索引/补充版），默认 false；与 skipPlanner 互斥
//   sourceSpecDir  历史查证证据目录（planner-only 覆盖检查基准，v3 新增透传进 build-config），默认空
//   leakAllowlist  泄漏检查白名单词数组（v3 新增透传进 build-config），默认 ['AI']
//   date           产出日期 YYYY-MM-DD（脚本内禁止取当前时间），默认 2026-11-13
//   analysisModel  分析类模型（echo 类任务），默认 biangfeng-gateway/deepseek-v4.1-flash-official（传空串用会话默认）
//
// 返回（供主 workflow 汇总）：
//   { specDir, stageDocCount, fragmentCount, partCount, docSplitStages, docPartTotal,
//     plannerPath, plannerPartCount, plannerOnly, skipPlanner }

export const meta = {
  id: 'output-spec-produce-outputs',
  name: 'output_spec_produce_outputs',
  description: '并行编写阶段规格文档、索引片段、补充版分片与构建配置',
  phases: [{ title: '产出编写' }],
}

const A = args || {}

const templatePath =
  A.templatePath || 'templates/【杭州麻将】核心流程杭州麻将好友房AI-核心简化版本.md'
const codeDir = A.codeDir || 'source-code/client/Code'
const fguiDir = A.fguiDir || 'source-code/client/Fgui'
const specDir = A.specDir || 'spec-workflow/output-spec/2026-11-13/1-spec'
const supplementPath =
  A.supplementPath || 'spec-workflow/output-spec/核心流程杭州麻将好友房AI-补充版本.md'
const plannerPath =
  A.plannerPath || 'spec-workflow/output-spec/核心流程杭州麻将好友房AI-策划版.md'
// 投影任务开关（R7 模式契约，T1.4）：互斥校验在输入检查段 fail fast
const skipPlanner = A.skipPlanner === true
const plannerOnly = A.plannerOnly === true
if (skipPlanner && plannerOnly) {
  throw new Error('skipPlanner 与 plannerOnly 互斥（不可同时为 true，见需求 R7 模式契约）')
}
// planner-only 覆盖检查基准目录与泄漏白名单（透传进 build-config，阶段 3 build-output-spec v2 消费）
const sourceSpecDir = A.sourceSpecDir || ''
const leakAllowlist = Array.isArray(A.leakAllowlist) ? A.leakAllowlist : ['AI']
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

function readRangeHint(sec) {
  return 'read 用 offset=' + sec.fromLine + ', limit=' + (sec.toLine - sec.fromLine + 1) + '（覆盖第 ' + sec.fromLine + '~' + sec.toLine + ' 行）'
}

function partPath(sec) {
  return specDir + '/runtime/supplement-parts/part-' + pad2(sec.no) + '.md'
}

// v3 策划版分片路径（T1.3）：与技术补充版分片并行的第二套 runtime 产物
function plannerPartPath(sec) {
  return specDir + '/runtime/planner-parts/part-' + pad2(sec.no) + '.md'
}

// v2 分片写盘：重阶段（原子项 > 阈值）按功能点贪心分组分片编写，规避单会话写不动 60KB 级文档
const MAX_ATOMS_PER_DOC_PART = 24

function docPartsDir(stageId) {
  return specDir + '/runtime/state/doc-parts/' + stageId
}

// 按功能点顺序贪心装箱（不拆散功能点；单片塞不下整功能点时该功能点独占一片）
function splitDocParts(features, maxAtoms) {
  const groups = []
  let cur = []
  let curAtoms = 0
  for (const fe of features) {
    const n = (fe.atoms || []).length
    if (curAtoms > 0 && curAtoms + n > maxAtoms) {
      groups.push(cur)
      cur = []
      curAtoms = 0
    }
    cur.push(fe)
    curAtoms += n
  }
  if (cur.length > 0) groups.push(cur)
  return groups
}

// ============================================================
// 上游输入校验（scan/verify 由主 workflow 内存传入）
// ============================================================

const scan = A.scan
if (!scan || !Array.isArray(scan.sections) || !Array.isArray(scan.stageSections) || scan.stageSections.length === 0) {
  throw new Error('缺少上游扫描结果 args.scan（含 sections/stageSections），请经主 workflow output-spec-generate 调度本子流程')
}
const verify = A.verify
if (!verify || !Array.isArray(verify.byStage) || verify.byStage.length === 0) {
  throw new Error('缺少上游查证结果 args.verify（含 byStage），请经主 workflow output-spec-generate 调度本子流程')
}
const sections = scan.sections
const stageSections = scan.stageSections
const byId = new Map()
for (const item of verify.byStage) {
  byId.set(item.stageId, item.result)
}
for (const s of stageSections) {
  if (!byId.has(s.stageId)) {
    throw new Error('阶段 ' + s.stageId + ' 缺少查证结果（verify.byStage 未包含），上游数据不一致')
  }
}

// ============================================================
// 产出编写（阶段规格文档 + 索引片段 echo + 补充版章节分片，一轮并行）
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

// v2 分片版阶段文档 prompt（单片与多片同构：多片时只嵌本片 features，写分片文件；单片写目标文件）
function stageDocPartPrompt(s, result, groups, n) {
  const multi = groups.length > 1
  const target = multi
    ? docPartsDir(s.stageId) + '/part-' + n + '.md'
    : specDir + '/stages/spec_stage_' + s.stageId + '.md'
  const lines = [
    '你是游戏需求规格编写员，为阶段 ' + s.stageId + ' 撰写客户端视角的阶段规格文档' + (multi ? '的分片（第 ' + n + '/' + groups.length + ' 片）' : '') + '。',
    '',
    '写入目标文件（write 工具，UTF-8）：' + target,
    '',
    '输入一，阶段信息：',
    '- 阶段 ID：' + s.stageId,
    '- 阶段名：' + s.title,
    '- 来源章节：' + (s.sourceTitle || s.title),
    '- 可读模板 ' + templatePath + ' 本阶段原文核对语义，' + readRangeHint(s),
    '',
    '输入二，本' + (multi ? '片' : '阶段') + '原子拆分与代码查证结果 JSON（唯一事实依据）：',
    JSON.stringify({ stage: result.stage, features: groups[n - 1] }, null, 1),
    '',
  ]
  if (multi && n === 1) {
    lines.push(
      '本片为第 1/' + groups.length + ' 片：先写文档头（从 # 阶段标题行开始，依次写引语、## 0. 阶段、## 术语与单位、## 跨切面行为，直到「（以下按 JSON 中 features 顺序，每个功能点一节）」行，其中 涉及协议消息/涉及 UI 模块 由本片 JSON 原子项的 messages 与证据文件汇总；其余功能点由后续分片覆盖，不冲突），随后写本片 JSON 中每个功能点各节。',
      ''
    )
  } else if (multi) {
    lines.push(
      '本片为第 ' + n + '/' + groups.length + ' 片：只写本片 JSON 中每个功能点各节（从 ## 功能点标题行开始），不写文档头，不加任何收尾内容。',
      ''
    )
  }
  lines.push(
    '文档格式骨架（严格遵循结构与标题层级，花括号为占位说明不是要写出的内容）：',
    STAGE_DOC_FORMAT,
    '',
    '硬性规则：',
    '1. 功能点与原子项必须与本' + (multi ? '片' : '阶段') + ' JSON 的 features/atoms 一一对应：数量、ID、顺序一致，不得增删、合并、改名' + (multi ? '；禁止写入本片 JSON 之外的功能点' : '') + '。',
    '2. evidence 的 file/location/excerpt 原样保留（excerpt 超长可截断到 120 字内）；第一条证据填 来源文件/来源定位/原文摘录 三字段，其余证据并入 职责依据（分号分隔）。',
    '3. 触发条件/配置影响/限制与禁止/异常与边界/验收 由 rule 加证据推导，禁止引入 JSON 之外的新事实。',
    '4. verdict=not_found 的原子项：职责依据写 无（客户端代码未找到），来源文件/来源定位/原文摘录 各写 无，客户端交互写 客户端代码未找到对应实现（待确认），客户端职责写 待确认（clientLogic 非空时如实写 clientLogic）。',
    '5. 中文书写，无 Emoji，不要用代码围栏包裹整份文档；表格保留 Markdown 表格语法。',
    '6. 直接逐个功能点边写边落盘：先在思考中整理当前功能点，随即写入文件，不要先在回复中整理全部内容再写盘；写完只返回文件路径与一句话摘要，不要输出文档全文，不要执行 git 命令。'
  )
  return lines.join('\n')
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
        // schemaVersion 2 新字段透传（T2.2/T3.4）：undefined 字段 JSON.stringify 自动省略，
        // v1 数据不补空串冒充（需求 6.4：未经新 Schema 查证的字段视为缺失）
        businessBehavior: at.businessBehavior || undefined,
        difference: at.difference || undefined,
        differenceDetail: at.differenceDetail || undefined,
        verification: at.verification || undefined,
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

// v3 策划版章节写作用的业务证据（T1.2，R2 第一级结构化字段隔离）：
// 只含业务字段（id/name/rule/uiRequirement/uiInteraction/notes/verdict + businessBehavior 若有），
// clientLogic、evidence 路径、refs、messages（协议名）等技术字段不进策划版写作上下文
function slimPlannerEvidence(r) {
  return {
    stage: r.stage.id + ' ' + r.stage.name,
    atoms: r.features.flatMap((fe) =>
      fe.atoms.map((at) => {
        const o = {
          id: at.id,
          name: at.name,
          rule: at.rule || '',
          uiRequirement: at.uiRequirement || '',
          uiInteraction: at.uiInteraction || '',
          notes: at.notes || '',
          verdict: at.verdict,
        }
        // schemaVersion 2 数据带业务语义四元组时透传（T2.2 之后），作为界面表现转写的首选依据
        if (at.businessBehavior) o.businessBehavior = at.businessBehavior
        return o
      })
    ),
  }
}

// v3 策划版章节分片 prompt（T1.2）：以阶段 0 实验定稿 Prompt 为蓝本
// （experiment-planner-projection.js，三检查点评审已通过），差异：
//   证据 JSON 由内存内嵌（正式链路 verify 结果经主编排内存传入，无需 agent 读盘）
//   引语去掉「投影实验」字样；businessBehavior 有则作为界面表现转写首选依据
function plannerPartPrompt(sec, evidence) {
  return [
    '你是需求文档整理员，面向策划输出。任务：把一个游戏需求章节增强成「策划版」文档分片——原文规则全部保留，补充玩家可理解的界面表现与待确认差异。工作目录为项目根目录。',
    '',
    '本章节：' + sec.title + '（来源章节：' + (sec.sourceTitle || sec.title) + '）。',
    '',
    '第一步，读模板章节原文：用 read 工具打开 ' + templatePath + '，' + readRangeHint(sec) + '。',
    '',
    '第二步，写目标分片文件（write 工具，UTF-8）：' + plannerPartPath(sec),
    '',
    '文档结构：',
    '1. 分片直接以本章节原文开头（含章节标题行）；章节标题行（# 开头的行）必须逐字保留，不得增删原有标题层级、不得改动原语义；可修明显笔误但不改规则含义。阶段章节分片可在标题行后另起一行引语：> 来源：模板「' + (sec.sourceTitle || sec.title) + '」章节（策划版）。',
    '2. 章节原文逐条保留：标题行与规则语句的顺序、语义不得删改。',
    '3. 在每条规则语句（列表项/段落）之后补充缩进两个空格的子列表项（没有原子项对应的原文语句不补充，保留原样；一条原文语句对应多个原子项时合并成一条补充行）：',
    '   - 该语句对应的原子项 verdict=confirmed/partial 且 uiInteraction 或 notes 或 businessBehavior 有内容：写「  - 界面表现：{玩家可理解的行为描述}（{原子项id}）」',
    '   - 原子项 notes 描述了实现与需求不一致（如需求说按普通白板展示、实际牌河中仍高亮）：另起一条「  - 待确认：需求为「{原文规则}」，实际表现为「{实际行为}」（{原子项id}）」',
    '   - 原子项 verdict=not_found：写「  - 待确认：客户端未查到对应实现（{原子项id}）」',
    '   - 原子项 uiInteraction、notes、businessBehavior 均为空且 verdict=confirmed/partial：不硬凑补充行，只保留原文。',
    '',
    '转写硬规则（最重要）：',
    '1. uiInteraction、notes、businessBehavior 是工程师写的查证记录，其中残留大量技术词，禁止原样复制进策划版：出现类名（如 GameJuDataCmd、GameData）、方法名（如 onShowZhuang、showDice）、协议名（MsgJuData、CMD_xxx、GP_xxx）、常量（C_Bank、KW_RESULT、POWER_ID_HU）、UI 组件名（box_hzmj_xxx）、文件路径（source-code/...、xxx.ts:31）时，必须转写成玩家能看见、能操作的行为描述（例：「BoxHzmjMah2DView.showDice」转写为「牌桌播放骰子动画」；「C_Bank 的 zhuang1~3 页」转写为「庄家标志按牢庄等级分三档点亮」）。',
    '2. businessBehavior 四元组（触发 trigger/条件 condition/行为 action/结果 result）是业务语义的权威来源，界面表现行优先按它转写。',
    '3. 无法转写成玩家行为的技术细节直接丢弃，不写进策划版；转写不得改变该行为的事实本身。',
    '4. 没有证据支撑的规则宁可标注「待确认」，严禁为了让文档完整而编造业务规则或编造界面表现。',
    '5. 每条补充行末尾用括号附原子项 id（AT-ST-Cxx-nnn 形式），供追溯。',
    '6. 全文不得出现：类名、方法名、Msg/CMD/GP 前缀协议名、C_/KW_/ET_ 前缀常量、box_ 组件名、source-code 路径、任何 .ts/.xml 文件名与 file:line。',
    '7. 中文书写，无 Emoji，不要用代码围栏包裹分片；直接逐条边写边落盘，不要先整理全部再写盘。',
    '',
    '写完只返回目标文件路径与一句话摘要，不要输出分片全文，不要执行 git 命令。',
    '',
    '本章节查证结果 JSON（唯一事实依据，原子项业务字段）：',
    JSON.stringify(evidence, null, 1),
  ].join('\n')
}

// v3 策划版引言/名词分片：机械复制（copyPartPrompt 同款，仅换目标路径）
function plannerCopyPartPrompt(sec) {
  return [
    '你是文档复制员。读模板文件 ' + templatePath + ' 指定行范围的内容，' + readRangeHint(sec) + '，把内容逐字写入：' + plannerPartPath(sec),
    '',
    '要求：使用 write 工具写入，UTF-8 编码。内容逐字复制，不得改写、增删、总结、翻译或加代码围栏；标题、空行、列表符号全部保留。只写这一个文件，不要执行 git 命令。写完后返回文件路径。',
  ].join('\n')
}

const writeTasks = []

// A. 阶段规格文档（写作类，会话默认模型；v2 起重阶段按功能点分片写盘）
//    plannerOnly=true 时不调度（R7：planner-only 绝不重写技术文档）
const docPlans = []
let docPartTotal = 0
if (!plannerOnly) {
  for (const s of stageSections) {
    const result = byId.get(s.stageId)
    const groups = splitDocParts(result.features || [], MAX_ATOMS_PER_DOC_PART)
    docPlans.push({ stageId: s.stageId, groups: groups })
    docPartTotal += groups.length
    for (let n = 1; n <= groups.length; n++) {
      const partNo = n
      writeTasks.push(() =>
        agent(stageDocPartPrompt(s, result, groups, partNo), {
          label: '规格文档 ' + s.stageId + (groups.length > 1 ? ' 片' + partNo + '/' + groups.length : ''),
          agentType: 'general',
          timeoutMs: 3600000,
          retries: 2,
        })
      )
    }
  }
}

// B. 索引片段 echo（机械逐字写入，分析模型即可；plannerOnly 时不调度）
if (!plannerOnly) {
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
}

// C. 补充版章节分片（stage 章节为写作任务；intro/nouns 为机械复制；plannerOnly 时不调度）
if (!plannerOnly) {
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
}

// C2. 策划版章节分片（v3 新增第二套投影；skipPlanner=true 时不调度）
//     stage 章节为写作任务（会话默认模型、timeoutMs 3600000、retries 2，T1.4）；
//     intro/nouns 为机械复制（plannerCopyPartPrompt）
if (!skipPlanner) {
  for (const sec of sections) {
    if (sec.kind === 'stage') {
      const evidence = slimPlannerEvidence(byId.get(sec.stageId))
      writeTasks.push(() =>
        agent(plannerPartPrompt(sec, evidence), {
          label: '策划版 ' + sec.stageId,
          agentType: 'general',
          timeoutMs: 3600000,
          retries: 2,
        })
      )
    } else {
      writeTasks.push(() =>
        agent(plannerCopyPartPrompt(sec), {
          label: '策划版复制 ' + (sec.kind === 'intro' ? '引言' : '名词'),
          agentType: 'general',
          timeoutMs: 900000,
          retries: 2,
          ...withModel({}),
        })
      )
    }
  }
}

// D. 构建配置 echo（中文路径经配置文件传给确定性脚本，CLI 参数保持 ASCII）
const buildConfigText = JSON.stringify(
  {
    // v3 起增加 mode：'full'（默认双投影装配）/'planner-only'（只装配策划版链路）
    mode: plannerOnly ? 'planner-only' : 'full',
    specDir: specDir,
    supplementPath: supplementPath,
    plannerPath: plannerPath,
    templatePath: templatePath,
    date: checkDate,
    sourceDesc: sourceDesc,
    expectedStageCount: stageSections.length,
    supplementParts: plannerOnly ? [] : sections.map((sec) => partPath(sec)),
    // 策划版分片清单（planner-only 装配链路的合并输入；skipPlanner 时空数组）
    plannerParts: skipPlanner ? [] : sections.map((sec) => plannerPartPath(sec)),
    // planner-only 模式覆盖检查基准（feature_index.json 所在 1-spec 目录）
    sourceSpecDir: sourceSpecDir,
    // 泄漏检查白名单（verify-output-spec v2 checkPlannerLeakage 消费）
    allowlist: leakAllowlist,
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

// v2 产出闸门：分片阶段确定性合并 + 全部阶段文档落盘检查
// （agent 返回但未写盘当场拦截，不推迟到子流程 4 装配校验）
// plannerOnly 时 docPlans 为空（A 段未调度），循环自然跳过
for (const plan of docPlans) {
  if (plan.groups.length > 1) {
    const partsDir = docPartsDir(plan.stageId)
    for (let n = 1; n <= plan.groups.length; n++) {
      await check(
        () => fileExists(partsDir + '/part-' + n + '.md'),
        '阶段 ' + plan.stageId + ' 规格文档分片 part-' + n + '.md 未生成（agent 返回但未写盘）'
      )
    }
    const mergeCmd =
      'node ".opencode-workflows/scripts/merge-stage-doc-parts.mjs" "' +
      partsDir + '" "' + specDir + '/stages/spec_stage_' + plan.stageId + '.md" ' + plan.groups.length
    const mergeOk = await commandSuccess(mergeCmd, 120000)
    if (!mergeOk) {
      throw new Error('阶段 ' + plan.stageId + ' 规格文档分片合并失败（分片缺失或含乱码），见上方命令日志')
    }
  }
  await check(
    () => fileExists(specDir + '/stages/spec_stage_' + plan.stageId + '.md'),
    '阶段 ' + plan.stageId + ' 规格文档未生成（agent 返回但未写盘）'
  )
}

// v3 策划版分片闸门（T1.5）：全部章节策划版分片落盘检查
// （skipPlanner 时无策划版任务，跳过；合并归子流程 4 / build-output-spec v2）
if (!skipPlanner) {
  for (const sec of sections) {
    await check(
      () => fileExists(plannerPartPath(sec)),
      '策划版分片未生成（agent 返回但未写盘）：' + plannerPartPath(sec)
    )
  }
}

const docSplitStages = docPlans.filter((p) => p.groups.length > 1).map((p) => p.stageId + '(' + p.groups.length + '片)')
const plannerPartCount = skipPlanner ? 0 : sections.length
log(
  (plannerOnly
    ? '策划版投影产出：策划版分片 ' + plannerPartCount + ' 份（plannerOnly，技术文档任务零调度）'
    : '产出编写完成：阶段文档 ' + stageSections.length + ' 份（分片阶段 ' + docSplitStages.length + ' 个：' + docSplitStages.join('、') + '），索引片段 ' + stageSections.length + ' 份，补充版分片 ' + sections.length + ' 份' +
      (skipPlanner ? '，策划版分片 0 份（skipPlanner）' : '，策划版分片 ' + plannerPartCount + ' 份')
  )
)

return {
  specDir: specDir,
  stageDocCount: plannerOnly ? 0 : stageSections.length,
  fragmentCount: plannerOnly ? 0 : stageSections.length,
  partCount: plannerOnly ? 0 : sections.length,
  docPartTotal: docPartTotal,
  docSplitStages: docSplitStages,
  plannerPath: plannerPath,
  plannerPartCount: plannerPartCount,
  plannerOnly: plannerOnly,
  skipPlanner: skipPlanner,
}
