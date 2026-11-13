# 出牌与响应

> 阶段 ID：`ST-C11`。来源：模板「行牌 > 出牌与响应」章节。客户端视角规格，客户端逻辑与 UI 交互以 Code/Fgui 代码证据支撑。

## 0. 阶段

- **阶段 ID**：`ST-C11`
- **阶段**：出牌与响应
- **来源章节**：行牌 > 出牌与响应
- **涉及协议消息**：MsgPower、MsgPlayC、MsgCancel、MsgKongC、MsgKongS、MsgChowS、MsgPungS、MsgResultHu、MsgEndGame
- **涉及 UI 模块**：box_hzmj_main、BoxHzmjMainView、BoxHzmjMah2DView
- **阶段概述**：定义谁可以出牌、弃牌被响应后的牌河回收与显示、必须先过再出牌的拦截、过与过2的差异、操作按钮区与手牌压暗、多优先级等待、多种吃与杠的选择面板，以及吃碰杠胡的副露与字效结算表现。

## 术语与单位

| 术语 | 定义 | 单位/量纲 | 作用域 | 来源 |
| --- | --- | --- | --- | --- |
| 面子 | 一组顺子、刻子或杠。杠含 4 张，仍计 1 组面子。对子不是面子。已完成的吃、碰、明杠、暗杠都计入面子。 | 无 | 全局 | 模板名词章节（第 11 行） |
| 财神 | 白板固定为财神。只在胡牌判定时代替顺子、刻子或对子所缺的牌。吃、碰、杠必须用真实的非财神牌。 | 无 | 全局 | 模板名词章节（第 12 行） |
| 上家 | 上家为本家逆时针方向的上一家，吃牌只用上家刚打出的牌。 | 无 | 全局 | 模板名词章节（第 7 行） |
| 爆头 | 摸牌前为 4 组面子加 1 张财神。下一张摸到任意牌，都与这张财神组成对子后自摸。只能自摸。 | 无 | 全局 | 模板名词章节（第 16 行） |
| 飘 | 自己出牌阶段打出一张财神，即飘财 1 次。连续打出财神则累加，打出普通牌清零。 | 次 | 全局 | 模板名词章节（第 18 行） |
| 放铳 | 打出的牌被他人合法胡走。胡牌者称为点炮胡。白板财神弃牌不能点炮胡。 | 无 | 全局 | 模板名词章节（第 19 行） |

## 跨切面行为

- **可操作项位图统一驱动**：可操作项位图统一驱动按钮显隐、本家手牌可出状态与压暗范围；非本家权限到达时直接关闭本家操作区 —— 跨切面（source-code/client/Code/layer/BoxHzmjMainView.ts:536；source-code/client/Code/layer/BoxHzmjMainView.ts:528）
- **仅更新数据模式**：所有下行指令都支持“仅更新数据”模式，重连与复盘补数据时只落数据、不播动画 —— 跨切面（无单独代码定位，本片原子项未见对应实现）
- **统一响应倒计时**：响应倒计时统一由时钟服务提供，四个座位共用中央倒计时区域，归零显示 00 且不触发任何自动操作 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:78）
- **副露展示统一处理**：副露数据统一做展示牌序（吃/碰升序、杠保持原序）与来源座位方向换算，箭头按进牌实际所在槽位定位 —— 跨切面（无单独代码定位，本片原子项未见对应实现）
- **复盘模式按钮路径**：复盘模式走另一套按座位渲染的操作按钮路径，与本家单人操作区互斥 —— 跨切面（无单独代码定位，本片原子项未见对应实现）

（以下按 JSON 中 features 顺序，每个功能点一节）

## `FP-ST-C11-001` 出牌资格与出牌拦截

- **主描述**：界定谁能出牌，以及在等待他人响应、正在选择组合、杠后未补牌、小局结束等状态下禁止出牌。
- **范围与边界**：覆盖本家出牌入口、手牌可触性与禁打校验；不含服务端对出牌权的最终裁决。
- **总体协作**：服务端下发的可操作项决定本家手牌可否出牌，出牌前再做禁打校验，非本家权限到达即关闭本家操作区。

### 原子项

#### `AT-ST-C11-001` 出牌权与可打牌双条件

- **规则说明**：只有当前拿到出牌权、且目标牌可打的玩家能出牌。出牌资格由可操作项中的出牌位决定，打出前再校验目标牌是否禁打，两项都满足才允许打出。
- **触发条件**：轮到自己操作（可操作项到达本家）时设置手牌可出状态；本家点击手牌准备打出时执行禁打校验。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：无出牌权时手牌不可出；点到禁打牌弹出“该牌被禁打”提示并回退手牌显示。
- **限制与禁止**：无出牌权时禁止出牌；目标牌为禁打牌时禁止打出，点击后拦截并把手牌拉回。
- **异常与边界**：客户端只做本地拦截，服务端仍会校验出牌权与禁打；出牌位计算要求当前无胡状态（POWER_ID_PLAY 且非胡）。
- **验收**：本家收到含出牌位且非胡状态的可操作项后手牌进入可出状态；点击禁打牌时提示“该牌被禁打”且手牌复原；无出牌权时点击手牌不产生出牌。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:536；source-code/client/Code/layer/BoxHzmjMainView.ts:556；source-code/client/Code/layer/BoxHzmjMainView.ts:1432；source-code/client/Code/data/GameData.ts:1789
- **服务端职责**：下发 MsgPower（可操作项位图与组合数据，决定出牌位与禁打范围）；接收 MsgPlayC 出牌请求并做出牌权与禁打的最终校验。
- **客户端职责**：收到可操作项后按出牌位设置本家手牌可出状态；出牌前再校验该牌是否被禁打，禁用牌拦截并把手牌拉回。
- **协作边界**：客户端消费 MsgPower 驱动手牌可出状态与本地禁打拦截，经 MsgPlayC 上送出牌请求；出牌权与禁打的最终裁决在服务端。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:536
- **原文摘录**：`this._selfHand.canPutCard = powerState.canPlay;`

#### `AT-ST-C11-002` 等待他人响应时不能出牌

- **规则说明**：等待他人响应时不能出牌。
- **触发条件**：其他玩家获得可操作资格（可操作项到达非本家座位），本家进入等待响应状态。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：本家操作按钮收起，手牌不再响应出牌点击。
- **限制与禁止**：可操作项到达非本家座位时禁止本家出牌，本家手牌退出可出状态。
- **异常与边界**：非本家手牌本身不做灰化处理，只关闭本家操作区。
- **验收**：可操作项到达非本家座位时本家操作区关闭、手牌退出可出状态，点击手牌不产生出牌，界面回到等待状态。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:528；source-code/client/Code/layer/BoxHzmjMainView.ts:497
- **服务端职责**：下发 MsgPower（可操作项到达非本家座位，间接驱动本家关闭操作区）。
- **客户端职责**：非本家收到可操作项时，直接关闭本家操作区，本家手牌退出可出状态。
- **协作边界**：客户端消费 MsgPower 的座位归属，本地关闭操作区与手牌可出状态，不做灰化处理。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:528
- **原文摘录**：`if (localSeat != SELF_LOCAL_SEAT) { this.closeOperate(); return; }`

#### `AT-ST-C11-003` 选择组合过程中不能出牌

- **规则说明**：正在选择组合时不能出牌。
- **触发条件**：自己点击吃或杠后出现多组候选，选择面板展开。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：操作区切换为选择面板，原吃/碰/杠/胡按钮退出显示。
- **限制与禁止**：候选选择面板展开期间，玩家只能从候选中选择或取消，不能直接打出牌。
- **异常与边界**：仅能确认选择面板接管操作区；吃选择场景依赖此时不具备出牌位，未找到选择期间的独立出牌禁用判断。
- **验收**：进入吃/杠选择面板后操作区页签切到选择面板、手牌选牌回调清空，原操作按钮退出显示；选择期间的独立出牌禁用判定未见代码，待确认。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1124；source-code/client/Code/layer/BoxHzmjMainView.ts:1118
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：进入吃/杠选择面板时切换操作区页签并清空选牌回调，选择面板接管操作区；未见显式关闭出牌入口的代码。
- **协作边界**：客户端本地切换操作区页签并清空选牌回调；选择期间不能出牌依赖此时不具备出牌位的间接保证。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1124
- **原文摘录**：`this.view.KW_Main.KW_Handler.C_BtnState.selectedIndex = bShow ? BtnState.SELECT_GANG : BtnState.EMPTY;`

#### `AT-ST-C11-004` 杠后尚未补牌不能出牌

- **规则说明**：杠后尚未补牌时，不能出牌。杠成立到补牌到达之间出牌入口保持关闭。
- **触发条件**：自己提交杠请求且杠成立，补牌尚未到达。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：杠成功后操作按钮与手牌出牌入口收起，等待补牌。
- **限制与禁止**：杠请求提交后立即关闭本家出牌入口，杠成立消息到达时再次关闭操作区，补牌前禁止出牌。
- **异常与边界**：补牌后由新的可操作项重新打开出牌入口。
- **验收**：杠请求提交后手牌退出可出状态；杠成立消息到达后操作区关闭；下一次摸牌（补牌）后随新可操作项恢复可操作。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1155；source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:46
- **服务端职责**：接收 MsgKongC 杠请求；下发 MsgKongS 杠成立消息，补牌后重新下发可操作项恢复出牌入口。
- **客户端职责**：提交杠请求后立即关闭本家出牌入口，杠成立消息到达时再次关闭操作区，直到下一次摸牌后重新获得可操作项。
- **协作边界**：客户端上送 MsgKongC 后本地先关出牌入口，消费 MsgKongS 再次关闭操作区；恢复可操作由服务端补牌后下发的可操作项驱动。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1155
- **原文摘录**：`this._selfHand.canPutCard = false;`

#### `AT-ST-C11-005` 小局结束后不能出牌

- **规则说明**：本小局已经结束时，不能出牌。
- **触发条件**：本小局胡牌结算或流局结束消息到达。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：操作按钮全部收起，手牌不再响应出牌点击。
- **限制与禁止**：结算处理时关闭操作区、本家手牌退出可出状态；结束游戏消息到达时收起听牌相关按钮。
- **异常与边界**：无。
- **验收**：胡牌或流局结算消息到达后本家操作区关闭、手牌不可出，界面进入结算流程，玩家不能再操作牌局。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:241；source-code/client/Code/controller/cmd/gameCmd/GameEndCmd.ts:33
- **服务端职责**：下发 MsgResultHu（胡牌结算）与 MsgEndGame（小局结束），触发操作区关闭与结算流程。
- **客户端职责**：胡牌/流局结算处理时关闭操作区，本家手牌退出可出状态；结束游戏消息到达时也收起听牌相关按钮。
- **协作边界**：客户端消费结算与结束消息，本地关闭操作区与出牌响应；结算归属判断由服务端完成。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:241
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.onCloseOperate);`

## `FP-ST-C11-002` 弃牌裁决与牌河回收

- **主描述**：弃牌被他家响应时的先后裁决，以及裁决成立或全部放弃后牌河与显示的收尾表现。
- **范围与边界**：覆盖客户端对裁决结果的牌河回收与显示清理；裁决优先级本身由服务端完成。
- **总体协作**：吃/碰/杠/胡消息到达后统一移走来源牌河的最后一张并清理放大牌显示。

### 原子项

#### `AT-ST-C11-006` 弃牌可被响应时先裁决

- **规则说明**：弃牌可被吃、碰、直杠或点炮胡时，先裁决。
- **触发条件**：弃牌可被吃、碰、直杠或点炮胡响应，由服务端先做裁决（客户端侧未见对应触发实现）。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无。
- **异常与边界**：客户端只接收裁决结果消息，未找到任何本地裁决顺序实现。
- **验收**：客户端不做本地裁决，仅按服务端下发的裁决成立消息执行后续牌河回收；裁决顺序的正确性待服务端规格确认。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认
- **协作边界**：裁决先后顺序完全由服务端完成，客户端仅消费裁决成立后的结果消息。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C11-007` 成立后各端从牌河取走该牌

- **规则说明**：裁决成立后，各端从牌河取走该牌，即被吃、碰、杠或点炮胡的那张弃牌从来源玩家牌河移除。
- **触发条件**：吃、碰、杠或点炮胡成立，响应的是牌河中最后打出的那张牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：牌河中被响应的那张牌消失，牌面并入副露或胡牌。
- **限制与禁止**：仅移除与响应进牌匹配的来源牌河最后一张，不做整河清理。
- **异常与边界**：胡牌移除放铳者牌河末张时带来源与标记条件判断；牌河数据与桌面牌河节点两边同时移除，保证重连前后一致。
- **验收**：吃/碰/杠成立后来源玩家牌河末张从数据与桌面两侧同时消失；点炮胡成立后放铳者牌河末张同样移除。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/PlayerCardsData.ts:92；source-code/client/Code/layer/BoxHzmjMah2DView.ts:893；source-code/client/Code/layer/BoxHzmjMah2DView.ts:997
- **服务端职责**：下发 MsgChowS、MsgPungS、MsgKongS（吃、碰、杠成立，携带组合与来源座位）与 MsgResultHu（胡牌结算，携带放铳来源），驱动牌河回收。
- **客户端职责**：吃/碰/杠成立时把组合中的进牌从来源玩家的牌河弹出，并同步移除桌面牌河最后一张；胡牌成立时同样移除放铳者牌河最后一张。
- **协作边界**：客户端消费成立消息中的组合与来源座位，本地在牌河数据与桌面节点两侧同步移除；末张与进牌匹配的前提由客户端自行判断。
- **来源文件**：`source-code/client/Code/data/PlayerCardsData.ts`
- **来源定位**：source-code/client/Code/data/PlayerCardsData.ts:92
- **原文摘录**：`if (fromOuts[fromOuts.length - 1] == combo.in_mahs[0]) { fromOuts.pop(); }`

#### `AT-ST-C11-008` 清除被响应牌的浮标与放大显示

- **规则说明**：裁决成立后各端取走该牌，并清除它的浮标和放大显示。
- **触发条件**：吃、碰、杠或胡成立消息到达，该牌此前以放大牌面或浮标形式突出显示。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：被响应牌的放大牌卡消失；指向最后打出牌的浮标由牌桌组件负责。
- **限制与禁止**：吃、碰、杠消息到达时统一隐藏其他玩家出牌的放大牌面。
- **异常与边界**：放大牌面隐藏已证；“浮标”应为指向最后打出牌的箭头，其隐藏/复位由平台牌桌组件处理，本仓库无对应代码。
- **验收**：吃/碰/杠/胡成立消息到达后出牌放大牌面隐藏，牌桌上大牌提示消失；浮标清除由平台牌桌组件承担，本仓库待确认。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:42；source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:42；source-code/client/Code/layer/BoxHzmjMainView.ts:1059
- **服务端职责**：下发 MsgChowS、MsgPungS、MsgKongS（吃、碰、杠成立，驱动放大牌面隐藏）。
- **客户端职责**：吃/碰/杠/胡消息到达时统一隐藏其他玩家出牌的放大牌面。
- **协作边界**：客户端消费成立消息触发隐藏放大牌面事件；浮标的隐藏/复位在平台牌桌组件，本仓库未见证据。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:42
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.onHidePutCardUi);`

#### `AT-ST-C11-009` 全部放弃时牌留牌河并轮下家

- **规则说明**：全部放弃则牌留在牌河，再轮到下家摸牌。
- **触发条件**：所有可响应玩家全部放弃该弃牌（客户端侧未见对应触发实现）。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无。
- **异常与边界**：未找到“全部放弃”后的牌河保留与轮转处理代码，仅能确认点击过不会清理牌河。
- **验收**：全放弃路径下牌河末张保留、随后轮到下家摸牌；客户端无对应判定代码，待服务端规格确认。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认
- **协作边界**：牌河保留与下家轮转由服务端驱动，客户端无对应判定代码。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

## `FP-ST-C11-003` 需先点过才能出牌

- **主描述**：在自摸或必须先过的杠提示存在时拦截出牌，并定义可杠牌与刚摸牌无关时的例外。
- **范围与边界**：覆盖本家出牌拦截与提示；不含服务端对过手胡/过手碰的资格判定。
- **总体协作**：出牌入口统一检查当前可操作项与杠牌是否涉及刚摸牌，再决定是否弹出必须先过提示。

### 原子项

#### `AT-ST-C11-010` 存在自摸或杠提示时拦截出牌

- **规则说明**：【自摸】还在，或本次杠提示必须先过时，双击或滑动出牌会被拦住。
- **触发条件**：自己拖出或双击手牌准备出牌，且当前可操作项仍含胡、杠、碰或吃提示，操作区处于吃碰杠胡页签。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：双击或滑动出的牌被拦下，手牌回到原位。
- **限制与禁止**：存在未处理的胡/杠/碰/吃提示且杠与摸牌有关时，禁止出牌；拦截放在出牌前统一校验里，对单击、双击、滑动都生效。
- **异常与边界**：杠与摸牌无关（_isGangOffMoCard）时不走拦截分支。
- **验收**：胡、杠、碰、吃任一提示存在且操作区处于吃碰杠胡页签时，双击或滑动出牌被拦下、手牌回位，牌未打出，操作区保持提示状态。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1447；source-code/client/Code/layer/BoxHzmjMainView.ts:1453
- **服务端职责**：下发 MsgPower（可操作项位图与组合数据，构成拦截判断输入）。
- **客户端职责**：出牌前检查当前可操作项是否含胡、杠、碰、吃，且操作区仍处于吃碰杠胡页签，则直接拦截本次出牌。
- **协作边界**：客户端消费 MsgPower 位图与本地操作区页签状态做拦截；是否必须先过的资格由服务端下发的可操作项隐含。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1447
- **原文摘录**：`const showAction = (power & POWER_ID_HU) > 0 || (power & POWER_ID_KONG) > 0 || ...`

#### `AT-ST-C11-011` 提示只在本家显示

- **规则说明**：出牌被拦住时，只在本家显示「点“过”才能出牌」。
- **触发条件**：本家在被拦截的情况下尝试出牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：本家屏幕中部弹出提示条，3 秒后消失；其他玩家不显示。
- **限制与禁止**：提示仅本家可见，其他玩家不显示。
- **异常与边界**：提示通过本家出牌校验触发，天然只在本家出现。
- **验收**：本家被拦截出牌时弹出“点“过”才能出牌”提示并于 3 秒后消失，其他端无此提示。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1454
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：拦截出牌时只向本家弹出通用提示框，文案为点“过”才能出牌。
- **协作边界**：提示完全由客户端本地出牌校验触发，无服务端消息参与。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1454
- **原文摘录**：`pfbm.uiFgui(fui.FuiCommonViewDefine.MessageSimpleBoxListView).showFgui<MessageSimpleBoxListDataType>({ text: `点“过”才能出牌`, time: 3, type: 0 });`

#### `AT-ST-C11-012` 须先点过才能继续出牌

- **规则说明**：被拦截后须先点【过】，出牌才被放行。
- **触发条件**：本家点击【过】按钮，当前仍有自摸或吃碰杠提示。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：点【过】后按钮收起，手牌恢复可按压。
- **限制与禁止**：操作区仍处于吃碰杠胡页签时出牌持续被拦，须先点【过】解除。
- **异常与边界**：除点过外，提交吃/碰/杠/胡或取消也会退出提示页签，同样解除拦截。
- **验收**：点击【过】后上送放弃请求、操作区退出吃碰杠胡页签并关闭，随后出牌不再被拦，手牌重新可以打出。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1236；source-code/client/Code/layer/BoxHzmjMainView.ts:1453
- **服务端职责**：接收 MsgCancel 放弃请求，处理后不再维持本次提示。
- **客户端职责**：点击过后上送放弃请求并退出吃碰杠胡页签，操作区关闭后才允许再次出牌。
- **协作边界**：客户端上送 MsgCancel 并本地退出页签；拦截解除以本地页签状态为准，服务端仅处理放弃请求。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1236
- **原文摘录**：`onBtnGuo(): void { GameController.instance.sendCancel(); this.view.KW_Main.KW_Handler.C_BtnState.selectedIndex = BtnState.EMPTY; ...`

#### `AT-ST-C11-013` 只杠手中暗杠可直接出牌

- **规则说明**：例外：可杠的只是摸牌或补牌之前已经拿在手里的暗杠，可以直接出牌。
- **触发条件**：摸牌后系统给出杠提示，且本次无胡提示。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：手牌保持正常亮度，可直接打出。
- **限制与禁止**：该例外仅在无胡提示、且所有可杠组合牌值都不等于刚摸牌时成立；不满足时仍走必须先过分支。
- **异常与边界**：判定口径为“所有可杠组合牌值都不等于刚摸牌”，与“摸牌/补牌前已在手”等价。
- **验收**：有杠提示、无胡提示且所有可杠组合的牌值均不等于刚摸牌时，手牌不压暗、不清灰，出牌不被“点过”拦截，杠按钮仍显示。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:697；source-code/client/Code/layer/BoxHzmjMainView.ts:701；source-code/client/Code/layer/BoxHzmjMainView.ts:713
- **服务端职责**：下发 MsgPower（可操作项含杠组合与摸牌信息，构成例外判定输入）。
- **客户端职责**：若存在杠提示但无胡提示，且所有可杠组合的牌值都不等于刚摸的牌，则标记为与摸牌无关的杠，不压暗手牌且不要求点过。
- **协作边界**：客户端消费 MsgPower 的杠组合与本地摸牌值做例外判定；杠组合合法性由服务端下发。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:697
- **原文摘录**：`const hasGangOnMoCard = (PowerData.combs ?? []).some((comb) => this._isGangComb(comb.flag) && (comb.mahs?.[0] ?? 0) === moCard);`

#### `AT-ST-C11-014` 碰后又能杠仍须先过

- **规则说明**：碰之后又能杠的，仍须先过。
- **触发条件**：碰完之后手牌又出现可杠组合，此时手上没有刚摸进来的牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：手牌参与杠的牌保持亮度、其余压暗，出牌前需先点过。
- **限制与禁止**：碰后加杠场景不适用“与摸牌无关的杠”例外，仍须先点过才能出牌。
- **异常与边界**：该场景通过“碰后无摸牌”的守卫间接实现，未找到针对碰后加杠的专门分支。
- **验收**：碰后再出现杠提示时，因摸牌值为 0 不满足例外条件，手牌按必须先过处理，出牌被拦截直至点过，杠提示仍保留。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:695；source-code/client/Code/layer/BoxHzmjMainView.ts:696
- **服务端职责**：下发 MsgPower（碰后再次下发的可操作项含杠组合）。
- **客户端职责**：碰后手牌没有刚摸牌（摸牌值为 0），与摸牌无关的杠判定不成立，因此仍走必须先过的分支。
- **协作边界**：客户端以本地摸牌值守卫间接区分场景；例外不成立时按必须先过的通用分支处理。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:695
- **原文摘录**：`const moCard = GameData.getPlayerCardsData(SELF_LOCAL_SEAT)?.moCard ?? 0;`

## `FP-ST-C11-004` 点过的生效范围

- **主描述**：点过只放弃当次提示；后续同一张牌重新判断，放弃杠后本次机会内不再出现杠。
- **范围与边界**：覆盖点过后的本地界面收尾与后续提示判定；跨回合的资格重算由服务端负责。
- **总体协作**：点过时上送放弃请求并清空本地选择与压暗状态，等待服务端重新下发可操作项。

### 原子项

#### `AT-ST-C11-015` 点过只放弃本次并收起按钮预览

- **规则说明**：点【过】只放弃这一次提示，收起本次按钮和预览。
- **触发条件**：玩家点击【过】，当前存在一次操作提示。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：操作按钮与候选面板收起，手牌恢复常态。
- **限制与禁止**：点过仅放弃本次提示，界面回到无提示状态。
- **异常与边界**：按钮与候选面板收起已证；“预览”未见显式清除逻辑。
- **验收**：点【过】后上送放弃请求，操作按钮与多吃/多杠候选面板收起，手牌压暗清除；“预览”清除未见显式实现，待确认。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1237；source-code/client/Code/layer/BoxHzmjMainView.ts:1239
- **服务端职责**：接收 MsgCancel 放弃请求。
- **客户端职责**：点过时上送放弃请求、退出吃碰杠胡页签、隐藏多吃/多杠面板并清空选牌回调与压暗。
- **协作边界**：客户端上送 MsgCancel 后本地收起按钮与候选面板；“预览”清除未见对应实现。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1237
- **原文摘录**：`GameController.instance.sendCancel();`

#### `AT-ST-C11-016` 同一张牌按新弃牌重新判断

- **规则说明**：点过之后，别人再打出相同牌，按新弃牌重新判断。
- **触发条件**：放弃后别人又打出同样的牌，该牌再次成为可响应弃牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：下次同牌出现时按钮按新可操作项重新显示。
- **限制与禁止**：本地不保留“已过张”缓存，不沿用上次放弃结果。
- **异常与边界**：重新判定依赖服务端重新下发可操作项，客户端仅有不缓存的间接证据。
- **验收**：点过后再次出现相同弃牌时，若服务端重新下发可操作项则按钮重新显示，本地无抑制逻辑；重新判定本身由服务端完成，待服务端规格确认。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1240
- **服务端职责**：下发 MsgPower（同一张牌再次成为可响应弃牌时重新下发可操作项）。
- **客户端职责**：点过后本地不保留本次提示状态，仅清空选择与压暗，后续是否再次提示完全由新的可操作项决定。
- **协作边界**：客户端不缓存“已过张”，是否再次提示由服务端新下发的 MsgPower 决定。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1240
- **原文摘录**：`this._selfHand.selectChiCb = null; this._clearPowerHandGray();`

#### `AT-ST-C11-017` 放弃杠后本次机会内不再出现杠

- **规则说明**：放弃杠后，同一次操作机会内不再出现【杠】；下一次拿到操作机会再判断。
- **触发条件**：玩家在同一次操作机会内放弃杠（客户端侧未见对应触发实现）。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无。
- **异常与边界**：客户端点过后只是关闭操作区，若服务端再次下发杠提示仍会显示，未找到本地抑制逻辑。
- **验收**：同一次操作机会内放弃杠后杠按钮不再出现；客户端无本地抑制代码，该表现待服务端规格确认。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认
- **协作边界**：本次机会内是否抑制杠提示未见客户端实现，预期由服务端下发可操作项控制。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

## `FP-ST-C11-005` 操作按钮区

- **主描述**：有操作资格时在本家手牌右上方展示可做项按钮与过，按固定顺序排列，并展示胡牌张与预览倍数。
- **范围与边界**：覆盖按钮区结构、顺序与内容；不含按钮美术颜色验证。
- **总体协作**：可操作项位图决定每个按钮显隐，操作组横向排布在屏幕右侧靠本家手牌上方。

### 原子项

#### `AT-ST-C11-018` 资格玩家看到按钮与过

- **规则说明**：有操作资格的玩家在自己手牌右上方看到对应按钮和【过】。
- **触发条件**：本家收到可操作项，其中至少包含吃、碰、杠、胡或过之一。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：按钮组出现在屏幕右侧靠本家手牌上方，按右侧对齐排布。
- **限制与禁止**：无操作资格时不显示按钮组；非本家到达的可操作项会关闭本家操作区。
- **异常与边界**：按钮组横向布局，隐藏项不占位（excludeInvisibles）。
- **验收**：本家获得可操作资格后按钮组在手牌右上方展开、右侧对齐，玩家看到本次可做的按钮和过按钮。
- **职责域**：client
- **职责依据**：source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:33；source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:35；source-code/client/Code/layer/BoxHzmjMainView.ts:577
- **服务端职责**：下发 MsgPower（可操作项位图，驱动各按钮显隐）。
- **客户端职责**：本家收到可操作项时按位显示吃、碰、杠、胡、过按钮，其他玩家到达时关闭本家操作区。
- **协作边界**：客户端消费 MsgPower 位图设置各按钮显隐；按钮组布局与右对齐由 Fgui 组件定义承担。
- **来源文件**：`source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml`
- **来源定位**：source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:33
- **原文摘录**：`<group id="n52_ev1d" name="KW_BTN_PGs" ... layout="hz" colGap="40" excludeInvisibles="true">`

#### `AT-ST-C11-019` 按钮顺序与只显示可做项

- **规则说明**：按钮从左到右为【吃】【碰】【杠】【胡】，蓝色【过】固定在最右，只显示本次可做的项。
- **触发条件**：本家获得可操作资格，本次只具备部分操作项。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：按钮按吃、碰、杠、胡、过从左到右出现，未具备的项不显示。
- **限制与禁止**：只显示本次可做的项，做不了的项不出现。
- **异常与边界**：过与过2使用同一皮肤，二者并存时最右为过2；“蓝色”仅能从皮肤名 guo 推断，未验证颜色。
- **验收**：按钮按【吃】【碰】【杠】【胡】【过】固定顺序显示且只显示可做项；“过为蓝色”未验证，待美术确认。
- **职责域**：client
- **职责依据**：source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:6；source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:15；source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:21；source-code/client/Code/layer/BoxHzmjMainView.ts:578
- **服务端职责**：下发 MsgPower（可操作项位图，决定各按钮显隐内容）。
- **客户端职责**：按可操作项位逐个设置吃、碰、杠、胡、过按钮显隐，按钮在同一横向组内右对齐排列。
- **协作边界**：客户端消费 MsgPower 位图逐按钮设置显隐；按钮先后顺序由 Fgui 组件内按钮位置承担。
- **来源文件**：`source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml`
- **来源定位**：source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:6
- **原文摘录**：`name="KW_BTN_Chi" src="yngk6m" fileName="component/EffectBtn.xml" xy="1250,400"`

#### `AT-ST-C11-020` 胡按钮左侧胡牌张与倍数

- **规则说明**：【胡】或【自摸】左侧显示胡牌张和预览倍数。
- **触发条件**：本家获得胡牌资格，可操作项中包含胡。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：胡按钮左边显示具体胡牌张与“N倍”文本。
- **限制与禁止**：无。
- **异常与边界**：胡牌张与倍数节点在按钮内左侧（x 小于按钮动作节点），倍数取服务端下发值；按钮按胡牌类型切换胡或自摸皮肤。
- **验收**：具备胡权限时胡按钮左侧显示胡牌张图片与“N倍”文案，并按胡牌类型切换胡/自摸皮肤。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:664；source-code/client/Code/layer/BoxHzmjMainView.ts:666；source-code/client/Fgui/assets/box_hzmj_main/component/HuActionBtn.xml:6；source-code/client/Fgui/assets/box_hzmj_main/component/HuActionBtn.xml:7
- **服务端职责**：下发 MsgPower（携带胡牌张 hu_mah 与倍数 hu_point，驱动预览内容）。
- **客户端职责**：具备胡权限时把胡牌张图片与倍数文案写入胡按钮内的左侧节点，并按胡牌类型切换胡或自摸皮肤。
- **协作边界**：客户端消费 MsgPower 中的胡牌张与倍数填充展示；数值本身由服务端计算下发。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:664
- **原文摘录**：`this.view.KW_Main.KW_Handler.KW_BTN_Hu.KW_HuPai.KW_Value.url = BoxMahDefine.MahValueImg[PowerData.hu_mah];`

#### `AT-ST-C11-021` 统一响应倒计时且归零仍可点

- **规则说明**：各端使用同一个响应倒计时，归零后按钮仍可点。
- **触发条件**：有玩家获得可操作资格，该次操作带有响应时限。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：中央倒计时统一显示秒数，最后 3 秒换字体并播提示音，归零显示 00。
- **限制与禁止**：倒计时结束仅把数字置为 00，不对按钮做禁用处理；归零不触发任何自动操作。
- **异常与边界**：倒计时来源统一；“归零后按钮仍可点”属于没有任何禁止逻辑的反向结论，缺少正向代码证据。
- **验收**：可操作项到达时各端按统一时钟值显示同一倒计时，归零显示 00；按钮禁用逻辑不存在，归零后仍可点为反向结论，待进一步验证。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:78；source-code/client/Code/layer/BoxHzmjMah2DView.ts:696；source-code/client/Code/layer/BoxHzmjMah2DView.ts:710
- **服务端职责**：下发 MsgPower（可操作项到达时携带时钟信息，各端取同一时钟）。
- **客户端职责**：可操作项到达时按统一时钟值启动座位倒计时显示，倒计时结束仅把数字置为 00，不对按钮做禁用处理。
- **协作边界**：客户端消费统一时钟值本地渲染倒计时；归零后的按钮可用性为无禁用逻辑的反向结论。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:78
- **原文摘录**：`const clockInfo = ReportController.inst.getClock();`

## `FP-ST-C11-006` 手牌压暗

- **主描述**：按能否胡、参与哪些吃碰杠来区分手牌亮度，并对与摸牌无关的杠保持原亮度。
- **范围与边界**：覆盖本家手牌的置灰与恢复；压暗仅本端生效。
- **总体协作**：可操作项与候选组合共同决定哪些牌值保持亮度，其余牌值统一置灰。

### 原子项

#### `AT-ST-C11-022` 能胡时整手正常亮度

- **规则说明**：能胡时整手保持正常亮度。本家可操作项含胡时，不进入压暗；若此前已有压暗，一并清除并恢复手牌可按压。
- **触发条件**：本家收到可操作项且含胡，或可操作项中碰、杠、吃均不存在。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：所有手牌正常显示、可点。
- **限制与禁止**：无。
- **异常与边界**：清灰入口在该玩家已胡（GameData.getIsHu(SELF_LOCAL_SEAT) 为真）时跳过置灰清空，属已胡状态下的边界保护行为。
- **验收**：本家获得胡资格时，整手手牌保持正常亮度且可按压，无任何手牌被置灰。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:718；source-code/client/Code/layer/BoxHzmjMainView.ts:1628
- **服务端职责**：下发 MsgPower（可操作项，含碰/杠/吃/胡标记）。
- **客户端职责**：可操作项含胡时直接清除手牌压暗并恢复可按压。
- **协作边界**：客户端消费服务端 MsgPower 的可操作项标记；是否清灰、恢复可按压由本地判断。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:718
- **原文摘录**：`if ((!powerState.showPeng && !powerState.showGang && !powerState.showChi) || powerState.showHu) { this.onClearGray();`

#### `AT-ST-C11-023` 不能胡时只亮参与组牌的牌

- **规则说明**：不能胡时，只有参与当前吃、碰、直杠的牌保持亮度，其余压暗。吃、碰、杠同时存在时合并所有相关牌值，而不是只取第一个候选。
- **触发条件**：本家收到可操作项，含吃、碰或杠标记但不含胡，且存在至少一组可执行的组牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：参与组牌的牌亮起，其余手牌变灰。
- **限制与禁止**：不能胡时，参与组牌之外的手牌一律置灰，不允许保留亮度。
- **异常与边界**：多类提示并存时按全部候选组合合并保留相关牌值，不取单一候选。
- **验收**：仅存在吃/碰/杠提示且无胡时，只有候选组合涉及的手牌保持正常亮度，其余手牌全部置灰；多类提示并存时合并保留全部相关牌值。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:748；source-code/client/Code/layer/BoxHzmjMainView.ts:775
- **服务端职责**：下发 MsgPower（可操作项标记与候选组合 combs）。
- **客户端职责**：按候选组合收集吃/碰/杠涉及的牌值，把这些牌值以外的牌统一置灰。
- **协作边界**：客户端消费 MsgPower 的可操作项标记与候选组合；具体保留哪些牌值亮度由本地按候选组合计算。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:748
- **原文摘录**：`for (const comb of PowerData.combs ?? []) { if (powerState.showPeng && comb.flag === CMF_PONG) { pushUnique(...) }`

#### `AT-ST-C11-024` 压暗只在本端显示

- **规则说明**：压暗只在该玩家本端显示。置灰只作用于本家手牌控件；其他玩家获得操作资格时直接关闭本家操作区，不对其他座位手牌做置灰。
- **触发条件**：本家收到不能胡的吃/碰/杠提示而进入压暗；或可操作项到达非本家座位。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：只有自己的手牌出现灰态，他人手牌外观不变。
- **限制与禁止**：禁止对非本家座位的手牌做置灰。
- **异常与边界**：可操作项到达非本家座位时直接关闭本家操作区并返回，不做任何压暗处理。
- **验收**：压暗仅出现在本家手牌；其他玩家处于压暗等待状态时，本端其他三家手牌外观不变。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:772；source-code/client/Code/layer/BoxHzmjMainView.ts:528
- **服务端职责**：下发 MsgPower（含可操作项归属座位信息）。
- **客户端职责**：置灰只作用于本家手牌控件；其他玩家获得操作资格时直接关闭本家操作区，不对其他座位手牌做置灰。
- **协作边界**：客户端消费 MsgPower 的座位归属；仅当目标是本家时本地执行置灰，非本家时关闭操作区。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:772
- **原文摘录**：`this._selfHand.setGrayValues(grayValues);`

#### `AT-ST-C11-025` 新摸补牌可杠且无胡时按压暗规则

- **规则说明**：本次新摸入或补入的牌能组成暗杠或加杠，且同次无胡时，参与任一合法杠的手牌保持亮度，其余压暗。该判定与「可杠组只由原有牌组成」共用同一分支。
- **触发条件**：摸牌或补牌后出现杠提示，同次无胡提示，且杠组合用到了刚摸进来的牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：杠相关手牌亮、其余灰，需先点过才能出牌。
- **限制与禁止**：有杠提示且无胡、且杠涉及摸牌时，不允许跳过压暗。
- **异常与边界**：判定为与摸牌无关的杠时不进入本压暗规则，转由「可杠组只用原有牌」分支处理。
- **验收**：新摸入或补入的牌能组成暗杠或加杠且同次无胡时，所有合法杠相关手牌保持亮度，其余置灰，出牌前须先点过。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:694；source-code/client/Code/layer/BoxHzmjMainView.ts:757
- **服务端职责**：下发 MsgPower（杠候选组合）。
- **客户端职责**：有杠提示且无胡、且杠涉及刚摸牌时，按所有合法杠收集牌值保留亮度，其余置灰。
- **协作边界**：客户端消费 MsgPower 杠候选；杠是否涉及摸牌、保留哪些牌值由本地判断。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:694
- **原文摘录**：`if (!powerState.showGang || powerState.showHu) return;`

#### `AT-ST-C11-026` 可杠组只用原有牌时保持当前亮度

- **规则说明**：可杠组只由原有的牌组成时，手牌保持当前亮度。判定为与摸牌无关的杠时跳过压暗分支，直接清除灰态。
- **触发条件**：出现杠提示，但可杠的牌都是之前就在手里的（与本次摸牌无关）。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：手牌维持原亮度，不出现压暗。
- **限制与禁止**：无。
- **异常与边界**：该分支同时清空吃选择回调（selectChiCb），避免残留选择状态。
- **验收**：可杠组只由原有牌组成时，手牌保持当前亮度，不出现新增压暗。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:713
- **服务端职责**：下发 MsgPower（杠候选组合）。
- **客户端职责**：判定为与摸牌无关的杠时跳过压暗分支，直接清除灰态。
- **协作边界**：客户端消费 MsgPower 杠候选；杠是否与摸牌相关由本地判断。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:713
- **原文摘录**：`if (this._isGangOffMoCard) { this.onClearGray(); this._selfHand.selectChiCb = null; return; }`

## `FP-ST-C11-007` 多优先级请求的等待与让位

- **主描述**：较低优先级先提交时的本地收起与等待，以及更高优先级成立或全部放弃后的后续处理。
- **范围与边界**：覆盖客户端提交后的界面状态；优先级裁决与已提交请求的执行由服务端负责。
- **总体协作**：提交任一响应后立即关闭本家操作区，等待服务端裁决结果。

### 原子项

#### `AT-ST-C11-027` 低优先级先提交时收起按钮并等待

- **规则说明**：较低优先级先提交时，本端收起自己的按钮并等待。「等待」无专门界面状态，仅表现为操作区关闭。
- **触发条件**：自己在别人出牌后先提交吃、碰、杠或胡，且该响应优先级可能低于其他玩家。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：按钮收起，界面进入等待他人裁决的状态。
- **限制与禁止**：提交后本家不再显示可点按钮，无法继续操作。
- **异常与边界**：等待态无专门界面表现，仅操作区切到空白页签；缺少服务端优先级裁决与等待态回执的客户端可证证据。
- **验收**：本家提交任一响应后，操作区按钮立即收起且不再可点，直到服务端下发后续结果。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1103；source-code/client/Code/layer/BoxHzmjMainView.ts:1134
- **服务端职责**：消费上行 MsgChowC/MsgPungC/MsgKongC/MsgHuC（吃/碰/杠/胡响应提交）并做优先级裁决；裁决与等待态回执未见客户端证据。
- **客户端职责**：提交吃、碰、杠、胡后立即把操作区切回空白页签，本家不再显示可点按钮。
- **协作边界**：客户端上送提交消息后本地关闭操作区；优先级裁决结果完全依赖服务端下发，客户端不做本地裁决。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1103
- **原文摘录**：`this.view.KW_Main.KW_Handler.C_BtnState.selectedIndex = BtnState.EMPTY;`

#### `AT-ST-C11-028` 更高优先级成立后取消已提交请求

- **规则说明**：更高优先级成立后，结束等待并取消该请求。客户端没有本地「已提交请求」的缓存与取消动作，结果完全依赖服务端下发。
- **触发条件**：更高优先级的响应成立时（客户端无对应实现，待确认）。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无。
- **异常与边界**：客户端无本地「已提交请求」缓存与取消动作，取消结果完全依赖服务端下发。
- **验收**：待确认（客户端无可验证实现，需服务端视角证据补全）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认
- **协作边界**：客户端无本地请求缓存与取消逻辑，取消与否完全由服务端下发结果驱动。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C11-029` 高优先级都放弃后执行已提交请求

- **规则说明**：更高优先级都放弃后，再执行已经提交的较低优先级请求。未找到任何本地延迟执行或恢复已提交请求的逻辑。
- **触发条件**：更高优先级玩家全部放弃时（客户端无对应实现，待确认）。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无。
- **异常与边界**：客户端无本地延迟执行或恢复已提交请求的逻辑，请求的执行时机完全由服务端决定。
- **验收**：待确认（请求的执行时机完全由服务端决定，客户端无可验证实现）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认
- **协作边界**：客户端无本地延迟执行逻辑，执行与否与时机完全由服务端下发结果驱动。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

## `FP-ST-C11-008` 多种吃的选择面板

- **主描述**：多家可吃或多种吃法时的候选顺子面板、取消语义与提交方式。
- **范围与边界**：覆盖候选面板展示、亮度恢复、取消与提交；倒计时到点后的可操作性未证。
- **总体协作**：点吃时若存在多组吃法则展开候选面板，选择即提交，取消则按放弃上行。

### 原子项

#### `AT-ST-C11-030` 点吃展开可选顺子

- **规则说明**：点【吃】后，在手牌上方展开可选顺子。吃组合多于一组时打开候选面板，按每组完整顺子动态生成选项；候选面板挂在操作组内，相对手牌的具体上下位置未在本仓库界面定义中验证。
- **触发条件**：本家点击吃按钮，且可吃的顺子不止一种。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：操作区出现多组顺子候选项。
- **限制与禁止**：仅一组吃法时不展开候选面板。
- **异常与边界**：展开行为已证实；「位于手牌上方」的相对位置缺少界面证据，未验证。
- **验收**：点吃且吃法多于一组时候选面板展开并显示各组完整顺子；「在手牌上方」的位置口径未证实。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1089；source-code/client/Code/layer/BoxHzmjMainView.ts:865
- **服务端职责**：下发 MsgPower（吃候选组合列表）。
- **客户端职责**：吃组合多于一组时打开候选面板，按每组完整顺子动态生成选项。
- **协作边界**：客户端消费 MsgPower 吃候选组合；是否展开面板由本地按组合数量判断。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1089
- **原文摘录**：`if (this._chooseChiLength > 1) { this.showChooseChi(true); return; }`

#### `AT-ST-C11-031` 每组三张正面且从小到大

- **规则说明**：每组三张正面、按牌面从小到大。每个选项固定填充三个牌槽，逐张设置牌面图与牌背状态；牌序直接取服务端候选牌序，客户端未在此处做升序排序。
- **触发条件**：吃候选面板展开，每种吃法有三张牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：候选项显示三张正面牌。
- **限制与禁止**：无。
- **异常与边界**：「按牌面从小到大」未在客户端排序，实际顺序依赖服务端下发顺序。
- **验收**：每个候选项固定显示三张正面牌可验证；「从小到大」的排序口径依赖服务端下发顺序，客户端未排序。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:944；source-code/client/Code/layer/BoxHzmjMainView.ts:953
- **服务端职责**：下发 MsgPower（含候选顺子牌序）。
- **客户端职责**：每个选项固定填充三个牌槽，逐张设置牌面图与牌背状态。
- **协作边界**：客户端消费 MsgPower 候选牌序原样渲染；本地不做排序。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:944
- **原文摘录**：`for (let i = 0; i < layout.maxMahSlots; i++) {`

#### `AT-ST-C11-032` 面板右侧为取消

- **规则说明**：右侧为【取消】。取消按钮与候选面板同属操作组，候选面板之后放置取消，取消在该页签可见；取消是操作组内最后一个子节点，组内横向布局右对齐。
- **触发条件**：候选面板展开，存在多组可选。
- **配置影响**：取消按钮位置与可见页签由 Handler.xml 配置（坐标 xy=1250,400，gearDisplay 绑定 C_BtnState 页签）。
- **客户端交互**：候选面板右侧出现取消按钮。
- **限制与禁止**：无。
- **异常与边界**：取消按钮仅在候选选择页签（pages 5,12）可见，其余页签隐藏。
- **验收**：候选面板展开时，取消按钮出现在面板右侧且可点。
- **职责域**：client
- **职责依据**：source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:30；source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:31
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：取消按钮与候选面板同属操作组，候选面板之后放置取消，取消在该页签可见。
- **协作边界**：纯客户端 UI 布局行为，不依赖服务端消息。
- **来源文件**：`source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml`
- **来源定位**：source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:30
- **原文摘录**：`name="KW_BTN_Cancel" src="yngk6m" fileName="component/EffectBtn.xml" xy="1250,400"`

#### `AT-ST-C11-033` 吃过按钮退场且手牌恢复亮度

- **规则说明**：原【吃】【过】退场，手牌恢复常态亮度。打开候选面板时切换操作区页签，使吃、过按钮不再显示，同时清空手牌置灰；吃、过按钮仅在吃碰杠胡页签显示，切到选择页签即隐藏。
- **触发条件**：打开吃候选面板（多组吃法）。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：吃、过按钮消失，手牌恢复常态。
- **限制与禁止**：无。
- **异常与边界**：无。
- **验收**：候选面板展开后，吃、过按钮不再显示，手牌全部恢复正常亮度。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1119；source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:7
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：打开候选面板时切换操作区页签，使吃、过按钮不再显示，同时清空手牌置灰。
- **协作边界**：纯客户端 UI 状态切换，不依赖服务端消息。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1119
- **原文摘录**：`this._selfHand.setGrayValues({});`

#### `AT-ST-C11-034` 倒计时归零后仍可选择

- **规则说明**：倒计时归零后面板仍可操作。候选面板的点击回调不绑定倒计时，倒计时结束只改变中央读秒显示。
- **触发条件**：候选面板打开且倒计时归零，玩家仍在选择。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：读秒到 00 时候选牌仍可点。
- **限制与禁止**：无。
- **异常与边界**：属「无禁用代码」的反向结论，缺少正向代码证据。
- **验收**：倒计时显示 00 后，候选面板选项仍可点击并正常提交（反向证据支持，缺正向验证）。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:907
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：候选面板的点击回调不绑定倒计时，倒计时结束只改变中央读秒显示。
- **协作边界**：候选点击不消费倒计时状态；读秒显示由时钟服务单独驱动。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:907
- **原文摘录**：`com.offClick(this._onMoreCombPoolClick, this); com.onClick(this._onMoreCombPoolClick, this);`

#### `AT-ST-C11-035` 吃面板取消放弃全部操作

- **规则说明**：点【取消】等于放弃自己对这张弃牌的全部操作，包括同时存在的胡。取消时同时关闭吃与杠面板并执行点过逻辑，上送放弃请求；取消复用了过按钮的上行放弃逻辑。
- **触发条件**：玩家在吃候选面板点击取消，且本次对这张弃牌还存在其他可用操作。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：面板收起，本次所有可用操作一并作废。
- **限制与禁止**：取消不是仅关闭面板，必须上送放弃请求；放弃范围包括同时存在的胡。
- **异常与边界**：无。
- **验收**：吃候选面板点取消后，吃与杠面板关闭并上送放弃，本次对这张弃牌的全部操作（含胡）作废。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1174
- **服务端职责**：消费上行 MsgCancel（放弃本次全部操作请求）。
- **客户端职责**：取消时同时关闭吃与杠面板并执行点过逻辑，上送放弃请求。
- **协作边界**：客户端本地关闭面板并上送 MsgCancel；放弃的生效范围由服务端裁决。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1174
- **原文摘录**：`onBtnCancel(): void { this.showChooseChi(false); this.showChooseGang(false); this.onBtnGuo(); }`

#### `AT-ST-C11-036` 选中一组即提交

- **规则说明**：选中一组即提交。点击某个候选选项记录其下标，并立即上送该组吃牌组合并关闭操作区。
- **触发条件**：玩家点击某一组候选顺子，候选面板处于展开状态。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：点击候选项后立即发出吃牌，面板消失。
- **限制与禁止**：无二次确认环节，点选即提交。
- **异常与边界**：无。
- **验收**：点击任一候选顺子后立即上送对应吃组合，候选面板与操作区关闭。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:158；source-code/client/Code/layer/BoxHzmjMainView.ts:1113
- **服务端职责**：消费上行 MsgChowC（所选吃组合提交）。
- **客户端职责**：点击某个候选选项记录其下标，并立即上送该组吃牌组合并关闭操作区。
- **协作边界**：客户端记录所选下标并上送 MsgChowC；吃是否成立由服务端裁决。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:158
- **原文摘录**：`this._chooseComb = (raw as fgui.GComponent).data as number; this._moreCombOnSelect?.();`

## `FP-ST-C11-009` 多种暗杠与加杠的选择面板

- **主描述**：多家可杠或多种杠法时的候选牌面板、取消语义、单张提交与单组直提。
- **范围与边界**：覆盖候选面板展示与提交逻辑；候选排序与倒计时到点可操作性未证。
- **总体协作**：点杠时若存在多组杠法展开候选，选择即提交对应一组，取消按放弃上行。

### 原子项

#### `AT-ST-C11-037` 点杠收起杠过并横向排列候选

- **规则说明**：点【杠】后收起【杠】【过】，横向排列候选牌，最右为【取消】。杠组合多于一组时打开候选列表，把可杠牌值逐张填入横向列表，并切到选择页签隐藏杠、过按钮。
- **触发条件**：本家点击杠按钮，且可杠的组合不止一组。
- **配置影响**：候选列表布局由 GangGrps.xml 配置（横向 row 布局、右对齐）。
- **客户端交互**：杠、过按钮消失，出现横向候选牌列表与取消按钮。
- **限制与禁止**：无。
- **异常与边界**：无。
- **验收**：多组杠法时点杠后，杠、过按钮退场，候选牌横向排列且取消按钮在最右。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1141；source-code/client/Fgui/assets/box_hzmj_main/component/GangGrps.xml:4
- **服务端职责**：下发 MsgPower（杠候选组合）。
- **客户端职责**：杠组合多于一组时打开候选列表，把可杠牌值逐张填入横向列表，并切到选择页签隐藏杠、过按钮。
- **协作边界**：客户端消费 MsgPower 杠候选组合；是否展开列表由本地按组合数量判断。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1141
- **原文摘录**：`if (this._chooseGangLength > 1) { this.showChooseGang(true); return; }`

#### `AT-ST-C11-038` 暗杠加杠混排与花色点数顺序

- **规则说明**：暗杠与加杠混排，顺序为万、条、筒、东、南、西、北、中、发、白，同花色按点数升序。候选牌从服务端下发的杠组合中按顺序取首张牌生成列表，暗杠与加杠共用同一列表；未见按万条筒与点数排序的本地逻辑，顺序取决于服务端组合顺序。
- **触发条件**：多种杠法候选展开，同时存在暗杠与加杠。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：候选牌混排展示，顺序沿用下发顺序。
- **限制与禁止**：无。
- **异常与边界**：「万、条、筒……同花色点数升序」未找到本地排序实现，实际顺序依赖服务端下发。
- **验收**：暗杠与加杠候选共用同一横向列表混排展示可验证；花色顺序与点数升序的排序口径依赖服务端下发顺序，客户端未验证。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:639；source-code/client/Code/layer/BoxHzmjMainView.ts:844
- **服务端职责**：下发 MsgPower（杠候选组合，含暗杠与加杠及其顺序）。
- **客户端职责**：候选牌从服务端下发的杠组合中按顺序取首张牌生成列表，暗杠与加杠共用同一列表。
- **协作边界**：客户端消费 MsgPower 杠组合原样生成候选；本地不做花色与点数排序。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:639
- **原文摘录**：`for (const comb of this._playCombs) { if (this._isGangComb(comb.flag)) { mahs.push(comb.mahs[0]); } }`

#### `AT-ST-C11-039` 倒计时归零后仍可选择

- **规则说明**：倒计时归零后仍可选择。候选列表点击回调不绑定倒计时，读秒归零只更新中央数字。
- **触发条件**：杠候选列表打开且倒计时归零，玩家尚未选择。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：读秒为 00 时仍可点候选牌。
- **限制与禁止**：无。
- **异常与边界**：仅有「未绑定倒计时」的间接证据，缺少正向验证。
- **验收**：倒计时显示 00 后杠候选牌仍可点击并提交（反向证据支持，缺正向验证）。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:848
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：候选列表点击回调不绑定倒计时，读秒归零只更新中央数字。
- **协作边界**：候选点击不消费倒计时状态；读秒显示由时钟服务单独驱动。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:848
- **原文摘录**：`grp.KW_GangGrpList.on(fgui.Event.CLICK_ITEM, (e: fgui.GObject) => { ... });`

#### `AT-ST-C11-040` 杠面板取消放弃全部操作

- **规则说明**：点【取消】等于放弃本次行牌机会里的全部操作，包括同时存在的自摸。取消时关闭杠与吃面板并执行点过逻辑，上送放弃请求。
- **触发条件**：玩家在杠候选面板点击取消，且本次还存在自摸等其他可用操作。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：候选面板关闭，本次可行操作全部作废。
- **限制与禁止**：取消不是仅关闭面板，必须上送放弃请求；放弃范围包括同时存在的自摸。
- **异常与边界**：无。
- **验收**：杠候选面板点取消后，杠与吃面板关闭并上送放弃，本次行牌机会的全部操作（含自摸）作废。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1176
- **服务端职责**：消费上行 MsgCancel（放弃本次全部操作请求）。
- **客户端职责**：取消时关闭杠与吃面板并执行点过逻辑，上送放弃请求。
- **协作边界**：客户端本地关闭面板并上送 MsgCancel；放弃的生效范围由服务端裁决。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1176
- **原文摘录**：`this.showChooseGang(false); this.onBtnGuo();`

#### `AT-ST-C11-041` 点一张候选只提交对应一组

- **规则说明**：点一张候选牌只提交对应的一组。点击候选记录下标，按该下标取出对应杠组合后上送。
- **触发条件**：玩家点击某张候选牌，候选面板展开且存在多组杠法。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：点击哪张候选就只执行那一组杠。
- **限制与禁止**：单次点击只提交一组，不批量提交。
- **异常与边界**：无。
- **验收**：点击任一张候选牌后，仅上送该张对应的杠组合，其余候选不提交。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:851；source-code/client/Code/layer/BoxHzmjMainView.ts:1150
- **服务端职责**：消费上行 MsgKongC（所选杠组合提交）。
- **客户端职责**：点击候选记录下标，按该下标取出对应杠组合后上送。
- **协作边界**：客户端按点击下标取出杠组合并上送 MsgKongC；杠是否成立由服务端裁决。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:851
- **原文摘录**：`this._chooseGang = grp.KW_GangGrpList.getChildIndex(e); this.onBtnChooseGang();`

#### `AT-ST-C11-042` 只有一组时点杠直接提交

- **规则说明**：只有 1 组时，点【杠】直接提交。杠组合只有一组时不展开候选，直接按第一组上送杠请求。
- **触发条件**：玩家点击杠按钮，且当前只有一组可杠的牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：点杠后不弹候选面板，直接完成杠。
- **限制与禁止**：单组时不允许展开候选面板。
- **异常与边界**：无。
- **验收**：仅存在一组杠组合时，点杠直接上送该组杠请求，不出现候选面板。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1141；source-code/client/Code/layer/BoxHzmjMainView.ts:1145
- **服务端职责**：消费上行 MsgKongC（唯一杠组合提交）。
- **客户端职责**：杠组合只有一组时不展开候选，直接按第一组上送杠请求。
- **协作边界**：客户端按组合数量本地判断是否展开候选；上送 MsgKongC 后杠的成立由服务端裁决。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1141
- **原文摘录**：`if (this._chooseGangLength > 1) { this.showChooseGang(true); return; }`

## `FP-ST-C11-010` 按钮文案与过、过2的差异

- **主描述**：胡、自摸按钮的文案区分，过与过2的显示与上行差异，以及多组取消等同上行过。
- **范围与边界**：覆盖按钮表现与上行行为；不含服务端对放弃后资格重算的验证。
- **总体协作**：胡与自摸通过不同皮肤呈现，过上行、过2只本地收起，取消统一复用过的上行逻辑。

### 原子项

#### `AT-ST-C11-043` 胡与自摸文案且无抢杠按钮

- **规则说明**：点炮、抢杠的按钮文案是「胡」，自摸是「自摸」。没有单独的抢杠按钮。
- **触发条件**：本家获得胡牌资格，且胡的来源为点炮、抢杠或自摸之一。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：点炮、抢杠时按钮显示「胡」，自摸时显示「自摸」；界面只定义了一个胡按钮，没有独立的抢杠按钮。
- **限制与禁止**：界面不提供单独的抢杠按钮。
- **异常与边界**：文案由动画皮肤（hu/zimo）呈现，不是文本控件；按胡牌类型选择皮肤，点炮与抢杠用胡皮肤，其余（含自摸）用自摸皮肤。
- **验收**：本家分别以点炮、抢杠、自摸三种来源获得胡牌资格时，前两者按钮显示「胡」，后者显示「自摸」，且界面上不存在独立的抢杠按钮。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:671; source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:15
- **服务端职责**：下发 MsgPower（操作资格数据，含胡牌来源类型，客户端据此选择按钮皮肤）。
- **客户端职责**：按胡牌类型选择按钮皮肤：点炮与抢杠用胡皮肤，其余（含自摸）用自摸皮肤；界面只定义了一个胡按钮。
- **协作边界**：客户端消费 MsgPower 中的胡牌类型本地选择皮肤；按钮显隐由可操作项驱动，皮肤选择为纯本地逻辑。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:671
- **原文摘录**：`if (huType == HuType.HT_DISCARD || huType == HuType.HT_ROBKONG) { return "hu"; } return "zimo";`

#### `AT-ST-C11-044` 过与过2都显示过

- **规则说明**：过和过2都显示「过」。
- **触发条件**：本家出现放弃类按钮，即可操作项包含过或过2。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：两个按钮外观一致，都显示「过」，玩家无法从外观区分。
- **限制与禁止**：无。
- **异常与边界**：两个按钮是独立控件，皮肤相同，初始化时统一设为过外观。
- **验收**：出现放弃类按钮时，过与过2两个按钮都渲染为「过」的外观，视觉上无法区分。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:319; source-code/client/Code/layer/BoxHzmjMainView.ts:320
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：初始化时把过与过2两个按钮的动作皮肤都设为「过」。
- **协作边界**：纯本地渲染行为，不涉及服务端消息消费。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:319
- **原文摘录**：`this.view.KW_Main.KW_Handler.KW_BTN_Guo.KW_Ani.skinName = "guo";`

#### `AT-ST-C11-045` 过上行放弃

- **规则说明**：过上行放弃。
- **触发条件**：玩家点击「过」，且当前存在一次操作提示。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：点过后按钮收起，放弃结果由服务端确认。
- **限制与禁止**：无。
- **异常与边界**：无。
- **验收**：点击「过」后客户端带当前操作序号上送放弃请求并关闭本家操作区，本次操作机会结束，其他玩家的响应可以继续推进。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1237; source-code/client/Code/controller/gameController.ts:461
- **服务端职责**：接收客户端上送 MsgCancel（CS_CANCEL_C 放弃请求），裁决放弃结果并推进后续流程。
- **客户端职责**：点过时带当前操作序号上送放弃请求，然后关闭本家操作区。
- **协作边界**：客户端点击过时上送 MsgCancel（CS_CANCEL_C）；放弃是否生效由服务端裁决，客户端只负责本端操作区关闭。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1237
- **原文摘录**：`GameController.instance.sendCancel();`

#### `AT-ST-C11-046` 过2只本地收起并重置压暗

- **规则说明**：过2只在本地收起按钮并清掉本次压暗，再按禁手重新压暗，不上行。
- **触发条件**：玩家点击「过2」，且本次提示允许本地取消。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：按钮收起，手牌先恢复亮度再按禁手规则重新置灰。
- **限制与禁止**：过2不上行，点过2不发任何上行消息。
- **异常与边界**：常量注释里「过1/过2」的编号与界面上的过/过2相反，但「需发回服务端/无需回包」的语义与实现一致。
- **验收**：点击「过2」后无上行消息发出，操作区收起、选择清空、本次压暗清除，随后按禁打配置重新置灰手牌，禁手牌保持灰色。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1246; source-code/client/Code/layer/BoxHzmjMainView.ts:1262; source-code/client/Code/layer/BoxHzmjMainView.ts:1277
- **服务端职责**：下发 MsgPlayLmts（禁打配置数据，客户端重新压暗手牌时读取）。
- **客户端职责**：点过2不发上行消息，只关闭操作区、清空选择并清除压暗，随后按禁打配置重新上手牌灰态。
- **协作边界**：不上行任何消息；压暗恢复与重新置灰均为本地逻辑，禁打数据来自已缓存的 MsgPlayLmts。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1246
- **原文摘录**：`onBtnGuo2(): void { // 过2（CANCEL_C：本地取消操作按钮，无需回包）`

#### `AT-ST-C11-047` 多组吃杠取消等同上行过

- **规则说明**：多组吃、杠的取消等于上行过。
- **触发条件**：玩家在多组吃或杠的候选面板点击「取消」，候选面板处于展开状态。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：取消后吃、杠候选面板关闭、按钮收起，并完成一次上行放弃。
- **限制与禁止**：无。
- **异常与边界**：无。
- **验收**：候选面板展开时点击取消，面板关闭并提交放弃，本次操作机会结束，等同点过。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1174
- **服务端职责**：接收客户端上送 MsgCancel（放弃请求），裁决放弃结果。
- **客户端职责**：候选面板取消时统一调用过的处理，包含上送放弃。
- **协作边界**：客户端本地关闭面板后复用过的上行逻辑上送 MsgCancel；放弃生效与否由服务端裁决。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1174
- **原文摘录**：`onBtnCancel(): void { this.showChooseChi(false); this.showChooseGang(false); this.onBtnGuo(); }`

## `FP-ST-C11-011` 与摸牌无关的杠提示下的出牌豁免

- **主描述**：存在杠但无胡、且可杠牌都不是刚摸牌时，手牌不压暗且不点过也能出牌。
- **范围与边界**：覆盖亮度与出牌拦截；不含服务端杠资格校验。
- **总体协作**：该豁免同时作用于手牌压暗与出牌拦截两处判定。

### 原子项

#### `AT-ST-C11-048` 无关杠时不压暗且可直接出牌

- **规则说明**：有杠、没有胡，且所有可杠牌都不是刚摸的那张时，手牌不压暗，不点过也能出牌。
- **触发条件**：摸牌后出现杠提示，且没有胡提示，可杠的牌都不是刚摸进来的那张。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：手牌保持正常亮度，可直接打出，不弹「点过才能出牌」提示。
- **限制与禁止**：无。
- **异常与边界**：本规则本身是对「杠提示必须先过才能出牌」拦截的例外；与暗杠例外共用同一判定标记。
- **验收**：构造有杠、无胡且所有可杠牌都不是刚摸牌的局面，手牌不压暗、不点过也能直接出牌，不出现必须先过提示。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:692; source-code/client/Code/layer/BoxHzmjMainView.ts:713; source-code/client/Code/layer/BoxHzmjMainView.ts:1453
- **服务端职责**：下发 MsgPower（操作资格数据，含杠提示与胡提示，客户端本地判定豁免）。
- **客户端职责**：识别与摸牌无关的杠后，跳过压暗并在出牌拦截判定中放行，不弹必须先过提示。
- **协作边界**：客户端消费 MsgPower 的操作项数据，本地判定可杠牌与刚摸牌的关系并决定压暗与拦截放行；服务端不参与该展示层豁免判定。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:692
- **原文摘录**：`private _updateGangOffMoCard(powerState: IPowerShowState, PowerData: IPower): void {`

## `FP-ST-C11-012` 听牌详情与箭头标注

- **主描述**：打出后听任意一张时的固定详情文案，以及财神候选标飘、其余标爆与箭头收敛。
- **范围与边界**：覆盖听牌弹窗与手牌箭头标注；不含听牌张数统计口径。
- **总体协作**：听牌数据到达后同时刷新弹窗详情与手牌箭头样式。

### 原子项

#### `AT-ST-C11-049` 万能听的固定详情文案

- **规则说明**：打出后听任意一张时，听牌详情固定为「爆头2番」「摸任意一张可胡」。
- **触发条件**：自己打出一张牌后可以听任意牌，即听牌数据里出现任意牌哨兵。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：弹窗固定显示「爆头2番」与「摸任意一张可胡」两行文案，胡张数显示为「胡」，隐藏牌组列表。
- **限制与禁止**：无。
- **异常与边界**：两句文案为组件内固定文本，仅在爆头状态下显示。
- **验收**：万能听局面打开听牌详情，固定展示「爆头2番」「摸任意一张可胡」两句文案且不显示牌组列表。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTingPaiView.ts:49; source-code/client/Fgui/assets/box_hzmj_tingPai/component/TingCard.xml:24; source-code/client/Fgui/assets/box_hzmj_tingPai/component/TingCard.xml:27
- **服务端职责**：下发 MsgWaitInfos（听牌数据，含任意牌哨兵，触发爆头展示）。
- **客户端职责**：听牌数据含任意牌哨兵时切换到爆头展示页，隐藏牌组列表并固定显示两句详情。
- **协作边界**：客户端消费 MsgWaitInfos 判定是否万能听；详情文案与展示样式完全本地固定。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjTingPaiView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjTingPaiView.ts:49
- **原文摘录**：`this.view.KW_Main.C_BaoTou.selectedIndex = this._isBaoTou ? 1 : 0;`

#### `AT-ST-C11-050` 财神候选标飘否则标爆

- **规则说明**：候选牌是财神时听牌标为「飘」，否则为「爆」。
- **触发条件**：自己某张手牌打出后能听任意牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：手牌出现「飘」或「爆」的听牌标记，财神牌标飘、其他牌标爆。
- **限制与禁止**：无。
- **异常与边界**：无。
- **验收**：万能听候选中，财神牌面显示飘标记，其余候选显示爆标记。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:192; source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:193
- **服务端职责**：下发 MsgWaitInfos（听牌数据，客户端据此判定每张手牌的听牌标记）。
- **客户端职责**：判断某张手牌打出后是否万能听，若是则按该牌是否为财神在牌面上打飘或爆标记。
- **协作边界**：客户端消费 MsgWaitInfos 与财神牌值，本地判定标记类型。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:192
- **原文摘录**：`const isJokerCard = item.mahValue === jokerMah;`

#### `AT-ST-C11-051` 存在爆飘时其余只留箭头

- **规则说明**：同一手只要有一张这样（打出后可听任意牌），其余可听牌只留箭头。
- **触发条件**：同一手牌中存在打出后可听任意牌的张，且该手牌还有其他可听牌张。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：只有爆或飘的牌带特殊标注，其余可听牌仅显示箭头。
- **限制与禁止**：无。
- **异常与边界**：无。
- **验收**：同一手存在万能听候选时，其余可听牌的标注降为普通箭头样式，特殊标注只出现在爆或飘的牌上。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:176; source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:200
- **服务端职责**：下发 MsgWaitInfos（听牌数据，客户端本地做标注收敛）。
- **客户端职责**：先扫描是否存在万能听，若有则把其余可听牌的标注降为普通箭头样式。
- **协作边界**：客户端消费 MsgWaitInfos 后本地完成标注收敛判定。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:176
- **原文摘录**：`let hasBaoOrPiao = false;`

## `FP-ST-C11-013` 吃碰副露展示

- **主描述**：吃、碰成立后副露组的正面展示、牌序、来源箭头位置与新增顺序。
- **范围与边界**：覆盖副露数据生成、牌序与箭头定位；牌面渲染组件来自平台包。
- **总体协作**：吃碰消息到达后生成副露数据、从牌河收牌并把箭头指到进牌实际槽位。

### 原子项

#### `AT-ST-C11-052` 吃成立新增正面顺子且升序

- **规则说明**：吃成立后，碰杠区新增一组正面顺子，按点数从小到大摆放。
- **触发条件**：吃成立，且该玩家还没有这组顺子。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：碰杠区出现一组三张正面顺子，按点数从小到大排列。
- **限制与禁止**：无。
- **异常与边界**：展示牌序由组合数据统一升序生成，杠不参与升序。
- **验收**：吃成立后副露区新增一组三张正面顺子，且三张按点数升序排列。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:895; source-code/client/Code/config/BoxMahDefine.ts:819; source-code/client/Code/config/BoxMahDefine.ts:458
- **服务端职责**：下发 MsgChowS（吃成立数据，含组合牌与进牌信息）。
- **客户端职责**：吃消息生成副露数据并按牌值升序构造展示牌序，然后追加到该玩家副露区。
- **协作边界**：客户端消费 MsgChowS 生成副露数据；升序为本地排序逻辑。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMah2DView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:895
- **原文摘录**：`this.combos[_localSeat].addCombo(_combo);`

#### `AT-ST-C11-053` 吃牌来源箭头叠在进牌上

- **规则说明**：以吃牌者视角，来源箭头「←」叠在吃到的那张牌上。
- **触发条件**：吃成立并生成副露，进牌在顺子中有确定位置。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：箭头叠加在吃到的那张牌上。
- **限制与禁止**：无。
- **异常与边界**：无法定位进牌槽位时，箭头回落到中间张。
- **验收**：吃成立后来源箭头位于进牌实际槽位上方；定位失败时回落到中间张。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:938; source-code/client/Code/layer/BoxHzmjMah2DView.ts:947
- **服务端职责**：下发 MsgChowS（含进牌信息，客户端据此定位箭头槽位）。
- **客户端职责**：副露生成后按进牌在展示牌序中的实际槽位移动来源箭头，无法定位时回落到中间张。
- **协作边界**：客户端消费 MsgChowS 的进牌数据本地计算槽位；箭头图形由平台副露组件提供，本仓库负责定位。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMah2DView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:938
- **原文摘录**：`const target = item.getChild("mah" + this._resolveInMahSlot(display, comboData));`

#### `AT-ST-C11-054` 碰成立三张正面展示

- **规则说明**：碰成立后，碰牌组三张都正面展示。
- **触发条件**：该玩家完成一次碰。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：碰牌组三张牌正面可见。
- **限制与禁止**：无。
- **异常与边界**：副露牌面渲染由平台副露组件完成，本仓库只生成数据与展示牌序；该组有进牌时会先从来源座位牌河移除最后一张。
- **验收**：碰成立后副露区出现三张同牌正面朝上的刻子，牌面按真实牌值展示。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:34; source-code/client/Code/layer/BoxHzmjMah2DView.ts:892
- **服务端职责**：下发 MsgPungS（碰成立数据，含组合与来源座位）。
- **客户端职责**：碰消息生成三张刻子副露数据并追加到副露区，牌面按真实牌值展示。
- **协作边界**：客户端消费 MsgPungS 生成副露并从牌河收牌；牌面渲染交给平台副露组件。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:34
- **原文摘录**：`const comboData = GameData.getPlayerCardsData(localSeat)?.setCombo(data.comb as ICombInfo, data.seat);`

#### `AT-ST-C11-055` 碰的箭头叠在中间一张

- **规则说明**：以来源视角，箭头叠在中间一张：上家←、对家↑、下家→。
- **触发条件**：碰成立，且该碰有明确的来源玩家。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：碰牌组中间那张牌上出现方向箭头，方向按来源为上家←、对家↑、下家→。
- **限制与禁止**：无。
- **异常与边界**：进牌无效（小于等于 0）或等于展示序中间张时，槽位判定回落为中间张（下标 1）。
- **验收**：碰成立后箭头位于三张牌的中间一张，方向按来源座位换算为上家、对家或下家。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:960; source-code/client/Code/data/PlayerCardsData.ts:152
- **服务端职责**：下发 MsgPungS（含来源座位，客户端本地换算方向与槽位）。
- **客户端职责**：碰牌进牌位于展示序中间时箭头回落到中间张；来源方向由来源座位换算后决定。
- **协作边界**：客户端消费 MsgPungS 的来源座位本地做座位换算与槽位定位；方向箭头图形与朝向由平台副露组件按来源座位选择。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMah2DView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:960
- **原文摘录**：`if (inMah <= 0 || display[1] === inMah) { return 1; }`

#### `AT-ST-C11-056` 新副露组按成立顺序从左往右追加

- **规则说明**：吃、碰、直杠、暗杠的新牌组按成立顺序从左往右追加。
- **触发条件**：吃、碰、直杠或暗杠成立，且该玩家已有其他副露。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：新副露出现在已有副露之后，顺序与成立先后一致。
- **限制与禁止**：无。
- **异常与边界**：追加顺序已证（数据层保持成立先后顺序），但左右方向由平台副露组件排布，本仓库未定义，缺少界面证据。
- **验收**：多次吃碰杠成立后，副露组的先后顺序与成立顺序一致；从左往右的视觉方向依赖平台组件排布，待界面确认。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:895; source-code/client/Code/data/PlayerCardsData.ts:134
- **服务端职责**：下发 MsgChowS、MsgPungS、MsgKongS（各类副露成立数据，客户端按到达顺序追加）。
- **客户端职责**：每次成立都把新副露追加到该玩家副露列表末尾，数据层保持成立先后顺序。
- **协作边界**：客户端消费各副露成立消息按到达顺序本地追加；左右排布方向由平台组件渲染。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMah2DView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:895
- **原文摘录**：`this.combos[_localSeat].addCombo(_combo);`

## `FP-ST-C11-014` 杠的副露标记

- **主描述**：直杠、加杠、暗杠的标记形式、标记位置、加杠沿用原组以及补牌与连续杠的表现。
- **范围与边界**：覆盖杠副露的数据分支与字效复用；标记图形与分隔位由平台渲染。
- **总体协作**：按杠类型区分新增一组或补入原碰牌组，并复用同一座位字效节点播放杠。

### 原子项

#### `AT-ST-C11-057` 直杠箭头、加杠补、暗杠手掌

- **规则说明**：直杠用来源箭头，加杠标记为【补】，暗杠用手掌标记。
- **触发条件**：杠成立，且杠属于直杠、加杠或暗杠之一。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：三类杠在副露上呈现不同标记，直杠带来源箭头、加杠显示补、暗杠显示手掌。
- **限制与禁止**：无。
- **异常与边界**：杠类型区分（按组合 flag 分派明杠、补杠、暗杠分支）已证；「补」与手掌标记图形由平台副露组件绘制，本仓库无对应资源或代码，待界面确认。
- **验收**：三种杠类型成立后副露按类型区分处理分支；补、手掌的图形表现依赖平台组件，待确认。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:50; source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:63
- **服务端职责**：下发 MsgKongS（杠成立数据，含组合类型标志 flag）。
- **客户端职责**：按杠组合类型分派：明杠、暗杠走新增副露，补杠走补入原碰牌组，并分别播放对应动作。
- **协作边界**：客户端消费 MsgKongS 的组合 flag 本地分派杠类型；标记图形渲染交给平台副露组件。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:50
- **原文摘录**：`switch (data.comb?.flag) { case CMF_MKONG: kongType = TYPE_MKONG; break; case CMF_CKONG: ... case CMF_TKONG: ... }`

#### `AT-ST-C11-058` 标记叠在杠组第4张

- **规则说明**：标记都叠在杠牌组最上方居中的第 4 张。
- **触发条件**：杠成立且存在杠组标记。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无。
- **异常与边界**：本仓库未定义杠组第四张与标记的叠放关系，推理应由平台副露组件处理。
- **验收**：界面层确认杠标记叠放在杠组最上方居中的第 4 张，待平台组件证据补充。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：本仓库未实现该叠放逻辑，推理由平台副露组件渲染，待确认。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C11-059` 直杠暗杠新增、加杠沿用原位置

- **规则说明**：直杠、暗杠在碰杠区新增一组；加杠补入原碰牌组，沿用原位置。
- **触发条件**：杠成立，杠是直杠、暗杠或加杠。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：加杠后原碰牌组就地变为杠组，不新增位置；直杠、暗杠在副露区新增一组。
- **限制与禁止**：无。
- **异常与边界**：补杠按原组合标志为碰（CMF_PONG）且首张牌值相同来定位原碰牌组，用新组合原位替换。
- **验收**：直杠、暗杠成立后副露区新增一组；加杠成立后原碰牌组位置不变、内容替换为杠组。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/PlayerCardsData.ts:106; source-code/client/Code/layer/BoxHzmjMah2DView.ts:910
- **服务端职责**：下发 MsgKongS（杠成立数据，含组合类型与牌值）。
- **客户端职责**：补杠时找到同牌值的原碰牌组，用新组合替换该位置；其余杠类型直接追加新组。
- **协作边界**：客户端消费 MsgKongS 本地判定杠类型并选择替换或新增分支。
- **来源文件**：`source-code/client/Code/data/PlayerCardsData.ts`
- **来源定位**：source-code/client/Code/data/PlayerCardsData.ts:106
- **原文摘录**：`if (tcom.nFlag == BoxMahDefine.CombType.CMF_PONG && tcom.nMahs[0] == combo.mahs[0]) { ... this.combo[i] = comboData; }`

#### `AT-ST-C11-060` 补牌落入最右分隔位与杠字叠加

- **规则说明**：补牌落入最右分隔位，可与「杠」字同时出现。
- **触发条件**：杠成立后本家补牌到手。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无。
- **异常与边界**：未找到补牌在手牌最右分隔位的放置逻辑，也未找到与杠字叠加的处理；推理由平台渲染。
- **验收**：界面层确认补牌位于手牌最右分隔位且可与杠字同时显示，待平台证据补充。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：本仓库未实现该放置与叠加逻辑，推理由平台组件渲染，待确认。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C11-061` 连续杠新杠字覆盖旧字

- **规则说明**：连续杠时，新的「杠」字覆盖仍在播放的上一个。
- **触发条件**：同一玩家连续完成杠，且上一个杠字还在播放。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：新的杠字立即顶替上一个仍在播放的杠字，玩家只看到最新一次的杠字。
- **限制与禁止**：无。
- **异常与边界**：未显式停止上一段动画，靠复用同一节点（每个座位一个杠字效节点）自然覆盖。
- **验收**：同一座位短时间内连续两次杠，画面上只出现最新一次的杠字，旧字效不残留。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:486; source-code/client/Code/layer/BoxHzmjTipAniView.ts:524
- **服务端职责**：下发 MsgKongS（杠成立数据，触发杠字效播放）。
- **客户端职责**：每个座位只有一个杠字效节点，新一次杠直接复用该节点重置皮肤并重新播放。
- **协作边界**：客户端消费 MsgKongS 触发本地字效播放；覆盖行为纯本地节点复用。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjTipAniView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:486
- **原文摘录**：`const actionAniNode = this._pengGangAni[localSeat];`

## `FP-ST-C11-015` 字效与结束亮牌

- **主描述**：吃碰杠胡的方位字效，以及小局结束后的对局结束提示、亮牌、番型与飘分表现。
- **范围与边界**：覆盖字效、亮牌、胡牌张位置与飘分显示；描边颜色与新牌位置细节未全证。
- **总体协作**：动作消息驱动座位字效，结算消息驱动亮牌、番型与飘分。

### 原子项

#### `AT-ST-C11-062` 吃碰杠胡在操作者方位播字效

- **规则说明**：吃、碰、杠、胡成立时，在操作者对应方位播放对应字效。
- **触发条件**：吃、碰、杠或胡成立，且有明确的操作者座位。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：在操作者对应方位播放对应字效，操作者所在方位弹出吃、碰、杠、胡的大字。
- **限制与禁止**：无。
- **异常与边界**：胡的字效由番型动画节点承担，其余三类由碰杠字效节点承担。
- **验收**：吃、碰、杠、胡任一动作成立后，在操作者座位方位可看到对应类型的字效；动作类型与字效一一对应。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:43；source-code/client/Code/layer/BoxHzmjTipAniView.ts:484；source-code/client/Fgui/assets/box_hzmj_tipAni/component/HzmjTipAniComponent.xml:44
- **服务端职责**：下发 MsgChowS、MsgPungS、MsgKongS、MsgResultHu（携带动作类型与操作者座位，驱动对应字效）。
- **客户端职责**：吃、碰、杠按操作者座位取对应字效节点并按类型切换皮肤播放；胡按座位播放番型动画。
- **协作边界**：客户端消费动作消息中的操作者座位与动作类型，本地完成字效节点选取、皮肤切换与播放，不做合法性判断。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:43
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.onMsgPlayPengGang, BoxMahDefine.ActionAniType.TYPE_CHOW, localSeat);`

#### `AT-ST-C11-063` 自摸确认后对局结束并亮牌

- **规则说明**：自摸确认后显示「对局结束」并亮出各家手牌。
- **触发条件**：自摸胡牌确认，本小局以胡牌结束。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：屏幕中央出现对局结束提示，四家手牌同时亮出。
- **限制与禁止**：无。
- **异常与边界**：结束类型由 C_GameEnd 控制器区分（none、hu、drawn、pass、quick），胡牌走对应页。
- **验收**：自摸结算消息到达后，出现「对局结束」提示且所有玩家手牌翻到正面。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:84；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1186；source-code/client/Code/layer/BoxHzmjMah2DView.ts:1059；source-code/client/Fgui/assets/box_hzmj_tipAni/component/HzmjTipAniComponent.xml:3
- **服务端职责**：下发 MsgResultHu（携带 end_type，驱动对局结束展示与亮牌）。
- **客户端职责**：结算消息到达时按结束类型切到对局结束页，并把所有玩家手牌翻到正面。
- **协作边界**：客户端消费结算消息的 end_type，本地切换结束页状态并翻牌，不判断胜负归属。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:84
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.onShowGameEndType, data.end_type);`

#### `AT-ST-C11-064` 自摸胡牌张单列在右侧

- **规则说明**：胡牌张单独摆在胡牌者手牌右侧。
- **触发条件**：自摸胡牌确认进入摊牌，胡牌者需要展示胡牌张。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：胡牌张出现在手牌最右侧。
- **限制与禁止**：无。
- **异常与边界**：实现为拼接到手牌末尾一并展示，并把本家手牌整体缩小；未见与手牌之间留出间隔的单列摆放。
- **验收**：自摸摊牌后胡牌张位于胡牌者手牌最右端可见；与手牌间隔开的「单独摆放」样式未在代码中验证，待确认。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:984；source-code/client/Code/layer/BoxHzmjMah2DView.ts:1057
- **服务端职责**：下发 MsgResultHu（携带胡牌张数据，驱动摊牌展示）。
- **客户端职责**：摊牌时把胡牌张拼接在手牌末尾一并展示，并把本家手牌整体缩小。
- **协作边界**：客户端消费结算消息中的胡牌张数值，本地拼接到手牌末尾展示；「单独摆放」的分隔实现由客户端展示层负责，未见证据。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMah2DView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:984
- **原文摘录**：`this.resetHandCards(localSeat, cards.concat(huValue));`

#### `AT-ST-C11-065` 点炮抢杠胡同样结束并亮牌

- **规则说明**：点炮胡、抢杠胡同样显示「对局结束」和亮牌。
- **触发条件**：点炮胡或抢杠胡成立，本小局以胡牌结束。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：点炮或抢杠胡后同样出现对局结束提示并亮出各家手牌。
- **限制与禁止**：无。
- **异常与边界**：end_type 为 ET_NONE 时不派发结束类型展示，其余按胡牌结束统一处理。
- **验收**：点炮胡、抢杠胡结算后同样出现「对局结束」提示且四家手牌亮出，与自摸路径表现一致。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:83；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:303
- **服务端职责**：下发 MsgResultHu（携带 end_type，区分结束类型后统一驱动结束与亮牌流程）。
- **客户端职责**：结束类型为胡牌时统一走对局结束与全桌亮牌流程，不区分自摸或点炮。
- **协作边界**：客户端消费结算消息的 end_type，本地复用同一结束与亮牌流程；是否自摸/点炮不影响客户端展示路径。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:83
- **原文摘录**：`if (data.end_type !== EndType.ET_NONE) { this.dispatch(GameEventBoxHzmj.onShowGameEndType, data.end_type); }`

#### `AT-ST-C11-066` 胡牌张尾端带描边与来源箭头

- **规则说明**：胡牌张在胡牌者手牌尾端，带浅绿描边和来源箭头。
- **触发条件**：点炮或抢杠胡摊牌，胡牌张来自其他玩家。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：尾端胡牌张上方出现来源方向箭头。
- **限制与禁止**：无。
- **异常与边界**：尾端与来源箭头已证；浅绿描边依赖牌面组件状态，颜色未验证；huFromSeat 为 NONE 时不设置来源箭头。
- **验收**：摊牌后胡牌张位于胡牌者手牌尾端并带来源方向箭头；浅绿描边颜色由牌面组件状态承担，具体颜色待美术资源验证。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:987；source-code/client/Code/layer/BoxHzmjMah2DView.ts:1062
- **服务端职责**：下发 MsgResultHu（携带胡牌来源座位信息，驱动来源箭头展示）。
- **客户端职责**：胡牌张拼在手牌末尾，并按胡牌来源座位设置手牌的方向箭头来源。
- **协作边界**：客户端消费结算消息中的胡牌来源座位，本地换算箭头方向并叠加到尾端胡牌张；描边颜色属牌面组件表现，未验证。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMah2DView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:987
- **原文摘录**：`this.hands[localSeat].setHuFromSeat(huFromSeat);`

#### `AT-ST-C11-067` 赢家显示番型放铳者显示点炮

- **规则说明**：赢家方位显示番型，放铳者方位显示「点炮」。
- **触发条件**：胡牌结算，胡牌有明确来源玩家。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：赢家一侧显示番型字效，放铳者一侧显示点炮字效。
- **限制与禁止**：无。
- **异常与边界**：点炮动画皮肤按点炮与一炮多响等胡动画类型区分。
- **验收**：胡牌结算后赢家座位方位播放对应番型动画，放铳者座位方位播放点炮动画，两侧同时可见。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:266；source-code/client/Code/layer/BoxHzmjTipAniView.ts:891；source-code/client/Code/layer/BoxHzmjTipAniView.ts:966
- **服务端职责**：下发 MsgResultHu（携带胡动画类型与放铳来源座位，驱动番型与点炮字效）。
- **客户端职责**：胡牌方按番型在本人方位播番型动画，放铳方按点炮或一炮多响类型在放铳者方位播点炮动画。
- **协作边界**：客户端消费结算消息中的胡动画类型与来源座位，本地选取皮肤与方位播放；番型归属判断由服务端完成。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:266
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.onMsgHuDianPaoAni, huAniType, context.dfFrom);`

#### `AT-ST-C11-068` 按座位飘分正黄负灰

- **规则说明**：随后按座位飘分，正分黄色，负分灰色。
- **触发条件**：胡牌番型展示完成，本局存在输赢分。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：各座位依次飘出分数，正分与负分使用不同字体表现。
- **限制与禁止**：无。
- **异常与边界**：代码仅按分数正负切换 fnt_win/fnt_lose 字体，黄/灰颜色由字体资源决定，未单独验证颜色。
- **验收**：番型动画完成后各座位依次飘出各自分数，正分与负分使用不同字体（fnt_win/fnt_lose）；黄/灰具体颜色由字体资源决定，待资源验证。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:276；source-code/client/Code/layer/BoxHzmjTipAniView.ts:567
- **服务端职责**：下发 MsgResultHu（携带各座位得分，驱动按座位飘分）。
- **客户端职责**：番型动画完成后按座位逐个显示得失分，并按分数正负选择胜利或失败字体。
- **协作边界**：客户端消费结算消息中的各座位分数，本地按正负切换字体并依次飘分；颜色表现依赖字体资源。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:276
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.onShowResultScore, true);`
