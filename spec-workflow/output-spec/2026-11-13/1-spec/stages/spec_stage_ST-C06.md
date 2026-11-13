# 杠后补牌

> 阶段 ID：`ST-C06`。来源：模板「行牌 > 杠后补牌」章节。客户端视角规格，客户端逻辑与 UI 交互以 Code/Fgui 代码证据支撑。

## 0. 阶段

- **阶段 ID**：`ST-C06`
- **阶段**：杠后补牌
- **来源章节**：行牌 > 杠后补牌
- **涉及协议消息**：MsgTake、MsgPower、MsgKongC、MsgKongS、MsgDrawn、MsgResultHu、MsgHuC、MsgPlayC、MsgPlayS
- **涉及 UI 模块**：BoxHzmjMah2DView、BoxHzmjMahRightComp、BoxHzmjMainView、BoxHzmjTipAniView
- **阶段概述**：每次杠成立后从牌墙尾部补 1 张并使余牌减 1；杠前与连续杠前均须牌墙不少于 21 张，剩 20 张及以下时在下一次摸牌前黄庄；补牌可自摸，不胡则继续杠或打出 1 张，杠链按杠 +1、按吃碰与出牌条件归零。

## 术语与单位（有则填）

| 术语 | 定义 | 单位/量纲 | 作用域 | 来源 |
| --- | --- | --- | --- | --- |
| 杠链 | 杠后连续杠的累计次数：明杠、暗杠、加杠各 +1；吃、碰、打出非财神，或打出财神但打出后不再敲响则归零。 | 次（计数） | 一局行牌全程，由服务端按座位维护 | 模板 行牌 > 杠后补牌（第 75 行） |
| 流局 | 牌墙剩 21 张时当前玩家再摸 1 张、剩 20 张；先完成本次摸打与弃牌响应，无人胡牌时在下一次应摸牌前判黄庄，不是剩 20 张立刻结束。 | 张（牌墙余量阈值 20 张） | 一局生命周期收尾判定 | 模板 名词（第 20 行） |
| 财神 | 白板固定为财神，只在胡牌判定时代替顺子、刻子或对子所缺的牌；吃、碰、杠必须用真实的非财神牌。 | 牌张（固定白板） | 一局牌张规则 | 模板 名词（第 12 行） |

## 跨切面行为（无原子也列）

- **重连补数据不播动画**：重连补数据阶段（justUpdateData）只写数据缓存、不播动画，GameKongCmd、GameTakeCmd、GameWallMahCmd 均在 execute 开头判断后提前 return —— 跨切面（GameKongCmd / GameTakeCmd / GameWallMahCmd 的 execute 开头）。
- **抓牌方向由服务端决定**：抓牌方向与张数完全由服务端 MsgTake.dir / tcnt 决定，GameData 维护正向 asc 与反向 desc 两套牌墙索引；MsgJuData.is_kong_take_asc 仅有协议声明，客户端代码未读取 —— 跨切面（GameData 牌墙索引；proto_game_hzmj MsgJuData）。
- **剩余张数统一事件驱动**：桌面剩余张数统一由 GameCommonUIEventDefine.onUpdateMahCnt 驱动，GameTakeCmd、GameWallMahCmd、RecoverWallCmd、RecoverGameSceneCmd 均派发，BoxHzmjMahRightComp 与 BoxHzmjMah2DView 消费并刷新 KW_RIGHT_MAHS —— 跨切面（GameCommonUIEventDefine.onUpdateMahCnt；BoxHzmjMahRightComp / BoxHzmjMah2DView 消费）。
- **三类杠共用皮肤以音效区分**：三类杠在 UI 层共用同一套 gang Spine 皮肤，仅用音效区分：GANG（明杠）、AN_GANG（暗杠）、BU_GANG（补杠）—— 跨切面（BoxHzmjTipAniView 动作皮肤；ActionSoundKey 音效键）。
- **流局消息映射与实现缺口**：MsgDrawn（GP_DRAWN）已在协议映射表登记到 CMD_DRAWN，但 Code 中未找到对应命令实现类；实际流局表现由 MsgResultHu 的 end_type=ET_DRAWN 承担 —— 跨切面（source-code/client/Code/protocol/GameGlcProtocol.ts:285；source-code/client/Code/controller/gameController.ts:74；source-code/client/Code/util/BoxHzmjResultUtil.ts:37-38）。

## `FP-ST-C06-001` 杠后补牌与牌墙余量

- **主描述**：杠成立后从牌墙尾部补 1 张并扣减余牌；杠前牌墙须不少于 21 张；剩余 20 张及以下时在下一次摸牌前黄庄（流局）。
- **范围与边界**：包含补牌取牌方向与张数、余牌计数与展示、21 张杠门槛、20 张黄庄；不包含杠成立判定、抢杠胡与结算番型。
- **总体协作**：服务端判定杠成立、牌墙余量与流局时机并以 MsgKongS、MsgTake、MsgPower 驱动；客户端只按消息参数取牌、刷新余牌数与操作按钮，不做本地规则判定。

### 原子项

#### `AT-ST-C06-001` 杠后从牌墙尾部补 1 张

- **规则说明**：每次杠从牌墙尾部补 1 张。
- **触发条件**：杠成立后服务端下发 MsgTake；GameTakeCmd 收到消息后按 dir / tcnt 执行抓牌与摸牌表现。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：摸牌表现由 BoxHzmjMah2DView 的 setTakeMah 处理：自己走 setSelfTakeMah 与 showSpecialMah，其他座位调用 hands[localSeat].moMah 摆牌；随后刷新剩余张数。
- **限制与禁止**：客户端不自判取牌方向，不做针对杠补牌的固定尾部或 tcnt=1 校验。
- **异常与边界**：dir=2 时走反向抓牌分支，从 desc 索引（牌墙尾部）逐张取牌，并把被取走的墙位 missWallAll 交给 setTakeMah 播放摸牌；MsgJuData.is_kong_take_asc 在客户端仅协议声明，未参与取牌方向选择。
- **验收**：杠后收到 MsgTake 时 GameTakeCmd 调用 GameData.takeWalls(dir, tcnt) 完成抓牌；dir=2 时从牌墙尾部索引取牌并播摸牌动画，被抓墙位出墙。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:90；source-code/client/Code/data/GameData.ts:729-731；source-code/client/Code/lib/proto_game_hzmj.d.ts:1127；source-code/client/Code/lib/proto_game_hzmj.d.ts:1130；source-code/client/Code/layer/BoxHzmjMah2DView.ts:804
- **服务端职责**：下发 MsgTake（以 dir / tcnt 指定抓牌方向与张数，驱动杠后补牌）。
- **客户端职责**：客户端不自判取牌方向：GameTakeCmd 收到 MsgTake 后调用 GameData.takeWalls(data.dir, data.tcnt)；dir=2 走反向抓牌分支，从 desc 索引（牌墙尾部）逐张取牌，并把被取走的墙位 missWallAll 交给 setTakeMah 播放摸牌。
- **协作边界**：客户端消费 MsgTake 的 dir / tcnt 完成取牌与摸牌表现；取牌方向与张数、杠补牌规则校验均在服务端，客户端不做本地规则判定。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:90
- **原文摘录**：`return GameData.takeWalls(data.dir, data.tcnt);`

#### `AT-ST-C06-002` 补牌后余牌减 1

- **规则说明**：补牌后余牌减 1。
- **触发条件**：每次抓牌（含杠后补牌）完成后，由 GameData.takeWalls 按抓取张数扣减余牌并派发更新事件。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：右侧剩余张数组件（KW_RIGHT_MAHS / BoxHzmjMahRightComp）把 title 设为剩余张数并显示；BoxHzmjMah2DView 在绑定完成后也会补刷该数值。
- **限制与禁止**：客户端不自行推导余牌，扣减张数完全取服务端下发的 tcnt。
- **异常与边界**：客户端不区分杠补牌与普通摸牌，两类抓牌共用同一套扣减与刷新链路。
- **验收**：抓牌后 _wallLeftNum 按本次 tcnt 扣减；GameTakeCmd 派发 onUpdateMahCnt(GameData.getLeftCard()) 后右侧剩余张数组件刷新为最新值。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/GameData.ts:738；source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:289；source-code/client/Code/layer/comp/BoxHzmjMahRightComp.ts:27-28；source-code/client/Code/layer/BoxHzmjMah2DView.ts:353
- **服务端职责**：下发 MsgTake（以 tcnt 决定本次扣减的余牌张数）。
- **客户端职责**：GameData.takeWalls 按本次抓取张数扣减 _wallLeftNum；GameTakeCmd 抓牌后派发 onUpdateMahCnt(GameData.getLeftCard())，驱动剩余张数展示刷新。
- **协作边界**：客户端消费 MsgTake 的 tcnt 做余牌扣减与展示；牌墙余量的权威计数在服务端。
- **来源文件**：`source-code/client/Code/data/GameData.ts`
- **来源定位**：source-code/client/Code/data/GameData.ts:738
- **原文摘录**：`this._wallLeftNum -= nTcnt;`

#### `AT-ST-C06-003` 牌墙少于 21 张不能杠

- **规则说明**：牌墙少于 21 张不能杠。
- **触发条件**：服务端下发 MsgPower 时，客户端按 POWER_ID_KONG 位决定杠按钮显隐；玩家点击杠按钮后组装 MsgKongC 上送。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：杠按钮 KW_BTN_Gang.visible 由 showGang 控制，按钮态切到 C_BtnState 的"碰杠胡"页；多个可选杠时再切到"选择多杠"页展示 KW_GangGrps 列表。
- **限制与禁止**：客户端不做 21 张牌墙校验，未找到任何本地余量门槛代码；杠按钮可用性完全由服务端 power 关断。
- **异常与边界**：多个可选杠组合时进入"选择多杠"页由玩家选择具体组合后上送。
- **验收**：power 含 POWER_ID_KONG 时杠按钮可见；点击后 GameController.sendKong 组装 MsgKongC 上送（CS_KONG_C）；power 不含该位时杠按钮不出现。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:554；source-code/client/Code/layer/BoxHzmjMainView.ts:580；source-code/client/Code/config/BoxMahDefine.ts:208；source-code/client/Code/controller/gameController.ts:540-541
- **服务端职责**：下发 MsgPower（以 POWER_ID_KONG 位控制杠操作授权，承载 21 张门槛判定），接收 MsgKongC。
- **客户端职责**：客户端不做 21 张牌墙校验：杠按钮是否出现只取服务端 MsgPower 的 POWER_ID_KONG 位；点击后由 GameController.sendKong 组装 MsgKongC 上送，未找到任何本地余量门槛代码。
- **协作边界**：客户端消费 MsgPower 的杠权限位呈现按钮并上送 MsgKongC；21 张门槛判定完全在服务端。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:554
- **原文摘录**：`showGang: (power & BoxMahDefine.PowerType.POWER_ID_KONG) > 0,`

#### `AT-ST-C06-004` 剩 20 张及以下下一次摸牌前黄庄

- **规则说明**：剩 20 张及以下时，下一次摸牌前黄庄。
- **触发条件**：牌墙剩 20 张及以下、无人胡牌时，由服务端在下一次应摸牌前判定黄庄并进入流局结算链路。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：小结算按流局展示输赢行；房间提示文案含"剩余20张牌前无人胡牌则流局"；tipAni 包内有 txt_liuju.png 流局字效资源。
- **限制与禁止**：客户端无本地黄庄/流局时机判定，不实现 20 张时点与"下一次摸牌前"的时序判断。
- **异常与边界**：协议层 MsgDrawn 与 GP_DRAWN→CMD_DRAWN 映射已登记，但未找到 CMD_DRAWN 的命令实现类，实际流局表现由 MsgResultHu 的 end_type=ET_DRAWN 承担（自己行记为输/平）；tipAni 包存在 txt_liuju.png 资源但 Code 未检索到引用。
- **验收**：end_type=ET_DRAWN 时小结算按流局处理（selfWinLost = 2）；房间规则提示展示"剩余20张牌前无人胡牌则流局"文案。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/MatchTipConfig.ts:39；source-code/client/Code/util/BoxHzmjResultUtil.ts:37-38；source-code/client/Code/config/GameDefine.ts:441；source-code/client/Code/protocol/GameGlcProtocol.ts:285；source-code/client/Code/controller/gameController.ts:74
- **服务端职责**：下发 MsgResultHu（end_type=ET_DRAWN 承担实际流局表现），协议上另预留 MsgDrawn。
- **客户端职责**：客户端无本地黄庄/流局时机判定。流局落在结算链路：MsgResultHu 的 end_type=ET_DRAWN 时小结算按流局处理（自己行记为输/平），协议层另有 MsgDrawn 与 GP_DRAWN→CMD_DRAWN 映射，但未找到 CMD_DRAWN 的命令实现类。
- **协作边界**：客户端消费 MsgResultHu 的 end_type 渲染流局结算；黄庄时机与 20 张时点判定完全在服务端。
- **来源文件**：`source-code/client/Code/config/MatchTipConfig.ts`
- **来源定位**：source-code/client/Code/config/MatchTipConfig.ts:39
- **原文摘录**：`"剩余20张牌前无人胡牌则流局",`

## `FP-ST-C06-002` 连续杠与补牌后行动

- **主描述**：补牌后仍可继续杠，每次重新检查牌墙不少于 21 张；补牌可以自摸，不胡则可继续杠或打出 1 张进入正常出牌。
- **范围与边界**：包含连续杠的可选性、二次余量校验、补牌后自摸与出牌分支；不包含胡牌判定本身与杠上开花倍数计算。
- **总体协作**：服务端在每次杠后重新判定牌墙并下发 MsgTake 与 MsgPower；客户端按 power 位同时/分别呈现杠、胡、出牌能力，选择结果通过 MsgKongC、MsgHuC、MsgPlayC 上送。

### 原子项

#### `AT-ST-C06-005` 杠后可以继续杠

- **规则说明**：杠后可以继续杠。
- **触发条件**：杠成功（收到 MsgKongS）后，服务端若再下发含 POWER_ID_KONG 的 MsgPower，杠按钮再次出现。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：杠成功后收起吃碰杠胡操作区（onCloseOperate、onHidePutCardUi），并播放碰杠 Spine 动画；下一轮 power 若仍含 POWER_ID_KONG 再次显示杠按钮，多杠时展示 KW_GangGrps 选择列表。
- **限制与禁止**：客户端无已杠次数记录，无禁止再次杠的分支；后续动作完全由下一条服务端消息驱动。
- **异常与边界**：重连补数据阶段（justUpdateData）GameKongCmd 只写数据缓存、不播动画；多杠组合时进入选择页由玩家选择。
- **验收**：每次 MsgKongS 均置 MAH_STATE_KONG、更新副露并关闭操作栏；下一条 power 含 KONG 位时杠按钮重新可见，可再次上送 MsgKongC。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:33；source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:46-47；source-code/client/Code/layer/BoxHzmjMainView.ts:605-607；source-code/client/Code/layer/BoxHzmjMainView.ts:639-642
- **服务端职责**：下发 MsgKongS（杠成功结果），并在允许继续杠时下发含 POWER_ID_KONG 的 MsgPower。
- **客户端职责**：每次 MsgKongS 都走同一条 GameKongCmd：置 MAH_STATE_KONG、更新副露、清除复盘权限并关闭操作栏；代码中无已杠次数记录，也无禁止再次杠的分支，后续动作完全由下一条服务端消息驱动。
- **协作边界**：客户端消费 MsgKongS 呈现杠结果、消费 MsgPower 决定能否再杠；连续杠的规则成立条件判定在服务端，客户端无法据代码验证。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:33
- **原文摘录**：`GameData.setTableState(MahGameState.MAH_STATE_KONG);`

#### `AT-ST-C06-006` 每次继续杠重新检查牌墙不少于 21 张

- **规则说明**：每次重新检查牌墙不少于 21 张。
- **触发条件**：每次继续杠前由服务端重新校验牌墙不少于 21 张，校验结果通过 MsgPower 的杠权限位体现。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：客户端无 21 张阈值常量、二次校验或相关提示，完全依赖服务端 power 下发。
- **异常与边界**：无。
- **验收**：客户端不展示二次余量校验；杠按钮可用性完全由服务端 power 下发决定，继续杠无额外本地门槛。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：客户端仅消费 MsgPower 的杠权限位；二次余量校验不在客户端（与 AT-ST-C06-003 同一门槛，客户端完全依赖服务端 power 下发，无重复校验实现）。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C06-007` 补牌可以自摸

- **规则说明**：补牌可以自摸。
- **触发条件**：杠后补牌后，服务端下发含 POWER_ID_HU 的 MsgPower，且 hu_type 为自摸（非点炮/抢杠）。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：胡按钮 KW_BTN_Hu 显示并带光效，胡牌动画区分自摸 zimo 与点炮/抢杠 hu；番型结算可命中"杠上开花"名称。
- **限制与禁止**：客户端不自验补牌后能否自摸，胡判定完全依赖服务端 power。
- **异常与边界**：补牌后与常规摸牌后的胡按钮走同一套逻辑，不区分补牌来源；番型侧有杠上开花 2406（杠牌后自摸 2 倍）定义。
- **验收**：power 含 POWER_ID_HU 时胡按钮显示带光效；hu_type 为自摸时按钮动画用 zimo 皮肤；结算命中杠上开花（K_FTG_HZMJ_GANG_SHANG_HUA = 2406）番名；点击后 sendHu 上送 MsgHuC。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:665；source-code/client/Code/layer/BoxHzmjMainView.ts:675；source-code/client/Code/layer/BoxHzmjMainView.ts:555；source-code/client/Code/config/FanDefine.ts:25-26
- **服务端职责**：下发 MsgPower（POWER_ID_HU 位与 hu_type 标识自摸），接收 MsgHuC。
- **客户端职责**：补牌后若服务端 MsgPower 带 POWER_ID_HU，客户端显示胡按钮并可 sendHu 上送 MsgHuC；胡按钮动画按 hu_type 选皮肤，非点炮/抢杠（即 HT_SELF 自摸）用 zimo 皮肤。番型侧另有杠上开花 2406（杠牌后自摸 2 倍）定义。
- **协作边界**：客户端消费 MsgPower 的胡权限位与 hu_type 呈现胡按钮并上送 MsgHuC；胡判定与杠上开花判定在服务端。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:665
- **原文摘录**：`this.view.KW_Main.KW_Handler.KW_BTN_Hu.KW_Action.KW_Ani.skinName = this._getHuActionSkinName(PowerData.hu_type);`

#### `AT-ST-C06-008` 补牌不胡可继续杠

- **规则说明**：不胡则继续杠。
- **触发条件**：补牌后 MsgPower 同时含 POWER_ID_KONG 与 POWER_ID_HU 位，玩家在杠与胡之间自选。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：碰杠胡页同时显示杠与胡按钮，多杠时进入"选择多杠"页；选择后收起操作区等待服务端回应。
- **限制与禁止**：客户端无"必须放弃胡才能杠"的本地约束；胡杠并存时由玩家自选，无额外确认流程。
- **异常与边界**：多杠组合时经 KW_GangGrps 选择具体组合后上送。
- **验收**：胡按钮与杠按钮可同时由 power 位置亮；点杠时经 onBtnChooseGang 取 GameData.getKongCombInfo 组合后 sendKong 上送 MsgKongC，操作区收起等待服务端回应。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:583；source-code/client/Code/layer/BoxHzmjMainView.ts:1149-1154；source-code/client/Code/layer/BoxHzmjMainView.ts:580
- **服务端职责**：下发 MsgPower（补牌后可继续下发 KONG 权限实现"不胡则继续杠"），接收 MsgKongC。
- **客户端职责**：客户端不区分"补牌后"与普通回合：胡按钮与杠按钮可同时由 power 位置亮，玩家点杠则 GameData.getKongCombInfo 取组合后 sendKong 上送，点胡则 sendHu；没有"必须放弃胡才能杠"的本地约束。
- **协作边界**：客户端消费 MsgPower 同时呈现杠与胡能力并上送选择结果；"不胡则继续杠"的规则时序由服务端控制。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:583
- **原文摘录**：`this.view.KW_Main.KW_Handler.KW_BTN_Hu.visible = powerState.showHu;`

#### `AT-ST-C06-009` 补牌不胡可打出 1 张

- **规则说明**：不胡则打出 1 张。
- **触发条件**：补牌后 MsgPower 含 POWER_ID_PLAY 且无胡（canPlay = power & POWER_ID_PLAY 且 !hasHu），canPutCard 置真后手牌可点击。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：手牌可点出牌；存在杠/胡按钮且未点"过"时弹提示"点'过'才能出牌"；与摸牌无关的杠（_isGangOffMoCard）不置灰、可直接出牌。
- **限制与禁止**：存在杠/胡按钮且未点"过"时，点手牌会被拦截并要求先点"过"（与摸牌无关的杠除外）。
- **异常与边界**：canPlayMahCheck 校验链覆盖禁打、可听牌单击拦截、有吃碰杠胡按钮须先过三种拦截；与摸牌无关的杠除外出牌拦截。
- **验收**：canPutCard 置真后点击手牌经 canPlayMahCheck 校验通过后由 onPlayMah 调 sendPlay 发送 MsgPlayC，服务端回 MsgPlayS 播落牌；有杠/胡按钮未点"过"时点手牌弹出"点'过'才能出牌"提示。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:536；source-code/client/Code/layer/BoxHzmjMainView.ts:556；source-code/client/Code/layer/BoxHzmjMainView.ts:1482；source-code/client/Code/layer/BoxHzmjMainView.ts:1455
- **服务端职责**：下发 MsgPower（POWER_ID_PLAY 位授权出牌），接收 MsgPlayC 并回 MsgPlayS。
- **客户端职责**：补牌后 power 含 POWER_ID_PLAY 时 canPutCard 置真，手牌可点击；点击经 canPlayMahCheck 校验（禁打、可听牌单击拦截、有吃碰杠胡按钮须先过）后由 onPlayMah 调 sendPlay 发送 MsgPlayC，服务端回 MsgPlayS 播落牌。
- **协作边界**：客户端消费 MsgPower 的出牌权限位控制手牌可点性并上送 MsgPlayC；出牌合法性校验在服务端。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:536
- **原文摘录**：`this._selfHand.canPutCard = powerState.canPlay;`

## `FP-ST-C06-003` 杠链计数与归零

- **主描述**：明杠、暗杠、加杠都使杠链加 1；吃、碰、打出非财神，或打出财神但打出后不再敲响，杠链归零。
- **范围与边界**：包含三类杠对杠链的累加、以及吃/碰/出牌各路径的归零条件；不包含杠链对应的杠开/豪杠番型倍数计算。
- **总体协作**：杠链由服务端按座位维护并用于番型判定，客户端不持有杠链状态，仅在杠动作时区分三类杠、在结算时按服务端 fan_ids 渲染连杠档位番名。

### 原子项

#### `AT-ST-C06-010` 明杠暗杠加杠均使杠链加 1

- **规则说明**：明杠、暗杠、加杠都使杠链加 1。
- **触发条件**：收到 MsgKongS 后，客户端按 comb.flag 区分 CMF_MKONG / CMF_CKONG / CMF_TKONG 三类杠并播对应表现；杠链 +1 由服务端维护。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：三类杠共用 gang Spine 皮肤，音效分别播 GANG（明杠）、AN_GANG（暗杠）、BU_GANG（补杠）；连杠档位最终以结算番名（杠上开花/二连杠/三连杠/四连杠）体现。
- **限制与禁止**：客户端不维护杠链计数字段，无杠链计数与展示。
- **异常与边界**：杠链长度仅能通过结算连杠番名间接观察，无法据客户端代码验证三类杠各自的加 1 行为；结算侧按服务端 fan_ids 渲染 2406~2409 连杠档位番名。
- **验收**：comb.flag 为 CMF_MKONG / CMF_CKONG / CMF_TKONG 时分别映射 TYPE_MKONG / TYPE_CKONG / TYPE_TKONG 动作类型并播对应音效与 gang Spine 动画；结算 fan_ids 命中连杠档位时渲染对应番名。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:50-59；source-code/client/Code/layer/BoxHzmjTipAniView.ts:509-511；source-code/client/Code/config/FanDefine.ts:27-28
- **服务端职责**：下发 MsgKongS（comb.flag 区分三类杠），杠链计数与 +1 由服务端按座位维护并用于番型判定。
- **客户端职责**：客户端不维护杠链计数字段：GameKongCmd 仅按 MsgKongS 的 comb.flag 区分 CMF_MKONG / CMF_CKONG / CMF_TKONG 并映射为三种动作类型；结算侧按服务端 fan_ids 渲染 2406~2409 连杠档位番名。
- **协作边界**：客户端消费 MsgKongS 的 comb.flag 区分三类杠表现、消费结算 fan_ids 渲染番名；杠链累加状态不在客户端。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:50-59
- **原文摘录**：`switch (data.comb?.flag) { case BoxMahDefine.CombType.CMF_MKONG: kongType = BoxMahDefine.ActionAniType.TYPE_MKONG;`

#### `AT-ST-C06-011` 吃使杠链归零

- **规则说明**：吃，杠链归零。
- **触发条件**：吃动作成立（服务端下发吃成功消息）后杠链应归零；归零逻辑不在客户端。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：客户端无杠链字段可清零。
- **异常与边界**：无。
- **验收**：客户端无可验证的杠链复位表现；GameChowCmd 仅做副露 setCombo、桌面出牌移除与听牌视图刷新，不含杠链复位逻辑。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：客户端不持有杠链状态，吃动作仅触发副露与视图刷新；归零判定在服务端。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C06-012` 碰使杠链归零

- **规则说明**：碰，杠链归零。
- **触发条件**：碰动作成立（服务端下发碰成功消息）后杠链应归零；归零逻辑不在客户端。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：客户端无杠链字段可清零。
- **异常与边界**：无。
- **验收**：客户端无可验证的杠链复位表现；GamePungCmd 与吃同构，仅更新副露数据、播碰音效并刷新听牌视图，未见杠链复位实现。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：客户端不持有杠链状态，碰动作仅触发副露与视图刷新；归零判定在服务端。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C06-013` 打出非财神使杠链归零

- **规则说明**：打出非财神，杠链归零。
- **触发条件**：玩家打出非财神牌（上送 MsgPlayC、服务端回 MsgPlayS）后杠链应归零；归零逻辑不在客户端。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：客户端无杠链字段可清零。
- **异常与边界**：无。
- **验收**：客户端无可验证的杠链复位表现；GamePlayCmd 只记录 lastCard、清复盘权限、刷新听牌与操作区，不接触杠链状态。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：客户端不持有杠链状态，出牌仅触发落牌与操作区刷新；归零判定在服务端。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C06-014` 打出财神但未敲响使杠链归零

- **规则说明**：打出财神但打出后不再敲响，杠链归零。
- **触发条件**：玩家打出财神且打出后不再敲响时杠链应归零；归零逻辑不在客户端。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：客户端无杠链字段可清零。
- **异常与边界**：客户端只有飘计数链路（MsgPiao / GamePiaoCmd 写 GameData.updatePiaoState），未见"敲响"判定、飘等级(piao_level)或杠链状态。
- **验收**：客户端无可验证的杠链复位表现；现有代码仅覆盖飘计数链路，无法验证"未敲响则断杠链"。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：客户端不持有杠链状态，仅维护飘计数（updatePiaoState）；敲响判定与杠链归零在服务端。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无
