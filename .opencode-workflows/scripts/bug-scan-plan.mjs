#!/usr/bin/env node
// bug-scan-plan.mjs —— bug-coverage-check 扫描阶段确定性替代
//
// 背景：原扫描 agent 要把全量缺陷清单（200+ 条）经模型 schema 转述回 workflow，
//   并对无标签文件逐条推理分类，实测两轮均 15 分钟超时；清单抽取/大纲/分批本是
//   纯机械工作，改为确定性脚本一次落盘，模型只转发小摘要。
//
// 职责（全部确定性，不再经模型转述全量清单）：
//   1. Bug 目录全量抽取（复用 bug-catalog.mjs buildCatalog：第二层【】标签 + 关键词回退同语义）
//   2. PRD 路径来源二选一：
//      --prd-from-snapshot <dir>  共享快照模式（权威来源）：读快照 manifest.sourceFiles，
//                                  全程 ASCII 参数，规避中文路径经命令行的编码风险
//      --prd <f1,f2,...>          显式逗号分隔路径；路径必须存在，缺失即失败，不静默适配相近文件名
//   3. PRD 章节大纲抽取（^#{1,3} 标题，输出「行号 标题」）
//   4. 按模块分桶切批（与 workflow 原 buildBatches 同语义：固定容量 + 小批次并入相邻批次）
//   5. 判定收集输入 bug-verdicts-input.json 预生成（原由收集 agent 从 prompt 转述写入）
//
// 产物（全部写入 outDir）：
//   bug-catalog.json        Bug 资产（autoPass 已剔除，prePassBugs 单列）
//   prd-outline.txt         PRD 章节大纲（多 PRD 时带 === 文件名 === 分隔头）
//   batches.json            审核批次定义（批次 agent 读盘取本批文件清单，下标即批次号-1）
//   scan-summary.json       小摘要（转发 agent 原样回传 workflow：计数/批次标题/PRD 路径）
//   bug-verdicts-input.json 判定收集输入（allBugs/batches/prePassBugs/verdictsPartsDir，
//                            契约见 bug-verdicts.mjs collect）
//
// 用法：node bug-scan-plan.mjs <bugDir> <outDir> (--prd-from-snapshot <dir> | --prd <f1,f2>) [--batch-size 15] [--auto-pass-module m]...
//   注意：--auto-pass-module 传中文模块名在 Windows 命令行下可能受 codepage 影响，
//         需要中文模块名时建议走共享快照/ASCII 场景或改用 bash 透传
// exit 0 成功（stdout 摘要）；1 失败（stderr 原因，不猜测、不静默回退）
import fs from 'node:fs'
import path from 'node:path'
import { buildCatalog } from './bug-catalog.mjs'

const die = (msg) => { console.error('[失败] ' + msg); process.exit(1) }
const argVal = (name) => {
  const i = process.argv.indexOf(name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null
}
const argAll = (name) => {
  const out = []
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === name && process.argv[i + 1]) out.push(process.argv[i + 1])
  }
  return out
}

const bugDir = process.argv[2]
const outDir = process.argv[3]
const snapshotDir = argVal('--prd-from-snapshot')
const prdArg = argVal('--prd')
const batchSize = parseInt(argVal('--batch-size') || '15', 10)
const autoPassModules = argAll('--auto-pass-module')

if (!bugDir || !outDir) {
  die('用法: node bug-scan-plan.mjs <bugDir> <outDir> (--prd-from-snapshot <dir> | --prd <f1,f2>) [--batch-size N] [--auto-pass-module m]...')
}
if (!snapshotDir && !prdArg) die('PRD 来源缺失：需传 --prd-from-snapshot <共享快照目录> 或 --prd <逗号分隔路径> 之一')
if (snapshotDir && prdArg) die('PRD 来源冲突：--prd-from-snapshot 与 --prd 只能传一个')
if (!(batchSize >= 1)) die('--batch-size 非法: ' + batchSize)

// 1. Bug 目录全量抽取（目录不存在/无 .md/bugId 重复时 buildCatalog 抛错）
let bugs
try {
  bugs = buildCatalog(bugDir)
} catch (e) {
  die(e.message)
}

// 2. PRD 路径
let prdFiles
if (snapshotDir) {
  const manifestFile = path.join(snapshotDir, 'manifest.json')
  if (!fs.existsSync(manifestFile)) die('快照缺 manifest.json: ' + manifestFile)
  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
  } catch (e) {
    die('manifest.json 解析失败: ' + e.message)
  }
  const files = Array.isArray(manifest.sourceFiles) ? manifest.sourceFiles : []
  if (files.length === 0) die('manifest.sourceFiles 为空（快照元数据不完整，无法确定 PRD 路径）')
  prdFiles = [...new Set(files.map((x) => x && x.file).filter(Boolean))]
  if (prdFiles.length === 0) die('manifest.sourceFiles 无有效 file 字段')
} else {
  prdFiles = String(prdArg).split(',').map((x) => x.trim()).filter(Boolean)
}
for (const f of prdFiles) {
  if (!fs.existsSync(f)) die('PRD 路径不存在: ' + f + '（不静默适配相近文件名，请显式传正确路径）')
}

// 3. PRD 章节大纲（一至三级标题，行号 标题）
const outlineParts = []
const outlineWarnings = []
for (const f of prdFiles) {
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/)
  const hits = []
  lines.forEach((line, i) => {
    if (/^#{1,3}\s+\S/.test(line)) hits.push(i + 1 + ' ' + line.trim())
  })
  if (prdFiles.length > 1) outlineParts.push('=== ' + f + ' ===')
  outlineParts.push(...hits)
  if (hits.length === 0) outlineWarnings.push('PRD 无一至三级标题: ' + f)
}
const prdOutline = outlineParts.join('\n') + '\n'

// 4. autoPass 预判过滤 + 按模块分桶切批（与 workflow 原 buildBatches 同语义）
const prePassBugs = []
const kept = []
for (const b of bugs) {
  if (autoPassModules.indexOf(b.module) >= 0) prePassBugs.push(b)
  else kept.push(b)
}
function buildBatches(list, capacity) {
  const order = []
  const buckets = {}
  for (const b of list) {
    const m = b.module || '其他'
    if (!buckets[m]) {
      buckets[m] = []
      order.push(m)
    }
    buckets[m].push(b)
  }
  const chunks = []
  for (const m of order) {
    const list2 = buckets[m]
    for (let i = 0; i < list2.length; i += capacity) {
      chunks.push({ title: m, files: list2.slice(i, i + capacity) })
    }
  }
  const batches = []
  for (const c of chunks) {
    const last = batches[batches.length - 1]
    const mergeThreshold = Math.floor(capacity / 3)
    if (last && c.files.length <= mergeThreshold && last.files.length + c.files.length <= capacity) {
      last.files = last.files.concat(c.files)
      if (last.title.indexOf(c.title) < 0) last.title = last.title + '、' + c.title
      continue
    }
    batches.push({ title: c.title, files: c.files.slice() })
  }
  return batches
}
const batches = buildBatches(kept, batchSize)

// 自检：批次必须恰好覆盖待审核全集一条不漏、不重不漏
{
  const ids = batches.flatMap((b) => b.files.map((f) => f.bugId))
  if (ids.length !== kept.length || new Set(ids).size !== kept.length) {
    die('批次覆盖自检失败：批次文件 ' + ids.length + ' 条 vs 待审核 ' + kept.length + ' 条（bugId 去重 ' + new Set(ids).size + '），脚本分批逻辑有 bug')
  }
}

// 5. 落盘（UTF-8 无 BOM）
const writeJson = (name, obj) => fs.writeFileSync(path.join(outDir, name), JSON.stringify(obj, null, 1), 'utf8')
fs.mkdirSync(outDir, { recursive: true })
fs.mkdirSync(path.join(outDir, 'verdicts-parts'), { recursive: true }) // 批次分片目录（batch agent 直接写 batch-XX.json）

writeJson('bug-catalog.json', {
  schemaVersion: 1,
  bugCount: kept.length,
  prePassCount: prePassBugs.length,
  bugs: kept,
  prePassBugs,
})
fs.writeFileSync(path.join(outDir, 'prd-outline.txt'), prdOutline, 'utf8')
writeJson('batches.json', {
  batchCount: batches.length,
  // files 条目投影为 bugId/path/title/module（path 即缺陷文件相对路径，批次 agent 按 path 读取）
  batches: batches.map((b, i) => ({
    index: i,
    title: b.title,
    count: b.files.length,
    files: b.files.map((f) => ({ bugId: f.bugId, path: f.sourceFile, title: f.title, module: f.module })),
  })),
})
writeJson('scan-summary.json', {
  ok: true,
  bugCount: kept.length,
  prePassCount: prePassBugs.length,
  batchCount: batches.length,
  batches: batches.map((b, i) => ({ index: i, title: b.title, count: b.files.length })),
  prdFiles,
})
writeJson('bug-verdicts-input.json', {
  allBugs: kept.map((b) => ({ title: b.title, module: b.module, bugId: b.bugId })),
  batches: batches.map((b) => ({ title: b.title, files: b.files.map((f) => f.bugId) })),
  prePassBugs: prePassBugs.map((b) => ({ title: b.title, module: b.module, bugId: b.bugId })),
  verdictsPartsDir: outDir.replace(/[\\/]+$/, '') + '/verdicts-parts',
})

const byModule = {}
for (const b of kept) byModule[b.module] = (byModule[b.module] || 0) + 1
for (const w of outlineWarnings) console.log('[警告] ' + w + '（大纲为空，批次审核需自行 grep 章节标题）')
console.log(
  '[成功] 扫描计划已生成: ' + outDir + '（缺陷 ' + kept.length + ' 条 / 预判不适用 ' + prePassBugs.length
  + ' 条 / 批次 ' + batches.length + ' 个 / PRD ' + prdFiles.length + ' 个 / 模块 ' + Object.keys(byModule).length + ' 个）'
)
console.log('  模块分布: ' + Object.entries(byModule).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(' / '))
console.log('  PRD: ' + prdFiles.join(' / '))
