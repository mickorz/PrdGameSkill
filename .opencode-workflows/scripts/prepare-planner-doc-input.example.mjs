// prepare-planner-doc-input.example.mjs —— prepare-planner-doc-input.mjs 自检（node 直接跑）
//
// 覆盖用例：
//   1. 最小 sourceSpec（scan + feature_index）生成 sections.json 与每阶段业务证据
//   2. 业务字段白名单隔离（client_logic/evidence/messages/owner 不进证据文件）
//   3. v2 索引 business_behavior 透传 / v1 索引不补空串
//   4. 输入缺失 fail
//   5. 无 stage 章节 fail
//   6. 阶段无功能点 fail

import fs from 'node:fs'
import path from 'node:path'
import { main } from './prepare-planner-doc-input.mjs'

const TMP = path.join(process.cwd(), '.tmp-prepare-planner-doc-input')

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

function reset() {
  fs.rmSync(TMP, { recursive: true, force: true })
  fs.mkdirSync(TMP, { recursive: true })
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 1), 'utf8')
}

// ---------- 用例 1/2/3：最小生成 + 白名单隔离 + v2 透传 ----------
{
  reset()
  const src = path.join(TMP, 'src')
  const out = path.join(TMP, 'out')
  fs.mkdirSync(path.join(src, 'runtime', 'state'), { recursive: true })
  writeJson(path.join(src, 'runtime', 'state', 'scan.json'), {
    templatePath: 'tpl.md',
    totalLines: 100,
    sections: [
      { no: 1, title: '引言', fromLine: 1, toLine: 5, kind: 'intro', sourceTitle: '引言' },
      { no: 2, title: '名词', fromLine: 6, toLine: 10, kind: 'terms', sourceTitle: '名词' },
      { no: 3, title: '定庄', fromLine: 11, toLine: 20, kind: 'stage', stageId: 'ST-C01', sourceTitle: '开局 > 定庄' },
      { no: 4, title: '算分', fromLine: 21, toLine: 30, kind: 'stage', stageId: 'ST-C02', sourceTitle: '算分' },
    ],
  })
  writeJson(path.join(src, 'feature_index.json'), {
    schema_version: 2,
    stages: [{ id: 'ST-C01', name: '定庄' }, { id: 'ST-C02', name: '算分' }],
    features: [
      {
        id: 'FP-1', stage_id: 'ST-C01', stage_name: '定庄',
        atoms: [
          {
            id: 'AT-ST-C01-001', name: '首局定庄', rule: '首局随机坐庄。', ui_requirement: '',
            owner: 'client', verdict: 'confirmed', client_logic: 'GameJuDataCmd 逻辑',
            ui_interaction: '头像点亮庄家标志', messages: ['MsgJuData'],
            evidence: [{ file: 'a.ts', location: 'a.ts:1' }], notes: '',
            business_behavior: { trigger: '开局', condition: '首局', action: '点亮庄家标志', result: '玩家看到庄家' },
            difference: 'consistent', difference_detail: '', verification: { business_rule_verified: false, unverified_reason: 'x' },
          },
        ],
      },
      {
        id: 'FP-2', stage_id: 'ST-C02', stage_name: '算分',
        atoms: [{ id: 'AT-ST-C02-001', name: '底分', rule: '底分为 1。', ui_requirement: '', owner: 'client', verdict: 'partial', client_logic: '客户端逻辑', ui_interaction: '结算显示', messages: [], evidence: [], notes: '差异存疑' }],
      },
    ],
  })
  const r = main(src, out)
  assert('用例1 生成成功', r.stageCount === 2 && r.atomTotal === 2)
  assert('用例1 sections.json 存在', fs.existsSync(path.join(out, 'runtime', 'planner-input', 'sections.json')))
  assert('用例1 证据文件 2 份', fs.existsSync(path.join(out, 'runtime', 'planner-input', 'planner-evidence_ST-C01.json')) && fs.existsSync(path.join(out, 'runtime', 'planner-input', 'planner-evidence_ST-C02.json')))

  const sectionsMeta = JSON.parse(fs.readFileSync(path.join(out, 'runtime', 'planner-input', 'sections.json'), 'utf8'))
  assert('用例1 sections 元数据齐全', sectionsMeta.stageCount === 2 && sectionsMeta.sections.length === 4 && sectionsMeta.termsSection.title === '名词' && sectionsMeta.templatePath === 'tpl.md')

  const ev1 = JSON.parse(fs.readFileSync(path.join(out, 'runtime', 'planner-input', 'planner-evidence_ST-C01.json'), 'utf8'))
  const a1 = ev1.atoms[0]
  assert('用例2 业务字段保留', a1.id === 'AT-ST-C01-001' && a1.rule === '首局随机坐庄。' && a1.uiInteraction === '头像点亮庄家标志' && a1.verdict === 'confirmed')
  assert('用例2 技术字段剔除（clientLogic/evidence/messages/owner 不进证据）', a1.clientLogic === undefined && a1.evidence === undefined && a1.messages === undefined && a1.owner === undefined)
  assert('用例3 v2 business_behavior 透传', a1.businessBehavior && a1.businessBehavior.action === '点亮庄家标志')
  assert('用例3 v2 difference 不透传（证据文件只服务策划版写作，差异走 notes/原文）', a1.difference === undefined)

  const ev2 = JSON.parse(fs.readFileSync(path.join(out, 'runtime', 'planner-input', 'planner-evidence_ST-C02.json'), 'utf8'))
  assert('用例3 v1 原子不补空 businessBehavior', ev2.atoms[0].businessBehavior === undefined)
  assert('用例2 notes 保留', ev2.atoms[0].notes === '差异存疑')
  assert('用例1 证据头字段齐全', ev1.fromLine === 11 && ev1.toLine === 20 && ev1.templatePath === 'tpl.md' && ev1.atomCount === 1)
}

// ---------- 用例 3b：v1 索引（无 schema_version）正常生成 ----------
{
  reset()
  const src = path.join(TMP, 'src')
  const out = path.join(TMP, 'out')
  fs.mkdirSync(path.join(src, 'runtime', 'state'), { recursive: true })
  writeJson(path.join(src, 'runtime', 'state', 'scan.json'), {
    templatePath: 'tpl.md',
    totalLines: 20,
    sections: [{ no: 3, title: '定庄', fromLine: 1, toLine: 10, kind: 'stage', stageId: 'ST-C01', sourceTitle: '定庄' }],
  })
  writeJson(path.join(src, 'feature_index.json'), {
    stages: [{ id: 'ST-C01', name: '定庄' }],
    features: [{ id: 'FP-1', stage_id: 'ST-C01', stage_name: '定庄', atoms: [{ id: 'AT-ST-C01-001', name: 'n', rule: 'r', ui_requirement: '', verdict: 'confirmed', client_logic: 'c', ui_interaction: 'u', messages: [], evidence: [], notes: '' }] }],
  })
  const r = main(src, out)
  assert('用例3b v1 索引正常生成', r.ok !== false && r.stageCount === 1)
}

// ---------- 用例 4：输入缺失 fail ----------
{
  reset()
  let threw = false
  try {
    main(path.join(TMP, 'no-src'), path.join(TMP, 'out'))
  } catch (e) {
    threw = String(e.message).includes('不存在')
  }
  assert('用例4 输入缺失 fail', threw)
}

// ---------- 用例 5：无 stage 章节 fail ----------
{
  reset()
  const src = path.join(TMP, 'src')
  fs.mkdirSync(path.join(src, 'runtime', 'state'), { recursive: true })
  writeJson(path.join(src, 'runtime', 'state', 'scan.json'), { sections: [{ no: 1, title: '引言', fromLine: 1, toLine: 5, kind: 'intro', sourceTitle: '引言' }] })
  writeJson(path.join(src, 'feature_index.json'), { features: [] })
  let threw = false
  try {
    main(src, path.join(TMP, 'out'))
  } catch (e) {
    threw = String(e.message).includes('kind=stage')
  }
  assert('用例5 无 stage 章节 fail', threw)
}

// ---------- 用例 6：阶段无功能点 fail ----------
{
  reset()
  const src = path.join(TMP, 'src')
  fs.mkdirSync(path.join(src, 'runtime', 'state'), { recursive: true })
  writeJson(path.join(src, 'runtime', 'state', 'scan.json'), {
    sections: [{ no: 3, title: '定庄', fromLine: 1, toLine: 10, kind: 'stage', stageId: 'ST-C09', sourceTitle: '定庄' }],
  })
  writeJson(path.join(src, 'feature_index.json'), { features: [] })
  let threw = false
  try {
    main(src, path.join(TMP, 'out'))
  } catch (e) {
    threw = String(e.message).includes('无功能点')
  }
  assert('用例6 阶段无功能点 fail', threw)
}

fs.rmSync(TMP, { recursive: true, force: true })
console.log('prepare-planner-doc-input.example：' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail === 0 ? 0 : 1)
