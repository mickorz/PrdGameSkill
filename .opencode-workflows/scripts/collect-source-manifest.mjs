// ============================================================
// collect-source-manifest.mjs —— S4/S5 源码版本清单确定性采集
//
// 执行文档 §5 S4/S5 产物 3、§7「源码版本采集」、D18/D22。
//   分支 merge 时运行：先归集 runtime 分片引用的全部文件（证据文件 + dependencyFiles 依赖文件），
//   再按 repoId 分仓读取 commit SHA、计算 contentHash；无 git 仓的目录 commit 记 unversioned。
//
// 铁律（§7）：agent 严禁执行 git 命令、严禁自填 SHA/hash —— 版本信息唯一来源是本脚本。
//   CLE/SVE 的 sourceRevision/contentHash/verifiedAt 与 dependencyFiles[].contentHash
//   由 merge-branch-evidence.mjs 按 **（repoId, file）联合匹配**回填（避免不同仓库相同相对路径匹配错误）。
//
// 归集口径：
//   - verify-output/*.json 分片里所有 evidence[] 条目的 file、dependencyFiles[].file；
//   - 已在正式产物内的既有证据文件（幂等重跑：正式产物引用但本轮分片未提及时也要覆盖）；
//   - 文件按 repoId 归仓：repoId 由 caller 的 repoMap 指定（rootDir 前缀 -> repoId），
//     前缀最长匹配优先；未匹配任一根的记 unmatched 问题（fail fast，不回退猜测）。
//
// 可导入：export collectSourceManifest({ branch, roots, repoMap, filePaths, date, gitCommitReader })
//   返回 { ok, problems, manifest, fileHashes }：
//     manifest   = 头部 §5 S4 产物 3 结构（repos[] 分仓，files[] 码元序）
//     fileHashes = Map "repoId\u0000file" -> { contentHash, sourceRevision, verifiedAt }
//                  （供 merge 回填，键用 \u0000 分隔避免路径含分隔符歧义）
//
// CLI：node collect-source-manifest.mjs --branch <client|server> --roots <r1,r2> --repo-ids <id1,id2>
//        --files <f1,f2,...|@files.txt> --date <YYYY-MM-DD> --out <path>
//        同 repoId 允许重复（多根同仓）：文件按 roots 顺序解析，manifest 仓条目合并为单条、repoRoot 取该 repoId 首根。
//   退出码：0 成功 / 1 失败（明细 [失败] 前缀）
//
// 约定：date 经参数传入；JSON 1 空格缩进 UTF-8 LF；路径统一 `/`；排序用码元序（M7）。
// ============================================================

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'

const KEY_SEP = '\u0000'

function sha256File(abs) {
  return 'sha256:' + crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex')
}

function toPosix(p) {
  return String(p).replaceAll('\\', '/')
}

// 码元序比较（M7：禁 localeCompare）
function cmpCodeUnit(a, b) {
  return a < b ? -1 : a > b ? 1 : 0
}

// 读 git 仓 HEAD commit；非 git 仓返回 unversioned（不报错——离线/导出目录是合法场景）
function readGitCommit(rootAbs) {
  try {
    const out = execFileSync('git', ['-C', rootAbs, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const sha = out.trim()
    return /^[0-9a-f]{7,40}$/.test(sha) ? sha : 'unversioned'
  } catch {
    return 'unversioned'
  }
}

// 文件归属与解析：
//   file 书写形式（两者皆可）：
//     1. `<repoId>:<relPath>` —— 显式指定仓（多仓同路径时必用）
//     2. `<relPath>`          —— 按 roots 顺序找第一个 root/relPath 存在的仓
//   物理路径 = path.resolve(root, relPath)；file 字段统一写 relPath（仓库相对，不含 root 前缀）
function resolveFile(file, roots, repoIds) {
  const raw = toPosix(file)
  const colon = raw.indexOf(':')
  // 盘符判定：仅 `C:/` 或 `C:\` 形式（冒号在 index 1 且后接分隔符），其余冒号视为 repoId 分隔
  const isDriveLetter = colon === 1 && /^[A-Za-z]$/.test(raw[0]) && /[\/]/.test(raw[2] || '')
  const isExplicit = colon > 0 && !isDriveLetter && repoIds.includes(raw.slice(0, colon))
  const explicitRepoId = isExplicit ? raw.slice(0, colon) : null
  const rel = isExplicit ? raw.slice(colon + 1) : raw

  const candidates = []
  for (let i = 0; i < roots.length; i++) candidates.push({ repoId: repoIds[i], root: roots[i] })
  const ordered = explicitRepoId ? candidates.filter((c) => c.repoId === explicitRepoId) : candidates
  if (explicitRepoId && ordered.length === 0) {
    return { error: '显式 repoId 未声明（--repo-ids 不含 ' + explicitRepoId + '）：' + raw }
  }
  for (const c of ordered) {
    const abs = path.resolve(c.root, rel)
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      return { repoId: c.repoId, root: c.root, rel, abs }
    }
  }
  return { error: '证据文件在声明的源码根下均不存在（roots=' + roots.join(',') + '）：' + raw }
}

export function collectSourceManifest(input) {
  const problems = []
  const bad = (m) => problems.push(m)
  const I = input || {}
  const branch = String(I.branch || '')
  const roots = (I.roots || []).map(toPosix)
  const repoIds = I.repoIds || []
  const date = String(I.date || '')
  const commitReader = I.gitCommitReader || readGitCommit

  if (branch !== 'client' && branch !== 'server') bad('branch 必须是 client 或 server：' + branch)
  if (roots.length === 0) bad('roots 缺失（源码根目录列表）')
  if (repoIds.length !== roots.length) bad('repoIds 与 roots 长度不一致：' + repoIds.length + ' vs ' + roots.length)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) bad('date 非法（YYYY-MM-DD）：' + date)
  // repoIds 允许重复（同 repoId 配多根：S5 服务端 game_hzmj 层根 + src 根，repoId 均为 server）
  if (problems.length > 0) return { ok: false, problems, manifest: null, fileHashes: null }

  // 文件归集：去重（同一 file 多处引用只算一次）+ 码元序
  const unique = [...new Set((I.filePaths || []).map(toPosix))].sort(cmpCodeUnit)
  if (unique.length === 0) bad('没有任何证据/依赖文件可采集（filePaths 为空）')

  const byRepo = new Map()
  for (const rid of repoIds) byRepo.set(rid, { repoId: rid, repoRoot: '', commit: '', files: [] })
  const fileHashes = new Map()

  for (const f of unique) {
    const r = resolveFile(f, roots, repoIds)
    if (r.error) {
      bad(r.error)
      continue
    }
    const contentHash = sha256File(r.abs)
    const entry = byRepo.get(r.repoId)
    // 同仓同 rel 重复引用（分片两处引用同一文件）只算一次
    if (entry.files.some((x) => x.file === r.rel)) continue
    entry.files.push({ file: r.rel, contentHash })
    fileHashes.set(r.repoId + KEY_SEP + r.rel, {
      contentHash,
      sourceRevision: '', // 下方按仓回填
      verifiedAt: date,
    })
  }
  if (problems.length > 0) return { ok: false, problems, manifest: null, fileHashes: null }

  // 分仓回填 commit（每仓只读一次 git）+ repoRoot + files 码元序
  // 同 repoId 多根：合并为单仓条目，repoRoot/commit 取该 repoId 的首根
  const repos = []
  const seenRepoIds = new Set()
  for (let i = 0; i < repoIds.length; i++) {
    const rid = repoIds[i]
    if (seenRepoIds.has(rid)) continue
    seenRepoIds.add(rid)
    const entry = byRepo.get(rid)
    entry.repoRoot = roots[i]
    entry.commit = commitReader(roots[i])
    entry.files.sort((a, b) => cmpCodeUnit(a.file, b.file))
    if (entry.files.length > 0) {
      for (const f of entry.files) {
        const h = fileHashes.get(rid + KEY_SEP + f.file)
        h.sourceRevision = entry.commit
      }
      repos.push(entry)
    }
  }

  const manifest = {
    schemaVersion: 1,
    branch: branch,
    collectedAt: date,
    repos: repos,
  }
  return { ok: true, problems: [], manifest, fileHashes }
}

// ============================================================
// CLI
// ============================================================

function parseArgs(argv) {
  const a = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]
    if (t === '--branch') a.branch = argv[++i]
    else if (t === '--roots') a.roots = argv[++i]
    else if (t === '--repo-ids') a.repoIds = argv[++i]
    else if (t === '--files') a.files = argv[++i]
    else if (t === '--date') a.date = argv[++i]
    else if (t === '--out') a.out = argv[++i]
    else a._.push(t)
  }
  return a
}

function cliMain(argv) {
  const a = parseArgs(argv)
  if (!a.branch || !a.roots || !a.repoIds || !a.files || !a.date) {
    console.error('用法：node collect-source-manifest.mjs --branch <client|server> --roots <r1,r2> --repo-ids <id1,id2> --files <f1,f2|@list.txt> --date <YYYY-MM-DD> --out <path>')
    process.exit(1)
  }
  const roots = a.roots.split(',').map((s) => s.trim()).filter(Boolean)
  const repoIds = a.repoIds.split(',').map((s) => s.trim()).filter(Boolean)
  const filePaths = a.files.startsWith('@')
    ? fs.readFileSync(a.files.slice(1), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    : a.files.split(',').map((s) => s.trim()).filter(Boolean)

  const r = collectSourceManifest({ branch: a.branch, roots, repoIds, filePaths, date: a.date })
  if (!r.ok) {
    console.log('[失败] 源码清单采集未通过，共 ' + r.problems.length + ' 项问题：')
    for (const p of r.problems) console.log('  - ' + p)
    process.exit(1)
  }
  if (a.out) {
    fs.mkdirSync(path.dirname(a.out), { recursive: true })
    fs.writeFileSync(a.out, JSON.stringify(r.manifest, null, 1) + '\n', 'utf8')
  }
  const fileCount = r.manifest.repos.reduce((n, x) => n + x.files.length, 0)
  console.log(
    '[成功] 源码清单采集：分支 ' + a.branch + ' / 仓 ' + r.manifest.repos.length + ' 个 / 文件 ' + fileCount + ' 个' +
      '（' + r.manifest.repos.map((x) => x.repoId + '@' + String(x.commit).slice(0, 8)).join(', ') + '）' +
      (a.out ? ' -> ' + a.out : '')
  )
  process.exit(0)
}

if (process.argv[1] && toPosix(process.argv[1]).endsWith('collect-source-manifest.mjs')) {
  cliMain(process.argv.slice(2))
}
