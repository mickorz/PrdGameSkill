# ST-C03 通用规则（创房界面通用复选）

## 阶段概述

本阶段描述好友房创房界面「通用规则」区十项复选项（可托管、托管解散、超时解散、自动准备、随机座位、截屏监控、搭子房、防作弊、实时语音、关闭互动）的存在性、默认开关状态与其在建房提交、房间生效链路上的两端职责；原文只给默认值，未展开各项开启后的具体生效规则。

- 阶段：ST-C03（章节：玩法选项（创房规则全集，规则不固定） > 通用规则（创房界面通用复选））
- 功能点数：4（FP-ST-C03-001 托管与解散类通用规则、FP-ST-C03-002 准备与座位类通用规则、FP-ST-C03-003 监控与防作弊类通用规则、FP-ST-C03-004 语音与互动类通用规则）
- 本阶段原子数：10（AT-ST-C03-001 ~ AT-ST-C03-010）
- L7 分布：
  - verified：0
  - verification_required：10
  - decision_required：0
  - not_applicable：0
- L7 依据分布：10 个原子的 l7Basis 均为 proposed，无 pending-blocked、无 approved。

阶段共性说明：

1. 10 个原子在统一原子视图中客户端与服务端均无直达证据（clientVerification.verdict、serverVerification.applicability、两端 evidenceIds 全为空），analysisPath 均为 full（非 blocked），baselineDifference / difference 统一为 unverified，故 L7 统一为 verification_required。本阶段不存在 blocked 原子，因此不涉及「查证未完成」表述；也不存在 conflict-fast 原子。
2. 全库证据池对 ST-C03 无覆盖：client-evidence.json 12 条证据的 atomIds 全部落在 AT-ST-C01-001..011，server-evidence.json 60 条证据全部落在 AT-ST-C01-001..029，均无创房设置面板复选项或其默认勾选态的取证，也无托管 / 准备 / 解散 / 截屏 / 语音等运行期行为取证。
3. 其中 AT-ST-C03-003 / 004 / 006 / 009 在 difference-review.json 中各有一条 reviewStatus=pending 的待审批复核建议，reviewedDifference 均为 unverified，**尚未生效**；其余 6 个原子无复核条目。
4. 10 个原子均未进入 pending-list.md 的「查证未完成（必要端缺口）」「需策划裁决」分组，全部落在「规则待验证（412）」分组，建议动作统一为「补证 both」；其中 003 / 004 / 006 / 009 的说明列标注「另有待审批复核建议：unverified」。
5. 口径提示：feature_index.json 中 verificationScope 为 both（001~005、007、008、010）或 client（006、009），而 l7-classify.json 中本阶段 10 条目的 scope 均为 unknown、scopeSource 为 default-unknown（未命中 scope-index），二者不一致，本节按各原子 verificationScope 记录验证范围，L7 记录其原始 scope 来源。

## 需求条目

### AT-ST-C03-001 可托管选项默认关

- **需求规则**：通用规则表列出「可托管」一项，默认状态为关。即创房界面以复选项呈现「可托管」，初始为未勾选。
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端在创房界面「通用规则」区渲染「可托管」复选项并置为未勾选，提交建房时按该开关值随创房参数一并下发。无指向本原子的 CLE 证据，未找到创房面板该复选项及其默认态的实现取证。
  - 证据定位：本原子 evidenceIds 为空；证据池无邻近可引用的客户端证据（现存 CLE 均集中在牌桌底分、结算页签、连庄等级、财神类型等对局内消费点）。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，房间创建时不启用托管能力（玩家在房内无托管状态可进入），即建房的托管开关取默认「关」。
  - configCondition：configCondition 字段为空；按需求语义，该开关随创房参数提交，默认值为关，原文未给出开启后托管能力的生效条件与触发口径。
  - 证据定位：本原子 evidenceIds 为空；证据池无邻近可引用的服务端证据（现存 SVE 均集中在吃碰限制、三摊承包、财神类型、简单模式提示抑制等 ST-C01 规则点）。
- **双端协作**：房主打开创房界面 → 客户端展示通用规则复选项并以默认值关闭「可托管」→ 房主建房并提交规则 → 房间按「不可托管」生效。
- **业务行为**：
  - trigger：房主打开好友房创房界面
  - condition：房主未手动改动该项；适用房型为杭州麻将好友房
  - action：客户端在通用规则区提供「可托管」复选项，初始不勾选；服务端按提交值不启用托管能力
  - result：玩家看到创房界面的「可托管」处于关闭状态，进房后也无托管相关能力
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子在统一原子视图中客户端与服务端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），仅存在需求描述，无法判定实现是否与需求一致，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（effectiveDifference=unverified，无复核条目，按 proposed 基准判定）。

### AT-ST-C03-002 托管解散选项默认关

- **需求规则**：通用规则表列出「托管解散」一项，默认状态为关。即创房界面以复选项呈现「托管解散」，初始为未勾选。
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端在通用规则区渲染「托管解散」复选项并置为未勾选，提交建房时随创房参数下发。无该复选项及默认态的实现取证。
  - 证据定位：本原子 evidenceIds 为空；证据池无邻近可引用的客户端证据。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，房间默认不启用「玩家托管后自动解散房间」的处理，即建房开关取默认「关」。
  - configCondition：configCondition 字段为空；按需求语义，该开关随创房参数提交、默认关，原文未说明托管触发条件、解散执行流程与超时判定时长。
  - 证据定位：本原子 evidenceIds 为空；证据池无邻近可引用的服务端证据，未见托管解散判定或房间解散执行的相关实现。
- **双端协作**：房主打开创房界面 → 客户端展示「托管解散」并默认不勾选 → 提交建房 → 房间按不启用托管解散生效。
- **业务行为**：
  - trigger：房主打开好友房创房界面
  - condition：房主未手动改动该项；适用房型为杭州麻将好友房
  - action：客户端提供「托管解散」复选项并初始不勾选；服务端按提交值不启用托管后自动解散的处理
  - result：玩家看到「托管解散」默认关闭，房内不会因托管触发解散
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子在统一原子视图中客户端与服务端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），仅存在需求描述，无法判定实现符合性，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议（该条复核理由仅在同片 003 条目中以「同类情形」被并列提及，未单独成条）。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无独立复核条目，按 proposed 基准判定）。

### AT-ST-C03-003 超时解散选项默认开

- **需求规则**：通用规则表列出「超时解散」一项，默认状态为开。即创房界面以复选项呈现「超时解散」，初始为已勾选。
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端在通用规则区渲染「超时解散」复选项并置为已勾选，提交建房时随创房参数下发。无该复选项及其默认勾选态的实现取证。
  - 证据定位：本原子 evidenceIds 为空。复核理由引用的邻近证据 CLE-AT-ST-C01-009-01（layer/BoxHzmjBackView.ts:86-88，牌桌底分显示）与 CLE-AT-ST-C01-005-03（layer/comp/BoxHzmjResultMid.ts:719-737，结算胡型页签）仅用于说明证据池未覆盖创房面板，不构成对本原子的验证依据。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，房间默认启用超时解散——玩家操作超时后按超时规则解散房间。
  - configCondition：configCondition 字段为空；按需求语义，该开关默认开并随创房参数提交；原文未说明超时判定时长与解散后的结算处理。
  - 证据定位：本原子 evidenceIds 为空。复核理由引用的邻近证据 SVE-AT-ST-C01-021-01（common_game/com_game/common_game_com_action.cpp:141-148，三摊承包判定）仅用于说明证据池未覆盖本原子，不构成本原子的验证依据。
- **双端协作**：房主打开创房界面 → 客户端展示「超时解散」并默认勾选 → 提交建房 → 房间按启用超时解散生效 → 对局中有人超时即触发解散处理。
- **业务行为**：
  - trigger：房主打开好友房创房界面
  - condition：房主未手动改动该项；适用房型为杭州麻将好友房
  - action：客户端提供「超时解散」复选项并初始勾选；服务端按提交值启用超时解散处理
  - result：玩家看到「超时解散」默认开启，超时发生时房间会被解散
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子在统一原子视图中客户端与服务端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），只能确认需求要求默认开启，无法判定实现是否符合，按证据不足归为未验证。
  - 待审批建议：unverified（evidence-is-not-consistency（双端零证据不足以判 consistent，维持未验证；服务端无证据亦不构成冲突）），**未生效**。
- **验证结论（L7）**：verification_required；l7Basis=proposed（复核条目 reviewStatus=pending，复核建议 unverified 尚未生效）。

### AT-ST-C03-004 自动准备选项默认开

- **需求规则**：通用规则表列出「自动准备」一项，默认状态为开。即创房界面以复选项呈现「自动准备」，初始为已勾选。
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端在通用规则区渲染「自动准备」复选项并置为已勾选，提交建房时随创房参数下发；准备态展示按服务端下发的准备结果表现。无创房界面或准备态展示的实现取证。
  - 证据定位：本原子 evidenceIds 为空。复核理由引用的邻近证据 CLE-AT-ST-C01-002-04（layer/BoxHzmjBackView.ts:82，二人房房名标签）与 CLE-AT-ST-C01-009-01（layer/BoxHzmjBackView.ts:86-88）均属对局内展示，未涉及创房面板或准备态。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，房间默认启用自动准备——玩家在房间内无需手动点击准备即可进入可开局状态。
  - configCondition：configCondition 字段为空；按需求语义，该开关默认开并随创房参数提交，原文未说明自动准备的触发时机（入房即准备还是开局前统一置位）。
  - 证据定位：本原子 evidenceIds 为空。复核理由引用的邻近证据 SVE-AT-ST-C01-024-07（common_game/common_game_server_config.h:41，三摊承包仅 3/4 人）与 SVE-AT-ST-C01-003-03（hzmj_server/server_config.cpp:16，财神类型默认白板）均属房规默认值，未覆盖自动准备 / 开局条件。
- **双端协作**：房主打开创房界面 → 客户端展示「自动准备」并默认勾选 → 提交建房 → 房间按自动准备生效 → 玩家入房后自动被视为已准备。
- **业务行为**：
  - trigger：房主打开好友房创房界面
  - condition：房主未手动改动该项；适用房型为杭州麻将好友房
  - action：客户端提供「自动准备」复选项并初始勾选；服务端按提交值启用自动准备
  - result：玩家看到「自动准备」默认开启，进房后无需手动准备即可开始对局
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子在统一原子视图中客户端与服务端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），需求默认值要求为开，但无实现证据支撑，按证据不足归为未验证。
  - 待审批建议：unverified（evidence-is-not-consistency（双端零证据，默认值无法核对，不足以判 consistent）），**未生效**。
- **验证结论（L7）**：verification_required；l7Basis=proposed（复核条目 reviewStatus=pending，复核建议 unverified 尚未生效）。

### AT-ST-C03-005 随机座位选项默认关

- **需求规则**：通用规则表列出「随机座位」一项，默认状态为关。即创房界面以复选项呈现「随机座位」，初始为未勾选。
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端在通用规则区渲染「随机座位」复选项并置为未勾选，提交建房时随创房参数下发；座位分配结果由服务端产生、客户端仅展示。无该复选项及默认态的实现取证。
  - 证据定位：本原子 evidenceIds 为空；证据池无邻近可引用的客户端证据（现有 CLE 不涉及座位分配或座位展示）。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，房间默认不随机分座，玩家按进房顺序落座。
  - configCondition：configCondition 字段为空；按需求语义，该开关默认关并随创房参数提交，原文未说明随机座位的分配方式与随机源。
  - 证据定位：本原子 evidenceIds 为空；证据池无邻近可引用的服务端证据，未见分座逻辑相关实现。
- **双端协作**：房主打开创房界面 → 客户端展示「随机座位」并默认不勾选 → 提交建房 → 房间按不随机分座生效 → 玩家按入房顺序就座。
- **业务行为**：
  - trigger：房主打开好友房创房界面
  - condition：房主未手动改动该项；适用房型为杭州麻将好友房
  - action：客户端提供「随机座位」复选项并初始不勾选；服务端按提交值决定是否随机分座
  - result：玩家看到「随机座位」默认关闭，座位按进房顺序确定而非随机打乱
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子在统一原子视图中客户端与服务端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），仅能确认需求默认值为关，无法判定实现，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无独立复核条目；该条在同片 003 复核理由中被列为「同类情形」，未形成独立待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无独立复核条目，按 proposed 基准判定）。

### AT-ST-C03-006 截屏监控选项默认开

- **需求规则**：通用规则表列出「截屏监控」一项，默认状态为开。即创房界面以复选项呈现「截屏监控」，初始为已勾选。
- **验证范围**：client
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端在通用规则区渲染「截屏监控」复选项并置为已勾选，房主可保留或取消后建房。无该复选项及其默认勾选态的实现取证，无法核对默认值。
  - 证据定位：本原子 evidenceIds 为空。复核理由引用的邻近证据 CLE-AT-ST-C01-004-03（controller/cmd/gameCmd/GameJuDataCmd.ts:34-35，连庄等级取自创房配置）与 CLE-AT-ST-C01-003-02（data/GameData.ts:50，财神类型取值注释）仅说明证据池内容，不涉及创房面板复选框。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，本原子验证范围仅为客户端界面表现，服务端是否落地截屏监控处理（截屏频率、判定手段等）不作判定依据。
  - configCondition：configCondition 字段为空；按需求语义，该开关随创房参数提交、默认开，原文未说明截屏频率与服务端处置口径。
  - 证据定位：本原子 evidenceIds 为空；按需求该原子不要求服务端落地，服务端无证据不作为冲突依据。
- **双端协作**：房主打开创房界面 → 客户端展示「截屏监控」复选项并默认勾选 → 房主可保留或取消该勾选后建房。
- **业务行为**：
  - trigger：房主打开好友房创房界面
  - condition：房主未手动改动该项；本项验证范围为客户端表现
  - action：客户端提供「截屏监控」复选项并初始勾选，房主可保留或取消后建房；服务端是否落地截屏监控不作判定依据
  - result：玩家看到「截屏监控」默认处于开启状态
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：本原子验证范围为客户端，但统一原子视图中客户端同样无证据（verdict 为空、evidenceIds 为空、无矛盾证据），无法核对该项默认是否勾选，按证据不足归为未验证。
  - 待审批建议：unverified（evidence-is-not-consistency（验证范围为客户端，客户端零证据不足以判 consistent）），**未生效**。
- **验证结论（L7）**：verification_required；l7Basis=proposed（复核条目 reviewStatus=pending，复核建议 unverified 尚未生效；l7 条目 scope=unknown、scopeSource=default-unknown，与 verificationScope=client 不一致，需随补证一并修正）。

### AT-ST-C03-007 搭子房选项默认关

- **需求规则**：通用规则表列出「搭子房」一项，默认状态为关。即创房界面以复选项呈现「搭子房」，初始为未勾选。
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端在通用规则区渲染「搭子房」复选项并置为未勾选，提交建房时随创房参数下发。无该复选项及默认态的实现取证。
  - 证据定位：本原子 evidenceIds 为空；证据池无邻近可引用的客户端证据（现有 CLE 不含房型 / 搭子房相关识别点，仅有 CLE-AT-ST-C01-002-04 的二人房房名标签，与搭子房无关）。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，房间默认不按搭子房模式创建。
  - configCondition：configCondition 字段为空；按需求语义，该开关默认关并随创房参数提交，原文未说明搭子房识别口径与开启后的差异处理。
  - 证据定位：本原子 evidenceIds 为空；证据池无邻近可引用的服务端证据。
- **双端协作**：房主打开创房界面 → 客户端展示「搭子房」并默认不勾选 → 提交建房 → 房间按普通好友房而非搭子房生效。
- **业务行为**：
  - trigger：房主打开好友房创房界面
  - condition：房主未手动改动该项；适用房型为杭州麻将好友房
  - action：客户端提供「搭子房」复选项并初始不勾选；服务端按提交值决定是否按搭子房模式建房
  - result：玩家看到「搭子房」默认关闭，房间以普通好友房形式开局
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子在统一原子视图中客户端与服务端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），需求默认值为关但无实现证据，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无独立复核条目；该条在同片 003 复核理由中被列为「同类情形」，未形成独立待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无独立复核条目，按 proposed 基准判定）。

### AT-ST-C03-008 防作弊选项默认关

- **需求规则**：通用规则表列出「防作弊」一项，默认状态为关。即创房界面以复选项呈现「防作弊」，初始为未勾选。
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端在通用规则区渲染「防作弊」复选项并置为未勾选，提交建房时随创房参数下发。无该复选项及默认态的实现取证。
  - 证据定位：本原子 evidenceIds 为空；证据池无邻近可引用的客户端证据。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，房间默认不启用防作弊增强校验。
  - configCondition：configCondition 字段为空；按需求语义，该开关默认关并随创房参数提交，原文未说明防作弊判定手段与校验强度。
  - 证据定位：本原子 evidenceIds 为空；证据池无邻近可引用的服务端证据（现有 SVE 未涉及防作弊校验链路）。
- **双端协作**：房主打开创房界面 → 客户端展示「防作弊」并默认不勾选 → 提交建房 → 房间按未开启防作弊生效。
- **业务行为**：
  - trigger：房主打开好友房创房界面
  - condition：房主未手动改动该项；适用房型为杭州麻将好友房
  - action：客户端提供「防作弊」复选项并初始不勾选；服务端按提交值决定是否启用防作弊增强校验
  - result：玩家看到「防作弊」默认关闭，对局不额外启用防作弊校验
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子在统一原子视图中客户端与服务端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），仅能确认需求默认值为关，无法判定实现，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无独立复核条目；该条在同片 003 复核理由中被列为「同类情形」，未形成独立待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无独立复核条目，按 proposed 基准判定）。

### AT-ST-C03-009 实时语音选项默认关

- **需求规则**：通用规则表列出「实时语音」一项，默认状态为关。即创房界面以复选项呈现「实时语音」，初始为未勾选。
- **验证范围**：client
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端在通用规则区渲染「实时语音」复选项并置为未勾选，房主可手动勾选开启后再建房。无创房面板该复选项及其默认态的实现取证。
  - 证据定位：本原子 evidenceIds 为空。复核理由引用 client-evidence.json 全量 12 条证据的分布（config/GameDefine.ts、data/GameData.ts、layer/BoxHzmjBackView.ts:82-88、layer/comp/BoxHzmjResultMid.ts:719-737 等），说明证据池未出现建房间设置面板或复选框默认态取证。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，本原子验证范围仅为客户端界面表现，服务端语音通道是否开启不作判定依据。
  - configCondition：configCondition 字段为空；按需求语义，该开关随创房参数提交、默认关，原文未说明语音开启范围与通路由谁承载。
  - 证据定位：本原子 evidenceIds 为空；按需求该原子不要求服务端落地，服务端无证据不构成矛盾。
- **双端协作**：房主打开创房界面 → 客户端展示「实时语音」复选项并默认不勾选 → 房主可手动勾选开启后再建房（语音通路本身由客户端音频能力承载）。
- **业务行为**：
  - trigger：房主打开好友房创房界面
  - condition：房主未手动改动该项；本项验证范围为客户端表现
  - action：客户端提供「实时语音」复选项并初始不勾选，房主可手动勾选开启后再建房；服务端语音通道是否开启不作判定依据
  - result：玩家看到「实时语音」默认处于关闭状态
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：本原子验证范围为客户端，但统一原子视图中客户端同样无证据（verdict 为空、evidenceIds 为空、无矛盾证据），无法核对该项默认是否勾选，按证据不足归为未验证。
  - 待审批建议：unverified（evidence-is-not-consistency（客户端范围零证据无法核对默认值，维持未验证）），**未生效**。
- **验证结论（L7）**：verification_required；l7Basis=proposed（复核条目 reviewStatus=pending，复核建议 unverified 尚未生效；l7 条目 scope=unknown、scopeSource=default-unknown，与 verificationScope=client 不一致，需随补证一并修正）。

### AT-ST-C03-010 关闭互动选项默认关

- **需求规则**：通用规则表列出「关闭互动」一项，默认状态为关。即创房界面以复选项呈现「关闭互动」，初始为未勾选。
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端在通用规则区渲染「关闭互动」复选项并置为未勾选，提交建房时随创房参数下发。无该复选项及默认态的实现取证，互动功能是否被禁用亦无客户端取证。
  - 证据定位：本原子 evidenceIds 为空；证据池无邻近可引用的客户端证据。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，房间默认不关闭互动，玩家之间的互动功能保持可用。
  - configCondition：configCondition 字段为空；按需求语义，该开关默认关并随创房参数提交，原文未给出被禁用的互动功能具体清单。
  - 证据定位：本原子 evidenceIds 为空；证据池无邻近可引用的服务端证据。
- **双端协作**：房主打开创房界面 → 客户端展示「关闭互动」并默认不勾选 → 提交建房 → 房间按互动开启生效（互动开关的禁用范围需与服务端功能校验配合）。
- **业务行为**：
  - trigger：房主打开好友房创房界面
  - condition：房主未手动改动该项；适用房型为杭州麻将好友房
  - action：客户端提供「关闭互动」复选项并初始不勾选；服务端按提交值决定是否关闭互动功能
  - result：玩家看到「关闭互动」默认关闭，房内互动功能可用
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子在统一原子视图中客户端与服务端均无证据（verdict 为空、evidenceIds 为空、无矛盾证据），仅能确认需求默认值为关，无法判定实现，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无独立复核条目；该条在同片 003 复核理由中被列为「同类情形」，未形成独立待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无独立复核条目，按 proposed 基准判定）。

## 证据索引

本阶段 10 个原子的 `clientVerification.evidenceIds` 与 `serverVerification.evidenceIds` 均为空；client-evidence.json（12 条）与 server-evidence.json（60 条）中无任何 atomIds 指向 AT-ST-C03-* 的直达证据。下表为本阶段复核理由中引用的邻近证据，仅用于说明证据池覆盖范围（为何既不能判一致也不能判冲突），不构成本阶段原子的直接验证依据——其 atomIds 均指向 AT-ST-C01-*。

| 证据 ID | layer | file:line | claimKey |
|---|---|---|---|
| CLE-AT-ST-C01-004-03 | client_code | controller/cmd/gameCmd/GameJuDataCmd.ts:34-35 | lian-zhuang-level-from-room-config |
| CLE-AT-ST-C01-003-02 | client_code | data/GameData.ts:50 | cai-shen-type-values |
| CLE-AT-ST-C01-002-04 | client_code | layer/BoxHzmjBackView.ts:82 | er-ren-room-label |
| CLE-AT-ST-C01-009-01 | client_code | layer/BoxHzmjBackView.ts:86-88 | base-score-display-in-table |
| CLE-AT-ST-C01-005-03 | client_code | layer/comp/BoxHzmjResultMid.ts:719-737 | result-hu-type-tab |
| SVE-AT-ST-C01-021-01 | common_game | common_game/com_game/common_game_com_action.cpp:141-148 | three-tan-triggers-contract-at-three |
| SVE-AT-ST-C01-024-07 | common_game | common_game/common_game_server_config.h:41 | three-tan-bao-only-3-4-players |
| SVE-AT-ST-C01-003-03 | hzmj_server | hzmj_server/server_config.cpp:16 | cai-shen-type-default-white-board |

## 待处理事项

本阶段 10 个原子均在 pending-list.md「规则待验证（412）」分组中，建议动作统一为「补证 both」。本阶段无「查证未完成（必要端缺口）」条目、无「需策划裁决」条目。

| atomId | 验证范围 | 问题 | 说明 | 建议动作 |
|---|---|---|---|---|
| AT-ST-C03-001 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C03-002 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C03-003 | both | 规则待验证 | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C03-004 | both | 规则待验证 | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C03-005 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C03-006 | client | 规则待验证 | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C03-007 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C03-008 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C03-009 | client | 规则待验证 | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C03-010 | both | 规则待验证 | 证据不足 | 补证 both |

补充：

- 本阶段无 analysisPath=blocked 原子、无 l7 条目 l7Basis=pending-blocked，因此不存在「查证未完成」结论。
- 无 analysisPath=conflict-fast 原子，无 conflict 结论，不存在另一端 pending 的待办。
- AT-ST-C03-003 / 004 / 006 / 009 各有 1 条 reviewStatus=pending 的待审批复核建议（reviewedDifference 均为 unverified，evidenceScopes 均为空），**尚未生效**，需审批后方可作为最终差异结论；pending-list.md 的「待审批复核建议」汇总表当前仅登记 AT-ST-C01-012 一条，本阶段 4 条复核建议只体现在「规则待验证」表的说明列，存在登记口径不一致，补证/审批时应一并核对。
- 补证重点：客户端侧需补齐创房界面「通用规则」区十项复选项的渲染节点与初始勾选态（可托管、托管解散、随机座位、搭子房、防作弊、实时语音、关闭互动为关；超时解散、自动准备、截屏监控为开），以及建房参数中这十项开关字段的提交路径；服务端侧需补齐房规配置中这十项开关的接收与默认值、以及开启后托管、托管解散、超时解散、自动准备、随机座位、截屏监控、搭子房、防作弊、实时语音、关闭互动各自的生效分支。
