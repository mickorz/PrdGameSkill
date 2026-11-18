# S2 结构重算闸门缺 --date 参数（game-requirement-audit 首跑）

- 日期：2026-11-17
- 关联：`dev-docs/planning/2026-11-17-game-requirement-audit-执行文档.md` §21.8 I4
- 组件：`.opencode-workflows/workflows/game-requirement-audit/2-atomize-requirements.js`

## 问题现象

首跑（journal `run-mwkpasup-2`）S2 原子拆解 agent 全部完成后，结构重算闸门失败，工作流中断，报错文本只笼统说「拆解分片结构重算闸门未通过（ID/行号落界/枚举/覆盖/统计问题）」。

## 排查过程

1. 分片文件（23 个 atom-parts）与 scan.json 均已落盘，说明 agent 侧成功，失败在闸门命令本身。
2. 读 `2-atomize-requirements.js` 闸门调用：`build-requirement-registry.mjs ... --validate-only --recount-out <path>`。
3. 手动重跑该命令，得到真实报错：CLI 报缺少 `--date`（`build-requirement-registry.mjs` CLI 层 `--date` 是必填参数，用于产物时间戳）。

## 根因

子流程里 `validateCmd` 拼接时只传了分片与 recount 输出路径，漏传 `--date`；`date` 变量本身存在（经 args 传入），只是没接到命令上。Example 回归没覆盖「子流程闸门命令拼装」这一层，故未拦截。

## 解决方案

`2-atomize-requirements.js` 增加 `const date = String(A.date || '').trim()` + 空值校验（空则 fail-fast），`validateCmd` 补 `--date "..."`。手动重跑闸门绿：23 阶段 / 109 功能 / 416 原子。commit ad55bc1。

## 预防/注意事项

- 确定性脚本 CLI 参数变化时，grep 所有拼接调用点（子流程里的 commandSuccess 字符串），不要只改脚本本体。
- 闸门失败时优先手动重跑闸门命令看原始报错——workflow 抛出的错误文本可能是「上游汇总话术」，不含 CLI 的具体缺失参数。
