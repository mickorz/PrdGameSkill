// assemble-output-spec-index.mjs —— 1-spec 索引装配器（确定性命令）
//
// output-spec-generate workflow 的配套脚本：读取 <specDir>/runtime/parts/ST-C*.json
// （每阶段一份原子拆分+代码查证结果片段），装配 feature_index.json 与 stage_manifest.md。
// 片段由 workflow 内 echo agent 逐字写入（脚本侧不做 LLM 转述，数据保真）。
//
// v2 业务语义透传（2026-11-14，需求 R4/R5，T3.4）：
//   - feature_index 顶层新增 schema_version: 2 与 difference_stats
//     （consistent/partial/conflict/unverified 计数，conflict 优先原则：单值字段直接按值计数）。
//   - 原子项透传新字段（camel 转 snake）：business_behavior{trigger,condition,action,result}、
//     difference、difference_detail、verification{business_rule_verified,unverified_reason,client_observed}。
//   - v1 旧片段（原子项无 difference/verification 字段）兼容：difference 按 unverified 计入
//     difference_stats 并计入 difference_unmarked（未经新 Schema 查证，不冒充已验证，
//     需求 6.4）；business_behavior 视为空对象。
//
// 可导入：export assembleIndex(specDir, date, sourceDesc, expectedStageCount)
//         返回 { ok, problems, summary }，不直接退出进程
// CLI 用法：
//   node assemble-output-spec-index.mjs <specDir> <date> <sourceDesc> [expectedStageCount]
//
// 行为：
//   - 解析全部片段，校验文件名与 stage.id 一致、stage/feature/atom ID 全局唯一
//   - expectedStageCount 给定时校验片段数一致（防上次运行残留片段混入）
//   - 写 <specDir>/feature_index.json（UTF-8 无 BOM，结构对齐原 1-spec 总入口）
//   - 写 <specDir>/stage_manifest.md（阶段速查表：原子数/证实分布/协议消息/UI 模块）
//
// 退出码（CLI）：0 成功 / 1 结构错误（无片段、JSON 损坏、ID 冲突、空阶段、阶段数不符）

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function cell(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '／')
    .trim()
}

function stageNo(id) {
  const m = String(id || '').match(/^ST-C(\d+)$/)
  return m ? Number(m[1]) : -1
}

// 从证据文件路径提取 UI 模块名（box_hzmj_* 等）
function uiModulesFromFeatures(features) {
  const mods = new Set()
  for (const fe of features) {
    for (const at of fe.atoms || []) {
      for (const e of at.evidence || []) {
        const m = String(e.file || '').match(/box_[a-zA-Z0-9_]+/)
        if (m) mods.add(m[0])
      }
    }
  }
  return Array.from(mods).sort()
}

function messagesFromFeatures(features) {
  const msgs = new Set()
  for (const fe of features) {
    for (const at of fe.atoms || []) {
      for (const m of at.messages || []) msgs.add(String(m))
    }
  }
  return Array.from(msgs).sort()
}

export function assembleIndex(specDir, date, sourceDesc, expectedStageCount) {
  const problems = []
  const bad = (msg) => {
    problems.push(msg)
    console.error('[失败] ' + msg)
    return { ok: false, problems: problems, summary: null }
  }

  const partsDir = path.join(specDir, 'runtime', 'parts')
  if (!fs.existsSync(partsDir)) {
    return bad('片段目录不存在：' + partsDir + '（产出编写阶段可能中断，请重跑 workflow）')
  }
  const files = fs
    .readdirSync(partsDir)
    .filter((f) => /^ST-C\d+\.json$/.test(f))
    .sort((a, b) => stageNo(a) - stageNo(b))
  if (files.length === 0) {
    return bad('片段目录为空：' + partsDir + '（产出编写阶段可能中断，请重跑 workflow）')
  }
  if (expectedStageCount !== undefined && Number(expectedStageCount) !== files.length) {
    return bad(
      '片段数与期望阶段数不符：期望 ' + expectedStageCount + '，实际 ' + files.length +
        '（可能残留上次运行片段，请清理 ' + partsDir + ' 后重跑）'
    )
  }

  const stages = []
  const features = []
  const stats = []
  const stageIds = new Set()
  const featureIds = new Set()
  const atomIds = new Set()

  for (const f of files) {
    let part
    try {
      part = JSON.parse(fs.readFileSync(path.join(partsDir, f), 'utf8'))
    } catch (err) {
      return bad('片段 JSON 解析失败：' + f + '（' + err.message + '）')
    }
    const st = (part && part.stage) || {}
    if (!st.id || st.id + '.json' !== f) {
      return bad('片段 stage.id 与文件名不一致：' + f + ' / ' + st.id)
    }
    if (stageNo(st.id) < 0) return bad('阶段 ID 格式不合法：' + st.id)
    if (stageIds.has(st.id)) return bad('阶段 ID 重复：' + st.id)
    stageIds.add(st.id)

    const stageFeatures = []
    for (const fe of part.features || []) {
      if (!fe.id || !fe.name) return bad('功能点 id/name 缺失：' + JSON.stringify({ id: fe.id }))
      if (featureIds.has(fe.id)) return bad('功能点 ID 重复：' + fe.id)
      featureIds.add(fe.id)
      const atoms = []
      for (const at of fe.atoms || []) {
        if (!at.id || !at.name) return bad('原子项 id/name 缺失：' + JSON.stringify({ id: at.id }))
        if (atomIds.has(at.id)) return bad('原子项 ID 重复：' + at.id)
        atomIds.add(at.id)
        // v2 新字段透传（T3.4）：v1 旧片段无 difference/verification/businessBehavior 时按
        // 「未经新 Schema 查证」处理（difference 兜底 unverified，不冒充已验证，需求 6.4）
        const hasV2 = at.difference !== undefined || at.verification !== undefined || at.businessBehavior !== undefined
        const verification = at.verification || { businessRuleVerified: false, unverifiedReason: 'v1 旧 Schema 数据（未经新 Schema 查证）' }
        atoms.push({
          id: at.id,
          name: at.name,
          rule: at.rule || '',
          ui_requirement: at.uiRequirement || '',
          owner: 'client',
          verdict: at.verdict,
          client_logic: at.clientLogic || '',
          ui_interaction: at.uiInteraction || '',
          messages: at.messages || [],
          // 索引证据只留 file/location（摘录保留在阶段文档），确定性剥离，防止片段带摘录混入
          evidence: (at.evidence || []).map((e) => ({ file: e.file, location: e.location })),
          notes: at.notes || '',
          business_behavior: at.businessBehavior
            ? {
                trigger: at.businessBehavior.trigger || '',
                condition: at.businessBehavior.condition || '',
                action: at.businessBehavior.action || '',
                result: at.businessBehavior.result || '',
              }
            : {},
          difference: at.difference !== undefined ? at.difference : 'unverified',
          difference_detail: at.differenceDetail || '',
          verification: {
            business_rule_verified: verification.businessRuleVerified === true,
            unverified_reason: verification.unverifiedReason || '',
            client_observed: at.verdict !== 'not_found',
          },
          schema_marked: hasV2,
        })
      }
      if (atoms.length === 0) return bad('功能点无原子项：' + fe.id)
      stageFeatures.push({
        id: fe.id,
        name: fe.name,
        stage_id: st.id,
        stage_name: st.name,
        description: fe.description || '',
        scope: fe.scope || '',
        coordination: fe.coordination || '',
        atoms: atoms,
      })
    }
    const flat = stageFeatures.flatMap((x) => x.atoms)
    if (flat.length === 0) return bad('阶段无任何原子项：' + st.id)

    stages.push({ id: st.id, name: st.name, chapter: st.chapter || '' })
    features.push(...stageFeatures)
    stats.push({
      id: st.id,
      name: st.name,
      chapter: st.chapter || '',
      featureCount: stageFeatures.length,
      atomCount: flat.length,
      confirmed: flat.filter((a) => a.verdict === 'confirmed').length,
      partial: flat.filter((a) => a.verdict === 'partial').length,
      notFound: flat.filter((a) => a.verdict === 'not_found').length,
      messages: messagesFromFeatures(stageFeatures),
      uiModules: uiModulesFromFeatures(stageFeatures),
    })
  }

  // v2 差异统计（T3.4）：v1 旧片段无 difference 字段按 unverified 计（schema_marked=false 区分）
  const diffStats = { consistent: 0, partial: 0, conflict: 0, unverified: 0 }
  let diffUnmarked = 0
  for (const fe of features) {
    for (const at of fe.atoms || []) {
      if (diffStats[at.difference] === undefined) at.difference = 'unverified'
      diffStats[at.difference]++
      if (at.schema_marked !== true) diffUnmarked++
    }
  }

  const index = {
    module: '42320',
    source:
      sourceDesc ||
      'templates/【杭州麻将】核心流程杭州麻将好友房AI-核心简化版本.md（需求模板）+ source-code/client/Code + source-code/client/Fgui（客户端代码证据）',
    generated_by: 'output-spec-generate workflow',
    date: date || '未提供',
    // v2 新增（T3.4/T2.2）：Schema 版本（2 = 含 businessBehavior/difference/verification）
    schema_version: 2,
    stage_count: stages.length,
    feature_count: features.length,
    atom_count: atomIds.size,
    // v2 新增（T3.4）：difference 分布（v1 未标注原子按 unverified 计，diff_unmarked 为其数量）
    difference_stats: {
      consistent: diffStats.consistent,
      partial: diffStats.partial,
      conflict: diffStats.conflict,
      unverified: diffStats.unverified,
      unmarked_v1: diffUnmarked,
    },
    stages: stages,
    features: features,
  }
  fs.writeFileSync(path.join(specDir, 'feature_index.json'), JSON.stringify(index, null, 1), 'utf8')

  const total = stats.reduce(
    (acc, s) => ({
      f: acc.f + s.featureCount,
      a: acc.a + s.atomCount,
      c: acc.c + s.confirmed,
      p: acc.p + s.partial,
      n: acc.n + s.notFound,
    }),
    { f: 0, a: 0, c: 0, p: 0, n: 0 }
  )

  const lines = []
  lines.push('# 阶段清单')
  lines.push('')
  lines.push('> 来源：' + index.source)
  lines.push('> 生成：output-spec-generate workflow，' + index.date + '。客户端视角规格，verdict 分布见下表。')
  lines.push('')
  lines.push('| 阶段 ID | 阶段 | 来源章节 | 功能点 | 原子项 | 已证实 | 部分证实 | 未找到 | 涉及协议消息 | 涉及 UI 模块 |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const s of stats) {
    lines.push(
      '| ' + s.id + ' | ' + cell(s.name) + ' | ' + cell(s.chapter) +
        ' | ' + s.featureCount + ' | ' + s.atomCount +
        ' | ' + s.confirmed + ' | ' + s.partial + ' | ' + s.notFound +
        ' | ' + cell(s.messages.join('、')) + ' | ' + cell(s.uiModules.join('、')) + ' |'
    )
  }
  lines.push(
    '| **合计** | | | **' + total.f + '** | **' + total.a + '** | **' + total.c + '** | **' +
      total.p + '** | **' + total.n + '** | | |'
  )
  lines.push('')
  fs.writeFileSync(path.join(specDir, 'stage_manifest.md'), lines.join('\n') + '\n', 'utf8')

  const summary = {
    specDir: specDir,
    stageCount: stages.length,
    featureCount: features.length,
    atomCount: atomIds.size,
    confirmed: total.c,
    partial: total.p,
    notFound: total.n,
    differenceStats: diffStats,
    differenceUnmarked: diffUnmarked,
  }
  console.log(
    '[成功] feature_index.json：' + stages.length + ' 阶段 / ' + features.length + ' 功能点 / ' + atomIds.size + ' 原子项'
  )
  console.log(
    '[成功] stage_manifest.md：' + stats.length + ' 行阶段表（confirmed ' + total.c + ' / partial ' + total.p + ' / not_found ' + total.n + '）'
  )
  console.log('SUMMARY ' + JSON.stringify(summary))
  return { ok: true, problems: [], summary: summary }
}

// CLI 直调守卫（被 import 时不执行，见 dev-docs/experience/workflow扫描agent全量转述超时-确定性扫描替代.md）
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  const [specDir, date, sourceDesc, expectedStageCount] = process.argv.slice(2)
  if (!specDir) {
    console.error('用法: node assemble-output-spec-index.mjs <specDir> <date> <sourceDesc> [expectedStageCount]')
    process.exit(1)
  }
  const r = assembleIndex(specDir, date, sourceDesc, expectedStageCount)
  process.exit(r.ok ? 0 : 1)
}
