// ============================================================
// prepare-verify-input.mjs —— S4/S5 查证输入准备（Registry 基线，双端共用）
//
// 执行文档 §5 S4/S5、§13。替代旧 prepare-verify-atoms.mjs 的 feature_index 基线（D7：一个需求事实源）。
//
// 职责（确定性，无 LLM）：
//   1. 读 <runDir>/1-registry/requirement-registry.json（只读）；
//   2. 按 stageIds 过滤（ALL / CSV），功能点贪心分片（不拆散功能点，单片 ≤ MAX_ATOMS_PER_PART）；
//   3. 每片写 <runDir>/<branchDir>/runtime/verify-input/<stageId><suffix><NN>.json：
//      只含需求侧字段（atomId/name/rule/uiRequirement/verificationScope/businessBehavior/source）
//      —— 不含任何查证字段（verdict/applicability/evidence），S4/S5 只读不写 Registry；
//      客户端分支注意：**全量原子**（技术视图需要客户端职责，不按 verificationScope 裁剪）；
//   4. 写 runtime/verify-input/manifest.json（阶段/分片清单，workflow 扇出依据）；
//   5. 写 runtime/run-status.json 骨架（**pending 唯一事实源**，§5.0 A / D5）：
//      全部分片初始 status=pending + atomIds 覆盖清单；agent 落盘成功后由 workflow 或
//      merge 前更新为 completed（未更新即 pending，绝不产 entry）。
//
// 分片命名（§5 S4/S5）：客户端 <stageId>-cp<NN>.json；服务端 <stageId>-p<NN>.json。
//
// 可导入：export prepareVerifyInput({ runDir, branch, stageIds, date })
//   返回 { ok, problems, manifest }
//
// CLI：node prepare-verify-input.mjs --run-dir <dir> --branch <client|server> --stage-ids <CSV|ALL> --date <YYYY-MM-DD>
//   退出码：0 成功 / 1 失败
//
// 约定：date 经参数传入；JSON 1 空格缩进 UTF-8 LF；排序码元序。
// ============================================================

import fs from 'node:fs'
import path from 'node:path'

const MAX_ATOMS_PER_PART = 12
const HARD_MAX_ATOMS_PER_PART = 24
const RULE_MAX_CHARS = 400

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
const toPosix = (p) => String(p).replaceAll('\\', '/')

function readJsonSafe(p) {
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(p, 'utf8')) }
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) }
  }
}

export function prepareVerifyInput(input) {
  const problems = []
  const bad = (m) => problems.push(m)
  const I = input || {}
  const runDir = I.runDir
  const branch = String(I.branch || '')
  const stageIdsCsv = String(I.stageIds || 'ALL')
  const date = String(I.date || '')

  if (!runDir) bad('runDir 缺失')
  if (branch !== 'client' && branch !== 'server') bad('branch 必须是 client 或 server：' + branch)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) bad('date 非法：' + date)
  if (problems.length > 0) return { ok: false, problems, manifest: null }

  const branchDir = branch === 'client' ? '2-client' : '3-server'
  const suffix = branch === 'client' ? '-cp' : '-p'

  const regRead = readJsonSafe(path.join(runDir, '1-registry', 'requirement-registry.json'))
  if (!regRead.ok) {
    bad('Registry 不可读（先跑 S3）：' + regRead.error)
    return { ok: false, problems, manifest: null }
  }
  const registry = regRead.data
  if (!Array.isArray(registry.features)) {
    bad('Registry 结构非法（features 非数组）')
    return { ok: false, problems, manifest: null }
  }

  // 目标阶段（Registry 顺序）
  const stageOrder = (registry.stages || []).map((s) => s.stageId)
  const allStageIds = [...new Set(registry.features.map((f) => f.stageId))]
  for (const id of allStageIds) if (!stageOrder.includes(id)) stageOrder.push(id)
  const wantAll = stageIdsCsv.trim().toUpperCase() === 'ALL'
  const targetSet = new Set(wantAll ? allStageIds : stageIdsCsv.split(',').map((s) => s.trim()).filter(Boolean))
  if (!wantAll) {
    for (const id of targetSet) {
      if (!allStageIds.includes(id)) bad('阶段不在 Registry：' + id + '（可用：' + allStageIds.join(',') + '）')
    }
  }
  if (problems.length > 0) return { ok: false, problems, manifest: null }

  // 仅需求侧字段投影（全量原子：不按 verificationScope 裁剪）
  const stageNameById = new Map((registry.stages || []).map((s) => [s.stageId, s.name || s.stageId]))
  const byStage = new Map()
  for (const f of registry.features) {
    if (!targetSet.has(f.stageId)) continue
    if (!byStage.has(f.stageId)) byStage.set(f.stageId, [])
    byStage.get(f.stageId).push({
      featureId: f.id,
      featureName: f.name || '',
      featureDescription: f.description || '',
      featureScope: f.scope || '',
      featureCoordination: f.coordination || '',
      atoms: (f.atoms || []).map((a) => ({
        atomId: a.atomId,
        name: a.name || '',
        rule: typeof a.rule === 'string' && a.rule.length > RULE_MAX_CHARS ? a.rule.slice(0, RULE_MAX_CHARS) + '…（截断）' : a.rule || '',
        uiRequirement: a.uiRequirement || '',
        verificationScope: a.verificationScope,
        businessBehavior: a.businessBehavior || { trigger: '', condition: '', action: '', result: '' },
        source: a.source || {},
      })),
    })
  }

  const inputDir = path.join(runDir, branchDir, 'runtime', 'verify-input')
  fs.mkdirSync(inputDir, { recursive: true })
  // 清理本分支命名模式的全部分片（防收窄 stageIds 时残留旧片 → merge 消费旧片）；
  // 分片生成确定性，全清重建安全；verify-output（agent 产物）不受影响。
  // 模式区分：客户端 -cp、服务端 -p（`-cp01` 不会被子串 `-p` 误匹配，因 `-c` 不被 `-p` 前缀包含）
  const partNameRe = branch === 'client' ? /^ST-C\d{2}-cp\d{2}\.json$/ : /^ST-C\d{2}-p\d{2}\.json$/
  for (const name of fs.readdirSync(inputDir)) {
    if (name !== 'manifest.json' && partNameRe.test(name)) {
      fs.rmSync(path.join(inputDir, name))
    }
  }

  // 功能点贪心分片（不拆散功能点）
  const manifestStages = []
  const runStatusParts = []
  let totalAtomCount = 0
  for (const stageId of stageOrder) {
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
    const stageName = stageNameById.get(stageId) || stageId
    const partFiles = []
    parts.forEach((groups, i) => {
      const partNo = String(i + 1).padStart(2, '0')
      const file = stageId + suffix + partNo + '.json'
      const atomIds = []
      for (const g of groups) for (const a of g.atoms) atomIds.push(a.atomId)
      atomIds.sort(cmp)
      const doc = {
        schemaVersion: 1,
        generatedBy: 'prepare-verify-input.mjs',
        date: date,
        branch: branch,
        registryPath: toPosix(path.join(runDir, '1-registry/requirement-registry.json')),
        stageId: stageId,
        stageName: stageName,
        partNo: partNo,
        partCount: parts.length,
        atomCount: atomIds.length,
        featureGroups: groups,
      }
      fs.writeFileSync(path.join(inputDir, file), JSON.stringify(doc, null, 1) + '\n', 'utf8')
      partFiles.push(file)
      runStatusParts.push({ partFile: file, stageId: stageId, status: 'pending', atomIds: atomIds })
    })
    manifestStages.push({ stageId, stageName, atomCount: atomTotal, partCount: parts.length, partFiles })
    totalAtomCount += atomTotal
  }
  if (problems.length > 0) return { ok: false, problems, manifest: null }
  if (runStatusParts.length === 0) {
    bad('未生成任何分片（目标阶段无原子）')
    return { ok: false, problems, manifest: null }
  }

  const manifest = {
    schemaVersion: 1,
    generatedBy: 'prepare-verify-input.mjs',
    date: date,
    branch: branch,
    stageIdsCsv: [...targetSet].join(','),
    inputDir: toPosix(inputDir),
    totalAtomCount: totalAtomCount,
    stages: manifestStages,
  }
  fs.writeFileSync(path.join(inputDir, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n', 'utf8')

  // run-status 骨架（pending 唯一事实源：初始全 pending，绝不乐观假设 completed）
  // 幂等：既有 run-status 中已完成分片的状态予以保留（断点续跑不倒退）
  const rsPath = path.join(runDir, branchDir, 'runtime', 'run-status.json')
  const prev = readJsonSafe(rsPath)
  const prevStatus = new Map()
  if (prev.ok && Array.isArray(prev.data.parts)) {
    for (const p of prev.data.parts) if (p && p.partFile) prevStatus.set(toPosix(p.partFile), p.status)
  }
  const parts = runStatusParts.map((p) => ({
    partFile: p.partFile,
    stageId: p.stageId,
    status: prevStatus.get(p.partFile) === 'completed' ? 'completed' : p.status,
    atomIds: p.atomIds,
  }))
  const runStatus = {
    schemaVersion: 1,
    branch: branch,
    date: date,
    runStatus: parts.every((p) => p.status === 'completed') ? 'completed' : parts.some((p) => p.status === 'completed') ? 'partial' : 'pending',
    parts: parts,
  }
  fs.mkdirSync(path.dirname(rsPath), { recursive: true })
  fs.writeFileSync(rsPath, JSON.stringify(runStatus, null, 1) + '\n', 'utf8')

  return { ok: true, problems: [], manifest }
}

// ============================================================
// CLI
// ============================================================

function main() {
  const argv = process.argv.slice(2)
  const a = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--run-dir') a.runDir = argv[++i]
    else if (argv[i] === '--branch') a.branch = argv[++i]
    else if (argv[i] === '--stage-ids') a.stageIds = argv[++i]
    else if (argv[i] === '--date') a.date = argv[++i]
  }
  if (!a.runDir || !a.branch || !a.date) {
    console.error('用法：node prepare-verify-input.mjs --run-dir <dir> --branch <client|server> --stage-ids <CSV|ALL> --date <YYYY-MM-DD>')
    process.exit(1)
  }
  const r = prepareVerifyInput({ runDir: a.runDir, branch: a.branch, stageIds: a.stageIds || 'ALL', date: a.date })
  if (!r.ok) {
    console.log('[失败] 查证输入准备未通过，共 ' + r.problems.length + ' 项问题（不写产物）：')
    for (const p of r.problems) console.log('  - ' + p)
    process.exit(1)
  }
  const m = r.manifest
  console.log(
    '[成功] 查证输入就绪：分支 ' + a.branch + ' / 阶段 ' + m.stages.length + ' 个 / 原子 ' + m.totalAtomCount +
      ' 个 / 分片 ' + m.stages.reduce((n, s) => n + s.partCount, 0) + ' 片（run-status 初始 pending）-> ' + m.inputDir
  )
  process.exit(0)
}

if (process.argv[1] && toPosix(process.argv[1]).endsWith('prepare-verify-input.mjs')) main()
