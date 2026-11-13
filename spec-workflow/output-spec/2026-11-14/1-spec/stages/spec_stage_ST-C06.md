# 杠后补牌

> 阶段 ID：`ST-C06`。来源：模板「行牌 > 杠后补牌」章节。客户端视角规格，客户端逻辑与 UI 交互以 Code/Fgui 代码证据支撑。

## 0. 阶段

- **阶段 ID**：`ST-C06`
- **阶段**：杠后补牌
- **来源章节**：行牌 > 杠后补牌
- **涉及协议消息**：MsgTake、MsgKongS、MsgWallMah、MsgDrawn、MsgResultHu、MsgPower、MsgKongC、MsgHuC、MsgPlayC、MsgPlayS、MsgPungS、MsgChowS、MsgPiao
- **涉及 UI 模块**：BoxHzmjMainView、BoxHzmjMah2DView、BoxHzmjMahRightComp、BoxHzmjTipAniView、box_hzmj_tipAni
- **阶段概述**：杠成立后从牌墙尾部补抓 1 张并扣减余牌，牌墙不足 21 张不得杠、摸牌前余 20 张及以下判黄庄；杠后可续杠或自摸，不胡则继续杠或打出 1 张，杠链随杠累加、被吃碰或打牌打断归零。

## 术语与单位（有则填）

| 术语 | 定义 | 单位/量纲 | 作用域 | 来源 |
| --- | --- | --- | --- | --- |
| 面子 | 一组顺子、刻子或杠；杠含 4 张仍计 1 组面子，对子不是面子。已完成的吃、碰、明杠、暗杠都计入面子。 | 组（顺子、刻子、杠各计 1 组） | 胡牌判定与副露计数 | 模板 名词（第 11 行） |
| 财神 | 白板固定为财神，只在胡牌判定时代替顺子、刻子或对子所缺的牌；吃、碰、杠必须用真实非财神牌，不能用财神代替。 | 牌张（固定白板） | 胡牌判定与吃碰杠限制 | 模板 名词（第 12 行） |
| 流局 | 牌墙剩 21 张时当前玩家再摸 1 张后剩 20 张，先完成本次摸打与弃牌响应；无人胡牌时在下一次应摸牌前判黄庄，不是剩 20 张立刻结束。 | 张（牌墙余量阈值 20 张） | 一局收尾判定 | 模板 名词（第 20 行） |
| 杠链 | 玩家连续开杠的次数。明杠、暗杠、加杠各使杠链加 1；吃、碰、打出非财神、打出财神但打出后不再敲响都使杠链归零；杠链长度决定杠上开花、二连杠、三连杠、四连杠档位。 | 次（连续开杠计数） | 一局行牌全程（连杠档位判定） | 模板 行牌 > 杠后补牌（第 75 行）；代码 source-code/client/Code/config/FanDefine.ts:25-32 |
| 加杠（补杠） | 已碰的刻子再加第 4 张形成的杠；客户端把它作为独立的补杠类型做动作动画与副露渲染。 | 组（4 张计 1 组面子） | 杠操作表现（动作动画与副露渲染） | 代码 source-code/client/Code/config/BoxMahDefine.ts:220；source-code/client/Code/layer/BoxHzmjMah2DView.ts:907-913 |

## 跨切面行为（无原子也列）

- **行牌资格服务端权限下发**：行牌资格（杠、出牌、胡）全部由服务端权限下发，客户端只按权限位显示按钮与置灰手牌，不做牌墙余量门槛、杠链计数等规则判定 —— 跨切面（source-code/client/Code/layer/BoxHzmjMainView.ts:549-560；source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:50-57）。
- **重连补数据不播动画**：重连补数据模式下行牌命令只更新缓存不播动画，杠、抓牌、出牌三类命令均遵守该约定 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:24-27,42-44；source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:39-51）。
- **牌墙剩余张数统一广播刷新**：牌墙剩余张数在发牌、抓牌、重连恢复时统一广播刷新，牌墙右侧组件以数字标题展示剩余张数 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:289；source-code/client/Code/layer/comp/BoxHzmjMahRightComp.ts:26-34）。
- **杠动作三型分流**：杠动作按明杠、暗杠、补杠三型分别播不同动作音效与副露渲染，补杠走单独的补杠渲染通道 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:49-73；source-code/client/Code/layer/BoxHzmjMah2DView.ts:890-913）。

## `FP-ST-C06-001` 杠后补牌与牌墙余量

- **主描述**：杠成立后从牌墙尾部补抓 1 张并扣减牌墙余量；牌墙不足 21 张不得杠；摸牌前剩 20 张及以下判黄庄。
- **范围与边界**：包含补牌的取牌方向与张数、余牌扣减与剩余张数展示、杠前牌墙余量门槛、流局判定时机；不包含杠的成立判定与杠链计数（见后两个功能点）。
- **总体协作**：服务端下发杠结果与补牌抓牌结果，客户端按抓牌通知里的方向与张数取牌并刷新牌墙剩余张数；杠资格与流局时机均不由客户端判断。

### 原子项

#### `AT-ST-C06-001` 杠后从牌墙尾部补 1 张

- **规则说明**：每次杠从牌墙尾部补 1 张。
- **触发条件**：任一玩家开杠，服务端把这次补牌作为一次抓牌通知下发，且方向为从牌墙尾部取牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：取到的牌插入该家手牌并亮出这张牌，非自己时按手牌计数更新；同时刷新牌墙剩余张数。
- **限制与禁止**：客户端既不判断补几张，也不决定从牌头还是牌尾取，完全按服务端下发的方向与张数执行。
- **异常与边界**：协议里另有 is_kong_take_asc 字段但客户端未使用，无法从客户端证明杠后固定走尾部。
- **验收**：杠后收到方向为反向（尾部）、张数为 1 的抓牌通知时，牌墙取牌走反向分支从尾部取 1 张，插入开杠玩家手牌并亮出，牌墙剩余数字随之刷新。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:88-91；source-code/client/Code/data/GameData.ts:723-726；source-code/client/Code/lib/proto_game_hzmj.d.ts:1151-1155
- **服务端职责**：下发 MsgKongS（杠结果）与 MsgTake（以 dir、tcnt 指定补牌方向与张数）。
- **客户端职责**：杠后补牌没有独立事件，统一由抓牌通知驱动：抓牌命令使用通知中的方向与张数调用牌墙取牌，牌墙取牌方法区分正向抓牌与反向（尾部）抓牌两个分支，反向分支从尾部索引逐张取牌。
- **协作边界**：客户端消费 MsgTake 的方向与张数执行取牌与摸牌表现；补牌张数与取牌方向的判定在服务端，客户端不做本地规则判定。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:88-91
- **原文摘录**：`if (!isTakeFirst) { return GameData.takeWalls(data.dir, data.tcnt); }`

#### `AT-ST-C06-002` 补牌后牌墙余牌减 1

- **规则说明**：杠补牌后牌墙余牌减 1。
- **触发条件**：任一玩家抓牌或杠后补牌，客户端收到抓牌通知。
- **配置影响**：牌墙显示受对局内牌墙开关控制。
- **客户端交互**：牌墙右侧数字在每次抓牌与补牌后刷新，重连恢复时也按剩余张数重刷；牌墙显示受对局内牌墙开关控制。
- **限制与禁止**：无。
- **异常与边界**：扣减量等于服务端下发的取牌张数，客户端没有固定减 1 的常量；补牌恰好 1 张由服务端保证。
- **验收**：每次抓牌与补牌后牌墙余量按本次取牌张数扣减，牌墙右侧组件标题刷新为新剩余张数；开局牌墙出现时同步剩余张数。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/GameData.ts:738；source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:289；source-code/client/Code/layer/comp/BoxHzmjMahRightComp.ts:26-28；source-code/client/Code/controller/cmd/gameCmd/GameWallMahCmd.ts:43-44
- **服务端职责**：下发 MsgTake（抓牌通知驱动余量扣减与广播）与 MsgWallMah（开局牌墙出现时同步剩余张数）。
- **客户端职责**：牌墙取牌方法按本次取牌张数扣减剩余张数；抓牌命令随后广播牌墙剩余张数，牌墙右侧组件把新数值写入标题文本。
- **协作边界**：客户端消费抓牌通知在本地按取牌张数扣减余量并刷新展示；补牌恰好减 1 由服务端下发的取牌张数保证。
- **来源文件**：`source-code/client/Code/data/GameData.ts`
- **来源定位**：source-code/client/Code/data/GameData.ts:738
- **原文摘录**：`this._wallLeftNum -= nTcnt;`

#### `AT-ST-C06-003` 牌墙少于 21 张不能杠

- **规则说明**：牌墙少于 21 张不能杠。
- **触发条件**：牌墙剩余张数少于 21 张时的开杠时机（客户端无对应实现）。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无。
- **异常与边界**：客户端没有 21 张门槛判断，也没有因余牌不足而隐藏或置灰杠按钮的逻辑；杠按钮仅由服务端下发的杠权限位控制，可杠牌组也全部来自权限数据。
- **验收**：待确认（客户端无可验证实现，杠按钮显隐仅由服务端杠权限位控制）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认。
- **协作边界**：客户端不判断牌墙余量门槛，杠资格完全依赖服务端权限下发。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C06-004` 剩 20 张及以下时下一次摸牌前黄庄

- **规则说明**：剩 20 张及以下时，下一次摸牌前黄庄。
- **触发条件**：牌墙剩 20 张及以下且本次摸打与弃牌响应结束后仍无人胡牌，轮到下一次摸牌之前。
- **配置影响**：流局提示文案由 MatchTipConfig 配置（「剩余20张牌前无人胡牌则流局」）。
- **客户端交互**：匹配界面提示文案出现「剩余20张牌前无人胡牌则流局」；小结算按流局展示自己的输赢状态；提示动画包内打包了流局文字图。
- **限制与禁止**：客户端不判断黄庄时机。
- **异常与边界**：客户端没有「剩 20 张后先完成本次摸打与弃牌响应、下一次摸牌前才判黄庄」的时序逻辑；流局文字图仅在包内声明，未检索到代码引用。
- **验收**：收到流局结局（end_type 为 ET_DRAWN）时，小结算把自己标记为流局状态，结算流水不生成赢家明细；流局提示文案可正常展示。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/MatchTipConfig.ts:39；source-code/client/Code/util/BoxHzmjResultUtil.ts:35-39；source-code/client/Code/util/BoxHzmjFlowUtil.ts:29-31；source-code/client/Code/protocol/GameGlcProtocol.ts:114；source-code/client/Fgui/assets/box_hzmj_tipAni/package.xml:79
- **服务端职责**：下发 MsgDrawn（流局结局，GP_DRAWN 映射）与 MsgResultHu（结算消息，end_type 为 ET_DRAWN 时按流局处理）。
- **客户端职责**：客户端不判断黄庄时机，只在收到流局结局时按流局类型处理：小结算把自己标记为流局状态，结算流水不生成赢家明细。
- **协作边界**：客户端消费流局结局消息渲染流局结算与提示文案；流局时机与牌墙阈值判定在服务端。
- **来源文件**：`source-code/client/Code/config/MatchTipConfig.ts`
- **来源定位**：source-code/client/Code/config/MatchTipConfig.ts:39
- **原文摘录**：`"剩余20张牌前无人胡牌则流局",`

## `FP-ST-C06-002` 杠后连续行牌

- **主描述**：杠后仍可继续杠（每次重新校验牌墙），补的牌可以自摸，不胡则继续杠或打出一张牌。
- **范围与边界**：包含续杠入口、补牌自摸的胡按钮与自摸字效、不胡后的单张出牌；不包含番型倍数与赔付结算。
- **总体协作**：服务端在杠后重新下发权限，客户端据权限位展示杠、胡、出牌按钮，并把玩家选择回发给服务端。

### 原子项

#### `AT-ST-C06-005` 杠后可以继续杠

- **规则说明**：杠后可以继续杠。
- **触发条件**：玩家开杠后轮到其继续行牌，服务端再次下发可杠权限。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：杠按钮按权限显示并循环发光；存在多个可杠选项时弹出可杠牌列表供点选，选中后收起操作区并置灰手牌。
- **限制与禁止**：客户端不记录本回合是否已杠过，没有「本回合不能再杠」的本地限制。
- **异常与边界**：能否续杠取决于服务端是否再次下发杠权限，客户端没有主动判断杠后能否再杠。
- **验收**：杠后再次收到杠权限时，客户端按可杠牌组重建可杠列表并照常显示杠按钮；可杠选项多于 1 个时弹出列表供点选，选中后杠请求正常发送。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:601-611；source-code/client/Code/layer/BoxHzmjMainView.ts:1140-1154；source-code/client/Code/data/GameData.ts:881-884
- **服务端职责**：下发 MsgPower（杠权限与可杠牌组），接收 MsgKongC（杠请求）。
- **客户端职责**：客户端不记录本回合是否已杠过，每次收到权限都按服务端给的可杠牌组重建可杠列表并据此显示杠按钮；杠后再次收到杠权限时照常给出杠入口，选中后发送杠请求。
- **协作边界**：客户端消费杠权限展示杠入口并回发杠请求；续杠资格判定在服务端。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:601-611
- **原文摘录**：`const gangInfo = this._getGangPowerInfo(); this._chooseGangLength = gangInfo.mahs.length; this.showMoreGang(gangInfo.mahs);`

#### `AT-ST-C06-006` 每次续杠重新检查牌墙不少于 21 张

- **规则说明**：杠后继续杠时，每次重新检查牌墙不少于 21 张。
- **触发条件**：杠后继续杠时（客户端无对应实现）。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无。
- **异常与边界**：客户端没有任何牌墙余量检查；可杠选项完全来自服务端权限下发的可杠牌组，余牌数字只用于展示。
- **验收**：待确认（客户端无可验证实现）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认。
- **协作边界**：客户端无续杠前牌墙余量检查，续杠资格完全依赖服务端权限下发。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C06-007` 补牌可以自摸

- **规则说明**：补牌可以自摸。
- **触发条件**：杠后补的牌摸到手，这张牌使手牌成立胡牌且服务端下发胡权限。
- **配置影响**：胡牌类型枚举（HT_SELF 自摸、HT_DISCARD 点炮、HT_ROBKONG 抢杠）定义于 GameDefine；杠上开花番型（K_FTG_HZMJ_GANG_SHANG_HUA，2x）定义于 FanDefine。
- **客户端交互**：胡按钮展示本次胡的牌与倍数，字效按胡牌类型切换（自摸显示自摸样式，点炮与抢杠显示胡样式）并循环发光；杠后自摸播放杠上开花字效。
- **限制与禁止**：客户端不区分这张牌是否来自杠后补牌；杠后自摸的识别依赖服务端下发的番型。
- **异常与边界**：无。
- **验收**：胡权限下发且胡牌类型为自摸时，胡按钮动画切换为自摸字效；杠后自摸结算按番型显示杠上开花字效。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:663-666；source-code/client/Code/layer/BoxHzmjMainView.ts:670-675；source-code/client/Code/config/GameDefine.ts:421-431；source-code/client/Code/config/FanDefine.ts:25-26
- **服务端职责**：下发 MsgPower（胡权限与胡牌类型）与 MsgResultHu（胡牌结算与番型），接收 MsgHuC（胡请求）。
- **客户端职责**：胡按钮按权限显示，胡牌类型为自摸时把胡按钮动画切成自摸字效，点胡后发送胡请求；胡牌类型枚举区分自摸、点炮、抢杠。杠后自摸另有专属番型字效。
- **协作边界**：客户端消费胡权限与胡牌类型展示胡按钮与字效并回发胡请求；自摸资格与杠后自摸番型判定在服务端。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:663-666
- **原文摘录**：`this.view.KW_Main.KW_Handler.KW_BTN_Hu.KW_Action.KW_Ani.skinName = this._getHuActionSkinName(PowerData.hu_type);`

#### `AT-ST-C06-008` 不胡则继续杠或打出 1 张

- **规则说明**：补牌后不胡则继续杠或打出 1 张。
- **触发条件**：杠后补牌完成且玩家没有胡牌，玩家处于自己的出牌阶段。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：点手牌出牌后收起操作区并清灰；杠按钮仍按权限显示，玩家可选择杠而非出牌。
- **限制与禁止**：客户端每次只允许打出一张，出牌后立即收起操作区。
- **异常与边界**：「不胡」这一前提没有客户端判断，取决于服务端是否下发胡权限。
- **验收**：自己摸牌后开启出牌任务与听牌按钮检查；点击一张手牌即按单张出牌发送出牌请求并进入牌河；杠入口在权限允许时保持可用。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1481-1482；source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:290-294
- **服务端职责**：下发行牌权限驱动出牌与续杠入口，接收 MsgPlayC（出牌请求）与 MsgKongC（杠请求）。
- **客户端职责**：自己摸牌后客户端开启出牌任务与听牌按钮检查；点击手牌即按单张出牌发送出牌请求，同时保留杠入口供选择继续杠。
- **协作边界**：客户端摸牌后本地开启出牌任务，把单张出牌或续杠选择回发服务端；「不胡」前提与续杠资格由服务端权限决定。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1481-1482
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.addPlayMah, SELF_LOCAL_SEAT, mahValue, pos); GameController.instance.sendPlay(mahValue, false);`

## `FP-ST-C06-003` 杠链计数与归零

- **主描述**：明杠、暗杠、加杠各使杠链加 1；吃、碰、打出非财神、打出财神但打出后不再敲响均使杠链归零，最终体现为杠开后自摸的连杠档位番型。
- **范围与边界**：包含三种杠对杠链的累加与三类打断的归零；不包含杠开番型倍数计算与赔付。
- **总体协作**：杠链计数与归零全部在服务端维护，客户端只展示服务端下发的番型结果与飘状态。

### 原子项

#### `AT-ST-C06-009` 明杠使杠链加 1

- **规则说明**：明杠使杠链加 1。
- **触发条件**：玩家明杠，杠成立并进入杠后行牌。
- **配置影响**：杠上开花、二连杠等连杠番型档位定义于 FanDefine。
- **客户端交互**：明杠播放明杠动作动画与明杠音效，桌面新增一组杠副露；杠后自摸按番型显示杠上开花、二连杠、三连杠、四连杠字效。
- **限制与禁止**：客户端不维护杠链计数。
- **异常与边界**：连杠档位只以番型字效出现，档位由服务端下发的番型决定，无法证明客户端把明杠计入杠链。
- **验收**：收到明杠消息时按杠类型播明杠动作动画与音效、清理出牌操作区并把杠组作为副露渲染；杠后自摸按番型显示对应连杠字效。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:51-52；source-code/client/Code/config/FanDefine.ts:25-29；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1132-1135
- **服务端职责**：下发 MsgKongS（杠结果，含杠类型）与 MsgResultHu（杠后自摸时的连杠番型）。
- **客户端职责**：客户端不维护杠链计数。收到明杠消息时按杠类型播明杠动作动画与明杠音效、清理出牌操作区并把杠组作为副露渲染；杠链的实际效果只体现在杠后自摸时服务端下发的番型上。
- **协作边界**：客户端消费杠结果消息做动画与副露呈现；杠链计数与连杠档位判定在服务端。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:51-52
- **原文摘录**：`case BoxMahDefine.CombType.CMF_MKONG: kongType = BoxMahDefine.ActionAniType.TYPE_MKONG; break;`

#### `AT-ST-C06-010` 暗杠使杠链加 1

- **规则说明**：暗杠使杠链加 1。
- **触发条件**：玩家暗杠，暗杠成立并进入杠后行牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：暗杠播放暗杠动作动画与暗杠音效，桌面新增一组暗杠副露（牌背按原位）；杠后自摸显示杠开系档位字效。
- **限制与禁止**：客户端不维护杠链计数。
- **异常与边界**：暗杠与明杠在客户端只区分动画、音效与副露牌序，均不产生杠链计数；杠链含暗杠的标记在客户端也不存在。
- **验收**：收到暗杠消息时按暗杠类型播暗杠动作与音效，暗杠按原有牌序作为副露渲染（牌背按原位）；杠后自摸显示杠开系字效。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:54-55；source-code/client/Code/layer/BoxHzmjTipAniView.ts:509-512；source-code/client/Code/config/BoxMahDefine.ts:804-809
- **服务端职责**：下发 MsgKongS（杠结果，含暗杠类型）与 MsgResultHu（杠后自摸时的连杠番型）。
- **客户端职责**：客户端不维护杠链计数。收到暗杠消息时按暗杠类型播暗杠动作与暗杠音效，并把暗杠按原有牌序作为副露渲染（牌背按原位）；杠链效果同样只体现在杠后自摸的番型上。
- **协作边界**：客户端消费暗杠消息做动画与副露呈现；杠链计数在服务端。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:54-55
- **原文摘录**：`case BoxMahDefine.CombType.CMF_CKONG: kongType = BoxMahDefine.ActionAniType.TYPE_CKONG; break;`

#### `AT-ST-C06-011` 加杠使杠链加 1

- **规则说明**：加杠使杠链加 1。
- **触发条件**：玩家把已碰的刻子补成杠，补杠成立并进入杠后行牌。
- **配置影响**：补杠类型（CMF_TKONG）与补杠动作类型（TYPE_TKONG）定义于 BoxMahDefine 配置。
- **客户端交互**：补杠播放补杠动作动画与补杠音效，已碰组的副露被替换为杠组；杠后自摸显示杠开系档位字效。
- **限制与禁止**：客户端不维护杠链计数。
- **异常与边界**：补杠在客户端是独立渲染分支，但没有杠链计数；也不区分补杠是否被抢杠成功后的杠链回退。
- **验收**：收到补杠消息时按补杠类型播动作与音效，已碰组副露被替换为杠组；杠后自摸显示杠开系字效。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:57-58；source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:63-65；source-code/client/Code/layer/BoxHzmjMah2DView.ts:907-910
- **服务端职责**：下发 MsgKongS（杠结果，含补杠类型）与 MsgResultHu（杠后自摸时的连杠番型）。
- **客户端职责**：客户端不维护杠链计数。收到补杠消息时按补杠类型播补杠动作与补杠音效，并走独立的补杠渲染通道把第 4 张加到已有碰组上；杠链效果只体现在杠后自摸番型。
- **协作边界**：客户端消费补杠消息走独立渲染通道呈现副露替换；杠链计数在服务端。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:57-58
- **原文摘录**：`case BoxMahDefine.CombType.CMF_TKONG: kongType = BoxMahDefine.ActionAniType.TYPE_TKONG; break;`

#### `AT-ST-C06-012` 吃或碰使杠链归零

- **规则说明**：吃、碰使杠链归零。
- **触发条件**：玩家吃牌或碰牌，吃、碰成立。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：吃、碰分别播放对应动作动画与音效，桌面新增副露组，操作区收起。
- **限制与禁止**：客户端没有任何杠链计数或连杠档位重置逻辑。
- **异常与边界**：找到的只是吃、碰的副露与动画处理，未见任何杠链状态被清零或连杠档位被重置的客户端逻辑；杠链归零由服务端完成。
- **验收**：吃、碰成立时播放对应动作动画与音效、摆放副露并收起操作区；杠链归零效果只能从后续杠后自摸的结算番型验证。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:43；source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:43
- **服务端职责**：下发 MsgPungS（碰结果）与 MsgChowS（吃结果）。
- **客户端职责**：客户端吃牌与碰牌处理只做副露渲染、动作动画与操作区关闭，没有任何杠链计数或连杠档位重置逻辑。
- **协作边界**：客户端消费吃、碰结果消息做副露与动画表现；杠链归零在服务端。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:43
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.onMsgPlayPengGang, BoxMahDefine.ActionAniType.TYPE_PONG, localSeat);`

#### `AT-ST-C06-013` 打出非财神使杠链归零

- **规则说明**：打出非财神牌使杠链归零。
- **触发条件**：玩家打出一张非财神牌，该牌被打出到牌河。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：出牌播放出牌动画与出牌音效，牌进入牌河，本回合操作区关闭。
- **限制与禁止**：客户端出牌处理不区分财神与非财神的杠链影响。
- **异常与边界**：只找到出牌表现本身，未见杠链清零实现。
- **验收**：打出一张牌后播放出牌表现、牌进牌河并结束本回合；杠链归零效果只能从后续杠后自摸的结算番型验证。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePlayCmd.ts:67；source-code/client/Code/controller/cmd/gameCmd/GamePlayCmd.ts:89-96
- **服务端职责**：下发 MsgPlayS（出牌结果）。
- **客户端职责**：客户端出牌处理只更新牌河与手牌、刷新听牌提示并收起操作区，不区分财神与非财神的杠链效果，也没有杠链清零逻辑。
- **协作边界**：客户端消费出牌结果消息做出牌表现；打出非财神是否清零杠链由服务端判定。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GamePlayCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePlayCmd.ts:67
- **原文摘录**：`GameData.getPlayerCardsData(localSeat)?.setPlayMah(data.mah);`

#### `AT-ST-C06-014` 打出财神后不再敲响使杠链归零

- **规则说明**：打出财神但打出后不再敲响，杠链归零。
- **触发条件**：玩家打出一张财神，服务端判定打出后手牌不再满足敲响。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：打出财神后播放飘的动作字效，飘计数按服务端下发值刷新。
- **限制与禁止**：客户端没有敲响判定，也没有杠链计数或清零逻辑。
- **异常与边界**：客户端完全没有「敲响」这一概念，飘计数与杠链是两套状态；无法从客户端判断打出财神后是否仍敲响以及杠链是否被清零。
- **验收**：收到飘状态通知时更新该座位飘计数并重绘飘表现；杠链归零效果只能从后续杠后自摸的结算番型验证。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts:21-24；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1675-1680
- **服务端职责**：下发 MsgPiao（飘状态通知）与 MsgPlayS（出牌结果）。
- **客户端职责**：客户端对打出财神只有飘状态处理：收到飘状态通知后更新该座位的飘计数并重绘飘表现；客户端没有敲响判定，也没有杠链计数或清零逻辑。
- **协作边界**：客户端消费飘状态消息做飘表现；敲响判定与杠链清零均在服务端。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts:21-24
- **原文摘录**：`GameData.updatePiaoState(data.seat, data.piao_count);`
