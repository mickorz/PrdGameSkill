// ============================================================
// merge-branch-evidence.mjs —— S4/S5 双端证据确定性合并（客户端/服务端共用）
//
// 执行文档 §5.0 A（统计口径）+ §5.0 B（证据确定性合并 M1~M8）+ §5 S4/S5 + D21/D22/D24/D26/D27/D28。
// 客户端与服务端契约完全相同（§5.0 B 明确「S4/S5 共用」），故一个脚本参数化 branch。
//
// 职责（唯一写者：agent 只写 runtime 分片）：
//   1. 分片归集（M1）：按文件名字典序读 verify-output/<stageId>-cp|p<NN>.json，与完成顺序无关；
//   2. 证据合并（M2/M3/M4/M6/M8）：按规范化合并键 (repoId, file, location, symbol, claimKey) 排序、
//      同键合并（atomIds 并集，按 Registry 顺序）、ID 归属 Registry 最早支撑原子、
//      既有正式产物同合并键沿用原 id（幂等）、同 id 不同合并键 fail（id 劫持）；
//   3. 条目合并（§5.0 A）：每已完成原子恰一条，条目不含 pending 字段；
//   4. 版本回填（D18/D22）：sourceRevision/contentHash/verifiedAt 与 dependencyFiles[].contentHash
//      由 source-manifest 按 (repoId, file) 联合匹配回填（agent 零生成）；
//   5. pending 判定与统计（§5.0 A + D5）：pending 由 run-status 判定（唯一事实源），
//      不变式 entryCount + pendingAtomIds.length === expectedAtomCount 强校验。
//
// 产物：
//   client: <runDir>/2-client/client-evidence.json
//   server: <runDir>/3-server/server-evidence.json（+ scope-index.json 的 applicability 部分）
//   both  : <runDir>/<branchDir>/runtime/run-status.json（规范化写回）、runtime/branch-recount.json
//
// 可导入：export mergeBranchEvidence({ runDir, branch, date, registry, sourceManifest, fileHashes })
//   返回 { ok, problems, summary, evidence, runStatus, scopeEntries }
//
// CLI：node merge-branch-evidence.mjs --run-dir <dir> --branch <client|server> --date <YYYY-MM-DD>
//   退出码：0 成功 / 1 失败（明细 [失败] 前缀，不写正式产物）
//
// 约定：JSON 1 空格缩进 UTF-8 LF；路径 '/'；排序码元序（M7 禁 localeCompare）；
//       date 经参数传入；location 规范 <file>:<起>-<止>（单行可省区间）。
// ============================================================

import fs from 'node:fs'
import path from 'node:path'

const KEY_SEP = '\u0000'
const VERDICTS = ['confirmed', 'partial', 'not_found']
const APPLICABILITIES = ['active', 'conditional', 'inactive', 'unknown']
const CLIENT_LAYERS = ['client_code', 'client_fgui']
const SERVER_LAYERS = ['common_game', 'hzmj_server', 'mah_frame']

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
const toPosix = (p) => String(p).replaceAll('\\', '/')

function readJsonSafe(p) {
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(p, 'utf8')) }
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) }
  }
}

// location 规范化（M7）：<file>:<行>[ -<行>] -> <file>:<起>-<止>
function normalizeLocation(loc, file) {
  const s = toPosix(String(loc || '')).trim()
  if (!s) return ''
  const m = /^(.*?):(\d+)(?:\s*-\s*(\d+))?$/.exec(s)
  if (!m) return s
  const f = m[1]
  const a = Number(m[2])
  const b = m[3] === undefined ? a : Number(m[3])
  if (f !== toPosix(String(file || ''))) return s // file 与 location 前缀不一致：保留原样（由闸门判错）
  return a === b ? f + ':' + a : f + ':' + a + '-' + b
}

// 规范化合并键字段（M7：'/' 分隔、不做大小写折叠、空 symbol 排前）
function normEvidence(e, problems, partName) {
  const claimKey = String(e.claimKey || '').trim().toLowerCase().replace(/\s+/g, '-')
  const repoId = String(e.repoId || '').trim()
  const layer = String(e.layer || '').trim()
  const file = toPosix(String(e.file || '').trim())
  const symbol = String(e.symbol || '')
  const location = normalizeLocation(e.location, file)
  const atomIds = Array.isArray(e.atomIds) ? e.atomIds.filter((x) => typeof x === 'string' && x) : []
  const depFiles = Array.isArray(e.dependencyFiles)
    ? e.dependencyFiles.map((d) => ({ file: toPosix(String((d && d.file) || '').trim()) })).filter((d) => d.file)
    : []
  if (!claimKey) problems.push(partName + '：证据缺 claimKey（M8 非空必填）：' + file + ' ' + location)
  if (!repoId) problems.push(partName + '：证据缺 repoId：' + file + ' ' + location)
  if (!file || !location) problems.push(partName + '：证据 file/location 为空：' + JSON.stringify({ file, location }))
  if (atomIds.length === 0) problems.push(partName + '：证据 atomIds 为空（必须支撑至少一个原子）：' + file + ' ' + location)
  return {
    mergeKey: [repoId, file, location, symbol, claimKey].join(KEY_SEP),
    sep: { repoId, file, location, symbol, claimKey },
    atomIds: atomIds,
    layer: layer,
    excerpt: String(e.excerpt || ''),
    configKeys: Array.isArray(e.configKeys) ? e.configKeys.map(String) : [],
    dependencyFiles: depFiles,
  }
}

// 合并键码元序（M2/M7）：repoId -> file -> location -> symbol(空值排前) -> claimKey
function cmpMergeKey(a, b) {
  const x = a.sep
  const y = b.sep
  let r = cmp(x.repoId, y.repoId)
  if (r) return r
  r = cmp(x.file, y.file)
  if (r) return r
  r = cmp(x.location, y.location)
  if (r) return r
  // 空 symbol 统一排前
  if (!x.symbol !== !y.symbol) return x.symbol ? 1 : -1
  r = cmp(x.symbol, y.symbol)
  if (r) return r
  return cmp(x.claimKey, y.claimKey)
}

// ============================================================
// 主流程
// ============================================================

export function mergeBranchEvidence(input) {
  const problems = []
  const bad = (m) => problems.push(m)
  const I = input || {}
  const runDir = I.runDir
  const branch = String(I.branch || '')
  const date = String(I.date || '')
  const registry = I.registry
  const sourceManifest = I.sourceManifest || null
  const fileHashes = I.fileHashes || null

  if (!runDir) bad('runDir 缺失')
  if (branch !== 'client' && branch !== 'server') bad('branch 必须是 client 或 server：' + branch)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) bad('date 非法：' + date)
  if (!registry || !Array.isArray(registry.features)) bad('registry 缺失或结构非法（S3 产物）')
  if (problems.length > 0) return { ok: false, problems, summary: null }

  const branchDir = branch === 'client' ? '2-client' : '3-server'
  const partSuffix = branch === 'client' ? '-cp' : '-p'
  const layers = branch === 'client' ? CLIENT_LAYERS : SERVER_LAYERS
  const prefix = branch === 'client' ? 'CLE' : 'SVE'

  // ---- Registry 全序索引（M4/M7：atomIds 排列与 ID 归属的唯一基准） ----
  const atomOrder = new Map()
  const expectedAtomIds = []
  for (const f of registry.features) {
    for (const a of f.atoms || []) {
      if (!atomOrder.has(a.atomId)) atomOrder.set(a.atomId, atomOrder.size)
      expectedAtomIds.push(a.atomId)
    }
  }
  const sortByRegistry = (ids) =>
    [...new Set(ids)].filter((id) => atomOrder.has(id)).sort((a, b) => atomOrder.get(a) - atomOrder.get(b))
  const earliestAtom = (ids) => {
    const sorted = sortByRegistry(ids)
    return sorted[0] || null
  }

  // ---- 分片归集（M1：文件名字典序，与 agent 完成顺序无关） ----
  const outDir = path.join(runDir, branchDir, 'runtime', 'verify-output')
  let partNames = []
  if (fs.existsSync(outDir)) {
    partNames = fs.readdirSync(outDir).filter((n) => n.endsWith('.json') && n.includes(partSuffix)).sort(cmp)
  }
  if (partNames.length === 0) {
    bad('verify-output 无分片（agent 未落盘或路径不符 ' + toPosix(outDir) + '/<stageId>' + partSuffix + '<NN>.json）')
    return { ok: false, problems, summary: null }
  }

  // ---- run-status（pending 唯一事实源；缺文件时按分片存在性推导） ----
  const runStatusPath = path.join(runDir, branchDir, 'runtime', 'run-status.json')
  const rsRead = readJsonSafe(runStatusPath)
  const declaredParts = rsRead.ok && Array.isArray(rsRead.data.parts) ? rsRead.data.parts : null
  const declaredStatus = new Map()
  if (declaredParts) {
    for (const p of declaredParts) {
      if (p && p.partFile) declaredStatus.set(toPosix(p.partFile), { status: p.status, atomIds: p.atomIds || [] })
    }
  }
  const partStatus = (name) => {
    const d = declaredStatus.get(name)
    if (d && d.status) return d.status
    return fs.existsSync(path.join(outDir, name)) ? 'completed' : 'pending'
  }

  // ---- 逐分片读取 + 规范化（只消费 completed 分片；pending/failed/timeout 不产 entry） ----
  const shards = []
  const rawEvidence = [] // { norm, partName }
  for (const name of partNames) {
    const st = partStatus(name)
    if (st !== 'completed') continue // 未完成分片整片跳过（其原子进 pendingAtomIds）
    const read = readJsonSafe(path.join(outDir, name))
    if (!read.ok) {
      bad('分片不可读（status=completed 但解析失败）：' + name + ' -> ' + read.error)
      continue
    }
    const shard = read.data
    if (!Array.isArray(shard.entries)) {
      bad('分片缺 entries 数组：' + name)
      continue
    }
    shards.push({ name: name, shard: shard })
    for (const e of Array.isArray(shard.evidence) ? shard.evidence : []) {
      rawEvidence.push({ norm: normEvidence(e, problems, name), partName: name })
    }
  }
  if (problems.length > 0) return { ok: false, problems, summary: null }

  // ---- 既有正式产物（幂等锚点：同合并键沿用原 id，M4） ----
  const formalPath =
    branch === 'client'
      ? path.join(runDir, branchDir, 'client-evidence.json')
      : path.join(runDir, branchDir, 'server-evidence.json')
  const formalRead = readJsonSafe(formalPath)
  const formalEvidence = formalRead.ok && Array.isArray(formalRead.data.evidence) ? formalRead.data.evidence : []
  const idByMergeKey = new Map()
  const keyById = new Map()
  for (const e of formalEvidence) {
    const norm = normEvidence(e, problems, '既有正式产物')
    idByMergeKey.set(norm.mergeKey, e.id)
    keyById.set(e.id, norm.mergeKey)
  }
  if (problems.length > 0) return { ok: false, problems, summary: null }

  // ---- M3/M8 同键合并（atomIds 并集，按 Registry 顺序） ----
  const groups = new Map()
  for (const { norm } of rawEvidence) {
    const g = groups.get(norm.mergeKey)
    if (!g) groups.set(norm.mergeKey, { norm, allAtomIds: [...norm.atomIds] })
    else g.allAtomIds.push(...norm.atomIds)
  }

  // ---- M2 排序 + M4 ID 分配（确定性：按合并键码元序，NN 接续归属命名空间既有最大值） ----
  const orderedGroups = [...groups.values()].sort((a, b) => cmpMergeKey(a.norm, b.norm))
  const nextNN = new Map() // namespace(atomId) -> 下一个可用 NN
  const bumpExisting = (id) => {
    // 从既有 id 中恢复命名空间与 NN，保证新 id 不撞号
    const m = new RegExp('^' + prefix + '-(.+)-(\\d+)$').exec(String(id || ''))
    if (!m) return
    const ns = m[1]
    const nn = Number(m[2])
    nextNN.set(ns, Math.max(nextNN.get(ns) || 1, nn + 1))
  }
  for (const id of keyById.keys()) bumpExisting(id)

  const evidence = []
  const evidenceById = new Map()
  for (const g of orderedGroups) {
    const atomIds = sortByRegistry(g.allAtomIds)
    if (atomIds.length === 0) {
      bad('证据 atomIds 全部不在 Registry（外来原子）：' + g.norm.sep.file + ' ' + g.norm.sep.location)
      continue
    }
    const owner = earliestAtom(atomIds) // M4：归属 Registry 最早支撑原子
    let id = idByMergeKey.get(g.norm.mergeKey)
    if (!id) {
      const ns = owner
      const nn = nextNN.get(ns) || 1
      nextNN.set(ns, nn + 1)
      id = prefix + '-' + ns + '-' + String(nn).padStart(2, '0')
      // M6：新分配的 id 不得与既有不同合并键撞号
      if (keyById.has(id) && keyById.get(id) !== g.norm.mergeKey) {
        bad('id 劫持：新分配 id 已被不同合并键占用 ' + id)
        continue
      }
    } else if (!String(id).startsWith(prefix + '-')) {
      bad('既有证据 id 前缀非法（期望 ' + prefix + '-）：' + id)
      continue
    }
    const sep = g.norm.sep
    // 版本三字段与依赖 hash 回填（D18/D22：(repoId, file) 联合匹配）
    const hit = fileHashes ? fileHashes.get(sep.repoId + KEY_SEP + sep.file) : null
    const depFiles = g.norm.dependencyFiles.map((d) => {
      const dh = fileHashes ? fileHashes.get(sep.repoId + KEY_SEP + d.file) : null
      return { file: d.file, contentHash: dh ? dh.contentHash : '' }
    })
    const entry = {
      id: id,
      atomIds: atomIds,
      claimKey: sep.claimKey,
      repoId: sep.repoId,
      layer: g.norm.layer,
      file: sep.file,
      location: sep.location,
      symbol: sep.symbol,
      excerpt: g.norm.excerpt,
      configKeys: g.norm.configKeys,
      sourceRevision: hit ? hit.sourceRevision : '',
      contentHash: hit ? hit.contentHash : '',
      verifiedAt: hit ? hit.verifiedAt : '',
      dependencyFiles: depFiles,
    }
    if (!hit) bad('证据文件未被 source-manifest 覆盖（(repoId,file) 联合匹配未命中）：' + sep.repoId + ' / ' + sep.file)
    if (layers.length && !layers.includes(g.norm.layer)) {
      bad('证据 layer 非法（分支 ' + branch + ' 只允许 ' + layers.join('/') + '）：' + JSON.stringify(g.norm.layer) + ' @ ' + sep.file)
    }
    evidence.push(entry)
    evidenceById.set(id, entry)
  }
  if (problems.length > 0) return { ok: false, problems, summary: null }

  // ---- 条目合并（§5.0 A：已完成原子恰一条；条目不存 pending 字段） ----
  const entriesByAtom = new Map()
  const seenEntry = new Set()
  for (const { name, shard } of shards) {
    for (const e of shard.entries) {
      const atomId = String(e && e.atomId || '')
      if (!atomOrder.has(atomId)) {
        bad(name + '：条目 atomId 不在 Registry（外来原子）：' + atomId)
        continue
      }
      if (seenEntry.has(atomId)) {
        bad(name + '：原子条目重复（每原子恰一条）：' + atomId)
        continue
      }
      seenEntry.add(atomId)
      const evidenceIds = Array.isArray(e.evidenceIds) ? e.evidenceIds.filter(Boolean) : []
      // 引用一致性：被引证据存在且其 atomIds 含本条原子
      for (const eid of evidenceIds) {
        const ev = evidenceById.get(eid)
        if (!ev) bad(name + '：条目引用不存在的证据 ' + atomId + ' -> ' + eid)
        else if (!ev.atomIds.includes(atomId)) {
          bad(name + '：引用一致性失败（证据 atomIds 不含引用方原子）：' + atomId + ' -> ' + eid + ' ⊄ ' + JSON.stringify(ev.atomIds))
        }
      }
      const entry = { atomId: atomId }
      if (branch === 'client') {
        const verdict = String(e.verdict || '')
        if (!VERDICTS.includes(verdict)) bad(name + '：verdict 非法：' + atomId + ' = ' + JSON.stringify(e.verdict))
        if (verdict === 'not_found' && evidenceIds.length > 0) {
          bad(name + '：not_found 不得带证据：' + atomId)
        }
        if (verdict !== 'not_found' && evidenceIds.length === 0) {
          bad(name + '：verdict=' + verdict + ' 必须带证据：' + atomId)
        }
        const directConflict = e.directConflict === true
        const conflictEvidenceIds = Array.isArray(e.conflictEvidenceIds) ? e.conflictEvidenceIds.filter(Boolean) : []
        if (directConflict) {
          if (conflictEvidenceIds.length === 0) bad(name + '：directConflict=true 必带 conflictEvidenceIds：' + atomId)
          if (verdict === 'not_found') bad(name + '：directConflict=true 不得 verdict=not_found：' + atomId)
          for (const cid of conflictEvidenceIds) {
            if (!evidenceById.has(cid)) bad(name + '：conflictEvidenceIds 引用不存在证据：' + atomId + ' -> ' + cid)
          }
        }
        const ob = e.observedBehavior && typeof e.observedBehavior === 'object' ? e.observedBehavior : {}
        Object.assign(entry, {
          verdict: verdict,
          clientLogic: String(e.clientLogic || ''),
          uiInteraction: String(e.uiInteraction || ''),
          messages: Array.isArray(e.messages) ? e.messages.map(String) : [],
          notes: String(e.notes || ''),
          directConflict: directConflict,
          conflictEvidenceIds: conflictEvidenceIds,
          observedBehavior: {
            trigger: String(ob.trigger || ''),
            condition: String(ob.condition || ''),
            action: String(ob.action || ''),
            result: String(ob.result || ''),
          },
          evidenceIds: evidenceIds,
        })
      } else {
        const applicability = String(e.applicability || '')
        if (!APPLICABILITIES.includes(applicability)) bad(name + '：applicability 非法（四值）：' + atomId + ' = ' + JSON.stringify(e.applicability))
        if (applicability === 'conditional' && !String(e.configCondition || '').trim()) {
          bad(name + '：conditional 必填 configCondition：' + atomId)
        }
        if (applicability === 'unknown' && !String(e.unresolved || '').trim()) {
          bad(name + '：unknown 必填 unresolved（缺什么证据）：' + atomId)
        }
        const directConflict = e.directConflict === true
        const conflictEvidenceIds = Array.isArray(e.conflictEvidenceIds) ? e.conflictEvidenceIds.filter(Boolean) : []
        if (directConflict && conflictEvidenceIds.length === 0) {
          bad(name + '：directConflict=true 必带 conflictEvidenceIds：' + atomId)
        }
        for (const cid of conflictEvidenceIds) {
          if (!evidenceById.has(cid)) bad(name + '：conflictEvidenceIds 引用不存在证据：' + atomId + ' -> ' + cid)
        }
        if (evidenceIds.length === 0 && !e.noServerEvidence) {
          bad(name + '：applicability=' + applicability + ' 但无证据且未标 noServerEvidence：' + atomId)
        }
        Object.assign(entry, {
          applicability: applicability,
          configVerified: e.configVerified === true,
          callPathVerified: e.callPathVerified === true,
          configCondition: String(e.configCondition || ''),
          callPath: String(e.callPath || ''),
          evidenceIds: evidenceIds,
          unresolved: String(e.unresolved || ''),
          noServerEvidence: e.noServerEvidence === true,
          directConflict: directConflict,
          conflictEvidenceIds: conflictEvidenceIds,
        })
      }
      entriesByAtom.set(atomId, entry)
    }
  }
  if (problems.length > 0) return { ok: false, problems, summary: null }

  // ---- pending 判定（§5.0 A + D5：run-status 唯一事实源）+ 不变式强校验 ----
  const pendingAtomIds = []
  const atomsOfPart = (name) => {
    const d = declaredStatus.get(name)
    if (d && Array.isArray(d.atomIds) && d.atomIds.length > 0) return d.atomIds
    // 无声明清单：以分片实际覆盖 + Registry 补齐不可得，回退为「分片内 entries 覆盖原子」
    const read = readJsonSafe(path.join(outDir, name))
    return read.ok && Array.isArray(read.data.entries) ? read.data.entries.map((x) => x && x.atomId).filter(Boolean) : []
  }
  const completedParts = partNames.filter((n) => partStatus(n) === 'completed')
  const unfinishedParts = partNames.filter((n) => partStatus(n) !== 'completed')
  for (const name of unfinishedParts) {
    for (const id of atomsOfPart(name)) if (atomOrder.has(id) && !pendingAtomIds.includes(id)) pendingAtomIds.push(id)
  }
  pendingAtomIds.sort((a, b) => atomOrder.get(a) - atomOrder.get(b))

  const entryCount = entriesByAtom.size
  const expectedAtomCount = expectedAtomIds.length
  // 不变式（§5.0 A）：entryCount + pendingAtomIds.length === expectedAtomCount
  // 若存在既无 entry、也未被 run-status 声明为 pending 的原子，说明 run-status.parts[].atomIds 不完整，
  // 无法精确判定归属 —— fail fast 要求补齐（不静默猜测，D5 禁止从缺条目反推执行状态）。
  const uncovered = expectedAtomIds.filter((id) => !entriesByAtom.has(id) && !pendingAtomIds.includes(id))
  if (uncovered.length > 0) {
    bad(
      '统计不变式无法判定：' + uncovered.length + ' 个原子既无 entry 也未被 run-status 声明为 pending' +
        '（请补齐 run-status.parts[].atomIds）：' + uncovered.slice(0, 10).join(',') + (uncovered.length > 10 ? ' …' : '')
    )
  }
  const invariantOk = entryCount + pendingAtomIds.length === expectedAtomCount
  if (!invariantOk) {
    bad(
      '统计口径不变式失败：entryCount(' + entryCount + ') + pendingAtomIds(' + pendingAtomIds.length +
        ') ≠ expectedAtomCount(' + expectedAtomCount + ')'
    )
  }
  if (problems.length > 0) return { ok: false, problems, summary: null }

  // ---- 统计重算（不信任 agent 摘要） ----
  const stats = { atomCount: entryCount }
  if (branch === 'client') {
    stats.confirmed = 0
    stats.partial = 0
    stats.not_found = 0
    stats.directConflict = 0
    stats.pending = pendingAtomIds.length
    stats.evidenceCount = evidence.length
    for (const e of entriesByAtom.values()) {
      stats[e.verdict]++
      if (e.directConflict) stats.directConflict++
    }
  } else {
    stats.active = 0
    stats.conditional = 0
    stats.unknown = 0
    stats.inactive = 0
    stats.directConflict = 0
    stats.pending = pendingAtomIds.length
    for (const e of entriesByAtom.values()) {
      stats[e.applicability]++
      if (e.directConflict) stats.directConflict++
    }
  }
  const coverage = { expectedAtomCount: expectedAtomCount, entryCount: entryCount, pendingAtomIds: pendingAtomIds }

  // ---- 规范化 run-status 写回（pending 唯一事实源） ----
  const partsOut = partNames.map((name) => {
    const d = declaredStatus.get(name)
    return { partFile: name, stageId: String(name).split(partSuffix)[0], status: partStatus(name), atomIds: atomsOfPart(name) }
  })
  const runStatus = {
    schemaVersion: 1,
    branch: branch,
    date: date,
    runStatus: partsOut.every((p) => p.status === 'completed') ? 'completed' : partsOut.some((p) => p.status === 'completed') ? 'partial' : 'failed',
    parts: partsOut,
  }

  return {
    ok: true,
    problems: [],
    summary: { branch, entryCount, expectedAtomCount, evidenceCount: evidence.length, stats, coverage, completedParts: completedParts.length, unfinishedParts: unfinishedParts.length },
    evidence: { schemaVersion: 1, date: date, evidence: evidence, stats: { sveCount: evidence.length } },
    runStatus: runStatus,
    scopeEntries: branch === 'server' ? [...entriesByAtom.values()] : null,
    clientEntries: branch === 'client' ? [...entriesByAtom.values()] : null,
  }
}

// ============================================================
// CLI
// ============================================================

function main() {
  const argv = process.argv.slice(2)
  const a = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--run-dir') a.runDir = argv[++i]
    else if (argv[i] === '--branch') a.branch = argv[++i]
    else if (argv[i] === '--date') a.date = argv[++i]
  }
  if (!a.runDir || !a.branch || !a.date) {
    console.error('用法：node merge-branch-evidence.mjs --run-dir <dir> --branch <client|server> --date <YYYY-MM-DD>')
    process.exit(1)
  }
  const branchDir = a.branch === 'client' ? '2-client' : '3-server'
  const regRead = readJsonSafe(path.join(a.runDir, '1-registry', 'requirement-registry.json'))
  if (!regRead.ok) {
    console.log('[失败] Registry 不可读（先跑 S3）：' + regRead.error)
    process.exit(1)
  }
  const manifestPath = path.join(a.runDir, branchDir, 'runtime', 'source-manifest.json')
  const mRead = readJsonSafe(manifestPath)
  if (!mRead.ok) {
    console.log('[失败] source-manifest 不可读（先跑 collect-source-manifest.mjs）：' + manifestPath)
    process.exit(1)
  }
  // 从 manifest 重建 (repoId, file) -> 版本信息映射
  const fileHashes = new Map()
  for (const repo of mRead.data.repos || []) {
    for (const f of repo.files || []) {
      fileHashes.set(repo.repoId + KEY_SEP + f.file, {
        contentHash: f.contentHash,
        sourceRevision: repo.commit,
        verifiedAt: mRead.data.collectedAt,
      })
    }
  }

  const r = mergeBranchEvidence({
    runDir: a.runDir, branch: a.branch, date: a.date,
    registry: regRead.data, sourceManifest: mRead.data, fileHashes,
  })
  if (!r.ok) {
    console.log('[失败] 证据合并未通过，共 ' + r.problems.length + ' 项问题（不写正式产物）：')
    for (const p of r.problems) console.log('  - ' + p)
    process.exit(1)
  }

  // 写正式产物 + run-status + 重算摘要
  const rtDir = path.join(a.runDir, branchDir, 'runtime')
  fs.mkdirSync(rtDir, { recursive: true })
  const evidencePath = path.join(a.runDir, branchDir, a.branch === 'client' ? 'client-evidence.json' : 'server-evidence.json')
  const out = { schemaVersion: 1, date: a.date }
  if (a.branch === 'client') {
    out.source = mRead.data.repos.map((x) => ({ repoId: x.repoId, repoRoot: x.repoRoot }))
    out.entries = r.clientEntries
    out.evidence = r.evidence.evidence
    out.coverage = r.summary.coverage
    out.stats = r.summary.stats
  } else {
    out.evidence = r.evidence.evidence
    out.stats = r.summary.stats
  }
  fs.writeFileSync(evidencePath, JSON.stringify(out, null, 1) + '\n', 'utf8')
  fs.writeFileSync(path.join(rtDir, 'run-status.json'), JSON.stringify(r.runStatus, null, 1) + '\n', 'utf8')
  fs.writeFileSync(path.join(rtDir, 'branch-recount.json'), JSON.stringify(
    { schemaVersion: 1, generatedBy: 'merge-branch-evidence.mjs', branch: a.branch, date: a.date, summary: r.summary }, null, 1) + '\n', 'utf8')
  console.log(
    '[成功] 证据合并：分支 ' + a.branch + ' / entry ' + r.summary.entryCount + ' + pending ' + r.summary.coverage.pendingAtomIds.length +
      ' = expected ' + r.summary.expectedAtomCount + ' / 证据 ' + r.summary.evidenceCount + ' 条 -> ' + toPosix(evidencePath)
  )
  process.exit(0)
}

if (process.argv[1] && toPosix(process.argv[1]).endsWith('merge-branch-evidence.mjs')) main()
