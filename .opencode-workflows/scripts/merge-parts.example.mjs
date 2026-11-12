// merge-parts.example.mjs —— merge-parts.mjs 自检（断言式，跑完打印结果退出）
// 覆盖：正常合并（顺序+空行分隔+尾部换行）/ 删分片 / 缺分片退出码 1 / 无分片参数 /
//       乱码检出退出码 2（文件仍写出）/ 空内容分片
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const run = (args) => {
  try {
    const out = execFileSync('node', ['.opencode-workflows/scripts/merge-parts.mjs', ...args], { encoding: 'utf8' })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }
  }
}

const root = '.opencode-workflows/scripts/tmp-merge'
fs.rmSync(root, { recursive: true, force: true })
fs.mkdirSync(root, { recursive: true })
const w = (name, text) => {
  fs.writeFileSync(root + '/' + name, text, 'utf8')
  return root + '/' + name
}

// 场景 1：正常合并（顺序、空行分隔、尾部换行、删分片）
{
  const p1 = w('p1.md', '# 标题\n\n第一段。')
  const p2 = w('p2.md', '## 二\n\n第二段。')
  const out = root + '/out.md'
  const r = run([out, p1, p2])
  assert.equal(r.code, 0)
  assert.match(r.out, /\[成功\] 合并完成：2 个分片/)
  assert.match(r.out, /SUMMARY \{"outFile":/)
  assert.equal(fs.readFileSync(out, 'utf8'), '# 标题\n\n第一段。\n\n## 二\n\n第二段。\n')
  assert.equal(fs.existsSync(p1), false)
  assert.equal(fs.existsSync(p2), false)
  // UTF-8 无 BOM
  assert.equal(fs.readFileSync(out)[0], 0x23) // '#'
}

// 场景 2：分片尾部多余空行被规整（trimEnd + 单空行分隔）
{
  const p1 = w('p1.md', 'A\n\n\n')
  const p2 = w('p2.md', 'B\n\n\n')
  const out = root + '/out2.md'
  run([out, p1, p2])
  assert.equal(fs.readFileSync(out, 'utf8'), 'A\n\nB\n')
}

// 场景 3：缺分片 → 退出码 1（fail-fast）
{
  const p1 = w('p1.md', 'A')
  const out = root + '/out3.md'
  const r = run([out, p1, root + '/不存在.md'])
  assert.equal(r.code, 1)
  assert.match(r.out, /分片缺失 1 个/)
  assert.equal(fs.existsSync(out), false)
}

// 场景 4：无分片参数 → 退出码 1
{
  const r = run([root + '/out4.md'])
  assert.equal(r.code, 1)
}

// 场景 5：乱码检出 → 退出码 2，文件已写出，列出行号
{
  const p1 = w('p1.md', '正常内容')
  const p2 = w('p2.md', '含乱码 \uFFFD 字符\n第二行 \uFFFD')
  const out = root + '/out5.md'
  const r = run([out, p1, p2])
  assert.equal(r.code, 2)
  assert.match(r.out, /乱码替换字符 U\+FFFD 共 2 处/)
  assert.equal(fs.existsSync(out), true)
  assert.match(r.out, /SUMMARY \{"outFile":/)
}

fs.rmSync(root, { recursive: true, force: true })
console.log('[成功] merge-parts.example 全部断言通过（正常合并/空行规整/缺分片fail-fast/无分片/乱码exit2/删分片）')
