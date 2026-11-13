// Output-Spec Generate 子流程 1/4：扫描模板
//
// 从主 workflow output-spec-generate.js 拆分而来（2026-11-13，拆分方案见主文件头注释）。
// 职责：输入就位检查（模板存在）-> 扫描模板章节结构 -> 覆盖全文/编号连续性校验 ->
//       echo agent 将扫描结果落盘 <specDir>/runtime/state/scan.json（供人工观察章节边界）。
//
// 由主 workflow 经显式路径调用（本目录不在注册表扫描范围）：
//   await workflow({ scriptPath: './.opencode-workflows/workflows/output-spec-generate/1-scan-template.js', label: '扫描模板' }, childArgs)
//
// args（主 workflow 透传，均带默认值）：
//   templatePath  需求模板路径，默认 templates/【杭州麻将】核心流程杭州麻将好友房AI-核心简化版本.md
//   specDir       1-spec 产出目录，默认 spec-workflow/output-spec/2026-11-13/1-spec
//   analysisModel 分析类模型，默认 biangfeng-gateway/deepseek-v4.1-flash-official（传空串用会话默认）
//
// 返回（供主 workflow 内存链式传给后续子流程，不经文件）：
//   { stageCount, sections, termsSection, stageSections, scanPath, totalLines }

export const meta = {
  id: 'output-spec-scan-template',
  name: 'output_spec_scan_template',
  description: '扫描需求模板章节结构并校验覆盖完整性，落盘 scan.json 供观察',
  phases: [{ title: '扫描模板' }],
}

const A = args || {}

const templatePath =
  A.templatePath || 'templates/【杭州麻将】核心流程杭州麻将好友房AI-核心简化版本.md'
const specDir = A.specDir || 'spec-workflow/output-spec/2026-11-13/1-spec'
const analysisModel =
  A.analysisModel === undefined ? 'biangfeng-gateway/deepseek-v4.1-flash-official' : A.analysisModel

setConcurrency(A.concurrency || 16)

function withModel(opts) {
  return analysisModel ? { model: analysisModel, ...opts } : opts
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

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

// ============================================================
// 输入就位检查
// ============================================================

await check(() => fileExists(templatePath), '需求模板不存在：' + templatePath)

// ============================================================
// 扫描模板
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

// 扫描结果落盘（echo agent 逐字写入，供人工在分步执行时观察章节边界）
const scanPath = specDir + '/runtime/state/scan.json'
const scanText = JSON.stringify({ templatePath: templatePath, totalLines: scan.totalLines, sections: sections }, null, 1)
await agent(echoPrompt(scanText, scanPath), {
  label: '扫描结果落盘',
  agentType: 'general',
  timeoutMs: 900000,
  retries: 2,
  ...withModel({}),
})

log('模板扫描完成：stage 章节 ' + stageSections.length + ' 个' + (termsSection ? '，名词章节第 ' + termsSection.fromLine + '~' + termsSection.toLine + ' 行' : '') + '，扫描结果 -> ' + scanPath)

return {
  stageCount: stageSections.length,
  sections: sections,
  termsSection: termsSection,
  stageSections: stageSections,
  scanPath: scanPath,
  totalLines: scan.totalLines,
}
