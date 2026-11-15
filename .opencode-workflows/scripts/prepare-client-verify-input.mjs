// prepare-client-verify-input.mjs —— S8 客户端侧查证输入准备器（确定性命令，设计 7.5）
//
// 职责：从正式四件选取「证据缺口」原子（scope applicability=unknown 且 l7=verification_required，
// 即服务端三根零实现、待客户端侧查证的原子），按阶段分片构造客户端查证输入
// （verify-input 分片，-pc 命名与 P/PR 代际隔离），供 3-verify-scope-client.js 消费。
//
// 输入（只读）：
//   <featureIndexPath>   v2 基线 feature_index.json（原子事实）
//   <verifyDir>          正式四件目录（scope-index / server-evidence / difference-review / l7-classify）
// 输出（可写）：
//   <verifyDir>/runtime/verify-input/<stageId>-pc<NN>.json   客户端查证输入分片（每阶段 ≤ partSize 原子）
//
// 分片内容：原子事实（id/name/rule/ui_requirement/notes/verdict/difference/difference_detail）
//   + gapNotes（difference-review.reviewReason：服务端零实现的缺口说明）
//   + existingScopeEntries（现 scope 条目幂等参考）
//   + existingSve（现证据条目幂等参考，按选取原子 evidenceIds 过滤）
//   + clientRoots（客户端两根目录，设计 7.3）
//
// 闸门：
//   1. 选取数交叉复核：unknown∧vr 选取数 = scope unknown 条目中 l7=vr 的原子数
//      （独立来源：l7-classify 条目 × scope-index 条目）
//   2. 选取原子全部在基线；scope 条目存在且 applicability=unknown
//   3. 分片原子数合计 = 选取数；回读复核
//   4. 未知条目零容差：l7 stats 交叉（vr 总数 = 条目重算）
//
// 用法：
//   node .opencode-workflows/scripts/prepare-client-verify-input.mjs <featureIndexPath> <verifyDir> <date> [partSize]
// 可导入：export prepareClientVerifyInput({ featureIndexPath, outDir, date, partSize })
//
// 退出码：0 成功 / 1 失败（退出码语义同仓库脚本约定）

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CLIENT_ROOTS = ['source-code/client/Code', 'source-code/client/Fgui']
const LAYER_BY_ROOT = { 'source-code/client/Code': 'client_code', 'source-code/client/Fgui': 'client_fgui' }

export function prepareClientVerifyInput({ featureIndexPath, outDir, date, partSize }) {
  const problems = []
  const bad = (msg) => {
    problems.push(msg)
    console.error('  - ' + msg)
  }

  const partSizeNum = Number(partSize) || 12

  // ---------- 读入 ----------
  const readJson = (p, label) => {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'))
    } catch {
      bad(label + ' 读取/解析失败：' + p)
      return null
    }
  }
  const featureIndex = readJson(featureIndexPath, '基线 feature_index')
  const scopeIndex = readJson(path.join(outDir, 'scope-index.json'), 'scope-index')
  const serverEvidence = readJson(path.join(outDir, 'server-evidence.json'), 'server-evidence')
  const differenceReview = readJson(path.join(outDir, 'difference-review.json'), 'difference-review')
  const l7All = readJson(path.join(outDir, 'l7-classify.json'), 'l7-classify')
  if (problems.length > 0) return { ok: false, problems, summary: null }

  // 基线原子索引（stage 归属 + 事实）
  const atomById = new Map()
  const stageById = new Map()
  for (const st of featureIndex.stages || []) stageById.set(st.id, st)
  for (const fe of featureIndex.features || []) {
    for (const a of fe.atoms || []) {
      atomById.set(a.id, { atom: a, stageId: fe.stage_id, featureId: fe.feature_id, featureName: fe.feature_name })
    }
  }

  const scopeByAtom = new Map()
  for (const e of scopeIndex.entries || []) scopeByAtom.set(e.atomId, e)
  const drByAtom = new Map()
  for (const e of differenceReview.entries || []) drByAtom.set(e.atomId, e)
  const l7ByAtom = new Map()
  for (const e of l7All.entries || []) l7ByAtom.set(e.atomId, e)

  // ---------- 选取（设计 7.5：证据缺口 = scope unknown ∧ l7 verification_required）----------
  const selected = []
  for (const e of l7All.entries || []) {
    if (e.l7 !== 'verification_required') continue
    const sc = scopeByAtom.get(e.atomId)
    if (!sc || sc.applicability !== 'unknown') continue
    selected.push(e.atomId)
  }

  // 闸门 1：交叉复核（scope unknown 条目中 l7=vr 的原子数 = 选取数）
  const vrTotal = (l7All.entries || []).filter((e) => e.l7 === 'verification_required').length
  const l7StatsVr = l7All.stats && l7All.stats.l7 ? l7All.stats.l7.verification_required : undefined
  if (l7StatsVr !== undefined && l7StatsVr !== vrTotal) {
    bad('l7 entries verification_required ' + vrTotal + ' != stats.l7 ' + l7StatsVr + '（数据漂移）')
  }
  const unknownVrAlt = new Set()
  for (const [atomId, sc] of scopeByAtom) {
    if (sc.applicability !== 'unknown') continue
    const l7e = l7ByAtom.get(atomId)
    if (l7e && l7e.l7 === 'verification_required') unknownVrAlt.add(atomId)
  }
  if (unknownVrAlt.size !== selected.length) {
    bad('选取数交叉复核不符：l7 条目路径 ' + selected.length + ' != scope 条目路径 ' + unknownVrAlt.size)
  }

  // 闸门 2：选取原子在基线 + scope 条目为 unknown
  for (const atomId of selected) {
    if (!atomById.has(atomId)) bad('选取原子不在基线：' + atomId)
    const sc = scopeByAtom.get(atomId)
    if (!sc || sc.applicability !== 'unknown') bad('选取原子 scope 非 unknown：' + atomId)
  }
  if (selected.length === 0) {
    bad('无证据缺口原子（scope unknown ∧ l7 verification_required 选取为空）')
  }
  if (problems.length > 0) return { ok: false, problems, summary: null }

  // ---------- 分片（按阶段，每片 ≤ partSize 原子）----------
  const byStage = new Map()
  for (const atomId of selected) {
    const stageId = atomById.get(atomId).stageId
    if (!byStage.has(stageId)) byStage.set(stageId, [])
    byStage.get(stageId).push(atomId)
  }
  const stageIds = [...byStage.keys()].sort()
  const stages = []
  const sveById = new Map()
  for (const e of serverEvidence.entries || []) sveById.set(e.id, e)
  let partCount = 0
  for (const stageId of stageIds) {
    const atomIds = byStage.get(stageId)
    const parts = []
    for (let i = 0; i < atomIds.length; i += partSizeNum) parts.push(atomIds.slice(i, i + partSizeNum))
    const stage = stageById.get(stageId) || {}
    const partFiles = []
    parts.forEach((chunk, idx) => {
      partCount++
      const partNo = String(idx + 1).padStart(2, '0')
      const file = stageId + '-pc' + partNo + '.json'
      // 分片内容
      const featureGroups = []
      const byFeature = new Map()
      for (const atomId of chunk) {
        const info = atomById.get(atomId)
        if (!byFeature.has(info.featureId)) {
          byFeature.set(info.featureId, { featureId: info.featureId, featureName: info.featureName, atoms: [] })
        }
        const a = info.atom
        byFeature.get(info.featureId).atoms.push({
          id: a.id,
          name: a.name,
          rule: a.rule,
          ui_requirement: a.ui_requirement || '',
          notes: a.notes || '',
          verdict: a.verdict,
          difference: a.difference,
          difference_detail: a.difference_detail || '',
        })
      }
      for (const g of byFeature.values()) featureGroups.push(g)
      const existingScopeEntries = chunk.map((atomId) => scopeByAtom.get(atomId))
      const existingSve = []
      for (const atomId of chunk) {
        const sc = scopeByAtom.get(atomId)
        for (const id of sc.evidenceIds || []) {
          const s = sveById.get(id)
          if (s && !existingSve.some((x) => x.id === id)) existingSve.push(s)
        }
      }
      const gapNotes = {}
      for (const atomId of chunk) {
        const dr = drByAtom.get(atomId)
        if (dr && dr.reviewReason) gapNotes[atomId] = dr.reviewReason
      }
      const doc = {
        schemaVersion: 1,
        generatedBy: 'prepare-client-verify-input.mjs',
        date: date,
        featureIndexPath: featureIndexPath,
        stageId: stageId,
        stageName: stage.name || stageId,
        partNo: partNo,
        partCount: parts.length,
        atomCount: chunk.length,
        client: true,
        clientRoots: CLIENT_ROOTS,
        layerByRoot: LAYER_BY_ROOT,
        featureGroups: featureGroups,
        gapNotes: gapNotes,
        existingScopeEntries: existingScopeEntries,
        existingSve: existingSve,
      }
      const outPath = path.join(outDir, 'runtime', 'verify-input', file)
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      fs.writeFileSync(outPath, JSON.stringify(doc, null, 1) + '\n', 'utf8')
      partFiles.push(file)
    })
    stages.push({ stageId: stageId, partFiles: partFiles })
  }

  // ---------- 闸门 3：分片原子数合计 + 回读 ----------
  const sum = stages.reduce((n, s) => n + s.partFiles.length, 0)
  if (sum !== partCount) bad('分片数核算不符：' + sum + ' != ' + partCount)
  let readback = 0
  for (const s of stages) {
    for (const f of s.partFiles) {
      const doc = readJson(path.join(outDir, 'runtime', 'verify-input', f), '回读分片')
      if (!doc) continue
      readback += doc.atomCount || 0
    }
  }
  if (readback !== selected.length) {
    bad('回读原子数合计 ' + readback + ' != 选取数 ' + selected.length)
  }
  if (problems.length > 0) return { ok: false, problems, summary: null }

  const summary = {
    stages: stages,
    atomCount: selected.length,
    partCount: partCount,
    selected: selected,
    vrTotal: vrTotal,
  }
  return { ok: true, problems: [], summary: summary }
}

// ---------- CLI ----------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const [featureIndexPath, outDir, date, partSize] = process.argv.slice(2)
  if (!featureIndexPath || !outDir || !date) {
    console.error('用法：node prepare-client-verify-input.mjs <featureIndexPath> <verifyDir> <date> [partSize]')
    console.error('示例：node .opencode-workflows/scripts/prepare-client-verify-input.mjs spec-workflow/output-spec/2026-11-14/1-spec/feature_index.json spec-workflow/output-spec/server-rule-verify 2026-11-14 12')
    process.exit(1)
  }
  const r = prepareClientVerifyInput({ featureIndexPath, outDir, date, partSize })
  if (!r.ok) {
    console.error('[失败] 客户端查证输入未构造，共 ' + r.problems.length + ' 项问题（不写产物）：')
    process.exit(1)
  }
  console.log('[成功] 客户端查证输入：' + r.summary.atomCount + ' 原子 / ' + r.summary.partCount + ' 分片')
  console.log('MANIFEST ' + JSON.stringify({ stages: r.summary.stages, atomCount: r.summary.atomCount, partCount: r.summary.partCount }))
  process.exit(0)
}
