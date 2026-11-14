// prepare-verify-atoms.example.mjs —— prepare-verify-atoms.mjs 自检（node 直接跑）
//
// 覆盖用例：
//   1. 基础生成 + CSV 阶段过滤（目标阶段生成分片，非目标不生成）
//   2. 原子字段精简（notes 超 400 字符截断；client_logic/evidence 等技术字段不进分片）
//   3. 既有正式条目注入（existingScopeEntries/existingSve）；*_sample.json 不读（不注入样本条目）
//   4. 分片贪心（不拆散功能点）：4+6+5 -> 两片 [10,5]；大功能点独立成片
//   5. ALL 全阶段生成
//   6. 旧分片清理（目标阶段旧分片删除，非目标阶段保留）
//   7. 失败路径：阶段不存在 / feature_index 缺失 / 阶段无原子
//   8. CLI 成功与失败路径（退出码 0/1）

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { prepareVerifyAtoms } from './prepare-verify-atoms.mjs'

const SCRIPT = fileURLToPath(import.meta.url).replace(/\.example\.mjs$/, '.mjs')
const TMP = path.join(process.cwd(), '.tmp-prepare-verify-atoms')

let pass = 0
let fail = 0
function check(name, cond) {
  if (cond) {
    pass++
    console.log('[通过] ' + name)
  } else {
    fail++
    console.error('[失败] ' + name)
  }
}

function reset() {
  fs.rmSync(TMP, { recursive: true, force: true })
  fs.mkdirSync(TMP, { recursive: true })
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(obj, null, 1), 'utf8')
}

function atom(id, stage, opts = {}) {
  return Object.assign(
    {
      id: id, name: '原子' + id, rule: '规则' + id + '。', ui_requirement: 'UI' + id,
      owner: 'client', verdict: 'confirmed', client_logic: '客户端逻辑' + id,
      ui_interaction: '交互' + id, messages: ['Msg' + id],
      evidence: [{ file: 'a.ts', location: 'a.ts:1' }], notes: '',
      difference: 'consistent', difference_detail: '', verification: { business_rule_verified: false },
      schema_marked: true,
    },
    opts
  )
}

function featureIndex() {
  return {
    schema_version: 2,
    atom_count: 12,
    difference_stats: { consistent: 12, partial: 0, conflict: 0, unverified: 0 },
    stages: [{ id: 'ST-C01', name: '定庄' }, { id: 'ST-C02', name: '牌墙' }],
    features: [
      {
        id: 'FP-1', stage_id: 'ST-C01', stage_name: '定庄', name: '首局定庄', scope: '开局定庄链路',
        atoms: [atom('AT-ST-C01-001'), atom('AT-ST-C01-002')],
      },
      {
        id: 'FP-2', stage_id: 'ST-C01', stage_name: '定庄', name: '轮庄', scope: '',
        atoms: [atom('AT-ST-C01-003'), atom('AT-ST-C01-004')],
      },
      {
        id: 'FP-3', stage_id: 'ST-C02', stage_name: '牌墙', name: '洗牌发牌', scope: '',
        atoms: [atom('AT-ST-C02-001'), atom('AT-ST-C02-002')],
      },
    ],
  }
}

// ---------- 用例 1/2/3：基础生成 + 字段精简 + 既有注入 ----------
{
  reset()
  const src = path.join(TMP, 'feature_index.json')
  const outDir = path.join(TMP, 'out')
  const longNotes = '长'.repeat(500)
  const fi = featureIndex()
  fi.features[0].atoms[0].notes = longNotes
  writeJson(src, fi)
  // 既有正式条目（仅 ST-C01-001）+ 人工样本条目（不应被读）
  writeJson(path.join(outDir, 'scope-index.json'), {
    schemaVersion: 1, stats: { active: 1, conditional: 0, unknown: 0, inactive: 0 },
    entries: [{ atomId: 'AT-ST-C01-001', applicability: 'active' }],
  })
  writeJson(path.join(outDir, 'server-evidence.json'), {
    schemaVersion: 1, sourceRepos: [], entries: [
      { id: 'SVE-ST-C01-001', atomId: 'AT-ST-C01-001', layer: 'common_game', file: 'common_game/a.cpp', location: 'common_game/a.cpp:10', symbol: 'Foo', excerpt: 'x', configKeys: [] },
    ],
  })
  writeJson(path.join(outDir, 'scope-index_sample.json'), {
    entries: [{ atomId: 'AT-ST-C99-999', applicability: 'inactive' }],
  })

  const r = prepareVerifyAtoms({ featureIndexPath: src, outDir: outDir, stageIds: 'ST-C01', date: '2026-11-14' })
  check('用例1 生成成功（1 阶段 1 片）', r.ok && r.manifest.stages.length === 1 && r.manifest.stages[0].partCount === 1)
  check('用例1 manifest 计数', r.manifest.totalAtomCount === 4 && r.manifest.stages[0].atomCount === 4)
  const partPath = path.join(outDir, 'runtime', 'verify-input', 'ST-C01-p01.json')
  check('用例1 分片文件存在', fs.existsSync(partPath))
  check('用例1 非目标阶段不生成', !fs.existsSync(path.join(outDir, 'runtime', 'verify-input', 'ST-C02-p01.json')))
  const part = JSON.parse(fs.readFileSync(partPath, 'utf8'))
  check('用例2 notes 截断（>400 字符）', part.featureGroups[0].atoms[0].notes.length < 420 && part.featureGroups[0].atoms[0].notes.includes('截断'))
  check('用例2 技术字段不进分片', part.featureGroups[0].atoms[0].client_logic === undefined && part.featureGroups[0].atoms[0].evidence === undefined && part.featureGroups[0].atoms[0].messages === undefined)
  check('用例2 difference/difference_detail 保留', part.featureGroups[0].atoms[0].difference === 'consistent' && 'difference_detail' in part.featureGroups[0].atoms[0])
  check('用例3 既有 scope 条目注入', part.existingScopeEntries.length === 1 && part.existingScopeEntries[0].atomId === 'AT-ST-C01-001')
  check('用例3 既有 SVE 注入', part.existingSve.length === 1 && part.existingSve[0].id === 'SVE-ST-C01-001')
  check('用例3 *_sample.json 不读（样本专属原子不注入）', !JSON.stringify(part).includes('AT-ST-C99-999'))
}

// ---------- 用例 4：分片贪心（不拆散功能点） ----------
{
  reset()
  const src = path.join(TMP, 'fi-greedy.json')
  const outDir = path.join(TMP, 'out-greedy')
  const fi = {
    stages: [{ id: 'ST-C09', name: '行牌' }],
    features: [
      { id: 'FP-A', stage_id: 'ST-C09', name: 'A', atoms: [1, 2, 3, 4].map((i) => atom('AT-ST-C09-00' + i)) },
      { id: 'FP-B', stage_id: 'ST-C09', name: 'B', atoms: [1, 2, 3, 4, 5, 6].map((i) => atom('AT-ST-C09-01' + i)) },
      { id: 'FP-C', stage_id: 'ST-C09', name: 'C', atoms: [1, 2, 3, 4, 5].map((i) => atom('AT-ST-C09-02' + i)) },
      { id: 'FP-BIG', stage_id: 'ST-C09', name: 'BIG', atoms: Array.from({ length: 20 }, (_, i) => atom('AT-ST-C09-03' + String(i).padStart(2, '0'))) },
    ],
  }
  writeJson(src, fi)
  const r = prepareVerifyAtoms({ featureIndexPath: src, outDir: outDir, stageIds: 'ST-C09', date: '2026-11-14' })
  check('用例4 生成成功', r.ok)
  const s = r.manifest.stages[0]
  check('用例4 分片数（4+6 / 5 / 20 独立）', s.partCount === 3)
  const p1 = JSON.parse(fs.readFileSync(path.join(outDir, 'runtime', 'verify-input', 'ST-C09-p01.json'), 'utf8'))
  const p2 = JSON.parse(fs.readFileSync(path.join(outDir, 'runtime', 'verify-input', 'ST-C09-p02.json'), 'utf8'))
  const p3 = JSON.parse(fs.readFileSync(path.join(outDir, 'runtime', 'verify-input', 'ST-C09-p03.json'), 'utf8'))
  check('用例4 p01 = A+B（10 原子 2 功能点）', p1.atomCount === 10 && p1.featureGroups.length === 2)
  check('用例4 p02 = C（5 原子）', p2.atomCount === 5 && p2.featureGroups.length === 1)
  check('用例4 p03 = BIG 独立成片（20 原子）', p3.atomCount === 20 && p3.featureGroups.length === 1)
}

// ---------- 用例 5/6：ALL 全阶段 + 旧分片清理 ----------
{
  reset()
  const src = path.join(TMP, 'feature_index.json')
  const outDir = path.join(TMP, 'out')
  writeJson(src, featureIndex())
  // 预置旧分片：ST-C01 旧 3 片（stale）+ ST-C02 旧 1 片（非目标，应保留）
  const vi = path.join(outDir, 'runtime', 'verify-input')
  for (const f of ['ST-C01-p01.json', 'ST-C01-p02.json', 'ST-C01-p03.json', 'ST-C02-p01.json']) {
    writeJson(path.join(vi, f), { stale: true })
  }
  const r = prepareVerifyAtoms({ featureIndexPath: src, outDir: outDir, stageIds: 'ST-C01', date: '2026-11-14' })
  check('用例5/6 生成成功', r.ok)
  check('用例5 ALL 之外的 CSV 只生成目标阶段', r.manifest.stages.length === 1 && r.manifest.stages[0].stageId === 'ST-C01')
  check('用例6 目标阶段旧分片清理（p02/p03 删除）', !fs.existsSync(path.join(vi, 'ST-C01-p02.json')) && !fs.existsSync(path.join(vi, 'ST-C01-p03.json')))
  check('用例6 非目标阶段分片保留', fs.existsSync(path.join(vi, 'ST-C02-p01.json')))

  const rAll = prepareVerifyAtoms({ featureIndexPath: src, outDir: outDir, stageIds: 'ALL', date: '2026-11-14' })
  check('用例5 ALL 全阶段生成（2 阶段）', rAll.ok && rAll.manifest.stages.length === 2 && rAll.manifest.totalAtomCount === 6)
  const staleP = JSON.parse(fs.readFileSync(path.join(vi, 'ST-C02-p01.json'), 'utf8'))
  check('用例5 ALL 后旧分片被新分片替换（stale 清除）', staleP.stale === undefined && staleP.stageId === 'ST-C02' && staleP.atomCount === 2)
  check('用例5 ALL 各阶段分片就位', fs.existsSync(path.join(vi, 'ST-C02-p01.json')) && fs.existsSync(path.join(vi, 'ST-C01-p01.json')))
}

// ---------- 用例 7：失败路径 ----------
{
  reset()
  const src = path.join(TMP, 'feature_index.json')
  const outDir = path.join(TMP, 'out-fail')
  writeJson(src, featureIndex())

  const r1 = prepareVerifyAtoms({ featureIndexPath: src, outDir: outDir, stageIds: 'ST-C99', date: '2026-11-14' })
  check('用例7 阶段不存在 fail', !r1.ok && r1.problems.some((p) => p.includes('ST-C99')))

  const r2 = prepareVerifyAtoms({ featureIndexPath: path.join(TMP, 'missing.json'), outDir: outDir, stageIds: 'ALL', date: '2026-11-14' })
  check('用例7 feature_index 缺失 fail', !r2.ok && r2.problems.length > 0)

  const fiEmpty = { stages: [{ id: 'ST-C03', name: '空' }], features: [{ id: 'FP-E', stage_id: 'ST-C03', name: '空', atoms: [] }] }
  writeJson(path.join(TMP, 'fi-empty.json'), fiEmpty)
  const r3 = prepareVerifyAtoms({ featureIndexPath: path.join(TMP, 'fi-empty.json'), outDir: outDir, stageIds: 'ALL', date: '2026-11-14' })
  check('用例7 阶段无原子 fail', !r3.ok && r3.problems.some((p) => p.includes('阶段无原子')))
}

// ---------- 用例 8：CLI 成功与失败路径 ----------
{
  reset()
  const src = path.join(TMP, 'feature_index.json')
  const outDir = path.join(TMP, 'out-cli')
  writeJson(src, featureIndex())
  const okOut = execFileSync('node', [SCRIPT, src, outDir, 'ST-C01', '2026-11-14'], { encoding: 'utf8' })
  check('用例8 CLI 成功退出 + 产物就位', okOut.includes('[成功]') && fs.existsSync(path.join(outDir, 'runtime', 'verify-input', 'manifest.json')))

  let failed = false
  try {
    execFileSync('node', [SCRIPT, src, outDir, 'ST-C99', '2026-11-14'], { encoding: 'utf8', stdio: 'pipe' })
  } catch (e) {
    failed = true
    check('用例8 CLI 失败退出码非 0 + 报错信息', e.status !== 0 && String(e.stderr).includes('ST-C99'))
  }
  check('用例8 CLI 失败确实抛出', failed)

  let badArgs = false
  try {
    execFileSync('node', [SCRIPT, src], { encoding: 'utf8', stdio: 'pipe' })
  } catch (e) {
    badArgs = true
    check('用例8 CLI 缺参用法提示', e.status !== 0 && String(e.stderr).includes('用法'))
  }
  check('用例8 CLI 缺参确实抛出', badArgs)
}

// ---------- 收尾 ----------
fs.rmSync(TMP, { recursive: true, force: true })
if (fail > 0) {
  console.error('[失败] prepare-verify-atoms.example：' + pass + ' 通过 / ' + fail + ' 失败')
  process.exit(1)
}
console.log('[成功] prepare-verify-atoms.example 全部断言通过（' + pass + ' 项：基础生成/阶段过滤/字段精简/既有注入不读样本/分片贪心/ALL/旧分片清理/失败路径/CLI）')
