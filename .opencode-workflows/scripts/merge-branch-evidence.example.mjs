// merge-branch-evidence.example.mjs —— 双端证据确定性合并自检 + Gold Set 双端场景（断言式）
//
// 执行文档 §5.0 A/B、§9 Gold Set 矩阵（G01/G02/G03/G05/G06/G07/G08 的确定性等价）、§13。
// 覆盖：
//   A. §5.0 A 统计口径：entry 每原子恰一条、pending 由 run-status 判定、
//      不变式 entryCount + pendingAtomIds = expectedAtomCount、条目不存 pending 字段
//   B. §5.0 B M1~M8：分片码元序读取 / 同键合并（atomIds 并集按 Registry 顺序）/
//      ID 归属 Registry 最早支撑原子 / 既有产物沿用原 id（幂等）/ 同 id 不同合并键 fail（劫持）
//   C. M5 乱序不变式：打乱分片交付顺序 + 改文件创建顺序 + 跨进程重跑 → 产物逐字节一致
//   D. M7 跨平台确定性排序：码元序（非区域排序）、'/' 分隔、大小写不折叠、空 symbol 排前、
//      location 规范 <file>:<起>-<止>
//   E. M8 语义去重边界：同指针不同 claimKey → 两条独立证据各自保留（G05 断言）
//   F. D18/D22 版本回填：(repoId, file) 联合匹配、dependencyFiles hash、未覆盖 fail
//   G. Gold Set：G01 冲突不被另一端 pending 阻塞（directConflict 落地）/ G02 单端立证 /
//      G03 refuse verified 依赖数据（scope 侧）/ G05 共享证据影响集合 / G06 commit 变 hash 不变仍有效 /
//      G07 hash 变标记 stale / G08 依赖链变化
//   H. 失败路径：verdict/证据自洽、引用一致性、layer 白名单、claimKey 空、actor 外来原子
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mergeBranchEvidence } from './merge-branch-evidence.mjs'
import { collectSourceManifest } from './collect-source-manifest.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = path.join(REPO_ROOT, '.opencode-workflows/scripts/merge-branch-evidence.mjs')
const TMP = path.join(REPO_ROOT, '.opencode-workflows/scripts/tmp-merge-branch')
const DATE = '2099-01-01'
const KEY_SEP = '\u0000'

const writeJson = (p, data) => {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(data, null, 1) + '\n', 'utf8')
}
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))

// ---- fixture：Registry（3 原子，2 阶段）----
function makeRegistry() {
  return {
    schemaVersion: 1,
    date: DATE,
    stages: [
      { stageId: 'ST-C01', name: '定庄', chapter: '开局 > 定庄', summary: 's', featureCount: 1, atomCount: 2 },
      { stageId: 'ST-C02', name: '财神', chapter: '开局 > 财神', summary: 's', featureCount: 1, atomCount: 1 },
    ],
    features: [
      {
        id: 'FP-ST-C01-001', stageId: 'ST-C01', name: 'f1', description: '', scope: '', coordination: '',
        atoms: [
          { atomId: 'AT-ST-C01-001', name: 'a1', rule: 'r1', uiRequirement: '', verificationScope: 'both',
            businessBehavior: { trigger: '', condition: '', action: '', result: '' }, source: { chapter: '', fromLine: 6, toLine: 7 } },
          { atomId: 'AT-ST-C01-002', name: 'a2', rule: 'r2', uiRequirement: '', verificationScope: 'both',
            businessBehavior: { trigger: '', condition: '', action: '', result: '' }, source: { chapter: '', fromLine: 8, toLine: 8 } },
        ],
      },
      {
        id: 'FP-ST-C02-001', stageId: 'ST-C02', name: 'f2', description: '', scope: '', coordination: '',
        atoms: [
          { atomId: 'AT-ST-C02-001', name: 'a3', rule: 'r3', uiRequirement: '', verificationScope: 'client',
            businessBehavior: { trigger: '', condition: '', action: '', result: '' }, source: { chapter: '', fromLine: 33, toLine: 34 } },
        ],
      },
    ],
    stats: { stageCount: 2, featureCount: 2, atomCount: 3, perStage: [], scopeStats: { client: 1, server: 0, both: 2 } },
  }
}

// ---- fixture：源码文件（客户端两仓，用于 (repoId,file)/依赖/hash 场景）----
const CLIENT_CODE = TMP + '/src/client-code'
const CLIENT_FGUI = TMP + '/src/client-fgui'
const F_VIEW = 'layer/GameMahView.ts'
const F_CTRL = 'layer/GameMahController.ts'
const F_MODEL = 'model/GameMahModel.ts'
const F_FGUI = 'box_hzmj/main/ComMain.xml'

function writeSourceFixture() {
  fs.mkdirSync(path.join(CLIENT_CODE, 'layer'), { recursive: true })
  fs.mkdirSync(path.join(CLIENT_CODE, 'model'), { recursive: true })
  fs.mkdirSync(path.join(CLIENT_FGUI, 'box_hzmj/main'), { recursive: true })
  fs.writeFileSync(path.join(CLIENT_CODE, F_VIEW), 'export const caishenMark = true // v1\n', 'utf8')
  fs.writeFileSync(path.join(CLIENT_CODE, F_CTRL), 'export const controller = 1\n', 'utf8')
  fs.writeFileSync(path.join(CLIENT_CODE, F_MODEL), 'export const model = 1\n', 'utf8')
  fs.writeFileSync(path.join(CLIENT_FGUI, F_FGUI), '<component name="main"/>\n', 'utf8')
}

// 客户端 source-manifest（两仓：client-code / client-fgui）
function collectClientManifest(date) {
  const r = collectSourceManifest({
    branch: 'client',
    roots: [CLIENT_CODE, CLIENT_FGUI],
    repoIds: ['client-code', 'client-fgui'],
    filePaths: [F_VIEW, F_CTRL, F_MODEL, 'client-fgui:' + F_FGUI],
    date: date,
    gitCommitReader: () => 'unversioned',
  })
  assert.equal(r.ok, true, 'manifest 采集应成功：' + JSON.stringify(r.problems))
  return r
}

function setupRun(runId) {
  const runDir = path.join(TMP, 'runs', runId)
  fs.rmSync(runDir, { recursive: true, force: true })
  writeJson(path.join(runDir, '1-registry/requirement-registry.json'), makeRegistry())
  writeJson(path.join(runDir, '2-client/runtime/source-manifest.json'), collectClientManifest(DATE).manifest)
  return runDir
}

// ---- fixture：分片（客户端 cp）----
// part1: ST-C01-cp01 —— 两条原子 entry，一条共享证据（atomIds 含两个原子）
// part2: ST-C02-cp01 —— 一条原子 entry，FGUI 证据
function part1Entry() {
  return {
    schemaVersion: 1, stageId: 'ST-C01', partNo: '01',
    entries: [
      { atomId: 'AT-ST-C01-001', verdict: 'confirmed', clientLogic: '视图置灰', uiInteraction: '牌置灰',
        messages: [], notes: '', directConflict: false, conflictEvidenceIds: [],
        observedBehavior: { trigger: '禁打', condition: '牌在禁打名单', action: '置灰', result: '玩家看到灰牌' },
        evidenceIds: ['CLE-AT-ST-C01-001-01'] },
      { atomId: 'AT-ST-C01-002', verdict: 'confirmed', clientLogic: '控制器判定', uiInteraction: '',
        messages: [], notes: '', directConflict: false, conflictEvidenceIds: [],
        observedBehavior: { trigger: 't', condition: '', action: '', result: '' },
        evidenceIds: ['CLE-AT-ST-C01-001-01'] },
    ],
    evidence: [
      { claimKey: 'Mah-View-Mark', repoId: 'client-code', layer: 'client_code', file: F_VIEW,
        location: 'layer/GameMahView.ts:12', symbol: 'caishenMark', excerpt: '标记', configKeys: [],
        atomIds: ['AT-ST-C01-002', 'AT-ST-C01-001'],
        dependencyFiles: [{ file: F_CTRL }, { file: F_MODEL }] },
    ],
  }
}
function part2Entry() {
  return {
    schemaVersion: 1, stageId: 'ST-C02', partNo: '01',
    entries: [
      { atomId: 'AT-ST-C02-001', verdict: 'partial', clientLogic: 'FGUI 定义', uiInteraction: '财神标记',
        messages: [], notes: '', directConflict: false, conflictEvidenceIds: [],
        observedBehavior: { trigger: '发牌', condition: '', action: '', result: '' },
        evidenceIds: ['CLE-AT-ST-C02-001-01'] },
    ],
    evidence: [
      { claimKey: 'caishen-mark-display', repoId: 'client-fgui', layer: 'client_fgui', file: F_FGUI,
        location: 'box_hzmj/main/ComMain.xml:3', symbol: '', excerpt: '财神', configKeys: [],
        atomIds: ['AT-ST-C02-001'], dependencyFiles: [] },
    ],
  }
}

// 空证据版 p2（部分用例只需 p1 的证据，此处提供合法且无证据的对照组）
function part2Empty() {
  return {
    schemaVersion: 1, stageId: 'ST-C02', partNo: '01',
    entries: [
      { atomId: 'AT-ST-C02-001', verdict: 'not_found', clientLogic: '', uiInteraction: '',
        messages: [], notes: '本用例无客户端证据', directConflict: false, conflictEvidenceIds: [],
        observedBehavior: { trigger: '', condition: '', action: '', result: '' },
        evidenceIds: [] },
    ],
    evidence: [],
  }
}

function writeParts(runDir, { p1 = part1Entry(), p2 = part2Entry(), order = 'normal' } = {}) {
  const dir = path.join(runDir, '2-client/runtime/verify-output')
  fs.mkdirSync(dir, { recursive: true })
  const items = [
    ['ST-C01-cp01.json', p1],
    ['ST-C02-cp01.json', p2],
  ]
  if (order === 'reversed') items.reverse()
  for (const [name, data] of items) writeJson(path.join(dir, name), data)
  // run-status：两片都 completed，声明覆盖原子（pending 唯一事实源）
  writeJson(path.join(runDir, '2-client/runtime/run-status.json'), {
    schemaVersion: 1, branch: 'client', date: DATE, runStatus: 'completed',
    parts: [
      { partFile: 'ST-C01-cp01.json', stageId: 'ST-C01', status: 'completed', atomIds: ['AT-ST-C01-001', 'AT-ST-C01-002'] },
      { partFile: 'ST-C02-cp01.json', stageId: 'ST-C02', status: 'completed', atomIds: ['AT-ST-C02-001'] },
    ],
  })
}

function runMerge(runDir, manifest) {
  const fileHashes = new Map()
  for (const repo of manifest.repos) {
    for (const f of repo.files) {
      fileHashes.set(repo.repoId + KEY_SEP + f.file, { contentHash: f.contentHash, sourceRevision: repo.commit, verifiedAt: manifest.collectedAt })
    }
  }
  return mergeBranchEvidence({
    runDir, branch: 'client', date: DATE,
    registry: readJson(path.join(runDir, '1-registry/requirement-registry.json')),
    sourceManifest: manifest, fileHashes,
  })
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
writeSourceFixture()

// ============================================================
// A + B：统计口径 / 同键合并 / ID 归属
// ============================================================
let run1, manifest1
test('A1 统计口径：entry 每原子恰一条 + coverage 不变式 + 条目不存 pending 字段', () => {
  run1 = setupRun('run-001')
  writeParts(run1)
  manifest1 = collectClientManifest(DATE).manifest
  const r = runMerge(run1, manifest1)
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  assert.equal(r.summary.entryCount, 3)
  assert.equal(r.summary.expectedAtomCount, 3)
  assert.deepEqual(r.summary.coverage.pendingAtomIds, [])
  assert.equal(r.summary.entryCount + r.summary.coverage.pendingAtomIds.length, r.summary.expectedAtomCount)
  for (const e of r.clientEntries) {
    assert.ok(!('pending' in e), '条目不得带 pending 字段（唯一事实源 run-status）：' + e.atomId)
  }
  assert.equal(r.clientEntries.length, 3)
  assert.equal(r.summary.stats.confirmed, 2)
  assert.equal(r.summary.stats.partial, 1)
  assert.equal(r.summary.stats.not_found, 0)
  assert.equal(r.summary.stats.directConflict, 0)
  assert.equal(r.summary.stats.pending, 0)
  assert.equal(r.summary.stats.evidenceCount, 2)
})

test('A2 pending 由 run-status 判定（分片 timeout → 该片原子进 pendingAtomIds，无 entry）', () => {
  const runDir = setupRun('run-002')
  writeParts(runDir)
  // 改 run-status：ST-C02 分片 timeout
  const rs = readJson(path.join(runDir, '2-client/runtime/run-status.json'))
  rs.parts[1].status = 'timeout'
  rs.runStatus = 'partial'
  writeJson(path.join(runDir, '2-client/runtime/run-status.json'), rs)
  const r = runMerge(runDir, manifest1)
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  assert.equal(r.summary.entryCount, 2)
  assert.deepEqual(r.summary.coverage.pendingAtomIds, ['AT-ST-C02-001'])
  assert.equal(r.clientEntries.some((e) => e.atomId === 'AT-ST-C02-001'), false, 'timeout 分片的原子不得产 entry')
  assert.equal(r.summary.stats.confirmed + r.summary.stats.partial, 2)
})

test('B1 同键合并：atomIds 并集 + 按 Registry 顺序排列（非分片提交顺序）', () => {
  const r = runMerge(run1, manifest1)
  const shared = r.evidence.evidence.find((e) => e.file === F_VIEW)
  assert.deepEqual(shared.atomIds, ['AT-ST-C01-001', 'AT-ST-C01-002'], 'atomIds 必须按 Registry 全序（001 先于 002）')
})

test('B2 ID 归属 Registry 最早支撑原子 + claimKey 规范化（小写/连字符）', () => {
  const r = runMerge(run1, manifest1)
  const shared = r.evidence.evidence.find((e) => e.file === F_VIEW)
  assert.equal(shared.id, 'CLE-AT-ST-C01-001-01', 'ID 归属最早支撑原子 AT-ST-C01-001')
  assert.equal(shared.claimKey, 'mah-view-mark', 'claimKey 规范化为小写')
})

test('B3 版本三字段与依赖 hash 由 manifest 回填（(repoId,file) 联合匹配）', () => {
  const r = runMerge(run1, manifest1)
  const shared = r.evidence.evidence.find((e) => e.file === F_VIEW)
  assert.equal(shared.sourceRevision, 'unversioned')
  assert.match(shared.contentHash, /^sha256:[0-9a-f]{64}$/)
  assert.equal(shared.verifiedAt, DATE)
  assert.equal(shared.dependencyFiles.length, 2)
  for (const d of shared.dependencyFiles) assert.match(d.contentHash, /^sha256:[0-9a-f]{64}$/, '依赖文件 hash 必须回填：' + d.file)
})

test('B4 FGUI 仓证据归仓正确（client-fgui，同 rel 路径不串仓）', () => {
  const r = runMerge(run1, manifest1)
  const fgui = r.evidence.evidence.find((e) => e.file === F_FGUI)
  assert.equal(fgui.repoId, 'client-fgui')
  assert.equal(fgui.layer, 'client_fgui')
  assert.equal(fgui.id, 'CLE-AT-ST-C02-001-01')
  // client-code 仓的 F_VIEW 不得被归到 client-fgui
  const view = r.evidence.evidence.find((e) => e.file === F_VIEW)
  assert.equal(view.repoId, 'client-code')
})

// ============================================================
// C：M5 乱序不变式（跨进程重跑，产物逐字节一致）
// ============================================================
test('C1 M5 乱序不变式：分片交付顺序颠倒 + 跨进程重跑 → 产物逐字节一致', () => {
  // 基线：run-001 经 CLI 落盘
  const outA = execFileSync('node', [SCRIPT, '--run-dir', run1, '--branch', 'client', '--date', DATE], { encoding: 'utf8', cwd: REPO_ROOT })
  assert.ok(outA.includes('[成功]'), outA)
  const baseEvidence = fs.readFileSync(path.join(run1, '2-client/client-evidence.json'), 'utf8')

  // 乱序进程：新 run，分片按反序写盘，独立进程执行 CLI
  const runDir = setupRun('run-003')
  writeParts(runDir, { order: 'reversed' })
  const out = execFileSync('node', [SCRIPT, '--run-dir', runDir, '--branch', 'client', '--date', DATE], { encoding: 'utf8', cwd: REPO_ROOT })
  assert.ok(out.includes('[成功]'), out)
  const a = fs.readFileSync(path.join(runDir, '2-client/client-evidence.json'), 'utf8')
  // 与基线逐字节一致（产物不含 run 目录路径，故可直接比对）
  assert.equal(a, baseEvidence, '乱序 + 跨进程重跑必须逐字节一致')
})

// ============================================================
// D：M7 跨平台确定性排序
// ============================================================
test('D1 M7 location 规范化：file:12-12 -> file:12，file:12 - 15 -> file:12-15', () => {
  const runDir = setupRun('run-004')
  const p1 = part1Entry()
  p1.evidence = [
    { claimKey: 'k-single', repoId: 'client-code', layer: 'client_code', file: F_VIEW, location: 'layer/GameMahView.ts:12-12', symbol: 's1', excerpt: '', configKeys: [], atomIds: ['AT-ST-C01-001'], dependencyFiles: [] },
    { claimKey: 'k-range', repoId: 'client-code', layer: 'client_code', file: F_CTRL, location: 'layer/GameMahController.ts:12 - 15', symbol: 's2', excerpt: '', configKeys: [], atomIds: ['AT-ST-C01-002'], dependencyFiles: [] },
  ]
  p1.entries[0].evidenceIds = ['CLE-AT-ST-C01-001-01']
  p1.entries[1].evidenceIds = ['CLE-AT-ST-C01-002-01']
  writeParts(runDir, { p1, p2: part2Empty() })
  const r = runMerge(runDir, manifest1)
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  const locs = r.evidence.evidence.map((e) => e.location).sort()
  assert.deepEqual(locs, ['layer/GameMahController.ts:12-15', 'layer/GameMahView.ts:12'])
})

test('D2 M7 大小写不折叠 + 符号码元序：空 symbol 排前，大小写差异视为不同指针', () => {
  const runDir = setupRun('run-005')
  const p1 = part1Entry()
  p1.evidence = [
    { claimKey: 'k-upper', repoId: 'client-code', layer: 'client_code', file: F_VIEW, location: 'layer/GameMahView.ts:20', symbol: 'Zeta', excerpt: '', configKeys: [], atomIds: ['AT-ST-C01-001'], dependencyFiles: [] },
    { claimKey: 'k-empty', repoId: 'client-code', layer: 'client_code', file: F_VIEW, location: 'layer/GameMahView.ts:30', symbol: '', excerpt: '', configKeys: [], atomIds: ['AT-ST-C01-002'], dependencyFiles: [] },
    { claimKey: 'k-lower', repoId: 'client-code', layer: 'client_code', file: F_VIEW, location: 'layer/GameMahView.ts:20', symbol: 'zeta', excerpt: '', configKeys: [], atomIds: ['AT-ST-C01-002'], dependencyFiles: [] },
  ]
  p1.entries[0].evidenceIds = ['CLE-AT-ST-C01-001-01']
  p1.entries[1].evidenceIds = ['CLE-AT-ST-C01-002-01', 'CLE-AT-ST-C01-002-02']
  writeParts(runDir, { p1, p2: part2Empty() })
  const r = runMerge(runDir, manifest1)
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  const byLoc = new Map(r.evidence.evidence.map((e) => [e.location + '|' + e.symbol, e]))
  // 同 location 不同大小写 symbol → 两条独立证据（大小写不折叠，M7）
  assert.equal(byLoc.has('layer/GameMahView.ts:20|Zeta'), true)
  assert.equal(byLoc.has('layer/GameMahView.ts:20|zeta'), true)
  assert.notEqual(byLoc.get('layer/GameMahView.ts:20|Zeta').id, byLoc.get('layer/GameMahView.ts:20|zeta').id)
})

// ============================================================
// E：M8 语义去重边界（G05 断言）
// ============================================================
test('E1 M8 同指针不同 claimKey → 两条独立证据各自保留独立 ID', () => {
  const runDir = setupRun('run-006')
  const p1 = part1Entry()
  p1.evidence = [
    { claimKey: 'rule-a', repoId: 'client-code', layer: 'client_code', file: F_VIEW, location: 'layer/GameMahView.ts:12', symbol: 'caishenMark', excerpt: 'A', configKeys: [], atomIds: ['AT-ST-C01-001'], dependencyFiles: [] },
    { claimKey: 'rule-b', repoId: 'client-code', layer: 'client_code', file: F_VIEW, location: 'layer/GameMahView.ts:12', symbol: 'caishenMark', excerpt: 'B', configKeys: [], atomIds: ['AT-ST-C01-002'], dependencyFiles: [] },
  ]
  p1.entries[0].evidenceIds = ['CLE-AT-ST-C01-001-01']
  p1.entries[1].evidenceIds = ['CLE-AT-ST-C01-002-01']
  writeParts(runDir, { p1, p2: part2Empty() })
  const r = runMerge(runDir, manifest1)
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  assert.equal(r.evidence.evidence.length, 2, '同指针不同 claimKey 必须保留两条（不为去重丢失证据语义）')
  const ids = r.evidence.evidence.map((e) => e.id).sort()
  assert.equal(new Set(ids).size, 2)
  assert.deepEqual(r.evidence.evidence.map((e) => e.claimKey).sort(), ['rule-a', 'rule-b'])
})

// ============================================================
// F：版本回填与 stale 判定（G06/G07/G08）
// ============================================================
test('F1 G06 commit 变化但证据文件 hash 不变 → 证据仍然有效（hash 优先）', () => {
  const runDir = setupRun('run-007')
  writeParts(runDir)
  const r1 = runMerge(runDir, manifest1)
  assert.equal(r1.ok, true, JSON.stringify(r1.problems))
  const h1 = r1.evidence.evidence.find((e) => e.file === F_VIEW).contentHash
  // commit 变化（模拟 gitCommitReader 返回新 sha），文件内容不变
  const r2c = collectSourceManifest({
    branch: 'client', roots: [CLIENT_CODE, CLIENT_FGUI], repoIds: ['client-code', 'client-fgui'],
    filePaths: [F_VIEW, F_CTRL, F_MODEL, 'client-fgui:' + F_FGUI], date: DATE,
    gitCommitReader: () => 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  })
  assert.equal(r2c.ok, true)
  const r2 = runMerge(runDir, r2c.manifest)
  assert.equal(r2.ok, true, JSON.stringify(r2.problems))
  const e2 = r2.evidence.evidence.find((e) => e.file === F_VIEW)
  assert.equal(e2.sourceRevision, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', 'commit 应变')
  assert.equal(e2.contentHash, h1, '文件 hash 不变 → 证据有效（不因 commit 漂移失效）')
})

test('F2 G07 证据文件 hash 变化 → contentHash 变化（下游据此标 stale）', () => {
  const runDir = setupRun('run-008')
  writeParts(runDir)
  const r1 = runMerge(runDir, manifest1)
  const h1 = r1.evidence.evidence.find((e) => e.file === F_VIEW).contentHash
  fs.writeFileSync(path.join(CLIENT_CODE, F_VIEW), 'export const caishenMark = false // v2 CHANGED\n', 'utf8')
  const r2c = collectClientManifest(DATE)
  const r2 = runMerge(runDir, r2c.manifest)
  assert.equal(r2.ok, true, JSON.stringify(r2.problems))
  const h2 = r2.evidence.evidence.find((e) => e.file === F_VIEW).contentHash
  assert.notEqual(h2, h1, '文件内容变化 → contentHash 必须变化')
  // 恢复
  fs.writeFileSync(path.join(CLIENT_CODE, F_VIEW), 'export const caishenMark = true // v1\n', 'utf8')
})

test('F3 G08 依赖链文件 hash 变化、证据文件 hash 不变 → dependencyFiles hash 变化（可判依赖链复核）', () => {
  const runDir = setupRun('run-009')
  writeParts(runDir)
  const r1 = runMerge(runDir, manifest1)
  const ev1 = r1.evidence.evidence.find((e) => e.file === F_VIEW)
  const depCtrl1 = ev1.dependencyFiles.find((d) => d.file === F_CTRL).contentHash
  fs.writeFileSync(path.join(CLIENT_CODE, F_CTRL), 'export const controller = 2 // CHANGED\n', 'utf8')
  const r2 = runMerge(runDir, collectClientManifest(DATE).manifest)
  const ev2 = r2.evidence.evidence.find((e) => e.file === F_VIEW)
  assert.equal(ev2.contentHash, ev1.contentHash, '证据文件 hash 不变')
  const depCtrl2 = ev2.dependencyFiles.find((d) => d.file === F_CTRL).contentHash
  assert.notEqual(depCtrl2, depCtrl1, '依赖文件 hash 变化必须可观测（触发依赖链复核，不自动 stale）')
  fs.writeFileSync(path.join(CLIENT_CODE, F_CTRL), 'export const controller = 1\n', 'utf8')
})

test('F4 证据文件未被 manifest 覆盖 → fail（(repoId,file) 联合匹配必须命中）', () => {
  const runDir = setupRun('run-010')
  const p1 = part1Entry()
  p1.evidence[0].file = 'layer/NotCollected.ts'
  writeParts(runDir, { p1 })
  fs.writeFileSync(path.join(CLIENT_CODE, 'layer/NotCollected.ts'), 'x\n', 'utf8')
  const r = runMerge(runDir, manifest1) // manifest 未采集该文件
  assert.equal(r.ok, false)
  assert.ok(r.problems.some((p) => p.includes('未被 source-manifest 覆盖')), JSON.stringify(r.problems))
})

// ============================================================
// G：Gold Set 场景（G01/G02 冲突语义；G05 共享证据影响集合）
// ============================================================
test('G01 冲突不被另一端 pending 阻塞：directConflict 落地 + conflictEvidenceIds 引用自洽', () => {
  const runDir = setupRun('run-011')
  const p1 = part1Entry()
  // AT-ST-C01-001 directConflict 指向共享证据（客户端视觉冲突；服务端侧本步无产物也不影响统计）
  p1.entries[0].directConflict = true
  p1.entries[0].clientLogic = '牌河中白板财神仍高亮（与需求矛盾）'
  p1.entries[0].conflictEvidenceIds = ['CLE-AT-ST-C01-001-01']
  writeParts(runDir, { p1 })
  const r = runMerge(runDir, manifest1)
  assert.equal(r.ok, true, JSON.stringify(r.problems))
  const e = r.clientEntries.find((x) => x.atomId === 'AT-ST-C01-001')
  assert.equal(e.directConflict, true)
  assert.deepEqual(e.conflictEvidenceIds, ['CLE-AT-ST-C01-001-01'])
  assert.equal(r.summary.stats.directConflict, 1)
})

test('G02 directConflict 但 conflictEvidenceIds 为空 → fail（单端立证也必须带矛盾证据）', () => {
  const runDir = setupRun('run-012')
  const p1 = part1Entry()
  p1.entries[0].directConflict = true
  p1.entries[0].conflictEvidenceIds = []
  writeParts(runDir, { p1 })
  const r = runMerge(runDir, manifest1)
  assert.equal(r.ok, false)
  assert.ok(r.problems.some((p) => p.includes('directConflict=true 必带 conflictEvidenceIds')), JSON.stringify(r.problems))
})

test('G05 共享证据单条多原子：SVE/CLE 只存一条，atomIds 并集（影响集合反查基础）', () => {
  const r = runMerge(run1, manifest1)
  const shared = r.evidence.evidence.filter((e) => e.file === F_VIEW)
  assert.equal(shared.length, 1, '共享证据只存一条')
  assert.ok(shared[0].atomIds.includes('AT-ST-C01-001') && shared[0].atomIds.includes('AT-ST-C01-002'))
})

// ============================================================
// H：失败路径
// ============================================================
function expectFail(name, mutate, expectPart) {
  test(name, () => {
    const runDir = setupRun('run-f-' + Math.random().toString(36).slice(2, 8))
    const p1 = part1Entry()
    if (mutate.parts) mutate.parts(p1)
    writeParts(runDir, { p1 })
    const r = runMerge(runDir, manifest1)
    assert.equal(r.ok, false, '应失败')
    assert.ok(r.problems.some((p) => p.includes(expectPart)), '应包含「' + expectPart + '」，实际：' + JSON.stringify(r.problems))
  })
}

expectFail('H1 verdict=confirmed 但无证据 → fail', {
  parts: (p) => { p.entries[0].verdict = 'confirmed'; p.entries[0].evidenceIds = [] },
}, '必须带证据')

expectFail('H2 verdict=not_found 却带证据 → fail', {
  parts: (p) => { p.entries[0].verdict = 'not_found'; p.entries[0].evidenceIds = ['CLE-AT-ST-C01-001-01'] },
}, 'not_found 不得带证据')

expectFail('H3 引用一致性：被引证据 atomIds 不含引用方原子 → fail', {
  parts: (p) => {
    p.evidence[0].atomIds = ['AT-ST-C01-001'] // 证据只支撑 001
    p.entries[1].evidenceIds = ['CLE-AT-ST-C01-001-01'] // 002 却引用它
  },
}, '引用一致性失败')

expectFail('H4 layer 非法（客户端分支给服务端 layer）→ fail', {
  parts: (p) => { p.evidence[0].layer = 'common_game' },
}, 'layer 非法')

expectFail('H5 claimKey 为空 → fail', {
  parts: (p) => { p.evidence[0].claimKey = '  ' },
}, 'claimKey')

expectFail('H6 外来原子（atomId 不在 Registry）→ fail', {
  parts: (p) => { p.entries[0].atomId = 'AT-ST-C99-001' },
}, '不在 Registry')

expectFail('H7 原子条目重复（同一原子两条）→ fail', {
  parts: (p) => { p.entries[1].atomId = 'AT-ST-C01-001' },
}, '原子条目重复')

// ============================================================
// I：幂等（既有正式产物同合并键沿用原 id）
// ============================================================
test('I1 幂等重跑：既有正式产物同合并键沿用原 id，不重编号', () => {
  const runDir = setupRun('run-013')
  writeParts(runDir)
  const r1 = runMerge(runDir, manifest1)
  assert.equal(r1.ok, true, JSON.stringify(r1.problems))
  const ids1 = r1.evidence.evidence.map((e) => e.id).sort()
  // 写正式产物（模拟 CLI 已落盘）
  writeJson(path.join(runDir, '2-client/client-evidence.json'), {
    schemaVersion: 1, date: DATE, source: [{ repoId: 'client-code' }, { repoId: 'client-fgui' }],
    entries: r1.clientEntries, evidence: r1.evidence.evidence, coverage: r1.summary.coverage, stats: r1.summary.stats,
  })
  const r2 = runMerge(runDir, manifest1)
  assert.equal(r2.ok, true, JSON.stringify(r2.problems))
  assert.deepEqual(r2.evidence.evidence.map((e) => e.id).sort(), ids1, '同合并键必须沿用原 id（幂等）')
})

// ============================================================
// J：stageIds 收窄（未调度原子归入 pending，不阻断）
// ============================================================
test('J1 stageIds 收窄：仅跑 ST-C01 分片时，ST-C02 原子归入 pendingAtomIds 而不报错', () => {
  const runDir = setupRun('run-scope')
  // 只写 ST-C01 分片；ST-C02 完全未调度
  const dir = path.join(runDir, '2-client/runtime/verify-output')
  fs.mkdirSync(dir, { recursive: true })
  writeJson(path.join(dir, 'ST-C01-cp01.json'), part1Entry())
  writeJson(path.join(runDir, '2-client/runtime/run-status.json'), {
    schemaVersion: 1, branch: 'client', date: DATE, runStatus: 'partial',
    parts: [{ partFile: 'ST-C01-cp01.json', stageId: 'ST-C01', status: 'completed', atomIds: ['AT-ST-C01-001', 'AT-ST-C01-002'] }],
  })
  const r = runMerge(runDir, manifest1)
  assert.equal(r.ok, true, 'stageIds 收窄不应阻断：' + JSON.stringify(r.problems))
  assert.equal(r.summary.entryCount, 2)
  assert.deepEqual(r.summary.coverage.pendingAtomIds, ['AT-ST-C02-001'], '未调度原子必须归入 pending')
  assert.equal(r.summary.entryCount + r.summary.coverage.pendingAtomIds.length, r.summary.expectedAtomCount, '不变式仍成立')
  assert.ok((r.summary.warnings || []).some((w) => w.includes('本轮未调度原子')), '必须留下未调度告警')
})

fs.rmSync(TMP, { recursive: true, force: true })

console.log('merge-branch-evidence.example：' + (process.exitCode ? '存在失败' : '全部通过'))
for (const line of results) console.log('  ' + line)
process.exit(process.exitCode || 0)
