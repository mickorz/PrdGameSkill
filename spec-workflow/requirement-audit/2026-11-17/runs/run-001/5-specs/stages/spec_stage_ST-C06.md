# ST-C06 定庄与轮庄

## 阶段概述

本阶段负责好友房「定庄与轮庄」的技术实现规格：首局从四名玩家中随机定庄且定庄先于掷骰发牌，胡牌者接任下一小局庄家（庄家自胡连庄）、流局原庄连庄，并且首庄 / 新庄 / 连庄统一按三牢处理、庄闲倍数固定 8 倍且不再随连庄增长。章节来源：`开局 > 定庄与轮庄`，共 4 个功能点（FP-ST-C06-001 首局定庄、FP-ST-C06-002 胡牌后轮庄、FP-ST-C06-003 流局连庄、FP-ST-C06-004 牢级与庄闲倍数）。

- 本阶段原子数：8（AT-ST-C06-001 ~ AT-ST-C06-008）
- L7 分布：
  - verified：0
  - verification_required：8
  - decision_required：0
  - not_applicable：0

说明：8 个原子在统一原子视图（feature_index.json）中客户端 `clientVerification.verdict` 与 `evidenceIds` 均为空、服务端 `serverVerification.applicability`、`evidenceIds`、`configCondition` 均为空，`analysisPath` 均为 `full`，`difference` 统一为 `unverified`，`l7Basis` 均为 `proposed`。其中 AT-ST-C06-006 / 007 / 008 在 difference-review.json 中各有 1 条 `reviewStatus=pending` 的待审批复核建议（建议值均为 `partial`，引用 ST-C01 定庄族证据），**尚未生效**；AT-ST-C06-001 ~ 005 无复核条目。8 个原子在 pending-list.md 中均归入「规则待验证」，建议动作为「补证 both」，无 blocked、无 decision_required 条目。

## 需求条目

### AT-ST-C06-001 首局随机坐庄

- **需求规则**：首局四名玩家中随机坐庄。即好友房第一小局由系统在四名玩家中随机选出一人坐庄（功能点 FP-ST-C06-001：首局从四名玩家中随机确定庄家，并在掷骰、发牌之前完成定庄；scope 仅覆盖第一小局）。
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（客户端无针对本原子的直接验证结论，`evidenceIds` 为空、`pending=false`）
  - 实现要点：按需求，客户端不提供首局庄家选择或指定入口；首局开局时直接按服务端下发的开局数据把庄家标识标在对应玩家座位上，玩家无需任何操作。当前无客户端首局庄位展示的直接证据，无法核对客户端是否按随机结果落位。
  - 证据定位：无直接证据（本原子 `evidenceIds` 为空；client-evidence.json 中无 `atomIds` 含 AT-ST-C06 的条目）。邻近参考：CLE-AT-ST-C01-004-04，client_code，data/GameData.ts:1664-1666，claimKey=banker-level-multiplier（仅说明客户端以 `1 << bankerLevel` 取庄闲倍数，不涉及首局庄位来源）。
- **服务端职责**：
  - serverVerification.applicability：空（服务端无针对本原子的直接适用性结论，`evidenceIds` 为空、`pending=false`）
  - 规则说明：按需求，服务端在首局开局时从在场四名玩家中随机抽取一人定为庄家，并把庄家身份随开局数据一并下发；抽取结果不受房主或固定座位影响。
  - configCondition：`configCondition` 为空；本原子在统一原子视图与证据文件中均未给出配置生效条件，随机定庄的触发条件亦无配置项被取证。
  - 证据定位：无直接证据（`evidenceIds` 为空；server-evidence.json 中无 `atomIds` 含 AT-ST-C06 的条目）。邻近参考：SVE-AT-ST-C01-004-01，common_game，common_game/com_game/common_game_com_ju.cpp:132-136，claimKey=banker-level-applied-at-ding-zhuang（`BoxZhuangStep::JudgeDingZhuang` 中 `SetZhuang(zhuang_seat)`、`SetLianZhuang(1)`、`SetBankerLevel(GetConfiguredBankerLevel())`），仅证明存在定庄步骤与庄位赋值，摘录中看不到随机抽取庄位的实现，不构成本原子证据。
- **双端协作**：玩家进入首局 → 服务端从四名玩家中随机挑出一人当庄家 → 把庄家与开局数据下发 → 客户端按庄家信息在座位上显示庄位 → 玩家看到本局庄家。
- **业务行为**：
  - trigger：好友房首局开始、桌上还没有庄家时
  - condition：首局由四名玩家参与，房内已坐满四人
  - action：开局不需要玩家做任何操作，只按服务端下发的开局数据把庄家标在对应的玩家座位上；服务端从在场的四名玩家中随机挑出一人定为庄家，并把庄家是谁随开局数据一并下发
  - result：玩家在首局看到一名随机产生的庄家，没有人可以预期自己或指定某人坐庄
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：需求要求首局四名玩家中随机坐庄。统一原子视图中该原子客户端 verdict 为空、evidenceIds 为空，服务端 applicability 为空、evidenceIds 为空，两端均无实现证据；verificationScope=both 要求两端证据充分才可判符合，故无法验证首局是否真的随机定庄，判 unverified。`candidateDifference` 为空（本原子无升级候选）。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定；effectiveDifference=unverified）。

### AT-ST-C06-002 掷骰发牌前已定庄

- **需求规则**：掷骰、发牌前已经确定庄家。即定庄发生在掷骰与发牌之前，庄家身份在发牌前已确定。
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（客户端无针对本原子的直接验证结论，`evidenceIds` 为空、`pending=false`）
  - 实现要点：按需求，客户端不参与定庄，只在收到开局数据后展示庄家并播放掷骰与发牌表现；表现为「先显示庄家、再展示掷骰发牌结果」。当前无客户端时序表现证据。
  - 证据定位：无直接证据（`evidenceIds` 为空）。本原子 `verificationScope=server`，客户端侧仅作需求侧说明，无邻近可引用的客户端证据。
- **服务端职责**：
  - serverVerification.applicability：空（服务端无针对本原子的直接适用性结论，`evidenceIds` 为空、`pending=false`）
  - 规则说明：按需求，服务端必须在进入掷骰与发牌之前先完成定庄，庄家身份在发牌前已确定，不得出现牌发完后补定庄家的情形。
  - configCondition：`configCondition` 为空；本原子未取证任何与定庄时序相关的配置开关，时序要求本身不附带配置生效条件。
  - 证据定位：无直接证据（`evidenceIds` 为空）。邻近参考：SVE-AT-ST-C01-004-01，common_game，common_game/com_game/common_game_com_ju.cpp:132-136，claimKey=banker-level-applied-at-ding-zhuang（定庄步骤存在并在该步骤内设定庄位与牢级），但摘录不含定庄与掷骰、发牌之间的调用顺序，不能据此判定时序，不构成本原子证据。
- **双端协作**：开局 → 服务端先定庄 → 再掷骰、发牌 → 把庄家与牌局数据一起下发 → 客户端先显示庄家再展示掷骰发牌结果。
- **业务行为**：
  - trigger：好友房首局开局流程启动，进入掷骰与发牌环节
  - condition：开局流程尚在掷骰、发牌之前（定庄阶段）
  - action：玩家不参与定庄，只在收到开局数据后展示庄家，并播放掷骰与发牌表现；服务端先完成定庄、把庄家定下来，再进入掷骰与发牌
  - result：玩家看到掷骰、发牌时庄家已经确定，不会出现牌都发完了才补定庄家的情形
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：需求要求掷骰、发牌前已经确定庄家。该原子按服务端规则域验证（verificationScope=server）；统一原子视图中服务端 applicability 为空、evidenceIds 为空，无任何定庄与掷骰发牌的时序证据，无法确认定庄是否先于掷骰发牌，判 unverified。`candidateDifference` 为空（无升级候选）。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目；effectiveDifference=unverified）。

### AT-ST-C06-003 胡牌者下局坐庄

- **需求规则**：有人胡牌时，下一小局由胡牌者坐庄。即一小局以胡牌结束后，胡牌者成为下一小局庄家（功能点 FP-ST-C06-002 胡牌后轮庄；scope 覆盖胡牌结束后的庄家归属，不覆盖流局连庄与牢级倍数）。
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（客户端无针对本原子的直接验证结论，`evidenceIds` 为空、`pending=false`）
  - 实现要点：按需求，客户端在小局结算后按服务端下发的下一小局庄家信息更新座位上的庄位，使玩家看到新庄家即本小局胡牌者；客户端不自行推算庄位。
  - 证据定位：无直接证据（`evidenceIds` 为空）。本原子无邻近可引用的客户端证据（client-evidence.json 中无 `atomIds` 含 AT-ST-C06 的条目）。
- **服务端职责**：
  - serverVerification.applicability：空（服务端无针对本原子的直接适用性结论，`evidenceIds` 为空、`pending=false`）
  - 规则说明：按需求，服务端在本小局存在胡牌者时，把该胡牌者定为下一小局庄家，并在下一小局开局数据中下发新庄家。
  - configCondition：`configCondition` 为空；本原子未取证轮庄规则是否受配置控制，也未见任何配置键被关联。
  - 证据定位：无直接证据（`evidenceIds` 为空）。本原子无邻近可引用的服务端证据（server-evidence.json 中无 `atomIds` 含 AT-ST-C06 的条目）。
- **双端协作**：有人胡牌 → 小局结束 → 服务端以胡牌者为下一小局庄家 → 随下一小局开局数据下发 → 客户端刷新庄位 → 玩家看到胡牌的人坐庄。
- **业务行为**：
  - trigger：本小局有人胡牌、该小局结束并准备进入下一小局
  - condition：本小局存在胡牌者
  - action：小局结算后按服务端下发的下一小局庄家信息更新座位上的庄位；服务端把本小局的胡牌者定为下一小局的庄家，并在下一小局开局数据中下发新的庄家
  - result：玩家看到下一小局的庄家正是上一小局胡牌的那个人
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：需求要求有人胡牌时下一小局由胡牌者坐庄。统一原子视图中客户端与服务端 verdict 均为空、evidenceIds 均为空、服务端 applicability 为空，两端均无实现证据；verificationScope=both 下任一端缺失即不能判符合，故无法验证庄家是否真的交给胡牌者，判 unverified。`candidateDifference` 为空（无升级候选）。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目；effectiveDifference=unverified）。

### AT-ST-C06-004 庄家自胡连庄

- **需求规则**：庄家自己胡牌为连庄。即本小局胡牌者即当前庄家时，下一小局由该庄家继续坐庄。
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（客户端无针对本原子的直接验证结论，`evidenceIds` 为空、`pending=false`）
  - 实现要点：按需求，结算后客户端按服务端下发的庄家信息保持庄位不变，玩家看不到庄家换人；客户端不区分「自胡」与「他人胡」而自行改变庄位。
  - 证据定位：无直接证据（`evidenceIds` 为空）。本原子 `verificationScope=server`，客户端侧仅作需求侧说明。
- **服务端职责**：
  - serverVerification.applicability：空（服务端无针对本原子的直接适用性结论，`evidenceIds` 为空、`pending=false`）
  - 规则说明：按需求，服务端在判定胡牌者即当前庄家时维持其庄家身份，下一小局仍以原庄家（即该胡牌者）开局，形成连庄。
  - configCondition：`configCondition` 为空；本原子未取证「胡牌者与庄家比对」是否受配置影响。
  - 证据定位：无直接证据（`evidenceIds` 为空）。本原子无邻近可引用的服务端证据。
- **双端协作**：庄家自摸胡牌 → 小局结束 → 服务端判定胡牌者就是现庄家、维持其庄家身份 → 下发下一小局开局数据 → 客户端庄位保持不变 → 玩家看到连庄。
- **业务行为**：
  - trigger：本小局的庄家自己胡牌、该小局结束
  - condition：本小局胡牌的人就是当前的庄家
  - action：结算后按服务端下发的庄家信息保持庄位不变；服务端判定胡牌者即当前庄家时让其继续坐庄，下一小局仍以原庄家开局
  - result：玩家看到庄家位置没有变化，庄家继续坐庄，形成连庄
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：需求要求庄家自己胡牌算连庄、庄家不变。该原子按服务端规则域验证（verificationScope=server）；统一原子视图中服务端 applicability 为空、evidenceIds 为空，无胡牌者与庄家比对的实现证据，无法确认庄家自摸后是否连庄，判 unverified。`candidateDifference` 为空（无升级候选）。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目；effectiveDifference=unverified）。

### AT-ST-C06-005 流局原庄连庄

- **需求规则**：流局时原庄连庄。即一小局以流局结束时，原来的庄家继续坐下一小局庄家（功能点 FP-ST-C06-003 流局连庄；scope 覆盖流局结束后的庄家归属，不覆盖胡牌轮庄与倍数）。
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（客户端无针对本原子的直接验证结论，`evidenceIds` 为空、`pending=false`）
  - 实现要点：按需求，流局结算后客户端按服务端下发的庄家信息保持原庄位显示，不出现庄家换人的表现。
  - 证据定位：无直接证据（`evidenceIds` 为空）。本原子无邻近可引用的客户端证据。
- **服务端职责**：
  - serverVerification.applicability：空（服务端无针对本原子的直接适用性结论，`evidenceIds` 为空、`pending=false`）
  - 规则说明：按需求，服务端判定本小局流局时保留原庄家，下一小局仍由原庄家坐庄，并把该庄位随下一小局开局数据下发。
  - configCondition：`configCondition` 为空；本原子未取证流局分支的触发判定与配置关联。
  - 证据定位：无直接证据（`evidenceIds` 为空）。本原子无邻近可引用的服务端证据。
- **双端协作**：牌墙摸完仍无人胡牌 → 判定流局 → 服务端保留原庄家作为下一小局庄家 → 下发下一小局开局数据 → 客户端庄位不变 → 玩家看到原庄继续坐庄。
- **业务行为**：
  - trigger：本小局没有分出胜负、以流局结束
  - condition：本小局被判定为流局
  - action：流局结算后按服务端下发的庄家信息保持原庄位显示，不出现庄家换人的表现；服务端判定本小局流局时保留原庄家，下一小局仍由原庄家坐庄
  - result：玩家看到流局后庄家位置不变，原来的庄家继续坐庄
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：需求要求流局时原庄连庄。统一原子视图中客户端与服务端 verdict 均为空、evidenceIds 均为空、服务端 applicability 为空，两端均无实现证据；verificationScope=both 下证据不足，无法验证流局后庄家是否保留原庄，判 unverified。`candidateDifference` 为空（无升级候选）。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目；effectiveDifference=unverified）。

### AT-ST-C06-006 首庄新庄连庄均为三牢

- **需求规则**：首庄、新庄、连庄都是三牢。即无论本局庄家是首局庄、闲家胡牌后接任的新庄，还是原庄连庄，庄家牢级统一按三牢处理（功能点 FP-ST-C06-004 牢级与庄闲倍数；scope 覆盖庄家牢级判定与庄闲倍数取值，不覆盖连庄数选项中的二牢、一牢档位）。
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（客户端无针对本原子的直接验证结论，`evidenceIds` 为空、`pending=false`）
  - 实现要点：按需求，客户端按服务端下发的庄家牢级信息在界面上显示本局庄家状态，不自行推算牢级。客户端侧本原子无任何证据，仅能引用同族倍数换算实现作旁证：`GameData.getZhuangXianMult` 以 `1 << this._bankerLevel` 取倍数。
  - 证据定位：无直接证据（本原子 `evidenceIds` 为空）。邻近参考（来自复核条目 evidenceScopes，非本原子专属证据）：CLE-AT-ST-C01-004-04，client_code，data/GameData.ts:1664-1666，claimKey=banker-level-multiplier（客户端按下发牢级换算倍数，不参与牢级判定）。
- **服务端职责**：
  - serverVerification.applicability：空（服务端无针对本原子的直接适用性结论，`evidenceIds` 为空、`pending=false`）
  - 规则说明：按需求，服务端对本小局庄家一律按三牢处理：首庄、新庄、连庄取同一牢级，不按庄型区分。复核补充的邻近证据显示，定庄步骤内以配置值一次性设定牢级（`SetBankerLevel(GetConfiguredBankerLevel())`），牢级本身不区分首庄 / 新庄 / 连庄；牢级由 `banker_level_type + 1` 换算并夹取 1..3。
  - configCondition：`configCondition` 为空（统一原子视图未给出）。复核补充的配置生效条件为：`banker_level_type` 默认 0（平庄起→一牢，hzmj_server/server_config.cpp:18）；要达到需求的「三牢」须由创房 JSON 显式下发 `banker_level_type=2`（笃三老庄，牢庄起算档位对应 2/4/8 倍）。
  - 证据定位：无本原子专属证据（`evidenceIds` 为空）。复核引用证据（evidenceScopes，待审批）：SVE-AT-ST-C01-004-01，common_game，common_game/com_game/common_game_com_ju.cpp:132-136，claimKey=banker-level-applied-at-ding-zhuang；SVE-AT-ST-C01-004-02，common_game，common_game/com_game/common_game_com_ju.cpp:191-196，claimKey=banker-level-type-to-level-mapping；SVE-AT-ST-C01-004-04，hzmj_server，hzmj_server/server_config.cpp:18，claimKey=banker-level-type-default-flat。
- **双端协作**：新一小局开始 → 服务端按三牢为庄家设定牢级 → 随开局数据下发 → 客户端展示庄家状态 → 玩家看到庄家统一处于三牢。
- **业务行为**：
  - trigger：新一小局开始、需要确定本局庄家的牢级（庄家番级）
  - condition：无论本局庄家是首庄、新庄（闲家胡牌后接庄）还是连庄
  - action：按服务端下发的庄家牢级信息在界面上显示本局庄家状态，不自行推算；服务端对本小局庄家一律按三牢处理，首庄、新庄、连庄都给到同一牢级
  - result：玩家看到不论首局、换人接庄还是连庄，庄家都按三牢这一档处理
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：需求要求首庄、新庄、连庄都是三牢。该原子按服务端规则域验证（verificationScope=server）；统一原子视图中服务端 applicability 为空、evidenceIds 为空，无牢级设定与下发证据，无法确认三种庄型是否都按三牢处理，判 unverified。`candidateDifference` 为空（无升级候选）。
  - 待审批建议：partial（evidence-is-not-consistency：补到定庄时牢级由配置统一设定的证据，可判「不区分庄型」口径成立；但服务端默认 `banker_level_type=0` 非三牢、需创房显式下发笃三老庄，且客户端侧无证据，不足以判 consistent，降为 partial），**尚未生效**（reviewStatus=pending）。
- **验证结论（L7）**：verification_required；l7Basis=proposed（存在 reviewStatus=pending 的复核建议 partial，尚未生效；effectiveDifference 仍为 unverified）。

### AT-ST-C06-007 庄闲倍数固定8倍

- **需求规则**：庄闲倍数固定 8 倍。即本小局庄家为三牢时，庄闲之间的倍数固定按 8 倍计算。
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（客户端无针对本原子的直接验证结论，`evidenceIds` 为空、`pending=false`）
  - 实现要点：按需求，客户端按服务端下发的结算倍数展示庄闲输赢，不自行改变倍率。复核补充的邻近证据显示客户端倍数由牢级左移换算得到，三牢即 8 倍。
  - 证据定位：无直接证据（`evidenceIds` 为空）。邻近参考（复核引用，待审批）：CLE-AT-ST-C01-004-04，client_code，data/GameData.ts:1664-1666，claimKey=banker-level-multiplier（`getZhuangXianMult` 返回 `1 << this._bankerLevel`）。
- **服务端职责**：
  - serverVerification.applicability：空（服务端无针对本原子的直接适用性结论，`evidenceIds` 为空、`pending=false`）
  - 规则说明：按需求，服务端在结算时把庄闲之间的倍数按固定 8 倍计算并据此算出各家输赢分。复核补充：配置注释给出牢级档位对应 2/4/8 倍（三牢档即 8 倍），牢级 `level = banker_level_type + 1` 夹取 1..3，level3 与 8 倍对应；但把该倍率乘进各家输赢的结算实现未在证据原文中直接出现（`SVE-AT-ST-C01-004-02` 仅以 dependencyFiles 指向 common_game/com_game/common_game_com_result.cpp）。
  - configCondition：`configCondition` 为空（统一原子视图未给出）。复核补充：8 倍档位依赖创房下发 `banker_level_type=2`（笃三老庄），默认 `banker_level_type=0` 时为平庄起（对应 2 倍档）。
  - 证据定位：无本原子专属证据（`evidenceIds` 为空）。复核引用证据（evidenceScopes，待审批）：SVE-AT-ST-C01-004-03，hzmj_server，hzmj_server/game_logic.cpp:56-59，claimKey=banker-level-type-json-key；SVE-AT-ST-C01-004-02，common_game，common_game/com_game/common_game_com_ju.cpp:191-196，claimKey=banker-level-type-to-level-mapping；CLE-AT-ST-C01-004-04，client_code，data/GameData.ts:1664-1666，claimKey=banker-level-multiplier。
- **双端协作**：小局结束 → 服务端按三牢庄家取 8 倍庄闲倍数算分 → 下发结算明细 → 客户端按 8 倍倍数展示结果 → 玩家看到庄闲结算按 8 倍。
- **业务行为**：
  - trigger：本小局结束、进入分数结算并计算庄闲之间的倍数
  - condition：本小局庄家为三牢
  - action：按服务端下发的结算倍数展示庄闲输赢，不自行改变倍率；服务端结算时把庄闲之间的倍数按固定 8 倍计算，并据此算出各家的输赢分
  - result：玩家在结算界面看到庄闲之间的倍数固定为 8 倍
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：需求要求庄闲倍数固定 8 倍。该原子按服务端规则域验证（verificationScope=server）；统一原子视图中服务端 applicability 为空、evidenceIds 为空，无倍数取值与结算实现证据，无法确认是否固定 8 倍，判 unverified。`candidateDifference` 为空（无升级候选）。
  - 待审批建议：partial（evidence-is-not-consistency：牢级→倍率映射与客户端 `1 << level` 可证三牢=8 倍，但结算乘算落地未直接取证，不足以判 consistent，降为 partial），**尚未生效**（reviewStatus=pending）。
- **验证结论（L7）**：verification_required；l7Basis=proposed（存在 reviewStatus=pending 的复核建议 partial，尚未生效；effectiveDifference 仍为 unverified）。

### AT-ST-C06-008 三牢不再增加

- **需求规则**：三牢不再增加。即庄家牢级达到三牢后不再提升，连庄多次仍按三牢对应的倍数结算（功能点 FP-ST-C06-004：三牢不再继续增加）。
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（客户端无针对本原子的直接验证结论，`evidenceIds` 为空、`pending=false`）
  - 实现要点：按需求，客户端按服务端下发的倍数显示结算结果，玩家看不到倍数随连庄次数继续上涨；客户端不自行累加牢级。复核补充的邻近证据显示客户端倍数完全由下发牢级左移得出，牢级封顶三牢时倍数为固定 8 倍。
  - 证据定位：无直接证据（`evidenceIds` 为空）。邻近参考（复核引用，待审批）：CLE-AT-ST-C01-004-04，client_code，data/GameData.ts:1664-1666，claimKey=banker-level-multiplier。
- **服务端职责**：
  - serverVerification.applicability：空（服务端无针对本原子的直接适用性结论，`evidenceIds` 为空、`pending=false`）
  - 规则说明：按需求，庄家已在三牢时服务端不再提升牢级，连庄多次倍数仍停留在三牢对应的 8 倍。复核补充：牢级换算处存在硬上限（`level = type + 1`，`if (level > 3) return 3`），且每次定庄均以配置值重设牢级并以 `SetLianZhuang(1)` 起始，牢级不随连庄次数累加。
  - configCondition：`configCondition` 为空（统一原子视图未给出）。复核补充：牢级取值仍由 `banker_level_type` 决定，三牢档需创房下发 `banker_level_type=2`；默认 0 时为平庄起一牢。
  - 证据定位：无本原子专属证据（`evidenceIds` 为空）。复核引用证据（evidenceScopes，待审批）：SVE-AT-ST-C01-004-02，common_game，common_game/com_game/common_game_com_ju.cpp:191-196，claimKey=banker-level-type-to-level-mapping；SVE-AT-ST-C01-004-01，common_game，common_game/com_game/common_game_com_ju.cpp:132-136，claimKey=banker-level-applied-at-ding-zhuang；SVE-AT-ST-C01-004-03，hzmj_server，hzmj_server/game_logic.cpp:56-59，claimKey=banker-level-type-json-key；CLE-AT-ST-C01-004-04，client_code，data/GameData.ts:1664-1666，claimKey=banker-level-multiplier。
- **双端协作**：庄家连续连庄 → 服务端发现牢级已达三牢、不再上调 → 仍按三牢 8 倍结算 → 下发结算明细 → 客户端展示不变的倍数 → 玩家看到连庄再多倍数也不变。
- **业务行为**：
  - trigger：庄家连续多局连庄、每次结算都要确认本局庄家牢级
  - condition：庄家当前已处于三牢
  - action：按服务端下发的倍数显示结算结果，玩家看不到倍数随连庄次数继续上涨；服务端在庄家已在三牢时不再提升牢级，连庄多次倍数仍停留在三牢对应的 8 倍
  - result：玩家看到连庄多次后庄闲倍数仍保持三牢 8 倍，不会继续翻倍
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：需求要求三牢不再增加、连庄不继续提升牢级。该原子按服务端规则域验证（verificationScope=server）；统一原子视图中服务端 applicability 为空、evidenceIds 为空，无牢级封顶实现证据，无法确认三牢是否为上限，判 unverified。`candidateDifference` 为空（无升级候选）。
  - 待审批建议：partial（evidence-is-not-consistency：牢级夹取 ≤3 且每次定庄按配置重设，可证「三牢封顶、不随连庄提升」；但倍数结算实现未直接取证，不足以判 consistent，降为 partial），**尚未生效**（reviewStatus=pending）。
- **验证结论（L7）**：verification_required；l7Basis=proposed（存在 reviewStatus=pending 的复核建议 partial，尚未生效；effectiveDifference 仍为 unverified）。

## 证据索引

本阶段 8 个原子在统一原子视图中的直接 `evidenceIds` 均为空（client-evidence.json 与 server-evidence.json 中均无 `atomIds` 含 AT-ST-C06 的条目）。下表收录 difference-review.json 中 ST-C06 复核条目（006 / 007 / 008）作为邻近参考引用的证据，仅供定位参考，**不构成本阶段原子的直接验证依据**，且对应复核建议均未生效。

| 证据 ID | layer | file:line | claimKey |
|---|---|---|---|
| SVE-AT-ST-C01-004-01 | common_game | common_game/com_game/common_game_com_ju.cpp:132-136 | banker-level-applied-at-ding-zhuang |
| SVE-AT-ST-C01-004-02 | common_game | common_game/com_game/common_game_com_ju.cpp:191-196 | banker-level-type-to-level-mapping |
| SVE-AT-ST-C01-004-03 | hzmj_server | hzmj_server/game_logic.cpp:56-59 | banker-level-type-json-key |
| SVE-AT-ST-C01-004-04 | hzmj_server | hzmj_server/server_config.cpp:18 | banker-level-type-default-flat |
| CLE-AT-ST-C01-004-04 | client_code | data/GameData.ts:1664-1666 | banker-level-multiplier |

## 待处理事项

本阶段 8 个原子均在 pending-list.md「规则待验证」分组中，建议动作统一为「补证 both」。本阶段无 blocked（查证未完成）原子，无 decision_required（需策划裁决）原子。

| atomId | 验证范围 | 问题 | 说明 | 建议动作 |
|---|---|---|---|---|
| AT-ST-C06-001 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C06-002 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C06-003 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C06-004 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C06-005 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C06-006 | server | 规则待验证 | 证据不足（另有待审批复核建议：partial） | 补证 both |
| AT-ST-C06-007 | server | 规则待验证 | 证据不足（另有待审批复核建议：partial） | 补证 both |
| AT-ST-C06-008 | server | 规则待验证 | 证据不足（另有待审批复核建议：partial） | 补证 both |

补充：

- AT-ST-C06-006 / 007 / 008 各有 1 条 `reviewStatus=pending` 的待审批复核建议（reviewedDifference 均为 `partial`），尚未生效，需审批后方可作为最终差异结论；复核已补到定庄时牢级由配置统一设定、牢级夹取 ≤3 的机制证据，但服务端默认 `banker_level_type=0`（平庄起→一牢）而非三牢、结算乘算实现未直接取证，故建议值停在 partial。
- 补证重点：首局随机定庄的抽取实现与随机源、定庄先于掷骰发牌的调用时序、胡牌者接任下一小局庄家（含庄家自胡连庄）、流局保留原庄家分支、牢级按庄型统一设定与三牢封顶、庄闲倍数在结算侧的乘算落地；客户端侧需补齐庄位下发消费、流局 / 连庄庄位保持表现及结算倍数展示证据。
