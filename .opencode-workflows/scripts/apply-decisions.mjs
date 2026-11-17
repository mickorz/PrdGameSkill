// ============================================================
// apply-decisions.mjs —— S11 人工裁决：决议落盘 + 影响集合计算 + 补证输入准备
//
// 执行文档 §5 S11、§8 D12/D20/D24、§16。
//
// 职责（确定性）：
//   1. 校验 decisions.json（action/target/retryScope/modifiedValue 齐全、atomId 属 Registry）；
//   2. 应用审批动作到 difference-review（approve/modify → approved；reject → rejected；hold → 保持 pending）；
//   3. **影响集合计算**（D20/D24，retryScope 端级补证）：
//      ① 补证目标原子集合 T（retryScope 覆盖的原子）；
//      ② 定位本轮更新/新增的 CLE/SVE（同 id 摘录或指针变化）；
//      ③ 反查被更新证据的 atomIds（支撑原子全列，含非补证目标原子）；
//      ④ 影响集合 = T ∪ 反查集合；
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

  // ---- 逐决议校验 + 应用 ----
  const seen = new Set()
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

  // ---- 影响集合计算（D20/D24） ----
  // 本轮"更新/新增"的 CLE/SVE：以 re-verify 目标原子的证据为起点，
  // 并反查这些证据的 atomIds（共享证据牵连）
  const impact = { client: new Set(), server: new Set() }
  const sharedEvidence = []
  const collect = (side, targets) => {
    const map = side === 'client' ? cleById : sveById
    const uaSideKey = side
    for (const atomId of targets) {
      const uaAtom = uaByAtom.get(atomId)
      const ids = (uaAtom && uaAtom[uaSideKey] && uaAtom[uaSideKey].evidenceIds) || []
      // 即使无证据，目标原子本身计入影响集合
      impact[side].add(atomId)
      for (const id of ids) {
        const ev = map.get(id)
        if (!ev) continue
        for (const ownerAtomId of ev.atomIds || []) {
          if (!atomIds.has(ownerAtomId)) continue
          if (!impact[side].has(ownerAtomId)) {
            impact[side].add(ownerAtomId)
            sharedEvidence.push({ side, evidenceId: id, atomId: ownerAtomId, reason: '共享证据牵连（atomIds 反查）' })
          }
        }
      }
    }
  }
  collect('client', retryTargets.client)
  collect('server', retryTargets.server)

  const impactSet = {
    schemaVersion: 1,
    date: date,
    analysisRunId: dr.analysisRunId || '',
    retryScopeTargets: { client: [...retryTargets.client].sort(), server: [...retryTargets.server].sort() },
    impactSet: { client: [...impact.client].sort(), server: [...impact.server].sort() },
    sharedEvidence: sharedEvidence,
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
      sharedEvidenceCount: sharedEvidence.length,
      approvedCount: approvedCount,
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
      '（共享证据牵连 ' + s.sharedEvidenceCount + '）/ 补证分片 ' + shardCount +
      ' -> ' + toPosix(reviewDir)
  )
  process.exit(0)
}

if (process.argv[1] && toPosix(process.argv[1]).endsWith('apply-decisions.mjs')) main()
