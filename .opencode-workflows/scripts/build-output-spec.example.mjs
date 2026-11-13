// build-output-spec.example.mjs —— build-output-spec.mjs 自检（断言式，跑完打印结果退出）
// 覆盖：全链路成功（中文路径配置 + 合并删分片 + 索引装配 + 校验放行 + verify-report）/
//       缺分片 / 分片乱码 / 装配失败（原子 ID 重复）/ 校验失败（阶段文档缺失）/
//       配置缺失 / 配置缺必填字段
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const SCRIPT = '.opencode-workflows/scripts/build-output-spec.mjs'

const run = (args) => {
  try {
    const out = execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8' })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }
  }
}

const root = '.opencode-workflows/scripts/tmp-build-output'

function setup() {
  fs.rmSync(root, { recursive: true, force: true })
  const specDir = root + '/spec'
  fs.mkdirSync(specDir + '/runtime/parts', { recursive: true })
  fs.mkdirSync(specDir + '/runtime/supplement-parts', { recursive: true })
  fs.mkdirSync(specDir + '/stages', { recursive: true })
  fs.mkdirSync(root + '/模板', { recursive: true })
  fs.mkdirSync(root + '/产出', { recursive: true })

  // 模板（中文路径）
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
  fs.writeFileSync(root + '/模板/核心需求模板.md', tpl, 'utf8')

  // 索引片段
  const atom = (id, over) =>
    Object.assign(
      {
        id: id,
        name: '原子' + id,
        rule: '规则' + id,
        uiRequirement: '',
        verdict: 'confirmed',
        clientLogic: '客户端逻辑' + id,
        uiInteraction: 'UI 交互' + id,
        evidence: [{ file: 'source-code/client/Code/fgui/box_hzmj_main/x.ts', location: 'x.ts:10', excerpt: 'doX()' }],
        messages: ['MsgJuData'],
        notes: '',
      },
      over || {}
    )
  fs.writeFileSync(
    specDir + '/runtime/parts/ST-C01.json',
    JSON.stringify({
      stage: { id: 'ST-C01', name: '定庄与轮庄', chapter: '开局 > 定庄与轮庄', summary: '概述一', terms: [], crossCutting: [] },
      features: [
        {
          id: 'FP-ST-C01-001', name: '定庄', description: '首局庄家来源', scope: '', coordination: '',
          atoms: [atom('AT-ST-C01-001'), atom('AT-ST-C01-002', { verdict: 'not_found', evidence: [], clientLogic: '', uiInteraction: '' })],
        },
      ],
    }),
    'utf8'
  )
  fs.writeFileSync(
    specDir + '/runtime/parts/ST-C02.json',
    JSON.stringify({
      stage: { id: 'ST-C02', name: '算分', chapter: '算分', summary: '概述二', terms: [], crossCutting: [] },
      features: [
        { id: 'FP-ST-C02-001', name: '底分', description: '底分为一', scope: '', coordination: '', atoms: [atom('AT-ST-C02-001', { verdict: 'partial' })] },
      ],
    }),
    'utf8'
  )

  // 阶段文档（原子项标题与索引一致）
  fs.writeFileSync(
    specDir + '/stages/spec_stage_ST-C01.md',
    ['# 定庄与轮庄', '', '> 阶段 ID：`ST-C01`。', '', '#### `AT-ST-C01-001` 首局定庄', '', '- **规则说明**：首局随机坐庄。', '', '#### `AT-ST-C01-002` 连庄', '', '- **规则说明**：胡牌者坐庄。'].join('\n'),
    'utf8'
  )
  fs.writeFileSync(
    specDir + '/stages/spec_stage_ST-C02.md',
    ['# 算分', '', '> 阶段 ID：`ST-C02`。', '', '#### `AT-ST-C02-001` 底分为一', '', '- **规则说明**：底分为 1。'].join('\n'),
    'utf8'
  )

  // 补充版分片（标题行全覆盖模板）
  fs.writeFileSync(specDir + '/runtime/supplement-parts/part-01.md', '# 杭州麻将核心需求\n\n概述段落。', 'utf8')
  fs.writeFileSync(specDir + '/runtime/supplement-parts/part-02.md', '## 名词\n\n- **面子**：一组顺子、刻子或杠。', 'utf8')
  fs.writeFileSync(specDir + '/runtime/supplement-parts/part-03.md', '## 开局\n\n### 定庄与轮庄\n\n- 首局随机坐庄。\n  - 客户端实现：xx（a.ts:1）', 'utf8')
  fs.writeFileSync(specDir + '/runtime/supplement-parts/part-04.md', '## 算分\n\n- 底分为 1。', 'utf8')

  // 构建配置（中文路径全走配置文件）
  fs.writeFileSync(
    specDir + '/runtime/build-config.json',
    JSON.stringify(
      {
        specDir: specDir,
        supplementPath: root + '/产出/核心流程杭州麻将好友房AI-补充版本.md',
        templatePath: root + '/模板/核心需求模板.md',
        date: '2026-11-13',
        sourceDesc: '模板（需求模板）+ source-code/client/Code + source-code/client/Fgui（客户端代码证据）',
        expectedStageCount: 2,
        supplementParts: [1, 2, 3, 4].map((i) => specDir + '/runtime/supplement-parts/part-0' + i + '.md'),
      },
      null,
      1
    ),
    'utf8'
  )
  return specDir
}

// 场景 1：全链路成功（中文路径配置，合并 + 装配 + 校验放行）
{
  const specDir = setup()
  const r = run([specDir + '/runtime/build-config.json'])
  assert.equal(r.code, 0)
  assert.match(r.out, /\[成功\] \[合并补充版\] 4 个分片/)
  assert.match(r.out, /\[成功\] feature_index\.json：2 阶段 \/ 2 功能点 \/ 3 原子项/)
  assert.match(r.out, /\[成功\] 产出校验通过：阶段 2 \/ 功能点 2 \/ 原子项 3/)

  const supPath = root + '/产出/核心流程杭州麻将好友房AI-补充版本.md'
  assert.equal(fs.existsSync(supPath), true)
  const sup = fs.readFileSync(supPath, 'utf8')
  assert.match(sup, /^# 杭州麻将核心需求/m)
  assert.match(sup, /^## 开局/m)
  assert.match(sup, /^### 定庄与轮庄/m)
  assert.match(sup, /^## 算分/m)
  assert.match(sup, /- 客户端实现：xx（a\.ts:1）/)

  const idx = JSON.parse(fs.readFileSync(specDir + '/feature_index.json', 'utf8'))
  assert.equal(idx.atom_count, 3)
  assert.equal(idx.stages.length, 2)
  assert.equal(fs.existsSync(specDir + '/stage_manifest.md'), true)
  const report = fs.readFileSync(specDir + '/runtime/spec_check/verify-report.md', 'utf8')
  assert.match(report, /\*\*结论：放行。\*\*/)
  // 合并后分片已删除
  assert.equal(fs.existsSync(specDir + '/runtime/supplement-parts/part-01.md'), false)
}

// 场景 2：缺分片 → [合并补充版] 失败
{
  const specDir = setup()
  fs.rmSync(specDir + '/runtime/supplement-parts/part-04.md')
  const r = run([specDir + '/runtime/build-config.json'])
  assert.equal(r.code, 1)
  assert.match(r.out, /\[失败\] \[合并补充版\] 分片缺失 1 个/)
}

// 场景 3：分片含乱码 → [合并补充版] 失败
{
  const specDir = setup()
  fs.appendFileSync(specDir + '/runtime/supplement-parts/part-02.md', '\n含乱码 \uFFFD 字符')
  const r = run([specDir + '/runtime/build-config.json'])
  assert.equal(r.code, 1)
  assert.match(r.out, /\[失败\] \[合并补充版\] 文档含乱码替换字符 U\+FFFD/)
}

// 场景 4：装配失败（跨阶段原子 ID 重复） → [装配索引] 失败
{
  const specDir = setup()
  fs.writeFileSync(
    specDir + '/runtime/parts/ST-C02.json',
    JSON.stringify({
      stage: { id: 'ST-C02', name: '算分', chapter: '算分', summary: '概述二', terms: [], crossCutting: [] },
      features: [{ id: 'FP-ST-C02-001', name: '底分', description: '底分为一', atoms: [{ id: 'AT-ST-C01-001', name: '重复原子', rule: 'r', verdict: 'confirmed', evidence: [{ file: 'a.ts', location: 'a.ts:1', excerpt: 'x' }], messages: [], notes: '' }] }],
    }),
    'utf8'
  )
  const r = run([specDir + '/runtime/build-config.json'])
  assert.equal(r.code, 1)
  assert.match(r.out, /\[失败\] \[装配索引\] 失败/)
  assert.match(r.out, /原子项 ID 重复：AT-ST-C01-001/)
}

// 场景 5：校验失败（阶段文档缺失） → [机械校验] 失败
{
  const specDir = setup()
  fs.rmSync(specDir + '/stages/spec_stage_ST-C02.md')
  const r = run([specDir + '/runtime/build-config.json'])
  assert.equal(r.code, 1)
  assert.match(r.out, /\[失败\] \[机械校验\] 未通过/)
  assert.match(r.out, /阶段文档缺失/)
  const report = fs.readFileSync(specDir + '/runtime/spec_check/verify-report.md', 'utf8')
  assert.match(report, /不放行/)
}

// 场景 6：配置文件不存在 → 退出码 1
{
  const r = run([root + '/不存在.json'])
  assert.equal(r.code, 1)
  assert.match(r.out, /配置文件不存在/)
}

// 场景 7：配置缺必填字段 → 退出码 1
{
  const specDir = setup()
  const cfg = JSON.parse(fs.readFileSync(specDir + '/runtime/build-config.json', 'utf8'))
  delete cfg.templatePath
  fs.writeFileSync(specDir + '/runtime/build-config.json', JSON.stringify(cfg), 'utf8')
  const r = run([specDir + '/runtime/build-config.json'])
  assert.equal(r.code, 1)
  assert.match(r.out, /配置缺少必填字段：templatePath/)
}

// ---------- v2 场景准备（T3.6：策划版链路） ----------

function setupV2(mode) {
  const specDir = setup()
  // scan.json（full 模式 trace 生成输入）
  fs.mkdirSync(specDir + '/runtime/state', { recursive: true })
  fs.writeFileSync(
    specDir + '/runtime/state/scan.json',
    JSON.stringify({
      templatePath: root + '/模板/核心需求模板.md',
      totalLines: 16,
      sections: [
        { no: 1, title: '杭州麻将核心需求', fromLine: 1, toLine: 3, kind: 'intro', sourceTitle: '杭州麻将核心需求' },
        { no: 2, title: '名词', fromLine: 4, toLine: 6, kind: 'terms', sourceTitle: '名词' },
        { no: 3, title: '定庄与轮庄', fromLine: 7, toLine: 12, kind: 'stage', stageId: 'ST-C01', sourceTitle: '开局 > 定庄与轮庄' },
        { no: 4, title: '算分', fromLine: 13, toLine: 16, kind: 'stage', stageId: 'ST-C02', sourceTitle: '算分' },
      ],
    }),
    'utf8'
  )
  // 策划版分片（干净玩家语言 + 全 AT-ID 覆盖）
  fs.mkdirSync(specDir + '/runtime/planner-parts', { recursive: true })
  fs.writeFileSync(specDir + '/runtime/planner-parts/part-01.md', '# 杭州麻将核心需求\n\n概述（策划版）。', 'utf8')
  fs.writeFileSync(specDir + '/runtime/planner-parts/part-02.md', '## 名词\n\n- **面子**：一组顺子、刻子或杠。', 'utf8')
  fs.writeFileSync(
    specDir + '/runtime/planner-parts/part-03.md',
    '## 开局\n\n### 定庄与轮庄\n\n- 首局随机坐庄。\n  - 界面表现：坐庄玩家头像点亮庄家标志（AT-ST-C01-001、AT-ST-C01-002）。',
    'utf8'
  )
  fs.writeFileSync(
    specDir + '/runtime/planner-parts/part-04.md',
    '## 算分\n\n- 底分为 1。\n  - 界面表现：结算界面显示底分（AT-ST-C02-001）。',
    'utf8'
  )
  // build-config 增强（v2 字段）
  const cfg = JSON.parse(fs.readFileSync(specDir + '/runtime/build-config.json', 'utf8'))
  cfg.mode = mode || 'full'
  cfg.plannerPath = root + '/产出/核心流程杭州麻将好友房AI-策划版.md'
  cfg.plannerParts = [1, 2, 3, 4].map((i) => specDir + '/runtime/planner-parts/part-0' + i + '.md')
  cfg.allowlist = ['AI']
  if (mode === 'planner-only') {
    // sourceSpecDir（只读历史证据：scan + feature_index v1）
    const src = root + '/source-spec'
    fs.mkdirSync(src + '/runtime/state', { recursive: true })
    fs.copyFileSync(specDir + '/runtime/state/scan.json', src + '/runtime/state/scan.json')
    fs.writeFileSync(
      src + '/feature_index.json',
      JSON.stringify({
        schema_version: 1,
        stages: [
          { id: 'ST-C01', name: '定庄与轮庄' },
          { id: 'ST-C02', name: '算分' },
        ],
        features: [
          {
            id: 'FP-ST-C01-001', stage_id: 'ST-C01',
            atoms: [
              // required 混合：002 有 ui_interaction（required）；001/003 无（optional，纯知识规则）
              { id: 'AT-ST-C01-001', rule: '首局随机坐庄。', evidence: [{ file: 'a.ts', location: 'a.ts:1' }] },
              { id: 'AT-ST-C01-002', rule: '胡牌者坐庄。', ui_interaction: '头像点亮庄家标志', evidence: [] },
            ],
          },
          {
            id: 'FP-ST-C02-001', stage_id: 'ST-C02',
            atoms: [{ id: 'AT-ST-C02-001', rule: '底分为 1。', evidence: [{ file: 'b.ts', location: 'b.ts:1' }] }],
          },
        ],
      }),
      'utf8'
    )
    cfg.sourceSpecDir = src
  }
  fs.writeFileSync(specDir + '/runtime/build-config.json', JSON.stringify(cfg, null, 1), 'utf8')
  return specDir
}

// 场景 8（v2）：full + 策划版全链路成功（合并策划版 + trace + 泄漏/覆盖放行 + difference 统计段）
{
  const specDir = setupV2('full')
  const r = run([specDir + '/runtime/build-config.json'])
  assert.equal(r.code, 0, '场景8 应成功：' + r.out)
  assert.match(r.out, /\[成功\] \[合并策划版\] 4 个分片/)
  const plannerPath = root + '/产出/核心流程杭州麻将好友房AI-策划版.md'
  assert.equal(fs.existsSync(plannerPath), true)
  assert.equal(fs.existsSync(specDir + '/runtime/planner-parts/part-01.md'), false, '合并后策划版分片已删除')
  const trace = JSON.parse(fs.readFileSync(specDir + '/trace_index.json', 'utf8'))
  assert.equal(trace.entryCount, 3)
  assert.deepEqual(trace.entries.map((e) => e.atomId), ['AT-ST-C01-001', 'AT-ST-C01-002', 'AT-ST-C02-001'])
  assert.equal(trace.entries[0].plannerPart, 'part-03.md')
  const report = fs.readFileSync(specDir + '/runtime/spec_check/verify-report.md', 'utf8')
  assert.match(report, /AT-ID 覆盖率 100\.0%/)
  assert.match(report, /difference 分布：consistent 0 \/ partial 0 \/ conflict 0 \/ unverified 3/)
  assert.match(report, /3 个为 v1 旧数据未标注 difference/)
  assert.match(report, /泄漏正则零命中/)
  const idx = JSON.parse(fs.readFileSync(specDir + '/feature_index.json', 'utf8'))
  assert.equal(idx.schema_version, 2)
  assert.deepEqual(idx.difference_stats, { consistent: 0, partial: 0, conflict: 0, unverified: 3, unmarked_v1: 3 })
}

// 场景 9（v2）：full + 策划版泄漏 → 机械校验失败
{
  const specDir = setupV2('full')
  fs.appendFileSync(specDir + '/runtime/planner-parts/part-04.md', '\n- 技术行：GameJuDataCmd 泄漏。')
  const r = run([specDir + '/runtime/build-config.json'])
  assert.equal(r.code, 1)
  assert.match(r.out, /策划版泄漏/)
  assert.match(r.out, /GameJuDataCmd/)
}

// 场景 10（v2）：full + 策划版 AT-ID 缺失 → 机械校验失败（AI 漏写拦截）
{
  const specDir = setupV2('full')
  fs.writeFileSync(
    specDir + '/runtime/planner-parts/part-03.md',
    '## 开局\n\n### 定庄与轮庄\n\n- 首局随机坐庄。\n  - 界面表现：坐庄玩家头像点亮庄家标志（AT-ST-C01-001）。'
  )
  const r = run([specDir + '/runtime/build-config.json'])
  assert.equal(r.code, 1)
  assert.match(r.out, /覆盖缺失 1 个/)
  assert.match(r.out, /AT-ST-C01-002/)
}

// 场景 11（v2）：planner-only 全链路成功（不装配 feature_index/stage_manifest，报告 planner-only 版）
{
  const specDir = setupV2('planner-only')
  const r = run([specDir + '/runtime/build-config.json'])
  assert.equal(r.code, 0, '场景11 应成功：' + r.out)
  const plannerPath = root + '/产出/核心流程杭州麻将好友房AI-策划版.md'
  assert.equal(fs.existsSync(plannerPath), true)
  assert.equal(fs.existsSync(specDir + '/trace_index.json'), true)
  assert.equal(fs.existsSync(specDir + '/feature_index.json'), false, 'planner-only 不装配 feature_index')
  assert.equal(fs.existsSync(specDir + '/stage_manifest.md'), false, 'planner-only 不装配 stage_manifest')
  const trace = JSON.parse(fs.readFileSync(specDir + '/trace_index.json', 'utf8'))
  assert.equal(trace.requiredCount, 1, 'required 判定：仅 AT-ST-C01-002 必查')
  const report = fs.readFileSync(specDir + '/runtime/spec_check/verify-report.md', 'utf8')
  assert.match(report, /planner-only 模式/)
  assert.match(report, /\*\*结论：放行。\*\*/)
  assert.match(report, /difference 分布/)
  assert.match(r.out, /\[成功\] \[planner-only 校验\] 泄漏零命中，AT-ID 覆盖 100%/)
}

// 场景 11.5（v2）：planner-only optional 原子缺失不 fail（required 口径，防漏写与防编造一致）
{
  const specDir = setupV2('planner-only')
  // 重造策划版分片：只写 required 的 AT-ST-C01-002（optional 的 001/002-源 底分缺失）
  fs.writeFileSync(specDir + '/runtime/planner-parts/part-01.md', '# 杭州麻将核心需求\n\n概述（策划版）。', 'utf8')
  fs.writeFileSync(specDir + '/runtime/planner-parts/part-02.md', '## 名词\n\n- **面子**：一组顺子、刻子或杠。', 'utf8')
  fs.writeFileSync(
    specDir + '/runtime/planner-parts/part-03.md',
    '## 开局\n\n### 定庄与轮庄\n\n- 胡牌者坐庄。\n  - 界面表现：头像点亮庄家标志（AT-ST-C01-002）。'
  )
  fs.writeFileSync(specDir + '/runtime/planner-parts/part-04.md', '## 算分\n\n- 底分为 1。')
  const r = run([specDir + '/runtime/build-config.json'])
  assert.equal(r.code, 0, '场景11.5 optional 缺失应放行：' + r.out)
  const report = fs.readFileSync(specDir + '/runtime/spec_check/verify-report.md', 'utf8')
  assert.match(report, /AT-ID 覆盖率：100\.0%/)
  assert.match(report, /未标注 AT-ID 2 个/)
  assert.match(report, /AT-ST-C01-001/)
}

// 场景 11.6（v2）：planner-only required 原子缺失 fail（覆盖闸门对必查口径仍严格）
{
  const specDir = setupV2('planner-only')
  fs.writeFileSync(
    specDir + '/runtime/planner-parts/part-03.md',
    '## 开局\n\n### 定庄与轮庄\n\n- 胡牌者坐庄。\n  - 界面表现：头像点亮庄家标志。\n- 首局随机坐庄。（AT-ST-C01-001）'
  )
  const r = run([specDir + '/runtime/build-config.json'])
  assert.equal(r.code, 1)
  assert.match(r.out, /覆盖缺失 1 个/)
  assert.match(r.out, /AT-ST-C01-002/)
}

// 场景 12（v2）：planner-only + 泄漏 → 失败
{
  const specDir = setupV2('planner-only')
  fs.appendFileSync(specDir + '/runtime/planner-parts/part-02.md', '\n- 技术行：见 source-code/client。')
  const r = run([specDir + '/runtime/build-config.json'])
  assert.equal(r.code, 1)
  assert.match(r.out, /策划版泄漏/)
  const report = fs.readFileSync(specDir + '/runtime/spec_check/verify-report.md', 'utf8')
  assert.match(report, /不放行/)
}

// 场景 13（v2）：幂等重跑（分片全缺且目标存在 → 跳过；L2 修复验证）
{
  const specDir = setupV2('full')
  const r1 = run([specDir + '/runtime/build-config.json'])
  assert.equal(r1.code, 0, '场景13 首跑应成功：' + r1.out)
  const r2 = run([specDir + '/runtime/build-config.json'])
  assert.equal(r2.code, 0, '场景13 幂等重跑应成功：' + r2.out)
  assert.match(r2.out, /幂等跳过/)
  assert.match(r2.out, /\[跳过\] \[合并补充版\]/)
  assert.match(r2.out, /\[跳过\] \[合并策划版\]/)
}

fs.rmSync(root, { recursive: true, force: true })
console.log('[成功] build-output-spec.example 全部断言通过（全链路中文路径配置/缺分片/乱码/装配失败/校验失败/配置缺失/缺字段/v2 策划版全链路/泄漏/覆盖缺失/planner-only 成功与失败/幂等重跑）')
