// merge-parts.mjs —— 报告分片合并器（确定性命令，替代合并 agent）
//
// 三个检查 workflow 的报告分片合并共用。此前由 agent 转述一条 cat/PowerShell 命令执行
// （有转义、BOM、LLM 改写风险），现由 workflow 沙箱 commandSuccess 直接调用本脚本。
//
// 用法：
//   node merge-parts.mjs <outFile> <part1> <part2> [<part3> ...]
//
// 行为：
//   - 全部分片必须存在（缺任一 → [失败] 退出码 1；上次运行中断时 fail-fast，重跑 workflow）
//   - 按参数顺序合并，分片间空一行，写 outFile（UTF-8 无 BOM）
//   - 合并成功后删除全部分片
//   - 顺带检查乱码替换字符 U+FFFD：发现 → [警告] 列出所在行号，退出码 2（文件已写出，待修复）
//
// 退出码：0 成功且无乱码 / 1 结构错误（分片缺失、无分片参数） / 2 合并完成但含乱码

import fs from 'node:fs'
import path from 'node:path'

function main() {
  const args = process.argv.slice(2)
  if (args.length < 2) {
    console.error('用法: node merge-parts.mjs <outFile> <part1> <part2> [...]')
    process.exit(1)
  }
  const [outFile, ...parts] = args
  if (parts.length === 0) {
    console.error('[失败] 未指定分片')
    process.exit(1)
  }
  const missing = parts.filter((p) => !fs.existsSync(p))
  if (missing.length > 0) {
    console.error('[失败] 分片缺失 ' + missing.length + ' 个（上次运行可能中断，请重跑 workflow）：\n  ' + missing.join('\n  '))
    process.exit(1)
  }
  const merged = parts.map((p) => fs.readFileSync(p, 'utf8').trimEnd()).join('\n\n') + '\n'
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, merged, 'utf8')
  for (const p of parts) fs.unlinkSync(p)

  const lines = merged.split('\n')
  const fffdLines = []
  lines.forEach((l, i) => {
    if (l.includes('\uFFFD')) fffdLines.push(i + 1)
  })
  if (fffdLines.length > 0) {
    console.error('[警告] 合并完成但目标文件含乱码替换字符 U+FFFD 共 ' + fffdLines.length + ' 处，行号：' + fffdLines.slice(0, 20).join(', ') + (fffdLines.length > 20 ? ' ...' : ''))
    console.log('SUMMARY ' + JSON.stringify({ outFile: outFile, parts: parts.length, bytes: Buffer.byteLength(merged, 'utf8'), fffdCount: fffdLines.length }))
    process.exit(2)
  }
  console.log('[成功] 合并完成：' + parts.length + ' 个分片 -> ' + outFile + '（' + Buffer.byteLength(merged, 'utf8') + ' 字节，无乱码）')
  console.log('SUMMARY ' + JSON.stringify({ outFile: outFile, parts: parts.length, bytes: Buffer.byteLength(merged, 'utf8'), fffdCount: 0 }))
}

main()
