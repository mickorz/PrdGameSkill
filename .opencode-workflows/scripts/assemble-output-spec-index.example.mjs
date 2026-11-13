// assemble-output-spec-index.example.mjs —— assemble-output-spec-index.mjs 自检（断言式，跑完打印结果退出）
// 覆盖：正常装配（feature_index 计数/字段映射 + stage_manifest 行）/ 空目录退出码 1 /
//       stage.id 与文件名不一致退出码 1 / 原子项 ID 重复退出码 1 / 期望阶段数不符退出码 1 /
//       功能点无原子项退出码 1 / UI 模块与协议消息提取
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const SCRIPT = '.opencode-workflows/scripts/assemble-output-spec-index.mjs'

const run = (args) => {
  try {
    const out = execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8' })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }
  }
}

const root = '.opencode-workflows/scripts/tmp-assemble-index'
fs.rmSync(root, { recursive: true, force: true })
fs.mkdirSync(root, { recursive: true })

function makePart(name, obj) {
  const p = root + '/runtime/parts/' + name
  fs.mkdirSync(root + '/runtime/parts', { recursive: true })
  fs.writeFileSync(p, JSON.stringify(obj), 'utf8')
  return p
}

function atom(id, over) {
  return Object.assign(
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
}

// 场景 1：正常装配（两阶段，含 partial/not_found、多消息、UI 模块提取）
{
  makePart('ST-C01.json', {
    stage: { id: 'ST-C01', name: '定庄与轮庄', chapter: '开局 > 定庄与轮庄', summary: '概述一', terms: [{ term: '连庄', definition: '同一庄家连续坐庄', source: '模板名词章节' }], crossCutting: ['快照跨局保留'] },
    features: [
      { id: 'FP-ST-C01-001', name: '首局定庄', description: '首局庄家来源', scope: '', coordination: '', atoms: [atom('AT-ST-C01-001'), atom('AT-ST-C01-002', { verdict: 'not_found', evidence: [], clientLogic: '', uiInteraction: '' })] },
    ],
  })
  makePart('ST-C02.json', {
    stage: { id: 'ST-C02', name: '掷骰与定财神', chapter: '开局 > 掷骰与定财神', summary: '概述二', terms: [], crossCutting: [] },
    features: [
      { id: 'FP-ST-C02-001', name: '掷骰', description: '掷骰定开牌位置', scope: '', coordination: '', atoms: [atom('AT-ST-C02-001', { verdict: 'partial', messages: ['MsgThrowChip', 'MsgJuData'] })] },
    ],
  })
  const r = run([root, '2026-11-13', '模板+代码', '2'])
  assert.equal(r.code, 0)
  assert.match(r.out, /\[成功\] feature_index\.json：2 阶段 \/ 2 功能点 \/ 3 原子项/)
  assert.match(r.out, /\[成功\] stage_manifest\.md：2 行阶段表（confirmed 1 \/ partial 1 \/ not_found 1）/)

  const idx = JSON.parse(fs.readFileSync(root + '/feature_index.json', 'utf8'))
  assert.equal(idx.stage_count, 2)
  assert.equal(idx.feature_count, 2)
  assert.equal(idx.atom_count, 3)
  assert.equal(idx.stages[0].id, 'ST-C01')
  assert.equal(idx.features[0].atoms[1].owner, 'client')
  assert.equal(idx.features[0].atoms[1].verdict, 'not_found')
  assert.deepEqual(idx.features[1].atoms[0].messages, ['MsgThrowChip', 'MsgJuData'])
  // 索引证据不带摘录（摘录保留在阶段文档）
  assert.deepEqual(idx.features[0].atoms[0].evidence, [{ file: 'source-code/client/Code/fgui/box_hzmj_main/x.ts', location: 'x.ts:10' }])
  // UTF-8 无 BOM
  assert.equal(fs.readFileSync(root + '/feature_index.json')[0], 0x7b) // '{'

  const manifest = fs.readFileSync(root + '/stage_manifest.md', 'utf8')
  assert.match(manifest, /\| ST-C01 \| 定庄与轮庄 \| 开局 > 定庄与轮庄 \| 1 \| 2 \| 1 \| 0 \| 1 \| MsgJuData \| box_hzmj_main \|/)
  assert.match(manifest, /\| \*\*合计\*\* \| \| \| \*\*2\*\* \| \*\*3\*\* \| \*\*1\*\* \| \*\*1\*\* \| \*\*1\*\* \| \| \|/)
}

// 场景 2：期望阶段数不符（残留片段） → 退出码 1
{
  const r = run([root, '2026-11-13', '模板+代码', '3'])
  assert.equal(r.code, 1)
  assert.match(r.out, /片段数与期望阶段数不符：期望 3，实际 2/)
}

// 场景 3：stage.id 与文件名不一致 → 退出码 1
{
  makePart('ST-C09.json', { stage: { id: 'ST-C08', name: '错位', chapter: '', summary: '', terms: [], crossCutting: [] }, features: [{ id: 'FP-ST-C08-001', name: 'f', description: 'd', atoms: [atom('AT-ST-C08-001')] }] })
  const r = run([root, '2026-11-13', '模板+代码'])
  assert.equal(r.code, 1)
  assert.match(r.out, /stage\.id 与文件名不一致：ST-C09\.json \/ ST-C08/)
  fs.rmSync(root + '/runtime/parts/ST-C09.json')
}

// 场景 4：原子项 ID 跨阶段重复 → 退出码 1
{
  makePart('ST-C03.json', {
    stage: { id: 'ST-C03', name: '重复原子', chapter: '', summary: '', terms: [], crossCutting: [] },
    features: [{ id: 'FP-ST-C03-001', name: 'f', description: 'd', atoms: [atom('AT-ST-C01-001')] }],
  })
  const r = run([root, '2026-11-13', '模板+代码'])
  assert.equal(r.code, 1)
  assert.match(r.out, /原子项 ID 重复：AT-ST-C01-001/)
  fs.rmSync(root + '/runtime/parts/ST-C03.json')
}

// 场景 5：功能点无原子项 → 退出码 1
{
  makePart('ST-C03.json', {
    stage: { id: 'ST-C03', name: '空功能点', chapter: '', summary: '', terms: [], crossCutting: [] },
    features: [{ id: 'FP-ST-C03-001', name: 'f', description: 'd', atoms: [] }],
  })
  const r = run([root, '2026-11-13', '模板+代码'])
  assert.equal(r.code, 1)
  assert.match(r.out, /功能点无原子项：FP-ST-C03-001/)
  fs.rmSync(root + '/runtime/parts/ST-C03.json')
}

// 场景 6：片段目录为空 → 退出码 1
{
  fs.rmSync(root + '/runtime/parts', { recursive: true, force: true })
  fs.mkdirSync(root + '/runtime/parts', { recursive: true })
  const r = run([root, '2026-11-13', '模板+代码'])
  assert.equal(r.code, 1)
  assert.match(r.out, /片段目录为空/)
}

// 场景 7：片段目录不存在 → 退出码 1
{
  fs.rmSync(root, { recursive: true, force: true })
  const r = run([root + '/不存在', '2026-11-13', '模板+代码'])
  assert.equal(r.code, 1)
  assert.match(r.out, /片段目录不存在/)
}

fs.rmSync(root, { recursive: true, force: true })
console.log('[成功] assemble-output-spec-index.example 全部断言通过（正常装配/阶段数不符/ID错位/原子ID重复/空功能点/空目录/目录缺失）')
