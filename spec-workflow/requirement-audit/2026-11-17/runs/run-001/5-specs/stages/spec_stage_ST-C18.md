# ST-C18 三摊承包

## 阶段概述

本阶段规定三摊承包的摊数统计口径与成立边界（只由吃牌产生、庄闲之间才可承包、闲闲同向封顶 2 摊、与飘财无关、双向分开计）、第 3 摊当场成立与「三摊落地」提示的即时演出与不阻塞操作，以及自摸、点炮、抢杠胡三类场景下的承包赔付改写与三组数值算例。

- 原子数：27（AT-ST-C18-001 ~ AT-ST-C18-027），分属 5 个功能点：FP-ST-C18-001 摊的统计口径与成立条件（001-007）、FP-ST-C18-002 承包成立判定与落地提示（008-012）、FP-ST-C18-003 自摸场景的承包结算（013-019）、FP-ST-C18-004 点炮与抢杠胡的承包改写（020-024）、FP-ST-C18-005 承包结算算例校验（025-027）。
- L7 分布：verified 0 / verification_required 27 / decision_required 0 / not_applicable 0。
- analysisPath 分布：27 个原子全部为 `full`；无 `blocked`、无 `conflict-fast`、无升级候选（`candidateDifference` 全为空）。`l7Basis` 全部为 `proposed`，`scope=unknown`、`scopeSource=default-unknown`，`blockedAtoms` 为空。
- 取证现状：本阶段 27 个原子在统一原子视图中双端字段全空（client `verdict` 空、`evidenceIds` 空；server `applicability` 空、`evidenceIds` 空、`configCondition` 空；`directConflict=false`、`pending=false`），`effectiveDifference` 一律为 `unverified`，`trace_index.json` 对本阶段 27 条记录的 `evidenceCount` 均为 0。CLE 共 12 条、SVE 共 60 条，其 `atomIds` 全部只挂 AT-ST-C01 系列，本阶段原子无任何被归属证据。**差异未判定**的原因是取证空缺，而非查证未完成（不是 pending-blocked）。
- 复核：仅 AT-ST-C18-001 一条 `reviewStatus=pending` 的复核建议（建议值 unverified），其 `reviewReason` 覆盖 AT-ST-C18-001~027 整片，尚未生效。
- 验证范围分布：server 22（001-004、006-008、013-027）、client 3（009-011）、both 2（005、012）。
- 需求原文行号：摊的统计口径 = PRD 第 229 行、第 231 行；承包成立与「三摊落地」= 第 232 行；自摸结算与承包/反承包/链式 = 第 234 行、第 238-240 行；点炮与抢杠胡改写 = 第 236 行；算例 = 第 242 行、第 244 行。

| 原子 | 名称 | 验证范围 | difference | L7 |
|---|---|---|---|---|
| AT-ST-C18-001 | 只统计吃牌计摊 | server | unverified | verification_required |
| AT-ST-C18-002 | 吃牌者对出牌者加一摊 | server | unverified | verification_required |
| AT-ST-C18-003 | 承包仅限庄闲之间 | server | unverified | verification_required |
| AT-ST-C18-004 | 两闲家同向最多两摊 | server | unverified | verification_required |
| AT-ST-C18-005 | 满两摊不再给出吃 | both | unverified | verification_required |
| AT-ST-C18-006 | 摊与飘财无关 | server | unverified | verification_required |
| AT-ST-C18-007 | 两个方向分开计摊 | server | unverified | verification_required |
| AT-ST-C18-008 | 第三摊记承包 | server | unverified | verification_required |
| AT-ST-C18-009 | 四端播放三摊落地 | client | unverified | verification_required |
| AT-ST-C18-010 | 落地提示与吃牌字效并存 | client | unverified | verification_required |
| AT-ST-C18-011 | 成立时不出现承包角标 | client | unverified | verification_required |
| AT-ST-C18-012 | 提示期间可继续提牌出牌 | both | unverified | verification_required |
| AT-ST-C18-013 | 自摸仅结算本人承包对 | server | unverified | verification_required |
| AT-ST-C18-014 | 摊方自摸由对方付三家合计 | server | unverified | verification_required |
| AT-ST-C18-015 | 被摊方自摸由摊方付两倍 | server | unverified | verification_required |
| AT-ST-C18-016 | 双向满三摊只按两倍 | server | unverified | verification_required |
| AT-ST-C18-017 | 承包形式赔付分配 | server | unverified | verification_required |
| AT-ST-C18-018 | 反承包形式赔付两倍 | server | unverified | verification_required |
| AT-ST-C18-019 | 链式承包赔付分配 | server | unverified | verification_required |
| AT-ST-C18-020 | 点炮仅放铳者为承包对方时改写 | server | unverified | verification_required |
| AT-ST-C18-021 | 点炮改写基数为原那一笔 | server | unverified | verification_required |
| AT-ST-C18-022 | 他人承包关系不赔偿 | server | unverified | verification_required |
| AT-ST-C18-023 | 抢杠胡不替换杠赔付并叠加承包 | server | unverified | verification_required |
| AT-ST-C18-024 | 杠牌者为承包方两笔都付 | server | unverified | verification_required |
| AT-ST-C18-025 | 自摸承包算例 | server | unverified | verification_required |
| AT-ST-C18-026 | 叠加反承包算例 | server | unverified | verification_required |
| AT-ST-C18-027 | 反承包算例 | server | unverified | verification_required |

## 需求条目

### AT-ST-C18-001 只统计吃牌计摊

- 所属功能点：FP-ST-C18-001 摊的统计口径与成立条件（PRD 第 229 行）
- **需求规则**：摊只统计吃牌，碰、直杠、加杠、暗杠不计摊。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空，客户端未给出结论，也无 CLE 证据指向计摊来源。实现要点（需求口径，非证据）：客户端不参与摊数计算，也不据碰、杠动作自行推高摊数展示，摊数显示只取服务端下发的计摊结果；本原子验证范围限定服务端规则，客户端表现不作为判定依据。证据定位：无（`client-evidence.json:1092-1118` 将本原子列入 `coverage.pendingAtomIds`，未做分析）。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空，服务端未给出适用性判定。规则口径为：计摊写入点只有吃牌成立这一条路径，碰（pung）、直杠、加杠、暗杠四条路径均不得写入摊计数；未登记任何开关或人数条件（`configCondition` 空）。证据定位：无（`server-evidence.json:1479-1486` 统计 `atomCount=29`、`pending=387`，无 `atomIds` 含 AT-ST-C18 的记录）。
- **双端协作**：玩家打出牌 → 有人吃牌 → 服务端按吃牌写入摊数并下发 → 客户端按服务端结果展示摊数；碰、直杠、加杠、暗杠发生时服务端不写摊数，客户端也不应出现摊数变化。
- **业务行为**：
  - trigger：玩家打出牌后有人吃牌
  - condition：该动作是吃牌
  - action：计入摊数
  - result：（输入四元组该字段为空；需求口径为：只有吃牌会让摊数增加，碰与各类杠都不加摊）
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空（无升级候选）。
  `baselineDetail`：需求：摊只统计吃牌，碰、直杠、加杠、暗杠都不计摊。核对范围内该原子两端均无证据（服务端未覆盖、客户端未定位），实际是否只吃牌计摊、杠碰是否被排除在摊数之外无法还原，故不作符合性判定。
  待审批建议：unverified（`evidence-is-not-consistency`：本片 27 个原子双端证据均为零，客户端 `coverage.pendingAtomIds`、服务端 `stats.pending=387`，缺证只能维持 unverified，不得判 consistent，也不得凭缺证立 conflict）。复核理由补充：C18 全部 27 个原子集中在 `client-evidence.json:1092-1118` 的 `pendingAtomIds`，未做分析；服务端 `server-evidence.json:1479-1486` 同样只覆盖 AT-ST-C01 系列。该建议**未生效**。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（依据 effectiveDifference=unverified 提议；scope=unknown，`default-unknown`）。非 pending-blocked（`analysisPath=full`，无 pending/timeout/failed）。

### AT-ST-C18-002 吃牌者对出牌者加一摊

- 所属功能点：FP-ST-C18-001 摊的统计口径与成立条件（PRD 第 229 行）
- **需求规则**：A 吃 B 打出的牌，A 对 B 记 1 摊。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端不维护摊计数，也不以「吃牌者本人」为键自行累计；若界面展示摊数，须按服务端下发的有向计摊结果（吃牌方对被吃方）渲染。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：一次吃牌成立，在「吃牌方 → 出牌方」这一有向关系上加 1 摊，即摊计数以（吃牌座位, 出牌座位）为键；每次吃牌只加 1，不因吃牌张数或连吃一次动作多次累加；未登记开关。证据定位：无（`server-evidence.json:1479-1486`，无 `atomIds` 含 C18 的记录）。
- **双端协作**：B 打出牌 → A 吃进该牌 → 服务端在 A 对 B 的方向上摊数加 1 → 客户端按该方向摊数刷新展示（不自行推导）。
- **业务行为**：
  - trigger：A 吃进 B 打出的牌
  - condition：吃牌成立
  - action：A 对 B 的摊数加 1
  - result：（输入四元组该字段为空；需求口径为：A 记 B 一摊，方向固定为吃牌方对被吃方）
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求：A 吃 B 打出的牌，A 对 B 记 1 摊。两端均无证据，无法还原摊数是否加在「吃牌方对被吃方」这一方向上、以及每次吃牌是否只加 1。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。非 pending-blocked。

### AT-ST-C18-003 承包仅限庄闲之间

- 所属功能点：FP-ST-C18-001 摊的统计口径与成立条件（PRD 第 231 行）
- **需求规则**：只有庄家和闲家之间能承包。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端不判定承包是否成立，只按服务端下发的成立结果演出；不得在两名闲家之间自行触发承包表现。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：承包成立判定的适用对象限定为「一方是庄家、另一方是闲家」的摊关系，两名闲家之间的摊关系不进入承包成立判定（其上限另见 AT-ST-C18-004）；未登记开关。证据定位：无。
- **双端协作**：某方向摊数累计 → 服务端先校验承包双方身份（庄/闲）→ 仅庄闲之间才继续走承包成立判定 → 客户端按服务端结论演出。
- **业务行为**：
  - trigger：某一方向的摊数达到成立条件
  - condition：承包双方为庄家与闲家
  - action：判定承包成立
  - result：（输入四元组该字段为空；需求口径为：只有庄家与闲家之间才会出现承包）
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求：只有庄家和闲家之间才能承包。两端均无证据，无法还原承包是否被限制在庄闲之间、两闲家之间是否被排除。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。非 pending-blocked。

### AT-ST-C18-004 两闲家同向最多两摊

- 所属功能点：FP-ST-C18-001 摊的统计口径与成立条件（PRD 第 231 行）
- **验证范围**：server（`verificationScope=server`）
- **需求规则**：两名闲家之间，同一方向最多 2 摊，吃一成立就加 1。
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端不维护闲闲方向的封顶判定；封顶生效时表现为该方向摊数停在 2，客户端只按服务端下发的摊数展示。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：当摊关系双方均为闲家时，同一方向按「吃一次 +1」累计并封顶于 2 摊；与庄闲关系不共享封顶口径（庄闲方向可继续累到第 3 摊以成立承包）；未登记开关或人数条件。证据定位：无。
- **双端协作**：闲家 A 吃闲家 B 的牌 → 服务端在 A 对 B 方向 +1 并检查是否已达 2 摊 → 达上限后该方向不再允许新吃（见 AT-ST-C18-005）→ 客户端按摊数展示。
- **业务行为**：
  - trigger：一名闲家吃进另一名闲家的牌
  - condition：吃牌双方均为闲家且同一方向
  - action：对该方向摊数加 1，上限为 2 摊
  - result：（输入四元组该字段为空；需求口径为：闲闲同向最多 2 摊，到顶后不再增加）
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求：两名闲家之间同一方向最多 2 摊，吃一次成立加 1。两端均无证据，无法还原闲闲方向是否设 2 摊上限及是否吃一次即加 1。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。非 pending-blocked。

### AT-ST-C18-005 满两摊不再给出吃

- 所属功能点：FP-ST-C18-001 摊的统计口径与成立条件（PRD 第 231 行）
- **需求规则**：已经有 2 摊时，再吃这一家的牌不成立，不给出【吃】。
- **验证范围**：both（`verificationScope=both`）；`uiRequirement`：满 2 摊后不再向玩家给出【吃】按钮/选项。
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端按服务端下发的可操作选项渲染，该方向已满 2 摊时不出现【吃】按钮/选项，也不得本地放行吃牌入口；客户端不做封顶判定，仅做显隐。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：出牌后生成可响应集合时，对「该吃牌者对该出牌者该方向已有 2 摊」的关系不产出吃（chow）选项，即便牌型可吃也不下发；服务端拒绝成立先于客户端显隐，避免双端口径分叉；未登记开关。证据定位：无（`server-evidence.json:1479-1486`）。
- **双端协作**：玩家打出牌 → 服务端按摊数过滤吃选项（满 2 摊则不产出）→ 下发的可选操作中不含【吃】→ 客户端按该集合渲染，玩家看不到【吃】可点。
- **业务行为**：
  - trigger：玩家打出牌，其他玩家可响应
  - condition：该吃牌者对出牌者该方向已有 2 摊
  - action：不判定该吃牌成立并不下发吃选项
  - result：玩家看到没有【吃】可点
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求：某方向已满 2 摊后，再吃这一家的牌不成立，且不给玩家下发【吃】选项。该原子要求双端核对，但服务端与客户端均无证据，既无法确认服务端是否拒绝成立，也无法确认玩家界面上是否确实没有【吃】可点。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。非 pending-blocked。

### AT-ST-C18-006 摊与飘财无关

- 所属功能点：FP-ST-C18-001 摊的统计口径与成立条件（PRD 第 231 行）
- **需求规则**：摊的统计与飘财无关。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端不得把飘财状态与摊数展示联动（例如按飘次数改写摊数文案或额外角标）。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：摊计数只由吃牌决定，飘财次数（飘档）不参与摊数加减，也不作为承包成立条件的修正项；二者数据互不影响；未登记开关。证据定位：无。
- **双端协作**：玩家有飘财次数期间发生吃牌 → 服务端照常按吃牌 +1 摊 → 客户端展示的摊数与无飘财时一致。
- **业务行为**：
  - trigger：发生吃牌
  - condition：玩家有飘财次数
  - action：照常计摊，不因飘财改变摊数
  - result：（输入四元组该字段为空；需求口径为：有无飘财，摊数累计结果相同）
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求：摊的统计与飘财无关。两端均无证据，无法还原玩家有飘财次数时摊数是否仍按吃牌照常累计、不因飘财被加减。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。非 pending-blocked。

### AT-ST-C18-007 两个方向分开计摊

- 所属功能点：FP-ST-C18-001 摊的统计口径与成立条件（PRD 第 231 行）
- **需求规则**：两个方向分开计：A 对 B 与 B 对 A 的摊数分别累计。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：若界面按关系展示摊数，须按有向键分别取数，不合并为「二人之间的总摊数」。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：摊计数以有向对为键（A→B 与 B→A 为两条独立计数器），各自独立累计、各自独立判定封顶与承包成立，互不合并、互不冲抵；未登记开关。证据定位：无。
- **双端协作**：双方互有吃牌 → 服务端分别累计 A→B 与 B→A → 两个方向的封顶与承包成立分别判定 → 客户端按方向展示。
- **业务行为**：
  - trigger：双方互有吃牌
  - condition：存在两个方向的吃牌关系
  - action：分别累计各自方向的摊数
  - result：（输入四元组该字段为空；需求口径为：A 对 B、B 对 A 各记各的摊，互不合并）
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求：A 对 B 与 B 对 A 两个方向的摊数分开累计。两端均无证据，无法还原两个方向的摊数是否各自独立、互不合并。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。非 pending-blocked。

### AT-ST-C18-008 第三摊记承包

- 所属功能点：FP-ST-C18-002 承包成立判定与落地提示（PRD 第 232 行）
- **需求规则**：某一方向计到第 3 摊时记承包。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端不判定成立时点，成立与否则以服务端下发的承包标记为准。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：某有向方向的摊数由 2 增至 3 的那一次吃牌即就地标记该方向承包成立，成立时点在局中而非结算时；成立后该方向不再需要继续累加判成立；未登记开关。证据定位：无（`server-evidence.json:1479-1486`）。
- **双端协作**：第 3 次吃牌成立 → 服务端摊数增至 3 并当场标记承包成立 → 下发成立事件 → 客户端据此播放「三摊落地」（见 AT-ST-C18-009）。
- **业务行为**：
  - trigger：某一方向摊数增加到 3
  - condition：该方向摊数计到第 3 摊
  - action：标记该方向承包成立
  - result：（输入四元组该字段为空；需求口径为：第 3 摊当场记承包，不等结算）
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求：某一方向计到第 3 摊时即记承包成立。两端均无证据，无法还原承包是在第 3 摊当场成立，还是要等到结算才认定。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。非 pending-blocked。

### AT-ST-C18-009 四端播放三摊落地

- 所属功能点：FP-ST-C18-002 承包成立判定与落地提示（PRD 第 232 行）
- **需求规则**：承包成立时四端播放「三摊落地」提示。
- **验证范围**：client（`verificationScope=client`）；`uiRequirement`：四个玩家端同时播放「三摊落地」动效提示。
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：以服务端下发的承包成立事件为触发源，在该局四个座位端（含本家与三家）同时播放同一「三摊落地」动效提示；提示为一次性播放在成立时刻触发，不依赖结算阶段；四端均需播放，不能只在成立双方端播放。证据定位：无（`client-evidence.json:1092-1118` 的 `pendingAtomIds`）。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：承包成立需向四端广播成立事件（含成立方向与摊数），客户端演出由该事件驱动；未登记开关。证据定位：无。
- **双端协作**：服务端判定第 3 摊成立 → 向四端广播承包成立事件 → 客户端在四端同时播放「三摊落地」动效。
- **业务行为**：
  - trigger：服务端判定承包成立
  - condition：某一方向计到第 3 摊
  - action：四个玩家端播放「三摊落地」提示
  - result：四端玩家都看到「三摊落地」演出
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求：承包成立时四个玩家端同时播放「三摊落地」提示动效。客户端无证据，无法还原四端是否都会播放该提示、提示在什么时候触发。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。非 pending-blocked。

### AT-ST-C18-010 落地提示与吃牌字效并存

- 所属功能点：FP-ST-C18-002 承包成立判定与落地提示（PRD 第 232 行）
- **需求规则**：「三摊落地」提示可与吃牌字效同时显示。
- **验证范围**：client（`verificationScope=client`）；`uiRequirement`：「三摊落地」提示与吃牌字效不互相覆盖，可同时显示。
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：第 3 摊成立必然伴随一次吃牌，故两个表现同帧触发；客户端须让吃牌字效与「三摊落地」提示走互不打断的表现通道（不互斥、不后到者顶掉先到者、不同槽位或不同层级并排显示）。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：吃牌结果与承包成立事件可同批下发，不需人为错开；服务端不承担表现互斥职责。证据定位：无。
- **双端协作**：吃牌成立且该次吃牌使方向达到第 3 摊 → 服务端同时下发吃牌结果与承包成立 → 客户端并行播放吃牌字效与「三摊落地」。
- **业务行为**：
  - trigger：吃牌成立同时该方向计到第 3 摊
  - condition：吃牌字效与承包提示同时触发
  - action：两个表现同时播放
  - result：玩家同时看到吃牌字效和「三摊落地」
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求：「三摊落地」提示可与吃牌字效同时显示、不互相覆盖。客户端无证据，无法还原两者同时触发时是否都能正常显示。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。非 pending-blocked。

### AT-ST-C18-011 成立时不出现承包角标

- 所属功能点：FP-ST-C18-002 承包成立判定与落地提示（PRD 第 232 行）
- **需求规则**：不等到结算，当时没有承包角标。
- **验证范围**：client（`verificationScope=client`）；`uiRequirement`：承包成立当时界面不显示承包角标，不提前到结算前展示。
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：成立时刻只播「三摊落地」提示，玩家座位/牌桌区域不出现承包角标；角标只在结算阶段的小结算中随承包标注出现（见 ST-C21 承包标注）；不得把承包状态做成对局中的常驻标识。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：成立事件只承担提示触发语义，不附带「对局中角标状态」这类常驻展示字段；承包关系在结算阶段统一随结算数据下发。证据定位：无。
- **双端协作**：承包成立 → 服务端下发成立事件（仅提示语义）→ 客户端播提示且不加角标 → 结算时随结算数据展示承包标注。
- **业务行为**：
  - trigger：承包成立提示播放期间
  - condition：尚未进入结算
  - action：不展示承包角标
  - result：玩家看不到承包角标
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求：承包成立当时不显示承包角标，不提前到结算前展示。客户端无证据，无法还原承包成立瞬间界面上是否出现了角标。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。非 pending-blocked。

### AT-ST-C18-012 提示期间可继续提牌出牌

- 所属功能点：FP-ST-C18-002 承包成立判定与落地提示（PRD 第 232 行）
- **需求规则**：提示期间，获权玩家可以继续提牌、出牌。
- **验证范围**：both（`verificationScope=both`）；`uiRequirement`：提示播放期间不阻塞获权玩家的提牌、出牌操作。
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：提示为纯表现，播放期间不禁用操作层，不弹模态、不锁输入；获权玩家的提牌（摸牌后出牌）与出牌请求照常可提交，提示与操作面板并存。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：承包成立事件的下发不进入阻塞式等待，不暂停出牌计时与操作受理；获权玩家的出牌请求照常校验与推进对局；未登记开关。证据定位：无。
- **双端协作**：承包成立提示开始播放 → 服务端继续受理获权玩家出牌 → 客户端不锁操作 → 玩家在提示播放中完成提牌/出牌，对局不停顿。
- **业务行为**：
  - trigger：「三摊落地」提示播放中
  - condition：玩家当前拥有出牌权
  - action：允许其继续提牌和出牌
  - result：玩家在提示播放时仍能正常操作出牌
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求：提示播放期间获权玩家仍可继续提牌、出牌，不被阻塞。该原子要求双端核对，但两端均无证据，无法还原提示播放时玩家的操作是否被锁住。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。非 pending-blocked。

### AT-ST-C18-013 自摸仅结算本人承包对

- 所属功能点：FP-ST-C18-003 自摸场景的承包结算（PRD 第 234 行）
- **需求规则**：自摸只结算胡牌方自己参与的承包对。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端不参与承包关系筛选，只展示服务端算出的四家得分与承包标注。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：自摸结算时，承包对集合按「该承包对包含胡牌方」过滤，与胡牌方无关的第三人之间的承包关系不进入本次赔付；未登记开关。证据定位：无（`server-evidence.json:1479-1486`）。
- **双端协作**：玩家自摸 → 服务端筛出与胡牌方相关的承包对 → 逐对计算赔付 → 汇总四家得分并下发 → 客户端展示。
- **业务行为**：
  - trigger：玩家自摸胡牌
  - condition：场上存在其他玩家之间的承包关系
  - action：只结算与胡牌方本人相关的承包对
  - result：（输入四元组该字段为空；需求口径为：与胡牌方无关的承包关系不产生赔付）
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求：自摸时只结算胡牌方自己参与的承包对，别人的承包关系不参与。服务端无证据，无法还原自摸结算是否只取与胡牌方相关的承包关系。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。非 pending-blocked。

### AT-ST-C18-014 摊方自摸由对方付三家合计

- 所属功能点：FP-ST-C18-003 自摸场景的承包结算（PRD 第 234 行）
- **需求规则**：摊方胡，即承包方自摸时，被承包方支付三家输分的合计。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端按服务端下发的四家本局净得分展示，其中被承包方为负数、另外两家为 0。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：承包方自摸时，先按常规口径算出三家各自应赔额，取其合计 S，改由被承包方一人支付 S，另外两家本局记 0；胡牌方实收 S；未登记开关。证据定位：无。
- **双端协作**：承包方自摸 → 服务端算三家应赔合计 S → 由被承包方承担 S、另两家置 0 → 客户端展示四家净得分。
- **业务行为**：
  - trigger：承包方自摸胡牌
  - condition：该承包对已成立
  - action：由被承包方支付三家输分合计
  - result：被承包方看到自己承担三家合计分，其余两家 0 分
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求：承包方自摸胡牌时，由被承包方支付三家输分的合计。服务端无证据，无法还原被承包方是否一人承担三家合计、其余两家是否 0 分。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。非 pending-blocked。

### AT-ST-C18-015 被摊方自摸由摊方付两倍

- 所属功能点：FP-ST-C18-003 自摸场景的承包结算（PRD 第 234 行）
- **需求规则**：被摊方胡，即原被承包方自摸时，摊方支付该合计的 2 倍。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端展示的承包方扣分为 2 倍合计，胡牌方实收 2 倍合计，另两家 0 分。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：原被承包方自摸（倒承包方向）时，以其本次自摸向三家应收的合计为 S，由承包方支付 2 × S，另两家本局 0；倍数固定为 2，不随摊数或番型再放大；未登记开关。证据定位：无。
- **双端协作**：被承包方自摸 → 服务端算合计 S → 生成承包方付 2 × S 的一笔赔付 → 另两家置 0 → 客户端展示。
- **业务行为**：
  - trigger：被承包方自摸胡牌
  - condition：该承包对已成立
  - action：由承包方支付三家输分合计的 2 倍
  - result：承包方看到自己被扣两倍合计分
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求：被承包方自摸胡牌（倒承包）时，由承包方支付三家合计的 2 倍。服务端无证据，无法还原 2 倍倍数是否生效、扣分方是否为承包方。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。非 pending-blocked。

### AT-ST-C18-016 双向满三摊只按两倍

- 所属功能点：FP-ST-C18-003 自摸场景的承包结算（PRD 第 234 行）
- **需求规则**：双向都满 3 摊时只按倒承包的 2 倍计算，不两笔叠加。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端只展示最终四家净得分，不重复呈现两笔承包；结算标注按最终生效方向呈现。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：同一对座位两个方向均满足成立条件时，赔付按倒承包口径单笔结算（2 × S），不生成「付 S」与「付 2 × S」两笔叠加；优先级为倒承包 2 倍覆盖正向承包 1 倍；未登记开关。证据定位：无。
- **双端协作**：同一对座位双向均满 3 摊 → 服务端只取倒承包一笔 2 × S → 下发单笔赔付结果 → 客户端展示单笔结果。
- **业务行为**：
  - trigger：双方自摸结算
  - condition：同一关系中两个方向都满 3 摊
  - action：只按倒承包的 2 倍计算一笔
  - result：赔付不出现两笔叠加
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求：同一关系两个方向都满 3 摊时，只按倒承包的 2 倍算一笔，不两笔叠加。服务端无证据，无法还原是否出现重复赔付叠加。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。非 pending-blocked。

### AT-ST-C18-017 承包形式赔付分配

- 所属功能点：FP-ST-C18-003 自摸场景的承包结算（PRD 第 238 行）
- **需求规则**：承包：A 对 B 已成立，A 自摸，B 支付三家原应赔分的合计 S，另外两家本局 0 分。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端按四家净得分展示：A 为 +S、B 为 −S、另两家为 0；承包标注在结算文案中随该关系呈现（标注口径见 ST-C21）。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：正向承包（摊方胡）时，先算三家常规应赔额之和 S，再把三家赔付归并为 B 一人承担，另两家置 0，A 记 +S；归属守恒（收付相抵为 0）；未登记开关。证据定位：无。
- **双端协作**：A 自摸且 A 对 B 承包成立 → 服务端按三家合计 S 生成 B → A 一笔赔付 → 另两家置 0 → 客户端展示。
- **业务行为**：
  - trigger：A 自摸胡牌
  - condition：A 对 B 的承包已成立
  - action：B 支付三家原应赔分合计 S
  - result：B 扣 S，另两家本局 0 分，A 得 S
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求：A 对 B 的承包成立、A 自摸时，B 支付三家原应赔分合计 S，另两家本局 0 分。服务端无证据，无法还原金额分配结果。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。非 pending-blocked。

### AT-ST-C18-018 反承包形式赔付两倍

- 所属功能点：FP-ST-C18-003 自摸场景的承包结算（PRD 第 239 行）
- **需求规则**：反承包：同一关系下 B 自摸，A 支付 2 × S，S 是 B 这次自摸原本向三家应收的合计。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端展示 A 为 −2 × S、B 为 +2 × S、另两家为 0，并在结算文案中标「反承包」（标注口径见 ST-C21）。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：反向（被承包方胡）时，以 B 本次自摸对三家应收合计为 S，令 A 支付 2 × S，B 实收 2 × S，另两家 0；基数 S 取本次自摸口径，不取历次摊数或其他局的分数；未登记开关。证据定位：无。
- **双端协作**：B 自摸 → 服务端算 B 应收合计 S → 生成 A 付 2 × S 的一笔 → 另两家置 0 → 客户端展示反承包标注。
- **业务行为**：
  - trigger：B 自摸胡牌
  - condition：同一承包关系中 A 对 B 已成立
  - action：A 支付 2 倍 B 原本向三家应收合计
  - result：A 扣 2×S，B 实收 2×S
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求：同一关系下 B 自摸时，A 支付 2 倍 B 原本向三家应收的合计。服务端无证据，无法还原反承包倍数与收付方向。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。非 pending-blocked。

### AT-ST-C18-019 链式承包赔付分配

- 所属功能点：FP-ST-C18-003 自摸场景的承包结算（PRD 第 240 行）
- **需求规则**：链式：A 对 B 成立，同时 C 对 A 成立，A 自摸，B 付 S，C 付 2 × S，A 实收 3 × S，第四家 0 分。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端展示 B 为 −S、C 为 −2 × S、A 为 +3 × S、第四家 0，并在结算文案中同时呈现「承包」与「反承包」两类标注（标注口径见 ST-C21）。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：链式关系需按角色分别取方向——C 对 A 成立使 C 处于对 A 的承包方（付 2 × S 的倒承包口径），A 对 B 成立使 B 处于被 A 承包（付 S 的正向口径）；同一次自摸下两笔分别生成后合并到 A 的收分，A 实收 3 × S；第四家不参与赔付记 0；未登记开关。证据定位：无。
- **双端协作**：A 自摸且同向/反向关系同时存在 → 服务端分别生成 B 付 S 与 C 付 2 × S 两笔 → 合并至 A 的净得分 → 客户端展示三笔结果与双标注。
- **业务行为**：
  - trigger：A 自摸胡牌
  - condition：A 对 B 承包成立且 C 对 A 承包成立
  - action：B 付 S、C 付 2×S
  - result：A 实收 3×S，第四家 0 分
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求：A 对 B 成立且 C 对 A 成立、A 自摸时，B 付 S、C 付 2 倍 S，A 实收 3 倍 S，第四家 0 分。服务端无证据，无法还原链式多笔承包是否被正确合并。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。非 pending-blocked。

### AT-ST-C18-020 点炮仅放铳者为承包对方时改写

- 所属功能点：FP-ST-C18-004 点炮与抢杠胡的承包改写（PRD 第 236 行）
- **需求规则**：点炮只在放铳者本人是承包对方时改写赔付。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端只展示服务端算出的最终得分与「点炮」赔付者标注，不参与改写条件判断。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：点炮结算时先判放铳者与胡牌方之间是否存在已成立的承包关系（放铳者即该关系的对方）；存在则改写这笔点炮赔付，不存在则按原点炮分结算；判定依据为放铳者身份，而非场上是否存在任意承包关系；未登记开关。证据定位：无（`server-evidence.json:1479-1486`）。
- **双端协作**：点炮胡成立 → 服务端判放铳者是否为胡牌方的承包对方 → 是则改写、否则按原点炮 → 下发得分 → 客户端展示。
- **业务行为**：
  - trigger：玩家点炮胡牌结算
  - condition：放铳者本人是该胡牌方承包关系中的对方
  - action：改写该笔点炮赔付
  - result：（输入四元组该字段为空；需求口径为：只有放铳者本身就是承包对方时才改写，其他情况仍按原点炮）
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求：点炮时只有放铳者本人是胡牌方的承包对方，才改写这笔点炮赔付。服务端无证据，无法还原改写条件是否按放铳者身份判断。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。非 pending-blocked。

### AT-ST-C18-021 点炮改写基数为原那一笔

- 所属功能点：FP-ST-C18-004 点炮与抢杠胡的承包改写（PRD 第 236 行）
- **需求规则**：点炮改写后的基数是原来那一笔点炮分，不是三家之和。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端不重算承包金额，直接展示服务端下发的单笔改写结果；提示文案不得暗示按三家合计放大。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：点炮场景的承包改写基数取本次点炮这一笔的原始分数 S_self，而非自摸口径的三家合计；改写不引入未参与赔付的两家；未登记开关。证据定位：无。
- **双端协作**：点炮改写生效 → 服务端以原点炮分作为基数计算承包赔付 → 下发最终得分 → 客户端展示。
- **业务行为**：
  - trigger：点炮承包赔付改写
  - condition：放铳者为承包对方
  - action：以原来那一笔点炮分为基数计算
  - result：结算金额按单笔点炮分计，不按三家合计
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求：点炮改写后的基数是原来那一笔点炮分，不是三家之和。服务端无证据，无法还原改写基数取的是单笔点炮分还是三家合计。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。非 pending-blocked。

### AT-ST-C18-022 他人承包关系不赔偿

- 所属功能点：FP-ST-C18-004 点炮与抢杠胡的承包改写（PRD 第 236 行）
- **需求规则**：别人的承包关系不赔，放铳者仍按原点炮付。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端不得把与放铳者无关的承包关系带入点炮局的结算标注；赔付者行只标「点炮」，不出现承包改写金额。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：点炮局中，与放铳者无关的承包关系（含他人之间的承包对）不参与本次赔付计算；放铳者按其原点炮分数支付，未参与赔付的两家仍沿用其常规点炮口径；未登记开关。证据定位：无。
- **双端协作**：点炮胡成立且场上存在与放铳者无关的承包 → 服务端忽略该承包 → 按原点炮分结算 → 客户端展示无承包改写的点炮结果。
- **业务行为**：
  - trigger：点炮胡牌结算
  - condition：场上承包关系与放铳者无关
  - action：不启用承包赔付
  - result：放铳者仍按原点炮分数支付
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求：与放铳者无关的承包关系不参与赔付，放铳者仍按原点炮分数支付。服务端无证据，无法还原无关承包是否被误计入。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。非 pending-blocked。

### AT-ST-C18-023 抢杠胡不替换杠赔付并叠加承包

- 所属功能点：FP-ST-C18-004 点炮与抢杠胡的承包改写（PRD 第 236 行）
- **需求规则**：抢杠胡不替换杠牌者的赔付，承包额再叠加。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端展示杠牌者的最终扣分需为两笔之和，不得只显示其中之一；结算文案保留杠相关赔付语义。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：抢杠胡场景下，杠牌者原有的杠赔付照常计入，承包赔付另起一笔叠加，不做替换或抵扣；两笔顺序不影响合计；未登记开关。证据定位：无。
- **双端协作**：发生抢杠胡 → 服务端保留杠牌者原杠赔付并另加承包额 → 合并为杠牌者总扣分 → 客户端展示两笔叠加结果。
- **业务行为**：
  - trigger：发生抢杠胡
  - condition：存在与杠牌者相关的承包关系
  - action：保留杠牌者原赔付，并叠加承包额
  - result：杠牌者同时承担原杠赔付与承包额
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求：抢杠胡不替换杠牌者的原赔付，承包额在原赔付之上再叠加。服务端无证据，无法还原是多笔相加还是被替换。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。非 pending-blocked。

### AT-ST-C18-024 杠牌者为承包方两笔都付

- 所属功能点：FP-ST-C18-004 点炮与抢杠胡的承包改写（PRD 第 236 行）
- **需求规则**：杠牌者若同时是承包方，两笔都付。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端在杠牌者行呈现合计扣分（原杠赔付 + 承包额），承包标注与杠赔付标注并存。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：抢杠胡时若杠牌者同时是该承包关系中的承包方，则原杠赔付与承包额两笔都从其分数扣除，不做互斥或择一；两笔均需在结算明细中可分辨；未登记开关。证据定位：无。
- **双端协作**：抢杠胡且杠牌者同时为承包方 → 服务端同时扣原杠赔付与承包额 → 下发合计 → 客户端展示两笔并存。
- **业务行为**：
  - trigger：抢杠胡结算
  - condition：杠牌者同时是承包方
  - action：同时扣除原杠赔付与承包额
  - result：杠牌者看到两笔分数都被扣除
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求：抢杠胡时杠牌者若同时是承包方，原杠赔付与承包额两笔都要付。服务端无证据，无法还原杠牌者是否被同时扣两笔。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。非 pending-blocked。

### AT-ST-C18-025 自摸承包算例

- 所属功能点：FP-ST-C18-005 承包结算算例校验（PRD 第 242 行）
- **需求规则**：庄家平胡自摸，三名闲家各应赔 8，S = 24，承包方付 24。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端只需正确呈现 24 这一最终数值，不参与合计计算。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：以三家各 8 分的常规自摸口径求和得 S = 24，由承包方一人支付 24；本算例锁定「三家合计代替三家分别支付」的金额口径；未登记开关。证据定位：无（`server-evidence.json:1479-1486`）。
- **双端协作**：庄家平胡自摸 → 服务端按 8 × 3 = 24 生成承包方一笔赔付 → 客户端展示 24。
- **业务行为**：
  - trigger：庄家平胡自摸
  - condition：三名闲家各应赔 8 分，承包已成立
  - action：按三家合计 S = 24 由承包方支付
  - result：承包方扣 24 分
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求：庄家平胡自摸、三名闲家各应赔 8（S=24）且承包成立时，承包方支付 24 分。服务端无证据，无法还原该具体金额的结算。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。非 pending-blocked。

### AT-ST-C18-026 叠加反承包算例

- 所属功能点：FP-ST-C18-005 承包结算算例校验（PRD 第 242 行）
- **需求规则**：同时存在上家对庄家的承包时，上家再付 48，庄家得 72。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端需正确呈现庄家 +72，且结算文案同时出现正向与反向两类承包标注（标注口径见 ST-C21）。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：在 AT-ST-C18-025 的 24 分基础上，上家作为对庄家的承包方（倒承包方向）再付 2 × 24 = 48，庄家合计收 24 + 48 = 72；两笔来自不同关系方向，故合并而不互斥（与 AT-ST-C18-016「同一关系双向」不叠加相区别）；未登记开关。证据定位：无。
- **双端协作**：庄家自摸且上家对庄家承包成立 → 服务端生成 24 与 48 两笔 → 合并为庄家 +72 → 客户端展示。
- **业务行为**：
  - trigger：庄家自摸，同时存在上家对庄家的承包
  - condition：上家对庄家承包成立
  - action：上家按 2×S 再付 48
  - result：庄家合计得 72 分
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求：同时存在上家对庄家的承包时，上家再付 48，庄家合计得 72。服务端无证据，无法还原多笔承包合计是否达到该数值。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。非 pending-blocked。

### AT-ST-C18-027 反承包算例

- 所属功能点：FP-ST-C18-005 承包结算算例校验（PRD 第 244 行）
- **需求规则**：庄家对闲家成立承包，闲家平胡自摸，三家原应赔 8、1、1，庄家按反承包付 20。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空、`clientEvidenceIds` 为空。实现要点（需求口径，非证据）：客户端需呈现庄家 −20、该闲家 +20、另两家 0，并标「反承包」。证据定位：无。
- **服务端职责**：`applicability` 为空、`serverEvidenceIds` 为空、`configCondition` 为空。规则口径为：被承包的闲家自摸，其向三家应收合计为 8 + 1 + 1 = 10，庄家作为承包方按 2 倍合计支付 20；注意基数取该闲家本次自摸口径（庄家赔 8、另两闲各赔 1），不是三家各 8 的对称口径；另两家 0；未登记开关。证据定位：无。
- **双端协作**：被承包闲家自摸 → 服务端沿 8、1、1 求合计 10 → 庄家付 2 × 10 = 20 → 客户端展示反承包结果。
- **业务行为**：
  - trigger：被承包的闲家平胡自摸
  - condition：庄家对该闲家承包成立，三家原应赔 8、1、1
  - action：庄家按 2 倍合计 10 支付
  - result：庄家扣 20 分
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求：庄家对闲家承包成立、该闲家平胡自摸（三家原应赔 8、1、1）时，庄家按 2 倍合计付 20 分。服务端无证据，无法还原该示例金额是否正确。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。非 pending-blocked。

## 证据索引

本阶段 27 个原子在统一原子视图中均未挂证据：`clientEvidenceIds` 与 `serverEvidenceIds` 全为空，`trace_index.json` 对本阶段 27 条记录 `evidenceCount` 均为 0，`difference-review.json` 中本阶段条目 `evidenceScopes` 为空。全部 CLE（12 条，`client-evidence.json:1240-1247`：`atomCount=29`、`evidenceCount=12`、`pending=387`）的 `atomIds` 均属 AT-ST-C01 系列；全部 SVE（60 条，`server-evidence.json:1479-1486`：`atomCount=29`、`pending=387`）的 `atomIds` 亦均属 AT-ST-C01 系列。因此本阶段无原子级证据可列。

下表仅列出与「三摊承包」规则实现相关、但**被归属到 AT-ST-C01 系列原子**的条目，供后续补证定位代码位置参考；均**不属于本阶段原子级证据**，不得作为 ST-C18 的符合性判定依据（引用需按 ST-C18 原子口径重新采集与归属）。

| 证据 id | layer | file:line | claimKey | 归属原子 | 与 ST-C18 的相关性（仅为线索） |
|---|---|---|---|---|---|
| SVE-AT-ST-C01-021-01 | common_game | common_game/com_game/common_game_com_action.cpp:141-148 | three-tan-triggers-contract-at-three | AT-ST-C01-021 | 吃牌后按 `GetTanCount(chow_seat_, from_seat) >= 3` 触发承包判定，与 AT-ST-C18-008 同域 |
| SVE-AT-ST-C01-021-02 | common_game | common_game/com_game/common_game_com_result.cpp:289-295 | contract-settle-guarded-by-three-tan-flag | AT-ST-C01-021 / 023 | `ApplyBaoContracts(...)` 受 `GetEnableThreeTanBao()` 总开关保护，涉及 AT-ST-C18-013~019 的结算入口 |
| SVE-AT-ST-C01-019-01 | common_game | common_game/com_game/common_game_com_pung.cpp:125-138 | pung-counts-one-tan-when-pung-as-tan | AT-ST-C01-019 / 020 | 碰在 `GetPungAsTan()` 为真时 `SetTanCount(pung_seat_, from_seat, ... + 1)`，直接关系 AT-ST-C18-001「碰是否计摊」 |
| SVE-AT-ST-C01-019-02 | common_game | common_game/com_game/common_game_algorithm.cpp:86-93 | xian-xian-tan-capped-at-two | AT-ST-C01-019 / 023 | `GetTanCount(...) >= 2` 的封顶判断，与 AT-ST-C18-004 / 005 同域 |
| SVE-AT-ST-C01-024-04 | common_game | common_game/com_game/common_game_algorithm.cpp:86-93 | three-tan-bao-limit-check | AT-ST-C01-024 / 026 / 028 | `IsXianXianTanFull` 中「庄家参与则 return false」，与 AT-ST-C18-003 庄闲限定同域 |
| SVE-AT-ST-C01-024-01 | common_game | common_game/com_game/common_game_com_action.cpp:62-66 | chow-judge-chi-peng-limit-call-site | AT-ST-C01-024 / 026 / 028 | 吃牌判定处并列调用 `IsChiPengExceeded` 与 `IsXianXianTanFull`，是 AT-ST-C18-005「不给吃」的过滤位置线索 |
| SVE-AT-ST-C01-022-01 | common_game | common_game/common_game_context.cpp:438-443 | server-pushes-three-tan-flag-to-client | AT-ST-C01-022 | 向客户端下发 `enable_three_tan_bao`，是 AT-ST-C18-009~012 客户端表现的前置开关线索 |
| SVE-AT-ST-C01-024-07 | common_game | common_game/com_game/common_game_server_config.h:41 | three-tan-bao-only-3-4-players | AT-ST-C01-024 / 026 / 028 | 配置注释「三摊承包（仅3/4人局，2人局服务端安全判断强制关闭）」，是 AT-ST-C18 全体规则的人数生效条件线索 |
| SVE-AT-ST-C01-019-04 | hzmj_server | hzmj_server/server_config.cpp:20-21 | box-default-three-tan-off-pung-as-tan-on | AT-ST-C01-019 / 020 / 021 / 022 / 023 | `SetEnableThreeTanBao(false); SetPungAsTan(true);` 为好友房默认值，是 AT-ST-C18 全体规则默认是否生效的线索 |
| SVE-AT-ST-C01-019-03 | hzmj_server | hzmj_server/game_logic.cpp:65-87 | three-tan-forced-off-for-two-players | AT-ST-C01-019~023 | 人数 ≤2 时强制关闭三摊并回写 `rule_chi_peng`，是 AT-ST-C18 人数条件下的生效边界线索 |
| SVE-AT-ST-C01-024-08 | hzmj_server | hzmj_server/game_logic.cpp:66-83 | three-tan-bao-player-count-guard | AT-ST-C01-024 / 026 / 028 | 同上，含 `SetRuleChiPeng(2)` 的联动写法 |
| SVE-AT-ST-C01-024-09 | hzmj_server | hzmj_server/server_config.cpp:19-39 | box-default-config-values | AT-ST-C01-024~029 | 创房默认配置集合（含 `enable_three_tan_bao` / `pung_as_tan` / `rule_chi_peng`） |
| SVE-AT-ST-C01-018-02 | hzmj_server | hzmj_server/game_logic.cpp:112-121 | chi-peng-mode-config-parse | AT-ST-C01-018 / 020 | 仅在 `!GetEnableThreeTanBao()` 时解析 `rule_chi_peng`，即三摊开启后吃碰档位不再改写，是 AT-ST-C18-004 / 005 的口径边界线索 |

补充说明：

- 复核说明称服务端全文检索「摊」「承包」命中 0；实际 `server-evidence.json:736` 存在含「三摊承包」字样的配置注释（`AutoProperty(bool, enable_three_tan_bao, EnableThreeTanBao);  // 三摊承包（仅3/4人局...）`），但其 `atomIds` 仅属 AT-ST-C01-024 / 026 / 028。该事实不改变本阶段零证据归属的结论，仅提示复核检索口径可能未覆盖注释文本。
- 本阶段不存在 `directConflict=true` 的原子，也无 `conflictEvidenceIds`；无 `analysisPath=blocked`、无 `conflict-fast`、无升级候选。
- 说明：上表条目若被引用于 ST-C18 判定，须先在 `server-evidence.json` 中按 AT-ST-C18 原子重新归属，否则仍应视为零证据。

## 待处理事项

### 待验证（规则待验证，补证 both）

`pending-list.md` 中本阶段共 27 条，问题类型均为「规则待验证」，说明为「证据不足」（AT-ST-C18-001 另附待审批复核建议 unverified），建议动作均为「补证 both」。

| atomId | 验证范围 | 说明 | 建议动作 |
|---|---|---|---|
| AT-ST-C18-001 | server | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C18-002 | server | 证据不足 | 补证 both |
| AT-ST-C18-003 | server | 证据不足 | 补证 both |
| AT-ST-C18-004 | server | 证据不足 | 补证 both |
| AT-ST-C18-005 | both | 证据不足 | 补证 both |
| AT-ST-C18-006 | server | 证据不足 | 补证 both |
| AT-ST-C18-007 | server | 证据不足 | 补证 both |
| AT-ST-C18-008 | server | 证据不足 | 补证 both |
| AT-ST-C18-009 | client | 证据不足 | 补证 both |
| AT-ST-C18-010 | client | 证据不足 | 补证 both |
| AT-ST-C18-011 | client | 证据不足 | 补证 both |
| AT-ST-C18-012 | both | 证据不足 | 补证 both |
| AT-ST-C18-013 | server | 证据不足 | 补证 both |
| AT-ST-C18-014 | server | 证据不足 | 补证 both |
| AT-ST-C18-015 | server | 证据不足 | 补证 both |
| AT-ST-C18-016 | server | 证据不足 | 补证 both |
| AT-ST-C18-017 | server | 证据不足 | 补证 both |
| AT-ST-C18-018 | server | 证据不足 | 补证 both |
| AT-ST-C18-019 | server | 证据不足 | 补证 both |
| AT-ST-C18-020 | server | 证据不足 | 补证 both |
| AT-ST-C18-021 | server | 证据不足 | 补证 both |
| AT-ST-C18-022 | server | 证据不足 | 补证 both |
| AT-ST-C18-023 | server | 证据不足 | 补证 both |
| AT-ST-C18-024 | server | 证据不足 | 补证 both |
| AT-ST-C18-025 | server | 证据不足 | 补证 both |
| AT-ST-C18-026 | server | 证据不足 | 补证 both |
| AT-ST-C18-027 | server | 证据不足 | 补证 both |

查证未完成（必要端缺口）：本阶段 0 条（`analysisPath` 全为 `full`，无 pending/timeout/failed 导致的阻塞；`blockedAtoms` 为空）。
需策划裁决（decision_required）：本阶段 0 条。

### 待审批建议（reviewStatus=pending，未生效）

| atomId | 建议差异 | 复核规则 | 状态 |
|---|---|---|---|
| AT-ST-C18-001 | unverified | evidence-is-not-consistency（本片 27 个原子双端证据均为零，客户端 `coverage.pendingAtomIds`、服务端 `stats.pending=387`，缺证只能维持 unverified，不得判 consistent，也不得凭缺证立 conflict） | pending / 未生效 |

说明：该复核条目的 `atomId` 为 AT-ST-C18-001，但 `reviewReason` 明确针对「本片（AT-ST-C18-001~027）」，结论为不新增条目、不升级；`reviewedDifference=unverified` 与当前生效的 `effectiveDifference=unverified` 相同，获批后不改变本阶段差异口径与 L7 结论。建议动作：审批（approve / reject / hold）。

### 补证方向（供后续取证参考，非结论）

- 摊计数来源（001-007）：需服务端吃牌 / 碰 / 直杠 / 加杠 / 暗杠五条动作路径上摊计数写入点的完整性证据，以及摊计数的存续结构是否为有向对（吃牌座位, 出牌座位）；需补齐「飘财次数不参与摊数」的反证（存在飘次数时摊数不变）；闲闲封顶 2 摊与庄闲可至 3 摊的分支需给出同一判定函数内的分支证据，并核对满 2 摊时吃选项过滤发生在服务端选项生成阶段（而非仅客户端隐藏）。
- 成立与落地提示（008-012）：需第 3 摊成立时点的判定位置与四端广播消息字段证据（成立方向、摊数），客户端需给出「三摊落地」动效播放的一次性特效证据、与吃牌字效并行不互斥的表现通道证据、以及成立瞬间无承包角标的对照（含结算阶段才出现角标的时序）；操作不阻塞需同时具备客户端不锁输入与服务端不暂停出牌受理两侧证据。
- 自摸结算（013-019）：需承包对集合按「包含胡牌方」过滤的实现证据；正向承包（付三家合计 S）、反向承包（付 2 × S）、链式（B 付 S 与 C 付 2 × S 合并为 3 × S）三类分配分支需分别定位；同一关系双向满 3 摊时「只取 2 倍、不叠加」的互斥判断需单独证据；建议以 AT-ST-C18-025~027 三个算例作为数值回归用例（24 / 48 与合计 72 / 20）。
- 点炮与抢杠胡改写（020-024）：需点炮分支中「仅放铳者本人是承包对方才改写」的身份判断证据，以及改写基数取单笔点炮分而非三家合计的证据；需无关承包不入账的证据；抢杠胡需给出杠赔付与承包额两笔并存（不替换）与杠牌者兼承包方时两笔并扣的证据。
- 跨阶段前置条件（影响本阶段全部规则是否生效）：`enable_three_tan_bao` 的默认值与人数强制关闭（≤2 人）会直接决定 ST-C18 是否触发，`pung_as_tan` 默认值会影响 AT-ST-C18-001「碰不计摊」的实际结果；补证时应把这两项配置的生效链路与创房下发一并取证，避免只核代码分支而漏掉配置闸门。
