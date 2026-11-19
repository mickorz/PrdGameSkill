# ST-C08 发牌

## 阶段概述

本阶段规定开局发牌的起点与方向、逐轮发牌的张数与轮次、庄家额外补发一张后的各家最终手牌数与牌墙余量，以及庄家凭 14 张直接进入首轮时的起手自摸提示与爆头、七客判断口径。

- 原子数：8（AT-ST-C08-001 ~ AT-ST-C08-008），分属 3 个功能点：FP-ST-C08-001 发牌起点与发牌轮次（001-003）、FP-ST-C08-002 庄家补牌与牌数总量（004-005）、FP-ST-C08-003 庄家首轮与起手自摸判断（006-008）。
- L7 分布：verified 0 / verification_required 8 / decision_required 0 / not_applicable 0。8 个原子 `l7Basis` 全部为 `proposed`，`scope=unknown`、`scopeSource=default-unknown`。
- analysisPath 分布：8 个原子全部为 `full`，无 `blocked`、无 `conflict-fast`；`candidateDifference` 全为空（无升级原子），`l7-classify.json` 的 `blockedAtoms` 为空。故本阶段不存在「查证未完成」与「需求 vs 实际冲突」两类情形。
- 取证现况：本阶段 8 个原子在统一原子视图中双端字段均为空（`clientVerification.verdict` 空、`serverVerification.applicability` 空、两端 `evidenceIds` 空、`configCondition` 空），`difference` 一律为 `unverified`。`client-evidence.json` 共 12 条 CLE，`atomIds` 全部指向 `AT-ST-C01-002/003/004/005`，无一条归属 ST-C08（本阶段 8 个原子只列在 `coverage.pendingAtomIds`）；`server-evidence.json` 共 60 条 SVE，同样无 `atomIds` 指向 `AT-ST-C08-*`；`trace_index.json` 本阶段 8 条记录的 `evidenceCount` 均为 0。
- 复核建议：AT-ST-C08-001 / 006 / 007 存在 `reviewStatus=pending` 的复核建议，`reviewedDifference` 均为 `unverified`（与当前生效差异一致），**尚未生效**。
- 需求原文行号（`trace_index.json.sourceLines`）：发牌起点与方向 = PRD 第 125 行；每人 4 张连发 3 轮 = 第 127 行；每人再补 1 张至 13 张 = 第 128 行；庄家额外补发 1 张与各家最终手牌数 = 第 129 行；庄家首轮与起手自摸、爆头七客 = 第 131 行。

| 原子 | 名称 | 验证范围 | difference | L7 | 复核 |
|---|---|---|---|---|---|
| AT-ST-C08-001 | 发牌起点与方向 | both | unverified | verification_required | pending / unverified |
| AT-ST-C08-002 | 每人四张连发三轮 | server | unverified | verification_required | 无 |
| AT-ST-C08-003 | 每人再补一张至十三张 | server | unverified | verification_required | 无 |
| AT-ST-C08-004 | 庄家额外补发一张 | server | unverified | verification_required | 无 |
| AT-ST-C08-005 | 各家最终手牌数 | server | unverified | verification_required | 无 |
| AT-ST-C08-006 | 庄家用十四张直接进入首轮 | both | unverified | verification_required | pending / unverified |
| AT-ST-C08-007 | 理牌后起手自摸提示 | both | unverified | verification_required | pending / unverified |
| AT-ST-C08-008 | 爆头七客按其余十三张判断 | server | unverified | verification_required | 无 |

## 需求条目

### AT-ST-C08-001 发牌起点与方向

- 所属功能点：FP-ST-C08-001 发牌起点与发牌轮次（PRD 第 125 行）
- **需求规则**：从牌墙头部、庄家起、按逆时针方向发牌。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerification.verdict` 为空、`clientEvidenceIds` 为空，客户端未给出结论；`client-evidence.json` 共 12 条 CLE 的 `atomIds` 全部挂 `AT-ST-C01-*`，本原子仅出现在 `coverage.pendingAtomIds`，无本阶段 CLE 证据。实现要点（需求口径）：客户端只把服务端下发到本家的牌依次呈现，玩家在发牌阶段无需任何操作，不参与取牌顺序或方向的决策。证据定位：无（`evidenceCount=0`）；复核引用的相邻条目 CLE-AT-ST-C01-002-02（`config/GameDefine.ts:4-7`，claimKey=`er-ren-room-gameid`，二人房 gameId 定义）与 CLE-AT-ST-C01-002-03（`config/GameDefine.ts:271-279`，claimKey=`seat-count-map-2-3`，2/3 人座次映射）只涉房间类型与座次映射，不覆盖发牌起点或轮转方向。
- **服务端职责**：`serverVerification.applicability` 为空、`serverEvidenceIds` 为空，服务端未给出适用性判定；`server-evidence.json` 60 条 SVE 的 `atomIds` 全部为 `AT-ST-C01-*`，无一条覆盖取牌顺序或牌墙头部起点。规则说明（需求口径）：由服务端从牌墙最前端开始取牌，先发给庄家，再沿逆时针方向依次发给下一家；`configCondition` 为空，未登记任何开关或配置生效条件。证据定位：无；复核引用的 SVE-AT-ST-C01-004-01（`common_game/com_game/common_game_com_ju.cpp:132-136`，claimKey=`banker-level-applied-at-ding-zhuang`，`BoxZhuangStep::JudgeDingZhuang` 定庄与牢庄等级）、SVE-AT-ST-C01-003-01（`common_game/com_game/common_game_com_ju.cpp:226-248`，claimKey=`cai-shen-type-behavior`，`BoxJokerStep::Execute` 财神翻开）、SVE-AT-ST-C01-024-06（`common_game/common_game_logic.cpp:65-73`，claimKey=`box-config-load-call-chain`，`CommonGameLogic::OnGameStart` 配置装载）均止于定庄、翻财神与建桌初始化，未覆盖发牌取牌顺序。
- **双端协作**：一局开始 → 服务端以庄家为起点按逆时针顺序逐张取牌下发 → 各端收到并展示自己的手牌。
- **业务行为**：
  - trigger：一局牌局开始并进入发牌环节
  - condition：无附加前提，开局发牌即按此顺序执行；适用玩法为杭州麻将好友房
  - action：客户端把发到本家的牌依次呈现给玩家，玩家在发牌阶段无需任何操作；服务端从牌墙最前端开始取牌，先发给庄家，再沿逆时针方向依次发给下一家
  - result：玩家看到的发牌是先庄家、再逆时针依次轮转，每人都拿到属于自己的牌
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空（无升级候选）。
  `baselineDetail`：该原子在统一原子视图中客户端与服务端均无证据（客户端判定为空、证据为空，服务端适用性与证据均为空，无矛盾证据），只有需求描述，无法核对实际发牌起点与方向，按证据不足归为未验证。
  待审批建议：unverified（`no-server-evidence-is-not-conflict`：双端均无发牌顺序证据，属取证空缺，不升级 conflict，也不得判 consistent）。该建议未生效（`reviewStatus=pending`）。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（依据 `effectiveDifference=unverified` 提议；`scope=unknown`，`scopeSource=default-unknown`）。

### AT-ST-C08-002 每人四张连发三轮

- 所属功能点：FP-ST-C08-001 发牌起点与发牌轮次（PRD 第 127 行）
- **需求规则**：每人 4 张，发 3 轮，各 12 张。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerification.verdict` 为空、`clientEvidenceIds` 为空；本原子验证范围仅为服务端发牌轮次规则，客户端展示方式不作为判定依据。实现要点（需求口径）：客户端只随每轮下发增量展示手牌数量变化，不参与轮次编排。证据定位：无本阶段 CLE 证据（`client-evidence.json` 无 C08 条目）。
- **服务端职责**：`serverVerification.applicability` 为空、`serverEvidenceIds` 为空，服务端未给出适用性判定，亦无逐轮发牌张数/轮次的实现证据。规则说明（需求口径）：服务端按逆时针顺序每轮给每人发 4 张，连发 3 轮，共 12 张。`configCondition` 为空，未登记任何配置生效条件。证据定位：无（`server-evidence.json` 无 `AT-ST-C08-*` 的 `atomIds`）。
- **双端协作**：发牌开始 → 服务端按逆时针顺序分 3 轮、每轮每人 4 张下发 → 各端手牌数量随之增加。
- **业务行为**：
  - trigger：发牌开始并进入逐轮发牌阶段
  - condition：发牌尚未完成 12 张的分配；本项验证范围为服务端发牌规则
  - action：服务端按逆时针顺序每轮给每人发 4 张，连发 3 轮，共 12 张；客户端展示方式不作为判定依据
  - result：玩家在发完这三轮后手上各有 12 张牌
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空（无升级候选）。
  `baselineDetail`：本原子验证范围为服务端，但统一原子视图中服务端适用性与证据均为空、无矛盾证据，无法核对是否按每轮 4 张连发 3 轮，按证据不足归为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`，`default-unknown`）。

### AT-ST-C08-003 每人再补一张至十三张

- 所属功能点：FP-ST-C08-001 发牌起点与发牌轮次（PRD 第 128 行）
- **需求规则**：再每人 1 张，各 13 张。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerification.verdict` 为空、`clientEvidenceIds` 为空；本原子验证范围仅为服务端发牌规则，客户端展示方式不作为判定依据。实现要点（需求口径）：客户端在补发到 13 张后进入理牌与等待行动状态，不参与补发顺序决策。证据定位：无本阶段 CLE 证据。
- **服务端职责**：`serverVerification.applicability` 为空、`serverEvidenceIds` 为空，无补发阶段实现证据。规则说明（需求口径）：三轮各 4 张发完后，服务端再按逆时针顺序给每人补发 1 张。`configCondition` 为空，未登记任何配置生效条件。证据定位：无。
- **双端协作**：三轮发完 → 服务端按逆时针顺序为每人各补 1 张 → 各端手牌再增加 1 张。
- **业务行为**：
  - trigger：三轮各 4 张发完后继续发牌
  - condition：所有玩家都已持有 12 张牌；本项验证范围为服务端发牌规则
  - action：服务端再按逆时针顺序给每人补发 1 张；客户端展示方式不作为判定依据
  - result：玩家此时手上各有 13 张牌
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空（无升级候选）。
  `baselineDetail`：本原子验证范围为服务端，但统一原子视图中服务端适用性与证据均为空、无矛盾证据，无法核对是否按逆时针给每人补 1 张至 13 张，按证据不足归为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`，`default-unknown`）。

### AT-ST-C08-004 庄家额外补发一张

- 所属功能点：FP-ST-C08-002 庄家补牌与牌数总量（PRD 第 129 行）
- **需求规则**：再给庄家 1 张。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerification.verdict` 为空、`clientEvidenceIds` 为空；本原子验证范围仅为服务端补发规则，客户端展示方式不作为判定依据。实现要点（需求口径）：客户端只按服务端下发的最终手牌数呈现庄家比闲家多一张的结果。证据定位：无本阶段 CLE 证据。
- **服务端职责**：`serverVerification.applicability` 为空、`serverEvidenceIds` 为空，无「仅庄家补发」的实现证据。规则说明（需求口径）：在每人 13 张的基础上，服务端只再给庄家补发 1 张牌，闲家不再补发；`configCondition` 为空，未登记任何配置生效条件（如人数或房型差异化均未登记）。证据定位：无。
- **双端协作**：各家人手 13 张 → 服务端只向庄家再多发 1 张 → 庄家手牌比闲家多出 1 张。
- **业务行为**：
  - trigger：每人各拿到 13 张后发牌继续
  - condition：该家身份为庄家；本项验证范围为服务端发牌规则
  - action：服务端只再给庄家补发 1 张牌，闲家不再补发；客户端展示方式不作为判定依据
  - result：玩家看到庄家比三名闲家各多 1 张手牌
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空（无升级候选）。
  `baselineDetail`：本原子验证范围为服务端，但统一原子视图中服务端适用性与证据均为空、无矛盾证据，无法核对是否仅为庄家补发 1 张，按证据不足归为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`，`default-unknown`）。

### AT-ST-C08-005 各家最终手牌数

- 所属功能点：FP-ST-C08-002 庄家补牌与牌数总量（PRD 第 129 行）
- **需求规则**：庄家 14 张，三名闲家各 13 张，共发出 53 张，余 83 张。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerification.verdict` 为空、`clientEvidenceIds` 为空；本原子验证范围仅为服务端发牌数量结果，客户端展示方式不作为判定依据。实现要点（需求口径）：客户端按服务端下发的牌张结果展示庄家 14 张、闲家各 13 张，不自行计算牌墙余量。证据定位：无本阶段 CLE 证据。
- **服务端职责**：`serverVerification.applicability` 为空、`serverEvidenceIds` 为空，无手牌张数、已发张数与牌墙余量的实现证据。规则说明（需求口径）：服务端保证庄家手牌 14 张、三名闲家各 13 张，本局共发出 53 张，牌墙剩余 83 张供后续摸牌；`configCondition` 为空，未登记任何配置生效条件。证据定位：无。注：本条需与 AT-ST-C08-001/002/003/004 的取牌顺序、轮次与补发规则联动核对，单条张数成立不等同于全过程一致。
- **双端协作**：发牌结束后 → 服务端核对手牌数与已发张数 → 本局共发出 53 张、牌墙剩 83 张供后续摸牌。
- **业务行为**：
  - trigger：发牌环节结束、进入本局行牌前
  - condition：四人房且庄家已完成额外补发；本项验证范围为服务端发牌结果
  - action：服务端保证庄家手牌 14 张、三名闲家各 13 张，本局共发出 53 张，牌墙剩余 83 张；客户端展示方式不作为判定依据
  - result：玩家看到庄家 14 张、闲家各 13 张，牌墙还剩下 83 张牌继续对局
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空（无升级候选）。
  `baselineDetail`：本原子验证范围为服务端，但统一原子视图中服务端适用性与证据均为空、无矛盾证据，无法核对各家手牌张数、已发 53 张与余 83 张是否符合需求，按证据不足归为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`，`default-unknown`）。

### AT-ST-C08-006 庄家用十四张直接进入首轮

- 所属功能点：FP-ST-C08-003 庄家首轮与起手自摸判断（PRD 第 131 行）
- **需求规则**：庄家用这 14 张直接进入首轮，不再摸牌。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerification.verdict` 为空、`clientEvidenceIds` 为空；`client-evidence.json` 中与本原子可能相关的 CLE-AT-ST-C01-003-03（`controller/cmd/gameCmd/GameJokerCmd.ts:74-77`，claimKey=`cai-shen-type-room-rule`，财神白板判定与动效）与 CLE-AT-ST-C01-005-03（`layer/comp/BoxHzmjResultMid.ts:719-737`，claimKey=`result-hu-type-tab`，结算页自摸/点炮胡页签）均不涉及首轮摸牌动作的呈现或缺失。实现要点（需求口径）：客户端在庄家回合直接呈现可出牌状态，不做摸牌动作表现。证据定位：无本阶段 CLE 证据。
- **服务端职责**：`serverVerification.applicability` 为空、`serverEvidenceIds` 为空，无「首轮跳过摸牌」的回合推进证据。规则说明（需求口径）：服务端不再为庄家执行首轮摸牌，直接以现有 14 张手牌等待庄家出牌；`configCondition` 为空，未登记任何配置生效条件。证据定位：无；复核引用的 SVE-AT-ST-C01-004-01（`common_game/com_game/common_game_com_ju.cpp:132-136`）、SVE-AT-ST-C01-004-02（`common_game/com_game/common_game_com_ju.cpp:191-196`，claimKey=`banker-level-type-to-level-mapping`）与 SVE-AT-ST-C01-024-06（`common_game/common_game_logic.cpp:65-73`）只到定庄、牢庄等级换算与开局建桌初始化阶段，未覆盖回合推进。
- **双端协作**：发牌结束 → 服务端判定轮到庄家且已有 14 张 → 直接下发庄家可出牌状态 → 客户端让庄家出牌，不出现摸牌。
- **业务行为**：
  - trigger：发牌完成、轮到庄家行动
  - condition：庄家手上已有 14 张牌
  - action：客户端在庄家回合直接呈现可出牌状态、不做摸牌动作表现；服务端不再为庄家执行首轮摸牌，直接以现有 14 张手牌等待庄家出牌
  - result：玩家看到庄家一开局就能直接出牌，首轮没有摸牌环节
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空（无升级候选）。
  `baselineDetail`：该原子在统一原子视图中客户端与服务端均无证据（客户端判定为空、证据为空，服务端适用性与证据均为空，无矛盾证据），无法核对庄家首轮是否跳过摸牌，按证据不足归为未验证。
  待审批建议：unverified（`no-server-evidence-is-not-conflict`：服务端仅覆盖定庄与建桌初始化，未覆盖首轮摸牌推进，缺证据不等于冲突）。该建议未生效（`reviewStatus=pending`）。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`，`default-unknown`）。

### AT-ST-C08-007 理牌后起手自摸提示

- 所属功能点：FP-ST-C08-003 庄家首轮与起手自摸判断（PRD 第 131 行）
- **需求规则**：理牌后若已满足自摸，立即给出【自摸】【过】。
- **验证范围**：both（`verificationScope=both`）；UI 需求原文：满足自摸时立即给出【自摸】【过】两个按钮供玩家选择。
- **客户端职责**：`clientVerification.verdict` 为空、`clientEvidenceIds` 为空；`client-evidence.json` 12 条中唯一涉及按钮/选项的 CLE-AT-ST-C01-005-03（`layer/comp/BoxHzmjResultMid.ts:719-737`，claimKey=`result-hu-type-tab`，`BoxHzmjResultMid._updateHuType` 结算界面胡型选中项）与起手自摸提示无关。实现要点（需求口径）：客户端在庄家出牌前立即弹出【自摸】【过】两个按钮，并把玩家选择提交服务端。证据定位：无本阶段 CLE 证据，【自摸】【过】按钮的存在与弹出时机均无证据支持。
- **服务端职责**：`serverVerification.applicability` 为空、`serverEvidenceIds` 为空，无起手自摸选择机会下发的证据。规则说明（需求口径）：服务端在庄家回合先给出自摸选择机会，玩家选【自摸】则按自摸结算本局、选【过】则继续正常出牌；`configCondition` 为空，未登记任何配置生效条件。证据定位：无；复核引用的 SVE-AT-ST-C01-005-01（`common_game/com_game/common_game_com_action.cpp:353-358`，claimKey=`banker-discard-hu-requires-three-level`，`BoxHuStep::CanDiscardHu` 受 `enable_banker_discard_hu` 与 `banker_level>=3` 约束）只证明点炮胡的可胡判定前提，不证明庄家起手会下发【自摸】【过】选择机会。
- **双端协作**：庄家理牌完成 → 服务端判断这 14 张可自摸并下发选择机会 → 客户端弹出【自摸】【过】→ 选【自摸】进入自摸结算，选【过】回到出牌。
- **业务行为**：
  - trigger：庄家完成理牌、准备出牌
  - condition：庄家这 14 张手牌已满足自摸条件
  - action：客户端在庄家出牌前立即弹出【自摸】【过】两个按钮供玩家选择；服务端在庄家回合先给出自摸选择机会，选【自摸】按自摸结算本局、选【过】继续正常出牌
  - result：玩家在起手可自摸时马上看到【自摸】【过】按钮，可自摸结束本局或点过继续出牌
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空（无升级候选）。
  `baselineDetail`：该原子在统一原子视图中客户端与服务端均无证据（客户端判定为空、证据为空，服务端适用性与证据均为空，无矛盾证据），无法核对起手自摸时是否立即给出【自摸】【过】，按证据不足归为未验证。
  待审批建议：unverified（`evidence-is-not-consistency`：客户端缺失【自摸】【过】按钮证据，证据不足不能判 consistent）。该建议未生效（`reviewStatus=pending`）。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`，`default-unknown`）。

### AT-ST-C08-008 爆头七客按其余十三张判断

- 所属功能点：FP-ST-C08-003 庄家首轮与起手自摸判断（PRD 第 131 行）
- **需求规则**：爆头、七客按其余 13 张判断。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerification.verdict` 为空、`clientEvidenceIds` 为空；本原子验证范围仅为服务端判断口径，客户端展示方式不作为判定依据。实现要点（需求口径）：客户端只接收爆头、七客是否成立的结果并据此展示自摸可能性，不自行按 14 张推算。证据定位：无本阶段 CLE 证据。
- **服务端职责**：`serverVerification.applicability` 为空、`serverEvidenceIds` 为空，无爆头/七客判定取张范围的实现证据。规则说明（需求口径）：服务端以庄家除那一张多余牌之外的其余 13 张为准判断爆头、七客是否成立，判定结果再进入起手自摸判断；`configCondition` 为空，未登记任何配置生效条件。证据定位：无。
- **双端协作**：庄家起手 14 张 → 服务端仅取其中 13 张做爆头、七客判定 → 判定结果进入起手自摸判断。
- **业务行为**：
  - trigger：庄家起手进入自摸相关判断
  - condition：庄家持有 14 张且需判断是否构成爆头或七客；本项验证范围为服务端判断规则
  - action：服务端以庄家除那一张多余牌之外的其余 13 张为准判断爆头、七客是否成立；客户端展示方式不作为判定依据
  - result：玩家起手看到的爆头、七客是否成立，按其余 13 张的口径决定，并影响能否立刻自摸
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空（无升级候选）。
  `baselineDetail`：本原子验证范围为服务端，但统一原子视图中服务端适用性与证据均为空、无矛盾证据，无法核对爆头、七客是否按其余 13 张判断，按证据不足归为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`，`default-unknown`）。

## 证据索引

本阶段 8 个原子没有任何一条 CLE / SVE 证据直接归属（`client-evidence.json`、`server-evidence.json` 中均无 `AT-ST-C08-*` 的 `atomIds`，`trace_index.json` 全部 `evidenceCount=0`）。下表仅列出复核建议中作为「相邻参考」被引用、但不构成 ST-C08 证据的条目，供后续补证时避免重复排查。

| 证据 id | layer | file:line | claimKey | 被引用原子 | 说明（不构成本阶段证据） |
|---|---|---|---|---|---|
| CLE-AT-ST-C01-002-02 | client_code | config/GameDefine.ts:4-7 | er-ren-room-gameid | AT-ST-C08-001 | 二人房 gameId 常量，不涉发牌起点与方向 |
| CLE-AT-ST-C01-002-03 | client_code | config/GameDefine.ts:271-279 | seat-count-map-2-3 | AT-ST-C08-001 | 2/3 人座次映射，不含轮转方向 |
| CLE-AT-ST-C01-004-03 | client_code | controller/cmd/gameCmd/GameJuDataCmd.ts:34-35 | lian-zhuang-level-from-room-config | AT-ST-C08-001 | 从创房配置推导牢庄等级，与发牌无关 |
| CLE-AT-ST-C01-004-04 | client_code | data/GameData.ts:1664-1666 | banker-level-multiplier | AT-ST-C08-001 | 庄闲倍数换算，与发牌无关 |
| CLE-AT-ST-C01-003-03 | client_code | controller/cmd/gameCmd/GameJokerCmd.ts:74-77 | cai-shen-type-room-rule | AT-ST-C08-006 | 财神白板判定与动效，不涉首轮摸牌呈现 |
| CLE-AT-ST-C01-005-03 | client_code | layer/comp/BoxHzmjResultMid.ts:719-737 | result-hu-type-tab | AT-ST-C08-006、AT-ST-C08-007 | 结算页胡型页签，不涉【自摸】【过】起手提示 |
| SVE-AT-ST-C01-004-01 | common_game | common_game/com_game/common_game_com_ju.cpp:132-136 | banker-level-applied-at-ding-zhuang | AT-ST-C08-001、AT-ST-C08-006 | `BoxZhuangStep::JudgeDingZhuang` 定庄与牢庄等级，不涉取牌顺序 |
| SVE-AT-ST-C01-004-02 | common_game | common_game/com_game/common_game_com_ju.cpp:191-196 | banker-level-type-to-level-mapping | AT-ST-C08-006 | 牢庄等级换算，不涉回合推进 |
| SVE-AT-ST-C01-003-01 | common_game | common_game/com_game/common_game_com_ju.cpp:226-248 | cai-shen-type-behavior | AT-ST-C08-001 | `BoxJokerStep::Execute` 财神翻开，不涉牌墙取牌起点 |
| SVE-AT-ST-C01-024-06 | common_game | common_game/common_game_logic.cpp:65-73 | box-config-load-call-chain | AT-ST-C08-001、AT-ST-C08-006 | `CommonGameLogic::OnGameStart` 配置装载链，止于建桌初始化 |
| SVE-AT-ST-C01-005-01 | common_game | common_game/com_game/common_game_com_action.cpp:353-358 | banker-discard-hu-requires-three-level | AT-ST-C08-007 | `BoxHuStep::CanDiscardHu` 点炮胡前置条件，不涉起手自摸选择 |

## 待处理事项

### 待验证（规则待验证，补证 both）

`pending-list.md` 中本阶段共 8 条，问题类型均为「规则待验证」，建议动作均为「补证 both」；其中 001 / 006 / 007 三条另带「另有待审批复核建议：unverified」。

| atomId | 验证范围 | 说明 | 建议动作 |
|---|---|---|---|
| AT-ST-C08-001 | both | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C08-002 | server | 证据不足 | 补证 both |
| AT-ST-C08-003 | server | 证据不足 | 补证 both |
| AT-ST-C08-004 | server | 证据不足 | 补证 both |
| AT-ST-C08-005 | server | 证据不足 | 补证 both |
| AT-ST-C08-006 | both | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C08-007 | both | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C08-008 | server | 证据不足 | 补证 both |

查证未完成（必要端缺口）：本阶段 0 条（`analysisPath` 全为 `full`，无 pending/timeout/failed 导致的阻塞，`blockedAtoms` 为空）。
需策划裁决（decision_required）：本阶段 0 条。
升级原子（有 `candidateDifference`）：本阶段 0 条。

### 待审批建议（reviewStatus=pending，均未生效）

`difference-review.json` 中本阶段 3 条复核记录 `reviewStatus` 均为 `pending`，`reviewedDifference` 均为 `unverified`（与当前生效差异一致），`candidateDifference` 为空，`evidenceScopes` 为空。

| atomId | 建议差异 | 复核规则 | 状态 |
|---|---|---|---|
| AT-ST-C08-001 | unverified | no-server-evidence-is-not-conflict（双端均无发牌顺序证据，属取证空缺：不升级 conflict，也不得判 consistent） | pending / 未生效 |
| AT-ST-C08-006 | unverified | no-server-evidence-is-not-conflict（服务端仅覆盖定庄与建桌初始化，未覆盖首轮摸牌推进，缺证据不等于冲突） | pending / 未生效 |
| AT-ST-C08-007 | unverified | evidence-is-not-consistency（客户端缺失【自摸】【过】按钮证据，证据不足不能判 consistent） | pending / 未生效 |

建议动作：审批（approve / reject / hold）。3 条建议获批后差异口径仍为 `unverified`，L7 维持 `verification_required`。

### 补证方向（供后续取证参考，非结论）

- 发牌起点与方向（001）：需服务端取牌链路的直接证据，重点在牌墙头部游标、首发给庄家的座位计算、以及逆时针（座位号递增方向）遍历顺序；客户端需补本家手牌增量渲染，但该方向本身不由客户端决定。
- 发牌轮次与张数（002-005）：需服务端「每轮每人 4 张 × 3 轮 → 每人补 1 张 → 仅庄家补 1 张」的循环与计数实现，以及已发 53 张、牌墙余 83 张的统计口径证据；注意区分「发牌顺序常量」与「实际调用参数」。
- 庄家首轮与起手自摸（006-008）：需服务端首轮跳过摸牌的回合推进分支、起手自摸判定与【自摸】【过】选择机会下发、以及爆头/七客判定取 13 张的实现证据；客户端需补【自摸】【过】按钮的弹出时机与选项回收逻辑。
