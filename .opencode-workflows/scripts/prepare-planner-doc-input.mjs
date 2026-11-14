// prepare-planner-doc-input.mjs —— planner-only 链路策划版输入准备器（确定性命令，R7/T4.3）
//
// output-spec-generate 主编排 planner-only 模式配套：从 sourceSpecDir（历史查证证据，只读）
// 机械生成策划版投影输入文件，供 3-produce-outputs.js 以「agent 读证据文件」模式投影
// （workflow 沙箱无 readFile，结构化字段隔离靠本脚本源头保证：证据文件只含业务字段）。
//
// 与 prepare-planner-experiment.mjs（阶段 0 实验）的差异：全量 15 阶段 + 产物结构对齐
// 子流程 3（sections.json 元数据 + 每阶段业务证据），实验脚本逻辑同源（T4.3 允许复制）。
//
// 输入（只读，历史产物零修改）：
//   <sourceSpecDir>/runtime/state/scan.json        章节结构（sections 派生 stageSections/termsSection）
//   <sourceSpecDir>/feature_index.json             原子项索引（snake_case，v1/v2 均可）
//   <l7ClassifyPath>（可选，OSG-W4 S1.2）          classify-l7.mjs 产物 l7-classify.json，
//     有则按 atomId 内嵌 l7 + l7Reason（reviewReason 转写）进证据文件原子项（只透传业务字段，
//     reviewStatus/effectiveDifference/l7Basis 等过程状态不进策划版写作上下文）；
//     条目 atomId 必须都在基线原子集内（防基线漂移，fail fast）
//   <stageIdsCsv>（可选，OSG-W4 S1.2）             逗号分隔阶段 ID（如 ST-C01,ST-C02,ST-C04），
//     指定时 sections 只保留这些 stage 章节（intro/terms 不进 sections，供 3-produce-outputs
//     只调度这些阶段的投影任务；不指定时全量阶段，现行为不变）
// 输出（可写目录，可覆盖）：
//   <outDir>/runtime/planner-input/sections.json                章节元数据（含 intro/terms/stage kind；阶段过滤时仅过滤后的 stage 章节）
//   <outDir>/runtime/planner-input/planner-evidence_<stageId>.json  每阶段业务证据（camelCase 白名单字段 + l7 有则内嵌）
//
// 用法：
//   node .opencode-workflows/scripts/prepare-planner-doc-input.mjs <sourceSpecDir> <outDir> [l7ClassifyPath] [stageIdsCsv]
// 可导入：export main(sourceSpecDir, outDir, l7ClassifyPath, stageIdsCsv)（供 example 自检）
//
// 退出码：0 成功 / 1 失败（输入缺失 / 结构异常 / l7 数据漂移）

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// feature_index.json（snake_case）-> 策划版证据（camelCase）字段映射
// 白名单即隔离（R2 第一级）：client_logic/evidence/messages/owner 不在映射表内，自然被剔除
const FIELD_MAP = {
  id: 'id',
  name: 'name',
  rule: 'rule',
  ui_requirement: 'uiRequirement',
  ui_interaction: 'uiInteraction',
  notes: 'notes',
  verdict: 'verdict',
}

// L7 复核分类四值（设计文档 4.1，与 classify-l7.mjs 的 L7_MATRIX 输出一致）
const L7_VALUES = ['verified', 'verification_required', 'decision_required', 'not_applicable']

function slimAtom(raw, l7ByAtom) {
  const out = {}
  for (const key of Object.keys(FIELD_MAP)) {
    out[FIELD_MAP[key]] = typeof raw[key] === 'string' ? raw[key] : ''
  }
  // v2 索引带业务语义四元组时透传（snake -> camel），v1 视为无（不补空串冒充）
  if (raw.business_behavior && typeof raw.business_behavior === 'object') {
    out.businessBehavior = {
      trigger: raw.business_behavior.trigger || '',
      condition: raw.business_behavior.condition || '',
      action: raw.business_behavior.action || '',
      result: raw.business_behavior.result || '',
    }
  }
  // OSG-W4 S1.2：l7 复核分类内嵌（只透传 l7 + l7Reason 业务字段；未复核原子不硬凑）
  const l7e = l7ByAtom ? l7ByAtom.get(raw.id) : null
  if (l7e) {
    out.l7 = l7e.l7
    out.l7Reason = l7e.l7Reason
  }
  return out
}

// l7-classify 加载与对齐校验（OSG-W4 S1.2）：条目 atomId 必须都在基线原子集内
function loadL7(l7ClassifyPath, atomIds) {
  const byAtom = new Map()
  if (!l7ClassifyPath) return byAtom
  if (!fs.existsSync(l7ClassifyPath)) throw new Error('l7-classify 文件不存在：' + l7ClassifyPath)
  const l7 = JSON.parse(fs.readFileSync(l7ClassifyPath, 'utf8'))
  if (!Array.isArray(l7.entries)) throw new Error('l7-classify 缺 entries 数组：' + l7ClassifyPath)
  for (const e of l7.entries) {
    if (!e || !e.atomId || !L7_VALUES.includes(e.l7)) {
      throw new Error('l7-classify 条目缺 atomId 或 l7 非法：' + JSON.stringify(e).slice(0, 120))
    }
    if (byAtom.has(e.atomId)) throw new Error('l7-classify 条目 atomId 重复：' + e.atomId)
    byAtom.set(e.atomId, { l7: e.l7, l7Reason: typeof e.reviewReason === 'string' ? e.reviewReason : '' })
  }
  for (const atomId of byAtom.keys()) {
    if (!atomIds.has(atomId)) {
      throw new Error('l7-classify 条目 atomId 不在 sourceSpecDir 基线原子集内（l7 数据与基线漂移）：' + atomId)
    }
  }
  return byAtom
}

export function main(sourceSpecDir, outDir, l7ClassifyPath, stageIdsCsv) {
  const scanPath = path.join(sourceSpecDir, 'runtime', 'state', 'scan.json')
  const indexPath = path.join(sourceSpecDir, 'feature_index.json')
  for (const p of [scanPath, indexPath]) {
    if (!fs.existsSync(p)) throw new Error('历史产物文件不存在（sourceSpecDir 只读，不得自行生成）：' + p)
  }
  const scan = JSON.parse(fs.readFileSync(scanPath, 'utf8'))
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'))

  const sections = Array.isArray(scan.sections) ? scan.sections : []
  const stageSections = sections.filter((s) => s.kind === 'stage')
  if (stageSections.length === 0) throw new Error('scan.json 中没有 kind=stage 的章节')
  const termsArr = sections.filter((s) => s.kind === 'terms')
  const termsSection = termsArr.length > 0 ? { fromLine: termsArr[0].fromLine, toLine: termsArr[0].toLine, title: termsArr[0].title } : null

  // section.title 与 feature 的 stage_name 同源，据此建立 stage_id -> section 映射
  const stageIdByTitle = new Map()
  for (const f of index.features || []) stageIdByTitle.set(f.stage_name, f.stage_id)
  const sectionByStageId = new Map()
  for (const sec of stageSections) {
    const sid = sec.stageId || stageIdByTitle.get(sec.title)
    if (sid) sectionByStageId.set(sid, sec)
  }

  // 阶段过滤（OSG-W4 S1.2）：空 = 全量阶段（现行为）；指定时只投影这些阶段
  const stageFilter = stageIdsCsv ? String(stageIdsCsv).split(',').map((s) => s.trim()).filter(Boolean) : null
  if (stageFilter && stageFilter.length > 0) {
    for (const sid of stageFilter) {
      if (!sectionByStageId.has(sid)) {
        throw new Error('阶段过滤包含未知阶段 ID：' + sid + '（基线 stage 章节：' + Array.from(sectionByStageId.keys()).join('、') + '）')
      }
    }
  } else if (stageIdsCsv) {
    throw new Error('stageIdsCsv 为空串（要么不传走全量，要么传逗号分隔的阶段 ID）')
  }

  // l7 复核分类加载与基线对齐校验（atomId 集合 = 全量基线原子，与阶段过滤无关）
  const atomIds = new Set()
  for (const f of index.features || []) for (const at of f.atoms || []) atomIds.add(at.id)
  const l7ByAtom = loadL7(l7ClassifyPath, atomIds)

  const inputDir = path.join(outDir, 'runtime', 'planner-input')
  fs.mkdirSync(inputDir, { recursive: true })

  const written = []
  let atomTotal = 0
  let l7Embedded = 0
  for (const [stageId, sec] of sectionByStageId) {
    if (stageFilter && !stageFilter.includes(stageId)) continue
    const features = (index.features || []).filter((f) => f.stage_id === stageId)
    if (features.length === 0) throw new Error('阶段 ' + stageId + ' 在 feature_index.json 中无功能点')
    const evidence = {
      stageId: stageId,
      title: sec.title,
      sourceTitle: sec.sourceTitle || sec.title,
      fromLine: sec.fromLine,
      toLine: sec.toLine,
      templatePath: scan.templatePath,
      atomCount: features.reduce((n, f) => n + (f.atoms || []).length, 0),
      termsFromLine: termsSection ? termsSection.fromLine : null,
      termsToLine: termsSection ? termsSection.toLine : null,
      atoms: features.flatMap((f) => (f.atoms || []).map((at) => slimAtom(at, l7ByAtom))),
    }
    if (evidence.atoms.length === 0) throw new Error('阶段 ' + stageId + ' 瘦身后无原子项')
    l7Embedded += evidence.atoms.filter((a) => a.l7 !== undefined).length
    atomTotal += evidence.atoms.length
    const filePath = path.join(inputDir, 'planner-evidence_' + stageId + '.json')
    fs.writeFileSync(filePath, JSON.stringify(evidence, null, 1), 'utf8')
    written.push(filePath)
  }

  // 阶段过滤时 sections 只保留被投影的 stage 章节（intro/terms 不进，3-produce 不调度复制任务）
  const outSections = stageFilter
    ? sections.filter((s) => s.kind === 'stage' && stageFilter.includes(s.stageId || stageIdByTitle.get(s.title)))
    : sections
  const sectionsMeta = {
    templatePath: scan.templatePath,
    totalLines: scan.totalLines,
    sections: outSections,
    termsSection: termsSection,
    stageCount: stageFilter ? stageFilter.length : sectionByStageId.size,
  }
  const sectionsPath = path.join(inputDir, 'sections.json')
  fs.writeFileSync(sectionsPath, JSON.stringify(sectionsMeta, null, 1), 'utf8')
  written.push(sectionsPath)

  const l7Skipped = l7ByAtom.size - l7Embedded
  console.log(
    '[成功] [策划版输入准备] ' + sectionsMeta.stageCount + ' 阶段 / ' + atomTotal + ' 原子项 -> ' + inputDir +
      '（schema_version ' + (index.schema_version || 1) + '）' +
      (stageFilter ? '；阶段过滤：' + stageFilter.join(',') : '') +
      (l7ByAtom.size > 0
        ? '；l7 复核 ' + l7Embedded + '/' + l7ByAtom.size + ' 原子内嵌（' + l7ClassifyPath + '）' +
          (l7Skipped > 0 ? '，' + l7Skipped + ' 条不在投影阶段已跳过' : '')
        : '')
  )
  return {
    inputDir: inputDir,
    written: written,
    stageCount: sectionsMeta.stageCount,
    atomTotal: atomTotal,
    l7AtomCount: l7ByAtom.size,
    l7Embedded: l7Embedded,
    l7Skipped: l7Skipped,
  }
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  const [sourceSpecDir, outDir, l7ClassifyPath, stageIdsCsv] = process.argv.slice(2)
  if (!sourceSpecDir || !outDir) {
    console.error('用法: node prepare-planner-doc-input.mjs <sourceSpecDir> <outDir> [l7ClassifyPath] [stageIdsCsv]')
    console.error('示例: node .opencode-workflows/scripts/prepare-planner-doc-input.mjs spec-workflow/output-spec/2026-11-13/1-spec spec-workflow/output-spec/2026-11-14/1-spec')
    console.error('示例: node .opencode-workflows/scripts/prepare-planner-doc-input.mjs spec-workflow/output-spec/2026-11-14/1-spec spec-workflow/output-spec/2026-11-14/v3-planner-sample spec-workflow/output-spec/server-rule-verify/l7-classify_sample.json ST-C01,ST-C02,ST-C04')
    process.exit(1)
  }
  try {
    main(sourceSpecDir, outDir, l7ClassifyPath, stageIdsCsv)
  } catch (e) {
    console.error('[失败] ' + (e && e.message ? e.message : e))
    process.exit(1)
  }
}
