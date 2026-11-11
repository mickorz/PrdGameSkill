# 主界面（BoxKaWuXingMahMainView）

> [← 返回模块分析](../模块分析.md) | [界面分析总表](../界面分析.md)
> 本文档是用真实数据填充的**样例**，展示界面文档模板的完整用法（含状态机、四类交互限制、测试场景）。

## 文档状态

- status: draft
- 代码基线：main@587a226（input-ui/xuanwulobby/assets/42324）
- last_updated: 2026-11-11

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
└─ KW_Wall_Num           # 剩余牌数（旧版，默认隐藏，见待确认清单）
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

| 操作 | 触发组件 | 前置条件 | 响应逻辑 | 失败/空态 | 后续 |
|---|---|---|---|---|---|
| 点【胡】 | KW_BTN_Hu | 收到胡权限（POWER_ID_HU），房规"亮倒自动胡"时代发 | 收起听牌提示/扣牌页/供选列表，隐藏听牌按钮 | 未获权限时按钮不可见 | `BaseMahController.sendHu()` |
| 点【碰】 | KW_BTN_Peng | 碰权限位（POWER_ID_PONG）且未亮倒 | 取消自动摸打标记 | 亮倒态按钮隐藏；无权限不可见 | 仅 1 组直接 `sendPung()`；多组展开供选 |
| 点【杠】 | KW_BTN_Gang | 杠或补杠权限位 | 同上；多杠每组只展示一张牌避免重复 | 无组合时不展开 | `sendKong(combo)` |
| 点【吃】 | KW_BTN_Chi | 吃权限位（POWER_ID_CHOW）且未亮倒 | 同上 | 亮倒态按钮隐藏 | `sendChow(combo)` |
| 点【过】(需上报) | KW_BTN_Guo | 有需发服务端的取消权限或有亮倒机会 | 隐藏供选区；亮倒态下锁定手牌"摸啥打啥" | 无权限不可见 | `BaseMahController.sendCancel()` |
| 点【过】(本地) | KW_BTN_Guo2 | 仅本地取消权限（无上报项） | 仅收起按钮区 | 权限位不满足则不显示 | 无网络请求 |
| 点【亮】 | KW_BTN_Liang | 亮倒权限（POWER_ID_WAIT，打出一张后可听） | 隐藏碰杠胡按钮，做扣牌判断 | 不满足亮倒条件按钮不出现 | 有可扣牌→[XuanKouPaiLayer](BoxKaWuXingXuanKouPaiLayer.md)；无→直接亮倒出牌态 |
| 点【取消】 | KW_BTN_Cancle | 托管/自动摸打中 | 取消托管标记，解锁手牌 | 非托管态不显示 | 发送取消托管 |
| 扣牌确认 | XuanKouPaiLayer 回抛事件 | 扣牌弹窗打开 | 按 `liangKouOpts` 反查合法组合，命中记 comboId，未命中按"亮倒不扣牌"(flag=1) | 校验必过，无失败分支 | 进亮倒出牌态（`_openTingPai`） |
| 点选漂 | XuanPiaoView 回抛事件 | 选漂询问中且本座未提交 | 收起选漂页，立即本地播一次定漂动画（不等广播） | 已提交（done=1）不再弹页 | `BoxKaWuXingController.sendPiao(askid, piao)` |

## 6. 内部状态

| 状态字段 | 含义 | 变化时机 | 界面表现 |
|---|---|---|---|
| _liangFlag | 亮倒所选扣牌组合号（1-based，0=不扣） | 扣牌确认时写入 | 决定后续出牌门闸与角标 |
| _tingPlayables | 亮倒出牌阶段可出的牌值 | 亮倒确认后写入 | 其余手牌置灰且不可点 |
| _tingPaiOpen | 听牌/亮倒出牌提示弹层是否打开 | _openTingPai / _closeTingPai | 控制提牌是否显示听口提示 |
| _selfHasLiang | 本座本局是否已真正亮倒 | LiangS 到达确认 / 放弃时清除 | 亮倒后不能再吃碰；出牌"摸啥打啥" |
| _liangRequested | 已点击亮倒、等待服务端确认 | 点【亮】后 | 防重复提交；超时托管时据此回退 |
| _autoHu / _autoCancelRequested | 自动胡及取消标记 | 托管事件 / 玩家取消 | 忽略晚到的锁手牌通知 |
| _pendingLiangAutoPlay | 亮倒后等待延迟自动出牌 | 只收到出牌权限时 | 自动打出刚摸的牌 |
| _settlePending | 结算袋已到、等胡牌动效播完 | Settle 到达且胡动画在播 | 挂起结算链，动效结束或 4s 兜底后再弹 |
| _zhuangTipsShown | 本局首出庄/闲提示已展示 | 首个出牌权限 | 展示一次后不再展示 |

## 7. 状态机

### 7.1 亮倒主线（本座）

| 当前状态 | 事件/触发 | 下一状态 | 代码锚点 |
|---|---|---|---|
| 正常行牌 | 收到亮倒权限（POWER_ID_WAIT） | 亮倒按钮态（【亮】【过】显示） | onPower |
| 亮倒按钮态 | 点【过】 | 正常行牌（本轮按钮消失） | _onGuo |
| 亮倒按钮态 | 点【亮】（有可扣牌） | 扣牌弹窗态 | _onLiang → _openKouPanel |
| 亮倒按钮态 | 点【亮】（无可扣牌） | 亮倒出牌态 | _onLiang → _openTingPai |
| 扣牌弹窗态 | 勾选变化 | 选中预览联动（手牌实时贴【扣】角标） | _onKouSelectChange |
| 扣牌弹窗态 | 确认且命中合法组合 | 亮倒出牌态（_liangFlag=comboId） | _onKouConfirm |
| 扣牌弹窗态 | 确认未命中 | 亮倒出牌态（flag=1 不扣） | _onKouConfirm |
| 扣牌弹窗态 | 点取消 / 超时托管代打（未真正亮倒） | 正常行牌（扣牌作废，解锁手牌） | _closeLiangFlowPanels |
| 亮倒出牌态 | 点可出名单内的牌 | 出牌 → 持续亮倒行牌（等 LiangS 确认） | _openTingPai 门闸 |
| 持续亮倒行牌 | 只收到出牌权限 | 自动打出刚摸的牌 | _tryLiangAutoPlay |
| 持续亮倒行牌 | 胡权限 + 房规"亮倒自动胡" | 代发胡（不等玩家点） | _shouldLiangAutoHu → _onHu |
| 持续亮倒行牌 | 点【过】 | 保持"摸啥打啥"（不回正常态） | _onGuo |
| 任意亮倒态 | 胡牌（HuMah） | 按钮区隐藏、收辅助页 → 结算 | _onHuHideBigCard |

### 7.2 结算链

| 当前状态 | 事件/触发 | 下一状态 | 代码锚点 |
|---|---|---|---|
| 结算袋到达 | Settle 且胡动画播放中 | 结算挂起（4s 兜底 DelayCall） | _onSettle |
| 结算挂起 | 胡动画结束（HuAniEnd）或 4s 兜底 | 结算链 | _onHuAniEnd / DelayCall 回调 |
| 结算链 | 有买马 | 买马页展示 2.5s → 结算页 | _startSettleChain |
| 结算链 | 无买马 | 直接弹结算页 | _showResultView |

## 8. 监听的内部事件

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

## 9. 网络事件关联

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

## 10. 界面跳转

| 方向 | 目标/来源 | 触发条件 |
|---|---|---|
| 打开 | [XuanPiaoView](BoxKaWuXingXuanPiaoView.md) | PiaoRec 询问且本座未提交 |
| 打开 | [XuanZiView](BoxKaWuXingXuanZiView.md) / [XuanZiStateView](BoxKaWuXingXuanZiStateView.md) | ZiRec 询问 |
| 打开 | [XuanKouPaiLayer](BoxKaWuXingXuanKouPaiLayer.md) | 点【亮】且有可扣牌 |
| 打开 | [TingPaiHintView](BoxKaWuXingTingPaiHintView.md) | 提起手牌且该牌可听 |
| 打开 | [MaiMaView](BoxKaWuXingMaiMaView.md) → [MahResultNewView](BoxKaWuXingMahResultNewView.md) | 结算链：有买马先弹买马页 2.5s，再弹结算页 |

## 11. 交互限制（四类）

### 11.1 前置/守卫

- 操作按钮区仅在收到本座 Power 事件时显示，其余座位权限到达时隐藏亮/取消按钮（onPower）
- 危牌默认不能打：常规出牌走 canPlayMahCheck 门闸校验（initSelfHand）
- 亮倒后不能再吃/碰（杠按服务端权限走：仅扣下的牌或先前碰的牌可杠）（onPower）
- 亮倒出牌阶段仅 _tingPlayables 名单内的牌可出，其余手牌置灰且不可点；【扣】角标在门闸之后再贴，避免看到门闸的灰而非扣牌数据的灰（_onKouConfirm）
- 亮倒后放弃吃/碰（点过）时手牌锁定为"摸啥打啥"，仅刚摸的牌可出（_onGuo）

### 11.2 互斥

- 过按钮二选一：需上报的 KW_BTN_Guo 与本地 KW_BTN_Guo2 按权限位互斥显示，多操作并存时优先显示需上报的那个（onPower guoToServer）
- 亮倒与吃/碰互斥（见 11.1）
- 选漂已提交（done=1）时 PiaoRec 重发不再弹选漂页（_onPiaoRec）
- 本座已请求取消自动摸打后，忽略晚到的 kBotAuto 锁手牌通知（_autoCancelRequested）

### 11.3 超时

- 结算挂起 4 秒兜底：胡牌/番型动效事件丢失时超时后仍弹结算（_settleFallbackTime / _onSettle）
- 买马页停留 2.5 秒后自动弹结算页（_maiMaKeepTime / _startSettleChain）
- 超时托管代打时若尚未真正亮倒（仅 _liangRequested），按取消亮倒处理：解锁手牌、扣牌结果作废（_closeLiangFlowPanels）

### 11.4 失败与恢复

- 重连结束（RelinkEnd）：按缓存的 askid 恢复未提交的选字/选漂页；部分重连包只带 zi_s 不带 zi_rec，用断线前缓存重新拉起界面（_onRelinkEnd）
- 亮倒重连：恢复本回合刚摸的单放牌，避免把亮倒快照最右一张误判为单放且显示正面（_onRelinkEnd）
- 操作按钮 Spine 动画在独立包，包未就绪时清空 url 再写回触发重新加载（_ensureActionSpine）
- 自动胡/托管胡可能没走手动关闭流程，弹结算前再收一次扣牌/听牌辅助页（_closeHuAuxPanels）

## 12. 测试场景

- 本座收到亮倒权限时【亮】【过】出现；点【亮】且无可扣牌时直接进入亮倒出牌态，可出牌亮起、其余置灰不可点
- 扣牌确认未命中合法组合时按"亮倒不扣牌"(flag=1)继续，必定进入出牌选择而非停留在弹窗
- 选漂广播到达且本座 done=1 时选漂页收起；后续 PiaoRec 重发不再弹出
- 断线重连后，未提交的选漂页按缓存 askid 重新拉起；已亮倒时刚摸的单放牌恢复显示
- 胡牌动效播放中收到结算袋：动效结束后才弹买马/结算；动效事件丢失时 4 秒兜底仍弹
