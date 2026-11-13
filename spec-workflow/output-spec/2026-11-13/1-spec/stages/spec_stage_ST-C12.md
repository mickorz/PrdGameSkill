# 三摊承包

> 阶段 ID：`ST-C12`。来源：模板「三摊承包」章节。客户端视角规格，客户端逻辑与 UI 交互以 Code/Fgui 代码证据支撑。

## 0. 阶段

- **阶段 ID**：`ST-C12`
- **阶段**：三摊承包
- **来源章节**：三摊承包
- **涉及协议消息**：MsgChowS、MsgTanUpdate、MsgResultHu、MsgPower、MsgPiao
- **涉及 UI 模块**：BoxHzmjMainView、box_hzmj_tipAni（HzmjTipAniComponent）、box_hzmj_result（ResultItem）、BoxHzmjResultMid、BoxHzmjFlowUtil
- **阶段概述**：三摊承包阶段规定：只按吃牌记摊，两个方向分别计算；庄家与闲家之间可成立承包，两名闲家之间同一方向最多 2 摊，满 2 摊后不再给【吃】；某一方向满 3 摊时记录承包并播放三摊落地；自摸、点炮、抢杠分别按承包、反承包、链式规则改写实际赔付金额（模板原文称"分"，含义为分数）。

## 术语与单位

| 术语 | 定义 | 单位/量纲 | 作用域 | 来源 |
| --- | --- | --- | --- | --- |
| 摊 | A 吃进 B 打出的牌，A 对 B 记 1 摊；两个方向分开计；碰、直杠、加杠、暗杠不计摊；每小局重新累计。 | 次 | 单小局内累计、局末重置 | 模板名词章节 第14行 |
| 承包 | 庄家与闲家之间，某一方向的有效摊达到成立条件后，承包方在自摸结算时代赔。 | 分（分数） | 自摸结算 | 模板名词章节 第15行 |
| 反承包 | 同一关系下，原被承包方自摸时，原承包方按加倍规则赔付。 | 分（2 倍分数） | 自摸结算 | 模板名词章节 第15行 |
| 三摊落地 | 某一方向计到第 3 摊成立承包时的桌面动效，模板要求四端播放。 | - | 桌面表现层 | 模板三摊承包 第136行；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1649 |
| 链式 | A 对 B 成立、同时 C 对 A 成立，A 自摸时 B 付 S、C 付 2×S，A 实收 3×S，第四家 0 分。 | 分（分数） | 自摸结算 | 模板三摊承包 第144行 |

## 跨切面行为

- **摊计数与承包判定全在服务端**：摊计数与承包判定全部由服务端计算，客户端只消费 MsgTanUpdate(1282) 的 tan_items 与 MsgResultHu(1286) 的 bao_settles，桌面阶段不展示摊数或承包角标 —— 跨切面（source-code/client/Code/layer/BoxHzmjTipAniView.ts:1790-1796）
- **摊数据整体替换语义待对齐**：GameData.updateTanItems 采用整体替换语义，而服务端约定为单条增量下发，若按增量下发会丢失历史摊项，需与协议语义对齐 —— 跨切面（source-code/client/Code/data/GameData.ts:1670-1671）
- **三摊落地为纯表现层**：三摊落地动画受简洁模式（GameData.simpleMode）和复盘模式抑制，且为纯表现层，不参与任何逻辑 —— 跨切面（source-code/client/Code/layer/BoxHzmjTipAniView.ts:1656-1658）
- **承包角标每座位单索引**：结算承包角标 C_ChengBao 每座位只有一个索引（0 不变 / 1 承包 / 2 反承包），同一座位存在多条承包关系时仅按数组顺序显示首条 —— 跨切面（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:206-216）
- **承包流水文案只挂赢家座位**：结算流水中的"承包/反承包"文案只挂到赢家座位（to_seat），付款方仅通过 from_seat 角标与 win_lost 总分体现 —— 跨切面（source-code/client/Code/util/BoxHzmjFlowUtil.ts:416-447）
- **断线重连走重连协议恢复摊数据**：断线重连通过 MsgRelinkOnAction.tan_items 恢复摊数据，不走 MsgTanUpdate —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/SceneActionCmd.ts:63-66）
- **匹配场与好友房表现差异**：匹配场额外在牌桌结算展示"三摊承包/反承包"文本，好友房无此文本，仅靠结算角标与流水文案 —— 跨切面（source-code/client/Code/layer/BoxHzmjTipAniView.ts:1707-1751）

## `FP-ST-C12-001` 摊的计量与方向

- **主描述**：只统计吃牌：A 吃 B 的牌，A 对 B 加 1 摊；同一对玩家的两个方向分别累计。
- **范围与边界**：包含摊的产生来源、计数主体与方向维度；不包含闲闲 2 摊上限（见 FP-ST-C12-002）与承包结算（见 FP-ST-C12-004）。
- **总体协作**：服务端在吃牌成立时写有向摊数并通过 MsgTanUpdate 广播；客户端只存储与展示，不本地计数。

### 原子项

#### `AT-ST-C12-001` 只统计吃牌

- **规则说明**：摊只按吃牌产生：A 吃进 B 打出的牌才计摊，其余副露不计。
- **触发条件**：吃牌动作成立（A 吃 B 打出的牌）时，由服务端对该方向计摊。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：吃牌时在吃牌方播放 TYPE_CHOW 动作动效；桌面无摊数展示。
- **限制与禁止**：碰、直杠、加杠、暗杠不计摊（摊术语定义）；客户端不做本地摊统计。
- **异常与边界**：客户端规则提示文案把摊写成"吃碰三摊"（MatchTipConfig.ts:23/40/47），与模板"只统计吃牌"冲突；客户端无本地摊统计，无法在端上验证碰/杠不计摊。
- **验收**：客户端无本地摊计数逻辑；吃牌时播放 TYPE_CHOW 动效；摊数完全以 MsgTanUpdate 下发的 tan_items 为准。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:43; source-code/client/Code/controller/cmd/gameCmd/GameTanUpdateCmd.ts:20; source-code/client/Code/config/MatchTipConfig.ts:23
- **服务端职责**：下发 MsgChowS / MsgTanUpdate（吃牌成立后广播摊计数，摊的产生来源由服务端判定）。
- **客户端职责**：客户端不在本地统计摊：吃牌由 GameChowCmd 处理副露、手牌扣减与动作动画，摊数完全由服务端 MsgTanUpdate 下发后整体写入 GameData._tanItems。
- **协作边界**：客户端消费 MsgChowS 驱动吃牌表现、消费 MsgTanUpdate 写入摊数据；不做任何计摊判断。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:43
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.onMsgPlayPengGang, BoxMahDefine.ActionAniType.TYPE_CHOW, localSeat);`

#### `AT-ST-C12-002` 吃牌即加 1 摊

- **规则说明**：A 吃 B 的牌成立后，A 对 B 方向的摊数加 1。
- **触发条件**：服务端确认吃牌成立时，对该方向摊计数 +1 并通过 MsgTanUpdate 下发。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：本原子项无独立 UI 交互（摊数无桌面展示）。
- **限制与禁止**：客户端不执行任何 +1 计数计算。
- **异常与边界**：计数由服务端完成，客户端只看到最终 tan_count，无法校验每次吃牌是否只加 1。
- **验收**：MsgTanUpdate 下发的 TanItem 携带 from_seat/to_seat/tan_count，客户端整体写入 GameData._tanItems，不出现本地计数。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameTanUpdateCmd.ts:15; source-code/client/Code/lib/proto_game_hzmj.d.ts:3785; source-code/client/Code/data/GameData.ts:1670
- **服务端职责**：下发 MsgTanUpdate（携带 tan_items 有向摊项与最终 tan_count）。
- **客户端职责**：客户端以有向摊项（from_seat 被吃方 → to_seat 吃牌方，tan_count）存储服务端下发结果，自身不执行 +1 计算。
- **协作边界**：客户端消费 MsgTanUpdate 存储摊项，不校验计数值。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameTanUpdateCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameTanUpdateCmd.ts:15
- **原文摘录**：`const data = notification.getBody() as proto.game_hzmj.MsgTanUpdate;`

#### `AT-ST-C12-003` 两个方向分开计

- **规则说明**：同一对玩家的两个吃牌方向各自独立计摊，互不合并、互不抵消。
- **触发条件**：任一方向的吃牌成立时，只对该方向的摊项计数。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：结算行承包角标只挂在 from_seat（承包方）所在座位。
- **限制与禁止**：禁止把两个方向的摊数合并为一项。
- **异常与边界**：无。
- **验收**：TanItem 以 from_seat/to_seat 有向对表达摊数，同一对玩家的两个方向各自独立成项；结算角标按 from_seat 单向判定。
- **职责域**：client
- **职责依据**：source-code/client/Code/lib/proto_game_hzmj.d.ts:3787; source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:212
- **服务端职责**：下发 MsgTanUpdate / MsgResultHu（摊项与结算条目均携带 from_seat/to_seat 方向字段）。
- **客户端职责**：TanItem 以 from_seat/to_seat 有向对表达摊数，同一对玩家的两个方向各自独立成项；结算角标同样按 from_seat 单向判定。
- **协作边界**：客户端按消息中的方向字段存储与展示，不做方向合并。
- **来源文件**：`source-code/client/Code/lib/proto_game_hzmj.d.ts`
- **来源定位**：source-code/client/Code/lib/proto_game_hzmj.d.ts:3787
- **原文摘录**：`interface ITanItem { /** TanItem from_seat */ from_seat?: (number|null); /** TanItem to_seat */ to_seat?: (number|null);`

## `FP-ST-C12-002` 承包参与方与闲闲摊数上限

- **主描述**：只有庄家与闲家之间可承包；两名闲家之间同一方向最多 2 摊，满 2 摊后不再给【吃】；与飘财无关。
- **范围与边界**：包含参与方资格、闲闲上限与吃牌权限；不包含 3 摊成立后的结算改写。
- **总体协作**：资格与上限判定在服务端，客户端按 MsgPower 权限位渲染【吃】按钮，不自行判断。

### 原子项

#### `AT-ST-C12-004` 只有庄闲之间能承包

- **规则说明**：承包关系只可能成立于庄家与闲家之间，闲闲之间不成立承包（仅受摊数上限约束）。
- **触发条件**：服务端在摊数达成立条件且双方为庄闲关系时写入承包。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：本原子项无独立 UI 交互（客户端不做庄闲过滤，直接渲染服务端下发的结算条目）。
- **限制与禁止**：闲闲之间不得成立承包。
- **异常与边界**：端上无庄闲判断分支，无法验证"庄闲之间"限制，只能依赖服务端 bao_settles 已正确过滤。
- **验收**：客户端结算时直接遍历 bao_settles 并按 from_seat 挂角标，不出现庄闲过滤逻辑。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:206; source-code/client/Code/lib/proto_game_hzmj.d.ts:5222
- **服务端职责**：下发 MsgResultHu（bao_settles 已按庄闲资格筛选）。
- **客户端职责**：客户端不做庄闲过滤，结算时直接遍历 bao_settles 并按 from_seat 挂角标；是否庄闲由服务端筛选。
- **协作边界**：客户端消费 MsgResultHu 的 bao_settles 渲染角标，不做资格判断。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:206
- **原文摘录**：`private _resolveChengBaoPage(serverSeat: number, baoSettles?: IBoxHzmjResultViewData["bao_settles"]): number { for ...`

#### `AT-ST-C12-005` 闲闲同方向最多 2 摊

- **规则说明**：两名闲家之间，同一方向的摊数上限为 2，每成立一次吃牌即加 1。
- **触发条件**：闲闲之间吃牌成立时该方向摊数 +1，至 2 封顶。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：【吃】按钮显隐由 POWER_ID_CHOW 位决定。
- **限制与禁止**：闲闲同方向摊数不得超过 2。
- **异常与边界**：上限判定在服务端；端上即便 tan_count=2 也照常显示服务端下发的【吃】。
- **验收**：客户端无本地 2 摊上限判断；吃牌权限完全跟随 MsgPower 权限位。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:552; source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:71
- **服务端职责**：下发 MsgPower / MsgTanUpdate（CHOW 权限位与摊计数均在服务端判定）。
- **客户端职责**：客户端无本地 2 摊上限判断；吃牌权限来自 MsgPower，客户端只按权限位渲染按钮。
- **协作边界**：客户端消费 MsgPower 渲染按钮、消费 MsgTanUpdate 存储摊数据，不做上限判断。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:552
- **原文摘录**：`showChi: (power & BoxMahDefine.PowerType.POWER_ID_CHOW) > 0,`

#### `AT-ST-C12-006` 满 2 摊不给【吃】

- **规则说明**：某方向已有 2 摊时，再吃这一家的牌不成立，不给【吃】权限。
- **触发条件**：闲闲同方向摊数达到 2 后，服务端对该吃牌目标不再下发 CHOW 权限位。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：已有 2 摊时不给玩家显示【吃】按钮；服务端不下发 CHOW 位时，吃按钮不显示。
- **限制与禁止**：满 2 摊后禁止再给出【吃】。
- **异常与边界**："不给出【吃】"完全依赖服务端权限位；服务端误发 CHOW 时客户端不会兜底拦截。
- **验收**：服务端不下发 CHOW 位时 KW_BTN_Chi 不显示；客户端不出现基于摊数的吃牌过滤逻辑。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:578; source-code/client/Code/layer/BoxHzmjMainView.ts:549
- **服务端职责**：下发 MsgPower（满 2 摊后不再置 CHOW 权限位）。
- **客户端职责**：客户端没有基于摊数过滤【吃】的逻辑，只按 MsgPower 的 CHOW 位显示/隐藏 KW_BTN_Chi。
- **协作边界**：客户端只消费 MsgPower 权限位渲染按钮，不做摊数兜底拦截。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:578
- **原文摘录**：`this.view.KW_Main.KW_Handler.KW_BTN_Chi.visible = powerState.showChi;`

#### `AT-ST-C12-007` 与飘财无关

- **规则说明**：摊计数与飘财互不影响，属两条独立机制。
- **触发条件**：摊更新（MsgTanUpdate）与飘更新（MsgPiao）各自独立触发。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：飘计数走 onPiaoState 播飘动作；摊更新不触发任何飘表现。
- **限制与禁止**：摊链路与飘链路互不读取对方数据。
- **异常与边界**：无。
- **验收**：MsgTanUpdate 写 GameData._tanItems、MsgPiao 写 GameData._piaoCounts，两条链路互不读取。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts:21; source-code/client/Code/data/GameData.ts:1600; source-code/client/Code/controller/cmd/gameCmd/GameTanUpdateCmd.ts:21
- **服务端职责**：分别下发 MsgPiao / MsgTanUpdate（两条独立消息链路）。
- **客户端职责**：摊与飘是两条独立链路：MsgTanUpdate 写 GameData._tanItems，MsgPiao 写 GameData._piaoCounts，互不读取。
- **协作边界**：客户端分别消费两条消息，互不联动。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts:21
- **原文摘录**：`GameData.updatePiaoState(data.seat, data.piao_count); this.dispatch(GameEventBoxHzmj.onPiaoState, data.seat, ...`

## `FP-ST-C12-003` 三摊成立与落地表现

- **主描述**：某一方向计到第 3 摊时记承包，四端播放三摊落地，可与吃牌字效同时显示，当场不出角标且提示期间不打断获权玩家。
- **范围与边界**：包含第 3 摊的触发与桌面表现；承包金额改写见后续功能点。
- **总体协作**：服务端在摊数达 3 时写承包关系并广播 MsgTanUpdate；客户端据 tan_count 触发动效。

### 原子项

#### `AT-ST-C12-008` 第 3 摊记承包

- **规则说明**：某一方向的摊数累计到第 3 摊时，记录承包关系成立。
- **触发条件**：MsgTanUpdate 下发的摊项 tan_count === 3。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：达到 3 摊时播放三摊落地 Spine（受简洁模式/复盘抑制）。
- **限制与禁止**：无。
- **异常与边界**：客户端只把 tan_count===3 当触发条件，未消费 bao_relation（0/1/2），"记承包"本身无法在端上核对；若下发的是单条增量且 tan_count 非 3，则不会触发。
- **验收**：GameTanUpdateCmd 遍历下发摊项，tan_count === 3 时派发 onSanTanLuoDi 事件。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameTanUpdateCmd.ts:24; source-code/client/Code/layer/BoxHzmjTipAniView.ts:1654
- **服务端职责**：下发 MsgTanUpdate（摊数达 3 时记承包，tan_items 中体现 tan_count=3）。
- **客户端职责**：GameTanUpdateCmd 遍历下发摊项，tan_count === 3 时派发 onSanTanLuoDi 事件触发落地动画；承包关系字段 bao_relation 在客户端未被读取使用。
- **协作边界**：客户端消费 MsgTanUpdate 按 tan_count 触发动效；承包关系记录本身由服务端完成。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameTanUpdateCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameTanUpdateCmd.ts:24
- **原文摘录**：`for (const item of data.tan_items) { if (item.tan_count === 3) { this.dispatch(GameEventBoxHzmj.onSanTanLuoDi, ...`

#### `AT-ST-C12-009` 四端播放三摊落地

- **规则说明**：第 3 摊成立时，四端都要播放「三摊落地」动效。
- **触发条件**：onSanTanLuoDi 事件触发（tan_count 达 3）。
- **配置影响**：受 GameData.simpleMode（简洁模式）与复盘模式（BoxRoomData.inst.isFupanMode()）抑制。
- **客户端交互**：模板要求三摊落地在四个座位方向都要播放；实际实现为三摊落地 Spine 在屏幕中央单点播放，非四端；simpleMode 或复盘模式直接跳过。
- **限制与禁止**：无。
- **异常与边界**：实现为中央单节点动效，与模板"四端播放"不一致；代码注释写"动画播在此座位"，但 localSeat 未参与定位，疑似遗漏。
- **验收**：三摊落地事件触发时中央节点 KW_Ani_Stld 播放 Spine 并在播完后隐藏；"四端播放"口径需确认。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:1660; source-code/client/Fgui/assets/box_hzmj_tipAni/component/HzmjTipAniComponent.xml:118
- **服务端职责**：下发 MsgTanUpdate（驱动三摊落地表现）。
- **客户端职责**：onSanTanLuoDi 计算了 localSeat（toSeat 的本地座位）但未使用，只把固定中央节点 KW_Ani_Stld 置可见并播放 spine，播完隐藏。
- **协作边界**：客户端消费 MsgTanUpdate 触发纯表现层动效，动效不参与逻辑。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjTipAniView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:1660
- **原文摘录**：`const localSeat = TableData.inst.seatToLocal(toSeat); GameData.log("三摊落地", fromSeat, toSeat, localSeat); this.view.KW_Main...`

#### `AT-ST-C12-010` 可与吃牌字效同时显示

- **规则说明**：三摊落地动效允许与吃牌字效同时显示，不互斥。
- **触发条件**：第 3 摊由吃牌达成时，三摊落地与吃牌字效同时触发。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：三摊落地可与吃牌字效同时显示，不互相顶替；KW_Ani_Stld 与 KW_Ani_CPG_0 至 KW_Ani_CPG_3 为并列节点，可同时可见。
- **限制与禁止**：两类动效禁止互相顶替或互相关闭。
- **异常与边界**：无。
- **验收**：三摊落地由 MsgTanUpdate 独立驱动，吃牌字效由 CPG 动画节点驱动，两者互不关闭。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:1662; source-code/client/Fgui/assets/box_hzmj_tipAni/component/HzmjTipAniComponent.xml:8
- **服务端职责**：下发 MsgTanUpdate / MsgChowS（两条消息分别驱动三摊落地与吃牌字效）。
- **客户端职责**：三摊落地由 MsgTanUpdate 独立驱动，吃牌字效由 CPG 动画节点驱动，两者互不关闭。
- **协作边界**：客户端分别消费两条消息驱动并列动效节点。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjTipAniView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:1662
- **原文摘录**：`this.view.KW_Main.KW_Ani_Stld.visible = true; PlaySpineAni(this.view.KW_Main.KW_Ani_Stld, "animation", () => { ...`

#### `AT-ST-C12-011` 当场不出承包角标

- **规则说明**：第 3 摊成立当场不显示承包角标，承包角标只到结算才出现。
- **触发条件**：MsgTanUpdate 到达时（桌面阶段）不刷新任何角标 UI；结算 MsgResultHu 到达时才渲染角标。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：三摊成立当场不显示承包角标，只到结算才出；桌面阶段无摊数/承包角标；结算行才出现承包或反承包角标。
- **限制与禁止**：禁止在桌面阶段展示摊数或承包角标。
- **异常与边界**：无。
- **验收**：onTanUpdate 只打日志，不刷新任何桌面 UI；承包角标 C_ChengBao 只存在于小结算 ResultItem，由 bao_settles 驱动。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:1790; source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:195
- **服务端职责**：下发 MsgTanUpdate / MsgResultHu（承包角标数据到结算阶段才由 MsgResultHu 的 bao_settles 提供）。
- **客户端职责**：onTanUpdate 只打日志，不刷新任何桌面 UI；承包角标 C_ChengBao 只存在于小结算 ResultItem，由 bao_settles 驱动。
- **协作边界**：桌面阶段客户端只存储摊数据；结算阶段才消费 bao_settles 渲染角标。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjTipAniView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:1790
- **原文摘录**：`@gf.listen(GameEventBoxHzmj.onTanUpdate) onTanUpdate(tanItems: any[]): void { if (BoxRoomData.inst.isFupanMode()) ...`

#### `AT-ST-C12-012` 提示期间不打断获权玩家

- **规则说明**：三摊落地提示播放期间，获权玩家可以继续提牌、出牌，不被打断。
- **触发条件**：三摊落地 Spine 播放期间。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：提示为纯表现层 Spine，不遮挡操作区，也不压暗按钮。
- **限制与禁止**：禁止因提示动效锁定输入或禁用操作按钮。
- **异常与边界**：客户端"不阻塞"是默认行为，没有显式放行代码；另外存在吃碰杠按钮时直接出牌会被 canPlayMahCheck 拦下要求先点"过"（BoxHzmjMainView.ts:1445-1460），若提示发生在响应窗口内，端上表现可能与"可继续出牌"不符，需确认场景。
- **验收**：三摊落地播放期间没有任何输入锁或禁用逻辑，动画结束回调只隐藏节点。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:1654
- **服务端职责**：下发 MsgTanUpdate（仅触发表现，不涉及操作权变更）。
- **客户端职责**：三摊落地播放期间没有任何输入锁或禁用逻辑，动画结束回调只隐藏节点。
- **协作边界**：客户端动效为纯表现层，不干预服务端下发的操作权。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjTipAniView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:1654
- **原文摘录**：`onSanTanLuoDi(fromSeat: number, toSeat: number): void { if (BoxRoomData.inst.isFupanMode()) return; if (GameData...`

## `FP-ST-C12-004` 自摸结算的承包与反承包

- **主描述**：自摸只结算胡牌方参与的承包对；摊方胡由对方付三家合计 S，被摊方胡由摊方付 2S，双向满 3 摊只取 2 倍不叠加。
- **范围与边界**：包含参与方筛选、承包与反承包金额口径、双向满摊优先级；不包含点炮/抢杠改写（见 FP-ST-C12-005）。
- **总体协作**：服务端判定并下发 bao_settles；客户端只做角标与流水展示，不自算金额。

### 原子项

#### `AT-ST-C12-013` 只结算胡牌方参与的承包对

- **规则说明**：自摸结算时，只结算胡牌方自己参与的承包关系对。
- **触发条件**：自摸结算 MsgResultHu 下发。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：每座位最多一个承包角标；赢家流水追加承包文案。
- **限制与禁止**：无。
- **异常与边界**：端上无"只结算胡牌方参与的对"判断，第三方之间的承包对若被下发也会照常显示。
- **验收**：客户端不筛选参与方，直接把 bao_settles 全部渲染，涉及哪些座位完全取决于服务端下发条目。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:206; source-code/client/Code/util/BoxHzmjFlowUtil.ts:427
- **服务端职责**：下发 MsgResultHu（bao_settles 仅含胡牌方参与的承包对）。
- **客户端职责**：客户端不筛选参与方，直接把 bao_settles 全部渲染，涉及哪些座位完全取决于服务端下发条目。
- **协作边界**：参与方筛选完全在服务端；客户端逐条渲染。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:206
- **原文摘录**：`for (const bao of baoSettles ?? []) { const rel = bao.relation ?? 0; if (rel !== 1 && rel !== 2) { continue; } ...`

#### `AT-ST-C12-014` 摊方胡由对方付合计

- **规则说明**：摊方（承包方）胡牌时，被承包方代付三家输分合计 S。
- **触发条件**：自摸结算且承包方向 relation=1。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：结算行显示 tip_chengbao 角标，赢家行流水文案为"承包"。
- **限制与禁止**：客户端不计算三家合计金额。
- **异常与边界**：金额与"三家合计"口径完全由服务端 score 决定，客户端无自算；好友房只有角标与流水文案，匹配场另有"三摊承包"文本（仅 isMatchRoom）。
- **验收**：结算按 BaoSettleItem.relation=1 在 from_seat（付款方）挂承包角标，金额取服务端 score，客户端无合计计算。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:212; source-code/client/Code/util/BoxHzmjFlowUtil.ts:432; source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:92
- **服务端职责**：下发 MsgResultHu（relation=1 的 bao_settles 条目，score 已含三家合计）。
- **客户端职责**：结算按 BaoSettleItem.relation=1 在 from_seat（付款方）挂承包角标，金额取服务端 score；客户端不计算合计。
- **协作边界**：客户端消费 MsgResultHu 渲染角标与流水，不自算金额。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:212
- **原文摘录**：`if (Number(bao.from_seat ?? -1) === serverSeat) { return rel; }`

#### `AT-ST-C12-015` 反承包付 2 倍

- **规则说明**：被摊方（被承包方）胡牌时，摊方按原合计的 2 倍赔付。
- **触发条件**：自摸结算且 relation=2。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：显示 tip_fanchengbao 角标与"反承包"流水文案。
- **限制与禁止**：客户端不做倍率校验。
- **异常与边界**：2 倍由服务端算好，客户端不做倍率校验。
- **验收**：relation=2 时同一 from_seat 显示反承包角标，流水文案为"反承包"，金额取服务端 score（已含 2 倍）。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:212; source-code/client/Code/util/BoxHzmjFlowUtil.ts:429; source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:17
- **服务端职责**：下发 MsgResultHu（relation=2 条目，score 已乘 2 倍）。
- **客户端职责**：relation=2 时同一 from_seat 显示反承包角标，流水文案为"反承包"，金额取服务端 score（已含 2 倍）。
- **协作边界**：倍率计算在服务端；客户端按 relation 渲染角标与流水。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:212
- **原文摘录**：`if (Number(bao.from_seat ?? -1) === serverSeat) { return rel; }`

#### `AT-ST-C12-016` 双向满 3 摊只取 2 倍

- **规则说明**：同一对玩家双向都满 3 摊时，只按倒承包（反承包）的 2 倍结算，不两笔叠加。
- **触发条件**：双向摊数均达 3 时的自摸结算。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：同一座位只出现一个角标（承包或反承包），不会同时显示两个。
- **限制与禁止**：禁止双向承包两笔叠加。
- **异常与边界**：UI 天然只显示一条关系，无法证明"优先取 2 倍"；若服务端同时下发 1 和 2，客户端按数组顺序取第一条，存在显示错误风险。
- **验收**：无本地优先级判断；结算角标为单控制器单索引，只显示首个匹配关系。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:207; source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:17
- **服务端职责**：下发 MsgResultHu（双向满摊按倒承包 2 倍口径生成条目，不两笔叠加）。
- **客户端职责**：无本地优先级判断；结算角标为单控制器单索引，只显示首个匹配关系。
- **协作边界**：优先级口径在服务端；客户端按数组顺序渲染首条。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:207
- **原文摘录**：`for (const bao of baoSettles ?? []) { const rel = bao.relation ?? 0; ... if (Number(bao.from_seat ?? -1) === serverSeat) ...`

## `FP-ST-C12-005` 点炮与抢杠的承包改写

- **主描述**：点炮只在放铳者本人是承包对方时改写，基数为原点炮分；抢杠胡不替换杠牌者赔付，承包额叠加。
- **范围与边界**：包含付款人范围与叠加口径；金额倍数计算在服务端，客户端只做展示。
- **总体协作**：服务端改写付款表并下发 bao_settles 与 win_lost；客户端按条目渲染，不按胡型分支。

### 原子项

#### `AT-ST-C12-017` 点炮只改写放铳者

- **规则说明**：点炮结算时，只有放铳者本人是承包对方（存在对应承包关系）时才改写其赔付。
- **触发条件**：点炮结算 MsgResultHu 下发。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：点炮与自摸使用同一套承包角标与流水展示。
- **限制与禁止**：无。
- **异常与边界**：端上没有任何"放铳者是否承包对方"的判断，改写范围无法在客户端验证。
- **验收**：客户端结算展示不区分自摸与点炮，统一按 bao_settles 的 from_seat 挂角标、按 win_lost 显示分数。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:195; source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:66
- **服务端职责**：下发 MsgResultHu（点炮改写后的 bao_settles 与 win_lost）。
- **客户端职责**：客户端结算展示不区分自摸与点炮，统一按 bao_settles 的 from_seat 挂角标、按 win_lost 显示分数。
- **协作边界**：改写范围判定在服务端；客户端统一渲染，不按胡型分支。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:195
- **原文摘录**：`private _updateChengBao(obj: FGUI_box_hzmj_result_ResultItem_Declare, serverSeat: number, data: IBoxHzmjResultViewData): ...`

#### `AT-ST-C12-018` 点炮基数为原点炮分

- **规则说明**：点炮改写的基数是原来那一笔点炮分，不是三家之和。
- **触发条件**：点炮结算且放铳者为承包对方时，服务端按原点炮分为基数改写。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无。
- **异常与边界**：客户端不参与金额计算，只展示服务端 score；未找到点炮基数相关的任何端上逻辑。
- **验收**：客户端仅展示服务端 score，无基数计算；点炮基数口径需以服务端实现为验收依据（待确认）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：下发 MsgResultHu（按原点炮分为基数改写后的 score）。
- **客户端职责**：待确认
- **协作边界**：基数口径完全在服务端，客户端仅展示 MsgResultHu 下发的 score，无本地判断。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C12-019` 他人承包关系不赔

- **规则说明**：别人的承包关系不产生赔付，放铳者仍按原点炮分支付。
- **触发条件**：点炮结算时存在与放铳者无关的承包关系。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：他人承包关系不得让放铳者代赔。
- **异常与边界**：客户端无"他人承包关系"过滤逻辑；付款结果完全取自 win_lost，无法在端上体现该规则。
- **验收**：付款金额与 win_lost 一致；他人承包关系不赔的口径需以服务端实现为验收依据（待确认）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：下发 MsgResultHu（按承包归属改写后的付款 win_losts，无关关系不参与）。
- **客户端职责**：待确认
- **协作边界**：客户端仅消费 win_lost 展示付款结果，无本地判断。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C12-020` 抢杠承包额叠加

- **规则说明**：抢杠胡不替换杠牌者的赔付，承包额在其基础上再叠加。
- **触发条件**：抢杠胡结算 MsgResultHu 下发。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：赢家流水同时出现番型文案与"承包/反承包"文案。
- **限制与禁止**：禁止用承包额替换杠牌者的原赔付。
- **异常与边界**：该叠加处理是流水展示口径，未针对抢杠胡单独分支；抢杠场景叠加是否正确仍取决于服务端 win_lost 与 bao_settles 的一致性。
- **验收**：流水拼装时先把承包分从赢家 win_lost 总分中剔除再生成胡分条目，随后单独追加承包流水，形成"胡分 + 承包分"叠加展示。
- **职责域**：client
- **职责依据**：source-code/client/Code/util/BoxHzmjFlowUtil.ts:373; source-code/client/Code/util/BoxHzmjFlowUtil.ts:47
- **服务端职责**：下发 MsgResultHu（抢杠叠加后的 win_lost 与 bao_settles）。
- **客户端职责**：流水拼装时先把承包分从赢家 win_lost 总分中剔除再生成胡分条目，随后单独追加承包流水，形成"胡分 + 承包分"叠加展示。
- **协作边界**：叠加金额在服务端；客户端按"胡分 + 承包分"两段流水展示。
- **来源文件**：`source-code/client/Code/util/BoxHzmjFlowUtil.ts`
- **来源定位**：source-code/client/Code/util/BoxHzmjFlowUtil.ts:373
- **原文摘录**：`const huScore = toScoreNum(data.win_losts?.find((item) => (item.seat ?? 0) === huSeat)?.score) - (baoBySeat...`

#### `AT-ST-C12-021` 杠牌者兼承包方两笔都付

- **规则说明**：杠牌者若同时是承包方，杠分与承包分两笔都要支付。
- **触发条件**：抢杠胡结算且杠牌者为承包方。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：该座位结算行只显示一个承包角标与合并后的得分。
- **限制与禁止**：无。
- **异常与边界**：两笔是否都付无法从结算行得分拆分核对，需依赖服务端明细。
- **验收**：同一座位可同时有胡分流水与承包流水；扣分总额只体现在 win_lost 一个数上，客户端不拆分。
- **职责域**：client
- **职责依据**：source-code/client/Code/util/BoxHzmjFlowUtil.ts:373; source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:152
- **服务端职责**：下发 MsgResultHu（杠牌者两笔合计后的 win_lost 与 bao_settles）。
- **客户端职责**：同一座位可同时有胡分流水与承包流水；扣分总额只体现在 win_lost 一个数上，客户端不拆分。
- **协作边界**：两笔合计口径在服务端；客户端不拆分展示。
- **来源文件**：`source-code/client/Code/util/BoxHzmjFlowUtil.ts`
- **来源定位**：source-code/client/Code/util/BoxHzmjFlowUtil.ts:373
- **原文摘录**：`const huScore = ... - (baoBySeat.get(huSeat) ?? 0);`

## `FP-ST-C12-006` 承包、反承包与链式的赔付口径

- **主描述**：承包由被吃方付 S，反承包由原承包方付 2S，链式下多条关系同时结算且赢家实收叠加。
- **范围与边界**：包含结算明细结构、承包/反承包方向与链式多条并存；不包含点炮/抢杠改写与数值示例。
- **总体协作**：全部条目由服务端生成，客户端逐条渲染角标与流水。

### 原子项

#### `AT-ST-C12-022` 承包定义与两家 0 分

- **规则说明**：承包即 A 对 B 已成立承包后 A 自摸，B 支付三家原应赔分的合计 S，另外两家本局 0 分。
- **触发条件**：承包方自摸结算。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：from_seat 行显示承包角标，赢家行流水显示"承包"金额。
- **限制与禁止**：无。
- **异常与边界**："另外两家 0 分"体现为 win_lost 为 0，客户端不校验。
- **验收**：BaoSettleItem 的 from_seat/to_seat/score 直接映射到结算行角标与赢家流水，S 由服务端给出。
- **职责域**：client
- **职责依据**：source-code/client/Code/lib/proto_game_hzmj.d.ts:5222; source-code/client/Code/util/BoxHzmjFlowUtil.ts:443
- **服务端职责**：下发 MsgResultHu（relation=1 条目与各家 win_losts，含另外两家 0 分）。
- **客户端职责**：BaoSettleItem 的 from_seat/to_seat/score 直接映射到结算行角标与赢家流水，S 由服务端给出。
- **协作边界**：客户端消费 MsgResultHu 逐条渲染，不校验 0 分。
- **来源文件**：`source-code/client/Code/lib/proto_game_hzmj.d.ts`
- **来源定位**：source-code/client/Code/lib/proto_game_hzmj.d.ts:5222
- **原文摘录**：`interface IBaoSettleItem { /** BaoSettleItem from_seat */ from_seat?: (number|null); /** BaoSettleItem to_seat */ ...`

#### `AT-ST-C12-023` 反承包定义

- **规则说明**：反承包即同一承包关系下被承包方 B 自摸，原承包方 A 支付 2 × S，S 为 B 本次自摸原应向三家应收的合计。
- **触发条件**：被承包方自摸结算。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：反承包角标与"反承包"流水文案。
- **限制与禁止**：无。
- **异常与边界**：无。
- **验收**：relation=2 映射为 tip_fanchengbao 角标与"反承包"流水，扣分数值取服务端 score。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:212; source-code/client/Code/util/BoxHzmjFlowUtil.ts:429
- **服务端职责**：下发 MsgResultHu（relation=2 条目，score 已含 2 × S）。
- **客户端职责**：relation=2 映射为 tip_fanchengbao 角标与"反承包"流水，扣分数值取服务端 score。
- **协作边界**：2 × S 计算在服务端；客户端按 relation 渲染。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:212
- **原文摘录**：`if (Number(bao.from_seat ?? -1) === serverSeat) { return rel; }`

#### `AT-ST-C12-024` 链式多条承包并存

- **规则说明**：链式即 A 对 B 成立承包、同时 C 对 A 成立承包，A 自摸时 B 付 S、C 付 2 × S，A 实收 3 × S，第四家 0 分。
- **触发条件**：链式承包关系下的胡牌方自摸结算。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：赢家流水可同时出现"承包"和"反承包"两行，付款两家各挂对应角标。
- **限制与禁止**：无。
- **异常与边界**：若同一座位同时是某关系的 from_seat 与另一关系的 to_seat，角标只显示一条（单控制器），需确认是否会出现该组合。
- **验收**：流水对 bao_settles 每条关系都生成一条记录并挂到赢家（优先 to_seat，缺省挂所有赢家），多条可同时存在；角标按 from_seat 各自显示。
- **职责域**：client
- **职责依据**：source-code/client/Code/util/BoxHzmjFlowUtil.ts:434; source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:212
- **服务端职责**：下发 MsgResultHu（链式多条 bao_settles 条目并存）。
- **客户端职责**：流水对 bao_settles 每条关系都生成一条记录并挂到赢家（优先 to_seat，缺省挂所有赢家），多条可同时存在；角标按 from_seat 各自显示。
- **协作边界**：多条关系并存由服务端下发；客户端逐条渲染。
- **来源文件**：`source-code/client/Code/util/BoxHzmjFlowUtil.ts`
- **来源定位**：source-code/client/Code/util/BoxHzmjFlowUtil.ts:434
- **原文摘录**：`const rawTo = bao.to_seat; const targetSeats: number[] = []; if (rawTo != null && huSeats.has(Number(rawTo))) ...`

## `FP-ST-C12-007` 结算数值示例

- **主描述**：模板给出的两组数值示例，用于校验承包/反承包金额口径。
- **范围与边界**：仅为验收用例，不引入新规则。
- **总体协作**：客户端不参与计算，示例只能作为服务端验收依据。

### 原子项

#### `AT-ST-C12-025` 示例：庄家自摸承包 24 与链式 48

- **规则说明**：庄家平胡自摸、三名闲家各应赔 8 时 S = 24，承包方付 24；若同时存在上家对庄家的承包，上家再付 48，庄家得 72。
- **触发条件**：验收用例，非运行时触发条件。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无。
- **异常与边界**：客户端无对应计算或校验代码，金额全部来自服务端；未找到端上示例用例（BoxHzmjTestView 的"三摊"按钮为测试造数入口，不含金额校验）。
- **验收**：本示例作为服务端结算数值验收依据：服务端按该场景下发 score=24 / 48、庄家 win_lost=72 时，客户端 UI 原样显示。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：下发 MsgResultHu（示例场景对应的 score 与 win_losts 数值）。
- **客户端职责**：待确认
- **协作边界**：客户端仅展示服务端 MsgResultHu 下发的数值，无本地判断。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C12-026` 示例：反承包付 20

- **规则说明**：庄家对闲家成立承包、闲家平胡自摸且三家原应赔 8、1、1 时，庄家按反承包付 20。
- **触发条件**：验收用例，非运行时触发条件。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无。
- **异常与边界**：客户端不计算 2×S，无法在端上复现该数值；服务端若下发 20，UI 原样显示。
- **验收**：本示例作为服务端结算数值验收依据：服务端下发反承包 score=20 时，客户端 UI 原样显示 20。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：下发 MsgResultHu（反承包 score=20 条目）。
- **客户端职责**：待确认
- **协作边界**：客户端仅展示服务端 MsgResultHu 下发的数值，无本地判断。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无
