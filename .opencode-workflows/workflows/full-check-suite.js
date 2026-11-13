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
//   requirementsPath + extractionRunId  共享需求快照消费（v4 阶段 8 串联，成对传入，只传其一直接报错）：
//                     透传三路子流程（REQ ID 定位与关联）；三路跑完后追加「统一汇总」阶段
//                     （rtm-merge 合并三维度 → validate-rtm → 统一 Dashboard 第 5 Tab）
//   unifiedOutDir 统一 RTM 产物目录，默认 output/projects/hzmj/unified-rtm/{date}
//
// 返回：
//   { ok, prd|ui|bug: {ok, ...子流程返回} , merged: {ok, mergedPath|skipped|error},
//     unified: {ok, rtmPath, htmlPath|skipped|error},
//     failed: [失败路明细], summary: 一句话汇总 }

export const meta = {
  id: 'full-check-suite',
  name: 'full_check_suite',
  description: '一键跑齐 PRD 功能规则、UI 交互、Bug 覆盖三路检查，任一路失败不拖累其余，最后自动合并三个 Dashboard 为单文件 Tab 切换版',
  phases: [
    { title: '准备' },
    { title: '并行检查' },
    { title: '检查覆盖' },
    { title: '统一汇总' },
    { title: '合并交付' },
  ],
}

const A = args || {}

// 共享快照参数成对校验（与三个 Checker 同规则：只传其一直接报错，不精测入子流程再拦）
const sharedReq = A.requirementsPath || null
const sharedExt = A.extractionRunId || null
if ((sharedReq && !sharedExt) || (!sharedReq && sharedExt)) {
  throw new Error('requirementsPath 与 extractionRunId 必须成对传入：只传其一直接报错（共享快照消费契约）')
}
const sharedMode = !!(sharedReq && sharedExt)
const unifiedOutDir = A.unifiedOutDir || 'output/projects/hzmj/unified-rtm/' + (A.date || 'undated')

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
  if (sharedMode) {
    child.requirementsPath = sharedReq
    child.extractionRunId = sharedExt
  }
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

// ---------- 阶段 4：统一汇总（v4 共享模式：rtm-merge → validate-rtm → 统一 Dashboard） ----------
phase('统一汇总')

let unified = { ok: false, skipped: true, reason: '' }
if (!sharedMode) {
  unified = { ok: false, skipped: true, reason: '未传共享快照参数，走旧三路合并链' }
  log('[跳过] 统一汇总：未传 requirementsPath + extractionRunId，保持旧合并交付链')
} else if (succeeded.length === 0) {
  unified = { ok: false, skipped: true, reason: '三路全部失败，无产物可合并' }
  log('[跳过] 统一汇总：三路全部失败')
} else {
  // 维度输入目录：成功路才有（game=rtm 快照目录， ui=report.json 所在目录， bug=bug-verdicts.json 所在目录）
  const prdR = routeResults[0]
  const uiR = routeResults[1]
  const bugR = routeResults[2]
  const dimArgs = []
  let gameDirArg = null
  if (prdR && prdR.ok && prdR.rtmRunDir) {
    gameDirArg = prdR.rtmRunDir
    dimArgs.push('--game "' + gameDirArg + '"')
  }
  if (uiR && uiR.ok && uiR.reportJsonPath) {
    const uiDir = uiR.reportJsonPath.replace(/[\\/]report\.json$/, '')
    dimArgs.push('--ui "' + uiDir + '"')
  }
  if (bugR && bugR.ok && bugR.verdictsFile) {
    const bugDir = bugR.verdictsFile.replace(/[\\/]bug-verdicts\.json$/, '')
    dimArgs.push('--bug "' + bugDir + '"')
  }
  if (dimArgs.length === 0) {
    unified = { ok: false, skipped: true, reason: '成功路均未返回可合并产物路径' }
    log('[跳过] 统一汇总：成功路无 rtm/report/verdicts 产物路径')
  } else {
    const prdReport = prdR && prdR.ok ? prdR.reportPath : null
    const mergeCmd =
      'node .opencode-workflows/scripts/rtm-merge.mjs "' + unifiedOutDir + '" --requirements "' + sharedReq + '" ' + dimArgs.join(' ')
    const validateCmd = 'node .opencode-workflows/scripts/validate-rtm.mjs "' + unifiedOutDir + '/rtm.json"'
    // 统一 Dashboard：底报用 PRD 路报告（无则失败，不再找替代）；--rtm 仅在 game 成功时传
    const dashboardCmd =
      'node .claude/skills/game-prd-check/scripts/build-dashboard.mjs "' + (prdReport || '') + '" "' + unifiedOutDir + '"' +
      (gameDirArg ? ' --rtm "' + gameDirArg + '"' : '') + ' --unified-rtm "' + unifiedOutDir + '"'
    try {
      const out = await agent(
        [
          '你在项目根目录依次执行命令，把结果整理为 JSON 返回。只执行命令与确认文件，不要改写任何文件内容。',
          '',
          '第一步：合并三维度产物为统一 rtm.json（输出目录不存在会自动创建；任一维度产物缺失会报错，此时如实报告）',
          mergeCmd,
          '',
          '第二步：校验统一 rtm.json（退出码 0 且输出含 [成功] 才算过；失败时把错误前 10 行放进 message）',
          validateCmd,
          '',
          '第三步：生成统一 Dashboard（含第 5 Tab 统一覆盖）',
          dashboardCmd,
          '',
          '结果判定：',
          '1. 三步退出码都为 0 且输出含 [成功]：ok=true。',
          '2. rtmPath 填 "' + unifiedOutDir + '/rtm.json"，htmlPath 填第三步输出「dashboard ->」后的 HTML 路径。',
          '3. 任一步失败：ok=false，message 填失败步骤与错误输出（最后 20 行）。',
          '4. 路径统一转相对项目根目录形式。',
          '5. 不执行 git 命令，不删除任何历史 Dashboard。',
        ].join('\n'),
        {
          agentType: 'general',
          label: '统一RTM汇总',
          timeoutMs: 900000,
          retries: 1,
          schema: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              rtmPath: { type: 'string', description: '统一 rtm.json 路径，失败留空' },
              htmlPath: { type: 'string', description: '统一 Dashboard HTML 路径，失败留空' },
              message: { type: 'string', description: '结果说明或失败原因' },
            },
            required: ['ok', 'rtmPath', 'htmlPath', 'message'],
          },
        }
      )
      if (!out || out.ok !== true || !out.htmlPath) {
        throw new Error((out && out.message) || '统一汇总未返回成功路径')
      }
      unified = { ok: true, skipped: false, rtmPath: out.rtmPath || unifiedOutDir + '/rtm.json', htmlPath: out.htmlPath, message: out.message || '' }
      log('[成功] 统一 RTM -> ' + unified.rtmPath + '；统一 Dashboard -> ' + unified.htmlPath)
    } catch (e) {
      unified = { ok: false, skipped: false, error: String(e && e.message ? e.message : e) }
      log('[失败] 统一汇总 -> ' + unified.error)
    }
  }
}

// ---------- 阶段 5：合并交付（混编单一清单，v4：不再用三路 Tab 切换版） ----------
phase('合并交付')

// 主报告必须为 PRD 路成功（game report.md 为底）；ui/bug 至少一路成功才值得混编
let merged = { ok: false, skipped: true, reason: '' }
const prdR2 = routeResults[0]
const uiR2 = routeResults[1]
const bugR2 = routeResults[2]
if (A.dashboard === false) {
  merged = { ok: false, skipped: true, reason: 'args.dashboard=false，未生成 Dashboard' }
} else if (!prdR2 || !prdR2.ok || !prdR2.reportPath) {
  merged = { ok: false, skipped: true, reason: 'PRD 路未成功，无主报告可混编' }
} else {
  const uiOk = uiR2 && uiR2.ok && uiR2.reportJsonPath
  const bugOk = bugR2 && bugR2.ok && bugR2.verdictsFile
  if (!uiOk && !bugOk) {
    merged = { ok: false, skipped: true, reason: 'ui/bug 路均未成功，无混编对象' }
  } else {
    const mixDir = A.mergedOutDir || 'output/projects/hzmj/mixed-check/' + (A.date || 'undated')
    const uiDirMix = uiOk ? uiR2.reportJsonPath.replace(/[\\/]report\.json$/, '') : null
    const bugDirMix = bugOk ? bugR2.verdictsFile.replace(/[\\/]bug-verdicts\.json$/, '') : null
    const mixCmd =
      'node .claude/skills/game-prd-check/scripts/build-dashboard.mjs "' + prdR2.reportPath + '" "' + mixDir + '"' +
      (prdR2.rtmRunDir ? ' --rtm "' + prdR2.rtmRunDir + '"' : '') +
      (unified.ok && unified.rtmPath ? ' --unified-rtm "' + unifiedOutDir + '"' : '') +
      (uiDirMix ? ' --mix-ui "' + uiDirMix + '"' : '') +
      (bugDirMix ? ' --mix-bug "' + bugDirMix + '"' : '')
    log('混编单一清单：' + mixCmd)
    try {
      const mixOut = await agent(
        [
          '在仓库根目录执行以下命令（bash），然后把结果整理为 JSON 返回：',
          '',
          mixCmd,
          '',
          '要求：',
          '1. 输出含 [成功] 时，从输出提取「dashboard ->」后的 HTML 路径与总条数',
          '2. 输出含 [失败] 时，原样记录错误清单（最后 15 行）',
          '3. 用 ls 确认产物 HTML 存在后再返回',
          '4. 不执行 git 命令，不删除任何历史 Dashboard',
        ].join('\n'),
        {
          agentType: 'general',
          label: '混编Dashboard',
          timeoutMs: 300000,
          retries: 1,
          schema: {
            type: 'object',
            properties: {
              ok: { type: 'boolean', description: '混编是否成功' },
              mergedPath: { type: 'string', description: '混编产物 HTML 路径，失败时为空串' },
              total: { type: 'number', description: '混编总条数，失败时为 0' },
              message: { type: 'string', description: '结果说明或失败原因' },
            },
            required: ['ok', 'mergedPath', 'total', 'message'],
          },
        }
      )
      merged = { ok: mixOut.ok === true, skipped: false, mergedPath: mixOut.mergedPath || '', total: mixOut.total || 0, message: mixOut.message || '' }
    } catch (e) {
      merged = { ok: false, skipped: false, error: String(e && e.message ? e.message : e) }
      log('[降级] 混编失败，返回各路独立 Dashboard 产物：' + merged.error)
    }
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
  '；统一汇总：' + (unified.skipped ? '跳过（' + (unified.reason || '') + '）' : unified.ok ? '完成 ' + (unified.htmlPath || '') : '失败') +
  '；合并：' + (merged.skipped ? '跳过（' + (merged.reason || '') + '）' : merged.ok ? '完成 ' + (merged.mergedPath || '') : '失败')

log(summary)

return {
  ok: failed.length < ROUTES.length,
  prd: routeResults[0],
  ui: routeResults[1],
  bug: routeResults[2],
  coverage: coverage,
  merged: merged,
  unified: unified,
  failed: failed.map((f) => ({ route: f.route, error: f.error })),
  dashboardPaths: succeeded.filter((r) => r.dashboardPath).map((r) => r.dashboardPath),
  summary: summary,
}
