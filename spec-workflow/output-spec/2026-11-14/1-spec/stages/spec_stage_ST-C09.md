# 杠开、杠飘、飘杠

> 阶段 ID：`ST-C09`。来源：模板「行牌 > 杠开、杠飘、飘杠」章节。客户端视角规格，客户端逻辑与 UI 交互以 Code/Fgui 代码证据支撑。

## 0. 阶段

- **阶段 ID**：`ST-C09`
- **阶段**：杠开、杠飘、飘杠
- **来源章节**：行牌 > 杠开、杠飘、飘杠
- **涉及协议消息**：MsgResultHu、MsgPower、MsgWaitInfos、MsgPiao
- **涉及 UI 模块**：box_hzmj_tipAni（Paixing_wz04 番型特效资源）、BoxHzmjTipAniView（番型动效层）、BoxHzmjResultMid（结算流水文案）
- **阶段概述**：定义杠开四档（杠链 1/2/3/4 及以上对应 2/4/8/16 倍、四连杠及以上记 16 倍、杠链断后不算）、杠飘与飘杠仅在杠开与财飘同时命中时拆出且为 8 倍再乘基础番、更高档不拆、无独立杠爆与七客。

## 术语与单位

| 术语 | 定义 | 单位/量纲 | 作用域 | 来源 |
| --- | --- | --- | --- | --- |
| 杠链 | 胡牌前连续杠牌的次数，1/2/3/4 及以上分别对应杠上开花/二连杠/三连杠/四连杠四档 | 次 | 本阶段 | 模板 行牌>杠开、杠飘、飘杠（第94行） |
| 杠开/杠上开花 | 杠牌后自摸，杠链为 1，倍数 2 | 倍 | 本阶段 | source-code/client/Code/config/FanDefine.ts:25 |
| 杠飘 | 先杠后飘：杠开后打出财神并在下一轮自摸，与财飘同时命中拆出，8 倍 | 倍 | 本阶段 | source-code/client/Code/config/FanDefine.ts:51 |
| 飘杠 | 先飘后杠：财飘后杠开，与财飘同时命中拆出，8 倍 | 倍 | 本阶段 | source-code/client/Code/config/FanDefine.ts:53 |
| 飘（财飘） | 自己出牌阶段打出一张财神即飘财 1 次，连续打出财神则累加，打出普通牌清零，每小局从 0 次起算 | 次 | 本阶段 | 模板 名词章节（第18行） |
| 财神 | 白板固定为财神，只在胡牌判定时代替顺子、刻子或对子所缺的牌 | 张 | 本阶段 | 模板 名词章节（第12行） |
| 倍数（番） | 分三组互斥：基础/七对组、杠开组、财神组，最终倍数取三组最高档连乘 | 倍 | 本阶段 | source-code/client/Code/config/FanDefine.ts:12 |

## 跨切面行为

- **番种与倍数不在客户端计算**：番型名称、fan_point、win_losts 分数均来自服务端 MsgResultHu，客户端只做名称映射、动效选择与文案拼装 —— 跨切面（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:765）
- **番型动效分两条资源线**：基础档走文字动效 Paixing_wz01（皮肤 baotou/caipiao/gangkai/pinghu/qiduizi），杠开连杠与组合档走特效动效 Paixing_wz04（皮肤 gk/2lgk/3lgk/4lgk/gp/pg/gb/qk） —— 跨切面（source-code/client/Code/layer/BoxHzmjTipAniView.ts:1132；source-code/client/Fgui/assets/box_hzmj_tipAni/effect/Paixing_wz04.json:1）
- **番型语音按 fan_ids 分组解析**：组合番（杠飘/飘杠/杠爆）使用独立组合语音键 hu_20_gangpiao / hu_21_piaogang —— 跨切面（source-code/client/Code/config/GameSoundConfig.ts:444）
- **结算文案分层**：匹配场桌面两行文案用“杠开”“杠飘/飘杠”组合名（formatHzmjMatchResultFanLines），好友房流水只显示番型名不拼倍数，匹配场才追加“N倍” —— 跨切面（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:765；source-code/client/Code/config/FanDefine.ts:350）
- **飘计数由服务端下发**：飘计数由 MsgPiao 的 seat+piao_count 下发并缓存在本地，仅触发一次“飘”动作动效，局内无常驻飘计数展示 —— 跨切面（无直接代码定位；MsgPiao 依赖见 AT-ST-C09-009 / AT-ST-C09-010）
- **客户端不参与杠开或杠飘成立判定**：客户端只有“打出财神后听任意牌”时在听牌箭头标飘/爆，以及“有杠权限且可能杠开”时弹提示气泡 —— 跨切面（source-code/client/Code/data/GameData.ts:411；source-code/client/Code/controller/cmd/gameCmd/GameWaitInfoCmd.ts:83）

## `FP-ST-C09-001` 杠开档位、倍数与杠链连续性

- **主描述**：杠上开花/二连杠/三连杠/四连杠四档按胡牌前连杠次数区分，倍数依次 2/4/8/16；四连杠及以上统一 16 倍；仅在自摸成立；杠链中断后胡牌不算杠开。
- **范围与边界**：只覆盖杠开档位命名、倍数与成立条件，不涉及杠牌本身的操作与杠分结算。
- **总体协作**：与财飘同时命中时交由 FP-ST-C09-002 处理；番型与倍数由服务端下发，客户端负责名称、动效、语音与文案。

### 原子项

#### `AT-ST-C09-001` 杠开四档与杠链次数对应命名

- **规则说明**：杠上开花 / 二连杠 / 三连杠 / 四连杠分别对应自摸时杠链为 1 / 2 / 3 / 4 及以上。
- **触发条件**：玩家杠牌后摸牌自摸胡牌，该次胡牌前的连续杠次数为 1 / 2 / 3 / 4 次，服务端据此下发对应档位番型 ID。
- **配置影响**：番型 ID 2406~2409 与中文名映射（FanDefine）；杠开系动效皮肤 gk/2lgk/3lgk/4lgk（Paixing_wz04 特效资源）；番型语音 hu_8_2gangkai 等（GameSoundConfig）。
- **客户端交互**：胡牌后在胡牌座位播放牌型 Spine 动效（杠开系走 KW_Ani_Hu 特效节点），并播放对应番型语音；桌面/流水文案显示番型名。
- **限制与禁止**：客户端不自行统计杠链，档位完全由服务端 fan_ids 决定。
- **异常与边界**：无
- **验收**：服务端下发含 2406/2407/2408/2409 的 fan_ids 时，客户端分别显示“杠上开花/二连杠/三连杠/四连杠”名称，播放 gk/2lgk/3lgk/4lgk 皮肤动效与对应番型语音，结算流水显示对应名称。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:80；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1132；source-code/client/Code/config/GameSoundConfig.ts:432；source-code/client/Fgui/assets/box_hzmj_tipAni/effect/Paixing_wz04.json:1
- **服务端职责**：下发 MsgResultHu（杠链计数与杠开档位判定在服务端完成，fan_ids 携带档位番型 ID）
- **客户端职责**：定义 2406~2409 四个番型 ID 与中文名（杠上开花/二连杠/三连杠/四连杠），结算/动效层按主番型选皮肤 gk/2lgk/3lgk/4lgk 并播放对应番型语音；客户端不自行统计杠链。
- **协作边界**：客户端消费 MsgResultHu 的 fan_ids 做名称映射、动效皮肤与语音选择；杠链计数与档位判定在服务端，客户端无本地判断。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:25
- **原文摘录**：`/** 杠上开花：杠牌后自摸，2x */`

#### `AT-ST-C09-002` 杠开四档倍数 2/4/8/16

- **规则说明**：杠链 1 / 2 / 3 / 4 及以上对应倍数 2 / 4 / 8 / 16。
- **触发条件**：杠开后胡牌进入结算，连杠次数分别为 1 / 2 / 3 / 4 次及以上。
- **配置影响**：番型 ID 2406/2407/2408/2409 定义（FanDefine）；萧山单项倍率表仅用于动画候选比较（XsmjFanConfig），不参与结算。
- **客户端交互**：好友房流水只显示番型名、不拼倍数；匹配场在流水文案后追加“N倍”；玩家最终看到的是结算分数。
- **限制与禁止**：客户端不参与倍数计算，实际总倍数始终取服务端 fan_point；萧山倍率表仅用于动画候选比较，不作为结算依据。
- **异常与边界**：倍率值仅出现在注释与萧山动画比较表中，好友房结算不显示倍数文字，倍数只体现在最终得分。
- **验收**：连杠 1/2/3/4 次及以上结算时，最终得分分别按 2/4/8/16 倍体现（由服务端 fan_point 计算），好友房界面不单独显示倍数文字。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:28；source-code/client/Code/config/FanDefine.ts:30；source-code/client/Code/config/FanDefine.ts:32；source-code/client/Code/config/XsmjFanConfig.ts:4
- **服务端职责**：下发 MsgResultHu（倍数计算与 fan_point 由服务端完成）
- **客户端职责**：客户端不参与倍数计算，番型倍数只以代码注释与（萧山）动画候选比较表形式存在，实际总倍数取服务端 fan_point。
- **协作边界**：客户端只消费 MsgResultHu 下发的番型名称与分数做展示；倍数计算在服务端，本地倍率表仅用于萧山动画候选比较。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:26
- **原文摘录**：`K_FTG_HZMJ_GANG_SHANG_HUA = 2406,`

#### `AT-ST-C09-003` 杠开只对自摸成立

- **规则说明**：杠开成立的前提是自摸（自摸且杠链为 N）。
- **触发条件**：玩家杠牌后摸牌胡牌，胡牌方式为自摸（非点炮、抢杠、点杠花）。
- **配置影响**：胡牌类型枚举 HT_SELF 等与自摸判定（非 HT_DISCARD/HT_ROBKONG/HT_DIAN_GANG_HUA 即自摸）；杠开可行性标志（GameData 当前是否能杠上开花）；杠开提示气泡类型 QF_SHOW_TYPE.GANG_CARD_CANNOT_HU。
- **客户端交互**：自摸与点炮播放不同语音与表现；有杠权限且存在杠开可能时弹出提示气泡（气泡文案在外部平台模块）。
- **限制与禁止**：客户端不校验胡牌方式与杠开番型的匹配，仅按番型 ID 直接播杠开动效；“仅自摸才记杠开”不由客户端保证。
- **异常与边界**：客户端按番型 ID 直接播杠开动效，不校验胡牌方式是否与杠开番型匹配，因此无法证实“仅自摸才记杠开”由哪一层保证；提示气泡仅为可行性辅助提示，不构成判定。
- **验收**：自摸胡牌时播放自摸表现与对应番型动效与语音；有杠权限且可能杠开时弹出提示气泡；点炮/抢杠/点杠花时不走自摸表现。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/GameData.ts:411；source-code/client/Code/controller/cmd/gameCmd/GameWaitInfoCmd.ts:83；source-code/client/Code/config/GameDefine.ts:425
- **服务端职责**：下发 MsgResultHu（hu_type 与 fan_ids）、MsgPower（杠权限）、MsgWaitInfos（等待信息触发提示）
- **客户端职责**：按 hu_type 判定是否自摸（非点炮/抢杠/点杠花即自摸），据此选择胡牌表现与语音；另有“有杠牌且已有听牌”的杠开可行性辅助判断用于提示。
- **协作边界**：客户端消费 MsgResultHu/MsgPower/MsgWaitInfos 选择胡牌表现与提示气泡；“自摸才记杠开”的番型判定在服务端，客户端不校验番型与胡牌方式的匹配。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjTipAniView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:929
- **原文摘录**：`const isZimo = !(huType === HuType.HT_DISCARD || huType === HuType.HT_ROBKONG || huType === HuType.HT_DIAN_GANG_HUA);`

#### `AT-ST-C09-004` 四连杠及以上统一 16 倍

- **规则说明**：四连杠及以上都记 16 倍（不再随杠链继续升档）。
- **触发条件**：玩家连续杠四次及以上后自摸胡牌。
- **配置影响**：番型 ID 2409（注释 16x）；杠开档位解析函数最高返回 4；四连杠动效皮肤 4lgk。
- **客户端交互**：四连杠播放 4lgk 特效与四连杠语音；更高连杠没有独立动效资源，归到四连杠表现。
- **限制与禁止**：客户端无 5 连杠及以上的独立档位或映射，不再随杠链继续升档。
- **异常与边界**：未见 5 连杠及以上档位定义，模板“及以上记 16 倍”需要服务端把更高连杠归并为 2409 才能对上四连杠表现。
- **验收**：连杠 4 次及以上自摸胡牌时，统一显示“四连杠”名称、播放 4lgk 特效与四连杠语音，得分按 16 倍呈现。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:298；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1139
- **服务端职责**：下发 MsgResultHu（更高连杠归并为 2409 下发的行为需服务端确认）
- **客户端职责**：客户端只有四档杠开番型（最多到四连杠 2409），档位解析函数最高返回 4，未见对 5 次及以上连杠的额外档位或映射。
- **协作边界**：客户端消费 fan_ids 中 2409 播四连杠表现；5 次及以上连杠的归并逻辑在服务端，客户端无对应处理。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:31
- **原文摘录**：`/** 四连杠：连续杠四次后自摸，16x */`

#### `AT-ST-C09-005` 杠链中断后胡牌不算杠开

- **规则说明**：杠链已断后再胡，不是杠开。
- **触发条件**：杠链已断后玩家再胡牌时。
- **配置影响**：本原子项无独立配置
- **客户端交互**：客户端代码未找到对应实现（待确认）
- **限制与禁止**：杠链已断后的胡牌不记杠开（判定归属待确认）。
- **异常与边界**：客户端不维护连杠状态；杠消息只带座位与面子信息，没有连杠计数，因此无法判定杠链是否中断。
- **验收**：待确认（需补充杠链中断判定证据后，验收杠链断后胡牌的结算不出现杠开番型）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：客户端不维护连杠状态，杠链中断判定完全依赖服务端（服务端行为未还原）。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

## `FP-ST-C09-002` 杠飘与飘杠的组合拆分与倍数

- **主描述**：杠飘、飘杠只在同时命中杠上开花和财飘时拆出，倍数为 8，再乘上基础番；杠发生时飘档已大于 0 记飘杠，否则记杠飘。
- **范围与边界**：只覆盖杠开与财飘同时成立时的组合命名、顺序区分与倍数，不覆盖单独财飘/爆头/七对的倍数。
- **总体协作**：依赖 FP-ST-C09-001 的杠开档位与财飘系番型；组合结果影响 FP-ST-C09-003 的高档处理。

### 原子项

#### `AT-ST-C09-006` 杠飘飘杠仅由杠开与财飘同时命中产生

- **规则说明**：杠飘、飘杠只在同时命中杠上开花和财飘时拆出。
- **触发条件**：胡牌结算时同一手胡牌既满足杠上开花又满足财飘。
- **配置影响**：番型分组判定 IsHzmjGangFan（2406-2409 与 2419/2420 为杠系）、IsHzmjCaiPiaoFan（2403-2405 与 2419/2420 为财飘系）；组合动效档解析 resolveHzmjHuFanComboAni。
- **客户端交互**：命中后播放杠飘/飘杠组合特效动效与组合语音，结算显示组合名（不是杠开名 + 财飘名并列）。
- **限制与禁止**：客户端不做“杠开×财飘才拆出”的成立判定，仅识别服务端下发的组合 ID 或拆分番型。
- **异常与边界**：组合识别依赖服务端下发的 fan_ids，客户端把 2419/2420 同时算作杠系和财飘系。
- **验收**：fan_ids 直接含 2419/2420，或同时含杠系与财飘系番型时，客户端归为杠飘组合档，播放组合特效动效与组合语音，结算只显示组合名。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:257；source-code/client/Code/config/FanDefine.ts:146；source-code/client/Code/config/FanDefine.ts:158；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1096
- **服务端职责**：下发 MsgResultHu（组合成立判定在服务端，fan_ids 携带组合 ID 2419/2420 或杠系+财飘系拆分番型）
- **客户端职责**：番型判定函数把 2406-2409 与 2419/2420 视为杠系、2403-2405 与 2419/2420 视为财飘系，组合解析在“杠系且财飘系”或直接命中 2419/2420 时归为杠飘组合档。
- **协作边界**：客户端消费 MsgResultHu 的 fan_ids 做组合识别与动效/语音/文案选择；“杠开×财飘才拆出”的成立判定在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:256
- **原文摘录**：`// 杠飘/飘杠：组合 ID(2419/2420) 直接命中，或杠 × 财飘拆分命中`

#### `AT-ST-C09-007` 杠飘飘杠倍数为 8

- **规则说明**：杠飘、飘杠倍数为 8。
- **触发条件**：结算时命中杠飘或飘杠组合（杠开与财飘同时成立）。
- **配置影响**：番型 2419/2420 注释标注 8 倍（FanDefine）；萧山动画倍率表中两组合均为 8（XsmjFanConfig），仅用于动画候选比较。
- **客户端交互**：不单独显示“8 倍”文字，玩家看到的是结算分数与组合番型名。
- **限制与禁止**：8 倍注释与萧山动画倍率表不作为好友房结算依据，实际倍数取服务端 fan_point。
- **异常与边界**：8 倍仅以注释与萧山动画倍率表形式存在，不是好友房结算依据。
- **验收**：命中杠飘/飘杠时最终得分按 8 倍体现，界面不单独标出 8 倍。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:53；source-code/client/Code/config/XsmjFanConfig.ts:24；source-code/client/Code/config/XsmjFanConfig.ts:25
- **服务端职责**：下发 MsgResultHu（8 倍的结算应用由服务端 fan_point 体现）
- **客户端职责**：2419/2420 在番型注释中标注为 8 倍，并出现在动画倍率比较表（8）；客户端不参与实际倍数计算。
- **协作边界**：客户端只消费下发的分数与番型名做展示；8 倍数值的结算计算在服务端，客户端不可证。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:51
- **原文摘录**：`/** 杠飘：先杠后飘（杠开后打出财神并下一轮自摸），8x */`

#### `AT-ST-C09-008` 杠飘飘杠倍数再乘基础番

- **规则说明**：杠飘、飘杠倍数为 8，再乘上基础番。
- **触发条件**：杠飘或飘杠与基础牌型同时成立并计算总分。
- **配置影响**：三组互斥分组注释（基础/七对组、杠开组、财神组，最终倍数为三组最高档连乘）；组合文案格式化 FormatHzmjComboFanSides。
- **客户端交互**：结算流水只展示番型文案与分数，不展示乘法过程或分项倍数。
- **限制与禁止**：客户端不做连乘计算，只按下发番型拼文案、按下发分数展示。
- **异常与边界**：组合两侧档位均为 1 时只写组合名，否则组合名后带非 1 侧明细（文案层规则）。
- **验收**：杠飘/飘杠与基础牌型同时命中时，最终分数为组合倍数与基础番相乘后的结果，界面不展示乘法过程或分项倍数。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:350；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:765
- **服务端职责**：下发 MsgResultHu（连乘计算与 fan_point 由服务端完成）
- **客户端职责**：代码注释说明最终倍数由基础/七对组、杠开组、财神组三组最高档连乘；客户端不做连乘计算，只按下发番型拼文案、按下发分数展示。
- **协作边界**：客户端只承载番型文案与分数；连乘计算发生在服务端，客户端无法验证连乘后的具体数值。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:12
- **原文摘录**：`// 分3组互斥：基础/七对组、杠开组、财神组，最终倍数 = 三组最高档连乘`

#### `AT-ST-C09-009` 杠发生时飘档大于 0 记飘杠

- **规则说明**：杠发生时飘档已经大于 0，记飘杠。
- **触发条件**：玩家先打出财神形成飘，之后杠牌并在杠后自摸胡牌。
- **配置影响**：番型 ID 2420（飘杠）；专属动效皮肤 pg（Paixing_wz04）；专属组合语音键 hu_21_piaogang（GameSoundConfig）。
- **客户端交互**：胡牌时播放“飘杠”特效动效与飘杠语音；结算流水显示“飘杠”。
- **限制与禁止**：客户端不判定“杠发生时飘档是否已大于 0”，仅按下发番型 ID 展示飘杠。
- **异常与边界**：仅当番型含 2420 且不含 2419 时按飘杠输出（与杠飘同时下发时优先按杠飘解析）。
- **验收**：fan_ids 含 2420 且不含 2419 时，显示“飘杠”名称、播放 pg 皮肤特效与 hu_21_piaogang 语音，结算流水显示“飘杠”。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:1101；source-code/client/Code/config/FanDefine.ts:367；source-code/client/Code/config/GameSoundConfig.ts:445；source-code/client/Fgui/assets/box_hzmj_tipAni/effect/Paixing_wz04.json:1
- **服务端职责**：下发 MsgResultHu（含 2420 番型 ID）；下发 MsgPiao（seat+piao_count 飘计数）
- **客户端职责**：定义飘杠番型 2420 并注释“先飘后杠（财飘后杠开）”；结算时若番型含 2420 且不含 2419，则按飘杠输出专属皮肤 pg 与专属语音。
- **协作边界**：客户端消费 MsgResultHu 的番型 ID 与 MsgPiao 的飘计数缓存；“杠发生时飘档大于 0”的判定在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:54
- **原文摘录**：`K_FTG_HZMJ_PIAO_GANG = 2420,`

#### `AT-ST-C09-010` 杠时飘档为 0 记杠飘

- **规则说明**：杠发生时飘档未大于 0（即 0），记杠飘。
- **触发条件**：玩家还没飘就先杠，杠后打出财神并在下一轮自摸胡牌。
- **配置影响**：番型 ID 2419（杠飘）；专属动效皮肤 gp（Paixing_wz04）；专属组合语音键 hu_20_gangpiao（GameSoundConfig）。
- **客户端交互**：胡牌时播放“杠飘”特效动效与杠飘语音；结算流水显示“杠飘”。
- **限制与禁止**：客户端不判定“杠发生时飘档为 0”，仅按番型 ID 或默认规则展示杠飘。
- **异常与边界**：拆分模式（服务端只下发杠开+财飘、无 2419/2420）时，代码显式注释“fan_ids 顺序不可靠”并默认按杠飘显示，若真实为飘杠可能显示不一致。
- **验收**：fan_ids 含 2419 且不含 2420 时，显示“杠飘”名称、播放 gp 皮肤特效与 hu_20_gangpiao 语音；仅下发拆分番型（杠开+财飘）时默认按杠飘解析。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:1102；source-code/client/Code/config/FanDefine.ts:364；source-code/client/Code/config/GameSoundConfig.ts:444；source-code/client/Fgui/assets/box_hzmj_tipAni/effect/Paixing_wz04.json:1
- **服务端职责**：下发 MsgResultHu（含 2419 或杠开+财飘拆分番型）；下发 MsgPiao（seat+piao_count 飘计数）
- **客户端职责**：定义杠飘番型 2419 并注释“先杠后飘”；结算时含 2419 不含 2420 显示杠飘，若只下发拆分番型（杠开+财飘）也默认按杠飘解析，皮肤 gp。
- **协作边界**：客户端消费 MsgResultHu 番型 ID 与 MsgPiao 飘计数；飘档时序判定在服务端，拆分模式下客户端按默认规则解析。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:52
- **原文摘录**：`K_FTG_HZMJ_GANG_PIAO = 2419,`

## `FP-ST-C09-003` 高档组合不拆与无独立杠爆七客

- **主描述**：二连杠、双财飘及更高档不拆，仍按各组连乘；不存在单独的杠爆、七客番型。
- **范围与边界**：覆盖高档组合的展示合并方式与杠爆/七客是否存在独立番型，不涉及杠爆/七客的具体倍数。
- **总体协作**：上承 FP-ST-C09-002 的组合识别结果，下接结算文案与番型动效。

### 原子项

#### `AT-ST-C09-011` 二连杠双财飘及更高档不拆仍连乘

- **规则说明**：二连杠、双财飘及更高档不拆，仍按各组连乘。
- **触发条件**：连杠两次及以上或飘两次及以上时，仍同时命中杠开与财飘。
- **配置影响**：组合文案格式化 FormatHzmjComboFanSides（组合名 + 非 1 档明细括号）；杠飘组合动效档（HzmjHuFanComboAni.GANG_PIAO）。
- **客户端交互**：玩家只看到一个组合动效与一条组合文案，括号中提示高档明细，没有分档倍数展示。
- **限制与禁止**：不做分档拆分展示，高档组合仍归并为同一个组合动效档。
- **异常与边界**：档位为 1 的侧不写明细，仅高于 1 的档位写入括号（如“杠飘（二连杠，双财飘）”）。
- **验收**：二连杠+双财飘等高档组合命中时，只显示一个组合牌型名并在括号内补充高档明细，播放单一组合动效，无分档倍数展示。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:389；source-code/client/Code/config/FanDefine.ts:257；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1097
- **服务端职责**：下发 MsgResultHu（倍数按各组连乘的计算在服务端完成）
- **客户端职责**：组合解析把 2407+2404 等高档组合仍归并为同一个杠飘组合动效档；文案在组合名后用括号列出非 1 档明细（如“杠飘（二连杠，双财飘）”），不做分档拆分。
- **协作边界**：客户端只在文案层保留高档明细；倍数是否按各组连乘拆开计分由服务端完成，客户端无法证实。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:351
- **原文摘录**：`* 例：二连杠+双财飘 → 杠飘（二连杠，双财飘）`

#### `AT-ST-C09-012` 没有单独的杠爆与七客

- **规则说明**：没有单独的杠爆、七客。
- **触发条件**：杠开与爆头同时命中，或七对与爆头/财飘同时命中（组合场景出现时验证无独立番型项）。
- **配置影响**：无独立番型 ID；仅有组合命名（杠爆 zuhe index 2、七客组合基础名 qiKeBaseName）。
- **客户端交互**：播放“杠爆”“七客”组合动效与语音，结算流水显示组合名，但没有独立的杠爆/七客番型项与倍数条目。
- **限制与禁止**：客户端不额外生成独立加分番型。
- **异常与边界**：客户端没有独立番型 ID，但展示层仍以“杠爆”“七客”命名呈现，需确认这种组合命名展示是否与“没有单独的杠爆、七客”的表述冲突。
- **验收**：杠开×爆头或七对×爆头/财飘命中时，仅以组合名展示动效与文案，流水中不出现独立杠爆/七客番型项与倍数条目。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:404；source-code/client/Code/config/FanDefine.ts:424
- **服务端职责**：下发 MsgResultHu（是否存在独立杠爆/七客番型与倍数项由服务端决定，客户端不可证）
- **客户端职责**：客户端番型表没有杠爆、七客的独立番型 ID，只在“杠开×爆头”“七对×爆头/财飘”组合时用组合名杠爆/七客选择动效与文案，不额外生成独立加分番型。
- **协作边界**：客户端消费 MsgResultHu 的 fan_ids 做组合命名展示；服务端是否存在独立番型与倍数项仅凭展示层无法证实。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:136
- **原文摘录**：`/** 杠爆：杠开系 × 爆头 → zuhe index 2（原飘杠档位） */`
