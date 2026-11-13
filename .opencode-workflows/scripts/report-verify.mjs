#!/usr/bin/env node
// report-verify.mjs —— 三 Checker 验收机械核对（v4 阶段 8 固化）
// 用途：验收 run 产物与共享需求快照的契约核对，替代人工临时脚本。
//
// 用法：
//   node report-verify.mjs <共享快照目录> [选项]
//   选项：
//     --game <dir>   game run 快照目录（requirements-matrix.json + manifest.json）
//     --ui <dir>     UI 产物目录（report.json，issues[].requirementIds）
//     --bug <dir>    Bug 产物目录（bug-verdicts.json，verdicts[].requirementIds）
//     --identity-map <path>  附带核对 identity-map 未被 Checker 改写（对比 git 工作区：有未提交变更即 fail）
//   至少传一个维度目录；exit 0 全过 / 1 有失败项
//
// 核对项（全部机械可判定）：
//   1. 共享快照可读：requirements.json 非空 + manifest.extractionRunId 一致
//   2. game：matrix 的每个 requirementId ∈ 快照且 reqKey+title 完全一致（REQ ID 零漂移）；
//      manifest 记录 extractionRunId 与 requirementsSource=shared-snapshot
//   3. ui：issues[].requirementIds 每个都 ∈ 快照 ID 集（无漂移），统计关联率
//   4. bug：verdicts[].requirementIds 同上，统计 reqLinkRate
//   5. identity-map（可选）：git 工作区无未提交变更（Checker 不得写 map，单写者 requirements-build.mjs）

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

function argVal(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null
}

const snapDir = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null
const gameDir = argVal('--game')
const uiDir = argVal('--ui')
const bugDir = argVal('--bug')
const identityMap = argVal('--identity-map')

if (!snapDir) { console.error('[失败] 用法: report-verify.mjs <共享快照目录> [--game <dir>] [--ui <dir>] [--bug <dir>] [--identity-map <path>]'); process.exit(1) }
if (!gameDir && !uiDir && !bugDir && !identityMap) { console.error('[失败] 至少传一个核对维度：--game / --ui / --bug / --identity-map'); process.exit(1) }

function readJson(p, what) {
  if (!fs.existsSync(p)) throw new Error(what + ' 不存在: ' + p)
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

const failures = []
const sections = []

function section(name, fn) {
  try {
    const detail = fn()
    sections.push({ name, ok: true, ...detail })
  } catch (e) {
    sections.push({ name, ok: false, error: String(e && e.message ? e.message : e) })
    failures.push(name + ': ' + (e && e.message ? e.message : e))
  }
}

// ---------- 0. 共享快照 ----------
let snapReqs = null
let snapExtRunId = null
section('共享快照', () => {
  const reqs = readJson(path.join(snapDir, 'requirements.json'), '快照 requirements.json')
  const arr = Array.isArray(reqs) ? reqs : (reqs.requirements || [])
  if (!arr.length) throw new Error('快照 requirements 为空')
  const manifest = readJson(path.join(snapDir, 'manifest.json'), '快照 manifest.json')
  snapReqs = new Map(arr.map((r) => [r.requirementId, r]))
  snapExtRunId = manifest.extractionRunId || null
  if (!snapExtRunId) throw new Error('快照 manifest 缺 extractionRunId')
  return { total: arr.length, extractionRunId: snapExtRunId }
})

// ---------- 1. game：REQ ID 零漂移 + manifest 可追溯 ----------
if (gameDir) {
  section('game 零漂移', () => {
    const matrix = readJson(path.join(gameDir, 'requirements-matrix.json'), 'game requirements-matrix.json')
    const mReqs = matrix.requirements || []
    if (!mReqs.length) throw new Error('game matrix requirements 为空')
    const drift = []
    for (const r of mReqs) {
      const s = snapReqs.get(r.requirementId)
      if (!s) { drift.push(r.requirementId + ' 不在快照'); continue }
      if (r.reqKey !== s.reqKey) drift.push(r.requirementId + ' reqKey 不一致: ' + r.reqKey + ' != ' + s.reqKey)
      if (r.title !== s.title) drift.push(r.requirementId + ' title 不一致: ' + r.title + ' != ' + s.title)
    }
    if (drift.length) throw new Error('REQ ID 漂移 ' + drift.length + ' 条：' + drift.slice(0, 5).join('；'))
    const manifest = readJson(path.join(gameDir, 'manifest.json'), 'game manifest.json')
    if (manifest.extractionRunId !== snapExtRunId) {
      throw new Error('game manifest extractionRunId=' + manifest.extractionRunId + ' != 快照 ' + snapExtRunId)
    }
    if (manifest.requirementsSource !== 'shared-snapshot') {
      throw new Error('game manifest requirementsSource=' + manifest.requirementsSource + '，非 shared-snapshot')
    }
    return { requirements: mReqs.length, drift: 0 }
  })
}

// ---------- 2. ui：requirementIds 无漂移 + 关联率 ----------
if (uiDir) {
  section('ui 关联核对', () => {
    const report = readJson(path.join(uiDir, 'report.json'), 'ui report.json')
    const issues = (report.report && report.report.issues) || report.issues || []
    if (!issues.length) throw new Error('ui report 无 issues')
    const outOfSnap = []
    let linked = 0
    for (const it of issues) {
      const ids = it.requirementIds || []
      if (ids.length) linked++
      for (const id of ids) if (!snapReqs.has(id)) outOfSnap.push(it.id + ' -> ' + id)
    }
    if (outOfSnap.length) throw new Error('ui 引用快照外 REQ ' + outOfSnap.length + ' 条：' + outOfSnap.slice(0, 5).join('；'))
    return { issues: issues.length, linked, linkRate: +(linked / issues.length).toFixed(4) }
  })
}

// ---------- 3. bug：requirementIds 无漂移 + reqLinkRate ----------
if (bugDir) {
  section('bug 关联核对', () => {
    const v = readJson(path.join(bugDir, 'bug-verdicts.json'), 'bug bug-verdicts.json')
    const verdicts = v.verdicts || []
    if (!verdicts.length) throw new Error('bug-verdicts 无 verdicts')
    const outOfSnap = []
    let linked = 0
    for (const b of verdicts) {
      const ids = b.requirementIds || []
      if (ids.length) linked++
      for (const id of ids) if (!snapReqs.has(id)) outOfSnap.push(b.bugId + ' -> ' + id)
    }
    if (outOfSnap.length) throw new Error('bug 引用快照外 REQ ' + outOfSnap.length + ' 条：' + outOfSnap.slice(0, 5).join('；'))
    return { verdicts: verdicts.length, linked, reqLinkRate: +(linked / verdicts.length).toFixed(4) }
  })
}

// ---------- 4. identity-map 单写者契约（可选） ----------
if (identityMap) {
  section('identity-map 未改写', () => {
    if (!fs.existsSync(identityMap)) throw new Error('identity-map 不存在: ' + identityMap)
    // Checker 不得写 map：git 工作区中该文件有未提交变更即视为被 run 改写
    let status = ''
    try {
      status = execFileSync('git', ['status', '--porcelain', '--', identityMap], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    } catch {
      throw new Error('git status 执行失败（identity-map 须在仓库内才能核对）')
    }
    if (status.trim()) throw new Error('identity-map 有未提交变更（疑似被 Checker 改写）：' + status.trim())
    return { path: identityMap, clean: true }
  })
}

// ---------- 汇总 ----------
for (const s of sections) {
  if (s.ok) {
    console.log('[成功] ' + s.name + ' ' + JSON.stringify(Object.fromEntries(Object.entries(s).filter(([k]) => k !== 'name' && k !== 'ok'))))
  } else {
    console.error('[失败] ' + s.name + ' ' + s.error)
  }
}
if (failures.length) {
  console.error('[失败] report-verify 核对未通过（' + failures.length + ' 项）')
  process.exit(1)
}
console.log('[成功] report-verify 核对通过（' + sections.length + ' 项）')
