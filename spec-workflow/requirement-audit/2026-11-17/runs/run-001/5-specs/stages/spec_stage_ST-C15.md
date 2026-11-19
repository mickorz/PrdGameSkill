# ST-C15 吃碰禁手

## 阶段概述

本阶段规定「吃或碰成立后按牌面形态生成禁张、禁张在客户端的呈现与拦截、以及禁张的清空与补牌限制」的技术实现规格：服务端按所吃所碰的具体牌面生成并维护禁张集合，客户端按下发结果压暗呈现、拦截出牌，并在合法出牌后同步解除。

- 阶段：ST-C15（章节：行牌 > 吃碰禁手）
- 功能点数：4（FP-ST-C15-001 禁张生成基础规则、FP-ST-C15-002 吃牌禁张细化与吃牌可选性、FP-ST-C15-003 禁打牌界面表现与出牌拦截、FP-ST-C15-004 禁张解除与补牌限制）
- 本阶段原子数：18（AT-ST-C15-001 ~ AT-ST-C15-018）
- L7 分布：
  - verified：0
  - verification_required：18
  - decision_required：0
  - not_applicable：0
- L7 依据分布：18 个原子的 l7Basis 均为 proposed，无 pending-blocked、无 approved；l7-classify.json 中本阶段条目的 scope 均为 unknown、scopeSource 均为 default-unknown。

阶段共性说明：

1. 18 个原子统一原子视图中客户端与服务端均无直达证据：客户端 `clientVerification.verdict` 为空、`evidenceIds` 为空；服务端 `serverVerification.applicability` 为空、`evidenceIds` 为空、`configCondition` 为空。两端口径下均无矛盾证据。
2. 18 个原子 analysisPath 均为 full（无 blocked、无 conflict-fast），`difference` 统一为 unverified，`candidateDifference` 与 `candidateDetail` 均为空，因此不存在「查证未完成」与「冲突」结论。
3. 其中 AT-ST-C15-001 / 003 / 010 / 012 / 013 / 014 / 015 / 016 / 018 共 9 个原子在 difference-review.json 中各有一条 `reviewStatus=pending` 的待审批复核建议（AT-ST-C15-010 建议 partial，其余建议 unverified），**均尚未生效**，不作为最终差异结论。
4. 18 个原子全部落在 pending-list.md「规则待验证（412）」分组，建议动作统一为「补证 both」；本阶段无「查证未完成（必要端缺口）」条目、无「需策划裁决」条目。

## 需求条目

### AT-ST-C15-001 吃碰成立后同牌面全部禁打

- **需求规则**：吃或碰成立后，同牌面的手牌全部禁打，直到本次限制解除。（PRD 第185行「行牌 > 吃碰禁手」）
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端在吃碰成立后把本家手牌中与所吃碰牌面相同的牌呈现为禁打状态，并在玩家尝试打出这些牌时拦下；本原子职责域为服务端，客户端实现不作符合性判定。无指向本原子的 CLE 证据，客户端是否按下发禁张压暗并拦截不可判定。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 证据（client-evidence.json 中无 atomIds 指向 AT-ST-C15-* 的条目）。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端在吃或碰成立后，把本家手牌中与该牌面相同的手牌全部标记为禁打，禁张在本次限制解除前持续生效。实现侧是否按「同牌面」生成禁张集合、以及集合如何挂载到「本次限制」，均无证据。
  - configCondition：数据字段为空（统一原子视图中本原子 `configCondition` 为空）；按需求语义，该规则在吃或碰成立、本家进入继续行牌阶段时生效，不依赖创房可选项。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空。邻近参考 SVE-AT-ST-C01-001-01（common_game，common_game/common_game_context.cpp:29-36，claimKey=simple-mode-suppress-notice，`CommonGameContext::SendNotifyInfo`：简洁模式仅抑制白名单内规则类 toast，白名单含「吃禁手」）只证明公共层存在禁手提示通道，既不证明禁张按「同牌面」计算，也不证明好友房玩法启用该算法，不构成本原子的直接证据。
- **双端协作**：玩家吃或碰 → 服务端判定吃碰成立 → 服务端标记同牌面手牌为禁打 → 客户端按禁打状态呈现手牌并拦截出牌 → 限制解除前该牌面不可打出。
- **业务行为**：
  - trigger：玩家完成一次吃牌或碰牌
  - condition：本次吃或碰成立，进入本家继续行牌的阶段
  - action：按需求，客户端把本家手牌中与所吃碰牌面相同的牌呈现为禁打并在出牌时拦下；服务端把与该牌面相同的手牌全部标记为禁打，直到本次限制解除
  - result：玩家吃碰之后，手里与所吃碰牌面相同的牌打不出去，要等限制解除后才能出
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：该原子要求「吃或碰成立后同牌面手牌全部禁打」，职责域为服务端裁决；但统一原子视图中服务端无任何证据（applicability 为空、evidenceIds 为空、无矛盾证据），客户端亦无证据，仅有需求描述，无法判定实现是否符合，按证据不足归为未验证。
  - 待审批建议：unverified（common-capability-is-not-enabled（公共层存在「吃禁手」提示通道，不等于好友房启用同牌面禁张算法）），reviewStatus=pending，**未生效**。
- **验证结论（L7）**：verification_required；l7Basis=proposed（复核条目 reviewStatus=pending，复核建议 unverified 尚未生效；无 pending-blocked）。

### AT-ST-C15-002 间隔一张吃中间张只禁被吃牌

- **需求规则**：用间隔一张的两张吃中间张：只禁被吃的那一张；用 1、3 吃 2，禁打 2。
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端按服务端给出的禁张，只把手里剩余的 2 呈现为禁打；本原子职责域为服务端，客户端实现不作符合性判定。无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 证据。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端对「隔张吃中间张」的吃法只把被吃进的中间张（如 2）列为禁张，不额外延伸到其它牌面；即用 1、3 吃 2 时禁张集合为 {2}。服务端是否按吃入牌与被吃牌面形态区分该分支，无证据。
  - configCondition：数据字段为空；按需求语义，该分支在吃牌组合为「相差 2 的两张吃中间张」时生效，不依赖创房可选项。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无 SVE 直达证据。
- **双端协作**：玩家用 1、3 吃进 2 → 服务端判定吃牌成立 → 服务端只把 2 列为禁张 → 客户端把手里剩余的 2 呈现为禁打并拦截出牌。
- **业务行为**：
  - trigger：玩家用间隔一张的两张牌吃进中间那张
  - condition：本次吃法为「1、3 吃 2」这类隔张吃中间张的组合
  - action：按需求，客户端只把剩余的 2 呈现为禁打；服务端只把被吃进的中间张（2）列为禁张，不延伸到其它牌面
  - result：用 1、3 吃 2 之后，玩家手里剩下的 2 打不出去，其它牌不受影响
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：该原子要求「隔张吃中间张时只禁被吃的那一张」，职责域为服务端裁决；但统一原子视图中服务端无任何证据，客户端亦无证据，仅有需求描述，无法判定禁张范围是否符合，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定）。

### AT-ST-C15-003 相邻两张吃一端禁两端延伸牌

- **需求规则**：用相邻两张吃一端：禁打这两张在 1 至 9 内两端能接成顺子的牌；用 2、3 吃 1 或吃 4，都禁 1 和 4。（PRD 第188行）
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端把服务端下发的禁张（1 和 4）在手牌上呈现为禁打并在出牌时拦截；本原子职责域为服务端，客户端实现不作符合性判定。无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 证据。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端把这两张牌在 1 至 9 范围内两端能接成顺子的牌都列为禁张；例如用 2、3 吃牌时，无论吃的是 1 还是 4，禁张集合都是 {1, 4}。两端延伸的一方是否恒为「另一侧」、是否受吃入方向影响，均无证据。
  - configCondition：数据字段为空；按需求语义，该分支在「相邻两张（点数相差 1）吃一端」时生效，不依赖创房可选项。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空。复核检索命中的 SVE-AT-ST-C01-024-01（common_game，common_game/com_game/common_game_com_action.cpp:62-66，claimKey=chow-judge-chi-peng-limit-call-site，吃碰次数上限调用点）与 SVE-AT-ST-C01-025-03（common_game，common_game/com_game/common_game_server_config.h:65-66，claimKey=guard-dealer-only-3-4-players，守庄禁碰）均与禁张范围无关，仅说明检索面覆盖，不构成本原子证据。
- **双端协作**：玩家用 2、3 吃 1 或吃 4 → 服务端判定吃牌成立 → 服务端把 1 和 4 都列为禁张 → 客户端把手牌里的 1 和 4 呈现为禁打并拦截出牌。
- **业务行为**：
  - trigger：玩家用相邻的两张牌吃进一端的牌
  - condition：本次吃法为「2、3 吃 1」或「2、3 吃 4」这类相邻两张吃一端的组合
  - action：按需求，客户端把手牌中的 1 和 4 呈现为禁打；服务端把这两张在 1 至 9 内两端能接成顺子的牌都列为禁张
  - result：玩家用 2、3 吃牌后，手里的 1 和 4 都打不出去
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：该原子要求「相邻两张吃一端时禁打两端可接顺子的牌」，职责域为服务端裁决；但统一原子视图中服务端无任何证据，客户端亦无证据，仅有需求描述，无法判定禁张两端延伸是否正确，按证据不足归为未验证。需求侧与 AT-ST-C15-004（1、2 吃 3 只禁 3）、AT-ST-C15-007（1、9 之外不是牌面）边界口径自洽，无内部矛盾可判。
  - 待审批建议：unverified（evidence-is-not-consistency（无任何禁张范围证据，不能判 consistent，也不构成 conflict）），reviewStatus=pending，**未生效**。
- **验证结论（L7）**：verification_required；l7Basis=proposed（复核条目 reviewStatus=pending，复核建议 unverified 尚未生效）。

### AT-ST-C15-004 1、2 吃 3 只禁 3

- **需求规则**：用 1、2 吃 3，只禁 3。
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端只把 3 呈现为禁打；本原子职责域为服务端，客户端实现不作符合性判定。无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 证据。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端对该吃法只把 3 列为禁张，不再额外延伸出其它禁张（3 的另一侧已无可用牌面，不产生越界虚位禁张）。是否对越界侧做了显式排除，无证据。
  - configCondition：数据字段为空；按需求语义，该分支在吃牌组合为「1、2 吃 3 且另一侧无可用牌面」时生效，不依赖创房可选项。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无 SVE 直达证据。
- **双端协作**：玩家用 1、2 吃进 3 → 服务端判定吃牌成立 → 服务端只把 3 列为禁张 → 客户端把手里的 3 呈现为禁打并拦截出牌。
- **业务行为**：
  - trigger：玩家用 1、2 吃进 3
  - condition：本次吃牌组合为 1、2 吃 3，且 3 的另一侧已无可用牌面
  - action：按需求，客户端只把 3 呈现为禁打；服务端只把 3 列为禁张，不额外延伸出其它禁张
  - result：用 1、2 吃 3 之后，只有 3 打不出去，手里其它牌都能正常打
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：该原子要求「1、2 吃 3 时只禁 3」，职责域为服务端裁决；但统一原子视图中服务端无任何证据，客户端亦无证据，仅有需求描述，无法判定禁张是否被多算，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定）。

### AT-ST-C15-005 碰成立禁同牌

- **需求规则**：碰成立后，禁打与被碰牌相同的牌。
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端把与被碰牌相同的手牌呈现为禁打并拦截出牌；本原子职责域为服务端，客户端实现不作符合性判定。无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 证据。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端在碰成立后把本家手里与被碰牌牌面相同的牌列为禁张。碰与吃是否复用同一套禁张生成逻辑、碰后禁张是否同样持续到本次限制解除，均无证据。
  - configCondition：数据字段为空；按需求语义，该规则在碰成立时生效，不依赖创房可选项。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无 SVE 直达证据。
- **双端协作**：玩家碰牌 → 服务端判定碰成立 → 服务端把同牌面手牌列为禁张 → 客户端按禁打状态呈现并拦截出牌。
- **业务行为**：
  - trigger：玩家完成一次碰牌
  - condition：本次碰成立
  - action：按需求，客户端把与被碰牌相同的手牌呈现为禁打并拦截；服务端把手里与被碰牌牌面相同的牌列为禁张
  - result：碰完之后，玩家手里与被碰牌相同的那张牌打不出去
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：该原子要求「碰成立后禁打与被碰牌相同的牌」，职责域为服务端裁决；但统一原子视图中服务端无任何证据，客户端亦无证据，仅有需求描述，无法判定实现是否符合，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定）。

### AT-ST-C15-006 相差一时禁吃进与另一侧延伸

- **需求规则**：手上两张相差 1 时，禁吃进的那张和另一侧延伸的那张。
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端把服务端下发的两张禁张在手牌上呈现为禁打并在出牌时拦截；本原子职责域为服务端，客户端实现不作符合性判定。无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 证据。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端把吃进的那张和另一侧还能延伸成顺子的那张都列为禁张；判定前提是参与禁张计算的两张手牌点数相差为 1。「另一侧」相对吃入方向的取值，以及多组可行延伸时的取舍，均无证据。
  - configCondition：数据字段为空；按需求语义，该分支在吃牌后两张手牌点数相差 1（相邻）时生效，不依赖创房可选项。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无 SVE 直达证据。
- **双端协作**：玩家吃牌 → 服务端判定吃牌成立 → 服务端按「相差 1」算出吃进牌与另一侧延伸牌两张禁张 → 客户端把这两张呈现为禁打并拦截出牌。
- **业务行为**：
  - trigger：玩家吃牌后手里组成顺子的两张牌点数相差 1（相邻）
  - condition：手里参与禁张计算的这两张牌点数相差为 1
  - action：按需求，客户端把这两张禁张呈现为禁打；服务端把吃进的那张和另一侧还能延伸成顺子的那张都列为禁张
  - result：吃牌后玩家手里这两张牌都打不出去
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：该原子要求「手牌两张相差 1 时禁吃进那张与另一侧延伸那张」，职责域为服务端裁决；但统一原子视图中服务端无任何证据，客户端亦无证据，仅有需求描述，无法判定禁张计算是否符合，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定）。

### AT-ST-C15-007 1、9 外侧不是牌只禁吃进张

- **需求规则**：1、9 外侧不是牌，实际只禁吃进的一张。
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端只把吃进的那一张呈现为禁打；本原子职责域为服务端，客户端实现不作符合性判定。无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 证据。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端不把 1、9 之外的虚位算作禁张，只禁吃进的那一张；即延伸位置超出 1 至 9 牌面范围时该侧不产生禁张。边界判断是否按牌值区间实现，无证据。
  - configCondition：数据字段为空；按需求语义，该分支在按禁张规则算出的另一侧延伸位置超出 1 至 9 牌面范围时生效，不依赖创房可选项。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无 SVE 直达证据。
- **双端协作**：玩家吃牌后手牌贴 1 或 9 → 服务端判定边界外无牌面 → 服务端只把吃进的那张列为禁张 → 客户端按此呈现禁打并拦截出牌。
- **业务行为**：
  - trigger：玩家吃牌后手牌贴到 1 或 9 的牌面边界
  - condition：按禁张规则算出的另一侧延伸位置超出 1 至 9 的牌面范围
  - action：按需求，客户端只把吃进的那张呈现为禁打；服务端不把 1、9 之外的虚位算作禁张，只禁吃进的那一张
  - result：吃牌贴边时，玩家只有吃进的那张打不出去，不会因此多禁其它牌
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：该原子要求「1、9 外侧不是牌，实际只禁吃进的一张」，职责域为服务端裁决；但统一原子视图中服务端无任何证据，客户端亦无证据，仅有需求描述，无法判定边界处理是否符合，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定）。

### AT-ST-C15-008 相差非一只禁吃进张

- **需求规则**：相差不是 1 时，只禁吃进的那张。
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端只把吃进的那一张呈现为禁打；本原子职责域为服务端，客户端实现不作符合性判定。无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 证据。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端在参与禁张计算的两张手牌点数相差不为 1 时，只把吃进的那张列为禁张，不做另一侧延伸。与 AT-ST-C15-006 构成同一判定的两个分支，实际是否共用同一段判断，无证据。
  - configCondition：数据字段为空；按需求语义，该分支在两张手牌点数相差不为 1 时生效，不依赖创房可选项。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无 SVE 直达证据。
- **双端协作**：玩家吃牌 → 服务端判定两张手牌相差不为 1 → 服务端只把吃进的那张列为禁张 → 客户端按此呈现禁打并拦截出牌。
- **业务行为**：
  - trigger：玩家吃牌后手里参与禁张计算的两张牌点数相差不为 1
  - condition：这两张牌点数相差不是 1
  - action：按需求，客户端只把吃进的那一张呈现为禁打；服务端在这种情况下只把吃进的那张列为禁张
  - result：玩家只有吃进的那张牌打不出去
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：该原子要求「相差不是 1 时只禁吃进的那张」，职责域为服务端裁决；但统一原子视图中服务端无任何证据，客户端亦无证据，仅有需求描述，无法判定实现是否符合，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定）。

### AT-ST-C15-009 多组吃法只按最终选定一组写禁张

- **需求规则**：只按最终选定的一组写禁张。
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端把玩家最终选定的那一组吃法提交给服务端，并按服务端返回的禁张呈现手牌；即客户端需保证提交的是「最终选定」的组合而非全部可行组合。提交报文结构与选择态字段无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 证据。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端只依据最终选定的那一组吃法计算并下发禁张，不混入其它组合的禁张；同一张牌存在多组吃法时，禁张集合随选定组合而非全体可行组合变化。是否存在「按下发组合重建禁张」的实现，无证据。
  - configCondition：数据字段为空；按需求语义，该规则在「同一吃入牌存在多组可行吃法、玩家选定其一」时生效，不依赖创房可选项。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无 SVE 直达证据。
- **双端协作**：同一张牌有多组吃法 → 玩家选定一组 → 客户端提交选定吃法 → 服务端只按这一组算禁张 → 客户端按返回结果呈现禁打。
- **业务行为**：
  - trigger：同一张牌存在多组可以吃的组合，玩家选择了其中一组
  - condition：玩家在多组吃法里最终确定了一组
  - action：按需求，客户端提交最终选定的那一组吃法；服务端只依据最终选定的那一组计算并下发禁张
  - result：玩家看到的禁张与自己最终选择的吃法对得上，不会出现其它吃法带来的禁张
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：该原子要求「多组吃法只按最终选定的一组写禁张」，职责域为双端（客户端提交选定组合 + 服务端只按该组算禁张）；但统一原子视图中双端均无任何证据（客户端 verdict 为空、evidenceIds 为空，服务端 applicability 为空、evidenceIds 为空，均无矛盾证据），仅有需求描述，无法判定实现是否符合，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定）。

### AT-ST-C15-010 剩余手牌全为禁张的吃法不能吃

- **需求规则**：吃完后剩余手牌全部落在禁张里的吃法不能吃，本家提示「吃禁手规则生效中」。（PRD 第191行）
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端在本家界面弹出「吃禁手规则生效中」提示，并让这次吃牌不成立；提示文案与触发时机（吃招提交前拦截还是服务端拒绝后回显）均无 CLE 证据。现有客户端证据集中在结果页签、座位映射、财神类型、庄闲倍数、简洁模式与底分/封顶文本，与本原子无关。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 证据（client-evidence.json 12 条中无 atomIds 指向 AT-ST-C15-*）。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端拒绝该吃法（剩余手牌全为禁张导致无牌可打），并通过禁手提示通道下发提示；「剩余手牌全部落在禁张内」这一判定条件是否由服务端计算、判定发生在吃招受理的哪一步，均无证据。SVE-AT-ST-C01-001-01 仅证明公共层存在「吃禁手」规则类提示下发通道（normal 模式不抑制），支持「拒绝后提示」链路存在，但不证明拒绝条件与文案内容。
  - configCondition：数据字段为空；按需求语义，该规则在「按该吃法吃完后剩余手牌全部落在禁张里」时生效，不依赖创房可选项。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空。邻近参考 SVE-AT-ST-C01-001-01（common_game，common_game/common_game_context.cpp:29-36，claimKey=simple-mode-suppress-notice，`CommonGameContext::SendNotifyInfo`），仅覆盖提示通道。
- **双端协作**：玩家尝试吃牌 → 客户端/服务端按禁张检查剩余手牌 → 剩余手牌全在禁张内 → 吃法被拒绝 → 本家弹出「吃禁手规则生效中」→ 手牌维持原样。
- **业务行为**：
  - trigger：玩家在吃牌阶段尝试一种吃法
  - condition：按该吃法吃完后，剩余手牌全部落在禁张里
  - action：按需求，客户端弹出「吃禁手规则生效中」提示并让这次吃牌不成立；服务端拒绝该吃法（剩余手牌全为禁张导致无牌可打）
  - result：玩家看到「吃禁手规则生效中」的提示，这次吃牌没吃成
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：该原子要求「吃完后剩余手牌全部落在禁张里的吃法不能吃，并在本家提示『吃禁手规则生效中』」，职责域为双端（服务端拒绝 + 客户端提示）；但统一原子视图中双端均无任何证据（客户端 verdict 为空、evidenceIds 为空，服务端 applicability 为空、evidenceIds 为空，均无矛盾证据），无法判定拦截逻辑与提示文案是否符合，按证据不足归为未验证。
  - 待审批建议：partial（evidence-is-not-consistency（服务端仅证明禁手提示通道存在，拒绝条件与客户端文案未证，不足以判 consistent）），reviewStatus=pending，**未生效**。
- **验证结论（L7）**：verification_required；l7Basis=proposed（复核条目 reviewStatus=pending，复核建议 partial 尚未生效；正式结论仍按基线 unverified 记为 verification_required）。

### AT-ST-C15-011 禁张不含财神

- **需求规则**：禁张不含财神，吃完仍可打财神。
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端不把财神呈现为禁打，允许玩家点选打出；本原子职责域为服务端，客户端实现不作符合性判定。无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 证据。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端计算禁张集合时不包含财神，即使财神与禁张牌面相同也视为可打；财神的判定来源（财神类型配置下发）与本原子的排除动作是两件事，后者无证据。财神类型相关证据（如 SVE-AT-ST-C01-003-02 / -03 指向 `cai_shen_type` 配置解析与默认白板）只覆盖财神类型取值，不覆盖禁张排除。
  - configCondition：数据字段为空；按需求语义，该规则在吃或碰成立并生成禁张、且本家手牌含财神时生效，不依赖创房可选项。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无 SVE 直达证据。
- **双端协作**：玩家吃或碰 → 服务端计算禁张并排除财神 → 客户端不把财神压暗 → 玩家可以正常打出财神。
- **业务行为**：
  - trigger：玩家吃或碰成立并因此生成禁张
  - condition：玩家手牌中存在财神
  - action：按需求，客户端不把财神呈现为禁打；服务端计算禁张集合时不包含财神
  - result：吃完或碰完之后，玩家手里的财神仍然可以打出去
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：该原子要求「禁张不含财神，吃完仍可打财神」，职责域为服务端裁决；但统一原子视图中服务端无任何证据，客户端亦无证据，仅有需求描述，无法判定财神是否被正确排除，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定）。

### AT-ST-C15-012 禁打牌压暗且仅本家显示

- **需求规则**：禁打牌压暗，牌面仍可辨认，只在本家界面显示。（PRD 第193行）
- **验证范围**：client
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端把本家的禁打牌做压暗处理（压暗后牌面仍能辨认），且该压暗只出现在本家自己的界面上；需覆盖「灰度/遮罩强度保持牌面可辨」与「压暗状态不跨座位渲染」两点。无 CLE 证据：现有界面类证据仅为数值文本渲染（底分文本、封顶状态文本），与禁打压暗、灰度处理及跨家可见范围无关。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空。邻近参考 CLE-AT-ST-C01-009-01（client_code，layer/BoxHzmjBackView.ts:86-88，claimKey=base-score-display-in-table，牌桌底分文本）与 CLE-AT-ST-C01-009-03（client_code，layer/BoxHzmjTingPaiView.ts:95-99，claimKey=feng-ding-status-text，封顶状态文本），均为数值文本渲染，不构成本原子证据。
- **服务端职责**：
  - serverVerification.applicability：不适用（本原子为客户端呈现要求；统一原子视图 `applicability` 为空，仅说明服务端需把禁张状态告知本家，不涉及服务端裁决正确性判定）
  - 规则说明：按需求语义，本原子职责域为客户端呈现；服务端只需向本家下发禁张状态，供客户端定位需压暗的牌。
  - configCondition：数据字段为空；按需求语义，该呈现规则在禁张已生成、玩家处于本轮出牌阶段时生效。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无 SVE 证据（本原子不要求服务端证据）。
- **双端协作**：服务端下发禁张 → 客户端在本家手牌里找到对应牌 → 只在本家界面把这几张牌压暗 → 牌面仍可辨认。
- **业务行为**：
  - trigger：本家手牌中出现了禁打牌（禁张已生成）
  - condition：禁张已经生成，玩家正处于本轮出牌阶段
  - action：按需求，客户端把本家的禁打牌做压暗处理，压暗后牌面仍能辨认，且压暗只在本家界面出现；服务端把禁张状态告知本家
  - result：玩家在自己界面看到几张颜色变暗但还能看清是什么的牌，知道这些牌现在打不了
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：该原子要求「禁打牌压暗、牌面仍可辨认、且只在本家界面显示」，职责域为客户端呈现；但统一原子视图中客户端无任何证据（verdict 为空、evidenceIds 为空、无矛盾证据），无法判定压暗表现与可见范围是否符合，按证据不足归为未验证。既无「已压暗」的正面证据，也无「未压暗或跨家泄露」的反面证据，属取证空缺而非 conflict。
  - 待审批建议：unverified（evidence-is-not-consistency（客户端零禁打压暗证据，不能判 consistent）），reviewStatus=pending，**未生效**。
- **验证结论（L7）**：verification_required；l7Basis=proposed（复核条目 reviewStatus=pending，复核建议 unverified 尚未生效）。

### AT-ST-C15-013 禁打牌仍可提起与横滑虚影

- **需求规则**：这些牌仍能提起，也能横滑出虚影。（PRD 第193行）
- **验证范围**：client
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端仍允许禁打牌被提起，并支持横滑时出现虚影（跟手位置显示拖拽虚影），不因禁打状态禁用拖动反馈；即「可提起/可横滑」与「不可出牌」需解耦。手牌拖拽、提起、虚影相关实现无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 证据（client-evidence.json 无任何手牌拖拽/提起/虚影相关 claimKey）。
- **服务端职责**：
  - serverVerification.applicability：不适用（本原子为客户端交互要求；统一原子视图 `applicability` 为空，服务端不参与该交互反馈，仅最终出牌请求会被服务端按禁张拒绝）
  - 规则说明：按需求语义，本原子职责域为客户端交互呈现；服务端在出牌受理环节拒绝禁张牌即可，不干预提起与横滑表现。
  - configCondition：数据字段为空；按需求语义，该交互在玩家按住或拖动一张处于禁张状态的手牌时生效。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无 SVE 证据（本原子不要求服务端证据）。
- **双端协作**：玩家按住禁打牌 → 客户端允许牌提起 → 玩家横向拖动 → 客户端在跟手位置显示虚影。
- **业务行为**：
  - trigger：玩家按住或拖动一张处于禁张状态的手牌
  - condition：这张牌当前是禁打牌
  - action：按需求，客户端仍允许这张牌被提起，并支持横滑时出现虚影，不因禁打状态取消拖动反馈；服务端不参与该交互反馈
  - result：玩家按住禁打牌时牌能抬起来，横滑时能看到跟手的虚影，只是最后打不出去
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：该原子要求「禁打牌仍能提起，也能横滑出虚影」，职责域为客户端交互呈现；但统一原子视图中客户端无任何证据（verdict 为空、evidenceIds 为空、无矛盾证据），无法判定禁打牌是否仍保留提起与虚影交互，按证据不足归为未验证。是否存在「禁打牌禁止拖动」的偏差完全不可观察，属取证空缺而非 conflict。
  - 待审批建议：unverified（evidence-is-not-consistency（无交互证据，既不能判 consistent 也不能判 conflict）），reviewStatus=pending，**未生效**。
- **验证结论（L7）**：verification_required；l7Basis=proposed（复核条目 reviewStatus=pending，复核建议 unverified 尚未生效）。

### AT-ST-C15-014 禁打牌出牌被拦截并提示

- **需求规则**：单击、双击或松手打出时弹出「该牌被禁打」，牌不进牌河。（PRD 第193行）
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端拦下这次出牌并弹出「该牌被禁打」的提示，牌回到手上不进牌河；三种触发手势（单击、双击、拖动后松手）都应命中同一拦截分支，且提示后手牌与牌河状态不变。无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 证据。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端对禁张牌的出牌请求予以拒绝，不把这张牌放进牌河；即在服务端保留兜底拒绝，防止客户端未拦截时禁张牌进入牌河。出牌请求的拒绝返回与牌河写入的先后次序无证据。提示文案「该牌被禁打」与 SVE-AT-ST-C01-001-01 对应的「吃禁手」提示不同，不能互相替代。
  - configCondition：数据字段为空；按需求语义，该规则在被尝试打出的牌处于禁张范围内时生效，不依赖创房可选项。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空。邻近参考 SVE-AT-ST-C01-001-01（common_game，common_game/common_game_context.cpp:29-36，claimKey=simple-mode-suppress-notice），仅对应「吃禁手」提示白名单，不构成本原子证据。
- **双端协作**：玩家尝试打出禁打牌 → 客户端/服务端识别该牌为禁张 → 出牌请求被拒绝 → 本家弹出「该牌被禁打」→ 牌留在手里，牌河不变。
- **业务行为**：
  - trigger：玩家单击、双击或拖动后松手，试图打出一张禁打牌
  - condition：被尝试打出的这张牌在禁张范围内
  - action：按需求，客户端拦下出牌并弹出「该牌被禁打」；服务端对禁张牌的出牌请求予以拒绝，不把这张牌放进牌河
  - result：玩家点击或松手打出禁打牌时看到「该牌被禁打」，牌没有出去
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：该原子要求「单击/双击/松手打出禁打牌时弹出『该牌被禁打』且牌不进牌河」，职责域为双端（客户端拦截与提示 + 服务端拒绝出牌）；但统一原子视图中双端均无任何证据（客户端 verdict 为空、evidenceIds 为空，服务端 applicability 为空、evidenceIds 为空，均无矛盾证据），无法判定拦截时机、提示文案与牌河是否保持不变，按证据不足归为未验证。双端无证据不等于冲突。
  - 待审批建议：unverified（no-server-evidence-is-not-conflict（双端均无出牌拦截证据，属取证空缺而非矛盾）），reviewStatus=pending，**未生效**。
- **验证结论（L7）**：verification_required；l7Basis=proposed（复核条目 reviewStatus=pending，复核建议 unverified 尚未生效）。

### AT-ST-C15-015 其他家只见牌背

- **需求规则**：其他家只看到牌背。（PRD 第193行）
- **验证范围**：client
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端对其他家只呈现牌背，不把本家禁打牌的牌面或压暗状态泄露给其他家；即禁张状态属本家私有渲染态，不得随座位手牌区同步给他人。可见性/牌背下发相关实现无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空。邻近参考 CLE-AT-ST-C01-002-04（client_code，layer/BoxHzmjBackView.ts:82，claimKey=er-ren-room-label，二人房牌桌标识），只证明牌桌层存在房间标识渲染，与「对手手牌可见性/牌背下发」无关，不构成本原子证据。
- **服务端职责**：
  - serverVerification.applicability：不适用（本原子为客户端可见性要求；统一原子视图 `applicability` 为空，服务端只需不向其他家下发本家具体牌面）
  - 规则说明：按需求语义，本原子职责域为客户端呈现（可见性）；服务端在下发牌面时按座位裁剪，只向本家下发其手牌明细。
  - configCondition：数据字段为空；按需求语义，该可见性约束在本家手牌存在禁打牌、其他家视角观察本家手牌区时生效。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无 SVE 证据（本原子不要求服务端证据）。
- **双端协作**：本家出现禁张 → 客户端只在自己界面展示牌面 → 其他家界面始终显示牌背。
- **业务行为**：
  - trigger：本家处于有禁张的状态，其他玩家查看/面对本家手牌
  - condition：本家手牌中存在禁打牌，其他家视角看到的是本家手牌区
  - action：按需求，客户端对其他家只呈现牌背，不泄露本家禁打牌的牌面或压暗状态；服务端不向其他家下发本家具体牌面
  - result：其他玩家看本家手牌时只看到一排牌背，看不出哪几张被禁
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：该原子要求「其他家只看到牌背」，职责域为客户端呈现（可见性）；但统一原子视图中客户端无任何证据（verdict 为空、evidenceIds 为空、无矛盾证据），无法判定其他家视角是否泄露禁张牌面，按证据不足归为未验证。既无泄露也无正确遮蔽的证据。
  - 待审批建议：unverified（evidence-is-not-consistency（可见性无证据，不能判 consistent）），reviewStatus=pending，**未生效**。
- **验证结论（L7）**：verification_required；l7Basis=proposed（复核条目 reviewStatus=pending，复核建议 unverified 尚未生效）。

### AT-ST-C15-016 打出合法牌后清空禁张

- **需求规则**：打出一张合法牌后，服务端清空禁张。（PRD 第195行）
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端在合法牌打出后撤掉手牌上的禁打压暗与禁打拦截状态，使原先禁打的牌恢复可选；撤销时机应与服务端清空结果一致（以服务端下发为准，而非本地自猜）。撤销标记的客户端实现无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 证据。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端在接收到合法出牌后清空当前这位玩家的禁张集合；清空条件是「打出的是合法牌」，清空范围是「该玩家的禁张集合」。禁张生命周期（清除时机）相关实现无 SVE 证据；现有服务端证据覆盖创房配置解析、吃碰次数上限、三摊承包与结算封顶，均不含禁张集合的创建与清除。
  - configCondition：数据字段为空；按需求语义，该规则在玩家成功打出一张不在禁张范围内的牌时生效，不依赖创房可选项。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无 SVE 直达证据。
- **双端协作**：玩家打出合法牌 → 服务端确认该牌不在禁张 → 服务端清空禁张集合 → 客户端去掉手牌上的禁打标记与拦截 → 玩家恢复正常出牌。
- **业务行为**：
  - trigger：玩家成功打出一张不在禁张范围内的合法牌
  - condition：所打出的这张牌不属于当前禁张
  - action：按需求，客户端撤掉手牌上的禁打压暗与拦截状态；服务端清空当前这位玩家的禁张集合
  - result：玩家打出一张能打的牌之后，原先变暗打不出去的几张牌恢复正常，可以随意打了
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：该原子要求「打出一张合法牌后服务端清空禁张」，职责域为双端（服务端清空 + 客户端撤销禁打标记）；但统一原子视图中双端均无任何证据（客户端 verdict 为空、evidenceIds 为空，服务端 applicability 为空、evidenceIds 为空，均无矛盾证据），无法判定禁张是否按预期解除，按证据不足归为未验证。清除时机是否正确不可判定，且无证据表明存在「杠或非法时机清空」的偏差。
  - 待审批建议：unverified（no-server-evidence-is-not-conflict（服务端无禁张生命周期证据，不等于冲突）），reviewStatus=pending，**未生效**。
- **验证结论（L7）**：verification_required；l7Basis=proposed（复核条目 reviewStatus=pending，复核建议 unverified 尚未生效）。

### AT-ST-C15-017 同一回合再杠不清空禁张

- **需求规则**：同一回合再杠不清空。
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端在杠牌后继续保留手牌上的禁打标记，不因杠牌恢复这些牌；本原子职责域为服务端，客户端实现不作符合性判定。无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 证据。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端不把杠牌当作解除禁张的时机，禁张集合保持不变；即「杠」与「合法出牌」是两类事件，只有后者触发清空。杠流程中是否存在误清空的代码路径，无证据。
  - configCondition：数据字段为空；按需求语义，该规则在本次禁张尚未解除（尚未打出合法牌）、玩家于同一回合内再次杠牌时生效，不依赖创房可选项。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空；无 SVE 直达证据。
- **双端协作**：玩家同回合杠牌 → 服务端不清空禁张 → 服务端继续下发原禁张状态 → 客户端继续保持这些牌为禁打。
- **业务行为**：
  - trigger：玩家在同一回合内再次杠牌
  - condition：本次禁张尚未解除（还没有打出合法牌）
  - action：按需求，客户端在杠牌后继续保留禁打标记；服务端不把杠牌当作解除禁张的时机，禁张集合保持不变
  - result：玩家同一回合杠牌后，之前禁打的那几张牌还是打不出去
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：该原子要求「同一回合再杠不清空禁张」，职责域为服务端裁决；但统一原子视图中服务端无任何证据，客户端亦无证据，仅有需求描述，无法判定杠牌是否被错误当作清空时机，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（无复核条目，按 proposed 基准判定）。

### AT-ST-C15-018 补进牌仍在禁张内不能打

- **需求规则**：补进的牌若牌值仍在禁张里，也不能打。（PRD 第195行）
- **验证范围**：server
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端把这张补进的牌同样呈现为禁打并在出牌时拦截；本原子职责域为服务端，客户端实现不作符合性判定。补牌后禁打呈现无 CLE 证据。
  - 证据定位：本原子 `clientVerification.evidenceIds` 为空；无 CLE 证据。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端在补牌后按牌值比对禁张，补进牌若命中禁张则继续判为禁打；判定依据是「牌值」而非具体牌实例，因此补进的同牌值牌会被继承禁打状态。补牌后是否重新做牌值比对，无证据。邻近的杠后/补牌流程证据（SVE-AT-ST-C01-005-01 庄家打牌胡需三牢、SVE-AT-ST-C01-004-02 庄等级映射）均与禁张按牌值比对无关。
  - configCondition：数据字段为空；按需求语义，该规则在杠牌后从牌墙补进一张牌、且该牌牌值落在当前禁张范围内时生效，不依赖创房可选项。
  - 证据定位：本原子 `serverVerification.evidenceIds` 为空。邻近参考 SVE-AT-ST-C01-005-01（common_game，common_game/com_game/common_game_com_action.cpp:353-358，claimKey=banker-discard-hu-requires-three-level）与 SVE-AT-ST-C01-004-02（common_game，common_game/com_game/common_game_com_ju.cpp:191-196，claimKey=banker-level-type-to-level-mapping），均不覆盖补牌后禁张判定，不构成本原子证据。
- **双端协作**：玩家杠牌 → 从牌墙补进一张牌 → 服务端按牌值比对现有禁张 → 补进牌命中禁张则保持禁打 → 客户端把这张牌呈现为禁打并拦截出牌。
- **业务行为**：
  - trigger：玩家杠牌后从牌墙补进一张牌
  - condition：补进来的这张牌的牌值仍落在当前禁张范围内
  - action：按需求，客户端把这张补进的牌同样呈现为禁打并拦截；服务端在补牌后按牌值比对禁张，命中则继续判为禁打
  - result：玩家杠后补到的牌如果正好是被禁的牌面，这张补进的牌也打不出去
- **实际实现差异**：
  - difference：unverified（analysisPath=full，candidateDifference 为空）
  - baselineDetail：该原子要求「补进的牌牌值仍在禁张里也不能打」，职责域为服务端裁决；但统一原子视图中服务端无任何证据，客户端亦无证据，仅有需求描述，无法判定补牌后是否按牌值继续禁打，按证据不足归为未验证。是否对补牌重新做牌值比对无从判断。
  - 待审批建议：unverified（no-server-evidence-is-not-conflict（补牌后禁张判定无证据，属取证空缺而非矛盾）），reviewStatus=pending，**未生效**。
- **验证结论（L7）**：verification_required；l7Basis=proposed（复核条目 reviewStatus=pending，复核建议 unverified 尚未生效）。

## 证据索引

本阶段 18 个原子的 `clientVerification.evidenceIds` 与 `serverVerification.evidenceIds` 均为空，客户端与服务端均无 atomIds 指向 ST-C15 的直达证据（client-evidence.json 共 12 条、server-evidence.json 共 60 条，均无 `AT-ST-C15-*` 挂载）。下表为 difference-review.json 复核理由中引用或检索命中的邻近证据，用于说明「为何不能判一致或冲突」，仅供定位参考，不构成本阶段原子的直接验证依据（这些证据的 atomIds 均指向 AT-ST-C01-*，而非 ST-C15）。

| 证据 ID | layer | file:line | claimKey |
|---|---|---|---|
| SVE-AT-ST-C01-001-01 | common_game | common_game/common_game_context.cpp:29-36 | simple-mode-suppress-notice |
| SVE-AT-ST-C01-024-01 | common_game | common_game/com_game/common_game_com_action.cpp:62-66 | chow-judge-chi-peng-limit-call-site |
| SVE-AT-ST-C01-025-03 | common_game | common_game/com_game/common_game_server_config.h:65-66 | guard-dealer-only-3-4-players |
| SVE-AT-ST-C01-025-05 | hzmj_server | hzmj_server/game_logic.cpp:149-161 | guard-dealer-player-count-guard |
| SVE-AT-ST-C01-005-01 | common_game | common_game/com_game/common_game_com_action.cpp:353-358 | banker-discard-hu-requires-three-level |
| SVE-AT-ST-C01-004-02 | common_game | common_game/com_game/common_game_com_ju.cpp:191-196 | banker-level-type-to-level-mapping |
| CLE-AT-ST-C01-002-04 | client_code | layer/BoxHzmjBackView.ts:82 | er-ren-room-label |
| CLE-AT-ST-C01-009-01 | client_code | layer/BoxHzmjBackView.ts:86-88 | base-score-display-in-table |
| CLE-AT-ST-C01-009-03 | client_code | layer/BoxHzmjTingPaiView.ts:95-99 | feng-ding-status-text |

补充说明：

- SVE-AT-ST-C01-001-01 是本阶段唯一与「禁手」提示语义沾边的服务端证据，仅证明 `CommonGameContext::SendNotifyInfo` 存在规则类 toast 白名单（简洁模式下抑制），白名单含「吃禁手」；不证明禁张按「同牌面」生成、不证明两端延伸算法、不证明好友房启用该算法。
- SVE-AT-ST-C01-024-01 与 SVE-AT-ST-C01-025-03 为复核中关键词（forbid/禁）检索命中项，分别对应吃碰次数上限调用点与守庄禁碰，与「吃碰禁手」禁张范围无关。
- 其余 CLE 条目均为数值文本渲染或房间标识渲染，与禁打压暗、拖拽交互、跨家可见性无关。

## 待处理事项

本阶段 18 个原子均在 pending-list.md「规则待验证（412）」分组中，建议动作统一为「补证 both」。本阶段无「查证未完成」条目、无「需策划裁决」条目。

| atomId | 验证范围 | 问题 | 说明 | 建议动作 |
|---|---|---|---|---|
| AT-ST-C15-001 | server | 规则待验证 | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C15-002 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C15-003 | server | 规则待验证 | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C15-004 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C15-005 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C15-006 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C15-007 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C15-008 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C15-009 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C15-010 | both | 规则待验证 | 证据不足（另有待审批复核建议：partial） | 补证 both |
| AT-ST-C15-011 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C15-012 | client | 规则待验证 | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C15-013 | client | 规则待验证 | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C15-014 | both | 规则待验证 | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C15-015 | client | 规则待验证 | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C15-016 | both | 规则待验证 | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C15-017 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C15-018 | server | 规则待验证 | 证据不足（另有待审批复核建议：unverified） | 补证 both |

补充：

- 本阶段无 analysisPath=blocked 原子，无 pending-blocked 的 l7Basis，因此不存在「查证未完成」结论；差异未判定统一按证据不足记为 unverified。
- 无 analysisPath=conflict-fast 原子，无 conflict 结论，不存在另一端 pending 的待办。
- 9 条 reviewStatus=pending 的待审批复核建议（AT-ST-C15-001 / 003 / 010 / 012 / 013 / 014 / 015 / 016 / 018）均**尚未生效**；其中 AT-ST-C15-010 建议为 partial，其余建议为 unverified，需审批后方可作为最终差异结论。
- 无 candidateDifference 升级原子，本阶段不存在「历史基线 + 本轮候选」情形。
- 补证重点（服务端）：禁张集合的生成入口与挂载对象（吃/碰两类事件）、隔张吃中间张与相邻吃一端的分支判定、1/9 边界裁剪、多组吃法按选定组合重建、财神排除、剩余手牌全禁张时的拒绝条件、合法出牌后的清空时机、杠牌不清空与补牌按牌值重判。
- 补证重点（客户端）：禁张下发的消费与压暗渲染、压暗后牌面可辨性、禁打牌提起与横滑虚影、出牌拦截的三种手势与「该牌被禁打」提示、跨家牌背可见性、「吃禁手规则生效中」提示文案、合法出牌后撤销禁打标记。
