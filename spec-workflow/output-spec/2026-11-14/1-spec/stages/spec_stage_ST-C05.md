# 吃、碰、杠

> 阶段 ID：`ST-C05`。来源：模板「行牌 > 吃、碰、杠」章节。客户端视角规格，客户端逻辑与 UI 交互以 Code/Fgui 代码证据支撑。

## 0. 阶段

- **阶段 ID**：`ST-C05`
- **阶段**：吃、碰、杠
- **来源章节**：行牌 > 吃、碰、杠
- **涉及协议消息**：MsgPower、MsgChowS、MsgChowC、MsgPungS、MsgKongS、MsgKongC、MsgTake、MsgResultHu、MsgTanUpdate
- **涉及 UI 模块**：box_hzmj_main、BoxHzmjMainView、BoxHzmjMah2DView、BoxHzmjTipAniView、BoxHzmjPlayerHandCards
- **阶段概述**：规定吃、碰、直杠、加杠、暗杠的成立条件、执行结果与补牌方式，并约束吃碰后同回合杠、杠与七对结算、飘财限制等边界规则。

## 术语与单位

| 术语 | 定义 | 单位/量纲 | 作用域 | 来源 |
| --- | --- | --- | --- | --- |
| 财神 | 白板固定为财神，只在胡牌判定时代替所缺的牌；吃、碰、杠必须用真实非财神牌 | 无 | 全局 | 模板名词章节 |
| 面子 | 一组顺子、刻子或杠；杠含 4 张仍计 1 组面子，对子不是面子 | 组 | 全局 | 模板名词章节 |
| 摊 | A 吃进 B 打出的牌记 1 摊，两个方向分开计；碰、直杠、加杠、暗杠不计摊，每小局重新累计 | 次 | 每小局 | 模板名词章节 |
| 飘 | 自己出牌阶段打出一张财神即飘财 1 次，连续打出财神累加，打出普通牌清零 | 次 | 全局 | 模板名词章节 |
| 碰杠区（副露区） | 客户端在每位玩家座位旁单独渲染吃、碰、杠组合牌的区域，并带进牌来源箭头 | 区域 | 四家座位旁 | source-code/client/Code/layer/BoxHzmjMah2DView.ts:115 |

## 跨切面行为

- **操作权限位驱动**：吃碰杠按钮与选项完全由服务端下发的操作权限位驱动，客户端不做吃碰杠资格裁决 —— 跨切面（source-code/client/Code/layer/BoxHzmjMainView.ts:549-585）
- **候选手牌高亮置灰**：出现吃碰杠权限时，相关手牌保持高亮、其余手牌置灰，提示玩家哪些牌可参与组合 —— 跨切面（source-code/client/Code/layer/BoxHzmjMainView.ts:712-762）
- **出牌须先点过**：存在吃碰杠胡按钮且未点“过”时，客户端禁止直接出牌并弹提示“点‘过’才能出牌”；与摸牌无关的杠除外 —— 跨切面（source-code/client/Code/layer/BoxHzmjMainView.ts:1445-1460）
- **吃碰杠动效音效**：吃碰杠成立时按座位播放对应称呼的动效与音效，暗杠、补杠复用杠皮肤与杠音效 —— 跨切面（source-code/client/Code/layer/BoxHzmjTipAniView.ts:483-536）
- **多吃多杠选项池互斥**：多吃与多杠共用同一选项池区域，二者互斥显示；吃选项每组展示完整三张牌 —— 跨切面（source-code/client/Code/layer/BoxHzmjMainView.ts:830-912）
- **副露区四家渲染与来源箭头**：副露区按四家座位分别渲染，吃碰后按实际进牌槽位刷新来源箭头 —— 跨切面（source-code/client/Code/layer/BoxHzmjMah2DView.ts:915-949）
- **限制类通知 toast 呈现**：吃禁手、只碰不吃、守庄禁碰杠等限制通过通知消息以 toast 呈现，客户端不自行拦截 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GameNotifyInfoCmd.ts:48-69）
- **摊计数按服务端消息刷新**：摊计数与三摊提示完全按服务端消息刷新，客户端不区分暗杠是否计摊 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GameTanUpdateCmd.ts:21-31）
- **杠分展示事件未使用**：杠分展示事件已定义但代码中未被使用 —— 跨切面（source-code/client/Code/config/FguiViewDefine.ts:209）


## `FP-ST-C05-001` 牌张与花色限制

- **主描述**：约束哪些牌能做顺子、哪些牌可以参与碰与杠，涉及风牌、箭牌的适用边界。
- **范围与边界**：只覆盖风牌、箭牌在吃碰杠中的可用性；财神能否参与由后续各功能点分别约束。
- **总体协作**：客户端不校验牌张适用性，实际可用性由服务端下发的操作权限与组合决定；客户端负责把服务端给出的组合渲染到副露区。

### 原子项

#### `AT-ST-C05-001` 风牌箭牌不能吃

- **规则说明**：风牌、箭牌不能做顺子，因此不能吃；吃牌只能由万、条、筒组成同花色连续顺子。
- **触发条件**：别家打出牌后轮到自己响应，服务端下发吃牌操作权限与组合。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：吃按钮与吃选项只按服务端给出的组合展示，客户端不额外过滤风牌、箭牌，也不做花色与连续性校验。
- **限制与禁止**：禁止风牌、箭牌参与吃；该限制由服务端组合保证，客户端不做本地过滤。
- **异常与边界**：客户端无花色校验逻辑，若服务端未下发含风牌、箭牌的组合，玩家自然看不到此类吃选项；仅摸牌凑顺动画限定万、条、筒。
- **验收**：客户端按服务端组合原样渲染吃选项，不存在按花色过滤组合的代码；摸牌凑顺动画仅对万、条、筒花色触发。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:224
- **服务端职责**：下发 MsgPower（吃牌操作权限位）与 MsgChowS（吃牌组合，风牌、箭牌能否吃由组合内容体现）。
- **客户端职责**：吃牌组合完全由服务端下发，客户端不做花色与连续性校验，只按组合牌面排序并渲染；仅摸牌凑顺动画限定万、条、筒。
- **协作边界**：客户端消费服务端下发的 MsgPower 吃位与 MsgChowS 组合做展示，不做任何牌张适用性的本地判断。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:34
- **原文摘录**：`const comboData = GameData.getPlayerCardsData(localSeat)?.setCombo(data.comb as ICombInfo, data.seat);`

#### `AT-ST-C05-002` 风牌箭牌可作碰杠

- **规则说明**：风牌、箭牌在不是财神时可以碰、杠，组成刻子或杠参与副露。
- **触发条件**：别家打出牌后轮到自己响应，服务端下发碰或杠操作权限与组合。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：风牌、箭牌的碰杠组合可在副露区正常显示，客户端不按花色过滤；牌面资源表包含东南西北中发白。
- **限制与禁止**：风牌、箭牌为财神时不能碰杠（由服务端组合体现，客户端不判定）。
- **异常与边界**：客户端不校验牌张花色是否为风、箭；财神能否参与碰杠同样由服务端组合决定。
- **验收**：风牌、箭牌形成刻子或杠时能正常显示在副露区；客户端展示层只做牌值排序与财神插位，不区分万条筒与风箭。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/PlayerCardsData.ts:819；source-code/client/Code/config/BoxMahDefine.ts:180；source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:34
- **服务端职责**：下发 MsgPower（操作权限位）、MsgPungS（碰牌组合）与 MsgKongS（杠牌组合），风牌、箭牌与财神能否参与碰杠由组合内容体现。
- **客户端职责**：碰、杠组合按服务端下发的组合渲染，客户端不按花色过滤；展示层对组合牌只做牌值排序与财神插位，不区分万条筒与风箭。
- **协作边界**：客户端消费服务端下发的碰杠组合与权限位渲染副露，本地只做排序与财神插位。
- **来源文件**：`source-code/client/Code/data/PlayerCardsData.ts`
- **来源定位**：source-code/client/Code/data/PlayerCardsData.ts:819
- **原文摘录**：`return BoxMahDefine.sortCombDisplayMahs(this.nMahs.concat(this.nInMahs), isJoker, jokerMah);`

## `FP-ST-C05-002` 吃

- **主描述**：吃牌的成立条件、多组合选择、吃后不摸牌与同回合可杠。
- **范围与边界**：只覆盖吃牌本身；吃后加杠、暗杠的资格与执行细节见加杠/暗杠功能点。
- **总体协作**：吃组合由服务端随操作权限一起下发，客户端负责选项展示、发送选择、生成副露与进牌箭头。

### 原子项

#### `AT-ST-C05-003` 吃牌成立条件

- **规则说明**：上家刚打出的 1 张非财神，与手中 2 张非财神组成同花色连续顺子，构成吃。
- **触发条件**：上家打出一张牌后自己获得吃牌权限，服务端下发由进张与两张手牌组成的顺子组合。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：副露区新增一组顺子，来源箭头指向被吃进的那张牌所在槽位。
- **限制与禁止**：进张必须来自上家刚打出的牌且为非财神，两张手牌也须为非财神（均由服务端保证，客户端不校验）。
- **异常与边界**：客户端不校验是否上家打出、是否非财神；进牌来源只用于箭头指向与牌河移除。
- **验收**：吃牌成立后进张从出牌者牌河移除最后一张，手牌扣两张，副露区新增一组三张顺子，并按进牌实际槽位刷新来源箭头。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/PlayerCardsData.ts:91；source-code/client/Code/data/PlayerCardsData.ts:789；source-code/client/Code/layer/BoxHzmjMah2DView.ts:938
- **服务端职责**：下发 MsgPower（吃牌权限）；下发 MsgChowS（由进张与两张手牌组成的顺子组合，上家与非财神限制由服务端保证）。
- **客户端职责**：收到吃牌消息后按服务端组合生成副露：从出牌者牌河移除最后一张进牌，手牌扣两张，副露区新增一组三张顺子，并按进牌实际槽位刷新来源箭头。
- **协作边界**：客户端消费 MsgChowS 的组合数据生成副露与箭头展示，上家限制与非财神限制均在服务端。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:34
- **原文摘录**：`const comboData = GameData.getPlayerCardsData(localSeat)?.setCombo(data.comb as ICombInfo, data.seat);`

#### `AT-ST-C05-004` 多组吃法选一组

- **规则说明**：同一进张存在多种合法吃法时，从备选中选 1 组执行，一次只发送一组。
- **触发条件**：吃牌权限包含多组合法组合、可吃组合数量大于 1 时点击吃按钮。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：点击吃按钮弹出多吃选项池，每组并列展示完整三张牌并支持换行；同时出现取消按钮，点选一组立即发送吃牌并收起选项。
- **限制与禁止**：一次只允许选择并发送一组吃牌组合。
- **异常与边界**：仅一组可吃组合时不进入选择态，直接发送该组。
- **验收**：可吃组合数量大于 1 时点击吃进入选择态，选项池每组展示完整三张牌；点选某组后按该组索引取出组合并发送吃牌请求，只发送一组。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1113；source-code/client/Code/layer/BoxHzmjMainView.ts:1098；source-code/client/Fgui/assets/box_hzmj_main/component/ChooseGang.xml:5
- **服务端职责**：下发 MsgPower（含多组可吃组合的权限数据）；接收 MsgChowC（玩家选定的一组吃牌）。
- **客户端职责**：吃牌组合数量大于 1 时，点击吃按钮进入选择态，展示每组完整三张的选项池；点选某组后按该组索引取出组合并发送吃牌请求，只发送一组；选项池复用多杠组件 ChooseGang，按三张牌槽位动态补足牌面。
- **协作边界**：客户端消费服务端下发的多组吃组合做本地选择，选择结果经 MsgChowC 回传服务端裁决。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1089
- **原文摘录**：`if (this._chooseChiLength > 1) { this.showChooseChi(true); return; }`

#### `AT-ST-C05-005` 吃后不摸牌进入出牌

- **规则说明**：吃成功后不摸牌，直接进入出牌阶段。
- **触发条件**：吃牌成立，服务端下发吃牌结果消息。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：吃完牌后操作按钮收起，手牌进入可出牌状态；此时待出末张按普通手牌布局，不占摸牌单放位。
- **限制与禁止**：吃后客户端不发起摸牌。
- **异常与边界**：吃/碰后待出张数对 3 取模为 2 时布局会把末张拉开，但摸牌标记为 0，不是真单放。
- **验收**：吃牌消息处理只更新副露与手牌、收起操作按钮，不触发抓牌流程；出牌能力由随后下发的操作权限中的出牌位开启。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:79；source-code/client/Code/layer/BoxHzmjMainView.ts:536
- **服务端职责**：下发 MsgChowS（吃牌成立结果）；随后下发 MsgPower（含出牌位，开放出牌）。
- **客户端职责**：吃牌消息处理只更新副露与手牌、收起操作按钮，不触发抓牌流程；出牌能力由随后下发的操作权限中的出牌位开启。
- **协作边界**：客户端消费 MsgChowS 更新副露与手牌、消费 MsgPower 的出牌位开放出牌；本地不发起摸牌。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:44
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.onCloseOperate);`

#### `AT-ST-C05-006` 吃后同回合可加杠暗杠

- **规则说明**：吃成立的当前回合，仍可以加杠或暗杠。
- **触发条件**：刚吃完牌的同一回合，服务端同时下发杠权限。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：吃完后仍出现杠按钮，点杠弹出可杠牌列表，选中即发送杠；对应手牌保持可点击。
- **限制与禁止**：无。
- **异常与边界**：与摸牌无关的杠不置灰手牌且不必先点“过”；客户端无法识别“吃碰后同回合”这一场景，完全依赖服务端在同回合给出杠权限。
- **验收**：同一回合若操作权限同时给出杠位，客户端显示杠按钮并按组合类型列出暗杠/加杠选项，玩家可选中发送杠。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:609；source-code/client/Code/layer/BoxHzmjMainView.ts:136
- **服务端职责**：下发 MsgPower（同回合的杠权限位与杠组合）；接收 MsgKongC（玩家选定的杠选择）。
- **客户端职责**：同一回合若操作权限同时给出杠位，客户端会显示杠按钮并按组合类型列出暗杠/加杠选项；与摸牌无关的杠不置灰手牌且不必先点过。
- **协作边界**：客户端消费服务端杠权限位展示杠按钮与可杠列表，同回合是否给杠由服务端决定，客户端无场景识别逻辑。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:554
- **原文摘录**：`showGang: (power & BoxMahDefine.PowerType.POWER_ID_KONG) > 0,`

## `FP-ST-C05-003` 碰

- **主描述**：碰牌的成立条件、手中三张只出两张、碰后不摸牌与同回合可杠。
- **范围与边界**：只覆盖碰牌本身；加杠、暗杠资格见对应功能点。
- **总体协作**：碰组合由服务端下发，客户端做副露生成、手牌扣两张与进牌箭头刷新。

### 原子项

#### `AT-ST-C05-007` 碰牌成立条件

- **规则说明**：任意他人刚打出的 1 张非财神，与手中 2 张相同非财神组成刻子，构成碰。
- **触发条件**：任意别家打出一张牌后自己获得碰牌权限，服务端下发由进张与两张手牌组成的刻子组合。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：副露区新增一组刻子，并刷新进牌来源箭头。
- **限制与禁止**：进张必须为任意他人刚打出且非财神（均由服务端保证，客户端不校验）。
- **异常与边界**：客户端不校验打出者、是否“刚打出”以及是否非财神。
- **验收**：碰牌成立后从出牌者牌河移除最后一张进牌，手牌扣两张，副露区新增一组三张刻子。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/PlayerCardsData.ts:789；source-code/client/Code/layer/BoxHzmjMah2DView.ts:895
- **服务端职责**：下发 MsgPower（碰牌权限）；下发 MsgPungS（由进张与两张手牌组成的刻子组合，非财神限制由服务端保证）。
- **客户端职责**：收到碰牌消息后按服务端组合生成副露：从出牌者牌河移除最后一张进牌，手牌扣两张，副露区新增一组三张刻子。
- **协作边界**：客户端消费 MsgPungS 的组合数据生成副露，碰牌资格与非财神限制均在服务端。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:34
- **原文摘录**：`const comboData = GameData.getPlayerCardsData(localSeat)?.setCombo(data.comb as ICombInfo, data.seat);`

#### `AT-ST-C05-008` 碰只消耗两张手牌

- **规则说明**：手中已有 3 张相同牌时，碰也只消耗其中 2 张，第 3 张留在手中。
- **触发条件**：碰牌成立且手上有三张相同牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：碰后副露显示三张，自己的手牌只少两张，手里仍剩一张同牌。
- **限制与禁止**：禁止碰时扣三张手牌，扣牌固定为组合中的两张。
- **异常与边界**：组合数据结构会先剔除进牌，因此手牌只减两张；其他座位的记牌器也只加两张。
- **验收**：碰牌成立后手牌只减少两张，第三张同牌留在手中；其他座位记牌器按组合前两张刷新。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:37；source-code/client/Code/data/PlayerCardsData.ts:786
- **服务端职责**：下发 MsgPungS（碰牌组合，组合含进张与两张手牌）。
- **客户端职责**：碰牌扣牌固定取组合中的两张；组合数据结构会先剔除进牌，因此手牌只减两张，第三张留在手中，其他座位的记牌器也只加两张。
- **协作边界**：客户端消费 MsgPungS 组合，本地固定按两张扣牌；扣牌数量为客户端固定行为。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:36
- **原文摘录**：`// 碰只能减两张`

#### `AT-ST-C05-009` 碰后不摸牌进入出牌

- **规则说明**：碰成功后不摸牌，直接进入出牌阶段。
- **触发条件**：碰牌成立，服务端下发碰牌结果消息。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：碰完牌后操作按钮收起，手牌进入可出牌状态，待出末张不占摸牌单放位。
- **限制与禁止**：碰后客户端不发起摸牌。
- **异常与边界**：吃/碰后待出末张有单放间距，但摸牌标记为 0，不算单放。
- **验收**：碰牌消息处理只更新副露与手牌并收起操作按钮，不触发抓牌流程；出牌能力由随后下发的操作权限中的出牌位开启。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:119；source-code/client/Code/layer/BoxHzmjMainView.ts:536
- **服务端职责**：下发 MsgPungS（碰牌成立结果）；随后下发 MsgPower（含出牌位，开放出牌）。
- **客户端职责**：碰牌消息处理只更新副露与手牌并收起操作按钮，不触发抓牌流程；出牌能力由随后下发的操作权限中的出牌位开启。
- **协作边界**：客户端消费 MsgPungS 更新副露与手牌、消费 MsgPower 的出牌位开放出牌；本地不发起摸牌。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:44
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.onCloseOperate);`

#### `AT-ST-C05-010` 碰后同回合可加杠暗杠

- **规则说明**：碰成立的当前回合，仍可以加杠或暗杠。
- **触发条件**：刚碰完牌的同一回合，服务端同时下发杠权限。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：碰完后同一回合仍出现杠按钮与可杠牌列表。
- **限制与禁止**：无。
- **异常与边界**：客户端无碰后同回合的特殊分支，只按服务端权限位显示杠；与摸牌无关的杠不置灰手牌。
- **验收**：同一回合若操作权限同时给出杠位，客户端显示杠按钮并按组合类型列出暗杠/加杠选项，玩家可选中发送杠。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:697；source-code/client/Code/layer/BoxHzmjMainView.ts:650
- **服务端职责**：下发 MsgPower（同回合的杠权限位与杠组合）；接收 MsgKongC（玩家选定的杠选择）。
- **客户端职责**：同一回合若操作权限同时给出杠位，客户端显示杠按钮并按组合类型列出暗杠/加杠选项；与摸牌无关的杠不置灰手牌。
- **协作边界**：客户端消费服务端杠权限位展示杠按钮与可杠列表，同回合是否给杠由服务端决定。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:554
- **原文摘录**：`showGang: (power & BoxMahDefine.PowerType.POWER_ID_KONG) > 0,`

## `FP-ST-C05-004` 直杠

- **主描述**：直杠的成立条件、优先级裁决与补牌来源。
- **范围与边界**：只覆盖他人打出牌的明杠；加杠、暗杠见对应功能点。
- **总体协作**：直杠由服务端裁决后下发，客户端做四张副露生成、手牌扣三张、动效与补牌动画。

### 原子项

#### `AT-ST-C05-011` 直杠成立条件

- **规则说明**：他人刚打出的 1 张非财神，与手中 3 张相同非财神，构成直杠（明杠）。
- **触发条件**：别家打出的牌与手中三张相同，服务端下发明杠权限与四张组合。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：副露区出现一组四张明杠，播放杠动画与杠音效，其他座位记牌器同步减少。
- **限制与禁止**：进张必须为非财神且来自他人刚打出的牌（由服务端保证，客户端不校验）。
- **异常与边界**：客户端不校验进张来源与是否非财神；明杠成立时清空出牌放大展示。
- **验收**：明杠成立后生成四张副露，清空出牌放大展示，手牌扣三张（四张组合剔除进牌），并播放明杠动效与杠音效。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/PlayerCardsData.ts:789；source-code/client/Code/layer/BoxHzmjTipAniView.ts:504
- **服务端职责**：下发 MsgPower（明杠权限）；下发 MsgKongS（含进张的四张明杠组合）。
- **客户端职责**：收到明杠消息后生成四张副露，清空出牌放大展示，手牌扣三张（四张组合剔除进牌），并播放明杠动效与杠音效。
- **协作边界**：客户端消费 MsgKongS 的组合数据做扣牌与副露展示，明杠成立条件由服务端裁决。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:37
- **原文摘录**：`if (data.comb?.flag === BoxMahDefine.CombType.CMF_MKONG) { GameData.setLastCard(null); }`

#### `AT-ST-C05-012` 直杠优先级裁决

- **规则说明**：直杠需按优先级裁决后才成立。
- **触发条件**：他人打出牌引发多家响应、直杠需与其他响应按优先级裁决时（裁决时机在服务端，客户端无对应实现）。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无。
- **异常与边界**：客户端没有杠与胡的优先级比较逻辑，只接收服务端最终裁决后的权限与结果消息。
- **验收**：客户端不做本地优先级裁决，直杠是否成立完全以服务端下发的 MsgPower/MsgKongS 为准；裁决优先级的正确性待服务端规格确认。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：下发 MsgPower（按优先级裁决后的最终操作权限位）。
- **客户端职责**：待确认
- **协作边界**：客户端只接收服务端最终裁决后的权限与结果消息，不做任何本地优先级比较。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C05-013` 杠后从牌墙尾部补牌

- **规则说明**：直杠成立后，从牌墙尾部补牌。
- **触发条件**：杠成立后，服务端下发抓牌消息并指定抓牌方向。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：杠后牌墙按抓牌方向从对应一端少一张，玩家补进一张牌并播放摸牌动画。
- **限制与禁止**：杠本身不发起摸牌，补牌完全由服务端下发抓牌消息驱动。
- **异常与边界**：抓牌方向支持正向与反向两种；客户端无法证明“杠后补牌一定走反向/牌尾”，方向由服务端下发。
- **验收**：收到抓牌消息时，客户端按消息中的抓牌方向让牌墙对应位置的牌消失并播放摸牌动画；方向为反向时从牌墙另一端取牌。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/GameData.ts:723；source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:45
- **服务端职责**：下发 MsgTake（补牌抓牌消息，含抓牌方向 1 正向、2 反向与补牌牌值）。
- **客户端职责**：杠本身不发起摸牌；补牌由服务端下发抓牌消息，客户端按消息中的抓牌方向让牌墙对应位置的牌消失并播放摸牌动画，方向为反向时从牌墙另一端取牌。
- **协作边界**：客户端消费 MsgTake 的方向字段播放对应端的取牌动画，补牌方向与牌尾规则由服务端决定。
- **来源文件**：`source-code/client/Code/data/GameData.ts`
- **来源定位**：source-code/client/Code/data/GameData.ts:687
- **原文摘录**：`@param nDir:抓拍方向 1:正向 2:反向，`

## `FP-ST-C05-005` 加杠

- **主描述**：已碰刻子持有第 4 张时的加杠、抢杠胡征求与完成后的补牌。
- **范围与边界**：只覆盖已碰出的刻子升级为杠；不覆盖暗杠。
- **总体协作**：加杠由服务端先征求抢杠胡，客户端在收到补杠消息时把原碰原位升级为杠，收到抓牌消息时补牌。

### 原子项

#### `AT-ST-C05-014` 加杠成立条件

- **规则说明**：出牌阶段，已碰出的刻子且手里有第 4 张非财神，可加杠（补杠）。
- **触发条件**：自己出牌阶段，已碰出一组且手里有第 4 张，服务端给出补杠权限。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：原来位于副露区的碰变成四张的杠，副露组数不变。
- **限制与禁止**：无。
- **异常与边界**：“出牌阶段”与“手里有第 4 张”由服务端权限体现，客户端只做碰升级为杠的展示。
- **验收**：收到补杠消息后，在已有副露中查找同牌值的碰组合，把该组原位替换为杠（不新增副露组），手牌扣一张，并重算该组相关的听牌信息。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/PlayerCardsData.ts:106；source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:64；source-code/client/Code/layer/BoxHzmjMah2DView.ts:910
- **服务端职责**：下发 MsgPower（补杠权限）；下发 MsgKongS（补杠组合）。
- **客户端职责**：收到补杠消息后在已有副露中查找同牌值的碰组合，把该组原位替换为杠（不新增副露组），手牌扣一张，并重算该组相关的听牌信息。
- **协作边界**：客户端消费 MsgKongS 的补杠组合做原位升级展示，补杠资格（出牌阶段、持有第 4 张）由服务端判定。
- **来源文件**：`source-code/client/Code/data/PlayerCardsData.ts`
- **来源定位**：source-code/client/Code/data/PlayerCardsData.ts:99
- **原文摘录**：`if (combo.flag == BoxMahDefine.CombType.CMF_TKONG) { //补杠特殊处理，将附录中碰变为杠`

#### `AT-ST-C05-015` 加杠先征求抢杠胡

- **规则说明**：加杠前先征求抢杠胡；有人抢杠胡则加杠不成立、不补牌。
- **触发条件**：玩家点加杠后其他玩家可以胡这张牌；有人抢杠胡时由服务端直接下发胡牌结果。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：抢杠胡时胡牌动效按点炮式播放，结算流水显示“抢杠胡/被抢杠”。
- **限制与禁止**：有人抢杠胡时加杠不成立且不补牌（由服务端裁定，客户端无征求流程实现）。
- **异常与边界**：未发现“加杠前先征求抢杠胡”的交互流程；客户端存在把补杠副露拆回碰的本地回滚函数，但当前代码中未被调用。
- **验收**：抢杠胡发生时胡牌结果按点炮式展示，结算流水出现“抢杠/被抢杠”文案；“先征求”流程与“抢杠胡则不补牌”待服务端规格确认。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/PlayerCardsData.ts:444；source-code/client/Code/util/BoxHzmjFlowUtil.ts:119；source-code/client/Code/layer/BoxHzmjMainView.ts:671
- **服务端职责**：下发 MsgKongS（补杠相关消息）；下发 MsgResultHu（有人抢杠胡时直接下发胡牌结果，加杠不成立）。
- **客户端职责**：客户端有抢杠胡类型与“抢杠/被抢杠”文案，胡牌结果按抢杠胡走点炮式展示；另存在把补杠副露拆回碰的本地回滚函数，但当前代码中未被调用。
- **协作边界**：客户端消费服务端直接下发的 MsgResultHu 展示抢杠胡结算；征求流程与是否补牌由服务端判定。
- **来源文件**：`source-code/client/Code/config/GameDefine.ts`
- **来源定位**：source-code/client/Code/config/GameDefine.ts:149
- **原文摘录**：`[LiuShuiType.LT_QIANG_GANG]: "抢杠",`

#### `AT-ST-C05-016` 无人抢杠后完成加杠补牌

- **规则说明**：无人抢杠胡时，再完成加杠并补牌。
- **触发条件**：加杠无人抢杠胡，服务端下发补杠与抓牌消息。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：碰变杠后从牌墙补进一张牌。
- **限制与禁止**：无。
- **异常与边界**：客户端不判断是否“无人胡”，只按服务端消息执行。
- **验收**：无人抢杠时服务端下发补杠消息，客户端完成碰升级为杠；随后的补牌由抓牌消息驱动，客户端只播动画。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:288
- **服务端职责**：下发 MsgKongS（无人抢杠后的补杠成立结果）；下发 MsgTake（补牌抓牌消息）。
- **客户端职责**：无人抢杠时由服务端下发补杠消息，客户端完成碰升级为杠；随后的补牌同样由服务端下发抓牌消息，客户端只播动画。
- **协作边界**：客户端依次消费 MsgKongS 与 MsgTake 完成升级与补牌展示，是否有人抢杠胡由服务端判定。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:63
- **原文摘录**：`if (data.comb?.flag == BoxMahDefine.CombType.CMF_TKONG) {`

## `FP-ST-C05-006` 暗杠

- **主描述**：手中四张相同时的暗杠成立、补牌、牌面展示与副露区归属。
- **范围与边界**：只覆盖自己的暗杠；不含吃碰后同回合暗杠的资格判定。
- **总体协作**：暗杠由服务端给出杠权限，客户端做四张副露生成、动效、扣四张手牌与补牌动画。

### 原子项

#### `AT-ST-C05-017` 暗杠成立与补牌

- **规则说明**：出牌阶段手中 4 张相同非财神，可暗杠；完成后补牌。
- **触发条件**：自己出牌阶段手里有四张相同牌，服务端给出暗杠权限。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：副露区出现一组暗杠，播放暗杠动效与暗杠音效，随后补进一张牌。
- **限制与禁止**：暗杠牌须为非财神（由服务端约束）。
- **异常与边界**：“出牌阶段”与“非财神”由服务端约束，客户端只做扣四张与展示；补牌由随后的抓牌消息驱动。
- **验收**：收到暗杠消息后手牌扣四张、副露区新增一组暗杠，并按暗杠类型播放暗杠动效与暗杠音效；补牌由随后的抓牌消息驱动。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:509；source-code/client/Code/data/PlayerCardsData.ts:789
- **服务端职责**：下发 MsgPower（暗杠权限）、MsgKongS（暗杠组合）与 MsgTake（补牌抓牌消息）。
- **客户端职责**：收到暗杠消息后手牌扣四张、副露区新增一组暗杠，并按暗杠类型播放暗杠动效与暗杠音效；补牌由随后的抓牌消息驱动。
- **协作边界**：客户端消费 MsgKongS 做扣牌与副露展示、消费 MsgTake 播放补牌动画；暗杠资格与补牌由服务端决定。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:55
- **原文摘录**：`case BoxMahDefine.CombType.CMF_CKONG: kongType = BoxMahDefine.ActionAniType.TYPE_CKONG; break;`

#### `AT-ST-C05-018` 暗杠正反面展示

- **规则说明**：暗杠下层 3 张为牌背、顶张正面，四家都能认出牌面。
- **触发条件**：暗杠成立，副露区生成暗杠组合。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：暗杠在副露区显示为一组牌，底层为牌背、最上一张为正面。
- **限制与禁止**：无。
- **异常与边界**：具体牌背与顶张的渲染由公共麻将组合组件完成，组件源码不在本仓库，无法直接核对“3 张牌背 + 1 张正面”。
- **验收**：暗杠组合按原始顺序展示（杠维持原序、暗杠牌背按原位）；组合区在切换牌背皮肤时统一刷新牌背；牌背/顶张的具体渲染在公共组件内，本仓库待确认。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:1293
- **服务端职责**：下发 MsgKongS（暗杠组合数据）。
- **客户端职责**：杠组合按原始顺序展示，注释明确暗杠牌背按原位处理；组合区在切换牌背皮肤时会统一刷新牌背。
- **协作边界**：客户端消费 MsgKongS 组合数据并按原序渲染，牌背与顶张正面的具体渲染在公共组件内完成。
- **来源文件**：`source-code/client/Code/config/BoxMahDefine.ts`
- **来源定位**：source-code/client/Code/config/BoxMahDefine.ts:799
- **原文摘录**：`杠维持原序（暗杠牌背按原位）；吃/碰/顺子按牌值升序（财神按缺口/替身插位）`

#### `AT-ST-C05-019` 暗杠放在碰杠区不计副露

- **规则说明**：暗杠放在碰杠区展示，但不计副露（不计摊）。
- **触发条件**：暗杠成立，摊数据由服务端下发。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：暗杠显示在碰杠区；摊计数与三摊提示按服务端消息刷新。
- **限制与禁止**：暗杠不计摊。
- **异常与边界**：客户端不区分暗杠是否计摊，摊计数完全按服务端下发的摊数据刷新。
- **验收**：暗杠与其他杠一样加入座位旁的组合牌区；摊计数与三摊提示完全按服务端消息刷新，客户端不自行累计。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameTanUpdateCmd.ts:21；source-code/client/Code/controller/cmd/gameCmd/GameTanUpdateCmd.ts:27
- **服务端职责**：下发 MsgKongS（暗杠组合）；下发 MsgTanUpdate（摊数据与三摊提示，暗杠不计摊由数据体现）。
- **客户端职责**：暗杠与其他杠一样加入座位旁的组合牌区；“是否计副露/摊”完全按服务端下发的摊数据刷新，客户端不自行累计。
- **协作边界**：客户端消费 MsgKongS 渲染暗杠、消费 MsgTanUpdate 刷新摊计数；暗杠是否计摊由服务端数据决定。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:72
- **原文摘录**：`this.dispatch(GameEventBoxHzmj.setCombo, localSeat, comboData, GameData.getPlayerCardsData(localSeat)?.cards.concat());`

## `FP-ST-C05-007` 吃碰同回合杠与七对限制

- **主描述**：吃或碰刚成立的回合仍可加杠、暗杠；四张相同即可杠；杠后不再按七对结算。
- **范围与边界**：第一句与吃、碰两条中的同义句重复，按模板第 68 行原文单独列出以便追溯。
- **总体协作**：客户端对同回合并无特殊分支，仍按服务端权限显示杠；七对是否成立由服务端番型下发，客户端只展示结算结果。

### 原子项

#### `AT-ST-C05-020` 吃碰当回合可加杠暗杠

- **规则说明**：吃或碰刚成立的当前回合，同样可以加杠、暗杠。
- **触发条件**：刚吃或碰完的同一回合，服务端同回合给出杠权限。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：吃碰后同一回合出现杠按钮与多杠选项，相关手牌保持可点击。
- **限制与禁止**：无。
- **异常与边界**：有吃/碰/杠/胡操作按钮且未点“过”时不能直接出牌；与摸牌无关的杠不置灰手牌且不必先点过。该句与吃、碰两条中的同义句重复，客户端无独立实现。
- **验收**：与吃、碰条目共用同一机制：同一回合操作权限给出杠位即显示杠按钮并列出可杠牌，与摸牌无关的杠不置灰手牌且不必先点过。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:701
- **服务端职责**：下发 MsgPower（同回合杠权限位与杠组合）；接收 MsgKongC（玩家选定的杠选择）。
- **客户端职责**：与吃、碰条目共用同一机制：同一回合操作权限给出杠位即显示杠按钮并列出可杠牌，与摸牌无关的杠不置灰手牌且不必先点过。
- **协作边界**：客户端消费服务端杠权限位展示杠按钮与选项；同回合是否给杠由服务端决定，客户端无独立实现。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1445
- **原文摘录**：`// 有吃/碰/杠/胡操作按钮时，不能直接出牌，必须先点“过”（暗杠置灰场景同理）`

#### `AT-ST-C05-021` 四张相同即可杠

- **规则说明**：手中四张相同（非财神）即可杠。
- **触发条件**：自己回合出现可杠牌，服务端给出杠权限与对应组合。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：出现杠按钮时按可杠牌值展示单张或列表（多杠列表用 GangGrps 组件），点选某项即发送杠。
- **限制与禁止**：无。
- **异常与边界**：客户端不判断“四张相同”，也不校验是否为非财神，可杠项完全来自服务端组合；暗杠、明杠、补杠统一进入可杠列表，仅一项时不显示列表。
- **验收**：客户端按服务端给出的杠组合收集可杠牌值，暗杠、明杠、补杠统一进入可杠列表；多个可杠项时展示多杠列表供选择，点选即发送杠。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:835；source-code/client/Fgui/assets/box_hzmj_main/component/GangGrps.xml:4
- **服务端职责**：下发 MsgPower（杠权限位与可杠组合）；接收 MsgKongC（玩家选定的杠选择）。
- **客户端职责**：客户端按服务端给出的杠组合收集可杠牌值，暗杠、明杠、补杠统一进入可杠列表；多个可杠项时展示多杠列表供选择。
- **协作边界**：客户端消费服务端杠组合渲染可杠列表，选择结果经 MsgKongC 回传服务端；“四张相同”的判定在服务端。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:639
- **原文摘录**：`for (const comb of this._playCombs) { if (this._isGangComb(comb.flag)) { mahs.push(comb.mahs[0]); }`

#### `AT-ST-C05-022` 杠后不再按七对结算

- **规则说明**：杠过的这局（这条）不再按七对结算。
- **触发条件**：本局发生杠后的胡牌结算时（客户端无对应实现，判定在服务端）。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：杠后该局禁止再按七对结算（判定完全在服务端）。
- **异常与边界**：客户端结算只按服务端下发的番型与组合展示，没有“杠后不判七对”的逻辑。
- **验收**：客户端结算展示只反映服务端下发的番型与组合，不存在本地“杠后不判七对”的互斥判定；规则成立性待服务端规格确认。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：下发 MsgResultHu（胡牌结算结果与番型，杠后是否按七对结算由番型数据体现）。
- **客户端职责**：待确认
- **协作边界**：客户端只消费服务端下发的番型与组合展示结算结果，不做杠与七对互斥的本地判定。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

## `FP-ST-C05-008` 飘财限制

- **主描述**：受尚未解除的飘财限制时，吃、碰、直杠、加杠被禁止，仍可暗杠；暗杠后只能打刚补进的那张牌。
- **范围与边界**：只覆盖飘财限制下的操作可用性与暗杠后出牌范围；不覆盖飘的计数与番型结算。
- **总体协作**：客户端只记录飘计数并播放飘动效，操作可用性完全由此轮操作权限位与杠组合决定；出牌范围由出牌限制消息的禁打列表实现。

### 原子项

#### `AT-ST-C05-023` 飘财限制下不能吃

- **规则说明**：受尚未解除的飘财限制时，不能吃。飘财限制由自己打出财神触发并按规则解除；在限制未解除期间，即便别家打出可吃的牌，吃操作也不成立。
- **触发条件**：自己处于飘财限制中，别家打出可吃的牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：飘计数增加时播放飘动效；吃按钮是否可见取决于服务端权限位，飘财限制期间服务端不下发吃位时客户端不显示吃按钮。
- **限制与禁止**：受尚未解除的飘财限制时禁止吃。
- **异常与边界**：客户端无飘状态到吃权限的本地映射，规则只能通过服务端不下发吃位实现。
- **验收**：飘财限制期间服务端未下发吃权限时，客户端不显示吃按钮，玩家看不到吃牌选项；客户端不基于飘状态自行隐藏吃按钮。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts:21; source-code/client/Code/layer/BoxHzmjTipAniView.ts:1680; source-code/client/Code/layer/BoxHzmjMainView.ts:552
- **服务端职责**：下发 MsgPiao（更新座位飘计数与飘状态）、下发 MsgPower（操作权限位，飘财限制期间不下发吃位）。
- **客户端职责**：吃按钮是否出现完全由服务端操作权限的吃位决定；客户端只记录飘计数并驱动飘动效，没有基于飘状态隐藏吃按钮的逻辑。
- **协作边界**：客户端消费 MsgPiao 记录飘计数并播放飘动效，消费 MsgPower 的吃位驱动吃按钮显隐；不做飘状态到吃权限的本地判断。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts:21
- **原文摘录**：`GameData.updatePiaoState(data.seat, data.piao_count);`

#### `AT-ST-C05-024` 飘财限制下不能碰

- **规则说明**：受尚未解除的飘财限制时，不能碰。即便别家打出可碰的牌，碰操作也不成立。
- **触发条件**：自己处于飘财限制中，别家打出可碰的牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：飘财限制期间若服务端不给碰位，则碰按钮不出现，玩家看不到碰牌选项。
- **限制与禁止**：受尚未解除的飘财限制时禁止碰。
- **异常与边界**：客户端不读飘计数来拦截碰。
- **验收**：飘财限制期间服务端未下发碰权限时，客户端不显示碰按钮；客户端不基于飘状态自行隐藏碰按钮。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:553; source-code/client/Code/layer/BoxHzmjMainView.ts:579
- **服务端职责**：下发 MsgPiao（飘状态）、下发 MsgPower（碰权限位，飘财限制期间不下发碰位）。
- **客户端职责**：碰按钮是否出现由服务端操作权限的碰位决定；客户端没有根据飘状态屏蔽碰按钮的逻辑。
- **协作边界**：客户端消费 MsgPower 的碰位控制碰按钮显隐；飘计数仅用于记录与动效，不做本地拦截判断。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:553
- **原文摘录**：`showPeng: (power & BoxMahDefine.PowerType.POWER_ID_PONG) > 0,`

#### `AT-ST-C05-025` 飘财限制下不能直杠

- **规则说明**：受尚未解除的飘财限制时，不能直杠。即便别家打出可直杠的牌，直杠操作也不成立。
- **触发条件**：自己处于飘财限制中，别家打出可直杠的牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：飘财限制期间若服务端不给杠位或只给暗杠组合，则杠按钮不出现或可杠列表只列暗杠项，玩家看不到直杠（明杠）选项。
- **限制与禁止**：受尚未解除的飘财限制时禁止直杠。
- **异常与边界**：明杠与暗杠共用一个杠位，客户端无法按权限位区分，只能通过服务端下发的杠组合类型区分。
- **验收**：飘财限制期间服务端不下发直杠组合或整体不给杠位时，客户端不显示直杠选项；客户端不按飘状态过滤明杠组合。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:639; source-code/client/Code/config/BoxMahDefine.ts:208
- **服务端职责**：下发 MsgPiao（飘状态）、下发 MsgPower（杠权限位与可杠组合，飘财限制期间不下发直杠组合）。
- **客户端职责**：杠按钮由服务端操作权限的杠位统一控制，可杠项按组合类型收集；客户端不按飘状态过滤明杠。
- **协作边界**：客户端消费 MsgPower 的杠位与下发的杠组合列表收集可杠项；不做飘状态到明杠过滤的本地判断。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:639
- **原文摘录**：`for (const comb of this._playCombs) { if (this._isGangComb(comb.flag)) { mahs.push(comb.mahs[0]); }`

#### `AT-ST-C05-026` 飘财限制下不能加杠

- **规则说明**：受尚未解除的飘财限制时，不能加杠。即便已碰出一组且手里有第 4 张，加杠操作也不成立。
- **触发条件**：自己处于飘财限制中，且已碰出一组、手里有第 4 张。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：飘财限制期间若服务端不给补杠组合，则玩家在可杠列表中看不到加杠（补杠）选项。
- **限制与禁止**：受尚未解除的飘财限制时禁止加杠。
- **异常与边界**：客户端不读飘计数来拦截补杠；加杠与其他杠类型共用同一可杠列表入口。
- **验收**：飘财限制期间服务端不下发补杠组合时，客户端可杠列表不出现加杠选项。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:652; source-code/client/Code/layer/BoxHzmjMainView.ts:611
- **服务端职责**：下发 MsgPiao（飘状态）、下发 MsgPower（杠权限位与杠组合，飘财限制期间不下发补杠组合）。
- **客户端职责**：加杠入口与其他杠共用杠按钮和可杠列表，客户端不按飘状态过滤补杠类型。
- **协作边界**：客户端消费下发的杠组合类型展示可杠项；补杠是否可选由服务端组合裁剪决定，客户端不做本地过滤。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:652
- **原文摘录**：`return (flag === BoxMahDefine.CombType.CMF_MKONG || flag === BoxMahDefine.CombType.CMF_CKONG || flag === BoxMahDefine.CombType.CMF_TKONG);`

#### `AT-ST-C05-027` 飘财限制下仍可暗杠

- **规则说明**：受尚未解除的飘财限制时，仍可暗杠。飘财限制只禁止吃、碰、直杠、加杠，不禁止暗杠。
- **触发条件**：自己处于飘财限制中且手里有四张相同牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：飘财限制期间仍可能出现杠按钮，点开可杠列表只列出可暗杠的牌，玩家可选择暗杠。
- **限制与禁止**：无。
- **异常与边界**：客户端不判断飘状态，能否暗杠取决于服务端是否下发暗杠组合；暗杠与明杠/补杠共用同一个入口与杠位。
- **验收**：飘财限制期间服务端下发暗杠组合时，客户端保留杠按钮且可杠列表只含暗杠项，玩家能选择暗杠并收到对应杠动效。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:636; source-code/client/Code/layer/BoxHzmjMainView.ts:654; source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:55
- **服务端职责**：下发 MsgPiao（飘状态）、下发 MsgPower（杠权限位与含暗杠的杠组合）、下发 MsgKongC（杠结果与杠类型）。
- **客户端职责**：可杠列表按服务端下发的杠组合类型生成，暗杠与明杠/补杠共用同一个入口；若服务端只给暗杠组合，客户端只列出暗杠项。
- **协作边界**：客户端消费下发的杠组合类型生成可杠列表，消费 MsgKongC 按杠类型播放动效；飘状态不做本地判断。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:636
- **原文摘录**：`private _getGangPowerInfo(): IGangPowerInfo { const mahs: number[] = []; let mKong = 0;`

#### `AT-ST-C05-028` 暗杠后只能打补进的牌

- **规则说明**：暗杠后只能打尾墩刚补进的那一张。暗杠从牌墙尾部补牌后进入出牌阶段，出牌范围被限定为刚补进的这张牌。
- **触发条件**：暗杠后补进一张牌并进入出牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：暗杠补牌后若服务端下发禁打列表，只有刚补进的那张可点，其余手牌置灰；点击被禁的牌会提示"该牌被禁打"。
- **限制与禁止**：被禁打的牌置灰且不可点击；点击被禁的牌被拦截并提示"该牌被禁打"。
- **异常与边界**：客户端只有通用的禁打手牌/禁打单放机制，无法证明该限制就是"暗杠后只能打补进牌"；禁打范围由服务端出牌限制消息下发。
- **验收**：暗杠后服务端下发禁打手牌列表时，客户端把被禁的牌置灰并拦截点击，点击被禁牌提示"该牌被禁打"，玩家只能打刚补进的那张牌。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:33; source-code/client/Code/data/GameData.ts:1799; source-code/client/Code/layer/BoxHzmjMainView.ts:1432
- **服务端职责**：下发 MsgPlayLmts（出牌限制禁打列表，暗杠后仅放行补进牌）、下发 MsgPower（出牌权限）。
- **客户端职责**：客户端按出牌限制消息区分禁打手牌与禁打单放，被禁的牌置灰且不可点击；点击被禁的牌会提示"该牌被禁打"。
- **协作边界**：客户端消费 MsgPlayLmts 维护禁打列表并执行置灰与点击拦截；禁打范围由服务端决定，客户端不做"暗杠后只能打补进牌"的本地推导。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:33
- **原文摘录**：`const handForbid = data.hands ?? [];`
