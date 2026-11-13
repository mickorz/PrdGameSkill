// verify-output-spec.example.mjs —— verify-output-spec.mjs 自检（断言式，跑完打印结果退出）
// 覆盖：全部通过（verify-report 放行 + 阶段明细表）/ 阶段文档缺失 / 原子项 ID 集合不一致 /
//       计数不自洽 / 乱码 / 分片标记残留 / 补充版缺阶段章节 / 缺模板主标题 / feature_index 缺失
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

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

fs.rmSync(root, { recursive: true, force: true })
console.log('[成功] verify-output-spec.example 全部断言通过（放行/缺文档/原子集合不一致/多登记/计数不自洽/乱码/分片标记/缺章节/缺主标题/缺索引）')
