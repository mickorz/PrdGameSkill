# ST-C04 创房不可见的默认配置

## 阶段概述

本阶段描述「创房界面不可见、由系统按默认口径自动生效」的三类配置——庄家归属、局数与片数互斥提交、出牌速度默认档——在客户端与服务端之间的实现规格：客户端不提供可见选项、按服务端下发结果表现，服务端按默认口径确定并下发。

- 阶段：ST-C04（章节：玩法选项（创房规则全集，规则不固定） > 创房不可见的默认配置）
- 功能点数：3（FP-ST-C04-001 庄家归属默认配置、FP-ST-C04-002 局数与片数互斥提交、FP-ST-C04-003 出牌速度默认档）
- 本阶段原子数：5（AT-ST-C04-001 ~ AT-ST-C04-005）
- L7 分布：
  - verified：0
  - verification_required：5
  - decision_required：0
  - not_applicable：0
- L7 依据分布：5 个原子的 l7Basis 均为 proposed，无 pending-blocked、无 approved。

阶段共性说明：

1. 5 个原子在统一原子视图中客户端与服务端均无直达证据（clientVerification.verdict / serverVerification.applicability / 两端 evidenceIds 均为空），analysisPath 均为 full（非 blocked），baselineDifference 统一为 unverified，因此 L7 统一为 verification_required。本阶段不存在 blocked 原子，故不涉及「查证未完成」表述。
2. 其中 AT-ST-C04-001 / 002 / 003 / 004 在 difference-review.json 中各有一条 reviewStatus=pending 的待审批复核建议，reviewedDifference 均为 unverified，**尚未生效**；AT-ST-C04-005 无复核条目。
3. 5 个原子均未进入 pending-list.md 的「查证未完成（必要端缺口）」「需策划裁决」分组，全部落在「规则待验证（412）」分组，建议动作统一为「补证 both」。

## 需求条目

### AT-ST-C04-001 首局庄家随机

- **需求规则**：首局庄家：随机（与正文一致）。即好友房第一小局的庄家由系统随机指定，不是房主或固定座位。
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端不提供首局庄家选择入口；进入第一小局时直接按服务端下发的庄位在牌桌上展示庄家标识。无指向本原子的 CLE 证据。邻近参考 CLE-AT-ST-C01-004-03（`GameJuDataCmd.execute`）显示客户端从服务端下发数据读取 `banker_level` 并设置连庄等级，可佐证「庄位由服务端下发而非客户端选择」，但不涉及首局庄位是否随机产生；CLE-AT-ST-C01-004-04（`GameData.getZhuangXianMult`）仅按 `_bankerLevel` 计算庄闲倍数。
  - 证据定位：本原子 evidenceIds 为空。邻近参考：CLE-AT-ST-C01-004-03，client_code，controller/cmd/gameCmd/GameJuDataCmd.ts:34-35，claimKey=lian-zhuang-level-from-room-config；CLE-AT-ST-C01-004-04，client_code，data/GameData.ts:1664-1666，claimKey=banker-level-multiplier。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端在首局随机指定一名玩家为庄家，并把庄位结果下发给房内所有玩家。
  - configCondition：数据字段为空；按需求语义，该配置在创房界面不可见、玩家不可选择，首局取默认口径「随机」生效。
  - 证据定位：本原子 evidenceIds 为空。邻近参考：SVE-AT-ST-C01-004-01，common_game，common_game/com_game/common_game_com_ju.cpp:132-136，claimKey=banker-level-applied-at-ding-zhuang（`BoxZhuangStep::JudgeDingZhuang` 显示存在定庄步骤并设置 `zhuang_seat` / `lian_zhuang` / `banker_level`，摘录中看不到随机抽取庄位的实现）。
- **双端协作**：房间坐满开始第一小局 → 服务端随机抽定一名玩家为庄家 → 把庄位结果同步给全房 → 客户端按该结果在牌桌上标出庄家。
- **业务行为**：
  - trigger：好友房开局进入房间内的第一小局
  - condition：当前是这间房的第一局，之前没有任何已完成的牌局；属创房时不可见的默认配置，玩家无需也不能在创房界面选择
  - action：客户端不提供首局庄家选择，进入第一小局时按服务端下发的庄位展示庄家标识；服务端随机指定一名玩家为庄家并下发庄位
  - result：玩家进入第一小局时就已有一个庄家，且庄家是按随机产生的，不是房主或固定座位
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子在统一原子视图中客户端与服务端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），只能确认需求要求首局庄家随机，无法判定实际服务端是否随机指定庄家，按证据不足归为未验证。
  - 待审批建议：unverified（no-server-evidence-is-not-conflict（服务端仅证明存在定庄步骤、无首局随机抽取证据，属取证空缺而非冲突）），**未生效**。
- **验证结论（L7）**：verification_required；l7Basis=proposed（复核条目 reviewStatus=pending，复核建议 unverified 尚未生效）。

### AT-ST-C04-002 非首局赢家坐庄

- **需求规则**：非首局庄家：赢家坐庄（与正文一致）。即上一小局正常分出胜负时，由上一小局的赢家成为下一小局庄家。
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端不提供庄位选择；结算后按服务端下发的下一局庄位把庄家标识移到上一小局的赢家身上。无指向本原子的 CLE 证据；邻近参考 CLE-AT-ST-C01-004-03 仅显示客户端消费服务端下发的 `banker_level`，无法反推庄位继承规则。
  - 证据定位：本原子 evidenceIds 为空。邻近参考：CLE-AT-ST-C01-004-03，client_code，controller/cmd/gameCmd/GameJuDataCmd.ts:34-35，claimKey=lian-zhuang-level-from-room-config。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端把上一小局的赢家定为新一局庄家，并随开局同步庄位结果。
  - configCondition：数据字段为空；按需求语义，该配置创房不可见，取默认口径「赢家坐庄」，在上一小局正常分出胜负（非流局）时生效。
  - 证据定位：本原子 evidenceIds 为空。邻近参考：SVE-AT-ST-C01-004-01，common_game，common_game/com_game/common_game_com_ju.cpp:132-136，claimKey=banker-level-applied-at-ding-zhuang（仅覆盖开局定庄赋值）；SVE-AT-ST-C01-015-01，common_game，common_game/com_game/common_game_com_result.cpp:57-76，claimKey=play-score-endgame-exempt-on-banker-win（仅覆盖打片房结算的局数口径，与下一局庄位归属无关）。
- **双端协作**：上一小局结束产生赢家 → 服务端以该赢家作为下一局庄家 → 开局时把庄位下发全房 → 客户端刷新庄家标识到赢家位置。
- **业务行为**：
  - trigger：房间里上一小局结束、进入非第一小局
  - condition：当前不是这间房的第一局，且上一小局正常分出胜负（非流局）；属创房时不可见的默认配置
  - action：客户端不提供庄位选择，结算后按服务端下发的下一局庄位把庄家标识移到上一小局赢家身上；服务端把上一小局赢家定为新一局庄家并随开局同步
  - result：玩家看到每一小局的赢家在下一局自动坐上庄位，形成「赢家坐庄」的连续庄位变化
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子在统一原子视图中客户端与服务端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），仅能确认需求要求非首局由赢家坐庄，无法判定实际继承庄位的实现，按证据不足归为未验证。
  - 待审批建议：unverified（no-server-evidence-is-not-conflict（服务端无赢家坐庄继承逻辑证据，属取证空缺，不升级为 conflict）），**未生效**。
- **验证结论（L7）**：verification_required；l7Basis=proposed（复核条目 reviewStatus=pending，复核建议 unverified 尚未生效）。

### AT-ST-C04-003 流局原庄连庄

- **需求规则**：流局：原庄连庄（与正文一致）。即某一小局以流局结束时，原庄家保留为下一小局庄家。
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端不提供连庄相关选项；流局结算后按服务端下发的庄位继续显示原庄家。无流局后庄位展示的 CLE 直接证据；邻近参考 CLE-AT-ST-C01-004-03 仅证明客户端消费下发庄位数据。
  - 证据定位：本原子 evidenceIds 为空。邻近参考：CLE-AT-ST-C01-004-03，client_code，controller/cmd/gameCmd/GameJuDataCmd.ts:34-35，claimKey=lian-zhuang-level-from-room-config。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端在流局时不更换庄家，保留原庄家为下一小局庄家并同步庄位。
  - configCondition：数据字段为空；按需求语义，该配置创房不可见，取默认口径「流局原庄连庄」，在该小局被判定为流局、房内无赢家可继承庄位时生效。
  - 证据定位：本原子 evidenceIds 为空。邻近参考：SVE-AT-ST-C01-015-01 / SVE-AT-ST-C01-009-02，common_game，common_game/com_game/common_game_com_result.cpp:57-76 / :60-76，claimKey=play-score-endgame-exempt-on-banker-win / play-score-gates-lian-zhuang-bu-zhan（语义为「连庄不占局数」的局数口径，不等于流局保留原庄）；SVE-AT-ST-C01-027-01，common_game，common_game/com_game/common_game_algorithm.cpp:62-67，claimKey=guard-dealer-3-vs-4-player-scope（其中 `zhuang` 为吃碰禁手作用对象，与流局庄位轮转无关）。
- **双端协作**：该小局流局结束 → 服务端判定无赢家、保留原庄家 → 下一小局开盘时下发同一庄位 → 客户端保持原庄家的庄家标识。
- **业务行为**：
  - trigger：某一小局以流局结束（没有赢家）
  - condition：该小局被判定为流局，房内无赢家可继承庄位；属创房时不可见的默认配置
  - action：客户端不提供连庄相关选项，流局结算后按服务端下发的庄位继续显示原庄家；服务端在流局时不更换庄家并同步庄位
  - result：玩家看到流局之后庄家没有换人，原来坐庄的玩家继续坐庄
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子在统一原子视图中客户端与服务端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），只能确认需求要求流局原庄连庄，无法判定实际流局换庄逻辑，按证据不足归为未验证。
  - 待审批建议：unverified（evidence-is-not-consistency（存在连庄不占局数/守庄类证据不等于流局原庄连庄一致，不能判 consistent）），**未生效**。
- **验证结论（L7）**：verification_required；l7Basis=proposed（复核条目 reviewStatus=pending，复核建议 unverified 尚未生效）。

### AT-ST-C04-004 局数片数只提交其一

- **需求规则**：局数 / 片数只按所选模式提交其中一项（互斥）。即建房时对局长度参数仅提交局数或片数之一，二者不同时生效。
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端按房主所选模式只带上对应的那一项对局长度设置（要么局数、要么片数），另一项不提交。无建房参数提交代码的 CLE 直接证据，无法证明另一项确实不提交。
  - 证据定位：本原子 evidenceIds 为空；无邻近可引用的客户端证据。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端只按所选模式对应的那一项长度规则创建房间，并忽略/不接收另一项。
  - configCondition：数据字段为空；按需求语义，建房参数按模式二选一提交（局数模式或打片模式互斥），服务端按单一长度参数接收并生效，另一项不应同时下发。
  - 证据定位：本原子 evidenceIds 为空。邻近参考：SVE-AT-ST-C01-009-04，hzmj_server，hzmj_server/game_logic.cpp:175-183，claimKey=play-score-lian-zhuang-json-keys（`GameLogic::LoadBoxJsonConfig` 显示 play_score、局数、lian_zhuang_bu_zhan 三类配置键并存，只证明两种长度能力都存在，未证明互斥校验或双提交行为）；SVE-AT-ST-C01-006-01，common_game，common_game/com_game/common_game_com_result.cpp:57-59，claimKey=grand-settlement-owned-by-room-service（仅证明打片房大结算由房间服务按片数推进，不涉及建房参数互斥）。
- **双端协作**：房主选好模式后提交建房 → 客户端只提交与该模式匹配的那一项长度参数 → 服务端按这一项规则建出房间并把对局长度目标同步给全房。
- **业务行为**：
  - trigger：房主创建好友房并提交对局参数
  - condition：所选玩法模式只对应「局数模式」或「打片模式」中的一种，两者互斥；属创房时不可见的默认配置约束
  - action：客户端按所选模式只提交对应的那一项长度设置，另一项不提交；服务端只按所选模式对应的那一项长度规则创建房间并忽略/不接收另一项
  - result：玩家进入的房间里只存在一种对局长度规则，不会同时出现「打几局」和「打几片」两个长度目标
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子验证范围为双端，但统一原子视图中客户端与服务端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），无法确认建房提交时是否只提交一项、服务端是否只认一项，按证据不足归为未验证。
  - 待审批建议：unverified（common-capability-is-not-enabled（局数与片数配置键并存只说明两种长度能力都存在，不能证明建房时双长度同时生效）），**未生效**。
- **验证结论（L7）**：verification_required；l7Basis=proposed（复核条目 reviewStatus=pending，复核建议 unverified 尚未生效）。

### AT-ST-C04-005 出牌速度默认档

- **需求规则**：出牌速度：默认档。即创房时不存在单独选择出牌速度的入口，出牌速度取默认档。
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端不展示出牌速度选项，直接按默认节奏在牌桌上计时与提示出牌。无该默认档位生效的 CLE 直接证据。
  - 证据定位：本原子 evidenceIds 为空；无邻近可引用的客户端证据。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端以默认档的出牌速度配置开局并按该节奏推进出牌计时。
  - configCondition：数据字段为空；按需求语义，创房时不存在单独选择出牌速度的入口，服务端取默认档生效。
  - 证据定位：本原子 evidenceIds 为空；无邻近可引用的服务端证据。
- **双端协作**：房主按默认配置建房开局 → 服务端以默认出牌速度生效并控制每步出牌的等待时长 → 客户端按该时长显示计时与提示。
- **业务行为**：
  - trigger：房主创建好友房并按当前设置开局
  - condition：创房时不存在单独选择出牌速度的入口，出牌速度取默认档；属创房时不可见的默认配置
  - action：客户端不展示出牌速度选项，直接按默认节奏计时与提示；服务端以默认档出牌速度配置开局并按该节奏推进出牌计时
  - result：玩家对局中的出牌节奏是默认档的速度，既没有额外调快也没有被调慢
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子验证范围为双端，但统一原子视图中客户端与服务端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），无法核对默认出牌速度档位是否生效，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定）。

## 证据索引

本阶段 5 个原子的 `clientVerification.evidenceIds` 与 `serverVerification.evidenceIds` 均为空，客户端与服务端均无 atomIds 指向 ST-C04 的直达证据。下表为 difference-review.json 复核理由中引用的邻近证据，用于说明「为何不能判一致或冲突」，仅供定位参考，不构成本阶段原子的直接验证依据（这些证据的 atomIds 均指向 AT-ST-C01-004 / 006 / 009 / 015 / 027，而非 ST-C04）。

| 证据 ID | layer | file:line | claimKey |
|---|---|---|---|
| CLE-AT-ST-C01-004-03 | client_code | controller/cmd/gameCmd/GameJuDataCmd.ts:34-35 | lian-zhuang-level-from-room-config |
| CLE-AT-ST-C01-004-04 | client_code | data/GameData.ts:1664-1666 | banker-level-multiplier |
| SVE-AT-ST-C01-004-01 | common_game | common_game/com_game/common_game_com_ju.cpp:132-136 | banker-level-applied-at-ding-zhuang |
| SVE-AT-ST-C01-006-01 | common_game | common_game/com_game/common_game_com_result.cpp:57-59 | grand-settlement-owned-by-room-service |
| SVE-AT-ST-C01-009-02 | common_game | common_game/com_game/common_game_com_result.cpp:60-76 | play-score-gates-lian-zhuang-bu-zhan |
| SVE-AT-ST-C01-015-01 | common_game | common_game/com_game/common_game_com_result.cpp:57-76 | play-score-endgame-exempt-on-banker-win |
| SVE-AT-ST-C01-027-01 | common_game | common_game/com_game/common_game_algorithm.cpp:62-67 | guard-dealer-3-vs-4-player-scope |
| SVE-AT-ST-C01-009-04 | hzmj_server | hzmj_server/game_logic.cpp:175-183 | play-score-lian-zhuang-json-keys |

## 待处理事项

本阶段 5 个原子均在 pending-list.md「规则待验证（412）」分组中，建议动作统一为「补证 both」。本阶段无「查证未完成」条目、无「需策划裁决」条目。

| atomId | 验证范围 | 问题 | 说明 | 建议动作 |
|---|---|---|---|---|
| AT-ST-C04-001 | server | 规则待验证 | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C04-002 | server | 规则待验证 | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C04-003 | server | 规则待验证 | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C04-004 | both | 规则待验证 | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C04-005 | both | 规则待验证 | 证据不足 | 补证 both |

补充：

- 本阶段无 analysisPath=blocked 原子，无 pending-blocked 的 l7Basis，因此不存在「查证未完成」结论。
- 无 analysisPath=conflict-fast 原子，无 conflict 结论，不存在另一端 pending 的待办。
- AT-ST-C04-001 / 002 / 003 / 004 各有 1 条 reviewStatus=pending 的待审批复核建议（reviewedDifference 均为 unverified），**尚未生效**，需审批后方可作为最终差异结论。
- 补证重点：首局随机定庄（服务端抽取逻辑）、赢家坐庄 / 流局原庄连庄（庄位继承与流局分支）、建房局数与片数互斥提交（客户端提交参数与服务端接收校验）、出牌速度默认档（默认档位配置与计时生效）；客户端侧需补齐对应的下发消费与默认档表现证据。
