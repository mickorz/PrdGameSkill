// rtm-assemble.example.mjs —— rtm-assemble.mjs 共享快照模式自检（CLI 级 mock fixtures）
// 覆盖：requirementId 直供（与共享快照一致，无 ID 漂移）/ identity-map 不写（单写者契约）/
//       manifest 记录 extractionRunId 与 requirementsSource / runId 不一致 fail-fast /
//       快照缺 manifest 且传 runId 时失败 / 自提取模式回归（parts 合并 + map 写回）
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const run = (args) => {
  try {
    const out = execFileSync('node', ['.opencode-workflows/scripts/rtm-assemble.mjs', ...args], { encoding: 'utf8' })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }
  }
}

const root = '.opencode-workflows/scripts/tmp-rtm'
fs.rmSync(root, { recursive: true, force: true })

// ---------- mock 共享快照 ----------
const sharedDir = root + '/shared'
fs.mkdirSync(sharedDir, { recursive: true })
const snapReq = [
  {
    requirementId: 'REQ-101', reqKey: 'prd-001', title: '发牌', text: '庄家发十三张牌，闲家十三张牌。',
    source: { file: 'input/prd.md', section: '2.1', fromLine: 3, toLine: 3 }, identityStatus: 'new',
  },
  {
    requirementId: 'REQ-102', reqKey: 'prd-002', title: '定庄', text: '首局随机坐庄，赢家连庄。',
    source: { file: 'input/prd.md', section: '2.2', fromLine: 5, toLine: 5 }, identityStatus: 'new',
  },
]
fs.writeFileSync(sharedDir + '/requirements.json', JSON.stringify(snapReq, null, 1), 'utf8')
fs.writeFileSync(sharedDir + '/manifest.json', JSON.stringify({ extractionRunId: 'ext-test-01', schemaVersion: 1 }, null, 1), 'utf8')

// 源文件（引文校验用）
fs.mkdirSync(root + '/input', { recursive: true })
fs.writeFileSync(root + '/input/prd.md', ['总则', '规则', '庄家发十三张牌，闲家十三张牌。', '定庄说明', '首局随机坐庄，赢家连庄。'].join('\n'), 'utf8')

// ---------- mock runDir（catalog + checks；requirements/parts 由共享快照替代） ----------
const mkRun = (name) => {
  const rd = root + '/' + name
  fs.mkdirSync(rd + '/catalog/parts', { recursive: true })
  fs.mkdirSync(rd + '/checks', { recursive: true })
  fs.writeFileSync(rd + '/catalog/parts/group-01.json', JSON.stringify([
    { ruleId: 'R01-001', file: 'rules/a.md', section: '1', fromLine: 1, toLine: 2, text: '发牌规则必须明确张数', mandatory: true },
    { ruleId: 'R01-002', file: 'rules/a.md', section: '2', fromLine: 3, toLine: 4, text: '定庄规则必须明确连庄', mandatory: true },
  ]), 'utf8')
  fs.writeFileSync(rd + '/checks/group-01.json', JSON.stringify({
    groupId: 'group-01', status: 'completed', checkVersion: 'v1',
    coverage: [
      { ruleId: 'R01-001', reqKey: 'prd-001', status: 'pass', evidence: '2.1 发牌张数明确' },
      { ruleId: 'R01-002', reqKey: 'prd-002', status: 'missing', evidence: '2.2 未写连庄' },
    ],
    issues: [],
  }), 'utf8')
  return rd
}

// 场景 1：共享模式——requirementId 直供、map 不写、manifest 可追溯
{
  const rd = mkRun('run-shared')
  const mapPath = root + '/map-notouch.json'
  const r = run([rd, '--shared-requirements', sharedDir, '--extraction-run-id', 'ext-test-01', '--identity-map', mapPath])
  assert.equal(r.code, 0, r.out)
  assert.match(r.out, /需求来源: 共享快照/)
  const reqOut = JSON.parse(fs.readFileSync(rd + '/requirements.json', 'utf8'))
  assert.equal(reqOut.length, 2)
  assert.equal(reqOut[0].requirementId, 'REQ-101')
  assert.equal(reqOut[1].requirementId, 'REQ-102')
  assert.equal(reqOut[0].reqKey, 'prd-001')
  // identity-map 未被写（单写者契约：只由 requirements-build 更新）
  assert.equal(fs.existsSync(mapPath), false, '共享模式不得写 identity-map')
  // manifest 可追溯
  const manifest = JSON.parse(fs.readFileSync(rd + '/manifest.json', 'utf8'))
  assert.equal(manifest.extractionRunId, 'ext-test-01')
  assert.equal(manifest.requirementsSource, 'shared-snapshot')
  // coverage 引用 reqKey → requirementId 关联
  const matrix = JSON.parse(fs.readFileSync(rd + '/requirements-matrix.json', 'utf8'))
  assert.equal(matrix.requirements[0].requirementId, 'REQ-101')
  assert.ok(matrix.requirements[0].ruleRefs.some((x) => x.ruleId === 'R01-001'))
}

// 场景 2：extractionRunId 不一致 → fail-fast
{
  const rd = mkRun('run-mismatch')
  const r = run([rd, '--shared-requirements', sharedDir, '--extraction-run-id', 'ext-other-99'])
  assert.equal(r.code, 1)
  assert.match(r.out, /extractionRunId 不一致/)
}

// 场景 3：快照缺 manifest.json 且传 runId → 失败
{
  const badShared = root + '/shared-nom'
  fs.mkdirSync(badShared, { recursive: true })
  fs.writeFileSync(badShared + '/requirements.json', JSON.stringify(snapReq.slice(0, 1)), 'utf8')
  const rd = mkRun('run-nom')
  const r = run([rd, '--shared-requirements', badShared, '--extraction-run-id', 'ext-test-01'])
  assert.equal(r.code, 1)
  assert.match(r.out, /缺 manifest\.json/)
}

// 场景 4：不传 --extraction-run-id → 用快照 manifest 的（校验跳过，manifest 记录）
{
  const rd = mkRun('run-noid')
  const r = run([rd, '--shared-requirements', sharedDir])
  assert.equal(r.code, 0, r.out)
  const manifest = JSON.parse(fs.readFileSync(rd + '/manifest.json', 'utf8'))
  assert.equal(manifest.extractionRunId, 'ext-test-01')
}

// 场景 5：自提取模式回归——requirements/parts 合并 + identity-map 写回（旧路径不受影响）
{
  const rd = mkRun('run-self')
  fs.mkdirSync(rd + '/requirements/parts', { recursive: true })
  fs.writeFileSync(rd + '/requirements/parts/part-01.json', JSON.stringify([
    { reqKey: 'prd-001', title: '发牌', text: '庄家发十三张牌，闲家十三张牌。', source: { file: root + '/input/prd.md', section: '2.1', fromLine: 3, toLine: 3 } },
  ]), 'utf8')
  const mapPath = rd + '/../identity-map.json'
  const r = run([rd, '--identity-map', mapPath])
  assert.equal(r.code, 0, r.out)
  assert.equal(fs.existsSync(mapPath), true, '自提取模式应写 identity-map')
  const reqOut = JSON.parse(fs.readFileSync(rd + '/requirements.json', 'utf8'))
  assert.ok(reqOut[0].requirementId.startsWith('REQ-'), '自提取模式分配 REQ ID')
  const manifest = JSON.parse(fs.readFileSync(rd + '/manifest.json', 'utf8'))
  assert.equal(manifest.requirementsSource, 'self-extract')
  assert.equal(manifest.extractionRunId, null)
}

fs.rmSync(root, { recursive: true, force: true })
console.log('[成功] rtm-assemble.example 全部断言通过（ID直供/map不写/manifest可追溯/runId不一致fail-fast/缺manifest失败/免校验模式/自提取回归）')
