// session-timeline.mjs —— opencode session 轮级时间线分析（耗时归因：模型侧 vs 工具执行 vs 轮间等待）
// 用法：
//   node session-timeline.mjs --run <runJson> [--phase 规则检查] [--top 3]   # 从 workflow run 记录拉 sessionId
//   node session-timeline.mjs --session <sesId> [--label 检查 开局]           # 单 session
// 数据源：~/.local/share/opencode/opencode.db（只读）；session 定位可用 sessions-search（见 CLAUDE.md）
// 归因口径：轮耗时 = step-start→step-finish（模型生成 + 轮内工具执行）；
//           工具执行 = Σ tool state.time(end-start)；轮间等待 = 上轮 finish→下轮 start（模型侧）
import sqlite3 from 'node:sqlite'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const dbPath = path.join(os.homedir(), '.local/share/opencode/opencode.db')

function argVal(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : null
}

function timeline(con, sid, label) {
  const rows = con.prepare('SELECT p.time_created, p.data FROM part p WHERE p.session_id=? ORDER BY p.time_created').all(sid)
  if (!rows.length) return console.log('[警告] 无 part 数据:', sid)
  const parts = rows.map((r) => [Number(r.time_created), JSON.parse(r.data)])
  const rounds = []
  let cur = null
  for (const [ts, j] of parts) {
    const t = j.type
    if (t === 'step-start') cur = { start: ts, tools: [] }
    else if (t === 'step-finish' && cur) { cur.end = ts; rounds.push(cur); cur = null }
    else if (cur && t === 'tool') {
      const tm = (j.state || {}).time || {}
      if (tm.start && tm.end) {
        const input = (j.state || {}).input || {}
        cur.tools.push({ name: j.tool, dur: (tm.end - tm.start) / 1000, detail: String(input.filePath || input.command || '').slice(0, 60) })
      }
    }
  }
  const span = (parts[parts.length - 1][0] - parts[0][0]) / 1000
  let roundTotal = 0, toolTotal = 0, gapTotal = 0, prevEnd = null
  const lines = []
  rounds.forEach((r, i) => {
    const dur = (r.end - r.start) / 1000
    const ttime = r.tools.reduce((s, t) => s + t.dur, 0)
    const gap = prevEnd ? (r.start - prevEnd) / 1000 : 0
    roundTotal += dur; toolTotal += ttime; gapTotal += gap; prevEnd = r.end
    const tools = r.tools.map((t) => `${t.name}(${t.dur.toFixed(1)}s)${t.dur > 2 ? ':' + t.detail : ''}`).join(', ')
    lines.push(`  轮${String(i + 1).padStart(2)} ${String(Math.round(dur)).padStart(4)}s (模型${String(Math.round(dur - ttime)).padStart(4)}s 工具${ttime.toFixed(1).padStart(5)}s)${gap > 5 ? ' gap前' + Math.round(gap) + 's' : ''} | ${tools.slice(0, 100)}`)
  })
  const agg = {}
  for (const r of rounds) for (const t of r.tools) { const a = agg[t.name] || (agg[t.name] = [0, 0]); a[0]++; a[1] += t.dur }
  console.log(`\n=== ${label} (${sid}) 轮数 ${rounds.length} 跨度 ${Math.round(span)}s ===`)
  if (argVal('--verbose')) lines.forEach((l) => console.log(l))
  console.log(`  合计 轮内 ${Math.round(roundTotal)}s = 模型 ${Math.round(roundTotal - toolTotal)}s + 工具 ${Math.round(toolTotal)}s | 轮间等待 ${Math.round(gapTotal)}s`)
  console.log('  工具汇总:', Object.entries(agg).map(([k, v]) => `${k} ${v[0]}次/${v[1].toFixed(0)}s`).join(', '))
  return { label, span, rounds: rounds.length, model: roundTotal - toolTotal, tool: toolTotal, gap: gapTotal }
}

const con = new sqlite3.DatabaseSync('file:' + dbPath + '?mode=ro', { open: true })
const results = []
const runJson = argVal('--run')
if (runJson) {
  const r = JSON.parse(fs.readFileSync(runJson, 'utf8'))
  const phase = argVal('--phase')
  const top = Number(argVal('--top') || 3)
  let agents = r.agents.filter((x) => x.sessionId && (!phase || x.phase === phase))
  const withDur = agents.map((x) => ({ x, dur: x.durationMs || Date.now() - x.startedAt }))
    .sort((a, b) => b.dur - a.dur)
  const slowest = withDur.slice(0, top).map((w) => w.x)
  const retry = agents.filter((x) => x.attempt > 1).filter((x) => !slowest.includes(x))
  for (const x of [...slowest, ...retry]) {
    results.push(timeline(con, x.sessionId, `${x.label} (${x.status}${x.attempt > 1 ? ', attempt=' + x.attempt : ''}, ${Math.round((x.durationMs || Date.now() - x.startedAt) / 1000)}s)`))
  }
} else {
  const sid = argVal('--session')
  if (!sid) { console.error('用法: --run <runJson> [--phase X] [--top N] | --session <sesId> [--label X] [--verbose]'); process.exit(1) }
  results.push(timeline(con, sid, argVal('--label') || sid))
}
if (results.length > 1) {
  const m = results.reduce((s, x) => s + x.model, 0), t = results.reduce((s, x) => s + x.tool, 0), g = results.reduce((s, x) => s + x.gap, 0)
  console.log(`\n=== 汇总（${results.length} 个 session）：模型 ${Math.round(m)}s (${Math.round((m / (m + t + g)) * 100)}%) / 工具 ${Math.round(t)}s (${Math.round((t / (m + t + g)) * 100)}%) / 等待 ${Math.round(g)}s ===`)
}
con.close()
