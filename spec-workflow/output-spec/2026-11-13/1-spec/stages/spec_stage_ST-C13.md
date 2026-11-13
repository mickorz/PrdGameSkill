# 算分

> 阶段 ID：`ST-C13`。来源：模板「算分」章节。客户端视角规格，客户端逻辑与 UI 交互以 Code/Fgui 代码证据支撑。

## 0. 阶段

- **阶段 ID**：`ST-C13`
- **阶段**：算分
- **来源章节**：算分
- **涉及协议消息**：MsgResultHu、MsgStartGame、MsgVsPlayerInfo、MsgJuData、MsgPower、MsgTanUpdate、MsgPlayerScore、MsgRelinkOnResult
- **涉及 UI 模块**：box_hzmj_tingPai、PackageBoxHzmjView.PackageBoxHzmjResult（结算 win/lose 字效）
- **阶段概述**：规定杭州麻将好友房单局原应赔分的底分、番型倍数、庄闲倍数三个因子，以及自摸/点炮抢杠/承包/黄庄的赔付分账和本场积分累计口径。

## 术语与单位（有则填）

| 术语 | 定义 | 单位/量纲 | 作用域 | 来源 |
| --- | --- | --- | --- | --- |
| 原应赔分 | 底分 × 番型倍数 × 这一笔的庄闲倍数，是单笔赔付的基数。 | 分 | 单笔赔付基数 | 模板 算分 第152行 |
| 底分 | 固定为 1，作为原应赔分的乘数。 | 分（固定值 1） | 单笔赔付乘数 | 模板 算分 第152行 |
| 庄闲倍数 | 赢家与这一笔的赔付者有一方是庄家时为 8，两边都是闲家时为 1。 | 倍（8 或 1） | 单笔赔付乘数 | 模板 算分 第152行 |
| 番型倍数 | 三组番型连乘后的结果；杠飘、飘杠的 8 倍替换杠上开花和财飘后再乘基础番。 | 倍 | 单笔赔付乘数 | 模板 算分 第152行 |
| 承包 | 庄家与闲家之间某一方向有效摊达到成立条件后，承包方在自摸结算时代赔。 | 结算关系（金额为分） | 单局结算改写 | 模板 名词 第15行 |
| 反承包 | 同一关系下原被承包方自摸时，原承包方按加倍规则赔付。 | 结算关系（金额为分） | 单局结算改写 | 模板 名词 第15行 |
| 黄庄 | 流局黄庄，本局四家都是 0 分。 | 分（本局为 0） | 单局结算 | 模板 算分 第157行 |
| 本场积分 | 从 0 起，每小局加上实际净得分，赢家加实收、赔付者扣实付。 | 分 | 本场跨局累计 | 模板 算分 第161行 |

## 跨切面行为（无原子也列）

- **三摊承包关系增量广播**：三摊承包关系由 MsgTanUpdate 增量广播，tan_count 达到 3 时客户端播放「三摊落地」动画，可与吃牌字效同时播放，结算前不出承包角标 —— 跨切面（协议 MsgTanUpdate；客户端承包结算消费见 source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:66）
- **结算飘分与结算面板解耦**：胡牌番型动画完成回调后才逐座位播放飘分，结算面板固定延迟 3 秒打开，不依赖飘分回调 —— 跨切面（source-code/client/Code/layer/BoxHzmjTipAniView.ts:701）
- **正负分位图字效区分**：正负分用不同位图字效表达（fnt_win/fnt_lose、结算 win/lose），0 分座位不生成飘分节点但仍显示结算行 —— 跨切面（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:366；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:206）
- **重连与复盘数据直写**：重连与复盘走 justUpdateData 分支，只写数据缓存不触发界面动画；累计分需 MsgRelinkOnResult/MsgPlayerScore 覆盖同步 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GamePlayerScoreCmd.ts:31；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:223）
- **承包结算明细仅展示不校验**：摊/承包结算明细随 MsgResultHu.bao_settles 下发，客户端仅在结算行角标与流水文案消费，不做数值校验 —— 跨切面（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:196；source-code/client/Code/util/BoxHzmjFlowUtil.ts:456）

## `FP-ST-C13-001` 原应赔分与庄闲倍数

- **主描述**：定义单笔原应赔分的三个乘数因子：底分固定 1、番型倍数、庄闲倍数（一方为庄 8 倍，双闲 1 倍），并声明本玩法无封顶。
- **范围与边界**：含底分、庄闲倍数取值与无封顶；不含番型倍数的构成（见 FP-ST-C13-002）。
- **总体协作**：服务端负责换算并只下发最终 win_losts；客户端展示底分牌、庄家档位和听牌倍数，不参与乘算。

### 原子项

#### `AT-ST-C13-001` 原应赔分公式

- **规则说明**：原应赔分 = 底分 × 番型倍数 × 这一笔的庄闲倍数，是单笔赔付的基数。
- **触发条件**：单局结算发生任一赔付笔（自摸/点炮/抢杠）时计算该笔原应赔分；客户端视角为 MsgResultHu 到达后按 win_losts 写桌面分。
- **配置影响**：底分固定为 1（模板口径），本原子项无独立配置。
- **客户端交互**：结算行 KW_Score 显示服务端下发的 ±分数，正分用 win 字效、负分用 lose 字效；桌面按座位逐个弹飘分。
- **限制与禁止**：客户端不做底分 × 番型 × 庄闲的乘算，单局得失分以服务端 win_losts 下发为准。
- **异常与边界**：听牌收益预估仅用 totalScore += cnt × baseScore × fan 近似底分乘番型，不含庄闲倍数，仅作预估展示。
- **验收**：结算时各座位显示分数与服务端 MsgResultHu.win_losts[].score 完全一致；正分带正号并使用 win 字效，负分使用 lose 字效，桌面按座位逐个弹飘分。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:209；source-code/client/Code/data/GameData.ts:480；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:365
- **服务端职责**：下发 MsgResultHu，含各座位换算后的 win_losts[].score 与番型明细。
- **客户端职责**：客户端不计算原应赔分：单局得失分直接取 MsgResultHu.win_losts[].score，GameResultHuCmd 将其按本地座位写入桌面飘分数据；仅在听牌收益预估中用 totalScore += cnt × baseScore × fan 近似底分乘番型。
- **协作边界**：客户端消费服务端 win_losts 分值并展示；本地仅在听牌预估中近似计算（不含庄闲倍数），不承担赔付乘算。
- **来源文件**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:198
- **原文摘录**：`private _updateTableScore(data: proto.game_hzmj.MsgResultHu): void {`

#### `AT-ST-C13-002` 底分为1

- **规则说明**：底分固定为 1，作为原应赔分的乘数因子。
- **触发条件**：听牌收益预估计算时；MsgStartGame/MsgVsPlayerInfo 下发 base_score 用于底分牌展示时。
- **配置影响**：结算底分取自 MsgStartGame.base_score（仅比赛场写入 TableData）与 MsgVsPlayerInfo.base_score；听牌预估将底分硬编码为 1。
- **客户端交互**：底分牌 KW_BASE_SCORE 显示「底分:1」。
- **限制与禁止**：客户端不参与结算底分换算，结算分值由服务端算好后下发。
- **异常与边界**：底分 1 只在听牌预估与底分牌展示中可见。
- **验收**：底分牌显示「底分:1」；听牌收益预估按底分 1 计算。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameStartGameCmd.ts:34；source-code/client/Code/layer/BoxHzmjBackView.ts:87
- **服务端职责**：下发 MsgStartGame.base_score 与 MsgVsPlayerInfo.base_score。
- **客户端职责**：听牌收益预估把底分硬编码为 1；结算底分则取自 MsgStartGame.base_score（仅比赛场写入 TableData）与 MsgVsPlayerInfo.base_score，用于底分牌展示。
- **协作边界**：客户端消费 base_score 字段做底分牌展示；结算乘算在服务端。
- **来源文件**：source-code/client/Code/data/GameData.ts
- **来源定位**：source-code/client/Code/data/GameData.ts:463
- **原文摘录**：`const baseScore = 1;`

#### `AT-ST-C13-003` 一方为庄则庄闲倍数8

- **规则说明**：赢家和这一笔的赔付者有一方是庄家时，庄闲倍数为 8。
- **触发条件**：结算笔涉及庄家（庄家赢或庄家赔付）时该笔乘 8；客户端视角为 MsgJuData/MsgResultHu 携带 banker_level 时更新庄家档位展示。
- **配置影响**：庄家档位取 MsgJuData.banker_level/MsgResultHu.banker_level，仅用于界面标识与番型流水展示。
- **客户端交互**：结算行 C_IsBank 按连庄档位显示庄/庄×2/庄×3 角标；胡按钮按服务端 hu_point 显示「N倍」。
- **限制与禁止**：客户端不做庄闲 8 倍换算，无 8 倍字面量或乘算逻辑。
- **异常与边界**：8 倍只体现为服务端 win_losts.score 的数值。
- **验收**：涉及庄家的结算笔分值为服务端换算后结果；结算行庄家角标按连庄档位正确显示，胡按钮倍数与 hu_point 一致。
- **职责域**：client
- **职责依据**：source-code/client/Code/interface/BoxHzmjResultTypes.ts:12；source-code/client/Code/layer/BoxHzmjMainView.ts:666
- **服务端职责**：下发 MsgJuData/MsgResultHu 的 banker_level 与 MsgPower.hu_point。
- **客户端职责**：客户端接收庄家座位与牢庄档位（MsgJuData.banker_level、MsgResultHu.banker_level），仅用于界面标识与番型流水展示，不做庄闲 8 倍换算。
- **协作边界**：客户端消费庄家档位做角标与倍数展示；庄闲倍数换算在服务端。
- **来源文件**：source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts:34
- **原文摘录**：`GameData.setLianZhuangCount(data.banker_level);`

#### `AT-ST-C13-004` 双闲庄闲倍数1

- **规则说明**：赢家与这一笔的赔付者两边都是闲家时，庄闲倍数为 1。
- **触发条件**：赔付双方均为闲家的结算笔。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无。
- **异常与边界**：无。
- **验收**：双闲结算笔分值以服务端 win_losts 下发为准（客户端视角无本地倍数逻辑可验收，待确认）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认
- **协作边界**：客户端不区分庄闲倍率，未找到闲闲 1 倍的任何实现或展示；分值以服务端下发为准。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C13-005` 无封顶

- **规则说明**：本玩法无封顶，分值不设上限。
- **触发条件**：听牌面板打开且房间规则 max_mult 为 0 或 -1 时判定为无封顶。
- **配置影响**：听牌面板按房间 max_mult 判定封顶：max_mult 为 0 或 -1 时标为无封顶且不对每张听牌倍数做钳制，仅 max_mult > 0 时按封顶值取小。
- **客户端交互**：听牌面板 KW_FengDing 文本显示「无封顶」；听牌倍数原样显示、不被截断。
- **限制与禁止**：无封顶时不钳制听牌倍数展示；结算侧以服务端 win_losts 为准，客户端无二次封顶。
- **异常与边界**：max_mult > 0 的房间按封顶值取小（有封顶房间的边界行为）。
- **验收**：无封顶房间听牌面板显示「无封顶」且各听牌倍数不被截断。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTingPaiView.ts:96；source-code/client/Code/layer/BoxHzmjTingPaiView.ts:138；source-code/client/Fgui/assets/box_hzmj_tingPai/component/TingPai.xml:10
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：听牌面板按房间 max_mult 判定封顶：max_mult 为 0 或 -1 时标为无封顶且不对每张听牌倍数做钳制，仅 max_mult > 0 时按封顶值取小。
- **协作边界**：客户端读本地房间规则 max_mult 做听牌面板封顶展示；结算分值以服务端下发为准。
- **来源文件**：source-code/client/Code/layer/BoxHzmjTingPaiView.ts
- **来源定位**：source-code/client/Code/layer/BoxHzmjTingPaiView.ts:95
- **原文摘录**：`if (roomMaxFan === 0 || roomMaxFan === -1) {`

## `FP-ST-C13-002` 番型倍数

- **主描述**：规定番型倍数由三组番型连乘得出，并说明杠飘、飘杠的 8 倍已替换杠上开花与财飘再乘基础番。
- **范围与边界**：含番型倍数的取法与杠飘飘杠的组合口径；不含具体番型判定与听牌提示。
- **总体协作**：服务端下发 fan_ids/fan_details/fan_point；客户端仅作番型名称、倍数与组合动效展示。

### 原子项

#### `AT-ST-C13-006` 番型倍数三组连乘

- **规则说明**：番型倍数取三组番型连乘后的结果。
- **触发条件**：胡牌结算 MsgResultHu 携带 fan_ids/fan_details/fan_point 时。
- **配置影响**：FanDefine 配置番型分三组互斥（基础/七对组、杠开组、财神组）的口径。
- **客户端交互**：胡牌字效按番型播放，流水标题拼接番型名与得分（如「平胡，+9分」）。
- **限制与禁止**：客户端不自行连乘三组番型，总倍数来自协议 fan_point/fan_details.mult。
- **异常与边界**：无。
- **验收**：胡牌流水与字效显示的番型名、倍数、得分与服务端 fan_ids/fan_point 一致。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:120；source-code/client/Code/util/BoxHzmjFlowUtil.ts:315
- **服务端职责**：下发 MsgResultHu 的 fan_ids/fan_details/fan_point（服务端已算好的总倍数）。
- **客户端职责**：客户端在 FanDefine 中记录番型分三组互斥、最终倍数取三组最高档连乘的口径，并缓存 MsgResultHu.fan_details[].mult（服务端已算好的倍数）用于展示。
- **协作边界**：客户端消费 fan_point/fan_details 做番型名称与倍数展示；三组连乘计算在服务端。
- **来源文件**：source-code/client/Code/config/FanDefine.ts
- **来源定位**：source-code/client/Code/config/FanDefine.ts:12
- **原文摘录**：`// 分3组互斥：基础/七对组、杠开组、财神组，最终倍数 = 三组最高档连乘`

#### `AT-ST-C13-007` 杠飘飘杠八倍替换基础番

- **规则说明**：杠飘、飘杠的 8 倍已经替换掉杠上开花和财飘，再乘基础番。
- **触发条件**：胡牌番型含杠飘(2419)/飘杠(2420)组合时解析组合动效与文案。
- **配置影响**：FanDefine 把杠飘(2419)、飘杠(2420)登记为独立番型并注明 8x。
- **客户端交互**：播放杠飘/飘杠专属组合字效与音效，流水文案显示「杠飘」「飘杠」。
- **限制与禁止**：客户端不校验替换关系，8 倍数值仅体现为番型注释与展示口径。
- **异常与边界**：组合动效解析优先直接命中组合 ID（2419/2420），否则按杠开系 × 财飘系拆分命中。
- **验收**：番型为杠飘/飘杠时显示对应组合字效与流水文案，倍数与分值取服务端下发。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:53；source-code/client/Code/config/FanDefine.ts:235；source-code/client/Code/config/FanDefine.ts:256
- **服务端职责**：下发 MsgResultHu 的番型明细与倍数（含杠飘/飘杠替换口径后的结果）。
- **客户端职责**：FanDefine 把杠飘(2419)、飘杠(2420)登记为独立番型并注明 8x；组合动效解析优先直接命中组合 ID，否则按杠开系 × 财飘系拆分，作为替换杠上开花与财飘的表现口径。
- **协作边界**：客户端消费番型 ID 做组合动效与文案；替换关系与倍数计算在服务端。
- **来源文件**：source-code/client/Code/config/FanDefine.ts
- **来源定位**：source-code/client/Code/config/FanDefine.ts:51
- **原文摘录**：`/** 杠飘：先杠后飘（杠开后打出财神并下一轮自摸），8x */`

## `FP-ST-C13-003` 自摸赔付构成

- **主描述**：规定自摸时三家各算一笔，并按庄家/闲家身份分别乘 8 或 1；无承包时各付各的、赢家收合计。
- **范围与边界**：含自摸三笔拆分、庄家自摸与闲家自摸的倍数分配、无承包时的收款方式；不含承包改写（见 FP-ST-C13-005）。
- **总体协作**：服务端下发三笔结果，客户端按座位展示飘分与自摸流水。

### 原子项

#### `AT-ST-C13-008` 自摸三家各算一笔

- **规则说明**：自摸时三家各算一笔赔付。
- **触发条件**：自摸胡牌结算 MsgResultHu 到达、win_losts 逐座位写入桌面分时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：胡牌番型动画结束后逐座位播放飘分，三家分别弹分。
- **限制与禁止**：客户端不自拆自摸付款，只消费服务端下发的三笔结果。
- **异常与边界**：无。
- **验收**：自摸结算三家各显示一笔分值，流水用 K_LT_ZI_MO/K_LT_BEI_ZI_MO 成对展示三家各自的一笔。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:199；source-code/client/Code/layer/BoxHzmjTipAniView.ts:701
- **服务端职责**：下发 MsgResultHu 的三笔 win_losts。
- **客户端职责**：结算按 win_losts 逐座位写入桌面分，自摸流水使用 K_LT_ZI_MO/K_LT_BEI_ZI_MO 成对展示三家各自的一笔赔付。
- **协作边界**：三笔拆分在服务端；客户端逐座位消费展示。
- **来源文件**：source-code/client/Code/util/BoxHzmjFlowUtil.ts
- **来源定位**：source-code/client/Code/util/BoxHzmjFlowUtil.ts:118
- **原文摘录**：`appendMainHuFlow(ret, mySeat, flowItems, data, ResultLiuShuiType.K_LT_ZI_MO, ResultLiuShuiType.K_LT_BEI_ZI_MO);`

#### `AT-ST-C13-009` 庄家自摸三笔乘8

- **规则说明**：庄家自摸时，三笔都乘 8。
- **触发条件**：庄家自摸结算时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无。
- **异常与边界**：无。
- **验收**：庄家自摸三笔金额以服务端 win_losts 下发为准（客户端视角无本地换算可验收，待确认）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认
- **协作边界**：未找到客户端对庄家自摸三笔乘 8 的换算逻辑，具体金额由服务端算入 win_losts。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C13-010` 闲家自摸庄家那笔乘8

- **规则说明**：闲家自摸时，庄家那一笔乘 8。
- **触发条件**：闲家自摸结算中庄家赔付笔。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无。
- **异常与边界**：无。
- **验收**：闲家自摸时庄家赔付笔金额以服务端 win_losts 下发为准（待确认）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认
- **协作边界**：客户端无按付款方是否为庄家区分倍数的实现。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C13-011` 闲家自摸另两闲各乘1

- **规则说明**：闲家自摸时，另两名闲家各乘 1。
- **触发条件**：闲家自摸结算中另两名闲家赔付笔。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无。
- **异常与边界**：无。
- **验收**：闲家自摸时另两名闲家赔付金额以服务端 win_losts 下发为准（待确认）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认
- **协作边界**：客户端不计算闲闲赔付倍数。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C13-012` 无承包各付各的赢家收合计

- **规则说明**：没有承包时，各付各的，赢家收合计。
- **触发条件**：自摸结算且无承包关系（bao_settles 为空）时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：飘分与流水逐座位展示，赢家结算行显示最终合计分。
- **限制与禁止**：赢家合计不由客户端求和，直接取服务端 win_losts.score。
- **异常与边界**：赢家流水分数用「win_losts 分数 − bao_settles 汇总」倒推主胡部分。
- **验收**：无承包自摸时各座位分值与服务端 win_losts 一致，赢家结算行显示最终合计分。
- **职责域**：client
- **职责依据**：source-code/client/Code/util/BoxHzmjFlowUtil.ts:360；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:152
- **服务端职责**：下发 MsgResultHu 各座位 win_losts 与 bao_settles。
- **客户端职责**：结算按 win_losts 逐座位展示各自应付，赢家流水分数用「win_losts 分数 − bao_settles 汇总」倒推主胡部分，合计由服务端给出。
- **协作边界**：客户端逐座位消费展示；各笔求和与合计在服务端。
- **来源文件**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:209
- **原文摘录**：`GameData.setTableScore(localSeat, {`

## `FP-ST-C13-004` 点炮与抢杠赔付

- **主描述**：规定点炮胡、抢杠胡在无承包时只算赢家与赔付者一笔并按庄闲 8 倍，另两家 0 分；有承包时按承包规则改写。
- **范围与边界**：含单笔赔付范围、庄闲倍数、另两家 0 分与承包改写入口；不含承包改写公式本身（见 FP-ST-C13-005）。
- **总体协作**：客户端以 hu_type 区分胡型并展示点炮流水与动画，金额取服务端结果。

### 原子项

#### `AT-ST-C13-013` 点炮抢杠只算一笔

- **规则说明**：点炮胡、抢杠胡在无承包时只算赢家和赔付者一笔。
- **触发条件**：结算 hu_type 为 HT_DISCARD（点炮）/HT_ROBKONG（抢杠）时识别炮胡并生成流水。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：点炮、抢杠播放点炮动画；结算行赢家标「点炮」，放铳者行显示负分。
- **限制与禁止**：客户端没有单独的抢杠按钮，抢杠按点炮口径展示与结算。
- **异常与边界**：HT_DIAN_GANG_HUA（点杠花）也纳入炮胡口径识别。
- **验收**：点炮/抢杠流水只生成赢家与放铳者成对一条（K_LT_DIAN_PAO/K_LT_FANG_PAO 或 K_LT_QIANG_GANG/K_LT_BEI_QIANG_GANG），另两家无赔付流水。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:339；source-code/client/Code/util/BoxHzmjFlowUtil.ts:120；source-code/client/Code/util/BoxHzmjFlowUtil.ts:237
- **服务端职责**：下发 MsgResultHu（hu_type、点炮来源 df_from、win_losts）。
- **客户端职责**：用 hu_type=HT_DISCARD/HT_ROBKONG 识别炮胡并记录点炮来源 df_from，流水只生成赢家（K_LT_DIAN_PAO/K_LT_QIANG_GANG）与放铳者（K_LT_FANG_PAO/K_LT_BEI_QIANG_GANG）成对的一条。
- **协作边界**：单笔拆分在服务端；客户端按 hu_type 识别并展示。
- **来源文件**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:338
- **原文摘录**：`private _isPaoHuType(huType: number): boolean {`

#### `AT-ST-C13-014` 点炮抢杠按庄闲8倍

- **规则说明**：点炮胡、抢杠胡的这一笔按庄闲 8 倍。
- **触发条件**：点炮/抢杠结算笔涉及庄家时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无。
- **异常与边界**：无。
- **验收**：点炮/抢杠单笔金额以服务端 win_losts 下发为准（待确认）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认
- **协作边界**：客户端无点炮单笔乘 8 的实现，金额直接取 win_losts.score。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C13-015` 点炮抢杠另两家0分

- **规则说明**：点炮胡、抢杠胡结算时另两家 0 分。
- **触发条件**：点炮/抢杠结算中非赢家非赔付者的座位分值为 0 时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：另两家不弹飘分，结算行分数显示 0（不加正号）。
- **限制与禁止**：客户端无本地置零逻辑，0 分由服务端下发。
- **异常与边界**：score 为 0 的座位不写入桌面飘分数据（直接跳过），结算行仍按 win_lost 逐座显示。
- **验收**：点炮/抢杠结算中另两家结算行显示 0 且无飘分节点。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:365
- **服务端职责**：下发 MsgResultHu 全四家 win_losts（另两家为 0）。
- **客户端职责**：score 为 0 的座位不写入桌面飘分数据（直接跳过），结算行仍按 win_lost 逐座显示，另两家分数为 0。
- **协作边界**：0 分值由服务端下发；客户端仅做展示跳过。
- **来源文件**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:206
- **原文摘录**：`if (score === 0) continue;`

#### `AT-ST-C13-016` 有承包按上一节改写

- **规则说明**：点炮胡、抢杠胡有承包时按承包规则改写赔付。
- **触发条件**：结算存在承包关系（bao_settles 非空）时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：结算行显示承包或反承包角标，流水中出现「承包」「反承包」条目，桌面另有「三摊承包」提示。
- **限制与禁止**：改写公式在服务端，客户端仅展示承包关系与金额。
- **异常与边界**：无。
- **验收**：存在承包时结算行按 from_seat 打 C_ChengBao 角标（承包/反承包），流水追加承包/反承包条目。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:196；source-code/client/Code/util/BoxHzmjFlowUtil.ts:432
- **服务端职责**：下发 MsgResultHu.bao_settles 与 MsgTanUpdate 承包关系。
- **客户端职责**：客户端消费 MsgResultHu.bao_settles，结算行按 from_seat 打 C_ChengBao 角标（承包/反承包），流水追加「承包/反承包」并从赢家分中扣除承包额还原主胡分。
- **协作边界**：改写计算在服务端；客户端消费 bao_settles 做角标与流水展示。
- **来源文件**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:66
- **原文摘录**：`baoSettles: data.bao_settles ?? [],`

## `FP-ST-C13-005` 承包改写

- **主描述**：规定承包自摸先按三家原应赔分求和得到 S，再按三摊承包一节的规则改写实际赔付。
- **范围与边界**：含 S 的求和口径与改写出口；不含承包成立条件与摊计数（见三摊承包章节）。
- **总体协作**：服务端计算 S 与最终赔付并下发 bao_settles；客户端只展示承包/反承包金额。

### 原子项

#### `AT-ST-C13-017` 承包自摸先求三笔合计S

- **规则说明**：承包时自摸先算出三笔再求和为 S。
- **触发条件**：承包关系下的自摸结算时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无。
- **异常与边界**：无。
- **验收**：S 的求和以服务端计算为准，客户端无本地求和逻辑可验收（待确认）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认
- **协作边界**：未找到客户端对自摸三笔求和 S 的实现，S 由服务端计算后体现在 bao_settles.score。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C13-018` 承包改写出实际赔付

- **规则说明**：求和得到 S 后按承包规则改写出实际赔付。
- **触发条件**：承包关系下的自摸结算改写、bao_settles 到达时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：结算行承包角标与流水「承包/反承包」金额按服务端分数展示。
- **限制与禁止**：客户端不做 1 倍/2 倍规则校验。
- **异常与边界**：无法从客户端反推承包公式是否正确（S 与 2×S 的数值关系未校验）。
- **验收**：承包结算金额与 bao_settles[].score 一致，结算行角标与流水正确显示承包/反承包。
- **职责域**：client
- **职责依据**：source-code/client/Code/util/BoxHzmjFlowUtil.ts:456；source-code/client/Code/lib/proto_game_hzmj.d.ts:5564
- **服务端职责**：下发 MsgResultHu.bao_settles（承包进出分明细）。
- **客户端职责**：实际赔付额取自 bao_settles[].score，客户端用 from_seat/to_seat 汇总承包进出分、从赢家 win_lost 中扣除承包额以还原主胡分，不做 1 倍/2 倍规则校验。
- **协作边界**：S 求和与改写规则在服务端；客户端仅按座位汇总展示承包金额。
- **来源文件**：source-code/client/Code/util/BoxHzmjFlowUtil.ts
- **来源定位**：source-code/client/Code/util/BoxHzmjFlowUtil.ts:427
- **原文摘录**：`for (const bao of data.bao_settles ?? []) {`

## `FP-ST-C13-006` 黄庄结算

- **主描述**：规定黄庄（流局）时四家本局得分均为 0。
- **范围与边界**：仅本局四家 0 分；不含流局判定时机与连庄处理。
- **总体协作**：服务端以 end_type=ET_DRAWN 下发全 0 win_losts；客户端走流局展示分支，无流水、无飘分。

### 原子项

#### `AT-ST-C13-019` 黄庄四家0分

- **规则说明**：黄庄（流局）时四家本局都是 0 分。
- **触发条件**：结算 end_type=ET_DRAWN（流局）时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：流局不展示流水与飘分，结算行分数均显示 0，桌面背景走失败态。
- **限制与禁止**：客户端无本地清零计算，四家 0 分依赖服务端 win_losts 全 0。
- **异常与边界**：若服务端漏发 0 分项，界面会缺行；自己行按流局算输（selfWinLost=2）。
- **验收**：流局结算四家分数均为 0，无流水项与飘分节点，桌面走失败态背景。
- **职责域**：client
- **职责依据**：source-code/client/Code/util/BoxHzmjResultUtil.ts:37；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:206
- **服务端职责**：下发 MsgResultHu（end_type=ET_DRAWN、全 0 win_losts）。
- **客户端职责**：end_type=ET_DRAWN 时不生成任何流水项，自己行按流局算输（selfWinLost=2）；四家 0 分依赖服务端 win_losts 全 0，且 score 为 0 的座位不写入桌面飘分数据。
- **协作边界**：流局判定与全 0 分值在服务端；客户端走流局展示分支（无流水、无飘分）。
- **来源文件**：source-code/client/Code/util/BoxHzmjFlowUtil.ts
- **来源定位**：source-code/client/Code/util/BoxHzmjFlowUtil.ts:29
- **原文摘录**：`if ((data.end_type ?? 0) === EndType.ET_DRAWN) {`

## `FP-ST-C13-007` 算分示例校验

- **主描述**：用两个示例固定期望值：闲家 2 倍番型自摸（16/2/2/20）与平胡点炮（+8/−8/0/0），用于验证算分口径。
- **范围与边界**：仅两个示例的数值校验；不含实现逻辑。
- **总体协作**：属规格校验用途，客户端无对应断言或测试数据。

### 原子项

#### `AT-ST-C13-020` 示例闲家2倍自摸20分

- **规则说明**：闲家以 2 倍番型自摸：庄家付 16，两名闲家各付 2，赢家得 20。
- **触发条件**：算分口径校验场景（闲家 2 倍番型自摸）。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无。
- **异常与边界**：BoxHzmjTestView 的结算模拟数据为 −64/64，与示例不一致。
- **验收**：闲家 2 倍番型自摸时期望庄家 −16、另两名闲家各 −2、赢家 +20（服务端口径校验；客户端无断言，待确认）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认
- **协作边界**：客户端无该示例的校验或期望值。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C13-021` 示例平胡点炮8分

- **规则说明**：平胡点炮：赢家 +8，放铳者 −8，另两家 0。
- **触发条件**：算分口径校验场景（平胡点炮）。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无。
- **异常与边界**：客户端仅把平胡作为 2401 番型参与展示。
- **验收**：平胡点炮期望赢家 +8、放铳者 −8、另两家 0（客户端无断言，待确认）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认
- **协作边界**：未见 +8/−8 的示例校验。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

## `FP-ST-C13-008` 本场积分累计

- **主描述**：规定本场积分从 0 起，每小局累加实际净得分，赢家加实收、赔付者扣实付。
- **范围与边界**：含累计起点与按实际净得分累加的方向；不含大局结束条件。
- **总体协作**：累计由服务端计算，客户端用 player_score.scores/MsgPlayerScore 覆盖同步并在头像与大结算展示。

### 原子项

#### `AT-ST-C13-022` 本场积分从0起累加

- **规则说明**：本场积分从 0 起，每小局加上实际净得分。
- **触发条件**：每小局结算 MsgResultHu.player_score.scores 或 MsgPlayerScore 到达时覆盖同步累计分。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：桌面头像分数经 onUpdateScore 刷新；大结算展示各玩家本场总分。
- **限制与禁止**：客户端不做本地累加，采用覆盖式同步。
- **异常与边界**：断线重连需依赖 MsgRelinkOnResult 补发当前累计分。
- **验收**：每小局结算后头像分数与 MsgResultHu.player_score.scores 一致；大结算总分与 user_results.score 一致。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePlayerScoreCmd.ts:31；source-code/client/Code/controller/cmd/helperCmd/TotalResultCmd.ts:33；source-code/client/Code/layer/BoxHzmjPlayerView.ts:514
- **服务端职责**：下发 MsgResultHu.player_score.scores 与 MsgPlayerScore 覆盖同步累计分。
- **客户端职责**：每小局结算后用 MsgResultHu.player_score.scores 覆盖写 player.sr，MsgPlayerScore 同样整体覆盖，客户端不做本地累加；大结算按 user_results.score 汇总本场总分。
- **协作边界**：累计语义由服务端保证，客户端覆盖式同步并展示。
- **来源文件**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:223
- **原文摘录**：`if (data.player_score?.scores) {`

#### `AT-ST-C13-023` 赢家加实收

- **规则说明**：赢家本场积分加上实际收到的分数。
- **触发条件**：赢家小局结算后累计分与单局分刷新时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：赢家分数用 win 字效显示带正号数值。
- **限制与禁止**：客户端不单独做加法。
- **异常与边界**：无。
- **验收**：赢家单局分值与累计分均与服务端下发值一致。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:366
- **服务端职责**：下发 MsgResultHu/MsgPlayerScore 的赢家分值与累计分。
- **客户端职责**：赢家本场累计分与单局实收均取服务端下发值，客户端不单独做加法，仅以 win_losts.score 与 player.sr 展示。
- **协作边界**：加实收计算在服务端；客户端仅展示。
- **来源文件**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:229
- **原文摘录**：`player.sr = score;`

#### `AT-ST-C13-024` 赔付者扣实付

- **规则说明**：赔付者本场积分扣除实际付出的分数。
- **触发条件**：赔付者小局结算后累计分与单局负分刷新时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：赔付者行显示负分并使用 lose 字效，桌面飘分显示负数。
- **限制与禁止**：客户端不做扣减运算，不校验本局净和是否为 0。
- **异常与边界**：无。
- **验收**：赔付者单局负分与累计分与服务端下发值一致。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:567
- **服务端职责**：下发 MsgResultHu/MsgPlayerScore 的赔付者负分值与累计分。
- **客户端职责**：赔付者单局与累计负分同样取服务端 win_losts.score 与 player.scores，客户端不做扣减运算。
- **协作边界**：实付扣减由服务端完成；客户端仅展示。
- **来源文件**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:227
- **原文摘录**：`const score = data.player_score.scores[i] ?? 0;`
