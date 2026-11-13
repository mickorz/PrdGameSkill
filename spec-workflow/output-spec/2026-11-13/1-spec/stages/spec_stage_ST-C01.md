# 定庄与轮庄

> 阶段 ID：`ST-C01`。来源：模板「开局 > 定庄与轮庄」章节。客户端视角规格，客户端逻辑与 UI 交互以 Code/Fgui 代码证据支撑。

## 0. 阶段

- **阶段 ID**：`ST-C01`
- **阶段**：定庄与轮庄
- **来源章节**：开局 > 定庄与轮庄
- **涉及协议消息**：MsgJuData、MsgThrowChip、MsgResultHu、MsgBankerLevelUp、MsgDrawn、MsgRelinkOnAction
- **涉及 UI 模块**：BoxHzmjPlayerView、BoxHzmjPlayerMatchView、BoxHzmjResultMid、PlayerPanel（box_hzmj_player）、ResultItem（box_hzmj_result）
- **阶段概述**：确定首局庄家，并按有人胡牌由胡牌者接庄、流局原庄连庄的规则轮庄；庄家固定按三牢、庄闲倍数 8 倍结算，三牢不再增加。

## 术语与单位

| 术语 | 定义 | 单位/量纲 | 作用域 | 来源 |
| --- | --- | --- | --- | --- |
| 庄家 | 每小局一名庄家，庄家先出牌，其余玩家为闲家。 | 座位（服务端座位号经 seatToLocal 转本地座位） | 每小局 | 模板 第7行（杭州麻将核心需求开篇） |
| 连庄 | 庄家自己胡牌时继续坐庄；流局时原庄也继续坐庄，下一小局仍为同一庄家。 | 次（连庄次数，按 1~3 档展示） | 小局之间 | 模板 第27~28行（开局 > 定庄与轮庄） |
| 牢庄 | 本期固定笃三老庄，每小局庄家都按三牢、8 倍计算。 | 档（1=一牢/平庄，2=二牢，3=三牢） | 本期全局 | 模板 名词章节 第13行 |
| 庄闲倍数 | 首庄、新庄、连庄都是三牢，庄闲倍数固定 8 倍，三牢不再增加。 | 倍（固定 8 倍） | 结算 | 模板 第29行（开局 > 定庄与轮庄） |

## 跨切面行为

- **庄家展示统一事件入口**：庄家展示统一走 GameEventBoxHzmj.onShowZhuang 事件，玩家头像 C_Bank 档位、匹配房头像、断线重连恢复（RecoverGameSceneCmd._recoverZhuang）、结算行 C_IsBank 各自消费同一状态，新增轮庄表现需同时接入这些入口 —— 跨切面（GameJuDataCmd.ts:51 派发 onShowZhuang；BoxHzmjPlayerView.ts:806 消费点亮 C_Bank；BoxHzmjResultMid.ts:399 消费 C_IsBank；RecoverGameSceneCmd._recoverZhuang 无行号证据）。
- **牢庄等级多写入源**：牢庄等级 GameData.bankerLevel 存在多个写入源（MsgJuData.banker_level、MsgBankerLevelUp.banker_level、MsgResultHu.banker_level、MsgRelinkOnAction.banker_level）；ResultCmd 另用 getLianZhuangCount 快照，等级与连庄次数两字段同源但语义不同 —— 跨切面（GameData.ts:1593 牢庄等级定义；GameData.ts:1451 setLianZhuangCount；GameJuDataCmd.ts:34、GameJuDataCmd.ts:35 写入）。
- **复盘回放升庄并入掷骰步**：复盘回放中升庄广播 MsgBankerLevelUp 不单独成步，需并入最近掷骰步逐条播放（gameController._mergeXsmjBankerLevelUp），轮庄/升庄动画与骰子动画串行 —— 跨切面（gameController.ts，_mergeXsmjBankerLevelUp 无行号证据；掷骰命令映射见 gameController.ts:65）。
- **简单模式抑制升庄动画**：GameData.simpleMode 为真时抑制升庄扫光动画（BoxHzmjPlayerView._showXsmjZhuang 传入 sweep && !GameData.simpleMode）—— 跨切面（BoxHzmjPlayerView.ts，_showXsmjZhuang 无行号证据）。
- **定庄后方位盘与首出提示**：定庄后桌面方位盘以庄家座位为东风（BoxHzmjMah2DView.onMsgDeskCentBg）；首出阶段非庄家显示 C_Zhang 的"庄"提示横幅（GamePowerCmd._updateFirstPlayTips）—— 跨切面（GameJuDataCmd.ts:51 派发 onShowDeskCentBg；BoxHzmjMah2DView.onMsgDeskCentBg、GamePowerCmd._updateFirstPlayTips 无行号证据）。

## `FP-ST-C01-001` 首局定庄与庄家先定

- **主描述**：首局从四名玩家中产生庄家，且在掷骰、发牌之前庄家已确定，客户端据此展示庄家标志与方位盘。
- **范围与边界**：仅覆盖首局庄家产生时机与客户端接收/展示；随机算法本身在服务端，客户端不参与。
- **总体协作**：服务端下发 MsgJuData（zhuang/first_zhuang/banker_level），客户端 GameJuDataCmd 落库后派发 onShowZhuang 与 onShowDeskCentBg，随后才进入骰子、发牌阶段。

### 原子项

#### `AT-ST-C01-001` 首局随机坐庄

- **规则说明**：首局四名玩家中随机坐庄，即开局时从四名玩家中确定一名首局庄家；随机过程在服务端完成，客户端仅接收结果。
- **触发条件**：首局进入、服务端下发 MsgJuData（局数据）时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：局数据到达后立即派发 onShowZhuang，玩家头像庄标志按等级点亮（杭州麻将走 C_Bank 的 zhuang1~3 页）。
- **限制与禁止**：客户端不做随机定庄，庄家座位仅以服务端 MsgJuData.zhuang 为唯一来源，不本地推导。
- **异常与边界**：客户端无随机定庄逻辑，首庄完全由服务端 zhuang 决定；MsgJuData.first_zhuang 字段在客户端未被消费，无法从客户端验证"随机"过程。
- **验收**：收到首局 MsgJuData 后，GameData 庄家本地座位与 data.zhuang 经 seatToLocal 换算结果一致；对应玩家头像 C_Bank 庄标志按 banker_level 点亮，其余玩家庄标志隐藏。
- **职责域**：client
- **职责依据**：source-code/client/Code/lib/proto_game_hzmj.d.ts:3693；source-code/client/Code/layer/BoxHzmjPlayerView.ts:806
- **服务端职责**：下发 MsgJuData（zhuang 庄家座位、first_zhuang 首庄标记、banker_level 牢庄档位），首局庄家随机产生于服务端。
- **客户端职责**：客户端不做随机定庄：GameJuDataCmd 将 MsgJuData.zhuang 转本地座位写入 GameData.setZhuangSeat/setZhuangSever，作为本局庄家唯一来源。
- **协作边界**：客户端消费 MsgJuData.zhuang（经 seatToLocal 转本地座位）作为庄家唯一来源并展示庄标志；首局随机定庄过程在服务端，客户端不参与、不校验。
- **来源文件**：source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts:31
- **原文摘录**：`const localSeat = TableData.inst.seatToLocal(data.zhuang); GameData.setZhuangSeat(localSeat); GameData.setZhuangSever(data.zhuang);`

#### `AT-ST-C01-002` 掷骰发牌前庄家已确定

- **规则说明**：掷骰、发牌前已经确定庄家，即定庄先于骰子与发牌阶段发生。
- **触发条件**：MsgJuData 处理完成（定庄阶段 GAME_STATE_BANKER）之后、掷骰（GAME_STATE_CHIP/CMD_THROW_CHIP）与发牌（GAME_STATE_TAKE_FIRST）之前。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：庄家标志在局数据阶段点亮，骰子动画随后在牌桌上播放（BoxHzmjMah2DView.showDice），两者无数据依赖。
- **限制与禁止**：无（时序由服务端下发顺序与协议阶段枚举保证，客户端无显式校验）。
- **异常与边界**：证据为协议阶段枚举与命令分发顺序，属间接证据；未找到客户端显式"先定庄再掷骰"的时序校验代码。
- **验收**：按协议阶段枚举与命令分发顺序，定庄（GAME_STATE_BANKER/MsgJuData）先于骰子（GAME_STATE_CHIP/CMD_THROW_CHIP）与发牌（GAME_STATE_TAKE_FIRST）；onShowZhuang/onShowDeskCentBg 在掷骰动画前派发完成。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts:51；source-code/client/Code/controller/gameController.ts:65
- **服务端职责**：下发 MsgJuData（定庄）在前、MsgThrowChip（掷骰）在后，保证定庄先于掷骰发牌。
- **客户端职责**：协议状态枚举把"定庄"(GAME_STATE_BANKER) 排在"骰子"(GAME_STATE_CHIP) 与"发牌"(GAME_STATE_TAKE_FIRST) 之前；庄家在 MsgJuData 阶段即写入数据层并展示，骰子由后续独立命令 CMD_THROW_CHIP 处理。
- **协作边界**：客户端消费协议阶段枚举顺序与命令分发表，定庄写入与展示在 MsgJuData 阶段完成，骰子由后续独立命令处理；客户端不做显式时序校验。
- **来源文件**：source-code/client/Code/protocol/GameGlcProtocol.ts
- **来源定位**：source-code/client/Code/protocol/GameGlcProtocol.ts:16
- **原文摘录**：`/** 定庄 */ GAME_STATE_BANKER, // /** 骰子 */ GAME_STATE_CHIP, // ... /** 发牌 */ GAME_STATE_TAKE_FIRST,`

## `FP-ST-C01-002` 胡牌轮庄与连庄

- **主描述**：一小局结束有人胡牌时，下一小局由胡牌者坐庄；若庄家本人胡牌即为连庄，仍由原庄继续。
- **范围与边界**：覆盖胡牌结果到下局庄家的传递与连庄次数展示；下局庄家的推导在服务端完成。
- **总体协作**：MsgResultHu 记录本局胡牌座位与牢庄档位，下局由新 MsgJuData.zhuang 生效；连庄次数经 MsgJuData.banker_level/lian_zhuang 下发，供头像庄标志与结算行档位使用。

### 原子项

#### `AT-ST-C01-003` 胡牌者接任下局庄家

- **规则说明**：有人胡牌时，下一小局由胡牌者坐庄，即胡牌者接任下局庄家。
- **触发条件**：一小局结束有人胡牌（MsgResultHu 到达，hu_items 含 hu_seat），下一小局 MsgJuData 下发时生效。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：本局结算行按 data.banker 标记庄家并显示庄标志；下局开局由 onShowZhuang 重新点亮新庄家头像、清除上一家庄标志。
- **限制与禁止**：客户端不做"胡牌者→下局庄家"的本地判定，下局庄家仅以服务端 MsgJuData.zhuang 为准。
- **异常与边界**：客户端没有"胡牌者→下局庄家"的判定代码，正确性依赖服务端 MsgJuData.zhuang，客户端无法单独验证该规则。
- **验收**：MsgResultHu 结算行按 data.banker 标记庄家并显示庄标志（C_IsBank 对应档位）；下一小局 MsgJuData.zhuang 为胡牌者座位时，其头像庄标志点亮、上一家庄标志清除。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts:31；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:399
- **服务端职责**：下发 MsgResultHu（hu_items.hu_seat 胡牌座位等结算数据），并在下一小局下发 MsgJuData.zhuang 指向胡牌者。
- **客户端职责**：GameResultHuCmd 解析 hu_items.hu_seat 得到胡牌座位用于本局结算表现；下局庄家不在客户端推导，直接采用下一条 MsgJuData.zhuang 覆盖 GameData 的庄家座位。
- **协作边界**：客户端消费 MsgResultHu 做本局结算表现（标记胡牌座位与庄家），消费下一小局 MsgJuData.zhuang 更新庄家；胡牌者接庄的推导在服务端，客户端不做本地判定。
- **来源文件**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:158
- **原文摘录**：`const localSeat = TableData.inst.seatToLocal(item.hu_seat || 0); GameData.setIsHu(localSeat, true);`

#### `AT-ST-C01-004` 庄家自胡为连庄

- **规则说明**：庄家自己胡牌为连庄，即庄家胡牌后下一小局仍由原庄家坐庄，连庄次数累加。
- **触发条件**：庄家本人胡牌的一小局结束后，下一小局仍为同一庄家时；升庄广播 MsgBankerLevelUp 到达时更新档位与次数。
- **配置影响**：结算流水文案由 FanDefine 的 ResultLiuShuiType.K_LT_LIAN_ZHUANG（"连庄"）配置定义。
- **客户端交互**：结算行按 lianZhuang 选择 C_IsBank 的 1/2/3 档庄标志；结算流水含"连庄"独立流水项，由服务端 win_losts/flow 下发。
- **限制与禁止**：客户端无"庄家胡牌即连庄"的本地判定，连庄次数仅消费服务端下发值。
- **异常与边界**：连庄次数与牢庄等级共用 MsgJuData.banker_level 写入，ResultCmd 另取 getLianZhuangCount 作为结算快照，两字段语义需服务端保证一致。
- **验收**：结算行 C_IsBank 按 lianZhuang（1/2/3）显示对应档位庄标志，非庄家行显示 no 档；连庄时结算流水出现"连庄"流水项；GameData 连庄次数与 MsgJuData.banker_level 一致。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts:34；source-code/client/Code/config/FanDefine.ts:648；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:401
- **服务端职责**：下发 MsgJuData（banker_level）、MsgBankerLevelUp（升庄广播更新档位）与 MsgResultHu（结算含连庄流水 win_losts/flow），连庄判定在服务端完成。
- **客户端职责**：连庄次数由服务端下发：GameJuDataCmd 用 MsgJuData.banker_level 写入 setLianZhuangCount；升庄广播 MsgBankerLevelUp 亦更新该值与 bankerLevel。客户端无"庄家胡牌即连庄"的本地判定。
- **协作边界**：客户端消费 MsgJuData.banker_level、MsgBankerLevelUp、MsgResultHu 下发的连庄次数与档位做展示；庄家自胡即连庄的判定在服务端。
- **来源文件**：source-code/client/Code/data/GameData.ts
- **来源定位**：source-code/client/Code/data/GameData.ts:1451
- **原文摘录**：`setLianZhuangCount(count: number): void { this._lianZhuangCount = count; }`

## `FP-ST-C01-003` 流局原庄连庄

- **主描述**：一小局流局时，原庄家继续坐庄，不换庄。
- **范围与边界**：覆盖流局协议的接收与流局结算表现；连庄结果由服务端在下局 MsgJuData 中体现。
- **总体协作**：服务端下发 MsgDrawn（GP_DRAWN）与 MsgResultHu（end_type=ET_DRAWN），客户端仅做展示与状态还原，下局庄家仍以 MsgJuData.zhuang 为准。

### 原子项

#### `AT-ST-C01-005` 流局不换庄

- **规则说明**：流局时原庄连庄，即一小局无人胡牌流局后，下一小局原庄家继续坐庄、不换庄。
- **触发条件**：一小局流局（服务端判定无人胡牌并下发流局结果）时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：结算界面按 end_type===ET_DRAWN 切换 C_Line/C_WinLost 的输/平样式；下局原庄家标志由 onShowZhuang 按服务端下发座位重新点亮。
- **限制与禁止**：客户端无"流局→原庄连庄"的本地判定，不换庄结果仅以服务端下发为准。
- **异常与边界**：CmdNames.CMD_DRAWN 仅出现在协议映射与常量定义中，仓库内无 @RegisterCmd(CMD_DRAWN) 的命令类，流局是否为独立下行或并入 MsgResultHu 存疑，需与服务端确认。
- **验收**：end_type=ET_DRAWN 的结算界面 C_Line/C_WinLost 按流局（平）样式显示；下一小局 MsgJuData.zhuang 仍为原庄家座位，其头像庄标志保持点亮。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/gameController.ts:74；source-code/client/Code/config/GameDefine.ts:441；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:371
- **服务端职责**：下发 MsgDrawn（GP_DRAWN 流局）与 MsgResultHu（end_type=ET_DRAWN 结算），下局 MsgJuData.zhuang 保持原庄家。
- **客户端职责**：协议层定义 GP_DRAWN→MsgDrawn 并映射到 CmdNames.CMD_DRAWN，但未找到对应命令实现类；流局结算实际由 GameResultHuCmd（CMD_RESULT_HU）承载，按 end_type=ET_DRAWN 出结算表现。客户端无"流局→原庄连庄"的本地判定。
- **协作边界**：客户端消费 end_type=ET_DRAWN 做流局结算表现，消费下局 MsgJuData.zhuang 还原庄家；流局连庄判定在服务端，流局独立下行（MsgDrawn/CMD_DRAWN）在客户端未还原，需与服务端确认。
- **来源文件**：source-code/client/Code/protocol/GameGlcProtocol.ts
- **来源定位**：source-code/client/Code/protocol/GameGlcProtocol.ts:114
- **原文摘录**：`GP_DRAWN: game_hzmj.MsgDrawn.MSGID.ID, //流局`

## `FP-ST-C01-004` 三牢与庄闲倍数

- **主描述**：首庄、新庄、连庄统一按三牢计，庄闲倍数固定 8 倍且三牢封顶不再增加。
- **范围与边界**：覆盖牢庄等级的数据来源、庄标志档位显示与倍数展示；倍数计算以服务端结算为准。
- **总体协作**：牢庄等级经 MsgJuData.banker_level、升庄广播 MsgBankerLevelUp、MsgResultHu.banker_level 与重连 MsgRelinkOnAction.banker_level 下发，客户端仅缓存并按档位显示。

### 原子项

#### `AT-ST-C01-006` 首庄新庄连庄均为三牢

- **规则说明**：首庄、新庄、连庄都是三牢，即无论首局定庄、胡牌接庄还是连庄，庄家牢庄档位均按三牢计。
- **触发条件**：首局定庄、胡牌接庄（新庄）、连庄各情形确定庄家时。
- **配置影响**：牢庄等级在无 MsgRelinkOnAction/MsgResultHu 下发时从创房配置推导（GameData.getLianZhuangCount 兜底赋值）。
- **客户端交互**：玩家头像按等级切换 C_Bank 的 zhuang1/zhuang2/zhuang3 三档庄图；萧山好友房分支改用 XsmjZhuangComp 数字标志。
- **限制与禁止**：客户端不强制固定三牢，档位随服务端下发值变化。
- **异常与边界**：客户端保留 1~3 档通用模型，无"恒为三牢"的强制逻辑；升庄广播 MsgBankerLevelUp 仍可改变档位，三牢是否由服务端配置固定需确认。
- **验收**：首庄、新庄、连庄各情形下玩家头像 C_Bank 均显示 zhuang3 档（三牢）；GameData.bankerLevel 与服务端下发 banker_level 一致；萧山好友房分支显示 XsmjZhuangComp 数字标志。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts:35；source-code/client/Fgui/assets/box_hzmj_player/component/PlayerPanel.xml:8
- **服务端职责**：下发 MsgJuData/MsgBankerLevelUp 携带 banker_level 牢庄档位，保证首庄、新庄、连庄均为三牢。
- **客户端职责**：GameData 维护牢庄等级 _bankerLevel（注释 1=一牢/平庄、2=二牢、3=三牢），GameJuDataCmd 从局数据 banker_level 推导赋值，未在客户端强制固定为 3 牢。
- **协作边界**：客户端仅缓存 banker_level 并按 1~3 档展示庄标志；三牢固定由服务端保证，客户端保留 1~3 档通用模型。
- **来源文件**：source-code/client/Code/data/GameData.ts
- **来源定位**：source-code/client/Code/data/GameData.ts:1593
- **原文摘录**：`/** 牢庄等级（1=一牢/平庄, 2=二牢, 3=三牢） */ private _bankerLevel: number = 1;`

#### `AT-ST-C01-007` 庄闲倍数固定8倍

- **规则说明**：庄闲倍数固定 8 倍，即庄家与闲家结算时按固定 8 倍计。
- **触发条件**：结算（MsgResultHu 下发 win_losts）时。
- **配置影响**：MatchTipConfig 提示文案含"庄家连庄倍数递增：平庄2倍、二牢4倍、三牢8倍"。
- **客户端交互**：结算行与流水显示服务端下发的分数与倍数；头像庄标志在萧山分支显示 x2/x3 数字，杭州麻将走三档庄图。
- **限制与禁止**：客户端不本地计算庄闲倍数；番型解析明确不乘牢庄/承包倍数（服务端总番型倍数已含豪杠）。
- **异常与边界**：客户端 TIPS 文案"平庄2倍、二牢4倍、三牢8倍"为递增档位，与模板"固定 8 倍"表述不一致；游戏内倍数实际由服务端结算数据决定，客户端无法验证固定 8 倍；GameData.getZhuangXianMult（1<<bankerLevel，三牢即 8 倍）全仓无调用。
- **验收**：结算行与流水显示的分数与倍数与服务端 win_losts 下发一致；客户端结算路径不出现本地牢庄倍数计算（getZhuangXianMult 不被调用）。
- **职责域**：client
- **职责依据**：source-code/client/Code/util/XsmjHuFanResolver.ts:31；source-code/client/Code/config/MatchTipConfig.ts:24
- **服务端职责**：下发 MsgResultHu（win_losts 含 mult 倍数与分数），庄闲倍数计算在服务端完成。
- **客户端职责**：GameData 提供 getZhuangXianMult（1<<bankerLevel，3 牢即 8 倍）但全仓无调用；实际倍数取自服务端结算 win_losts.mult，番型解析明确不乘牢庄/承包。
- **协作边界**：客户端仅展示服务端结算下发的分数与倍数；本地 getZhuangXianMult 不参与结算，番型解析不乘牢庄/承包。
- **来源文件**：source-code/client/Code/data/GameData.ts
- **来源定位**：source-code/client/Code/data/GameData.ts:1664
- **原文摘录**：`getZhuangXianMult(): number { return 1 << this._bankerLevel; }`

#### `AT-ST-C01-008` 三牢不再增加

- **规则说明**：三牢不再增加，即庄家档位达到三牢后继续连庄时，牢庄档位不再提升。
- **触发条件**：庄家牢庄档位已达三牢（第 3 档）且继续连庄时。
- **配置影响**：PlayerPanel 与 ResultItem 的庄标志控制器仅配置三档页面（C_Bank：zhuang1/zhuang2/zhuang3；C_IsBank：1zhuang/2zhuang/3zhuang），无更高档位资源。
- **客户端交互**：匹配房头像设置庄档位时 bankIdx>3 归 3；PlayerPanel 与 ResultItem 的庄标志控制器均只有 1/2/3 三档，无更高档位资源。
- **限制与禁止**：客户端无封顶逻辑，仅展示层做 3 档上限处理。
- **异常与边界**：仅有 UI 档位上限 3 的间接证据；BoxHzmjPlayerView 的杭州麻将分支直接 selectedIndex=zhuangnumber，无 clamp，若服务端下发 >3 会显示异常页。
- **验收**：牢庄等级为 3 后继续连庄，匹配房头像庄档位不大于 3（bankIdx>3 归 3）；PlayerPanel/ResultItem 庄标志不出现 3 档以上页面。
- **职责域**：client
- **职责依据**：source-code/client/Fgui/assets/box_hzmj_player/component/PlayerPanel.xml:8；source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:10
- **服务端职责**：下发 MsgBankerLevelUp/MsgJuData 携带 banker_level，三牢封顶（不再增加）由服务端保证。
- **客户端职责**：未找到显式倍数封顶代码；GameData.bankerLevel 可被服务端任意赋值，仅展示层对档位做了 3 档上限处理。
- **协作边界**：客户端仅做展示层 3 档上限处理（匹配房分支 clamp 到 3）；档位封顶逻辑在服务端。
- **来源文件**：source-code/client/Code/layer/BoxHzmjPlayerMatchView.ts
- **来源定位**：source-code/client/Code/layer/BoxHzmjPlayerMatchView.ts:225
- **原文摘录**：`bank.selectedIndex = bankIdx > 3 ? 3 : bankIdx;`
