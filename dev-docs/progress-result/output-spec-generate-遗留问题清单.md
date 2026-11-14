# output-spec-generate 遗留问题清单

> 跨版记忆载体，问题生命周期状态流转（schema 见 workflow-optimize skill reference/ledger-schema.md）。

| ID | 严重度 | 问题描述 | 发现版本 | 状态 | 修复版本 | 验证方式 |
|----|--------|----------|----------|------|----------|----------|
| L1 | 高 | resumeFromRunId 对 agent 重试耗尽的 journal entry 静默跳过不重执行（无 result 不回放也不重跑，失败推迟到下游校验）——runtime 层问题 | v1 | 部分修复 | v2（缓解） | v2 落盘闸门把失败拦截在产出当阶段（check spec_stage 文件存在）；根治需 opencode workflow 插件层修复 resume 对无 result 失败 entry 的重执行，超出 workflow 脚本能力范围 |
| L2 | 高 | build-output-spec.mjs 步骤 1 合并补充版后删分片且不幂等：任何一次装配成功后，再次/续跑重跑装配必在步骤 1 fail-fast（缺分片），且 verify-report.md 停留旧内容误导排查 | v1 | 已修 | v4（2026-11-14） | mergeDocumentParts 泛化时修复：分片全缺且目标文件已存在非空 = 上次已完成，幂等跳过；分片部分缺失仍 fail（中断状态不掩盖）；build-output-spec.example.mjs 场景 13 幂等重跑断言通过（含策划版分片同语义） |
| L3 | 高 | 查证阶段超时率高：14/15 个查证 agent 至少一次撞 1h 墙钟（成功 attempt 平均 2398s/最大 3355s，裕度 1.07x）+ 2 次结构化降级失败（网关缓存 format unsupported (cached)） | v1 | 已修（T5.1b 验证生效） | v3 | timeoutMs 7200000（裕度 ≈2.1x）+ retries 2；验证：T5.1b 全量重跑（run-mwfb5d3r-7）查证 15/15 阶段全部成功、零墙钟超时失败（v1 首跑 6/15 失败场景未再现）——v3 验证口径达标 |
| L4 | 中 | splitDocParts 贪心装箱尾片碎片：ST-C12（26 原子项）拆成 24+2，尾片仅 1FP/2AT（多花一次 agent 调用） | v2 | 未修（接受） | - | 影响仅多一次小 agent 调用，不影响正确性；如修：分组均衡化（按原子项均分而非贪心）；下版可视实际执行成本决定 |
| L5 | 中 | 查证 schema 结构化输出经网关偶发 format unsupported (cached)（与 game-prd-check 阶段 3 同款网关缓存问题），属外部网关层 | v1 | 部分修复 | v3（缓解） | retries 2 提供重试裕度；根治在网关侧（缓存策略），超出本仓库范围 |
| L6 | 低 | journal executions[] 只记失败 attempt 且疑似仅保留最近若干条（跨 run 累积），执行复盘观测值为下限 | v1 | 不修 | - | 记录口径问题：复盘统计时注明「观测下限」；run 级 runs/*.json 会滚动清理，关键执行数据及时快照 |
| L7 | 中 | 策划版待确认口径不一致：算分章（ST-C13）对 13 个「partial + notes 仅服务端运算/客户端只展示」原子不写待确认行，番型章（ST-C14）对同类 17 个原子逐条写待确认行——prompt 对「notes 为职责边界说明而非不一致记录」未界定所致（T5.2 抽检发现，内容均无编造） | v3 | 未修 | -（候选 v5） | 修复方向：plannerPartPrompt 明确「notes 含『服务端判定/客户端只展示』职责说明且非不一致记录时不写待确认行」（或反向统一）+ example 断言；验证：策划版全文待确认行口径单阶段一致 |

## 状态流转记录

- 2026-11-13 v2 定稿：L1 部分修复（闸门缓解）；L3 v3 机制落地待观察；L4/L5/L6 新发现追加。
- 2026-11-14 v4：L2 已修（mergeDocumentParts 幂等跳过，example 场景 13 验证）。
- 2026-11-14 v4 收尾（T5.2 AI 验收）：L3 验证生效（run-mwfb5d3r-7 查证 15/15 零失败）；L7 新发现追加（策划版待确认口径不一致，run-mwfhvdzp-11 抽检）。
- 下版（v5）设计强制输入：L7 待确认口径统一（prompt 规则界定 + example 断言）；L4 视 L3 已验证的成本数据决定。
