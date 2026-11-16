// prepare-retry-input.mjs —— 待补证重跑输入构造器（OSG-W4 余量跟踪 S7/S9，2026-11-14）
//
// 职责：从正式四件 + v2 基线 + 原始 match-output 分片确定性构造「待补证第 N 轮」输入：
//   - 选取（与 build-verify-reports.mjs 待补证分类同口径）：l7=verification_required 且
//     （scope=active；或 conditional 且 configConfirm=default 且 effectiveDifference≠consistent）
//   - 按阶段分片（默认每片 ≤ partSize 原子，分片名 round2=<stageId>-r<NN>.json /
//     round3+=<stageId>-r2<NN>.json——retry 代际后缀，坑 8 教训）
//   - 写 <outDir>/runtime/verify-input/<分片名>（原子业务字段 + retryHint
//     前轮缺口摘要 + existingScopeEntries/existingSve 幂等复用口径）
//     与 <outDir>/runtime/match-output/<分片名>（原始匹配候选按原子过滤）
//   - 原件 = 首轮 -p<NN> 分片：仅首轮分片参与归档（runtime/{verify-input,match-output,
//     verify-output,review-output} -> runtime/archive/<tag>/）；原件已归档时跳过归档，
//     从 runtime/archive/* 各历史 tag 扫描读原件（先到先得）
//   - 陈旧 retry 分片清理（四目录）：所有非 -p 原件的分片（-r/-r2/-pc 等，已并入正式四件）
//     全部移除——避免 stageIds=ALL 增量 merge 重复消费旧代际分片覆盖新代际结论
//   - stdout 输出 manifest JSON：{ stages: [{stageId, partFiles}], atomCount, partCount, ... }
//     供 3-verify-scope.js / 4-review-difference.js 的 stages 参数使用
//
// 闸门（任一 fail 不写产物）：
//   1. 选取数交叉复核 = l7 verification_required 总数 - unknown 数 - client 数 - 已闭环数
//      （closed = conditional 签认 + effectiveDifference=consistent；client = 客户端作用域证据缺口类）
//   2. 每个选取原子必须有原始 match 条目（重跑输入必须带首轮候选）
//   3. 分片原子合计 = 选取数，无重复；partCount/partNo/atomCount 自洽
//   4. 写盘回读复核（分片数/原子数）；归档后原目录不存在或为空
//
// CLI：node prepare-retry-input.mjs <featureIndexPath> <outDir> <date> [partSize] [archiveTag] [round]
// 退出码：0 成功 / 1 失败
//
// 可导入：export prepareRetryInput({ featureIndexPath, outDir, date, partSize, archiveTag, round, stageTag })

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch (e) {
    throw new Error('JSON 读取/解析失败：' + p + '（' + e.message + '）')
  }
}

function trimText(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n) + '…' : t
}

const RETRY_DIRS = ['verify-input', 'match-output', 'verify-output', 'review-output']

export function prepareRetryInput({ featureIndexPath, outDir, date, partSize, archiveTag, round, stageTag }) {
  const problems = []
  const bad = (m) => problems.push(m)
  if (!featureIndexPath || !outDir) {
    return { ok: false, problems: ['入参缺失：featureIndexPath / outDir'], summary: null }
  }
  const size = Number(partSize) > 0 ? Number(partSize) : 12
  // retry 代际（坑 8 教训）：round 2 = S7（-r 分片）；round 3+ = S9+（-r2/-r3 分片，SVE 前缀 PR2/PR3）
  const rd = Number(round) || 2
  if (!Number.isInteger(rd) || rd < 2) {
    return { ok: false, problems: ['round 非法（>=2）：' + String(round)], summary: null }
  }
  const suffix = rd >= 3 ? 'r' + (rd - 1) : 'r'
  const roundCn = { 2: '二', 3: '三', 4: '四', 5: '五' }[rd] || String(rd)
  const stTag = String(stageTag || '').trim() || (rd === 2 ? 'S7' : 'S' + (2 * rd + 3))
  const gapDesc = rd === 2 ? '第一轮' : '前' + (rd === 3 ? '两' : String(rd - 1)) + '轮'
  const tag = String(archiveTag || '').trim() || 'pre-' + stTag.toLowerCase() + '-retry'
  const baseline = readJson(featureIndexPath)
  const scopeIdx = readJson(path.join(outDir, 'scope-index.json'))
  const sveAll = readJson(path.join(outDir, 'server-evidence.json'))
  const drAll = readJson(path.join(outDir, 'difference-review.json'))
  const l7All = readJson(path.join(outDir, 'l7-classify.json'))

  // ---------- 基线索引 ----------
  const stageName = new Map()
  for (const s of baseline.stages || []) stageName.set(s.id, s.name)
  const atomById = new Map()
  const atomStage = new Map()
  for (const f of baseline.features || []) {
    for (const a of f.atoms || []) {
      atomById.set(a.id, a)
      atomStage.set(a.id, { stageId: f.stage_id, featureId: f.feature_id, featureName: f.feature_name })
    }
  }

  // ---------- 正式四件索引 ----------
  const scopeByAtom = new Map((scopeIdx.entries || []).map((e) => [e.atomId, e]))
  const drByAtom = new Map((drAll.entries || []).map((e) => [e.atomId, e]))
  const sveById = new Map()
  for (const e of sveAll.entries || []) sveById.set(e.id, e)
  const l7ByAtom = new Map((l7All.entries || []).map((e) => [e.atomId, e]))

  // ---------- 选取（与报告待补证分类同口径） ----------
  const selected = []
  for (const [atomId, l7e] of l7ByAtom) {
    if (l7e.l7 !== 'verification_required') continue
    const sc = scopeByAtom.get(atomId)
    const dr = drByAtom.get(atomId)
    if (!sc || !dr) {
      bad('verification_required 原子缺 scope/DR 条目：' + atomId)
      continue
    }
    if (sc.applicability === 'active') {
      selected.push(atomId)
    } else if (
      sc.applicability === 'conditional' &&
      sc.configConfirm === 'default' &&
      dr.effectiveDifference !== 'consistent'
    ) {
      selected.push(atomId)
    }
  }

  // ---------- 闸门 1：选取数交叉复核 ----------
  const vrTotal = [...l7ByAtom.values()].filter((e) => e.l7 === 'verification_required').length
  // 独立交叉：l7 stats 统计块（落盘后手改 entries/stats 漂移在此拦截）
  const l7StatsVr = l7All.stats && l7All.stats.l7 ? l7All.stats.l7.verification_required : undefined
  if (l7StatsVr !== undefined && l7StatsVr !== vrTotal) {
    bad('l7 entries verification_required ' + vrTotal + ' != stats.l7 ' + l7StatsVr + '（数据漂移）')
  }
  const unknownCount = [...l7ByAtom.values()].filter((e) => {
    const sc = scopeByAtom.get(e.atomId)
    return e.l7 === 'verification_required' && sc && sc.applicability === 'unknown'
  }).length
  // S8 起客户端作用域原子（证据缺口类）不在服务端补证选取范围
  const clientCount = [...l7ByAtom.values()].filter((e) => {
    const sc = scopeByAtom.get(e.atomId)
    return e.l7 === 'verification_required' && sc && sc.applicability === 'client'
  }).length
  const closedCount = [...l7ByAtom.values()].filter((e) => {
    const sc = scopeByAtom.get(e.atomId)
    const dr = drByAtom.get(e.atomId)
    return (
      e.l7 === 'verification_required' && sc && sc.applicability === 'conditional' &&
      sc.configConfirm === 'default' && dr && dr.effectiveDifference === 'consistent'
    )
  }).length
  if (selected.length !== vrTotal - unknownCount - clientCount - closedCount) {
    bad(
      '选取数交叉复核不符：选取 ' + selected.length + ' != vr ' + vrTotal +
        ' - unknown ' + unknownCount + ' - client ' + clientCount + ' - 已闭环 ' + closedCount
    )
  }
  if (selected.length === 0) {
    bad('无待补证原子（选取为空）')
  }

  // ---------- 原始 match 条目（现目录原件或 archive 各历史 tag 下原件） ----------
  const runtimeDir = path.join(outDir, 'runtime')
  // 原件 = 首轮 -p<NN> 分片；其余（-r/-r2/-pc 等）均为 retry 代际产物（陈旧即清理）
  const isOriginalFile = (f) => /-p\d+\.json$/.test(f)
  const readMatchEntries = (dir) => {
    const byAtom = new Map()
    const d = path.join(dir, 'match-output')
    if (!fs.existsSync(d)) return byAtom
    // 只读原始分片（-p 命名）；本目录里的 retry 代际分片不是原件
    for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.json') && isOriginalFile(x)).sort()) {
      let doc
      try {
        doc = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))
      } catch {
        bad('原始 match 分片解析失败：' + f)
        continue
      }
      for (const e of doc.entries || []) {
        if (e && e.atomId && !byAtom.has(e.atomId)) byAtom.set(e.atomId, e)
      }
    }
    return byAtom
  }
  let matchByAtom = readMatchEntries(runtimeDir)
  if (matchByAtom.size === 0) {
    // 原件可能已归档在任意历史 tag 下（S7 起多轮归档）：扫描 archive/* 各 tag（先到先得）
    const archRoot = path.join(runtimeDir, 'archive')
    if (fs.existsSync(archRoot)) {
      for (const t of fs.readdirSync(archRoot).sort()) {
        const m = readMatchEntries(path.join(archRoot, t))
        for (const [id, e] of m) if (!matchByAtom.has(id)) matchByAtom.set(id, e)
      }
    }
  }
  if (matchByAtom.size === 0) {
    bad('原始 match-output 分片不存在（现目录与 archive/ 各 tag 均为空）')
  }
  for (const id of selected) {
    if (!matchByAtom.has(id)) bad('选取原子缺原始 match 条目：' + id)
  }

  // ---------- 分片（按阶段，每片 ≤ size） ----------
  const byStage = new Map()
  for (const id of selected) {
    const sid = atomStage.get(id) ? atomStage.get(id).stageId : '?'
    if (!byStage.has(sid)) byStage.set(sid, [])
    byStage.get(sid).push(id)
  }
  const stageOrder = [...byStage.keys()].sort()
  const parts = []
  for (const sid of stageOrder) {
    const list = byStage.get(sid)
    for (let i = 0; i < list.length; i += size) {
      parts.push({ stageId: sid, atoms: list.slice(i, i + size) })
    }
  }
  const partFiles = parts.map((p, idx) => {
    const same = parts.filter((x) => x.stageId === p.stageId)
    const partNo = String(same.indexOf(p) + 1).padStart(2, '0')
    return { stageId: p.stageId, partNo, atoms: p.atoms }
  })
  const dupCheck = new Set()
  for (const p of partFiles) {
    for (const id of p.atoms) {
      if (dupCheck.has(id)) bad('分片原子重复：' + id)
      dupCheck.add(id)
    }
  }
  if (dupCheck.size !== selected.length) {
    bad('分片原子合计 ' + dupCheck.size + ' != 选取 ' + selected.length)
  }
  if (problems.length > 0) return { ok: false, problems: problems, summary: null }

  // ---------- 产物构造 ----------
  const makeVerifyInput = (p, partCount) => {
    const groups = new Map()
    for (const id of p.atoms) {
      const meta = atomStage.get(id)
      if (!groups.has(meta.featureId)) {
        groups.set(meta.featureId, { featureId: meta.featureId, featureName: meta.featureName, featureScope: '', atoms: [] })
      }
      const a = atomById.get(id)
      const sc = scopeByAtom.get(id)
      const dr = drByAtom.get(id)
      const atom = {
        id: a.id,
        name: a.name || '',
        rule: a.rule || '',
        ui_requirement: a.ui_requirement || '',
        verdict: a.verdict || '',
        difference: a.difference || '',
        difference_detail: a.difference_detail || '',
        notes: a.notes || '',
        retryHint: {
          reason: '待补证第' + roundCn + '轮（' + gapDesc + '证据不足）',
          applicability: sc.applicability,
          callPath: trimText(sc.callPath, 200),
          unresolved: trimText(sc.unresolved, 150),
          configCondition: sc.applicability === 'conditional' ? trimText(sc.configCondition, 200) : '',
          reviewReason: trimText(dr.reviewReason, 200),
        },
      }
      groups.get(meta.featureId).atoms.push(atom)
    }
    const existingScopeEntries = p.atoms.map((id) => scopeByAtom.get(id))
    const sveIds = new Set()
    for (const id of p.atoms) {
      for (const eid of scopeByAtom.get(id).evidenceIds || []) sveIds.add(eid)
    }
    const existingSve = [...sveIds].filter((x) => sveById.has(x)).map((x) => sveById.get(x))
    return {
      schemaVersion: 1,
      generatedBy: 'prepare-retry-input.mjs（OSG-W4 ' + stTag + ' 待补证第' + roundCn + '轮）',
      date: date || '',
      baselineIndexPath: featureIndexPath,
      stageId: p.stageId,
      stageName: stageName.get(p.stageId) || '',
      partNo: p.partNo,
      partCount: partCount,
      atomCount: p.atoms.length,
      featureGroups: [...groups.values()],
      existingScopeEntries: existingScopeEntries,
      existingSve: existingSve,
      retry: { reason: '待补证第' + roundCn + '轮（' + stTag + '）', totalAtomCount: selected.length },
    }
  }
  const makeMatchOutput = (p) => ({
    schemaVersion: 1,
    stageId: p.stageId,
    partNo: p.partNo,
    entries: p.atoms.map((id) => matchByAtom.get(id)),
  })

  // ---------- 归档首轮原分片 + 清理陈旧 retry 分片 + 写新分片 ----------
  // 原件判定：verify-input/match-output 里的首轮 -p 分片（retry 代际分片不是原件）
  const dirFiles = (d) => (fs.existsSync(d) ? fs.readdirSync(d) : [])
  const originalsExist =
    dirFiles(path.join(runtimeDir, 'verify-input')).some((f) => isOriginalFile(f)) ||
    dirFiles(path.join(runtimeDir, 'match-output')).some((f) => isOriginalFile(f))
  if (originalsExist) {
    const archiveDir = path.join(runtimeDir, 'archive', tag)
    fs.mkdirSync(archiveDir, { recursive: true })
    for (const d of RETRY_DIRS) {
      const src = path.join(runtimeDir, d)
      if (!fs.existsSync(src)) continue
      const originals = dirFiles(src).filter((f) => isOriginalFile(f))
      if (originals.length === 0) continue
      const dst = path.join(archiveDir, d)
      if (fs.existsSync(dst)) {
        bad('归档目标已存在：' + dst + '（换 archiveTag 或手动清理）')
        continue
      }
      fs.mkdirSync(dst, { recursive: true })
      for (const f of originals) fs.renameSync(path.join(src, f), path.join(dst, f))
    }
    if (problems.length > 0) return { ok: false, problems: problems, summary: null }
  }
  // 陈旧 retry 分片清理（四目录；历史各代 retry 的 agent 输出/输入全部作废——已并入正式四件，
  // 且 stageIds=ALL 增量 merge 会重复消费盘上分片，旧代际分片若与新代际覆盖同原子会以旧盖新）
  for (const d of RETRY_DIRS) {
    const src = path.join(runtimeDir, d)
    for (const f of dirFiles(src)) {
      if (f.endsWith('.json') && !isOriginalFile(f)) fs.rmSync(path.join(src, f), { force: true })
    }
  }
  fs.mkdirSync(path.join(runtimeDir, 'verify-input'), { recursive: true })
  fs.mkdirSync(path.join(runtimeDir, 'match-output'), { recursive: true })
  for (const p of partFiles) {
    const f = p.stageId + '-' + suffix + p.partNo + '.json'
    fs.writeFileSync(
      path.join(runtimeDir, 'verify-input', f),
      JSON.stringify(makeVerifyInput(p, partFiles.length), null, 1) + '\n',
      'utf8'
    )
    fs.writeFileSync(
      path.join(runtimeDir, 'match-output', f),
      JSON.stringify(makeMatchOutput(p), null, 1) + '\n',
      'utf8'
    )
  }

  // ---------- 回读复核 ----------
  const viFiles = fs.readdirSync(path.join(runtimeDir, 'verify-input')).filter((f) => f.endsWith('.json'))
  const moFiles = fs.readdirSync(path.join(runtimeDir, 'match-output')).filter((f) => f.endsWith('.json'))
  if (viFiles.length !== partFiles.length || moFiles.length !== partFiles.length) {
    bad('回读分片数不符：verify-input ' + viFiles.length + ' / match-output ' + moFiles.length + '，期望 ' + partFiles.length)
  }
  let readbackAtoms = 0
  for (const f of viFiles) {
    const doc = readJson(path.join(runtimeDir, 'verify-input', f))
    let n = 0
    for (const g of doc.featureGroups || []) n += (g.atoms || []).length
    if (n !== doc.atomCount) bad('回读分片原子数不自洽：' + f + ' 原子 ' + n + ' != atomCount ' + doc.atomCount)
    readbackAtoms += n
  }
  if (readbackAtoms !== selected.length) {
    bad('回读原子合计 ' + readbackAtoms + ' != 选取 ' + selected.length)
  }
  if (problems.length > 0) return { ok: false, problems: problems, summary: null }

  const manifest = {
    stages: stageOrder
      .filter((sid) => partFiles.some((p) => p.stageId === sid))
      .map((sid) => ({
        stageId: sid,
        partFiles: partFiles.filter((p) => p.stageId === sid).map((p) => p.stageId + '-' + suffix + p.partNo + '.json'),
      })),
    atomCount: selected.length,
    partCount: partFiles.length,
    archiveTag: tag,
  }
  return { ok: true, problems: [], summary: manifest }
}

// CLI 直调守卫（被 import 时不执行）
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  const [featureIndexPath, outDir, date, partSize, archiveTag, round] = process.argv.slice(2)
  if (!featureIndexPath || !outDir) {
    console.error('用法：node prepare-retry-input.mjs <featureIndexPath> <outDir> <date> [partSize] [archiveTag] [round]')
    console.error('示例：node .opencode-workflows/scripts/prepare-retry-input.mjs spec-workflow/output-spec/2026-11-14/1-spec/feature_index.json spec-workflow/output-spec/server-rule-verify 2026-11-14 12 pre-s9-retry 3')
    process.exit(1)
  }
  try {
    const r = prepareRetryInput({ featureIndexPath, outDir, date, partSize, archiveTag, round })
    if (!r.ok) {
      for (const p of r.problems) console.error('[失败] ' + p)
      console.error('[失败] 待补证重跑输入未构造（闸门 ' + r.problems.length + ' 项问题）')
      process.exit(1)
    }
    console.log('[成功] 待补证重跑输入：' + r.summary.atomCount + ' 原子 / ' + r.summary.partCount + ' 分片（archive ' + r.summary.archiveTag + '）')
    console.log('MANIFEST ' + JSON.stringify(r.summary))
  } catch (e) {
    console.error('[失败] ' + e.message)
    process.exit(1)
  }
}
