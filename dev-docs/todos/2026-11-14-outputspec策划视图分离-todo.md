# TODO：outputspec 策划视图分离（全部完成）

- 日期：2026-11-14
- 来源：`dev-docs/planning/2026-11-14-outputspec策划视图分离执行计划.md`（任务编号 T0.x~T5.x 均指向该计划；需求 R1~R10 见 `dev-docs/requirements/2026-11-14-outputspec策划需求视图与技术实现视图分离.md`）
- 状态：阶段 0~5 全部完成（含验收与 commit）；复盘见 `dev-docs/progress-result/output-spec-generate-演进报告-v3.md`
- 变更记录：按用户指令（2026-11-14），T0.3/T2.6/T5.1/T5.2 原人工评审闸门改为自动 AI 评审与自动触发，workflow 运行由 agent 自行触发

## 阶段 0：策划版 Prompt 对照实验（完成，commit 3138866 附产物）

| 任务 | 状态 | 结果 |
|------|------|------|
| T0.1 实验脚本 prepare-planner-experiment.mjs | 完成 | example 自检 16 项全绿；真实数据 3 阶段/50 原子项 |
| T0.2 策划版 Prompt 草案 | 完成 | 转写而非复制 + 不编造原则 + 技术词硬性禁令 + AT-ID 追溯 |
| T0.3 运行（run-mwf7e6nc-2） | 完成 | 3 agent 全部成功，626.4s / 58814 tok，产物 3 份策划版 |
| T0.3 三检查点评审 | 完成 | 用户人工评审通过（"没问题"）：泄漏正则零命中/信息不丢失/AT-ID 可追溯 |

## 阶段 1：3-produce-outputs.js v3 策划版分片产出（完成，commit 3138866）

| 任务 | 状态 | 结果 |
|------|------|------|
| T1.1~T1.6 全部 | 完成 | slimPlannerEvidence 结构化隔离；plannerPartPrompt 实验定稿蓝本；skipPlanner/plannerOnly 互斥开关；build-config mode/plannerPath/plannerParts/sourceSpecDir/allowlist；落盘闸门分支；v3 头注释 |
| 验收：双投影模拟 | 完成 | run-mwf8gm3p-3（9 agent，439.3s）：双套分片齐全，策划版泄漏 0（正则自检 9/9）、AT-ID 8/8 全覆盖 |
| 验收：plannerOnly 模拟 | 完成 | run-mwf8smis-4（4 agent，450.3s）：技术任务零调度（stageDoc 0/fragment 0/part 0），仅策划版分片 3 + build-config |
| 验收：skipPlanner 走查 | 完成 | A/B/C 段零改动（if (!plannerOnly) 包裹），行为等同 v2 |

## 阶段 2：2-verify-stages.js v4 业务语义与差异 Schema（完成，commit 47e2ea1）

| 任务 | 状态 | 结果 |
|------|------|------|
| T2.1~T2.5 代码 | 完成 | Schema：businessBehavior 四元组/difference 四枚举/differenceDetail/verification；prompt 第三步判定规则（部分证据=unverified/conflict 双检/禁 confirmed 直推）；校验循环（not_found 强制/conflict 双检/clientObserved 派生/兜底）；schemaVersion 2 + 旧 run resume 警示 |
| T2.4 断言 | 完成 | 临时断言脚本 12/12（conflict 合法/缺 detail/缺证据/not_found 强制/旧数据兜底/非法值兜底/consistent 直通） |
| T2.6 真实查证 + AI 评审 | 完成 | run-mwf9b49u-5（ST-C05 单阶段，577s/29007 tok）：8 功能点/30 原子项，verdict 8/17/5，difference consistent 3/partial 7/conflict 0/unverified 20；AI 评审通过——businessBehavior 玩家语言达标（抽样 005/010/020/023/030）、businessRuleVerified=true 与 consistent 一一对应无冒充、unverified 全为服务端行为类合理保守、AT-ST-C05-028 文案歧义已记 notes 不误判 conflict |

## 阶段 3：装配与校验扩展（完成，commit a9bae82）

| 任务 | 状态 | 结果 |
|------|------|------|
| T3.1 备份策略 | 完成 | 依赖 git 历史，scripts/ 不新增备份 |
| T3.2 mergeDocumentParts 泛化 | 完成 | 补充版/策划版共用；幂等修复 L2（全缺+目标存在=跳过，部分缺=fail） |
| T3.3 泄漏检查 + difference 统计 | 完成 | checkPlannerLeakage（9 正则 + allowlist 豁免）；difference 分布段进 verify-report（v1 unmarked 不冒充） |
| T3.4 装配器 v2 | 完成 | schema_version 2 + difference_stats（unmarked_v1）；新字段透传 + schema_marked 区分兜底 |
| T3.5 4-assemble-verify v3 | 完成 | plannerOnly 分支只查策划版链路产物；skipPlanner 跳过；返回值加 plannerPath/traceIndexPath |
| T3.6 example 扩展 | 完成 | build 13 场景/verify 14 场景/assemble 8 场景全绿（含 v2 策划版链路/泄漏/覆盖缺失/planner-only 成功失败/幂等重跑） |
| T3.7 build-planner-trace.mjs | 完成 | scan+feature_index 机械生成 trace_index（atomId/sourceStage/plannerPart/evidenceCount/reviewStatus）；example 14 断言；AT-ID 覆盖检查（正则修正 AT-ST-C\d{2}-\d{3}） |
| 验收：全链路样例 | 完成 | 真实 agent 产物（planner-only 模拟 3 份 + 模式 1 索引片段）跑 build：合并双文档 + 装配 + trace 8 条 + 泄漏 0 + 覆盖 100% + difference v1 unmarked 8 → 放行 |
| 验收：2026-11-13 只读 | 完成 | git status 零改动 |

## 阶段 4：主编排 outputMode 三模式（完成，commit 51fe06c）

| 任务 | 状态 | 结果 |
|------|------|------|
| T4.1 args 四参数 | 完成 | outputMode（all 默认/planner-only/legacy）/plannerPath/sourceSpecDir（只读默认 2026-11-13）/outputDir（可写默认 2026-11-14） |
| T4.2 legacy | 完成 | childArgs 加 skipPlanner=true；specDir 保持旧默认 |
| T4.3 planner-only | 完成 | 跳过子流程 1/2；prepare-planner-doc-input.mjs（新增，example 15/15）sourceSpecDir 只读切业务证据；子流程 3 fromDisk 模式（echo 读 sections.json + agent 读证据投影）；子流程 4 策划版分支 |
| T4.4 all | 完成 | specDir 统一 outputDir；plannerPath 顶层输出 |
| T4.5 冲突检查 | 完成 | 三重 fail fast（specDir=sourceSpecDir / outputDir=sourceSpecDir / specDir 已含 feature_index 或 stage_manifest；分片残留允许） |
| 验收 | 完成 | 三模式传参路径与冲突分支代码走查；真实行为归阶段 5 |

## 阶段 5：全量重跑与收尾（完成）

| 任务 | 状态 | 结果 |
|------|------|------|
| T5.1a planner-only 全链路真实跑 | 完成 | run-mwf9hupm-6（19 agent，2235s/165348 tok）全部成功；首跑装配覆盖 fail（4 个纯知识原子 optional）→ required 口径修复（a2dd1fb）→ build 幂等重跑放行：泄漏零命中、必查覆盖 100%（339/339）、optional 4 列提示 |
| T5.1a 验收 | 完成 | 2026-11-13 目录零改动（两次核对）；策划版约 89KB / 15 阶段 |
| T5.1b all 全量重跑 | 完成 | run-mwfb5d3r-7（86/88 agent，8627s/806078 tok）：查证 15/15 零失败（L3 生效）；产出闸门 2 agent 未写盘 → journal 证据 one-shot 补跑（run-mwfgnueu-8 + run-mwfh8aby-9）+ 分片 merge ×3 + 机械问题修正（骨架占位字面量 ×8、AT-ID 缩写 ×1）→ 幂等 build 放行：15 阶段/93 功能/319 原子、difference 65/64/2/188 全标注、trace 必查覆盖 100% |
| T5.2 AI 验收收口 | 完成 | run-mwfhvdzp-11（3 agent，525.2s/26228 tok）：conflict 2/2 逐条成立；三章节复核 ST-C01 通过、ST-C02/C05 4 处残留已修；策划版补跑章节 3 处失真/幻觉已修；build 复跑 exit 0 |
| T5.3 文档收尾 | 完成 | 演进报告 v3 回填（15 占位符 + 问题清单 5 项）；执行进度.md 里程碑更新；experience 回填（L1 坑实锤/骨架占位字面量/AT-ID 缩写）；todo 终态；commit push |

## 优先级与提交计划

1. ~~阶段 0~~ → ~~阶段 1/2~~ → ~~阶段 3~~ → ~~阶段 4~~ → ~~阶段 5~~（全部提交：3138866 / 47e2ea1 / a9bae82 / 51fe06c / b424bd4 / a2dd1fb / 本次收尾）
2. 全部完成：产出目录 `spec-workflow/output-spec/2026-11-14/1-spec`（15 阶段/93 功能点/319 原子项）+ 补充版（131532 字节）+ 策划版（89913 字节）；复盘见演进报告 v3
3. 后续迭代入口：遗留 L7（待确认口径统一）+ 骨架占位去字面化 + AT-ID 完整形式硬约束（见演进报告 v3 第 5 节）
