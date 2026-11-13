// validate-rtm.example.mjs —— validate-rtm.mjs + rtm-merge.mjs 联合自检（v4 阶段 6）
// 场景：merge 正常合并（三维度）→ validate 通过；merge 引用悬空 REQ 拒绝；
//       validate 各类非法（引用不闭合/坏枚举/failed 带判定/pass 无证据/统计不一致/维度 targetType 错配）全被拦
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const run = (script, args) => {
  try { return { code: 0, out: execFileSync('node', ['.opencode-workflows/scripts/' + script, ...args], { encoding: 'utf8' }) } }
  catch (e) { return { code: e.status, out: (e.stdout || '') + (e.stderr || '') } }
}
const root = '.opencode-workflows/scripts/tmp-rtmcore'
fs.rmSync(root, { recursive: true, force: true })

// ---------- mock 共享快照 ----------
const snapDir = root + '/snap'
fs.mkdirSync(snapDir, { recursive: true })
const snapReqs = [
  { requirementId: 'REQ-101', reqKey: 'a-1', title: '发牌', text: '庄家发十三张牌。', source: { file: 'x.md', fromLine: 1, toLine: 1 } },
  { requirementId: 'REQ-102', reqKey: 'a-2', title: '定庄', text: '首局随机坐庄。', source: { file: 'x.md', fromLine: 2, toLine: 2 } },
]
fs.writeFileSync(snapDir + '/requirements.json', JSON.stringify(snapReqs), 'utf8')
fs.writeFileSync(snapDir + '/manifest.json', JSON.stringify({ extractionRunId: 'ext-t-01' }), 'utf8')

// ---------- mock game run ----------
const gameDir = root + '/game'
fs.mkdirSync(gameDir, { recursive: true })
fs.writeFileSync(gameDir + '/requirements-matrix.json', JSON.stringify({
  stats: {},
  requirements: [
    { requirementId: 'REQ-101', reqKey: 'a-1', ruleRefs: [{ ruleId: 'R01-001', status: 'pass', evidence: '2.1 张数明确' }], issueIds: ['ISSUE-1'] },
    { requirementId: 'REQ-102', reqKey: 'a-2', ruleRefs: [{ ruleId: 'R01-002', status: 'unverified', evidence: '' }], issueIds: [] },
  ],
}), 'utf8')
// 真实产物 rule-catalog.json 为纯数组（v4 实测格式；曾因误读 ruleCoverage 字段致 rules 目录空）
fs.writeFileSync(gameDir + '/rule-catalog.json', JSON.stringify([
  { ruleId: 'R01-001', file: 'rules/a.md' }, { ruleId: 'R01-002', file: 'rules/a.md' },
]), 'utf8')
fs.writeFileSync(gameDir + '/manifest.json', JSON.stringify({ extractionRunId: 'ext-t-01' }), 'utf8')

// ---------- mock ui 产物 ----------
const uiDir = root + '/ui'
fs.mkdirSync(uiDir, { recursive: true })
fs.writeFileSync(uiDir + '/report.json', JSON.stringify({ report: { issues: [
  { id: 'UI-001', type: 'MISSING', module: '发牌', title: '缺张数', original_text: '未写张数', requirementIds: ['REQ-101'] },
] } }), 'utf8')

// ---------- mock bug 产物 ----------
const bugDir = root + '/bug'
fs.mkdirSync(bugDir, { recursive: true })
fs.writeFileSync(bugDir + '/bug-verdicts.json', JSON.stringify({ verdicts: [
  { bugId: '1', title: '发牌数错', module: '发牌', executionStatus: 'completed', verdict: 'PASS', reason: 'REQ-101 覆盖', requirementIds: ['REQ-101'] },
  { bugId: '2', title: '定庄缺失', module: '定庄', executionStatus: 'completed', verdict: 'MISSING', reason: '无覆盖', requirementIds: [] },
  { bugId: '3', title: '执行失败例', module: '结算', executionStatus: 'failed', verdict: null, reason: '批次失败', requirementIds: [] },
] }), 'utf8')

const outDir = root + '/unified'

// 场景 1：三维度合并 → validate 通过
let r = run('rtm-merge.mjs', [outDir, '--requirements', snapDir, '--game', gameDir, '--ui', uiDir, '--bug', bugDir])
assert.equal(r.code, 0, r.out)
const doc = JSON.parse(fs.readFileSync(outDir + '/rtm.json', 'utf8'))
assert.equal(doc.requirements.length, 2)
assert.equal(doc.relations.length, 4) // game 2 + ui 1 + bug 1（failed 条不产 relation）
assert.ok(doc.relations.some((x) => x.dimension === 'bug' && x.targetId === '1' && x.verdict === 'pass'))
assert.ok(!doc.relations.some((x) => x.dimension === 'bug' && x.targetId === '3'), '执行失败不得产生判定 relation')
r = run('validate-rtm.mjs', [outDir + '/rtm.json'])
assert.equal(r.code, 0, r.out)

// 场景 2：merge 引用快照外 REQ → 拒绝
{
  const badUi = root + '/ui-bad'
  fs.mkdirSync(badUi, { recursive: true })
  fs.writeFileSync(badUi + '/report.json', JSON.stringify({ report: { issues: [
    { id: 'UI-9', type: 'MISSING', module: 'x', title: 't', original_text: 'o', requirementIds: ['REQ-999'] },
  ] } }), 'utf8')
  r = run('rtm-merge.mjs', [root + '/u2', '--requirements', snapDir, '--ui', badUi])
  assert.equal(r.code, 1)
  assert.match(r.out, /快照外的 REQ ID/)
}

// 场景 3-7：validate 各类非法全被拦（基于合法 doc 变异）
const mutate = (fn) => {
  const d = JSON.parse(fs.readFileSync(outDir + '/rtm.json', 'utf8'))
  fn(d)
  fs.writeFileSync(root + '/mut.json', JSON.stringify(d), 'utf8')
  return run('validate-rtm.mjs', [root + '/mut.json'])
}
// 3. REQ 引用不闭合
r = mutate((d) => { d.relations[0].requirementId = 'REQ-999' })
assert.equal(r.code, 1); assert.match(r.out, /REQ 引用不闭合/)
// 4. 坏 verdict 枚举
r = mutate((d) => { d.relations[0].verdict = 'PASS' })
assert.equal(r.code, 1); assert.match(r.out, /非法 verdict/)
// 5. failed 带判定
r = mutate((d) => { d.relations[0].executionStatus = 'failed'; d.relations[0].verdict = 'pass' })
assert.equal(r.code, 1); assert.match(r.out, /执行失败必须 verdict 为 null/)
// 6. pass 无证据
r = mutate((d) => { d.relations[0].verdict = 'pass'; d.relations[0].evidence = '' })
assert.equal(r.code, 1); assert.match(r.out, /必须有证据/)
// 7. 统计不一致
r = mutate((d) => { d.stats.byDimension.game.total += 1 })
assert.equal(r.code, 1); assert.match(r.out, /total 不一致/)
// 8. 维度与 targetType 错配
r = mutate((d) => { d.relations[0].targetType = 'bug' })
assert.equal(r.code, 1); assert.match(r.out, /dimension 与 targetType 不匹配/)
// 9. rule 引用不闭合（targetId 不在 rules 目录）
r = mutate((d) => { d.relations[0].targetId = 'R99-999' })
assert.equal(r.code, 1); assert.match(r.out, /rule 引用不闭合/)
// 10. requirements 目录空
r = mutate((d) => { d.requirements = [] })
assert.equal(r.code, 1); assert.match(r.out, /requirements 目录缺失或为空/)
// 11. merge 缺维度参数
r = run('rtm-merge.mjs', [root + '/u3', '--requirements', snapDir])
assert.equal(r.code, 1); assert.match(r.out, /至少传一个维度/)

// 12. 包装格式 {ruleCoverage:[]} rule-catalog 兼容（旧 mock 格式），rules 目录同样非空
{
  const g2 = root + '/game-wrapped'
  fs.mkdirSync(g2, { recursive: true })
  fs.writeFileSync(g2 + '/requirements-matrix.json', JSON.stringify({
    stats: {},
    requirements: [{ requirementId: 'REQ-101', reqKey: 'a-1', ruleRefs: [{ ruleId: 'R01-001', status: 'pass', evidence: 'ok' }], issueIds: [] }],
  }), 'utf8')
  fs.writeFileSync(g2 + '/manifest.json', JSON.stringify({ extractionRunId: 'ext-t-01' }), 'utf8')
  fs.writeFileSync(g2 + '/rule-catalog.json', JSON.stringify({ ruleCoverage: [{ ruleId: 'R01-001', file: 'rules/a.md' }] }), 'utf8')
  const r2 = run('rtm-merge.mjs', [root + '/unified-wrapped', '--requirements', snapDir, '--game', g2])
  assert.equal(r2.code, 0, '包装格式 rule-catalog 应合并成功: ' + r2.out)
  const rtm2 = JSON.parse(fs.readFileSync(root + '/unified-wrapped/rtm.json', 'utf8'))
  assert.equal(rtm2.rules.length, 1, '包装格式 rules 目录应 1 条')
  assert.equal(rtm2.rules[0].ruleId, 'R01-001')
  console.log('[成功] 包装格式 rule-catalog 兼容断言通过（rules 目录非空）')
}

fs.rmSync(root, { recursive: true, force: true })
console.log('[成功] validate-rtm.example 12 场景全过（三维度合并/通过校验/悬空REQ拒绝/引用不闭合/坏枚举/failed带判定/pass无证据/统计不一致/维度错配/rule不闭合/空REQ目录/缺维度/包装格式兼容）')
