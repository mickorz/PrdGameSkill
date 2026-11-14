// prepare-verify-atoms.mjs（OSG-W4 S2.3）
//
// 职责：server-rule-verify workflow 的匹配输入准备（确定性，无 LLM）——
//   读基线 feature_index（v2，只读），按 stageIds 过滤阶段，功能点贪心分片
//   （单片目标 ≤ MAX_ATOMS_PER_PART 个原子、硬上限 HARD_MAX_ATOMS_PER_PART、
//   绝不拆散功能点；超硬上限的功能点独立成片），为每片写
//   <outDir>/runtime/verify-input/<stageId>-p<NN>.json：
//     - 原子业务字段（id/name/rule/ui_requirement/verdict/difference/
//       difference_detail/notes，notes 超 400 字符截断控制单片体积）
//     - existingScopeEntries / existingSve：该片原子在正式产物
//       <outDir>/scope-index.json / server-evidence.json 中的既有条目
//       （幂等重跑参考 + SVE 编号避让；不读 *_sample.json 人工样本，
//       避免直接抄样本结论、失去链路验证意义）
//   另写 <outDir>/runtime/verify-input/manifest.json（阶段/分片清单，
//   workflow 扇出依据）。
//
// 可导入：export prepareVerifyAtoms({ featureIndexPath, outDir, stageIds, date })
//   返回 { ok, problems, manifest }，不退进程。
//
// CLI：node prepare-verify-atoms.mjs <featureIndexPath> <outDir> <stageIdsCsv|ALL> <date>
//   退出码 0 成功 / 1 失败（缺参、文件缺失、JSON 解析失败、阶段不存在、阶段无原子）。
//
// 约定：date 经参数传入（脚本内禁止取当前时间）；JSON 输出 1 空格缩进 UTF-8 LF。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MAX_ATOMS_PER_PART = 12
const HARD_MAX_ATOMS_PER_PART = 24
const NOTES_MAX_CHARS = 400
const GENERATED_BY = 'prepare-verify-atoms.mjs（OSG-W4 S2.3）'

export function prepareVerifyAtoms(input) {
  const problems = []
  const bad = (m) => problems.push(m)
  const I = input || {}
  const featureIndexPath = I.featureIndexPath || ''
  const outDir = I.outDir || ''
  const stageIdsCsv = I.stageIds || 'ALL'
  const date = I.date || ''
  if (!featureIndexPath) bad('featureIndexPath 缺失')
  if (!outDir) bad('outDir 缺失')
  if (problems.length > 0) return { ok: false, problems: problems, manifest: null }

  let featureIndex
  try {
    featureIndex = JSON.parse(fs.readFileSync(featureIndexPath, 'utf8'))
  } catch (e) {
    bad('feature_index 读取/解析失败：' + featureIndexPath + '（' + e.message + '）')
    return { ok: false, problems: problems, manifest: null }
  }

  // 阶段名映射（stages 数组优先，缺省回落 feature.stage_name）
  const stageNames = new Map()
  for (const s of featureIndex.stages || []) {
    if (s && s.id) stageNames.set(s.id, s.name || s.id)
  }

  // 目标阶段集合
  const allStageIds = [...new Set((featureIndex.features || []).map((f) => f.stage_id))]
  const wantAll = stageIdsCsv.trim().toUpperCase() === 'ALL'
  const targetSet = new Set(
    wantAll ? allStageIds : stageIdsCsv.split(',').map((s) => s.trim()).filter(Boolean)
  )
  if (!wantAll) {
    for (const id of targetSet) {
      if (!allStageIds.includes(id)) bad('阶段不存在于基线：' + id + '（基线阶段：' + allStageIds.join(',') + '）')
    }
  }
  if (problems.length > 0) return { ok: false, problems: problems, manifest: null }

  // 既有正式产物（幂等参考；不读 *_sample.json 人工样本）
  const loadFormal = (p, label) => {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'))
    } catch {
      return null
    }
  }
  const formalScope = loadFormal(path.join(outDir, 'scope-index.json'), 'scope-index')
  const formalSve = loadFormal(path.join(outDir, 'server-evidence.json'), 'server-evidence')
  const scopeByAtom = new Map((formalScope?.entries || []).map((e) => [e.atomId, e]))
  const sveByAtom = new Map()
  for (const e of formalSve?.entries || []) {
    if (!sveByAtom.has(e.atomId)) sveByAtom.set(e.atomId, [])
    sveByAtom.get(e.atomId).push(e)
  }

  // 按目标阶段聚合功能点（保持基线顺序）
  const byStage = new Map()
  for (const f of featureIndex.features || []) {
    if (!targetSet.has(f.stage_id)) continue
    if (!byStage.has(f.stage_id)) byStage.set(f.stage_id, [])
    const slimAtoms = (f.atoms || []).map((a) => ({
      id: a.id,
      name: a.name || '',
      rule: a.rule || '',
      ui_requirement: a.ui_requirement || '',
      verdict: a.verdict || '',
      difference: a.difference || '',
      difference_detail: a.difference_detail || '',
      notes:
        typeof a.notes === 'string' && a.notes.length > NOTES_MAX_CHARS
          ? a.notes.slice(0, NOTES_MAX_CHARS) + '…（截断，全文见基线）'
          : a.notes || '',
    }))
    byStage.get(f.stage_id).push({
      featureId: f.id,
      featureName: f.name || '',
      featureScope: typeof f.scope === 'string' && f.scope.length <= 200 ? f.scope : '',
      atoms: slimAtoms,
    })
  }

  // 输入目录就位 + 清理目标阶段的旧分片（防止收窄 stageIds 时残留旧文件）
  const inputDir = path.join(outDir, 'runtime', 'verify-input')
  fs.mkdirSync(inputDir, { recursive: true })
  const stagePrefixes = [...targetSet].map((id) => id + '-p')
  for (const name of fs.existsSync(inputDir) ? fs.readdirSync(inputDir) : []) {
    if (name.endsWith('.json') && name !== 'manifest.json' && stagePrefixes.some((p) => name.startsWith(p))) {
      fs.rmSync(path.join(inputDir, name))
    }
  }

  // 功能点贪心分片（不拆散功能点）
  const manifestStages = []
  let totalAtomCount = 0
  for (const stageId of allStageIds) {
    if (!targetSet.has(stageId)) continue
    const features = byStage.get(stageId) || []
    const atomTotal = features.reduce((n, f) => n + f.atoms.length, 0)
    if (atomTotal === 0) {
      bad('阶段无原子：' + stageId)
      continue
    }
    const parts = []
    let cur = null
    let curCount = 0
    for (const f of features) {
      const n = f.atoms.length
      if (n === 0) continue
      if (cur === null || curCount + n > Math.max(MAX_ATOMS_PER_PART, Math.min(n, HARD_MAX_ATOMS_PER_PART))) {
        cur = []
        parts.push(cur)
        curCount = 0
      }
      cur.push(f)
      curCount += n
    }
    const stageName = stageNames.get(stageId) || features[0].featureId
    const partFiles = []
    parts.forEach((groups, i) => {
      const partNo = String(i + 1).padStart(2, '0')
      const file = stageId + '-p' + partNo + '.json'
      const partAtomIds = new Set()
      for (const g of groups) for (const a of g.atoms) partAtomIds.add(a.id)
      const doc = {
        schemaVersion: 1,
        generatedBy: GENERATED_BY,
        date: date,
        baselineIndexPath: featureIndexPath,
        stageId: stageId,
        stageName: stageName,
        partNo: partNo,
        partCount: parts.length,
        atomCount: partAtomIds.size,
        featureGroups: groups,
        existingScopeEntries: [...partAtomIds].map((id) => scopeByAtom.get(id)).filter(Boolean),
        existingSve: [...partAtomIds].flatMap((id) => sveByAtom.get(id) || []),
      }
      fs.writeFileSync(path.join(inputDir, file), JSON.stringify(doc, null, 1) + '\n', 'utf8')
      partFiles.push(file)
    })
    manifestStages.push({ stageId: stageId, stageName: stageName, atomCount: atomTotal, partCount: parts.length, partFiles: partFiles })
    totalAtomCount += atomTotal
  }
  if (problems.length > 0) return { ok: false, problems: problems, manifest: null }

  const manifest = {
    schemaVersion: 1,
    generatedBy: GENERATED_BY,
    date: date,
    baselineIndexPath: featureIndexPath,
    stageIdsCsv: [...targetSet].join(','),
    inputDir: path.join(outDir, 'runtime', 'verify-input').replaceAll('\\', '/'),
    totalAtomCount: totalAtomCount,
    stages: manifestStages,
  }
  fs.writeFileSync(path.join(inputDir, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n', 'utf8')

  return { ok: true, problems: problems, manifest: manifest }
}

// ============================================================
// CLI
// ============================================================

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2)
  if (argv.length < 3 || argv.length > 4) {
    console.error('用法：node prepare-verify-atoms.mjs <featureIndexPath> <outDir> <stageIdsCsv|ALL> <date>')
    process.exit(1)
  }
  const r = prepareVerifyAtoms({ featureIndexPath: argv[0], outDir: argv[1], stageIds: argv[2], date: argv[3] || '' })
  if (!r.ok) {
    console.error('[失败] 匹配输入准备未通过，共 ' + r.problems.length + ' 项问题（不写产物）：')
    for (const p of r.problems) console.error('  - ' + p)
    process.exit(1)
  }
  const m = r.manifest
  console.log(
    '[成功] 匹配输入就绪：阶段 ' + m.stages.length + ' 个 / 原子 ' + m.totalAtomCount + ' 个 / 分片 ' +
      m.stages.reduce((n, s) => n + s.partCount, 0) + ' 片 -> ' + m.inputDir
  )
  process.exit(0)
}
