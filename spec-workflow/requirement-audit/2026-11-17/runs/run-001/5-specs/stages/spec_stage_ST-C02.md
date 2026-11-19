# ST-C02 复选规则组

## 阶段概述

本阶段规定好友房创房界面「复选规则组」10 个复选项各自的默认勾选态、显示条件（房型/吃碰档位/打片模式联动）与开启后的对局规则含义，客户端负责渲染与默认值、服务端按勾选结果决定摊计数、牌组、财神替牌与庄家/片数计量是否生效。

- 原子数：10（AT-ST-C02-001 ~ AT-ST-C02-010），分属 3 个功能点：FP-ST-C02-001 摊与财神相关复选项（001-004）、FP-ST-C02-002 风牌与花色复选项（005-007）、FP-ST-C02-003 财神与庄家复选项（008-010）。
- L7 分布：verified 0 / verification_required 10 / decision_required 0 / not_applicable 0。
- analysisPath 分布：10 个原子全部为 `full`（无 blocked、无 conflict-fast）。
- 取证现状：10 个原子在统一原子视图中双端字段均为空（`client.verdict` 空、`client.evidenceIds` 空、`server.applicability` 空、`server.evidenceIds` 空），`trace_index.json` 记录 `evidenceCount=0`；`client-evidence.json` 的 `coverage.pendingAtomIds` 明确列入本阶段全部 10 个原子；`server-evidence.json` 60 条证据中无 `atomIds` 含 C02 的记录。effectiveDifference 一律为 `unverified`，无 conflict，无升级候选（`candidateDifference` 全空）。
- 复核状态：AT-ST-C02-001 / 007 / 009 / 010 存在 `reviewStatus=pending` 的复核建议（建议值均为 unverified），尚未生效；其余 6 个原子无复核条目。
- 需求原文行号：PRD 第 38 行（碰算摊）、39 行（有财必拷响）、40 行（三财翻倍）、41 行（四财翻倍）、42 行（十风牌）、43 行（无风牌）、44 行（缺一色）、45 行（财神替豪七）、46 行（守庄）、47 行（连庄不占局数），均属「玩法选项（创房规则全集，规则不固定） > 复选规则组」章节。

| 原子 | 名称 | 验证范围 | difference | L7 | 复核建议 |
|---|---|---|---|---|---|
| AT-ST-C02-001 | 碰算摊默认开启且条件显示 | both | unverified | verification_required | pending（unverified） |
| AT-ST-C02-002 | 有财必拷响默认关闭 | both | unverified | verification_required | 无 |
| AT-ST-C02-003 | 三财翻倍默认关闭 | server | unverified | verification_required | 无 |
| AT-ST-C02-004 | 四财翻倍默认关闭 | server | unverified | verification_required | 无 |
| AT-ST-C02-005 | 十风牌默认开启 | server | unverified | verification_required | 无 |
| AT-ST-C02-006 | 无风牌默认关闭 | server | unverified | verification_required | 无 |
| AT-ST-C02-007 | 缺一色默认开启且仅限二三人房 | both | unverified | verification_required | pending（unverified） |
| AT-ST-C02-008 | 财神替豪七默认关闭 | both | unverified | verification_required | 无 |
| AT-ST-C02-009 | 守庄默认关闭且仅限三四房 | both | unverified | verification_required | pending（unverified） |
| AT-ST-C02-010 | 连庄不占局数默认关闭且仅限打片 | both | unverified | verification_required | pending（unverified） |

## 需求条目

### AT-ST-C02-001 碰算摊默认开启且条件显示

- 所属功能点：FP-ST-C02-001 摊与财神相关复选项（PRD 第 38 行）
- **需求规则**：复选项「碰算摊」默认开；仅当吃碰规则为只碰不吃或默认吃碰时显示；开启时碰也计入摊。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空，客户端未给出结论；`clientEvidenceIds` 为空，本轮 12 条 CLE 证据中无 `atomIds` 含 C02 的条目，`coverage.pendingAtomIds` 明确列出 AT-ST-C02-001，属取证空缺（`pending=false` 表示未登记等待状态，不代表已取证通过）。实现要点（按 `uiRequirement` 需求口径）：客户端需在创房面板渲染「碰算摊」复选项并预置为勾选态，且需按当前吃碰档位做显隐——仅「只碰不吃」或「默认吃碰」档显示，其他档位隐藏；房主提交创房规则时随规则一并提交该开关。本轮无任何面板显隐、默认值或提交链路的实现证据。
- **服务端职责**：`applicability` 为空，服务端未给出适用性判定；`serverEvidenceIds` 为空，无本原子证据。规则说明（需求口径）：服务端接收并保存该开关，结算摊计数时将「碰」也计入摊（每碰 +1 摊）。配置生效条件（`configCondition`）：本原子在索引中未登记 configCondition；复核引用指出与 `pung_as_tan` 开关相关——SVE-AT-ST-C01-019-04（`hzmj_server/server_config.cpp:20-21`，claimKey=`box-default-three-tan-off-pung-as-tan-on`）显示好友房默认 `SetPungAsTan(true)`，SVE-AT-ST-C01-019-01（`common_game/com_game/common_game_com_pung.cpp:125-138`，claimKey=`pung-counts-one-tan-when-pung-as-tan`，`BoxPungStep::Execute`）显示 `GetSvrCfg()->GetPungAsTan()` 为真时执行 `SetTanCount(... + 1)`。这两条只能证明服务端具备「碰计摊」能力与默认开值，未覆盖创房面板的显示条件与默认勾选，故不作为本原子证据（见复核规则 `common-capability-is-not-enabled`）。
- **双端协作**：房主在创房界面勾选 → 客户端把勾选结果随创房规则提交 → 服务端保存为本局规则 → 结算时按该规则判定摊（链路取自需求描述，双端实现证据均未取得）。
- **业务行为**：
  - trigger：房主在好友房创房界面查看并调整玩法选项
  - condition：吃碰规则选择为「只碰不吃」或「默认吃碰」时该项才出现，其他吃碰规则下不出现
  - action：客户端负责在创房界面显示「碰算摊」复选项并默认勾选，将房主的勾选结果随本局规则提交；服务端负责接收并保存该复选项，对局结算判定摊时把碰也计入摊
  - result：按需求房主应看到「碰算摊」默认开启，对局中碰也计入摊
  - 取证状态（业务行为条目原文补充）：本轮未取得创房界面的实现证据，实际显示条件未核实；服务端对应实现证据亦未取得。
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空（无升级候选）。
  `baselineDetail`：需求原文为「复选项「碰算摊」默认开，仅在吃碰规则为只碰不吃或默认吃碰时显示，开启时碰也计入摊」。实际表现：本轮未取得双端实现证据（该原子在客户端与服务端证据库中均无分析记录），无法判定符合性。
  待审批建议：unverified（`common-capability-is-not-enabled`：服务端碰算摊默认开与碰计摊口径存在，不等于本玩法创房界面复选框按需求呈现）。复核依据：客户端 verdict/evidenceIds 均空且 `coverage.pendingAtomIds` 含该原子；服务端 applicability/evidenceIds 均空，仅有 SVE-AT-ST-C01-019-04 与 SVE-AT-ST-C01-019-01 两条 conditional 旁证，不因服务端存在对应能力而升级。该建议**尚未生效**。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（依据 effectiveDifference=unverified 提议；scope=unknown，scopeSource=`default-unknown`）。

### AT-ST-C02-002 有财必拷响默认关闭

- 所属功能点：FP-ST-C02-001 摊与财神相关复选项（PRD 第 39 行）
- **需求规则**：复选项「有财必拷响」默认关，无显示条件限制而始终显示。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 含该原子，无 CLE 证据。实现要点（需求口径）：创房面板须始终渲染「有财必拷响」复选项（不随房型、吃碰档位或模式隐藏），初始为未勾选态，勾选结果随本局规则提交。本轮无面板渲染与默认值的实现证据。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，无本原子证据。规则说明（需求口径）：服务端接收并保存「有财必拷响」开关，对局中按该规则处理财神与拷响。配置生效条件（`configCondition`）：本原子未登记 configCondition，复核亦未引用任何可作旁证的服务端条目（该复选项无对应 SVE 记录）。
- **双端协作**：房主在创房界面勾选 → 客户端把勾选结果随创房规则提交 → 服务端保存为本局规则 → 对局按该规则处理（链路取自需求描述，双端实现证据均未取得）。
- **业务行为**：
  - trigger：房主在好友房创房界面查看并调整玩法选项
  - condition：无附加显示条件，应在任意房型下都出现
  - action：客户端负责在创房界面始终显示「有财必拷响」复选项并默认不勾选，将勾选结果随本局规则提交；服务端负责接收并保存该复选项，对局中按「有财必拷响」规则处理财神与拷响
  - result：按需求房主应看到「有财必拷响」默认关闭、可手动开启
  - 取证状态（原文补充）：本轮未取得创房界面的实现证据，实际显示情况未核实；服务端对应实现证据亦未取得。
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求原文为「复选项「有财必拷响」默认关，无显示条件限制而始终显示」。实际表现：本轮未取得双端实现证据（该原子在客户端与服务端证据库中均无分析记录），无法判定符合性。
  无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C02-003 三财翻倍默认关闭

- 所属功能点：FP-ST-C02-001 摊与财神相关复选项（PRD 第 40 行）
- **需求规则**：复选项「三财翻倍」默认关，无显示条件限制而始终显示；开启后按三财条件触发翻倍。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 含该原子。实现要点（需求口径）：客户端仅需在创房面板始终展示该复选项并默认不勾选、提交勾选结果，翻倍的判定与计算不在客户端；本原子验证范围限定为 server，客户端不承担规则正确性举证。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，无本原子证据。规则说明（需求口径）：服务端接收该开关，并在结算时按三财条件对番数执行翻倍。配置生效条件（`configCondition`）：本原子未登记 configCondition，复核未引用任何可作旁证的服务端条目（`server-evidence.json` 60 条中无 `atomIds` 含 C02 的记录，亦无针对「三财翻倍」开关的引用）。
- **双端协作**：房主勾选后提交创房规则 → 服务端保存开关 → 对局结算命中三财时对番数翻倍（链路取自需求描述，服务端实现证据未取得）。
- **业务行为**：
  - trigger：房主在创房界面勾选「三财翻倍」并开始对局
  - condition：复选项处于开启状态且本局满足三财条件
  - action：客户端负责在创房界面始终显示「三财翻倍」复选项并默认不勾选，将勾选结果随本局规则提交；服务端负责接收该复选项，并在结算时按三财条件对番数执行翻倍
  - result：按需求房主应看到「三财翻倍」默认关闭，开启后结算出现翻倍结果
  - 取证状态（原文补充）：本轮未取得服务端实现证据，实际生效条件未核实；客户端界面实现证据亦未取得。
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求原文为「复选项「三财翻倍」默认关，无显示条件限制而始终显示，开启后按三财条件触发翻倍」。实际表现：本轮未取得服务端实现证据（该原子在服务端证据库中无分析记录），无法判定符合性。
  无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C02-004 四财翻倍默认关闭

- 所属功能点：FP-ST-C02-001 摊与财神相关复选项（PRD 第 41 行）
- **需求规则**：复选项「四财翻倍」默认关，无显示条件限制而始终显示；开启后按四财条件触发翻倍。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 含该原子。实现要点（需求口径）：客户端只负责展示该复选项（始终可见、默认不勾选）并提交结果；四财翻倍的判定与计算在服务端，本原子验证范围限定为 server。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，无本原子证据。规则说明（需求口径）：服务端接收该开关，并在结算时按四财条件对番数执行翻倍。配置生效条件（`configCondition`）：本原子未登记 configCondition，复核未引用任何可作旁证的服务端条目。
- **双端协作**：房主勾选后提交创房规则 → 服务端保存开关 → 对局结算命中四财时对番数翻倍（链路取自需求描述，服务端实现证据未取得）。
- **业务行为**：
  - trigger：房主在创房界面勾选「四财翻倍」并开始对局
  - condition：复选项处于开启状态且本局满足四财条件
  - action：客户端负责在创房界面始终显示「四财翻倍」复选项并默认不勾选，将勾选结果随本局规则提交；服务端负责接收该复选项，并在结算时按四财条件对番数执行翻倍
  - result：按需求房主应看到「四财翻倍」默认关闭，开启后结算出现翻倍结果
  - 取证状态（原文补充）：本轮未取得服务端实现证据，实际生效条件未核实。
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求原文为「复选项「四财翻倍」默认关，无显示条件限制而始终显示，开启后按四财条件触发翻倍」。实际表现：本轮未取得服务端实现证据（该原子在服务端证据库中无分析记录），无法判定符合性。
  无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C02-005 十风牌默认开启

- 所属功能点：FP-ST-C02-002 风牌与花色复选项（PRD 第 42 行）
- **需求规则**：复选项「十风牌」默认开，无显示条件限制而始终显示；对应番型「十风」。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 含该原子。实现要点（需求口径）：客户端需始终展示该复选项并预置为勾选态、提交勾选结果；「十风」番型是否成立与番值计算由服务端负责，本原子验证范围限定为 server。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，无本原子证据。规则说明（需求口径）：服务端接收该开关，使对局中可判出「十风」番型（开关开启时「十风」番型成立，关闭时不应判出）。配置生效条件（`configCondition`）：本原子未登记 configCondition，复核未引用任何可作旁证的服务端条目。
- **双端协作**：房主在创房界面确认勾选 → 客户端提交本局规则 → 服务端按开关允许十风番型成立 → 结算展示十风（链路取自需求描述，双端实现证据均未取得）。
- **业务行为**：
  - trigger：房主在创房界面查看并调整玩法选项
  - condition：无附加显示条件，应在任意房型下都出现
  - action：客户端负责在创房界面始终显示「十风牌」复选项并默认勾选，将勾选结果随本局规则提交；服务端负责接收该复选项，使对局中可判出「十风」番型
  - result：按需求房主应看到「十风牌」默认开启，对局中可触发十风番型
  - 取证状态（原文补充）：本轮未取得界面实现证据，实际显示与默认勾选状态未核实；服务端实现证据亦未取得。
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求原文为「复选项「十风牌」默认开，无显示条件限制而始终显示，对应番型「十风」」。实际表现：本轮未取得服务端实现证据（该原子在服务端证据库中无分析记录），无法判定符合性。
  无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C02-006 无风牌默认关闭

- 所属功能点：FP-ST-C02-002 风牌与花色复选项（PRD 第 43 行）
- **需求规则**：复选项「无风牌」默认关，无显示条件限制而始终显示；开启时去掉风牌。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 含该原子。实现要点（需求口径）：客户端始终展示该复选项并默认不勾选、提交勾选结果；牌组是否剔除风牌属发牌侧规则，本原子验证范围限定为 server。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，无本原子证据。规则说明（需求口径）：服务端接收该开关，发牌时把风牌从牌组中去掉。配置生效条件（`configCondition`）：本原子未登记 configCondition，索引与复核均未引用风牌开关对应的服务端配置键或证据条目。
- **双端协作**：房主勾选后提交创房规则 → 服务端保存开关 → 开局发牌时牌组去掉风牌（链路取自需求描述，服务端实现证据未取得）。
- **业务行为**：
  - trigger：房主在创房界面勾选「无风牌」并开始对局
  - condition：复选项处于开启状态
  - action：客户端负责在创房界面始终显示「无风牌」复选项并默认不勾选，将勾选结果随本局规则提交；服务端负责接收该复选项，发牌时把风牌从牌组中去掉
  - result：按需求房主应看到「无风牌」默认关闭，开启后对局中不再出现风牌
  - 取证状态（原文补充）：本轮未取得服务端实现证据，发牌是否真正去风未核实。
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求原文为「复选项「无风牌」默认关，无显示条件限制而始终显示，开启时去掉风牌」。实际表现：本轮未取得服务端实现证据（该原子在服务端证据库中无分析记录），无法判定符合性。
  无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C02-007 缺一色默认开启且仅限二三人房

- 所属功能点：FP-ST-C02-002 风牌与花色复选项（PRD 第 44 行）
- **需求规则**：复选项「缺一色」默认开，仅 2/3 人房显示，4 人房不适用。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 含该原子，属取证空缺。实现要点（按 `uiRequirement` 需求口径）：客户端需按房型人数联动显隐——2 人房或 3 人房时显示该复选项且默认勾选，4 人房不显示（既不展示也不提交该项）；本轮无面板按人数显隐与默认勾选的实现证据。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，无本原子证据。规则说明（需求口径）：服务端接收该复选项并在 2/3 人局按缺一色规则处理发牌。配置生效条件（`configCondition`）：本原子未登记 configCondition；复核引用 SVE-AT-ST-C01-025-02（`common_game/common_game_server_config.h:55`，claimKey=`two-suit-only-2-3-players`，配置注释「缺一色（仅2/3人）」）与 SVE-AT-ST-C01-025-01（`common_game/common_game_init.cpp:57-58`，claimKey=`two-suit-init-player-count-guard`，`GetEnableTwoSuit() && GetPlayerCount() <= 3` 才剔除万字花色），二者仅证明服务端对局发牌侧的 2/3 人缺一色口径；且该开关在好友房创房默认配置中为关闭（SVE-AT-ST-C01-024-09，`hzmj_server/server_config.cpp:19-39`，`SetEnableTwoSuit(false)`），说明「默认勾选」只能由创房界面提供。故上述条目为本原子 conditional 旁证，不构成本原子证据。
- **双端协作**：房主切换房型人数 → 客户端按人数显隐该复选项 → 提交本局规则 → 服务端在 2/3 人局按缺一色规则处理（链路取自需求描述，双端实现证据均未取得）。
- **业务行为**：
  - trigger：房主在创房界面选择房型（人数）并查看玩法选项
  - condition：房型为 2 人或 3 人房时该选项出现并默认勾选，4 人房下不出现
  - action：客户端负责按房型人数决定是否显示「缺一色」并默认勾选，将勾选结果随本局规则提交；服务端负责接收该复选项并在 2/3 人局按缺一色规则处理
  - result：按需求 2/3 人房房主应看到「缺一色」默认开启，4 人房房主看不到该选项
  - 取证状态（原文补充）：本轮未取得创房界面的实现证据，按房型显隐与默认勾选未核实。
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求原文为「复选项「缺一色」默认开，仅 2/3 人房显示，4 人房不适用」。实际表现：本轮未取得双端实现证据（该原子在客户端与服务端证据库中均无分析记录），无法判定符合性。
  待审批建议：unverified（`common-capability-is-not-enabled`：缺一色 2/3 人房生效属服务端对局能力，不等于创房界面复选框已显示且默认勾选）。复核依据：客户端 verdict/evidenceIds 均空且 `coverage.pendingAtomIds` 含该原子；服务端 applicability/evidenceIds 均空，SVE-AT-ST-C01-025-02 与 SVE-AT-ST-C01-025-01 仅覆盖发牌侧房型范围，默认关值（SVE-AT-ST-C01-024-09）更说明默认勾选需界面提供，仍缺界面证据，故维持 unverified。该建议**尚未生效**。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C02-008 财神替豪七默认关闭

- 所属功能点：FP-ST-C02-003 财神与庄家复选项（PRD 第 45 行）
- **需求规则**：复选项「财神替豪七」默认关，无显示条件限制而始终显示；开启后财神可替代豪华七对所需牌。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 含该原子。实现要点（需求口径）：客户端始终展示该复选项并默认不勾选、随本局规则提交；财神能否顶替豪七缺牌属判型规则，客户端不承担该判定。本轮无面板渲染与默认值的实现证据。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，无本原子证据。规则说明（需求口径）：服务端接收该复选项，开启后允许财神替代豪华七对所需牌参与判型。配置生效条件（`configCondition`）：本原子未登记 configCondition，复核未引用任何可作旁证的服务端条目（无「财神替豪七」相关 SVE 记录）。
- **双端协作**：房主在创房界面勾选 → 客户端提交本局规则 → 服务端保存开关 → 对局判豪七时允许财神替代缺牌（链路取自需求描述，双端实现证据均未取得）。
- **业务行为**：
  - trigger：房主在创房界面查看并调整玩法选项
  - condition：无附加显示条件，应在任意房型下都出现
  - action：客户端负责在创房界面始终显示「财神替豪七」复选项并默认不勾选，将勾选结果随本局规则提交；服务端负责接收该复选项，开启后允许财神替代豪华七对所需牌参与判型
  - result：按需求房主应看到「财神替豪七」默认关闭，开启后财神可顶替豪七所缺牌
  - 取证状态（原文补充）：本轮未取得界面实现证据，实际显示与默认状态未核实。
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求原文为「复选项「财神替豪七」默认关，无显示条件限制而始终显示，开启后财神可替代豪华七对所需牌」。实际表现：本轮未取得双端实现证据（该原子在客户端与服务端证据库中均无分析记录），无法判定符合性。
  无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C02-009 守庄默认关闭且仅限三四房

- 所属功能点：FP-ST-C02-003 财神与庄家复选项（PRD 第 46 行）
- **需求规则**：复选项「守庄」默认关，仅 3/4 人房显示。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 含该原子。实现要点（按 `uiRequirement` 需求口径）：客户端需按房型联动显隐——3 人房或 4 人房时显示该复选项且默认不勾选，其他房型不显示；本轮无面板按房型显隐与默认值的实现证据。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，无本原子证据。规则说明（需求口径）：服务端接收该复选项并在 3/4 人局按守庄规则处理庄家轮转。配置生效条件（`configCondition`）：本原子未登记 configCondition；复核引用 SVE-AT-ST-C01-025-03（`common_game/common_game_server_config.h:65-66`，claimKey=`guard-dealer-only-3-4-players`，注释「守庄（仅3/4人局，2人局服务端安全判断强制关闭）」）与 SVE-AT-ST-C01-025-05（`hzmj_server/game_logic.cpp:149-161`，claimKey=`guard-dealer-player-count-guard`，`player_count <= 2` 时把 enable 置为 false 并回写），二者仅证明守庄判定的房型适用范围与 2 人局兜底关闭；默认值亦为关（SVE-AT-ST-C01-024-09，`hzmj_server/server_config.cpp:19-39`，`SetEnableGuardDealer(false)`），无法证明创房界面是否展示该复选项。上述条目为本原子 conditional 旁证，不构成本原子证据。
- **双端协作**：房主切换房型人数 → 客户端按人数显隐该复选项 → 提交本局规则 → 服务端在 3/4 人局按守庄规则处理（链路取自需求描述，双端实现证据均未取得）。
- **业务行为**：
  - trigger：房主在创房界面选择房型（人数）并查看玩法选项
  - condition：房型为 3 人或 4 人房时该选项出现且默认不勾选
  - action：客户端负责在 3/4 人房显示「守庄」复选项并默认不勾选，将勾选结果随本局规则提交；服务端负责接收该复选项并在 3/4 人局按守庄规则处理庄家轮转
  - result：按需求 3/4 人房房主应看到「守庄」默认关闭，其他房型房主看不到该选项
  - 取证状态（原文补充）：本轮未取得创房界面的实现证据，按房型显隐未核实。
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求原文为「复选项「守庄」默认关，仅 3/4 人房显示」。实际表现：本轮未取得双端实现证据（该原子在客户端与服务端证据库中均无分析记录），无法判定符合性。
  待审批建议：unverified（`common-capability-is-not-enabled`：守庄的 3/4 人房实现存在，不等于创房界面已按房型显示该复选框）。复核依据：客户端 verdict/evidenceIds 均空且 `coverage.pendingAtomIds` 含该原子；服务端 applicability/evidenceIds 均空，SVE-AT-ST-C01-025-03 与 SVE-AT-ST-C01-025-05 只证明判定范围与兜底关闭，与界面是否展示无直接关系，故维持 unverified。该建议**尚未生效**。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C02-010 连庄不占局数默认关闭且仅限打片

- 所属功能点：FP-ST-C02-003 财神与庄家复选项（PRD 第 47 行）
- **需求规则**：复选项「连庄不占局数」默认关，仅打片（40/50/60 片）模式显示；开启后连庄不消耗片数。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 含该原子。实现要点（按 `uiRequirement` 需求口径）：客户端需在打片（40/50/60 片）模式下显示该复选项并默认不勾选，其他模式不显示；本轮无模式联动显隐与默认值的实现证据。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，无本原子证据。规则说明（需求口径）：服务端接收该复选项，开启后连庄不消耗片数（打片房内庄家连庄胡时豁免整房结束判定）。配置生效条件（`configCondition`）：本原子未登记 configCondition；复核引用 SVE-AT-ST-C01-009-04（`hzmj_server/game_logic.cpp:175-183`，claimKey=`play-score-lian-zhuang-json-keys`，JSON 键说明「连庄不占局数（仅打片房）」）、SVE-AT-ST-C01-015-02（`hzmj_server/game_logic.cpp:180-183`，claimKey=`lian-zhuang-bu-zhan-config-parse`，解析 `lian_zhuang_bu_zhan`）与 SVE-AT-ST-C01-015-01（`common_game/com_game/common_game_com_result.cpp:57-76`，claimKey=`play-score-endgame-exempt-on-banker-win`，`GetPlayScore() > 0` 且 `GetLianZhuangBuZhan() && banker_win` 时跳过整房结束），仅证明服务端语义与默认关成立，缺创房界面在打片模式展示该复选框的证据。上述条目为本原子 conditional 旁证，不构成本原子证据。
- **双端协作**：房主切换到打片模式 → 客户端显示该复选项 → 提交本局规则 → 服务端在连庄时不再扣片（链路取自需求描述，双端实现证据均未取得）。
- **业务行为**：
  - trigger：房主在创房界面选择打片模式（40/50/60 片）并查看玩法选项
  - condition：对局模式为打片模式时该选项出现且默认不勾选
  - action：客户端负责在打片模式下显示「连庄不占局数」复选项并默认不勾选，将勾选结果随本局规则提交；服务端负责接收该复选项，开启后连庄不消耗片数
  - result：按需求打片模式房主应看到「连庄不占局数」默认关闭，开启后连庄不消耗片数
  - 取证状态（原文补充）：本轮未取得创房界面的实现证据，按模式显隐未核实。
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求原文为「复选项「连庄不占局数」默认关，仅打片（40/50/60 片）模式显示，开启后连庄不消耗片数」。实际表现：本轮未取得双端实现证据（该原子在客户端与服务端证据库中均无分析记录），无法判定符合性。
  待审批建议：unverified（`common-capability-is-not-enabled`：连庄不占局数的打片房语义齐备，不等于创房界面在打片模式已展示该复选框）。复核依据：客户端 verdict/evidenceIds 均空且 `coverage.pendingAtomIds` 含该原子；服务端 applicability/evidenceIds 均空，SVE-AT-ST-C01-009-04 / 015-02 / 015-01 只证明字段语义、解析与开启后行为，缺界面展示证据；与 AT-ST-C01-015 已按同一取证状态判 unverified 的口径一致，故不升级为 partial。该建议**尚未生效**。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

## 证据索引

本阶段 10 个原子在统一原子视图中均未挂原子级证据：`clientEvidenceIds` 与 `serverEvidenceIds` 全为空，`trace_index.json` 记录 `evidenceCount=0`；`client-evidence.json` 12 条 CLE 证据的 `atomIds` 全部属 AT-ST-C01 系列，无 AT-ST-C02 归属条目；`server-evidence.json` 60 条 SVE 证据中无 `atomIds` 含 C02 的记录。

下表列出复核说明（`difference-review.json`）中跨原子引用、可作后续补证线索的条目，**均不属于本阶段原子级证据**，applicability 均为 `conditional`：

| 证据 id | layer | file:line | claimKey | 引用位置（复核） | 说明 |
|---|---|---|---|---|---|
| SVE-AT-ST-C01-019-04 | hzmj_server | hzmj_server/server_config.cpp:20-21 | box-default-three-tan-off-pung-as-tan-on | AT-ST-C02-001 | 好友房创房默认 `SetPungAsTan(true)`，仅证明服务端碰算摊默认开，不含界面显示条件与默认勾选 |
| SVE-AT-ST-C01-019-01 | common_game | common_game/com_game/common_game_com_pung.cpp:125-138 | pung-counts-one-tan-when-pung-as-tan | AT-ST-C02-001 | `BoxPungStep::Execute` 中 `GetPungAsTan()` 为真时 `SetTanCount(... + 1)`，仅证明开启后碰计摊，不证明创房面板复选框存在 |
| SVE-AT-ST-C01-025-02 | common_game | common_game/common_game_server_config.h:55 | two-suit-only-2-3-players | AT-ST-C02-007 | 配置注释「缺一色（仅2/3人）」，只限定服务端房型范围，不涉及界面显隐与默认值 |
| SVE-AT-ST-C01-025-01 | common_game | common_game/common_game_init.cpp:57-58 | two-suit-init-player-count-guard | AT-ST-C02-007 | `GetEnableTwoSuit() && GetPlayerCount() <= 3` 时剔除万字花色，证明缺一色在 2/3 人局的发牌侧生效口径 |
| SVE-AT-ST-C01-024-09 | hzmj_server | hzmj_server/server_config.cpp:19-39 | box-default-config-values | AT-ST-C02-007 / 009（复核理由） | 好友房默认 `SetEnableTwoSuit(false)`、`SetEnableGuardDealer(false)`、`SetPungAsTan(true)`、`SetRuleChiPeng(0)`，说明默认勾选态只能由创房界面提供 |
| SVE-AT-ST-C01-025-03 | common_game | common_game/common_game_server_config.h:65-66 | guard-dealer-only-3-4-players | AT-ST-C02-009 | 注释「守庄（仅3/4人局，2人局服务端安全判断强制关闭）」，只证明服务端判定范围 |
| SVE-AT-ST-C01-025-05 | hzmj_server | hzmj_server/game_logic.cpp:149-161 | guard-dealer-player-count-guard | AT-ST-C02-009 | `GameLogic::LoadBoxJsonConfig` 中 2 人局把 enable 置 false 并回写，证明服务端兜底关闭，与界面是否展示无直接关系 |
| SVE-AT-ST-C01-009-04 | hzmj_server | hzmj_server/game_logic.cpp:175-183 | play-score-lian-zhuang-json-keys | AT-ST-C02-010 | JSON 键说明「连庄不占局数（仅打片房）」，证明服务端字段含义与适用模式 |
| SVE-AT-ST-C01-015-02 | hzmj_server | hzmj_server/game_logic.cpp:180-183 | lian-zhuang-bu-zhan-config-parse | AT-ST-C02-010 | 解析 `lian_zhuang_bu_zhan` 并写入服务端配置，证明开关可被下发 |
| SVE-AT-ST-C01-015-01 | common_game | common_game/common_game_com_result.cpp:57-76 | play-score-endgame-exempt-on-banker-win | AT-ST-C02-010 | 打片房且开关开启、庄家连庄胡时跳过整房结束判定，证明开启后的行为口径 |

补充说明：

- AT-ST-C02-002 / 003 / 004 / 005 / 006 / 008 无任何复核引用条目，属完全空缺。
- 本阶段无 CLE 证据（`client-evidence.json` 中 C02 归属条目为 0）。

## 待处理事项

### 规则待验证（补证 both）

`pending-list.md` 中本阶段共 10 条，问题类型均为「规则待验证」，建议动作均为「补证 both」。

| atomId | 验证范围 | 说明 | 建议动作 |
|---|---|---|---|
| AT-ST-C02-001 | both | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C02-002 | both | 证据不足 | 补证 both |
| AT-ST-C02-003 | server | 证据不足 | 补证 both |
| AT-ST-C02-004 | server | 证据不足 | 补证 both |
| AT-ST-C02-005 | server | 证据不足 | 补证 both |
| AT-ST-C02-006 | server | 证据不足 | 补证 both |
| AT-ST-C02-007 | both | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C02-008 | both | 证据不足 | 补证 both |
| AT-ST-C02-009 | both | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C02-010 | both | 证据不足（另有待审批复核建议：unverified） | 补证 both |

查证未完成（必要端缺口 / blocked）：本阶段 0 条（`analysisPath` 全为 `full`，无 pending/timeout/failed 导致的阻塞）。
需策划裁决（decision_required）：本阶段 0 条。

### 待审批建议（reviewStatus=pending，均未生效）

| atomId | 建议差异 | 复核规则 | 状态 |
|---|---|---|---|
| AT-ST-C02-001 | unverified | common-capability-is-not-enabled（服务端碰算摊默认开与碰计摊口径存在，不等于本玩法创房界面复选框按需求呈现） | pending / 未生效 |
| AT-ST-C02-007 | unverified | common-capability-is-not-enabled（缺一色 2/3 人房生效属服务端对局能力，不等于创房界面复选框已显示且默认勾选） | pending / 未生效 |
| AT-ST-C02-009 | unverified | common-capability-is-not-enabled（守庄的 3/4 人房实现存在，不等于创房界面已按房型显示该复选框） | pending / 未生效 |
| AT-ST-C02-010 | unverified | common-capability-is-not-enabled（连庄不占局数的打片房语义齐备，不等于创房界面在打片模式已展示该复选框） | pending / 未生效 |

建议动作：审批（approve/reject/hold）。四条建议值均为 unverified，与当前生效值一致，获批后不改变 L7 结论。

### 补证方向（供后续取证参考，非结论）

- 创房面板渲染与默认值（全部 10 个原子）：需客户端创房界面的复选项定义、默认勾选配置与提交字段映射证据（面板组件、默认值来源、下发 JSON 键）。
- 条件显隐（001 / 007 / 009 / 010）：需吃碰档位、房型人数、打片模式三类联动显隐的实现证据，重点覆盖隐藏时是否同时不提交该开关。
- 服务端规则生效（003 / 004 / 005 / 006 / 008）：需番数翻倍（三财/四财）、十风番型判定、发牌去风、财神替豪七判型的直接实现证据，现有 SVE 均无对应条目。
- 服务端旁证缺口闭合（001 / 007 / 009 / 010）：现有 SVE 仅覆盖规则能力与默认值，需补创房配置解析与界面职责边界的证据，才能从 conditional 旁证转为原子级证据。
