# output-spec 大文档 agent 输出中断（单会话写不动 60KB 文档，分片写盘解决）

## 问题现象

- output-spec-generate workflow 中 `规格文档 ST-C11`（「出牌与响应」章节，全部 15 个阶段里最重：12 功能点 / 56 原子项，输入 evidence JSON 45KB，产物文档 60KB+）连续三次失败，三种形态：
  1. 主 run 内两次 attempt 均 `provider_timeout`（upstream provider did not respond in time / overloaded_error），重试耗尽。
  2. 单独补跑（一次性脚本，prompt 与原版一致）：agent 状态 `ok`、耗时 631s（10.5 分钟），但 `outputTokens: 0`、`outputPreview` 空、目标文件未写——**输出流中断被当作成功**。
  3. 分片补跑时三片中体量最小的一片（26KB JSON 输入）同样 `outputTokens: 0` 中断；另两片（21KB/30KB JSON 输入）成功。
- sessions-search 看 agent session：1484 行日志全部是「脑内整理」——逐个功能点列出 messages 清单、逐原子项推敲字段内容，**始终未调用 write 工具**，整理到中途流就断了。

## 排查过程

1. run 记录（`.opencode-workflows/runs/run-*.json`）对比成功/失败 agent：失败的共同特征 `outputTokens: 0` + `status: ok`——runtime 只认会话结束不认输出为空，check 落盘闸门才拦下。
2. sessions-search `show opencode <sessionId>` 看完整 session：确认 agent 把时间全花在回复内逐项整理（模型自发行为：想先把 56 个原子项全部想清楚再一次性写盘），越大的输入越容易触发。
3. 对照同 run 的 ST-C05（次重章节，63KB parts、66KB 文档）：曾 provider_timeout 两次后第三次成功——说明大任务不是必死，而是概率性失败，单会话承载量已到边缘。
4. 检查 read 通道：evidence JSON 45KB 单行会被 read 截断（单行 2000 字符限制），agent 需先 PowerShell 格式化再读——额外多轮工具调用也放大了失败窗口。

## 根因

- 单 agent 单会话要求「读 45KB 结构化输入 + 脑内全量整理 + 一次写出 60KB 文档」，超出 provider 单次响应稳定承载能力：要么 upstream 超时（overloaded_error），要么长推理后输出流中断（outputTokens 归零）。
- 输出中断被 runtime 记为 `status: ok`，错误被推迟到落盘检查才暴露。
- 模型自发「先全量脑内排版再写盘」的行为放大了单次响应长度。

## 解决方案

按「大输入分片」原则拆成 3 片并行写再合并（一次性修复脚本 fix-st-c11-doc-2/3.js）：

1. **输入切片**：node 从 journal 提取查证 result，按 features 均分 3 组（各 4 功能点），各落盘 `part-N.json`，并**多行格式化**（`JSON.stringify(x, null, 1)`，每片 442~609 行 < read 单次 2000 行）——同时规避单行超长被 read 截断的问题，agent 不再需要 PowerShell 格式化。
2. **分片 prompt**：保留原 stageDocPrompt 的格式骨架与硬性规则，增量约束：
   - 第 1 片负责文档头（标题/阶段信息/术语/跨切面），其余片只写功能点节；
   - 硬性规则追加「直接逐个功能点边写边落盘，不要先在回复中整理全部内容再写盘」——强制打断「脑内全量排版」行为。
3. **落盘闸门**：每片紧跟 `check(fileExists(part-N.md))`，agent 返回但未写盘当场拦截。
4. **node 合并**（merge-st-c11.mjs）：拼接三片（尾空白裁剪 + 空行连接）+ U+FFFD 乱码检查 + 合并后删分片 md，产出 `stages/spec_stage_ST-C11.md`（100907 字节）。
5. 分片 3 单独再中断一次，单独补跑该片即成功（分片后单次重试代价从「重跑整个 60KB 任务」降为「重跑 20KB 一片」）。

## 预防/注意事项

- 单文档产物预计超过 ~40KB 时，按章节/功能点分片并行写盘再 node 合并，不要指望单 agent 一次写完；分片同时让「失败重试」的代价可控。
- 写盘型 agent 的 prompt 里显式写「直接边写边落盘、不要先全量整理再写盘」，并紧跟 `check(fileExists)`；`status: ok` 不等于产物存在（outputTokens=0 也是 ok）。
- 给 agent 读的结构化输入文件一律落盘为**多行格式化 JSON**（每行一个字段），避免单行超长触发 read 截断引发 agent 额外折腾。
- run 记录里 `outputTokens: 0` + `outputPreview` 空是输出中断的明确信号，排查时优先看这两个字段而不是 status。

## 相关文件

- 主 workflow：`.opencode-workflows/workflows/output-spec-generate/3-produce-outputs.js`（单 agent 写整份阶段文档的原设计）
- 修复脚本（一次性，temp 目录，未入库）：`fix-st-c11-doc-2.js` / `fix-st-c11-doc-3.js` / `merge-st-c11.mjs`
- 姊妹坑：[outputspec续跑不重执行重试耗尽agent.md](outputspec续跑不重执行重试耗尽agent.md)（resume 静默跳过失败 agent）
