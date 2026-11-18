# game-requirement-audit S4/S5 双端查证问题记录（首跑 ST-C01）

- 日期：2026-11-18
- 类型：问题排查 / 复盘
- 范围：`game-requirement-audit` 首跑（run-001，journal `run-mwkpasup-2`，模板「核心策划补齐版」，`stageIds=ST-C01` 收窄）中 **S4 客户端查证**与 **S5 服务端查证**遇到的两类问题：A 工程侧（流程/集成故障）与 B 查证结果侧（业务/数据发现）。
- 数据源：run-001 产物（`2-client/`、`3-server/`、`4-analysis/`）、journal `run-mwkpasup-2.json`（140 agent）、run-002（planOnly 越界产物）、执行文档 §21.8、`dev-docs/experience/` 6 篇。
- 关联文档：`dev-docs/planning/2026-11-17-game-requirement-audit-执行文档.md` §21.8（I4~I10）

## 0. 结论速览

| 维度 | 结论 |
|---|---|
| 工程侧 | S4/S5 首跑到收口共暴露 **10 项工程问题**（A1~A10），其中 3 项为真实数据假故障（A1），2 项为采集根配置错位（A2/A3），1 项为模式语义缺陷（A4）；全部修复或排除，11 套回归 183 用例全绿 |
| 查证结果侧 | ST-C01「房间参数（单选）」29 原子：客户端 **partial 8 / not_found 21 / confirmed 0**，服务端 **conditional 17 / active 6 / unknown 2 / inactive 4**；最大发现是**客户端可读源码不含好友房创房面板**（B1 系统性覆盖缺口）与服务端**局数档实现缺口**（B3） |
| 下游去向 | S8 产出 5 条 ST-C01 复核建议（全 pending）；S9 l7 分类：ST-C01 25 条 verification_required + 4 条 not_applicable |

## A. 工程侧问题（流程/集成故障）

> 修复明细散见执行文档 §21.8（I4~I10）与 `dev-docs/experience/` 对应篇目，此处按 S4/S5 视角汇总。

### A1 S5 merge 批量假故障 → 主流程崩溃链（最严重）

- **现象**：首次后台运行 S5 服务端 merge 报 13 项「条目引用不存在的证据」「引用一致性失败（证据 atomIds 不含引用方原子）」；子流程抛错后主编排 `game-requirement-audit.js:572` `r.stageId` null 崩溃，且对外错误文案误显示为 S2 闸门旧文案（误导排查方向）。
- **根因**：merge 按合并键码元序**重编正式证据 id**，而条目引用的是 agent 分片内编号——两套编号天然独立，错位时引用悬空/错挂。抽查证实「引用不存在」的 id 全部真实存在于分片 evidence[]（如 AT-ST-C01-014 引用的 SVE-…-014-01/02/03 三条全在）——**13 项全是编号错位假故障**，非数据缺陷。run-001 客户端通过纯属编号巧合。
- **修复**：D-REFNORM 引用归一化（引用=支撑声明，按身份重映射：本片 agentId→合并键→正式 id；可解析引用的引用方原子并入 atomIds；悬空引用删除、「需证据而空」仍 fail）。修复后真分片手动合并全绿（run-001 客户端 29 条目、服务端 29/60；run-002 服务端）。
- **经验**：`dev-docs/experience/merge证据重编号与agent引用错位-引用归一化.md`

### A2 服务端采集单根 vs 分层引用（I5）

- **现象**：S5 服务端 collect 失败——`common_game/…`、`hzmj_server/…`、`mah_frame/…` 证据文件「在声明的源码根下均不存在」，文件实际存在。
- **根因**：SVE 引用约定按**层相对路径**写，而采集根只有 `…/mahjong_server/src` 单根；真实布局是 `src/game_hzmj/{hzmj_server,common_game,…}` + `src/mah_frame` 双根。
- **修复**：`collect-source-manifest.mjs` 支持同 repoId 多根（`--repo-ids "server,server"` + 双根）；`5-server-verify.js` 派生 `src/game_hzmj,src` 双根。验证：13/16 文件采集绿（`server@bf85ebee`）。
- **经验**：`dev-docs/experience/collect-source-manifest同repoid多根-服务端分层引用.md`

### A3 客户端 fguiDir 采集根少 assets 层（I9）

- **现象**：run-002 客户端 collect 失败——`client-fgui:box_hzmj_back/BoxHzmjBackView.xml` 等 4 条悬空，文件实际在 `Fgui/assets/box_hzmj_*/`。
- **根因**：fguiDir 沿用旧工作流「工程根」（`Fgui/`），而 agent 引用按**组件包根相对**（`box_hzmj_*/…`，即 assets 相对）。
- **修复**：fguiDir 默认 `source-code/client/Fgui/assets`（主编排 + S4 子流程 + 指南 + run-001 stage-args-S4.json 同步）。验证：run-002 真实清单 22 文件（含 4 个 fgui 引用）采集绿。
- **注**：run-001 首跑客户端分片恰好未引用任何 FGUI 文件，故此缺陷在 run-001 未暴露——双端各 3 分片均已完成且 run-status completed（无 timeout 分片）。

### A4 planOnly 确认后越界执行（I7，run-002 的来源）

- **现象**：plan-only 模式下人工确认（accept）计划后，工作流未返回而是**继续真实执行** S4/S5（生成 run-002 全套分片产物，额外消耗约 19 个 agent）。
- **根因**：主编排 planOnly 分支仅 REJECT 才 return，ACCEPT 后 fall-through 到真实执行段。
- **修复**：ACCEPT 后同样返回 `stoppedAfter='prepare-plan-confirmed'`（计划已确认，正式执行由用户重跑触发）。run-002 保留为历史分部 run（journal 为 plan-only 形态，不可续跑）。

### A5 stage-reuse 诊断误报「configArgs 已变」（I8）

- **现象**：from-stage plan-only 复用校验报「S4 configHash 不匹配：configArgs 已变」，实际传入参数未变。
- **根因**：诊断把全量新 args 与记录比对；真实原因是 configFiles（collect 脚本内容）变化导致的合法失效。修复为按 spec.configArgs 过滤比对。

### A6 第二次 resume 重放中断：S4/S5 整体重跑（成本问题）

- **现象**：journal 续跑时 S1~S3 按位重放（wf0/wf1/wf2 replayed=1，含 23 个拆解 agent 零 token 重放），但 **S4/S5 分片 agent 全部重新执行**（journal 中 wf3/wf4 记录 replayed=0，140 agent 总量）——fguiDir 修复改动了 4-client-verify.js 的 prompt 文本，resume 语义为「首个变更调用及其后全部重跑」，首个变更点即 S4 分片 agent。
- **影响**：S4/S5 重新查证一遍（约 6 个查证 agent + 下游链），成本增加但结果与首跑一致（判定分布相同：partial 8 / not_found 21；conditional 17 / active 6 / unknown 2 / inactive 4），产物为当前终态（客户端正式证据 12 条，全 client-code）。
- **教训**：**resume 前改 prompt 会作废其后的重放**——纯命令/确定性脚本修复不影响重放，prompt 文本修复必然导致从该阶段起全量重跑；评估续跑收益时须先确认 prompt 未变。

### A7 resume 的 init-run 副作用（待清理）

- 每次续跑 init-run 命令都会重跑：新建孤儿 run 目录 + `latest.json` 被劫持指向新目录（journal 回放使主流程仍工作在 run-001）。当前 `latest.json` 指向 resume 产生的孤儿目录，**run 收口后需删除孤儿目录并复原 latest.json → run-001**。

### A8 prompt 引用一致性加固（当时误判，保留为卫生约束）

- A1 假故障初判为「agent 数据缺陷」，曾向 S4/S5 prompt 加入引用一致性硬约束（六A 节）。后证实根因是重编号错位，非 agent 缺陷；约束保留（分片内引用卫生无害且有益）。修复 D-REFNORM 后该约束不再必要但不撤除。

### A9 prep 幂等性确认（风险排除）

- 曾担心 resume 时 `prepare-verify-input` 重跑会把 run-status 重置为全 pending，而「更新分支状态」agent 只重放不落盘 → merge 空跑。核实源码：prep 重写 run-status 时**保留既有 completed 分片状态**（断点续跑不倒退）——风险不存在，无需修改。

### A10 错误信息可读性缺陷（未修，记录在案）

- 主编排 parallel 任务失败返回 null 后 `r.stageId` 直接崩溃，错误信息无指向性；后台失败通知还会复显陈旧的首次失败文案（本次多次收到 S2 闸门旧文案的重复通知）。建议后续：parallel 结果收集处对 null 做防御并透出分支名。

## B. 查证结果侧发现（ST-C01「房间参数（单选）」29 原子）

### B0 判定分布总表

| 维度 | 分布 |
|---|---|
| 客户端（CLE 12 条证据） | partial 8 / not_found 21 / confirmed 0；directConflict 0 |
| 服务端（SVE 60 条证据） | conditional 17 / active 6 / unknown 2 / inactive 4；directConflict 0 |

### B1 系统性覆盖缺口：客户端可读源码不含好友房创房面板（最大发现）

- ST-C01 是**创房面板**阶段（模式/人数/玩法/连庄/胡牌/局数/打片/底分/封顶/吃碰/承包/缺一色/守庄等单选组及联动显隐），但可读客户端源码仅含**对局内模块**：Code 只有 hzmj 对局 controller/cmd/layer/fgui + data/config；Fgui/assets 全部 10 个分包均为 `box_hzmj_*`（back/card_down/common/mah2D_Main/main/player/result/specf/tingPai/tipAni）局内包。
- **后果**：21 条 not_found 全部（或主要是）「创房面板不在可读范围」型；8 条 partial 只能以**局内间接证据**支撑（证「对局内消费该配置」，不能证「创房面板有此选项/默认值/联动」）。例如 001 模式：仅能证客户端消费 simple_mode 开关抑制规则提示（GameData simple_mode 判定），「正常/简洁」单选组与默认「正常」无从查证。
- **处置建议**：创房面板代码（大厅/房间创建 UI 工程）不在本次可读范围属**输入范围限制**，非实现缺失；如需闭环需补创房面板侧源码（客户端第三仓或大厅工程）。

### B2 服务端结论分布

| applicability | 数量 | 原子 | 说明 |
|---|---|---|---|
| active | 6 | 002 人数、022 承包组3/4人房、023 2人房承包联动、025/027/029 缺一色守庄人数联动 | 人数联动服务端实证：`player_count<=2` 强制 `enable_three_tan_bao=false`（两摊封顶）、3/4 人房三摊承包、缺一色/守庄按人数在 server_config 生效 |
| conditional | 17 | 001/003/004/005/009/010/011/013/014/015/018/019/020/021/024/026/028 | 配置项在 `GameLogic::LoadBoxJsonConfig` 真实解析（simple_mode/玩法/连庄 banker_level_type/胡牌/底分/封顶/打片 play_score/吃碰/承包/缺一色/守庄），但**创房档位取值与默认值不归服务端管**（服务端只解析下发的 JSON） |
| unknown | 2 | 006 局数档、016 局数片数互斥 | 见 B3 |
| inactive | 4 | 007（4局仅4人房）、008（32局仅2/3人房）、012（打片档档位）、017（吃碰组仅2人房） | 007/008/017 服务端零证据（noServerEvidence，与客户端 not_found 一致——双端可读范围内均无此实现）；012 服务端有 play_score 解析但档位（40/50/60片）无实现 |

### B3 真实现缺口候选（服务端 unknown 的实质发现）

- **局数档（总局数）实现缺失**（006）：可读服务端三目录（hzmj_server/common_game/mah_frame）内**无 4/8/16/24/32 局数档取值与默认 8 局的实现**：`BaseConfig` 只有 `ju_count`（当前局计数，base_data.h:664）；`GameLogic::LoadBoxJsonConfig` 无局数键；`CommonGameLogic::CalcTotalScore`（common_game_logic.cpp:153-194）仅汇总分数——**注释称「到约定局数即结束」判定在 CalcTotalScore（common_game_com_result.h:87-89），但其内无相应代码（注释与实现不符）**；大结算由房间服务承载（common_game_com_result.cpp:57-58 注释）。
- **局数与片数互斥校验缺失**（016）：服务端仅有 play_score 独立解析（game_logic.cpp:175-179）与打片房大结算触发，未见「局数/片数互斥、只提交一项」的创房参数校验。
- **人数联动局数档（024/026/028 的 unresolved）**：32局/4局档位三目录内查无实现，房间创建层的局数联动不在可读范围。

### B4 零命中概念（模板 ↔ 代码命名体系脱节预警）

- 「**连庄不占局数**」（015/024 等）与「**碰算摊**」（019/020）两个概念在客户端双根（Code + Fgui/assets）**零命中**。要么实现确不在可读范围（创房面板），要么模板用词与代码命名体系脱节——后续阶段（S7~S10）或人工裁决需澄清这两个概念。

### B5 协议字段缺口

- `MsgGameConfig` 仅含 `must_bao_tou_with_cai / enable_three_tan_bao / round_id / simple_mode` 等字段，**无吃碰档位、局数档、底分档位字段**——这些配置要么经其他消息/通道下发，要么在可读范围外组装（018/023/014 notes 明确记录）。

### B6 服务端兜底默认与需求默认不一致（S8 复核捕获）

- 004 连庄数：`server_config.cpp:18` 配置默认 `banker_level_type=0`（平庄起），与需求默认「笃三老庄」不同；复核结论：该默认**仅在创房未下发时生效**，客户端显式提交即得需求默认，故不升级 conflict，维持 partial（面板默认项缺证）。

## C. 下游去向（S6~S9 对本批查证结果的消费）

- **S6 证据汇总**：双端证据合流（CLE 12 + SVE 60），analysisRunId 递增。
- **S8 差异复核**：ST-C01 产出 5 条复核建议（004/012/018/021/024），全部 pending 待裁决；004 见 B6。
- **S9 L7 分类**：ST-C01 29 原子 → 25 verification_required + 4 not_applicable（007/008/012/017 服务端 inactive 对应）；全量 416 原子 → 412 verification_required + 4 not_applicable、decision_required 0、verified 0（收窄跑仅 ST-C01 有证据，其余 387 原子 pending 未调度）。

## D. 原子级明细（29 条）

> 判定格式：`C=客户端 verdict（证据数） / S=服务端 applicability`。notes 为查证关键理由（节选）。

| 原子 | 需求点 | C / S | 关键备注 |
|---|---|---|---|
| 001 | 模式选项（正常/简洁，默认正常） | partial(1) / conditional | 局内消费 simple_mode（GameData），面板单选组无从查证；服务端 simple_mode 白名单抑制（common_game_context.cpp:15-36） |
| 002 | 人数选项（2/3/4人，默认4人） | partial(3) / active | 客户端支持 2/3/4 人座次与二人房玩法；服务端 OnGameStart→InitTableData 人数实证 |
| 003 | 玩法选项（白板财神/翻财神，默认白板） | partial(2) / conditional | 局内区分两种财神玩法；服务端 LoadBoxJsonConfig:51 起解析 |
| 004 | 连庄数（笃三老庄/笃二老庄/平庄起，默认笃三） | partial(2) / conditional | 客户端 banker_level→倍数换算（GameJuDataCmd/GameData）；服务端档位换算自洽但兜底默认 0=平庄起 ≠ 需求默认（见 B6） |
| 005 | 胡牌选项（自摸胡/庄闲放铳，默认庄闲放铳） | partial(2) / conditional | 结算侧支持两种结果展示；服务端 game_logic.cpp:60-63 |
| 006 | 局数档（4/8/16/24/32局，默认8局） | not_found(0) / unknown | 协议仅 ju_count 字段透传；服务端三目录无总局数实现（见 B3） |
| 007 | 4局档仅4人房显示 | not_found(0) / inactive | 双端零证据（noServerEvidence） |
| 008 | 32局档仅2/3人房显示 | not_found(0) / inactive | 双端零证据（noServerEvidence） |
| 009 | 局数档联动（显示底分封顶/隐藏连庄不占局数） | partial(2) / conditional | 局内展示底分封顶实证；「连庄不占局数」客户端零命中（见 B4） |
| 010 | 底分选项（1/2/5分，默认1分） | partial(1) / conditional | 底分展示与消费实证（CalcFinalWinLost）；面板三档无从查证 |
| 011 | 封顶选项（无/20/40/64/80/128/256，默认无） | partial(1) / conditional | 封顶倍数展示实证；面板七档无从查证 |
| 012 | 打片档（40/50/60片） | not_found(0) / inactive | 客户端无创房面板；服务端有 play_score 解析但档位无实现 |
| 013 | 打片档隐藏封顶并置「无」 | not_found(0) / conditional | 「封顶」仅命中局内结算资源（img_fengding 等），非面板联动 |
| 014 | 打片档隐藏底分并置「1分」 | not_found(0) / conditional | 协议 base_score 仅对局内展示 |
| 015 | 打片档显示「连庄不占局数」 | not_found(0) / conditional | 「连庄不占局数」双根零命中（见 B4） |
| 016 | 局数与片数互斥只提交一项 | not_found(0) / unknown | 客户端无创房提交链路（协议无创房消息）；服务端无互斥校验（见 B3） |
| 017 | 吃碰组仅2人房显示 | not_found(0) / inactive | 对局内仅「只碰不吃规则生效中」提示（GameNotifyInfoCmd:65），非面板；服务端零证据 |
| 018 | 吃碰默认值（2人房默认无限吃碰） | not_found(0) / conditional | 「无限吃碰」「默认吃碰」双根零命中；协议无吃碰档位字段 |
| 019 | 选无限吃碰联动（隐藏碰算摊/承包置两摊封顶） | not_found(0) / conditional | 「碰算摊」零命中（见 B4） |
| 020 | 选只碰不吃或默认吃碰联动 | not_found(0) / conditional | 同上 |
| 021 | 承包可选值与默认（三摊承包/两摊封顶，默认三摊） | not_found(0) / conditional | 客户端仅局内结算文案使用「三摊承包」（MatchTipConfig）；服务端 enable_three_tan_bao 实证 |
| 022 | 承包组仅3/4人房显示 | not_found(0) / active | 服务端 3/4 人房强制 enable_three_tan_bao=false 逻辑实证 |
| 023 | 2人房承包联动为两摊封顶 | not_found(0) / active | 服务端 player_count<=2 强制 enable_three_tan_bao=false 实证 |
| 024 | 2人房联动（显32局/隐4局/吃碰组显示/承包组隐藏） | not_found(0) / conditional | 客户端无创房面板；服务端 unresolved：局数档位三目录查无实现（见 B3） |
| 025 | 2人房缺一色显示/守庄隐藏 | not_found(0) / active | 服务端 server_config 人数联动实证（game_logic.cpp:151-1x）；客户端「缺一色」仅匹配场提示文案 |
| 026 | 3人房联动 | not_found(0) / conditional | 局内按 playCnt 换算座位（SC_PLAYER_LOCAL_SEAT_MAP）；服务端局数档 unresolved |
| 027 | 3人房缺一色与守庄均显示 | not_found(0) / active | 服务端人数联动实证 |
| 028 | 4人房联动 | not_found(0) / conditional | 客户端仅 MAX_PLAYER=4 渲染容量；服务端局数档 unresolved |
| 029 | 4人房缺一色隐藏/守庄显示 | not_found(0) / active | 服务端人数联动实证；客户端「守庄」仅局内通知（GameDefine:467/GameNotifyInfoCmd:56） |

## E. 运行资产与后续

- **run-001（主体）**：S1~S9 完成；S10 已写全部 23 份阶段规格文档 + feature_index/trace_index/pending-list，卡在 **S10 阶段文档 AT-ID 覆盖校验**（缺原子或乱码）——属 S10 问题，不在本文档范围，待修复后重跑 S10。
- **run-002**：planOnly 越界产物（保留不删，不可续跑）。
- **待清理**：resume 产生的孤儿 run 目录 + `latest.json` 复原 → run-001（见 A7）。
- **S4/S5 相关经验沉淀**：`dev-docs/experience/` 6 篇（s2闸门缺date / collect同repoid多根 / merge重编号引用错位 / planonly越界 / journal-resume孤儿目录 / fguidir少assets层）。
