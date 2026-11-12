#!/usr/bin/env node
// check-shared-snapshot.mjs —— 共享需求快照消费前校验（三 Checker 复用，v4 契约）
// 校验：requirements.json/manifest.json 存在、extractionRunId 一致、requirements 非空、
//       --verify-source 时 sourceFiles 文件存在且 sha256 未变（源 PRD 变更即快照过期）
// 用法：node check-shared-snapshot.mjs <dir> <extractionRunId> [--verify-source]
// 通过 exit 0（stdout 输出摘要 JSON，供日志）；失败 exit 1（stderr 原因，不猜测）
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const dir = process.argv[2]
const expectRunId = process.argv[3]
const verifySource = process.argv.includes('--verify-source')
if (!dir || !expectRunId) {
  console.error('用法: node check-shared-snapshot.mjs <dir> <extractionRunId> [--verify-source]')
  process.exit(1)
}
const fail = (msg) => { console.error('[失败] ' + msg); process.exit(1) }

if (!fs.existsSync(dir)) fail('快照目录不存在: ' + dir)
const reqFile = path.join(dir, 'requirements.json')
const manifestFile = path.join(dir, 'manifest.json')
if (!fs.existsSync(reqFile)) fail('快照缺 requirements.json: ' + reqFile)
if (!fs.existsSync(manifestFile)) fail('快照缺 manifest.json: ' + manifestFile)

let manifest = null
let reqs = null
try { manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) } catch (e) { fail('manifest.json 解析失败: ' + e.message) }
try { reqs = JSON.parse(fs.readFileSync(reqFile, 'utf8')) } catch (e) { fail('requirements.json 解析失败: ' + e.message) }
if (!Array.isArray(reqs)) reqs = reqs.requirements
if (!Array.isArray(reqs) || reqs.length === 0) fail('requirements.json 无需求条目（空快照拒绝消费）')

if (String(manifest.extractionRunId || '') !== String(expectRunId)) {
  fail('extractionRunId 不一致：参数 ' + expectRunId + ' vs 快照 manifest ' + manifest.extractionRunId + '（不猜测，请确认消费的快照目录）')
}

let sourceNote = null
if (verifySource) {
  const files = Array.isArray(manifest.sourceFiles) ? manifest.sourceFiles : []
  if (files.length === 0) fail('manifest.sourceFiles 为空，无法校验源文件（快照元数据不完整）')
  for (const sf of files) {
    if (!fs.existsSync(sf.file)) fail('源文件不存在: ' + sf.file + '（快照提取时的源 PRD 已移动/删除）')
    const sha = crypto.createHash('sha256').update(fs.readFileSync(sf.file, 'utf8')).digest('hex')
    if (sha !== sf.sha256) fail('源文件已变更（sha256 不一致，快照过期）: ' + sf.file + '，快照记录 ' + String(sf.sha256).slice(0, 12) + '... 现文件 ' + sha.slice(0, 12) + '...；请重新提取快照')
  }
  sourceNote = 'sourceFiles ' + files.length + ' 个 sha256 一致'
}

console.log('[成功] 共享快照校验通过: ' + dir + '（extractionRunId ' + manifest.extractionRunId + '，需求 ' + reqs.length + ' 条' + (sourceNote ? '，' + sourceNote : '') + '）')
