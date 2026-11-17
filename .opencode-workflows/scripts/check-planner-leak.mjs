// ============================================================
// check-planner-leak.mjs —— S10 策划版泄漏扫描 + 规则覆盖校验
//
// 执行文档 §5 S10 闸门（策划版泄漏扫描 + AT-ID 覆盖）。
// 职责（确定性）：
//   1. 泄漏扫描：策划版不得出现技术字段 —— 类名/方法名模式、协议名 MsgXxx、
//      文件路径（xxx.ts / xxx.cpp / xxx.xml / xxx.json）、行号（file:123）、
//      证据 ID（CLE-/SVE-）、技术枚举名（verdict/applicability/analysisPath/conflict-fast/
//      l7Basis/pending-blocked/verification_required/decision_required）、配置 key 原名（小写蛇形）、
//      代码围栏、Emoji；
//   2. 规则覆盖：business-view 中每条规则的关键词（rule 前 12 字）应在策划版中出现（软校验，缺失告警不失败）。
//
// CLI：node check-planner-leak.mjs --run-dir <dir> --planner <path> --date <YYYY-MM-DD>
//   退出码：0 通过 / 1 有泄漏
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

// 泄漏模式（每条给人类可读标签）
const LEAK_RULES = [
  { label: '证据 ID（CLE-/SVE-）', re: /\b(?:CLE|SVE)-[A-Za-z0-9-]+/g },
  { label: '协议消息名（MsgXxx）', re: /\bMsg[A-Z][A-Za-z0-9]*/g },
  { label: '源码文件名（.ts/.cpp/.xml/.json/.mjs/.js/.lua/.cs）', re: /[A-Za-z0-9_\-/]+\.(?:ts|cpp|xml|json|mjs|js|lua|cs)\b/g },
  { label: '类名/方法名（大驼峰带后缀）', re: /\b[A-Z][A-Za-z0-9]*(?:View|Controller|Ctrl|Model|Manager|Mgr|Helper|Component|Box|Panel|Layer|Util|Service|Handler)\b/g },
  { label: '文件行号（path:数字）', re: /\b[A-Za-z0-9_\-/]+\.[A-Za-z]+\s*:\s*\d+/g },
  { label: '技术枚举名', re: /\b(?:verificationScope|analysisPath|conflict-fast|l7Basis|pending-blocked|verification_required|decision_required|not_applicable|directConflict|evidenceIds|conflictEvidenceIds|claimKey|dependencyFiles|applicability|verdict|reviewRule|reviewStatus|effectiveDifference|baselineDifference|candidateDifference)\b/g },
  { label: 'verdict/applicability 取值', re: /\b(?:confirmed|not_found|conditional|unknown|inactive|active|consistent|partial|unverified)\b/g },
  { label: '配置 key 原名（小写蛇形）', re: /\b[a-z][a-z0-9]*(?:_[a-z0-9]+){2,}\b/g },
  { label: '代码围栏', re: /```/g },
  { label: 'Emoji', re: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2705}\u{274C}\u{26A0}]/gu },
]

// 允许的业务词（避免误报：中文场景下这些英文取值可能出现于业务描述，仍按严格口径禁止；
// 如需放行单个词，在此白名单登记）
const ALLOW_WORDS = new Set([])

export function checkPlannerLeak({ runDir, plannerPath }) {
  const problems = []
  const warnings = []
  if (!plannerPath || !fs.existsSync(plannerPath)) {
    return { ok: false, problems: ['策划版文档不存在：' + String(plannerPath)], warnings, summary: null }
  }
  const text = fs.readFileSync(plannerPath, 'utf8')
  const lines = text.split(/\r?\n/)

  const hits = []
  for (const rule of LEAK_RULES) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      rule.re.lastIndex = 0
      let m
      while ((m = rule.re.exec(line)) !== null) {
        const token = m[0]
        if (ALLOW_WORDS.has(token)) continue
        hits.push({ line: i + 1, kind: rule.label, token: token })
        if (m.index === rule.re.lastIndex) rule.re.lastIndex++ // 防零宽死循环
      }
    }
  }
  if (hits.length > 0) {
    // 按 kind 聚合，避免刷屏
    const byKind = new Map()
    for (const h of hits) {
      if (!byKind.has(h.kind)) byKind.set(h.kind, [])
      byKind.get(h.kind).push(h)
    }
    for (const [kind, list] of byKind) {
      problems.push(
        '泄漏「' + kind + '」' + list.length + ' 处，例：' +
          list.slice(0, 5).map((x) => '行' + x.line + ' ' + x.token).join(' / ')
      )
    }
  }

  // 规则覆盖（软校验：只告警）
  const bv = readJsonSafe(path.join(runDir, '5-specs', 'runtime', 'planner-input', 'business-view.json'))
  let covered = 0
  let total = 0
  if (bv.ok) {
    for (const st of bv.data.stages || []) {
      for (const r of st.rules || []) {
        total++
        const key = String(r.rule || '').slice(0, 12)
        if (key && text.includes(key)) covered++
      }
    }
    if (total > 0 && covered < total) {
      warnings.push('规则覆盖 ' + covered + '/' + total + '（未按 rule 前 12 字命中者可能改写了表述，请人工抽查）')
    }
  } else {
    warnings.push('business-view.json 不可读，跳过规则覆盖软校验')
  }

  return {
    ok: problems.length === 0,
    problems,
    warnings,
    summary: { leakCount: hits.length, ruleTotal: total, ruleCovered: covered, lineCount: lines.length },
  }
}

function main() {
  const argv = process.argv.slice(2)
  const a = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--run-dir') a.runDir = argv[++i]
    else if (argv[i] === '--planner') a.plannerPath = argv[++i]
    else if (argv[i] === '--date') a.date = argv[++i]
  }
  if (!a.runDir || !a.plannerPath) {
    console.error('用法：node check-planner-leak.mjs --run-dir <dir> --planner <path> --date <YYYY-MM-DD>')
    process.exit(1)
  }
  const r = checkPlannerLeak({ runDir: a.runDir, plannerPath: a.plannerPath })
  for (const w of r.warnings) console.log('[提示] ' + w)
  if (!r.ok) {
    console.log('[失败] 策划版泄漏扫描未通过，共 ' + r.problems.length + ' 类问题：')
    for (const p of r.problems) console.log('  - ' + p)
    process.exit(1)
  }
  const s = r.summary
  console.log('[成功] 策划版校验：无泄漏 / 规则覆盖 ' + s.ruleCovered + '/' + s.ruleTotal + ' / 共 ' + s.lineCount + ' 行 -> ' + toPosix(a.plannerPath))
  process.exit(0)
}

if (process.argv[1] && toPosix(process.argv[1]).endsWith('check-planner-leak.mjs')) main()
