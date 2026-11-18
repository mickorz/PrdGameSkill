# journal-resume 时 init-run 重跑产生孤儿 run 目录 + 劫持 latest.json

- 日期：2026-11-18
- 关联：执行文档 §21.8 运行资产说明
- 组件：`game-requirement-audit.js`（init-run 命令）、`.opencode-workflows/runs/<runId>.json` journal

## 问题现象

对失败 run 做 journal-resume（`resumeFromRunId`）后：

1. `spec-workflow/requirement-audit/<date>/runs/` 下多出一个**新的 run-NNN 目录**（只含 runtime 初始化产物，无实质内容）——孤儿目录。
2. `runs/latest.json` 被改写指向新目录。
3. 主流程实际仍在**原 run 目录**里干活（产物都写回原 run），latest.json 与实际不符。

## 排查过程

1. 对比 resume 前后的目录：新 run-NNN 只有 init-run 写的 runtime 骨架。
2. journal 机制：`commandSuccess(...)` **不入 journal**——resume 时命令原样重跑；`agent(...)` 调用按位置重放（回放不落盘）。
3. 主编排第一步是 init-run 命令（读 latest.json → 建 run-NNN → 写 latest.json）。resume 时该命令重跑 → 又建一个新目录并劫持 latest.json；随后「回读 latest.json」的 agent 调用**按 journal 重放**，返回的还是原 runId → 主流程继续在原 run 目录工作。

## 根因

init-run 的「建新目录 + 前进 latest.json」语义与 journal 回放语义叠加：命令重跑（副作用真实发生）+ agent 回放（结果停留在原 run）→ 产生孤儿目录 + latest.json 指向漂移。这是 workflow journal「命令不回放、agent 回放」设计的固有副作用，不是 bug，但需要人知道并清理。

## 解决方案（操作规程）

- resume 完成后清理：删除本次 resume 产生的孤儿 run 目录（只含 runtime 骨架、无 agent 产物的那个），把 `latest.json` 复原指向真实主体 run。
- 判断孤儿：目录内无 agent 产物（无分片/无正式产物），且 journal 里最新一个 run 的 runId 与 latest.json 不一致时，以 journal 为准。
- 也可在 resume 前预判：resume 必然产生一个新 run-NNN，完成后按上述规程清理。

## 预防/注意事项

- **journal 是续跑的事实源**，latest.json 只是 init-run 的前进指针；两者不一致时信 journal。
- 孤儿目录若含真实 agent 产物（如 planOnly 越界执行的 run-002），按「保留真数据、不入续跑链」处理，不删。
- 清理 latest.json 时用最小写入（只改 runId 字段），保持 1 空格缩进 UTF-8 LF。
