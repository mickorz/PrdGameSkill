# 发牌

> 阶段 ID：`ST-C03`。来源：模板「开局 > 发牌」章节。客户端视角规格，客户端逻辑与 UI 交互以 Code/Fgui 代码证据支撑。

## 0. 阶段

- **阶段 ID**：`ST-C03`
- **阶段**：发牌
- **来源章节**：开局 > 发牌
- **涉及协议消息**：MsgThrowChip、MsgJuData、MsgWallMah、MsgTakeFirst、MsgTake、MsgStartGame、MsgEndWait、MsgPower、MsgHuC、MsgCancel、MsgWaitInfos
- **涉及 UI 模块**：box_hzmj_main（Fgui 组件包）、BoxHzmjMainView、BoxHzmjMah2DView、BoxHzmjTingPaiView、BoxHzmjMahRightComp、BoxHzmjTestView
- **阶段概述**：服务端逐座位下发发牌结果，客户端整手写入各玩家手牌数据、按座位播放发牌与理牌动画；庄家持14张直接进入首轮，理牌后由服务端权限消息给出胡与过。

## 术语与单位（有则填）

| 术语 | 定义 | 单位/量纲 | 作用域 | 来源 |
| --- | --- | --- | --- | --- |
| 牌墙头部 | 发牌与常规摸牌均从牌墙头部取牌（正向索引）。 | 索引起点（正向） | 发牌与常规摸牌 | 模板 开局>发牌 第39行 |
| 庄家 | 每小局一名庄家，庄家先出牌，其余为闲家；首局随机、胡牌者下局坐庄、流局连庄。 | 名（每小局1名） | 局级角色与出牌顺序 | 模板 开局 第7、26-28行 |
| 闲家 | 除庄家外的三名玩家，本阶段各得13张手牌。 | 名（3名）/ 张（各13张） | 发牌阶段手牌张数 | 模板 开局>发牌 第43行 |
| 爆头 | 摸牌前为4组面子加1张财神，下一张摸到任意牌即与财神组成对子自摸，只能自摸。 | 4组面子 + 1张财神 | 首轮自摸判定 | 模板 名词 第16行 |
| 七客 | 七对爆头：摸牌前无吃碰杠，手牌为6组对子加1张财神，结算按七对和爆头两组连乘。 | 6组对子 + 1张财神 | 结算番型（连乘） | 模板 名词 第17行 |
| 财神 | 白板固定为财神，只在胡牌判定时代替顺子、刻子或对子所缺的牌。 | 张（白板1张） | 胡牌判定代牌 | 模板 名词 第12行 |

## 跨切面行为（无原子也列）

- **静默补数据**：MsgTakeFirst、MsgTake、MsgWallMah、MsgStartGame 处理器均以 justUpdateData 判定只写缓存、不播发牌与牌墙动画 —— 跨切面（GameTakeFirstCmd.ts:22-40、GameTakeCmd.ts:39-51、GameWallMahCmd.ts:20-36）。
- **四家发牌动画触发时机**：四家发牌动画不在 MsgTakeFirst 时播放，而由首条 flag==0 的 MsgTake 触发 _playTakeFirstAni，并按本地座位 0..playCnt-1 逐个派发 onTakeFirstAniAll —— 跨切面（GameTakeCmd.ts:66-67、297-305）。
- **理牌结束与 EndWait 推进**：自身理牌动画结束即上行 MsgEndWait 推进，随后服务端下发 MsgPower；第2局起 GameStartGameCmd 置 takeFirstEndWait 兜底自动 EndWait —— 跨切面（BoxHzmjMainView.ts:1350-1355、GameController.ts:406-419、GameStartGameCmd.ts:40-43、GameEndWaitCmd.ts:27-31）。
- **记牌器初始化**：开局 initCardCounter 将每张牌置4张，发牌后按自己手牌扣减 —— 跨切面（GameData.ts:1467-1487、GameTakeFirstCmd.ts:33）。
- **牌墙显示配置控制**：牌墙显示受包厢配置 getBoxCardwallOpen 控制，剩余张数通过 onUpdateMahCnt 刷新右上角 BoxHzmjMahRightComp —— 跨切面（GameWallMahCmd.ts:40-44、BoxHzmjMahRightComp.ts:26-34）。
- **状态机缺口**：GameData.setTableState 仅接受 START/ZHUANG/END，MsgTakeFirst 设置的 MAH_STATE_TAKEFIRST 与 MsgTake 设置的 MAH_STATE_TAKE 实际被丢弃 —— 跨切面（GameData.ts:575-576）。

## `FP-ST-C03-001` 发牌顺序与方向

- **主描述**：发牌从牌墙头部起、以庄家为起点按逆时针逐座进行，客户端完全按服务端逐座位下发的 MsgTakeFirst 落数据与播动画。
- **范围与边界**：只覆盖取牌起点与方位顺序，不含掷骰定庄本身。
- **总体协作**：骰子(MsgThrowChip)与局数据(MsgJuData，含庄家)先行，之后 MsgTakeFirst 逐座位到达。

### 原子项

#### `AT-ST-C03-001` 从牌墙头部取牌

- **规则说明**：发牌从牌墙头部开始取牌。
- **触发条件**：MsgWallMah 到达并重置牌墙索引后，首条 flag=0 的 MsgTake 触发发牌后的首次抓牌牌墙置空计算。
- **配置影响**：本原子项无独立配置；牌墙索引方向由 MsgWallMah 的 first_asc/first_desc 数据重置（takeWalls 的 nDir：1正向/2反向）。
- **客户端交互**：牌墙按索引逐张置空隐藏，剩余张数 via onUpdateMahCnt 同步刷新。
- **限制与禁止**：无
- **异常与边界**：代码以"正向/asc 索引"表达牌墙起点，未显式命名"头部"；发牌阶段本身不扣墙，扣减发生在首条 flag=0 的抓牌。
- **验收**：MsgWallMah 到达后按 first_asc/first_desc 重置牌墙；首条 flag=0 的 MsgTake 触发 takeWalls(1, hands.length*playCnt+1) 从正向起点置空牌墙；牌墙剩余张数显示与实际一致。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:94；source-code/client/Code/controller/cmd/gameCmd/GameWallMahCmd.ts:33
- **服务端职责**：下发 MsgWallMah（携带牌墙总数 wall_left 与 first_asc/first_desc 索引）、MsgTake（首条 flag=0 携带发牌后手牌数据触发牌墙消耗计算）。
- **客户端职责**：GameData.takeWalls(nDir,nTcnt) 按正向(1)/反向(2)索引置空牌墙；发牌后的首次抓牌调用 takeWalls(1, hands.length*playCnt+1) 从正向起点顺序取；MsgWallMah 用服务端 first_asc/first_desc 重置牌墙索引。
- **协作边界**：客户端消费 MsgWallMah 的牌墙索引与 MsgTake 的手牌数据做本地牌墙置空与剩余数显示；取牌起点与方向由服务端消息决定，客户端不自行推算。
- **来源文件**：`source-code/client/Code/data/GameData.ts`
- **来源定位**：source-code/client/Code/data/GameData.ts:687
- **原文摘录**：`* @param nDir:抓拍方向 1:正向 2:反向，`

#### `AT-ST-C03-002` 庄家为发牌起点

- **规则说明**：发牌从庄家起始。
- **触发条件**：MsgJuData 携带庄家座位到达并落位后，服务端以庄家为起点逐座位下发 MsgTakeFirst。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：庄家标识由 onShowZhuang 展示（属定庄阶段表现，非发牌逻辑）。
- **限制与禁止**：无
- **异常与边界**：无"从庄家起"的顺序计算，顺序完全由服务端逐座位下发；客户端发牌动画循环按本地座位索引 0..playCnt-1 播放，与庄家起点无关。
- **验收**：MsgJuData 到达后 zhuang 经 seatToLocal 正确转本地座位并记录；MsgTakeFirst 按到达顺序逐座位整手落库，客户端不自行推算发牌起点。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameTakeFirstCmd.ts:29；source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:303
- **服务端职责**：下发 MsgJuData（含庄家座位 zhuang）、MsgTakeFirst（逐座位携带 seat+hands）。
- **客户端职责**：MsgJuData 将服务端 zhuang 转本地座位并记录庄家；MsgTakeFirst 逐座位携带 seat+hands，客户端不自行推算发牌起点。
- **协作边界**：客户端消费 MsgJuData/MsgTakeFirst 消息落库并播放动画；发牌起点与下发顺序由服务端决定。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts:31
- **原文摘录**：`const localSeat = TableData.inst.seatToLocal(data.zhuang);`

#### `AT-ST-C03-003` 逆时针逐座发牌

- **规则说明**：发牌按逆时针方向依次进行。
- **触发条件**：进入发牌阶段、服务端逐座位下发 MsgTakeFirst 时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无
- **异常与边界**：未找到逆时针/顺时针方向相关实现；座位映射 SC_PLAYER_LOCAL_SEAT_MAP 仅做本地座位到 UI 下标映射，不表达发牌方向。
- **验收**：客户端无可独立验收的方向实现；验收以服务端 MsgTakeFirst 逐座位到达顺序符合逆时针为准，客户端仅按到达顺序消费。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：下发 MsgTakeFirst（逐座位），发牌方向顺序由服务端保证。
- **客户端职责**：待确认
- **协作边界**：客户端仅按 MsgTakeFirst 到达顺序消费数据，不做本地方向逻辑。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

## `FP-ST-C03-002` 发牌张数与轮次

- **主描述**：每人4张发3轮共12张，再各1张至13张，庄家再补1张至14张，合计发出53张、余83张。
- **范围与边界**：仅覆盖张数、轮次与牌墙余量，不含理牌与首轮胡判定。
- **总体协作**：张数由服务端 hands 决定，客户端按整手牌渲染并以 hands.length*playCnt+1 计算牌墙消耗。

### 原子项

#### `AT-ST-C03-004` 每人4张发3轮共12张

- **规则说明**：每人每次发4张，共发3轮，各得12张。
- **触发条件**：MsgTakeFirst 到达时整手落库，随后由发牌动画按座位触发 takeFirst 整手展示。
- **配置影响**：发牌节奏常量 Time_TakeFirstOneMah=0.25（发牌阶段两墩牌的时间），本工程内未被引用。
- **客户端交互**：每个座位手牌整批出现（takeFirst），自身座位先随机乱序展示再进入理牌。
- **限制与禁止**：无
- **异常与边界**：未见"每人4张×3轮"的分轮节奏实现，本工程内 takeFirst 只接收整手牌。
- **验收**：MsgTakeFirst 到达后 setHandFirst 整手落库；各座位 onTakeFirstAniAll 触发 hands[seat].takeFirst(cards) 整批展示；自身座位乱序展示后进入理牌；分轮节奏不在客户端体现。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:770；source-code/client/Code/config/BoxMahDefine.ts:417；source-code/client/Code/layer/BoxHzmjTestView.ts:431
- **服务端职责**：下发 MsgTakeFirst（一次性下发整手 hands，不含分轮信息）。
- **客户端职责**：MsgTakeFirst 一次性下发整手 hands，GameTakeFirstCmd 调 setHandFirst 整手落库；BoxHzmjMah2DView.onTakeFirstAniAll 调 hands[seat].takeFirst(cards) 整手展示。
- **协作边界**：客户端消费 MsgTakeFirst 的整手 hands 落库并整批展示；"每人4张×3轮"的分轮节奏由服务端侧语义承载，客户端不模拟分轮。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameTakeFirstCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameTakeFirstCmd.ts:31
- **原文摘录**：`GameData.getPlayerCardsData(localSeat)?.setHandFirst(data.hands);`

#### `AT-ST-C03-005` 再每人1张至13张

- **规则说明**：三轮之后每人再发1张，各得13张。
- **触发条件**：MsgTakeFirst 整手落库后，自身13张手牌作为基数参与首次抓牌的牌墙消耗计算 hands.length*playCnt+1。
- **配置影响**：PlayerCardsData 以 MAX_MAH_COUNT-1=13 作为手牌平铺上限，超出部分转为单放摸牌位。
- **客户端交互**：手牌区最多平铺13张，第14张进入单放位。
- **限制与禁止**：无
- **异常与边界**：13张未在发牌处理中显式校验，来自服务端 hands 与常量推算。
- **验收**：MsgTakeFirst 落库后自身平铺手牌不超过13张（超出转单放摸牌位）；首次抓牌牌墙消耗以 hands.length=13 为基数计算。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/PlayerCardsData.ts:495；source-code/client/Code/layer/BoxHzmjTestView.ts:431
- **服务端职责**：下发 MsgTakeFirst（hands 长度即每人张数，客户端不校验）。
- **客户端职责**：自己手牌13张作为基数参与首次抓牌的牌墙消耗计算 hands.length*playCnt+1；PlayerCardsData 以 MAX_MAH_COUNT-1=13 作为手牌上限，超出部分转为单放摸牌位。
- **协作边界**：客户端消费 MsgTakeFirst 的 hands 落库并按常量控制平铺上限；"各得13张"的张数正确性由服务端 hands 保证。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:94
- **原文摘录**：`return GameData.takeWalls(1, hands.length * TableData.inst.playCnt + 1);`

#### `AT-ST-C03-006` 庄家补1张至14张

- **规则说明**：最后再给庄家1张，庄家14张，三名闲家各13张。
- **触发条件**：MsgJuData 确定庄家座位后，MsgTakeFirst 携带庄家14张整手下发。
- **配置影响**：手牌上限常量 MAX_MAH_COUNT=14。
- **客户端交互**：庄家14张全部平铺展示，无单放摸牌位。
- **限制与禁止**：无
- **异常与边界**：客户端不区分庄家/闲家张数，也不校验 hands 长度，14与13均依赖服务端下发；庄家额外1张无专门分支处理。
- **验收**：庄家 MsgTakeFirst 落库后 _cards 为14张且全部平铺（无 moCard）；庄家座位经 setZhuangSeat 记录，理牌 sortSelfHandCard 正常执行；闲家张数按服务端 hands 为13张。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/PlayerCardsData.ts:227；source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts:32
- **服务端职责**：下发 MsgJuData（指定庄家座位）、MsgTakeFirst（庄家 hands 含14张，闲家13张）。
- **客户端职责**：手牌上限常量为14；庄家座位由 MsgJuData 指定；setHandFirst 只写 _cards，不写单放摸牌位 moCard，故14张全部平铺在手中。
- **协作边界**：客户端消费 MsgTakeFirst 整手落库，不区分庄闲张数、不校验 hands 长度；庄家补张与各玩家张数由服务端 hands 决定。
- **来源文件**：`source-code/client/Code/config/BoxMahDefine.ts`
- **来源定位**：source-code/client/Code/config/BoxMahDefine.ts:56
- **原文摘录**：`public static MAX_MAH_COUNT: number = 14;`

#### `AT-ST-C03-007` 合计53张余83张

- **规则说明**：共发出53张牌，牌墙剩余83张。
- **触发条件**：MsgWallMah 到达设置牌墙总数后，首条 flag=0 的 MsgTake 到达时一次性扣减牌墙。
- **配置影响**：牌墙显示受包厢配置 getBoxCardwallOpen 控制，剩余张数经 onUpdateMahCnt 刷新右上角 BoxHzmjMahRightComp。
- **客户端交互**：右上角剩余张数组件显示 getLeftCard() 数值。
- **限制与禁止**：无
- **异常与边界**：代码未写死53/83；发牌阶段(MsgTakeFirst)不扣墙，首条 flag=0 抓牌时一次性扣53且未单独扣本次摸到的1张，剩余数可能出现1张偏差，需与服务端确认。
- **验收**：MsgWallMah 以 wall_left 设置牌墙总数；首条 flag=0 的 MsgTake 后 _wallLeftNum 按已发张数扣减，右上角显示剩余数与牌墙一致；53/83 语义由 hands.length*playCnt+1 与服务端 wall_left 共同保证（存在1张偏差风险待确认）。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/GameData.ts:738；source-code/client/Code/controller/cmd/gameCmd/GameWallMahCmd.ts:32；source-code/client/Code/layer/comp/BoxHzmjMahRightComp.ts:28
- **服务端职责**：下发 MsgWallMah（wall_left 牌墙总数与索引）、MsgTake（首条 flag=0 触发牌墙消耗）。
- **客户端职责**：首次抓牌按 hands.length*playCnt+1（13*4+1=53）计算需置空的牌墙索引；takeWalls 末尾执行 _wallLeftNum -= nTcnt；MsgWallMah 以服务端 wall_left 作为牌墙总数。
- **协作边界**：客户端消费 MsgWallMah 的 wall_left 定总数、按 MsgTake 手牌基数本地扣减；53/83 不写死，正确性依赖服务端数据，存在1张偏差风险需服务端确认。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:94
- **原文摘录**：`return GameData.takeWalls(1, hands.length * TableData.inst.playCnt + 1);`

## `FP-ST-C03-003` 庄家首轮直出与首轮自摸

- **主描述**：庄家持14张直接进入首轮不再摸牌；理牌后若已满足自摸立即给出【自摸】【过】；爆头、七客按其余13张判断。
- **范围与边界**：覆盖庄家首轮流程与首轮胡提示，不含行牌阶段的吃碰杠响应。
- **总体协作**：客户端理牌动画结束上行 MsgEndWait，服务端下发 MsgPower 决定胡/过呈现，胡按钮按胡类型选动效皮。

### 原子项

#### `AT-ST-C03-008` 庄家14张直接首轮不再摸牌

- **规则说明**：庄家用这14张直接进入首轮，不再摸牌。
- **触发条件**：庄家 MsgTakeFirst 整手14张落库、发牌动画结束自动理牌，理牌完成即 sendEndWait 请求推进。
- **配置影响**：首出阶段判定依赖剩余张数推算 leftCard === totalCard - playCnt*getInitHandCardNum() - 1，非座位配置。
- **客户端交互**：发牌动画结束自动理牌，不播摸牌动画；首出阶段弹出庄/闲提示 KW_ZhuangTips。
- **限制与禁止**：无
- **异常与边界**：无"庄家跳过摸牌"的显式分支，属于发牌即给全手牌、理牌后直接要权限的隐含实现；首出判定依赖剩余张数而非座位。
- **验收**：庄家理牌完成上行 MsgEndWait 后接收 MsgPower 进入出牌，期间不播放摸牌动画；首出阶段判定 isFirstCount 成立并展示庄/闲提示。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1351；source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:142
- **服务端职责**：下发 MsgTakeFirst（庄家整手14张）、MsgPower（理牌结束后的操作权限），并接收 MsgEndWait 推进信号。
- **客户端职责**：庄家14张经 MsgTakeFirst 一次性入手且不设 moCard，发牌动画后立即理牌并 sendEndWait，直接接收 MsgPower 进入出牌；GamePowerCmd 用 leftCard === totalCard - playCnt*13 - 1 判定首出阶段。
- **协作边界**：客户端消费 MsgTakeFirst 落库、上行 MsgEndWait、消费 MsgPower 展示；"不再摸牌"由服务端不再下发庄家摸牌隐含保证，客户端无显式分支。
- **来源文件**：`source-code/client/Code/data/PlayerCardsData.ts`
- **来源定位**：source-code/client/Code/data/PlayerCardsData.ts:226
- **原文摘录**：`this._cards = cards;`

#### `AT-ST-C03-009` 理牌后立即给自摸与过

- **规则说明**：理牌后若已满足自摸，立即给出【自摸】【过】。
- **触发条件**：自身理牌完成回调 sendEndWait 后，服务端 MsgPower 到达且含胡权限时展示胡/过按钮。
- **配置影响**：胡按钮动效皮按 MsgPower 的 hu_type 选择（非点炮/抢杠即 zimo）。
- **客户端交互**：理牌后若已满足自摸，立即给出【自摸】【过】：胡按钮 KW_BTN_Hu 播放 zimo 动画并显示胡牌牌面与倍数，过按钮 KW_BTN_Guo 同时出现；胡牌结果标识 HuIndex 含"自摸"页。
- **限制与禁止**：无
- **异常与边界**：按钮文案为"胡"而非"自摸"，自摸仅通过 zimo 动效皮与结算标识体现；"立即"取决于服务端 MsgPower 时机，客户端无额外延时控制。
- **验收**：MsgPower 含胡权限时 KW_BTN_Hu 以 zimo 皮展示胡牌牌面与倍数、KW_BTN_Guo 按 showGuo 同显；胡/过选择经 MsgHuC/MsgCancel 上行；HuIndex 可切到"自摸"页。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:665；source-code/client/Code/layer/BoxHzmjMainView.ts:581；source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:15；source-code/client/Fgui/assets/box_hzmj_main/component/HuIndex.xml:3
- **服务端职责**：接收 MsgEndWait 后下发 MsgPower（含胡/过权限与 hu_type），并处理 MsgHuC（胡）与 MsgCancel（过）上行。
- **客户端职责**：自身理牌完成回调中 sendEndWait 请求推进；MsgPower 到达后按 power 位展示胡/过按钮，胡按钮按 hu_type 选动效皮（非点炮/抢杠即 zimo）。
- **协作边界**：客户端上行 MsgEndWait/MsgHuC/MsgCancel、消费 MsgPower 决定按钮显隐与动效；是否满足自摸由服务端 MsgPower 判定，客户端不本地判定。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1354
- **原文摘录**：`GameController.instance.sendEndWait();`

#### `AT-ST-C03-010` 爆头七客按13张判断

- **规则说明**：爆头、七客按其余13张判断。
- **触发条件**：服务端 MsgWaitInfos 下发听牌/爆头信息时。
- **配置影响**：服务端任意牌牌值 0xFF(255) 客户端统一归一为 MAH_VALUE_ALL(0x7F) 以匹配任意牌图。
- **客户端交互**：听牌面板切换到爆头页（C_BaoTou/KW_BaoTou）并显示"胡"。
- **限制与禁止**：爆头只能自摸（下一张摸到任意牌即与财神组成对子自摸）。
- **异常与边界**：客户端不按"其余13张"做本地判定，判定在服务端；代码中亦未见发牌后自动计算爆头/七客的逻辑，七客仅为结算番型命名。
- **验收**：MsgWaitInfos 携带 TYPE_BAO 或任意牌牌值（mah=255 归一为 MAH_VALUE_ALL）时，听牌面板正确切换爆头页并显示"胡"；七客仅在结算番型命名中出现，发牌阶段无本地判定。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTingPaiView.ts:41；source-code/client/Code/data/GameData.ts:1992
- **服务端职责**：下发 MsgWaitInfos（含听牌类型 tingType 与所听牌 mah，任意牌用 0xFF(255)）。
- **客户端职责**：爆头/听牌由服务端 MsgWaitInfos 下发，wait mah=0xFF(255) 归一为 MAH_VALUE_ALL；GameData.isSelfBaoTouTing 依据 TYPE_BAO 或任意牌牌值判断展示；七客仅在结算番型命名中使用。
- **协作边界**：客户端消费 MsgWaitInfos 展示听牌/爆头信息；爆头/七客按13张的判定完全在服务端，客户端不做本地判定。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameWaitInfoCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameWaitInfoCmd.ts:97
- **原文摘录**：`// 服务端任意牌用 0xFF(255)，客户端统一成 MAH_VALUE_ALL(0x7F) 才能对上「任意牌」图`
