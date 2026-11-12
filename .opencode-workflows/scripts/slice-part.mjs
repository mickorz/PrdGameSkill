// slice-part.mjs —— 需求分片切片器（按行范围从源文件机械切原文，保证引文一致性）
//
// 由 prd-requirements-extract 的需求原子化 agent 调用（替代 agent 每次临时生成
// gen_partXX.py 切片脚本）：agent 只写「提取计划」（不含原文的小 JSON），
// 本脚本从源文件按行范围切原文组装分片，从根上保证 text 与源文件一致。
//
// 用法：
//   node slice-part.mjs <plan.json>
//
// plan.json 格式（agent 用 write 工具写，UTF-8 无 BOM）：
//   {
//     "sourceFile": "input/xxx.md",                     // 源文件（相对项目根）
//     "outFile": "output/projects/.../parts/part-01.json", // 输出分片路径
//     "items": [
//       { "reqKey": "xxx-001", "title": "≤20 字小标题", "section": "2.1", "fromLine": 14, "toLine": 18 }
//     ]
//   }
//
// 行为：
//   - text = 源文件第 fromLine..toLine 行原文（1 基行号，read 工具口径），机械拼接不改写
//   - 校验：行号越界 / 范围为空 / text 空白 / reqKey 重复 / reqKey 非法 —— 任一失败退出码 1
//   - 产物即分片 JSON 数组（与原 agent 直写格式完全一致，requirements-build.mjs 无感知）
//
// 输出约定（对齐本仓库脚本惯例）：[成功]/[失败] 前缀 + SUMMARY {json}

import fs from 'node:fs'
import path from 'node:path'

function die(msg) {
  console.error('[失败] ' + msg)
  process.exit(1)
}

// ---------- 切片核心（纯函数，供自检导入） ----------
export function slicePart(plan, sourceText) {
  const lines = String(sourceText || '').split(/\r?\n/)
  const errors = []
  const seenKeys = new Set()
  const out = []
  for (const it of plan.items || []) {
    const tag = it.reqKey || '(无 reqKey)'
    if (!it.reqKey || typeof it.reqKey !== 'string') {
      errors.push('reqKey 缺失：' + JSON.stringify(it.title || ''))
      continue
    }
    if (seenKeys.has(it.reqKey)) {
      errors.push('reqKey 重复：' + it.reqKey)
      continue
    }
    seenKeys.add(it.reqKey)
    const from = Number(it.fromLine)
    const to = Number(it.toLine)
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > lines.length) {
      errors.push(tag + ' 行号非法：' + from + '-' + to + '（源文件共 ' + lines.length + ' 行）')
      continue
    }
    const text = lines.slice(from - 1, to).join('\n')
    if (!text.trim()) {
      errors.push(tag + ' 行范围 ' + from + '-' + to + ' 内容为空白')
      continue
    }
    out.push({
      reqKey: it.reqKey,
      title: it.title || '',
      source: {
        file: plan.sourceFile,
        section: it.section || '',
        fromLine: from,
        toLine: to,
      },
      text,
    })
  }
  return { items: out, errors, totalLines: lines.length }
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
  if (result.errors.length > 0) {
    die('切片校验失败 ' + result.errors.length + ' 条：\n  ' + result.errors.join('\n  '))
  }
  fs.mkdirSync(path.dirname(plan.outFile), { recursive: true })
  fs.writeFileSync(plan.outFile, JSON.stringify(result.items, null, 1), 'utf8')
  console.log('[成功] 切片完成：' + result.items.length + ' 条 -> ' + plan.outFile + '（源文件 ' + result.totalLines + ' 行）')
  console.log('SUMMARY ' + JSON.stringify({ count: result.items.length, outFile: plan.outFile, totalLines: result.totalLines }))
}

import { fileURLToPath } from 'node:url'
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
