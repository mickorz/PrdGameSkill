# ST-C09 操作优先级

## 阶段概述

本阶段规定同一张弃牌上胡、碰、直杠、吃等操作的响应优先级与同级裁决、多人可胡时的最近者优先与顺延、低优先级等待与高优先级成立后的响应取消，以及吃只能吃上家的限制。

- 原子数：11（AT-ST-C09-001 ~ AT-ST-C09-011），分属 4 个功能点：FP-ST-C09-001 弃牌响应优先级排序（001-004）、FP-ST-C09-002 多人可胡的裁决与顺延（005-008）、FP-ST-C09-003 低优先级等待与取消（009-010）、FP-ST-C09-004 吃的上家限制（011）。
- L7 分布：verified 0 / verification_required 11 / decision_required 0 / not_applicable 0。
- analysisPath 分布：11 个原子全部为 `full`（无 blocked、无 conflict-fast、无 candidateDifference 升级）。
- 取证现状：本阶段 11 个原子在统一原子视图中双端字段均为空（`clientVerification.verdict` 空、`serverVerification.applicability` 空、两端 `evidenceIds` 空、`configCondition` 空），`difference` 一律为 `unverified`；11 个原子均有 `reviewStatus=pending` 的复核建议（`reviewedDifference` 仍为 `unverified`），尚未生效，详见各原子「实际实现差异」与「待处理事项」。
- 证据缺口事实：`client-evidence.json` 共 12 条 CLE，`atomIds` 全部指向 `AT-ST-C01-*`，无一条归属 ST-C09；`server-evidence.json` 共 60 条 SVE，同样无 `atomIds` 指向 `AT-ST-C09-*`；`trace_index.json` 中本阶段 11 条记录的 `evidenceCount` 均为 0。
- 需求原文行号：优先级顺序与碰杠同级（001-004、006）= PRD 第 139 行；多人可胡与顺延（005、007、008）= 第 141 行；低优先级等待与取消（009-010）= 第 142 行；吃只吃上家（011）= 第 143 行。

| 原子 | 名称 | 验证范围 | difference | L7 |
|---|---|---|---|---|
| AT-ST-C09-001 | 弃牌响应优先级顺序 | both | unverified | verification_required |
| AT-ST-C09-002 | 碰与直杠同级 | both | unverified | verification_required |
| AT-ST-C09-003 | 碰杠同级按座位号裁决 | server | unverified | verification_required |
| AT-ST-C09-004 | 碰直杠只发给座位号最小的一家 | both | unverified | verification_required |
| AT-ST-C09-005 | 只允许一人胡 | server | unverified | verification_required |
| AT-ST-C09-006 | 多人可胡每家都收到胡 | both | unverified | verification_required |
| AT-ST-C09-007 | 逆时针最近可胡者优先 | server | unverified | verification_required |
| AT-ST-C09-008 | 近者胡则远者不成立放弃后顺延 | both | unverified | verification_required |
| AT-ST-C09-009 | 低优先级先提交需等待 | both | unverified | verification_required |
| AT-ST-C09-010 | 高优先级成立则其余响应取消 | both | unverified | verification_required |
| AT-ST-C09-011 | 吃只能吃上家 | both | unverified | verification_required |

## 需求条目

### AT-ST-C09-001 弃牌响应优先级顺序

- 所属功能点：FP-ST-C09-001 弃牌响应优先级排序（PRD 第 139 行）
- **需求规则**：对同一张弃牌，点炮胡 > 碰 / 直杠 > 吃。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerification.verdict` 为空、`clientEvidenceIds` 为空，客户端未给出结论；`client-evidence.json` 12 条证据的 `atomIds` 全部归属 `AT-ST-C01-*`，无一条覆盖本原子（本原子仅出现在 `coverage.pendingAtomIds`）。复核引用的相邻条目 CLE-AT-ST-C01-001-02（`data/GameData.ts`，claimKey=`simple-mode-config-consumed`，简洁模式配置消费）与 CLE-AT-ST-C01-002-03（`config/GameDefine.ts`，claimKey=`seat-count-map-2-3`，2/3 人座次映射）不构成本原子证据。实现要点（需求口径）：同一张弃牌上客户端只把优先级更高的响应机会呈现给相应玩家——可胡者先得到胡的提示，其次是可碰/可直杠者，最后才是可吃者；低优先级提示需等更高优先级落空后才有效。当前无 CLE 证据证明该提示分层与门控存在。
- **服务端职责**：`serverVerification.applicability` 为空、`serverEvidenceIds` 为空，服务端未给出适用性判定；`server-evidence.json` 60 条证据覆盖 26 个原子（全部 `AT-ST-C01-*`），无一条 `atomIds` 指向 `AT-ST-C09-*`，更无胡/碰/杠/吃优先级比较的裁决证据。需求口径为：服务端按「点炮胡 高于 碰/直杠，碰/直杠 高于 吃」的顺序裁决同一张弃牌上的多个响应，低优先级响应不得越过更高优先级先成立。配置生效条件（`configCondition`）为空，未登记任何开关。
- **双端协作**：玩家打出弃牌 → 客户端向能响应该牌的玩家展示各自操作提示 → 玩家提交响应 → 服务端按胡、碰/直杠、吃的高低顺序裁决 → 回传裁决结果 → 客户端收起未获受理的提示并刷新牌局。
- **业务行为**：
  - trigger：某位玩家打出一张弃牌
  - condition：该弃牌同时可被胡、碰、直杠、吃等不同方式响应，且响应来自不同玩家或同一玩家的不同操作
  - action：客户端对同一张弃牌只把优先级更高的响应机会呈现给相应玩家（可胡者先、碰/直杠次之、吃最后，低优先级提示待高优先级落空后生效）；服务端按「点炮胡 高于 碰/直杠，碰/直杠 高于 吃」裁决多个响应，低优先级不得越过更高优先级先成立
  - result：玩家看到高优先级的操作先被受理（例如有人胡牌则碰、吃都不能成），低优先级玩家需要让位
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空（无升级候选）。
  `baselineDetail`：该原子在统一原子视图中客户端与服务端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），只能确认需求要求的优先级顺序，无法判定实现是否按此顺序裁决，按证据不足归为未验证。
  待审批建议：unverified（`no-server-evidence-is-not-conflict`：双端均无优先级裁决证据，属取证空缺，维持未验证）。该建议未生效。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（依据 effectiveDifference=unverified 提议；scope=unknown，scopeSource=`default-unknown`）。

### AT-ST-C09-002 碰与直杠同级

- 所属功能点：FP-ST-C09-001 弃牌响应优先级排序（PRD 第 139 行）
- **需求规则**：碰与直杠同级。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空；`client-evidence.json` 无 C09 条目录入，本原子仅列为 pending。实现要点（需求口径）：客户端不因操作是碰还是直杠而给出不同先后的提示，两类提示同时到达玩家，由玩家自行选择。当前无 CLE 证据证明两类提示的同级呈现。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空。需求口径为：服务端把碰与直杠视为同一优先级，裁决时不因两者区别产生先后差异。`configCondition` 为空，未登记开关。复核引用的最近相邻条目 SVE-AT-ST-C01-019-01（`common_game/com_game/common_game_com_pung.cpp:125-138`，claimKey=`pung-counts-one-tan-when-pung-as-tan`，`BoxPungStep::Execute`）只证明「碰算摊时碰记 1 摊」，属摊数计算，既未涉及杠步也未给出碰/杠同级比较分支，不能用来判定同级口径。
- **双端协作**：玩家打出弃牌 → 客户端同时展示碰与直杠两种可选项 → 玩家选择其一提交 → 服务端按同级处理受理 → 回传结果 → 客户端刷新牌局。
- **业务行为**：
  - trigger：某位玩家打出一张弃牌
  - condition：有玩家对同一张弃牌既能碰又能直杠，两者处于同一优先级层
  - action：客户端同时展示碰与直杠两类提示、不区分先后由玩家自选；服务端把碰与直杠视为同一优先级受理，不因两者区别产生先后差异
  - result：玩家看到碰与直杠获得同等的响应机会，不存在「碰一定先于直杠」或相反的先后差别
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：该原子在统一原子视图中客户端与服务端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），无法核对碰与直杠是否被实现为同级，按证据不足归为未验证。
  待审批建议：unverified（`no-server-evidence-is-not-conflict`：碰算摊证据不等于碰/杠同级证据，维持未验证）。该建议未生效。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C09-003 碰杠同级按座位号裁决

- 所属功能点：FP-ST-C09-001 弃牌响应优先级排序（PRD 第 139 行）
- **需求规则**：同时能碰和直杠时不区分先后，按座位号小的先裁决。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空；本原子验证范围仅为服务端裁决逻辑，客户端如何展示争抢过程不作判定依据。实现要点（需求口径）：客户端只被动接收裁决结果并刷新牌局，不参与座位号比较。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空。需求口径为：服务端在碰与直杠同级争抢时不区分操作类型，改为比较相关玩家座位号，由座位号较小者先获得裁决结果。`configCondition` 为空，未登记开关。复核引用的相邻条目 SVE-AT-ST-C01-019-03（`hzmj_server/game_logic.cpp:65-87`，claimKey=`three-tan-forced-off-for-two-players`，配置装载）与 SVE-AT-ST-C01-024-06（`common_game/common_game_logic.cpp:65-73`，claimKey=`box-config-load-call-chain`，`OnGameStart` 初始化链）均只证明创房配置与启动链路，无任何按座位号排序仲裁碰/杠的实现证据。
- **双端协作**：玩家打出弃牌 → 客户端展示碰/直杠提示 → 多名玩家提交同级响应 → 服务端按座位号从小到大依次裁决 → 座位号较小者先拿到结果 → 回传后客户端刷新。
- **业务行为**：
  - trigger：同一张弃牌上同时出现可碰与可直杠的情况
  - condition：碰与直杠同级且存在多名玩家争抢，需要确定先给谁裁决
  - action：服务端不区分操作类型，比较相关玩家座位号，由座位号较小者先获得裁决结果
  - result：多人同时能碰或直杠同一张牌时，只有座位号较小的那一方先得到裁决结果，其余人等待或落空
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：本原子验证范围为服务端，但统一原子视图中服务端无证据（applicability 为空、evidenceIds 为空、无矛盾证据），无法核对是否按座位号小者优先，按证据不足归为未验证。
  待审批建议：unverified（`no-server-evidence-is-not-conflict`：服务端无座位号仲裁证据，不判 conflict 也不判 consistent）。该建议未生效。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C09-004 碰直杠只发给座位号最小的一家

- 所属功能点：FP-ST-C09-001 弃牌响应优先级排序（PRD 第 139 行）
- **需求规则**：碰、直杠只发给当前能成立、且座位号最小的那一家。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空；`client-evidence.json` 12 条证据无一条覆盖操作提示的下发对象。复核引用的 CLE-AT-ST-C01-005-03（`layer/comp/BoxHzmjResultMid.ts`，claimKey=`result-hu-type-tab`，结算页自摸/点炮胡页签）与本原子无关。实现要点（需求口径）：客户端只向获得响应的那一家展示碰或直杠提示，其余可成立但座位号更大的玩家界面不出现该提示。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空。需求口径为：服务端先筛出当前确实能成立的玩家，再在其中有争抢时只把碰或直杠响应下发给座位号最小的那一家。`configCondition` 为空，未登记开关。`server-evidence.json` 中无任何「只发给座位号最小可成立家」的下发筛选证据。
- **双端协作**：玩家打出弃牌 → 服务端计算各家能否碰/直杠并比较座位号 → 只向座位号最小的可成立玩家下发响应 → 该玩家客户端弹出提示 → 其他玩家界面无此提示 → 提交后服务端受理并刷新。
- **业务行为**：
  - trigger：某位玩家打出一张弃牌
  - condition：有多家玩家当前都能碰或直杠该弃牌
  - action：服务端先筛出能成立的玩家，再只把响应下发给座位号最小的一家；客户端仅在该家展示提示，其余可成立玩家界面不出现该选项
  - result：只有座位号最小的可成立玩家看到碰或直杠提示并可以操作，其他玩家看不到该选项
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：该原子在统一原子视图中客户端与服务端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），无法核对响应是否只下发给座位号最小的可成立玩家，按证据不足归为未验证。
  待审批建议：unverified（`no-server-evidence-is-not-conflict`：提示下发对象无双端证据，维持未验证）。该建议未生效。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C09-005 只允许一人胡

- 所属功能点：FP-ST-C09-002 多人可胡的裁决与顺延（PRD 第 141 行）
- **需求规则**：只允许一人胡，不一炮多响。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空；本原子验证范围仅为服务端胡牌归属处理，客户端提示如何呈现不作判定依据。复核引用的 CLE-AT-ST-C01-005-03（`layer/comp/BoxHzmjResultMid.ts`，claimKey=`result-hu-type-tab`）仅证明结算面按自摸/点炮切换页签，不证明单胡裁决。实现要点（需求口径）：客户端只按服务端回传的唯一胡牌结果刷新结算。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空。需求口径为：服务端对同一张弃牌只认定一名胡牌者成立，不允许多家同时胡同一张牌（不一炮多响）。`configCondition` 为空，未登记开关。复核引用的最近相邻条目 SVE-AT-ST-C01-005-01（`common_game/com_game/common_game_com_action.cpp:353-358`，claimKey=`banker-discard-hu-requires-three-level`，`BoxHuStep::CanDiscardHu`，`enable_banker_discard_hu` 且 `banker_level>=3` 才可点炮）只证明点炮胡的启用前置条件，不涉及多人可胡时如何收敛为唯一胜者。
- **双端协作**：玩家打出弃牌 → 多家客户端出现胡的提示并提交 → 服务端收到多个胡声明后只裁决一人成立 → 回传一人胡牌、其余落空 → 客户端各自刷新结算。
- **业务行为**：
  - trigger：一张弃牌被多家玩家声明可以胡
  - condition：同时存在多个可胡者，需要确定最终胡牌归属
  - action：服务端对同一张弃牌只认定一名胡牌者成立，不允许多家同时胡同一张牌
  - result：最终只有一名玩家胡牌，其余可胡者不会同时胡这张牌
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：本原子验证范围为服务端，但统一原子视图中服务端无证据（applicability 为空、evidenceIds 为空、无矛盾证据），无法核对是否只允许一人胡，按证据不足归为未验证。
  待审批建议：unverified（`evidence-is-not-consistency`：可点炮前置条件与结算页签证据不足以证明单胡裁决）。该建议未生效。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C09-006 多人可胡每家都收到胡

- 所属功能点：FP-ST-C09-002 多人可胡的裁决与顺延（PRD 第 139 行）
- **需求规则**：多人可胡时每家都收到胡。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空；`client-evidence.json` 无覆盖胡提示下发范围的条目。实现要点（需求口径）：客户端不因已有他人可胡而屏蔽提示，每个可胡玩家的界面都会出现胡的选项，可自行选择胡或放弃。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空。需求口径为：服务端向每一个可胡玩家下发胡的响应机会，再由后续优先级裁决决定最终由谁胡。`configCondition` 为空，未登记开关。`server-evidence.json` 中无对应「逐个可胡者下发」的实现证据。
- **双端协作**：玩家打出弃牌 → 服务端判定所有可胡者 → 逐个下发胡的响应 → 各客户端同时出现胡提示 → 玩家各自提交胡或放弃 → 服务端裁决一人成立 → 回传结果。
- **业务行为**：
  - trigger：某位玩家打出一张弃牌
  - condition：多家玩家均可胡该弃牌（与「最终只一人胡」并存：提示给全部可胡者，成立只归一人）
  - action：服务端向每一个可胡玩家下发胡的响应机会，客户端对每个可胡玩家都展示胡的选项
  - result：每个可胡玩家都能看到并可以选择胡，不会因为别人也能胡而收不到提示
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：该原子在统一原子视图中客户端与服务端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），无法核对多人可胡时是否每家都收到胡提示，按证据不足归为未验证。
  待审批建议：unverified（`no-server-evidence-is-not-conflict`：与 C09-005 的张力属口径组合，双端无证据时不得推定为冲突）。该建议未生效。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C09-007 逆时针最近可胡者优先

- 所属功能点：FP-ST-C09-002 多人可胡的裁决与顺延（PRD 第 141 行）
- **需求规则**：多人可胡时，从出牌者起按逆时针，最近的可胡者优先。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空；本原子验证范围仅为服务端先后判定，客户端提示顺序不作判定依据。实现要点（需求口径）：客户端按服务端下发的顺序提示，不做逆时针距离计算。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空。需求口径为：服务端从出牌者位置起按逆时针方向逐一比对，优先把胡的资格判给距出牌者最近的可胡者。`configCondition` 为空，未登记开关。`server-evidence.json` 60 条证据覆盖 26 个原子（全部 `AT-ST-C01-*`），没有任何按出牌者座位逆时针距离排序的裁决证据。
- **双端协作**：玩家打出弃牌 → 服务端从出牌者逆时针方向排列可胡者 → 取距离最近者作为第一顺位 → 下发其胡的响应 → 该玩家提交后成立或放弃 → 服务端按顺位继续处理。
- **业务行为**：
  - trigger：多人可胡同一张弃牌
  - condition：同时存在多个可胡者，需要确定谁先获得胡的资格
  - action：服务端从出牌者位置起按逆时针方向逐一比对，优先把胡的资格判给距出牌者最近的可胡者
  - result：由距离出牌者最近的可胡者优先获得胡的资格，更远的可胡者排在其后
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：本原子验证范围为服务端，但统一原子视图中服务端无证据（applicability 为空、evidenceIds 为空、无矛盾证据），无法核对是否按逆时针最近者优先，按证据不足归为未验证。
  待审批建议：unverified（`no-server-evidence-is-not-conflict`：服务端无逆时针就近裁决证据，维持未验证）。该建议未生效。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C09-008 近者胡则远者不成立放弃后顺延

- 所属功能点：FP-ST-C09-002 多人可胡的裁决与顺延（PRD 第 139-141 行）
- **需求规则**：近者胡则远者不成立，近者放弃后远者仍可胡；放弃后顺延。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空；`client-evidence.json` 无覆盖胡资格顺延的提示/交互证据。实现要点（需求口径）：客户端对近者可选的胡提示保留胡与过两种操作；近者胡则远者的胡提示被收起，近者过则远者的胡提示顺延生效可点击。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空。需求口径为：服务端先等近者表态：近者胡即取消远者的胡资格；近者放弃则把胡的资格顺延给下一顺位的可胡者，再重新等待其表态。`configCondition` 为空，未登记开关。`server-evidence.json` 既无就近排序也无「放弃后顺延到下一顺位」的状态机证据（复核指出的 SVE-AT-ST-C01-005-01 仅涉及点炮胡启用条件）。
- **双端协作**：玩家打出弃牌 → 服务端先向最近的可胡者下发胡响应 → 该玩家选择胡或过 → 选胡则服务端取消其余可胡者并结算；选过则服务端把胡资格顺延给下一顺位 → 下发新的胡响应 → 客户端刷新提示。
- **业务行为**：
  - trigger：最近的可胡者先被裁决
  - condition：最近的可胡者可以自行选择胡或放弃，且其后仍有更远的可胡者
  - action：服务端先等近者表态，近者胡即取消远者资格，近者放弃则把胡资格顺延给下一顺位并重新等待；客户端据结果收起或顺延胡提示
  - result：近者胡时远者不能再胡；近者放弃后，远者仍会看到胡的提示并可以胡
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：该原子在统一原子视图中客户端与服务端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），无法核对近者胡/过的顺延与取消行为，按证据不足归为未验证。
  待审批建议：unverified（`no-server-evidence-is-not-conflict`：顺延仲裁无任何双端证据，维持未验证）。该建议未生效。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C09-009 低优先级先提交需等待

- 所属功能点：FP-ST-C09-003 低优先级等待与取消（PRD 第 142 行）
- **需求规则**：低优先级先提交时，先等全部更高优先级的玩家手动放弃，再执行。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空；`client-evidence.json` 无任何「等待高优先级」的交互门槛/按钮禁点证据。实现要点（需求口径）：客户端在低优先级玩家提交后让其操作处于待生效状态，提示其等待更高优先级玩家处理，不立即播放成功动作。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空。需求口径为：服务端把低优先级响应挂起，待全部更高优先级玩家手动放弃后才执行该操作；期间若有更高优先级成立则直接作废。`configCondition` 为空，未登记开关。`server-evidence.json` 无跨优先级等待队列或「待放弃」状态证据。
- **双端协作**：玩家打出弃牌 → 低优先级玩家先提交 → 服务端挂起并等待更高优先级玩家 → 更高优先级玩家逐一选择放弃 → 全部放弃后服务端执行被挂起的操作 → 回传后客户端刷新。
- **业务行为**：
  - trigger：低优先级玩家先行提交了响应（如先点碰或先点吃）
  - condition：同一张弃牌上仍存在更高优先级的玩家尚未表态
  - action：服务端挂起该低优先级响应，待全部更高优先级玩家手动放弃后才执行；客户端让该操作处于待生效状态并提示等待
  - result：低优先级玩家看到自己的操作延迟生效，必须等更高优先级玩家全部放弃后才真正执行
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：该原子在统一原子视图中客户端与服务端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），无法核对低优先级先提交时是否等待高优先级全部放弃后才执行，按证据不足归为未验证。
  待审批建议：unverified（`no-server-evidence-is-not-conflict`：跨优先级等待无证据，缺证据不得升级为冲突）。该建议未生效。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C09-010 高优先级成立则其余响应取消

- 所属功能点：FP-ST-C09-003 低优先级等待与取消（PRD 第 142 行）
- **需求规则**：更高优先级一旦成立，其余响应取消。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空；`client-evidence.json` 无「取消其他响应提示」的证据。复核引用的 CLE-AT-ST-C01-009-03（`layer/BoxHzmjTingPaiView.ts`，claimKey=`feng-ding-status-text`，封顶/听牌展示）与操作提示无关。实现要点（需求口径）：客户端收到更高优先级成立的结果后，立即收起其余待处理的响应提示，玩家不再能点击这些已失效的选项。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空。需求口径为：服务端在更高优先级响应成立时作废其余所有待处理响应，不再受理这些响应。`configCondition` 为空，未登记开关。`server-evidence.json` 无响应取消广播或回执收敛的实现证据。
- **双端协作**：玩家打出弃牌 → 多家提交响应 → 服务端判定更高优先级响应成立 → 作废其余待处理响应 → 回传成立结果 → 各客户端收起已失效提示并刷新牌局。
- **业务行为**：
  - trigger：更高优先级的玩家完成响应并成立
  - condition：尚有其他玩家的响应处于待处理状态
  - action：服务端作废其余所有待处理响应并停止受理；客户端收起其余待处理提示，使玩家无法再点击已失效选项
  - result：其余玩家看到自己的响应提示被取消，只有高优先级的那项操作生效
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：该原子在统一原子视图中客户端与服务端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），无法核对高优先级成立后其余响应是否被取消，按证据不足归为未验证。
  待审批建议：unverified（`no-server-evidence-is-not-conflict`：响应取消无双端证据，维持未验证）。该建议未生效。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C09-011 吃只能吃上家

- 所属功能点：FP-ST-C09-004 吃的上家限制（PRD 第 143 行）
- **需求规则**：吃只能吃上家。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空；无上家判断或吃牌提示过滤证据。实现要点（需求口径）：客户端只在自己上家打出弃牌时显示可吃的选项；其他家（包括对家和下家）打出的牌不出现吃选项。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空。需求口径为：服务端校验弃牌来源与吃牌者的座次关系，仅当弃牌出自吃牌者的上一家时才允许吃成立。`configCondition` 为空，未登记开关。复核引用的相邻条目 SVE-AT-ST-C01-019-02（`common_game/common_game_algorithm.cpp:86-93`，claimKey=`xian-xian-tan-capped-at-two`，`IsXianXianTanFull` 闲闲 2 摊上限）与 SVE-AT-ST-C01-019-03（`hzmj_server/game_logic.cpp:65-87`，claimKey=`three-tan-forced-off-for-two-players`，二人局关三摊后 `SetRuleChiPeng(2)`）只证明吃碰次数/摊数限制，均未证明「按座位方向只允许吃上家」的校验分支。
- **双端协作**：玩家打出弃牌 → 服务端判断各家与出牌者的座次 → 仅对出牌者的下一家下发吃响应 → 该客户端出现吃选项 → 提交后服务端校验来源并受理 → 回传后刷新牌局。
- **业务行为**：
  - trigger：某位玩家打出一张弃牌
  - condition：有玩家想以吃的方式响应该弃牌，且该弃牌来自吃牌者的上一家
  - action：服务端校验弃牌来源与吃牌者的座次关系，仅对出牌者的下一家下发吃响应；客户端只在上家打出时显示吃选项
  - result：玩家只对自己上家打出的牌看到可吃的选项，吃不到其他家的弃牌
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：该原子在统一原子视图中客户端与服务端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），无法核对吃是否被限制为上家弃牌，按证据不足归为未验证。
  待审批建议：unverified（`common-capability-is-not-enabled`：吃牌能力与次数上限证据不等于本规则已按上家限制启用）。该建议未生效。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

## 证据索引

本阶段 11 个原子在统一原子视图中均未挂证据：`clientVerification.evidenceIds` 与 `serverVerification.evidenceIds` 全为空，`trace_index.json` 中 11 条记录 `evidenceCount` 全为 0。因此本阶段**原子级 CLE / SVE 证据列表为空**。

- `client-evidence.json`：共 12 条 CLE，`atomIds` 全部归属 `AT-ST-C01-*`，无 `AT-ST-C09-*` 条目。
- `server-evidence.json`：共 60 条 SVE，覆盖 26 个原子，全部为 `AT-ST-C01-*`，无 `atomIds` 含 C09 的记录。

下表仅列出复核说明中跨原子引用、可作为后续补证线索的条目，均**不属于本阶段原子级证据**：

| 证据 id | layer | file:line | claimKey | 引用位置（复核） | 说明 |
|---|---|---|---|---|---|
| SVE-AT-ST-C01-019-01 | common_game | common_game/com_game/common_game_com_pung.cpp:125-138 | pung-counts-one-tan-when-pung-as-tan | AT-ST-C09-002 | `BoxPungStep::Execute` 证明碰算摊记 1 摊，不涉及碰/杠同级比较 |
| SVE-AT-ST-C01-019-03 | hzmj_server | hzmj_server/game_logic.cpp:65-87 | three-tan-forced-off-for-two-players | AT-ST-C09-003、AT-ST-C09-011 | 配置装载 / 二人局关三摊后 `SetRuleChiPeng(2)`，只涉摊数与吃碰次数上限 |
| SVE-AT-ST-C01-024-06 | common_game | common_game/common_game_logic.cpp:65-73 | box-config-load-call-chain | AT-ST-C09-003 | `OnGameStart` 初始化链，不涉座位号仲裁 |
| SVE-AT-ST-C01-005-01 | common_game | common_game/com_game/common_game_com_action.cpp:353-358 | banker-discard-hu-requires-three-level | AT-ST-C09-005、AT-ST-C09-008 | `BoxHuStep::CanDiscardHu` 只约束点炮胡启用前置条件 |
| SVE-AT-ST-C01-019-02 | common_game | common_game/common_game_algorithm.cpp:86-93 | xian-xian-tan-capped-at-two | AT-ST-C09-011 | `IsXianXianTanFull` 闲闲 2 摊上限，不证明上家方向校验 |
| CLE-AT-ST-C01-001-02 | client_code | data/GameData.ts | simple-mode-config-consumed | AT-ST-C09-001 | 简洁模式配置消费，与优先级裁决无关 |
| CLE-AT-ST-C01-002-03 | client_code | config/GameDefine.ts | seat-count-map-2-3 | AT-ST-C09-001 | 2/3 人座次映射，不含优先级比较 |
| CLE-AT-ST-C01-005-03 | client_code | layer/comp/BoxHzmjResultMid.ts | result-hu-type-tab | AT-ST-C09-004、AT-ST-C09-005 | 结算页自摸/点炮胡页签，不证明下发对象或单胡裁决 |
| CLE-AT-ST-C01-009-03 | client_code | layer/BoxHzmjTingPaiView.ts | feng-ding-status-text | AT-ST-C09-010 | 封顶/听牌展示，与响应取消无关 |

## 待处理事项

### 待验证（规则待验证，补证 both）

`pending-list.md` 中本阶段共 11 条，问题类型均为「规则待验证」，建议动作均为「补证 both」，且 11 条均带「另有待审批复核建议：unverified」。

| atomId | 验证范围 | 说明 | 建议动作 |
|---|---|---|---|
| AT-ST-C09-001 | both | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C09-002 | both | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C09-003 | server | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C09-004 | both | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C09-005 | server | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C09-006 | both | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C09-007 | server | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C09-008 | both | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C09-009 | both | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C09-010 | both | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C09-011 | both | 证据不足（另有待审批复核建议：unverified） | 补证 both |

查证未完成（必要端缺口）：本阶段 0 条（`analysisPath` 全为 `full`，无 pending/timeout/failed 导致的阻塞）。
需策划裁决：本阶段 0 条。
升级原子（有 candidateDifference）：本阶段 0 条。

### 待审批建议（reviewStatus=pending，均未生效）

`difference-review.json` 中本阶段 11 条复核记录 `reviewStatus` 均为 `pending`，`reviewedDifference` 均为 `unverified`（与当前生效差异一致），`candidateDifference` 为空。

| atomId | 建议差异 | 复核规则 | 状态 |
|---|---|---|---|
| AT-ST-C09-001 | unverified | no-server-evidence-is-not-conflict（双端均无优先级裁决证据，属取证空缺，维持未验证） | pending / 未生效 |
| AT-ST-C09-002 | unverified | no-server-evidence-is-not-conflict（碰算摊证据不等于碰/杠同级证据，维持未验证） | pending / 未生效 |
| AT-ST-C09-003 | unverified | no-server-evidence-is-not-conflict（服务端无座位号仲裁证据，不判 conflict 也不判 consistent） | pending / 未生效 |
| AT-ST-C09-004 | unverified | no-server-evidence-is-not-conflict（提示下发对象无双端证据，维持未验证） | pending / 未生效 |
| AT-ST-C09-005 | unverified | evidence-is-not-consistency（可点炮前置条件与结算页签证据不足以证明单胡裁决） | pending / 未生效 |
| AT-ST-C09-006 | unverified | no-server-evidence-is-not-conflict（与 C09-005 的张力属口径组合，双端无证据时不得推定为冲突） | pending / 未生效 |
| AT-ST-C09-007 | unverified | no-server-evidence-is-not-conflict（服务端无逆时针就近裁决证据，维持未验证） | pending / 未生效 |
| AT-ST-C09-008 | unverified | no-server-evidence-is-not-conflict（顺延仲裁无任何双端证据，维持未验证） | pending / 未生效 |
| AT-ST-C09-009 | unverified | no-server-evidence-is-not-conflict（跨优先级等待无证据，缺证据不得升级为冲突） | pending / 未生效 |
| AT-ST-C09-010 | unverified | no-server-evidence-is-not-conflict（响应取消无双端证据，维持未验证） | pending / 未生效 |
| AT-ST-C09-011 | unverified | common-capability-is-not-enabled（吃牌能力与次数上限证据不等于本规则已按上家限制启用） | pending / 未生效 |

建议动作：审批（approve/reject/hold）。11 条建议获批后差异口径仍为 `unverified`，L7 不变。

### 补证方向（供后续取证参考，非结论）

- 弃牌响应优先级（001-004）：需服务端「响应收集 → 优先级排序 → 座位号仲裁 → 下发对象筛选」链路的直接证据，重点在碰/直杠同级分支与座位号比较处；客户端需补响应提示分层与低优先级门控的显隐逻辑。
- 多人可胡裁决与顺延（005-008）：需服务端唯一胜者收敛、逆时针距离排序、放弃后顺位转移（状态机）证据；客户端需补胡提示对每家下发与近者放弃后的顺延生效逻辑。
- 低优先级等待与取消（009-010）：需服务端跨优先级挂起队列与「全部放弃后执行」条件、以及高优先级成立时的作废广播；客户端需补待生效状态与失效提示收起。
- 吃的上家限制（011）：需服务端弃牌来源与座次关系校验分支（当前仅找到摊数/吃碰次数上限的相邻证据），客户端需补吃选项的上家过滤。
