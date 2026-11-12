// align-check.mjs —— 共享快照与历史基线的 ID 对齐验证（阶段 2 验收工具，确定性脚本）
//
// 用途：把 game RTM run-20261112 的 363 条需求基线与新共享提取快照做 ID 对齐比对，
//   验证 exact + anchor 覆盖 >= 90%（门槛由 --min-rate 指定，默认 0.9），
//   未匹配项产出人工确认清单（不允许自动合并）。
//
// 用法：
//   node align-check.mjs <baseline> <snapshot> <outDir> [--min-rate 0.9] [--threshold 0.6] [--lead 0.25]
//     baseline  基线需求：单文件 JSON（数组或 {requirements:[]}）或 RTM run 目录（载入 requirements/parts/*.json）
//     snapshot  共享提取快照：requirements.json 路径或其所在 extraction 目录
//     outDir    报告输出目录（align-report.json / align-report.md）
//     --min-rate    对齐率门槛（默认 0.9，exact+anchor 匹配数 / 基线条数）
//     --threshold   anchor 相似度阈值（默认 0.6，与 requirements-build.mjs 同口径）
//     --lead        anchor 显著领先分差（默认 0.25，同上）
//
// 匹配规则（与 requirements-build.mjs 的 L1/L2 同算法：bigram Jaccard）：
//   L1 exact：规范化文本完全相同（normText 相等）
//   L2 anchor：同源文件（按 basename 归一）同章节下候选 top1 >= threshold 且
//              （唯一候选 / top2 差距 >= lead）-> 对齐
//   其余：未匹配，进人工确认清单
//
// 输出约定（对齐本仓库脚本惯例）：
//   [成功]/[失败] 前缀 + 最后一行 SUMMARY {json}；结构性失败退出码 1

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function argVal(name, fallback) {
  const i = process.argv.indexOf(name)
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback
}

// 与 requirements-build.mjs 同源算法（该文件为 CLI 形态不可导入，此处内联保持同口径）
const normText = (s) => String(s || '').replace(/\s+/g, '')
function bigrams(s) {
  const t = normText(s)
  const set = new Set()
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2))
  return set
}
function similarity(a, b) {
  const A = bigrams(a)
  const B = bigrams(b)
  if (A.size === 0 || B.size === 0) return 0
  let inter = 0
  for (const x of A) if (B.has(x)) inter += 1
  return inter / (A.size + B.size - inter)
}

// 源文件名归一：RTM 基线是相对路径，快照可能是绝对路径，按 basename 对齐；
// 文件名尾部日期或版本段（如 AI11-11、AI-11-12-2）一并剥离，支持 PRD 跨版本对齐
export function fileBase(f) {
  const base = String(f || '').replace(/\\/g, '/').split('/').pop()
  const stripped = base.replace(/[-_ ]?\d{1,4}[-_]\d{1,2}(?:[-_]\d{1,4})?(?:\.md)?$/i, '').replace(/\.md$/i, '')
  return stripped || base
}

// 载入需求列表：数组 / {requirements:[]} / RTM run 目录（requirements/parts/*.json）
function loadRequirements(target) {
  const st = fs.statSync(target)
  if (st.isDirectory()) {
    const partsDir = path.join(target, 'requirements', 'parts')
    if (!fs.existsSync(partsDir)) throw new Error('RTM run 目录缺 requirements/parts：' + target)
    const out = []
    for (const f of fs.readdirSync(partsDir).filter((x) => x.endsWith('.json')).sort()) {
      const arr = JSON.parse(fs.readFileSync(path.join(partsDir, f), 'utf8'))
      const list = Array.isArray(arr) ? arr : arr.requirements || []
      out.push(...list)
    }
    return out
  }
  const arr = JSON.parse(fs.readFileSync(target, 'utf8'))
  return Array.isArray(arr) ? arr : arr.requirements || []
}

function die(msg) {
  console.error('[失败] ' + msg)
  process.exit(1)
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 1), 'utf8')
}

// ---------- 对齐核心（纯函数，供自检导入） ----------
export function alignRequirements(baseline, snapshot, opts = {}) {
  const threshold = opts.threshold === undefined ? 0.6 : Number(opts.threshold)
  const lead = opts.lead === undefined ? 0.25 : Number(opts.lead)

  // L1 exact：normText 全文索引（同文本直接对齐，一_baseline 一快照）
  const byText = new Map()
  for (const s of snapshot) {
    const key = normText(s.text)
    if (!key) continue
    if (!byText.has(key)) byText.set(key, [])
    byText.get(key).push(s)
  }
  // anchor 索引：file(basename)|section -> 快照条目
  const byAnchor = new Map()
  for (const s of snapshot) {
    const aKey = fileBase(s.source && s.source.file) + '|' + String((s.source && s.source.section) || '')
    if (!byAnchor.has(aKey)) byAnchor.set(aKey, [])
    byAnchor.get(aKey).push(s)
  }

  const matches = [] // { baseline, snapshot, method, similarity }
  const used = new Set() // 已对齐的快照条目（存元素引用，避免下标体系混淆）
  const unmatchedBaseline = []
  const warnings = []

  baseline.forEach((b, i) => {
    // L1 exact
    const textKey = normText(b.text)
    if (textKey) {
      const cands = (byText.get(textKey) || []).filter((x) => !used.has(x))
      if (cands.length > 0) {
        const s = cands[0]
        used.add(s)
        matches.push({ baselineIndex: i, baselineKey: b.reqKey || b.requirementId, snapshotId: s.requirementId, snapshotKey: s.reqKey, method: 'exact', similarity: 1 })
        return
      }
    }
    // L2 anchor
    const aKey = fileBase(b.source && b.source.file) + '|' + String((b.source && b.source.section) || '')
    const cands = (byAnchor.get(aKey) || []).filter((x) => !used.has(x))
    if (cands.length === 0) {
      unmatchedBaseline.push({ baselineIndex: i, baselineKey: b.reqKey || b.requirementId, title: b.title, section: (b.source && b.source.section) || '', reason: '快照中无同章节候选' })
      return
    }
    const scored = cands
      .map((s) => ({ s, sim: similarity(b.text, s.text) }))
      .sort((x, y) => y.sim - x.sim)
    const top = scored[0]
    const second = scored[1]
    const unique = scored.length === 1 || second.sim < threshold
    const leads = !second || top.sim - second.sim >= lead
    if (top.sim >= threshold && (unique || leads)) {
      used.add(top.s)
      matches.push({ baselineIndex: i, baselineKey: b.reqKey || b.requirementId, snapshotId: top.s.requirementId, snapshotKey: top.s.reqKey, method: 'anchor', similarity: Math.round(top.sim * 1000) / 1000 })
      if (!unique) warnings.push('基线 ' + (b.reqKey || i) + ' anchor 命中靠显著领先（top1 ' + top.sim.toFixed(2) + ' / top2 ' + second.sim.toFixed(2) + '），建议人工抽查')
      return
    }
    unmatchedBaseline.push({
      baselineIndex: i,
      baselineKey: b.reqKey || b.requirementId,
      title: b.title,
      section: (b.source && b.source.section) || '',
      reason: top.sim >= threshold ? '同章节多候选无法区分（top1 ' + top.sim.toFixed(2) + ' / top2 ' + (second ? second.sim.toFixed(2) : '-') + '）' : '相似度不足（top1 ' + top.sim.toFixed(2) + ' < ' + threshold + '）',
    })
  })

  const unmatchedSnapshot = snapshot
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !used.has(s))
    .map(({ s, i }) => ({ snapshotIndex: i, snapshotId: s.requirementId, title: s.title, section: (s.source && s.source.section) || '', identityStatus: s.identityStatus || '' }))

  const exactCount = matches.filter((m) => m.method === 'exact').length
  const anchorCount = matches.filter((m) => m.method === 'anchor').length
  const rate = baseline.length === 0 ? null : (exactCount + anchorCount) / baseline.length
  return {
    matches,
    unmatchedBaseline,
    unmatchedSnapshot,
    warnings,
    stats: {
      baselineTotal: baseline.length,
      snapshotTotal: snapshot.length,
      exactMatch: exactCount,
      anchorMatch: anchorCount,
      unmatchedBaseline: unmatchedBaseline.length,
      unmatchedSnapshot: unmatchedSnapshot.length,
      rate,
    },
  }
}

// ---------- CLI（直接执行时跑；被 import 时只暴露纯函数） ----------
function main() {
const args = process.argv.slice(2)
if (args.length < 3 || args[0] === '--help') {
  console.log('用法: node align-check.mjs <baseline 文件或 RTM run 目录> <snapshot requirements.json 或目录> <outDir> [--min-rate 0.9] [--threshold 0.6] [--lead 0.25]')
  process.exit(args.length < 3 ? 1 : 0)
}
const [baselinePath, snapshotPath, outDir] = args
const minRate = Number(argVal('--min-rate', '0.9'))

let baseline
let snapshot
try {
  baseline = loadRequirements(baselinePath)
  snapshot = loadRequirements(snapshotPath)
} catch (e) {
  die('载入失败：' + e.message)
}
if (baseline.length === 0) die('基线需求数为 0：' + baselinePath)
if (snapshot.length === 0) die('快照需求数为 0：' + snapshotPath)

const result = alignRequirements(baseline, snapshot, {
  threshold: argVal('--threshold', undefined),
  lead: argVal('--lead', undefined),
})
const { stats } = result

fs.mkdirSync(outDir, { recursive: true })
writeJson(path.join(outDir, 'align-report.json'), {
  baseline: baselinePath,
  snapshot: snapshotPath,
  minRate,
  stats: stats,
  warnings: result.warnings,
  matches: result.matches,
  unmatchedBaseline: result.unmatchedBaseline,
  unmatchedSnapshot: result.unmatchedSnapshot,
})

const md = []
md.push('# 共享快照 ID 对齐报告')
md.push('')
md.push('- 基线：' + baselinePath + '（' + stats.baselineTotal + ' 条）')
md.push('- 快照：' + snapshotPath + '（' + stats.snapshotTotal + ' 条）')
const rateText = stats.rate === null ? '无' : (stats.rate * 100).toFixed(1) + '%'
md.push('- 对齐率：' + rateText + '（门槛 ' + (minRate * 100).toFixed(0) + '%，exact ' + stats.exactMatch + ' + anchor ' + stats.anchorMatch + '）/ 基线 ' + stats.baselineTotal + ' 条')
md.push('- 判定：' + (stats.rate !== null && stats.rate >= minRate ? '达标' : '未达标（未匹配项须人工裁决，禁止自动合并）'))
md.push('')
md.push('## 未匹配基线（人工确认清单，' + result.unmatchedBaseline.length + ' 条）')
md.push('')
md.push('| 基线键 | 标题 | 章节 | 原因 |')
md.push('|---|---|---|---|')
for (const u of result.unmatchedBaseline) {
  md.push('| ' + u.baselineKey + ' | ' + String(u.title || '').replace(/\|/g, '/') + ' | ' + String(u.section).replace(/\|/g, '/') + ' | ' + u.reason + ' |')
}
md.push('')
md.push('## 快照侧未对齐（' + result.unmatchedSnapshot.length + ' 条，新提取条目或拆分差异）')
md.push('')
md.push('| 快照 ID | 标题 | 章节 | identityStatus |')
md.push('|---|---|---|---|')
for (const u of result.unmatchedSnapshot) {
  md.push('| ' + u.snapshotId + ' | ' + String(u.title || '').replace(/\|/g, '/') + ' | ' + String(u.section).replace(/\|/g, '/') + ' | ' + (u.identityStatus || '-') + ' |')
}
fs.writeFileSync(path.join(outDir, 'align-report.md'), md.join('\n'), 'utf8')

const ok = stats.rate !== null && stats.rate >= minRate
console.log(
  (ok ? '[成功] ' : '[失败] ') + '对齐验证：基线 ' + stats.baselineTotal + ' 条 / 快照 ' + stats.snapshotTotal
    + ' 条，exact ' + stats.exactMatch + ' + anchor ' + stats.anchorMatch + '，对齐率 '
    + (stats.rate === null ? '无' : (stats.rate * 100).toFixed(1) + '%')
    + '（门槛 ' + (minRate * 100).toFixed(0) + '%）；未匹配基线 ' + stats.unmatchedBaseline
    + ' 条、快照侧 ' + stats.unmatchedSnapshot + ' 条、告警 ' + result.warnings.length + ' 条'
)
console.log('SUMMARY ' + JSON.stringify({ ok: ok, stats: stats, warningsCount: result.warnings.length }))
process.exit(ok ? 0 : 1)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
