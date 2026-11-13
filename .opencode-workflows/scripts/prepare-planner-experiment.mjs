#!/usr/bin/env node
// 策划版对照实验（T0.1a）——确定性数据准备脚本
//
// 用途：为 experiment-planner-projection.js（workflow 投影脚本）准备每阶段的瘦身证据文件。
// 两步依赖：本脚本先跑（幂等，可重复覆盖 outDir/source/），用户再手动触发 workflow 投影。
//
// 为什么需要本脚本（2026-11-14 T0.1 前置核对结论，见执行计划 T0.1）：
//   1. workflow 沙箱无 readFile（见 workflows/bug-coverage-check.js 头注释），无法在 workflow
//      脚本内读 scan.json / feature_index.json；
//   2. feature_index.json 共 443KB，整体喂 agent 浪费且易截断，按阶段切分后单阶段仅几十 KB；
//   3. 结构化字段隔离（需求 R2 第一级）：瘦身剔除 client_logic / evidence / messages / owner
//      等技术字段，策划版写作输入只保留业务字段，从源头阻断技术内容进入写作上下文。
//
// 与 1-scan-template 返回值的差异适配（T0.1 前置核对项）：
//   scan.json 只有 { templatePath, totalLines, sections }，不含 stageSections/termsSection；
//   本脚本从 sections 按 kind 派生：kind==='stage' 为阶段章节，kind==='terms' 为名词章节。
//
// 输入（只读，历史产物零修改）：
//   <sourceSpecDir>/runtime/state/scan.json
//   <sourceSpecDir>/feature_index.json
// 输出（可写目录，可覆盖）：
//   <outDir>/source/meta.json                       阶段清单（供人工核对与 workflow 提示引用）
//   <outDir>/source/planner-evidence_<stageId>.json 每阶段瘦身证据（camelCase 业务字段）
//
// 用法：
//   node .opencode-workflows/scripts/prepare-planner-experiment.mjs <sourceSpecDir> <outDir> [stages]
//   stages 默认 ST-C01,ST-C05,ST-C02（定庄/吃碰杠/财神表现，需求 R8 三目标）
// 可导入：export main(sourceSpecDir, outDir, stages)（供 example 自检）

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const DEFAULT_STAGES = ['ST-C01', 'ST-C05', 'ST-C02']

// feature_index.json（snake_case）-> 策划版证据（camelCase）的字段映射
// 白名单即隔离：client_logic/evidence/messages/owner 不在映射表内，自然被剔除
const FIELD_MAP = {
  id: 'id',
  name: 'name',
  rule: 'rule',
  ui_requirement: 'uiRequirement',
  ui_interaction: 'uiInteraction',
  notes: 'notes',
  verdict: 'verdict',
}

// 从 scan.json 的 sections 派生 1-scan-template 返回值同构的阶段章节结构
function deriveStageSections(scan) {
  if (!scan || !Array.isArray(scan.sections) || scan.sections.length === 0) {
    throw new Error('scan.json 缺少 sections 数组')
  }
  const stageSections = scan.sections.filter((s) => s.kind === 'stage')
  if (stageSections.length === 0) throw new Error('scan.json 中没有 kind=stage 的章节')
  const termsArr = scan.sections.filter((s) => s.kind === 'terms')
  return { stageSections, termsSection: termsArr.length > 0 ? termsArr[0] : null }
}

// 瘦身单个原子项：snake_case 转 camelCase，仅保留白名单字段
function slimAtom(raw) {
  const out = {}
  for (const key of Object.keys(FIELD_MAP)) {
    out[FIELD_MAP[key]] = typeof raw[key] === 'string' ? raw[key] : ''
  }
  return out
}

export function main(sourceSpecDir, outDir, stages) {
  const stageIds = stages && stages.length > 0 ? stages : DEFAULT_STAGES

  // 输入校验（fail fast，历史目录只读不写）
  const scanPath = path.join(sourceSpecDir, 'runtime', 'state', 'scan.json')
  const indexPath = path.join(sourceSpecDir, 'feature_index.json')
  for (const p of [scanPath, indexPath]) {
    if (!fs.existsSync(p)) throw new Error('历史产物文件不存在（sourceSpecDir 只读，不得自行生成）：' + p)
  }
  const scan = JSON.parse(fs.readFileSync(scanPath, 'utf8'))
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'))

  const { stageSections, termsSection } = deriveStageSections(scan)

  // sections 的 title 与 features 的 stage_name 同源（章节名），据此建立 stage_id -> 章节映射
  const sectionByStageId = new Map()
  const stageIdByTitle = new Map()
  for (const f of index.features || []) stageIdByTitle.set(f.stage_name, f.stage_id)
  for (const sec of stageSections) {
    const sid = stageIdByTitle.get(sec.title)
    if (sid) sectionByStageId.set(sid, sec)
  }

  const outSourceDir = path.join(outDir, 'source')
  fs.mkdirSync(outSourceDir, { recursive: true })

  const metaEntries = []
  const written = []
  for (const stageId of stageIds) {
    const sec = sectionByStageId.get(stageId)
    if (!sec) throw new Error('stages 中的 ' + stageId + ' 在 scan.json sections(kind=stage) 中未找到（title 无法对齐 stage_id）')
    const features = (index.features || []).filter((f) => f.stage_id === stageId)
    if (features.length === 0) throw new Error('stages 中的 ' + stageId + ' 在 feature_index.json 中无功能点')
    const atoms = features.flatMap((f) => (f.atoms || []).map(slimAtom))
    if (atoms.length === 0) throw new Error('阶段 ' + stageId + ' 瘦身后无原子项')

    const evidence = {
      stageId: stageId,
      title: sec.title,
      sourceTitle: sec.sourceTitle || sec.title,
      fromLine: sec.fromLine,
      toLine: sec.toLine,
      templatePath: scan.templatePath,
      atomCount: atoms.length,
      termsFromLine: termsSection ? termsSection.fromLine : null,
      termsToLine: termsSection ? termsSection.toLine : null,
      atoms: atoms,
    }
    const filePath = path.join(outSourceDir, 'planner-evidence_' + stageId + '.json')
    fs.writeFileSync(filePath, JSON.stringify(evidence, null, 1), 'utf8')
    written.push(filePath)
    metaEntries.push({
      stageId: stageId,
      title: sec.title,
      fromLine: sec.fromLine,
      toLine: sec.toLine,
      atomCount: atoms.length,
      evidenceFile: 'source/planner-evidence_' + stageId + '.json',
    })
  }

  const meta = {
    generatedBy: 'prepare-planner-experiment.mjs',
    sourceSpecDir: sourceSpecDir,
    indexSchemaVersion: index.schema_version || 'v1（旧 Schema：无 businessBehavior/difference，2026-11-13 首跑）',
    templatePath: scan.templatePath,
    stages: metaEntries,
  }
  const metaPath = path.join(outSourceDir, 'meta.json')
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 1), 'utf8')
  written.push(metaPath)

  console.log(
    '[完成] 策划版实验证据准备：' + stageIds.length + ' 阶段 / ' +
      metaEntries.reduce((n, e) => n + e.atomCount, 0) + ' 原子项 -> ' + outSourceDir
  )
  return { metaPath, written, metaEntries }
}

// ---------------- CLI 入口 ----------------
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  const [sourceSpecDir, outDir, stagesArg] = process.argv.slice(2)
  if (!sourceSpecDir || !outDir) {
    console.error('用法: node prepare-planner-experiment.mjs <sourceSpecDir> <outDir> [stages 逗号分隔]')
    console.error('示例: node .opencode-workflows/scripts/prepare-planner-experiment.mjs spec-workflow/output-spec/2026-11-13/1-spec spec-workflow/output-spec/quality-compare/planner-experiment')
    process.exit(1)
  }
  const stages = stagesArg ? stagesArg.split(',').map((s) => s.trim()).filter(Boolean) : undefined
  try {
    main(sourceSpecDir, outDir, stages)
  } catch (e) {
    console.error('[失败] ' + (e && e.message ? e.message : e))
    process.exit(1)
  }
}
