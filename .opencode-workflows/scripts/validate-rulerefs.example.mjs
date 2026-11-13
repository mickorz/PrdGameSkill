// validate-rulerefs.example.mjs —— validate-rulerefs.mjs 自检（10 场景）
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const run = (args) => {
  try { return { code: 0, out: execFileSync('node', ['.opencode-workflows/scripts/validate-rulerefs.mjs', ...args], { encoding: 'utf8' }) } }
  catch (e) { return { code: e.status, out: (e.stdout || '') + (e.stderr || '') } }
}

// 临时规则基准 fixture：01 有 25 条、02 有 14 条、00 有 4 条
const root = '.opencode-workflows/scripts/tmp-refcheck'
fs.rmSync(root, { recursive: true, force: true })
fs.mkdirSync(root + '/rules', { recursive: true })
const mkRules = (name, count) => {
  const lines = ['# ' + name + '\n']
  for (let i = 1; i <= count; i++) lines.push(i + '. 第 ' + i + ' 条规则内容。锚点：test.ts\n')
  fs.writeFileSync(root + '/rules/' + name, lines.join('\n'), 'utf8')
}
mkRules('00-基准说明.md', 4)
mkRules('01-操作按钮与权限.md', 25)
mkRules('02-听牌提示.md', 14)

// 1. refs 模式全部合法（多条款引用 + 重复条款去重）
let r = run(['--rules', root + '/rules', '--refs', 'Q01@01#9,02#12;Q02@01#1,01#1'])
assert.equal(r.code, 0); assert.match(r.out, /ruleRef 校验通过/)
// 2. refs 模式条款号不存在（01#42，01 文件只有 1~25）
r = run(['--rules', root + '/rules', '--refs', 'Q35@01#42'])
assert.equal(r.code, 1); assert.match(r.out, /01#42 不存在/); assert.match(r.out, /1~25/)
// 3. refs 模式未引用任何条款（@无）
r = run(['--rules', root + '/rules', '--refs', 'Q02@无'])
assert.equal(r.code, 1); assert.match(r.out, /未引用任何基准条款号/)
// 4. refs 模式条款文件不存在（09#1）
r = run(['--rules', root + '/rules', '--refs', 'Q03@09#1'])
assert.equal(r.code, 1); assert.match(r.out, /条款文件 09 不存在/)
// 5. refs 模式条款文件存在但格式无 NN#M
r = run(['--rules', root + '/rules', '--refs', 'Q04@操作按钮'])
assert.equal(r.code, 1); assert.match(r.out, /未包含任何 NN#M/)
// 6. refs 模式可引用 00 基准说明条款
r = run(['--rules', root + '/rules', '--refs', 'Q05@00#2'])
assert.equal(r.code, 0)
// 7. report 模式合法报告通过
fs.writeFileSync(root + '/report-ok.md', '| Q01 | UI 交互 | P1 | MISSING | x | y | z | 01#9,02#3 |\n基准依据：01#12。\n', 'utf8')
r = run(['--rules', root + '/rules', '--report', root + '/report-ok.md'])
assert.equal(r.code, 0); assert.match(r.out, /校验通过/)
// 8. report 模式幻觉条款号失败（带行号）
fs.writeFileSync(root + '/report-bad.md', '| Q01 | UI 交互 | P0 | MISSING | x | y | z | 01#42 |\n说明：见 08#36。\n', 'utf8')
r = run(['--rules', root + '/rules', '--report', root + '/report-bad.md'])
assert.equal(r.code, 1); assert.match(r.out, /01#42 不存在/); assert.match(r.out, /条款文件 08 不存在/); assert.match(r.out, /第 \d+ 行/)
// 9. report 模式标记串（无（原条款号未匹配规则基准，待人工核对））不误报
fs.writeFileSync(root + '/report-marked.md', '基准依据：无（原条款号未匹配规则基准，待人工核对）。\n', 'utf8')
r = run(['--rules', root + '/rules', '--report', root + '/report-marked.md'])
assert.equal(r.code, 0)
// 10. 参数缺失 + --out 落盘 JSON
r = run([])
assert.equal(r.code, 1); assert.match(r.out, /用法/)
r = run(['--rules', root + '/rules', '--refs', 'Q01@01#42', '--out', root + '/result.json'])
assert.equal(r.code, 1)
const result = JSON.parse(fs.readFileSync(root + '/result.json', 'utf8'))
assert.equal(result.ok, false); assert.equal(result.invalidCount, 1); assert.equal(result.invalid[0].ref, '01#42')

fs.rmSync(root, { recursive: true, force: true })
console.log('[成功] validate-rulerefs.example 10 场景全过（refs合法/条款号不存在/未引用/文件不存在/无NNM格式/00条款可引/report合法/report幻觉带行号/标记串不误报/参数缺失与out落盘）')
