# ST-C01 房间参数（单选）

## 阶段概述

本阶段负责好友房创房面板「房间参数」中所有单选组的技术落地规格——覆盖模式、人数、玩法、连庄数、胡牌、局数档、底分、封顶、打片档、吃碰、承包及其人数/吃碰联动，共 29 个需求原子。

- 原子总数：29
- L7 分布：verified 0 / verification_required 25 / decision_required 0 / not_applicable 4
- 分析路径：本阶段全部原子 analysisPath=full，无 blocked、无 conflict-fast，无异动升级候选（candidateDifference 均为空）
- 输入来源：feature_index.json（7 个功能点）、business-behavior.json、difference-review.json（5 条复核建议，reviewStatus 均为 pending）、l7-classify.json、client-evidence.json / server-evidence.json、pending-list.md

L7 口径说明：本阶段无「查证未完成」条目（blockedAtoms 为空），全部 l7Basis=proposed，尚待审批；not_applicable 的 4 个原子（007/008/012/017）为服务端不参与的面板显隐类规则（applicability=inactive）。

## 需求条目

### 功能点与原子映射

| 功能点 | 名称 | 原子 | 原子数 |
|---|---|---|---|
| FP-ST-C01-001 | 基础对局参数单选 | AT-ST-C01-001 ~ 005 | 5 |
| FP-ST-C01-002 | 局数档选项与人数可用性 | AT-ST-C01-006 ~ 009 | 4 |
| FP-ST-C01-003 | 底分与封顶选项 | AT-ST-C01-010 ~ 011 | 2 |
| FP-ST-C01-004 | 打片档与局数片数互斥提交 | AT-ST-C01-012 ~ 016 | 5 |
| FP-ST-C01-005 | 吃碰选项与联动 | AT-ST-C01-017 ~ 020 | 4 |
| FP-ST-C01-006 | 承包选项与显示范围 | AT-ST-C01-021 ~ 023 | 3 |
| FP-ST-C01-007 | 人数联动 | AT-ST-C01-024 ~ 029 | 6 |

---

### AT-ST-C01-001 模式选项

- **需求规则**：模式为单选，可选值为「正常 / 简洁」，默认选中「正常」。
- **验证范围**：client
- **客户端职责**：verdict=partial。实现要点：客户端仅在读取对局配置时消费 `simple_mode` 字段（`GameData.simpleMode` 读取 `_gameConfig?.simple_mode === true`），本轮未取得创房面板「模式」单选组及其默认选中「正常」的直接证据，面板交互未证实。证据：CLE-AT-ST-C01-001-02（data/GameData.ts:1443-1445，claimKey=simple-mode-config-consumed）。
- **服务端职责**：applicability=conditional。规则说明：`simple_mode` 好友房默认 false（等同「正常」，hzmj_server/server_config.cpp:41）；创房 JSON 下发 true 时置简洁模式（hzmj_server/game_logic.cpp:163-167），开启后仅在 `SendNotifyInfo` 中抑制白名单内的规则类 notice——守庄、巡限碰、吃禁手、有财必拷响、只碰不吃、有财 2 番起胡（common_game/common_game_context.cpp:29-36），并把 `simple_mode` 通过 `FillMsgGameConfig` 下发客户端（common_game/common_game_context.cpp:438-442）。生效条件 configCondition：`simple_mode`，默认 false。证据：SVE-AT-ST-C01-001-04（hzmj_server/server_config.cpp:41，simple-mode-default-off）、SVE-AT-ST-C01-001-03（hzmj_server/game_logic.cpp:163-167，simple-mode-json-key）、SVE-AT-ST-C01-001-01（common_game/common_game_context.cpp:29-36，simple-mode-suppress-notice）、SVE-AT-ST-C01-001-02（common_game/common_game_context.cpp:438-442，simple-mode-broadcast）。
- **双端协作**：玩家在创房面板选模式 → 客户端随创房提交 → 服务端保存并按开关决定是否抑制规则提示 → 把模式档位回传客户端 → 客户端在对局中按该档位增减提示与动效。
- **业务行为**：
  - trigger：玩家打开好友房创房面板，或对局开始后体验房间模式
  - condition：处于房间参数设置阶段，且服务端「简洁模式」开关默认关闭（等同「正常」），可选择开启（等同「简洁」）
  - action：客户端提供「正常 / 简洁」二选一并在未操作时停在「正常」，对局中按档位增减提示与动效；服务端按提交值决定是否开启简洁模式，开启后只屏蔽上述六类规则提示，其余规则照常判定，并回传档位
  - result：玩家在对局中按所选档位看到多或少一些规则提示与动效；不操作时就是「正常」，提示齐全
- **实际实现差异**：difference=partial。baselineDetail：需求要求创房面板以单选提供「正常/简洁」且默认「正常」。客户端只找到简洁模式下抑制提示与部分动画的生效证据，未见创房面板该单选组及其默认选中的直接证据；服务端配置默认「正常」、开启后按白名单抑制提示，档位含义与需求一致，但面板交互是否按需求呈现尚未证实，故为部分满足。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=conditional，effectiveDifference=partial，待审批）。需补证创房面板该单选组与默认项。

---

### AT-ST-C01-002 人数选项与默认

- **需求规则**：人数为单选，可选值为「2人 / 3人 / 4人」，默认选中「4人」，选中后按「人数联动」生效。
- **验证范围**：client
- **客户端职责**：verdict=partial。实现要点：客户端已具备二人房专属 gameId（`GameID_ER_REN_HYF=42322`）、2/3 人座位映射表 `SC_PLAYER_LOCAL_SEAT_MAP`、以及按 gameId 显示「二人房」房间名的处理；但未见创房面板人数单选组及默认 4人的直接证据，面板交互未证实。证据：CLE-AT-ST-C01-002-02（config/GameDefine.ts:4-7，er-ren-room-gameid）、CLE-AT-ST-C01-002-03（config/GameDefine.ts:271-279，seat-count-map-2-3）、CLE-AT-ST-C01-002-04（layer/BoxHzmjBackView.ts:82，er-ren-room-label）。
- **服务端职责**：applicability=active。规则说明：服务端人数取自桌子椅子数（`SetPlayerCount(GetChairCount())`），并据此门控缺一色（`enable_two_suit && player_count <= 3`）与守庄（`player_count <= 2` 强制关闭）。生效条件 configCondition：无（人数为建桌基础输入）。证据：SVE-AT-ST-C01-002-02（common_game/common_game_logic.cpp:474-478，player-count-from-chair-count）、SVE-AT-ST-C01-002-01（common_game/common_game_init.cpp:57-58，player-count-gates-two-suit）、SVE-AT-ST-C01-002-03（hzmj_server/game_logic.cpp:149-161，player-count-gates-guard-dealer）。
- **双端协作**：玩家选择人数 → 客户端随创房提交 → 服务端按人数建桌并下发房规与座位 → 客户端按人数摆放牌桌、显示房间标识。
- **业务行为**：
  - trigger：玩家打开好友房创房面板，或在面板上切换人数档
  - condition：处于房间参数设置阶段，人数可选 2 人、3 人、4 人，未操作时为 4 人
  - action：客户端提供三选一并默认 4人，选定后按人数联动刷新局数、吃碰、承包等选项，牌桌按所选人数摆放座次；服务端按提交人数建桌、分配座位并适用对应人数规则，下发房规与座位信息
  - result：玩家看到与所选人数一致的牌桌座位（例如二人房只摆两个座位并显示「二人房」标识）
- **实际实现差异**：difference=partial。baselineDetail：需求要求三档人数单选、默认 4人并按人数联动。客户端只找到二人房牌桌摆放与「二人房」标识的证据，未见创房面板人数单选组及默认 4人的直接证据；服务端按人数建桌已找到证据。面板交互部分未证实，故为部分满足。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=active，effectiveDifference=partial，待审批）。

---

### AT-ST-C01-003 玩法选项

- **需求规则**：玩法为单选，可选值为「白板财神 / 翻财神」，默认选中「白板财神」。
- **验证范围**：client
- **客户端职责**：verdict=partial。实现要点：客户端财神类型取值口径为 `0=白板财神，1=翻财神`（`GameData` 字段注释），对局中由 `GameJokerCmd._needFanJokerAni` 判断是否播放翻财神动画（非白板牌或房间规则 `cai_shen_type=1` 时播放）；未见创房面板玩法单选组及默认白板财神的直接证据。证据：CLE-AT-ST-C01-003-02（data/GameData.ts:50，cai-shen-type-values）、CLE-AT-ST-C01-003-03（controller/cmd/gameCmd/GameJokerCmd.ts:74-77，cai-shen-type-room-rule）。
- **服务端职责**：applicability=conditional。规则说明：`cai_shen_type` 好友房默认 0（白板财神，hzmj_server/server_config.cpp:16）；创房 JSON 解析该键并 `SetCaiShenType`（hzmj_server/game_logic.cpp:51-55）。0 时白板恒为实际财神并登记 joker；非 0 时走 `CalcFanCaiShen` 翻出真财神，翻出牌作真财神且该张从牌墙移除，白板降为替代牌（common_game/com_game/common_game_com_ju.cpp:226-248）。生效条件 configCondition：`cai_shen_type`，默认 0=白板财神。证据：SVE-AT-ST-C01-003-03（hzmj_server/server_config.cpp:16，cai-shen-type-default-white-board）、SVE-AT-ST-C01-003-02（hzmj_server/game_logic.cpp:51-55，cai-shen-type-json-key）、SVE-AT-ST-C01-003-01（common_game/com_game/common_game_com_ju.cpp:226-248，cai-shen-type-behavior）。
- **双端协作**：玩家选择玩法档 → 客户端随创房提交 → 服务端按档位确定财神口径 → 对局中客户端按该口径播放翻牌动效并用白板作替身成牌。
- **业务行为**：
  - trigger：玩家打开好友房创房面板选择玩法，或对局中触发翻财神
  - condition：处于房间参数设置阶段；服务端财神类型配置默认「白板财神」，可改为「翻财神」
  - action：客户端提供二选一、未操作时为白板财神，翻财神档下播放翻牌动效并把白板当替身牌参与成牌判断；服务端白板档下白板恒为实际财神，翻财神档下翻出的牌作真财神并从牌墙移除、白板降为替代牌
  - result：玩家在翻财神房看到翻财神动效、白板以替身参与成牌；默认白板财神房则白板直接当财神
- **实际实现差异**：difference=partial。baselineDetail：需求要求玩法单选「白板财神/翻财神」且默认白板财神。客户端只找到翻财神对局播放动效、白板作替身成牌的证据，未见创房面板玩法单选组及默认白板财神的直接证据；服务端按财神类型配置切换口径已找到证据。面板交互未证实，故为部分满足。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=conditional，effectiveDifference=partial，待审批）。

---

### AT-ST-C01-004 连庄数选项

- **需求规则**：连庄数为单选，可选值为「笃三老庄 / 笃二老庄 / 平庄起」，默认选中「笃三老庄」。
- **验证范围**：client
- **客户端职责**：verdict=partial。实现要点：客户端从下发数据读取 `banker_level` 写入连庄计数（`GameData.setLianZhuangCount`），并按 `1 << _bankerLevel` 换算庄闲倍数；两条均只覆盖对局内消费，未见创房面板三选一与默认「笃三老庄」的直接证据。证据：CLE-AT-ST-C01-004-03（controller/cmd/gameCmd/GameJuDataCmd.ts:34-35，lian-zhuang-level-from-room-config）、CLE-AT-ST-C01-004-04（data/GameData.ts:1664-1666，banker-level-multiplier）。
- **服务端职责**：applicability=conditional。规则说明：`banker_level_type` 语义为 0=平庄起 / 1=笃二老庄 / 2=笃三老庄（hzmj_server/game_logic.cpp:56-59），但好友房服务端默认值为 0=平庄起（hzmj_server/server_config.cpp:18），并非需求的默认「笃三老庄」；定庄时按 `level = type + 1` 并夹取 1..3 得到牢庄等级（common_game/com_game/common_game_com_ju.cpp:191-196、132-136），倍率为 2^level（2/4/8）。生效条件 configCondition：要得到需求默认「笃三老庄」，创房 JSON 必须显式下发 `banker_level_type=2`。证据：SVE-AT-ST-C01-004-04（hzmj_server/server_config.cpp:18，banker-level-type-default-flat）、SVE-AT-ST-C01-004-03（hzmj_server/game_logic.cpp:56-59，banker-level-type-json-key）、SVE-AT-ST-C01-004-02（common_game/com_game/common_game_com_ju.cpp:191-196，banker-level-type-to-level-mapping）、SVE-AT-ST-C01-004-01（common_game/com_game/common_game_com_ju.cpp:132-136，banker-level-applied-at-ding-zhuang）。
- **双端协作**：玩家选择连庄档 → 客户端随创房提交 → 服务端换算牢庄等级与倍数并下发 → 客户端按档位显示庄家标记与成倍倍数。
- **业务行为**：
  - trigger：玩家打开好友房创房面板选择连庄档，或开局后查看庄家与倍数
  - condition：处于房间参数设置阶段；服务端自身默认档为「平庄起」，要得到需求默认「笃三老庄」须由创房显式下发对应档位
  - action：客户端提供三选一、未操作时为笃三老庄，开局后按牢庄等级显示庄家并换算庄闲倍数；服务端按下发档位换算牢庄等级（档位加一夹在 1 至 3）并给出 2/4/8 倍倍数
  - result：玩家看到所选牢庄档位对应的庄家标识，以及随档位成倍增长的庄闲倍数
- **实际实现差异**：difference=partial。baselineDetail：需求要求连庄档默认选「笃三老庄」。客户端只找到按牢庄等级显示庄家、换算庄闲倍数的证据，未见创房面板连庄档默认选中项的直接证据；服务端默认档为「平庄起」而非需求的笃三老庄，需创房显式下发才一致。面板默认项未证实，故为部分满足（不判为矛盾）。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=conditional，effectiveDifference=partial）。待审批建议：partial（evidence-is-not-consistency——服务端档位换算与需求映射自洽，但缺创房面板三选一/默认项证据，不能凭档位能力判 consistent），该建议尚未生效。

---

### AT-ST-C01-005 胡牌选项

- **需求规则**：胡牌为单选，可选值为「自摸胡 / 庄闲放铳(庄三)」，默认选中「庄闲放铳」。
- **验证范围**：client
- **客户端职责**：verdict=partial。实现要点：客户端在结算流水类型中区分「点炮胡 / 放炮」文案（`ResultLiuShuiTypeName`），结算页 `_updateHuType` 按 `hu_type == HT_SELF` 选中自摸页（selectedIndex=3）否则选中接炮页（selectedIndex=2）；均为结算展示消费，未见创房面板胡牌单选组及默认「庄闲放铳」的直接证据。证据：CLE-AT-ST-C01-005-02（config/FanDefine.ts:637-638，hu-result-label-dianpao）、CLE-AT-ST-C01-005-03（layer/comp/BoxHzmjResultMid.ts:719-737，result-hu-type-tab）。
- **服务端职责**：applicability=conditional。规则说明：`enable_banker_discard_hu` 好友房默认 true=庄闲放铳（hzmj_server/server_config.cpp:19），创房 JSON 解析该键（hzmj_server/game_logic.cpp:60-63）。受理点炮/抢杠需三重条件同时成立：开关 true、`banker_level >= 3`（三牢，common_game/com_game/common_game_com_action.cpp:353-358）、基础点炮开关 `discard` 默认 true（mah_frame/base/base_config.cpp:42）；开关 false 时仅自摸胡。`banker_level` 由 `banker_level_type` 起算并随连庄递增。生效条件 configCondition：`enable_banker_discard_hu`，默认 true。证据：SVE-AT-ST-C01-005-03（hzmj_server/server_config.cpp:19，banker-discard-hu-default-on）、SVE-AT-ST-C01-005-02（hzmj_server/game_logic.cpp:60-63，banker-discard-hu-json-key）、SVE-AT-ST-C01-005-01（common_game/com_game/common_game_com_action.cpp:353-358，banker-discard-hu-requires-three-level）、SVE-AT-ST-C01-005-04（mah_frame/base/base_config.cpp:42，discard-allowed-default）。
- **双端协作**：玩家选择胡牌方式 → 客户端随创房提交 → 服务端按开关与牢庄等级决定可胡方式 → 结算下发胡牌方式 → 客户端展示自摸或点炮胡字样。
- **业务行为**：
  - trigger：玩家打开好友房创房面板选择胡牌方式，或本局结束查看结算
  - condition：处于房间参数设置阶段；服务端「庄闲放铳」开关默认开启，且庄家达到三牢（基础点炮开关也开启）时才允许点炮与抢杠，关闭时只有自摸
  - action：客户端提供二选一、未操作时为庄闲放铳，结算时按实际胡牌方式切换显示自摸或点炮/吃胡；服务端按开关决定是否受理点炮与抢杠，未开启时只接受自摸，开启时还要求庄家达到三牢
  - result：玩家在结算里看到「自摸」或「点炮胡/吃胡」，牌桌上也只能按本房允许的方式胡牌
- **实际实现差异**：difference=partial。baselineDetail：需求要求胡牌单选「自摸胡/庄闲放铳(庄三)」且默认庄闲放铳。客户端只找到结算按自摸或接炮切换展示的证据，未见创房面板胡牌单选组及默认项的直接证据；服务端开关默认开启、并受三牢条件约束的规则已找到证据。面板交互未证实，故为部分满足。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=conditional，effectiveDifference=partial，待审批）。

---

### AT-ST-C01-006 局数档可选值与默认

- **需求规则**：局数为单选，局数档可选值为「4局 / 8局 / 16局 / 24局 / 32局」，默认选中「8局」。
- **验证范围**：client
- **客户端职责**：verdict=not_found。实现要点：本轮 CLE 证据集中无创房面板「局数」单选组、各档位列表及默认「8局」的任何证据，客户端实现未取得。证据：无（evidenceIds 为空）。
- **服务端职责**：applicability=unknown。规则说明：仅取得间接证据——打片房大结算判定注释显示「每小局胡牌结束……由房间服务据此进入大结算」，说明总局数/片数的整房结束判定归属房间服务，服务端游戏逻辑本身不直接承载局数档取值与默认值；该处适用性未定。生效条件 configCondition：`play_score`（打片房口径，与局数档为互斥的另一口径）。证据：SVE-AT-ST-C01-006-01（common_game/com_game/common_game_com_result.cpp:57-59，grand-settlement-owned-by-room-service）。
- **双端协作**：玩家选择局数档 → 客户端随创房提交 → 服务端按局数建桌并统计已打局数 → 局数用尽后结算整房。
- **业务行为**：
  - trigger：玩家打开好友房创房面板查看局数单选组
  - condition：处于房间参数设置阶段，局数档应为 4/8/16/24/32 局，未操作时为 8局
  - action：客户端列出各局数档并允许玩家选择、未操作时停在 8局；服务端按提交局数档设定本房总局数，局数用尽即结束本房
  - result：玩家看到所选局数档，并在打完该局数后结束本房
- **实际实现差异**：difference=unverified。baselineDetail：需求要求局数单选含 4/8/16/24/32 局且默认 8局。两端均无可用证据：客户端未找到创房面板局数单选组，服务端该处适用性未定（仅有间接证据）。无法判定符合性。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。属证据缺口，非已证实，需补证客户端面板与服务端局数口径。

---

### AT-ST-C01-007 4局仅4人房显示

- **需求规则**：「4局」档仅在人数为 4人 时显示。
- **验证范围**：client
- **客户端职责**：verdict=not_found。实现要点：未见客户端创房面板按人数过滤局数档（4 人房放出「4局」）的证据。证据：无（evidenceIds 为空）。
- **服务端职责**：applicability=inactive。规则说明：该规则是创房面板显隐控制，服务端只按客户端提交的局数档结算，不参与「4局」档位的显隐判定，故服务端不适用。生效条件 configCondition：无。证据：无（evidenceIds 为空）。
- **双端协作**：玩家切换人数 → 客户端按人数刷新局数档列表（4 人房放出 4局）→ 客户端随创房提交所选局数 → 服务端按提交值执行。
- **业务行为**：
  - trigger：玩家在创房面板查看或切换局数单选组
  - condition：人数为 4人 时局数档中出现「4局」；人数为 2/3 人时该档不出现
  - action：客户端按当前人数过滤局数档，只在 4 人房时放出「4局」；服务端只按提交的局数档结算，不参与显隐控制
  - result：4 人房玩家能在局数档里看到并选到「4局」；2/3 人房看不到该档
- **实际实现差异**：difference=unverified。baselineDetail：需求要求「4局」档仅在 4 人房显示。客户端未找到创房面板按人数过滤局数档的证据，服务端不参与该显隐（无可比对证据），无法判定符合性。
- **验证结论（L7）**：not_applicable；l7Basis=proposed（scope=inactive，effectiveDifference=unverified）。服务端侧不适用；面板显隐仍需客户端补证。

---

### AT-ST-C01-008 32局仅2人3人房显示

- **需求规则**：「32局」档仅在人数为 2人 或 3人 时显示。
- **验证范围**：client
- **客户端职责**：verdict=not_found。实现要点：未见客户端创房面板按人数过滤局数档（2/3 人房放出「32局」）的证据。证据：无（evidenceIds 为空）。
- **服务端职责**：applicability=inactive。规则说明：同 007，该规则属面板显隐，服务端只按提交的局数档结算，不参与「32局」档位显隐。生效条件 configCondition：无。证据：无（evidenceIds 为空）。
- **双端协作**：玩家切换人数 → 客户端按人数刷新局数档列表（2/3 人房放出 32局）→ 客户端随创房提交所选局数 → 服务端按提交值执行。
- **业务行为**：
  - trigger：玩家在创房面板查看或切换局数单选组
  - condition：人数为 2 人或 3 人时局数档中出现「32局」；人数为 4 人时该档不出现
  - action：客户端按当前人数过滤局数档，只在 2/3 人房放出「32局」；服务端只按提交的局数档结算，不参与显隐控制
  - result：2/3 人房玩家能在局数档里看到并选到「32局」；4 人房看不到该档
- **实际实现差异**：difference=unverified。baselineDetail：需求要求「32局」档仅在 2/3 人房显示。客户端未找到创房面板按人数过滤局数档的证据，服务端不参与该显隐（无可比对证据），无法判定符合性。
- **验证结论（L7）**：not_applicable；l7Basis=proposed（scope=inactive，effectiveDifference=unverified）。

---

### AT-ST-C01-009 局数档显示底分封顶并隐藏连庄不占局数

- **需求规则**：选中局数档时，显示「底分」与「封顶」，隐藏「连庄不占局数」。
- **验证范围**：client
- **客户端职责**：verdict=partial。实现要点：客户端在对局牌桌渲染「底分:N」（`BoxHzmjBackView._onUpdateBaseScore`），并在听牌面板按 `roomMaxFan` 为 0 或 -1 展示「无封顶」（`BoxHzmjTingPaiView.initUI`）；均为对局内展示，未见创房面板在局数档下切换到「底分/封顶可见、连庄不占局数隐藏」的直接证据。证据：CLE-AT-ST-C01-009-01（layer/BoxHzmjBackView.ts:86-88，base-score-display-in-table）、CLE-AT-ST-C01-009-03（layer/BoxHzmjTingPaiView.ts:95-99，feng-ding-status-text）。
- **服务端职责**：applicability=conditional。规则说明：`play_score` 默认 0=局数档（hzmj_server/server_config.cpp:43-46），`lian_zhuang_bu_zhan` 默认 false；服务端只在 `play_score > 0` 的打片房读取「连庄不占局数」（common_game/com_game/common_game_com_result.cpp:60-76），局数档下不参与判定；`base_score`（common_game_com_game_com_result.cpp:89）与 `score_limit`（:201-213）在结算中恒生效。生效条件 configCondition：`play_score=0`（局数档）、`lian_zhuang_bu_zhan` 默认 false、`base_score`/`score_limit` 恒生效。证据：SVE-AT-ST-C01-009-05（hzmj_server/server_config.cpp:43-46，box-defaults-score-limit-play-score）、SVE-AT-ST-C01-009-04（hzmj_server/game_logic.cpp:175-183，play-score-lian-zhuang-json-keys）、SVE-AT-ST-C01-009-02（common_game/com_game/common_game_com_result.cpp:60-76，play-score-gates-lian-zhuang-bu-zhan）、SVE-AT-ST-C01-009-03（common_game/com_game/common_game_com_result.cpp:89，base-score-used-in-settlement）、SVE-AT-ST-C01-009-01（common_game/com_game/common_game_com_result.cpp:201-213，score-limit-cap-in-settlement）。
- **双端协作**：玩家选中局数档 → 客户端切出底分与封顶选项并提交 → 服务端在局数模式下按底分与封顶结算 → 客户端在对局与结算中展示底分与封顶状态。
- **业务行为**：
  - trigger：玩家在局数单选组中选中任一局数档（4/8/16/24/32 局）
  - condition：当前为局数模式（服务端计数方式默认按局数），此时才启用底分与封顶，且不启用「连庄不占局数」
  - action：客户端在局数档下展示底分与封顶、不展示「连庄不占局数」，对局中牌桌显示底分数值、听牌面板显示封顶状态；服务端在局数模式下按提交的底分与封顶结算，不读取「连庄不占局数」开关
  - result：玩家能在局数房设置底分与封顶，对局/听牌面板看到底分与封顶（或无封顶），始终看不到「连庄不占局数」
- **实际实现差异**：difference=partial。baselineDetail：需求要求局数档下显示底分与封顶、隐藏「连庄不占局数」。客户端找到对局中展示底分与封顶状态的证据，但未见创房面板该显隐切换的直接证据；服务端确认局数模式下底分封顶恒生效、不读取连庄不占局数。面板显隐部分未证实，故为部分满足。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=conditional，effectiveDifference=partial，待审批）。

---

### AT-ST-C01-010 底分选项

- **需求规则**：底分为单选，可选值为「1分 / 2分 / 5分」，默认选中「1分」，仅在局数档显示。
- **验证范围**：client
- **客户端职责**：verdict=partial。实现要点：客户端牌桌按收到的底分渲染「底分:N」文本，可覆盖 1/2/5 各档的显示；但未见创房面板「底分」单选组（含 1分/2分/5分 三档、默认 1分、仅局数档出现）的直接证据。证据：CLE-AT-ST-C01-009-01（layer/BoxHzmjBackView.ts:86-88，base-score-display-in-table）。
- **服务端职责**：applicability=conditional。规则说明：`base_score` 基线默认 1（mah_frame/base/base_config.cpp:36），创房 JSON 注释默认 1（hzmj_server/game_logic.cpp:22-34），解析时仅接受 >0 覆写，<=0 打日志保持 1；服务端无 1/2/5 档位白名单，任意 >0 值都直接作为结算底分（common_game/com_game/common_game_com_result.cpp:89）。生效条件 configCondition：`base_score`，默认 1，仅 >0 生效。证据：SVE-AT-ST-C01-010-02（mah_frame/base/base_config.cpp:36，base-score-default-one）、SVE-AT-ST-C01-010-01（hzmj_server/game_logic.cpp:22-34，base-score-json-override）、SVE-AT-ST-C01-009-03（common_game/com_game/common_game_com_result.cpp:89，base-score-used-in-settlement）。
- **双端协作**：玩家选择底分档 → 客户端随创房提交 → 服务端取该值作为结算底分（非法值回落 1 分）→ 客户端在牌桌显示底分。
- **业务行为**：
  - trigger：玩家在局数房查看或切换底分单选组
  - condition：当前选中的是局数档；服务端底分默认为 1 分，只接受大于 0 的数值，任意大于 0 的值都会直接作为结算底分（不校验 1/2/5 白名单）
  - action：客户端在局数档下提供 1分/2分/5分 三选一、默认 1分，非局数档时不出底分，对局中牌桌渲染「底分:N」；服务端按提交值结算，缺省或非法值保持 1 分
  - result：玩家在牌桌上看到「底分:N」，与创房所选档位一致
- **实际实现差异**：difference=partial。baselineDetail：需求要求底分为 1/2/5 三档、默认 1分且仅局数档显示。客户端只找到牌桌渲染底分数值的证据，未见创房面板底分单选组的直接证据；服务端默认 1 分、按提交值结算，但代码层不限制 1/2/5 白名单。面板与档位约束未证实，故为部分满足。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=conditional，effectiveDifference=partial，待审批）。

---

### AT-ST-C01-011 封顶选项

- **需求规则**：封顶为单选，可选值为「无 / 20 / 40 / 64 / 80 / 128 / 256」，默认选中「无」，仅在局数档显示。
- **验证范围**：client
- **客户端职责**：verdict=partial。实现要点：客户端听牌面板按 `roomMaxFan` 为 0 或 -1 显示「无封顶」，可表达「无」档状态；但未见创房面板「封顶」单选组（七档、默认「无」、仅局数档出现）的直接证据。证据：CLE-AT-ST-C01-009-03（layer/BoxHzmjTingPaiView.ts:95-99，feng-ding-status-text）。
- **服务端职责**：applicability=conditional。规则说明：`score_limit` 好友房默认 0=「无」封顶（hzmj_server/server_config.cpp:43-46）；JSON 注释声明档位 0/20/40/64/80/128/256（hzmj_server/game_logic.cpp:169-173），但代码直接 `SetScoreLimit` 不校验白名单；>0 时按输家本局累计输分（含跟庄赔付）超过即截断并标 `kWLSRMax`（common_game/com_game/common_game_com_result.cpp:201-213）。生效条件 configCondition：`score_limit`，默认 0=不封顶。证据：SVE-AT-ST-C01-011-01（hzmj_server/game_logic.cpp:169-173，score-limit-json-key）、SVE-AT-ST-C01-009-05（hzmj_server/server_config.cpp:43-46，box-defaults-score-limit-play-score）、SVE-AT-ST-C01-009-01（common_game/com_game/common_game_com_result.cpp:201-213，score-limit-cap-in-settlement）。
- **双端协作**：玩家选择封顶档 → 客户端随创房提交 → 服务端仅在大于 0 时对输家本局输分截断 → 客户端展示封顶状态。
- **业务行为**：
  - trigger：玩家在局数房查看或切换封顶单选组
  - condition：当前选中的是局数档；服务端封顶默认为 0（即「无」），大于 0 时生效，代码层不校验 20/40/64/80/128/256 白名单
  - action：客户端在局数档下提供七选一、默认「无」，非局数档时不出封顶，听牌面板展示「无封顶」或「封顶N倍」；服务端封顶为 0 时不截断，大于 0 时按输家本局累计输分（含跟庄赔付）超过即截断并标记封顶
  - result：玩家在听牌/结算中看到「无封顶」或「封顶N倍」，与创房所选档位一致
- **实际实现差异**：difference=partial。baselineDetail：需求要求封顶七档、默认「无」且仅局数档显示。客户端只找到听牌面板展示封顶状态文本的证据，未见创房面板封顶单选组的直接证据；服务端默认 0、大于 0 时截断的逻辑已找到证据，但代码层不校验需求档位白名单。面板与档位约束未证实，故为部分满足。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=conditional，effectiveDifference=partial，待审批）。

---

### AT-ST-C01-012 打片档可选值

- **需求规则**：局数单选组另含打片档，可选值为「40片 / 50片 / 60片」。
- **验证范围**：client
- **客户端职责**：verdict=not_found。实现要点：本轮 12 条 CLE 证据中没有创房面板局数单选组或打片档提交证据，客户端未取得该组含打片档的实现。证据：无（evidenceIds 为空）。
- **服务端职责**：applicability=inactive。规则说明：服务端存在按片数结算的口径——`play_score` 被解析为起始片数（hzmj_server/game_logic.cpp:175-179），好友房默认 `play_score=0`、`lian_zhuang_bu_zhan=false`（hzmj_server/server_config.cpp:43-46）；该口径仅说明服务端具备打片结算能力，不承载「局数单选组是否提供 40/50/60片 三档」这一面板职责，故对本条原子不适用。生效条件 configCondition：`play_score>0` 才视为打片房。证据：SVE-AT-ST-C01-012-01（hzmj_server/game_logic.cpp:175-179，play-score-parsed-as-start-chips）、SVE-AT-ST-C01-012-02（hzmj_server/server_config.cpp:43-46，box-defaults-score-limit-play-score-lian-zhuang）。
- **双端协作**：玩家在局数单选组选中片数档 → 客户端随创房提交片数 → 服务端切入按片结算的口径 → 某座位片数用完即结束本房。
- **业务行为**：
  - trigger：玩家查看好友房创房面板的局数单选组
  - condition：处于房间参数设置阶段，局数单选组中应与局数档并列提供 40片 / 50片 / 60片 三个打片档
  - action：客户端在局数单选组中列出打片档供玩家切到打片玩法；服务端另有一套按片数结算的打片口径，仅当创房提交打片档时才启用
  - result：玩家能看到并选择 40片、50片、60片 三档，选中后本房按片数结算
- **实际实现差异**：difference=unverified。baselineDetail：需求要求局数单选组并列提供 40片/50片/60片 三个打片档。客户端未找到该组含打片档的证据；服务端虽存在打片口径，但仅能说明按片结算存在，无法证实创房面板是否提供这三档，符合性无法判定。
- **验证结论（L7）**：not_applicable；l7Basis=proposed（scope=inactive，effectiveDifference=unverified）。待审批建议：unverified（common-capability-is-not-enabled——服务端打片结算口径存在不等于本房创房面板已提供 40片/50片/60片 档），该建议尚未生效。

---

### AT-ST-C01-013 打片档隐藏封顶并置为无

- **需求规则**：选中打片档时隐藏「封顶」，且封顶取值选中「无」。
- **验证范围**：client
- **客户端职责**：verdict=not_found。实现要点：未见打片档下隐藏封顶并把封顶置为「无」（提交 0）的证据。证据：无（evidenceIds 为空）。
- **服务端职责**：applicability=conditional。规则说明：`score_limit` 好友房默认 0=不封顶（hzmj_server/server_config.cpp:43-46），`LoadBoxJsonConfig` 独立解析该键不做与 `play_score` 的联动（hzmj_server/game_logic.cpp:169-173）；服务端按提交值决定是否封顶，打片档下客户端隐藏封顶并提交 0 时服务端不封顶（common_game/com_game/common_game_com_result.cpp:201-213 仅在 `score_limit>0` 时截断），代码中不存在 `play_score>0` 时强制清零封顶的分支。生效条件 configCondition：`score_limit`，默认 0。证据：SVE-AT-ST-C01-013-02（hzmj_server/game_logic.cpp:169-173，score-limit-independent-parse）、SVE-AT-ST-C01-013-01（common_game/com_game/common_game_com_result.cpp:201-213，score-limit-zero-means-no-cap）、SVE-AT-ST-C01-012-02（hzmj_server/server_config.cpp:43-46，box-defaults-score-limit-play-score-lian-zhuang）。
- **双端协作**：玩家切到打片档 → 客户端隐藏封顶并提交 0 → 服务端因封顶为 0 不做截断 → 对局按无封顶结算。
- **业务行为**：
  - trigger：玩家在局数单选组中选中 40片 / 50片 / 60片 打片档
  - condition：当前为打片模式；服务端封顶默认 0（无封顶），按提交值决定是否截断，代码中不会因切到打片而强制清零封顶
  - action：客户端在打片档下隐藏封顶选项并把封顶置为「无」（提交 0）；服务端按提交的封顶值结算，为 0 则不封顶、大于 0 仍会截断
  - result：玩家在打片房看不到封顶设置，对局按无封顶结算
- **实际实现差异**：difference=unverified。baselineDetail：需求要求打片档下隐藏封顶且封顶取「无」。客户端未找到打片档下隐藏封顶的证据；服务端仅能证明封顶为 0 时不截断、无强制清零分支，无法证实面板隐藏行为，符合性无法判定。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=conditional，effectiveDifference=unverified，待审批）。

---

### AT-ST-C01-014 打片档隐藏底分并置为1分

- **需求规则**：选中打片档时隐藏「底分」，且底分取值选中「1分」。
- **验证范围**：client
- **客户端职责**：verdict=not_found。实现要点：未见打片档下隐藏底分并把底分置为「1分」（提交 1）的证据。证据：无（evidenceIds 为空）。
- **服务端职责**：applicability=conditional。规则说明：`base_score` 默认 1（mah_frame/base/base_config.cpp:36），`LoadBoxJsonConfig` 仅接受 >0 覆写、非法值保持 1（hzmj_server/game_logic.cpp:22-34）；打片档下客户端提交 1 时服务端按 1 分底分结算，代码中不存在 `play_score>0` 时强制改底分的分支。生效条件 configCondition：`base_score`，默认 1。证据：SVE-AT-ST-C01-014-01（hzmj_server/game_logic.cpp:22-34，base-score-parse-only-accepts-positive）、SVE-AT-ST-C01-010-02（mah_frame/base/base_config.cpp:36，base-score-default-one）。
- **双端协作**：玩家切到打片档 → 客户端隐藏底分并提交 1 → 服务端按 1 分底分结算 → 对局与结算按 1 分底分执行。
- **业务行为**：
  - trigger：玩家在局数单选组中选中 40片 / 50片 / 60片 打片档
  - condition：当前为打片模式；服务端底分默认 1 分，只接受大于 0 的值，代码中不存在因打片而强制改底分的分支
  - action：客户端在打片档下隐藏底分选项并把底分置为「1分」（提交 1）；服务端按提交的底分值结算，打片房默认按 1 分底分计，非法值回落 1 分
  - result：玩家在打片房看不到底分设置，对局按 1 分底分结算
- **实际实现差异**：difference=unverified。baselineDetail：需求要求打片档下隐藏底分且底分取「1分」。客户端未找到打片档下隐藏底分的证据；服务端仅能证明底分默认 1、按提交值结算且无强制改底分分支，无法证实面板隐藏行为，符合性无法判定。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=conditional，effectiveDifference=unverified，待审批）。

---

### AT-ST-C01-015 打片档显示连庄不占局数

- **需求规则**：选中打片档时显示「连庄不占局数」选项。
- **验证范围**：client
- **客户端职责**：verdict=not_found。实现要点：未见打片档下展示「连庄不占局数」选项的证据。证据：无（evidenceIds 为空）。
- **服务端职责**：applicability=conditional。规则说明：`lian_zhuang_bu_zhan` 好友房默认 false，`play_score` 默认 0 且仅 >0 视为打片房（hzmj_server/server_config.cpp:43-46、hzmj_server/game_logic.cpp:175-183）；`play_score>0` 且本局为胡牌结束时，若庄家连庄胡牌且 `lian_zhuang_bu_zhan=true` 才跳过 `kLogic` 大结算触发，默认 false 不启用该豁免（common_game/com_game/common_game_com_result.cpp:57-76）。生效条件 configCondition：`play_score>0` 且 `lian_zhuang_bu_zhan=true`。证据：SVE-AT-ST-C01-015-02（hzmj_server/game_logic.cpp:180-183，lian-zhuang-bu-zhan-config-parse）、SVE-AT-ST-C01-015-01（common_game/com_game/common_game_com_result.cpp:57-76，play-score-endgame-exempt-on-banker-win）、SVE-AT-ST-C01-012-02（hzmj_server/server_config.cpp:43-46，box-defaults-score-limit-play-score-lian-zhuang）。
- **双端协作**：玩家切到打片档 → 客户端展示并提交「连庄不占局数」开关 → 服务端在打片房按该开关决定连庄胡牌是否占用片数 → 客户端在对局中体现整房是否继续。
- **业务行为**：
  - trigger：玩家在局数单选组中选中 40片 / 50片 / 60片 打片档
  - condition：当前为打片模式；服务端「连庄不占局数」开关默认关闭，只在打片房且显式开启时才生效
  - action：客户端在打片档下展示「连庄不占局数」选项供玩家开关；服务端在打片房且该开关开启时，庄家连庄胡牌且任一座位片数已用尽的情况下跳过整房结束判定，开关关闭时不豁免
  - result：玩家能在打片房看到并设置「连庄不占局数」，开启后连庄胡牌不再直接结束本房
- **实际实现差异**：difference=unverified。baselineDetail：需求要求打片档下显示「连庄不占局数」。客户端未找到该选项的展示证据；服务端确认该开关存在且只在打片房生效、默认关闭，但无法证实面板是否在打片档下展示，符合性无法判定。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=conditional，effectiveDifference=unverified，待审批）。

---

### AT-ST-C01-016 局数与片数互斥只提交一项

- **需求规则**：局数与片数互斥，按所选模式只提交其中一项。
- **验证范围**：both
- **客户端职责**：verdict=not_found。实现要点：本轮 CLE 证据集中未见局数单选组及「局数/片数只提交一项」的提交逻辑证据，客户端实现未取得。证据：无（evidenceIds 为空）。
- **服务端职责**：applicability=unknown。规则说明：服务端仅将 `play_score` 解析为起始片数（hzmj_server/game_logic.cpp:175-179），只能间接说明存在「片数」这一独立计数口径；服务端是否校验二者互斥、以及计数方式的适用性均未取得直接证据，故适用性未定。生效条件 configCondition：`play_score`（打片口径）。证据：SVE-AT-ST-C01-012-01（hzmj_server/game_logic.cpp:175-179，play-score-parsed-as-start-chips）。
- **双端协作**：玩家选定单一档位 → 客户端提交对应计数方式 → 服务端按该方式建桌结算 → 客户端按该方式展示剩余局数或片数。
- **业务行为**：
  - trigger：玩家在局数单选组选定档位并提交创建好友房
  - condition：局数档与打片档同属一个单选组，只能选中其一
  - action：客户端保证局数档与打片档互斥，只提交其中一种计数方式；服务端只按一种计数方式建桌——提交局数则按局数结束，提交片数则按片数结束
  - result：玩家创建的房规里只有局数或片数一种计数方式，不会两者同时存在
- **实际实现差异**：difference=unverified。baselineDetail：需求要求局数与片数互斥、按所选模式只提交一项。客户端未找到局数单选组及提交逻辑的证据；服务端计数方式的适用性未定（仅有间接证据）。两端均不足以判定互斥是否成立。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。

---

### AT-ST-C01-017 吃碰组仅2人房显示

- **需求规则**：吃碰为单选，可选值为「无限吃碰 / 只碰不吃 / 默认吃碰」；本选项组仅 2 人房显示，3/4 人房隐藏。
- **验证范围**：client
- **客户端职责**：verdict=not_found。实现要点：未见创房面板吃碰组在 2 人房显示、3/4 人房隐藏的显隐证据。证据：无（evidenceIds 为空）。
- **服务端职责**：applicability=inactive。规则说明：该条约束面板显隐；服务端按创房提交的吃碰档位执行限制（不限制 / 每方向限 2 次只碰不吃 / 每方向限 2 次可吃碰），不按人数自动切换，亦不参与显隐判定，故不适用。生效条件 configCondition：无。证据：无（evidenceIds 为空）。
- **双端协作**：玩家切换人数 → 客户端按人数显隐吃碰组并确定取值 → 客户端随创房提交吃碰档位 → 服务端按该档位约束吃碰 → 对局中按档位判定能否吃碰。
- **业务行为**：
  - trigger：玩家在创房面板切换人数档或查看房间参数
  - condition：人数为 2人 时出现「吃碰」单选组；人数为 3/4 人时该组不出现
  - action：客户端按人数显隐吃碰组——2 人房展示三档，3/4 人房隐藏；服务端按提交档位执行吃碰限制，不按人数自动切换档位
  - result：2 人房玩家看到并可选三档吃碰；3/4 人房玩家看不到该选项组
- **实际实现差异**：difference=unverified。baselineDetail：需求要求吃碰组仅 2 人房显示。客户端未找到创房面板吃碰组的显隐证据；服务端不参与该显隐（仅按提交档位执行），无法判定符合性。
- **验证结论（L7）**：not_applicable；l7Basis=proposed（scope=inactive，effectiveDifference=unverified）。

---

### AT-ST-C01-018 吃碰默认取值

- **需求规则**：吃碰默认值：2 人房默认「无限吃碰」；3/4 人房固定按「默认吃碰」生效。
- **验证范围**：both
- **客户端职责**：verdict=not_found。实现要点：未见客户端按人数设定吃碰默认值（2 人房初始选中「无限吃碰」、3/4 人房按「默认吃碰」提交）的证据，而该默认值实际由客户端提交决定，属关键断点。证据：无（evidenceIds 为空）。
- **服务端职责**：applicability=conditional。规则说明：`rule_chi_peng` 好友房默认 0=不限制吃碰（即无限吃碰）、`only_pung_no_chow` 默认 false（hzmj_server/server_config.cpp:27-28）；1 为每方向限 2 次且只能碰不能吃，2 为每方向限 2 次可吃碰（即默认吃碰）。服务端不按人数自动切换档位，取值由客户端按人数默认提交；另 `enable_three_tan_bao=false` 时创房下发 `rule_chi_peng` 会被改写为 2（hzmj_server/game_logic.cpp:112-121）。限制判定见 `IsChiPengExceeded`（common_game/common_game_algorithm.cpp:79-84）。生效条件 configCondition：`rule_chi_peng`（默认 0）+ `only_pung_no_chow`（默认 false）+ `enable_three_tan_bao`（false 时回写 rule_chi_peng=2）。证据：SVE-AT-ST-C01-018-03（hzmj_server/server_config.cpp:27-28，box-default-chi-peng-unlimited）、SVE-AT-ST-C01-018-02（hzmj_server/game_logic.cpp:112-121，chi-peng-mode-config-parse）、SVE-AT-ST-C01-018-01（common_game/common_game_algorithm.cpp:79-84，chi-peng-limit-two-per-direction）。
- **双端协作**：玩家选人数 → 客户端按人数确定吃碰默认档并随创房提交 → 服务端按档位约束吃碰行为（必要时回写默认吃碰）→ 对局中玩家感受到能吃碰的次数。
- **业务行为**：
  - trigger：玩家创建好友房并确定人数，进入对局后的吃碰体验
  - condition：2 人房默认「无限吃碰」；3/4 人房固定按「默认吃碰」；服务端默认档为不限制吃碰，取值由客户端按人数提交，另外关闭三摊承包时服务端会把吃碰档改回默认吃碰
  - action：客户端在 2 人房把吃碰默认选中「无限吃碰」，3/4 人房不展示吃碰组但按「默认吃碰」提交；服务端按提交档位约束吃碰方向与次数，关闭三摊承包时回写为默认吃碰
  - result：2 人房玩家看到吃碰默认选中「无限吃碰」、对局中吃碰不受限；3/4 人房每方向吃碰最多 2 次
- **实际实现差异**：difference=unverified。baselineDetail：需求要求 2 人房吃碰默认无限吃碰、3/4 人房固定按默认吃碰。客户端未找到按人数设定吃碰默认值的证据（not_found），而该默认值实际由客户端提交决定；服务端不按人数自动切换、仅在关闭三摊承包时回写默认吃碰。缺客户端证据，符合性无法判定。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=conditional，effectiveDifference=unverified）。待审批建议：unverified（dual-side-collaboration-gap——断点定位：吃碰默认档由客户端提交，服务端在三摊承包关闭分支回写 rule_chi_peng=2，2 人房强制三摊关闭），该建议尚未生效。

---

### AT-ST-C01-019 选无限吃碰的联动

- **需求规则**：吃碰选「无限吃碰」时：隐藏「碰算摊」，承包选中「两摊封顶」。
- **验证范围**：both
- **客户端职责**：verdict=not_found。实现要点：未见客户端在无限吃碰档下隐藏「碰算摊」并把承包置为「两摊封顶」（含同步提交 `pung_as_tan=false`）的联动证据。证据：无（evidenceIds 为空）。
- **服务端职责**：applicability=conditional。规则说明：`enable_three_tan_bao` 好友房默认 false 且 ≤2 人房被强制置 false（即不触发三摊承包，对应两摊封顶口径，hzmj_server/server_config.cpp:20-21、hzmj_server/game_logic.cpp:65-87）；`pung_as_tan` 默认 true，服务端不随吃碰档位改写，无限吃碰档客户端隐藏碰算摊时需同时提交 `pung_as_tan=false` 才停止碰记摊（common_game/com_game/common_game_com_pung.cpp:125-138）；闲闲之间摊数上限判于 `IsXianXianTanFull`（common_game/common_game_algorithm.cpp:86-93）；`rule_chi_peng` 默认 0 不限。生效条件 configCondition：`enable_three_tan_bao=false`（≤2 人强制）+ `pung_as_tan`（需客户端显式关闭）+ `rule_chi_peng=0`。证据：SVE-AT-ST-C01-019-04（hzmj_server/server_config.cpp:20-21，box-default-three-tan-off-pung-as-tan-on）、SVE-AT-ST-C01-019-03（hzmj_server/game_logic.cpp:65-87，three-tan-forced-off-for-two-players）、SVE-AT-ST-C01-019-02（common_game/common_game_algorithm.cpp:86-93，xian-xian-tan-capped-at-two）、SVE-AT-ST-C01-019-01（common_game/com_game/common_game_com_pung.cpp:125-138，pung-counts-one-tan-when-pung-as-tan）。
- **双端协作**：玩家选中无限吃碰 → 客户端隐藏碰算摊、把承包置为两摊封顶并提交关闭碰算摊 → 服务端按提交停止碰记摊、不按三摊触发承包 → 结算按两摊封顶口径进行。
- **业务行为**：
  - trigger：玩家在 2 人房创房面板的吃碰单选组中选中「无限吃碰」
  - condition：吃碰组可见且选中无限吃碰；服务端吃碰档默认为不限制，碰算摊默认开启、不随吃碰档位自动关闭，三摊承包在 2 人房被强制关闭（即两摊封顶口径）
  - action：客户端在无限吃碰档下隐藏「碰算摊」并把承包置为「两摊封顶」，若此前碰算摊开启需随创房一并提交关闭；服务端按提交值决定碰是否记摊与是否按三摊触发承包，2 人房不触发三摊承包
  - result：玩家看不到碰算摊选项，承包显示为两摊封顶，对局中碰不会另外算摊
- **实际实现差异**：difference=unverified。baselineDetail：需求要求无限吃碰档下隐藏碰算摊、承包取两摊封顶。客户端未找到该联动显隐的证据（not_found）；服务端碰算摊默认开启且不随档位改写、2 人房强制关闭三摊承包，只能说明服务端具备对应口径，无法证实面板联动，符合性无法判定。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=conditional，effectiveDifference=unverified，待审批）。

---

### AT-ST-C01-020 选只碰不吃或默认吃碰的联动

- **需求规则**：吃碰选「只碰不吃」或「默认吃碰」时：显示「碰算摊」，承包选中「两摊封顶」。
- **验证范围**：both
- **客户端职责**：verdict=not_found。实现要点：未见客户端在这两档下显示「碰算摊」并把承包置为「两摊封顶」的联动证据。证据：无（evidenceIds 为空）。
- **服务端职责**：applicability=conditional。规则说明：`only_pung_no_chow` 默认 false，true 时禁吃并下发 `kNIFExOnlyPungNoChow`（hzmj_server/game_logic.cpp:112-121、common_game/com_game/common_game_com_action.cpp:74-80）；`rule_chi_peng` 默认 0，1/2 为每方向限 2 次（common_game/common_game_algorithm.cpp:79-84）；`pung_as_tan` 默认 true，碰仍记摊（common_game/com_game/common_game_com_pung.cpp:125-138）；`enable_three_tan_bao` ≤2 人强制 false、不按三摊触发承包（hzmj_server/game_logic.cpp:65-87）。生效条件 configCondition：`only_pung_no_chow` + `rule_chi_peng` + `pung_as_tan=true` + `enable_three_tan_bao=false`（≤2 人）。证据：SVE-AT-ST-C01-020-01（common_game/com_game/common_game_com_action.cpp:74-80，only-pung-no-chow-blocks-chow）、SVE-AT-ST-C01-018-02（hzmj_server/game_logic.cpp:112-121，chi-peng-mode-config-parse）、SVE-AT-ST-C01-018-03（hzmj_server/server_config.cpp:27-28，box-default-chi-peng-unlimited）、SVE-AT-ST-C01-019-01（common_game/com_game/common_game_com_pung.cpp:125-138，pung-counts-one-tan-when-pung-as-tan）、SVE-AT-ST-C01-019-03（hzmj_server/game_logic.cpp:65-87，three-tan-forced-off-for-two-players）、SVE-AT-ST-C01-019-04（hzmj_server/server_config.cpp:20-21，box-default-three-tan-off-pung-as-tan-on）。
- **双端协作**：玩家选中只碰不吃或默认吃碰 → 客户端展示碰算摊、承包置两摊封顶并提交档位 → 服务端按档位禁吃或限制次数、碰照常记摊 → 结算按两摊封顶执行。
- **业务行为**：
  - trigger：玩家在 2 人房创房面板的吃碰单选组中选中「只碰不吃」或「默认吃碰」
  - condition：吃碰组可见且选中这两档之一；服务端碰算摊默认开启、三摊承包在 2 人房被强制关闭（两摊封顶口径），只碰不吃档会禁吃
  - action：客户端在这两档下展示「碰算摊」并把承包置为「两摊封顶」，只碰不吃档下对局中不允许吃牌；服务端按提交档位约束吃碰——只碰不吃时禁止吃牌并下发对应限制、碰仍记摊，2 人房不按三摊触发承包
  - result：玩家在面板上可设置碰算摊、承包显示为两摊封顶；对局中按所选档位只能碰不能吃或按默认吃碰
- **实际实现差异**：difference=unverified。baselineDetail：需求要求这两档下显示碰算摊、承包取两摊封顶。客户端未找到该联动显隐的证据（not_found）；服务端只碰不吃禁吃、碰记摊、2 人房两摊封顶口径均能找到实现，但无法证实面板联动，符合性无法判定。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=conditional，effectiveDifference=unverified，待审批）。

---

### AT-ST-C01-021 承包可选值与默认

- **需求规则**：承包为单选，可选值为「三摊承包 / 两摊封顶」，3/4 人房默认选中「三摊承包」。
- **验证范围**：client
- **客户端职责**：verdict=not_found。实现要点：未见 3/4 人房创房面板「承包」单选组（两档、初始选中「三摊承包」并据此提交）的证据。证据：无（evidenceIds 为空）。
- **服务端职责**：applicability=conditional。规则说明：`enable_three_tan_bao` 在 `InitConfigByBox` 中默认 false（对应两摊封顶，hzmj_server/server_config.cpp:20-21）；=true 时庄闲累计满 3 摊触发承包/倒承包，且闲闲之间另限 2 摊（common_game/com_game/common_game_com_action.cpp:141-148、common_game/common_game_algorithm.cpp:86-93），承包结算受该开关门控（common_game/com_game/common_game_com_result.cpp:289-295）；≤2 人服务端强制 false。生效条件 configCondition：要得到需求默认「三摊承包」，必须由客户端显式提交 `enable_three_tan_bao=true`；服务端默认值本身为 false。证据：SVE-AT-ST-C01-021-01（common_game/com_game/common_game_com_action.cpp:141-148，three-tan-triggers-contract-at-three）、SVE-AT-ST-C01-021-02（common_game/com_game/common_game_com_result.cpp:289-295，contract-settle-guarded-by-three-tan-flag）、SVE-AT-ST-C01-019-04（hzmj_server/server_config.cpp:20-21，box-default-three-tan-off-pung-as-tan-on）、SVE-AT-ST-C01-019-03（hzmj_server/game_logic.cpp:65-87，three-tan-forced-off-for-two-players）。
- **双端协作**：玩家查看承包档位 → 客户端默认选中三摊承包并随创房提交 → 服务端按开关决定是否按三摊触发承包 → 结算时体现承包或封顶。
- **业务行为**：
  - trigger：玩家在 3/4 人房查看创房面板的房间参数
  - condition：人数为 3 人或 4 人；服务端三摊承包开关好友房默认为关闭（等同两摊封顶），要得到需求默认「三摊承包」须由客户端显式提交开启
  - action：客户端展示承包单选组、提供两档、初始选中「三摊承包」并据此提交；服务端开启三摊承包时庄闲累计满 3 摊触发承包/倒承包、闲闲之间另限 2 摊，关闭时按两摊封顶口径不触发三摊承包
  - result：3/4 人房玩家看到承包两档，默认停在「三摊承包」，对局按该档位执行
- **实际实现差异**：difference=unverified。baselineDetail：需求要求 3/4 人房承包单选、默认三摊承包。客户端未找到承包单选组及默认项的证据（not_found）；服务端默认关闭三摊承包（等同两摊封顶），需客户端显式提交才符合需求默认。缺客户端证据，符合性无法判定。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=conditional，effectiveDifference=unverified）。待审批建议：unverified（no-server-evidence-is-not-conflict——服务端默认关闭三摊承包不是冲突证据：默认档由创房显式下发，服务端无面板默认项取证义务），该建议尚未生效。

---

### AT-ST-C01-022 承包组仅3人4人房显示

- **需求规则**：承包选项组仅 3/4 人房显示。
- **验证范围**：client
- **客户端职责**：verdict=not_found。实现要点：未见创房面板承包组按人数显隐（3/4 人展示、2 人隐藏）的证据。证据：无（evidenceIds 为空）。
- **服务端职责**：applicability=active。规则说明：服务端对 2 人房强制关闭三摊承包（`enable_three_tan_bao && player_count <= 2` 时置 false，hzmj_server/game_logic.cpp:65-87），并在 `FillMsgGameConfig` 中把该开关下发给客户端（common_game/common_game_context.cpp:438-443），为面板显隐提供了服务端状态依据。生效条件 configCondition：无（人数门控）。证据：SVE-AT-ST-C01-019-03（hzmj_server/game_logic.cpp:65-87，three-tan-forced-off-for-two-players）、SVE-AT-ST-C01-022-01（common_game/common_game_context.cpp:438-443，server-pushes-three-tan-flag-to-client）。
- **双端协作**：玩家切换人数 → 客户端按人数显隐承包组 → 客户端随创房提交承包档位 → 服务端按人数与档位决定承包/封顶口径。
- **业务行为**：
  - trigger：玩家在创房面板切换人数档或查看房间参数
  - condition：人数为 3 人或 4 人时出现承包单选组；人数为 2 人时不出现
  - action：客户端按人数显隐承包组——3/4 人房展示、2 人房隐藏；服务端对 2 人房强制关闭三摊承包，3/4 人房按提交值决定承包口径
  - result：3/4 人房玩家看到承包选项，2 人房玩家看不到
- **实际实现差异**：difference=unverified。baselineDetail：需求要求承包组仅 3/4 人房显示。客户端未找到承包组显隐的证据（not_found）；服务端只体现 2 人房强制关闭三摊承包，不参与面板显隐。缺客户端证据，符合性无法判定。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=active，effectiveDifference=unverified，待审批）。

---

### AT-ST-C01-023 2人房承包联动为两摊封顶

- **需求规则**：2 人房的承包随吃碰默认联动为「两摊封顶」。
- **验证范围**：both
- **客户端职责**：verdict=not_found。实现要点：未见 2 人房隐藏承包组并按吃碰默认联动提交两摊封顶口径的证据。证据：无（evidenceIds 为空）。
- **服务端职责**：applicability=active。规则说明：2 人房由 `LoadBoxJsonConfig` 强制 `enable_three_tan_bao=false`（hzmj_server/game_logic.cpp:65-87），承包结算在 `ApplyBaoContracts` 首行即按该开关提前返回，故 2 人房不产生三摊承包、口径为两摊封顶（common_game/com_game/common_game_com_result.cpp:289-295）；闲闲摊数上限判于 `IsXianXianTanFull`（common_game/common_game_algorithm.cpp:86-93）。生效条件 configCondition：无（2 人房强制关闭三摊承包）。证据：SVE-AT-ST-C01-019-03（hzmj_server/game_logic.cpp:65-87，three-tan-forced-off-for-two-players）、SVE-AT-ST-C01-021-02（common_game/com_game/common_game_com_result.cpp:289-295，contract-settle-guarded-by-three-tan-flag）、SVE-AT-ST-C01-019-02（common_game/common_game_algorithm.cpp:86-93，xian-xian-tan-capped-at-two）。
- **双端协作**：玩家建 2 人房 → 客户端隐藏承包组并按吃碰默认提交承包取值 → 服务端强制关闭三摊承包 → 结算按两摊封顶执行。
- **业务行为**：
  - trigger：玩家创建 2 人房并进入对局结算
  - condition：人数为 2 人；服务端对 2 人房强制关闭三摊承包，碰算摊默认开启
  - action：客户端在 2 人房隐藏承包组，按吃碰默认联动提交两摊封顶口径；服务端强制不触发三摊承包，承包按两摊封顶口径结算，碰仍按配置记摊
  - result：2 人房玩家看不到承包选项，对局与结算按两摊封顶进行
- **实际实现差异**：difference=unverified。baselineDetail：需求要求 2 人房隐藏承包组但按两摊封顶生效。客户端未找到隐藏承包与按吃碰联动取值的证据（not_found）；服务端 2 人房强制关闭三摊承包（即两摊封顶）已找到证据。缺客户端证据，符合性无法判定。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=active，effectiveDifference=unverified，待审批）。

---

### AT-ST-C01-024 2人房局数吃碰承包联动

- **需求规则**：选中 2人：显示 32局、隐藏 4局；吃碰组显示并选中「无限吃碰」；承包组隐藏。
- **验证范围**：both
- **客户端职责**：verdict=not_found。实现要点：未见人数切到 2人 后刷新局数档（放出 32局、收起 4局）、显示吃碰组并默认无限吃碰、隐藏承包组的联动证据。证据：无（evidenceIds 为空）。
- **服务端职责**：applicability=conditional。规则说明：创房配置装载链为 `InitConfigByBox(player_count)` + `LoadBoxJsonConfig`（common_game/common_game_logic.cpp:65-73）；2 人局由 `LoadBoxJsonConfig` 强制关闭 `enable_three_tan_bao`；关键分支：若创房 JSON 下发该键且值=0，服务端置 `rule_chi_peng=2`（每方向合计限 2 次），与需求「无限吃碰」相反；只有不下发该键时 `rule_chi_peng` 保持 `InitConfigByBox` 默认 0=不限制（hzmj_server/game_logic.cpp:66-83、hzmj_server/server_config.cpp:19-39）。吃碰判定调用点见 `BoxChowStep::Judge` / `BoxPungStep::Judge`（common_game/com_game/common_game_com_action.cpp:62-66、common_game/com_game/common_game_com_pung.cpp:17-41），上限判于 `IsChiPengExceeded`（common_game/common_game_algorithm.cpp:79-84），三摊门控于 `IsXianXianTanFull`（:86-93）；服务端总分配置不含总局数上限（common_game/com_game/common_game_logic.cpp:153-194）。生效条件 configCondition：2 人房是否「无限吃碰」取决于客户端是否下发 `enable_three_tan_bao`。证据：SVE-AT-ST-C01-024-08（hzmj_server/game_logic.cpp:66-83，three-tan-bao-player-count-guard）、SVE-AT-ST-C01-024-03（common_game/common_game_algorithm.cpp:79-84，rule-chi-peng-limit-two）、SVE-AT-ST-C01-024-04（common_game/common_game_algorithm.cpp:86-93，three-tan-bao-limit-check）、SVE-AT-ST-C01-024-01（common_game/com_game/common_game_com_action.cpp:62-66，chow-judge-chi-peng-limit-call-site）、SVE-AT-ST-C01-024-02（common_game/com_game/common_game_com_pung.cpp:17-41，pung-judge-chi-peng-and-guard-call-site）、SVE-AT-ST-C01-024-05（common_game/common_game_logic.cpp:153-194，no-total-round-limit-in-total-score）、SVE-AT-ST-C01-024-06（common_game/common_game_logic.cpp:65-73，box-config-load-call-chain）、SVE-AT-ST-C01-024-07（common_game/common_game_server_config.h:41，three-tan-bao-only-3-4-players）、SVE-AT-ST-C01-024-09（hzmj_server/server_config.cpp:19-39，box-default-config-values）。
- **双端协作**：玩家选择 2人 → 客户端刷新局数/吃碰/承包三处并随创房提交 → 服务端按 2 人建桌、关闭三摊承包并确定吃碰档 → 客户端按刷新后的房规展示。
- **业务行为**：
  - trigger：玩家在创房面板的人数单选中把人数切换为 2人
  - condition：人数档切换为 2 人；服务端对 2 人房强制关闭三摊承包，吃碰档是否不限制取决客户端是否提交三摊承包键（提交为关闭时会被改成每方向限 2 次）
  - action：客户端切到 2 人后刷新三处——局数档放出 32局、收起 4局，吃碰组出现并默认选中「无限吃碰」，承包组隐藏；服务端按 2 人建桌并强制关闭三摊承包，吃碰档按提交值执行
  - result：2 人房玩家看到 32局可选、4局不可见，吃碰组出现且默认无限吃碰，承包组消失
- **实际实现差异**：difference=unverified。baselineDetail：需求要求切到 2 人后 32局可选、4局隐藏、吃碰组出现并默认无限吃碰、承包组隐藏。客户端未找到人数联动刷新证据（not_found）；服务端能证明 2 人房强制关闭三摊承包，且吃碰是否真正「无限」取决于客户端是否提交三摊承包键（提交关闭会变成每方向限 2 次）。缺客户端证据，符合性无法判定。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=conditional，effectiveDifference=unverified）。待审批建议：unverified（dual-side-collaboration-gap——断点定位：人数联动刷新在客户端，服务端 2 人房强制三摊关闭并可能回写吃碰档，取决于客户端提交的三摊键与 rule 值），该建议尚未生效。

---

### AT-ST-C01-025 2人房缺一色与守庄联动

- **需求规则**：选中 2人：「缺一色」显示、「守庄」隐藏。
- **验证范围**：client
- **客户端职责**：verdict=not_found。实现要点：未见人数切到 2人 后显示「缺一色」、隐藏「守庄」的面板显隐证据。证据：无（evidenceIds 为空）。
- **服务端职责**：applicability=active。规则说明：缺一色门控为 `enable_two_suit && player_count <= 3`，开启后剔除万字花色（common_game/common_game_init.cpp:57-58），配置注释明确「仅 2/3 人」（common_game/common_game_server_config.h:55），JSON 解析不做人数校验（hzmj_server/game_logic.cpp:122-125）；守庄配置注释为「仅 3/4 人局，2 人局服务端安全判断强制关闭」（common_game/common_game_server_config.h:65-66），2 人房强制关闭（hzmj_server/game_logic.cpp:149-161）；服务端默认两项均 false（hzmj_server/server_config.cpp:19-39）。生效条件 configCondition：无（人数门控 + 安全判断）。证据：SVE-AT-ST-C01-025-05（hzmj_server/game_logic.cpp:149-161，guard-dealer-player-count-guard）、SVE-AT-ST-C01-025-01（common_game/common_game_init.cpp:57-58，two-suit-init-player-count-guard）、SVE-AT-ST-C01-025-04（hzmj_server/game_logic.cpp:122-125，two-suit-json-no-player-count-check）、SVE-AT-ST-C01-025-02（common_game/common_game_server_config.h:55，two-suit-only-2-3-players）、SVE-AT-ST-C01-025-03（common_game/common_game_server_config.h:65-66，guard-dealer-only-3-4-players）、SVE-AT-ST-C01-024-09（hzmj_server/server_config.cpp:19-39，box-default-config-values）、SVE-AT-ST-C01-024-06（common_game/common_game_logic.cpp:65-73，box-config-load-call-chain）、SVE-AT-ST-C01-024-02（common_game/com_game/common_game_com_pung.cpp:17-41，pung-judge-chi-peng-and-guard-call-site）。
- **双端协作**：玩家选择 2人 → 客户端刷新缺一色与守庄显隐并随创房提交 → 服务端按 2 人房口径处理缺一色与守庄 → 对局中按该口径判定。
- **业务行为**：
  - trigger：玩家在创房面板的人数单选中把人数切换为 2人
  - condition：人数为 2 人时「缺一色」选项出现、「守庄」选项不出现
  - action：客户端切到 2 人后显示缺一色、隐藏守庄；服务端按 2 人房适用的房规与开关执行缺一色与守庄相关判定（2 人房按不启用守庄的口径）
  - result：2 人房玩家能看到缺一色选项，看不到守庄选项
- **实际实现差异**：difference=unverified。baselineDetail：需求要求 2 人房显示缺一色、隐藏守庄。客户端未找到该显隐证据（not_found）；服务端虽能找到 2 人房对应口径实现，但面板显隐属客户端职责，缺客户端证据，符合性无法判定。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=active，effectiveDifference=unverified，待审批）。

---

### AT-ST-C01-026 3人房局数吃碰承包联动

- **需求规则**：选中 3人：显示 32局、隐藏 4局；吃碰组隐藏、按「默认吃碰」生效；承包组显示。
- **验证范围**：both
- **客户端职责**：verdict=not_found。实现要点：未见人数切到 3人 后刷新局数档、隐藏吃碰组并按「默认吃碰」取值、显示承包组的联动证据。证据：无（evidenceIds 为空）。
- **服务端职责**：applicability=conditional。规则说明：`enable_three_tan_bao` 默认 false、3 人局可开；下发该键且值=0 时服务端置 `rule_chi_peng=2`，吃碰合计限 2 次（即「按默认吃碰生效」）；下发该键且值=1 时三摊承包接管（`IsXianXianTanFull` 拦截闲闲第 3 摊），`RuleChiPeng` 不被改写，此时不再等同默认吃碰；不下发该键则 `rule_chi_peng` 保持 0=不限制（hzmj_server/game_logic.cpp:66-83、:112-121）。吃碰判定调用点与上限判于 `BoxChowStep::Judge` / `BoxPungStep::Judge` / `IsChiPengExceeded`（common_game/com_game/common_game_com_action.cpp:62-66、common_game/com_game/common_game_com_pung.cpp:17-41、common_game/common_game_algorithm.cpp:79-84）。生效条件 configCondition：`enable_three_tan_bao` 的取值与是否下发。证据：SVE-AT-ST-C01-024-08（hzmj_server/game_logic.cpp:66-83，three-tan-bao-player-count-guard）、SVE-AT-ST-C01-024-03（common_game/common_game_algorithm.cpp:79-84，rule-chi-peng-limit-two）、SVE-AT-ST-C01-024-04（common_game/common_game_algorithm.cpp:86-93，three-tan-bao-limit-check）、SVE-AT-ST-C01-024-01（common_game/com_game/common_game_com_action.cpp:62-66，chow-judge-chi-peng-limit-call-site）、SVE-AT-ST-C01-024-02（common_game/com_game/common_game_com_pung.cpp:17-41，pung-judge-chi-peng-and-guard-call-site）、SVE-AT-ST-C01-024-05（common_game/common_game_logic.cpp:153-194，no-total-round-limit-in-total-score）、SVE-AT-ST-C01-024-06（common_game/common_game_logic.cpp:65-73，box-config-load-call-chain）、SVE-AT-ST-C01-024-07（common_game/common_game_server_config.h:41，three-tan-bao-only-3-4-players）、SVE-AT-ST-C01-024-09（hzmj_server/server_config.cpp:19-39，box-default-config-values）。
- **双端协作**：玩家选择 3人 → 客户端刷新局数/吃碰/承包三处并提交对应取值 → 服务端按 3 人建桌并确定吃碰与承包口径 → 客户端按刷新后的房规展示。
- **业务行为**：
  - trigger：玩家在创房面板的人数单选中把人数切换为 3人
  - condition：人数档切换为 3 人；3 人房可开启三摊承包，服务端吃碰档按提交值与三摊承包开关确定
  - action：客户端切到 3 人后刷新三处——局数档放出 32局、收起 4局，吃碰组隐藏但按「默认吃碰」取值，承包组出现；服务端按 3 人建桌，吃碰档按提交值执行（三摊承包关时回写为每方向限 2 次，三摊承包开时由三摊规则接管），3 人房按提交值启用三摊承包
  - result：3 人房玩家看到 32局可选、4局不可见，看不到吃碰组但吃碰按默认档生效，承包组出现
- **实际实现差异**：difference=unverified。baselineDetail：需求要求切到 3 人后 32局可选、4局隐藏、吃碰组隐藏但按默认吃碰生效、承包组出现。客户端未找到人数联动刷新证据（not_found）；服务端 3 人房的吃碰档取决于提交值（承包关则限 2 次，承包开则由三摊接管，此时不等同默认吃碰）。缺客户端证据，符合性无法判定。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=conditional，effectiveDifference=unverified，待审批）。

---

### AT-ST-C01-027 3人房缺一色与守庄联动

- **需求规则**：选中 3人：「缺一色」「守庄」均显示。
- **验证范围**：client
- **客户端职责**：verdict=not_found。实现要点：未见人数切到 3人 后同时显示「缺一色」与「守庄」的面板显隐证据。证据：无（evidenceIds 为空）。
- **服务端职责**：applicability=active。规则说明：缺一色在 2/3 人可开（`enable_two_suit && player_count <= 3`，common_game/common_game_init.cpp:57-58；注释「仅2/3人」common_game/common_game_server_config.h:55）；守庄仅 3/4 人局可启用（common_game/common_game_server_config.h:65-66），且人数判定在 `IsGuardDealerBlocked` 中体现——3 人仅禁碰庄家打出的牌，4 人及以上禁庄家与庄下家（common_game/common_game_algorithm.cpp:62-67）；两项默认 false（hzmj_server/server_config.cpp:19-39）。生效条件 configCondition：无（人数门控）。证据：SVE-AT-ST-C01-027-01（common_game/common_game_algorithm.cpp:62-67，guard-dealer-3-vs-4-player-scope）、SVE-AT-ST-C01-025-01（common_game/common_game_init.cpp:57-58，two-suit-init-player-count-guard）、SVE-AT-ST-C01-025-04（hzmj_server/game_logic.cpp:122-125，two-suit-json-no-player-count-check）、SVE-AT-ST-C01-025-02（common_game/common_game_server_config.h:55，two-suit-only-2-3-players）、SVE-AT-ST-C01-025-03（common_game/common_game_server_config.h:65-66，guard-dealer-only-3-4-players）、SVE-AT-ST-C01-025-05（hzmj_server/game_logic.cpp:149-161，guard-dealer-player-count-guard）、SVE-AT-ST-C01-024-09（hzmj_server/server_config.cpp:19-39，box-default-config-values）、SVE-AT-ST-C01-024-06（common_game/common_game_logic.cpp:65-73，box-config-load-call-chain）、SVE-AT-ST-C01-024-02（common_game/com_game/common_game_com_pung.cpp:17-41，pung-judge-chi-peng-and-guard-call-site）。
- **双端协作**：玩家选择 3人 → 客户端刷新缺一色与守庄显隐并随创房提交 → 服务端按 3 人房口径处理两项开关 → 对局中按该口径判定。
- **业务行为**：
  - trigger：玩家在创房面板的人数单选中把人数切换为 3人
  - condition：人数为 3 人时「缺一色」与「守庄」两个选项都应出现
  - action：客户端切到 3 人后同时显示缺一色与守庄；服务端按 3 人房适用的房规执行缺一色与守庄相关判定（守庄在 3 人房可启用）
  - result：3 人房玩家能同时看到缺一色与守庄两个选项
- **实际实现差异**：difference=unverified。baselineDetail：需求要求 3 人房同时显示缺一色与守庄。客户端未找到该显隐证据（not_found）；服务端能找到 3 人房对应开关实现，但面板显隐属客户端职责，缺客户端证据，符合性无法判定。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=active，effectiveDifference=unverified，待审批）。

---

### AT-ST-C01-028 4人房局数吃碰承包联动

- **需求规则**：选中 4人：显示 4局、隐藏 32局；吃碰组隐藏、按「默认吃碰」生效；承包组显示。
- **验证范围**：both
- **客户端职责**：verdict=not_found。实现要点：未见人数切到 4人 后刷新局数档（放出 4局、收起 32局）、隐藏吃碰组并按「默认吃碰」取值、显示承包组的联动证据。证据：无（evidenceIds 为空）。
- **服务端职责**：applicability=conditional。规则说明：与 3 人房同构——`enable_three_tan_bao` 默认 false、4 人局可开；下发该键且值=0 时置 `rule_chi_peng=2`（吃碰合计限 2 次，即「按默认吃碰生效」）；下发该键且值=1 时三摊承包接管（`IsXianXianTanFull` 拦截闲闲第 3 摊）、`RuleChiPeng` 不被改写，此时不等同默认吃碰；不下发该键则 `rule_chi_peng` 保持 0（hzmj_server/game_logic.cpp:66-83、:112-121）。生效条件 configCondition：`enable_three_tan_bao` 的取值与是否下发。证据：SVE-AT-ST-C01-024-08（hzmj_server/game_logic.cpp:66-83，three-tan-bao-player-count-guard）、SVE-AT-ST-C01-024-03（common_game/common_game_algorithm.cpp:79-84，rule-chi-peng-limit-two）、SVE-AT-ST-C01-024-04（common_game/common_game_algorithm.cpp:86-93，three-tan-bao-limit-check）、SVE-AT-ST-C01-024-01（common_game/com_game/common_game_com_action.cpp:62-66，chow-judge-chi-peng-limit-call-site）、SVE-AT-ST-C01-024-02（common_game/com_game/common_game_com_pung.cpp:17-41，pung-judge-chi-peng-and-guard-call-site）、SVE-AT-ST-C01-024-05（common_game/common_game_logic.cpp:153-194，no-total-round-limit-in-total-score）、SVE-AT-ST-C01-024-06（common_game/common_game_logic.cpp:65-73，box-config-load-call-chain）、SVE-AT-ST-C01-024-07（common_game/common_game_server_config.h:41，three-tan-bao-only-3-4-players）、SVE-AT-ST-C01-024-09（hzmj_server/server_config.cpp:19-39，box-default-config-values）。
- **双端协作**：玩家选择 4人 → 客户端刷新局数/吃碰/承包三处并提交对应取值 → 服务端按 4 人建桌并确定吃碰与承包口径 → 客户端按刷新后的房规展示。
- **业务行为**：
  - trigger：玩家在创房面板的人数单选中把人数切换为 4人
  - condition：人数档切换为 4 人；4 人房可开启三摊承包，服务端吃碰档按提交值与三摊承包开关确定
  - action：客户端切到 4 人后刷新三处——局数档放出 4局、收起 32局，吃碰组隐藏但按「默认吃碰」取值，承包组出现；服务端按 4 人建桌，吃碰档按提交值执行（三摊承包关时回写为每方向限 2 次，三摊承包开时由三摊规则接管），4 人房按提交值启用三摊承包
  - result：4 人房玩家看到 4局可选、32局不可见，看不到吃碰组但吃碰按默认档生效，承包组出现
- **实际实现差异**：difference=unverified。baselineDetail：需求要求切到 4 人后 4局可选、32局隐藏、吃碰组隐藏但按默认吃碰生效、承包组出现。客户端未找到人数联动刷新证据（not_found）；服务端 4 人房吃碰档同样取决于提交值，缺客户端证据，符合性无法判定。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=conditional，effectiveDifference=unverified，待审批）。

---

### AT-ST-C01-029 4人房缺一色与守庄联动

- **需求规则**：选中 4人：「缺一色」隐藏、「守庄」显示。
- **验证范围**：client
- **客户端职责**：verdict=not_found。实现要点：未见人数切到 4人 后隐藏「缺一色」、显示「守庄」的面板显隐证据。证据：无（evidenceIds 为空）。
- **服务端职责**：applicability=active。规则说明：缺一色仅 2/3 人可开（`player_count <= 3`，common_game/common_game_init.cpp:57-58），4 人房不满足门控即不剔除万字；守庄仅 3/4 人局可启用，4 人房禁庄家与庄下家（common_game/common_game_algorithm.cpp:62-67、common_game/common_game_server_config.h:65-66、hzmj_server/game_logic.cpp:149-161）；两项默认 false（hzmj_server/server_config.cpp:19-39）。生效条件 configCondition：无（人数门控）。证据：SVE-AT-ST-C01-027-01（common_game/common_game_algorithm.cpp:62-67，guard-dealer-3-vs-4-player-scope）、SVE-AT-ST-C01-025-01（common_game/common_game_init.cpp:57-58，two-suit-init-player-count-guard）、SVE-AT-ST-C01-025-04（hzmj_server/game_logic.cpp:122-125，two-suit-json-no-player-count-check）、SVE-AT-ST-C01-025-02（common_game/common_game_server_config.h:55，two-suit-only-2-3-players）、SVE-AT-ST-C01-025-03（common_game/common_game_server_config.h:65-66，guard-dealer-only-3-4-players）、SVE-AT-ST-C01-025-05（hzmj_server/game_logic.cpp:149-161，guard-dealer-player-count-guard）、SVE-AT-ST-C01-024-09（hzmj_server/server_config.cpp:19-39，box-default-config-values）、SVE-AT-ST-C01-024-06（common_game/common_game_logic.cpp:65-73，box-config-load-call-chain）、SVE-AT-ST-C01-024-02（common_game/com_game/common_game_com_pung.cpp:17-41，pung-judge-chi-peng-and-guard-call-site）。
- **双端协作**：玩家选择 4人 → 客户端刷新缺一色与守庄显隐并随创房提交 → 服务端按 4 人房口径处理两项开关 → 对局中按该口径判定。
- **业务行为**：
  - trigger：玩家在创房面板的人数单选中把人数切换为 4人
  - condition：人数为 4 人时「缺一色」不出现、「守庄」出现
  - action：客户端切到 4 人后隐藏缺一色、显示守庄；服务端按 4 人房适用的房规执行缺一色与守庄相关判定（4 人房按不启用缺一色的口径、守庄可启用）
  - result：4 人房玩家看不到缺一色选项，能看到守庄选项
- **实际实现差异**：difference=unverified。baselineDetail：需求要求 4 人房隐藏缺一色、显示守庄。客户端未找到该显隐证据（not_found）；服务端能找到 4 人房对应开关实现，但面板显隐属客户端职责，缺客户端证据，符合性无法判定。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=active，effectiveDifference=unverified，待审批）。

## 证据索引

### 客户端证据（CLE，12 条）

| 证据 ID | layer | file:line | claimKey |
|---|---|---|---|
| CLE-AT-ST-C01-001-02 | client_code | data/GameData.ts:1443-1445 | simple-mode-config-consumed |
| CLE-AT-ST-C01-002-02 | client_code | config/GameDefine.ts:4-7 | er-ren-room-gameid |
| CLE-AT-ST-C01-002-03 | client_code | config/GameDefine.ts:271-279 | seat-count-map-2-3 |
| CLE-AT-ST-C01-002-04 | client_code | layer/BoxHzmjBackView.ts:82 | er-ren-room-label |
| CLE-AT-ST-C01-003-02 | client_code | data/GameData.ts:50 | cai-shen-type-values |
| CLE-AT-ST-C01-003-03 | client_code | controller/cmd/gameCmd/GameJokerCmd.ts:74-77 | cai-shen-type-room-rule |
| CLE-AT-ST-C01-004-03 | client_code | controller/cmd/gameCmd/GameJuDataCmd.ts:34-35 | lian-zhuang-level-from-room-config |
| CLE-AT-ST-C01-004-04 | client_code | data/GameData.ts:1664-1666 | banker-level-multiplier |
| CLE-AT-ST-C01-005-02 | client_code | config/FanDefine.ts:637-638 | hu-result-label-dianpao |
| CLE-AT-ST-C01-005-03 | client_code | layer/comp/BoxHzmjResultMid.ts:719-737 | result-hu-type-tab |
| CLE-AT-ST-C01-009-01 | client_code | layer/BoxHzmjBackView.ts:86-88 | base-score-display-in-table |
| CLE-AT-ST-C01-009-03 | client_code | layer/BoxHzmjTingPaiView.ts:95-99 | feng-ding-status-text |

### 服务端证据（SVE，60 条）

| 证据 ID | layer | file:line | claimKey |
|---|---|---|---|
| SVE-AT-ST-C01-001-01 | common_game | common_game/common_game_context.cpp:29-36 | simple-mode-suppress-notice |
| SVE-AT-ST-C01-001-02 | common_game | common_game/common_game_context.cpp:438-442 | simple-mode-broadcast |
| SVE-AT-ST-C01-001-03 | hzmj_server | hzmj_server/game_logic.cpp:163-167 | simple-mode-json-key |
| SVE-AT-ST-C01-001-04 | hzmj_server | hzmj_server/server_config.cpp:41 | simple-mode-default-off |
| SVE-AT-ST-C01-002-01 | common_game | common_game/common_game_init.cpp:57-58 | player-count-gates-two-suit |
| SVE-AT-ST-C01-002-02 | common_game | common_game/common_game_logic.cpp:474-478 | player-count-from-chair-count |
| SVE-AT-ST-C01-002-03 | hzmj_server | hzmj_server/game_logic.cpp:149-161 | player-count-gates-guard-dealer |
| SVE-AT-ST-C01-003-01 | common_game | common_game/com_game/common_game_com_ju.cpp:226-248 | cai-shen-type-behavior |
| SVE-AT-ST-C01-003-02 | hzmj_server | hzmj_server/game_logic.cpp:51-55 | cai-shen-type-json-key |
| SVE-AT-ST-C01-003-03 | hzmj_server | hzmj_server/server_config.cpp:16 | cai-shen-type-default-white-board |
| SVE-AT-ST-C01-004-01 | common_game | common_game/com_game/common_game_com_ju.cpp:132-136 | banker-level-applied-at-ding-zhuang |
| SVE-AT-ST-C01-004-02 | common_game | common_game/com_game/common_game_com_ju.cpp:191-196 | banker-level-type-to-level-mapping |
| SVE-AT-ST-C01-004-03 | hzmj_server | hzmj_server/game_logic.cpp:56-59 | banker-level-type-json-key |
| SVE-AT-ST-C01-004-04 | hzmj_server | hzmj_server/server_config.cpp:18 | banker-level-type-default-flat |
| SVE-AT-ST-C01-005-01 | common_game | common_game/com_game/common_game_com_action.cpp:353-358 | banker-discard-hu-requires-three-level |
| SVE-AT-ST-C01-005-02 | hzmj_server | hzmj_server/game_logic.cpp:60-63 | banker-discard-hu-json-key |
| SVE-AT-ST-C01-005-03 | hzmj_server | hzmj_server/server_config.cpp:19 | banker-discard-hu-default-on |
| SVE-AT-ST-C01-005-04 | mah_frame | mah_frame/base/base_config.cpp:42 | discard-allowed-default |
| SVE-AT-ST-C01-006-01 | common_game | common_game/com_game/common_game_com_result.cpp:57-59 | grand-settlement-owned-by-room-service |
| SVE-AT-ST-C01-009-01 | common_game | common_game/com_game/common_game_com_result.cpp:201-213 | score-limit-cap-in-settlement |
| SVE-AT-ST-C01-009-02 | common_game | common_game/com_game/common_game_com_result.cpp:60-76 | play-score-gates-lian-zhuang-bu-zhan |
| SVE-AT-ST-C01-009-03 | common_game | common_game/com_game/common_game_com_result.cpp:89 | base-score-used-in-settlement |
| SVE-AT-ST-C01-009-04 | hzmj_server | hzmj_server/game_logic.cpp:175-183 | play-score-lian-zhuang-json-keys |
| SVE-AT-ST-C01-009-05 | hzmj_server | hzmj_server/server_config.cpp:43-46 | box-defaults-score-limit-play-score |
| SVE-AT-ST-C01-010-01 | hzmj_server | hzmj_server/game_logic.cpp:22-34 | base-score-json-override |
| SVE-AT-ST-C01-010-02 | mah_frame | mah_frame/base/base_config.cpp:36 | base-score-default-one |
| SVE-AT-ST-C01-011-01 | hzmj_server | hzmj_server/game_logic.cpp:169-173 | score-limit-json-key |
| SVE-AT-ST-C01-012-01 | hzmj_server | hzmj_server/game_logic.cpp:175-179 | play-score-parsed-as-start-chips |
| SVE-AT-ST-C01-012-02 | hzmj_server | hzmj_server/server_config.cpp:43-46 | box-defaults-score-limit-play-score-lian-zhuang |
| SVE-AT-ST-C01-013-01 | common_game | common_game/com_game/common_game_com_result.cpp:201-213 | score-limit-zero-means-no-cap |
| SVE-AT-ST-C01-013-02 | hzmj_server | hzmj_server/game_logic.cpp:169-173 | score-limit-independent-parse |
| SVE-AT-ST-C01-014-01 | hzmj_server | hzmj_server/game_logic.cpp:22-34 | base-score-parse-only-accepts-positive |
| SVE-AT-ST-C01-015-01 | common_game | common_game/com_game/common_game_com_result.cpp:57-76 | play-score-endgame-exempt-on-banker-win |
| SVE-AT-ST-C01-015-02 | hzmj_server | hzmj_server/game_logic.cpp:180-183 | lian-zhuang-bu-zhan-config-parse |
| SVE-AT-ST-C01-018-01 | common_game | common_game/common_game_algorithm.cpp:79-84 | chi-peng-limit-two-per-direction |
| SVE-AT-ST-C01-018-02 | hzmj_server | hzmj_server/game_logic.cpp:112-121 | chi-peng-mode-config-parse |
| SVE-AT-ST-C01-018-03 | hzmj_server | hzmj_server/server_config.cpp:27-28 | box-default-chi-peng-unlimited |
| SVE-AT-ST-C01-019-01 | common_game | common_game/com_game/common_game_com_pung.cpp:125-138 | pung-counts-one-tan-when-pung-as-tan |
| SVE-AT-ST-C01-019-02 | common_game | common_game/common_game_algorithm.cpp:86-93 | xian-xian-tan-capped-at-two |
| SVE-AT-ST-C01-019-03 | hzmj_server | hzmj_server/game_logic.cpp:65-87 | three-tan-forced-off-for-two-players |
| SVE-AT-ST-C01-019-04 | hzmj_server | hzmj_server/server_config.cpp:20-21 | box-default-three-tan-off-pung-as-tan-on |
| SVE-AT-ST-C01-020-01 | common_game | common_game/com_game/common_game_com_action.cpp:74-80 | only-pung-no-chow-blocks-chow |
| SVE-AT-ST-C01-021-01 | common_game | common_game/com_game/common_game_com_action.cpp:141-148 | three-tan-triggers-contract-at-three |
| SVE-AT-ST-C01-021-02 | common_game | common_game/com_game/common_game_com_result.cpp:289-295 | contract-settle-guarded-by-three-tan-flag |
| SVE-AT-ST-C01-022-01 | common_game | common_game/common_game_context.cpp:438-443 | server-pushes-three-tan-flag-to-client |
| SVE-AT-ST-C01-024-01 | common_game | common_game/com_game/common_game_com_action.cpp:62-66 | chow-judge-chi-peng-limit-call-site |
| SVE-AT-ST-C01-024-02 | common_game | common_game/com_game/common_game_com_pung.cpp:17-41 | pung-judge-chi-peng-and-guard-call-site |
| SVE-AT-ST-C01-024-03 | common_game | common_game/common_game_algorithm.cpp:79-84 | rule-chi-peng-limit-two |
| SVE-AT-ST-C01-024-04 | common_game | common_game/common_game_algorithm.cpp:86-93 | three-tan-bao-limit-check |
| SVE-AT-ST-C01-024-05 | common_game | common_game/common_game_logic.cpp:153-194 | no-total-round-limit-in-total-score |
| SVE-AT-ST-C01-024-06 | common_game | common_game/common_game_logic.cpp:65-73 | box-config-load-call-chain |
| SVE-AT-ST-C01-024-07 | common_game | common_game/common_game_server_config.h:41 | three-tan-bao-only-3-4-players |
| SVE-AT-ST-C01-024-08 | hzmj_server | hzmj_server/game_logic.cpp:66-83 | three-tan-bao-player-count-guard |
| SVE-AT-ST-C01-024-09 | hzmj_server | hzmj_server/server_config.cpp:19-39 | box-default-config-values |
| SVE-AT-ST-C01-025-01 | common_game | common_game/common_game_init.cpp:57-58 | two-suit-init-player-count-guard |
| SVE-AT-ST-C01-025-02 | common_game | common_game/common_game_server_config.h:55 | two-suit-only-2-3-players |
| SVE-AT-ST-C01-025-03 | common_game | common_game/common_game_server_config.h:65-66 | guard-dealer-only-3-4-players |
| SVE-AT-ST-C01-025-04 | hzmj_server | hzmj_server/game_logic.cpp:122-125 | two-suit-json-no-player-count-check |
| SVE-AT-ST-C01-025-05 | hzmj_server | hzmj_server/game_logic.cpp:149-161 | guard-dealer-player-count-guard |
| SVE-AT-ST-C01-027-01 | common_game | common_game/common_game_algorithm.cpp:62-67 | guard-dealer-3-vs-4-player-scope |

说明：原子 007 / 008 / 017 无任何 CLE / SVE 证据（服务端 applicability=inactive，客户端 not_found）；原子 006 / 016 仅有上述单条间接 SVE 证据。

## 待处理事项

### 规则待验证（25 项，来自 pending-list「规则待验证」表）

| atomId | 验证范围 | 问题 | 说明 | 建议动作 |
|---|---|---|---|---|
| AT-ST-C01-001 | client | 规则待验证 | 客户端仅部分证据 | 补证 both |
| AT-ST-C01-002 | client | 规则待验证 | 客户端仅部分证据 | 补证 both |
| AT-ST-C01-003 | client | 规则待验证 | 客户端仅部分证据 | 补证 both |
| AT-ST-C01-004 | client | 规则待验证 | 客户端仅部分证据（另有待审批复核建议：partial） | 补证 both |
| AT-ST-C01-005 | client | 规则待验证 | 客户端仅部分证据 | 补证 both |
| AT-ST-C01-006 | client | 规则待验证 | 客户端无实现证据 | 补证 both |
| AT-ST-C01-009 | client | 规则待验证 | 客户端仅部分证据 | 补证 both |
| AT-ST-C01-010 | client | 规则待验证 | 客户端仅部分证据 | 补证 both |
| AT-ST-C01-011 | client | 规则待验证 | 客户端仅部分证据 | 补证 both |
| AT-ST-C01-013 | client | 规则待验证 | 客户端无实现证据 | 补证 both |
| AT-ST-C01-014 | client | 规则待验证 | 客户端无实现证据 | 补证 both |
| AT-ST-C01-015 | client | 规则待验证 | 客户端无实现证据 | 补证 both |
| AT-ST-C01-016 | both | 规则待验证 | 客户端无实现证据；服务端证据不足 | 补证 both |
| AT-ST-C01-018 | both | 规则待验证 | 客户端无实现证据；依赖配置 rule_chi_peng（默认 0 不限制）/ only_pung_no_chow（默认 false）；服务端不按人数自动切换，另 enable_three_tan_bao=false 时回写 rule_chi_peng=2（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C01-019 | both | 规则待验证 | 客户端无实现证据；依赖配置 enable_three_tan_bao（默认 false，≤2 人强制 false）+ pung_as_tan（默认 true，需显式提交 false 才停止碰记摊）+ rule_chi_peng（默认 0） | 补证 both |
| AT-ST-C01-020 | both | 规则待验证 | 客户端无实现证据；依赖配置 only_pung_no_chow + rule_chi_peng + pung_as_tan（默认 true）+ enable_three_tan_bao（≤2 人强制 false） | 补证 both |
| AT-ST-C01-021 | client | 规则待验证 | 客户端无实现证据（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C01-022 | client | 规则待验证 | 客户端无实现证据 | 补证 both |
| AT-ST-C01-023 | both | 规则待验证 | 客户端无实现证据 | 补证 both |
| AT-ST-C01-024 | both | 规则待验证 | 客户端无实现证据；依赖配置 enable_three_tan_bao（默认 false，2 人局强制关闭）：下发且值=0 时服务端置 rule_chi_peng=2，与需求「无限吃碰」相反；不下发则保持 0 不限制（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C01-025 | client | 规则待验证 | 客户端无实现证据 | 补证 both |
| AT-ST-C01-026 | both | 规则待验证 | 客户端无实现证据；依赖配置 enable_three_tan_bao：值=0 时置 rule_chi_peng=2（等同默认吃碰），值=1 时三摊接管且 RuleChiPeng 不改写，不下发则保持 0 | 补证 both |
| AT-ST-C01-027 | client | 规则待验证 | 客户端无实现证据 | 补证 both |
| AT-ST-C01-028 | both | 规则待验证 | 客户端无实现证据；依赖配置 enable_three_tan_bao：值=0 时 rule_chi_peng=2，值=1 时三摊接管，不下发则保持 0 | 补证 both |
| AT-ST-C01-029 | client | 规则待验证 | 客户端无实现证据 | 补证 both |

### 待审批复核建议（1 项，reviewStatus=pending，尚未生效）

| atomId | 验证范围 | 问题 | 复核建议 | 建议动作 |
|---|---|---|---|---|
| AT-ST-C01-012 | client | 待审批复核建议 | reviewedDifference=unverified（reviewRule=common-capability-is-not-enabled：服务端打片结算口径存在不等于本房创房面板已提供 40片/50片/60片 档）。依据：client.verdict=not_found、evidenceIds 为空；SVE-AT-ST-C01-012-01（hzmj_server/game_logic.cpp:175-179）仅为 play_score 解析，SVE-AT-ST-C01-012-02（hzmj_server/server_config.cpp:43-46）为好友房默认 play_score=0、lian_zhuang_bu_zhan=false，SVE-AT-ST-C01-015-01（common_game/com_game/common_game_com_result.cpp:57-76）证明打片房按片数推进大结算——均无法证明创房面板提供三档，既不构成矛盾也不能判一致 | 审批（approve/reject/hold） |

补充说明：difference-review.json 中 AT-ST-C01-004 / 018 / 021 / 024 的复核条目 reviewStatus 同为 pending，复核建议分别为 partial / unverified / unverified / unverified（已在对应原子小节标注），均尚未生效；pending-list「待审批复核建议」表当前仅登记 012 一条。

### 查证未完成（blocked）：0 项

本阶段无 analysisPath=blocked 原子，无 verification 执行 pending/timeout/failed 导致的「查证未完成」条目（l7-classify.blockedAtoms 为空）；全部 29 个原子 analysisPath=full，l7Basis 均为 proposed。

### 需策划裁决（decision_required）：0 项
