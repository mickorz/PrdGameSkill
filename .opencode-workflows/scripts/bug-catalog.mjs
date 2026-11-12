#!/usr/bin/env node
// bug-catalog.mjs —— Bug 目录确定性抽取（v4 阶段 7）：Bug 成为正式独立资产
// 从 bugs/buglist/*.md 文件名确定性派生 {bugId, title, module, sourceFile}（不再只活在 agent 上下文里）
// 模块规则与扫描提示词同语义：第二层【】标签；无第二层标签按标题关键词归类
// 用法：node bug-catalog.mjs <bugDir> <outFile> [--project-key hzmj]
import fs from 'node:fs'
import path from 'node:path'

const bugDir = process.argv[2]
const outFile = process.argv[3]
const argVal = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null }
const projectKey = argVal('--project-key') || 'hzmj'
if (!bugDir || !outFile) {
  console.error('用法: node bug-catalog.mjs <bugDir> <outFile> [--project-key hzmj]')
  process.exit(1)
}
if (!fs.existsSync(bugDir)) { console.error('[失败] 缺陷目录不存在: ' + bugDir); process.exit(1) }

function bugIdOf(name) {
  const m = name.match(/^(\d+)/)
  return m ? m[1] : name
}
// 模块：第二个【】标签；否则按标题关键词归类（与 workflow 扫描提示词同语义）
function moduleOf(title) {
  const tags = [...String(title).matchAll(/【([^】]+)】/g)].map((m) => m[1])
  if (tags.length >= 2) return tags[1]
  const KEYWORDS = ['结算', '创房', '亮牌', '行牌', '桌面', '流程']
  for (const k of KEYWORDS) if (String(title).indexOf(k) >= 0) return k
  return '其他'
}

const seen = new Set()
const duplicates = []
const bugs = []
for (const f of fs.readdirSync(bugDir).filter((x) => x.endsWith('.md')).sort()) {
  const name = f.replace(/\.md$/, '')
  const bugId = bugIdOf(name)
  const title = name.replace(/^\d+-/, '') || name
  if (seen.has(bugId)) { duplicates.push(bugId); continue }
  seen.add(bugId)
  bugs.push({
    bugId,
    title,
    module: moduleOf(name),
    sourceFile: path.join(bugDir, f).replace(/\\/g, '/'),
  })
}
if (bugs.length === 0) { console.error('[失败] 目录下无 .md 缺陷文件: ' + bugDir); process.exit(1) }
if (duplicates.length > 0) {
  console.error('[失败] bugId 重复（' + duplicates.length + ' 个，如 ' + duplicates[0] + '），目录文件名前缀数字必须唯一')
  process.exit(1)
}

const doc = {
  schemaVersion: 1,
  projectKey,
  generatedAt: new Date().toISOString(),
  count: bugs.length,
  bugs,
}
fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true })
fs.writeFileSync(outFile, JSON.stringify(doc, null, 2), 'utf8')
const byModule = {}
for (const b of bugs) byModule[b.module] = (byModule[b.module] || 0) + 1
console.log('[成功] bug-catalog 已生成: ' + outFile + '（' + bugs.length + ' 条，模块 ' + Object.keys(byModule).length + ' 个）')
console.log('  模块分布: ' + Object.entries(byModule).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(' / '))
