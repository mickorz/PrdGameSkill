# 阶段清单

> 来源：templates/【杭州麻将】核心流程杭州麻将好友房AI-核心简化版本.md（需求模板）+ source-code/client/Code + source-code/client/Fgui（客户端代码证据）
> 生成：output-spec-generate workflow，2026-11-14。客户端视角规格，verdict 分布见下表。

| 阶段 ID | 阶段 | 来源章节 | 功能点 | 原子项 | 已证实 | 部分证实 | 未找到 | 涉及协议消息 | 涉及 UI 模块 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ST-C01 | 定庄与轮庄 | 开局 > 定庄与轮庄 | 4 | 8 | 0 | 8 | 0 | MsgBankerLevelUp、MsgDrawn、MsgJuData、MsgResultHu、MsgStartGame、MsgThrowChip | box_hzmj_player、box_hzmj_result |
| ST-C02 | 财神与牌组 | 开局 > 财神与牌组 | 3 | 12 | 7 | 5 | 0 | MsgChowC、MsgChowS、MsgJoker、MsgKongC、MsgKongS、MsgPlayC、MsgPlayLmts、MsgPlayS、MsgPower、MsgPungC、MsgPungS、MsgResultHu、MsgStartGame | box_hzmj_main |
| ST-C03 | 发牌 | 开局 > 发牌 | 6 | 12 | 1 | 9 | 2 | MsgCancel、MsgEndWait、MsgHuC、MsgPower、MsgStartGame、MsgTake、MsgTakeFirst、MsgThrowChip、MsgWallMah |  |
| ST-C04 | 操作优先级 | 行牌 > 操作优先级 | 4 | 13 | 1 | 9 | 3 | MsgCancel、MsgChowC、MsgChowS、MsgHuC、MsgKongS、MsgPower、MsgPungC、MsgPungS、MsgResultHu | box_hzmj_main |
| ST-C05 | 吃、碰、杠 | 行牌 > 吃、碰、杠 | 8 | 28 | 4 | 22 | 2 | MsgChowC、MsgChowS、MsgKongC、MsgKongS、MsgPiao、MsgPlayLmts、MsgPower、MsgPungS、MsgResultHu、MsgTake、MsgTanUpdate | box_hzmj_main |
| ST-C06 | 杠后补牌 | 行牌 > 杠后补牌 | 3 | 14 | 3 | 9 | 2 | MsgChowS、MsgDrawn、MsgHuC、MsgKongC、MsgKongS、MsgPiao、MsgPlayC、MsgPlayS、MsgPower、MsgPungS、MsgResultHu、MsgTake、MsgWallMah | box_hzmj_tipAni |
| ST-C07 | 自摸、放铳、抢杠胡 | 行牌 > 自摸、放铳、抢杠胡 | 4 | 15 | 1 | 9 | 5 | MsgHuC、MsgJuData、MsgKongS、MsgPower、MsgReplace、MsgResultHu、MsgTake、MsgTakeFirst |  |
| ST-C08 | 飘财 | 行牌 > 飘财 | 5 | 20 | 5 | 11 | 4 | MsgNotifyInfo、MsgPiao、MsgPlayLmts、MsgPlayS、MsgPower、MsgRelinkOnAction | box_hzmj_tipAni |
| ST-C09 | 杠开、杠飘、飘杠 | 行牌 > 杠开、杠飘、飘杠 | 3 | 12 | 2 | 9 | 1 | MsgPiao、MsgPower、MsgResultHu、MsgWaitInfos | box_hzmj_tipAni |
| ST-C10 | 吃碰禁手 | 行牌 > 吃碰禁手 | 6 | 21 | 9 | 6 | 6 | MsgChowC、MsgKongS、MsgNotifyInfo、MsgPlayLmts、MsgPlayS、MsgTake |  |
| ST-C11 | 出牌与响应 | 行牌 > 出牌与响应 | 15 | 68 | 53 | 8 | 7 | MsgCancel、MsgChowC、MsgChowS、MsgEndGame、MsgHuC、MsgKongC、MsgKongS、MsgPlayC、MsgPlayLmts、MsgPower、MsgPungC、MsgPungS、MsgResultHu、MsgWaitInfos | box_hzmj_main、box_hzmj_tingPai、box_hzmj_tipAni |
| ST-C12 | 三摊承包 | 三摊承包 | 6 | 24 | 5 | 13 | 6 | MsgPiao、MsgPower、MsgResultHu、MsgTanUpdate | box_hzmj_result、box_hzmj_tipAni |
| ST-C13 | 算分 | 算分 | 8 | 17 | 0 | 15 | 2 | MsgPlayerScore、MsgResultHu、MsgStartGame | box_hzmj_result |
| ST-C14 | 番型 | 番型 | 10 | 30 | 5 | 22 | 3 | MsgJoker、MsgPiao、MsgPlayLmts、MsgPlayS、MsgPower、MsgResultHu、MsgWaitInfos |  |
| ST-C15 | 结算 | 结算 | 8 | 25 | 20 | 5 | 0 | MsgDrawn、MsgEndGame、MsgJoker、MsgJuData、MsgPlayerScore、MsgResultHu | box_hzmj_player、box_hzmj_result、box_hzmj_tipAni |
| **合计** | | | **93** | **319** | **116** | **160** | **43** | | |

