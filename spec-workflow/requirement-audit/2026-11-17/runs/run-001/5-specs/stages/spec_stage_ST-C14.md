# ST-C14 杠开、杠飘、飘杠

## 阶段概述

本阶段规定「行牌 > 杠开、杠飘、飘杠」一节的结算口径：按杠链长度判定杠上开花与二/三/四连杠并给出 2/4/8/16 倍，杠链已断后再胡不记杠开；杠飘、飘杠仅在同时命中杠上开花与财飘时拆出，固定 8 倍再乘基础番，并按「杠发生时飘档是否已大于 0」区分飘杠与杠飘；更高档组合不拆仍按连乘，且不单列杠爆、七客。

- 原子数：11（AT-ST-C14-001 ~ AT-ST-C14-011），分属 2 个功能点：FP-ST-C14-001 杠上开花与连杠倍数（001-005，共 5 个）、FP-ST-C14-002 杠飘与飘杠拆分（006-011，共 6 个）。
- L7 分布：verified 0 / verification_required 11 / decision_required 0 / not_applicable 0。
- analysisPath 分布：11 个原子全部为 `full`（无 blocked、无 conflict-fast）。
- 取证现状：本阶段 11 个原子在统一原子视图中双端字段均为空（`client.verdict` 空、`server.applicability` 空、`evidenceIds` 空），`trace_index.json` 对 11 个原子的 `evidenceCount` 均为 0，effectiveDifference 一律为 `unverified`；其中 AT-ST-C14-001 / 006 / 011 存在 `reviewStatus=pending` 的复核建议（建议值仍为 unverified），尚未生效，详见各原子「实际实现差异」与「待处理事项」。
- 需求原文行号：杠上开花与连杠（001-005）= PRD 第 180 行；杠飘/飘杠拆分（006-011）= PRD 第 181 行；章节均为「行牌 > 杠开、杠飘、飘杠」。
- 验证范围：11 个原子 `verificationScope` 均为 `server`，所需端为服务端；但 L7 分类的 `scope` 字段本阶段均为 `unknown`（`scopeSource=default-unknown`），属分类侧未收敛的默认值，与 `verificationScope` 不是同一字段。

| 原子 | 名称 | 验证范围 | difference | L7 | 复核 |
|---|---|---|---|---|---|
| AT-ST-C14-001 | 杠上开花一倍 | server | unverified | verification_required | pending / 未生效 |
| AT-ST-C14-002 | 二连杠倍数 | server | unverified | verification_required | 无 |
| AT-ST-C14-003 | 三连杠倍数 | server | unverified | verification_required | 无 |
| AT-ST-C14-004 | 四连杠及以上倍数 | server | unverified | verification_required | 无 |
| AT-ST-C14-005 | 杠链已断不算杠开 | server | unverified | verification_required | 无 |
| AT-ST-C14-006 | 杠飘飘杠拆出条件 | server | unverified | verification_required | pending / 未生效 |
| AT-ST-C14-007 | 杠飘飘杠倍数与基础番 | server | unverified | verification_required | 无 |
| AT-ST-C14-008 | 飘杠判定 | server | unverified | verification_required | 无 |
| AT-ST-C14-009 | 杠飘判定 | server | unverified | verification_required | 无 |
| AT-ST-C14-010 | 高档组合不拆按连乘 | server | unverified | verification_required | 无 |
| AT-ST-C14-011 | 无单独杠爆七客 | server | unverified | verification_required | pending / 未生效 |

## 需求条目

### AT-ST-C14-001 杠上开花一倍

- 所属功能点：FP-ST-C14-001 杠上开花与连杠倍数（PRD 第 180 行）
- **需求规则**：杠上开花：自摸且杠链为 1，倍数 2。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，客户端未给出结论；`clientEvidenceIds` 为空，本轮无指向「杠上开花/杠链」的 CLE 证据。复核说明中提及的两条客户端条目均不构成本原子证据：CLE-AT-ST-C01-005-02（`config/FanDefine.ts:637-638`，claimKey=`hu-result-label-dianpao`）只证明结算文案「点炮胡/放炮」，CLE-AT-ST-C01-004-04（`data/GameData.ts:1664-1666`，claimKey=`banker-level-multiplier`）只证明庄闲倍数换算。实现要点（需求口径）：客户端不参与番型与倍数判定，只按服务端下发的结算项展示「杠上开花」名称与对应倍数；当前无证据证明该展示分支存在。
- **服务端职责**：`serverApplicability` 为空，服务端未给出适用性判定；`serverEvidenceIds` 为空，`server-evidence.json` 全量 60 条证据中按「杠」「番」「飘」检索均无命中。需求口径为：自摸结算时若杠链长度为 1，判为杠上开花并按 2 倍计入该组番型。配置生效条件（`configCondition`）为空，未登记任何开关。
- **双端协作**：无法还原：本原子需服务端判定番型后由客户端呈现，但双端均未定位到实现证据（协作字段原文语义）。
- **业务行为**：
  - trigger：玩家自摸胡牌
  - condition：这次胡牌是自摸，且此前只连着一杠（杠链为 1）
  - action：应由服务端在自摸且杠链为 1 时判为杠上开花并按 2 倍计入（本次未取得服务端实现证据）；客户端不负责判定，只展示服务端下发结果（本次未取得客户端证据，无法确认展示形态）
  - result：无法确认玩家在结算中是否看到「杠上开花」并按 2 倍计入
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空（无升级候选）。
  `baselineDetail`：需求要求自摸且杠链为 1 时记杠上开花、倍数 2。实际取证情况：客户端与服务端均未定位到该番型的实现证据（该原子在双端取证清单中均列为待补），既无符合证据也无矛盾证据，无法判定。
  待审批建议：unverified（`no-server-evidence-is-not-conflict`：杠链/杠开番型双端无证据，属取证空缺，维持未验证）。该建议未生效。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（依据 effectiveDifference=unverified 提议；scope=unknown，scopeSource=`default-unknown`）。

### AT-ST-C14-002 二连杠倍数

- 所属功能点：FP-ST-C14-001 杠上开花与连杠倍数（PRD 第 180 行）
- **需求规则**：二连杠：自摸且杠链为 2，倍数 4。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；无 CLE 证据涉及连杠番型或杠数档位。实现要点（需求口径）：客户端仅按服务端结算项展示「二连杠」名称与 4 倍，不承担杠链计数。
- **服务端职责**：`serverApplicability` 为空，`serverEvidenceIds` 为空；`server-evidence.json` 60 条证据无 atomIds 含 C14 的记录，亦无杠链/连杠计数相关条目。需求口径为：自摸时杠链长度为 2 记二连杠、倍数 4。`configCondition` 为空，未登记开关。
- **双端协作**：无法还原：需服务端判定番型后由客户端呈现，但双端均未定位到实现证据。
- **业务行为**：
  - trigger：玩家自摸胡牌
  - condition：这次胡牌是自摸，且此前连续两杠（杠链为 2）
  - action：应由服务端在自摸且杠链为 2 时判为二连杠并按 4 倍计入（本次未取得服务端实现证据）；客户端仅展示下发结果（未取得证据）
  - result：无法确认玩家在结算中是否看到「二连杠」名称并按 4 倍计入
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求要求自摸且杠链为 2 时记二连杠，倍数 4。实际取证情况：双端均未定位到该番型的实现证据，无符合证据也无矛盾证据，无法判定。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C14-003 三连杠倍数

- 所属功能点：FP-ST-C14-001 杠上开花与连杠倍数（PRD 第 180 行）
- **需求规则**：三连杠：自摸且杠链为 3，倍数 8。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；无 CLE 证据涉及三连杠档位。实现要点（需求口径）：客户端仅按服务端结算项展示「三连杠」与 8 倍。
- **服务端职责**：`serverApplicability` 为空，`serverEvidenceIds` 为空；无 C14 归属服务端证据。需求口径为：自摸时杠链长度为 3 记三连杠、倍数 8。`configCondition` 为空。
- **双端协作**：无法还原：需服务端判定番型后由客户端呈现，但双端均未定位到实现证据。
- **业务行为**：
  - trigger：玩家自摸胡牌
  - condition：这次胡牌是自摸，且此前连续三杠（杠链为 3）
  - action：应由服务端在自摸且杠链为 3 时判为三连杠并按 8 倍计入（本次未取得服务端实现证据）；客户端仅展示下发结果（未取得证据）
  - result：无法确认玩家在结算中是否看到「三连杠」名称并按 8 倍计入
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求要求自摸且杠链为 3 时记三连杠，倍数 8。实际取证情况：双端均未定位到该番型的实现证据，无法判定符合性。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C14-004 四连杠及以上倍数

- 所属功能点：FP-ST-C14-001 杠上开花与连杠倍数（PRD 第 180 行）
- **需求规则**：四连杠：自摸且杠链为 4 及以上，倍数 16；四连杠及以上都记 16 倍。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；无 CLE 证据涉及封顶档位。实现要点（需求口径）：客户端仅展示「四连杠」与 16 倍，杠数超过 4 时也应是同一档展示，不自行递增。
- **服务端职责**：`serverApplicability` 为空，`serverEvidenceIds` 为空；无 C14 归属服务端证据。需求口径为：自摸时杠链长度为 4 及以上统一记四连杠、倍数 16，并在此封顶，不随杠数继续递增。`configCondition` 为空，未登记封顶相关配置键。
- **双端协作**：无法还原：需服务端判定番型后由客户端呈现，但双端均未定位到实现证据。
- **业务行为**：
  - trigger：玩家自摸胡牌
  - condition：这次胡牌是自摸，且此前连续四杠或更多（杠链为 4 及以上）
  - action：应由服务端在杠链为 4 及以上时统一判为四连杠并按 16 倍计入且不再随杠数递增（本次未取得服务端实现证据）；客户端仅展示下发结果（未取得证据）
  - result：无法确认玩家在结算中是否看到「四连杠」并按 16 倍计入（更高杠数是否封顶同样无法确认）
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求要求自摸且杠链为 4 及以上时统一记四连杠、倍数 16，不再随杠数继续递增。实际取证情况：双端均未定位到该番型与封顶逻辑的实现证据，无法判定是否符合。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C14-005 杠链已断不算杠开

- 所属功能点：FP-ST-C14-001 杠上开花与连杠倍数（PRD 第 180 行）
- **需求规则**：杠链已断后再胡，不是杠开。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；无 CLE 证据涉及杠链断开的判定或结算标记。实现要点（需求口径）：客户端不得自行推断杠开状态，只按服务端下发的结算项展示；服务端不判杠开时客户端也不应出现杠开类标记。
- **服务端职责**：`serverApplicability` 为空，`serverEvidenceIds` 为空；无 C14 归属服务端证据。需求口径为：杠链一旦断开，其后的胡牌不再判为杠上开花、不按杠开倍数计入，结算中不出现杠开类标记。`configCondition` 为空。
- **双端协作**：无法还原：判定完全在服务端，双端均未定位到实现证据。
- **业务行为**：
  - trigger：玩家胡牌（原生需求针对杠链已断开的情形）
  - condition：此前杠链已经断开，之后才胡牌
  - action：应由服务端在杠链已断开时不再判为杠上开花、不按杠开倍数计入（本次未取得服务端实现证据）；客户端仅展示下发结果（未取得证据）
  - result：无法确认玩家结算中是否会出现不该有的杠开类标记或杠开倍数
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求要求杠链已断开后再胡，不算杠开，结算中不出现杠开类标记也不按杠开倍数计入。实际取证情况：双端均未定位到杠链断开的判定实现，无法判定。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C14-006 杠飘飘杠拆出条件

- 所属功能点：FP-ST-C14-002 杠飘与飘杠拆分（PRD 第 181 行）
- **需求规则**：杠飘、飘杠只在同时命中杠上开花和财飘时拆出。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；复核说明明确 client-evidence.json 12 条中无任何条目覆盖「财飘/杠飘/飘杠」拆分。被复核点名的两条客户端条目属财神口径而非财飘番型，不构成本原子证据：CLE-AT-ST-C01-003-02（`data/GameData.ts:50`，claimKey=`cai-shen-type-values`，定义「0=白板财神，1=翻财神」）、CLE-AT-ST-C01-003-03（`controller/cmd/gameCmd/GameJokerCmd.ts:74-77`，claimKey=`cai-shen-type-room-rule`）。实现要点（需求口径）：客户端不负责拆分，只按服务端下发的结算项展示「杠飘」或「飘杠」；未拆出时客户端不应自行补该项。
- **服务端职责**：`serverApplicability` 为空，`serverEvidenceIds` 为空；复核说明确认 server-evidence.json 60 条中无番型拆分/加成条目，被点名的两条仅为旁路佐证，不构成本原子证据：SVE-AT-ST-C01-019-03（`hzmj_server/game_logic.cpp:65-87`，claimKey=`three-tan-forced-off-for-two-players`，只证明 ≤2 人房强制关闭三摊承包）、SVE-AT-ST-C01-005-01（`common_game/com_game/common_game_com_action.cpp:353-358`，claimKey=`banker-discard-hu-requires-three-level`，只证明三牢放铳）。需求口径为：同一次结算同时命中杠上开花与财飘时才拆出杠飘或飘杠单独计算，未同时命中则不出现该项。`configCondition` 为空。
- **双端协作**：无法还原：拆分判定与拆项计算均在服务端，双端均未定位到实现证据。
- **业务行为**：
  - trigger：玩家胡牌结算
  - condition：同一次结算中同时命中杠上开花与财飘
  - action：应由服务端在同时命中杠上开花与财飘时拆出杠飘或飘杠单独计算，未同时命中时不出现该项（本次未取得服务端实现证据）；客户端只展示下发结算项（未取得证据）
  - result：无法确认玩家结算中是否会出现「杠飘」或「飘杠」项目，以及不该出现时是否被误加
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求要求杠飘、飘杠只在同时命中杠上开花和财飘时拆出单独计算，未同时命中则不出现。实际取证情况：双端均未定位到该项拆分逻辑，无法判定。
  待审批建议：unverified（`no-server-evidence-is-not-conflict`：杠飘/飘杠拆分无服务端证据，不得据此判冲突）。该建议未生效。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C14-007 杠飘飘杠倍数与基础番

- 所属功能点：FP-ST-C14-002 杠飘与飘杠拆分（PRD 第 181 行）
- **需求规则**：杠飘、飘杠倍数 8，再乘上基础番。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；无 CLE 证据涉及该项倍数口径。实现要点（需求口径）：客户端只展示服务端下发的该项倍数，不参与 8 倍与基础番的相乘计算。
- **服务端职责**：`serverApplicability` 为空，`serverEvidenceIds` 为空；无 C14 归属服务端证据。需求口径为：杠飘/飘杠项按固定 8 倍计数，再乘上本局基础番，得出该项最终倍数。`configCondition` 为空；基础番在需求中为既有口径，本阶段未登记其配置键。
- **双端协作**：无法还原：倍数相乘由服务端完成，双端均未定位到实现证据。
- **业务行为**：
  - trigger：判定出杠飘或飘杠时
  - condition：已同时命中杠上开花与财飘，进入杠飘/飘杠倍数计算
  - action：应由服务端按 8 倍计数并再乘上基础番得出该项倍数（本次未取得服务端实现证据）；客户端只展示下发倍数（未取得证据）
  - result：无法确认玩家结算中该项倍数是否为 8 倍与基础番相乘后的结果
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求要求杠飘、飘杠倍数 8，再乘上基础番。实际取证情况：双端均未定位到该项倍数计算实现，无法判定倍数口径是否正确。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C14-008 飘杠判定

- 所属功能点：FP-ST-C14-002 杠飘与飘杠拆分（PRD 第 181 行）
- **需求规则**：杠发生时飘档已经大于 0，记飘杠。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；无 CLE 证据涉及飘档与杠的时序比较。实现要点（需求口径）：客户端不参与该时序判定，只展示服务端下发的项目名称（飘杠）。
- **服务端职责**：`serverApplicability` 为空，`serverEvidenceIds` 为空；无 C14 归属服务端证据。需求口径为：以「杠发生那一刻」的时点取飘档值，若该值已大于 0，则把此组合记为飘杠（与 AT-ST-C14-009 构成互斥分支）。`configCondition` 为空。
- **双端协作**：无法还原：飘档时点比较在服务端进行，双端均未定位到实现证据。
- **业务行为**：
  - trigger：杠飘/飘杠拆分判定时
  - condition：杠发生的那一刻，玩家的飘档已经大于 0
  - action：应由服务端在杠发生时飘档已大于 0 的情况下把该组合记为飘杠（本次未取得服务端实现证据）；客户端只展示下发项目名称（未取得证据）
  - result：无法确认玩家结算中该项显示为「飘杠」
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求要求杠发生时飘档已经大于 0，记飘杠。实际取证情况：双端均未定位到飘档与杠时序的比较实现，无法判定口径是否一致。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C14-009 杠飘判定

- 所属功能点：FP-ST-C14-002 杠飘与飘杠拆分（PRD 第 181 行）
- **需求规则**：杠发生时飘档不大于 0（未大于 0），记杠飘。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；无 CLE 证据涉及该时序判定。实现要点（需求口径）：客户端不参与判定，只展示服务端下发的项目名称（杠飘）。
- **服务端职责**：`serverApplicability` 为空，`serverEvidenceIds` 为空；无 C14 归属服务端证据。需求口径为：杠发生时飘档未大于 0（≤0，含尚未飘的情形）时记杠飘，与 AT-ST-C14-008 互为补集，二者在一次判定中不可同时成立。`configCondition` 为空。
- **双端协作**：无法还原：飘档时点比较在服务端进行，双端均未定位到实现证据。
- **业务行为**：
  - trigger：杠飘/飘杠拆分判定时
  - condition：杠发生的那一刻，玩家的飘档尚未大于 0
  - action：应由服务端在杠发生时飘档未大于 0 的情况下把该组合记为杠飘（本次未取得服务端实现证据）；客户端只展示下发项目名称（未取得证据）
  - result：无法确认玩家结算中该项显示为「杠飘」
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求要求杠发生时飘档未大于 0，记杠飘。实际取证情况：双端均未定位到飘档与杠时序的比较实现，无法判定。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C14-010 高档组合不拆按连乘

- 所属功能点：FP-ST-C14-002 杠飘与飘杠拆分（PRD 第 181 行）
- **需求规则**：二连杠、双财飘及更高档不拆，仍按各组连乘。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；无 CLE 证据涉及组合分档与连乘。实现要点（需求口径）：客户端不负责组合拆分与连乘，只展示服务端下发的各组番型项及其倍数。
- **服务端职责**：`serverApplicability` 为空，`serverEvidenceIds` 为空；无 C14 归属服务端证据。需求口径为：杠飘/飘杠的拆出仅在「一杠上开花 + 单财飘」这一档成立；二连杠、双财飘及更高档组合不拆出杠飘/飘杠，改由各组番型分别计算后连乘。`configCondition` 为空。
- **双端协作**：无法还原：组合分档与连乘均在服务端，双端均未定位到实现证据。
- **业务行为**：
  - trigger：玩家胡牌结算
  - condition：命中二连杠、双财飘及更高档组合
  - action：应由服务端对这些更高档组合不拆出杠飘/飘杠，而按各组番型分别计算后连乘（本次未取得服务端实现证据）；客户端只展示下发番型项（未取得证据）
  - result：无法确认玩家结算中只出现各组原有番型项、倍数由连乘得出（是否被误拆为杠飘/飘杠也无法确认）
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求要求二连杠、双财飘及更高档不拆出杠飘/飘杠，仍按各组番型连乘。实际取证情况：双端均未定位到分档与连乘实现，无法判定。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

### AT-ST-C14-011 无单独杠爆七客

- 所属功能点：FP-ST-C14-002 杠飘与飘杠拆分（PRD 第 181 行）
- **需求规则**：没有单独的杠爆、七客。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；复核说明点名的 CLE-AT-ST-C01-009-03（`layer/BoxHzmjTingPaiView.ts:95-99`，claimKey=`feng-ding-status-text`）只证明封顶状态文案，与本原子无关。实现要点（需求口径）：客户端不得展示独立的「杠爆」「七客」项，只展示参与组合的各组番型。
- **服务端职责**：`serverApplicability` 为空，`serverEvidenceIds` 为空；复核说明确认 server-evidence.json 60 条证据全部集中于创房/吃碰/承包等 C01~C21 配置类原子，经检索不含「杠」「番」「七客」条目。需求口径为：命中杠上开花与爆头组合、或七对爆头组合时，结算不单列「杠爆」「七客」项，只按参与组合的各组番型计入。`configCondition` 为空。
- **双端协作**：无法还原：番型项生成在服务端，双端均未定位到实现证据。
- **业务行为**：
  - trigger：玩家胡牌结算
  - condition：命中杠上开花与爆头组合，或命中七对爆头组合
  - action：应由服务端不单列「杠爆」「七客」项，只按参与组合的各组番型计入（本次未取得服务端实现证据）；客户端只展示下发番型项（未取得证据）
  - result：无法确认玩家结算中是否会出现单独的「杠爆」或「七客」项目
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。
  `baselineDetail`：需求要求没有单独的杠爆、七客项，只按参与组合的各组番型计入。实际取证情况：双端均未定位到这两项的生成或屏蔽实现，既不能证实也不会误列，无法判定。
  待审批建议：unverified（`no-server-evidence-is-not-conflict`：无杠爆/七客证据，属取证空缺，维持未验证）。该建议未生效。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（effectiveDifference=unverified；scope=unknown，`default-unknown`）。

## 证据索引

本阶段 11 个原子在统一原子视图中均未挂证据：`client.evidenceIds` 与 `server.evidenceIds` 全为空，`trace_index.json` 对 AT-ST-C14-001 ~ 011 的 `evidenceCount` 均为 0，本阶段无任何原子级 CLE / SVE 证据。

| atomId | CLE 证据 | SVE 证据 | evidenceCount |
|---|---|---|---|
| AT-ST-C14-001 | 无 | 无 | 0 |
| AT-ST-C14-002 | 无 | 无 | 0 |
| AT-ST-C14-003 | 无 | 无 | 0 |
| AT-ST-C14-004 | 无 | 无 | 0 |
| AT-ST-C14-005 | 无 | 无 | 0 |
| AT-ST-C14-006 | 无 | 无 | 0 |
| AT-ST-C14-007 | 无 | 无 | 0 |
| AT-ST-C14-008 | 无 | 无 | 0 |
| AT-ST-C14-009 | 无 | 无 | 0 |
| AT-ST-C14-010 | 无 | 无 | 0 |
| AT-ST-C14-011 | 无 | 无 | 0 |

以下条目仅出现在 `difference-review.json` 的复核理由中，作为「已排除」或「补证线索」被引用，均**不属于本阶段原子级证据**：

| 证据 id | layer | file:line | claimKey | 复核引用位置 | 说明 |
|---|---|---|---|---|---|
| CLE-AT-ST-C01-005-02 | client_code | config/FanDefine.ts:637-638 | hu-result-label-dianpao | AT-ST-C14-001 | 仅证明结算文案「点炮胡/放炮」，不涉及杠链或杠开番型 |
| CLE-AT-ST-C01-004-04 | client_code | data/GameData.ts:1664-1666 | banker-level-multiplier | AT-ST-C14-001 | 仅证明庄闲倍数换算，不涉及杠开番型 |
| CLE-AT-ST-C01-003-02 | client_code | data/GameData.ts:50 | cai-shen-type-values | AT-ST-C14-006 | 仅定义「0=白板财神，1=翻财神」，属财神口径而非财飘番型 |
| CLE-AT-ST-C01-003-03 | client_code | controller/cmd/gameCmd/GameJokerCmd.ts:74-77 | cai-shen-type-room-rule | AT-ST-C14-006 | 仅证明客户端按 `cai_shen_type` 分支，不涉及杠飘/飘杠拆分 |
| CLE-AT-ST-C01-009-03 | client_code | layer/BoxHzmjTingPaiView.ts:95-99 | feng-ding-status-text | AT-ST-C14-011 | 仅证明封顶状态文案，不涉及杠爆/七客项 |
| SVE-AT-ST-C01-019-03 | hzmj_server | hzmj_server/game_logic.cpp:65-87 | three-tan-forced-off-for-two-players | AT-ST-C14-006 | 仅证明 ≤2 人房强制关闭三摊承包，与杠飘拆分无关 |
| SVE-AT-ST-C01-005-01 | common_game | common_game/com_game/common_game_com_action.cpp:353-358 | banker-discard-hu-requires-three-level | AT-ST-C14-006 | 仅证明三牢放铳约束，与番型拆分无关 |

补充说明：

- 全部 CLE 证据（12 条）的 atomIds 均属 AT-ST-C01 系列，无 AT-ST-C14 归属条目。
- 全部 SVE 证据（60 条）中无 atomIds 含 C14 的记录，按「杠」「番」「飘」检索亦无命中。
- 服务端无证据不等于与需求矛盾：本阶段 11 个原子一律维持 `unverified`，未上调为 `conflict` 或 `partial`。

## 待处理事项

### 待验证（规则待验证，补证 both）

`pending-list.md` 中本阶段共 11 条，问题类型均为「规则待验证」，建议动作均为「补证 both」。

| atomId | 验证范围 | 说明 | 建议动作 |
|---|---|---|---|
| AT-ST-C14-001 | server | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C14-002 | server | 证据不足 | 补证 both |
| AT-ST-C14-003 | server | 证据不足 | 补证 both |
| AT-ST-C14-004 | server | 证据不足 | 补证 both |
| AT-ST-C14-005 | server | 证据不足 | 补证 both |
| AT-ST-C14-006 | server | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C14-007 | server | 证据不足 | 补证 both |
| AT-ST-C14-008 | server | 证据不足 | 补证 both |
| AT-ST-C14-009 | server | 证据不足 | 补证 both |
| AT-ST-C14-010 | server | 证据不足 | 补证 both |
| AT-ST-C14-011 | server | 证据不足（另有待审批复核建议：unverified） | 补证 both |

查证未完成（必要端缺口）：本阶段 0 条（`analysisPath` 全为 `full`，无 pending/timeout/failed 导致的阻塞）。
需策划裁决：本阶段 0 条。
升级原子：本阶段 0 条（11 个原子的 `candidateDifference` 全为空，无历史基线 + 本轮候选的升级情形）。

### 待审批建议（reviewStatus=pending，均未生效）

| atomId | 历史基线 | 本轮候选 | 待审批建议 | 复核规则 | 状态 |
|---|---|---|---|---|---|
| AT-ST-C14-001 | unverified | 空（无升级候选） | 待审批建议：unverified（no-server-evidence-is-not-conflict） | 杠链/杠开番型双端无证据，属取证空缺，维持未验证 | pending / 未生效 |
| AT-ST-C14-006 | unverified | 空（无升级候选） | 待审批建议：unverified（no-server-evidence-is-not-conflict） | 杠飘/飘杠拆分无服务端证据，不得据此判冲突 | pending / 未生效 |
| AT-ST-C14-011 | unverified | 空（无升级候选） | 待审批建议：unverified（no-server-evidence-is-not-conflict） | 无杠爆/七客证据，属取证空缺，维持未验证 | pending / 未生效 |

建议动作：审批（approve/reject/hold）。三条建议若获批，差异口径仍为 `unverified`，L7 结论不变（`verification_required`）。

### 补证方向（供后续取证参考，非结论）

- 杠链与杠开（001-005）：需服务端摸打/杠牌流程中对「杠链长度」的计数与断开重置实现（杠后补牌、杠链状态位），以及自摸结算时按杠链长度取 2/4/8/16 倍档位的分支；4 及以上封顶逻辑需单独确认。
- 杠飘/飘杠拆分（006-010）：需服务端番型结算中「杠上开花 × 财飘」的联合判定、8 倍与基础番的相乘口径，以及杠发生时点上「飘档」取值的时序比较（区分飘杠与杠飘）；更高档组合的分档与连乘分支需一并取证。
- 禁止项（011）：属「禁止出现某项目」类规则，需证明结算番型项生成处不存在独立的「杠爆」「七客」项，或存在显式屏蔽逻辑；缺证据时既不能证实已屏蔽也不能证实被误列。
- 客户端侧本阶段无有效支撑点（番型判定与倍数计算均为服务端职责），补证重点在服务端结算实现；客户端仅需补「结算项名称与倍数按服务端下发原样展示」的展示链路证据。
