// build-verify-reports.example.mjs —— build-verify-reports.mjs 自检（node 直接跑）
//
// 覆盖用例：
//   A. 全链正常：小基线（2 阶段 6 原子）+ 四件 -> 三产物生成，分类/行数/计数闸门正确
//      （l7 口径 = matrix(reviewedDifference, scope)：active+升级建议原子 l7=verified 不进报告；
//        conditional 建议原子与 conditional 无建议原子均进「配置确认」；
//        active 无建议保持 unverified 原子进「待补证」且说明走 callPath 兜底）
//   B. verification_required 条目数与 l7 stats 不符 -> fail 且产物已清理
//   C. SVE 原子不在基线 -> fail
//   D. CLI 成功（退出码 0 + 三产物）与失败（退出码 1 + 问题明细 + 无产物）

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildVerifyReports } from './build-verify-reports.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(HERE, 'build-verify-reports.mjs')
const TMP = path.join(process.cwd(), '.tmp-build-verify-reports')

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

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
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
  const atom = (id, name) => ({ id, name, rule: '规则' + id, ui_requirement: '', verdict: 'confirmed', difference: 'unverified', difference_detail: '', notes: '' })
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
  writeJson(path.join(TMP, 'scope-index.json'), {
    schemaVersion: 1, stats: { total: 6 },
    entries: [
      { atomId: 'AT-ST-C01-001', applicability: 'active', configVerified: true, callPathVerified: true, configCondition: '', callPath: '链 A1', evidenceIds: ['SVE-ST-C01-P01-01'], unresolved: '', noServerEvidence: false },
      { atomId: 'AT-ST-C01-002', applicability: 'conditional', configVerified: true, callPathVerified: true, configCondition: '配置 X 默认开', callPath: '链 A2', evidenceIds: [], unresolved: '', noServerEvidence: false },
      { atomId: 'AT-ST-C01-003', applicability: 'unknown', configVerified: false, callPathVerified: false, configCondition: '', callPath: '', evidenceIds: [], unresolved: '缺交互证据', noServerEvidence: true },
      { atomId: 'AT-ST-C02-001', applicability: 'active', configVerified: true, callPathVerified: true, configCondition: '', callPath: '链 B1', evidenceIds: [], unresolved: '', noServerEvidence: false },
      { atomId: 'AT-ST-C02-002', applicability: 'active', configVerified: true, callPathVerified: true, configCondition: '', callPath: '链 B2', evidenceIds: [], unresolved: '', noServerEvidence: false },
      { atomId: 'AT-ST-C02-003', applicability: 'active', configVerified: true, callPathVerified: true, configCondition: '', callPath: '链 B3', evidenceIds: ['SVE-ST-C02-P02-01', 'SVE-ST-C02-P02-02', 'SVE-ST-C02-P02-03'], unresolved: '', noServerEvidence: false },
    ],
  })
  const sve = (id, atomId, layer) => ({ id, atomId, layer, file: layer + '/f.cpp', location: layer + '/f.cpp:1', symbol: 'Sym' + id.slice(-2), excerpt: 'e', configKeys: layer === 'mah_frame' ? ['k1'] : [] })
  writeJson(path.join(TMP, 'server-evidence.json'), {
    schemaVersion: 1, stats: { total: 7 },
    entries: [
      sve('SVE-ST-C01-P01-01', 'AT-ST-C01-001', 'common_game'),
      sve('SVE-ST-C02-P01-01', 'AT-ST-C02-001', 'hzmj_server'),
      sve('SVE-ST-C02-P01-02', 'AT-ST-C02-001', 'hzmj_server'),
      sve('SVE-ST-C02-P01-03', 'AT-ST-C02-001', 'mah_frame'),
      sve('SVE-ST-C02-P02-01', 'AT-ST-C02-003', 'common_game'),
      sve('SVE-ST-C02-P02-02', 'AT-ST-C02-003', 'hzmj_server'),
      sve('SVE-ST-C02-P02-03', 'AT-ST-C02-003', 'mah_frame'),
    ],
  })
  writeJson(path.join(TMP, 'difference-review.json'), {
    schemaVersion: 1, stats: { total: 6, reviewStatus: { pending: 6, approved: 0, rejected: 0 } },
    entries: [
      { atomId: 'AT-ST-C01-001', previousDifference: 'unverified', reviewedDifference: 'consistent', reviewRule: 'evidence-is-not-consistency', reviewReason: '需求：甲。服务端：f.cpp:1 直证', reviewStatus: 'pending' },
      { atomId: 'AT-ST-C01-002', previousDifference: 'unverified', reviewedDifference: 'unverified', reviewRule: '', reviewReason: '本轮未出复核建议，维持基线差异', reviewStatus: 'pending' },
      { atomId: 'AT-ST-C01-003', previousDifference: 'unverified', reviewedDifference: 'unverified', reviewRule: '', reviewReason: '本轮未出复核建议，维持基线差异', reviewStatus: 'pending' },
      { atomId: 'AT-ST-C02-001', previousDifference: 'partial', reviewedDifference: 'consistent', reviewRule: 'evidence-is-not-consistency', reviewReason: '需求：丁。服务端：多证据直证', reviewStatus: 'pending' },
      { atomId: 'AT-ST-C02-002', previousDifference: 'conflict', reviewedDifference: 'conflict', reviewRule: 'ui-conflict-stands-alone', reviewReason: '冲突', reviewStatus: 'pending' },
      { atomId: 'AT-ST-C02-003', previousDifference: 'unverified', reviewedDifference: 'unverified', reviewRule: '', reviewReason: '本轮未出复核建议，维持基线差异', reviewStatus: 'pending' },
    ],
  })
  // l7 = matrix(reviewedDifference, scope)：active+建议 -> verified；conditional -> verification_required；
  // unknown -> verification_required；active 无建议 unverified -> verification_required；conflict -> decision_required
  const l7 = (atomId, l7) => ({ atomId, stageId: atomId.slice(3, 9), previousDifference: 'unverified', reviewedDifference: 'unverified', scopeApplicability: 'active', scopeSource: 'atom', l7, reviewStatus: 'pending', effectiveDifference: 'unverified', l7Basis: 'baseline', evidenceIds: [] })
  writeJson(path.join(TMP, 'l7-classify.json'), {
    schemaVersion: 1, atomCount: 6, reviewedCount: 6,
    stats: { atomCount: 6, reviewedCount: 6, unreviewedCount: 0, l7: { verified: 2, verification_required: 3, decision_required: 1, not_applicable: 0 }, l7Approved: { verified: 0, verification_required: 0, decision_required: 0, not_applicable: 0 }, effectiveDifference: { consistent: 0, partial: 1, conflict: 1, unverified: 4 }, reviewStatus: { pending: 6, approved: 0, rejected: 0 } },
    entries: [
      l7('AT-ST-C01-001', 'verified'),
      l7('AT-ST-C01-002', 'verification_required'),
      l7('AT-ST-C01-003', 'verification_required'),
      l7('AT-ST-C02-001', 'verified'),
      l7('AT-ST-C02-002', 'decision_required'),
      l7('AT-ST-C02-003', 'verification_required'),
    ],
  })
}

// ---------- 用例 A：全链正常 ----------

reset()
fixture()
const rA = buildVerifyReports({ baselineIndexPath: path.join(TMP, 'feature_index.json'), verifyDir: TMP, date: '2026-11-14' })
check('A1 生成成功', rA.ok === true && rA.problems.length === 0)
check('A2 分类正确（配置确认 1 / 证据缺口 1 / 待补证 1）', JSON.stringify(rA.summary.vrCategories) === JSON.stringify({ 证据缺口: 1, 配置确认: 1, 待补证: 1 }))
const vrText = fs.readFileSync(rA.summary.verificationReportPath, 'utf8')
check('A3 报告含分类概览与阶段表', vrText.includes('## 分类概览') && vrText.includes('## ST-C01 阶段一（2 条）') && vrText.includes('## ST-C02 阶段二（1 条）'))
check('A4 证据缺口说明取 unresolved', vrText.includes('缺交互证据'))
check('A5 配置确认说明取 configCondition', vrText.includes('配置 X 默认开'))
check('A6 待补证说明退回 callPath 兜底', vrText.includes('链 B3') && !vrText.includes('本轮未出复核建议'))
check('A7 证据列截前 2 + 计数', vrText.includes('SVE-ST-C02-P02-01 SVE-ST-C02-P02-02 +1'))
check('A8 交叉注记含 active 升级建议数', vrText.includes('2 条 active 作用域升级建议') && vrText.includes('0 条 conditional 作用域升级建议'))
const evText = fs.readFileSync(rA.summary.evidenceIndexPath, 'utf8')
check('A9 证据索引全量行 + 层统计', evText.includes('common_game 2') && evText.includes('hzmj_server 3') && evText.includes('mah_frame 2') && (evText.match(/\| SVE-/g) || []).length === 7)
const apText = fs.readFileSync(rA.summary.appendixPath, 'utf8')
check('A10 附录建议行 2 条（含 partial→consistent）', (apText.match(/\| AT-ST-C/g) || []).length === 2 && apText.includes('partial→consistent') && apText.includes('附 A：待批准升级建议全量（2 条'))

// ---------- 用例 B：stats 不符 fail 且清理 ----------

reset()
fixture()
const l7p = path.join(TMP, 'l7-classify.json')
const l7B = readJson(l7p)
l7B.stats.l7.verification_required = 4
writeJson(l7p, l7B)
const rB = buildVerifyReports({ baselineIndexPath: path.join(TMP, 'feature_index.json'), verifyDir: TMP, date: '2026-11-14' })
check(
  'B stats 不符 fail 且产物清理',
  rB.ok === false && rB.problems.some((p) => p.includes('verification_required 条目数')) &&
    !fs.existsSync(path.join(TMP, '规则待验证报告.md')) && !fs.existsSync(path.join(TMP, '服务端证据索引.md')) &&
    !fs.existsSync(path.join(TMP, 'runtime', 'reports', 'pending-suggestions-appendix.md'))
)

// ---------- 用例 C：SVE 原子不在基线 fail ----------

reset()
fixture()
const svep = path.join(TMP, 'server-evidence.json')
const sveC = readJson(svep)
sveC.entries.push({ id: 'SVE-ST-C02-P01-09', atomId: 'AT-ST-C99-001', layer: 'mah_frame', file: 'mah_frame/f.cpp', location: 'mah_frame/f.cpp:9', symbol: 'S', excerpt: 'e', configKeys: [] })
sveC.stats.total = 8
writeJson(svep, sveC)
const rC = buildVerifyReports({ baselineIndexPath: path.join(TMP, 'feature_index.json'), verifyDir: TMP, date: '2026-11-14' })
check('C SVE 原子不在基线 fail', rC.ok === false && rC.problems.some((p) => p.includes('SVE 原子不在基线')))

// ---------- 用例 D：CLI ----------

reset()
fixture()
const okOut = runCli([path.join(TMP, 'feature_index.json'), TMP, '2026-11-14'], true)
check('D1 CLI 成功输出统计', okOut.includes('[成功]') && okOut.includes('规则待验证 3') && fs.existsSync(path.join(TMP, '规则待验证报告.md')))
const okOut2 = runCli([path.join(TMP, 'feature_index.json'), TMP, '2026-11-14'], true)
check('D2 CLI 幂等重跑', okOut2.includes('[成功]'))
reset()
fixture()
const l7D = readJson(l7p)
l7D.stats.l7.verification_required = 99
writeJson(l7p, l7D)
const badOut = runCli([path.join(TMP, 'feature_index.json'), TMP, '2026-11-14'], false)
check('D3 CLI 失败退出码 1 + 明细 + 无产物', badOut.includes('[失败]') && badOut.includes('verification_required 条目数') && !fs.existsSync(path.join(TMP, '规则待验证报告.md')))

fs.rmSync(TMP, { recursive: true, force: true })

console.log('')
if (fail === 0) {
  console.log('[全部通过] ' + pass + ' 项断言')
  process.exit(0)
} else {
  console.error('[存在失败] 通过 ' + pass + ' / 失败 ' + fail)
  process.exit(1)
}
