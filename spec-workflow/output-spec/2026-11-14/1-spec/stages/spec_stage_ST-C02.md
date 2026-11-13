# 财神与牌组

> 阶段 ID：`ST-C02`。来源：模板「开局 > 财神与牌组」章节。客户端视角规格，客户端逻辑与 UI 交互以 Code/Fgui 代码证据支撑。

## 0. 阶段

- **阶段 ID**：`ST-C02`
- **阶段**：财神与牌组
- **来源章节**：开局 > 财神与牌组
- **涉及协议消息**：MsgStartGame、MsgJoker、MsgPlayC、MsgPlayLmts、MsgPlayS、MsgPower、MsgChowS、MsgChowC、MsgPungS、MsgPungC、MsgKongS、MsgKongC、MsgResultHu
- **涉及 UI 模块**：主界面 box_hzmj_main（手牌区 BoxHzmjPlayerHandCards、牌河区 BoxHzmjMah2DView、出牌放大与操作按钮区 Handler）、桌面财神牌组件 BoxHzmjMahLeftComp
- **阶段概述**：确定本局牌组为 136 张（万条筒各 36、风 16、箭 12），白板固定为财神且四张白板都算财神；轮到出牌时可主动打出财神，打出后按普通白板留在牌河，其他玩家不得吃碰杠，也不能用它点炮胡。

## 术语与单位

| 术语 | 定义 | 单位/量纲 | 作用域 | 来源 |
| --- | --- | --- | --- | --- |
| 财神 | 白板固定为财神。只在胡牌判定时代替顺子、刻子或对子所缺的牌；吃、碰、杠必须使用真实的非财神牌，不能用财神牌，也不能用财神代替所缺的牌。 | 牌值/张 | 全局（本局） | 模板名词章节（第 12 行） |
| 白板 | 箭牌中的白板，牌值为 83；在本玩法中固定充当财神，四张白板都算财神。 | 牌值 83/张 | 全局（本局） | 模板名词章节（第 12 行）；代码 source-code/client/Code/config/BoxMahDefine.ts:81-82 |
| 牌河 | 每位玩家打出的牌按顺序摆放的区域，客户端由出牌区列表（outs）承载；出牌后逐张追加，并会重新刷新牌面染色。 | 区域/张 | 出牌阶段 | 代码 source-code/client/Code/layer/BoxHzmjMah2DView.ts:851-857、1091-1095 |
| 飘 | 自己出牌阶段打出一张财神，即飘财 1 次。连续打出财神则累加，打出普通牌清零，每小局从 0 次起算。 | 次 | 每小局 | 模板名词章节（第 18 行）；代码 source-code/client/Code/config/BoxMahDefine.ts:238 |

## 跨切面行为

- **财神数据来源**：财神牌值与财神类型完全由服务端下发（MsgJoker 的 jokers/open），客户端不自造财神；白板财神模式直接展示桌面财神牌，翻财神模式才播放翻牌动效 —— 跨切面（source-code/client/Code/data/GameData.ts:46-51、source-code/client/Code/controller/cmd/gameCmd/GameJokerCmd.ts:40）
- **财神统一染色**：客户端对所有"牌值等于财神牌"的牌统一刷财神红 #ffc4c4（手牌、牌河、副露、胡牌列表、出牌放大），并支持打出财神的专属语音与飘计数动效 —— 跨切面（source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:64-68、source-code/client/Code/util/BoxHzmjMahColorUtil.ts:17-29、source-code/client/Code/layer/BoxHzmjMah2DView.ts:1127-1132）
- **出牌合法性判定**：出牌合法性以服务端 MsgPlayLmts 的 hands/dang_fang 为准，客户端只做灰化与"该牌被禁打"拦截，没有针对财神的额外禁打逻辑 —— 跨切面（source-code/client/Code/data/GameData.ts:1789-1803、source-code/client/Code/layer/BoxHzmjMainView.ts:1428-1435）
- **操作按钮权限驱动**：吃、碰、杠、胡、过按钮完全由服务端 MsgPower 权限位驱动，客户端不自行判断打出的牌能否被吃碰杠或点炮胡 —— 跨切面（source-code/client/Code/layer/BoxHzmjMainView.ts:549-560）

## `FP-ST-C02-001` 牌组构成（136 张）

- **主描述**：本局使用标准 136 张牌：万、条、筒三门数牌各 36 张，东南西北风牌 16 张，中发白箭牌 12 张。
- **范围与边界**：仅覆盖牌值集合与每种牌 4 张的定义，不覆盖洗牌、掷骰、发牌顺序等流程。
- **总体协作**：客户端按牌值集合初始化记牌器（每种 4 张），棋墙总张数取服务端下发的开局牌墙数，两者共同支撑牌组展示与剩余张数计算。

### 原子项

#### `AT-ST-C02-001` 万条筒各 36 张

- **规则说明**：136 张牌中，万、条、筒三门数牌各 36 张（每门 9 种牌值，每种 4 张）。客户端配置层定义三门牌值集合（万、条、筒各 9 个牌值），数据层按每种牌值 4 张初始化记牌器；牌墙总张数取服务端开局下发值。
- **触发条件**：一局开始、发牌并启用记牌显示时，客户端为每门九种牌各记四张基数。
- **配置影响**：配置层以 BoxMahDefine.MahValueWan/MahValueTiao/MahValueTong 定义三门牌值集合（各 9 个牌值，如万 17~25、条 33~41、筒 49~57），作为记牌器初始化来源。
- **客户端交互**：记牌器按每种牌初始 4 张显示剩余张数，随出牌与副露递减。
- **限制与禁止**：记牌基数固定按每种牌值 4 张计，不因房间规则变化。
- **异常与边界**：客户端未硬编码"136"常量，牌墙总数由开局消息下发；136 是由 34 种牌值乘 4 张推得。
- **验收**：一局开始后，记牌器中万、条、筒三门各 9 种牌值均显示初始 4 张；出牌、吃碰杠后对应牌值计数递减；三门数牌合计 108 张，与"数牌108"的构成一致。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/BoxMahDefine.ts:320-332；source-code/client/Code/config/BoxMahDefine.ts:337-349；source-code/client/Code/config/BoxMahDefine.ts:354-366；source-code/client/Code/data/GameData.ts:1470-1475
- **服务端职责**：下发 MsgStartGame（开局数据，客户端牌墙总张数取开局下发值）。
- **客户端职责**：配置层定义万、条、筒三门的牌值集合（各 9 个牌值），数据层按每种牌值 4 张初始化记牌器；牌墙总张数取服务端开局下发值。
- **协作边界**：客户端本地按牌值集合与每种 4 张初始化记牌器，牌墙总张数消费服务端 MsgStartGame 开局下发值。
- **来源文件**：`source-code/client/Code/config/BoxMahDefine.ts`
- **来源定位**：source-code/client/Code/config/BoxMahDefine.ts:590-593
- **原文摘录**：`杭州麻将 136 张：数牌108 + 风16 + 箭12`

#### `AT-ST-C02-002` 东南西北 16 张

- **规则说明**：136 张牌中，东南西北四张风牌共 16 张（4 种，每种 4 张）。客户端配置层定义东南西北四个牌值（65~68），数据层按每种 4 张计入记牌器。
- **触发条件**：一局开始、发牌并启用记牌显示时，客户端为东南西北各记四张基数。
- **配置影响**：配置层以 BoxMahDefine.MahValueFeng 定义东南西北四个牌值（65/66/67/68），作为记牌器风牌初始化来源。
- **客户端交互**：记牌器中东南西北各显示 4 张并可随打出递减。
- **限制与禁止**：记牌基数固定按每种风牌 4 张计。
- **异常与边界**：无。
- **验收**：一局开始后，记牌器中东南西北各显示初始 4 张；打出风牌后对应计数递减；四种风牌合计 16 张。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/GameData.ts:1476-1479；source-code/client/Code/config/BoxMahDefine.ts:592
- **服务端职责**：下发 MsgStartGame（开局数据，牌墙总数由开局消息下发）。
- **客户端职责**：配置层定义东南西北四个牌值，数据层按每种 4 张计入记牌器。
- **协作边界**：客户端本地初始化风牌记牌基数，牌墙总张数消费服务端下发值。
- **来源文件**：`source-code/client/Code/config/BoxMahDefine.ts`
- **来源定位**：source-code/client/Code/config/BoxMahDefine.ts:371-377
- **原文摘录**：`public static MahValueFeng: { [key: number]: number } = { [65]: 65, [66]: 66, [67]: 67, [68]: 68`

#### `AT-ST-C02-003` 中发白 12 张

- **规则说明**：136 张牌中，中、发、白三张箭牌共 12 张（3 种，每种 4 张）。客户端配置层定义中、发、白三个牌值（81/82/83），数据层按每种 4 张计入记牌器，其中白板 4 张进入牌组。
- **触发条件**：一局开始、发牌并启用记牌显示时，客户端为中发白各记四张基数。
- **配置影响**：配置层以 BoxMahDefine.MahValueJian 定义中发白三个牌值（81/82/83），箭牌枚举 JIAN_ZHONG=81、JIAN_FA=82、JIAN_BAI=83，作为记牌器箭牌初始化来源。
- **客户端交互**：记牌器中中、发、白各显示 4 张，白板随财神身份另有染色表现。
- **限制与禁止**：白板在牌组中按普通箭牌计 4 张，不因财神身份增减张数。
- **异常与边界**：白板的财神身份不改变其记牌计数，仅通过财神染色另行表现。
- **验收**：一局开始后，记牌器中中、发、白各显示初始 4 张；打出箭牌后对应计数递减；三种箭牌合计 12 张，其中四张白板为财神。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/BoxMahDefine.ts:661-667；source-code/client/Code/data/GameData.ts:1480-1482
- **服务端职责**：下发 MsgStartGame（开局数据，牌墙总数由开局消息下发）。
- **客户端职责**：配置层定义中、发、白三个牌值（81/82/83），数据层按每种 4 张计入记牌器，其中白板 4 张进入牌组。
- **协作边界**：客户端本地初始化箭牌记牌基数，白板的财神身份表现消费服务端 MsgJoker 下发的财神牌值。
- **来源文件**：`source-code/client/Code/config/BoxMahDefine.ts`
- **来源定位**：source-code/client/Code/config/BoxMahDefine.ts:381-386
- **原文摘录**：`public static MahValueJian: { [key: number]: number } = { [81]: 81, [82]: 82, [83]: 83`

## `FP-ST-C02-002` 白板为固定财神

- **主描述**：本局财神牌值固定为白板，四张白板全部具备财神身份，不因张数或具体某一张而改变。
- **范围与边界**：只覆盖"财神是白板、四张都算"这一身份判定，不覆盖财神作为万能牌参与胡牌判定的算法，也不覆盖翻财神玩法。
- **总体协作**：服务端下发财神数据后，客户端记录财神牌值、刷新桌面财神牌与财神染色，供手牌、牌河、副露、胡牌列表统一使用。

### 原子项

#### `AT-ST-C02-004` 财神牌值为白板

- **规则说明**：白板固定为财神，即本局财神牌值就是白板。客户端收到财神数据后记录本局财神牌值（优先取 MsgJoker.jokers[0]，否则取 open）与财神类型标记；白板财神模式下桌面财神牌直接以白板牌面展示，不播翻牌动效，翻财神模式才播动效。
- **触发条件**：本局开局确定财神时（收到 MsgJoker），且房间采用白板财神模式。
- **配置影响**：财神类型标记取自服务端下发（0=白板财神，1=翻财神）；是否播翻牌动效由房间规则 cai_shen_type 判定；BoxMahDefine.mahBai=83 为白板常用牌值。
- **客户端交互**：桌面财神牌位展示白板牌面；白板财神模式无翻牌动画，翻财神模式先隐藏桌面财神牌，待翻牌动画结束后再显示。
- **限制与禁止**：客户端不自造财神，财神牌值与财神类型完全由服务端下发，是否固定白板由服务端房间配置决定，客户端不写死。
- **异常与边界**：客户端同时支持"白板财神"和"翻财神"两种模式（以财神类型区分）；好友房是否固定下发白板无法由客户端代码证明。
- **验收**：白板财神模式下，开局确定财神后桌面财神牌位直接显示白板牌面且无翻牌动画；手牌、牌河等区域的白板统一带财神染色。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/BoxMahDefine.ts:81-82；source-code/client/Code/controller/cmd/gameCmd/GameJokerCmd.ts:40；source-code/client/Code/controller/cmd/gameCmd/GameJokerCmd.ts:77-79；source-code/client/Code/layer/comp/BoxHzmjMahLeftComp.ts:34-40
- **服务端职责**：下发 MsgJoker（含 jokers/open 财神牌值与财神类型标记）。
- **客户端职责**：收到财神数据后记录本局财神牌值（优先取财神列表首项，其次取翻出牌）与财神类型标记；白板财神模式下桌面财神牌直接以白板牌面展示，不播翻牌动效，翻财神模式才播动效。
- **协作边界**：客户端消费 MsgJoker 的 jokers/open 与财神类型，本地决定桌面财神牌展示方式与是否播翻牌动效。
- **来源文件**：`source-code/client/Code/data/GameData.ts`
- **来源定位**：source-code/client/Code/data/GameData.ts:46-51
- **原文摘录**：`本局财神牌值（优先取 MsgJoker.jokers[0]，否则取 open）；财神类型：0=白板财神，1=翻财神`

#### `AT-ST-C02-005` 四张白板都是财神

- **规则说明**：牌组中的四张白板全部都是财神，没有"某一张才算法财神"的区分。客户端财神判定只比较牌值是否等于本局财神牌值，因此牌值相同的四张白板全部被认定；手牌、牌河、副露、胡牌列表统一按该牌值刷财神颜色。
- **触发条件**：玩家手中、桌上出现白板牌时（本局财神牌值为白板）。
- **配置影响**：财神色值集合按本局财神牌值同步（_jokerColorValues 以 jokerMah 为键），无张数维度配置。
- **客户端交互**：手中任意一张白板都带财神红色标记（灰化的禁打优先于红色），财神牌可点击、无角标。
- **限制与禁止**：财神判定不做张数或具体某一张的区分，仅按牌值是否等于财神牌值比较。
- **异常与边界**：当该牌被服务端禁打时，灰化的禁打样式优先于财神红色显示。
- **验收**：本局财神确定后，手中每张白板均带同样的财神红色标记且可点击、无角标；被禁打时以灰化样式优先显示。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/GameData.ts:2005-2010；source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:64-68；source-code/client/Code/util/BoxHzmjMahColorUtil.ts:17-29
- **服务端职责**：下发 MsgJoker（本局财神牌值，作为统一判定依据）。
- **客户端职责**：财神判定只比较牌值是否等于本局财神牌值，因此牌值相同的四张白板全部被认定；手牌、牌河、副露、胡牌列表统一按该牌值刷财神颜色。
- **协作边界**：客户端消费 MsgJoker 确定的财神牌值，本地按牌值统一判定财神身份并染色。
- **来源文件**：`source-code/client/Code/data/GameData.ts`
- **来源定位**：source-code/client/Code/data/GameData.ts:1831-1836
- **原文摘录**：`return mah === jokerMah;`

## `FP-ST-C02-003` 财神的打出与弃牌限制

- **主描述**：轮到出牌时可主动打出财神，不要求已处于爆头状态；打出后该牌按普通白板留在牌河，其他玩家不能吃、碰、杠，也不能用它点炮胡。
- **范围与边界**：只覆盖财神弃牌的行为表现与不可响应限制，不覆盖打财神后的飘计数倍率、爆头/财飘结算与总分计算。
- **总体协作**：客户端出牌合法性取服务端禁打列表、操作按钮取服务端权限位、胡牌结果取服务端结算消息，三者共同决定财神弃牌后的可见反馈。

### 原子项

#### `AT-ST-C02-006` 轮到自己出牌时可打出财神

- **规则说明**：轮到自己出牌时可以打出财神，与普通牌一样作为弃牌打出。客户端出牌前校验只依据服务端下发的禁打列表判断该牌是否被禁；财神不做额外拦截，点击后直接以牌值上行出牌，并播放财神专属出牌语音。
- **触发条件**：轮到自己出牌并点击手牌中的白板财神，且该牌未被禁打、当前处于自己的出牌阶段。
- **配置影响**：出牌校验依据服务端 MsgPlayLmts 下发的禁打列表（hands/dang_fang），无针对财神的独立配置。
- **客户端交互**：财神在手牌中可点击抬起与打出；被服务端禁打时灰化并提示"该牌被禁打"；打出时播放财神专属语音与飘计数动效。
- **限制与禁止**：客户端没有针对财神的额外禁打拦截，禁打拦截仅来自服务端禁打列表。
- **异常与边界**：出牌语音中财神与 jokerMah 严格匹配（翻财神白板是替牌，不算打出财神）；服务端是否接受该弃牌、是否按飘计数处理，客户端代码无法证实。
- **验收**：轮到自己出牌时，未禁打的白板财神可点击抬起并打出，打出到自己前方牌河，同时听到财神出牌语音。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/GameData.ts:1789-1803；source-code/client/Code/controller/gameSoundController.ts:105-110；source-code/client/Code/controller/gameController.ts:424-435；source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:64-69
- **服务端职责**：下发 MsgPlayLmts（禁打列表）、MsgPlayS（出牌同步）；接收 MsgPlayC 出牌上行。
- **客户端职责**：出牌前校验只依据服务端下发的禁打列表判断该牌是否被禁；财神不做额外拦截，点击后直接以牌值上行出牌，并播放财神专属出牌语音。
- **协作边界**：客户端消费 MsgPlayLmts 禁打列表做本地拦截，通过 MsgPlayC 上行出牌，据 MsgPlayS 展示牌河与出牌表现。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1428-1435
- **原文摘录**：`// 禁打/出牌限制：必须在 playCard 藏牌之前拦截（区分手牌 / 单放） if (!GameData.canPlayCard(mahValue, this._lastPlayIsDanFang)) { this.dispatch(..., "该牌被禁打"...`

#### `AT-ST-C02-007` 打出财神不要求已爆头

- **规则说明**：打出财神没有前置状态限制，不要求玩家当前已经处于爆头状态。客户端出牌校验链路中不存在爆头状态前置判断，只校验禁打列表与操作按钮是否待过牌；爆头状态仅作为胡牌相关标记记录。
- **触发条件**：轮到自己出牌并点击白板财神，且玩家当前并未处于爆头状态。
- **配置影响**：爆头状态标记由服务端 MsgPower 胡牌权限位（POWER_ID_HU）驱动设置，本原子项无独立出牌前置配置。
- **客户端交互**：财神牌在任何出牌回合都可点击抬起，界面上没有因未爆头而禁打财神的提示或灰化。
- **限制与禁止**：客户端未设爆头门槛，不做"未爆头禁打财神"的拦截。
- **异常与边界**：有吃/碰/杠/胡操作按钮时不能直接出牌，必须先点"过"；仅有"客户端未设爆头门槛"的反向证据，无法据此确认服务端在非爆头状态下一定允许打出财神。
- **验收**：未爆头状态下轮到自己出牌时，白板财神仍可正常选中打出，界面无禁止提示；无操作按钮待处理时可直接出牌。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/GameData.ts:1789-1804；source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:93-95
- **服务端职责**：下发 MsgPlayLmts（禁打列表）、MsgPower（操作权限与胡牌相关爆头标记）。
- **客户端职责**：出牌校验链路中不存在爆头状态前置判断，只校验禁打列表与操作按钮是否待过牌；爆头状态仅作为胡牌相关标记记录。
- **协作边界**：客户端本地不做爆头前置校验，出牌合法性消费 MsgPlayLmts，操作按钮与爆头标记消费 MsgPower。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1429-1462
- **原文摘录**：`canPlayMahCheck(mahValue: number, state: WillPlayMahType): boolean { ... // 有吃/碰/杠/胡操作按钮时，不能直接出牌，必须先点"过"`

#### `AT-ST-C02-008` 打出后按普通白板留在牌河

- **规则说明**：财神打出后按普通白板的形态留在牌河，不再作为财神参与后续牌局。客户端出牌消息中的原始牌值直接追加到该玩家的牌河列表，牌河逐张追加后会统一重新刷新财神染色与出牌放大牌面。
- **触发条件**：自己或他人打出白板财神，该弃牌进入牌河时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：打出的白板进入牌河后仍被刷上财神红色高亮，其他玩家方向的出牌放大牌面同样带财神红色。
- **限制与禁止**：无。
- **异常与边界**：与需求存在明确冲突——牌面本身仍是白板牌图，但牌河与出牌放大牌面都会重新刷财神红，打出的白板财神仍被高亮标识为财神；该弃牌后续不可被响应的逻辑不可由客户端证实。
- **验收**：打出的白板出现在出牌者前方的牌河，牌面为白板牌图；注意实际表现会重新刷财神红色高亮，与"按普通白板展示"的表述存在冲突（见异常与边界）。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:1127-1132；source-code/client/Code/util/BoxHzmjMahColorUtil.ts:32-53；source-code/client/Code/layer/BoxHzmjMainView.ts:1044-1054
- **服务端职责**：下发 MsgPlayS（出牌同步，含原始牌值）。
- **客户端职责**：出牌消息中的原始牌值直接追加到该玩家的牌河列表，牌河逐张追加后会统一重新刷新财神染色与出牌放大牌面。
- **协作边界**：客户端消费 MsgPlayS 的原始牌值做牌河追加与统一染色，本地不判断该弃牌能否被响应。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMah2DView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:851-857
- **原文摘录**：`this.outs[localSeat].addMah(nMah, pos, (endPos) => { this._applyJokerColorToTable(); ... });`

#### `AT-ST-C02-009` 其他玩家不能吃打出的财神

- **规则说明**：其他玩家不能吃打出的白板财神。客户端吃牌按钮是否出现完全取决于服务端下发的操作权限位，吃牌结果由服务端吃牌消息驱动；客户端没有针对"弃牌是财神"的吃牌过滤逻辑。
- **触发条件**：有人打出白板财神后，其他玩家进入响应阶段。
- **配置影响**：吃牌按钮显隐由服务端 MsgPower 的 POWER_ID_CHOW 权限位驱动。
- **客户端交互**：有吃权限时显示"吃"按钮，无吃权限时隐藏；"吃"按钮位于操作区，与其他操作按钮共用同一排版。
- **限制与禁止**：客户端不做"弃牌是财神则禁吃"的本地过滤，禁吃属于服务端资格判定。
- **异常与边界**：客户端仅按权限位显示按钮，缺少服务端对财神弃牌不授予吃牌资格的证据。
- **验收**：有人打出白板财神后，其他玩家不会看到以这张白板财神为目标的吃牌按钮。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:577-585；source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:6-8；source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:26-34
- **服务端职责**：下发 MsgPower（吃牌权限位）、MsgChowS（吃牌结果）；接收 MsgChowC 上行。
- **客户端职责**：吃牌按钮是否出现完全取决于服务端下发的操作权限位，吃牌结果由服务端吃牌消息驱动；客户端没有针对"弃牌是财神"的吃牌过滤逻辑。
- **协作边界**：客户端消费 MsgPower 权限位控制吃按钮显隐、消费 MsgChowS 展示吃牌副露，本地无财神禁吃判定。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:549-560
- **原文摘录**：`showChi: (power & BoxMahDefine.PowerType.POWER_ID_CHOW) > 0,`

#### `AT-ST-C02-010` 其他玩家不能碰打出的财神

- **规则说明**：其他玩家不能碰打出的白板财神。客户端碰牌按钮是否出现取决于服务端操作权限位，碰牌结果由服务端碰牌消息驱动；客户端没有针对财神弃牌的碰牌过滤逻辑。
- **触发条件**：有人打出白板财神后，其他玩家进入响应阶段。
- **配置影响**：碰牌按钮显隐由服务端 MsgPower 的 POWER_ID_PONG 权限位驱动。
- **客户端交互**：有碰权限时显示"碰"按钮，无碰权限时隐藏；碰牌成功时播放碰牌动效并刷新副露。
- **限制与禁止**：客户端不做"弃牌是财神则禁碰"的本地过滤，禁碰属于服务端资格判定。
- **异常与边界**：客户端仅按权限位显示按钮，缺少服务端对财神弃牌不授予碰牌资格的证据。
- **验收**：有人打出白板财神后，其他玩家不会看到以这张白板财神为目标的碰牌按钮。
- **职责域**：client
- **职责依据**：source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:9-11；source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:26-34
- **服务端职责**：下发 MsgPower（碰牌权限位）、MsgPungS（碰牌结果）；接收 MsgPungC 上行。
- **客户端职责**：碰牌按钮是否出现取决于服务端操作权限位，碰牌结果由服务端碰牌消息驱动；客户端没有针对财神弃牌的碰牌过滤逻辑。
- **协作边界**：客户端消费 MsgPower 权限位控制碰按钮显隐、消费 MsgPungS 展示碰牌副露与动效，本地无财神禁碰判定。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:552-554
- **原文摘录**：`showChi: ..., showPeng: (power & BoxMahDefine.PowerType.POWER_ID_PONG) > 0,`

#### `AT-ST-C02-011` 其他玩家不能杠打出的财神

- **规则说明**：其他玩家不能杠打出的白板财神。客户端杠按钮是否出现取决于服务端操作权限位，杠牌结果由服务端杠牌消息驱动并区分明杠、暗杠、补杠；客户端没有针对财神弃牌的杠牌过滤逻辑。
- **触发条件**：有人打出白板财神后，其他玩家进入响应阶段。
- **配置影响**：杠牌按钮显隐由服务端 MsgPower 的 POWER_ID_KONG 权限位驱动。
- **客户端交互**：有杠权限时显示"杠"按钮及多杠选择面板，无杠权限时隐藏；杠成功后播放对应杠动效并刷新副露。
- **限制与禁止**：客户端不做"弃牌是财神则禁杠"的本地过滤，杠牌资格（含三摊承包或明杠资格）均在服务端。
- **异常与边界**：客户端仅按权限位显示按钮，缺少服务端对财神弃牌不授予杠牌资格的证据。
- **验收**：有人打出白板财神后，其他玩家不会看到以这张白板财神为目标的杠牌按钮。
- **职责域**：client
- **职责依据**：source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:12-14；source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:26-36
- **服务端职责**：下发 MsgPower（杠牌权限位）、MsgKongS（杠牌结果）；接收 MsgKongC 上行。
- **客户端职责**：杠按钮是否出现取决于服务端操作权限位，杠牌结果由服务端杠牌消息驱动并区分明杠、暗杠、补杠；客户端没有针对财神弃牌的杠牌过滤逻辑。
- **协作边界**：客户端消费 MsgPower 权限位控制杠按钮与多杠选择面板显隐、消费 MsgKongS 展示杠牌副露与动效，本地无财神禁杠判定。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:554-555
- **原文摘录**：`showGang: (power & BoxMahDefine.PowerType.POWER_ID_KONG) > 0, showHu: (power & BoxMahDefine.PowerType.POWER_ID_HU) > 0,`

#### `AT-ST-C02-012` 打出的财神不能点炮胡

- **规则说明**：打出的白板财神不能被其他玩家用来点炮胡，即它不作为点炮牌。客户端胡牌按钮是否出现取决于服务端操作权限位；点炮来源、胡牌类型与番型全部由服务端结算消息下发，客户端据此播放点炮动画与摊牌，没有针对财神弃牌的胡牌过滤逻辑。
- **触发条件**：有人打出白板财神后，其他玩家进入响应阶段。
- **配置影响**：胡牌按钮显隐由服务端 MsgPower 的 POWER_ID_HU 权限位驱动；点炮动画类型按结算消息的放炮座位判定（dfFrom 为 -1 是自摸，否则点炮）。
- **客户端交互**：有胡权限时显示"胡"按钮；胡牌后依据服务端给出的放炮座位播放点炮动画、胡牌特效与番型文字。
- **限制与禁止**：客户端不做"白板财神弃牌不可点炮胡"的本地判定，该限制属于服务端胡牌资格计算。
- **异常与边界**：客户端仅按权限位与结算数据表现，缺少服务端对白板财神弃牌不计算点炮胡的证据。
- **验收**：有人打出白板财神后，其他玩家不会看到以这张白板财神为炮牌的胡牌按钮与胡牌动画。
- **职责域**：client
- **职责依据**：source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:15-17；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:263-267；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:318-326；source-code/client/Code/config/BoxMahDefine.ts:207-208
- **服务端职责**：下发 MsgPower（胡牌权限位）、MsgResultHu（胡牌结算，含点炮来源、胡牌类型与番型）。
- **客户端职责**：胡牌按钮是否出现取决于服务端操作权限位；点炮来源、胡牌类型与番型全部由服务端结算消息下发，客户端据此播放点炮动画与摊牌，没有针对财神弃牌的胡牌过滤逻辑。
- **协作边界**：客户端消费 MsgPower 权限位控制胡按钮显隐、消费 MsgResultHu 结算数据播放点炮动画与番型表现，本地无财神点炮过滤。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:555
- **原文摘录**：`showHu: (power & BoxMahDefine.PowerType.POWER_ID_HU) > 0,`
