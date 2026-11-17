// ============================================================
// apply-decisions.mjs —— S11 人工裁决：决议落盘 + 影响集合计算 + 补证输入准备
//
// 执行文档 §5 S11、§8 D12/D20/D24、§16。
//
// 职责（确定性）：
//   1. 校验 decisions.json（action/target/retryScope/modifiedValue 齐全、atomId 属 Registry）；
//   2. 应用审批动作到 difference-review（approve/modify → approved；reject → rejected；hold → 保持 pending）；
//   3. **影响集合计算**（D20/D24，retryScope 端级补证；评审 P1-2 整改）：
//      ① 补证目标原子集合 T（retryScope 覆盖的原子）；
//      ② **新旧证据 diff**：对比 previousEvidenceIndex（上轮证据快照）与当前 CLE/SVE，
//         检出 changed（contentHash/location/claimKey/dependencyFiles/excerpt 变）、
//         added（新增）、removed（被移除）；
//      ③ 反查变更证据的 atomIds：**old.atomIds ∪ new.atomIds**（移除证据只存在于旧索引，
//         只取新索引会漏掉受影响原子）；
//      ④ 影响集合 = T ∪ 反查集合；
//   3b. **决议适用性门**（§11.8/D33，评审 P0-2 整改）：stale/orphan 决议不应用，
//       输出到待重新确认清单（不自动沿用、不自动批准）；
//   4. 产出 6-review/runtime/retry-input/ 补证分片（端级 + retryHint 前轮缺口）+ impact-set.json；
//   5. approved 合并索引（v3 模式）：approved 条目确定性合并，pending/rejected 不入正式结论。
//
// 产物：<runDir>/6-review/{decisions.json, runtime/impact-set.json, runtime/retry-input/*}
//
// 可导入：export applyDecisions({ runDir, date })
//   返回 { ok, problems, summary }
//
// CLI：node apply-decisions.mjs --run-dir <dir> --date <YYYY-MM-DD> [--decisions <path>]
//   退出码：0 成功 / 1 失败
// ============================================================

import fs from 'node:fs'
import path from 'node:path'
import { checkDecisionApplicability } from './decision-fingerprint.mjs'

const ACTIONS = ['approve', 'modify', 'reject', 'hold', 're-verify']
const TARGETS = ['difference-review', 'l7', 'pending']
const SCOPES = ['client', 'server', 'both']

const toPosix = (p) => String(p).replaceAll('\\', '/')
function readJsonSafe(p) {
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(p, 'utf8')) }
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) }
  }
}

export function applyDecisions(input) {
  const problems = []
  const bad = (m) => problems.push(m)
  const I = input || {}
  const runDir = I.runDir
  const date = String(I.date || '')
  if (!runDir) bad('runDir 缺失')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) bad('date 非法：' + date)
  if (problems.length > 0) return { ok: false, problems, summary: null }

  const decisionsPath = I.decisionsPath || path.join(runDir, '6-review', 'decisions.json')
  const dRead = readJsonSafe(decisionsPath)
  if (!dRead.ok) {
    bad('decisions.json 不可读：' + decisionsPath + ' -> ' + dRead.error)
    return { ok: false, problems, summary: null }
  }
  const decisions = Array.isArray(dRead.data.decisions) ? dRead.data.decisions : []

  const registry = readJsonSafe(path.join(runDir, '1-registry', 'requirement-registry.json'))
  if (!registry.ok) {
    bad('Registry 不可读：' + registry.error)
    return { ok: false, problems, summary: null }
  }
  const atomIds = new Set()
  for (const f of registry.data.features || []) for (const a of f.atoms || []) atomIds.add(a.atomId)

  const drRead = readJsonSafe(path.join(runDir, '4-analysis', 'difference-review.json'))
  const dr = drRead.ok ? drRead.data : { schemaVersion: 2, analysisRunId: '', entries: [] }
  const drByAtom = new Map((dr.entries || []).map((e) => [e.atomId, e]))

  const cleRead = readJsonSafe(path.join(runDir, '2-client', 'client-evidence.json'))
  const sveRead = readJsonSafe(path.join(runDir, '3-server', 'server-evidence.json'))
  const cleById = new Map(((cleRead.ok && cleRead.data.evidence) || []).map((e) => [e.id, e]))
  const sveById = new Map(((sveRead.ok && sveRead.data.evidence) || []).map((e) => [e.id, e]))
  const uaRead = readJsonSafe(path.join(runDir, '4-analysis', 'unified-atoms.json'))
  const uaByAtom = new Map((((uaRead.ok && uaRead.data.atoms) || [])).map((a) => [a.atomId, a]))

  // ---- 决议适用性门（§11.8 / D33，评审 P0-2）：stale/orphan 决议不应用 ----
  // 同 run 内刚 bind 的决议指纹一致 → valid；跨 run 证据或结论变化 → stale（须重新人工确认）
  const applicability = checkDecisionApplicability({ runDir })
  if (!applicability.ok) {
    bad('决议适用性检查失败（不静默跳过审批保护）：' + applicability.problems.join('；'))
  }
  const blockedDecisions = new Map() // atomId -> { status, reason }
  if (applicability.applicability) {
    for (const it of applicability.applicability.items) {
      if (it.status === 'stale' || it.status === 'orphan') blockedDecisions.set(it.atomId, { status: it.status, reason: it.reason })
    }
  }

  // ---- 逐决议校验 + 应用 ----
  const seen = new Set()
  const skippedStale = []
  const applyLog = []
  const retryTargets = { client: new Set(), server: new Set() }

  for (const d of decisions) {
    const atomId = String(d && d.atomId || '')
    const action = String(d && d.action || '')
    const target = String(d && d.target || '')
    if (!atomIds.has(atomId)) {
      bad('决议 atomId 不在 Registry：' + atomId)
      continue
    }
    if (!ACTIONS.includes(action)) {
      bad('决议 action 非法：' + atomId + ' = ' + JSON.stringify(action))
      continue
    }
    if (!TARGETS.includes(target)) {
      bad('决议 target 非法：' + atomId + ' = ' + JSON.stringify(target))
      continue
    }
    const blocked = blockedDecisions.get(atomId)
    if (blocked && action !== 're-verify' && action !== 'hold') {
      // 证据/结论已变：审批不得自动沿用（不应用、不静默丢弃，输出到待重新确认清单）
      skippedStale.push({ atomId: atomId, action: action, target: target, status: blocked.status, reason: blocked.reason })
      applyLog.push({ atomId: atomId, action: action, target: target, applied: 'SKIPPED-STALE（' + blocked.status + '：' + blocked.reason + '）' })
      continue
    }
    const key = atomId + '\u0000' + action + '\u0000' + target
    if (seen.has(key)) {
      bad('决议重复（同原子同动作同目标）：' + atomId + ' ' + action + ' ' + target)
      continue
    }
    seen.add(key)

    if (action === 're-verify') {
      const scope = String(d.retryScope || '')
      if (!SCOPES.includes(scope)) {
        bad('action=re-verify 需合法 retryScope（client|server|both）：' + atomId + ' = ' + JSON.stringify(d.retryScope))
        continue
      }
      // retryScope 与原子必要端一致性（§5 S11 闸门）
      const uaAtom = uaByAtom.get(atomId)
      const reqScope = uaAtom && uaAtom.requirement ? uaAtom.requirement.verificationScope : null
      if (reqScope === 'client' && scope === 'server') {
        bad('retryScope=server 与需求验证范围（client）矛盾：' + atomId)
        continue
      }
      if (reqScope === 'server' && scope === 'client') {
        bad('retryScope=client 与需求验证范围（server）矛盾：' + atomId)
        continue
      }
      if (scope === 'client' || scope === 'both') retryTargets.client.add(atomId)
      if (scope === 'server' || scope === 'both') retryTargets.server.add(atomId)
    }

    if (action === 'modify' && !String(d.modifiedValue || '').trim()) {
      bad('action=modify 需 modifiedValue（人工改写结论）：' + atomId)
      continue
    }

    // ---- 应用到 difference-review（approve/modify/reject；hold 保持 pending） ----
    if (target === 'difference-review') {
      const entry = drByAtom.get(atomId)
      if (!entry) {
        bad('target=difference-review 但该原子无复核条目（先跑 S8）：' + atomId)
        continue
      }
      if (action === 'approve') {
        entry.reviewStatus = 'approved'
        applyLog.push({ atomId, action, target, applied: 'reviewStatus=approved' })
      } else if (action === 'modify') {
        const mv = String(d.modifiedValue)
        if (!['consistent', 'partial', 'conflict', 'unverified'].includes(mv)) {
          bad('modify 的 modifiedValue 必须是差异枚举：' + atomId + ' = ' + mv)
          continue
        }
        entry.reviewStatus = 'approved'
        entry.reviewedDifference = mv
        entry.reviewReason = String(entry.reviewReason || '') + '（人工改写：' + String(d.reason || '') + '）'
        applyLog.push({ atomId, action, target, applied: 'reviewStatus=approved, reviewedDifference=' + mv })
      } else if (action === 'reject') {
        entry.reviewStatus = 'rejected'
        applyLog.push({ atomId, action, target, applied: 'reviewStatus=rejected（effective 回退历史基线）' })
      } else if (action === 'hold') {
        entry.reviewStatus = 'pending'
        applyLog.push({ atomId, action, target, applied: 'reviewStatus=pending（挂起，不生效）' })
      }
    } else {
      applyLog.push({ atomId, action, target, applied: '仅记录（target=' + target + '）' })
    }
  }

  if (problems.length > 0) return { ok: false, problems, summary: null }

  // ---- 影响集合计算（D20/D24 + 评审 P1-2：新旧证据 diff） ----
  // previousEvidenceIndex：上轮证据快照（由 record-evidence-snapshot 或上任 S11 写入）。
  // 缺失时退化为「当前证据全量视为已知」（不报错，但 affected 会偏小，summary 标注 degraded）。
  const prevIdxRead = readJsonSafe(path.join(runDir, '6-review', 'runtime', 'previous-evidence-index.json'))
  const prevIdx = prevIdxRead.ok ? prevIdxRead.data : null
  const degraded = !prevIdx

  const snapshotOf = (side) => {
    const map = side === 'client' ? cleById : sveById
    const out = new Map()
    for (const [id, ev] of map) {
      out.set(id, {
        id,
        mergeKey: [ev.repoId || '', ev.file || '', ev.location || '', ev.symbol || '', ev.claimKey || ''].join(String.fromCharCode(0)),
        contentHash: String(ev.contentHash || ''),
        location: String(ev.location || ''),
        claimKey: String(ev.claimKey || ''),
        excerpt: String(ev.excerpt || ''),
        dependencyFiles: JSON.stringify((ev.dependencyFiles || []).map((d) => [String(d.file || ''), String(d.contentHash || '')])),
        atomIds: Array.isArray(ev.atomIds) ? [...ev.atomIds].sort() : [],
      })
    }
    return out
  }
  const diffSide = (side) => {
    const cur = snapshotOf(side)
    const prev = new Map()
    if (prevIdx && prevIdx[side] && Array.isArray(prevIdx[side].evidence)) {
      for (const e of prevIdx[side].evidence) prev.set(e.id, e)
    }
    const changed = []
    const added = []
    const removed = []
    for (const [id, c] of cur) {
      const p = prev.get(id)
      if (!p) {
        added.push({ id, atomIds: c.atomIds, reason: '本轮新增证据' })
        continue
      }
      const fields = ['mergeKey', 'contentHash', 'location', 'claimKey', 'excerpt', 'dependencyFiles']
      const diff = fields.filter((f) => String(p[f] === undefined ? '' : p[f]) !== String(c[f]))
      const atomIdsChanged = JSON.stringify(p.atomIds || []) !== JSON.stringify(c.atomIds)
      if (diff.length > 0 || atomIdsChanged) {
        changed.push({
          id,
          atomIdsOld: p.atomIds || [],
          atomIdsNew: c.atomIds,
          changedFields: diff.concat(atomIdsChanged ? ['atomIds'] : []),
          reason: '证据内容/指针/引用集合变化',
        })
      }
    }
    for (const [id, p] of prev) {
      if (!cur.has(id)) removed.push({ id, atomIds: p.atomIds || [], reason: '本轮证据被移除' })
    }
    return { changed, added, removed }
  }

  const diffs = { client: diffSide('client'), server: diffSide('server') }

  const impact = { client: new Set(), server: new Set() }
  const affectedEvidence = []
  const collect = (side, targets) => {
    for (const atomId of targets) impact[side].add(atomId) // 目标原子本身必在影响集合
    const addAtoms = (ids, ref, reason) => {
      for (const atomId of ids) {
        if (!atomIds.has(atomId)) continue
        if (!impact[side].has(atomId)) impact[side].add(atomId)
        affectedEvidence.push({ side, evidenceId: ref, atomId, reason })
      }
    }
    for (const c of diffs[side].changed) addAtoms([].concat(c.atomIdsOld, c.atomIdsNew), c.id, '变更证据牵连（old ∪ new atomIds）')
    for (const a of diffs[side].added) addAtoms(a.atomIds, a.id, '新增证据牵连')
    for (const r of diffs[side].removed) addAtoms(r.atomIds, r.id, '移除证据牵连（仅旧索引有 atomIds）')
  }
  collect('client', retryTargets.client)
  collect('server', retryTargets.server)

  const impactSet = {
    schemaVersion: 2,
    date: date,
    analysisRunId: dr.analysisRunId || '',
    retryScopeTargets: { client: [...retryTargets.client].sort(), server: [...retryTargets.server].sort() },
    evidenceDiff: {
      degraded,
      degradedReason: degraded ? 'previous-evidence-index.json 缺失：影响集合退化为「仅目标原子 + 当前引用」，可能偏小' : '',
      client: diffs.client,
      server: diffs.server,
    },
    affectedEvidence: affectedEvidence,
    impactSet: { client: [...impact.client].sort(), server: [...impact.server].sort() },
    rerunStages: ['S6', 'S7', 'S8', 'S9', 'S10'],
    note: 'S6~S9 对影响集合重算（新一轮 analysisRunId）；S10 只重生成影响集合覆盖的阶段文档/索引/策划版分片',
  }

  const approvedCount = (dr.entries || []).filter((e) => e.reviewStatus === 'approved').length
  return {
    ok: true,
    problems: [],
    summary: {
      decisionCount: decisions.length,
      applyLog: applyLog,
      retryScopeTargets: impactSet.retryScopeTargets,
      impactSet: impactSet.impactSet,
      sharedEvidenceCount: affectedEvidence.length,
      affectedEvidenceCount: affectedEvidence.length,
      evidenceDiff: { client: { changed: diffs.client.changed.length, added: diffs.client.added.length, removed: diffs.client.removed.length }, server: { changed: diffs.server.changed.length, added: diffs.server.added.length, removed: diffs.server.removed.length }, degraded },
      approvedCount: approvedCount,
      skippedStale: skippedStale,
      requiresReconfirm: skippedStale.length,
      applicability: applicability.applicability,
    },
    differenceReview: dr,
    impactSet: impactSet,
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
    else if (argv[i] === '--date') a.date = argv[++i]
    else if (argv[i] === '--decisions') a.decisionsPath = argv[++i]
  }
  if (!a.runDir || !a.date) {
    console.error('用法：node apply-decisions.mjs --run-dir <dir> --date <YYYY-MM-DD> [--decisions <path>]')
    process.exit(1)
  }
  const r = applyDecisions({ runDir: a.runDir, date: a.date, decisionsPath: a.decisionsPath })
  if (!r.ok) {
    console.log('[失败] S11 决议应用未通过，共 ' + r.problems.length + ' 项问题（不写产物）：')
    for (const p of r.problems) console.log('  - ' + p)
    process.exit(1)
  }
  // 回写 difference-review（审批状态生效）
  if (r.differenceReview.entries) {
    const drPath = path.join(a.runDir, '4-analysis', 'difference-review.json')
    fs.mkdirSync(path.dirname(drPath), { recursive: true })
    fs.writeFileSync(drPath, JSON.stringify(r.differenceReview, null, 1) + '\n', 'utf8')
  }
  // 影响集合 + 补证分片
  const reviewDir = path.join(a.runDir, '6-review')
  const retryDir = path.join(reviewDir, 'runtime', 'retry-input')
  fs.mkdirSync(retryDir, { recursive: true })
  fs.writeFileSync(path.join(reviewDir, 'runtime', 'impact-set.json'), JSON.stringify(r.impactSet, null, 1) + '\n', 'utf8')
  // 当前证据快照 → 下一轮 S11 的 diff 基线（评审 P1-2：让「新旧证据对比」真正成立）
  const cleNow = readJsonSafe(path.join(a.runDir, '2-client', 'client-evidence.json'))
  const sveNow = readJsonSafe(path.join(a.runDir, '3-server', 'server-evidence.json'))
  const snapOf = (doc) => {
    const ev = (doc && doc.evidence) || []
    return {
      evidence: ev.map((e) => ({
        id: e.id,
        mergeKey: [e.repoId || '', e.file || '', e.location || '', e.symbol || '', e.claimKey || ''].join(String.fromCharCode(0)),
        contentHash: String(e.contentHash || ''),
        location: String(e.location || ''),
        claimKey: String(e.claimKey || ''),
        excerpt: String(e.excerpt || ''),
        dependencyFiles: JSON.stringify((e.dependencyFiles || []).map((d) => [String(d.file || ''), String(d.contentHash || '')])),
        atomIds: Array.isArray(e.atomIds) ? [...e.atomIds].sort() : [],
      })),
    }
  }
  const prevSnap = {
    schemaVersion: 1,
    analysisRunId: r.impactSet.analysisRunId,
    date: a.date,
    client: snapOf(cleNow.ok ? cleNow.data : null),
    server: snapOf(sveNow.ok ? sveNow.data : null),
  }
  fs.writeFileSync(path.join(reviewDir, 'runtime', 'previous-evidence-index.json'), JSON.stringify(prevSnap, null, 1) + '\n', 'utf8')
  // 决议适用性清单落盘（须重新人工确认的条目）
  if (r.summary.applicability) {
    fs.writeFileSync(path.join(reviewDir, 'runtime', 'decision-applicability.json'), JSON.stringify(r.summary.applicability, null, 1) + '\n', 'utf8')
  }

  // 补证分片：按端、按阶段分组（客户端 -rc，服务端 -rp，代际隔离）
  const uaRead = readJsonSafe(path.join(a.runDir, '4-analysis', 'unified-atoms.json'))
  const registryRead = readJsonSafe(path.join(a.runDir, '1-registry', 'requirement-registry.json'))
  const atomToStage = new Map()
  if (registryRead.ok) {
    for (const f of registryRead.data.features || []) for (const at of f.atoms || []) atomToStage.set(at.atomId, f.stageId)
  }
  const uaByAtom = new Map((((uaRead.ok && uaRead.data.atoms) || [])).map((x) => [x.atomId, x]))
  let shardCount = 0
  for (const side of ['client', 'server']) {
    const ids = r.impactSet.impactSet[side]
    if (ids.length === 0) continue
    const byStage = new Map()
    for (const id of ids) {
      const st = atomToStage.get(id) || 'ST-C00'
      if (!byStage.has(st)) byStage.set(st, [])
      byStage.get(st).push(id)
    }
    for (const [stageId, stageAtomIds] of [...byStage.entries()].sort()) {
      const suffix = side === 'client' ? '-rc' : '-rp'
      const file = stageId + suffix + '01.json'
      const atoms = stageAtomIds.map((id) => {
        const ua = uaByAtom.get(id)
        const isTarget = (side === 'client' ? r.impactSet.retryScopeTargets.client : r.impactSet.retryScopeTargets.server).includes(id)
        return {
          atomId: id,
          isRetryTarget: isTarget,
          retryHint: isTarget
            ? '前轮缺口：' + (side === 'client'
              ? 'verdict=' + ((ua && ua.client.verdict) || '') 
              : 'applicability=' + ((ua && ua.server.applicability) || ''))
            : '共享证据牵连（非补证目标，证据更新后需复核）',
          requirement: ua ? ua.requirement : null,
        }
      })
      const doc = {
        schemaVersion: 1, generatedBy: 'apply-decisions.mjs', date: a.date, branch: side,
        stageId: stageId, partNo: '01', atomCount: atoms.length, atoms: atoms,
      }
      fs.writeFileSync(path.join(retryDir, file), JSON.stringify(doc, null, 1) + '\n', 'utf8')
      shardCount++
    }
  }

  const s = r.summary
  console.log(
    '[成功] S11 决议应用：决议 ' + s.decisionCount + ' 条（approved 条目 ' + s.approvedCount + '）' +
      ' / 补证目标 client ' + s.retryScopeTargets.client.length + ' / server ' + s.retryScopeTargets.server.length +
      ' / 影响集合 client ' + s.impactSet.client.length + ' / server ' + s.impactSet.server.length +
      '（证据 diff：client 改' + s.evidenceDiff.client.changed + '/增' + s.evidenceDiff.client.added + '/删' + s.evidenceDiff.client.removed +
      ' server 改' + s.evidenceDiff.server.changed + '/增' + s.evidenceDiff.server.added + '/删' + s.evidenceDiff.server.removed +
      (s.evidenceDiff.degraded ? '（降级：无上轮证据快照）' : '') + '；受影响引用 ' + s.affectedEvidenceCount + '）/ 补证分片 ' + shardCount +
      ' -> ' + toPosix(reviewDir)
  )
  if (r.summary.requiresReconfirm > 0) {
    console.log('  [须重新人工确认] ' + r.summary.requiresReconfirm + ' 条决议因证据/结论变化被跳过（不自动沿用）：')
    for (const x of r.summary.skippedStale) console.log('    - ' + x.atomId + ' ' + x.action + '（' + x.status + '）：' + x.reason)
  }
  process.exit(0)
}

if (process.argv[1] && toPosix(process.argv[1]).endsWith('apply-decisions.mjs')) main()
