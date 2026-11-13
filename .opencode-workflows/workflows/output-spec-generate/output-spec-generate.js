// Output-Spec Generate Workflow（主编排，四子流程拆分版）
//
// 位置：本文件与四个子流程同在 output-spec-generate/ 子目录（2026-11-13 拆分时一并移入）。
// 注意：注册表只扫描 workflows/ 一级目录，本目录脚本均不进注册表——
//   调用本工作流用 workflow 工具的 scriptPath（相对项目根）：
//   ./.opencode-workflows/workflows/output-spec-generate/output-spec-generate.js
//   不能按 workflowId 被 Schedule 引用或被其他脚本按名调用（如需恢复按名调用，移回一级目录即可）。
//
// v2 outputMode 三模式（2026-11-14，需求 R7/R10，T4.1~T4.5，
//   见 dev-docs/requirements/2026-11-14-outputspec策划需求视图与技术实现视图分离.md）：
//   | 模式 | 查证 | 技术文档（阶段规格/索引/技术补充版） | 策划版 |
//   | all（默认） | 执行（子流程 2） | 生成（写 outputDir） | 生成 |
//   | planner-only | 跳过（复用 sourceSpecDir 历史证据，只读） | 复用已有，绝不重写 | 生成 |
//   | legacy | 执行 | 生成 | 不生成（行为等同 v2） |
//   - planner-only：跳过子流程 1/2，先跑 prepare-planner-doc-input.mjs（sourceSpecDir 只读 ->
//     outputDir/runtime/planner-input 业务证据），子流程 3 以 plannerOnly 磁盘输入模式只调度
//     策划版任务，子流程 4 走策划版分支（合并分片 -> 追溯索引 -> 泄漏检查 -> AT-ID 覆盖检查）。
//   - 产物目录读写分离（R10）：sourceSpecDir 只读（默认首跑 2026-11-13 目录），outputDir 可写
//     （默认 2026-11-14）；运行前 fail fast：outputDir === sourceSpecDir 报错；outputDir 内已存在
//     feature_index.json 或 stage_manifest.md 报错（策划版分片残留允许，支持断点续跑）。
//   - 中文路径经 runtime/build-config.json 传递（prepare 命令 CLI 参数为 ASCII 目录路径）。
//
// 由 dev-docs/design/outputspec生成工作流计划.md 转写（2026-11-13），同日拆分为四个子 workflow：
//   本文件只做编排：输入检查 -> 顺序调度四个子流程（内存链式传参，不经文件中转）-> 汇总返回。
//   子流程位于本目录（注册表只扫描 workflows/ 一级目录，子目录脚本经显式相对路径调用）：
//     output-spec-generate/1-scan-template.js   扫描模板章节 + 覆盖校验 + scan.json 落盘
//     output-spec-generate/2-verify-stages.js   按阶段并行拆原子 + 客户端代码查证（explore 只读 + schema）
//     output-spec-generate/3-produce-outputs.js 阶段规格文档 + 索引片段 echo + 补充版分片 + 策划版分片 + 构建配置 echo
//     output-spec-generate/4-assemble-verify.js 确定性装配 + 机械校验（build-output-spec.mjs）
//
// 读取需求模板（杭州麻将好友房AI 核心简化版本）拆分原子需求，对照客户端代码
// （Code 代码工程 + Fgui FairyGUI 工程）查证，补充客户端逻辑与 UI 交互，产出：
//   1. specDir（默认 spec-workflow/output-spec/2026-11-14/1-spec/，all/legacy 由 outputDir 派生）
//      —— 结构对齐原 1-spec（stages/spec_stage_ST-Cxx.md + feature_index.json + stage_manifest.md + runtime/）
//   2. 补充版需求文档（模板复制后补充完整版，默认 spec-workflow/output-spec/核心流程杭州麻将好友房AI-补充版本.md）
//   3. 策划版需求文档（v2 新增，纯业务语言，默认 spec-workflow/output-spec/核心流程杭州麻将好友房AI-策划版.md）
//
// 结构依据：dev-docs/research/2026-11-13-v3-1spec-结构分析.md（Stage/Feature/Atom 数据层级、
// 阶段文档字段模板、runtime/ 产物形态；本产出的职责域为 client，来源指向客户端代码证据）。
//
// 2026-11-13 生成前问询结论（落为常量与默认值，各子流程同款默认值）：
//   档位：速度优先（不做审核/修正闭环，靠确定性装配 + verify-output-spec 机械闸门收尾）
//   分析类模型：biangfeng-gateway/deepseek-v4.1-flash-official（本仓库 5 个 workflow 已验证可用）
//   写作类模型：会话默认（阶段规格文档与补充版章节写作不显式传 model）
//   并发：16（主脚本 setConcurrency，四个子流程共享同一配额）
//
// 执行模式（args.mode）：
//   'all'  （默认）一次性顺序跑完四个子流程
//   'step' 分步执行：每个子流程完成后 checkpoint 人工确认点，观察该步产物后确认继续；
//          拒绝检查点 = 在该步后停止（run 以 stopped:true 正常结束，已完成产物保留在磁盘）；
//          中途中止（abort）整个 run 可用 resumeFromRunId 断点续跑（已完成 agent 从 journal 重放不重扣 token）；
//          headless/无确认通道时检查点自动取 default:true 继续（等价 all 模式）
//
// 可选 args（未标注的经 childArgs 原样透传给四个子流程，默认值在各子流程内）：
//   mode            执行模式，默认 'all'；'step' 为分步执行
//   outputMode      产出模式（v2），默认 'all'；'planner-only' 只产出策划版；'legacy' 行为等同 v2
//   templatePath    需求模板，默认 templates/【杭州麻将】核心流程杭州麻将好友房AI-核心简化版本.md
//   codeDir         客户端代码工程，默认 source-code/client/Code
//   fguiDir         FairyGUI 工程，默认 source-code/client/Fgui
//   specDir         1-spec 产出目录（显式传值时优先；默认由 outputMode 派生：
//                   all/planner-only -> outputDir；legacy -> spec-workflow/output-spec/2026-11-13/1-spec）
//   outputDir       可写产出目录（v2，R10），默认 spec-workflow/output-spec/2026-11-14/1-spec
//   sourceSpecDir   历史查证证据目录（v2，只读），默认 spec-workflow/output-spec/2026-11-13/1-spec
//   supplementPath  补充版文档输出路径，默认 spec-workflow/output-spec/核心流程杭州麻将好友房AI-补充版本.md
//   plannerPath     策划版文档输出路径（v2），默认 spec-workflow/output-spec/核心流程杭州麻将好友房AI-策划版.md
//   date            产出日期 YYYY-MM-DD（脚本内禁止取当前时间），默认 2026-11-14
//   analysisModel   分析类模型，默认 biangfeng-gateway/deepseek-v4.1-flash-official（传空串用会话默认）
//   concurrency     并发上限，默认 16（主脚本设置一次，子流程共享配额，运行时钳制到 16）
//
// 返回：
//   { ok, mode, outputMode, stopped, specDir, supplementPath, plannerPath, featureIndexPath,
//     stageManifestPath, verifyReportPath, traceIndexPath, outputDir, sourceSpecDir,
//     scanPath, stageCount, featureCount, atomCount, verdictStats, differenceStats, perStage }

export const meta = {
  id: 'output-spec-generate',
  name: 'output_spec_generate',
  description: '读取需求模板拆分原子需求，对照客户端代码（Code/Fgui）查证补充客户端逻辑与 UI 交互，产出 1-spec 规格目录、补充版与策划版需求文档（outputMode 三模式：all/planner-only/legacy）',
  phases: [
    { title: '扫描模板' },
    { title: '原子拆分与代码查证' },
    { title: '产出编写' },
    { title: '装配与校验' },
  ],
}

const A = args || {}

const mode = A.mode === 'step' ? 'step' : 'all'
// v2 产出模式（R7 模式契约）
const outputMode =
  A.outputMode === 'planner-only' || A.outputMode === 'legacy' ? A.outputMode : 'all'
const templatePath =
  A.templatePath || 'templates/【杭州麻将】核心流程杭州麻将好友房AI-核心简化版本.md'
const codeDir = A.codeDir || 'source-code/client/Code'
const fguiDir = A.fguiDir || 'source-code/client/Fgui'
// v2 产物目录读写分离（R10）：sourceSpecDir 只读历史证据，outputDir 可写新产物
const sourceSpecDir = A.sourceSpecDir || 'spec-workflow/output-spec/2026-11-13/1-spec'
const outputDir = A.outputDir || 'spec-workflow/output-spec/2026-11-14/1-spec'
// specDir 派生：all/planner-only 统一写 outputDir；legacy 保持 v2 默认（旧行为兼容）
const specDir =
  A.specDir || (outputMode === 'legacy' ? 'spec-workflow/output-spec/2026-11-13/1-spec' : outputDir)
const supplementPath =
  A.supplementPath || 'spec-workflow/output-spec/核心流程杭州麻将好友房AI-补充版本.md'
const plannerPath =
  A.plannerPath || 'spec-workflow/output-spec/核心流程杭州麻将好友房AI-策划版.md'

setConcurrency(A.concurrency || 16)

// 子流程脚本路径（显式相对项目根的路径；子目录脚本不可按名调用）
const DIR = './.opencode-workflows/workflows/output-spec-generate'
const STEPS = [
  { n: 1, label: '扫描模板', script: DIR + '/1-scan-template.js' },
  { n: 2, label: '原子拆分与代码查证', script: DIR + '/2-verify-stages.js' },
  { n: 3, label: '产出编写', script: DIR + '/3-produce-outputs.js' },
  { n: 4, label: '装配与校验', script: DIR + '/4-assemble-verify.js' },
]

// 透传子流程的参数：剔除主编排自用字段；concurrency 照常透传，
// 子流程 setConcurrency 同值重复设置无害，且保证子流程不会把用户自定义配额重置回默认 16
function childArgs(extra) {
  const c = {}
  for (const k of Object.keys(A)) {
    if (k !== 'mode' && k !== 'outputMode') c[k] = A[k]
  }
  if (outputMode === 'legacy') c.skipPlanner = true
  if (outputMode === 'planner-only') c.plannerOnly = true
  c.specDir = specDir
  c.plannerPath = plannerPath
  if (outputMode === 'planner-only') c.sourceSpecDir = sourceSpecDir
  return extra ? Object.assign(c, extra) : c
}

// 分步执行的人工确认点（拒绝 = 在该步后停止；headless 自动按 default 继续）
async function gate(step, summary) {
  if (mode !== 'step') return
  await checkpoint(
    '步骤 ' + step.n + '/4「' + step.label + '」完成：' + summary + '（观察产物后确认继续下一步；拒绝则在此停止）',
    { default: true }
  )
}

// ============================================================
// 输入就位检查（fail fast，先于任何子流程调度）
// ============================================================

await check(() => fileExists(templatePath), '需求模板不存在：' + templatePath)

// v2 路径冲突检查（R10/T4.5，fail fast）
if (outputMode !== 'legacy') {
  if (specDir === sourceSpecDir) {
    throw new Error('specDir 与 sourceSpecDir 相同（' + specDir + '）：历史证据目录只读，新产物须写独立目录（R10）')
  }
  if (outputDir === sourceSpecDir) {
    throw new Error('outputDir 与 sourceSpecDir 相同（' + outputDir + '）：历史证据目录只读，新产物须写独立目录（R10）')
  }
  if (fileExists(specDir + '/feature_index.json')) {
    throw new Error('specDir 内已存在 feature_index.json（' + specDir + '）：请换新目录或清理后重跑（策划版分片残留允许，支持断点续跑）')
  }
  if (fileExists(specDir + '/stage_manifest.md')) {
    throw new Error('specDir 内已存在 stage_manifest.md（' + specDir + '）：请换新目录或清理后重跑（策划版分片残留允许，支持断点续跑）')
  }
}
if (outputMode === 'planner-only') {
  await check(() => fileExists(sourceSpecDir + '/feature_index.json'), 'sourceSpecDir 缺少 feature_index.json（planner-only 复用历史证据）：' + sourceSpecDir)
  await check(() => fileExists(sourceSpecDir + '/runtime/state/scan.json'), 'sourceSpecDir 缺少 runtime/state/scan.json（planner-only 复用历史证据）：' + sourceSpecDir)
} else {
  await check(() => fileExists(codeDir), '客户端代码工程不存在：' + codeDir)
  await check(() => fileExists(fguiDir), 'FairyGUI 工程不存在：' + fguiDir)
}

log(
  '执行模式：' + (mode === 'step' ? '分步执行（每步完成后 checkpoint 确认继续）' : '一次性全部执行') +
    '；产出模式：' + outputMode +
    (outputMode === 'legacy' ? '（不生成策划版，行为等同 v2）' : outputMode === 'planner-only' ? '（复用 ' + sourceSpecDir + ' 历史证据，只生成策划版）' : '（查证与产出写 ' + outputDir + '）')
)

// ============================================================
// 顺序调度四个子流程（内存链式传参；拒绝检查点 = 正常停止，不视为失败）
// planner-only：跳过步骤 1/2，先跑 prepare-planner-doc-input.mjs（确定性命令），
//              子流程 3 以 plannerInputDir 磁盘输入模式调度（结构化字段隔离由 prepare 脚本源头保证）
// ============================================================

let scan = null
let verify = null
let produce = null
let assemble = null
let stoppedAfter = null

try {
  if (outputMode === 'planner-only') {
    // ---- planner-only：跳过扫描与查证，复用 sourceSpecDir 历史证据 ----
    phase('产出编写')
    const prepareCmd =
      'node ".opencode-workflows/scripts/prepare-planner-doc-input.mjs" "' + sourceSpecDir + '" "' + outputDir + '"'
    const prepareOk = await commandSuccess(prepareCmd, 300000)
    if (!prepareOk) {
      throw new Error('策划版输入准备失败（prepare-planner-doc-input.mjs，见上方命令日志；检查 sourceSpecDir 历史证据完整性）')
    }
    const plannerInputDir = outputDir + '/runtime/planner-input'
    produce = await workflow(
      { scriptPath: STEPS[2].script, label: '产出编写（planner-only）' },
      childArgs({ plannerInputDir: plannerInputDir })
    )
    await gate(
      STEPS[2],
      '策划版分片 ' + produce.plannerPartCount + ' 份（planner-only，技术文档任务零调度），写入 ' + produce.specDir
    )

    phase('装配与校验')
    assemble = await workflow({ scriptPath: STEPS[3].script, label: '装配与校验（planner-only）' }, childArgs())
  } else {
    // ---- all / legacy：四子流程完整链路 ----
    // 步骤 1：扫描模板
    phase('扫描模板')
    scan = await workflow({ scriptPath: STEPS[0].script, label: STEPS[0].label }, childArgs())
    await gate(
      STEPS[0],
      'stage 章节 ' + scan.stageCount + ' 个，扫描结果见 ' + scan.scanPath
    )

    // 步骤 2：原子拆分与代码查证
    phase('原子拆分与代码查证')
    verify = await workflow(
      { scriptPath: STEPS[1].script, label: STEPS[1].label },
      childArgs({ scan: scan })
    )
    await gate(
      STEPS[1],
      verify.stageCount + ' 阶段 / ' + verify.featureTotal + ' 功能点 / ' + verify.atomTotal +
        ' 原子项（confirmed ' + verify.verdictStats.confirmed + ' / partial ' + verify.verdictStats.partial +
        ' / not_found ' + verify.verdictStats.not_found +
        '；difference：consistent ' + verify.differenceStats.consistent + ' / partial ' + verify.differenceStats.partial +
        ' / conflict ' + verify.differenceStats.conflict + ' / unverified ' + verify.differenceStats.unverified + '）'
    )

    // 步骤 3：产出编写
    phase('产出编写')
    produce = await workflow(
      { scriptPath: STEPS[2].script, label: STEPS[2].label },
      childArgs({ scan: scan, verify: verify })
    )
    await gate(
      STEPS[2],
      '阶段文档 ' + produce.stageDocCount + ' 份、索引片段 ' + produce.fragmentCount + ' 份、补充版分片 ' +
        produce.partCount + ' 份、策划版分片 ' + produce.plannerPartCount + ' 份，写入 ' + produce.specDir
    )

    // 步骤 4：装配与校验
    phase('装配与校验')
    assemble = await workflow({ scriptPath: STEPS[3].script, label: STEPS[3].label }, childArgs())
  }
} catch (e) {
  // 分步执行：拒绝检查点 = 用户主动停止，正常收尾返回（已完成步骤产物保留在磁盘）
  if (e && e.code === 'CHECKPOINT_REJECTED') {
    stoppedAfter = scan && !verify ? STEPS[0].label : verify && !produce ? STEPS[1].label : produce && !assemble ? STEPS[2].label : STEPS[3].label
    log('分步执行：用户在检查点选择停止（完成至「' + stoppedAfter + '」），产物保留在磁盘')
  } else {
    throw e
  }
}

// ============================================================
// 汇总返回
// ============================================================

const summary =
  '模式 ' + mode + ' / ' + outputMode +
  (stoppedAfter ? '，用户停止于「' + stoppedAfter + '」之后' : '，子流程全部完成') +
  (scan ? '；扫描 ' + scan.stageCount + ' 阶段' : '') +
  (verify ? '；查证 ' + verify.featureTotal + ' 功能点 / ' + verify.atomTotal + ' 原子项' : '') +
  (assemble ? '；产出 ' + assemble.specDir : '') +
  (assemble && assemble.supplementPath ? ' 与 ' + assemble.supplementPath : '') +
  (assemble && !assemble.skipPlanner ? ' 与策划版 ' + assemble.plannerPath : '')

log(summary)

return {
  ok: true,
  mode: mode,
  outputMode: outputMode,
  stopped: stoppedAfter !== null,
  stoppedAfter: stoppedAfter,
  specDir: assemble ? assemble.specDir : specDir,
  supplementPath: assemble ? assemble.supplementPath : supplementPath,
  plannerPath: assemble ? assemble.plannerPath : plannerPath,
  featureIndexPath: assemble ? assemble.featureIndexPath : null,
  stageManifestPath: assemble ? assemble.stageManifestPath : null,
  verifyReportPath: assemble ? assemble.verifyReportPath : null,
  traceIndexPath: assemble ? assemble.traceIndexPath : null,
  outputDir: outputDir,
  sourceSpecDir: outputMode === 'planner-only' ? sourceSpecDir : null,
  scanPath: scan ? scan.scanPath : outputMode === 'planner-only' ? sourceSpecDir + '/runtime/state/scan.json' : null,
  stageCount: scan ? scan.stageCount : null,
  featureCount: verify ? verify.featureTotal : null,
  atomCount: verify ? verify.atomTotal : null,
  verdictStats: verify ? verify.verdictStats : null,
  differenceStats: verify ? verify.differenceStats : null,
  perStage: verify ? verify.perStage : null,
  summary: summary,
}
