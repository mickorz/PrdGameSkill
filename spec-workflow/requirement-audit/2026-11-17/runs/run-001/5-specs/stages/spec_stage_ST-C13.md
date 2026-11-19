# ST-C13 飘财

## 阶段概述

本阶段规定飘财窗口的唯一性与归属转移、受限玩家的可做与禁止操作、所有者出牌时的关窗与重开、飘档与杠链的累计清零规则，以及飘次数的累计与「飘」字展示方式。

- 原子数：20（AT-ST-C13-001 ~ AT-ST-C13-020），分属 5 个功能点：FP-ST-C13-001 飘财窗口归属与转移（001-004）、FP-ST-C13-002 受限玩家的操作范围（005-009）、FP-ST-C13-003 所有者出牌关窗与重开（010-011）、FP-ST-C13-004 飘档与杠链累计清零（012-017）、FP-ST-C13-005 飘次数累计与飘字展示（018-020）。
- L7 分布：verified 0 / verification_required 20 / decision_required 0 / not_applicable 0。
- analysisPath 分布：20 个原子全部为 `full`（无 blocked、无 conflict-fast）；`l7Basis` 全部为 `proposed`，`scope=unknown`、`scopeSource=default-unknown`。
- 取证现状：本阶段 20 个原子在统一原子视图中双端字段均为空（client verdict 空、server applicability 空、evidenceIds 空、configCondition 空、directConflict=false、pending=false），`effectiveDifference` 一律为 `unverified`。CLE 证据 12 条全部只挂 AT-ST-C01 系列，SVE 证据 60 条全部只挂 AT-ST-C01 系列，两端证据全文检索「飘」「飘档」「piao」命中 0 条。**差异未判定**的原因是取证空缺，而非查证未完成（非 pending-blocked）。
- 复核：AT-ST-C13-002 / 009 / 012 / 020 存在 `reviewStatus=pending` 的复核建议（建议值均为 unverified），尚未生效。
- 需求原文行号：窗口归属与转移 = PRD 第 171 行；受限玩家操作范围 = 第 173 行；关窗与重开 = 第 174 行；飘档与杠链 = 第 175 行；飘次数与飘字 = 第 176 行。

| 原子 | 名称 | 验证范围 | difference | L7 |
|---|---|---|---|---|
| AT-ST-C13-001 | 窗口全场唯一 | server | unverified | verification_required |
| AT-ST-C13-002 | 打出财神成为所有者并限制三家 | both | unverified | verification_required |
| AT-ST-C13-003 | 再有人打出财神窗口直接转移 | server | unverified | verification_required |
| AT-ST-C13-004 | 被逼打出摸到的财神窗口转移 | both | unverified | verification_required |
| AT-ST-C13-005 | 受限时可胡牌和暗杠 | both | unverified | verification_required |
| AT-ST-C13-006 | 受限时禁止吃碰直杠加杠 | both | unverified | verification_required |
| AT-ST-C13-007 | 受限时只能打刚摸进的牌 | both | unverified | verification_required |
| AT-ST-C13-008 | 受限时其余手牌压暗 | both | unverified | verification_required |
| AT-ST-C13-009 | 飘财限制盖过吃碰禁手 | server | unverified | verification_required |
| AT-ST-C13-010 | 所有者下一次出牌先关窗 | both | unverified | verification_required |
| AT-ST-C13-011 | 打出的仍是财神则立刻重开 | both | unverified | verification_required |
| AT-ST-C13-012 | 飘档加一条件 | server | unverified | verification_required |
| AT-ST-C13-013 | 未敲响打财神飘档杠链归零 | server | unverified | verification_required |
| AT-ST-C13-014 | 打出普通牌归零 | server | unverified | verification_required |
| AT-ST-C13-015 | 各家飘档独立 | server | unverified | verification_required |
| AT-ST-C13-016 | 吃碰杠不清飘档 | server | unverified | verification_required |
| AT-ST-C13-017 | 吃和碰清杠链 | server | unverified | verification_required |
| AT-ST-C13-018 | 飘次数本局累加 | server | unverified | verification_required |
| AT-ST-C13-019 | 小局重置清掉飘次数 | server | unverified | verification_required |
| AT-ST-C13-020 | 座位碰杠位播放飘字 | client | unverified | verification_required |

## 需求条目

### AT-ST-C13-001 窗口全场唯一

- 所属功能点：FP-ST-C13-001 飘财窗口归属与转移（PRD 第 171 行）
- **需求规则**：全场同时只有一个飘财窗口。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，客户端未给出结论，也无 CLE 证据指向飘财窗口的唯一性。实现要点（需求口径，非证据）：客户端不自行维护窗口数量，仅按服务端下发的窗口归属渲染单处窗口状态；本原子验证范围限定服务端规则，客户端表现不作为判定依据。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空，服务端未给出适用性判定。规则口径为：对局任意时刻只维护一个飘财窗口，新窗口产生时对既有窗口做归属改写而非并列新增，不存在两个窗口并存的状态；未登记任何开关或人数条件。证据定位：无（`server-evidence.json` 60 条中无 atomIds 含 C13 的记录）。
- **双端协作**：有人打出财神 → 服务端开启飘财窗口 → 若此时已有窗口则仍只保留一个 → 窗口归属与受限范围按唯一窗口对全场生效。
- **业务行为**：
  - trigger：对局中有人打出财神、飘财窗口由此开启
  - condition：对局进行中；本项验证范围为服务端规则
  - action：客户端在本项不作为判定依据；服务端任意时刻只维护一个飘财窗口，已存在窗口时不再并列新增
  - result：玩家对局中只会看到一处飘财窗口，不会出现两个窗口并存的场面
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空（无升级候选）。
  `baselineDetail`：该原子服务端 applicability 为空、evidenceIds 为空、无矛盾证据，客户端亦无证据；仅有需求文本，无法判断实现是否确实只保留唯一窗口，按证据空缺归为未验证。差异未判定，不是与需求冲突。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（依据 effectiveDifference=unverified 提议；scope=unknown，`default-unknown`）。非 pending-blocked。

### AT-ST-C13-002 打出财神成为所有者并限制三家

- 所属功能点：FP-ST-C13-001 飘财窗口归属与转移（PRD 第 171 行）
- **需求规则**：打出财神的玩家成为所有者，限制另外三家。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端需区分展示——打出财神者不受限、另外三家进入受限状态，两者呈现必须不同；复核说明指出 `client-evidence.json` 12 条证据仅挂 AT-ST-C01-001/002/003/004/005/009/010/011，全文检索「飘」命中 0，无窗口归属或受限态条目。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：把打出财神的玩家记为飘财窗口所有者，并令另外三家进入受限状态，同时下发窗口归属与受限状态；未登记开关。证据定位：无（`server-evidence.json` 60 条仅覆盖 AT-ST-C01 系列）。
- **双端协作**：某玩家打出财神 → 服务端记录该玩家为窗口所有者并限制其余三家 → 下发窗口归属与受限状态 → 客户端按归属显示各座位的受限表现。
- **业务行为**：
  - trigger：玩家打出财神
  - condition：打出时对局进行中
  - action：客户端应区分展示所有者与另外三家的受限状态；服务端把打出者记为所有者、令另外三家受限
  - result：玩家看到打出财神的人处于正常状态，其余三家被限制，彼此显示状态不同
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：验证范围为双端，但客户端与服务端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），无法核对所有者与受限三家是否按需求区分，按证据空缺归为未验证。
  待审批建议：unverified（`no-server-evidence-is-not-conflict`：双端均无飘财窗口证据，属取证空缺而非矛盾，不升级 conflict）。复核理由补充：需求为 PRD 第 171 行「打出财神的玩家成为飘财窗口所有者，另外三家进入受限状态，二者受限表现不同」；客户端侧无飘财相关 CLE（CLE-AT-ST-C01-003-02 只证明翻财神动效与白板替身、CLE-AT-ST-C01-002-02 只证明二人房 gameId）；服务端侧无窗口所有者与三家受限的判定证据（SVE-AT-ST-C01-003-01 只证明财神取白板牌种、SVE-AT-ST-C01-019-03 只证明三摊承包）。该建议**未生效**。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（按当前生效的 effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C13-003 再有人打出财神窗口直接转移

- 所属功能点：FP-ST-C13-001 飘财窗口归属与转移（PRD 第 171 行）
- **需求规则**：之后再有人打出财神，窗口直接换到这个人，不叠加。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端按新归属刷新各座位状态，不保留原所有者的窗口标识；本项验证范围限定服务端规则。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：窗口已存在时，把归属直接改为本次打出财神的玩家，原所有者解除，不做叠加、不保留并列窗口，受限范围随之改判；未登记开关。证据定位：无。
- **双端协作**：窗口存在中 → 另一名玩家打出财神 → 服务端将窗口归属改为该玩家、原所有者解除 → 受限范围随之改判 → 客户端按新归属刷新。
- **业务行为**：
  - trigger：飘财窗口存在期间又有人打出财神
  - condition：当前已存在飘财窗口
  - action：客户端本项不作为判定依据；服务端直接把窗口转移到这次打出财神的玩家身上
  - result：玩家看到窗口换到了新打财神的人身上，原打财神者不再拥有窗口，也不存在两个窗口叠加
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：验证范围为服务端，但服务端 applicability 为空、无证据、无矛盾证据，无法确认窗口转移而非叠加，按证据空缺归为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C13-004 被逼打出摸到的财神窗口转移

- 所属功能点：FP-ST-C13-001 飘财窗口归属与转移（PRD 第 171 行）
- **需求规则**：受限玩家若被逼打出刚摸到的财神，窗口就转到他身上。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端按新归属刷新——原受限玩家不再显示受限、原所有者失去窗口标识、其余三家转为受限。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：识别受限玩家被迫（只能打刚摸进那张）打出财神这一情形，把窗口转给该玩家，原所有者不再是所有者；未登记开关。证据定位：无。
- **双端协作**：受限玩家因被迫只能打出刚摸到的财神 → 服务端识别该打出并把窗口转移给他 → 原所有者解除归属、新所有者接手限制其余三家 → 客户端刷新归属与受限状态。
- **业务行为**：
  - trigger：受限玩家被逼打出刚摸到的财神
  - condition：该玩家正处于受限状态
  - action：客户端按新归属刷新各座位受限表现；服务端把飘财窗口转到这名受限玩家身上
  - result：玩家看到原先受限的人变成了窗口所有者，原所有者被解除，受限对象换成了其他三家
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：验证范围为双端，但两端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），无法确认被迫打出财神时窗口是否转移，按证据空缺归为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C13-005 受限时可胡牌和暗杠

- 所属功能点：FP-ST-C13-002 受限玩家的操作范围（PRD 第 173 行）
- **需求规则**：受限时可以胡牌和暗杠。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：受限状态下仍向该玩家呈现胡牌与暗杠的操作入口，这两个入口不被受限状态屏蔽；`uiRequirement` 为空。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：对受限玩家的胡牌与暗杠请求照常放行，不以受限状态为由拒绝；未登记开关。证据定位：无。
- **双端协作**：受限玩家凑成胡牌或暗杠条件 → 客户端照常给出胡/暗杠操作 → 服务端受理并执行 → 对局结果按该操作推进。
- **业务行为**：
  - trigger：受限玩家出现可胡牌或可暗杠的机会
  - condition：玩家处于受限状态
  - action：客户端照常呈现胡牌与暗杠入口；服务端照常放行这两类请求
  - result：受限玩家仍能照常胡牌和暗杠，受限只限制吃碰杠与出牌范围，不影响这两项操作
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：验证范围为双端，但两端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），无法确认受限时胡牌与暗杠是否被放行，按证据空缺归为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C13-006 受限时禁止吃碰直杠加杠

- 所属功能点：FP-ST-C13-002 受限玩家的操作范围（PRD 第 173 行）
- **需求规则**：受限时不能吃、碰、直杠、加杠。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：受限时不给该玩家展示吃、碰、直杠、加杠的操作入口（入口隐藏或置灰），与允许项（胡牌、暗杠）形成差异。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：拒绝受限玩家的吃、碰、直杠、加杠请求，只保留胡牌与暗杠等允许操作；未登记开关（既非 `rule_chi_peng` 档位控制，也非 `only_pung_no_chow` 控制，属飘财受限态自身的拒绝逻辑）。证据定位：无；现有吃碰类证据 SVE-AT-ST-C01-018-02（`hzmj_server/game_logic.cpp:112-121`，`chi-peng-mode-config-parse`）只解析吃碰档位，未覆盖受限态拒绝。
- **双端协作**：受限玩家遇到可吃碰杠的牌 → 客户端不提供这些操作 → 即便发起请求，服务端也按受限规则拒绝 → 玩家只能走允许的操作。
- **业务行为**：
  - trigger：受限玩家出现可吃、可碰、可直杠或可加杠的机会
  - condition：玩家处于受限状态
  - action：客户端不展示这四类操作入口；服务端拒绝这四类请求
  - result：受限玩家在对局中无法吃、碰、直杠或加杠，这些操作入口消失或不可用
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：验证范围为双端，但两端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），无法确认受限时吃碰直杠加杠是否被禁止，按证据空缺归为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C13-007 受限时只能打刚摸进的牌

- 所属功能点：FP-ST-C13-002 受限玩家的操作范围（PRD 第 173 行）
- **需求规则**：只能打刚摸进或最新补进的那一张。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：出牌阶段只放开「刚摸进或最新补进」那一张为可点选，其余手牌不可点；「最新补进」需覆盖补杠/补花等补牌路径，而非仅摸牌路径。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：只接受该玩家打出刚摸进或最新补进的那一张，其他牌一律不接受；未登记开关。证据定位：无。
- **双端协作**：轮到受限玩家出牌 → 客户端把可出牌锁定为刚摸进/最新补进的那一张 → 玩家点击出牌 → 服务端校验牌面一致后放行。
- **业务行为**：
  - trigger：受限玩家进入出牌阶段
  - condition：玩家处于受限状态
  - action：客户端只让该玩家点选那一张牌出牌，其余手牌不可点；服务端只接受该张、拒绝其他牌
  - result：受限玩家每轮只能把刚摸进或最新补进的那一张打出去，不能挑别的牌打
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：验证范围为双端，但两端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），无法确认出牌是否被限定为唯一一张，按证据空缺归为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C13-008 受限时其余手牌压暗

- 所属功能点：FP-ST-C13-002 受限玩家的操作范围（PRD 第 173 行）
- **需求规则**：其余手牌压暗，只在自己界面显示。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。UI 需求（`uiRequirement`）为「受限玩家除刚摸进或最新补进那张外的其余手牌压暗，且仅在该玩家自己的界面可见显示」。实现要点（需求口径，非证据）：仅本人客户端对除可出那张外的手牌施加压暗表现；其他三家的界面不出现这些牌的牌面。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：仅向该玩家本人下发完整手牌，对其他三家不下发受限玩家的其余手牌，避免被他人看到（可见性由下发粒度保证，而非仅靠客户端遮挡）；未登记开关。证据定位：无。
- **双端协作**：玩家进入受限 → 服务端仅向本人同步其手牌 → 客户端在本界面把除可出那张外的手牌压暗 → 其他三家的界面不显示这些牌。
- **业务行为**：
  - trigger：受限玩家处于受限状态、开始进行本轮的牌面查看
  - condition：玩家处于受限状态
  - action：客户端把其余手牌压暗且仅本人可见；服务端只向本人下发完整手牌
  - result：受限玩家自己能看到自己手牌（大部分被压暗，只剩可打那张亮着），另外三家看不到他的这些手牌
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：验证范围为双端，但两端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），无法确认其余手牌是否压暗且仅本人可见，按证据空缺归为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C13-009 飘财限制盖过吃碰禁手

- 所属功能点：FP-ST-C13-002 受限玩家的操作范围（PRD 第 173 行）
- **需求规则**：这份限制盖过吃碰禁手。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端按服务端给出的最终可操作范围展示，不叠加另一套禁手判断；本项验证范围限定服务端规则。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：飘财受限与吃碰禁手同时命中同一玩家时，以飘财受限的判定结果为准、覆盖禁手结果（优先级仲裁，非交集合并）；未登记开关。证据定位：无；复核说明指出 SVE-AT-ST-C01-018-02（`hzmj_server/game_logic.cpp:112-121`）与 SVE-AT-ST-C01-019-03（`hzmj_server/game_logic.cpp:65-87`）只说明吃碰档位与三摊承包生效方式，未见飘财受限与禁手的优先级仲裁代码。
- **双端协作**：玩家同时触发飘财限制与吃碰禁手 → 服务端按飘财限制优先出具可操作范围、覆盖禁手结果 → 客户端按最终范围展示操作。
- **业务行为**：
  - trigger：飘财限制与吃碰禁手规则同时命中同一玩家
  - condition：玩家处于受限状态，同时存在吃碰禁手条件
  - action：客户端本项不作为判定依据；服务端以飘财限制为准，覆盖吃碰禁手结果
  - result：受限玩家能做什么、不能做什么，最终以飘财限制的规定为准，吃碰禁手不再单独改变结果
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：验证范围为服务端，但服务端 applicability 为空、无证据、无矛盾证据，无法确认两条规则冲突时飘财限制是否优先，按证据空缺归为未验证。两条规则的覆盖关系属实现细节，无证据不能推定与需求相反。
  待审批建议：unverified（`no-server-evidence-is-not-conflict`：规则优先级仲裁无服务端证据，不等于与需求冲突）。复核理由补充：需求为 PRD 第 173 行「飘财限制优先、覆盖禁手判定」；客户端无受限态下可操作范围的界面证据（现有 CLE 仅覆盖 C01-001~011，复核提及的 CLE-AT-ST-C01-019 系列并不存在）。该建议**未生效**。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C13-010 所有者下一次出牌先关窗

- 所属功能点：FP-ST-C13-003 所有者出牌关窗与重开（PRD 第 174 行）
- **需求规则**：所有者自己下一次出牌时先关掉窗口。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：所有者出牌生效后同步关闭窗口带来的受限显示，另外三家恢复常规出牌与吃碰杠界面。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：所有者这次出牌生效时**先**关闭飘财窗口、解除三家受限，再处理本次出牌（关窗时序在出牌结算之前）；未登记开关。证据定位：无。
- **双端协作**：轮到所有者出牌 → 服务端先关闭飘财窗口、解除三家受限 → 再处理本次出牌 → 客户端刷新窗口消失、三家恢复常态。
- **业务行为**：
  - trigger：飘财窗口所有者轮到自己进行下一次出牌
  - condition：该玩家正是当前飘财窗口的所有者
  - action：客户端同步关闭受限显示；服务端在本次出牌生效时先关窗并解除三家受限
  - result：所有者一出牌窗口就消失，另外三家恢复正常，不再受飘财限制
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：验证范围为双端，但两端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），无法确认出牌时是否先关窗并解除受限，按证据空缺归为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C13-011 打出的仍是财神则立刻重开

- 所属功能点：FP-ST-C13-003 所有者出牌关窗与重开（PRD 第 174 行）
- **需求规则**：这张若又是财神，立刻重开。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：重开后立刻重新显示飘财窗口与三家受限状态，窗口标识回到该玩家座位。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：先按 AT-ST-C13-010 关窗，再检查本次打出的牌，若仍为财神则立即重开窗口、该玩家继续作为所有者限制另外三家（关窗与重开在同一出牌处理流程内完成）；未登记开关。证据定位：无。
- **双端协作**：所有者出牌 → 服务端先关窗再检查打出的牌 → 若仍是财神则立刻重开窗口、归属仍为该玩家 → 客户端重新显示受限效果。
- **业务行为**：
  - trigger：窗口所有者关窗后打出的那张牌又是财神
  - condition：关窗动作之后本次打出的牌仍为财神
  - action：客户端立刻重新显示窗口与三家受限；服务端识别后立即重开窗口
  - result：玩家看到窗口刚关就又立刻打开，该玩家继续是所有者，三家继续受限
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：验证范围为双端，但两端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），无法确认再打财神时是否立即重开窗口，按证据空缺归为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C13-012 飘档加一条件

- 所属功能点：FP-ST-C13-004 飘档与杠链累计清零（PRD 第 175 行）
- **需求规则**：飘档只在打出财神、且打出后手牌仍然敲响时加 1。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端不自行计算飘档，只展示服务端下发的数值；本项验证范围限定服务端规则。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：两个条件同时成立才加 1——本次打出的是财神，且打出后该玩家手牌仍处敲响状态；缺一不加（未敲响情形见 AT-ST-C13-013 的归零规则）；未登记开关。证据定位：无；复核说明指出 `server-evidence.json` 60 条全文检索「飘」「飘档」「piao」命中 0，SVE-AT-ST-C01-010-02（`mah_frame/base/base_config.cpp:36`，`base-score-default-one`）与 SVE-AT-ST-C01-021-02（`common_game/com_game/common_game_com_result.cpp:289-295`，`contract-settle-guarded-by-three-tan-flag`）均与飘档计数无关。
- **双端协作**：玩家打出财神 → 服务端判定打出后手牌是否仍敲响 → 仍敲响则飘档加 1 → 将新的飘档计入该玩家结算数据。
- **业务行为**：
  - trigger：玩家打出财神
  - condition：打出这张财神之后，该玩家手牌仍然保持敲响状态
  - action：客户端本项不作为判定依据；服务端把该玩家飘档加 1
  - result：玩家看到自己的飘档数字增加 1，且只在打出财神后手牌仍敲响时才会增加
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：验证范围为服务端，但服务端 applicability 为空、无证据、无矛盾证据，无法确认飘档加 1 的条件与时机，按证据空缺归为未验证。
  待审批建议：unverified（`no-server-evidence-is-not-conflict`：飘档计数无服务端证据，仅属取证空缺）。复核理由补充：需求为 PRD 第 175 行「仅在打出财神且打出后手牌仍敲响时飘档加 1」；客户端 CLE 未覆盖飘档计数（CLE-AT-ST-C01-004-03/04 只证明牢庄档位与庄闲倍数换算）。该建议**未生效**。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C13-013 未敲响打财神飘档杠链归零

- 所属功能点：FP-ST-C13-004 飘档与杠链累计清零（PRD 第 175 行）
- **需求规则**：没敲响就打财神，飘档和杠链都归零。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端仅在展示层反映清零后的数值；本项验证范围限定服务端规则。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：打出财神但打出后手牌未敲响时，飘档与杠链**同时**归零（对比 AT-ST-C13-016 吃碰杠不清飘档）；未登记开关。证据定位：无。
- **双端协作**：玩家打出财神 → 服务端判定打出后手牌未敲响 → 飘档与杠链同时清零 → 按清零后的数值参与结算。
- **业务行为**：
  - trigger：玩家打出财神
  - condition：打出这张财神后，该玩家手牌已不再敲响
  - action：客户端本项不作为判定依据；服务端把飘档与杠链一并归零
  - result：玩家看到自己的飘档和杠链都回到 0，不会因为这次打财神还保留原来的累计
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：验证范围为服务端，但服务端 applicability 为空、无证据、无矛盾证据，无法确认未敲响打财神时是否飘档与杠链同时归零，按证据空缺归为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C13-014 打出普通牌归零

- 所属功能点：FP-ST-C13-004 飘档与杠链累计清零（PRD 第 175 行）
- **需求规则**：打出普通牌同样归零。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端展示层按服务端下发值刷新；本项验证范围限定服务端规则。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：玩家打出非财神的普通牌时，其飘档与杠链同样归零（与 AT-ST-C13-013 归零结果一致，但触发条件为普通出牌）；未登记开关。证据定位：无。
- **双端协作**：玩家打出普通牌 → 服务端按普通出牌处理并清零该玩家飘档与杠链 → 按清零后的数值参与结算。
- **业务行为**：
  - trigger：玩家打出普通牌（非财神）
  - condition：对局进行中，玩家完成一次普通出牌
  - action：客户端本项不作为判定依据；服务端把该玩家飘档与杠链归零
  - result：玩家看到自己一打普通牌，飘档和杠链就都归零，不能靠普通牌续着累计
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：验证范围为服务端，但服务端 applicability 为空、无证据、无矛盾证据，无法确认打普通牌是否同样使飘档与杠链归零，按证据空缺归为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C13-015 各家飘档独立

- 所属功能点：FP-ST-C13-004 飘档与杠链累计清零（PRD 第 175 行）
- **需求规则**：各家飘档独立。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端按座位分别展示各自飘档；本项验证范围限定服务端规则。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：飘档按座位分别记录、单独增减，一名玩家变化不影响他人（数据维度为 per-seat 而非全场共享）；未登记开关。证据定位：无。
- **双端协作**：某玩家飘档发生增减 → 服务端只更新该座位的数据 → 其他座位飘档保持不变 → 结算时按各自数值分别计算。
- **业务行为**：
  - trigger：对局中各玩家的飘档发生变化（有人打出财神或普通牌等）
  - condition：对局进行中，每名玩家各自记录自己的飘档
  - action：客户端本项不作为判定依据；服务端按座位分别记录并单独增减
  - result：玩家看到每个人的飘档各自独立，别人飘档变化不会带动自己的数
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：验证范围为服务端，但服务端 applicability 为空、无证据、无矛盾证据，无法确认飘档是否按座位独立计算，按证据空缺归为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C13-016 吃碰杠不清飘档

- 所属功能点：FP-ST-C13-004 飘档与杠链累计清零（PRD 第 175 行）
- **需求规则**：吃、碰、杠不清飘档。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端在吃碰杠后不改变飘档展示值；本项验证范围限定服务端规则。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：处理吃、碰、杠时不清空该玩家飘档，保留原数值（三种操作同口径，与 AT-ST-C13-017 的杠链规则区分）；未登记开关。证据定位：无。
- **双端协作**：玩家吃/碰/杠 → 服务端正常处理牌型变化 → 飘档数值原样保留 → 后续结算沿用该飘档。
- **业务行为**：
  - trigger：玩家进行吃、碰或杠
  - condition：该玩家已有飘档累计
  - action：客户端本项不作为判定依据；服务端在处理吃/碰/杠时不清空飘档
  - result：玩家看到自己吃碰杠之后飘档数字不变，不会被清掉
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：验证范围为服务端，但服务端 applicability 为空、无证据、无矛盾证据，无法确认吃碰杠是否保留飘档，按证据空缺归为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C13-017 吃和碰清杠链

- 所属功能点：FP-ST-C13-004 飘档与杠链累计清零（PRD 第 175 行）
- **需求规则**：吃和碰会清杠链。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端按服务端下发值刷新杠链相关展示；本项验证范围限定服务端规则。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：处理吃或碰时把该玩家杠链归零，之后杠链相关结算从 0 重新起算；杠（明杠/暗杠/加杠）不在清零触发集合内；未登记开关。证据定位：无。
- **双端协作**：玩家吃或碰 → 服务端处理牌型 → 同步把该玩家杠链归零 → 后续杠链相关结算从 0 重新起算。
- **业务行为**：
  - trigger：玩家进行吃或碰
  - condition：该玩家已有杠链累计
  - action：客户端本项不作为判定依据；服务端在处理吃或碰时清空杠链
  - result：玩家看到自己吃或碰之后杠链归零，之前的连续杠不再延续
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：验证范围为服务端，但服务端 applicability 为空、无证据、无矛盾证据，无法确认吃碰是否清空杠链，按证据空缺归为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C13-018 飘次数本局累加

- 所属功能点：FP-ST-C13-005 飘次数累计与飘字展示（PRD 第 176 行）
- **需求规则**：飘次数本局累加，小局重置时清掉。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端只按服务端下发的飘次数驱动展示；本项验证范围限定服务端规则。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：本局内对玩家的飘次数逐次累加，中途不清零、不封顶（与「飘档」为不同计数，重置时机见 AT-ST-C13-019）；未登记开关。证据定位：无。
- **双端协作**：玩家每次飘财 → 服务端把该玩家飘次数加 1 → 本局内持续累计 → 本局结算按累计次数计算。
- **业务行为**：
  - trigger：玩家发生一次飘财
  - condition：本局对局进行中
  - action：客户端本项不作为判定依据；服务端在本局内逐次累加飘次数
  - result：玩家看到自己本局的飘次数一直往上加，不会中途被清零
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：验证范围为服务端，但服务端 applicability 为空、无证据、无矛盾证据，无法确认飘次数是否在本局内累加，按证据空缺归为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C13-019 小局重置清掉飘次数

- 所属功能点：FP-ST-C13-005 飘次数累计与飘字展示（PRD 第 176 行）
- **需求规则**：小局重置时清掉。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：新小局开始后客户端不再显示上一小局的飘次数；本项验证范围限定服务端规则。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：小局重置环节把所有玩家的飘次数清零，新小局从 0 起算；重置触发点为小局边界，非单局（大局）结束；未登记开关。证据定位：无。
- **双端协作**：一小局结束 → 服务端执行小局重置 → 清掉所有玩家的飘次数 → 新小局从 0 开始累计。
- **业务行为**：
  - trigger：小局结束进入下一小局的重置环节
  - condition：发生小局重置
  - action：客户端本项不作为判定依据；服务端在小局重置时把各玩家飘次数清零
  - result：玩家看到新一小局开始时飘次数都回到 0，上一小局的累计不带入下一局
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：验证范围为服务端，但服务端 applicability 为空、无证据、无矛盾证据，无法确认小局重置时飘次数是否清零，按证据空缺归为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C13-020 座位碰杠位播放飘字

- 所属功能点：FP-ST-C13-005 飘次数累计与飘字展示（PRD 第 176 行）
- **需求规则**：次数大于 0 时，在该座位碰杠位播放「飘」字，没有常驻标签。
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。UI 需求（`uiRequirement`）为「次数大于 0 时在该座位碰杠位播放「飘」字，不设置常驻标签」。实现要点（需求口径，非证据）：播放位置为该座位的碰杠位（非固定 HUD 角标）；触发条件为飘次数 > 0；播放为一次性动画/特效，播完不残留常驻标签，也不以常驻 Text 显示次数。复核说明指出 `client-evidence.json` 12 条中无一条指向本原子，全文检索「飘」命中 0，既无碰杠位飘字播放的代码或 FGUI 证据，也无 client-visual 对照。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。本原子验证范围为客户端界面表现，服务端如何下发飘次数不作为判定依据（服务端仅需提供次数数据源，计数规则见 AT-ST-C13-018 / 019）。证据定位：无（本项服务端缺失不作为判据）。
- **双端协作**：服务端记录该座位飘次数大于 0 → 客户端在对应座位的碰杠位触发一次「飘」字播放 → 播放结束不留下常驻标签。
- **业务行为**：
  - trigger：某座位的飘次数变为大于 0
  - condition：该座位飘次数大于 0；本项验证范围为客户端界面表现
  - action：客户端在该座位的碰杠位播放「飘」字效果，且不做成常驻标签
  - result：玩家看到该座位碰杠位闪出「飘」字，播完就消失，不会一直挂着标签
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：验证范围为客户端，但客户端亦无证据（verdict 为空、evidenceIds 为空、无矛盾证据），无法核对「飘」字是否在碰杠位播放且无常驻标签，按证据空缺归为未验证；无证据不得推定与需求一致。
  待审批建议：unverified（`evidence-is-not-consistency`：客户端无证据时不得判 consistent，维持未验证）。复核理由补充：需求为 PRD 第 176 行纯客户端表现（verificationScope=client）；现有 CLE 覆盖范围为 AT-ST-C01-001~011（CLE-AT-ST-C01-009-01 只证明牌桌底分文本、CLE-AT-ST-C01-009-03 只证明听牌面板封顶文本）。该建议**未生效**。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

## 证据索引

本阶段 20 个原子在统一原子视图中均未挂证据：`clientEvidenceIds` 与 `serverEvidenceIds` 全为空，`trace_index.json` 对本阶段条目记录 `evidenceCount=0`。全部 CLE（12 条）的 atomIds 均属 AT-ST-C01 系列，全部 SVE（60 条）的 atomIds 均属 AT-ST-C01 系列，两端证据文本检索「飘」「飘档」「piao」命中 0。因此本阶段无原子级证据可列。

下表仅列出复核说明中跨原子引用、可作为后续补证线索的条目，均**不属于本阶段原子级证据**：

| 证据 id | layer | file:line | claimKey | 引用原子（复核） | 说明 |
|---|---|---|---|---|---|
| CLE-AT-ST-C01-003-02 | client_code | data/GameData.ts:50 | cai-shen-type-values | AT-ST-C13-002 | 定义「0=白板财神，1=翻财神」，只证明翻财神动效与白板替身，不涉及飘财窗口 |
| CLE-AT-ST-C01-002-02 | client_code | config/GameDefine.ts:4-7 | er-ren-room-gameid | AT-ST-C13-002 | 仅证明二人房 gameId，与飘财归属无关 |
| CLE-AT-ST-C01-004-03 | client_code | controller/cmd/gameCmd/GameJuDataCmd.ts:34-35 | lian-zhuang-level-from-room-config | AT-ST-C13-012 | 只证明牢庄档位，不涉及飘档计数 |
| CLE-AT-ST-C01-004-04 | client_code | data/GameData.ts:1664-1666 | banker-level-multiplier | AT-ST-C13-012 | 只证明庄闲倍数换算，不涉及飘档计数 |
| CLE-AT-ST-C01-009-01 | client_code | layer/BoxHzmjBackView.ts:86-88 | base-score-display-in-table | AT-ST-C13-020 | 只证明牌桌底分文本，不涉及碰杠位「飘」字 |
| CLE-AT-ST-C01-009-03 | client_code | layer/BoxHzmjTingPaiView.ts:95-99 | feng-ding-status-text | AT-ST-C13-020 | 只证明听牌面板封顶文本，不涉及「飘」字播放 |
| SVE-AT-ST-C01-003-01 | common_game | common_game/com_game/common_game_com_ju.cpp:226-248 | cai-shen-type-behavior | AT-ST-C13-002 | 只证明财神取白板牌种，不涉及窗口所有者与三家受限 |
| SVE-AT-ST-C01-018-02 | hzmj_server | hzmj_server/game_logic.cpp:112-121 | chi-peng-mode-config-parse | AT-ST-C13-006 / 009 | 只说明吃碰档位（`rule_chi_peng`）解析，不覆盖受限态拒绝与优先级仲裁 |
| SVE-AT-ST-C01-019-03 | hzmj_server | hzmj_server/game_logic.cpp:65-87 | three-tan-forced-off-for-two-players | AT-ST-C13-009 | 只说明三摊承包（≤2 人强制关闭），不涉及飘财限制优先级 |
| SVE-AT-ST-C01-010-02 | mah_frame | mah_frame/base/base_config.cpp:36 | base-score-default-one | AT-ST-C13-012 | 只证明底分默认值，不涉及飘档加 1 条件 |
| SVE-AT-ST-C01-021-02 | common_game | common_game/com_game/common_game_com_result.cpp:289-295 | contract-settle-guarded-by-three-tan-flag | AT-ST-C13-012 | 只证明三摊承包结算开关，不涉及飘档计入结算 |

补充说明：

- 复核说明提及的 CLE-AT-ST-C01-019 系列条目并不存在，不得作为证据引用。
- 本阶段不存在 `directConflict=true` 的原子，也无 `conflictEvidenceIds`。

## 待处理事项

### 待验证（规则待验证，补证 both）

`pending-list.md` 中本阶段共 20 条，问题类型均为「规则待验证」，说明为「证据不足」，建议动作均为「补证 both」；其中 4 条附有待审批复核建议。

| atomId | 验证范围 | 说明 | 建议动作 |
|---|---|---|---|
| AT-ST-C13-001 | server | 证据不足 | 补证 both |
| AT-ST-C13-002 | both | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C13-003 | server | 证据不足 | 补证 both |
| AT-ST-C13-004 | both | 证据不足 | 补证 both |
| AT-ST-C13-005 | both | 证据不足 | 补证 both |
| AT-ST-C13-006 | both | 证据不足 | 补证 both |
| AT-ST-C13-007 | both | 证据不足 | 补证 both |
| AT-ST-C13-008 | both | 证据不足 | 补证 both |
| AT-ST-C13-009 | server | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C13-010 | both | 证据不足 | 补证 both |
| AT-ST-C13-011 | both | 证据不足 | 补证 both |
| AT-ST-C13-012 | server | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C13-013 | server | 证据不足 | 补证 both |
| AT-ST-C13-014 | server | 证据不足 | 补证 both |
| AT-ST-C13-015 | server | 证据不足 | 补证 both |
| AT-ST-C13-016 | server | 证据不足 | 补证 both |
| AT-ST-C13-017 | server | 证据不足 | 补证 both |
| AT-ST-C13-018 | server | 证据不足 | 补证 both |
| AT-ST-C13-019 | server | 证据不足 | 补证 both |
| AT-ST-C13-020 | client | 证据不足（另有待审批复核建议：unverified） | 补证 both |

查证未完成（必要端缺口）：本阶段 0 条（`analysisPath` 全为 full，无 pending/timeout/failed 导致的阻塞）。
需策划裁决（decision_required）：本阶段 0 条。

### 待审批建议（reviewStatus=pending，均未生效）

| atomId | 建议差异 | 复核规则 | 状态 |
|---|---|---|---|
| AT-ST-C13-002 | unverified | no-server-evidence-is-not-conflict（双端均无飘财窗口证据，属取证空缺而非矛盾，不升级 conflict） | pending / 未生效 |
| AT-ST-C13-009 | unverified | no-server-evidence-is-not-conflict（规则优先级仲裁无服务端证据，不等于与需求冲突） | pending / 未生效 |
| AT-ST-C13-012 | unverified | no-server-evidence-is-not-conflict（飘档计数无服务端证据，仅属取证空缺） | pending / 未生效 |
| AT-ST-C13-020 | unverified | evidence-is-not-consistency（客户端无证据时不得判 consistent，维持未验证） | pending / 未生效 |

建议动作：审批（approve/reject/hold）。四条建议的 reviewedDifference 均为 unverified，与当前生效的 effectiveDifference 相同，获批后不改变差异口径与 L7 结论。

### 补证方向（供后续取证参考，非结论）

- 窗口归属与转移（001-004）：需服务端飘财窗口的数据结构与生命周期证据（唯一窗口的创建/改写而非追加），以及受限态按座位下发与客户端座位级渲染的对应证据；重点核对「被迫打财神」路径是否复用同一窗口转移逻辑。
- 受限操作范围（005-009）：需服务端操作请求校验中受限态的白/黑名单（胡、暗杠放行；吃、碰、直杠、加杠拒绝）与出牌牌张唯一性校验；需客户端操作入口显隐与手牌压暗（含对其他三家的可见性下发粒度）；优先级仲裁需给出飘财受限盖过 `rule_chi_peng` / `only_pung_no_chow` 的判定位置。
- 关窗与重开（010-011）：需所有者出牌处理流程中「先关窗、再判牌、仍是财神则重开」的时序证据，注意与出牌结算顺序耦合。
- 飘档与杠链（012-017）：需飘档/杠链的 per-seat 存储、加 1 条件（打出财神且打出后仍敲响）、未敲响与普通出牌归零、吃碰清杠链而吃碰杠不清飘档的分别证据。
- 飘次数与飘字（018-020）：需飘次数本局累加与「小局重置」清零的触发点证据（区分小局与大局边界）；客户端需补碰杠位「飘」字播放的一次性特效证据，以及无常驻标签（无 Text/角标）的对照。
