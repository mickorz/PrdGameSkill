# output-spec-generate 遗留问题清单

> 跨版记忆载体，问题生命周期状态流转（schema 见 workflow-optimize skill reference/ledger-schema.md）。

| ID | 严重度 | 问题描述 | 发现版本 | 状态 | 修复版本 | 验证方式 |
|----|--------|----------|----------|------|----------|----------|
| L1 | 高 | resumeFromRunId 对 agent 重试耗尽的 journal entry 静默跳过不重执行（无 result 不回放也不重跑，失败推迟到下游校验）——runtime 层问题 | v1 | 部分修复 | v2（缓解） | v2 落盘闸门把失败拦截在产出当阶段（check spec_stage 文件存在）；根治需 opencode workflow 插件层修复 resume 对无 result 失败 entry 的重执行，超出 workflow 脚本能力范围 |
| L2 | 高 | build-output-spec.mjs 步骤 1 合并补充版后删分片且不幂等：任何一次装配成功后，再次/续跑重跑装配必在步骤 1 fail-fast（缺分片），且 verify-report.md 停留旧内容误导排查 | v1 | 已修 | v4（2026-11-14） | mergeDocumentParts 泛化时修复：分片全缺且目标文件已存在非空 = 上次已完成，幂等跳过；分片部分缺失仍 fail（中断状态不掩盖）；build-output-spec.example.mjs 场景 13 幂等重跑断言通过（含策划版分片同语义） |
| L3 | 高 | 查证阶段超时率高：14/15 个查证 agent 至少一次撞 1h 墙钟（成功 attempt 平均 2398s/最大 3355s，裕度 1.07x）+ 2 次结构化降级失败（网关缓存 format unsupported (cached)） | v1 | 已修（机制落地，效果待观察） | v3 | timeoutMs 7200000（裕度 ≈2.1x）+ retries 2；验证口径：下次真实执行查证阶段失败 attempt 数显著低于 20 次（观测下限口径） |
| L4 | 中 | splitDocParts 贪心装箱尾片碎片：ST-C12（26 原子项）拆成 24+2，尾片仅 1FP/2AT（多花一次 agent 调用） | v2 | 未修（接受） | - | 影响仅多一次小 agent 调用，不影响正确性；如修：分组均衡化（按原子项均分而非贪心）；下版可视实际执行成本决定 |
| L5 | 中 | 查证 schema 结构化输出经网关偶发 format unsupported (cached)（与 game-prd-check 阶段 3 同款网关缓存问题），属外部网关层 | v1 | 部分修复 | v3（缓解） | retries 2 提供重试裕度；根治在网关侧（缓存策略），超出本仓库范围 |
| L6 | 低 | journal executions[] 只记失败 attempt 且疑似仅保留最近若干条（跨 run 累积），执行复盘观测值为下限 | v1 | 不修 | - | 记录口径问题：复盘统计时注明「观测下限」；run 级 runs/*.json 会滚动清理，关键执行数据及时快照 |

## 状态流转记录

- 2026-11-13 v2 定稿：L1 部分修复（闸门缓解）；L3 v3 机制落地待观察；L4/L5/L6 新发现追加。
- 2026-11-14 v4：L2 已修（mergeDocumentParts 幂等跳过，example 场景 13 验证）。
- 下版（v5）设计强制输入：L4 视 L3 真实执行后的成本数据决定。
