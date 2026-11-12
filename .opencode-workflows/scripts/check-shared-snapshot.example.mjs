// check-shared-snapshot.example.mjs —— check-shared-snapshot.mjs 自检（9 场景）
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const run = (args) => {
  try { return { code: 0, out: execFileSync('node', ['.opencode-workflows/scripts/check-shared-snapshot.mjs', ...args], { encoding: 'utf8' }) } }
  catch (e) { return { code: e.status, out: (e.stdout || '') + (e.stderr || '') } }
}
const root = '.opencode-workflows/scripts/tmp-snapcheck'
fs.rmSync(root, { recursive: true, force: true })
fs.mkdirSync(root + '/src', { recursive: true })
fs.writeFileSync(root + '/src/prd.md', '# 总则\n庄家发十三张牌。\n', 'utf8')
const sha = (await import('node:crypto')).createHash('sha256').update(fs.readFileSync(root + '/src/prd.md', 'utf8')).digest('hex')

const mkSnap = (name, over = {}) => {
  const d = root + '/' + name
  fs.mkdirSync(d, { recursive: true })
  fs.writeFileSync(d + '/requirements.json', JSON.stringify([{ reqKey: 'a-1', title: '发牌', text: 'x' }]), 'utf8')
  fs.writeFileSync(d + '/manifest.json', JSON.stringify({ extractionRunId: 'ext-ok-01', sourceFiles: [{ file: root + '/src/prd.md', sha256: sha, bytes: 12 }], ...over }), 'utf8')
  return d
}

// 1. 全通过 + 源校验
assert.equal(run([mkSnap('s1'), 'ext-ok-01', '--verify-source']).code, 0)
// 2. runId 不一致失败
let r = run([mkSnap('s2'), 'ext-other'])
assert.equal(r.code, 1); assert.match(r.out, /extractionRunId 不一致/)
// 3. 缺 manifest
const d3 = mkSnap('s3'); fs.unlinkSync(d3 + '/manifest.json')
r = run([d3, 'ext-ok-01']); assert.equal(r.code, 1); assert.match(r.out, /缺 manifest/)
// 4. 空需求拒绝
r = run([mkSnap('s4'), 'ext-ok-01'].slice(0, 1).concat('ext-ok-01') && [mkSnap('s4'), 'ext-ok-01'])
{ const d = mkSnap('s4'); fs.writeFileSync(d + '/requirements.json', '[]'); r = run([d, 'ext-ok-01']); assert.equal(r.code, 1); assert.match(r.out, /无需求条目/) }
// 5. 源文件不存在
{ const d = mkSnap('s5', { sourceFiles: [{ file: root + '/src/gone.md', sha256: sha }] }); r = run([d, 'ext-ok-01', '--verify-source']); assert.equal(r.code, 1); assert.match(r.out, /源文件不存在/) }
// 6. 源文件被改（sha 不一致）
{ fs.writeFileSync(root + '/src/prd.md', '# 改了\n', 'utf8'); const d = mkSnap('s6'); r = run([d, 'ext-ok-01', '--verify-source']); assert.equal(r.code, 1); assert.match(r.out, /快照过期/) }
// 7. 免源校验时不检查 sha（改过的文件也通过）
{ const d = mkSnap('s7'); r = run([d, 'ext-ok-01']); assert.equal(r.code, 0) }
// 8. 目录不存在
r = run([root + '/nope', 'ext-ok-01']); assert.equal(r.code, 1); assert.match(r.out, /目录不存在/)
// 9. 参数缺失
r = run([]); assert.equal(r.code, 1); assert.match(r.out, /用法/)
// 恢复源文件内容（保持幂等）
fs.writeFileSync(root + '/src/prd.md', '# 总则\n庄家发十三张牌。\n', 'utf8')
fs.rmSync(root, { recursive: true, force: true })
console.log('[成功] check-shared-snapshot.example 9 场景全过（通过/runId不一致/缺manifest/空需求/源不存在/源变更过期/免源校验/目录不存在/参数缺失）')
