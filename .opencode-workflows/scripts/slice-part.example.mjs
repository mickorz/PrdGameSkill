// slice-part.example.mjs — slice-part.mjs 自检（断言式，跑完打印结果退出）
// 覆盖：机械切片（text 与源一致）/ 行号 1 基 / 多行范围拼接 / CRLF 源 / 越界 /
//       范围反序 / 空白范围 / reqKey 重复 / reqKey 缺省自动编号 / 片段锚点截取 /
//       自定义 reqKeyPrefix / 标题超长警告 / 单侧锚点 / 锚点缺失 / plan 结构校验 / CLI 全链路
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { slicePart } from './slice-part.mjs'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))

const plan = (items, extra = {}) => ({ sourceFile: 'input/x.md', outFile: 'out/part-01.json', items, ...extra })

// 源文本（9 行，中英混合，含表格行）
const SOURCE = [
  '一、概述', // 1
  '本期固定四人', // 2
  'friend room only', // 3
  '底分一', // 4
  '', // 5
  '后续轮庄', // 6
  '| 操作 | 说明 |', // 7
  '| 碰 | 两张可碰牌保持亮度，其余手牌压暗 |', // 8
  '其他家视角。', // 9
].join('\n')

// 场景 1：单行切片，text 与源完全一致（1 基行号）
{
  const r = slicePart(plan([{ reqKey: 'x-001', title: '概述', section: '一、概述', fromLine: 1, toLine: 1 }]), SOURCE)
  assert.equal(r.errors.length, 0)
  assert.equal(r.items[0].text, '一、概述')
  assert.equal(r.items[0].source.fromLine, 1)
  assert.equal(r.items[0].source.file, 'input/x.md')
}

// 场景 2：多行范围拼接（\n 连接），不去改写
{
  const r = slicePart(plan([{ reqKey: 'x-002', title: '多行', section: '2', fromLine: 2, toLine: 4 }]), SOURCE)
  assert.equal(r.items[0].text, '本期固定四人\nfriend room only\n底分一')
}

// 场景 3：CRLF 源文件，行拆分后不带 \r
{
  const r = slicePart(plan([{ reqKey: 'x-003', title: 'CRLF', section: '2', fromLine: 2, toLine: 3 }]), SOURCE.replace(/\n/g, '\r\n'))
  assert.equal(r.items[0].text, '本期固定四人\nfriend room only')
}

// 场景 4：行号越界（toLine > 源文件行数）
{
  const r = slicePart(plan([{ reqKey: 'x-004', title: '越界', section: '2', fromLine: 1, toLine: 99 }]), SOURCE)
  assert.equal(r.errors.length, 1)
  assert.match(r.errors[0], /行号非法/)
  assert.equal(r.items.length, 0)
}

// 场景 5：范围反序（toLine < fromLine）
{
  const r = slicePart(plan([{ reqKey: 'x-005', title: '反序', section: '2', fromLine: 4, toLine: 2 }]), SOURCE)
  assert.match(r.errors[0], /行号非法/)
}

// 场景 6：空白范围（空行）
{
  const r = slicePart(plan([{ reqKey: 'x-006', title: '空白', section: '2', fromLine: 5, toLine: 5 }]), SOURCE)
  assert.match(r.errors[0], /内容为空/)
}

// 场景 7：reqKey 重复
{
  const r = slicePart(
    plan([
      { reqKey: 'x-001', title: 'A', section: '1', fromLine: 1, toLine: 1 },
      { reqKey: 'x-001', title: 'B', section: '1', fromLine: 2, toLine: 2 },
    ]),
    SOURCE
  )
  assert.match(r.errors[0], /reqKey 重复/)
  assert.equal(r.items.length, 1)
}

// 场景 8：reqKey 缺省时按源文件名自动编号
{
  const r = slicePart(plan([{ title: '自动一', section: '1', fromLine: 1, toLine: 1 }, { title: '自动二', section: '1', fromLine: 2, toLine: 2 }]), SOURCE)
  assert.equal(r.errors.length, 0)
  assert.deepEqual(r.items.map((x) => x.reqKey), ['x-001', 'x-002'])
}

// 场景 9：单条错误不影响其他条目（errors 有值，正常条目仍进 items）
{
  const r = slicePart(
    plan([
      { reqKey: 'x-001', title: '甲', section: '1', fromLine: 1, toLine: 1 },
      { reqKey: 'x-002', title: '乙', section: '1', fromLine: 9, toLine: 10 },
      { reqKey: 'x-003', title: '丙', section: '1', fromLine: 2, toLine: 2 },
    ]),
    SOURCE
  )
  assert.equal(r.errors.length, 1)
  assert.equal(r.items.length, 2)
}

// 场景 10：CLI 全链路（写源文件 + plan，跑命令，校验产物与 SUMMARY）
{
  const root = '.opencode-workflows/scripts/tmp-slice'
  fs.rmSync(root, { recursive: true, force: true })
  fs.mkdirSync(root + '/input', { recursive: true })
  fs.writeFileSync(root + '/input/x.md', SOURCE, 'utf8')
  fs.writeFileSync(
    root + '/plan.json',
    JSON.stringify({
      sourceFile: root + '/input/x.md',
      outFile: root + '/out/part-01.json',
      items: [
        { reqKey: 'x-001', title: '概述', section: '一、概述', fromLine: 1, toLine: 1 },
        { reqKey: 'x-002', title: '多行', section: '2', fromLine: 2, toLine: 4 },
      ],
    }, null, 1),
    'utf8'
  )
  const out = execFileSync(process.execPath, [path.join(SCRIPT_DIR, 'slice-part.mjs'), root + '/plan.json'], { encoding: 'utf8' })
  assert.match(out, /\[成功\] 切片完成：2 条/)
  assert.match(out, /SUMMARY \{"count":2/)
  const part = JSON.parse(fs.readFileSync(root + '/out/part-01.json', 'utf8'))
  assert.equal(part.length, 2)
  assert.equal(part[1].text, '本期固定四人\nfriend room only\n底分一')
  assert.equal(part[0].source.file, root + '/input/x.md')

  // plan 结构不完整 → 失败退出
  fs.writeFileSync(root + '/plan-bad.json', JSON.stringify({ sourceFile: root + '/input/x.md' }), 'utf8')
  let code = 0
  try {
    execFileSync(process.execPath, [path.join(SCRIPT_DIR, 'slice-part.mjs'), root + '/plan-bad.json'])
  } catch (e) {
    code = e.status
  }
  assert.equal(code, 1)
  fs.rmSync(root, { recursive: true, force: true })
}

// 场景 11：startText/endText 片段截取（表格行只取某一格）
{
  const r = slicePart(plan([{ reqKey: 'x-011', title: '碰高亮', section: '4.5', fromLine: 8, startText: '两张', endText: '压暗' }]), SOURCE)
  assert.equal(r.errors.length, 0)
  assert.equal(r.items[0].text, '两张可碰牌保持亮度，其余手牌压暗')
}

// 场景 12：自定义 reqKeyPrefix 自动编号
{
  const r = slicePart(plan([{ title: '甲', fromLine: 1 }, { title: '乙', fromLine: 2 }], { reqKeyPrefix: 'hzmj-prd' }), SOURCE)
  assert.deepEqual(r.items.map((x) => x.reqKey), ['hzmj-prd-001', 'hzmj-prd-002'])
}

// 场景 13：标题超长只警告，仍产出
{
  const r = slicePart(plan([{ reqKey: 'x-013', title: '这是一个明显超过二十个字符长度限制的小标题文本', fromLine: 1 }]), SOURCE)
  assert.equal(r.errors.length, 0)
  assert.equal(r.items.length, 1)
  assert.ok(r.warnings.some((w) => w.includes('标题超过')), '缺少标题超长警告')
}

// 场景 14：只给单侧锚点 → 错误
{
  const r = slicePart(plan([{ reqKey: 'x-014', title: '半锚点', fromLine: 8, startText: '两张' }]), SOURCE)
  assert.match(r.errors[0], /必须同时给出/)
}

// 场景 15：startText 不存在 / endText 在 startText 之前
{
  const r1 = slicePart(plan([{ reqKey: 'x-015', title: '锚点错', fromLine: 8, startText: '不存在的片段', endText: '压暗' }]), SOURCE)
  assert.match(r1.errors[0], /startText 未出现/)
  const r2 = slicePart(plan([{ reqKey: 'x-016', title: '锚点反序', fromLine: 8, startText: '压暗', endText: '两张' }]), SOURCE)
  assert.match(r2.errors[0], /endText 未出现/)
}

// 场景 16：section 缺省时自动回填最近标题
{
  const doc = ['# 二、功能详情', '', '## 4.5 行牌操作', '', '摸牌一张。', '', '## 4.6 吃碰杠胡操作', '', '碰牌成立。'].join('\n')
  const r = slicePart({ sourceFile: 'input/y.md', outFile: 'o.json', items: [{ reqKey: 'y-001', title: '摸牌', fromLine: 5 }, { reqKey: 'y-002', title: '碰牌', fromLine: 9 }] }, doc)
  assert.equal(r.errors.length, 0)
  assert.equal(r.items[0].source.section, '4.5 行牌操作')
  assert.equal(r.items[1].source.section, '4.6 吃碰杠胡操作')
}

// 场景 17：section 含图片占位符时自动回填，不把 {{IP_xxx}} 带进产物
{
  const doc = ['## 4.7 多操作状态', '', '按钮排列。'].join('\n')
  const r = slicePart({ sourceFile: 'input/z.md', outFile: 'o.json', items: [{ reqKey: 'z-001', title: '按钮', section: '{{IP_abc123}} 按钮区', fromLine: 3 }] }, doc)
  assert.equal(r.items[0].source.section, '4.7 多操作状态')
}

// 场景 18：章节覆盖率统计（表头/分隔行不计入需求行）
{
  const doc = ['# 一、总览', '', '总览一句话。', '', '## 4.5 行牌操作', '', '| 操作 | 说明 |', '| --- | --- |', '| 摸牌 | 取一张 |', '| 出牌 | 打一张 |'].join('\n')
  const r = slicePart({ sourceFile: 'input/c.md', outFile: 'o.json', items: [{ reqKey: 'c-001', title: '摸牌', fromLine: 9 }] }, doc)
  const cov = r.coverage
  assert.equal(cov.totalLines, 3, '需求行应为 总览一句话 + 两行表格数据（表头/分隔行不计）')
  assert.equal(cov.totalCovered, 1)
  assert.deepEqual(cov.uncovered, ['一、总览'])
  assert.equal(cov.rate, 0.333)
}

console.log('[成功] slice-part.example 全部场景通过（机械切片/多行拼接/CRLF/越界/反序/空白/重复键/自动编号/片段锚点/前缀编号/标题告警/单向锚点/锚点缺失/结构失败/CLI 全链路/章节回填/占位符回填/覆盖率）')
