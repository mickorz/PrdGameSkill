# 杭州麻将（hzmj）客户端代码锚点图

维护说明：路径或行号漂移时更新本图；新增玩法时复制本图为 `references/{game-slug}-code-map.md` 并替换内容。

## 玩法标识

- 游戏内 ID：杭州麻将金币场 42319 / **好友房 42320**（本模板对应）/ 二人金币 42321 / 二人好友房 42322（`source-code/client/Code/config/GameDefine.ts:1-7`；GAME_NAME「杭州麻将」:24；MAX_PLAYER=4 :26）。
- 创房配置键：`GameBoxType.GAME_HZMJ_HYF = 42320`（`input-ui/xuanwulobby/assets/scripts/common/config/GameRuleConfig.ts:83`）、`GAME_ER_REN_HZMJ_HYF = 42322`（:85）；按钮配置挂接 `BoxRoomGameRuleButtonConfigHZMJ` / `...ERHZMJ`（:311-312）。

## 两大代码根（均为只读，编码混合 UTF-8/GBK）

| 根 | 内容 |
|---|---|
| `input-ui/xuanwulobby/` | 大厅 + 创房规则（玩法选项全集的主来源） |
| `source-code/client/Code/` | 杭麻玩法模块（名词术语、番型、牌定义；42319-42322 同族共用） |

## 创房选项规则主文件

`input-ui/xuanwulobby/assets/scripts/common/config/boxRoomRuleConfig/RuleHzmj.ts`（472 行）：

| 内容 | 行号 |
|---|---|
| `DefaultConfigHZMJ`（与服务端 game_rule 对齐的默认参数，含隐藏字段） | 6-54 |
| `DefaultConfigERHZMJ`（二人版，人数固定 2） | 56-61 |
| `BoxRoomGameRuleButtonConfigHZMJ.gameRule` | 63-462 |
| — 模式 `simple_mode`（正常=0/简洁=1） | 65-76 |
| — 人数 `ui_chair_count`（2人/3人/4人 + 联动） | 77-143 |
| — 局数 `ui_play_count`（4/8/16/24/32局、40/50/60片） | 144-251 |
| — 底分 `base_score`（1/2/5分，仅局数档） | 252-264 |
| — 玩法 `cai_shen_type`（白板财神=0/翻财神=1） | 265-275 |
| — 连庄数 `banker_level_type`（笃三老庄=2/笃二老庄=1/平庄起=0） | 276-287 |
| — 胡牌 `enable_banker_discard_hu`（自摸胡=0/庄闲放铳(庄三)=1） | 288-298 |
| — 吃碰 `rule_chi_peng`（无限吃碰=0/只碰不吃=1/默认吃碰=2，仅2人显示本组） | 299-332 |
| — 承包 `enable_three_tan_bao`（三摊承包=1/两摊封顶=0，仅3/4人） | 333-346 |
| — 规则复选组 `game_rules`（10 项，默认数组 :387） | 347-394 |
| — `follow_banker`/`follow_pay_type` 已整段注释停用 | 396-443 |
| — 封顶 `score_limit`（无=0/20/40/64/80/128/256，仅局数档） | 444-460 |
| `BoxRoomGameRuleButtonConfigERHZMJ`（二人版，去掉人数栏） | 464-472 |

局/片互斥：`ui_play_count` 提交时派生 `play_count`（局数档）/ `play_score`（打片档），两者互斥、另一方强制 0（RuleHzmj.ts:12-17）。

## 接线、类型与联动语义

- `.../scripts/common/config/GameRuleConfig.ts`：GameBoxType 81-85；玩法名 126-127；按钮配置挂接 292-320；`CommonRule` 通用规则枚举 246-267；`CommonRuleConfig` 默认表 278-289（截屏监控/超时解散/自动准备默认开；可托管/托管解散/搭子房/防作弊/实时语音/关闭互动/随机座位默认关）。
- `.../scripts/common/config/GameRuleConfigTypes.ts`：`IRelatedInitRule` 83-92（value/values=显示条件）；`IRelatedRuleType` 94-101（SHOW/ENABLED/SELECTED）；`IRelatedRule` 119-134（value 0不显示1显示；index 目标项）；`GameRuleOption` 137-170（default=默认选中下标/数组）。
- `.../hall/layer/boxRoom/boxRoomRule/RuleComp.ts`（联动实现，语义以此为准）：
  - `_selectRelatedRadioButton` 1544-1559：SELECTED `{value:X}` → 选中目标组中 value=X 的单项，并把规则值写为 X。
  - `_showRelatedRadioButton` 1562-1578：SHOW `{value:0|1, index:V}` → 目标组中 value=V 的单项隐藏/显示；SHOW `{value:0|1}`（无 index）→ 目标组整组隐藏/显示。
  - `_applyRelatedCheckboxRule` 1686-1692：复选 SHOW `{value:0|1}` → 目标复选框隐藏/显示。
  - `_matchInitRuleByConfigDefault` 1250-1262：relatedInitRule 与目标组默认选中项的 value 比对。
- 分支共享 `.../boxRoomRuleConfig/HzmjRuleShared.ts`（125 行）：淳安/萧山/桐庐分支改造用，杭麻好友房本体不走此文件。

## 名词术语源（`source-code/client/Code/config/`）

| 文件 | 内容 | 行号 |
|---|---|---|
| GameDefine.ts | 玩法 GameID 家族、GAME_NAME、MAX_PLAYER | 1-26 |
| BoxMahDefine.ts | `CombType` 吃碰杠动作（吃/碰/明杠/暗杠/补杠/打听） | 214-222 |
| | `ActionAniType`（…胡/自摸/一炮多响=8/抢杠胡=9/飘=10） | 227-239 |
| | `MahGameState`（…定庄/骰子/发牌/结束） | 826-855 |
| | `TingType`（普通/大/多/优/爆头 TYPE_BAO=4/财飘 TYPE_PIAO=5） | 874-887 |
| | `HuType`（自摸=1/点炮=2/抢杠胡=3） | 889-898 |
| | `EndType`（胡牌=1/荒牌 DRAWN=2/被动/快速） | 910-921 |
| FanDefine.ts | `HzmjFanType` 2401-2420（平胡…十风/杠飘/飘杠，注释含倍数与成立条件） | 13-70 |
| | `HzmjFanTypeNameStr` 番型中文名表 | 73-100 |
| | `HzmjHuFanComboAni` 组合动效档（杠飘/杠爆/七客） | 131-140 |
| | 2421-2428 为萧山番型（K_FTG_XSMJ_*），杭麻不得引用 | 58-70 |

规则帮助文案是 FGUI 静态资源，代码锚点仅到组件 `input-ui/xuanwulobby/assets/hall/layer/gameRule/GameRule42319Comp.ts`（15 行，PackageGameRuleHzmj 包）。

## 路径漂移兜底搜索

1. 规则文件：`input-ui/xuanwulobby/assets/**/boxRoomRuleConfig/Rule*.ts` 内 grep 玩法特征词（「笃三老庄」「白板财神」）。
2. 接线：grep `GAME_HZMJ_HYF` / `BoxRoomGameRuleButtonConfigHZMJ`。
3. 游戏定义：`source-code/client/**/config/GameDefine.ts` grep GAME_NAME。
4. 术语：grep 番型名（「杠上开花」「爆头」）定位 FanDefine；grep「荒牌」定位 EndType。
