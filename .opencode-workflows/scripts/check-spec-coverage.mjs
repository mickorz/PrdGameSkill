// ============================================================
// check-spec-coverage.mjs —— S10 阶段文档 AT-ID 覆盖校验
//
// 执行文档 §5 S10 闸门（机械校验七维度：阶段文档原子 ID 一致 / 清单覆盖）。
// 职责（确定性，agent 自算行号不可靠 → 改扫描）：
//   1. 逐阶段读 5-specs/stages/spec_stage_ST-Cxx.md；
//   2. 校验：本阶段全部原子 ID 出现（缺一即失败）、不得出现其他阶段原子 ID（串阶段）、
//      不得出现分片标记/乱码残留（<<<<<<< / PART-BEGIN / ·· 等）；
//   3. blocked 原子必须在文档中带「查证未完成」语义标注。
//
// CLI：node check-spec-coverage.mjs --run-dir <dir> --date <YYYY-MM-DD>
//   退出码：0 通过 / 1 失败
// ============================================================

import fs from 'node:fs'
import path from 'node:path'

const toPosix = (p) => String(p).replaceAll('\\', '/')
function readJsonSafe(p) {
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(p, 'utf8')) }
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) }
  }
}

export function checkSpecCoverage({ runDir }) {
  const problems = []
  const specDir = path.join(runDir, '5-specs')
  const fiRead = readJsonSafe(path.join(specDir, 'feature_index.json'))
  if (!fiRead.ok) return { ok: false, problems: ['feature_index.json 不可读（先跑 build-unified-index）：' + fiRead.error], summary: null }
  const fi = fiRead.data

  const l7Read = readJsonSafe(path.join(runDir, '4-analysis', 'l7-classify.json'))
  const blocked = new Set((l7Read.ok && l7Read.data.blockedAtoms) || [])

  // 原子按阶段归组
  const byStage = new Map()
  for (const f of fi.features || []) {
    const stageId = f.stageId || (f.id || '').split('-')[1] + '-' + (f.id || '').split('-')[2]
    if (!byStage.has(stageId)) byStage.set(stageId, [])
    for (const a of f.atoms || []) byStage.get(stageId).push(a.id)
  }

  const BAD_MARKERS = ['<<<<<<<', '>>>>>>>', '=======', 'PART-BEGIN', 'PART-END', '\uFFFD', '待补充…', 'TODO']
  const stats = { stageCount: 0, docCount: 0, atomCount: 0, blockedCount: 0 }

  for (const [stageId, atomIds] of [...byStage.entries()].sort()) {
    stats.stageCount++
    const docPath = path.join(specDir, 'stages', 'spec_stage_' + stageId + '.md')
    if (!fs.existsSync(docPath)) {
      problems.push('阶段文档缺失：' + stageId + ' -> ' + toPosix(docPath))
      continue
    }
    stats.docCount++
    const text = fs.readFileSync(docPath, 'utf8')

    // 1. 本阶段原子全覆盖
    const missing = atomIds.filter((id) => !text.includes(id))
    if (missing.length > 0) problems.push(stageId + '：文档缺原子 ID（' + missing.length + ' 个）：' + missing.slice(0, 8).join(','))

    // 2. 不得串阶段（出现其他阶段原子 ID）
    for (const [otherStage, otherIds] of byStage) {
      if (otherStage === stageId) continue
      const leaked = otherIds.filter((id) => text.includes(id))
      if (leaked.length > 0) problems.push(stageId + '：文档混入其他阶段原子（' + otherStage + '）：' + leaked.slice(0, 5).join(','))
    }

    // 3. 分片标记 / 乱码
    for (const m of BAD_MARKERS) {
      if (text.includes(m)) problems.push(stageId + '：文档含分片标记或乱码「' + m + '」')
    }

    // 4. blocked 原子必须带「查证未完成」
    const stageBlocked = atomIds.filter((id) => blocked.has(id))
    for (const id of stageBlocked) {
      stats.blockedCount++
      const idx = text.indexOf(id)
      if (idx < 0) continue // 缺 ID 已在 1 报过
      const window = text.slice(idx, idx + 600)
      if (!window.includes('查证未完成')) {
        problems.push(stageId + '：blocked 原子 ' + id + ' 缺少「查证未完成」标注')
      }
    }
    stats.atomCount += atomIds.length
  }

  return { ok: problems.length === 0, problems, summary: stats }
}

function main() {
  const argv = process.argv.slice(2)
  const a = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--run-dir') a.runDir = argv[++i]
    else if (argv[i] === '--date') a.date = argv[++i]
  }
  if (!a.runDir) {
    console.error('用法：node check-spec-coverage.mjs --run-dir <dir> --date <YYYY-MM-DD>')
    process.exit(1)
  }
  const r = checkSpecCoverage({ runDir: a.runDir })
  if (!r.ok) {
    console.log('[失败] 阶段文档 AT-ID 覆盖校验未通过，共 ' + r.problems.length + ' 项：')
    for (const p of r.problems) console.log('  - ' + p)
    process.exit(1)
  }
  const s = r.summary
  console.log('[成功] 阶段文档覆盖校验：阶段 ' + s.stageCount + ' / 文档 ' + s.docCount + ' / 原子 ' + s.atomCount + '（blocked ' + s.blockedCount + ' 均带未完成标注）')
  process.exit(0)
}

if (process.argv[1] && toPosix(process.argv[1]).endsWith('check-spec-coverage.mjs')) main()
