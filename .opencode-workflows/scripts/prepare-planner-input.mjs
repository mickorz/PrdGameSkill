// ============================================================
// prepare-planner-input.mjs —— S10 策划版输入确定性投影（技术字段结构性隔离）
//
// 执行文档 §5 S10「② 策划业务视图」：策划版只消费 business-behavior + l7，技术字段结构性隔离。
//
// 职责：把 unified-atoms / business-behavior / l7-classify 投影成**纯业务视图**
//   { stageId, atomId, rule, uiRequirement, businessBehavior, difference, baselineDetail,
//     l7Label(业务语言), conclusionBasis }
// 剥掉：verdict / applicability / analysisPath / evidenceIds / reviewer 字段 / 文件名 / 行号 / claimKey。
//
// 产物：<runDir>/5-specs/runtime/planner-input/business-view.json
//
// CLI：node prepare-planner-input.mjs --run-dir <dir> --date <YYYY-MM-DD>
//   退出码：0 成功 / 1 失败
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

// L7 枚举 → 纯业务语言（策划版不得出现枚举名）
const L7_LABEL = {
  verified: '已验证',
  verification_required: '规则待验证',
  decision_required: '待策划裁决',
  not_applicable: '不适用',
}
const BLOCKED_LABEL = '查证未完成'

export function preparePlannerInput({ runDir, date }) {
  const problems = []
  const rd = (rel, label, optional) => {
    const r = readJsonSafe(path.join(runDir, rel))
    if (!r.ok && !optional) problems.push(label + ' 不可读：' + rel + ' -> ' + r.error)
    return r.ok ? r.data : null
  }
  const registry = rd('1-registry/requirement-registry.json', 'Registry')
  const ua = rd('4-analysis/unified-atoms.json', 'unified-atoms')
  const bb = rd('4-analysis/business-behavior.json', 'business-behavior')
  const l7 = rd('4-analysis/l7-classify.json', 'l7-classify')
  const drRead = readJsonSafe(path.join(runDir, '4-analysis/difference-review.json'))
  const dr = drRead.ok ? drRead.data : { entries: [] }
  if (problems.length > 0) return { ok: false, problems, outputs: null }

  const uaByAtom = new Map((ua.atoms || []).map((a) => [a.atomId, a]))
  const bbByAtom = new Map((bb.entries || []).map((e) => [e.atomId, e]))
  const l7ByAtom = new Map((l7.entries || []).map((e) => [e.atomId, e]))
  const blocked = new Set(l7.blockedAtoms || [])
  const drByAtom = new Map((dr.entries || []).map((e) => [e.atomId, e]))

  const stages = []
  let ruleCount = 0
  const pendingCount = { verification_required: 0, decision_required: 0, blocked: 0, review_pending: 0 }

  for (const st of registry.stages || []) {
    const stageId = st.stageId
    const rules = []
    for (const f of registry.features || []) {
      if (f.stageId !== stageId) continue
      for (const a of f.atoms || []) {
        const atom = uaByAtom.get(a.atomId)
        const bbEntry = bbByAtom.get(a.atomId)
        const l7Entry = l7ByAtom.get(a.atomId)
        const isBlocked = blocked.has(a.atomId)

        let label
        let basis
        if (isBlocked) {
          label = BLOCKED_LABEL
          basis = '必要端查证未完成，差异未判定'
          pendingCount.blocked++
        } else if (l7Entry) {
          label = L7_LABEL[l7Entry.l7] || '规则待验证'
          basis =
            l7Entry.l7Basis === 'approved'
              ? '已人工确认'
              : l7Entry.l7Basis === 'rejected'
                ? '复核建议被否决，维持原判断'
                : '尚未人工确认'
          if (l7Entry.l7 === 'verification_required') pendingCount.verification_required++
          if (l7Entry.l7 === 'decision_required') pendingCount.decision_required++
        } else {
          label = '规则待验证'
          basis = '未完成分类'
          pendingCount.verification_required++
        }

        const drEntry = drByAtom.get(a.atomId)
        if (drEntry && drEntry.reviewStatus === 'pending') pendingCount.review_pending++

        // 业务行为四元组：优先取 S7 输出，缺失取 Registry 需求侧声明
        const bb4 = bbEntry
          ? {
              trigger: bbEntry.trigger || '',
              condition: bbEntry.condition || '',
              clientAction: bbEntry.clientAction || '',
              serverAction: bbEntry.serverAction || '',
              collaboration: bbEntry.collaboration || '',
              result: bbEntry.result || '',
            }
          : {
              trigger: (a.businessBehavior && a.businessBehavior.trigger) || '',
              condition: (a.businessBehavior && a.businessBehavior.condition) || '',
              clientAction: '',
              serverAction: '',
              collaboration: '',
              result: (a.businessBehavior && a.businessBehavior.result) || '',
            }

        rules.push({
          atomId: a.atomId,
          name: a.name || '',
          rule: a.rule || '',
          uiRequirement: a.uiRequirement || '',
          businessBehavior: bb4,
          difference:
            isBlocked
              ? '未判定'
              : bbEntry
                ? bbEntry.baselineDifference
                : (l7Entry && l7Entry.effectiveDifference) || 'unverified',
          differenceNote: bbEntry && bbEntry.baselineDetail ? bbEntry.baselineDetail : '',
          conclusion: label,
          conclusionBasis: basis,
          // 待审批建议以业务语言提示（不回传 reviewRule 等枚举名）
          hasPendingReview: !!(drEntry && drEntry.reviewStatus === 'pending'),
        })
        ruleCount++
      }
    }
    stages.push({ stageId, name: st.name || stageId, rules })
  }

  const outputs = {
    schemaVersion: 1,
    date: date,
    analysisRunId: ua.analysisRunId,
    note: '本文件为策划版唯一输入（已剥离技术字段）。禁止在其中恢复 verdict/applicability/evidence/path 等技术信息。',
    stages,
    stats: {
      stageCount: stages.length,
      ruleCount,
      pendingVerification: pendingCount.verification_required,
      pendingDecision: pendingCount.decision_required,
      blocked: pendingCount.blocked,
      pendingReview: pendingCount.review_pending,
    },
  }
  return { ok: true, problems: [], outputs }
}

function main() {
  const argv = process.argv.slice(2)
  const a = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--run-dir') a.runDir = argv[++i]
    else if (argv[i] === '--date') a.date = argv[++i]
  }
  if (!a.runDir || !a.date) {
    console.error('用法：node prepare-planner-input.mjs --run-dir <dir> --date <YYYY-MM-DD>')
    process.exit(1)
  }
  const r = preparePlannerInput({ runDir: a.runDir, date: a.date })
  if (!r.ok) {
    console.log('[失败] 策划版输入投影失败，共 ' + r.problems.length + ' 项：')
    for (const p of r.problems) console.log('  - ' + p)
    process.exit(1)
  }
  const outPath = path.join(a.runDir, '5-specs', 'runtime', 'planner-input', 'business-view.json')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(r.outputs, null, 1) + '\n', 'utf8')
  const s = r.outputs.stats
  console.log(
    '[成功] 策划版输入投影：阶段 ' + s.stageCount + ' / 规则 ' + s.ruleCount +
      '（待验证 ' + s.pendingVerification + ' / 待裁决 ' + s.pendingDecision +
      ' / 查证未完成 ' + s.blocked + ' / 待审批 ' + s.pendingReview + '）-> ' + toPosix(outPath)
  )
  process.exit(0)
}

if (process.argv[1] && toPosix(process.argv[1]).endsWith('prepare-planner-input.mjs')) main()
