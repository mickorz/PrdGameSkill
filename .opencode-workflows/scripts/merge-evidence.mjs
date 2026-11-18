// ============================================================
// merge-evidence.mjs —— S6 证据汇总（同步屏障 + 分析路径三分 + analysisRunId）
//
// 执行文档 §5 S6、§1 屏障判定路径、原则 3/4/7、D5/D14/D15/D25。
//
// 职责（确定性，无 agent——directConflict 是 S4/S5 已落的语义信号，本步只做布尔消费）：
//   1. 输入：Registry + client-evidence + scope-index + server-evidence + 双端 run-status
//      + analysis-history（audioRunId 递增依据）；
//   2. 逐原子派生 pending（从 run-status，唯一事实源；禁止从缺证据/缺条目猜测）；
//   3. 分析路径三分（§1）：
//      - conflict-fast：任一**已完成端**（pending=false）entry.directConflict=true → 进 S7 冲突分析，
//        不被另一必要端 pending 阻塞（原则 7 / D15）；
//      - blocked：无已完成端冲突信号，且必要端（verificationScope 声明的端）任一 pending；
//      - full：无冲突信号且必要端全部完成；非必要端 pending 不阻塞（只记录）；
//   4. 升级识别（D25 确定性判定式）：
//      upgraded = 上轮 analysisPath==conflict-fast ∧ 本轮 full ∧ 上轮 baselineDifference==conflict；
//      previousRunId 逐原子解析自 analysis-history **该原子自己的最近记录**（禁止跨原子取值）；
//      同一 analysisRunId 重放不重复识别（幂等）；prev 字段按「上轮记录」两段式装配
//      （I12：resume 重放时排除盘上既有轮自引用，真实新轮按全量 history）；
//   5. analysisRunId 生成：ar-<date>-<seq>，seq = history.runs.length + 1（单调递增）；
//      resume 幂等（I12）：计算内容与盘上 unified-atoms 完全一致（除 id 外）时**复用盘上 id**——
//      journal-resume 时本命令重跑而 S7 分片仅重放（产物未变），递增 id 会作废分片记录的 id，
//      致 S7 重算闸门 analysisRunId 一致性检查全量失败。
//
// 产物：<runDir>/4-analysis/unified-atoms.json
//
// 可导入：export mergeEvidence({ runDir, date })
//   返回 { ok, problems, summary, unifiedAtoms }
//
// CLI：node merge-evidence.mjs --run-dir <dir> --date <YYYY-MM-DD>
//   退出码：0 成功 / 1 失败（明细 [失败] 前缀，不写产物）
// ============================================================

import fs from 'node:fs'
import path from 'node:path'

const SCOPES = ['client', 'server', 'both']

function readJsonSafe(p) {
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(p, 'utf8')) }
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) }
  }
}

const toPosix = (p) => String(p).replaceAll('\\', '/')

// run-status 派生 pending：原子所属分片 status != completed 即该端 pending
function pendingSetOf(runStatus) {
  const set = new Set()
  if (!runStatus || !Array.isArray(runStatus.parts)) return set
  for (const p of runStatus.parts) {
    if (!p || p.status === 'completed') continue
    for (const id of p.atomIds || []) set.add(id)
  }
  return set
}

export function mergeEvidence(input) {
  const problems = []
  const bad = (m) => problems.push(m)
  const I = input || {}
  const runDir = I.runDir
  const date = String(I.date || '')

  if (!runDir) bad('runDir 缺失')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) bad('date 非法（YYYY-MM-DD）：' + date)
  if (problems.length > 0) return { ok: false, problems, summary: null }

  const readOrBad = (rel, label) => {
    const r = readJsonSafe(path.join(runDir, rel))
    if (!r.ok) {
      bad(label + ' 不可读：' + rel + ' -> ' + r.error)
      return null
    }
    return r.data
  }

  const registry = readOrBad('1-registry/requirement-registry.json', 'Registry')
  const clientEv = readOrBad('2-client/client-evidence.json', 'client-evidence')
  const scopeIndex = readOrBad('3-server/scope-index.json', 'scope-index')
  const serverEv = readOrBad('3-server/server-evidence.json', 'server-evidence')
  const clientRs = readOrBad('2-client/runtime/run-status.json', 'client run-status')
  const serverRs = readOrBad('3-server/runtime/run-status.json', 'server run-status')
  const historyRead = readJsonSafe(path.join(runDir, '4-analysis/analysis-history.json'))
  const history = historyRead.ok && Array.isArray(historyRead.data.runs) ? historyRead.data.runs : []
  if (problems.length > 0) return { ok: false, problems, summary: null }

  if (!Array.isArray(registry.features)) bad('Registry 结构非法（features 非数组）')

  // ---- 证据与条目索引 ----
  const cleById = new Map()
  for (const e of clientEv.evidence || []) {
    if (!e || !e.id) {
      bad('client-evidence 存在无 id 证据条目')
      continue
    }
    cleById.set(e.id, e)
  }
  const sveById = new Map()
  for (const e of serverEv.evidence || []) {
    if (!e || !e.id) {
      bad('server-evidence 存在无 id 证据条目')
      continue
    }
    sveById.set(e.id, e)
  }
  const clientEntryByAtom = new Map((clientEv.entries || []).map((e) => [e.atomId, e]))
  const scopeByAtom = new Map((scopeIndex.entries || []).map((e) => [e.atomId, e]))

  // 条目重复校验（每原子至多一条）
  if (clientEntryByAtom.size !== (clientEv.entries || []).length) bad('client-evidence 条目 atomId 重复')
  if (scopeByAtom.size !== (scopeIndex.entries || []).length) bad('scope-index 条目 atomId 重复')

  // ---- pending 派生（run-status，唯一事实源） ----
  const clientPending = pendingSetOf(clientRs)
  const serverPending = pendingSetOf(serverRs)
  if (!clientRs.parts || clientRs.parts.length === 0) bad('client run-status 无 parts（S4 未执行？）')
  if (!serverRs.parts || serverRs.parts.length === 0) bad('server run-status 无 parts（S5 未执行？）')

  // ---- 既有 unified-atoms（I12 resume 幂等：id 复用判定 + 上轮自引用两段式排除） ----
  const existingUaRead = readJsonSafe(path.join(runDir, '4-analysis', 'unified-atoms.json'))
  const existingUa = existingUaRead.ok && existingUaRead.data && typeof existingUaRead.data.analysisRunId === 'string' ? existingUaRead.data : null
  const existingId = existingUa ? existingUa.analysisRunId : ''
  // 既有 id 已入 history（S6+S7 完整轮已闭环）→ 若本轮为该轮重放（内容一致），
  // 「上轮」应为再前一轮（排除自引用）；若为真实新轮则盘上轮才是上轮（两段式判定见后）
  const existingInHistory = existingId ? history.some((r) => r.analysisRunId === existingId) : false

  // ---- 逐原子装配 ----
  const atoms = []
  const stats = {
    atomCount: 0, conflictFast: 0, full: 0, blocked: 0, upgraded: 0,
    clientPending: 0, serverPending: 0,
    dualLocated: 0, clientOnly: 0, serverOnly: 0, neither: 0,
  }

  for (const f of registry.features) {
    for (const a of f.atoms || []) {
      const atomId = a.atomId
      const scope = a.verificationScope
      if (!SCOPES.includes(scope)) bad('Registry verificationScope 非法（S3 应已拦截）：' + atomId + ' = ' + scope)

      const cEntry = clientEntryByAtom.get(atomId)
      const sEntry = scopeByAtom.get(atomId)
      const cPending = clientPending.has(atomId)
      const sPending = serverPending.has(atomId)

      // 派生字段一致性：pending 端不得有条目
      if (cPending && cEntry) bad('client pending 但存在 entry（run-status 与条目矛盾）：' + atomId)
      if (sPending && sEntry) bad('server pending 但存在 scope entry（矛盾）：' + atomId)

      // 证据引用存在性与引用一致性
      const checkRefs = (ids, side, ownerAtomId) => {
        const map = side === 'client' ? cleById : sveById
        for (const id of ids || []) {
          const ev = map.get(id)
          if (!ev) bad(side + ' 引用不存在的证据：' + ownerAtomId + ' -> ' + id)
          else if (!(ev.atomIds || []).includes(ownerAtomId)) {
            bad(side + ' 引用一致性失败（证据 atomIds 不含引用方）：' + ownerAtomId + ' -> ' + id)
          }
        }
      }
      if (cEntry) {
        checkRefs(cEntry.evidenceIds, 'client', atomId)
        checkRefs(cEntry.conflictEvidenceIds, 'client', atomId)
      }
      if (sEntry) {
        checkRefs(sEntry.evidenceIds, 'server', atomId)
        checkRefs(sEntry.conflictEvidenceIds, 'server', atomId)
      }

      const clientObj = {
        verdict: cEntry ? cEntry.verdict : '',
        evidenceIds: cEntry ? cEntry.evidenceIds || [] : [],
        observedBehavior: cEntry ? cEntry.observedBehavior || {} : {},
        directConflict: cEntry ? cEntry.directConflict === true : false,
        conflictEvidenceIds: cEntry ? cEntry.conflictEvidenceIds || [] : [],
        pending: cPending,
      }
      const serverObj = {
        applicability: sEntry ? sEntry.applicability : '',
        evidenceIds: sEntry ? sEntry.evidenceIds || [] : [],
        configCondition: sEntry ? sEntry.configCondition || '' : '',
        directConflict: sEntry ? sEntry.directConflict === true : false,
        conflictEvidenceIds: sEntry ? sEntry.conflictEvidenceIds || [] : [],
        pending: sPending,
      }

      // ---- 分析路径三分（§1 / D15） ----
      const clientDone = !cPending
      const serverDone = !sPending
      // 1. conflict-fast：任一已完成端有直接冲突信号（pending 端不参与判定）
      const conflictSignal = (clientDone && clientObj.directConflict) || (serverDone && serverObj.directConflict)
      // 2. 必要端 pending（verificationScope 声明）
      const needClient = scope === 'client' || scope === 'both'
      const needServer = scope === 'server' || scope === 'both'
      const blockingPending = (needClient && cPending) || (needServer && sPending)

      let analysisPath
      if (conflictSignal) analysisPath = 'conflict-fast'
      else if (blockingPending) analysisPath = 'blocked'
      else analysisPath = 'full'

      // 升级识别（D25）延后到两段式装配（prev 字段依赖上轮记录口径，见 finalizePrev）

      atoms.push({
        atomId: atomId,
        requirement: {
          rule: a.rule,
          uiRequirement: a.uiRequirement,
          source: a.source,
          verificationScope: scope,
          businessBehavior: a.businessBehavior,
        },
        client: clientObj,
        server: serverObj,
        analysisPath: analysisPath,
        previousRunId: '',
        baselineDifference: '',
        upgraded: false,
      })

      stats.atomCount++
      if (analysisPath === 'conflict-fast') stats.conflictFast++
      else if (analysisPath === 'full') stats.full++
      else stats.blocked++
      if (cPending) stats.clientPending++
      if (sPending) stats.serverPending++
      const cl = !!cEntry
      const sl = !!sEntry
      if (cl && sl) stats.dualLocated++
      else if (cl) stats.clientOnly++
      else if (sl) stats.serverOnly++
      else stats.neither++
    }
  }

  if (problems.length > 0) return { ok: false, problems, summary: null }

  // ---- 升级识别装配（D25）+ analysisRunId（history 递增；I12 resume 幂等两段式） ----
  const buildLastRecord = (excludeRunId) => {
    // analysis-history runs[] 按追加顺序（旧→新）；取每原子最后一次出现的记录
    const m = new Map()
    for (const run of history) {
      if (excludeRunId && run.analysisRunId === excludeRunId) continue
      for (const s of run.atomSummaries || []) {
        if (!s || !s.atomId) continue
        m.set(s.atomId, {
          analysisRunId: run.analysisRunId,
          analysisPath: s.analysisPath,
          baselineDifference: s.baselineDifference,
          candidateDifference: s.candidateDifference || '',
          evidenceIds: s.evidenceIds || [],
        })
      }
    }
    return m
  }
  const contentSig = (u) => JSON.stringify({ schemaVersion: u.schemaVersion, date: u.date, atoms: u.atoms, stats: u.stats })
  // prev 字段（previousRunId/upgraded/stats.upgraded）按上轮记录装配，可重算（两段式）
  const finalizePrev = (lastRecord) => {
    let up = 0
    for (const at of atoms) {
      const prev = lastRecord.get(at.atomId)
      const isUp = !!prev && prev.analysisPath === 'conflict-fast' && at.analysisPath === 'full' && prev.baselineDifference === 'conflict'
      at.previousRunId = isUp ? prev.analysisRunId : ''
      at.upgraded = isUp
      if (isUp) up++
    }
    stats.upgraded = up
    return contentSig({ schemaVersion: 1, date: date, atoms: atoms, stats: stats })
  }

  // I12 两段式：先按 resume 假设（盘上既有轮已闭环，本轮为其重放 → 排除该轮自引用）
  // 装配 prev 字段——sig 与盘上 unified-atoms 一致即复用其 id（journal-resume 时命令
  // 重跑而 S7 分片仅重放，递增 id 会作废分片记录的 id，致 S7 重算闸门全量失败）；
  // 不一致则为真实新轮 → 按全量 history（盘上轮才是真正的上轮）重新装配，取递增 id
  const seq = history.length + 1
  const candidateId = 'ar-' + date + '-' + String(seq).padStart(3, '0')
  const sigResume = finalizePrev(buildLastRecord(existingInHistory ? existingId : ''))
  let analysisRunId = ''
  if (existingUa && existingId.startsWith('ar-' + date + '-') && sigResume === contentSig(existingUa)) {
    analysisRunId = existingId
  } else {
    if (existingInHistory) finalizePrev(buildLastRecord('')) // 真实新轮：全量上轮装配
    analysisRunId = candidateId
    if (history.some((r) => r.analysisRunId === candidateId)) {
      bad('analysisRunId 重复（history 已存在同 id）：' + candidateId)
      return { ok: false, problems, summary: null }
    }
  }

  const unifiedAtoms = {
    schemaVersion: 1,
    date: date,
    analysisRunId: analysisRunId,
    atoms: atoms,
    stats: stats,
  }
  return { ok: true, problems: [], summary: { analysisRunId, stats }, unifiedAtoms }
}

// ============================================================
// CLI
// ============================================================

function main() {
  const argv = process.argv.slice(2)
  const a = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--run-dir') a.runDir = argv[++i]
    else if (argv[i] === '--date') a.date = argv[++i]
  }
  if (!a.runDir || !a.date) {
    console.error('用法：node merge-evidence.mjs --run-dir <dir> --date <YYYY-MM-DD>')
    process.exit(1)
  }
  const r = mergeEvidence({ runDir: a.runDir, date: a.date })
  if (!r.ok) {
    console.log('[失败] S6 证据汇总未通过，共 ' + r.problems.length + ' 项问题（不写产物）：')
    for (const p of r.problems) console.log('  - ' + p)
    process.exit(1)
  }
  const outPath = path.join(a.runDir, '4-analysis', 'unified-atoms.json')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(r.unifiedAtoms, null, 1) + '\n', 'utf8')
  const s = r.summary.stats
  console.log(
    '[成功] S6 证据汇总：' + r.summary.analysisRunId + ' / 原子 ' + s.atomCount +
      '（conflict-fast ' + s.conflictFast + ' / full ' + s.full + ' / blocked ' + s.blocked +
      '；升级 ' + s.upgraded + '；pending client ' + s.clientPending + ' / server ' + s.serverPending +
      '；双端定位 ' + s.dualLocated + ' / 仅客户端 ' + s.clientOnly + ' / 仅服务端 ' + s.serverOnly + ' / 均未 ' + s.neither + '）' +
      ' -> ' + toPosix(outPath)
  )
  process.exit(0)
}

if (process.argv[1] && toPosix(process.argv[1]).endsWith('merge-evidence.mjs')) main()
