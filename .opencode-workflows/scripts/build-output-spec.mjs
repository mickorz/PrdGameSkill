// build-output-spec.mjs —— 1-spec 产出统一构建器（确定性命令，output-spec-generate workflow 专用）
//
// 合并补充版分片、装配索引、机械校验三步一次完成。中文路径（补充版文档名、模板名等）
// 全部经配置文件传入，CLI 参数保持 ASCII——规避中文路径经命令行的编码风险
// （见 dev-docs/experience/workflow扫描agent全量转述超时-确定性扫描替代.md 预防条目）。
//
// 用法：
//   node build-output-spec.mjs <configPath>
//
// 配置 JSON（由 workflow 的 echo agent 逐字写入 <specDir>/runtime/build-config.json）：
//   {
//     "specDir":            "1-spec 产出目录（相对项目根）",
//     "supplementPath":     "补充版文档输出路径",
//     "templatePath":       "需求模板路径",
//     "date":               "产出日期 YYYY-MM-DD",
//     "sourceDesc":         "来源描述（进 feature_index.source）",
//     "expectedStageCount": "期望阶段数（片段数校验）",
//     "supplementParts":    ["补充版分片文件路径列表（按序）"]
//   }
//
// 步骤：
//   1. 合并 supplementParts -> supplementPath（缺分片 fail-fast；语义对齐 merge-parts.mjs：
//      空行分隔拼接、成功后删分片、U+FFFD 乱码检查）
//   2. assembleIndex 装配 feature_index.json + stage_manifest.md
//   3. verifyOutputSpec 机械校验（产出 runtime/spec_check/verify-report.md）
//
// 退出码：0 全部成功 / 1 任一步失败（步骤名 + 明细见 stderr）

import fs from 'node:fs'
import path from 'node:path'
import { assembleIndex } from './assemble-output-spec-index.mjs'
import { verifyOutputSpec } from './verify-output-spec.mjs'

function stepMergeSupplement(config) {
  const parts = config.supplementParts || []
  if (parts.length === 0) {
    console.error('[失败] [合并补充版] 配置缺少 supplementParts 分片列表')
    return false
  }
  const missing = parts.filter((p) => !fs.existsSync(p))
  if (missing.length > 0) {
    console.error('[失败] [合并补充版] 分片缺失 ' + missing.length + ' 个（产出编写阶段可能中断，请重跑 workflow）：\n  ' + missing.join('\n  '))
    return false
  }
  const merged = parts.map((p) => fs.readFileSync(p, 'utf8').trimEnd()).join('\n\n') + '\n'
  fs.mkdirSync(path.dirname(config.supplementPath), { recursive: true })
  fs.writeFileSync(config.supplementPath, merged, 'utf8')
  for (const p of parts) fs.unlinkSync(p)

  const fffdLines = []
  merged.split('\n').forEach((l, i) => {
    if (l.includes('\uFFFD')) fffdLines.push(i + 1)
  })
  if (fffdLines.length > 0) {
    console.error('[失败] [合并补充版] 补充版文档含乱码替换字符 U+FFFD 共 ' + fffdLines.length + ' 处，行号：' + fffdLines.slice(0, 20).join(', ') + (fffdLines.length > 20 ? ' ...' : ''))
    return false
  }
  console.log('[成功] [合并补充版] ' + parts.length + ' 个分片 -> ' + config.supplementPath + '（' + Buffer.byteLength(merged, 'utf8') + ' 字节，无乱码）')
  return true
}

function main() {
  const [configPath] = process.argv.slice(2)
  if (!configPath) {
    console.error('用法: node build-output-spec.mjs <configPath>')
    process.exit(1)
  }
  if (!fs.existsSync(configPath)) {
    console.error('[失败] 配置文件不存在：' + configPath)
    process.exit(1)
  }
  let config
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } catch (err) {
    console.error('[失败] 配置 JSON 解析失败：' + configPath + '（' + err.message + '）')
    process.exit(1)
  }
  for (const key of ['specDir', 'supplementPath', 'templatePath']) {
    if (!config[key]) {
      console.error('[失败] 配置缺少必填字段：' + key)
      process.exit(1)
    }
  }

  // 步骤 1：合并补充版文档
  if (!stepMergeSupplement(config)) process.exit(1)

  // 步骤 2：装配索引（feature_index.json + stage_manifest.md）
  const asm = assembleIndex(config.specDir, config.date || '', config.sourceDesc || '', config.expectedStageCount)
  if (!asm.ok) {
    console.error('[失败] [装配索引] 失败，明细见上方日志')
    process.exit(1)
  }

  // 步骤 3：机械校验
  const ver = verifyOutputSpec(config.specDir, config.supplementPath, config.templatePath, config.date || '')
  if (!ver.ok) {
    console.error('[失败] [机械校验] 未通过，明细见 ' + path.join(config.specDir, 'runtime', 'spec_check', 'verify-report.md'))
    process.exit(1)
  }

  console.log(
    'SUMMARY ' +
      JSON.stringify({
        specDir: config.specDir,
        supplementPath: config.supplementPath,
        stageCount: asm.summary.stageCount,
        featureCount: asm.summary.featureCount,
        atomCount: asm.summary.atomCount,
        verdictTotal: ver.summary.verdictTotal,
      })
  )
}

main()
