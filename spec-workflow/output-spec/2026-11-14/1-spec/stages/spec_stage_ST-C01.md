# 定庄与轮庄

> 阶段 ID：`ST-C01`。来源：模板「开局 > 定庄与轮庄」章节。客户端视角规格，客户端逻辑与 UI 交互以 Code/Fgui 代码证据支撑。

## 0. 阶段

- **阶段 ID**：`ST-C01`
- **阶段**：定庄与轮庄
- **来源章节**：开局 > 定庄与轮庄
- **涉及协议消息**：MsgJuData、MsgThrowChip、MsgStartGame、MsgResultHu、MsgDrawn、MsgBankerLevelUp
- **涉及 UI 模块**：box_hzmj_player、box_hzmj_result
- **阶段概述**：开局阶段确定每小局的庄家：首局由系统随机指定，之后由胡牌者接庄、庄家自摸或流局则连庄；牢庄固定三牢、庄闲按 8 倍结算，客户端只负责按系统给出的庄家与档位刷新庄家标记和结算显示。

## 术语与单位

| 术语 | 定义 | 单位/量纲 | 作用域 | 来源 |
| --- | --- | --- | --- | --- |
| 庄家 | 每小局一名庄家，庄家先出牌，其余为闲家。 | 座位（每小局一名） | 每小局 | 模板 第7行（玩法概述） |
| 闲家 | 除庄家外的三名玩家，吃牌只用上家刚打出的牌。 | 座位（每小局三名） | 每小局 | 模板 第7行（玩法概述） |
| 牢庄 | 本期固定笃三老庄，每小局庄家都按三牢、8 倍计算。 | 档位（1~3） | 每小局结算 | 模板 名词章节 第13行 |
| 连庄 | 庄家继续坐庄，结算时单列「连庄」流水项，连庄局数加分。 | 局数（每连一局 +1 倍） | 跨小局结算流水 | 模板 第27-28行；代码 source-code/client/Code/config/FanDefine.ts:572 |
| 流局 | 牌墙剩 21 张时当前玩家再摸 1 张剩 20 张，先完成本次摸打和弃牌响应，无人胡牌时在下一次应摸牌前判黄庄。 | 局结束类型 | 单小局结束判定 | 模板 名词章节 第20行 |
| 定庄 | 开局先确定本小局庄家的环节，流程上位于掷骰与发牌之前。 | 流程环节 | 每小局开始前 | 代码 source-code/client/Code/protocol/GameGlcProtocol.ts:16 |

## 跨切面行为

- **庄家标记刷新**：庄家标记统一由头像组件的庄标志控制器按档位页显示（1/2/3 档对应不同庄字图标），局数据、升庄广播、断线重连三处都会派发同一庄家刷新事件 —— 跨切面（source-code/client/Fgui/assets/box_hzmj_player/component/PlayerPanel.xml:8；source-code/client/Code/layer/BoxHzmjPlayerView.ts:808；source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts:51）
- **档位与连庄数据共用**：牢庄档位与连庄次数在客户端共用同一份数据（局数据里的牢庄档位被写入连庄次数字段），结算庄标志实际反映牢庄档位而不是真实连庄局数 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts:34-36；source-code/client/Code/controller/cmd/helperCmd/ResultCmd.ts:57-61）
- **萧山与杭州庄标志差异**：萧山好友房复用同一套包厢界面，庄标志改用数字 xN 组件并在升庄时播放扫光；杭州好友房走三档庄字图标，等级提升时才播放加庄动画 —— 跨切面（source-code/client/Code/layer/comp/XsmjZhuangComp.ts:75；source-code/client/Fgui/assets/box_hzmj_player/component/PlayerPanel.xml:8；source-code/client/Code/controller/cmd/gameCmd/GameBankerLevelUpCmd.ts:23-24）
- **定庄先于掷骰发牌**：掷骰与发牌在定庄之后播放，断线重连时骰子、手牌、庄家标记在同一初始帧静态还原 —— 跨切面（source-code/client/Code/protocol/GameGlcProtocol.ts:15-19；source-code/client/Code/controller/cmd/RecoverGameSceneCmd.ts:35-38）
- **流局消息接入**：流局协议已定义并接入消息分发，但仓库内未见本地注册的流局命令实现，流局结算表现通过结算消息的结束类型分支处理 —— 跨切面（source-code/client/Code/protocol/GameGlcProtocol.ts:114；source-code/client/Code/controller/gameController.ts:74；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:371）

## `{FP-ST-C01-001}` 首局定庄与定庄时机

- **主描述**：首局由系统从四名玩家中指定庄家，并在掷骰、发牌之前完成定庄；客户端只接收庄家座位并刷新庄家标记。
- **范围与边界**：覆盖首局的定庄来源与定庄时机；不覆盖非首局的轮庄、连庄与牢庄档位（属后续功能点）。
- **总体协作**：局数据到达后写入庄家座位并触发头像庄标记刷新；断线重连按同一事件静态还原庄家，掷骰与手牌在之后呈现。

### 原子项

#### `AT-ST-C01-001` 首局随机坐庄

- **规则说明**：首局四名玩家中随机坐庄。
- **触发条件**：整场第一小局开始前、四名玩家都已入座时，决定本局由谁坐庄。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：庄家玩家头像左上角出现「庄」字标记，头像庄标志控制器切到对应档位页。
- **限制与禁止**：无。
- **异常与边界**：客户端未使用局数据里的首局庄座位字段 first_zhuang，只用当前庄座位 zhuang；随机抽取方式没有任何客户端代码可证。
- **验收**：整场第一小局开始时，系统确定庄家后该玩家头像出现「庄」字标记且档位页正确；客户端不做随机抽取，也没有候选玩家筛选逻辑。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts:31-33；source-code/client/Code/layer/BoxHzmjPlayerView.ts:808；source-code/client/Fgui/assets/box_hzmj_player/component/PlayerPanel.xml:8；source-code/client/Code/lib/proto_game_hzmj.d.ts:3684-3685
- **服务端职责**：下发 MsgJuData（携带本局庄家座位 zhuang 与首局庄座位 first_zhuang），随机指定首局庄家。
- **客户端职责**：局数据到达后把服务端下发的庄家座位转成本地座位保存，并触发庄家标记刷新；客户端不参与随机抽取，也没有候选玩家筛选逻辑。
- **协作边界**：客户端消费服务端下发的庄家座位（MsgJuData.zhuang），本地只做座位换算与庄标记刷新；随机抽取规则完全在服务端执行。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts:31-33
- **原文摘录**：`const localSeat = TableData.inst.seatToLocal(data.zhuang); GameData.setZhuangSeat(localSeat); GameData.setZhuangSever(data.zhuang);`

#### `AT-ST-C01-002` 掷骰、发牌前确定庄家

- **规则说明**：掷骰、发牌前已经确定庄家。
- **触发条件**：一局刚开始、骰子还没掷出，且本局庄家已经确定时，游戏先标出庄家，再播放掷骰与发牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：正常开局时庄家标记随局数据刷新；断线重连进入发牌帧时骰子、四家手牌与庄家标记同时呈现。
- **限制与禁止**：无。
- **异常与边界**：状态枚举顺序只代表流程定义，运行时先定庄再掷骰发牌由服务端保证，客户端未对消息到达顺序做校验或强制；断线重连时骰子、手牌、庄家标记在同一初始帧同时出现。
- **验收**：正常开局时玩家在骰子和手牌出现之前就能看到庄家标记；断线重连进入发牌帧时骰子、四家手牌与庄家标记同时还原。
- **职责域**：client
- **职责依据**：source-code/client/Code/protocol/GameGlcProtocol.ts:15-19；source-code/client/Code/controller/cmd/RecoverGameSceneCmd.ts:33；source-code/client/Code/controller/cmd/RecoverGameSceneCmd.ts:35-38；source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts:51
- **服务端职责**：下发 MsgJuData（定庄并携带庄家座位）、MsgThrowChip（掷骰）、MsgStartGame（发牌），保证定庄先于掷骰与发牌。
- **客户端职责**：协议状态枚举把定庄排在骰子、发牌之前；断线重连在发牌初始帧依次还原牌墙、骰子、手牌、庄家标记，未见客户端对消息到达顺序做校验或强制。
- **协作边界**：客户端消费 MsgJuData/MsgThrowChip/MsgStartGame 依次呈现庄家标记、骰子与手牌；定庄与掷骰发牌的先后时序由服务端保证，客户端不做顺序校验。
- **来源文件**：`source-code/client/Code/protocol/GameGlcProtocol.ts`
- **来源定位**：source-code/client/Code/protocol/GameGlcProtocol.ts:15-19
- **原文摘录**：`GAME_STATE_START, // 游戏开始 /** 定庄 */ GAME_STATE_BANKER, // /** 骰子 */ GAME_STATE_CHIP, //`

## `{FP-ST-C01-002}` 胡牌轮庄与连庄

- **主描述**：有人胡牌后，下一小局由胡牌者坐庄；庄家自己胡牌时继续坐庄并记为连庄，结算单列连庄流水。
- **范围与边界**：覆盖胡牌结束后的接庄与庄家自摸连庄的表现；不覆盖流局连庄与牢庄档位。
- **总体协作**：下一小局仍由局数据下发庄家座位并刷新头像标记；结算阶段按庄家座位显示庄标志，并按流水类型展示连庄条目。

### 原子项

#### `AT-ST-C01-003` 胡牌者接庄

- **规则说明**：有人胡牌时，下一小局由胡牌者坐庄。
- **触发条件**：上一小局以胡牌结束、进入下一小局时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：新一局开局时庄家标记移到上一局胡牌者头像上；结算界面也按庄家座位给对应行显示庄标志。
- **限制与禁止**：无。
- **异常与边界**：客户端无「胡牌者等于下一局庄家」的推导逻辑，完全依赖服务端下发的庄家座位。
- **验收**：上一小局有人胡牌后进入新一局时，庄家标记出现在上一局胡牌玩家头像上；结算界面按庄家座位给对应行显示庄标志。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts:31-33；source-code/client/Code/layer/BoxHzmjPlayerView.ts:808；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:402
- **服务端职责**：下发 MsgJuData（按胡牌者接庄规则确定的下一小局庄家座位）与 MsgResultHu（结算信息）。
- **客户端职责**：下一小局由局数据重新下发庄家座位，客户端转成本地座位后刷新庄家标记；不判断上一局谁胡牌，也没有胡牌者与庄家的映射逻辑。
- **协作边界**：客户端消费服务端下发的庄家座位与结算信息，本地只做座位换算、标记刷新与结算庄标志显示；胡牌者接庄的判定在服务端。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts:31-33
- **原文摘录**：`const localSeat = TableData.inst.seatToLocal(data.zhuang); GameData.setZhuangSeat(localSeat); GameData.setZhuangSever(data.zhuang);`

#### `AT-ST-C01-004` 庄家自摸连庄

- **规则说明**：庄家自己胡牌为连庄。
- **触发条件**：本小局结束时胡牌的人正是本局庄家。
- **配置影响**：连庄流水类型定义于 FanDefine（K_LT_LIAN_ZHUANG = 11，显示名「连庄」，每连一局 +1 倍）。
- **客户端交互**：结算流水出现「连庄」条目；庄家头像与结算行的庄标志保持档位图标不消失。
- **限制与禁止**：无。
- **异常与边界**：局数据处理把牢庄档位同时写入连庄次数（GameJuDataCmd:34），局数据的 lian_zhuang 字段从未被使用；连庄次数与牢庄档位混用，结算庄标志实际显示牢庄档位。
- **验收**：庄家自己胡牌结束本小局后，庄家标记仍在原庄家头上不移动，结算流水出现「连庄」条目，庄标志按档位显示。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:572-573；source-code/client/Code/config/FanDefine.ts:648；source-code/client/Code/util/BoxHzmjFlowUtil.ts:228-230；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:62-64；source-code/client/Code/controller/cmd/helperCmd/ResultCmd.ts:57-61
- **服务端职责**：下发 MsgJuData 与 MsgResultHu（含连庄流水条目、庄家座位与庄档位）。
- **客户端职责**：客户端保存服务端下发的牢庄档位并据此显示庄标志，结算阶段按流水类型展示「连庄」条目；不判断胡牌者是否为庄家。
- **协作边界**：客户端消费服务端下发的庄档位与结算流水，按流水类型单列连庄条目；连庄判定与连庄次数由服务端计算。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:572-573
- **原文摘录**：`/** 连庄：庄家连庄局数加分（每连一局 +1 倍）。 */ K_LT_LIAN_ZHUANG = 11,`

## `{FP-ST-C01-003}` 流局连庄

- **主描述**：流局时原庄继续坐庄，下一小局庄家不变。
- **范围与边界**：覆盖流局结束时的结算表现与下一局庄家的沿用；不覆盖流局判定、牌墙剩余计算与流局赔付。
- **总体协作**：流局消息与结算消息的结束类型共同标识本局结束，下一小局庄家仍取自局数据。

### 原子项

#### `AT-ST-C01-005` 流局原庄连庄

- **规则说明**：流局时原庄连庄。
- **触发条件**：本小局打到无人胡牌结束（牌墙剩余不足、本局判流局）时。
- **配置影响**：流局协议 GP_DRAWN 已映射到命令 CMD_DRAWN 并接入消息分发。
- **客户端交互**：结算界面流局行按输/平样式显示，不展示胡牌信息。
- **限制与禁止**：无。
- **异常与边界**：本地未找到注册的流局命令类，实际处理可能在仓库外的公共模块；未发现原庄连庄相关的客户端处理。
- **验收**：本小局以流局结算，结算界面流局行按输/平样式显示、没有胡牌方；下一小局庄家仍取自局数据下发。
- **职责域**：client
- **职责依据**：source-code/client/Code/protocol/GameGlcProtocol.ts:114；source-code/client/Code/controller/gameController.ts:74；source-code/client/Code/controller/cmd/CmdDefine.ts:34；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:371；source-code/client/Code/util/BoxHzmjResultUtil.ts:37-39
- **服务端职责**：下发 MsgDrawn（流局）与 MsgResultHu（结束类型为流局的结算），并保持下一小局庄家不变。
- **客户端职责**：流局消息已定义并映射到流局命令，但仓库内未找到该命令的本地实现；流局在结算层按结束类型区分显示，流局行按输/平处理，未见原庄连庄相关逻辑。
- **协作边界**：客户端消费 MsgDrawn 的消息分发注册与 MsgResultHu 的结束类型分支展示流局结算；流局判定与下一局庄家沿用不在客户端实现。
- **来源文件**：`source-code/client/Code/protocol/GameGlcProtocol.ts`
- **来源定位**：source-code/client/Code/protocol/GameGlcProtocol.ts:114
- **原文摘录**：`GP_DRAWN: game_hzmj.MsgDrawn.MSGID.ID, //流局`

## `{FP-ST-C01-004}` 三牢牢庄档位与8倍庄闲倍数

- **主描述**：首庄、新庄、连庄都按三牢计算，庄闲倍数固定 8 倍，三牢封顶不再增加。
- **范围与边界**：覆盖牢庄档位的存储、头像与结算显示以及庄闲倍数换算；不覆盖具体分数结算、番型与承包赔付计算。
- **总体协作**：局数据与结算消息下发牢庄档位，客户端按档位显示庄标志并换算庄闲倍数；升庄广播单独驱动加庄表现。

### 原子项

#### `AT-ST-C01-006` 首庄新庄连庄都是三牢

- **规则说明**：首庄、新庄、连庄都是三牢。
- **触发条件**：一小局确定庄家时，无论是首庄、换庄后的新庄还是连庄。
- **配置影响**：牢庄等级存储于 GameData（1=一牢/平庄、2=二牢、3=三牢，默认 1）；庄标志档位页配置于 PlayerPanel 的 C_Bank 控制器（0~3 档）。
- **客户端交互**：庄家头像庄字标记按档位切换不同图标（1/2/3 档），升庄时播放加庄动画并刷新档位。
- **限制与禁止**：无。
- **异常与边界**：客户端按服务端下发档位显示，未强制三牢；非萧山房也会接收升庄广播并派发加庄表现，档位最终取值依赖服务端。
- **验收**：一小局确定庄家后，庄家标记按系统下发的牢庄档位显示对应图标（图标最多三档）；客户端不存在把档位固定为三牢的逻辑，「都是三牢」由服务端下发保证。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/GameData.ts:1593-1594；source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts:34-36；source-code/client/Code/controller/cmd/gameCmd/GameBankerLevelUpCmd.ts:23-24；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:117-119；source-code/client/Fgui/assets/box_hzmj_player/component/PlayerPanel.xml:8
- **服务端职责**：下发 MsgJuData、MsgResultHu、MsgBankerLevelUp（均携带牢庄档位 banker_level）。
- **客户端职责**：客户端保存局数据与结算消息下发的牢庄档位（1/2/3），并把它作为庄标志档位显示；没有把档位固定赋值为三牢的逻辑，升庄广播会直接采用新档位。
- **协作边界**：客户端消费服务端下发的档位并按档位页显示庄标志；档位取值完全由服务端决定，客户端未固定。
- **来源文件**：`source-code/client/Code/data/GameData.ts`
- **来源定位**：source-code/client/Code/data/GameData.ts:1593-1594
- **原文摘录**：`/** 牢庄等级（1=一牢/平庄, 2=二牢, 3=三牢） */ private _bankerLevel: number = 1;`

#### `AT-ST-C01-007` 庄闲倍数固定8倍

- **规则说明**：庄闲倍数固定 8 倍。
- **触发条件**：本小局结算庄家与闲家的输赢时（本局存在庄家与三名闲家）。
- **配置影响**：庄闲倍数按牢庄档位左移换算（1 档 2 倍、2 档 4 倍、3 档 8 倍）；匹配提示文案写有「庄家连庄倍数递增：平庄2倍、二牢4倍、三牢8倍」。
- **客户端交互**：结算界面直接显示各家得分，没有单列「8倍」倍数文案。
- **限制与禁止**：无。
- **异常与边界**：客户端倍数换算能力未见调用，结算分数直接采用服务端下发的得失分；匹配提示文案只在匹配场展示，好友房不走匹配提示。
- **验收**：结算界面直接显示按庄闲关系算出的各家得分，界面不单独显示固定 8 倍文案；庄闲倍数实际按牢庄档位换算（3 档对应 8 倍），并非固定值。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/GameData.ts:1661-1666；source-code/client/Code/interface/BoxHzmjResultTypes.ts:11；source-code/client/Code/config/MatchTipConfig.ts:24；source-code/client/Code/util/BoxHzmjResultUtil.ts:10-11
- **服务端职责**：下发 MsgResultHu（按庄闲倍数算好的得失分与庄档位）。
- **客户端职责**：客户端提供按牢庄档位换算庄闲倍数的能力（1 档 2 倍、2 档 4 倍、3 档 8 倍），但未见调用；结算分数直接采用服务端下发的得失分，未单独展示倍数。
- **协作边界**：客户端消费服务端算好的结算分数直接显示；倍数换算能力存在但未被调用，固定 8 倍在客户端无法证实。
- **来源文件**：`source-code/client/Code/data/GameData.ts`
- **来源定位**：source-code/client/Code/data/GameData.ts:1661-1666
- **原文摘录**：`/** 获取庄闲倍数（1牢=2, 2牢=4, 3牢=8） * @returns 庄闲倍数 */ getZhuangXianMult(): number { return 1 << this._bankerLevel; }`

#### `AT-ST-C01-008` 三牢封顶不再增加

- **规则说明**：三牢不再增加。
- **触发条件**：庄家连续坐庄、档位继续变化时（庄家再次连庄）。
- **配置影响**：头像庄字图标与结算庄标志均只提供三档页面（PlayerPanel 的 C_Bank、ResultItem 的 C_IsBank）。
- **客户端交互**：杭州房头像庄字图标最多显示三档；萧山数字庄标志按档位显示 xN，档位更大时也不截断。
- **限制与禁止**：无。
- **异常与边界**：数字庄标志组件对档位只做下限保护，没有上限封顶，若服务端下发超过三牢会显示 x4 及以上，客户端未做封顶拦截。
- **验收**：庄家标记档位跟随系统下发数值变化；杭州房图标最多三档、结算处档位钳制到 0~3；萧山数字庄标志按档位显示 xN 不封顶。
- **职责域**：client
- **职责依据**：source-code/client/Fgui/assets/box_hzmj_player/component/PlayerPanel.xml:8；source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:12；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:402；source-code/client/Code/layer/comp/XsmjZhuangComp.ts:30-32；source-code/client/Code/layer/comp/XsmjZhuangComp.ts:75
- **服务端职责**：下发 MsgBankerLevelUp 与 MsgJuData（庄档位，三牢封顶由服务端控制）。
- **客户端职责**：庄字图标与结算庄标志只提供三档页面，结算显示处把档位钳制到 0~3；数字庄标志组件对档位只做下限保护，没有上限封顶，直接显示系统下发的档位。
- **协作边界**：客户端按三档图标页与 0~3 钳制展示庄标志；三牢封顶的档位上限由服务端决定，客户端未做封顶拦截。
- **来源文件**：`source-code/client/Fgui/assets/box_hzmj_player/component/PlayerPanel.xml`
- **来源定位**：source-code/client/Fgui/assets/box_hzmj_player/component/PlayerPanel.xml:8
- **原文摘录**：`<controller name="C_Bank" pages="0,hide,1,zhuang1,2,zhuang2,3,zhuang3" selected="1"/>`
