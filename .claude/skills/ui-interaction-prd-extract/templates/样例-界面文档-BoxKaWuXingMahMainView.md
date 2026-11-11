# 主界面（BoxKaWuXingMahMainView）

> [← 返回模块分析](../模块分析.md) | [界面分析总表](../界面分析.md)
> 本文档是用真实数据填充的**样例**，展示界面文档模板的完整用法。

## 1. 基本信息

| 项 | 值 |
|---|---|
| FGUI 组件 | boxkawuxing_mah_game 包 / BoxKaWuXingMahMainView.xml |
| 代码类 | `layer/BoxKaWuXingMahMainView.ts`（2731 行） |
| 类型 | 全屏（Base 层常驻主界面） |
| Layer / sortingOrder | gf.ViewLayer.Base / FuiCommonGameViewSorting.Main |
| FGUI 包依赖 | packages: boxkawuxing_mah_ani、boxkawuxing_mah_common、boxkawuxing_mah_game；exPkgs: fgui_lobby/game_mah（角标图跨包） |
| 打开方式 | 常驻（随游戏场景创建） |

## 2. 界面职责

对局主界面：承载操作按钮区（吃/碰/杠/胡/过/亮/取消）、出牌放大展示位、剩余牌数显示；同时是对局内大部分玩法弹层（选漂、选字、扣牌、听牌提示、买马、结算）的调度中枢——由它监听流程事件并 showFgui/hideFgui 这些弹层。

## 3. 布局结构

```
BoxKaWuXingMahMainView
├─ KW_Handler            # 操作按钮容器（有操作权限时 visible=true）
│  ├─ KW_BTN_Hu          # 胡（含 KW_HuPai 胡牌张数 + KW_HuPaiBeiShu 倍数 + KW_Action 动画）
│  ├─ KW_BTN_Peng        # 碰
│  ├─ KW_BTN_Gang        # 杠
│  ├─ KW_BTN_Chi         # 吃
│  ├─ KW_BTN_Guo         # 过（需发回服务端的过）
│  ├─ KW_BTN_Guo2        # 过（本地过，无需发服务端）
│  ├─ KW_BTN_Liang       # 听(亮)（亮倒入口，默认隐藏）
│  ├─ KW_BTN_Cancle      # 取消
│  ├─ KW_BTN_PGs         # 吃碰杠供选列表入口按钮
│  ├─ KW_GangGrps        # 多组吃/碰/杠供选弹层
│  │  └─ KW_GangGrpList  # 供选列表（chiGangBtn item，KW_Mah0~3 牌面）
│  └─ KW_CompTing        # 听牌相关组件
├─ KW_ShowCard0~3        # 出牌放大展示位（按座位索引显示）
└─ KW_Wall_Num           # 剩余牌数（新版用 KW_RIGHT_MAHS，此节点为旧版兼容）
```

## 4. 组件清单

| 组件/节点 | 类型 | 交互组件文档 | 说明 |
|---|---|---|---|
| KW_Handler 按钮区 | 复合控件 | （本文档第 5 节覆盖） | 按权限位显隐各按钮 |
| KW_GangGrpList | 列表 | （本文档第 5 节覆盖） | 多组吃碰杠供选，每组一张牌面按钮 |
| KW_ShowCard0~3 | 展示位 | - | 静态：放大显示对应座位打出的牌 |
| KW_Wall_Num | 文本+牌背 | - | 静态：剩余牌数（旧版，默认隐藏） |
| 手牌区 | 复合控件 | [BoxKaWuXingPlayerHandCards](../组件/BoxKaWuXingPlayerHandCards.md) | 挂在 2D 牌桌层，主界面通过 controller 引用驱动（角标/置灰/门闸） |

## 5. 用户交互（按钮与操作）

| 操作 | 触发组件 | 响应逻辑 | 后续 |
|---|---|---|---|
| 点【胡】 | KW_BTN_Hu | 收起听牌提示/扣牌页/供选列表，隐藏听牌按钮 | `BaseMahController.sendHu()` |
| 点【碰】 | KW_BTN_Peng | 取消自动摸打标记 | 仅 1 组组合直接 `sendPung()`；多组展开 KW_GangGrps 供选 |
| 点【杠】 | KW_BTN_Gang | 同上；多杠时每组只展示一张牌避免重复 | `sendKong(combo)` |
| 点【吃】 | KW_BTN_Chi | 同上 | `sendChow(combo)` |
| 点【过】(需上报) | KW_BTN_Guo | 隐藏供选区；亮倒态下锁定手牌为"摸啥打啥" | `BaseMahController.sendCancel()` |
| 点【过】(本地) | KW_BTN_Guo2 | 仅收起按钮区，不发协议 | 无网络请求 |
| 点【亮】 | KW_BTN_Liang | 有可扣牌先弹扣牌层选扣；无可扣牌直接进"亮倒+出牌"（置灰不可出牌） | 打开 [XuanKouPaiLayer](BoxKaWuXingXuanKouPaiLayer.md) / 进入亮倒出牌态 |
| 点【取消】 | KW_BTN_Cancle | 取消自动摸打/托管 | 发送取消托管 |
| 点扣牌确认 | XuanKouPaiLayer 回抛事件 | 按 `liangKouOpts` 反查合法扣牌组合，命中记 comboId，未命中按"亮倒不扣牌"(flag=1) 继续 | 打开亮倒出牌选择（`_openTingPai`） |
| 点选漂 | XuanPiaoView 回抛事件 | 收起选漂页，立即本地播一次定漂动画（不等广播） | `BoxKaWuXingController.sendPiao(askid, piao)` |

## 6. 内部状态

| 状态字段 | 含义 | 变化时机 | 界面表现 |
|---|---|---|---|
| _liangFlag | 亮倒所选扣牌组合号（1-based，0=不扣） | 扣牌确认时写入 | 决定后续出牌门闸与角标 |
| _tingPlayables | 亮倒出牌阶段可出的牌值 | 亮倒确认后写入 | 其余手牌置灰且不可点 |
| _tingPaiOpen | 听牌/亮倒出牌提示弹层是否打开 | _openTingPai / _closeTingPai | 控制提牌是否显示听口提示 |
| _selfHasLiang | 本座本局是否已真正亮倒 | LiangS 到达确认 / 放弃时清除 | 亮倒后不能再吃碰；出牌"摸啥打啥" |
| _liangRequested | 已点击亮倒、等待服务端确认 | 点【亮】后 | 防重复提交 |
| _autoHu / _autoCancelRequested | 自动胡及取消标记 | 托管事件 / 玩家取消 | 忽略晚到的锁手牌通知 |
| _pendingLiangAutoPlay | 亮倒后等待延迟自动出牌 | 只收到出牌权限时 | 自动打出刚摸的牌 |
| _settlePending | 结算袋已到、等胡牌动效播完 | Settle 到达且胡动画在播 | 挂起结算链，动效结束或 4s 兜底后再弹 |
| _zhuangTipsShown | 本局首出庄/闲提示已展示 | 首个出牌权限 | 展示一次后不再展示 |

## 7. 监听的内部事件

| 事件 | 处理函数 | 行为概要 |
|---|---|---|
| BaseMahGameEvent.Power | onPower | 收到操作权限：按权限位显隐吃碰杠胡过亮按钮；亮倒自动胡房规直接代发胡 |
| BaseMahGameEvent.StartGame | _onStartGameResetLiang | 新一局重置亮倒/扣牌/托管状态，恢复常规出牌校验 |
| BaseMahGameEvent.ResetUI | resetUI | 每小局清桌面：收辅助弹层、清角标、隐藏大牌 |
| BaseMahGameActEvent.PlayOutStart | onPlayOutStart | 出牌动画开始：播语音、放大显示出牌、收听口提示 |
| BaseMahGameEvent.HuMah | _onHuHideBigCard | 胡牌：隐藏大牌与按钮区，收扣牌/听牌辅助页 |
| BoxKaWuXingGameEvent.BoxKaWuXingPiaoRec | _onPiaoRec | 选漂询问：本座未提交则弹选漂页，刷新各座漂状态 |
| BoxKaWuXingGameEvent.BoxKaWuXingZiRec / ZiS | _onZiRec / _onZiS | 选字询问/结果：刷新选字状态页，本座完成后收起选择页 |
| BoxKaWuXingGameEvent.BoxKaWuXingSettle | _onSettle | 结算袋下发：等胡牌动效播完（或 4s 兜底）再走结算链 |
| BaseMahGameEvent.RelinkEnd | _onRelinkEnd | 重连结束：按缓存的 askid 恢复未提交的选字/选漂页；恢复亮倒单放牌 |
| GameCommonUIEventDefine.onPlayAgain | _onPlayAgain | 再来一局：彻底清理（停动画、收全部玩法弹层、清庄家缓存） |
| BoxKaWuXingViewEvent.BoxKaWuXingBtnXuanPiao | _onBtnXuanPiao | 选漂页点选回调（见第 5 节） |
| BoxKaWuXingViewEvent.BoxKaWuXingKouSelectChange | _onKouSelectChange | 扣牌勾选变化：实时预览手牌【扣】角标 |
| BoxKaWuXingViewEvent.BoxKaWuXingBtnKouConfirm | _onKouConfirm | 扣牌确认（见第 5 节） |
| BoxKaWuXingViewEvent.BoxKaWuXingHuAniEnd | _onHuAniEnd | 胡牌动效结束：结算挂起时弹出结算链 |

（完整清单以代码 `@gf.listen` 为准，此处列主要项）

## 8. 网络事件关联

### 收（经 Controller/GameData 转为内部事件后驱动本界面）

| Cmd | 触发时机 | 本界面行为（经内部事件） |
|---|---|---|
| PiaoRecCmd | 选漂阶段服务端询问 | dispatch PiaoRec → 弹选漂页 |
| PiaoSCmd | 任一玩家确认选漂，全桌广播 | dispatch PiaoS → 本座已完成则收起选漂页 |
| ZiRecCmd / ZiSCmd | 选字询问/结果广播 | dispatch ZiRec/ZiS → 刷新选字状态页 |
| SettleCmd | 局终结算袋下发 | dispatch Settle → 挂起等待动效后弹结算链 |
| MsgRelinkOn* 系列 | 断线重连恢复各阶段 | RelinkEnd → 恢复未提交的选择页与亮倒单放牌 |

### 发（本界面用户操作触发，经 Controller）

| 用户操作 | 发送方法 | 协议 |
|---|---|---|
| 点【胡】 | BaseMahController.sendHu() | {Hu 协议 xyid} |
| 点【碰/杠/吃】确认 | sendPung / sendKong / sendChow | {对应 xyid} |
| 点【过】(需上报) | BaseMahController.sendCancel() | {Cancel 协议 xyid} |
| 确认选漂 | BoxKaWuXingController.sendPiao(askid, piao) | WHMJ_PIAO_C |
| 确认选字 | BoxKaWuXingController.sendZi(askid, zis) | WHMJ_ZI_C |

## 9. 界面跳转

| 方向 | 目标/来源 | 触发条件 |
|---|---|---|
| 打开 | [XuanPiaoView](BoxKaWuXingXuanPiaoView.md) | PiaoRec 询问且本座未提交 |
| 打开 | [XuanZiView](BoxKaWuXingXuanZiView.md) / [XuanZiStateView](BoxKaWuXingXuanZiStateView.md) | ZiRec 询问 |
| 打开 | [XuanKouPaiLayer](BoxKaWuXingXuanKouPaiLayer.md) | 点【亮】且有可扣牌 |
| 打开 | [TingPaiHintView](BoxKaWuXingTingPaiHintView.md) | 提起手牌且该牌可听 |
| 打开 | [MaiMaView](BoxKaWuXingMaiMaView.md) → [MahResultNewView](BoxKaWuXingMahResultNewView.md) | 结算链：有买马先弹买马页 2.5s，再弹结算页 |

## 10. 交互细节与边界规则

- 亮倒后不能再吃/碰（杠按服务端权限走：仅扣下的牌或先前碰的牌可杠）
- 超时托管代打时若尚未真正亮倒（仅 _liangRequested），按取消亮倒处理：解锁手牌、扣牌结果作废
- 亮倒出牌阶段：整手牌按"可出名单"重刷置灰，【扣】角标在门闸之后再贴，避免看到门闸的灰而非扣牌数据的灰
- 操作按钮的 Spine 动画在独立包（boxkawuxing_mah_ani），包未就绪时清空 url 再写回以触发重新加载
- 结算链兜底：胡牌/番型动效事件丢失时 4 秒超时后仍弹结算
- 匹配场开局后隐藏倒计时/TIPS 与换桌按钮；换房广播 startMatch 时统一清结算/买马残留弹层
