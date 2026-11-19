# ST-C12 自摸、放铳、抢杠胡

## 阶段概述

本阶段定义杭州麻将好友房的三种和牌成立口径：自摸（常规摸牌、杠后补牌、庄家起手第 14 张三种时机，须在出牌前完成，常规结构为 4 组面子加 1 组对子）、本期固定的庄闲放铳（三牢且出牌者与胡牌者一庄一闲、牌型合法，只由放铳者赔付），以及三牢庄闲之间的抢杠胡（所加第 4 张须使响应者合法胡牌，只由被抢的加杠者按放铳赔付、其他人不付）。

- 原子数：13（AT-ST-C12-001 ~ AT-ST-C12-013），分属 3 个功能点：FP-ST-C12-001 自摸（001-004）、FP-ST-C12-002 放铳（点炮胡）（005-009）、FP-ST-C12-003 抢杠胡（010-013）。
- L7 分布：verified 0 / verification_required 13 / decision_required 0 / not_applicable 0。
- analysisPath 分布：13 个原子全部为 `full`（无 blocked、无 conflict-fast），`blockedAtoms` 为空。
- 升级原子：13 个原子的 `candidateDifference` 全为空，无历史基线升级候选。
- 取证现状：本阶段 13 个原子在统一原子视图中双端字段均为空（`clientVerdict` 空、`serverApplicability` 空、`clientEvidenceIds` / `serverEvidenceIds` 空），`trace_index.json` 记 `evidenceCount=0`，`effectiveDifference` 一律为 `unverified`；`client-evidence.json` 的 `coverage.pendingAtomIds` 明确列出 AT-ST-C12-001 ~ 013 全部 13 个原子。其中 AT-ST-C12-001 存在 `reviewStatus=pending` 的复核建议，尚未生效，详见该原子「实际实现差异」与「待处理事项」。
- 需求原文行号：PRD 第 165 行（自摸）、第 166 行（放铳）、第 167 行（抢杠胡）；章节为「行牌 > 自摸、放铳、抢杠胡」。
- 验证范围：13 个原子 `verificationScope` 均为 `server`，本阶段无 `client` / `both` 原子。

| 原子 | 名称 | 验证范围 | difference | L7 |
|---|---|---|---|---|
| AT-ST-C12-001 | 常规摸牌自摸 | server | unverified | verification_required |
| AT-ST-C12-002 | 杠后补牌自摸 | server | unverified | verification_required |
| AT-ST-C12-003 | 庄家起手第 14 张自摸 | server | unverified | verification_required |
| AT-ST-C12-004 | 自摸牌型结构与出牌前时限 | server | unverified | verification_required |
| AT-ST-C12-005 | 本期固定庄闲放铳 | server | unverified | verification_required |
| AT-ST-C12-006 | 点炮胡成立前提 | server | unverified | verification_required |
| AT-ST-C12-007 | 放铳的庄闲方向限制 | server | unverified | verification_required |
| AT-ST-C12-008 | 未构成庄闲关系只能自摸 | server | unverified | verification_required |
| AT-ST-C12-009 | 放铳赔付归属 | server | unverified | verification_required |
| AT-ST-C12-010 | 抢杠胡仅限三牢庄闲之间 | server | unverified | verification_required |
| AT-ST-C12-011 | 第 4 张须使响应者合法胡牌 | server | unverified | verification_required |
| AT-ST-C12-012 | 抢杠胡由被抢加杠者赔付 | server | unverified | verification_required |
| AT-ST-C12-013 | 抢杠胡其他人不赔付 | server | unverified | verification_required |

## 需求条目

### AT-ST-C12-001 常规摸牌自摸

- 所属功能点：FP-ST-C12-001 自摸（PRD 第 165 行）
- **需求规则**：玩家在常规摸牌后、出牌前，可胡牌（自摸）。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空（本原子必要端为服务端，客户端非取证必要端）；`clientEvidenceIds` 为空；`client-evidence.json` 的 `coverage.pendingAtomIds` 明确列出本原子，表示本轮客户端未产出指向「摸牌后可自摸」的证据。实现要点（需求口径，非实现事实）：客户端应在玩家摸牌后、出牌前把「自摸胡」呈现为可点操作，可用性以服务端判定为准；无 CLE 证据可证明该入口已实现，亦无 `file:line` 可定位。
- **服务端职责**：`applicability` 为空，服务端未给出适用性判定；`serverEvidenceIds` 为空；`server-evidence.json` 全量 60 条证据的 atomIds 全部落在 AT-ST-C01 系列，无任何 atomIds 含 C12 的条目。`configCondition` 为空，未登记任何开关。需求口径为：玩家摸牌后由服务端按胡牌规则判定整手牌能否成胡，能成胡则允许其在出牌前自摸，一旦出牌即不再接受自摸。无 SVE 证据与 `file:line` 可定位该时序判定。
- **双端协作**：轮到玩家 → 玩家摸牌 → 服务端判定该手牌能否成胡 → 向该玩家下发「可自摸」提示 → 玩家点胡 → 服务端确认自摸成立 → 进入结算（`collaboration` 原文语义）。
- **业务行为**：
  - trigger：轮到玩家行牌，玩家从牌墙常规摸到一张牌
  - condition：摸牌完成后尚未打出任何一张牌
  - action：客户端在玩家摸牌后、出牌前把「自摸胡」呈现为可点的操作（胡牌提示），是否可用以服务端判定为准；服务端在玩家摸牌后按胡牌规则判定整手牌能否成胡，能成胡则允许其在出牌前自摸，一旦出牌即不再接受自摸
  - result：玩家摸牌后、出牌前，若手牌已能成胡，可以选择自摸胡牌
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空（无升级候选）。
  `baselineDetail`：该原子要求「常规摸牌后、出牌前可自摸」，职责域为服务端裁决；但统一原子视图中服务端无任何证据（applicability 为空、evidenceIds 为空、无矛盾证据），客户端亦无证据，仅有需求描述，无法判定实现是否符合，按证据不足归为未验证。
  待审批建议：unverified（`evidence-is-not-consistency`：本片 13 个原子双端证据均为零，缺证只能维持 unverified，不得据此判 consistent/partial；同时无矛盾证据，也不升级 conflict）。复核理由要点：需求语义分三组（001-004 自摸时机与结构、005-009 庄闲放铳、010-013 抢杠胡）；客户端 `client.verdict` 与 `client.evidenceIds` 均为空，现网 12 条 CLE 证据仅覆盖 AT-ST-C01-001/002/003/004/005/009/010/011；服务端 `server.applicability` 与 `server.evidenceIds` 均为空，60 条 SVE 证据只落在 AT-ST-C01-001~029。该建议 `reviewStatus=pending`，**尚未生效**。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（依据生效的 `effectiveDifference=unverified` 提议；`scope=unknown`、`scopeSource=default-unknown`）。查证本身未被阻塞，非 pending-blocked；若上述 pending 建议获批仍为 unverified，不改变 L7。

### AT-ST-C12-002 杠后补牌自摸

- 所属功能点：FP-ST-C12-001 自摸（PRD 第 165 行）
- **需求规则**：玩家在杠后补牌时、出牌前，可胡牌（自摸）。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 列有本原子。实现要点（需求口径，非实现事实）：客户端应在杠后补牌的同一轮里、出牌前把「自摸胡」呈现为可点操作；无 CLE 证据，无 `file:line` 可定位。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空；无 atomIds 含 C12 的 SVE 证据。`configCondition` 为空，未登记开关。需求口径为：服务端把杠后补到的这张牌纳入胡牌判定，能成胡则在出牌前允许自摸，不等同于跳过该轮。无 SVE 证据与 `file:line` 可定位补牌后判定与出牌时序。
- **双端协作**：玩家杠牌 → 从牌墙补牌 → 服务端按补到的牌判定能否成胡 → 向该玩家下发「可自摸」提示 → 玩家点胡 → 服务端确认自摸成立 → 进入结算。
- **业务行为**：
  - trigger：玩家完成杠牌，从牌墙补进一张牌
  - condition：补牌完成后尚未出牌
  - action：客户端在玩家杠后补牌的同一轮里、出牌前把「自摸胡」呈现为可点的操作；服务端把杠后补到的这张牌纳入胡牌判定，能成胡则在出牌前允许自摸
  - result：玩家杠牌补牌后、出牌前，若手牌成胡，可以选择自摸胡牌
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：该原子要求「杠后补牌、出牌前可自摸」，职责域为服务端裁决；但统一原子视图中服务端无任何证据（applicability 为空、evidenceIds 为空、无矛盾证据），客户端亦无证据，无法判定实现符合性，按证据不足归为未验证。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）。

### AT-ST-C12-003 庄家起手第 14 张自摸

- 所属功能点：FP-ST-C12-001 自摸（PRD 第 165 行）
- **需求规则**：庄家起手拿到第 14 张牌时，在出牌前可胡牌（自摸）。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 列有本原子。实现要点（需求口径，非实现事实）：客户端应在开局配牌结束后、庄家首次出牌前，向庄家呈现「自摸胡」（天胡式自摸）的可点操作；无 CLE 证据，无 `file:line` 可定位。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空；无 atomIds 含 C12 的 SVE 证据。`configCondition` 为空，未登记开关。需求口径为：服务端在庄家拿到第 14 张牌后按胡牌规则判定起手牌能否成胡，能成胡则在首次出牌前允许庄家自摸。无 SVE 证据与 `file:line` 可定位起手第 14 张的判定入口。
- **双端协作**：开局配牌 → 庄家拿到第 14 张牌 → 服务端判定起手牌能否成胡 → 向庄家下发「可自摸」提示 → 庄家点胡 → 服务端确认自摸成立 → 进入结算；若庄家先出牌则不再允许。
- **业务行为**：
  - trigger：庄家起手配牌完成，手上拿到第 14 张牌
  - condition：庄家尚未打出第一张牌
  - action：客户端在开局配牌结束后、庄家首次出牌前呈现「自摸胡」可点操作；服务端在庄家拿到第 14 张牌后判定起手牌能否成胡，能成胡则在首次出牌前允许自摸
  - result：庄家起手牌成胡时，可以在打出第一张牌之前直接自摸胡牌
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：该原子要求「庄家起手第 14 张、出牌前可自摸」，职责域为服务端裁决；但统一原子视图中服务端无任何证据（applicability 为空、evidenceIds 为空、无矛盾证据），客户端亦无证据，无法判定实现符合性，按证据不足归为未验证。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）。

### AT-ST-C12-004 自摸牌型结构与出牌前时限

- 所属功能点：FP-ST-C12-001 自摸（PRD 第 165 行）
- **需求规则**：自摸须在出牌前完成胡牌，常规结构是 4 组面子加 1 组对子。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 列有本原子。实现要点（需求口径，非实现事实）：客户端只把符合常规结构的成胡手牌呈现为可自摸，并保证出牌前才可点胡；无 CLE 证据，无 `file:line` 可定位。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空；无 atomIds 含 C12 的 SVE 证据。`configCondition` 为空，未登记开关。需求口径为：服务端复核手牌是否满足 4 组面子加 1 组对子，并核对该玩家本轮是否仍未出牌；两者都成立才判自摸成立，出牌后不再接受自摸。功能点 scope 明确不含番型计算、承包代赔与特殊结构（爆头、七客），本原子只覆盖常规结构与出牌前时限；无 SVE 证据与 `file:line` 可定位胡牌结构校验与出牌状态校验。
- **双端协作**：玩家点胡 → 服务端结构校验（面子与对子）→ 服务端时序校验（是否已出牌）→ 全部通过则自摸成立并结算，任一不满足则拒绝。
- **业务行为**：
  - trigger：玩家在摸牌、杠后补牌或庄家起手第 14 张时宣告自摸胡
  - condition：手牌构成 4 组面子加 1 组对子的常规结构，且玩家尚未出牌
  - action：客户端只把符合常规结构的成胡手牌呈现为可自摸，并保证出牌前才可点胡；服务端复核手牌结构与该玩家本轮是否仍未出牌，两者都成立才判自摸成立
  - result：玩家只有在手牌结构合法且尚未出牌时才能自摸成功，出牌之后无法再自摸
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：该原子要求「自摸需在出牌前完成、结构为 4 组面子加 1 组对子」，两项校验都在服务端；但统一原子视图中服务端无任何证据（applicability 为空、evidenceIds 为空、无矛盾证据），客户端亦无证据，无法判定实现符合性，按证据不足归为未验证。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）。

### AT-ST-C12-005 本期固定庄闲放铳

- 所属功能点：FP-ST-C12-002 放铳（点炮胡）（PRD 第 166 行）
- **需求规则**：本期放铳固定为庄闲放铳这一种形式。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 列有本原子。实现要点（需求口径，非实现事实）：客户端不向玩家提供其他点炮形式的选项或入口，界面只体现庄闲放铳这一种口径；无 CLE 证据，无 `file:line` 可定位。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空；无 atomIds 含 C12 的 SVE 证据。`configCondition` 为空，本原子未登记开关。需求口径为：服务端把庄闲放铳作为本期唯一的点炮胡形式，不启用其他点炮玩法。
  旁证线索（归属 AT-ST-C01-005，**不构成本原子证据**）：SVE-AT-ST-C01-005-02（`hzmj_server/game_logic.cpp:60-63`，claimKey=`banker-discard-hu-json-key`）把 `enable_banker_discard_hu` 描述为「庄闲放铳，仅三牢时庄闲可互相点炮」；SVE-AT-ST-C01-005-03（`hzmj_server/server_config.cpp:19`，claimKey=`banker-discard-hu-default-on`）显示好友房默认 `SetEnableBankerDiscardHu(true)`。两条只说明服务端存在庄闲放铳开关及其默认值，不能证明「本期唯一形式、无其他点炮玩法」。
- **双端协作**：本局规则初始化 → 服务端确定唯一放铳口径为庄闲放铳 → 客户端按该口径呈现可胡提示 → 对局中只在庄闲关系下出现点炮胡。
- **业务行为**：
  - trigger：本局开启，确定本局允许的点炮胡形式
  - condition：当前对局为杭州麻将好友房本期规则
  - action：客户端不向玩家提供其他点炮形式的选项或入口；服务端把庄闲放铳作为本期唯一的点炮胡形式，不启用其他点炮玩法
  - result：玩家在本期对局里只会遇到庄闲放铳这一种点炮胡，没有其他点炮形式
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：该原子要求「本期放铳固定为庄闲放铳这一种形式」，属服务端规则口径；但统一原子视图中服务端无任何证据（applicability 为空、evidenceIds 为空、无矛盾证据），客户端亦无证据，无法判定实现符合性，按证据不足归为未验证。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）。

### AT-ST-C12-006 点炮胡成立前提

- 所属功能点：FP-ST-C12-002 放铳（点炮胡）（PRD 第 166 行）
- **需求规则**：当局是三牢，且出牌者与胡牌者正好一边是庄、一边是闲，同时牌型合法，才能点炮胡。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 列有本原子。实现要点（需求口径，非实现事实）：客户端只在三项条件都满足时才向响应玩家呈现点炮胡的可点操作；无 CLE 证据，无 `file:line` 可定位。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空；无 atomIds 含 C12 的 SVE 证据。`configCondition` 为空，本原子未登记开关。需求口径为：服务端同时校验牢级是否为三牢、双方是否一庄一闲、响应牌型是否合法，三项全满足才判点炮胡成立，否则拒绝。
  旁证线索（归属 AT-ST-C01-005，**不构成本原子证据**）：SVE-AT-ST-C01-005-01（`common_game/com_game/common_game_com_action.cpp:353-358`，claimKey=`banker-discard-hu-requires-three-level`，symbol=`BoxHuStep::CanDiscardHu`）在关闭 `enable_banker_discard_hu` 或 `BankerLevel<3` 时返回 false，只覆盖「开关 + 三牢门槛」两项，未覆盖本原子的「牌型合法」校验。
- **双端协作**：玩家打出牌 → 其他玩家请求点炮胡 → 服务端校验牢级（三牢）→ 校验庄闲关系（一庄一闲）→ 校验牌型合法性 → 全部通过才判成立并结算，任一不满足则不允许胡。
- **业务行为**：
  - trigger：一名玩家打出一张牌，其他玩家尝试胡这张牌
  - condition：当局牢级为三牢，出牌者与胡牌者一方为庄一方为闲，且响应者以该牌组成的手牌结构合法
  - action：客户端只在三项条件都满足时才向响应玩家呈现点炮胡可点操作；服务端同时校验牢级、庄闲关系与牌型合法性，三项全满足才判成立
  - result：只有在三牢局、且出牌者与胡牌者正好一庄一闲、牌型合法时，玩家才能点炮胡；否则这张牌不能被点炮胡
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：该原子要求「三牢 + 一庄一闲 + 牌型合法」三项同时满足才可点炮胡，判定完全依赖服务端；但统一原子视图中服务端无任何证据（applicability 为空、evidenceIds 为空、无矛盾证据），客户端亦无证据，无法判定实现符合性，按证据不足归为未验证。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）。

### AT-ST-C12-007 放铳的庄闲方向限制

- 所属功能点：FP-ST-C12-002 放铳（点炮胡）（PRD 第 166 行）
- **需求规则**：庄家打出的牌只有闲家可胡，闲家打出的牌只有庄家可胡。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 列有本原子。实现要点（需求口径，非实现事实）：客户端只在出牌方与响应方为一庄一闲关系时才向响应方呈现胡牌操作；无 CLE 证据，无 `file:line` 可定位。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空；无 atomIds 含 C12 的 SVE 证据。`configCondition` 为空，本原子未登记开关。需求口径为：服务端按出牌方身份定向判定——庄家打出的牌只对闲家开放点炮胡，闲家打出的牌只对庄家开放点炮胡。
  旁证线索（归属 AT-ST-C01-005，**不构成本原子证据**）：SVE-AT-ST-C01-005-01（`common_game/com_game/common_game_com_action.cpp:353-358`）只体现三牢门槛与开关，复核说明明确其未覆盖本原子反向情形（闲家打牌庄家可胡）。
- **双端协作**：一方出牌 → 另一方请求胡牌 → 服务端按出牌方是庄还是闲决定谁有权胡 → 有权的响应方点炮胡成立，无权者被拒绝。
- **业务行为**：
  - trigger：一方打出一张牌，另一方尝试胡这张牌
  - condition：出牌方与响应方分别处于庄与闲的位置
  - action：客户端只在一庄一闲关系下呈现胡牌操作；服务端按出牌方身份定向判定谁有权胡
  - result：庄家打出的牌只有闲家能胡，闲家打出的牌只有庄家能胡
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：该原子要求「庄打的牌只有闲能胡、闲打的牌只有庄能胡」，属服务端权限判定；但统一原子视图中服务端无任何证据（applicability 为空、evidenceIds 为空、无矛盾证据），客户端亦无证据，无法判定实现符合性，按证据不足归为未验证。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）。

### AT-ST-C12-008 未构成庄闲关系只能自摸

- 所属功能点：FP-ST-C12-002 放铳（点炮胡）（PRD 第 166 行）
- **需求规则**：出牌者与胡牌者未形成一庄一闲关系时，只能自摸。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 列有本原子。实现要点（需求口径，非实现事实）：客户端在此类关系下不向响应者提供点炮胡操作，只保留自摸路径；无 CLE 证据，无 `file:line` 可定位。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空；无 atomIds 含 C12 的 SVE 证据。`configCondition` 为空，本原子未登记开关。需求口径为：服务端拒绝该次点炮胡请求，不给该玩家开启由他人出牌产生胡牌的通道。
- **双端协作**：一方出牌 → 无权响应的玩家请求胡牌 → 服务端判定双方非一庄一闲 → 拒绝点炮胡 → 该玩家只能等自己摸牌自摸。
- **业务行为**：
  - trigger：玩家尝试胡他人打出的一张牌
  - condition：出牌者与响应者之间不构成一庄一闲关系（如闲家与闲家之间）
  - action：客户端在此类关系下不提供点炮胡操作，只保留自摸路径；服务端拒绝该次点炮胡请求
  - result：在非庄闲对立的情况下，玩家无法胡别人打出的牌，只能靠自摸胡
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：该原子要求「未形成一庄一闲关系时只能自摸」，属服务端规则限制；但统一原子视图中服务端无任何证据（applicability 为空、evidenceIds 为空、无矛盾证据），客户端亦无证据，无法判定实现符合性，按证据不足归为未验证。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）。

### AT-ST-C12-009 放铳赔付归属

- 所属功能点：FP-ST-C12-002 放铳（点炮胡）（PRD 第 166 行）
- **需求规则**：点炮胡只由放铳者赔付。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 列有本原子。实现要点（需求口径，非实现事实）：客户端在结算中只把放铳者列为该次点炮胡的赔付方。复核说明指出，现网两条与「点炮」相关的客户端证据 CLE-AT-ST-C01-005-02（`config/FanDefine.ts:637-638`，claimKey=`hu-result-label-dianpao`，把结算流水类型标注为「点炮胡 / 放炮」文本）与 CLE-AT-ST-C01-005-03（`layer/comp/BoxHzmjResultMid.ts:719-737`，claimKey=`result-hu-type-tab`，按 `hu_type` 切自摸/点炮页签）只证明 ST-C01 的胡牌结果展示，不能证明赔付归属，均不构成本原子证据。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空；`server-evidence.json` 60 条证据中无 atomIds 含 C12 的条目。`configCondition` 为空，本原子未登记开关。需求口径为：服务端把点炮胡的赔付责任只记在放铳者身上，其余玩家不承担此次赔付。功能点 scope 明确不含具体赔付数值；无 SVE 证据与 `file:line` 可定位结算归责。
- **双端协作**：点炮胡成立 → 服务端锁定放铳者为本局唯一赔付方 → 算出输赢分并下发结算 → 客户端在结算中显示由放铳者赔付。
- **业务行为**：
  - trigger：点炮胡成立并进入本局结算
  - condition：胡牌所用的那张牌由某位玩家打出
  - action：客户端在结算中只把放铳者列为赔付方；服务端把赔付责任只记在放铳者身上，其余玩家不承担此次赔付
  - result：结算中只有放铳的那位玩家扣分，其他玩家不为这次点炮胡付分
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：该原子要求「点炮胡只由放铳者赔付」，属服务端结算归责；但统一原子视图中服务端无任何证据（applicability 为空、evidenceIds 为空、无矛盾证据），客户端亦无证据，无法判定实现符合性，按证据不足归为未验证。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）。

### AT-ST-C12-010 抢杠胡仅限三牢庄闲之间

- 所属功能点：FP-ST-C12-003 抢杠胡（PRD 第 167 行）
- **需求规则**：抢杠胡与放铳相同，只有三牢的庄闲之间可以抢。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 列有本原子。实现要点（需求口径，非实现事实）：客户端只在三牢局且庄闲对立关系下向符合条件的玩家呈现抢杠胡操作；无 CLE 证据，无 `file:line` 可定位。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空；无 atomIds 含 C12 的 SVE 证据。`configCondition` 为空，本原子未登记开关。需求口径为：服务端按与放铳相同的口径校验抢杠——牢级须为三牢、加杠者与响应者须一庄一闲，满足才开放抢杠胡。功能点 scope 明确不含杠牌流程细节与番型组合（如杠爆）。
- **双端协作**：玩家加杠 → 亮出第 4 张 → 服务端校验牢级（三牢）与庄闲关系 → 满足则向有权玩家下发抢杠胡提示 → 玩家点胡 → 服务端确认抢杠胡成立 → 结算。
- **业务行为**：
  - trigger：一名玩家对自己已碰的牌进行加杠，亮出第 4 张
  - condition：当局牢级为三牢，且加杠者与响应者一方为庄一方为闲
  - action：客户端只在三牢且庄闲对立下呈现抢杠胡操作；服务端按放铳口径校验牢级与庄闲关系，满足才开放抢杠胡
  - result：只有三牢局中庄家与闲家之间的加杠才能被抢，其他情况不能抢杠胡
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：该原子要求「抢杠胡与放铳相同，只有三牢的庄闲之间可以抢」，属服务端规则判定；但统一原子视图中服务端无任何证据（applicability 为空、evidenceIds 为空、无矛盾证据），客户端亦无证据，无法判定实现符合性，按证据不足归为未验证。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）。

### AT-ST-C12-011 第 4 张须使响应者合法胡牌

- 所属功能点：FP-ST-C12-003 抢杠胡（PRD 第 167 行）
- **需求规则**：所加的第 4 张须使响应者合法胡牌，否则不能抢杠胡。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 列有本原子。实现要点（需求口径，非实现事实）：客户端只在该张第 4 张牌确实能让响应者成胡时才呈现抢杠胡操作，不因他人加杠就统一放开；无 CLE 证据，无 `file:line` 可定位。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空；无 atomIds 含 C12 的 SVE 证据。`configCondition` 为空，本原子未登记开关。需求口径为：服务端以这张第 4 张牌代入响应者手牌做胡牌校验，校验通过才允许抢杠胡，不通过则拒绝。
- **双端协作**：加杠者亮第 4 张 → 响应者请求抢杠 → 服务端把该张牌代入响应者手牌校验牌型 → 通过则抢杠胡成立，不通过则该玩家不能抢。
- **业务行为**：
  - trigger：加杠者亮出加杠用的第 4 张牌
  - condition：响应者是否能把这张第 4 张牌并入自己的手牌并组成合法胡牌结构
  - action：客户端只在该张牌确实能让响应者成胡时才呈现抢杠胡操作；服务端以该张牌代入响应者手牌做胡牌校验，通过才允许
  - result：只有当加杠亮出的这张牌能让自己真正成胡时，玩家才能抢杠胡；胡不了的牌即使别人加杠也不能抢
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：该原子要求「第 4 张须使响应者合法胡牌才能抢杠胡」，属服务端牌型校验；但统一原子视图中服务端无任何证据（applicability 为空、evidenceIds 为空、无矛盾证据），客户端亦无证据，无法判定实现符合性，按证据不足归为未验证。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）。

### AT-ST-C12-012 抢杠胡由被抢加杠者赔付

- 所属功能点：FP-ST-C12-003 抢杠胡（PRD 第 167 行）
- **需求规则**：抢杠胡只由被抢的加杠者按放铳赔付。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 列有本原子。实现要点（需求口径，非实现事实）：客户端在结算中把被抢的加杠者显示为赔付方，并按点炮口径呈现这笔输赢；无 CLE 证据，无 `file:line` 可定位。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空；无 atomIds 含 C12 的 SVE 证据。`configCondition` 为空，本原子未登记开关。需求口径为：服务端按放铳的算分口径计算抢杠胡的输赢，并把赔付责任只归到被抢的加杠者身上。
- **双端协作**：抢杠胡成立 → 服务端按放铳口径算分 → 把赔付方确定为被抢的加杠者 → 下发结算 → 客户端显示该加杠者赔付。
- **业务行为**：
  - trigger：抢杠胡成立并进入本局结算
  - condition：这次胡牌的牌张来自被抢者加杠时亮出的第 4 张
  - action：客户端在结算中把被抢的加杠者显示为赔付方并按点炮口径呈现输赢；服务端按放铳口径算分并把赔付责任只归到被抢的加杠者
  - result：结算中由被抢的加杠者按点炮标准赔分给抢杠胡的玩家
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：该原子要求「抢杠胡只由被抢的加杠者按放铳赔付」，属服务端结算归责与算分口径；但统一原子视图中服务端无任何证据（applicability 为空、evidenceIds 为空、无矛盾证据），客户端亦无证据，无法判定实现符合性，按证据不足归为未验证。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）。

### AT-ST-C12-013 抢杠胡其他人不赔付

- 所属功能点：FP-ST-C12-003 抢杠胡（PRD 第 167 行）
- **需求规则**：抢杠胡其他人不付。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 列有本原子。实现要点（需求口径，非实现事实）：客户端在结算中不给除被抢加杠者以外的玩家标记任何赔付或扣分；无 CLE 证据，无 `file:line` 可定位。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空；无 atomIds 含 C12 的 SVE 证据。`configCondition` 为空，本原子未登记开关。需求口径为：服务端把抢杠胡的赔付范围限定为被抢的加杠者一人，其余玩家不参与此次赔付。
- **双端协作**：抢杠胡成立 → 服务端只把被抢加杠者纳入赔付方 → 其他玩家输赢分不因这次抢杠胡变化 → 下发结算 → 客户端显示其余玩家无需赔付。
- **业务行为**：
  - trigger：抢杠胡进入本局结算
  - condition：这次胡牌的牌张来自被抢的加杠者的第 4 张
  - action：客户端不给其他玩家标记赔付或扣分；服务端把赔付范围限定为被抢的加杠者一人
  - result：抢杠胡只由被抢的加杠者付分，桌上其他玩家都不为这次抢杠胡付分
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：该原子要求「抢杠胡其他人不付」，属服务端结算范围裁决；但统一原子视图中服务端无任何证据（applicability 为空、evidenceIds 为空、无矛盾证据），客户端亦无证据，无法判定实现符合性，按证据不足归为未验证。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）。

## 证据索引

本阶段 13 个原子在统一原子视图中均未挂证据：`clientEvidenceIds` 与 `serverEvidenceIds` 全为空，`trace_index.json` 对 AT-ST-C12-001 ~ 013 全部记录 `evidenceCount=0`。`client-evidence.json` 全量 12 条 CLE 证据的 atomIds 均属 AT-ST-C01 系列；`server-evidence.json` 全量 60 条 SVE 证据的 atomIds 全部落在 AT-ST-C01-001~029，无任何 atomIds 含 C12 的条目。下表仅列出复核说明中跨原子引用、可作为后续补证线索的条目，均**不属于本阶段原子级证据**。

| 证据 id | layer | file:line | claimKey | 引用位置（复核） | 说明 |
|---|---|---|---|---|---|
| CLE-AT-ST-C01-005-02 | client_code | config/FanDefine.ts:637-638 | hu-result-label-dianpao | AT-ST-C12-009 | 仅把结算流水类型标注为「点炮胡 / 放炮」文本，不证明赔付归属 |
| CLE-AT-ST-C01-005-03 | client_code | layer/comp/BoxHzmjResultMid.ts:719-737 | result-hu-type-tab | AT-ST-C12-009 | 仅按 `hu_type` 切自摸/点炮结果页签，不证明赔付归属 |
| SVE-AT-ST-C01-005-01 | common_game | common_game/com_game/common_game_com_action.cpp:353-358 | banker-discard-hu-requires-three-level | AT-ST-C12-006 / 007 | `BoxHuStep::CanDiscardHu` 关闭 `enable_banker_discard_hu` 或 `BankerLevel<3` 返回 false；覆盖三牢门槛，不覆盖牌型合法与反向（闲打庄胡） |
| SVE-AT-ST-C01-005-02 | hzmj_server | hzmj_server/game_logic.cpp:60-63 | banker-discard-hu-json-key | AT-ST-C12-005（间接） | `LoadBoxJsonConfig` 将 `enable_banker_discard_hu` 描述为「庄闲放铳，仅三牢时庄闲可互相点炮」，仅说明配置键语义 |
| SVE-AT-ST-C01-005-03 | hzmj_server | hzmj_server/server_config.cpp:19 | banker-discard-hu-default-on | AT-ST-C12-005（间接） | `ServerConfig::InitConfigByBox` 中 `SetEnableBankerDiscardHu(true)`，仅说明好友房默认开启 |

补充说明：

- 自摸四原子（AT-ST-C12-001 ~ 004）无任何可引用的相邻证据；复核说明明确现网证据不覆盖摸牌后/补牌后/起手第 14 张的出牌前判定与 4 面子+1 对子结构校验。
- 抢杠胡四原子（AT-ST-C12-010 ~ 013）无任何可引用的相邻证据；复核说明明确现网证据不覆盖抢杠开放条件、第 4 张代入校验与赔付归责。
- CLE-AT-ST-C01-005-02 的依赖文件含 `layer/comp/BoxHzmjResultMid.ts`、`layer/BoxHzmjResultView.ts`；CLE-AT-ST-C01-005-03 的依赖文件含 `config/GameDefine.ts`、`interface/BoxHzmjResultTypes.ts`，均为结算展示链路，与本阶段的成立判定与赔付归责不同层级。

## 待处理事项

### 待验证（规则待验证，补证 both）

`pending-list.md` 中本阶段共 13 条，问题类型均为「规则待验证」，建议动作均为「补证 both」。

| atomId | 验证范围 | 说明 | 建议动作 |
|---|---|---|---|
| AT-ST-C12-001 | server | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C12-002 | server | 证据不足 | 补证 both |
| AT-ST-C12-003 | server | 证据不足 | 补证 both |
| AT-ST-C12-004 | server | 证据不足 | 补证 both |
| AT-ST-C12-005 | server | 证据不足 | 补证 both |
| AT-ST-C12-006 | server | 证据不足 | 补证 both |
| AT-ST-C12-007 | server | 证据不足 | 补证 both |
| AT-ST-C12-008 | server | 证据不足 | 补证 both |
| AT-ST-C12-009 | server | 证据不足 | 补证 both |
| AT-ST-C12-010 | server | 证据不足 | 补证 both |
| AT-ST-C12-011 | server | 证据不足 | 补证 both |
| AT-ST-C12-012 | server | 证据不足 | 补证 both |
| AT-ST-C12-013 | server | 证据不足 | 补证 both |

查证未完成（必要端缺口）：本阶段 0 条。13 个原子 `analysisPath` 全为 `full`，`l7-classify.json` 的 `blockedAtoms` 为空，不存在 pending/timeout/failed 导致的阻塞，故 13 条均按「证据不足」而非「查证未完成」处理。
需策划裁决：本阶段 0 条。
冲突（conflict）：本阶段 0 条；13 个原子均无与需求相反的证据，不立 conflict。
升级原子：本阶段 0 条（`candidateDifference` 全空，无「历史基线 + 本轮候选」情形）。

### 待审批建议（reviewStatus=pending，未生效）

| atomId | 建议差异 | 复核规则 | 状态 |
|---|---|---|---|
| AT-ST-C12-001 | unverified | evidence-is-not-consistency（本片 13 个原子双端证据均为零，缺证只能维持 unverified，不得据此判 consistent/partial；同时无矛盾证据，也不升级 conflict） | pending / 未生效 |

说明：该建议仅覆盖 AT-ST-C12-001，`reviewedDifference=unverified` 与当前生效的 `previousDifference=unverified` 一致；`evidenceScopes` 为空。审批动作（approve/reject/hold）后不改变该原子 L7 结论。其余 12 个原子 `reviewStatus=none`，无复核建议。

### 补证方向（供后续取证参考，非结论）

- 自摸时机（001-003）：需服务端在常规摸牌、杠后补牌、庄家起手第 14 张三处进入胡牌判定的入口证据（判定调用点与「出牌后不再接受自摸」的状态位），以及客户端「自摸胡」按钮的显隐与提交链路证据。
- 自摸结构与时序（004）：需服务端 4 组面子加 1 组对子的结构校验实现，以及本轮出牌状态的校验点。
- 庄闲放铳（005-009）：需证明本期只启用庄闲放铳一种形式的证据（是否存在其他点炮玩法开关或其恒关），三牢 + 一庄一闲 + 牌型合法三项的校验代码，以及结算中赔付方唯一指向放铳者的算分证据。
- 抢杠胡（010-013）：需加杠流程中开放抢杠的判定点（三牢 + 一庄一闲）、第 4 张代入响应者手牌做胡牌校验的代码，以及结算中赔付范围仅含被抢加杠者的证据。
