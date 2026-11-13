# 飘财

> 阶段 ID：`ST-C08`。来源：模板「行牌 > 飘财」章节。客户端视角规格，客户端逻辑与 UI 交互以 Code/Fgui 代码证据支撑。

## 0. 阶段

- **阶段 ID**：`ST-C08`
- **阶段**：飘财
- **来源章节**：行牌 > 飘财
- **涉及协议消息**：MsgPlayLmts、MsgPlayS、MsgPower、MsgNotifyInfo、MsgPiao、MsgRelinkOnAction
- **涉及 UI 模块**：box_hzmj（主界面 BoxHzmjMainView、手牌区 BoxHzmjPlayerHandCards）、box_hzmj_tipAni（特效层 BoxHzmjTipAniView、HzmjTipAniComponent、Paixing_wz03）
- **阶段概述**：打出财神的玩家持有全场唯一的飘财窗口并限制其余三家；受限方只能胡牌、暗杠并打出刚摸进或补进的牌，其余手牌压暗；所有者下次出牌先关窗，若又打出财神则立刻重开；飘档仅在打出财神且仍敲响时累加，飘次数按座位累计并在碰杠位播放「飘」字，无常驻标签。

## 术语与单位

| 术语 | 定义 | 单位/量纲 | 作用域 | 来源 |
| --- | --- | --- | --- | --- |
| 财神 | 白板固定为财神。只在胡牌判定时代替顺子、刻子或对子所缺的牌。吃、碰、杠必须用真实的非财神牌，不能用财神牌，也不能用财神去代替所缺的牌。 | 张（牌） | 全场通用 | 模板名词章节（第12行） |
| 飘 | 自己出牌阶段打出一张财神，即飘财 1 次。连续打出财神则累加，打出普通牌清零。每小局从 0 次起算。 | 次 | 单个座位、每小局 | 模板名词章节（第18行） |

## 跨切面行为

- **出牌禁打是通用机制**：服务端下发受限座位、禁打手牌与禁打单放，客户端只在受限座位等于自己且自己有出牌权时灰化并拦截；出牌不清列表，依赖服务端空包或新包维护 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:31-48；source-code/client/Code/controller/cmd/gameCmd/GamePlayCmd.ts:72）。
- **飘状态消息仅含座位与次数**：飘状态消息只带座位与飘次数两个字段，没有窗口所有者信息；重连时用重连动作包里的飘次数数组恢复 —— 跨切面（source-code/client/Code/controller/cmd/sceneCmd/SceneActionCmd.ts:76-79）。
- **「飘」字特效复用碰杠动作节点**：复用 KW_Ani_PengGang_0~3 与 Paixing_wz03 骨骼动画的 piao 皮肤，播完自动隐藏，不生成常驻文本 —— 跨切面（source-code/client/Code/layer/BoxHzmjTipAniView.ts:183、517-533）。
- **飘档档位由服务端下发映射**：财飘、双财飘、三财飘等档位由服务端下发的番型编号映射名称与动画，客户端不自行计算档位 —— 跨切面（source-code/client/Code/config/FanDefine.ts:304-315）。
- **通知标记 10 注释与提示文案语义不一致**：通知标记 10 的注释写的是「财飘出牌限制」，客户端实际提示文案是「有财必拷响规则生效中」，两者语义不完全一致 —— 跨切面（source-code/client/Code/config/GameDefine.ts:471；source-code/client/Code/controller/cmd/gameCmd/GameNotifyInfoCmd.ts:61-63）。

## `FP-ST-C08-001` 飘财窗口归属与转移

- **主描述**：全场同时只有一个飘财窗口；打出财神的玩家成为所有者并限制另外三家；之后又有人打出财神时窗口直接转移到该玩家且不叠加；受限玩家被逼打出刚摸到的财神时窗口转到其身上。
- **范围与边界**：只覆盖窗口归属、唯一性与转移，不覆盖受限方具体操作限制与飘档计数。
- **总体协作**：窗口归属与转移完全由服务端判定，客户端只接收「某座位受限」与「某座位飘次数」两类结果并做界面表现。

### 原子项

#### `AT-ST-C08-001` 全场唯一飘财窗口

- **规则说明**：全场同时只有一个飘财窗口。
- **触发条件**：任意时刻场上存在飘财窗口时（由唯一性规则推导，客户端无对应触发实现）。
- **配置影响**：本原子项无独立配置
- **客户端交互**：客户端代码未找到对应实现（待确认）
- **限制与禁止**：全场不得同时存在第二个飘财窗口。
- **异常与边界**：客户端只按座位保存飘计数，没有「窗口所有者」或「唯一窗口」的状态字段、界面元素或协议字段；飘状态消息仅含座位与次数。
- **验收**：客户端无可验收实现；全场唯一窗口语义需服务端证据或联调验证确认。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：客户端不保存任何窗口所有者状态，仅按座位保存飘计数并接收受限座位结果。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C08-002` 所有者限制另外三家

- **规则说明**：打出财神的玩家成为飘财窗口所有者，另外三家受到出牌限制。
- **触发条件**：场上出现飘财限制，自己是被限制的一方。
- **配置影响**：本原子项无独立配置
- **客户端交互**：自己受限时手牌灰化并被拦截出牌，其他座位没有专属表现。
- **限制与禁止**：仅当受限座位是自己时才驱动界面刷新与拦截；受限座位之外不做界面变化。
- **异常与边界**：客户端没有「所有者」概念，只接收受限座位，无法从客户端证实受限对象恰为另外三家。
- **验收**：收到针对自己座位的 MsgPlayLmts 后，禁打手牌与禁打单放被缓存，本家手牌灰化且出牌被拦截；其他座位受限时本家无专属表现。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:45；source-code/client/Code/data/GameData.ts:1738-1741；source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:10
- **服务端职责**：下发 MsgPlayLmts（受限座位、禁打手牌与禁打单放）
- **客户端职责**：收到针对某座位的出牌限制后，按该座位缓存禁打手牌与禁打单放牌值；只有受限座位是自己时才驱动界面刷新。
- **协作边界**：客户端消费 MsgPlayLmts 缓存限制数据并做本家界面表现；「打出财神者成为所有者、其余三家受限」的判定在服务端。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:31
- **原文摘录**：`const localSeat = TableData.inst.seatToLocal(data.seat ?? 0);`

#### `AT-ST-C08-003` 窗口换人且不叠加

- **规则说明**：之后再有人打出财神，飘财窗口直接换到该玩家，不叠加。
- **触发条件**：限制目标换成另一家，重新收到一份限制内容。
- **配置影响**：本原子项无独立配置
- **客户端交互**：灰态按最新一份限制重算；限制包为空时解除缓存。
- **限制与禁止**：两份限制不得叠加，新限制整体覆盖旧限制。
- **异常与边界**：限制包为空（禁打手牌与单放均为 0）时调用清空接口把受限座位重置为空；客户端未建模「窗口转移」本身，只能观察到限制被整包覆盖；出牌不清禁打列表（过张可能跨回合）。
- **验收**：收到新的 MsgPlayLmts 后受限座位与禁打列表被整体替换、不叠加；收到空包后限制缓存被清空。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:37-38；source-code/client/Code/controller/cmd/gameCmd/GamePlayCmd.ts:72
- **服务端职责**：下发 MsgPlayLmts（新受限座位与新禁打清单，或空包解除限制）
- **客户端职责**：新的限制内容整体覆盖上一份受限座位与禁打列表，不做累加；限制被清空时调用清空接口把座位重置为空。
- **协作边界**：客户端消费 MsgPlayLmts 做覆盖式缓存与灰态重算；窗口转移与不叠加的判定在服务端。
- **来源文件**：`source-code/client/Code/data/GameData.ts`
- **来源定位**：source-code/client/Code/data/GameData.ts:1739-1741
- **原文摘录**：`this._playLimitSeat = seat; this._playLimitMahs = mahs; this._playLimitDanFang = danFang;`

#### `AT-ST-C08-004` 被逼打财神时窗口转移

- **规则说明**：受限玩家若被逼打出刚摸到的财神，飘财窗口就转到该玩家身上。
- **触发条件**：受限玩家被迫打出刚摸到的财神时。
- **配置影响**：本原子项无独立配置
- **客户端交互**：客户端代码未找到对应实现（待确认）
- **限制与禁止**：无
- **异常与边界**：客户端没有「受限方打出财神导致窗口转移」的分支处理，也没有窗口状态可转移；限制仅表现为服务端下发的禁打清单。
- **验收**：客户端无可验收实现；被逼打财神导致窗口转移需服务端证据或联调验证。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：客户端只接收受限座位与禁打清单，不感知窗口转移事件。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

## `FP-ST-C08-002` 受限方操作与手牌限制

- **主描述**：受限时允许胡牌与暗杠，禁止吃、碰、直杠、加杠；只能打出刚摸进或最新补进的那张牌，其余手牌压暗且只在本家界面可见；该限制优先于吃碰禁手。
- **范围与边界**：覆盖受限方可用操作、可出牌范围与手牌显示，不覆盖窗口归属与计数。
- **总体协作**：操作按钮是否出现由服务端下发的权限与可选组合决定；禁打范围由服务端下发的禁打清单决定；客户端负责灰化、拦截与提示。

### 原子项

#### `AT-ST-C08-005` 受限时可胡与暗杠

- **规则说明**：受限时可以胡牌和暗杠。
- **触发条件**：受限一家的回合出现可选操作。
- **配置影响**：匹配场提示配置含「财飘」回合引导文案「除了杠、胡，只能摸啥打啥」（MatchTipConfig.ts:41）。
- **客户端交互**：受限时只要服务端给了权限，操作区仍出现胡按钮与杠按钮，暗杠并入杠按钮的多杠选择。
- **限制与禁止**：客户端不做飘财态下额外放开或屏蔽胡、杠的判断，按钮可见性完全跟随服务端权限位。
- **异常与边界**：杠按钮混合明杠、暗杠与补杠，客户端无法区分「只允许暗杠」；匹配场提示文案写「除了杠、胡」，未区分暗杠。
- **验收**：受限且服务端下发胡、杠权限位时，胡按钮与杠按钮照常显示并可操作。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:583；source-code/client/Code/config/MatchTipConfig.ts:41；source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:53
- **服务端职责**：下发 MsgPower（权限位与可选操作组合）
- **客户端职责**：胡与杠按钮只按服务端下发的权限位与可选组合显示，客户端没有飘财态下额外放开胡或暗杠的判断。
- **协作边界**：客户端消费 MsgPower 渲染操作按钮；飘财限制下放开胡与暗杠的判定在服务端。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:552-559
- **原文摘录**：`showGang: (power & BoxMahDefine.PowerType.POWER_ID_KONG) > 0, showHu: (power & BoxMahDefine.PowerType.POWER_ID_HU) > 0,`

#### `AT-ST-C08-006` 受限时禁止吃碰与直杠加杠

- **规则说明**：受限时不能吃、碰、直杠、加杠。
- **触发条件**：受限一家的回合出现可选操作。
- **配置影响**：匹配场提示配置含「财飘」回合引导文案（MatchTipConfig.ts:41）。
- **客户端交互**：受限时若服务端未下发吃碰杠权限，对应按钮不出现；一旦下发则正常显示。
- **限制与禁止**：受限时不得吃、碰、直杠、加杠。
- **异常与边界**：匹配场提示写「除了杠、胡」，与需求「不能直杠、加杠」表述不一致；客户端无飘财态禁止直杠与加杠的专门拦截。
- **验收**：受限时服务端未下发吃、碰、杠权限则对应按钮不出现；客户端不做飘财相关的额外禁用判断。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:636-650；source-code/client/Code/config/MatchTipConfig.ts:41
- **服务端职责**：下发 MsgPower（不含吃、碰、直杠、加杠权限的权限位与可选组合）
- **客户端职责**：吃、碰、杠按钮完全由服务端权限位与可选组合列表决定，客户端不自行做飘财相关的禁用判断。
- **协作边界**：客户端消费 MsgPower 渲染按钮；禁止吃碰与直杠加杠的判定在服务端。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:578-580
- **原文摘录**：`this.view.KW_Main.KW_Handler.KW_BTN_Chi.visible = powerState.showChi; this.view.KW_Main.KW_Handler.KW_BTN_Peng.visible = powerState.showPeng; this.view.KW_Main.KW_Handler.KW_BTN_Gang.visible = powerState.showGang;`

#### `AT-ST-C08-007` 只能打摸进或最新补进的那一张

- **规则说明**：受限时只能打刚摸进或最新补进的那一张牌。
- **触发条件**：受限玩家点击一张手牌准备打出。
- **配置影响**：匹配场提示配置含「财飘」回合引导文案（MatchTipConfig.ts:41）。
- **客户端交互**：被禁的牌不可触摸，强行出牌会被拦下并弹出「该牌被禁打」。
- **限制与禁止**：除刚摸进或最新补进那张外的手牌均在禁打之列，不得打出。
- **异常与边界**：客户端不自行推导「只能打摸进那张」，而是执行服务端下发的禁打清单；杠后补牌是否算摸牌位依赖数据层摸牌标记。
- **验收**：被禁手牌灰化不可触摸；强行点选出牌被拦截并弹出「该牌被禁打」提示。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/GameData.ts:1789-1803；source-code/client/Code/layer/BoxHzmjMainView.ts:1432-1434；source-code/client/Code/config/MatchTipConfig.ts:41
- **服务端职责**：下发 MsgPlayLmts（禁打手牌与禁打单放牌值）
- **客户端职责**：服务端下发禁打手牌与禁打单放牌值，客户端按摸牌标记区分手牌位与单放位并拦截被禁的牌。
- **协作边界**：客户端消费 MsgPlayLmts 执行禁打清单并拦截出牌；可出牌范围（仅摸进或最新补进那张）的判定在服务端。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:33-35
- **原文摘录**：`const handForbid = data.hands ?? []; const danFangForbid = data.dang_fang ?? 0;`

#### `AT-ST-C08-008` 其余手牌压暗且仅本家可见

- **规则说明**：其余手牌压暗，只在自己界面显示。
- **触发条件**：自己处于限制状态。
- **配置影响**：本原子项无独立配置
- **客户端交互**：受限时被禁手牌变灰、不可点，只有自己手牌区发生变化。
- **限制与禁止**：压暗仅对服务端列入禁打的牌生效；界面刷新只作用于自己手牌区。
- **异常与边界**：「压暗」以染灰实现；「只在自己界面显示」对应客户端本就只渲染自己手牌，别家视野与信息隐匿无法由客户端代码证实。
- **验收**：受限时按禁打列表逐张把被禁手牌染灰并设为不可触摸，仅自己手牌区发生变化。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1272-1278；source-code/client/Code/data/GameData.ts:1779-1781
- **服务端职责**：下发 MsgPlayLmts（受限座位与禁打清单）
- **客户端职责**：按禁打列表逐张把被禁手牌染灰并设为不可触摸；界面刷新只作用于自己手牌区。
- **协作边界**：客户端消费 MsgPlayLmts 做本家手牌灰化；别家视野的信息隐匿由客户端只渲染自己手牌的既有机制覆盖，无法进一步证实。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:108-113
- **原文摘录**：`item.touchable = !forbid; if (forbid) { Mah2DBase.setMahColor(item, MahColor.gray); } else { Mah2DBase.setMahColor(item, this._resolveMahColor(item.mahValue)); }`

#### `AT-ST-C08-009` 限制盖过吃碰禁手

- **规则说明**：这份限制盖过吃碰禁手。
- **触发条件**：受限操作被拦下。
- **配置影响**：通知标记枚举定义财飘出牌限制（NIF_EX_MUST_BAO_TOU_WITH_CAI=10）与吃后无牌可打（NIF_EX_CHOW_FORBID_NO_PLAY=9）两类标记（GameDefine.ts:469-472）。
- **客户端交互**：命中不同拦截原因时分别弹出「吃禁手规则生效中」「有财必拷响规则生效中」「只碰不吃规则生效中」。
- **限制与禁止**：不同拦截原因弹不同文案，客户端没有优先级合并逻辑。
- **异常与边界**：通知标记 10 的注释写「财飘出牌限制」，客户端实际提示文案是「有财必拷响规则生效中」，两者语义不完全一致；未见两类限制的优先级处理。
- **验收**：出牌被财飘限制拦截时弹出「有财必拷响规则生效中」提示条；不同拦截原因弹出对应不同文案。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameNotifyInfoCmd.ts:61-63；source-code/client/Code/config/GameDefine.ts:469-470
- **服务端职责**：下发 MsgNotifyInfo（通知标记）
- **客户端职责**：客户端对吃碰禁手被拦、财飘出牌限制被拦、只碰不吃三类拦截分别弹不同文字提示，没有优先级合并逻辑。
- **协作边界**：客户端消费 MsgNotifyInfo 按标记弹提示；限制优先级（盖过吃碰禁手）的判定在服务端。
- **来源文件**：`source-code/client/Code/config/GameDefine.ts`
- **来源定位**：source-code/client/Code/config/GameDefine.ts:471-472
- **原文摘录**：`/** 财飘出牌限制：本可出但剩余手牌全被禁手禁打，出牌权限被拦截 */ NIF_EX_MUST_BAO_TOU_WITH_CAI = 10,`

## `FP-ST-C08-003` 窗口关闭与重开

- **主描述**：所有者自己下一次出牌时先关闭窗口；这次打出的牌若又是财神，窗口立刻重新打开。
- **范围与边界**：只覆盖关窗与重开时机，不覆盖计数与限制范围。
- **总体协作**：客户端没有窗口状态，出牌时不清限制，只依赖服务端后续下发的限制内容与飘状态表现开关。

### 原子项

#### `AT-ST-C08-010` 所有者下次出牌先关窗

- **规则说明**：所有者自己下一次出牌时先关掉飘财窗口。
- **触发条件**：自己打出牌、本回合结束。
- **配置影响**：本原子项无独立配置
- **客户端交互**：自己出牌后手牌恢复亮色，禁打数据仍保留，等待下一次限制内容刷新。
- **限制与禁止**：出牌处理不清除禁打列表（过张可能跨回合）。
- **异常与边界**：胡牌状态下不清灰；真正解除依赖服务端新包或空包。
- **验收**：自己出牌后本回合手牌灰态被清除、亮色恢复，禁打数据仍保留；限制解除仅随服务端空包或新包发生。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePlayCmd.ts:123；source-code/client/Code/layer/BoxHzmjMainView.ts:1628-1636
- **服务端职责**：下发 MsgPlayS（出牌结果）与 MsgPlayLmts（空包或新包维护禁打列表）
- **客户端职责**：出牌处理中明确不清除禁打列表，只在本回合结束时清掉手牌灰态，真正解除依赖服务端新包或空包。
- **协作边界**：客户端消费 MsgPlayS 清显示灰态、不清禁打数据；关窗时机与禁打列表维护在服务端。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GamePlayCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePlayCmd.ts:72
- **原文摘录**：`// PlayLmts 禁打列表由服务端空包/新包维护，出牌不清（过张可能跨回合）`

#### `AT-ST-C08-011` 又打出财神则窗口重开

- **规则说明**：所有者关窗的这次出牌若打出的又是财神，窗口立刻重新打开。
- **触发条件**：所有者关窗的那次出牌打出的恰为财神时。
- **配置影响**：本原子项无独立配置
- **客户端交互**：客户端代码未找到对应实现（待确认）
- **限制与禁止**：无
- **异常与边界**：客户端无窗口开合状态，也没有「打出的牌是财神则重开窗口」的分支；只会在收到飘次数大于 0 的状态时播一次飘字。
- **验收**：客户端无可验收实现；重开窗口需服务端证据或联调验证。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：客户端不维护窗口开合状态，仅消费飘状态表现飘字。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

## `FP-ST-C08-004` 飘档与杠链计数

- **主描述**：飘档只在打出财神且打出后手牌仍然敲响时加 1；没敲响就打财神会让飘档与杠链归零，打出普通牌同样归零；各家飘档独立；吃碰杠不清飘档，吃和碰清杠链。
- **范围与边界**：覆盖飘档与杠链的加减规则，不覆盖飘次数的界面表现。
- **总体协作**：计数规则由服务端判定，客户端只按座位保存服务端下发的次数并用于结算档位展示。

### 原子项

#### `AT-ST-C08-012` 飘档加一的条件

- **规则说明**：飘档只在打出财神、且打出后手牌仍然敲响时加 1。
- **触发条件**：有人打出财神。
- **配置影响**：番型配置 GetHzmjCaiPiaoLevel 按番型编号映射财飘、双财飘、三财飘档位（FanDefine.ts:308-314）。
- **客户端交互**：次数大于 0 时播放飘字；结算时按档位显示财飘、双财飘、三财飘名称。
- **限制与禁止**：客户端不自行计算飘档与档位。
- **异常与边界**：未见「打出后仍敲响才加 1」的判定代码，客户端直接采用服务端次数。
- **验收**：收到 MsgPiao 后按座位保存飘次数；次数大于 0 时播放飘字；结算时按服务端番型编号显示对应档位名称。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts:21；source-code/client/Code/config/FanDefine.ts:308-314
- **服务端职责**：下发 MsgPiao（座位与飘次数）
- **客户端职责**：客户端不计算飘档，只保存服务端下发的飘次数；结算档位靠服务端下发的番型编号映射名称。
- **协作边界**：客户端消费 MsgPiao 保存次数并表现飘字；飘档加一条件（打出后仍敲响）在服务端判定。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts:8-10
- **原文摘录**：`飘状态更新（MsgPiao, XYID=1283） 服务端下发玩家打出财神后的飘计数`

#### `AT-ST-C08-013` 未敲响打财神则飘档与杠链归零

- **规则说明**：没敲响就打财神，飘档和杠链都归零。
- **触发条件**：打出财神但手牌没有敲响。
- **配置影响**：本原子项无独立配置
- **客户端交互**：次数为 0 时不播放飘字，界面无其他反馈。
- **限制与禁止**：次数小于等于 0 时跳过飘字表现。
- **异常与边界**：客户端完全不存在「杠链」概念与相应归零逻辑，归零只能由服务端计数体现。
- **验收**：收到次数为 0 的飘状态时不播放飘字，界面无其他反馈。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:1675-1677
- **服务端职责**：下发 MsgPiao（清零后的飘次数）
- **客户端职责**：客户端没有杠链数据，也没有飘档归零计算；只在收到次数为 0 或负数时跳过飘字表现。
- **协作边界**：客户端消费 MsgPiao 做表现层跳过；飘档与杠链归零判定在服务端。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjTipAniView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:1675-1677
- **原文摘录**：`if (piaoCount <= 0) { return; }`

#### `AT-ST-C08-014` 打出普通牌飘档归零

- **规则说明**：打出普通牌，飘档同样归零。
- **触发条件**：打出普通牌。
- **配置影响**：本原子项无独立配置
- **客户端交互**：计数归零后不再播放飘字。
- **限制与禁止**：客户端出牌流程不改飘次数。
- **异常与边界**：若服务端在归零时不下发飘状态，界面也不会有任何归零动作。
- **验收**：打出普通牌后客户端无清零动作；仅收到 0 次飘状态时不再播放飘字。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePlayCmd.ts:59-75
- **服务端职责**：下发 MsgPiao（清零后的飘次数）
- **客户端职责**：出牌处理流程中没有飘次数归零动作，计数变化完全由服务端下发的飘状态决定。
- **协作边界**：客户端消费 MsgPiao 表现次数变化；归零规则在服务端。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjTipAniView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:1675-1677
- **原文摘录**：`if (piaoCount <= 0) { return; }`

#### `AT-ST-C08-015` 各家飘档独立

- **规则说明**：各家飘档独立。
- **触发条件**：某一家打出财神、该家飘次数发生变化。
- **配置影响**：本原子项无独立配置
- **客户端交互**：飘字动画按座位对应的碰杠节点播放，各家互不影响。
- **限制与禁止**：四个座位计数互不覆盖，不聚合成共享计数。
- **异常与边界**：按座位独立存储已确认；独立累加的判定仍在服务端。
- **验收**：飘次数按座位分别保存与更新，一个座位变化不覆盖其他座位计数。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts:21；source-code/client/Code/data/GameData.ts:1699-1700
- **服务端职责**：下发 MsgPiao（按座位的飘次数）
- **客户端职责**：按座位数组分别保存四个座位的飘次数，飘状态按座位写入，不聚合成共享计数。
- **协作边界**：客户端消费 MsgPiao 按座位存储；独立累加规则由服务端保证。
- **来源文件**：`source-code/client/Code/data/GameData.ts`
- **来源定位**：source-code/client/Code/data/GameData.ts:1601
- **原文摘录**：`private _piaoCounts: number[] = [0, 0, 0, 0];`

#### `AT-ST-C08-016` 吃碰杠不清飘档

- **规则说明**：吃、碰、杠不清飘档。
- **触发条件**：有玩家吃、碰或杠。
- **配置影响**：本原子项无独立配置
- **客户端交互**：吃碰杠后飘字与飘次数保持不变。
- **限制与禁止**：吃碰杠处理流程不修改飘次数；飘次数清零点只有小局重置。
- **异常与边界**：以「吃碰杠流程不触碰飘次数、清零点只有小局重置」间接印证，未见正向断言代码；实际计数是否被服务端重置无法由客户端证实。
- **验收**：吃、碰、杠发生后各座位飘次数与飘字表现保持不变；飘次数清零仅发生在小局重置。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/GameData.ts:1699-1707；source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:32-34
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：飘次数的写入与清零只出现在飘状态处理与小局重置两个位置，吃碰杠处理流程不修改飘次数。
- **协作边界**：客户端本地不因吃碰杠改飘次数；服务端计数是否被重置无法由客户端证实。
- **来源文件**：`source-code/client/Code/data/GameData.ts`
- **来源定位**：source-code/client/Code/data/GameData.ts:2019
- **原文摘录**：`this._piaoCounts = [0, 0, 0, 0];`

#### `AT-ST-C08-017` 吃和碰清杠链

- **规则说明**：吃和碰会清杠链。
- **触发条件**：有玩家吃牌或碰牌时。
- **配置影响**：本原子项无独立配置
- **客户端交互**：客户端代码未找到对应实现（待确认）
- **限制与禁止**：无
- **异常与边界**：客户端没有杠链数据、杠链界面或清杠链逻辑；吃牌与碰牌处理只更新面子数据与动作动画。
- **验收**：客户端无可验收实现；杠链清零需服务端证据确认。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：客户端不存在杠链概念，无对应消费或本地判断。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

## `FP-ST-C08-005` 飘次数展示与小局重置

- **主描述**：飘次数本局累加，小局重置时清掉；次数大于 0 时在该座位碰杠位播放「飘」字，不设常驻标签。
- **范围与边界**：覆盖飘次数的累计与重置、以及与次数相关的特效表现，不覆盖飘档判定。
- **总体协作**：次数由服务端下发，客户端按座位保存并在重连时恢复；小局重置统一清空；展示只用一次性骨骼动画。

### 原子项

#### `AT-ST-C08-018` 飘次数本局累加与小局重置

- **规则说明**：飘次数本局累加，小局重置时清掉。
- **触发条件**：一局开始或界面重置（进入新的小局）。
- **配置影响**：本原子项无独立配置
- **客户端交互**：新一局开始后不残留上一局的飘字与计数。
- **限制与禁止**：无
- **异常与边界**：累加由服务端计算；大结算中的「财飘 N 次」统计的是财飘胡牌次数，不是飘次数。
- **验收**：小局重置时四个座位飘计数一起清零；重连时按重连动作包中的飘次数数组恢复，不残留上一局飘字。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/GameData.ts:2015-2019；source-code/client/Code/layer/BoxHzmjMainView.ts:401；source-code/client/Code/controller/cmd/sceneCmd/SceneActionCmd.ts:77-78
- **服务端职责**：下发 MsgPiao（座位与累计飘次数）与重连动作包 MsgRelinkOnAction（含飘次数数组）
- **客户端职责**：保存服务端下发的累计飘次数，重连时用重连包中的数组恢复；小局重置（重置界面）时把四个座位计数一起清零。
- **协作边界**：客户端消费 MsgPiao 与重连包恢复计数、小局重置时清零；本局内累加规则在服务端。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts:21
- **原文摘录**：`GameData.updatePiaoState(data.seat, data.piao_count);`

#### `AT-ST-C08-019` 碰杠位播放飘字

- **规则说明**：次数大于 0 时，在该座位碰杠位播放「飘」字。
- **触发条件**：某家打出财神导致飘次数大于 0。
- **配置影响**：特效资源配置为 Paixing_wz03 骨骼动画的 piao 皮肤，挂载于碰杠动作节点 KW_Ani_PengGang_0~3。
- **客户端交互**：在该玩家碰杠位置闪出「飘」字动画并自动消失。
- **限制与禁止**：次数小于等于 0 时不播放；播放在复盘中会跳过。
- **异常与边界**：飘字节点与吃碰杠动作共用，播放结束统一隐藏。
- **验收**：收到飘次数大于 0 的 MsgPiao 后，对应座位碰杠位播放一次「飘」字骨骼动画并自动隐藏；复盘中跳过。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:517-524；source-code/client/Code/layer/BoxHzmjTipAniView.ts:183；source-code/client/Fgui/assets/box_hzmj_tipAni/component/HzmjTipAniComponent.xml:44-55；source-code/client/Fgui/assets/box_hzmj_tipAni/effect/Paixing_wz03.json:1
- **服务端职责**：下发 MsgPiao（座位与飘次数）
- **客户端职责**：收到飘状态后把服务端座位换算成本地座位，复用该座位的碰杠动作节点，切换到飘皮肤后播放骨骼动画。
- **协作边界**：客户端消费 MsgPiao 触发一次性动画；是否大于 0 的判定依据服务端下发的次数。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjTipAniView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:1672-1681
- **原文摘录**：`onPiaoState(seat: number, piaoCount: number): void { if (BoxRoomData.inst.isFupanMode()) return; if (piaoCount <= 0) { return; ...`

#### `AT-ST-C08-020` 飘字无常驻标签

- **规则说明**：没有常驻标签。
- **触发条件**：飘字特效播放结束。
- **配置影响**：本原子项无独立配置
- **客户端交互**：座位旁只在瞬间出现飘字，之后不残留任何飘相关标签或数字。
- **限制与禁止**：不生成常驻文本或角标；飘次数取值接口在界面层没有调用方。
- **异常与边界**：仅小局结算外的「财飘次数」统计属于结算数据，不是座次常驻标签。
- **验收**：飘字动画播放结束后特效节点隐藏，界面不出现任何飘次数常驻文本或角标。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:1673-1681
- **服务端职责**：下发 MsgPiao（座位与飘次数）
- **客户端职责**：飘状态处理只触发一次性动画，动画结束回调把节点隐藏，不写入任何文本或角标；飘次数取值接口在界面层没有调用方。
- **协作边界**：客户端消费 MsgPiao 仅做一次性动画表现，不落常驻 UI。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjTipAniView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:531-533
- **原文摘录**：`PlaySpineAni(actionAniNode, actionAniName, () => { actionAniNode.visible = false; });`
