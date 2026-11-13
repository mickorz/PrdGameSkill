# 吃碰禁手

> 阶段 ID：`ST-C10`。来源：模板「行牌 > 吃碰禁手」章节。客户端视角规格，客户端逻辑与 UI 交互以 Code/Fgui 代码证据支撑。

## 0. 阶段

- **阶段 ID**：`ST-C10`
- **阶段**：吃碰禁手
- **来源章节**：行牌 > 吃碰禁手
- **涉及协议消息**：MsgPlayLmts、MsgPlayS、MsgKongS、MsgChowC、MsgNotifyInfo
- **涉及 UI 模块**：BoxHzmjPlayerHandCards、BoxHzmjMainView、BoxHzmjMah2DView、BoxHzmjTipAniView
- **阶段概述**：吃或碰成立后按吃进牌型生成禁打牌集合：客户端把禁张手牌压暗并拦截出牌，合法出牌后由服务端清空，同回合再杠不清空。

## 术语与单位（有则填）

| 术语 | 定义 | 单位/量纲 | 作用域 | 来源 |
| --- | --- | --- | --- | --- |
| 财神 | 白板固定为财神，只在胡牌判定时代替顺子、刻子或对子所缺的牌；吃、碰、杠必须用真实的非财神牌。 | 牌型标记（无量纲） | 全局规则（胡牌判定与吃碰杠合法性） | 模板 名词章节（第12行） |
| 上家 | 本家逆时针方向的上一家，吃牌只用上家刚打出的牌。 | 座位关系（无量纲） | 吃牌操作 | 模板 第7行（开局/轮庄说明） |
| 禁打手牌 hands | MsgPlayLmts.hands 下发的禁打手牌牌值列表，客户端按牌值灰化所有同牌面的手牌位。 | 牌值列表（数组） | 本家手牌位 | source-code/client/Code/data/GameData.ts:1603 |
| 禁打单放 dang_fang | MsgPlayLmts.dang_fang 下发的禁打单放牌值，0 表示单放不受限。 | 牌值（0 为不受限标记） | 本家单放位 | source-code/client/Code/data/GameData.ts:1605 |
| 单放 | 摸牌位（moCard）上单独拉开的那一张牌，dang_fang 只对该位置生效，hands 不管单放。 | 手牌位置标记（无量纲） | 本家摸牌位 | source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:77 |

## 跨切面行为（无原子也列）

- **PlayLmts 先于 Power 到达**：MsgPlayLmts(795) 先于 Power 到达，GamePlayLmtsCmd 只缓存数据，实际灰化统一在 GamePowerCmd 判定获得出牌权时通过 onPlayLmtsUpdate 触发（时序依赖）—— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:99）
- **禁手灰态非持久**：resetCards、财神刷新、点过、出牌等场景都会重刷或清灰，依赖 onPlayLmtsUpdate 反复重建 —— 跨切面（source-code/client/Code/layer/BoxHzmjMainView.ts:364、1264、1478）
- **断线重连/复盘回填**：断线重连/复盘时 SceneActionCmd 以 justUpdateData 方式回填 play_lmts，不触发界面，待 Power 到达后才置灰 —— 跨切面（source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:46）
- **禁张计算全在服务端**：客户端不计算禁张、也不过滤吃组合，禁手计算与授权拦截全部在服务端，客户端只消费 hands/dang_fang —— 跨切面（source-code/client/Code/data/GameData.ts:1603）
- **提示统一走 KW_Text_Tips**：提示类文本统一走 KW_Text_Tips（BoxHzmjTipAniView），简洁模式 GameData.simpleMode 与复盘模式下所有 toast 被抑制 —— 跨切面（source-code/client/Code/layer/BoxHzmjTipAniView.ts:852）
- **出牌限制两处校验**：出牌限制判定同时作用于出牌前检查 canPlayMahCheck 与落牌回调 onPlayMah 两处，两处均会拦截 —— 跨切面（source-code/client/Code/layer/BoxHzmjMainView.ts:1432、1472）

## `FP-ST-C10-001` 禁张生效与解除时机

- **主描述**：吃或碰成立后对同牌面手牌施加禁打，限制持续到本次解除；合法出牌后由服务端清空，同回合再杠不清空，补进牌仍在禁张内同样不能打。
- **范围与边界**：包含禁张的生效对象、存续期、清空与杠/补牌场景；不包含具体禁张牌值计算（见 FP-ST-C10-002/003）。
- **总体协作**：服务端生成并下发 MsgPlayLmts.hands/dang_fang，客户端缓存后在手牌显示层压暗并在出牌回调拦截；清空由服务端空包驱动。

### 原子项

#### `AT-ST-C10-001` 吃碰成立后同牌面手牌全部禁打

- **规则说明**：吃或碰成立后，与吃进/被碰牌同牌面的手牌全部禁打。
- **触发条件**：吃或碰成立后，服务端下发 MsgPlayLmts.hands，本家获得出牌权时灰化生效。
- **配置影响**：本原子项无独立配置
- **客户端交互**：被禁牌以灰色显示并置为不可点击。
- **限制与禁止**：禁止打出命中 hands 牌值的任何一张手牌。
- **异常与边界**：hands 只作用于手牌位，新摸入的单放牌需 dang_fang 命中才禁打；客户端不判断吃/碰来源，禁打集合完全来自服务端。
- **验收**：吃/碰成立后，本家手牌区中与禁张牌值相同的所有手牌位全部置灰且不可点击，非禁张牌保持原色。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:105；source-code/client/Code/data/GameData.ts:1603
- **服务端职责**：下发 MsgPlayLmts（携带禁打手牌牌值列表 hands，不含单放）。
- **客户端职责**：GamePlayLmtsCmd 缓存 MsgPlayLmts.hands，BoxHzmjPlayerHandCards.applyPlayLmtsGray 遍历全部手牌位，按牌值 indexOf 命中即禁打，因此同牌值的多张手牌会一起被禁。
- **协作边界**：客户端消费 MsgPlayLmts.hands 缓存并按牌值灰化手牌位；禁张牌值计算与吃/碰来源判断全在服务端，客户端不做本地推导。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:105
- **原文摘录**：`forbid = handForbid.indexOf(item.mahValue) !== -1;`

#### `AT-ST-C10-002` 禁打持续到本次限制解除

- **规则说明**：禁打状态持续到本次限制解除为止，期间跨本家多个出牌回合持续生效。
- **触发条件**：禁打生效后每次本家获得出牌权（POWER_ID_PLAY）时重刷；服务端下发空 MsgPlayLmts 时解除。
- **配置影响**：本原子项无独立配置
- **客户端交互**：每次进入本家出牌阶段都会重新把禁张牌压暗。
- **限制与禁止**：限制解除前，禁张牌持续禁打，不因回合推进自动失效。
- **异常与边界**：客户端本身不判断回合边界，以服务端空包作为解除信号。
- **验收**：吃/碰成立后的连续多个本家出牌回合内禁张保持置灰；收到空 MsgPlayLmts 后灰态消失且可正常出牌。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:37；source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:99
- **服务端职责**：下发 MsgPlayLmts（限制存续期间持续维护；空包即解除信号）。
- **客户端职责**：GameData 长期缓存 _playLimitMahs/_playLimitDanFang；GamePowerCmd 每次本家获得出牌权（POWER_ID_PLAY）时重新下发 onPlayLmtsUpdate 重刷灰态，直到收到空包才 clearPlayLimitMahs。
- **协作边界**：客户端消费 MsgPlayLmts 与出牌权（Power）消息，出牌权到达时重刷灰态；回合边界与解除时机判断在服务端。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:37
- **原文摘录**：`if (handForbid.length === 0 && danFangForbid === 0) { GameData.clearPlayLimitMahs();`

#### `AT-ST-C10-003` 合法出牌后服务端清空禁张

- **规则说明**：本家打出一张合法牌后，禁张由服务端清空。
- **触发条件**：本家出牌成功（出牌消息被服务端接受）后，服务端下发空 MsgPlayLmts。
- **配置影响**：本原子项无独立配置
- **客户端交互**：本家出牌后手牌灰态立即恢复常色。
- **限制与禁止**：无
- **异常与边界**：客户端出牌后先清视觉灰、数据等空包，若服务端未下发空包会出现数据仍在但界面不灰的短暂不一致；过张可能跨回合，客户端出牌处理时不清本地禁张数据。
- **验收**：本家合法出牌后画面侧灰态立即清除；随后收到空 MsgPlayLmts 后本地禁张数据清空。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GamePlayCmd.ts:72；source-code/client/Code/controller/cmd/gameCmd/GamePlayCmd.ts:122
- **服务端职责**：下发 MsgPlayS（出牌广播）；出牌后下发空 MsgPlayLmts 清空禁张。
- **客户端职责**：GamePlayCmd 出牌处理后不清本地禁张数据（注释明确由服务端空包/新包维护），只在画面侧派发 onClearGray；数据清空仍走 GamePlayLmtsCmd 的空包分支。
- **协作边界**：客户端消费 MsgPlayS 与 MsgPlayLmts；本地只清视觉灰，禁张数据的清空完全依赖服务端空包。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GamePlayCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GamePlayCmd.ts:72
- **原文摘录**：`// PlayLmts 禁打列表由服务端空包/新包维护，出牌不清（过张可能跨回合）`

#### `AT-ST-C10-004` 同一回合再杠不清空禁张

- **规则说明**：同一回合内禁张生效期间再杠成立，禁张不清空、继续保留。
- **触发条件**：禁张生效期间，同一回合内本家杠成立（收到杠成立消息）。
- **配置影响**：本原子项无独立配置
- **客户端交互**：杠成立时无禁张相关交互变化，禁张灰态保持原样。
- **限制与禁止**：同一回合内杠成立不触发禁张清空。
- **异常与边界**：证据为负向：杠处理器内不存在清空 playLimit 的调用，属间接证明。
- **验收**：禁张生效期间本家杠成立后，禁张牌仍保持灰态且不可打。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:33
- **服务端职责**：下发 MsgKongS（杠成立广播）；杠成立后不下发禁张清空包（依模板语义，禁张由后续 MsgPlayLmts 通道另行维护）。
- **客户端职责**：GameKongCmd 处理杠成立时只切牌桌状态、更新副露与播动画，全流程无任何出牌限制清理或灰态重置代码，禁张因此被保留。
- **协作边界**：客户端消费 MsgKongS 只处理杠表现，不触碰禁张数据；是否清空由服务端经 MsgPlayLmts 通道决定。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:33
- **原文摘录**：`GameData.setTableState(MahGameState.MAH_STATE_KONG);
GameData.clearFuPanPower();`

#### `AT-ST-C10-005` 补进牌仍在禁张内不能打

- **规则说明**：禁张生效期间补进（摸入）的牌若牌值仍在禁张里，同样不能打。
- **触发条件**：禁张生效期间本家补进一张牌，且其牌值落在禁张范围内。
- **配置影响**：本原子项无独立配置
- **客户端交互**：补进的牌只有在 dang_fang 命中时才被压暗并不可点击。
- **限制与禁止**：补进牌牌值在禁张内时禁止打出；hands 不作用于单放位，单放位仅由 dang_fang 管控。
- **异常与边界**：若服务端只把该牌值写入 hands 而未写 dang_fang，客户端会放行补进牌，与模板「仍在禁张里也不能打」存在差异；需服务端保证补牌值落到 dang_fang。
- **验收**：禁张生效期间补进禁张牌值的牌后，该单放牌置灰且不可打出（前提服务端将该牌值写入 dang_fang）。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:100；source-code/client/Code/data/GameData.ts:1794
- **服务端职责**：下发 MsgPlayLmts（补牌场景下需将补进禁张牌值写入 dang_fang 才能拦住单放位）。
- **客户端职责**：applyPlayLmtsGray 把摸牌位（moCard 位置）视为单放，只用 dang_fang 判定禁打，其余手牌位才用 hands 判定；GameData.canPlayCard 同样按 isDanFang 分流校验。
- **协作边界**：客户端消费 MsgPlayLmts 的 hands/dang_fang 两个字段并按位置分流校验；补进牌是否禁打的判定值完全由服务端下发。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:100
- **原文摘录**：`const isMo = hasDanFang && i === len - 1;
... forbid = danFangForbid !== 0 && item.mahValue === danFangForbid;`

## `FP-ST-C10-002` 吃牌禁张计算

- **主描述**：按吃进方式（坎张吃中间、相邻两张吃一端）确定禁张范围，按 1~9 边界收敛，只按最终选定的吃组合写禁张。
- **范围与边界**：包含吃成立后的禁张牌值推导与吃法选择；不包含碰禁张与出牌拦截表现。
- **总体协作**：客户端只负责提交选中的一组吃组合（MsgChowC），禁张牌值由服务端计算后经 MsgPlayLmts.hands 下发。

### 原子项

#### `AT-ST-C10-006` 坎张吃中间只禁被吃的那张

- **规则说明**：用间隔一张的两张吃中间张时，只禁被吃的那一张；例如用 1、3 吃 2，禁打 2。
- **触发条件**：坎张吃（手两张间隔一张、吃进中间张）成立后。
- **配置影响**：本原子项无独立配置
- **客户端交互**：客户端代码未找到对应实现（待确认）
- **限制与禁止**：坎张吃时只禁被吃进的那一张牌值。
- **异常与边界**：无
- **验收**：坎张吃成立后，本家仅与被吃进那张牌值相同的手牌被置灰（客户端按下发 hands 灰化）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：客户端无任何坎张吃禁张计算代码，禁张集合完全由服务端计算后下发 hands，客户端仅按 hands 灰化展示。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C10-007` 相邻两张吃一端禁两端可接顺的牌

- **规则说明**：用相邻两张吃一端时，禁打这两张在 1 至 9 内两端能接成顺子的牌。
- **触发条件**：相邻两张吃一端的吃法成立后。
- **配置影响**：本原子项无独立配置
- **客户端交互**：客户端代码未找到对应实现（待确认）
- **限制与禁止**：禁止打出相邻吃法下两端能接成顺子的延伸牌。
- **异常与边界**：无
- **验收**：相邻两张吃一端成立后，两端可接顺的延伸牌值手牌被置灰（以下发 hands 为准）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：客户端不做顺子延伸推演，禁张范围由服务端计算，客户端仅按下发 hands 灰化。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C10-008` 2、3 吃 1 或吃 4 都禁 1 和 4

- **规则说明**：手牌持 2、3 时，无论吃进 1 还是吃进 4，都禁打 1 和 4。
- **触发条件**：手牌持 2、3 并成立吃 1 或吃 4 的吃法后。
- **配置影响**：本原子项无独立配置
- **客户端交互**：客户端代码未找到对应实现（待确认）
- **限制与禁止**：该吃法下 1 与 4 均列入禁打。
- **异常与边界**：无
- **验收**：2、3 吃 1 或吃 4 成立后，牌值 1 与 4 的手牌均被置灰（以下发 hands 为准）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：示例规则属服务端禁张算法，客户端仅按下发的 hands 值灰化，无对应判定。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C10-009` 1、2 吃 3 只禁 3

- **规则说明**：用 1、2 吃 3 时，只禁打 3。
- **触发条件**：手牌持 1、2 并吃进 3 的吃法成立后。
- **配置影响**：本原子项无独立配置
- **客户端交互**：客户端代码未找到对应实现（待确认）
- **限制与禁止**：该吃法下只禁吃进的那一张（3），不外延。
- **异常与边界**：1 侧无外侧延伸牌，禁张收敛到单张。
- **验收**：1、2 吃 3 成立后，仅牌值 3 的手牌被置灰（以下发 hands 为准）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：1/9 外侧边界收敛在服务端完成，客户端无对应判定，仅消费 hands。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C10-010` 相差 1 时禁吃进张与另一侧延伸张

- **规则说明**：手上两张相差 1 时，禁吃进的那张和另一侧延伸的那张。
- **触发条件**：吃牌所用手两张相差 1 且吃法成立后。
- **配置影响**：本原子项无独立配置
- **客户端交互**：客户端代码未找到对应实现（待确认）
- **限制与禁止**：该场景下吃进张与另一侧延伸张均列入禁打。
- **异常与边界**：无
- **验收**：相差 1 的两张吃牌成立后，吃进张与另一侧延伸张对应手牌被置灰（以下发 hands 为准）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：客户端无对应计算，仅展示服务端下发的禁张。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C10-011` 1、9 外侧不是牌只禁一张

- **规则说明**：1、9 的外侧不是牌，吃到边界时实际只禁吃进的一张。
- **触发条件**：吃进张落在 1 或 9 边界、另一侧延伸超出牌值范围时。
- **配置影响**：本原子项无独立配置
- **客户端交互**：客户端代码未找到对应实现（待确认）
- **限制与禁止**：边界外侧不产生禁张，禁张收敛到吃进的那一张。
- **异常与边界**：1、9 外侧无牌值可延伸，为边界收敛场景。
- **验收**：边界吃法成立后仅吃进张被置灰（以下发 hands 为准）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：边界判断在服务端，客户端无牌山边界推演代码。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C10-012` 相差不为 1 只禁吃进张

- **规则说明**：手上两张相差不是 1 时，只禁吃进的那张。
- **触发条件**：吃牌所用手两张相差不为 1（即坎张间隔两张以上）且吃法成立后。
- **配置影响**：本原子项无独立配置
- **客户端交互**：客户端代码未找到对应实现（待确认）
- **限制与禁止**：该场景下只禁吃进张，不做其他延伸。
- **异常与边界**：无
- **验收**：相差不为 1 的吃法成立后仅吃进张被置灰（以下发 hands 为准）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：客户端无对应计算，仅消费 hands 列表。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

#### `AT-ST-C10-013` 只按最终选定的一组写禁张

- **规则说明**：存在多组可选吃法时，只按最终选定并提交的那一组计算禁张。
- **触发条件**：存在多组吃法、本家在组合选择池中点击选定一组并提交后。
- **配置影响**：本原子项无独立配置
- **客户端交互**：存在多组吃法时显示 ChooseGang 组合选择池，点击某一组才提交。
- **限制与禁止**：只提交最终选定的一组吃组合，不提交其他候选组。
- **异常与边界**：客户端只保证提交单组吃组合；禁张按该组计算仍在服务端，客户端无回写逻辑。
- **验收**：多吃场景下仅最终点击选定的那组被提交（提交消息只含该组），其余组合不提交。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1098；source-code/client/Code/controller/gameController.ts:491
- **服务端职责**：接收 MsgChowC（客户端提交的选定吃组合），按该组计算禁张后经 MsgPlayLmts 下发。
- **客户端职责**：多吃时客户端弹组合选择池，_chooseChi 记录最终选中的一组，onBtnChooseChi 只取该组 GameData.getChowCombInfo(this._chooseChi) 并通过 sendChow 提交 MsgChowC，不提交其他候选组。
- **协作边界**：客户端本地记录并提交单组吃组合（MsgChowC）；禁张按该组的计算在服务端，客户端无回写。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1098
- **原文摘录**：`const comb = GameData.getChowCombInfo(this._chooseChi);
... GameController.instance.sendChow(comb);`

## `FP-ST-C10-003` 碰牌禁张计算

- **主描述**：碰成立后禁打与被碰牌相同牌面的牌。
- **范围与边界**：仅碰成立后的禁张来源；不包含碰权限判权与摊记账。
- **总体协作**：服务端在碰成立时写禁张并下发 MsgPlayLmts，客户端按 hands 值灰化。

### 原子项

#### `AT-ST-C10-014` 碰后禁打与被碰牌相同的牌

- **规则说明**：碰成立后，禁打与被碰牌相同牌面的牌。
- **触发条件**：碰成立后，服务端写入禁张并下发。
- **配置影响**：本原子项无独立配置
- **客户端交互**：客户端代码未找到对应实现（待确认）
- **限制与禁止**：碰成立后与被碰牌同牌面的手牌禁打。
- **异常与边界**：无
- **验收**：碰成立后，与被碰牌牌值相同的手牌被置灰不可打（以下发 hands 为准）。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：GamePungCmd 只处理副露落账与动画，无任何禁张计算；碰禁张由服务端写入出牌黑名单后经 MsgPlayLmts 下发，客户端仅按 hands 灰化消费。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

## `FP-ST-C10-004` 吃牌可用性约束与财神例外

- **主描述**：吃完后剩余手牌全部落在禁张内的吃法不可吃，被拦截时本家提示「吃禁手规则生效中」；禁张不含财神，吃完仍可打财神。
- **范围与边界**：包含吃法的可用性过滤结果与提示、财神不入禁张；不包含吃禁张牌值推导本身。
- **总体协作**：服务端过滤吃组合并在拦截时推 MsgNotifyInfo(813)，客户端按 flag 弹 toast；财神排除由服务端保证。

### 原子项

#### `AT-ST-C10-015` 全部落禁张的吃法不能吃

- **规则说明**：吃完后剩余手牌全部落在禁张里的吃法不能吃。
- **触发条件**：某吃法吃完后剩余手牌全部落在禁张内，服务端过滤该吃法（不授予该吃组合）。
- **配置影响**：本原子项无独立配置
- **客户端交互**：吃法被拦截时【吃】按钮与组合池不出现。
- **限制与禁止**：全部落禁张的吃法不得进入本家可选吃组合。
- **异常与边界**：客户端无过滤实现，属服务端授权结果驱动的间接证据。
- **验收**：全部落禁张的吃法不出现在本家可选吃组合中（吃按钮与组合池不显示）。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:626
- **服务端职责**：下发 MsgNotifyInfo（吃被拦截时推送提示）；吃组合经出牌权组合下发，被禁手拦截的吃法不在其中。
- **客户端职责**：客户端不做吃法过滤，吃按钮与吃组合数量全部统计服务端下发的 power.combs 中 CMF_CHOW 项（_updateChiPower），服务端不给该吃法时客户端不会出现对应入口。
- **协作边界**：客户端只统计与展示服务端下发的吃组合（power.combs），过滤判定与拦截提示（MsgNotifyInfo）均在服务端。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:626
- **原文摘录**：`// 统计吃组合数量
for (const comb of this._playCombs) {
 if (comb.flag === BoxMahDefine.CombType.CMF_CHOW) { chiCount++; }`

#### `AT-ST-C10-016` 本家提示吃禁手规则生效中

- **规则说明**：该吃法被拦截时，本家提示「吃禁手规则生效中」。
- **触发条件**：本家本可吃但剩余手牌全被禁手禁打、吃权限被拦截，服务端推送 MsgNotifyInfo（flag=NIF_EX_CHOW_FORBID_NO_PLAY(9)）且座位为本家时。
- **配置影响**：简洁模式（GameData.simpleMode）与复盘模式（BoxRoomData.isFupanMode）下提示被抑制，不显示。
- **客户端交互**：本家界面弹出「吃禁手规则生效中」提示文本，界面中部显示 1.3 秒后自动收起；简洁模式与复盘模式下不显示。
- **限制与禁止**：提示只对本家（localSeat === SELF_LOCAL_SEAT）生效，他家不显示。
- **异常与边界**：文本复用通用 toast 组件（KW_Text_Tips），简洁模式与复盘模式下所有 toast 被抑制。
- **验收**：触发条件满足时本家界面显示「吃禁手规则生效中」1.3 秒后自动收起；简洁模式/复盘模式下不显示；他家不显示。
- **职责域**：client
- **职责依据**：source-code/client/Code/controller/cmd/gameCmd/GameNotifyInfoCmd.ts:58；source-code/client/Code/config/GameDefine.ts:469；source-code/client/Code/layer/BoxHzmjTipAniView.ts:852
- **服务端职责**：下发 MsgNotifyInfo（flag=NIF_EX_CHOW_FORBID_NO_PLAY，吃禁手拦截提示）。
- **客户端职责**：GameNotifyInfoCmd 收到 NIF_EX_CHOW_FORBID_NO_PLAY(9) 且座位为本家时，派发 onShowTextTimeTips 显示固定文案，时长 1.3 秒。
- **协作边界**：客户端消费 MsgNotifyInfo 的 flag 与座位，按本家过滤后弹固定文案 toast；是否拦截由服务端判定。
- **来源文件**：`source-code/client/Code/controller/cmd/gameCmd/GameNotifyInfoCmd.ts`
- **来源定位**：source-code/client/Code/controller/cmd/gameCmd/GameNotifyInfoCmd.ts:58
- **原文摘录**：`case NotifyInfoFlag.NIF_EX_CHOW_FORBID_NO_PLAY:
 this.dispatch(GameEventBoxHzmj.onShowTextTimeTips, "吃禁手规则生效中", 1.3);`

#### `AT-ST-C10-017` 禁张不含财神仍可打财神

- **规则说明**：禁张不含财神，吃完仍可打财神。
- **触发条件**：禁张生效期间本家持有财神。
- **配置影响**：本原子项无独立配置
- **客户端交互**：客户端代码未找到对应实现（待确认）
- **限制与禁止**：禁张集合不得包含财神牌值，财神保持可打。
- **异常与边界**：客户端 applyPlayLmtsGray 无财神排除分支，会按牌值灰化任意牌（含财神），实际依赖服务端不下发财神值；财神颜色由 setJokerColorValues 单独维护，若被禁则会被 gray 覆盖。
- **验收**：待确认（客户端无实现）；需服务端保证禁张不含财神值，财神保持原色可打。
- **职责域**：client
- **职责依据**：无（客户端代码未找到）
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：待确认
- **协作边界**：财神排除由服务端保证（禁张值不含财神）；客户端按牌值灰化不做财神排除，消费下发的 hands/dang_fang 原值。
- **来源文件**：无
- **来源定位**：无
- **原文摘录**：无

## `FP-ST-C10-005` 禁打牌界面表现与出牌拦截

- **主描述**：禁打牌压暗但仍可辨认、仅本家可见，允许提起与横滑出虚影，但单击/双击/松手出牌会被拦截并提示「该牌被禁打」，牌不落牌河。
- **范围与边界**：包含禁张的显示样式、可见范围、手势表现与出牌拦截反馈；不包含禁张来源计算。
- **总体协作**：客户端在牌面渲染层压暗，在出牌回调处二次校验 canPlayCard 并提示，拦截后回滚手牌布局。

### 原子项

#### `AT-ST-C10-018` 禁打牌压暗牌面仍可辨认

- **规则说明**：禁打牌压暗（置灰）显示，牌面内容仍可辨认。
- **触发条件**：手牌牌值命中 MsgPlayLmts.hands（手牌位）或 dang_fang（单放位）时。
- **配置影响**：本原子项无独立配置
- **客户端交互**：禁打牌以压暗（置灰）样式显示，禁张手牌整体呈灰色，图案与数字仍可见。
- **限制与禁止**：压暗不得遮挡牌面，禁止使用覆盖式遮罩导致牌面不可辨认。
- **异常与边界**：压暗为直接改牌面色，不使用额外遮罩，因此牌面保持可辨认；灰态非持久，重刷场景见跨切面行为。
- **验收**：被禁手牌呈灰色且牌面图案与数字可辨认；限制解除或未命中后恢复原色。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:109；source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:77
- **服务端职责**：下发 MsgPlayLmts（hands 灰手牌、dang_fang 灰单放，同牌值互不影响）。
- **客户端职责**：BoxHzmjPlayerHandCards.applyPlayLmtsGray 对命中禁张的手牌调用 Mah2DBase.setMahColor(item, MahColor.gray) 改色，未遮挡牌面；未命中的牌恢复 _resolveMahColor 原色。
- **协作边界**：客户端消费 MsgPlayLmts 的 hands/dang_fang 并在本地改牌面色；灰化值域完全由服务端下发。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:109
- **原文摘录**：`if (forbid) {
 Mah2DBase.setMahColor(item, MahColor.gray);`

#### `AT-ST-C10-019` 禁打压暗只在本家界面显示

- **规则说明**：禁打压暗只在本家界面显示，其他家只看到牌背。
- **触发条件**：MsgPlayLmts 到达且座位为本家、本家获得出牌权时灰化生效；出牌权落在他人座位时清灰。
- **配置影响**：本原子项无独立配置
- **客户端交互**：禁张灰态仅在本家手牌区显示，他家手牌保持牌背显示，无灰化差异。
- **限制与禁止**：禁张灰态不得呈现给非本家座位。
- **异常与边界**：服务端也只按重连座位自身视角下发 play_lmts，客户端再叠加座位过滤，双重保证只本家可见；断线重连/复盘时 justUpdateData 只回填数据不触发界面，待 Power 到达后才置灰。
- **验收**：禁张生效期间仅本家手牌区出现灰化表现，他家手牌无灰化差异；他人获得出牌权时本家灰态清除。
- **职责域**：client
- **职责依据**：source-code/client/Code/data/GameData.ts:1779；source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:101；source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:46
- **服务端职责**：下发 MsgPlayLmts（仅按重连座位自身视角下发 play_lmts）。
- **客户端职责**：GameData.hasPlayLimit 要求 _playLimitSeat === SELF_LOCAL_SEAT 才成立；GamePlayLmtsCmd 也只在 localSeat 为本家时派发 onPlayLmtsUpdate；GamePowerCmd 对他人座位直接派发 onClearGray，不做限制灰化。
- **协作边界**：客户端消费 MsgPlayLmts 与 Power 消息并本地叠加本家座位过滤；服务端按座位视角下发，双重保证只本家可见。
- **来源文件**：`source-code/client/Code/data/GameData.ts`
- **来源定位**：source-code/client/Code/data/GameData.ts:1779
- **原文摘录**：`hasPlayLimit(): boolean { return this._playLimitSeat === SELF_LOCAL_SEAT && (this._playLimitMahs.length > 0 ||`

#### `AT-ST-C10-020` 禁打牌仍可提起与横滑出虚影

- **规则说明**：禁打牌仍能提起，也能横滑出虚影。
- **触发条件**：禁张生效期间本家对禁打牌执行提起或横向拖拽操作。
- **配置影响**：本原子项无独立配置
- **客户端交互**：模板要求禁打牌允许提牌与横向滑动拖出虚影；当前实现禁打牌无触摸响应，无法提起，也无法横滑出虚影（与模板不一致，待产品确认）。
- **限制与禁止**：模板语义下禁打牌仅禁止出牌落地，不禁止提起与横滑虚影手势。
- **异常与边界**：与模板不一致：现存实现把禁打牌置为不可触摸（注释亦写「禁打不可点由 PlayLmts 维护」），因此无法提起/横滑，需要产品确认是否改回可提起仅是禁止出牌。
- **验收**：以产品确认为准：按模板要求，禁打牌可提起且可横滑出虚影，但松手不能出牌；当前实现为不可触摸，需确认后整改。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:137；source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:108
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：手牌控件构造时传入 KW_Ghost_Hand 作为拖拽虚影节点，具备横滑虚影能力；但 applyPlayLmtsGray 对禁打牌直接设置 item.touchable = false，触摸被整体禁用。
- **协作边界**：本原子项为纯客户端手势表现，无服务端消息依赖；手势是否可用由客户端本地 touchable 开关决定。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMah2DView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMah2DView.ts:137
- **原文摘录**：`this.selfHand = new BoxHzmjPlayerHandCards(
 view.KW_HandMah_0,
 view.KW_Ghost_Hand as any,`

#### `AT-ST-C10-021` 出牌禁打牌弹出该牌被禁打

- **规则说明**：单击、双击或松手打出禁打牌时，弹出「该牌被禁打」提示。
- **触发条件**：本家通过单击、双击或拖拽松手三种路径之一尝试打出禁打牌时。
- **配置影响**：提示走通用 toast（KW_Text_Tips），简洁模式与复盘模式下会被抑制。
- **客户端交互**：本家尝试打出禁打牌时弹出「该牌被禁打」提示，界面显示 1.3 秒。
- **限制与禁止**：禁打牌的出牌请求在本地即被拦下，不进入出牌流程。
- **异常与边界**：因禁打牌 touchable=false，实际操作中单击/双击路径可能到不了校验，提示主要出现在拖拽松手路径。
- **验收**：三条出牌路径尝试打出禁打牌时均触发「该牌被禁打」1.3 秒提示且不出牌（以手势可用性确认结果为准）。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1430；source-code/client/Code/layer/BoxHzmjMainView.ts:1432；source-code/client/Code/layer/BoxHzmjMainView.ts:1472
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：canPlayMahCheck 在 playCard 前调用 GameData.canPlayCard 校验并提示；onPlayMah 在落牌回调中再校验一次并提示，覆盖单击、双击与松手三种触发出牌路径。
- **协作边界**：出牌限制校验完全在客户端本地（canPlayCard，数据源为服务端下发的 hands/dang_fang）；提示文案与时长为客户端固定配置。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1430
- **原文摘录**：`// 禁打/出牌限制：必须在 playCard 藏牌之前拦截（区分手牌 / 单放）`

#### `AT-ST-C10-022` 禁打牌不进入牌河

- **规则说明**：被禁打的牌打出时牌不进牌河。
- **触发条件**：出牌校验（onPlayMah）判定该牌禁打失败后。
- **配置影响**：本原子项无独立配置
- **客户端交互**：禁打牌被打出时牌不落入牌河；手牌回弹复位，牌河与出牌放大区均无该牌。
- **限制与禁止**：拦截后不得派发牌河落牌、不得向服务端发送出牌消息。
- **异常与边界**：拦截发生在本地，未发送 MsgPlayC，因此服务端也不会落牌；不依赖服务端拒绝；拦下后 resetCards 把手牌拉回原位并重刷禁张灰态。
- **验收**：尝试打出禁打牌后手牌回弹复位，牌河与出牌放大区不出现该牌，且未向服务端发送出牌消息。
- **职责域**：client
- **职责依据**：source-code/client/Code/layer/BoxHzmjMainView.ts:1474；source-code/client/Code/layer/BoxHzmjMainView.ts:1481
- **服务端职责**：本次仅依据客户端代码，服务端行为未还原
- **客户端职责**：onPlayMah 校验失败后立即 return，不派发 addPlayMah、不调用 GameController.sendPlay，并 resetCards 将手牌拉回原位、恢复 canPutCard 并重刷禁张灰态。
- **协作边界**：出牌拦截与手牌回滚完全在客户端本地完成，不依赖服务端拒绝；禁打判定数据源为服务端下发的 hands/dang_fang。
- **来源文件**：`source-code/client/Code/layer/BoxHzmjMainView.ts`
- **来源定位**：source-code/client/Code/layer/BoxHzmjMainView.ts:1474
- **原文摘录**：`// playCard 可能已藏牌，拦下后把手牌拉回
const handCards = GameData.getPlayerCardsData(SELF_LOCAL_SEAT)?.getHandCards() ?? [];
this._selfHand.resetCards(handCards);`
