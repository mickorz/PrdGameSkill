# merge 正式证据重编号 vs agent 分片内引用错位——批量「引用不存在的证据」假故障（D-REFNORM）

- 日期：2026-11-18
- 关联：执行文档 §21.8 I6；`merge-branch-evidence.mjs` D-REFNORM
- 组件：`.opencode-workflows/scripts/merge-branch-evidence.mjs`

## 问题现象

S4/S5 的 `merge-branch-evidence` 大面积失败：run-001 服务端 13 项、run-002 服务端 9 项，全是「条目引用不存在的证据」「引用一致性失败（证据 atomIds 不含引用方原子）」。表面上像 agent 数据质量缺陷（大量条目引用悬空）。

## 排查过程

1. 抽查一条「引用不存在的证据」：`AT-ST-C01-014` 的 entry 引用 `SVE-AT-ST-C01-014-01/02/03`——**三个 id 在该分片 evidence[] 里全部存在**，问题不在数据。
2. 对比 merge 的 id 分配逻辑：正式 id 由**合并键码元序**重新编号（`SVE-<atomId>-NN` 的 NN 按排序位置），而 agent 在分片内按自己的产出顺序编号——两套编号**天然独立**，只有巧合时才一致。
3. run-001 客户端「通过」是巧合（该分片 agent 编号恰好与合并键序一致）；服务端分片编号与合并键序错位 → 引用全部悬空或错挂。
4. 错挂更隐蔽：编号错位时引用可能解析到**同 owner 的另一条证据**（id 存在但不是 agent 指的那条）。

## 根因

**按值引用跨编号域**：entry/conflictEvidenceIds 引用的是 agent 分片内编号，而 merge 会对同一批证据**重新编号**（正式 id 按合并键序、幂等沿用既有正式产物）。用「会变的 id」做引用键，编号策略一变引用就断。原设计假设 agent 会按合并键序编号——这个假设对 LLM 不成立也不该成立。

## 解决方案（D-REFNORM 引用归一化，冻结为契约语义）

引用的语义改为「**引用 = 支撑声明**」，按身份而非编号解析：

1. **采集侧**：rawEvidence 条目记 `agentId`（agent 原始编号）。
2. **归一化前置**（主合并前）：按分片建 `partNormById`（agentId → 合并键）；对每条 entry 的 evidenceIds/conflictEvidenceIds：可解析的引用 → 引用方原子并入被引证据 `atomIds`（引用即支撑，agent 漏记的共享原子补齐）；悬空引用删除；「需证据而空」（verdict=confirmed 但删空）仍按分支规则 fail——真实缺陷不豁免。
3. **重映射**：正式 id 分配时建 `mergeKeyToId`；条目校验阶段把引用从「本片 agentId → 合并键 → 正式 id」双跳重映射（canonRefs，去重），正式产物里的 evidenceIds 是**稳定正式 id**（跨 run 一致）。
4. merge-branch-evidence.example.mjs：K1（编号错位重映射）/ K2（引用即支撑并入 atomIds）/ H3（悬空全删后需证据而空仍 fail）回归用例。

验证：11 套 183 用例全绿；**真分片手动合并全绿**（run-001 客户端 29 条目/10 证据、服务端 29/60；run-002 服务端）。

## 预防/注意事项

- **不要用「下游会重新分配的 id」做引用键**；要么引用稳定身份（合并键/内容指纹），要么在重编号处集中重映射。
- 大面积「引用不存在」先抽 1~2 条验证 id 是否真的缺席——编号错位的假故障和真缺陷的表现完全相同，只有对账能区分。
- 「引用即支撑」语义下，被引证据的 atomIds 是 merge 端唯一事实源（agent 的 atomIds 只是初值）。
