# 操作优先级

> 阶段 ID：`ST-C04`。来源：模板「行牌 > 操作优先级」章节。客户端视角规格，客户端逻辑与 UI 交互以 Code/Fgui 代码证据支撑。

## 0. 阶段

- **阶段 ID**：`ST-C04`
- **阶段**：操作优先级
- **来源章节**：行牌 > 操作优先级
- **涉及协议消息**：MsgPower、MsgHuC、MsgPungC、MsgKongC、MsgChowC、MsgCancel、MsgHuEx、MsgResultHu、MsgHuItem、MsgChowS、MsgPungS、MsgKongS、MsgPlayS
- **涉及 UI 模块**：box_hzmj_main
- **阶段概述**：同一张弃牌的响应按 点炮胡 > 碰/直杠 > 吃 裁决；胡只成立一人（近者优先、放弃后顺延），低优先级须等全部更高优先级玩家放弃后才执行，吃只能吃上家。

## 术语与单位

| 术语 | 定义 | 单位/量纲 | 作用域 | 来源 |
| --- | --- | --- | --- | --- |
| 放铳 | 打出的牌被他人合法胡走；胡牌者称为点炮胡。白板财神弃牌不能点炮胡。 | 无 | 全局规则 | 模板名词章节（第19行） |
| 财神 | 白板固定为财神。只在胡牌判定时代替顺子、刻子或对子所缺的牌；吃、碰、杠必须用真实的非财神牌。 | 无 | 全局规则 | 模板名词章节（第12行） |
| 吃 | 上家刚打出的1张非财神，与手中2张非财神组成同花色连续顺子；多种合法组合时选1组。 | 张（1张弃牌+2张手牌） | 行牌操作 | 模板 行牌 > 吃、碰、杠（第63行） |
| 碰 | 任意他人刚打出的1张非财神，与手中2张相同非财神组成刻子；手中有3张也只用2张。 | 张（1张弃牌+2张手牌） | 行牌操作 | 模板 行牌 > 吃、碰、杠（第64行） |
| 直杠 | 他人刚打出的1张非财神，与手中3张相同非财神。按优先级裁决后，从牌墙尾部补牌。 | 张（1张弃牌+3张手牌） | 行牌操作 | 模板 行牌 > 吃、碰、杠（第65行） |
| 权限位（POWER_ID_HU/PONG/KONG/CHOW） | MsgPower.power 的位标志，客户端据此展示胡/碰/杠/吃/过按钮；一个权限包只对应一个座位号，由服务端下发唯一可执行权限。 | 位标志 | 客户端操作区 | source-code/client/Code/config/BoxMahDefine.ts:202-210、source-code/client/Code/data/GameData.ts:863-865 |

## 跨切面行为

- **服务端权限位驱动响应**：所有响应动作的可用性由服务端 MsgPower 权限位决定，客户端不做任何优先级比较；吃/碰/杠/胡/过回包统一携带 askid（MsgHuC/MsgChowC/MsgPungC/MsgKongC/MsgCancel），由服务端按 ask 仲裁 —— 跨切面（source-code/client/Code/config/BoxMahDefine.ts:202-210；source-code/client/Code/data/GameData.ts:863-865）
- **操作区强制拦截**：操作区存在胡/杠/碰/吃权限按钮且未点「过」时，canPlayMahCheck 直接弹「点"过"才能出牌」提示并阻止出牌 —— 跨切面（canPlayMahCheck 拦截逻辑，查证结论未提供具体 file:line）
- **一炮多响显示能力残留**：客户端保留了一炮多响的显示能力（duo_xiang 标记、hu_items 数量>1、yipaoduoxiang 动画），与本模板「不一炮多响」冲突，仅在服务端下发多条胡牌记录时才会触发 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:144；source-code/client/Code/layer/BoxHzmjTipAniView.ts:889）
- **托管与自动胡入口残留**：客户端存在托管与自动胡入口（onBtnAutohu/reqTrustee、onShowTrustee），而模板声明无托管（倒计时结束仍等待手动出牌或响应），需要按该玩法屏蔽 —— 跨切面（查证结论未提供具体 file:line）
- **生效动作统一收起操作区**：任一生效动作（出牌、吃、碰、杠）下行后客户端统一派发 onCloseOperate 收起响应按钮并清灰，这是「其余响应取消」的表现层落地 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:44；source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:44；source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:46；source-code/client/Code/controller/cmd/gameCmd/GamePlayCmd.ts:121）

## `FP-ST-C04-001` 弃牌响应的优先级顺序

- **主描述**：同一张弃牌上不同响应动作之间的优先级排序，以及碰与直杠同级时的裁决规则。
- **范围与边界**：仅约束对同一张弃牌的响应裁决，不含出牌权流转、摸打流程、杠后补牌与结算。
- **总体协作**：服务端按优先级完成裁决后以 MsgPower 下发唯一可执行权限与合法组合，客户端只负责按钮展示、组合选择与带 askid 回包。

### 原子项

#### `AT-ST-C04-001` 响应优先级：点炮胡 > 碰/直杠 > 吃

- **规则说明**：对同一张弃牌的响应动作按优先级排序：点炮胡最高，碰/直杠次之，吃最低。
- **触发条件**：任一玩家打出弃牌，且存在一家或多家可对该牌做出胡/碰/直杠/吃响应时，进入优先级裁决。
- **配置影响**：本原子项无独立配置
- **客户端交互**：客户端不做优先级比较，仅依据 MsgPower.power 的权限位同屏展示吃（POWER_ID_CHOW）、碰（POWER_ID_PONG）、杠（POWER_ID_KONG）、胡（POWER_ID_HU）按钮，并把 combs 拆成吃/碰/杠可选组合；点击后带 askid 上行，由服务端裁决最终生效动作。操作区「碰杠胡」页同屏可同时显示吃、碰、杠、胡按钮（布局从左到右为吃、碰、杠、胡），按钮带 spine 光效；胡按钮额外显示所胡牌面与倍数文字（如 128倍）。
- **限制与禁止**：客户端禁止本地做任何优先级比较或排序；吃、碰、杠必须用真实的非财神牌（财神只在胡牌判定中代替所缺牌）；白板财神弃牌不能点炮胡。
- **异常与边界**：按钮物理排列顺序为吃→碰→杠→胡，与优先级方向相反，不应误读为优先级顺序；优先级完全由服务端裁决，客户端无本地排序或比较代码。
- **验收**：同一张弃牌存在多类可响应动作时，客户端按 MsgPower.power 权限位同屏展示对应吃/碰/杠/胡按钮与可选组合，点击回包均携带 askid；客户端代码中不存在本地优先级比较逻辑。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:552；source-code/client/Code/layer/BoxHzmjMainView.ts:554；source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:53；source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:3；source-code/client/Code/layer/BoxHzmjMainView.ts:666
- **服务端职责**：下发 MsgPower（唯一可执行权限与合法组合），按 askid 仲裁 MsgHuC/MsgPungC/MsgKongC/MsgChowC 回包，裁决最终生效动作。
- **客户端职责**：客户端不做优先级比较，仅依据 MsgPower.power 的权限位同时展示吃（POWER_ID_CHOW）、碰（POWER_ID_PONG）、杠（POWER_ID_KONG）、胡（POWER_ID_HU）按钮，并把 combs 拆成吃/碰/杠可选组合；点击后带 askid 上行，由服务端裁决最终生效动作。
- **协作边界**：客户端消费 MsgPower 做按钮展示、组合选择与带 askid 回包；优先级排序与最终裁决全部在服务端。
- **来源文件**：source-code/client/Code/layer/BoxHzmjMainView.ts
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:552
- **原文摘录**：`showChi: (power & BoxMahDefine.PowerType.POWER_ID_CHOW) > 0,`

#### `AT-ST-C04-002` 碰与直杠同级

- **规则说明**：碰与直杠为同级响应，同时能碰和直杠时不区分先后。
- **触发条件**：玩家对同一张弃牌同时持有碰组合（手中2张相同非财神）与直杠组合（手中3张相同非财神）时。
- **配置影响**：本原子项无独立配置
- **客户端交互**：碰按钮与杠按钮可同时可点；杠存在多组组合时展开多杠单牌列表（KW_GangGrps），选中后发送对应 comb。
- **限制与禁止**：客户端不设置碰与杠的先手顺序。
- **异常与边界**：客户端没有「同级」的显式逻辑，只表现为碰、杠按钮可同时展示，实际裁决先后由服务端决定；客户端把暗杠/补杠也统一按杠权限位处理（共用一个 POWER_ID_KONG 与杠组合列表），无法区分直杠与加杠/暗杠的优先级语义。
- **验收**：同一权限包同时含碰组合与杠组合时，碰、杠按钮同时可点且无先后锁定；多杠组合时展开 KW_GangGrps 单牌列表，选中后发送对应 comb。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:553；source-code/client/Code/data/GameData.ts:884；source-code/client/Code/layer/BoxHzmjMainView.ts:654
- **服务端职责**：下发 MsgPower（可同时含碰与杠组合），按 askid 仲裁 MsgPungC/MsgKongC，决定碰与杠的实际生效先后。
- **客户端职责**：客户端把 CMF_PONG 与 CMF_MKONG/CMF_CKONG/CMF_TKONG 分别归入碰组合与杠组合，两者可同时出现在同一权限包中，不设置先手顺序；多杠时用单牌列表供玩家选择。
- **协作边界**：客户端消费 MsgPower 的 combs 展示碰/杠可选组合并回包 MsgPungC/MsgKongC；同级时的裁决先后完全在服务端。
- **来源文件**：source-code/client/Code/layer/BoxHzmjMainView.ts
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:553
- **原文摘录**：`showPeng: (power & BoxMahDefine.PowerType.POWER_ID_PONG) > 0,`

#### `AT-ST-C04-003` 同级时座位号小者先裁决

- **规则说明**：同时能碰和直杠时不区分先后，按座位号小的先裁决。
- **触发条件**：多个玩家对同一张弃牌同时具有同级（碰/直杠）响应资格时。
- **配置影响**：本原子项无独立配置
- **客户端交互**：客户端代码未找到对应实现（待确认）
- **限制与禁止**：无
- **异常与边界**：全仓未找到按座位号比较/排序做响应裁决的逻辑（现有 sort 仅用于牌值、听牌列表、战绩排序），该规则应在服务端实现，需确认服务端是否按 seat 升序裁决。
- **验收**：客户端无按座位号排序/比较的响应裁决代码路径；需另行确认服务端同级响应按座位号升序裁决。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：客户端不做座位号裁决比较，仅被动接收服务端裁决结果；按 seat 升序裁决需在服务端确认。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C04-004` 碰/直杠只下发给一家

- **规则说明**：碰、直杠只发给当前能成立、且座位号最小的那一家。
- **触发条件**：服务端完成同级裁决、确定唯一碰/直杠成立者后下发权限包时。
- **配置影响**：本原子项无独立配置
- **客户端交互**：收到自己座位权限包的客户端弹出操作按钮；其他客户端操作区被关闭（C_BtnState 置空白页），并清灰手牌。
- **限制与禁止**：客户端不做「选择座位号最小的能成立者」的判断，只被动接受「发给谁」的结果。
- **异常与边界**：客户端只保存一个 _curPower 与 _curPowerPlayer；同一时刻仅一个权限者，若服务端对多个座位先后下发权限，客户端会覆盖前一次。
- **验收**：碰/直杠权限包仅一家收到并可展示按钮；权限包座位不是本地座位时操作区收起（C_BtnState 空白页）并清灰手牌。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/GameData.ts:864；source-code/client/Code/data/GameData.ts:865；source-code/client/Code/layer/BoxHzmjMainView.ts:528
- **服务端职责**：下发 MsgPower（仅下发给当前能成立且座位号最小的那一家，一个权限包只对应一个座位号）。
- **客户端职责**：客户端把每个 MsgPower 视为「当前唯一权限者」：只保存一个 _curPower 与 _curPowerPlayer；当权限包座位不是本地座位时直接 closeOperate 收起操作区，只有对应座位的客户端展示吃/碰/杠/胡按钮。
- **协作边界**：客户端消费 MsgPower 判断权限座位是否本地座位并据此展示/收起操作区；「发给谁」的裁决完全在服务端。
- **来源文件**：source-code/client/Code/data/GameData.ts
- **来源定位**：source-code/client/Code/data/GameData.ts:864
- **原文摘录**：`this._curPower = power;`

## `FP-ST-C04-002` 多人可胡的应答与成立判定

- **主描述**：多人同时可胡时的权限下发方式，以及近者与远者之间胡权是否成立的判定。
- **范围与边界**：仅覆盖响应阶段（未结算前）的胡权成立判定，不含结算番型与分数计算。
- **总体协作**：服务端向每个可胡玩家分别下发带 POWER_ID_HU 的 MsgPower，客户端各自显示胡按钮；玩家胡或过后由服务端决定其他玩家胡权是否继续成立。

### 原子项

#### `AT-ST-C04-005` 多人可胡时每家都收到胡

- **规则说明**：多人可胡时，每个可胡玩家都收到胡的响应入口。
- **触发条件**：一张弃牌同时使多名玩家可胡，服务端分别向各可胡玩家下发胡权限时。
- **配置影响**：本原子项无独立配置
- **客户端交互**：每个可胡玩家的客户端都要出现胡的响应入口。胡按钮显示所胡牌面与倍数，并按 hu_type 切换 hu/zimo 皮；每个玩家在自己客户端独立看到胡按钮与「过」按钮。
- **限制与禁止**：无
- **异常与边界**：仓内未找到 @RegisterCmd(CmdNames.CMD_HU_EX) 的处理类（GameResultHuCmd 注释提到原 GameHuExCmd 逻辑已被复用替代），GP_HU_EX 只在重连补数据路径被转发，因此运行期「每家都收到胡」的客户端表现证据不完整，实际依赖 MsgResultHu 的 hu_items。
- **验收**：多人可胡场景中，每个可胡玩家客户端均独立出现胡按钮（含所胡牌面与倍数、按 hu_type 切换皮肤）与「过」按钮；hu_items 数量大于 1 时置 duo_xiang=1。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:583；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:144；source-code/client/Code/controller/gameController.ts:77；source-code/client/Code/controller/cmd/helperCmd/RecoverHuInfoCmd.ts:26
- **服务端职责**：向每个可胡玩家分别下发带 POWER_ID_HU 的 MsgPower；下发 MsgHuEx/MsgResultHu（含 hu_items 多人胡完整数据）。
- **客户端职责**：客户端按自己收到的 MsgPower.power 是否含 POWER_ID_HU 展示胡按钮（KW_BTN_Hu）；多人胡的完整数据通过 MsgHuEx/MsgResultHu 的 hu_items 下发，客户端按 hu_items 数量是否大于 1 生成 duo_xiang 标记。
- **协作边界**：客户端消费 MsgPower 判断是否展示胡按钮、消费 MsgHuEx/MsgResultHu 的 hu_items 生成 duo_xiang 标记；玩家胡或过后其他玩家胡权是否继续成立由服务端决定。
- **来源文件**：source-code/client/Code/layer/BoxHzmjMainView.ts
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:583
- **原文摘录**：`this.view.KW_Main.KW_Handler.KW_BTN_Hu.visible = powerState.showHu;`

#### `AT-ST-C04-006` 近者胡则远者不成立

- **规则说明**：距出牌者更近的可胡玩家（近者）胡牌成立后，远者的胡权不再成立。
- **触发条件**：近者提交胡牌且被服务端判定成立时。
- **配置影响**：本原子项无独立配置
- **客户端交互**：客户端代码未找到对应实现（待确认）
- **限制与禁止**：近者胡成立后，远者胡权不得再成立（需由服务端保证）。
- **异常与边界**：客户端无「出牌者起逆时针距离」的计算，也无远近判定；仅被动接收服务端结算的 hu_items，需服务端保证近者胡后不下发远者胡权。
- **验收**：近者胡牌成立后，远者客户端不再展示胡按钮（以服务端不再下发远者胡权为保证）；客户端无远近判定逻辑。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：客户端仅被动接收服务端下发的权限与结算数据；远近判定与胡权失效完全在服务端。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C04-007` 近者放弃后远者仍可胡

- **规则说明**：近者放弃胡牌后，远者的胡权仍然成立、可以胡牌。
- **触发条件**：近者玩家点击「过」放弃胡牌响应时。
- **配置影响**：本原子项无独立配置
- **客户端交互**：客户端代码未找到对应实现（待确认）
- **限制与禁止**：近者放弃不得使远者胡权失效。
- **异常与边界**：客户端放弃只上行 MsgCancel(seat, askid, flag)，是否把胡权顺延给远者并重新下发 MsgPower 完全由服务端决定，仓内无顺延逻辑。
- **验收**：近者 MsgCancel 放弃后，远者客户端收到新 MsgPower 并重新展示胡按钮（由服务端顺延下发保证）；客户端无顺延状态机。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：客户端放弃仅上行 MsgCancel(seat, askid, flag)；胡权顺延与 MsgPower 重新下发完全由服务端决定。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

## `FP-ST-C04-003` 胡的唯一性与顺位

- **主描述**：只允许一人胡（不一炮多响）、从出牌者起逆时针最近可胡者优先、放弃后顺延的顺位规则。
- **范围与边界**：覆盖胡权顺位与唯一性判定，不含流局与结算展示。
- **总体协作**：客户端仅在收到胡权时展示胡按钮并回包；顺位计算、唯一性保证与顺延重发均在服务端完成。

### 原子项

#### `AT-ST-C04-008` 只允许一人胡，不一炮多响

- **规则说明**：同一张弃牌只允许一人胡牌，不执行一炮多响。
- **触发条件**：多人同时可胡且其中一人胡牌成立进入结算时。
- **配置影响**：本原子项无独立配置
- **客户端交互**：牌桌点炮动画节点按类型播放 dianpao 或 yipaoduoxiang spine 动画。
- **限制与禁止**：不一炮多响；同一张弃牌只允许一人胡。
- **异常与边界**：客户端保留一炮多响动画与 duo_xiang 标记，与本模板「不一炮多响」冲突；实现上依赖服务端只下发一条 hu_items，客户端无兜底限制，若服务端下发多条胡牌记录仍会按一炮多响展示。
- **验收**：本玩法结算仅下发一条 hu_items，duo_xiang=0，播放单胡 dianpao 动画；yipaoduoxiang 动画路径不被触发。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:144；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:323；source-code/client/Code/layer/BoxHzmjTipAniView.ts:889
- **服务端职责**：下发 MsgResultHu（按本玩法仅一条 hu_items，保证只允许一人胡、不一炮多响）。
- **客户端职责**：客户端支持多胡场景的数据与表现：MsgResultHu.hu_items 多于 1 条时置 duo_xiang=1，并据此选择一炮多响动画类型；但代码未做「只允许一人胡」的拦截，若服务端下发多条胡牌记录仍会按一炮多响展示。
- **协作边界**：客户端消费 MsgResultHu 的 hu_items 数量生成 duo_xiang 并选择动画类型；唯一性保证依赖服务端只下发一条记录。
- **来源文件**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:144
- **原文摘录**：`duoXiang: (data.hu_items?.length ?? 0) > 1 ? 1 : 0,`

#### `AT-ST-C04-009` 从出牌者起逆时针最近可胡者优先

- **规则说明**：多人可胡时，从出牌者起按逆时针方向，最近的可胡者优先。
- **触发条件**：多人同时可胡、进入胡权顺位裁决时。
- **配置影响**：本原子项无独立配置
- **客户端交互**：胡牌标识节点 KW_Hu_Index_n 按 hu_idx 对应的 C_HuType 页展示（胡牌类型的桌面角标）。
- **限制与禁止**：客户端不对各可胡玩家做逆时针距离计算或排序。
- **异常与边界**：hu_idx 只用于胡牌标识/结算展示，未参与响应阶段顺位裁决；逆时针与「最近」判定在客户端缺失。
- **验收**：胡牌玩家桌面按服务端下发的 hu_idx 正确展示 KW_Hu_Index_n 胡牌标识（C_HuType 对应页）；顺位裁决由服务端保证。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/PlayerCardsData.ts:281；source-code/client/Code/layer/BoxHzmjMainView.ts:1666
- **服务端职责**：下发 MsgResultHu/MsgHuItem（含 hu_idx 胡序与最终胡牌者，按出牌者起逆时针最近者优先裁决）。
- **客户端职责**：客户端仅保存服务端下发的 hu_idx（胡序）并在牌桌上展示胡牌标识，不做逆时针距离计算，也不对各可胡玩家排序。
- **协作边界**：客户端消费 MsgResultHu/MsgHuItem 的 hu_idx 仅做桌面胡牌标识展示；逆时针距离与「最近」顺位计算在服务端。
- **来源文件**：source-code/client/Code/data/PlayerCardsData.ts
- **来源定位**：source-code/client/Code/data/PlayerCardsData.ts:281
- **原文摘录**：`this._huIndex = data.hu_idx ?? 0;`

#### `AT-ST-C04-010` 最近可胡者放弃后顺延

- **规则说明**：最近的可胡者放弃后，胡权顺延给下一位可胡者。
- **触发条件**：最近可胡者点击「过」放弃胡牌时。
- **配置影响**：本原子项无独立配置
- **客户端交互**：客户端代码未找到对应实现（待确认）
- **限制与禁止**：无
- **异常与边界**：客户端放弃只发 MsgCancel，无顺延状态机；若服务端把胡权顺延给下一家，客户端只会收到新的 MsgPower 再展示胡按钮，属于服务端驱动。
- **验收**：最近可胡者放弃后，顺延目标客户端收到新 MsgPower 并重新展示胡按钮（由服务端驱动）；客户端无本地顺延逻辑。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：客户端放弃仅上行 MsgCancel；顺延计算与 MsgPower 重新下发在服务端完成。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

## `FP-ST-C04-004` 低优先级提交与等待

- **主描述**：低优先级动作先提交时的等待规则，以及更高优先级动作成立后其余响应的取消。
- **范围与边界**：覆盖响应提交到执行之间的等待与取消，不含出牌后的摸打流程。
- **总体协作**：客户端提交后立即上行并收起按钮；执行时机、等待高优先级放弃、取消其余响应均由服务端裁决，客户端在收到结果消息后收起操作区。

### 原子项

#### `AT-ST-C04-011` 低优先级先提交需等高优先级放弃

- **规则说明**：低优先级响应先提交时，须等全部更高优先级的玩家手动放弃后，该低优先级动作才执行。
- **触发条件**：低优先级玩家（如吃家）先于更高优先级玩家提交响应时。
- **配置影响**：本原子项无独立配置
- **客户端交互**：提交后 KW_Handler.C_BtnState 立即切到空白页、清除手牌置灰与选吃回调，界面上不再显示等待态。
- **限制与禁止**：本玩法无托管：倒计时结束仍等待手动出牌或响应，不得自动提交或自动胡；客户端现有托管/自动胡入口需按该玩法屏蔽，否则会破坏该等待语义。
- **异常与边界**：客户端无「等待更高优先级放弃中」的界面或超时处理；动作是否执行取决于服务端随后下发的 MsgChowS/MsgPungS/MsgKongS。
- **验收**：吃/碰/杠点击后立即上行（sendChow/sendPung/sendKong）且 C_BtnState 切回空白页、无本地等待提示；动作是否生效以服务端下发的 MsgChowS/MsgPungS/MsgKongS 为准。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1102；source-code/client/Code/layer/BoxHzmjMainView.ts:1103；source-code/client/Code/controller/gameController.ts:499
- **服务端职责**：按 askid 仲裁 MsgChowC/MsgPungC/MsgKongC 提交与 MsgCancel 放弃，待全部更高优先级玩家手动放弃后再下发 MsgChowS/MsgPungS/MsgKongS 执行。
- **客户端职责**：客户端点击吃/碰/杠后立即打开发送（sendChow/sendPung/sendKong）并把操作区切回空白页，没有「等待更高优先级全部放弃」的本地状态或提示；动作是否执行取决于服务端随后下发的 MsgChowS/MsgPungS/MsgKongS。
- **协作边界**：客户端消费 MsgChowS/MsgPungS/MsgKongS 得知动作是否生效；等待更高优先级放弃的逻辑完全在服务端。
- **来源文件**：source-code/client/Code/layer/BoxHzmjMainView.ts
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1102
- **原文摘录**：`GameController.instance.sendChow(comb);`

#### `AT-ST-C04-012` 更高优先级成立后其余响应取消

- **规则说明**：更高优先级的响应一旦成立，其余玩家的响应全部取消。
- **触发条件**：服务端裁决某响应成立并下发生效消息（MsgChowS/MsgPungS/MsgKongS），或本地出牌 MsgPlayS 下行时。
- **配置影响**：本原子项无独立配置
- **客户端交互**：操作区 C_BtnState 置空白页、隐藏吃/碰/杠/胡/过按钮，隐藏多吃多杠选择池，并恢复手牌可点状态（已胡则保持）。
- **限制与禁止**：无
- **异常与边界**：取消行为对任意生效动作无条件执行，没有「高优先级」判定，属服务端裁决后的表现层收尾；被取消方不会收到单独「取消」消息，只会在下一次 MsgPower 到来时刷新按钮。
- **验收**：收到 MsgChowS/MsgPungS/MsgKongS/MsgPlayS 任一后，所有客户端统一触发 onCloseOperate：操作区切空白页、按钮隐藏、多吃多杠选择池隐藏、手牌恢复可点（已胡保持）。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:44；source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:44；source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:46；source-code/client/Code/layer/BoxHzmjMainView.ts:494；source-code/client/Code/controller/cmd/gameCmd/GamePlayCmd.ts:121
- **服务端职责**：下发 MsgChowS/MsgPungS/MsgKongS/MsgPlayS（生效动作结果，客户端据此统一收起操作区，等价取消其余响应）。
- **客户端职责**：客户端在收到 MsgChowS/MsgPungS/MsgKongS 或自己出牌的 MsgPlayS 后统一派发 onCloseOperate，收起整个操作区、清除吃碰杠置灰与选牌回调，等价于取消自己剩余的响应入口。
- **协作边界**：客户端消费 MsgChowS/MsgPungS/MsgKongS/MsgPlayS 触发 onCloseOperate 收尾；「更高优先级成立、其余取消」的裁决在服务端。
- **来源文件**：source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:44
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.onCloseOperate);`

## `FP-ST-C04-005` 吃的上家限制

- **主描述**：吃只能吃上家刚打出的牌这一合法性约束。
- **范围与边界**：仅约束吃的来源座位，不含吃牌组合选择与后续出牌流程。
- **总体协作**：服务端只在合法时下发带 POWER_ID_CHOW 的权限包与 CMF_CHOW 组合，客户端据此展示吃按钮与可吃牌型。

### 原子项

#### `AT-ST-C04-013` 吃只能吃上家

- **规则说明**：吃牌只能吃上家刚打出的牌。
- **触发条件**：上家打出弃牌且本地手牌可与该牌组成合法顺子时（合法性由服务端判定并下发组合）。
- **配置影响**：本原子项无独立配置
- **客户端交互**：吃按钮存在多组组合时展开多吃牌面选择池（完整三张顺子）并显示取消按钮，选定后发送吃请求。
- **限制与禁止**：吃只能吃上家；所吃之牌必须为非财神，且手中 2 张组牌牌也必须为非财神（吃必须用真实的非财神牌）。
- **异常与边界**：客户端有本地座位关系枚举（PLAYER_3=上家），但未用于吃牌合法性判断，也没有对「最近出牌者」的归属校验；合法性完全依赖服务端不下发非上家的吃组合。
- **验收**：客户端仅在 MsgPower 下发含 flag=CMF_CHOW 组合时展示吃按钮与可吃牌型（多吃时展开选择池）；吃请求把选中组合原样上行 MsgChowC；客户端无上家归属的本地校验。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1023；source-code/client/Code/data/GameData.ts:887；source-code/client/Code/config/GameDefine.ts:46
- **服务端职责**：下发 MsgPower（仅在上家牌可吃时携带 POWER_ID_CHOW 与 CMF_CHOW 组合，保证吃只能吃上家），仲裁 MsgChowC。
- **客户端职责**：客户端吃的可选项完全来自 MsgPower.combs 中 flag=CMF_CHOW 的组合（按索引存入 _chowCombInfo），不做「出牌者是否为上家」的本地校验；点击吃时把选中组合原样上行。
- **协作边界**：客户端消费 MsgPower 的 CMF_CHOW 组合展示可吃牌型并上行 MsgChowC；上家归属校验完全在服务端。
- **来源文件**：source-code/client/Code/layer/BoxHzmjMainView.ts
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1023
- **原文摘录**：`if (comb.flag === BoxMahDefine.CombType.CMF_CHOW) {`
