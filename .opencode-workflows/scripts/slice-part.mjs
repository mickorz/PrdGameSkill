// slice-part.mjs — 需求分片切片器（按行范围/原文锚点从源文件机械切原文，保证引文一致性）
//
// 由 prd-requirements-extract 的需求原子化 agent 调用（替代 agent 每次临时生成
// gen_partXX.py 切片脚本）：agent 只写「提取计划」（不含原文的小 JSON），
// 本脚本从源文件机械切原文组装分片，从根上保证 text 与源文件一致。
// 同时输出章节覆盖率，把「漏章节」暴露在 agent 的命令输出里，避免静默漏提。
// 用法：
//   node slice-part.mjs <plan.json>
//
// plan.json 格式（agent 用 write 工具写，UTF-8 无 BOM）：
//   {
//     "sourceFile": "input/xxx.md",                         // 源文件（相对项目根）
//     "outFile": "output/projects/.../parts/part-01.json",  // 输出分片路径
//     "reqKeyPrefix": "xxx",                                // 选填：缺省 reqKey 的自动编号前缀（默认源文件名去扩展名）
//     "items": [
//       { "reqKey": "xxx-001", "title": "≤20 字小标题", "section": "2.1", "fromLine": 14, "toLine": 18 },
//       { "title": "表格某格需求", "section": "4.5", "fromLine": 392,
//         "startText": "本家视角", "endText": "最多同时提起1张" }
//     ]
//   }
//
// text 取值：
//   1) 给了 startText + endText：在 fromLine~toLine 范围内从 startText 首次出现处截到 endText 首次出现处（含终点）
//      —— 用于只取一段话里的某个片段（如 Markdown 表格行的某一格），避免把整行 `| ... |` 塞进需求原文
//   2) 都不给：取 fromLine~toLine 整段原文（去首尾空白）
//   3) 只给其一：规格错误
//   startText/endText 必须与源文件逐字一致（含全半角、标点、转义）
//
// section：缺省或含图片占位符（{{IP_...}}）时，自动回填 fromLine 之前最近的 Markdown 标题，避免垃圾章节名
//
// 行为：
//   - text 机械摘抄不改写；行号 1 基（read 工具口径）
//   - 校验：行号越界 / 范围为空 / text 空白 / 锚点缺失 / reqKey 重复（重复的整条丢弃并记错误）
//   - 警告（不影响产出）：标题超过 20 字 / 原文重复 / 存在未覆盖章节
//   - 章节覆盖率（CLI 打印 + SUMMARY 携带）：按 Markdown 标题分段，统计「需求行」（非空、非标题、
//     非表格分隔行/表头行）被 items 行范围覆盖的比例，未覆盖章节逐个列出
//   - reqKey 缺省时按 reqKeyPrefix（或源文件名）自动编号 `前缀-001`
//   - 产物即分片 JSON 数组（与旧 agent 直写格式完全一致，requirements-build.mjs 无感知）
//
// 输出约定（对齐本仓库脚本惯例）：[成功]/[失败] 前缀 + SUMMARY {json}

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TITLE_MAX = 20
const IMAGE_PLACEHOLDER = /\{\{IP_[A-Za-z0-9]+\}\}/

function die(msg) {
  console.error('[失败] ' + msg)
  process.exit(1)
}

// ---------- 章节与覆盖率（纯函数） ----------
const isHeading = (line) => /^#{1,6}\s+\S/.test(line)
const isTableSeparator = (line) => /^\|?[\s:|-]*-{2,}[\s:|-]*\|?$/.test(line.trim()) && line.includes('-')
const isTableHeader = (lines, idx) => {
  for (let j = idx + 1; j < lines.length; j++) {
    if (!lines[j].trim()) continue
    return isTableSeparator(lines[j])
  }
  return false
}

export function sectionRanges(lines) {
  const heads = []
  lines.forEach((ln, i) => {
    if (isHeading(ln)) heads.push({ line: i + 1, title: ln.replace(/^#{1,6}\s+/, '').trim() })
  })
  if (heads.length === 0 || heads[0].line > 1) heads.unshift({ line: 1, title: '(文首)' })
  return heads.map((h, i) => ({ ...h, endLine: i + 1 < heads.length ? heads[i + 1].line - 1 : lines.length }))
}

/** fromLine 之前（含本行）最近的章节标题 */
export function nearestSection(sections, line) {
  let hit = sections.length > 0 ? sections[0].title : ''
  for (const s of sections) {
    if (s.line <= line) hit = s.title
    else break
  }
  return hit
}

/** 章节覆盖率：统计每节「需求行」被 items 行范围覆盖的数量 */
export function coverageReport(lines, sections, items) {
  const covered = new Set()
  for (const it of items) {
    for (let i = Number(it.source.fromLine); i <= Number(it.source.toLine); i++) covered.add(i)
  }
  const rows = []
  let totalLines = 0
  let totalCovered = 0
  for (const s of sections) {
    let candidate = 0
    let hit = 0
    for (let i = s.line; i <= s.endLine; i++) {
      const ln = lines[i - 1]
      if (!ln || !ln.trim()) continue
      if (isHeading(ln) || isTableSeparator(ln) || isTableHeader(lines, i - 1)) continue
      candidate += 1
      if (covered.has(i)) hit += 1
    }
    totalLines += candidate
    totalCovered += hit
    rows.push({ title: s.title, startLine: s.line, endLine: s.endLine, lines: candidate, covered: hit })
  }
  const uncovered = rows.filter((r) => r.lines > 0 && r.covered === 0).map((r) => r.title)
  return { totalLines, totalCovered, rate: totalLines ? Number((totalCovered / totalLines).toFixed(3)) : 0, uncovered, sections: rows }
}

// ---------- 切片核心（纯函数，供自检导入） ----------
export function slicePart(plan, sourceText) {
  const lines = String(sourceText || '').split(/\r?\n/)
  const sections = sectionRanges(lines)
  const errors = []
  const warnings = []
  const seenKeys = new Map()
  const seenText = new Map()
  const out = []

  const fallbackPrefix = plan.reqKeyPrefix
    ? String(plan.reqKeyPrefix)
    : plan.sourceFile
      ? path.basename(String(plan.sourceFile)).replace(/\.md$/i, '')
      : ''

  ;(plan.items || []).forEach((it, idx) => {
    const no = idx + 1
    if (!it || typeof it !== 'object') {
      errors.push('第 ' + no + ' 条：条目不是对象')
      return
    }
    const reqKey = it.reqKey ? String(it.reqKey) : fallbackPrefix ? fallbackPrefix + '-' + String(no).padStart(3, '0') : ''
    const tag = reqKey ? reqKey : '第 ' + no + ' 条'
    if (!reqKey) {
      errors.push(tag + '：reqKey 缺失，且 plan 未给 sourceFile/reqKeyPrefix 无法自动编号')
      return
    }
    if (seenKeys.has(reqKey)) {
      errors.push(tag + '：reqKey 重复（首条为第 ' + seenKeys.get(reqKey) + ' 条）')
      return
    }
    seenKeys.set(reqKey, no)

    const from = Number(it.fromLine)
    const to = it.toLine === undefined || it.toLine === null ? from : Number(it.toLine)
    if (!Number.isInteger(from) || from < 1 || !Number.isInteger(to) || to < from || to > lines.length) {
      errors.push(tag + '：行号非法 ' + it.fromLine + '-' + it.toLine + '（源文件共 ' + lines.length + ' 行）')
      return
    }

    const hasStart = it.startText !== undefined && it.startText !== null && String(it.startText) !== ''
    const hasEnd = it.endText !== undefined && it.endText !== null && String(it.endText) !== ''
    if (hasStart !== hasEnd) {
      errors.push(tag + '：startText 与 endText 必须同时给出（只给其一无法确定截取边界）')
      return
    }

    const rangeText = lines.slice(from - 1, to).join('\n')
    let text
    if (hasStart && hasEnd) {
      const s = String(it.startText)
      const e = String(it.endText)
      const i = rangeText.indexOf(s)
      if (i < 0) {
        errors.push(tag + '：startText 未出现在行范围 ' + from + '-' + to + ' 内（逐字比对，注意全半角/标点/转义）：' + s)
        return
      }
      const j = rangeText.indexOf(e, i)
      if (j < 0) {
        errors.push(tag + '：endText 未出现在 startText 之后的行范围内（逐字比对）：' + e)
        return
      }
      text = rangeText.slice(i, j + e.length)
    } else {
      text = rangeText
    }
    text = text.trim()
    if (!text) {
      errors.push(tag + '：行范围 ' + from + '-' + to + ' 内容为空')
      return
    }

    const title = it.title ? String(it.title) : ''
    if (title.length > TITLE_MAX) warnings.push(tag + '：标题超过 ' + TITLE_MAX + ' 字（' + title.length + '）：' + title)
    const norm = text.replace(/\s+/g, '')
    if (seenText.has(norm)) warnings.push(tag + '：原文与第 ' + seenText.get(norm) + ' 条重复')
    else seenText.set(norm, no)

    let section = it.section === undefined || it.section === null ? '' : String(it.section).trim()
    if (!section || IMAGE_PLACEHOLDER.test(section)) section = nearestSection(sections, from)

    out.push({
      reqKey,
      title,
      source: {
        file: plan.sourceFile,
        section,
        fromLine: from,
        toLine: to,
      },
      text,
    })
  })

  const coverage = coverageReport(lines, sections, out)
  if (coverage.uncovered.length > 0) {
    warnings.push('存在未覆盖章节 ' + coverage.uncovered.length + ' 个：' + coverage.uncovered.slice(0, 8).join('、') + (coverage.uncovered.length > 8 ? ' 等' : ''))
  }

  return { items: out, errors, warnings, coverage, totalLines: lines.length }
}

// ---------- CLI（直接执行时跑；被 import 时只暴露纯函数） ----------
function main() {
  const planPath = process.argv[2]
  if (!planPath) {
    console.log('用法: node slice-part.mjs <plan.json>')
    process.exit(1)
  }
  let plan
  try {
    plan = JSON.parse(fs.readFileSync(planPath, 'utf8'))
  } catch (e) {
    die('plan.json 解析失败：' + e.message)
  }
  if (!plan.sourceFile || !plan.outFile || !Array.isArray(plan.items) || plan.items.length === 0) {
    die('plan.json 结构不完整（需 sourceFile / outFile / items 至少一条）')
  }
  if (!fs.existsSync(plan.sourceFile)) {
    die('源文件不存在：' + plan.sourceFile)
  }
  const sourceText = fs.readFileSync(plan.sourceFile, 'utf8')
  const result = slicePart(plan, sourceText)
  for (const w of result.warnings) console.log('[警告] ' + w)
  if (result.errors.length > 0) {
    die('切片校验失败 ' + result.errors.length + ' 条：\n  ' + result.errors.join('\n  '))
  }
  fs.mkdirSync(path.dirname(plan.outFile), { recursive: true })
  fs.writeFileSync(plan.outFile, JSON.stringify(result.items, null, 2) + '\n', 'utf8')

  const cov = result.coverage
  console.log('[覆盖] 需求行 ' + cov.totalCovered + '/' + cov.totalLines + '（' + Math.round(cov.rate * 100) + '%），未覆盖章节 ' + cov.uncovered.length + ' 个')
  for (const s of cov.sections) {
    if (s.lines > 0 && s.covered === 0) console.log('  - 未覆盖：' + s.title + '（行 ' + s.startLine + '-' + s.endLine + '，' + s.lines + ' 行）')
  }
  console.log('[成功] 切片完成：' + result.items.length + ' 条 -> ' + plan.outFile + '（源文件 ' + result.totalLines + ' 行）')
  console.log('SUMMARY ' + JSON.stringify({ count: result.items.length, outFile: plan.outFile, totalLines: result.totalLines, coverage: { rate: cov.rate, uncovered: cov.uncovered } }))
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
