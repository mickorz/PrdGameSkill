// slice-part.example.mjs —— slice-part.mjs 自检（断言式，跑完打印结果退出）
// 覆盖：正常切片（text 与源行一致）/ 行号 1 基 / 多行范围拼接 / CRLF 源 / 越界 /
//       范围倒置 / 空白范围 / reqKey 重复 / reqKey 缺失 / plan 结构校验 / CLI 全链路
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { slicePart } from './slice-part.mjs'

const plan = (items, extra = {}) => ({ sourceFile: 'input/x.md', outFile: 'out/part-01.json', items, ...extra })

// 源文本（6 行，含中英文）
const SOURCE = ['一、总则', '四人麻將', 'friend room only', '底分一', '', '流局连庄'].join('\n')

// 场景 1：正常切片，text 与源行完全一致（1 基行号）
{
  const r = slicePart(plan([{ reqKey: 'x-001', title: '总则', section: '一、总则', fromLine: 1, toLine: 1 }]), SOURCE)
  assert.equal(r.errors.length, 0)
  assert.equal(r.items[0].text, '一、总则')
  assert.equal(r.items[0].source.fromLine, 1)
  assert.equal(r.items[0].source.file, 'input/x.md')
}

// 场景 2：多行范围拼接（\n 连接，不改写）
{
  const r = slicePart(plan([{ reqKey: 'x-002', title: '规则', section: '二', fromLine: 2, toLine: 4 }]), SOURCE)
  assert.equal(r.items[0].text, '四人麻將\nfriend room only\n底分一')
}

// 场景 3：CRLF 源文件（切出行内容不带 \r）
{
  const r = slicePart(plan([{ reqKey: 'x-003', title: 'CRLF', section: '2', fromLine: 2, toLine: 3 }]), SOURCE.replace(/\n/g, '\r\n'))
  assert.equal(r.items[0].text, '四人麻將\nfriend room only')
}

// 场景 4：行号越界（toLine > 总行数）
{
  const r = slicePart(plan([{ reqKey: 'x-004', title: '越界', section: '2', fromLine: 1, toLine: 99 }]), SOURCE)
  assert.equal(r.errors.length, 1)
  assert.match(r.errors[0], /行号非法/)
  assert.equal(r.items.length, 0)
}

// 场景 5：范围倒置（toLine < fromLine）
{
  const r = slicePart(plan([{ reqKey: 'x-005', title: '倒置', section: '2', fromLine: 4, toLine: 2 }]), SOURCE)
  assert.match(r.errors[0], /行号非法/)
}

// 场景 6：空白范围（空行）
{
  const r = slicePart(plan([{ reqKey: 'x-006', title: '空白', section: '2', fromLine: 5, toLine: 5 }]), SOURCE)
  assert.match(r.errors[0], /内容为空白/)
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

// 场景 8：reqKey 缺失
{
  const r = slicePart(plan([{ title: '无键', section: '1', fromLine: 1, toLine: 1 }]), SOURCE)
  assert.match(r.errors[0], /reqKey 缺失/)
}

// 场景 9：单条错误不影响其余条目产出（错误进 errors，好条目进 items）
{
  const r = slicePart(
    plan([
      { reqKey: 'x-001', title: '好', section: '1', fromLine: 1, toLine: 1 },
      { reqKey: 'x-002', title: '坏', section: '1', fromLine: 9, toLine: 10 },
      { reqKey: 'x-003', title: '好', section: '1', fromLine: 2, toLine: 2 },
    ]),
    SOURCE
  )
  assert.equal(r.errors.length, 1)
  assert.equal(r.items.length, 2)
}

// 场景 10：CLI 全链路（写源文件 + plan，跑命令，验证产物与 SUMMARY）
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
        { reqKey: 'x-001', title: '总则', section: '一、总则', fromLine: 1, toLine: 1 },
        { reqKey: 'x-002', title: '规则', section: '二', fromLine: 2, toLine: 4 },
      ],
    }, null, 1),
    'utf8'
  )
  const out = execFileSync('node', ['.opencode-workflows/scripts/slice-part.mjs', root + '/plan.json'], { encoding: 'utf8' })
  assert.match(out, /\[成功\] 切片完成：2 条/)
  assert.match(out, /SUMMARY \{"count":2/)
  const part = JSON.parse(fs.readFileSync(root + '/out/part-01.json', 'utf8'))
  assert.equal(part.length, 2)
  assert.equal(part[1].text, '四人麻將\nfriend room only\n底分一')
  assert.equal(part[0].source.file, root + '/input/x.md')

  // plan 结构不完整 → 失败退出
  fs.writeFileSync(root + '/plan-bad.json', JSON.stringify({ sourceFile: root + '/input/x.md' }), 'utf8')
  let code = 0
  try {
    execFileSync('node', ['.opencode-workflows/scripts/slice-part.mjs', root + '/plan-bad.json'])
  } catch (e) {
    code = e.status
  }
  assert.equal(code, 1)
  fs.rmSync(root, { recursive: true, force: true })
}

console.log('[成功] slice-part.example 全部断言通过（正常切片/多行拼接/CRLF/越界/倒置/空白/重复键/缺键/部分失败/CLI全链路）')
