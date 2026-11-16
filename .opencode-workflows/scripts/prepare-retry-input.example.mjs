// prepare-retry-input.example.mjs —— prepare-retry-input.mjs 自检（node 直接跑）
//
// 覆盖用例：
//   A. 全链正常：小基线（2 阶段 6 原子）+ 四件 + 原始 match 分片 -> 选取/分片/归档/写盘/manifest
//      （选取口径：active vr 全选 + conditional 签认非一致选 + closed/unknown/未签认排除）
//   B. 选取原子缺原始 match 条目 -> fail
//   C. 选取数交叉复核不符（l7 stats 篡改）-> fail
//   D. 幂等重跑：归档后重跑从 archive 读原件，产物一致
//   E. CLI 成功与失败

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { prepareRetryInput } from './prepare-retry-input.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(HERE, 'prepare-retry-input.mjs')
const TMP = path.join(process.cwd(), '.tmp-prepare-retry-input')

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

const atom = (id, name, diff) => ({ id, name, rule: '规则' + id, ui_requirement: '', verdict: 'confirmed', difference: diff || 'unverified', difference_detail: '', notes: '' })

function fixture() {
  writeJson(path.join(TMP, 'feature_index.json'), {
    schema_version: 2,
    atom_count: 6,
    stages: [
      { id: 'ST-C01', name: '阶段一', chapter: 'c' },
      { id: 'ST-C02', name: '阶段二', chapter: 'c' },
    ],
    features: [
      { stage_id: 'ST-C01', stage_name: '阶段一', feature_id: 'F1', feature_name: '功能一', atoms: [atom('AT-ST-C01-001', '甲'), atom('AT-ST-C01-002', '乙'), atom('AT-ST-C01-003', '丙')] },
      { stage_id: 'ST-C02', stage_name: '阶段二', feature_id: 'F2', feature_name: '功能二', atoms: [atom('AT-ST-C02-001', '丁'), atom('AT-ST-C02-002', '戊', 'consistent'), atom('AT-ST-C02-003', '己')] },
    ],
  })
  const scopeE = (atomId, applicability, extra) => ({
    atomId, applicability, configVerified: true, callPathVerified: true,
    configCondition: applicability === 'conditional' ? 'cfg_k：创房默认 0' : '', callPath: '链 ' + atomId,
    evidenceIds: ['SVE-' + atomId], unresolved: '', noServerEvidence: false, ...(extra || {}),
  })
  writeJson(path.join(TMP, 'scope-index.json'), {
    schemaVersion: 1, stats: { total: 6 },
    entries: [
      scopeE('AT-ST-C01-001', 'active'),
      scopeE('AT-ST-C01-002', 'conditional', { configConfirm: 'default', configConfirmDate: '2026-11-14' }),
      scopeE('AT-ST-C01-003', 'unknown'),
      scopeE('AT-ST-C02-001', 'conditional', { configConfirm: 'default', configConfirmDate: '2026-11-14' }),
      scopeE('AT-ST-C02-002', 'conditional', { configConfirm: 'default', configConfirmDate: '2026-11-14' }),
      scopeE('AT-ST-C02-003', 'active'),
    ],
  })
  const sve = (id, atomId) => ({ id, atomId, layer: 'hzmj_server', file: 'hzmj_server/f.cpp', location: 'hzmj_server/f.cpp:1', symbol: 'S', excerpt: 'e', configKeys: [] })
  writeJson(path.join(TMP, 'server-evidence.json'), {
    schemaVersion: 1, stats: { total: 6 },
    entries: [
      sve('SVE-AT-ST-C01-001', 'AT-ST-C01-001'), sve('SVE-AT-ST-C01-002', 'AT-ST-C01-002'),
      sve('SVE-AT-ST-C01-003', 'AT-ST-C01-003'), sve('SVE-AT-ST-C02-001', 'AT-ST-C02-001'),
      sve('SVE-AT-ST-C02-002', 'AT-ST-C02-002'), sve('SVE-AT-ST-C02-003', 'AT-ST-C02-003'),
    ],
  })
  const drE = (atomId, eff) => ({
    atomId, previousDifference: 'unverified', reviewedDifference: eff === 'consistent' ? 'consistent' : 'unverified',
    reviewReason: '第一轮：' + atomId, reviewRule: '', scopeApplicability: 'active', scopeNote: '',
    evidenceIds: ['SVE-' + atomId], l7: 'verification_required', reviewStatus: 'pending',
    effectiveDifference: eff, l7Basis: 'baseline',
  })
  writeJson(path.join(TMP, 'difference-review.json'), {
    schemaVersion: 1, stats: { total: 6 },
    entries: [
      drE('AT-ST-C01-001', 'unverified'), drE('AT-ST-C01-002', 'unverified'), drE('AT-ST-C01-003', 'unverified'),
      drE('AT-ST-C02-001', 'unverified'), drE('AT-ST-C02-002', 'consistent'), drE('AT-ST-C02-003', 'partial'),
    ],
  })
  const l7E = (atomId, l7) => ({ atomId, l7, reviewStatus: 'pending', effectiveDifference: 'unverified' })
  writeJson(path.join(TMP, 'l7-classify.json'), {
    schemaVersion: 1, atomCount: 6, reviewedCount: 6,
    stats: { atomCount: 6, reviewedCount: 6, l7: { verified: 0, verification_required: 5, decision_required: 1, not_applicable: 0 } },
    entries: [
      l7E('AT-ST-C01-001', 'verification_required'), l7E('AT-ST-C01-002', 'verification_required'),
      l7E('AT-ST-C01-003', 'verification_required'), l7E('AT-ST-C02-001', 'verification_required'),
      l7E('AT-ST-C02-002', 'verification_required'), l7E('AT-ST-C02-003', 'decision_required'),
    ],
  })
  // 原始 match 分片（全覆盖 6 原子）
  const matchE = (atomId) => ({ atomId, conclusion: 'matched', queries: [{ term: 't', hits: 1 }], matches: [{ file: 'game_hzmj/hzmj_server/f.cpp', line: 1, symbol: 'S', kind: 'method', relevant: true, note: 'n' }], configKeys: [] })
  writeJson(path.join(TMP, 'runtime', 'match-output', 'ST-C01-p01.json'), {
    schemaVersion: 1, stageId: 'ST-C01', partNo: '01',
    entries: [matchE('AT-ST-C01-001'), matchE('AT-ST-C01-002'), matchE('AT-ST-C01-003')],
  })
  writeJson(path.join(TMP, 'runtime', 'match-output', 'ST-C02-p01.json'), {
    schemaVersion: 1, stageId: 'ST-C02', partNo: '01',
    entries: [matchE('AT-ST-C02-001'), matchE('AT-ST-C02-002'), matchE('AT-ST-C02-003')],
  })
  // 原始 verify-input（待归档标记物）
  writeJson(path.join(TMP, 'runtime', 'verify-input', 'ST-C01-p01.json'), { schemaVersion: 1, stageId: 'ST-C01', partNo: '01', atomCount: 3 })
  writeJson(path.join(TMP, 'runtime', 'verify-output', 'ST-C01-p01.json'), { schemaVersion: 1, stageId: 'ST-C01', partNo: '01', entries: [] })
}

const viDir = () => path.join(TMP, 'runtime', 'verify-input')
const moDir = () => path.join(TMP, 'runtime', 'match-output')
const archiveDir = () => path.join(TMP, 'runtime', 'archive', 'pre-s7-retry')

// A. 全链正常（选取：C01-001 active vr + C01-002 conditional 签认非一致 + C02-001 同类；排除 unknown C01-003 / closed C02-002 / decision C02-003）
reset()
fixture()
let r = prepareRetryInput({ featureIndexPath: path.join(TMP, 'feature_index.json'), outDir: TMP, date: '2026-11-14' })
check('A1 生成成功', r.ok && r.problems.length === 0)
check('A2 选取 3 原子（active vr 2 + conditional 签认非一致 1）', r.ok && r.summary.atomCount === 3)
check('A3 交叉复核口径（vr 5 - unknown 1 - closed 1 = 3）', r.ok)
check('A4 manifest 分片结构', r.ok && r.summary.partCount === 2 && r.summary.stages.length === 2 &&
  JSON.stringify(r.summary.stages[0].partFiles) === JSON.stringify(['ST-C01-r01.json']) &&
  JSON.stringify(r.summary.stages[1].partFiles) === JSON.stringify(['ST-C02-r01.json']))
check('A5 原分片已归档', fs.existsSync(path.join(archiveDir(), 'verify-input', 'ST-C01-p01.json')) && fs.existsSync(path.join(archiveDir(), 'match-output', 'ST-C01-p01.json')))
const viDoc = JSON.parse(fs.readFileSync(path.join(viDir(), 'ST-C01-r01.json'), 'utf8'))
check('A6 retry 分片含 retryHint + existing', viDoc.atomCount === 2 && viDoc.retry.reason.includes('待补证第二轮') &&
  viDoc.featureGroups[0].atoms.every((a) => a.retryHint && a.retryHint.callPath) &&
  viDoc.existingScopeEntries.length === 2 && viDoc.existingSve.length === 2)
check('A7 conditional 原子 retryHint 带 configCondition', viDoc.featureGroups[0].atoms.find((a) => a.id === 'AT-ST-C01-002').retryHint.configCondition.includes('cfg_k'))
const moDoc = JSON.parse(fs.readFileSync(path.join(moDir(), 'ST-C01-r01.json'), 'utf8'))
check('A8 match 分片过滤（2 条目带候选）', moDoc.entries.length === 2 && moDoc.entries[0].matches.length === 1)

// B. 选取原子缺原始 match 条目 -> fail
reset()
fixture()
fs.rmSync(path.join(TMP, 'runtime', 'match-output', 'ST-C01-p01.json'))
const rB = prepareRetryInput({ featureIndexPath: path.join(TMP, 'feature_index.json'), outDir: TMP, date: '2026-11-14' })
check('B1 缺 match 条目 fail', !rB.ok && rB.problems.some((p) => p.includes('缺原始 match 条目：AT-ST-C01-001')))

// C. l7 stats 与 entries 漂移 -> fail（独立交叉闸门）
reset()
fixture()
const l7p = path.join(TMP, 'l7-classify.json')
const l7doc = JSON.parse(fs.readFileSync(l7p, 'utf8'))
l7doc.stats.l7.verification_required = 9
writeJson(l7p, l7doc)
const rC = prepareRetryInput({ featureIndexPath: path.join(TMP, 'feature_index.json'), outDir: TMP, date: '2026-11-14' })
check('C1 l7 stats 漂移 -> fail', !rC.ok && rC.problems.some((p) => p.includes('stats.l7')))

// D. 幂等重跑：归档后重跑从 archive 读原件，产物一致
reset()
fixture()
r = prepareRetryInput({ featureIndexPath: path.join(TMP, 'feature_index.json'), outDir: TMP, date: '2026-11-14' })
const rD = prepareRetryInput({ featureIndexPath: path.join(TMP, 'feature_index.json'), outDir: TMP, date: '2026-11-14' })
check('D1 幂等重跑成功且 manifest 一致', rD.ok && rD.summary.atomCount === r.summary.atomCount && rD.summary.partCount === r.summary.partCount)
check('D2 幂等重跑不重复归档（archive 无嵌套）', !fs.existsSync(path.join(archiveDir(), 'archive')))

// E. CLI 成功与失败
reset()
fixture()
const okOut = runCli([path.join(TMP, 'feature_index.json'), TMP, '2026-11-14'], true)
check('E1 CLI 成功 + MANIFEST', okOut.includes('[成功]') && okOut.includes('MANIFEST'))
check('E2 CLI 产物存在', fs.existsSync(path.join(viDir(), 'ST-C01-r01.json')))
reset()
fixture()
fs.rmSync(path.join(TMP, 'runtime', 'match-output'), { recursive: true, force: true })
const badOut = runCli([path.join(TMP, 'feature_index.json'), TMP, '2026-11-14'], false)
check('E3 CLI 失败退出 + 明细', badOut.includes('[失败]') && badOut.includes('match-output'))
const usageOut = runCli([], false)
check('E4 缺参用法提示', usageOut.includes('用法'))

// F. 第三轮（S9）：原件已归档在历史 tag + 陈旧 -r/-pc 代际分片清理 + -r2 命名
reset()
fixture()
r = prepareRetryInput({ featureIndexPath: path.join(TMP, 'feature_index.json'), outDir: TMP, date: '2026-11-14' })
check('F1 前置：第二轮归档完成', r.ok && fs.existsSync(path.join(archiveDir(), 'match-output', 'ST-C01-p01.json')))
// 模拟 S8 客户端代际分片（-pc）残留在四目录
for (const d of ['verify-input', 'match-output', 'verify-output', 'review-output']) {
  writeJson(path.join(TMP, 'runtime', d, 'ST-C10-pc01.json'), { schemaVersion: 1, stageId: 'ST-C10', partNo: '01', entries: [] })
}
const rF = prepareRetryInput({ featureIndexPath: path.join(TMP, 'feature_index.json'), outDir: TMP, date: '2026-11-14', round: 3 })
check('F2 第三轮成功且选取一致', rF.ok && rF.summary.atomCount === 3 && rF.summary.partCount === 2)
check('F3 陈旧 -r/-pc 分片已清理（四目录仅余原件与本代 -r2 分片）', ['verify-input', 'match-output', 'verify-output', 'review-output'].every((d) => {
  const files = fs.readdirSync(path.join(TMP, 'runtime', d)).filter((f) =>
    f.endsWith('.json') && !/-p\d+\.json$/.test(f) && !/-r2\d+\.json$/.test(f))
  return files.length === 0
}))
check('F4 新分片 -r2 命名 + manifest', rF.ok &&
  JSON.stringify(rF.summary.stages[0].partFiles) === JSON.stringify(['ST-C01-r201.json']) &&
  fs.existsSync(path.join(viDir(), 'ST-C01-r201.json')) && fs.existsSync(path.join(moDir(), 'ST-C01-r201.json')))
check('F5 原件未再归档（无 pre-s9-retry 目录）', !fs.existsSync(path.join(TMP, 'runtime', 'archive', 'pre-s9-retry')))
const viDocF = JSON.parse(fs.readFileSync(path.join(viDir(), 'ST-C01-r201.json'), 'utf8'))
const moDocF = JSON.parse(fs.readFileSync(path.join(moDir(), 'ST-C01-r201.json'), 'utf8'))
check('F6 match 原件从历史 archive 读取（2 条带候选）', moDocF.entries.length === 2 && moDocF.entries[0].matches.length === 1)
check('F7 retryHint 第三轮口径', viDocF.retry.reason.includes('待补证第三轮') &&
  viDocF.featureGroups[0].atoms[0].retryHint.reason.includes('前两轮证据不足') &&
  viDocF.generatedBy.includes('S9'))
const rBad = prepareRetryInput({ featureIndexPath: path.join(TMP, 'feature_index.json'), outDir: TMP, date: '2026-11-14', round: 1 })
check('F8 round 非法（<2）-> fail', !rBad.ok && rBad.problems.some((p) => p.includes('round 非法')))

fs.rmSync(TMP, { recursive: true, force: true })
console.log('')
if (fail === 0) {
  console.log('[全部通过] ' + pass + ' 项断言')
  process.exit(0)
} else {
  console.error('[存在失败] 通过 ' + pass + ' / 失败 ' + fail)
  process.exit(1)
}
