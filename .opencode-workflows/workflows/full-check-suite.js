// Full Check Suite Workflow（三路检查集成编排）
//
// 用途：一键跑齐三路检查并把产物 Dashboard 合并为单文件 Tab 切换版。
//   1. 并行调度三个已注册子 workflow（输入相互独立，无数据依赖）：
//      - game-prd-check          PRD 功能规则检查（对照规则基准）
//      - ui-interaction-prd-extract UI 交互检查（读取 skill 目录已固化基准，不再重复提取）
//      - bug-coverage-check      Bug 覆盖检查（buglist 对照 PRD 找需求缺失）
//   2. 任一路失败不拖累其余：失败路记入结果明细，成功路照常出产物
//   3. 收尾自动合并：收集成功路的 dashboardPath，调 merge-prd-dashboard skill 的
//      merge-dashboard.mjs 合成单文件 Tab 切换版（少于 2 份成功则跳过合并）
//
// 用户选择（生成前问询）：
//   档位：双档透传（args.fast 透传给三个子流程，默认 true 速度档，正式交付传 false）
//   失败策略：其余继续（parallel 内每路独立 try-catch，失败路记明细）
//   收尾合并：跑完直接调 merge-dashboard.mjs 合并（用户指定集成 merge-prd-dashboard skill）
//   并发：默认 16（三路共享 root 配额，子流程内部并发自动排队；args.concurrency 覆盖）
//   模型：父脚本纯编排不设模型；子流程内部模型由各自脚本管理，合并 agent 为机械
//         bash 执行，用会话默认模型即可
//
// 可选 args（未列出的子流程特有参数见各自脚本头注释，经 extraPrd/extraUi/extraBug 透传）：
//   date          检查日期（YYYY-MM-DD），透传三路；脚本内禁止取当前时间
//   fast          默认 true：透传三路，速度档跳过报告质检；false 为质量档
//   skipReview    显式覆盖质检开关，透传三路
//   inputDir      需求文档目录，透传 PRD/UI 两路，默认 input
//   inputFiles    指定需求文档路径数组，透传 PRD/UI 两路
//   concurrency   并发上限（提供时透传三路，同值重复 set 无害），默认 16
//   uiRulesDir    UI 路基准目录覆盖（默认读 skill 固化基准，一般不需要传）
//   bugDir        Bug 路缺陷目录，默认 bugs/buglist
//   dashboard     是否生成各路 Dashboard，默认 true；false 时无合并对象，收尾跳过
//   coverage      PRD 路是否生成检查覆盖清单（rule-checklist），默认 true
//   coverageRulesDir 覆盖统计使用的规则目录，默认 .claude/skills/game-prd-check/references/rules/hzmj_game_flow_handler
//   coverageScript   覆盖清单脚本，默认 .claude/skills/game-prd-check/scripts/gen-coverage.mjs
//   prdDashboardScript PRD 覆盖后重建 Dashboard 的脚本，默认 .claude/skills/game-prd-check/scripts/build-dashboard.mjs
//   mergedOutDir  合并产物目录，默认 examples/dashboard
//   labels        三路 Tab 标签数组（1 起），默认 ['杭州麻将PRD分析','UI交互分析','Bug覆盖分析']
//   extraPrd      透传给 game-prd-check 的额外 args 对象
//   extraUi       透传给 ui-interaction-prd-extract 的额外 args 对象
//   extraBug      透传给 bug-coverage-check 的额外 args 对象
//
// 返回：
//   { ok, prd|ui|bug: {ok, ...子流程返回} , merged: {ok, mergedPath|skipped|error},
//     failed: [失败路明细], summary: 一句话汇总 }

export const meta = {
  id: 'full-check-suite',
  name: 'full_check_suite',
  description: '一键跑齐 PRD 功能规则、UI 交互、Bug 覆盖三路检查，任一路失败不拖累其余，最后自动合并三个 Dashboard 为单文件 Tab 切换版',
  phases: [
    { title: '准备' },
    { title: '并行检查' },
    { title: '检查覆盖' },
    { title: '合并交付' },
  ],
}

const A = args || {}

// 三路子流程注册名与展示信息（顺序即合并 Tab 顺序）
const ROUTES = [
  {
    key: 'prd',
    ref: 'game-prd-check',
    label: 'PRD功能规则',
    tabLabel: (A.labels && A.labels[0]) || '杭州麻将PRD分析',
  },
  {
    key: 'ui',
    ref: 'ui-interaction-prd-extract',
    label: 'UI交互',
    tabLabel: (A.labels && A.labels[1]) || 'UI交互分析',
  },
  {
    key: 'bug',
    ref: 'bug-coverage-check',
    label: 'Bug覆盖',
    tabLabel: (A.labels && A.labels[2]) || 'Bug覆盖分析',
  },
]

const coverageEnabled = A.coverage !== false
const coverageRulesDir =
  A.coverageRulesDir || '.claude/skills/game-prd-check/references/rules/hzmj_game_flow_handler'
const coverageScript = A.coverageScript || '.claude/skills/game-prd-check/scripts/gen-coverage.mjs'
const prdDashboardScript =
  A.prdDashboardScript || '.claude/skills/game-prd-check/scripts/build-dashboard.mjs'

// ---------- 阶段 1：准备 ----------
phase('准备')

const fastMode = A.fast !== false
log('档位：' + (fastMode ? '速度档（fast=true，跳过报告质检）' : '质量档（fast=false，保留质检）'))
log('失败策略：任一路失败其余继续，收尾只合并成功路 Dashboard')
if (A.concurrency) log('并发上限：' + A.concurrency + '（三路共享 root 配额）')

// 组装每路的子流程 args：公共透传 + 路由特有 + 用户额外透传
function buildRouteArgs(route) {
  const child = {
    date: A.date,
    fast: fastMode,
    skipReview: A.skipReview,
    dashboard: A.dashboard !== false,
  }
  if (A.concurrency) child.concurrency = A.concurrency
  if (route.key === 'prd' || route.key === 'ui') {
    if (A.inputDir) child.inputDir = A.inputDir
    if (A.inputFiles) child.inputFiles = A.inputFiles
  }
  if (route.key === 'ui') child.rulesDir = A.uiRulesDir
  if (route.key === 'bug') {
    if (A.bugDir) child.bugDir = A.bugDir
  }
  const extra = route.key === 'prd' ? A.extraPrd : route.key === 'ui' ? A.extraUi : A.extraBug
  return extra ? Object.assign(child, extra) : child
}

// ---------- 阶段 2：并行检查 ----------
phase('并行检查')

// 单路执行：workflow() 结构性错误/子脚本 throw 直接上抛，这里逐路 try-catch，
// 失败路吸收为 {ok:false} 明细，不拖累其余路（子流程相互独立，业务上允许部分成功）
async function runRoute(route) {
  const childArgs = buildRouteArgs(route)
  try {
    const result = await workflow({ scriptPath: route.ref, label: route.label }, childArgs)
    return Object.assign({ ok: true, route: route.label, tabLabel: route.tabLabel }, result || {})
  } catch (e) {
    return { ok: false, route: route.label, tabLabel: route.tabLabel, error: String(e && e.message ? e.message : e) }
  }
}

const routeResults = await parallel(ROUTES.map((route) => () => runRoute(route)))

const succeeded = routeResults.filter((r) => r && r.ok)
const failed = routeResults.filter((r) => r && !r.ok)
succeeded.forEach((r) => log('[成功] ' + r.route + ' -> ' + (r.dashboardPath || '（无 Dashboard 产物）')))
failed.forEach((r) => log('[失败] ' + r.route + ' -> ' + r.error))

// ---------- 阶段 3：检查覆盖（rule-checklist） ----------
phase('检查覆盖')

// PRD 路完成后：先生成 coverage.json 并追加报告章节，再重建 PRD Dashboard，
// 让合并产物里的 PRD Tab 带上「检查覆盖清单」；失败不拖累其余路，记入 coverage 明细。
let coverage = { ok: false, skipped: true, reason: '' }
{
  const prd = routeResults[0]
  if (!coverageEnabled) {
    coverage = { ok: false, skipped: true, reason: 'args.coverage=false' }
    log('[跳过] PRD 检查覆盖清单：args.coverage=false')
  } else if (!prd || !prd.ok) {
    coverage = { ok: false, skipped: true, reason: 'PRD 路未成功，无报告可统计' }
    log('[跳过] PRD 检查覆盖清单：PRD 路未成功')
  } else if (!prd.reportPath) {
    coverage = { ok: false, skipped: true, reason: 'PRD 路未返回 reportPath' }
    log('[跳过] PRD 检查覆盖清单：PRD 路未返回 reportPath')
  } else if (A.dashboard === false) {
    coverage = { ok: false, skipped: true, reason: 'args.dashboard=false，无需重建 Dashboard' }
    log('[跳过] PRD 检查覆盖清单：未生成 Dashboard')
  } else {
    const reportPath = prd.reportPath
    const slash = reportPath.lastIndexOf('/')
    const reportDir = slash >= 0 ? reportPath.slice(0, slash) : '.'
    const reportJsonPath = prd.reportJsonPath || reportDir + '/report.json'
    const dateArg = A.date ? ' --date "' + A.date + '"' : ''
    const coverageCmd =
      'node "' + coverageScript + '" --report "' + reportPath + '" --report-json "' + reportJsonPath +
      '" --rules-dir "' + coverageRulesDir + '"' + dateArg
    const rebuildCmd = 'node "' + prdDashboardScript + '" "' + reportPath + '" "' + reportDir + '"'
    try {
      const out = await agent(
        [
          '你在项目根目录依次执行两条命令，然后把结果整理为 JSON 返回。只执行命令与确认文件，不要改写报告内容。',
          '',
          '第一步：生成检查覆盖清单并追加到 report.md',
          coverageCmd,
          '',
          '第二步：重建 PRD Dashboard（读取同目录 coverage.json 注入覆盖区块）',
          rebuildCmd,
          '',
          '结果判定：',
          '1. 两条命令退出码都为 0、输出含 [成功]，且 coverage.json 与新的 dashboard HTML 都存在：ok=true。',
          '2. coveragePath 填第一步输出的 coverage.json 路径，htmlPath 填第二步输出「dashboard ->」后的 HTML 路径，reportJsonPath 填「report.json ->」后的路径。',
          '3. 任一步退出码非 0 或输出含 [失败]：ok=false，message 填失败命令与错误输出（最后 20 行）。',
          '4. 路径统一转成相对项目根目录的形式，不要改写文件名。',
          '5. 不执行 git 命令，不删除任何历史 Dashboard。',
        ].join('\n'),
        {
          agentType: 'general',
          label: 'PRD检查覆盖清单',
          timeoutMs: 900000,
          retries: 1,
          schema: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              coveragePath: { type: 'string', description: 'coverage.json 路径，失败留空' },
              htmlPath: { type: 'string', description: '重建后的 dashboard HTML 路径，失败留空' },
              reportJsonPath: { type: 'string', description: 'report.json 路径，失败留空' },
              message: { type: 'string', description: '结果说明或失败原因' },
            },
            required: ['ok', 'coveragePath', 'htmlPath', 'message'],
          },
        }
      )
      if (!out || out.ok !== true || !out.htmlPath) {
        throw new Error((out && out.message) || '未返回成功的覆盖清单或 Dashboard 路径')
      }
      coverage = {
        ok: true,
        skipped: false,
        coveragePath: out.coveragePath || '',
        dashboardPath: out.htmlPath,
        reportJsonPath: out.reportJsonPath || '',
        message: out.message || '',
      }
      prd.coveragePath = coverage.coveragePath
      prd.coverageDashboardPath = out.htmlPath
      prd.dashboardPath = out.htmlPath
      if (out.reportJsonPath) prd.reportJsonPath = out.reportJsonPath
      log('[成功] PRD 检查覆盖清单 -> ' + coverage.coveragePath + '；Dashboard 已重建 -> ' + out.htmlPath)
    } catch (e) {
      const message = String(e && e.message ? e.message : e)
      coverage = { ok: false, skipped: false, error: message }
      prd.coverageError = message
      log('[失败] PRD 检查覆盖清单 -> ' + message)
    }
  }
}

// ---------- 阶段 4：合并交付 ----------
phase('合并交付')

// 收集成功路且真实存在 Dashboard 产物的路径（dashboardSkipped 或生成失败时 dashboardPath 为 null）
const dashPaths = succeeded.filter((r) => r.dashboardPath).map((r) => r.dashboardPath)
const dashLabels = succeeded.filter((r) => r.dashboardPath).map((r) => r.tabLabel)

let merged = { ok: false, skipped: true, reason: '' }
if (dashPaths.length >= 2) {
  // 组装 merge-dashboard.mjs 命令行：label 从 1 起，文件名重名场景必须显式指定
  const labelArgs = dashLabels.map((l, i) => '--label ' + (i + 1) + '=' + l).join(' ')
  const cmd =
    'node .claude/skills/merge-prd-dashboard/scripts/merge-dashboard.mjs ' +
    dashPaths.map((p) => '"' + p + '"').join(' ') +
    ' --out-dir ' + (A.mergedOutDir || 'examples/dashboard') +
    (labelArgs ? ' ' + labelArgs : '')
  log('执行合并：' + cmd)
  try {
    // 机械 bash 执行 + 结构自检结果回读，任务快：5 分钟超时足够；失败降级为返回各路产物路径
    const mergeOut = await agent(
      '在仓库根目录执行以下命令（bash），然后把结果整理为 JSON 返回：\n\n' +
        cmd +
        '\n\n要求：\n' +
        '1. 输出含 [成功] 时，从输出提取合并产物 HTML 路径\n' +
        '2. 输出含 [失败] 时，原样记录原因清单\n' +
        '3. 用 ls 确认产物文件存在后再返回',
      {
        agentType: 'general',
        label: '合并Dashboard',
        timeoutMs: 300000,
        retries: 1,
        schema: {
          type: 'object',
          properties: {
            ok: { type: 'boolean', description: '合并是否成功' },
            mergedPath: { type: 'string', description: '合并产物 HTML 路径，失败时为空串' },
            message: { type: 'string', description: '结果说明或失败原因' },
          },
          required: ['ok', 'mergedPath', 'message'],
        },
      }
    )
    merged = { ok: mergeOut.ok === true, skipped: false, mergedPath: mergeOut.mergedPath || '', message: mergeOut.message || '' }
  } catch (e) {
    // 合并属收尾增强动作，失败不拖死 run：降级返回三路独立产物
    merged = { ok: false, skipped: false, error: String(e && e.message ? e.message : e) }
    log('[降级] 合并失败，返回各路独立 Dashboard 产物：' + merged.error)
  }
} else if (dashPaths.length === 1) {
  merged = { ok: false, skipped: true, reason: '仅 1 份 Dashboard 产物，无需合并：' + dashPaths[0] }
} else {
  merged = { ok: false, skipped: true, reason: failed.length ? '全部路失败或无 Dashboard 产物' : '各路 Dashboard 均未生成（args.dashboard=false 或生成失败）' }
  if (failed.length === 0 && dashPaths.length === 0 && succeeded.length > 0) {
    // 三路都成功但都没产物：大概率 dashboard=false，正常情况不算错误
    merged = { ok: true, skipped: true, reason: '各路未生成 Dashboard（args.dashboard=false）' }
  }
}

// ---------- 汇总返回 ----------
const summaryParts = succeeded.map((r) => {
  if (r.stats && r.stats.total != null) return r.route + ' ' + r.stats.total + '项'
  if (r.bugTotal != null) return r.route + ' ' + r.bugTotal + '缺陷'
  return r.route
})
const summary =
  '三路检查：' +
  (succeeded.length ? '成功 ' + succeeded.length + ' 路（' + summaryParts.join('、') + '）' : '全部失败') +
  (failed.length ? '；失败 ' + failed.length + ' 路（' + failed.map((f) => f.route).join('、') + '）' : '') +
  '；合并：' + (merged.skipped ? '跳过（' + (merged.reason || '') + '）' : merged.ok ? '完成 ' + (merged.mergedPath || '') : '失败')

log(summary)

return {
  ok: failed.length < ROUTES.length,
  prd: routeResults[0],
  ui: routeResults[1],
  bug: routeResults[2],
  coverage: coverage,
  merged: merged,
  failed: failed.map((f) => ({ route: f.route, error: f.error })),
  dashboardPaths: dashPaths,
  summary: summary,
}
