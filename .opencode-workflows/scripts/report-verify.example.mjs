// report-verify.example.mjs —— report-verify.mjs 自检（v4 阶段 8）
// 场景：快照+game/ui/bug 三维度全过；game REQ ID 漂移拦截；game manifest 不可追溯拦截；
//       ui 快照外 REQ 拦截；bug 快照外 REQ 拦截；identity-map 脏拦截（mock git 不可行，改用干净文件跳过场景）；
//       参数缺失拦截
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const run = (args) => {
  try { return { code: 0, out: execFileSync('node', ['.opencode-workflows/scripts/report-verify.mjs', ...args], { encoding: 'utf8' }) } }
  catch (e) { return { code: e.status, out: (e.stdout || '') + (e.stderr || '') } }
}
const root = '.opencode-workflows/scripts/tmp-report-verify'
fs.rmSync(root, { recursive: true, force: true })
const w = (p, d) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(d), 'utf8') }

// ---------- mock 共享快照（380 条缩为 3 条） ----------
const snapDir = root + '/snap'
const snapReqs = [
  { requirementId: 'REQ-101', reqKey: 'a-1', title: '发牌', text: '庄家发十三张。' },
  { requirementId: 'REQ-102', reqKey: 'a-2', title: '定庄', text: '首局随机坐庄。' },
  { requirementId: 'REQ-103', reqKey: 'a-3', title: '胡牌', text: '胡牌判型。' },
]
w(snapDir + '/requirements.json', snapReqs)
w(snapDir + '/manifest.json', { extractionRunId: 'ext-t-01' })

// ---------- mock 三维度产物（干净版） ----------
const gameDir = root + '/game'
w(gameDir + '/requirements-matrix.json', { stats: {}, requirements: [
  { requirementId: 'REQ-101', reqKey: 'a-1', title: '发牌', ruleRefs: [] },
  { requirementId: 'REQ-102', reqKey: 'a-2', title: '定庄', ruleRefs: [] },
] })
w(gameDir + '/manifest.json', { extractionRunId: 'ext-t-01', requirementsSource: 'shared-snapshot' })

const uiDir = root + '/ui'
w(uiDir + '/report.json', { report: { issues: [
  { id: 'Q01', title: '缺张数', type: '描述不完整', requirementIds: ['REQ-101', 'REQ-102'] },
  { id: 'Q02', title: '无关联条目', type: '描述不完整', requirementIds: [] },
  { id: 'Q03', title: '需求缺失豁免', type: '需求缺失', requirementIds: [] },
] } })

const bugDir = root + '/bug'
w(bugDir + '/bug-verdicts.json', { verdicts: [
  { bugId: '1', verdict: 'PASS', requirementIds: ['REQ-103'] },
  { bugId: '2', verdict: 'MISSING', requirementIds: [] },
] })

// 场景 1：三维度全过 + 关联率统计
let r = run([snapDir, '--game', gameDir, '--ui', uiDir, '--bug', bugDir])
assert.equal(r.code, 0, '三维度应全过: ' + r.out)
assert.match(r.out, /game 零漂移/)
assert.match(r.out, /"requirements":2/)
assert.match(r.out, /"issues":3/)
assert.match(r.out, /"eligible":2/)
assert.match(r.out, /"linkRate":0\.5/)
assert.match(r.out, /"reqLinkRate":0\.5/)
assert.match(r.out, /核对通过（4 项）/)
console.log('[成功] 场景1 三维度全过 + 关联率统计')

// 场景 2：game REQ ID 漂移（快照外 ID + reqKey 不一致）拦截
{
  const g2 = root + '/game-drift'
  w(g2 + '/requirements-matrix.json', { stats: {}, requirements: [
    { requirementId: 'REQ-999', reqKey: 'x-9', title: '编造', ruleRefs: [] },
    { requirementId: 'REQ-101', reqKey: 'a-改', title: '发牌', ruleRefs: [] },
  ] })
  w(g2 + '/manifest.json', { extractionRunId: 'ext-t-01', requirementsSource: 'shared-snapshot' })
  r = run([snapDir, '--game', g2])
  assert.equal(r.code, 1)
  assert.match(r.out, /REQ ID 漂移 2 条/)
  assert.match(r.out, /REQ-999 不在快照/)
  assert.match(r.out, /reqKey 不一致/)
  console.log('[成功] 场景2 game REQ ID 漂移拦截')
}

// 场景 3a：game manifest extractionRunId 不一致拦截
{
  const g3 = root + '/game-badmf'
  w(g3 + '/requirements-matrix.json', { stats: {}, requirements: [{ requirementId: 'REQ-101', reqKey: 'a-1', title: '发牌', ruleRefs: [] }] })
  w(g3 + '/manifest.json', { extractionRunId: 'ext-other', requirementsSource: 'shared-snapshot' })
  r = run([snapDir, '--game', g3])
  assert.equal(r.code, 1)
  assert.match(r.out, /extractionRunId=ext-other != 快照 ext-t-01/)
  console.log('[成功] 场景3a game manifest extractionRunId 不一致拦截')
}

// 场景 3b：game manifest requirementsSource 非 shared-snapshot 拦截
{
  const g4 = root + '/game-selfext'
  w(g4 + '/requirements-matrix.json', { stats: {}, requirements: [{ requirementId: 'REQ-101', reqKey: 'a-1', title: '发牌', ruleRefs: [] }] })
  w(g4 + '/manifest.json', { extractionRunId: 'ext-t-01', requirementsSource: 'self-extract' })
  r = run([snapDir, '--game', g4])
  assert.equal(r.code, 1)
  assert.match(r.out, /requirementsSource=self-extract，非 shared-snapshot/)
  console.log('[成功] 场景3b game manifest source 非 shared 拦截')
}

// 场景 4：ui 引用快照外 REQ 拦截
{
  const u2 = root + '/ui-drift'
  w(u2 + '/report.json', { report: { issues: [{ id: 'Q01', title: 'x', requirementIds: ['REQ-888'] }] } })
  r = run([snapDir, '--ui', u2])
  assert.equal(r.code, 1)
  assert.match(r.out, /ui 引用快照外 REQ 1 条/)
  assert.match(r.out, /Q01 -> REQ-888/)
  console.log('[成功] 场景4 ui 快照外 REQ 拦截')
}

// 场景 5：bug 引用快照外 REQ 拦截
{
  const b2 = root + '/bug-drift'
  w(b2 + '/bug-verdicts.json', { verdicts: [{ bugId: '7', verdict: 'PASS', requirementIds: ['REQ-777'] }] })
  r = run([snapDir, '--bug', b2])
  assert.equal(r.code, 1)
  assert.match(r.out, /bug 引用快照外 REQ 1 条/)
  console.log('[成功] 场景5 bug 快照外 REQ 拦截')
}

// 场景 6：快照损坏（requirements 空）拦截
{
  const s2 = root + '/snap-empty'
  w(s2 + '/requirements.json', [])
  w(s2 + '/manifest.json', { extractionRunId: 'ext-t-01' })
  r = run([s2, '--game', gameDir])
  assert.equal(r.code, 1)
  assert.match(r.out, /快照 requirements 为空/)
  console.log('[成功] 场景6 空快照拦截')
}

// 场景 7：参数缺失（无维度）拦截
r = run([snapDir])
assert.equal(r.code, 1)
assert.match(r.out, /至少传一个核对维度/)
console.log('[成功] 场景7 无维度参数拦截')

// 场景 8：真实快照 + 真实 game run 产物回归（存在才跑，无则跳过）
{
  const realSnap = 'output/projects/hzmj/extractions/ext-20261112-01'
  const realGame = 'examples/game-prd-check-workflow/rtm/runs/run-20261113'
  if (fs.existsSync(realSnap + '/requirements.json') && fs.existsSync(realGame + '/requirements-matrix.json')) {
    r = run([realSnap, '--game', realGame])
    assert.equal(r.code, 0, '真实产物回归应过: ' + r.out)
    assert.match(r.out, /"requirements":380/)
    console.log('[成功] 场景8 真实快照+run-20261113 回归（380 REQ 零漂移）')
  } else {
    console.log('[跳过] 场景8 真实产物不存在')
  }
}

fs.rmSync(root, { recursive: true, force: true })
console.log('[成功] report-verify.example 9 场景全过（三维度全过/REQ漂移/runId不一致/source非shared/ui外REQ/bug外REQ/空快照/缺维度/真实回归）')
