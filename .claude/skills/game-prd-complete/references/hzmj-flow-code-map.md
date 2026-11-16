# 杭州麻将（hzmj）流程代码锚点图

维护说明：路径或行号漂移时更新本图；换玩法时复制本图为 `references/{game-slug}-flow-code-map.md` 并替换内容。

## 玩法模块根

`source-code/client/Code/`（杭州麻将全家族共用：42319 金币 / 42320 好友房 / 42321、42322 二人）。分层：`protocol/`（协议主干）、`data/`（对局状态数据）、`controller/`（协议处理与场景调度）、`layer/`（FGUI 视图）、`interface/`、`config/`。

## 协议主干：protocol/GameGlcProtocol.ts（999 行）

- `GAME_STATUS` 状态机（空闲/开始/定庄/骰子/做手牌/财神/发牌/补花后发牌/补花/操作阶段/庄摸牌/下家摸牌/自己摸牌/听牌/吃牌/碰牌/明杠/暗杠/补杠/胡牌/出牌/胡选择/结算阶段/结束）：11-60。
- S→C 消息类：MsgWaitInfo 等待 :168、MsgStartGame 开始 :181、MsgEndGame 结束 :194、**MsgRelinkEnter 重连进入 :207**、MsgJuData 局数据 :220、MsgWallMah 牌墙 :233、MsgThrowChip 骰子 :246、MsgTakeFirst 发牌 :259、**MsgJoker 财神 :272**、**MsgDrawn 流局 :285**、**MsgPower 权限 :298**、MsgReplace 补 :311、MsgTake 抓 :324、MsgPlayS 出 :337、**MsgHuEx 多人和 :350**、MsgChowS 吃 :363、MsgPungS 碰 :376、MsgKongS 杠 :389、**MsgPlayLmts 出牌限制（禁手）:402**、MsgReplaceFirst :415、MsgWaitS 报听 :428、MsgEndWait 等待结束 :454、MsgNotifyInfo :480、MsgPlayerScore 玩家分数 :493、MsgFlower 花牌 :506、MsgPlayerMah :519、MsgOutMah :532、MsgTurnData 轮次 :545、MsgActionNotify 动作通知 :558、**MsgRelinkOnIdle 空闲重连 :571**、**MsgResultHu 胡牌/流局完整结算 :741**。
- C→S 消息类：MsgPlayC 出 :585、MsgHuC 胡 :611、MsgChowC 吃 :624、MsgPungC 碰 :637、MsgKongC 杠 :650、MsgWaitC :663、MsgCancel 取消 :689。
- 已注释停用：洗牌/报听三件套/虚拟玩家/重连场景系列 :757-933。
- 解析分发：`HzmjDataParser` :88-94、`GAME_MSG_DECODERS` :935+。

## 数据层：data/GameData.ts（2034 行）

| 流程簇 | 锚点 |
|---|---|
| 牌墙（正向/反向抓牌：nDir 1=正向头部摸牌，2=反向尾部杠补牌） | 33-42、resetWall 630-683（isRelink 重连恢复）、takeWalls 685-740 |
| 骰子 | 256-270 |
| 庄家（服务器位/本地座位） | 825-853 |
| 当前权限（MsgPower 位） | 857-911 |
| 听牌提示分级（大/多/优） | calcCanTingInfo 333-409 |
| 杠上开花判定 | checkCanGangBao 411-455 |
| 结算（好友房/胡牌结算数据） | setBoxResult 929-944、setGuiYangResultData 1410-1424 |
| 番种/番型详情（fan_id+mult） | setHuFanIds 1073-1095、setFanDetails 1718-1730 |
| 连庄次数 | 1447-1461 |
| **牢庄等级与庄闲倍数（1牢=2、2牢=4、3牢=8）** | 1593-1665 |
| **摊信息（三摊承包）** | updateTanItems 1667-1679 |
| **飘计数（飘财/财飘）** | updatePiaoState/recoverPiaoState/getPiaoCount 1695-1716 |
| **出牌限制/禁手（MsgPlayLmts：hands 禁打手牌 + dang_fang 禁打单放）** | setPlayLimitMahs/canPlayCard 1732-1804 |
| 财神（jokerMah/翻财神白板替牌/财神色可点击无角标） | setJokerData 1806-1817、getJokerColorValues 1818-1824、isJokerMah 1826-1837 |
| 记牌器（本家辅助） | 1464-1526 |
| 简洁模式（抑制规则类 toast、三摊落地动画、摸财神动效） | 1442-1445 |
| 托管 | 512-528 |
| 杠分（**无消费方，预留/死代码**） | 105、1331-1350（消费方仅 FguiViewDefine.ts:209 事件名） |
| 好运来/财神计数（玄学曝光用，跨局数据） | 1854-2003 |
| 补牌动画/听牌动画 | 1136-1203 |

`data/PlayerCardsData.ts`（517 行）：番型/结算/点炮 232-274、抢杠 444。

## 控制器：controller/gameController.ts（1191 行）

| 流程 | 锚点 |
|---|---|
| **断线重连场景恢复（gameSceneBack：按 state 解析→onResetUI→场景命令执行→听牌箭头兜底→sendSelfGps）** | 301-335 |
| 超时提示（无托管：超时回归仅提示，无自动操作） | _decodeSeatForBotHint 150-155、_playerBotHintTimeoutEnd 363-370 |
| 骰子协议处理 | 685-735 |
| 结算协议处理 | 245-291、784 |
| 好运来/玄学曝光（配置开关 expIcon.rightBottonSwitch 控制，运营功能非核心流程） | 851-945、1060-1071 |
| 加倍（金币场） | 44、438-445 |
| 复盘/富盘 | 284、407、601-659 |

## 视图层（layer/，UI 表现细节归 ui-interaction-prd-extract 基准）

| 视图 | 内容 | 锚点 |
|---|---|---|
| BoxHzmjMainView.ts | 禁手提示（「该牌被禁打」等）、倒计时、重连界面处理 | 1259-1473、1591、1221-1519 |
| BoxHzmjMah2DView.ts | 骰子动画、摊/优先级展示、结算展示 | 64-74、979-1043、1150-1159 |
| BoxHzmjTipAniView.ts | 字效（飘/摊/三摊落地/胡牌动画）、点炮、番型动效 | 485-1122、1649-1778 |
| BoxHzmjResultView.ts | 小结算面板 | 16-276 |

## 不适用登记（代码存在但本期/本玩法不启用）

| 项 | 锚点 | 不适用原因 |
|---|---|---|
| 金币场加倍（MsgDouble/setDoubleUpdate） | GameGlcProtocol.ts:597-600、GameData.ts:1613-1631 | 金币场专属，好友房无 |
| 萧山跟庄骰子结算 | GameData.ts:1616-1647 | 萧山麻将专属 |
| 做牌/测试模式（MsgSpecf* 系） | GameGlcProtocol.ts:441-728、GameData.ts:946-1008 | 测试工具 |
| 复盘/富盘 | GameData.ts:1353-1376、gameController.ts:601-659 | 回放功能 |
| 补花/花牌（MsgFlower/MsgReplace/补花状态） | GameGlcProtocol.ts:311、506、GAME_STATUS 26-28 | 框架预留；杭麻 136 张无花牌 |
| 托管 | GameData.ts:512-528 | 本期固定无托管 |
| 杠分 | GameData.ts:105、1331-1350 | 无消费方（死代码/预留） |
| 好运来/玄学曝光 | gameController.ts:851-945 | 运营曝光功能，配置开关控制，非对局流程 |
| 记牌器 | GameData.ts:1464-1526 | 本家辅助工具，非对局流程 |

## 服务端裁决佐证（客户端不可证项的旁证）

- 服务端游戏流程规则基准：`.claude/skills/game-prd-check/references/rules/hzmj_game_flow_handler/hzmj_game_flow_handler/`（操作优先级仲裁、禁张算法、摊/承包判定等服务端逻辑）。
- 客户端代码只能证明展示与拦截（按钮显隐、禁打 toast、摊动画），不能证明裁决规则。

## 路径漂移兜底搜索

1. 协议：`source-code/client/Code/protocol/*.ts` grep `class Msg`。
2. 数据簇：grep `updateTanItems|setPlayLimitMahs|updatePiaoState|getZhuangXianMult`。
3. 重连：grep `gameSceneBack|MsgRelinkEnter|recoverPiaoState`。
4. 死代码判定：全模块 grep 方法名（如 `addGangScore`），除定义与事件名外无调用即视为预留。
