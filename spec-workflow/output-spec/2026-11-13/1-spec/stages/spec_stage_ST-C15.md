# 结算

> 阶段 ID：`ST-C15`。来源：模板「结算」章节。客户端视角规格，客户端逻辑与 UI 交互以 Code/Fgui 代码证据支撑。

## 0. 阶段

- **阶段 ID**：`ST-C15`
- **阶段**：结算
- **来源章节**：结算
- **涉及协议消息**：MsgResultHu、MsgEndGame、MsgPlayerScore、MsgEndWait、MsgWallMah、MsgJuData、MsgStartGame
- **涉及 UI 模块**：box_hzmj_tipAni、box_hzmj_result（Fgui 资产包），BoxHzmjMah2DView、BoxHzmjMainView、BoxHzmjTipAniView、BoxHzmjPlayerView、BoxHzmjResultView、BoxHzmjResultMid、BoxHzmjResultLeft、BoxHzmjResultUtil、BoxHzmjFlowUtil（代码视图与组件）
- **阶段概述**：一局胡牌或黄庄后停止行牌并收敛桌面，先亮四家手牌与「对局结束/黄庄」标记，再按序播番型字效、刷新累计积分与飘分，最后弹出以本家置顶的小结算，逐行展示手牌结构、净得分、番型与承包标记，并支持继续游戏或返回大厅。

## 术语与单位

| 术语 | 定义 | 单位/量纲 | 作用域 | 来源 |
| --- | --- | --- | --- | --- |
| 财神 | 白板固定为财神，只在胡牌判定时代替顺子、刻子或对子所缺的牌；吃、碰、杠不能使用财神。 | 张（牌） | 全局（胡牌判定与结算展示） | 模板名词章节（第12行） |
| 牢庄 | 本期固定笃三老庄，每小局庄家都按三牢、8 倍计算，小结算庄家行对应「庄×3」。 | 倍（三牢、8 倍） | 每小局庄家行 | 模板名词章节（第13行） |
| 摊 | A 吃进 B 打出的牌，A 对 B 记 1 摊，两个方向分开计；碰、直杠、加杠、暗杠不计摊，每小局重新累计。 | 次 | 每小局重新累计 | 模板名词章节（第14行） |
| 承包 | 庄家与闲家之间某一方向有效摊达到条件后，承包方在自摸结算时代赔；反承包是原被承包方自摸时原承包方按加倍规则赔付。 | 关系（无量纲） | 庄家与闲家之间 | 模板名词章节（第15行） |
| 放铳 | 打出的牌被他人合法胡走；胡牌者称为点炮胡，白板财神弃牌不能点炮胡。 | 事件（无量纲） | 每小局 | 模板名词章节（第19行） |
| 流局 | 牌墙剩 21 张时当前玩家再摸 1 张剩 20 张，先完成本次摸打和弃牌响应，无人胡牌时在下一次应摸牌前判黄庄。 | 事件（无量纲） | 每小局末 | 模板名词章节（第20行） |

## 跨切面行为

- **服务端驱动结算渲染**：结算渲染全部由服务端 MsgResultHu 下发字段驱动（win_losts、hu_items、player_hands、fan_ids、bao_settles、player_score），客户端不本地计算输赢分 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:109）
- **小结算公共壳**：小结算走公共壳 BoxRoomMahResultNewView（common_game 模块，本仓库代码快照未包含），杭州麻将只提供 KW_MID_COMP 中间区与 KW_LEFT_BOTTOM 财神区，标题、底部按钮、长按看桌由基类实现 —— 跨切面（source-code/client/Code/layer/BoxHzmjResultView.ts:50）
- **桌面结算表现集中在 box_hzmj_tipAni**：桌面结算表现集中在 box_hzmj_tipAni 视图（KW_GameEnd、KW_Ani_CPG_*、KW_Ani_DP_*、KW_ResultScore*），按 SC_PLAYER_LOCAL_SEAT_MAP 做人数到节点的映射 —— 跨切面（source-code/client/Code/layer/BoxHzmjTipAniView.ts:881）
- **本地座位换算**：座位一律以本地座位索引运算，服务端座位通过 TableData.seatToLocal/localToSeat 双向换算 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:171）
- **小结算与总结算分离**：CMD_GAME_RESULT 处理小结算 ResultHu，CMD_GAME_TOTAL_RESULT 处理 BoxScoreNotify 大结算 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:309）
- **表现时序混用动画回调与固定定时器**：表现时序混用动画回调与固定定时器（小结算固定 setTimeout 3 秒），与飘分完成不严格同步 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:306）

## `FP-ST-C15-001` 结算触发与胡张认定

- **主描述**：胡牌确认后进入结算，客户端接收 MsgResultHu 并按胡牌类型确定胡张与放铳来源，作为后续亮牌与展示的基础。
- **范围与边界**：覆盖胡牌确认到结算数据落库这一段，不含黄庄分支与各端界面表现。
- **总体协作**：GameResultHuCmd 接收 MsgResultHu 后依次落库、亮牌、更新飘分数据、播动画并延迟打开小结算。

### 原子项

#### `AT-ST-C15-001` 胡牌确认后停止行牌

- **规则说明**：胡牌确认后停止行牌。
- **触发条件**：服务端下发 MsgResultHu，客户端收到即视为胡牌确认并进入结算链路。
- **配置影响**：本原子项无独立配置
- **客户端交互**：操作按钮控制器切到空态，手牌不可再出牌。
- **限制与禁止**：无
- **异常与边界**：停行牌由服务端下发结算消息触发，客户端无本地胡牌确认流程。
- **验收**：收到 MsgResultHu 后 onCloseOperate 与 onHidePutCardUi 被派发、操作区关闭；本家胡牌时出牌步进置 false，无法再出牌。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:241；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:185
- **服务端职责**：下发 MsgResultHu（以结算消息触发客户端停行牌）
- **客户端职责**：GameResultHuCmd 收到 MsgResultHu 后立刻派发 onCloseOperate 与 onHidePutCardUi 关闭操作区，本家胡牌时把出牌步进置为 false。
- **协作边界**：客户端消费 MsgResultHu 派发本地关闭事件；胡牌确认判定完全依赖服务端。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:241
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.onCloseOperate);`

#### `AT-ST-C15-002` 每小局只结算一次

- **规则说明**：胡牌确认后停止行牌，每小局只结算一次。
- **触发条件**：服务端下发 MsgResultHu；「只结算一次」依赖服务端每小局仅下发一次。
- **配置影响**：本原子项无独立配置
- **客户端交互**：客户端代码未找到对应实现（待确认）
- **限制与禁止**：每小局只结算一次（约束落在服务端下发侧）。
- **异常与边界**：GameResultHuCmd 与 ResultCmd 均未做幂等或次数校验，完全依赖服务端每局只下发一次 MsgResultHu；重复下发会重复打开小结算。
- **验收**：服务端每局单次下发时小结算仅打开一次；客户端侧无可校验的幂等逻辑，以服务端行为为准。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：下发 MsgResultHu（每小局仅一次，客户端未做校验）
- **客户端职责**：待确认
- **协作边界**：客户端消费 MsgResultHu，不本地校验结算次数，次数正确性交由服务端保证。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C15-003` 自摸的胡张

- **规则说明**：自摸的胡张是本次摸入或补入的牌。
- **触发条件**：MsgResultHu 到达且胡牌类型为自摸，结算亮牌阶段取胡张传给桌面表现。
- **配置影响**：本原子项无独立配置
- **客户端交互**：胡张在本家手牌末位亮出并参与胡牌落地表现。
- **限制与禁止**：无
- **异常与边界**：客户端未区分「摸入」与「补入」，统一取 moCard。
- **验收**：自摸结算亮牌时，PlayerCardsData.moCard 作为胡张拼到本家手牌末尾（resetHandCards(localSeat, cards.concat(huValue))）。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:250；source-code/client/Code/layer/BoxHzmjMah2DView.ts:984
- **服务端职责**：下发 MsgResultHu（胡牌类型与胡张相关字段）
- **客户端职责**：结算亮牌时以 PlayerCardsData.moCard 作为胡张传给桌面胡牌表现，桌面把胡张拼到本家手牌末尾展示。
- **协作边界**：客户端消费 MsgResultHu 后读取本地 moCard 数据确定胡张，不做摸入/补入区分。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:250
- **原文摘录**：`GameData.getPlayerCardsData(localSeat).moCard,`

#### `AT-ST-C15-004` 点炮胡的胡张

- **规则说明**：点炮胡的胡张是弃牌。
- **触发条件**：MsgResultHu 到达且胡牌类型为放铳类（df_from 有效）。
- **配置影响**：本原子项无独立配置
- **客户端交互**：放铳方牌河最后一张被移入胡牌手牌。
- **限制与禁止**：无
- **异常与边界**：仅当放铳座位（dfFrom）非胡牌家本人、河牌最后一张等于胡张且 needRemove 成立时才从牌河移除。
- **验收**：点炮胡结算时胡张取自弃牌，放铳方牌河末张被移除并入胡牌手牌。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:997；source-code/client/Code/layer/BoxHzmjMah2DView.ts:998
- **服务端职责**：下发 MsgResultHu（df_from 与胡张字段）
- **客户端职责**：桌面胡牌表现中，若放铳座位河牌最后一张等于胡张，则把该弃牌从牌河移除，说明胡张取自弃牌。
- **协作边界**：客户端消费 MsgResultHu 的放铳信息，本地按牌河末张匹配完成移除表现。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMah2DView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:997
- **原文摘录**：`if (dfFrom != localSeat && this.outs[dfFrom]?.getLastMah() == huValue && needRemove) {`

#### `AT-ST-C15-005` 抢杠胡的胡张

- **规则说明**：抢杠胡的胡张是被抢的第 4 张。
- **触发条件**：MsgResultHu 到达且 hu_type 为抢杠胡（HT_ROBKONG）。
- **配置影响**：本原子项无独立配置
- **客户端交互**：抢杠胡与点炮共用点炮表现与胡张展示。
- **限制与禁止**：无
- **异常与边界**：客户端把点炮、点杠花、抢杠胡统一按放铳类型处理，用协议 df_from 作放铳方、dan_fang 作胡张，没有针对「第 4 张」的独立判断；「被抢的第 4 张」由服务端保证，客户端无校验或日志；协议无加杠牌专字段。
- **验收**：抢杠胡结算按放铳类型表现，胡张取协议 dan_fang；「第 4 张」正确性以服务端下发为准。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:339；source-code/client/Code/data/PlayerCardsData.ts:284
- **服务端职责**：下发 MsgResultHu（dan_fang 传被抢的第 4 张，df_from 传加杠者）
- **客户端职责**：客户端把点炮、点杠花、抢杠胡统一按放铳类型处理，用协议 df_from 作放铳方、dan_fang 作胡张，没有针对「第 4 张」的独立判断。
- **协作边界**：客户端消费 MsgResultHu 的 hu_type/df_from/dan_fang，「第 4 张」语义完全由服务端保证。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:339
- **原文摘录**：`return huType === HuType.HT_DISCARD || huType === HuType.HT_DIAN_GANG_HUA || huType === HuType.HT_ROBKONG;`

## `FP-ST-C15-002` 终局桌面收敛

- **主描述**：结算时关闭各端操作入口、亮出四家手牌，并在桌面中央给出对局结束标记，同时保留终局牌河、财神与余牌数。
- **范围与边界**：桌面牌面与操作区，不含番型字效、飘分与小结算面板。
- **总体协作**：GameResultHuCmd 负责关闭操作区、写入亮牌数据与派发结束类型；BoxHzmjMah2DView、BoxHzmjMainView、BoxHzmjTipAniView 分担具体表现。

### 原子项

#### `AT-ST-C15-006` 停止操作按钮

- **规则说明**：各端停止操作按钮。
- **触发条件**：结算派发 onCloseOperate（由 MsgResultHu 触发），主视图关闭操作与出牌权限。
- **配置影响**：本原子项无独立配置
- **客户端交互**：吃碰杠胡过等操作按钮全部隐藏，手牌不可出；本家胡牌时解除压暗。
- **限制与禁止**：无
- **异常与边界**：无
- **验收**：结算后 KW_Handler 的按钮状态控制器切到 EMPTY，本家手牌 canPutCard 置 false。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:494；source-code/client/Code/layer/BoxHzmjMainView.ts:497
- **服务端职责**：下发 MsgResultHu（驱动客户端关闭操作区）
- **客户端职责**：收到 onCloseOperate 后把 KW_Handler 的按钮状态控制器置空，并关闭更多选择、复盘操作与出牌权限。
- **协作边界**：客户端消费本地事件（源自 MsgResultHu）关闭操作入口，无服务端二次交互。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:494
- **原文摘录**：`this.view.KW_Main.KW_Handler.C_BtnState.selectedIndex = BtnState.EMPTY;`

#### `AT-ST-C15-007` 停止胡牌预览

- **规则说明**：各端停止胡牌预览。
- **触发条件**：本家胡牌时结算流程隐藏听牌/胡牌预览；收到游戏结束消息时关闭听牌按钮。
- **配置影响**：本原子项无独立配置
- **客户端交互**：听牌预览面板关闭，听牌按钮隐藏。
- **限制与禁止**：无
- **异常与边界**：关闭听牌按钮的第二条路径由 MsgEndGame 触发，而非 MsgResultHu。
- **验收**：结算后 BoxHzmjTingPaiView 隐藏、听牌信息清空，听牌按钮不显示。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:258；source-code/client/Code/layer/BoxHzmjMainView.ts:446
- **服务端职责**：下发 MsgResultHu（结算隐藏预览）；下发 MsgEndGame（关闭听牌按钮的第二路径）
- **客户端职责**：本家胡牌时结算流程直接隐藏听牌/胡牌预览界面并清空听牌信息；收到游戏结束还会关闭听牌按钮。
- **协作边界**：预览关闭在 MsgResultHu 链内，听牌按钮关闭存在 MsgEndGame 链的第二路径。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:258
- **原文摘录**：`pfbm.uiFgui(FuiBoxHzmjViewDefine.BoxHzmjTingPaiView).hideFgui();`

#### `AT-ST-C15-008` 停止放大弃牌

- **规则说明**：各端停止操作按钮、胡牌预览和放大弃牌（本原子项聚焦停止放大弃牌）。
- **触发条件**：结算流程派发 onHidePutCardUi。
- **配置影响**：本原子项无独立配置
- **客户端交互**：桌面放大弃牌图立即消失。
- **限制与禁止**：无
- **异常与边界**：无
- **验收**：结算后出牌放大节点统一置为不可见。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:242；source-code/client/Code/layer/BoxHzmjMainView.ts:1061
- **服务端职责**：下发 MsgResultHu（驱动隐藏放大弃牌）
- **客户端职责**：结算流程派发 onHidePutCardUi，出牌放大节点统一置为不可见。
- **协作边界**：客户端消费本地事件（源自 MsgResultHu）隐藏放大弃牌节点。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:242
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.onHidePutCardUi);`

#### `AT-ST-C15-009` 方位盘停止倒计时

- **规则说明**：各端停止操作按钮、胡牌预览和放大弃牌，方位盘停止倒计时（本原子项聚焦方位盘停止倒计时）。
- **触发条件**：收到 onGameEnd 事件（由 MsgEndGame 的 GameEndCmd 派发）。
- **配置影响**：本原子项无独立配置
- **客户端交互**：方位盘中央倒计时数字清空，倒计时灯隐藏。
- **限制与禁止**：无
- **异常与边界**：由 MsgEndGame 触发，不在 MsgResultHu 处理链内；若服务端先发结算后发结束，倒计时会在结算期间继续显示。
- **验收**：游戏结束后倒计时计时器停止（stop）、方位盘数字清空（setClockHide）。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:390；source-code/client/Code/layer/BoxHzmjMah2DView.ts:721
- **服务端职责**：下发 MsgEndGame（触发客户端停止倒计时）
- **客户端职责**：收到 onGameEnd 时调用 setClockHide，停止倒计时计时器并清空方位盘数字。
- **协作边界**：停倒计时消费 MsgEndGame 而非 MsgResultHu，时序正确性依赖服务端消息顺序。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMah2DView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:390
- **原文摘录**：`this.setClockHide();`

#### `AT-ST-C15-010` 亮出四家手牌

- **规则说明**：在原牌桌亮出四家手牌。
- **触发条件**：MsgResultHu 到达，先用 player_hands 覆盖各座手牌与副露，再派发 playHuEnd。
- **配置影响**：本原子项无独立配置
- **客户端交互**：四家手牌在牌桌上翻开，本家手牌缩小 0.8 倍让位。
- **限制与禁止**：无
- **异常与边界**：无
- **验收**：结算亮牌后全部座位手牌状态置为亮面（CardState_Box.Up），胡牌家把胡张拼进手牌。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:109；source-code/client/Code/layer/BoxHzmjMah2DView.ts:1059
- **服务端职责**：下发 MsgResultHu（player_hands 提供四家亮牌数据）
- **客户端职责**：先用 player_hands 覆盖各座手牌与副露，再由 playHuEnd 遍历全部座位把手牌状态置为亮面，胡牌家把胡张拼进手牌。
- **协作边界**：客户端消费 MsgResultHu 的 player_hands 做数据落库，亮牌表现由本地事件 playHuEnd 驱动。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:109
- **原文摘录**：`GameData.getPlayerCardsData(localSeat).applyDeskFromPlayerHands(item);`

#### `AT-ST-C15-011` 桌面中央显示「对局结束」

- **规则说明**：桌面中央显示「对局结束」。
- **触发条件**：结算消息 end_type 不为 NONE 时派发 onShowGameEndType。
- **配置影响**：本原子项无独立配置
- **客户端交互**：桌面中央（667,302）出现结束标记图，1 秒后自动复位。
- **限制与禁止**：无
- **异常与边界**：「对局结束」文案是共享包 hzta2330 的图片资源（C_GameEnd page 1=hu），仓库内无可读文本；且 onShowGameEndType 在 1 秒后把 C_GameEnd 复位为 0，与「番型字效期间仍在」不完全一致。
- **验收**：胡牌结算后桌面中央 KW_GameEnd 出现结束标记图（C_GameEnd 切到对应页）。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:84；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1186；source-code/client/Fgui/assets/box_hzmj_tipAni/component/HzmjTipAniComponent.xml:3；source-code/client/Fgui/assets/box_hzmj_tipAni/component/HzmjTipAniComponent.xml:69
- **服务端职责**：下发 MsgResultHu（end_type 标记对局结束类型）
- **客户端职责**：结算消息 end_type 不为 NONE 时派发 onShowGameEndType，动画视图把 KW_GameEnd 的 C_GameEnd 控制器切到对应页。
- **协作边界**：客户端消费 MsgResultHu 的 end_type，结束标记图片与复位时序为本地表现。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:84
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.onShowGameEndType, data.end_type);`

#### `AT-ST-C15-012` 保留终局牌河

- **规则说明**：保留终局牌河。
- **触发条件**：结算流程只覆盖手牌与副露，不清理牌河。
- **配置影响**：本原子项无独立配置
- **客户端交互**：结算与黄庄期间四家河牌保持终局状态，继续游戏后才清空。
- **限制与禁止**：结算链路中禁止清理牌河（实际无清河牌调用）。
- **异常与边界**：桌面仅在下一局 onResetUI 时统一清空四方位手牌、河牌、胡牌与副露。
- **验收**：结算后四家牌河保持终局状态；清空只发生在下一局 onResetUI（_clearAllCards）。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:528；source-code/client/Code/layer/BoxHzmjMah2DView.ts:525
- **服务端职责**：下发 MsgResultHu（结算不携带清河指令）
- **客户端职责**：结算流程只覆盖手牌与副露，不清理牌河；桌面仅在下一局 onResetUI 时统一清空四方位手牌、河牌、胡牌与副露。
- **协作边界**：保留终局牌河为客户端本地行为（不做任何清理），清空由下一局重置事件触发。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMah2DView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:528
- **原文摘录**：`this._clearAllCards();`

#### `AT-ST-C15-013` 保留财神与余牌数

- **规则说明**：保留终局牌河、财神和余牌数（本原子项聚焦保留财神与余牌数）。
- **触发条件**：财神与剩余张数由桌面侧栏组件 KW_LEFT_MAHS / KW_RIGHT_MAHS 常驻显示，结算期间不重置。
- **配置影响**：本原子项无独立配置
- **客户端交互**：桌面左侧财神牌与右侧剩余张数在终局继续可见。
- **限制与禁止**：结算期间不重置侧栏财神与余牌数。
- **异常与边界**：余牌数不随结算协议重算，取最后一次牌墙更新的数值；只有下一局 onResetUI 才隐藏。
- **验收**：结算后左侧财神、右侧余牌数仍显示；下一局 onResetUI 才隐藏（onUpdateJokerSide(0, true)）。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:546；source-code/client/Code/layer/BoxHzmjMah2DView.ts:353
- **服务端职责**：下发 MsgResultHu（结算不重置侧栏显示）；此前下发 MsgWallMah 维持余牌数
- **客户端职责**：财神与剩余张数由桌面侧栏组件 KW_LEFT_MAHS / KW_RIGHT_MAHS 常驻显示，结算期间不重置，只有下一局 onResetUI 才隐藏。
- **协作边界**：余牌数取最后一次牌墙消息的数值，结算消息不参与重算。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMah2DView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:546
- **原文摘录**：`this.onUpdateJokerSide(0, true);`

## `FP-ST-C15-003` 番型字效与点炮标记

- **主描述**：在对局结束标记仍在时，于胡牌者方位播放番型字效，并在放铳方位给出点炮表现。
- **范围与边界**：桌面动画层，不含小结算内的番型文案。
- **总体协作**：GameResultHuCmd 计算胡牌类型与放铳座位后派发 onMsgPlayHuNew / onMsgHuDianPaoAni，由 BoxHzmjTipAniView 按座位节点播放 Spine。

### 原子项

#### `AT-ST-C15-014` 胡牌者方位播放番型字效

- **规则说明**：「对局结束」仍在时，胡牌者方位播放番型字效。
- **触发条件**：结算按胡牌座位逐个派发 onMsgPlayHuNew。
- **配置影响**：本原子项无独立配置
- **客户端交互**：胡牌者方位（KW_Ani_CPG_0~3）播放番型 Spine，基础番走文字节点、组合番走动效节点。
- **限制与禁止**：无
- **异常与边界**：字效与「对局结束」标记并不同步：标记 1 秒后复位，字效按 Spine 时长播放。
- **验收**：胡牌者座位对应 KW_Ani_CPG 节点按番型选 skin 播放文字或动效类字效。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:283；source-code/client/Code/layer/BoxHzmjTipAniView.ts:941；source-code/client/Fgui/assets/box_hzmj_tipAni/component/HzmjTipAniComponent.xml:8
- **服务端职责**：下发 MsgResultHu（hu_items 提供胡牌座位与番型）
- **客户端职责**：结算按胡牌座位逐个派发 onMsgPlayHuNew，动画视图取该座位 KW_Ani_CPG 节点，按番型选 skin 播放文字或动效类字效。
- **协作边界**：客户端消费 MsgResultHu 的胡牌数据本地选番型 skin；「对局结束仍在」的时长约束实际由标记 1 秒复位与 Spine 时长各自决定。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:283
- **原文摘录**：`GameEventBoxHzmj.onMsgPlayHuNew,`

#### `AT-ST-C15-015` 点炮胡在放铳方位显示「点炮」

- **规则说明**：点炮胡和抢杠胡同时在放铳方位显示「点炮」。
- **触发条件**：结算判断为放铳类型（点炮/点杠花/抢杠胡）且存在 df_from。
- **配置影响**：本原子项无独立配置
- **客户端交互**：放铳方方位播放「点炮」Spine；一炮多响播 yipaoduoxiang。
- **限制与禁止**：无
- **异常与边界**：无
- **验收**：放铳座位对应 KW_Ani_DP 节点播放 dianpao skin；一炮多响场景播 yipaoduoxiang。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:266；source-code/client/Code/layer/BoxHzmjTipAniView.ts:881；source-code/client/Fgui/assets/box_hzmj_tipAni/component/HzmjTipAniComponent.xml:32
- **服务端职责**：下发 MsgResultHu（hu_type 与 df_from 提供放铳类型与放铳座位）
- **客户端职责**：结算判断为放铳类型且存在 df_from 时派发点炮动画，动画视图取放铳座位对应的 KW_Ani_DP 节点播放 dianpao skin。
- **协作边界**：客户端消费 MsgResultHu 的放铳字段，按本地座位映射播 Spine。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:266
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.onMsgHuDianPaoAni, huAniType, context.dfFrom);`

#### `AT-ST-C15-016` 抢杠胡的放铳者为加杠者

- **规则说明**：抢杠胡同时在放铳方位显示「点炮」，放铳者是加杠者。
- **触发条件**：hu_type 为抢杠胡（HT_ROBKONG），被并入放铳类型处理。
- **配置影响**：本原子项无独立配置
- **客户端交互**：抢杠胡在 df_from 座位播放点炮表现。
- **限制与禁止**：无
- **异常与边界**：客户端无法自证「加杠者」，只能信任 df_from；若服务端下发错误座位，表现会错位；加杠者身份由服务端给出，客户端无校验或专门字段。
- **验收**：抢杠胡结算时在 df_from 座位播放点炮表现；加杠者身份正确性以服务端下发为准。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:339；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:171
- **服务端职责**：下发 MsgResultHu（df_from 传加杠者座位）
- **客户端职责**：抢杠胡被并入放铳类型，放铳方位直接取协议的 df_from；加杠者身份由服务端给出，客户端无校验或专门字段。
- **协作边界**：客户端消费 MsgResultHu 的 df_from 做座位换算与表现，「加杠者」语义完全依赖服务端。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:339
- **原文摘录**：`return huType === HuType.HT_DISCARD || huType === HuType.HT_DIAN_GANG_HUA || huType === HuType.HT_ROBKONG;`

## `FP-ST-C15-004` 累计积分与飘分

- **主描述**：番型字效结束后刷新头像积分并做座位飘分动画，按得分为 0 过滤，正负分用不同字效，淡出后才打开小结算。
- **范围与边界**：桌面头像积分与飘分动画，不含小结算行内得分。
- **总体协作**：GameResultHuCmd 先写 player.sr 再播字效，字效回调触发 onShowResultScore，TipAniView 按座位逐个飘分。

### 原子项

#### `AT-ST-C15-017` 先刷新头像旁累计积分

- **规则说明**：先刷新头像旁的累计积分。
- **触发条件**：MsgResultHu 到达后结算先把 player_score.scores 写入各座 player.sr 再播动画；独立协议 MsgPlayerScore 也走同一入口。
- **配置影响**：本原子项无独立配置
- **客户端交互**：头像旁累计积分在字效/飘分前更新，正分为金黄色。
- **限制与禁止**：无
- **异常与边界**：写数据在播动画之前，但玩家视图真正刷新分数发生在 onUpdateScore 派发时（飘分阶段也会派发一次），顺序上不能保证在字效之前完成。
- **验收**：结算后各座 player.sr 更新，头像旁分数经 updateSR 刷新（player_score.scores 驱动）。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:88；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:231；source-code/client/Code/layer/BoxHzmjPlayerView.ts:514
- **服务端职责**：下发 MsgResultHu（player_score 提供累计积分）；独立下发 MsgPlayerScore 更新积分
- **客户端职责**：结算先把 player_score.scores 写入各座 player.sr，再播动画；玩家视图收到 onUpdateScore 后刷新头像旁分数，独立协议 MsgPlayerScore 也走同一入口。
- **协作边界**：客户端消费 MsgResultHu / MsgPlayerScore 写积分数据，刷新时机由本地事件派发决定。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:88
- **原文摘录**：`this._updatePlayerScore(data);`

#### `AT-ST-C15-018` 番型字效退场后飘分

- **规则说明**：番型字效退场后，只在本局得分不为 0 的座位内侧飘分（本原子项聚焦字效退场后触发飘分）。
- **触发条件**：第一个座位番型动画完成回调触发 onShowResultScore。
- **配置影响**：本原子项无独立配置
- **客户端交互**：番型字效结束后，各座位同时出现飘分数字。
- **限制与禁止**：无
- **异常与边界**：只以第一个座位（i===0）的动画完成作为触发点，多胡时后面的字效可能仍在播放中就开始飘分。
- **验收**：第一个胡牌座位字效完成后 onShowResultScore 触发，动画视图遍历桌面飘分数据逐座位播放飘分动画。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:288；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:276
- **服务端职责**：下发 MsgResultHu（结算数据驱动飘分）；下发 MsgEndWait（配合阶段流转）
- **客户端职责**：第一个座位番型动画完成回调里触发 onShowResultScore，动画视图遍历桌面飘分数据逐座位播放飘分动画。
- **协作边界**：飘分触发用本地动画回调，不与服务端消息直接联动。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:288
- **原文摘录**：`i === 0 ? dispatchScore : undefined,`

#### `AT-ST-C15-019` 只飘非 0 得分座位

- **规则说明**：只在本局得分不为 0 的座位内侧飘分。
- **触发条件**：写桌面飘分数据时逐座位过滤，score 为 0 直接跳过。
- **配置影响**：本原子项无独立配置
- **客户端交互**：0 分座位不出现飘分数字。
- **限制与禁止**：仅本局得分不为 0 的座位播放飘分。
- **异常与边界**：飘分阶段只对存在飘分数据的座位播放；无座位时立即结束本阶段。
- **验收**：score=0 的座位不写飘分数据、不播飘分；全部为 0 时飘分阶段立即结束。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:206；source-code/client/Code/layer/BoxHzmjTipAniView.ts:704
- **服务端职责**：下发 MsgResultHu（win_losts 提供各座本局得分）
- **客户端职责**：写桌面飘分数据时 score 为 0 的座位直接跳过，飘分阶段只对存在飘分数据的座位播放；无座位时立即结束本阶段。
- **协作边界**：得分过滤为客户端本地判断（score === 0 continue）。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:206
- **原文摘录**：`if (score === 0) continue;`

#### `AT-ST-C15-020` 飘分正分金黄色

- **规则说明**：正分金黄色。
- **触发条件**：飘分数字 score>=0 时选字体。
- **配置影响**：本原子项无独立配置
- **客户端交互**：正飘分以金色数字字效滑入并淡出。
- **限制与禁止**：无
- **异常与边界**：飘分数字 score>=0 时使用 fnt_win 位图字体，颜色由字体图集决定，代码未设置文本颜色；组件默认文本色为 #ffffff，金黄色应来自 fnt_win 图集；仓库内无法验证具体色值，需美术资源确认。
- **验收**：正分座位飘分使用 fnt_win 位图字体；金黄色视觉以 fnt_win 图集为准。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:567；source-code/client/Fgui/assets/box_hzmj_tipAni/component/ResultScoreCom.xml:13
- **服务端职责**：下发 MsgResultHu（本局得分决定正负）
- **客户端职责**：飘分数字 score>=0 时使用 fnt_win 位图字体，颜色由字体图集决定，代码未设置文本颜色。
- **协作边界**：正负判定为客户端本地比较，颜色表现依赖美术字体资源。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjTipAniView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:567
- **原文摘录**：`score >= 0`

#### `AT-ST-C15-021` 飘分负分浅蓝灰带减号

- **规则说明**：负分浅蓝灰色并带减号。
- **触发条件**：飘分数字 score<0 时切换字体。
- **配置影响**：本原子项无独立配置
- **客户端交互**：负飘分以浅蓝灰色数字带减号滑入并淡出。
- **限制与禁止**：无
- **异常与边界**：浅蓝灰为 fnt_lose 图集颜色，代码无可读色值；负号由字体图集的减号字模提供，减号字模存在于 box_hzmj_result/fnt/lose 目录。
- **验收**：负分座位飘分使用 fnt_lose 位图字体且带减号字模。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:570
- **服务端职责**：下发 MsgResultHu（本局得分决定正负）
- **客户端职责**：飘分数字 score<0 时切换 fnt_lose 位图字体，负号由字体图集的减号字模提供。
- **协作边界**：正负判定为客户端本地比较，颜色与减号表现依赖美术字体资源。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjTipAniView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:570
- **原文摘录**：`fgui.UIPackage.getItemURL(PackageBoxHzmjView.PackageBoxHzmjTipAni, "fnt_lose");`

#### `AT-ST-C15-022` 飘分淡出后短暂保留终局牌桌再开小结算

- **规则说明**：飘分淡出后短暂保留终局牌桌，再打开小结算。
- **触发条件**：飘分节点自身在 time=29 开始 Alpha 淡出；结算命令固定 3 秒延时执行 CMD_GAME_RESULT。
- **配置影响**：小结算延迟为固定常量 delayTime=3（秒），无外部配置。
- **客户端交互**：飘分淡出后终局牌桌短暂停留，随后小结算覆盖。
- **限制与禁止**：无
- **异常与边界**：3 秒为写死常量，与飘分实际播放时长无联动；低端机或慢速模式可能提前/滞后。
- **验收**：飘分节点 time=29 起 Alpha 淡出（1 到 0，duration=5）；结算动画开始约 3 秒后 CMD_GAME_RESULT 执行打开小结算。
- **职责域**：client
- **职责依据**：source-code/client/Fgui/assets/box_hzmj_tipAni/component/ShowResultScore.xml:10；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:306；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:309
- **服务端职责**：下发 MsgResultHu（驱动结算动画与延迟开小结算）
- **客户端职责**：飘分节点自身在 time=29 开始 Alpha 淡出；结算命令用固定 3 秒延时执行 CMD_GAME_RESULT 打开小结算，不依赖飘分回调。
- **协作边界**：淡出时序在 Fgui 组件内、开小结算时序为固定定时器，两者不严格同步。
- **来源文件**：`source-code/client/Fgui/assets/box_hzmj_tipAni/component/ShowResultScore.xml`
- **来源定位**：source-code/client/Fgui/assets/box_hzmj_tipAni/component/ShowResultScore.xml:10
- **原文摘录**：`<item time="29" type="Alpha" target="n0_9iyp" tween="true" startValue="1" endValue="0" duration="5" label2="end"/>`

## `FP-ST-C15-005` 黄庄结算

- **主描述**：无人胡牌时按黄庄分支收敛桌面：亮牌、显示黄庄、保留牌河财神与余牌数 20、不飘分，并打开标题为「黄庄」的小结算。
- **范围与边界**：仅流局（EndType.ET_DRAWN）分支，共用结算消息。
- **总体协作**：MsgResultHu 的 end_type=ET_DRAWN 驱动同一套结算链路，飘分因数据全 0 自然跳过。

### 原子项

#### `AT-ST-C15-023` 黄庄亮出四家手牌

- **规则说明**：黄庄：亮出四家手牌。
- **触发条件**：MsgResultHu 的 end_type=ET_DRAWN 走同一套结算链路派发 playHuEnd。
- **配置影响**：本原子项无独立配置
- **客户端交互**：黄庄时四家手牌同样翻开在牌桌上。
- **限制与禁止**：无
- **异常与边界**：亮牌逻辑 playHuEnd 无条件遍历全部座位并置为亮面，不区分胡牌与流局。
- **验收**：黄庄时全部座位手牌状态置为亮面（遍历 playCnt 个座位）。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:1047；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:303
- **服务端职责**：下发 MsgResultHu（end_type=ET_DRAWN 驱动黄庄亮牌）
- **客户端职责**：亮牌逻辑 playHuEnd 无条件遍历全部座位并置为亮面，不区分胡牌与流局。
- **协作边界**：黄庄与胡牌共用本地亮牌链路，仅由 end_type 区分分支表现。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMah2DView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:1047
- **原文摘录**：`for (let i = 0; i < TableData.inst.playCnt; i++) {`

#### `AT-ST-C15-024` 黄庄中央显示「黄庄」

- **规则说明**：桌面中央显示「黄庄」。
- **触发条件**：end_type=ET_DRAWN 派发 onShowGameEndType。
- **配置影响**：本原子项无独立配置
- **客户端交互**：桌面中央显示黄庄标记图（与胡牌结束使用不同图片）。
- **限制与禁止**：无
- **异常与边界**：「黄庄」文案为图片资源（page 2 drawn，取共享包 gnpghe 图），仓库内无可读文本。
- **验收**：黄庄时 C_GameEnd 切到 drawn 页（对应 EndType.ET_DRAWN）。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:1186；source-code/client/Fgui/assets/box_hzmj_tipAni/component/HzmjTipAniComponent.xml:70；source-code/client/Code/config/GameDefine.ts:441
- **服务端职责**：下发 MsgResultHu（end_type=ET_DRAWN）
- **客户端职责**：end_type=ET_DRAWN 派发 onShowGameEndType，C_GameEnd 切到 drawn 页，KW_GameEnd 使用该页对应图片。
- **协作边界**：客户端消费 end_type 选页，「黄庄」文案为图片资源不可文本验证。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjTipAniView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:1186
- **原文摘录**：`this.view.KW_Main.C_GameEnd.selectedIndex = type;`

#### `AT-ST-C15-025` 黄庄保留牌河财神与余牌数 20

- **规则说明**：黄庄：保留终局牌河、财神和余牌数 20（本原子项聚焦余牌数 20 与财神保留）。
- **触发条件**：牌河、财神、余牌数沿用桌面常驻显示，结算流程不清空。
- **配置影响**：本原子项无独立配置
- **客户端交互**：黄庄时右侧仍显示剩余的 20 张，左侧仍显示本局财神。
- **限制与禁止**：结算流程不写死余牌数。
- **异常与边界**：余牌数取最后一次牌墙刷新值，结算不写死 20；20 的正确性依赖服务端牌墙消息时序；小结算入参带了 remaining_wall_cards，但好友房中间区未使用该字段。
- **验收**：黄庄后桌面保留牌河、财神与余牌数显示；余牌数值取最后一次 MsgWallMah 更新结果（预期为 20）。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/helperCmd/ResultCmd.ts:67；source-code/client/Code/layer/BoxHzmjMah2DView.ts:546
- **服务端职责**：下发 MsgResultHu（携带 remaining_wall_cards）；下发 MsgWallMah（余牌数 20 由牌墙消息保证）
- **客户端职责**：牌河、财神、余牌数沿用桌面常驻显示，结算流程不清空；余牌数取最后一次牌墙刷新值，结算不写死 20。
- **协作边界**：余牌数 20 的正确性依赖服务端牌墙消息时序，客户端不重算。
- **来源文件**：`source-code/client/Code/controller/cmd/helperCmd/ResultCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/helperCmd/ResultCmd.ts:67
- **原文摘录**：`walls: (data.remaining_wall_cards ?? []).concat(),`

#### `AT-ST-C15-026` 黄庄不飘分

- **规则说明**：不飘分。四家本局都是 0。
- **触发条件**：飘分数据写入时跳过所有 score=0 的座位。
- **配置影响**：本原子项无独立配置
- **客户端交互**：黄庄不出现飘分数字，直接进入小结算流程。
- **限制与禁止**：黄庄不飘分（四家本局都是 0）。
- **异常与边界**：飘分阶段总数为 0 时立即走完成分支，不发任何飘分动画。
- **验收**：黄庄时无任何座位写入飘分数据，nTotal 为 0 立即结束飘分阶段。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:206；source-code/client/Code/layer/BoxHzmjTipAniView.ts:649
- **服务端职责**：下发 MsgResultHu（黄庄时各家本局得分为 0）
- **客户端职责**：飘分数据写入时跳过所有 score=0 的座位，飘分阶段总数为 0 时立即走完成分支，不发任何飘分动画。
- **协作边界**：不飘分由全 0 得分自然实现，客户端无黄庄专用飘分开关。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:206
- **原文摘录**：`if (score === 0) continue;`

#### `AT-ST-C15-027` 黄庄小结算标题

- **规则说明**：随后打开小结算，标题为「黄庄」。
- **触发条件**：组装小结算数据时 end_type=ET_DRAWN。
- **配置影响**：本原子项无独立配置
- **客户端交互**：小结算标题显示黄庄。
- **限制与禁止**：无
- **异常与边界**：标题渲染在 BoxRoomMahResultNewView（common_game 未包含），本仓库只能确认传给壳的流局标记。
- **验收**：黄庄时小结算主题入参 selfWinLost=2（流局），由公共壳按此渲染标题。
- **职责域**：client
- **职责依据**：source-code/client/Code/util/BoxHzmjResultUtil.ts:37；source-code/client/Code/util/BoxHzmjResultUtil.ts:38
- **服务端职责**：下发 MsgResultHu（end_type=ET_DRAWN）
- **客户端职责**：组装小结算数据时 end_type=ET_DRAWN 时把 selfWinLost 置为 2（流局），交由公共壳按此渲染标题。
- **协作边界**：客户端只产出流局主题入参，标题文案渲染在公共壳内。
- **来源文件**：`source-code/client/Code/util/BoxHzmjResultUtil.ts`
- **来源定位**：source-code/client/Code/util/BoxHzmjResultUtil.ts:37
- **原文摘录**：`if (params.end_type === EndType.ET_DRAWN) {`

## `FP-ST-C15-006` 小结算层级与主题

- **主描述**：小结算覆盖在终局牌桌之上，按本家视角排列四行并高亮本家行，按本端净得分或黄庄切换标题主题。
- **范围与边界**：小结算整体层级、行顺序与标题主题，不含行内牌面细节。
- **总体协作**：BoxHzmjResultView 继承公共结算壳，BoxHzmjResultMid 渲染中间四行，BoxHzmjResultUtil 计算本家输赢与主题入参。

### 原子项

#### `AT-ST-C15-028` 小结算盖在终局牌桌上

- **规则说明**：小结算盖在终局牌桌上。
- **触发条件**：CMD_GAME_RESULT 打开小结算视图。
- **配置影响**：本原子项无独立配置
- **客户端交互**：小结算面板整体压在牌桌上方，牌桌仍在背后可见。
- **限制与禁止**：无
- **异常与边界**：无
- **验收**：小结算排序层 Result 高于牌桌 Main 层（FuiCommonGameViewSorting），覆盖终局牌桌。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjResultView.ts:39；source-code/client/Code/layer/BoxHzmjMainView.ts:129
- **服务端职责**：下发 MsgResultHu（驱动小结算打开）
- **客户端职责**：小结算视图使用公共结算壳，排序层为 Result，高于牌桌主视图的 Main 层，从而覆盖终局牌桌。
- **协作边界**：层级关系为客户端视图排序配置，无服务端参与。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjResultView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjResultView.ts:39
- **原文摘录**：`sortingOrder: FuiCommonGameViewSorting.Result,`

#### `AT-ST-C15-029` 本家第一行与相对方位顺序

- **规则说明**：各端以本家为第一行，向下依次为下家、对家、上家。
- **触发条件**：小结算中间区列表按玩家列表顺序渲染，每行方位文案由本地座位计算。
- **配置影响**：本原子项无独立配置
- **客户端交互**：行首竖排显示 本家/下家/对家/上家。
- **限制与禁止**：无
- **异常与边界**：「本家第一行」依赖 TableData.getAllPlayers() 的返回顺序（common_game 未包含），代码中没有显式排序把本家提到首位；多人时按座位号推导方位文案。
- **验收**：每行方位文案按本地座位正确计算（本家、下家、对家、上家）；行顺序依赖玩家列表返回顺序。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:965；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:976；source-code/client/Fgui/assets/box_hzmj_result/BoxHzmjResultMid.xml:4
- **服务端职责**：下发 MsgResultHu（player_hands/win_losts 按座位提供行数据）
- **客户端职责**：中间区列表按玩家列表顺序渲染，每行方位文案由本地座位计算：本家、下家、对家、上家（多人时按座位号推导）。
- **协作边界**：方位文案为客户端本地座位运算；行顺序依赖公共模块玩家列表顺序。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:965
- **原文摘录**：`if (localSeat == SELF_LOCAL_SEAT) {`

#### `AT-ST-C15-030` 本家行置顶并高亮

- **规则说明**：本家行置顶并高亮。
- **触发条件**：本家行（index==SELF_LOCAL_SEAT）渲染时打开本家专属控制器。
- **配置影响**：本原子项无独立配置
- **客户端交互**：本家行背景切换为高亮底图，带金币图标与专属赢/输底图。
- **限制与禁止**：无
- **异常与边界**：高亮已确认（C_IsSelf + KW_ICON_GOLD + C_WinLost 底图），置顶仅能依赖列表顺序推断。
- **验收**：本家行打开 C_IsSelf 页、显示金币角标（KW_ICON_GOLD）、按输赢切换行底图与分隔线。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:367；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:369；source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:26
- **服务端职责**：下发 MsgResultHu（驱动小结算渲染）
- **客户端职责**：本家行打开 C_IsSelf 页、显示金币角标、按输赢切换行底图与分隔线，实现高亮；置顶未在行内代码中实现。
- **协作边界**：高亮为客户端本地判断（index==SELF_LOCAL_SEAT）；置顶依赖列表顺序。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:367
- **原文摘录**：`const isSelf = index == SELF_LOCAL_SEAT;`

#### `AT-ST-C15-031` 按净得分切换主题

- **规则说明**：胡牌局按本端本局净得分切换主题：大于或等于 0 为「恭喜获胜」，小于 0 为「遗憾失败」。
- **触发条件**：组装结算数据时按本家 win_losts 分数计算 selfWinLost。
- **配置影响**：本原子项无独立配置
- **客户端交互**：小结算标题随本家净得分切换获胜/失败主题。
- **限制与禁止**：无
- **异常与边界**：标题文案与判定均在公共壳内，本仓库只确认传给壳的 0/1/2 主题入参。
- **验收**：selfScore>=0 记 0、<0 记 1，公共壳按该入参渲染标题主题。
- **职责域**：client
- **职责依据**：source-code/client/Code/util/BoxHzmjResultUtil.ts:36；source-code/client/Code/layer/BoxHzmjResultView.ts:50
- **服务端职责**：下发 MsgResultHu（win_losts 提供本家净得分）
- **客户端职责**：组装结算数据时按本家 win_losts 分数计算 selfWinLost（>=0 记 0，<0 记 1），交给公共壳决定标题主题。
- **协作边界**：净得分正负为客户端本地比较，主题文案渲染在公共壳内。
- **来源文件**：`source-code/client/Code/util/BoxHzmjResultUtil.ts`
- **来源定位**：source-code/client/Code/util/BoxHzmjResultUtil.ts:36
- **原文摘录**：`let selfWinLost = selfScore >= 0 ? 0 : 1;`

#### `AT-ST-C15-032` 黄庄四端标题都是「黄庄」

- **规则说明**：黄庄四端都是「黄庄」。
- **触发条件**：四端收到的 end_type 都是 ET_DRAWN。
- **配置影响**：本原子项无独立配置
- **客户端交互**：四端小结算标题都显示黄庄。
- **限制与禁止**：无
- **异常与边界**：四端一致性由服务端 end_type 保证；标题渲染仍在公共壳内。
- **验收**：各端小结算主题入参均为流局值 2（selfWinLost=2）。
- **职责域**：client
- **职责依据**：source-code/client/Code/util/BoxHzmjResultUtil.ts:37；source-code/client/Code/controller/cmd/helperCmd/ResultCmd.ts:65
- **服务端职责**：下发 MsgResultHu（四端 end_type 均为 ET_DRAWN）
- **客户端职责**：四端收到的 end_type 都是 ET_DRAWN，各自把小结算主题入参置为流局值 2，因此标题一致。
- **协作边界**：四端一致性由服务端 end_type 保证，客户端各端独立计算同一入参。
- **来源文件**：`source-code/client/Code/util/BoxHzmjResultUtil.ts`
- **来源定位**：source-code/client/Code/util/BoxHzmjResultUtil.ts:37
- **原文摘录**：`if (params.end_type === EndType.ET_DRAWN) {`

## `FP-ST-C15-007` 结算行内容（左中右结构）

- **主描述**：小结算每行左侧座位头像昵称、中间碰杠区与手牌、庄家档位、杠牌叠放与胡张标记等牌面结构。
- **范围与边界**：单行 ResultItem 的结构与牌面渲染，不含得分数值与番型文案。
- **总体协作**：BoxHzmjResultMid 逐行解析 hu_items / player_hands，按 Comb 与 Hand 两种模式渲染副露与手牌，并驱动 ResultItem 各控制器。

### 原子项

#### `AT-ST-C15-033` 左侧座位、头像与昵称

- **规则说明**：每行左侧为座位、头像和昵称。
- **触发条件**：小结算中间区逐行渲染时写入。
- **配置影响**：本原子项无独立配置
- **客户端交互**：行左显示 本家/下家/对家/上家 竖排文字与头像、昵称，头像可点击。
- **限制与禁止**：无
- **异常与边界**：无
- **验收**：每行写入竖排方位文案（KW_Seat_Name）与昵称（KW_Nickname），头像组件（KW_Click_Head）展示并支持点击打开用户信息弹窗。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:150；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:306；source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:30
- **服务端职责**：下发 MsgResultHu（座位、昵称与头像信息经玩家数据提供）
- **客户端职责**：每行写入竖排方位文案、昵称，并使用头像组件展示玩家头像，点击头像可打开用户信息弹窗。
- **协作边界**：方位文案为客户端本地座位运算，头像与昵称来自玩家数据。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:150
- **原文摘录**：`obj.KW_Seat_Name.text = this._getSeatDirectionName(localSeat);`

#### `AT-ST-C15-034` 庄家行显示「庄×3」

- **规则说明**：庄家行显示「庄×3」。
- **触发条件**：庄家行按连庄次数设置 C_IsBank 页。
- **配置影响**：连庄档位数据取 GameData.getLianZhuangCount()（与桌面头像 C_Bank 同源）。
- **客户端交互**：庄家行头像位置显示庄/庄×2/庄×3 图标。
- **限制与禁止**：不能用 ResultHu 覆盖后的 banker_level，需与桌面头像同源（getLianZhuangCount）。
- **异常与边界**：「庄×3」要求 lian_zhuang 下发抖三档（本期笃三老庄固定三牢）；C_IsBank 页 1/2/3 对应庄、庄×2、庄×3。
- **验收**：庄家行 C_IsBank 按 lianZhuang 选中 1/2/3 页（庄、庄×2、庄×3），非庄家行选 0 页。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:402；source-code/client/Code/controller/cmd/helperCmd/ResultCmd.ts:61；source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:10
- **服务端职责**：下发 MsgJuData（lian_zhuang 提供连庄档位）
- **客户端职责**：庄家行按连庄次数设置 C_IsBank 页（1/2/3 对应庄、庄×2、庄×3），数据取 GameData.getLianZhuangCount()，与桌面头像 C_Bank 同源。
- **协作边界**：连庄档位消费 MsgJuData 落库的数据，客户端不再从结算消息取 banker_level。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:402
- **原文摘录**：`obj.C_IsBank.selectedIndex = isBanker ? Math.max(0, Math.min(3, page)) : 0;`

#### `AT-ST-C15-035` 中间从左到右为碰杠区和手牌

- **规则说明**：中间从左到右是碰杠区和手牌。
- **触发条件**：逐行解析 hu_items / player_hands 渲染副露与手牌。
- **配置影响**：本原子项无独立配置
- **客户端交互**：行内左侧依次排开碰杠组，右侧接连续手牌。
- **限制与禁止**：无
- **异常与边界**：副露宽度改变会重建行布局（n10 水平布局组统一重排，excludeInvisibles）。
- **验收**：先按 C_ShowComp 页展示 KW_Comp0~7 副露，再渲染 KW_Mah_List / KW_Mah_Hu 手牌，最终由 n10 水平布局组统一重排为从左到右。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:527；source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:68
- **服务端职责**：下发 MsgResultHu（hu_items/player_hands 提供副露与手牌）
- **客户端职责**：渲染时先按 C_ShowComp 页展示 KW_Comp0~7 副露，再渲染 KW_Mah_List / KW_Mah_Hu 手牌，最后由 n10 水平布局组统一重排；副露宽度改变会重建行布局。
- **协作边界**：副露与手牌数据来自 MsgResultHu，布局排布为客户端本地实现。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:527
- **原文摘录**：`obj.C_ShowComp.selectedIndex = count;`

#### `AT-ST-C15-036` 杠的第 4 张垒在上方

- **规则说明**：杠的第 4 张垒在上方。
- **触发条件**：渲染杠组时切换 comboSefl 的 4mah 页。
- **配置影响**：本原子项无独立配置
- **客户端交互**：杠牌展示为下方 3 张、上方叠 1 张。
- **限制与禁止**：无
- **异常与边界**：mah0~2 的 y 为 20，mah3 的 y 为 5，形成上方叠放。
- **验收**：杠组第 4 张牌节点 mah3 单独放在上方一行。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:557；source-code/client/Fgui/assets/box_hzmj_result/component/comboSefl.xml:21
- **服务端职责**：下发 MsgResultHu（副露组合提供杠组数据）
- **客户端职责**：杠组切换 comboSefl 的 4mah 页，第 4 张牌节点 mah3 单独放在上方一行。
- **协作边界**：杠组数据来自 MsgResultHu，叠放布局为 Fgui 组件实现。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:557
- **原文摘录**：`compNode.C_ComboType.setSelectedPage("4mah");`

#### `AT-ST-C15-037` 暗杠顶张正面

- **规则说明**：暗杠顶张正面。
- **触发条件**：暗杠组打开 C_IsAnGan 页。
- **配置影响**：本原子项无独立配置
- **客户端交互**：暗杠显示 3 张暗牌 + 1 张正面牌。
- **限制与禁止**：无
- **异常与边界**：第 4 张使用 state=3，该页在 mahHandSelf 中未具名（既非 Down 也非 Stand/Up），正面的具体视觉需以包内控制器页为准。
- **验收**：暗杠前 3 张牌状态为暗面（state=1），第 4 张非暗状态渲染牌面。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:583；source-code/client/Fgui/assets/box_hzmj_result/component/mahHandSelf.xml:3
- **服务端职责**：下发 MsgResultHu（副露组合标记暗杠）
- **客户端职责**：暗杠组打开 C_IsAnGan 页，前 3 张牌状态置为暗面（C_IsAnGan=1 且 i<3 时 state=1），第 4 张用非暗状态渲染牌面。
- **协作边界**：暗杠标记来自 MsgResultHu，牌面状态切换为客户端本地实现。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:583
- **原文摘录**：`mah.state.selectedIndex = compNode.C_IsAnGan.selectedIndex == 1 && i < 3 ? 1 : 3;`

#### `AT-ST-C15-038` 胡牌者手牌按胡牌组合分组

- **规则说明**：胡牌者其余手牌按胡牌组合分组。
- **触发条件**：解析亮牌时优先用 hu_items，胡项带 combs 时按 Comb 模式渲染。
- **配置影响**：本原子项无独立配置
- **客户端交互**：胡牌家手牌按顺子/刻子/对子等分组间距展示。
- **限制与禁止**：无
- **异常与边界**：含胡张的非吃碰杠组会被挪到最后一组。
- **验收**：胡牌者手牌按 combs 逐组渲染，胡张所在组移至末位。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:249；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:175
- **服务端职责**：下发 MsgResultHu（hu_items.combs 提供胡牌组合）
- **客户端职责**：解析亮牌时优先用 hu_items，若胡项带 combs 则按 Comb 模式逐组渲染，并把含胡张的非吃碰杠组挪到最后一组。
- **协作边界**：组合结构来自服务端 combs 字段，组排序（胡张组置末）为客户端本地调整。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:249
- **原文摘录**：`if (isHu && huCombs.length > 0) {`

#### `AT-ST-C15-039` 未胡牌者连续摆放

- **规则说明**：未胡牌者连续摆放。
- **触发条件**：未胡座位走 Hand 模式。
- **配置影响**：本原子项无独立配置
- **客户端交互**：未胡家手牌一张接一张连续排开。
- **限制与禁止**：无
- **异常与边界**：未胡家若带副露仍会先渲染副露组，其余手牌连续摆放。
- **验收**：未胡座位取 player_hands 的手牌写入 KW_Mah_List 连续列表，不按胡项分组。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:273；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:276；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:677
- **服务端职责**：下发 MsgResultHu（player_hands 提供未胡家手牌）
- **客户端职责**：未胡座位走 Hand 模式，取 player_hands 的手牌写入 KW_Mah_List 连续列表，不下发胡项分组。
- **协作边界**：手牌数据来自 MsgResultHu，连续摆放（不分组）为客户端本地渲染模式。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:273
- **原文摘录**：`return {`

#### `AT-ST-C15-040` 胡入那张标绿色「胡」

- **规则说明**：胡入的那一张在所属组合内标绿色「胡」。
- **触发条件**：在所属组合内定位胡张下标。
- **配置影响**：本原子项无独立配置
- **客户端交互**：胡张牌角上出现绿色「胡」图标。
- **限制与禁止**：无
- **异常与边界**：同值多张时取最后一张；绿色由 ico_hu.png 美术资源决定。
- **验收**：胡张下标处牌节点打开 C_Hu 页显示「胡」角标（mah.C_Hu.selectedIndex=1）。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:588；source-code/client/Fgui/assets/box_hzmj_result/component/mahHandSelf.xml:30；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:573
- **服务端职责**：下发 MsgResultHu（dan_fang 提供胡张）
- **客户端职责**：在所属组合内定位胡张下标，打开该牌节点的 C_Hu 页显示「胡」角标；同值多张时取最后一张。
- **协作边界**：胡张值来自服务端 dan_fang，组内定位与角标展示为客户端本地实现。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:588
- **原文摘录**：`mah.C_Hu.selectedIndex = i === huIdx ? 1 : 0;`

## `FP-ST-C15-008` 结算净得分展示

- **主描述**：小结算行右侧展示本局净得分，正分带加号、0 显示 0、负分带减号，并用不同字效区分。
- **范围与边界**：行内 KW_Score 数值与字效，不含版式其他元素。
- **总体协作**：BoxHzmjResultMid 按 win_losts 取该座 score，用 dealBigNumEx 缩写后写入 KW_Score 并切换 win/lose 字体。

### 原子项

#### `AT-ST-C15-041` 右侧为本局净得分

- **规则说明**：右侧为本局净得分。
- **触发条件**：逐行渲染时按服务端座位在 win_losts 中取本局分数。
- **配置影响**：本原子项无独立配置
- **客户端交互**：每行最右侧显示本局净得分数字。
- **限制与禁止**：无
- **异常与边界**：无
- **验收**：分数经大数缩写（dealBigNumEx）后写入行右侧 KW_Score 文本。
- **职责域**：client
- **职责依据**：source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:75；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:152
- **服务端职责**：下发 MsgResultHu（win_losts 提供各座本局净得分）
- **客户端职责**：按服务端座位在 win_losts 中取本局分数，经大数缩写后写入行右侧 KW_Score 文本。
- **协作边界**：分数值完全来自服务端 win_losts，客户端只做座位匹配与缩写展示。
- **来源文件**：`source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml`
- **来源定位**：source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:75
- **原文摘录**：`<text id="n23_w9ms" name="KW_Score" xy="993,28" size="126,58"`

#### `AT-ST-C15-042` 正分带加号

- **规则说明**：正分带加号。
- **触发条件**：本局分数大于 0。
- **配置影响**：本原子项无独立配置
- **客户端交互**：正分显示为 +N。
- **限制与禁止**：无
- **异常与边界**：无
- **验收**：score>0 时 KW_Score 文本前拼接「+」。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:365
- **服务端职责**：下发 MsgResultHu（win_losts 提供正分）
- **客户端职责**：分数大于 0 时在文本前拼接「+」。
- **协作边界**：正负判断与加号拼接为客户端本地实现。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:365
- **原文摘录**：`obj.KW_Score.text = score > 0 ? "+" + scoreStr : scoreStr;`

#### `AT-ST-C15-043` 0 分显示「0」

- **规则说明**：0 分显示「0」。
- **触发条件**：本局分数为 0。
- **配置影响**：本原子项无独立配置
- **客户端交互**：0 分行显示 0。
- **限制与禁止**：无
- **异常与边界**：无
- **验收**：score=0 时不加任何符号，直接写入缩写后的数值字符串（显示「0」）。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:364；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:365
- **服务端职责**：下发 MsgResultHu（win_losts 提供 0 分）
- **客户端职责**：分数为 0 时不加任何符号，直接写入缩写后的数值字符串。
- **协作边界**：0 分判断与展示为客户端本地实现。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:364
- **原文摘录**：`const scoreStr = StringUtils.dealBigNumEx(score, bigNumLine, 2);`

#### `AT-ST-C15-044` 负分带减号

- **规则说明**：负分带减号。
- **触发条件**：本局分数小于 0。
- **配置影响**：本原子项无独立配置
- **客户端交互**：负分显示为 -N，使用失败字效。
- **限制与禁止**：无
- **异常与边界**：dealBigNumEx（kiwi 库）实现不在仓库内，减号来自数值格式化；lose 字集目录中存在「-」字模。
- **验收**：score<0 时 KW_Score 切换到 lose 位图字体（ui://包/win、lose 二选一），显示带减号的 -N。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:366
- **服务端职责**：下发 MsgResultHu（win_losts 提供负分）
- **客户端职责**：负分直接把带负号的数字交给大数缩写函数，并切换到 lose 位图字体，减号由字体图集提供。
- **协作边界**：正负判断与字体切换为客户端本地实现；缩写格式化依赖 kiwi 库。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:366
- **原文摘录**：``obj.KW_Score.font = `ui://${PackageBoxHzmjView.PackageBoxHzmjResult}/${score >= 0 ? "win" : "lose"}`;``

#### `AT-ST-C15-045` 赢家牌组上方写番型名称

- **规则说明**：赢家牌组上方写实际命中的番型名称。
- **触发条件**：赢家行渲染番型文案时，无流水则用 hu_items.fan_ids 生成。
- **配置影响**：本原子项无独立配置
- **客户端交互**：赢家手牌组正上方显示一行番型文案，可点击展开完整流水。
- **限制与禁止**：无
- **异常与边界**：无
- **验收**：按座位过滤流水文案，无流水时用 hu_items.fan_ids 经 FormatGameHuFan 生成番型文案写入 KW_Flow，并打开 C_LiuShui 页。
- **职责域**：client
- **职责依据**：source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:72；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:759
- **服务端职责**：下发 MsgResultHu（hu_items.fan_ids/fan_point 提供番型数据）
- **客户端职责**：按座位过滤流水文案，无流水时用 hu_items.fan_ids 生成番型文案，写入牌组上方的 KW_Flow，并打开 C_LiuShui 页。
- **协作边界**：番型命中集合来自服务端 fan_ids，文案拼装为客户端本地实现。
- **来源文件**：`source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml`
- **来源定位**：source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:72
- **原文摘录**：`<text id="n47_l0c8" name="KW_Flow" xy="180,2" size="1033,36" fontSize="26" color="#edeb7a"`

## `FP-ST-C15-009` 番型名称与胡牌方式

- **主描述**：番型名称按命中组合拼接，特定番型直接写全名；行最右标记胡牌方式，赔付者标点炮。
- **范围与边界**：行内番型文案与胡牌方式角标，不含承包标记。
- **总体协作**：FanDefine 提供番型名称与组合文案；BoxHzmjResultMid 控制 C_HuType 页展示胡牌/点炮身份。

### 原子项

#### `AT-ST-C15-046` 同时命中多组都写上

- **规则说明**：同时命中多组时都写上，例如「七对」「杠飘」。
- **触发条件**：fan_ids 命中多组番型。
- **配置影响**：本原子项无独立配置
- **客户端交互**：KW_Flow 一行内展示全部命中番型。
- **限制与禁止**：无
- **异常与边界**：组合番不是并列两个独立项，而是「杠飘（二连杠，双财飘）」形式；与模板示例「七对」「杠飘」并列写法不完全一致。
- **验收**：番型文案按命中分组拼装：单番直接取名称，组合番用「组合名（非 1 侧明细）」形式，多片段以「，」连接。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:766；source-code/client/Code/config/FanDefine.ts:467
- **服务端职责**：下发 MsgResultHu（fan_ids 提供全部命中番型）
- **客户端职责**：番型文案按命中分组拼装：单番直接取名称，组合番用「组合名（非 1 侧明细）」形式，多片段以「，」连接。
- **协作边界**：命中集合来自服务端 fan_ids，分组与文案形式为客户端本地实现。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:766
- **原文摘录**：`let text = flowItems.map((item) => item.title).join("，");`

#### `AT-ST-C15-047` 特定番型直接写全名

- **规则说明**：双财飘、双豪华七对、二连杠直接写全名。
- **触发条件**：命中的番型在番型名称表内有全名条目。
- **配置影响**：本原子项无独立配置
- **客户端交互**：对应番型在牌组上方显示完整名称，不缩写档位。
- **限制与禁止**：无
- **异常与边界**：组合番（杠飘/七客）仍会带括号明细，全名是否单独出现取决于命中的 fan_ids 组合。
- **验收**：番型名称表内置「双财飘」「双豪华七对」「二连杠」等全名，组合展开时直接取该名称。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:77；source-code/client/Code/config/FanDefine.ts:85；source-code/client/Code/config/FanDefine.ts:80
- **服务端职责**：下发 MsgResultHu（fan_ids 命中特定番型）
- **客户端职责**：番型名称表内置「双财飘」「双豪华七对」「二连杠」等全名，组合展开时直接取该名称。
- **协作边界**：全名映射为客户端 FanDefine 静态表，命中与否来自服务端 fan_ids。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:77
- **原文摘录**：`[HzmjFanType.K_FTG_HZMJ_SHUANG_CAI_PIAO]: "双财飘",`

#### `AT-ST-C15-048` 最右侧标胡牌方式

- **规则说明**：最右侧标胡牌方式：自摸、点炮胡或抢杠胡。
- **触发条件**：胡牌家行渲染时按 hu_type 判断。
- **配置影响**：本原子项无独立配置
- **客户端交互**：行最右侧显示自摸/吃胡角标。
- **限制与禁止**：无
- **异常与边界**：C_HuType 只有点炮/吃胡/自摸三页，抢杠胡被并入点炮页，没有独立「抢杠胡」文案。
- **验收**：hu_type 为自摸时 C_HuType=3，其余=2，胡牌方式角标放在行最右的竖向组（KW_LabelHu）里。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:731；source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:94
- **服务端职责**：下发 MsgResultHu（hu_type 提供胡牌方式）
- **客户端职责**：胡牌家按 hu_type 是否为自摸切 C_HuType 页（自摸=3，其余=2），胡牌方式角标放在行最右的竖向组里。
- **协作边界**：胡牌方式来自服务端 hu_type，客户端仅区分自摸/非自摸两档表现。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:731
- **原文摘录**：`obj.C_HuType.selectedIndex = huItem?.hu_type == HuType.HT_SELF ? 3 : 2;`

#### `AT-ST-C15-049` 点炮胡与抢杠胡赔付者标「点炮」

- **规则说明**：点炮胡、抢杠胡的赔付者标「点炮」。
- **触发条件**：非自摸胡项中 df_from 等于当前行座位。
- **配置影响**：本原子项无独立配置
- **客户端交互**：放铳者行右侧显示点炮角标。
- **限制与禁止**：无
- **异常与边界**：无
- **验收**：非自摸胡项的 df_from 匹配当前行座位时，该行 C_HuType 置为点炮页（selectedIndex=1）。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:734；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:736
- **服务端职责**：下发 MsgResultHu（hu_type 与 df_from 提供赔付者座位）
- **客户端职责**：非自摸的胡项中，若 df_from 等于当前行座位，则把该行 C_HuType 置为点炮页。
- **协作边界**：赔付者座位来自服务端 df_from，客户端做座位匹配。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:734
- **原文摘录**：`const dianPao = data.hu_items?.find((item) => item.hu_type !== HuType.HT_SELF && Number(item.df_from ?? -1) === serverSeat);`

## `FP-ST-C15-010` 承包与反承包标记

- **主描述**：按 bao_settles 关系在赢家与赔付者行展示承包/反承包与三摊承包标记，链式承包同时出现两种标记且番型只写一次。
- **范围与边界**：小结算行角标与赢家流水文案，不含结算金额计算。
- **总体协作**：BoxHzmjResultMid 用 relation 决定 C_ChengBao 页；BoxHzmjFlowUtil 把「承包/反承包」写进赢家流水；匹配场额外在桌面 KW_RESULT 显示「三摊承包」。

### 原子项

#### `AT-ST-C15-050` 三摊承包：赢家标「承包」，赔付者得分右侧标「三摊承包」

- **规则说明**：三摊承包：赢家标黄色「承包」，赔付者得分右侧标「三摊承包」。
- **触发条件**：bao_settles 关系成立（relation=1），按 from_seat 定位承包方行。
- **配置影响**：本原子项无独立配置
- **客户端交互**：赔付者行得分右侧出现承包角标；该行桌面 KW_RESULT 显示「三摊承包」（匹配场）。
- **限制与禁止**：无
- **异常与边界**：与模板差异：角标挂在承包方（赔付者）而非赢家，图标文案是「承包」；「三摊承包」文案只在匹配场桌面出现，好友房小结算行内没有该文案。
- **验收**：好友房小结算在承包方（from_seat）行挂 C_ChengBao=1 角标（位于得分右侧）；匹配场桌面按座位显示「三摊承包」。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:212；source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:90；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1750
- **服务端职责**：下发 MsgResultHu（bao_settles 提供承包关系与座位）
- **客户端职责**：好友房小结算只在承包方（from_seat）行挂 C_ChengBao=1 角标（图标文案「承包」，位于得分右侧），赢家行不挂承包角标；匹配场额外在桌面按座位显示「三摊承包」文字。
- **协作边界**：承包关系与座位来自服务端 bao_settles，客户端按 relation/from_seat 分发标记；「黄色」视觉依赖角标图片资源。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:212
- **原文摘录**：`if (Number(bao.from_seat ?? -1) === serverSeat) {`

#### `AT-ST-C15-051` 反承包：赢家与赔付者都标「反承包」

- **规则说明**：反承包：赢家标「反承包」，赔付者标「反承包」。
- **触发条件**：bao_settles 中 relation=2。
- **配置影响**：本原子项无独立配置
- **客户端交互**：承包方行得分右侧显示反承包角标，赢家牌组上方流水出现「反承包」。
- **限制与禁止**：无
- **异常与边界**：两端都标的规则只实现为「赔付者角标 + 赢家流水文案」，赢家行无角标。
- **验收**：relation=2 时给 from_seat（承包方）行挂 C_ChengBao=2 角标，赢家流水追加「反承包」文案。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:209；source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:17；source-code/client/Code/util/BoxHzmjFlowUtil.ts:445
- **服务端职责**：下发 MsgResultHu（bao_settles 提供 relation=2 的反承包关系）
- **客户端职责**：relation=2 时给 from_seat（承包方）行挂 C_ChengBao=2 角标，赢家流水追加「反承包」文案；赢家行本身不挂角标。
- **协作边界**：反承包关系来自服务端 bao_settles，客户端按 relation 选角标页并拼流水文案。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:209
- **原文摘录**：`if (rel !== 1 && rel !== 2) {`

#### `AT-ST-C15-052` 链式承包双标且番型只写一次

- **规则说明**：链式承包：赢家同时标「承包」和「反承包」，番型只写一次。
- **触发条件**：赢家流水拼装时先写番型，再按 bao_settles 逐条追加承包项。
- **配置影响**：本原子项无独立配置
- **客户端交互**：赢家牌组上方一行流水同时出现番型与「承包」「反承包」。
- **限制与禁止**：番型只写一次（先写番型再追加承包项）。
- **异常与边界**：双标实现为流水文案拼接，不是两个角标；番型确实只写一次；赢家行不挂两种角标。
- **验收**：赢家流水先写一次番型文案（FormatGameHuFan），再按 bao_settles 逐条追加「承包」「反承包」项，最终以「，」连接为一行。
- **职责域**：client
- **职责依据**：source-code/client/Code/util/BoxHzmjFlowUtil.ts:377；source-code/client/Code/util/BoxHzmjFlowUtil.ts:444；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:766
- **服务端职责**：下发 MsgResultHu（fan_ids 与 bao_settles 提供番型与链式承包关系）
- **客户端职责**：赢家流水先写一次番型文案，再按 bao_settles 逐条追加「承包」「反承包」项，最终以「，」连接为一行；赢家行不挂两种角标。
- **协作边界**：番型与承包关系均来自服务端，客户端只做文案拼接顺序（番型一次在前）。
- **来源文件**：`source-code/client/Code/util/BoxHzmjFlowUtil.ts`
- **来源定位**：source-code/client/Code/util/BoxHzmjFlowUtil.ts:377
- **原文摘录**：`const fanText = FormatGameHuFan(RoomData.getCurGameId() ?? 0, hu.fan_ids, hu.fan_point);`

#### `AT-ST-C15-053` 链式承包赔付方分别标三摊承包与反承包

- **规则说明**：链式承包：付 S 的一方标「三摊承包」，付 2 × S 的一方标「反承包」。
- **触发条件**：按 bao_settles.relation 区分文案（1 走「三摊承包」，2 走「反承包」）。
- **配置影响**：本原子项无独立配置
- **客户端交互**：匹配场桌面按座位显示三摊承包或反承包，好友房结算行使用承包/反承包角标。
- **限制与禁止**：无
- **异常与边界**：S 与 2×S 的区分由 relation 间接体现，客户端未按金额倍数做二次校验；两个文案不出现在同一套界面（桌面文字 vs 行角标）；金额仅用于汇总各座承包分。
- **验收**：relation=1 的座位显示「三摊承包」、relation=2 的座位显示「反承包」；各座承包分按 bao_settles 汇总（sumBaoScoreBySeat）。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:1750；source-code/client/Code/util/BoxHzmjFlowUtil.ts:456
- **服务端职责**：下发 MsgResultHu（bao_settles 的 relation 与金额区分 S 与 2×S）
- **客户端职责**：客户端按 bao_settles.relation 区分文案（1 走「三摊承包」，2 走「反承包」），不区分 S 与 2×S 的倍数关系；金额仅用于汇总各座承包分。
- **协作边界**：倍数区分由服务端 relation 间接体现，客户端不按金额倍数校验。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjTipAniView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:1750
- **原文摘录**：`this._applyMatchResultLines(localSeat, rel === 2 ? "反承包" : "三摊承包", "");`

## `FP-ST-C15-011` 财神展示与长按查看牌桌

- **主描述**：小结算左下展示本局财神正面，右下提供长按查看牌桌入口，按本家视角临时收起小结算并高亮财神。
- **范围与边界**：小结算左下财神区与右下滑动/长按交互。
- **总体协作**：BoxHzmjResultView 负责长按事件的派发/恢复，BoxHzmjResultLeft 渲染财神，BoxHzmjMah2DView 负责终局牌桌的财神高亮。

### 原子项

#### `AT-ST-C15-054` 左下展示本局财神正面

- **规则说明**：左下展示本局财神正面，即白板。
- **触发条件**：小结算左下角组件渲染，取 GameData.jokerMah。
- **配置影响**：本原子项无独立配置
- **客户端交互**：左下显示财神牌图与财神牌位，财神数字为红色。
- **限制与禁止**：无
- **异常与边界**：无财神时整块隐藏；代码按 jokerMah 渲染（当前配置为白板），未硬编码牌值。
- **验收**：左下角以正面状态（CardState.Up）渲染财神并施加红色财神色（MahColor_Box.red）。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultLeft.ts:37；source-code/client/Code/layer/comp/BoxHzmjResultLeft.ts:39；source-code/client/Fgui/assets/box_hzmj_result/BoxHzmjResultLeft.xml:4
- **服务端职责**：下发 MsgResultHu（结算沿用本局财神数据）
- **客户端职责**：小结算左下角组件取 GameData.jokerMah，以正面状态渲染该牌并施加红色财神色；无财神时整块隐藏。
- **协作边界**：财神牌值取本地 jokerMah 数据（白板由配置保证），渲染为客户端本地实现。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultLeft.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultLeft.ts:37
- **原文摘录**：`Mah2DBase_Box.setCard(mahNode, mah, CardState.Up);`

#### `AT-ST-C15-055` 长按查看牌桌

- **规则说明**：右下为「长按查看牌桌」：在底部栏扣除中央主按钮后的区域按住 500 毫秒，临时收起小结算，按本家视角查看终局牌桌；松手恢复同一张小结算。
- **触发条件**：玩家在底部栏扣除中央主按钮后的区域按住达到长按判定时长。
- **配置影响**：本原子项无独立配置
- **客户端交互**：按住期间小结算收起、终局牌桌可见且财神高亮；松手恢复原小结算。
- **限制与禁止**：松手须恢复同一张小结算（保留同一份结算数据）。
- **异常与边界**：500 毫秒长按判定、底部栏扣除中央按钮的区域计算、小结算收起/恢复均在公共壳 BoxRoomMahResultNewView（common_game 未包含），本仓库只见回调与事件。
- **验收**：按压回调触发 onResultShowTable（显示时高亮桌上财神 showSpecialMah），松手恢复时清除高亮并保留同一份结算数据。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjResultView.ts:99；source-code/client/Code/layer/BoxHzmjMah2DView.ts:1155；source-code/client/Code/config/FguiViewDefine.ts:358
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：游戏侧在公共壳的按压回调里派发 onResultShowTable / onResultHideTable：显示时高亮桌上财神，恢复时清除高亮并保留同一份结算数据。
- **协作边界**：长按判定与面板收起/恢复在公共壳内，游戏侧仅响应回调派发本地事件与财神高亮。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjResultView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjResultView.ts:99
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.onResultShowTable);`

## `FP-ST-C15-012` 继续游戏与返回大厅

- **主描述**：非末局底部中央为继续游戏，点击后清理上一局牌面并置本家为已准备，四人准备自动开下一局；第 8 局按钮为返回大厅退出房间。
- **范围与边界**：小结算底部按钮行为与下一局衔接，不含小结算内容渲染。
- **总体协作**：公共壳渲染底部按钮，游戏侧通过 onResetUI 清牌、通过准备回包刷新「已准备」标记，开局由服务端裁决。

### 原子项

#### `AT-ST-C15-056` 非末局底部中央为【继续游戏】

- **规则说明**：非末局底部中央为【继续游戏】。
- **触发条件**：非最后一局的小结算底部按钮渲染（公共壳）。
- **配置影响**：本原子项无独立配置
- **客户端交互**：底部中央按钮由公共壳渲染并显示继续游戏文案。
- **限制与禁止**：无
- **异常与边界**：配置中保留了「小结算继续游戏（KW_BTN_GOON，非最后一局）」事件定义，但 BoxHzmjResultView 的 onContinueResult 实现被整体注释，游戏侧没有继续游戏的点击处理；按钮创建、文案与点击回调在公共壳内；游戏侧 onResultContinue 派发已被注释，事件定义实际无监听者。
- **验收**：非末局小结算底部中央显示继续游戏按钮（公共壳 KW_BTN_GOON 相关）；游戏侧点击处理未启用（onContinueResult 被注释）。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FguiViewDefine.ts:364；source-code/client/Code/layer/BoxHzmjResultView.ts:119
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：配置中保留了「小结算继续游戏（KW_BTN_GOON，非最后一局）」事件定义，但 BoxHzmjResultView 的 onContinueResult 实现被整体注释，游戏侧没有继续游戏的点击处理。
- **协作边界**：按钮渲染与点击回调在公共壳（common_game 未包含），本仓库只见事件定义与被注释的处理函数。
- **来源文件**：`source-code/client/Code/config/FguiViewDefine.ts`
- **来源定位**：source-code/client/Code/config/FguiViewDefine.ts:364
- **原文摘录**：`/** 小结算继续游戏（KW_BTN_GOON，非最后一局） */`

#### `AT-ST-C15-057` 点击后收起小结算并清理上局牌面

- **规则说明**：点击后本端收起小结算，清除上一局手牌、碰杠区和牌河，保留座位和累计积分，本家显示「已准备」。
- **触发条件**：本端准备成功（准备回包 playerReadyBack 驱动）。
- **配置影响**：本原子项无独立配置
- **客户端交互**：小结算关闭后牌桌清空，本家头像出现「已准备」标记，积分保留。
- **限制与禁止**：清理时不清除座位与累计积分（onResetUI 不清 TableData 座位与 sr）。
- **异常与边界**：清理与「已准备」是由准备回包驱动，不是由【继续游戏】点击直接触发。
- **验收**：onResetUI 清空四方位手牌/河牌/胡牌/副露并隐藏侧栏财神与余牌数（_clearAllCards）；本家头像 C_Ready 置 kReady；座位与累计积分保留。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/gameController.ts:180；source-code/client/Code/controller/gameController.ts:181；source-code/client/Code/layer/BoxHzmjPlayerView.ts:563；source-code/client/Code/layer/BoxHzmjMah2DView.ts:528
- **服务端职责**：下发 MsgEndWait（准备回包驱动清理与已准备标记）
- **客户端职责**：准备成功后派发 onResetUI 清空四方位手牌/河牌/胡牌/副露并隐藏侧栏财神与余牌数，同时给本家头像显示准备标记；座位与累计积分不清。
- **协作边界**：清牌与已准备标记由准备回包触发，小结算收起由公共壳处理，两者时序关联由准备流程衔接。
- **来源文件**：`source-code/client/Code/controller/gameController.ts`
- **来源定位**：source-code/client/Code/controller/gameController.ts:180
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.onResetUI, false);`

#### `AT-ST-C15-058` 四人均准备后自动开下一小局

- **规则说明**：四人均准备后自动开下一小局。
- **触发条件**：本端上报自身准备；服务端判定四人齐备后下发开局消息。
- **配置影响**：本原子项无独立配置
- **客户端交互**：四人准备后自动进入下一小局，界面按开局消息重置。
- **限制与禁止**：无
- **异常与边界**：人数齐备判定与开局时机不在客户端代码内，由服务端完成。
- **验收**：本端准备上报后收到 MsgStartGame 时重置界面与玩家状态（resetUI）。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/gameController.ts:181；source-code/client/Code/layer/BoxHzmjPlayerView.ts:222；source-code/client/Code/protocol/GameGlcProtocol.ts:106
- **服务端职责**：下发 MsgStartGame（四人齐备后开局）
- **客户端职责**：客户端只上报自身准备并在收到开局消息时重置界面与玩家状态；四人齐备后的开局判定由服务端完成。
- **协作边界**：齐备判定与开局时机在服务端，客户端仅上报准备并按 MsgStartGame 重置界面。
- **来源文件**：`source-code/client/Code/controller/gameController.ts`
- **来源定位**：source-code/client/Code/controller/gameController.ts:181
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.onShowActionSign, SELF_LOCAL_SEAT, BoxLobbyProtocol.PlayerInfoNotify.actionState.kReady);`

#### `AT-ST-C15-059` 第 8 局按钮为【返回大厅】

- **规则说明**：第 8 局按钮为【返回大厅】，点击后退出房间。
- **触发条件**：末局（总结算事件到达）。
- **配置影响**：本原子项无独立配置
- **客户端交互**：末局时底部中央按钮切换为离场类按钮（基类注释称为「查看总结算」）。
- **限制与禁止**：无
- **异常与边界**：公共壳收到总结算事件后按 C_IsLastRound 切换末局按钮，但仓库内未找到「返回大厅」文案或退出房间的游戏侧实现；基类注释为「查看总结算」，与模板「返回大厅并退出房间」不一致；退出房间行为不在本仓库快照内。
- **验收**：末局小结算底部中央按钮切换（onTotalResult 转发基类切 C_IsLastRound）；「返回大厅」文案与退出房间行为需在公共壳确认。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjResultView.ts:147；source-code/client/Code/layer/BoxHzmjResultView.ts:149
- **服务端职责**：下发 MsgResultHu（末局总结算事件驱动按钮切换）
- **客户端职责**：公共壳收到总结算事件后按 C_IsLastRound 切换末局按钮，但仓库内未找到「返回大厅」文案或退出房间的游戏侧实现。
- **协作边界**：末局按钮切换由客户端转发总结算事件给公共壳，按钮文案与退出房间行为在公共壳（common_game 未包含）内。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjResultView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjResultView.ts:147
- **原文摘录**：`/** 总结算到达（转发基类，切 C_IsLastRound 换「查看总结算」按钮） */`
