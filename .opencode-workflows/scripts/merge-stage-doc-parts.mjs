// merge-stage-doc-parts.mjs —— 阶段规格文档分片合并器（确定性命令，output-spec-generate v2 分片方案配套）
//
// 背景：3-produce-outputs.js v2 起对原子项超过阈值（24）的重阶段按功能点分组分片编写
// （单 agent 单会话写 60KB 级文档会 provider_timeout / 输出中断，见
// dev-docs/experience/outputspec大文档agent输出中断分片写盘.md），分片写盘后由本脚本合并。
//
// 可导入：export mergeStageDocParts(partsDir, targetPath, expectedCount)
//         返回 { ok, problems, chars }，不直接退出进程
// CLI 用法：
//   node merge-stage-doc-parts.mjs <partsDir> <targetPath> [expectedCount]
//   partsDir 下放 part-1.md、part-2.md、...（按序号升序合并）；ASCII 路径经 CLI 传递
//
// 行为：
//   1. 枚举 partsDir 下 part-N.md（N 正整数），按 N 升序；expectedCount 给定时校验片数一致
//   2. 每片尾空白裁剪后以空行连接，写入 targetPath（UTF-8 无 BOM）
//   3. 合并文本含 U+FFFD 乱码即失败（不写目标）
//   4. 合并成功后删除全部分片 md（分片 json 不动，留作查证中间产物）
//
// 退出码（CLI）：0 成功 / 1 失败（缺片/片数不符/乱码/读文件失败）

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function listPartFiles(partsDir) {
  if (!fs.existsSync(partsDir)) return []
  return fs
    .readdirSync(partsDir)
    .map((name) => {
      const m = name.match(/^part-(\d+)\.md$/)
      return m ? { file: path.join(partsDir, name), n: Number(m[1]) } : null
    })
    .filter(Boolean)
    .sort((a, b) => a.n - b.n)
}

export function mergeStageDocParts(partsDir, targetPath, expectedCount) {
  const problems = []
  const parts = listPartFiles(partsDir)
  if (parts.length === 0) {
    problems.push('分片目录不存在或无 part-N.md 文件：' + partsDir)
    return { ok: false, problems: problems, chars: 0 }
  }
  if (expectedCount !== undefined && parts.length !== expectedCount) {
    problems.push('分片数不符：期望 ' + expectedCount + ' 片，实际 ' + parts.length + ' 片（' + partsDir + '）')
    return { ok: false, problems: problems, chars: 0 }
  }
  // 序号必须从 1 连续
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].n !== i + 1) {
      problems.push('分片序号不连续：第 ' + (i + 1) + ' 片实际编号 part-' + parts[i].n + '.md（' + partsDir + '）')
      return { ok: false, problems: problems, chars: 0 }
    }
  }
  let merged
  try {
    merged = parts.map((p) => fs.readFileSync(p.file, 'utf8').replace(/\s+$/, '')).join('\n\n')
  } catch (err) {
    problems.push('分片读取失败：' + err.message)
    return { ok: false, problems: problems, chars: 0 }
  }
  if (merged.includes('\uFFFD')) {
    const fffdLines = []
    merged.split('\n').forEach((l, i) => {
      if (l.includes('\uFFFD')) fffdLines.push(i + 1)
    })
    problems.push('合并文本含乱码替换字符 U+FFFD 共 ' + fffdLines.length + ' 处，行号：' + fffdLines.slice(0, 10).join(', '))
    return { ok: false, problems: problems, chars: 0 }
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.writeFileSync(targetPath, merged + '\n', 'utf8')
  for (const p of parts) fs.unlinkSync(p.file)
  return { ok: true, problems: problems, chars: Buffer.byteLength(merged + '\n', 'utf8') }
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  const [partsDir, targetPath, expectedCountArg] = process.argv.slice(2)
  if (!partsDir || !targetPath) {
    console.error('用法: node merge-stage-doc-parts.mjs <partsDir> <targetPath> [expectedCount]')
    process.exit(1)
  }
  const expectedCount = expectedCountArg !== undefined ? Number(expectedCountArg) : undefined
  const r = mergeStageDocParts(partsDir, targetPath, expectedCount)
  if (!r.ok) {
    console.error('[失败] [合并阶段文档分片] ' + r.problems.join('；'))
    process.exit(1)
  }
  console.log('[成功] [合并阶段文档分片] ' + partsDir + ' -> ' + targetPath + '（' + r.chars + ' 字节，分片已删除）')
}
