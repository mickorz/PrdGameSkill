// gen-req-index.example.mjs —— gen-req-index.mjs 自检（v4 阶段 8）
// 场景：正常投影；缺目录；缺 requirements.json；空 requirements；缺字段拦截；真实快照回归
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const run = (args) => {
  try { return { code: 0, out: execFileSync('node', ['.opencode-workflows/scripts/gen-req-index.mjs', ...args], { encoding: 'utf8' }) } }
  catch (e) { return { code: e.status, out: (e.stdout || '') + (e.stderr || '') } }
}
const root = '.opencode-workflows/scripts/tmp-req-index'
fs.rmSync(root, { recursive: true, force: true })

// 场景 1：正常投影（写到 out，快照目录保持只读）
fs.mkdirSync(root + '/snap', { recursive: true })
fs.writeFileSync(root + '/snap/requirements.json', JSON.stringify([
  { requirementId: 'REQ-101', reqKey: 'a-1', title: '发牌', text: '很长原文……'.repeat(50), source: { file: 'x.md', fromLine: 1 } },
  { requirementId: 'REQ-102', reqKey: 'a-2', title: '定庄', text: '原文', source: {} },
]))
fs.writeFileSync(root + '/snap/manifest.json', JSON.stringify({ extractionRunId: 'ext-t-01' }))
let r = run([root + '/snap', '--out', root + '/run/requirements-index.json'])
assert.equal(r.code, 0, r.out)
assert.match(r.out, /2 条/)
const idx = JSON.parse(fs.readFileSync(root + '/run/requirements-index.json', 'utf8'))
assert.equal(idx.length, 2)
assert.deepEqual(Object.keys(idx[0]), ['requirementId', 'reqKey', 'title'], '索引条目应只含三字段')
assert.equal(idx[0].text, undefined, '不应带 text')
assert.ok(!fs.existsSync(root + '/snap/requirements-index.json'), '快照目录不得被写入（历史快照只读）')
const full = fs.statSync(root + '/snap/requirements.json').size
const slim = fs.statSync(root + '/run/requirements-index.json').size
assert.ok(slim < full / 5, '索引应显著小于全量（' + slim + ' vs ' + full + '）')
console.log('[成功] 场景1 正常投影（瘦身 ' + full + 'B -> ' + slim + 'B，快照只读）')

// 场景 2：缺目录
r = run([root + '/none', '--out', root + '/x.json'])
assert.equal(r.code, 1)
assert.match(r.out, /缺 requirements\.json/)
console.log('[成功] 场景2 缺 requirements.json 拦截')

// 场景 3：空 requirements
fs.mkdirSync(root + '/empty', { recursive: true })
fs.writeFileSync(root + '/empty/requirements.json', '[]')
r = run([root + '/empty', '--out', root + '/x.json'])
assert.equal(r.code, 1)
assert.match(r.out, /requirements 为空/)
console.log('[成功] 场景3 空 requirements 拦截')

// 场景 4：缺字段拦截（不动原文件）
fs.mkdirSync(root + '/bad', { recursive: true })
fs.writeFileSync(root + '/bad/requirements.json', JSON.stringify([{ requirementId: 'REQ-101', reqKey: 'a-1', title: 'ok' }, { title: '缺ID' }]))
r = run([root + '/bad', '--out', root + '/bad-out/requirements-index.json'])
assert.equal(r.code, 1)
assert.match(r.out, /1 条缺 requirementId\/reqKey/)
assert.ok(!fs.existsSync(root + '/bad-out/requirements-index.json'), '失败时不应产出索引')
console.log('[成功] 场景4 缺字段拦截')

// 场景 5：参数缺失
r = run([])
assert.equal(r.code, 1)
assert.match(r.out, /用法/)
console.log('[成功] 场景5 参数缺失拦截')

// 场景 6：真实快照回归（存在才跑；写到临时目录，真实快照目录保持只读）
const real = 'output/projects/hzmj/extractions/ext-20261112-01'
if (fs.existsSync(real + '/requirements.json')) {
  const before = fs.statSync(real + '/requirements.json').size
  r = run([real, '--out', root + '/real-index.json'])
  assert.equal(r.code, 0, r.out)
  const idxReal = JSON.parse(fs.readFileSync(root + '/real-index.json', 'utf8'))
  assert.equal(idxReal.length, 380, '真实快照应 380 条')
  const after = fs.statSync(real + '/requirements.json').size
  assert.equal(before, after, '全量文件不得被改写')
  assert.ok(!fs.existsSync(real + '/requirements-index.json'), '真实快照目录不得被写入')
  const slimReal = fs.statSync(root + '/real-index.json').size
  console.log('[成功] 场景6 真实快照回归（380 条，' + Math.round(before / 1024) + 'KB -> ' + Math.round(slimReal / 1024) + 'KB，快照只读）')
} else {
  console.log('[跳过] 场景6 真实快照不存在')
}

fs.rmSync(root, { recursive: true, force: true })
console.log('[成功] gen-req-index.example 6 场景全过（投影/缺文件/空清单/缺字段/缺参数/真实回归）')
