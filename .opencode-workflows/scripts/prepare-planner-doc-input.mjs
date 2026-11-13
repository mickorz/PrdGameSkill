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
// 输出（可写目录，可覆盖）：
//   <outDir>/runtime/planner-input/sections.json                全部章节元数据（含 intro/terms/stage kind）
//   <outDir>/runtime/planner-input/planner-evidence_<stageId>.json  每阶段业务证据（camelCase 白名单字段）
//
// 用法：
//   node .opencode-workflows/scripts/prepare-planner-doc-input.mjs <sourceSpecDir> <outDir>
// 可导入：export main(sourceSpecDir, outDir)（供 example 自检）
//
// 退出码：0 成功 / 1 失败（输入缺失 / 结构异常）

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

function slimAtom(raw) {
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
  return out
}

export function main(sourceSpecDir, outDir) {
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

  const inputDir = path.join(outDir, 'runtime', 'planner-input')
  fs.mkdirSync(inputDir, { recursive: true })

  const written = []
  let atomTotal = 0
  for (const [stageId, sec] of sectionByStageId) {
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
      atoms: features.flatMap((f) => (f.atoms || []).map(slimAtom)),
    }
    if (evidence.atoms.length === 0) throw new Error('阶段 ' + stageId + ' 瘦身后无原子项')
    atomTotal += evidence.atoms.length
    const filePath = path.join(inputDir, 'planner-evidence_' + stageId + '.json')
    fs.writeFileSync(filePath, JSON.stringify(evidence, null, 1), 'utf8')
    written.push(filePath)
  }

  const sectionsMeta = {
    templatePath: scan.templatePath,
    totalLines: scan.totalLines,
    sections: sections,
    termsSection: termsSection,
    stageCount: sectionByStageId.size,
  }
  const sectionsPath = path.join(inputDir, 'sections.json')
  fs.writeFileSync(sectionsPath, JSON.stringify(sectionsMeta, null, 1), 'utf8')
  written.push(sectionsPath)

  console.log(
    '[成功] [策划版输入准备] ' + sectionByStageId.size + ' 阶段 / ' + atomTotal + ' 原子项 -> ' + inputDir +
      '（schema_version ' + (index.schema_version || 1) + '）'
  )
  return { inputDir: inputDir, written: written, stageCount: sectionByStageId.size, atomTotal: atomTotal }
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  const [sourceSpecDir, outDir] = process.argv.slice(2)
  if (!sourceSpecDir || !outDir) {
    console.error('用法: node prepare-planner-doc-input.mjs <sourceSpecDir> <outDir>')
    console.error('示例: node .opencode-workflows/scripts/prepare-planner-doc-input.mjs spec-workflow/output-spec/2026-11-13/1-spec spec-workflow/output-spec/2026-11-14/1-spec')
    process.exit(1)
  }
  try {
    main(sourceSpecDir, outDir)
  } catch (e) {
    console.error('[失败] ' + (e && e.message ? e.message : e))
    process.exit(1)
  }
}
