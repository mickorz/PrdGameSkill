// Game-Requirement-Audit Workflow（主编排，阶段一 S1~S3 + 最小 Stage Reuse）
//
// 位置：本文件与三个子流程同在 game-requirement-audit/ 子目录（注册表只扫描 workflows/ 一级
// 目录，本目录脚本均不进注册表）——调用本工作流用 workflow 工具的 scriptPath（相对项目根）：
//   ./.opencode-workflows/workflows/game-requirement-audit/game-requirement-audit.js
// 不能按 workflowId 被 Schedule 引用或被其他脚本按名调用。
//
// 设计依据：dev-docs/planning/2026-11-17-game-requirement-audit-执行文档.md（头部 v3.2 冻结
// + §12 详细设计）。本轮交付范围（§10 开发顺序 ②+③）：
//   S1 需求扫描（1-scan-template.js 迁移）
//   S2 原子拆解（2-atomize-requirements.js，只拆解不查证）
//   S3 注册表定稿（3-build-registry.js + build-requirement-registry.mjs 确定性合并）
//   最小 Stage Reuse 第一阶段（stage-reuse.mjs：stage-manifest / strict / from-stage /
//   物化复制 Artifact Reference / verify-immutable，§11.9 实验 from-stage=S3）
//   S4~S11 未接入（STEPS 表扩展位已留）。
//
// 职责链（内存链式传参，不经文件中转）：
//   init-run（确定性）-> [from-stage] prepare-from-stage（strict 四指纹 + 物化复制）
//   -> S1 scan（agent）-> record-stage S1 -> S2 atomize（agent 并行）-> record-stage S2
//   -> S3 build-registry（确定性）-> record-stage S3 -> 汇总返回
//
// record-stage 契约（§11.3，agent 严禁自填指纹）：每阶段闸门通过后由本主编排统一调用
//   stage-reuse.mjs record-stage，指纹规格来自 stage-specs.game-requirement-audit.json
//   （specs 的 order/label 与本文件 STEPS 表双写，D38——新增阶段/调序同步两处）。
//
// 2026-11-17 生成前问询结论（沿用 2026-11-14 档位）：
//   档位：速度优先（分析类快模型；质量靠确定性闸门兜底）
//   分析类模型：biangfeng-gateway/deepseek-v4.1-flash-official（本仓库已验证可用）
//   并发：16（主脚本 setConcurrency，子流程共享配额）
//
// args：
//   date            必填，运行日期 YYYY-MM-DD（产物根 spec-workflow/requirement-audit/<date>/runs/；
//                   脚本内禁止取当前时间）
//   mode            all（默认）/ from-stage（resume/retry 待 S4~S11 接入）
//   startStage      from-stage 起点（S1~S3）
//   sourceRunId     from-stage 必填（复用来源 run，如 run-001）
//   planOnly        true：prepare 只出执行计划（reuse-plan.json）-> checkpoint 人工确认后才真执行
//   step            true：每阶段完成后 checkpoint（拒绝 = 正常停止，产物保留）
//   templatePath    需求模板，默认 templates/【杭州麻将】核心流程杭州麻将好友房AI-核心简化版本.md
//   analysisModel   分析类模型，默认 biangfeng-gateway/deepseek-v4.1-flash-official（传空串用会话默认）
//   concurrency     并发上限，默认 16（钳制到 16）
//
// 返回：
//   { ok, date, runId, mode, startStage, sourceRunId, planOnlyUsed, stopped, stoppedAfter,
//     reusedStages, executedStages, registryPath, identityMapPath, stats }

export const meta = {
  id: 'game-requirement-audit',
  name: 'game_requirement_audit',
  description:
    '游戏需求审计统一工作流（阶段一 S1~S3 + 最小 Stage Reuse）：需求扫描 -> 原子拆解 -> 注册表定稿，from-stage 阶段复用（strict 指纹校验）',
  phases: [
    { title: '初始化 Run' },
    { title: '阶段复用' },
    { title: '需求扫描' },
    { title: '原子拆解' },
    { title: '注册表定稿' },
  ],
}

const A = args || {}

// ---- args 校验 ----

const date = String(A.date || '').trim()
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  throw new Error('date 必填（YYYY-MM-DD；脚本内禁止取当前时间，经 args 传入）')
}
const templatePath =
  A.templatePath || 'templates/【杭州麻将】核心流程杭州麻将好友房AI-核心简化版本.md'
const analysisModel =
  A.analysisModel === undefined ? 'biangfeng-gateway/deepseek-v4.1-flash-official' : A.analysisModel
const concurrency = Math.min(Number(A.concurrency) || 16, 16)
const mode = A.mode === 'from-stage' ? 'from-stage' : 'all'
const planOnly = A.planOnly === true
const stepMode = A.step === true

const DIR = './.opencode-workflows/workflows/game-requirement-audit'
const ROOT = 'spec-workflow/requirement-audit/' + date
const RUNS = ROOT + '/runs'
const REUSE_SCRIPT = '".opencode-workflows/scripts/stage-reuse.mjs"'
// specs 双写注意（D38）：order/label 与 stage-specs.game-requirement-audit.json 保持一致
const STEPS = [
  { n: 1, stageId: 'S1', label: '需求扫描', script: DIR + '/1-scan-template.js' },
  { n: 2, stageId: 'S2', label: '原子拆解', script: DIR + '/2-atomize-requirements.js' },
  { n: 3, stageId: 'S3', label: '注册表定稿', script: DIR + '/3-build-registry.js' },
]

let startStage = 'S1'
if (mode === 'from-stage') {
  startStage = String(A.startStage || '').trim()
  const stepDef = STEPS.find((s) => s.stageId === startStage)
  if (!stepDef) {
    throw new Error('from-stage 需 startStage ∈ {S1, S2, S3}（本轮交付 S1~S3；S4~S11 待接入），实际：' + startStage)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !String(A.sourceRunId || '').trim()) {
    throw new Error('from-stage 必填 sourceRunId（复用来源 run，如 run-001）')
  }
}
const sourceRunId = mode === 'from-stage' ? String(A.sourceRunId).trim() : null
const startIdx = STEPS.findIndex((s) => s.stageId === startStage) // 0 起

setConcurrency(concurrency)

// read-back agent 工具（workflow 侧无 fs，结构化小文件经 agent 取回）
function readBack(label, filePath, schema, fields) {
  return agent(
    [
      '你是文件回读器，工作目录为项目根目录。只做读取与转写，不做解读。',
      '',
      '任务：用 read 工具读取文件 ' + filePath + '（全文小文件），原样返回其中字段：' + fields + '。',
      '只输出结构化结果。',
    ].join('\n'),
    withModel({ label, schema, timeoutMs: 600000, retries: 2 })
  )
}

function withModel(opts) {
  return analysisModel ? { model: analysisModel, ...opts } : opts
}

// echo agent 逐字写盘（中文值不进 shell 命令串：configArgs/profile 经 runtime JSON 传递，
// 沿用 output-spec-generate build-config.json 先例；CLI 参数保持 ASCII）
function echoWrite(label, filePath, text) {
  return agent(
    [
      '你的任务是把下面 PART-BEGIN 与 PART-END 之间的 JSON 文本逐字写入文件：' + filePath,
      '',
      '要求：',
      '1. 使用 write 工具写入，UTF-8 编码。',
      '2. 内容逐字复制，不得改写、增删、总结或加代码围栏；缩进、引号全部保留。',
      '3. 只写这一个文件，不要写其他文件，不要执行 git 命令。',
      '4. 写完后返回文件路径。',
      '',
      'PART-BEGIN',
      text,
      'PART-END',
    ].join('\n'),
    {
      label,
      agentType: 'general',
      timeoutMs: 900000,
      retries: 2,
      ...withModel({}),
    }
  )
}

// record-stage 命令构造（指纹由 stage-reuse.mjs 按 specs 采集，agent 零填写；
// argsFile 写 <runDir>/runtime/stage-args-<stageId>.json（中文值经文件传递，命令串纯 ASCII）
async function recordStage(stageId) {
  const argsMap =
    stageId === 'S1' || stageId === 'S2'
      ? { templatePath: templatePath }
      : stageId === 'S3'
        ? { date: date }
        : null
  if (!argsMap) throw new Error('recordStage 未覆盖阶段：' + stageId)
  const profileMap =
    stageId === 'S1' || stageId === 'S2' ? { model: analysisModel, concurrency: String(concurrency) } : {}
  const argsFile = runDir + '/runtime/stage-args-' + stageId + '.json'
  await echoWrite(
    '写阶段参数 ' + stageId,
    argsFile,
    JSON.stringify({ configArgs: argsMap, profile: profileMap }, null, 1)
  )
  const cmd =
    'node ' + REUSE_SCRIPT + ' record-stage "' + date + '" "' + runId + '" ' + stageId +
    ' --args-file "' + argsFile + '"'
  const ok = await commandSuccess(cmd, 60000)
  if (!ok) throw new Error('record-stage ' + stageId + ' 失败（见上方命令日志）')
}

// step 模式检查点（拒绝 = 正常停止；headless 自动继续）
async function gate(stageId, summary) {
  if (!stepMode) return
  await checkpoint(
    '阶段 ' + stageId + ' 完成：' + summary + '（观察产物后确认继续；拒绝则在此停止）',
    { default: true }
  )
}

// ============================================================
// 输入就位检查（fail fast）
// ============================================================

await check(() => fileExists(templatePath), '需求模板不存在：' + templatePath)

// ============================================================
// 初始化 Run（init-run：run-NNN + stage-manifest 骨架 + latest.json）
// ============================================================

phase('初始化 Run')

const initOk = await commandSuccess('node ' + REUSE_SCRIPT + ' init-run "' + date + '"', 60000)
if (!initOk) {
  throw new Error('init-run 失败（见上方命令日志；检查 date 与仓库根写权限）')
}
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
const runId = latest.runId
const runDir = RUNS + '/' + runId

log('Run 初始化：' + runDir + '（mode=' + mode + (mode === 'from-stage' ? '，startStage=' + startStage + '，sourceRunId=' + sourceRunId : '') + '）')

// ============================================================
// 阶段复用（from-stage：strict 四指纹校验 + 物化复制；planOnly 先出计划再人工确认）
// ============================================================

const reusedStages = []
if (mode === 'from-stage' && startIdx > 0) {
  phase('阶段复用')
  // 中文值（templatePath）不进 shell：configArgs 经 runtime JSON 文件传递（echo agent 写盘）
  const reuseArgsFile = runDir + '/runtime/reuse-args.json'
  await echoWrite(
    '写复用参数',
    reuseArgsFile,
    JSON.stringify({ configArgs: { templatePath: templatePath, date: date } }, null, 1)
  )
  const prepareBase =
    'node ' + REUSE_SCRIPT + ' prepare-from-stage "' + date + '" --source-run "' + sourceRunId +
    '" --target-run "' + runId + '" --start-stage ' + startStage + ' --args-file "' + reuseArgsFile + '"'

  if (planOnly) {
    const planOk = await commandSuccess(prepareBase + ' --plan-only', 120000)
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
    if (!plan || !Array.isArray(plan.reusedStages) || !Array.isArray(plan.rerunStages)) {
      throw new Error('reuse-plan 回读异常：' + JSON.stringify(plan))
    }
    log(
      '执行计划（plan-only）：复用 ' + (plan.reusedStages.length ? plan.reusedStages.join(',') : '（无）') +
        ' / 重跑 ' + plan.rerunStages.join(',') + '（计划详情 ' + runDir + '/runtime/reuse-plan.json）'
    )
    let proceed = false
    try {
      proceed = await checkpoint(
        'plan-only 执行计划如上（复用 ' + plan.reusedStages.join(',') + ' / 重跑 ' + plan.rerunStages.join(',') +
          '）。确认后执行复用与重跑；拒绝则停止（计划已留档）',
        { default: true }
      )
    } catch (e) {
      if (e && e.code === 'CHECKPOINT_REJECTED') proceed = false
      else throw e
    }
    if (!proceed) {
      log('plan-only：用户在确认点选择停止（计划留档 ' + runDir + '/runtime/reuse-plan.json）')
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
        registryPath: null,
        identityMapPath: null,
        stats: null,
        summary: 'Run ' + runId + ' plan-only：用户在确认点停止（计划留档）',
      }
    }
  }

  const prepareOk = await commandSuccess(prepareBase, 120000)
  if (!prepareOk) {
    throw new Error('prepare-from-stage 失败（strict 四指纹校验未通过，拒绝复用 fail fast；明细见上方命令日志）')
  }
  reusedStages.push(...STEPS.slice(0, startIdx).map((s) => s.stageId))
  log('阶段复用完成：' + reusedStages.join(',') + ' 自 ' + sourceRunId + ' 物化（来源 Run 零写入）')
}

// ============================================================
// 逐阶段执行（startStage 起；上游已复用）
// ============================================================

const executedStages = []
let scan = null
let atomize = null
let registry = null
let stoppedAfter = null

try {
  // ---- S1 需求扫描 ----
  if (startIdx <= 0) {
    phase('需求扫描')
    scan = await workflow(
      { scriptPath: STEPS[0].script, label: STEPS[0].label },
      { runDir, templatePath, analysisModel, concurrency }
    )
    await recordStage('S1')
    executedStages.push('S1')
    await gate('S1', 'stage 章节 ' + scan.stageCount + ' 个，扫描结果 ' + scan.scanPath)
  } else {
    log('S1 需求扫描：复用 ' + sourceRunId + '（跳过执行）')
  }

  // ---- S2 原子拆解 ----
  if (startIdx <= 1) {
    phase('原子拆解')
    if (!scan) {
      // S1 被复用而 S2 将执行：scan 从目标 Run 的 scan.json 回读（内存链式断点续传）
      scan = await readBack(
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
        'templatePath / totalLines / sections（含每节全部字段）'
      )
      if (!scan || !Array.isArray(scan.sections)) {
        throw new Error('scan.json 回读异常：' + JSON.stringify(scan && scan.templatePath))
      }
      scan.stageSections = scan.sections.filter((s) => s.kind === 'stage')
      scan.termsSection = scan.sections.find((s) => s.kind === 'terms') || null
      if (scan.stageSections.length === 0) {
        throw new Error('scan.json 回读无 stage 章节（复用产物异常）')
      }
    }
    atomize = await workflow(
      { scriptPath: STEPS[1].script, label: STEPS[1].label },
      { runDir, templatePath, analysisModel, concurrency, scan }
    )
    await recordStage('S2')
    executedStages.push('S2')
    await gate(
      'S2',
      atomize.stageCount + ' 阶段 / ' + atomize.featureTotal + ' 功能点 / ' + atomize.atomTotal +
        ' 原子项（scope：client ' + atomize.scopeStats.client + ' / server ' + atomize.scopeStats.server +
        ' / both ' + atomize.scopeStats.both + '）-> ' + atomize.shardDir
    )
  } else {
    log('S2 原子拆解：复用 ' + sourceRunId + '（跳过执行）')
  }

  // ---- S3 注册表定稿 ----
  if (startIdx <= 2) {
    phase('注册表定稿')
    registry = await workflow(
      { scriptPath: STEPS[2].script, label: STEPS[2].label },
      { runDir, date, analysisModel, concurrency }
    )
    await recordStage('S3')
    executedStages.push('S3')
    await gate(
      'S3',
      '阶段 ' + registry.stageCount + ' / 功能点 ' + registry.featureCount + ' / 原子 ' + registry.atomCount +
        ' -> ' + registry.registryPath
    )
  } else {
    log('S3 注册表定稿：复用（跳过执行）')
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
  'Run ' + runId + '（mode=' + mode + (sourceRunId ? '，source=' + sourceRunId : '') + '）：' +
  (reusedStages.length ? '复用 ' + reusedStages.join(',') + '；' : '') +
  '执行 ' + (executedStages.join(',') || '（无）') +
  (stoppedAfter ? '；用户停止于 ' + stoppedAfter + ' 后' : '') +
  (registry
    ? '；Registry：阶段 ' + registry.stageCount + ' / 功能点 ' + registry.featureCount + ' / 原子 ' + registry.atomCount +
      '（scope client/server/both = ' + registry.scopeStats.client + '/' + registry.scopeStats.server + '/' + registry.scopeStats.both + '）'
    : '')

log(summary)

return {
  ok: true,
  date: date,
  runId: runId,
  mode: mode,
  startStage: startStage,
  sourceRunId: sourceRunId,
  planOnlyUsed: planOnly,
  stopped: stoppedAfter !== null,
  stoppedAfter: stoppedAfter,
  reusedStages: reusedStages,
  executedStages: executedStages,
  registryPath: registry ? registry.registryPath : runDir + '/1-registry/requirement-registry.json',
  identityMapPath: registry ? registry.identityMapPath : runDir + '/1-registry/identity-map.json',
  stats: registry
    ? { stageCount: registry.stageCount, featureCount: registry.featureCount, atomCount: registry.atomCount, scopeStats: registry.scopeStats }
    : null,
  summary: summary,
}
