// recount-verify-parts.example.mjs —— recount-verify-parts.mjs 自检（node 直接跑）
//
// 覆盖用例：
//   A. 正常重算：两分片全覆盖 + 枚举合法 -> ok，四类分布/sveCount 正确，recount 落盘
//   B. 期望原子缺落判条目 -> fail（覆盖闸门）
//   C. 混入外来原子 -> fail
//   D. atomId 重复 -> fail
//   E. applicability 非法枚举 -> fail
//   F. 落判分片缺失/不可读 -> fail
//   G. 准备输入 atomCount 与 featureGroups 不符 -> fail
//   H. CLI 成功（退出码 0 + recount 落盘）与失败（退出码 1 + 问题明细 + 不写 recount）

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { recountVerifyParts } from './recount-verify-parts.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(HERE, 'recount-verify-parts.mjs')
const TMP = path.join(process.cwd(), '.tmp-recount-verify-parts')

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
  fs.mkdirSync(path.join(TMP, 'runtime', 'verify-input'), { recursive: true })
  fs.mkdirSync(path.join(TMP, 'runtime', 'verify-output'), { recursive: true })
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

// ---------- 夹具 ----------

function inputPart(stageId, partNo, atomIds) {
  return {
    schemaVersion: 1,
    generatedBy: 'prepare-verify-atoms.mjs',
    date: '2026-11-14',
    stageId,
    stageName: '阶段' + stageId,
    partNo,
    partCount: 1,
    atomCount: atomIds.length,
    featureGroups: [
      {
        featureId: 'F-' + stageId,
        featureName: '特性' + stageId,
        featureScope: 'scope',
        atoms: atomIds.map((id) => ({
          id: id, name: '原子' + id, rule: '规则' + id + '。', ui_requirement: '',
          verdict: 'confirmed', difference: 'unverified', difference_detail: '', notes: '',
        })),
      },
    ],
    existingScopeEntries: [],
    existingSve: [],
  }
}

function entry(atomId, applicability, sveCount) {
  const sve = []
  for (let i = 0; i < (sveCount || 0); i++) {
    sve.push({ id: 'SVE-' + atomId + '-' + (i + 1), atomId, layer: 'mah_frame', file: 'mah_frame/f.cpp', location: 'mah_frame/f.cpp:1', symbol: 's', excerpt: 'e', configKeys: [] })
  }
  return {
    atomId, applicability, configVerified: true, callPathVerified: true,
    configCondition: '', callPath: 'c', evidenceIds: sve.map((s) => s.id),
    unresolved: '', noServerEvidence: false, dr: { scopeApplicability: applicability, scopeNote: 'n' },
    sve,
  }
}

function outputPart(stageId, partNo, entries) {
  return { schemaVersion: 1, stageId, partNo, entries }
}

// ---------- 用例 A：正常重算 ----------

reset()
const partFilesA = [
  { stageId: 'ST-CA', file: 'ST-CA-p01.json' },
  { stageId: 'ST-CA', file: 'ST-CA-p02.json' },
]
writeJson(path.join(TMP, 'runtime/verify-input/ST-CA-p01.json'), inputPart('ST-CA', 1, ['A-1', 'A-2', 'A-3']))
writeJson(path.join(TMP, 'runtime/verify-input/ST-CA-p02.json'), inputPart('ST-CA', 2, ['A-4', 'A-5']))
writeJson(
  path.join(TMP, 'runtime/verify-output/ST-CA-p01.json'),
  outputPart('ST-CA', 1, [entry('A-1', 'active', 2), entry('A-2', 'conditional', 1), entry('A-3', 'unknown', 0)])
)
writeJson(
  path.join(TMP, 'runtime/verify-output/ST-CA-p02.json'),
  outputPart('ST-CA', 2, [entry('A-4', 'active', 1), entry('A-5', 'inactive', 0)])
)
const recountPathA = path.join(TMP, 'runtime', 'verify-recount.json')
const rA = recountVerifyParts({ outDir: TMP, partFiles: partFilesA, recountPath: recountPathA })
check('A1 正常重算 ok', rA.ok === true && rA.problems.length === 0)
check(
  'A2 四类分布正确',
  JSON.stringify(rA.summary.scopeStats) === JSON.stringify({ active: 2, conditional: 1, unknown: 1, inactive: 1 })
)
check('A3 原子/SVE 合计正确', rA.summary.atomCount === 5 && rA.summary.sveCount === 4)
check('A4 分片计数正确', rA.summary.parts[0].atomCount === 3 && rA.summary.parts[1].sveCount === 1)
check('A5 recount 落盘', fs.existsSync(recountPathA))
const rcA = readJson(recountPathA)
check('A6 recount 字段', rcA.schemaVersion === 1 && rcA.partCount === 2 && rcA.atomCount === 5 && Array.isArray(rcA.parts) && rcA.parts.length === 2)
check('A7 recount JSON 1 空格缩进 + 末尾换行', fs.readFileSync(recountPathA, 'utf8').endsWith('}\n') && fs.readFileSync(recountPathA, 'utf8').includes('\n "partCount": 2'))

// ---------- 用例 B~G：fail 集 ----------

function failCase(name, setup, expectProblem) {
  reset()
  const partFiles = setup()
  const r = recountVerifyParts({ outDir: TMP, partFiles, recountPath: path.join(TMP, 'runtime', 'verify-recount.json') })
  check(
    name,
    r.ok === false && r.problems.some((p) => p.includes(expectProblem)) && !fs.existsSync(path.join(TMP, 'runtime', 'verify-recount.json'))
  )
}

failCase('B 期望原子缺落判条目 fail', () => {
  writeJson(path.join(TMP, 'runtime/verify-input/ST-CB-p01.json'), inputPart('ST-CB', 1, ['B-1', 'B-2']))
  writeJson(path.join(TMP, 'runtime/verify-output/ST-CB-p01.json'), outputPart('ST-CB', 1, [entry('B-1', 'active', 0)]))
  return [{ stageId: 'ST-CB', file: 'ST-CB-p01.json' }]
}, '期望原子缺落判条目')

failCase('C 混入外来原子 fail', () => {
  writeJson(path.join(TMP, 'runtime/verify-input/ST-CC-p01.json'), inputPart('ST-CC', 1, ['C-1']))
  writeJson(path.join(TMP, 'runtime/verify-output/ST-CC-p01.json'), outputPart('ST-CC', 1, [entry('C-1', 'active', 0), entry('C-X', 'active', 0)]))
  return [{ stageId: 'ST-CC', file: 'ST-CC-p01.json' }]
}, '落判条目混入外来原子')

failCase('D atomId 重复 fail', () => {
  writeJson(path.join(TMP, 'runtime/verify-input/ST-CD-p01.json'), inputPart('ST-CD', 1, ['D-1', 'D-2']))
  writeJson(path.join(TMP, 'runtime/verify-output/ST-CD-p01.json'), outputPart('ST-CD', 1, [entry('D-1', 'active', 0), entry('D-1', 'conditional', 0), entry('D-2', 'active', 0)]))
  return [{ stageId: 'ST-CD', file: 'ST-CD-p01.json' }]
}, '落判条目 atomId 重复')

failCase('E applicability 非法枚举 fail', () => {
  writeJson(path.join(TMP, 'runtime/verify-input/ST-CE-p01.json'), inputPart('ST-CE', 1, ['E-1']))
  writeJson(path.join(TMP, 'runtime/verify-output/ST-CE-p01.json'), outputPart('ST-CE', 1, [entry('E-1', 'always', 0)]))
  return [{ stageId: 'ST-CE', file: 'ST-CE-p01.json' }]
}, 'applicability 非法枚举')

failCase('F 落判分片缺失 fail', () => {
  writeJson(path.join(TMP, 'runtime/verify-input/ST-CF-p01.json'), inputPart('ST-CF', 1, ['F-1']))
  return [{ stageId: 'ST-CF', file: 'ST-CF-p01.json' }]
}, '落判分片不可读')

failCase('G atomCount 声明不符 fail', () => {
  const inp = inputPart('ST-CG', 1, ['G-1', 'G-2'])
  inp.atomCount = 3
  writeJson(path.join(TMP, 'runtime/verify-input/ST-CG-p01.json'), inp)
  writeJson(path.join(TMP, 'runtime/verify-output/ST-CG-p01.json'), outputPart('ST-CG', 1, [entry('G-1', 'active', 0), entry('G-2', 'active', 0)]))
  return [{ stageId: 'ST-CG', file: 'ST-CG-p01.json' }]
}, 'atomCount 与 featureGroups 不符')

// ---------- 用例 H：CLI ----------

reset()
writeJson(path.join(TMP, 'runtime/verify-input/ST-CH-p01.json'), inputPart('ST-CH', 1, ['H-1', 'H-2']))
writeJson(
  path.join(TMP, 'runtime/verify-output/ST-CH-p01.json'),
  outputPart('ST-CH', 1, [entry('H-1', 'active', 1), entry('H-2', 'conditional', 0)])
)
const recountPathH = path.join(TMP, 'runtime', 'verify-recount.json')
const okOut = runCli([TMP, 'ST-CH-p01.json', recountPathH], true)
check('H1 CLI 成功输出统计', okOut.includes('[成功]') && okOut.includes('原子 2') && fs.existsSync(recountPathH))
check('H2 CLI recount 内容一致', readJson(recountPathH).scopeStats.active === 1 && readJson(recountPathH).scopeStats.conditional === 1)

reset()
writeJson(path.join(TMP, 'runtime/verify-input/ST-CH-p02.json'), inputPart('ST-CH', 2, ['H-3']))
const badOut = runCli([TMP, 'ST-CH-p02.json', path.join(TMP, 'runtime', 'verify-recount.json')], false)
check('H3 CLI 失败退出码 1 + 问题明细 + 不写 recount', badOut.includes('[失败]') && badOut.includes('落判分片不可读') && !fs.existsSync(path.join(TMP, 'runtime', 'verify-recount.json')))

fs.rmSync(TMP, { recursive: true, force: true })

console.log('')
if (fail === 0) {
  console.log('[全部通过] ' + pass + ' 项断言')
  process.exit(0)
} else {
  console.error('[存在失败] 通过 ' + pass + ' / 失败 ' + fail)
  process.exit(1)
}
