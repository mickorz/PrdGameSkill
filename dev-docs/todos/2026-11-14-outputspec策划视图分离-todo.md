# TODO：outputspec 策划视图分离（阶段 0 已运行待评审，阶段 1~5 待执行）

- 日期：2026-11-14
- 来源：`dev-docs/planning/2026-11-14-outputspec策划视图分离执行计划.md`（任务编号 T0.x~T5.x 均指向该计划；需求 R1~R10 见 `dev-docs/requirements/2026-11-14-outputspec策划需求视图与技术实现视图分离.md`）
- 状态：进行中（阶段 0 实验已运行，T0.3 三检查点人工评审待做——**闸门未过不进阶段 1/2**）

## 阶段 0：策划版 Prompt 对照实验（已完成运行，待人工评审）

### 已完成

| 任务 | 状态 | 结果 |
|------|------|------|
| T0.1 实验脚本 prepare-planner-experiment.mjs | 已完成 | example 自检 16 项全绿；真实数据跑通（3 阶段 / 50 原子项，单文件 <14KB） |
| T0.2 策划版 Prompt 草案（写进实验脚本） | 已完成 | 转写而非复制 + 不编造原则 + 技术词硬性禁令 |
| T0.3 运行（用户触发 experiment-planner-projection.js） | 已完成（2026-11-14） | runId run-mwf7e6nc-2：3 个 agent 全部成功（策划版 ST-C01 14188 tok / ST-C05 26162 tok / ST-C02 18464 tok），耗时 626.4s，共 58814 tokens；产物 `spec-workflow/output-spec/quality-compare/planner-experiment/策划版_ST-C01.md`、`策划版_ST-C05.md`、`策划版_ST-C02.md` |

### 待办（当前最优先）

- [ ] **T0.3 三检查点人工评审**（计划第 3 节 T0.3，闸门）：
  1. 无技术泄漏——用计划第 9 节泄漏正则清单 grep 三份产物核验（临时命令即可，正式化在 T3.3）
  2. 信息不丢失——对照现有技术补充版同章节：财神高亮等差异条目仍以业务语言存在
  3. 可追溯——每条补充行有 AT-ID，能回查 feature_index.json 证据
- 评审不过 → 修 Prompt 草案重跑实验（仍不碰阶段 2）；评审通过 → 进入阶段 1/2（可并行改造）

## 阶段 1：3-produce-outputs.js 策划版产出改造（P0，评审通过后）

- [ ] T1.1 备份 `3-produce-outputs.js` → `3-produce-outputs.v2-org-20261114.js`
- [ ] T1.2 新增 `slimPlannerEvidence(r)`（业务字段隔离，不含 clientLogic/evidence 路径）+ `plannerPartPrompt(sec, evidence)`（以 T0.2 定稿草案为准）
- [ ] T1.3 新增 `plannerPartPath(sec)` = `<outputDir>/runtime/planner-parts/part-NN.md`；intro/nouns 分片复用 `copyPartPrompt` 换目标路径
- [ ] T1.4 投影任务开关：`skipPlanner`/`plannerOnly` 互斥（同 true 报错）；`plannerOnly` 只进策划版任务；args 增加 `plannerPath`（默认 `spec-workflow/output-spec/核心流程杭州麻将好友房AI-策划版.md`）
- [ ] T1.5 `buildConfigText` 增加 `plannerPath`/`plannerParts`/`sourceSpecDir`/`outputDir`；落盘闸门按开关分支
- [ ] T1.6 头注释补 v3 段落
- 验收：单阶段模拟产出两套分片；plannerOnly 时技术任务零调度（静态断言）；skipPlanner 行为与 v2 完全一致

## 阶段 2：2-verify-stages.js 业务语义与差异 Schema（P1，评审通过后，可与阶段 1 并行）

- [ ] T2.1 备份 `2-verify-stages.js` → `2-verify-stages.v3-org-20261114.js`
- [ ] T2.2 返回值与索引顶层 `schemaVersion: 2`；原子项新增 `businessBehavior{trigger,condition,action,result}`、`difference`（consistent/partial/conflict/unverified）、`differenceDetail`、`verification{businessRuleVerified,unverifiedReason}`；`clientObserved` 派生不进 Schema
- [ ] T2.3 `stageVerifyPrompt` 增加第三步业务语义与差异判定（部分证据不足 = unverified；conflict 必给 differenceDetail + 证据；禁止 confirmed 直接写 businessRuleVerified=true）
- [ ] T2.4 校验循环扩展（not_found ⇒ difference 兜底 unverified；conflict ⇒ detail+evidence 非空；differenceStats conflict 优先计数）
- [ ] T2.5 头注释补 v4 段落（含「Schema 变更后不要用旧 run resume 重放阶段 2」警示）
- [ ] T2.6 新 Schema 质量验收（用户触发）：选 ST-C05 单阶段真实查证，人工复核 businessBehavior 玩家语言/difference 分布/businessRuleVerified 误标
- 验收：最小合法/非法 difference JSON 过校验逻辑断言；T2.6 样本人工复核通过

## 阶段 3：装配与校验扩展（P1，依赖阶段 1+2）

- [ ] T3.1 备份策略确认（倾向依赖 git 历史，scripts/ 下不新增备份文件）
- [ ] T3.2 `build-output-spec.mjs`：`stepMergeSupplement` 泛化为 `mergeDocumentParts`，技术/策划版各调一次
- [ ] T3.3 `verify-output-spec.mjs` 新增 `checkPlannerLeakage(plannerPath, allowlist)`（第 9 节正则清单）+ difference 覆盖统计段进 verify-report
- [ ] T3.4 `assemble-output-spec-index.mjs`：feature_index 顶层 `difference_stats`，原子项透传新字段
- [ ] T3.5 `4-assemble-verify.js`：check plannerPath 存在（skipPlanner 跳过）；返回值增加 plannerPath
- [ ] T3.6 两个 example 增加用例（策划版合并/泄漏命中与放行/difference 统计/trace 覆盖）
- [ ] T3.7 新增 `build-planner-trace.mjs`（R9）+ AT-ID 覆盖检查（覆盖率非 100% fail）
- 验收：example 全绿；首跑 feature_index + 人工拼装分片跑全链路；2026-11-13 目录只读零变化断言

## 阶段 4：主编排 outputMode 三模式（P1，依赖阶段 3）

- [ ] T4.1 args 增加 `outputMode`（all 默认/planner-only/legacy）、`plannerPath`、`sourceSpecDir`（只读，默认 2026-11-13）、`outputDir`（可写，默认 2026-11-14）
- [ ] T4.2 legacy：传 `skipPlanner=true`，行为等同 v2
- [ ] T4.3 planner-only：跳过子流程 1/2，从 sourceSpecDir 磁盘构造 scan/verify；子流程 3 `plannerOnly=true`；子流程 4 走策划版分支，绝不重写 sourceSpecDir
- [ ] T4.4 all：查证与产出统一写 outputDir，策划版最终文件仍输出 plannerPath
- [ ] T4.5 路径冲突检查 fail fast（outputDir === sourceSpecDir 报错；outputDir 已含 feature_index.json 报错）；返回汇总补 plannerPath/differenceStats/outputDir
- 验收：代码走查三模式传参路径；真实行为并入阶段 5

## 阶段 5：全量重跑与收尾（用户触发，依赖阶段 4）

- [ ] T5.1 先 `outputMode=planner-only` 跑通（零查证成本，核对 2026-11-13 目录零改动）→ 再 `outputMode=all` 全量重跑（落 outputDir 新目录）
- [ ] T5.2 三级验收收口：verify-report 全部通过；ST-C01/05/02 逐行人工复核（R8 三检查点）；difference_stats 分布合理（conflict 逐条复核）
- [ ] T5.3 文档收尾：执行进度.md 里程碑更新；演进报告 v3；新超时/Schema 表现回填 experience

## 优先级与提交计划

1. 当前：T0.3 三检查点人工评审（闸门）
2. 评审通过：阶段 1 + 阶段 2 并行改造 → 阶段 3 → 阶段 4 →（用户触发）阶段 5
3. 每阶段完成即 commit + push（提交信息见计划第 13 节）
