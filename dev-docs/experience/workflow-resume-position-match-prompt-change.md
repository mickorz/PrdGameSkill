# workflow resume 按位置匹配：prompt 文本变更不触发重跑

## 问题现象

T5.1b 修复（2026-11-14）：修复 workflow（run-mwfgnueu-8）中「策划版 ST-C14」agent 返回了摘要但未写目标文件，闸门 fail。第二次修复尝试：只修改该 agent 的 prompt 文本（加一行重试提示）后传 `resumeFromRunId` 续跑——期望「prompt 变了所以该 agent 重跑」，实际结果 3 个 agent **全部缓存回放**（0 token、0.0s），目标 agent 没有重跑，闸门再次失败。

## 排查过程

1. 确认 journal 中该 agent entry 有 result（agent 确实完成过、只是没写盘）。
2. 修改 os-fix-t51b.js 中 `plannerPrompt()` 的返回文本（开头插入重试提示行），`node --check` 语法通过。
3. 传 `resumeFromRunId="run-mwfgnueu-8"` + 修改后的 scriptPath 续跑。
4. 输出：`3 个 agent，3 缓存回放，耗时 0.0s，共 0 tokens`——prompt 文本变更完全没被识别为「变更调用」。

## 根因

resume 的调用匹配是**按调用位置（序号）**而不是按 prompt 内容哈希。「首个变更调用及其后全部重跑」中的「变更」指脚本中 agent() 调用的**数量/位置/顺序变化**（增删调用、改变调用排列），单纯改某个调用的 prompt 文本不影响位置匹配 → journal 里该位置有 result → 直接回放。

结论性规则：

| 改动类型 | resume 行为 |
|----------|-------------|
| 只改 prompt 文本（调用数量/位置不变） | 全部回放，不重跑任何 agent |
| 在目标调用之前增/删一个 agent() 调用 | 目标调用及之后全部重跑（前置调用不变则回放） |
| journal entry 无 result（重试耗尽/中断） | 静默跳过不重跑（L1 坑，不回放也不执行） |

## 解决方案

对「单个 agent 没写盘」的精准补跑，不依赖 resume，直接写**单任务 mini workflow**：

1. 从原修复脚本中抽出该 agent 的 prompt 函数与常量（node 脚本切片生成，或直接复制）。
2. 新建只含这一个 agent() 调用的 workflow 脚本（不同调用序列 → 全新 run，不走回放）。
3. 闸门保留（写盘检查），失败信息里拼上 agent 返回值便于诊断。

本次实操：`os-fix-part16.js`（单 agent 补写 part-16.md，run-mwfh8aby-9，430s 成功）。

## 预防/注意事项

1. **resume 的正确用法**：只用于「改脚本编排逻辑后续跑」，不用于「重跑某个返回不合格结果的 agent」。
2. 单 agent 补跑用独立 mini workflow（prompt 内嵌证据/路径），不要试图用 prompt 变更骗 resume。
3. journal 无 result 的 entry（中断/重试耗尽）resume 也不会重跑——同样要走独立补跑（本次 T5.1b 的 ST-C13/ST-C14 两 agent 即此情况）。
4. 从大脚本切 mini workflow 时用 node 字符串切片生成（`indexOf('function xxx')` 到 `phase(` 之前），避免手工复制出错；生成后 `node --check` 验语法。
