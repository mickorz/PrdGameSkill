// ============================================================
// recount-verify-parts.mjs —— 落判分片确定性重算与完整性闸门
//
// 职责：
//   以落判分片文件（runtime/verify-output/<stageId>-p<NN>.json）为准，
//   对照准备输入（runtime/verify-input/<同名>.json）逐分片重算：
//   - 条目对期望原子全覆盖（缺失/混入外来原子均 fail）
//   - 分片内 atomId 不重复
//   - applicability ∈ {active, conditional, inactive, unknown}
//   - 重算四类分布与 sveCount（不信任 agent 返回的摘要计数，摘要仅告警）
//   成功时把重算结果写入 recountPath（供 workflow 回读聚合）。
//
// 可导入：export recountVerifyParts({ outDir, partFiles, recountPath })
//   partFiles: [{ stageId, file }, ...]（目标阶段分片清单，来自子流程 2 透传）
//   返回 { ok, problems, summary }：
//     summary = { partCount, atomCount, sveCount, scopeStats, parts }
//     parts = [{ stageId, file, atomCount, active, conditional, unknown, inactive, sveCount }]
//
// CLI：node recount-verify-parts.mjs <outDir> <partFilesCsv> <recountPath>
//   partFilesCsv：逗号分隔分片文件名（不含目录，与 verify-output 下同名）
//   退出码：0 成功（重算结果已写 recountPath）/ 1 存在问题（不写 recountPath）
//   问题明细打印到 stdout（[失败] 前缀逐条列出）。
// ============================================================

import fs from 'node:fs'
import path from 'node:path'

const APPLICABILITY_SET = new Set(['active', 'conditional', 'inactive', 'unknown'])

function readJsonSafe(p) {
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(p, 'utf8')) }
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) }
  }
}

function expectedAtomIdsOfInput(input) {
  const ids = []
  for (const g of input.featureGroups || []) {
    for (const a of g.atoms || []) ids.push(a.id)
  }
  return ids
}

export function recountVerifyParts({ outDir, partFiles, recountPath }) {
  const problems = []
  const parts = []
  const scopeStats = { active: 0, conditional: 0, unknown: 0, inactive: 0 }
  let atomTotal = 0
  let sveTotal = 0

  for (const pf of partFiles) {
    const inFile = path.join(outDir, 'runtime', 'verify-input', pf.file)
    const outFile = path.join(outDir, 'runtime', 'verify-output', pf.file)
    const inRead = readJsonSafe(inFile)
    if (!inRead.ok) {
      problems.push('准备输入不可读：' + pf.file + ' -> ' + inRead.error)
      continue
    }
    const outRead = readJsonSafe(outFile)
    if (!outRead.ok) {
      problems.push('落判分片不可读：' + pf.file + ' -> ' + outRead.error)
      continue
    }
    const input = inRead.data
    const output = outRead.data
    const expected = expectedAtomIdsOfInput(input)
    const entries = Array.isArray(output.entries) ? output.entries : null
    if (!entries) {
      problems.push('落判分片缺 entries 数组：' + pf.file)
      continue
    }
    const seen = new Map()
    for (const e of entries) {
      if (!e || typeof e.atomId !== 'string' || e.atomId === '') {
        problems.push('落判条目 atomId 非法：' + pf.file + ' -> ' + JSON.stringify(e && e.atomId))
        continue
      }
      if (seen.has(e.atomId)) {
        problems.push('落判条目 atomId 重复：' + pf.file + ' -> ' + e.atomId)
        continue
      }
      seen.set(e.atomId, e)
    }
    const expectedSet = new Set(expected)
    for (const id of seen.keys()) {
      if (!expectedSet.has(id)) problems.push('落判条目混入外来原子：' + pf.file + ' -> ' + id)
    }
    for (const id of expected) {
      if (!seen.has(id)) problems.push('期望原子缺落判条目：' + pf.file + ' -> ' + id)
    }
    if (input.atomCount !== undefined && input.atomCount !== expected.length) {
      problems.push(
        '准备输入 atomCount 与 featureGroups 不符：' + pf.file +
          ' atomCount=' + input.atomCount + ' 实际=' + expected.length
      )
    }
    const counts = { active: 0, conditional: 0, unknown: 0, inactive: 0 }
    let sveCount = 0
    for (const e of entries) {
      if (!APPLICABILITY_SET.has(e.applicability)) {
        problems.push('applicability 非法枚举：' + pf.file + ' -> ' + e.atomId + ' = ' + JSON.stringify(e.applicability))
        continue
      }
      counts[e.applicability]++
      sveCount += Array.isArray(e.sve) ? e.sve.length : 0
    }
    const part = {
      stageId: pf.stageId,
      file: pf.file,
      atomCount: expected.length,
      active: counts.active,
      conditional: counts.conditional,
      unknown: counts.unknown,
      inactive: counts.inactive,
      sveCount,
    }
    parts.push(part)
    atomTotal += part.atomCount
    sveTotal += sveCount
    scopeStats.active += counts.active
    scopeStats.conditional += counts.conditional
    scopeStats.unknown += counts.unknown
    scopeStats.inactive += counts.inactive
  }

  const ok = problems.length === 0
  const summary = {
    partCount: parts.length,
    atomCount: atomTotal,
    sveCount: sveTotal,
    scopeStats,
    parts,
  }
  if (ok && recountPath) {
    const payload = {
      schemaVersion: 1,
      generatedBy: 'recount-verify-parts.mjs',
      partFiles: partFiles.map((p) => p.file),
      partCount: summary.partCount,
      atomCount: summary.atomCount,
      sveCount: summary.sveCount,
      scopeStats: summary.scopeStats,
      parts: summary.parts,
    }
    fs.mkdirSync(path.dirname(recountPath), { recursive: true })
    fs.writeFileSync(recountPath, JSON.stringify(payload, null, 1) + '\n', 'utf8')
  }
  return { ok, problems, summary }
}

// ============================================================
// CLI
// ============================================================

function cliMain(argv) {
  if (argv.length !== 3) {
    console.error('用法：node recount-verify-parts.mjs <outDir> <partFilesCsv> <recountPath>')
    process.exit(1)
  }
  const [outDir, partFilesCsv, recountPath] = argv
  const partFiles = String(partFilesCsv)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
    .map((file) => ({ stageId: String(file.split('-p')[0]), file }))
  const r = recountVerifyParts({ outDir, partFiles, recountPath })
  if (!r.ok) {
    console.log('[失败] 落判分片重算未通过，共 ' + r.problems.length + ' 项问题（不写重算结果）：')
    for (const p of r.problems) console.log('  - ' + p)
    process.exit(1)
  }
  console.log(
    '[成功] 落判分片重算通过：分片 ' + r.summary.partCount + ' 片 / 原子 ' + r.summary.atomCount +
      ' / SVE ' + r.summary.sveCount + '，active ' + r.summary.scopeStats.active +
      ' / conditional ' + r.summary.scopeStats.conditional +
      ' / unknown ' + r.summary.scopeStats.unknown +
      ' / inactive ' + r.summary.scopeStats.inactive +
      ' -> ' + recountPath
  )
  process.exit(0)
}

if (process.argv[1] && process.argv[1].endsWith('recount-verify-parts.mjs')) {
  cliMain(process.argv.slice(2))
}
