#!/usr/bin/env node
// rtm-merge.mjs —— 合并三维度 Checker 产物 → 统一 RTM 快照（v4 阶段 6，关系为中心）
// 输入：共享需求快照（REQ 实体唯一来源）+ Game run 产物 + UI 产物 + Bug 产物（三个维度均可选，至少一个）
// 输出：<outDir>/rtm.json + manifest.json（stats 可由 relations 明细重算，validate-rtm 校验）
// 用法：node rtm-merge.mjs <outDir> --requirements <snapshotDir> [--game <gameRunDir>] [--ui <uiOutDir>] [--bug <bugOutDir>] [--project-key hzmj]
import fs from 'node:fs'
import path from 'node:path'

const outDir = process.argv[2]
if (!outDir) { console.error('用法: node rtm-merge.mjs <outDir> --requirements <snapshotDir> [--game <dir>] [--ui <dir>] [--bug <dir>]'); process.exit(1) }
const argVal = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null }
const requirementsDir = argVal('--requirements')
const gameDir = argVal('--game')
const uiDir = argVal('--ui')
const bugDir = argVal('--bug')
const projectKey = argVal('--project-key') || 'hzmj'
if (!requirementsDir) { console.error('[失败] 必传 --requirements <snapshotDir>（REQ 实体唯一来源）'); process.exit(1) }
if (!gameDir && !uiDir && !bugDir) { console.error('[失败] 至少传一个维度：--game / --ui / --bug'); process.exit(1) }

const readJson = (p, label) => {
  if (!fs.existsSync(p)) { console.error('[失败] ' + label + ' 不存在: ' + p); process.exit(1) }
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch (e) { console.error('[失败] ' + label + ' 解析失败: ' + e.message); process.exit(1) }
}

// ---------- REQ 实体（唯一来源：共享快照） ----------
const snap = readJson(path.join(requirementsDir, 'requirements.json'), '共享快照 requirements.json')
const snapManifest = readJson(path.join(requirementsDir, 'manifest.json'), '共享快照 manifest.json')
const requirements = (Array.isArray(snap) ? snap : snap.requirements || []).map((s) => ({
  requirementId: s.requirementId,
  reqKey: s.reqKey,
  title: s.title,
  text: s.text || '',
  source: s.source || null,
})).filter((r) => r.requirementId && r.reqKey)
if (requirements.length === 0) { console.error('[失败] 共享快照无有效 REQ 条目'); process.exit(1) }

const relations = []
const rules = []
const issues = []
const bugs = []
const sources = { requirements: { path: requirementsDir, extractionRunId: snapManifest.extractionRunId || null } }
const warnings = []

// ---------- game 维度：requirements-matrix.json + rule-catalog.json ----------
if (gameDir) {
  const matrix = readJson(path.join(gameDir, 'requirements-matrix.json'), 'game requirements-matrix.json')
  const ruleCat = readJson(path.join(gameDir, 'rule-catalog.json'), 'game rule-catalog.json')
  for (const c of ruleCat.ruleCoverage || []) {
    rules.push({ ruleId: c.ruleId, file: c.file, section: c.section || null, sourceType: c.sourceType || 'unknown' })
  }
  for (const req of matrix.requirements || []) {
    for (const ref of req.ruleRefs || []) {
      relations.push({
        dimension: 'game',
        requirementId: req.requirementId,
        targetType: 'rule',
        targetId: ref.ruleId,
        verdict: ref.status || 'unverified',
        executionStatus: 'completed',
        evidence: ref.evidence || '',
        issueIds: (req.issueIds || []).slice(),
      })
    }
  }
  sources.game = { path: gameDir, extractionRunId: (readJson(path.join(gameDir, 'manifest.json'), 'game run manifest')).extractionRunId || null }
}

// ---------- ui 维度：report.json（issues[].requirementIds，阶段 4 产物） ----------
if (uiDir) {
  const report = readJson(path.join(uiDir, 'report.json'), 'ui report.json')
  const rep = report.report || report
  const uiIssues = (rep.issues || []).filter(Boolean)
  for (const it of uiIssues) {
    issues.push({ id: it.id, title: it.title, type: it.type, module: it.module || '未分类' })
    for (const rid of Array.isArray(it.requirementIds) ? it.requirementIds : []) {
      relations.push({
        dimension: 'ui',
        requirementId: String(rid),
        targetType: 'issue',
        targetId: it.id,
        verdict: String(it.type || 'incomplete').toLowerCase(),
        executionStatus: 'completed',
        evidence: String(it.original_text || it.problem || '').slice(0, 200),
      })
    }
  }
  sources.ui = { path: uiDir }
}

// ---------- bug 维度：bug-verdicts.json（verdicts[].requirementIds，阶段 5 产物） ----------
if (bugDir) {
  const v = readJson(path.join(bugDir, 'bug-verdicts.json'), 'bug bug-verdicts.json')
  const BUG_MAP = { PASS: 'pass', PARTIAL: 'partial', MISSING: 'missing', NOT_APPLICABLE: 'na', INSUFFICIENT: 'insufficient' }
  for (const b of v.verdicts || []) {
    bugs.push({ bugId: String(b.bugId), title: b.title || '', module: b.module || '未分类' })
    const linked = Array.isArray(b.requirementIds) ? b.requirementIds : []
    if (b.executionStatus !== 'completed') {
      if (linked.length > 0) warnings.push('bug ' + b.bugId + ' 执行失败但带 requirementIds，忽略关联')
      continue
    }
    for (const rid of linked) {
      relations.push({
        dimension: 'bug',
        requirementId: String(rid),
        targetType: 'bug',
        targetId: String(b.bugId),
        verdict: BUG_MAP[b.verdict] || 'insufficient',
        executionStatus: 'completed',
        evidence: String(b.reason || '').slice(0, 200),
      })
    }
  }
  sources.bug = { path: bugDir }
}

// 引用闭合预检（merge 侧友好提示；严格校验在 validate-rtm）
const reqIds = new Set(requirements.map((r) => r.requirementId))
const dangling = relations.filter((r) => !reqIds.has(r.requirementId))
if (dangling.length > 0) {
  console.error('[失败] relation 引用了快照外的 REQ ID（' + dangling.length + ' 条，如 ' + dangling[0].requirementId + '）——三 Checker 只能消费共享 REQ ID，不得自造')
  process.exit(1)
}

// ---------- stats（可由明细重算） ----------
const dist = { game: {}, ui: {}, bug: {} }
for (const r of relations) { dist[r.dimension][r.verdict] = (dist[r.dimension][r.verdict] || 0) + 1 }
const stats = {
  byDimension: {},
  requirements: { total: requirements.length, linked: new Set(relations.map((r) => r.requirementId)).size },
}
for (const dim of ['game', 'ui', 'bug']) {
  if (!sources[dim]) continue
  stats.byDimension[dim] = {
    total: relations.filter((r) => r.dimension === dim).length,
    verdictDist: dist[dim],
  }
}

const doc = {
  schemaVersion: 1,
  projectKey,
  generatedAt: new Date().toISOString(),
  extractionRunId: snapManifest.extractionRunId || null,
  requirements,
  rules,
  issues,
  bugs,
  relations,
  stats,
}
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'rtm.json'), JSON.stringify(doc, null, 2), 'utf8')
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({
  generatedAt: doc.generatedAt,
  projectKey,
  extractionRunId: doc.extractionRunId,
  sources,
  counts: { requirements: requirements.length, relations: relations.length, rules: rules.length, issues: issues.length, bugs: bugs.length },
  warnings,
}, null, 2), 'utf8')
console.log('[成功] 统一 RTM 快照已生成: ' + path.join(outDir, 'rtm.json'))
console.log('  REQ ' + requirements.length + ' 条（关联 ' + stats.requirements.linked + '）/ relations ' + relations.length + ' 条' +
  (sources.game ? ' / game 规则 ' + rules.length : '') + (sources.ui ? ' / ui issues ' + issues.length : '') + (sources.bug ? ' / bug ' + bugs.length : ''))
if (warnings.length) warnings.forEach((w) => console.log('  [警告] ' + w))
