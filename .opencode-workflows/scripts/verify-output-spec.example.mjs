// verify-output-spec.example.mjs —— verify-output-spec.mjs 自检（断言式，跑完打印结果退出）
// 覆盖：全部通过（verify-report 放行 + 阶段明细表）/ 阶段文档缺失 / 原子项 ID 集合不一致 /
//       计数不自洽 / 乱码 / 分片标记残留 / 补充版缺阶段章节 / 缺模板主标题 / feature_index 缺失
// v2 场景（2026-11-14，T3.6）：策划版泄漏命中/白名单豁免/干净放行 / AT-ID 覆盖缺失与基准外 /
//       verifyOutputSpec opts 集成（泄漏 fail、全覆盖放行、difference 统计段进 report）
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { verifyOutputSpec, checkPlannerLeakage, checkAtomCoverage } from './verify-output-spec.mjs'

const SCRIPT = '.opencode-workflows/scripts/verify-output-spec.mjs'

const run = (args) => {
  try {
    const out = execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8' })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }
  }
}

const root = '.opencode-workflows/scripts/tmp-verify-output'

function setup() {
  fs.rmSync(root, { recursive: true, force: true })
  fs.mkdirSync(root + '/stages', { recursive: true })
  fs.mkdirSync(root + '/runtime/spec_check', { recursive: true })

  // 模板
  const tpl = [
    '# 杭州麻将核心需求',
    '',
    '概述段落。',
    '',
    '## 名词',
    '',
    '- **面子**：一组顺子、刻子或杠。',
    '',
    '## 开局',
    '',
    '### 定庄与轮庄',
    '',
    '- 首局随机坐庄。',
    '',
    '## 算分',
    '',
    '- 底分为 1。',
    '',
  ].join('\n')
  fs.writeFileSync(root + '/template.md', tpl, 'utf8')

  // feature_index.json（2 阶段 / 2 功能点 / 3 原子项）
  const index = {
    module: '42320',
    stage_count: 2,
    feature_count: 2,
    atom_count: 3,
    stages: [
      { id: 'ST-C01', name: '定庄与轮庄', chapter: '开局 > 定庄与轮庄' },
      { id: 'ST-C02', name: '算分', chapter: '算分' },
    ],
    features: [
      {
        id: 'FP-ST-C01-001', name: '定庄', stage_id: 'ST-C01', stage_name: '定庄与轮庄',
        atoms: [
          { id: 'AT-ST-C01-001', name: '首局定庄', verdict: 'confirmed' },
          { id: 'AT-ST-C01-002', name: '连庄', verdict: 'not_found' },
        ],
      },
      {
        id: 'FP-ST-C02-001', name: '底分', stage_id: 'ST-C02', stage_name: '算分',
        atoms: [{ id: 'AT-ST-C02-001', name: '底分为一', verdict: 'partial' }],
      },
    ],
  }
  fs.writeFileSync(root + '/feature_index.json', JSON.stringify(index, null, 1), 'utf8')

  // 阶段文档（原子项标题与索引一致）
  fs.writeFileSync(
    root + '/stages/spec_stage_ST-C01.md',
    ['# 定庄与轮庄', '', '> 阶段 ID：`ST-C01`。', '', '#### `AT-ST-C01-001` 首局定庄', '', '- **规则说明**：首局随机坐庄。', '', '#### `AT-ST-C01-002` 连庄', '', '- **规则说明**：胡牌者坐庄。'].join('\n'),
    'utf8'
  )
  fs.writeFileSync(
    root + '/stages/spec_stage_ST-C02.md',
    ['# 算分', '', '> 阶段 ID：`ST-C02`。', '', '#### `AT-ST-C02-001` 底分为一', '', '- **规则说明**：底分为 1。'].join('\n'),
    'utf8'
  )

  // stage_manifest.md
  fs.writeFileSync(root + '/stage_manifest.md', '# 阶段清单\n\n| 阶段 ID | 阶段 |\n| --- | --- |\n| ST-C01 | 定庄与轮庄 |\n| ST-C02 | 算分 |\n', 'utf8')

  // 补充版文档（含模板全部标题行、名词章节、全部阶段名）
  fs.writeFileSync(
    root + '/supplement.md',
    ['# 杭州麻将核心需求', '', '概述段落（补充）。', '', '## 名词', '', '- **面子**：一组顺子、刻子或杠。', '', '## 开局', '', '### 定庄与轮庄', '', '- 首局随机坐庄。', '  - 客户端实现：xx（a.ts:1）', '', '## 算分', '', '- 底分为 1。'].join('\n'),
    'utf8'
  )
}

// 场景 1：全部通过 → 退出码 0，verify-report 含放行结论与阶段明细
{
  setup()
  const r = run([root, root + '/supplement.md', root + '/template.md', '2026-11-13'])
  assert.equal(r.code, 0)
  assert.match(r.out, /\[成功\] 产出校验通过：阶段 2 \/ 功能点 2 \/ 原子项 3/)
  const report = fs.readFileSync(root + '/runtime/spec_check/verify-report.md', 'utf8')
  assert.match(report, /\*\*结论：放行。\*\*/)
  assert.match(report, /confirmed 1 \/ partial 1 \/ not_found 1/)
  assert.match(report, /\| ST-C01 定庄与轮庄 \| 2 \| 1 \| 0 \| 1 \|/)
}

// 场景 2：阶段文档缺失 → 退出码 1
{
  setup()
  fs.rmSync(root + '/stages/spec_stage_ST-C02.md')
  const r = run([root, root + '/supplement.md', root + '/template.md', '2026-11-13'])
  assert.equal(r.code, 1)
  assert.match(r.out, /阶段文档缺失/)
}

// 场景 3：阶段文档原子项 ID 集合不一致（漏一个原子项标题） → 退出码 1
{
  setup()
  fs.writeFileSync(
    root + '/stages/spec_stage_ST-C01.md',
    ['# 定庄与轮庄', '', '#### `AT-ST-C01-001` 首局定庄'].join('\n'),
    'utf8'
  )
  const r = run([root, root + '/supplement.md', root + '/template.md', '2026-11-13'])
  assert.equal(r.code, 1)
  assert.match(r.out, /缺原子项 AT-ST-C01-002/)
}

// 场景 4：阶段文档多出未登记原子项 → 退出码 1
{
  setup()
  fs.writeFileSync(
    root + '/stages/spec_stage_ST-C02.md',
    ['# 算分', '', '#### `AT-ST-C02-001` 底分为一', '', '#### `AT-ST-C02-099` 多出来的'].join('\n'),
    'utf8'
  )
  const r = run([root, root + '/supplement.md', root + '/template.md', '2026-11-13'])
  assert.equal(r.code, 1)
  assert.match(r.out, /多出未登记原子项 AT-ST-C02-099/)
}

// 场景 5：feature_index 计数不自洽 → 退出码 1
{
  setup()
  const idx = JSON.parse(fs.readFileSync(root + '/feature_index.json', 'utf8'))
  idx.atom_count = 99
  fs.writeFileSync(root + '/feature_index.json', JSON.stringify(idx), 'utf8')
  const r = run([root, root + '/supplement.md', root + '/template.md', '2026-11-13'])
  assert.equal(r.code, 1)
  assert.match(r.out, /atom_count 不自洽：声明 99，实际 3/)
}

// 场景 6：产出含乱码 U+FFFD → 退出码 1
{
  setup()
  fs.appendFileSync(root + '/stages/spec_stage_ST-C01.md', '\n含乱码 \uFFFD 字符')
  const r = run([root, root + '/supplement.md', root + '/template.md', '2026-11-13'])
  assert.equal(r.code, 1)
  assert.match(r.out, /含乱码替换字符 U\+FFFD/)
}

// 场景 7：分片标记残留 → 退出码 1
{
  setup()
  fs.appendFileSync(root + '/supplement.md', '\nPART-BEGIN')
  const r = run([root, root + '/supplement.md', root + '/template.md', '2026-11-13'])
  assert.equal(r.code, 1)
  assert.match(r.out, /残留分片标记/)
}

// 场景 8：补充版缺阶段章节标题与模板标题行 → 退出码 1
{
  setup()
  fs.writeFileSync(
    root + '/supplement.md',
    ['# 杭州麻将核心需求', '', '## 名词', '', '- **面子**：一组顺子、刻子或杠。', '', '### 定庄与轮庄', '', '- 首局随机坐庄。'].join('\n'),
    'utf8'
  )
  const r = run([root, root + '/supplement.md', root + '/template.md', '2026-11-13'])
  assert.equal(r.code, 1)
  assert.match(r.out, /缺阶段章节标题：算分/)
  assert.match(r.out, /缺模板标题行：## 算分/)
}

// 场景 8.5：补充版仅缺容器标题行（阶段名齐全） → 退出码 1
{
  setup()
  fs.writeFileSync(
    root + '/supplement.md',
    [
      '# 杭州麻将核心需求',
      '',
      '概述段落（补充）。',
      '',
      '## 名词',
      '',
      '- **面子**：一组顺子、刻子或杠。',
      '',
      '### 定庄与轮庄',
      '',
      '- 首局随机坐庄。',
      '  - 客户端实现：xx（a.ts:1）',
      '',
      '## 算分',
      '',
      '- 底分为 1。',
    ].join('\n'),
    'utf8'
  )
  const r = run([root, root + '/supplement.md', root + '/template.md', '2026-11-13'])
  assert.equal(r.code, 1)
  assert.match(r.out, /缺模板标题行：## 开局/)
}

// 场景 9：补充版缺模板主标题与名词章节 → 退出码 1
{
  setup()
  fs.writeFileSync(root + '/supplement.md', ['# 别的标题', '', '### 定庄与轮庄', '', '## 算分', '', '- 底分为 1。'].join('\n'), 'utf8')
  const r = run([root, root + '/supplement.md', root + '/template.md', '2026-11-13'])
  assert.equal(r.code, 1)
  assert.match(r.out, /缺模板主标题/)
  assert.match(r.out, /缺「## 名词」章节/)
}

// 场景 10：feature_index.json 缺失 → 退出码 1
{
  setup()
  fs.rmSync(root + '/feature_index.json')
  const r = run([root, root + '/supplement.md', root + '/template.md', '2026-11-13'])
  assert.equal(r.code, 1)
  assert.match(r.out, /feature_index\.json 不存在/)
}

// 场景 11（v2）：checkPlannerLeakage 泄漏命中（技术词逐类命中 + 白名单豁免）
{
  const leakRoot = root + '-v2-leak'
  fs.rmSync(leakRoot, { recursive: true, force: true })
  fs.mkdirSync(leakRoot, { recursive: true })
  const plannerPath = leakRoot + '/planner.md'
  fs.writeFileSync(
    plannerPath,
    [
      '# 策划版',
      '',
      '- 开局后 GameJuDataCmd 下发局数据。',
      '- 庄家标志走 C_Bank 的三档图。',
      '- 界面刷新走 onShowZhuang 事件。',
      '- 倍数取 getZhuangXianMult 计算。',
      '- 掷骰动画见 BoxHzmjMah2DView.showDice（a.ts:31）。',
      '- AI 出牌提示见 source-code/client/Code/xxx.ts。',
      '- 协议 MsgJuData 与 CMD_RESULT_HU。',
      '- 常量 KW_RESULT 与语音 key GP_VOICE_XX。',
    ].join('\n'),
    'utf8'
  )
  const r = checkPlannerLeakage(plannerPath, ['AI'])
  assert.equal(r.ok, false)
  assert.ok(r.problems.some((p) => p.includes('大驼峰类名') && p.includes('GameJuDataCmd')))
  assert.ok(r.problems.some((p) => p.includes('组件引用名') && p.includes('C_B')), 'C_Bank 命中组件引用名（正则匹配 C_B 前缀）')
  assert.ok(r.problems.some((p) => p.includes('方法名') && p.includes('onShowZhuang')))
  assert.ok(r.problems.some((p) => p.includes('方法名') && p.includes('getZhuangXianMult')))
  assert.ok(r.problems.some((p) => p.includes('大驼峰类名') && p.includes('BoxHzmjMah2DView')))
  assert.ok(r.problems.some((p) => p.includes('file:line 定位') && p.includes('.ts:31')))
  assert.ok(r.problems.some((p) => p.includes('源码路径') && p.includes('source-code')))
  assert.ok(r.problems.some((p) => p.includes('协议消息名') && p.includes('MsgJuData')))
  assert.ok(r.problems.some((p) => p.includes('协议命令名') && p.includes('CMD_RESULT_HU')))
  assert.ok(r.problems.some((p) => p.includes('SCREAMING_SNAKE 常量') && p.includes('KW_RESULT')), 'KW_RESULT 命中 SCREAMING（同行首个）')
  assert.ok(r.problems.length >= 10, '泄漏命中数不少于 10 处（实测含多模式同行多命中）')

  // 白名单豁免：AI 被剔除后不误伤（AI 本身不匹配任何正则，此处验证剔除逻辑不报错）
  const r2 = checkPlannerLeakage(plannerPath, ['AI', 'AI 出牌提示'])
  assert.equal(r2.ok, false)
  // 「AI 出牌提示」被剔除后该行剩余内容不含技术词，source-code 行不再命中该词但路径仍命中
  assert.ok(r2.hits.length <= r.hits.length)

  // 文件缺失
  const r3 = checkPlannerLeakage(leakRoot + '/no-exist.md', [])
  assert.equal(r3.ok, false)
  assert.ok(r3.problems[0].includes('策划版文档不存在'))
}

// 场景 12（v2）：checkPlannerLeakage 干净放行（玩家语言零命中）
{
  const leakRoot = root + '-v2-clean'
  fs.rmSync(leakRoot, { recursive: true, force: true })
  fs.mkdirSync(leakRoot, { recursive: true })
  const plannerPath = leakRoot + '/planner.md'
  fs.writeFileSync(
    plannerPath,
    [
      '# 策划版',
      '',
      '- 首局随机坐庄。',
      '  - 界面表现：开局后坐庄玩家头像点亮庄家标志（按牢庄等级分三档），随后牌桌播放掷骰动画（AT-ST-C01-001）。',
      '  - 待确认：需求为「首局四名玩家随机坐庄」，实际表现为「坐庄玩家由系统直接指定，客户端无从验证随机过程」（AT-ST-C01-001）。',
    ].join('\n'),
    'utf8'
  )
  const r = checkPlannerLeakage(plannerPath, ['AI'])
  assert.equal(r.ok, true)
  assert.equal(r.hits.length, 0)
}

// 场景 13（v2）：checkAtomCoverage 缺失与基准外 AT-ID（required 口径）
{
  const covRoot = root + '-v2-cov'
  fs.rmSync(covRoot, { recursive: true, force: true })
  fs.mkdirSync(covRoot, { recursive: true })
  const tracePath = covRoot + '/trace_index.json'
  fs.writeFileSync(
    tracePath,
    JSON.stringify({
      entries: [
        { atomId: 'AT-ST-C01-001', sourceStage: 'ST-C01', plannerPart: 'part-03.md', required: true },
        { atomId: 'AT-ST-C01-002', sourceStage: 'ST-C01', plannerPart: 'part-03.md', required: true },
        { atomId: 'AT-ST-C02-001', sourceStage: 'ST-C02', plannerPart: 'part-04.md', required: false },
      ],
    }),
    'utf8'
  )
  // 策划版缺 required 的 AT-ST-C01-002、缺 optional 的 AT-ST-C02-001，多 AT-ST-C03-001
  const plannerPath = covRoot + '/planner.md'
  fs.writeFileSync(plannerPath, '内容含 AT-ST-C01-001 与 AT-ST-C03-001。', 'utf8')
  const r = checkAtomCoverage(plannerPath, tracePath)
  // required 分母 2：覆盖 1/2
  assert.equal(r.coverage, 0.5)
  assert.deepEqual(r.missing, ['AT-ST-C01-002'])
  assert.deepEqual(r.optionalMissing, ['AT-ST-C02-001'])
  assert.deepEqual(r.extra, ['AT-ST-C03-001'])
  assert.ok(r.problems.some((p) => p.includes('覆盖缺失 1 个') && p.includes('AT-ST-C01-002')))
  assert.ok(r.problems.some((p) => p.includes('基准外 AT-ID 1 个') && p.includes('AT-ST-C03-001')))
  assert.ok((r.notes || []).some((n) => n.includes('未标注 AT-ID 1 个') && n.includes('AT-ST-C02-001')), 'optional 缺失进 notes 提示不计 fail')

  // required 全覆盖 + optional 全缺 -> 放行（notes 提示）
  fs.writeFileSync(plannerPath, '内容含 AT-ST-C01-001、AT-ST-C01-002。', 'utf8')
  const r2 = checkAtomCoverage(plannerPath, tracePath)
  assert.equal(r2.coverage, 1)
  assert.equal(r2.problems.length, 0)
  assert.equal(r2.optionalMissing.length, 1)

  // 全覆盖放行
  fs.writeFileSync(plannerPath, '内容含 AT-ST-C01-001、AT-ST-C01-002、AT-ST-C02-001。', 'utf8')
  const r3 = checkAtomCoverage(plannerPath, tracePath)
  assert.equal(r3.coverage, 1)
  assert.equal(r3.problems.length, 0)
  assert.equal(r3.optionalMissing.length, 0)

  // 旧版 trace（无 required 字段）向后兼容：全量必查
  fs.writeFileSync(
    tracePath,
    JSON.stringify({
      entries: [
        { atomId: 'AT-ST-C01-001', sourceStage: 'ST-C01' },
        { atomId: 'AT-ST-C01-002', sourceStage: 'ST-C01' },
      ],
    }),
    'utf8'
  )
  fs.writeFileSync(plannerPath, '内容含 AT-ST-C01-001。', 'utf8')
  const r4 = checkAtomCoverage(plannerPath, tracePath)
  assert.equal(r4.coverage, 0.5)
  assert.deepEqual(r4.missing, ['AT-ST-C01-002'])
  assert.equal((r4.notes || []).length, 0)

  // 基准缺失
  const r5 = checkAtomCoverage(plannerPath, covRoot + '/no-trace.json')
  assert.ok(r5.problems[0].includes('trace_index.json 不存在'))
}

// 场景 14（v2）：verifyOutputSpec + opts 集成（泄漏 fail / 全放行 + report 覆盖率与 difference 段）
{
  setup()
  // trace_index（3 原子项全覆盖基准）
  fs.writeFileSync(
    root + '/trace_index.json',
    JSON.stringify({
      entries: [
        { atomId: 'AT-ST-C01-001', sourceStage: 'ST-C01' },
        { atomId: 'AT-ST-C01-002', sourceStage: 'ST-C01' },
        { atomId: 'AT-ST-C02-001', sourceStage: 'ST-C02' },
      ],
    }),
    'utf8'
  )
  // 策划版泄漏（含类名）→ fail
  fs.writeFileSync(root + '/planner.md', '# 策划版\n\n- GameJuDataCmd 泄漏。\n- AT-ST-C01-001、AT-ST-C01-002、AT-ST-C02-001。\n', 'utf8')
  const rLeak = verifyOutputSpec(root, root + '/supplement.md', root + '/template.md', '2026-11-14', {
    plannerPath: root + '/planner.md',
    traceIndexPath: root + '/trace_index.json',
    allowlist: ['AI'],
  })
  assert.equal(rLeak.ok, false)
  assert.ok(rLeak.problems.some((p) => p.includes('策划版泄漏') && p.includes('GameJuDataCmd')))

  // 干净 + 全覆盖 → 放行，report 含覆盖率行与 difference 统计段（v1 索引全 unmarked）
  fs.writeFileSync(
    root + '/planner.md',
    '# 策划版\n\n- 首局随机坐庄。\n  - 界面表现：头像点亮庄家标志（AT-ST-C01-001、AT-ST-C01-002、AT-ST-C02-001）。\n',
    'utf8'
  )
  const rPass = verifyOutputSpec(root, root + '/supplement.md', root + '/template.md', '2026-11-14', {
    plannerPath: root + '/planner.md',
    traceIndexPath: root + '/trace_index.json',
    allowlist: ['AI'],
  })
  assert.equal(rPass.ok, true)
  assert.equal(rPass.summary.plannerCoverage, 1)
  const report = fs.readFileSync(root + '/runtime/spec_check/verify-report.md', 'utf8')
  assert.match(report, /AT-ID 覆盖率 100\.0%/)
  assert.match(report, /difference 分布：consistent 0 \/ partial 0 \/ conflict 0 \/ unverified 3/)
  assert.match(report, /3 个为 v1 旧数据未标注 difference/)

  // skipPlanner：不检查策划版 → 无泄漏问题（planner.md 有泄漏也放行）
  const rSkip = verifyOutputSpec(root, root + '/supplement.md', root + '/template.md', '2026-11-14', {
    plannerPath: root + '/planner.md',
    skipPlanner: true,
  })
  assert.equal(rSkip.ok, true)

  // 不传 opts：向后兼容 v1 行为（不查策划版）
  const rNoOpts = verifyOutputSpec(root, root + '/supplement.md', root + '/template.md', '2026-11-13')
  assert.equal(rNoOpts.ok, true)
}

fs.rmSync(root, { recursive: true, force: true })
fs.rmSync(root + '-v2-leak', { recursive: true, force: true })
fs.rmSync(root + '-v2-clean', { recursive: true, force: true })
fs.rmSync(root + '-v2-cov', { recursive: true, force: true })
console.log('[成功] verify-output-spec.example 全部断言通过（放行/缺文档/原子集合不一致/多登记/计数不自洽/乱码/分片标记/缺章节/缺主标题/缺索引/v2 泄漏与白名单/覆盖缺失与基准外/opts 集成）')
