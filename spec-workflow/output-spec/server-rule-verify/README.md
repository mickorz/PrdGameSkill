# OSG-W4 服务端规则补证样本（T0.2 / T0.4 交付物）

- **日期**：2026-11-14
- **性质**：第一阶段（只读调查）交付样本，非全量产物。后续正式产物由 `server-rule-verify/` workflow 生成到本目录（samples 后缀区分；正式产物为 `scope-index.json` / `server-evidence.json` / `difference-review.json` / `l7-classify.json`，S2.3 workflow 就绪，试运行由用户触发）。
- **上游基线**：`spec-workflow/output-spec/2026-11-14/1-spec/feature_index.json`（319 原子，schema_version=2，v2 产物只读）
- **调查事实**：`dev-docs/research/2026-11-14-OSG-W4-T0服务端结构与职责调查报告.md`
- **判定规则**：`dev-docs/design/2026-11-14-OSG-W4-L7分类与玩法配置作用域设计.md`

## 文件清单

| 文件 | 内容 | 规模 |
|---|---|---|
| `symbol-index.json` | 服务端符号索引（S2.0）：common_game/hzmj_server/mah_frame 三目录确定性扫描（class/struct、类方法、自由函数、配置项 json_key 含默认值元数据；pb 生成文件排除单独计数），供 agent 按 Atom 查索引定位 file:line | 134 文件 / 1793 符号（class 144 / 方法 1356 / 自由函数 258 / 配置项 35） |
| `server-evidence_sample.json` | 服务端证据（29 条真实 file:line，common_game/hzmj_server/mah_frame 三层；S2.1 新增 15 条覆盖三 Stage 全部 23 条原 unknown） | 29 条 |
| `scope-index_sample.json` | 玩法配置作用域判定：ST-C01/02/04 全部 33 原子 + ST-C15-018 conflict 条目（S1.3 补据），共 34 条目：active 14 / conditional 20 / unknown 0 / inactive 0（S2.1 深查落判：23 条 unknown 全部依服务端只读源码证据升级；S2.2 创房 UI 核对：20 条 conditional 条目 configCondition 落客户端创房默认值核对结论，unresolved 5 条清零） | 34 条 |
| `difference-review_sample.json` | 差异二次复核对照（14 条代表性条目，含 v2 全部 2 个 conflict；全部 pending 未合并；含 effectiveDifference 与确定性迁移统计 66/64/2/187；S1.1 修订：l7Projection 手写统计漂移经重算修正 2/10/2/0 → 1/11/2/0；S2.1：6 条 unknown 复核字段依服务端深查证据升级为 active×5/conditional×1，difference 结论不变） | 14 条 |
| `l7-classify_sample.json` | L7 分类产物（S1.1 起，S2.1 重算）：classify-l7.mjs 按设计 4.1 矩阵对 14 条复核样本的确定性分类，分布 verified 1 / verification_required 11 / decision_required 2 / not_applicable 0（S2.1 落判后 l7 分布不变，仅 6 条目 scope 字段经复核字段更新为 active/conditional，来源 review-field）；全部 pending → l7Approved 全 0（未批准不入正式索引）；AT-ST-C02-008 与 AT-ST-C15-018（S1.3 补据后）均采证据级 scope（client-visual → active → decision_required） | 14 条 |
| `scope-index.json` | **正式产物**（S2.3 试运行 ST-C01 生成）：定庄与轮庄 8 原子（active 3 / conditional 5 / unknown 0 / inactive 0） | 8 条 |
| `server-evidence.json` | **正式产物**（S2.3 试运行 ST-C01 生成）：三根目录真实 file:line 证据 | 29 条 |
| `difference-review.json` | **正式产物**（S2.3 试运行 ST-C01 生成）：ST-C01 全部 8 原子复核条目（pending；含 5 条 unverified→consistent 升级建议与 afterReviewProjection 70/64/2/183） | 8 条 |
| `l7-classify.json` | **正式产物**（S2.3 试运行 ST-C01 生成）：reviewed 8/319，l7 verified 3 / verification_required 5 / decision_required 0 / not_applicable 0，l7Approved 全 0 | 8 条 |

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

## S2.2 创房 UI 配置下发值核对（2026-11-14）

- 客户端证据：`E:/WorkProjects/Lobby/xuanwulobby`（大厅仓库，只读）：gameId 42320 = `GAME_HZMJ_HYF`（GameRuleConfig.ts:83）→ `BoxRoomGameRuleButtonConfigHZMJ` UI 行配置（:311）与 `DefaultConfigHZMJ` 创房默认参数（RuleHzmj.ts:6-54，「与服务端 game_rule 字段对齐」）；创房未缓存本地规则时全量取默认下发（LobbyCreateRoomView.ts:807-825），`FIXED_RULE_FIELDS_BY_GAME` 注释（GameRuleConfig.ts:363-372）证明 UI 无行的字段协议仍固定下发默认值
- 核对结论（落 19 条 conditional 条目 configCondition + C02-008 evidenceScopes note）：
  - **创房默认笃三老庄**（banker_level_type=2，RuleHzmj.ts:29 + UI 行 L276-287 默认选中）→ 服务端 banker_level=3 **三牢起步、庄闲 8 倍**，与需求「首庄三牢/固定 8 倍」**默认一致**（S2.1 时依据服务端 LoadBoxJsonConfig 默认 0 误判为不一致，S2.2 修正：服务端默认值只是缺 key 兜底，客户端恒全量下发）；玩家可改平庄起/笃二老庄 → 维持 conditional
  - 庄闲放铳(庄三) 默认开（enable_banker_discard_hu=1，L31/288-298）→ ST-C04 多人可胡门槛默认满足（配合默认三牢），玩家可改自摸胡 → 维持 conditional
  - 白板财神默认（cai_shen_type=0，L27/265-275），**未锁定**——玩家可选翻财神 → C02-004/005/009/010/011 维持 conditional，unresolved 清零
  - first_banker_type/rotate_banker_type/draw_continue_banker UI 未暴露 → 恒发默认 0/0/1（随机首庄/赢家坐庄/流局连庄）；rotate type=1 分支好友房不可达
  - 缺一色仅 2/3 人局展示且默认勾选（enable_two_suit=1，L45/364-369）→ 2/3 人局服务端剔万字 100 张、4 人局（默认人数）136 张；无风牌默认不勾（del_feng=0）→ 风 16/箭 12 默认在
- unresolved 5 条全部清零（C01-001/004/006/007、C02-004），无转人工确认项；stats 不变（active 14/conditional 20/unknown 0/inactive 0）；l7-classify 重算一致；三 example 全绿；v2 零改动

## S2.3 服务端补证四子流程 workflow 化（2026-11-14，脚本就绪，试运行待用户触发）

- **workflow 套件**（`.opencode-workflows/workflows/server-rule-verify/`，主编排 + 四子流程显式 scriptPath 调用，注册表只扫一级目录不进注册表；调用方式：workflow 工具 scriptPath `./.opencode-workflows/workflows/server-rule-verify/server-rule-verify.js` + args `{ stageIds: 'ST-C01' | 'ST-C01,ST-C04' | 'ALL', date }`）：
  - `server-rule-verify.js` 主编排：输入就位检查（基线/trace）→ 四子流程内存链式传参 → 汇总返回
  - `1-scan-server.js`：`commandSuccess` 重建 symbol-index.json（确定性）+ agent 回读 stats
  - `2-match-atoms.js`：`prepare-verify-atoms.mjs` 分片输入（功能点贪心不拆散：目标 ≤12 原子/片、硬上限 24、超限功能点独立成片；既有正式条目注入幂等参考、**不读 *_sample** 避免抄人工样本；旧分片清理）→ agent 按分片查 `query` CLI + 读源码切片（±30 行）→ 匹配候选落盘（落盘闸门）
  - `3-verify-scope.js`：agent 逐原子落判（active/conditional/inactive/unknown 判定口径 + S2.2 客户端创房默认值口径内嵌 + SVE 证据条目 + **DR 复核字段双写**（S2.1 经验闸门）+ conflict 证据级 evidenceScopes + SVE 编号 `SVE-<stageId>-P<partNo>-NN`）→ verify-output 落盘
  - `4-review-difference.js`：复核五规则 pending 建议（reviewRule 前缀白名单）→ **merge-verify-output.mjs** 确定性装配闸门 → classify-l7 CLI 重算 → **verify-output-spec check-l7 CLI 新子模式**（五道闸门 + 报告，不触碰 v2 基线目录）→ l7 统计回读
- **确定性脚本**（`.opencode-workflows/scripts/`，均带 example 全绿）：
  - `prepare-verify-atoms.mjs`（example 30 项）：分片输入生成 + 旧分片清理 + manifest
  - `merge-verify-output.mjs`（example 66 项，含 merge→classify→check-l7 全链端到端）：双写闸门/覆盖闸门/SVE 形状与幂等（同 id 同证据指针原位替换或去重放行、指针不同 fail）/reviewRule 白名单/未处理阶段条目保全/reviewStatus 保全（同建议保持 approved、建议变化重置 pending）/classifyL7 矩阵回填 l7/effectiveDifference/l7Basis + baseline/afterReviewProjection/l7Projection 三统计块重算
  - `verify-output-spec.mjs` 新增 `check-l7` CLI 子模式（example 场景 18）：只跑 L7 Sidecar 五道闸门（不跑维度 1-6、不写 specDir，v2 基线只读不触碰），报告写 `<reportOutDir>/l7-check-report.md`
- 正式产物（本目录，无 _sample 后缀）：`scope-index.json` / `server-evidence.json` / `difference-review.json` / `l7-classify.json`（首跑起累积，人工样本只读不改）；中间产物 `runtime/verify-input|match-output|verify-output|review-output/` + `runtime/spec-check/l7-check-report.md`
- 生成前问询结论：速度优先（质量靠确定性闸门兜底）+ 分析模型 deepseek flash + 并发 16；五脚本 wf-syntax-check 全过；六 example 全绿（build-symbol-index / classify-l7 / prepare-planner-doc-input / prepare-verify-atoms / merge-verify-output / verify-output-spec）
- **试运行验收口径**（ST-C01 单阶段，用户触发）：正式四件生成 + 五道闸门通过 + 与人工样本 ST-C01 八原子条目对照（scope 结论/SVE 摘录方向一致即链路贯通；分歧条目人工复核）

### S2.3 试运行结果（ST-C01，2026-11-14，链路贯通 ✓）

- **执行**：runId `run-mwg3hayc-12`（三轮修复后贯通）：6 agent（4 journal 回放 + 2 新跑），wall 133s，tokens 1042（deepseek flash；结构化输出因网关 thinking 模式不支持 json_schema tool_choice 自动降级 prompt JSON 模式）
- **三轮卡点与修复**（详见 `dev-docs/experience/server-rule-verify试运行agent输出漂移与闸门容差.md`）：① match 摘要 partFile 回完整路径 → prompt/schema 明确格式 + 校验归一化；② 落判证据引用萧山变体文件（xiaoshanmj_server，三根目录之外）→ prompt 加三根目录硬约束（chunanmj/hzmj2r/tonglumj/xiaoshanmj 变体目录与其他玩法目录禁止引用）；③ 共享证据同 id 跨原子复制 + 摘录截断漂移 → merge 判等基准收窄为证据指针（layer/file/location/symbol/configKeys，摘录不计入），同 id 同指针去重放行保留首个 + prompt 共享证据只写一条；example 补用例 C2（66 项全绿）
- **产物**：正式四件落盘（`scope-index.json` 8 条：active 3/conditional 5/unknown 0/inactive 0；`server-evidence.json` 29 条；`difference-review.json` 8 条全 pending，afterReviewProjection 70/64/2/183（5 条 unverified→consistent 升级建议）；`l7-classify.json` reviewed 8/319、l7 3/5/0/0、l7Approved 全 0）；五道闸门通过（`runtime/spec-check/l7-check-report.md`）
- **与人工样本对照**（ST-C01 八原子）：**完全一致 4**（C01-001/005/006/007，scope 与 l7 均一致）；**样本未覆盖 2**（C01-003/008 的 l7 样本 DR 无条目，正式版为中性 pending/升级建议，非分歧）；**真分歧 2**：
  - AT-ST-C01-002（掷骰、发牌前确定庄家）：l7 样本 verification_required → 正式 verified（pending）——agent 依 mah_frame/com_basic/com_ju.cpp:43/166（Step 链 AddNext 执行顺序）建议 unverified→consistent，与 S2.1 人工落判结论（定庄先于骰子 Step 链直证）方向一致，属补上样本 DR 缺失的升级建议，待人工批准
  - AT-ST-C01-004（庄家自摸连庄）：scope 样本 conditional → 正式 active——样本以 rotate_banker_type 两分支连庄口径不同（type=1 分支好友房不可达）保守判 conditional，agent 以 com_ju.cpp:168 / com_result.cpp:358 / base_data.cpp:950 / com_context.cpp:456 四条证据判可达口径统一 active；均属可辩护区间，转 S3 人工裁决（reviewStatus pending 保证未批准前不进正式索引）
- **结论**：链路贯通验收通过；scope 真分歧率 1/8，升级建议质量与 S2.1 人工结论对齐；S4 全量跑（12 Stage / 311 原子）可复用本链路

## S3.1 需求差异裁决清单（2026-11-14，交策划）

- `需求差异裁决清单.md`：v2 全部 2 个 conflict（AT-ST-C02-008 财神牌河高亮 / AT-ST-C15-018 胡牌方式标注文案）的策划可读双栏对照（需求拆句 vs 实现），复核规则 `ui-conflict-stands-alone`，差异维持 conflict、L7 decision_required，pending 人工裁决（A 改客户端 / B 改需求 / C 其他 + approved/rejected 裁决栏）
- 附 A：试运行 ST-C01 的 5 条 unverified→consistent 升级建议（AT-ST-C01-001/002/004/005/008，复核规则 `evidence-is-not-consistency`）批量批准表，含 AT-ST-C01-004 scope 分歧注记（样本 conditional vs 试运行 active，批准即采 active）；批准后经 S3.3 合并进 v3，v2 基线只读

## S3.3 v3 复核合并脚本（2026-11-14，就绪，正式合并待裁决回传）

- `assemble-output-spec-index.mjs v3 <v2SpecDir> <verifyDir> <outDir> <date>`：读 v2 `feature_index.json`（只读，sha256 写前后校验不变）+ 本目录正式三件（scope-index / server-evidence / difference-review），把 reviewStatus=**approved** 条目的复核结论合并进 v3 新目录：approved 采 reviewedDifference，pending/rejected 维持基线，未复核原子不动；每复核原子新增 l7（终局矩阵视图）/l7_basis/review_status 等字段；差异统计双路互验；输出 `feature_index.json`（schema_version 3 + v3_merge 溯源块）
- 裁决流程：`需求差异裁决清单.md` 回传 → approved/rejected 落 difference-review 条目 reviewStatus → 跑 v3 子命令出正式 v3 索引（S3.3 验收：v3 differenceStats 与 approved 合并结果一致、v2 hash 不变）；example 场景 9/10 全绿 + 真实数据冒烟通过（0 approved → v3 统计=基线）

## S3.2 批跑：ST-C02 / ST-C04 复核（2026-11-14，scope 证据就位阶段）

- **执行**：runId `run-mwg59v7b-13`（一轮卡点修复后续跑贯通）：12 agent（11 journal 回放 + 1 新跑 L7 回读），wall 21s，tokens 861；ST-C02 12 原子（1 片）+ ST-C04 13 原子（2 片）；卡点：merge 扫到 ST-C01 试运行遗留分片 → 修复 merge 按分片 stageId 过滤（非目标遗留跳过不消费，跨阶段混入仍 fail，目标阶段零条目 fail；详见 experience 文档坑 4），merge example 用例 E 扩为 E1/E2/E3
- **产物**（正式三件累积至 33 条 scope（active 23/conditional 10）+ 33 条 DR + 98 条 SVE，l7-classify reviewed 33/319，l7 18/14/1/0，五道闸门通过）：本轮 scope 25 条（active 20/conditional 5/unknown 0）、SVE 新增 69（总 98）、建议 17 条 pending（15 条 unverified/partial→consistent 升级 + 2 条维持：C02-008 conflict 维持 `ui-conflict-stands-alone`、C04-011 partial 维持）
- **与 S2.1 人工样本对照**（ST-C02/C04 25 原子）：
  - scope：**一致 16 / 分歧 9**（全部为样本 conditional → 正式 active，agent 以多条直接证据判可达口径恒定；分歧原子：C02-008（conflict 原子 evidenceScopes 正确保留 client-visual，仅服务端侧 scope 表述收窄）/009/010/011（财神吃碰杠）、C04-005/006/007/009/010（多人胡/近者优先/顺延）；批准相关 DR 建议即采正式 active 口径，需保守 conditional 请在裁决清单备注——同 C01-004 注记模式）
  - DR：样本覆盖条目一致 3 / 分歧 5（正式更进取：C02-006/007/009、C04-001/012 建议 partial/unverified→consistent，其中 C04-001 优先级次序与 S2.1 裁决链证据（macros.h:203-206 级别常量）方向一致）；样本未覆盖 17 条为正式新增建议
- **S3.2 partial 复核进度**：v2 的 64 条 partial 中已复核 3 条（证据就位三阶段 ST-C01/02/04），2 条建议升级（C02-006、C04-012）；其余 partial 原子随 S4.1 分批补证时逐阶段复核

## S4.1 第二批：行牌 复核（ST-C05~C10，2026-11-14）

- **执行**：runId `run-mwg8iegw-1`：39 agent（一次贯通零卡点，3-verify prompt file 字段加固生效），wall 4868s / 12127 tok；110 原子（吃碰杠 28、杠后补牌 14、胡 15、飘财 20、杠开杠飘 12、吃碰禁手 21），12 片
- **产物**（正式三件累积 215 scope + 215 DR + 601 SVE；l7-classify reviewed 215/319，l7 133/79/2/1，五道闸门通过）：本批 90 条建议 pending；scope active 94/conditional 14/unknown 1/inactive 1（全库首例）
- **值得注意条目**：
  - **AT-ST-C10-016 unknown**：「提起/横滑出虚影」纯客户端表现，服务端仅出牌消息校验（com_action.cpp:213-274），无拖动相关消息/状态——诚实 unknown → verification_required
  - **AT-ST-C10-021 inactive（全库首例，待策划确认）**：「补进的牌仍在禁张内不能打」——禁打判定 is_danfang 二选一（algorithm.cpp:380-388：单放牌只比 play_limit.dfs、手牌比 hands），补进牌走单放路径，而 hzmj 全部 play_limit 写入只填 hands（吃碰杠 com_action.cpp:151-1xx）→ 禁打名单对补进牌数据上永不命中 → 判 inactive（l7 not_applicable）；基线 notes 亦指出「补进的牌是否被拦完全取决于服务端是否按单放字段下发」；差异维持 unverified，S4.3 报告浮出裁决
- **汇总口径**：reviewStatus pending 213 / approved 2；effectiveDifference consistent 19 / partial 46 / conflict 2 / unverified 148

## S4.1 第一批：算分/番型/结算 复核（ST-C13/14/15，2026-11-14）

- **执行**：runId `run-mwg6o42u-14`（一轮卡点修复后续跑贯通）：27 agent（26 journal 回放 + 1 新跑 L7 回读），20s；72 原子（ST-C13 17/2 片、ST-C14 30/3 片、ST-C15 25/3 片）；卡点：ST-C14-p03 三条 SVE `file` 漏写中间目录段 `com_game/`（location 正确）→ 对 symbol-index 核验后机械修复 + prompt 加固（详见 experience 文档坑 5）
- **产物**（正式三件累积 105 scope + 105 DR + 298 SVE；l7-classify reviewed 105/319，l7 48/55/2/0，五道闸门通过）：本批 53 条建议 pending；scope active 49/conditional 21/unknown 2（C15-024 长按小结算、C15-025 准备/下一小局——服务端三根零实现，客户端公共壳交互，诚实 unknown → verification_required）；decision_required 2（C02-008 已裁决 approved、C15-018 裁决 B 改需求已落 approved）
- **裁决落位**：C02-008 / C15-018 两条 conflict 均裁决 **B 改需求**（接受现状实现），reviewStatus 已落 approved（effectiveDifference 维持 conflict，需求侧修订待上游）；升级建议（附 A/A2 20 条 + 本批 53 条）仍待裁决回传
- **汇总口径**：reviewStatus pending 103 / approved 2 / rejected 0；effectiveDifference consistent 10 / partial 23 / conflict 2 / unverified 70

## 关键发现摘要（详见调查报告）

1. **定庄/牢庄/财神三个核心规则都是好友房配置项**（first_banker_type / banker_level_type / cai_shen_type），需求原文把它们写成无条件规则——「查到实现」与「需求满足」之间隔着配置确认，这正是 scope 层存在的意义。
2. 需求「首庄三牢、庄闲固定 8 倍」与默认配置（1 牢、2 倍起步）**存在配置依赖分歧**，已标记待策划确认（未判 conflict，规则 3）。
3. AT-ST-C02-007（打出财神无前置限制）曾列 S2 矛盾候选优先核验，**S2.1 已闭环**：com_action.cpp:165 的「禁打财神值」是吃禁手黑名单的翻财神归一化处理（CalcChowForbidMahs），CheckPlay 无爆头前置，判 active（矛盾候选解除）。
4. AT-ST-C04-013（吃仅限上家）服务端直证，是本轮唯一建议升 consistent 的原子（pending）。
5. 二审修订（2026-11-14）：AT-ST-C01-002 的 active 结论撤销（注册顺序不等于执行顺序，未证前标 unknown）；l7 与 reviewStatus 拆为独立字段并新增 effectiveDifference；conflict 条目提供证据级 scope（evidenceScopes）。
