# planOnly 确认通过后 fall-through 越界执行（workflow checkpoint 返回路径）

- 日期：2026-11-18
- 关联：执行文档 §21.8 I7；journal `run-mwlhe4sk`
- 组件：`.opencode-workflows/workflows/game-requirement-audit/game-requirement-audit.js`

## 问题现象

用 `mode=from-stage, planOnly=true` 做续跑计划确认，人工在 checkpoint **点了确认（accept）**，预期工作流返回计划结果就此结束；实际上它**继续真实执行**了 S4/S5（烧了 19 个 agent 的 token，并生成了 run-002 的完整分片产物）。

## 排查过程

1. 读 planOnly 分支代码：checkpoint 判定后 `if (!proceed) { ...return {...} }`——**只有 REJECT 才 return**。
2. ACCEPT 时控制流落出 if 块，继续往下走到真实执行段（prepare + STEPS 循环）。
3. journal 佐证：`run-mwlhe4sk` 里 checkpoint 记录为 accepted，其后跟着 S4/S5 的完整 agent 序列。

## 根因

「确认即放行」的交互语义与「计划模式只出计划」的模式语义冲突：写代码时只处理了「用户拒绝 → 留档退出」，漏了「用户确认 → 也应退出（计划已被确认，不需要在本次 run 执行）」。planOnly 的正确语义是：**无论 accept 还是 reject，本次 run 都不执行**；确认后的正式执行应当由用户重跑（不带 planOnly）触发。

## 解决方案

`game-requirement-audit.js` planOnly 分支：ACCEPT 后同样 `return { ok:true, planOnlyUsed:true, stopped:true, stoppedAfter:'prepare-plan-confirmed', ... }`（摘要写明「复用 X / 重跑 Y，确认后不执行」）。两个出口都先于真实执行段 return。

## 预防/注意事项

- 「模式开关 + 人工确认点」双重控制时，逐条枚举四象限（模式×确认）的预期行为再写分支，最容易漏的就是「确认后仍受模式约束」。
- 越界执行产生的产物（run-002）是真数据，**保留但不作为续跑主体**（其 journal 是 plan-only 形态，位置对齐不成立，见 `workflow-resume-position-match-prompt-change.md`）。
