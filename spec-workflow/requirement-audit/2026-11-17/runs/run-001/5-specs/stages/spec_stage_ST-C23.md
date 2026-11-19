# ST-C23 待确认清单

## 阶段概述

本阶段汇总需求文档「待确认清单」章节的 8 条待确认事项，拆解为创房吃碰档位在不同人数房的展示与默认口径、碰算摊默认值与计摊口径、财神与守庄规则的语义补全、服务端裁决与禁张算法归属、杠分与补花花牌预留能力及超时无自动操作共 5 个功能点。

- 原子数：21（AT-ST-C23-001 ~ AT-ST-C23-021），分属 5 个功能点：FP-ST-C23-001 吃碰禁手与创房吃碰选项口径（001-003）、FP-ST-C23-002 碰算摊默认值与计摊口径（004-006）、FP-ST-C23-003 财神与守庄规则语义补全（007-012）、FP-ST-C23-004 服务端裁决与禁张算法归属（013-015）、FP-ST-C23-005 预留能力与超时提示确认（016-021）。
- L7 分布：verified 0 / verification_required 21 / decision_required 0 / not_applicable 0。
- analysisPath 分布：21 个原子全部为 `full`；`blockedAtoms` 中无 ST-C23 条目，无 `conflict-fast`，`candidateDifference` 全为空（无历史基线升级原子）。
- 验证范围分布：both 15（001、002、003、004、006、007、008、009、010、011、012、015、017、019、020）/ server 5（005、013、014、016、018）/ client 1（021）。
- 取证现状：本阶段 21 个原子在统一原子视图中双端字段均为空（`clientVerdict` 空、`serverApplicability` 空、`clientEvidenceIds` / `serverEvidenceIds` 空），`configCondition` 空，差异一律为 `unverified`。客户端 12 条 CLE 证据的 atomIds 全部属 AT-ST-C01 系列，本阶段原子仅出现在 `client-evidence.json` 的 `coverage.pendingAtomIds`（client-evidence.json:850 起，本阶段位于 :1217-1237）；服务端 60 条 SVE 证据的 atomIds 亦全部属 AT-ST-C01 系列（stats.atomCount=29、pending=387，server-evidence.json:1479-1487），无任一证据指向本轮 21 个原子。
- 需求原文行号：PRD 第 312 行（条目 1 吃碰档位）、第 313 行（条目 2 碰算摊）、第 314 行（条目 3 规则语义补全）、第 315 行（条目 4 豪七）、第 316 行（条目 5 服务端裁决）、第 317 行（条目 6 杠分）、第 318 行（条目 7 补花/花牌）、第 319 行（条目 8 超时）；章节为「待确认清单」（PRD 第 310 行）。
- 待审批复核建议：仅 AT-ST-C23-001 有一条 `reviewStatus=pending` 建议（unverified），尚未生效。
- 本阶段多数原子的需求本身即「待确认/待补全/待核对」项，需求侧缺少唯一可判定的实现口径；阶段内因此不呈现任何实现差异结论，只陈述取证空缺与可作补证线索的旁证。

| 原子 | 名称 | 验证范围 | difference | L7 |
|---|---|---|---|---|
| AT-ST-C23-001 | 3/4人房隐藏吃碰选项并固定默认吃碰 | both | unverified | verification_required |
| AT-ST-C23-002 | 2人房吃碰选项可选且默认无限吃碰 | both | unverified | verification_required |
| AT-ST-C23-003 | 吃碰禁手等同默认吃碰档待确认 | both | unverified | verification_required |
| AT-ST-C23-004 | 客户端碰算摊默认开启 | both | unverified | verification_required |
| AT-ST-C23-005 | 原模板碰算摊关闭口径描述 | server | unverified | verification_required |
| AT-ST-C23-006 | 碰算摊默认值待定稿 | both | unverified | verification_required |
| AT-ST-C23-007 | 有财必拷响语义待补全 | both | unverified | verification_required |
| AT-ST-C23-008 | 三财翻倍语义待补全 | both | unverified | verification_required |
| AT-ST-C23-009 | 四财翻倍语义待补全 | both | unverified | verification_required |
| AT-ST-C23-010 | 财神替豪七语义待补全 | both | unverified | verification_required |
| AT-ST-C23-011 | 守庄语义待补全 | both | unverified | verification_required |
| AT-ST-C23-012 | 豪七即豪华七对待确认 | both | unverified | verification_required |
| AT-ST-C23-013 | 操作优先级仲裁由服务端裁决 | server | unverified | verification_required |
| AT-ST-C23-014 | 吃碰禁手禁张算法由服务端裁决 | server | unverified | verification_required |
| AT-ST-C23-015 | 正文描述需与服务端规则核对定稿 | both | unverified | verification_required |
| AT-ST-C23-016 | 杠分为预留能力未启用 | server | unverified | verification_required |
| AT-ST-C23-017 | 杠即时得分流程需确认补写 | both | unverified | verification_required |
| AT-ST-C23-018 | 补花花牌为预留能力且杭麻无花牌 | server | unverified | verification_required |
| AT-ST-C23-019 | 花牌相关处理出现时需确认 | both | unverified | verification_required |
| AT-ST-C23-020 | 超时后无自动操作仅提示 | both | unverified | verification_required |
| AT-ST-C23-021 | 超时提示表现以UI交互稿为准 | client | unverified | verification_required |

## 需求条目

### AT-ST-C23-001 3/4人房隐藏吃碰选项并固定默认吃碰

- 所属功能点：FP-ST-C23-001 吃碰禁手与创房吃碰选项口径（PRD 第 312 行）
- **需求规则**：「吃碰禁手」对应创房吃碰选项的「默认吃碰」档：3/4 人房创建时吃碰选项不显示、固定按「默认吃碰」生效。（UI 要求：3/4 人房创建界面不显示吃碰选项。）
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空（未给出 confirmed/partial/not_found 判定），`clientEvidenceIds` 为空；`client-evidence.json` 的 `coverage.pendingAtomIds` 在 :1217 列出本原子，表示本轮未产出创房界面的吃碰档位证据。本原子无 CLE 证据、无 `file:line` 可定位。实现要点（需求口径，非实现事实）：3/4 人房创建界面的吃碰档位整项应不渲染、不可切换、也不显示默认值。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，`configCondition` 为空；`server-evidence.json` 60 条证据无 atomIds 属 ST-C23 的条目（stats.atomCount=29，server-evidence.json:1479-1487）。本原子无 SVE 证据、无 `file:line` 可定位。需求口径为：该房间按「默认吃碰」档下发对局规则，无需玩家在建房时提交吃碰选择。
  旁证线索（归 ST-C01，**不构成本原子证据**）：SVE-AT-ST-C01-018-03（`hzmj_server/server_config.cpp:27-28`，claimKey=`box-default-chi-peng-unlimited`，`ServerConfig::InitConfigByBox`）显示好友房默认 `SetOnlyPungNoChow(false); SetRuleChiPeng(0);`；SVE-AT-ST-C01-018-02（`hzmj_server/game_logic.cpp:112-121`，claimKey=`chi-peng-mode-config-parse`，`GameLogic::LoadBoxJsonConfig`）显示 `rule_chi_peng` 由房间 JSON 解析。AT-ST-C01-018 的 configCondition 把 `rule_chi_peng` 语义登记为「0=不限制（无限吃碰）、1=每方向限 2 次只能碰不能吃、2=每方向限 2 次可吃碰（默认吃碰）」，并注明「hzmj_server 不按人数自动切换，取值由客户端按人数默认提交」。这些只说明服务端档位取值链路与默认值落点，不能证明「3/4 人房界面不显示选项」或「服务端对该房间固定按默认吃碰生效」。
- **双端协作**：玩家选 3/4 人 → 界面没有吃碰选项可点 → 建房请求里不带吃碰档位 → 服务端按默认吃碰规则开局 → 对局中吃碰受限。
- **业务行为**：
  - trigger：玩家创建 3 人或 4 人好友房
  - condition：建房间时把人数选为 3 人或 4 人
  - action：建房间设置界面不出现吃碰档位这一项，玩家无法切档，也不显示任何默认值；服务端按「默认吃碰」档下发对局规则，无需玩家在建房时提交吃碰选择
  - result：玩家在 3/4 人房看不到吃碰选项，开局后吃碰按默认规则受限，玩家没有可切换的入口
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空（无升级候选）。`baselineDetail`：需求（第 312 行）要求 3/4 人房创建界面不显示吃碰选项、固定按「默认吃碰」生效；本轮客户端检索未找到（无 verdict、无 evidenceIds），服务端 applicability 为空、无 evidenceIds 且无配置条件说明，两端都无法证实「界面确实不显示选项」与「服务端确实固定下发默认吃碰」，故证据不足判 unverified。
  待审批建议：unverified（`no-server-evidence-is-not-conflict`），`reviewStatus=pending`，**尚未生效**。复核理由要点：本片 21 个原子双端证据均为零，需求多为待确认/待补全项，缺证只能维持 unverified，既不得判 consistent/partial，也无可构成矛盾的反证去升级 conflict。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（依据生效的 `effectiveDifference=unverified`；`scope=unknown`、`scopeSource=default-unknown`）。查证未被阻塞，非 `pending-blocked`。

### AT-ST-C23-002 2人房吃碰选项可选且默认无限吃碰

- 所属功能点：FP-ST-C23-001 吃碰禁手与创房吃碰选项口径（PRD 第 312 行）
- **需求规则**：2 人房吃碰选项可选，默认值为「无限吃碰」。（UI 要求：2 人房创建界面展示吃碰选项，默认选中「无限吃碰」。）
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 在 :1218 列出本原子。无 CLE 证据、无 `file:line` 可定位。实现要点（需求口径，非实现事实）：2 人房创建界面应展示可切换的吃碰档位，初始选中项为「无限吃碰」。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，`configCondition` 为空；无 atomIds 属 ST-C23 的 SVE 条目。无 SVE 证据、无 `file:line` 可定位。需求口径为：按玩家提交的吃碰档位下发对局规则；玩家未改动时按无限吃碰生效。
  旁证线索（归 ST-C01，**不构成本原子证据**）：SVE-AT-ST-C01-018-03（`hzmj_server/server_config.cpp:27-28`）好友房默认 `SetRuleChiPeng(0)`，按 AT-ST-C01-018 的 configCondition 对应「不限制吃碰，即无限吃碰」；SVE-AT-ST-C01-018-02（`hzmj_server/game_logic.cpp:112-121`）显示档位由房间 JSON 的 `rule_chi_peng` 解析。旁证只覆盖服务端默认取值，不能证明客户端在 2 人房确实展示该控件并默认选中「无限吃碰」。
- **双端协作**：玩家选 2 人 → 界面出现吃碰档位且默认无限吃碰 → 玩家可自行切档或直接建房 → 服务端按提交档位开局。
- **业务行为**：
  - trigger：玩家创建 2 人好友房并调整吃碰档位
  - condition：建房间时人数选为 2 人
  - action：建房间设置界面展示可切换的吃碰档位，默认停在「无限吃碰」；服务端按玩家提交的吃碰档位下发对局规则，玩家没动过时按无限吃碰生效
  - result：2 人房玩家能看到并切换吃碰档位，不操作时按无限吃碰开局
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 312 行）要求 2 人房展示吃碰选项且默认「无限吃碰」；本轮客户端未找到证据，服务端 applicability 为空、无 evidenceIds，无法证实该选项在 2 人房确实展示、默认值确实为无限吃碰，故判 unverified。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）；非 `pending-blocked`。

### AT-ST-C23-003 吃碰禁手等同默认吃碰档待确认

- 所属功能点：FP-ST-C23-001 吃碰禁手与创房吃碰选项口径（PRD 第 312 行）
- **需求规则**：需确认「吃碰禁手」即指创房吃碰选项的「默认吃碰」档。（本条为术语口径确认项，无 UI 要求。）
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 在 :1219 列出本原子。无 CLE 证据、无 `file:line` 可定位。实现要点（需求口径，非实现事实）：术语确认后，客户端对「吃碰禁手」状态的表现应与其选中的吃碰档位表现同口径。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，`configCondition` 为空；无 atomIds 属 ST-C23 的 SVE 条目。无 SVE 证据、无 `file:line` 可定位。需求口径为：服务端按所下发的吃碰档位决定禁手规则；术语口径由产品确认后与实现对齐。代码证据无法回答「禁手」与「默认吃碰档」是否为同一概念的命名约定问题。
  旁证线索（归 ST-C01，**不构成本原子证据**）：SVE-AT-ST-C01-018-01（`common_game/com_game/common_game_algorithm.cpp:79-84`，claimKey=`chi-peng-limit-two-per-direction`，`CommonGameAlgorithm::IsChiPengExceeded`）与 SVE-AT-ST-C01-020-01（`common_game/com_game/common_game_com_action.cpp:74-80`，claimKey=`only-pung-no-chow-blocks-chow`，`BoxChowStep::Judge`）分别对应「每方向限制 2 次」与「只碰不吃」两条不同的吃碰限制实现，说明代码中存在多种吃碰限制档位，但无法证明「吃碰禁手」这一需求术语映射到哪一档。
- **双端协作**：产品确认术语口径后，客户端表现与服务端下发的档位规则保持同一口径。
- **业务行为**：
  - trigger：需求文档中出现「吃碰禁手」这一术语时（口径确认环节，非对局内行为）
  - condition：需要解释「吃碰禁手」与创房吃碰档位的关系时
  - action：无对局内对应行为；客户端只是按档位展示吃碰是否可用，服务端按所下发的吃碰档位决定禁手规则
  - result：玩家看到的吃碰限制与「默认吃碰」档的表现一致（前提是术语口径被确认一致）
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 312 行）本身是待确认项，需产品确认「吃碰禁手」是否就是「默认吃碰」档，需求未给出可判定的实现口径；本轮客户端未找到证据，服务端 applicability 为空、无 evidenceIds，既无法证实两者口径一致，也无法证实不一致，故判 unverified。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）；非 `pending-blocked`。

### AT-ST-C23-004 客户端碰算摊默认开启

- 所属功能点：FP-ST-C23-002 碰算摊默认值与计摊口径（PRD 第 313 行）
- **需求规则**：「碰算摊」客户端默认开。（UI 要求：客户端碰算摊开关默认处于开启状态。）
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 在 :1220 列出本原子。无 CLE 证据、无 `file:line` 可定位。实现要点（需求口径，非实现事实）：玩家未手动改过设置时，玩法设置中的碰算摊开关初始状态应为开启。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，`configCondition` 为空；无 atomIds 属 ST-C23 的 SVE 条目。无 SVE 证据、无 `file:line` 可定位。需求口径为：玩家未改设置时按开启状态接收并下发碰算摊规则。
  旁证线索（归 ST-C01，**不构成本原子证据**）：SVE-AT-ST-C01-019-04（`hzmj_server/server_config.cpp:20-21`，claimKey=`box-default-three-tan-off-pung-as-tan-on`，`ServerConfig::InitConfigByBox`，excerpt `SetEnableThreeTanBao(false); SetPungAsTan(true);`）说明好友房服务端 `pung_as_tan` 默认 true；SVE-AT-ST-C01-024-09（`hzmj_server/server_config.cpp:19-39`，claimKey=`box-default-config-values`）为创房默认配置值集合。两者只覆盖服务端默认值，不能证明客户端开关默认态，也不涉及「无限吃碰档隐藏碰算摊」的联动。
- **双端协作**：玩家进房 → 客户端默认把碰算摊显示为开 → 未修改时按开启状态提交 → 服务端按开计算摊数。
- **业务行为**：
  - trigger：玩家进入房间、查看或调整玩法设置
  - condition：玩家此前没有手动改过碰算摊设置
  - action：客户端把碰算摊开关的初始状态置为开启并展示给玩家；服务端在玩家未改设置时按开启状态接收并下发碰算摊规则
  - result：玩家看到的碰算摊开关处于开启状态，结算中碰也计摊
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 313 行）要求客户端碰算摊默认开；本轮客户端未找到证据，服务端 applicability 为空、无 evidenceIds，无法证实开关默认值确为开启，故判 unverified。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）；非 `pending-blocked`。

### AT-ST-C23-005 原模板碰算摊关闭口径描述

- 所属功能点：FP-ST-C23-002 碰算摊默认值与计摊口径（PRD 第 313 行）
- **需求规则**：原模板开篇按「关闭」口径描述：碰、直杠、加杠、暗杠不计摊。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 在 :1221 列出本原子。本原子必要端为服务端，客户端非取证必要端；无 CLE 证据、无 `file:line` 可定位。实现要点（需求口径，非实现事实）：按关闭口径生效时，结算界面不把这些面子按计摊项展示。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，`configCondition` 为空；无 atomIds 属 ST-C23 的 SVE 条目。无 SVE 证据、无 `file:line` 可定位。需求口径为：关闭口径下结算计算中碰、直杠、加杠、暗杠均不计摊。
  旁证线索（归 ST-C01，**不构成本原子证据**）：SVE-AT-ST-C01-019-04（`hzmj_server/server_config.cpp:20-21`）显示好友房默认 `SetPungAsTan(true)`；SVE-AT-ST-C01-019-01（`common_game/com_game/common_game_com_pung.cpp:125-138`，claimKey=`pung-counts-one-tan-when-pung-as-tan`，`BoxPungStep::Execute`，excerpt `if (GetSvrCfg()->GetPungAsTan()) { ... SetTanCount(pung_seat_, from_seat, ... + 1);`）显示开启时碰对来源座位记 1 摊。两条属于其他原子的证据，只说明服务端存在「碰是否计摊」的开关与默认值，不覆盖直杠、加杠、暗杠三类的计摊分支，也不能证明关闭口径下的结算实际表现。
- **双端协作**：玩家碰/杠 → 结算时服务端按关闭口径不算摊 → 客户端结算页只显示其余计摊项。
- **业务行为**：
  - trigger：对局结算涉及碰、直杠、加杠、暗杠时
  - condition：按原模板的关闭口径生效（碰算摊处于关闭）
  - action：结算界面不把这些面子按计摊项展示；服务端结算计算中碰、直杠、加杠、暗杠均不计摊
  - result：玩家结算里碰、直杠、加杠、暗杠都不产生摊数
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 313 行）描述的是原模板关闭口径，且该条本身带待确认属性；本轮服务端 applicability 为空、无 evidenceIds 与配置条件，客户端也无证据，无法证实结算中这四类牌型确实不计摊，故判 unverified（核验范围为服务端）。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）；非 `pending-blocked`。

### AT-ST-C23-006 碰算摊默认值待定稿

- 所属功能点：FP-ST-C23-002 碰算摊默认值与计摊口径（PRD 第 313 行）
- **需求规则**：需确认「碰算摊」默认值按「开」还是「关」定稿。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 在 :1222 列出本原子。无 CLE 证据、无 `file:line` 可定位。实现要点（需求口径，非实现事实）：默认值定稿后，客户端按定稿值展示碰算摊开关初始状态。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，`configCondition` 为空；无 atomIds 属 ST-C23 的 SVE 条目。无 SVE 证据、无 `file:line` 可定位。需求口径为：按定稿的默认值在结算时决定碰是否计摊；当前需求同时存在「客户端默认开」与「原模板关闭」两种口径，无唯一判定基准。
  旁证线索（归 ST-C01，**不构成本原子证据**）：SVE-AT-ST-C01-019-04（`hzmj_server/server_config.cpp:20-21`）与 SVE-AT-ST-C01-024-09（`hzmj_server/server_config.cpp:19-39`）显示服务端侧存在的默认取值为 `pung_as_tan=true`；该取值属于服务端配置事实，不能替代产品对默认值的定稿，也不能直接作为「默认值应按开/关」的判定依据。
- **双端协作**：产品定稿默认值 → 客户端按该值展示开关 → 服务端按该值计算摊数。
- **业务行为**：
  - trigger：产品确定碰算摊默认值的定稿环节（非对局内行为）
  - condition：需求中同时存在「默认开」与「原模板关闭」两种口径时
  - action：按定稿的默认值展示碰算摊开关初始状态；服务端按定稿的默认值在结算时决定碰是否计摊
  - result：玩家进对局时碰算摊按最终定稿的默认状态生效（开或关待定）
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 313 行）是待确认项，默认值按「开」还是「关」尚未定稿，需求本身没有唯一可判定的口径；本轮客户端未找到证据，服务端 applicability 为空、无 evidenceIds，无法判定实际默认值与哪一口径一致，故判 unverified。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）；非 `pending-blocked`。

### AT-ST-C23-007 有财必拷响语义待补全

- 所属功能点：FP-ST-C23-003 财神与守庄规则语义补全（PRD 第 314 行）
- **需求规则**：「有财必拷响」的完整规则语义需产品/服务端口径补全。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 在 :1223 列出本原子。无 CLE 证据、无 `file:line` 可定位。实现要点（需求口径，非实现事实）：规则补全后，客户端应在拷响提示与结算中展示财神参与的拷响结果。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，`configCondition` 为空；无 atomIds 属 ST-C23 的 SVE 条目。无 SVE 证据、无 `file:line` 可定位。需求口径为：按补全后的规则判定是否成立拷响并计算得分；补全前没有可对照的完整规则。两端证据文本检索「拷响」命中 0。
  旁证线索（归 ST-C01，**不构成本原子证据**）：SVE-AT-ST-C01-003-01（`common_game/com_game/common_game_com_ju.cpp:226-248`，claimKey=`cai-shen-type-behavior`，`BoxJokerStep::Execute`）只证明财神牌张的选取（白板财神或翻财神）；SVE-AT-ST-C01-003-02（`hzmj_server/game_logic.cpp:51-55`）、SVE-AT-ST-C01-003-03（`hzmj_server/server_config.cpp:16`）只证明 `cai_shen_type` 的解析与默认值，均不涉及拷响判定。
- **双端协作**：玩家胡牌 → 服务端按有财必拷响规则判定 → 客户端展示对应的拷响结果。
- **业务行为**：
  - trigger：玩家手牌含财神并进入拷响判定时
  - condition：「有财必拷响」规则语义被补全之后
  - action：按规则在拷响提示与结算中展示财神参与的拷响结果；服务端按补全后的规则判定是否成立拷响并计算得分
  - result：玩家看到的拷响结算符合补全后的「有财必拷响」规则
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 314 行）明确是待补全项，当前没有可用于比对的完整规则；本轮客户端未找到证据，服务端 applicability 为空、无 evidenceIds，无法判定实际行为是否符合，故判 unverified。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）；非 `pending-blocked`。

### AT-ST-C23-008 三财翻倍语义待补全

- 所属功能点：FP-ST-C23-003 财神与守庄规则语义补全（PRD 第 314 行）
- **需求规则**：「三财翻倍」的完整规则语义需产品/服务端口径补全。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 在 :1224 列出本原子。无 CLE 证据、无 `file:line` 可定位。实现要点（需求口径，非实现事实）：规则补全后，结算应展示三财带来的翻倍倍数。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，`configCondition` 为空；无 atomIds 属 ST-C23 的 SVE 条目。无 SVE 证据、无 `file:line` 可定位。需求口径为：按补全后的规则计算翻倍数并计入得分；翻倍基数、是否与其它番型连乘等均待补全。两端证据文本检索「翻倍」命中 0。
  旁证线索（归 ST-C01，**不构成本原子证据**）：CLE-AT-ST-C01-003-02（`data/GameData.ts:50`，claimKey=`cai-shen-type-values`，`GameData.jokerOpen`）与 CLE-AT-ST-C01-003-03（`controller/cmd/gameCmd/GameJokerCmd.ts:74-77`，claimKey=`cai-shen-type-room-rule`，`GameJokerCmd._needFanJokerAni`）只证明客户端读取财神类型并据此播放翻财神动效，不涉及三财翻倍计算。
- **双端协作**：玩家持三财胡牌 → 服务端按三财规则翻倍计分 → 客户端结算显示对应倍数。
- **业务行为**：
  - trigger：玩家手牌持有三张财神并胡牌结算时
  - condition：「三财翻倍」规则语义被补全之后
  - action：结算中展示三财带来的翻倍倍数；服务端按补全后的规则计算翻倍数并计入得分
  - result：玩家持三财胡牌时，结算按三财翻倍规则获得对应倍数
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 314 行）是待补全项，暂无完整规则可对照；本轮客户端未找到证据，服务端 applicability 为空、无 evidenceIds，无法判定实际翻倍计算是否符合，故判 unverified。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）；非 `pending-blocked`。

### AT-ST-C23-009 四财翻倍语义待补全

- 所属功能点：FP-ST-C23-003 财神与守庄规则语义补全（PRD 第 314 行）
- **需求规则**：「四财翻倍」的完整规则语义需产品/服务端口径补全。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 在 :1225 列出本原子。无 CLE 证据、无 `file:line` 可定位。实现要点（需求口径，非实现事实）：规则补全后，结算应展示四财带来的翻倍倍数。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，`configCondition` 为空；无 atomIds 属 ST-C23 的 SVE 条目。无 SVE 证据、无 `file:line` 可定位。需求口径为：按补全后的规则计算翻倍数并计入得分；四财与三财的倍数关系待补全。两端证据文本检索「翻倍」命中 0，财神相关旁证只覆盖财神牌种选取（SVE-AT-ST-C01-003-01，`common_game/com_game/common_game_com_ju.cpp:226-248`），不构成计分证据。
- **双端协作**：玩家持四财胡牌 → 服务端按四财规则翻倍计分 → 客户端结算显示对应倍数。
- **业务行为**：
  - trigger：玩家手牌持有四张财神并胡牌结算时
  - condition：「四财翻倍」规则语义被补全之后
  - action：结算中展示四财带来的翻倍倍数；服务端按补全后的规则计算翻倍数并计入得分
  - result：玩家持四财胡牌时，结算按四财翻倍规则获得对应倍数
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 314 行）是待补全项，暂无完整规则可对照；本轮客户端未找到证据，服务端 applicability 为空、无 evidenceIds，无法判定实际翻倍计算是否符合，故判 unverified。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）；非 `pending-blocked`。

### AT-ST-C23-010 财神替豪七语义待补全

- 所属功能点：FP-ST-C23-003 财神与守庄规则语义补全（PRD 第 314 行）
- **需求规则**：「财神替豪七」的完整规则语义需产品/服务端口径补全。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 在 :1226 列出本原子。无 CLE 证据、无 `file:line` 可定位。实现要点（需求口径，非实现事实）：规则补全后，胡牌提示与结算应按财神替牌成立的豪七展示牌型。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，`configCondition` 为空；无 atomIds 属 ST-C23 的 SVE 条目。无 SVE 证据、无 `file:line` 可定位。需求口径为：按补全后的规则判定财神能否充当豪七所需牌张并计分。两端证据文本检索「豪七」「豪华七对」命中 0。
  旁证线索（归 ST-C01，**不构成本原子证据**）：SVE-AT-ST-C01-003-01（`common_game/com_game/common_game_com_ju.cpp:226-248`）只证明财神取白板或翻财神牌种，不涉及财神作为替牌参与七对牌型判定的细节。
- **双端协作**：玩家以财神替牌胡豪七 → 服务端判定牌型成立与否 → 客户端展示对应的牌型与得分。
- **业务行为**：
  - trigger：玩家用财神充当豪华七对所需牌张并胡牌时
  - condition：「财神替豪七」规则语义被补全之后
  - action：胡牌提示与结算中按财神替牌成立的豪华七对展示牌型；服务端按补全后的规则判定财神能否充当豪七牌张并计分
  - result：玩家用财神替牌组成豪华七对时，按补齐后的规则获得对应结算
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 314 行）是待补全项，当前无完整规则可对照；本轮客户端未找到证据，服务端 applicability 为空、无 evidenceIds，无法判定实际判定逻辑是否符合，故判 unverified。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）；非 `pending-blocked`。

### AT-ST-C23-011 守庄语义待补全

- 所属功能点：FP-ST-C23-003 财神与守庄规则语义补全（PRD 第 314 行）
- **需求规则**：「守庄」的完整规则语义需产品/服务端口径补全。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 在 :1227 列出本原子。无 CLE 证据、无 `file:line` 可定位。实现要点（需求口径，非实现事实）：语义补齐后，局间与结算界面应展示下一局庄家是谁（延续或轮转）。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，`configCondition` 为空；无 atomIds 属 ST-C23 的 SVE 条目。无 SVE 证据、无 `file:line` 可定位。需求口径为：按补齐后的守庄规则决定庄家是否延续。
  旁证线索（归 ST-C01，**不构成本原子证据**）：服务端同名配置 `enable_guard_dealer`（SVE-AT-ST-C01-025-03，`common_game/com_game/common_game_server_config.h:65-66`，注释「守庄（仅 3/4 人局，2 人局服务端安全判断强制关闭）……庄家上家无财神时禁碰庄家及庄下家的牌」；SVE-AT-ST-C01-027-01，`common_game/com_game/common_game_algorithm.cpp:62-67`，claimKey=`guard-dealer-3-vs-4-player-scope`，`CommonGameAlgorithm::IsGuardDealerBlocked`）在代码中的语义是**吃碰限制**（禁碰庄家及庄下家的牌），与本原子所指「局末决定下一局庄家归属（延续或轮转）」并非同一语义。该旁证因此不能作为守庄轮转规则的实现证据，仅提示两端存在同名术语，需在语义补全时明确区分。
- **双端协作**：一局结束 → 服务端按守庄规则确定下局庄家 → 客户端展示庄家标识变化。
- **业务行为**：
  - trigger：一局结束、需要决定下一局庄家归属时
  - condition：「守庄」规则语义被补全之后
  - action：在局间与结算界面展示下一局庄家是谁（延续或轮转）；服务端按补全后的规则决定庄家是否延续
  - result：玩家看到的庄家延续或轮转结果与补齐后的守庄规则一致
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 314 行）是待补全项，当前无完整规则可对照；本轮客户端未找到证据，服务端 applicability 为空、无 evidenceIds，无法判定庄家轮转是否符合，故判 unverified。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）；非 `pending-blocked`。

### AT-ST-C23-012 豪七即豪华七对待确认

- 所属功能点：FP-ST-C23-003 财神与守庄规则语义补全（PRD 第 315 行）
- **需求规则**：「财神替豪七」的「豪七」推断为「豪华七对」，需确认。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 在 :1228 列出本原子。无 CLE 证据、无 `file:line` 可定位。实现要点（需求口径，非实现事实）：按确认后的牌型名称与规则展示豪七相关结算。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，`configCondition` 为空；无 atomIds 属 ST-C23 的 SVE 条目。无 SVE 证据、无 `file:line` 可定位。需求口径为：按确认后的牌型定义判定财神能否替牌成立该牌型；代码证据无法回答术语命名问题，两端证据文本检索「豪七」命中 0。
- **双端协作**：产品确认「豪七」是否即豪华七对 → 服务端按该定义判定牌型 → 客户端展示对应结算。
- **业务行为**：
  - trigger：需求解析中遇到「豪七」这一表述时（口径确认环节，非对局内行为）
  - condition：需要解释「财神替豪七」中「豪七」含义时
  - action：按确认后的牌型名称与规则展示豪七相关结算；服务端按确认后的牌型定义判定财神能否替牌成立该牌型
  - result：玩家看到的豪七结算与确认后的口径一致
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 315 行）是待确认项，文档中「豪七」被推断为「豪华七对」但尚未确认，缺少唯一可判定口径；本轮客户端未找到证据，服务端 applicability 为空、无 evidenceIds，无法判定实际实现对应哪种定义，故判 unverified。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）；非 `pending-blocked`。

### AT-ST-C23-013 操作优先级仲裁由服务端裁决

- 所属功能点：FP-ST-C23-004 服务端裁决与禁张算法归属（PRD 第 316 行）
- **需求规则**：操作优先级仲裁由服务端裁决。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 在 :1229 列出本原子。本原子必要端为服务端，客户端非取证必要端；无 CLE 证据、无 `file:line` 可定位。实现要点（需求口径，非实现事实）：客户端只提交操作请求，按服务端回执执行被裁决生效的那一个操作。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，`configCondition` 为空；无 atomIds 属 ST-C23 的 SVE 条目。无 SVE 证据、无 `file:line` 可定位。需求口径为：按优先级规则仲裁冲突，只让优先级最高的一方操作生效，并向各方回执结果。本轮服务端证据中没有覆盖多方同时响应同一张牌的仲裁入口或优先级比较逻辑。
- **双端协作**：多方同时提交操作 → 服务端仲裁定优先级 → 只放行一方 → 客户端按回执收敛界面，其余玩家的操作被取消或提示不可行。
- **业务行为**：
  - trigger：多名玩家同时对同一张牌产生可响应操作（如同时胡、碰、杠）时
  - condition：多方操作存在优先级冲突，需要决定谁的操作生效
  - action：客户端把玩家的操作请求提交给服务端，并按服务端回执只执行被裁决生效的那一个操作；服务端按优先级规则仲裁冲突，只让优先级最高的一方操作生效，并向各方回执结果
  - result：玩家看到最终只生效了一个操作，且生效的是服务端裁决的那一方
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 316 行）要求操作优先级仲裁由服务端裁决；本轮服务端 applicability 为空、无 evidenceIds 与配置条件，客户端也无证据，无法证实仲裁确实在服务端进行；按核验范围只看服务端，服务端无任何证据，故判 unverified。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）；非 `pending-blocked`。

### AT-ST-C23-014 吃碰禁手禁张算法由服务端裁决

- 所属功能点：FP-ST-C23-004 服务端裁决与禁张算法归属（PRD 第 316 行）
- **需求规则**：吃碰禁手的具体禁张算法由服务端裁决。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 在 :1230 列出本原子。本原子必要端为服务端，客户端非取证必要端；无 CLE 证据、无 `file:line` 可定位。实现要点（需求口径，非实现事实）：按服务端下发的可打牌范围限制玩家点选，禁打的牌不可点击。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，`configCondition` 为空；无 atomIds 属 ST-C23 的 SVE 条目。无 SVE 证据、无 `file:line` 可定位。需求口径为：判定具体哪些牌张不可打出，并校验玩家出牌请求，违规出牌被拒绝。
  旁证线索（归 ST-C01，**不构成本原子证据**）：SVE-AT-ST-C01-020-01（`common_game/com_game/common_game_com_action.cpp:74-80`，claimKey=`only-pung-no-chow-blocks-chow`，`BoxChowStep::Judge`，`only_pung_no_chow=true` 时禁吃并下发 `kNIFExOnlyPungNoChow`）与 SVE-AT-ST-C01-024-01（`common_game/com_game/common_game_com_action.cpp:62-66`，claimKey=`chow-judge-chi-peng-limit-call-site`，注释「rule_chi_peng=2 该方向合计≤2，已达上限禁吃」，调用 `IsChiPengExceeded` / `IsXianXianTanFull`）只覆盖**吃/碰动作被拒绝**的判定，未覆盖「哪些牌张不可打出」的禁张范围计算，因此不能证明禁张算法在服务端完成。
- **双端协作**：轮到禁手玩家出牌 → 服务端算出禁张范围下发 → 客户端只放出可打的牌 → 玩家出牌后服务端复核。
- **业务行为**：
  - trigger：玩家处于吃碰禁手状态、轮到自己出牌时
  - condition：手牌中存在需要按禁手规则禁止打出的牌张
  - action：按服务端下发的可打牌范围限制玩家点选，禁打的牌不可点击；服务端判定具体哪些牌张不可打出，并校验玩家出牌请求，违规出牌被拒绝
  - result：玩家看到的禁打牌张以服务端判定为准，违规出牌无法生效
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 316 行）要求禁张算法由服务端裁决；本轮服务端 applicability 为空、无 evidenceIds 与配置条件，客户端也无证据；按核验范围只看服务端，服务端无证据，无法证实禁张判定在服务端完成，故判 unverified。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）；非 `pending-blocked`。

### AT-ST-C23-015 正文描述需与服务端规则核对定稿

- 所属功能点：FP-ST-C23-004 服务端裁决与禁张算法归属（PRD 第 316 行）
- **需求规则**：操作优先级仲裁与吃碰禁手的正文相关描述需与服务端规则核对后定稿。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 在 :1231 列出本原子。无 CLE 证据、无 `file:line` 可定位。实现要点（需求口径，非实现事实）：客户端按服务端下发的仲裁与禁手结果展示，不自行判定。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，`configCondition` 为空；无 atomIds 属 ST-C23 的 SVE 条目。无 SVE 证据、无 `file:line` 可定位。需求口径为：服务端产出仲裁与禁手的实际规则，作为正文核对的基准；本轮缺少该基准证据，无法完成逐条比对。
- **双端协作**：需求正文与两端实际规则逐条比对 → 差异项回写正文 → 定稿后按定稿行为实现。
- **业务行为**：
  - trigger：需求正文涉及「操作优先级仲裁」与「吃碰禁手」描述的核对环节（文档定稿行为，非对局内行为）
  - condition：正文中这两处描述需要与服务端规则逐条比对时
  - action：客户端按服务端下发的仲裁与禁手结果展示，不自行判定；服务端产出仲裁与禁手的实际规则，作为正文核对的基准
  - result：玩家最终看到的行为与核对后定稿的正文一致
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 316 行）是待核对项，正文描述尚未与服务端规则核对定稿；本轮客户端未找到证据，服务端 applicability 为空、无 evidenceIds，缺少比对基准，无法判定正文与实际是否一致，故判 unverified。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）；非 `pending-blocked`。

### AT-ST-C23-016 杠分为预留能力未启用

- 所属功能点：FP-ST-C23-005 预留能力与超时提示确认（PRD 第 317 行）
- **需求规则**：杠分为预留能力，当前未启用。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 在 :1232 列出本原子。本原子必要端为服务端，客户端非取证必要端；无 CLE 证据、无 `file:line` 可定位。实现要点（需求口径，非实现事实）：结算界面不展示杠分这一得分项。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，`configCondition` 为空；无 atomIds 属 ST-C23 的 SVE 条目。无 SVE 证据、无 `file:line` 可定位。需求口径为：结算计算中不执行杠分结算，不因杠牌单独加分。两端证据文本检索「杠分」命中 0，本轮服务端证据未覆盖杠牌结算分支。
- **双端协作**：玩家杠牌 → 服务端结算时跳过杠分 → 客户端结算页无杠分项。
- **业务行为**：
  - trigger：对局中出现杠牌并进入结算时
  - condition：杠分能力处于预留未启用状态
  - action：结算界面不展示杠分这一得分项，杠只按面子与常规番型体现；服务端结算计算中不执行杠分结算，不因杠牌单独加分
  - result：玩家结算中看不到杠分得分，杠牌不产生额外的杠分收益
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 317 行）要求杠分为预留能力、当前未启用；本轮服务端 applicability 为空、无 evidenceIds 与配置条件，客户端也无证据；按核验范围只看服务端，服务端无证据，无法证实结算中确实不计杠分，故判 unverified。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）；非 `pending-blocked`。

### AT-ST-C23-017 杠即时得分流程需确认补写

- 所属功能点：FP-ST-C23-005 预留能力与超时提示确认（PRD 第 317 行）
- **需求规则**：若产品需要「杠即时得分」流程，需确认并补写。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 在 :1233 列出本原子。无 CLE 证据、无 `file:line` 可定位。实现要点（需求口径，非实现事实）：仅在确认启用后，杠牌发生时应即时展示杠分到账反馈与分数变化。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，`configCondition` 为空；无 atomIds 属 ST-C23 的 SVE 条目。无 SVE 证据、无 `file:line` 可定位。需求口径为：仅在确认启用后，杠牌发生时即时结算杠分并推送得分变化；当前是否启用尚未确定，也没有补写规则。
- **双端协作**：玩家杠牌 → 服务端即时计分 → 客户端立即展示加分反馈（仅在确认启用后）。
- **业务行为**：
  - trigger：产品提出需要「杠即时得分」的玩法需求时（需求确认环节）
  - condition：确认本期启用杠即时得分流程
  - action：在杠牌发生时即时展示杠分到账的反馈与分数变化；服务端在杠牌发生时即时结算杠分并推送得分变化
  - result：启用后玩家杠牌当下就能看到即时得分，而不是等到局末结算
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 317 行）是待确认项，是否要做「杠即时得分」流程尚未确定，也没有补写规则，缺少可判定口径；本轮客户端未找到证据，服务端 applicability 为空、无 evidenceIds，无法判定该流程是否存在，故判 unverified。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）；非 `pending-blocked`。

### AT-ST-C23-018 补花花牌为预留能力且杭麻无花牌

- 所属功能点：FP-ST-C23-005 预留能力与超时提示确认（PRD 第 318 行）
- **需求规则**：补花/花牌为预留能力，杭麻牌组无花牌。
- **验证范围**：server（`verificationScope=server`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 在 :1234 列出本原子。本原子必要端为服务端，客户端非取证必要端；无 CLE 证据、无 `file:line` 可定位。实现要点（需求口径，非实现事实）：不展示花牌牌面，不出现补花提示与补花动画。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，`configCondition` 为空；无 atomIds 属 ST-C23 的 SVE 条目。无 SVE 证据、无 `file:line` 可定位。需求口径为：组牌与发牌时不生成花牌，摸牌流程中不执行补花。两端证据文本检索「花牌」「补花」命中 0，本轮服务端证据未覆盖牌组构成（张数、是否含花牌）与补花分支。
- **双端协作**：服务端按无花牌组发牌摸牌 → 客户端只渲染常规牌 → 全程无补花环节。
- **业务行为**：
  - trigger：对局发牌与摸牌时
  - condition：使用杭州麻将牌组（136 张、无花牌）
  - action：不展示花牌牌面，也不出现补花提示与补花动画；服务端组牌与发牌时不生成花牌，摸牌流程中不执行补花
  - result：玩家对局中看不到花牌，也不会遇到补花流程
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 318 行）要求补花/花牌为预留能力、杭麻牌组无花牌；本轮服务端 applicability 为空、无 evidenceIds 与配置条件，客户端也无证据；按核验范围只看服务端，服务端无证据，无法证实牌组确实无花牌、补花确实未启用，故判 unverified。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）；非 `pending-blocked`。

### AT-ST-C23-019 花牌相关处理出现时需确认

- 所属功能点：FP-ST-C23-005 预留能力与超时提示确认（PRD 第 318 行）
- **需求规则**：若实际对局出现花牌相关处理，需确认。
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 在 :1235 列出本原子。无 CLE 证据、无 `file:line` 可定位。实现要点（需求口径，非实现事实）：若出现花牌逻辑，按当前实现展示并作为待确认现象上报。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，`configCondition` 为空；无 atomIds 属 ST-C23 的 SVE 条目。无 SVE 证据、无 `file:line` 可定位。需求口径为：若对局中确实触发花牌相关逻辑，按当前实现生成花牌或执行补花，并作为待确认现象上报。两端证据文本检索「花牌」命中 0，既无「存在花牌处理」的证据，也无「已排除花牌」的证据。
- **双端协作**：若对局出现花牌处理 → 记录实际表现 → 提交产品确认口径 → 按确认结果调整实现。
- **业务行为**：
  - trigger：实际对局中出现花牌相关处理时（需上报确认的场景）
  - condition：对局中确实触发了花牌相关逻辑
  - action：按当前实现展示花牌与补花表现，并作为待确认现象上报；服务端按当前实现生成花牌或执行补花，并作为待确认现象上报
  - result：玩家看到的花牌相关处理最终与产品确认后的口径一致
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 318 行）是待确认项，本身没有明确的「应为」口径；本轮客户端未找到证据，服务端 applicability 为空、无 evidenceIds，既无法证实存在花牌处理，也无法证实已排除，故判 unverified。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）；非 `pending-blocked`。

### AT-ST-C23-020 超时后无自动操作仅提示

- 所属功能点：FP-ST-C23-005 预留能力与超时提示确认（PRD 第 319 行）
- **需求规则**：超时后无任何自动操作（与无托管一致），仅提示。（UI 要求：超时时给出提示。）
- **验证范围**：both（`verificationScope=both`）
- **客户端职责**：`clientVerdict` 为空，`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 在 :1236 列出本原子。无 CLE 证据、无 `file:line` 可定位。实现要点（需求口径，非实现事实）：倒计时归零时给出超时提示，但不代替玩家出牌、不做任何自动选择。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，`configCondition` 为空；无 atomIds 属 ST-C23 的 SVE 条目。无 SVE 证据、无 `file:line` 可定位。需求口径为：超时后不执行任何自动出牌或自动操作，仅等待玩家操作，牌局状态不被自动推进。两端证据文本检索「超时」「timeout」「托管」「自动出牌」「倒计时」命中 0。
- **双端协作**：倒计时归零 → 客户端提示超时 → 服务端不做自动操作 → 牌局停在等待玩家操作的状态。
- **业务行为**：
  - trigger：玩家操作倒计时结束、发生超时时
  - condition：好友房没有托管功能
  - action：给出超时提示，但不代替玩家出牌、不做任何自动选择；服务端超时后不执行任何自动出牌或自动操作，仅等待玩家操作，牌局状态不被自动推进
  - result：玩家只看到超时提示，牌局不因超时被系统代为出牌而改变
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 319 行）要求超时后无任何自动操作、与无托管一致，仅给提示；本轮客户端未找到证据，服务端 applicability 为空、无 evidenceIds，无法证实超时后确实没有自动操作，故判 unverified。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）；非 `pending-blocked`。

### AT-ST-C23-021 超时提示表现以UI交互稿为准

- 所属功能点：FP-ST-C23-005 预留能力与超时提示确认（PRD 第 319 行）
- **需求规则**：提示的具体表现以 UI 交互稿为准。（UI 要求：超时提示的具体表现形式遵循 UI 交互稿。）
- **验证范围**：client（`verificationScope=client`）
- **客户端职责**：`clientVerdict` 为空（本阶段唯一 `client` 范围的原子，客户端判定同样为空），`clientEvidenceIds` 为空；`coverage.pendingAtomIds` 在 :1237 列出本原子。无 CLE 证据、无 `file:line` 可定位。实现要点（需求口径，非实现事实）：超时提示的位置、样式、文案、动效均以交互稿为准；本轮无交互稿映射与实现证据，无法比对。
- **服务端职责**：`applicability` 为空，`serverEvidenceIds` 为空，`configCondition` 为空；无 atomIds 属 ST-C23 的 SVE 条目。需求口径为：服务端只负责在超时时下发触发信号，不决定提示的具体表现；本原子核验范围为客户端，服务端非判定端。两端证据文本检索「超时」命中 0。
- **双端协作**：服务端判定超时 → 通知客户端 → 客户端按交互稿渲染超时提示。
- **业务行为**：
  - trigger：需要对玩家展示超时提示时
  - condition：以 UI 交互稿作为提示表现基准
  - action：按交互稿给出超时提示（位置、样式、文案、动效均以交互稿为准）；服务端只负责在超时时下发触发信号，不决定提示的具体表现
  - result：玩家看到的超时提示样式与交互稿一致
- **实际实现差异**：`difference=unverified`，`candidateDifference` 为空。`baselineDetail`：需求（第 319 行）规定超时提示的具体表现以 UI 交互稿为准，需与交互稿比对才能判定；本轮客户端检索结果为未找到（无 verdict、无 evidenceIds），没有可对照的实现证据与交互稿映射，故判 unverified。无复核建议。
- **验证结论（L7）**：`verification_required`，`l7Basis=proposed`（`effectiveDifference=unverified`；`scope=unknown`、`default-unknown`）；非 `pending-blocked`。

## 证据索引

本阶段 21 个原子在统一原子视图中均未挂证据：`clientEvidenceIds` 与 `serverEvidenceIds` 全为空，`configCondition` 全为空。客户端 12 条 CLE 证据的 atomIds 全部属于 AT-ST-C01 系列（client-evidence.json 的 `coverage.entryCount=29`、`stats.evidenceCount=12`、`stats.pending=387`，client-evidence.json:1240-1248），本阶段原子只出现在 `coverage.pendingAtomIds`（client-evidence.json:850 起，ST-C23 段位于 :1217-1237）；服务端 60 条 SVE 证据的 atomIds 亦全部属于 AT-ST-C01 系列（server-evidence.json 的 `stats.atomCount=29`、`stats.pending=387`，server-evidence.json:1479-1487），检索 `AT-ST-C23` 在 server-evidence.json 命中 0。因此本阶段不存在原子级 CLE / SVE 证据。

两端证据文本关键词命中情况（用于说明缺口，非证据）：`杠分` 0、`花牌` 0、`补花` 0、`超时` / `timeout` / `Timeout` 0、`托管` 0、`自动出牌` 0、`倒计时` 0、`拷响` 0、`翻倍` 0、`豪华七对` / `豪七` 0、`禁手` 0。

下表仅列出复核/分析说明与统一原子视图中跨原子引用、可作为后续补证线索的条目，均**不属于本阶段原子级证据**：

| 证据 id | layer | file:line | claimKey | 引用原子（旁证） | 说明 |
|---|---|---|---|---|---|
| SVE-AT-ST-C01-018-02 | hzmj_server | hzmj_server/game_logic.cpp:112-121 | chi-peng-mode-config-parse | AT-ST-C23-001 / 002 / 003 | 只说明 `rule_chi_peng` 由创房 JSON 解析，不证明界面显隐与人数联动默认值 |
| SVE-AT-ST-C01-018-03 | hzmj_server | hzmj_server/server_config.cpp:27-28 | box-default-chi-peng-unlimited | AT-ST-C23-001 / 002 / 003 | 只说明好友房默认 `SetOnlyPungNoChow(false)`、`SetRuleChiPeng(0)`，不覆盖 3/4 人房固定档位 |
| SVE-AT-ST-C01-018-01 | common_game | common_game/com_game/common_game_algorithm.cpp:79-84 | chi-peng-limit-two-per-direction | AT-ST-C23-003 / 014 | 只说明每方向 2 次的吃碰上限判定，不回答「吃碰禁手」术语映射 |
| SVE-AT-ST-C01-019-04 | hzmj_server | hzmj_server/server_config.cpp:20-21 | box-default-three-tan-off-pung-as-tan-on | AT-ST-C23-004 / 005 / 006 | 只说明好友房服务端 `pung_as_tan=true` 默认值，不覆盖客户端开关默认态 |
| SVE-AT-ST-C01-019-01 | common_game | common_game/com_game/common_game_com_pung.cpp:125-138 | pung-counts-one-tan-when-pung-as-tan | AT-ST-C23-005 | 只说明碰记 1 摊的分支，不覆盖直杠/加杠/暗杠计摊与关闭口径表现 |
| SVE-AT-ST-C01-019-03 | hzmj_server | hzmj_server/game_logic.cpp:65-87 | three-tan-forced-off-for-two-players | AT-ST-C23-006 | 只说明 ≤2 人强制关闭三摊承包，与碰算摊默认值定稿无关 |
| SVE-AT-ST-C01-020-01 | common_game | common_game/com_game/common_game_com_action.cpp:74-80 | only-pung-no-chow-blocks-chow | AT-ST-C23-014 | 只说明禁吃与 `kNIFExOnlyPungNoChow` 通知，不涉及禁打牌张算法 |
| SVE-AT-ST-C01-024-01 | common_game | common_game/com_game/common_game_com_action.cpp:62-66 | chow-judge-chi-peng-limit-call-site | AT-ST-C23-014 | 只说明吃牌前调用吃碰上限与先先摊校验，不涉及禁张范围 |
| SVE-AT-ST-C01-003-01 | common_game | common_game/com_game/common_game_com_ju.cpp:226-248 | cai-shen-type-behavior | AT-ST-C23-007 ~ 012 | 只说明财神取白板或翻财神牌种，不涉及拷响、三财/四财翻倍、替豪七 |
| SVE-AT-ST-C01-003-02 | hzmj_server | hzmj_server/game_logic.cpp:51-55 | cai-shen-type-json-key | AT-ST-C23-007 ~ 012 | 只说明 `cai_shen_type` JSON 键解析 |
| SVE-AT-ST-C01-003-03 | hzmj_server | hzmj_server/server_config.cpp:16 | cai-shen-type-default-white-board | AT-ST-C23-007 ~ 012 | 只说明财神类型默认白板 |
| CLE-AT-ST-C01-003-02 | client_code | data/GameData.ts:50 | cai-shen-type-values | AT-ST-C23-007 ~ 012 | 只说明客户端财神类型取值 0/1 |
| CLE-AT-ST-C01-003-03 | client_code | controller/cmd/gameCmd/GameJokerCmd.ts:74-77 | cai-shen-type-room-rule | AT-ST-C23-008 ~ 010 | 只说明翻财神动效触发条件 |
| SVE-AT-ST-C01-025-03 | common_game | common_game/com_game/common_game_server_config.h:65-66 | guard-dealer-only-3-4-players | AT-ST-C23-011 | 同名配置 `enable_guard_dealer` 的语义为禁碰限制（庄家上家无财神时禁碰庄家及庄下家），不是庄家延续/轮转规则 |
| SVE-AT-ST-C01-027-01 | common_game | common_game/com_game/common_game_algorithm.cpp:62-67 | guard-dealer-3-vs-4-player-scope | AT-ST-C23-011 | 只说明 3 人/4 人下禁碰范围的差异，不涉及下一局庄家归属 |
| SVE-AT-ST-C01-024-02 | common_game | common_game/com_game/common_game_com_pung.cpp:17-41 | pung-judge-chi-peng-and-guard-call-site | AT-ST-C23-013 / 014 | 只说明碰判定链路上的吃碰上限与守庄拦截调用点，不构成仲裁优先级证据 |
| SVE-AT-ST-C01-024-09 | hzmj_server | hzmj_server/server_config.cpp:19-39 | box-default-config-values | AT-ST-C23-004 / 006 | 只说明创房默认配置值集合，不证明客户端默认展示 |

补充说明：

- 本阶段不存在 `directConflict=true` 的原子，无 `conflictEvidenceIds`，无 `candidateDifference`，无升级原子。
- 上表所有条目的归属性 atomIds 均为 AT-ST-C01-*，按取证实务不得换算为本阶段原子证据；引用它们的目的是给出后续补证的落点，不改变 `difference=unverified` 的判定。

## 待处理事项

### 待验证（规则待验证，补证 both）

`pending-list.md` 中本阶段共 21 条（pending-list.md:410-430），问题类型均为「规则待验证」，说明为「证据不足」，建议动作均为「补证 both」；其中 AT-ST-C23-001 另附待审批复核建议。

| atomId | 验证范围 | 问题 | 说明 | 建议动作 |
|---|---|---|---|---|
| AT-ST-C23-001 | both | 规则待验证 | 证据不足（另有待审批复核建议：unverified） | 补证 both |
| AT-ST-C23-002 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C23-003 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C23-004 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C23-005 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C23-006 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C23-007 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C23-008 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C23-009 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C23-010 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C23-011 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C23-012 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C23-013 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C23-014 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C23-015 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C23-016 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C23-017 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C23-018 | server | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C23-019 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C23-020 | both | 规则待验证 | 证据不足 | 补证 both |
| AT-ST-C23-021 | client | 规则待验证 | 证据不足 | 补证 both |

查证未完成（`analysisPath=blocked`）：本阶段 0 条（21 个原子全部为 `full`，无 pending/timeout/failed 导致的阻塞）。
需策划裁决（`decision_required`）：本阶段 0 条（L7 分布中 decision_required 为 0；条目本身虽属「待确认」性质，但 L7 统一归为 verification_required）。

### 待审批建议（reviewStatus=pending，未生效）

| atomId | 建议差异 | 复核规则 | 状态 |
|---|---|---|---|
| AT-ST-C23-001 | unverified | no-server-evidence-is-not-conflict（本片 21 个原子双端证据均为零，需求多为待确认/待补全项，缺证只能维持 unverified） | pending / 未生效 |

建议动作：审批（approve/reject/hold）。该建议的 `reviewedDifference` 为 unverified，与当前生效的 `effectiveDifference` 相同，获批后不改变差异口径与 L7 结论。

### 补证方向（供后续取证参考，非结论）

- 创房吃碰档位（001-003）：需客户端创房面板在 3/4 人与 2 人下的吃碰档位控件显隐、默认选中项与提交字段证据；需服务端对「未提交档位」时实际生效档位的证据（当前旁证显示好友房 `rule_chi_peng` 默认 0 且不按人数自动切换，需确认与「默认吃碰」档的映射关系）；术语口径需产品确认。
- 碰算摊（004-006）：需客户端玩法设置中碰算摊开关的初始态证据，以及「无限吃碰档隐藏碰算摊」时的提交策略；需服务端碰、直杠、加杠、暗杠四类计摊分支与开关生效条件的证据。
- 财神与守庄语义（007-012）：拷响、三财/四财翻倍、财神替豪七、豪七定义、守庄（庄家延续）目前在两端证据文本中均无命中，需先由产品/服务端补齐规则口径，再按补全后的口径取证；注意区分 `enable_guard_dealer`（禁碰限制）与本条所指守庄语义。
- 服务端裁决（013-015）：需服务端对同一张牌多方响应的仲裁入口与优先级比较证据，以及「禁打牌张」范围计算与出牌校验的证据；正文定稿需以服务端规则为基准逐条核对。
- 预留能力与超时（016-021）：杠分、花牌/补花、超时/托管在两端证据文本中命中 0，需服务端补出杠牌结算分支、牌组构成与补花分支的排查证据（或确认不存在），需客户端补出超时提示实现与 UI 交互稿的映射证据。
