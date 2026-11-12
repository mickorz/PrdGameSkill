// align-check.example.mjs —— align-check.mjs 自检（断言式，跑完打印结果退出）
// 覆盖：exact 全文对齐 / anchor 唯一候选 / anchor 显著领先 / 多候选无法区分 / 相似度不足 /
//       无同章节候选 / 快照侧未对齐 / 消耗后不复用 / 空文本 / 报告产物与门槛判定
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { alignRequirements } from './align-check.mjs'

const s = (id, text, section, file) => ({
  requirementId: id,
  reqKey: 'snap-' + id,
  title: 'T' + id,
  text,
  source: { file: file || 'prd.md', section, fromLine: 1, toLine: 2 },
  identityStatus: 'new',
})
const b = (key, text, section, file) => ({
  reqKey: key,
  title: 'B' + key,
  text,
  source: { file: file || 'prd.md', section, fromLine: 1, toLine: 2 },
})

// 场景 1：exact 全文相同直接对齐
{
  const r = alignRequirements([b('B1', '庄家发牌十三张')], [s('REQ-1', '庄家发牌十三张', '2.1')])
  assert.equal(r.stats.exactMatch, 1)
  assert.equal(r.matches[0].method, 'exact')
  assert.equal(r.matches[0].snapshotId, 'REQ-1')
}

// 场景 2：anchor 唯一候选（相似度达标）
{
  const r = alignRequirements(
    [b('B1', '庄家发放13张牌，闲家14张牌', '2.1')],
    [s('REQ-1', '庄家发放13张牌，闲家15张牌', '2.1')]
  )
  assert.equal(r.stats.anchorMatch, 1)
  assert.equal(r.matches[0].method, 'anchor')
  assert.ok(r.matches[0].similarity >= 0.6)
}

// 场景 3：anchor 显著领先（top1 达标且领先 top2 >= 0.25）
{
  const r = alignRequirements(
    [b('B1', '流局由原庄连庄继续下一小局', '2.1')],
    [s('REQ-1', '完全不同的需求文本内容甲', '2.1'), s('REQ-2', '流局由原庄连庄，继续下一小局', '2.1')]
  )
  const m = r.matches[0]
  assert.equal(m.method, 'anchor')
  assert.equal(m.snapshotId, 'REQ-2')
}

// 场景 4：多候选无法区分（top1 与 top2 都达标且分差 < 0.25）→ 未匹配进人工清单
{
  const r = alignRequirements(
    [b('B1', '首局随机坐庄，赢家坐庄', '2.1')],
    [s('REQ-1', '首局随机坐庄，赢家坐庄连庄', '2.1'), s('REQ-2', '首局随机坐庄，赢家坐庄规则', '2.1')]
  )
  assert.equal(r.stats.unmatchedBaseline, 1)
  assert.match(r.unmatchedBaseline[0].reason, /无法区分/)
  assert.equal(r.stats.unmatchedSnapshot, 2)
}

// 场景 5：相似度不足（top1 < 0.6）→ 未匹配
{
  const r = alignRequirements(
    [b('B1', '白板财神算翻倍', '2.1')],
    [s('REQ-1', '断线重连后回到房间继续对局', '2.1')]
  )
  assert.equal(r.stats.unmatchedBaseline, 1)
  assert.match(r.unmatchedBaseline[0].reason, /相似度不足/)
}

// 场景 6：无同章节候选（章节不同且文本不同，exact 不命中）
{
  const r = alignRequirements(
    [b('B1', '任何文本内容甲甲', '一、总则')],
    [s('REQ-1', '完全不同的文本乙乙', '2.1')]
  )
  assert.equal(r.stats.unmatchedBaseline, 1)
  assert.match(r.unmatchedBaseline[0].reason, /无同章节候选/)
}

// 场景 7：文件按 basename 归一（绝对路径 vs 相对路径同文件）
{
  const r = alignRequirements(
    [b('B1', '庄家发牌十三张', '2.1', 'input/prd.md')],
    [s('REQ-1', '庄家发牌十三张', '2.1', 'E:/WorkProjects/PrdGameSkill/input/prd.md')]
  )
  assert.equal(r.stats.exactMatch, 1)
}

// 场景 8：快照条目被消耗后不复用（一_baseline 一快照）
{
  const r = alignRequirements(
    [b('B1', '同段文本', '2.1'), b('B2', '同段文本', '2.1')],
    [s('REQ-1', '同段文本', '2.1')]
  )
  assert.equal(r.stats.exactMatch, 1)
  assert.equal(r.stats.unmatchedBaseline, 1)
}

// 场景 9：空文本不参与 exact，anchor 相似度为 0
{
  const r = alignRequirements([b('B1', '', '2.1')], [s('REQ-1', '', '2.1')])
  assert.equal(r.stats.exactMatch, 0)
  assert.equal(r.stats.unmatchedBaseline, 1)
}

// 场景 10：对齐率统计与门槛判定（CLI）
{
  const root = '.opencode-workflows/scripts/tmp-align'
  fs.rmSync(root, { recursive: true, force: true })
  fs.mkdirSync(root, { recursive: true })
  const baseline = [b('B1', '文本甲甲甲'), b('B2', '文本乙乙乙'), b('B3', '文本丙丙丙'), b('B4', '文本丁丁丁'), b('B5', '文本戊戊戊')]
  const snapshot = [s('REQ-1', '文本甲甲甲', '2.1'), s('REQ-2', '文本乙乙乙', '2.2'), s('REQ-3', '完全不同', '9.9'), s('REQ-4', '文本戊戊戊', '2.5')]
  fs.writeFileSync(root + '/baseline.json', JSON.stringify({ requirements: baseline }, null, 1), 'utf8')
  fs.writeFileSync(root + '/snapshot.json', JSON.stringify(snapshot, null, 1), 'utf8')

  // 3/5 = 60% < 90% → 失败退出码 1
  let code = 0
  let out = ''
  try {
    execFileSync('node', ['.opencode-workflows/scripts/align-check.mjs', root + '/baseline.json', root + '/snapshot.json', root + '/out', '--min-rate', '0.9'])
  } catch (e) {
    code = e.status
    out = (e.stdout || '') + (e.stderr || '')
  }
  assert.equal(code, 1)
  assert.match(out, /\[失败\]/)
  assert.match(out, /对齐率 60\.0%/)
  const report = JSON.parse(fs.readFileSync(root + '/out/align-report.json', 'utf8'))
  assert.equal(report.stats.rate, 0.6)
  assert.equal(report.unmatchedBaseline.length, 2)
  assert.equal(report.unmatchedSnapshot.length, 1)
  const md = fs.readFileSync(root + '/out/align-report.md', 'utf8')
  assert.match(md, /未达标/)
  assert.match(md, /人工确认清单，2 条/)

  // 门槛降到 50% → 通过退出码 0
  const okOut = execFileSync('node', ['.opencode-workflows/scripts/align-check.mjs', root + '/baseline.json', root + '/snapshot.json', root + '/out2', '--min-rate', '0.5'], { encoding: 'utf8' })
  assert.match(okOut, /\[成功\]/)
  assert.match(okOut, /SUMMARY \{"ok":true/)
  fs.rmSync(root, { recursive: true, force: true })
}

console.log('[成功] align-check.example 全部断言通过（exact/anchor唯一/显著领先/多候选区分/相似度不足/无候选/basename归一/消耗不复用/空文本/门槛判定）')
