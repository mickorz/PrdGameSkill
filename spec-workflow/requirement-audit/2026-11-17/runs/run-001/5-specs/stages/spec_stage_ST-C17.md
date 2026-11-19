# ST-C17 断线重连与场景恢复

## 阶段概述

本阶段规定对局进行中玩家掉线重连后的技术实现规格：不重开小局，按服务端下发的断线瞬间数据完整恢复牌桌、牌墙与余牌数、各家手牌、出牌区、轮次、飘标、记牌器，以及「打哪张听」箭头（缓存先行、服务端数据到达后覆盖），恢复完成后客户端上报定位并继续对局。

- 阶段：ST-C17（章节：行牌 > 断线重连与场景恢复）
- 功能点数：4（FP-ST-C17-001 重连恢复总体规则、FP-ST-C17-002 对局要素恢复、FP-ST-C17-003 打哪张听箭头恢复与覆盖、FP-ST-C17-004 恢复完成后续流程）
- 本阶段原子数：13（AT-ST-C17-001 ~ AT-ST-C17-013，需求原文 221-225 行）
- L7 分布：
  - verified：0
  - verification_required：13
  - decision_required：0
  - not_applicable：0
- L7 依据分布：13 个原子的 l7Basis 均为 proposed，无 pending-blocked、无 approved；13 个原子的 scope 均为 unknown（scopeSource=default-unknown），effectiveDifference 均为 unverified。

阶段共性说明：

1. 本阶段 13 个原子在统一原子视图中客户端与服务端均无任何直达证据（clientVerification.verdict 空、serverVerification.applicability 空、两端 evidenceIds 全为空、observedBehavior 为空），analysisPath 均为 full（非 blocked），baselineDifference 统一为 unverified。这属于「双端零证据的取证空缺」，既不能判 consistent/partial，也无相反实现证据可立 conflict，因此 L7 统一为 verification_required。因不存在 analysisPath=blocked 原子，本阶段不出现「查证未完成」结论，也不存在 pending-blocked 的 l7Basis。
2. 客户端侧取证：2-client/client-evidence.json 共 29 个 entry、12 条 CLE 证据，全部指向 AT-ST-C01-* 系列；本阶段 13 个原子只出现在 `coverage.pendingAtomIds`（client-evidence.json:1079-1091），全库不存在指向本阶段原子的 CLE 证据，无重连恢复的代码或 FGUI 证据。
3. 服务端侧取证：3-server/server-evidence.json 共 60 条 SVE 证据，stats.atomCount=29、pending=387，全部指向 AT-ST-C01-* 系列；不存在指向本阶段原子的 SVE 证据，无重开判定、断点进度下发、箭头数据补发的证据。
4. 复核：difference-review.json 仅含 AT-ST-C17-001 一条 reviewStatus=pending 的待审批复核建议（reviewedDifference=unverified），**尚未生效**；其余 12 个原子无复核条目。
5. 待处理：13 个原子全部落在 pending-list.md「规则待验证（412）」分组，问题统一为「证据不足」，建议动作统一为「补证 both」；本阶段无「查证未完成（必要端缺口）」条目、无「需策划裁决」条目。
6. 无升级原子：本阶段 13 个原子的 candidateDifference / candidateDetail 均为空，不涉及「历史基线 + 本轮候选」的升级情形；无 analysisPath=conflict-fast 原子。

## 需求条目

### AT-ST-C17-001 重连不重开小局

- **需求规则**：对局中掉线重连后不重开小局（需求原文 221 行）。即玩家在对局进行中掉线、重新连接后，仍回到原来那一小局继续，而不是重新开一局。
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端在重连成功后直接进入仍在进行的那一小局，不主动发起重新开局或重新配牌的流程。本原子 evidenceIds 为空，无 CLE 证据可核对客户端是否按此路径进入对局。
  - 证据定位：无 CLE 证据（clientVerification.evidenceIds 为空）；取证覆盖缺口见 `2-client/client-evidence.json:1079-1091`（coverage.pendingAtomIds 包含本原子）。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端识别到是同一位玩家重连，把该玩家放回其仍在进行的小局，不重新发牌、不开启新的一局。
  - configCondition：数据字段为空（本规则不依赖房间配置项，无配置生效条件可记录）。
  - 证据定位：无 SVE 证据（serverVerification.evidenceIds 为空）；`3-server/server-evidence.json` 的 60 条 SVE 全部指向 AT-ST-C01-* 系列，无指向本阶段原子的 SVE 证据。
- **双端协作**：玩家掉线 → 玩家重新连接 → 客户端请求恢复当前对局 → 服务端确认该玩家所在小局仍在进行 → 服务端把玩家放回该小局并下发当前进度 → 客户端展示正在进行的这一局。
- **业务行为**：
  - trigger：玩家在对局中掉线后重新连接
  - condition：当前这一小局仍在进行中、尚未结算
  - action：客户端在重连成功后直接进入仍在进行的那一小局，不主动发起重新开局或重新配牌；服务端识别为同一玩家重连，把该玩家放回其仍在进行的小局，不重新发牌、不开启新的一局
  - result：玩家重连后回到原来那一小局继续打，而不是从头开始一局新的小局
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子要求「对局中掉线重连后不重开小局」，职责域为双端（服务端决定是否重开、客户端决定进入哪一局）。但统一原子视图中客户端与服务端均无任何证据（verdict 为空、evidenceIds 为空、无矛盾证据），仅有需求描述，无法判定实现是否符合，按证据不足归为未验证。
  - 待审批建议：unverified（no-server-evidence-is-not-conflict（本片 13 个原子服务端零证据，属取证空缺而非矛盾，不升级 conflict；同时按 evidence-is-not-consistency，客户端亦零证据，不得判 consistent，整体维持 unverified）），**尚未生效**。
- **验证结论（L7）**：verification_required；l7Basis=proposed（effectiveDifference=unverified，scope=unknown/default-unknown；复核条目 reviewStatus=pending，复核建议 unverified 尚未生效）。

### AT-ST-C17-002 恢复到断线瞬间对局状态

- **需求规则**：重连后恢复到断线瞬间的对局状态（需求原文 221 行）。即重连后呈现的牌局进度应是掉线那一刻的状态，可从中断处继续打。
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端在重连后按服务端下发的当前进度把牌桌还原到断线那一刻的样子，而不是空白的初始界面。本原子 evidenceIds 为空，无 CLE 证据可核对整局进度的还原逻辑。
  - 证据定位：无 CLE 证据（clientVerification.evidenceIds 为空）；取证覆盖缺口见 `2-client/client-evidence.json:1079-1091`。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端保存并下发断线这一瞬间的对局进度（谁该行动、各家的牌、牌墙剩余、已打出的牌等），作为重连恢复的数据来源。
  - configCondition：数据字段为空（本规则不依赖房间配置项，无配置生效条件可记录）。
  - 证据定位：无 SVE 证据（serverVerification.evidenceIds 为空）；`3-server/server-evidence.json` 无指向本阶段原子的 SVE 证据。
- **双端协作**：玩家掉线 → 对局继续进行 → 玩家重新连接 → 客户端请求恢复 → 服务端下发断线瞬间的对局进度 → 客户端据此还原整桌 → 玩家从中断处继续。
- **业务行为**：
  - trigger：玩家掉线后重新连接
  - condition：对局仍在进行中，且该玩家原先所在的这一小局未结束
  - action：客户端按服务端下发的当前进度把牌桌还原到断线那一刻的样子；服务端保存并下发断线瞬间的对局进度作为恢复数据来源
  - result：玩家看到的正是掉线那一刻的对局状态，可以从中断的地方接着打，不会感到进度被重置或跳过
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子要求「重连后恢复到断线瞬间的对局状态」，职责域为双端（服务端提供断点进度、客户端还原）。但统一原子视图中客户端与服务端均无任何证据（verdict 为空、evidenceIds 为空、无矛盾证据），仅有需求描述，无法判定状态还原是否准确，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（effectiveDifference=unverified，scope=unknown/default-unknown；无复核条目，按 proposed 基准判定）。

### AT-ST-C17-003 牌桌恢复

- **需求规则**：重连后恢复牌桌（需求原文 223 行）。
- **UI 要求**：重连后牌桌照常展示，不出现空白或未初始化牌桌。
- **验证范围**：client
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端在重连后重新搭起牌桌界面并把牌桌内容填满，不出现空白、残缺或未初始化的牌桌。本原子 evidenceIds 为空，无 CLE 证据可核对牌桌重建与填充的实现。
  - 证据定位：无 CLE 证据（clientVerification.evidenceIds 为空）；取证覆盖缺口见 `2-client/client-evidence.json:1079-1091`。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：该原子职责域为客户端，服务端行为不作判定要求（业务行为中服务端动作为「不作判定要求」）。
  - configCondition：数据字段为空（本规则不依赖房间配置项，无配置生效条件可记录）。
  - 证据定位：无 SVE 证据（serverVerification.evidenceIds 为空）；本阶段不存在指向本阶段原子的 SVE 证据。
- **双端协作**：玩家重新连接 → 客户端拿到当前对局进度 → 客户端重建牌桌界面并填充内容 → 玩家看到正常的牌桌。
- **业务行为**：
  - trigger：玩家掉线后重新连接
  - condition：对局仍在进行中
  - action：客户端在重连后重新搭起牌桌界面并把牌桌内容填满，不出现空白、残缺或未初始化的牌桌；该原子职责域为客户端，服务端行为不作判定要求
  - result：玩家重连后直接看到一个完整可用的牌桌，与断线前的牌桌样式一致，没有空白或未初始化的界面
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子要求「重连后恢复牌桌、不出现空白或未初始化牌桌」，判定职责域为客户端。但统一原子视图中客户端无任何证据（verdict 为空、evidenceIds 为空、无矛盾证据），无法判定牌桌还原是否实现，按证据不足归为未验证；服务端无证据不构成问题。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（effectiveDifference=unverified，scope=unknown/default-unknown；无复核条目）。

### AT-ST-C17-004 牌墙与余牌数恢复

- **需求规则**：重连后恢复牌墙与余牌数（需求原文 223 行）。
- **UI 要求**：牌墙展示与余牌数显示恢复为断线瞬间的数值。
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端在重连后把牌墙上剩下的牌与余牌数字按断线瞬间的数值展示出来。本原子 evidenceIds 为空，无 CLE 证据可核对余牌数的取值来源与展示。
  - 证据定位：无 CLE 证据（clientVerification.evidenceIds 为空）；取证覆盖缺口见 `2-client/client-evidence.json:1079-1091`。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端在重连时下发牌墙剩余张数（或等价的余牌信息），保证客户端拿到的不是初始值。
  - configCondition：数据字段为空（本规则不依赖房间配置项，无配置生效条件可记录）。
  - 证据定位：无 SVE 证据（serverVerification.evidenceIds 为空）；`3-server/server-evidence.json` 无指向本阶段原子的 SVE 证据。
- **双端协作**：玩家重新连接 → 客户端请求恢复 → 服务端下发断线瞬间的牌墙剩余数量 → 客户端按该数量还原牌墙与余牌显示 → 玩家看到正确的剩余张数。
- **业务行为**：
  - trigger：玩家掉线后重新连接
  - condition：对局仍在进行中，牌墙尚未摸完
  - action：客户端把牌墙剩余牌与余牌数字按断线瞬间的数值展示；服务端在重连时下发牌墙剩余张数或等价余牌信息
  - result：玩家重连后看到的余牌数与断线前完全一致，能据此判断牌墙还剩多少张
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子要求「重连后恢复牌墙与余牌数」，职责域为双端（服务端提供余牌数据、客户端展示）。但统一原子视图中客户端与服务端均无任何证据（verdict 为空、evidenceIds 为空、无矛盾证据），仅有需求描述，无法判定余牌数是否按断点还原，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（effectiveDifference=unverified，scope=unknown/default-unknown；无复核条目）。

### AT-ST-C17-005 各家手牌恢复

- **需求规则**：重连后恢复各家手牌（需求原文 223 行）。
- **UI 要求**：各家手牌按断线瞬间的数量与状态展示，自己的手牌完整可见。
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端在重连后把自己的手牌完整展示给本人，其他各家按断线瞬间的持牌张数展示牌背（不暴露他人牌面）。本原子 evidenceIds 为空，无 CLE 证据可核对手牌区还原与牌面可见性控制。
  - 证据定位：无 CLE 证据（clientVerification.evidenceIds 为空）；取证覆盖缺口见 `2-client/client-evidence.json:1079-1091`。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端在重连时把自己的完整手牌与各家持牌数量下发给该玩家，且只向本人下发其自己的牌面。
  - configCondition：数据字段为空（本规则不依赖房间配置项，无配置生效条件可记录）。
  - 证据定位：无 SVE 证据（serverVerification.evidenceIds 为空）；`3-server/server-evidence.json` 无指向本阶段原子的 SVE 证据。
- **双端协作**：玩家重新连接 → 客户端请求恢复 → 服务端核对该玩家身份 → 下发本人完整手牌与各家持牌数量 → 客户端还原手牌区 → 玩家可以接着出牌。
- **业务行为**：
  - trigger：玩家掉线后重新连接
  - condition：对局仍在进行中
  - action：客户端把本人手牌完整展示、其他各家按断线瞬间持牌张数展示牌背；服务端核对该玩家身份后下发本人完整手牌与各家持牌数量，且只向本人下发其自己的牌面
  - result：玩家重连后看到与断线前一致的手牌，自己的牌完整可见，各家的持牌张数也对得上，可以立刻继续出牌
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子要求「重连后恢复各家手牌、自己的手牌完整可见」，职责域为双端（服务端下发手牌与座位牌数、客户端展示）。但统一原子视图中客户端与服务端均无任何证据（verdict 为空、evidenceIds 为空、无矛盾证据），仅有需求描述，无法判定手牌还原与可见性是否符合，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（effectiveDifference=unverified，scope=unknown/default-unknown；无复核条目）。

### AT-ST-C17-006 出牌区恢复

- **需求规则**：重连后恢复出牌区（需求原文 223 行）。
- **UI 要求**：出牌区按断线瞬间各家已打出的牌还原展示。
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端在重连后把各家已经打出的牌按断线瞬间的样子摆回出牌区，顺序与张数都不缺。本原子 evidenceIds 为空，无 CLE 证据可核对出牌区还原逻辑。
  - 证据定位：无 CLE 证据（clientVerification.evidenceIds 为空）；取证覆盖缺口见 `2-client/client-evidence.json:1079-1091`。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端在重连时下发本小局各家已打出的牌记录，作为出牌区还原依据。
  - configCondition：数据字段为空（本规则不依赖房间配置项，无配置生效条件可记录）。
  - 证据定位：无 SVE 证据（serverVerification.evidenceIds 为空）；`3-server/server-evidence.json` 无指向本阶段原子的 SVE 证据。
- **双端协作**：玩家重新连接 → 客户端请求恢复 → 服务端下发送出牌记录 → 客户端还原各家出牌区 → 玩家看到与断线前相同的牌河。
- **业务行为**：
  - trigger：玩家掉线后重新连接
  - condition：对局仍在进行中，且本小局已有人打出过牌
  - action：客户端把各家已打出的牌按断线瞬间的样子摆回出牌区；服务端在重连时下发本小局各家已打出的牌记录
  - result：玩家重连后看到的出牌区与断线前一致，之前打出的牌一张不少，可以接着判断已经出过哪些牌
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子要求「重连后恢复出牌区」，职责域为双端（服务端下发已出牌记录、客户端还原展示）。但统一原子视图中客户端与服务端均无任何证据（verdict 为空、evidenceIds 为空、无矛盾证据），仅有需求描述，无法判定出牌区是否按断点还原，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（effectiveDifference=unverified，scope=unknown/default-unknown；无复核条目）。

### AT-ST-C17-007 轮次恢复

- **需求规则**：重连后恢复轮次（需求原文 223 行）。
- **UI 要求**：轮次指示恢复到断线瞬间的当前行动方。
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端在重连后把等待行动的一方高亮出来，让玩家一眼看出现在轮到自己还是别人。本原子 evidenceIds 为空，无 CLE 证据可核对轮次指示的恢复来源。
  - 证据定位：无 CLE 证据（clientVerification.evidenceIds 为空）；取证覆盖缺口见 `2-client/client-evidence.json:1079-1091`。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端在重连时告知当前该谁行动（以及该玩家能否操作），不让重连的玩家被误当成该出牌的一方。
  - configCondition：数据字段为空（本规则不依赖房间配置项，无配置生效条件可记录）。
  - 证据定位：无 SVE 证据（serverVerification.evidenceIds 为空）；`3-server/server-evidence.json` 无指向本阶段原子的 SVE 证据。
- **双端协作**：玩家重新连接 → 客户端请求恢复 → 服务端下发当前行动方 → 客户端点亮对应的轮次指示 → 玩家知道自己是否该出牌。
- **业务行为**：
  - trigger：玩家掉线后重新连接
  - condition：对局仍在进行中，轮到某一方行动
  - action：客户端把等待行动的一方高亮出来；服务端在重连时告知当前该谁行动以及该玩家能否操作
  - result：玩家重连后看到的轮次指示与断线前一致，能立刻判断现在是不是自己该行动
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子要求「重连后恢复轮次，指示当前行动方」，职责域为双端（服务端确定当前行动方、客户端展示轮次指示）。但统一原子视图中客户端与服务端均无任何证据（verdict 为空、evidenceIds 为空、无矛盾证据），仅有需求描述，无法判定轮次是否按断点还原，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（effectiveDifference=unverified，scope=unknown/default-unknown；无复核条目）。

### AT-ST-C17-008 飘标恢复

- **需求规则**：重连后恢复飘标（需求原文 223 行）。
- **UI 要求**：飘标按断线瞬间的飘次数还原展示。
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端在重连后把各家的飘标按断线瞬间的飘次数重新显示在对应座位上。本原子 evidenceIds 为空，无 CLE 证据可核对飘标还原。
  - 证据定位：无 CLE 证据（clientVerification.evidenceIds 为空）；取证覆盖缺口见 `2-client/client-evidence.json:1079-1091`。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端在重连时下发各家在本小局的飘次数，作为飘标还原依据。
  - configCondition：数据字段为空（本规则不依赖房间配置项，无配置生效条件可记录）。
  - 证据定位：无 SVE 证据（serverVerification.evidenceIds 为空）；`3-server/server-evidence.json` 无指向本阶段原子的 SVE 证据。
- **双端协作**：玩家重新连接 → 客户端请求恢复 → 服务端下发各家的飘次数 → 客户端在各座位上还原飘标 → 玩家看到与断线前相同的飘标。
- **业务行为**：
  - trigger：玩家掉线后重新连接
  - condition：对局仍在进行中，且本小局中有人飘过
  - action：客户端把各家飘标按断线瞬间的飘次数重新显示在对应座位上；服务端在重连时下发各家在本小局的飘次数
  - result：玩家重连后看到的飘标与断线前一致，能看出谁飘了几次
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子要求「重连后恢复飘标、按飘次数还原」，职责域为双端（服务端下发飘次数、客户端展示飘标）。但统一原子视图中客户端与服务端均无任何证据（verdict 为空、evidenceIds 为空、无矛盾证据），仅有需求描述，无法判定飘标是否按断点还原，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（effectiveDifference=unverified，scope=unknown/default-unknown；无复核条目）。

### AT-ST-C17-009 记牌器恢复

- **需求规则**：重连后恢复记牌器（需求原文 223 行）。
- **UI 要求**：记牌器展示恢复为断线瞬间的统计结果。
- **验证范围**：client
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端在重连后把记牌器恢复成断线瞬间的统计结果，显示已经出现过、还没出现的牌，而不是从零开始重新统计。本原子 evidenceIds 为空，无 CLE 证据可核对记牌器统计的恢复方式（重算或还原）。
  - 证据定位：无 CLE 证据（clientVerification.evidenceIds 为空）；取证覆盖缺口见 `2-client/client-evidence.json:1079-1091`。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：该原子职责域为客户端，服务端行为不作判定要求（业务行为中服务端动作为「不作判定要求」）。
  - configCondition：数据字段为空（本规则不依赖房间配置项，无配置生效条件可记录）。
  - 证据定位：无 SVE 证据（serverVerification.evidenceIds 为空）；本阶段不存在指向本阶段原子的 SVE 证据。
- **双端协作**：玩家重新连接 → 客户端拿到恢复后的对局数据 → 客户端据此重算或还原记牌器统计 → 玩家看到与断线前相同的记牌器。
- **业务行为**：
  - trigger：玩家掉线后重新连接
  - condition：对局仍在进行中，且该玩家在对局中使用了记牌器
  - action：客户端把记牌器恢复成断线瞬间的统计结果，显示已经出现过、还没出现的牌，而不是从零开始重新统计；该原子职责域为客户端
  - result：玩家重连后记牌器显示的统计与断线前一致，不需要自己重新回忆已经出过哪些牌
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子要求「重连后恢复记牌器统计」，判定职责域为客户端。但统一原子视图中客户端无任何证据（verdict 为空、evidenceIds 为空、无矛盾证据），无法判定记牌器还原是否实现，按证据不足归为未验证；服务端无证据不构成问题。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（effectiveDifference=unverified，scope=unknown/default-unknown；无复核条目）。

### AT-ST-C17-010 打哪张听箭头缓存恢复

- **需求规则**：「打哪张听」箭头若重连数据未补发，先用断线前的缓存恢复（需求原文 224 行）。
- **UI 要求**：「打哪张听」箭头在重连数据未到达前按断线前缓存展示。
- **验证范围**：client
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端在服务端数据到达之前，先用断线前本地存下的箭头信息把「打哪张听」提示先显示出来，避免重连后一段时间内没有任何提示。本原子 evidenceIds 为空，无 CLE 证据可核对是否存在该本地缓存回填逻辑。
  - 证据定位：无 CLE 证据（clientVerification.evidenceIds 为空）；取证覆盖缺口见 `2-client/client-evidence.json:1079-1091`。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：该原子职责域为客户端，服务端行为不作判定要求（业务行为中服务端动作为「不作判定要求」）。
  - configCondition：数据字段为空（本规则不依赖房间配置项，无配置生效条件可记录）。
  - 证据定位：无 SVE 证据（serverVerification.evidenceIds 为空）；本阶段不存在指向本阶段原子的 SVE 证据。
- **双端协作**：玩家重新连接 → 客户端先展示断线前缓存的「打哪张听」箭头 → 等待服务端后续补发数据 → 期间玩家不会看到提示消失。
- **业务行为**：
  - trigger：玩家掉线后重新连接
  - condition：重连数据里暂时还没有补发「打哪张听」的箭头信息
  - action：客户端在服务端数据到达之前，先用断线前本地存下的箭头信息把「打哪张听」提示先显示出来；该原子职责域为客户端
  - result：玩家重连后在数据还没到的这段时间里，仍能看到断线前那条「打哪张听」箭头提示
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子要求「重连数据未补发前先用断线前缓存恢复『打哪张听』箭头」，判定职责域为客户端。但统一原子视图中客户端无任何证据（verdict 为空、evidenceIds 为空、无矛盾证据），无法判定是否存在该缓存回填逻辑，按证据不足归为未验证；服务端无证据不构成问题。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（effectiveDifference=unverified，scope=unknown/default-unknown；无复核条目）。

### AT-ST-C17-011 服务端数据覆盖箭头

- **需求规则**：服务端数据到达后，以服务端为准覆盖箭头（需求原文 224 行）。
- **UI 要求**：「打哪张听」箭头在服务端数据到达后按服务端结果刷新。
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端在服务端数据到达后立即用服务端结果替换此前显示的缓存箭头，不再沿用旧缓存。本原子 evidenceIds 为空，无 CLE 证据可核对覆盖刷新与优先级实现。
  - 证据定位：无 CLE 证据（clientVerification.evidenceIds 为空）；取证覆盖缺口见 `2-client/client-evidence.json:1079-1091`。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端在重连恢复阶段补发「打哪张听」箭头所依据的数据，作为最终权威结果。
  - configCondition：数据字段为空（本规则不依赖房间配置项，无配置生效条件可记录）。
  - 证据定位：无 SVE 证据（serverVerification.evidenceIds 为空）；`3-server/server-evidence.json` 无指向本阶段原子的 SVE 证据，无箭头数据补发证据。
- **双端协作**：重连恢复中 → 服务端补发箭头数据 → 客户端收到后覆盖缓存箭头 → 箭头按服务端结果重新显示。
- **业务行为**：
  - trigger：重连后服务端补发的数据到达客户端
  - condition：服务端在重连恢复中补发了「打哪张听」箭头相关的数据
  - action：客户端在服务端数据到达后立即用服务端结果替换此前显示的缓存箭头；服务端在重连恢复阶段补发「打哪张听」箭头所依据的数据
  - result：玩家最终看到的「打哪张听」箭头是服务端判定的结果，而不是一直停留在断线前的旧提示
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子要求「服务端数据到达后以服务端为准覆盖箭头」，职责域为双端（服务端补发数据、客户端覆盖刷新）。但统一原子视图中客户端与服务端均无任何证据（verdict 为空、evidenceIds 为空、无矛盾证据），仅有需求描述，无法判定覆盖刷新是否实现，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（effectiveDifference=unverified，scope=unknown/default-unknown；无复核条目）。

### AT-ST-C17-012 恢复完成后上报定位

- **需求规则**：恢复完成后客户端上报定位（需求原文 225 行）。
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端在恢复完成后主动把当前所处的定位上报，让服务端知道玩家已经回到牌桌的哪一步。本原子 evidenceIds 为空，无 CLE 证据可核对定位上报的触发点与上报内容。
  - 证据定位：无 CLE 证据（clientVerification.evidenceIds 为空）；取证覆盖缺口见 `2-client/client-evidence.json:1079-1091`。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端接收并记录该定位，据此继续向该玩家推送后续的对局进展。
  - configCondition：数据字段为空（本规则不依赖房间配置项，无配置生效条件可记录）。
  - 证据定位：无 SVE 证据（serverVerification.evidenceIds 为空）；`3-server/server-evidence.json` 无指向本阶段原子的 SVE 证据，无定位上报接收处理证据。
- **双端协作**：场景恢复完成 → 客户端上报当前定位 → 服务端确认定位并继续推进对局 → 玩家无需再做任何额外操作。
- **业务行为**：
  - trigger：重连后场景恢复（牌桌与对局进度）完成
  - condition：对局仍处于进行中
  - action：客户端在恢复完成后主动把当前所处的定位上报；服务端接收并记录该定位，据此继续向该玩家推送后续对局进展
  - result：玩家不需要额外点任何东西，恢复完成后对局就按当前定位顺畅衔接下去
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子要求「恢复完成后客户端上报定位」，职责域为双端（客户端上报、服务端接收并衔接）。但统一原子视图中客户端与服务端均无任何证据（verdict 为空、evidenceIds 为空、无矛盾证据），仅有需求描述，无法判定是否真的上报并衔接，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（effectiveDifference=unverified，scope=unknown/default-unknown；无复核条目）。

### AT-ST-C17-013 随后继续对局

- **需求规则**：恢复完成后随后继续对局（需求原文 225 行）。
- **验证范围**：both
- **客户端职责**：
  - clientVerification.verdict：空（无客户端验证结论）
  - 实现要点：按需求，客户端继续按正常流程响应摸牌、出牌等操作，不再停留在恢复界面。本原子 evidenceIds 为空，无 CLE 证据可核对恢复后流程衔接。
  - 证据定位：无 CLE 证据（clientVerification.evidenceIds 为空）；取证覆盖缺口见 `2-client/client-evidence.json:1079-1091`。
- **服务端职责**：
  - serverVerification.applicability：空（无服务端适用性结论）
  - 规则说明：按需求，服务端从断线瞬间的进度继续推进对局，正常轮转行动方、处理摸打。
  - configCondition：数据字段为空（本规则不依赖房间配置项，无配置生效条件可记录）。
  - 证据定位：无 SVE 证据（serverVerification.evidenceIds 为空）；`3-server/server-evidence.json` 无指向本阶段原子的 SVE 证据，无续推进程证据。
- **双端协作**：恢复完成 → 客户端上报定位 → 服务端从该进度继续推进 → 轮到谁谁正常摸打 → 对局不中断。
- **业务行为**：
  - trigger：重连恢复完成并上报定位之后
  - condition：对局仍处于进行中、尚未结算
  - action：客户端继续按正常流程响应摸牌、出牌等操作，不再停留在恢复界面；服务端从断线瞬间的进度继续推进对局，正常轮转行动方、处理摸打
  - result：玩家可以像没掉过线一样继续摸牌出牌，对局顺畅往下进行，不会卡住或被迫重开
- **实际实现差异**：
  - difference：unverified
  - baselineDetail：该原子要求「恢复完成后随后继续对局」，职责域为双端（服务端续推进程、客户端正常响应）。但统一原子视图中客户端与服务端均无任何证据（verdict 为空、evidenceIds 为空、无矛盾证据），仅有需求描述，无法判定恢复后能否正常续打，按证据不足归为未验证。
  - 本原子在 difference-review.json 中无复核条目，无待审批建议。
- **验证结论（L7）**：verification_required；l7Basis=proposed（effectiveDifference=unverified，scope=unknown/default-unknown；无复核条目）。

## 证据索引

本阶段 13 个原子的 `clientVerification.evidenceIds` 与 `serverVerification.evidenceIds` 均为空，客户端与服务端均无 atomIds 指向 ST-C17 的直达证据：不存在指向本阶段原子的 CLE 证据，也不存在指向本阶段原子的 SVE 证据。因此本阶段没有可列出的 CLE/SVE 证据条目（id + layer + file:line + claimKey 均为空）。

取证缺口定位（非证据，仅用于说明零证据状态与补证入口）：

| 定位项 | layer | file:line | claimKey / 说明 |
|---|---|---|---|
| coverage.pendingAtomIds（含 AT-ST-C17-001 ~ AT-ST-C17-013 共 13 项） | client_code | 2-client/client-evidence.json:1079-1091 | 无；客户端取证未覆盖本阶段，13 个原子均在 pending 列表 |
| client evidence 集合 | client_code | 2-client/client-evidence.json（stats：atomCount=29，evidenceCount=12） | 无；12 条 CLE 的 atomIds 全为 AT-ST-C01-* |
| server evidence 集合 | common_game / hzmj_server | 3-server/server-evidence.json（stats：atomCount=29，pending=387） | 无；60 条 SVE 的 atomIds 全为 AT-ST-C01-* |

## 待处理事项

本阶段 13 个原子均在 pending-list.md「规则待验证（412）」分组中（pending-list.md:272-284），建议动作统一为「补证 both」。本阶段无「查证未完成（必要端缺口）」条目、无「需策划裁决」条目。

| atomId | 验证范围 | 问题 | 说明 | 建议动作 |
|---|---|---|---|---|
| AT-ST-C17-001 | both | 规则待验证 | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C17-002 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C17-003 | client | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C17-004 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C17-005 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C17-006 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C17-007 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C17-008 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C17-009 | client | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C17-010 | client | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C17-011 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C17-012 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C17-013 | both | 规则待验证 | 证据不足 | 补证 both |

补充：

- 本阶段无 analysisPath=blocked 原子，无 pending-blocked 的 l7Basis，因此不存在「查证未完成」结论；取证缺口表现为双端零证据（取证空缺），而非执行中断。
- 无 analysisPath=conflict-fast 原子，无 conflict 结论，不存在另一端查证状态 pending 的冲突待办。
- 无升级原子：13 个原子 candidateDifference / candidateDetail 均为空，不涉及「历史基线 + 本轮候选 + 候选待审批」，也不存在尚未生效的候选差异。
- AT-ST-C17-001 有 1 条 reviewStatus=pending 的待审批复核建议（reviewedDifference=unverified，reviewRule=no-server-evidence-is-not-conflict），**尚未生效**，需审批后方可作为最终差异结论；其余 12 个原子无复核条目。
- 补证重点（客户端）：重连成功后进入仍在进行的小局而非重新开局、断线瞬间整桌还原（牌桌重建、牌墙余牌、本人手牌与他人牌数、出牌区、轮次高亮、飘标、记牌器统计）、「打哪张听」箭头的断线前缓存回填与服务端数据到达后的覆盖刷新、恢复完成后定位上报与正常摸打流程衔接。
- 补证重点（服务端）：重连身份识别与不重开小局判定、断线瞬间进度快照的下发（含余牌数、手牌与座位牌数、已出牌记录、当前行动方、飘次数）、「打哪张听」箭头数据补发、定位上报的接收与后续对局推进。
