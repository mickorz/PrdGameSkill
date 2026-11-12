#!/usr/bin/env node
// requirements-build.mjs —— 共享需求提取快照的确定性构建（RTM T1）
//
// 职责（单写者契约：identity-map.json 只允许本脚本写入，checker 只读）：
//   1. 合并提取分片（requirements/parts/*.json）
//   2. 三层稳定 ID 匹配（identity-map 原子更新）：
//      L1 exact-match   源文件 + 规范化文本哈希命中        -> 复用 ID（identityStatus=exact-match）
//      L2 anchor-match  同文件同章节历史候选唯一且相似度>=0.6 -> 复用 ID（identityStatus=anchor-match）
//      L3 未命中        -> 分配新 ID；候选不唯一或相似度不足时 identityStatus=pending-confirm（不自动合并）
//   3. 源文件清单（SHA256）与提取快照 manifest
//   4. 引文一致性校验（text 与源文件行范围比对），失败清单进 validation.json
//
// 用法：
//   node requirements-build.mjs <extractionDir> [--identity-map <path>] [--project-key <key>]
//     <extractionDir>  提取快照目录（内含 requirements/parts/*.json）
//     --identity-map   缺省 <extractionDir>/../../identity-map.json（output/projects/<key>/identity-map.json）
//
// 输入分片契约（提取 agent 写入）：
//   [{ reqKey, title, source: { file, section?, fromLine, toLine }, text }]
//
// 输出（全部落在 <extractionDir> 内）：
//   requirements.json / source-manifest.json / validation.json / manifest.json
//   退出码 0 成功；1 结构性失败。validation 不合格不视为失败，显式列入 validation.json。

'use strict'

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const argv = process.argv.slice(2)
const extractionDir = argv[0]
if (!extractionDir || !fs.existsSync(extractionDir)) {
  console.error('[失败] extractionDir 不存在: ' + extractionDir)
  process.exit(1)
}
function argVal(name) {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : null
}
const identityMapPath = argVal('--identity-map') || path.join(path.dirname(path.resolve(extractionDir)), 'identity-map.json')
const projectKey = argVal('--project-key') || 'default'

const warnings = []
const errors = []
const normText = (s) => String(s || '').replace(/\s+/g, '')
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')

// bigram Jaccard 相似度（确定性、无依赖）
function bigrams(s) {
  const t = normText(s)
  const set = new Set()
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2))
  return set
}
function similarity(a, b) {
  const A = bigrams(a), B = bigrams(b)
  if (A.size === 0 || B.size === 0) return 0
  let inter = 0
  for (const x of A) if (B.has(x)) inter += 1
  return inter / (A.size + B.size - inter)
}

const ANCHOR_SIM_THRESHOLD = 0.6

// ---------- 1. 合并需求分片 ----------
const partsDir = path.join(extractionDir, 'requirements', 'parts')
const requirements = []
if (!fs.existsSync(partsDir)) {
  console.error('[失败] 需求分片目录不存在: ' + partsDir)
  process.exit(1)
}
for (const f of fs.readdirSync(partsDir).filter((x) => x.endsWith('.json')).sort()) {
  const p = path.join(partsDir, f)
  try {
    const arr = JSON.parse(fs.readFileSync(p, 'utf8'))
    if (!Array.isArray(arr)) { warnings.push('需求分片非数组，已跳过: ' + f); continue }
    for (const r of arr) {
      if (!r || !r.reqKey || !r.title || !r.source || !r.source.file) {
        warnings.push('需求点字段缺失，已跳过: ' + JSON.stringify(r).slice(0, 80))
        continue
      }
      if (requirements.some((x) => x.reqKey === r.reqKey)) warnings.push('reqKey 重复: ' + r.reqKey + '（保留首个）')
      else requirements.push(r)
    }
  } catch (e) {
    errors.push('需求分片 JSON 解析失败: ' + f + ' -> ' + e.message)
  }
}
if (requirements.length === 0) {
  console.error('[失败] 未提取到任何需求点（分片为空或全部无效）')
  process.exit(1)
}

// ---------- 2. 源文件清单与 SHA256 ----------
const sourceFileSet = [...new Set(requirements.map((r) => path.resolve(r.source.file)).map((p) => p.split(path.sep).join('/')))]
const sourceFiles = []
for (const f of sourceFileSet) {
  try {
    const content = fs.readFileSync(f)
    sourceFiles.push({ file: f, sha256: sha256(content), bytes: content.length })
  } catch (e) {
    errors.push('源文件不可读: ' + f + ' -> ' + e.message)
  }
}

// ---------- 3. identity-map 三层匹配 ----------
// map 结构（v2，兼容 v1 旧格式 byHash）：
// { version: 2, byHash: { "<file|normText-hash>": "REQ-001" }, byAnchor: { "<file|section>": ["REQ-001", ...] },
//   texts: { "REQ-001": "<规范化文本，供相似度匹配>" }, pending: [{ reqKey, candidateIds, reason }], next: 42 }
let map = { version: 2, byHash: {}, byAnchor: {}, texts: {}, pending: [], next: 1 }
if (fs.existsSync(identityMapPath)) {
  try {
    const prev = JSON.parse(fs.readFileSync(identityMapPath, 'utf8'))
    if (prev && typeof prev === 'object') {
      if (prev.version === 2) map = prev
      else if (prev.byHash) {
        // v1 升级：byHash 迁移，texts 无法回填（旧版未存），anchor 空起步
        map.byHash = prev.byHash
        map.next = prev.next || Object.keys(prev.byHash).length + 1
        warnings.push('identity-map 为 v1 旧格式，已迁移到 v2（历史文本缺失，锚点匹配从本轮开始积累）')
      }
    }
  } catch (e) {
    warnings.push('identity-map 解析失败，将重建: ' + e.message)
  }
}
let maxSeq = 0
for (const v of Object.values(map.byHash)) {
  const m = String(v).match(/REQ-(\d+)/)
  if (m) maxSeq = Math.max(maxSeq, Number(m[1]))
}
map.next = Math.max(map.next || 1, maxSeq + 1)
function allocId() {
  const id = 'REQ-' + String(map.next).padStart(3, '0')
  map.next += 1
  return id
}

const anchorOf = (r) => (r.source.file || '') + '|' + (r.source.section || '')
const stats = { exactMatch: 0, anchorMatch: 0, newWithPending: 0, newConfirmed: 0 }

// 匹配分层（匹配只用本轮开始时的 map 快照，登记在匹配完成后统一进行，
// 避免同一轮内相邻需求点互为"历史候选"）：
//   L1 exact：file+规范化文本哈希命中 -> 复用
//   L2 anchor：同章节历史候选，判定规则：
//       top1 >= 0.6 且（唯一候选 / 显著领先 top2<0.3 或分差>=0.25） -> 复用（anchor-match）
//       top1 在 [0.3, 0.6) 或多候选歧义 -> 新 ID + pending-confirm（不自动合并，留人工确认）
//       全部候选 < 0.3（或无候选） -> 新 ID（new，无歧义）
const matched = []
for (const r of requirements) {
  const h = sha256((r.source.file || '') + '|' + normText(r.text))
  const rec = { r, hash: h, candidates: [], pendingReason: null }
  // L1 exact-match
  if (map.byHash[h]) {
    r.requirementId = map.byHash[h]
    r.identityStatus = 'exact-match'
    stats.exactMatch += 1
    matched.push(rec)
    continue
  }
  // L2 anchor-match：同文件同章节历史候选
  const aKey = anchorOf(r)
  const candidates = (map.byAnchor[aKey] || [])
    .filter((id) => map.texts[id])
    .map((id) => ({ id, sim: similarity(r.text, map.texts[id] || '') }))
    .sort((x, y) => y.sim - x.sim)
  rec.candidates = candidates.slice(0, 3)
  const top1 = candidates[0]
  const top2 = candidates[1]
  if (top1 && top1.sim >= 0.6 && (!top2 || top2.sim < 0.3 || top1.sim - top2.sim >= 0.25)) {
    r.requirementId = top1.id
    r.identityStatus = 'anchor-match'
    stats.anchorMatch += 1
  } else if (top1 && top1.sim >= 0.3) {
    // 中等相似或多候选歧义：新 ID + pending-confirm，不自动合并
    r.requirementId = allocId()
    r.identityStatus = 'pending-confirm'
    rec.pendingReason = top2 && top2.sim >= 0.3 ? '同章节多个相似候选' : '相似度处于模糊区间'
    stats.newWithPending += 1
  } else {
    // 无相近候选：全新需求
    r.requirementId = allocId()
    r.identityStatus = 'new'
    stats.newConfirmed += 1
  }
  matched.push(rec)
}

// 登记遍：全部匹配完成后统一写入 map
for (const rec of matched) {
  const r = rec.r
  map.byHash[rec.hash] = r.requirementId
  const aKey = anchorOf(r)
  if (!map.byAnchor[aKey]) map.byAnchor[aKey] = []
  if (!map.byAnchor[aKey].includes(r.requirementId)) map.byAnchor[aKey].push(r.requirementId)
  map.texts[r.requirementId] = normText(r.text)
  if (rec.pendingReason) {
    map.pending.push({
      reqKey: r.reqKey,
      requirementId: r.requirementId,
      candidates: rec.candidates.map((x) => ({ requirementId: x.id, similarity: Number(x.sim.toFixed(3)) })),
      reason: rec.pendingReason,
    })
  }
}
const idByReqKey = new Map(requirements.map((r) => [r.reqKey, r.requirementId]))

// ---------- 4. 引文一致性校验（validation） ----------
const validation = { status: 'passed', checkedRequirements: requirements.length, failures: [] }
const fileCache = new Map()
function linesOf(f) {
  const key = path.resolve(f)
  if (!fileCache.has(key)) {
    try { fileCache.set(key, fs.readFileSync(key, 'utf8').split('\n')) } catch (e) { fileCache.set(key, null) }
  }
  return fileCache.get(key)
}
for (const r of requirements) {
  const rel = { reqKey: r.reqKey, requirementId: r.requirementId, file: r.source.file }
  const lines = linesOf(r.source.file)
  if (!lines) { validation.failures.push({ ...rel, check: 'source-file-missing' }); continue }
  const from = Number(r.source.fromLine)
  const to = Number(r.source.toLine)
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > lines.length) {
    validation.failures.push({ ...rel, check: 'line-range-invalid', detail: from + '~' + to + '（文件共 ' + lines.length + ' 行）' })
    continue
  }
  const seg = normText(lines.slice(from - 1, to).join('\n'))
  if (normText(r.text) && seg.indexOf(normText(r.text)) < 0) {
    validation.failures.push({ ...rel, check: 'quote-mismatch', detail: '需求文本未出现在声明的行范围内' })
  }
}
validation.status = validation.failures.length === 0 ? 'passed' : 'failed'

// ---------- 5. 组装最终 requirements（稳定 ID + 身份状态） ----------
const finalRequirements = requirements.map((r) => ({
  requirementId: r.requirementId,
  reqKey: r.reqKey,
  title: r.title,
  text: r.text,
  source: r.source,
  identityStatus: r.identityStatus,
}))

// ---------- 6. 写出（identity-map 原子更新：临时文件 + rename） ----------
function writeAtomic(target, content) {
  const tmp = target + '.tmp'
  fs.writeFileSync(tmp, content, 'utf8')
  fs.renameSync(tmp, target)
}
writeAtomic(path.join(extractionDir, 'requirements.json'), JSON.stringify(finalRequirements, null, 2))
writeAtomic(path.join(extractionDir, 'source-manifest.json'), JSON.stringify({ projectKey, sourceFiles }, null, 2))
writeAtomic(path.join(extractionDir, 'validation.json'), JSON.stringify(validation, null, 2))
writeAtomic(identityMapPath, JSON.stringify(map, null, 2))

const manifest = {
  schemaVersion: 1,
  projectKey,
  extractionRunId: path.basename(extractionDir),
  sourceFiles,
  requirementsPath: 'requirements.json',
  identityMapPath,
  identityMapVersion: 2,
  validationStatus: validation.status,
  validationFailures: validation.failures.length,
  identityStats: stats,
  warningsCount: warnings.length,
  warnings: warnings.slice(0, 200),
  errors,
}
writeAtomic(path.join(extractionDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

if (errors.length) {
  console.log('[失败] 结构性错误 ' + errors.length + ' 条，详见 manifest.json')
  errors.forEach((e) => console.log('  - ' + e))
  process.exit(1)
}
console.log('[成功] 需求快照构建完成')
console.log('  需求点: ' + finalRequirements.length + '（exact ' + stats.exactMatch + ' / anchor ' + stats.anchorMatch + ' / 新增待确认 ' + stats.newWithPending + ' / 新增 ' + stats.newConfirmed + '）')
console.log('  validation: ' + validation.status + '（失败 ' + validation.failures.length + ' 条，详见 validation.json）')
console.log('  identity-map 已原子更新: ' + identityMapPath)
