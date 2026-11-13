// build-output-spec.mjs —— 1-spec 产出统一构建器（确定性命令，output-spec-generate workflow 专用）
//
// 合并文档分片、装配索引、机械校验一次完成。中文路径（补充版/策划版文档名、模板名等）
// 全部经配置文件传入，CLI 参数保持 ASCII——规避中文路径经命令行的编码风险
// （见 dev-docs/experience/workflow扫描agent全量转述超时-确定性扫描替代.md 预防条目）。
//
// v2 策划版链路（2026-11-14，需求 R2/R6/R7/R9/R10，T3.2/T3.3/T3.7）：
//   - stepMergeSupplement 泛化为 mergeDocumentParts(parts, outPath, label)：
//     技术补充版与策划版各调一次（语义对齐 merge-stage-doc-parts.mjs：空行分隔拼接、
//     U+FFFD 乱码检查、成功后删分片）；空列表跳过（skipPlanner）。
//   - 幂等修复（遗留清单 L2）：分片全缺且目标文件已存在非空时视为已完成直接跳过
//     （上次运行成功后的重跑不再 fail-fast）；分片部分缺失仍 fail（中断状态不掩盖）。
//   - config.mode 分支：
//     'full'（默认）：合并补充版 + 合并策划版 + assembleIndex（含 schema_version/difference_stats）
//       + buildPlannerTrace（plannerParts 非空时）+ verifyOutputSpec（含泄漏/覆盖/difference 检查）
//     'planner-only'：只走策划版链路——合并策划版分片 -> buildPlannerTrace（从 sourceSpecDir
//       只读构造）-> checkPlannerLeakage -> AT-ID 覆盖检查 -> 写 verify-report（planner-only 版）；
//       绝不重跑 assembleIndex/verifyOutputSpec 全套、不触碰 sourceSpecDir 任何文件（R7/R10）。
//
// 用法：
//   node build-output-spec.mjs <configPath>
//
// 配置 JSON（由 workflow 的 echo agent 逐字写入 <specDir>/runtime/build-config.json）：
//   {
//     "specDir":            "1-spec 产出目录（相对或绝对路径）",
//     "supplementPath":     "补充版文档输出路径（planner-only 可省略）",
//     "plannerPath":        "策划版文档输出路径（v2）",
//     "templatePath":       "需求模板路径",
//     "date":               "产出日期 YYYY-MM-DD",
//     "sourceDesc":         "来源描述（进 feature_index.source）",
//     "expectedStageCount": "期望阶段数（片段数校验）",
//     "supplementParts":    ["补充版分片文件路径列表（按序；planner-only 时空数组）"],
//     "plannerParts":       ["策划版分片文件路径列表（v2；skipPlanner 时空数组）"],
//     "sourceSpecDir":      "历史查证证据目录（planner-only 覆盖检查基准，只读）",
//     "allowlist":          ["泄漏检查白名单词（v2，默认 ['AI']）"]
//   }
//
// 步骤（full）：
//   1. 合并 supplementParts -> supplementPath（缺分片 fail-fast；分片全缺且目标存在则幂等跳过）
//   2. 合并 plannerParts -> plannerPath（同上语义；空列表跳过）
//   3. assembleIndex 装配 feature_index.json + stage_manifest.md（schema_version 2 + difference_stats）
//   4. buildPlannerTrace 生成 trace_index.json（plannerParts 非空时）
//   5. verifyOutputSpec 机械校验（含策划版泄漏/AT-ID 覆盖/difference 统计；产出 verify-report.md）
//
// 退出码：0 全部成功 / 1 任一步失败（步骤名 + 明细见 stderr）

import fs from 'node:fs'
import path from 'node:path'
import { assembleIndex } from './assemble-output-spec-index.mjs'
import { verifyOutputSpec, checkPlannerLeakage, checkAtomCoverage } from './verify-output-spec.mjs'
import { buildPlannerTrace } from './build-planner-trace.mjs'

// 泛化文档分片合并（T3.2）：补充版与策划版共用；label 用于日志前缀
// 幂等语义（L2 修复）：分片全缺且目标已存在非空 = 上次已完成，跳过；部分缺失 = 中断状态，fail
function mergeDocumentParts(parts, outPath, label) {
  if (!Array.isArray(parts) || parts.length === 0) {
    console.log('[跳过] [合并' + label + '] 分片列表为空（该投影未启用或无分片）')
    return true
  }
  const missing = parts.filter((p) => !fs.existsSync(p))
  if (missing.length === parts.length) {
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
      console.log('[跳过] [合并' + label + '] 分片已在上次运行合并（全缺且目标存在，幂等跳过）：' + outPath)
      return true
    }
    console.error('[失败] [合并' + label + '] 分片全缺且目标不存在（产出编写阶段未跑或产物被清理，请重跑 workflow）')
    return false
  }
  if (missing.length > 0) {
    console.error('[失败] [合并' + label + '] 分片缺失 ' + missing.length + ' 个（产出编写阶段可能中断，请重跑 workflow）：\n  ' + missing.join('\n  '))
    return false
  }
  const merged = parts.map((p) => fs.readFileSync(p, 'utf8').trimEnd()).join('\n\n') + '\n'
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, merged, 'utf8')
  for (const p of parts) fs.unlinkSync(p)

  const fffdLines = []
  merged.split('\n').forEach((l, i) => {
    if (l.includes('\uFFFD')) fffdLines.push(i + 1)
  })
  if (fffdLines.length > 0) {
    console.error('[失败] [合并' + label + '] 文档含乱码替换字符 U+FFFD 共 ' + fffdLines.length + ' 处，行号：' + fffdLines.slice(0, 20).join(', ') + (fffdLines.length > 20 ? ' ...' : ''))
    return false
  }
  console.log('[成功] [合并' + label + '] ' + parts.length + ' 个分片 -> ' + outPath + '（' + Buffer.byteLength(merged, 'utf8') + ' 字节，无乱码）')
  return true
}

// planner-only 校验报告（泄漏 + AT-ID 覆盖 + sourceSpecDir difference 统计）
function plannerOnlyReport(specDir, plannerPath, leakProblems, coverage, sourceIndex) {
  const reportPath = path.join(specDir, 'runtime', 'spec_check', 'verify-report.md')
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  const problems = [...leakProblems, ...coverage.problems]
  const lines = []
  lines.push('# 产出校验（output-spec-generate，planner-only 模式）')
  lines.push('')
  lines.push('> 机械闸门：策划版泄漏正则扫描 / AT-ID 覆盖率（基准 trace_index.json）/ 乱码检查。本模式不重跑查证与技术文档装配，历史证据目录只读。')
  lines.push('')
  lines.push('- 策划版文档：' + plannerPath)
  if (coverage && coverage.coverage !== undefined) {
    lines.push('- AT-ID 覆盖率：' + (coverage.coverage * 100).toFixed(1) + '%（基准 ' + coverage.problems.length + ' 项问题内含缺失清单）')
  }
  if (sourceIndex) {
    const feats = sourceIndex.features || []
    let atomTotal = 0
    const diffTotal = { consistent: 0, partial: 0, conflict: 0, unverified: 0 }
    let unmarked = 0
    for (const f of feats) {
      for (const a of f.atoms || []) {
        atomTotal++
        const d = a.difference !== undefined ? a.difference : 'unverified'
        if (diffTotal[d] !== undefined) diffTotal[d]++
        if (a.difference === undefined) unmarked++
      }
    }
    lines.push('- 证据源 difference 分布（sourceSpecDir，schema_version ' + (sourceIndex.schema_version || 1) + '）：consistent ' + diffTotal.consistent + ' / partial ' + diffTotal.partial + ' / conflict ' + diffTotal.conflict + ' / unverified ' + diffTotal.unverified + (unmarked > 0 ? '（' + unmarked + ' 个为 v1 旧数据未标注，按 unverified 计，未经新 Schema 查证）' : ''))
  }
  lines.push('')
  if (problems.length === 0) {
    lines.push('**结论：放行。** 泄漏零命中，AT-ID 覆盖 100%。')
  } else {
    lines.push('**结论：不放行。** 共 ' + problems.length + ' 项问题：')
    lines.push('')
    for (const p of problems) lines.push('- ' + p)
  }
  fs.writeFileSync(reportPath, lines.join('\n') + '\n', 'utf8')
  for (const p of problems) console.error('[失败] ' + p)
  return problems
}

function main() {
  const [configPath] = process.argv.slice(2)
  if (!configPath) {
    console.error('用法: node build-output-spec.mjs <configPath>')
    process.exit(1)
  }
  if (!fs.existsSync(configPath)) {
    console.error('[失败] 配置文件不存在：' + configPath)
    process.exit(1)
  }
  let config
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } catch (err) {
    console.error('[失败] 配置 JSON 解析失败：' + configPath + '（' + err.message + '）')
    process.exit(1)
  }
  for (const key of ['specDir', 'templatePath']) {
    if (!config[key]) {
      console.error('[失败] 配置缺少必填字段：' + key)
      process.exit(1)
    }
  }
  const mode = config.mode || 'full'
  const allowlist = Array.isArray(config.allowlist) ? config.allowlist : ['AI']
  const plannerParts = config.plannerParts || []
  const plannerPath = config.plannerPath || ''

  // ============ planner-only 模式（R7：复用历史证据，只装配策划版链路） ============
  if (mode === 'planner-only') {
    if (!plannerPath) {
      console.error('[失败] planner-only 模式缺少 plannerPath')
      process.exit(1)
    }
    const sourceSpecDir = config.sourceSpecDir || ''
    if (!sourceSpecDir) {
      console.error('[失败] planner-only 模式缺少 sourceSpecDir（覆盖检查基准）')
      process.exit(1)
    }
    // 1. 合并策划版分片
    if (!mergeDocumentParts(plannerParts, plannerPath, '策划版')) process.exit(1)
    // 2. 追溯索引（sourceSpecDir 只读，产物写 specDir）
    const scanPath = path.join(sourceSpecDir, 'runtime', 'state', 'scan.json')
    const sourceIndexPath = path.join(sourceSpecDir, 'feature_index.json')
    const traceOut = path.join(config.specDir, 'trace_index.json')
    const trace = buildPlannerTrace(scanPath, sourceIndexPath, plannerParts, traceOut)
    if (!trace.ok) process.exit(1)
    // 3. 泄漏检查 + AT-ID 覆盖检查 + 报告
    const leak = checkPlannerLeakage(plannerPath, allowlist)
    const cov = checkAtomCoverage(plannerPath, traceOut)
    let sourceIndex = null
    try {
      sourceIndex = JSON.parse(fs.readFileSync(sourceIndexPath, 'utf8'))
    } catch (err) {
      console.error('[失败] sourceSpecDir feature_index.json 读取失败：' + err.message)
      process.exit(1)
    }
    const problems = plannerOnlyReport(config.specDir, plannerPath, leak.problems, cov, sourceIndex)
    if (problems.length > 0) {
      console.error('[失败] [planner-only 校验] 未通过，明细见 ' + path.join(config.specDir, 'runtime', 'spec_check', 'verify-report.md'))
      process.exit(1)
    }
    console.log('[成功] [planner-only 校验] 泄漏零命中，AT-ID 覆盖 100%，报告见 ' + path.join(config.specDir, 'runtime', 'spec_check', 'verify-report.md'))
    console.log('SUMMARY ' + JSON.stringify({ mode: 'planner-only', specDir: config.specDir, plannerPath: plannerPath, traceEntries: trace.entryCount }))
    return
  }

  // ============ full 模式（默认：双投影完整装配） ============
  for (const key of ['supplementPath']) {
    if (!config[key]) {
      console.error('[失败] 配置缺少必填字段：' + key)
      process.exit(1)
    }
  }

  // 步骤 1：合并技术补充版文档
  if (!mergeDocumentParts(config.supplementParts || [], config.supplementPath, '补充版')) process.exit(1)

  // 步骤 2：合并策划版文档（skipPlanner 时 plannerParts 为空，跳过）
  if (!mergeDocumentParts(plannerParts, plannerPath, '策划版')) process.exit(1)

  // 步骤 3：装配索引（feature_index.json + stage_manifest.md）
  const asm = assembleIndex(config.specDir, config.date || '', config.sourceDesc || '', config.expectedStageCount)
  if (!asm.ok) {
    console.error('[失败] [装配索引] 失败，明细见上方日志')
    process.exit(1)
  }

  // 步骤 4：追溯索引（plannerParts 非空时；full 模式 scan/索引刚装配在 specDir）
  const traceIndexPath = path.join(config.specDir, 'trace_index.json')
  if (plannerParts.length > 0) {
    const trace = buildPlannerTrace(
      path.join(config.specDir, 'runtime', 'state', 'scan.json'),
      path.join(config.specDir, 'feature_index.json'),
      plannerParts,
      traceIndexPath
    )
    if (!trace.ok) process.exit(1)
  }

  // 步骤 5：机械校验（含策划版泄漏/AT-ID 覆盖/difference 统计）
  const ver = verifyOutputSpec(config.specDir, config.supplementPath, config.templatePath, config.date || '', {
    plannerPath: plannerPath,
    traceIndexPath: traceIndexPath,
    allowlist: allowlist,
    skipPlanner: plannerParts.length === 0,
  })
  if (!ver.ok) {
    console.error('[失败] [机械校验] 未通过，明细见 ' + path.join(config.specDir, 'runtime', 'spec_check', 'verify-report.md'))
    process.exit(1)
  }

  console.log(
    'SUMMARY ' +
      JSON.stringify({
        mode: 'full',
        specDir: config.specDir,
        supplementPath: config.supplementPath,
        plannerPath: plannerPath,
        stageCount: asm.summary.stageCount,
        featureCount: asm.summary.featureCount,
        atomCount: asm.summary.atomCount,
        verdictTotal: ver.summary.verdictTotal,
        differenceStats: asm.summary.differenceStats,
      })
  )
}

main()
