// ============================================================
// stage-reuse.mjs —— Stage Reuse 最小实现（执行文档 §11/§12.4，第一阶段）
//
// 全部确定性脚本（agent 零参与：指纹采集 / 依赖图 / Reuse Resolver / strict 校验）。
// 消费 stage-specs.game-requirement-audit.json（指纹规格单一事实源，D38）。
//
// 四命令（CLI，均从仓库根运行）：
//   init-run <date> [--specs <path>]
//     建 runs/run-NNN（NNN = 现有最大 +1）+ runtime/stage-manifest.json 骨架
//     + 更新 latest.json（date 级指针）；打印 [成功] runId=run-NNN
//   record-stage <date> <runId> <stageId> [--args-file <path>] [--config-args k=v,...] [--profile k=v,...] [--specs <path>]
//     阶段闸门通过后由主编排调用：按 specs 解析文件 -> 算四指纹 -> 写 manifest 条目
//     --args-file：JSON {configArgs:{...}, profile:{...}}（中文值必经此文件传递，CLI 不进 shell；
//     沿用 output-spec-generate build-config.json 先例）；--config-args/--profile 仅跟 ASCII 调试用
//   prepare-from-stage <date> --source-run <id> --target-run <id> --start-stage <Sx>
//     [--plan-only] [--args-file <path>] [--config-args k=v,...] [--specs <path>]
//     strict 复用：对 order < startStage 的阶段逐一四指纹校验（§11.3 矩阵）；
//     全过 -> 物化复制产物到目标 Run + 记 reuse.sourceRunId/artifactRefs（D37）；
//     任一不匹配 -> fail fast 拒绝复用（明细打印）；
//     --plan-only 只写 <targetRun>/runtime/reuse-plan.json 不复制
//   verify-immutable <date> <runId> [--specs <path>]
//     逐阶段重算 outputHash vs 记录值（不可变产物验证，§11.9 ⑤ / G09）
//
// 指纹口径（§12.4，全部确定性）：
//   inputHash           specs.inputFiles 解析（run: -> run 根；proj:/arg: -> 仓库根），
//                       记录路径码元序排列，逐文件 sha256 后 [[path, hash], ...] 序列化再哈希
//   configHash          specs.configFiles（当前内容）+ configArgs 键值
//                       按 {files:[...], args:{...}}（键排序）序列化哈希
//   executionProfileHash --profile 键值哈希；不参与 Reusable 强校验（§11.3）
//   outputHash          specs.outputFiles glob 展开（run 根相对码元序）同 inputHash 口径
//   stageVersion        specs.version 字面值
//
// 退出码：0 成功 / 1 失败（fail fast 明细 [失败] 前缀打印）
// ============================================================

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const REPO_ROOT = process.cwd()

// ---- 基础工具 ----

function sha256Hex(buf) {
  return 'sha256:' + crypto.createHash('sha256').update(buf).digest('hex')
}

function sha256Str(s) {
  return 'sha256:' + crypto.createHash('sha256').update(s, 'utf8').digest('hex')
}

function readJsonSafe(p) {
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(p, 'utf8')) }
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) }
  }
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(data, null, 1) + '\n', 'utf8')
}

function toPosix(p) {
  return p.replaceAll('\\', '/')
}

function fail(msg) {
  console.log('[失败] ' + msg)
  process.exit(1)
}

// ---- specs 加载与路径解析 ----

function loadSpecs(specsPath) {
  const p = path.resolve(REPO_ROOT, specsPath || '.opencode-workflows/scripts/stage-specs.game-requirement-audit.json')
  const r = readJsonSafe(p)
  if (!r.ok) fail('stage-specs 不可读：' + p + ' -> ' + r.error)
  const specs = r.data
  if (specs.schemaVersion !== 1 || !specs.stages) fail('stage-specs 结构非法：' + p)
  return { specs, specsPath: toPosix(p) }
}

function runsDirOf(specs, date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('date 非法（YYYY-MM-DD）：' + date)
  return path.resolve(REPO_ROOT, specs.rootDir, date, 'runs')
}

function runDirOf(specs, date, runId) {
  if (!/^run-\d{3}$/.test(runId)) fail('runId 非法（run-NNN）：' + runId)
  return path.join(runsDirOf(specs, date), runId)
}

function manifestPathOf(runDir) {
  return path.join(runDir, 'runtime', 'stage-manifest.json')
}

// 解析一个 spec 路径串（返回 null 表示该串应在 resolve 阶段报错）
//   run:<rel>  -> run 根相对（rel 支持 *.json 尾 glob）
//   proj:<rel> -> 仓库根相对
//   arg:<key>  -> 取 args[key] 作 proj: 路径（缺 key 报错）
// resolveDir：run: 路径的基准（复用校验 = 来源 runDir；record = 目标 runDir）
function resolveSpecEntry(entry, argsMap, resolveDir) {
  const kind = entry.slice(0, entry.indexOf(':') + 1)
  const rel = entry.slice(kind.length)
  if (kind === 'run:') {
    const abs = path.join(resolveDir, rel)
    if (rel.endsWith('/*.json')) {
      const dir = abs.slice(0, -'/*.json'.length)
      let names = []
      try {
        names = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
      } catch (e) {
        return { error: 'run: 目录不可读：' + entry + ' -> ' + String(e.message || e) }
      }
      if (names.length === 0) return { error: 'run: glob 展开为空：' + entry }
      // 记录路径保持 run: 前缀（run 根相对），排序用码元序
      return { files: names.map((n) => ({ record: 'run:' + rel.slice(0, -'*.json'.length) + n, abs: path.join(dir, n) })) }
    }
    if (!fs.existsSync(abs)) return { error: 'run: 文件不存在：' + entry }
    return { files: [{ record: entry, abs }] }
  }
  if (kind === 'proj:') {
    const abs = path.resolve(REPO_ROOT, rel)
    if (!fs.existsSync(abs)) return { error: 'proj: 文件不存在：' + entry }
    return { files: [{ record: entry, abs }] }
  }
  if (kind === 'arg:') {
    const v = argsMap ? argsMap[entry.slice(4)] : undefined
    if (v === undefined || v === '') return { error: 'arg: 值缺失（--config-args ' + entry.slice(4) + '=...）：' + entry }
    const abs = path.resolve(REPO_ROOT, v)
    if (!fs.existsSync(abs)) return { error: 'arg: 文件不存在：' + entry + ' -> ' + v }
    return { files: [{ record: 'proj:' + toPosix(path.relative(REPO_ROOT, abs)), abs }] }
  }
  return { error: 'spec 路径前缀非法（run:/proj:/arg:）：' + entry }
}

function resolveSpecList(entries, argsMap, resolveDir) {
  const files = []
  for (const e of entries || []) {
    const r = resolveSpecEntry(e, argsMap, resolveDir)
    if (r.error) return { error: r.error }
    files.push(...r.files)
  }
  // 记录路径码元序（M7：默认 sort 即 UTF-16 码元序，禁 localeCompare）
  files.sort((a, b) => (a.record < b.record ? -1 : a.record > b.record ? 1 : 0))
  return { files }
}

// ---- 指纹计算 ----

function hashFileList(files) {
  // files: [{record, abs}]，已按 record 码元序
  const pairs = files.map((f) => {
    const buf = fs.readFileSync(f.abs)
    return [f.record, sha256Hex(buf)]
  })
  return { hash: sha256Str(JSON.stringify(pairs)), list: pairs }
}

function hashConfig(spec, argsMap) {
  const filePairs = []
  for (const e of spec.configFiles || []) {
    const r = resolveSpecEntry(e, argsMap, null)
    if (r.error) return { error: r.error }
    for (const f of r.files) filePairs.push([f.record, sha256Hex(fs.readFileSync(f.abs))])
  }
  filePairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  const args = {}
  for (const k of spec.configArgs || []) {
    const v = argsMap ? argsMap[k] : undefined
    if (v === undefined || v === '') return { error: 'configArgs 缺值：' + k + '（--config-args ' + k + '=...）' }
    args[k] = sha256Str(String(v))
  }
  return { hash: sha256Str(JSON.stringify({ files: filePairs, args: Object.keys(args).sort().reduce((m, k) => ((m[k] = args[k]), m), {}) })) }
}

function hashProfile(profileMap) {
  const keys = Object.keys(profileMap).sort()
  return sha256Str(JSON.stringify(keys.map((k) => [k, String(profileMap[k])])))
}

// ---- CLI 参数 ----

function parseKv(csv) {
  const m = {}
  for (const part of String(csv || '').split(',')) {
    const t = part.trim()
    if (!t) continue
    const i = t.indexOf('=')
    if (i <= 0) fail('--config-args/--profile 键值格式非法（k=v,...）：' + t)
    m[t.slice(0, i)] = t.slice(i + 1)
  }
  return m
}

// args-file（中文值不进 shell：configArgs/profile 经 runtime JSON 文件传递，沿用 build-config.json 先例）
function readArgsFile(p) {
  const r = readJsonSafe(p)
  if (!r.ok) fail('args-file 不可读：' + p + ' -> ' + r.error)
  const d = r.data
  if (typeof d !== 'object' || d === null || Array.isArray(d)) fail('args-file 结构非法（期望 {configArgs:{}, profile:{}}）：' + p)
  for (const k of ['configArgs', 'profile']) {
    const v = d[k]
    if (v === undefined) continue
    if (typeof v !== 'object' || v === null || Array.isArray(v)) {
      fail('args-file 结构非法：' + k + ' 必须是对象（k -> v 映射）' + p)
    }
  }
  return { configArgs: d.configArgs || {}, profile: d.profile || {} }
}

// ============================================================
// init-run <date> [--specs <path>]
// ============================================================

function cmdInitRun(a) {
  const { specs } = loadSpecs(a.specs)
  const runsDir = runsDirOf(specs, a.date)
  fs.mkdirSync(runsDir, { recursive: true })
  let max = 0
  for (const name of fs.readdirSync(runsDir)) {
    const m = /^run-(\d{3})$/.exec(name)
    if (m) max = Math.max(max, Number(m[1]))
  }
  const runId = 'run-' + String(max + 1).padStart(3, '0')
  const runDir = path.join(runsDir, runId)
  fs.mkdirSync(path.join(runDir, 'runtime'), { recursive: true })
  writeJson(manifestPathOf(runDir), { schemaVersion: 1, runId, sourceRunId: null, stages: {} })
  writeJson(path.join(runsDir, 'latest.json'), { schemaVersion: 1, date: a.date, runId })
  console.log('[成功] init-run：' + toPosix(path.relative(REPO_ROOT, runDir)) + '（latest.json -> ' + runId + '）')
}

// ============================================================
// record-stage <date> <runId> <stageId> [--config-args] [--profile] [--specs]
// ============================================================

function cmdRecordStage(a) {
  const { specs } = loadSpecs(a.specs)
  const spec = specs.stages[a.stageId]
  if (!spec) fail('stageId 不在 specs：' + a.stageId)
  const runDir = runDirOf(specs, a.date, a.runId)
  const manifestP = manifestPathOf(runDir)
  const mRead = readJsonSafe(manifestP)
  if (!mRead.ok) fail('stage-manifest 不可读（先 init-run）：' + manifestP + ' -> ' + mRead.error)

  const argsMap = a.argsFile ? readArgsFile(a.argsFile).configArgs : parseKv(a.configArgs)
  const profileMap = a.argsFile ? readArgsFile(a.argsFile).profile : parseKv(a.profile)

  const inputR = resolveSpecList(spec.inputFiles, argsMap, runDir)
  if (inputR.error) fail('inputHash 解析失败（' + a.stageId + '）：' + inputR.error)
  const input = hashFileList(inputR.files)

  const configR = hashConfig(spec, argsMap)
  if (configR.error) fail('configHash 解析失败（' + a.stageId + '）：' + configR.error)

  const outputR = resolveSpecList(spec.outputFiles, argsMap, runDir)
  if (outputR.error) fail('outputHash 解析失败（' + a.stageId + '）：' + outputR.error)
  const output = hashFileList(outputR.files)

  const manifest = mRead.data
  manifest.stages[a.stageId] = {
    status: 'completed',
    stageVersion: spec.version,
    inputHash: input.hash,
    configHash: configR.hash,
    executionProfileHash: hashProfile(profileMap),
    outputHash: output.hash,
    reusable: true,
    inputFiles: spec.inputFiles,
    configArgs: argsMap,
    profile: profileMap,
    // outputList 统一 {path, hash}（path = run 根相对；供 verify-immutable/artifactRefs 同构消费）
    outputList: output.list.map(([record, hash]) => ({
      path: record.startsWith('run:') ? record.slice(4) : record,
      hash,
    })),
  }
  writeJson(manifestP, manifest)
  console.log(
    '[成功] record-stage ' + a.stageId + '（' + spec.version + '）指纹落档：input ' + input.hash.slice(0, 20) +
      '… / config ' + configR.hash.slice(0, 20) + '… / output ' + output.hash.slice(0, 20) +
      '…（' + output.list.length + ' 个产物）-> ' + toPosix(path.relative(REPO_ROOT, manifestP))
  )
}

// ============================================================
// prepare-from-stage（strict 复用校验 + 物化复制）
// ============================================================

function checkStageStrict(specs, stageId, sourceRunDir, newArgsMap) {
  const problems = []
  const specStage = specs.stages[stageId]
  if (!specStage) return { problems: ['阶段不在 specs：' + stageId] }

  const mRead = readJsonSafe(manifestPathOf(sourceRunDir))
  if (!mRead.ok) return { problems: ['来源 run stage-manifest 不可读：' + manifestPathOf(sourceRunDir)] }
  const rec = mRead.data.stages && mRead.data.stages[stageId]
  if (!rec) return { problems: ['来源 run 缺阶段 ' + stageId + ' 记录（未执行过）'] }
  if (rec.status !== 'completed') return { problems: ['来源阶段未完成：' + stageId + ' status=' + rec.status] }

  // 1. stageVersion：记录值 vs specs 当前值
  if (rec.stageVersion !== specStage.version) {
    problems.push('stageVersion 不匹配：来源记录 ' + rec.stageVersion + ' vs 当前 specs ' + specStage.version + '（实现版本已变，' + stageId + ' 不可复用）')
  }

  // 2. configHash：当前脚本文件 + 新 Run configArgs 重算 vs 记录值
  const configR = hashConfig(specStage, newArgsMap)
  if (configR.error) {
    problems.push('configHash 重算失败（' + stageId + '）：' + configR.error)
  } else if (configR.hash !== rec.configHash) {
    // 区分脚本变化与参数变化，便于定位
    const argsChanged = JSON.stringify(rec.configArgs || {}) !== JSON.stringify(newArgsMap)
    problems.push(
      'configHash 不匹配（' + stageId + '）：' +
        (argsChanged
          ? 'configArgs 已变（来源 ' + JSON.stringify(rec.configArgs || {}) + ' vs 新 ' + JSON.stringify(newArgsMap) + '）'
          : '阶段脚本/逻辑已变（脚本文件内容与记录时不一致）') +
        '，不可复用'
    )
  }

  // 3. inputHash：当前输入状态重算（run: 取来源 Run 实物；proj:/arg: 取当前仓库/新 Run 参数）
  const inputR = resolveSpecList(specStage.inputFiles, newArgsMap, sourceRunDir)
  if (inputR.error) {
    problems.push('inputHash 重算失败（' + stageId + '）：' + inputR.error)
  } else {
    const inputH = hashFileList(inputR.files)
    if (inputH.hash !== rec.inputHash) {
      problems.push('inputHash 不匹配（' + stageId + '）：上游输入已变（模板/上游产物内容与记录时不一致），不可复用')
    }
  }

  // 4. outputHash：来源 Run 实物重算 vs 记录值（篡改检测）
  const outputR = resolveSpecList(specStage.outputFiles, newArgsMap, sourceRunDir)
  if (outputR.error) {
    problems.push('outputHash 重算失败（' + stageId + '）：' + outputR.error)
  } else {
    const outputH = hashFileList(outputR.files)
    if (outputH.hash !== rec.outputHash) {
      problems.push('outputHash 不匹配（' + stageId + '）：来源 Run 产物与记录指纹不一致（疑似篡改），拒绝复用')
    }
  }

  return { problems, rec }
}

function cmdPrepareFromStage(a) {
  const { specs } = loadSpecs(a.specs)
  const startSpec = specs.stages[a.startStage]
  if (!startSpec) fail('startStage 不在 specs：' + a.startStage)
  const sourceRunDir = runDirOf(specs, a.date, a.sourceRun)
  const targetRunDir = runDirOf(specs, a.date, a.targetRun)
  if (!fs.existsSync(sourceRunDir)) fail('来源 run 不存在：' + toPosix(path.relative(REPO_ROOT, sourceRunDir)))
  if (!fs.existsSync(targetRunDir)) fail('目标 run 不存在（先 init-run）：' + toPosix(path.relative(REPO_ROOT, targetRunDir)))

  const newArgsMap = a.argsFile ? readArgsFile(a.argsFile).configArgs : parseKv(a.configArgs)

  // 复用阶段 = order < startStage.order；startStage 及下游不校验旧指纹（计划内重跑）
  const reused = []
  const rerun = []
  for (const [stageId, spec] of Object.entries(specs.stages)) {
    ;(spec.order < startSpec.order ? reused : rerun).push(stageId)
  }
  reused.sort((x, y) => specs.stages[x].order - specs.stages[y].order)
  rerun.sort((x, y) => specs.stages[x].order - specs.stages[y].order)

  // strict 逐一校验（§11.3 矩阵；任一失败 fail fast）
  const checks = []
  const allProblems = []
  const reuseEntries = []
  for (const stageId of reused) {
    const { problems, rec } = checkStageStrict(specs, stageId, sourceRunDir, newArgsMap)
    const ok = problems.length === 0
    if (ok) {
      const outputR = resolveSpecList(specs.stages[stageId].outputFiles, newArgsMap, sourceRunDir)
      const outputH = hashFileList(outputR.files)
      reuseEntries.push({ stageId, rec, output: outputH })
      checks.push({
        stageId,
        check: 'pass',
        stageVersion: specs.stages[stageId].version,
        inputHash: rec.inputHash,
        configHash: rec.configHash,
        outputHash: rec.outputHash,
      })
    } else {
      checks.push({ stageId, check: 'fail', problems })
      allProblems.push(...problems.map((p) => stageId + ': ' + p))
    }
  }
  if (allProblems.length > 0) {
    console.log('[失败] strict 复用校验未通过（拒绝复用，fail fast），共 ' + allProblems.length + ' 项问题：')
    for (const p of allProblems) console.log('  - ' + p)
    process.exit(1)
  }

  // 计划产物（plan-only 与执行模式都写，供 read-back 与留档）
  const plan = {
    schemaVersion: 1,
    generatedBy: 'stage-reuse.mjs prepare-from-stage',
    date: a.date,
    sourceRunId: a.sourceRun,
    targetRunId: a.targetRun,
    startStage: a.startStage,
    reusedStages: reused,
    rerunStages: rerun,
    checks,
  }
  const planPath = path.join(targetRunDir, 'runtime', 'reuse-plan.json')
  writeJson(planPath, plan)

  if (a.planOnly) {
    console.log(
      '[成功] plan-only：复用 ' + (reused.length ? reused.join(',') : '（无）') + ' / 重跑 ' + rerun.join(',') +
        ' -> ' + toPosix(path.relative(REPO_ROOT, planPath))
    )
    process.exit(0)
  }

  // 物化复制（D37：逐字节 + 双侧 hash 校验；来源 Run 零写入）
  const targetManifestP = manifestPathOf(targetRunDir)
  const tmRead = readJsonSafe(targetManifestP)
  if (!tmRead.ok) fail('目标 run stage-manifest 不可读：' + targetManifestP)
  const tm = tmRead.data
  tm.sourceRunId = a.sourceRun
  for (const { stageId, rec, output } of reuseEntries) {
    const copied = []
    for (const [recordPath, hash] of output.list) {
      const rel = recordPath.startsWith('run:') ? recordPath.slice(4) : recordPath
      const src = path.join(sourceRunDir, rel)
      const dst = path.join(targetRunDir, rel)
      // 复制前再校来源 hash（防 TOCTOU 竞态期间篡改）
      if (sha256Hex(fs.readFileSync(src)) !== hash) {
        fail('物化复制中止：来源产物在复制期间被篡改 ' + stageId + ' ' + recordPath)
      }
      fs.mkdirSync(path.dirname(dst), { recursive: true })
      fs.copyFileSync(src, dst)
      if (sha256Hex(fs.readFileSync(dst)) !== hash) {
        fail('物化复制中止：目标写入校验失败 ' + stageId + ' ' + recordPath)
      }
      copied.push({ path: rel, hash })
    }
    tm.stages[stageId] = {
      status: 'completed',
      stageVersion: rec.stageVersion,
      inputHash: rec.inputHash,
      configHash: rec.configHash,
      executionProfileHash: rec.executionProfileHash,
      outputHash: rec.outputHash,
      reusable: true,
      inputFiles: rec.inputFiles,
      configArgs: rec.configArgs,
      profile: rec.profile || {},
      outputList: copied,
      reuse: { sourceRunId: a.sourceRun, artifactRefs: copied },
    }
  }
  writeJson(targetManifestP, tm)
  const copiedCount = reuseEntries.reduce((n, e) => n + e.output.list.length, 0)
  console.log(
    '[成功] prepare-from-stage：复用 ' + (reused.length ? reused.join(',') : '（无）') + '（物化 ' + copiedCount +
      ' 个产物，来源 ' + a.sourceRun + ' 零写入）/ 重跑 ' + rerun.join(',') + ' -> ' + toPosix(path.relative(REPO_ROOT, targetRunDir))
  )
}

// ============================================================
// verify-immutable <date> <runId> [--specs <path>]
// ============================================================

function cmdVerifyImmutable(a) {
  const { specs } = loadSpecs(a.specs)
  const runDir = runDirOf(specs, a.date, a.runId)
  const mRead = readJsonSafe(manifestPathOf(runDir))
  if (!mRead.ok) fail('stage-manifest 不可读：' + manifestPathOf(runDir) + ' -> ' + mRead.error)
  const manifest = mRead.data
  const stageIds = Object.keys(manifest.stages || {}).sort()
  if (stageIds.length === 0) fail('stage-manifest 无阶段记录（未执行任何阶段）')
  const problems = []
  let fileCount = 0
  for (const stageId of stageIds) {
    const rec = manifest.stages[stageId]
    const spec = specs.stages[stageId]
    if (!spec) {
      problems.push('manifest 阶段不在 specs（specs 变更后遗留）：' + stageId)
      continue
    }
    // 记录 outputList 逐文件重算（{path, hash} 对象，path = run 根相对）
    const list = rec.outputList || (rec.reuse && rec.reuse.artifactRefs) || []
    if (!Array.isArray(list) || list.length === 0) {
      problems.push('阶段无 outputList/artifactRefs 记录：' + stageId)
      continue
    }
    const pairs = []
    for (const item of list) {
      const rel = item.path
      const abs = path.join(runDir, rel)
      if (!fs.existsSync(abs)) {
        problems.push('产物缺失：' + stageId + ' ' + rel)
        continue
      }
      const h = sha256Hex(fs.readFileSync(abs))
      if (h !== item.hash) problems.push('产物 hash 不一致（疑似篡改）：' + stageId + ' ' + rel)
      pairs.push(['run:' + rel, h])
      fileCount++
    }
    const outputH = sha256Str(JSON.stringify(pairs))
    if (outputH !== rec.outputHash) problems.push('阶段 outputHash 与实物不一致：' + stageId)
  }
  if (problems.length > 0) {
    console.log('[失败] 不可变产物校验未通过，共 ' + problems.length + ' 项问题：')
    for (const p of problems) console.log('  - ' + p)
    process.exit(1)
  }
  console.log('[成功] verify-immutable：' + a.runId + ' 全部 ' + stageIds.length + ' 阶段 / ' + fileCount + ' 个产物 hash 逐字节一致（不可变产物完好）')
}

// ============================================================
// CLI 分发
// ============================================================

function parseArgs(argv) {
  const a = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]
    if (t === '--specs') a.specs = argv[++i]
    else if (t === '--args-file') a.argsFile = argv[++i]
    else if (t === '--config-args') a.configArgs = argv[++i]
    else if (t === '--profile') a.profile = argv[++i]
    else if (t === '--plan-only') a.planOnly = true
    else if (t === '--source-run') a.sourceRun = argv[++i]
    else if (t === '--target-run') a.targetRun = argv[++i]
    else if (t === '--start-stage') a.startStage = argv[++i]
    else if (t.startsWith('--')) fail('未知参数：' + t)
    else a._.push(t)
  }
  return a
}

function cliMain(argv) {
  const a = parseArgs(argv)
  const cmd = a._[0]
  if (cmd === 'init-run') {
    if (!a._[1]) fail('用法：stage-reuse.mjs init-run <date>')
    a.date = a._[1]
    return cmdInitRun(a)
  }
  if (cmd === 'record-stage') {
    // record-stage <date> <runId> <stageId>
    if (a._.length < 4) fail('用法：stage-reuse.mjs record-stage <date> <runId> <stageId> [--args-file <path>] [--config-args k=v,...] [--profile k=v,...]')
    a.date = a._[1]
    a.runId = a._[2]
    a.stageId = a._[3]
    return cmdRecordStage(a)
  }
  if (cmd === 'prepare-from-stage') {
    if (a._.length < 2 || !a.sourceRun || !a.targetRun || !a.startStage) {
      fail('用法：stage-reuse.mjs prepare-from-stage <date> --source-run <id> --target-run <id> --start-stage <Sx> [--plan-only] [--args-file <path>] [--config-args k=v,...]')
    }
    a.date = a._[1]
    return cmdPrepareFromStage(a)
  }
  if (cmd === 'verify-immutable') {
    if (a._.length < 3) fail('用法：stage-reuse.mjs verify-immutable <date> <runId>')
    a.date = a._[1]
    a.runId = a._[2]
    return cmdVerifyImmutable(a)
  }
  console.error('用法：')
  console.error('  node stage-reuse.mjs init-run <date> [--specs <path>]')
  console.error('  node stage-reuse.mjs record-stage <date> <runId> <stageId> [--args-file <path>] [--config-args k=v,...] [--profile k=v,...] [--specs <path>]')
  console.error('  node stage-reuse.mjs prepare-from-stage <date> --source-run <id> --target-run <id> --start-stage <Sx> [--plan-only] [--args-file <path>] [--config-args k=v,...] [--specs <path>]')
  console.error('  node stage-reuse.mjs verify-immutable <date> <runId> [--specs <path>]')
  process.exit(1)
}

const invokedAs = process.argv[1] && process.argv[1].replaceAll('\\', '/').endsWith('stage-reuse.mjs')
if (invokedAs) cliMain(process.argv.slice(2))
