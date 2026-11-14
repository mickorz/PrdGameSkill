# OSG-W4 服务端规则补证样本（T0.2 / T0.4 交付物）

- **日期**：2026-11-14
- **性质**：第一阶段（只读调查）交付样本，非全量产物。后续正式产物由 `server-rule-verify/` workflow 生成到本目录（samples 后缀区分）。
- **上游基线**：`spec-workflow/output-spec/2026-11-14/1-spec/feature_index.json`（319 原子，schema_version=2，v2 产物只读）
- **调查事实**：`dev-docs/research/2026-11-14-OSG-W4-T0服务端结构与职责调查报告.md`
- **判定规则**：`dev-docs/design/2026-11-14-OSG-W4-L7分类与玩法配置作用域设计.md`

## 文件清单

| 文件 | 内容 | 规模 |
|---|---|---|
| `symbol-index.json` | 服务端符号索引（S2.0）：common_game/hzmj_server/mah_frame 三目录确定性扫描（class/struct、类方法、自由函数、配置项 json_key 含默认值元数据；pb 生成文件排除单独计数），供 agent 按 Atom 查索引定位 file:line | 134 文件 / 1793 符号（class 144 / 方法 1356 / 自由函数 258 / 配置项 35） |
| `server-evidence_sample.json` | 服务端证据（29 条真实 file:line，common_game/hzmj_server/mah_frame 三层；S2.1 新增 15 条覆盖三 Stage 全部 23 条原 unknown） | 29 条 |
| `scope-index_sample.json` | 玩法配置作用域判定：ST-C01/02/04 全部 33 原子 + ST-C15-018 conflict 条目（S1.3 补据），共 34 条目：active 14 / conditional 20 / unknown 0 / inactive 0（S2.1 深查落判：23 条 unknown 全部依服务端只读源码证据升级，二审优先三项闭环） | 34 条 |
| `difference-review_sample.json` | 差异二次复核对照（14 条代表性条目，含 v2 全部 2 个 conflict；全部 pending 未合并；含 effectiveDifference 与确定性迁移统计 66/64/2/187；S1.1 修订：l7Projection 手写统计漂移经重算修正 2/10/2/0 → 1/11/2/0；S2.1：6 条 unknown 复核字段依服务端深查证据升级为 active×5/conditional×1，difference 结论不变） | 14 条 |
| `l7-classify_sample.json` | L7 分类产物（S1.1 起，S2.1 重算）：classify-l7.mjs 按设计 4.1 矩阵对 14 条复核样本的确定性分类，分布 verified 1 / verification_required 11 / decision_required 2 / not_applicable 0（S2.1 落判后 l7 分布不变，仅 6 条目 scope 字段经复核字段更新为 active/conditional，来源 review-field）；全部 pending → l7Approved 全 0（未批准不入正式索引）；AT-ST-C02-008 与 AT-ST-C15-018（S1.3 补据后）均采证据级 scope（client-visual → active → decision_required） | 14 条 |

## T0.4 局部验收结果（逐条对照需求）

| 验收项 | 结果 | 证据 |
|---|---|---|
| 服务端证据真实存在 | 通过 | 14 条 SVE 均为只读调查实取 file:line，无编造；noServerEvidence=true 的原子如实留空 |
| 玩法配置与调用链可核 | 通过 | conditional 条目均带 configCondition + callPath；好友房 19 项 JSON 配置入口（game_logic.cpp:19）已定位 |
| 通用能力不自动判好友房冲突 | 通过 | AT-ST-C02-004（cai_shen_type 默认白板、可配翻）判 conditional 而非 conflict；AT-ST-C01-006/007（三牢/8 倍为配置档位）同 |
| 缺服务端证据不自动产生冲突 | 通过 | 22 条 unknown 全部维持原 difference 并标 verification_required，无一改判 conflict |
| 真实客户端视觉冲突不被消除 | 通过 | AT-ST-C02-008、AT-ST-C15-018 两条 conflict 全部维持并转 decision_required（ui-conflict-stands-alone） |
| 复核前后 difference 对比 | 已输出 | difference-review_sample.json 的 baseline 与 afterReviewProjection（由 previousDifference→reviewedDifference 确定性迁移计算：66/64/2/187，合计 319；批准前 v2 保持 65/64/2/188） |

## S1.1 L7 分类脚本（2026-11-14）

- 脚本：`.opencode-workflows/scripts/classify-l7.mjs`（输入四件套：feature_index 基线 + scope-index + server-evidence + difference-review；按设计文档 4.1 矩阵输出 `l7` + `reviewStatus` + `effectiveDifference`；conflict 条目采证据级 scope 见设计 3.3；缺 scope 一律 unknown 不缺省 inactive）
- 自检：`.opencode-workflows/scripts/classify-l7.example.mjs` 全绿（真实样本重跑分布一致 / 矩阵 4×4 全枚举 / 缺失作用域 / 证据级 scope / approved 与 rejected / 完整性校验失败路径 / CLI 失败路径）
- 运行方式（确定性命令，可自行执行）：`node .opencode-workflows/scripts/classify-l7.mjs <featureIndex> <scopeIndex> <serverEvidence> <differenceReview> <outputJson> [date]`
- 本目录 `l7-classify_sample.json` 即 example 以三份样本 + v2 基线跑出的产物（date=2026-11-14）
- 修复登记：`difference-review_sample.json` 顶层 `l7Projection` 手写统计与条目不符（AT-ST-C01-002 二审撤销升级建议后未同步重算），已按重算修正为 verified 1 / verification_required 11 / decision_required 2 / not_applicable 0；经验沉淀见 `dev-docs/experience/手写统计块漂移-l7Projection.md`

## S1.2 L7 消费链路：策划版四口径投影（2026-11-14）

- `prepare-planner-doc-input.mjs` 新增可选参数：`<l7ClassifyPath>`（l7/l7Reason 内嵌进 planner-evidence 原子项，条目 atomId 必须在基线内防漂移）与 `<stageIdsCsv>`（阶段过滤，如 ST-C01,ST-C02,ST-C04）
- `3-produce-outputs.js` 策划版 Prompt（内存/磁盘两链路共用 `plannerDocRules()`）：带 l7 字段原子按四口径生成差异行——verification_required →「规则待验证：缺什么证据或依赖什么配置」；decision_required →「待策划裁决：需求为「…」，实际表现为「…」」；verified / not_applicable → 不写差异行；不再从 notes 猜测差异结论，无 l7 数据原子保持现行为
- 验收投影（l7-classify_sample.json + v2 基线 + ST-C01/02/04 过滤，33 原子、l7 内嵌 13/14）：产物 `spec-workflow/output-spec/2026-11-14/v3-planner-sample/`；11 规则待验证行全覆盖、C02-008 待策划裁决、C04-013 无差异行、泄漏零命中、v2 零改动

## S1.3/S1.4 复核自洽闸门与三阶段回归（2026-11-14）

- `verify-output-spec.mjs` 新增导出 `checkL7Sidecars(files)`（五道闸门）：① classify 复跑（导入 classifyL7，矩阵自洽 / evidenceIds 存在 / 缺 scope 一律 unknown / 手写统计块交叉校验）；② l7-classify 产物与复算逐条对比（防落盘后手改）；③ Sidecar atomId 全部对齐 trace_index；④ conflict 条目必须带证据级 scope（设计 112 硬闸门）；⑤ 审批状态独立（pending/rejected 不进正式索引，approved 按 effectiveDifference 合并）
- `verifyOutputSpec` opts 新增可选 `l7`（维度 7），链路接线随 S2.3/S3 落地
- 样本补据：C15-018 补 scope-index 条目（client-visual active），scope 样本 34 条目；l7-classify_sample 重算重生成（仅 C15-018 scope 字段变化，stats 不变）
- S1.4 回归：classify-l7.example 钉死回归锚点（34 条目 / active 14 / conditional 20 / unknown 0 / l7 1/11/2/0，S2.1 落判后同步更新）；三 example 全绿；v2 零改动（最后改动仍为 OSG-W3 收尾 commit c21dbb1）

## S2.0 符号索引 + S2.1 三 Stage 深查落判（2026-11-14）

- **S2.0 符号索引**：`build-symbol-index.mjs`（确定性扫描无 LLM，*.pb.h/*.pb.cc 生成文件排除单独计数）+ example 全绿（锚点 file:line 人工核对 / 列首调用与头文件声明排除 / 配置项 35 条含默认值元数据 / query 子命令 / 两次构建逐字节一致）；query 用法：`node .opencode-workflows/scripts/build-symbol-index.mjs query symbol-index.json <term> [class|method|function|config-key]`
- **S2.1 深查落判**：23 条 unknown 全部依服务端只读源码证据升级，unknown 清零（active 14 / conditional 20 / unknown 0 / inactive 0）；二审优先三项闭环：
  - ① AT-ST-C02-007（打财神无爆头前置）→ **active**：CheckPlay（com_play.cpp:53-85）无爆头/敲响前置判定，打财神仅触发飘财窗口与飘级结算；com_action.cpp:165 的「禁打财神值」实为吃禁手黑名单的翻财神归一化处理（CalcChowForbidMahs），非打出前置——矛盾候选解除
  - ② AT-ST-C01-006/007（三牢/固定 8 倍）→ 维持 **conditional**：服务端默认 banker_level_type=0（1 牢、2 倍起步）已证，创房 UI 实际下发值待 S2.2 客户端核对
  - ③ ST-C04 askid 裁决链 → **全量落判**：级别常量胡 4 > 碰=杠 3 > 吃 2（macros.h:203-206）+ ConAction 最高级未响应阻塞/已响应立即执行（con_action.cpp:19-62）+ 碰/直杠升序扫描座位最小独得（com_pung.cpp:66 / com_kong.cpp:80）+ 胡按座位距离加权近者优先（com_action.cpp:826-838）+ 一炮多响关闭（com_action.cpp:534 注释直证）
- 其余落判：C01-002（定庄先于骰子/发牌，Step 链 AddNext 直证）→ active；C01-008（三牢封顶，UpdateBankerLevel L369-370 + hzmj 无 banker_continue_type 覆写入口）→ active；C02-001/002/003（牌墙 136 张，InitData + macros.h:218-222）→ conditional（enable_two_suit/del_feng 默认 false）；C02-006（可打财神）→ active；C02-009/010/011（不能吃/碰/杠打出的白板财神）→ conditional（cai_shen_type=0 默认；翻财神时白板为替身）；C02-012（财神不能点炮胡，JudgeDiscard L363-364 注释直证）→ active
- 回归：l7-classify_sample 重算重生成（l7 分布不变 1/11/2/0，仅 6 条目 scope 字段更新且来源为 review-field——scope 优先级：difference-review 复核字段 > scope-index Atom 级 > unknown，深查复核结论须同时落 DR 复核字段与 scope-index）；classify-l7.example S1.4 锚点同步（stats active 14/conditional 20/unknown 0）；三 example 全绿；v2 零改动

## 关键发现摘要（详见调查报告）

1. **定庄/牢庄/财神三个核心规则都是好友房配置项**（first_banker_type / banker_level_type / cai_shen_type），需求原文把它们写成无条件规则——「查到实现」与「需求满足」之间隔着配置确认，这正是 scope 层存在的意义。
2. 需求「首庄三牢、庄闲固定 8 倍」与默认配置（1 牢、2 倍起步）**存在配置依赖分歧**，已标记待策划确认（未判 conflict，规则 3）。
3. AT-ST-C02-007（打出财神无前置限制）曾列 S2 矛盾候选优先核验，**S2.1 已闭环**：com_action.cpp:165 的「禁打财神值」是吃禁手黑名单的翻财神归一化处理（CalcChowForbidMahs），CheckPlay 无爆头前置，判 active（矛盾候选解除）。
4. AT-ST-C04-013（吃仅限上家）服务端直证，是本轮唯一建议升 consistent 的原子（pending）。
5. 二审修订（2026-11-14）：AT-ST-C01-002 的 active 结论撤销（注册顺序不等于执行顺序，未证前标 unknown）；l7 与 reviewStatus 拆为独立字段并新增 effectiveDifference；conflict 条目提供证据级 scope（evidenceScopes）。
