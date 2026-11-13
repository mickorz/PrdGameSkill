// Output-Spec Generate Workflow（主编排，四子流程拆分版）
//
// 由 dev-docs/design/outputspec生成工作流计划.md 转写（2026-11-13），2026-11-13 拆分为四个子 workflow：
//   本文件只做编排：输入检查 -> 顺序调度四个子流程（内存链式传参，不经文件中转）-> 汇总返回。
//   子流程位于本目录（注册表只扫描 workflows/ 一级目录，子目录脚本经显式相对路径调用）：
//     output-spec-generate/1-scan-template.js   扫描模板章节 + 覆盖校验 + scan.json 落盘
//     output-spec-generate/2-verify-stages.js   按阶段并行拆原子 + 客户端代码查证（explore 只读 + schema）
//     output-spec-generate/3-produce-outputs.js 阶段规格文档 + 索引片段 echo + 补充版分片 + 构建配置 echo
//     output-spec-generate/4-assemble-verify.js 确定性装配 + 机械校验（build-output-spec.mjs）
//
// 读取需求模板（杭州麻将好友房AI 核心简化版本）拆分原子需求，对照客户端代码
// （Code 代码工程 + Fgui FairyGUI 工程）查证，补充客户端逻辑与 UI 交互，产出：
//   1. specDir（默认 spec-workflow/output-spec/2026-11-13/1-spec/）—— 结构对齐原 1-spec
//      （stages/spec_stage_ST-Cxx.md + feature_index.json + stage_manifest.md + runtime/）
//   2. 补充版需求文档（模板复制后补充完整版，默认 spec-workflow/output-spec/核心流程杭州麻将好友房AI-补充版本.md）
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
//   templatePath    需求模板，默认 templates/【杭州麻将】核心流程杭州麻将好友房AI-核心简化版本.md
//   codeDir         客户端代码工程，默认 source-code/client/Code
//   fguiDir         FairyGUI 工程，默认 source-code/client/Fgui
//   specDir         1-spec 产出目录，默认 spec-workflow/output-spec/2026-11-13/1-spec
//   supplementPath  补充版文档输出路径，默认 spec-workflow/output-spec/核心流程杭州麻将好友房AI-补充版本.md
//   date            产出日期 YYYY-MM-DD（脚本内禁止取当前时间），默认 2026-11-13
//   analysisModel   分析类模型，默认 biangfeng-gateway/deepseek-v4.1-flash-official（传空串用会话默认）
//   concurrency     并发上限，默认 16（主脚本设置一次，子流程共享配额，运行时钳制到 16）
//
// 返回：
//   { ok, mode, stopped, specDir, supplementPath, featureIndexPath, stageManifestPath,
//     verifyReportPath, scanPath, stageCount, featureCount, atomCount, verdictStats, perStage }

export const meta = {
  id: 'output-spec-generate',
  name: 'output_spec_generate',
  description: '读取需求模板拆分原子需求，对照客户端代码（Code/Fgui）查证补充客户端逻辑与 UI 交互，产出 1-spec 规格目录与补充版需求文档（四子流程编排：扫描/查证/产出/装配）',
  phases: [
    { title: '扫描模板' },
    { title: '原子拆分与代码查证' },
    { title: '产出编写' },
    { title: '装配与校验' },
  ],
}

const A = args || {}

const mode = A.mode === 'step' ? 'step' : 'all'
const templatePath =
  A.templatePath || 'templates/【杭州麻将】核心流程杭州麻将好友房AI-核心简化版本.md'
const codeDir = A.codeDir || 'source-code/client/Code'
const fguiDir = A.fguiDir || 'source-code/client/Fgui'
const specDir = A.specDir || 'spec-workflow/output-spec/2026-11-13/1-spec'
const supplementPath =
  A.supplementPath || 'spec-workflow/output-spec/核心流程杭州麻将好友房AI-补充版本.md'

setConcurrency(A.concurrency || 16)

// 子流程脚本路径（显式相对路径；注册表只扫描 workflows/ 一级目录，子目录脚本不可按名调用）
const DIR = './.opencode-workflows/workflows/output-spec-generate'
const STEPS = [
  { n: 1, label: '扫描模板', script: DIR + '/1-scan-template.js' },
  { n: 2, label: '原子拆分与代码查证', script: DIR + '/2-verify-stages.js' },
  { n: 3, label: '产出编写', script: DIR + '/3-produce-outputs.js' },
  { n: 4, label: '装配与校验', script: DIR + '/4-assemble-verify.js' },
]

// 透传子流程的参数：剔除主编排自用字段（mode）；concurrency 照常透传，
// 子流程 setConcurrency 同值重复设置无害，且保证子流程不会把用户自定义配额重置回默认 16
function childArgs(extra) {
  const c = {}
  for (const k of Object.keys(A)) {
    if (k !== 'mode') c[k] = A[k]
  }
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
await check(() => fileExists(codeDir), '客户端代码工程不存在：' + codeDir)
await check(() => fileExists(fguiDir), 'FairyGUI 工程不存在：' + fguiDir)

log('执行模式：' + (mode === 'step' ? '分步执行（每步完成后 checkpoint 确认继续）' : '一次性全部执行'))

// ============================================================
// 顺序调度四个子流程（内存链式传参；拒绝检查点 = 正常停止，不视为失败）
// ============================================================

let scan = null
let verify = null
let produce = null
let assemble = null
let stoppedAfter = null

try {
  // ---- 步骤 1：扫描模板 ----
  phase('扫描模板')
  scan = await workflow({ scriptPath: STEPS[0].script, label: STEPS[0].label }, childArgs())
  await gate(
    STEPS[0],
    'stage 章节 ' + scan.stageCount + ' 个，扫描结果见 ' + scan.scanPath
  )

  // ---- 步骤 2：原子拆分与代码查证 ----
  phase('原子拆分与代码查证')
  verify = await workflow(
    { scriptPath: STEPS[1].script, label: STEPS[1].label },
    childArgs({ scan: scan })
  )
  await gate(
    STEPS[1],
    verify.stageCount + ' 阶段 / ' + verify.featureTotal + ' 功能点 / ' + verify.atomTotal +
      ' 原子项（confirmed ' + verify.verdictStats.confirmed + ' / partial ' + verify.verdictStats.partial +
      ' / not_found ' + verify.verdictStats.not_found + '）'
  )

  // ---- 步骤 3：产出编写 ----
  phase('产出编写')
  produce = await workflow(
    { scriptPath: STEPS[2].script, label: STEPS[2].label },
    childArgs({ scan: scan, verify: verify })
  )
  await gate(
    STEPS[2],
    '阶段文档 ' + produce.stageDocCount + ' 份、索引片段 ' + produce.fragmentCount + ' 份、补充版分片 ' +
      produce.partCount + ' 份，写入 ' + produce.specDir
  )

  // ---- 步骤 4：装配与校验 ----
  phase('装配与校验')
  assemble = await workflow({ scriptPath: STEPS[3].script, label: STEPS[3].label }, childArgs())
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
  '模式 ' + mode +
  (stoppedAfter ? '，用户停止于「' + stoppedAfter + '」之后' : '，四个子流程全部完成') +
  (scan ? '；扫描 ' + scan.stageCount + ' 阶段' : '') +
  (verify ? '；查证 ' + verify.featureTotal + ' 功能点 / ' + verify.atomTotal + ' 原子项' : '') +
  (assemble ? '；产出 ' + assemble.specDir + ' 与 ' + assemble.supplementPath : '')

log(summary)

return {
  ok: true,
  mode: mode,
  stopped: stoppedAfter !== null,
  stoppedAfter: stoppedAfter,
  specDir: assemble ? assemble.specDir : specDir,
  supplementPath: assemble ? assemble.supplementPath : supplementPath,
  featureIndexPath: assemble ? assemble.featureIndexPath : null,
  stageManifestPath: assemble ? assemble.stageManifestPath : null,
  verifyReportPath: assemble ? assemble.verifyReportPath : null,
  scanPath: scan ? scan.scanPath : null,
  stageCount: scan ? scan.stageCount : null,
  featureCount: verify ? verify.featureTotal : null,
  atomCount: verify ? verify.atomTotal : null,
  verdictStats: verify ? verify.verdictStats : null,
  perStage: verify ? verify.perStage : null,
  summary: summary,
}
