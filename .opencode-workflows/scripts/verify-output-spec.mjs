// verify-output-spec.mjs —— 1-spec 产出校验器（确定性命令，机械闸门）
//
// output-spec-generate workflow 的配套脚本：对 specDir 与补充版本文档做机械校验，
// 结果写 <specDir>/runtime/spec_check/verify-report.md（对齐原 1-spec 的 runtime/spec_check 产物形态）。
//
// v2 策划版扩展（2026-11-14，需求 R2/R6/R9，T3.3/T3.7）：
//   - 新增 checkPlannerLeakage(plannerPath, allowlist)：泄漏正则清单扫描策划版成品
//     （正则为三级验收第二级防线，清单见需求文档与执行计划第 9 节），命中即 fail；
//     allowlist 为业务允许词（从 build-config 传入），命中行先剔除白名单词再扫描。
//   - 新增 AT-ID 覆盖检查（R9）：以 trace_index.json（build-planner-trace.mjs 机械生成）
//     为基准，策划版分片合并文本中出现的 AT-ID 集合与其对比，覆盖率非 100% 时列缺失清单并 fail
//     （not_found 的待确认行同样带 AT-ID，覆盖检查不受 verdict 影响）。
//   - 新增 difference 覆盖统计段：从 feature_index.json 聚合 difference 分布进 verify-report
//     （v1 旧数据无 difference 字段按 unverified 计并注明「未经新 Schema 查证」，不冒充已验证）。
//   - verifyOutputSpec 签名加可选 opts：{ plannerPath, traceIndexPath, allowlist, skipPlanner }，
//     不传 opts 时行为与 v1 完全一致（向后兼容，CLI 老用法不炸）。
//
// 可导入：export verifyOutputSpec(specDir, supplementPath, templatePath, date, opts)
//         export checkPlannerLeakage(plannerPath, allowlist)
//         返回 { ok, problems, summary }，不直接退出进程
// CLI 用法：
//   node verify-output-spec.mjs <specDir> <supplementPath> <templatePath> <date>
//   （策划版检查参数只经 build-output-spec.mjs 配置文件链路传入，CLI 保持 v1 用法）
//
// 校验维度：
//   1. feature_index.json 存在、可解析、计数自洽（stage/feature/atom 与实际数组一致）
//   2. 每阶段 stages/spec_stage_ST-Cxx.md 存在，原子项 ID 集合与 feature_index 完全一致
//   3. stage_manifest.md 存在且覆盖全部阶段 ID
//   4. 补充版本文档存在、含模板全部标题行（防章节静默丢失）、无乱码
//   5. 全部产出无 U+FFFD 乱码、无 PART-BEGIN/PART-END 分片标记残留
//   6.（v2）策划版泄漏正则扫描 + AT-ID 覆盖率 + difference 统计（opts 传入时）
//
// 退出码（CLI）：0 全部通过 / 1 任一维度失败（失败明细打印到 stderr，并写入 verify-report.md）

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function writeReport(reportPath, problems, summaryText) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  const lines = []
  lines.push('# 产出校验（output-spec-generate）')
  lines.push('')
  lines.push('> 机械闸门：文件存在性 / 索引计数自洽 / 阶段文档原子 ID 一致性 / 清单覆盖 / 补充版本章节完整性 / 乱码与分片标记。')
  lines.push('')
  if (problems.length === 0) {
    if (summaryText) lines.push(summaryText)
    lines.push('')
    lines.push('**结论：放行。** 全部维度通过。')
  } else {
    lines.push('**结论：不放行。** 共 ' + problems.length + ' 项问题：')
    lines.push('')
    for (const p of problems) lines.push('- ' + p)
  }
  fs.writeFileSync(reportPath, lines.join('\n') + '\n', 'utf8')
}

function checkTextProblems(text, label, problems) {
  if (text.includes('\uFFFD')) problems.push(label + ' 含乱码替换字符 U+FFFD')
  if (text.includes('PART-BEGIN') || text.includes('PART-END')) problems.push(label + ' 残留分片标记 PART-BEGIN/PART-END')
}

function extractAtomIds(md) {
  const ids = []
  const re = /^#### `?(AT-[A-Za-z0-9-]+)/gm
  let m
  while ((m = re.exec(md)) !== null) ids.push(m[1])
  return ids
}

// ============================================================
// v2 策划版扩展（R2/R6/R9）
// ============================================================

// 泄漏正则清单（执行计划第 9 节，三级验收第二级防线：拦已知模式，不是根治）
const LEAK_PATTERNS = [
  { re: /source-code/, label: '源码路径' },
  { re: /\.[tj]s:\d+/, label: 'file:line 定位' },
  { re: /\b[A-Z][a-z]+[A-Z]\w*(Cmd|View|Data|Config|Protocol|Manager)\b/, label: '大驼峰类名' },
  { re: /\bMsg[A-Z]\w+/, label: '协议消息名' },
  { re: /\bCMD_[A-Z_]+/, label: '协议命令名' },
  { re: /\b(set|get|on)[A-Z]\w+/, label: '方法名' },
  { re: /\bC_[A-Za-z]/, label: '组件引用名' },
  { re: /\b[A-Z]{2,}(_[A-Z0-9]+)+\b/, label: 'SCREAMING_SNAKE 常量' },
  { re: /box_hzmj_|box_mah_/, label: 'FairyGUI 组件/包名' },
]

// 策划版泄漏检查：逐行剔除白名单词后跑正则清单，命中即 problem（附行号与命中内容）
// 可独立导入调用（build-output-spec.mjs planner-only 分支也用）
export function checkPlannerLeakage(plannerPath, allowlist) {
  const problems = []
  if (!fs.existsSync(plannerPath)) {
    problems.push('策划版文档不存在：' + plannerPath)
    return { ok: false, problems: problems, hits: [] }
  }
  const text = fs.readFileSync(plannerPath, 'utf8')
  if (text.includes('\uFFFD')) problems.push('策划版文档含乱码替换字符 U+FFFD')
  const allow = Array.isArray(allowlist) ? allowlist : []
  const hits = []
  text.split('\n').forEach((rawLine, i) => {
    const line = allow.length > 0 ? allow.reduce((s, w) => s.split(w).join(' '), rawLine) : rawLine
    for (const p of LEAK_PATTERNS) {
      const m = line.match(p.re)
      if (m) {
        hits.push({ line: i + 1, pattern: p.label, match: m[0] })
        problems.push('策划版泄漏（第 ' + (i + 1) + ' 行，' + p.label + '）：' + m[0])
      }
    }
  })
  return { ok: problems.length === 0, problems: problems, hits: hits }
}

// AT-ID 覆盖检查（R9）：以 trace_index.json 为基准，比对策划版文本中出现的 AT-ID 集合
// 覆盖率非 100% 列缺失清单；策划版出现基准外的 AT-ID 同样列为问题
// （导出供 build-output-spec.mjs planner-only 分支复用）
export function checkAtomCoverage(plannerPath, traceIndexPath) {
  const problems = []
  if (!fs.existsSync(traceIndexPath)) {
    problems.push('trace_index.json 不存在（AT-ID 覆盖检查基准缺失）：' + traceIndexPath)
    return { coverage: 0, missing: [], extra: [], problems: problems }
  }
  let trace
  try {
    trace = JSON.parse(fs.readFileSync(traceIndexPath, 'utf8'))
  } catch (err) {
    problems.push('trace_index.json 解析失败：' + err.message)
    return { coverage: 0, missing: [], extra: [], problems: problems }
  }
  const baseIds = (trace.entries || []).map((e) => e.atomId)
  if (baseIds.length === 0) {
    problems.push('trace_index.json entries 为空（追溯索引生成异常）')
    return { coverage: 0, missing: [], extra: [], problems: problems }
  }
  const plannerText = fs.readFileSync(plannerPath, 'utf8')
  const found = new Set()
  // 原子项 ID 格式：AT-ST-Cxx-nnn（阶段 C 后 2 位、原子项 3 位，如 AT-ST-C01-001）
  const re = /\bAT-ST-C\d{2}-\d{3}\b/g
  let m
  while ((m = re.exec(plannerText)) !== null) found.add(m[0])
  const baseSet = new Set(baseIds)
  const missing = baseIds.filter((id) => !found.has(id))
  const extra = Array.from(found).filter((id) => !baseSet.has(id))
  if (missing.length > 0) {
    problems.push('策划版 AT-ID 覆盖缺失 ' + missing.length + ' 个（AI 漏写补充内容）：' + missing.slice(0, 30).join('、') + (missing.length > 30 ? ' ...' : ''))
  }
  if (extra.length > 0) {
    problems.push('策划版出现基准外 AT-ID ' + extra.length + ' 个：' + extra.slice(0, 30).join('、') + (extra.length > 30 ? ' ...' : ''))
  }
  const coverage = (baseIds.length - missing.length) / baseIds.length
  return { coverage: coverage, missing: missing, extra: extra, problems: problems }
}

export function verifyOutputSpec(specDir, supplementPath, templatePath, date, opts) {
  const problems = []
  const reportPath = path.join(specDir, 'runtime', 'spec_check', 'verify-report.md')
  // v2 策划版检查参数（不传时行为与 v1 完全一致）
  const O = opts || {}
  const plannerPath = O.plannerPath || ''
  const skipPlanner = O.skipPlanner === true

  // 维度 1：feature_index.json
  const indexPath = path.join(specDir, 'feature_index.json')
  if (!fs.existsSync(indexPath)) {
    problems.push('feature_index.json 不存在：' + indexPath)
    writeReport(reportPath, problems)
    for (const p of problems) console.error('[失败] ' + p)
    console.error('[失败] 共 ' + problems.length + ' 项问题，详见 ' + reportPath)
    return { ok: false, problems: problems, summary: null }
  }
  let index
  try {
    index = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
  } catch (err) {
    problems.push('feature_index.json 解析失败：' + err.message)
    writeReport(reportPath, problems)
    for (const p of problems) console.error('[失败] ' + p)
    console.error('[失败] 共 ' + problems.length + ' 项问题，详见 ' + reportPath)
    return { ok: false, problems: problems, summary: null }
  }
  checkTextProblems(JSON.stringify(index), 'feature_index.json', problems)
  const stages = index.stages || []
  const features = index.features || []
  const atomTotal = features.reduce((s, f) => s + (f.atoms || []).length, 0)
  if (stages.length === 0) problems.push('feature_index.json stages 为空')
  if (index.stage_count !== stages.length) {
    problems.push('stage_count 不自洽：声明 ' + index.stage_count + '，实际 ' + stages.length)
  }
  if (index.feature_count !== features.length) {
    problems.push('feature_count 不自洽：声明 ' + index.feature_count + '，实际 ' + features.length)
  }
  if (index.atom_count !== atomTotal) {
    problems.push('atom_count 不自洽：声明 ' + index.atom_count + '，实际 ' + atomTotal)
  }
  const stageNameById = new Map(stages.map((s) => [s.id, s.name]))
  const atomIdsByStage = new Map()
  for (const s of stages) atomIdsByStage.set(s.id, new Set())
  for (const f of features) {
    if (!stageNameById.has(f.stage_id)) {
      problems.push('功能点 ' + f.id + ' 的 stage_id 不在 stages 清单：' + f.stage_id)
      continue
    }
    if ((f.atoms || []).length === 0) problems.push('功能点 ' + f.id + ' 无原子项')
    for (const a of f.atoms || []) {
      const set = atomIdsByStage.get(f.stage_id)
      if (set) set.add(a.id)
      if (a.verdict !== 'confirmed' && a.verdict !== 'partial' && a.verdict !== 'not_found') {
        problems.push('原子项 ' + a.id + ' verdict 不合法：' + a.verdict)
      }
    }
  }

  // 维度 2：阶段文档与原子项 ID 集合
  for (const s of stages) {
    const docPath = path.join(specDir, 'stages', 'spec_stage_' + s.id + '.md')
    if (!fs.existsSync(docPath)) {
      problems.push('阶段文档缺失：' + docPath)
      continue
    }
    const md = fs.readFileSync(docPath, 'utf8')
    checkTextProblems(md, '阶段文档 ' + s.id, problems)
    if (!md.includes(s.id)) problems.push('阶段文档 ' + s.id + ' 未包含自身阶段 ID')
    const docIds = extractAtomIds(md)
    const expected = atomIdsByStage.get(s.id) || new Set()
    const docSet = new Set(docIds)
    if (docIds.length !== docSet.size) {
      problems.push('阶段文档 ' + s.id + ' 原子项标题 ID 重复')
    }
    for (const id of expected) {
      if (!docSet.has(id)) problems.push('阶段文档 ' + s.id + ' 缺原子项 ' + id)
    }
    for (const id of docSet) {
      if (!expected.has(id)) problems.push('阶段文档 ' + s.id + ' 多出未登记原子项 ' + id)
    }
  }

  // 维度 3：stage_manifest.md
  const manifestPath = path.join(specDir, 'stage_manifest.md')
  if (!fs.existsSync(manifestPath)) {
    problems.push('stage_manifest.md 不存在：' + manifestPath)
  } else {
    const manifest = fs.readFileSync(manifestPath, 'utf8')
    checkTextProblems(manifest, 'stage_manifest.md', problems)
    for (const s of stages) {
      if (!manifest.includes(s.id)) problems.push('stage_manifest.md 缺阶段 ' + s.id)
    }
  }

  // 维度 4：补充版本文档（含模板标题行全覆盖检查，防章节静默丢失）
  if (!fs.existsSync(supplementPath)) {
    problems.push('补充版本文档不存在：' + supplementPath)
  } else {
    const sup = fs.readFileSync(supplementPath, 'utf8')
    checkTextProblems(sup, '补充版本文档', problems)
    if (fs.existsSync(templatePath)) {
      const tpl = fs.readFileSync(templatePath, 'utf8')
      const mainTitle = (tpl.split('\n').find((l) => l.startsWith('# ')) || '').slice(2).trim()
      if (mainTitle && !sup.includes(mainTitle)) {
        problems.push('补充版本文档缺模板主标题：' + mainTitle)
      }
      if (/^## 名词/m.test(tpl) && !/^## 名词/m.test(sup)) {
        problems.push('补充版本文档缺「## 名词」章节')
      }
      // 标题行全覆盖：模板每个标题行（去首尾空白）必须出现在补充版中
      const supLines = new Set(sup.split('\n').map((l) => l.trim()))
      const tplHeadings = tpl
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => /^#{1,6}\s/.test(l))
      for (const h of tplHeadings) {
        if (!supLines.has(h)) problems.push('补充版本文档缺模板标题行：' + h)
      }
    } else {
      problems.push('模板不存在，章节完整性检查跳过：' + templatePath)
    }
    for (const s of stages) {
      if (s.name && !sup.includes(s.name)) {
        problems.push('补充版本文档缺阶段章节标题：' + s.name)
      }
    }
  }

  // 维度 6（v2，opts 传入时）：策划版泄漏检查 + AT-ID 覆盖检查（R2/R6/R9）
  let plannerCoverage = null
  if (plannerPath && !skipPlanner) {
    const leak = checkPlannerLeakage(plannerPath, O.allowlist)
    for (const p of leak.problems) problems.push(p)
    const traceIndexPath = O.traceIndexPath || path.join(specDir, 'trace_index.json')
    const cov = checkAtomCoverage(plannerPath, traceIndexPath)
    for (const p of cov.problems) problems.push(p)
    plannerCoverage = cov
  }

  // 汇总与放行
  const verdictTotal = { confirmed: 0, partial: 0, not_found: 0 }
  for (const f of features) {
    for (const a of f.atoms || []) verdictTotal[a.verdict] = (verdictTotal[a.verdict] || 0) + 1
  }
  // v2 difference 统计（T3.3）：未标注口径 = 原始索引无 difference 字段（v1）或
  // 装配器兜底补的 unverified（schema_marked=false，v1 片段经装配），均不冒充已验证
  const diffTotal = { consistent: 0, partial: 0, conflict: 0, unverified: 0 }
  let diffUnmarked = 0
  for (const f of features) {
    for (const a of f.atoms || []) {
      const d = a.difference !== undefined ? a.difference : 'unverified'
      if (diffTotal[d] === undefined) {
        diffTotal.unverified++
      } else {
        diffTotal[d]++
      }
      if (a.difference === undefined || a.schema_marked === false) diffUnmarked++
    }
  }
  const summary = {
    stages: stages.length,
    features: features.length,
    atoms: atomTotal,
    verdictTotal: verdictTotal,
    differenceTotal: diffTotal,
    differenceUnmarked: diffUnmarked,
    supplementPath: supplementPath,
    plannerPath: plannerPath || null,
    plannerCoverage: plannerCoverage ? plannerCoverage.coverage : null,
  }

  if (problems.length > 0) {
    writeReport(reportPath, problems)
    for (const p of problems) console.error('[失败] ' + p)
    console.error('[失败] 共 ' + problems.length + ' 项问题，详见 ' + reportPath)
    return { ok: false, problems: problems, summary: summary }
  }

  const lines = []
  lines.push('- 原子项总数 ' + atomTotal + '（confirmed ' + verdictTotal.confirmed + ' / partial ' + verdictTotal.partial + ' / not_found ' + verdictTotal.not_found + '）')
  lines.push('- difference 分布：consistent ' + diffTotal.consistent + ' / partial ' + diffTotal.partial + ' / conflict ' + diffTotal.conflict + ' / unverified ' + diffTotal.unverified + (diffUnmarked > 0 ? '（其中 ' + diffUnmarked + ' 个为 v1 旧数据未标注 difference，按 unverified 计，未经新 Schema 查证）' : '（全部经新 Schema 查证标注）'))
  lines.push('- 阶段文档 ' + stages.length + '/' + stages.length + ' 齐全，原子项 ID 集合与 feature_index 一致')
  lines.push('- feature_index.json 解析通过，计数自洽（阶段 ' + stages.length + ' / 功能点 ' + features.length + '）')
  lines.push('- stage_manifest.md 覆盖全部 ' + stages.length + ' 个阶段')
  lines.push('- 补充版本文档 ' + supplementPath + ' 含模板全部标题行，无乱码')
  lines.push('- 全部产出无 U+FFFD 乱码、无分片标记残留')
  if (plannerPath && !skipPlanner) {
    if (plannerCoverage) {
      lines.push('- 策划版文档 ' + plannerPath + '：泄漏正则零命中（白名单 ' + JSON.stringify(O.allowlist || []) + '），AT-ID 覆盖率 ' + (plannerCoverage.coverage * 100).toFixed(1) + '%')
    }
  }
  lines.push('')
  lines.push('| 阶段 | 原子项 | 已证实 | 部分证实 | 未找到 |')
  lines.push('| --- | --- | --- | --- | --- |')
  for (const s of stages) {
    let c = 0
    let p = 0
    let n = 0
    let total = 0
    for (const f of features) {
      if (f.stage_id !== s.id) continue
      for (const a of f.atoms || []) {
        total++
        if (a.verdict === 'confirmed') c++
        else if (a.verdict === 'partial') p++
        else n++
      }
    }
    lines.push('| ' + s.id + ' ' + String(s.name || '').replace(/\|/g, '／') + ' | ' + total + ' | ' + c + ' | ' + p + ' | ' + n + ' |')
  }
  writeReport(reportPath, problems, lines.join('\n'))

  console.log('[成功] 产出校验通过：阶段 ' + stages.length + ' / 功能点 ' + features.length + ' / 原子项 ' + atomTotal)
  console.log('SUMMARY ' + JSON.stringify(summary))
  return { ok: true, problems: [], summary: summary }
}

// CLI 直调守卫（被 import 时不执行）
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  const [specDir, supplementPath, templatePath, date] = process.argv.slice(2)
  if (!specDir || !supplementPath || !templatePath) {
    console.error('用法: node verify-output-spec.mjs <specDir> <supplementPath> <templatePath> <date>')
    process.exit(1)
  }
  const r = verifyOutputSpec(specDir, supplementPath, templatePath, date)
  process.exit(r.ok ? 0 : 1)
}
