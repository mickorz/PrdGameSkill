# OSG-W4 服务端规则补证样本（T0.2 / T0.4 交付物）

- **日期**：2026-11-14
- **性质**：第一阶段（只读调查）交付样本，非全量产物。后续正式产物由 `server-rule-verify/` workflow 生成到本目录（samples 后缀区分）。
- **上游基线**：`spec-workflow/output-spec/2026-11-14/1-spec/feature_index.json`（319 原子，schema_version=2，v2 产物只读）
- **调查事实**：`dev-docs/research/2026-11-14-OSG-W4-T0服务端结构与职责调查报告.md`
- **判定规则**：`dev-docs/design/2026-11-14-OSG-W4-L7分类与玩法配置作用域设计.md`

## 文件清单

| 文件 | 内容 | 规模 |
|---|---|---|
| `server-evidence_sample.json` | 服务端证据（14 条真实 file:line，common_game/hzmj_server/mah_frame 三层） | SVE 条目 |
| `scope-index_sample.json` | ST-C01/02/04 全部 33 原子的玩法配置作用域判定：active 1 / conditional 9 / unknown 23 / inactive 0（二审修订：AT-ST-C01-002 因执行顺序未证由 active 降 unknown） | 33 条 |
| `difference-review_sample.json` | 差异二次复核对照（14 条代表性条目，含 v2 全部 2 个 conflict；全部 pending 未合并；含 effectiveDifference 与确定性迁移统计 66/64/2/187；S1.1 修订：l7Projection 手写统计漂移经重算修正 2/10/2/0 → 1/11/2/0） | 14 条 |
| `l7-classify_sample.json` | L7 分类产物（S1.1）：classify-l7.mjs 按设计 4.1 矩阵对 14 条复核样本的确定性分类，分布 verified 1 / verification_required 11 / decision_required 2 / not_applicable 0；全部 pending → l7Approved 全 0（未批准不入正式索引）；AT-ST-C02-008 采证据级 scope（client-visual → active） | 14 条 |

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

## 关键发现摘要（详见调查报告）

1. **定庄/牢庄/财神三个核心规则都是好友房配置项**（first_banker_type / banker_level_type / cai_shen_type），需求原文把它们写成无条件规则——「查到实现」与「需求满足」之间隔着配置确认，这正是 scope 层存在的意义。
2. 需求「首庄三牢、庄闲固定 8 倍」与默认配置（1 牢、2 倍起步）**存在配置依赖分歧**，已标记待策划确认（未判 conflict，规则 3）。
3. AT-ST-C02-007（打出财神无前置限制）发现**疑似禁打财神状态机制**（com_action.cpp:165），列为 S2 矛盾候选优先核验（重点区分「爆头不是打财神的必要条件」与「特殊状态禁止打特定牌」，两者未必矛盾）。
4. AT-ST-C04-013（吃仅限上家）服务端直证，是本轮唯一建议升 consistent 的原子（pending）。
5. 二审修订（2026-11-14）：AT-ST-C01-002 的 active 结论撤销（注册顺序不等于执行顺序，未证前标 unknown）；l7 与 reviewStatus 拆为独立字段并新增 effectiveDifference；conflict 条目提供证据级 scope（evidenceScopes）。
