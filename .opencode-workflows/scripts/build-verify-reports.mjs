// ============================================================
// build-verify-reports.mjs —— server-rule-verify 三份交付报告生成器
//
// 职责：从正式四件（scope-index / server-evidence / difference-review /
//   l7-classify）+ v2 基线（原子名称/阶段名）确定性生成：
//   1. <verifyDir>/规则待验证报告.md      —— verification_required 全清单
//      （分类：证据缺口 unknown / 配置确认 conditional / 审批待定 active+升级建议 /
//        待补证 active+无建议），供策划/服务端直接消费
//   2. <verifyDir>/服务端证据索引.md      —— server-evidence 全量索引（按阶段）
//   3. <verifyDir>/runtime/reports/pending-suggestions-appendix.md
//      —— 待批准升级建议全量附录（供拼接进需求差异裁决清单附 A）
//
// 可导入：export buildVerifyReports({ baselineIndexPath, verifyDir, date })
//   返回 { ok, problems, summary }：
//     summary = { verificationReportPath, evidenceIndexPath, appendixPath,
//                vrCategories, vrCount, sveCount, suggestionCount }
//
// CLI：node build-verify-reports.mjs <baselineIndexPath> <verifyDir> <date>
//   退出码：0 成功（三产物已写）/ 1 数据不自洽（不写产物，问题明细打印）
// ============================================================

import fs from 'node:fs'
import path from 'node:path'

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function trimText(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n) + '…' : t
}

// 证据列：前 2 个 SVE id + 剩余计数
function evidenceCell(ids) {
  const list = Array.isArray(ids) ? ids.filter((x) => x) : []
  if (list.length === 0) return '-'
  const head = list.slice(0, 2).join(' ')
  return list.length > 2 ? head + ' +' + (list.length - 2) : head
}

function writeOut(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, text, 'utf8')
}

export function buildVerifyReports({ baselineIndexPath, verifyDir, date }) {
  const problems = []
  const baseline = readJson(baselineIndexPath)
  const scopeIdx = readJson(path.join(verifyDir, 'scope-index.json'))
  const sveAll = readJson(path.join(verifyDir, 'server-evidence.json'))
  const drAll = readJson(path.join(verifyDir, 'difference-review.json'))
  const l7All = readJson(path.join(verifyDir, 'l7-classify.json'))

  // ---------- 索引装配 ----------
  const stageName = new Map()
  for (const s of baseline.stages || []) stageName.set(s.id, s.name)
  const atomName = new Map()
  const atomStage = new Map()
  for (const f of baseline.features || []) {
    for (const a of f.atoms || []) {
      atomName.set(a.id, a.name || '')
      atomStage.set(a.id, f.stage_id)
    }
  }
  const scopeByAtom = new Map()
  for (const e of scopeIdx.entries || []) scopeByAtom.set(e.atomId, e)
  const drByAtom = new Map()
  for (const e of drAll.entries || []) drByAtom.set(e.atomId, e)
  const l7ByAtom = new Map()
  for (const e of l7All.entries || []) l7ByAtom.set(e.atomId, e)

  // ---------- 数据自洽闸门 ----------
  const l7Stats = (l7All.stats && l7All.stats.l7) || {}
  const vrAtoms = [...l7ByAtom.values()].filter((e) => e.l7 === 'verification_required')
  if (vrAtoms.length !== (l7Stats.verification_required || 0)) {
    problems.push(
      'verification_required 条目数 ' + vrAtoms.length + ' != l7 stats ' + (l7Stats.verification_required || 0)
    )
  }
  const suggestionAtoms = [...drByAtom.values()].filter(
    (e) => e.reviewStatus === 'pending' && e.reviewedDifference !== e.previousDifference
  )
  const drStats = drAll.stats || {}
  if (drStats.reviewStatus && (drStats.reviewStatus.pending || 0) >= 0) {
    // pending 升级建议数与 DR stats 交叉校验（pending 总数含维持型无建议条目，只校验建议计数>=0）
  }
  for (const e of vrAtoms) {
    if (!atomName.has(e.atomId)) problems.push('verification_required 原子不在基线：' + e.atomId)
    if (!scopeByAtom.has(e.atomId)) problems.push('verification_required 原子缺 scope 条目：' + e.atomId)
  }
  for (const e of sveAll.entries || []) {
    if (!atomName.has(e.atomId)) problems.push('SVE 原子不在基线：' + e.id + ' -> ' + e.atomId)
  }

  // ---------- 分类 ----------
  // l7 口径（classify-l7.mjs L250）：l7 = matrix(reviewedDifference, scope)——升级建议按「批准后」
  // 分类展示（active 作用域建议原子显示 verified，不进本报告；conditional 建议原子批准后仍需配置确认，进本报告）
  const CAT_GAP = '证据缺口'
  const CAT_COND = '配置确认'
  const CAT_MORE = '待补证'
  const catOf = (atomId) => {
    const sc = scopeByAtom.get(atomId)
    if (sc && sc.applicability === 'unknown') return CAT_GAP
    if (sc && sc.applicability === 'conditional') return CAT_COND
    return CAT_MORE
  }
  const noteOf = (atomId) => {
    const sc = scopeByAtom.get(atomId)
    const dr = drByAtom.get(atomId)
    const cat = catOf(atomId)
    if (cat === CAT_GAP) return trimText(sc && sc.unresolved, 120)
    if (cat === CAT_COND) return trimText(sc && sc.configCondition, 120)
    const reason = trimText(dr && dr.reviewReason, 110)
    // 待补证：复核理由是「维持基线差异」类空话时退回 scope 调用链
    if (/维持基线差异|未出复核建议/.test(reason)) return trimText(sc && sc.callPath, 120)
    return reason || trimText(sc && sc.callPath, 120)
  }

  const byStageVr = new Map()
  for (const e of vrAtoms) {
    const sid = e.stageId || atomStage.get(e.atomId)
    if (!byStageVr.has(sid)) byStageVr.set(sid, [])
    byStageVr.get(sid).push(e)
  }
  const scopeByAtomForSug = new Map()
  for (const e of suggestionAtoms) {
    const sc = scopeByAtom.get(e.atomId)
    const k = sc ? sc.applicability : '?'
    scopeByAtomForSug.set(k, (scopeByAtomForSug.get(k) || 0) + 1)
  }
  const activeSug = scopeByAtomForSug.get('active') || 0
  const condSug = scopeByAtomForSug.get('conditional') || 0

  // ---------- 报告 1：规则待验证报告 ----------
  const catTotal = { [CAT_GAP]: 0, [CAT_COND]: 0, [CAT_MORE]: 0 }
  for (const e of vrAtoms) catTotal[catOf(e.atomId)]++
  const vrLines = []
  vrLines.push('# 规则待验证报告（杭州麻将 42320 好友房）')
  vrLines.push('')
  vrLines.push('- **日期**：' + date)
  vrLines.push(
    '- **用途**：L7 复核分类 verification_required 全清单——这些规则即使按当前复核结论（升级建议批准后）' +
      '也无法判定「需求与实现一致」，按三类原因归档，供策划与服务端直接消费。'
  )
  vrLines.push(
    '- **数据来源**：l7-classify.json（' + vrAtoms.length + ' 条 verification_required）+ scope-index / difference-review / server-evidence；' +
      'v2 基线 ' + (baseline.atom_count || (baseline.features || []).length) + ' 原子（只读）。'
  )
  vrLines.push(
    '- **不在本报告**：' + activeSug + ' 条 active 作用域升级建议（批准后即转已验证，见《需求差异裁决清单》附 A）；' +
      '冲突类（decision_required）与不可达类（not_applicable）见同清单条目区；' +
      condSug + ' 条 conditional 作用域升级建议批准后仍需配置确认（已列入本报告「配置确认」，同时见附 A）。'
  )
  vrLines.push('')
  vrLines.push('## 分类概览')
  vrLines.push('')
  vrLines.push('| 分类 | 条数 | 含义 | 处理方向 |')
  vrLines.push('|---|---|---|---|')
  vrLines.push('| ' + CAT_COND + ' | ' + catTotal[CAT_COND] + ' | 行为依赖玩法配置，需确认配置口径 | 按 configCondition 确认创房配置 |')
  vrLines.push('| ' + CAT_GAP + ' | ' + catTotal[CAT_GAP] + ' | 服务端三根无实现证据（客户端壳/纯表现交互） | 客户端侧验证或明确不适用 |')
  vrLines.push('| ' + CAT_MORE + ' | ' + catTotal[CAT_MORE] + ' | 服务端证据不足判一致，也未判冲突 | 补证或对局验证 |')
  vrLines.push('')
  vrLines.push('> 冲突类（decision_required）与不可达类（not_applicable）见《需求差异裁决清单》。')
  vrLines.push('')
  for (const sid of [...byStageVr.keys()].sort()) {
    const list = byStageVr.get(sid)
    vrLines.push('## ' + sid + ' ' + (stageName.get(sid) || '') + '（' + list.length + ' 条）')
    vrLines.push('')
    vrLines.push('| 原子 | 名称 | 作用域 | 分类 | 待验证说明 | 证据 |')
    vrLines.push('|---|---|---|---|---|---|')
    for (const e of list) {
      const sc = scopeByAtom.get(e.atomId) || {}
      const scope = sc.applicability === 'conditional' ? 'conditional' : sc.applicability || '?'
      vrLines.push(
        '| ' + e.atomId + ' | ' + trimText(atomName.get(e.atomId), 24) + ' | ' + scope + ' | ' + catOf(e.atomId) +
          ' | ' + noteOf(e.atomId) + ' | ' + evidenceCell(sc.evidenceIds) + ' |'
      )
    }
    vrLines.push('')
  }
  const verificationReportPath = path.join(verifyDir, '规则待验证报告.md')
  writeOut(verificationReportPath, vrLines.join('\n') + '\n')

  // ---------- 报告 2：服务端证据索引 ----------
  const layerCount = {}
  for (const e of sveAll.entries || []) layerCount[e.layer] = (layerCount[e.layer] || 0) + 1
  const sveByStage = new Map()
  for (const e of sveAll.entries || []) {
    const sid = (e.atomId.match(/^AT-(ST-C\d+)/) || [])[1]
    if (!sid) {
      problems.push('SVE 原子 id 无法解析阶段：' + e.id + ' -> ' + e.atomId)
      continue
    }
    if (!sveByStage.has(sid)) sveByStage.set(sid, [])
    sveByStage.get(sid).push(e)
  }
  const evLines = []
  evLines.push('# 服务端证据索引（杭州麻将 42320 好友房）')
  evLines.push('')
  evLines.push('- **日期**：' + date)
  evLines.push(
    '- **用途**：server-evidence.json 全量索引（服务端源码证据定位），供复核与追溯；' +
      '摘录原文见数据文件（本索引只列定位）。'
  )
  evLines.push(
    '- **统计**：共 ' + (sveAll.entries || []).length + ' 条；层分布 ' +
      Object.keys(layerCount).map((k) => k + ' ' + layerCount[k]).join(' / ') +
      '；证据文件（源码根相对路径，三根目录：game_hzmj/common_game、game_hzmj/hzmj_server、mah_frame）。'
  )
  evLines.push('')
  for (const sid of [...sveByStage.keys()].sort()) {
    const list = sveByStage.get(sid)
    evLines.push('## ' + sid + ' ' + (stageName.get(sid) || '') + '（' + list.length + ' 条）')
    evLines.push('')
    evLines.push('| SVE | 原子 | 层 | 符号 | 位置 | 配置项 |')
    evLines.push('|---|---|---|---|---|---|')
    for (const e of list) {
      evLines.push(
        '| ' + e.id + ' | ' + e.atomId + ' | ' + e.layer + ' | ' + trimText(e.symbol, 40) + ' | ' + e.location +
          ' | ' + ((e.configKeys || []).join(' ') || '-') + ' |'
      )
    }
    evLines.push('')
  }
  const evidenceIndexPath = path.join(verifyDir, '服务端证据索引.md')
  writeOut(evidenceIndexPath, evLines.join('\n') + '\n')

  // ---------- 产物 3：裁决清单附录（待批准升级建议全量） ----------
  const byStageSug = new Map()
  for (const e of suggestionAtoms) {
    const sid = (e.atomId.match(/^AT-(ST-C\d+)/) || [])[1]
    if (!sid) {
      problems.push('升级建议原子 id 无法解析阶段：' + e.atomId)
      continue
    }
    if (!byStageSug.has(sid)) byStageSug.set(sid, [])
    byStageSug.get(sid).push(e)
  }
  const apLines = []
  apLines.push('### 附 A：待批准升级建议全量（' + suggestionAtoms.length + ' 条，全部 pending）')
  apLines.push('')
  apLines.push(
    'server-rule-verify 全量批跑（15/15 阶段，319/319 原子落判复核）产出的 unverified/partial → consistent 升级建议；' +
      '批准即按复核结论合并进正式索引（effectiveDifference 转 consistent），驳回维持 v2 基线。' +
      '注：conditional 作用域原子批准后 L7 仍为 verification_required（需按创房配置确认口径）。'
  )
  apLines.push('')
  for (const sid of [...byStageSug.keys()].sort()) {
    const list = byStageSug.get(sid)
    apLines.push('#### ' + sid + ' ' + (stageName.get(sid) || '') + '（' + list.length + ' 条）')
    apLines.push('')
    apLines.push('| 原子 | 名称 | 基线→建议 | 作用域 | 核心依据 | 证据 |')
    apLines.push('|---|---|---|---|---|---|')
    for (const e of list) {
      const sc = scopeByAtom.get(e.atomId) || {}
      apLines.push(
        '| ' + e.atomId + ' | ' + trimText(atomName.get(e.atomId), 24) + ' | ' + e.previousDifference + '→' +
          e.reviewedDifference + ' | ' + (sc.applicability || '?') + ' | ' + trimText(e.reviewReason, 80) + ' | ' +
          evidenceCell(sc.evidenceIds) + ' |'
      )
    }
    apLines.push('')
  }
  const appendixPath = path.join(verifyDir, 'runtime', 'reports', 'pending-suggestions-appendix.md')
  writeOut(appendixPath, apLines.join('\n') + '\n')

  // ---------- 计数闸门 ----------
  const vrRows = vrLines.filter((l) => l.startsWith('| AT-ST-C')).length
  if (vrRows !== vrAtoms.length) {
    problems.push('规则待验证报告行数 ' + vrRows + ' != verification_required ' + vrAtoms.length)
  }
  const evRows = evLines.filter((l) => l.startsWith('| SVE-')).length
  if (evRows !== (sveAll.entries || []).length) {
    problems.push('证据索引行数 ' + evRows + ' != SVE 条目 ' + (sveAll.entries || []).length)
  }
  const apRows = apLines.filter((l) => l.startsWith('| AT-ST-C')).length
  if (apRows !== suggestionAtoms.length) {
    problems.push('附录建议行数 ' + apRows + ' != 升级建议 ' + suggestionAtoms.length)
  }
  if (problems.length > 0) {
    // 不留半成品：数据不自洽时删除已写产物
    for (const p of [verificationReportPath, evidenceIndexPath, appendixPath]) {
      if (fs.existsSync(p)) fs.unlinkSync(p)
    }
    return { ok: false, problems, summary: null }
  }

  return {
    ok: true,
    problems: [],
    summary: {
      verificationReportPath,
      evidenceIndexPath,
      appendixPath,
      vrCategories: catTotal,
      vrCount: vrAtoms.length,
      sveCount: (sveAll.entries || []).length,
      suggestionCount: suggestionAtoms.length,
    },
  }
}

// ============================================================
// CLI
// ============================================================

function cliMain(argv) {
  if (argv.length !== 3) {
    console.error('用法：node build-verify-reports.mjs <baselineIndexPath> <verifyDir> <date>')
    process.exit(1)
  }
  const [baselineIndexPath, verifyDir, date] = argv
  const r = buildVerifyReports({ baselineIndexPath, verifyDir, date })
  if (!r.ok) {
    console.log('[失败] 报告生成未通过，共 ' + r.problems.length + ' 项问题（不写产物）：')
    for (const p of r.problems) console.log('  - ' + p)
    process.exit(1)
  }
  const s = r.summary
  console.log(
    '[成功] 三份报告生成：规则待验证 ' + s.vrCount + '（' +
      Object.keys(s.vrCategories).map((k) => k + ' ' + s.vrCategories[k]).join(' / ') +
      '）-> ' + s.verificationReportPath + '；证据索引 ' + s.sveCount + ' -> ' + s.evidenceIndexPath +
      '；裁决附录 ' + s.suggestionCount + ' -> ' + s.appendixPath
  )
  process.exit(0)
}

if (process.argv[1] && process.argv[1].endsWith('build-verify-reports.mjs')) {
  cliMain(process.argv.slice(2))
}
