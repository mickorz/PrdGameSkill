// ============================================================
// build-requirement-registry.mjs —— S3 注册表定稿（确定性合并 + 全部闸门）
//
// 执行文档 §12.3（头部 §5 S3）。唯一写者：agent 零参与。
//   输入：<runDir>/1-registry/runtime/state/scan.json
//         <runDir>/1-registry/runtime/atom-parts/*.json（按文件名码元序读取，M1/M7：
//         默认 Array.prototype.sort() 即 UTF-16 码元序，禁 localeCompare）
//   校验（全部 fail-fast，退出码 1 不写产物）：
//     1. 分片名/内部 stageId/schemaVersion/partNo；
//     2. 全覆盖：scan.stageSections 每阶段恰一片，无缺片无多余片；
//     3. 分片头 stage 字段归一（name←scan.title、chapter←scan.sourceTitle、summary 空串）；
//     4. FP/AT ID 规范（^FP/^AT-ST-C\d\d-\d{3}$）+ 阶段匹配 + 全局唯一；
//     5. 每功能点 ≥1 原子、rule 非空；
//     6. verificationScope 枚举合法（缺失按 both 归一——头部 S2 闸门口径）；
//     7. 行号落界：stage.fromLine ≤ source.fromLine ≤ source.toLine ≤ stage.toLine；
//     8. 统计重算（不信任 agent 摘要，坑 6 口径）。
//   产物（full 模式）：
//     <runDir>/1-registry/requirement-registry.json（核心契约 #1：唯一需求事实源；
//       features/atoms 顺序 = 分片码元序 -> 功能点序 -> 原子序 = Registry 全序）
//     <runDir>/1-registry/identity-map.json（terms 确定性解析名词章节，D39；
//       stageChapters 由 scan 派生：chapter=章节路径、sourceTitle=章节标题）
//
// 可导入：export buildRequirementRegistry({ runDir, date })
//   返回 { ok, problems, summary, registry, identityMap }
//   summary = { stageCount, featureTotal, atomTotal, scopeStats, perStage }
//
// CLI：node build-requirement-registry.mjs --run-dir <dir> --date <YYYY-MM-DD> [--validate-only] [--recount-out <path>]
//   --validate-only：只跑校验 + 写重算摘要（S2 结构闸门复用，D40），不写正式产物
//   退出码：0 成功 / 1 校验失败或参数缺失（明细打印 [失败] 前缀）
//
// stageVersion：S3@1（specs：stage-specs.game-requirement-audit.json；语义变化时递增）
// ============================================================

import fs from 'node:fs'
import path from 'node:path'

const SCOPE_VALUES = ['client', 'server', 'both']
const SHARD_NAME_RE = /^(ST-C\d{2})-ap\d{2}\.json$/
const FP_RE = /^FP-(ST-C\d{2})-(\d{3})$/
const AT_RE = /^AT-(ST-C\d{2})-(\d{3})$/

function readJsonSafe(p) {
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(p, 'utf8')) }
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) }
  }
}

function isInt(v) {
  return Number.isInteger(v)
}

// 名词章节确定性解析（D39：行格式 `- **术语**：定义`；解析为空不 fail）
function parseTerms(templatePath, termsSection) {
  if (!termsSection) return []
  try {
    const lines = fs.readFileSync(templatePath, 'utf8').split(/\r?\n/)
    const terms = []
    for (let i = termsSection.fromLine; i <= Math.min(termsSection.toLine, lines.length); i++) {
      const m = /^-\s+\*\*(.+?)\*\*[：:]\s*(.+)$/.exec(lines[i - 1] || '')
      if (m) terms.push({ term: m[1], definition: m[2].trim(), source: '模板名词章节' })
    }
    return terms
  } catch {
    return []
  }
}

// ============================================================
// 核心合并与校验
// ============================================================

export function buildRequirementRegistry({ runDir, date }) {
  const problems = []
  const scanPath = path.join(runDir, '1-registry', 'runtime', 'state', 'scan.json')
  const partsDir = path.join(runDir, '1-registry', 'runtime', 'atom-parts')

  const scanRead = readJsonSafe(scanPath)
  if (!scanRead.ok) {
    return { ok: false, problems: ['scan.json 不可读：' + scanPath + ' -> ' + scanRead.error], summary: null, registry: null, identityMap: null }
  }
  const scan = scanRead.data
  const scanSections = Array.isArray(scan.sections) ? scan.sections : null
  if (!scanSections || !isInt(scan.totalLines)) {
    return { ok: false, problems: ['scan.json 缺 sections/totalLines：' + scanPath], summary: null, registry: null, identityMap: null }
  }
  const stageSections = scanSections.filter((s) => s.kind === 'stage')
  const termsSection = scanSections.find((s) => s.kind === 'terms') || null
  if (stageSections.length === 0) {
    return { ok: false, problems: ['scan.json 无 stage 章节（S1 产物异常）'], summary: null, registry: null, identityMap: null }
  }

  // 分片归集：目录清单按码元序（默认 sort 即 UTF-16 码元序）
  let partNames = []
  try {
    partNames = fs.readdirSync(partsDir).filter((f) => f.endsWith('.json')).sort()
  } catch (e) {
    return { ok: false, problems: ['atom-parts 目录不可读：' + partsDir + ' -> ' + String(e.message || e)], summary: null, registry: null, identityMap: null }
  }
  if (partNames.length === 0) {
    return { ok: false, problems: ['atom-parts 目录为空（S2 分片未落盘）'], summary: null, registry: null, identityMap: null }
  }

  // 全覆盖：scan 每阶段恰一片、片名 stageId 必须是 scan 阶段
  const scanStageById = new Map(stageSections.map((s) => [s.stageId, s]))
  const shardByStage = new Map()
  for (const name of partNames) {
    const m = SHARD_NAME_RE.exec(name)
    if (!m) {
      problems.push('分片文件名非法（期望 <stageId>-ap<NN>.json）：' + name)
      continue
    }
    const stageId = m[1]
    if (!scanStageById.has(stageId)) {
      problems.push('分片 stageId 不在 scan 阶段集（外来分片）：' + name)
      continue
    }
    if (shardByStage.has(stageId)) {
      problems.push('同阶段多分片（每阶段恰一片）：' + name + ' 与 ' + shardByStage.get(stageId))
      continue
    }
    shardByStage.set(stageId, name)
  }
  for (const s of stageSections) {
    if (!shardByStage.has(s.stageId)) {
      problems.push('scan 阶段缺分片：' + s.stageId + ' ' + s.title)
    }
  }
  if (problems.length > 0) {
    return { ok: false, problems, summary: null, registry: null, identityMap: null }
  }

  // 逐分片读取 + 校验 + 归一（Registry 全序 = 分片码元序）
  const stagesOut = []
  const featuresOut = []
  const perStage = []
  const seenFp = new Map()
  const seenAt = new Map()
  const scopeStats = { client: 0, server: 0, both: 0 }
  let featureTotal = 0
  let atomTotal = 0

  for (const s of stageSections) {
    const sec = s
    const shardName = shardByStage.get(s.stageId)
    const shardRead = readJsonSafe(path.join(partsDir, shardName))
    if (!shardRead.ok) {
      problems.push('分片不可读：' + shardName + ' -> ' + shardRead.error)
      continue
    }
    const shard = shardRead.data
    if (shard.schemaVersion !== 1) problems.push('分片 schemaVersion 非 1：' + shardName)
    if (shard.stageId !== s.stageId) problems.push('分片内部 stageId 与文件名不符：' + shardName + ' -> ' + String(shard.stageId))
    if (shard.partNo !== 1) problems.push('分片 partNo 非 1：' + shardName + ' -> ' + String(shard.partNo))
    if (!Array.isArray(shard.features) || shard.features.length === 0) {
      problems.push('分片无功能点（features 为空）：' + shardName)
      continue
    }

    // 分片头归一（D36：name/chapter/summary 供 registry stages[]）
    const stageHead = shard.stage && typeof shard.stage === 'object' ? shard.stage : {}
    const stageOut = {
      stageId: s.stageId,
      name: String(stageHead.name || '') || sec.title,
      chapter: String(stageHead.chapter || '') || sec.sourceTitle || sec.title,
      summary: String(stageHead.summary || ''),
      featureCount: 0,
      atomCount: 0,
    }

    let stageAtoms = 0
    let stageScope = { client: 0, server: 0, both: 0 }
    for (const fe of shard.features) {
      const fpId = String(fe && fe.id || '')
      const fpMatch = FP_RE.exec(fpId)
      if (!fpMatch || fpMatch[1] !== s.stageId) {
        problems.push('功能点 ID 非法或不属于本阶段：' + shardName + ' -> ' + fpId)
        continue
      }
      if (seenFp.has(fpId)) {
        problems.push('功能点 ID 重复：' + fpId + '（' + shardName + ' 与 ' + seenFp.get(fpId) + '）')
        continue
      }
      seenFp.set(fpId, shardName)
      if (!Array.isArray(fe.atoms) || fe.atoms.length === 0) {
        problems.push('功能点无原子项：' + fpId + '（' + shardName + '）')
        continue
      }

      const atomsOut = []
      for (const at of fe.atoms) {
        const atomId = String(at && at.atomId || '')
        const atMatch = AT_RE.exec(atomId)
        if (!atMatch || atMatch[1] !== s.stageId) {
          problems.push('原子项 ID 非法或不属于本阶段：' + shardName + ' -> ' + atomId)
          continue
        }
        if (seenAt.has(atomId)) {
          problems.push('原子项 ID 重复：' + atomId + '（' + shardName + ' 与 ' + seenAt.get(atomId) + '）')
          continue
        }
        seenAt.set(atomId, shardName)

        const rule = String(at.rule || '')
        if (!rule.trim()) {
          problems.push('原子项 rule 为空：' + atomId + '（' + shardName + '）')
          continue
        }

        // verificationScope：缺失归一 both，非法值 fail
        let scope = at.verificationScope
        if (scope === undefined || scope === null || scope === '') scope = 'both'
        if (!SCOPE_VALUES.includes(scope)) {
          problems.push('verificationScope 非法枚举：' + atomId + ' -> ' + JSON.stringify(at.verificationScope))
          continue
        }

        // 行号落界（硬闸门）
        const src = at.source && typeof at.source === 'object' ? at.source : {}
        if (!isInt(src.fromLine) || !isInt(src.toLine) ||
            src.fromLine < sec.fromLine || src.toLine > sec.toLine || src.fromLine > src.toLine) {
          problems.push(
            '原子项 source 行号未落在阶段章节行段 [' + sec.fromLine + ', ' + sec.toLine + ']：' + atomId +
              ' -> [' + String(src.fromLine) + ', ' + String(src.toLine) + ']'
          )
          continue
        }

        // businessBehavior 四键归一（缺键补空串，不 fail）
        const bb = at.businessBehavior && typeof at.businessBehavior === 'object' ? at.businessBehavior : {}
        const atomOut = {
          atomId: atomId,
          name: String(at.name || ''),
          rule: rule,
          uiRequirement: String(at.uiRequirement || ''),
          verificationScope: scope,
          businessBehavior: {
            trigger: String(bb.trigger || ''),
            condition: String(bb.condition || ''),
            action: String(bb.action || ''),
            result: String(bb.result || ''),
          },
          source: {
            chapter: String(src.chapter || '') || sec.sourceTitle || sec.title,
            fromLine: src.fromLine,
            toLine: src.toLine,
          },
        }
        atomsOut.push(atomOut)
        stageScope[scope]++
        scopeStats[scope]++
        stageAtoms++
      }

      if (atomsOut.length === 0) {
        problems.push('功能点全部原子项校验失败：' + fpId + '（' + shardName + '）')
        continue
      }
      featuresOut.push({
        id: fpId,
        stageId: s.stageId,
        name: String(fe.name || ''),
        description: String(fe.description || ''),
        scope: String(fe.scope || ''),
        coordination: String(fe.coordination || ''),
        atoms: atomsOut,
      })
      stageOut.featureCount++
      featureTotal++
    }

    stageOut.atomCount = stageAtoms
    atomTotal += stageAtoms
    stagesOut.push(stageOut)
    perStage.push({
      stageId: s.stageId,
      features: stageOut.featureCount,
      atoms: stageAtoms,
      client: stageScope.client,
      server: stageScope.server,
      both: stageScope.both,
    })
  }

  const summary = {
    stageCount: stagesOut.length,
    featureTotal: featureTotal,
    atomTotal: atomTotal,
    scopeStats: { client: scopeStats.client, server: scopeStats.server, both: scopeStats.both },
    perStage: perStage,
  }

  if (problems.length > 0) {
    return { ok: false, problems, summary, registry: null, identityMap: null }
  }
  if (atomTotal === 0) {
    return { ok: false, problems: ['全部阶段原子数为 0（拆解结果异常）'], summary, registry: null, identityMap: null }
  }

  // ---- 校验全过：装配正式产物 ----
  const registry = {
    schemaVersion: 1,
    date: date,
    source: { templatePath: scan.templatePath, totalLines: scan.totalLines },
    stages: stagesOut,
    features: featuresOut,
    stats: {
      stageCount: stagesOut.length,
      featureCount: featureTotal,
      atomCount: atomTotal,
      perStage: perStage,
      scopeStats: { client: scopeStats.client, server: scopeStats.server, both: scopeStats.both },
    },
  }

  const identityMap = {
    schemaVersion: 1,
    terms: parseTerms(scan.templatePath, termsSection),
    stageChapters: stageSections.map((s) => ({
      stageId: s.stageId,
      chapter: s.sourceTitle || s.title,
      sourceTitle: s.title,
      fromLine: s.fromLine,
      toLine: s.toLine,
    })),
    crossCutting: [],
  }

  return { ok: true, problems: [], summary, registry, identityMap }
}

// ============================================================
// CLI
// ============================================================

function parseArgs(argv) {
  const a = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--run-dir') a.runDir = argv[++i]
    else if (argv[i] === '--date') a.date = argv[++i]
    else if (argv[i] === '--validate-only') a.validateOnly = true
    else if (argv[i] === '--recount-out') a.recountOut = argv[++i]
    else a._.push(argv[i])
  }
  return a
}

function cliMain(argv) {
  const a = parseArgs(argv)
  if (!a.runDir || !a.date || !/^\d{4}-\d{2}-\d{2}$/.test(a.date)) {
    console.error('用法：node build-requirement-registry.mjs --run-dir <dir> --date <YYYY-MM-DD> [--validate-only] [--recount-out <path>]')
    process.exit(1)
  }
  const r = buildRequirementRegistry({ runDir: a.runDir, date: a.date })
  if (!r.ok) {
    console.log('[失败] Registry 合并校验未通过，共 ' + r.problems.length + ' 项问题（不写产物）：')
    for (const p of r.problems) console.log('  - ' + p)
    process.exit(1)
  }

  // 重算摘要（validate-only 模式供 S2 闸门回读；full 模式可选）
  if (a.recountOut) {
    const payload = {
      schemaVersion: 1,
      generatedBy: 'build-requirement-registry.mjs',
      mode: a.validateOnly ? 'validate-only' : 'full',
      stageCount: r.summary.stageCount,
      featureTotal: r.summary.featureTotal,
      atomTotal: r.summary.atomTotal,
      scopeStats: r.summary.scopeStats,
      perStage: r.summary.perStage,
    }
    fs.mkdirSync(path.dirname(a.recountOut), { recursive: true })
    fs.writeFileSync(a.recountOut, JSON.stringify(payload, null, 1) + '\n', 'utf8')
  }

  if (a.validateOnly) {
    console.log(
      '[成功] validate-only 校验通过（不写正式产物）：阶段 ' + r.summary.stageCount +
        ' / 功能点 ' + r.summary.featureTotal + ' / 原子 ' + r.summary.atomTotal +
        '（scope：client ' + r.summary.scopeStats.client + ' / server ' + r.summary.scopeStats.server + ' / both ' + r.summary.scopeStats.both + '）'
    )
    process.exit(0)
  }

  const registryPath = path.join(a.runDir, '1-registry', 'requirement-registry.json')
  const identityMapPath = path.join(a.runDir, '1-registry', 'identity-map.json')
  const statsPath = path.join(a.runDir, '1-registry', 'runtime', 'registry-stats.json')
  fs.mkdirSync(path.dirname(registryPath), { recursive: true })
  fs.writeFileSync(registryPath, JSON.stringify(r.registry, null, 1) + '\n', 'utf8')
  fs.writeFileSync(identityMapPath, JSON.stringify(r.identityMap, null, 1) + '\n', 'utf8')
  // stats 回读辅助（小文件，供 S3 子流程 read-back；可重生成的 runtime 产物，不入 specs 指纹）
  fs.mkdirSync(path.dirname(statsPath), { recursive: true })
  fs.writeFileSync(statsPath, JSON.stringify(
    { schemaVersion: 1, generatedBy: 'build-requirement-registry.mjs',
      stageCount: r.summary.stageCount, featureCount: r.summary.featureTotal, atomCount: r.summary.atomTotal,
      scopeStats: r.summary.scopeStats, registryPath: registryPath.replaceAll('\\', '/'), identityMapPath: identityMapPath.replaceAll('\\', '/') },
    null, 1) + '\n', 'utf8')
  console.log(
    '[成功] Registry 定稿：阶段 ' + r.summary.stageCount + ' / 功能点 ' + r.summary.featureTotal +
      ' / 原子 ' + r.summary.atomTotal +
      '（scope：client ' + r.summary.scopeStats.client + ' / server ' + r.summary.scopeStats.server + ' / both ' + r.summary.scopeStats.both +
      '；terms ' + r.identityMap.terms.length + '）-> ' + registryPath + ' 与 ' + identityMapPath
  )
  process.exit(0)
}

if (process.argv[1] && process.argv[1].replaceAll('\\', '/').endsWith('build-requirement-registry.mjs')) {
  cliMain(process.argv.slice(2))
}
