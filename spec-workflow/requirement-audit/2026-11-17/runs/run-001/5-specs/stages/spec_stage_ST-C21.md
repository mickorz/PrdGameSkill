# ST-C21 结算

## 阶段概述

本阶段规定一小局结束后的完整结算链路：胡牌确认后冻结行牌与操作、每小局唯一一次结算、三种胡牌方式的胡张认定、终局牌桌亮牌与番型字效、累计积分刷新与飘分、黄庄专属表现，以及小结算的层级、行序、行内牌面、得分与番型标注、承包标注、底部财神与长按回看、继续游戏与返回大厅。

- 原子数：48（AT-ST-C21-001 ~ AT-ST-C21-048），分属 11 个功能点：FP-ST-C21-001 结算触发与胡张认定（001-005）、FP-ST-C21-002 终局牌桌呈现（006-008）、FP-ST-C21-003 番型字效与点炮标记（009-011）、FP-ST-C21-004 累计积分刷新与飘分（012-015）、FP-ST-C21-005 黄庄结算（016-020）、FP-ST-C21-006 小结算布局与主题（021-025）、FP-ST-C21-007 小结算行内信息展示（026-030）、FP-ST-C21-008 小结算得分与番型标注（031-035）、FP-ST-C21-009 承包标注（036-039）、FP-ST-C21-010 小结算底部财神与长按查看牌桌（040-043）、FP-ST-C21-011 继续游戏与返回大厅（044-048）。
- L7 分布：verified 0 / verification_required 48 / decision_required 0 / not_applicable 0。
- analysisPath 分布：48 个原子全部为 `full`，无 `blocked`、无 `conflict-fast`；`l7Basis` 全部为 `proposed`，`scope=unknown`、`scopeSource=default-unknown`，`effectiveDifference` 一律为 `unverified`。
- 取证现状：本阶段 48 个原子在统一原子视图（`4-analysis/unified-atoms.json`）中双端字段全空——`client.verdict` 空、`client.evidenceIds` 空、`server.applicability` 空、`server.evidenceIds` 空、`server.configCondition` 空、双端 `directConflict=false`、`pending=false`。`2-client/client-evidence.json` 的 `coverage.pendingAtomIds` 明确列入本阶段全部 48 个原子（客户端本轮未取证，非「已查未找到」）；`3-server/server-evidence.json` 现有 60 条 SVE 的 `atomIds` 只覆盖 AT-ST-C01-*，无任何 C21 引用；CLE 12 条同样只挂 AT-ST-C01 系列。因此本阶段差异未判定的原因是证据空缺，**不是**查证未完成（无 `pending/timeout/failed`，非 `pending-blocked`）。
- 复核：AT-ST-C21-001 / 007 / 013 / 019 / 036 / 047 存在 `reviewStatus=pending` 的复核建议，建议值均为 `unverified`，**尚未生效**。
- 需求原文行号：结算触发与胡张认定 / 每小局一次结算 = PRD 第 280 行；终局牌桌呈现与番型字效、放铳点炮 = 第 282-283 行；累计积分刷新与飘分 = 第 284 行；黄庄结算 = 第 285 行；小结算布局与主题 = 第 287 行；行内信息展示 = 第 289 行；得分与番型标注 = 第 290-291 行；承包标注 = 第 292 行；底部财神与长按查看牌桌 = 第 293 行；继续游戏与返回大厅 = 第 294 行。

| 原子 | 名称 | 验证范围 | difference | L7 |
|---|---|---|---|---|
| AT-ST-C21-001 | 胡牌确认后停止行牌 | server | unverified | verification_required |
| AT-ST-C21-002 | 每小局只结算一次 | server | unverified | verification_required |
| AT-ST-C21-003 | 自摸胡张认定 | server | unverified | verification_required |
| AT-ST-C21-004 | 点炮胡胡张认定 | server | unverified | verification_required |
| AT-ST-C21-005 | 抢杠胡胡张认定 | server | unverified | verification_required |
| AT-ST-C21-006 | 结算时冻结操作与倒计时 | client | unverified | verification_required |
| AT-ST-C21-007 | 亮四家手牌并显示对局结束 | both | unverified | verification_required |
| AT-ST-C21-008 | 保留终局牌河财神余牌数 | client | unverified | verification_required |
| AT-ST-C21-009 | 胡牌者方位播放番型字效 | client | unverified | verification_required |
| AT-ST-C21-010 | 放铳方位显示点炮 | client | unverified | verification_required |
| AT-ST-C21-011 | 抢杠胡放铳者为加杠者 | server | unverified | verification_required |
| AT-ST-C21-012 | 刷新头像旁累计积分 | both | unverified | verification_required |
| AT-ST-C21-013 | 仅非零得分座位飘分 | both | unverified | verification_required |
| AT-ST-C21-014 | 飘分配色规则 | client | unverified | verification_required |
| AT-ST-C21-015 | 飘分淡出后打开小结算 | client | unverified | verification_required |
| AT-ST-C21-016 | 黄庄亮牌与提示 | client | unverified | verification_required |
| AT-ST-C21-017 | 黄庄保留终局牌河财神与余牌数20 | both | unverified | verification_required |
| AT-ST-C21-018 | 黄庄不飘分 | client | unverified | verification_required |
| AT-ST-C21-019 | 黄庄四家本局得分为0 | server | unverified | verification_required |
| AT-ST-C21-020 | 黄庄小结算标题 | client | unverified | verification_required |
| AT-ST-C21-021 | 小结算覆盖终局牌桌 | client | unverified | verification_required |
| AT-ST-C21-022 | 四家行序以本家为首 | client | unverified | verification_required |
| AT-ST-C21-023 | 本家行置顶并高亮 | client | unverified | verification_required |
| AT-ST-C21-024 | 胡牌局主题按净得分切换 | both | unverified | verification_required |
| AT-ST-C21-025 | 黄庄四端标题均为黄庄 | client | unverified | verification_required |
| AT-ST-C21-026 | 行左侧展示座位头像昵称 | client | unverified | verification_required |
| AT-ST-C21-027 | 庄家行标注庄×3 | both | unverified | verification_required |
| AT-ST-C21-028 | 碰杠区与手牌排布 | client | unverified | verification_required |
| AT-ST-C21-029 | 胡牌者分组与未胡者连续摆放 | client | unverified | verification_required |
| AT-ST-C21-030 | 胡入牌绿色胡标记 | client | unverified | verification_required |
| AT-ST-C21-031 | 净得分显示格式 | client | unverified | verification_required |
| AT-ST-C21-032 | 赢家牌组上方写番型名称 | both | unverified | verification_required |
| AT-ST-C21-033 | 多组番型全部书写 | both | unverified | verification_required |
| AT-ST-C21-034 | 最右侧标注胡牌方式 | both | unverified | verification_required |
| AT-ST-C21-035 | 赔付者标点炮 | client | unverified | verification_required |
| AT-ST-C21-036 | 三摊承包标注 | both | unverified | verification_required |
| AT-ST-C21-037 | 反承包标注 | both | unverified | verification_required |
| AT-ST-C21-038 | 链式承包双标与番型只写一次 | both | unverified | verification_required |
| AT-ST-C21-039 | 链式承包赔付方区分标注 | both | unverified | verification_required |
| AT-ST-C21-040 | 左下展示本局财神正面 | client | unverified | verification_required |
| AT-ST-C21-041 | 右下长按查看牌桌入口 | client | unverified | verification_required |
| AT-ST-C21-042 | 底部栏长按500毫秒查看终局牌桌 | client | unverified | verification_required |
| AT-ST-C21-043 | 松手恢复同一张小结算 | client | unverified | verification_required |
| AT-ST-C21-044 | 非末局继续游戏按钮 | client | unverified | verification_required |
| AT-ST-C21-045 | 点击继续游戏清理上一局 | both | unverified | verification_required |
| AT-ST-C21-046 | 点击后本家显示已准备 | both | unverified | verification_required |
| AT-ST-C21-047 | 四人准备后自动开下一小局 | server | unverified | verification_required |
| AT-ST-C21-048 | 第8局返回大厅按钮 | both | unverified | verification_required |

## 需求条目

### AT-ST-C21-001 胡牌确认后停止行牌

- 所属功能点：FP-ST-C21-001 结算触发与胡张认定（PRD 第 280 行）
- **需求规则**：胡牌确认后停止行牌。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：本原子验证范围限定服务端，客户端不作为判定依据；`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-001（未取证）。实现要点（需求口径，非证据）：客户端收到胡牌确认后不再向玩家开放摸牌、出牌等行牌操作。证据定位：无（12 条 CLE 全部挂 AT-ST-C01 系列）。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空——服务端未给出适用性判定，也未登记配置生效条件。规则说明：服务端在确认胡牌后收束本小局的行牌循环，不再安排后续的摸牌与出牌，使本小局在该时点终止。证据定位：无（60 条 SVE 的 `atomIds` 仅覆盖 AT-ST-C01-*，无 C21 引用）。
- **双端协作**：有人胡牌 → 服务端确认胡牌 → 服务端停止本小局行牌 → 结果下发到各端。
- **业务行为**：
  - trigger：有人胡牌并被确认
  - condition：胡牌已经确认
  - action：客户端不再开放摸牌出牌等行牌操作；服务端收束本小局行牌循环，不再安排后续摸牌与出牌
  - result：玩家看到本小局在胡牌确认后不再继续摸牌出牌
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空（无升级候选）。`baselineDetail`：需求（第 280 行）要求胡牌确认后停止行牌；本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端亦无 verdict 与证据，既无法证实已按需求停止行牌，也无法证实与需求矛盾，证据不足故判 unverified。差异未判定。
  待审批建议：unverified（`no-server-evidence-is-not-conflict`：本片 48 个 C21 原子双端均无证据，未取证不等于冲突），**未生效**。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（依据 effectiveDifference=unverified 提议；scope=unknown，`default-unknown`）。非 pending-blocked。

### AT-ST-C21-002 每小局只结算一次

- 所属功能点：FP-ST-C21-001 结算触发与胡张认定（PRD 第 280 行）
- **需求规则**：每小局只结算一次。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：本原子验证范围限定服务端；`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-002。实现要点（需求口径，非证据）：客户端只接受并展示一次本小局的结算结果。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：服务端对同一小局只执行一次结算，后续重复触发（重复胡牌确认、重复结算消息）不再重复结算，避免重复加减分。证据定位：无。
- **双端协作**：小局结束 → 服务端对本小局结算一次 → 结算结果下发 → 客户端展示一份结算。
- **业务行为**：
  - trigger：本小局结束需要结算
  - condition：处于同一小局内
  - action：客户端只接受并展示一次结算结果；服务端对同一小局只结算一次，重复触发不再结算
  - result：玩家每小局只看到一次结算，不会重复弹结算或重复加减分
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 280 行）要求每小局只结算一次；本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端亦无 verdict 与证据，无法证实结算只执行一次，也无法证实重复结算，证据不足故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C21-003 自摸胡张认定

- 所属功能点：FP-ST-C21-001 结算触发与胡张认定（PRD 第 280 行）
- **需求规则**：自摸的胡张是本次摸入或补入的牌。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：本原子验证范围限定服务端；`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-003。实现要点（需求口径，非证据）：客户端按服务端给出的胡张展示，自摸时把本次摸到或补到的那张作为胡张。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：服务端在自摸胡牌时把本次摸入或补入的那一张记录为胡张并随结算下发，胡张来源为本次摸/补动作。证据定位：无。
- **双端协作**：玩家自摸胡牌 → 服务端认定本次摸入或补入的牌为胡张 → 结算下发 → 客户端在小结算中展示该胡张。
- **业务行为**：
  - trigger：玩家以自摸方式胡牌
  - condition：本次胡牌方式是自摸
  - action：客户端按服务端胡张展示；服务端把本次摸入或补入的牌记录为胡张随结算下发
  - result：玩家在小结算中看到自摸的胡张是自己刚摸到或补到的那张牌
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 280 行）要求自摸胡张为本次摸入或补入的牌；本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端亦无 verdict 与证据，无法证实胡张归属正确，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-004 点炮胡胡张认定

- 所属功能点：FP-ST-C21-001 结算触发与胡张认定（PRD 第 280 行）
- **需求规则**：点炮胡的胡张是弃牌。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：本原子验证范围限定服务端；`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-004。实现要点（需求口径，非证据）：客户端按服务端给出的胡张展示，点炮胡时把别人打出的那张弃牌作为胡张。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：服务端在点炮胡时把他人打出的弃牌记录为胡张，并随结算下发该胡张及其来源座位。证据定位：无。
- **双端协作**：他人打出弃牌 → 玩家点炮胡 → 服务端认定该弃牌为胡张 → 结算下发 → 客户端在小结算中展示该胡张。
- **业务行为**：
  - trigger：玩家以点炮方式胡牌
  - condition：本次胡牌方式是点炮胡
  - action：客户端按服务端胡张展示；服务端把他人打出的弃牌记录为胡张
  - result：玩家在小结算中看到点炮胡的胡张就是别人打出的那张弃牌
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 280 行）要求点炮胡胡张为弃牌；本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端亦无 verdict 与证据，无法证实弃牌被正确认定为胡张，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-005 抢杠胡胡张认定

- 所属功能点：FP-ST-C21-001 结算触发与胡张认定（PRD 第 280 行）
- **需求规则**：抢杠胡的胡张是被抢的第 4 张。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：本原子验证范围限定服务端；`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-005。实现要点（需求口径，非证据）：客户端按服务端给出的胡张展示，抢杠胡时把被抢的那张牌作为胡张。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：服务端在抢杠胡时把被抢的第 4 张加杠牌记录为胡张并随结算下发。证据定位：无。
- **双端协作**：他人加杠 → 玩家抢杠胡 → 服务端认定被抢的第 4 张牌为胡张 → 结算下发 → 客户端在小结算中展示该胡张。
- **业务行为**：
  - trigger：玩家以抢杠方式胡牌
  - condition：本次胡牌方式是抢杠胡
  - action：客户端按服务端胡张展示；服务端把被抢的第 4 张加杠牌记录为胡张
  - result：玩家在小结算中看到抢杠胡的胡张就是被抢的那第 4 张牌
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 280 行）要求抢杠胡胡张为被抢的第 4 张牌；本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端亦无 verdict 与证据，无法证实抢杠胡张认定正确，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-006 结算时冻结操作与倒计时

- 所属功能点：FP-ST-C21-002 终局牌桌呈现（PRD 第 282 行）
- **需求规则**：各端停止操作按钮、胡牌预览和放大弃牌，方位盘停止倒计时。
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空——客户端未给出结论，`coverage.pendingAtomIds` 已列入 AT-ST-C21-006（未取证，非「已查未找到」）。实现要点（需求口径，非证据）：进入结算时关闭操作按钮的可用状态、收起胡牌预览与放大弃牌，并使方位盘倒计时停走。证据定位：无（12 条 CLE 全部挂 AT-ST-C01 系列）。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：本原子验证范围限定客户端表现；服务端侧对应动作为确认胡牌后不再下发新的可操作时机，使各端无法继续行动。证据定位：无。
- **双端协作**：胡牌确认 → 服务端停止本局行动时机 → 各端收到结算开始 → 客户端关闭操作按钮、收起胡牌预览与放大弃牌、方位盘倒计时停走。
- **业务行为**：
  - trigger：本小局进入结算
  - condition：胡牌已经确认
  - action：客户端停止操作按钮、胡牌预览、放大弃牌并停走方位盘倒计时；服务端不再下发新的可操作时机
  - result：玩家无法再操作，看不到胡牌预览和放大弃牌，方位盘倒计时不再变化
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 282 行，UI 要求：停止操作按钮可用状态、关闭胡牌预览与放大弃牌、方位盘倒计时停走）要求各端在结算时停止一切操作表现；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实已按需求停止，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-007 亮四家手牌并显示对局结束

- 所属功能点：FP-ST-C21-002 终局牌桌呈现（PRD 第 282 行）
- **需求规则**：在原牌桌亮出四家手牌，桌面中央显示「对局结束」。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-007。实现要点（需求口径，非证据）：客户端在原牌桌上翻开四家手牌，并在桌面中央显示「对局结束」提示。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：服务端在胡牌确认后把四家手牌数据下发给各端，用于终局展示。证据定位：无。
- **双端协作**：胡牌确认 → 服务端把四家手牌下发 → 客户端在原牌桌亮出四家手牌并显示「对局结束」。
- **业务行为**：
  - trigger：本小局胡牌结算开始
  - condition：胡牌已经确认
  - action：客户端在原牌桌翻开四家手牌并显示「对局结束」；服务端下发四家手牌供终局展示
  - result：玩家能在原牌桌上看到四家的完整手牌，桌面中央出现「对局结束」字样
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 282 行）要求在原牌桌亮出四家手牌并在桌面中央显示「对局结束」；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实已亮牌并显示提示，也未见矛盾证据，故判 unverified。差异未判定。
  待审批建议：unverified（`evidence-is-not-consistency`：无任何 CLE/SVE 证据支撑，不能凭需求描述与常见实现形态判 consistent），**未生效**。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-008 保留终局牌河财神余牌数

- 所属功能点：FP-ST-C21-002 终局牌桌呈现（PRD 第 282 行）
- **需求规则**：保留终局牌河、财神和余牌数。
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-008。实现要点（需求口径，非证据）：客户端在终局牌桌上不清空牌河、财神与余牌数，保持其原有展示。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：本原子以客户端呈现为主；服务端侧对应动作为胡牌确认后不再变更牌河、财神与余牌数，保持终局状态。证据定位：无。
- **双端协作**：胡牌确认 → 服务端维持终局牌局状态 → 客户端在终局牌桌继续展示牌河、财神与余牌数。
- **业务行为**：
  - trigger：进入终局牌桌展示
  - condition：本小局以胡牌结算
  - action：客户端不清空牌河、财神与余牌数；服务端不再变更三者
  - result：玩家在终局牌桌上仍能看到牌河、财神和余牌数
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 282 行）要求终局牌桌保留牌河、财神和余牌数；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实三者被保留，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-009 胡牌者方位播放番型字效

- 所属功能点：FP-ST-C21-003 番型字效与点炮标记（PRD 第 283 行）
- **需求规则**：「对局结束」仍在时，在胡牌者方位播放番型字效。
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-009。实现要点（需求口径，非证据）：在「对局结束」提示保持显示期间，于胡牌者座位方位播放番型字效，字效与提示同时存在。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：本原子以客户端时序表现为主；服务端侧对应动作为把胡牌者座位与命中的番型名称随结算下发。证据定位：无。
- **双端协作**：胡牌确认 → 服务端下发胡牌者座位与番型 → 客户端在「对局结束」提示仍在时于胡牌者方位播放番型字效。
- **业务行为**：
  - trigger：「对局结束」提示仍在显示
  - condition：本小局为胡牌结算且胡牌者方位已确定
  - action：客户端在胡牌者方位播放番型字效且保持「对局结束」显示；服务端下发胡牌者座位与番型
  - result：玩家看到「对局结束」提示还在时，胡牌者的座位方位出现番型字效
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 283 行）要求「对局结束」显示期间在胡牌者方位播放番型字效；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实字效播放时机与方位，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-010 放铳方位显示点炮

- 所属功能点：FP-ST-C21-003 番型字效与点炮标记（PRD 第 283 行）
- **需求规则**：点炮胡和抢杠胡同时在放铳方位显示「点炮」。
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-010。实现要点（需求口径，非证据）：在放铳者座位方位显示「点炮」标记，点炮胡与抢杠胡两种情形都触发。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：服务端判定本次胡牌的放铳者并把其座位随结算下发，供客户端定位标记方位。证据定位：无。
- **双端协作**：点炮胡或抢杠胡 → 服务端确定放铳者 → 结算下发 → 客户端在放铳者方位显示「点炮」。
- **业务行为**：
  - trigger：本小局以点炮胡或抢杠胡结束
  - condition：胡牌方式是点炮胡或抢杠胡
  - action：客户端在放铳者座位方位显示「点炮」；服务端判定并下发放铳者座位
  - result：玩家在放铳者的座位方位看到「点炮」标记
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 283 行）要求点炮胡和抢杠胡时在放铳方位显示「点炮」；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实「点炮」标记是否出现及方位是否正确，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-011 抢杠胡放铳者为加杠者

- 所属功能点：FP-ST-C21-003 番型字效与点炮标记（PRD 第 283 行）
- **需求规则**：抢杠胡的放铳者是加杠者。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：本原子验证范围限定服务端；`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-011。实现要点（需求口径，非证据）：客户端按服务端下发的放铳者座位展示「点炮」方位。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：服务端在抢杠胡时把实施加杠的那名玩家认定为放铳者并随结算下发，放铳标记与赔付指向该加杠者。证据定位：无。
- **双端协作**：他人加杠 → 玩家抢杠胡 → 服务端把加杠者认定为放铳者 → 结算下发 → 客户端在加杠者方位展示「点炮」。
- **业务行为**：
  - trigger：玩家以抢杠方式胡牌
  - condition：本次胡牌方式是抢杠胡
  - action：客户端按服务端下发的放铳者展示「点炮」；服务端把加杠者认定为放铳者
  - result：玩家看到抢杠胡的放铳者就是那个加杠的人
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 283 行）要求抢杠胡的放铳者是加杠者；本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端亦无 verdict 与证据，无法证实放铳者认定正确，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-012 刷新头像旁累计积分

- 所属功能点：FP-ST-C21-004 累计积分刷新与飘分（PRD 第 284 行）
- **需求规则**：先刷新头像旁的累计积分。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-012。实现要点（需求口径，非证据）：结算开始的第一步就刷新各座位头像旁的累计积分，刷新发生在番型字效等其他表现之前。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：服务端先算出各座位的最新累计积分并优先下发，使客户端能在结算首步刷新。证据定位：无。
- **双端协作**：胡牌确认 → 服务端先结算并下发各座位累计积分 → 客户端优先刷新头像旁累计积分 → 再播放后续结算表现。
- **业务行为**：
  - trigger：本小局结算开始
  - condition：胡牌已经被确认
  - action：客户端在结算首步刷新各座位头像旁累计积分；服务端先算并优先下发最新累计积分
  - result：玩家最先看到的是各座位头像旁的累计积分更新
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 284 行）要求结算开始时先刷新头像旁的累计积分；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实积分刷新的先后顺序，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-013 仅非零得分座位飘分

- 所属功能点：FP-ST-C21-004 累计积分刷新与飘分（PRD 第 284 行）
- **需求规则**：番型字效退场后，只在本局得分不为 0 的座位内侧飘分。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-013。实现要点（需求口径，非证据）：番型字效退场后，按各座位本局得分筛选，只对本局得分不为 0 的座位在座位内侧播放飘分，得分为 0 的座位不飘分。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：服务端把各座位本局得分随结算下发，供客户端判断哪些座位需要飘分；不走额外开关。证据定位：无（C01 结算类 SVE 只能说明服务端产出得分，不能证明客户端按非零筛选飘分）。
- **双端协作**：番型字效播放 → 字效退场 → 客户端按本局得分筛出非 0 座位 → 在这些座位内侧飘分。
- **业务行为**：
  - trigger：番型字效播完退场
  - condition：本局得分不为 0 的座位
  - action：客户端在字效退场后只对得分非 0 座位飘分；服务端下发各座位本局得分
  - result：玩家看到番型字效结束后，只有本局有得分变化的座位内侧飘出分数，得分为 0 的座位不飘分
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 284 行）要求番型字效退场后只在得分不为 0 的座位内侧飘分；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实飘分座位筛选与时机，也未见矛盾证据，故判 unverified。差异未判定。
  待审批建议：unverified（`evidence-is-not-consistency`：得分产出证据不等于飘分座位筛选已实现，证据不足不判 consistent），**未生效**。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-014 飘分配色规则

- 所属功能点：FP-ST-C21-004 累计积分刷新与飘分（PRD 第 284 行）
- **需求规则**：正分金黄色，负分浅蓝灰色并带减号。
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-014。实现要点（需求口径，非证据）：正分飘分显示为金黄色，负分飘分显示为浅蓝灰色并在数字前带减号，玩家凭颜色与符号即可区分正负。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：本原子以客户端配色表现为主；服务端侧对应动作为下发各座位本局得分的正负与数值。证据定位：无。
- **双端协作**：服务端下发各座位得分 → 客户端按正负选择颜色与符号 → 座位内侧飘出对应颜色的分数。
- **业务行为**：
  - trigger：座位内侧播放飘分
  - condition：该座位本局得分为正或为负
  - action：客户端把正分显示为金黄色、负分显示为浅蓝灰色并带减号；服务端下发得分正负与数值
  - result：玩家看到赢分的座位飘出金黄色数字，输分的座位飘出带减号的浅蓝灰色数字
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 284 行）要求正分金黄色、负分浅蓝灰色并带减号；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实飘分颜色与正负号表现，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-015 飘分淡出后打开小结算

- 所属功能点：FP-ST-C21-004 累计积分刷新与飘分（PRD 第 284 行）
- **需求规则**：飘分淡出后短暂保留终局牌桌，再打开小结算。
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-015。实现要点（需求口径，非证据）：飘分淡出后让终局牌桌短暂停留，随后再打开小结算面板，形成「牌桌停留 → 小结算弹出」的顺序。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：本原子以客户端时序为主；服务端侧对应动作为本小局结束后只下发一次结算数据，供客户端按顺序展示。证据定位：无。
- **双端协作**：飘分淡出 → 客户端短暂保留终局牌桌 → 再打开小结算面板。
- **业务行为**：
  - trigger：飘分播完并淡出
  - condition：本小局发牌结束后的结算展示流程
  - action：客户端飘分淡出后先短暂保留终局牌桌再打开小结算；服务端只下发一次结算数据
  - result：玩家看到飘分消失后终局牌桌还停留片刻，然后才出现小结算
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 284 行）要求飘分淡出后短暂保留终局牌桌再打开小结算；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实该展示顺序，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-016 黄庄亮牌与提示

- 所属功能点：FP-ST-C21-005 黄庄结算（PRD 第 285 行）
- **需求规则**：黄庄：亮出四家手牌，桌面中央显示「黄庄」。
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-016。实现要点（需求口径，非证据）：在原牌桌翻开四家手牌，并在桌面中央显示「黄庄」，与胡牌局的「对局结束」提示形成区分。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：本原子以客户端呈现为主；服务端侧对应动作为判定本小局黄庄并把四家手牌下发用于终局展示。证据定位：无。
- **双端协作**：牌墙摸完无人胡牌 → 服务端判黄庄并下发四家手牌 → 客户端亮出四家手牌并显示「黄庄」。
- **业务行为**：
  - trigger：本小局判定为黄庄
  - condition：本小局没有人胡牌且牌墙摸完
  - action：客户端翻开四家手牌并显示「黄庄」；服务端判定黄庄并下发四家手牌
  - result：玩家在黄庄时看到四家手牌被亮出，桌面中央显示「黄庄」
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 285 行）要求黄庄时亮出四家手牌并在桌面中央显示「黄庄」；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实黄庄亮牌与提示，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-017 黄庄保留终局牌河财神与余牌数20

- 所属功能点：FP-ST-C21-005 黄庄结算（PRD 第 285 行）
- **需求规则**：黄庄保留终局牌河、财神和余牌数 20。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-017。实现要点（需求口径，非证据）：黄庄终局牌桌上保留牌河与财神展示，并把余牌数显示为 20。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：服务端在黄庄时下发终局的牌河、财神与余牌数（黄庄时牌墙剩 20 张），余牌数值口径为 20。证据定位：无。
- **双端协作**：判黄庄 → 服务端下发牌河、财神与余牌数 → 客户端保留牌河与财神并显示余牌数 20。
- **业务行为**：
  - trigger：本小局判定为黄庄
  - condition：黄庄的终局牌桌展示
  - action：客户端保留牌河与财神并把余牌数显示为 20；服务端下发终局牌河、财神与余牌数
  - result：玩家在黄庄终局牌桌上仍能看到牌河和财神，余牌数显示为 20
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 285 行）要求黄庄终局保留牌河、财神并显示余牌数为 20；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实三者展示与数值 20，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-018 黄庄不飘分

- 所属功能点：FP-ST-C21-005 黄庄结算（PRD 第 285 行）
- **需求规则**：不飘分。
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-018。实现要点（需求口径，非证据）：黄庄时对所有座位都不播放飘分，直接跳过飘分环节。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：本原子以客户端表现为主；服务端侧对应动作为黄庄时不下发需要飘分的得分变化。证据定位：无。
- **双端协作**：判黄庄 → 服务端确认本局无分数变化 → 客户端跳过飘分表现。
- **业务行为**：
  - trigger：本小局判定为黄庄并进入终局展示
  - condition：本小局为黄庄而非胡牌
  - action：客户端对所有座位都不播放飘分；服务端不下发需要飘分的得分变化
  - result：玩家在黄庄时看不到任何座位飘分
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 285 行）要求黄庄时任何座位都不播放飘分；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实飘分被完全跳过，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-019 黄庄四家本局得分为0

- 所属功能点：FP-ST-C21-005 黄庄结算（PRD 第 285 行）
- **需求规则**：四家本局都是 0。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：本原子验证范围限定服务端；`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-019。实现要点（需求口径，非证据）：客户端按服务端下发的 0 分展示四家的本局得分。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：服务端在黄庄结算时把四家的本局得分都记为 0 并随结算下发。证据定位：无。
- **双端协作**：判黄庄 → 服务端把四家本局得分都结算为 0 → 结算下发 → 客户端四家本局得分均显示 0。
- **业务行为**：
  - trigger：本小局判定为黄庄
  - condition：黄庄结算
  - action：客户端按 0 分展示；服务端把四家本局得分都记为 0
  - result：玩家看到黄庄时四家的本局得分都是 0
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 285 行）要求黄庄时四家本局都是 0 分；本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端亦无 verdict 与证据，无法证实四家本局得分均为 0，也未见矛盾证据，故判 unverified。差异未判定。
  待审批建议：unverified（`no-server-evidence-is-not-conflict`：黄庄结算无服务端证据不等于需求被违背），**未生效**。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-020 黄庄小结算标题

- 所属功能点：FP-ST-C21-005 黄庄结算（PRD 第 285 行）
- **需求规则**：随后打开小结算，标题为「黄庄」。
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-020。实现要点（需求口径，非证据）：黄庄终局展示结束后打开的小结算标题显示为「黄庄」。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：本原子以客户端文案为主；服务端侧对应动作为在结算数据中标记本小局为黄庄。证据定位：无。
- **双端协作**：判黄庄 → 服务端标记黄庄 → 客户端打开小结算并把标题设为「黄庄」。
- **业务行为**：
  - trigger：黄庄终局展示结束后打开小结算
  - condition：本小局为黄庄
  - action：客户端把小结算标题显示为「黄庄」；服务端在结算数据中标记黄庄
  - result：玩家看到黄庄时打开的小结算标题是「黄庄」
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 285 行）要求黄庄小结算标题为「黄庄」；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实标题文案，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-021 小结算覆盖终局牌桌

- 所属功能点：FP-ST-C21-006 小结算布局与主题（PRD 第 287 行）
- **需求规则**：小结算盖在终局牌桌上。
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-021。实现要点（需求口径，非证据）：小结算以浮层形式覆盖在终局牌桌之上打开，不清除底下牌桌，形成覆盖而非替换关系。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：本原子以客户端层级为主；服务端侧对应动作为在终局牌桌状态之上再下发结算数据供浮层展示。证据定位：无。
- **双端协作**：终局牌桌保留 → 结算数据下发 → 客户端把小结算作为覆盖层盖在牌桌之上。
- **业务行为**：
  - trigger：小结算面板打开
  - condition：本小局结算展示
  - action：客户端把小结算作为浮层覆盖在终局牌桌之上；服务端在牌桌状态之上下发结算数据
  - result：玩家看到小结算浮在终局牌桌上方，底下牌桌仍被遮住而非替换
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 287 行）要求小结算以覆盖层形式盖在终局牌桌之上；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实浮层叠加关系，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-022 四家行序以本家为首

- 所属功能点：FP-ST-C21-006 小结算布局与主题（PRD 第 287 行）
- **需求规则**：各端以本家为第一行，向下依次为下家、对家、上家。
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-022。实现要点（需求口径，非证据）：按本家视角确定座次，自上而下排为本家、下家、对家、上家四行。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：本原子以客户端重排为主；服务端侧对应动作为下发四家座位与牌面数据。证据定位：无。
- **双端协作**：结算数据下发 → 客户端按本家视角确定座次顺序 → 自上而下排出本家、下家、对家、上家四行。
- **业务行为**：
  - trigger：小结算面板打开
  - condition：胡牌或黄庄的结算展示
  - action：客户端按本家、下家、对家、上家自上而下排列四行；服务端下发四家座位与牌面数据
  - result：玩家看到小结算第一行是自己，往下依次是下家、对家、上家
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 287 行）要求小结算按本家、下家、对家、上家自上而下排列四行；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实行序排列，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-023 本家行置顶并高亮

- 所属功能点：FP-ST-C21-006 小结算布局与主题（PRD 第 287 行）
- **需求规则**：本家行置顶并高亮。
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-023。实现要点（需求口径，非证据）：把本家所在行放在列表最顶部并做高亮处理，与其他三行形成视觉区分。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：本原子以客户端呈现为主；服务端侧对应动作为下发各座位与本家的对应关系。证据定位：无。
- **双端协作**：结算数据下发 → 客户端标出本家行 → 本家行置顶并高亮。
- **业务行为**：
  - trigger：小结算面板打开
  - condition：结算列表展示四行座位
  - action：客户端把本家行置顶并高亮；服务端下发各座位与本家的对应关系
  - result：玩家看到自己所在的那一行在最上面，并且明显被高亮
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 287 行）要求本家行置顶并高亮；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实置顶与高亮表现，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-024 胡牌局主题按净得分切换

- 所属功能点：FP-ST-C21-006 小结算布局与主题（PRD 第 287 行）
- **需求规则**：胡牌局按本端本局净得分切换主题：大于或等于 0 为「恭喜获胜」，小于 0 为「遗憾失败」。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-024。实现要点（需求口径，非证据）：按本端本局净得分正负切换小结算标题，边界为 0 归入「恭喜获胜」。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：服务端算出每位玩家本局净得分并随结算下发，供各端判断标题；不设额外开关。证据定位：无。
- **双端协作**：胡牌确认 → 服务端算净得分下发 → 客户端按本端净得分 ≥0 或 <0 选择标题。
- **业务行为**：
  - trigger：胡牌局打开小结算
  - condition：本端本局净得分大于或等于 0 时标题为「恭喜获胜」，小于 0 时标题为「遗憾失败」
  - action：客户端按本端净得分正负切换标题；服务端下发每位玩家本局净得分
  - result：玩家看到赢或平不亏时小结算标题为「恭喜获胜」，输分时标题为「遗憾失败」
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 287 行）要求按本端本局净得分以 0 为界切换「恭喜获胜」「遗憾失败」标题；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实标题切换逻辑，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-025 黄庄四端标题均为黄庄

- 所属功能点：FP-ST-C21-006 小结算布局与主题（PRD 第 287 行）
- **需求规则**：黄庄四端都是「黄庄」。
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-025。实现要点（需求口径，非证据）：黄庄时四端标题统一显示「黄庄」，不按各自净得分切换主题。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：本原子以客户端文案为主；服务端侧对应动作为把黄庄标记随结算下发。证据定位：无。
- **双端协作**：判黄庄 → 服务端下发黄庄标记 → 四端都把小结算标题显示为「黄庄」。
- **业务行为**：
  - trigger：黄庄局打开小结算
  - condition：本小局为黄庄
  - action：客户端四端标题统一显示「黄庄」；服务端下发黄庄标记
  - result：玩家在黄庄时看到所有人的小结算标题都是「黄庄」
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 287 行）要求黄庄时四端标题统一为「黄庄」；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实四端标题一致，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-026 行左侧展示座位头像昵称

- 所属功能点：FP-ST-C21-007 小结算行内信息展示（PRD 第 289 行）
- **需求规则**：每行左侧为座位、头像和昵称。
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-026。实现要点（需求口径，非证据）：每行左侧依次排布座位标识、头像、昵称三项。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：本原子以客户端排布为主；服务端侧对应动作为下发各座位的座位标识、头像与昵称数据。证据定位：无。
- **双端协作**：结算数据下发 → 客户端逐行在左侧依次排布座位标识、头像、昵称。
- **业务行为**：
  - trigger：小结算每行座位信息展示
  - condition：结算列表渲染
  - action：客户端在每行左侧依次显示座位标识、头像与昵称；服务端下发座位、头像、昵称数据
  - result：玩家看到每一行左侧都是座位标识、头像、昵称依次排列
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 289 行）要求每行左侧依次展示座位标识、头像和昵称；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实左侧元素与顺序，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-027 庄家行标注庄×3

- 所属功能点：FP-ST-C21-007 小结算行内信息展示（PRD 第 289 行）
- **需求规则**：庄家行显示「庄×3」。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-027。实现要点（需求口径，非证据）：在庄家所在行的座位标识处显示「庄×3」，文案含倍数 3。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：服务端下发本小局的庄家座位，供客户端识别庄家行。证据定位：无。
- **双端协作**：结算数据下发 → 客户端识别庄家座位 → 在庄家行显示「庄×3」。
- **业务行为**：
  - trigger：小结算每行展示
  - condition：该座位是本小局的庄家
  - action：客户端在庄家行座位标识处显示「庄×3」；服务端下发庄家座位
  - result：玩家看到庄家那一行的标识显示为「庄×3」
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 289 行）要求庄家行显示「庄×3」；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实庄家标识与倍数，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-028 碰杠区与手牌排布

- 所属功能点：FP-ST-C21-007 小结算行内信息展示（PRD 第 289 行）
- **需求规则**：中间从左到右是碰杠区和手牌，杠的第 4 张垒在上方，暗杠顶张正面。
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-028。实现要点（需求口径，非证据）：行中间从左到右先排碰杠区再排手牌；杠的第 4 张垒在上方，暗杠的顶张显示正面。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：本原子以客户端排布为主；服务端侧对应动作为下发各座位的碰杠组合、杠类型与手牌数据。证据定位：无。
- **双端协作**：结算数据下发 → 客户端按碰杠区在左、手牌在右排布 → 杠牌第 4 张垒上方、暗杠顶张翻正面。
- **业务行为**：
  - trigger：小结算每行牌面展示
  - condition：该座位本小局有碰杠与手牌
  - action：客户端按碰杠区在前、手牌在后排列，杠第 4 张垒上方、暗杠顶张正面；服务端下发碰杠组合与手牌
  - result：玩家看到行中间左边是碰杠区、右边是手牌，杠多出的那张压在牌上，暗杠最上面一张正面朝上
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 289 行）要求行中间从左到右为碰杠区与手牌、杠第 4 张垒在上方、暗杠顶张正面；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实排布方式，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-029 胡牌者分组与未胡者连续摆放

- 所属功能点：FP-ST-C21-007 小结算行内信息展示（PRD 第 289 行）
- **需求规则**：胡牌者其余手牌按胡牌组合分组，未胡牌者连续摆放。
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-029。实现要点（需求口径，非证据）：胡牌者的其余手牌按胡牌组合分组摆放，未胡牌者的手牌连续摆放，两类呈现可区分。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：本原子以客户端摆放为主；服务端侧对应动作为下发胡牌者的和牌组合与各座位手牌数据。证据定位：无。
- **双端协作**：结算数据下发 → 客户端按是否胡牌区分，把手牌分组或连续摆放。
- **业务行为**：
  - trigger：小结算手牌展示
  - condition：该座位本小局是否胡牌
  - action：客户端把胡牌者手牌按组合分组、未胡牌者手牌连续摆放；服务端下发和牌组合与手牌数据
  - result：玩家看到胡牌的人手牌按组合分开呈现，没胡的人手牌连成一排
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 289 行）要求胡牌者手牌按胡牌组合分组、未胡牌者连续摆放；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实分组呈现，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-030 胡入牌绿色胡标记

- 所属功能点：FP-ST-C21-007 小结算行内信息展示（PRD 第 289 行）
- **需求规则**：胡入的那一张在所属组合内标绿色「胡」。
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-030。实现要点（需求口径，非证据）：定位胡张所在组合，在该牌上加绿色「胡」字标记，标记与所属组合绑定。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：本原子以客户端标记为主；服务端侧对应动作为下发胡张及其所在组合。证据定位：无。
- **双端协作**：结算数据下发 → 客户端定位胡张所在组合 → 在该牌上加绿色「胡」标记。
- **业务行为**：
  - trigger：小结算展示胡牌者手牌
  - condition：该座位是本小局胡牌者
  - action：客户端在胡张所属组合内加绿色「胡」标记；服务端下发胡张及其所在组合
  - result：玩家看到哪里是胡入的那张牌，并且它带着绿色「胡」字
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 289 行）要求胡入的那张牌在所属组合内带绿色「胡」字标记；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实胡张标记位置与样式，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-031 净得分显示格式

- 所属功能点：FP-ST-C21-008 小结算得分与番型标注（PRD 第 290 行）
- **需求规则**：右侧为本局净得分。正分带加号，0 分显示「0」，负分带减号。
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-031。实现要点（需求口径，非证据）：行右侧显示本局净得分，按三种格式分别处理——正分「+N」、零分「0」、负分「-N」。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：本原子以客户端格式为主；服务端侧对应动作为下发各座位本局净得分。证据定位：无。
- **双端协作**：结算数据下发 → 客户端按得分正负决定是否带加号或减号 → 行右侧显示净得分。
- **业务行为**：
  - trigger：小结算每行右侧得分展示
  - condition：该座位本局净得分为正、为 0 或为负
  - action：客户端按正负与零值格式显示净得分；服务端下发各座位净得分
  - result：玩家看到右边分数赢的是「+N」、没变化的是「0」、输的是「-N」
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 290 行）要求行右侧显示本局净得分、正分带加号、0 分显示「0」、负分带减号；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实符号表现，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-032 赢家牌组上方写番型名称

- 所属功能点：FP-ST-C21-008 小结算得分与番型标注（PRD 第 291 行）
- **需求规则**：赢家牌组上方写实际命中的番型名称。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-032。实现要点（需求口径，非证据）：在赢家牌组上方显示本次实际命中的番型名称，名称取自服务端判定结果。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：服务端判定并下发本次实际命中的番型名称，客户端不自行推导番型。证据定位：无。
- **双端协作**：胡牌确认 → 服务端判定命中番型 → 结算下发 → 客户端在赢家牌组上方写番型名称。
- **业务行为**：
  - trigger：小结算展示赢家手牌组
  - condition：该座位本小局胡牌
  - action：客户端在赢家牌组上方显示实际命中番型名称；服务端判定并下发番型名称
  - result：玩家看到赢家牌组上方写着这次中的番型叫什么
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 291 行）要求赢家牌组上方显示实际命中的番型名称；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实番型名称来源与展示，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-033 多组番型全部书写

- 所属功能点：FP-ST-C21-008 小结算得分与番型标注（PRD 第 291 行）
- **需求规则**：同时命中多组时都写上，例如「七对」「杠飘」。双财飘、双豪华七对、二连杠直接写全名。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-033。实现要点（需求口径，非证据）：把命中的多组番型逐项列出，不合并、不省略；双财飘、双豪华七对、二连杠这类组合直接显示完整名称。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：服务端判定全部命中的番型组合并下发，包含双财飘、双豪华七对、二连杠的完整名称，保证客户端可按名称逐项展示。证据定位：无。
- **双端协作**：胡牌确认 → 服务端判定多组命中番型 → 结算下发 → 客户端逐项列出番型名称并完整显示组合名。
- **业务行为**：
  - trigger：赢家同时命中多组番型
  - condition：同一手牌同时满足多组番型
  - action：客户端把命中番型都写上并完整显示组合名；服务端判定并下发全部命中番型
  - result：玩家看到赢家上方把命中的几组番型都列出来，不会只显示一组，组合番型是完整名称
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 291 行）要求同时命中多组时全部列出、双财飘/双豪华七对/二连杠直接写全名；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实多组番型的判定与命名，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-034 最右侧标注胡牌方式

- 所属功能点：FP-ST-C21-008 小结算得分与番型标注（PRD 第 291 行）
- **需求规则**：最右侧标胡牌方式：自摸、点炮胡或抢杠胡。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-034。实现要点（需求口径，非证据）：在行最右侧标注胡牌方式，取值限定为「自摸」「点炮胡」「抢杠胡」三者之一。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：服务端判定本次胡牌方式（自摸 / 点炮胡 / 抢杠胡）并随结算下发。证据定位：无。
- **双端协作**：胡牌确认 → 服务端判定胡牌方式 → 结算下发 → 客户端在行最右侧标注方式。
- **业务行为**：
  - trigger：小结算每行胡牌方式展示
  - condition：该座位本小局胡牌
  - action：客户端在行最右侧标注「自摸」/「点炮胡」/「抢杠胡」；服务端判定并下发胡牌方式
  - result：玩家看到胡牌那一行最右边写着是自摸、点炮胡还是抢杠胡
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 291 行）要求每行最右侧标注胡牌方式；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实胡牌方式标注，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-035 赔付者标点炮

- 所属功能点：FP-ST-C21-008 小结算得分与番型标注（PRD 第 291 行）
- **需求规则**：点炮胡、抢杠胡的赔付者标「点炮」。
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-035。实现要点（需求口径，非证据）：在赔付者（放铳者）所在行标注「点炮」，使用户能指出谁在赔付。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：本原子以客户端标注为主；服务端侧对应动作为判定赔付者座位并随结算下发。证据定位：无。
- **双端协作**：点炮胡或抢杠胡 → 服务端确定赔付者 → 结算下发 → 客户端在赔付者行标「点炮」。
- **业务行为**：
  - trigger：本小局为点炮胡或抢杠胡
  - condition：该座位是本局的赔付者（放铳者）
  - action：客户端在赔付者行标注「点炮」；服务端判定并下发赔付者座位
  - result：玩家看到掏钱那一行被标上了「点炮」
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 291 行）要求点炮胡与抢杠胡的赔付者行标注「点炮」；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实赔付者标注，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-036 三摊承包标注

- 所属功能点：FP-ST-C21-009 承包标注（PRD 第 292 行）
- **需求规则**：三摊承包：赢家标黄色「承包」，赔付者得分右侧标「三摊承包」。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-036。实现要点（需求口径，非证据）：给赢家行标黄色「承包」，并在赔付者得分右侧标「三摊承包」，两处文案与位置均不同。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空——本轮未登记 `configCondition`。规则说明：服务端判定本局为三摊承包并下发赢家与赔付者关系。复核理由援引的邻近能力证据 `SVE-AT-ST-C01-021-02`（common_game/com_game/common_game_com_result.cpp:289-295，`BoxResultStep::ApplyBaoContracts`）显示承包结算以三摊开关 `GetEnableThreeTanBao()` 为前置：开关未开启时直接 return，只有开启后才执行承包结算。该证据只证明服务端可产出承包关系，不证明小结算「承包 / 三摊承包」标注文案与位置，因此本原子服务端仍无直证。
- **双端协作**：结算 → 服务端判定三摊承包 → 下发承包关系 → 客户端标黄色「承包」与「三摊承包」。
- **业务行为**：
  - trigger：本小局结算命中三摊承包关系
  - condition：本局为三摊承包
  - action：客户端给赢家标黄色「承包」、给赔付者得分右侧标「三摊承包」；服务端判定并下发赢家与赔付者关系
  - result：玩家看到赢家那一行有黄色「承包」，付钱的那一行分数右边写着「三摊承包」
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 292 行）要求三摊承包时赢家标黄色「承包」、赔付者得分右侧标「三摊承包」；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实承包判定与标注，也未见矛盾证据，故判 unverified。差异未判定。
  待审批建议：unverified（`dual-side-collaboration-gap`：服务端承包关系能力已存在，客户端小结算承包标注未取证，属双端协作断点），**未生效**。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-037 反承包标注

- 所属功能点：FP-ST-C21-009 承包标注（PRD 第 292 行）
- **需求规则**：反承包：赢家标「反承包」，赔付者标「反承包」。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-037。实现要点（需求口径，非证据）：赢家行与赔付者行两处都标注「反承包」，与三摊承包的单侧标注形成区别。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：服务端判定本局为反承包并下发赢家与赔付者双方关系；未登记开关条件。证据定位：无。
- **双端协作**：结算 → 服务端判定反承包 → 下发关系 → 客户端在赢家行与赔付者行都标「反承包」。
- **业务行为**：
  - trigger：本小局结算命中反承包关系
  - condition：本局为反承包
  - action：客户端在赢家行与赔付者行都标「反承包」；服务端判定并下发双方关系
  - result：玩家看到赢家和掏钱的那一方都被标上了「反承包」
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 292 行）要求反承包时赢家行与赔付者行都标「反承包」；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实反承包判定与双行标注，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-038 链式承包双标与番型只写一次

- 所属功能点：FP-ST-C21-009 承包标注（PRD 第 292 行）
- **需求规则**：链式承包：赢家同时标「承包」和「反承包」，番型只写一次。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-038。实现要点（需求口径，非证据）：赢家行同时显示「承包」与「反承包」两个标识，且番型名称只出现一次，不做重复书写。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：服务端判定链式承包关系并下发，番型只计一次，使客户端可去重展示。证据定位：无。
- **双端协作**：结算 → 服务端判定链式承包 → 下发双方关系与单一番型 → 客户端在赢家行同时标「承包」「反承包」且番型只出现一次。
- **业务行为**：
  - trigger：本小局结算命中链式承包关系
  - condition：本局为链式承包，赢家同时是承包方和被承包方
  - action：客户端在赢家行同时显示「承包」与「反承包」且番型只写一次；服务端判定链式承包并让番型只计一次
  - result：玩家看到赢家那一行两个标识都有，番型名称没有重复出现
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 292 行）要求链式承包时赢家行同时标「承包」与「反承包」且番型只写一次；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实双标与番型去重，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-039 链式承包赔付方区分标注

- 所属功能点：FP-ST-C21-009 承包标注（PRD 第 292 行）
- **需求规则**：链式承包：付 S 的一方标「三摊承包」，付 2 × S 的一方标「反承包」。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-039。实现要点（需求口径，非证据）：按赔付倍数区分两个赔付者——付 S 的一方标「三摊承包」，付 2×S 的一方标「反承包」。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：服务端判定链式承包中各赔付者应付倍数（S 与 2×S）并下发，供客户端按倍数对应标注。证据定位：无。
- **双端协作**：结算 → 服务端算出各赔付者应付倍数 → 下发 → 客户端按付 S 或 2×S 分别标注。
- **业务行为**：
  - trigger：本小局结算命中链式承包关系
  - condition：链式承包中不同赔付者承担的倍数不同
  - action：客户端给付 S 的一方标「三摊承包」、付 2×S 的一方标「反承包」；服务端下发各赔付者应付倍数
  - result：玩家看到付一份的人标「三摊承包」，付两倍的人标「反承包」
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 292 行）要求链式承包时付 S 的一方标「三摊承包」、付 2×S 的一方标「反承包」；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实倍数分配与标注对应关系，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-040 左下展示本局财神正面

- 所属功能点：FP-ST-C21-010 小结算底部财神与长按查看牌桌（PRD 第 293 行）
- **需求规则**：左下展示本局财神正面，即白板。
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-040。实现要点（需求口径，非证据）：在小结算左下角展示本局财神的正面牌面，白板财神以正面呈现。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：本原子以客户端展示为主；服务端侧对应动作为下发本小局的财神牌。证据定位：无。
- **双端协作**：结算数据下发 → 客户端取本局财神 → 在左下角展示其正面（白板）。
- **业务行为**：
  - trigger：小结算面板打开
  - condition：本小局已确定财神
  - action：客户端在左下角展示本局财神正面（白板）；服务端下发财神牌
  - result：玩家在小结算左下角看到本局财神牌，正面朝上显示为白板
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 293 行）要求小结算左下展示本局财神正面（白板）；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实财神展示位置与正面呈现，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-041 右下长按查看牌桌入口

- 所属功能点：FP-ST-C21-010 小结算底部财神与长按查看牌桌（PRD 第 293 行）
- **需求规则**：右下为「长按查看牌桌」。
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-041。实现要点（需求口径，非证据）：在小结算右下角显示「长按查看牌桌」提示，作为回看终局牌桌的入口说明。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：本原子为纯客户端交互入口，服务端无需额外处理，终局牌桌数据在结算时已保留在客户端。证据定位：无。
- **双端协作**：小结算打开 → 客户端右下角显示「长按查看牌桌」提示 → 玩家可据此长按查看牌桌。
- **业务行为**：
  - trigger：小结算面板打开
  - condition：结算展示中
  - action：客户端在右下角显示「长按查看牌桌」提示；服务端无需额外处理
  - result：玩家在小结算右下角看到「长按查看牌桌」的提示文字
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 293 行）要求小结算右下角显示「长按查看牌桌」；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实提示文字与位置，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-042 底部栏长按500毫秒查看终局牌桌

- 所属功能点：FP-ST-C21-010 小结算底部财神与长按查看牌桌（PRD 第 293 行）
- **需求规则**：在底部栏扣除中央主按钮后的区域按住 500 毫秒，临时收起小结算，按本家视角查看终局牌桌。
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-042。实现要点（需求口径，非证据）：热区为底部栏中除中央主按钮以外的区域，按住持续 500 毫秒后临时收起小结算，并以本家视角展示终局牌桌。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：本原子为纯客户端交互，服务端不需要额外下发，终局牌桌数据在结算时已保留在客户端本地。证据定位：无。
- **双端协作**：玩家长按底部栏空白区 500 毫秒 → 客户端临时收起小结算 → 以本家视角显示终局牌桌。
- **业务行为**：
  - trigger：玩家在小结算底部栏按住
  - condition：按住的是底部栏中除中央主按钮以外的区域，且持续 500 毫秒
  - action：客户端临时收起小结算并以本家视角展示终局牌桌；服务端无需额外下发
  - result：玩家按住底部栏空白区域约半秒后，小结算收起、能看到自己视角的终局牌桌
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 293 行）要求底部栏除中央主按钮外区域按住 500 毫秒后收起小结算并以本家视角查看终局牌桌；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实长按时长、热区与视角，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-043 松手恢复同一张小结算

- 所属功能点：FP-ST-C21-010 小结算底部财神与长按查看牌桌（PRD 第 293 行）
- **需求规则**：松手恢复同一张小结算。
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-043。实现要点（需求口径，非证据）：松手后恢复此前那张小结算，内容与状态保持不变，不重新拉取结算数据。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：本原子为纯客户端恢复行为，服务端无需重新下发结算数据。证据定位：无。
- **双端协作**：长按查看牌桌 → 玩家松手 → 客户端把原小结算原样恢复显示。
- **业务行为**：
  - trigger：玩家松开长按查看终局牌桌的手指
  - condition：此前通过长按临时收起了小结算
  - action：客户端恢复此前那张小结算并保持内容与状态不变；服务端无需重新下发
  - result：玩家松手后回到同一张小结算，内容和刚才一样没有变化
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 293 行）要求松手后恢复同一张小结算、内容状态不变；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实恢复后的状态一致性，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-044 非末局继续游戏按钮

- 所属功能点：FP-ST-C21-011 继续游戏与返回大厅（PRD 第 294 行）
- **需求规则**：非末局底部中央为【继续游戏】。
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-044。实现要点（需求口径，非证据）：非第 8 局时，小结算底部中央显示【继续游戏】按钮。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：本原子以客户端按钮文案为主；服务端侧对应动作为下发本小局序号与末局标记，供客户端判断按钮文案。证据定位：无。
- **双端协作**：结算下发 → 客户端判断非末局 → 底部中央显示【继续游戏】。
- **业务行为**：
  - trigger：小结算面板打开
  - condition：本小局不是本桌第 8 局（非末局）
  - action：客户端在底部中央显示【继续游戏】；服务端下发局序号与末局标记
  - result：玩家在非末局的小结算底部中央看到【继续游戏】按钮
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 294 行）要求非末局时小结算底部中央为【继续游戏】；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实按钮文案与末局判断，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-045 点击继续游戏清理上一局

- 所属功能点：FP-ST-C21-011 继续游戏与返回大厅（PRD 第 294 行）
- **需求规则**：点击后本端收起小结算，清除上一局手牌、碰杠区和牌河，保留座位和累计积分。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-045。实现要点（需求口径，非证据）：点击【继续游戏】后收起小结算，清空上一局手牌、碰杠区与牌河，同时保留座位与累计积分展示，形成「清牌面、不清积分」的边界。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：服务端确认该玩家已点击继续，维持房间座位与累计积分，仅重置本局牌面状态。证据定位：无。
- **双端协作**：玩家点击【继续游戏】 → 客户端收起小结算并清空上一局牌面、保留座位与累计积分 → 服务端记录该玩家已继续。
- **业务行为**：
  - trigger：玩家点击小结算上的【继续游戏】
  - condition：小结算底部显示的是【继续游戏】
  - action：客户端收起小结算、清除上一局手牌碰杠区与牌河并保留座位与累计积分；服务端记录该玩家已继续
  - result：玩家看到小结算消失、牌桌上的旧手牌与牌河被清掉，座位和累计积分仍在
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 294 行）要求点击【继续游戏】后收起小结算、清除上一局手牌碰杠区与牌河、保留座位与累计积分；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实清理范围与保留项，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-046 点击后本家显示已准备

- 所属功能点：FP-ST-C21-011 继续游戏与返回大厅（PRD 第 294 行）
- **需求规则**：本家显示「已准备」。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-046。实现要点（需求口径，非证据）：点击【继续游戏】后本家座位处显示「已准备」状态，并随服务端同步展示其他玩家是否已准备。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：服务端记录该玩家进入准备状态，并把准备状态同步给同桌其他玩家。证据定位：无。
- **双端协作**：点击【继续游戏】 → 客户端本家显示「已准备」 → 服务端把准备状态同步给同桌其他玩家。
- **业务行为**：
  - trigger：玩家点击【继续游戏】后
  - condition：该玩家已点击继续、尚未进入下一小局
  - action：客户端在本家座位处显示「已准备」；服务端记录准备状态并同步给其他玩家
  - result：玩家自己看到「已准备」，其他玩家也能看到他已经准备好
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 294 行）要求点击【继续游戏】后本家显示「已准备」；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实准备状态展示与同步，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-047 四人准备后自动开下一小局

- 所属功能点：FP-ST-C21-011 继续游戏与返回大厅（PRD 第 294 行）
- **需求规则**：四人均准备后自动开下一小局。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：本原子验证范围限定服务端；`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-047。实现要点（需求口径，非证据）：客户端收到下一小局开始的通知后进入下一小局牌桌，不额外触发开始。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：服务端统计同桌四人的准备状态，在四人全部准备后自动开始下一小局并发牌，无需再点开始。证据定位：无。
- **双端协作**：四人先后点击【继续游戏】→ 服务端统计到四人全部准备 → 服务端自动开启下一小局 → 各端进入新一局。
- **业务行为**：
  - trigger：同桌四人都点击了继续
  - condition：房间内四位玩家都处于已准备状态
  - action：客户端在收到开局通知后进入下一小局；服务端在四人全部准备后自动开始下一小局并发牌
  - result：玩家看到四个人都准备好后，牌局自动开始下一小局，无需再点开始
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 294 行）要求四人均准备后自动开下一小局；本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端亦无 verdict 与证据，无法证实自动开局条件与时机，也未见矛盾证据，故判 unverified。差异未判定。
  待审批建议：unverified（`no-server-evidence-is-not-conflict`：准备/开局链路未取证，不能据缺失判冲突），**未生效**。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

### AT-ST-C21-048 第8局返回大厅按钮

- 所属功能点：FP-ST-C21-011 继续游戏与返回大厅（PRD 第 294 行）
- **需求规则**：第 8 局按钮为【返回大厅】，点击后退出房间。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，`coverage.pendingAtomIds` 已列入 AT-ST-C21-048。实现要点（需求口径，非证据）：第 8 局小结算底部中央按钮显示为【返回大厅】，玩家点击后退出房间回到大厅。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则说明：服务端在该玩家点击【返回大厅】后将其移出房间并回到大厅。证据定位：无。
- **双端协作**：第 8 局结算 → 客户端底部中央显示【返回大厅】 → 玩家点击 → 服务端让该玩家退出房间回到大厅。
- **业务行为**：
  - trigger：第 8 局结束打开小结算
  - condition：本小局是本桌第 8 局（末局）
  - action：客户端把底部中央按钮显示为【返回大厅】，点击后退出房间；服务端将该玩家移出房间并回到大厅
  - result：玩家在第 8 局小结算底部看到【返回大厅】，点一下就离开房间回到大厅
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 294 行）要求第 8 局小结算底部中央按钮为【返回大厅】、点击后退出房间；本轮客户端未检索到相关实现证据（无 verdict、无 evidenceIds），服务端 applicability 为空，无法证实末局按钮文案与退出房间行为，也未见矛盾证据，故判 unverified。差异未判定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`。

## 证据索引

本阶段 48 个原子在统一原子视图中均未挂载任何证据：`clientEvidenceIds` 与 `serverEvidenceIds` 全部为空，`directConflict=false`，`conflictEvidenceIds` 为空。证据池现状如下：

- `2-client/client-evidence.json`：`evidence` 共 12 条 CLE，`atomIds` 全部为 AT-ST-C01-001/002/003/004/005/009/010/011，无 ST-C21 归属；`coverage.pendingAtomIds` 含本阶段全部 48 个原子（客户端本轮未取证）。
- `3-server/server-evidence.json`：`evidence` 共 60 条 SVE，`atomIds` 全部为 AT-ST-C01-*，无 ST-C21 归属。
- 结论：**本阶段直接绑定的 CLE = 0 条、SVE = 0 条**，不存在可引用的 `file:line` 直证；本阶段所有「无证据」表述均据此得出，未引用任何未经登记的证据。

复核条目中援引的邻近能力证据（非本阶段原子直证，仅用于说明断点位置）：

| 证据 id | layer | file:line | claimKey | 关联原子 | 说明 |
|---|---|---|---|---|---|
| SVE-AT-ST-C01-021-02 | common_game | common_game/com_game/common_game_com_result.cpp:289-295 | contract-settle-guarded-by-three-tan-flag | AT-ST-C21-036 | `BoxResultStep::ApplyBaoContracts` 在 `GetEnableThreeTanBao()` 未开启时直接 return，只证明承包结算以三摊开关为前置、可产出承包关系，不证明小结算「承包 / 三摊承包」标注文案与位置 |

## 待处理事项

### 规则待验证（48 条）

`pending-list.md` 列出本阶段全部 48 个原子，问题类型均为「规则待验证」，说明为「证据不足」，建议动作均为「补证 both」。

| atomId | 验证范围 | 说明 | 建议动作 |
|---|---|---|---|
| AT-ST-C21-001 | server | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C21-002 | server | 证据不足 | 补证 both |
| AT-ST-C21-003 | server | 证据不足 | 补证 both |
| AT-ST-C21-004 | server | 证据不足 | 补证 both |
| AT-ST-C21-005 | server | 证据不足 | 补证 both |
| AT-ST-C21-006 | client | 证据不足 | 补证 both |
| AT-ST-C21-007 | both | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C21-008 | client | 证据不足 | 补证 both |
| AT-ST-C21-009 | client | 证据不足 | 补证 both |
| AT-ST-C21-010 | client | 证据不足 | 补证 both |
| AT-ST-C21-011 | server | 证据不足 | 补证 both |
| AT-ST-C21-012 | both | 证据不足 | 补证 both |
| AT-ST-C21-013 | both | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C21-014 | client | 证据不足 | 补证 both |
| AT-ST-C21-015 | client | 证据不足 | 补证 both |
| AT-ST-C21-016 | client | 证据不足 | 补证 both |
| AT-ST-C21-017 | both | 证据不足 | 补证 both |
| AT-ST-C21-018 | client | 证据不足 | 补证 both |
| AT-ST-C21-019 | server | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C21-020 | client | 证据不足 | 补证 both |
| AT-ST-C21-021 | client | 证据不足 | 补证 both |
| AT-ST-C21-022 | client | 证据不足 | 补证 both |
| AT-ST-C21-023 | client | 证据不足 | 补证 both |
| AT-ST-C21-024 | both | 证据不足 | 补证 both |
| AT-ST-C21-025 | client | 证据不足 | 补证 both |
| AT-ST-C21-026 | client | 证据不足 | 补证 both |
| AT-ST-C21-027 | both | 证据不足 | 补证 both |
| AT-ST-C21-028 | client | 证据不足 | 补证 both |
| AT-ST-C21-029 | client | 证据不足 | 补证 both |
| AT-ST-C21-030 | client | 证据不足 | 补证 both |
| AT-ST-C21-031 | client | 证据不足 | 补证 both |
| AT-ST-C21-032 | both | 证据不足 | 补证 both |
| AT-ST-C21-033 | both | 证据不足 | 补证 both |
| AT-ST-C21-034 | both | 证据不足 | 补证 both |
| AT-ST-C21-035 | client | 证据不足 | 补证 both |
| AT-ST-C21-036 | both | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C21-037 | both | 证据不足 | 补证 both |
| AT-ST-C21-038 | both | 证据不足 | 补证 both |
| AT-ST-C21-039 | both | 证据不足 | 补证 both |
| AT-ST-C21-040 | client | 证据不足 | 补证 both |
| AT-ST-C21-041 | client | 证据不足 | 补证 both |
| AT-ST-C21-042 | client | 证据不足 | 补证 both |
| AT-ST-C21-043 | client | 证据不足 | 补证 both |
| AT-ST-C21-044 | client | 证据不足 | 补证 both |
| AT-ST-C21-045 | both | 证据不足 | 补证 both |
| AT-ST-C21-046 | both | 证据不足 | 补证 both |
| AT-ST-C21-047 | server | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C21-048 | both | 证据不足 | 补证 both |

### 查证未完成（必要端缺口）

本阶段 0 条。48 个原子 `analysisPath` 全部为 `full`，无 `pending/timeout/failed` 导致的阻断，`blockedAtoms` 为空，故不适用 `pending-blocked` 口径。

### 需策划裁决（decision_required）

本阶段 0 条。

### 复核建议（reviewStatus=pending，尚未生效）

| atomId | 建议值 | 复核规则 | 状态 |
|---|---|---|---|
| AT-ST-C21-001 | unverified | no-server-evidence-is-not-conflict（本片 48 个 C21 原子双端均无证据，未取证不等于冲突） | pending / 未生效 |
| AT-ST-C21-007 | unverified | evidence-is-not-consistency（无任何 CLE/SVE 证据支撑，不能凭需求描述与常见实现形态判 consistent） | pending / 未生效 |
| AT-ST-C21-013 | unverified | evidence-is-not-consistency（得分产出证据不等于飘分座位筛选已实现，证据不足不判 consistent） | pending / 未生效 |
| AT-ST-C21-019 | unverified | no-server-evidence-is-not-conflict（黄庄结算无服务端证据不等于需求被违背） | pending / 未生效 |
| AT-ST-C21-036 | unverified | dual-side-collaboration-gap（服务端承包关系能力已存在，客户端小结算承包标注未取证，属双端协作断点） | pending / 未生效 |
| AT-ST-C21-047 | unverified | no-server-evidence-is-not-conflict（准备/开局链路未取证，不能据缺失判冲突） | pending / 未生效 |

上述建议需待审批（approve / reject / hold）；建议值均为 `unverified`，与当前生效的 `effectiveDifference=unverified` 相同，即使通过也不改变本阶段 L7 结论。**当前尚未生效。**

### 补证优先级（供后续取证参考，非结论）

- 结算触发与胡张（001-005）：服务端需补胡牌确认后的行牌收束证据、结算唯一性（是否按小局去重）、以及三种胡牌方式下胡张记录的来源字段；重点核对自摸「本次摸/补」、点炮「弃牌」、抢杠「被抢第 4 张」三类判定分支。
- 终局牌桌与番型字效（006-011）：客户端需补操作按钮禁用、胡牌预览与放大弃牌关闭、方位盘倒计时停走的实现位置，以及「对局结束」文案与四家亮牌入口；服务端需补亮牌数据下发时机与放铳者（含抢杠的加杠者）判定。
- 累计积分与飘分（012-015）：需补累计积分的刷新时序（先于番型字效）、飘分座位按本局得分非 0 筛选的分支、正负配色与减号格式、以及飘分淡出到小结算弹出的时序控制。
- 黄庄（016-020）：需补黄庄判定的流局条件、四家手牌亮出与「黄庄」中央文案、余牌数固定 20 的口径来源、跳过飘分的分支，以及黄庄不下发得分变化的实现。
- 小结算布局与主题（021-025）：需补浮层层级关系（覆盖而非替换）、按本家视角的四行排序与置顶高亮实现、以及标题按净得分 ≥0 / <0 切换的判定位置。
- 行内信息与牌面（026-030）：需补左侧三项的顺序、庄家「庄×3」文案来源、碰杠区与手牌排布（含杠第 4 张垒上方、暗杠顶张正面）、胡牌者分组与未胡者连续的处理，以及胡张绿色「胡」标记的组合定位。
- 得分与番型标注（031-035）：需补净得分三种格式（+N / 0 / -N）、番型名称来源与多组全列、双财飘/双豪华七对/二连杠全名映射，以及胡牌方式与赔付者「点炮」标注。
- 承包标注（036-039）：需补三摊承包、反承包、链式承包三种关系的标注文案与落点，尤其是链式承包的「番型只写一次」与按 S / 2×S 区分赔付方的分支（可对照 `ApplyBaoContracts` 的开关前置条件）。
- 底部财神与长按回看（040-043）：需补左下财神正面（白板）展示、右下文案、500 毫秒长按热区（底部栏扣除中央主按钮）、以及松手恢复同一实例的状态保持。
- 继续游戏与返回大厅（044-048）：需补非末局【继续游戏】/ 末局【返回大厅】的文案判定、点击后的清理范围（手牌、碰杠区、牌河）与保留项（座位、累计积分）、「已准备」状态同步，以及四人齐备自动开局的触发链路。
