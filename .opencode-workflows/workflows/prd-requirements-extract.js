// PRD Requirements Extract Workflow（共享需求提取，RTM T1）
//
// 由 game-prd-check.js 的需求原子化阶段拆分而来（共享 RTM 增量改造计划 T1）：
//   三个 Checker（game-prd-check / ui-interaction-prd-extract / bug-coverage-check）
//   统一消费本 workflow 产出的需求快照（requirementsPath + extractionRunId），
//   保证 requirementId 跨 checker 一致；本 workflow 不读取任何 Rule/Bug 数据，
//   不判定需求是否正确或完整。
//
// 流程：
//   [扫描]          列出需求文档目录下的 Markdown 文件
//   [需求原子化]    每个文件一个 agent：写提取计划（行范围映射，不含原文），
//                   跑 slice-part.mjs 从源文件机械切原文组装分片（引文一致性从根保证）
//   [构建与校验]    执行 requirements-build.mjs：分片合并、稳定 ID（三层匹配）、
//                   源文件 SHA256 清单、引文一致性校验、manifest
//
// 产物目录（output/projects/{projectKey}/extractions/{extractionRunId}/）：
//   plans/part-XX.plan.json    提取计划（agent 写，行范围映射，不含原文）
//   requirements/parts/*.json   需求分片（slice-part.mjs 从源文件机械切原文组装）
//   requirements.json           合并 + 稳定 ID 后的需求清单（checker 消费）
//   source-manifest.json        源文件 + SHA256
//   validation.json             引文一致性校验结果（failed 时逐条列出文件/行/需求点）
//   manifest.json               提取清单（schemaVersion/extractionRunId/validationStatus/身份统计）
//
// identity-map.json（output/projects/{projectKey}/identity-map.json）：
//   持久化需求身份，跨运行跨 checker 复用；单写者契约——只由 requirements-build.mjs 更新。
//   匹配三层：exact-match（文本哈希）/ anchor-match（同章节候选唯一且相似度>=0.6）/
//   新 ID（候选不唯一或相似度不足时 identityStatus=pending-confirm，不自动合并，留人工确认）。
//
// 可选 args：
//   inputDir        需求文档目录，默认 input
//   inputFiles      指定需求文档路径数组（给定时跳过目录扫描）
//   projectKey      项目键（快照目录与身份隔离单位），默认 default
//   extractionRunId 提取运行 ID，默认 ext-<date 数字串或 undated>；需要多快照时调用方传唯一值
//   outRoot         输出根目录，默认 output/projects
//   date            提取日期 YYYY-MM-DD（脚本内禁止取当前时间）
//   concurrency     并发上限，默认 16（运行时钳制到 16）
//
// 返回：
//   { ok, projectKey, extractionRunId, extractionPath, requirementsPath,
//     identityMapPath, manifestPath, requirementTotal, validationStatus,
//     identityStats, failedFiles[] }

export const meta = {
  id: 'prd-requirements-extract',
  name: 'prd_requirements_extract',
  description: '扫描 PRD 需求文档，拆解原子需求点并构建带稳定 ID 的共享提取快照（requirements.json + identity-map + manifest），供 game/UI/Bug 三个检查 workflow 统一消费',
  phases: [
    { title: '扫描' },
    { title: '需求原子化' },
    { title: '构建与校验' },
  ],
}

const A = args || {}

const inputDir = A.inputDir || 'input'
const projectKey = A.projectKey || 'default'
const outRoot = A.outRoot || 'output/projects'
const dateStr = A.date && /^\d{4}-\d{2}-\d{2}$/.test(String(A.date)) ? String(A.date).replace(/-/g, '') : 'undated'
const extractionRunId = A.extractionRunId || 'ext-' + dateStr
const extractionDir = outRoot + '/' + projectKey + '/extractions/' + extractionRunId
const identityMapPath = outRoot + '/' + projectKey + '/identity-map.json'
const buildScript = '.opencode-workflows/scripts/requirements-build.mjs'

const analysisModel =
  A.analysisModel === undefined ? 'biangfeng-gateway/deepseek-v4.1-flash-official' : A.analysisModel
const analysisAgentOptions = analysisModel
  ? { model: analysisModel, timeoutMs: 1800000 }
  : { timeoutMs: 1800000 }

setConcurrency(A.concurrency || 16)

// ---------- 阶段 1：扫描 ----------
phase('扫描')

const scan = await agent(
  [
    '你是需求提取流程的扫描器，工作目录为项目根目录。只做清单扫描，不读正文做判断。',
    '',
    '任务：列出 ' + inputDir + ' 目录下所有 Markdown 文档，返回相对项目根目录的完整路径，写入 inputFiles。',
    '不要读取规则目录（.claude/、references/）或产物目录（output/、examples/）下的文件。',
  ].join('\n'),
  {
    label: '扫描需求文档',
    schema: {
      type: 'object',
      properties: { inputFiles: { type: 'array', items: { type: 'string' } } },
      required: ['inputFiles'],
    },
    ...analysisAgentOptions,
    timeoutMs: 900000,
  }
)

const inputFiles =
  A.inputFiles && A.inputFiles.length > 0 ? A.inputFiles : scan && Array.isArray(scan.inputFiles) ? scan.inputFiles : []
if (inputFiles.length === 0) {
  throw new Error('未找到需求文档：请检查目录 ' + inputDir + ' 或通过 args.inputFiles 指定')
}
const inputList = inputFiles.map((f) => '- ' + f).join('\n')
log('扫描完成：需求文档 ' + inputFiles.length + ' 份')

// ---------- 阶段 2：需求原子化 ----------
phase('需求原子化')

const reqResults = await parallel(
  inputFiles.map((f, i) => () => {
    const base = String(f).replace(/^.*\//, '').replace(/\.md$/i, '')
    const planFile = extractionDir + '/plans/part-' + String(i + 1).padStart(2, '0') + '.plan.json'
    const partFile = extractionDir + '/requirements/parts/part-' + String(i + 1).padStart(2, '0') + '.json'
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

// 提取失败的文件显式列出，不以 partial 结果伪装成功
const reqParts = reqResults || []
const okParts = reqParts.filter(Boolean)
const failedFiles = inputFiles.filter((f, i) => !reqParts[i])
if (okParts.length === 0) {
  throw new Error('需求提取阶段失败：所有文件均未产出分片（' + inputFiles.length + ' 份）')
}
for (const f of failedFiles) log('[失败] 需求提取未产出分片: ' + f)
const reqCount = okParts.reduce((s, r) => s + (r.count || 0), 0)
log('需求原子化完成：' + reqCount + ' 条需求点（' + okParts.length + '/' + inputFiles.length + ' 个文件成功）')

// ---------- 阶段 3：构建与校验（确定性脚本） ----------
phase('构建与校验')

const buildResult = await agent(
  [
    '你在项目根目录执行以下命令，然后按 schema 返回结果：',
    '',
    'node ' + buildScript + ' ' + extractionDir + ' --identity-map ' + identityMapPath + ' --project-key ' + projectKey,
    '',
    '要求：',
    '1. 命令输出 [成功] 时：从输出提取需求点总数与身份匹配统计（exact/anchor/pending/new），validationStatus 从 ' +
      extractionDir + '/manifest.json 读取；',
    '2. 命令输出 [失败] 时，原样记录错误清单到 message，ok 填 false；',
    '3. 不要修改脚本与数据文件。',
  ].join('\n'),
  {
    label: '需求快照构建',
    agentType: 'general',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        requirementTotal: { type: 'number' },
        identityStats: {
          type: 'object',
          properties: {
            exactMatch: { type: 'number' },
            anchorMatch: { type: 'number' },
            newWithPending: { type: 'number' },
            newConfirmed: { type: 'number' },
          },
        },
        validationStatus: { type: 'string', description: 'passed / failed' },
        message: { type: 'string', description: '结果说明或失败原因' },
      },
      required: ['ok', 'message'],
    },
    timeoutMs: 600000,
  }
)

if (!buildResult || buildResult.ok !== true) {
  throw new Error('需求快照构建失败：' + (buildResult && buildResult.message))
}
await check(() => fileExists(extractionDir + '/requirements.json'), 'requirements.json 未生成')
await check(() => fileExists(identityMapPath), 'identity-map.json 未生成')

const validationStatus = buildResult.validationStatus || 'unknown'
if (validationStatus !== 'passed') {
  log('[警告] 引文一致性校验存在失败项（' + validationStatus + '），明细见 ' + extractionDir + '/validation.json')
}

log(
  '需求快照构建完成：' + (buildResult.requirementTotal || reqCount) + ' 条需求点（exact ' +
    (buildResult.identityStats && buildResult.identityStats.exactMatch || 0) + ' / anchor ' +
    (buildResult.identityStats && buildResult.identityStats.anchorMatch || 0) + ' / pending ' +
    (buildResult.identityStats && buildResult.identityStats.newWithPending || 0) + ' / new ' +
    (buildResult.identityStats && buildResult.identityStats.newConfirmed || 0) + '）'
)

return {
  ok: true,
  projectKey,
  extractionRunId,
  extractionPath: extractionDir,
  requirementsPath: extractionDir + '/requirements.json',
  identityMapPath,
  manifestPath: extractionDir + '/manifest.json',
  requirementTotal: buildResult.requirementTotal || reqCount,
  validationStatus,
  identityStats: buildResult.identityStats || {},
  failedFiles,
}
