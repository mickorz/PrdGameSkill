// Game-Requirement-Audit Workflow（主编排，S1~S11 全链接入）
//
// 位置：本文件与十一子流程同在 game-requirement-audit/ 子目录（注册表只扫描 workflows/ 一级
// 目录，本目录脚本均不进注册表）——调用本工作流用 workflow 工具的 scriptPath（相对项目根）：
//   ./.opencode-workflows/workflows/game-requirement-audit/game-requirement-audit.js
//
// 设计依据：dev-docs/planning/2026-11-17-game-requirement-audit-执行文档.md
//   （头部 v3.2 冻结 + §12~§19 详细设计 + §21 评审整改）。
//
// 阶段链（§2 步骤总览）：
//   S1 需求扫描 → S2 原子拆解 → S3 注册表定稿
//   → S4 客户端查证 ∥ S5 服务端查证（共享并发配额）
//   → S6 证据汇总（同步屏障：必须双端 merge 完成后才进）
//   → S7 业务行为还原 → S8 统一差异复核 → S9 L7 分类
//   → S10 统一规格生成 → S11 人工裁决（无 decisions.json 时返回待人工输入）
//
// 执行模式（args.mode）：
//   all        从头执行（新建 Run）
//   resume     继续当前 Run 未完成部分（复用已完成阶段，不重跑）
//   from-stage 指定起点重跑，上游经 strict 四指纹校验复用（§11.3）
//   retry      端级补证重跑（retryScope + 影响集合；需先有 S11 的 impact-set.json）
//
// 指纹与状态（agent 零填写）：
//   stage-specs.game-requirement-audit.json（契约 #5 单一事实源，S1~S11 全覆盖）
//   每阶段闸门通过后由本编排调用 stage-reuse.mjs record-stage
//
// args：
//   date            必填，YYYY-MM-DD（产物根 spec-workflow/requirement-audit/<date>/runs/）
//   mode            all（默认）/ resume / from-stage / retry
//   startStage      from-stage / retry 起点（S1~S11）
//   sourceRunId     from-stage 必填（复用来源 run）
//   retryScope      retry 必填（client|server|both）
//   planOnly        true：from-stage 只出执行计划并 checkpoint 确认
//   step            true：每阶段完成后 checkpoint（拒绝 = 正常停止，产物保留）
//   stageIds        查证范围 CSV 或 ALL（作用于 S4/S5 分片）
//   templatePath / codeDir / fguiDir / serverSrcRoot / plannerPath  路径参数
//   analysisModel / writeModel / concurrency
//
// 返回：{ ok, date, runId, mode, startStage, sourceRunId, stopped, stoppedAfter,
//         reusedStages, executedStages, stageResults, registry/analysis/spec 摘要 }

export const meta = {
  id: 'game-requirement-audit',
  name: 'game_requirement_audit',
  description:
    '游戏需求审计统一工作流（S1~S11）：需求扫描→原子拆解→注册表→双端并行查证→同步屏障→业务行为/差异/L7→规格生成→人工裁决；支持 all/resume/from-stage/retry 与 strict 阶段复用',
  phases: [
    { title: '初始化 Run' },
    { title: '阶段复用' },
    { title: '需求解析 S1~S3' },
    { title: '双端查证 S4~S5' },
    { title: '统一分析 S6~S9' },
    { title: '规格生成 S10' },
    { title: '人工裁决 S11' },
  ],
}

const A = args || {}

// ---- args 校验 ----
const date = String(A.date || '').trim()
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  throw new Error('date 必填（YYYY-MM-DD；脚本内禁止取当前时间，经 args 传入）')
}
const templatePath =
  A.templatePath || 'templates/【杭州麻将】核心流程杭州麻将好友房AI-核心策划补齐版.md'
const codeDir = String(A.codeDir || 'source-code/client/Code')
const fguiDir = String(A.fguiDir || 'source-code/client/Fgui')
const serverSrcRoot = String(
  A.serverSrcRoot ||
    'E:/WorkProjects/xc-flow/.xflow/xc/xcodeDev/game-mahjong/server/Logic/mahjong_server/src'
)
const analysisModel =
  A.analysisModel === undefined ? 'biangfeng-gateway/deepseek-v4.1-flash-official' : A.analysisModel
const writeModel = A.writeModel === undefined ? '' : A.writeModel
const concurrency = Math.min(Number(A.concurrency) || 16, 16)
const stageIds = String(A.stageIds || 'ALL')

const MODES = ['all', 'resume', 'from-stage', 'retry']
const mode = MODES.includes(A.mode) ? A.mode : 'all'
const planOnly = A.planOnly === true
const stepMode = A.step === true

const DIR = './.opencode-workflows/workflows/game-requirement-audit'
const ROOT = 'spec-workflow/requirement-audit/' + date
const RUNS = ROOT + '/runs'
const REUSE = '".opencode-workflows/scripts/stage-reuse.mjs"'

// specs 双写注意（D38）：order/label 与 stage-specs.game-requirement-audit.json 保持一致
const STEPS = [
  { stageId: 'S1', label: '需求扫描', script: DIR + '/1-scan-template.js' },
  { stageId: 'S2', label: '原子拆解', script: DIR + '/2-atomize-requirements.js' },
  { stageId: 'S3', label: '注册表定稿', script: DIR + '/3-build-registry.js' },
  { stageId: 'S4', label: '客户端查证', script: DIR + '/4-client-verify.js' },
  { stageId: 'S5', label: '服务端查证', script: DIR + '/5-server-verify.js' },
  { stageId: 'S6', label: '证据汇总', script: DIR + '/6-merge-evidence.js' },
  { stageId: 'S7', label: '业务行为还原', script: DIR + '/7-business-behavior.js' },
  { stageId: 'S8', label: '统一差异复核', script: DIR + '/8-difference-review.js' },
  { stageId: 'S9', label: 'L7 分类', script: DIR + '/9-classify-l7.js' },
  { stageId: 'S10', label: '统一规格生成', script: DIR + '/10-unified-spec.js' },
  { stageId: 'S11', label: '人工裁决', script: DIR + '/11-human-review.js' },
]

let startStage = 'S1'
if (mode === 'from-stage' || mode === 'retry') {
  startStage = String(A.startStage || (mode === 'retry' ? 'S4' : '')).trim()
  const def = STEPS.find((s) => s.stageId === startStage)
  if (!def) {
    throw new Error(mode + ' 需 startStage ∈ {' + STEPS.map((s) => s.stageId).join(', ') + '}，实际：' + startStage)
  }
  if (mode === 'from-stage' && !String(A.sourceRunId || '').trim()) {
    throw new Error('from-stage 必填 sourceRunId（复用来源 run，如 run-001）')
  }
}
const retryScope = mode === 'retry' ? String(A.retryScope || '').trim() : null
if (mode === 'retry' && !['client', 'server', 'both'].includes(retryScope)) {
  throw new Error('retry 必填 retryScope ∈ {client, server, both}，实际：' + retryScope)
}
const sourceRunId = mode === 'from-stage' ? String(A.sourceRunId).trim() : null
const startIdx = STEPS.findIndex((s) => s.stageId === startStage)
// resume 会在定位 latest Run 后改写为「首个未完成阶段」；其它模式保持 startIdx。
let effectiveStartIdx = startIdx

setConcurrency(concurrency)
const withModel = (o) => (analysisModel ? { model: analysisModel, ...o } : o)

// ---- workflow 侧无 fs 的读回工具 ----
function readBack(label, filePath, schema, fields, timeoutMs) {
  return agent(
    [
      '你是文件回读器，工作目录为项目根目录。只做读取与转写，不做解读。',
      '',
      '任务：用 read 工具读取文件 ' + filePath + '（全文小文件），原样返回其中字段：' + fields + '。',
      '只输出结构化结果。',
    ].join('\n'),
    withModel({ label: label, schema: schema, timeoutMs: timeoutMs || 600000, retries: 2 })
  )
}

// echo agent 逐字写盘（中文值不进 shell 命令串，沿用 output-spec-generate build-config.json 先例）
function echoWrite(label, filePath, text) {
  return agent(
    [
      '你的任务是把下面 PART-BEGIN 与 PART-END 之间的 JSON 文本逐字写入文件：' + filePath,
      '',
      '要求：',
      '1. 使用 write 工具写入，UTF-8 编码。',
      '2. 内容逐字复制，不得改写、增删、总结或加代码围栏；缩进、引号、空行全部保留。',
      '3. 只写这一个文件，不要写其他文件，不要执行 git 命令。',
      '4. 写完后返回文件路径。',
      '',
      'PART-BEGIN',
      text,
      'PART-END',
    ].join('\n'),
    { label: label, agentType: 'general', timeoutMs: 900000, retries: 2, ...withModel({}) }
  )
}

// 每阶段 record-stage 的 configArgs / profile（键必须与 specs.configArgs 一致）
function stageArgsOf(stageId) {
  switch (stageId) {
    case 'S1':
    case 'S2':
      return { configArgs: { templatePath: templatePath }, profile: { model: analysisModel, concurrency: String(concurrency) } }
    case 'S3':
      return { configArgs: { date: date }, profile: {} }
    case 'S4':
      return { configArgs: { date: date, codeDir: codeDir, fguiDir: fguiDir }, profile: { model: analysisModel, concurrency: String(concurrency) } }
    case 'S5':
      return { configArgs: { date: date, serverSrcRoot: serverSrcRoot }, profile: { model: analysisModel, concurrency: String(concurrency) } }
    case 'S6':
    case 'S7':
    case 'S8':
    case 'S9':
      return { configArgs: { date: date }, profile: { model: analysisModel, concurrency: String(concurrency) } }
    case 'S10':
      return { configArgs: { date: date }, profile: { model: analysisModel, writeModel: writeModel } }
    case 'S11':
      return { configArgs: { date: date }, profile: {} }
    default:
      return null
  }
}

async function recordStage(stageId) {
  const sa = stageArgsOf(stageId)
  if (!sa) throw new Error('recordStage 未覆盖阶段：' + stageId)
  const argsFile = runDir + '/runtime/stage-args-' + stageId + '.json'
  await echoWrite('写阶段参数 ' + stageId, argsFile, JSON.stringify(sa, null, 1))
  const ok = await commandSuccess(
    'node ' + REUSE + ' record-stage "' + date + '" "' + runId + '" ' + stageId + ' --args-file "' + argsFile + '"',
    120000
  )
  if (!ok) throw new Error('record-stage ' + stageId + ' 失败（见上方命令日志）')
  // run-state 推进（失败不阻断主链，run-state 是诊断视图）
  await commandSuccess(
    'node ".opencode-workflows/scripts/run-state.mjs" advance --run-dir "' + runDir + '" --date "' + date +
      '" --stage ' + stageId + ' --outcome completed',
    60000
  )
}

async function gate(stageId, summary) {
  if (!stepMode) return
  await checkpoint(
    '阶段 ' + stageId + ' 完成：' + summary + '（观察产物后确认继续；拒绝则在此停止）',
    { default: true }
  )
}

// ============================================================
// 初始化 Run / resume 定位
// ============================================================

phase('初始化 Run')

let runId
let runDir
if (mode === 'resume') {
  const latest = await readBack(
    '回读 latest.json',
    RUNS + '/latest.json',
    {
      type: 'object',
      properties: { date: { type: 'string' }, runId: { type: 'string' } },
      required: ['runId'],
    },
    'date / runId'
  )
  if (!latest || latest.date !== date || !/^run-\d{3}$/.test(latest.runId || '')) {
    throw new Error('resume 失败：latest.json 无本日期 Run（先跑 mode=all）')
  }
  runId = latest.runId
  runDir = RUNS + '/' + runId

  // resume 的定义：从当前 Run 的 stage-manifest 中找首个非 completed 阶段，
  // 已完成阶段绝不重新调度（否则 resume 会退化为 all）。
  const resumeManifest = await readBack(
    '回读 resume 阶段状态',
    runDir + '/runtime/stage-manifest.json',
    {
      type: 'object',
      properties: {
        stages: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: { status: { type: 'string' } },
            required: ['status'],
          },
        },
      },
      required: ['stages'],
    },
    'stages 各阶段 status',
    900000
  )
  if (!resumeManifest || !resumeManifest.stages) {
    throw new Error('resume 失败：stage-manifest.json 回读异常（不猜测已完成阶段）')
  }
  const nextIdx = STEPS.findIndex((s) => !resumeManifest.stages[s.stageId] || resumeManifest.stages[s.stageId].status !== 'completed')
  if (nextIdx < 0) {
    effectiveStartIdx = STEPS.length
    startStage = 'completed'
    log('resume：Run ' + runId + ' 的 S1~S11 均已 completed，无阶段需要重跑')
  } else {
    effectiveStartIdx = nextIdx
    startStage = STEPS[nextIdx].stageId
    const previous = nextIdx > 0 ? 'S1~' + STEPS[nextIdx - 1].stageId : '无'
    log('resume：Run ' + runId + ' 从首个未完成阶段 ' + startStage + ' 继续（已跳过 ' + previous + '）')
  }
} else {
  const initOk = await commandSuccess('node ' + REUSE + ' init-run "' + date + '"', 60000)
  if (!initOk) throw new Error('init-run 失败（检查 date 与写权限）')
  const latest = await readBack(
    '回读 latest.json',
    RUNS + '/latest.json',
    {
      type: 'object',
      properties: { date: { type: 'string' }, runId: { type: 'string' } },
      required: ['date', 'runId'],
    },
    'date / runId'
  )
  if (!latest || latest.date !== date || !/^run-\d{3}$/.test(latest.runId || '')) {
    throw new Error('latest.json 回读异常：' + JSON.stringify(latest))
  }
  runId = latest.runId
  runDir = RUNS + '/' + runId
}
log('Run：' + runDir + '（mode=' + mode + '，startStage=' + startStage + (sourceRunId ? '，sourceRunId=' + sourceRunId : '') + (retryScope ? '，retryScope=' + retryScope : '') + '）')

// ============================================================
// 输入就位检查（必须在 resume 定位 effectiveStartIdx 后；已完成阶段不要求其源码仍存在）
// ============================================================

if (effectiveStartIdx <= 1) {
  await check(() => fileExists(templatePath), '需求模板不存在（S1/S2 需要）：' + templatePath)
}
if (effectiveStartIdx <= 3) {
  await check(() => fileExists(codeDir), '客户端代码工程不存在（S4 需要）：' + codeDir)
  await check(() => fileExists(fguiDir), 'FairyGUI 工程不存在（S4 需要）：' + fguiDir)
}
if (effectiveStartIdx <= 4) {
  await check(() => fileExists(serverSrcRoot), '服务端源码根不存在（S5 需要）：' + serverSrcRoot)
}

// ============================================================
// 阶段复用（from-stage strict 四指纹 / retry 端级补证）
// ============================================================

const reusedStages = []
if (mode === 'from-stage' && startIdx > 0) {
  phase('阶段复用')
  const reuseArgsFile = runDir + '/runtime/reuse-args.json'
  await echoWrite(
    '写复用参数',
    reuseArgsFile,
    JSON.stringify(
      {
        configArgs: {
          templatePath: templatePath,
          date: date,
          codeDir: codeDir,
          fguiDir: fguiDir,
          serverSrcRoot: serverSrcRoot,
        },
      },
      null,
      1
    )
  )
  const prepareBase =
    'node ' + REUSE + ' prepare-from-stage "' + date + '" --source-run "' + sourceRunId +
    '" --target-run "' + runId + '" --start-stage ' + startStage + ' --args-file "' + reuseArgsFile + '"'

  if (planOnly) {
    const planOk = await commandSuccess(prepareBase + ' --plan-only', 180000)
    if (!planOk) {
      throw new Error('prepare-from-stage plan-only 失败（strict 复用校验未通过，明细见上方命令日志）')
    }
    const plan = await readBack(
      '回读 reuse-plan',
      runDir + '/runtime/reuse-plan.json',
      {
        type: 'object',
        properties: {
          reusedStages: { type: 'array', items: { type: 'string' } },
          rerunStages: { type: 'array', items: { type: 'string' } },
        },
        required: ['reusedStages', 'rerunStages'],
      },
      'reusedStages / rerunStages'
    )
    if (!plan || !Array.isArray(plan.reusedStages)) throw new Error('reuse-plan 回读异常：' + JSON.stringify(plan))
    log(
      '执行计划（plan-only）：复用 ' + (plan.reusedStages.length ? plan.reusedStages.join(',') : '（无）') +
        ' / 重跑 ' + plan.rerunStages.join(',') + '（详情 ' + runDir + '/runtime/reuse-plan.json）'
    )
    let proceed = false
    try {
      proceed = await checkpoint(
        'plan-only 计划：复用 ' + (plan.reusedStages.join(',') || '（无）') + ' / 重跑 ' + plan.rerunStages.join(',') +
          '。确认后执行；拒绝则停止（计划已留档）',
        { default: true }
      )
    } catch (e) {
      if (e && e.code === 'CHECKPOINT_REJECTED') proceed = false
      else throw e
    }
    if (!proceed) {
      log('plan-only：用户在确认点停止（计划留档）')
      return {
        ok: true,
        date: date,
        runId: runId,
        mode: mode,
        startStage: startStage,
        sourceRunId: sourceRunId,
        planOnlyUsed: true,
        stopped: true,
        stoppedAfter: 'prepare-plan',
        reusedStages: plan.reusedStages,
        executedStages: [],
        stageResults: {},
        summary: 'Run ' + runId + ' plan-only：用户确认点停止',
      }
    }
  }

  const prepareOk = await commandSuccess(prepareBase, 180000)
  if (!prepareOk) {
    throw new Error('prepare-from-stage 失败（strict 四指纹不匹配，拒绝复用 fail fast；明细见上方命令日志）')
  }
  reusedStages.push(...STEPS.slice(0, startIdx).map((s) => s.stageId))
  log('阶段复用完成：' + reusedStages.join(',') + ' 自 ' + sourceRunId + ' 物化（来源 Run 零写入）')
}

if (mode === 'retry') {
  phase('阶段复用')
  const impact = await readBack(
    '回读影响集合',
    runDir + '/6-review/runtime/impact-set.json',
    {
      type: 'object',
      properties: {
        analysisRunId: { type: 'string' },
        impactSet: {
          type: 'object',
          properties: {
            client: { type: 'array', items: { type: 'string' } },
            server: { type: 'array', items: { type: 'string' } },
          },
          required: ['client', 'server'],
        },
        retryScopeTargets: {
          type: 'object',
          properties: {
            client: { type: 'array', items: { type: 'string' } },
            server: { type: 'array', items: { type: 'string' } },
          },
          required: ['client', 'server'],
        },
      },
      required: ['impactSet'],
    },
    'impactSet.client / impactSet.server / retryScopeTargets',
    900000
  )
  if (!impact || !impact.impactSet) throw new Error('retry 失败：缺少 impact-set.json（先跑 S11 生成影响集合）')
  log(
    'retry（' + retryScope + '）：重跑影响集合 client ' + impact.impactSet.client.length +
      ' / server ' + impact.impactSet.server.length + ' 个原子，自 ' + startStage + ' 起'
  )
}

// ============================================================
// 逐阶段执行（startStage 起；上游已复用）
// ============================================================

const executedStages = []
const stageResults = {}
let stoppedAfter = null

const childBase = { runDir, date, analysisModel, writeModel, concurrency }

async function runStage(stageId) {
  const def = STEPS.find((s) => s.stageId === stageId)
  if (!def) throw new Error('未知阶段：' + stageId)
  return workflow(
    { scriptPath: def.script, label: def.label },
    Object.assign({}, childBase, {
      templatePath: templatePath,
      codeDir: codeDir,
      fguiDir: fguiDir,
      serverSrcRoot: serverSrcRoot,
      stageIds: stageIds,
      trigger: mode === 'retry' ? 'retry' : mode === 'resume' ? 'resume' : 'initial',
      plannerPath: runDir + '/5-specs/策划版.md',
      retryScope: retryScope,
      impactSet: stageResults.impactSet || null,
    })
  )
}

try {
  // ---- S1~S3 需求解析 ----
  if (effectiveStartIdx <= 2) {
    if (effectiveStartIdx <= 0) {
      phase('需求解析 S1~S3')
      const s1 = await runStage('S1')
      stageResults.S1 = s1
      await recordStage('S1')
      executedStages.push('S1')
      await gate('S1', 'stage 章节 ' + s1.stageCount + ' 个')
    }
    if (effectiveStartIdx <= 1) {
      let scan = stageResults.S1
      if (!scan) {
        // S1 复用而 S2 要执行：从目标 Run 读回 scan（内存链式断点续传）
        const doc = await readBack(
          '回读 scan.json',
          runDir + '/1-registry/runtime/state/scan.json',
          {
            type: 'object',
            properties: {
              templatePath: { type: 'string' },
              totalLines: { type: 'number' },
              sections: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    no: { type: 'number' },
                    title: { type: 'string' },
                    fromLine: { type: 'number' },
                    toLine: { type: 'number' },
                    kind: { type: 'string' },
                    stageId: { type: 'string' },
                    container: { type: 'string' },
                    sourceTitle: { type: 'string' },
                  },
                  required: ['no', 'title', 'fromLine', 'toLine', 'kind'],
                },
              },
            },
            required: ['templatePath', 'totalLines', 'sections'],
          },
          'templatePath / totalLines / sections（含每节全部字段）',
          1800000
        )
        if (!doc || !Array.isArray(doc.sections)) throw new Error('scan.json 回读异常（S1 复用产物不可读）')
        scan = {
          templatePath: doc.templatePath,
          totalLines: doc.totalLines,
          sections: doc.sections,
          stageSections: doc.sections.filter((s) => s.kind === 'stage'),
          termsSection: doc.sections.find((s) => s.kind === 'terms') || null,
          scanPath: runDir + '/1-registry/runtime/state/scan.json',
          stageCount: doc.sections.filter((s) => s.kind === 'stage').length,
        }
        if (scan.stageSections.length === 0) throw new Error('scan.json 无 stage 章节（复用产物异常）')
      }
      phase('需求解析 S1~S3')
      const s2 = await workflow(
        { scriptPath: STEPS[1].script, label: STEPS[1].label },
        Object.assign({}, childBase, { templatePath: templatePath, scan: scan })
      )
      stageResults.S2 = s2
      await recordStage('S2')
      executedStages.push('S2')
      await gate('S2', s2.stageCount + ' 阶段 / ' + s2.atomTotal + ' 原子')
    }
    if (effectiveStartIdx <= 2) {
      phase('需求解析 S1~S3')
      const s3 = await runStage('S3')
      stageResults.S3 = s3
      await recordStage('S3')
      executedStages.push('S3')
      await gate('S3', '原子 ' + s3.atomCount + '（scope client/server/both = ' + s3.scopeStats.client + '/' + s3.scopeStats.server + '/' + s3.scopeStats.both + '）')
    }
  }

  // ---- S4 ∥ S5 双端查证（共享并发配额，互不依赖） ----
  if (effectiveStartIdx <= 4) {
    phase('双端查证 S4~S5')
    const tasks = []
    if (effectiveStartIdx <= 3) tasks.push({ stageId: 'S4', label: '客户端查证' })
    if (effectiveStartIdx <= 4) tasks.push({ stageId: 'S5', label: '服务端查证' })
    const runs = await parallel(
      tasks.map((t) => async () => {
        const def = STEPS.find((s) => s.stageId === t.stageId)
        return {
          stageId: t.stageId,
          result: await workflow(
            { scriptPath: def.script, label: def.label },
            Object.assign({}, childBase, {
              templatePath: templatePath,
              codeDir: codeDir,
              fguiDir: fguiDir,
              serverSrcRoot: serverSrcRoot,
              stageIds: stageIds,
              retryScope: retryScope,
              impactSet: stageResults.impactSet || null,
            })
          ),
        }
      })
    )
    for (const r of runs) {
      stageResults[r.stageId] = r.result
      await recordStage(r.stageId)
      executedStages.push(r.stageId)
      await gate(
        r.stageId,
        'entry ' + r.result.entryCount + ' + pending ' + r.result.pendingCount + ' = ' + r.result.expectedAtomCount +
          ' / 证据 ' + r.result.evidenceCount + ' 条'
      )
    }
  }

  // ---- S6 同步屏障 ----
  if (effectiveStartIdx <= 5) {
    phase('统一分析 S6~S9')
    const s6 = await runStage('S6')
    stageResults.S6 = s6
    await recordStage('S6')
    executedStages.push('S6')
    await gate('S6', s6.analysisRunId + '：conflict-fast ' + s6.stats.conflictFast + ' / full ' + s6.stats.full + ' / blocked ' + s6.stats.blocked)
  }

  // ---- S7~S9 ----
  if (effectiveStartIdx <= 8) {
    if (effectiveStartIdx <= 6) {
      phase('统一分析 S6~S9')
      const s7 = await runStage('S7')
      stageResults.S7 = s7
      await recordStage('S7')
      executedStages.push('S7')
      await gate('S7', '原子 ' + s7.atomCount + '：conflict ' + s7.stats.conflict + ' / unverified ' + s7.stats.unverified)
    }
    if (effectiveStartIdx <= 7) {
      phase('统一分析 S6~S9')
      const s8 = await runStage('S8')
      stageResults.S8 = s8
      await recordStage('S8')
      executedStages.push('S8')
      await gate('S8', '复核条目 ' + s8.entryCount + '（pending ' + s8.reviewStatus.pending + '）')
    }
    if (effectiveStartIdx <= 8) {
      phase('统一分析 S6~S9')
      const s9 = await runStage('S9')
      stageResults.S9 = s9
      await recordStage('S9')
      executedStages.push('S9')
      await gate('S9', 'verified ' + s9.l7.verified + ' / decision_required ' + s9.l7.decisionRequired + ' / blocked ' + s9.blockedCount)
    }
  }

  // ---- S10 ----
  if (effectiveStartIdx <= 9) {
    phase('规格生成 S10')
    const s10 = await runStage('S10')
    stageResults.S10 = s10
    await recordStage('S10')
    executedStages.push('S10')
    await gate('S10', '阶段文档 ' + s10.stageDocCount + ' 份 / 策划版 ' + (s10.stats && s10.stats.plannerRuleCount) + ' 条规则')
  }

  // ---- S11 ----
  if (effectiveStartIdx <= 10) {
    phase('人工裁决 S11')
    const s11 = await runStage('S11')
    stageResults.S11 = s11
    if (s11.status === 'applied') {
      await recordStage('S11')
      executedStages.push('S11')
    } else {
      log('S11 未执行：' + s11.status + '（待人工写入 decisions.json 后用 from-stage startStage=S11 重跑）')
    }
  }
} catch (e) {
  if (e && e.code === 'CHECKPOINT_REJECTED') {
    stoppedAfter = executedStages[executedStages.length - 1] || 'prepare'
    log('step 模式：用户在检查点选择停止（完成至 ' + stoppedAfter + '），产物保留在磁盘')
  } else {
    throw e
  }
}

// ============================================================
// 汇总返回
// ============================================================

const summary =
  'Run ' + runId + '（mode=' + mode + '，startStage=' + startStage + (sourceRunId ? '，source=' + sourceRunId : '') + '）：' +
  (reusedStages.length ? '复用 ' + reusedStages.join(',') + '；' : '') +
  '执行 ' + (executedStages.join(',') || '（无）') +
  (stoppedAfter ? '；停止于 ' + stoppedAfter + ' 后' : '') +
  (stageResults.S6 ? '；' + stageResults.S6.analysisRunId : '') +
  (stageResults.S9
    ? '；L7 verified ' + stageResults.S9.l7.verified + ' / 待验证 ' + stageResults.S9.l7.verificationRequired +
      ' / 待裁决 ' + stageResults.S9.l7.decisionRequired
    : '') +
  (stageResults.S11 && stageResults.S11.status === 'awaiting-human-input' ? '；S11 待人工输入' : '')

log(summary)

return {
  ok: true,
  date: date,
  runId: runId,
  mode: mode,
  startStage: startStage,
  sourceRunId: sourceRunId,
  retryScope: retryScope,
  planOnlyUsed: planOnly,
  stopped: stoppedAfter !== null,
  stoppedAfter: stoppedAfter,
  reusedStages: reusedStages,
  executedStages: executedStages,
  registryPath: runDir + '/1-registry/requirement-registry.json',
  identityMapPath: runDir + '/1-registry/identity-map.json',
  clientEvidencePath: runDir + '/2-client/client-evidence.json',
  serverEvidencePath: runDir + '/3-server/server-evidence.json',
  scopeIndexPath: runDir + '/3-server/scope-index.json',
  unifiedAtomsPath: runDir + '/4-analysis/unified-atoms.json',
  businessBehaviorPath: runDir + '/4-analysis/business-behavior.json',
  differenceReviewPath: runDir + '/4-analysis/difference-review.json',
  l7Path: runDir + '/4-analysis/l7-classify.json',
  specDir: runDir + '/5-specs',
  plannerPath: runDir + '/5-specs/策划版.md',
  decisionsPath: runDir + '/6-review/decisions.json',
  stageResults: stageResults,
  summary: summary,
}
