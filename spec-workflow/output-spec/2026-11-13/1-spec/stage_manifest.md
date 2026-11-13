# 阶段清单

> 来源：templates/【杭州麻将】核心流程杭州麻将好友房AI-核心简化版本.md（需求模板）+ source-code/client/Code + source-code/client/Fgui（客户端代码证据）
> 生成：output-spec-generate workflow，2026-11-13。客户端视角规格，verdict 分布见下表。

| 阶段 ID | 阶段 | 来源章节 | 功能点 | 原子项 | 已证实 | 部分证实 | 未找到 | 涉及协议消息 | 涉及 UI 模块 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ST-C01 | 定庄与轮庄 | 开局 > 定庄与轮庄 | 4 | 8 | 0 | 8 | 0 | MsgBankerLevelUp、MsgDrawn、MsgJuData、MsgResultHu、MsgThrowChip | box_hzmj_player、box_hzmj_result |
| ST-C02 | 财神与牌组 | 开局 > 财神与牌组 | 3 | 11 | 6 | 5 | 0 | MsgChowS、MsgHuC、MsgHuEx、MsgJoker、MsgKongS、MsgNotifyInfo、MsgPiao、MsgPlayC、MsgPlayLmts、MsgPlayS、MsgPower、MsgPungS、MsgResultHu、MsgWallMah |  |
| ST-C03 | 发牌 | 开局 > 发牌 | 3 | 10 | 0 | 9 | 1 | MsgCancel、MsgEndWait、MsgHuC、MsgJuData、MsgPower、MsgTake、MsgTakeFirst、MsgWaitInfos、MsgWallMah | box_hzmj_main |
| ST-C04 | 操作优先级 | 行牌 > 操作优先级 | 5 | 13 | 1 | 8 | 4 | MsgCancel、MsgChowC、MsgChowS、MsgHuC、MsgHuEx、MsgHuItem、MsgKongC、MsgKongS、MsgPlayS、MsgPower、MsgPungC、MsgPungS、MsgResultHu | box_hzmj_main |
| ST-C05 | 吃、碰、杠 | 行牌 > 吃、碰、杠 | 9 | 31 | 2 | 28 | 1 | MsgChowC、MsgChowS、MsgHuC、MsgHuEx、MsgKongC、MsgKongS、MsgPiao、MsgPlayLmts、MsgPower、MsgPungC、MsgPungS、MsgResultHu、MsgTake、MsgTanUpdate | box_hzmj_result |
| ST-C06 | 杠后补牌 | 行牌 > 杠后补牌 | 3 | 14 | 3 | 6 | 5 | MsgDrawn、MsgHuC、MsgKongC、MsgKongS、MsgPlayC、MsgPlayS、MsgPower、MsgResultHu、MsgTake |  |
| ST-C07 | 自摸、放铳、抢杠胡 | 行牌 > 自摸、放铳、抢杠胡 | 4 | 15 | 1 | 10 | 4 | MsgGameConfig、MsgHuC、MsgKongS、MsgPower、MsgResultHu、MsgTakeFirst |  |
| ST-C08 | 飘财 | 行牌 > 飘财 | 5 | 18 | 3 | 9 | 6 | MsgChowS、MsgNotifyInfo、MsgPiao、MsgPlayLmts、MsgPower、MsgPungS | box_hzmj_tipAni |
| ST-C09 | 杠开、杠飘、飘杠 | 行牌 > 杠开、杠飘、飘杠 | 3 | 12 | 5 | 6 | 1 | MsgPiao、MsgResultHu |  |
| ST-C10 | 吃碰禁手 | 行牌 > 吃碰禁手 | 5 | 22 | 8 | 5 | 9 | MsgChowC、MsgKongS、MsgNotifyInfo、MsgPlayLmts、MsgPlayS |  |
| ST-C11 | 出牌与响应 | 行牌 > 出牌与响应 | 12 | 56 | 29 | 23 | 4 | MsgCancel、MsgChowC、MsgChowS、MsgHuEx、MsgKongC、MsgKongS、MsgPlayC、MsgPlayLmts、MsgPower、MsgPungC、MsgPungS、MsgResultHu、MsgTake、MsgWaitInfos | box_hzmj_main、box_hzmj_tingPai |
| ST-C12 | 三摊承包 | 三摊承包 | 7 | 26 | 9 | 13 | 4 | MsgChowS、MsgPiao、MsgPower、MsgResultHu、MsgTanUpdate | box_hzmj_result、box_hzmj_tipAni |
| ST-C13 | 算分 | 算分 | 8 | 24 | 1 | 15 | 8 | MsgJuData、MsgPlayerScore、MsgPower、MsgResultHu、MsgStartGame、MsgTanUpdate、MsgVsPlayerInfo | box_hzmj_tingPai |
| ST-C14 | 番型 | 番型 | 7 | 30 | 4 | 22 | 4 | MsgHuItem、MsgJoker、MsgPlayLmts、MsgPower、MsgResultHu、MsgWaitInfos | box_hzmj_result、box_hzmj_tingPai |
| ST-C15 | 结算 | 结算 | 12 | 59 | 35 | 23 | 1 | MsgEndGame、MsgEndWait、MsgJuData、MsgPlayerScore、MsgResultHu、MsgStartGame、MsgWallMah | box_hzmj_result、box_hzmj_tipAni |
| **合计** | | | **90** | **349** | **107** | **190** | **52** | | |

