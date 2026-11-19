# ST-C05 已停用选项与兄弟玩法

## 阶段概述

本阶段负责划定杭州麻将好友房创房中「已停用选项」与「兄弟玩法」的边界口径：跟庄与跟庄赔付两项在创房面板停用、二人好友房按独立变体口径处理（人数固定为 2 且面板不提供人数选项）、淳安 / 萧山 / 桐庐分支玩法另行成套规则且不与杭州麻将本体混用。

- 本阶段原子数：7（AT-ST-C05-001 ~ AT-ST-C05-007）
- L7 分布：
  - verified：0
  - verification_required：7
  - decision_required：0
  - not_applicable：0

说明：7 个原子在统一原子视图中客户端与服务端均无直接证据（client.verdict / server.applicability / client.evidenceIds / server.evidenceIds 均为空），analysisPath 均为 full（无 blocked、无 conflict-fast），差异统一判为 unverified，l7Basis 均为 proposed。其中 AT-ST-C05-001、AT-ST-C05-003、AT-ST-C05-007 在复核文件中各有一条 reviewStatus=pending 的待审批建议（reviewedDifference 均为 unverified，尚未生效）。7 个原子在 pending-list 中全部归入「规则待验证」，建议动作均为「补证 both」。

## 需求条目

### AT-ST-C05-001 跟庄选项停用

- **需求规则**：跟庄选项在创房面板已停用，不可选。即创房面板仍需呈现「跟庄」这一项，但以停用状态展示，玩家无法选中，建房时不能开启跟庄。
- **验证范围**：client
- **客户端职责**：
  - clientVerification.verdict：空（客户端无针对本原子的直接验证结论）
  - 实现要点：按需求，创房面板把「跟庄」选项渲染为停用态（置灰、不响应点选），提交房规时不带跟庄开启项。当前客户端证据集（12 条，全部挂在 AT-ST-C01-* 系列）中无任何指向创房面板「跟庄」选项的条目，既无法证明也无法否证置灰停用的实际呈现。
  - 证据定位：无直接证据（evidenceIds 为空）。仅可引同类创房面板证据说明面板侧渲染载体：CLE-AT-ST-C01-002-04，client_code，layer/BoxHzmjBackView.ts:82，claimKey=er-ren-room-label（该面板按 gameId 改写房间名文本，摘录未覆盖跟庄项）。
- **服务端职责**：
  - serverVerification.applicability：空（本原子验证范围为客户端界面表现，服务端无适用性结论）
  - 规则说明：按需求，本项仅约束创房面板的选项可选择性，不产生服务端跟庄规则联动；建房提交的房规中不含跟庄开启项，服务端无需为该玩法判定跟庄。
  - configCondition：空（本原子验证范围内无服务端配置生效条件证据）。需求侧口径：跟庄属创房面板已停用选项，不存在可选配置。
  - 证据定位：无直接证据（evidenceIds 为空）。服务端证据集（60 条）中检索不到跟庄相关条目。
- **双端协作**：玩家打开创房面板 → 客户端展示「跟庄」选项并置灰停用 → 玩家点击无响应 → 所提交房规中不含跟庄开启项 → 服务端按不含跟庄的房规开局。
- **业务行为**：
  - trigger：玩家打开杭州麻将好友房创房面板浏览玩法选项
  - condition：面板中存在「跟庄」选项；本项验证范围为客户端界面表现
  - action：按需求，创房面板把「跟庄」选项置为停用状态，不响应玩家的选择操作
  - result：玩家看到「跟庄」选项不可点选，无法在创房时开启跟庄
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子在统一原子视图中客户端与服务端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），仅有需求描述，无法核对「跟庄」是否真的以停用状态呈现，按证据不足归为未验证。
  - 待审批建议：unverified（evidence-is-not-consistency（客户端无证据时不得判 consistent，只能维持未验证）），未生效。
- **验证结论（L7）**：verification_required；l7Basis=proposed（复核条目 reviewStatus=pending，复核建议 unverified 尚未生效）。

### AT-ST-C05-002 跟庄赔付选项停用

- **需求规则**：跟庄赔付选项在创房面板已停用，不可选。即创房面板仍需呈现「跟庄赔付」这一项，但以停用状态展示，玩家无法选中，建房时不能开启跟庄赔付。
- **验证范围**：client
- **客户端职责**：
  - clientVerification.verdict：空（客户端无针对本原子的直接验证结论）
  - 实现要点：按需求，创房面板把「跟庄赔付」选项渲染为停用态，不响应点选，提交房规时不带跟庄赔付开启项。客户端证据集中无该选项的渲染或点击拦截证据，无法核对实际呈现。
  - 证据定位：无直接证据（evidenceIds 为空）。邻近参考：CLE-AT-ST-C01-002-04，client_code，layer/BoxHzmjBackView.ts:82，claimKey=er-ren-room-label（仅证明创房面板存在按 gameId 改写的文本控件，不涉及跟庄赔付项）。
- **服务端职责**：
  - serverVerification.applicability：空（本原子验证范围为客户端界面表现，服务端无适用性结论）
  - 规则说明：按需求，本项仅约束创房面板的选项可选择性，不产生服务端跟庄赔付规则联动；建房提交的房规中不含跟庄赔付开启项。
  - configCondition：空（本原子验证范围内无服务端配置生效条件证据）。需求侧口径：跟庄赔付在创房面板已停用，不存在可选配置。
  - 证据定位：无直接证据（evidenceIds 为空）。服务端证据集中检索不到跟庄赔付相关条目。
- **双端协作**：玩家打开创房面板 → 客户端展示「跟庄赔付」选项并置灰停用 → 玩家点击无响应 → 所提交房规中不含跟庄赔付开启项 → 服务端按不含该赔付规则的口径开局。
- **业务行为**：
  - trigger：玩家打开杭州麻将好友房创房面板浏览玩法选项
  - condition：面板中存在「跟庄赔付」选项；本项验证范围为客户端界面表现
  - action：按需求，创房面板把「跟庄赔付」选项置为停用状态，不响应玩家的选择操作
  - result：玩家看到「跟庄赔付」选项不可点选，无法在创房时开启跟庄赔付
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子在统一原子视图中客户端与服务端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），仅有需求描述，无法核对「跟庄赔付」是否真的以停用状态呈现，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定）。

### AT-ST-C05-003 二人房人数固定为 2

- **需求规则**：二人杭州麻将好友房人数固定为 2。即该玩法变体不提供其他人数口径，组局人数恒为 2 人。
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（客户端无针对本原子的直接验证结论）
  - 实现要点：按需求，客户端不决定组局人数，仅按该玩法变体进入牌桌；本原子验证范围为服务端组局人数，客户端面板表现不作判定依据。客户端现有证据可佐证「二人房是独立 gameId 入口」与「2 人桌的本地座次映射存在」，但不覆盖服务端是否强制固定 2 人。
  - 证据定位：无直接证据（evidenceIds 为空）。邻近参考：CLE-AT-ST-C01-002-02，client_code，config/GameDefine.ts:4-7，claimKey=er-ren-room-gameid（GameID_ER_REN_HYF=42322，二人杭麻好友房独立 ID）；CLE-AT-ST-C01-002-03，client_code，config/GameDefine.ts:271-279，claimKey=seat-count-map-2-3（SC_PLAYER_LOCAL_SEAT_MAP 提供 [2] 两人座次映射）。
- **服务端职责**：
  - serverVerification.applicability：空（服务端无针对本原子的直接适用性结论）
  - 规则说明：按需求，服务端对二人杭州麻将好友房按固定 2 人组局，不接受其他人数；玩家进房后牌桌为 2 个座位。
  - configCondition：空（本原子验证范围内无服务端配置生效条件证据）。需求侧口径：人数由玩法变体本身固定为 2，非创房可选配置。
  - 证据定位：无直接证据（evidenceIds 为空）。邻近参考：SVE-AT-ST-C01-002-02，common_game，common_game/com_game/common_game_logic.cpp:474-478，claimKey=player-count-from-chair-count（服务端以桌子的椅子数设置 player_count，属通用建桌路径，不能证明二人房玩法被强制固定为 2 人）；SVE-AT-ST-C01-024-09，hzmj_server，hzmj_server/server_config.cpp:19-39，claimKey=box-default-config-values（好友房默认值集合，未体现按人数固定组局的键）。
- **双端协作**：玩家选择二人杭州麻将玩法建房 → 服务端按二人房人数固定为 2 组局 → 对局以 2 个座位开始 → 客户端按 2 人桌布局呈现。
- **业务行为**：
  - trigger：玩家创建二人杭州麻将好友房并开局
  - condition：所选玩法为二人杭州麻将好友房；本项验证范围为服务端组局人数
  - action：按需求，二人杭州麻将好友房按固定 2 人组局，不接受其他人数
  - result：玩家进入二人房后看到牌桌仅 2 个座位，对局人数为 2 人
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子在统一原子视图中服务端无证据（applicability 为空、evidenceIds 为空、无矛盾证据），客户端亦无直接证据，无法核对二人房是否被服务端固定为 2 人组局，按证据不足归为未验证。服务端人数类证据（按 chair_count 推导人数）只能证明通用建桌逻辑，不能证明玩法级的人数强约束。
  - 待审批建议：unverified（no-server-evidence-is-not-conflict（服务端无证据不等于冲突，维持未验证）），未生效。
- **验证结论（L7）**：verification_required；l7Basis=proposed（复核条目 reviewStatus=pending，复核建议 unverified 尚未生效）。

### AT-ST-C05-004 二人房无人数选项

- **需求规则**：二人杭州麻将好友房创房面板无人数选项。即该玩法变体的创房面板不展示人数选择，人数固定按 2 人处理。
- **验证范围**：client
- **客户端职责**：
  - clientVerification.verdict：空（客户端无针对本原子的直接验证结论）
  - 实现要点：按需求，客户端在二人房创房面板不渲染人数单选组，玩家无人数可选，直接按 2 人建房。客户端证据集中只有二人房在创房面板改写房间名文本的证据，无人数组件的隐藏或缺失证据。
  - 证据定位：无直接证据（evidenceIds 为空）。邻近参考：CLE-AT-ST-C01-002-04，client_code，layer/BoxHzmjBackView.ts:82，claimKey=er-ren-room-label（面板按 gameId === GameID_ER_REN_HYF 显示「二人房」，摘录未涉及人数控件）；CLE-AT-ST-C01-002-02，client_code，config/GameDefine.ts:4-7，claimKey=er-ren-room-gameid（二人房独立 gameId 入口）。
- **服务端职责**：
  - serverVerification.applicability：空（本原子验证范围为客户端界面表现，服务端无适用性结论）
  - 规则说明：按需求，本项只约束客户端面板是否展示人数选项；服务端如何确定人数不作判定依据（人数固定口径见 AT-ST-C05-003）。
  - configCondition：空（本原子验证范围内无服务端配置生效条件证据）。
  - 证据定位：无直接证据（evidenceIds 为空）；本原子无邻近可引用的服务端证据。
- **双端协作**：玩家打开二人房创房面板 → 客户端不渲染人数单选组 → 玩家无人数可选 → 直接按 2 人建房 → 服务端按 2 人开局。
- **业务行为**：
  - trigger：玩家打开二人杭州麻将好友房创房面板
  - condition：玩法为二人杭州麻将好友房；本项验证范围为客户端界面表现
  - action：按需求，创房面板不展示人数选项，人数固定按 2 人处理
  - result：玩家在二人房创房面板上看不到人数选项，进房后人数为 2 人
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子在统一原子视图中客户端无证据（verdict 为空、evidenceIds 为空、无矛盾证据），无法核对二人房创房面板是否真的隐藏人数选项，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定）。

### AT-ST-C05-005 本文按四人房口径展开

- **需求规则**：本文按杭州麻将（四人好友房）口径展开，二人房为独立玩法变体。即本文后续规则条款以四人好友房为基准描述，二人房的成套规则另行定义，不并入本文。
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（客户端无针对本原子的直接验证结论）
  - 实现要点：按需求，四人房按其自身规则展示与操作，二人房不套用四人房的房规项与表现。客户端侧可佐证二人房是独立玩法入口（独立 gameId），但未见按人数区分房规项渲染的证据。
  - 证据定位：无直接证据（evidenceIds 为空）。邻近参考：CLE-AT-ST-C01-002-02，client_code，config/GameDefine.ts:4-7，claimKey=er-ren-room-gameid（二人杭麻好友房独立 gameId 42322，与本体入口分开）；CLE-AT-ST-C01-002-03，client_code，config/GameDefine.ts:271-279，claimKey=seat-count-map-2-3（2 人 / 3 人桌本地座次映射）。
- **服务端职责**：
  - serverVerification.applicability：空（服务端无针对本原子的直接适用性结论）
  - 规则说明：按需求，服务端对四人房与二人房分别按各自规则集结算与判定，二者不交叉套用；四人房规则不会出现在二人房中。
  - configCondition：空（本原子验证范围内无服务端配置生效条件证据）。需求侧口径：以人数口径（四人房为本体、二人房为独立变体）划分规则集，而非单一配置开关。
  - 证据定位：无直接证据（evidenceIds 为空）。邻近参考：SVE-AT-ST-C01-002-02，common_game，common_game/com_game/common_game_logic.cpp:474-478，claimKey=player-count-from-chair-count（人数取自椅子数，说明服务端人数来源为建桌参数，未体现按玩法准备两套规则集）；SVE-AT-ST-C01-019-03，hzmj_server，hzmj_server/game_logic.cpp:65-87，claimKey=three-tan-forced-off-for-two-players（存在按 player_count<=2 关闭三摊承包的规则改写，属单点规则按人数收敛，不等同整套规则集分离）。
- **双端协作**：玩家进入四人房或二人房 → 双端按对应人数口径加载规则 → 四人房按本体规则运行，二人房按独立变体规则运行 → 结算与界面表现各自符合本口径。
- **业务行为**：
  - trigger：玩家按本文规则进行杭州麻将好友房对局，或查阅该玩法规则
  - condition：玩法为杭州麻将好友房；四人房为本体口径，二人房为独立变体
  - action：按需求，客户端按对应人数口径展示与操作，二人房不套用四人房房规项；服务端对四人房与二人房分别按各自规则集结算与判定
  - result：玩家看到四人房与二人房各自按其规则的界面与结算，四人房规则不会出现在二人房中
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子在统一原子视图中客户端与服务端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），仅有口径划分的需求描述，无法核对双端是否按人数区分规则集，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定）。

### AT-ST-C05-006 分支玩法另行成套规则

- **需求规则**：淳安 / 萧山 / 桐庐分支玩法另行成套规则。即这三种分支玩法各自拥有独立成套的规则，不复用杭州麻将本体的规则定义。
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（客户端无针对本原子的直接验证结论）
  - 实现要点：按需求，客户端按所选分支玩法自身的界面与规则选项呈现，不使用杭州麻将本体的规则项。当前客户端证据全部指向杭州麻将本体的财神、庄闲倍数等，检索不到淳安 / 萧山 / 桐庐分支的实现条目。
  - 证据定位：无直接证据（evidenceIds 为空）。邻近参考（均为杭州麻将本体，用于说明证据覆盖范围）：CLE-AT-ST-C01-003-02，client_code，data/GameData.ts:50，claimKey=cai-shen-type-values（本体财神类型 0=白板财神 / 1=翻财神）；CLE-AT-ST-C01-003-03，client_code，controller/cmd/gameCmd/GameJokerCmd.ts:74-77，claimKey=cai-shen-type-room-rule（按 cai_shen_type 决定是否播翻财神）。
- **服务端职责**：
  - serverVerification.applicability：空（服务端无针对本原子的直接适用性结论）
  - 规则说明：按需求，服务端按该分支玩法自身的成套规则进行牌局判定与结算，分支规则集自成体系。
  - configCondition：空（本原子验证范围内无服务端配置生效条件证据）。需求侧口径：规则集随玩法（分支）绑定，不依赖创房配置项。
  - 证据定位：无直接证据（evidenceIds 为空）。邻近参考：SVE-AT-ST-C01-003-01，common_game，common_game/com_game/common_game_com_ju.cpp:226-248，claimKey=cai-shen-type-behavior（按 GetCaiShenType() 决定是否翻财神，属杭州麻将本体规则）；SVE-AT-ST-C01-019-03，hzmj_server，hzmj_server/game_logic.cpp:65-87，claimKey=three-tan-forced-off-for-two-players（本体三摊承包按人数收敛）。服务端 60 条证据中无分支玩法条目。
- **双端协作**：玩家选择分支玩法 → 双端加载该分支的规则集 → 牌局按分支规则推进与结算 → 客户端按分支口径呈现界面与提示。
- **业务行为**：
  - trigger：玩家选择淳安、萧山或桐庐分支玩法进行对局
  - condition：玩法为淳安 / 萧山 / 桐庐分支之一
  - action：按需求，客户端按该分支玩法自身的界面与规则选项呈现，不使用杭州麻将本体规则项；服务端按该分支自身的成套规则进行牌局判定与结算
  - result：玩家看到分支玩法按其独立成套规则运行，界面与结算符合该分支口径
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子在统一原子视图中客户端与服务端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），仅有分支玩法自成体系的描述，无法核对分支规则集是否真的独立成套，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定）。

### AT-ST-C05-007 分支玩法不与本体混用

- **需求规则**：淳安 / 萧山 / 桐庐分支玩法不与杭州麻将本体混用。即分支玩法对局中不出现杭州麻将本体的专属规则项与结算口径。
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（客户端无针对本原子的直接验证结论）
  - 实现要点：按需求，客户端在分支玩法中不展示杭州麻将本体的专属规则项与提示（如本体财神、承包等口径）。现有客户端证据只覆盖本体财神类型与庄闲倍数的消费，无法据此判断分支玩法是否出现本体规则串用。
  - 证据定位：无直接证据（evidenceIds 为空）。邻近参考（均为本体侧实现，用于说明证据未覆盖分支）：CLE-AT-ST-C01-003-02，client_code，data/GameData.ts:50，claimKey=cai-shen-type-values；CLE-AT-ST-C01-003-03，client_code，controller/cmd/gameCmd/GameJokerCmd.ts:74-77，claimKey=cai-shen-type-room-rule；CLE-AT-ST-C01-004-04，client_code，data/GameData.ts:1664-1666，claimKey=banker-level-multiplier（`1 << _bankerLevel` 的庄闲倍数）。
- **服务端职责**：
  - serverVerification.applicability：空（服务端无针对本原子的直接适用性结论）
  - 规则说明：按需求，服务端在分支玩法中不启用杭州麻将本体的判定与结算规则，结算与规则提示均为分支口径。
  - configCondition：空（本原子验证范围内无服务端配置生效条件证据）。需求侧口径：规则隔离按玩法（分支）边界生效，不依赖创房配置项。
  - 证据定位：无直接证据（evidenceIds 为空）。邻近参考：SVE-AT-ST-C01-003-01，common_game，common_game/com_game/common_game_com_ju.cpp:226-248，claimKey=cai-shen-type-behavior；SVE-AT-ST-C01-019-03，hzmj_server，hzmj_server/game_logic.cpp:65-87，claimKey=three-tan-forced-off-for-two-players（本体三摊承包开关按人数强制关闭，与分支玩法隔离无关）。服务端证据集检索不到淳安 / 萧山 / 桐庐分支实现。
- **双端协作**：玩家进入分支玩法 → 双端锁定分支规则集 → 牌局中不加载杭州麻将本体规则 → 结算按分支口径产出并在客户端按分支口径提示。
- **业务行为**：
  - trigger：玩家进行淳安、萧山或桐庐分支玩法的对局
  - condition：玩法为淳安 / 萧山 / 桐庐分支之一
  - action：按需求，客户端不展示杭州麻将本体专属规则项与提示；服务端在分支玩法中不启用本体判定与结算规则
  - result：玩家在分支玩法中看不到杭州麻将本体规则的生效效果，结算与规则提示均为分支口径
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子在统一原子视图中客户端与服务端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），仅有「分支不与本体混用」的描述，无法核对实际是否出现本体规则串用，按证据不足归为未验证；不因缺少分支侧证据而升级为 conflict。
  - 待审批建议：unverified（no-server-evidence-is-not-conflict（双端均无分支玩法证据，属取证空缺而非矛盾）），未生效。
- **验证结论（L7）**：verification_required；l7Basis=proposed（复核条目 reviewStatus=pending，复核建议 unverified 尚未生效）。

## 证据索引

本阶段 7 个原子的直接 evidenceIds 均为空：client-evidence.json（12 条）与 server-evidence.json（60 条）中无任何条目的 atomIds 指向 AT-ST-C05-*。下表为复核条目（difference-review.json）中作为邻近参考引用、或本阶段用于说明证据覆盖范围的证据，仅用于定位与说明「为何不能判一致/冲突」，不构成本阶段原子的直接验证依据。

| 证据 ID | layer | file:line | claimKey |
|---|---|---|---|
| CLE-AT-ST-C01-002-02 | client_code | config/GameDefine.ts:4-7 | er-ren-room-gameid |
| CLE-AT-ST-C01-002-03 | client_code | config/GameDefine.ts:271-279 | seat-count-map-2-3 |
| CLE-AT-ST-C01-002-04 | client_code | layer/BoxHzmjBackView.ts:82 | er-ren-room-label |
| CLE-AT-ST-C01-003-02 | client_code | data/GameData.ts:50 | cai-shen-type-values |
| CLE-AT-ST-C01-003-03 | client_code | controller/cmd/gameCmd/GameJokerCmd.ts:74-77 | cai-shen-type-room-rule |
| CLE-AT-ST-C01-004-04 | client_code | data/GameData.ts:1664-1666 | banker-level-multiplier |
| SVE-AT-ST-C01-002-02 | common_game | common_game/com_game/common_game_logic.cpp:474-478 | player-count-from-chair-count |
| SVE-AT-ST-C01-003-01 | common_game | common_game/com_game/common_game_com_ju.cpp:226-248 | cai-shen-type-behavior |
| SVE-AT-ST-C01-019-03 | hzmj_server | hzmj_server/game_logic.cpp:65-87 | three-tan-forced-off-for-two-players |
| SVE-AT-ST-C01-024-09 | hzmj_server | hzmj_server/server_config.cpp:19-39 | box-default-config-values |

## 待处理事项

本阶段 7 个原子均在 pending-list.md「规则待验证（412）」分组中，建议动作统一为「补证 both」。

| atomId | 验证范围 | 问题 | 说明 | 建议动作 |
|---|---|---|---|---|
| AT-ST-C05-001 | client | 规则待验证 | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C05-002 | client | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C05-003 | server | 规则待验证 | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C05-004 | client | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C05-005 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C05-006 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C05-007 | both | 规则待验证 | 证据不足（另有待审批复核建议：unverified） | 补证 both |

补充：

- 本阶段无 blocked（查证未完成）原子，无 decision_required（需策划裁决）原子，无升级原子（无 candidateDifference）。
- AT-ST-C05-001 / 003 / 007 各有 1 条 reviewStatus=pending 的待审批复核建议（reviewedDifference 均为 unverified），尚未生效，需审批后方可作为最终差异结论。
- 补证重点：
  - 客户端：创房面板「跟庄」「跟庄赔付」两项的停用态渲染与点击拦截（AT-ST-C05-001 / 002）；二人房创房面板人数控件的缺失（AT-ST-C05-004）；按玩法（本体 / 二人房 / 分支）区分房规项渲染的证据（AT-ST-C05-005 ~ 007）。
  - 服务端：二人房组局人数被固定为 2 的实现（AT-ST-C05-003）；四人房与二人房规则集分离、分支玩法独立规则集的判定与结算入口（AT-ST-C05-005 ~ 007）。
