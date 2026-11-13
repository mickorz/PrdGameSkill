# 出牌与响应

> 阶段 ID：`ST-C11`。来源：模板「行牌 > 出牌与响应」章节。客户端视角规格，客户端逻辑与 UI 交互以 Code/Fgui 代码证据支撑。

## 0. 阶段

- **阶段 ID**：`ST-C11`
- **阶段**：出牌与响应
- **来源章节**：行牌 > 出牌与响应
- **涉及协议消息**：MsgPower、MsgTake、MsgPlayC、MsgPlayLmts、MsgChowC、MsgChowS、MsgPungC、MsgPungS、MsgKongC、MsgKongS、MsgHuEx、MsgResultHu、MsgCancel
- **涉及 UI 模块**：BoxHzmjMainView、BoxHzmjMah2DView
- **阶段概述**：规定出牌权归属与出牌前置拦截、弃牌被吃碰杠胡的裁决回收、操作按钮与响应倒计时、过与放弃语义、手牌压暗规则、多组吃/杠选择面板、听牌爆头飘标记、碰杠区牌组与杠标记展示，以及动作字效与胡牌结束表现。

## 术语与单位（有则填）

| 术语 | 定义 | 单位/量纲 | 作用域 | 来源 |
| --- | --- | --- | --- | --- |
| 财神 | 白板固定为财神。只在胡牌判定时代替顺子、刻子或对子所缺的牌；吃、碰、杠必须用真实的非财神牌。 | — | — | 模板名词章节 第12行 |
| 面子 | 一组顺子、刻子或杠。杠含 4 张，仍计 1 组面子。对子不是面子。已完成的吃、碰、明杠、暗杠都计入面子。 | — | — | 模板名词章节 第11行 |
| 爆头 | 摸牌前为 4 组面子加 1 张财神。下一张摸到任意牌，都与这张财神组成对子后自摸。只能自摸。 | — | — | 模板名词章节 第16行 |
| 飘 | 自己出牌阶段打出一张财神，即飘财 1 次。连续打出财神则累加，打出普通牌清零。每小局从 0 次起算。 | 次 | — | 模板名词章节 第18行 |
| 放铳 | 打出的牌被他人合法胡走。胡牌者称为点炮胡。白板财神弃牌不能点炮胡。 | — | — | 模板名词章节 第19行 |

## 跨切面行为（无原子也列）

- **权限位统一驱动界面**：服务端 MsgPower 的 POWER_ID_* 位掩码（PLAY/CHOW/PONG/KONG/HU/CANCEL_C/CANCEL_S）同时决定按钮显隐、手牌压暗和能否出牌，客户端无本地优先级判定 —— 跨切面（source-code/client/Code/layer/BoxHzmjMainView.ts:549）。
- **行牌命令的 justUpdateData 补数据分支**：所有行牌命令都带 justUpdateData 分支，断线重连补数据时只写数据缓存，不播动画、不弹提示 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GamePlayCmd.ts:33）。
- **服务端驱动的响应倒计时**：倒计时统一由服务端下发的剩余秒数驱动，客户端用 CountdownTime 本地递减，归零只把数字置为「00」，不禁用任何按钮 —— 跨切面（source-code/client/Code/layer/BoxHzmjMah2DView.ts:674）。
- **两套灰度来源互相覆盖**：权限压暗（吃碰杠候选亮牌）与禁手/禁打灰（MsgPlayLmts）分别刷新，点过之后先清权限灰再按禁手重压 —— 跨切面（source-code/client/Code/layer/BoxHzmjMainView.ts:1262）。
- **字效按座位单节点复用**：字效按座位单节点复用，新动作直接改写同一节点的 skin 与 url，因此连续杠时新字效天然覆盖上一段 —— 跨切面（source-code/client/Code/layer/BoxHzmjTipAniView.ts:524）。

（以下按 JSON 中 features 顺序，每个功能点一节）

## `FP-ST-C11-001` 出牌权与出牌前置条件

- **主描述**：出牌权由当前拥有 PLAY 权限的玩家持有；在等待响应、选组合、杠后未补牌或本小局结束时不允许出牌。
- **范围与边界**：覆盖出牌入口 canPlayMahCheck/onPlayMah 与 power 驱动的 canPutCard 开关，不含禁手规则本身（见 ST-C10）。
- **总体协作**：GamePowerCmd 写入权限 → BoxHzmjMainView.setPower 设置 canPutCard 与按钮 → 手牌触摸回调 onPlayMah → GameController.sendPlay 发 MsgPlayC。

### 原子项

#### `AT-ST-C11-001` 仅出牌权持有者可出牌

- **规则说明**：只有当前拿到出牌权、且目标牌可打的玩家能出牌。出牌权由服务端通过 MsgPower 的 POWER_ID_PLAY 权限位授予（摸牌命令亦直接写入该权限位），客户端按权限位打开本家手牌的出牌开关，无权限时手牌不可提起出牌；目标牌可打的禁手判断不在本原子项范围（见 ST-C10）。
- **触发条件**：服务端下发 MsgTake/MsgPower 后客户端按 power 的 PLAY 位设置本家 canPutCard；玩家提牌、横滑或点击出牌时经 onPlayMah/canPlayMahCheck 检查出牌资格。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：出牌权者手牌 canTouch/canPutCard 打开，可提牌、横滑、点击出牌；无出牌权时不能操作。
- **限制与禁止**：power 不含 PLAY 位的玩家不能出牌；客户端无本地优先级判定，不越权放开出牌开关。
- **异常与边界**：摸牌命令给其他座位写入 POWER_ID_PLAY 权限时，本家 canPlay 因 PLAY 位不置位而保持关闭，不影响本家手牌状态。
- **验收**：收到含 POWER_ID_PLAY 的权限后本家手牌可提起并出牌，上行 MsgPlayC；未含 PLAY 位的权限下提牌无效，不上行 MsgPlayC。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:70；source-code/client/Code/layer/BoxHzmjMainView.ts:536；source-code/client/Code/layer/BoxHzmjMainView.ts:556
- **服务端职责**：下发 MsgPower（PLAY 权限位授予）；下发 MsgTake（摸牌时对座位写入 PLAY 权限）；接收 MsgPlayC 出牌命令。
- **客户端职责**：摸牌命令给其他座位直接写入 POWER_ID_PLAY 权限；MainView 按 power 中的 PLAY 位置置 canPutCard，手牌触摸才可提起出牌。
- **协作边界**：客户端消费 MsgPower/MsgTake 的权限位做本地按钮与 canPutCard 开关；出牌资格完全依赖服务端下发的权限位，本地不做资格重算；出牌动作上行 MsgPlayC 交服务端裁决。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:70
- **原文摘录**：`GameData.setCurPower(localSeat, BoxMahDefine.PowerType.POWER_ID_PLAY, null);`

#### `AT-ST-C11-002` 非出牌时机禁止出牌

- **规则说明**：等待他人响应、正在选择组合、杠后尚未补牌或本小局已经结束时，不能出牌。客户端以按钮状态与权限开关拦截：存在吃碰杠胡响应按钮（C_BtnState 为 PENG_GANG_HU）时拦下出牌并弹提示；托管/权限为 NONE 时 canPutCard 直接置 false；「杠后尚未补牌」「小局已结束」两个场景客户端无显式守卫，依赖服务端不下发 PLAY 权限兜住。
- **触发条件**：本端存在待响应的吃碰杠胡按钮（C_BtnState 为 PENG_GANG_HU）且非杠直出场景时玩家尝试双击/滑动出牌；或托管/权限为 NONE 状态下 setPower 更新。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：出牌被拦截时弹 MessageSimpleBoxListView 文本提示；托管时收起操作区。
- **限制与禁止**：存在响应按钮且非杠直出场景（_isGangOffMoCard 为假）时，禁止双击/滑动出牌，出牌请求被本地拦下。
- **异常与边界**：「杠后尚未补牌」「小局已结束」两个场景客户端无独立判断，靠服务端不下发 PLAY 权限兜住；杠后未补牌期间（_isGangOffMoCard 为假的杠场景）出牌尝试同样被拦。
- **验收**：存在吃碰杠胡按钮时提牌/滑动出牌被拦截并弹提示，不上行 MsgPlayC；托管或权限为 NONE 时 canPutCard 为 false。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1453；source-code/client/Code/layer/BoxHzmjMainView.ts:1643
- **服务端职责**：下发 MsgPower（PLAY 位不置位即禁止出牌）；下发 MsgKongS（杠后补牌节奏）；下发 MsgPlayLmts（禁手约束影响本地灰度）。
- **客户端职责**：canPlayMahCheck 在有吃碰杠胡按钮（C_BtnState 为 PENG_GANG_HU）时拦下出牌并弹提示；托管/权限为 NONE 时 canPutCard 直接置 false。杠后未补牌、小局结束没有独立的客户端守卫，依赖服务端不下发 PLAY 权限。
- **协作边界**：客户端消费 MsgPower 的权限位与按钮态做本地出牌拦截；「杠后未补牌」「小局已结束」不由客户端显式判断，由服务端不下发 PLAY 权限表达；MsgKongS/MsgPlayLmts 仅驱动本地表现与灰度。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1453
- **原文摘录**：`if (showAction && btnState.selectedIndex == BtnState.PENG_GANG_HU && !this._isGangOffMoCard) {`

## `FP-ST-C11-002` 弃牌裁决与牌河回收

- **主描述**：弃牌可被吃碰直杠或点炮胡时由服务端先裁决；成立后各端把该牌从牌河取走并清掉浮标与放大显示，全部放弃则牌留在牌河继续下家摸牌。
- **范围与边界**：客户端只做结果呈现（移除河牌、清浮标、清放大），裁决优先级在服务端。
- **总体协作**：MsgChowS/MsgPungS/MsgKongS/MsgHuEx 到达 → PlayerCardsData.setCombo → BoxHzmjMah2DView.setCombo/setHu 移除河牌并刷新碰杠区。

### 原子项

#### `AT-ST-C11-003` 弃牌先裁决再结算

- **规则说明**：弃牌可被吃、碰、直杠或点炮胡时，先裁决。裁决优先级在服务端，客户端无本地裁决逻辑：收到吃/碰/杠/胡的下行命令后才切表状态并播动作，等待期间各端保持对方弃牌状态不变。
- **触发条件**：任一玩家打出弃牌后、服务端下发 MsgChowS/MsgPungS/MsgKongS/MsgHuEx 前，为裁决等待期；成立命令到达时触发本地结算表现。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：裁决期间各端仅看到弃牌与响应按钮，动作成立后才播字效与牌组变化。
- **限制与禁止**：客户端不做本地优先级裁决，不提前移除河牌或提前播动作。
- **异常与边界**：断线重连补数据时按 justUpdateData 分支只写数据缓存，不播动画（跨切面）；裁决等待期间各端画面保持上一状态。
- **验收**：收到吃/碰命令后 GameData.setTableState 分别置 MAH_STATE_CHOW/MAH_STATE_PUNG 并播对应表现；等待期内河牌保持原位、无动作字效。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:32；source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:32
- **服务端职责**：下发 MsgChowS/MsgPungS/MsgKongS/MsgHuEx（裁决成立后的结算命令，裁决优先级在服务端）。
- **客户端职责**：客户端在收到吃/碰/杠/胡下行命令后才切表状态并播动作，无本地优先级裁决逻辑；等待期间保持对方弃牌状态。
- **协作边界**：客户端消费 MsgChowS/MsgPungS/MsgKongS/MsgHuEx 的结算结果做表状态与表现；裁决优先级、成立与否完全由服务端判定，客户端无本地裁决。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:32
- **原文摘录**：`GameData.setTableState(MahGameState.MAH_STATE_CHOW);`

#### `AT-ST-C11-004` 成立后从牌河取走弃牌并清浮标放大

- **规则说明**：吃、碰、直杠或点炮胡成立后，各端从牌河取走该弃牌，并清除它的浮标和放大显示。副露带进牌时移除进牌座位牌河最后一张；点炮胡按来源座位移除其牌河最后一张；吃碰杠命令同时收起出牌放大 UI。
- **触发条件**：MsgChowS/MsgPungS/MsgKongS 到达且副露含进牌时；或点炮胡结算到达且胡张来自他人牌河时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：牌河中该张消失，其他方位的出牌放大图（KW_ShowCard）同时隐藏。
- **限制与禁止**：无。
- **异常与边界**：点炮胡移除河牌需同时满足来源非本家（dfFrom != localSeat）、来源牌河最后一张等于胡张值、needRemove 成立；副露无进牌（nInMahs 为空）时不触发河牌移除。
- **验收**：吃/碰/直杠成立后进牌座位牌河最后一张被移除、出牌放大 UI 隐藏；点炮胡成立后来源座位牌河胡张被移除。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:892；source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:42；source-code/client/Code/layer/BoxHzmjMah2DView.ts:997
- **服务端职责**：下发 MsgChowS/MsgPungS/MsgKongS（副露与进牌数据）；下发 MsgResultHu（点炮胡胡张与来源）。
- **客户端职责**：setCombo 在副露带进牌时调用 outs[进牌座位].removeLastMah() 移除河牌；点炮胡在 setHu 中按 dfFrom 移除河牌最后一张；吃碰杠命令同时派发 onHidePutCardUi 收起出牌放大。
- **协作边界**：客户端消费 MsgChowS/MsgPungS/MsgKongS/MsgResultHu 的牌组与来源数据做河牌移除与放大收起；是否成立、进牌归属由服务端数据给出，客户端只按数据呈现。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMah2DView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:892
- **原文摘录**：`if (_combo.nInMahs.length > 0) {
            this.outs[_combo.nSeat].removeLastMah();`

#### `AT-ST-C11-005` 全部放弃则牌留牌河轮到下家摸

- **规则说明**：所有有操作资格的玩家全部放弃后，弃牌留在牌河，再轮到下家摸牌。「全部放弃」的判定在服务端，客户端不保留弃牌回收逻辑：弃牌持续留在 outs 牌河中，随后收到 MsgTake 由下家摸牌并写入 PLAY 权限。
- **触发条件**：各玩家逐个放弃（上行 MsgCancel 或倒计时结束）后，服务端判定全部放弃并下发下家的 MsgTake。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：牌河保持该张，下家摸牌动画后出牌权转移。
- **限制与禁止**：客户端不主动清除或回收牌河中的弃牌。
- **异常与边界**：断线重连补数据时按数据缓存恢复牌河状态，不播动画（跨切面）。
- **验收**：无人响应成立时弃牌保留在牌河原位；随后下家收到 MsgTake 播摸牌动画并本地写入 POWER_ID_PLAY 出牌权。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:70
- **服务端职责**：判定「全部放弃」后下发 MsgTake（下家摸牌）与 MsgPower（PLAY 权限）。
- **客户端职责**：客户端不保留弃牌回收逻辑，弃牌持续留在 outs 牌河中；随后收到 MsgTake 由下家摸牌并写入 PLAY 权限。
- **协作边界**：客户端消费 MsgTake/MsgPower 做摸牌与出牌权转移表现；「全部放弃」判定在服务端，客户端只被动接收下一条摸牌命令，牌河保持由「不清除」的默认行为达成。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:70
- **原文摘录**：`GameData.setCurPower(localSeat, BoxMahDefine.PowerType.POWER_ID_PLAY, null);`

## `FP-ST-C11-003` 必须先「过」才能出牌

- **主描述**：存在自摸提示或本次杠提示时，出牌会被拦截并提示先点【过】；只有暗杠所需牌全部来自摸牌前手牌时可直出，碰后又能杠的仍须先过。
- **范围与边界**：覆盖 canPlayMahCheck 的拦截分支与 _isGangOffMoCard 例外判定。
- **总体协作**：MsgPower → setPower 计算 _isGangOffMoCard 与按钮状态 → 手牌出牌回调被 canPlayMahCheck 拦截或放行。

### 原子项

#### `AT-ST-C11-006` 自摸或杠提示未过时拦截出牌

- **规则说明**：【自摸】还在，或本次杠提示必须先过时，双击或滑动出牌会被拦住，只在本家显示「点“过”才能出牌」。须先点【过】。客户端在 canPlayMahCheck 中检测 power 含 HU/KONG/PONG/CHOW 且按钮态为 PENG_GANG_HU 时返回 false 拦下出牌并弹出文本提示，只有本家会走到该分支。
- **触发条件**：本家 power 含 HU（自摸）/KONG（杠）等响应权限、按钮态为 PENG_GANG_HU 且 _isGangOffMoCard 为假时，玩家双击或滑动出牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：本家弹出 MessageSimpleBoxListView 提示「点“过”才能出牌」，最长显示 3 秒，牌不落河。
- **限制与禁止**：未点【过】前禁止出牌，双击、滑动均被拦下，牌不落河；提示只在出牌者本家显示。
- **异常与边界**：拦截仅发生在本家出牌回调，其他端不受影响；本分支由按钮态与权限位共同判定，任一不满足则不拦。
- **验收**：存在自摸或杠提示未过时双击/滑动出牌被拦下，本家弹「点“过”才能出牌」提示，不上行 MsgPlayC；点【过】后可正常出牌。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1453；source-code/client/Code/layer/BoxHzmjMainView.ts:1455
- **服务端职责**：下发 MsgPower（含 HU/KONG 等权限位驱动本端提示态）；接收 MsgPlayC。
- **客户端职责**：canPlayMahCheck 检测 power 含 HU/KONG/PONG/CHOW 且按钮态为 PENG_GANG_HU 时返回 false，并弹出文本提示；只有本家会走到该分支。
- **协作边界**：客户端消费 MsgPower 的权限位在本地判断是否拦截出牌；拦截与提示均为本端行为不上行；出牌最终仍以 MsgPlayC 上行后由服务端裁决。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1453
- **原文摘录**：`if (showAction && btnState.selectedIndex == BtnState.PENG_GANG_HU && !this._isGangOffMoCard) {`

#### `AT-ST-C11-007` 摸牌前已持有的暗杠可直出

- **规则说明**：例外：可杠的只是摸牌或补牌之前已经拿在手里的暗杠，可以直接出牌。客户端 _updateGangOffMoCard 判定：有杠权限、无胡权限、存在摸牌位牌且所有可杠组合都不含该摸牌值时，_isGangOffMoCard 置真；随后 _updatePowerGray 直接清灰并允许出牌。
- **触发条件**：MsgPower 下发含 KONG 权限、不含 HU 权限、本家摸牌位有牌（moCard > 0）且所有可杠组合的首张都不等于摸牌值时，setPower 期间判定成立。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：手牌不做压暗，不点【过】也能提牌出牌。
- **限制与禁止**：例外仅当可杠组合全部来自摸牌/补牌之前已持有的手牌（不含摸牌位牌）时成立；有胡权限时不适用。
- **异常与边界**：可杠组合中任一含摸牌位牌值（hasGangOnMoCard 成立）时 _isGangOffMoCard 不置位，仍走先过拦截。
- **验收**：有杠无胡且所有可杠组合均不含摸牌牌值时，手牌保持常态亮度（onClearGray），提牌出牌不被 canPlayMahCheck 拦截。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:697；source-code/client/Code/layer/BoxHzmjMainView.ts:713
- **服务端职责**：下发 MsgPower（KONG 权限位与可杠组合数据，供客户端判定例外）。
- **客户端职责**：_updateGangOffMoCard 判定：有杠权限、无胡权限、存在摸牌位牌且所有可杠组合都不含该摸牌值时，_isGangOffMoCard 置真；随后 _updatePowerGray 直接清灰并允许出牌。
- **协作边界**：客户端消费 MsgPower 的 combs 与权限位在本地判定 _isGangOffMoCard 例外；判定完全在本地，服务端不感知该例外标记。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:697
- **原文摘录**：`const hasGangOnMoCard = (PowerData.combs ?? []).some(
            (comb) => this._isGangComb(comb.flag) && (comb.mahs?.[0] ?? 0) === moCard
        );`

#### `AT-ST-C11-008` 碰后又能杠仍须先过

- **规则说明**：碰之后又能杠的，仍须先过。客户端无「碰后加杠」的显式分支：碰后摸牌位为空（moCard=0），_updateGangOffMoCard 在 moCard <= 0 时直接 return，_isGangOffMoCard 保持 false，因此仍走「必须先点过」的拦截分支。
- **触发条件**：碰成立后再获得杠权限（此时无摸牌位牌，moCard 为 0），玩家尝试出牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：与自摸提示一致，本家弹「点“过”才能出牌」。
- **限制与禁止**：碰后加杠场景不走杠直出例外，出牌前必须先点【过】。
- **异常与边界**：该结论由 moCard<=0 分支推导，代码无「碰后加杠」的显式分支。
- **验收**：碰后再杠场景下双击/滑动出牌被拦截并弹「点“过”才能出牌」，须先点【过】方可出牌。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:696
- **服务端职责**：下发 MsgPower（碰后的杠权限与可杠组合）。
- **客户端职责**：碰后摸牌位为空（moCard=0），_updateGangOffMoCard 直接 return 使 _isGangOffMoCard 保持 false，因此仍走「必须先点过」的拦截分支。
- **协作边界**：客户端消费 MsgPower 后按本地 moCard 状态判定；碰后场景的「仍须先过」由摸牌位为空的分支间接触发，非显式逻辑。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:696
- **原文摘录**：`if (moCard <= 0) return;`

#### `AT-ST-C11-039` 可杠牌均非刚摸牌时不压暗可直接出

- **规则说明**：有杠、没有胡，且所有可杠牌都不是刚摸的那张时，手牌不压暗，不点过也能出牌。_isGangOffMoCard 命中后 _updatePowerGray 走 onClearGray 清掉权限压暗，canPlayMahCheck 因 _isGangOffMoCard 跳过拦截。
- **触发条件**：与 AT-ST-C11-007 相同的判定成立时（有杠权限、无胡权限、所有可杠组合均不含摸牌位牌），_isGangOffMoCard 置真。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：手牌保持常态亮度，【杠】【过】按钮仍显示，可直接提牌出牌。
- **限制与禁止**：有胡权限时本规则不生效（判定条件要求无胡），仍须先过。
- **异常与边界**：无。
- **验收**：有杠无胡且可杠组合均不含摸牌牌值时，手牌全亮不压暗，不点【过】也能提牌出牌并上行 MsgPlayC。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:701；source-code/client/Code/layer/BoxHzmjMainView.ts:714
- **服务端职责**：下发 MsgPower（KONG/HU 权限位与可杠组合）。
- **客户端职责**：_isGangOffMoCard 命中后 _updatePowerGray 走 onClearGray 清掉权限压暗，canPlayMahCheck 因 _isGangOffMoCard 跳过拦截。
- **协作边界**：客户端消费 MsgPower 权限位与 combs 做本地压暗与拦截豁免判断；按钮仍显示【杠】【过】，是否压暗、能否直出均为本地呈现。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:701
- **原文摘录**：`this._isGangOffMoCard = true;`

## `FP-ST-C11-004` 过与放弃语义及响应提交

- **主描述**：【过】只放弃当前这次提示；过2 只本地收起按钮并按禁手重压；多组吃/杠的取消等同上行过；低优先级先提交后收起按钮等待服务端裁决。
- **范围与边界**：覆盖 onBtnGuo/onBtnGuo2/onBtnCancel 与提交后的按钮收起，不含服务端裁决实现。
- **总体协作**：点击按钮 → GameController.sendCancel 发 MsgCancel（或本地不上行）→ 服务端重发 MsgPower 决定后续按钮。

### 原子项

#### `AT-ST-C11-009` 点过只放弃本次提示并收起按钮预览

- **规则说明**：点【过】只放弃这一次提示，收起本次按钮和预览。客户端 onBtnGuo 上行 MsgCancel 后把按钮态置 EMPTY、隐藏多组选择面板，清 selectChiCb 与权限压暗后再按禁手重压。
- **触发条件**：本端存在吃碰杠胡响应按钮或候选预览时，玩家点击蓝色【过】按钮。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：吃碰杠胡按钮整组退场，候选牌面板收起，手牌恢复可触摸但保留禁手灰。
- **限制与禁止**：【过】只放弃本次提示，不影响后续新弃牌的重新判断。
- **异常与边界**：点过之后先清权限灰再按禁手重压，两套灰度来源互相覆盖（跨切面）。
- **验收**：点【过】后上行 MsgCancel，C_BtnState 置 EMPTY，多组选择面板隐藏，权限压暗清除后按禁手重压。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1236
- **服务端职责**：接收 MsgCancel；重发 MsgPower 决定后续按钮。
- **客户端职责**：onBtnGuo 发 MsgCancel，按钮态置 EMPTY，隐藏多组选择面板，清 selectChiCb 与权限压暗后按禁手重压。
- **协作边界**：客户端上行 MsgCancel 表达放弃本次提示；放弃后的后续机会由服务端重发 MsgPower 驱动，客户端收按钮、清压暗为本地行为。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1236
- **原文摘录**：`onBtnGuo(): void {
        GameController.instance.sendCancel();
        this.view.KW_Main.KW_Handler.C_BtnState.selectedIndex = BtnState.EMPTY;
        this._hideMoreSelect()`

#### `AT-ST-C11-010` 新弃牌重新判断

- **规则说明**：之后别人再打出相同牌，按新弃牌重新判断。重判逻辑在服务端：每次弃牌后服务端重新下发 MsgPower，客户端 setPower 全量重算按钮与压暗，不复用上一次的放弃结果。
- **触发条件**：他人打出新弃牌（含相同牌）、服务端下发新一轮 MsgPower 时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：新一轮按钮与压暗按新权限重新出现。
- **限制与禁止**：客户端不缓存上一次的放弃结果来抑制新一轮按钮。
- **异常与边界**：重判逻辑在服务端，客户端仅全量刷新。
- **验收**：玩家对某牌值放弃后，他人再打出该牌时本端按钮与压暗按新 MsgPower 全量重新出现。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:71
- **服务端职责**：对每张新弃牌重新判定各端可做操作，并重新下发 MsgPower。
- **客户端职责**：每次弃牌后服务端重新下发 MsgPower，客户端 setPower 全量重算按钮与压暗，不复用上一次的放弃结果。
- **协作边界**：客户端消费 MsgPower 做全量按钮与压暗重算；「是否可再次吃碰杠胡」的重判在服务端，客户端无放弃状态留存。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:71
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.setPower, localSeat, data.power, data);`

#### `AT-ST-C11-011` 放弃杠后同次机会不再出杠

- **规则说明**：放弃杠后，同一次操作机会内不再出现【杠】；下一次拿到操作机会再判断。
- **触发条件**：本端对杠提示点【过】放弃后，同一次操作机会内的后续权限刷新。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：同一次操作机会内杠被放弃后不应再出现【杠】按钮。
- **异常与边界**：客户端未找到对「已放弃杠」的本地抑制状态；按钮显隐完全由下一次 MsgPower 位掩码决定。
- **验收**：点【过】放弃杠后，同一次操作机会内不再显示【杠】按钮，下一次操作机会重新判定（由服务端 MsgPower 控制，客户端无本地抑制，待确认）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）。
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认。
- **协作边界**：客户端消费下一次 MsgPower 决定按钮显隐，无本地「已放弃杠」的抑制状态。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C11-020` 低优先级先提交收起按钮等待

- **规则说明**：较低优先级先提交时，本端收起自己的按钮并等待。客户端发送吃/碰/杠请求后立即把 C_BtnState 置 EMPTY 并清压暗，进入等待服务端结果状态，无专门等待面板。
- **触发条件**：本端提交吃/碰/杠请求（上行 MsgChowC/MsgPungC/MsgKongC）后、服务端结果命令到达前。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：请求提交后按钮组与候选面板立即收起，手牌恢复常态。
- **限制与禁止**：无。
- **异常与边界**：等待期间无专门等待面板，界面保持收起状态直至服务端下发新命令。
- **验收**：上行吃/碰/杠请求后按钮组立即收起（C_BtnState 置 EMPTY），无残留按钮；服务端结果到达后按结果表现。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1102
- **服务端职责**：接收 MsgChowC/MsgPungC/MsgKongC 请求并裁决，后续下发对应结算命令。
- **客户端职责**：发送吃/碰/杠请求后立即把 C_BtnState 置 EMPTY 并清压暗，进入等待服务端结果状态，无专门等待面板。
- **协作边界**：客户端上行 MsgChowC/MsgPungC/MsgKongC 后即收起按钮进入等待；裁决结果（成立或被更高优先级取消）由服务端后续命令表达，客户端不预测结果。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1102
- **原文摘录**：`GameController.instance.sendChow(comb);
        this.view.KW_Main.KW_Handler.C_BtnState.selectedIndex = BtnState.EMPTY;`

#### `AT-ST-C11-021` 更高优先级成立则取消等待请求

- **规则说明**：更高优先级成立后，结束等待并取消该请求。
- **触发条件**：本端已提交较低优先级请求处于等待状态时，更高优先级玩家的操作成立。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无。
- **异常与边界**：无客户端实现，由服务端丢弃低优先级请求后下发新状态。
- **验收**：更高优先级成立时本端结束等待、请求被取消，界面按服务端下发的新状态刷新（客户端无显式取消逻辑，待确认）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）。
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认。
- **协作边界**：客户端无显式取消逻辑；等待的结束与请求取消由服务端丢弃请求并下发新状态间接表达。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C11-022` 更高优先级放弃后执行已提交请求

- **规则说明**：更高优先级都放弃后，再执行已经提交的较低优先级请求。
- **触发条件**：本端已提交较低优先级请求处于等待状态时，所有更高优先级玩家放弃。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无。
- **异常与边界**：无客户端实现，属服务端排队逻辑。
- **验收**：更高优先级全部放弃后，已提交的较低优先级请求被服务端执行并下发结算命令，本端按命令表现（客户端无显式实现，待确认）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）。
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认。
- **协作边界**：客户端无排队实现；请求的延迟执行由服务端排队逻辑决定，客户端仅按最终下发的结算命令表现。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C11-038` 多组吃杠取消等同上行过

- **规则说明**：多组吃、杠的取消等于上行过。客户端 onBtnCancel 依次关闭吃/杠选择面板后直接调用 onBtnGuo，走与【过】相同的上行 MsgCancel 流程。
- **触发条件**：多组吃或多组杠选择面板展开时，玩家点击面板最右侧【取消】。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：【取消】点下后面板收起并发送过，按钮整组退场。
- **限制与禁止**：点【取消】等于放弃本次行牌机会里的全部操作，包含同时存在的胡或自摸，均通过同一条 MsgCancel 上行表达，客户端未单独区分。
- **异常与边界**：模板另述的「多组吃的取消包含同时存在的胡」「多组杠的取消包含同时存在的自摸」均通过同一条 MsgCancel 上行表达，未单独区分。
- **验收**：多组吃/杠面板点【取消】后 showChooseChi/showChooseGang 关闭并调用 onBtnGuo 上行 MsgCancel，按钮整组退场。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1174
- **服务端职责**：接收 MsgCancel，按一次放弃处理本次全部并存操作。
- **客户端职责**：onBtnCancel 依次关闭吃/杠选择面板后直接调用 onBtnGuo，走与【过】相同的上行 MsgCancel 流程。
- **协作边界**：客户端本地关面板后复用【过】的上行链路发一条 MsgCancel；「同时存在的胡/自摸一并放弃」由服务端按该上行统一处理，客户端不做区分。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1174
- **原文摘录**：`onBtnCancel(): void {
        this.showChooseChi(false);
        this.showChooseGang(false);
        this.onBtnGuo();
    }`

## `FP-ST-C11-005` 操作按钮与响应倒计时

- **主描述**：有操作资格者在本家手牌上方看到本次可做的按钮与蓝色【过】，胡牌按钮左侧显示胡牌张与预览倍数，倒计时归零后按钮仍可点。
- **范围与边界**：覆盖 Handler 组件布局、按钮显隐、胡牌张与倍数、倒计时表现；按钮美术颜色由资源包决定。
- **总体协作**：MsgPower → setPower → _getPowerShowState 决定显隐 → _updateHuPower 填胡牌张/倍数 → GamePowerCmd 派发 setClock 驱动倒计时。

### 原子项

#### `AT-ST-C11-012` 按钮出现在本家手牌上方区域

- **规则说明**：有操作资格的玩家在自己手牌右上方看到对应按钮和【过】。
- **触发条件**：服务端 MsgPower 下发本家操作权限位后，setPower 刷新本家按钮组显隐。
- **配置影响**：Handler 组件中每位玩家各有一组 KW_BTN_PGs_N 按钮容器（水平布局、隐藏项不占位），本家为 KW_BTN_PGs_0，默认不可见。
- **客户端交互**：本家手牌上沿偏右出现按钮组，其他玩家只播字效不显示按钮。
- **限制与禁止**：仅本家显示操作按钮，其他座位容器保持不可见。
- **异常与边界**：布局为手牌上方居中偏右，非严格「右上方」；按钮坐标随分辨率自适应。
- **验收**：下发本家含吃/碰/杠/胡任一权限的 MsgPower 后，本家手牌上方出现对应按钮与【过】，其他座位无按钮显示。
- **职责域**：client
- **职责依据**：source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:70
- **服务端职责**：下发 MsgPower（携带权限位，驱动本家按钮组显隐）。
- **客户端职责**：每位玩家各有一组 KW_BTN_PGs_N 按钮容器，本家为 KW_BTN_PGs_0，仅本家有吃/碰/杠/胡/过/取消按钮，其他座位容器默认不可见。
- **协作边界**：客户端消费 MsgPower 权限位驱动按钮显隐，不做本地资格判断。
- **来源文件**：`source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml`
- **来源定位**：source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:70
- **原文摘录**：`<group id="n121_t3qe" name="KW_BTN_PGs_0" xy="353,420" size="890,171" visible="false" advanced="true" layout="hz"...`

#### `AT-ST-C11-013` 按钮顺序与只显示可做项

- **规则说明**：按钮从左到右为【吃】【碰】【杠】【胡】，蓝色【过】固定在最右，只显示本次可做的项。
- **触发条件**：MsgPower 下发后 setPower 执行，按 power 位逐项设置各按钮 visible。
- **配置影响**：Handler 组件内同组按钮按水平顺序布局，隐藏项不占位。
- **客户端交互**：按钮自左向右依次为吃、碰、杠、胡、过、过2，隐藏项不占位。
- **限制与禁止**：只显示本次可做的项，无对应权限位的按钮不显示。
- **异常与边界**：【过】为蓝色属美术资源定义，代码只设 skinName="guo"，无颜色常量可查。
- **验收**：下发含多个权限位的 MsgPower 后，按钮自左向右按 吃、碰、杠、胡、过 顺序只显示可做项。
- **职责域**：client
- **职责依据**：source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:21；source-code/client/Code/layer/BoxHzmjMainView.ts:578
- **服务端职责**：下发 MsgPower（携带权限位掩码）。
- **客户端职责**：setPower 按 power 位分别为 Chi/Peng/Gang/Hu/Guo/Guo2 设 visible，只显示本次可做的项；Handler 中同组按水平顺序布局。
- **协作边界**：客户端消费 MsgPower 权限位做显隐，按钮顺序由 Handler 布局固定。
- **来源文件**：`source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml`
- **来源定位**：source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:21
- **原文摘录**：`<component id="n84_gv5d" name="KW_BTN_Guo" src="yngk6m" fileName="component/EffectBtn.xml" xy="2338,400"...`

#### `AT-ST-C11-014` 胡按钮左侧显示胡牌张与预览倍数

- **规则说明**：【胡】或【自摸】左侧显示胡牌张和预览倍数。
- **触发条件**：MsgPower 携带胡牌权限及胡牌张、倍数数据时，_updateHuPower 执行。
- **配置影响**：HuActionBtn 组件中胡牌张节点 KW_HuPai（缩放 0.72）位于按钮左侧，倍数文本同侧。
- **客户端交互**：胡按钮左侧显示一张牌面与「N倍」文本，封顶标记默认隐藏。
- **限制与禁止**：无
- **异常与边界**：无
- **验收**：收到含胡权限的 MsgPower 后，胡按钮左侧出现胡牌张牌面与「N倍」倍数文本。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:664；source-code/client/Fgui/assets/box_hzmj_main/component/HuActionBtn.xml:6
- **服务端职责**：下发 MsgPower（含胡牌张 hu_mah 与预览倍数 hu_point）。
- **客户端职责**：_updateHuPower 用 PowerData.hu_mah 填胡牌张牌面、hu_point 拼「N倍」写到倍数文本；胡牌张与倍数节点在按钮左侧。
- **协作边界**：胡牌张与倍数值均消费自服务端下发数据，客户端只做展示。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:664
- **原文摘录**：`this.view.KW_Main.KW_Handler.KW_BTN_Hu.KW_HuPai.KW_Value.url = BoxMahDefine.MahValueImg[PowerData.hu_mah];`

#### `AT-ST-C11-015` 统一响应倒计时归零仍可点

- **规则说明**：各端使用同一个响应倒计时，归零后按钮仍可点。
- **触发条件**：GamePowerCmd 收到 MsgPower 时派发 setClock 事件携带剩余秒数，客户端本地每秒递减。
- **配置影响**：倒计时数字显示于桌面中央倒计时节点。
- **客户端交互**：桌面中央倒计时归零显示「00」，按钮保持可点，客户端无超时自动过或自动出牌。
- **限制与禁止**：倒计时归零不禁用按钮也不收起按钮。
- **异常与边界**：「各端同一个倒计时」由服务端统一剩余秒数间接保证，代码无跨端时钟同步实现；归零可点为「未禁用」的推断。
- **验收**：倒计时初值取服务端下发的剩余秒数；归零显示「00」后按钮仍可点击。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:83；source-code/client/Code/layer/BoxHzmjMah2DView.ts:711
- **服务端职责**：下发 MsgPower/MsgWaitInfos（携带统一剩余秒数，驱动各端同一倒计时）。
- **客户端职责**：倒计时数值取自服务端下发权限时的剩余秒数，客户端本地递减显示；归零分支只把数字写成「00」并停表，不禁用按钮也不收起按钮。
- **协作边界**：倒计时秒数消费自服务端消息，本地只递减显示；无本地超时裁决。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:83
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.setClock, localSeat, clockInfo);`

#### `AT-ST-C11-034` 胡与自摸按钮文案区分

- **规则说明**：点炮、抢杠的按钮文案是「胡」，自摸是「自摸」。
- **触发条件**：MsgPower 携带胡牌类型 hu_type，客户端按 hu_type 选择按钮皮肤。
- **配置影响**：本原子项无独立配置
- **客户端交互**：胡牌按钮上播放「胡」或「自摸」字效 skin。
- **限制与禁止**：无
- **异常与边界**：无
- **验收**：点炮/抢杠胡权限下按钮显示「胡」，自摸权限下按钮显示「自摸」。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:670；source-code/client/Code/config/GameDefine.ts:427
- **服务端职责**：下发 MsgPower（含 hu_type 区分点炮、抢杠与自摸）。
- **客户端职责**：_getHuActionSkinName 按 hu_type 选皮肤：HT_DISCARD、HT_ROBKONG 用 "hu"，其余用 "zimo"。
- **协作边界**：文案区分消费服务端 hu_type，皮肤选择在客户端完成。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:670
- **原文摘录**：`private _getHuActionSkinName(huType: HuType): string { if (huType == HuType.HT_DISCARD || huType == HuType.HT_ROBKO...`

#### `AT-ST-C11-035` 没有独立抢杠按钮

- **规则说明**：没有单独的抢杠按钮。
- **触发条件**：抢杠胡场景收到 MsgPower 时，复用同一【胡】按钮承载入口。
- **配置影响**：Handler 按钮容器仅含 Chi/Peng/Gang/Hu/Guo/Guo2/Cancel/Bao_Ting 节点，无抢杠专用节点。
- **客户端交互**：界面不存在抢杠专用按钮。
- **限制与禁止**：无抢杠专用按钮节点。
- **异常与边界**：以「按钮清单中不存在抢杠节点」为证据，属结构性确认。
- **验收**：任意权限组合下界面均不出现抢杠专用按钮；抢杠胡入口为【胡】按钮并显示「胡」文案。
- **职责域**：client
- **职责依据**：source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:15
- **服务端职责**：下发 MsgPower（抢杠胡以权限位与 hu_type 表达，不设独立按钮语义）。
- **客户端职责**：按钮容器只有 Chi/Peng/Gang/Hu/Guo/Guo2/Cancel/Bao_Ting，抢杠胡复用同一个【胡】按钮并通过 hu_type 区分文案。
- **协作边界**：客户端按按钮清单渲染，无抢杠专用节点，语义区分交给 hu_type。
- **来源文件**：`source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml`
- **来源定位**：source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:15
- **原文摘录**：`<component id="n82_gv5d" name="KW_BTN_Hu" src="gv5d6l" fileName="component/HuActionBtn.xml" xy="1820,400"...`

#### `AT-ST-C11-036` 过与过2同一文案

- **规则说明**：过和过2都显示「过」。
- **触发条件**：界面初始化 initSkin 时统一设置两个过按钮的皮肤。
- **配置影响**：本原子项无独立配置
- **客户端交互**：两个按钮外观完全一致，均显示「过」。
- **限制与禁止**：无
- **异常与边界**：无
- **验收**：界面出现的过与过2按钮均显示「过」文案。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:319
- **服务端职责**：下发 MsgPower（含过相关权限位驱动两个过按钮出现）。
- **客户端职责**：initSkin 把 KW_BTN_Guo 与 KW_BTN_Guo2 的 KW_Ani.skinName 都设为 "guo"。
- **协作边界**：文案统一为客户端皮肤常量，与服务端权限位无关。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:319
- **原文摘录**：`this.view.KW_Main.KW_Handler.KW_BTN_Guo.KW_Ani.skinName = "guo"; this.view.KW_Main.KW_Handler.KW_BTN_Guo2.KW_Ani.skinName = "guo";`

#### `AT-ST-C11-037` 过上行与过2本地不上行

- **规则说明**：过上行放弃；过2只在本地收起按钮并清掉本次压暗，再按禁手重新压暗，不上行。
- **触发条件**：玩家点击【过】或【过2】按钮。
- **配置影响**：本原子项无独立配置
- **客户端交互**：过2 点下按钮组收起、手牌恢复常态/禁手灰，服务端无请求。
- **限制与禁止**：过2不上行任何请求。
- **异常与边界**：无
- **验收**：点【过】上行 MsgCancel；点【过2】不上行、按钮收起且手牌按禁手规则重新压暗。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1245；source-code/client/Code/layer/BoxHzmjMainView.ts:1262
- **服务端职责**：下发 MsgPower（触发过按钮出现）；接收【过】的 MsgCancel 上行。
- **客户端职责**：onBtnGuo 调 sendCancel 上行；onBtnGuo2 注释标明「CANCEL_C：本地取消操作按钮，无需回包」，只切按钮态、收起面板并 _clearPowerHandGray（先清权限灰再按禁手重压）。
- **协作边界**：过为上行放弃请求交服务端裁决；过2为纯本地 UI 状态回退，不产生网络请求。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1245
- **原文摘录**：`/**过2（CANCEL_C：本地取消操作按钮，无需回包；暗杠/碰吃等同回合场景） */`

## `FP-ST-C11-006` 手牌压暗规则

- **主描述**：能胡时整手正常亮度；不能胡时只亮参与当前吃/碰/直杠（或合法杠）的牌，其余压暗，且压暗只在本家本端显示。
- **范围与边界**：覆盖 setPower 的 _updatePowerGray / _collectPowerBrightMahs / _setHandGrayExceptGroup；不含禁手灰（MsgPlayLmts）。
- **总体协作**：MsgPower → setPower → _getPowerShowState → _updatePowerGray → 手牌 setGrayValues。

### 原子项

#### `AT-ST-C11-016` 能胡时整手正常亮度

- **规则说明**：能胡时整手保持正常亮度。
- **触发条件**：MsgPower 下发且权限状态含胡（showHu 为真）时，_updatePowerGray 走清灰分支。
- **配置影响**：本原子项无独立配置
- **客户端交互**：手牌不压暗，全部牌面正常亮度。
- **限制与禁止**：无
- **异常与边界**：无吃/碰/杠提示或含胡权限时均走清灰分支。
- **验收**：含胡权限（showHu=true）时整手牌恢复可触摸与正常亮度。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:718
- **服务端职责**：下发 MsgPower（含 HU 权限位与候选组合）。
- **客户端职责**：_updatePowerGray 在 powerState.showHu 为真时直接 onClearGray，清空灰度并恢复全部牌可触摸。
- **协作边界**：灰度状态由客户端按 MsgPower 权限位本地计算，服务端只下发权限。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:718
- **原文摘录**：`if ((!powerState.showPeng && !powerState.showGang && !powerState.showChi) || powerState.showHu) { this.onClearGray();`

#### `AT-ST-C11-017` 不能胡时只亮参与吃碰直杠的牌

- **规则说明**：不能胡时，只有参与当前吃、碰、直杠的牌保持亮度，其余压暗。压暗只在该玩家本端显示。
- **触发条件**：MsgPower 下发且 showChi/showPeng/showGang 为真、showHu 为假时，_updatePowerGray 计算亮牌集合并压暗其余。
- **配置影响**：本原子项无独立配置
- **客户端交互**：本家参与操作的牌面正常，其余手牌变灰；别家手牌不受影响。
- **限制与禁止**：压暗仅本家本端显示，其他座位不压暗。
- **异常与边界**：无
- **验收**：吃/碰/杠候选场景下仅候选组合牌保持亮度，其余本家手牌置灰；其他玩家手牌亮度不变。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:752；source-code/client/Code/layer/BoxHzmjMainView.ts:783；source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:102
- **服务端职责**：下发 MsgPower（含 CHOW/PONG/KONG 权限位与候选组合 mahs）。
- **客户端职责**：_collectPowerBrightMahs 汇总 CHOW 的全组牌值与 PONG/MKONG/CKONG/TKONG 的牌值，_setHandGrayExceptGroup 把这些牌之外的牌值置灰；其他座位在 GamePowerCmd 中直接 onClearGray。
- **协作边界**：亮牌集合由客户端按服务端候选组合本地计算，仅作用于本家手牌视图。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:752
- **原文摘录**：`if (powerState.showChi && comb.flag === BoxMahDefine.CombType.CMF_CHOW) { for (const mah of comb.mahs ?? []) { pushUnique...`

#### `AT-ST-C11-018` 摸入或补入的牌成杠时亮参与杠的牌

- **规则说明**：本次新摸入或补入的牌能组成暗杠或加杠，且同次无胡时，参与任一合法杠的手牌保持亮度，其余压暗。
- **触发条件**：MsgPower 下发且 showGang 为真、showHu 为假时，_collectPowerBrightMahs 杠分支收集亮牌牌值。
- **配置影响**：本原子项无独立配置
- **客户端交互**：杠牌对应的四张同值手牌保持亮度，其他手牌压暗。
- **限制与禁止**：走该分支的前提是 showHu 为假。
- **异常与边界**：亮牌粒度为牌值而非具体槽位，同值多张会一起亮。
- **验收**：摸牌/补牌后可暗杠或加杠且同次无胡权限时，杠牌值的全部手牌亮起，其余置灰。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:757
- **服务端职责**：下发 MsgPower（含 KONG 权限位与杠组合）。
- **客户端职责**：_collectPowerBrightMahs 的杠分支把每个杠组合的 mahs[0] 加入亮牌值，_setHandGrayExceptGroup 保留该牌值全部张数亮起；走该分支的前提是 showHu 为假。
- **协作边界**：亮牌牌值取自服务端杠组合数据，按牌值整体亮起为客户端行为。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:757
- **原文摘录**：`if (powerState.showGang && this._isGangComb(comb.flag)) { pushUnique(comb.mahs?.[0] ?? 0); }`

#### `AT-ST-C11-019` 杠组全为原有牌时保持当前亮度

- **规则说明**：可杠组只由原有的牌组成时，手牌保持当前亮度。
- **触发条件**：MsgPower 下发后 _updatePowerGray 判定 _isGangOffMoCard 命中（摸牌位牌不参与任何杠）。
- **配置影响**：本原子项无独立配置
- **客户端交互**：手牌保持原有亮度，不吃碰杠候选压暗。
- **限制与禁止**：早退分支同时清空吃牌选择回调，不做任何压暗。
- **异常与边界**：无
- **验收**：可杠组均不含本次摸入牌时，手牌不出现压暗且吃选回调被清空。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:713
- **服务端职责**：下发 MsgPower（杠组合数据用于客户端判定摸牌位是否参与）。
- **客户端职责**：_isGangOffMoCard 命中（摸牌位牌不参与任何杠）时 _updatePowerGray 早退 onClearGray 并清 selectChiCb，不做任何压暗。
- **协作边界**：是否为「原有牌杠」由客户端按摸牌位与服务端组合数据本地判定。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:713
- **原文摘录**：`if (this._isGangOffMoCard) { this.onClearGray(); this._selfHand.selectChiCb = null; return; }`

## `FP-ST-C11-007` 多吃组合选择面板

- **主描述**：点【吃】后在手牌上方展开可选顺子，每组三张正面，点选一组即提交，点【取消】等同上行过。
- **范围与边界**：覆盖 onBtnChi/showChooseChi/showMoreChiComb/_getChowMahRows 与 KW_GangGrps 动态选项池；牌面排序与取消按钮位置见原子项边界。
- **总体协作**：点击【吃】 → 组合数大于 1 时 showChooseChi → 动态创建 ChooseGang 选项 → 点击回调 onBtnChooseChi → sendChow。

### 原子项

#### `AT-ST-C11-023` 展开可选顺子每组三张正面

- **规则说明**：多种吃法：点【吃】后，在手牌上方展开可选顺子，每组三张正面、按牌面从小到大，右侧为【取消】。
- **触发条件**：玩家点击【吃】且吃候选组合数大于 1 时，展开选择面板。
- **配置影响**：选项在 KW_GangGrps 容器内动态创建（ChooseGang 选项并补足三张牌槽）；【取消】为独立按钮节点 KW_BTN_Cancel，不在选项池内。
- **客户端交互**：手牌上方横向排布多组三张顺子，选项外另有【取消】按钮。
- **限制与禁止**：无
- **异常与边界**：组合顺序直接用服务端 comb.mahs，未在本地按牌面排序；【取消】x=1250 位于选项池 KW_GangGrps(x=1590, pivot=1,0) 左侧，与模板「右侧为取消」不一致。
- **验收**：多组吃候选时点【吃】后手牌上方展开每组三张正面的候选顺子，并提供【取消】按钮；顺序以服务端下发为准。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:865；source-code/client/Code/layer/BoxHzmjMainView.ts:1031；source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:30
- **服务端职责**：下发 MsgPower（含 CHOW 权限与候选组合）；接收 MsgChowC 吃牌提交。
- **客户端职责**：showMoreChiComb 在 KW_GangGrps 内动态创建 ChooseGang 选项并补足三张牌槽，_fillChiChooseMahs 逐槽填牌面；组合顺序直接用服务端 comb.mahs，未在本地按牌面排序；【取消】是独立按钮节点，不在选项池内。
- **协作边界**：候选组合与顺序消费自服务端 MsgPower，客户端只做动态渲染与选择交互。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:865
- **原文摘录**：`showMoreChiComb(mahs: number[][], callback: () => void): void {`

#### `AT-ST-C11-024` 原吃过退场手牌恢复常态亮度

- **规则说明**：原【吃】【过】退场，手牌恢复常态亮度。
- **触发条件**：点【吃】后 showChooseChi(true) 把 C_BtnState 切到「选择多杠」页。
- **配置影响**：C_BtnState 控制器分页控制吃/过按钮显隐（仅「碰杠胡」页显示）。
- **客户端交互**：吃、过按钮消失，改为候选顺子与【取消】，手牌回到常态亮度。
- **限制与禁止**：无
- **异常与边界**：无
- **验收**：展开吃选择面板后原【吃】【过】按钮退场且手牌灰度清空。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1119；source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:31
- **服务端职责**：下发 MsgPower（驱动面板展开的前置权限）。
- **客户端职责**：showChooseChi(true) 把 C_BtnState 切到「选择多杠」页并清空手牌灰度；吃/过按钮只在「碰杠胡」页显示，因此退场。
- **协作边界**：页面切换与灰度清空均为客户端本地状态操作。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1119
- **原文摘录**：`this._selfHand.setGrayValues({});`

#### `AT-ST-C11-025` 倒计时归零后面板仍可操作

- **规则说明**：倒计时归零后面板仍可操作。
- **触发条件**：响应倒计时递减到 time == 0。
- **配置影响**：本原子项无独立配置
- **客户端交互**：倒计时为「00」时顺子选项与【取消】仍可点。
- **限制与禁止**：客户端无超时收起逻辑。
- **异常与边界**：属「无超时禁用逻辑」的反向确认。
- **验收**：倒计时显示「00」后候选顺子与【取消】按钮仍可点击。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:710
- **服务端职责**：下发 MsgPower（倒计时秒数）；超时裁决在服务端。
- **客户端职责**：倒计时归零只停表并显示「00」，选择面板的 touchable 与点击回调不受时间限制，客户端无超时收起逻辑。
- **协作边界**：倒计时只影响数字显示，不改变面板可操作性。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMah2DView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:710
- **原文摘录**：`} else if (time == 0) { clockStr.text = "00";`

#### `AT-ST-C11-026` 取消放弃本次弃牌全部操作

- **规则说明**：点【取消】等于放弃自己对这张弃牌的全部操作，包括同时存在的胡。
- **触发条件**：玩家在吃选择面板点击【取消】。
- **配置影响**：本原子项无独立配置
- **客户端交互**：面板收起、按钮退场。
- **限制与禁止**：无
- **异常与边界**：无
- **验收**：点吃面板【取消】后上行 MsgCancel，本次弃牌的全部操作（含同时存在的胡）被放弃。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1177
- **服务端职责**：接收 MsgCancel 上行（放弃本次弃牌全部操作并裁决）。
- **客户端职责**：onBtnCancel 收起吃/杠面板后调用 onBtnGuo，统一上行 MsgCancel，等于放弃本次弃牌的全部操作（含胡）。
- **协作边界**：放弃语义统一收敛为过上行，裁决在服务端。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1177
- **原文摘录**：`this.onBtnGuo();`

#### `AT-ST-C11-027` 选中一组即提交

- **规则说明**：选中一组即提交。
- **触发条件**：玩家点击候选顺子中的任意一组。
- **配置影响**：本原子项无独立配置
- **客户端交互**：点一组顺子立即提交，面板与按钮收起。
- **限制与禁止**：无
- **异常与边界**：无
- **验收**：点选某组顺子后立即上行 MsgChowC 提交该组，面板收起。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1113；source-code/client/Code/layer/BoxHzmjMainView.ts:1102
- **服务端职责**：接收 MsgChowC 上行（吃牌组合提交）并裁决。
- **客户端职责**：选项点击回调把当前索引写入 _chooseComb，转成 _chooseChi 后调用 onBtnChooseChi，取 GameData.getChowCombInfo 并 sendChow 提交。
- **协作边界**：组合内容消费自服务端候选数据，客户端仅提交选择索引。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1113
- **原文摘录**：`this.showMoreChiComb(this._getChowMahRows(), () => { this._chooseChi = this._chooseComb; this.onBtnChooseChi(); });`

## `FP-ST-C11-008` 多杠组合选择面板

- **主描述**：点【杠】收起杠/过并横向排列暗杠加杠候选，点一张候选只提交对应组，只有一组时直接提交，取消等同放弃本次行牌机会全部操作。
- **范围与边界**：覆盖 onBtnGang/showChooseGang/showMoreGang 与 KW_GangGrpList；候选排序与取消位置见原子项边界。
- **总体协作**：点击【杠】 → 组合数大于 1 时 showChooseGang → showMoreGang 填列表 → 点击项 → onBtnChooseGang → sendKong。

### 原子项

#### `AT-ST-C11-028` 点杠收起杠过并横向排列候选

- **规则说明**：多种暗杠或加杠：点【杠】后收起【杠】【过】，横向排列候选牌，最右为【取消】。
- **触发条件**：玩家点击【杠】且杠候选组合数大于 1 时，showChooseGang 展开选择面板。
- **配置影响**：KW_GangGrpList 列表为横向行布局（layout="row"、colGap=8、align="right"、autoClearItems）。
- **客户端交互**：候选牌横向排列，另有【取消】按钮。
- **限制与禁止**：无
- **异常与边界**：【取消】坐标 x=1250 在候选区域左端，与模板「最右为取消」不一致。
- **验收**：多组杠候选时点【杠】后【杠】【过】退场，候选牌横向贴右排列并提供【取消】。
- **职责域**：client
- **职责依据**：source-code/client/Fgui/assets/box_hzmj_main/component/GangGrps.xml:4；source-code/client/Code/layer/BoxHzmjMainView.ts:1170
- **服务端职责**：下发 MsgPower（含 KONG 权限与候选组合）；接收 MsgKongC 杠提交。
- **客户端职责**：showChooseGang 切到「选择多杠」页使杠/过按钮退场，showMoreGang 用 KW_GangGrpList 横向列表渲染候选牌并绑定点击；列表 align=right 贴右排布，【取消】为独立按钮。
- **协作边界**：候选集合消费自服务端 MsgPower，客户端负责渲染与点击绑定。
- **来源文件**：`source-code/client/Fgui/assets/box_hzmj_main/component/GangGrps.xml`
- **来源定位**：source-code/client/Fgui/assets/box_hzmj_main/component/GangGrps.xml:4
- **原文摘录**：`<list id="n95_lkxi" name="KW_GangGrpList" xy="16,12" size="317,121" layout="row" colGap="8" defaultItem="ui://hzmn2330...`

#### `AT-ST-C11-029` 暗杠加杠混排排序规则

- **规则说明**：暗杠与加杠混排，顺序为万、条、筒、东、南、西、北、中、发、白，同花色按点数升序。
- **触发条件**：showMoreGang 渲染杠候选列表时。
- **配置影响**：本原子项无独立配置
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无
- **异常与边界**：候选顺序完全依赖服务端 combs 顺序，未找到本地排序实现；若需保证模板顺序需服务端排序。
- **验收**：杠候选渲染顺序与 MsgPower.combs 下发顺序一致（客户端无本地排序）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：下发 MsgPower（combs 顺序即候选展示顺序）。
- **客户端职责**：showMoreGang 直接按 MsgPower.combs 顺序渲染，客户端未做花色/点数排序。
- **协作边界**：候选顺序完全由服务端 combs 决定，客户端不做本地排序。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C11-030` 倒计时归零后仍可选择

- **规则说明**：倒计时归零后仍可选择。
- **触发条件**：响应倒计时递减到 time == 0。
- **配置影响**：本原子项无独立配置
- **客户端交互**：「00」状态下候选项仍可点。
- **限制与禁止**：无超时关闭逻辑。
- **异常与边界**：同 AT-ST-C11-025，属「无超时禁用逻辑」的反向确认。
- **验收**：倒计时显示「00」后杠候选仍可点击提交。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:710
- **服务端职责**：下发 MsgPower（倒计时秒数）；超时裁决在服务端。
- **客户端职责**：倒计时归零仅停表显示「00」，候选列表保持 touchable，无超时关闭逻辑。
- **协作边界**：倒计时只影响数字显示，不改变候选列表可操作性。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMah2DView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:710
- **原文摘录**：`} else if (time == 0) {`

#### `AT-ST-C11-031` 取消放弃本次行牌机会全部操作

- **规则说明**：点【取消】等于放弃本次行牌机会里的全部操作，包括同时存在的自摸。
- **触发条件**：玩家在杠选择面板点击【取消】。
- **配置影响**：本原子项无独立配置
- **客户端交互**：面板收起、按钮退场。
- **限制与禁止**：无
- **异常与边界**：无
- **验收**：点杠面板【取消】后上行 MsgCancel，放弃本次行牌机会全部操作（含同时存在的自摸）。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1176
- **服务端职责**：接收 MsgCancel 上行（放弃本次行牌机会全部操作并裁决）。
- **客户端职责**：onBtnCancel 关闭杠面板后调用 onBtnGuo 上行 MsgCancel，放弃本次全部操作。
- **协作边界**：放弃统一收敛为过上行，含自摸机会的裁决在服务端。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1176
- **原文摘录**：`this.showChooseGang(false); this.onBtnGuo();`

#### `AT-ST-C11-032` 点一张候选只提交对应组

- **规则说明**：点一张候选牌只提交对应的一组。
- **触发条件**：玩家点击候选列表中的某一项。
- **配置影响**：本原子项无独立配置
- **客户端交互**：点某张候选即提交该组杠并收起面板。
- **限制与禁止**：无
- **异常与边界**：无
- **验收**：点击候选列表某项后仅上行该组 MsgKongC，面板收起。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:851；source-code/client/Code/layer/BoxHzmjMainView.ts:1150
- **服务端职责**：接收 MsgKongC 上行（指定杠组合提交）并裁决。
- **客户端职责**：列表 CLICK_ITEM 回调把点击索引写入 _chooseGang 后调用 onBtnChooseGang，取 GameData.getKongCombInfo(_chooseGang) 精确提交该组。
- **协作边界**：组合内容消费自服务端数据，客户端仅提交选择索引。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:851
- **原文摘录**：`this._chooseGang = grp.KW_GangGrpList.getChildIndex(e); this.onBtnChooseGang();`

#### `AT-ST-C11-033` 只有一组时点杠直接提交

- **规则说明**：只有 1 组时，点【杠】直接提交。
- **触发条件**：玩家点击【杠】且 _chooseGangLength 不大于 1。
- **配置影响**：本原子项无独立配置
- **客户端交互**：单击【杠】立即生效，不出现候选面板。
- **限制与禁止**：无
- **异常与边界**：无
- **验收**：仅一组杠候选时点【杠】直接上行该组 MsgKongC，不展开选择面板。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1140
- **服务端职责**：接收 MsgKongC 上行（唯一杠组合提交）并裁决。
- **客户端职责**：onBtnGang 在 _chooseGangLength 大于 1 时才展开候选面板，否则直接 onBtnChooseGang 提交第 0 组。
- **协作边界**：候选数量消费自服务端组合列表，分支判断在客户端。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1140
- **原文摘录**：`onBtnGang(): void { if (this._chooseGangLength > 1) { this.showChooseGang(true); return; } this.onBtnChooseGang();`

## `FP-ST-C11-009` 听牌箭头与爆头飘标记

- **主描述**：打出后听任意牌时听牌详情固定为「爆头2番」「摸任意一张可胡」，候选牌为财神标飘否则标爆，有该牌时其余可听牌只留普通箭头。
- **范围与边界**：覆盖 TingPaiView 爆头页与手牌听牌箭头 TingType 选择。
- **总体协作**：MsgWaitInfos → GameData.canTing → 手牌 showTingArrow / TingPaiView.initUI 渲染任意牌页。

### 原子项

#### `AT-ST-C11-040` 听任意牌的固定详情文案

- **规则说明**：打出某张手牌后若可听任意一张牌（万能听），听牌详情不再逐张列举，固定显示「爆头2番」与「摸任意一张可胡」两行文案。
- **触发条件**：服务端下发 MsgWaitInfos 更新听牌数据，听牌候选中出现任意牌哨兵（0x7F/0xFF），即打出后听任意一张时，TingPaiView 切换到爆头页。
- **配置影响**：两行文案为 TingCard 组件 KW_Text_Info0（「爆头2番」）与 KW_Text_Info1（「摸任意一张可胡」）的预设文本，随组件资源固定，无对局内可变配置。
- **客户端交互**：听牌列表切为单张「爆头」卡，两行固定显示「爆头2番」「摸任意一张可胡」，胡数文本改为「胡」。
- **限制与禁止**：任意牌听时详情文案固定，不随具体番型数值变化。
- **异常与边界**：无。
- **验收**：打出万能听牌张后打开听牌详情，仅显示一张爆头卡，两行文案分别为「爆头2番」与「摸任意一张可胡」，胡数文本为「胡」。
- **职责域**：client
- **职责依据**：source-code/client/Fgui/assets/box_hzmj_tingPai/component/TingCard.xml:24; source-code/client/Fgui/assets/box_hzmj_tingPai/component/TingCard.xml:27; source-code/client/Code/layer/BoxHzmjTingPaiView.ts:50
- **服务端职责**：下发 MsgWaitInfos（携带听牌候选数据，含任意牌哨兵值）。
- **客户端职责**：TingPaiView 检测到任意牌哨兵（0x7F/0xFF）即切到爆头页，只渲染一张爆头卡并把胡数文本改为「胡」；爆头卡两行文案由 TingCard 预设。
- **协作边界**：客户端消费服务端 MsgWaitInfos 的听牌候选数据；任意牌哨兵检测、爆头页切换与文案渲染均为本地逻辑。
- **来源文件**：`source-code/client/Fgui/assets/box_hzmj_tingPai/component/TingCard.xml`
- **来源定位**：source-code/client/Fgui/assets/box_hzmj_tingPai/component/TingCard.xml:24
- **原文摘录**：`<text id="n57_klmi" name="KW_Text_Info0" xy="83,13" size="93,34" fontSize="24" color="#3b629b" align="center" vAlign="middle" letterSpacing="1" text="爆头2番">`

#### `AT-ST-C11-041` 候选为财神标飘否则标爆

- **规则说明**：万能听候选牌是财神时，该牌听牌标记为「飘」；非财神的万能听候选标记为「爆」。
- **触发条件**：服务端下发 MsgWaitInfos 后，showTingArrow 判断某张手牌打出后是否万能听；是则按该牌值是否等于财神 jokerMah 选定标记。
- **配置影响**：本原子项无独立配置（财神牌值 jokerMah 来自对局数据）。
- **客户端交互**：手牌上打出财神（听任意牌）那张显示「飘」标记，其他万能听牌显示「爆」标记。
- **限制与禁止**：无。
- **异常与边界**：无。
- **验收**：手牌含打出财神即万能听的张时，该牌显示「飘」标记；其余万能听牌显示「爆」标记。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:193
- **服务端职责**：下发 MsgWaitInfos（携带听牌候选数据）。
- **客户端职责**：showTingArrow 判断该牌打出后是否万能听；是则按该牌值是否等于 jokerMah 选 TingType.TYPE_PIAO 或 TYPE_BAO。
- **协作边界**：客户端消费 MsgWaitInfos 听牌候选数据；财神比对（牌值是否等于 jokerMah）与飘/爆标记选择为本地逻辑。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:193
- **原文摘录**：`Mah2DBase.setCardTing(item, true, isJokerCard ? TingType.TYPE_PIAO : TingType.TYPE_BAO);`

#### `AT-ST-C11-042` 有飘或爆时其余只留箭头

- **规则说明**：同一手牌只要有一张万能听（飘或爆），其余可听牌的标记降级，只保留普通听牌箭头。
- **触发条件**：服务端下发 MsgWaitInfos 后，showTingArrow 先扫描听牌数据，判定存在任意牌听（hasBaoOrPiao 为真）时对其余可听牌生效。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：有飘/爆的手牌只显示普通听牌箭头，不再显示大/多/优等强化箭头。
- **限制与禁止**：存在任意牌听时，其余可听牌不再使用服务端下发的 tingType 强化箭头，统一降为 TingType.TYPE_COMMON 普通箭头。
- **异常与边界**：无。
- **验收**：手牌存在万能听牌时，其余可听牌箭头均为普通样式；不存在万能听时其余可听牌按原 tingType 显示。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:176; source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:200
- **服务端职责**：下发 MsgWaitInfos（携带听牌候选及各牌 tingType）。
- **客户端职责**：showTingArrow 先扫描是否存在任意牌听（hasBaoOrPiao），存在时其余可听牌统一用 TingType.TYPE_COMMON 普通箭头。
- **协作边界**：客户端消费 MsgWaitInfos 听牌候选与 tingType 数据；hasBaoOrPiao 扫描与箭头降级为本地判断。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:176
- **原文摘录**：`let hasBaoOrPiao = false;
        for (const key in tingValues) {`

## `FP-ST-C11-010` 碰杠区吃碰牌组展示

- **主描述**：吃成立后新增一组正面顺子并按点数列放，来源箭头叠在吃到的那张；碰三张正面展示，箭头叠在进牌位置；新牌组按成立顺序追加。
- **范围与边界**：覆盖 setCombo/resetCombo 与 _refreshComboArrows；具体牌面排版在外部 Mah2DCombo_Box。
- **总体协作**：MsgChowS/MsgPungS → PlayerCardsData.setCombo → BoxHzmjMah2DView.setCombo → Mah2DCombo_Box.addCombo → _refreshComboArrows 定位箭头。

### 原子项

#### `AT-ST-C11-043` 吃成立新增正面顺子按点数摆放

- **规则说明**：吃成立后，操作者座位碰杠区新增一组三张正面的顺子牌组，组内按点数从小到大摆放。
- **触发条件**：服务端下发 MsgChowS 确认吃成立，GameChowCmd 生成副露数据并派发 setCombo 事件时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：碰杠区多出一组三张正面顺子。
- **限制与禁止**：无。
- **异常与边界**：组内按点数排序与正面朝向渲染实现在 gamePlatformModule 的 Mah2DCombo_Box 组件，不在本仓库，本片仅能确认到 addCombo 的调用链。
- **验收**：吃成立后对应座位碰杠区新增一组三张正面顺子；排序与正面渲染由外部副露组件保证，本仓库验收止于 setCombo 派发与 addCombo 调用后牌组出现。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:48; source-code/client/Code/layer/BoxHzmjMah2DView.ts:895
- **服务端职责**：下发 MsgChowS（确认吃成立并携带副露组合数据）。
- **客户端职责**：GameChowCmd 调用 PlayerCardsData.setCombo 生成副露数据并派发 setCombo，Mah2DView 在对应座位 combo 区 addCombo；牌面朝向与组内排序由 Mah2DCombo_Box 组件处理，仓库内无排序代码。
- **协作边界**：客户端消费 MsgChowS 生成并渲染副露牌组；组内排序与正面渲染交由外部 Mah2DCombo_Box 组件，客户端不做排序。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:48
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.setCombo, localSeat, comboData, cards);`

#### `AT-ST-C11-044` 吃的来源箭头叠在被吃牌上

- **规则说明**：以吃牌者视角，来源箭头「←」叠放在副露顺子中吃到的那张牌正上方。
- **触发条件**：吃成立（MsgChowS）后 Mah2DView 执行 addCombo 并由 _refreshComboArrows 刷新箭头时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：副露顺子上方的来源箭头水平偏移，叠到被吃进那张牌的正上方。
- **限制与禁止**：无。
- **异常与边界**：无。
- **验收**：吃成立后副露组箭头位置等于中间槽基准叠加被吃牌槽位相对中间槽的偏移（arrow.x = base.x + (target.x - middle.x)），视觉上指向被吃的那张。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:938; source-code/client/Code/layer/BoxHzmjMah2DView.ts:947
- **服务端职责**：下发 MsgChowS（携带副露组合与进牌数据）。
- **客户端职责**：_refreshComboArrows 取副露项内 n4/n5 箭头节点，按进牌在展示序中的实际槽位（_resolveInMahSlot）相对中间槽位移位，使箭头指向吃到的那张。
- **协作边界**：客户端消费 MsgChowS 副露数据中的进牌信息；槽位解析与箭头偏移计算均为本地逻辑。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMah2DView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:938
- **原文摘录**：`const target = item.getChild("mah" + this._resolveInMahSlot(display, comboData));`

#### `AT-ST-C11-045` 碰成立三张正面展示

- **规则说明**：碰成立后，碰牌组三张牌都以正面展示。
- **触发条件**：服务端下发 MsgPungS 确认碰成立，GamePungCmd 生成副露数据并派发 setCombo 时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：碰杠区出现三张正面同值牌。
- **限制与禁止**：无。
- **异常与边界**：三张正面渲染实现在外部副露组件，本仓库仅能确认 setCombo 派发与 addCombo 调用链。
- **验收**：碰成立后对应座位碰杠区出现三张同值牌组（正面渲染由外部组件保证）。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:48
- **服务端职责**：下发 MsgPungS（确认碰成立并携带副露组合数据）。
- **客户端职责**：GamePungCmd 生成副露数据后派发 setCombo，Mah2DView 调 addCombo 并重刷箭头；三张正面由副露组件按组合类型渲染。
- **协作边界**：客户端消费 MsgPungS 生成副露并渲染；正面朝向由外部副露组件按组合类型处理。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:48
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.setCombo, localSeat, comboData, cards);`

#### `AT-ST-C11-046` 碰的箭头位置与方位指向

- **规则说明**：以来源视角，碰牌组来源箭头叠在中间一张牌上：来自上家用「←」、对家用「↑」、下家用「→」。
- **触发条件**：碰成立（MsgPungS）后 _refreshComboArrows 刷新副露箭头时。
- **配置影响**：箭头节点名随来源座位副露组件不同：comboSefl/comboRight/comboLeft 用 n4，comboOpposite 用 n5，朝向由 game_mah 包资源决定。
- **客户端交互**：碰牌组箭头始终叠在中间张，不同来源座位使用不同朝向箭头资源。
- **限制与禁止**：无。
- **异常与边界**：碰时（无进牌槽位或进牌即中间槽）_resolveInMahSlot 固定返回 1，箭头落在中间张；「上家←、对家↑、下家→」的朝向由 game_mah 包内 combo 资源决定，仓库内无「←↑→」文案定义。
- **验收**：碰成立后箭头叠在副露组中间张；不同来源座位的副露组件使用对应箭头资源（n4/n5）。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:960; source-code/client/Code/layer/BoxHzmjMah2DView.ts:935
- **服务端职责**：下发 MsgPungS（携带副露组合与来源座位数据）。
- **客户端职责**：_resolveInMahSlot 在碰（无进牌槽位或进牌即中间槽）时返回 1，箭头保持落在中间那张；箭头图形本身随座位副露组件资源不同（n4/n5），方向由资源包决定。
- **协作边界**：客户端消费 MsgPungS 副露数据；箭头槽位计算为本地逻辑，箭头朝向图形由外部资源包决定。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMah2DView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:960
- **原文摘录**：`if (inMah <= 0 || display[1] === inMah) {
            return 1;
        }`

#### `AT-ST-C11-047` 新牌组按成立顺序追加

- **规则说明**：吃、碰、直杠、暗杠新成立的牌组，按成立先后顺序在碰杠区从左往右追加。
- **触发条件**：吃（MsgChowS）、碰（MsgPungS）、杠（MsgKongS）成立，客户端走 addCombo/resetCombo 更新副露列表时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：碰杠区按成立先后依次增加牌组。
- **限制与禁止**：客户端本地不重排副露组合顺序。
- **异常与边界**：组合数组顺序完全来自服务端 combs/结算数据，左右排列布局由副露组件列表决定，仓库内无本地排序逻辑。
- **验收**：一局内连续多次吃/碰/杠后，碰杠区牌组顺序与服务端 combs 顺序一致，客户端未改变排列。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:878
- **服务端职责**：下发 MsgChowS、MsgPungS、MsgKongS（副露组合数据按成立顺序排列）。
- **客户端职责**：新组合统一走 addCombo 追加，组合数组顺序来自服务端 combs/结算数据；左右排列由副露组件的列表布局决定。
- **协作边界**：客户端消费服务端组合顺序数据渲染；顺序保持交给服务端数据，排列布局交给外部组件，本地不重排。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMah2DView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:878
- **原文摘录**：`resetCombo(localSeat: number, combos: ComboData[]): void {`

## `FP-ST-C11-011` 杠牌标记与补牌展示

- **主描述**：直杠用来源箭头、加杠标【补】、暗杠用手掌标记并叠在第 4 张；直杠暗杠新增一组，加杠补入原碰牌组沿用位置。
- **范围与边界**：覆盖 GameKongCmd 的 TKONG 分支与 setComboBuGang 调用；标记图形在外部副露组件。
- **总体协作**：MsgKongS → 按 comb.flag 分流：TKONG 走 setComboBuGang(带 nIdx)，其余走 setCombo 新增一组。

### 原子项

#### `AT-ST-C11-048` 直杠箭头加杠补暗杠手掌标记

- **规则说明**：直杠的杠组使用来源箭头标记，加杠标记为【补】，暗杠用手掌标记；标记均叠在杠牌组最上方居中的第 4 张牌上。
- **触发条件**：服务端下发 MsgKongS，客户端按 comb.flag（MKONG/CKONG/TKONG）区分杠类型并驱动牌组更新时。
- **配置影响**：杠类型区分依据 MsgKongS 携带的 comb.flag（BoxMahDefine.CombType 的 MKONG/CKONG/TKONG）。
- **客户端交互**：杠组上方居中出现来源箭头、【补】或手掌标记（随杠类型不同）。
- **限制与禁止**：无。
- **异常与边界**：标记图形与「叠在第 4 张居中」的渲染实现在外部 Mah2DCombo_Box 组件，本仓库仅能确认按 flag 分流的调用链。
- **验收**：不同 comb.flag 的杠成立后，杠组上方居中出现对应类型标记（直杠来源箭头、加杠【补】、暗杠手掌）。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:63; source-code/client/Code/layer/BoxHzmjMah2DView.ts:910
- **服务端职责**：下发 MsgKongS（携带 comb.flag 区分杠类型与组合数据）。
- **客户端职责**：杠类型由 MsgKongS 的 comb.flag（MKONG/CKONG/TKONG）区分并驱动牌组更新，标记图形与第 4 张叠放位置由 Mah2DCombo_Box 组件实现。
- **协作边界**：客户端消费 MsgKongS 的 comb.flag 分流处理；标记图形与叠放位置由外部副露组件渲染。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:63
- **原文摘录**：`if (data.comb?.flag == BoxMahDefine.CombType.CMF_TKONG) {`

#### `AT-ST-C11-049` 直杠暗杠新增组加杠补入原组

- **规则说明**：直杠、暗杠在碰杠区新增一组杠牌；加杠补入原碰牌组，沿用原组位置不变。
- **触发条件**：服务端下发 MsgKongS 后，GameKongCmd 按 comb.flag 分流：TKONG（加杠）派发 setComboBuGang，MKONG/CKONG（直杠/暗杠）派发 setCombo。
- **配置影响**：加杠补入原组依据 comboData.nIdx 原组索引，缺省时按 0 处理。
- **客户端交互**：补杠时原碰牌组原地变为杠组、位置不变；直杠/暗杠在碰杠区末尾新增一组。
- **限制与禁止**：无。
- **异常与边界**：comboData.nIdx 缺省时回退为 0（comboData?.nIdx ?? 0）。
- **验收**：加杠成立后原碰牌组位置不变并扩为杠组；直杠/暗杠成立后碰杠区新增独立一组。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:64; source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:72
- **服务端职责**：下发 MsgKongS（携带 comb.flag 与加杠原组索引 nIdx）。
- **客户端职责**：GameKongCmd 对 TKONG 派发 setComboBuGang（携带 comboData.nIdx 原组索引）走补入原组；MKONG/CKONG 派发 setCombo 走新增一组。
- **协作边界**：客户端消费 MsgKongS 的 flag/nIdx 决定补入原组或新增一组；派发分流为本地逻辑。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:64
- **原文摘录**：`this.dispatch(
                GameEventBoxHzmj.setComboBuGang,
                localSeat,
                comboData,
                comboData?.nIdx ?? 0,`

#### `AT-ST-C11-050` 补牌落入最右分隔位

- **规则说明**：杠后补牌落入手牌最右侧的分隔位，可与「杠」字效同时出现。
- **触发条件**：杠成立（MsgKongS）后服务端下发补牌 MsgTake，客户端走 setTakeMah → moMah 渲染末张时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：补牌出现在手牌最右侧分隔位置。
- **限制与禁止**：无。
- **异常与边界**：「可与『杠』字同时出现」未找到对应控制逻辑；isTouchDanFang 以 moCard 判定末张是否为真单放。
- **验收**：杠后补牌渲染在手牌最右单放分隔位，isTouchDanFang 判定结果与 moCard 一致。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:123
- **服务端职责**：杠后下发 MsgKongS 并接续 MsgTake（补牌数据）。
- **客户端职责**：摸牌/补牌统一走 setTakeMah → moMah，末张以「单放」位渲染；isTouchDanFang 用 moCard 判定该末张是否为真单放，说明补牌固定落在手牌最右的独立分隔槽。
- **协作边界**：客户端消费 MsgTake 补牌数据；单放分隔位渲染与 moCard 判定为本地逻辑。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:123
- **原文摘录**：`isTouchDanFang(mahValue: number): boolean {
        const moCard = GameData.getPlayerCardsData(SELF_LOCAL_SEAT)?.moCard ?? 0;`

#### `AT-ST-C11-051` 连续杠新字效覆盖上一个

- **规则说明**：连续杠时，新播放的「杠」字效覆盖仍在播放的上一个「杠」字。
- **触发条件**：同一座位上一次杠字效仍在播放时，再次收到 MsgKongS 触发新字效。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：同一方位不会叠加出现两个「杠」字。
- **限制与禁止**：无。
- **异常与边界**：代码未显式 stop 上一段 Spine 动画，覆盖依赖按座位单节点复用（改写同一节点 skinName/url 并置 visible）；若上一段未结束可能短暂叠加。
- **验收**：同一座位连续两次杠时，第二次字效改写同一节点，不出现两个并存「杠」字节点。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:524
- **服务端职责**：下发 MsgKongS（触发杠字效）。
- **客户端职责**：字效按座位单节点复用，每次动作直接改写同一节点的 skinName/url 并置 visible，再播 Spine 动画，因此新杠字共用节点覆盖旧表现。
- **协作边界**：客户端消费 MsgKongS 触发字效；节点复用覆盖机制为本地实现。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjTipAniView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:524
- **原文摘录**：`actionAniNode.skinName = actionSkinName;
        actionAniNode.visible = true;`

## `FP-ST-C11-012` 动作字效与胡牌结束表现

- **主描述**：吃碰杠胡成立在操作者方位播对应字效；胡牌后显示对局结束提示、亮出各家手牌并标记胡牌张、方位标识与飘分颜色。
- **范围与边界**：覆盖 TipAniView 动作字效、GameEnd 标识、GameResultHuCmd 摊牌与 onShowScore 颜色。
- **总体协作**：各命令派发 onMsgPlayPengGang/onMsgPlayHuNew → TipAniView 播字效；MsgResultHu → playHuEnd 摊牌 + onShowGameEndType 显示结束标识 + onShowScore 飘分。

### 原子项

#### `AT-ST-C11-052` 吃碰杠胡在操作者方位播字效

- **规则说明**：吃、碰、杠、胡成立时，在操作者对应座位方位播放对应的动作字效。
- **触发条件**：吃（MsgChowS）、碰（MsgPungS）、杠（MsgKongS）成立派发 onMsgPlayPengGang；胡（MsgHuEx/MsgResultHu）成立派发 onMsgPlayHuNew。
- **配置影响**：字效皮肤按 ActionAniType 选择（chi/peng/gang/piao），胡牌在 KW_Ani_Hu 节点按番型选 hu/zimo 皮肤，并伴随 ActionSoundKey 对应音效。
- **客户端交互**：字效出现在操作者座位对应方位的节点上，带对应音效。
- **限制与禁止**：无。
- **异常与边界**：无。
- **验收**：吃碰杠胡各自成立后，操作者方位节点播放对应皮肤字效（chi/peng/gang/piao、hu/zimo）并播放对应动作音效。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:496; source-code/client/Code/layer/BoxHzmjTipAniView.ts:984
- **服务端职责**：下发 MsgChowS、MsgPungS、MsgKongS、MsgHuEx、MsgResultHu（触发对应动作与胡牌字效）。
- **客户端职责**：onMsgPlayPengGang 按 ActionAniType 选 chi/peng/gang/piao 皮肤在 _pengGangAni[座位] 节点播放；胡牌走 onMsgPlayHuNew/KW_Ani_Hu 按番型选 hu/zimo 皮肤。
- **协作边界**：客户端消费各成立消息触发字效；皮肤选择、座位节点定位与音效播放为本地逻辑。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjTipAniView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:496
- **原文摘录**：`case BoxMahDefine.ActionAniType.TYPE_CHOW:
                GameSoundController.instance.playActionSound(ActionSoundKey.CHI, undefined, sex ?? 0);
                actionSkinName = "chi";`

#### `AT-ST-C11-053` 自摸后对局结束并亮牌

- **规则说明**：自摸确认后显示「对局结束」提示，并亮出各家手牌；胡牌张单独摆在胡牌者手牌右侧。
- **触发条件**：自摸确认，服务端下发 MsgResultHu（或 MsgHuEx）后，GameResultHuCmd 派发 playHuEnd 与 onShowGameEndType。
- **配置影响**：结束标识类型由 TipAniView 的 KW_Main.C_GameEnd 控制器 selectedIndex 切换。
- **客户端交互**：各座位亮牌，本家手牌缩放靠左让位；结束标识在桌面中央播一次。
- **限制与禁止**：无。
- **异常与边界**：差异：模板要求胡牌张「单独摆在手牌右侧」，代码统一 push 到手牌尾端（右侧末位），未做独立牌位；「对局结束」为 C_GameEnd 美术图标，仓库内无该文本。
- **验收**：自摸确认后桌面显示结束标识（C_GameEnd 切页）、各座位手牌翻开、胡牌张出现在胡牌者手牌尾端。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:303; source-code/client/Code/layer/BoxHzmjMah2DView.ts:1057; source-code/client/Code/layer/BoxHzmjTipAniView.ts:1186
- **服务端职责**：下发 MsgResultHu、MsgHuEx（携带胡牌结果、胡牌张与结束类型）。
- **客户端职责**：MsgResultHu 时派发 onShowGameEndType 显示结束标识，并派发 playHuEnd 把手牌全部翻开、胡牌张 push 到手牌末尾展示；本家手牌缩小靠左。
- **协作边界**：客户端消费 MsgResultHu 结算数据；摊牌、胡牌张摆位、结束标识切换均为本地表现逻辑。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:303
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.playHuEnd);`

#### `AT-ST-C11-054` 点炮抢杠亮牌与胡牌张标记

- **规则说明**：点炮胡、抢杠胡同样显示「对局结束」并亮牌；胡牌张摆在胡牌者手牌尾端，带浅绿描边和来源箭头。
- **触发条件**：点炮胡/抢杠胡成立（MsgResultHu/MsgHuEx 下发且胡牌来源为他人）后执行 setHu 摊牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：胡牌张显示在手牌尾端并标记来源方位；放铳方牌河移除最后一张弃牌。
- **限制与禁止**：无。
- **异常与边界**：「浅绿描边」无代码/资源常量证据，仅能确认胡牌张尾端位置与来源标记；牌河浮标由 outs 组件管理。
- **验收**：点炮/抢杠胡后胡牌张出现在胡牌者手牌尾端并带来源座位标记（setHuFromSeat），放铳方河牌最后一张被移除。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:984; source-code/client/Code/layer/BoxHzmjMah2DView.ts:987
- **服务端职责**：下发 MsgResultHu、MsgHuEx（携带胡牌张与来源座位）。
- **客户端职责**：setHu 把手牌与胡牌张合并重置并设置胡牌来源座位 setHuFromSeat；点炮时移除放铳方河牌最后一张，牌河浮标由 outs 组件管理。
- **协作边界**：客户端消费 MsgResultHu 的胡牌张与来源数据；手牌合并、来源标记与河牌移除为本地表现逻辑。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMah2DView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:984
- **原文摘录**：`this.resetHandCards(localSeat, cards.concat(huValue));`

#### `AT-ST-C11-055` 赢家方位番型与放铳者点炮标识

- **规则说明**：胡牌结算时赢家方位显示番型，放铳者方位显示「点炮」。
- **触发条件**：胡牌结算（MsgResultHu）后 onShowResultTableSign 按 ResultTableSign 刷新各座位方位标识。
- **配置影响**：方位标识页面由 HuIndex 组件 C_HuType 控制器页面表配置（0 未叫嘴、8 叫嘴、9 点炮、10 吃胡、11 自摸）。
- **客户端交互**：胡牌者方位显示自摸/吃胡图，放铳者方位显示「点炮」图标。
- **限制与禁止**：无。
- **异常与边界**：「赢家方位显示番型」未在方位标识中直接体现——番型文案在小结算流水与 CPS 动画里展示，方位标识只区分自摸/吃胡/点炮。
- **验收**：结算后胡牌者方位 C_HuType 切到自摸/吃胡页，放铳者方位切到「点炮」页（index 9）。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1667; source-code/client/Fgui/assets/box_hzmj_main/component/HuIndex.xml:3; source-code/client/Code/config/GameDefine.ts:413
- **服务端职责**：下发 MsgResultHu（携带胡牌类型与放铳者信息）。
- **客户端职责**：桌面方位标识由 onShowResultTableSign 按 ResultTableSign（未叫嘴/叫嘴/点炮/吃胡/自摸）切 HuIndex 控制器页；番型文案在小结算流水与 CPS 动画里展示。
- **协作边界**：客户端消费 MsgResultHu 结算数据；方位标识切页为本地逻辑，番型文案展示在小结算与 CPS 动画侧。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1667
- **原文摘录**：`this._huIndex[localSeat].C_HuType.selectedIndex = sign;`

#### `AT-ST-C11-056` 按座位飘分正分黄色负分灰色

- **规则说明**：胡牌结算随后按座位飘分，正分数字为黄色，负分数字为灰色。
- **触发条件**：胡牌结算（MsgResultHu）后 onShowScore 逐座位在 _resultScoreNode 播放飘分时。
- **配置影响**：正负分颜色由 fnt_win（正分黄色）/fnt_lose（负分灰色）两张字体资源决定，仓库内无颜色值常量。
- **客户端交互**：各座位飘分数字正分为黄色字效、负分为灰色字效，带飘出动画，完整动画时正分补「+」号。
- **限制与禁止**：无。
- **异常与边界**：颜色由 fnt_win/fnt_lose 字体资源决定，仓库内无颜色值常量。
- **验收**：结算飘分时 score>=0 的座位用 fnt_win 字体（完整动画带「+」号），score<0 的座位用 fnt_lose 字体。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:567; source-code/client/Code/layer/BoxHzmjTipAniView.ts:565
- **服务端职责**：下发 MsgResultHu（携带各座位结算分数）。
- **客户端职责**：onShowScore 按分数正负切换数字字体：score>=0 用 fnt_win，否则用 fnt_lose；正分在完整动画时补「+」号，逐座位在 _resultScoreNode 上播放。
- **协作边界**：客户端消费 MsgResultHu 分数数据；正负判断、字体切换与飘分动画为本地逻辑。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjTipAniView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:567
- **原文摘录**：`node.KW_ScoreCom.KW_Score.font =
            score >= 0
                ? fgui.UIPackage.getItemURL(PackageBoxHzmjView.PackageBoxHzmjTipAni, "fnt_win")
                : fgui.UIPackage.getItemURL(PackageBoxHzmjView.PackageBoxHzmjTipAni, "fnt_lose");`