// build-planner-trace.example.mjs —— build-planner-trace.mjs 自检（node 直接跑）
//
// 覆盖用例：
//   1. 最小 scan/index 生成条目（atomId/sourceStage/sourceRule/plannerSection/plannerPart/evidenceCount/reviewStatus）
//   2. section.no -> part-NN.md 编号映射
//   3. plannerParts 缺片 fail（章节对应分片不在列表）
//   4. 输入文件缺失 fail
//   5. 无 stage 章节 fail
//   6. indexSchemaVersion 透传
//   7. 输出文件内容断言（条目数、字段、reviewStatus=pending）
//   8. 多阶段混合（intro/terms 不进条目）

import fs from 'node:fs'
import path from 'node:path'
import { buildPlannerTrace } from './build-planner-trace.mjs'

const TMP = path.join(process.cwd(), '.tmp-trace-example')

function reset() {
  fs.rmSync(TMP, { recursive: true, force: true })
  fs.mkdirSync(TMP, { recursive: true })
}

let pass = 0
let fail = 0
function assert(name, cond) {
  if (cond) {
    pass++
    console.log('[通过] ' + name)
  } else {
    fail++
    console.error('[失败] ' + name)
  }
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 1), 'utf8')
}

// ---------- 用例 1/2/7/8：最小生成 ----------
{
  reset()
  const scanPath = path.join(TMP, 'scan.json')
  const indexPath = path.join(TMP, 'feature_index.json')
  const outPath = path.join(TMP, 'trace_index.json')
  writeJson(scanPath, {
    templatePath: 'tpl.md',
    totalLines: 100,
    sections: [
      { no: 1, title: '引言', fromLine: 1, toLine: 5, kind: 'intro', sourceTitle: '引言' },
      { no: 2, title: '名词', fromLine: 6, toLine: 10, kind: 'terms', sourceTitle: '名词' },
      { no: 3, title: '定庄', fromLine: 11, toLine: 20, kind: 'stage', stageId: 'ST-C01', sourceTitle: '开局 > 定庄' },
      { no: 4, title: '财神', fromLine: 21, toLine: 30, kind: 'stage', stageId: 'ST-C02', sourceTitle: '行牌 > 财神' },
    ],
  })
  writeJson(indexPath, {
    schema_version: 2,
    stages: [{ id: 'ST-C01', name: '定庄' }, { id: 'ST-C02', name: '财神' }],
    features: [
      {
        id: 'FP-1',
        stage_id: 'ST-C01',
        stage_name: '定庄',
        atoms: [
          { id: 'AT-ST-C01-001', rule: '首局随机坐庄。', evidence: [{ file: 'a.ts', location: 'a.ts:1' }] },
          { id: 'AT-ST-C01-002', rule: '三牢封顶。', evidence: [] },
        ],
      },
      {
        id: 'FP-2',
        stage_id: 'ST-C02',
        stage_name: '财神',
        atoms: [{ id: 'AT-ST-C02-001', rule: '财神可替牌。', evidence: [{ file: 'b.ts', location: 'b.ts:1' }, { file: 'c.ts', location: 'c.ts:2' }] }],
      },
    ],
  })
  const parts = [path.join(TMP, 'part-03.md'), path.join(TMP, 'part-04.md')]
  const r = buildPlannerTrace(scanPath, indexPath, parts, outPath)
  assert('用例1 生成成功', r.ok === true)
  assert('用例1 条目数 3', r.entryCount === 3)
  assert('用例1 byStage 统计', r.byStage['ST-C01'] === 2 && r.byStage['ST-C02'] === 1)

  const trace = JSON.parse(fs.readFileSync(outPath, 'utf8'))
  assert('用例1 输出条目数一致', trace.entryCount === 3 && trace.entries.length === 3)
  const e1 = trace.entries[0]
  assert(
    '用例2 section.no 映射 part-03.md',
    e1.plannerPart === 'part-03.md' && e1.plannerSection === '开局 > 定庄'
  )
  assert('用例2 ST-C02 映射 part-04.md', trace.entries[2].plannerPart === 'part-04.md')
  assert(
    '用例7 字段齐全 reviewStatus=pending',
    e1.atomId === 'AT-ST-C01-001' && e1.sourceStage === 'ST-C01' && e1.sourceRule === '首局随机坐庄。' && e1.reviewStatus === 'pending'
  )
  assert('用例7 evidenceCount 统计', e1.evidenceCount === 1 && trace.entries[1].evidenceCount === 0 && trace.entries[2].evidenceCount === 2)
  assert('用例6 indexSchemaVersion 透传', trace.indexSchemaVersion === 2)
  assert('用例8 intro/terms 不进条目', trace.entries.every((e) => e.sourceStage === 'ST-C01' || e.sourceStage === 'ST-C02'))
}

// ---------- 用例 3：plannerParts 缺片 fail ----------
{
  reset()
  const scanPath = path.join(TMP, 'scan.json')
  const indexPath = path.join(TMP, 'feature_index.json')
  const outPath = path.join(TMP, 'trace_index.json')
  writeJson(scanPath, {
    sections: [{ no: 3, title: '定庄', fromLine: 1, toLine: 10, kind: 'stage', stageId: 'ST-C01', sourceTitle: '定庄' }],
  })
  writeJson(indexPath, {
    features: [{ id: 'FP-1', stage_id: 'ST-C01', atoms: [{ id: 'AT-ST-C01-001', rule: 'r', evidence: [] }] }],
  })
  const r = buildPlannerTrace(scanPath, indexPath, [path.join(TMP, 'part-99.md')], outPath)
  assert('用例3 缺片 fail 且报 part-03.md', r.ok === false && r.problems[0].includes('part-03.md'))
}

// ---------- 用例 3b：plannerParts 空列表跳过存在性校验 ----------
{
  reset()
  const scanPath = path.join(TMP, 'scan.json')
  const indexPath = path.join(TMP, 'feature_index.json')
  const outPath = path.join(TMP, 'trace_index.json')
  writeJson(scanPath, {
    sections: [{ no: 3, title: '定庄', fromLine: 1, toLine: 10, kind: 'stage', stageId: 'ST-C01', sourceTitle: '定庄' }],
  })
  writeJson(indexPath, {
    features: [{ id: 'FP-1', stage_id: 'ST-C01', atoms: [{ id: 'AT-ST-C01-001', rule: 'r', evidence: [] }] }],
  })
  const r = buildPlannerTrace(scanPath, indexPath, [], outPath)
  assert('用例3b 空列表跳过分片校验仍成功', r.ok === true && r.entryCount === 1)
}

// ---------- 用例 4：输入缺失 fail ----------
{
  reset()
  const r = buildPlannerTrace(path.join(TMP, 'no-scan.json'), path.join(TMP, 'no-index.json'), [], path.join(TMP, 't.json'))
  assert('用例4 输入缺失 fail', r.ok === false && r.problems[0].includes('不存在'))
}

// ---------- 用例 5：无 stage 章节 fail ----------
{
  reset()
  const scanPath = path.join(TMP, 'scan.json')
  const indexPath = path.join(TMP, 'feature_index.json')
  writeJson(scanPath, { sections: [{ no: 1, title: '引言', fromLine: 1, toLine: 5, kind: 'intro', sourceTitle: '引言' }] })
  writeJson(indexPath, { features: [] })
  const r = buildPlannerTrace(scanPath, indexPath, [], path.join(TMP, 't.json'))
  assert('用例5 无 stage 章节 fail', r.ok === false && r.problems[0].includes('kind=stage'))
}

fs.rmSync(TMP, { recursive: true, force: true })
console.log('build-planner-trace.example：' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail === 0 ? 0 : 1)
