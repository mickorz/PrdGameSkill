# ST-C10 吃、碰、杠

## 阶段概述

本阶段规定吃、碰、直杠、加杠、暗杠的成立条件与后续行动，以及风箭与飘财限制下的杠牌边界。

- 原子数：27（AT-ST-C10-001 ~ AT-ST-C10-027），分属 7 个功能点：FP-ST-C10-001 吃牌规则（001-005）、FP-ST-C10-002 碰牌规则（006-009）、FP-ST-C10-003 直杠规则（010-011）、FP-ST-C10-004 加杠规则（012-015）、FP-ST-C10-005 暗杠规则（016-020）、FP-ST-C10-006 杠牌通用与七对边界（021-024）、FP-ST-C10-007 飘财限制下的杠牌边界（025-027）。
- L7 分布：verified 0 / verification_required 27 / decision_required 0 / not_applicable 0。
- analysisPath 分布：27 个原子全部为 `full`（无 blocked、无 conflict-fast、无 timeout/failed）。
- 取证现状：本阶段 27 个原子在统一原子视图中双端字段均为空（`client.verdict` 空、`server.applicability` 空、`client.evidenceIds` 与 `server.evidenceIds` 全为空、`configCondition` 空），effectiveDifference 一律为 `unverified`；`trace_index.json` 中本阶段每个原子的 `evidenceCount` 均为 0。复核记录中仅 AT-ST-C10-001 带有 `reviewStatus=pending` 的建议（建议值 unverified），尚未生效。
- 需求原文行号：吃规则 = PRD 第 147、149 行；碰规则 = 第 150 行；直杠规则 = 第 151 行；加杠规则 = 第 152 行；暗杠规则 = 第 153 行；杠牌通用与七对边界 = 第 147、154 行；飘财限制下的杠牌边界 = 第 155 行。

| 原子 | 名称 | 验证范围 | difference | L7 |
|---|---|---|---|---|
| AT-ST-C10-001 | 风牌箭牌不可吃 | server | unverified | verification_required |
| AT-ST-C10-002 | 吃的牌型构成 | both | unverified | verification_required |
| AT-ST-C10-003 | 多组合择一 | both | unverified | verification_required |
| AT-ST-C10-004 | 吃后不摸牌进入出牌 | both | unverified | verification_required |
| AT-ST-C10-005 | 吃当回合可加杠暗杠 | both | unverified | verification_required |
| AT-ST-C10-006 | 碰的牌型构成 | both | unverified | verification_required |
| AT-ST-C10-007 | 手中三张只用两张 | server | unverified | verification_required |
| AT-ST-C10-008 | 碰后不摸牌进入出牌 | both | unverified | verification_required |
| AT-ST-C10-009 | 碰当回合可加杠暗杠 | both | unverified | verification_required |
| AT-ST-C10-010 | 直杠的牌型构成 | both | unverified | verification_required |
| AT-ST-C10-011 | 直杠后从牌墙尾部补牌 | both | unverified | verification_required |
| AT-ST-C10-012 | 加杠发起条件 | both | unverified | verification_required |
| AT-ST-C10-013 | 加杠先征求抢杠胡 | both | unverified | verification_required |
| AT-ST-C10-014 | 抢杠胡则加杠不成立不补牌 | server | unverified | verification_required |
| AT-ST-C10-015 | 无人胡则完成加杠并补牌 | both | unverified | verification_required |
| AT-ST-C10-016 | 暗杠发起条件 | both | unverified | verification_required |
| AT-ST-C10-017 | 暗杠后补牌 | server | unverified | verification_required |
| AT-ST-C10-018 | 暗杠展示形态 | client | unverified | verification_required |
| AT-ST-C10-019 | 暗杠摆放位置 | client | unverified | verification_required |
| AT-ST-C10-020 | 暗杠不计副露 | server | unverified | verification_required |
| AT-ST-C10-021 | 风箭非财神可碰可杠 | server | unverified | verification_required |
| AT-ST-C10-022 | 吃碰当回合可加杠暗杠 | both | unverified | verification_required |
| AT-ST-C10-023 | 四张相同即可杠 | server | unverified | verification_required |
| AT-ST-C10-024 | 杠后不再按七对结算 | server | unverified | verification_required |
| AT-ST-C10-025 | 飘财限制下禁止吃碰直杠加杠 | server | unverified | verification_required |
| AT-ST-C10-026 | 飘财限制下仍可暗杠 | server | unverified | verification_required |
| AT-ST-C10-027 | 飘财限制暗杠后只能打尾墩补牌 | both | unverified | verification_required |

## 需求条目

### AT-ST-C10-001 风牌箭牌不可吃

- 所属功能点：FP-ST-C10-001 吃牌规则（PRD 第 147 行）
- **需求规则**：风牌、箭牌不能做顺子，不能吃。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`client.verdict` 为空，`client.evidenceIds` 为空；本轮无任何 CLE 证据挂在本原子（12 条 CLE 的 atomIds 全部属 AT-ST-C01 系列）。实现要点（需求口径，未经证据证实）：本端不向玩家展示对风牌、箭牌的「吃」选项，吃牌入口只对可组成顺子的数字牌开放。证据定位：无（`clientEvidenceIds` 为空，无 file:line 可引）。
- **服务端职责**：`server.applicability` 为空，`server.evidenceIds` 为空；`server-evidence.json` 60 条证据的 atomIds 全部落在 AT-ST-C01-001~029，无 ST-C10 归属。规则说明（需求口径）：判定可吃组合时只枚举同花色数字牌的连续三张，风牌、箭牌不参与顺子组合，因而不产生可吃组合。`configCondition` 为空，未登记任何开关。
- **双端协作**：上家打出风牌或箭牌 → 服务端判定无顺子可组 → 不向其他玩家征求吃 → 只保留碰、杠的响应（客户端相应只呈现碰/杠入口）。
- **业务行为**：
  - trigger：上家打出一张风牌或箭牌
  - condition：该牌花色为风牌或箭牌（不能与手牌组成顺子）
  - action：系统判定该牌不能用于组成顺子
  - result：玩家无法对该牌选择吃
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空（无升级候选，`previousRunId` 为空，`upgraded=false`）。
  `baselineDetail`：需求口径为风牌、箭牌不能做顺子、不能吃。该原子判定需要的服务端证据在本轮审查中缺失（无任何可用证据、无法核对实现），因此无法证实符合、也无矛盾证据可立冲突，只能判为未验证。
  待审批建议：unverified（`evidence-is-not-consistency`：本片 27 个原子双端证据均为零，按缺证维持 unverified，不得因缺证而判 consistent 或立 conflict）。该建议未生效。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（依据 effectiveDifference=unverified；scope=unknown，`scopeSource=default-unknown`）。

### AT-ST-C10-002 吃的牌型构成

- 所属功能点：FP-ST-C10-001 吃牌规则（PRD 第 149 行）
- **需求规则**：上家刚打出的 1 张非财神，与手中 2 张非财神组成同花色连续顺子。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`client.verdict` 为空，`client.evidenceIds` 为空；无 CLE 证据。实现要点（需求口径）：在可吃时向玩家展示「吃」入口及可选顺子图形，并把玩家所选的组合回传服务端。证据定位：无（`clientEvidenceIds` 为空）。
- **服务端职责**：`server.applicability` 为空，`server.evidenceIds` 为空。规则说明（需求口径）：校验弃牌与手中两张牌能组成合法顺子（同花色、连续、三者均为非财神），成立后把该副露亮出。`configCondition` 为空，未登记开关。
- **双端协作**：上家出牌 → 服务端判定可吃 → 客户端弹出吃牌选项 → 玩家选择吃 → 服务端确认顺子成立 → 向四家同步亮出。
- **业务行为**：
  - trigger：上家刚打出一张非财神牌
  - condition：玩家手中有两张与该牌同花色、且能与它连成顺子的非财神牌
  - action：玩家选择吃，用这三张牌组成顺子
  - result：顺子成立并在牌桌上亮出
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求口径为「上家刚打出的 1 张非财神与手中 2 张非财神组成同花色连续顺子」。该原子判定需要的客户端与服务端两端证据在本轮审查中缺失（无任何可用证据、无法核对实现），因此无法证实符合、也无矛盾证据可立冲突，只能判为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C10-003 多组合择一

- 所属功能点：FP-ST-C10-001 吃牌规则（PRD 第 149 行）
- **需求规则**：多种合法组合时选 1 组。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`client.verdict` 为空，`client.evidenceIds` 为空；无 CLE 证据。实现要点（需求口径）：把多个可吃顺子组合同时列出，让玩家挑一组，并回传被选中的组合。证据定位：无（`clientEvidenceIds` 为空）。
- **服务端职责**：`server.applicability` 为空，`server.evidenceIds` 为空。规则说明（需求口径）：按玩家选定的那一组成立唯一一组顺子，其余候选组合不生效；判定侧需先枚举全部合法组合再收敛为一次选择。`configCondition` 为空。
- **双端协作**：弃牌出现 → 服务端给出多个可吃组合 → 客户端展示选择 → 玩家选定一组 → 服务端按选定组合成立顺子。
- **业务行为**：
  - trigger：同一张弃牌存在多种可吃的顺子组合
  - condition：玩家手中能与其组成不止一组顺子的牌
  - action：玩家从多个组合中选择一组
  - result：只成立玩家所选的那一组顺子
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求口径为「多种合法组合时选 1 组」。该原子判定需要的客户端与服务端两端证据在本轮审查中缺失（无任何可用证据、无法核对实现），因此无法证实符合、也无矛盾证据可立冲突，只能判为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C10-004 吃后不摸牌进入出牌

- 所属功能点：FP-ST-C10-001 吃牌规则（PRD 第 149 行）
- **需求规则**：成功后不摸牌，进入出牌。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`client.verdict` 为空，`client.evidenceIds` 为空；无 CLE 证据。实现要点（需求口径）：收起吃牌提示后直接进入本家出牌操作，不经过摸牌动画与摸牌交互。证据定位：无（`clientEvidenceIds` 为空）。
- **服务端职责**：`server.applicability` 为空，`server.evidenceIds` 为空。规则说明（需求口径）：吃牌成立后跳过摸牌环节，把行动权直接交给该玩家出牌，不为其从牌墙取牌。`configCondition` 为空。
- **双端协作**：玩家吃牌 → 服务端成立顺子并跳过摸牌 → 通知轮到该玩家出牌 → 本端开放出牌。
- **业务行为**：
  - trigger：玩家吃牌成立
  - condition：吃牌判定通过
  - action：跳过摸牌环节，直接轮到该玩家出牌
  - result：玩家进入出牌阶段并可打出手牌一张
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求口径为「吃成功后不摸牌，进入出牌」。该原子判定需要的客户端与服务端两端证据在本轮审查中缺失（无任何可用证据、无法核对实现），因此无法证实符合、也无矛盾证据可立冲突，只能判为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C10-005 吃当回合可加杠暗杠

- 所属功能点：FP-ST-C10-001 吃牌规则（PRD 第 149 行）
- **需求规则**：当前回合可以加杠或暗杠。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`client.verdict` 为空，`client.evidenceIds` 为空；无 CLE 证据。实现要点（需求口径）：吃牌后、出牌前仍显示加杠、暗杠入口，不因刚完成吃牌而隐藏杠入口。证据定位：无（`clientEvidenceIds` 为空）。
- **服务端职责**：`server.applicability` 为空，`server.evidenceIds` 为空。规则说明（需求口径）：接受并校验本回合的加杠、暗杠请求并允许其成立；吃牌不构成对杠操作的封锁条件。`configCondition` 为空。
- **双端协作**：吃牌成立 → 出牌前本端显示杠选项 → 玩家选择加杠或暗杠 → 服务端校验成立 → 玩家继续行动。
- **业务行为**：
  - trigger：玩家刚完成吃牌、尚未出牌
  - condition：玩家手中满足加杠或暗杠的条件
  - action：玩家可在出牌前选择加杠或暗杠
  - result：吃牌当回合仍可执行杠牌操作
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求口径为「吃牌当前回合可以加杠或暗杠」。该原子判定需要的客户端与服务端两端证据在本轮审查中缺失（无任何可用证据、无法核对实现），因此无法证实符合、也无矛盾证据可立冲突，只能判为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C10-006 碰的牌型构成

- 所属功能点：FP-ST-C10-002 碰牌规则（PRD 第 150 行）
- **需求规则**：任意他人刚打出的 1 张非财神，与手中 2 张相同非财神组成刻子。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`client.verdict` 为空，`client.evidenceIds` 为空；无 CLE 证据。实现要点（需求口径）：在可碰时向玩家展示「碰」入口；碰的来源不限上家，任意其他玩家的弃牌均可。证据定位：无（`clientEvidenceIds` 为空）。
- **服务端职责**：`server.applicability` 为空，`server.evidenceIds` 为空。规则说明（需求口径）：校验弃牌与手中两张相同牌组成刻子并成立、亮出；弃牌来源需为任意他家刚打出的牌，且三张均为非财神。`configCondition` 为空（功能点 scope 说明可碰任意他人弃牌）。
- **双端协作**：他人出牌 → 服务端判定可碰 → 客户端弹出碰选项 → 玩家选择碰 → 服务端成立刻子 → 向四家同步亮出。
- **业务行为**：
  - trigger：任意其他玩家刚打出一张非财神牌
  - condition：玩家手中至少有两张与该牌完全相同的非财神牌
  - action：玩家选择碰，用该弃牌与手中两张相同牌组成刻子
  - result：刻子成立并在牌桌上亮出
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求口径为「任意他人刚打出的 1 张非财神与手中 2 张相同非财神组成刻子」。该原子判定需要的客户端与服务端两端证据在本轮审查中缺失（无任何可用证据、无法核对实现），因此无法证实符合、也无矛盾证据可立冲突，只能判为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C10-007 手中三张只用两张

- 所属功能点：FP-ST-C10-002 碰牌规则（PRD 第 150 行）
- **需求规则**：手中有 3 张也只用 2 张。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`client.verdict` 为空，`client.evidenceIds` 为空；无 CLE 证据。实现要点（需求口径）：玩家照常发起碰的请求，本端不对「手中有三张」这一情形做额外提示或限制。证据定位：无（`clientEvidenceIds` 为空）。
- **服务端职责**：`server.applicability` 为空，`server.evidenceIds` 为空。规则说明（需求口径）：只取其中两张与弃牌组成刻子，多出的一张继续留在手牌中，不得一并扣入副露。`configCondition` 为空。
- **双端协作**：弃牌可碰 → 玩家选择碰 → 服务端只扣两张组成刻子 → 另一张仍在手牌中。
- **业务行为**：
  - trigger：玩家对自己手中已持有三张的牌选择碰
  - condition：玩家手里有三张与弃牌相同的牌
  - action：系统仅取其中两张与弃牌组成刻子
  - result：碰后玩家手中仍保留一张同牌
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求口径为「手中有 3 张也只用 2 张」。该原子判定需要的服务端证据在本轮审查中缺失（无任何可用证据、无法核对实现），因此无法证实符合、也无矛盾证据可立冲突，只能判为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C10-008 碰后不摸牌进入出牌

- 所属功能点：FP-ST-C10-002 碰牌规则（PRD 第 150 行）
- **需求规则**：成功后不摸牌，进入出牌。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`client.verdict` 为空，`client.evidenceIds` 为空；无 CLE 证据。实现要点（需求口径）：收起碰牌提示后直接进入本家出牌操作，不出现摸牌步骤。证据定位：无（`clientEvidenceIds` 为空）。
- **服务端职责**：`server.applicability` 为空，`server.evidenceIds` 为空。规则说明（需求口径）：碰成立后跳过摸牌环节，把行动权直接交给该玩家出牌。`configCondition` 为空。
- **双端协作**：玩家碰牌 → 服务端成立刻子并跳过摸牌 → 通知轮到该玩家出牌 → 本端开放出牌。
- **业务行为**：
  - trigger：玩家碰牌成立
  - condition：碰牌判定通过
  - action：跳过摸牌环节，直接轮到该玩家出牌
  - result：玩家进入出牌阶段并可打出手牌一张
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求口径为「碰成功后不摸牌，进入出牌」。该原子判定需要的客户端与服务端两端证据在本轮审查中缺失（无任何可用证据、无法核对实现），因此无法证实符合、也无矛盾证据可立冲突，只能判为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C10-009 碰当回合可加杠暗杠

- 所属功能点：FP-ST-C10-002 碰牌规则（PRD 第 150 行）
- **需求规则**：当前回合可以加杠或暗杠。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`client.verdict` 为空，`client.evidenceIds` 为空；无 CLE 证据。实现要点（需求口径）：碰牌后、出牌前仍显示加杠、暗杠入口。证据定位：无（`clientEvidenceIds` 为空）。
- **服务端职责**：`server.applicability` 为空，`server.evidenceIds` 为空。规则说明（需求口径）：接受并校验本回合的加杠、暗杠请求并允许其成立；碰牌本身不封锁杠操作。`configCondition` 为空。
- **双端协作**：碰牌成立 → 出牌前本端显示杠选项 → 玩家选择加杠或暗杠 → 服务端校验成立 → 玩家继续行动。
- **业务行为**：
  - trigger：玩家刚完成碰牌、尚未出牌
  - condition：玩家手中满足加杠或暗杠的条件
  - action：玩家可在出牌前选择加杠或暗杠
  - result：碰牌当回合仍可执行杠牌操作
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求口径为「碰牌当前回合可以加杠或暗杠」。该原子判定需要的客户端与服务端两端证据在本轮审查中缺失（无任何可用证据、无法核对实现），因此无法证实符合、也无矛盾证据可立冲突，只能判为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C10-010 直杠的牌型构成

- 所属功能点：FP-ST-C10-003 直杠规则（PRD 第 151 行）
- **需求规则**：他人刚打出的 1 张非财神，与手中 3 张相同非财神。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`client.verdict` 为空，`client.evidenceIds` 为空；无 CLE 证据。实现要点（需求口径）：在可直杠时向玩家展示「杠」入口，入口需等待操作优先级裁决结果后才生效。证据定位：无（`clientEvidenceIds` 为空）。
- **服务端职责**：`server.applicability` 为空，`server.evidenceIds` 为空。规则说明（需求口径）：校验弃牌与手中三张相同牌成立直杠并亮出四张相同牌；三张手牌与弃牌均须为非财神。`configCondition` 为空。
- **双端协作**：他人出牌 → 服务端判定可直杠 → 客户端弹出杠选项 → 玩家选择杠 → 服务端成立杠并亮出四张牌。
- **业务行为**：
  - trigger：他人刚打出一张非财神牌
  - condition：玩家手中恰有三张与该牌相同的非财神牌
  - action：玩家选择直杠，用弃牌与手中三张相同牌组成杠
  - result：杠牌成立并亮出四张相同牌
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求口径为「他人刚打出的 1 张非财神与手中 3 张相同非财神可直杠」。该原子判定需要的客户端与服务端两端证据在本轮审查中缺失（无任何可用证据、无法核对实现），因此无法证实符合、也无矛盾证据可立冲突，只能判为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C10-011 直杠后从牌墙尾部补牌

- 所属功能点：FP-ST-C10-003 直杠规则（PRD 第 151 行）
- **需求规则**：按优先级裁决后，从牌墙尾部补牌。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`client.verdict` 为空，`client.evidenceIds` 为空；无 CLE 证据。实现要点（需求口径）：展示补牌结果并等待玩家继续操作，补牌动画来源须体现为牌墙尾部。证据定位：无（`clientEvidenceIds` 为空）。
- **服务端职责**：`server.applicability` 为空，`server.evidenceIds` 为空。规则说明（需求口径）：直杠经操作优先级裁决成立后，从牌墙尾部摸取一张牌补入该玩家手中（与常规前端摸牌方向不同）。`configCondition` 为空，未登记开关。
- **双端协作**：玩家发起直杠 → 服务端裁决成立 → 从牌墙尾部补一张 → 通知客户端补牌结果 → 玩家继续行动。
- **业务行为**：
  - trigger：玩家选择直杠
  - condition：该杠操作经优先级裁决后获得成立
  - action：系统从牌墙尾部摸取一张牌补入玩家手中
  - result：玩家从牌墙尾部拿到补牌并继续行动
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求口径为「直杠按优先级裁决成立后从牌墙尾部补牌」。该原子判定需要的客户端与服务端两端证据在本轮审查中缺失（无任何可用证据、无法核对实现），因此无法证实符合、也无矛盾证据可立冲突，只能判为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C10-012 加杠发起条件

- 所属功能点：FP-ST-C10-004 加杠规则（PRD 第 152 行）
- **需求规则**：出牌阶段，已碰出的刻子手里有第 4 张非财神。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`client.verdict` 为空，`client.evidenceIds` 为空；无 CLE 证据。实现要点（需求口径）：仅在出牌前、且玩家已碰出对应刻子并持有第四张时才显示加杠入口。证据定位：无（`clientEvidenceIds` 为空）。
- **服务端职责**：`server.applicability` 为空，`server.evidenceIds` 为空。规则说明（需求口径）：加杠只针对已碰出的刻子（副露中的刻子），校验手中的第四张牌后进入抢杠胡征求；暗杠不在本原子范围。`configCondition` 为空。
- **双端协作**：轮到出牌 → 本端显示加杠入口 → 玩家点加杠 → 服务端校验第四张 → 进入抢杠胡征求。
- **业务行为**：
  - trigger：轮到玩家出牌
  - condition：玩家此前已碰出刻子，且手中持有该刻子的第四张非财神牌
  - action：玩家对已碰出的刻子发起加杠
  - result：玩家可对已碰出的刻子发起加杠
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求口径为「出牌阶段已碰出的刻子手里有第 4 张非财神可加杠」。该原子判定需要的客户端与服务端两端证据在本轮审查中缺失（无任何可用证据、无法核对实现），因此无法证实符合、也无矛盾证据可立冲突，只能判为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C10-013 加杠先征求抢杠胡

- 所属功能点：FP-ST-C10-004 加杠规则（PRD 第 152 行）
- **需求规则**：先征求抢杠胡。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`client.verdict` 为空，`client.evidenceIds` 为空；无 CLE 证据。实现要点（需求口径）：向其他玩家展示抢杠胡确认入口，并在确认环节结束后才显示加杠结果。证据定位：无（`clientEvidenceIds` 为空）。
- **服务端职责**：`server.applicability` 为空，`server.evidenceIds` 为空。规则说明（需求口径）：加杠不即时成立，先暂缓结果并向其他玩家征求抢杠胡意愿，汇总应答后再判定加杠是否成立。`configCondition` 为空。
- **双端协作**：玩家加杠 → 服务端暂缓成立 → 向其他三家征求抢杠胡 → 收集应答 → 再决定加杠是否成立。
- **业务行为**：
  - trigger：玩家发起加杠
  - condition：该第四张牌存在可能抢杠胡的其他玩家
  - action：系统先向其他玩家征求抢杠胡意愿
  - result：玩家在抢杠胡确认环节完成后才见到加杠结果
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求口径为「加杠时先征求抢杠胡」。该原子判定需要的客户端与服务端两端证据在本轮审查中缺失（无任何可用证据、无法核对实现），因此无法证实符合、也无矛盾证据可立冲突，只能判为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C10-014 抢杠胡则加杠不成立不补牌

- 所属功能点：FP-ST-C10-004 加杠规则（PRD 第 152 行）
- **需求规则**：有人抢杠胡则加杠不成立、不补牌。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`client.verdict` 为空，`client.evidenceIds` 为空；无 CLE 证据。实现要点（需求口径）：展示抢杠胡播报与胡牌结算，不展示加杠完成与补牌。证据定位：无（`clientEvidenceIds` 为空）。
- **服务端职责**：`server.applicability` 为空，`server.evidenceIds` 为空。规则说明（需求口径）：抢杠胡被判定成立时取消本次加杠且不发放补牌，直接判抢杠胡者胡牌；抢杠胡优先于加杠成立。`configCondition` 为空。
- **双端协作**：玩家加杠 → 征求抢杠胡 → 有玩家宣布胡 → 服务端判抢杠胡成立 → 取消加杠 → 向四家播报。
- **业务行为**：
  - trigger：征求抢杠胡时有人宣布抢杠胡
  - condition：抢杠胡被判定成立
  - action：系统取消本次加杠且不发放补牌
  - result：抢杠胡者胡牌，加杠玩家的加杠不生效、也没有补牌
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求口径为「有人抢杠胡则加杠不成立、不补牌」。该原子判定需要的服务端证据在本轮审查中缺失（无任何可用证据、无法核对实现），因此无法证实符合、也无矛盾证据可立冲突，只能判为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C10-015 无人胡则完成加杠并补牌

- 所属功能点：FP-ST-C10-004 加杠规则（PRD 第 152 行）
- **需求规则**：无人胡再完成加杠并补牌。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`client.verdict` 为空，`client.evidenceIds` 为空；无 CLE 证据。实现要点（需求口径）：展示加杠完成与补牌结果，并把刻子从三张更新为四张的展示形态。证据定位：无（`clientEvidenceIds` 为空）。
- **服务端职责**：`server.applicability` 为空，`server.evidenceIds` 为空。规则说明（需求口径）：抢杠胡无人成立时完成加杠，并从牌墙补一张牌给该玩家。`configCondition` 为空。
- **双端协作**：玩家加杠 → 征求抢杠胡无人应 → 服务端完成加杠 → 补一张牌 → 通知客户端。
- **业务行为**：
  - trigger：征求抢杠胡时无人宣布抢杠胡
  - condition：无人抢杠胡成立
  - action：系统完成加杠并从牌墙补一张牌给玩家
  - result：加杠完成，玩家获得补牌并继续行动
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求口径为「无人胡再完成加杠并补牌」。该原子判定需要的客户端与服务端两端证据在本轮审查中缺失（无任何可用证据、无法核对实现），因此无法证实符合、也无矛盾证据可立冲突，只能判为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C10-016 暗杠发起条件

- 所属功能点：FP-ST-C10-005 暗杠规则（PRD 第 153 行）
- **需求规则**：出牌阶段手中 4 张相同非财神。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`client.verdict` 为空，`client.evidenceIds` 为空；无 CLE 证据。实现要点（需求口径）：在自家出牌阶段、手中持有四张完全相同时显示暗杠入口；不得在响应他人弃牌时提供暗杠入口。证据定位：无（`clientEvidenceIds` 为空）。
- **服务端职责**：`server.applicability` 为空，`server.evidenceIds` 为空。规则说明（需求口径）：暗杠仅限出牌阶段的手牌四张，校验四张相同牌成立暗杠，成立后补牌；不得由弃牌触发。`configCondition` 为空。
- **双端协作**：出牌阶段 → 本端显示暗杠入口 → 玩家选择暗杠 → 服务端校验成立 → 补牌。
- **业务行为**：
  - trigger：轮到玩家出牌
  - condition：玩家手中持有四张完全相同的非财神牌
  - action：玩家选择暗杠
  - result：玩家可发起暗杠
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求口径为「出牌阶段手中 4 张相同非财神可暗杠」。该原子判定需要的客户端与服务端两端证据在本轮审查中缺失（无任何可用证据、无法核对实现），因此无法证实符合、也无矛盾证据可立冲突，只能判为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C10-017 暗杠后补牌

- 所属功能点：FP-ST-C10-005 暗杠规则（PRD 第 153 行）
- **需求规则**：完成后补牌。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`client.verdict` 为空，`client.evidenceIds` 为空；无 CLE 证据。实现要点（需求口径）：展示补牌结果并等待玩家继续操作。证据定位：无（`clientEvidenceIds` 为空）。
- **服务端职责**：`server.applicability` 为空，`server.evidenceIds` 为空。规则说明（需求口径）：暗杠判定通过后从牌墙摸取一张牌补入该玩家手中，其后玩家继续行动。`configCondition` 为空。
- **双端协作**：暗杠成立 → 服务端补一张牌 → 通知客户端 → 玩家继续行动。
- **业务行为**：
  - trigger：暗杠成立
  - condition：暗杠判定通过
  - action：系统从牌墙摸取一张牌补入玩家手中
  - result：玩家获得补牌并继续行动
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求口径为「暗杠完成后补牌」。该原子判定需要的服务端证据在本轮审查中缺失（无任何可用证据、无法核对实现），因此无法证实符合、也无矛盾证据可立冲突，只能判为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C10-018 暗杠展示形态

- 所属功能点：FP-ST-C10-005 暗杠规则（PRD 第 153 行）
- **需求规则**：暗杠下层 3 张牌背、顶张正面，四家都能认出牌面。
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`client.verdict` 为空，`client.evidenceIds` 为空；`client-evidence.json` 无任何 ST-C10 归属条目。UI 需求（`uiRequirement`）为「暗杠下层 3 张显示牌背、顶张显示正面，四家都能认出牌面」。实现要点（需求口径）：渲染时下层三张用牌背、顶张用该牌正面，且四家视角（自己与他人）都需显示该正面信息。证据定位：无（`clientEvidenceIds` 为空，无 file:line 可引）。
- **服务端职责**：`server.applicability` 为空，`server.evidenceIds` 为空。规则说明（需求口径）：服务端只需把该暗杠的牌张信息同步给四家，展示形态由客户端渲染决定。`configCondition` 为空。
- **双端协作**：暗杠成立 → 服务端下发暗杠牌张 → 四家界面按三背一正展示。
- **业务行为**：
  - trigger：玩家完成暗杠
  - condition：暗杠成立
  - action：牌桌按三张牌背叠放、顶张正面展示该暗杠
  - result：四家玩家都能看清暗杠的牌面
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求口径为「暗杠下层 3 张牌背、顶张正面，四家都能认出牌面」。该原子判定需要的客户端证据在本轮审查中缺失（无任何可用证据、无法核对实现），因此无法证实符合、也无矛盾证据可立冲突，只能判为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C10-019 暗杠摆放位置

- 所属功能点：FP-ST-C10-005 暗杠规则（PRD 第 153 行）
- **需求规则**：暗杠放在碰杠区。
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`client.verdict` 为空，`client.evidenceIds` 为空；无 CLE 证据。UI 需求（`uiRequirement`）为「暗杠摆放于碰杠区」。实现要点（需求口径）：暗杠不得留在手牌区展示，须与碰、直杠、加杠同处碰杠区，且按副露区顺序定位。证据定位：无（`clientEvidenceIds` 为空）。
- **服务端职责**：`server.applicability` 为空，`server.evidenceIds` 为空。规则说明（需求口径）：服务端下发暗杠成立信息，供各端摆放到碰杠区，不参与位置计算。`configCondition` 为空。
- **双端协作**：暗杠成立 → 服务端下发结果 → 各端把暗杠摆进碰杠区。
- **业务行为**：
  - trigger：玩家完成暗杠
  - condition：暗杠成立
  - action：系统将该暗杠摆放在碰杠区
  - result：玩家在碰杠区看到该暗杠
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求口径为「暗杠放在碰杠区」。该原子判定需要的客户端证据在本轮审查中缺失（无任何可用证据、无法核对实现），因此无法证实符合、也无矛盾证据可立冲突，只能判为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C10-020 暗杠不计副露

- 所属功能点：FP-ST-C10-005 暗杠规则（PRD 第 153 行）
- **需求规则**：暗杠不计副露。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`client.verdict` 为空，`client.evidenceIds` 为空；无 CLE 证据。实现要点（需求口径）：按副露数量展示时不为暗杠增加计数。证据定位：无（`clientEvidenceIds` 为空）。
- **服务端职责**：`server.applicability` 为空，`server.evidenceIds` 为空。规则说明（需求口径）：在副露统计中不把暗杠计入，暗杠成立不改变该玩家的副露数；该统计若被番型或结算引用，需排除暗杠。`configCondition` 为空。
- **双端协作**：暗杠成立 → 服务端统计副露时排除暗杠 → 客户端按该统计展示。
- **业务行为**：
  - trigger：玩家完成暗杠
  - condition：暗杠成立
  - action：系统在副露统计中不将暗杠计入
  - result：玩家的副露数不因暗杠增加
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求口径为「暗杠不计副露」。该原子判定需要的服务端证据在本轮审查中缺失（无任何可用证据、无法核对实现），因此无法证实符合、也无矛盾证据可立冲突，只能判为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C10-021 风箭非财神可碰可杠

- 所属功能点：FP-ST-C10-006 杠牌通用与七对边界（PRD 第 147 行）
- **需求规则**：不是财神时可以碰、杠。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`client.verdict` 为空，`client.evidenceIds` 为空；无 CLE 证据。实现要点（需求口径）：为可碰、可杠的非财神风牌、箭牌展示碰、杠入口；若该类牌在本局为财神则不展示。证据定位：无（`clientEvidenceIds` 为空）。
- **服务端职责**：`server.applicability` 为空，`server.evidenceIds` 为空。规则说明（需求口径）：允许对非财神的风牌、箭牌执行碰或杠；吃仍不适用（风箭不能成顺子，见 AT-ST-C10-001）。`configCondition` 为「该风牌/箭牌在本局不是财神」才开放碰杠，财神身份由牌局财神设定决定；本轮未登记具体配置键。
- **双端协作**：他人打出非财神风牌或箭牌 → 服务端判定可碰可杠 → 客户端显示对应入口 → 玩家执行碰或杠。
- **业务行为**：
  - trigger：玩家持有风牌或箭牌，或轮到其响应该类牌
  - condition：该风牌或箭牌在本局不是财神
  - action：系统允许对该牌执行碰或杠
  - result：玩家可对非财神的风牌、箭牌进行碰和杠
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求口径为「风牌、箭牌不是财神时可以碰、杠」。该原子判定需要的服务端证据在本轮审查中缺失（无任何可用证据、无法核对实现），因此无法证实符合、也无矛盾证据可立冲突，只能判为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C10-022 吃碰当回合可加杠暗杠

- 所属功能点：FP-ST-C10-006 杠牌通用与七对边界（PRD 第 154 行）
- **需求规则**：吃或碰刚成立的当前回合，同样可以加杠、暗杠。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`client.verdict` 为空，`client.evidenceIds` 为空；无 CLE 证据。实现要点（需求口径）：吃或碰成立后、出牌前同时显示加杠与暗杠入口。证据定位：无（`clientEvidenceIds` 为空）。
- **服务端职责**：`server.applicability` 为空，`server.evidenceIds` 为空。规则说明（需求口径）：接受并校验本回合（吃/碰成立后）的加杠与暗杠请求，不因刚完成吃碰而禁止杠。`configCondition` 为空。
- **双端协作**：吃或碰成立 → 出牌前本端显示加杠与暗杠 → 玩家选择 → 服务端校验成立 → 玩家继续行动。
- **业务行为**：
  - trigger：玩家刚吃或刚碰成立
  - condition：玩家手中满足加杠或暗杠条件
  - action：玩家在出牌前选择加杠或暗杠
  - result：吃或碰的当回合玩家仍可加杠或暗杠
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求口径为「吃或碰刚成立的当前回合同样可以加杠、暗杠」。该原子判定需要的客户端与服务端两端证据在本轮审查中缺失（无任何可用证据、无法核对实现），因此无法证实符合、也无矛盾证据可立冲突，只能判为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C10-023 四张相同即可杠

- 所属功能点：FP-ST-C10-006 杠牌通用与七对边界（PRD 第 154 行）
- **需求规则**：四张相同就可以杠。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`client.verdict` 为空，`client.evidenceIds` 为空；无 CLE 证据。实现要点（需求口径）：为可杠的四张相同牌展示杠入口（手中四张对应暗杠、已碰刻子加第四张对应加杠、他人弃牌加三张对应直杠）。证据定位：无（`clientEvidenceIds` 为空）。
- **服务端职责**：`server.applicability` 为空，`server.evidenceIds` 为空。规则说明（需求口径）：判定四张相同牌构成可杠组合，作为三类杠的统一前提；四张均须为非财神。`configCondition` 为空。
- **双端协作**：凑齐四张相同牌 → 服务端判定可杠 → 客户端显示杠入口 → 玩家发起杠。
- **业务行为**：
  - trigger：玩家凑齐四张相同牌（手中持有或待响应）
  - condition：四张牌完全相同且都不是财神
  - action：系统判定该组合可以杠
  - result：玩家可对四张相同的牌发起杠
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求口径为「四张相同就可以杠」。该原子判定需要的服务端证据在本轮审查中缺失（无任何可用证据、无法核对实现），因此无法证实符合、也无矛盾证据可立冲突，只能判为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C10-024 杠后不再按七对结算

- 所属功能点：FP-ST-C10-006 杠牌通用与七对边界（PRD 第 154 行）
- **需求规则**：杠完这条就不再按七对结算。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`client.verdict` 为空，`client.evidenceIds` 为空；无 CLE 证据。实现要点（需求口径）：结算展示按非七对牌型呈现，不出现七对番型标签。证据定位：无（`clientEvidenceIds` 为空）。
- **服务端职责**：`server.applicability` 为空，`server.evidenceIds` 为空。规则说明（需求口径）：该牌路一旦发生过杠，结算时不再按七对牌型计算，即杠与七对结算互斥；需在胡牌牌型判定阶段排除七对分支。`configCondition` 为空。
- **双端协作**：本局出现杠 → 服务端结算排除七对 → 客户端按非七对结果展示。
- **业务行为**：
  - trigger：玩家完成杠牌
  - condition：该牌路已发生过杠
  - action：系统在结算时不再按七对牌型计算
  - result：该局玩家无法以七对结算
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求口径为「杠完这条就不再按七对结算」。该原子判定需要的服务端证据在本轮审查中缺失（无任何可用证据、无法核对实现），因此无法证实符合、也无矛盾证据可立冲突，只能判为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C10-025 飘财限制下禁止吃碰直杠加杠

- 所属功能点：FP-ST-C10-007 飘财限制下的杠牌边界（PRD 第 155 行）
- **需求规则**：受尚未解除的飘财限制时，不能吃、碰、直杠、加杠。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`client.verdict` 为空，`client.evidenceIds` 为空；无 CLE 证据。实现要点（需求口径）：按飘财状态不向该玩家展示吃、碰、直杠、加杠的可用入口。证据定位：无（`clientEvidenceIds` 为空）。
- **服务端职责**：`server.applicability` 为空，`server.evidenceIds` 为空。规则说明（需求口径）：飘财限制未解除期间禁止该玩家吃、碰、直杠、加杠，并拒绝相关请求；限制仅针对未解除的飘财状态，解除后恢复。`configCondition` 为「飘财限制仍未解除」生效，具体判定条件（飘财状态机与解除时机）本轮无证据登记。
- **双端协作**：玩家受飘财限制 → 服务端拒绝吃、碰、直杠、加杠 → 客户端不提供这些入口。
- **业务行为**：
  - trigger：玩家处于尚未解除的飘财限制状态
  - condition：飘财限制仍未解除
  - action：系统禁止该玩家吃、碰、直杠、加杠
  - result：玩家在飘财限制期间无法吃、碰、直杠、加杠
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求口径为「受尚未解除的飘财限制时不能吃、碰、直杠、加杠」。该原子判定需要的服务端证据在本轮审查中缺失（无任何可用证据、无法核对实现），因此无法证实符合、也无矛盾证据可立冲突，只能判为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C10-026 飘财限制下仍可暗杠

- 所属功能点：FP-ST-C10-007 飘财限制下的杠牌边界（PRD 第 155 行）
- **需求规则**：仍可暗杠。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`client.verdict` 为空，`client.evidenceIds` 为空；无 CLE 证据。实现要点（需求口径）：为四张相同牌保留暗杠入口，飘财限制下不与其他杠入口一并禁用。证据定位：无（`clientEvidenceIds` 为空）。
- **服务端职责**：`server.applicability` 为空，`server.evidenceIds` 为空。规则说明（需求口径）：飘财限制下暗杠作为例外仍被允许，成立后照常补牌；即 025 的禁止集不含暗杠。`configCondition` 与 025 同一飘财状态判定，暗杠为其例外分支。
- **双端协作**：四张相同牌 → 客户端保留暗杠入口 → 玩家发起暗杠 → 服务端允许成立并补牌。
- **业务行为**：
  - trigger：玩家处于尚未解除的飘财限制状态
  - condition：玩家手中持有四张相同的非财神牌
  - action：系统允许该玩家执行暗杠
  - result：玩家在飘财限制期间仍可暗杠
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求口径为「受飘财限制时仍可暗杠」。该原子判定需要的服务端证据在本轮审查中缺失（无任何可用证据、无法核对实现），因此无法证实符合、也无矛盾证据可立冲突，只能判为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C10-027 飘财限制暗杠后只能打尾墩补牌

- 所属功能点：FP-ST-C10-007 飘财限制下的杠牌边界（PRD 第 155 行）
- **需求规则**：暗杠后只能打尾墩刚补进的那一张。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`client.verdict` 为空，`client.evidenceIds` 为空；无 CLE 证据。实现要点（需求口径）：出牌时只把刚补进的那张牌点亮为可选，其余手牌不可选，玩家无其他出牌选择。证据定位：无（`clientEvidenceIds` 为空）。
- **服务端职责**：`server.applicability` 为空，`server.evidenceIds` 为空。规则说明（需求口径）：限定该玩家本次出牌只能打出尾墩补进的那一张，校验时拒绝其他手牌的出牌请求；该限定是飘财限制下暗杠后的出牌约束。`configCondition` 为「飘财限制状态下的暗杠补牌」生效，本轮未登记具体配置键。
- **双端协作**：暗杠补牌 → 服务端把可出牌限定为补进的那张 → 客户端只点亮该张 → 玩家打出。
- **业务行为**：
  - trigger：玩家在飘财限制状态下完成暗杠
  - condition：暗杠后已从尾墩补进一张牌
  - action：系统限定玩家只能打出刚补进的那一张牌
  - result：玩家出牌时只有补进的那一张可选
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求口径为「暗杠后只能打尾墩刚补进的那一张」。该原子判定需要的客户端与服务端两端证据在本轮审查中缺失（无任何可用证据、无法核对实现），因此无法证实符合、也无矛盾证据可立冲突，只能判为未验证。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

## 证据索引

本阶段 27 个原子在统一原子视图中均未挂证据：`clientEvidenceIds` 与 `serverEvidenceIds` 全为空，`trace_index.json` 中每个原子的 `evidenceCount` 均为 0。因此本阶段原子级 CLE / SVE 证据列表为空表。

| 证据 id | layer | file:line | claimKey | 归属原子 |
|---|---|---|---|---|
| （无） | — | — | — | — |

补充说明：

- `client-evidence.json` 共 12 条 CLE（`CLE-AT-ST-C01-001-01` ~ `CLE-AT-ST-C01-009-03`），atomIds 全部属 AT-ST-C01 系列，无任何 ST-C10 归属条目。
- `server-evidence.json` 共 60 条 SVE，atomIds 覆盖 AT-ST-C01-001 ~ AT-ST-C01-029，无任何 atomIds 含 ST-C10 的记录。
- 复核记录（`difference-review.json`）对 AT-ST-C10-001 的 `reviewReason` 同样确认上述两点，未引用任何可跨原子佐证的具体证据条目，故无可补充列出。
- 因无证据可引，本文档「客户端职责」「服务端职责」中的证据定位一律为「无」，描述部分为需求口径推定，不代表实现已核对。

## 待处理事项

### 待验证（规则待验证，补证 both）

`pending-list.md` 中本阶段共 27 条，问题类型均为「规则待验证」，建议动作均为「补证 both」。

| atomId | 验证范围 | 说明 | 建议动作 |
|---|---|---|---|
| AT-ST-C10-001 | server | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C10-002 | both | 证据不足 | 补证 both |
| AT-ST-C10-003 | both | 证据不足 | 补证 both |
| AT-ST-C10-004 | both | 证据不足 | 补证 both |
| AT-ST-C10-005 | both | 证据不足 | 补证 both |
| AT-ST-C10-006 | both | 证据不足 | 补证 both |
| AT-ST-C10-007 | server | 证据不足 | 补证 both |
| AT-ST-C10-008 | both | 证据不足 | 补证 both |
| AT-ST-C10-009 | both | 证据不足 | 补证 both |
| AT-ST-C10-010 | both | 证据不足 | 补证 both |
| AT-ST-C10-011 | both | 证据不足 | 补证 both |
| AT-ST-C10-012 | both | 证据不足 | 补证 both |
| AT-ST-C10-013 | both | 证据不足 | 补证 both |
| AT-ST-C10-014 | server | 证据不足 | 补证 both |
| AT-ST-C10-015 | both | 证据不足 | 补证 both |
| AT-ST-C10-016 | both | 证据不足 | 补证 both |
| AT-ST-C10-017 | server | 证据不足 | 补证 both |
| AT-ST-C10-018 | client | 证据不足 | 补证 both |
| AT-ST-C10-019 | client | 证据不足 | 补证 both |
| AT-ST-C10-020 | server | 证据不足 | 补证 both |
| AT-ST-C10-021 | server | 证据不足 | 补证 both |
| AT-ST-C10-022 | both | 证据不足 | 补证 both |
| AT-ST-C10-023 | server | 证据不足 | 补证 both |
| AT-ST-C10-024 | server | 证据不足 | 补证 both |
| AT-ST-C10-025 | server | 证据不足 | 补证 both |
| AT-ST-C10-026 | server | 证据不足 | 补证 both |
| AT-ST-C10-027 | both | 证据不足 | 补证 both |

查证未完成（必要端缺口）：本阶段 0 条（`analysisPath` 全为 full，无 pending/timeout/failed 导致的阻塞，无 blocked 原子）。
需策划裁决（decision_required）：本阶段 0 条。
不适用（not_applicable）：本阶段 0 条。

### 待审批建议（reviewStatus=pending，均未生效）

| atomId | 建议差异 | 复核规则 | 状态 |
|---|---|---|---|
| AT-ST-C10-001 | unverified | evidence-is-not-consistency（本片 27 个原子双端证据均为零，按缺证维持 unverified，不得因缺证而判 consistent 或立 conflict） | pending / 未生效 |

建议动作：审批（approve/reject/hold）。该建议获批后仍为 unverified，不改变本阶段 L7 结论；其余 26 个原子无复核建议。

### 补证方向（供后续取证参考，非结论）

- 吃牌（001-005）：需服务端可吃组合枚举（牌种、花色、连续性判定与风箭排除）与吃后阶段推进（跳过摸牌的流程分支）证据；客户端需吃入口显隐、多组合选择交互证据。
- 碰牌（006-009）：需服务端碰校验中「他人弃牌」来源判定与「只扣两张」的手牌扣除实现证据；客户端需碰入口显隐证据。
- 直杠（010-011）：需服务端杠牌优先级裁决实现与「从牌墙尾部摸牌」的取牌位置证据。
- 加杠（012-015）：需加杠前置校验（已碰刻子 + 第四张）、抢杠胡征求与应答汇总、抢杠胡成立时取消加杠且不补牌的分支证据。
- 暗杠（016-020）：需服务端暗杠判定、补牌与副露计数排除分支证据；客户端需三背一正渲染、碰杠区摆放、四家可见性证据。
- 杠牌通用与七对边界（021-024）：需服务端风箭财神身份判定与碰杠开放条件、四张相同可杠判定、结算时七对分支排除的证据。
- 飘财限制（025-027）：需飘财状态机（限制生效与解除）实现证据、禁止集是否包含暗杠的分支证据、以及暗杠后出牌仅允许尾墩补牌选项的校验证据。
