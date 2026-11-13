# 自摸、放铳、抢杠胡

> 阶段 ID：`ST-C07`。来源：模板「行牌 > 自摸、放铳、抢杠胡」章节。客户端视角规格，客户端逻辑与 UI 交互以 Code/Fgui 代码证据支撑。

## 0. 阶段

- **阶段 ID**：`ST-C07`
- **阶段**：自摸、放铳、抢杠胡
- **来源章节**：行牌 > 自摸、放铳、抢杠胡
- **涉及协议消息**：MsgPower、MsgHuC、MsgResultHu、MsgTake、MsgTakeFirst、MsgKongS、MsgGameConfig
- **涉及 UI 模块**：BoxHzmjMainView、BoxHzmjTipAniView、BoxHzmjMah2DView、BoxHzmjResultMid、ResultTableSign（HuIndex.xml、ResultItem.xml）
- **阶段概述**：规定自摸在常规摸牌、杠后补牌、庄家起手第 14 张三种时机于出牌前成立，并规定放铳（仅三牢庄闲互点）与抢杠胡（同门槛、被抢者按放铳赔付）的成立条件与赔付归属；客户端以服务端胡权限驱动胡按钮，按 hu_type 区分自摸/放铳/抢杠表现。

## 术语与单位（有则填）

| 术语 | 定义 | 单位/量纲 | 作用域 | 来源 |
| --- | --- | --- | --- | --- |
| 面子 | 一组顺子、刻子或杠。杠含 4 张，仍计 1 组面子。对子不是面子。已完成的吃、碰、明杠、暗杠都计入面子。 | 组（1 组面子，杠计 1 组） | 胡牌牌型结构判定 | 模板名词章节（第 11 行） |
| 财神 | 白板固定为财神。只在胡牌判定时代替顺子、刻子或对子所缺的牌；吃、碰、杠必须用真实的非财神牌。 | 牌张（固定白板） | 一局牌张规则 | 模板名词章节（第 12 行） |
| 牢庄（三牢） | 本期固定笃三老庄，每小局庄家都按三牢、8 倍计算。 | 倍（三牢 = 8 倍） | 每小局庄家倍数 | 模板名词章节（第 13 行） |
| 放铳 | 打出的牌被他人合法胡走，胡牌者称为点炮胡；白板财神弃牌不能点炮胡。 | 次（点炮事件） | 一局行牌全程 | 模板名词章节（第 19 行） |
| 平胡 | 四面子一将（4 组面子加 1 组对子）的基础番型，客户端番型表中倍数为 1x。 | 番（倍数 1x） | 番型结算 | source-code/client/Code/config/FanDefine.ts:15 |

## 跨切面行为（无原子也列）

- **胡权限由服务端驱动**：胡权限统一由服务端 MsgPower 的 POWER_ID_HU 位驱动，客户端不校验庄闲关系与牌型，只按权限显示 KW_BTN_Hu（同屏配 KW_BTN_Guo/KW_BTN_Guo2 供选择过） —— 跨切面（source-code/client/Code/layer/BoxHzmjMainView.ts:555；source-code/client/Code/layer/BoxHzmjMainView.ts:583）。
- **hu_type 区分三种胡表现**：hu_type 是客户端区分自摸/放铳/抢杠的唯一依据：HT_SELF 走自摸音效与 "zimo" 动作皮肤，HT_DISCARD/HT_ROBKONG 走点炮音效、"hu" 皮肤与 KW_Ani_DP 点炮动画 —— 跨切面（source-code/client/Code/layer/BoxHzmjTipAniView.ts:1094；source-code/client/Code/layer/BoxHzmjMainView.ts:671）。
- **点炮胡桌面表现**：点炮胡的桌面表现为：移除放铳者河牌最后一张，并把胡张拼到胡牌者手牌末尾，同时用 df_from 记录胡牌来源座位 —— 跨切面（source-code/client/Code/layer/BoxHzmjMah2DView.ts:984）。
- **结算桌面胡牌标识未启用**：结算桌面标识 ResultTableSign 已定义 点炮/吃胡/自摸 页（HuIndex.xml、ResultItem.xml C_HuType），但本抽取范围内只有重连恢复路径派发 onShowResultTableSign 且未携带 sign，正常结算未设置桌面胡牌标识 —— 跨切面（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:731，ResultItem C_HuType 结算页）。
- **抢杠胡复用点炮分支**：抢杠胡在客户端无独立 UI 分支，按点炮路径复用（hu_type=HT_ROBKONG 与 HT_DISCARD 同 skin），结算行归入"吃胡"页；被抢后需把加杠组还原为碰组（PlayerCardsData.revertRobbedKong），但该函数在本抽取范围内未见调用点 —— 跨切面（source-code/client/Code/layer/BoxHzmjMainView.ts:671；source-code/client/Code/data/PlayerCardsData.ts:444）。
- **结算流水不输出胡类型文字**：结算流水不输出"自摸/点炮/抢杠胡"文字：赢家流水只拼番型文案，输家类型（被自摸/放炮/被抢杠）流水被显式跳过 —— 跨切面（source-code/client/Code/util/BoxHzmjFlowUtil.ts:119；source-code/client/Code/util/BoxHzmjFlowUtil.ts:120）。

## `FP-ST-C07-001` 自摸成立时机与牌型

- **主描述**：自摸在常规摸牌、杠后补牌、庄家起手第 14 张三种时机，于出牌前完成；常规成牌结构为 4 组面子加 1 组对子。
- **范围与边界**：仅自摸胡牌路径的时机与牌型结构；不含财神替代判定、不含摊与承包结算。
- **总体协作**：服务端授予 POWER_ID_HU 时下发 MsgPower（含 hu_mah/hu_point/hu_type），客户端据此显示胡按钮并在点击时以当前 askid 发 MsgHuC；胡牌后由 MsgResultHu 的 hu_items 驱动动画与结算。

### 原子项

#### `AT-ST-C07-001` 常规摸牌后出牌前自摸

- **规则说明**：常规摸牌后在出牌前胡牌（自摸）。
- **触发条件**：常规摸牌（收到 MsgTake 置 MAH_STATE_TAKE）后、出牌前，服务端下发含 POWER_ID_HU 的 MsgPower；玩家点击胡按钮即在该窗口内完成自摸。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：自己回合显示胡按钮，按钮内含胡张与胡牌倍数：KW_BTN_Hu 显隐由权限位控制，KW_Ani 皮肤按 hu_type 切换（自摸为 zimo），按钮以 Spine 动效与高亮呈现；胡张与"N 倍"文字同步刷新。
- **限制与禁止**：客户端不做摸牌后胡牌合法性判断，不做庄闲与牌型校验，完全依赖服务端胡权限。
- **异常与边界**：模板"常规摸牌"未限定张数来源；客户端不区分摸牌张数来源，一律按权限位驱动胡按钮。
- **验收**：收到 MsgTake 置 MAH_STATE_TAKE 后，MsgPower 含 POWER_ID_HU 时胡按钮显示（胡张取 power.hu_mah、倍数取 power.hu_point）；点击后 GameController.sendHu 携带 askid 发送 MsgHuC；hu_type 为自摸时按钮动画用 zimo 皮肤。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:63；source-code/client/Code/layer/BoxHzmjMainView.ts:583；source-code/client/Code/layer/BoxHzmjMainView.ts:1183；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1094
- **服务端职责**：下发 MsgTake（置摸牌状态）、MsgPower（POWER_ID_HU 位与 hu_mah/hu_point/hu_type 授予胡权限），接收 MsgHuC，下发 MsgResultHu 驱动胡牌动画与结算。
- **客户端职责**：GameTakeCmd 处理 MsgTake 时把桌面状态置为 MAH_STATE_TAKE 并记录摸牌；随后 MsgPower 到达，客户端按 POWER_ID_HU 位显示胡按钮（胡张取 power.hu_mah、倍数取 power.hu_point）；点击后 GameController.sendHu 携带 askid 发 MsgHuC。
- **协作边界**：客户端消费 MsgTake 维护桌面状态、消费 MsgPower 显示胡按钮并上送 MsgHuC；胡牌合法性判定与放行完全在服务端。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:63
- **原文摘录**：`GameData.setTableState(MahGameState.MAH_STATE_TAKE);`

#### `AT-ST-C07-002` 杠后补牌自摸

- **规则说明**：杠后补牌，在出牌前胡牌（杠后补牌自摸）。
- **触发条件**：杠成立（收到 MsgKongS 播杠动画）后从牌墙补牌（走通用 MsgTake 路径），在出牌前服务端授予胡权限（hu_type 仍为 HT_SELF）。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：杠后补牌自摸播放杠开类番型与音效表现：杠上开花命中时播放 KW_Ani_Hu_Type 的 gangkai 文字动效，并播放 hu_7_gangkai 音效；默认无番型时按自摸播 zimo 动效。
- **限制与禁止**：客户端无"杠后补牌必须自摸"的规则实现，不做补牌后胡牌合法性本地判定。
- **异常与边界**：杠上开花作为番型由服务端下发 fan_ids，客户端仅按番型选动画与音效，无独立的杠后补牌自摸判定；杠上开花属自摸变体（hu_type 仍为 HT_SELF）。
- **验收**：杠后补牌场景胡牌时，fan_ids 命中杠上开花（K_FTG_HZMJ_GANG_SHANG_HUA = 2406）则播放 gangkai 文字动效与 hu_7_gangkai 音效；无番型时按自摸播 zimo 动效；comb.flag 为补杠时杠动画走 TYPE_TKONG。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:58；source-code/client/Code/config/FanDefine.ts:26；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1075；source-code/client/Code/config/GameSoundConfig.ts:431
- **服务端职责**：下发 MsgKongS（comb.flag 区分明杠/暗杠/补杠）、MsgPower（胡权限）、MsgResultHu（fan_ids 含杠上开花番型）。
- **客户端职责**：GameKongCmd 按 comb.flag 区分明杠/暗杠/补杠并播放对应杠动画；杠后补牌走通用 MsgTake 路径；杠上开花作为番型由服务端下发 fan_ids，客户端仅按番型选动画与音效，无独立的杠后补牌自摸判定。
- **协作边界**：客户端消费 MsgKongS 区分杠类型、消费 MsgPower 显示胡按钮、消费 MsgResultHu 的 fan_ids 选杠开动效；杠上开花番型判定在服务端。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:58
- **原文摘录**：`kongType = BoxMahDefine.ActionAniType.TYPE_TKONG;`

#### `AT-ST-C07-003` 庄家起手第 14 张自摸

- **规则说明**：庄家起手第 14 张，在出牌前胡牌（起手自摸）。
- **触发条件**：发牌阶段（收到 MsgTakeFirst 置 MAH_STATE_TAKEFIRST）后进入首摸后动作等待（kHzmjStateFirstWait = 503）阶段，服务端在此窗口授予胡权限时起手胡成立。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：起手等待阶段不显示听牌/操作提示，可直接胡牌；首出阶段由 GamePowerCmd 显示庄/闲首出提示并隐藏骰子；获胡权限后照常显示胡按钮。
- **限制与禁止**：客户端无"庄家起手第 14 张可胡"的专门判定，起手胡的判定与放行完全在服务端。
- **异常与边界**：客户端只维护首摸等待状态与首出提示；未找到针对"庄家第 14 张"的独立分支，仍由 MsgPower 授予胡权限统一驱动。
- **验收**：收到 MsgTakeFirst 后桌面状态置 MAH_STATE_TAKEFIRST；重连场景表把 kHzmjStateFirstWait(503) 映射到 CMD_SCENE_ACTION；获胡权限时照常显示胡按钮并可 sendHu 上送。
- **职责域**：client
- **职责依据**：source-code/client/Code/protocol/GameGlcProtocol.ts:78；source-code/client/Code/controller/gameController.ts:50；source-code/client/Code/controller/cmd/gameCmd/GameTakeFirstCmd.ts:32
- **服务端职责**：下发 MsgTakeFirst（发牌置首摸状态）、MsgPower（起手胡权限）、MsgResultHu。
- **客户端职责**：发牌由 GameTakeFirstCmd 置为 MAH_STATE_TAKEFIRST；重连场景表把 kHzmjStateFirstWait(503) 映射到场景动作命令，说明存在"首摸后动作等待"阶段；但客户端无"庄家起手第 14 张可胡"的专门判定，仍由 MsgPower 授予胡权限。
- **协作边界**：客户端消费 MsgTakeFirst 维护首摸状态与首出提示、消费 MsgPower 显示胡按钮；起手第 14 张可胡的判定与放行完全在服务端。
- **来源文件**：`source-code/client/Code/protocol/GameGlcProtocol.ts`
- **来源定位**：source-code/client/Code/protocol/GameGlcProtocol.ts:78
- **原文摘录**：`kHzmjStateFirstWait = 503, // 首摸后动作等待（BoxFirstWaitStep）`

#### `AT-ST-C07-004` 自摸常规牌型结构

- **规则说明**：自摸的常规结构是 4 组面子加 1 组对子。
- **触发条件**：胡牌结算（收到 MsgResultHu）时，客户端按服务端下发的 hu_items/player_hands 渲染副露组合与手牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：结算展示手牌与副露组合（面子+将）：结算行按 Comb 模式渲染副露槽位并把单放组移到最后，或按 Hand 模式渲染手牌与 KW_Mah_Hu 胡张；无番型时按 pinghu 动效展示。
- **限制与禁止**：客户端不计算手牌是否面子+对子，无成牌结构校验逻辑。
- **异常与边界**：番型表以"平胡（四面子一将）"标识该结构，是唯一对结构的文字映射；牌型合法性依赖服务端。
- **验收**：胡牌结算按 Comb/Hand 模式正确渲染副露槽位（单放组移到最后）与手牌（KW_Mah_Hu 胡张）；无番型时按 pinghu 动效展示；番型命中平胡（K_FTG_HZMJ_PING_HU = 2401）时按平胡番名渲染。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:16；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:176；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1062
- **服务端职责**：下发 MsgResultHu（hu_items/player_hands 驱动结算渲染，fan_ids 标识平胡番型）。
- **客户端职责**：客户端不计算手牌是否面子+对子，只按服务端下发的 hu_items/player_hands 渲染副露组合与手牌；番型表以"平胡（四面子一将）"标识该结构，无结构校验逻辑。
- **协作边界**：客户端消费 MsgResultHu 渲染牌型展示；4 面子 + 1 对子的结构合法性判定在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:16
- **原文摘录**：`K_FTG_HZMJ_PING_HU = 2401,`

## `FP-ST-C07-002` 放铳资格（三牢庄闲）

- **主描述**：本期固定庄闲放铳：当局为三牢、出牌者与胡牌者一边庄一边闲且牌型合法时才能点炮胡；庄家打出的牌只有闲家可胡，闲家打出的牌只有庄家可胡。
- **范围与边界**：仅点炮胡的资格判定与身份关系；不含吃碰杠、不含摊与承包。
- **总体协作**：客户端不参与资格判定，仅按 MsgPower 的 POWER_ID_HU/POWER_ID_CANCEL 显示胡与过按钮，结算按 MsgResultHu.hu_items 的 hu_type 与 df_from 渲染放铳关系。

### 原子项

#### `AT-ST-C07-005` 本期固定庄闲放铳

- **规则说明**：放铳本期固定为庄闲放铳（不开放其他派系）。
- **触发条件**：进入游戏时 MsgGameConfig 下发对局配置；客户端不因配置不同切换放铳派系表现。
- **配置影响**：MsgGameConfig 仅包含 must_bao_tou_with_cai、enable_three_tan_bao、round_id、simple_mode 等字段，无庄闲放铳开关或房间配置项，与"固定开启、不可配置"一致。
- **客户端交互**：客户端无放铳派系相关交互界面：房间配置与 MsgGameConfig 中均无庄闲放铳开关项，规则提示文案亦不含放铳派系说明（MatchTipConfig 只有财神/爆头/承包/牢庄倍数等提示）。
- **限制与禁止**：客户端无庄闲放铳开关；客户端也没有庄闲放铳的规则说明文案。
- **异常与边界**：以"配置项缺失"作为间接证据；放铳派系约束在客户端无直接代码承载。
- **验收**：MsgGameConfig 字段中不存在庄闲放铳相关开关；客户端无放铳派系分支或说明文案，约束仅体现为服务端权限下发行为。
- **职责域**：client
- **职责依据**：source-code/client/Code/lib/proto_game_hzmj.d.ts:3985；source-code/client/Code/lib/proto_game_hzmj.d.ts:3988
- **服务端职责**：下发 MsgGameConfig（不含放铳派系开关，庄闲放铳资格判定在服务端）。
- **客户端职责**：客户端没有庄闲放铳的开关或房间配置项：MsgGameConfig 仅包含 must_bao_tou_with_cai、enable_three_tan_bao、round_id、simple_mode 等字段，与"固定开启、不可配置"一致。
- **协作边界**：客户端消费 MsgGameConfig 的既有字段；庄闲放铳派系的固定与放行在服务端，客户端无对应配置与判定。
- **来源文件**：`source-code/client/Code/lib/proto_game_hzmj.d.ts`
- **来源定位**：source-code/client/Code/lib/proto_game_hzmj.d.ts:3985
- **原文摘录**：`/** MsgGameConfig must_bao_tou_with_cai */`

#### `AT-ST-C07-006` 三牢是点炮前提

- **规则说明**：当局是三牢，点炮胡才成立（庄闲倍数 8 倍）。
- **触发条件**：服务端下发 MsgPower 授予胡权限时，胡按钮按 hu_point 展示倍数；牢庄等级（bankerLevel：1=平庄/2=二牢/3=三牢）随局数据由服务端下发维护。
- **配置影响**：牢庄等级来自服务端局数据（bankerLevel），客户端本地提供 getZhuangXianMult 按 1<<level 换算倍数（三牢=8），但该换算不参与点炮资格判定。
- **客户端交互**：胡按钮显示本次胡牌倍数：KW_BTN_Hu 内 KW_HuPaiBeiShu 文本显示"{hu_point}倍"，封顶标记固定隐藏。
- **限制与禁止**：客户端不校验"是否三牢"，胡按钮上的倍数是服务端 hu_point 直接下发；getZhuangXianMult 在本抽取范围内无调用点。
- **异常与边界**：倍数展示完全依赖服务端 hu_point，客户端本地倍数换算函数未接入点炮链路。
- **验收**：获得胡权限时胡按钮 KW_HuPaiBeiShu 显示服务端下发的"{hu_point}倍"文本，封顶标记固定隐藏；客户端不出现"非三牢禁止点炮"类本地拦截。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/GameData.ts:1664；source-code/client/Code/data/GameData.ts:1665；source-code/client/Code/layer/BoxHzmjMainView.ts:666
- **服务端职责**：下发 MsgPower（hu_point 承载本次胡牌倍数）、MsgResultHu；三牢资格判定在服务端。
- **客户端职责**：客户端保存 bankerLevel（1=平庄/2=二牢/3=三牢）并提供 getZhuangXianMult 计算 1<<level（三牢=8）；但该倍数不参与点炮资格判定，胡按钮上的倍数是服务端 hu_point 直接下发。
- **协作边界**：客户端消费 MsgPower 的 hu_point 展示倍数；"三牢才可点炮"的资格判定在服务端，客户端不校验牢庄等级。
- **来源文件**：`source-code/client/Code/data/GameData.ts`
- **来源定位**：source-code/client/Code/data/GameData.ts:1664
- **原文摘录**：`getZhuangXianMult(): number {`

#### `AT-ST-C07-007` 庄闲相对且牌型合法

- **规则说明**：出牌者与胡牌者正好一边是庄、一边是闲，同时牌型合法，才能点炮胡。
- **触发条件**：他人打出可胡牌时，由服务端判定庄闲相对关系与牌型合法性并决定是否下发 POWER_ID_HU 权限。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：客户端不做庄/闲身份与牌型合法性校验。
- **异常与边界**：胡按钮仅由服务端 POWER_ID_HU 决定，实际拦截在服务端；客户端无对应边界处理。
- **验收**：客户端无庄闲身份与牌型合法性的本地校验路径；点炮胡能力完全由服务端 MsgPower 的 POWER_ID_HU 位决定。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：客户端不做庄/闲身份与牌型合法性校验，胡按钮仅由服务端 POWER_ID_HU 决定，实际拦截在服务端。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C07-008` 庄家弃牌仅闲家可胡

- **规则说明**：庄家打出的牌只有闲家可胡。
- **触发条件**：庄家出牌后，由服务端判定并仅向有权胡牌的闲家下发胡权限。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：客户端不做出牌者身份与胡牌者身份的过滤。
- **异常与边界**：权限由服务端下发，客户端无对应边界处理。
- **验收**：客户端无出牌者/胡牌者身份过滤实现；胡按钮出现与否完全取服务端权限下发行为。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：客户端不持有庄家弃牌的身份过滤逻辑，权限由服务端下发。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C07-009` 闲家弃牌仅庄家可胡

- **规则说明**：闲家打出的牌只有庄家可胡。
- **触发条件**：闲家出牌后，由服务端判定并仅向有权胡牌的庄家下发胡权限。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：客户端无闲家之间禁点炮的本地校验或提示。
- **异常与边界**：权限由服务端下发，客户端无对应边界处理。
- **验收**：客户端无闲家之间禁点炮的本地校验或提示；胡按钮出现与否完全取服务端权限下发行为。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：客户端不持有闲家弃牌的身份过滤逻辑，权限由服务端下发。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

## `FP-ST-C07-003` 放铳排他性赔付与自摸兜底

- **主描述**：未形成庄闲关系时只能自摸；形成点炮关系时只由放铳者赔付。
- **范围与边界**：点炮的赔付归属与无点炮关系时的替代路径；不含承包代赔、不含番型倍数计算。
- **总体协作**：赔付金额由服务端计算并写入 MsgResultHu.win_losts 与 extra_score，客户端只按流水类型与得失分渲染；放铳者座位以 C_HuType 点炮页标识。

### 原子项

#### `AT-ST-C07-010` 无庄闲关系只能自摸

- **规则说明**：未形成庄闲放铳关系时只能自摸。
- **触发条件**：自己回合摸牌后，服务端按庄闲关系判定结果下发 MsgPower；无点炮关系时不向他人下发针对弃牌的胡权限。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：胡/过按钮按权限位显隐，未获胡权限时不出现胡按钮（吃碰杠按各自权限位显示）。
- **限制与禁止**：客户端没有"庄闲关系不成立则禁点炮"的判定。
- **异常与边界**：属于权限驱动的间接证据：客户端只表现为服务端不发胡权限，无显式禁点炮分支。
- **验收**：power 含 POWER_ID_HU 时 showHu 为真并显示胡按钮；power 含 POWER_ID_CANCEL_S 时 showGuo 为真并显示过按钮；未获胡权限时自己回合只保留出牌操作，胡按钮不出现。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:555；source-code/client/Code/layer/BoxHzmjMainView.ts:557
- **服务端职责**：下发 MsgPower（POWER_ID_HU/POWER_ID_CANCEL 位决定胡与过按钮显隐，承载庄闲关系判定结果）。
- **客户端职责**：客户端胡入口完全由服务端权限决定：只有 POWER_ID_HU 置位才显示胡按钮，否则自己回合只保留出牌操作；因此"不能点炮"时自然退化为仅能自摸。
- **协作边界**：客户端消费 MsgPower 的权限位呈现胡/过按钮；庄闲关系成立与否的判定在服务端，客户端不做本地校验。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:555
- **原文摘录**：`showHu: (power & BoxMahDefine.PowerType.POWER_ID_HU) > 0,`

#### `AT-ST-C07-011` 点炮只由放铳者赔付

- **规则说明**：点炮胡只由放铳者赔付。
- **触发条件**：点炮胡结算（收到 MsgResultHu 且 hu_type 为 HT_DISCARD）时，客户端按 win_losts 与 extra_score 渲染赔付并按 df_from 标识放铳者。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：结算中放铳者行标识为点炮，流水显示其支出：结算行胡牌类型页胡牌者按 HT_SELF 显示自摸、其余显示吃胡；非胡牌座位若被某胡牌项的 df_from 指向则显示"点炮"标识。
- **限制与禁止**：客户端不计算赔付金额；流水正文只拼番型文案并跳过输家类型，放铳者流水不出现"放炮/点炮"字样，仅靠负分与点炮标识体现。
- **异常与边界**：流水类型把点炮胡(K_LT_DIAN_PAO)与放炮(K_LT_FANG_PAO，负分)成对处理；赔付金额完全取服务端结果。
- **验收**：点炮胡结算时放铳者结算行 C_HuType 置"点炮"页（selectedIndex = 1）；流水归集把 K_LT_DIAN_PAO 与 K_LT_FANG_PAO 成对处理；放铳者流水为负分且不含"放炮/点炮"文字。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:555；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:736；source-code/client/Code/util/BoxHzmjFlowUtil.ts:120
- **服务端职责**：下发 MsgResultHu（win_losts 与 extra_score 承载赔付金额，hu_items.df_from 指向放铳座位）。
- **客户端职责**：客户端不计算赔付，只渲染服务端 win_losts 与 extra_score；流水类型把点炮胡(K_LT_DIAN_PAO)与放炮(K_LT_FANG_PAO，负分)成对处理，结算行对被胡座位判定为放铳者时把 C_HuType 置为"点炮"页。
- **协作边界**：客户端消费 MsgResultHu 的 win_losts/extra_score/df_from 渲染赔付与点炮标识；赔付归属计算在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:555
- **原文摘录**：`/** 放炮：炮手支出，score 为负（与 kLTHzmjDianPao 成对）。 */`

## `FP-ST-C07-004` 抢杠胡资格与赔付

- **主描述**：抢杠胡与放铳同门槛（只有三牢的庄闲之间可以抢），所加的第 4 张须使响应者合法胡牌；只由被抢的加杠者按放铳赔付，其他人不付。
- **范围与边界**：加杠被抢的资格、桌面还原与赔付归属；不含杠分（明杠/暗杠/补杠豆分）结算。
- **总体协作**：响应者在加杠后由服务端 MsgPower 授予胡权限（hu_type=HT_ROBKONG），客户端复用点炮表现；胡牌后按 MsgResultHu.hu_items 还原杠组并按流水类型渲染赔付。

### 原子项

#### `AT-ST-C07-012` 抢杠与放铳同门槛

- **规则说明**：抢杠胡与放铳相同，只有三牢的庄闲之间可以抢。
- **触发条件**：加杠动作上送（MsgKongS 后补杠流程）时，服务端按三牢庄闲门槛判定是否向响应者下发 POWER_ID_HU 权限（hu_type=HT_ROBKONG）。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：抢杠胡与点炮共用胡按钮的 "hu" 动作皮肤并播放点炮动画，无独立"抢杠"按钮或字效。
- **限制与禁止**：客户端无三牢/庄闲校验；抢杠也没有独立的操作窗口，依赖服务端下发胡权限。
- **异常与边界**：客户端把抢杠胡作为 hu_type=HT_ROBKONG 处理，在动画皮肤、点炮判定、结算胡牌类型上都与点炮(HT_DISCARD)同分支，表现层按"与放铳相同"处理。
- **验收**：hu_type 为 HT_DISCARD 或 HT_ROBKONG 时走同一分支选 "hu" 皮肤；点炮判定把 HT_DISCARD、HT_DIAN_GANG_HUA、HT_ROBKONG 归为一类；抢杠胡无独立按钮或字效。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/BoxMahDefine.ts:897；source-code/client/Code/layer/BoxHzmjMainView.ts:671；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:339
- **服务端职责**：下发 MsgPower（HT_ROBKONG 胡权限）、MsgKongS（加杠流程）、MsgResultHu。
- **客户端职责**：客户端把抢杠胡作为 hu_type=HT_ROBKONG 处理，并在动画皮肤、点炮判定、结算胡牌类型上都与点炮(HT_DISCARD)同分支，说明表现层按"与放铳相同"处理；但"三牢庄闲"的门槛在客户端无校验。
- **协作边界**：客户端消费 MsgPower 的 hu_type 复用点炮表现；三牢庄闲门槛判定在服务端，客户端无校验与独立操作窗口。
- **来源文件**：`source-code/client/Code/config/BoxMahDefine.ts`
- **来源定位**：source-code/client/Code/config/BoxMahDefine.ts:897
- **原文摘录**：`QIANG_GANG = 3,`

#### `AT-ST-C07-013` 被抢的第 4 张须合法成胡

- **规则说明**：所加的第 4 张须使响应者合法胡牌。
- **触发条件**：加杠成立且响应者获抢杠胡权限并胡牌后，客户端按 MsgResultHu 的 hu_items 触发桌面还原。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：被抢张作为胡张展示，加杠组还原为碰组：桌面把被抢的第 4 张拼到胡牌者手牌末位并打胡牌高亮，杠者副露从 4 张杠退回 3 张碰。
- **限制与禁止**：客户端无"第 4 张是否成胡"的本地判定，合法性判断在服务端。
- **异常与边界**：revertRobbedKong 为 public 方法但在本抽取范围内未见调用点（可能在未抽取的 common_game 公共层）。
- **验收**：抢杠胡结算时被抢张从杠者摸牌/手牌移除且补杠副露的 nFlag 改回 CMF_PONG；桌面把胡张（dan_fang 下发）拼入胡牌者手牌末位（cards.concat(huValue)）并高亮。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/PlayerCardsData.ts:444；source-code/client/Code/data/PlayerCardsData.ts:465；source-code/client/Code/layer/BoxHzmjMah2DView.ts:984
- **服务端职责**：下发 MsgPower（抢杠胡权限）、MsgResultHu（hu_items.dan_fang 下发被抢胡张）。
- **客户端职责**：PlayerCardsData 提供 revertRobbedKong：把被抢张从摸牌/手牌移除，并把补杠组标志改回碰（CMF_PONG）；胡张经 MsgHuItem.dan_fang 下发后在桌面拼入胡牌者手牌。合法性判断在服务端，客户端只做还原与展示。
- **协作边界**：客户端消费 MsgResultHu 的 dan_fang 做桌面还原与胡张展示；第 4 张是否合法成胡的判定在服务端。
- **来源文件**：`source-code/client/Code/data/PlayerCardsData.ts`
- **来源定位**：source-code/client/Code/data/PlayerCardsData.ts:444
- **原文摘录**：`/** 抢杠胡：被抢张不能留在杠者摸牌/手牌，补杠副露拆回碰。`

#### `AT-ST-C07-014` 被抢者按放铳单一赔付

- **规则说明**：只由被抢的加杠者按放铳赔付。
- **触发条件**：抢杠胡结算（收到 MsgResultHu 且流水含 K_LT_QIANG_GANG/K_LT_BEI_QIANG_GANG 成对类型）时渲染赔付归属。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：结算中被抢者按点炮标识，赢家按非自摸标识：结算行胡牌类型只区分 不参与胡牌/点炮/吃胡/自摸 四页，抢杠赢家显示"吃胡"，被抢者显示"点炮"；无"抢杠"独立标识。
- **限制与禁止**：客户端不做赔付归属计算，赔付金额完全取服务端结果。
- **异常与边界**：客户端流水注释含"被抢者同时触发全烧"，与本期模板"只由被抢者按放铳赔付、其他人不付"口径不一致（疑似来自其他玩法/旧版），需与结算口径对齐确认。
- **验收**：抢杠胡结算时赢家结算行按 hu_type!==HT_SELF 判为"吃胡"页（selectedIndex = 2）、被抢者按"点炮"页标识；流水归集把 K_LT_QIANG_GANG 与 K_LT_BEI_QIANG_GANG 成对处理；无"抢杠"独立结算标识。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:557；source-code/client/Code/util/BoxHzmjFlowUtil.ts:119；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:731
- **服务端职责**：下发 MsgResultHu（win_losts/extra_score 承载抢杠赔付归属与金额）。
- **客户端职责**：流水类型表定义抢杠胡(K_LT_QIANG_GANG)/被抢杠(K_LT_BEI_QIANG_GANG)成对，客户端在胡牌流水归集中把抢杠与点炮并列处理；结算行按 hu_type!==HT_SELF 判为吃胡/点炮页。赔付金额完全取服务端结果。
- **协作边界**：客户端消费 MsgResultHu 渲染抢杠结算（复用点炮标识）；"只由被抢者赔付"的归属计算在服务端，客户端仅呈现。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:557
- **原文摘录**：`/** 抢杠胡：胡牌者向被抢杠者收分，被抢者同时触发全烧。 */`

#### `AT-ST-C07-015` 抢杠其他人不付

- **规则说明**：抢杠胡除被抢的加杠者外，其他人不付。
- **触发条件**：抢杠胡结算时，第三方是否扣分完全由服务端 win_losts/extra_score 决定。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：客户端不做赔付归属校验，只透传服务端 win_losts/extra_score。
- **异常与边界**：输家流水类型（被自摸/放炮/被抢杠）在文案层被跳过，无法据此证明第三方不付。
- **验收**：客户端无赔付归属校验路径；第三方是否扣分只能以服务端结算数据为准，客户端仅按 win_losts/extra_score 逐座位渲染。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：客户端不校验赔付归属，只透传服务端 win_losts/extra_score；无法从客户端代码证明第三方不付，按未找到处理。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无
