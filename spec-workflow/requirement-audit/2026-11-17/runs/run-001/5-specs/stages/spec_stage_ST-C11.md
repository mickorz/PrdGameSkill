# ST-C11 杠后补牌

## 阶段概述

本阶段规定杠成立后从牌墙尾部补 1 张并扣减余牌、补牌后的自摸/续杠/出牌选择、杠的牌墙下限（少于 21 张不能杠）与剩 20 张及以下时下一次摸牌前黄庄，以及明杠/暗杠/加杠使杠链加 1、吃碰与打出非财神（或打出财神后不再敲响）使杠链归零的计数规则。

- 原子数：11（AT-ST-C11-001 ~ AT-ST-C11-011），分属 3 个功能点：FP-ST-C11-001 杠后补牌与后续摸打（001-004）、FP-ST-C11-002 杠的牌墙下限与黄庄（005-007）、FP-ST-C11-003 杠链累计与归零（008-011）。
- L7 分布：verified 0 / verification_required 11 / decision_required 0 / not_applicable 0。
- analysisPath 分布：11 个原子全部为 `full`，无 `blocked`、无 `conflict-fast`。
- 取证现状：本阶段 11 个原子在统一原子视图中双端字段全空（client `verdict` 空、server `applicability` 空、`evidenceIds` 空）；`2-client/client-evidence.json` 与 `3-server/scope-index.json` 的 `coverage.pendingAtomIds` 均包含本阶段全部 11 个原子；`trace_index.json` 中 11 条记录 `evidenceCount=0`、`reviewStatus=none`。现有 12 条 CLE 与 60 条 SVE 的 atomIds 全部归属 AT-ST-C01 系列，无一条指向 ST-C11。
- 定性口径：`analysisPath` 全为 `full`，`l7-classify.json` 的 `blockedAtoms` 为空，故本阶段**不适用**「查证未完成（pending/timeout/failed）」口径；差异一律按「证据不足（取证空缺）」判 `unverified`，**不编造**任何实现差异。
- 需求原文行号：001/002/005/007 = PRD 第 159 行；003/004/006/008/009/010/011 = PRD 第 161 行（来源 `trace_index.json` 的 `sourceLines`）。

| 原子 | 名称 | 验证范围 | difference | L7 |
|---|---|---|---|---|
| AT-ST-C11-001 | 从牌墙尾部补一张 | both | unverified | verification_required |
| AT-ST-C11-002 | 补牌后余牌减一 | server | unverified | verification_required |
| AT-ST-C11-003 | 补牌可以自摸 | both | unverified | verification_required |
| AT-ST-C11-004 | 不胡则续杠或打出一张 | both | unverified | verification_required |
| AT-ST-C11-005 | 牌墙少于二十一不能杠 | both | unverified | verification_required |
| AT-ST-C11-006 | 续杠重新检查牌墙 | both | unverified | verification_required |
| AT-ST-C11-007 | 剩二十张下一次摸牌前黄庄 | server | unverified | verification_required |
| AT-ST-C11-008 | 各类杠使杠链加一 | server | unverified | verification_required |
| AT-ST-C11-009 | 吃碰使杠链归零 | server | unverified | verification_required |
| AT-ST-C11-010 | 打出非财神使杠链归零 | server | unverified | verification_required |
| AT-ST-C11-011 | 打出财神后不再敲响使杠链归零 | both | unverified | verification_required |

## 需求条目

### AT-ST-C11-001 从牌墙尾部补一张

- 所属功能点：FP-ST-C11-001 杠后补牌与后续摸打（PRD 第 159 行）
- **需求规则**：每次杠从牌墙尾部补 1 张。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerification.verdict` 为空，客户端未给出结论；`clientVerification.evidenceIds` 为空，**无 CLE-id 与 file:line 可定位**（`client-evidence.json` 全部 12 条 CLE 的 atomIds 均属 AT-ST-C01 系列）。实现要点（需求口径，非现状结论）：客户端在杠成立后接收服务端补牌结果，把补到的这张牌并入本家手牌并按补牌表现呈现；取牌位置由服务端决定，客户端不从牌墙头另行摸牌、不自算补牌张数。
- **服务端职责**：`serverVerification.applicability` 为空，服务端未给出适用性判定；`serverVerification.evidenceIds` 为空，**无 SVE-id 与 file:line 可定位**（`server-evidence.json` 全部 60 条 SVE 中无 atomIds 含 C11 的记录）。规则说明（需求口径）：杠牌成立后从牌墙尾部取 1 张补给该玩家，取牌位置固定为尾部（杠尾）而非牌墙头。`configCondition` 为空，本口径未登记任何创房开关，即补牌张数与取牌位置不随配置变化。
- **双端协作**：玩家完成杠牌 → 服务端确认杠成立 → 服务端从牌墙尾部补一张牌给该玩家 → 下发补牌结果 → 客户端把补到的牌显示给玩家。
- **业务行为**：
  - trigger：轮到玩家行牌时完成一次杠牌（明杠、暗杠或加杠）
  - condition：该次杠牌成立并进入补牌环节
  - action：服务端在杠牌成立后从牌墙尾部取一张牌补给该玩家；客户端在收到结果后把补到的牌呈现在该玩家手上
  - result：玩家每杠一次，手上就会从牌墙尾部多补进一张牌
- **实际实现差异**：`difference=unverified`；无 `candidateDifference`。
  `baselineDetail`：该原子要求「每次杠从牌墙尾部补 1 张」，涉及客户端呈现与服务端补牌取牌位置两端；但统一原子视图中客户端与服务端均无任何证据（verdict 与 applicability 为空、evidenceIds 为空、无矛盾证据），无法判定实现是否符合需求，按证据不足归为未验证。
- **验证结论（L7）**：`verification_required`；`l7Basis=proposed`（`effectiveDifference=unverified`，`scope=unknown`，`scopeSource=default-unknown`，非 `pending-blocked`）。双端覆盖仍为 `pendingAtomIds`，实质查证未完成，故不给出「已符合/已差异」结论。

### AT-ST-C11-002 补牌后余牌减一

- 所属功能点：FP-ST-C11-001 杠后补牌与后续摸打（PRD 第 159 行）
- **需求规则**：每次杠补牌后牌墙余牌减 1。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerification.verdict` 为空、`clientVerification.evidenceIds` 为空，无 CLE-id 与 file:line 可定位。本原子验证范围在服务端，客户端不承担牌墙余量的计数与扣减，仅按服务端同步的对局状态更新剩余牌数展示。
- **服务端职责**：`serverVerification.applicability` 为空，未给出适用性判定；`serverVerification.evidenceIds` 为空，无 SVE-id 与 file:line 可定位。规则说明（需求口径）：每补出一张牌，牌墙剩余张数即减 1，使余量与牌墙实际消耗一致，并随对局状态同步给客户端。`configCondition` 为空，未登记开关。
- **双端协作**：杠牌成立 → 服务端从牌墙尾部补牌 → 牌墙余量同步减 1 → 余量随对局状态同步给客户端 → 客户端更新剩余牌数展示。
- **业务行为**：
  - trigger：玩家完成一次杠牌并触发补牌
  - condition：补牌实际发生
  - action：服务端每补出一张牌就把牌墙剩余张数减 1；客户端不自行维护余量，只展示服务端同步的剩余牌数
  - result：玩家每杠一次补牌，牌桌上显示的牌墙余牌就少一张，与实际消耗保持一致
- **实际实现差异**：`difference=unverified`；无 `candidateDifference`。
  `baselineDetail`：该原子要求「每次杠补牌后牌墙余牌减 1」，职责域为服务端牌墙计数；但统一原子视图中服务端无任何证据（applicability 为空、evidenceIds 为空、无矛盾证据），客户端亦无证据，无法判定实现是否符合需求，按证据不足归为未验证。
- **验证结论（L7）**：`verification_required`；`l7Basis=proposed`（`effectiveDifference=unverified`，`scope=unknown`，非 `pending-blocked`）；服务端覆盖仍 pending，查证未完成。

### AT-ST-C11-003 补牌可以自摸

- 所属功能点：FP-ST-C11-001 杠后补牌与后续摸打（PRD 第 161 行）
- **需求规则**：杠后补的牌可以自摸。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerification.verdict` 为空、`clientVerification.evidenceIds` 为空，无 CLE-id 与 file:line 可定位。实现要点（需求口径）：补牌后若可成胡，客户端需在该轮出牌前把「自摸胡」开放为可点操作，玩家点胡后提交胡牌请求；当前无证据证明该操作入口的放出逻辑已实现。
- **服务端职责**：`serverVerification.applicability` 为空、`serverVerification.evidenceIds` 为空，无 SVE-id 与 file:line 可定位。规则说明（需求口径）：杠后补到的这张牌须纳入胡牌判定，能成胡则在出牌前允许该玩家自摸并进入结算，即补牌来源不构成自摸禁手。`configCondition` 为空，未登记开关。
- **双端协作**：玩家杠牌 → 服务端从牌墙尾部补牌 → 服务端按补到的牌判定能否成胡 → 向该玩家下发可自摸提示 → 玩家点胡 → 服务端确认自摸成立 → 进入结算。
- **业务行为**：
  - trigger：玩家在杠牌后从牌墙补进一张牌
  - condition：补到的这张牌使整手牌满足自摸胡牌条件
  - action：服务端把补到的牌纳入胡牌判定并在成立时放行自摸；客户端在出牌前把「自摸胡」呈现为可点操作
  - result：玩家杠后补到能成胡的牌时，可以在出牌前直接自摸胡牌
- **实际实现差异**：`difference=unverified`；无 `candidateDifference`。
  `baselineDetail`：该原子要求「杠后补的牌可以自摸」，需要客户端呈现自摸操作、服务端放行自摸两端配合；但统一原子视图中客户端与服务端均无任何证据（verdict 与 applicability 为空、evidenceIds 为空、无矛盾证据），无法判定实现是否符合需求，按证据不足归为未验证。
- **验证结论（L7）**：`verification_required`；`l7Basis=proposed`（`effectiveDifference=unverified`，`scope=unknown`，非 `pending-blocked`）；双端覆盖仍 pending，查证未完成。

### AT-ST-C11-004 不胡则续杠或打出一张

- 所属功能点：FP-ST-C11-001 杠后补牌与后续摸打（PRD 第 161 行）
- **需求规则**：补牌后不胡牌时，可以继续杠，或打出 1 张牌。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerification.verdict` 为空、`clientVerification.evidenceIds` 为空，无 CLE-id 与 file:line 可定位。实现要点（需求口径）：补牌不胡时，客户端在该玩家回合只放出「继续杠」与「打出一张牌」两类操作，二者择一，不提供跳过（pass）入口。
- **服务端职责**：`serverVerification.applicability` 为空、`serverVerification.evidenceIds` 为空，无 SVE-id 与 file:line 可定位。规则说明（需求口径）：服务端只接受续杠请求或出牌请求来推进该回合；两者都未发生时不得直接跳过该玩家回合。`configCondition` 为空，未登记开关。
- **双端协作**：杠后补牌 → 没有胡牌 → 服务端等待该玩家选择 → 选择继续杠则再走一次杠与补牌流程，选择出牌则打出一张牌 → 服务端按选择推进牌局。
- **业务行为**：
  - trigger：玩家在杠后补牌后没有选择胡牌
  - condition：补到的这张牌没有被胡走，轮到该玩家继续操作
  - action：服务端只等待续杠请求或出牌请求来推进回合；客户端只提供「继续杠」与「打出一张牌」两种可选操作
  - result：杠后补牌不胡时，玩家只能继续杠或者打出一张牌，不能什么都不做直接过
- **实际实现差异**：`difference=unverified`；无 `candidateDifference`。
  `baselineDetail`：该原子要求「补牌不胡时可继续杠或打出一张牌」，既涉及客户端给出的可操作项，也涉及服务端对回合的放行；但统一原子视图中客户端与服务端均无任何证据（verdict 与 applicability 为空、evidenceIds 为空、无矛盾证据），无法判定实现是否符合需求，按证据不足归为未验证。
- **验证结论（L7）**：`verification_required`；`l7Basis=proposed`（`effectiveDifference=unverified`，`scope=unknown`，非 `pending-blocked`）；双端覆盖仍 pending，查证未完成。

### AT-ST-C11-005 牌墙少于二十一不能杠

- 所属功能点：FP-ST-C11-002 杠的牌墙下限与黄庄（PRD 第 159 行）
- **需求规则**：牌墙少于 21 张时不能杠。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerification.verdict` 为空、`clientVerification.evidenceIds` 为空，无 CLE-id 与 file:line 可定位。实现要点（需求口径）：客户端需按当前牌墙余量控制杠操作的可点状态，余量少于 21 张时不再放出杠操作，玩家只能走常规出牌路径。
- **服务端职责**：`serverVerification.applicability` 为空、`serverVerification.evidenceIds` 为空，无 SVE-id 与 file:line 可定位。规则说明（需求口径）：服务端以牌墙剩余张数少于 21 张为门槛，拒绝该次杠牌请求，门槛属硬校验而非仅靠客户端隐藏入口。`configCondition` 为空，未登记开关，即 21 张门槛不随创房配置变化。
- **双端协作**：玩家请求杠牌 → 服务端检查牌墙余量 → 余量少于 21 张则拒绝 → 客户端不再提供杠操作，玩家只能按常规方式出牌。
- **业务行为**：
  - trigger：玩家尝试杠牌
  - condition：牌墙剩余张数少于 21 张
  - action：服务端校验牌墙余量并在不足时拒绝杠请求；客户端在余量不足时不给该玩家可点的杠操作
  - result：牌墙剩不到 21 张时，玩家无法再杠牌
- **实际实现差异**：`difference=unverified`；无 `candidateDifference`。
  `baselineDetail`：该原子要求「牌墙少于 21 张时不能杠」，既涉及服务端拒绝杠牌，也涉及客户端不再给出杠操作；但统一原子视图中客户端与服务端均无任何证据（verdict 与 applicability 为空、evidenceIds 为空、无矛盾证据），无法判定实现是否符合需求，按证据不足归为未验证。
- **验证结论（L7）**：`verification_required`；`l7Basis=proposed`（`effectiveDifference=unverified`，`scope=unknown`，非 `pending-blocked`）；双端覆盖仍 pending，查证未完成。

### AT-ST-C11-006 续杠重新检查牌墙

- 所属功能点：FP-ST-C11-002 杠的牌墙下限与黄庄（PRD 第 161 行）
- **需求规则**：杠后可以继续杠，每次继续杠都重新检查牌墙不少于 21 张。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerification.verdict` 为空、`clientVerification.evidenceIds` 为空，无 CLE-id 与 file:line 可定位。实现要点（需求口径）：客户端需在每一次续杠前按当前牌墙余量重新决定是否放出杠操作，不能沿用第一次杠时的可用性判断。
- **服务端职责**：`serverVerification.applicability` 为空、`serverVerification.evidenceIds` 为空，无 SVE-id 与 file:line 可定位。规则说明（需求口径）：对每一次续杠都重新校验牌墙余量，不少于 21 张才放行，否则拒绝该次续杠，门槛按次检查而非按局一次性判定。`configCondition` 为空，未登记开关。
- **双端协作**：玩家第一次杠并补牌 → 再次请求杠牌 → 服务端重新检查牌墙余量 → 满足则放行并再次补牌，不满足则只允许出牌。
- **业务行为**：
  - trigger：玩家在杠后补牌阶段再次选择杠牌
  - condition：每次续杠前牌墙剩余张数不少于 21 张
  - action：服务端对每一次续杠重新检查牌墙余量并据此放行或拒绝；客户端按当前余量决定是否给出杠操作
  - result：玩家可以连续杠牌，但每继续杠一次都要重新看牌墙，余量不足的这一次续杠无法成立
- **实际实现差异**：`difference=unverified`；无 `candidateDifference`。
  `baselineDetail`：该原子要求「杠后可继续杠，每次续杠都重新检查牌墙不少于 21 张」，涉及客户端操作放出与服务端逐次校验；但统一原子视图中客户端与服务端均无任何证据（verdict 与 applicability 为空、evidenceIds 为空、无矛盾证据），无法判定实现是否符合需求，按证据不足归为未验证。
- **验证结论（L7）**：`verification_required`；`l7Basis=proposed`（`effectiveDifference=unverified`，`scope=unknown`，非 `pending-blocked`）；双端覆盖仍 pending，查证未完成。

### AT-ST-C11-007 剩二十张下一次摸牌前黄庄

- 所属功能点：FP-ST-C11-002 杠的牌墙下限与黄庄（PRD 第 159 行）
- **需求规则**：牌墙剩 20 张及以下时，在下一次摸牌前黄庄。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerification.verdict` 为空、`clientVerification.evidenceIds` 为空，无 CLE-id 与 file:line 可定位。本原子验证范围在服务端，客户端不参与流局判定，仅按服务端下发的本局结果展示黄庄终局与黄庄结算。
- **服务端职责**：`serverVerification.applicability` 为空、`serverVerification.evidenceIds` 为空，无 SVE-id 与 file:line 可定位。规则说明（需求口径）：牌墙仅剩 20 张及以下时，在下一次摸牌动作发生之前直接判定本局黄庄，不再继续摸打，判定时点先于下一次摸牌而非摸完才判。`configCondition` 为空，未登记开关。
- **双端协作**：牌墙余量降至 20 张及以下 → 服务端在下一张牌被摸走前判定黄庄 → 本局结束并结算 → 客户端展示黄庄结果。
- **业务行为**：
  - trigger：牌墙剩余张数降到 20 张及以下
  - condition：下一次摸牌时机到来之前
  - action：服务端在下一张牌被摸走前直接判定本局黄庄；客户端按服务端下发的本局结果展示黄庄结束
  - result：牌墙只剩 20 张或更少时，本局会在下一张牌被摸走前就黄庄结束
- **实际实现差异**：`difference=unverified`；无 `candidateDifference`。
  `baselineDetail`：该原子要求「牌墙剩 20 张及以下时在下一次摸牌前黄庄」，职责域为服务端流局判定；但统一原子视图中服务端无任何证据（applicability 为空、evidenceIds 为空、无矛盾证据），客户端亦无证据，无法判定实现是否符合需求，按证据不足归为未验证。
- **验证结论（L7）**：`verification_required`；`l7Basis=proposed`（`effectiveDifference=unverified`，`scope=unknown`，非 `pending-blocked`）；服务端覆盖仍 pending，查证未完成。

### AT-ST-C11-008 各类杠使杠链加一

- 所属功能点：FP-ST-C11-003 杠链累计与归零（PRD 第 161 行）
- **需求规则**：明杠、暗杠、加杠都使杠链加 1。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerification.verdict` 为空、`clientVerification.evidenceIds` 为空，无 CLE-id 与 file:line 可定位。本原子验证范围在服务端，客户端不维护杠链计数，仅按服务端下发的杠牌结果呈现该次杠。
- **服务端职责**：`serverVerification.applicability` 为空、`serverVerification.evidenceIds` 为空，无 SVE-id 与 file:line 可定位。规则说明（需求口径）：明杠、暗杠、加杠三类杠一律使杠链（连续杠计数）加 1，三类不区分对待，不因杠的形态不同而增减。`configCondition` 为空，未登记开关。
- **双端协作**：玩家完成杠（明杠/暗杠/加杠）→ 服务端确认杠成立 → 连续杠计数加 1 → 下发杠牌结果 → 客户端呈现该次杠并被计入连续杠。
- **业务行为**：
  - trigger：玩家完成明杠、暗杠或加杠
  - condition：该次杠牌成立
  - action：服务端把任何一类杠都算作连续杠计数加 1；客户端按服务端下发的杠牌结果呈现，不自行计算连续杠
  - result：玩家不管用明杠、暗杠还是加杠，每完成一次，连续杠的计数都加一，三种杠对连续杠的作用相同
- **实际实现差异**：`difference=unverified`；无 `candidateDifference`。
  `baselineDetail`：该原子要求「明杠、暗杠、加杠都使杠链加 1」，职责域为服务端连续杠计数；但统一原子视图中服务端无任何证据（applicability 为空、evidenceIds 为空、无矛盾证据），客户端亦无证据，无法判定实现是否符合需求，按证据不足归为未验证。
- **验证结论（L7）**：`verification_required`；`l7Basis=proposed`（`effectiveDifference=unverified`，`scope=unknown`，非 `pending-blocked`）；服务端覆盖仍 pending，查证未完成。

### AT-ST-C11-009 吃碰使杠链归零

- 所属功能点：FP-ST-C11-003 杠链累计与归零（PRD 第 161 行）
- **需求规则**：吃或碰时，杠链归零。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerification.verdict` 为空、`clientVerification.evidenceIds` 为空，无 CLE-id 与 file:line 可定位。本原子验证范围在服务端，客户端不维护杠链，仅按服务端下发的吃碰结果更新牌型。
- **服务端职责**：`serverVerification.applicability` 为空、`serverVerification.evidenceIds` 为空，无 SVE-id 与 file:line 可定位。规则说明（需求口径）：吃牌或碰牌成立时，把连续杠计数清零，即吃与碰都会打断已累计的杠链。`configCondition` 为空，未登记开关。
- **双端协作**：玩家吃牌或碰牌成立 → 服务端把连续杠计数归零 → 下发结果 → 客户端呈现吃碰后的牌型。
- **业务行为**：
  - trigger：玩家发生吃牌或碰牌
  - condition：该次吃或碰成立
  - action：服务端在吃/碰成立时把连续杠计数清零；客户端按服务端下发的吃碰结果呈现牌型
  - result：玩家一旦吃牌或碰牌，之前连起来的连续杠就断了，之后要重新从头累计
- **实际实现差异**：`difference=unverified`；无 `candidateDifference`。
  `baselineDetail`：该原子要求「吃或碰时杠链归零」，职责域为服务端连续杠计数重置；但统一原子视图中服务端无任何证据（applicability 为空、evidenceIds 为空、无矛盾证据），客户端亦无证据，无法判定实现是否符合需求，按证据不足归为未验证。
- **验证结论（L7）**：`verification_required`；`l7Basis=proposed`（`effectiveDifference=unverified`，`scope=unknown`，非 `pending-blocked`）；服务端覆盖仍 pending，查证未完成。

### AT-ST-C11-010 打出非财神使杠链归零

- 所属功能点：FP-ST-C11-003 杠链累计与归零（PRD 第 161 行）
- **需求规则**：打出非财神牌时，杠链归零。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerification.verdict` 为空、`clientVerification.evidenceIds` 为空，无 CLE-id 与 file:line 可定位。本原子验证范围在服务端，客户端不自行清零连续杠，仅按服务端下发的出牌结果更新牌桌。
- **服务端职责**：`serverVerification.applicability` 为空、`serverVerification.evidenceIds` 为空，无 SVE-id 与 file:line 可定位。规则说明（需求口径）：玩家打出非财神牌时把连续杠计数清零；判定以「该张是否为财神」为条件，财神牌走 AT-ST-C11-011 的单独口径。`configCondition` 为空，未登记开关。
- **双端协作**：玩家打出非财神牌 → 服务端确认打出的牌不是财神 → 连续杠计数归零 → 下发出牌与牌局状态 → 客户端更新牌桌。
- **业务行为**：
  - trigger：玩家打出一张非财神的牌
  - condition：打出的这张牌不是财神
  - action：服务端确认该牌非财神后把连续杠计数清零；客户端按服务端下发的出牌结果更新牌桌
  - result：只要玩家打出的不是财神牌，之前连起来的连续杠就清零
- **实际实现差异**：`difference=unverified`；无 `candidateDifference`。
  `baselineDetail`：该原子要求「打出非财神牌时杠链归零」，职责域为服务端连续杠计数重置；但统一原子视图中服务端无任何证据（applicability 为空、evidenceIds 为空、无矛盾证据），客户端亦无证据，无法判定实现是否符合需求，按证据不足归为未验证。
- **验证结论（L7）**：`verification_required`；`l7Basis=proposed`（`effectiveDifference=unverified`，`scope=unknown`，非 `pending-blocked`）；服务端覆盖仍 pending，查证未完成。

### AT-ST-C11-011 打出财神后不再敲响使杠链归零

- 所属功能点：FP-ST-C11-003 杠链累计与归零（PRD 第 161 行）
- **需求规则**：打出财神但打出后不再敲响时，杠链归零。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerification.verdict` 为空、`clientVerification.evidenceIds` 为空，无 CLE-id 与 file:line 可定位。实现要点（需求口径）：客户端需按服务端下发的敲响状态与连续杠结果，把「是否仍敲响」与连续杠是否保留呈现给对应玩家；当前无证据证明客户端存在敲响状态的呈现逻辑。
- **服务端职责**：`serverVerification.applicability` 为空、`serverVerification.evidenceIds` 为空，无 SVE-id 与 file:line 可定位。规则说明（需求口径）：打出财神后先判定这一手是否仍敲响——不再敲响则连续杠计数归零，仍敲响则保留原有连续杠。`configCondition` 为空，未登记开关。
- **双端协作**：玩家打出财神 → 服务端判定这一手是否仍敲响 → 不再敲响则连续杠计数归零，仍敲响则保留 → 下发敲响状态与牌局结果 → 客户端呈现。
- **业务行为**：
  - trigger：玩家打出一张财神牌
  - condition：打出这张财神后这一手不再敲响
  - action：服务端判定这一手是否仍敲响，不再敲响则把连续杠计数清零、仍敲响则保留；客户端按下发的敲响状态与连续杠结果呈现
  - result：玩家打出财神后如果这一手不再敲响，之前连的连续杠就清零；如果还敲响，连续杠继续保留
- **实际实现差异**：`difference=unverified`；无 `candidateDifference`。
  `baselineDetail`：该原子要求「打出财神但打出后不再敲响时杠链归零」，需要服务端判定敲响与否并处理连续杠、客户端呈现结果；但统一原子视图中客户端与服务端均无任何证据（verdict 与 applicability 为空、evidenceIds 为空、无矛盾证据），无法判定实现是否符合需求，按证据不足归为未验证。
- **验证结论（L7）**：`verification_required`；`l7Basis=proposed`（`effectiveDifference=unverified`，`scope=unknown`，非 `pending-blocked`）；双端覆盖仍 pending，查证未完成。

## 证据索引

本阶段 11 个原子在统一原子视图中均未挂任何证据：`clientVerification.evidenceIds` 与 `serverVerification.evidenceIds` 全为空，`trace_index.json` 中每个原子的 `evidenceCount=0`、`reviewStatus=none`。因此本阶段**不存在原子级 CLE / SVE 证据**，也无对应 file:line 可定位（`atoms=[C11] → evidence=[]`）。`difference-review.json` 的 69 条 entry 中无任何 atomId 含 ST-C11 的条目。

作为取证边界说明，列出与「吃、碰、出牌」动作相关但**不属于本阶段原子证据**的既有服务端条目（其 atomIds 均为 AT-ST-C01 系列，claimKey 不覆盖杠后补牌、杠链或黄庄判定），仅供后续补证时参考、不得据此判定本阶段差异：

| 证据 id | layer | file:line | claimKey | 说明 |
|---|---|---|---|---|
| SVE-AT-ST-C01-021-01 | common_game | common_game/com_game/common_game_com_action.cpp:141-148 | three-tan-triggers-contract-at-three | 仅覆盖吃牌成立后的三摊承包判定（BoxChowStep::Execute），不含吃牌是否使杠链归零 |
| SVE-AT-ST-C01-019-01 | common_game | common_game/com_game/common_game_com_pung.cpp:125-138 | pung-counts-one-tan-when-pung-as-tan | 仅覆盖碰牌计摊（BoxPungStep::Execute），不含碰牌是否使杠链归零 |
| SVE-AT-ST-C01-005-04 | mah_frame | mah_frame/base/base_config.cpp:42 | discard-allowed-default | 仅证明基础出牌开关默认允许（BaseConfig::Reset），不涉及出牌后杠链处理 |
| SVE-AT-ST-C01-024-01 | common_game | common_game/com_game/common_game_com_action.cpp:62-66 | chow-judge-chi-peng-limit-call-site | 仅覆盖吃碰次数上限判定的调用点（BoxChowStep::Judge），不含杠链计数 |

补充说明：

- 客户端证据：`client-evidence.json` 共 12 条 CLE（CLE-AT-ST-C01-001-02 ~ CLE-AT-ST-C01-009-03 等），atomIds 全部为 ST-C01 系列；`coverage.entryCount=29`、`expectedAtomCount=416`，C11 全部落在 `pendingAtomIds`。
- 服务端证据：`server-evidence.json` 共 60 条 SVE，atomIds 全部为 ST-C01 系列；`scope-index.json` 的 `stats.pending=387`、`entryCount=29`，C11 全部落在 `pendingAtomIds`。
- 本阶段 `analysisPath` 全为 `full`，`l7-classify.json` 的 `blockedAtoms` 为空数组，故本阶段不产出「查证未完成（pending/timeout/failed）」定性，也不存在冲突结论与升级候选。

## 待处理事项

### 待验证（verification_required，补证 both）

`pending-list.md` 中本阶段共 11 条，问题类型均为「规则待验证」，说明均为「证据不足」，建议动作均为「补证 both」。

| atomId | 验证范围 | 问题 | 说明 | 建议动作 |
|---|---|---|---|---|
| AT-ST-C11-001 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C11-002 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C11-003 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C11-004 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C11-005 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C11-006 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C11-007 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C11-008 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C11-009 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C11-010 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C11-011 | both | 规则待验证 | 证据不足 | 补证 both |

### 分类汇总

- 查证未完成（必要端缺口，blocked）：本阶段 0 条（11 个原子 `analysisPath` 全为 `full`，`blockedAtoms` 为空，无 pending/timeout/failed 造成的阻塞）。
- 需策划裁决（decision_required）：本阶段 0 条（`l7` 全部为 `verification_required`，无 `decision_required`）。
- 待审批建议（reviewStatus=pending）：本阶段 0 条（`difference-review.json` 无 ST-C11 条目，`trace_index.json` 全部 `reviewStatus=none`），故无「待审批建议：<reviewedDifference>（<reviewRule>）」需标注，也不存在候选升级口径（无 `candidateDifference`）。

### 补证方向（供后续取证参考，非结论）

- 杠后补牌与后续选择（001-004）：需服务端在杠成立后补牌取牌位置的实现证据（牌墙尾部索引/指针、补牌后余量扣减、补牌纳入胡牌判定并放行自摸），以及回合推进只接受续杠/出牌请求的校验证据；客户端需补「补牌入手的呈现」「自摸操作放开」「不胡时仅放出续杠与出牌两类操作」的交互证据。
- 牌墙下限与黄庄（005-007）：需服务端杠请求校验处对牌墙余量的门槛判断（少于 21 张拒绝）与逐次续杠重检的证据，以及黄庄判定点位于「下一次摸牌之前」的时序证据；客户端需补杠操作按余量显隐的证据。
- 杠链累计与归零（008-011）：需服务端连续杠计数的数据结构与写入点证据，覆盖杠成立时 +1、吃/碰时清零、打出非财神时清零、打出财神后按是否仍敲响清零或保留；客户端需补敲响状态与连续杠结果的呈现证据。
