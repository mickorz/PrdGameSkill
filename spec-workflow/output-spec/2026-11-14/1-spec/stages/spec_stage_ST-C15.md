# 结算

> 阶段 ID：`ST-C15`。来源：模板「结算」章节。客户端视角规格，客户端逻辑与 UI 交互以 Code/Fgui 代码证据支撑。

## 0. 阶段

- **阶段 ID**：`ST-C15`
- **阶段**：结算
- **来源章节**：结算
- **涉及协议消息**：MsgResultHu、MsgEndGame、MsgDrawn、MsgPlayerScore、MsgJuData
- **涉及 UI 模块**：box_hzmj_tipAni、box_hzmj_result、BoxHzmjMainView、BoxHzmjMah2DView、BoxHzmjTipAniView、BoxHzmjPlayerView、BoxHzmjResultView、BoxHzmjResultMid
- **阶段概述**：胡牌或黄庄后收起本局操作与演出，亮出终局牌桌并播放番型/点炮字效，刷新头像累计积分与飘分，最后以小结算面板逐行展示四家牌型、得分、番型与承包标注，并提供长按查桌与继续/返回大厅入口。

## 术语与单位

| 术语 | 定义 | 单位/量纲 | 作用域 | 来源 |
| --- | --- | --- | --- | --- |
| 财神 | 白板固定为财神，只在胡牌判定时代替面子或对子所缺的牌，吃碰杠不可用财神。 | 无 | 全局 | 模板名词章节（第 12 行） |
| 牢庄 | 本期固定笃三老庄，每小局庄家都按三牢、8 倍计算。 | 倍 | 每小局结算 | 模板名词章节（第 13 行） |
| 摊 | A 吃进 B 打出的牌，A 对 B 记 1 摊，两个方向分开计，每小局重新累计。 | 次 | 每小局累计 | 模板名词章节（第 14 行） |
| 承包 | 庄家与闲家之间某一方向有效摊达到成立条件后，承包方在自摸结算时代赔。 | 无 | 自摸结算 | 模板名词章节（第 15 行） |
| 反承包 | 同一承包关系下，原被承包方自摸时，原承包方按加倍规则赔付。 | 无 | 自摸结算 | 模板名词章节（第 15 行） |
| 放铳 | 打出的牌被他人合法胡走，胡牌者称为点炮胡；白板财神弃牌不能点炮胡。 | 无 | 全局 | 模板名词章节（第 19 行） |
| 流局 | 牌墙剩 21 张时再摸 1 张剩 20 张，先完成本次摸打与弃牌响应，无人胡牌时在下一次应摸牌前判黄庄。 | 张（牌墙余牌数） | 小局结束判定 | 模板名词章节（第 20 行） |

## 跨切面行为

- **小结算面板公共壳边界**：小结算面板本体（标题文案与胜负主题、底部主按钮、C_IsLastRound 切换、长按查桌的 500 毫秒与收起/恢复）由公共壳基类承载，本工程只提供中间区与左下财神插件，公共壳代码不在可查范围内 —— 跨切面（无单独代码定位，公共壳代码不在本工程可查范围）
- **结算数据单路径**：MsgResultHu 落在 GameData，再由 ResultCmd 组装流水文案与结算视图入参，桌面飘分与面板消费同一份数据 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:229；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:309；source-code/client/Code/util/BoxHzmjFlowUtil.ts:25）
- **结算视图与桌面视图事件联动**：结算视图与桌面视图通过事件总线联动：onResultShowTable / onResultHideTable / onResultClose / onCloseOperate / onHidePutCardUi —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:241；onResultShowTable 等查桌事件见后续分片）
- **萧山与金币场分支**：同一结算流程存在萧山与金币场分支（IsXsmjGame、isMatchRoom），会改变番型文案、加倍角标与流水分行 —— 跨切面（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:759；分支标志 IsXsmjGame/isMatchRoom 未见直接定位）
- **累计积分双路径写入**：累计积分同时由 MsgResultHu.player_score 与 MsgPlayerScore 写入，刷新事件在两条路径都会触发 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:229；source-code/client/Code/controller/cmd/gameCmd/GamePlayerScoreCmd.ts:42）

（以下按 JSON 中 features 顺序，每个功能点一节）

## `FP-ST-C15-001` 结算触发与胡张认定

- **主描述**：胡牌确认后本小局只结算一次，并按自摸、点炮、抢杠三种胡法确定各自的胡张。
- **范围与边界**：只覆盖客户端消费结算消息与胡张展示；结算唯一性、停止行牌由服务端保证。
- **总体协作**：服务端在胡牌确认后下发结算消息，客户端据此进入结算演出流程。

### 原子项

#### `AT-ST-C15-001` 每小局只结算一次并停止行牌

- **规则说明**：胡牌确认后停止行牌，每小局只结算一次。
- **触发条件**：有人胡牌并确认胡牌，本小局结算结果已产生，服务端下发结算消息。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：结算消息到达后进入固定结算演出序列，不再回到出牌流程。
- **限制与禁止**：无。
- **异常与边界**：客户端未见「本小局已结算过则忽略重复结算消息」的幂等判断，结算唯一性只能由服务端保证。
- **验收**：结算消息到达后客户端一次性落库并启动摊牌、番型、飘分与小结算流程，本小局不再回到出牌与响应流程。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:44；source-code/client/Code/protocol/GameGlcProtocol.ts:142；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:303
- **服务端职责**：下发 MsgResultHu（胡牌/流局完整结算），保证胡牌确认后停止行牌与每小局只结算一次。
- **客户端职责**：注册结算命令处理 MsgResultHu（GP_HZMJ_RESULT_HU），一次性落库并启动摊牌、番型、飘分与小结算流程。
- **协作边界**：客户端消费 MsgResultHu 进入结算演出；结算唯一性与停止行牌的裁决在服务端，客户端不做幂等判断。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:44
- **原文摘录**：`@RegisterCmd(CmdNames.CMD_RESULT_HU)`

#### `AT-ST-C15-002` 胡张取值来源（自摸/点炮/抢杠）

- **规则说明**：自摸的胡张是本次摸入或补入的牌，点炮胡的胡张是弃牌，抢杠胡的胡张是被抢的第 4 张。
- **触发条件**：胡牌结算数据下发，玩家本局胡牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：胡牌者行内单放一张牌，并在所属组合内打「胡」角标。
- **限制与禁止**：无。
- **异常与边界**：dan_fang 未下发时客户端按 0 处理（huItem?.dan_fang ?? 0）；三种胡法各自取哪张牌由服务端决定，无法在本工程内验证。
- **验收**：结算行按 hu_items.dan_fang 取胡张并以单放牌节点展示（含财神配色 applyJokerMahColor），胡张在所属胡牌组合内打「胡」角标。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:255；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:434；source-code/client/Code/lib/proto_game_hzmj.d.ts:1576
- **服务端职责**：下发 MsgResultHu（含 hu_items.dan_fang 胡张），按自摸/点炮/抢杠三种胡法判定胡张取值。
- **客户端职责**：结算行按 hu_items 的 dan_fang 取胡张，胡牌行以单放牌节点展示该张并按胡牌组合归属打胡角标。
- **协作边界**：客户端只消费 dan_fang 做展示与角标；胡张取值规则的判定在服务端。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:255
- **原文摘录**：`danFang: huItem?.dan_fang ?? 0,`

## `FP-ST-C15-002` 终局牌桌收束与牌面保留

- **主描述**：胡牌或黄庄后收起本局操作类 UI、停止方位盘倒计时，在原牌桌亮出四家手牌并保留终局牌河、财神和余牌数，中央显示结束字样。
- **范围与边界**：覆盖牌桌表现收束与结束字样；不含小结算面板内容。
- **总体协作**：结算消息到达后先收束操作与演出，再做亮牌与中央提示，最后进入飘分和小结算。

### 原子项

#### `AT-ST-C15-003` 停止操作按钮、胡牌预览与放大弃牌

- **规则说明**：各端停止操作按钮、胡牌预览和放大弃牌。
- **触发条件**：本局胡牌结算开始，结算消息到达即执行，无额外条件。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：操作按钮区切回空状态，听牌面板关闭，出牌放大层整体隐藏。
- **限制与禁止**：结算开始后不再出现可点的操作按钮、听牌（胡牌预览）面板与放大弃牌。
- **异常与边界**：无。
- **验收**：胡牌动画阶段派发 onCloseOperate 与 onHidePutCardUi 后，操作按钮区切回空状态（C_BtnState 置 EMPTY）、听牌面板隐藏并清空听牌信息、放大弃牌（_bigOutCards）全部不可见。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:241；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:258；source-code/client/Code/layer/BoxHzmjMainView.ts:494；source-code/client/Code/layer/BoxHzmjMainView.ts:1059
- **服务端职责**：下发 MsgResultHu（结算到达即触发客户端收束操作类 UI）。
- **客户端职责**：胡牌动画阶段派发关闭操作与隐藏放大弃牌事件，并隐藏听牌（胡牌预览）面板、清空听牌信息。
- **协作边界**：客户端消费 MsgResultHu 后本地收束操作按钮、听牌面板与放大弃牌，无需服务端逐项指令。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:241
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.onCloseOperate);  this.dispatch(GameEventBoxHzmj.onHidePutCardUi);`

#### `AT-ST-C15-004` 方位盘停止倒计时

- **规则说明**：方位盘停止倒计时。
- **触发条件**：整场对局结束消息（MsgEndGame）到达时调用清空倒计时入口；小局胡牌结算流程未见显式停止方位盘计时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：倒计时数字清空、方位闪烁灯隐藏。
- **限制与禁止**：无。
- **异常与边界**：清空倒计时入口（setClockHide）只在整场结束（MsgEndGame）调用；胡牌结算流程只关闭操作按钮，未见显式停止方位盘计时，是否由服务端不再下发或上层遮罩实现无法从客户端确认。
- **验收**：整场结束时 KW_Clock_Num 文本置空、计时器停止（clockCountDownTime.stop()）、倒计时区域隐藏。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:718；source-code/client/Code/layer/BoxHzmjMah2DView.ts:388；source-code/client/Code/controller/cmd/gameCmd/GameEndCmd.ts:33
- **服务端职责**：下发 MsgEndGame（整场结束）触发整场收束；小局结算时是否另有停止计时的服务端行为未还原。
- **客户端职责**：方位盘倒计时由权限/动作消息驱动的计时器控制，提供清空倒计时与停止计时的入口；整场结束消息会调用该入口。
- **协作边界**：客户端在整场结束消息时本地清空并停止计时；小局结算时停止倒计时的实现未在客户端观察到。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMah2DView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:718
- **原文摘录**：`setClockHide(): void {  this._clockWantedVisible = false;  this.view.KW_DeskCent.KW_Clock_Num.text = "";  this._clockCountDownTime?.stop();`

#### `AT-ST-C15-005` 亮出四家手牌并显示对局结束

- **规则说明**：在原牌桌亮出四家手牌，桌面中央显示「对局结束」。
- **触发条件**：本局结算消息到达，有人胡牌且结束类型为胡牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：四家手牌全部翻开，桌面中央加载「对局结束」图。
- **限制与禁止**：无。
- **异常与边界**：「对局结束」为图片资源（C_GameEnd 控制器 hu 页对应图标），仓库内无该图源文件，文案内容无法逐字验证。
- **验收**：摊牌流程按座位把手牌置为正面（CardState_Box.Up）并重置手牌、拼接胡张、副露刷新到桌面；结束类型非空时提示层把 C_GameEnd 切到对应页显示中央结束字样。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:1045；source-code/client/Code/layer/BoxHzmjMah2DView.ts:1059；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1186；source-code/client/Fgui/assets/box_hzmj_tipAni/component/HzmjTipAniComponent.xml:69
- **服务端职责**：下发 MsgResultHu（含 end_type 结束类型）。
- **客户端职责**：摊牌流程按座位重置手牌为正面并拼接胡张，同时把副露刷新到桌面；结束类型非空时派发结束字样事件，由提示层切到对应页面。
- **协作边界**：客户端消费 end_type 切换中央字样页；字样图资源在外部图集，文案不可逐字验证。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMah2DView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:1045
- **原文摘录**：`@gf.listen(GameEventBoxHzmj.playHuEnd)  playHuEnd(): void {`

#### `AT-ST-C15-006` 黄庄亮牌与中央黄庄提示

- **规则说明**：黄庄：亮出四家手牌，桌面中央显示「黄庄」，保留终局牌河、财神和余牌数 20。
- **触发条件**：本局无人胡牌判黄庄，牌墙剩 20 张且本次摸打与弃牌响应完成。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：中央加载黄庄提示图，桌面仍显示牌河、财神与右侧余牌数。
- **限制与禁止**：无。
- **异常与边界**：余牌数 20 的具体数值由服务端牌墙数据驱动，客户端未硬编码；黄庄提示图内容同样无法逐字验证。
- **验收**：结束类型为流局时同样走摊牌流程并把 C_GameEnd 切到 drawn 页显示中央黄庄字样；财神与余牌数沿用当局数据刷新（onUpdateJokerSide / onUpdateMahCntSide），不在结算时清空。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:84；source-code/client/Fgui/assets/box_hzmj_tipAni/component/HzmjTipAniComponent.xml:3；source-code/client/Code/layer/BoxHzmjMah2DView.ts:378；source-code/client/Code/layer/BoxHzmjMah2DView.ts:365
- **服务端职责**：下发 MsgResultHu（end_type 流局）/MsgDrawn 判黄庄，并驱动终局余牌数。
- **客户端职责**：结束类型为流局时同样走摊牌流程，并把结束字样控制器切到 drawn 页；财神与余牌数沿用当局数据刷新，不在结算时清空。
- **协作边界**：客户端按 end_type 切黄庄页并沿用牌河/财神/余牌数显示；余牌数数值由服务端数据驱动。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:84
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.onShowGameEndType, data.end_type);`

## `FP-ST-C15-003` 番型字效与点炮方位标识

- **主描述**：结束字样显示期间在胡牌者方位播放番型字效，点炮胡与抢杠胡在放铳方位播放「点炮」。
- **范围与边界**：只覆盖桌面演出，不含小结算行内文案。
- **总体协作**：结算命令按座位派发番型演出，再按放铳者派发点炮演出，二者都在小结算打开前完成。

### 原子项

#### `AT-ST-C15-007` 胡牌者方位播放番型字效

- **规则说明**：「对局结束」仍在时，胡牌者方位播放番型字效。
- **触发条件**：本局胡牌结算演出开始，该座位本局胡牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：对应座位方位出现番型字效，播完自动隐藏。
- **限制与禁止**：无。
- **异常与边界**：结束字样只保持 1 秒（定时复位），字效时长较长，「仍在时」的重叠关系未精确验证。
- **验收**：结算按胡牌座位逐个派发番型演出（onMsgPlayHuNew 携带座位、胡牌类型与 fanId），提示层按座位取动画节点、按命中番型选择字效资源播放，播完回调推进飘分。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:282；source-code/client/Code/layer/BoxHzmjTipAniView.ts:964；source-code/client/Fgui/assets/box_hzmj_tipAni/component/HzmjTipAniComponent.xml:8
- **服务端职责**：下发 MsgResultHu（含胡牌座位与番型 fan_ids）。
- **客户端职责**：结算按胡牌座位逐个派发番型演出，提示层按座位取对应动画节点，按命中的番型选择字效资源并播放，播完回调推进飘分。
- **协作边界**：客户端按服务端番型数据选择字效资源并本地播放；字效与结束字样的重叠时序未验证。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:282
- **原文摘录**：`this.dispatch(  GameEventBoxHzmj.onMsgPlayHuNew,  localSeat,  huType,  fanId,`

#### `AT-ST-C15-008` 放铳方位显示「点炮」

- **规则说明**：点炮胡和抢杠胡同时在放铳方位显示「点炮」，抢杠胡的放铳者是加杠者。
- **触发条件**：点炮胡或抢杠胡结算，该胡牌不是自摸。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：放铳者方位出现「点炮」/一炮多响字效，播完隐藏。
- **限制与禁止**：无。
- **异常与边界**：抢杠胡的放铳者是否为加杠者取决于服务端下发的 df_from，客户端只按该座位播放；一炮多响使用另一套资源。
- **验收**：结算把胡牌的放铳来源座位（df_from 经 seatToLocal 换算）派发点炮动画（onMsgHuDianPaoAni 携带 huAniType 与 dfFrom），提示层在对应座位节点按 HuAniType（如 DIAN_PAO 用 dianpao 资源）播放。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:264；source-code/client/Code/layer/BoxHzmjTipAniView.ts:891；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:171
- **服务端职责**：下发 MsgResultHu（含 df_from 放铳来源座位，抢杠胡时为加杠者）。
- **客户端职责**：结算按胡牌的放铳来源座位派发点炮动画（一炮多响用另一套资源），提示层在对应座位节点播放点炮表现。
- **协作边界**：客户端按 df_from 本地化座位后播放点炮表现；放铳者身份（含抢杠胡是否为加杠者）由服务端字段裁决。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:264
- **原文摘录**：`if (huAniType !== HuAniType.NONE) {  this.dispatch(GameEventBoxHzmj.onMsgHuDianPaoAni, huAniType, context.dfFrom);`

## `FP-ST-C15-004` 累计积分刷新与飘分演出

- **主描述**：结算演出期间先刷新头像旁累计积分，番型字效退场后只给本局得分不为 0 的座位飘分，飘分淡出后短暂保留牌桌再打开小结算。
- **范围与边界**：覆盖头像积分刷新、飘分显示与打开小结算的先后关系；不含面板内容。
- **总体协作**：结算消息写入分数数据，番型演出结束后逐座位刷新头像并按非 0 分数飘分，随后延迟打开小结算。

### 原子项

#### `AT-ST-C15-009` 先刷新头像旁累计积分

- **规则说明**：先刷新头像旁的累计积分。
- **触发条件**：本局结算分数下发。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：各玩家头像旁累计积分刷新为新数值。
- **限制与禁止**：无。
- **异常与边界**：头像分数刷新有两条路径（结算消息写入 player.sr + 玩家分数消息广播），面板显示刷新还会在飘分开始时按座位再触发一次；实际先后依赖消息到达顺序。
- **验收**：结算消息里的玩家总分写入 player.sr 后派发 onUpdateScore，玩家视图用该值更新头像区分数；MsgPlayerScore 广播路径同样触发刷新。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:229；source-code/client/Code/layer/BoxHzmjPlayerView.ts:509；source-code/client/Code/layer/BoxHzmjTipAniView.ts:726；source-code/client/Code/controller/cmd/gameCmd/GamePlayerScoreCmd.ts:42
- **服务端职责**：下发 MsgResultHu（player_score 各家累计分）与 MsgPlayerScore（玩家分数广播）。
- **客户端职责**：结算消息里的玩家总分被写入各玩家的累计分字段，玩家视图收到分数刷新事件后用该值更新头像区分数。
- **协作边界**：客户端消费两条消息路径写入累计分并刷新头像显示；严格先于番型字效的时序无法在客户端确认。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:229
- **原文摘录**：`if (player !== undefined && player.sr !== undefined) {  player.sr = score;`

#### `AT-ST-C15-010` 非 0 得分座位飘分与正负样式

- **规则说明**：番型字效退场后，只在本局得分不为 0 的座位内侧飘分。正分金黄色，负分浅蓝灰色并带减号。
- **触发条件**：番型字效播放完成，该座位本局得分不为 0。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：座位内侧出现飘分数字，按正负切换字图，动画结束后淡出隐藏。
- **限制与禁止**：本局得分为 0 的座位不飘分（score === 0 直接跳过）。
- **异常与边界**：正负字图（fnt_win/fnt_lose）的实际颜色不在仓库内；减号来自服务端下发的负数本身。
- **验收**：桌面飘分数据只写入非 0 分数的座位；番型字效首个座位播完后按座位遍历飘分（onShowResultScore），飘分文本按分数正负切换 fnt_win/fnt_lose 字图，正分补加号。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:206；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:276；source-code/client/Code/layer/BoxHzmjTipAniView.ts:567；source-code/client/Fgui/assets/box_hzmj_tipAni/component/HzmjTipAniComponent.xml:56
- **服务端职责**：下发 MsgResultHu（含各座位本局得分，负数自带减号）。
- **客户端职责**：桌面飘分数据只写入非 0 分数的座位，番型字效首个座位播完后按座位遍历飘分；飘分文本按分数正负切换不同字图，正分补加号。
- **协作边界**：客户端本地按非 0 过滤与正负切图；金黄/浅蓝灰颜色定义在字图资源内，仓库无法读取。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:206
- **原文摘录**：`if (score === 0) continue;`

#### `AT-ST-C15-011` 飘分淡出后保留牌桌再开小结算

- **规则说明**：飘分淡出后短暂保留终局牌桌，再打开小结算。
- **触发条件**：本局结算消息到达，摊牌完成后进入固定延迟。
- **配置影响**：打开小结算为固定 3 秒延迟（delayTime = 3）。
- **客户端交互**：终局牌桌停留数秒后弹出小结算面板。
- **限制与禁止**：无。
- **异常与边界**：打开小结算用的是从结算消息起的固定延迟，不是以飘分淡出完成为条件；快节奏或长动画下停留时长会偏离需求。
- **验收**：结算消息处理后执行摊牌并以固定 3 秒延迟执行 CMD_GAME_RESULT 打开小结算，随后派发总结算事件；流水文案由 BuildHzmjFlowStrItems 从同一份结算数据组装。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:306；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:309；source-code/client/Code/util/BoxHzmjFlowUtil.ts:25
- **服务端职责**：下发 MsgResultHu 触发结算流程与延迟打开小结算。
- **客户端职责**：结算消息处理后执行摊牌，并以固定 3 秒延迟执行打开小结算的命令，随后再派发总结算事件。
- **协作边界**：客户端本地定时打开小结算；打开时机不以飘分淡出为条件。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:306
- **原文摘录**：`const delayTime = 3;  setTimeout(() => {`

## `FP-ST-C15-005` 小结算面板结构与行内容

- **主描述**：小结算盖在终局牌桌上，本家第一行向下依次为下家、对家、上家并高亮本家行，按本端净得分切换主题，逐行展示座位信息、牌区与本局净得分。
- **范围与边界**：覆盖面板行序、行高亮、主题切换、行内牌区与分数；标题文案、遮罩与面板本体样式由公共壳承载。
- **总体协作**：结算数据组装后交由中间区列表按玩家顺序渲染每一行，公共壳负责标题、主题背景与遮罩。

### 原子项

#### `AT-ST-C15-012` 面板覆盖终局牌桌与本家行置顶高亮

- **规则说明**：小结算盖在终局牌桌上。各端以本家为第一行，向下依次为下家、对家、上家。本家行置顶并高亮。
- **触发条件**：小结算面板打开。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：面板覆盖牌桌，第一行为本家并高亮，其后依次为下家、对家、上家。
- **限制与禁止**：无。
- **异常与边界**：行序依赖玩家列表本身按本地座位升序返回，该数据源不在本工程可查范围；遮罩由公共壳提供。
- **验收**：小结算视图在 Base 层打开；中间区按玩家列表渲染 KW_ListPlayers；座位方向文案把本地 0 号位判为本家、1 号为下家、末位为上家；本家行 C_IsSelf 切高亮页并显示金币图标。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjResultView.ts:29；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:110；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:965；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:368；source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:25
- **服务端职责**：下发 MsgResultHu（结算数据与玩家列表，行序依赖玩家列表按本地座位升序返回）。
- **客户端职责**：小结算视图在基础层以结算排序打开，中间区按玩家列表顺序逐行渲染；座位方向文案把本地 0 号位判为本家、1 号为下家、末位为上家；本家行切到高亮页并显示金币图标。
- **协作边界**：客户端按本地座位判方位与高亮；玩家列表排序的数据源在工程外，遮罩由公共壳承载。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjResultView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjResultView.ts:29
- **原文摘录**：`layer: gf.ViewLayer.Base,`

#### `AT-ST-C15-013` 按本端净得分切换胜负主题

- **规则说明**：胡牌局按本端本局净得分切换主题：大于或等于 0 为「恭喜获胜」，小于 0 为「遗憾失败」。黄庄四端都是「黄庄」。
- **触发条件**：小结算面板打开，按本端本局净得分为正或 0、为负、或本局黄庄分别处理。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：本家行主题按胜负切页，黄庄局走流局页。
- **限制与禁止**：无。
- **异常与边界**：「恭喜获胜」「遗憾失败」「黄庄」标题文案在公共壳，本工程只提供胜负/流局标记与行主题切页。
- **验收**：组装结算数据时按本家净得分产出胜负标记（selfScore >= 0 记胜、负分记负），黄庄（ET_DRAWN）统一记流局；行按 C_Line 与 C_WinLost 切换高亮页与背景页。
- **职责域**：client
- **职责依据**：source-code/client/Code/util/BoxHzmjResultUtil.ts:36；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:371；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:374
- **服务端职责**：下发 MsgResultHu（含 end_type 与各座位得分）。
- **客户端职责**：组装结算数据时按本家净得分产出胜负标记（0 及以上记胜、负分记负），黄庄统一记为流局；中间区据此切换行的高亮页与背景页。
- **协作边界**：客户端按本端净得分与 end_type 本地判主题；标题文案与主题底色由公共壳实现。
- **来源文件**：`source-code/client/Code/util/BoxHzmjResultUtil.ts`
- **来源定位**：source-code/client/Code/util/BoxHzmjResultUtil.ts:36
- **原文摘录**：`let selfWinLost = selfScore >= 0 ? 0 : 1;  if (params.end_type === EndType.ET_DRAWN) {  selfWinLost = 2;`

#### `AT-ST-C15-014` 行左侧座位头像昵称与庄家倍数

- **规则说明**：每行左侧为座位、头像和昵称。庄家行显示「庄×3」。
- **触发条件**：小结算每行渲染，该座位本局为庄家时加庄倍数角标。
- **配置影响**：庄倍数角标取服务端牢庄档位（MsgJuData 的 banker_level），页面钳制在 0~3 页。
- **客户端交互**：左侧竖排座位名、头像与昵称，庄家位置出现庄倍数角标，点头像可查看资料。
- **限制与禁止**：无。
- **异常与边界**：庄倍数角标取服务端牢庄档位，笃三老庄下应为 3（庄×3）；若服务端下发其他档位，客户端会显示 1/2 倍。
- **验收**：逐行写入座位方向文案、玩家昵称与头像；庄家行（data.banker 命中）按牢庄档位切 C_IsBank 角标页，banker_level 由 GameData.setLianZhuangCount 落库。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:150；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:306；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:399；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:402；source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts:34
- **服务端职责**：下发 MsgJuData（banker_level 牢庄档位）与 MsgResultHu（庄家座位）。
- **客户端职责**：逐行写入座位方向文案、玩家昵称与头像并支持点头像看资料；庄家行按服务端下发的牢庄档位切庄倍数角标。
- **协作边界**：客户端按 data.banker 判庄家行、按牢庄档位切角标页；档位数值由服务端下发。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:150
- **原文摘录**：`obj.KW_Seat_Name.text = this._getSeatDirectionName(localSeat);`

#### `AT-ST-C15-015` 行内牌区摆布与胡张角标

- **规则说明**：中间从左到右是碰杠区和手牌，杠的第 4 张垒在上方，暗杠顶张正面。胡牌者其余手牌按胡牌组合分组，未胡牌者连续摆放。胡入的那一张在所属组合内标绿色「胡」。
- **触发条件**：小结算每行渲染牌区，按该座位胡牌与否选择组合分组或连续摆放。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：从左侧碰杠组到右侧手牌依次排布，杠组顶部多出一张，暗杠只露顶张，胡入牌带角标。
- **限制与禁止**：无。
- **异常与边界**：胡角标图片 ico_hu.png 的颜色无法在本工程内验证是否为绿色。
- **验收**：胡牌且有组合时按组合渲染，否则按副露加连续手牌渲染；杠组用四张页（C_ComboType 选 4mah）把第 4 张垒到上方，暗杠（C_IsAnGan）前三张置背面、顶部一张保持正面；胡张所在组最后一组内打胡角标（C_Hu）。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:557；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:583；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:588；source-code/client/Fgui/assets/box_hzmj_result/component/comboSefl.xml:21；source-code/client/Fgui/assets/box_hzmj_result/component/mahHandSelf.xml:30
- **服务端职责**：下发 MsgResultHu（含胡牌组合、副露与胡张位置）。
- **客户端职责**：胡牌且有组合时按组合渲染，否则按副露加连续手牌渲染；杠组用四张页把第 4 张垒到上方，暗杠把前三张置为背面、顶部一张保持正面；胡张所在组最后一组内打胡角标。
- **协作边界**：客户端按服务端组合数据本地渲染摆布与角标；角标颜色依赖图片资源。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:557
- **原文摘录**：`compNode.C_ComboType.setSelectedPage("4mah");  compNode.C_IsAnGan.selectedIndex = comb.flag == CombMahFlag.CMF_CKONG ? 1 : 0;`

#### `AT-ST-C15-016` 右侧本局净得分样式

- **规则说明**：右侧为本局净得分。正分带加号，0 分显示「0」，负分带减号。
- **触发条件**：小结算每行渲染。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：每行右侧分数按正负显示不同字图与符号。
- **限制与禁止**：无。
- **异常与边界**：黄色/浅蓝灰配色在 win/lose 字图内，仓库内无法读取；减号依赖服务端下发负数。
- **验收**：逐行取服务端下发的本局净得分，正分补加号显示（score > 0 时 "+" + scoreStr），按正负切换 win/lose 字图；0 分按原样显示。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:365；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:366；source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:75
- **服务端职责**：下发 MsgResultHu（含各座位本局净得分，负数自带减号）。
- **客户端职责**：逐行取服务端下发的本局净得分，正分补加号后显示，并按正负切换胜负字图；0 分按原样显示。
- **协作边界**：客户端本地补加号与切字图；得分数值与符号由服务端下发。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:365
- **原文摘录**：`obj.KW_Score.text = score > 0 ? "+" + scoreStr : scoreStr;`

## `FP-ST-C15-006` 番型名称与胡牌方式标注

- **主描述**：赢家牌组上方写实际命中的番型名称，多组都写；最右侧标胡牌方式，赔付者标「点炮」。
- **范围与边界**：覆盖赢家行番型文案与胡牌方式标识；番型判定由服务端 fan_ids 决定。
- **总体协作**：流水工具按 fan_ids 生成番型文案写入行内文本，胡牌方式由胡牌类型页与点炮来源座位决定。

### 原子项

#### `AT-ST-C15-017` 赢家牌组上方番型名称

- **规则说明**：赢家牌组上方写实际命中的番型名称。同时命中多组时都写上，例如「七对」「杠飘」。双财飘、双豪华七对、二连杠直接写全名。
- **触发条件**：赢家行渲染番型文案，该座位本局胡牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：赢家行牌组上方出现番型文字，命中多组时连续展示，超长时截断。
- **限制与禁止**：无。
- **异常与边界**：普通多番用空串拼接（如「七对杠飘」），二/三连杠以「杠飘（二连杠）」括号形式给出，未完全等同于「直接写全名」的写法。
- **验收**：按服务端番型 ID 经 FormatGameHuFan 生成文案，无流水时从胡牌番型兜底生成；文本以「，」连接写入 KW_Flow，超过 maxLen 按 StrSliceSuffix 截断。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:759；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:766；source-code/client/Code/config/FanDefine.ts:389；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:777；source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:72
- **服务端职责**：下发 MsgResultHu（含 hu_items.fan_ids 与 fan_point）。
- **客户端职责**：按服务端下发的番型 ID 生成文案：无流水时从胡牌番型兜底生成，文本写在牌组上方的流水文本上；组合番按名称规则拼接档位明细。
- **协作边界**：客户端按 fan_ids 生成本地文案；番型判定由服务端决定。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:759
- **原文摘录**：`const fanText = FormatGameHuFan(RoomData.getCurGameId() ?? 0, huItem.fan_ids, huItem.fan_point);`

#### `AT-ST-C15-018` 最右侧标注胡牌方式

- **规则说明**：最右侧标胡牌方式：自摸、点炮胡或抢杠胡。
- **触发条件**：赢家行渲染胡牌方式，该座位本局胡牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：赢家行右侧显示胡牌方式标签。
- **限制与禁止**：无。
- **异常与边界**：与需求存在冲突——控件只有不参与/点炮/吃胡/自摸四页，实现按胡牌类型只在自摸与吃胡两页间切换，点炮胡与抢杠胡（hu_type=HT_ROBKONG）均落到「吃胡」页，缺少「点炮胡」「抢杠胡」两种文案；该标签与承包角标同组竖排。
- **验收**：胡牌行按胡牌类型切 C_HuType 标签页：自摸（HT_SELF）走自摸页（selectedIndex=3），其余统一走吃胡页（selectedIndex=2）；点炮胡与抢杠胡的区分文案未见实现，待确认。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:729；source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:5；source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:94
- **服务端职责**：下发 MsgResultHu（含 hu_type 胡牌类型）。
- **客户端职责**：胡牌行按胡牌类型切标签页：自摸走自摸页，其余统一走吃胡页；该标签与承包角标同组竖排。
- **协作边界**：客户端按 hu_type 本地切页；点炮胡与抢杠胡未区分文案，与需求要求的三种胡牌方式标注不符。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:729
- **原文摘录**：`obj.C_HuType.selectedIndex = 0;  if (isHu) {  obj.C_HuType.selectedIndex = huItem?.hu_type == HuType.HT_SELF ? 3 : 2;`

#### `AT-ST-C15-019` 赔付者行标注「点炮」

- **规则说明**：点炮胡、抢杠胡的赔付者标「点炮」。
- **触发条件**：小结算行渲染，该座位不是胡牌者，且是某条非自摸胡牌项的放铳者。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：放铳者行右侧出现「点炮」标签。
- **限制与禁止**：无。
- **异常与边界**：抢杠胡的赔付者同样按 df_from 命中，前提是服务端把加杠者写为该字段。
- **验收**：非胡牌座位若为某条非自摸胡牌项（hu_type !== HT_SELF）的 df_from 来源，该行 C_HuType 切到点炮页（selectedIndex=1）显示「点炮」标签。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:734
- **服务端职责**：下发 MsgResultHu（含 hu_items 的 hu_type 与 df_from，抢杠胡时 df_from 为加杠者）。
- **客户端职责**：非胡牌座位若为某条非自摸胡牌项的放铳来源，则该行切到点炮页显示标签。
- **协作边界**：客户端按 df_from 本地判赔付者行并切页；赔付者身份由服务端字段保证。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:734
- **原文摘录**：`const dianPao = data.hu_items?.find((item) => item.hu_type !== HuType.HT_SELF && Number(item.df_from ?? -1) === serverSeat); …`

## `FP-ST-C15-007` 承包与反承包标注

- **主描述**：按承包关系在赢家与赔付者行标注三摊承包、反承包，链式承包时赢家同时标两种关系且番型只写一次。
- **范围与边界**：覆盖承包角标与流水文案；承包成立条件与赔付金额由服务端结算决定。
- **总体协作**：结算的承包明细按关系类型同时驱动流水的赢家文案与行内角标。

### 原子项

#### `AT-ST-C15-020` 三摊承包的赢家与赔付者标注

- **规则说明**：三摊承包：赢家标黄色「承包」，赔付者得分右侧标「三摊承包」。
- **触发条件**：本局存在承包结算，某方向摊数达到承包成立条件且本局结算产生承包赔付。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：赢家行出现承包文案，承包方行右侧出现承包角标图。
- **限制与禁止**：无。
- **异常与边界**：角标页名为 chengbao，备注「承包」；本工程未出现「三摊承包」文案，赔付者角标是否显示该字样无法读取图片验证，「黄色」也无法确认；承包成立条件与金额由服务端决定。
- **验收**：承包明细中关系为承包（BAO_RELATION_CHENG）时，赢家行流水追加「承包」文案；承包方（bao.from_seat 命中的座位）行切 C_ChengBao 的 chengbao 角标页。
- **职责域**：client
- **职责依据**：source-code/client/Code/util/BoxHzmjFlowUtil.ts:432；source-code/client/Code/util/BoxHzmjFlowUtil.ts:445；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:212；source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:17
- **服务端职责**：下发 MsgResultHu（含 bao_settles 承包结算明细）。
- **客户端职责**：承包明细中关系为承包时，赢家行流水追加「承包」文案；承包方（出承包的一方）行切承包角标页。
- **协作边界**：客户端按 bao_settles 关系类型上文案与角标；承包成立条件与金额在服务端。
- **来源文件**：`source-code/client/Code/util/BoxHzmjFlowUtil.ts`
- **来源定位**：source-code/client/Code/util/BoxHzmjFlowUtil.ts:432
- **原文摘录**：`const name = rel === BAO_RELATION_DAO ? "反承包" : "承包";`

#### `AT-ST-C15-021` 反承包的双方标注

- **规则说明**：反承包：赢家标「反承包」，赔付者标「反承包」。
- **触发条件**：本局存在反承包结算，原被承包方自摸触发反承包赔付。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：赢家行出现反承包文案，赔付方行出现反承包角标。
- **限制与禁止**：无。
- **异常与边界**：同一座位同时命中两条关系时角标只取第一条（提前返回），可能存在只显示一种关系的边缘情况；反承包成立与倍率由服务端决定。
- **验收**：关系为反承包（BAO_RELATION_DAO）时，赢家行流水追加「反承包」文案；出承包的一方行切 C_ChengBao 的 fanchengbao 角标页。
- **职责域**：client
- **职责依据**：source-code/client/Code/util/BoxHzmjFlowUtil.ts:429；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:209；source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:20
- **服务端职责**：下发 MsgResultHu（含 bao_settles 反承包关系明细）。
- **客户端职责**：关系为反承包时，赢家行流水追加「反承包」；出承包的一方行切反承包角标页。
- **协作边界**：客户端按关系类型上文案与角标；反承包成立与倍率在服务端。
- **来源文件**：`source-code/client/Code/util/BoxHzmjFlowUtil.ts`
- **来源定位**：source-code/client/Code/util/BoxHzmjFlowUtil.ts:429
- **原文摘录**：`if (rel !== BAO_RELATION_CHENG && rel !== BAO_RELATION_DAO) continue;`

#### `AT-ST-C15-022` 链式承包的分向标注

- **规则说明**：链式承包：赢家同时标「承包」和「反承包」，番型只写一次；付 S 的一方标「三摊承包」，付 2 × S 的一方标「反承包」。
- **触发条件**：同一赢家同时存在承包与反承包关系，链式承包成立并产生两笔赔付。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：赢家行文本同时出现承包与反承包，番型只出现一次。
- **限制与禁止**：无。
- **异常与边界**：赢家双标通过两条流水文案实现，但角标只取第一条关系；赔付方仍只有「承包/反承包」角标，未见按 S 与 2×S 区分「三摊承包」的文案实现。
- **验收**：承包明细逐条遍历，同一赢家存在两条关系时两条文案都会追加到流水（以「，」连接）；番型文案由番型兜底单独生成不随关系重复；角标对每个座位只取首条命中关系。
- **职责域**：client
- **职责依据**：source-code/client/Code/util/BoxHzmjFlowUtil.ts:427；source-code/client/Code/util/BoxHzmjFlowUtil.ts:444；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:207；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:766
- **服务端职责**：下发 MsgResultHu（含 bao_settles 多条承包关系与各自赔付金额）。
- **客户端职责**：承包明细逐条遍历，同一赢家存在两条关系时两条文案都会追加到流水；番型文案由番型兜底单独生成，不会随关系重复；角标对每个座位只取首条命中关系。
- **协作边界**：客户端按 bao_settles 明细生成分向文案与角标；按赔付额（S 与 2×S）区分标注未见实现。
- **来源文件**：`source-code/client/Code/util/BoxHzmjFlowUtil.ts`
- **来源定位**：source-code/client/Code/util/BoxHzmjFlowUtil.ts:427
- **原文摘录**：`for (const bao of data.bao_settles ?? []) {`

## `FP-ST-C15-008` 财神展示、长按查桌与底部按钮

- **主描述**：左下展示本局财神正面，右下支持长按临时收起小结算查看终局牌桌，底部按末局显示继续游戏或返回大厅。
- **范围与边界**：覆盖左下财神插件与长按查桌、继续/返回入口；长按时长与按钮文案由公共壳控制。
- **总体协作**：结算视图挂载财神插件并把长按/关闭/继续点击转成游戏内事件，桌面视图响应查桌事件高亮财神。

### 原子项

#### `AT-ST-C15-023` 左下展示本局财神正面

- **规则说明**：小结算面板左下区展示本局财神那张牌的正面，即白板。财神由玩法固定为白板，客户端按当局财神牌值显示，不硬编码白板。
- **触发条件**：小结算打开并挂载左下区，且本局存在财神（GameData.jokerMah 有值）。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：小结算打开后，左下角出现一张财神牌正面并带财神专用配色；当局无财神时该区域整体隐藏。
- **限制与禁止**：无。
- **异常与边界**：当局无财神（jokerMah 为空）时左下区整块隐藏，不显示占位。
- **验收**：胡牌局与黄庄局打开小结算，左下均显示一张正面财神牌且配色正确；构造无财神场景时左下区隐藏。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultLeft.ts:37; source-code/client/Fgui/assets/box_hzmj_result/BoxHzmjResultLeft.xml:4
- **服务端职责**：下发 MsgJoker（当局财神牌值）与 MsgResultHu（结算打开时机），财神具体牌值由服务端通告，客户端不自算。
- **客户端职责**：左下区按当局财神值取牌面并以正面状态显示，同时打财神专用颜色；无财神时整块隐藏。
- **协作边界**：客户端消费 MsgJoker/MsgResultHu 中携带的财神牌值与结算时机；牌面渲染、正面状态与隐藏边界为本地展示逻辑。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultLeft.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultLeft.ts:30
- **原文摘录**：`const mah = GameData.jokerMah;  if (!mah) {  this.view.visible = false;`

#### `AT-ST-C15-024` 长按查看牌桌与松手恢复

- **规则说明**：右下为「长按查看牌桌」：在底部栏扣除中央主按钮后的区域按住 500 毫秒，临时收起小结算，按本家视角查看终局牌桌；松手恢复同一张小结算。桌面视图在查桌期间高亮桌上财神。
- **触发条件**：小结算已打开，玩家在底部栏（扣除中央主按钮后的区域）按住；长按开始时查桌、松手时恢复。
- **配置影响**：本原子项无独立配置；500 毫秒时长由公共壳控制。
- **客户端交互**：按住区域 500 毫秒临时收起小结算并查看牌桌，松手恢复；长按期间小结算收起、牌桌可见并高亮桌上财神。
- **限制与禁止**：无。
- **异常与边界**：长按时长判定（500 毫秒）、小结算本体收起/恢复与按本家视角查看由公共壳实现，本工程只提供事件出口与桌面财神高亮；当局无财神（jokerMah 不大于 0）时不高亮。
- **验收**：小结算打开后长按底部区域，可看到终局牌桌且桌上财神被高亮；松手后恢复同一张小结算；500 毫秒阈值与小结算收起本体属公共壳行为，本工程侧验收事件派发与财神高亮。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjResultView.ts:103; source-code/client/Code/layer/BoxHzmjMah2DView.ts:1152
- **服务端职责**：下发 MsgResultHu（结算数据），查桌与恢复为纯客户端交互，不产生服务端往返。
- **客户端职责**：结算视图在长按开始/结束时向游戏内派发查桌（onResultShowTable）与恢复（onResultHideTable）事件，桌面视图收到后高亮/取消高亮桌上财神。
- **协作边界**：客户端消费 MsgResultHu 确认结算状态；长按判定与面板收起属公共壳，本工程负责事件出口与桌面财神高亮的本地逻辑。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjResultView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjResultView.ts:98
- **原文摘录**：`protected onPressShowTable(): void {  this.dispatch(GameEventBoxHzmj.onResultShowTable);`

#### `AT-ST-C15-025` 继续游戏与返回大厅

- **规则说明**：非末局底部中央为【继续游戏】。点击后本端收起小结算，清除上一局手牌、碰杠区和牌河，保留座位和累计积分，本家显示「已准备」。四人均准备后自动开下一小局。第 8 局按钮为【返回大厅】，点击后退出房间。
- **触发条件**：玩家点击底部中央主按钮；非末局为继续游戏，第 8 局（末局）为返回大厅；重新开局由重开事件（onPlayAgain）触发重置流程。
- **配置影响**：本原子项无独立配置；按钮文案与是否最后一局（C_IsLastRound）由公共壳切换。
- **客户端交互**：底部中央按钮非末局为【继续游戏】、第 8 局为【返回大厅】；点击后小结算收起、牌桌清空回到等待，本家头像出现准备角标。
- **限制与禁止**：无。
- **异常与边界**：继续游戏回调在本类为空实现（原派发逻辑被注释），需确认公共壳是否自行上报准备；按钮文案、是否最后一局、四人准备自动开局与返回大厅退出由公共壳与服务端驱动；重置时玩家累计分字段保留不清除。
- **验收**：非末局点继续游戏后，小结算隐藏、当局手牌/副露/牌河与操作状态清空、座位与累计积分保留、本家头像显示准备角标（C_Ready 切到 ready 页）；四人到齐自动开下一局与末局退出房间属公共壳与服务端链路，本工程侧验收重置清牌与准备角标资源存在。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjResultView.ts:119; source-code/client/Code/layer/BoxHzmjMainView.ts:426; source-code/client/Code/data/GameData.ts:176; source-code/client/Fgui/assets/box_hzmj_player/component/PlayerSelfBase.xml:5
- **服务端职责**：下发 MsgEndGame（末局与退出房间时机），准备上报、四人自动开局与返回大厅由服务端配合公共壳完成。
- **客户端职责**：继续游戏的回调在本类为空实现；重新开局时由重开事件触发重置流程：清空当局手牌、副露、牌河与操作状态并隐藏小结算，玩家累计分字段保留；准备角标由房间层下发的动作状态驱动。
- **协作边界**：客户端消费 MsgEndGame 与公共壳重开事件完成本地重置清牌与准备角标展示；准备上报与四人开局判定在服务端与公共壳侧，本工程不做本地判断。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjResultView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjResultView.ts:119
- **原文摘录**：`protected onContinueResult(): void {  // this.dispatch(GameEventBoxHzmj.onResultContinue);  // this.dispatch(GameEventBoxHzmj.onResetUI);`
