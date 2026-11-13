# 吃、碰、杠

> 阶段 ID：`ST-C05`。来源：模板「行牌 > 吃、碰、杠」章节。客户端视角规格，客户端逻辑与 UI 交互以 Code/Fgui 代码证据支撑。

## 0. 阶段

- **阶段 ID**：`ST-C05`
- **阶段**：吃、碰、杠
- **来源章节**：行牌 > 吃、碰、杠
- **涉及协议消息**：MsgPower、MsgChowC、MsgChowS、MsgPungC、MsgPungS、MsgKongC、MsgKongS、MsgTake、MsgPiao、MsgPlayLmts、MsgTanUpdate、MsgHuC、MsgHuEx、MsgResultHu
- **涉及 UI 模块**：box_hzmj_main、box_hzmj_mah2D_Main、box_hzmj_tipAni、box_hzmj_result
- **阶段概述**：定义吃、碰、直杠、加杠、暗杠的成立条件，说明杠的补牌与抢杠胡处理、暗杠展示方式，以及飘财限制下的禁用范围；客户端只负责按服务端下发的权限显示响应按钮，并完成多吃、多杠选择、副露展示和动作效果。

## 术语与单位

| 术语 | 定义 | 单位/量纲 | 作用域 | 来源 |
| --- | --- | --- | --- | --- |
| 面子 | 一组顺子、刻子或杠。杠含 4 张，仍计 1 组面子；对子不是面子；已完成的吃、碰、明杠、暗杠都计入面子。 | 组 | 全局规则 | 模板名词章节（第11行） |
| 财神 | 白板固定为财神，只在胡牌判定时代替所缺的牌；吃、碰、杠必须使用真实的非财神牌。 | 张（固定牌面白板） | 全局规则 | 模板名词章节（第12行） |
| 摊 | A 吃进 B 打出的牌，A 对 B 记 1 摊；碰、直杠、加杠、暗杠不计摊，每小局重新累计。 | 次 | 每小局（吃牌记摊） | 模板名词章节（第14行） |
| 飘 | 自己出牌阶段打出财神即飘财 1 次，连续打出累加，打出普通牌清零，每小局从 0 次起算。 | 次 | 每小局（自己出牌阶段） | 模板名词章节（第18行） |

## 跨切面行为

- **服务端权限驱动吃碰杠合法性**：吃、碰、杠的合法性与优先级完全由服务端裁决：客户端只读取 MsgPower.power 的 POWER_ID_CHOW/PONG/KONG 位决定是否显示按钮，并用 MsgPower.combs 填充可选项，本地不做花色、财神或张数的合法性校验 —— 跨切面（source-code/client/Code/layer/BoxHzmjMainView.ts:552；source-code/client/Code/data/GameData.ts:886）
- **未处理响应按钮时禁止直接出牌**：有吃、碰、杠、胡按钮未处理时不允许直接出牌，点击手牌会弹出“点‘过’才能出牌”提示，必须点过或过2（GameEventBoxHzmj.onCloseOperate 收起按钮） —— 跨切面（source-code/client/Code/layer/BoxHzmjMainView.ts:1453）
- **杠与摸牌无关时手牌不置灰**：当杠与本次摸入的牌无关（_isGangOffMoCard，即加杠/暗杠场景）时，不置灰手牌、可直接出牌；其余吃碰杠场景会置灰除相关牌值外的所有手牌 —— 跨切面（source-code/client/Code/layer/BoxHzmjMainView.ts:692）
- **响应倒计时纯展示**：响应倒计时只是纯展示：setClock 在剩余 3 秒时播放倒计时音，超过 8 秒仅对其他玩家弹出“提示操作”气泡，倒计时归零不自动出牌、不自动过，对齐“无托管”设定 —— 跨切面（source-code/client/Code/layer/BoxHzmjMah2DView.ts:675）
- **吃碰杠举手动画统一通道**：吃、碰、杠的举手动画统一走 onMsgPlayPengGang，切换 chi/peng/gang 的 Spine skin 并播放对应音效；暗杠使用 AN_GANG 音效、补杠使用 BU_GANG 音效 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:42；source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:61；source-code/client/Code/layer/BoxHzmjTipAniView.ts:509）
- **重连补数据只写缓存**：重连补数据阶段（notification.getType() === 'justUpdateData'）只写入数据缓存，不派发副露、动画或按钮事件，避免重连重复播动画 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:25；source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:25；source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:25）
- **番型摊数与抢杠结算服务端下发**：番型（含杠后是否按七对结算）、摊计数、抢杠结算均由服务端下发，客户端只按 fan_ids / tan_items 做名称、倍数与动画的映射展示 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GameTanUpdateCmd.ts:21）

## `FP-ST-C05-001` 风箭牌与财神的吃碰杠资格限制

- **主描述**：风牌、箭牌不具备顺子资格，不能吃；非财神的风箭牌可以碰、杠；吃碰杠只能使用真实非财神牌。
- **范围与边界**：只约束吃碰杠的牌面资格，不涉及胡牌判定中财神替牌。
- **总体协作**：资格由服务端在 MsgPower.combs 中过滤，客户端按 comb.flag 分类展示。

### 原子项

#### `AT-ST-C05-001` 风牌箭牌不能做顺子、不能吃

- **规则说明**：风牌、箭牌不能做顺子，因此不能被吃；吃所组成的必须是同花色连续顺子，而顺子仅限万、条、筒花色，风（MF_FENG）、箭（MF_JIAN）花色不参与顺子判定。
- **触发条件**：服务端下发含 POWER_ID_CHOW 的 MsgPower 时（吃组合由服务端在 combs 中过滤，不含风牌、箭牌）；客户端本地摸牌凑顺子光效判定时。
- **配置影响**：花色枚举由 BoxMahDefine.MahType 配置（MF_WAN/MF_TIAO/MF_TONG 为顺子合法花色，MF_FENG=4、MF_JIAN=5 不参与顺子）。
- **客户端交互**：客户端不做吃牌花色校验，吃选项直接按服务端 MsgPower.combs 下发的 CMF_CHOW 组合展示；仅摸牌凑顺子光效在本地把顺子限定为万、条、筒，风牌/箭牌不参与顺子光效。
- **限制与禁止**：风牌、箭牌禁止做顺子、禁止被吃；客户端无吃牌花色校验，该禁止完全依赖服务端不下发含风牌、箭牌的 CMF_CHOW 组合。
- **异常与边界**：客户端没有吃牌合法性校验；代码中的顺子花色限制只存在于摸牌凑牌光效（GameTakeCmd），不影响吃组合展示。
- **验收**：摸牌凑顺子光效对非万、条、筒花色判定不成立（返回 result=false）；客户端代码中无吃组合花色校验分支；吃选项内容与服务端下发 combs 一致。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:230；source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:232；source-code/client/Code/config/BoxMahDefine.ts:247
- **服务端职责**：下发 MsgPower（POWER_ID_CHOW 位与 CMF_CHOW 组合，保证组合不含风牌、箭牌），下发 MsgChowS 广播吃结果。
- **客户端职责**：吃牌组合完全由服务端 MsgPower.combs 下发，客户端不校验花色；仅摸牌凑顺子光效把顺子限定为万、条、筒，风牌/箭牌不参与顺子判定。
- **协作边界**：客户端消费 MsgPower.combs 生成吃选项、消费 MsgChowS 落地副露；本地仅做摸牌凑顺子光效的花色限定，不做吃合法性判断。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:230
- **原文摘录**：`// 顺子仅条万筒（逻辑牌值；翻财神白板已映射为财神牌）`

#### `AT-ST-C05-002` 风箭牌非财神时可碰、可杠

- **规则说明**：风牌、箭牌在不是财神时可以碰、杠，即非财神的风、箭牌具有碰与杠资格。
- **触发条件**：MsgPower.power 含 POWER_ID_PONG/POWER_ID_KONG 且 combs 中包含以非财神风、箭牌为牌值的 CMF_PONG 或 CMF_MKONG/CMF_CKONG/CMF_TKONG 组合时。
- **配置影响**：组合按 BoxMahDefine.CombType（CMF_PONG、CMF_MKONG、CMF_CKONG、CMF_TKONG）经 setCurPower 分类归入碰列表或杠列表。
- **客户端交互**：满足权限位时 KW_BTN_Peng / KW_BTN_Gang 显示并按 hz 布局排布。
- **限制与禁止**：无花色维度的禁止性约束；客户端对碰杠组合不区分花色（无显式风箭牌判断）。
- **异常与边界**：无显式风箭牌判断，属间接证据：客户端对碰杠组合不按花色过滤，任何牌值的碰杠组合都能正常展示与落地。
- **验收**：服务端下发含非财神风、箭牌的碰、杠组合时，客户端能正常显示碰/杠按钮并完成副露落地（按 comb.flag 分类，不按花色过滤）。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/GameData.ts:878；source-code/client/Code/data/GameData.ts:881
- **服务端职责**：下发 MsgPower（POWER_ID_PONG/POWER_ID_KONG 位及非财神风箭牌的碰、杠组合），下发 MsgPungS/MsgKongS 广播碰、杠结果。
- **客户端职责**：碰/杠按钮与组合来自 MsgPower，setCurPower 按 comb.flag 把组合归入碰、杠列表，不按花色过滤，因此风箭牌碰杠可以正常展示与落地。
- **协作边界**：客户端消费 MsgPower 的权限位与组合列表驱动按钮显示；本地不按花色过滤碰杠组合。
- **来源文件**：`source-code/client/Code/data/GameData.ts`
- **来源定位**：source-code/client/Code/data/GameData.ts:878
- **原文摘录**：`case BoxMahDefine.CombType.CMF_PONG: this._pongCombInfo.push(comb as ICombInfo); break;`

#### `AT-ST-C05-003` 吃碰杠只能使用真实非财神牌

- **规则说明**：吃、碰、杠必须使用真实的非财神牌；不能用财神牌本身参与吃碰杠，也不能用财神代替所缺的牌（财神只在胡牌判定中代替所缺的牌）。
- **触发条件**：任意吃、碰、杠组合成立时，参与组合的牌面均应为真实非财神牌值。
- **配置影响**：财神牌值由 GameData.jokerMah 配置，isJokerMah 据此判定财神牌，用于副露展示标色与排序。
- **客户端交互**：副露中财神牌按 isJokerMah 上色，杠组财神靠左显示。
- **限制与禁止**：禁止财神牌参与吃、碰、杠；禁止用财神替牌组成吃碰杠组合。
- **异常与边界**：该规则未在客户端落地为校验；财神相关的客户端代码（isJokerMah）只服务于副露展示排序，说明财神牌在副露中按真实牌值显示，而非替牌。
- **验收**：副露区落地时财神牌按 isJokerMah 上色、杠组财神靠左展示；客户端代码中不存在财神参与吃碰杠的校验或拦截逻辑。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/GameData.ts:1831；source-code/client/Code/data/PlayerCardsData.ts:133；source-code/client/Code/config/BoxMahDefine.ts:804
- **服务端职责**：下发 MsgPower 与 MsgChowS/MsgPungS/MsgKongS，保证吃碰杠组合全部由真实非财神牌组成。
- **客户端职责**：客户端无财神参与吃碰杠的拦截逻辑；isJokerMah 只在副露展示（财神靠左/牌面色）与结算排序中使用，说明财神牌在副露中按真实牌值显示，而非替牌。
- **协作边界**：客户端消费 MsgPower 与吃碰杠结果消息落地副露；本地仅用 isJokerMah 做展示层财神标色与排序，不做资格判断。
- **来源文件**：`source-code/client/Code/data/GameData.ts`
- **来源定位**：source-code/client/Code/data/GameData.ts:1831
- **原文摘录**：`isJokerMah(mah: number): boolean { const jokerMah = this.jokerMah; if (!jokerMah || !mah) { return false; } return mah === jokerMah; }`

## `FP-ST-C05-002` 吃的成立条件

- **主描述**：吃只取上家刚打出的 1 张非财神，与手中 2 张非财神组成同花色连续顺子。
- **范围与边界**：约束进张来源、财神排除与顺子牌型，不涉及吃后流程。
- **总体协作**：服务端下发 CMF_CHOW 组合（含 mahs 与 in_mahs），客户端负责副露落地与来源箭头绘制。

### 原子项

#### `AT-ST-C05-004` 吃只取上家刚打出的 1 张牌

- **规则说明**：吃只能取上家刚打出的 1 张弃牌作为进张参与组成顺子，不能用其他座位的弃牌或先前回合的弃牌。
- **触发条件**：上家打出牌后，服务端向本家下发含 CMF_CHOW 组合（含 from_seat、mahs、in_mahs）的 MsgPower；吃确认后客户端收到 MsgChowS。
- **配置影响**：本原子项无独立配置
- **客户端交互**：副露区显示来源箭头（comboSefl/comboLeft/comboRight 的 n4、comboOpposite 的 n5）指向吃进的那张牌。
- **限制与禁止**：只能用上家刚打出的 1 张牌；客户端不校验进张是否来自上家，是否上家由服务端保证。
- **异常与边界**：setCombo 仅在出牌者河牌最后一张与 combo.in_mahs[0] 一致时才从河牌弹出，避免误删。
- **验收**：MsgChowS 落地后，出牌者河牌最后 1 张（与 in_mahs[0] 一致时）被移除；吃方副露新增顺子组并按相对方位绘制来源箭头。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/PlayerCardsData.ts:146；source-code/client/Code/data/PlayerCardsData.ts:91；source-code/client/Code/layer/BoxHzmjMah2DView.ts:935
- **服务端职责**：下发 MsgPower（CMF_CHOW 组合含 from_seat，保证进张来自上家刚打出的牌），接收 MsgChowC，下发 MsgChowS。
- **客户端职责**：客户端从 combo.from_seat 换算出进张来源座位，setCombo 时把该张牌从出牌者河牌中弹出，并把 nFromSeat 记录为相对方位；副露渲染后按进牌实际槽位调整来源箭头位置。
- **协作边界**：客户端消费 MsgPower/MsgChowC/MsgChowS；本地只做来源方位换算、河牌弹出与箭头绘制，不校验是否上家。
- **来源文件**：`source-code/client/Code/data/PlayerCardsData.ts`
- **来源定位**：source-code/client/Code/data/PlayerCardsData.ts:146
- **原文摘录**：`const fromSeatEx = TableData.inst.seatToLocal(combo.from_seat); comboData.nSeat = fromSeatEx;`

#### `AT-ST-C05-005` 吃的进张必须是非财神

- **规则说明**：吃所取的 1 张进张必须是非财神牌，财神不能作为吃的进张，也不能用财神替牌充当进张。
- **触发条件**：服务端下发 MsgChowS 时，comb.in_mahs[0] 应为非财神牌值。
- **配置影响**：本原子项无独立配置
- **客户端交互**：吃结果落地时无进张财神校验；副露中的财神牌仅按 isJokerMah 上色展示。
- **限制与禁止**：财神牌不能作为吃的进张。
- **异常与边界**：无直接实现证据，只能说明客户端不做该判断；进张非财神由服务端保证。
- **验收**：MsgChowS 落地流程中无财神分支；comb.in_mahs 不含财神牌值（服务端侧验收）。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:34；source-code/client/Code/data/GameData.ts:1836
- **服务端职责**：下发 MsgChowS，保证 in_mahs 进张为非财神牌。
- **客户端职责**：GameChowCmd 直接把服务端 comb 交给 setCombo 落地，无财神判断；财神仅在副露展示时按 isJokerMah 上色。
- **协作边界**：客户端消费 MsgChowS 直接落地；本地无进张财神校验。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:34
- **原文摘录**：`const comboData = GameData.getPlayerCardsData(localSeat)?.setCombo(data.comb as ICombInfo, data.seat);`

#### `AT-ST-C05-006` 吃须与手中 2 张组成同花色连续顺子

- **规则说明**：吃进的 1 张非财神牌须与手中 2 张非财神牌组成同花色、点数连续的顺子。
- **触发条件**：MsgPower.combs 中存在 CMF_CHOW 组合（mahs 已是完整三张顺子）时。
- **配置影响**：吃/碰/顺子的展示排序由 BoxMahDefine 统一配置为按牌值升序（财神按缺口/替身插位）。
- **客户端交互**：多吃选项池中每项展示完整顺子三张牌，组内从左到右按牌值升序。
- **限制与禁止**：组合必须同花色连续；客户端不本地校验，牌型合法性（同花色、连续）完全由服务端判定并下发。
- **异常与边界**：mahs 由服务端给出完整三张，客户端只提取组合展示，不校验同花色与连续性。
- **验收**：吃选项与副露显示的每组三张牌为服务端下发 mahs 原值，组内按牌值升序从左到右排列。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1031；source-code/client/Code/config/BoxMahDefine.ts:799；source-code/client/Code/data/GameData.ts:886
- **服务端职责**：下发 MsgPower（CMF_CHOW 组合的 mahs 为完整三张顺子，保证同花色连续），接收 MsgChowC。
- **客户端职责**：顺子组合由服务端 MsgPower.combs 中的 CMF_CHOW 项给出（mahs 已是完整三张）；客户端只提取该组合展示、按牌值升序摆放并显示完整三张供选择。
- **协作边界**：客户端消费 MsgPower.combs 的 CMF_CHOW 组合生成选项与副露；本地仅做牌值升序展示，不做牌型校验。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1031
- **原文摘录**：`private _getChowMahRows(): number[][] { const rows: number[][] = []; for (const comb of this._getChowCombs()) { const raw = comb.mahs; ... rows.push(mahs); }`

## `FP-ST-C05-003` 吃牌多组合选择与吃后流程

- **主描述**：存在多种合法吃法时玩家选 1 组；吃成功后不摸牌直接进入出牌；吃成立的当前回合仍可加杠或暗杠。
- **范围与边界**：覆盖吃按钮点击、多吃选择池、吃成功后的权限衔接。
- **总体协作**：客户端按 power 位显示吃按钮，按 CMF_CHOW 组合数量决定是否弹选择池，发送 MsgChowC 后以 MsgPower 进入出牌。

### 原子项

#### `AT-ST-C05-007` 多种合法组合时选择 1 组

- **规则说明**：存在多种合法吃法（多组顺子）时，玩家须从中选择 1 组完成吃。
- **触发条件**：MsgPower 中 CMF_CHOW 组合数量大于 1 且玩家点击吃按钮时。
- **配置影响**：按钮状态页签 C_BtnState index 5 承载多吃/多杠选择界面。
- **客户端交互**：吃按钮点击后切换到“选择多杠”页签（C_BtnState index 5），右侧弹出多吃选项池，每项带高亮底框与完整三张牌；取消按钮（KW_BTN_Cancel）回到吃按钮状态。
- **限制与禁止**：多组时必须先经选择池选定 1 组才能发送 MsgChowC。
- **异常与边界**：仅 1 组时不弹选择池，点击吃按钮直接发送。
- **验收**：CMF_CHOW 组合数大于 1 时点击吃按钮弹出多吃选项池且每项展示完整顺子三张；点击选项后按所选项发送 MsgChowC；组合数为 1 时直接发送；取消按钮可回到吃按钮状态。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1088；source-code/client/Code/layer/BoxHzmjMainView.ts:1113；source-code/client/Code/layer/BoxHzmjMainView.ts:899；source-code/client/Code/data/GameData.ts:779；source-code/client/Code/controller/gameController.ts:485
- **服务端职责**：下发 MsgPower 含 1 组或多组 CMF_CHOW 组合，接收携带所选组合的 MsgChowC。
- **客户端职责**：_updateChiPower 统计 CMF_CHOW 组合数；onBtnChi 在数量大于 1 时调 showChooseChi，弹出多吃选项池（每个选项一整套顺子三张），点击后回写 _chooseChi 并通过 GameData.getChowCombInfo(idx) 取组合发送 MsgChowC；仅 1 组时直接发送。
- **协作边界**：客户端消费 MsgPower.combs 统计组合数并渲染选择池，发送 MsgChowC 携带所选组合；本地不做吃组合合法性判断。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1088
- **原文摘录**：`onBtnChi(): void { if (this._chooseChiLength > 1) { this.showChooseChi(true); return; } this.onBtnChooseChi(); }`

#### `AT-ST-C05-008` 吃成功后不摸牌直接进入出牌

- **规则说明**：吃成功后玩家不摸牌，直接进入出牌阶段。
- **触发条件**：客户端收到 MsgChowS（吃成功广播），随后收到含 POWER_ID_PLAY 的 MsgPower。
- **配置影响**：本原子项无独立配置
- **客户端交互**：吃动画播放后收起吃碰杠按钮与出牌大牌显示；下一次出牌权限到达后手牌可点出。
- **限制与禁止**：吃成功后客户端自身不添加摸牌；“不摸牌”是服务端不下发 MsgTake 的结果。
- **异常与边界**：客户端没有显式断言或校验“不摸牌”，完全依赖服务端消息时序。
- **验收**：MsgChowS 后状态切到 MAH_STATE_CHOW、翻牌权限清理、出牌大牌 UI 隐藏、操作面板关闭；后续 MsgPower 含 POWER_ID_PLAY 时 _selfHand.canPutCard 为真且未添加摸牌。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:32；source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:42；source-code/client/Code/layer/BoxHzmjMainView.ts:536
- **服务端职责**：下发 MsgChowS 广播吃结果，随后下发含 POWER_ID_PLAY 的 MsgPower 打开出牌权，且不向吃牌者下发 MsgTake。
- **客户端职责**：GameChowCmd 收到 MsgChowS 后设置状态为 MAH_STATE_CHOW、清理翻牌权限、把进张从出牌区移除并关闭操作面板，自身不添加摸牌；随后由下一条 MsgPower 的 POWER_ID_PLAY 打开手牌可出牌状态（_selfHand.canPutCard）。
- **协作边界**：客户端消费 MsgChowS 与后续 MsgPower；本地只做状态切换与 UI 收起，不判断是否摸牌。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:32
- **原文摘录**：`GameData.setTableState(MahGameState.MAH_STATE_CHOW); GameData.clearFuPanPower();`

#### `AT-ST-C05-009` 吃成立的当前回合可以加杠或暗杠

- **规则说明**：吃成功的当前回合，玩家仍可以进行加杠或暗杠。
- **触发条件**：吃后同一条 MsgPower 同时给出 POWER_ID_PLAY 与 POWER_ID_KONG，且 combs 附带 CMF_TKONG/CMF_CKONG 组合。
- **配置影响**：本原子项无独立配置
- **客户端交互**：杠/过按钮与手牌可出状态并存；未点过时直接出牌会提示“点‘过’才能出牌”。
- **限制与禁止**：客户端没有“吃后当回合”的状态机显式限制，完全依赖同一条 MsgPower 的位与组合。
- **异常与边界**：_updateGangOffMoCard 会识别杠与摸牌无关（加杠/暗杠场景）并允许直接出牌。
- **验收**：吃后 MsgPower 同时含 PLAY 与 KONG 位时，杠按钮与可出牌状态同时显示；杠与摸牌无关时手牌不置灰。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:549；source-code/client/Code/layer/BoxHzmjMainView.ts:692
- **服务端职责**：吃后当回合下发同时含 POWER_ID_PLAY 与 POWER_ID_KONG（附带 CMF_TKONG/CMF_CKONG 组合）的 MsgPower，接收 MsgKongC。
- **客户端职责**：吃后同一回合若服务端在 MsgPower 中同时给出 POWER_ID_PLAY 与 POWER_ID_KONG，并附带 CMF_TKONG/CMF_CKONG 组合，客户端会同时显示杠按钮与可出牌状态，_updateGangOffMoCard 会识别杠与摸牌无关并允许直接出牌。
- **协作边界**：客户端消费 MsgPower 权限位与杠组合；本地无“吃后当回合”的状态限制，仅按 _isGangOffMoCard 决定手牌置灰。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:549
- **原文摘录**：`showChi: (power & BoxMahDefine.PowerType.POWER_ID_CHOW) > 0, showPeng: ..., showGang: (power & BoxMahDefine.PowerType.POWER_ID_KONG) > 0, canPlay: (power & BoxMahDefine.PowerType.POWER_ID_PLAY) > 0 && !hasHu,`

## `FP-ST-C05-004` 碰的成立条件与碰后流程

- **主描述**：碰取任意他人刚打出的 1 张非财神，与手中 2 张相同非财神组成刻子；手中有 3 张也只用 2 张；碰后不摸牌进入出牌，当回合可加杠或暗杠。
- **范围与边界**：覆盖碰的牌面条件、张数消耗、碰后权限衔接。
- **总体协作**：服务端下发 CMF_PONG 组合，客户端从手牌移除 2 张并把进张并入副露。

### 原子项

#### `AT-ST-C05-010` 碰取任意他人刚打出的 1 张非财神

- **规则说明**：碰可取任意他人（不限于上家）刚打出的 1 张非财神牌作为进张，与手中 2 张相同牌组成刻子。
- **触发条件**：任意玩家打出牌后，服务端向有碰权限者下发含 CMF_PONG 组合的 MsgPower；碰确认后客户端收到 MsgPungS。
- **配置影响**：本原子项无独立配置
- **客户端交互**：副露区新增碰组并绘制来源箭头指向进张。
- **限制与禁止**：进张须为任意他人刚打出的 1 张非财神牌；客户端不校验来源是否为自己上家或是否为财神。
- **异常与边界**：“任意他人”“非财神”均为服务端保证，客户端无对应判断代码。
- **验收**：MsgPungS 落地后，来源玩家河牌中该进张被移除，碰方副露新增碰组并显示来源箭头。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:34；source-code/client/Code/data/PlayerCardsData.ts:87
- **服务端职责**：下发 MsgPower（CMF_PONG 组合含 from_seat，进张保证来自任意他人刚打出的非财神牌），接收 MsgPungC，下发 MsgPungS。
- **客户端职责**：GamePungCmd 接收 MsgPungS 的 comb（含 from_seat、mahs、in_mahs），把进张从来源玩家河牌移除并记录来源座位用于箭头，不校验来源是否为自己上家或是否为财神。
- **协作边界**：客户端消费 MsgPower/MsgPungC/MsgPungS；本地仅做来源座位换算、河牌移除与箭头绘制。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:34
- **原文摘录**：`const comboData = GameData.getPlayerCardsData(localSeat)?.setCombo(data.comb as ICombInfo, data.seat);`

#### `AT-ST-C05-011` 与手中 2 张相同非财神组成刻子

- **规则说明**：碰出的进张须与手中 2 张相同的非财神牌组成刻子（3 张同牌值）。
- **触发条件**：MsgPungS 下发 CMF_PONG 组合（mahs 为完整三张、in_mahs 为进张）时。
- **配置影响**：本原子项无独立配置
- **客户端交互**：副露区以 3 张并把形式显示，财神牌按牌值上色。
- **限制与禁止**：组合三张须为相同牌值；客户端按 mahs 原样落地，不做校验。
- **异常与边界**：组合的“相同牌”由服务端给出。
- **验收**：MsgPungS 落地后手牌被扣除 nMahs（mahs 去掉 in_mahs 后的 2 张），副露新增 3 张碰组。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/BoxMahDefine.ts:789；source-code/client/Code/data/PlayerCardsData.ts:142
- **服务端职责**：下发 MsgPungS（comb.mahs 为三张相同牌、in_mahs 为进张）。
- **客户端职责**：setCombo 用 ComboData 把 mahs 去掉 in_mahs 后得到 nMahs，再从手牌中 RemoveMahsForce 扣除对应张数；碰组以 3 张刻子形式进入副露。
- **协作边界**：客户端消费 MsgPungS 落地组合与扣牌；本地不校验三张是否相同。
- **来源文件**：`source-code/client/Code/config/BoxMahDefine.ts`
- **来源定位**：source-code/client/Code/config/BoxMahDefine.ts:789
- **原文摘录**：`RemoveMahs(this.nMahs, MsgComb.in_mahs);`

#### `AT-ST-C05-012` 手中有 3 张也只用 2 张

- **规则说明**：碰时即使手中已有 3 张相同牌，也只消耗其中 2 张与进张组成刻子，第 3 张留在手中。
- **触发条件**：碰成立（MsgPungS 到达）且手中持有 3 张与进张相同的牌时。
- **配置影响**：本原子项无独立配置
- **客户端交互**：无特殊交互；第 3 张同值牌仍留在手牌中正常展示。
- **限制与禁止**：碰只能减两张，不能把手中第 3 张一并消耗。
- **异常与边界**：记牌计数（updateCardCounter）只对非自己座位生效，且只取 comb.mahs 前 2 张。
- **验收**：碰落地后手牌仅减少 2 张（nMahs），第 3 张同值牌仍在手牌中；他人碰时记牌计数只按 comb.mahs 前 2 张递减。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:36；source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:37
- **服务端职责**：下发 MsgPungS，其 comb 仅表达 1 张进张加 2 张手牌消耗（手中第 3 张不参与碰组）。
- **客户端职责**：GamePungCmd 在更新记牌计数时只取 comb.mahs 的前 2 张，代码注释明确“碰只能减两张”；手牌扣除同样只移除 nMahs（去掉进张后的 2 张），第 3 张仍留在手中。
- **协作边界**：客户端消费 MsgPungS；本地按 comb.mahs 前 2 张更新记牌计数、按 nMahs 扣手牌。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:36
- **原文摘录**：`// 碰只能减两张`

#### `AT-ST-C05-013` 碰成功后不摸牌进入出牌

- **规则说明**：碰成功后玩家不摸牌，直接进入出牌阶段。
- **触发条件**：客户端收到 MsgPungS（碰成功广播），随后收到含 POWER_ID_PLAY 的 MsgPower。
- **配置影响**：本原子项无独立配置
- **客户端交互**：播放碰字效与音效后收起按钮，随后进入可出牌状态。
- **限制与禁止**：碰成功后客户端自身不添加摸牌；“不摸牌”由服务端不下发 MsgTake 决定。
- **异常与边界**：与吃一致，客户端无显式断言或校验“不摸牌”，完全依赖服务端消息时序。
- **验收**：MsgPungS 后状态切到 MAH_STATE_PUNG、翻牌权限清理、最后出牌清空、操作面板关闭；后续 MsgPower 含 POWER_ID_PLAY 时进入可出牌。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:32；source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:42
- **服务端职责**：下发 MsgPungS 与后续含 POWER_ID_PLAY 的 MsgPower，不向碰牌者下发 MsgTake。
- **客户端职责**：GamePungCmd 收到 MsgPungS 后设置 MAH_STATE_PUNG、清理翻牌权限、清空最后出牌、派发碰动画并关闭操作面板，自身不添加摸牌；出牌权由后续 MsgPower 的 POWER_ID_PLAY 打开。
- **协作边界**：客户端消费 MsgPungS/MsgPower；本地只做状态切换、动画派发与面板收起。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:32
- **原文摘录**：`GameData.setTableState(MahGameState.MAH_STATE_PUNG); GameData.clearFuPanPower();`

#### `AT-ST-C05-014` 碰成立的当前回合可以加杠或暗杠

- **规则说明**：碰成功的当前回合，玩家仍可以加杠（把已碰刻子补成杠）或暗杠。
- **触发条件**：碰后 MsgPower 同时给出 KONG 权限与 CMF_TKONG 组合（加杠）或 CMF_CKONG 组合（暗杠）。
- **配置影响**：本原子项无独立配置
- **客户端交互**：杠按钮出现并高亮，可与出牌并存（杠与摸牌无关时不置灰手牌）。
- **限制与禁止**：加杠必须定位到与手牌同牌值的已存在 CMF_PONG 组就地升级。
- **异常与边界**：补杠按“同牌值的 CMF_PONG 组”匹配，匹配的成立由服务端下发的组合保证。
- **验收**：碰后收到 CMF_TKONG 时，副露中原碰组被替换为杠组且手牌减少 1 张。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/PlayerCardsData.ts:99；source-code/client/Code/data/PlayerCardsData.ts:106
- **服务端职责**：碰后当回合下发含 KONG 权限与 CMF_TKONG 组合的 MsgPower，下发 MsgKongS 确认加杠。
- **客户端职责**：碰后若 MsgPower 同时给出 KONG 权限与 CMF_TKONG 组合，客户端把该组合交给 PlayerCardsData.setCombo 的补杠分支：找到同牌值的 CMF_PONG 组就地替换为杠并扣 1 张手牌，实现“碰后加杠”。
- **协作边界**：客户端消费 MsgPower/MsgKongS；本地按同牌值匹配碰组做就地升级与扣牌。
- **来源文件**：`source-code/client/Code/data/PlayerCardsData.ts`
- **来源定位**：source-code/client/Code/data/PlayerCardsData.ts:99
- **原文摘录**：`if (combo.flag == BoxMahDefine.CombType.CMF_TKONG) { //补杠特殊处理，将附录中碰变为杠`

## `FP-ST-C05-005` 直杠（他人打出的牌）

- **主描述**：他人刚打出的 1 张非财神与手中 3 张相同非财神组成直杠；多响应按优先级裁决；杠后从牌墙尾部补牌。
- **范围与边界**：覆盖明杠的牌面条件、响应优先级与补牌来源。
- **总体协作**：服务端下发 CMF_MKONG 组合与补牌 MsgTake（含抓牌方向）。

### 原子项

#### `AT-ST-C05-015` 他人打出的 1 张加手中 3 张相同牌

- **规则说明**：直杠由他人刚打出的 1 张非财神牌与手中 3 张相同非财神牌组成 4 张杠。
- **触发条件**：他人打出牌后，服务端下发含 KONG 权限与 CMF_MKONG 组合的 MsgPower；玩家确认后客户端收到 MsgKongS。
- **配置影响**：本原子项无独立配置
- **客户端交互**：播放明杠字效（gang skin + GANG 音效）并在副露区以 4 张形式落地。
- **限制与禁止**：客户端不校验“手中 3 张相同”，杠组合完全来自服务端。
- **异常与边界**：收到 CMF_MKONG 时客户端清空最后出牌标记（GameData.setLastCard(null)），表明进张来自他人弃牌。
- **验收**：MsgKongS(CMF_MKONG) 落地后最后出牌标记清空、副露新增 4 张杠组、手牌扣除相应张数、播放明杠动画（TYPE_MKONG）与音效。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:37；source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:51
- **服务端职责**：下发 MsgPower（KONG 权限与 CMF_MKONG 组合，保证他人 1 张加手中 3 张相同非财神），接收 MsgKongC，下发 MsgKongS。
- **客户端职责**：GameKongCmd 收到 CMF_MKONG 时清空最后出牌标记（说明进张来自他人弃牌），把 4 张杠组写入副露并从手牌扣除相应张数；组合由服务端 MsgPower.combs 提供。
- **协作边界**：客户端消费 MsgPower/MsgKongC/MsgKongS；本地仅落地副露与扣牌，不校验张数与相同性。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:37
- **原文摘录**：`if (data.comb?.flag === BoxMahDefine.CombType.CMF_MKONG) { GameData.setLastCard(null); }`

#### `AT-ST-C05-016` 多响应时按优先级裁决

- **规则说明**：多人同时可响应该张牌（吃、碰、杠、胡并存）时，按优先级裁决后确定杠（及其他响应）的成立。
- **触发条件**：一张牌引发多人同时获得响应权限，各客户端分别收到各自的 MsgPower（power 位与 askid）时。
- **配置影响**：本原子项无独立配置
- **客户端交互**：吃碰杠胡按钮可同时显示，玩家必须先点过才能出牌。
- **限制与禁止**：客户端禁止本地做任何优先级判断；最终成立者由服务端结果广播决定。
- **异常与边界**：“按优先级裁决”属服务端逻辑，客户端只能间接证明其不做本地裁决。
- **验收**：各客户端仅按自身 MsgPower.power 位显示按钮并用 askid 回包；杠副露仅在实际收到 MsgKongS 的客户端落地。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:552；source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:53；source-code/client/Code/layer/BoxHzmjMainView.ts:1453
- **服务端职责**：按座位下发 MsgPower（power 位与 askid），按优先级裁决后仅对成立者下发 MsgKongS 等结果广播。
- **客户端职责**：客户端不做优先级判断：MsgPower 按座位下发 power 位与 askid，客户端按位显示吃/碰/杠/胡按钮并用 askid 回包；多人可操作时各自看到自己的按钮，最终成立者由服务端 MsgKongS 等结果广播决定。
- **协作边界**：客户端消费 MsgPower 权限位与 askid 并回包；本地无优先级裁决。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:552
- **原文摘录**：`showChi: (power & BoxMahDefine.PowerType.POWER_ID_CHOW) > 0, showPeng: (power & BoxMahDefine.PowerType.POWER_ID_PONG) > 0, showGang: (power & BoxMahDefine.PowerType.POWER_ID_KONG) > 0,`

#### `AT-ST-C05-017` 杠后从牌墙尾部补牌

- **规则说明**：直杠成立后，杠者从牌墙尾部补进 1 张牌。
- **触发条件**：直杠成立（MsgKongS）后，服务端下发 MsgTake（含抓牌方向 dir 与数量 tcnt）。
- **配置影响**：抓牌方向配置：nDir 1 为正向、2 为反向（尾部）。
- **客户端交互**：按方向播摸牌动画并隐藏对应牌墙槽位，更新剩余牌数。
- **限制与禁止**：客户端不自行决定补牌方向，不区分“普通摸牌”和“杠后补牌”。
- **异常与边界**：尾部补牌的具体方向由服务端下发（dir=2 表示反向/尾部抓牌）。
- **验收**：杠后 MsgTake 按 data.dir/data.tcnt 调用 GameData.takeWalls 计算牌墙取走位置并播放抓牌动画，剩余牌数更新。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:90；source-code/client/Code/data/GameData.ts:687；source-code/client/Code/data/GameData.ts:723
- **服务端职责**：直杠成立后下发 MsgTake，dir 指示从牌墙尾部（反向）抓牌。
- **客户端职责**：补牌由 MsgTake 驱动：GameTakeCmd 按 data.dir / data.tcnt 调用 GameData.takeWalls 计算牌墙被取走的位置并播放抓牌动画，dir=2 表示反向（尾部）抓牌，客户端不自行决定补牌方向。
- **协作边界**：客户端消费 MsgKongS 与 MsgTake；本地只按 dir/tcnt 播放动画与扣减牌墙。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:90
- **原文摘录**：`return GameData.takeWalls(data.dir, data.tcnt);`

## `FP-ST-C05-006` 加杠（补杠）与抢杠胡

- **主描述**：出牌阶段，已碰出的刻子手里有第 4 张非财神可以加杠；先征求抢杠胡，有人胡则加杠不成立不补牌，无人胡才完成加杠并补牌。
- **范围与边界**：覆盖加杠条件、抢杠胡征求与加杠失败/成功的两种结果。
- **总体协作**：服务端通过 MsgPower 给出 CMF_TKONG 或胡权限，客户端以 setComboBuGang 升级副露、以胡动画表现抢杠成功。

### 原子项

#### `AT-ST-C05-018` 出牌阶段已碰刻子有第 4 张非财神可加杠

- **规则说明**：出牌阶段，已碰出的刻子在手里有第 4 张相同非财神牌时，可以加杠（补杠）。
- **触发条件**：出牌阶段服务端下发含 KONG 权限与 CMF_TKONG 组合的 MsgPower；确认后客户端收到 MsgKongS(CMF_TKONG)。
- **配置影响**：本原子项无独立配置
- **客户端交互**：副露区原碰组原地补成 4 张杠，播放补杠字效与 BU_GANG 音效。
- **限制与禁止**：是否存在加杠机会由服务端在 combs 中下发 CMF_TKONG，客户端不本地扫描手牌与副露。
- **异常与边界**：补杠分支按同牌值遍历副露定位已存在的 CMF_PONG 组并记录 nIdx，同时从手牌移除 1 张。
- **验收**：CMF_TKONG 落地后对应索引的碰组升级为 4 张杠、手牌减少 1 张、播放补杠动画与 BU_GANG 音效。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/PlayerCardsData.ts:104；source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:63；source-code/client/Code/layer/BoxHzmjMah2DView.ts:907
- **服务端职责**：出牌阶段下发含 CMF_TKONG 组合（与已碰刻子同牌值）的 MsgPower，接收 MsgKongC，下发 MsgKongS。
- **客户端职责**：PlayerCardsData.setCombo 的补杠分支按同牌值定位已存在的 CMF_PONG 组，就地替换为杠组并记录 nIdx，同时从手牌移除 1 张；GameKongCmd 对 CMF_TKONG 改走 setComboBuGang 事件，把对应索引的碰组升级为 4 张。
- **协作边界**：客户端消费 MsgPower/MsgKongC/MsgKongS；本地按牌值匹配碰组做升级，不扫描加杠机会。
- **来源文件**：`source-code/client/Code/data/PlayerCardsData.ts`
- **来源定位**：source-code/client/Code/data/PlayerCardsData.ts:104
- **原文摘录**：`for (let i = 0; i < this.combo.length; i++) { const tcom = this.combo[i];`

#### `AT-ST-C05-019` 加杠前先征求抢杠胡

- **规则说明**：加杠须先征求其他玩家是否抢杠胡，征求之后才能确定加杠是否成立。
- **触发条件**：加杠征求阶段，服务端向可胡玩家下发含 HU 权限的 MsgPower。
- **配置影响**：抢杠胡类型枚举配置：HuType.HT_ROBKONG（抢杠）与 ActionAniType.TYPE_QIANG_GANG_HU（抢杠胡动画）。
- **客户端交互**：抢杠胡时胡按钮播放 hu 皮肤（非自摸皮肤），结算按点炮类处理。
- **限制与禁止**：客户端没有“征求抢杠”的弹窗或状态机，只在结果侧区分抢杠胡类型。
- **异常与边界**：HT_ROBKONG 与 HT_DISCARD、HT_DIAN_GANG_HUA 一样判定为非自摸（isZimo 为 false 的分支）。
- **验收**：抢杠胡路径中动画类型为 TYPE_QIANG_GANG_HU、HuType 为 HT_ROBKONG、胡动画使用非自摸皮肤。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/BoxMahDefine.ts:237；source-code/client/Code/config/GameDefine.ts:428；source-code/client/Code/layer/BoxHzmjTipAniView.ts:929
- **服务端职责**：加杠征求阶段下发含 HU 权限的 MsgPower 驱动抢杠胡征求，接收 MsgHuC，以 MsgResultHu 结算。
- **客户端职责**：客户端通过 HuType.HT_ROBKONG 与 ActionAniType.TYPE_QIANG_GANG_HU 区分抢杠胡；胡按钮的动画皮肤按 HT_DISCARD/HT_ROBKONG 走“hu”，并据此判定为非自摸。抢杠征求过程本身由服务端下发 MsgPower(HU) 驱动。
- **协作边界**：客户端消费 MsgPower/MsgHuC/MsgResultHu；本地仅在结果侧区分抢杠胡动画与皮肤，无征求状态机。
- **来源文件**：`source-code/client/Code/config/BoxMahDefine.ts`
- **来源定位**：source-code/client/Code/config/BoxMahDefine.ts:237
- **原文摘录**：`TYPE_QIANG_GANG_HU: 9, //抢杠胡`

#### `AT-ST-C05-020` 有人抢杠胡则加杠不成立、不补牌

- **规则说明**：征求抢杠胡时若有人胡，则本次加杠不成立，杠者不补牌。
- **触发条件**：加杠征求期间有玩家抢杠胡成立（服务端下发胡结算消息）时。
- **配置影响**：本原子项无独立配置
- **客户端交互**：被抢杠后杠组回退为碰组；胡牌者播放点炮类胡牌动画。
- **限制与禁止**：加杠不成立时不补牌。
- **异常与边界**：revertRobbedKong 在本仓库内没有任何调用点，属于已定义未接线的能力；实际回滚是否发生由服务端是否下发 MsgKongS 决定，存在接线缺失风险。
- **验收**：存在回滚需求时 revertRobbedKong 可把被抢张从杠者摸牌/手牌移除并把 CMF_TKONG 副露拆回 CMF_PONG 三张；当前版本需验证服务端不发 MsgKongS 时的实际桌面表现（接线缺失风险项）。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/PlayerCardsData.ts:443；source-code/client/Code/data/PlayerCardsData.ts:465
- **服务端职责**：有人抢杠胡时下发 MsgHuEx/MsgResultHu 结算胡牌，且不下发 MsgKongS（加杠不成立、不补牌）。
- **客户端职责**：PlayerCardsData.revertRobbedKong 提供回滚能力：把被抢的牌从摸牌/手牌移除，并把 CMF_TKONG 副露拆回 CMF_PONG 三张，用于“加杠不成立”的表现。
- **协作边界**：客户端消费 MsgPower/MsgHuEx/MsgResultHu；本地具备 revertRobbedKong 回滚能力但当前未接线。
- **来源文件**：`source-code/client/Code/data/PlayerCardsData.ts`
- **来源定位**：source-code/client/Code/data/PlayerCardsData.ts:443
- **原文摘录**：`/** 抢杠胡：被抢张不能留在杠者摸牌/手牌，补杠副露拆回碰。 */`

#### `AT-ST-C05-021` 无人胡则完成加杠并补牌

- **规则说明**：征求抢杠胡无人胡时，加杠完成并补牌。
- **触发条件**：无人抢杠胡后服务端下发 MsgKongS(CMF_TKONG)，随后下发 MsgTake。
- **配置影响**：本原子项无独立配置
- **客户端交互**：副露升级为 4 张杠，播放补杠音效，随后播放补牌动画并刷新剩余牌数。
- **限制与禁止**：“无人胡才补牌”由服务端时序保证，客户端无相应判断。
- **异常与边界**：客户端不判断是否有人抢杠，补牌时机完全跟随 MsgKongS 与 MsgTake 的到达顺序。
- **验收**：MsgKongS(CMF_TKONG) 落地后碰组升级为杠组，随后 MsgTake 播放补牌动画并扣减牌墙。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:36；source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:88
- **服务端职责**：无人抢杠时下发 MsgKongS(CMF_TKONG) 与随后的 MsgTake 完成补牌时序。
- **客户端职责**：无人抢杠时服务端继续下发 MsgKongS(CMF_TKONG)，客户端把碰组升级为杠并通过 setComboBuGang 渲染，随后由 MsgTake 完成补牌与牌墙扣减。
- **协作边界**：客户端消费 MsgKongS/MsgTake；本地不判断抢杠结果。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:36
- **原文摘录**：`const comboData = GameData.getPlayerCardsData(localSeat)?.setCombo(data.comb as ICombInfo, data.seat);`

## `FP-ST-C05-007` 暗杠

- **主描述**：出牌阶段手中 4 张相同非财神可暗杠，完成后补牌；暗杠下层 3 张牌背、顶张正面四家可见，放在碰杠区但不计副露。
- **范围与边界**：覆盖暗杠条件、补牌、暗杠牌面呈现与副露归属。
- **总体协作**：服务端下发 CMF_CKONG 与补牌 MsgTake，客户端以 3 背 + 1 面的组合渲染。

### 原子项

#### `AT-ST-C05-022` 出牌阶段手中 4 张相同非财神可暗杠

- **规则说明**：出牌阶段手中持有 4 张相同非财神牌时，可以暗杠。
- **触发条件**：出牌阶段服务端下发含 KONG 权限与 CMF_CKONG 组合的 MsgPower；确认后客户端收到 MsgKongS。
- **配置影响**：本原子项无独立配置
- **客户端交互**：杠按钮显示并高亮，暗杠时手牌不置灰（杠与摸牌无关场景），播放 AN_GANG 音效。
- **限制与禁止**：客户端无手牌扫描逻辑，暗杠可用性完全由服务端 combs 决定（是否 4 张相同由服务端判定）。
- **异常与边界**：GameKongCmd 对 CMF_CKONG 不清 lastCard（说明不是吃他人弃牌），按 4 张手牌落地副露。
- **验收**：CMF_CKONG 落地为 4 张杠组、播放暗杠动画（TYPE_CKONG）与 AN_GANG 音效。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/GameData.ts:882；source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:54；source-code/client/Code/layer/BoxHzmjTipAniView.ts:509
- **服务端职责**：出牌阶段下发含 CMF_CKONG 组合（手中 4 张相同非财神）的 MsgPower，接收 MsgKongC，下发 MsgKongS。
- **客户端职责**：客户端把 MsgPower.combs 中的 CMF_CKONG 归入杠组合列表并显示杠按钮；GameKongCmd 对 CMF_CKONG 不清 lastCard（说明不是吃他人弃牌），按 4 张手牌落地副露。是否 4 张相同由服务端判定。
- **协作边界**：客户端消费 MsgPower/MsgKongC/MsgKongS；本地不扫描手牌判断暗杠机会。
- **来源文件**：`source-code/client/Code/data/GameData.ts`
- **来源定位**：source-code/client/Code/data/GameData.ts:882
- **原文摘录**：`case BoxMahDefine.CombType.CMF_CKONG:`

#### `AT-ST-C05-023` 暗杠完成后补牌

- **规则说明**：暗杠完成后从牌墙补进 1 张牌。
- **触发条件**：MsgKongS(CMF_CKONG) 落地后，服务端下发 MsgTake。
- **配置影响**：本原子项无独立配置
- **客户端交互**：杠完成动画后播放补牌动画，刷新剩余牌数与摸牌位。
- **限制与禁止**：客户端不区分杠后补牌与普通摸牌。
- **异常与边界**：客户端无法从代码确认“补牌”语义（补牌与普通摸牌共用 MsgTake 流程）；自摸到家时更新摸到的牌与可选听牌信息。
- **验收**：暗杠动画（onMsgPlayPengGang）后 setTakeMah 事件播放补牌动画并更新剩余牌数与摸牌位。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:61；source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:288
- **服务端职责**：暗杠成立后下发 MsgKongS 与随后的 MsgTake 完成补牌。
- **客户端职责**：GameKongCmd 只负责副露落地，补牌由随后的 MsgTake 处理：GameTakeCmd 依 data.dir / data.tcnt 计算牌墙并播放摸牌动画，自摸到家时更新摸到的牌与可选听牌信息。
- **协作边界**：客户端消费 MsgKongS/MsgTake；本地把杠后补牌与普通摸牌统一按 MsgTake 处理。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:61
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.onMsgPlayPengGang, kongType, localSeat);`

#### `AT-ST-C05-024` 暗杠 3 张牌背加顶张正面，四家可见

- **规则说明**：暗杠下层 3 张为牌背、顶张 1 张为正面，使四家都能认出暗杠的牌面。
- **触发条件**：结算副露渲染遇到 CMF_CKONG 组合时。
- **配置影响**：组件控制器 C_IsAnGan（pages 0,no / 1,yes）控制暗杠展示形态，C_ComboType 切换 4mah 页。
- **客户端交互**：副露组件切到 4mah 页并启用 C_IsAnGan，前 3 张牌背、最后 1 张正面且带牌值。
- **限制与禁止**：暗杠展示形态固定为 3 背 + 1 面，不能全部牌背或全部正面。
- **异常与边界**：仅在结算副露渲染中有直接证据；桌面进行中的暗杠表现位于外部 common_game 的 Mah2DCombo_Box，本仓库无其源码。
- **验收**：结算界面 CMF_CKONG 副露组件 C_ComboType 选 4mah 页、C_IsAnGan=1，第 0~2 张牌 state 为牌背页、第 3 张为正面页。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:557；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:583；source-code/client/Fgui/assets/box_hzmj_result/component/comboSefl.xml:4
- **服务端职责**：下发 MsgKongS/MsgResultHu，comb.flag 携带 CMF_CKONG 供客户端区分暗杠展示形态。
- **客户端职责**：结算副露渲染对 CMF_CKONG 置 C_IsAnGan 控制器为 1，并把第 0~2 张牌的 state 切到牌背页、第 3 张保持正面页，形成 3 背 + 1 面；桌面碰杠区的暗杠渲染依赖外部 common_game 的 Mah2DCombo_Box，本仓库无其源码。
- **协作边界**：客户端消费 MsgKongS/MsgResultHu 的 comb.flag；本地按 flag 切换 3 背 + 1 面展示形态。
- **来源文件**：`source-code/client/Code/layer/comp/BoxHzmjResultMid.ts`
- **来源定位**：source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:557
- **原文摘录**：`compNode.C_ComboType.setSelectedPage("4mah"); compNode.C_IsAnGan.selectedIndex = comb.flag == CombMahFlag.CMF_CKONG ? 1 : 0;`

#### `AT-ST-C05-025` 暗杠放在碰杠区但不计副露

- **规则说明**：暗杠的 4 张牌放在碰杠区展示，但不计入副露。
- **触发条件**：MsgKongS(CMF_CKONG) 落地时。
- **配置影响**：本原子项无独立配置
- **客户端交互**：碰杠区新增一组 4 张暗杠；结算副露槽位按 combs.length 计入该组。
- **限制与禁止**：暗杠不计摊（摊仅由吃牌产生，碰、直杠、加杠、暗杠均不计摊）。
- **异常与边界**：“不计副露”在客户端只体现为摊计数由服务端下发，且结算副露列表实际把暗杠计为 1 组（C_ShowComp 按 combs.length），与模板描述存在口径差异，需确认“副露”是否指摊。
- **验收**：暗杠后碰杠区新增一组 4 张杠；摊计数仅由 MsgTanUpdate.tan_items 驱动更新，暗杠不引起摊计数变化。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:72；source-code/client/Code/layer/BoxHzmjMah2DView.ts:895；source-code/client/Code/controller/cmd/gameCmd/GameTanUpdateCmd.ts:21
- **服务端职责**：下发 MsgKongS(CMF_CKONG) 落地碰杠区副露；摊计数由 MsgTanUpdate 下发，暗杠不计摊。
- **客户端职责**：GameKongCmd 对所有杠类型（含 CMF_CKONG）统一派发 setCombo，桌面副露管理器把暗杠作为一组加入碰杠区；客户端没有“副露计数”概念，摊计数与承包由服务端 MsgTanUpdate 下发。
- **协作边界**：客户端消费 MsgKongS/MsgTanUpdate；本地无副露计数概念，摊计数纯展示服务端数据。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:72
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.setCombo, localSeat, comboData, GameData.getPlayerCardsData(localSeat)?.cards.concat());`

## `FP-ST-C05-008` 吃碰后续杠与七对结算限制

- **主描述**：吃或碰刚成立的当回合同样可以加杠、暗杠；四张相同就可以杠；杠完之后不再按七对结算。
- **范围与边界**：补充吃碰后的杠权限衔接，以及杠对七对番型的影响。
- **总体协作**：杠权限仍由 MsgPower 下发，七对判定完全在服务端。

### 原子项

#### `AT-ST-C05-026` 吃或碰刚成立当回合同样可以加杠、暗杠

- **规则说明**：吃或碰刚成立的当前回合，玩家同样可以加杠或暗杠。
- **触发条件**：吃/碰成功后，下一条 MsgPower 含 POWER_ID_KONG 与杠组合（CMF_TKONG/CMF_CKONG）时。
- **配置影响**：本原子项无独立配置
- **客户端交互**：吃过/碰过之后仍可出现杠按钮；杠与摸牌无关时手牌不置灰、可直接出牌。
- **限制与禁止**：客户端没有“吃碰当回合”的显式白名单，只有 power 位驱动，无法从代码确认回合边界。
- **异常与边界**：吃/碰成功后客户端只把状态切到 CHOW/PUNG 并关闭操作面板，不锁定杠权限。
- **验收**：吃/碰落地后若 MsgPower 含 KONG 位，杠按钮照常显示（KW_BTN_Gang.visible），_updateGangOffMoCard 按杠是否与摸牌相关决定是否解除手牌置灰。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:44；source-code/client/Code/layer/BoxHzmjMainView.ts:692；source-code/client/Code/layer/BoxHzmjMainView.ts:580
- **服务端职责**：吃/碰后当回合下发含 POWER_ID_KONG 与杠组合的 MsgPower，接收 MsgKongC。
- **客户端职责**：吃/碰成功后客户端只把状态切到 CHOW/PUNG 并关闭操作面板，不锁定杠权限；下一条 MsgPower 若含 POWER_ID_KONG 与杠组合，杠按钮照常显示，_updateGangOffMoCard 会按杠是否与摸牌相关决定是否解除手牌置灰。
- **协作边界**：客户端消费 MsgPower/MsgKongC；本地无回合边界判断，仅按权限位与杠组合驱动按钮。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:44
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.onCloseOperate);`

#### `AT-ST-C05-027` 四张相同就可以杠

- **规则说明**：四张相同的牌就可以杠，不限制凑满途径（手中 4 张暗杠、手中 3 张碰他人 1 张直杠、已碰刻子补第 4 张加杠）；存在多个可杠组合时选择其一执行。
- **触发条件**：MsgPower.combs 中存在 CMF_MKONG/CMF_CKONG/CMF_TKONG 任一组合且玩家点击杠按钮时。
- **配置影响**：本原子项无独立配置
- **客户端交互**：杠按钮在多个可杠组合时进入“选择多杠”页签，右侧列出可杠牌值列表，点击某项直接发送对应组合。
- **限制与禁止**：客户端不自行判断“四张相同”，杠的合法性由服务端给组合。
- **异常与边界**：选择列表按各杠组合首张牌值（comb.mahs[0]）渲染。
- **验收**：多个可杠组合时点击杠按钮弹出“选择多杠”列表，列表项按 comb.mahs[0] 渲染牌值图（KW_Mah0/KW_Value），点击某项即发送对应组合的 MsgKongC。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:639；source-code/client/Code/layer/BoxHzmjMainView.ts:842
- **服务端职责**：下发 MsgPower（KONG 权限与 CMF_MKONG/CMF_CKONG/CMF_TKONG 组合），接收携带所选组合的 MsgKongC。
- **客户端职责**：多杠/多暗杠的选择列表由 _getGangPowerInfo 从 MsgPower.combs 中收集所有 CMF_MKONG/CMF_CKONG/CMF_TKONG 组合的首张牌值生成，多组时弹选择列表；客户端不自行判断“四张相同”。
- **协作边界**：客户端消费 MsgPower.combs；本地按组合数量做交互分流，不判断四张相同。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:639
- **原文摘录**：`for (const comb of this._playCombs) { if (this._isGangComb(comb.flag)) { mahs.push(comb.mahs[0]); } ... }`

#### `AT-ST-C05-028` 杠完后不再按七对结算

- **规则说明**：四张相同就可以杠，杠完之后该小局不再按七对结算（杠破坏七对番型资格）。
- **触发条件**：杠成立后的小局结算阶段（服务端番型判定时）。
- **配置影响**：番型映射表 FanDefine 含七对系列番型（K_FTG_HZMJ_QI_DUI）的名称、倍数与动画配置；客户端无杠后剔除七对的判定配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：杠完后不得再按七对结算；该剔除由服务端在番型判定中保证。
- **异常与边界**：番型由服务端 MsgHuItem.fan_ids 下发，客户端 FanDefine 只做番型名称、倍数与动画映射（含 K_FTG_HZMJ_QI_DUI 七对系列），没有任何“杠后剔除七对”的判定代码。
- **验收**：客户端侧无可验证实现；服务端侧验收口径为杠过的小局结算 fan_ids 中不出现七对系列番型。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：待确认（客户端无对应实现；番型仅按服务端下发的 fan_ids 做名称、倍数与动画映射展示）。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

## `FP-ST-C05-009` 飘财限制下的吃碰杠禁用

- **主描述**：飘财限制未解除时不能吃、碰、直杠、加杠，仍可暗杠；暗杠后只能打出尾墩刚补进的那一张。
- **范围与边界**：覆盖飘限制的禁用集合、暗杠例外与暗杠后的出牌限制。
- **总体协作**：飘计数由 MsgPiao 下发；禁用通过剔除 MsgPower 权限位实现；暗杠后禁手通过 MsgPlayLmts 下发。

### 原子项

#### `AT-ST-C05-029` 飘财限制未解除时不能吃、碰、直杠、加杠

- **规则说明**：受尚未解除的飘财限制时，玩家不能吃、碰、直杠、加杠。
- **触发条件**：飘财成立（自己出牌阶段打出财神）且限制未解除期间，服务端下发 MsgPower 时。
- **配置影响**：本原子项无独立配置
- **客户端交互**：飘动画播放与飘计数提示；被限制时对应按钮不出现。
- **限制与禁止**：飘财限制未解除时禁止吃、碰、直杠、加杠；客户端只在 MsgPiao 时记录飘计数并播飘动画，不参与吃碰杠按钮判定。
- **异常与边界**：客户端有 getPiaoCount 但没有任何吃碰杠判定消费它，属间接证据；禁用事实上由服务端剔除权限位实现。
- **验收**：飘限制期间客户端不显示吃/碰/杠按钮（power 位被服务端剔除）；飘计数与飘动画按 MsgPiao 正常表现。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts:21；source-code/client/Code/layer/BoxHzmjMainView.ts:552；source-code/client/Code/data/GameData.ts:1714
- **服务端职责**：下发 MsgPiao 更新飘计数；飘限制未解除时通过 MsgPower 剔除吃/碰/杠（直杠、加杠）权限位。
- **客户端职责**：客户端只在 MsgPiao 时记录飘计数并播飘动画，不参与吃碰杠按钮判定；吃/碰/杠按钮完全由 MsgPower.power 的 CHOW/PONG/KONG 位决定，因此禁用事实上由服务端剔除权限位实现。
- **协作边界**：客户端消费 MsgPiao（计数与动画）与 MsgPower（按钮显隐）；本地不用飘计数做吃碰杠判定。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts:21
- **原文摘录**：`GameData.updatePiaoState(data.seat, data.piao_count); this.dispatch(GameEventBoxHzmj.onPiaoState, data.seat, data.piao_count);`

#### `AT-ST-C05-030` 飘财限制下仍可暗杠

- **规则说明**：受飘财限制时仍然可以暗杠。
- **触发条件**：飘限制期间，服务端仍下发含 KONG 权限与 CMF_CKONG 组合的 MsgPower 时。
- **配置影响**：本原子项无独立配置
- **客户端交互**：暗杠时播放 AN_GANG 音效与暗杠动画，不与飘动画互斥。
- **限制与禁止**：杠按钮只区分 POWER_ID_KONG，不区分暗杠/明杠；GameKongCmd 对 CMF_CKONG 无飘相关分支。
- **异常与边界**：无飘限制相关判断，需服务端保证飘限制下仍下发暗杠权限。
- **验收**：飘限制期间收到 CMF_CKONG 组合时，杠按钮显示且暗杠流程（TYPE_CKONG 动画 + AN_GANG 音效）可正常执行。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:50；source-code/client/Code/layer/BoxHzmjTipAniView.ts:511
- **服务端职责**：飘限制期间仍在 MsgPower 中下发 KONG 权限与 CMF_CKONG 组合，下发 MsgKongS 确认暗杠。
- **客户端职责**：杠按钮只区分 POWER_ID_KONG，不区分暗杠/明杠；GameKongCmd 对 CMF_CKONG 无飘相关分支，因此若服务端在飘限制下仍下发暗杠组合，客户端可正常执行暗杠流程。
- **协作边界**：客户端消费 MsgPiao/MsgPower/MsgKongS；本地无飘限制与暗杠的互斥判断。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:50
- **原文摘录**：`switch (data.comb?.flag) { case BoxMahDefine.CombType.CMF_MKONG: ... case BoxMahDefine.CombType.CMF_CKONG: kongType = BoxMahDefine.ActionAniType.TYPE_CKONG; break;`

#### `AT-ST-C05-031` 暗杠后只能打尾墩刚补进的那一张

- **规则说明**：（飘财限制语境下的）暗杠后，玩家只能打出尾墩刚补进的那一张牌，其余手牌禁止打出。
- **触发条件**：暗杠完成后，服务端下发 MsgPlayLmts（hands 禁打手牌、dang_fang 禁打单放）与出牌权 MsgPower 时。
- **配置影响**：禁打限制配置：MsgPlayLmts 的 hands（禁打手牌列表）与 dang_fang（禁打单放列表），经 GameData.setPlayLimitMahs 缓存。
- **客户端交互**：被禁手牌置灰、不可拾起；点击被禁牌提示“该牌被禁打”。
- **限制与禁止**：除尾墩刚补进的那张外，其余手牌禁止打出。
- **异常与边界**：客户端没有“暗杠只能打补进那张”的绑定逻辑，只有通用的禁打手牌/禁单放机制；该限制是否由暗杠触发需服务端在 MsgPlayLmts 中下发。
- **验收**：MsgPlayLmts 下发后出牌权刷新时被禁牌面灰化（applyPlayLmtsGray），点击被禁牌弹出“该牌被禁打”提示且 canPlayMahCheck 拦截出牌。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:45；source-code/client/Code/layer/BoxHzmjMainView.ts:1277；source-code/client/Code/layer/BoxHzmjMainView.ts:1432
- **服务端职责**：暗杠后下发 MsgPlayLmts（hands/dang_fang 禁打列表，仅放行尾墩刚补进那张），下发 MsgPower 打开出牌权。
- **客户端职责**：暗杠后若服务端下发 MsgPlayLmts（hands 禁打手牌、dang_fang 禁打单放），客户端缓存限制并在出牌权刷新时灰化被禁牌面；出牌前 canPlayMahCheck 会拦截被禁牌并提示“该牌被禁打”，因此可强制只剩补进的那张可出。
- **协作边界**：客户端消费 MsgPlayLmts/MsgPower；本地做禁打灰化与拦截提示，不绑定暗杠场景。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:45
- **原文摘录**：`GameData.setPlayLimitMahs(localSeat, handForbid, danFangForbid);`
