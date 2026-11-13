// merge-stage-doc-parts.example.mjs —— mergeStageDocParts 自检（10 场景）
// 运行：node .opencode-workflows/scripts/merge-stage-doc-parts.example.mjs

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { mergeStageDocParts } from './merge-stage-doc-parts.mjs'

let pass = 0
let fail = 0
const fails = []

function assert(cond, name) {
  if (cond) {
    pass++
  } else {
    fail++
    fails.push(name)
  }
}

function mkTemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'merge-doc-parts-'))
}

// 场景 1：3 片按序合并 + 尾空白裁剪 + 空行连接 + 分片删除
{
  const d = mkTemp()
  fs.writeFileSync(path.join(d, 'part-1.md'), '# 头\n\n内容一\n\n\n', 'utf8')
  fs.writeFileSync(path.join(d, 'part-2.md'), '内容二\n', 'utf8')
  fs.writeFileSync(path.join(d, 'part-3.md'), '内容三\n  \n', 'utf8')
  const t = path.join(d, 'out', 'stage.md')
  const r = mergeStageDocParts(d, t, 3)
  assert(r.ok === true, '场景1 合并成功')
  assert(r.chars > 0, '场景1 chars>0')
  const txt = fs.readFileSync(t, 'utf8')
  assert(txt === '# 头\n\n内容一\n\n内容二\n\n内容三\n', '场景1 合并文本正确（尾空白裁剪+空行连接+末尾换行）')
  assert(!fs.existsSync(path.join(d, 'part-1.md')), '场景1 分片已删除')
  assert(fs.readdirSync(d).every((n) => n === 'out'), '场景1 分片目录无残留分片（仅目标子目录）')
  fs.rmSync(d, { recursive: true, force: true })
}

// 场景 2：目录不存在
{
  const r = mergeStageDocParts('Z:/no/such/dir', 'Z:/no/such/target.md')
  assert(r.ok === false && r.problems[0].includes('不存在'), '场景2 目录不存在报错')
}

// 场景 3：目录存在但无分片
{
  const d = mkTemp()
  const r = mergeStageDocParts(d, path.join(d, 't.md'))
  assert(r.ok === false && r.problems[0].includes('无 part-N.md'), '场景3 无分片报错')
  fs.rmSync(d, { recursive: true, force: true })
}

// 场景 4：expectedCount 不符
{
  const d = mkTemp()
  fs.writeFileSync(path.join(d, 'part-1.md'), 'a\n', 'utf8')
  fs.writeFileSync(path.join(d, 'part-2.md'), 'b\n', 'utf8')
  const r = mergeStageDocParts(d, path.join(d, 't.md'), 3)
  assert(r.ok === false && r.problems[0].includes('分片数不符'), '场景4 片数不符报错')
  assert(fs.existsSync(path.join(d, 'part-1.md')), '场景4 失败时分片保留')
  fs.rmSync(d, { recursive: true, force: true })
}

// 场景 5：序号不连续（缺 part-2）
{
  const d = mkTemp()
  fs.writeFileSync(path.join(d, 'part-1.md'), 'a\n', 'utf8')
  fs.writeFileSync(path.join(d, 'part-3.md'), 'c\n', 'utf8')
  const r = mergeStageDocParts(d, path.join(d, 't.md'))
  assert(r.ok === false && r.problems[0].includes('序号不连续'), '场景5 序号不连续报错')
  fs.rmSync(d, { recursive: true, force: true })
}

// 场景 6：乱码 U+FFFD 拒绝合并
{
  const d = mkTemp()
  fs.writeFileSync(path.join(d, 'part-1.md'), '正常\n', 'utf8')
  fs.writeFileSync(path.join(d, 'part-2.md'), '乱\uFFFD码\n', 'utf8')
  const t = path.join(d, 't.md')
  const r = mergeStageDocParts(d, t)
  assert(r.ok === false && r.problems[0].includes('U+FFFD'), '场景6 乱码拒绝')
  assert(!fs.existsSync(t), '场景6 乱码时目标不写')
  assert(fs.existsSync(path.join(d, 'part-1.md')), '场景6 乱码时分片保留')
  fs.rmSync(d, { recursive: true, force: true })
}

// 场景 7：单片合并（expectedCount=1）
{
  const d = mkTemp()
  fs.writeFileSync(path.join(d, 'part-1.md'), '单片段落\n\n', 'utf8')
  const t = path.join(d, 't.md')
  const r = mergeStageDocParts(d, t, 1)
  assert(r.ok === true && fs.readFileSync(t, 'utf8') === '单片段落\n', '场景7 单片合并')
  fs.rmSync(d, { recursive: true, force: true })
}

// 场景 8：忽略非分片文件（part json、其他 md 不参与）
{
  const d = mkTemp()
  fs.writeFileSync(path.join(d, 'part-1.json'), '{"a":1}', 'utf8')
  fs.writeFileSync(path.join(d, 'part-1.md'), '一\n', 'utf8')
  fs.writeFileSync(path.join(d, 'part-2.md'), '二\n', 'utf8')
  fs.writeFileSync(path.join(d, 'notes.md'), '别的文件\n', 'utf8')
  const t = path.join(d, 't.md')
  const r = mergeStageDocParts(d, t, 2)
  assert(r.ok === true && fs.readFileSync(t, 'utf8') === '一\n\n二\n', '场景8 只合并 part-N.md')
  assert(fs.existsSync(path.join(d, 'notes.md')), '场景8 无关文件不动')
  assert(fs.existsSync(path.join(d, 'part-1.json')), '场景8 分片 json 保留')
  fs.rmSync(d, { recursive: true, force: true })
}

// 场景 9：目标目录自动创建
{
  const d = mkTemp()
  fs.writeFileSync(path.join(d, 'part-1.md'), 'x\n', 'utf8')
  const t = path.join(d, 'deep', 'nested', 't.md')
  const r = mergeStageDocParts(d, t)
  assert(r.ok === true && fs.existsSync(t), '场景9 目标目录自动创建')
  fs.rmSync(d, { recursive: true, force: true })
}

// 场景 10：10 片乱序写入仍按编号升序合并
{
  const d = mkTemp()
  for (let i = 10; i >= 1; i--) fs.writeFileSync(path.join(d, 'part-' + i + '.md'), '段' + i + '\n', 'utf8')
  const t = path.join(d, 't.md')
  const r = mergeStageDocParts(d, t, 10)
  assert(r.ok === true, '场景10 10片成功')
  assert(fs.readFileSync(t, 'utf8') === '段1\n\n段2\n\n段3\n\n段4\n\n段5\n\n段6\n\n段7\n\n段8\n\n段9\n\n段10\n', '场景10 按编号升序')
  fs.rmSync(d, { recursive: true, force: true })
}

console.log('merge-stage-doc-parts.example: ' + pass + ' pass / ' + fail + ' fail')
if (fail > 0) {
  fails.forEach((f) => console.error('FAIL: ' + f))
  process.exit(1)
}
