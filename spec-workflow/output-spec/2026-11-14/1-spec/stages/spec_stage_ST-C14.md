# 番型

> 阶段 ID：`ST-C14`。来源：模板「番型」章节。客户端视角规格，客户端逻辑与 UI 交互以 Code/Fgui 代码证据支撑。

## 0. 阶段

- **阶段 ID**：`ST-C14`
- **阶段**：番型
- **来源章节**：番型
- **涉及协议消息**：MsgResultHu、MsgPower、MsgWaitInfos、MsgPiao
- **涉及 UI 模块**：BoxHzmjTipAniView、BoxHzmjMainView、BoxHzmjResultMid、BoxHzmjTingPaiView、BoxHzmjPlayerHandCards
- **阶段概述**：定义胡牌番型的判定顺序、三组互斥取高再连乘的倍数结构、各档番型的成立条件与倍数，以及财神牌面与牌河的红染表现。

## 术语与单位

| 术语 | 定义 | 单位/量纲 | 作用域 | 来源 |
| --- | --- | --- | --- | --- |
| 面子 | 一组顺子、刻子或杠。杠含 4 张，仍计 1 组面子。对子不是面子。已完成的吃、碰、明杠、暗杠都计入面子。 | 组 | 全局 | 模板名词章节（第11行） |
| 财神 | 白板固定为财神。只在胡牌判定时代替顺子、刻子或对子所缺的牌。吃、碰、杠必须用真实的非财神牌，不能用财神牌，也不能用财神去代替所缺的牌。 | 无 | 全局 | 模板名词章节（第12行） |
| 爆头 | 摸牌前为 4 组面子加 1 张财神。下一张摸到任意牌，都与这张财神组成对子后自摸。只能自摸。 | 无 | 全局 | 模板名词章节（第16行） |
| 七客 | 七对爆头。摸牌前没有吃、碰、杠，手牌为 6 组对子加 1 张财神。结算不单列这一项，按七对和爆头两组连乘。 | 无 | 全局 | 模板名词章节（第17行） |
| 飘 | 自己出牌阶段打出一张财神，即飘财 1 次。连续打出财神则累加，打出普通牌清零。每小局从 0 次起算。 | 次 | 全局 | 模板名词章节（第18行） |
| 放铳 | 打出的牌被他人合法胡走。胡牌者称为点炮胡。白板财神弃牌不能点炮胡。 | 无 | 全局 | 模板名词章节（第19行） |
| 番型三组 | 番型分三组（基础、杠开、财神），组内只取最高一档，组间连乘。 | 组 | 本阶段 | 模板 番型（第165行） |
| 财神牌面 | 财神牌面染红，可点击，没有角标。打出后牌河仍是原牌面，只保留这层红色。 | 无 | 本阶段 | 模板 番型（第180行） |

## 跨切面行为

- **判番与倍数由服务端下发**：番型的成立判定与最终倍数由服务端下发（hu_items 的 fan_ids、fan_point 与 fan_details），客户端只做名称映射、字效资源选择、音效选择与倍数文案展示，未实现任何判番或倍数计算 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:181）
- **fan_ids 多出口共用解析**：同一份 fan_ids 被多处共用解析：字效（BoxHzmjTipAniView）、音效（GameSoundConfig）、流水与桌面文案（FanDefine 的 formatHzmjWinnerFanFlowText / formatHzmjMatchResultFanLines），组合番统一归并为杠飘、杠爆、七客 —— 跨切面（source-code/client/Code/layer/BoxHzmjTipAniView.ts:1034；source-code/client/Code/config/FanDefine.ts:12）
- **财神红染全局复用**：财神红染是全局牌值映射（GameData.jokerMah），手牌、牌河、副露、胡牌列表、放大出牌、听牌面板均复用同一条 #ffc4c4 染色链路，同牌高亮优先于红染 —— 跨切面（source-code/client/Code/data/GameData.ts）
- **倍数文案直取服务端点数**：胡牌按钮的倍数文本取服务端 hu_point，听牌面板的倍数取服务端 point 并按房间封顶值做 min 截断，客户端不做封顶外计算 —— 跨切面（source-code/client/Code/layer/BoxHzmjMainView.ts:666；source-code/client/Code/layer/BoxHzmjTingPaiView.ts:141）
- **杭州与萧山两套番型表现并存**：客户端代码里同时存在杭州与萧山两套番型表现：公共番型走 FanDefine，萧山独有扩展走 XsmjFanConfig 与 XsmjHuFanResolver，萧山倍率表不可直接当作杭州倍率证据 —— 跨切面（source-code/client/Code/config/FanDefine.ts:12；萧山扩展 XsmjFanConfig / XsmjHuFanResolver）

（以下按 JSON 中 features 顺序，每个功能点一节）

## `FP-ST-C14-001` 番型判定结构与胡牌方式

- **主描述**：结算时先确定牌型，再区分自摸、点炮胡与抢杠胡；番型按基础（含七对）、杠开、财神三组归类，组内取最高档，组间连乘。
- **范围与边界**：只覆盖判定顺序、分组取高与组间连乘的结构；不含各档番型的具体成立条件与倍数，也不含结算分数改写与承包。
- **总体协作**：客户端只消费服务端下发的番型列表与胡牌类型，做表现层映射，不参与判番。

### 原子项

#### `AT-ST-C14-001` 先确认牌型再确认胡牌方式

- **规则说明**：先确认牌型，再确认这次是自摸、点炮胡还是抢杠胡。牌型确认在前、胡牌方式确认在后，两者共同决定本局结算的番型集合与胡牌表现形态。
- **触发条件**：有人胡牌并进入结算，结算明细中存在该座位的胡牌记录。
- **配置影响**：胡牌类型枚举（HuType.HT_DISCARD / HT_ROBKONG / HT_DIAN_GANG_HUA 等）、胡牌动作皮肤（自摸/胡两种）与点炮字效皮肤（dianpao）。
- **客户端交互**：胡牌按钮按胡牌类型切换自摸/胡两种动作皮肤；胡牌者方位播放番型字效，点炮时由放铳方位另播点炮字效。
- **限制与禁止**：客户端不做判定顺序运算，不自行判定牌型与胡牌方式。
- **异常与边界**：结算明细缺失 hu_type 字段时按 0 处理（item.hu_type || 0），落到非点炮、非抢杠的自摸类表现兜底。
- **验收**：结算时胡牌者方位出现番型字效；自摸时胡牌按钮为自摸动作皮肤，点炮或抢杠时为胡动作皮肤且放铳方位出现点炮字效。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:929；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:164；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:181；source-code/client/Code/layer/BoxHzmjMainView.ts:671
- **服务端职责**：下发 MsgResultHu（结算胡牌明细，含 hu_type 与 fan_ids）、MsgPower（胡牌倍数点数），牌型与胡牌方式的判定顺序由服务端完成。
- **客户端职责**：结算时同时读取服务端下发的番型列表与胡牌类型：番型列表用于选番型字效与音效，胡牌类型用于判断是否自摸并选择动作皮肤；客户端不做判定顺序运算。
- **协作边界**：客户端消费 MsgResultHu 的 fan_ids 与 hu_type、MsgPower 的点数做表现映射；牌型与胡牌方式的判定顺序在服务端，客户端无本地判定。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjTipAniView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:929
- **原文摘录**：`const isZimo = !(huType === HuType.HT_DISCARD || huType === HuType.HT_ROBKONG || huType === HuType.HT_DIAN_GANG_HUA);`

#### `AT-ST-C14-002` 番型分三组且组内只取最高一档

- **规则说明**：番型分三组（基础/七对组、杠开组、财神组），组内只取最高一档。
- **触发条件**：一组手牌同时命中多个番型，服务端返回的番型列表里有多条记录。
- **配置影响**：番型 ID 表按基础（含七对）、杠开、财神三组归类（FanDefine 注释声明）；动画优先级表 HzmjFanAniSortingMap 用于挑选主番型。
- **客户端交互**：同一手牌只播一个主番型字效；杠飘、杠爆、七客这类组合另走组合字效节点。
- **限制与禁止**：客户端按动画优先级而非分组取高挑选主番型，不做分组倍率计算。
- **异常与边界**：三组互斥只在注释层声明；动画优先级相同时按番型 ID 更大者兜底（sort === bestSort && id > best）。
- **验收**：同一手牌命中多个番型时只播一段主番型字效，不会把所有命中番型逐条播完。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:12；source-code/client/Code/config/FanDefine.ts:282；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1034
- **服务端职责**：下发 MsgResultHu（fan_ids 番型列表），三组划分与组内取高由服务端计算。
- **客户端职责**：番型 ID 表按基础（含七对）、杠开、财神三组归类；播字效时用动画优先级表在全部命中的番型里取最高一档作为主番型。
- **协作边界**：客户端消费 MsgResultHu 的 fan_ids 做主番型挑选与字效播放；三组划分与组内取高的计算在服务端，客户端无对应运算。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:12
- **原文摘录**：`// 分3组互斥：基础/七对组、杠开组、财神组，最终倍数 = 三组最高档连乘`

#### `AT-ST-C14-003` 组间连乘得出总倍数

- **规则说明**：组间连乘，最终倍数为三组最高档相乘。
- **触发条件**：胡牌成立或查看听牌，服务端已算出该次胡牌的总倍数。
- **配置影响**：FanDefine 注释声明三组最高档连乘的结构；倍数展示取服务端点数字段（hu_point、fan/point）。
- **客户端交互**：胡牌按钮显示 N 倍；结算流水行显示 N 倍；听牌面板每张听牌显示服务端下发的倍数并按房间封顶值截断。
- **限制与禁止**：客户端不重算连乘，不做封顶外计算。
- **异常与边界**：听牌面板倍数按房间封顶值做 min 截断后才展示。
- **验收**：胡牌按钮、结算流水、听牌面板显示的倍数与服务端下发点数一致，客户端无数值改写。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:12；source-code/client/Code/layer/BoxHzmjMainView.ts:666；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:772；source-code/client/Code/layer/BoxHzmjTingPaiView.ts:141
- **服务端职责**：下发 MsgPower（hu_point）、MsgResultHu（结算倍数）、MsgWaitInfos（听牌倍数 point），连乘由服务端计算。
- **客户端职责**：客户端不重算连乘，直接展示服务端下发的总倍数：胡牌按钮显示胡牌倍数，结算流水行与听牌面板显示服务端点数。
- **协作边界**：客户端消费 MsgPower、MsgResultHu、MsgWaitInfos 的点数做纯展示；三组连乘运算在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:12
- **原文摘录**：`// 分3组互斥：基础/七对组、杠开组、财神组，最终倍数 = 三组最高档连乘`

#### `AT-ST-C14-004` 点炮与抢杠不计爆头等番型

- **规则说明**：点炮和抢杠不算爆头、财飘、杠开、十风。
- **触发条件**：别人打出的牌被胡走，或加杠的第四张被抢，胡牌方式是点炮或抢杠而不是自摸。
- **配置影响**：胡牌类型枚举（HT_DISCARD / HT_DIAN_GANG_HUA / HT_ROBKONG）与点炮字效皮肤（dianpao）。
- **客户端交互**：点炮或抢杠时胡牌按钮用胡皮肤而非自摸皮肤，放铳方位播放点炮字效。
- **限制与禁止**：点炮与抢杠不得计入爆头、财飘、杠开、十风；客户端未见对应剔除逻辑，不得在客户端补做番型剔除或改判。
- **异常与边界**：番型组合完全由服务端 fan_ids 决定，客户端仅按胡牌类型区分表现。
- **验收**：点炮/抢杠胡时放铳方位出现点炮字效、胡牌按钮为非自摸皮肤；结算番型以服务端 fan_ids 为准。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:929；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:339；source-code/client/Code/layer/BoxHzmjTipAniView.ts:892
- **服务端职责**：下发 MsgResultHu（hu_type 与剔除爆头、财飘、杠开、十风后的 fan_ids）、MsgPower（倍数点数）。
- **客户端职责**：客户端只在表现层区分自摸与点炮/抢杠（动作皮肤、点炮字效、番型音效），未见对番型列表做剔除或改判的逻辑。
- **协作边界**：客户端消费 hu_type 与 fan_ids 做表现；爆头、财飘、杠开、十风的剔除规则在服务端，客户端无剔除实现。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjTipAniView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjTipAniView.ts:929
- **原文摘录**：`const isZimo = !(huType === HuType.HT_DISCARD || huType === HuType.HT_ROBKONG || huType === HuType.HT_DIAN_GANG_HUA);`

## `FP-ST-C14-002` 平胡

- **主描述**：基础组最低一档平胡：4 组面子加 1 对即可成立，财神可参与面子或对子，倍数为 1。
- **范围与边界**：只覆盖平胡自身的成立条件与倍数；其他番型命中时按组内取高替换平胡，不在本功能点内。
- **总体协作**：平胡同时作为番型兜底名称，番型列表为空或缺失时统一显示平胡。

### 原子项

#### `AT-ST-C14-005` 平胡为四组面子加一对

- **规则说明**：平胡为 4 组面子加 1 对，是基础组最低一档。
- **触发条件**：一手牌按四组面子加一对胡牌，且该手牌没有命中更高的番型。
- **配置影响**：平胡番型 ID（K_FTG_HZMJ_PING_HU）与名称配置；番型列表为空时的平胡兜底命名。
- **客户端交互**：番型列表缺失或全部为平胡时，桌面结算文案显示平胡。
- **限制与禁止**：客户端不判定面子与将的成型。
- **异常与边界**：番型列表为空（ids.length === 0）或含平胡时走平胡兜底命名分支。
- **验收**：番型列表为空或只含平胡时结算文案显示平胡；非空列表按服务端番型命名。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:15；source-code/client/Code/config/FanDefine.ts:274；source-code/client/Code/config/FanDefine.ts:516
- **服务端职责**：下发 MsgResultHu（fan_ids 番型列表）。
- **客户端职责**：客户端只定义平胡番型 ID 与名称，并在番型列表为空时按平胡兜底命名；不判定面子与将的成型。
- **协作边界**：客户端消费 fan_ids 做名称映射与空列表兜底；四组面子加一对的成型判定在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:15
- **原文摘录**：`/** 平胡（四面子一将），1x */`

#### `AT-ST-C14-006` 财神可参与面子或对子

- **规则说明**：财神可参与面子或对子，即在胡牌判定中可代替顺子、刻子或对子所缺的牌。
- **触发条件**：副露或胡牌组合里含财神，财神被用来补顺子或充当对子。
- **配置影响**：胡牌组合标志 CMF_JOKMIAN（财神面/组）与 CMF_JOKJINAG（财神将）；吃/顺子展示排序规则（牌值升序，财神按缺口推断替代牌值插入）。
- **客户端交互**：副露与顺子按牌值升序摆放，财神被插到它所补的缺口位置。
- **限制与禁止**：财神代替所缺牌仅限胡牌判定；吃、碰、杠必须用真实的非财神牌，不能用财神去代替所缺的牌。
- **异常与边界**：财神面与财神将标志只做定义，仓库内未见引用；展示插位逻辑仅解决摆放顺序，不代表成型判定。
- **验收**：副露与顺子含财神时，财神出现在它替代的那张牌的缺口位置。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/BoxMahDefine.ts:434；source-code/client/Code/config/GameDefine.ts:253；source-code/client/Code/config/GameDefine.ts:255
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：副露与顺子展示时把财神按缺口推断替代牌值插入，胡牌组合标志里定义了财神面（组）与财神将；实际成型判定不在客户端。
- **协作边界**：本原子项无协议消息；客户端仅按本地排序规则摆放财神位置，财神能否参与面子或对子由服务端判胡决定。
- **来源文件**：`source-code/client/Code/config/BoxMahDefine.ts`
- **来源定位**：source-code/client/Code/config/BoxMahDefine.ts:434
- **原文摘录**：`吃/顺子展示排序：牌值升序，财神按缺口推断替代牌值插入`

#### `AT-ST-C14-007` 平胡倍数为1

- **规则说明**：平胡倍数为 1。
- **触发条件**：平胡成立且该手牌未命中更高番型。
- **配置影响**：番型表注释标注平胡 1 倍；实际倍数展示取服务端点数。
- **客户端交互**：胡牌按钮与结算流水按服务端点数显示 N 倍。
- **限制与禁止**：客户端不参与倍数计算，未校验平胡是否恒为 1 倍。
- **异常与边界**：无。
- **验收**：平胡结算显示的倍数与服务端下发点数一致。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:15；source-code/client/Code/layer/BoxHzmjMainView.ts:666
- **服务端职责**：下发 MsgPower（hu_point）、MsgResultHu（结算点数）。
- **客户端职责**：番型表标注平胡 1 倍；实际展示的倍数取服务端下发的点数。
- **协作边界**：客户端消费服务端点数纯展示；平胡是否恒为 1 倍由服务端保证。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:15
- **原文摘录**：`/** 平胡（四面子一将），1x */`

## `FP-ST-C14-003` 带财七对

- **主描述**：14 张组成 7 对且手里至少 1 张财神的七对档位，含豪华、双豪华、三豪华，豪华按非财神牌面四张实牌计组，白板不计豪华。
- **范围与边界**：不含没有财神时的清七对；不含七对与爆头或财飘叠加后的七客称作法。
- **总体协作**：七对系与爆头或财飘同时命中时，客户端统一改名为七客并按组合字效播放；倍率仍取服务端结果。

### 原子项

#### `AT-ST-C14-008` 带财七对成立条件

- **规则说明**：七对为 14 张组成 7 对，且手里至少有 1 张财神。
- **触发条件**：一手牌做成七对，手里带财神并按七对胡牌。
- **配置影响**：七对系番型 ID 与名称（K_FTG_HZMJ_QI_DUI 等）；七客系组合文案函数 formatHzmjQiKeFlow。
- **客户端交互**：结算文案显示七对、豪华七对、双豪华七对、三豪华七对，叠加爆头时显示七客系名称。
- **限制与禁止**：客户端不判断手里是否有财神。
- **异常与边界**：七对系与爆头或财飘同时命中时，客户端统一改名为七客并按组合字效播放。
- **验收**：带财七对胡牌时结算显示对应档位名称；叠加爆头或财飘时显示七客系名称。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:34；source-code/client/Code/config/FanDefine.ts:83；source-code/client/Code/config/FanDefine.ts:420
- **服务端职责**：下发 MsgResultHu（fan_ids 番型列表）。
- **客户端职责**：客户端有七对与各豪华档位的番型 ID 与名称，并把七对系叠加爆头或财飘时改名为七客；未见至少一张财神的判定。
- **协作边界**：客户端消费 fan_ids 映射名称与组合改名；七对成型与带财神条件在服务端判定。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:34
- **原文摘录**：`K_FTG_HZMJ_QI_DUI = 2410,`

#### `AT-ST-C14-009` 带财七对档位倍数

- **规则说明**：七对 / 豪华 / 双豪华 / 三豪华四档，倍数 2 / 4 / 8 / 16。
- **触发条件**：带财七对胡牌并命中豪华档位，某个非财神牌面凑成四张实牌越多，档位越高。
- **配置影响**：四档番型 ID、名称与字效皮肤（七对、豪华、双豪华、三豪华；七客档位 hhqk、2hhqk、3hhqk 等）；动画优先级表 HzmjFanAniSortingMap。
- **客户端交互**：四档七对分别播不同的番型字效（七对、豪华、双豪华、三豪华），七客档位另用 hhqk、2hhqk、3hhqk 等皮肤。
- **限制与禁止**：倍数文案在客户端仅为注释，不作为计算依据。
- **异常与边界**：无。
- **验收**：四档带财七对分别播放对应字效并显示服务端倍数，豪华级数递增时倍数随之增加。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:35；source-code/client/Code/config/FanDefine.ts:39；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1143；source-code/client/Code/config/FanDefine.ts:104
- **服务端职责**：下发 MsgResultHu（fan_ids 与倍数点数）。
- **客户端职责**：四个档位分别有番型 ID、名称与字效皮肤；倍数只在注释中标注，展示取服务端倍数。
- **协作边界**：客户端消费 fan_ids 选档位与字效；豪华计数与档位倍数由服务端计算。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:35
- **原文摘录**：`/** 豪华七对（含1组四张相同），4x */`

#### `AT-ST-C14-010` 豪华按非财神牌面四张实牌计一组

- **规则说明**：某种非财神牌面有 4 张实牌，计 1 组豪华。
- **触发条件**：七对手里出现四张相同的非财神牌，且该牌面四张都是真实牌。
- **配置影响**：豪华、双豪华、三豪华三档番型 ID 与名称；七客系基础名（如三豪华七客）。
- **客户端交互**：命中的豪华档位在结算文案与字效中体现。
- **限制与禁止**：客户端没有按四张实牌统计豪华组数的逻辑，不做本地统计。
- **异常与边界**：无。
- **验收**：命中豪华档位时结算文案与字效显示豪华、双豪华或三豪华。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:36；source-code/client/Code/config/FanDefine.ts:437；source-code/client/Code/config/FanDefine.ts:441
- **服务端职责**：下发 MsgResultHu（fan_ids）。
- **客户端职责**：客户端只有豪华、双豪华、三豪华三档名称与档位字效，没有按四张实牌统计豪华组数的逻辑。
- **协作边界**：客户端消费 fan_ids 展示档位；四张实牌的统计规则在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:36
- **原文摘录**：`K_FTG_HZMJ_HAO_QI = 2411,`

#### `AT-ST-C14-011` 白板不计豪华

- **规则说明**：白板不计豪华，即统计豪华组数时白板（财神）牌面不计入。
- **触发条件**：七对豪华统计涉及白板（财神）牌面时（按规则推导，客户端未见对应实现）。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：白板不得计入豪华组数。
- **异常与边界**：仓库内只找到白板作为财神牌值常量，未见豪华组数统计，也未见把白板排除在豪华之外的逻辑。
- **验收**：客户端无可验收实现；白板不计豪华的口径需以服务端判番结果为准（待确认）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认。
- **协作边界**：客户端未找到白板排除逻辑；白板是否计豪华由服务端判番决定，客户端按下发番型展示。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

## `FP-ST-C14-004` 清七对

- **主描述**：手里没有财神时的七对档位，含豪华、双豪华、三豪华，倍数为 4 / 8 / 16 / 32。
- **范围与边界**：只覆盖无财七对的成立条件与档位倍数；带财七对见上一功能点。
- **总体协作**：清七对四档在字效、名称、动画优先级上与带财七对分开维护。

### 原子项

#### `AT-ST-C14-012` 清七对为七对且手里没有财神

- **规则说明**：清七对同样是 7 对，但手里没有财神。
- **触发条件**：一手七对牌型不包含财神，七对成型且手里无财神。
- **配置影响**：清七对及三档豪华清七对的番型 ID 与名称；独立字效皮肤（qqd、hhqqd、2hhqqd、3hhqqd）。
- **客户端交互**：清七对四档各有独立字效皮肤（qqd、hhqqd、2hhqqd、3hhqqd）。
- **限制与禁止**：客户端不做手里没有财神的校验。
- **异常与边界**：没有财神这一条件只在注释中体现。
- **验收**：无财七对胡牌时显示清七对或豪华清七对名称并播放对应字效。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:41；source-code/client/Code/config/FanDefine.ts:87；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1151
- **服务端职责**：下发 MsgResultHu（fan_ids）。
- **客户端职责**：客户端定义清七对及三档豪华清七对的番型 ID 与名称，未见手里没有财神的判定。
- **协作边界**：客户端消费 fan_ids 映射名称与字效；无财神条件由服务端判定。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:41
- **原文摘录**：`/** 清七对（无财神），4x */`

#### `AT-ST-C14-013` 清七对档位倍数

- **规则说明**：清七对 / 豪华 / 双豪华 / 三豪华四档，倍数 4 / 8 / 16 / 32。
- **触发条件**：无财七对胡牌并命中豪华档位，四张实牌的组数越多档位越高。
- **配置影响**：四档清七对的 ID、名称与字效；倍数只写在注释里。
- **客户端交互**：清七对四档分别播不同字效，结算文案显示对应档位名称。
- **限制与禁止**：萧山倍率表对清七对给出的是另一套数值，不能当杭州证据；倍率不作为客户端计算依据。
- **异常与边界**：无。
- **验收**：清七对四档显示服务端倍数与对应档位名。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:41；source-code/client/Code/config/FanDefine.ts:47；source-code/client/Code/config/FanDefine.ts:89
- **服务端职责**：下发 MsgResultHu（fan_ids 与倍数点数）。
- **客户端职责**：四档清七对的 ID、名称与字效齐全；倍数值只写在注释里，展示取服务端倍数。
- **协作边界**：客户端消费 fan_ids 选档位与字效；档位与倍数由服务端计算。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:41
- **原文摘录**：`/** 清七对（无财神），4x */`

## `FP-ST-C14-005` 杠开

- **主描述**：自摸且杠链为 1 至 4 及以上的杠上开花、二连杠、三连杠、四连杠，倍数为 2 / 4 / 8 / 16。
- **范围与边界**：只覆盖杠开自身的成立条件与档位；杠开与财飘叠加时的杠飘/飘杠归入后续功能点。
- **总体协作**：客户端另有一处杠开提示检测，用于操作阶段的听牌提示，与结算番型判定相互独立。

### 原子项

#### `AT-ST-C14-014` 杠开须为自摸

- **规则说明**：杠开为自摸，且杠链为 1 / 2 / 3 / 4 及以上。
- **触发条件**：杠牌之后摸进一张能胡的牌，这次胡牌是自摸而不是点炮或抢杠。
- **配置影响**：杠开系番型 ID 与名称；杠开提示检测 GameData.checkCanGangBao。
- **客户端交互**：摸牌后若满足杠开条件给出杠开相关提示；胡牌按钮按自摸显示自摸动作而非胡。
- **限制与禁止**：杠开提示只覆盖手里正好有一组可杠的情形，判定口径比结算规则窄，提示不等于结算判定。
- **异常与边界**：提示条件为手牌张数模 3 余 2、存在听牌、手里恰有一组可杠牌。
- **验收**：自摸胡牌时展示自摸形态；杠开后满足提示条件时给出杠开提示。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:25；source-code/client/Code/data/GameData.ts:411；source-code/client/Code/data/GameData.ts:418；source-code/client/Code/layer/BoxHzmjTipAniView.ts:929
- **服务端职责**：下发 MsgResultHu（hu_type、fan_ids）、MsgPower（倍数点数）；杠链与自摸的结算判定在服务端。
- **客户端职责**：客户端有杠开提示检测：手牌张数模 3 余 2、存在听牌、手里恰有一组可杠牌时提示可杠开；结算时按是否自摸选择动作皮肤。
- **协作边界**：客户端本地仅做操作阶段杠开提示；杠链与自摸条件的结算判定在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:25
- **原文摘录**：`/** 杠上开花：杠牌后自摸，2x */`

#### `AT-ST-C14-015` 杠开档位对应杠链数量

- **规则说明**：杠开档位为杠上开花 / 二连杠 / 三连杠 / 四连杠，对应杠链 1 / 2 / 3 / 4 及以上。
- **触发条件**：杠开胡牌且连续开杠的次数不同，服务端返回的番型标明是第几连杠。
- **配置影响**：四个档位番型 ID 与名称；番型 ID 换算档位序号的函数（如 K_FTG_HZMJ_DOUBLE_KONG 返回 2）；字效皮肤 gk、2lgk、3lgk、4lgk。
- **客户端交互**：四个档位分别播 gk、2lgk、3lgk、4lgk 字效；组合成杠飘时按档位拼出杠飘（二连杠）这类文案。
- **限制与禁止**：杠链如何累计由服务端决定，客户端不做累计。
- **异常与边界**：无。
- **验收**：服务端下发不同杠链档位时，客户端正确显示杠上开花、二连杠、三连杠或四连杠名称与字效。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:28；source-code/client/Code/config/FanDefine.ts:296；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1135；source-code/client/Code/config/FanDefine.ts:80
- **服务端职责**：下发 MsgResultHu（fan_ids 含杠链档位）。
- **客户端职责**：客户端为杠链 1 至 4 分别定义四个番型 ID 与名称，并提供把番型 ID 换算成档位序号的函数，档位用于组合文案与字效选择。
- **协作边界**：客户端消费 fan_ids 换算档位做文案与字效；杠链计数与自摸条件在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:28
- **原文摘录**：`K_FTG_HZMJ_DOUBLE_KONG = 2407,`

#### `AT-ST-C14-016` 杠开档位倍数

- **规则说明**：杠上开花 / 二连杠 / 三连杠 / 四连杠的倍数为 2 / 4 / 8 / 16。
- **触发条件**：杠开胡牌并命中某一档连杠。
- **配置影响**：番型表注释标注四档倍数；实际展示取服务端点数。
- **客户端交互**：胡牌按钮与结算流水按服务端点数显示倍数。
- **限制与禁止**：四档倍数只存在于注释，客户端不参与计算。
- **异常与边界**：无。
- **验收**：四档杠开显示服务端对应倍数。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:26；source-code/client/Code/config/FanDefine.ts:31；source-code/client/Code/layer/BoxHzmjMainView.ts:666
- **服务端职责**：下发 MsgPower（hu_point）、MsgResultHu（结算点数）。
- **客户端职责**：番型表在注释中标注四档倍数；实际展示取服务端下发的点数。
- **协作边界**：客户端纯展示倍数；倍数由服务端计算下发。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:26
- **原文摘录**：`K_FTG_HZMJ_GANG_SHANG_HUA = 2406,`

## `FP-ST-C14-006` 爆头

- **主描述**：自摸且飘档为 0、单放与财神成将时的爆头，倍数 2；听任意牌时改看进张前是否敲响。
- **范围与边界**：只覆盖飘档为 0 的爆头；飘档 1 及以上归入财飘功能点。
- **总体协作**：爆头与七对叠加时客户端改称七客，与七对系共用一套组合表现。

### 原子项

#### `AT-ST-C14-017` 爆头成立条件

- **规则说明**：爆头为自摸、飘档为 0、单放与财神成将。
- **触发条件**：手里剩一张财神且其他牌已成四组面子，这次是自摸且本次没有飘。
- **配置影响**：爆头番型注释（自摸+财神对+无飘）；万能听标签 HuPaiBaoTips；财神将标志 CMF_JOKJINAG。
- **客户端交互**：万能听时在该张牌上显示爆的听牌标签，听牌面板对任意牌显示胡。
- **限制与禁止**：客户端没有飘档为 0 与单放与财神成将的成牌校验。
- **异常与边界**：万能听按任意牌（mah=255）识别。
- **验收**：万能听状态下该牌显示爆标签、听牌面板对任意牌显示胡；爆头番型名与字效以服务端下发为准。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:17；source-code/client/Code/config/BoxMahDefine.ts:883；source-code/client/Code/data/GameData.ts:1987；source-code/client/Code/config/GameDefine.ts:254
- **服务端职责**：下发 MsgResultHu（爆头番型判定）、MsgPower（倍数点数）、MsgWaitInfos（万能听听牌信息）。
- **客户端职责**：番型表把爆头描述为自摸加财神对且无飘；客户端另有万能听（任意牌）识别与财神将标志定义，但没有飘档与单放的结算判定。
- **协作边界**：客户端本地仅识别万能听并打标签；爆头成立判定在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:17
- **原文摘录**：`/** 爆头：自摸+财神对+无飘，2x */`

#### `AT-ST-C14-018` 爆头倍数

- **规则说明**：爆头倍数为 2。
- **触发条件**：爆头胡牌，命中爆头番型。
- **配置影响**：番型表标注爆头 2 倍；实际展示取服务端点数。
- **客户端交互**：胡牌按钮与结算流水显示服务端给的倍数。
- **限制与禁止**：倍数值只在注释中体现，不参与客户端计算。
- **异常与边界**：无。
- **验收**：爆头结算显示的倍数与服务端下发点数一致。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:17；source-code/client/Code/layer/BoxHzmjMainView.ts:666
- **服务端职责**：下发 MsgPower（hu_point）、MsgResultHu（结算点数）。
- **客户端职责**：番型表标注爆头 2 倍；实际展示取服务端点数。
- **协作边界**：客户端纯展示；爆头倍数由服务端下发。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:17
- **原文摘录**：`/** 爆头：自摸+财神对+无飘，2x */`

#### `AT-ST-C14-019` 听任意牌时改看进张前是否敲响

- **规则说明**：听任意牌时，改看进张前是否敲响。
- **触发条件**：打出一张牌后听任意牌，该次听牌可胡任意一张牌。
- **配置影响**：听牌类型枚举 TingType.TYPE_PIAO / TYPE_BAO；听牌面板对 mah=255（任意牌/爆头）的显示处理。
- **客户端交互**：打出某张牌后若构成万能听，在该牌上显示爆或飘的听牌标签；听牌面板对任意牌显示胡。
- **限制与禁止**：客户端没有敲响这一判定，无法证实需求语义。
- **异常与边界**：爆与飘的区分仅按打出的牌是否为财神（isJokerCard ? TYPE_PIAO : TYPE_BAO）。
- **验收**：万能听时对应牌显示爆/飘标签，听牌面板对任意牌显示胡；进张前是否敲响的口径待服务端确认。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:193；source-code/client/Code/layer/BoxHzmjTingPaiView.ts:41；source-code/client/Code/data/GameData.ts:1987
- **服务端职责**：下发 MsgWaitInfos（听牌信息，mah=255 表示任意牌/爆头）。
- **客户端职责**：客户端识别万能听（任意牌），但不是按敲响判断：打出财神且听任意牌标记为飘，其余万能听标记为爆；代码中未见敲响这一概念。
- **协作边界**：客户端消费 MsgWaitInfos 做万能听识别与标签；进张前是否敲响的判定口径未在客户端实现。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:193
- **原文摘录**：`Mah2DBase.setCardTing(item, true, isJokerCard ? TingType.TYPE_PIAO : TingType.TYPE_BAO);`

## `FP-ST-C14-007` 财飘

- **主描述**：自摸且飘档为 1 及以上、单放与财神成将时的财飘、双财飘、三财飘，倍数 4 / 8 / 16，3 档及以上统一算三财飘。
- **范围与边界**：只覆盖飘档 1 及以上的财飘档位；飘档 0 的爆头见上一功能点。
- **总体协作**：飘计数由服务端单独下发，客户端只做飘状态存储与飘动作表现，再按番型档位映射字效。

### 原子项

#### `AT-ST-C14-020` 财飘成立条件

- **规则说明**：财飘为自摸、飘档正好为 1 / 2 / 3 及以上，且单放与财神成将。
- **触发条件**：出牌阶段有一方打出财神，该次飘在胡牌前仍然有效。
- **配置影响**：财飘番型注释；飘状态存储 GameData.updatePiaoState；飘标签 HuPaiPiaoTips 与飘动作 TYPE_PIAO。
- **客户端交互**：有人飘时在该座位播 piao 动作字效；打出财神构成万能听时在牌上显示飘标签。
- **限制与禁止**：客户端只存飘计数并做表现，不判定财飘成立与自摸条件。
- **异常与边界**：客户端仅按服务端下发的飘计数更新各座位飘状态，不自行累计或清零。
- **验收**：打出财神时该座位播放飘动作；胡牌命中财飘时显示财飘类番型名。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:19；source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts:21；source-code/client/Code/config/BoxMahDefine.ts:885；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1680
- **服务端职责**：下发 MsgPiao（座位与飘计数）、MsgResultHu（财飘番型判定）。
- **客户端职责**：客户端接收飘计数消息并写入各座位飘状态，另把打出财神后听任意牌标为飘；番型表把财飘描述为自摸加财神对加飘档。
- **协作边界**：客户端消费 MsgPiao 存飘状态、消费 MsgResultHu 映射番型；飘档计算与财飘成立判定在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:19
- **原文摘录**：`/** 财飘：自摸+财神对+piao_level=1，4x */`

#### `AT-ST-C14-021` 财飘档位与3档以上归并

- **规则说明**：财飘 / 双财飘 / 三财飘三档，倍数 4 / 8 / 16；3 档及以上都是三财飘。
- **触发条件**：带飘胡牌，服务端判定本次飘档为 1、2 或 3 及以上。
- **配置影响**：三档财飘番型 ID 与名称；番型 ID 换算飘档序号的函数（K_FTG_HZMJ_SAN_CAI_PIAO 返回 3）；字效皮肤 cp、2cp、3cp。
- **客户端交互**：三档分别播 cp、2cp、3cp 字效，文案显示财飘、双财飘、三财飘。
- **限制与禁止**：飘档计数在服务端，客户端只做档位映射，不做计数。
- **异常与边界**：3 档及以上都是三财飘在客户端表现为只有一个三财飘档位（第 3 档作为封顶档），无更高档位。
- **验收**：飘档 1、2、3 及以上分别显示财飘、双财飘、三财飘并播放对应字效。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:23；source-code/client/Code/config/FanDefine.ts:311；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1129；source-code/client/Code/config/FanDefine.ts:78
- **服务端职责**：下发 MsgResultHu（fan_ids 含财飘档位；4/8/16 倍数由服务端给出）。
- **客户端职责**：客户端为三档财飘分别定义番型 ID 与名称，并提供把番型 ID 换算成飘档序号的函数，第 3 档作为封顶档使用。
- **协作边界**：客户端消费 fan_ids 映射档位名称与字效；飘档计数在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:23
- **原文摘录**：`/** 三财飘：piao_level>=3，16x */`

## `FP-ST-C14-008` 杠飘与飘杠

- **主描述**：同时命中杠上开花和财飘时去掉这两条，改记杠飘或飘杠，倍数 8，再乘基础番。
- **范围与边界**：只覆盖杠开与财飘叠加的组合档；杠爆（杠开加爆头）与七客不在本功能点范围内。
- **总体协作**：组合番在三类出口共用同一套解析：番型字效、番型音效、结算与桌面文案。

### 原子项

#### `AT-ST-C14-022` 杠开与财飘同时命中时合并为杠飘或飘杠

- **规则说明**：同时命中杠上开花和财飘时，去掉这两条，改记杠飘或飘杠。
- **触发条件**：一次胡牌同时是杠上开花又是财飘，服务端番型里同时含杠开与财飘，或直接下发组合番型。
- **配置影响**：组合番解析条件（hasGangPiaoCombo 或 hasGang && hasCaiPiao）；组合文案 FormatHzmjComboFanSides；字效皮肤 gp、pg。
- **客户端交互**：组合字效播 gp 或 pg；赢家流水文案与桌面结算文案写成杠飘或飘杠，不再并列显示杠上开花与财飘。
- **限制与禁止**：字效与文案中不得并列显示杠上开花与财飘两条拆分番型。
- **异常与边界**：服务端下发拆分的两条番型时（番型顺序不可靠），客户端一律默认叫杠飘，只有飘杠优先时才叫飘杠。
- **验收**：同时命中杠开与财飘时只显示杠飘或飘杠一条组合番型，不出现两条并列。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:257；source-code/client/Code/config/FanDefine.ts:365；source-code/client/Code/config/FanDefine.ts:368；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1101；source-code/client/Code/config/FanDefine.ts:52
- **服务端职责**：下发 MsgResultHu（fan_ids，含组合番型或杠开与财飘两条拆分番型）。
- **客户端职责**：客户端有组合解析：同时出现杠开系与财飘系，或直接收到杠飘、飘杠组合番型时，归并为杠飘或飘杠，文案只写组合名并附非 1 档的明细。
- **协作边界**：客户端消费 fan_ids 合并展示；是否去掉这两条取决于服务端下发的番型组合，客户端只能按收到的番型合并展示。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:257
- **原文摘录**：`if (hasGangPiaoCombo || (hasGang && hasCaiPiao)) {`

#### `AT-ST-C14-023` 杠飘组合倍数为8并再乘基础番

- **规则说明**：杠飘或飘杠倍数 8，再乘基础番；平胡加这一档是 8 倍，七对加这一档是 16 倍。
- **触发条件**：杠开与财飘叠加胡牌，命中杠飘或飘杠组合。
- **配置影响**：番型表注释标注杠飘与飘杠均为 8 倍并附组合文案示例（二连杠+双财飘 → 杠飘（二连杠，双财飘））。
- **客户端交互**：胡牌按钮与结算流水按服务端点数显示倍数，桌面文案显示杠飘（二连杠，双财飘）这类组合明细。
- **限制与禁止**：客户端不做 8 乘基础番的运算。
- **异常与边界**：组合文案中 1 档的杠开或财飘不附明细（gangLv > 1 / piaoLv > 1 才写明细）。
- **验收**：组合番型显示的倍数与服务端点数一致；平胡底为 8 倍、七对底为 16 倍由服务端点数体现。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:52；source-code/client/Code/config/FanDefine.ts:351；source-code/client/Code/config/FanDefine.ts:389；source-code/client/Code/layer/BoxHzmjMainView.ts:666
- **服务端职责**：下发 MsgPower（hu_point）、MsgResultHu（结算点数）；组合倍数与基础番连乘由服务端计算。
- **客户端职责**：番型表标注杠飘与飘杠均为 8 倍，并附组合文案示例；最终倍数取服务端下发的总点数，客户端不做 8 乘基础番的运算。
- **协作边界**：客户端消费 MsgPower、MsgResultHu 的点数做组合文案与倍数展示；连乘计算在服务端。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:52
- **原文摘录**：`/** 杠飘：先杠后飘（杠开后打出财神并下一轮自摸），8x */`

## `FP-ST-C14-009` 十风

- **主描述**：从第一张出牌起连续打字牌的独占番型：10 张为 2 倍，每多一张再乘 2；中途打非字牌或吃碰杠则作废；满 10 张后任意自摸都能胡，不与其它番型相乘。
- **范围与边界**：只覆盖十风自身的累计、作废、成胡与倍率；不含十风与其它番型叠加的异常口径。
- **总体协作**：客户端把十风当独占番型处理，并针对十风亮牌走牌河、胡牌明细不能当剩余手牌用做了专门注释。

### 原子项

#### `AT-ST-C14-024` 从第一张出牌起连续打字牌

- **规则说明**：十风的累计口径为：从本局第一张出牌起，连续打出字牌。
- **触发条件**：玩家在本局出牌阶段从第一张出牌起打出字牌时开始累计。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：累计起点限定为本局第一张出牌，不能从中途某张字牌开始起算。
- **异常与边界**：无。
- **验收**：客户端无可验收实现（累计逻辑无证据）；从第一张出牌起的字牌累计口径需服务端联调确认（待确认）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）。
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认。
- **协作边界**：仓库内仅见十风番型 ID、名称与字效皮肤，字牌判定函数存在但全仓无调用点；从第一张出牌起的累计口径应在服务端（未还原），客户端无累计实现。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C14-025` 十风中途作废不可重算

- **规则说明**：十风累计期间，中途打出非字牌，或发生吃、碰、杠，本局十风作废，且不能再重新累计。
- **触发条件**：十风累计过程中打出非字牌，或进行吃、碰、杠操作。
- **配置影响**：本原子项无独立配置。
- **客户端交互**：客户端代码未找到对应实现（待确认）。
- **限制与禁止**：作废后不能再重新累计；吃、碰、杠均打断累计。
- **异常与边界**：无。
- **验收**：客户端无作废逻辑与提示文案证据，无可验收实现；作废与不可重算需服务端联调验证（待确认）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）。
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原。
- **客户端职责**：待确认。
- **协作边界**：作废与不可重算判定未见客户端实现，也未见相关提示文案；口径应由服务端保证（未还原）。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C14-026` 满10张后任意自摸都能胡

- **规则说明**：十风累计满 10 张字牌后，任意牌自摸即可胡，不要求手牌成牌型。
- **触发条件**：连续打出 10 张以上字牌且累计未被打断后自摸。
- **配置影响**：FanDefine 番型表登记十风为独占番型并注释倍数口径；十风字效走番型到皮肤映射（sf）。
- **客户端交互**：十风胡牌时播放专属番型字效（sf），结算亮牌按十风特例处理：亮牌走牌河，胡牌明细里的手牌与组合不能当剩余手牌使用。
- **限制与禁止**：自摸胡牌不要求成牌；十风亮牌明细不能当剩余手牌使用。
- **异常与边界**："任意自摸都能胡、不要求成牌"不可由客户端证实，免成牌判胡与任意自摸条件在服务端；客户端只有十风番型识别与亮牌特例处理。
- **验收**：十风自摸胡牌时播放 sf 专属字效并按十风特例亮牌；免成牌与任意自摸条件由服务端 MsgResultHu 判番结果保证。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:49；source-code/client/Code/config/FanDefine.ts:176；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1160。
- **服务端职责**：下发 MsgResultHu（胡牌结算结果，含十风番型判定；免成牌判胡与任意自摸条件由服务端保证）。
- **客户端职责**：客户端把十风当独占番型识别，并在代码注释中说明十风亮牌走牌河、胡牌明细里的手牌与组合不能当剩余手牌使用；未见"不要求成牌"的判定。
- **协作边界**：客户端消费 MsgResultHu 的番型结果做字效与亮牌表现；十风成立判定与免成牌口径在服务端，客户端不判定。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:49
- **原文摘录**：`/** 十风（独占番型）：连续打出≥10张字牌后自摸，2x（11张=4x，12张=8x…） */`

#### `AT-ST-C14-027` 十风只记自身不与其它番型相乘

- **规则说明**：十风成立时只记十风一档，不与平胡、杠开、财飘、七对等其它番型相乘叠加。
- **触发条件**：十风成立并自摸胡牌，本次胡牌被判定为十风。
- **配置影响**：杭州侧 FanDefine 注释声明十风为独占番型；萧山侧独占番名单（XsmjFanConfig）列入十风，独占番直接按服务端单条结果展示。
- **客户端交互**：十风单独播一段字效，不与其它番型拼组合文案；结算按独占番单条结果展示。
- **限制与禁止**：不与平胡、杠开、财飘、七对相乘；客户端不做叠加拆分。
- **异常与边界**：独占番名单挂在萧山配置里，杭州侧只有注释声明独占；是否真的不与其它番型相乘由服务端保证，萧山配置不可当作杭州证据。
- **验收**：十风胡牌结算只展示十风单条番型，不出现平胡或七对叠加文案；字效只播十风一段。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:49；source-code/client/Code/config/XsmjFanConfig.ts:36；source-code/client/Code/config/XsmjFanConfig.ts:38。
- **服务端职责**：下发 MsgResultHu（胡牌结算结果；是否剔除其它番型由服务端番型列表决定）。
- **客户端职责**：客户端把十风标注为独占番型，并在萧山侧的独占番名单中列入十风，独占番直接按服务端单条结果展示，不做叠加拆分。
- **协作边界**：客户端按服务端番型结果单条展示十风、不拆组合；是否剔除其它番型由服务端番型列表决定，客户端无剔除逻辑。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:49
- **原文摘录**：`/** 十风（独占番型）：连续打出≥10张字牌后自摸，2x（11张=4x，12张=8x…） */`

#### `AT-ST-C14-028` 十风倍率递增

- **规则说明**：十风倍率按连续字牌张数递增：10 张为 2 倍，每多 1 张再乘 2。
- **触发条件**：十风胡牌且连续字牌张数超过 10 张。
- **配置影响**：FanDefine 注释记录十风 2 倍起、每多一张翻倍的口径；萧山倍率表（XsmjFanConfig）把十风记为 4，仅在萧山玩法生效。
- **客户端交互**：胡牌按钮倍数文本直接显示服务端 hu_point（文本为 hu_point + "倍"），结算流水显示服务端给的倍数；客户端不做倍数计算。
- **限制与禁止**：客户端不计算十风倍数；萧山倍率表不可当作杭州倍率证据。
- **异常与边界**：唯一带具体数值的倍率表是萧山表，把十风记为 4，与杭州 2 倍起步口径不同；该表仅在萧山玩法生效，杭州倍率取服务端，不能据此判杭州实现有误。
- **验收**：十风胡牌时胡牌按钮显示服务端 hu_point 倍数、结算流水显示服务端点数；每多一张字牌倍数翻倍的口径由服务端点数体现。
- **职责域**：client
- **职责依据**：source-code/client/Code/config/FanDefine.ts:49；source-code/client/Code/config/XsmjFanConfig.ts:23；source-code/client/Code/layer/BoxHzmjMainView.ts:666。
- **服务端职责**：下发 MsgPower（胡牌倍数 hu_point）与 MsgResultHu（结算番型与点数），倍率递增由服务端计算。
- **客户端职责**：番型表注释记录十风 2 倍起、每多一张翻倍的口径；客户端不计算，展示取服务端点数。
- **协作边界**：客户端消费 MsgPower 的 hu_point 与 MsgResultHu 的点数做倍数展示；倍率递增计算在服务端，客户端仅注释记录口径。
- **来源文件**：`source-code/client/Code/config/FanDefine.ts`
- **来源定位**：source-code/client/Code/config/FanDefine.ts:49
- **原文摘录**：`/** 十风（独占番型）：连续打出≥10张字牌后自摸，2x（11张=4x，12张=8x…） */`

## `FP-ST-C14-010` 财神牌面表现

- **主描述**：财神牌面染红、可点击、没有角标；打出后牌河仍是原牌面，只保留这层红色。
- **范围与边界**：只覆盖财神在手牌、牌河、副露、胡牌列表中的颜色与角标表现，不含财神能否打出与禁手规则。
- **总体协作**：财神染色是全牌桌共用的牌值映射，任何一处牌列表展示都会复用同一条染色链路。

### 原子项

#### `AT-ST-C14-029` 财神牌面染红可点击无角标

- **规则说明**：财神牌面染红，保持可点击，牌上不显示角标。
- **触发条件**：本局确定财神牌后展示手牌，某张牌的值等于本局财神牌值。
- **配置影响**：财神色 #ffc4c4 为全局配置（GameData，灰优先于红，可点击、无角标）。
- **客户端交互**：手牌刷新时把财神牌值交给牌组件刷成红色，同时清空癞子标记与角标标记；手牌中的财神显示为红色牌面、没有角标，未被禁打的财神仍可点击出牌。
- **限制与禁止**：染色流程不改动牌的可点性；"可点击"最终受服务端禁打数据约束，客户端没有对财神单独放行。
- **异常与边界**：财飘回合等场景服务端会禁打部分牌，此时财神不可点击属禁打数据约束，非染色逻辑行为。
- **验收**：手牌中的财神牌面为红色（#ffc4c4）、无角标、无癞子标记；未被禁打时可正常点击出牌。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/GameData.ts:52；source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:68；source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:70；source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:73；source-code/client/Code/util/BoxHzmjMahColorUtil.ts:29。
- **服务端职责**：下发 MsgJoker（本局财神牌值）与 MsgPlayLmts（禁打牌数据，约束牌的可点击性）。
- **客户端职责**：客户端按本局财神牌值维护全局染色映射，手牌刷新时把财神牌值交给牌组件染色，同时清空癞子标记与角标标记，牌的可点性由禁打数据单独维护、不被染色流程改动。
- **协作边界**：客户端消费 MsgJoker 建立财神染色映射、消费 MsgPlayLmts 维护可点性；染红与清角标为本地渲染逻辑，无服务端计算。
- **来源文件**：`source-code/client/Code/data/GameData.ts`
- **来源定位**：source-code/client/Code/data/GameData.ts:52
- **原文摘录**：`/** 财神色 #ffc4c4（灰优先于红，可点击、无角标） */`

#### `AT-ST-C14-030` 打出的财神在牌河保留原牌面只留红色

- **规则说明**：财神被打出后，牌河中仍显示原牌面，仅保留红色染色这一层表现。
- **触发条件**：有一方打出牌且打出的牌值等于本局财神牌值。
- **配置影响**：染色复用全局财神牌值映射链路（红色染色），本原子项无独立配置。
- **客户端交互**：出牌后刷新对应座位牌河时，把牌河、胡牌列表、副露整体重刷一遍财神色；牌河里打出的财神显示原白板牌面、仅叠加一层红色；同牌处于高亮状态时不覆盖高亮色。
- **限制与禁止**：染色只改颜色标记，不改牌面资源；不覆盖同牌高亮色。
- **异常与边界**：染色逻辑在同牌高亮（绿/蓝）时会让位，需求只约束牌面与红色，不涉及高亮优先级。
- **验收**：打出的财神在牌河中原牌面不变、仅颜色为红色；同牌高亮态优先于红染时不破坏高亮表现。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:1093；source-code/client/Code/layer/BoxHzmjMah2DView.ts:1130；source-code/client/Code/util/BoxHzmjMahColorUtil.ts:51；source-code/client/Code/util/BoxHzmjMahColorUtil.ts:29。
- **服务端职责**：下发 MsgPlayS（出牌同步消息，驱动牌河刷新与重染色）。
- **客户端职责**：出牌后刷新对应座位牌河时，重新把牌河、胡牌列表、副露整体刷一遍财神色；染色只改颜色标记，不改牌面资源。
- **协作边界**：客户端消费 MsgPlayS 更新牌河数据后本地重刷财神色；牌面保留原资源为本地渲染逻辑，无服务端计算。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMah2DView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:1093
- **原文摘录**：`this.outs[localSeat].resetCards(cards);`
