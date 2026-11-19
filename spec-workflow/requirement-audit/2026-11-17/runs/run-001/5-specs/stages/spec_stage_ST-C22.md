# ST-C22 登记不适用（本期或本玩法不启用）

## 阶段概述

本阶段负责把好友房杭州麻将本期不启用、或属其他玩法与运营侧专属的流程与工具登记为「不适用」，并明确其不进入玩家对局流程，共 9 个需求原子。

- 原子总数：9（分布于 5 个功能点）
- L7 分布：verified 0 / verification_required 9 / decision_required 0 / not_applicable 0
- 分析路径：本阶段全部原子 analysisPath=full，无 blocked、无 conflict-fast；candidateDifference 与 candidateDetail 全为空，无历史基线升级候选
- 复核状态：difference-review.json 中无 ST-C22 条目，本阶段无待审批复核建议
- 输入来源：feature_index.json（5 个功能点）、business-behavior.json、difference-review.json、l7-classify.json、client-evidence.json / server-evidence.json、pending-list.md

L7 口径说明：本阶段 9 个原子 l7 全部为 verification_required，l7Basis 均为 proposed（待审批），scope 全部为 unknown（scopeSource=default-unknown），effectiveDifference 均为 unverified。同时须注意，本阶段**双端均无实现证据**：9 个原子全部落在 client-evidence.json 的 coverage.pendingAtomIds 中（客户端查证未完成，执行状态 pending），server-evidence.json 的 evidence 集合中不存在任何 atomIds 关联 ST-C22 的条目（服务端查证未完成，执行状态 pending）。故 9 个原子 difference 全部为 unverified，属「既不能证实符合、也不能证伪」的证据空白状态，**差异未判定**，本阶段不产出任何具体实现差异结论。

查证方法说明（技术视图）：本阶段原子的需求语义均为「该流程在本玩法内不存在 / 未启用」，其查证属**排除性查证**——需要分别证明两端确实不存在对应入口、指令分支、配置项与结算路径，或证明其被玩法/场次条件隔离。当前两端证据均为空，既未证明存在，也未证明被正确排除，因此不能以「未找到即符合」结案。

功能点与原子映射：

| 功能点 | 名称 | 原子 | 原子数 |
|---|---|---|---|
| FP-ST-C22-001 | 场次专属流程不适用 | AT-ST-C22-001 ~ 002 | 2 |
| FP-ST-C22-002 | 内部测试与观战回放不适用 | AT-ST-C22-003 ~ 004 | 2 |
| FP-ST-C22-003 | 预留能力不启用 | AT-ST-C22-005 ~ 006 | 2 |
| FP-ST-C22-004 | 托管与运营曝光不适用 | AT-ST-C22-007 ~ 008 | 2 |
| FP-ST-C22-005 | 记牌器辅助工具边界 | AT-ST-C22-009 | 1 |

## 需求条目

### AT-ST-C22-001 金币场加倍不适用

- **需求规则**：金币场加倍为金币场专属，好友房无此流程（需求第 300 行）。所属功能点 FP-ST-C22-001 范围限定为「仅覆盖金币场加倍、萧山跟庄骰子两项；好友房内一律不出现」。
- **验证范围**：both
- **客户端职责**：clientVerification.verdict 为空（evidenceIds 为空数组）。**查证未完成**（客户端执行状态 pending，原子列于 client-evidence.json 的 coverage.pendingAtomIds），无实现要点可陈述、无证据定位；按功能点协作口径，客户端职责为「不提供加倍环节的界面与入口」，但该职责尚无 CLE 证据支撑。
- **服务端职责**：serverVerification.applicability 为空（evidenceIds 为空数组、configCondition 为空）。**查证未完成**（服务端执行状态 pending，server-evidence.json 无对应条目），无法说明好友房是否走独立的场次分支、加分配置键在好友房是否被屏蔽，配置生效条件无据可述。
- **双端协作**：好友房开局 → 服务端按好友房规则进入常规对局，不进入加倍配置与处理分支 → 客户端不展示加倍邀请/确认界面 → 对局按常规规则结束并结算（该链路为需求应实现的协作口径，本轮无任一端实现证据）。
- **业务行为**：
  - trigger：好友房开局并进入对局流程
  - condition：当前对局为好友房（非金币场）
  - action：客户端在好友房里不提供金币场加倍环节的界面与入口；服务端在好友房对局中不进入金币场加倍的配置与处理分支
  - result：玩家在好友房全程看不到加倍流程，结算结果只按好友房常规规则产生
- **实际实现差异**：difference=unverified（baselineDifference=unverified，candidateDifference 为空）。baselineDetail：本轮双端均未检索到与该行为相关的实现证据（客户端无 verdict 与 evidenceIds，服务端 applicability 为空、无 evidenceIds），既无法证实好友房存在加倍流程，也无法证实已按好友房正确排除，故证据不足以判定符合性。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。差异未判定，需补证双端。

---

### AT-ST-C22-002 萧山跟庄骰子不适用

- **需求规则**：萧山跟庄骰子为萧山麻将专属，好友房杭州麻将不启用（需求第 301 行）。所属功能点 FP-ST-C22-001 范围限定为「仅覆盖金币场加倍、萧山跟庄骰子两项；好友房内一律不出现」。
- **验证范围**：both
- **客户端职责**：verdict 为空（evidenceIds 为空）。**查证未完成**（客户端执行状态 pending，列于 pendingAtomIds），无实现要点与证据定位；按功能点协作口径，客户端职责为「不展示跟庄骰子的界面与动画」，尚无 CLE 证据。
- **服务端职责**：applicability 为空（evidenceIds 为空、configCondition 为空）。**查证未完成**（服务端执行状态 pending），无法确认定庄流程是否按玩法分流、跟庄骰子分支在杭州麻将好友房是否被裁掉，配置生效条件无据可述。
- **双端协作**：好友房开局掷骰定庄 → 服务端按杭州麻将定庄方式处理、不执行萧山跟庄骰子流程 → 客户端只播放杭州麻将常规定庄与发牌表现（该链路无任一端实现证据）。
- **业务行为**：
  - trigger：好友房开局掷骰定庄
  - condition：当前玩法为杭州麻将好友房
  - action：客户端不展示萧山跟庄骰子的相关界面与动画；服务端不执行萧山跟庄骰子流程，按杭州麻将的方式确定庄家
  - result：玩家看不到跟庄骰子环节，按杭州麻将定庄方式正常开局
- **实际实现差异**：difference=unverified（baselineDifference=unverified，candidateDifference 为空）。baselineDetail：本轮双端均未检索到相关实现证据（客户端无 verdict 与 evidenceIds，服务端 applicability 为空、无 evidenceIds），无法确认是否已正确排除或是否仍存在该环节，故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。差异未判定，需补证双端。

---

### AT-ST-C22-003 做牌与测试模式不适用

- **需求规则**：做牌/测试模式为内部测试工具，不进玩家流程（需求第 302 行）。所属功能点 FP-ST-C22-002 范围限定为「覆盖做牌/测试模式与复盘/回放两项，不涉及对局内任何显示或交互」。
- **验证范围**：both
- **客户端职责**：verdict 为空（evidenceIds 为空）。**查证未完成**（客户端执行状态 pending，列于 pendingAtomIds），无法说明客户端是否存在被编译开关、调试面板或灰度条件隔离的做牌/测试入口，无证据定位。
- **服务端职责**：applicability 为空（evidenceIds 为空、configCondition 为空）。**查证未完成**（服务端执行状态 pending），无法说明做牌/测试指令通道是否仅对内部账号或测试环境开放（即隔离条件），配置生效条件无据可述。
- **双端协作**：玩家进入好友房对局 → 服务端只开放正常发牌与摸打指令通道 → 客户端不暴露做牌/测试入口 → 牌局按正常发牌进行（该链路无任一端实现证据）。
- **业务行为**：
  - trigger：玩家进入好友房对局
  - condition：当前为玩家正常对局流程（非内部测试环境）
  - action：客户端不向玩家开放做牌与测试模式的入口；服务端不向玩家对局开放做牌与测试模式的指令通道
  - result：玩家看不到做牌/测试模式入口，牌局按正常发牌进行
- **实际实现差异**：difference=unverified（baselineDifference=unverified，candidateDifference 为空）。baselineDetail：本轮双端均未检索到相关实现证据（客户端无 verdict 与 evidenceIds，服务端 applicability 为空、无 evidenceIds），无法确认该能力是否已被隔离在玩家流程之外，故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。差异未判定，需补证双端。

---

### AT-ST-C22-004 复盘与回放不适用

- **需求规则**：复盘/回放为观战回放功能，好友房本期不启用（需求第 303 行）。所属功能点 FP-ST-C22-002 范围限定为「覆盖做牌/测试模式与复盘/回放两项，不涉及对局内任何显示或交互」。
- **验证范围**：both
- **客户端职责**：verdict 为空（evidenceIds 为空）。**查证未完成**（客户端执行状态 pending，列于 pendingAtomIds），无法确认结算界面是否存在复盘/回放入口，无证据定位。
- **服务端职责**：applicability 为空（evidenceIds 为空、configCondition 为空）。**查证未完成**（服务端执行状态 pending），无法确认好友房对局是否落盘可回放数据、是否存在回放查询接口，配置生效条件无据可述。
- **双端协作**：好友房对局结束 → 服务端不提供复盘/回放数据与接口 → 客户端结算界面只保留积分与继续游戏/返回大厅等常规按钮（该链路无任一端实现证据）。
- **业务行为**：
  - trigger：好友房对局结束
  - condition：本期好友房对局
  - action：客户端在结算界面不提供复盘与回放入口；服务端不为本期好友房对局提供复盘与回放数据与接口
  - result：玩家在对局结束后看不到复盘/回放入口
- **实际实现差异**：difference=unverified（baselineDifference=unverified，candidateDifference 为空）。baselineDetail：本轮双端均未检索到相关实现证据（客户端无 verdict 与 evidenceIds，服务端 applicability 为空、无 evidenceIds），无法确认入口是否确实不存在，故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。差异未判定，需补证双端。

---

### AT-ST-C22-005 补花与花牌不启用

- **需求规则**：补花/花牌为预留能力；杭麻 136 张无花牌（需求第 304 行）。所属功能点 FP-ST-C22-003 范围限定为「覆盖补花/花牌、杠分两项预留能力，本期不参与对局与结算」。
- **验证范围**：both
- **客户端职责**：verdict 为空（evidenceIds 为空）。**查证未完成**（客户端执行状态 pending，列于 pendingAtomIds），无法确认客户端是否保留花牌牌面资源、补花提示与补花动画分支，无证据定位。
- **服务端职责**：applicability 为空（evidenceIds 为空、configCondition 为空）。**查证未完成**（服务端执行状态 pending），无法确认牌组配置是否为 136 张、组牌与发牌是否不生成花牌、摸牌流程是否不含补花分支，配置生效条件无据可述。
- **双端协作**：好友房发牌与摸打 → 服务端按 136 张无花牌组发牌摸牌、不触发补花 → 客户端只渲染常规牌、不出现花牌与补花提示（该链路无任一端实现证据）。
- **业务行为**：
  - trigger：好友房发牌与摸打
  - condition：当前牌组为杭州麻将 136 张
  - action：客户端不展示花牌与补花提示；服务端在组牌与发牌时不生成花牌，也不触发补花流程
  - result：玩家看不到花牌与补花提示，牌局按 136 张常规牌进行
- **实际实现差异**：difference=unverified（baselineDifference=unverified，candidateDifference 为空）。baselineDetail：本轮双端均未检索到相关实现证据（客户端无 verdict 与 evidenceIds，服务端 applicability 为空、无 evidenceIds），无法确认牌组是否确为 136 张无花牌，故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。差异未判定，需补证双端。

---

### AT-ST-C22-006 杠分不启用

- **需求规则**：杠分为预留能力，当前未启用（需求第 306 行）。所属功能点 FP-ST-C22-003 范围限定为「覆盖补花/花牌、杠分两项预留能力，本期不参与对局与结算」。
- **验证范围**：both
- **客户端职责**：verdict 为空（evidenceIds 为空）。**查证未完成**（客户端执行状态 pending，列于 pendingAtomIds），无法确认结算界面是否存在杠分得分项、杠牌是否只按面子呈现，无证据定位。
- **服务端职责**：applicability 为空（evidenceIds 为空、configCondition 为空）。**查证未完成**（服务端执行状态 pending），无法确认结算计算中是否跳过杠分、杠牌是否仅按面子与非杠分规则处理，配置生效条件无据可述。
- **双端协作**：对局中杠牌 → 服务端结算时不计杠分 → 客户端结算页不出现独立杠分项，仅体现常规番型与积分变化（该链路无任一端实现证据）。
- **业务行为**：
  - trigger：对局中发生杠牌并进入结算
  - condition：本期好友房对局（杠分能力处于预留未启用状态）
  - action：客户端结算界面不展示杠分得分项；服务端在结算计算中不计杠分，杠牌仅按面子与非杠分规则处理
  - result：玩家看到的结算中不含杠分项，杠牌只按面子与非杠分规则处理
- **实际实现差异**：difference=unverified（baselineDifference=unverified，candidateDifference 为空）。baselineDetail：本轮双端均未检索到相关实现证据（客户端无 verdict 与 evidenceIds，服务端 applicability 为空、无 evidenceIds），无法确认杠分是否确实未参与结算，故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。差异未判定，需补证双端。

---

### AT-ST-C22-007 托管不启用

- **需求规则**：托管本期固定无托管（需求第 305 行）。所属功能点 FP-ST-C22-004 范围限定为「覆盖托管与好运来/玄学曝光两项，均不属于好友房对局规则」。
- **验证范围**：both
- **客户端职责**：verdict 为空（evidenceIds 为空）。**查证未完成**（客户端执行状态 pending，列于 pendingAtomIds），无法确认客户端是否存在托管按钮、托管状态图标与托管提示，无证据定位。
- **服务端职责**：applicability 为空（evidenceIds 为空、configCondition 为空）。**查证未完成**（服务端执行状态 pending），无法确认服务端是否不设置托管标志位、超时后是否不代替玩家出牌，配置生效条件无据可述。
- **双端协作**：玩家离开或操作超时 → 服务端不进入托管状态、不代打 → 客户端不提供托管按钮与提示 → 操作权始终留在玩家本人（该链路无任一端实现证据）。
- **业务行为**：
  - trigger：玩家在对局中需要离开或操作超时
  - condition：本期好友房对局（固定无托管）
  - action：客户端不提供托管按钮与托管提示；服务端不进入托管状态、不代替玩家出牌
  - result：玩家看不到托管按钮与托管提示，需自行完成操作
- **实际实现差异**：difference=unverified（baselineDifference=unverified，candidateDifference 为空）。baselineDetail：本轮双端均未检索到相关实现证据（客户端无 verdict 与 evidenceIds，服务端 applicability 为空、无 evidenceIds），无法确认托管功能是否确实关闭，故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。差异未判定，需补证双端。

---

### AT-ST-C22-008 好运来与玄学曝光不适用

- **需求规则**：好运来/玄学曝光为运营曝光功能，非对局流程（需求第 307 行）。所属功能点 FP-ST-C22-004 范围限定为「覆盖托管与好运来/玄学曝光两项，均不属于好友房对局规则」；功能点协作口径为「服务端不代打、不对对局规则产生副作用」。
- **验证范围**：both
- **客户端职责**：verdict 为空（evidenceIds 为空）。**查证未完成**（客户端执行状态 pending，列于 pendingAtomIds），无法确认对局流程内是否存在好运来/玄学曝光的展示插槽与触发点，无证据定位。
- **服务端职责**：applicability 为空（evidenceIds 为空、configCondition 为空）。**查证未完成**（服务端执行状态 pending），无法确认对局流程是否不触发该类运营下发、运营配置是否按场景（对局内/外）隔离，配置生效条件无据可述。
- **双端协作**：好友房对局进行中 → 服务端不对对局流程触发运营曝光下发 → 客户端对局流程内不展示好运来/玄学曝光内容 → 对局节奏不受打断（该链路无任一端实现证据）。
- **业务行为**：
  - trigger：好友房对局进行中
  - condition：当前处于对局流程
  - action：客户端在对局流程内不展示好运来/玄学曝光的运营内容；服务端对对局流程不触发好运来/玄学曝光的运营下发
  - result：玩家在对局流程中看不到相关曝光内容，对局不受影响
- **实际实现差异**：difference=unverified（baselineDifference=unverified，candidateDifference 为空）。baselineDetail：本轮双端均未检索到相关实现证据（客户端无 verdict 与 evidenceIds，服务端 applicability 为空、无 evidenceIds），无法确认对局内是否会触发该曝光，故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。差异未判定，需补证双端。

---

### AT-ST-C22-009 记牌器不改变对局规则

- **需求规则**：记牌器为本家辅助工具，不改变对局规则（需求第 308 行）。uiRequirement：记牌器作为本家辅助工具呈现。所属功能点 FP-ST-C22-005 范围限定为「仅覆盖记牌器，边界为不影响发牌、操作与结算规则」，功能点协作口径为「客户端提供辅助展示，服务端规则与结算不因记牌器发生变化」。
- **验证范围**：client（需求基线亦注明 verificationScope=client；服务端 applicability 仍为空）
- **客户端职责**：verdict 为空（evidenceIds 为空）。**查证未完成**（客户端执行状态 pending，列于 pendingAtomIds），无法确认记牌器的展示范围（是否仅展示本家可见牌张）、入口位置，以及是否仅作辅助展示、不参与出牌校验与结算，无证据定位。
- **服务端职责**：applicability 为空（evidenceIds 为空、configCondition 为空）。**查证未完成**（服务端执行状态 pending）。需求语义要求记牌器不影响发牌、操作判定与结算计算，即服务端无需为记牌器增设任何分支；但本轮无证据支撑「服务端未被记牌器改动」这一排除结论，配置生效条件无据可述。
- **双端协作**：玩家打开记牌器 → 客户端仅追加一层本家可见的辅助牌张展示 → 出牌与结算仍走正常对局规则，服务端不为记牌器干预发牌、操作判定与结算计算（该链路无任一端实现证据）。
- **业务行为**：
  - trigger：玩家在好友房对局中查看记牌器
  - condition：玩家使用本家辅助工具（记牌器）
  - action：客户端记牌器只展示本家可见的辅助牌张信息，不作为出牌或结算依据；服务端不为记牌器额外干预发牌、操作判定与结算计算
  - result：玩家看到记牌器辅助信息，对局规则与结算结果保持不变
- **实际实现差异**：difference=unverified（baselineDifference=unverified，candidateDifference 为空）。baselineDetail：本轮客户端未检索到相关实现证据（verdict 为空、evidenceIds 为空），无法确认记牌器的展示范围与是否影响规则，故判 unverified。
- **验证结论（L7）**：verification_required；l7Basis=proposed（scope=unknown，effectiveDifference=unverified，待审批）。差异未判定，需补证双端。

## 证据索引

本阶段在 client-evidence.json 与 server-evidence.json 中均无可用证据条目，故本阶段 CLE / SVE 列表为空。

| 证据 ID | 端 | 证据层（layer） | file:line | claimKey |
|---|---|---|---|---|
| — | — | — | — | — |

补充说明：

- client-evidence.json 的 coverage.pendingAtomIds 逐条包含 AT-ST-C22-001 ~ AT-ST-C22-009 全部 9 个原子，客户端执行状态 pending，未产出任何 CLE 证据（client-evidence.json 的 12 条 evidence 条目均不指向本阶段原子）。
- server-evidence.json 的 evidence 集合（60 条）中不存在任何 atomIds 关联 ST-C22 的条目，服务端执行状态 pending，未产出任何 SVE 证据。
- feature_index.json 中本阶段 9 个原子的 clientVerification.evidenceIds 与 serverVerification.evidenceIds 全为空数组，clientVerification.verdict 与 serverVerification.applicability 均为空字符串，configCondition 均为空。
- business-behavior.json 中本阶段 9 个条目的 evidenceIds 全为空数组，baselineDifference 全为 unverified；difference-review.json 中无 ST-C22 条目。
- 因此本阶段不存在任何 file:line 定位可引用（无 CLE-id、无 SVE-id），亦不存在历史基线或候选差异（candidateDifference、candidateDetail 全为空，无 graded/升级原子）。

## 待处理事项

以下条目摘自 pending-list.md「规则待验证」分节，均为「证据不足」、建议动作「补证 both」；本阶段在「查证未完成（必要端缺口）」与「需策划裁决」分节中无条目，difference-review.json 中亦无本阶段待审批复核建议（无 reviewStatus=pending 条目）。

| atomId | 验证范围 | 问题 | 说明 | 建议动作 |
|---|---|---|---|---|
| AT-ST-C22-001 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C22-002 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C22-003 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C22-004 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C22-005 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C22-006 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C22-007 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C22-008 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C22-009 | client | 规则待验证 | 证据不足 | 补证 both |

补证建议（按排除性查证归属）：

- AT-ST-C22-001 ~ 002（FP-ST-C22-001 场次专属流程）：客户端需确认加倍入口与跟庄骰子界面/动画资源在好友房完全不可达（含调试残留入口）；服务端需定位场次/玩法分流点，确认好友房不进入加倍配置分支、定庄不进入跟庄骰子分支，并给出对应配置键在好友房的取值或屏蔽方式。
- AT-ST-C22-003 ~ 004（FP-ST-C22-002 内部测试与观战回放）：客户端需确认做牌/测试面板与复盘/回放入口在玩家流程内不可达（含仅内部账号开放的条件）；服务端需定位做牌/测试指令通道的鉴权或开关，以及回放数据落盘与查询接口是否对好友房关闭。
- AT-ST-C22-005（FP-ST-C22-003 补花/花牌）：服务端需给出牌组配置为 136 张的组牌入口，以及发牌/摸牌链路中不含补花分支的证据；客户端需确认花牌牌面资源与补花提示、补花动画无触发路径。
- AT-ST-C22-006（FP-ST-C22-003 杠分）：服务端需定位结算计算中的得分项组装点，确认不存在杠分项、杠牌只按面子处理；客户端需确认结算界面无杠分展示字段。
- AT-ST-C22-007（FP-ST-C22-004 托管）：客户端需确认无托管按钮与托管状态提示；服务端需确认不存在托管标志位与超时代打路径（超时仅维持等待）。
- AT-ST-C22-008（FP-ST-C22-004 运营曝光）：客户端需确认对局流程内无好运来/玄学曝光展示插槽；服务端需确认运营下发按场景隔离、对局流程不触发该类下发。
- AT-ST-C22-009（FP-ST-C22-005 记牌器）：客户端需定位记牌器展示入口与数据来源，确认只读取本家可见牌张且不参与出牌校验与结算；服务端需确认不存在为记牌器服务的定制分支或额外下发字段。
