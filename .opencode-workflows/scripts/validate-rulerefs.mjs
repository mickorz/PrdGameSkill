#!/usr/bin/env node
// validate-rulerefs.mjs —— ruleRef 基准条款号确定性校验（ui-interaction-prd-extract v3 A2/A4）
//
// 背景：v1 run（run-mwee0k70-1）中检查 agent 幻觉了 9 个不存在的条款号（如 01#42，
//       规则文件实际只有 1~25 条），审核发现了但修正 prompt 禁改 ruleRef，错误残留进最终报告。
// 本脚本把条款号校验做成确定性闸门：生成报告前逐条校验（--refs），修正后全文复检（--report）。
//
// 条款解析规则：rulesDir 下 NN-*.md 文件中 ^\s*N[.、] 行视为条款（与规则基准编写约定一致；
//              00-基准说明.md 也参与——其条款可被引用）。
//
// 用法：
//   node validate-rulerefs.mjs --rules <rulesDir> --refs "Q01@01#9,03#12;Q02@无" [--out <json>]
//   node validate-rulerefs.mjs --rules <rulesDir> --report <report.md> [--out <json>]
//
// --refs   逐条校验：id@压缩条款列表（NN#M 逗号分隔），; 分隔条目；@无 或无 NN#M 视为未引用（非法）
// --report 报告全文校验：提取文件中所有 NN#M 模式（含清单表与详情），任一不存在即失败
// 通过 exit 0（stdout 摘要）；失败 exit 1（stdout 明细，供 run 日志核对）；--out 另写 JSON 结果
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const readArg = (name) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : null
}
const rulesDir = readArg('--rules')
const refsArg = readArg('--refs')
const reportArg = readArg('--report')
const outArg = readArg('--out')
if (!rulesDir || (!refsArg && !reportArg)) {
  console.error('用法: node validate-rulerefs.mjs --rules <rulesDir> (--refs "<id@refs;...>" | --report <report.md>) [--out <json>]')
  process.exit(1)
}
if (!fs.existsSync(rulesDir)) {
  console.error('[失败] 规则基准目录不存在: ' + rulesDir)
  process.exit(1)
}

// 解析规则条款：NN-*.md → 条款号集合
const clauseSets = {}
const clauseRanges = {}
for (const f of fs.readdirSync(rulesDir)) {
  const m = f.match(/^(\d{2})-.*\.md$/)
  if (!m) continue
  const text = fs.readFileSync(path.join(rulesDir, f), 'utf8')
  const nums = new Set()
  for (const line of text.split('\n')) {
    const cm = line.match(/^\s*(\d+)[.、]\s/)
    if (cm) nums.add(Number(cm[1]))
  }
  clauseSets[m[1]] = nums
  clauseRanges[m[1]] = nums.size > 0 ? '1~' + Math.max(...nums) + '（' + nums.size + ' 条）' : '无条款'
}

const REF_RE = /(\d{2})#(\d+)/g
const invalid = []
const checkRef = (m) => {
  const fileNo = m[1]
  const clauseNo = Number(m[2])
  if (!clauseSets[fileNo]) {
    return '条款文件 ' + fileNo + ' 不存在于规则基准（现有: ' + Object.keys(clauseSets).join(',') + '）'
  }
  if (!clauseSets[fileNo].has(clauseNo)) {
    return '条款号 ' + m[0] + ' 不存在（' + fileNo + ' 文件条款为 ' + clauseRanges[fileNo] + '）'
  }
  return null
}

let checked = 0
if (refsArg) {
  for (const entry of refsArg.split(';')) {
    if (!entry) continue
    const at = entry.indexOf('@')
    if (at < 0) continue
    const id = entry.slice(0, at)
    const refs = entry.slice(at + 1).trim()
    checked += 1
    if (!refs || refs === '无') {
      invalid.push({ id: id, ref: '无', reason: '未引用任何基准条款号' })
      continue
    }
    const seen = new Set()
    for (const m of refs.matchAll(REF_RE)) {
      const key = m[1] + '#' + m[2]
      if (seen.has(key)) continue
      seen.add(key)
      const reason = checkRef(m)
      if (reason) invalid.push({ id: id, ref: key, reason: reason })
    }
    if (seen.size === 0) invalid.push({ id: id, ref: refs, reason: 'ruleRef 未包含任何 NN#M 条款号格式' })
  }
} else {
  if (!fs.existsSync(reportArg)) {
    console.error('[失败] 报告文件不存在: ' + reportArg)
    process.exit(1)
  }
  const lines = fs.readFileSync(reportArg, 'utf8').split('\n')
  const seen = new Map()
  for (let i = 0; i < lines.length; i++) {
    for (const m of lines[i].matchAll(REF_RE)) {
      if (!seen.has(m[0])) seen.set(m[0], i + 1)
    }
  }
  checked = seen.size
  for (const [ref, line] of seen) {
    const m = ref.match(/^(\d{2})#(\d+)$/)
    const reason = checkRef(m)
    if (reason) invalid.push({ line: line, ref: ref, reason: reason })
  }
}

const summary = {
  ok: invalid.length === 0,
  mode: refsArg ? 'refs' : 'report',
  rulesDir: rulesDir,
  rules: Object.fromEntries(Object.keys(clauseSets).map((k) => [k, clauseRanges[k]])),
  checked: checked,
  invalidCount: invalid.length,
  invalid: invalid,
}
if (outArg) fs.writeFileSync(outArg, JSON.stringify(summary, null, 2), 'utf8')

if (invalid.length === 0) {
  const rulesNote = Object.keys(clauseSets)
    .map((k) => k + ':' + clauseRanges[k])
    .join(' ')
  console.log(
    '[成功] ruleRef 校验通过: ' +
      (refsArg ? checked + ' 条问题引用' : reportArg + ' 全文 ' + checked + ' 个唯一引用') +
      '全部存在于规则基准（' + rulesNote + '）'
  )
} else {
  console.log('[失败] ruleRef 校验失败: ' + invalid.length + ' 个非法引用（共检查 ' + checked + (refsArg ? ' 条）' : ' 个唯一引用）'))
  for (const it of invalid) {
    console.log('  - ' + (it.id || '第 ' + it.line + ' 行') + ' | ' + it.ref + ' | ' + it.reason)
  }
  process.exit(1)
}
