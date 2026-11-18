# merge-evidence analysisRunId 递增与 journal 续跑幂等——S7 重算闸门 439 项全炸（I12）

- 日期：2026-11-18
- 关联：执行文档 §21.8 I12；同族问题：journal-resume 语义（I7/I10）
- 组件：`.opencode-workflows/scripts/merge-evidence.mjs`（S6）、`.opencode-workflows/scripts/assemble-behavior-parts.mjs`（S7 重算闸门）

## 问题现象

第三次 journal 续跑（S10 覆盖校验修复后）在 **S7 分片汇总校验**失败，报 439 项：

- 23 个行为分片全部「analysisRunId 与 unified-atoms 不一致：ar-2026-11-17-001」（分片记录 001，重算时盘上 unified-atoms 已是 002）
- 416 个原子全部「原子缺 business-behavior 条目」（分片被拒后条目全缺——级联）

而 S7 在上一轮（第二次续跑）明明已完整通过并记录 completed。

## 排查过程

1. 手动重跑 S7 汇总命令拿明细（workflow 抛错不含明细）。
2. 读 journal：第三次续跑 S1~S3 与 S4/S5/S6/S7 行为 agent 全部**重放**（replayed=1），但命令全部**重跑**。
3. 复盘 S6→S7 命令链：`merge-evidence`（S6）analysisRunId = `ar-<date>-<seq>`，`seq = history.length + 1`；上一轮 S7 的 `append-analysis-history` 已把 ar-001 **入档**。第三次续跑时 S6 命令重跑 → history 已有 1 轮 → 算出 **ar-002** 并覆写 unified-atoms.json；S7 行为 agent 只重放（分片文件未变，仍记录 001）→ 重算闸门比对 001≠002 → 23+416 全炸。
4. 连带发现 a：**journal 在新失败点截断重写**——journal 从 140 agent 缩到 82（重放前缀），上轮 S8~S10 的可重放记录被清掉，后续续跑只能重跑 ~50 agent。
5. 连带发现 b：升级识别（D25）在续跑时「上轮」**自引用**——history 已含本轮记录，`lastRecordByAtom` 会把本轮自己的 conflict-fast 当上轮，重算时 upgraded 判定漂移（本轮 conflict-fast 0 未触发）。

## 根因

**journal-resume 的命令重跑 + 非幂等 analysisRunId 递增**：agent 按位重放（产物不变），命令确定性重跑；但 `seq = history.length+1` 的语义是「新分析轮」，重放场景下并不是新轮——S6 产出与上轮完全相同，却因 history 已被上轮 S7 追加而拿到新 id，作废了 S7 分片记录的 id。**本质：产物 id 的派生依赖了「执行历史」而非「产物内容」**。

## 解决方案（resume 幂等两段式）

`merge-evidence.mjs`：

1. **同内容复用 id**：计算产物内容 sig（schemaVersion/date/atoms/stats）与盘上 `unified-atoms.json` 一致（除 id 外）→ 复用盘上 analysisRunId（同内容不同 id 只会作废下游分片）。
2. **prev 字段两段式装配**：`previousRunId`/`upgraded`/`stats.upgraded` 依赖「上轮」口径——先按 resume 假设（盘上轮已入 history，本轮为其重放 → **排除该轮自引用**）装配算 sig；sig 与盘上一致即复用收口；不一致为**真实新轮** → 按全量 history（盘上轮才是真正上轮）重新装配，取递增 id。
3. 数据复原：被覆写的 run-001 `unified-atoms.json` 的 analysisRunId 002 → 001（内容其余一致）。

回归：`merge-evidence.example.mjs` 新增 J2（同输入重跑复用 id 不递增）/ J3（内容变化才递增 002）/ J4（conflict→full 升级后同输入重跑：复用升级轮 id + upgraded 不因自引用漂移）——11 套 186 全绿；真实 run-001 S6+S7 命令链手动重跑验证绿（ar-001 复用 / 416 原子 / 23 分片）。

## 预防/注意事项

- **产物 id 派生只依赖产物内容，不依赖执行历史**：凡「重放/重跑需幂等」的确定性命令，其产物 id 必须内容寻址（同内容同 id），history 计数只用于「内容真的变了」的新轮。
- **journal 失败即截断**：续跑失败一次，失败点之后的可重放记录全部丢失（journal 重写为重放前缀）——修复闸门后应尽快续跑收口，避免连环失败放大重跑成本；评估续跑收益时要把「已失败过的部分无法重放」计入。
- 升级/对比类判定（D25「上轮」）在重放场景下要显式排除**本轮自身**在 history 里的记录，否则自引用会让判定漂移；但排除又不能误伤「真实新轮」（上轮=盘上轮）——两段式（先假设重放、不匹配再按新轮）可同时覆盖。
- workflow 抛错不含命令明细：闸门命令（merge/assemble/check-coverage）都支持手动重跑，排查时先手动跑拿明细，不要凭错误文案猜。
