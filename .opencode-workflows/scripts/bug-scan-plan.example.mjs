// bug-scan-plan.example.mjs —— bug-scan-plan.mjs 自检
// 场景：真实目录 + 共享快照（PRD 路径来自 manifest，批次全覆盖校验，收集输入契约）/
//       mock：PRD 大纲抽取、autoPass 预判过滤、小批次并入相邻、批次全覆盖自检 /
//       失败路径：PRD 路径不存在、PRD 来源缺失、来源冲突、参数缺失
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const run = (args) => {
  try { return { code: 0, out: execFileSync('node', ['.opencode-workflows/scripts/bug-scan-plan.mjs', ...args], { encoding: 'utf8' }) } }
  catch (e) { return { code: e.status, out: (e.stdout || '') + (e.stderr || '') } }
}

const snap = 'output/projects/hzmj/extractions/ext-20261112-01'

// 场景 1：真实目录 + 共享快照（快照不存在时跳过，不阻塞其余场景）
{
  if (fs.existsSync(snap + '/manifest.json')) {
    const out = 'output/projects/hzmj/bug-check/scan-plan-example'
    fs.rmSync(out, { recursive: true, force: true })
    const r = run(['bugs/buglist', out, '--prd-from-snapshot', snap, '--batch-size', '15'])
    assert.equal(r.code, 0, r.out)
    const mdCount = fs.readdirSync('bugs/buglist').filter((f) => f.endsWith('.md')).length
    const summary = JSON.parse(fs.readFileSync(out + '/scan-summary.json', 'utf8'))
    assert.equal(summary.ok, true)
    assert.equal(summary.bugCount, mdCount, '全量入批（autoPass 未传时一条不漏）')
    assert.equal(summary.prePassCount, 0)
    assert.ok(summary.batchCount >= 1, '至少一批')
    assert.equal(summary.batches.length, summary.batchCount, '摘要批次数一致')
    // 批次定义：files 的 bugId 恰好覆盖全量、不重复
    const batches = JSON.parse(fs.readFileSync(out + '/batches.json', 'utf8')).batches
    const ids = batches.flatMap((b) => b.files.map((f) => f.bugId))
    assert.equal(ids.length, mdCount, '批次文件总数 = 缺陷总数')
    assert.equal(new Set(ids).size, mdCount, '批次内 bugId 不重复')
    assert.ok(batches.every((b) => b.files.every((f) => f.bugId && f.path && f.title && f.module)), '批次文件字段齐')
    // 批次下标与 files 对齐（index 连续从 0 起）
    assert.deepEqual(batches.map((b) => b.index), batches.map((_, i) => i), '批次 index 连续')
    // 收集输入契约（bug-verdicts.mjs collect）
    const input = JSON.parse(fs.readFileSync(out + '/bug-verdicts-input.json', 'utf8'))
    assert.equal(input.allBugs.length, mdCount)
    assert.equal(input.batches.length, batches.length)
    assert.equal(input.prePassBugs.length, 0)
    assert.ok(input.verdictsPartsDir.endsWith('verdicts-parts'), 'verdictsPartsDir 指向分片目录')
    const inputIds = input.batches.flatMap((b) => b.files)
    assert.equal(new Set(inputIds).size, mdCount, '收集输入批次 bugId 不重复')
    // PRD 大纲非空且含行号格式
    const outline = fs.readFileSync(out + '/prd-outline.txt', 'utf8')
    assert.match(outline, /^\d+ #{1,3} /m, '大纲为「行号 标题」格式')
    // 摘要 prdFiles 与快照 manifest 一致（去重保序）
    const manifest = JSON.parse(fs.readFileSync(snap + '/manifest.json', 'utf8'))
    assert.deepEqual(summary.prdFiles, [...new Set(manifest.sourceFiles.map((x) => x.file))], 'PRD 路径来自快照 manifest')
    // Bug 资产落盘
    const catalog = JSON.parse(fs.readFileSync(out + '/bug-catalog.json', 'utf8'))
    assert.equal(catalog.bugCount, mdCount)
    console.log('真实目录+快照: ' + summary.bugCount + ' 条 / ' + summary.batchCount + ' 批 / PRD ' + summary.prdFiles.length + ' 个')
  } else {
    console.log('（跳过）共享快照不存在: ' + snap)
  }
}

// 场景 2：mock 目录（大纲抽取 / autoPass 过滤 / 小批合并 / 失败路径）
{
  const root = '.opencode-workflows/scripts/tmp-scanplan'
  fs.rmSync(root, { recursive: true, force: true })
  fs.mkdirSync(root + '/list', { recursive: true })
  const files = [
    '100-【卡五星】【结算】甲.md',
    '101-【卡五星】【结算】乙.md',
    '102-【卡五星】【结算】丙.md',
    '103-【卡五星】【创房规则】丁.md',
    '104-亮牌关键词无标签.md',
  ]
  for (const f of files) fs.writeFileSync(root + '/list/' + f, 'x', 'utf8')
  fs.writeFileSync(root + '/prd.md', '# 标题一\n正文\n## 小节\n# 标题二\n', 'utf8')
  const out = root + '/out'

  // batch-size 3：结算桶一批(3)；创房(1) 与 亮牌(1) 不足容量且可并入 → 创房+亮牌合并一批(2)
  const r = run([root + '/list', out, '--prd', root + '/prd.md', '--batch-size', '3'])
  assert.equal(r.code, 0, r.out)
  const batches = JSON.parse(fs.readFileSync(out + '/batches.json', 'utf8')).batches
  assert.equal(batches.length, 2, '小批次并入相邻批次')
  assert.equal(batches[0].files.length, 3)
  assert.equal(batches[1].files.length, 2)
  assert.ok(batches[1].title.indexOf('创房规则') >= 0 && batches[1].title.indexOf('亮牌') >= 0, '合并批次标题串联')
  // 关键词回退：无第二层标签的亮牌标题归模块「亮牌」
  assert.equal(batches[1].files.find((f) => f.bugId === '104').module, '亮牌', '无标签按关键词归类')

  // PRD 大纲抽取（行号 标题）
  const outline = fs.readFileSync(out + '/prd-outline.txt', 'utf8')
  assert.match(outline, /1 # 标题一/)
  assert.match(outline, /3 ## 小节/)
  assert.match(outline, /4 # 标题二/)

  // autoPass 预判过滤：结算模块 3 条全部预判不适用
  const r2 = run([root + '/list', out, '--prd', root + '/prd.md', '--batch-size', '3', '--auto-pass-module', '结算'])
  assert.equal(r2.code, 0, r2.out)
  const s2 = JSON.parse(fs.readFileSync(out + '/scan-summary.json', 'utf8'))
  assert.equal(s2.bugCount, 2, 'autoPass 剔除后 2 条待审核')
  assert.equal(s2.prePassCount, 3, '预判不适用 3 条')
  assert.equal(s2.batches.length, 1)
  const in2 = JSON.parse(fs.readFileSync(out + '/bug-verdicts-input.json', 'utf8'))
  assert.equal(in2.allBugs.length, 2)
  assert.equal(in2.prePassBugs.length, 3)
  assert.equal(in2.batches.length, 1)
  const cat2 = JSON.parse(fs.readFileSync(out + '/bug-catalog.json', 'utf8'))
  assert.equal(cat2.bugCount, 2)
  assert.equal(cat2.prePassCount, 3)

  // 失败路径：PRD 路径不存在（不静默适配相近文件名）
  const r3 = run([root + '/list', out, '--prd', root + '/nope.md'])
  assert.equal(r3.code, 1)
  assert.match(r3.out, /PRD 路径不存在/)
  // 失败路径：PRD 来源缺失
  const r4 = run([root + '/list', out])
  assert.equal(r4.code, 1)
  assert.match(r4.out, /PRD 来源缺失/)
  // 失败路径：来源冲突（冲突检查先于快照读取，快照不存在也能命中）
  const r5 = run([root + '/list', out, '--prd', root + '/prd.md', '--prd-from-snapshot', root + '/no-snap'])
  assert.equal(r5.code, 1)
  assert.match(r5.out, /冲突/)
  // 失败路径：参数缺失
  const r6 = run([])
  assert.equal(r6.code, 1)
  assert.match(r6.out, /用法/)
  // 失败路径：快照缺 manifest（--prd-from-snapshot 指向无 manifest 目录）
  const r7 = run([root + '/list', out, '--prd-from-snapshot', root + '/no-snap'])
  assert.equal(r7.code, 1)
  assert.match(r7.out, /manifest\.json/)
  fs.rmSync(root, { recursive: true, force: true })
  console.log('mock 场景: 大纲/autoPass/小批合并/关键词回退/失败路径全部通过')
}

console.log('[成功] bug-scan-plan.example 全部断言通过（真实快照消费/批次全覆盖/收集输入契约/大纲抽取/autoPass 过滤/小批合并/关键词回退/PRD 缺失/来源缺失与冲突/参数缺失/快照缺 manifest）')
