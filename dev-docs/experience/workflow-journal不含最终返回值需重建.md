# workflow journal 不含 workflow 最终返回值（汇总产物需重建）

**日期**：2026-11-16　|　**场景**：GS-V1 Gold Set 盲测（run-mwj15bv2-1，`gold-set-planner-test.js`）

## 问题现象

workflow 后台运行完成后，工具消息里的结果 JSON 因「结果过大已截断」拿不全；去 `.opencode-workflows/journal/<runId>.json` 收割时发现：journal 只有 20 条 `entries['<runId>:N']`（每个 `agent()` 的返回值），**不含 workflow 脚本最终 `return` 的聚合产物**（报告/汇总对象）。

## 排查过程

1. 递归 walk 整个 journal 找 `report` 字段 → NOT FOUND；
2. 打印 top keys（`version/runId/entries`）与 entry 键形态（`hash/result/label/phase/sessionId/prompt/...`）确认只有 agent 条目；
3. 按 label 区分阶段（0~9 盲答 / 10~19 评分），确认 result 均为 agent 返回字符串。

## 根因

journal 的职责是 **agent 调用回放**（`resumeFromRunId` 断点续跑的依据）；workflow 顶层确定性计算（汇总/模板拼接）不产生 journal 条目——纯计算段每轮重跑，最终产物只在工具消息里返回（大结果被截断显示）。

## 解决方案（journal 重建法）

1. 从 journal 按序取 agent result 字符串（`entries['<runId>:0..N-1']`；个别 result 带前置自然语言，用 first/last `{}` brace 提取 JSON）；
2. 从 workflow 脚本原文用 `indexOf` 标记切出**纯计算段**（常量/GOLD_SET + 归一化块 + 汇总模板块，跳过 `phase/agent/parallel/await` 段）；
3. 拼接为 `new Function('RAW_ANSWERS','RAW_SCORES', body)` 注入 journal 结果执行——确定性重建出与 workflow 返回一致的产物（本轮验证：total=99 与原输出逐字段一致）。

## 预防/注意事项

- workflow 的最终汇总若是大产物且需要落盘复用：要么把落盘做进收尾 agent（写盘任务 `agentType: 'general'`），要么按本文方法从 journal + 脚本纯计算段重建；不要指望 journal 里能找到 workflow 的 return 值。
- 重建脚本与 workflow 脚本的汇总模板必须同源（直接从 workflow 文件文本切段，避免手工复制漂移）。
- agent result 里可能混有自然语言前缀/代码围栏，解析一律走 first/last brace + 围栏剥离（与 workflow 内 `parseAgentJson` 同逻辑）。
