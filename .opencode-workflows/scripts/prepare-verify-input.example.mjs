// prepare-verify-input.example.mjs —— 查证输入准备自检（断言式）
//
// 执行文档 §13。覆盖：
//   A. Registry 基线：只投影需求侧字段（不含 verdict/applicability/evidence）
//   B. S4/S5 分片命名差异（-cp / -p）+ 每阶段分片 + 不拆散功能点
//   C. 客户端全量原子（不按 verificationScope 裁剪）
//   D. run-status 骨架：初始全 pending（pending 唯一事实源，绝不乐观 completed）+ 断点续跑保持已完成
//   E. 幂等清理：收窄 stageIds 时清旧分片
//   F. 失败路径：Registry 缺失 / 阶段不在 Registry / 非法 branch
//   G. 端到端串联：prepare → collect-source-manifest → merge（统计不变式通过）
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { prepareVerifyInput } from './prepare-verify-input.mjs'
import { collectSourceManifest } from './collect-source-manifest.mjs'
import { mergeBranchEvidence } from './merge-branch-evidence.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = path.join(REPO_ROOT, '.opencode-workflows/scripts/prepare-verify-input.mjs')
const TMP = path.join(REPO_ROOT, '.opencode-workflows/scripts/tmp-prepare-input')
const DATE = '2099-01-01'
const KEY_SEP = '\u0000'

const writeJson = (p, data) => {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(data, null, 1) + '\n', 'utf8')
}
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))

// 大 Registry：2 阶段 / 3 功能点 / 15 原子（触发分片：单片 ≤ 12）
function makeRegistry() {
  const atoms = (stage, from, n) =>
    Array.from({ length: n }, (_, i) => ({
      atomId: 'AT-' + stage + '-' + String(from + i).padStart(3, '0'),
      name: '原子' + (from + i),
      rule: '规则内容 ' + (from + i),
      uiRequirement: i % 2 === 0 ? 'UI 表现 ' + (from + i) : '',
      verificationScope: i % 3 === 0 ? 'client' : i % 3 === 1 ? 'server' : 'both',
      businessBehavior: { trigger: 't', condition: '', action: 'a', result: 'r' },
      source: { chapter: 'ch', fromLine: 6, toLine: 7 },
    }))
  return {
    schemaVersion: 1, date: DATE,
    stages: [
      { stageId: 'ST-C01', name: '定庄', chapter: 'ch1', summary: 's1', featureCount: 2, atomCount: 10 },
      { stageId: 'ST-C02', name: '财神', chapter: 'ch2', summary: 's2', featureCount: 1, atomCount: 5 },
    ],
    features: [
      { id: 'FP-ST-C01-001', stageId: 'ST-C01', name: 'f1', description: 'd1', scope: 's', coordination: 'c', atoms: atoms('ST-C01', 1, 6) },
      { id: 'FP-ST-C01-002', stageId: 'ST-C01', name: 'f2', description: 'd2', scope: '', coordination: '', atoms: atoms('ST-C01', 7, 4) },
      { id: 'FP-ST-C02-001', stageId: 'ST-C02', name: 'f3', description: 'd3', scope: '', coordination: '', atoms: atoms('ST-C02', 1, 5) },
    ],
    stats: { stageCount: 2, featureCount: 3, atomCount: 15, perStage: [], scopeStats: { client: 5, server: 5, both: 5 } },
  }
}

function setupRun(runId) {
  const runDir = path.join(TMP, 'runs', runId)
  fs.rmSync(runDir, { recursive: true, force: true })
  writeJson(path.join(runDir, '1-registry/requirement-registry.json'), makeRegistry())
  return runDir
}

const results = []
const test = (name, fn) => {
  try {
    fn()
    results.push('[通过] ' + name)
  } catch (e) {
    results.push('[失败] ' + name + ' -> ' + e.message)
    process.exitCode = 1
  }
}

fs.rmSync(TMP, { recursive: true, force: true })

// ============================================================
// A + B + C：投影 / 分片命名 / 客户端全量原子
// ============================================================
let runDir
test('A1 客户端分片：-cp 命名 + 单片 ≤12 原子 + 不拆散功能点', () => {
  runDir = setupRun('run-001')
  const r = prepareVerifyInput({ runDir, branch: 'client', stageIds: 'ALL', date: DATE })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  assert.equal(r.manifest.totalAtomCount, 15)
  // ST-C01 有 10 原子 → 1 片；ST-C02 有 5 原子 → 1 片（贪心：10 ≤ 12 不切）
  assert.equal(r.manifest.stages.length, 2)
  const files = fs.readdirSync(path.join(runDir, '2-client/runtime/verify-input')).filter((n) => n.endsWith('.json') && n !== 'manifest.json')
  for (const f of files) assert.match(f, /^ST-C\d{2}-cp\d{2}\.json$/, '客户端分片命名必须是 -cp：' + f)
})

test('A2 分片只含需求侧字段（不含 verdict/applicability/evidence 等查证字段）', () => {
  const dir = path.join(runDir, '2-client/runtime/verify-input')
  const f = fs.readdirSync(dir).find((n) => n.startsWith('ST-C01-cp'))
  const doc = readJson(path.join(dir, f))
  const atom = doc.featureGroups[0].atoms[0]
  assert.deepEqual(
    Object.keys(atom).sort(),
    ['atomId', 'businessBehavior', 'name', 'rule', 'source', 'uiRequirement', 'verificationScope'].sort()
  )
  for (const k of ['verdict', 'applicability', 'evidence', 'evidenceIds', 'directConflict']) {
    assert.equal(k in atom, false, '分片不得含查证字段：' + k)
  }
})

test('A3 客户端全量原子：verificationScope=server 的原子也在分片内（不按 scope 裁剪）', () => {
  const dir = path.join(runDir, '2-client/runtime/verify-input')
  const all = fs.readdirSync(dir).filter((n) => n.endsWith('.json') && n !== 'manifest.json')
    .flatMap((n) => readJson(path.join(dir, n)).featureGroups.flatMap((g) => g.atoms))
  const scopes = new Set(all.map((a) => a.verificationScope))
  assert.deepEqual([...scopes].sort(), ['both', 'client', 'server'], '客户端分片必须含全部 scope 的原子')
  assert.equal(all.length, 15)
})

test('B1 服务端分片：-p 命名（与客户端 -cp 区分）', () => {
  const rd = setupRun('run-002')
  const r = prepareVerifyInput({ runDir: rd, branch: 'server', stageIds: 'ALL', date: DATE })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  const files = fs.readdirSync(path.join(rd, '3-server/runtime/verify-input')).filter((n) => n.endsWith('.json') && n !== 'manifest.json')
  for (const f of files) assert.match(f, /^ST-C\d{2}-p\d{2}\.json$/, '服务端分片命名必须是 -p：' + f)
})

test('B2 字段级分片：功能点不可拆（ST-C01 10 原子 1 片，含 2 个完整功能点）', () => {
  const dir = path.join(runDir, '2-client/runtime/verify-input')
  const f = fs.readdirSync(dir).find((n) => n.startsWith('ST-C01-cp'))
  const doc = readJson(path.join(dir, f))
  assert.equal(doc.featureGroups.length, 2, '功能点不拆散：两个功能点应在同片')
  assert.deepEqual(doc.featureGroups.map((g) => g.featureId), ['FP-ST-C01-001', 'FP-ST-C01-002'])
})

// ============================================================
// D：run-status 骨架
// ============================================================
test('D1 run-status 骨架：初始全 pending（绝不乐观 completed）+ atomIds 覆盖清单', () => {
  const rs = readJson(path.join(runDir, '2-client/runtime/run-status.json'))
  assert.equal(rs.branch, 'client')
  assert.equal(rs.runStatus, 'pending')
  assert.equal(rs.parts.length, 2)
  for (const p of rs.parts) {
    assert.equal(p.status, 'pending', '初始必须 pending：' + p.partFile)
    assert.ok(Array.isArray(p.atomIds) && p.atomIds.length > 0, '必须声明覆盖原子清单：' + p.partFile)
    assert.match(p.partFile, /-cp\d{2}\.json$/)
  }
  const total = rs.parts.reduce((n, p) => n + p.atomIds.length, 0)
  assert.equal(total, 15, 'run-status 原子清单必须覆盖全部 15 原子（不变式可判定）')
})

test('D2 断点续跑：已完成分片状态保持 completed，不倒退为 pending', () => {
  const rsPath = path.join(runDir, '2-client/runtime/run-status.json')
  const rs = readJson(rsPath)
  rs.parts[0].status = 'completed'
  rs.runStatus = 'partial'
  writeJson(rsPath, rs)
  const r = prepareVerifyInput({ runDir, branch: 'client', stageIds: 'ALL', date: DATE })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  const rs2 = readJson(rsPath)
  assert.equal(rs2.parts[0].status, 'completed', '已完成分片不得倒退')
  assert.equal(rs2.parts[1].status, 'pending')
  assert.equal(rs2.runStatus, 'partial')
})

// ============================================================
// E：幂等清理
// ============================================================
test('E1 收窄 stageIds：清理非目标阶段旧分片（防 merge 消费旧片）', () => {
  const rd = setupRun('run-003')
  prepareVerifyInput({ runDir: rd, branch: 'client', stageIds: 'ALL', date: DATE })
  const dir = path.join(rd, '2-client/runtime/verify-input')
  assert.ok(fs.readdirSync(dir).some((n) => n.startsWith('ST-C02-cp')))
  const r = prepareVerifyInput({ runDir: rd, branch: 'client', stageIds: 'ST-C01', date: DATE })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  const left = fs.readdirSync(dir).filter((n) => n.endsWith('.json') && n !== 'manifest.json')
  assert.ok(left.every((n) => n.startsWith('ST-C01-cp')), 'ST-C02 旧分片必须清理：' + JSON.stringify(left))
  const rs = readJson(path.join(rd, '2-client/runtime/run-status.json'))
  assert.equal(rs.parts.length, 1)
})

// ============================================================
// F：失败路径
// ============================================================
test('F1 Registry 缺失 → fail', () => {
  const rd = path.join(TMP, 'runs/no-registry')
  fs.rmSync(rd, { recursive: true, force: true })
  const r = prepareVerifyInput({ runDir: rd, branch: 'client', stageIds: 'ALL', date: DATE })
  assert.equal(r.ok, false)
  assert.ok(r.problems.some((p) => p.includes('Registry 不可读')))
})

test('F2 阶段不在 Registry → fail', () => {
  const rd = setupRun('run-004')
  const r = prepareVerifyInput({ runDir: rd, branch: 'client', stageIds: 'ST-C99', date: DATE })
  assert.equal(r.ok, false)
  assert.ok(r.problems.some((p) => p.includes('阶段不在 Registry')))
})

test('F3 branch 非法 → fail', () => {
  const rd = setupRun('run-005')
  const r = prepareVerifyInput({ runDir: rd, branch: 'both', stageIds: 'ALL', date: DATE })
  assert.equal(r.ok, false)
  assert.ok(r.problems.some((p) => p.includes('branch 必须是')))
})

test('F4 CLI 参数缺失 → 退出码 1', () => {
  let code = 0
  try {
    execFileSync('node', [SCRIPT, '--run-dir', TMP], { encoding: 'utf8', cwd: REPO_ROOT, stdio: 'pipe' })
  } catch (e) {
    code = e.status
  }
  assert.equal(code, 1)
})

// ============================================================
// G：端到端串联 prepare → collect → merge（统计不变式通过）
// ============================================================
test('G1 端到端：prepare(pending) → agent 写分片+置 completed → collect → merge 全链通过', () => {
  const rd = setupRun('run-e2e')
  // 1. prepare
  const prep = prepareVerifyInput({ runDir: rd, branch: 'client', stageIds: 'ALL', date: DATE })
  assert.equal(prep.ok, true, JSON.stringify(prep.problems))

  // 2. 模拟 agent：按分片写最小合法落判（每原子 not_found，无证据）
  const inDir = path.join(rd, '2-client/runtime/verify-input')
  const outDir = path.join(rd, '2-client/runtime/verify-output')
  fs.mkdirSync(outDir, { recursive: true })
  for (const partMeta of prep.manifest.stages.flatMap((s) => s.partFiles)) {
    const input = readJson(path.join(inDir, partMeta))
    const entries = input.featureGroups.flatMap((g) =>
      g.atoms.map((a) => ({
        atomId: a.atomId, verdict: 'not_found', clientLogic: '', uiInteraction: '',
        messages: [], notes: '端到端用例', directConflict: false, conflictEvidenceIds: [],
        observedBehavior: { trigger: '', condition: '', action: '', result: '' }, evidenceIds: [],
      }))
    )
    writeJson(path.join(outDir, partMeta), { schemaVersion: 1, stageId: input.stageId, partNo: input.partNo, entries, evidence: [] })
  }

  // 3. 落盘成功 → run-status 置 completed（workflow/merge 前的确定性步骤）
  const rsPath = path.join(rd, '2-client/runtime/run-status.json')
  const rs = readJson(rsPath)
  for (const p of rs.parts) p.status = 'completed'
  rs.runStatus = 'completed'
  writeJson(rsPath, rs)

  // 4. collect-source-manifest：无证据文件（全 not_found）→ 以 Registry 所在仓占位一个真实文件
  const srcRoot = path.join(TMP, 'src')
  fs.mkdirSync(path.join(srcRoot, 'layer'), { recursive: true })
  fs.writeFileSync(path.join(srcRoot, 'layer/Marker.ts'), 'export const x = 1\n', 'utf8')
  const mc = collectSourceManifest({
    branch: 'client', roots: [srcRoot], repoIds: ['client-code'],
    filePaths: ['layer/Marker.ts'], date: DATE, gitCommitReader: () => 'unversioned',
  })
  assert.equal(mc.ok, true, JSON.stringify(mc.problems))
  writeJson(path.join(rd, '2-client/runtime/source-manifest.json'), mc.manifest)

  // 5. merge
  const r = mergeBranchEvidence({
    runDir: rd, branch: 'client', date: DATE, registry: readJson(path.join(rd, '1-registry/requirement-registry.json')),
    sourceManifest: mc.manifest, fileHashes: mc.fileHashes,
  })
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  assert.equal(r.summary.entryCount, 15)
  assert.equal(r.summary.coverage.pendingAtomIds.length, 0)
  assert.equal(r.summary.entryCount + r.summary.coverage.pendingAtomIds.length, r.summary.expectedAtomCount)
  assert.equal(r.summary.stats.not_found, 15)
  assert.equal(r.summary.stats.pending, 0)
})

fs.rmSync(TMP, { recursive: true, force: true })

console.log('prepare-verify-input.example：' + (process.exitCode ? '存在失败' : '全部通过'))
for (const line of results) console.log('  ' + line)
process.exit(process.exitCode || 0)
