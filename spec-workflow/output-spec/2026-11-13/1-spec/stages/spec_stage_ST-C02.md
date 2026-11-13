# 财神与牌组

> 阶段 ID：`ST-C02`。来源：模板「开局 > 财神与牌组」章节。客户端视角规格，客户端逻辑与 UI 交互以 Code/Fgui 代码证据支撑。

## 0. 阶段

- **阶段 ID**：`ST-C02`
- **阶段**：财神与牌组
- **来源章节**：开局 > 财神与牌组
- **涉及协议消息**：MsgWallMah、MsgJoker、MsgPlayC、MsgPlayS、MsgPiao、MsgPower、MsgPlayLmts、MsgNotifyInfo、MsgChowS、MsgPungS、MsgKongS、MsgHuC、MsgHuEx、MsgResultHu
- **涉及 UI 模块**：BoxHzmjMainView、BoxHzmjJpqView、BoxHzmjPlayerHandCards、BoxHzmjTipAniView、BoxHzmjMah2DView、BoxHzmjMahColorUtil、BoxHzmjMahLeftComp
- **阶段概述**：规定杭州麻将 136 张牌组构成、白板即财神，以及自己回合可打出财神且该弃牌不可被吃碰杠、不可点炮胡。

## 术语与单位

| 术语 | 定义 | 单位/量纲 | 作用域 | 来源 |
| --- | --- | --- | --- | --- |
| 财神 | 白板固定为财神。只在胡牌判定时代替顺子、刻子或对子所缺的牌；吃、碰、杠必须用真实的非财神牌，不能用财神牌，也不能用财神代替所缺的牌。 | 张（按牌值等值判定，白板=83） | 整局（财神判定、排序与上色） | 模板 名词章节 第12行 |
| 爆头 | 摸牌前为 4 组面子加 1 张财神，下一张摸到任意牌即与这张财神组成对子后自摸，只能自摸。 | 状态（4 组面子加 1 张财神） | 单小局胡牌判定 | 模板 名词章节 第16行 |
| 飘 | 自己出牌阶段打出一张财神即飘财 1 次，连续打出财神则累加，打出普通牌清零，每小局从 0 次起算。 | 次（每小局从 0 起算） | 单小局出牌阶段 | 模板 名词章节 第18行 |
| 放铳 | 打出的牌被他人合法胡走；白板财神弃牌不能点炮胡。 | 次（胡牌事件） | 单小局胡牌判定 | 模板 名词章节 第19行 |
| jokerMah（财神牌值） | 客户端记录的财神牌值，来自 MsgJoker 的 jokers[0] 或 open，用于财神判定、手牌排序与上色。 | 牌值（白板财神模式下为 83） | 客户端对局数据（GameData） | source-code/client/Code/data/GameData.ts:1810-1814 |

## 跨切面行为

- **双财神模式并存**：客户端同时支持白板财神（cai_shen_type=0，白板即财神）与翻财神（cai_shen_type=1，翻出牌为财神、白板为固定替牌）两套模式，财神牌值一律由服务端 MsgJoker 下发，影响手牌排序、副露排序、语音播报与翻财神动效 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GameJokerCmd.ts:58）。
- **财神色统一作用域**：财神色 #ffc4c4 统一作用于手牌、牌河、副露、胡牌列表和桌面财神位，且同牌高亮（绿/蓝）优先 —— 跨切面（source-code/client/Code/util/BoxHzmjMahColorUtil.ts:29；source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:64）。
- **重连恢复先财神后手牌**：重连恢复要求先恢复财神再恢复手牌（SceneActionCmd 注释：sortCards 依赖 jokerMah），否则重连后财神不会靠左 —— 跨切面（SceneActionCmd 注释，无行号证据）。
- **飘计数消息链路**：打出财神后服务端下发 MsgPiao 更新飘计数，驱动座位飘 Spine 动画与手牌“飘”听牌标识；财飘回合的出牌限制由服务端 MsgPlayLmts 与 MsgNotifyInfo 表达 —— 跨切面（source-code/client/Code/layer/BoxHzmjTipAniView.ts:517；source-code/client/Code/controller/cmd/gameCmd/GameNotifyInfoCmd.ts:62）。
- **吃碰杠胡合法性服务端裁决**：吃碰杠胡的合法性完全由服务端 MsgPower/MsgChowS/MsgPungS/MsgKongS 决定，客户端不做财神牌相关的本地校验 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:93）。

## `FP-ST-C02-001` 牌组构成（136 张与花色张数）

- **主描述**：整副牌 136 张：万、条、筒各 36 张，东南西北 16 张，中发白 12 张。客户端以 34 种牌各 4 张的牌值表与记牌器模型表达。
- **范围与边界**：仅覆盖牌张总数与各花色张数，不含发牌张数、牌墙剩余数、流局阈值。
- **总体协作**：牌值域由 BoxMahDefine 维护（万/条/筒各 9 种、风 4 种、箭 3 种），记牌器按每种 4 张初始化；运行期牌墙总数以 MsgWallMah.wall_left 为准。

### 原子项

#### `AT-ST-C02-001` 整副牌共 136 张

- **规则说明**：整副牌共 136 张，即万、条、筒各 36 张，东南西北 16 张，中发白 12 张。
- **触发条件**：对局初始化（GameData 初始化）时设置牌墙总数 136 并初始化记牌器；运行期收到 MsgWallMah 时以 wall_left 覆盖牌墙总数。
- **配置影响**：BoxMahDefine 维护牌值域（万/条/筒各 9 种、风 4 种、箭 3 种，共 34 种），记牌器按每种 4 张初始化；136 为 GameData 初始化默认值。
- **客户端交互**：长按桌面可弹出记牌器（BoxHzmjJpqView），展示各牌剩余张数。
- **限制与禁止**：无。
- **异常与边界**：客户端运行期牌墙总数以服务端 wall_left 为准，136 只是初始化默认值；BoxMahDefine.MahValues 仍保留 8 张花牌（97-104），但记牌器初始化不含花牌。
- **验收**：对局初始化后记牌器覆盖 34 种牌值且每种 4 张（合计 136 张），长按桌面弹出记牌器（BoxHzmjJpqView）并展示各牌剩余张数；收到 MsgWallMah 后牌墙总数随 wall_left 更新。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/BoxMahDefine.ts:592；source-code/client/Code/data/GameData.ts:1470；source-code/client/Code/controller/cmd/gameCmd/GameWallMahCmd.ts:32；source-code/client/Code/layer/BoxHzmjMainView.ts:287
- **服务端职责**：下发 MsgWallMah（wall_left 指定运行期牌墙剩余数），运行期牌墙总数以服务端为准。
- **客户端职责**：GameData 初始化时把牌墙总数设为 136，并按万/条/筒/风/箭每种 4 张初始化记牌器（34 种 ×4 = 136）；运行期由 MsgWallMah.wall_left 覆盖总数。
- **协作边界**：客户端本地表达 34 种牌的牌值域与记牌器初始张数；运行期牌墙总数与剩余张数以服务端 MsgWallMah.wall_left 为准，136 仅为初始化默认值。
- **来源文件**：source-code/client/Code/data/GameData.ts
- **来源定位**：source-code/client/Code/data/GameData.ts:188
- **原文摘录**：`this.maxWallNum = 136; // 杭州麻将：万条筒108 + 东南西北16 + 中发白12`

#### `AT-ST-C02-002` 万、条、筒各 36 张

- **规则说明**：万、条、筒各 36 张，即三种数牌花色各含 9 种牌值、每种 4 张。
- **触发条件**：记牌器初始化时对 MahValueWan/MahValueTiao/MahValueTong 各 9 个牌值分别置 4 张。
- **配置影响**：BoxMahDefine.MahValueWan/MahValueTiao/MahValueTong 各定义 9 个牌值，记牌器对每种牌值初始化 4 张。
- **客户端交互**：无独立 UI 交互，万/条/筒张数经记牌器（BoxHzmjJpqView）随各牌剩余张数体现。
- **限制与禁止**：无。
- **异常与边界**：代码以“9 个牌值 ×4 张”表达每花色 36 张，未出现 36 的常量。
- **验收**：记牌器初始化后万、条、筒各 9 种牌值且每种 4 张，每花色合计 36 张。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/BoxMahDefine.ts:337；source-code/client/Code/config/BoxMahDefine.ts:354；source-code/client/Code/data/GameData.ts:1484
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：BoxMahDefine 定义 MahValueWan/MahValueTiao/MahValueTong 各 9 个牌值，记牌器对每种牌值初始化 4 张，合计每花色 36 张。
- **协作边界**：万/条/筒牌值域与张数由客户端本地配置表达，无服务端消息参与。
- **来源文件**：source-code/client/Code/config/BoxMahDefine.ts
- **来源定位**：source-code/client/Code/config/BoxMahDefine.ts:323
- **原文摘录**：`[17]: 17, [18]: 18, [19]: 19, [20]: 20, [21]: 21, [22]: 22, [23]: 23, [24]: 24, [25]: 25,`

#### `AT-ST-C02-003` 东南西北共 16 张

- **规则说明**：东南西北 16 张，即四种风牌各 4 张。
- **触发条件**：记牌器初始化时对 MahValueFeng 的东(65)/南(66)/西(67)/北(68) 四个牌值分别置 4 张。
- **配置影响**：BoxMahDefine.MahValueFeng 定义东(65)/南(66)/西(67)/北(68) 四个牌值，记牌器每种初始化 4 张。
- **客户端交互**：无独立 UI 交互，风牌张数经记牌器（BoxHzmjJpqView）随各牌剩余张数体现。
- **限制与禁止**：无。
- **异常与边界**：无。
- **验收**：记牌器初始化后东南西北四个牌值且每种 4 张，合计 16 张。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/BoxMahDefine.ts:373；source-code/client/Code/data/GameData.ts:1477
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：BoxMahDefine.MahValueFeng 定义东(65)/南(66)/西(67)/北(68) 四个牌值，记牌器每种初始化 4 张，合计 16 张。
- **协作边界**：风牌牌值域与张数由客户端本地配置表达，无服务端消息参与。
- **来源文件**：source-code/client/Code/config/BoxMahDefine.ts
- **来源定位**：source-code/client/Code/config/BoxMahDefine.ts:371
- **原文摘录**：`public static MahValueFeng: { [key: number]: number } = {`

#### `AT-ST-C02-004` 中发白共 12 张

- **规则说明**：中发白 12 张，即三种箭牌各 4 张。
- **触发条件**：记牌器初始化时对 MahValueJian 的中(81)/发(82)/白(83) 三个牌值分别置 4 张。
- **配置影响**：BoxMahDefine.MahValueJian 定义中(81)/发(82)/白(83) 三个牌值，记牌器每种初始化 4 张。
- **客户端交互**：无独立 UI 交互，箭牌张数经记牌器（BoxHzmjJpqView）随各牌剩余张数体现。
- **限制与禁止**：无。
- **异常与边界**：无。
- **验收**：记牌器初始化后中发白三个牌值且每种 4 张，合计 12 张。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/BoxMahDefine.ts:383；source-code/client/Code/data/GameData.ts:1480
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：BoxMahDefine.MahValueJian 定义中(81)/发(82)/白(83) 三个牌值，记牌器每种初始化 4 张，合计 12 张。
- **协作边界**：箭牌牌值域与张数由客户端本地配置表达，无服务端消息参与。
- **来源文件**：source-code/client/Code/config/BoxMahDefine.ts
- **来源定位**：source-code/client/Code/config/BoxMahDefine.ts:381
- **原文摘录**：`public static MahValueJian: { [key: number]: number } = {`

## `FP-ST-C02-002` 白板财神认定

- **主描述**：四张白板都是财神；客户端以服务端下发的财神牌值统一判定与上色，白板财神模式下财神牌值即白板(83)。
- **范围与边界**：覆盖财神身份认定与财神表现，不含财神在胡牌判定中的替牌算法（属胡牌阶段）。
- **总体协作**：GameJokerCmd 接 MsgJoker 写入 GameData.jokerMah 并派发 onUpdateJoker/onFanJokerAni；MahColorUtil 与手牌组件按 jokerMah 上财神色。

### 原子项

#### `AT-ST-C02-005` 白板固定为财神

- **规则说明**：白板固定为财神，即财神身份固定落在白板牌值上；客户端财神牌值以服务端 MsgJoker 下发的 jokerMah 为准，白板财神模式下即白板(83)。
- **触发条件**：服务端下发 MsgJoker 时，客户端把 jokers[0] 或 open 写入 GameData.jokerMah，作为全局财神牌值。
- **配置影响**：财神模式由 cai_shen_type 区分：0 为白板财神（jokerOpen=0 时白板 83 排最左），1 为翻财神（翻出牌为财神、白板为固定替牌）；财神牌值不写死为白板。
- **客户端交互**：手牌、牌河、副露、胡牌列表中的财神牌统一染财神色 #ffc4c4（可点击、无角标）；桌面财神位（KW_LEFT_MAHS/BoxHzmjMahLeftComp）展示财神牌面。
- **限制与禁止**：无（模板描述白板固定，客户端未对财神模式做本地限定，见异常与边界）。
- **异常与边界**：客户端同时存在白板财神与翻财神两种模式（MatchTipConfig 亦写“杭州麻将支持白板财神和翻财神两种模式”），财神非硬编码白板；模板只描述白板固定，需确认是否限定财神模式。
- **验收**：白板财神模式（cai_shen_type=0）下 jokerMah=83，手牌、牌河、副露、胡牌列表中的白板染财神色 #ffc4c4，桌面财神位展示白板牌面；财神牌值随 MsgJoker 下发更新，翻财神模式下随翻出牌变化。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/GameData.ts:1814；source-code/client/Code/data/PlayerCardsData.ts:317；source-code/client/Code/util/BoxHzmjMahColorUtil.ts:29；source-code/client/Code/controller/cmd/gameCmd/GameJokerCmd.ts:58
- **服务端职责**：下发 MsgJoker（jokers[0] 或 open 指定财神牌值，cai_shen_type 区分白板财神与翻财神模式）。
- **客户端职责**：财神牌值不写死为白板，而由 MsgJoker 的 jokers[0]/open 写入 GameData.jokerMah；白板财神模式（jokerOpen=0 / cai_shen_type=0）下 jokerMah=83，白板即财神，另支持翻财神模式。
- **协作边界**：财神牌值与财神模式完全由服务端 MsgJoker 下发，客户端只做写入、财神判定、排序与上色，不做本地模式判定。
- **来源文件**：source-code/client/Code/config/BoxMahDefine.ts
- **来源定位**：source-code/client/Code/config/BoxMahDefine.ts:81
- **原文摘录**：`/** 白板（财神常用） */`

#### `AT-ST-C02-006` 四张白板都视为财神

- **规则说明**：四张白板都是财神，即全部四张白板均按财神对待。
- **触发条件**：任一财神判定或财神上色执行时，按牌值与 jokerMah 的等值比较命中全部同牌值牌。
- **配置影响**：财神色集合 _jokerColorValues 以 jokerMah 为键构建；记牌器对箭牌（含白板）每种按 4 张计数。
- **客户端交互**：财神色按牌值统一上色，四张白板出现在手牌、牌河、副露、胡牌列表时都会染红。
- **限制与禁止**：无。
- **异常与边界**：客户端无“白板共 4 张且全为财神”的显式数量校验，是按牌值等价实现。
- **验收**：同一小局内四张白板在手牌、牌河、副露、胡牌列表中均按财神判定（牌值等于 jokerMah）并染财神色。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/GameData.ts:2008；source-code/client/Code/data/GameData.ts:1481；source-code/client/Code/util/BoxHzmjMahColorUtil.ts:22
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：财神判定按牌值等式（mah === jokerMah），同牌值的 4 张白板全部命中；记牌器对箭牌每种按 4 张计数。
- **协作边界**：四张白板的财神身份由客户端按 jokerMah 牌值本地等值判定，不依赖额外服务端消息。
- **来源文件**：source-code/client/Code/data/GameData.ts
- **来源定位**：source-code/client/Code/data/GameData.ts:1836
- **原文摘录**：`return mah === jokerMah;`

## `FP-ST-C02-003` 财神打出与弃牌响应

- **主描述**：自己出牌回合可以把财神当普通牌打出（无需先爆头），打出后进入牌河，且该弃牌不可被他人吃、碰、杠，也不可点炮胡。
- **范围与边界**：覆盖出牌前置条件、弃牌入河表现与弃牌响应限制；不覆盖飘的番数与结算。
- **总体协作**：出牌权限由 MsgPower 的 POWER_ID_PLAY 控制，禁打由 MsgPlayLmts 灰化；出牌经 MsgPlayC 上行、MsgPlayS 下行后由 BoxHzmjMah2DView 入河展示；吃碰杠胡完全由服务端消息驱动。

### 原子项

#### `AT-ST-C02-007` 自己出牌回合可打出财神

- **规则说明**：轮到自己出牌时可以打出财神，即财神手牌在自己出牌回合可当普通牌打出。
- **触发条件**：轮到自己出牌回合且服务端 MsgPower 下发 POWER_ID_PLAY 权限位后，点击财神手牌出牌。
- **配置影响**：可出牌条件仅为服务端下发的 POWER_ID_PLAY 权限位，客户端未对财神做额外拦截。
- **客户端交互**：财神手牌可点击（财神色注释明确“可点击、无角标”）；打出后座位播飘 Spine 动画（skin=piao），打出财神时播放财神专属播报音。
- **限制与禁止**：无（客户端对打出财神无额外拦截，放行完全由服务端权限决定）。
- **异常与边界**：胡牌后相当于不可出牌（canPlay 注释）；打出财神的判定为 jokerMah 严格匹配，翻财神模式下白板是替牌，不算打出财神。
- **验收**：服务端下发 POWER_ID_PLAY 后，点击财神手牌经 MsgPlayC 上行出牌，MsgPlayS 下行后弃牌入河；座位播放飘 Spine 动画（skin=piao）并播财神专属播报音。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1550；source-code/client/Code/layer/BoxHzmjMainView.ts:1482；source-code/client/Code/layer/BoxHzmjTipAniView.ts:517；source-code/client/Code/controller/gameSoundController.ts:108
- **服务端职责**：下发 MsgPower（POWER_ID_PLAY 控制可出牌）；接收 MsgPlayC 出牌后广播 MsgPlayS，并下发 MsgPiao 更新飘计数。
- **客户端职责**：出牌由 BoxHzmjMainView.onPlayMah 校验后调用 GameController.sendPlay 上行 MsgPlayC；可出牌条件仅为服务端下发 POWER_ID_PLAY，且未对财神做额外拦截。
- **协作边界**：客户端消费 MsgPower 渲染可出牌态并上行 MsgPlayC；出牌结果与飘表现由服务端 MsgPlayS/MsgPiao 驱动，客户端不做财神出牌的本地拦截。
- **来源文件**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts
- **来源定位**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:64
- **原文摘录**：`同步财神色（setJokerColorValues：灰优先于红 #ffc4c4，可点击、无角标）`

#### `AT-ST-C02-008` 打出财神不要求已爆头

- **规则说明**：打出财神不要求已经爆头，即爆头不是打出财神的前置条件。
- **触发条件**：出牌前 canPlayMahCheck 校验链执行时（校验 MsgPlayLmts 禁打、可听牌拦截与“点过才能出牌”操作态）。
- **配置影响**：禁打限制由服务端 MsgPlayLmts 配置表达；TYPE_PIAO（=10）为打出财神（飘）的动画类型配置。
- **客户端交互**：无爆头相关出牌提示；若服务端拦截财飘出牌，通过 MsgNotifyInfo 弹“有财必拷响规则生效中”。
- **限制与禁止**：无（客户端出牌校验链中无爆头门槛）。
- **异常与边界**：“无需爆头”在客户端表现为无该门槛（无正向实现），是否存在爆头限制由服务端判定；财飘回合的出牌限制走 MsgPlayLmts/MsgNotifyInfo，被禁打时提示“该牌被禁打”。
- **验收**：出牌校验链路中不出现爆头前置条件；服务端未拦截时财神可直接打出；服务端经 MsgPlayLmts 禁打时提示“该牌被禁打”，经 MsgNotifyInfo 拦截财飘时弹“有财必拷响规则生效中”。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/GameData.ts:1789；source-code/client/Code/controller/cmd/gameCmd/GameNotifyInfoCmd.ts:62；source-code/client/Code/config/BoxMahDefine.ts:238
- **服务端职责**：下发 MsgPower（是否放行出牌）、MsgPlayLmts（禁打限制）与 MsgNotifyInfo（财飘拦截提示）；是否存在爆头限制由服务端判定。
- **客户端职责**：出牌前 canPlayMahCheck 只校验 MsgPlayLmts 禁打、可听牌拦截与“点过才能出牌”操作态，没有爆头前置条件；是否放行完全由服务端 MsgPower 决定。
- **协作边界**：客户端仅做禁打与操作态的本地拦截提示；爆头限制与财飘回合出牌限制由服务端 MsgPower/MsgPlayLmts/MsgNotifyInfo 表达。
- **来源文件**：source-code/client/Code/layer/BoxHzmjMainView.ts
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1432
- **原文摘录**：`if (!GameData.canPlayCard(mahValue, this._lastPlayIsDanFang)) { this.dispatch(GameEventBoxHzmj.onShowTextTimeTips, "该牌被禁打", 1.3);`

#### `AT-ST-C02-009` 打出后作为白板留在牌河

- **规则说明**：打出后按普通白板留在牌河，即财神打出后以白板牌面进入自己座位牌河。
- **触发条件**：服务端下发 MsgPlayS（打出财神）后，GamePlayCmd 写入 PlayerCardsData.setPlayMah 并派发 setPlayMah/addPlayMah。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：牌面按牌值显示为白板；但牌落河后立即调用 _applyJokerColorToTable，牌河里的财神仍被染财神色，显示为红色高亮的白板，而非完全普通的白板。
- **限制与禁止**：无。
- **异常与边界**：牌面为白板图，但客户端对牌河中的财神继续保留财神红色高亮，与“按普通白板”的表现存在差异，需确认是否取消牌河财神色。
- **验收**：MsgPlayS 后弃牌插入对应座位出牌区（outs）并按白板牌面显示；当前实现对牌河中的财神保留财神色高亮（与模板“普通白板”表述的差异需产品确认）。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:853；source-code/client/Code/layer/BoxHzmjMah2DView.ts:1130
- **服务端职责**：下发 MsgPlayS（携带打出的牌值 mah），驱动弃牌入河。
- **客户端职责**：GamePlayCmd 收到 MsgPlayS 后写入 PlayerCardsData.setPlayMah 并派发 setPlayMah/addPlayMah，BoxHzmjMah2DView 把牌插入对应座位出牌区（outs），牌面按牌值显示为白板。
- **协作边界**：弃牌入河由客户端消费 MsgPlayS 驱动展示，牌值由服务端消息携带，客户端无本地规则判断。
- **来源文件**：source-code/client/Code/controller/cmd/gameCmd/GamePlayCmd.ts
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePlayCmd.ts:89
- **原文摘录**：`GameEventBoxHzmj.setPlayMah, context.localSeat, data.mah, GameData.getPlayerCardsData(context.localSeat)?.cards.concat()`

#### `AT-ST-C02-010` 他人不能吃碰杠财神弃牌

- **规则说明**：其他人不能吃、碰、杠打出的财神，即财神弃牌对其他玩家不可吃、碰、杠。
- **触发条件**：财神弃牌进入牌河后，其他玩家吃碰杠按钮是否出现随服务端 MsgPower 权限位变化。
- **配置影响**：吃碰杠按钮是否出现由服务端 MsgPower 权限位决定，客户端不做过滤。
- **客户端交互**：吃碰杠按钮是否出现由服务端 MsgPower 权限位决定，客户端不做过滤；副露展示层按 isJoker 做财神插位排序。
- **限制与禁止**：财神弃牌不可被其他玩家吃、碰、杠，该限制由服务端裁决，客户端无本地实现。
- **异常与边界**：客户端无该限制的实现证据，属服务端判定；副露展示用 isJoker 做财神插位排序（BoxMahDefine.sortCombDisplayMahs），易被误读为财神可参与吃碰杠。
- **验收**：财神弃牌出现后，吃碰杠按钮态仅随服务端 MsgPower 变化；收到 MsgChowS/MsgPungS/MsgKongS 时客户端按 msg.comb 更新组合与记牌器，无针对财神弃牌的本地过滤。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:37；source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:40；source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:93
- **服务端职责**：下发 MsgPower（吃碰杠权限位）与 MsgChowS/MsgPungS/MsgKongS（吃碰杠结果与组合），财神弃牌能否被吃碰杠由服务端裁决。
- **客户端职责**：吃/碰/杠完全由服务端 MsgChowS/MsgPungS/MsgKongS 驱动，客户端按 msg.comb 更新组合与记牌器，没有本地“财神弃牌不可被吃碰杠”判断。
- **协作边界**：吃碰杠合法性完全由服务端消息裁决；客户端仅消费权限位渲染按钮、消费结果消息更新组合与记牌器。
- **来源文件**：source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:37
- **原文摘录**：`localSeat !== SELF_LOCAL_SEAT && GameData.updateCardCounter(data.comb?.mahs ?? []);`

#### `AT-ST-C02-011` 财神弃牌不能点炮胡

- **规则说明**：也不能用打出的财神点炮胡，即财神弃牌不能成为其他玩家的点炮胡牌。
- **触发条件**：财神弃牌进入牌河后，其他玩家能否胡由服务端是否下发胡权限（MsgPower）决定；玩家点胡时客户端上行 MsgHuC。
- **配置影响**：胡牌按钮与胡牌类型均来自服务端 MsgPower。
- **客户端交互**：点炮胡播 HuAniType.DIAN_PAO 动画；服务端不下发胡权限时无胡按钮。
- **限制与禁止**：财神弃牌不能被用来点炮胡，该限制由服务端裁决（不下发胡权限），客户端无本地校验。
- **异常与边界**：客户端胡牌流程对弃牌牌值不做任何判断，“财神弃牌不能点炮胡”只能依赖服务端不下发胡权限实现。
- **验收**：财神弃牌场景下胡按钮态仅随服务端 MsgPower 变化；客户端胡牌流程不出现针对弃牌牌值的拦截逻辑；点炮胡按服务端 dfFrom 与多响字段播 HuAniType.DIAN_PAO 动画。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:325；source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:95
- **服务端职责**：接收 MsgHuC 上行胡牌；下发 MsgPower（胡权限位）与 MsgHuEx/MsgResultHu（胡牌结果、点炮/自摸类型），财神弃牌能否点炮胡由服务端裁决。
- **客户端职责**：胡牌按钮与胡牌类型均来自服务端：GamePowerCmd 同步 Power，自己点胡直接 sendHu 上行 MsgHuC；点炮/自摸动画类型按服务端 dfFrom 与多响字段推导，客户端不校验弃牌是否财神。
- **协作边界**：胡牌合法性完全由服务端 MsgPower/MsgHuEx/MsgResultHu 裁决；客户端仅消费权限位渲染胡按钮、上行 MsgHuC 并按结果消息播放动画，对弃牌牌值不做判断。
- **来源文件**：source-code/client/Code/controller/gameController.ts
- **来源定位**：source-code/client/Code/controller/gameController.ts:477
- **原文摘录**：`const data = new GLCProtocol.MsgHuC(obj).pack(); this.send(GLCProtocol.XYID.CS_HU_C, data);`
