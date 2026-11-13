// build-planner-trace.mjs —— 策划版追溯索引生成器（确定性命令，R9，T3.7）
//
// output-spec-generate workflow v3 策划视图分离配套脚本：从 scan.json（章节结构）+
// feature_index.json（原子项）机械生成 trace_index.json，不经 LLM 归纳。
//
// 用途：verify-output-spec.mjs 以本索引为基准检查策划版文档的 Atom ID 覆盖
// （覆盖率非 100% fail + 缺失清单进 verify-report），杜绝 AI 漏写补充内容后校验仍通过。
//
// 可导入：export buildPlannerTrace(scanPath, indexPath, plannerParts, outPath)
//         返回 { ok, problems, entryCount, byStage }，不直接退出进程
// CLI 用法：
//   node build-planner-trace.mjs <scanPath> <indexPath> <outPath> [plannerParts 逗号分隔]
//   plannerParts 为策划版分片文件列表（part-NN.md，按 section.no 编号）；
//   CLI 传中文路径有编码风险，正式链路经 build-output-spec.mjs（配置文件传参）调用。
//
// 条目结构（需求 6.3，不设 EV 编号：evidenceCount 仅作统计）：
//   { atomId, sourceStage, sourceRule, plannerSection, plannerPart, evidenceCount, required, reviewStatus }
//   reviewStatus=pending 供人工抽查后翻转，仅作记录不作闸门。
//   required（v3.1，口径对齐策划版 Prompt「不硬凑」规则）：uiInteraction 非空 ||
//   businessBehavior 四元组任一非空 || verdict=not_found —— 即「策划版 Prompt 必然要求
//   写补充行（界面表现/待确认）」的原子；覆盖闸门（checkAtomCoverage）只对 required=true
//   的条目计分母。uiInteraction/notes/businessBehavior 全空的 confirmed/partial 原子
//   （纯知识规则，如「万条筒各 36 张」）按 Prompt 规则不硬凑补充行，不进覆盖分母，
//   实际缺失仅在报告提示（防漏写与防编造口径一致）。notes 不参与判定：v1 notes 多为
//   技术查证记录（实现方式描述），转写硬规则禁止复制，不能作为必有补充行的依据。
//
// 退出码（CLI）：0 成功 / 1 失败（输入缺失 / 分片不齐 / JSON 解析失败）

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function pad2(n) {
  return String(n).padStart(2, '0')
}

export function buildPlannerTrace(scanPath, indexPath, plannerParts, outPath) {
  const problems = []
  const bad = (msg) => {
    problems.push(msg)
    console.error('[失败] [追溯索引] ' + msg)
    return { ok: false, problems: problems, entryCount: 0, byStage: {} }
  }

  for (const p of [scanPath, indexPath]) {
    if (!fs.existsSync(p)) return bad('输入文件不存在：' + p)
  }
  let scan
  let index
  try {
    scan = JSON.parse(fs.readFileSync(scanPath, 'utf8'))
    index = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
  } catch (err) {
    return bad('JSON 解析失败：' + err.message)
  }
  const sections = Array.isArray(scan.sections) ? scan.sections : []
  const stageSections = sections.filter((s) => s.kind === 'stage')
  if (stageSections.length === 0) return bad('scan.json 中没有 kind=stage 的章节')

  // 分片文件集合（按文件名比对；plannerParts 为空时跳过存在性校验）
  const partSet = new Set((plannerParts || []).map((p) => path.basename(p)))

  const features = Array.isArray(index.features) ? index.features : []
  const atomsByStage = new Map()
  for (const f of features) {
    for (const at of f.atoms || []) {
      const arr = atomsByStage.get(f.stage_id) || []
      arr.push(at)
      atomsByStage.set(f.stage_id, arr)
    }
  }

  const entries = []
  const byStage = {}
  let requiredTotal = 0
  for (const sec of stageSections) {
    const stageId = sec.stageId
    if (!stageId) return bad('stage 章节缺 stageId：' + sec.title)
    const partName = 'part-' + pad2(sec.no) + '.md'
    if (partSet.size > 0 && !partSet.has(partName)) {
      return bad('策划版分片不齐：章节 ' + sec.title + '（' + stageId + '）对应 ' + partName + ' 不在 plannerParts 列表')
    }
    const atoms = atomsByStage.get(stageId) || []
    for (const at of atoms) {
      // required 判定（v3.1）：兼容 v1（snake_case）与 v2（camelCase）索引字段
      const uiInteraction = at.ui_interaction || at.uiInteraction || ''
      const bb = at.business_behavior || at.businessBehavior || {}
      const bbNonEmpty =
        (bb.trigger || bb.condition || bb.action || bb.result || '').length > 0
      const required =
        uiInteraction.trim().length > 0 || bbNonEmpty || at.verdict === 'not_found'
      if (required) requiredTotal++
      entries.push({
        atomId: at.id,
        sourceStage: stageId,
        sourceRule: at.rule || '',
        plannerSection: sec.sourceTitle || sec.title,
        plannerPart: partName,
        evidenceCount: (at.evidence || []).length,
        required: required,
        reviewStatus: 'pending',
      })
    }
    byStage[stageId] = atoms.length
  }
  if (entries.length === 0) return bad('feature_index.json 中没有任何原子项可建追溯条目')

  const trace = {
    generatedBy: 'build-planner-trace.mjs（机械生成，不经 LLM 归纳）',
    scanPath: scanPath,
    indexPath: indexPath,
    indexSchemaVersion: index.schema_version || 1,
    entryCount: entries.length,
    requiredCount: requiredTotal,
    entries: entries,
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(trace, null, 1), 'utf8')

  const stageSummary = Object.keys(byStage)
    .map((k) => k + ':' + byStage[k])
    .join('、')
  console.log(
    '[成功] [追溯索引] ' + entries.length + ' 条（覆盖必查 ' + requiredTotal + '）-> ' + outPath +
      '（' + stageSummary + '）'
  )
  return { ok: true, problems: [], entryCount: entries.length, requiredCount: requiredTotal, byStage: byStage }
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  const [scanPath, indexPath, outPath, partsArg] = process.argv.slice(2)
  if (!scanPath || !indexPath || !outPath) {
    console.error('用法: node build-planner-trace.mjs <scanPath> <indexPath> <outPath> [plannerParts 逗号分隔]')
    process.exit(1)
  }
  const plannerParts = partsArg ? partsArg.split(',').map((s) => s.trim()).filter(Boolean) : []
  const r = buildPlannerTrace(scanPath, indexPath, plannerParts, outPath)
  process.exit(r.ok ? 0 : 1)
}
