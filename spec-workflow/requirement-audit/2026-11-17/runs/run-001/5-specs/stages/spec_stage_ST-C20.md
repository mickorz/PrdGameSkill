# ST-C20 番型

## 阶段概述

本阶段负责好友房胡牌结算中「番型」的技术落地规格——判定顺序、番型三组划分、组内取最高档与组间连乘的总框架，基础组（平胡与七对系列）、杠开组、财神组（爆头与财飘）、杠飘与飘杠改记、十风，以及财神牌面染红表现，共 23 个需求原子。

- 原子总数：23（分布于 7 个功能点）
- L7 分布：verified 0 / verification_required 23 / decision_required 0 / not_applicable 0
- 分析路径：本阶段全部原子 analysisPath=full，无 blocked、无 conflict-fast，无历史基线升级候选（candidateDifference 均为空）
- 复核状态：difference-review.json 中无 ST-C20 条目，本阶段无复核建议
- 输入来源：feature_index.json（7 个功能点）、business-behavior.json、difference-review.json、l7-classify.json、client-evidence.json / server-evidence.json、pending-list.md

L7 口径说明：本阶段 23 个原子 l7 全部为 verification_required，l7Basis 均为 proposed（待审批），scope 全部为 unknown（scopeSource=default-unknown）。同时须注意，本阶段**双端均无实现证据**：23 个原子全部落在 client-evidence.json 的 coverage.pendingAtomIds 中（客户端查证未完成，执行状态 pending），server-evidence.json 中不存在任何 claimKey 属于 ST-C20 的证据（服务端查证未完成，执行状态 pending）。因此全部原子 difference=unverified，属于「既不能证实符合、也不能证伪」的证据空白状态，差异未判定，本阶段不产出任何具体实现差异结论。

功能点与原子映射：

| 功能点 | 名称 | 原子 | 原子数 |
|---|---|---|---|
| FP-ST-C20-001 | 番型分组与计算框架 | AT-ST-C20-001 ~ 005 | 5 |
| FP-ST-C20-002 | 基础组：平胡与七对系列 | AT-ST-C20-006 ~ 010 | 5 |
| FP-ST-C20-003 | 杠开组 | AT-ST-C20-011 | 1 |
| FP-ST-C20-004 | 财神组：爆头与财飘 | AT-ST-C20-012 ~ 015 | 4 |
| FP-ST-C20-005 | 杠飘与飘杠改记 | AT-ST-C20-016 ~ 017 | 2 |
| FP-ST-C20-006 | 十风 | AT-ST-C20-018 ~ 021 | 4 |
| FP-ST-C20-007 | 财神牌面表现 | AT-ST-C20-022 ~ 023 | 2 |

## 需求条目

### AT-ST-C20-001 判定顺序：先牌型后胡牌方式

- **需求规则**：先确认牌型，再确认这次是自摸、点炮胡还是抢杠胡（需求第 261 行）。
- **验证范围**：server
- **客户端职责**：clientVerification.verdict 为空（无 verdict、无 evidenceIds）。**查证未完成**（客户端执行状态 pending，原子列于 client-evidence.json 的 pendingAtomIds），无实现要点可陈述、无证据定位。
- **服务端职责**：serverVerification.applicability 为空（无 evidenceIds、configCondition 为空）。**查证未完成**（服务端执行状态 pending，server-evidence.json 中无对应证据），规则说明与配置生效条件均无据可述、无证据定位。
- **双端协作**：collaboration（推导链路）：玩家胡牌 → 服务端先定牌型再定胡牌方式 → 结算下发 → 客户端按「先牌型、后胡牌方式」的顺序展示。该链路为本阶段应实现的协作口径，尚未取得任一端实现证据。
- **业务行为**：
  - trigger：玩家胡牌并进入番型结算
  - condition：玩家已经胡牌
  - action：客户端在结算里先呈现牌型名称，再呈现本次胡牌方式（自摸 / 点炮胡 / 抢杠胡）；服务端先判定这次成的是什么牌型，再判定本次是自摸、点炮胡还是抢杠胡，并把两部分结果一起下发
  - result：玩家先看到牌型，再看到对应的自摸 / 点炮胡 / 抢杠胡标注
- **实际实现差异**：difference=unverified。baselineDetail：本轮服务端未检索到相关实现证据（服务端 applicability 为空、无 evidenceIds），客户端同样没有 verdict 与证据，既无法证实已按需求实现，也无法证实实现与需求矛盾，证据不足故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。差异未判定，需补证双端。

---

### AT-ST-C20-002 番型三组划分

- **需求规则**：番型分三组（需求第 261 行）。
- **验证范围**：server
- **客户端职责**：verdict 为空（无 evidenceIds）。**查证未完成**（客户端执行状态 pending），无实现要点与证据定位。
- **服务端职责**：applicability 为空（无 evidenceIds、configCondition 为空）。**查证未完成**（服务端执行状态 pending），三组的具体归属与判定入口无据可述。
- **双端协作**：玩家胡牌 → 服务端按三组归类计算番型 → 结算下发 → 客户端按三组展示。
- **业务行为**：
  - trigger：玩家胡牌并进入番型结算
  - condition：玩家已经胡牌
  - action：客户端按三组结构呈现命中的番型，不混成一条清单；服务端把番型拆成三组分别判定与记录，再一并下发
  - result：玩家看到自己的番型被分成三组呈现
- **实际实现差异**：difference=unverified。baselineDetail：本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端同样没有 verdict 与证据，既无法证实也无法证伪，故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。

---

### AT-ST-C20-003 组内取最高档

- **需求规则**：组内只取最高一档（需求第 261 行）。
- **验证范围**：server
- **客户端职责**：verdict 为空（无 evidenceIds）。**查证未完成**（客户端执行状态 pending）。
- **服务端职责**：applicability 为空（无 evidenceIds、configCondition 为空）。**查证未完成**（服务端执行状态 pending），组内比较与保留逻辑无据可述。
- **双端协作**：玩家胡牌 → 服务端在每组内取最高档 → 结算下发 → 客户端每组只显示一档。
- **业务行为**：
  - trigger：玩家胡牌并进入番型结算
  - condition：同一组内命中多个番型档位
  - action：客户端只呈现该组最终保留的最高一档，不并列显示被覆盖的低档；服务端在同一组内比较各命中档位，只保留最高一档参与结算
  - result：玩家看到同一组只计最高一档，低档不重复计入
- **实际实现差异**：difference=unverified。baselineDetail：本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端同样没有 verdict 与证据，证据不足故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。

---

### AT-ST-C20-004 组间连乘

- **需求规则**：组间连乘（需求第 261 行）。
- **验证范围**：server
- **客户端职责**：verdict 为空（无 evidenceIds）。**查证未完成**（客户端执行状态 pending）。
- **服务端职责**：applicability 为空（无 evidenceIds、configCondition 为空）。**查证未完成**（服务端执行状态 pending），总倍数计算逻辑无据可述。
- **双端协作**：玩家胡牌 → 服务端各组取最高档后组间相乘 → 下发总倍数 → 客户端展示连乘结果。
- **业务行为**：
  - trigger：玩家胡牌并进入番型结算
  - condition：多个番型组同时命中
  - action：客户端按服务端下发的结果展示各组倍数与最终总倍数；服务端把各组取得的最高档倍数相乘得到总倍数
  - result：玩家看到结算总倍数是各组倍数连乘的结果
- **实际实现差异**：difference=unverified。baselineDetail：本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端同样没有 verdict 与证据，证据不足故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。

---

### AT-ST-C20-005 点炮与抢杠胡排除特定番型

- **需求规则**：点炮和抢杠不算爆头、财飘、杠开、十风（需求第 261 行）。
- **验证范围**：server
- **客户端职责**：verdict 为空（无 evidenceIds）。**查证未完成**（客户端执行状态 pending）。
- **服务端职责**：applicability 为空（无 evidenceIds、configCondition 为空）。**查证未完成**（服务端执行状态 pending），胡牌方式与番型排除的耦合点无据可述。
- **双端协作**：玩家点炮胡或抢杠胡 → 服务端跳过这四类番型判定 → 结算下发 → 客户端只显示允许的番型。
- **业务行为**：
  - trigger：玩家以点炮胡或抢杠胡方式胡牌
  - condition：胡牌方式为点炮胡或抢杠胡
  - action：客户端在结算里不出现爆头、财飘、杠开、十风这几类番型；服务端在点炮胡、抢杠胡的判定里排除爆头、财飘、杠开、十风，不把它们计入番型
  - result：玩家看到点炮胡 / 抢杠胡的结算中没有爆头、财飘、杠开、十风
- **实际实现差异**：difference=unverified。baselineDetail：本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端同样没有 verdict 与证据，证据不足故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。

---

### AT-ST-C20-006 平胡成立条件与倍数

- **需求规则**：平胡，倍数 1，4 组面子加 1 对（需求第 265 行）。
- **验证范围**：server
- **客户端职责**：verdict 为空（无 evidenceIds）。**查证未完成**（客户端执行状态 pending）。
- **服务端职责**：applicability 为空（无 evidenceIds、configCondition 为空）。**查证未完成**（服务端执行状态 pending），牌型识别入口与倍数下发无据可述。
- **双端协作**：玩家胡牌 → 服务端识别为 4 组面子加 1 对 → 记为平胡 1 倍 → 客户端展示。
- **业务行为**：
  - trigger：玩家胡牌时进行牌型判定
  - condition：手牌为 4 组面子加 1 对
  - action：客户端在结算里显示牌型为平胡、倍数 1；服务端判定该手牌为平胡并按 1 倍计入基础番
  - result：玩家看到牌型为平胡，倍数为 1
- **实际实现差异**：difference=unverified。baselineDetail：本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端同样没有 verdict 与证据，证据不足故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。

---

### AT-ST-C20-007 平胡财神可参与面子或对子

- **需求规则**：平胡中财神可参与面子或对子（需求第 265 行）。
- **验证范围**：server
- **客户端职责**：verdict 为空（无 evidenceIds）。**查证未完成**（客户端执行状态 pending）。
- **服务端职责**：applicability 为空（无 evidenceIds、configCondition 为空）。**查证未完成**（服务端执行状态 pending），财神替代参与成牌的处理无据可述。
- **双端协作**：玩家以含财神的手牌胡牌 → 服务端把财神当作补位牌组成面子或对子 → 判为平胡 → 客户端展示。
- **业务行为**：
  - trigger：玩家胡牌时进行牌型判定
  - condition：手牌需要靠财神补足面子或对子
  - action：客户端在结算里按平胡呈现该牌型，不因含财神而排除；服务端允许财神替代任意牌补足面子或对子，从而成立平胡
  - result：玩家看到带财神的牌型同样被判定为平胡
- **实际实现差异**：difference=unverified。baselineDetail：本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端同样没有 verdict 与证据，证据不足故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。

---

### AT-ST-C20-008 七对系列成立条件与倍数

- **需求规则**：七对 / 豪华 / 双豪华 / 三豪华，倍数 2 / 4 / 8 / 16，14 张组成 7 对，且手里至少有 1 张财神（需求第 266 行）。
- **验证范围**：server
- **客户端职责**：verdict 为空（无 evidenceIds）。**查证未完成**（客户端执行状态 pending）。
- **服务端职责**：applicability 为空（无 evidenceIds、configCondition 为空）。**查证未完成**（服务端执行状态 pending），七对判定与豪华档位选取无据可述。
- **双端协作**：玩家以 7 对含财神胡牌 → 服务端数豪华组数并选档 → 下发牌型与倍数 → 客户端展示。
- **业务行为**：
  - trigger：玩家胡牌时进行牌型判定
  - condition：14 张组成 7 对且手里至少有 1 张财神
  - action：客户端显示牌型为七对 / 豪华七对 / 双豪华七对 / 三豪华七对，并显示对应倍数；服务端按 7 对成立且至少 1 张财神判为七对系列，按豪华组数分别记 2 / 4 / 8 / 16 倍
  - result：玩家看到七对系列牌型名称与 2 / 4 / 8 / 16 中对应的一档倍数
- **实际实现差异**：difference=unverified。baselineDetail：本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端同样没有 verdict 与证据，证据不足故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。

---

### AT-ST-C20-009 豪华组数计数规则

- **需求规则**：某种非财神牌面有 4 张实牌，计 1 组豪华。白板不计豪华（需求第 266 行）。
- **验证范围**：server
- **客户端职责**：verdict 为空（无 evidenceIds）。**查证未完成**（客户端执行状态 pending）。
- **服务端职责**：applicability 为空（无 evidenceIds、configCondition 为空）。**查证未完成**（服务端执行状态 pending），豪华组数统计与白板排除逻辑无据可述。
- **双端协作**：玩家以七对胡牌 → 服务端逐个牌面统计 4 张实牌、跳过白板 → 得出豪华组数 → 客户端展示。
- **业务行为**：
  - trigger：玩家以七对胡牌
  - condition：某种非财神牌面在手中有 4 张实牌
  - action：客户端显示的牌型名称反映实际的豪华组数；服务端按每个非财神牌面的 4 张实牌计 1 组豪华，白板不计豪华
  - result：玩家看到的豪华组数与手中非财神牌面的 4 张实牌数量一致，白板不额外加组
- **实际实现差异**：difference=unverified。baselineDetail：本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端同样没有 verdict 与证据，证据不足故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。

---

### AT-ST-C20-010 清七对系列成立条件与倍数

- **需求规则**：清七对 / 豪华 / 双豪华 / 三豪华，倍数 4 / 8 / 16 / 32，同样是 7 对，但手里没有财神（需求第 267 行）。
- **验证范围**：server
- **客户端职责**：verdict 为空（无 evidenceIds）。**查证未完成**（客户端执行状态 pending）。
- **服务端职责**：applicability 为空（无 evidenceIds、configCondition 为空）。**查证未完成**（服务端执行状态 pending），无财神校验与高档倍数选取无据可述。
- **双端协作**：玩家以无财神的 7 对胡牌 → 服务端确认无财神并数豪华组数 → 下发牌型与倍数 → 客户端展示。
- **业务行为**：
  - trigger：玩家胡牌时进行牌型判定
  - condition：14 张组成 7 对且手里没有财神
  - action：客户端显示牌型为清七对 / 清豪华七对 / 清双豪华七对 / 清三豪华七对，并显示对应倍数；服务端在没有任何财神的前提下按 7 对成立判为清七对系列，按豪华组数记 4 / 8 / 16 / 32 倍
  - result：玩家看到清七对系列牌型名称与 4 / 8 / 16 / 32 中对应的一档倍数
- **实际实现差异**：difference=unverified。baselineDetail：本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端同样没有 verdict 与证据，证据不足故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。

---

### AT-ST-C20-011 杠上开花与连杠倍数

- **需求规则**：杠上开花 / 二连杠 / 三连杠 / 四连杠，倍数 2 / 4 / 8 / 16，条件为自摸，杠链为 1 / 2 / 3 / 4 及以上（需求第 268 行）。
- **验证范围**：server
- **客户端职责**：verdict 为空（无 evidenceIds）。**查证未完成**（客户端执行状态 pending）。
- **服务端职责**：applicability 为空（无 evidenceIds、configCondition 为空）。**查证未完成**（服务端执行状态 pending），杠链计数与档位映射无据可述。
- **双端协作**：玩家杠牌后自摸 → 服务端统计连续杠的条数并选档 → 结算下发 → 客户端展示对应杠开牌型与倍数。
- **业务行为**：
  - trigger：玩家杠后自摸胡牌
  - condition：胡牌方式为自摸且杠链为 1 / 2 / 3 / 4 及以上
  - action：客户端显示杠上开花、二连杠、三连杠或四连杠，并显示对应倍数；服务端按自摸时的杠链条数选择档位，分别记 2 / 4 / 8 / 16 倍
  - result：玩家看到杠上开花 / 二连杠 / 三连杠 / 四连杠之一及 2 / 4 / 8 / 16 中对应倍数
- **实际实现差异**：difference=unverified。baselineDetail：本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端同样没有 verdict 与证据，证据不足故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。

---

### AT-ST-C20-012 爆头成立条件与倍数

- **需求规则**：爆头，倍数 2，条件为自摸、飘档为 0、单放与财神成将（需求第 269 行）。
- **验证范围**：server
- **客户端职责**：verdict 为空（无 evidenceIds）。**查证未完成**（客户端执行状态 pending）。
- **服务端职责**：applicability 为空（无 evidenceIds、configCondition 为空）。**查证未完成**（服务端执行状态 pending），飘档统计与「单放与财神成将」判定无据可述。
- **双端协作**：玩家自摸 → 服务端检查飘档与将牌结构 → 成立则记爆头 2 倍 → 客户端展示。
- **业务行为**：
  - trigger：玩家自摸胡牌
  - condition：飘档为 0 且单放与财神成将
  - action：客户端显示牌型为爆头、倍数 2；服务端在飘档为 0 且单放与财神成将时判为爆头并记 2 倍
  - result：玩家看到牌型为爆头、倍数为 2
- **实际实现差异**：difference=unverified。baselineDetail：本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端同样没有 verdict 与证据，证据不足故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。

---

### AT-ST-C20-013 爆头听任意牌改看敲响

- **需求规则**：听任意牌时，改看进张前是否敲响（需求第 269 行）。
- **验证范围**：server
- **客户端职责**：verdict 为空（无 evidenceIds）。**查证未完成**（客户端执行状态 pending）。
- **服务端职责**：applicability 为空（无 evidenceIds、configCondition 为空）。**查证未完成**（服务端执行状态 pending），听任意牌识别与「进张前是否敲响」回溯逻辑无据可述。
- **双端协作**：玩家听任意牌后胡牌 → 服务端回看进张前是否已敲响 → 判定爆头并下发 → 客户端展示。
- **业务行为**：
  - trigger：玩家处于听任意牌状态并胡牌
  - condition：玩家听任意牌
  - action：客户端按服务端下发的爆头结论展示，不自行换算；服务端在听任意牌时改以进张前是否敲响来判断爆头，不再沿用普通爆头条件
  - result：玩家看到听任意牌时的爆头结论依据进张前是否敲响给出
- **实际实现差异**：difference=unverified。baselineDetail：本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端同样没有 verdict 与证据，证据不足故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。

---

### AT-ST-C20-014 财飘系列成立条件与倍数

- **需求规则**：财飘 / 双财飘 / 三财飘，倍数 4 / 8 / 16，条件为自摸、飘档正好为 1 / 2 / 3 及以上，且单放与财神成将（需求第 270 行）。
- **验证范围**：server
- **客户端职责**：verdict 为空（无 evidenceIds）。**查证未完成**（客户端执行状态 pending）。
- **服务端职责**：applicability 为空（无 evidenceIds、configCondition 为空）。**查证未完成**（服务端执行状态 pending），飘档档位命名与倍数映射无据可述。
- **双端协作**：玩家自摸 → 服务端检查飘档与将牌结构 → 按档位命名并选倍数 → 客户端展示。
- **业务行为**：
  - trigger：玩家自摸胡牌
  - condition：飘档正好为 1 / 2 / 3 及以上且单放与财神成将
  - action：客户端显示财飘 / 双财飘 / 三财飘，并显示对应倍数；服务端按飘档档位分别判为财飘、双财飘、三财飘，记 4 / 8 / 16 倍
  - result：玩家看到财飘 / 双财飘 / 三财飘之一及 4 / 8 / 16 中对应倍数
- **实际实现差异**：difference=unverified。baselineDetail：本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端同样没有 verdict 与证据，证据不足故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。

---

### AT-ST-C20-015 三档及以上归为三财飘

- **需求规则**：3 档及以上都是三财飘（需求第 270 行）。
- **验证范围**：server
- **客户端职责**：verdict 为空（无 evidenceIds）。**查证未完成**（客户端执行状态 pending）。
- **服务端职责**：applicability 为空（无 evidenceIds、configCondition 为空）。**查证未完成**（服务端执行状态 pending），档位归并（封顶为三财飘）逻辑无据可述。
- **双端协作**：玩家自摸且飘档达 3 档以上 → 服务端归并为三财飘 → 结算下发 → 客户端展示三财飘。
- **业务行为**：
  - trigger：玩家自摸胡牌且飘档达到 3 档及以上
  - condition：飘档为 3 档或更高
  - action：客户端统一显示为三财飘，不再出现第四档以上的名称；服务端把 3 档及以上的飘档统一按三财飘处理
  - result：玩家看到飘档 3 档及以上都显示为三财飘
- **实际实现差异**：difference=unverified。baselineDetail：本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端同样没有 verdict 与证据，证据不足故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。

---

### AT-ST-C20-016 杠飘与飘杠改记及倍数

- **需求规则**：同时命中杠上开花和财飘时，去掉这两条，改记杠飘或飘杠，倍数 8，再乘基础番（需求第 272 行）。
- **验证范围**：server
- **客户端职责**：verdict 为空（无 evidenceIds）。**查证未完成**（客户端执行状态 pending）。
- **服务端职责**：applicability 为空（无 evidenceIds、configCondition 为空）。**查证未完成**（服务端执行状态 pending），组合识别、改记规则与「先定 8 倍再乘基础番」的运算顺序无据可述。
- **双端协作**：玩家同时杠上开花与财飘 → 服务端合并为杠飘 / 飘杠并乘基础番 → 下发 → 客户端展示合并后的番型。
- **业务行为**：
  - trigger：玩家胡牌结算时同时命中杠上开花和财飘
  - condition：杠上开花与财飘同时成立
  - action：客户端结算中不单列杠上开花与财飘两条，而是显示杠飘或飘杠；服务端去掉杠上开花与财飘两条，改记杠飘或飘杠，记 8 倍后再乘基础番
  - result：玩家看到结算中是杠飘或飘杠且已乘上基础番，不再单列那两条
- **实际实现差异**：difference=unverified。baselineDetail：本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端同样没有 verdict 与证据，证据不足故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。

---

### AT-ST-C20-017 杠飘倍数示例

- **需求规则**：例如平胡加这一档是 8 倍，七对加这一档是 16 倍（需求第 272 行）。
- **验证范围**：server
- **客户端职责**：verdict 为空（无 evidenceIds）。**查证未完成**（客户端执行状态 pending）。
- **服务端职责**：applicability 为空（无 evidenceIds、configCondition 为空）。**查证未完成**（服务端执行状态 pending），基础番与杠飘档相乘结果无据可述。
- **双端协作**：玩家命中杠飘 → 服务端用基础番乘 8 → 下发最终倍数 → 客户端展示。
- **业务行为**：
  - trigger：玩家命中杠飘或飘杠并确认基础番
  - condition：基础番为平胡或七对
  - action：客户端显示合并后的最终倍数；服务端把基础番 1 倍或 2 倍与杠飘档 8 倍相乘
  - result：玩家看到平胡加杠飘为 8 倍、七对加杠飘为 16 倍
- **实际实现差异**：difference=unverified。baselineDetail：本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端同样没有 verdict 与证据，证据不足故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。

---

### AT-ST-C20-018 十风连续打字牌与作废

- **需求规则**：十风：从第一张出牌起连续打字牌。中途打出非字牌，或吃、碰、杠，本局作废，不能再重新累计（需求第 274 行）。
- **验证范围**：server
- **客户端职责**：verdict 为空（无 evidenceIds）。**查证未完成**（客户端执行状态 pending）。
- **服务端职责**：applicability 为空（无 evidenceIds、configCondition 为空）。**查证未完成**（服务端执行状态 pending），连续字牌累计起点、作废触发与「不可重新累计」状态机无据可述。
- **双端协作**：玩家连续打字牌 → 服务端逐张累计 → 出现非字牌或吃碰杠则作废 → 进度下发 → 客户端展示中断状态。
- **业务行为**：
  - trigger：玩家从第一张出牌起逐张打出牌
  - condition：连续打出字牌；中途打出非字牌或发生吃、碰、杠
  - action：客户端展示十风进度，中断后不再显示可继续累计；服务端从第一张出牌起累计连续打出的字牌张数，遇到非字牌或吃碰杠则本局作废且不允许重新累计
  - result：玩家看到十风进度中断后本局不再累计十风
- **实际实现差异**：difference=unverified。baselineDetail：本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端同样没有 verdict 与证据，证据不足故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。

---

### AT-ST-C20-019 满十张后任意自摸可胡

- **需求规则**：满 10 张后任意自摸都能胡，不要求成牌（需求第 274 行）。
- **验证范围**：server
- **客户端职责**：verdict 为空（无 evidenceIds）。**查证未完成**（客户端执行状态 pending）。
- **服务端职责**：applicability 为空（无 evidenceIds、configCondition 为空）。**查证未完成**（服务端执行状态 pending），满 10 张后跳过成牌校验的自摸放行逻辑无据可述。
- **双端协作**：玩家十风满 10 张后自摸 → 服务端不校验成牌直接放行 → 胡牌结算下发 → 客户端展示结果。
- **业务行为**：
  - trigger：玩家十风累计满 10 张后自摸
  - condition：十风连续字牌满 10 张
  - action：客户端在满 10 张后允许玩家对任意摸到的牌发起自摸，不因不成牌而拦截；服务端在十风满 10 张后接受任意牌的自摸胡牌，不校验牌型是否成牌
  - result：玩家看到满 10 张后任意自摸都可以胡牌
- **实际实现差异**：difference=unverified。baselineDetail：本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端同样没有 verdict 与证据，证据不足故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。

---

### AT-ST-C20-020 只记十风不与其他番型相乘

- **需求规则**：只记十风，不与平胡、杠开、财飘、七对相乘（需求第 274 行）。
- **验证范围**：server
- **客户端职责**：verdict 为空（无 evidenceIds）。**查证未完成**（客户端执行状态 pending）。
- **服务端职责**：applicability 为空（无 evidenceIds、configCondition 为空）。**查证未完成**（服务端执行状态 pending），十风与其他番型的互斥短路逻辑无据可述。
- **双端协作**：玩家十风胡牌 → 服务端只取十风倍数、跳过多番型连乘 → 下发 → 客户端展示单项十风。
- **业务行为**：
  - trigger：玩家以十风胡牌
  - condition：十风成立
  - action：客户端只显示十风这一项，不叠加平胡、杠开、财飘、七对；服务端在十风成立时只记十风，不与平胡、杠开、财飘、七对连乘
  - result：玩家看到十风胡牌的结算中没有叠加其他番型
- **实际实现差异**：difference=unverified。baselineDetail：本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端同样没有 verdict 与证据，证据不足故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。

---

### AT-ST-C20-021 十风倍数增长

- **需求规则**：10 张为 2 倍，每多一张再乘 2（需求第 274 行）。
- **验证范围**：server
- **客户端职责**：verdict 为空（无 evidenceIds）。**查证未完成**（客户端执行状态 pending）。
- **服务端职责**：applicability 为空（无 evidenceIds、configCondition 为空）。**查证未完成**（服务端执行状态 pending），十风倍数基准与逐张翻倍算法无据可述。
- **双端协作**：玩家十风胡牌 → 服务端按超出 10 张的数目连续翻倍 → 下发倍数 → 客户端展示。
- **业务行为**：
  - trigger：玩家以十风胡牌
  - condition：十风连续字牌为 10 张或更多
  - action：客户端显示随张数递增的十风倍数；服务端以 10 张为 2 倍基准，每多 1 张再乘 2
  - result：玩家看到十风倍数随超出 10 张的张数逐张翻倍
- **实际实现差异**：difference=unverified。baselineDetail：本轮服务端未检索到相关实现证据（applicability 为空、无 evidenceIds），客户端同样没有 verdict 与证据，证据不足故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。

---

### AT-ST-C20-022 财神牌面染红与可点击

- **需求规则**：财神牌面染红，可点击，没有角标（需求第 276 行）。uiRequirement 同文：财神牌面染红，可点击，没有角标。
- **验证范围**：client
- **客户端职责**：clientVerification.verdict 为空（无 evidenceIds）。**查证未完成**（客户端执行状态 pending，原子列于 client-evidence.json 的 pendingAtomIds），牌面染色、点击态与角标去除的实现要点无据可述、无证据定位。
- **服务端职责**：serverVerification.applicability 为空（无 evidenceIds、configCondition 为空）。**查证未完成**（服务端执行状态 pending）。按需求语义，服务端只需下发「哪张牌是财神」的标识、不参与牌面表现，但本轮无证据支撑该下发行为。
- **双端协作**：服务端标记本局财神 → 下发到手牌 → 客户端按财神渲染为红色可点击牌面、不显示角标。
- **业务行为**：
  - trigger：玩家手牌中出现财神牌
  - condition：该牌为财神
  - action：客户端把财神牌面染红，保持可点击，且不加任何角标；服务端只需下发哪张牌是财神，不参与牌面表现
  - result：玩家看到红色财神牌，可点击且没有角标
- **实际实现差异**：difference=unverified。baselineDetail：本轮客户端未检索到相关实现证据（客户端没有 verdict 与 evidenceIds），服务端 applicable 为空且无证据，证据不足以判定符合性，故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。

---

### AT-ST-C20-023 财神打出后牌河保留红色

- **需求规则**：打出后牌河仍是原牌面，只保留这层红色（需求第 276 行）。uiRequirement 同文：财神打出后牌河仍是原牌面，只保留这层红色。
- **验证范围**：client
- **客户端职责**：verdict 为空（无 evidenceIds）。**查证未完成**（客户端执行状态 pending，原子列于 client-evidence.json 的 pendingAtomIds），牌河渲染复用与红色效果保留的实现要点无据可述、无证据定位。
- **服务端职责**：applicability 为空（无 evidenceIds、configCondition 为空）。**查证未完成**（服务端执行状态 pending）。按需求语义，服务端按普通出牌记录即可、不额外处理牌河表现，但本轮无证据支撑该记录行为。
- **双端协作**：玩家打出财神 → 服务端记录出牌 → 客户端在牌河按原牌面加红色渲染。
- **业务行为**：
  - trigger：玩家打出财神牌
  - condition：打出的牌为财神
  - action：客户端在牌河里仍按原牌面显示该牌，只保留红色这一层效果；服务端按普通出牌记录该牌，不额外处理牌河表现
  - result：玩家看到牌河中的财神仍是原牌面并带红色
- **实际实现差异**：difference=unverified。baselineDetail：本轮客户端未检索到相关实现证据（客户端没有 verdict 与 evidenceIds），服务端 applicable 为空且无证据，证据不足以判定符合性，故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。

## 证据索引

本阶段在 client-evidence.json 与 server-evidence.json 中均无可用证据条目，故本阶段 CLE / SVE 列表为空。

| 证据 ID | 端 | 证据层（layer） | file:line | claimKey |
|---|---|---|---|---|
| — | — | — | — | — |

补充说明：

- client-evidence.json 的 coverage.pendingAtomIds 逐条包含 AT-ST-C20-001 ~ AT-ST-C20-023 全部 23 个原子，客户端执行状态 pending，未产出 CLE 证据。
- server-evidence.json 的 evidence 集合中不存在任何 claimKey 关联 ST-C20 的条目，服务端执行状态 pending，未产出 SVE 证据。
- feature_index.json 中本阶段 23 个原子的 clientVerification.evidenceIds 与 serverVerification.evidenceIds 全为空数组，clientVerification.verdict 与 serverVerification.applicability 均为空字符串，configCondition 均为空。
- 因此本阶段不存在任何 file:line 定位可引用，亦不存在可升级的历史基线与候选差异（candidateDifference 全为空）。

## 待处理事项

以下条目摘自 pending-list.md「规则待验证」分节，均为「证据不足」、建议动作「补证 both」；本阶段在「查证未完成（必要端缺口）」与「需策划裁决」分节中无条目，difference-review.json 中亦无本阶段待审批复核建议。

| atomId | 验证范围 | 问题 | 说明 | 建议动作 |
|---|---|---|---|---|
| AT-ST-C20-001 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C20-002 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C20-003 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C20-004 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C20-005 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C20-006 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C20-007 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C20-008 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C20-009 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C20-010 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C20-011 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C20-012 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C20-013 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C20-014 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C20-015 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C20-016 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C20-017 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C20-018 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C20-019 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C20-020 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C20-021 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C20-022 | client | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C20-023 | client | 规则待验证 | 证据不足 | 补证 both |

补证建议（按规则归属）：

- AT-ST-C20-001 ~ 005（FP-ST-C20-001 番型分组与计算框架）：需定位服务端番型判定总入口、三组结构定义、组内取最高档与组间连乘的倍数汇总点，以及点炮/抢杠胡路径上对爆头、财飘、杠开、十风的排除分支。
- AT-ST-C20-006 ~ 010（FP-ST-C20-002 基础组）：需定位平胡与七对系列的牌型识别、财神替代成牌处理、豪华组数统计（含白板不计）与 2/4/8/16、4/8/16/32 两套倍数表的选档点。
- AT-ST-C20-011（FP-ST-C20-003 杠开组）：需定位自摸时的杠链计数与 2/4/8/16 档位映射。
- AT-ST-C20-012 ~ 015（FP-ST-C20-004 财神组）：需定位飘档统计、「单放与财神成将」判定、听任意牌时回溯进张前敲响状态，以及 3 档及以上归并三财飘的处理。
- AT-ST-C20-016 ~ 017（FP-ST-C20-005 杠飘与飘杠改记）：需定位杠上开花与财飘同时命中的组合识别、两条改记一条的去重逻辑与「8 倍再乘基础番」的运算顺序。
- AT-ST-C20-018 ~ 021（FP-ST-C20-006 十风）：需定位从第一张出牌起的连续字牌累计状态机、作废后禁止重算的标记、满 10 张后跳过成牌校验的自摸放行、与其他番型的互斥短路，以及 10 张 2 倍起逐张翻倍。
- AT-ST-C20-022 ~ 023（FP-ST-C20-007 财神牌面表现）：需定位客户端财神牌面染色、点击态与角标处理的渲染代码，以及牌河出牌渲染中保留红色效果的分支；服务端侧需确认财神标识的下发字段。
