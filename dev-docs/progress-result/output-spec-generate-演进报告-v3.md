# output-spec-generate 演进报告 v3：策划需求视图与技术实现视图分离

> 复盘范围：OSG-W3 全阶段（阶段 0 Prompt 对照实验 → 阶段 1~4 代码改造与验收 → 阶段 5 全量重跑）。
> 需求基线：`dev-docs/requirements/2026-11-14-outputspec策划需求视图与技术实现视图分离.md`（R1~R10）；执行计划：`dev-docs/planning/2026-11-14-outputspec策划视图分离执行计划.md`（T0.x~T5.x）。
> 本版为结构演进版：新增策划版文档投影（双视图分离）+ 查证 Schema v2（businessBehavior/difference）+ 三级机械闸门（泄漏正则/AT-ID 覆盖/差异统计）+ outputMode 三模式。产物对比基线为首跑 2026-11-13（sourceSpecDir 只读，L2 幂等保证重跑可对照）。
> 评审方式变更（用户指令）：T0.3/T2.6/T5.1/T5.2 原人工评审闸门改为自动 AI 评审；workflow 运行由 agent 自行触发。

## 1. 执行元数据

| 阶段/版本 | runId | agent | 耗时 | token | 结果 |
|-----------|-------|-------|------|-------|------|
| 阶段 0 实验 | run-mwf7e6nc-2 | 3 | 641s | 58814 | 3 agent 全部成功；T0.3 三检查点人工评审通过 |
| 阶段 1 验收：双投影模拟 | run-mwf8gm3p-3 | 9 | 439.3s | - | 双套分片齐全；泄漏 0 / AT-ID 8/8 |
| 阶段 1 验收：plannerOnly 模拟 | run-mwf8smis-4 | 4 | 450.3s | 13739 | 技术任务零调度（stageDoc 0 / fragment 0 / part 0），仅策划版分片 3 + build-config |
| T2.6 单阶段真实查证（ST-C05） | run-mwf9b49u-5 | 1 | 577s | 29007 | schemaVersion 2；30 原子项；AI 评审通过 |
| T5.1a planner-only 全链路 | run-mwf9hupm-6 | 19 | 2235s | 165348 | 19 agent 全部成功；首跑装配覆盖 fail（required 口径修复 a2dd1fb 后重跑放行） |
| T5.1b all 全量重跑 | run-mwfb5d3r-7（+修复 run-mwfgnueu-8/run-mwfh8aby-9） | 86/88（+4 修复） | 8627s（+1342s 修复） | 806078（+68303 修复） | 查证 15/15 零失败；产出闸门 2 agent 未写盘 → journal 证据 one-shot 补跑 + 幂等 build 放行 |
| T5.2 AI 验收收口 | run-mwfhvdzp-11 | 3 | 525.2s | 26228 | conflict 2 项逐条成立；三章节复核 4 处残留已修；策划版补跑章节 3 处失真/幻觉已修；build 复跑 exit 0 |

## 2. 结构演进总览（R1~R10 落点）

| 需求 | 落点 | 验证 |
|------|------|------|
| R1 策划版文档（纯业务语言，原文保留+界面表现+待确认） | 3-produce-outputs v3 plannerPartPrompt（内嵌证据）+ v3.1 plannerPartPromptFromFile（读文件证据） | 阶段 0 实验 3 份产物 + 阶段 1 双模拟 + T5.1a 全链路 |
| R2 结构化字段隔离（第一级：写作输入只含业务字段） | slimPlannerEvidence / prepare-planner-doc-input FIELD_MAP 白名单 | 模拟跑证据检查 + prepare example 用例 2 |
| R3 策划版分片产线（part-NN.md + 合并） | plannerPartPath + mergeDocumentParts 泛化 + 幂等（L2 修复） | build example 场景 8/13 |
| R4 businessBehavior 业务语义层 | 2-verify-stages v4 Schema + prompt 第三步 | T2.6 ST-C05：30/30 原子带四元组 |
| R5 difference 差异判定与双索引透传 | 四枚举 + 冲突双检 + 校验循环 + assemble v2 difference_stats + verify v2 统计段 | T2.4 断言 12/12 + T2.6 真实数据 |
| R6 泄漏三级闸门 | slimPlannerEvidence（一级）+ checkPlannerLeakage 9 正则（二级）+ AI 评审（三级） | 模拟跑零命中 + T5.2 复核 |
| R7 outputMode 三模式 | 主编排 mode 契约 + childArgs 分支 + planner-only 磁盘输入链路 | 三模式走查 + T5.1a/b 真实跑 |
| R8 验收三检查点（泄漏/不丢失/可追溯） | T0.3（实验）+ T2.6（Schema）+ T5.2（全量收口） | T0.3/T2.6 已过；T5.2 见第 5 节 |
| R9 trace_index 追溯索引 | build-planner-trace.mjs + checkAtomCoverage（非 100% fail） | trace example 14 断言 + 模拟 8/8 + 全量覆盖 |
| R10 产物目录读写分离 + schemaVersion 兼容 | sourceSpecDir 只读 + outputDir 可写 + 三重 fail fast + v1 兜底 unverified 不冒充 | T5.1a 零改动核对 + 全链路样例 unmarked 8 |

## 3. 问题与修复清单（本版执行）

| # | 问题 | 类型 | 修复 | 验证 |
|---|------|------|------|------|
| 1 | AT-ID 覆盖正则误写 `AT-ST-C\d{3}-\d{3}`，实际格式 `AT-ST-Cxx-nnn`（C 后 2 位），计数恒 0 | 自犯错误（正则） | 修正为 `AT-ST-C\d{2}-\d{3}` | 模拟产物 15 次出现/8 去重全覆盖 |
| 2 | verify example 断言失误：`C_[A-Za-z]` 只匹配两字符（C_B 非 C_Bank）；showDice 非 set/get/on 前缀方法；同行多命中只记首个 | 自犯错误（测试） | 测试文本拆行 + 断言按正则实际匹配串 | verify example 14 场景全绿 |
| 3 | difference unmarked 判定口径分歧：装配器对 v1 片段补 `difference:'unverified'+schema_marked:false`，verify 按字段缺失判 unmarked 恒 0 | 设计口径 | 统一口径：`difference===undefined || schema_marked===false` | build example 场景 8 断言 unmarked_v1 3 |
| 4 | build example 旧断言文案与 mergeDocumentParts 泛化后日志不符（「补充版文档含乱码」→「文档含乱码」） | 自犯错误（测试） | 适配新文案 | build example 全绿 |
| 5 | 遗留 L2：build 合并后删分片不幂等（重跑必败） | 遗留问题 | mergeDocumentParts 幂等（全缺+目标存在=跳过；部分缺=fail 不掩盖） | build example 场景 13 幂等重跑断言 |
| 6 | 主编排 planner-only 链路 workflow 沙箱无 readFile，无法内存传 verify | 架构约束 | prepare-planner-doc-input.mjs 确定性切分业务证据 + 子流程 3 fromDisk 模式（agent 读证据文件，隔离更彻底） | prepare example 15/15 + T5.1a 真实跑 |
| 7 | T5.1a 覆盖闸门分母为全量原子，「不硬凑」Prompt 正确跳过纯知识原子却判 fail（防遗漏与防编造口径冲突） | 设计口径 | trace 增 required 口径（业务字段任一非空或 not_found 才必查；optional 缺失列提示不阻断） | build example 场景 11.5/11.6 + T5.1a 幂等重跑放行 |
| 8 | T5.1b 产出闸门 2 agent 返回未写盘（ST-C13 规格文档/ST-C14 策划版分片）；L1 坑二次实锤：resume 对无 result entry 静默跳过，且 resume 按调用位置匹配、prompt 文本变更不触发重跑 | 运行中断 + 平台机制 | journal 提取查证 result → one-shot 补跑 workflow（证据内嵌）+ 原 run 已落盘分片 node merge + 幂等 build | 修复 run-mwfgnueu-8/run-mwfh8aby-9 + build exit 0 |
| 9 | STAGE_DOC_FORMAT 骨架占位被 agent 当字面量：ST-C01 原子标题 `{AT-...}` 花括号 ×8（verify 正则不匹配）、ST-C02 标题指引括号 ×2、ST-C05 生成说明行 ×1 | LLM 占位理解不稳定 | 终产物 node 正则修正（去花括号/去括号/删行） | verify-report 阶段文档 15/15 ID 集合一致 |
| 10 | 策划版「（AT-ST-C09-007、008）」缩写标注违反 AT-ST-Cxx-nnn 完整形式，verify 正则不识别 | LLM 标注缩写 | 展开为完整形式（AT-ST-C09-007、AT-ST-C09-008） | 策划版完整 AT-ID 唯一数 319（含 008） |
| 11 | T5.1b 策划版 ST-C13/ST-C14 补跑章节 3 处事实错误：四家飘分缩窄为三个输家（失真）、「显示已飘次数」无证据（幻觉） | LLM 转写失真 | AI 复核（run-mwfhvdzp-11）逐处定位 → node 替换修正 | 修复后 build 复跑 exit 0 |

## 4. 阶段 5 执行记录

### T5.1a planner-only 全链路真实跑（run-mwf9hupm-6）

- 链路：prepare-planner-doc-input（sourceSpecDir 2026-11-13 只读 → outputDir 2026-11-14/runtime/planner-input）→ 子流程 3 fromDisk（sections.json echo 读取 + 15 阶段策划版写作 + intro/terms 复制 + build-config）→ 子流程 4 planner-only 分支（合并策划版 → trace_index → 泄漏检查 → AT-ID 覆盖检查 → verify-report）
- agent：19（读取 1 + 复制 2 + 策划版写作 15 + 构建配置 1）
- 结果：19 agent 全部成功；首跑装配 AT-ID 覆盖 98.9% fail——4 个纯知识原子（万条筒 36 张/东南西北 16 张/中发白 12 张类，confirmed 且 uiInteraction/businessBehavior/notes 全空）被「不硬凑」Prompt 规则正确跳过，而覆盖闸门分母为全量原子（防遗漏与防编造口径冲突）→ 修复：trace 增 required 口径（业务字段任一非空或 not_found 才必查，optional 缺失列提示不阻断，commit a2dd1fb）→ build 幂等重跑放行
- 2026-11-13 目录零改动：git status 0 处变更（两次核对）
- 策划版文档：`spec-workflow/output-spec/核心流程杭州麻将好友房AI-策划版.md`（约 89KB，15 阶段）；泄漏正则零命中；AT-ID 覆盖必查口径 100%（required 339/339，optional 4 列提示不阻断）

### T5.1b all 全量重跑（run-mwfb5d3r-7 + 修复补跑）

- 链路：四子流程完整（扫描 → 查证 15 阶段（v4 Schema）→ 产出编写（阶段文档/索引/补充版/策划版四类）→ 装配校验（v2 全套：双文档合并 + schema_version 2 索引 + trace + 泄漏/覆盖/difference 校验））
- 产物：outputDir 2026-11-14/1-spec + 补充版 + 策划版
- 结果：查证 15/15 阶段全部成功零失败（L3 墙钟加固生效）；计划 88 agent、86 落 journal（ST-C13 规格文档与 ST-C14 策划版两 agent 中断未完成）→ 产出闸门「阶段 ST-C13 规格文档未生成」fail
- 修复路径（L1 坑二次实锤：resume 对无 result entry 静默跳过，直接 resume 无效）：journal 提取查证 result → one-shot 补跑 workflow（run-mwfgnueu-8 补 ST-C13 规格文档两分片；run-mwfh8aby-9 补 ST-C14 策划版分片；另发现原 run 的 ST-C14/C15 规格文档分片已落盘未合并，node merge ×3）→ 幂等 build 放行；期间另修两处机械问题（ST-C01 原子标题把骨架占位 `{AT-...}` 花括号当字面量致 verify 正则不匹配 ×8；策划版「（AT-ST-C09-007、008）」缩写标注违反 AT-ST-Cxx-nnn 完整形式 ×1）
- 最终产出：阶段 15 / 功能点 93 / 原子项 319；verdict confirmed 116 / partial 160 / not_found 43；difference consistent 65 / partial 64 / conflict 2 / unverified 188（unmarked 0，全部经 v4 Schema 标注）；trace 319 条必查覆盖 100%；策划版泄漏零命中 + AT-ID 覆盖 100%

### T5.2 AI 验收收口（run-mwfhvdzp-11，3 agent 并行）

- conflict 逐条复核（2/2 成立）：AT-ST-C02-008（打出财神仍刷财神红——`BoxHzmjMahColorUtil.applyJokerMahColor` 无已打出豁免、`BoxHzmjMah2DView` 牌河/放大两处反复刷红，证据属实）；AT-ST-C15-018（点炮胡/抢杠胡均落「吃胡」页——`BoxHzmjResultMid.ts:731` 仅自摸/吃胡二值切换，全仓 C_HuType 三处赋值无「点炮胡」「抢杠胡」文案，证据属实）
- 三章节逐行复核（ST-C01 通过；ST-C02/C05 轻微不通过→修复）：ST-C02 标题残留骨架指引「（有则填）/（无原子也列）」×2、ST-C05 残留生成过程说明行 ×1 + 行号引用未注明所属模板文件 ×1——4 处已修；内容维度（字段完整性/索引一致性/evidence 真实性抽 14 处无一失实/无幻觉/not_found 处理）三份全达标
- 策划版补跑章节抽检（ST-C13 算分/ST-C14 番型）：技术词残留 0、原子 ID 完整形式全覆盖、模板原文逐字保留；发现 3 处事实错误已修——ST-C13 440 行把四家飘分缩窄为「三个输家」（证据 AT-ST-C13-007/009 为每个/四个座位，且括号内正分与输家自相矛盾）；ST-C14 497/498 行「显示已飘次数/次数显示」无证据（飘计数仅写座位状态无 UI 呈现）且与飘财章「不残留任何飘次数标签」矛盾
- 待确认口径不一致（提示级遗留）：算分章对 13 个「partial + notes 仅服务端运算」原子不写待确认行、番型章对同类 17 个原子逐条写待确认行——内容均无编造，仅口径相反，见第 5 节遗留 L7
- 2026-11-13 目录零改动复核通过；修复后 build 复跑 exit 0（幂等跳过合并）

## 5. 遗留问题与下一步

- 遗留 L1/L4/L5/L6 见 `output-spec-generate-遗留问题清单.md`（L2 已于本版修复）。
- L3（查证墙钟 7200s 加固）效果由 T5.1b 全量重跑回填：**生效**——查证 15/15 阶段全部成功零失败（首跑 6/15 失败的墙钟超时场景未再现）。
- 新增遗留 L7（策划版待确认口径不一致）：算分章（ST-C13）对 13 个「partial + notes 仅服务端运算/客户端只展示」原子不写待确认行，番型章（ST-C14）对同类 17 个原子逐条写待确认行，两章口径相反；内容均无编造，属 Prompt 规则对「notes 为职责边界说明而非不一致记录」未明确界定所致。
- 下一步建议：
  1. L7 待确认口径统一：plannerPartPrompt 明确「notes 含『服务端判定/客户端只展示』职责说明且非不一致记录时，不写待确认行」（或反向统一），并补 example 断言
  2. STAGE_DOC_FORMAT 骨架占位去字面化：标题指引括号与 `{AT-...}` 花括号占位在两次全量跑中各被部分 agent 当字面量写入（T5.1b ST-C01 花括号 ×8、ST-C02 指引括号 ×2、ST-C05 生成说明行 ×1），建议骨架文本直接写干净形态 + 在硬性规则里注明「花括号/括号指引为占位说明必须去除」
  3. 策划版 AT-ID 标注完整形式硬约束：T5.1b 出现「（AT-ST-C09-007、008）」缩写（verify 正则不识别），建议在 prompt 转写硬规则里加「多原子项并列时每个都写完整 AT-ST-Cxx-nnn 形式」，或在 checkPlannerLeakage 后置一个缩写模式扫描
  4. L1/L4/L5/L6 按遗留清单推进

## 6. 引用说明

- 备份：`3-produce-outputs.v2-org-20261114.js`、`2-verify-stages.v3-org-20261114.js`
- 新工作版：3-produce-outputs.js（v3+v3.1）、2-verify-stages.js（v4）、4-assemble-verify.js（v3）、output-spec-generate.js（v2 三模式）
- 新脚本：`.opencode-workflows/scripts/{build-planner-trace,prepare-planner-doc-input}.mjs`（+ example）；扩展 `build-output-spec/verify-output-spec/assemble-output-spec-index`（+ example）
- 实验产物：`spec-workflow/output-spec/quality-compare/planner-experiment/策划版_ST-C01/05/02.md`
- runId：见第 1 节执行元数据表
- 关联文档：需求（R1~R10）/执行计划（T0.x~T5.x）/todo 文档（阶段状态）/优化台账 v4 行/优化指标对比 v4 列/遗留问题清单（L2 修复回填）
