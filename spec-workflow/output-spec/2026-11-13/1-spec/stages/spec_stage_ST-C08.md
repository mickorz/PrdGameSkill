# 飘财

> 阶段 ID：`ST-C08`。来源：模板「行牌 > 飘财」章节。客户端视角规格，客户端逻辑与 UI 交互以 Code/Fgui 代码证据支撑。

## 0. 阶段

- **阶段 ID**：`ST-C08`
- **阶段**：飘财
- **来源章节**：行牌 > 飘财
- **涉及协议消息**：MsgPiao、MsgPlayLmts、MsgPower、MsgNotifyInfo、MsgChowS、MsgPungS、MsgRelinkOnAction
- **涉及 UI 模块**：BoxHzmjMainView、BoxHzmjPlayerHandCards、BoxHzmjTipAniView、HzmjTipAniComponent（box_hzmj_tipAni）
- **阶段概述**：打出一张财神后开出一个全场唯一的飘财窗口，打出者成为所有者并限制其余三家只能打出刚摸进的那张、其余手牌压暗，同时逐次累计各家的飘档与飘次数并在碰杠位播放「飘」字。

## 术语与单位

| 术语 | 定义 | 单位/量纲 | 作用域 | 来源 |
| --- | --- | --- | --- | --- |
| 财神 | 白板固定为财神，只在胡牌判定时代替顺子、刻子或对子所缺的牌；吃、碰、杠必须使用真实的非财神牌。 | 牌种（白板） | 全局牌规（胡牌判定与飘财判定共用） | 模板 名词章节（第12行） |
| 飘 | 自己出牌阶段打出一张财神，即飘财 1 次；连续打出财神则累加，打出普通牌清零，每小局从 0 次起算。 | 次 | 单家、单小局 | 模板 名词章节（第18行） |
| 飘档 | 飘财的累计档数：只在打出财神且打出后手牌仍然敲响时加 1；没敲响就打财神、或打出普通牌均归零；各家独立，吃碰杠不清飘档。 | 档 | 各家独立累计 | 模板 行牌 > 飘财（第89行） |
| 杠链 | 连续杠的段数，明杠、暗杠、加杠都使杠链加 1；吃、碰，或打出非财神，或打出财神但打出后不再敲响，杠链归零。 | 段 | 单家连续计数 | 模板 行牌 > 杠后补牌（第75行） |
| 敲响 | 打出一张牌后手牌仍处于敲响（已听、可胡）状态；打出后不再敲响则杠链与飘档归零。 | 状态（是/否） | 单家出牌后手牌状态 | 模板 行牌 > 杠后补牌（第75行）与 行牌 > 飘财（第89行） |

## 跨切面行为

- **服务端权威判定**：飘财相关的全部状态判定都在服务端完成，客户端只被动接收结果——MsgPiao（XYID=1283）写入各座位飘计数、MsgPlayLmts（XYID=795）下发禁打手牌与禁打单放、MsgPower 下发可行动作位 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts:21；source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:45）
- **MsgPiao 字段精简**：MsgPiao 只携带 seat 与 piao_count 两个字段，客户端没有任何「窗口所有者 / 受限集合」数据，无法表达窗口建立、迁移与关闭 —— 跨切面（source-code/client/Code/lib/proto_game_hzmj.d.ts:3916）
- **限制通道复用**：客户端把被禁打与吃碰禁手合并复用同一套 MsgPlayLmts hands/dang_fang 通道，无法区分限制来源是飘财还是吃碰禁手 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:10）
- **重连丢失飘计数**：断线重连不恢复飘计数——MsgRelinkOnAction 已定义 piao_counts 字段，但 GameData.recoverPiaoState 无任何调用点，而 gameSceneBack 会派发 onResetUI 触发 clearData 把 _piaoCounts 清零 —— 跨切面（source-code/client/Code/layer/BoxHzmjMainView.ts:399；source-code/client/Code/data/GameData.ts:2015）
- **拦截文案唯一**：飘财受限导致出牌被拦截时，唯一文案来自服务端通知 NIF_EX_MUST_BAO_TOU_WITH_CAI，客户端 toast 文案为「有财必拷响规则生效中」 —— 跨切面（source-code/client/Code/config/GameDefine.ts:471；source-code/client/Code/controller/cmd/gameCmd/GameNotifyInfoCmd.ts:61）

## `FP-ST-C08-001` 飘财窗口的建立、独占与转移

- **主描述**：打出财神即建立一个全场唯一的飘财窗口，打出者成为所有者并限制另外三家；后续有人打出财神时窗口整体转移到新的打出者，不叠加；受限者被逼打出刚摸到的财神时窗口同样转移。
- **范围与边界**：仅覆盖窗口归属与转移语义，不含窗口内的出牌约束（见 FP-ST-C08-002）与关闭重开（见 FP-ST-C08-003）。
- **总体协作**：服务端维护窗口所有者并下发 MsgPiao 与 MsgPlayLmts；客户端只按座位展示禁打灰化与飘字动效。

### 原子项

#### `AT-ST-C08-001` 全场唯一飘财窗口

- **规则说明**：全场同时只有一个飘财窗口（同一时刻场上飘财窗口数量为 1）。
- **触发条件**：有玩家打出财神时（服务端判定）建立飘财窗口；窗口存在期间不得建立第二个窗口。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：禁止同时存在两个及以上飘财窗口。
- **异常与边界**：客户端未找到窗口状态：MsgPiao 仅含 seat 与 piao_count，GameData 只有按座位的 _piaoCounts。唯一单点状态 _playLimitSeat 是 MsgPlayLmts 的出牌限制目标座位，语义为受限方而非窗口所有者，不足以证明全场唯一窗口。
- **验收**：客户端可查证「全场同时只有一个飘财窗口」的状态字段或协议字段；当前 MsgPiao 仅有 seat/piao_count、GameData 仅有按座位 _piaoCounts，验收不通过（待确认）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认
- **协作边界**：客户端仅有按座位的飘计数 _piaoCounts 与出牌限制座位 _playLimitSeat，无窗口唯一性数据；窗口的建立与唯一性完全由服务端状态表达，客户端不消费任何窗口归属字段。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C08-002` 所有者限制另外三家

- **规则说明**：打出财神的玩家成为所有者，限制另外三家。
- **触发条件**：服务端判定某玩家打出财神建立窗口后，向其余三家下发出牌限制（MsgPlayLmts）。
- **配置影响**：本原子项无独立配置（禁打集合 hands/dang_fang 由服务端按窗口状态计算下发）。
- **客户端交互**：仅对本地受限玩家做手牌禁打灰化与点击拦截，其它三家界面无所有者标识。
- **限制与禁止**：受限玩家手牌中命中禁打牌值（hands 或 dang_fang）的牌禁止打出。
- **异常与边界**：客户端只接收到「禁打结果」，没有任何字段说明该限制由哪位玩家打出财神所引起，所有者与受限三家的对应关系不可在客户端查证。
- **验收**：收到 MsgPlayLmts 后，本地受限玩家的手牌按 hands 与 dang_fang 做禁打灰化并拦截点击（BoxHzmjMainView.onPlayLmtsUpdate → applyPlayLmtsGray）。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:45；source-code/client/Code/layer/BoxHzmjMainView.ts:1274
- **服务端职责**：下发 MsgPlayLmts（hands 禁打手牌、dang_fang 禁打单放），以禁打结果表达飘财窗口所有者对另外三家的限制。
- **客户端职责**：服务端通过 MsgPlayLmts 下发禁打手牌 hands 与禁打单放 dang_fang，GamePlayLmtsCmd 写入 GameData 后由 BoxHzmjMainView.onPlayLmtsUpdate 对本地座位手牌做禁打灰化；客户端不判断打出者是否为飘财所有者，也不标记所有者。
- **协作边界**：客户端消费 MsgPlayLmts 的禁打结果做本地手牌灰化与点击拦截；窗口所有者是谁、限制由谁引起均由服务端判定，客户端不做本地判断。
- **来源文件**：source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:10
- **原文摘录**：`* 出牌限制（MsgPlayLmts, XYID=795）\n * - hands：禁打手牌（不含单放）\n * - dang_fang：禁打单放牌值（0=不禁单放）`

#### `AT-ST-C08-003` 窗口换人不叠加

- **规则说明**：之后再有人打出财神，窗口直接换到这个人，不叠加。
- **触发条件**：飘财窗口已存在期间，又有玩家打出财神时窗口整体转移到新的打出者。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：窗口换人时直接整体转移，禁止叠加出第二个窗口或双窗口并存。
- **异常与边界**：客户端无窗口迁移逻辑；收到 MsgPiao 时只把该座位的 piao_count 覆盖写入 _piaoCounts，窗口换人完全依赖服务端重新下发 MsgPlayLmts/MsgPiao。
- **验收**：客户端可查证「窗口换人不叠加」的迁移处理逻辑；当前仅按座位覆盖写入 piao_count，验收不通过（待确认）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认
- **协作边界**：客户端仅消费 MsgPiao 的按座位 piao_count 覆盖写入与 MsgPlayLmts 的禁打结果；窗口换人由服务端重新下发消息体现，客户端无本地迁移判断。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C08-004` 受限者被逼打出财神时窗口转移

- **规则说明**：受限玩家若被逼打出刚摸到的财神，窗口就转到他身上。
- **触发条件**：受限玩家因出牌限制被迫打出刚摸到的那张财神时，窗口转移到该受限玩家。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无。
- **异常与边界**：未找到按「受限方被迫打出财神」触发窗口转移的客户端处理；客户端不区分该张财神是主动打出还是被迫打出。
- **验收**：客户端可查证「受限方被迫打出财神触发窗口转移」的分支处理；当前未找到，验收不通过（待确认）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认
- **协作边界**：客户端不区分主动打出与被迫打出财神，窗口转移判定完全在服务端；客户端只消费转移后的 MsgPiao/MsgPlayLmts 结果。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

## `FP-ST-C08-002` 受限状态下的可行动作与出牌约束

- **主描述**：受限时仍可胡牌与暗杠，但不能吃、碰、直杠、加杠；出牌只能打刚摸进或最新补进的那一张，其余手牌压暗且只在自己界面显示；该限制优先级高于吃碰禁手。
- **范围与边界**：覆盖受限玩家的动作可用性与出牌可用性，不含暗杠后补牌规则。
- **总体协作**：可行动作由服务端 MsgPower 权限位决定，出牌可用性由 MsgPlayLmts 与本地 canPlayCard 校验共同决定，拦截提示由 MsgNotifyInfo 下发。

### 原子项

#### `AT-ST-C08-005` 受限时可胡牌与暗杠

- **规则说明**：受限时可以胡牌和暗杠。
- **触发条件**：玩家处于飘财受限状态且轮到其行动时，服务端通过 MsgPower 下发胡与杠的权限位，客户端按位显示按钮。
- **配置影响**：本原子项无独立配置（权限位定义为 POWER_ID_HU=0x0020、POWER_ID_KONG=0x0040）。
- **客户端交互**：受限时是否出现胡/杠按钮取决于服务端权限位，客户端不做额外过滤或置灰。
- **限制与禁止**：无（允许性规则，禁止面见 AT-ST-C08-006）。
- **异常与边界**：客户端只能验证「胡/杠按钮由服务端决定」，无法验证是暗杠而非明杠、加杠（协议只用一个 POWER_ID_KONG 位表示所有杠）。
- **验收**：MsgPower 下发 POWER_ID_HU / POWER_ID_KONG 位时，本地胡/杠按钮按位显隐（BoxHzmjMainView._getPowerShowState → KW_BTN_Hu.visible）。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:583；source-code/client/Code/config/BoxMahDefine.ts:207
- **服务端职责**：下发 MsgPower（POWER_ID_HU、POWER_ID_KONG 权限位）表达受限时胡与杠（含暗杠）的可行性。
- **客户端职责**：胡、杠按钮的显隐完全由 MsgPower 的 POWER_ID_HU / POWER_ID_KONG 位驱动，BoxHzmjMainView 只按位渲染；客户端没有针对飘财受限场景单独开放「只允许暗杠」的判断。
- **协作边界**：客户端消费 MsgPower 权限位渲染胡/杠按钮，不本地判断受限场景下的动作可行性，也不区分杠的子类型。
- **来源文件**：source-code/client/Code/layer/BoxHzmjMainView.ts
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:549
- **原文摘录**：`private _getPowerShowState(localSeat: number, power: number): IPowerShowState {\n        const hasHu = GameData...`

#### `AT-ST-C08-006` 受限时禁止吃碰直杠加杠

- **规则说明**：受限时不能吃、碰、直杠、加杠。
- **触发条件**：玩家处于飘财受限状态时，服务端不下发吃、碰、杠权限位，对应按钮整体隐藏。
- **配置影响**：本原子项无独立配置（权限位定义为 POWER_ID_CHOW=0x0008、POWER_ID_PONG=0x0010、POWER_ID_KONG=0x0040）。
- **客户端交互**：受限时服务端若不下发对应权限位，吃/碰/杠按钮即整体隐藏，客户端没有独立的禁用态表现。
- **限制与禁止**：禁止受限玩家吃、碰、直杠、加杠。
- **异常与边界**：协议只用一个 POWER_ID_KONG 位表示所有杠，客户端无法区分「允许暗杠、禁止直杠/加杠」的细分语义，暗杠可行性由服务端具体候选列表（combs）体现；遇到底座多杠时由 KW_GangGrps 展示可选杠列表。
- **验收**：受限时（服务端不置吃/碰/杠权限位）本地吃/碰/杠按钮整体隐藏，无独立禁用态。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:601；source-code/client/Code/config/BoxMahDefine.ts:205
- **服务端职责**：下发 MsgPower，受限时不置 POWER_ID_CHOW / POWER_ID_PONG / 相应杠权限位；杠的具体可行性由候选列表（combs）体现。
- **客户端职责**：吃、碰、杠按钮同样由 MsgPower 的 POWER_ID_CHOW / POWER_ID_PONG / POWER_ID_KONG 位控制显隐，客户端不解析杠的子类型（明杠/暗杠/加杠）权限，遇到底座多杠时由 KW_GangGrps 展示可选杠列表。
- **协作边界**：客户端消费 MsgPower 权限位整体控制吃/碰/杠按钮显隐；吃碰杠子类型（直杠/加杠/暗杠）的细分许可由服务端候选列表表达，客户端不做本地细分判断。
- **来源文件**：source-code/client/Code/layer/BoxHzmjMainView.ts
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:577
- **原文摘录**：`this.view.KW_Main.KW_Handler.KW_BTN_Chi.visible = powerState.showChi;\n        this.view.KW_Main.KW_H...`

#### `AT-ST-C08-007` 只能打刚摸进或最新补进的那一张

- **规则说明**：只能打刚摸进或最新补进的那一张。
- **触发条件**：飘财受限时服务端把其余牌值塞进 MsgPlayLmts.hands；玩家点击打出禁牌时由本地 canPlayCard 校验拦截，漏网时由服务端以 MsgNotifyInfo 拦截提示。
- **配置影响**：拦截提示 toast 展示时长 1.3 秒（onShowTextTimeTips 的时长参数）。
- **客户端交互**：打出被禁的牌时 toast「该牌被禁打」；权限被拦截时 toast「有财必拷响规则生效中」。
- **限制与禁止**：禁止打出除刚摸进或最新补进那张以外的任何手牌。
- **异常与边界**：客户端把「只能打摸牌位」表达为「其余手牌全部禁打」，即由服务端把其它牌值全部塞进 hands；客户端没有「只允许打摸牌」的正向白名单字段，也无从区分是飘财限制还是吃碰禁手造成。
- **验收**：受限时打出禁牌被 GameData.canPlayCard 拦截并 toast「该牌被禁打」；被服务端拦截时收到 NIF_EX_MUST_BAO_TOU_WITH_CAI 并 toast「有财必拷响规则生效中」。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameNotifyInfoCmd.ts:61；source-code/client/Code/layer/BoxHzmjMainView.ts:1432；source-code/client/Code/data/GameData.ts:1789
- **服务端职责**：下发 MsgPlayLmts（把可打牌之外的牌值全部塞进禁打集合）与 MsgNotifyInfo（NIF_EX_MUST_BAO_TOU_WITH_CAI 拦截提示）。
- **客户端职责**：出牌前由 BoxHzmjMainView.canPlayMahCheck 调用 GameData.canPlayCard 校验，禁打牌值来自 MsgPlayLmts.hands（禁手牌）与 dang_fang（禁单放）两组；受限出牌被服务端拦截时通过 MsgNotifyInfo 的 NIF_EX_MUST_BAO_TOU_WITH_CAI 下发提示。
- **协作边界**：客户端消费 MsgPlayLmts 做本地出牌校验（canPlayCard，仅当 _playLimitSeat 为本地座位时生效），消费 MsgNotifyInfo 展示拦截文案；「哪张可打」的正向判定在服务端，客户端只持有反向禁打集合。
- **来源文件**：source-code/client/Code/config/GameDefine.ts
- **来源定位**：source-code/client/Code/config/GameDefine.ts:471
- **原文摘录**：`/** 财飘出牌限制：本可出但剩余手牌全被禁手禁打，出牌权限被拦截 */\n    NIF_EX_MUST_BAO_TOU_WITH_CAI = 10,`

#### `AT-ST-C08-008` 其余手牌压暗且仅本地可见

- **规则说明**：其余手牌压暗，只在自己界面显示。
- **触发条件**：本地玩家处于受限状态（hasPlayLimit 成立，_playLimitSeat 为本地座位且禁打集合非空）收到 MsgPlayLmts 后，onPlayLmtsUpdate 应用禁打灰化。
- **配置影响**：本原子项无独立配置（灰化表现为 MahColor.gray）。
- **客户端交互**：其余手牌压暗，只在自己界面显示——被禁的手牌显示为灰色且不可点击；该灰化仅作用于本机玩家手牌。
- **限制与禁止**：其余手牌（除刚摸进/最新补进那张外）全部禁打且不可点击。
- **异常与边界**：模板的「压暗」在客户端实现为禁打灰化（MahColor.gray）而非牌背翻转；「只在自己界面显示」在客户端体现为限制只对本地座位生效，其它玩家手牌本就不可见，无法进一步区分；摸牌位（末张）与手牌的判断以 GameData 的 moCard 为准，避免吃碰后末张被误判为单放。
- **验收**：受限时本地手牌中命中禁打牌值的牌呈灰色且 touchable=false，非禁牌保持原色可点击；仅本地座位生效，其它座位手牌不受灰化影响。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:108；source-code/client/Code/data/GameData.ts:1779
- **服务端职责**：下发 MsgPlayLmts（hands/dang_fang 禁打集合），由其驱动本地手牌压暗。
- **客户端职责**：BoxHzmjPlayerHandCards.applyPlayLmtsGray 遍历手牌，命中禁打牌值的手牌把 touchable 置 false 并调用 Mah2DBase.setMahColor(item, MahColor.gray) 置灰；该逻辑只在 hasPlayLimit（_playLimitSeat === SELF_LOCAL_SEAT）成立时执行，因此仅作用于本机玩家手牌。
- **协作边界**：客户端消费 MsgPlayLmts 的禁打集合对本地手牌置灰与禁点；压暗的牌值范围由服务端计算，客户端不做「哪些牌该压暗」的本地判断。
- **来源文件**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts
- **来源定位**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:84
- **原文摘录**：`applyPlayLmtsGray(handForbid: number[], danFangForbid: number): void {`

#### `AT-ST-C08-009` 飘财限制优先于吃碰禁手

- **规则说明**：这份限制盖过吃碰禁手（飘财限制优先级高于吃碰禁手）。
- **触发条件**：同一玩家的飘财限制与吃碰禁手同时存在时，按飘财限制生效。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：飘财限制优先，禁止吃碰禁手弱化或覆盖飘财限制。
- **异常与边界**：客户端只有一套 MsgPlayLmts hands/dang_fang 通道，飘财限制与吃碰禁手共用，未找到任何优先级比较或来源标记；「盖过」只能由服务端合并计算后下发体现。
- **验收**：客户端可查证飘财限制优先于吃碰禁手的优先级处理逻辑；当前未找到，验收不通过（待确认）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认
- **协作边界**：客户端只消费服务端合并后的禁打结果（MsgPlayLmts），限制来源与优先级合并完全在服务端，客户端不做本地比较。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

## `FP-ST-C08-003` 飘财窗口的关闭与重开

- **主描述**：所有者自己下一次出牌时先关闭窗口；若这张出的又是财神，则立刻重开窗口。
- **范围与边界**：仅覆盖所有者的出牌时机对窗口生命周期的控制。
- **总体协作**：窗口关闭/重开由服务端在出牌结算时判定并通过 MsgPiao 与 MsgPlayLmts 下发。

### 原子项

#### `AT-ST-C08-010` 所有者出牌前关闭窗口

- **规则说明**：所有者自己下一次出牌时先关掉窗口。
- **触发条件**：飘财窗口所有者轮到自己出牌时，服务端先关闭窗口再结算该次出牌。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：所有者出牌时窗口必须先关闭，禁止窗口跨所有者的出牌行为存续。
- **异常与边界**：客户端无窗口实体与关闭时机逻辑；仅在收到 piao_count<=0 的 MsgPiao 时提前 return 不播动画，属被动表现。
- **验收**：客户端可查证所有者出牌关闭窗口的时机处理逻辑；当前未找到，验收不通过（待确认）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认
- **协作边界**：客户端无窗口实体，关闭时机的判定在服务端出牌结算；客户端仅被动消费关闭后的 MsgPiao（计数变化）与 MsgPlayLmts（限制解除）结果。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C08-011` 再打财神立刻重开窗口

- **规则说明**：这张若又是财神，立刻重开（所有者关窗后再次打出财神时立即重开飘财窗口）。
- **触发条件**：所有者关窗的那次出牌打出的又是财神时，窗口立刻重开。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无。
- **异常与边界**：未找到出牌后判定「是否重开窗口」的客户端逻辑，重开完全依赖服务端再次下发 MsgPiao 与新的 MsgPlayLmts。
- **验收**：客户端可查证「再打财神立刻重开窗口」的处理逻辑；当前未找到，验收不通过（待确认）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认
- **协作边界**：重开判定在服务端出牌结算完成；客户端仅消费重开后的 MsgPiao（新计数）与 MsgPlayLmts（新限制集合），无本地重开判断。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

## `FP-ST-C08-004` 飘档的累加与清零规则

- **主描述**：飘档只在打出财神且打出后手牌仍敲响时加 1；未敲响打财神或打出普通牌均使飘档与杠链归零；各家飘档独立；吃碰杠不清飘档而吃碰清杠链。
- **范围与边界**：覆盖飘档的加算条件、归零条件、座位独立性以及与吃碰杠的关系。
- **总体协作**：飘计数由服务端计算并随 MsgPiao 下发，客户端只按座位缓存用于表现；杠链在客户端无对应数据。

### 原子项

#### `AT-ST-C08-012` 打出财神且仍敲响才加 1

- **规则说明**：飘档只在打出财神、且打出后手牌仍然敲响时加 1。
- **触发条件**：服务端判定玩家打出财神且打出后手牌仍敲响时，下发 MsgPiao（该座位计数加 1）。
- **配置影响**：本原子项无独立配置（协议仅 seat 与 piao_count 两字段）。
- **客户端交互**：计数增加时触发对应座位碰杠位的「飘」字动效；无计数数值展示。
- **限制与禁止**：无。
- **异常与边界**：客户端拿到的是已算好的 piao_count，没有加 1 的本地计算，也无「敲响」状态字段（全文无敲/拷响状态实现），加算条件无法在客户端独立验证。
- **验收**：收到 MsgPiao 后 GameData.updatePiaoState 覆盖写入对应座位计数并派发 onPiaoState 触发飘字动效。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts:21；source-code/client/Code/lib/proto_game_hzmj.d.ts:3916
- **服务端职责**：下发 MsgPiao（seat + piao_count，已按「打出财神且打出后仍敲响」在服务端算好计数）。
- **客户端职责**：GamePiaoCmd 接收 MsgPiao 后调用 GameData.updatePiaoState(seat, piao_count) 覆盖写入对应座位计数，并派发 onPiaoState 通知 UI；「是否打出财神、打出后是否仍敲响」的判定在服务端，客户端只同步结果。
- **协作边界**：客户端消费 MsgPiao 的最终计数做缓存与动效；是否打出财神、是否仍敲响、加 1 规则全部在服务端，客户端无本地计算。
- **来源文件**：source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts:9
- **原文摘录**：`* 服务端下发玩家打出财神后的飘计数`

#### `AT-ST-C08-013` 未敲响打财神双归零

- **规则说明**：没敲响就打财神，飘档和杠链都归零。
- **触发条件**：服务端判定玩家打出财神但打出后手牌不再敲响时，下发 MsgPiao（该座位计数归 0）。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：归零时不播放任何「飘」字动效，也无提示。
- **限制与禁止**：无。
- **异常与边界**：客户端可把服务端下发的 0 写入 _piaoCounts[seat]，此时 onPiaoState 因 piaoCount<=0 直接 return，不做任何界面反馈；杠链在客户端无对应字段与归零逻辑，模板要求飘档与杠链同时归零但杠链归零无法查证。
- **验收**：收到 piao_count=0 的 MsgPiao 后对应座位计数写入 0 且不播放飘字动效、无界面提示。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:1675
- **服务端职责**：下发 MsgPiao（piao_count=0 表达飘档归零；杠链归零不在客户端可见协议中）。
- **客户端职责**：客户端可把服务端下发的 0 写入 _piaoCounts[seat]，此时 onPiaoState 因 piaoCount<=0 直接 return，不做任何界面反馈；杠链在客户端无对应字段与归零逻辑。
- **协作边界**：客户端消费 MsgPiao 的 0 值做计数覆盖；「未敲响打财神」的判定与杠链归零均在服务端，客户端仅以不播动画被动表现。
- **来源文件**：source-code/client/Code/data/GameData.ts
- **来源定位**：source-code/client/Code/data/GameData.ts:1699
- **原文摘录**：`updatePiaoState(seat: number, piaoCount: number): void {\n        this._piaoCounts[seat] = piaoCount;\n    }`

#### `AT-ST-C08-014` 打出普通牌归零

- **规则说明**：打出普通牌同样归零（打出非财神牌时飘档归零）。
- **触发条件**：服务端判定玩家打出普通牌时，下发 MsgPiao（该座位计数归 0）。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：计数归零后不再出现「飘」字动效，界面无清零提示。
- **限制与禁止**：无。
- **异常与边界**：客户端无出牌牌型判定与本地清零触发，是否「打出普通牌」由服务端判断后下发 0；复盘模式下 onPiaoState 直接跳过。
- **验收**：打出普通牌导致归零时（服务端下发 piao_count=0），对应座位计数覆盖为 0，界面无飘字动效与清零提示。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:1673
- **服务端职责**：下发 MsgPiao（piao_count=0）表达打出普通牌后的归零。
- **客户端职责**：打出普通牌导致归零时由服务端下发 MsgPiao（piao_count=0），客户端 updatePiaoState 将对应座位计数覆盖为 0；本地不主动判定普通牌清零点。
- **协作边界**：客户端消费 MsgPiao 的 0 值覆盖计数；普通牌/财神的牌型判定在服务端，客户端无本地清零触发。
- **来源文件**：source-code/client/Code/data/GameData.ts
- **来源定位**：source-code/client/Code/data/GameData.ts:1700
- **原文摘录**：`this._piaoCounts[seat] = piaoCount;`

#### `AT-ST-C08-015` 各家飘档独立

- **规则说明**：各家飘档独立。
- **触发条件**：任一家飘档变化时仅更新该座位计数，不影响其它座位。
- **配置影响**：本原子项无独立配置（计数数组长度 4，按座位下标存储）。
- **客户端交互**：飘字动效按座位独立播放（seatToLocal 后取该座位的碰杠动画节点），界面无汇总展示。
- **限制与禁止**：禁止一家飘档变化影响其它家的计数。
- **异常与边界**：getPiaoCount 除定义外无调用点，说明该计数当前只服务于表现层。
- **验收**：四个座位计数互不影响——updatePiaoState 只写单个座位下标，getPiaoCount(seat) 按座位读取；某座位飘字动效只在对应座位碰杠位播放。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/GameData.ts:1699；source-code/client/Code/data/GameData.ts:1714
- **服务端职责**：下发 MsgPiao（按座位独立下发各家的 piao_count）。
- **客户端职责**：GameData 用长度 4 的 _piaoCounts 数组按座位下标分别存储，updatePiaoState 只写单个座位，getPiaoCount(seat) 按座位读取，互不影响。
- **协作边界**：客户端按座位独立缓存与表现计数；各家飘档的独立计算在服务端，客户端不做跨座位联动。
- **来源文件**：source-code/client/Code/data/GameData.ts
- **来源定位**：source-code/client/Code/data/GameData.ts:1601
- **原文摘录**：`private _piaoCounts: number[] = [0, 0, 0, 0];`

#### `AT-ST-C08-016` 吃碰杠不清飘档且吃碰清杠链

- **规则说明**：吃、碰、杠不清飘档，吃和碰会清杠链。
- **触发条件**：玩家吃、碰或杠时飘档保持不变；玩家吃或碰时杠链清零（杠链部分客户端不可查证）。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：吃碰杠动效（chi/peng/gang skin）播放时不改变飘计数展示。
- **限制与禁止**：吃碰杠不得清除飘档（客户端体现为吃碰杠命令不触碰 _piaoCounts）。
- **异常与边界**：「不清飘档」为代码缺失型证据（吃碰杠命令均不触碰 _piaoCounts）；「吃和碰会清杠链」因客户端无杠链数据完全无法查证。
- **验收**：吃碰杠命令执行后 _piaoCounts 不变（吃碰杠不清飘档）；杠链清零在客户端无对应数据，无法验收（待确认）。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:32
- **服务端职责**：下发 MsgChowS、MsgPungS 表达吃碰结果；吃碰杠不清飘档时飘计数不因吃碰杠清零下发。
- **客户端职责**：GameChowCmd 与 GamePungCmd 只更新牌桌状态、副露组合与手牌计数，未读取或修改 _piaoCounts，行为与「不清飘档」一致；杠链在客户端无对应字段。
- **协作边界**：客户端消费 MsgChowS/MsgPungS 更新牌桌表现且不动飘计数；杠链的维护与清零完全在服务端，客户端无对应数据。
- **来源文件**：source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:32
- **原文摘录**：`GameData.setTableState(MahGameState.MAH_STATE_CHOW);\n        GameData.clearFuPanPower();\n        const comboD...`

## `FP-ST-C08-005` 飘次数的累计、小局重置与飘字表现

- **主描述**：飘次数在本局内累加、小局重置时清零；次数大于 0 时在该座位碰杠位播放「飘」字，且不设常驻标签。
- **范围与边界**：覆盖飘计数的生命周期与唯一可见表现（飘字动效）。
- **总体协作**：计数由服务端 MsgPiao 驱动，客户端在小局重置时清空，动效由 BoxHzmjTipAniView 在碰杠位节点播放。

### 原子项

#### `AT-ST-C08-017` 飘次数本局累加、小局重置清零

- **规则说明**：飘次数本局累加，小局重置时清掉。
- **触发条件**：小局内收到 MsgPiao 时按 piao_count 覆盖累加计数；小局重置（onResetUI 事件）时清零。
- **配置影响**：本原子项无独立配置（重置目标为长度 4 的全零数组）。
- **客户端交互**：小局重置后各座位飘计数归零，碰杠位不再有飘字动效。
- **限制与禁止**：飘计数不得跨小局保留。
- **异常与边界**：断线重连也走 onResetUI（gameSceneBack 派发）会把飘计数清零；MsgRelinkOnAction 已定义 piao_counts 字段，但 GameData.recoverPiaoState 无任何调用点，重连后飘计数会丢失，需确认是否为预期。
- **验收**：小局重置（onResetUI → BoxHzmjMainView.resetUI → GameData.clearData → clearHzmjData）后 _piaoCounts 归零为 [0,0,0,0]；断线重连后飘计数同样被清零（recoverPiaoState 未接线，现状与验收口径一致但需确认是否预期）。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/GameData.ts:230；source-code/client/Code/layer/BoxHzmjMainView.ts:399
- **服务端职责**：下发 MsgPiao（小局内累加的 piao_count）；重连恢复字段 piao_counts 已在 MsgRelinkOnAction 定义但客户端未接线。
- **客户端职责**：GameData.clearHzmjData() 将 _piaoCounts 重置为 [0,0,0,0]；clearData() 内调用 clearHzmjData()，小局重置由 onResetUI 事件触发 BoxHzmjMainView.resetUI() 中的 GameData.clearData()；局内累加由 MsgPiao 的 piao_count 直接覆盖体现。
- **协作边界**：客户端消费 MsgPiao 做局内累加缓存，本地负责小局重置清零（onResetUI 链路）；重连恢复虽有协议字段但客户端未消费，属当前遗留缺口。
- **来源文件**：source-code/client/Code/data/GameData.ts
- **来源定位**：source-code/client/Code/data/GameData.ts:2015
- **原文摘录**：`clearHzmjData(): void {\n        this._bankerLevel = 1;\n        ...\n        this._piaoCounts = [0, 0, 0, 0];`

#### `AT-ST-C08-018` 碰杠位播放飘字且无常驻标签

- **规则说明**：次数大于 0 时，在该座位碰杠位播放「飘」字，没有常驻标签。
- **触发条件**：onPiaoState 收到 piaoCount>0 且非复盘模式时，定位该座位碰杠位节点播放飘字动效。
- **配置影响**：动效资源配置为 skin=piao、url=Paixing_wz03，播放节点为各座位 KW_Ani_PengGang_{uiIdx}（初始 visible=false、touchable=false），播完置 visible=false。
- **客户端交互**：次数大于 0 时，在该座位碰杠位播放「飘」字——在对应座位碰杠位播放一次「飘」字 Spine 动画（skin=piao），动画结束即隐藏，界面无数字或常驻飘标签。
- **限制与禁止**：不设常驻飘标签，不展示计数数值。
- **异常与边界**：复盘模式下直接跳过；动效只在 piaoCount>0 时播放，归零事件不播动画；Paixing_wz03.json 的 skin 列表中确认存在 piao skin；在 Fgui 各包 XML 中检索不到 piao/飘 相关常驻标签组件，与「没有常驻标签」一致。
- **验收**：piaoCount>0 且非复盘模式时，对应座位 KW_Ani_PengGang_{uiIdx} 节点播放 skin=piao 的 Spine 动画，播完隐藏；piaoCount<=0 不播放；全界面无常驻飘标签与计数数值。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:1680；source-code/client/Code/layer/BoxHzmjTipAniView.ts:517；source-code/client/Code/layer/BoxHzmjTipAniView.ts:183；source-code/client/Fgui/assets/box_hzmj_tipAni/component/HzmjTipAniComponent.xml:44
- **服务端职责**：下发 MsgPiao（piao_count>0 触发客户端飘字动效）。
- **客户端职责**：BoxHzmjTipAniView.onPiaoState 监听 onPiaoState，piaoCount>0 时用 TableData.seatToLocal 定位座位，调用 onMsgPlayPengGang(TYPE_PIAO, localSeat)；后者把该座位 KW_Ani_PengGang_{uiIdx} 节点的 skinName 设为 piao、url 设为 Paixing_wz03 并播放 animation，播完置 visible=false。复盘模式下直接跳过。
- **协作边界**：客户端消费 MsgPiao 的计数触发本地动效（阈值判断 piaoCount>0 与复盘模式跳过为本地逻辑）；动效资源、节点定位与播放时长全部在客户端本地维护。
- **来源文件**：source-code/client/Code/layer/BoxHzmjTipAniView.ts
- **来源定位**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:1672
- **原文摘录**：`@gf.listen(GameEventBoxHzmj.onPiaoState)\n    onPiaoState(seat: number, piaoCount: number): void {...`
