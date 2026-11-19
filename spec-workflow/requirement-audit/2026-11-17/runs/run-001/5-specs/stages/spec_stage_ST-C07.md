# ST-C07 财神与牌组

## 阶段概述

本阶段负责好友房杭州麻将「财神与牌组」的技术实现规格：本玩法按默认牌组使用整副 136 张牌（万、条、筒各 36 张，东南西北风牌 16 张，中发白箭牌 12 张），白板财神模式下四张白板全部认定为财神，且财神可作为普通弃牌打出、打出后按普通白板留在牌河、他人不可吃碰杠、也不可对其点炮胡。章节来源：`开局 > 财神与牌组`，共 3 个功能点（FP-ST-C07-001 牌组构成、FP-ST-C07-002 财神认定、FP-ST-C07-003 财神打出规则）。

- 本阶段原子数：10（AT-ST-C07-001 ~ AT-ST-C07-010）
- 功能点归属：FP-ST-C07-001 牌组构成（001~004）、FP-ST-C07-002 财神认定（005）、FP-ST-C07-003 财神打出规则（006~010）
- L7 分布：
  - verified：0
  - verification_required：10
  - decision_required：0
  - not_applicable：0

说明：10 个原子在统一原子视图（feature_index.json）中 `clientVerification.verdict`、`clientVerification.evidenceIds` 均为空，`serverVerification.applicability`、`serverVerification.evidenceIds`、`serverVerification.configCondition` 均为空，`analysisPath` 全部为 `full`，`difference` 统一为 `unverified`，`l7` 均为 `verification_required`、`l7Basis` 均为 `proposed`，L7 分类中 `scope=unknown`、`scopeSource=default-unknown`。`l7-classify.json` 的 `blockedAtoms` 为空，故本阶段不存在 `analysisPath=blocked` 的「查证未完成」原子，也不存在 `conflict-fast` 冲突结论原子。

取证现状：`client-evidence.json` 的 `coverage.pendingAtomIds` 显式列出本阶段全部 10 个原子，`stats.pending=387`；`server-evidence.json` 的 60 条证据中无任何 `atomIds` 指向 AT-ST-C07 系列（`stats.pending=387`）。两端 `runtime/run-status.json` 的 `parts` 仅覆盖 ST-C01（`runStatus=completed`），ST-C07 的双端取证在本轮未执行，因此本阶段统一表现为「取证空缺」而非「实现冲突」。

复核建议：AT-ST-C07-001 / 005 / 009 / 010 各有一条 `reviewStatus=pending` 的复核条目（005 建议由 unverified 上调为 partial，其余三条维持 unverified），均**尚未生效**。

对应的 PRD 原文行号（`trace_index.json.sourceLines`）：牌组构成 4 个原子均指向第 119 行，财神认定（005）指向第 120 行，财神打出规则（006~010）均指向第 121 行。

| 原子 | 名称 | 验证范围 | difference | L7 | 复核 |
|---|---|---|---|---|---|
| AT-ST-C07-001 | 整副牌总数 136 张 | server | unverified | verification_required | pending（unverified） |
| AT-ST-C07-002 | 万条筒各 36 张 | server | unverified | verification_required | 无 |
| AT-ST-C07-003 | 东南西北共 16 张 | server | unverified | verification_required | 无 |
| AT-ST-C07-004 | 中发白共 12 张 | server | unverified | verification_required | 无 |
| AT-ST-C07-005 | 四张白板都是财神 | server | unverified | verification_required | pending（partial 候选） |
| AT-ST-C07-006 | 出牌阶段可打出财神 | both | unverified | verification_required | 无 |
| AT-ST-C07-007 | 打出财神不要求爆头 | server | unverified | verification_required | 无 |
| AT-ST-C07-008 | 打出后按普通白板留在牌河 | both | unverified | verification_required | 无 |
| AT-ST-C07-009 | 他人不可吃碰杠该财神 | both | unverified | verification_required | pending（unverified） |
| AT-ST-C07-010 | 财神弃牌不能点炮胡 | both | unverified | verification_required | pending（unverified） |

## 需求条目

### AT-ST-C07-001 整副牌总数 136 张

- 所属功能点：FP-ST-C07-001 牌组构成（PRD 第 119 行）
- **需求规则**：整副牌共 136 张。即本小局组牌时整副牌墙总量恰为 136 张，作为本局唯一牌源（功能点 scope：仅描述默认牌组、无风牌开关关闭口径，不含翻财神等可选档对牌组的调整）。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：
  - `clientVerification.verdict`：空（`evidenceIds` 为空、`pending=false`），客户端无针对本原子的直接验证结论。
  - 实现要点：按功能点 coordination，客户端只按服务端发牌结果展示手牌与牌河，不自行组牌、不计算牌墙总数，故牌组总量在客户端侧无独立校验点，客户端证据对「张数」类需求不构成有效支撑。
  - 证据定位：无本原子专属证据。邻近参考：CLE-AT-ST-C01-003-03，client_code，`controller/cmd/gameCmd/GameJokerCmd.ts:74-77`，symbol=`GameJokerCmd._needFanJokerAni`，claimKey=`cai-shen-type-room-rule`（只证明客户端按 `cai_shen_type` 决定是否播翻财神动效，与牌墙张数无关）；CLE-AT-ST-C01-003-02，client_code，`data/GameData.ts:50`，symbol=`GameData.jokerOpen`，claimKey=`cai-shen-type-values`（只定义「0=白板财神，1=翻财神」取值）。
- **服务端职责**：
  - `serverVerification.applicability`：空（`evidenceIds` 为空、`pending=false`），服务端无针对本原子的直接适用性结论。
  - 规则说明：按需求，服务端在本小局开局、尚未发牌之前按牌组配置凑齐一整副牌共 136 张，作为本局唯一牌源，全程不出现额外或缺失的牌。
  - configCondition：`configCondition` 为空，未登记任何配置生效条件；需求侧前提是「未启用任何改变牌组构成的可选项」，但该前提没有对应配置键被取证。
  - 证据定位：无本原子专属证据（server-evidence.json 中无 `atomIds` 含 AT-ST-C07 的条目）。邻近参考：SVE-AT-ST-C01-003-01，common_game，`common_game/com_game/common_game_com_ju.cpp:226-248`，symbol=`BoxJokerStep::Execute`，claimKey=`cai-shen-type-behavior`（只描述财神牌种设定，不涉及牌墙总数）；SVE-AT-ST-C01-003-03，hzmj_server，`hzmj_server/server_config.cpp:16`，symbol=`ServerConfig::InitConfigByBox`，claimKey=`cai-shen-type-default-white-board`（只证明默认 `cai_shen_type=0` 白板财神）。
- **双端协作**：玩家进入对局 → 服务端组好 136 张牌墙并洗牌 → 下发发牌结果 → 客户端展示手牌，玩家看到的一切牌张都来自这副 136 张。
- **业务行为**：
  - trigger：本小局开局、尚未发牌时组装本局牌墙
  - condition：未启用任何改变牌组构成的可选项，按默认牌组配置组牌
  - action：玩家无需操作，仅按收到的牌局数据展示手牌与牌河；服务端在开局前按牌组配置凑齐一整副牌，共 136 张，作为本局唯一的牌源
  - result：玩家本局能接触到的牌总数为 136 张，全程不会出现额外或缺失的牌
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：需求要求整副牌共 136 张。统一原子视图中该原子服务端 applicability 为空、无任何证据，客户端亦无证据（客户端证据对牌组张数类需求不构成有效支撑），既不能证明恰为 136 张，也不能证明与之冲突，故维持 unverified。`candidateDifference` 为空（无升级候选）。
  - 待审批建议：unverified（no-server-evidence-is-not-conflict：服务端无证据属取证空缺，不等于与需求冲突，维持未验证），**尚未生效**（reviewStatus=pending）。
- **验证结论（L7）**：`verification_required`；`l7Basis=proposed`，生效差异仍取 `effectiveDifference=unverified`；`scope=unknown`、`scopeSource=default-unknown`。

### AT-ST-C07-002 万条筒各 36 张

- 所属功能点：FP-ST-C07-001 牌组构成（PRD 第 119 行）
- **需求规则**：万、条、筒三门花色各 36 张。即万、条、筒三门数字牌各按 36 张纳入牌组，三门合计 108 张。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：
  - `clientVerification.verdict`：空（`evidenceIds` 为空、`pending=false`）。
  - 实现要点：按需求，客户端不参与花色张数配置，仅在收到发牌结果后按牌面渲染万、条、筒牌张，玩家手牌与牌河中的三门牌面照常显示；本原子在客户端无张数校验点。
  - 证据定位：无本原子专属证据（client-evidence.json 中无 `atomIds` 含 AT-ST-C07 的条目）；`coverage.pendingAtomIds` 已列出本原子，说明客户端取证未执行。本原子 `verificationScope=server`，客户端侧无邻近可引用的花色张数证据。
- **服务端职责**：
  - `serverVerification.applicability`：空（`evidenceIds` 为空、`pending=false`）。
  - 规则说明：按需求，服务端在组牌时为万、条、筒各准备 36 张牌，三门合计 108 张参与本局；某门花色不得多配或少配。
  - configCondition：`configCondition` 为空；未取证任何控制三门花色的配置键（如缺一色、无风牌等可选档均不在本功能点 scope 内）。
  - 证据定位：无本原子专属证据（server-evidence.json 无 `atomIds` 含 AT-ST-C07 的条目，`stats.pending=387`）。本原子无邻近可引用的服务端证据（唯一相关条目 SVE-AT-ST-C01-003-01 只覆盖财神牌种设定）。
- **双端协作**：玩家进入对局 → 服务端组出三门花色各 36 张 → 洗牌发牌 → 客户端按牌面展示，玩家打出的万条筒牌正常进入牌河。
- **业务行为**：
  - trigger：本小局开局组牌时
  - condition：默认牌组配置，万、条、筒三门花色均按常规纳入
  - action：玩家无特殊处理，手牌与牌河中的万条筒牌面照常显示；服务端为万、条、筒各准备 36 张牌，三门合计 108 张参与本局
  - result：玩家在整局中遇到的数字牌只来自万、条、筒三门，三门合计 108 张
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：需求要求万、条、筒各 36 张（合计 108 张）。该原子仅涉及牌组构成，统一原子视图中服务端无 applicability、无证据，客户端亦无证据，无法确认实际花色张数分布，判 unverified。`candidateDifference` 为空（无升级候选），无复核条目。
- **验证结论（L7）**：`verification_required`；`l7Basis=proposed`（无复核条目，按 proposed 基准判定；effectiveDifference=unverified）。

### AT-ST-C07-003 东南西北共 16 张

- 所属功能点：FP-ST-C07-001 牌组构成（PRD 第 119 行）
- **需求规则**：东、南、西、北四张风牌合计 16 张。即东南西北四种风牌各 4 张，合计 16 张纳入牌组。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：
  - `clientVerification.verdict`：空（`evidenceIds` 为空、`pending=false`）。
  - 实现要点：按需求，客户端不对风牌数量做控制，仅把手牌与牌河中的东南西北正常渲染为字牌，玩家可正常摸打风牌；无数量校验点。
  - 证据定位：无本原子专属证据（client-evidence.json 无 C07 条目；本原子在 `coverage.pendingAtomIds` 中）。
- **服务端职责**：
  - `serverVerification.applicability`：空（`evidenceIds` 为空、`pending=false`）。
  - 规则说明：按需求，服务端组牌时为东、南、西、北四种风牌各准备 4 张，共 16 张纳入牌组；本功能点按「风牌未关闭」口径描述，不覆盖可选档对风牌的裁剪。
  - configCondition：`configCondition` 为空；未取证与风牌开关相关的配置键，需求前提「风牌未关闭」缺少对应配置证据。
  - 证据定位：无本原子专属证据。本原子无邻近可引用的服务端证据（server-evidence.json 无 `atomIds` 含 AT-ST-C07 的条目）。
- **双端协作**：玩家进入对局 → 服务端组牌时纳入 16 张风牌 → 洗牌发牌 → 客户端展示，玩家可正常摸打风牌。
- **业务行为**：
  - trigger：本小局开局组牌时
  - condition：默认牌组配置，风牌未关闭
  - action：玩家无特殊处理，手牌与牌河中东南西北照常显示为字牌；服务端为东、南、西、北四种风牌各准备 4 张，共 16 张纳入牌组
  - result：牌局中会出现东南西北风牌，四张风牌各 4 张共 16 张
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：需求要求东南西北风牌合计 16 张。统一原子视图中服务端 applicability、证据均为空，客户端亦无证据，无法验证风牌是否按 16 张纳入牌组，判 unverified。`candidateDifference` 为空（无升级候选），无复核条目。
- **验证结论（L7）**：`verification_required`；`l7Basis=proposed`（无复核条目；effectiveDifference=unverified）。

### AT-ST-C07-004 中发白共 12 张

- 所属功能点：FP-ST-C07-001 牌组构成（PRD 第 119 行）
- **需求规则**：中、发、白三张箭牌合计 12 张。即中、发、白三种箭牌各 4 张，合计 12 张纳入牌组（白板同时承担白板财神身份，见 AT-ST-C07-005）。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：
  - `clientVerification.verdict`：空（`evidenceIds` 为空、`pending=false`）。
  - 实现要点：按需求，客户端不对箭牌数量做控制，仅把手牌与牌河中的中发白照常渲染，玩家可正常摸打；无数量校验点。
  - 证据定位：无本原子专属证据（client-evidence.json 无 C07 条目；本原子在 `coverage.pendingAtomIds` 中）。邻近参考 CLE-AT-ST-C01-003-02（`data/GameData.ts:50`，claimKey=`cai-shen-type-values`）只说明白板在财神类型取值中的含义，不涉及箭牌张数。
- **服务端职责**：
  - `serverVerification.applicability`：空（`evidenceIds` 为空、`pending=false`）。
  - 规则说明：按需求，服务端组牌时为中、发、白三种箭牌各准备 4 张，共 12 张纳入牌组；白板在牌组层面占 4 张箭牌位置。
  - configCondition：`configCondition` 为空；未取证任何控制箭牌构成的配置键。
  - 证据定位：无本原子专属证据（server-evidence.json 无 `atomIds` 含 AT-ST-C07 的条目）。SVE-AT-ST-C01-003-03（`hzmj_server/server_config.cpp:16`，claimKey=`cai-shen-type-default-white-board`）只证明默认财神类型为白板档，不能证明白板在牌组中恰为 4 张。
- **双端协作**：玩家进入对局 → 服务端组牌时纳入 12 张箭牌 → 洗牌发牌 → 客户端展示，玩家可正常摸打中发白。
- **业务行为**：
  - trigger：本小局开局组牌时
  - condition：默认牌组配置，箭牌（含白板）按常规纳入
  - action：玩家无特殊处理，手牌与牌河中中发白照常显示；服务端为中、发、白三种箭牌各准备 4 张，共 12 张纳入牌组
  - result：牌局中会出现中、发、白三种箭牌，各 4 张共 12 张
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：需求要求中发白合计 12 张。统一原子视图中服务端 applicability、证据均为空，客户端无证据，无法验证箭牌张数，判 unverified。`candidateDifference` 为空（无升级候选），无复核条目。
- **验证结论（L7）**：`verification_required`；`l7Basis=proposed`（无复核条目；effectiveDifference=unverified）。

### AT-ST-C07-005 四张白板都是财神

- 所属功能点：FP-ST-C07-002 财神认定（PRD 第 120 行）
- **需求规则**：四张白板都是财神。即白板财神模式下，牌组中的四张白板全部被认定为财神，参与胡牌判定与番型计算（功能点 scope：仅白板财神模式，翻财神模式的财神认定不在本功能点范围）。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：
  - `clientVerification.verdict`：空（`evidenceIds` 为空、`pending=false`）。
  - 实现要点：按功能点 coordination，财神身份由服务端在开局时确定并下发，客户端据此在手中与牌河上标记白板的财神身份（如高亮/标识）；客户端不自行判定哪几张白板是财神。
  - 证据定位：无本原子专属证据。邻近参考：CLE-AT-ST-C01-003-03（`controller/cmd/gameCmd/GameJokerCmd.ts:74-77`，claimKey=`cai-shen-type-room-rule`）只证明客户端按 `cai_shen_type` 区分两种财神模式的动效；CLE-AT-ST-C01-003-02（`data/GameData.ts:50`，claimKey=`cai-shen-type-values`）只定义财神类型取值，均不能证明客户端会为四张白板逐张打上财神标识。
- **服务端职责**：
  - `serverVerification.applicability`：空（`evidenceIds` 为空、`pending=false`），服务端侧尚无本原子的正式适用性结论。
  - 规则说明：按需求，服务端在开局确定本局财神时，把牌组中的四张白板全部标记为本局财神，并以「白板牌种」整体设定而非逐张挑选；该身份参与胡牌判定与番型计算。
  - configCondition：生效前提为「本局采用白板作财神的财神模式」，对应配置键 `cai_shen_type`（0=白板财神、1=翻财神）；好友房默认档为白板财神（见复核引用 SVE-AT-ST-C01-003-03）。统一原子视图中 `configCondition` 仍为空，上述前提来自复核条目与邻近证据，未写入原子字段。
  - 证据定位：无本原子专属证据（统一原子视图 `evidenceIds` 为空）。复核条目引入的间接证据（`evidenceScopes`，待审批）：SVE-AT-ST-C01-003-03，hzmj_server，`hzmj_server/server_config.cpp:16`，symbol=`ServerConfig::InitConfigByBox`，claimKey=`cai-shen-type-default-white-board`（好友房默认 `SetCaiShenType(0)`，即白板财神档）；SVE-AT-ST-C01-003-01，common_game，`common_game/com_game/common_game_com_ju.cpp:226-248`，symbol=`BoxJokerStep::Execute`，claimKey=`cai-shen-type-behavior`（`TMah cai_shen = MV_BAI_BAN; ... SetCaiShen(cai_shen);`，财神按白板牌种整体设定）。
- **双端协作**：开局 → 服务端确定财神并把四张白板标为财神 → 随牌局数据下发财神标识 → 客户端据此在手牌与牌河中显示白板的财神身份。
- **业务行为**：
  - trigger：本小局开局确定本局财神时
  - condition：本局采用白板作财神的财神模式
  - action：客户端在手中与牌河中把白板按财神身份提示给玩家（如高亮/标记）；服务端将牌组中的四张白板全部标记为本局财神，参与胡牌判定与番型计算
  - result：玩家看到白板即财神，四张白板全都是本局财神
- **实际实现差异**：
  - difference：unverified（原子字段当前生效值）
  - baselineDetail：需求要求四张白板都是财神。该原子涉及财神身份认定与番型计算，属双端需求；统一原子视图中两端均无证据（客户端无财神标识证据、服务端无财神判定证据），无法判定，判 unverified。`candidateDifference` 为空（无升级候选）。
  - 待审批建议：partial（evidence-is-not-consistency：服务端仅证明财神取白板牌种，四张构成与客户端表现未证，不足以判 consistent），**尚未生效**（reviewStatus=pending）。复核理由要点：服务端补到 `SetCaiShenType(0)` 默认白板档与 `SetCaiShen(MV_BAI_BAN)` 整体设定，规则语义已对上；但「四张」的数量前提依赖 AT-ST-C07-001 的 136 张牌组构成，该前提仍无证据，且客户端 `verdict` 为空无法交叉印证，故候选值停在 partial。
- **验证结论（L7）**：`verification_required`；`l7Basis=proposed`（存在 reviewStatus=pending 的复核建议 partial，尚未生效；effectiveDifference 仍为 unverified）。

### AT-ST-C07-006 出牌阶段可打出财神

- 所属功能点：FP-ST-C07-003 财神打出规则（PRD 第 121 行）
- **需求规则**：轮到自己出牌时可以把财神作为弃牌打出。即轮到本家出牌回合时，手中的财神可被选中并作为弃牌打出（功能点 scope：仅约束财神作为弃牌打出后的处理，不含财神在胡牌判定中替牌的能力）。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：
  - `clientVerification.verdict`：空（`evidenceIds` 为空、`pending=false`）。
  - 实现要点：按需求与 uiRequirement，本家出牌阶段手中财神可被选中并打出；打出后该牌从手牌移出、牌河新增一张白板。客户端不得因「该牌是财神」而禁用选中或拦截提交。
  - 证据定位：无本原子专属证据（client-evidence.json 无 `atomIds` 含 AT-ST-C07 的条目；本原子在 `coverage.pendingAtomIds` 中）。邻近参考 CLE-AT-ST-C01-003-03（`controller/cmd/gameCmd/GameJokerCmd.ts:74-77`）只涉及翻财神动效，不涉及出牌选择与提交。
- **服务端职责**：
  - `serverVerification.applicability`：空（`evidenceIds` 为空、`pending=false`）。
  - 规则说明：按需求，服务端在收到本回合出牌请求时，校验出牌方与牌张合法性后受理该财神作为弃牌，记入牌河并回执出牌结果；财神牌本身不因财神身份而被拒绝打出。
  - configCondition：`configCondition` 为空；未取证任何控制财神可否打出的配置键。邻近参考 SVE-AT-ST-C01-005-04（`mah_frame/base/base_config.cpp:42`，claimKey=`discard-allowed-default`，`discard_ = true;`）只证明通用出牌开关默认允许出牌，不区分该牌是否为财神。
  - 证据定位：无本原子专属证据（server-evidence.json 无 `atomIds` 含 AT-ST-C07 的条目）。SVE-AT-ST-C01-005-04 为通用出牌默认值，不构成本原子证据。
- **双端协作**：玩家点选财神 → 客户端提交出牌 → 服务端校验出牌方与牌张合法 → 将该牌置为牌河弃牌 → 回执出牌结果 → 客户端刷新手牌并把财神显示在牌河。
- **业务行为**：
  - trigger：轮到玩家自己出牌，玩家点选手中一张财神（白板）并打出
  - condition：当前为玩家的出牌回合，且手中持有财神
  - action：客户端在出牌阶段允许选中手中的财神，点击打出后将该牌从手牌移出；服务端接受该次打出，把这张财神作为本回合弃牌记录并移入牌河
  - result：玩家成功把一张财神丢进牌河，手牌少一张、牌河多一张白板
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：需求要求自己出牌时可以把财神当弃牌打出，牌河应出现该牌。统一原子视图中客户端与服务端均无证据（verdict 为空、evidenceIds 为空），无法验证财神是否可被选中打出并进入牌河，判 unverified。`candidateDifference` 为空（无升级候选），无复核条目。
- **验证结论（L7）**：`verification_required`；`l7Basis=proposed`（无复核条目；effectiveDifference=unverified）。

### AT-ST-C07-007 打出财神不要求爆头

- 所属功能点：FP-ST-C07-003 财神打出规则（PRD 第 121 行）
- **需求规则**：打出财神不要求玩家已经爆头。即财神可否打出不以玩家是否处于爆头状态为前置条件，未爆头玩家同样可以打出财神。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：
  - `clientVerification.verdict`：空（`evidenceIds` 为空、`pending=false`）。
  - 实现要点：按需求，客户端不对未爆头玩家的财神出牌做额外限制，照常允许选中并提交出牌；本原子判定属服务端出牌规则域，客户端不负判定责任。
  - 证据定位：无本原子专属证据（client-evidence.json 无 C07 条目）。邻近线索（不作为本原子证据）：client-evidence.json 中 AT-ST-C01-018 的 notes 提到协议 `MsgGameConfig` 含 `must_bao_tou_with_cai` 字段，但该 notes 未给出文件位置，无法定位到 file:line，不能据此判定客户端或服务端对该字段的消费逻辑。
- **服务端职责**：
  - `serverVerification.applicability`：空（`evidenceIds` 为空、`pending=false`）。
  - 规则说明：按需求，服务端在受理财神出牌时只校验轮次与牌张合法性，不得以「玩家未爆头」为由拒绝该次弃牌。
  - configCondition：`configCondition` 为空；未取证与「带财必爆头」相关的配置键（协议侧字段名 `must_bao_tou_with_cai` 未被取证到具体文件与行号），配置与出牌校验的绑定关系不明。
  - 证据定位：无本原子专属证据（server-evidence.json 无 `atomIds` 含 AT-ST-C07 的条目）。SVE-AT-ST-C01-005-04（`mah_frame/base/base_config.cpp:42`，claimKey=`discard-allowed-default`）与 SVE-AT-ST-C01-005-01（`common_game/com_game/common_game_com_action.cpp:353-358`，claimKey=`banker-discard-hu-requires-three-level`）均不涉及爆头前置条件，不构成本原子证据。
- **双端协作**：未爆头玩家点选财神 → 客户端提交出牌 → 服务端仅校验轮次与牌张合法性、不以爆头状态为前置条件 → 回执成功 → 客户端刷新牌河。
- **业务行为**：
  - trigger：未爆头的玩家在自己出牌回合尝试打出财神
  - condition：玩家当前不处于爆头状态
  - action：客户端不对未爆头玩家的财神出牌做额外限制，照常提交出牌；服务端不因玩家未爆头而拒绝该次财神打出，正常受理为弃牌
  - result：未爆头的玩家同样能成功打出财神，不会收到「不能打财神」之类的拒绝
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：需求要求打出财神不要求玩家已爆头。该判定属服务端出牌规则域（verificationScope=server），统一原子视图中服务端 applicability 为空、无证据，客户端亦无证据，无法验证是否存在爆头前置限制，判 unverified。`candidateDifference` 为空（无升级候选），无复核条目。
- **验证结论（L7）**：`verification_required`；`l7Basis=proposed`（无复核条目；effectiveDifference=unverified）。

### AT-ST-C07-008 打出后按普通白板留在牌河

- 所属功能点：FP-ST-C07-003 财神打出规则（PRD 第 121 行）
- **需求规则**：打出的财神按普通白板留在牌河。即财神一旦作为弃牌打出，其在牌河中的身份退化为普通白板，不再带财神身份参与后续吃碰杠胡判定，牌面也以普通白板呈现。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：
  - `clientVerification.verdict`：空（`evidenceIds` 为空、`pending=false`）。
  - 实现要点：按 uiRequirement，牌河中该财神以普通白板牌面呈现，不得保留财神高亮/标识；与手中财神的视觉区分（若实现上有区分）不能延伸到牌河。
  - 证据定位：无本原子专属证据（client-evidence.json 无 C07 条目；本原子在 `coverage.pendingAtomIds` 中）。CLE-AT-ST-C01-003-03 / -02 仅覆盖财神模式与翻牌动效，不涉及牌河牌面渲染。
- **服务端职责**：
  - `serverVerification.applicability`：空（`evidenceIds` 为空、`pending=false`）。
  - 规则说明：按需求，服务端以普通白板身份记录该牌河弃牌，其数据字段不带财神标记，因而不参与后续吃碰杠胡的财神判定逻辑。
  - configCondition：`configCondition` 为空；未取证财神弃牌身份退化是否受配置控制。
  - 证据定位：无本原子专属证据（server-evidence.json 无 `atomIds` 含 AT-ST-C07 的条目）。SVE-AT-ST-C01-003-01（`common_game/com_game/common_game_com_ju.cpp:226-248`）只描述开局财神设定，不涉及弃牌后的身份退化。
- **双端协作**：玩家打出财神 → 服务端把该牌作为普通白板记入牌河 → 下发牌河数据 → 客户端按白板牌面渲染该弃牌。
- **业务行为**：
  - trigger：玩家打出财神后，该牌被放入牌河
  - condition：财神已作为弃牌离开手牌
  - action：客户端把该弃牌按普通白板牌面画在牌河，不加财神标识；服务端以普通白板身份记录该牌河弃牌，不带财神身份参与后续吃碰杠胡判定
  - result：牌河里看到的是一张普通白板，和别的白板弃牌外观一致
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：需求要求打出的财神以普通白板留在牌河（含牌河牌面呈现）。统一原子视图中客户端与服务端均无证据，无法验证牌河是否按普通白板呈现、是否残留财神标识，判 unverified。`candidateDifference` 为空（无升级候选），无复核条目。
- **验证结论（L7）**：`verification_required`；`l7Basis=proposed`（无复核条目；effectiveDifference=unverified）。

### AT-ST-C07-009 他人不可吃碰杠该财神

- 所属功能点：FP-ST-C07-003 财神打出规则（PRD 第 121 行）
- **需求规则**：其他人不能吃、碰、杠被打出的财神。即财神弃牌不开放吃、碰、杠响应，其他玩家无法以该弃牌组成副露。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：
  - `clientVerification.verdict`：空（`evidenceIds` 为空、`pending=false`）。
  - 实现要点：按 uiRequirement，该财神打出后，其他玩家的吃、碰、杠操作入口不出现或不生效；客户端只按服务端下发的可选操作集渲染按钮，不得自行补出针对该弃牌的操作项。
  - 证据定位：无本原子专属证据（client-evidence.json 共 12 条证据中无任何吃碰杠入口或财神弃牌相关条目；本原子在 `coverage.pendingAtomIds` 中）。
- **服务端职责**：
  - `serverVerification.applicability`：空（`evidenceIds` 为空、`pending=false`）。
  - 规则说明：按需求，服务端对该财神弃牌不生成吃碰杠可选响应，不下发对应操作选项；校验时拒绝任何针对该弃牌的吃碰杠请求。
  - configCondition：`configCondition` 为空；未取证吃碰杠响应生成与财神身份判定之间的绑定关系。
  - 证据定位：无本原子专属证据。复核理由中列举的吃碰相关条目均只覆盖通用吃碰与出牌开关，不构成本原子证据：SVE-AT-ST-C01-021-01，common_game，`common_game/com_game/common_game_com_action.cpp:141-148`，symbol=`BoxChowStep::Execute`，claimKey=`three-tan-triggers-contract-at-three`（三摊承包触发，与财神弃牌无关）；SVE-AT-ST-C01-005-04，mah_frame，`mah_frame/base/base_config.cpp:42`，claimKey=`discard-allowed-default`（仅通用出牌默认允许）。
- **双端协作**：玩家打出财神 → 服务端判定该弃牌不开放吃碰杠 → 不下发对应操作选项 → 客户端不出现吃碰杠按钮 → 其他玩家直接轮空等待下家摸牌。
- **业务行为**：
  - trigger：玩家打出财神后，牌局进入其他玩家的响应环节
  - condition：刚打出的这张牌河弃牌是财神（白板）
  - action：客户端不向其他玩家弹出针对该财神的吃、碰、杠操作入口，或不接受此类点击；服务端对该弃牌不生成吃碰杠可选响应，校验时拒绝任何针对它的吃碰杠请求
  - result：其他玩家对这张财神没有任何吃、碰、杠可点，也无法靠它组副露
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：需求要求其他人不能吃、碰、杠被打出的财神。该原子属双端需求，统一原子视图中客户端无证据（无法确认吃碰杠入口是否被抑制）、服务端 applicability 为空且无证据（无法确认响应生成与校验），判 unverified；缺证不构成冲突。`candidateDifference` 为空（无升级候选）。
  - 待审批建议：unverified（no-server-evidence-is-not-conflict：服务端无财神弃牌响应证据，属取证空缺，不升级为 conflict），**尚未生效**（reviewStatus=pending）。
- **验证结论（L7）**：`verification_required`；`l7Basis=proposed`（存在 reviewStatus=pending 的复核建议，尚未生效；effectiveDifference 仍为 unverified）。

### AT-ST-C07-010 财神弃牌不能点炮胡

- 所属功能点：FP-ST-C07-003 财神打出规则（PRD 第 121 行）
- **需求规则**：其他人不能用手牌胡被打出的财神，即财神弃牌不能点炮胡。即财神弃牌不构成他人点炮胡的牌源，其他玩家无法以该弃牌作为所胡之牌。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：
  - `clientVerification.verdict`：空（`evidenceIds` 为空、`pending=false`）。
  - 实现要点：按 uiRequirement，该财神打出后，其他玩家的胡牌操作入口不出现或不生效；客户端只按服务端下发的可选操作集渲染，不得自行判定该弃牌可胡。
  - 证据定位：无本原子专属证据（client-evidence.json 12 条证据中无胡牌入口抑制相关条目；本原子在 `coverage.pendingAtomIds` 中）。
- **服务端职责**：
  - `serverVerification.applicability`：空（`evidenceIds` 为空、`pending=false`）。
  - 规则说明：按需求，服务端判定该财神弃牌不构成点炮胡的牌源，不生成针对它的胡牌响应，校验时拒绝以此牌点炮胡的请求。
  - configCondition：`configCondition` 为空；未取证胡牌牌源判定与财神身份之间的绑定关系。
  - 证据定位：无本原子专属证据。邻近参考 SVE-AT-ST-C01-005-01，common_game，`common_game/com_game/common_game_com_action.cpp:353-358`，symbol=`BoxHuStep::CanDiscardHu`，claimKey=`banker-discard-hu-requires-three-level`（只约束「庄闲放铳需三牢」，不涉及财神弃牌能否作为胡牌牌源）。
- **双端协作**：玩家打出财神 → 服务端判定该弃牌不可被他人点炮胡 → 不下发胡牌选项 → 客户端无胡牌按钮 → 其他玩家只能等摸牌，牌局继续。
- **业务行为**：
  - trigger：玩家打出财神后，牌局进入其他玩家的响应环节
  - condition：刚打出的这张牌河弃牌是财神（白板）
  - action：客户端不向其他玩家显示以该财神点炮胡的胡牌入口，或不接受此类点击；服务端判定该弃牌不构成点炮胡的牌源，不生成针对它的胡牌响应，校验时拒绝以此牌点炮胡
  - result：其他玩家无法用手牌对这张财神点炮胡，该弃牌只当作普通白板留在牌河
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：需求要求其他人不能用手牌胡被打出的财神（财神弃牌不能点炮胡）。该原子属双端需求，统一原子视图中客户端无证据（胡牌入口是否抑制不可见）、服务端适用性与证据均为空（胡牌牌源判定不可见），既不能证明可点炮胡（conflict），也不能证明被禁止（consistent），判 unverified。`candidateDifference` 为空（无升级候选）。
  - 待审批建议：unverified（no-server-evidence-is-not-conflict：胡牌牌源判定无证据，不能据此判冲突，维持未验证），**尚未生效**（reviewStatus=pending）。
- **验证结论（L7）**：`verification_required`；`l7Basis=proposed`（存在 reviewStatus=pending 的复核建议，尚未生效；effectiveDifference 仍为 unverified）。

## 证据索引

本阶段 10 个原子在统一原子视图中的直接 `evidenceIds` 均为空，`client-evidence.json` 与 `server-evidence.json` 中均无 `atomIds` 指向 AT-ST-C07 的条目（两端 `stats.pending=387`，本阶段原子全部落在 pending 侧）。下表收录各原子在「邻近参考」与「待审批复核建议」中引用的证据，仅供定位参考，**不构成本阶段原子的直接验证依据**。

| 证据 ID | 端 | layer | file:line | claimKey |
|---|---|---|---|---|
| CLE-AT-ST-C01-003-02 | client | client_code | data/GameData.ts:50 | cai-shen-type-values |
| CLE-AT-ST-C01-003-03 | client | client_code | controller/cmd/gameCmd/GameJokerCmd.ts:74-77 | cai-shen-type-room-rule |
| SVE-AT-ST-C01-003-01 | server | common_game | common_game/com_game/common_game_com_ju.cpp:226-248 | cai-shen-type-behavior |
| SVE-AT-ST-C01-003-02 | server | hzmj_server | hzmj_server/game_logic.cpp:51-55 | cai-shen-type-json-key |
| SVE-AT-ST-C01-003-03 | server | hzmj_server | hzmj_server/server_config.cpp:16 | cai-shen-type-default-white-board |
| SVE-AT-ST-C01-005-01 | server | common_game | common_game/com_game/common_game_com_action.cpp:353-358 | banker-discard-hu-requires-three-level |
| SVE-AT-ST-C01-005-04 | server | mah_frame | mah_frame/base/base_config.cpp:42 | discard-allowed-default |
| SVE-AT-ST-C01-021-01 | server | common_game | common_game/com_game/common_game_com_action.cpp:141-148 | three-tan-triggers-contract-at-three |

说明：上述证据的 `atomIds` 均指向 AT-ST-C01 系列（ST-C01 取证已执行，`runStatus=completed`），其描述内容分别只覆盖财神类型取值/动效、财神牌种整体设定、默认白板财神档、通用出牌默认允许、庄闲放铳需三牢、三摊承包触发等邻近语义，均未覆盖本阶段的牌组张数、四张白板计数、财神弃牌的响应抑制与胡牌牌源判定。

## 待处理事项

本阶段 10 个原子在 `pending-list.md` 中全部归入「规则待验证」分组，建议动作统一为「补证 both」。`pending-list.md` 的「查证未完成（必要端缺口）」与「需策划裁决」两节均为 0 条，故本阶段无 blocked（`analysisPath=blocked`）原子、无 `decision_required` 原子。

| atomId | 验证范围 | 问题 | 说明 | 建议动作 |
|---|---|---|---|---|
| AT-ST-C07-001 | server | 规则待验证 | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C07-002 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C07-003 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C07-004 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C07-005 | server | 规则待验证 | 证据不足（另有待审批复核建议：partial） | 补证 both |
| AT-ST-C07-006 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C07-007 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C07-008 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C07-009 | both | 规则待验证 | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C07-010 | both | 规则待验证 | 证据不足（另有待审批复核建议：unverified） | 补证 both |

补充说明：

- 查证状态：本阶段 0 个 `analysisPath=blocked` 原子，无 pending / timeout / failed 造成的阻断；差异无法判定的原因是双端取证空缺（`coverage.pendingAtomIds` 覆盖全部 10 个原子，两端 `runtime/run-status.json` 的 parts 仅覆盖 ST-C01）。
- 复核建议（`reviewStatus=pending`，均未生效）：
  - AT-ST-C07-001：历史 `unverified` → 复核建议 `unverified`（no-server-evidence-is-not-conflict：服务端无证据属取证空缺，不等于与需求冲突，维持未验证）。
  - AT-ST-C07-005：历史 `unverified` → 复核建议 `partial`（evidence-is-not-consistency：服务端仅证明财神取白板牌种，四张构成与客户端表现未证，不足以判 consistent）。
  - AT-ST-C07-009：历史 `unverified` → 复核建议 `unverified`（no-server-evidence-is-not-conflict：服务端无财神弃牌响应证据，属取证空缺，不升级为 conflict）。
  - AT-ST-C07-010：历史 `unverified` → 复核建议 `unverified`（no-server-evidence-is-not-conflict：胡牌牌源判定无证据，不能据此判冲突，维持未验证）。
  - 以上候选值**尚未生效**；本阶段文档中的 `difference` 与 L7 均按当前生效值（全部 `unverified` / `verification_required`）书写，待审批动作（approve / reject / hold）完成后需重算 AT-ST-C07-005 的差异与 L7。
- 升级候选：10 个原子的 `candidateDifference` 与 `candidateDetail` 均为空，`l7-classify.json` 的 `baseline.differenceStats` 中本阶段无升级（upgraded）记录，故不存在「历史基线 + 本轮候选 + 候选待审批」形态的升级原子。
- 补证重点（仅作取证参考，不是结论）：
  - 牌组构成（001~004）：牌墙总数、三门花色各 36 张、风牌 16 张、箭牌 12 张的组牌实现与配置来源（含风牌/缺一色等可选档对牌组的裁剪边界）；客户端无有效支撑点。
  - 财神认定（005）：需补齐「四张」的数量前提证据（与 001 的 136 张牌组构成耦合），以及客户端对四张白板财神标识的下发消费与渲染证据。
  - 财神打出（006~010）：财神作为弃牌的合法性校验、未爆头不设前置限制、牌河身份退化为普通白板、吃碰杠响应不生成与校验拒绝、胡牌牌源排除的完整链路证据；客户端需补出牌阶段财神可选中、牌河按普通白板渲染、他人吃碰杠与胡牌入口被抑制的实现证据。
