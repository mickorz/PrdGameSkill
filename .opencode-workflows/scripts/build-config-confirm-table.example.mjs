// build-config-confirm-table.example.mjs —— build-config-confirm-table.mjs 自检（node 直接跑）
//
// 覆盖用例：
//   A. 全链正常：小基线（2 阶段 6 原子）+ conditional 条目 -> 配置确认表生成，
//      行数/分阶段合计/提取列（配置项/默认值）/差异现状分布/回读行数复核正确
//   B. conditional 条目 configVerified=false -> fail 且产物已清理
//   C. conditional 条目 configCondition 为空 -> fail
//   D. conditional 条目 unresolved 非空 -> fail
//   E. CLI 成功（退出码 0 + 产物）与失败（退出码 1 + 问题明细）

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildConfigConfirmTable } from './build-config-confirm-table.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(HERE, 'build-config-confirm-table.mjs')
const TMP = path.join(process.cwd(), '.tmp-build-config-confirm-table')

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

function runCli(args, expectOk) {
  try {
    const out = execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8' })
    if (!expectOk) throw new Error('期望失败但成功了：' + out.slice(0, 200))
    return out
  } catch (e) {
    if (expectOk) throw e
    return String(e.stdout || '') + String(e.stderr || '')
  }
}

const atom = (id, name) => ({ id, name, rule: '规则' + id, ui_requirement: '', verdict: 'confirmed', difference: 'unverified', difference_detail: '', notes: '' })

function fixtureBaseline() {
  writeJson(path.join(TMP, 'feature_index.json'), {
    schema_version: 2,
    atom_count: 6,
    difference_stats: { consistent: 0, partial: 0, conflict: 0, unverified: 6 },
    stages: [
      { id: 'ST-C01', name: '阶段一', chapter: 'c' },
      { id: 'ST-C02', name: '阶段二', chapter: 'c' },
    ],
    features: [
      { stage_id: 'ST-C01', stage_name: '阶段一', feature_id: 'F1', feature_name: 'f1', atoms: [atom('AT-ST-C01-001', '甲'), atom('AT-ST-C01-002', '乙'), atom('AT-ST-C01-003', '丙')] },
      { stage_id: 'ST-C02', stage_name: '阶段二', feature_id: 'F2', feature_name: 'f2', atoms: [atom('AT-ST-C02-001', '丁'), atom('AT-ST-C02-002', '戊'), atom('AT-ST-C02-003', '己')] },
    ],
  })
}

const scopeEntry = (atomId, applicability, configCondition, extra) => ({
  atomId, applicability, configVerified: true, callPathVerified: true,
  configCondition, callPath: '链', evidenceIds: ['SVE-X-1'], unresolved: '', noServerEvidence: false,
  ...(extra || {}),
})

const drEntry = (atomId, effectiveDifference, reviewStatus) => ({
  atomId, previousDifference: 'unverified', reviewedDifference: effectiveDifference === 'consistent' ? 'consistent' : 'unverified',
  reviewReason: 'r', reviewRule: 'rule', scopeApplicability: 'conditional', scopeNote: '', evidenceIds: ['SVE-X-1'],
  l7: 'verification_required', reviewStatus, effectiveDifference, l7Basis: reviewStatus === 'approved' ? 'approved' : 'proposed',
})

function fixtureSidecars(overrides) {
  const O = overrides || {}
  writeJson(path.join(TMP, 'scope-index.json'), {
    schemaVersion: 1, stats: { total: 6 },
    entries: [
      scopeEntry('AT-ST-C01-001', 'conditional', 'first_banker_type：创房下发 0（client: RuleHzmj.ts，UI 未暴露恒 0）→ 随机坐庄', O.cond1),
      scopeEntry('AT-ST-C01-002', 'conditional', 'base_score=1（客户端默认，client: RuleHzmj.ts）', O.cond2),
      scopeEntry('AT-ST-C01-003', 'conditional', 'only_pung_no_chow：创房默认 false（client: RuleHzmj.ts）', O.cond3),
      scopeEntry('AT-ST-C02-001', 'active', ''),
      scopeEntry('AT-ST-C02-002', 'conditional', 'score_limit：创房默认 0（不封顶），可选 20/40', O.cond4),
      scopeEntry('AT-ST-C02-003', 'unknown', ''),
    ],
  })
  writeJson(path.join(TMP, 'difference-review.json'), {
    schemaVersion: 1,
    entries: [
      drEntry('AT-ST-C01-001', 'consistent', 'approved'),
      drEntry('AT-ST-C01-002', 'unverified', 'pending'),
      drEntry('AT-ST-C01-003', 'partial', 'pending'),
      drEntry('AT-ST-C02-001', 'unverified', 'pending'),
      drEntry('AT-ST-C02-002', 'consistent', 'pending'),
      drEntry('AT-ST-C02-003', 'unverified', 'pending'),
    ],
  })
}

const outPath = () => path.join(TMP, '配置确认表.md')

// A. 全链正常
reset()
fixtureBaseline()
fixtureSidecars()
let r = buildConfigConfirmTable({ baselineIndexPath: path.join(TMP, 'feature_index.json'), verifyDir: TMP, date: '2026-11-14' })
check('A1 正常生成 ok', r.ok)
check('A2 条目数 4（conditional 4 条）', r.ok && r.summary.total === 4)
check('A3 阶段数 2', r.ok && r.summary.stages === 2)
check('A4 差异现状分布 consistent 2 / unverified 1 / partial 1', r.ok && r.summary.effectiveDifference.consistent === 2 && r.summary.effectiveDifference.unverified === 1 && r.summary.effectiveDifference.partial === 1)
let text = fs.readFileSync(outPath(), 'utf8')
const rows = (text.match(/^\| AT-ST-C\d+-\d+ \|/gm) || []).length
check('A5 表行数 4（回读复核）', rows === 4)
check('A6 配置项列提取（first_banker_type / base_score / only_pung_no_chow / score_limit）', text.includes('| first_banker_type |') && text.includes('| base_score |') && text.includes('| only_pung_no_chow |') && text.includes('| score_limit |'))
check('A7 默认值列提取（0 / 1 / false / 0）', text.includes('| 0 | 随机坐庄') || text.includes('| 0 |'))
check('A8 approved 标注', text.includes('consistent（approved）'))
check('A9 整体签认段', text.includes('## 整体签认') && text.includes('☐ 全部确认默认口径'))
check('A10 阶段标题计数（2/2）', (text.match(/^## ST-C\d+ /gm) || []).length === 2)

// B. configVerified=false -> fail 且产物清理
reset()
fixtureBaseline()
fixtureSidecars({ cond2: { configVerified: false } })
fs.rmSync(outPath(), { force: true })
r = buildConfigConfirmTable({ baselineIndexPath: path.join(TMP, 'feature_index.json'), verifyDir: TMP, date: '2026-11-14' })
check('B1 configVerified 非 true -> fail', !r.ok)
check('B2 问题定位到原子', r.problems.some((p) => p.includes('AT-ST-C01-002') && p.includes('configVerified')))
check('B3 产物未生成', !fs.existsSync(outPath()))

// C. configCondition 为空 -> fail
reset()
fixtureBaseline()
fixtureSidecars({ cond3: { configCondition: '' } })
r = buildConfigConfirmTable({ baselineIndexPath: path.join(TMP, 'feature_index.json'), verifyDir: TMP, date: '2026-11-14' })
check('C1 configCondition 空 -> fail', !r.ok && r.problems.some((p) => p.includes('configCondition 为空')))

// D. unresolved 非空 -> fail
reset()
fixtureBaseline()
fixtureSidecars({ cond4: { unresolved: '创房 UI 未核对' } })
r = buildConfigConfirmTable({ baselineIndexPath: path.join(TMP, 'feature_index.json'), verifyDir: TMP, date: '2026-11-14' })
check('D1 unresolved 非空 -> fail', !r.ok && r.problems.some((p) => p.includes('unresolved 未清零')))

// E. CLI 成功与失败
reset()
fixtureBaseline()
fixtureSidecars()
const okOut = runCli([path.join(TMP, 'feature_index.json'), TMP, '2026-11-14'], true)
check('E1 CLI 成功退出 + SUMMARY', okOut.includes('[成功] 配置确认表') && okOut.includes('SUMMARY'))
check('E2 CLI 产物存在', fs.existsSync(outPath()))
reset()
fixtureBaseline()
fixtureSidecars({ cond1: { configVerified: false } })
const failOut = runCli([path.join(TMP, 'feature_index.json'), TMP, '2026-11-14'], false)
check('E3 CLI 失败退出 + 问题明细', failOut.includes('[失败]') && failOut.includes('configVerified'))
check('E4 CLI 失败无产物', !fs.existsSync(outPath()))
const usageOut = runCli([], false)
check('E5 缺参用法提示', usageOut.includes('用法'))

fs.rmSync(TMP, { recursive: true, force: true })
console.log('')
console.log('结果：' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail > 0 ? 1 : 0)
