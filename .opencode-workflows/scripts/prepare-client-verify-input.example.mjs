// prepare-client-verify-input.example.mjs —— prepare-client-verify-input.mjs 自检（node 直接跑）
//
// 覆盖用例：
//   A. 全链正常：小基线（2 阶段 5 原子，unknown∧vr 3 条）+ 四件 -> 选取/分片/写盘/manifest
//      （active vr / conditional vr / unknown 非 vr 排除；gapNotes/existingSve 内嵌；-pc 命名）
//   B. 选取原子 scope 非 unknown -> fail
//   C. l7 stats 漂移 -> fail
//   D. 无证据缺口原子（选取为空）-> fail
//   E. CLI 成功与失败

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { prepareClientVerifyInput } from './prepare-client-verify-input.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(HERE, 'prepare-client-verify-input.mjs')
const TMP = path.join(process.cwd(), '.tmp-prepare-client-verify-input')

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

function fixture() {
  const atom = (id, diff) => ({ id, name: '原子' + id, rule: '规则' + id, ui_requirement: '', verdict: 'confirmed', difference: diff || 'unverified', difference_detail: '', notes: '' })
  writeJson(path.join(TMP, 'feature_index.json'), {
    schema_version: 2,
    atom_count: 5,
    difference_stats: { consistent: 0, partial: 0, conflict: 0, unverified: 5 },
    stages: [
      { id: 'ST-C10', name: '吃碰禁手' },
      { id: 'ST-C11', name: '出牌与响应' },
    ],
    features: [
      { stage_id: 'ST-C10', stage_name: '吃碰禁手', feature_id: 'F1', feature_name: '功能一', atoms: [atom('AT-ST-C10-016'), atom('AT-ST-C10-001')] },
      { stage_id: 'ST-C11', stage_name: '出牌与响应', feature_id: 'F2', feature_name: '功能二', atoms: [atom('AT-ST-C11-010'), atom('AT-ST-C11-012'), atom('AT-ST-C11-001')] },
    ],
  })
  const scopeE = (atomId, applicability, extra) => ({
    atomId, applicability, configVerified: true, callPathVerified: true,
    configCondition: '', callPath: '链 ' + atomId,
    evidenceIds: applicability === 'unknown' ? [] : ['SVE-' + atomId], unresolved: '', noServerEvidence: false, ...(extra || {}),
  })
  writeJson(path.join(TMP, 'scope-index.json'), {
    schemaVersion: 1, stats: { total: 5, active: 1, conditional: 1, unknown: 3, inactive: 0, client: 0 },
    entries: [
      scopeE('AT-ST-C10-016', 'unknown', { unresolved: '缺客户端实现证据' }),
      scopeE('AT-ST-C10-001', 'active'),
      scopeE('AT-ST-C11-010', 'unknown', { unresolved: '缺客户端实现证据' }),
      scopeE('AT-ST-C11-012', 'unknown', { unresolved: '缺客户端实现证据' }),
      scopeE('AT-ST-C11-001', 'conditional'),
    ],
  })
  const sve = (id, atomId) => ({ id, atomId, layer: 'common_game', file: 'common_game/f.cpp', location: 'common_game/f.cpp:1', symbol: 'S', excerpt: 'e', configKeys: [] })
  writeJson(path.join(TMP, 'server-evidence.json'), {
    schemaVersion: 1, stats: { total: 2 },
    entries: [sve('SVE-AT-ST-C10-001', 'AT-ST-C10-001'), sve('SVE-AT-ST-C11-001', 'AT-ST-C11-001')],
  })
  const drE = (atomId) => ({
    atomId, previousDifference: 'unverified', reviewedDifference: 'unverified',
    reviewReason: '证据缺口：服务端零实现（' + atomId + '）', reviewRule: '', scopeApplicability: 'unknown', scopeNote: '',
    evidenceIds: [], l7: 'verification_required', reviewStatus: 'pending', effectiveDifference: 'unverified', l7Basis: 'baseline',
  })
  writeJson(path.join(TMP, 'difference-review.json'), {
    schemaVersion: 1, stats: { total: 5 },
    entries: ['AT-ST-C10-016', 'AT-ST-C10-001', 'AT-ST-C11-010', 'AT-ST-C11-012', 'AT-ST-C11-001'].map(drE),
  })
  const l7E = (atomId, l7) => ({ atomId, stageId: atomId.slice(3, 9), l7, reviewStatus: 'pending', effectiveDifference: 'unverified' })
  writeJson(path.join(TMP, 'l7-classify.json'), {
    schemaVersion: 1, atomCount: 5, reviewedCount: 5,
    stats: { atomCount: 5, reviewedCount: 5, l7: { verified: 0, verification_required: 5, decision_required: 0, not_applicable: 0 } },
    entries: [
      l7E('AT-ST-C10-016', 'verification_required'),
      l7E('AT-ST-C10-001', 'verification_required'),
      l7E('AT-ST-C11-010', 'verification_required'),
      l7E('AT-ST-C11-012', 'verification_required'),
      l7E('AT-ST-C11-001', 'verification_required'),
    ],
  })
}

const viDir = () => path.join(TMP, 'runtime', 'verify-input')

// A. 全链正常（选取 unknown∧vr 3 条：C10-016 + C11-010/012；active/conditional 排除）
reset()
fixture()
let r = prepareClientVerifyInput({ featureIndexPath: path.join(TMP, 'feature_index.json'), outDir: TMP, date: '2026-11-14' })
check('A1 生成成功', r.ok && r.problems.length === 0)
check('A2 选取 3 原子（unknown∧vr）', r.ok && r.summary.atomCount === 3)
check('A3 manifest 按阶段 2 分片（-pc 命名）', r.ok &&
  JSON.stringify(r.summary.stages) === JSON.stringify([
    { stageId: 'ST-C10', partFiles: ['ST-C10-pc01.json'] },
    { stageId: 'ST-C11', partFiles: ['ST-C11-pc01.json'] },
  ]))
check('A4 分片文件存在', fs.existsSync(path.join(viDir(), 'ST-C10-pc01.json')) && fs.existsSync(path.join(viDir(), 'ST-C11-pc01.json')))
const doc10 = JSON.parse(fs.readFileSync(path.join(viDir(), 'ST-C10-pc01.json'), 'utf8'))
check('A5 分片含 gapNotes + existingScopeEntries + clientRoots', doc10.atomCount === 1 && doc10.client === true &&
  doc10.gapNotes['AT-ST-C10-016'].includes('证据缺口') && doc10.existingScopeEntries.length === 1 &&
  JSON.stringify(doc10.clientRoots) === JSON.stringify(['source-code/client/Code', 'source-code/client/Fgui']))
check('A6 分片内嵌原子事实', doc10.featureGroups[0].atoms[0].id === 'AT-ST-C10-016' && doc10.featureGroups[0].atoms[0].rule.includes('AT-ST-C10-016'))
const doc11 = JSON.parse(fs.readFileSync(path.join(viDir(), 'ST-C11-pc01.json'), 'utf8'))
check('A7 existingSve 为空（unknown 原子无证据）', doc11.existingSve.length === 0 && doc11.atomCount === 2)

// B. 选取原子 scope 非 unknown（篡改 scope）-> fail
reset()
fixture()
const siB = JSON.parse(fs.readFileSync(path.join(TMP, 'scope-index.json'), 'utf8'))
siB.entries.find((e) => e.atomId === 'AT-ST-C11-010').applicability = 'active'
writeJson(path.join(TMP, 'scope-index.json'), siB)
const rB = prepareClientVerifyInput({ featureIndexPath: path.join(TMP, 'feature_index.json'), outDir: TMP, date: '2026-11-14' })
check('B1 scope 变化后选取减为 2 仍成功（或交叉复核拦截）', rB.ok ? rB.summary.atomCount === 2 : rB.problems.length > 0)

// C. l7 stats 漂移 -> fail
reset()
fixture()
const l7p = path.join(TMP, 'l7-classify.json')
const l7doc = JSON.parse(fs.readFileSync(l7p, 'utf8'))
l7doc.stats.l7.verification_required = 9
writeJson(l7p, l7doc)
const rC = prepareClientVerifyInput({ featureIndexPath: path.join(TMP, 'feature_index.json'), outDir: TMP, date: '2026-11-14' })
check('C1 l7 stats 漂移 -> fail', !rC.ok && rC.problems.some((p) => p.includes('stats.l7')))

// D. 无证据缺口原子（全 active）-> fail
reset()
fixture()
const siD = JSON.parse(fs.readFileSync(path.join(TMP, 'scope-index.json'), 'utf8'))
for (const e of siD.entries) e.applicability = 'active'
siD.stats = { total: 5, active: 5, conditional: 0, unknown: 0, inactive: 0, client: 0 }
writeJson(path.join(TMP, 'scope-index.json'), siD)
const rD = prepareClientVerifyInput({ featureIndexPath: path.join(TMP, 'feature_index.json'), outDir: TMP, date: '2026-11-14' })
check('D1 选取为空 -> fail', !rD.ok && rD.problems.some((p) => p.includes('选取为空')))

// E. CLI 成功与失败
reset()
fixture()
const okOut = runCli([path.join(TMP, 'feature_index.json'), TMP, '2026-11-14'], true)
check('E1 CLI 成功 + MANIFEST', okOut.includes('[成功]') && okOut.includes('MANIFEST'))
check('E2 CLI 产物存在', fs.existsSync(path.join(viDir(), 'ST-C11-pc01.json')))
reset()
fixture()
fs.rmSync(path.join(TMP, 'l7-classify.json'))
const badOut = runCli([path.join(TMP, 'feature_index.json'), TMP, '2026-11-14'], false)
check('E3 CLI 缺 l7-classify 失败', badOut.includes('[失败]'))
const usageOut = runCli([], false)
check('E4 缺参用法提示', usageOut.includes('用法'))

fs.rmSync(TMP, { recursive: true, force: true })
console.log('')
if (fail === 0) {
  console.log('[全部通过] ' + pass + ' 项断言')
  process.exit(0)
} else {
  console.error('[存在失败] 通过 ' + pass + ' / 失败 ' + fail)
  process.exit(1)
}
