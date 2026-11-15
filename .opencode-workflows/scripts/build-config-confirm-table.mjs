// build-config-confirm-table.mjs —— 配置确认表生成器（OSG-W4 余量跟踪 S6，2026-11-14）
//
// 从 scope-index conditional 条目 + v2 基线（原子/阶段名）+ difference-review 确定性生成《配置确认表》：
//   - 策划签认「好友房创房默认口径」的交付件：全部 conditional 作用域原子（l7=verification_required
//     的配置确认类，规则成立与否取决于玩法配置取值）
//   - 每条：配置项 / 创房默认 / 取值行为摘要（configCondition 截断）/ 差异现状 / 确认栏
//   - 计数闸门：表行数 = conditional 条目数；分阶段合计一致；configVerified 全 true、unresolved 全空
//     （核对闭环前置——客户端创房默认值均已证据核验，余下仅口径签认）；回读产物行数复核
//   - 生成失败（任一闸门不过）删除产物文件
//
// 输出：<verifyDir>/配置确认表.md
//
// 可导入：export buildConfigConfirmTable({ baselineIndexPath, verifyDir, date })
// CLI：node build-config-confirm-table.mjs <baselineIndexPath> <verifyDir> <date>
// 退出码：0 成功 / 1 失败（输入缺失 / 结构异常 / 闸门不过）

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

// 配置项 key：configCondition 开头的 snake_case（如 first_banker_type：/ base_score=1（）
function configKeyOf(text) {
  const m = String(text || '').match(/^[a-z][a-z0-9_]{2,}/)
  return m ? m[0] : '-'
}

// 创房默认值：默认/下发/恒下发 后的首个数字或布尔
function defaultOf(text) {
  const m = String(text || '').match(/(?:默认|下发|恒下发)\s*[=]?\s*(\d+|true|false)/)
  return m ? m[1] : '-'
}

export function buildConfigConfirmTable({ baselineIndexPath, verifyDir, date }) {
  const problems = []
  if (!baselineIndexPath || !verifyDir) {
    return { ok: false, problems: ['入参缺失：baselineIndexPath / verifyDir'], summary: null }
  }
  const baseline = readJson(baselineIndexPath)
  const scopeIdx = readJson(path.join(verifyDir, 'scope-index.json'))
  const drAll = readJson(path.join(verifyDir, 'difference-review.json'))

  // ---------- 索引装配 ----------
  const stageName = new Map()
  for (const s of baseline.stages || []) stageName.set(s.id, s.name)
  const atomName = new Map()
  const atomStage = new Map()
  const stageOrder = []
  for (const f of baseline.features || []) {
    if (!stageOrder.includes(f.stage_id)) stageOrder.push(f.stage_id)
    for (const a of f.atoms || []) {
      atomName.set(a.id, a.name || '')
      atomStage.set(a.id, f.stage_id)
    }
  }
  const drByAtom = new Map()
  for (const e of drAll.entries || []) drByAtom.set(e.atomId, e)

  // ---------- 条目选取与闸门 ----------
  const cond = (scopeIdx.entries || []).filter((e) => e && e.applicability === 'conditional')
  if (cond.length === 0) problems.push('scope-index 无 conditional 条目（无配置确认对象）')
  for (const e of cond) {
    if (!atomName.has(e.atomId)) problems.push('conditional 原子不在基线：' + e.atomId)
    const d = drByAtom.get(e.atomId)
    if (!d) problems.push('conditional 原子缺 difference-review 条目：' + e.atomId)
    if (!e.configCondition || !String(e.configCondition).trim()) {
      problems.push('conditional 条目 configCondition 为空：' + e.atomId)
    }
    if (e.configVerified !== true) {
      problems.push('conditional 条目 configVerified 非 true（客户端默认未核验，签认前置不满足）：' + e.atomId)
    }
    if (e.unresolved && String(e.unresolved).trim()) {
      problems.push('conditional 条目 unresolved 未清零：' + e.atomId)
    }
  }
  // 差异现状分布（签认口径说明用）
  const effDist = {}
  const rsDist = {}
  for (const e of cond) {
    const d = drByAtom.get(e.atomId)
    if (!d) continue
    effDist[d.effectiveDifference] = (effDist[d.effectiveDifference] || 0) + 1
    rsDist[d.reviewStatus] = (rsDist[d.reviewStatus] || 0) + 1
  }
  // 口径签认状态（S6 签认落地后 configConfirm=default/adjust）
  const confirmedDefault = cond.filter((e) => e.configConfirm === 'default').length
  const confirmedAdjust = cond.filter((e) => e.configConfirm === 'adjust').length
  const unconfirmed = cond.length - confirmedDefault - confirmedAdjust
  const allDefaultDate = confirmedDefault === cond.length && cond.length > 0
    ? cond[0].configConfirmDate || ''
    : ''

  // ---------- 生成 ----------
  const lines = []
  lines.push('# 配置确认表（杭州麻将 42320 好友房）')
  lines.push('')
  lines.push('- **日期**：' + (date || ''))
  lines.push(
    '- **用途**：conditional 作用域原子（' + cond.length + ' 条）的创房默认口径签认表——这些规则的成立与否取决于玩法配置取值；' +
      '策划确认「好友房按创房默认值运行」即按该口径闭环，需调整默认值或修订需求请在确认栏备注。'
  )
  lines.push(
    '- **数据来源**：scope-index.json conditional 条目（configVerified 全 true、unresolved 全零——客户端创房默认值已证据核验）+ ' +
      'difference-review.json（差异现状）+ v2 基线（原子/阶段名，只读）；分类口径见《规则待验证报告》「配置确认」。'
  )
  lines.push(
    '- **差异现状分布**：consistent ' + (effDist.consistent || 0) +
      '（默认口径下已验证一致）/ unverified ' + (effDist.unverified || 0) +
      ' / partial ' + (effDist.partial || 0) +
      '（后两者默认口径行为见摘要，服务端证据缺口另见《规则待验证报告》）；' +
      '复核状态 approved ' + (rsDist.approved || 0) + ' / pending ' + (rsDist.pending || 0) + '（维持型）。'
  )
  lines.push(
    '- **签认口径**：「确认默认口径」= 好友房按创房默认值运行，本表取值行为摘要即最终口径；' +
      '「需调整」= 改创房默认下发值或修订需求文本（转需求/实现变更流程）。'
  )
  lines.push(
    '- **签认状态**：' +
      (unconfirmed === 0
        ? '全部确认默认口径（' + confirmedDefault + ' 条' + (allDefaultDate ? '，' + allDefaultDate : '') +
          (confirmedAdjust ? '；另调整 ' + confirmedAdjust + ' 条' : '') +
          '）——好友房按创房默认值运行；consistent ' + (effDist.consistent || 0) +
          ' 条即闭环，unverified ' + (effDist.unverified || 0) + ' / partial ' + (effDist.partial || 0) + ' 条转服务端补证跟踪。'
        : '待签认——' + unconfirmed + ' 条未确认 / ' + confirmedDefault + ' 条已确认默认口径 / ' + confirmedAdjust + ' 条已调整。')
  )
  lines.push('')

  const byStage = new Map()
  for (const e of cond) {
    const sid = atomStage.get(e.atomId) || '?'
    if (!byStage.has(sid)) byStage.set(sid, [])
    byStage.get(sid).push(e)
  }
  const orderedStages = [...byStage.keys()].sort((a, b) => stageOrder.indexOf(a) - stageOrder.indexOf(b))
  let rowCount = 0
  const confirmCell = (e) => {
    if (e.configConfirm === 'default') return '已确认默认口径（' + (e.configConfirmDate || '') + '）'
    if (e.configConfirm === 'adjust') return '已调整（' + trimText(e.configConfirmNote, 20) + '）'
    return '☐ 确认默认口径 ☐ 需调整：____'
  }
  for (const sid of orderedStages) {
    const list = byStage.get(sid)
    lines.push('## ' + sid + ' ' + (stageName.get(sid) || '') + '（' + list.length + ' 条）')
    lines.push('')
    lines.push('| 原子 | 名称 | 配置项 | 创房默认 | 取值行为摘要 | 差异现状 | 确认 |')
    lines.push('|---|---|---|---|---|---|---|')
    for (const e of list) {
      const d = drByAtom.get(e.atomId)
      lines.push(
        '| ' + e.atomId + ' | ' + trimText(atomName.get(e.atomId), 20) +
          ' | ' + configKeyOf(e.configCondition) +
          ' | ' + defaultOf(e.configCondition) +
          ' | ' + trimText(e.configCondition, 90) +
          ' | ' + (d ? d.effectiveDifference + (d.reviewStatus === 'approved' ? '（approved）' : '') : '-') +
          ' | ' + confirmCell(e) + ' |'
      )
      rowCount++
    }
    lines.push('')
  }
  lines.push('---')
  lines.push('')
  lines.push('## 整体签认')
  lines.push('')
  if (unconfirmed === 0) {
    lines.push('- ☑ 全部确认默认口径（' + confirmedDefault + ' 条' +
      (allDefaultDate ? '，' + allDefaultDate : '') +
      (confirmedAdjust ? '；另调整 ' + confirmedAdjust + ' 条' : '') +
      '——好友房按创房默认值运行）')
  } else {
    lines.push('- ☐ 全部确认默认口径（' + cond.length + ' 条，好友房按创房默认值运行）')
    lines.push('- ☐ 逐条调整（备注原子 id 与期望默认值/口径）：__________')
  }
  lines.push('')
  lines.push(
    '签认后由开发侧落 scope-index 口径确认记录并同步《规则待验证报告》；' +
      'consistent ' + (effDist.consistent || 0) + ' 条即闭环，unverified ' + (effDist.unverified || 0) +
      ' / partial ' + (effDist.partial || 0) + ' 条转服务端补证跟踪。'
  )
  lines.push('')

  const outPath = path.join(verifyDir, '配置确认表.md')
  if (problems.length > 0) {
    return { ok: false, problems: problems, summary: null }
  }
  fs.mkdirSync(verifyDir, { recursive: true })
  fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8')

  // ---------- 回读复核 ----------
  const written = fs.readFileSync(outPath, 'utf8')
  const writtenRows = (written.match(/^\| AT-ST-C\d+-\d+ \|/gm) || []).length
  if (writtenRows !== rowCount || rowCount !== cond.length) {
    problems.push('回读行数不符：表行=' + writtenRows + ' 生成行=' + rowCount + ' conditional=' + cond.length)
    fs.rmSync(outPath, { force: true })
    return { ok: false, problems: problems, summary: null }
  }

  const summary = {
    outPath: outPath,
    total: cond.length,
    stages: orderedStages.length,
    effectiveDifference: effDist,
    reviewStatus: rsDist,
    configConfirm: { default: confirmedDefault, adjust: confirmedAdjust, unconfirmed: unconfirmed },
  }
  return { ok: true, problems: [], summary: summary }
}

// CLI 直调守卫（被 import 时不执行）
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  const [baselineIndexPath, verifyDir, date] = process.argv.slice(2)
  if (!baselineIndexPath || !verifyDir) {
    console.error('用法：node build-config-confirm-table.mjs <baselineIndexPath> <verifyDir> <date>')
    console.error('示例：node .opencode-workflows/scripts/build-config-confirm-table.mjs spec-workflow/output-spec/2026-11-14/1-spec spec-workflow/output-spec/server-rule-verify 2026-11-14')
    process.exit(1)
  }
  try {
    const r = buildConfigConfirmTable({ baselineIndexPath, verifyDir, date })
    if (!r.ok) {
      for (const p of r.problems) console.error('[失败] ' + p)
      console.error('[失败] 配置确认表未生成（闸门 ' + r.problems.length + ' 项问题）')
      process.exit(1)
    }
    console.log('[成功] 配置确认表：' + r.summary.total + ' 条（' + r.summary.stages + ' 阶段）-> ' + r.summary.outPath)
    console.log('SUMMARY ' + JSON.stringify(r.summary))
  } catch (e) {
    console.error('[失败] ' + e.message)
    process.exit(1)
  }
}
