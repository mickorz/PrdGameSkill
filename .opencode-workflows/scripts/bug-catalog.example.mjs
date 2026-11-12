// bug-catalog.example.mjs —— bug-catalog.mjs 自检（v4 阶段 7）
// 场景：真实目录全量抽取（数量= .md 文件数、ID 唯一）/ 模块解析（第二层标签 + 关键词回退）/
//       mock：无第二层标签回退归类 / 空 md 名 / bugId 重复拒绝 / 目录不存在 / 参数缺失
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const run = (args) => {
  try { return { code: 0, out: execFileSync('node', ['.opencode-workflows/scripts/bug-catalog.mjs', ...args], { encoding: 'utf8' }) } }
  catch (e) { return { code: e.status, out: (e.stdout || '') + (e.stderr || '') } }
}

// 场景 1：真实目录全量抽取
{
  const mdCount = fs.readdirSync('bugs/buglist').filter((f) => f.endsWith('.md')).length
  const r = run(['bugs/buglist', 'output/projects/hzmj/bug-catalog.json'])
  assert.equal(r.code, 0, r.out)
  const doc = JSON.parse(fs.readFileSync('output/projects/hzmj/bug-catalog.json', 'utf8'))
  assert.equal(doc.bugs.length, mdCount, '全量入 catalog（一条不漏）')
  const ids = new Set(doc.bugs.map((b) => b.bugId))
  assert.equal(ids.size, doc.bugs.length, 'ID 唯一')
  assert.ok(doc.bugs.every((b) => b.bugId && b.title && b.module && b.sourceFile), '字段齐')
  console.log('真实目录: ' + doc.count + ' 条（.md 文件 ' + mdCount + ' 个）模块 ' + new Set(doc.bugs.map((b) => b.module)).size + ' 个')
}

// 场景 2：模块解析语义
{
  const root = '.opencode-workflows/scripts/tmp-bugcat'
  fs.rmSync(root, { recursive: true, force: true })
  fs.mkdirSync(root + '/list', { recursive: true })
  fs.writeFileSync(root + '/list/111-【卡五星】【创房规则】测试.md', 'x', 'utf8')
  fs.writeFileSync(root + '/list/222-结算标题无二层标签.md', 'x', 'utf8')
  fs.writeFileSync(root + '/list/333-【单玩法】无模块标签.md', 'x', 'utf8')
  fs.writeFileSync(root + '/list/_batch.log', 'x', 'utf8')
  const r = run([root + '/list', root + '/cat.json'])
  assert.equal(r.code, 0, r.out)
  const doc = JSON.parse(fs.readFileSync(root + '/cat.json', 'utf8'))
  assert.equal(doc.bugs.length, 3, '.log 不入 catalog')
  const byId = new Map(doc.bugs.map((b) => [b.bugId, b]))
  assert.equal(byId.get('111').module, '创房规则', '第二层【】标签为模块')
  assert.equal(byId.get('222').module, '结算', '无第二层标签按关键词归类')
  assert.equal(byId.get('333').module, '其他', '无标签无关键词归其他')
  assert.equal(byId.get('222').title, '结算标题无二层标签', 'title 去掉数字前缀')
  // 场景 3：bugId 重复拒绝
  fs.writeFileSync(root + '/list/222-重复前缀.md', 'x', 'utf8')
  const r2 = run([root + '/list', root + '/cat2.json'])
  assert.equal(r2.code, 1)
  assert.match(r2.out, /bugId 重复/)
  // 场景 4：目录不存在
  const r3 = run([root + '/nope', root + '/c.json'])
  assert.equal(r3.code, 1); assert.match(r3.out, /目录不存在/)
  // 场景 5：参数缺失
  const r4 = run([])
  assert.equal(r4.code, 1); assert.match(r4.out, /用法/)
  // 场景 6：空目录（无 .md）
  fs.mkdirSync(root + '/empty', { recursive: true })
  const r5 = run([root + '/empty', root + '/c.json'])
  assert.equal(r5.code, 1); assert.match(r5.out, /无 \.md 缺陷文件/)
  fs.rmSync(root, { recursive: true, force: true })
}

console.log('[成功] bug-catalog.example 全部断言通过（真实全量/ID唯一/模块语义二层标签/关键词回退/其他/log排除/重复拒绝/目录不存在/参数缺失/空目录）')
