#!/usr/bin/env node
// gen-req-index.mjs —— 共享需求快照瘦身索引（v4 阶段 8 需求清单瘦身）
// 用途：把共享快照 requirements.json（全量含 text，236KB+）投影为只含
//   requirementId/reqKey/title 的索引文件（约 15KB），供三 Checker 检查 agent 定位需求点；
//   agent 需要原文时按 requirementId 用 grep 在全量文件回查，避免每轮 read 全量撑爆上下文，
//   也避免 agent 凭记忆编造超范围 reqKey 编号（实测 444/476 超出 380 条快照）。
//
// 用法：node gen-req-index.mjs <共享快照目录> --out <索引输出路径>
//   快照目录只读（不写入快照目录，保住「历史快照只读」设计原则）；索引写到调用方 run 输出目录
//   exit 0 成功（stdout 摘要 JSON）/ 1 失败（stderr 原因）
import fs from 'node:fs'
import path from 'node:path'

const snapDir = process.argv[2]
const outIdx = process.argv.indexOf('--out')
const outPath = outIdx >= 0 && process.argv[outIdx + 1] ? process.argv[outIdx + 1] : null
if (!snapDir || !outPath) { console.error('[失败] 用法: gen-req-index.mjs <共享快照目录> --out <索引输出路径>'); process.exit(1) }

const reqPath = path.join(snapDir, 'requirements.json')
if (!fs.existsSync(reqPath)) { console.error('[失败] 快照缺 requirements.json: ' + reqPath); process.exit(1) }

let reqs
try {
  reqs = JSON.parse(fs.readFileSync(reqPath, 'utf8'))
} catch (e) {
  console.error('[失败] requirements.json 解析失败: ' + e.message); process.exit(1)
}
const arr = Array.isArray(reqs) ? reqs : (reqs.requirements || [])
if (!arr.length) { console.error('[失败] requirements 为空'); process.exit(1) }

const index = arr.map((r) => ({ requirementId: r.requirementId, reqKey: r.reqKey, title: r.title }))
const missing = index.filter((x) => !x.requirementId || !x.reqKey).length
if (missing) { console.error('[失败] ' + missing + ' 条缺 requirementId/reqKey'); process.exit(1) }

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(index, null, 1), 'utf8')
console.log('[成功] ' + outPath + ' ' + index.length + ' 条')
