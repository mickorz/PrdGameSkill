// build-requirement-registry.example.mjs —— build-requirement-registry.mjs 自检（断言式，跑完打印结果退出）
// 执行文档 §12.7。覆盖：
//   A. happy path（2 阶段全覆盖）：Registry/identity-map 产物结构、统计重算（含 scopeStats/perStage）、
//      Registry 全序（分片码元序 -> 功能点序 -> 原子序）、stages[] 头字段归一（D36）
//   B. 归一化断言：verificationScope 缺失归一 both、businessBehavior 缺键补空串、
//      source.chapter 缺省归一 scan.sourceTitle、分片头 name/chapter/summary 归一
//   C. identity-map：terms 名词章节确定性解析（- **术语**：定义）、stageChapters 由 scan 派生
//   D. 失败路径：atomId 重复 / 行号越界（低于阶段行段与超出阶段行段）/ verificationScope 非法值 /
//      缺片（scan 阶段无分片）/ FP ID 非法 / AT ID 不属于本阶段 / rule 为空 / 同阶段多分片 / 外来分片
//   E. CLI：full 模式写 registry/identity-map/registry-stats；validate-only 不写正式产物、
//      --recount-out 写重算摘要；失败退出码 1 且不写产物
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildRequirementRegistry } from './build-requirement-registry.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = path.join(REPO_ROOT, '.opencode-workflows/scripts/build-requirement-registry.mjs')
const TMP = path.join(REPO_ROOT, '.opencode-workflows/scripts/tmp-build-registry')
const DATE = '2099-01-01'

const runCli = (args) => {
  try {
    const out = execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }
  }
}

const writeJson = (p, data) => {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(data, null, 1) + '\n', 'utf8')
}

// fixture 模板（名词章节在第 2~5 行，供 terms 解析；模板根相对路径供脚本按 cwd 解析）
const TEMPLATE_REL = '.opencode-workflows/scripts/tmp-build-registry/template.md'
const TEMPLATE_ABS = path.join(REPO_ROOT, TEMPLATE_REL)

function makeScan() {
  return {
    templatePath: TEMPLATE_REL,
    totalLines: 60,
    sections: [
      { no: 1, title: '文档', fromLine: 1, toLine: 1, kind: 'intro' },
      { no: 2, title: '名词', fromLine: 2, toLine: 5, kind: 'terms' },
      { no: 3, title: '定庄与轮庄', fromLine: 6, toLine: 30, kind: 'stage', stageId: 'ST-C01', container: '开局', sourceTitle: '开局 > 定庄与轮庄' },
      { no: 4, title: '财神与牌组', fromLine: 31, toLine: 60, kind: 'stage', stageId: 'ST-C02', container: '开局', sourceTitle: '开局 > 财神与牌组' },
    ],
  }
}

function makeShard1() {
  return {
    schemaVersion: 1,
    stageId: 'ST-C01',
    partNo: 1,
    stage: { stageId: 'ST-C01', name: '定庄与轮庄', chapter: '开局 > 定庄与轮庄', summary: '定庄规则' },
    features: [
      {
        id: 'FP-ST-C01-001', name: '首局定庄', description: '首局随机定庄', scope: '', coordination: '',
        atoms: [
          {
            atomId: 'AT-ST-C01-001', name: '首局随机坐庄', rule: '首局由系统随机指定一名玩家为庄家。',
            uiRequirement: '庄家标识展示', verificationScope: 'server',
            businessBehavior: { trigger: '开局', condition: '首局', action: '系统随机指定庄家', result: '一名玩家成为庄家' },
            source: { chapter: '开局 > 定庄与轮庄', fromLine: 8, toLine: 9 },
          },
          // 归一化样例：scope 缺失 -> both；businessBehavior 缺键 -> 空串；source.chapter 缺省 -> scan.sourceTitle
          {
            atomId: 'AT-ST-C01-002', name: '后续赢家坐庄', rule: '后续小局由上一局赢家坐庄。',
            uiRequirement: '',
            businessBehavior: { trigger: '小局结束' },
            source: { fromLine: 12, toLine: 12 },
          },
        ],
      },
    ],
  }
}

function makeShard2() {
  return {
    schemaVersion: 1,
    stageId: 'ST-C02',
    partNo: 1,
    stage: { stageId: 'ST-C02', name: '财神与牌组', chapter: '开局 > 财神与牌组', summary: '' },
    features: [
      {
        id: 'FP-ST-C02-001', name: '白板财神', description: '白板固定为财神', scope: '', coordination: '',
        atoms: [
          {
            atomId: 'AT-ST-C02-001', name: '财神标记', rule: '白板固定为财神，牌面带财神标记。',
            uiRequirement: '财神标记显示方式', verificationScope: 'client',
            businessBehavior: { trigger: '发牌', condition: '白板', action: '展示财神标记', result: '玩家看到财神标记' },
            source: { chapter: '开局 > 财神与牌组', fromLine: 33, toLine: 34 },
          },
        ],
      },
    ],
  }
}

function setupFixture() {
  fs.rmSync(TMP, { recursive: true, force: true })
  fs.mkdirSync(TMP, { recursive: true })
  fs.writeFileSync(TEMPLATE_ABS, [
    '# 测试模板',
    '## 名词',
    '- **财神**：白板固定为财神。',
    '- **流局**：牌墙摸完无人胡牌。',
    '- 未知格式行（不解析）',
    '## 开局',
  ].join('\n') + '\n', 'utf8')
  writeJson(path.join(TMP, '1-registry/runtime/state/scan.json'), makeScan())
  writeJson(path.join(TMP, '1-registry/runtime/atom-parts/ST-C01-ap01.json'), makeShard1())
  writeJson(path.join(TMP, '1-registry/runtime/atom-parts/ST-C02-ap01.json'), makeShard2())
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

// ============================================================
// A. happy path（库函数直调）
// ============================================================
setupFixture()
let r = buildRequirementRegistry({ runDir: TMP, date: DATE })

test('A1 校验通过且统计重算一致（2 阶段/2 功能点/3 原子，scope server 1 client 1 both 1）', () => {
  assert.equal(r.ok, true)
  assert.equal(r.summary.stageCount, 2)
  assert.equal(r.summary.featureTotal, 2)
  assert.equal(r.summary.atomTotal, 3)
  assert.deepEqual(r.summary.scopeStats, { client: 1, server: 1, both: 1 })
})

test('A2 Registry 结构：stages[] 头字段 + features 全序（ST-C01 先于 ST-C02）', () => {
  assert.equal(r.registry.schemaVersion, 1)
  assert.equal(r.registry.date, DATE)
  assert.equal(r.registry.source.templatePath, TEMPLATE_REL)
  assert.equal(r.registry.source.totalLines, 60)
  assert.deepEqual(r.registry.stages.map((s) => s.stageId), ['ST-C01', 'ST-C02'])
  const st = r.registry.stages[0]
  assert.equal(st.name, '定庄与轮庄')
  assert.equal(st.chapter, '开局 > 定庄与轮庄')
  assert.equal(st.summary, '定庄规则')
  assert.equal(st.featureCount, 1)
  assert.equal(st.atomCount, 2)
  // summary 缺省归一空串（分片头 summary 为空）
  assert.equal(r.registry.stages[1].summary, '')
  assert.deepEqual(r.registry.features.map((f) => f.id), ['FP-ST-C01-001', 'FP-ST-C02-001'])
  assert.deepEqual(r.registry.features[0].atoms.map((a) => a.atomId), ['AT-ST-C01-001', 'AT-ST-C01-002'])
})

test('A3 归一化：scope 缺失归一 both、businessBehavior 缺键补空串、source.chapter 缺省 scan.sourceTitle', () => {
  const at2 = r.registry.features[0].atoms[1]
  assert.equal(at2.verificationScope, 'both')
  assert.deepEqual(at2.businessBehavior, { trigger: '小局结束', condition: '', action: '', result: '' })
  assert.equal(at2.source.chapter, '开局 > 定庄与轮庄')
  assert.equal(at2.source.fromLine, 12)
})

test('A4 identity-map：terms 确定性解析（2 条）+ stageChapters 由 scan 派生', () => {
  assert.equal(r.identityMap.schemaVersion, 1)
  assert.deepEqual(r.identityMap.terms.map((t) => t.term), ['财神', '流局'])
  assert.equal(r.identityMap.terms[0].definition, '白板固定为财神。')
  assert.equal(r.identityMap.terms[0].source, '模板名词章节')
  assert.deepEqual(r.identityMap.stageChapters, [
    { stageId: 'ST-C01', chapter: '开局 > 定庄与轮庄', sourceTitle: '定庄与轮庄', fromLine: 6, toLine: 30 },
    { stageId: 'ST-C02', chapter: '开局 > 财神与牌组', sourceTitle: '财神与牌组', fromLine: 31, toLine: 60 },
  ])
  assert.deepEqual(r.identityMap.crossCutting, [])
})

test('A5 stats 块与 summary 一致（perStage 逐阶段）', () => {
  assert.deepEqual(r.registry.stats.perStage, [
    { stageId: 'ST-C01', features: 1, atoms: 2, client: 0, server: 1, both: 1 },
    { stageId: 'ST-C02', features: 1, atoms: 1, client: 1, server: 0, both: 0 },
  ])
  assert.deepEqual(r.registry.stats.scopeStats, { client: 1, server: 1, both: 1 })
})

// ============================================================
// B. 失败路径（库函数直调，逐个构造坏分片）
// ============================================================
function withShard1(mutate) {
  const shard = makeShard1()
  mutate(shard)
  writeJson(path.join(TMP, '1-registry/runtime/atom-parts/ST-C01-ap01.json'), shard)
}

test('B1 atomId 重复 -> fail', () => {
  withShard1((s) => { s.features[0].atoms[1].atomId = 'AT-ST-C01-001' })
  const x = buildRequirementRegistry({ runDir: TMP, date: DATE })
  assert.equal(x.ok, false)
  assert.ok(x.problems.some((p) => p.includes('原子项 ID 重复')))
})

test('B2 行号越界（超出阶段行段）-> fail', () => {
  withShard1((s) => { s.features[0].atoms[0].source = { chapter: '', fromLine: 31, toLine: 32 } })
  const x = buildRequirementRegistry({ runDir: TMP, date: DATE })
  assert.equal(x.ok, false)
  assert.ok(x.problems.some((p) => p.includes('行号未落在阶段章节行段') && p.includes('AT-ST-C01-001')))
})

test('B2b 行号越界（低于阶段行段起点）-> fail', () => {
  withShard1((s) => { s.features[0].atoms[0].source = { chapter: '', fromLine: 1, toLine: 5 } })
  const x = buildRequirementRegistry({ runDir: TMP, date: DATE })
  assert.equal(x.ok, false)
  assert.ok(x.problems.some((p) => p.includes('行号未落在阶段章节行段')))
})

test('B3 verificationScope 非法值 -> fail（缺失归一 both 见 A3）', () => {
  withShard1((s) => { s.features[0].atoms[0].verificationScope = 'frontend' })
  const x = buildRequirementRegistry({ runDir: TMP, date: DATE })
  assert.equal(x.ok, false)
  assert.ok(x.problems.some((p) => p.includes('verificationScope 非法枚举')))
})

test('B4 缺片（scan 阶段无分片）-> fail', () => {
  fs.rmSync(path.join(TMP, '1-registry/runtime/atom-parts/ST-C02-ap01.json'))
  const x = buildRequirementRegistry({ runDir: TMP, date: DATE })
  assert.equal(x.ok, false)
  assert.ok(x.problems.some((p) => p.includes('scan 阶段缺分片：ST-C02')))
  writeJson(path.join(TMP, '1-registry/runtime/atom-parts/ST-C02-ap01.json'), makeShard2())
})

test('B5 FP ID 非法 -> fail', () => {
  withShard1((s) => { s.features[0].id = 'FP-C01-001' })
  const x = buildRequirementRegistry({ runDir: TMP, date: DATE })
  assert.equal(x.ok, false)
  assert.ok(x.problems.some((p) => p.includes('功能点 ID 非法')))
})

test('B5b AT ID 不属于本阶段 -> fail', () => {
  withShard1((s) => { s.features[0].atoms[0].atomId = 'AT-ST-C02-009' })
  const x = buildRequirementRegistry({ runDir: TMP, date: DATE })
  assert.equal(x.ok, false)
  assert.ok(x.problems.some((p) => p.includes('不属于本阶段')))
})

test('B6 rule 为空 -> fail', () => {
  withShard1((s) => { s.features[0].atoms[0].rule = '  ' })
  const x = buildRequirementRegistry({ runDir: TMP, date: DATE })
  assert.equal(x.ok, false)
  assert.ok(x.problems.some((p) => p.includes('rule 为空')))
})

test('B7 同阶段多分片 -> fail', () => {
  writeJson(path.join(TMP, '1-registry/runtime/atom-parts/ST-C01-ap02.json'), makeShard1())
  const x = buildRequirementRegistry({ runDir: TMP, date: DATE })
  assert.equal(x.ok, false)
  assert.ok(x.problems.some((p) => p.includes('同阶段多分片')))
  fs.rmSync(path.join(TMP, '1-registry/runtime/atom-parts/ST-C01-ap02.json'))
})

test('B8 外来分片（stageId 不在 scan）-> fail', () => {
  writeJson(path.join(TMP, '1-registry/runtime/atom-parts/ST-C09-ap01.json'), makeShard1())
  const x = buildRequirementRegistry({ runDir: TMP, date: DATE })
  assert.equal(x.ok, false)
  assert.ok(x.problems.some((p) => p.includes('外来分片')))
  fs.rmSync(path.join(TMP, '1-registry/runtime/atom-parts/ST-C09-ap01.json'))
})

// ============================================================
// C. CLI（full / validate-only / 失败退出码）
// ============================================================
setupFixture()

test('C1 CLI full 模式：写三产物（registry/identity-map/registry-stats），退出码 0', () => {
  const c = runCli(['--run-dir', TMP, '--date', DATE])
  assert.equal(c.code, 0)
  assert.ok(c.out.includes('[成功]'))
  const reg = JSON.parse(fs.readFileSync(path.join(TMP, '1-registry/requirement-registry.json'), 'utf8'))
  assert.equal(reg.stats.atomCount, 3)
  assert.ok(fs.existsSync(path.join(TMP, '1-registry/identity-map.json')))
  const st = JSON.parse(fs.readFileSync(path.join(TMP, '1-registry/runtime/registry-stats.json'), 'utf8'))
  assert.equal(st.atomCount, 3)
  assert.deepEqual(st.scopeStats, { client: 1, server: 1, both: 1 })
})

test('C2 CLI validate-only：不写正式产物 + --recount-out 写重算摘要', () => {
  setupFixture()
  const recountOut = path.join(TMP, '1-registry/runtime/atom-recount.json')
  const c = runCli(['--run-dir', TMP, '--date', DATE, '--validate-only', '--recount-out', recountOut])
  assert.equal(c.code, 0)
  assert.ok(c.out.includes('validate-only'))
  assert.ok(!fs.existsSync(path.join(TMP, '1-registry/requirement-registry.json')))
  assert.ok(!fs.existsSync(path.join(TMP, '1-registry/identity-map.json')))
  const rc = JSON.parse(fs.readFileSync(recountOut, 'utf8'))
  assert.equal(rc.atomTotal, 3)
  assert.equal(rc.mode, 'validate-only')
  assert.deepEqual(rc.scopeStats, { client: 1, server: 1, both: 1 })
})

test('C3 CLI 失败：退出码 1 且不写正式产物', () => {
  setupFixture()
  withShard1((s) => { s.features[0].atoms[0].source = { chapter: '', fromLine: 99, toLine: 99 } })
  const c = runCli(['--run-dir', TMP, '--date', DATE])
  assert.equal(c.code, 1)
  assert.ok(c.out.includes('[失败]'))
  assert.ok(c.out.includes('行号未落在阶段章节行段'))
  assert.ok(!fs.existsSync(path.join(TMP, '1-registry/requirement-registry.json')))
})

test('C4 CLI 参数缺失：退出码 1', () => {
  const c = runCli(['--run-dir', TMP])
  assert.equal(c.code, 1)
})

// ============================================================
// 清理
// ============================================================
fs.rmSync(TMP, { recursive: true, force: true })

console.log('build-requirement-registry.example：' + (process.exitCode ? '存在失败' : '全部通过'))
for (const line of results) console.log('  ' + line)
process.exit(process.exitCode || 0)
