# 杠开、杠飘、飘杠

> 阶段 ID：`ST-C09`。来源：模板「行牌 > 杠开、杠飘、飘杠」章节。客户端视角规格，客户端逻辑与 UI 交互以 Code/Fgui 代码证据支撑。

## 0. 阶段

- **阶段 ID**：`ST-C09`
- **阶段**：杠开、杠飘、飘杠
- **来源章节**：行牌 > 杠开、杠飘、飘杠
- **涉及协议消息**：MsgResultHu、MsgPiao
- **涉及 UI 模块**：BoxHzmjTipAniView、BoxHzmjResultMid、BoxHzmjTestView
- **阶段概述**：定义杠后自摸按杠链 1/2/3/4 及以上计算 2/4/8/16 倍的四档杠开，杠上开花与财飘同时命中时拆出固定 8 倍再乘基础番的杠飘/飘杠，并划清高档不拆与不单列杠爆、七客的边界。

## 术语与单位

| 术语 | 定义 | 单位/量纲 | 作用域 | 来源 |
| --- | --- | --- | --- | --- |
| 财神 | 白板固定为财神。只在胡牌判定时代替顺子、刻子或对子所缺的牌；吃、碰、杠必须用真实的非财神牌，不能用财神牌。 | 张（牌） | 胡牌判定 | 模板名词章节 第12行 |
| 飘 | 自己出牌阶段打出一张财神，即飘财 1 次。连续打出财神则累加，打出普通牌清零。每小局从 0 次起算。 | 次 | 每小局 | 模板名词章节 第18行 |
| 杠链 | 连续杠牌的计数，杠一次加 1；杠链 1/2/3/4 及以上分别对应杠上开花/二连杠/三连杠/四连杠，断链后再胡不算杠开。 | 连（次） | 行牌阶段连续计数 | 模板行牌章节 第94~95行 |
| 爆头 | 摸牌前为 4 组面子加 1 张财神。下一张摸到任意牌，都与这张财神组成对子后自摸。只能自摸。 | 组合状态 | 摸牌前手牌判定 | 模板名词章节 第16行 |
| 七客 | 七对爆头。摸牌前没有吃、碰、杠，手牌为 6 组对子加 1 张财神。结算不单列这一项，按七对和爆头两组连乘。 | 组合状态 | 结算 | 模板名词章节 第17行 |

## 跨切面行为

- **客户端不保存杠链与飘杠先后**：Code 中无 gang_chain、piao_before_gang、gangChain 等字段，杠开档位与 2419/2420 归组完全以 MsgResultHu.hu_items[].fan_ids 为准 —— 跨切面（source-code/client/Code/config/FanDefine.ts:362）
- **fan_details 无 UI 消费**：fan_details（fan_id + mult）由 GameResultHuCmd 写入 GameData 后没有 UI 读取；好友房小结算只显示番型文案与得分，不分项展示 2/4/8/16 倍 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts）
- **组合 ID 优先、拆分兜底**：杠飘/飘杠表现以组合 ID 2419/2420 优先；若服务端只下发 2406+2403 拆分项，客户端默认按「杠飘」展示，代码注释明确 fan_ids 顺序不可靠 —— 跨切面（source-code/client/Code/config/FanDefine.ts:256）
- **客户端组合判定比模板宽**：任意杠开档 × 任意财飘档都会命中 GANG_PIAO 表现（gp/pg），高档不拆仅体现在服务端番点计算 —— 跨切面（source-code/client/Code/config/FanDefine.ts:257）
- **杠爆与七客遗留表现**：杠爆（杠开×爆头）与七客（七对系×爆头/财飘）在客户端仍有组合枚举、动效与音效，属模板取消独立番型后的遗留表现 —— 跨切面（source-code/client/Code/config/FanDefine.ts:261）
- **zuhe_ani_node 未被引用**：huAni.xml 定义了 zuhe_ani_node 组合节点，但代码未引用，实际组合动效走 KW_Ani_Hu（Paixing_wz04）的 gp/pg/gb/qk skin —— 跨切面（huAni.xml）

## `FP-ST-C09-001` 杠开档位与倍数

- **主描述**：自摸且杠链为 1/2/3/4 及以上时，分别记杠上开花/二连杠/三连杠/四连杠，倍数 2/4/8/16；四连杠及以上统一 16 倍，杠链已断后再胡不记杠开。
- **范围与边界**：含自摸前提、四档杠开档位倍数与断链边界；不含杠飘/飘杠合并与财飘档位。
- **总体协作**：与摸牌（断链）和吃碰杠（杠链 +1）协作；杠开档位由服务端判定，客户端在 MsgResultHu 中消费 fan_ids/fan_point 做文案、动效与音效。

### 原子项

#### `AT-ST-C09-001` 杠开以自摸为成立前提

- **规则说明**：杠上开花、二连杠、三连杠、四连杠均要求「自摸」成立（自摸且杠链为 1/2/3/4 及以上）。
- **触发条件**：胡牌结算 MsgResultHu 到达时，客户端依据 hu_items[].hu_type 推断是否自摸（点炮/抢杠/点杠花之外视为自摸），据此选择胡牌音效；杠开番型表现由服务端 fan_ids 触发。
- **配置影响**：本原子项无独立配置；自摸推断仅依赖 HuType 枚举（HT_SELF、HT_DISCARD、HT_ROBKONG、HT_DIAN_GANG_HUA）。
- **客户端交互**：自摸时播自摸音效，点炮/抢杠时播点炮音效；不改变番型字效节点。
- **限制与禁止**：客户端不校验杠链、不自算杠开档位；自摸与杠链的组合判定仅在服务端。
- **异常与边界**：hu_type 为点杠花（HT_DIAN_GANG_HUA）或抢杠（HT_ROBKONG）时，即使番型含杠相关项也不按自摸表现。
- **验收**：MsgResultHu 下发自摸类 hu_type 且 fan_ids 含 2406~2409 时播自摸音效；下发点炮/抢杠/点杠花 hu_type 时播点炮音效；杠开番型文案、动效与音效完全由 fan_ids 驱动，不因客户端自摸推断而改变。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/GameDefine.ts:424；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:339；source-code/client/Code/config/FanDefine.ts:25
- **服务端职责**：下发 MsgResultHu（含 hu_items[].hu_type 与 fan_ids），自摸与杠链的组合判定在服务端完成，客户端仅消费。
- **客户端职责**：客户端不自判杠开，仅从 MsgResultHu.hu_items[].hu_type 推断是否自摸（点炮/抢杠/点杠花之外视为自摸），据此选择音效；杠开番型完全以服务端 fan_ids 为准。
- **协作边界**：客户端消费 MsgResultHu 的 hu_type（音效选择）与 fan_ids（番型文案/动效/音效），本地仅做自摸推断用于音效，不做杠链与杠开判定。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjTipAniView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:929
- **原文摘录**：`const isZimo = !(huType === HuType.HT_DISCARD || huType === HuType.HT_ROBKONG || huType === HuType.HT_DIAN_GANG_HUA);`

#### `AT-ST-C09-002` 杠上开花（杠链 1）2 倍

- **规则说明**：杠上开花：自摸且杠链为 1，倍数 2。
- **触发条件**：胡牌结算 MsgResultHu 的 fan_ids 含 2406（K_FTG_HZMJ_GANG_SHANG_HUA）时，触发杠上开花文案、动效与音效。
- **配置影响**：FanDefine 注册 2406=杠上开花并注明 2x，GetHzmjGangLevel 对 2406 返回 1；萧山倍率表 2406=2（仅用于动画候选比较）；音效映射 hu_7_gangkai。
- **客户端交互**：2406 走文字类节点 KW_Ani_Hu_Type（Paixing_wz01）skin=gangkai；好友房结算文案「杠上开花」，匹配场第二行简写「杠开」；音效 hu_7_gangkai。
- **限制与禁止**：客户端不以本地倍率表计算番点，倍率仅用于动画候选比较，实际番点取服务端 fan_point。
- **异常与边界**：匹配场两行文案把 2406 简写为「杠开」，好友房显示全称「杠上开花」。
- **验收**：fan_ids 含 2406 时，胡牌动效 skin=gangkai、音效 hu_7_gangkai、结算文案「杠上开花」（匹配场简写「杠开」），得分取服务端 fan_point。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:295；source-code/client/Code/config/XsmjFanConfig.ts:11；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1075；source-code/client/Code/config/GameSoundConfig.ts:431
- **服务端职责**：下发 MsgResultHu，fan_ids 含 2406 番型与 fan_point（已按 2 倍计入）。
- **客户端职责**：FanDefine 注册 2406=杠上开花并注明 2x；GetHzmjGangLevel 对 2406 返回 1；萧山倍率表 2406=2，仅用于动画候选比较，实际番点取服务端 fan_point。
- **协作边界**：客户端消费 fan_ids 中的 2406 驱动文案/动效/音效映射，倍数与番点由服务端 fan_point 下发。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:26
- **原文摘录**：`K_FTG_HZMJ_GANG_SHANG_HUA = 2406,`

#### `AT-ST-C09-003` 二连杠（杠链 2）4 倍

- **规则说明**：二连杠：自摸且杠链为 2，倍数 4。
- **触发条件**：胡牌结算 MsgResultHu 的 fan_ids 含 2407（K_FTG_HZMJ_DOUBLE_KONG）时，触发二连杠文案、动效与音效。
- **配置影响**：FanDefine 注册 2407=二连杠（4x），GetHzmjGangLevel 对 2407 返回 2；萧山倍率表 2407=4（仅用于动画候选比较）；音效映射 hu_8_2gangkai。
- **客户端交互**：2407 走动效节点 KW_Ani_Hu skin=2lgk；好友房结算文案「二连杠」；音效 hu_8_2gangkai。
- **限制与禁止**：客户端不以本地倍率表计算番点，倍率仅用于动画候选比较，实际番点取服务端 fan_point。
- **异常与边界**：无。
- **验收**：fan_ids 含 2407 时，胡牌动效 skin=2lgk、音效 hu_8_2gangkai、结算文案「二连杠」，得分取服务端 fan_point。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:296；source-code/client/Code/config/XsmjFanConfig.ts:12；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1135；source-code/client/Code/config/GameSoundConfig.ts:432
- **服务端职责**：下发 MsgResultHu，fan_ids 含 2407 番型与 fan_point（已按 4 倍计入）。
- **客户端职责**：FanDefine 注册 2407=二连杠（4x），GetHzmjGangLevel 返回 2；倍率表 2407=4（动画比较用），实际番点取服务端。
- **协作边界**：客户端消费 fan_ids 中的 2407 驱动文案/动效/音效映射，倍数与番点由服务端 fan_point 下发。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:27
- **原文摘录**：`/** 二连杠：连续杠二次后自摸，4x */`

#### `AT-ST-C09-004` 三连杠（杠链 3）8 倍

- **规则说明**：三连杠：自摸且杠链为 3，倍数 8。
- **触发条件**：胡牌结算 MsgResultHu 的 fan_ids 含 2408（K_FTG_HZMJ_TRIPLE_KONG）时，触发三连杠文案、动效与音效。
- **配置影响**：FanDefine 注册 2408=三连杠（8x），GetHzmjGangLevel 对 2408 返回 3；萧山倍率表 2408=8（仅用于动画候选比较）；音效映射 hu_9_3gangkai。
- **客户端交互**：2408 走动效节点 KW_Ani_Hu skin=3lgk；好友房结算文案「三连杠」；音效 hu_9_3gangkai。
- **限制与禁止**：客户端不以本地倍率表计算番点，倍率仅用于动画候选比较，实际番点取服务端 fan_point。
- **异常与边界**：无。
- **验收**：fan_ids 含 2408 时，胡牌动效 skin=3lgk、音效 hu_9_3gangkai、结算文案「三连杠」，得分取服务端 fan_point。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:297；source-code/client/Code/config/XsmjFanConfig.ts:13；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1137；source-code/client/Code/config/GameSoundConfig.ts:433
- **服务端职责**：下发 MsgResultHu，fan_ids 含 2408 番型与 fan_point（已按 8 倍计入）。
- **客户端职责**：FanDefine 注册 2408=三连杠（8x），GetHzmjGangLevel 返回 3；倍率表 2408=8（动画比较用），实际番点取服务端。
- **协作边界**：客户端消费 fan_ids 中的 2408 驱动文案/动效/音效映射，倍数与番点由服务端 fan_point 下发。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:29
- **原文摘录**：`/** 三连杠：连续杠三次后自摸，8x */`

#### `AT-ST-C09-005` 四连杠及以上（杠链 4+）16 倍

- **规则说明**：四连杠：自摸且杠链为 4 及以上，倍数 16；四连杠及以上都记 16 倍。
- **触发条件**：胡牌结算 MsgResultHu 的 fan_ids 含 2409（K_FTG_HZMJ_QUAD_KONG）时，触发四连杠文案、动效与音效；服务端将 4 连及以上杠链统一压缩为 2409 下发。
- **配置影响**：FanDefine 注册 2409=四连杠（16x），GetHzmjGangLevel 对 2409 返回 4；萧山倍率表 2409=16（仅用于动画候选比较）；音效映射 hu_10_4gangkai。
- **客户端交互**：2409 走动效节点 KW_Ani_Hu skin=4lgk；好友房结算文案「四连杠」；音效 hu_10_4gangkai。
- **限制与禁止**：客户端只识别 2409 档位，不存在 5 连及以上独立档位；客户端不以本地倍率表计算番点。
- **异常与边界**：客户端最大档位止于四连杠；更长的杠链由服务端统一压缩为 2409 下发，客户端一律按四连杠 16 倍档展示。
- **验收**：fan_ids 含 2409 时，胡牌动效 skin=4lgk、音效 hu_10_4gangkai、结算文案「四连杠」；服务端下发的 5 连及以上杠链同样以 2409 展示为「四连杠」，得分取服务端 fan_point。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:298；source-code/client/Code/config/XsmjFanConfig.ts:14；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1139；source-code/client/Code/config/GameSoundConfig.ts:434
- **服务端职责**：下发 MsgResultHu，将 4 连及以上杠链统一归为 2409 下发，fan_point 已按 16 倍计入。
- **客户端职责**：客户端只识别 2409=四连杠，GetHzmjGangLevel 返回 4；不存在 5 连及以上档位，更长的杠链由服务端统一压缩为 2409 下发，客户端按 16 倍档展示（倍率表 2409=16，动画比较用）。
- **协作边界**：客户端消费 fan_ids 中的 2409 驱动文案/动效/音效映射；「四连杠及以上」的归一由服务端完成，客户端只收到 2409。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:31
- **原文摘录**：`/** 四连杠：连续杠四次后自摸，16x */`

#### `AT-ST-C09-006` 杠链已断后再胡不算杠开

- **规则说明**：杠链已断后再胡，不是杠开。
- **触发条件**：服务端胡牌判定时杠链已断，则不下发 2406~2409；客户端无杠链数据，无本地触发路径。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：杠链已断后再胡不得记杠开（服务端侧约束）；客户端无杠链数据，无从本地校验断链。
- **异常与边界**：客户端无杠链数据（Code 中检索 gang_chain、gangChain 均无结果），断链判定在服务端；断链后服务端不再下发 2406~2409，客户端无从单独校验。
- **验收**：断链后胡牌的 MsgResultHu 不含 2406~2409 时，客户端不出现任何杠开文案、动效与音效（验收以服务端不下发为前提，客户端无独立实现）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认。
- **协作边界**：客户端无杠链数据，断链后胡不出现杠开表现完全依赖服务端不下发杠开番型，本地无从校验。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

## `FP-ST-C09-002` 杠飘与飘杠拆出

- **主描述**：同一次胡牌同时命中杠上开花（杠链 1）与财飘（飘档 1）时，拆出单一「杠飘」或「飘杠」番型，倍数固定 8，再乘基础番；按杠发生时飘档是否大于 0 区分飘杠/杠飘。
- **范围与边界**：含拆出条件、固定 8 倍、与基础番连乘、飘/杠先后判定；不含二连杠及以上、双财飘及以上等高档不拆规则。
- **总体协作**：依赖杠阶段记录的飘档与飘/杠先后、以及番型合并结果；客户端仅按 2419/2420 组合 ID 或杠×财飘 fan_ids 组合做表现，不参与判定与连乘。

### 原子项

#### `AT-ST-C09-007` 仅在杠上开花与财飘同时命中时拆出

- **规则说明**：杠飘、飘杠只在同时命中杠上开花和财飘时拆出。
- **触发条件**：胡牌结算 MsgResultHu 到达时，ResolveHzmjHuFanComboAni 判定组合：fan_ids 含 2419/2420 组合 ID 直接判 GANG_PIAO；否则杠开系（2406 起）与财飘系（2403 起）同时出现时判 GANG_PIAO，进入组合表现分支。
- **配置影响**：FanDefine 定义 2419=杠飘、2420=飘杠（均注明 8x）；ResolveHzmjHuFanComboAni 组合判定逻辑（组合 ID 直接命中或杠×财飘拆分命中）。
- **客户端交互**：命中组合时胡牌走 KW_Ani_Hu 组合 skin（gp/pg），优先于单番节点；结算文案直接写「杠飘」或「飘杠」。
- **限制与禁止**：杠飘/飘杠组合表现仅在 2419/2420 或杠系×财飘系番型命中时触发，客户端不参与拆出判定与倍数计算。
- **异常与边界**：客户端组合判定比模板宽：任意杠开档 × 任意财飘档都会命中 GANG_PIAO 表现，而模板只在杠上开花（2406）与财飘（2403）基础档拆出；若服务端只下发 2406+2403 拆分项，客户端默认按「杠飘」展示，代码注释明确 fan_ids 顺序不可靠。
- **验收**：fan_ids 含 2419 或 2420 时直接走组合表现；fan_ids 同时含杠开系（2406 起）与财飘系（2403 起）番型时也走组合表现（gp/pg skin），结算文案为「杠飘」或「飘杠」。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:53；source-code/client/Code/config/FanDefine.ts:257；source-code/client/Code/config/FanDefine.ts:258；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1097
- **服务端职责**：下发 MsgResultHu，按模板规则拆出并下发 2419/2420 组合 ID（或杠系+财飘拆分项），归组结果由服务端决定。
- **客户端职责**：ResolveHzmjHuFanComboAni 对 2419/2420 组合 ID 直接判 GANG_PIAO；否则在杠开系（2406 起）与财飘系（2403 起）同时出现时判 GANG_PIAO，用于选择组合表现。
- **协作边界**：客户端消费 MsgResultHu 的 fan_ids（组合 ID 2419/2420 优先，杠系×财飘拆分兜底）做组合表现判定，拆出条件与倍数归组在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:51
- **原文摘录**：`/** 杠飘：先杠后飘（杠开后打出财神并下一轮自摸），8x */`

#### `AT-ST-C09-008` 杠飘/飘杠固定 8 倍

- **规则说明**：杠飘、飘杠的倍数为 8。
- **触发条件**：杠飘/飘杠命中（fan_ids 含 2419/2420，或杠系×财飘组合）时，倍率 8 参与动画候选比较，结算按番型名与得分展示。
- **配置影响**：FanDefine 定义 2419=杠飘、2420=飘杠并注明 8x；萧山倍率表两者均为 8（仅用于动画候选比较）。
- **客户端交互**：结算不单独显示 8 倍，只输出番型名与得分；匹配场才在流水后追加总倍数。
- **限制与禁止**：客户端不重算倍数；8 倍为客户端侧注释/动画比较用值，实际番点仍取服务端 fan_point。
- **异常与边界**：好友房小结算只显示番型文案与得分，不分项展示倍数。
- **验收**：杠飘/飘杠命中时结算展示番型名「杠飘」/「飘杠」与得分，不单独显示 8 倍；动画候选比较使用倍率 8，实际得分与服务端 fan_point 一致。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:54；source-code/client/Code/config/XsmjFanConfig.ts:24；source-code/client/Code/config/XsmjFanConfig.ts:25
- **服务端职责**：下发 MsgResultHu，fan_point 已按杠飘/飘杠 8 倍计入。
- **客户端职责**：FanDefine 定义 2419=杠飘、2420=飘杠并注明 8x；萧山倍率表两者均为 8，用于动画候选比较，实际番点仍取服务端 fan_point。
- **协作边界**：客户端消费 fan_ids/fan_point，本地倍率 8 仅用于动画候选比较，不参与得分计算。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:52
- **原文摘录**：`K_FTG_HZMJ_GANG_PIAO = 2419,`

#### `AT-ST-C09-009` 8 倍再乘基础番

- **规则说明**：杠飘、飘杠的 8 倍需再乘上基础番（最终倍数 = 基础番 × 8）。
- **触发条件**：杠飘/飘杠命中时，最终得分与展示倍数完全取服务端下发的 fan_point（匹配场另取 win_lost.mult）。
- **配置影响**：FanDefine 注明分 3 组互斥（基础/七对组、杠开组、财神组），最终倍数 = 三组最高档连乘；XsmjFanConfig 注明实际总倍率始终取服务端 fan_point；结算文案函数保留参数 _fanPoint 不参与展示。
- **客户端交互**：好友房小结算只展示番型文案与输赢分，不展示连乘过程与分项倍数。
- **限制与禁止**：客户端不做连乘计算，结算文案函数不使用 fan_point 计算倍数展示。
- **异常与边界**：连乘在服务端完成，客户端仅消费 fan_point；匹配场才用 win_lost.mult 追加「N倍」。
- **验收**：杠飘/飘杠结算得分与展示倍数完全等于服务端 fan_point（匹配场为 win_lost.mult），客户端无本地连乘结果参与展示。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/XsmjFanConfig.ts:4；source-code/client/Code/config/FanDefine.ts:353；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:765
- **服务端职责**：下发 MsgResultHu，fan_point 为「基础番 × 8」连乘后的最终值；匹配场另下发 win_lost.mult。
- **客户端职责**：客户端不做连乘计算：FanDefine 只把杠开组/财神组/基础组声明为「三组最高档连乘」的说明，结算文案函数明确不使用 fan_point 计算；最终倍数完全取服务端下发的 fan_point。
- **协作边界**：客户端消费 fan_point（好友房）与 win_lost.mult（匹配场），本地不做连乘，只展示番型文案与输赢分。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:12
- **原文摘录**：`// 分3组互斥：基础/七对组、杠开组、财神组，最终倍数 = 三组最高档连乘`

#### `AT-ST-C09-010` 按杠时飘档是否大于 0 区分飘杠/杠飘

- **规则说明**：杠发生时飘档已经大于 0，记飘杠；否则记杠飘。
- **触发条件**：胡牌结算 MsgResultHu 的 fan_ids 含 2419 判杠飘（gp）、含 2420 判飘杠（pg）；MsgPiao 到达时更新飘数据缓存并可用于碰杠位飘字动画。
- **配置影响**：FanDefine 按 fan_ids 中 2419/2420 区分组合；音效映射 hu_20_gangpiao、hu_21_piaogang；MsgPiao 仅用于数据缓存与飘字动画。
- **客户端交互**：2419 走 skin=gp（杠飘）、2420 走 skin=pg（飘杠）；对应音效 hu_20_gangpiao 与 hu_21_piaogang。
- **限制与禁止**：客户端不读飘档、不判断飘/杠先后，仅按服务端下发的组合 ID 做表现层区分。
- **异常与边界**：飘档先后由服务端记录为 piao_before_gang 并决定下发 2419 还是 2420，客户端无对应字段；音效按 ids[0] 判 2419/2420，fan_ids 顺序不可靠时存在误判风险（代码注释明确）。
- **验收**：fan_ids 含 2419 时胡牌动效 skin=gp、音效 hu_20_gangpiao、文案「杠飘」；含 2420 时 skin=pg、音效 hu_21_piaogang、文案「飘杠」；MsgPiao 到达时飘数据缓存正确更新。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:1102；source-code/client/Code/config/FanDefine.ts:362；source-code/client/Code/config/GameSoundConfig.ts:505；source-code/client/Code/config/GameSoundConfig.ts:506
- **服务端职责**：下发 MsgResultHu（按飘/杠先后记录 piao_before_gang，决定下发 2419 还是 2420）；下发 MsgPiao（飘计数）。
- **客户端职责**：客户端不读飘档、不判断飘/杠先后，仅按服务端下发的组合 ID 区分：fan_ids 含 2419 判杠飘，含 2420 判飘杠；飘计数 MsgPiao 只用于数据缓存与碰杠位飘字动画。
- **协作边界**：客户端消费 MsgResultHu 的 2419/2420 区分 gp/pg 表现与音效、消费 MsgPiao 做飘数据缓存与飘字动画；飘档先后判定在服务端（piao_before_gang），客户端无对应字段。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjTipAniView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:1101
- **原文摘录**：`if (hasPiaoGang && !hasGangPiao) return "pg";`

## `FP-ST-C09-003` 高档不拆与取消独立番型

- **主描述**：二连杠、双财飘及更高档不做杠飘/飘杠合并，仍按各组连乘；结算不单列杠爆、七客两种番型。
- **范围与边界**：含高档组合命名边界与取消独立杠爆/七客；不含具体连乘计算与倍数展示。
- **总体协作**：属于番型组合与结算命名边界；客户端以组合动效/文案兜底，倍率仍取服务端 fan_point。

### 原子项

#### `AT-ST-C09-011` 二连杠、双财飘及更高档不拆，仍按各组连乘

- **规则说明**：二连杠、双财飘及更高档不拆，仍按各组连乘。
- **触发条件**：胡牌结算 MsgResultHu 的 fan_ids 出现高阶组合（如 2407+2404）且无 2419/2420 时，文案按「杠飘（二连杠，双财飘）」明细格式展示并播组合动效。
- **配置影响**：ResolveHzmjHuFanComboAni 组合判定（组合 ID 2419/2420 直接命中，或杠 × 财飘拆分命中）；FormatHzmjWinnerFanFlowText 高档明细格式；测试视图组合枚举（杠档名 × 财飘名）。
- **客户端交互**：高档组合仍播 gp/pg 组合动效与组合音效，结算文案为「杠飘（二连杠，双财飘）」。
- **限制与禁止**：客户端不做高档拆分与否的判定，番点归组与连乘在服务端。
- **异常与边界**：表现层把高档组合统一归入「杠飘/飘杠」，与模板「高档不拆、按各组连乘」的分档命名不一致；番点仍以服务端 fan_point 为准，好友房不展示分项倍数。
- **验收**：高阶组合（如 2407+2404）无 2419/2420 时，胡牌播 gp/pg 组合动效与组合音效，结算文案为「杠飘（二连杠，双财飘）」形式，得分取服务端 fan_point。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:351；source-code/client/Code/config/FanDefine.ts:389；source-code/client/Code/layer/BoxHzmjTestView.ts:1400；source-code/client/Code/layer/BoxHzmjTestView.ts:1407
- **服务端职责**：下发 MsgResultHu，高档组合按各组连乘计算 fan_point，fan_ids 给出归组结果（不拆出 2419/2420）。
- **客户端职责**：客户端组合判定覆盖任意杠开档×财飘档：ResolveHzmjHuFanComboAni 对 2407+2404 等高阶组合同样返回 GANG_PIAO；FormatHzmjWinnerFanFlowText 在无 2419/2420 时把高档写成「杠飘（二连杠，双财飘）」形式的明细。
- **协作边界**：客户端消费 fan_ids 做高档组合文案明细与 gp/pg 组合动效/音效；「高档不拆、按各组连乘」的番点归组在服务端完成。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:256
- **原文摘录**：`// 杠飘/飘杠：组合 ID(2419/2420) 直接命中，或杠 × 财飘拆分命中`

#### `AT-ST-C09-012` 没有单独的杠爆、七客

- **规则说明**：没有单独的杠爆、七客（不单列这两种番型）。
- **触发条件**：胡牌结算 MsgResultHu 的 fan_ids 中杠开系与爆头同时命中时触发 GANG_BAO 组合表现；七对系×爆头/财飘时走七客文案分支与对应 skin。
- **配置影响**：杠爆组合枚举（GANG_BAO，杠开系 × 爆头，zuhe index 2）；七客名称改写逻辑（七对名替换为七客）与七客文案分支；音效映射 hu_11_gangbao。
- **客户端交互**：若服务端下发杠开×爆头，客户端播 KW_Ani_Hu skin=gb 与音效 hu_11_gangbao；七对系×爆头/财飘则显示七客/豪华七客文案并走 qk/hhqk 等 skin。
- **限制与禁止**：客户端未定义杠爆/七客的独立番型 ID（HzmjFanType 中无对应枚举），符合不单列番型。
- **异常与边界**：番型 ID 层确实没有独立杠爆/七客，符合模板；但客户端仍保留杠爆/七客的组合动效、音效与命名，若服务端按连乘只下发基础番则不会触发，属待确认的遗留表现。
- **验收**：HzmjFanType 枚举中无杠爆/七客独立番型 ID；服务端只下发连乘基础番（不含杠开×爆头组合）时客户端不出现杠爆/七客文案与 gb/qk 动效；若下发组合则按遗留表现播 gb 音效 hu_11_gangbao 与七客文案（qk/hhqk skin）。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:261；source-code/client/Code/config/FanDefine.ts:341；source-code/client/Code/config/FanDefine.ts:424；source-code/client/Code/config/GameSoundConfig.ts:443
- **服务端职责**：下发 MsgResultHu，按模板连乘计算 fan_point，fan_ids 不单列杠爆/七客独立番型。
- **客户端职责**：客户端未定义杠爆/七客的独立番型 ID（HzmjFanType 中无对应枚举），符合不单列番型；但仍保留组合层表现：GANG_BAO（杠开×爆头）枚举、七客名称改写与七客文案分支。
- **协作边界**：客户端消费 MsgResultHu 的 fan_ids 做杠爆/七客组合动效、音效与文案兜底（遗留表现），是否触发取决于服务端下发内容；番型不单列由服务端 fan_ids 保证。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:136
- **原文摘录**：`/** 杠爆：杠开系 × 爆头 → zuhe index 2（原飘杠档位） */`
