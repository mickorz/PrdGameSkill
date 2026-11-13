#!/usr/bin/env node
// prepare-planner-experiment.mjs 自检
// 运行：node .opencode-workflows/scripts/prepare-planner-experiment.example.mjs
// 覆盖：stageSections 派生（scan.json 无 stageSections 字段的差异适配）、snake_case 转 camelCase、
//       白名单剔除（client_logic/evidence/messages/owner 不得出现在产物）、meta.json 结构、
//       未知 stage 报错、历史目录只读（输入目录不被写入）

import fs from 'fs'
import os from 'os'
import path from 'path'
import { main } from './prepare-planner-experiment.mjs'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prep-planner-exp-'))
let passed = 0
function assert(cond, name) {
  if (!cond) {
    console.error('[失败] ' + name)
    process.exitCode = 1
  } else {
    passed++
    console.log('[通过] ' + name)
  }
}

// 构造 mini 历史产物（结构对齐 2026-11-13 首跑：scan.json 只有 sections；feature_index 为 snake_case）
const srcDir = path.join(tmp, '1-spec')
fs.mkdirSync(path.join(srcDir, 'runtime', 'state'), { recursive: true })
fs.writeFileSync(
  path.join(srcDir, 'runtime', 'state', 'scan.json'),
  JSON.stringify({
    templatePath: 'templates/迷你模板.md',
    totalLines: 40,
    sections: [
      { no: 1, title: '引言', fromLine: 1, toLine: 5, kind: 'intro' },
      { no: 2, title: '名词', fromLine: 6, toLine: 10, kind: 'terms' },
      { no: 3, title: '定庄', fromLine: 11, toLine: 20, kind: 'stage', sourceTitle: '开局 > 定庄' },
      { no: 4, title: '吃牌', fromLine: 21, toLine: 40, kind: 'stage', sourceTitle: '行牌 > 吃牌' },
    ],
  }),
  'utf8'
)
const mkAtom = (id, name, rule, verdict) => ({
  id: id,
  name: name,
  rule: rule,
  ui_requirement: '',
  owner: 'client',
  verdict: verdict,
  client_logic: 'GameJuDataCmd 处理（应被剔除）',
  ui_interaction: '显示按钮（BoxHzmjMah2DView）（保留但由 prompt 转写）',
  messages: ['MsgJuData'],
  evidence: [{ file: 'source-code/client/Code/a.ts', location: 'a.ts:31', excerpt: 'x' }],
  notes: '',
})
fs.writeFileSync(
  path.join(srcDir, 'feature_index.json'),
  JSON.stringify({
    schema_version: undefined, // v1 无此字段
    stage_count: 2,
    features: [
      {
        id: 'FP-ST-C01-001',
        stage_id: 'ST-C01',
        stage_name: '定庄',
        atoms: [mkAtom('AT-ST-C01-001', '首局随机坐庄', '首局四名玩家随机产生庄家', 'confirmed')],
      },
      {
        id: 'FP-ST-C05-001',
        stage_id: 'ST-C05',
        stage_name: '吃牌',
        atoms: [
          mkAtom('AT-ST-C05-001', '吃上家', '吃牌只能吃上家打出的牌', 'confirmed'),
          mkAtom('AT-ST-C05-002', '吃牌展示', '吃牌成功后展示吃牌组合', 'not_found'),
        ],
      },
    ],
  }),
  'utf8'
)

const outDir = path.join(tmp, 'out')
const r = main(srcDir, outDir, ['ST-C01', 'ST-C05'])

// 1. 产物文件齐全
for (const expect of ['source/meta.json', 'source/planner-evidence_ST-C01.json', 'source/planner-evidence_ST-C05.json']) {
  assert(fs.existsSync(path.join(outDir, expect)), '产物存在 ' + expect)
}

// 2. stageSections 派生：intro/terms 不进 evidence，阶段行号正确
const ev01 = JSON.parse(fs.readFileSync(path.join(outDir, 'source/planner-evidence_ST-C01.json'), 'utf8'))
assert(ev01.fromLine === 11 && ev01.toLine === 20, '阶段行号来自 kind=stage 章节')
assert(ev01.termsFromLine === 6 && ev01.termsToLine === 10, '名词章节行号派生')
assert(ev01.templatePath === 'templates/迷你模板.md', 'templatePath 透传')

// 3. snake_case 转 camelCase + 白名单剔除
const a = ev01.atoms[0]
assert(a.uiRequirement === '' && a.uiInteraction.includes('BoxHzmjMah2DView') && a.verdict === 'confirmed', '字段 camelCase 映射')
const raw = JSON.stringify(ev01)
assert(!raw.includes('client_logic') && !raw.includes('"clientLogic"'), 'client_logic 被剔除（结构化隔离）')
assert(!raw.includes('evidence') && !raw.includes('source-code'), 'evidence/路径被剔除')
assert(!raw.includes('"messages"') && !raw.includes('MsgJuData') && !raw.includes('"owner"'), 'messages/owner 被剔除')
assert(raw.includes('GameJuDataCmd') === false, 'client_logic 中的类名不进产物')

// 4. meta.json 结构
const meta = JSON.parse(fs.readFileSync(path.join(outDir, 'source/meta.json'), 'utf8'))
assert(meta.stages.length === 2 && meta.stages[1].atomCount === 2, 'meta 阶段清单与原子计数')
assert(String(meta.indexSchemaVersion).includes('v1'), 'v1 索引版本标注（无 schema_version 字段时兜底）')

// 5. 历史目录只读：输入目录在运行后无新增文件
const srcFilesAfter = []
;(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f)
    if (fs.statSync(p).isDirectory()) walk(p)
    else srcFilesAfter.push(p)
  }
})(srcDir)
assert(srcFilesAfter.length === 2, '历史目录零写入（只读约束）')

// 6. 未知 stage 报错
let threw = false
try {
  main(srcDir, outDir, ['ST-C99'])
} catch (e) {
  threw = String(e.message).includes('ST-C99')
}
assert(threw, '未知 stage fail fast')

// 7. 幂等：重复运行成功
main(srcDir, outDir, ['ST-C01', 'ST-C05'])
assert(fs.existsSync(path.join(outDir, 'source/meta.json')), '重复运行幂等')

console.log('[结果] ' + passed + ' 项断言全部通过' + (process.exitCode ? '（存在失败）' : ''))
fs.rmSync(tmp, { recursive: true, force: true })
