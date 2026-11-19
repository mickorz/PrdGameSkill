# ST-C19 算分

## 阶段概述

本阶段规定「一局结束后每笔赔分如何计算、如何按结算方式分配、如何按承包改写、以及本场积分如何累计」的技术实现规格：服务端以底分、番型倍数、单笔庄闲倍数层层相乘得到原应赔分，不设封顶，按自摸／点炮胡／抢杠胡／承包／黄庄分别决定赔付笔数与改写方式，并把每小局实际净得分累加进本场积分。

- 阶段：ST-C19（章节：算分）
- 功能点数：4（FP-ST-C19-001 单笔赔分公式、FP-ST-C19-002 各结算方式的赔付分配、FP-ST-C19-003 算分算例校验、FP-ST-C19-004 本场积分累计）
- 本阶段原子数：18（AT-ST-C19-001 ~ AT-ST-C19-018）
- L7 分布：
  - verified：0
  - verification_required：18
  - decision_required：0
  - not_applicable：0
- L7 依据分布：18 个原子的 l7Basis 均为 proposed，无 pending-blocked、无 approved；l7-classify.json 中本阶段条目的 scope 均为 unknown、scopeSource 均为 default-unknown，effectiveDifference 均为 unverified。

阶段共性说明：

1. 18 个原子统一原子视图中客户端与服务端均无直达证据：客户端 `clientVerification.verdict` 为空、`evidenceIds` 为空；服务端 `serverVerification.applicability` 为空、`evidenceIds` 为空、`configCondition` 为空。两端均无矛盾证据（`directConflict=false`）。
2. 证据空缺属取证覆盖层面：client-evidence.json 仅 29 条条目（`stats` 为 confirmed 0 / partial 8 / not_found 21 / pending 387，`evidenceCount` 12），其 `coverage.pendingAtomIds`（387 项）完整包含 AT-ST-C19-001 ~ AT-ST-C19-018；服务端 server-evidence.json 仅 60 条 SVE（`atomIds` 全部指向 AT-ST-C01-*），scope-index.json 的 `pendingAtomIds` 同样列出本阶段 18 个原子。因此本阶段既无「判一致」的正面证据，也无「立冲突」的反面证据。
3. 18 个原子 analysisPath 均为 full（无 blocked、无 conflict-fast），`difference` 统一为 unverified，`candidateDifference` 与 `candidateDetail` 均为空，`upgraded` 均为 false，故本阶段不存在「查证未完成（必要端缺口）」的 blocked 结论、不存在 conflict 结论、不存在「历史基线 + 本轮候选」的升级原子。
4. 本阶段仅 AT-ST-C19-001 在 difference-review.json 中有一条 `reviewStatus=pending` 的待审批复核建议（建议 unverified，规则 evidence-is-not-consistency），**尚未生效**；其余 17 个原子无复核条目。
5. 18 个原子全部落在 pending-list.md「规则待验证（412）」分组，验证范围统一为 server，建议动作统一为「补证 both」；本阶段无「需策划裁决」条目。
6. 需求原文（PRD 第248 ~ 257 行）中「庄闲倍数为 8」的口径与 ST-C06 定庄轮庄、ST-C18 三摊承包、ST-C20 番型三组连乘直接耦合；本阶段只陈述单笔赔分与分配规则的实现口径，不重复展开番型取值与承包改写细则。

## 需求条目

### AT-ST-C19-001 底分取值

- **需求规则**：底分为 1。（PRD 第248行「算分」）
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：本原子职责域为服务端，底分是结算乘算的基数，客户端不参与取值判定；按需求语义，客户端只需在结算展示中体现以底分 1 为基数算出的分数。无指向本原子的 CLE 证据，客户端是否展示或校验底分不可判定。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；client-evidence.json 的 `coverage.pendingAtomIds` 将 AT-ST-C19-001 列为未取证，无 CLE 条目挂载本原子。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，结算中计算任一玩家赔付分时底分一律取 1，作为「原应赔分 = 底分 × 番型倍数 × 该笔庄闲倍数」的固定首因子；实现侧是用常量 1 还是读取可配置底分再断言等于 1，无证据。
  - configCondition：数据字段为空（统一原子视图中本原子 `configCondition` 为空）；按需求语义，该取值与创房可选项无关，恒为 1。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无 SVE 直达证据。邻近参考见「证据索引」（SVE-AT-ST-C01-010-02、SVE-AT-ST-C01-009-03 均挂载于创房底分配置原子，不能替代本原子的结算取值验证）。
- **双端协作**：一局结束 → 服务端进入结算并确定底分基数 → 服务端按底分逐笔计算赔分 → 服务端下发结算结果 → 客户端按下发分数展示各家净得分（客户端不参与底分取值）。
- **业务行为**：
  - trigger：一局牌结束、进入结算
  - condition：要计算任一玩家的赔付分时，底分一律按 1 计
  - action：按需求，服务端取底分为 1 作为乘算基数
  - result：玩家在结算中看到的每笔分数都以底分 1 为基数算出
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：需求为「底分为 1，所有赔付分以此为基数」；实际两端均无结算取值证据（applicability 为空、evidenceIds 为空，客户端同为空），既不能证实也不能证伪，按证据不足归为未验证。
  - 待审批建议：unverified（evidence-is-not-consistency（本片 18 个结算算分原子双端证据均为零，按缺证维持 unverified，不得因缺证判 consistent，也不得仅凭服务端无证据立 conflict）），reviewStatus=pending，**未生效**。
- **验证结论（L7）**：verification_required；l7Basis=proposed（复核条目 reviewStatus=pending，复核建议 unverified 尚未生效；无 pending-blocked）。

### AT-ST-C19-002 原应赔分计算公式

- **需求规则**：原应赔分 = 底分 × 番型倍数 × 这一笔的庄闲倍数。（PRD 第248行）
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：本原子职责域为服务端，客户端不参与乘算；按需求语义，客户端只展示服务端下发的每笔应付分数与合计。无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；本原子在 client-evidence.json 中无条目（列于 `coverage.pendingAtomIds`）。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，任一赔付关系先取底分 1，乘以该局番型倍数（番型三组连乘后的结果，取值归 ST-C20），再乘以这一笔自己的庄闲倍数，得到该笔原应赔分；乘算顺序不影响结果，但每笔独立取庄闲倍数是关键。实现侧是否以「逐笔」为粒度重算、还是先算总额再拆分，无证据。
  - configCondition：数据字段为空；按需求语义，该公式在每次结算对每笔赔付关系生效，不依赖创房可选项，仅受番型与庄闲身份影响。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无算分公式类 SVE 证据。
- **双端协作**：一局结束 → 服务端判定番型倍数 → 服务端对每一笔赔付关系分别乘底分与庄闲倍数得到原应赔分 → 服务端按结算方式汇总 → 客户端展示逐笔与合计分数。
- **业务行为**：
  - trigger：一局牌结束、进入结算
  - condition：本局存在某一笔赔付关系（赢家与赔付者之间）
  - action：按需求，服务端用底分乘番型倍数、再乘该笔庄闲倍数，得到该笔原应赔分
  - result：玩家在结算结果中看到该笔应付分数
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：需求为「原应赔分 = 底分 × 番型倍数 × 该笔庄闲倍数」；实际两端均未找到算分公式实现证据，无法判定乘算因子与粒度是否符合，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定；无 pending-blocked）。

### AT-ST-C19-003 庄闲倍数判定

- **需求规则**：赢家和这一笔的赔付者有一方是庄家，庄闲倍数为 8；两边都是闲家，为 1。（PRD 第248行）
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：本原子职责域为服务端，庄闲身份判定与倍数取值均由服务端完成；按需求语义，客户端不显示倍数明细时仅呈现放大后的分数。无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 条目（列于 `coverage.pendingAtomIds`）。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，庄闲倍数是「逐笔」属性：只要这一笔的赢家或赔付者任一方为庄家即取 8，双方都是闲家取 1；因此同一局内不同笔可能出现 8 与 1 并存（闲家自摸即为此形态）。庄家身份来源（首局随机、非首局赢家坐庄、流局原庄连庄）归 ST-C06，本原子只消费该身份。实现侧如何取「这一笔的双方」、庄家标记是否随轮庄实时刷新，无证据。
  - configCondition：数据字段为空；按需求语义，该倍数与创房可选项无关，恒按庄闲身份判定；与「首庄／新庄连庄均为三牢、庄闲固定 8 倍且不再增长」（ST-C06）保持一致，本阶段不引入随连庄增长的额外倍数。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无庄闲倍数类 SVE 证据。
- **双端协作**：一局结束 → 服务端确定本局庄家 → 服务端对每笔赔付关系比较赢家与赔付者身份 → 任一方为庄取 8、双闲取 1 → 服务端据此算出该笔赔分 → 客户端展示分数。
- **业务行为**：
  - trigger：计算某一笔赔付
  - condition：赢家与该笔赔付者中有一方是庄家则庄闲倍数为 8；两边都是闲家则为 1
  - action：按需求，服务端按该笔双方身份取庄闲倍数
  - result：该笔应付分数按庄闲倍数被放大 8 倍或保持原值
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：需求为「一方是庄取 8、双闲取 1」的逐笔判定；实际两端均无实现证据，无法判定倍数是逐笔计算还是全局统一，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定；无 pending-blocked）。

### AT-ST-C19-004 赔分无封顶

- **需求规则**：无封顶。（PRD 第248行）
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：本原子职责域为服务端，截断逻辑不落在客户端；按需求语义，客户端展示完整计算值，不做上限收敛。无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 条目（列于 `coverage.pendingAtomIds`）。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，单笔与合计赔分都不做上限截断，输赢分为完整计算值；即便番型倍数与庄闲倍数叠加出大额分数，也不收敛到某个封顶值。实现侧是否存在单局输分上限判断、以及上限阈值在本玩法是否被置为「不封顶」，无证据。
  - configCondition：数据字段为空（本原子 `configCondition` 为空）；按需求语义，本玩法结算结果不设封顶档，因此不存在「某配置开启后才封顶」的生效条件。若实现侧存在封顶配置项，其默认值与好友房取值需在补证时确认。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无封顶判定类 SVE 直达证据。邻近参考见「证据索引」（SVE-AT-ST-C01-013-01、SVE-AT-ST-C01-009-01 属创房「封顶」配置原子，只说明公共层存在封顶通道，不证明本玩法结算不封顶）。
- **双端协作**：一局结束 → 服务端逐笔算出赔分 → 服务端汇总输赢分且不做上限截断 → 服务端下发完整分数 → 客户端按完整值展示。
- **业务行为**：
  - trigger：一局结算计算赔付分
  - condition：单笔或合计赔分金额较大时也不设上限
  - action：按需求，服务端不对赔分做任何上限截断
  - result：玩家看到的输赢分为完整计算值，不被封顶削减
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：需求为「赔分无封顶」；实际两端均无封顶相关实现证据（既不能证实有封顶，也不能证实无封顶），按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定；无 pending-blocked）。

### AT-ST-C19-005 杠飘飘杠倍数替换

- **需求规则**：杠飘、飘杠的 8 倍已经替换掉杠上开花和财飘，再乘基础番。（PRD 第248行）
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：本原子职责域为服务端，倍数替换发生在番型倍数组装阶段；按需求语义，客户端只按服务端下发的番型与分数展示，不自行叠加倍数。无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 条目（列于 `coverage.pendingAtomIds`）。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，命中杠飘或飘杠时，其 8 倍是「替换」而非「叠加」：先用 8 取代杠上开花（杠开档）与财飘（财神档）的倍数，再乘基础番，得到该局番型倍数；即不得出现「杠飘 × 杠开 × 财飘」的重复计倍。杠飘、飘杠的成立条件与拆出方式归 ST-C14，番型三组取值归 ST-C20，本原子只约束替换后的乘算关系。实现侧是否按「替换」实现、替换作用在哪一组，无证据。
  - configCondition：数据字段为空；按需求语义，该替换在结算时赢家命中杠飘或飘杠即生效，不依赖创房可选项。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无番型倍数替换类 SVE 证据。
- **双端协作**：一局结束 → 服务端判定赢家是否命中杠飘或飘杠 → 命中则以 8 倍替换杠开与财飘后乘基础番 → 服务端以替换后的番型倍数计算各笔赔分 → 客户端展示番型与分数。
- **业务行为**：
  - trigger：结算时赢家命中杠飘或飘杠
  - condition：该局存在杠飘或飘杠
  - action：按需求，服务端用杠飘、飘杠的 8 倍替代杠上开花与财飘的倍数，再乘基础番
  - result：玩家看到的该笔赔分按替换后的倍数计算，不重复叠加杠上开花与财飘
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：需求为「杠飘／飘杠 8 倍替换杠开与财飘后再乘基础番」；实际两端均无相关算分实现证据，无法判定是替换还是叠加，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定；无 pending-blocked）。

### AT-ST-C19-006 自摸三家各算一笔

- **需求规则**：自摸：三家各算一笔。（PRD 第250行）
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：本原子职责域为服务端，笔数由服务端生成；按需求语义，客户端在结算中呈现赢家从三家分别收分的形态（逐笔明细或净额）。无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 条目（列于 `coverage.pendingAtomIds`）。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，自摸成立时以赢家为收分方、其余三家为付分方，各生成一笔独立赔分（每笔各自取庄闲倍数），赢家得分等于三笔之和。实现侧是否按「三家各一笔」建模（而非先算总额再均摊），无证据。
  - configCondition：数据字段为空；按需求语义，自摸场景恒按三笔生成，不依赖创房可选项；是否叠加承包改写由 AT-ST-C19-012 单独约束。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无自摸分账类 SVE 证据。
- **双端协作**：赢家自摸 → 服务端确认胡牌成立且无承包改写 → 服务端对三家各生成一笔赔分 → 服务端汇总赢家实收 → 客户端展示三家付分与赢家得分。
- **业务行为**：
  - trigger：赢家自摸胡牌
  - condition：各家均未触发承包改写
  - action：按需求，服务端对三家各计算一笔赔付
  - result：赢家从三家分别收分
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：需求为「自摸三家各算一笔」；实际两端均无自摸算分实现证据，无法判定笔数模型是否符合，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定；无 pending-blocked）。

### AT-ST-C19-007 庄家自摸三笔都乘 8

- **需求规则**：庄家自摸，三笔都乘 8。（PRD 第250行）
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：本原子职责域为服务端，倍数施加在服务端逐笔计算中；按需求语义，客户端只呈现三名闲家同样被放大的付分。无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 条目（列于 `coverage.pendingAtomIds`）。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，自摸方为庄家时，三笔赔分的庄闲倍数都取 8（因每笔的赢家一方即庄家），三笔金额相同（番型倍数相同的前提下），赢家合计为单笔的三倍。实现侧是否因「收分方是庄」统一放大三笔，无证据。
  - configCondition：数据字段为空；按需求语义，该分支在自摸方为庄家时生效，不依赖创房可选项。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无该分支 SVE 证据。
- **双端协作**：庄家自摸 → 服务端识别收分方为庄家 → 服务端对三笔均按 8 倍计算 → 服务端下发三家付分与庄家收分 → 客户端展示结算分数。
- **业务行为**：
  - trigger：庄家自摸胡牌
  - condition：自摸方为庄家
  - action：按需求，三笔赔付均按庄闲 8 倍计算
  - result：三名闲家各按 8 倍向庄家付分
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：需求为「庄家自摸三笔都乘 8」；实际两端均无该分支实现证据，无法判定三笔是否都被放大，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定；无 pending-blocked）。

### AT-ST-C19-008 闲家自摸庄家那笔乘 8

- **需求规则**：闲家自摸，庄家那一笔乘 8，另两名闲家各乘 1。（PRD 第250行）
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：本原子职责域为服务端；按需求语义，客户端在结算中呈现庄家付分明显高于两名闲家的形态。无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 条目（列于 `coverage.pendingAtomIds`）。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，自摸方为闲家时，赔分按赔付者身份分档：与庄家之间的那一笔因一方为庄取 8，与另两名闲家之间的两笔因双方皆闲取 1，三笔金额因此不相等。实现侧是否对三笔分别取倍数、而非统一乘 8，无证据。
  - configCondition：数据字段为空；按需求语义，该分支在自摸方为闲家时生效，不依赖创房可选项。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无该分支 SVE 证据。
- **双端协作**：闲家自摸 → 服务端识别收分方为闲家 → 服务端对庄家一笔按 8 倍、对两名闲家各按 1 倍计算 → 服务端下发三笔金额 → 客户端展示庄家与闲家不同的付分。
- **业务行为**：
  - trigger：闲家自摸胡牌
  - condition：自摸方为闲家
  - action：按需求，庄家那一笔按 8 倍计算，另两名闲家各自那一笔按 1 倍计算
  - result：庄家付分明显高于两名闲家
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：需求为「闲家自摸时庄家 8 倍、两名闲家各 1 倍」；实际两端均无该分支实现证据，无法判定逐笔倍数差异是否符合，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定；无 pending-blocked）。

### AT-ST-C19-009 无承包时各付各的

- **需求规则**：没有承包时，各付各的，赢家收合计。（PRD 第250行）
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：本原子职责域为服务端；按需求语义，客户端在结算中看到每个赔付者各扣自己那一笔、赢家显示三笔合计，而不是由单一方代付。无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 条目（列于 `coverage.pendingAtomIds`）。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，未成立承包时赔付关系保持原样，不产生代付：每个赔付者按自己那一笔扣分，赢家得分为各笔之和；本条是 AT-ST-C19-012（承包改写）的对照基线。实现侧是否存在「无承包」分支与承包分支的显式区分，无证据。
  - configCondition：数据字段为空；按需求语义，该分支在本局未成立承包时生效；承包相关开关（三摊承包等）的取值归 ST-C18，本原子只描述无承包结果。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无无承包分账类 SVE 证据。
- **双端协作**：自摸结算 → 服务端判断本局无承包 → 服务端按各付各的汇总 → 服务端下发逐笔付分与赢家合计 → 客户端展示独立付分与收分合计。
- **业务行为**：
  - trigger：结算过程中判定赔付关系
  - condition：本局没有承包成立
  - action：按需求，每个赔付者各自承担自己那一笔，赢家收取三笔合计
  - result：玩家看到各自独立的付分与他方收分之和
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：需求为「无承包各付各的、赢家收合计」；实际两端均未找到无承包分账的实现证据，无法判定是否符合，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定；无 pending-blocked）。

### AT-ST-C19-010 点炮胡抢杠胡无承包只算一笔

- **需求规则**：点炮胡、抢杠胡：没有承包时只算赢家和赔付者一笔，这一笔按庄闲 8 倍，另两家 0 分。（PRD 第251行）
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：本原子职责域为服务端；按需求语义，客户端结算中另两家显示 0 分，只有赢家与放铳／被抢杠者出现正负分。无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 条目（列于 `coverage.pendingAtomIds`）。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，点炮胡与抢杠胡在无承包时只生成一笔赔分（赢家 ↔ 放铳者／被抢杠者），该笔按庄闲 8 倍计分（需求原文未区分该笔双方是否同为闲家，直接规定「这一笔按庄闲 8 倍」，该口径归策划确认），其余两家本局得分为 0 且不参与分账。实现侧是否对「另两家 0 分」显式置零，无证据。
  - configCondition：数据字段为空；按需求语义，该分支在点炮胡／抢杠胡且无承包时生效，不依赖创房可选项。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无点炮／抢杠分账类 SVE 证据。
- **双端协作**：点炮胡或抢杠胡成立 → 服务端确认无承包 → 服务端只生成赢家与赔付者一笔并按 8 倍计 → 服务端将另两家置 0 → 客户端展示「赢家正分、放铳者负分、另两家 0」。
- **业务行为**：
  - trigger：赢家点炮胡或抢杠胡
  - condition：本局没有承包成立
  - action：按需求，只计算赢家与赔付者之间一笔，并按庄闲 8 倍计分
  - result：赢家加 8 倍分、放铳者扣 8 倍分，另两家显示 0 分
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：需求为「点炮／抢杠无承包只算一笔、按 8 倍、另两家 0 分」；实际两端均无该场景实现证据，无法判定笔数与置零是否符合，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定；无 pending-blocked）。

### AT-ST-C19-011 点炮胡抢杠胡有承包按承包改写

- **需求规则**：点炮胡、抢杠胡有承包时按上一节改写。（PRD 第251行）
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：本原子职责域为服务端；按需求语义，客户端呈现的付分方与金额会因承包而改变（可能由承包方代付），客户端只按下发结果展示。无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 条目（列于 `coverage.pendingAtomIds`）。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，点炮胡／抢杠胡在承包成立时，实际赔付关系按承包章节（ST-C18）改写：由承包方承担本应由被承包方承担的赔分，其余关系按承包规则调整；本条只规定「有承包即进入改写」，改写细则不在本阶段展开。实现侧是否在点炮／抢杠路径接入承包改写，无证据。
  - configCondition：数据字段为空；按需求语义，改写的触发条件是「本局承包成立」（三摊承包等开关取值归 ST-C18），本原子不新增配置条件。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无承包改写类 SVE 证据。
- **双端协作**：点炮胡或抢杠胡成立 → 服务端识别本局承包关系 → 服务端按承包规则改写实际付分方与金额 → 服务端下发改写后的结果 → 客户端展示代付关系与分数。
- **业务行为**：
  - trigger：赢家点炮胡或抢杠胡
  - condition：本局存在成立的承包关系
  - action：按需求，按承包章节的规则改写实际赔付关系
  - result：玩家看到的付分方与金额与无承包时不同
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：需求为「点炮／抢杠有承包时按承包章节改写」；实际两端均无承包改写实现证据，无法判定改写是否接入该路径，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定；无 pending-blocked）。

### AT-ST-C19-012 承包自摸先算三笔求和 S 再改写

- **需求规则**：承包：自摸先算出三笔再求和为 S，然后按上一节改写出实际赔付。（PRD 第252行）
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：本原子职责域为服务端；按需求语义，客户端看到的是改写后的实际收付，总额与 S 对应，中间求和过程不一定展示。无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 条目（列于 `coverage.pendingAtomIds`）。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，承包自摸分两步：先按 AT-ST-C19-006 / 007 / 008 的口径算出三家三笔并求和得 S，再按承包章节把 S 重新分配到实际赔付方（承包方按约定倍数或全额承担），保证改写前后总额守恒（各玩家净得分之和为 0）。实现侧是先求和再改写、还是直接按承包口径算，无法区分，无证据。
  - configCondition：数据字段为空；按需求语义，该分支在自摸且承包成立时生效；承包开关取值归 ST-C18。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无承包自摸结算类 SVE 证据。
- **双端协作**：赢家自摸且承包成立 → 服务端先算三家三笔并求和为 S → 服务端按承包规则把 S 改写为实际收付 → 服务端下发实际付分 → 客户端展示改写后的分数。
- **业务行为**：
  - trigger：赢家自摸且本局存在承包
  - condition：本局有承包成立
  - action：按需求，先按三家各一笔算出三笔并求和为 S，再按承包规则改写实际赔付
  - result：玩家看到的实际收付以改写后的结果为准，总额仍对应 S
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：需求为「承包自摸先算三笔求和为 S 再改写出实际赔付」；实际两端均无承包结算实现证据，无法判定求和与改写顺序及总额守恒，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定；无 pending-blocked）。

### AT-ST-C19-013 黄庄四家都是 0

- **需求规则**：黄庄：四家本局都是 0。（PRD 第253行）
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：本原子职责域为服务端；按需求语义，客户端结算界面四家本局得分都显示 0。无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 条目（列于 `coverage.pendingAtomIds`）。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，黄庄（无人胡牌）不产生任何赔付关系，四家本局净得分统一为 0，本场积分不变（与 AT-ST-C19-017 的累加结果一致，因为增量为 0）。实现侧是否为黄庄单独置零、还是因无胡牌自然不产生赔分，无证据。
  - configCondition：数据字段为空；按需求语义，该分支在无人胡牌进入黄庄时生效，不依赖创房可选项；黄庄时机（牌墙余牌下限）归 ST-C11。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无黄庄结算类 SVE 证据。
- **双端协作**：本局无人胡牌 → 服务端判定黄庄 → 服务端把四家本局得分置 0 → 服务端下发结算结果 → 客户端四家本局得分均显示 0。
- **业务行为**：
  - trigger：本局判定为黄庄（无人胡牌）
  - condition：无人胡牌进入黄庄
  - action：按需求，四家本局得分均置为 0
  - result：结算界面上四家本局得分都显示 0
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：需求为「黄庄四家本局都是 0」；实际两端均未找到黄庄结算实现证据，无法判定是否置零，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定；无 pending-blocked）。

### AT-ST-C19-014 闲家 2 倍番型自摸算例

- **需求规则**：闲家以 2 倍番型自摸：庄家付 16，两名闲家各付 2，赢家得 20。（PRD 第255行）
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：本原子职责域为服务端；按需求语义，客户端结算应显示庄家付 16、两名闲家各付 2、赢家得 20。无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 条目（列于 `coverage.pendingAtomIds`）。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，本例是 AT-ST-C19-002 与 AT-ST-C19-008 的组合校验：底分 1 × 番型倍数 2 = 2；庄家那一笔再乘庄闲 8 得 16，两名闲家各乘 1 得 2，合计 2 + 2 + 16 = 20。该算例用于反证「三笔统一乘同一倍数」或「漏乘底分」的实现偏差。实现侧能否复现 16 / 2 / 2 / 20，无证据。
  - configCondition：数据字段为空；按需求语义，该算例在自摸方为闲家、番型倍数为 2、无承包改写时成立；番型倍数 2 的档位归 ST-C20。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无算例校验类 SVE 证据。
- **双端协作**：闲家以 2 倍番型自摸 → 服务端按底分 1、番型 2、逐笔庄闲倍数计算 → 服务端得到 16 / 2 / 2 并汇总 20 → 客户端展示该组数值。
- **业务行为**：
  - trigger：闲家以 2 倍番型自摸
  - condition：自摸方为闲家且番型倍数为 2、无承包改写
  - action：按需求，庄家那一笔按 2 的 8 倍计 16，两名闲家各按 2 的 1 倍计 2，合计 20
  - result：结算显示庄家付 16、两名闲家各付 2、赢家得 20
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：需求为「闲家 2 倍番型自摸，庄家付 16、两名闲家各付 2、赢家得 20」；实际两端均无该示例算分实现证据，无法判定算例能否复现，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定；无 pending-blocked）。

### AT-ST-C19-015 平胡点炮算例

- **需求规则**：平胡点炮：赢家 +8，放铳者 −8，另两家 0。（PRD 第255行）
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：本原子职责域为服务端；按需求语义，客户端结算显示赢家 +8、放铳者 −8、另两家 0。无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 条目（列于 `coverage.pendingAtomIds`）。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，本例是 AT-ST-C19-010 的数值校验：平胡番型倍数取 1，底分 1 × 1 × 庄闲 8 = 8，只生成赢家与放铳者一笔，另两家本局得分为 0；该算例用于反证「平胡按 1 倍不放大」或「另两家被分摊」的偏差。实现侧能否复现 +8 / −8 / 0，无证据。
  - configCondition：数据字段为空；按需求语义，该算例在平胡点炮、无承包改写时成立。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无算例校验类 SVE 证据。
- **双端协作**：平胡点炮胡成立 → 服务端确认无承包 → 服务端算 1 × 1 × 8 = 8 并只落一笔 → 服务端把另两家置 0 → 客户端展示 +8 / −8 / 0。
- **业务行为**：
  - trigger：赢家平胡点炮胡牌
  - condition：番型为平胡且无承包改写
  - action：按需求，只计算赢家与放铳者一笔，按庄闲 8 倍计 8
  - result：结算显示赢家 +8、放铳者 −8、另两家 0
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：需求为「平胡点炮赢家 +8、放铳者 −8、另两家 0」；实际两端均无该示例算分实现证据，无法判定算例能否复现，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定；无 pending-blocked）。

### AT-ST-C19-016 本场积分从 0 起

- **需求规则**：本场积分从 0 起。（PRD 第257行）
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：本原子职责域为服务端；按需求语义，客户端在开局时显示四家本场积分均为 0。无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 条目（列于 `coverage.pendingAtomIds`）。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，本场（一个房间的多小局序列）开始时把四家本场积分初始化为 0，新一场重新开始计数；实现侧初始化时机（建房、首局开始、重连恢复）与存储位置，无证据。该「本场积分」与创房「打片／局数」等场次口径的对应关系归 ST-C04、ST-C06。
  - configCondition：数据字段为空；按需求语义，初始化与创房可选项无关，任何好友房对局均从 0 起。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无本场积分初始化类 SVE 证据。
- **双端协作**：新一场开局 → 服务端初始化四家本场积分为 0 → 服务端在对局信息中携带积分 → 客户端开局显示四家本场积分 0。
- **业务行为**：
  - trigger：新一场开局
  - condition：本场尚未进行任何小局
  - action：按需求，把四家本场积分初始化为 0
  - result：玩家看到开局时四家本场积分均为 0
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：需求为「本场积分从 0 起」；实际两端均未找到本场积分初始化的实现证据，无法判定初始化时机与初值，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定；无 pending-blocked）。

### AT-ST-C19-017 每小局加上实际净得分

- **需求规则**：每小局加上实际净得分。（PRD 第257行）
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：本原子职责域为服务端；按需求语义，客户端本场积分随每局结算刷新，且增量等于该局净得分。无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 条目（列于 `coverage.pendingAtomIds`）。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，每小局结算完成后把该局实际净得分（经承包改写后的最终值，而非原应赔分）累加到对应玩家的本场积分；四家增量之和为 0。实现侧是否以「实际净得分」而非「原应赔分」为增量、以及累加发生在单局结算与全场结算的哪一步，无证据。
  - configCondition：数据字段为空；按需求语义，累加逐局生效，不依赖创房可选项。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无积分累加类 SVE 证据。
- **双端协作**：一小局结算完成 → 服务端取该局实际净得分 → 服务端把增量累加到四家本场积分 → 服务端下发更新后的积分 → 客户端刷新本场积分显示。
- **业务行为**：
  - trigger：一小局结算完成
  - condition：该小局已算出实际净得分
  - action：按需求，把该小局的实际净得分累加到对应玩家的本场积分
  - result：玩家看到本场积分随每局结算更新
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：需求为「每小局累加实际净得分」；实际两端均无积分累加实现证据，无法判定增量口径与累加时机，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定；无 pending-blocked）。

### AT-ST-C19-018 赢家加实收赔付者扣实付

- **需求规则**：赢家加实收，赔付者扣实付。（PRD 第257行）
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：本原子职责域为服务端；按需求语义，客户端看到的积分变化与其在结算中实际收到或付出的金额一致。无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 条目（列于 `coverage.pendingAtomIds`）。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，记分以「实际收付」为准：赢家按实际收到的分数（承包改写后可能由承包方代付、金额可能与原应赔分不同）加分，赔付者按实际付出的分数扣分；不得使用原应赔分记账，否则承包场景会出现总额不守恒。实现侧是否以改写后的实收实付记账，无证据。
  - configCondition：数据字段为空；按需求语义，该记账口径在每次结算对赢家与赔付者生效，不依赖创房可选项。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无实收实付记账类 SVE 证据。
- **双端协作**：一小局结算完成 → 服务端确定实际收付方与金额 → 服务端据此加减各玩家本场积分 → 服务端下发更新后的积分 → 客户端展示与实际收付一致的积分变化。
- **业务行为**：
  - trigger：一小局结算完成
  - condition：该玩家为本局赢家或赔付者
  - action：按需求，赢家按其实际收到的分数加分，赔付者按其实际付出的分数扣分
  - result：玩家看到积分变化与其实际收付金额一致
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：需求为「赢家加实收、赔付者扣实付」；实际两端均无实收实付记分的实现证据，无法判定记账口径，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定；无 pending-blocked）。

## 证据索引

本阶段 18 个原子的 `clientVerification.evidenceIds` 与 `serverVerification.evidenceIds` 均为空：client-evidence.json 的 12 条 CLE 与 server-evidence.json 的 60 条 SVE 中，没有任何条目的 `atomIds` 指向 `AT-ST-C19-*`；两端 `coverage` / `scope-index` 均把本阶段 18 个原子列入未取证清单。因此**本阶段无直达证据**，下表仅列出复核理由与本阶段语义最接近的邻近证据，用于说明「为何不能判一致、也无矛盾可立」，**不构成本阶段原子的验证依据**（其 atomIds 均指向 AT-ST-C01-* 创房配置类原子）。

| 证据 ID | 端 | layer | file:line | claimKey | 与本阶段的关系（仅参考） |
|---|---|---|---|---|---|
| SVE-AT-ST-C01-010-02 | server | mah_frame | mah_frame/base/base_config.cpp:36 | base-score-default-one | `BaseConfig::Reset` 中 `base_score_ = 1`，为底分默认值；不证明好友房结算取值口径（AT-ST-C19-001） |
| SVE-AT-ST-C01-009-03 | server | common_game | common_game/com_game/common_game_com_result.cpp:89 | base-score-used-in-settlement | 结算读取 `GetSvrCfg()->GetBaseScore()`；说明底分来自配置，未证明等于 1（AT-ST-C19-001 / 002） |
| SVE-AT-ST-C01-013-01 | server | common_game | common_game/com_game/common_game_com_result.cpp:201-213 | score-limit-zero-means-no-cap | `BoxResultStep::CalcFinalWinLost` 中 `score_limit > 0` 才截断，0 视为不封顶；属配置语义，未证明本玩法不封顶（AT-ST-C19-004） |
| SVE-AT-ST-C01-009-01 | server | common_game | common_game/com_game/common_game_com_result.cpp:201-213 | score-limit-cap-in-settlement | 同上位置的单局输分封顶分支；只说明公共层存在封顶通道（AT-ST-C19-004） |
| CLE-AT-ST-C01-009-01 | client | client_code | layer/BoxHzmjBackView.ts:86-88 | base-score-display-in-table | 房间信息表展示「底分:${baseScore}」，为创房面板文本渲染，与结算算分无关 |
| CLE-AT-ST-C01-009-03 | client | client_code | layer/BoxHzmjTingPaiView.ts:95-99 | feng-ding-status-text | `roomMaxFan` 为 0 或 -1 时显示「无封顶」，属房间信息展示，不证明结算不截断 |

补充说明：

- 上述 SVE 的仓库为 `common_game` / `mah_frame`，均属公共层配置与结算框架，其 `atomIds` 指向 AT-ST-C01-009 / 010 / 013；本阶段的算分公式、庄闲倍数、逐笔分配、承包改写、黄庄置零、本场积分累计均无对应证据条目。
- CLE-AT-ST-C01-009-01 / 009-03 为创房面板与房间信息文本，未涉及结算界面分数渲染，也未涉及逐笔付分或本场积分显示。
- difference-review.json 对本阶段只给出 1 条复核条目（AT-ST-C19-001），理由中明确：客户端证据仅覆盖 AT-ST-C01-001~029，服务端证据仅 60 条且均属创房配置类，本片整片无双端证据，故维持 unverified；该复核为 reviewStatus=pending，未生效。
- 本阶段无 conflict、无 candidateDifference，故证据索引中不存在「冲突证据」与「候选证据」条目。

## 待处理事项

本阶段 18 个原子全部落在 pending-list.md「规则待验证（412）」分组，验证范围均为 server，建议动作均为「补证 both」；本阶段无「查证未完成（必要端缺口）」条目、无「需策划裁决」条目。

| atomId | 验证范围 | 问题 | 说明 | 建议动作 |
|---|---|---|---|---|
| AT-ST-C19-001 | server | 规则待验证 | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C19-002 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C19-003 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C19-004 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C19-005 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C19-006 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C19-007 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C19-008 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C19-009 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C19-010 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C19-011 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C19-012 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C19-013 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C19-014 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C19-015 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C19-016 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C19-017 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C19-018 | server | 规则待验证 | 证据不足 | 补证 both |

补充：

- 本阶段无 analysisPath=blocked 原子，无 pending-blocked 的 l7Basis，因此不存在「查证未完成」结论；但两端证据库对本阶段原子的覆盖状态为未取证（客户端 `coverage.pendingAtomIds`、服务端 scope-index `pendingAtomIds` 均列出 18 个原子），差异统一按证据不足记为 unverified。
- 无 analysisPath=conflict-fast 原子，无 conflict 结论，不存在另一端 pending 的待办。
- 唯一一条 reviewStatus=pending 的待审批复核建议为 AT-ST-C19-001（reviewedDifference=unverified，reviewRule=evidence-is-not-consistency），**尚未生效**；其余 17 个原子无复核条目。
- 无 candidateDifference 升级原子，本阶段不存在「历史基线 + 本轮候选」情形。
- 补证重点（服务端）：结算入口与逐笔赔分的数据结构（是否按赔付关系逐笔建模）、底分取值（常量 1 还是配置 base_score）、番型倍数取三组连乘结果的接入点、逐笔庄闲倍数判定与轮庄刷新、是否存在单局输分封顶截断、杠飘／飘杠 8 倍对杠开与财飘的替换实现、自摸三笔与庄／闲分档、点炮与抢杠的单笔生成与另两家置零、承包改写接入点与总额守恒、黄庄置零、本场积分初始化与按实际收付累加。
- 补证重点（客户端）：结算界面逐笔付分与净得分渲染、本场积分显示与刷新、承包代付关系的展示（如需）、黄庄 0 分展示；本阶段验证范围均为 server，客户端取证仅用于确认展示链路与下发字段，不改变本阶段的符合性判定口径。
