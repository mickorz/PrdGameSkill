# 番型

> 阶段 ID：`ST-C14`。来源：模板「番型」章节。客户端视角规格，客户端逻辑与 UI 交互以 Code/Fgui 代码证据支撑。

## 0. 阶段

- **阶段 ID**：`ST-C14`
- **阶段**：番型
- **来源章节**：番型
- **涉及协议消息**：MsgResultHu、MsgHuItem、MsgPower、MsgWaitInfos、MsgJoker、MsgPlayLmts
- **涉及 UI 模块**：BoxHzmjMainView、BoxHzmjTipAniView、BoxHzmjTingPaiView、BoxHzmjPlayerHandCards、BoxHzmjMah2DView、BoxHzmjResultMid、BoxHzmjResultLeft、box_hzmj_tingPai、box_hzmj_result
- **阶段概述**：胡牌时按基础/杠开/财神三组番型各自只取最高档、组间连乘计算倍数，并规定点炮与抢杠不适用于爆头、财飘、杠开、十风等自摸类番型。

## 术语与单位

| 术语 | 定义 | 单位/量纲 | 作用域 | 来源 |
| --- | --- | --- | --- | --- |
| 面子 | 一组顺子、刻子或杠；杠含 4 张仍计 1 组面子，对子不是面子；已完成的吃、碰、明杠、暗杠都计入面子。 | 组 | 全局（牌型判定） | 模板名词章节（第 11 行） |
| 财神 | 白板固定为财神，只在胡牌判定时代替顺子、刻子或对子所缺的牌；吃、碰、杠必须用真实的非财神牌。 | 无 | 全局（胡牌判定与吃碰杠限制） | 模板名词章节（第 12 行） |
| 牢庄 | 本期固定为笃三老庄，每小局庄家都按三牢、8 倍计算。 | 倍 | 每小局结算 | 模板名词章节（第 13 行） |
| 爆头 | 摸牌前为 4 组面子加 1 张财神，下一张摸到任意牌都能与这张财神组成对子后自摸，只能自摸。 | 番型（2 倍） | 财神组番型判定与听牌表现 | 模板名词章节（第 16 行） |
| 七客 | 七对爆头：摸牌前没有吃碰杠，手牌为 6 组对子加 1 张财神；结算不单列，按七对和爆头两组连乘。 | 番型组合 | 胡牌番型结算表现 | 模板名词章节（第 17 行） |
| 飘 | 自己出牌阶段打出一张财神即飘 1 次，连续打出财神则累加，打出普通牌清零，每小局从 0 次起算。 | 次 | 每小局出牌阶段（财飘档位） | 模板名词章节（第 18 行） |
| 放铳 | 打出的牌被他人合法胡走，胡牌者称为点炮胡；白板财神弃牌不能点炮胡。 | 无 | 点炮胡判定 | 模板名词章节（第 19 行） |
| 番型ID（HzmjFanType） | 杭麻番型 2401-2420 与服务端 fan_type 一致，注释明确分三组互斥、组内取最高档后连乘。 | 枚举 ID | 客户端番型表现映射 | source-code/client/Code/config/FanDefine.ts:10-54 |

## 跨切面行为

- **番型判定与取档归服务端**：番型判定与取档全部由服务端完成，客户端只用 fan_ids / fan_point 做表现：XsmjFanConfig 注释写明“实际总倍率始终取服务端 fan_point”，FanDefine 仅维护 ID、名称与动效排序表 —— 跨切面（source-code/client/Code/config/XsmjFanConfig.ts:4；source-code/client/Code/config/FanDefine.ts:12）。
- **番型动效统一播放器**：番型动效统一由 BoxHzmjTipAniView 的 KW_Ani_CPG_0~3 播放：基础档走 Paixing_wz01（KW_Ani_Hu_Type）、组合/高级档走 Paixing_wz04（KW_Ani_Hu），组合优先级为 七客 > 杠飘 > 杠爆 —— 跨切面（source-code/client/Code/layer/BoxHzmjTipAniView.ts:1036）。
- **番型语音映射与兜底**：番型语音由 GameSoundConfig.resolveHuFanSoundKeys 决定：剔除平胡 2401、最多播两段（间隔 HU_FAN_SOUND_GAP_MS），未配置的 2418 十风会兜底成普通胡音 —— 跨切面（source-code/client/Code/config/GameSoundConfig.ts:435）。
- **财神染红贯穿各视图**：财神染红贯穿手牌、牌河、副露、胡牌列表、听牌列表与小结算财神牌；同牌高亮（绿/蓝）优先，染红不覆盖高亮 —— 跨切面（source-code/client/Code/util/BoxHzmjMahColorUtil.ts:29）。
- **小结算流水文案兜底**：小结算流水文案在 flow_str_items 缺失时用 hu_item.fan_ids 兜底生成，且好友房只展示番型名不拼倍数，匹配场才追加 win_lost.mult 倍 —— 跨切面（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:765）。
- **非平胡胡牌短震动**：自己胡出非平胡番型时触发一次短震动（MiniGameManager.vibrateShort），复盘/回放模式不触发 —— 跨切面（source-code/client/Code/controller/cmd/helperCmd/ResultCmd.ts:21）。
- **报听（敲响）入口已移除**：客户端报听（敲响）入口已移除（BoxHzmjMainView.onBtnBaoTing 空实现），与“爆头听任意牌时改看进张前是否敲响”缺少对应的敲响状态 —— 跨切面（source-code/client/Code/layer/BoxHzmjMainView.ts:1195）。

## `FP-ST-C14-001` 番型判定总则与胡法前置

- **主描述**：先确定牌型与胡牌方式（自摸/点炮/抢杠），再按三组番型组内取最高档、组间连乘；点炮与抢杠排除自摸类番型。
- **范围与边界**：覆盖分组、取档、连乘与胡法排除的总则，不含各组番型的具体成立条件。
- **总体协作**：服务端完成牌型与番型判定并下发 fan_ids/fan_point；客户端负责胡法识别、番型动效、语音与文案表现。

### 原子项

#### `AT-ST-C14-001` 胡法判定先于牌型确认

- **规则说明**：先确认牌型，再确认本次胡牌方式为自摸、点炮胡或抢杠胡；胡法确认是番型计算的前置步骤。
- **触发条件**：服务端下发 MsgResultHu，客户端处理胡牌结果并进入胡牌表现（动效、语音、小结算）时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：点炮走点炮动效（dianpao / yipaoduoxiang）与“胡”音，自摸走 zimo 音与自摸动画；小结算行以 C_HuType 角标区分点炮/自摸。
- **限制与禁止**：无。
- **异常与边界**：HT_DISCARD（放铳）、HT_DIAN_GANG_HUA（点杠花）与 HT_ROBKONG（抢杠）统一按点炮类处理；牌型判定本身不在客户端。
- **验收**：MsgResultHu 的 hu_items.hu_type 为 HT_DISCARD / HT_DIAN_GANG_HUA / HT_ROBKONG 时，客户端按点炮类表现并读取 df_from；其余按自摸表现（isZimo 判据一致）；小结算行 C_HuType 角标页正确区分。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:339；source-code/client/Code/layer/BoxHzmjTipAniView.ts:929；source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:95
- **服务端职责**：下发 MsgResultHu 与 MsgHuItem，携带 hu_items.hu_type（自摸类 / HT_DISCARD / HT_DIAN_GANG_HUA / HT_ROBKONG）与点炮来源 df_from。
- **客户端职责**：GameResultHuCmd 依据 hu_items.hu_type 判定胡法：HT_DISCARD / HT_DIAN_GANG_HUA / HT_ROBKONG 视为点炮类并读取 df_from；TipAni 用同一判据生成 isZimo。牌型判定本身不在客户端。
- **协作边界**：客户端消费 MsgResultHu / MsgHuItem 的 hu_type 字段做表现分类；胡法与牌型的最终判定均在服务端。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:339
- **原文摘录**：`return huType === HuType.HT_DISCARD || huType === HuType.HT_DIAN_GANG_HUA || huType === HuType.HT_ROBKONG;`

#### `AT-ST-C14-002` 番型三组、组内取最高档

- **规则说明**：番型分为三组（基础/七对组、杠开组、财神组），每组内只取最高一档参与计算。
- **触发条件**：服务端下发 MsgResultHu 的 fan_ids 后，客户端选择动效主番型时。
- **配置影响**：FanDefine 的 HzmjFanType 枚举（2401-2420）注释声明三组互斥；HzmjFanAniSortingMap 维护动效排序。
- **客户端交互**：胡牌只播一档主番型动画：基础档走 KW_Ani_Hu_Type 文字动效，其余走 KW_Ani_Hu 动效；同组不会并播多档。
- **限制与禁止**：同组不得并播多档番型动效。
- **异常与边界**：FanDefine 第 14 行把 2402-2405（爆头/财飘）注释在“基础/七对组”块内，与第 12 行“财神组”表述自相矛盾（既有注释不一致）。
- **验收**：fan_ids 含多档番型时，PickHzmjPrimaryFanId 按 HzmjFanAniSortingMap 只选出一个主番型并只播一档动画，不并播多档。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:12；source-code/client/Code/config/FanDefine.ts:277；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1036
- **服务端职责**：下发 MsgResultHu，fan_ids 已完成组内取最高档，客户端仅做表现选档。
- **客户端职责**：FanDefine 定义 HzmjFanType 2401-2420，注释声明“分3组互斥：基础/七对组、杠开组、财神组，最终倍数 = 三组最高档连乘”；PickHzmjPrimaryFanId 按 HzmjFanAniSortingMap 从 fan_ids 选单个主番型用于动效。
- **协作边界**：客户端消费 fan_ids 做动效选档；取档与番型判定逻辑在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:12
- **原文摘录**：`// 分3组互斥：基础/七对组、杠开组、财神组，最终倍数 = 三组最高档连乘`

#### `AT-ST-C14-003` 组间连乘

- **规则说明**：三组各自取得最高档后，组间倍数连乘得到总倍数。
- **触发条件**：服务端下发 MsgPower（胡牌时）与 MsgResultHu 后，客户端展示胡按钮倍数、听牌倍数与小结算时。
- **配置影响**：XsmjFanConfig 注释声明萧山单项倍率表仅用于动画候选比较，实际总倍率始终取服务端 fan_point。
- **客户端交互**：胡按钮 KW_HuPaiBeiShu 显示“N倍”；听牌卡 KW_BeiShuNum 显示每张牌的倍数；好友房小结算只显示番型名，不显示倍数。
- **限制与禁止**：好友房小结算不拼分与倍数。
- **异常与边界**：三组结果合并后的明细只在 fan_details（fan_id+mult）中透传给 GameData，未见界面消费。
- **验收**：胡按钮 KW_HuPaiBeiShu 显示的倍数与服务端 MsgPower.hu_point 一致；听牌卡 KW_BeiShuNum 显示服务端 point；好友房小结算仅展示番型名。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/XsmjFanConfig.ts:4；source-code/client/Code/layer/BoxHzmjMainView.ts:666；source-code/client/Code/interface/GameInterface.ts:47；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:765
- **服务端职责**：下发 MsgPower（hu_point）与 MsgResultHu（fan_point），总倍数已按组间连乘计算完成。
- **客户端职责**：客户端不计算番点，总倍率直接取服务端 fan_point / hu_point：胡按钮显示 MsgPower.hu_point，听牌列表显示服务端 point。
- **协作边界**：客户端消费 MsgPower / MsgResultHu 中已算好的倍数字段做展示，本地不做任何倍数计算。
- **来源文件**：`source-code/client/Code/config/XsmjFanConfig.ts`
- **来源定位**：source-code/client/Code/config/XsmjFanConfig.ts:4
- **原文摘录**：`/** 萧山单项倍率，仅用于动画候选比较；实际总倍率始终取服务端 fan_point。 */`

#### `AT-ST-C14-004` 点炮与抢杠排除自摸类番型

- **规则说明**：点炮胡和抢杠胡不计算爆头、财飘、杠开、十风等自摸类番型。
- **触发条件**：服务端下发点炮/抢杠类 hu_type 的 MsgResultHu 时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：点炮与抢杠仍会按服务端 fan_ids 播放对应番型动效与语音，不会因“非自摸”降级为平胡。
- **限制与禁止**：无（客户端不做剔除，剔除义务在服务端）。
- **异常与边界**：若服务端误下发 2402/2403/2406/2418 的点炮胡，客户端会照原样播放（客户端无校验兜底）。
- **验收**：点炮/抢杠胡的 MsgResultHu 中 fan_ids 不含自摸类番型时，客户端正常播放基础番型表现；客户端表现与服务端 fan_ids 一一对应，无本地剔除或降级。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:339；source-code/client/Code/layer/BoxHzmjTipAniView.ts:934
- **服务端职责**：下发 MsgResultHu，fan_ids 已按胡法排除点炮/抢杠场景下的爆头、财飘、杠开、十风。
- **客户端职责**：客户端能识别点炮/抢杠胡法，但不对 fan_ids 做任何剔除，服务端下发的番型列表原样进入动效、语音与文案。
- **协作边界**：客户端消费 fan_ids 原样表现；排除规则完全由服务端实现，客户端无校验。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:339
- **原文摘录**：`return huType === HuType.HT_DISCARD || huType === HuType.HT_DIAN_GANG_HUA || huType === HuType.HT_ROBKONG;`

## `FP-ST-C14-002` 基础组：平胡与七对族

- **主描述**：基础组包含平胡 1 倍，以及带财七对 2/4/8/16 与清七对 4/8/16/32 两个分支。
- **范围与边界**：覆盖平胡与七对族的成立条件与档位；不含杠开、财神、十风等其他组。
- **总体协作**：服务端判定牌型与豪华组数；客户端维护 ID、名称、动效 skin 与语音映射。

### 原子项

#### `AT-ST-C14-005` 平胡 1 倍

- **规则说明**：平胡倍数 1，成立条件为 4 组面子加 1 对（将）。
- **触发条件**：服务端下发 fan_ids 含 2401 的 MsgResultHu 时。
- **配置影响**：FanDefine 定义 K_FTG_HZMJ_PING_HU=2401（注释“平胡（四面子一将），1x”）；ResultCmd 的 _baseFanIds 基础番型集合仅含 2401。
- **客户端交互**：平胡单番走 KW_Ani_Hu_Type 的 pinghu 文字动效；平胡语音按自摸/点炮分别取各方言的胡音与自摸音。
- **限制与禁止**：平胡被视作“素胡”，不触发震动。
- **异常与边界**：无。
- **验收**：fan_ids 为 [2401] 时播放 pinghu 文字动效，名称/结算/流水文案输出“平胡”，自己胡出时不触发短震动，语音按自摸/点炮区分。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:15；source-code/client/Code/config/FanDefine.ts:74；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1081；source-code/client/Code/controller/cmd/helperCmd/ResultCmd.ts:21
- **服务端职责**：下发 MsgResultHu，“4 组面子加 1 对”成立时下发 2401。
- **客户端职责**：HzmjFanType 定义 K_FTG_HZMJ_PING_HU=2401，注释“平胡（四面子一将），1x”，在名称表、结算两行文案与流水文案中输出“平胡”；平胡被视作“素胡”，不触发震动。
- **协作边界**：客户端消费 2401 做名称/动效/语音/震动表现；“4 组面子加 1 对”的成立判定不在客户端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:15
- **原文摘录**：`/** 平胡（四面子一将），1x */`

#### `AT-ST-C14-006` 平胡中财神可参与面子或对子

- **规则说明**：平胡的 4 组面子与 1 对中，财神可以参与面子或对子的构成。
- **触发条件**：由服务端在胡牌判定阶段处理，客户端无对应实现（待确认）。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无。
- **异常与边界**：无。
- **验收**：客户端无对应实现，本条仅能通过服务端番型判定结果间接确认。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认
- **协作边界**：客户端不做胡牌拆解，FanDefine 仅有番型枚举注释，财神参与面子/对子完全由服务端在胡牌判定时处理。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C14-007` 七对 2 倍并逐级豪华

- **规则说明**：七对 / 豪华七对 / 双豪华七对 / 三豪华七对，倍数 2 / 4 / 8 / 16；成立条件为 14 张组成 7 对，且手里至少有 1 张财神。
- **触发条件**：服务端下发 fan_ids 含 2410-2413 之一的 MsgResultHu 时。
- **配置影响**：FanDefine 定义 2410-2413 与名称/倍数注释；GameSoundConfig 配置七对族语音；TipAni 映射七对系 skin（hhqd/2hhqd/3hhqd）。
- **客户端交互**：七对单番走文字动效 qiduizi；带财七对叠加爆头/财飘时改走组合动效 qk/hhqk/2hhqk/3hhqk，文案显示为“七客/豪华七客”等。
- **限制与禁止**：无。
- **异常与边界**：客户端把带财七对叠加爆头/财飘统一定名为“七客”，模板未定义“七客”名称，属既有表现差异；客户端不校验“14 张 7 对”与“至少 1 张财神”。
- **验收**：fan_ids 含 2410-2413 时输出对应档位动效（qiduizi/hhqd/2hhqd/3hhqd）与七对族语音；带财七对叠加爆头/财飘时输出“七客”系组合动效与文案。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:33；source-code/client/Code/config/FanDefine.ts:35；source-code/client/Code/config/FanDefine.ts:252；source-code/client/Code/config/FanDefine.ts:341；source-code/client/Code/config/GameSoundConfig.ts:435
- **服务端职责**：下发 MsgResultHu，判定 7 对结构与财神持有情况后下发 2410-2413 对应档位。
- **客户端职责**：FanDefine 定义 2410-2413 与名称/倍数注释；TipAni 映射七对系 skin（hhqd/2hhqd/3hhqd）；GameSoundConfig 配置七对族语音。客户端不校验“14 张 7 对”与“至少 1 张财神”。
- **协作边界**：客户端消费 fan_ids 中的七对档位 ID 做动效/语音/文案；档位判定在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:33
- **原文摘录**：`/** 七对，2x */`

#### `AT-ST-C14-008` 四张实牌计 1 组豪华

- **规则说明**：某种非财神牌面有 4 张实牌时，计 1 组豪华；豪华组数决定七对档位。
- **触发条件**：服务端下发豪华及以上七对档位（2411-2413）的 MsgResultHu 时。
- **配置影响**：FanDefine 注释以“含 1/2/3 组四张相同”标注豪华档位。
- **客户端交互**：豪华及以上档位分别播 2hhqd/3hhqd 等动效（普通七对与豪华单番共用 hhqd）。
- **限制与禁止**：无。
- **异常与边界**：“非财神牌面/实牌”的限定在客户端注释与映射中均未体现，豪华组数完全依赖服务端。
- **验收**：fan_ids 为 2411/2412/2413 时分别播放对应豪华档动效（2hhqd/3hhqd 等）与豪华名称文案。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:37；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1145
- **服务端职责**：下发 MsgResultHu，统计非财神牌面的四张实牌组数后下发对应豪华档位。
- **客户端职责**：FanDefine 以注释方式记录豪华档位“含 1 组四张相同”，名称表输出豪华/双豪华/三豪华七对；客户端无四张实牌统计逻辑。
- **协作边界**：客户端消费档位 ID 做动效与名称表现；四张实牌组数统计在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:37
- **原文摘录**：`/** 双豪华七对（含2组四张相同），8x */`

#### `AT-ST-C14-009` 白板不计豪华

- **规则说明**：白板（财神）不计入豪华组数。
- **触发条件**：由服务端在七对豪华档判定时处理，客户端无对应实现（待确认）。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：白板不计豪华。
- **异常与边界**：无。
- **验收**：客户端无对应实现，本条仅能通过服务端番型判定结果间接确认。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认
- **协作边界**：客户端无七对豪华计数逻辑，白板是否计豪华完全由服务端判定。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C14-010` 清七对 4/8/16/32

- **规则说明**：清七对 / 豪华清七对 / 双豪华清七对 / 三豪华清七对，倍数 4 / 8 / 16 / 32；同样是 7 对，但手里没有财神。
- **触发条件**：服务端下发 fan_ids 含 2414-2417 之一的 MsgResultHu 时。
- **配置影响**：FanDefine 定义 2414-2417 与“清七对（无财神）4x”等档位注释；GameSoundConfig 单独配置清七对族语音。
- **客户端交互**：清七对单番播 qqd 动效，豪华档播 hhqqd/2hhqqd/3hhqqd。
- **限制与禁止**：无。
- **异常与边界**：“手里没有财神”由服务端判定；客户端仅凭 2414-2417 展示。
- **验收**：fan_ids 含 2414-2417 时输出对应档位动效（qqd/hhqqd/2hhqqd/3hhqqd）、清七对名称与独立语音。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:41；source-code/client/Code/config/FanDefine.ts:47；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1150；source-code/client/Code/config/GameSoundConfig.ts:439
- **服务端职责**：下发 MsgResultHu，判定 7 对且无财神后下发 2414-2417 对应档位。
- **客户端职责**：FanDefine 定义 2414-2417 与“清七对（无财神）4x”注释及豪华清七对档位；TipAni 映射 qqd/hhqqd/2hhqqd/3hhqqd；语音单独配置清七对族。
- **协作边界**：客户端消费档位 ID 做动效/名称/语音表现；“无财神”判定在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:41
- **原文摘录**：`/** 清七对（无财神），4x */`

## `FP-ST-C14-003` 杠开组：杠上开花与连杠

- **主描述**：杠开组要求自摸，按杠链长度分为杠上开花 2 倍、二连杠 4 倍、三连杠 8 倍、四连杠 16 倍。
- **范围与边界**：覆盖杠链 1~4 的档位映射；不含杠飘/飘杠组合（另见 FP-ST-C14-005）。
- **总体协作**：服务端维护杠链长度并给出 2406-2409；客户端维护档位 skin、语音与“能否杠上开花”的本地预判。

### 原子项

#### `AT-ST-C14-011` 杠上开花 2 倍

- **规则说明**：杠上开花倍数 2，要求自摸，杠链为 1（杠牌后自摸）。
- **触发条件**：服务端下发 fan_ids 含 2406 的 MsgResultHu 时；杠牌后客户端本地预判走 GameData.checkCanGangBao。
- **配置影响**：FanDefine 定义 2406（注释“杠上开花：杠牌后自摸，2x”）；GetHzmjGangLevel 将 2406 映射为杠开 1 档。
- **客户端交互**：杠上开花播 gk 动效与“杠开”语音；小结算匹配场文案把 2406 显示为“杠开”。
- **限制与禁止**：无。
- **异常与边界**：杠链计数在服务端；客户端 checkCanGangBao 只是杠牌提示用（“手牌模 3 余 2 + 有听 + 只有一组杠牌”），不构成番型判定。
- **验收**：fan_ids 含 2406 时播放 gk 动效与杠开语音；匹配场小结算文案显示“杠开”；checkCanGangBao 仅作杠牌提示，不参与判定。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:25；source-code/client/Code/config/FanDefine.ts:295；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1133；source-code/client/Code/data/GameData.ts:418
- **服务端职责**：下发 MsgResultHu，杠链为 1 时下发 2406。
- **客户端职责**：FanDefine 定义 2406 注释“杠上开花：杠牌后自摸，2x”；GetHzmjGangLevel 将 2406 映射为杠开 1 档；GameData.checkCanGangBao 在本地预判“手牌模 3 余 2 + 有听 + 只有一组杠牌”。
- **协作边界**：客户端消费 2406 做动效/语音/文案表现，checkCanGangBao 仅做本地杠牌提示；杠链计数在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:25
- **原文摘录**：`/** 杠上开花：杠牌后自摸，2x */`

#### `AT-ST-C14-012` 二连杠 4 倍

- **规则说明**：二连杠倍数 4，杠链为 2（连续杠二次后自摸）。
- **触发条件**：服务端下发 fan_ids 含 2407 的 MsgResultHu 时。
- **配置影响**：FanDefine 定义 2407（注释“连续杠二次后自摸，4x”）；GetHzmjGangLevel 映射为 2 档。
- **客户端交互**：播 2lgk 动效，语音取 hu_8_2gangkai。
- **限制与禁止**：无。
- **异常与边界**：客户端的“档位”只用于表现与语音选择，不参与倍数计算。
- **验收**：fan_ids 含 2407 时播放 2lgk 动效与 hu_8_2gangkai 语音。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:27；source-code/client/Code/config/FanDefine.ts:296；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1135
- **服务端职责**：下发 MsgResultHu，杠链为 2 时下发 2407。
- **客户端职责**：FanDefine 定义 2407 注释“连续杠二次后自摸，4x”；GetHzmjGangLevel 映射为 2 档。
- **协作边界**：客户端消费 2407 做动效/语音表现；杠链计数在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:27
- **原文摘录**：`/** 二连杠：连续杠二次后自摸，4x */`

#### `AT-ST-C14-013` 三连杠 8 倍

- **规则说明**：三连杠倍数 8，杠链为 3（连续杠三次后自摸）。
- **触发条件**：服务端下发 fan_ids 含 2408 的 MsgResultHu 时。
- **配置影响**：FanDefine 定义 2408（注释“连续杠三次后自摸，8x”）；GetHzmjGangLevel 映射为 3 档。
- **客户端交互**：播 3lgk 动效，语音取 hu_9_3gangkai。
- **限制与禁止**：无。
- **异常与边界**：无。
- **验收**：fan_ids 含 2408 时播放 3lgk 动效与 hu_9_3gangkai 语音。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:29；source-code/client/Code/config/FanDefine.ts:297；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1137
- **服务端职责**：下发 MsgResultHu，杠链为 3 时下发 2408。
- **客户端职责**：FanDefine 定义 2408 注释“连续杠三次后自摸，8x”；GetHzmjGangLevel 映射为 3 档。
- **协作边界**：客户端消费 2408 做动效/语音表现；杠链计数在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:29
- **原文摘录**：`/** 三连杠：连续杠三次后自摸，8x */`

#### `AT-ST-C14-014` 四连杠 16 倍（4 及以上）

- **规则说明**：四连杠倍数 16，杠链为 4 及以上。
- **触发条件**：服务端下发 fan_ids 含 2409 的 MsgResultHu 时。
- **配置影响**：FanDefine 定义 2409（注释“连续杠四次后自摸，16x”）；GetHzmjGangLevel 映射为 4 档，没有更高档位。
- **客户端交互**：播 4lgk 动效，语音取 hu_10_4gangkai。
- **限制与禁止**：无。
- **异常与边界**：模板写“4 及以上”，客户端只有 2409 单档映射，杠链超过 4 的情况没有独立表现，依赖服务端仍下发 2409。
- **验收**：fan_ids 含 2409 时播放 4lgk 动效与 hu_10_4gangkai 语音；杠链超过 4 的场景复用同一表现。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:31；source-code/client/Code/config/FanDefine.ts:298；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1139
- **服务端职责**：下发 MsgResultHu，杠链为 4 及以上时统一下发 2409。
- **客户端职责**：FanDefine 定义 2409 注释“连续杠四次后自摸，16x”；GetHzmjGangLevel 映射为 4 档，没有再高的档位。
- **协作边界**：客户端消费 2409 做表现；杠链计数与“4 及以上”归档在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:31
- **原文摘录**：`/** 四连杠：连续杠四次后自摸，16x */`

## `FP-ST-C14-004` 财神组：爆头与财飘

- **主描述**：财神组要求自摸，且单放与财神成将；按飘档分为爆头 2 倍与财飘/双财飘/三财飘 4/8/16 倍。
- **范围与边界**：覆盖爆头、财飘档位与“听任意牌”的爆头表现；不含杠飘/飘杠组合。
- **总体协作**：服务端维护飘档与财神对子结构，下发 2402-2405；客户端负责听牌爆头提示、结算胡组定位与动效语音。

### 原子项

#### `AT-ST-C14-015` 爆头 2 倍

- **规则说明**：爆头倍数 2，要求自摸、飘档为 0、单放与财神成将。
- **触发条件**：服务端下发 fan_ids 含 2402 的 MsgResultHu 时；自己进入任意牌听（爆头听）时切换听牌界面表现。
- **配置影响**：FanDefine 定义 2402（注释“爆头：自摸+财神对+无飘，2x”）；TingCard 的 C_BaoTou 控制器切爆头页并显示“爆头2番”。
- **客户端交互**：听牌卡切 C_BaoTou 页，显示“爆头2番”“摸任意一张可胡”、倍数位隐藏；胡牌播 bt 动效与爆头语音。
- **限制与禁止**：爆头听牌卡倍数位隐藏。
- **异常与边界**：“飘档为 0 / 单放与财神成将”由服务端判定；客户端只用 2402 做展示与胡组定位（结算时 _moveHuCombToLast 优先把“2 张对子且含单放”的组挪到最后）。
- **验收**：任意牌听时听牌界面切 C_BaoTou 页并显示“爆头2番”“摸任意一张可胡”；fan_ids 含 2402 时播 bt 动效，小结算把“2 张对子且含单放”的胡组排至末位。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:17；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:455；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:464；source-code/client/Fgui/assets/box_hzmj_tingPai/component/TingCard.xml:24；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1124
- **服务端职责**：下发 MsgResultHu（含 2402）与 MsgWaitInfos（任意牌听），飘档与财神对子结构由服务端维护。
- **客户端职责**：FanDefine 定义 2402 注释“爆头：自摸+财神对+无飘，2x”；ListenData/GameData.isSelfBaoTouTing 判定自己是否任意牌听；结算时 _moveHuCombToLast 依据 fan_ids 含 2402 优先把“2 张对子且含单放”的组挪到最后。
- **协作边界**：客户端消费 2402 与 MsgWaitInfos 的任意牌听做提示与结算胡组排序；飘档/单放与财神成将判定在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:17
- **原文摘录**：`/** 爆头：自摸+财神对+无飘，2x */`

#### `AT-ST-C14-016` 爆头听任意牌时改看进张前是否敲响

- **规则说明**：听任意牌（爆头听）时，改看进张前是否敲响（报听）作为判定依据。
- **触发条件**：服务端下发含任意牌哨兵（255）的 MsgWaitInfos 时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：听牌界面整块切到爆头页，KW_HuNum 显示“胡”；手牌上财神牌标飘、其他万能听牌标爆；报听按钮已移除。
- **限制与禁止**：无。
- **异常与边界**：模板的“敲响（报听）”在客户端已被移除，onBtnBaoTing 为空实现；客户端只能给出任意牌听提示，无法表达“进张前是否敲响”这一状态。
- **验收**：任意牌听时听牌界面切 C_BaoTou 页并渲染 KW_BaoTou、KW_HuNum 显示“胡”、手牌万能听牌标注爆/飘标签；“进张前是否敲响”状态在客户端无法验收（入口已移除）。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTingPaiView.ts:49；source-code/client/Code/layer/BoxHzmjTingPaiView.ts:57；source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:193；source-code/client/Code/layer/BoxHzmjMainView.ts:1195
- **服务端职责**：下发 MsgWaitInfos，以哨兵 255 表示任意牌听。
- **客户端职责**：客户端把服务端任意牌哨兵（255）归一为 MAH_VALUE_ALL，识别为爆头听：听牌界面切 C_BaoTou 页并渲染 KW_BaoTou，手牌上把“打出后万能听”的牌标成爆/飘标签。
- **协作边界**：客户端消费 MsgWaitInfos 的任意牌哨兵做本地提示；“进张前是否敲响”缺少对应的敲响状态（报听入口已移除），客户端无法表达。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjTingPaiView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjTingPaiView.ts:49
- **原文摘录**：`this.view.KW_Main.C_BaoTou.selectedIndex = this._isBaoTou ? 1 : 0;`

#### `AT-ST-C14-017` 财飘 / 双财飘 / 三财飘

- **规则说明**：财飘 / 双财飘 / 三财飘，倍数 4 / 8 / 16；要求自摸，飘档正好为 1 / 2 / 3 及以上，且单放与财神成将。
- **触发条件**：服务端下发 fan_ids 含 2403-2405 之一的 MsgResultHu 时。
- **配置影响**：FanDefine 定义 2403-2405 与飘档注释；GetHzmjCaiPiaoLevel 返回 1/2/3 档；GameData/TingType 用 TYPE_PIAO 标识。
- **客户端交互**：分别播 cp / 2cp / 3cp 动效与 hu_4_caipiao / hu_5_2caipiao / hu_6_3caipiao 语音；手牌财神牌打标显示“飘”。
- **限制与禁止**：无。
- **异常与边界**：飘档累计与清零在服务端；客户端无飘次数计数，仅用 2403-2405 展示。
- **验收**：fan_ids 含 2403/2404/2405 时分别播放 cp/2cp/3cp 动效与对应语音；手牌财神牌显示“飘”标签。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:19；source-code/client/Code/config/FanDefine.ts:21；source-code/client/Code/config/FanDefine.ts:309；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1126
- **服务端职责**：下发 MsgResultHu，维护飘档累计并在飘档为 1/2/3 及以上时下发 2403/2404/2405。
- **客户端职责**：FanDefine 定义 2403-2405 与飘档注释；GetHzmjCaiPiaoLevel 返回 1/2/3 档；GameData/TingType 用 TYPE_PIAO 标识“打出财神且听任意牌”。
- **协作边界**：客户端消费档位 ID 做动效/语音/标签表现，飘档计数在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:19
- **原文摘录**：`/** 财飘：自摸+财神对+piao_level=1，4x */`

#### `AT-ST-C14-018` 3 档及以上都算三财飘

- **规则说明**：飘档达到 3 档及以上时，都记为三财飘。
- **触发条件**：服务端下发 fan_ids 含 2405 的 MsgResultHu 时。
- **配置影响**：FanDefine 注释 2405 对应 piao_level>=3、16x；GetHzmjCaiPiaoLevel 对 2405 固定返回 3，不再分更高档。
- **客户端交互**：统一播 3cp 动效与三财飘语音，不存在第 4 档表现。
- **限制与禁止**：无。
- **异常与边界**：无。
- **验收**：飘档为 3、4 及以上时均播放 3cp 动效与三财飘语音（单档表现，无更高档动效）。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:23；source-code/client/Code/config/FanDefine.ts:311
- **服务端职责**：下发 MsgResultHu，飘档 3 及以上时统一下发 2405。
- **客户端职责**：FanDefine 注释写明 2405 对应 piao_level>=3、16x，GetHzmjCaiPiaoLevel 对 2405 固定返回 3，不再分更高档。
- **协作边界**：客户端消费 2405 单档表现；“3 及以上归档”在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:23
- **原文摘录**：`/** 三财飘：piao_level>=3，16x */`

## `FP-ST-C14-005` 杠飘 / 飘杠组合

- **主描述**：同时命中杠上开花与财飘时，取消这两个番型，改记杠飘或飘杠，倍数固定 8，再与基础番相乘。
- **范围与边界**：覆盖组合识别、组合命名与 8 倍档；不含 8×基础番的具体乘积计算。
- **总体协作**：服务端把组合结果下发为 2419/2420 或同时下发杠开+财飘拆分；客户端按组合优先级归并为单一组合动效与文案。

### 原子项

#### `AT-ST-C14-019` 杠开与财飘同时命中改记杠飘/飘杠

- **规则说明**：同时命中杠上开花和财飘时，去掉这两条番型，改记杠飘或飘杠。
- **触发条件**：服务端下发 fan_ids 命中 2419/2420，或同时下发杠开系与财飘系拆分 ID 时。
- **配置影响**：FanDefine 定义组合 ID 2419 杠飘、2420 飘杠；ResolveHzmjHuFanComboAni 归并组合结果。
- **客户端交互**：组合动效只播 gp（杠飘）或 pg（飘杠），不再分别播杠开与财飘；语音走组合音 hu_20_gangpiao / hu_21_piaogang。
- **限制与禁止**：命中组合后不再分别播放杠开与财飘动效。
- **异常与边界**：拆分命中时客户端无法可靠区分先后，默认按“杠飘”命名（注释：fan_ids 顺序不可靠）。
- **验收**：fan_ids 命中 2419/2420 或同时含杠开系与财飘系时，只播 gp/pg 单一组合动效，流水文案输出“杠飘/飘杠”，不并播杠开与财飘两条动效。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:236；source-code/client/Code/config/FanDefine.ts:257；source-code/client/Code/config/FanDefine.ts:360；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1101；source-code/client/Code/config/GameSoundConfig.ts:512
- **服务端职责**：下发 MsgResultHu，把组合结果下发为 2419/2420，或同时下发杠开+财飘拆分 ID。
- **客户端职责**：FanDefine 定义组合 ID 2419 杠飘、2420 飘杠，并区分 2419/2420；ResolveHzmjHuFanComboAni 在“命中 2419/2420”或“杠开系 × 财飘系”拆分命中时返回 GANG_PIAO，FormatHzmjWinnerFanFlowText 据此输出“杠飘/飘杠”。
- **协作边界**：客户端消费 fan_ids 归并为单一组合动效与文案；“去掉这两条改记”的组合判定在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:236
- **原文摘录**：`if (id === HzmjFanType.K_FTG_HZMJ_GANG_PIAO || id === HzmjFanType.K_FTG_HZMJ_PIAO_GANG) {`

#### `AT-ST-C14-020` 组合倍数 8

- **规则说明**：改记杠飘或飘杠后，倍数固定为 8。
- **触发条件**：服务端下发 2419/2420 组合番型的 MsgResultHu 时。
- **配置影响**：FanDefine 枚举注释标注 2419/2420 为 8x；XsmjFanConfig 单项倍率表把两值设为 8（仅用于动画候选比较）。
- **客户端交互**：界面上不单独显示“8 倍”，只显示组合番型名与（匹配场的）总计倍数。
- **限制与禁止**：好友房展示不含番型倍数文案。
- **异常与边界**：8 倍仅是静态注释/倍率表值，实际总倍率仍取服务端 fan_point。
- **验收**：命中组合时界面输出“杠飘/飘杠”番型名，不出现“8 倍”独立文案；匹配场总计倍数与服务端 fan_point 一致。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:51；source-code/client/Code/config/FanDefine.ts:53；source-code/client/Code/config/XsmjFanConfig.ts:24
- **服务端职责**：下发 MsgResultHu，组合档按 8 倍参与连乘得出 fan_point。
- **客户端职责**：FanDefine 在枚举注释中标注 2419/2420 为 8x，XsmjFanConfig 的单项倍率表同样把两值设为 8；该表注释声明仅用于动画候选比较，实际总倍率仍取服务端 fan_point。
- **协作边界**：客户端消费组合番型名做表现；8 倍参与连乘的计算在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:51
- **原文摘录**：`/** 杠飘：先杠后飘（杠开后打出财神并下一轮自摸），8x */`

#### `AT-ST-C14-021` 组合档再乘基础番（8 倍/16 倍示例）

- **规则说明**：组合档（8 倍）再与基础番相乘，例如平胡加这一档是 8 倍，七对加这一档是 16 倍。
- **触发条件**：由服务端在番型连乘计算时处理，客户端无对应实现（待确认）。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：无。
- **异常与边界**：无。
- **验收**：客户端无对应实现，乘积总数只能通过服务端 fan_point（胡按钮与匹配场总计）间接确认。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认
- **协作边界**：客户端不计算番型乘积，也不生成“8 倍/16 倍”文案：小结算只展示番型名（BoxHzmjResultMid 明确“不拼分与倍数”），好友房不追加倍数字段，总数由服务端 fan_point 决定。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

## `FP-ST-C14-006` 十风

- **主描述**：从第一张出牌起连续打出字牌，满 10 张后任意自摸都能胡且只记十风，倍数 2×2^(n-10)。
- **范围与边界**：覆盖十风资格维持、授胡、独占性与倍数递增；不含十风的具体计数实现（服务端）。
- **总体协作**：服务端维护 ten_wind_count / ten_wind_live 并下发 2418；客户端负责十风动效、名称与结算亮牌（手牌取自出牌区）。

### 原子项

#### `AT-ST-C14-022` 从第一张出牌起连续打字牌

- **规则说明**：十风要求从第一张出牌起连续打出字牌。
- **触发条件**：服务端下发 fan_ids 含 2418 的 MsgResultHu 时。
- **配置影响**：FanDefine 定义 2418（注释“十风（独占番型）：连续打出≥10张字牌后自摸，2x（11张=4x，12张=8x…）”）。
- **客户端交互**：十风走 Paixing_wz04 的 sf 动效；番型名表输出“十风”。
- **限制与禁止**：无。
- **异常与边界**：客户端不跟踪出牌是否字牌，无十风进度提示；十风语音未配置，GameSoundConfig 会兜底成普通胡音。
- **验收**：fan_ids 含 2418 时播放 sf 动效、输出“十风”名称，语音兜底为普通胡音。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:49；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1160
- **服务端职责**：下发 MsgResultHu，维护连续字牌计数，满足条件时下发 2418。
- **客户端职责**：FanDefine 定义 2418“十风（独占番型）：连续打出≥10张字牌后自摸，2x（11张=4x，12张=8x…）”；客户端无连续字牌计数与资格状态。
- **协作边界**：客户端消费 2418 做动效/名称表现；连续字牌计数在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:49
- **原文摘录**：`/** 十风（独占番型）：连续打出≥10张字牌后自摸，2x（11张=4x，12张=8x…） */`

#### `AT-ST-C14-023` 中断后本局作废不可重累

- **规则说明**：十风累计中途打出非字牌，或发生吃、碰、杠时，本局作废，不能再重新累计。
- **触发条件**：由服务端在十风资格维护时处理，客户端无对应实现（待确认）。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：作废后不能再重新累计。
- **异常与边界**：无。
- **验收**：客户端无对应实现，作废规则只能通过服务端不再下发 2418 间接确认。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认
- **协作边界**：客户端无十风资格/失效状态与相关提示，全部依赖服务端不下发 2418。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C14-024` 满 10 张后任意自摸可胡，不要求成牌

- **规则说明**：连续打出满 10 张字牌后，任意自摸都能胡，不要求手牌成牌型。
- **触发条件**：服务端下发 fan_ids 含 2418 的 MsgResultHu 时（hu_items.hands 为出牌区牌序列）。
- **配置影响**：FanDefine 的 IsHzmjTenWindFan 判定函数及注释约束“十风亮牌走牌河，hu_items.hands/combs 不能当剩余手牌用”。
- **客户端交互**：结算按服务端 hu_items.hands 原序展示十风手牌（取自出牌区），不自行排序。
- **限制与禁止**：十风时 hu_items.hands/combs 不能当剩余手牌用。
- **异常与边界**：IsHzmjTenWindFan 在本工程内只有定义与导出，未见调用点，十风“手牌走牌河”的约束暂无实际消费代码；授胡资格由服务端判定。
- **验收**：十风胡结算手牌按服务端 hu_items.hands 原序展示（来源为出牌区），客户端不按常规手牌排序逻辑处理。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:175；source-code/client/Code/config/FanDefine.ts:180
- **服务端职责**：下发 MsgResultHu，满 10 张字牌后授予任意自摸胡资格并下发 2418，hands 为出牌区牌序列。
- **客户端职责**：FanDefine 的 IsHzmjTenWindFan 注释指出“十风亮牌走牌河，hu_items.hands/combs 不能当剩余手牌用”，说明客户端已知十风结算手牌来自出牌区；授胡资格由服务端判定。
- **协作边界**：客户端消费 hu_items.hands 原序做结算展示；满 10 张授胡资格判定在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:175
- **原文摘录**：`/**\n * 是否十风（2418）\n * 十风亮牌走牌河，hu_items.hands/combs 不能当剩余手牌用`

#### `AT-ST-C14-025` 十风独占，不与其它番型相乘

- **规则说明**：十风为独占番型，只记十风，不与平胡、杠开、财飘、七对等其他番型相乘。
- **触发条件**：服务端下发 fan_ids 含 2418 的 MsgResultHu 时。
- **配置影响**：XsmjFanConfig 把 2418 列入 XSMJ_EXCLUSIVE_FANS 独占番列表，注释“独占番直接按服务端单条结果展示，不在客户端重新判胡”。
- **客户端交互**：十风时只播 sf 单番动效，不并播其它番型动画。
- **限制与禁止**：十风不与平胡、杠开、财飘、七对相乘；客户端不并播其它番型动效。
- **异常与边界**：独占列表常量名为 XSMJ_EXCLUSIVE_FANS（萧山语义），杭州侧是否复用同一语义未见显式分支。
- **验收**：fan_ids 含 2418 时只播 sf 单番动效，按服务端单条结果展示，不并播其它番型动画。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/XsmjFanConfig.ts:36；source-code/client/Code/config/XsmjFanConfig.ts:38；source-code/client/Code/config/FanDefine.ts:272
- **服务端职责**：下发 MsgResultHu，十风时只下发 2418 单条结果（不带其他番型）。
- **客户端职责**：XsmjFanConfig 把 2418 列入 XSMJ_EXCLUSIVE_FANS，注释“独占番直接按服务端单条结果展示，不在客户端重新判胡”；主番型选择一次只取一个 ID。
- **协作边界**：客户端按独占番规则单条展示；独占判定（不与其他番型相乘）在服务端。
- **来源文件**：`source-code/client/Code/config/XsmjFanConfig.ts`
- **来源定位**：source-code/client/Code/config/XsmjFanConfig.ts:36
- **原文摘录**：`/** 独占番直接按服务端单条结果展示，不在客户端重新判胡。 */`

#### `AT-ST-C14-026` 10 张 2 倍，每多一张再乘 2

- **规则说明**：十风满 10 张时倍数为 2，每多一张字牌倍数再乘 2（11 张 4 倍、12 张 8 倍，依此类推）。
- **触发条件**：服务端下发 fan_ids 含 2418 的 MsgResultHu 时。
- **配置影响**：FanDefine 注释记录“2x（11张=4x，12张=8x…）”。
- **客户端交互**：无独立倍率文案，倍数只体现在服务端 fan_point 与胡按钮显示。
- **限制与禁止**：无。
- **异常与边界**：指数递增完全在服务端；客户端注释与实际规则一致。
- **验收**：十风胡时胡按钮/匹配场显示的总倍数与服务端 fan_point 一致；客户端无独立的指数倍率文案。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:49
- **服务端职责**：下发 MsgResultHu，按字牌张数计算 2×2^(n-10) 并体现在 fan_point。
- **客户端职责**：FanDefine 注释与规则一致：“2x（11张=4x，12张=8x…）”，客户端无该指数计算。
- **协作边界**：客户端消费 fan_point 展示总倍数；指数递增计算在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:49
- **原文摘录**：`/** 十风（独占番型）：连续打出≥10张字牌后自摸，2x（11张=4x，12张=8x…） */`

## `FP-ST-C14-007` 财神牌面表现

- **主描述**：财神牌在手牌、牌河、副露与结算中统一染红、可点击、无角标，打出后牌河保留原牌面仅加红色。
- **范围与边界**：覆盖财神牌的视觉与交互表现；不含财神替代牌型判定。
- **总体协作**：GameData 维护财神牌值，BoxHzmjMahColorUtil 统一染色，各视图在刷新时调用染色工具。

### 原子项

#### `AT-ST-C14-027` 财神牌面染红

- **规则说明**：财神牌面统一染红。
- **触发条件**：服务端下发 MsgJoker 确定财神牌值后，手牌、听牌列表、牌河、副露与小结算刷新时统一应用染色。
- **配置影响**：GameData.getJokerColorValues() 维护财神牌值集合；财神色为 #ffc4c4（GameData 注释）。
- **客户端交互**：财神牌面染红；财神牌在手牌/听牌列表/牌河/副露/小结算左下财神位上显示红色牌面；同牌高亮（绿/蓝）优先不覆盖。
- **限制与禁止**：染红不覆盖同牌高亮（绿/蓝优先）。
- **异常与边界**：无。
- **验收**：财神牌值命中的牌在手牌、听牌列表、牌河、副露与小结算财神位上均显示红色（#ffc4c4），且同牌高亮存在时保留高亮色。
- **职责域**：client
- **职责依据**：source-code/client/Code/util/BoxHzmjMahColorUtil.ts:29；source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:68；source-code/client/Code/layer/comp/BoxHzmjResultLeft.ts:39
- **服务端职责**：下发 MsgJoker，公告财神牌值。
- **客户端职责**：applyJokerMahColor 按 GameData.getJokerColorValues() 命中的牌值调用 setMahColor(node, MahColor_Box.red, true)；手牌、听牌列表与小结算财神牌均调用该逻辑。
- **协作边界**：客户端消费 MsgJoker 的牌值在本地统一染色；染色工具由 BoxHzmjMahColorUtil 提供。
- **来源文件**：`source-code/client/Code/util/BoxHzmjMahColorUtil.ts`
- **来源定位**：source-code/client/Code/util/BoxHzmjMahColorUtil.ts:29
- **原文摘录**：`Mah2DBase_Box.setMahColor(node, MahColor_Box.red, true);`

#### `AT-ST-C14-028` 财神牌可点击

- **规则说明**：财神牌保持可点击。
- **触发条件**：财神牌值确定后，财神牌与其他手牌一样参与点选/出牌交互时。
- **配置影响**：本原子项无独立配置（代码注释约定“财神色 #ffc4c4（灰优先于红，可点击、无角标）”）。
- **客户端交互**：财神牌可点击；财神牌与普通手牌一样可点选/出牌；财神牌出牌另有专属财神音效。
- **限制与禁止**：无。
- **异常与边界**：“可点击”是普通手牌默认行为，非财神特有实现；禁打场景下财神仍会被灰化不可点（applyPlayLmtsGray）。
- **验收**：财神牌在手牌中可正常点选与出牌并播专属财神音效；禁打限制生效时财神牌与其他牌一样置灰不可点。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/GameData.ts:52；source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:69
- **服务端职责**：下发 MsgJoker（财神牌值）与 MsgPlayLmts（出牌限制），维护禁打约束。
- **客户端职责**：代码注释多处声明财神色“可点击”，手牌 touchable 仅在禁打时被置灰/不可点（applyPlayLmtsGray），未见财神专属点击分支。
- **协作边界**：客户端消费 MsgPlayLmts 维护禁打不可点；财神可点击沿用普通手牌默认行为，无财神专属分支。
- **来源文件**：`source-code/client/Code/data/GameData.ts`
- **来源定位**：source-code/client/Code/data/GameData.ts:52
- **原文摘录**：`/** 财神色 #ffc4c4（灰优先于红，可点击、无角标） */`

#### `AT-ST-C14-029` 财神牌没有角标

- **规则说明**：财神牌不显示任何角标。
- **触发条件**：刷新财神色（updateJokerColor）时，同步清空角标与赖子标记。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：财神牌没有角标；财神牌只显示红色牌面，不叠加任何角标图标。
- **限制与禁止**：明确不走角标（代码注释约束）。
- **异常与边界**：无。
- **验收**：财神牌在任何视图上手牌只显示红色牌面，无角标与赖子标记（setLaiziValues({}) / setCornerValues({}) 均被清空）。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:70；source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:73
- **服务端职责**：下发 MsgJoker，公告财神牌值。
- **客户端职责**：updateJokerColor 在刷财神色后显式清空角标与赖子标记：setLaiziValues({})、setCornerValues({})，并清空黄色蒙版缓存。
- **协作边界**：客户端消费 MsgJoker 本地渲染；角标清空为客户端本地行为。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:70
- **原文摘录**：`this.setLaiziValues({});`

#### `AT-ST-C14-030` 打出后牌河保留原牌面只留红色

- **规则说明**：财神牌打出后，牌河中仍是原牌面，只保留红色染色层。
- **触发条件**：财神牌打出进入牌河，或胡牌列表/副露刷新后统一调用 _applyJokerColorToTable 时。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：打出后牌河仍是原牌面，只保留这层红色；牌河中的财神牌仍是原牌值牌面，仅叠加红色；同牌高亮存在时保留高亮色。
- **限制与禁止**：染色工具只改色，不替换牌面资源。
- **异常与边界**：牌河刷色依赖各出牌/胡牌/副露刷新事件后统一调用 _applyJokerColorToTable，属被动刷新而非独立重绘。
- **验收**：财神牌打出后牌河显示原牌面加红色染色，无牌面替换；胡牌列表与副露中的财神牌同样处理。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:1130；source-code/client/Code/layer/BoxHzmjMah2DView.ts:1132；source-code/client/Code/util/BoxHzmjMahColorUtil.ts:36
- **服务端职责**：下发 MsgJoker，公告财神牌值。
- **客户端职责**：BoxHzmjMah2DView._applyJokerColorToTable 对所有座位的出牌区、胡牌列表与副露调用 applyJokerColorToMahList / applyJokerColorToCombo；工具只调用 setMahColor 改色，不替换牌面资源。
- **协作边界**：客户端消费 MsgJoker 牌值在本地对牌河/副露/胡牌列表被动刷新染色。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMah2DView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:1130
- **原文摘录**：`applyJokerColorToMahList(this.outs[i]);`
