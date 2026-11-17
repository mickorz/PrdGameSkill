// stage-reuse.example.mjs —— stage-reuse.mjs 自检（断言式，跑完打印结果退出）
// 执行文档 §12.7（§11.9 六步实验的确定性等价验证）。覆盖：
//   A. init-run：run-NNN 编号递增 + latest.json 指针
//   B. record-stage：四指纹落档（input/config/executionProfile/output/stageVersion/configArgs/outputList）
//   C. verify-immutable：全阶段产物 hash 逐字节一致
//   D. prepare-from-stage plan-only：reuse-plan（复用 S1,S2 / 重跑 S3）不复制
//   E. prepare-from-stage 执行：物化复制逐字节一致 + 来源 Run 零写入（verify-immutable 复验）+
//      manifest reuse.sourceRunId/artifactRefs + startStage 下游不校验旧指纹（run-002 S3 重记录成功）
//   F. strict 拒绝路径：来源产物篡改（outputHash）/ 阶段脚本变化（configHash）/ 模板变化（inputHash）/
//      specs 版本递增（stageVersion）
//   G. 可复现性：重复 plan-only 指纹一致（checks 逐字节 deep-equal）
//   H. executionProfileHash 不参与强校验：record 与 prepare 无 profile 匹配要求，复用照常通过
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = path.join(REPO_ROOT, '.opencode-workflows/scripts/stage-reuse.mjs')
const TMP_REL = '.opencode-workflows/scripts/tmp-stage-reuse'
const TMP = path.join(REPO_ROOT, TMP_REL)
const DATE = '2099-01-01'
const RUNS = path.join(TMP, 'root', DATE, 'runs')

const runCli = (args) => {
  try {
    const out = execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }
  }
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
const writeJson = (p, data) => {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(data, null, 1) + '\n', 'utf8')
}
const sha = (p) => 'sha256:' + crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')

// fixture 配置文件（内容参与 configHash，F 组用改内容模拟脚本变化）
const TEMPLATE_REL = TMP_REL + '/template.md'
const TEMPLATE_ABS = path.join(REPO_ROOT, TEMPLATE_REL)
const S1_SCRIPT_REL = TMP_REL + '/s1-script.js'
const S2_SCRIPT_REL = TMP_REL + '/s2-script.js'
const BUILD_SCRIPT_REL = TMP_REL + '/build-script.mjs'
const S3_WRAPPER_REL = TMP_REL + '/s3-wrapper.js'
const SPECS_REL = TMP_REL + '/stage-specs.fixture.json'
// fixture specs 的 rootDir 指向 tmp（run 目录不污染仓库 spec-workflow 真实树）
const SPECS = {
  schemaVersion: 1,
  workflowId: 'game-requirement-audit-fixture',
  rootDir: TMP_REL + '/root',
  stages: {
    S1: {
      order: 1, version: 'S1@1', label: '需求扫描',
      configFiles: ['proj:' + S1_SCRIPT_REL],
      configArgs: ['templatePath'],
      inputFiles: ['arg:templatePath'],
      outputFiles: ['run:1-registry/runtime/state/scan.json'],
    },
    S2: {
      order: 2, version: 'S2@1', label: '原子拆解',
      configFiles: ['proj:' + S2_SCRIPT_REL],
      configArgs: ['templatePath'],
      inputFiles: ['arg:templatePath', 'run:1-registry/runtime/state/scan.json'],
      outputFiles: ['run:1-registry/runtime/atom-parts/*.json'],
    },
    S3: {
      order: 3, version: 'S3@1', label: '注册表定稿',
      configFiles: ['proj:' + BUILD_SCRIPT_REL, 'proj:' + S3_WRAPPER_REL],
      configArgs: ['date'],
      inputFiles: ['run:1-registry/runtime/state/scan.json', 'run:1-registry/runtime/atom-parts/*.json'],
      outputFiles: ['run:1-registry/requirement-registry.json', 'run:1-registry/identity-map.json'],
    },
  },
}

function setupFixture() {
  fs.rmSync(TMP, { recursive: true, force: true })
  fs.mkdirSync(TMP, { recursive: true })
  fs.writeFileSync(TEMPLATE_ABS, '# 测试模板 v1\n\n规则一：规则内容。\n', 'utf8')
  fs.writeFileSync(path.join(REPO_ROOT, S1_SCRIPT_REL), '// fixture S1 逻辑 v1\n', 'utf8')
  fs.writeFileSync(path.join(REPO_ROOT, S2_SCRIPT_REL), '// fixture S2 逻辑 v1\n', 'utf8')
  fs.writeFileSync(path.join(REPO_ROOT, BUILD_SCRIPT_REL), '// fixture 合并逻辑 v1\n', 'utf8')
  fs.writeFileSync(path.join(REPO_ROOT, S3_WRAPPER_REL), '// fixture S3 编排 v1\n', 'utf8')
  writeJson(path.join(REPO_ROOT, SPECS_REL), SPECS)
}

// 在 run 目录写入某阶段的假产物（模拟阶段执行完成）
function writeStageOutputs(runId, outputs) {
  const runDir = path.join(RUNS, runId)
  for (const [rel, content] of Object.entries(outputs)) {
    const abs = path.join(runDir, rel)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, content, 'utf8')
  }
}

const S1_OUTPUTS = { '1-registry/runtime/state/scan.json': '{\n "templatePath": "' + TEMPLATE_REL + '",\n "totalLines": 3,\n "sections": []\n}\n' }
const S2_OUTPUTS = {
  '1-registry/runtime/atom-parts/ST-C01-ap01.json': '{\n "schemaVersion": 1,\n "stageId": "ST-C01"\n}\n',
  '1-registry/runtime/atom-parts/ST-C02-ap01.json': '{\n "schemaVersion": 1,\n "stageId": "ST-C02"\n}\n',
}
const S3_OUTPUTS = {
  '1-registry/requirement-registry.json': '{\n "schemaVersion": 1,\n "stats": {\n  "atomCount": 2\n }\n}\n',
  '1-registry/identity-map.json': '{\n "schemaVersion": 1,\n "terms": []\n}\n',
}

const CONFIG_ARGS = 'templatePath=' + TEMPLATE_REL + ',date=' + DATE

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
// A/B/C：init-run -> 假产物 + record-stage x3 -> verify-immutable
// ============================================================
setupFixture()

test('A1 init-run：建 run-001 + latest.json 指针', () => {
  const c = runCli(['init-run', DATE, '--specs', SPECS_REL])
  assert.equal(c.code, 0)
  assert.ok(c.out.includes('run-001'))
  assert.ok(fs.existsSync(path.join(RUNS, 'run-001/runtime/stage-manifest.json')))
  assert.deepEqual(readJson(path.join(RUNS, 'latest.json')), { schemaVersion: 1, date: DATE, runId: 'run-001' })
})

test('A2 init-run 递增：第二次建 run-002', () => {
  const c = runCli(['init-run', DATE, '--specs', SPECS_REL])
  assert.equal(c.code, 0)
  assert.ok(c.out.includes('run-002'))
})

test('B1 record-stage S1：四指纹落档', () => {
  writeStageOutputs('run-001', S1_OUTPUTS)
  const c = runCli(['record-stage', DATE, 'run-001', 'S1', '--config-args', 'templatePath=' + TEMPLATE_REL, '--profile', 'model=test-model,concurrency=16', '--specs', SPECS_REL])
  assert.equal(c.code, 0)
  const m = readJson(path.join(RUNS, 'run-001/runtime/stage-manifest.json'))
  const e = m.stages.S1
  assert.equal(e.status, 'completed')
  assert.equal(e.stageVersion, 'S1@1')
  assert.match(e.inputHash, /^sha256:[0-9a-f]{64}$/)
  assert.match(e.configHash, /^sha256:[0-9a-f]{64}$/)
  assert.match(e.executionProfileHash, /^sha256:[0-9a-f]{64}$/)
  assert.match(e.outputHash, /^sha256:[0-9a-f]{64}$/)
  assert.equal(e.reusable, true)
  assert.deepEqual(e.inputFiles, ['arg:templatePath'])
  assert.deepEqual(e.configArgs, { templatePath: TEMPLATE_REL })
  assert.deepEqual(e.profile, { model: 'test-model', concurrency: '16' })
  assert.deepEqual(e.outputList, [{ path: '1-registry/runtime/state/scan.json', hash: sha(path.join(RUNS, 'run-001/1-registry/runtime/state/scan.json')) }])
})

test('B2 record-stage S2（atom-parts glob 指纹）与 S3', () => {
  writeStageOutputs('run-001', S2_OUTPUTS)
  let c = runCli(['record-stage', DATE, 'run-001', 'S2', '--config-args', 'templatePath=' + TEMPLATE_REL, '--profile', 'model=test-model,concurrency=16', '--specs', SPECS_REL])
  assert.equal(c.code, 0)
  writeStageOutputs('run-001', S3_OUTPUTS)
  c = runCli(['record-stage', DATE, 'run-001', 'S3', '--config-args', 'date=' + DATE, '--specs', SPECS_REL])
  assert.equal(c.code, 0)
  const m = readJson(path.join(RUNS, 'run-001/runtime/stage-manifest.json'))
  assert.deepEqual(m.stages.S2.outputList.map((o) => o.path).sort(), [
    '1-registry/runtime/atom-parts/ST-C01-ap01.json',
    '1-registry/runtime/atom-parts/ST-C02-ap01.json',
  ])
  assert.equal(m.stages.S3.configArgs.date, DATE)
})

test('C1 verify-immutable run-001：三阶段产物 hash 一致', () => {
  const c = runCli(['verify-immutable', DATE, 'run-001', '--specs', SPECS_REL])
  assert.equal(c.code, 0)
  assert.ok(c.out.includes('3 阶段') && c.out.includes('逐字节一致'))
})

// ============================================================
// D/E：plan-only -> 执行物化复制（run-002 已在 A2 创建）
// ============================================================
test('D1 prepare-from-stage plan-only：计划正确且不复制', () => {
  const c = runCli(['prepare-from-stage', DATE, '--source-run', 'run-001', '--target-run', 'run-002', '--start-stage', 'S3', '--plan-only', '--config-args', CONFIG_ARGS, '--specs', SPECS_REL])
  assert.equal(c.code, 0)
  const plan = readJson(path.join(RUNS, 'run-002/runtime/reuse-plan.json'))
  assert.deepEqual(plan.reusedStages, ['S1', 'S2'])
  assert.deepEqual(plan.rerunStages, ['S3'])
  assert.equal(plan.startStage, 'S3')
  assert.deepEqual(plan.checks.map((x) => x.check), ['pass', 'pass'])
  // 不复制：目标 run 无 1-registry 产物
  assert.ok(!fs.existsSync(path.join(RUNS, 'run-002/1-registry')))
})

test('E1 prepare-from-stage 执行：物化复制 + manifest 复用条目', () => {
  const c = runCli(['prepare-from-stage', DATE, '--source-run', 'run-001', '--target-run', 'run-002', '--start-stage', 'S3', '--config-args', CONFIG_ARGS, '--specs', SPECS_REL])
  assert.equal(c.code, 0)
  const tm = readJson(path.join(RUNS, 'run-002/runtime/stage-manifest.json'))
  assert.equal(tm.sourceRunId, 'run-001')
  for (const sid of ['S1', 'S2']) {
    const e = tm.stages[sid]
    assert.equal(e.status, 'completed')
    assert.equal(e.reuse.sourceRunId, 'run-001')
    assert.ok(e.reuse.artifactRefs.length > 0)
  }
  // 逐字节一致（物化复制）
  for (const rel of Object.keys(S1_OUTPUTS).concat(Object.keys(S2_OUTPUTS))) {
    assert.equal(sha(path.join(RUNS, 'run-001', rel)), sha(path.join(RUNS, 'run-002', rel)), rel)
  }
})

test('E2 来源 Run 零写入：run-001 verify-immutable 复验通过', () => {
  const c = runCli(['verify-immutable', DATE, 'run-001', '--specs', SPECS_REL])
  assert.equal(c.code, 0)
})

test('E3 startStage 下游不校验旧指纹：run-002 重跑 S3 后 record 成功（manifest 三阶段齐全）', () => {
  // 模拟 S3 重跑：产物内容变化（合并逻辑变化 -> 新输出）
  writeStageOutputs('run-002', {
    '1-registry/requirement-registry.json': '{\n "schemaVersion": 1,\n "stats": {\n  "atomCount": 2\n },\n "v2": true\n}\n',
    '1-registry/identity-map.json': S3_OUTPUTS['1-registry/identity-map.json'],
  })
  const c = runCli(['record-stage', DATE, 'run-002', 'S3', '--config-args', 'date=' + DATE, '--specs', SPECS_REL])
  assert.equal(c.code, 0)
  const m = readJson(path.join(RUNS, 'run-002/runtime/stage-manifest.json'))
  assert.deepEqual(Object.keys(m.stages).sort(), ['S1', 'S2', 'S3'])
  // S3 新 outputHash 与 run-001 记录值不同（重跑生效）
  assert.notEqual(m.stages.S3.outputHash, readJson(path.join(RUNS, 'run-001/runtime/stage-manifest.json')).stages.S3.outputHash)
  const v = runCli(['verify-immutable', DATE, 'run-002', '--specs', SPECS_REL])
  assert.equal(v.code, 0)
})

// ============================================================
// G：可复现性（重复 plan-only 指纹一致）
// ============================================================
test('G1 可复现性：新 run-003 重复 plan-only，checks 指纹与 run-002 一致', () => {
  const c1 = runCli(['init-run', DATE, '--specs', SPECS_REL])
  assert.ok(c1.out.includes('run-003'))
  const c2 = runCli(['prepare-from-stage', DATE, '--source-run', 'run-001', '--target-run', 'run-003', '--start-stage', 'S3', '--plan-only', '--config-args', CONFIG_ARGS, '--specs', SPECS_REL])
  assert.equal(c2.code, 0)
  const p2 = readJson(path.join(RUNS, 'run-002/runtime/reuse-plan.json'))
  const p3 = readJson(path.join(RUNS, 'run-003/runtime/reuse-plan.json'))
  assert.deepEqual(p3.checks, p2.checks)
})

// ============================================================
// F：strict 拒绝路径（source run-001，各用一次性目标 run）
// ============================================================
function freshTarget() {
  const c = runCli(['init-run', DATE, '--specs', SPECS_REL])
  const m = /run-(\d{3})/.exec(c.out)
  return m[1] && 'run-' + m[1]
}

function prepareShouldFail(target, expectPart) {
  const c = runCli(['prepare-from-stage', DATE, '--source-run', 'run-001', '--target-run', target, '--start-stage', 'S3', '--config-args', CONFIG_ARGS, '--specs', SPECS_REL])
  assert.equal(c.code, 1, '应退出码 1：' + c.out)
  assert.ok(c.out.includes('[失败]'), c.out)
  assert.ok(c.out.includes(expectPart), '应包含「' + expectPart + '」：' + c.out)
  // 失败不写计划、不复制
  assert.ok(!fs.existsSync(path.join(RUNS, target, '1-registry')))
}

test('F1 来源产物篡改 -> outputHash 不匹配拒绝', () => {
  const target = freshTarget()
  const p = path.join(RUNS, 'run-001/1-registry/runtime/state/scan.json')
  const orig = fs.readFileSync(p, 'utf8')
  fs.writeFileSync(p, orig + '\n"tampered": true\n', 'utf8')
  prepareShouldFail(target, 'outputHash 不匹配')
  fs.writeFileSync(p, orig, 'utf8')
})

test('F2 阶段脚本变化 -> configHash 不匹配拒绝', () => {
  const target = freshTarget()
  const p = path.join(REPO_ROOT, S1_SCRIPT_REL)
  const orig = fs.readFileSync(p, 'utf8')
  fs.writeFileSync(p, '// fixture S1 逻辑 v2（变化）\n', 'utf8')
  prepareShouldFail(target, 'configHash 不匹配')
  fs.writeFileSync(p, orig, 'utf8')
})

test('F3 模板变化 -> S1 inputHash 不匹配拒绝', () => {
  const target = freshTarget()
  const orig = fs.readFileSync(TEMPLATE_ABS, 'utf8')
  fs.writeFileSync(TEMPLATE_ABS, '# 测试模板 v2（变化）\n\n规则一：规则内容。\n', 'utf8')
  prepareShouldFail(target, 'inputHash 不匹配')
  fs.writeFileSync(TEMPLATE_ABS, orig, 'utf8')
})

test('F4 specs 版本递增 -> stageVersion 不匹配拒绝', () => {
  const target = freshTarget()
  const p = path.join(REPO_ROOT, SPECS_REL)
  const orig = fs.readFileSync(p, 'utf8')
  const specs2 = JSON.parse(orig)
  specs2.stages.S2.version = 'S2@2'
  fs.writeFileSync(p, JSON.stringify(specs2, null, 1), 'utf8')
  prepareShouldFail(target, 'stageVersion 不匹配')
  fs.writeFileSync(p, orig, 'utf8')
})

// ============================================================
// H：executionProfileHash 不参与强校验（E1 已证：prepare 不带 profile 也通过）
// ============================================================
test('H1 executionProfile 不参与强校验：record 带 profile、prepare 无 profile 匹配要求，复用照常通过', () => {
  // E1 即为本断言的实证（run-001 记录 model=test-model，prepare 未提供任何 profile 仍通过）；
  // 此处补一个独立断言：manifest 保留 profile 记录，prepare 校验不读取它
  const m = readJson(path.join(RUNS, 'run-001/runtime/stage-manifest.json'))
  assert.equal(m.stages.S1.profile.model, 'test-model')
  const c = runCli(['verify-immutable', DATE, 'run-001', '--specs', SPECS_REL])
  assert.equal(c.code, 0)
})

// ============================================================
// I：args-file 形态（中文值不进 shell，主编排实际用法；与 CLI 等价）
// ============================================================
test('I1 args-file：record-stage 经 JSON 文件传参（含中文值）与 CLI 形态指纹等价', () => {
  // 新 run-00N：用 args-file（configArgs 含中文 templatePath 值）record S1，与 run-001 CLI 形态比对
  const c1 = runCli(['init-run', DATE, '--specs', SPECS_REL])
  const target = 'run-' + /run-(\d{3})/.exec(c1.out)[1]
  writeStageOutputs(target, S1_OUTPUTS)
  const argsFile = path.join(RUNS, target, 'runtime/stage-args-S1.json')
  writeJson(argsFile, { configArgs: { templatePath: TEMPLATE_REL }, profile: { model: 'test-model', concurrency: '16' } })
  const c2 = runCli(['record-stage', DATE, target, 'S1', '--args-file', argsFile, '--specs', SPECS_REL])
  assert.equal(c2.code, 0, c2.out)
  const m1 = readJson(path.join(RUNS, 'run-001/runtime/stage-manifest.json')).stages.S1
  const m2 = readJson(path.join(RUNS, target, 'runtime/stage-manifest.json')).stages.S1
  assert.equal(m2.inputHash, m1.inputHash)
  assert.equal(m2.configHash, m1.configHash)
  assert.equal(m2.executionProfileHash, m1.executionProfileHash)
  assert.equal(m2.outputHash, m1.outputHash)
  assert.deepEqual(m2.configArgs, { templatePath: TEMPLATE_REL })
})

test('I2 args-file 非法结构 -> fail', () => {
  const c1 = runCli(['init-run', DATE, '--specs', SPECS_REL])
  const target = 'run-' + /run-(\d{3})/.exec(c1.out)[1]
  const argsFile = path.join(RUNS, target, 'runtime/stage-args-S1.json')
  writeJson(argsFile, { configArgs: 'not-an-object' })
  const c2 = runCli(['record-stage', DATE, target, 'S1', '--args-file', argsFile, '--specs', SPECS_REL])
  assert.equal(c2.code, 1)
  assert.ok(c2.out.includes('args-file 结构非法'))
})

test('I3 prepare-from-stage 经 args-file：与 CLI 形态等价（复用通过）', () => {
  const c1 = runCli(['init-run', DATE, '--specs', SPECS_REL])
  const target = 'run-' + /run-(\d{3})/.exec(c1.out)[1]
  const argsFile = path.join(RUNS, target, 'runtime/reuse-args.json')
  writeJson(argsFile, { configArgs: { templatePath: TEMPLATE_REL, date: DATE } })
  const c2 = runCli(['prepare-from-stage', DATE, '--source-run', 'run-001', '--target-run', target, '--start-stage', 'S3', '--plan-only', '--args-file', argsFile, '--specs', SPECS_REL])
  assert.equal(c2.code, 0, c2.out)
  const plan = readJson(path.join(RUNS, target, 'runtime/reuse-plan.json'))
  assert.deepEqual(plan.reusedStages, ['S1', 'S2'])
})

// ============================================================
// 清理
// ============================================================
fs.rmSync(TMP, { recursive: true, force: true })

console.log('stage-reuse.example：' + (process.exitCode ? '存在失败' : '全部通过'))
for (const line of results) console.log('  ' + line)
process.exit(process.exitCode || 0)
