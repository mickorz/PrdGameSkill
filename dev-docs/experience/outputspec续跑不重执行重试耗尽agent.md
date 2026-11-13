# resumeFromRunId 对重试耗尽的失败 agent 不重执行（续跑静默跳过）

## 问题现象

- output-spec-generate workflow（run-mwep59gd-1，四子流程：扫描/查证/产出/装配）首跑在「产出编写」阶段失败：`规格文档 ST-C05` 与 `规格文档 ST-C11` 两个 agent 连续 provider_timeout 重试耗尽。
- 之后两次 `resumeFromRunId="run-mwep59gd-1"` 续跑：
  - 续跑 1：ST-C05 真正重跑成功（写盘 21:31），ST-C11 未执行，workflow 未报 agent 失败，直接走到「装配与校验」报「阶段文档缺失 spec_stage_ST-C11.md」。
  - 续跑 2：ST-C11 仍无任何新执行记录，再次装配失败，错误完全相同。
- journal 检查：`规格文档 ST-C11` entry 只有 2 条历史 execution（均 provider_timeout），`result` 字段缺失；两次续跑后该 entry 无任何变化。

## 排查过程

1. `spec-workflow/output-spec/2026-11-13/1-spec/runtime/spec_check/verify-report.md` 指向 `spec_stage_ST-C11.md` 缺失。
2. 读 journal（`.opencode-workflows/journal/run-mwep59gd-1.json`，entries 按 `runId:wf{n}:{callIndex}` 键）：
   - 全部 65 entry 中仅 `规格文档 ST-C11` 无 `result`（有 `executions` 数组记录 2 次失败 attempt）；
   - 对比成功 entry 的 keys：`["label","sessionId","executions","hash","result",...]`——失败 entry 缺 `hash/result` 等回放字段。
3. 结论：resume 回放按「journal 有 result 的调用」回放；重试耗尽的 entry 无 result，但续跑也不会重新执行它——parallel 不抛错、后续阶段照常推进（相当于该 agent 被静默吞掉）。
4. 另注意：装配校验失败信息指向的是**上一次装配写的旧 verify-report.md**（本次装配在步骤 1 就 fail-fast 退出，未重写报告），排查时要以命令 stderr 为准，不能只看报告文件。

## 根因

- resumeFromRunId 的回放机制对「agent 重试耗尽」类失败 entry 的处理存在缺陷/边界：无 result 的 entry 既不重放成功结果，也不触发重新执行，更不在 parallel 层报「agent 重试耗尽」——失败被静默跳过，问题推迟到下游确定性校验（文件存在性）才暴露。
- 与 `CHECKPOINT_REJECTED`（拒绝确定性重现）不同：agent 级失败续跑本应重跑，实际未重跑。

## 解决方案

绕开 resume，单独补跑该 agent（从 journal 提取上游结果作输入）：

1. 用 node 从 journal 提取该 agent 的上游数据（如 `查证 ST-C11` entry 的 `result`，45KB）落盘中间文件。
2. 写一次性 workflow 脚本：按原 prompt 规格（从原脚本一字不差复制 prompt 构造函数）单独执行该写作 agent + `check(fileExists(...))` 落盘闸门 + 重跑下游装配校验。
3. 写作任务本身超重（12 功能点/56 原子项，单文档 60KB+）单会话仍会失败，需按「大输入分片」拆分，见姊妹篇 [outputspec大文档agent输出中断分片写盘.md](outputspec大文档agent输出中断分片写盘.md)。

## 预防/注意事项

- **续跑不是万能恢复**：agent 重试耗尽的 run，resume 大概率静默跳过该失败调用；续跑后必须核对 journal 中该 entry 是否新增 execution、目标文件是否真的写盘，不要只看 workflow 是否走到下一阶段。
- 写盘型 workflow 必须在产出阶段紧跟 `check(fileExists)` 闸门，把「agent 返回但未写盘/被跳过」在当阶段拦截，而不是推迟到装配校验。
- journal 可读性排查套路：`entries` 按 `runId:wf{n}:{callIndex}` 键控；`result` 存在与否 = 可回放与否；`executions[].error` 记录各次 attempt 失败原因。
- 失败报告文件（verify-report 等）可能是一段陈旧快照：fail-fast 的步骤 1 失败不会重写步骤 3 的报告，排查先看命令 stderr 再看报告。

## 相关文件

- 主 workflow：`.opencode-workflows/workflows/output-spec-generate/output-spec-generate.js`（+ 1~4 子流程）
- journal：`.opencode-workflows/journal/run-mwep59gd-1.json`
- 修复脚本（一次性，temp 目录，未入库）：`fix-st-c11-doc-{2,3}.js`
