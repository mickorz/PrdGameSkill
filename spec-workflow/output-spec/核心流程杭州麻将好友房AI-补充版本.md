# 杭州麻将核心需求

四人好友房。固定 8 局、底分 1、白板财神、笃三老庄、庄闲放铳、三摊承包、吃碰禁手、无封顶。碰算摊关闭。无托管：倒计时结束后仍等待手动出牌或响应，不自动出牌、不自动过。

坐满 4 人且全部准备后，房主开始首局。之后每小局四人均准备则自动开始。流局计 1 局。每小局小结算；未满 8 局继续，满 8 局结束本场。

每小局一名庄家，庄家先出牌，其余为闲家。上家为本家逆时针方向的上一家，吃牌只用上家刚打出的牌。

## 名词

- **面子**：一组顺子、刻子或杠。杠含 4 张，仍计 1 组面子。对子不是面子。已完成的吃、碰、明杠、暗杠都计入面子。
- **财神**：白板固定为财神。只在胡牌判定时代替顺子、刻子或对子所缺的牌。吃、碰、杠必须用真实的非财神牌，不能用财神牌，也不能用财神去代替所缺的牌。
- **牢庄**：本期固定笃三老庄，每小局庄家都按三牢、8 倍计算。
- **摊**：A 吃进 B 打出的牌，A 对 B 记 1 摊。两个方向分开计。碰、直杠、加杠、暗杠不计摊。每小局重新累计。
- **承包**：庄家与闲家之间，某一方向的有效摊达到成立条件后，承包方在自摸结算时代赔。反承包是同一关系下，原被承包方自摸时，原承包方按加倍规则赔付。
- **爆头**：摸牌前为 4 组面子加 1 张财神。下一张摸到任意牌，都与这张财神组成对子后自摸。只能自摸。
- **七客**：七对爆头。摸牌前没有吃、碰、杠，手牌为 6 组对子加 1 张财神。结算不单列这一项，按七对和爆头两组连乘。
- **飘**：自己出牌阶段打出一张财神，即飘财 1 次。连续打出财神则累加，打出普通牌清零。每小局从 0 次起算。
- **放铳**：打出的牌被他人合法胡走。胡牌者称为点炮胡。白板财神弃牌不能点炮胡。
- **流局**：牌墙剩 21 张时，当前玩家再摸 1 张，剩 20 张。先完成本次摸打和弃牌响应；无人胡牌时，在下一次应摸牌前判黄庄。不是剩 20 张立刻结束。

## 开局

### 定庄与轮庄

- 首局四名玩家中随机坐庄。掷骰、发牌前已经确定庄家。
  - 客户端实现：客户端不做随机定庄，GameJuDataCmd 将 MsgJuData.zhuang 转本地座位写入 GameData.setZhuangSeat/setZhuangSever，作为本局庄家唯一来源（source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts:31, source-code/client/Code/lib/proto_game_hzmj.d.ts:3693）；协议状态枚举把“定庄”(GAME_STATE_BANKER) 排在“骰子”(GAME_STATE_CHIP) 与“发牌”(GAME_STATE_TAKE_FIRST) 之前，庄家在 MsgJuData 阶段即写入数据层，骰子由后续独立命令 CMD_THROW_CHIP 处理（source-code/client/Code/protocol/GameGlcProtocol.ts:16, source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts:51, source-code/client/Code/controller/gameController.ts:65）。
  - UI 交互：局数据到达后立即派发 onShowZhuang，玩家头像庄标志按等级点亮（杭州麻将走 C_Bank 的 zhuang1~3 页）；骰子动画随后在牌桌上播放（BoxHzmjMah2DView.showDice），两者无数据依赖。
- 有人胡牌时，下一小局由胡牌者坐庄。庄家自己胡牌为连庄。
  - 客户端实现：GameResultHuCmd 解析 hu_items.hu_seat 得到胡牌座位用于本局结算表现，下局庄家不在客户端推导，直接采用下一条 MsgJuData.zhuang 覆盖 GameData 的庄家座位（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:158, source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts:31）；连庄次数由服务端下发，GameJuDataCmd 用 MsgJuData.banker_level 写入 setLianZhuangCount（source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts:34），升庄广播 MsgBankerLevelUp 亦更新该值与 bankerLevel（source-code/client/Code/data/GameData.ts:1451），客户端无“庄家胡牌即连庄”的本地判定。
  - UI 交互：本局结算行按 data.banker 标记庄家并显示庄标志；下局开局由 onShowZhuang 重新点亮新庄家头像、清除上一家庄标志；结算行按 lianZhuang 选择 C_IsBank 的 1/2/3 档庄标志；结算流水含“连庄”独立流水项，由服务端 win_losts/flow 下发。
- 流局时原庄连庄。
  - 客户端实现：协议层定义 GP_DRAWN→MsgDrawn 并映射到 CmdNames.CMD_DRAWN，但未找到对应命令实现类；流局结算实际由 GameResultHuCmd（CMD_RESULT_HU）承载，按 end_type=ET_DRAWN 出结算表现，客户端无“流局→原庄连庄”的本地判定（source-code/client/Code/protocol/GameGlcProtocol.ts:114, source-code/client/Code/controller/gameController.ts:74, source-code/client/Code/config/GameDefine.ts:441）。
  - UI 交互：结算界面按 end_type===ET_DRAWN 切换 C_Line/C_WinLost 的输/平样式；下局原庄家标志由 onShowZhuang 按服务端下发座位重新点亮。
- 首庄、新庄、连庄都是三牢，庄闲倍数固定 8 倍。三牢不再增加。
  - 客户端实现：GameData 维护牢庄等级 _bankerLevel（注释 1=一牢/平庄、2=二牢、3=三牢），GameJuDataCmd 从局数据 banker_level 推导赋值，未在客户端强制固定为 3 牢（source-code/client/Code/data/GameData.ts:1593, source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts:35）；GameData 提供 getZhuangXianMult（1<<bankerLevel，3 牢即 8 倍）但全仓无调用，实际倍数取自服务端结算 win_losts.mult，番型解析明确不乘牢庄/承包（source-code/client/Code/data/GameData.ts:1664, source-code/client/Code/util/XsmjHuFanResolver.ts:31, source-code/client/Code/config/MatchTipConfig.ts:24）；未找到显式倍数封顶代码，GameData.bankerLevel 可被服务端任意赋值，仅展示层对档位做了 3 档上限处理（source-code/client/Code/layer/BoxHzmjPlayerMatchView.ts:225）。
  - UI 交互：玩家头像按等级切换 C_Bank 的 zhuang1/zhuang2/zhuang3 三档庄图，萧山好友房分支改用 XsmjZhuangComp 数字标志；结算行与流水显示服务端下发的分数与倍数，萧山分支头像庄标志显示 x2/x3 数字，杭州麻将走三档庄图；匹配房头像设置庄档位时 bankIdx>3 归 3，PlayerPanel 与 ResultItem 的庄标志控制器均只有 1/2/3 三档，无更高档位资源。

### 财神与牌组

- 136 张：万、条、筒各 36 张，东南西北 16 张，中发白 12 张。
  - 客户端实现：GameData 初始化时把牌墙总数设为 136，并按万、条、筒、风、箭 34 种牌值每种 4 张初始化记牌器（34 种 ×4 = 136），运行期由 MsgWallMah.wall_left 覆盖总数；构成上 BoxMahDefine 定义 MahValueWan/MahValueTiao/MahValueTong 各 9 个牌值、记牌器对每种牌值初始化 4 张，每花色合计 36 张，MahValueFeng 定义东(65)、南(66)、西(67)、北(68) 四个牌值、每种 4 张合计 16 张，MahValueJian 定义中(81)、发(82)、白(83) 三个牌值、每种 4 张合计 12 张（source-code/client/Code/data/GameData.ts:188、source-code/client/Code/config/BoxMahDefine.ts:592、source-code/client/Code/data/GameData.ts:1470、source-code/client/Code/controller/cmd/gameCmd/GameWallMahCmd.ts:32、source-code/client/Code/config/BoxMahDefine.ts:323、source-code/client/Code/config/BoxMahDefine.ts:337、source-code/client/Code/config/BoxMahDefine.ts:354、source-code/client/Code/data/GameData.ts:1484、source-code/client/Code/config/BoxMahDefine.ts:371、source-code/client/Code/config/BoxMahDefine.ts:373、source-code/client/Code/data/GameData.ts:1477、source-code/client/Code/config/BoxMahDefine.ts:381、source-code/client/Code/config/BoxMahDefine.ts:383、source-code/client/Code/data/GameData.ts:1480）
  - UI 交互：长按桌面可弹出记牌器（BoxHzmjJpqView），展示各牌剩余张数（source-code/client/Code/layer/BoxHzmjMainView.ts:287）
- 四张白板都是财神。
  - 客户端实现：财神牌值不写死为白板，由 MsgJoker 的 jokers[0]/open 写入 GameData.jokerMah，白板财神模式（jokerOpen=0 / cai_shen_type=0）下 jokerMah=83，白板即财神，另支持翻财神模式；财神判定按牌值等式（mah === jokerMah），同牌值的 4 张白板全部命中，记牌器对箭牌每种按 4 张计数（source-code/client/Code/config/BoxMahDefine.ts:81、source-code/client/Code/data/GameData.ts:1814、source-code/client/Code/controller/cmd/gameCmd/GameJokerCmd.ts:58、source-code/client/Code/data/GameData.ts:1836、source-code/client/Code/data/GameData.ts:2008、source-code/client/Code/data/GameData.ts:1481）
  - UI 交互：财神色按牌值统一上色，四张白板出现在手牌、牌河、副露、胡牌列表时都会被染财神色 #ffc4c4（可点击、无角标）；桌面财神位（KW_LEFT_MAHS/BoxHzmjMahLeftComp）展示财神牌面（source-code/client/Code/data/PlayerCardsData.ts:317、source-code/client/Code/util/BoxHzmjMahColorUtil.ts:29、source-code/client/Code/util/BoxHzmjMahColorUtil.ts:22）
- 轮到自己出牌时可以打出财神，不要求已经爆头。打出后按普通白板留在牌河，其他人不能吃、碰、杠，也不能用它点炮胡。
  - 客户端实现：出牌由 BoxHzmjMainView.onPlayMah 校验后调用 GameController.sendPlay 上行 MsgPlayC，可出牌条件仅为服务端下发 POWER_ID_PLAY，客户端未对财神做额外拦截；出牌前 canPlayMahCheck 只校验 MsgPlayLmts 禁打、可听牌拦截与"点过才能出牌"操作态，没有爆头前置条件，是否放行完全由服务端 MsgPower 决定（source-code/client/Code/layer/BoxHzmjMainView.ts:1550、source-code/client/Code/layer/BoxHzmjMainView.ts:1482、source-code/client/Code/layer/BoxHzmjMainView.ts:1432、source-code/client/Code/data/GameData.ts:1789）
  - UI 交互：财神手牌可点击、无角标，打出后座位播放飘 Spine 动画（skin=piao），打出财神时播放财神专属播报音；无爆头相关出牌提示，服务端拦截财飘出牌时通过 MsgNotifyInfo 弹"有财必拷响规则生效中"（source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:64、source-code/client/Code/layer/BoxHzmjTipAniView.ts:517、source-code/client/Code/controller/gameSoundController.ts:108、source-code/client/Code/controller/cmd/gameCmd/GameNotifyInfoCmd.ts:62）
  - 客户端实现：GamePlayCmd 收到 MsgPlayS 后写入 PlayerCardsData.setPlayMah 并派发 setPlayMah/addPlayMah，BoxHzmjMah2DView 把牌插入对应座位出牌区（outs），牌面按牌值显示为白板（source-code/client/Code/controller/cmd/gameCmd/GamePlayCmd.ts:89、source-code/client/Code/layer/BoxHzmjMah2DView.ts:853）
  - UI 交互：牌落河后立即调用 _applyJokerColorToTable，牌河里的财神仍被染财神色，因此显示为红色高亮的白板，而非完全普通的白板（source-code/client/Code/layer/BoxHzmjMah2DView.ts:1130）
  - 客户端实现：吃、碰、杠完全由服务端 MsgChowS/MsgPungS/MsgKongS 驱动，客户端按 msg.comb 更新组合与记牌器，没有本地"财神弃牌不可被吃碰杠"判断；胡牌按钮与胡牌类型均来自服务端，自己点胡经 sendHu 上行 MsgHuC，点炮、自摸动画类型按服务端 dfFrom 与多响字段推导，客户端不校验弃牌是否财神（source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:37、source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:37、source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:40、source-code/client/Code/controller/gameController.ts:477、source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:95）
  - UI 交互：吃碰杠按钮是否出现由服务端 MsgPower 权限位决定，客户端不做过滤，副露展示层按 isJoker 做财神插位排序；点炮胡播 HuAniType.DIAN_PAO 动画，服务端不下发胡权限时无胡按钮（source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:93、source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:325）

### 发牌

从牌墙头部、庄家起、按逆时针：
  - 客户端实现：GameData.takeWalls(nDir,nTcnt) 按正向(1)/反向(2)索引置空牌墙，发牌后的首次抓牌调用 takeWalls(1, hands.length*playCnt+1) 从正向起点顺序取，MsgWallMah 用服务端 first_asc/first_desc 重置牌墙索引；MsgJuData 将服务端 zhuang 转本地座位并记录庄家，MsgTakeFirst 逐座位携带 seat+hands，客户端不自行推算发牌起点（source-code/client/Code/data/GameData.ts:687, source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:94, source-code/client/Code/controller/cmd/gameCmd/GameWallMahCmd.ts:33, source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts:31, source-code/client/Code/controller/cmd/gameCmd/GameTakeFirstCmd.ts:29, source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:303）。
  - UI 交互：牌墙按索引逐张置空隐藏，剩余张数 via onUpdateMahCnt 同步刷新；庄家标识由 onShowZhuang 展示（属定庄阶段表现，非发牌逻辑）。
  - 待确认：客户端代码未找到对应实现（逆时针逐座发牌）。

1. 每人 4 张，发 3 轮，各 12 张。
  - 客户端实现：客户端不做逐轮 4 张分发，MsgTakeFirst 一次性下发整手 hands，GameTakeFirstCmd 调 setHandFirst 整手落库，BoxHzmjMah2DView.onTakeFirstAniAll 调 hands[seat].takeFirst(cards) 整手展示（source-code/client/Code/controller/cmd/gameCmd/GameTakeFirstCmd.ts:31, source-code/client/Code/layer/BoxHzmjMah2DView.ts:770, source-code/client/Code/config/BoxMahDefine.ts:417, source-code/client/Code/layer/BoxHzmjTestView.ts:431）。
  - UI 交互：每个座位手牌整批出现（takeFirst），自身座位先随机乱序展示再进入理牌。
2. 再每人 1 张，各 13 张。
  - 客户端实现：自己手牌13张作为基数参与首次抓牌的牌墙消耗计算 hands.length*playCnt+1；PlayerCardsData 以 MAX_MAH_COUNT-1=13 作为手牌上限，超出部分转为单放摸牌位（source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:94, source-code/client/Code/data/PlayerCardsData.ts:495, source-code/client/Code/layer/BoxHzmjTestView.ts:431）。
  - UI 交互：手牌区最多平铺13张，第14张进入单放位。
3. 再给庄家 1 张。庄家 14 张，三名闲家各 13 张，共发出 53 张，余 83 张。
  - 客户端实现：手牌上限常量为14，庄家座位由 MsgJuData 指定，setHandFirst 只写 _cards 不写单放摸牌位 moCard，故庄家14张全部平铺在手中；首次抓牌按 hands.length*playCnt+1（13*4+1=53）计算需置空的牌墙索引，takeWalls 末尾执行 _wallLeftNum -= nTcnt，MsgWallMah 以服务端 wall_left 作为牌墙总数（source-code/client/Code/config/BoxMahDefine.ts:56, source-code/client/Code/data/PlayerCardsData.ts:227, source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts:32, source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:94, source-code/client/Code/data/GameData.ts:738, source-code/client/Code/controller/cmd/gameCmd/GameWallMahCmd.ts:32, source-code/client/Code/layer/comp/BoxHzmjMahRightComp.ts:28）。
  - UI 交互：庄家14张全部平铺展示，无单放摸牌位；右上角剩余张数组件显示 getLeftCard() 数值。

庄家用这 14 张直接进入首轮，不再摸牌。理牌后若已满足自摸，立即给出【自摸】【过】。爆头、七客按其余 13 张判断。
  - 客户端实现：庄家14张经 MsgTakeFirst 一次性入手且不设 moCard，发牌动画后立即理牌并 sendEndWait，直接接收 MsgPower 进入出牌，GamePowerCmd 用 leftCard === totalCard - playCnt*13 - 1 判定首出阶段；自身理牌完成回调中 sendEndWait 请求推进，MsgPower 到达后按 power 位展示胡/过按钮，胡按钮按 hu_type 选动效皮（非点炮/抢杠即 zimo）；爆头/听牌由服务端 MsgWaitInfos 下发，wait mah=0xFF(255) 归一为 MAH_VALUE_ALL，GameData.isSelfBaoTouTing 依据 TYPE_BAO 或任意牌牌值判断展示，七客仅在结算番型命名中使用（source-code/client/Code/data/PlayerCardsData.ts:226, source-code/client/Code/layer/BoxHzmjMainView.ts:1351, source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:142, source-code/client/Code/layer/BoxHzmjMainView.ts:1354, source-code/client/Code/layer/BoxHzmjMainView.ts:665, source-code/client/Code/layer/BoxHzmjMainView.ts:581, source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:15, source-code/client/Fgui/assets/box_hzmj_main/component/HuIndex.xml:3, source-code/client/Code/controller/cmd/gameCmd/GameWaitInfoCmd.ts:97, source-code/client/Code/layer/BoxHzmjTingPaiView.ts:41, source-code/client/Code/data/GameData.ts:1992）。
  - UI 交互：发牌动画结束自动理牌，不播摸牌动画，首出阶段弹出庄/闲提示 KW_ZhuangTips；胡按钮 KW_BTN_Hu 播放 zimo 动画并显示胡牌牌面与倍数，过按钮 KW_BTN_Guo 同时出现，胡牌结果标识 HuIndex 含“自摸”页；听牌面板切换到爆头页（C_BaoTou/KW_BaoTou）并显示“胡”。

## 行牌

常规摸牌从牌墙头部取 1 张。出牌、吃、碰不减少余牌。胡牌或黄庄成立后，本小局结束。

### 操作优先级

对同一张弃牌：点炮胡 > 碰 / 直杠 > 吃。碰与直杠同级，同时能碰和直杠时不区分先后，按座位号小的先裁决。碰、直杠只发给当前能成立、且座位号最小的那一家。多人可胡时每家都收到胡，近者胡则远者不成立，近者放弃后远者仍可胡。
  - 客户端实现：客户端不做优先级比较，仅依据 MsgPower.power 的权限位同时展示吃(POWER_ID_CHOW)、碰(POWER_ID_PONG)、杠(POWER_ID_KONG)、胡(POWER_ID_HU) 按钮，并把 combs 拆成吃/碰/杠可选组合；点击后带 askid 上行，由服务端裁决最终生效动作（source-code/client/Code/layer/BoxHzmjMainView.ts:552, source-code/client/Code/layer/BoxHzmjMainView.ts:554, source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:53, source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:3, source-code/client/Code/layer/BoxHzmjMainView.ts:666）。
  - UI 交互：操作区“碰杠胡”页同屏可同时显示吃、碰、杠、胡按钮（布局从左到右为吃、碰、杠、胡），按钮带 spine 光效；胡按钮额外显示所胡牌面与倍数文字（如 128倍）。
  - 客户端实现：客户端把 CMF_PONG 与 CMF_MKONG/CMF_CKONG/CMF_TKONG 分别归入碰组合与杠组合，两者可同时出现在同一权限包中，不设置先手顺序；多杠时用单牌列表供玩家选择（source-code/client/Code/layer/BoxHzmjMainView.ts:553, source-code/client/Code/data/GameData.ts:884, source-code/client/Code/layer/BoxHzmjMainView.ts:654）。
  - UI 交互：碰按钮与杠按钮可同时可点；杠存在多组组合时展开多杠单牌列表（KW_GangGrps），选中后发送对应 comb。
  - 待确认：客户端代码未找到对应实现（按座位号小的先裁决）。
  - 客户端实现：客户端把每个 MsgPower 视为“当前唯一权限者”：只保存一个 _curPower 与 _curPowerPlayer；当权限包座位不是本地座位时直接 closeOperate 收起操作区，只有对应座位的客户端展示吃/碰/杠/胡按钮（source-code/client/Code/data/GameData.ts:864, source-code/client/Code/data/GameData.ts:865, source-code/client/Code/layer/BoxHzmjMainView.ts:528）。
  - UI 交互：收到自己座位权限包的客户端弹出操作按钮；其他客户端操作区被关闭（C_BtnState 置空白页），并清灰手牌。
  - 客户端实现：客户端按自己收到的 MsgPower.power 是否含 POWER_ID_HU 展示胡按钮（KW_BTN_Hu）；多人胡的完整数据通过 MsgHuEx/MsgResultHu 的 hu_items 下发，客户端按 hu_items 数量是否大于 1 生成 duo_xiang 标记（source-code/client/Code/layer/BoxHzmjMainView.ts:583, source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:144, source-code/client/Code/controller/gameController.ts:77, source-code/client/Code/controller/cmd/helperCmd/RecoverHuInfoCmd.ts:26）。
  - UI 交互：胡按钮显示所胡牌面与倍数，并按 hu_type 切换 hu/zimo 皮；每个玩家在自己客户端独立看到胡按钮与“过”按钮。
  - 待确认：客户端代码未找到对应实现（近者胡则远者不成立，近者放弃后远者仍可胡）。

- 只允许一人胡，不一炮多响。多人可胡时，从出牌者起按逆时针，最近的可胡者优先；放弃后顺延。
  - 客户端实现：客户端支持多胡场景的数据与表现：MsgResultHu.hu_items 多于 1 条时置 duo_xiang=1，并据此选择一炮多响动画类型；但代码未做“只允许一人胡”的拦截，若服务端下发多条胡牌记录仍会按一炮多响展示（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:144, source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:323, source-code/client/Code/layer/BoxHzmjTipAniView.ts:889）。
  - UI 交互：牌桌点炮动画节点按类型播放 dianpao 或 yipaoduoxiang spine 动画。
  - 客户端实现：客户端仅保存服务端下发的 hu_idx（胡序）并在牌桌上展示胡牌标识，不做逆时针距离计算，也不对各可胡玩家排序（source-code/client/Code/data/PlayerCardsData.ts:281, source-code/client/Code/layer/BoxHzmjMainView.ts:1666）。
  - UI 交互：胡牌标识节点 KW_Hu_Index_n 按 hu_idx 对应的 C_HuType 页展示（胡牌类型的桌面角标）。
  - 待确认：客户端代码未找到对应实现（放弃后顺延）。
- 低优先级先提交时，先等全部更高优先级的玩家手动放弃，再执行。更高优先级一旦成立，其余响应取消。
  - 客户端实现：客户端点击吃/碰/杠后立即打开发送（sendChow/sendPung/sendKong）并把操作区切回空白页，没有“等待更高优先级全部放弃”的本地状态或提示；动作是否执行取决于服务端随后下发的 MsgChowS/MsgPungS/MsgKongS（source-code/client/Code/layer/BoxHzmjMainView.ts:1102, source-code/client/Code/layer/BoxHzmjMainView.ts:1103, source-code/client/Code/controller/gameController.ts:499）。
  - UI 交互：提交后 KW_Handler.C_BtnState 立即切到空白页、清除手牌置灰与选吃回调，界面上不再显示等待态。
  - 客户端实现：客户端在收到 MsgChowS/MsgPungS/MsgKongS 或自己出牌的 MsgPlayS 后统一派发 onCloseOperate，收起整个操作区、清除吃碰杠置灰与选牌回调，等价于取消自己剩余的响应入口（source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:44, source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:44, source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:46, source-code/client/Code/layer/BoxHzmjMainView.ts:494, source-code/client/Code/controller/cmd/gameCmd/GamePlayCmd.ts:121）。
  - UI 交互：操作区 C_BtnState 置空白页、隐藏吃/碰/杠/胡/过按钮，隐藏多吃多杠选择池，并恢复手牌可点状态（已胡则保持）。
- 吃只能吃上家。
  - 客户端实现：客户端吃的可选项完全来自 MsgPower.combs 中 flag=CMF_CHOW 的组合（按索引存入 _chowCombInfo），不做“出牌者是否为上家”的本地校验；点击吃时把选中组合原样上行（source-code/client/Code/layer/BoxHzmjMainView.ts:1023, source-code/client/Code/data/GameData.ts:887, source-code/client/Code/config/GameDefine.ts:46）。
  - UI 交互：吃按钮存在多组组合时展开多吃牌面选择池（完整三张顺子）并显示取消按钮，选定后发送吃请求。

### 吃、碰、杠

风牌、箭牌不能做顺子，不能吃；不是财神时可以碰、杠。
  - 客户端实现：吃牌组合完全由服务端 MsgPower.combs 下发，客户端不校验花色，仅摸牌凑顺子光效把顺子限定为万、条、筒，风牌、箭牌不参与顺子判定；碰、杠按钮与组合同样来自 MsgPower，setCurPower 按 comb.flag 把组合归入碰、杠列表，不按花色过滤，风箭牌碰杠可正常展示与落地（source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:230, source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:232, source-code/client/Code/config/BoxMahDefine.ts:247, source-code/client/Code/data/GameData.ts:878, source-code/client/Code/data/GameData.ts:881）。
  - UI 交互：满足权限位时 KW_BTN_Peng / KW_BTN_Gang 显示并按 hz 布局排布。

- **吃**：上家刚打出的 1 张非财神，与手中 2 张非财神组成同花色连续顺子。多种合法组合时选 1 组。成功后不摸牌，进入出牌。当前回合可以加杠或暗杠。
  - 客户端实现：吃的顺子组合由服务端 MsgPower.combs 的 CMF_CHOW 项给出，mahs 已是完整三张，客户端只提取该组合展示并按牌值升序摆放；GameChowCmd 接收 MsgChowS 后直接把服务端 comb 交给 setCombo 落地，无财神判断，客户端也没有财神参与吃碰杠或财神替牌的拦截逻辑，isJokerMah 仅用于副露展示（财神靠左、牌面色）与结算排序，财神牌在副露中按真实牌值显示而非替牌；进张来源按 combo.from_seat 换算出座位，setCombo 把该张牌从出牌者河牌中弹出并记录 nFromSeat 为相对方位，副露渲染后按进牌实际槽位调整来源箭头位置（source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:34, source-code/client/Code/data/GameData.ts:1836, source-code/client/Code/data/GameData.ts:1831, source-code/client/Code/data/PlayerCardsData.ts:133, source-code/client/Code/config/BoxMahDefine.ts:804, source-code/client/Code/data/PlayerCardsData.ts:146, source-code/client/Code/data/PlayerCardsData.ts:91, source-code/client/Code/layer/BoxHzmjMah2DView.ts:935, source-code/client/Code/layer/BoxHzmjMainView.ts:1031, source-code/client/Code/config/BoxMahDefine.ts:799, source-code/client/Code/data/GameData.ts:886）。
  - UI 交互：副露区显示来源箭头（comboSefl/comboLeft/comboRight 的 n4、comboOpposite 的 n5）指向吃进的那张牌；副露中财神牌按 isJokerMah 上色，杠组财神靠左显示；多吃选项池中每项展示完整顺子三张牌，组内从左到右按牌值升序。
  - 客户端实现：_updateChiPower 统计 CMF_CHOW 组合数，onBtnChi 在数量大于 1 时调 showChooseChi 弹出多吃选项池（每个选项一整套顺子三张），点击后回写 _chooseChi 并经 GameData.getChowCombInfo(idx) 取组合发送 MsgChowC，仅 1 组时直接发送（source-code/client/Code/layer/BoxHzmjMainView.ts:1088, source-code/client/Code/layer/BoxHzmjMainView.ts:1113, source-code/client/Code/layer/BoxHzmjMainView.ts:899, source-code/client/Code/data/GameData.ts:779, source-code/client/Code/controller/gameController.ts:485）。
  - UI 交互：点吃按钮后切换到“选择多杠”页签（C_BtnState index 5），右侧弹出多吃选项池，每项带高亮底框与完整三张牌；取消按钮（KW_BTN_Cancel）回到吃按钮状态。
  - 客户端实现：GameChowCmd 收到 MsgChowS 后设置状态为 MAH_STATE_CHOW、清理翻牌权限、把进张从出牌区移除并关闭操作面板，自身不添加摸牌；随后由下一条 MsgPower 的 POWER_ID_PLAY 打开手牌可出牌状态（_selfHand.canPutCard）（source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:32, source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:42, source-code/client/Code/layer/BoxHzmjMainView.ts:536）。
  - UI 交互：吃动画播放后收起吃碰杠按钮与出牌大牌显示；下一次出牌权限到达后手牌可点出。
  - 客户端实现：吃后同一回合若服务端在 MsgPower 中同时给出 POWER_ID_PLAY 与 POWER_ID_KONG，并附带 CMF_TKONG、CMF_CKONG 组合，客户端会同时显示杠按钮与可出牌状态，_updateGangOffMoCard 识别杠与摸牌无关并允许直接出牌（source-code/client/Code/layer/BoxHzmjMainView.ts:549, source-code/client/Code/layer/BoxHzmjMainView.ts:692）。
  - UI 交互：杠/过按钮与手牌可出状态并存；未点过时直接出牌会提示“点‘过’才能出牌”。

- **碰**：任意他人刚打出的 1 张非财神，与手中 2 张相同非财神组成刻子。手中有 3 张也只用 2 张。成功后不摸牌，进入出牌。当前回合可以加杠或暗杠。
  - 客户端实现：GamePungCmd 接收 MsgPungS 的 comb（含 from_seat、mahs、in_mahs），把进张从来源玩家河牌移除并记录来源座位用于箭头，不校验来源是否为自己上家或是否为财神；setCombo 用 ComboData 把 mahs 去掉 in_mahs 后得到 nMahs，再从手牌 RemoveMahsForce 扣除对应张数，碰组以 3 张刻子形式进入副露（source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:34, source-code/client/Code/data/PlayerCardsData.ts:87, source-code/client/Code/config/BoxMahDefine.ts:789, source-code/client/Code/data/PlayerCardsData.ts:142）。
  - UI 交互：副露区新增碰组并绘制来源箭头指向进张；碰组以 3 张把形式显示，财神牌按牌值上色。
  - 客户端实现：GamePungCmd 更新记牌计数时只取 comb.mahs 的前 2 张，代码注释明确“碰只能减两张”；手牌扣除同样只移除 nMahs（去掉进张后的 2 张），第 3 张仍留在手中（source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:36, source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:37）。
  - 客户端实现：GamePungCmd 收到 MsgPungS 后设置 MAH_STATE_PUNG、清理翻牌权限、清空最后出牌、派发碰动画并关闭操作面板，自身不添加摸牌；出牌权由后续 MsgPower 的 POWER_ID_PLAY 打开（source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:32, source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:42）。
  - UI 交互：播放碰字效与音效后收起按钮，随后进入可出牌状态。
  - 客户端实现：碰后若 MsgPower 同时给出 KONG 权限与 CMF_TKONG 组合，客户端把该组合交给 PlayerCardsData.setCombo 的补杠分支，找到同牌值的 CMF_PONG 组就地替换为杠并扣 1 张手牌，实现碰后加杠（source-code/client/Code/data/PlayerCardsData.ts:99, source-code/client/Code/data/PlayerCardsData.ts:106）。
  - UI 交互：杠按钮出现并高亮，可与出牌并存（杠与摸牌无关时不置灰手牌）。
- **直杠**：他人刚打出的 1 张非财神，与手中 3 张相同非财神。按优先级裁决后，从牌墙尾部补牌。
  - 客户端实现：GameKongCmd 收到 CMF_MKONG 时清空最后出牌标记（说明进张来自他人弃牌），把 4 张杠组写入副露并从手牌扣除相应张数，组合由服务端 MsgPower.combs 提供（source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:37, source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:51）。
  - UI 交互：播放明杠字效（gang skin + GANG 音效）并在副露区以 4 张形式落地。
  - 客户端实现：多人同时可响应时客户端不做优先级裁决，MsgPower 按座位下发 power 位与 askid，客户端按位显示吃、碰、杠、胡按钮并用 askid 回包，多人可操作时各自看到自己的按钮，杠最终成立者由服务端 MsgKongS 等结果广播决定；补牌由 MsgTake 驱动，GameTakeCmd 按 data.dir、data.tcnt 调用 GameData.takeWalls 计算牌墙被取走的位置并播放抓牌动画，dir=2 表示反向（尾部）抓牌，客户端不自行决定补牌方向（source-code/client/Code/layer/BoxHzmjMainView.ts:552, source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:53, source-code/client/Code/layer/BoxHzmjMainView.ts:1453, source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:90, source-code/client/Code/data/GameData.ts:687, source-code/client/Code/data/GameData.ts:723）。
  - UI 交互：吃碰杠胡按钮可同时显示，玩家必须先点过才能出牌；按方向播摸牌动画并隐藏对应牌墙槽位，更新剩余牌数。
- **加杠**：出牌阶段，已碰出的刻子手里有第 4 张非财神。先征求抢杠胡。有人抢杠胡则加杠不成立、不补牌。无人胡再完成加杠并补牌。
  - 客户端实现：PlayerCardsData.setCombo 的补杠分支按同牌值定位已存在的 CMF_PONG 组，就地替换为杠组并记录 nIdx，同时从手牌移除 1 张；GameKongCmd 对 CMF_TKONG 改走 setComboBuGang 事件，把对应索引的碰组升级为 4 张（source-code/client/Code/data/PlayerCardsData.ts:104, source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:63, source-code/client/Code/layer/BoxHzmjMah2DView.ts:907）。
  - UI 交互：副露区原碰组原地补成 4 张杠，播放补杠字效与 BU_GANG 音效。
  - 客户端实现：客户端通过 HuType.HT_ROBKONG 与 ActionAniType.TYPE_QIANG_GANG_HU 区分抢杠胡，胡按钮的动画皮肤按 HT_DISCARD/HT_ROBKONG 走“hu”，并据此判定为非自摸；抢杠征求过程本身由服务端下发 MsgPower(HU) 驱动（source-code/client/Code/config/BoxMahDefine.ts:237, source-code/client/Code/config/GameDefine.ts:428, source-code/client/Code/layer/BoxHzmjTipAniView.ts:929）。
  - UI 交互：抢杠胡时胡按钮播放 hu 皮肤（非自摸/自摸皮肤），结算按点炮类处理。
  - 客户端实现：抢杠胡成立（MsgHuEx）时 PlayerCardsData.revertRobbedKong 提供回滚能力，把被抢的牌从摸牌、手牌移除，并把 CMF_TKONG 副露拆回 CMF_PONG 三张，用于加杠不成立的表现（source-code/client/Code/data/PlayerCardsData.ts:443, source-code/client/Code/data/PlayerCardsData.ts:465）。
  - UI 交互：被抢杠后杠组回退为碰组；胡牌者播放点炮类胡牌动画。
  - 客户端实现：无人抢杠时服务端继续下发 MsgKongS(CMF_TKONG)，客户端把碰组升级为杠并通过 setComboBuGang 渲染，随后由 MsgTake 完成补牌与牌墙扣减（source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:36, source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:88）。
  - UI 交互：副露升级为 4 张杠，播放补杠音效，随后播放补牌动画并刷新剩余牌数。
- **暗杠**：出牌阶段手中 4 张相同非财神。完成后补牌。暗杠下层 3 张牌背、顶张正面，四家都能认出牌面。暗杠放在碰杠区，但不计副露。
  - 客户端实现：客户端把 MsgPower.combs 中的 CMF_CKONG 归入杠组合列表并显示杠按钮；GameKongCmd 对 CMF_CKONG 不清 lastCard（说明不是吃他人弃牌），按 4 张手牌落地副露，是否 4 张相同由服务端判定（source-code/client/Code/data/GameData.ts:882, source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:54, source-code/client/Code/layer/BoxHzmjTipAniView.ts:509）。
  - UI 交互：杠按钮显示并高亮，暗杠时手牌不置灰（杠与摸牌无关场景），播放 AN_GANG 音效。
  - 客户端实现：GameKongCmd 只负责副露落地，补牌由随后的 MsgTake 处理，GameTakeCmd 依 data.dir、data.tcnt 计算牌墙并播放摸牌动画，自摸到家时更新摸到的牌与可选听牌信息（source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:61, source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:288）。
  - UI 交互：杠完成动画后播放补牌动画，刷新剩余牌数与摸牌位。
  - 客户端实现：结算（MsgResultHu）副露渲染对 CMF_CKONG 置 C_IsAnGan 控制器为 1，并把第 0 至 2 张牌的 state 切到牌背页、第 3 张保持正面页，形成 3 背加 1 面；桌面碰杠区的暗杠渲染依赖外部 common_game 的 Mah2DCombo_Box，本仓库无其源码（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:557, source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:583, source-code/client/Fgui/assets/box_hzmj_result/component/comboSefl.xml:4）。
  - UI 交互：副露组件切到 4mah 页并启用 C_IsAnGan，前 3 张牌背、最后 1 张正面且带牌值。
  - 客户端实现：GameKongCmd 对所有杠类型（含 CMF_CKONG）统一派发 setCombo，桌面副露管理器把暗杠作为一组加入碰杠区；客户端没有副露计数概念，摊计数与承包由服务端 MsgTanUpdate 下发（source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:72, source-code/client/Code/layer/BoxHzmjMah2DView.ts:895, source-code/client/Code/controller/cmd/gameCmd/GameTanUpdateCmd.ts:21）。
  - UI 交互：碰杠区新增一组 4 张暗杠；结算副露槽位按 combs.length 计入该组。
- 吃或碰刚成立的当前回合，同样可以加杠、暗杠。四张相同就可以杠，杠完这条就不再按七对结算。
  - 客户端实现：吃、碰成功后客户端只把状态切到 CHOW、PUNG 并关闭操作面板，不锁定杠权限；下一条 MsgPower 若含 POWER_ID_KONG 与杠组合，杠按钮照常显示，_updateGangOffMoCard 按杠是否与摸牌相关决定是否解除手牌置灰（source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:44, source-code/client/Code/layer/BoxHzmjMainView.ts:692, source-code/client/Code/layer/BoxHzmjMainView.ts:580）。
  - UI 交互：吃过、碰过之后仍可出现杠按钮；杠与摸牌无关时手牌不置灰、可直接出牌。
  - 客户端实现：多杠、多暗杠的选择列表由 _getGangPowerInfo 从 MsgPower.combs 中收集所有 CMF_MKONG、CMF_CKONG、CMF_TKONG 组合的首张牌值生成，多组时弹选择列表；客户端不自行判断四张相同（source-code/client/Code/layer/BoxHzmjMainView.ts:639, source-code/client/Code/layer/BoxHzmjMainView.ts:842）。
  - UI 交互：杠按钮在多个可杠组合时进入“选择多杠”页签，右侧列出可杠牌值列表，点击某项直接发送对应组合。
  - 待确认：客户端代码未找到对应实现（杠完这条就不再按七对结算）。
- 受尚未解除的飘财限制时，不能吃、碰、直杠、加杠，仍可暗杠。暗杠后只能打尾墩刚补进的那一张。
  - 客户端实现：客户端只在 MsgPiao 时记录飘计数并播飘动画，不参与吃碰杠按钮判定；吃、碰、杠按钮完全由 MsgPower.power 的 CHOW、PONG、KONG 位决定，禁用事实上由服务端剔除权限位实现；杠按钮只区分 POWER_ID_KONG，不区分明杠暗杠，GameKongCmd 对 CMF_CKONG 无飘相关分支，飘限制下服务端若仍下发暗杠组合，客户端可正常执行暗杠流程（source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts:21, source-code/client/Code/layer/BoxHzmjMainView.ts:552, source-code/client/Code/data/GameData.ts:1714, source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:50, source-code/client/Code/layer/BoxHzmjTipAniView.ts:511）。
  - UI 交互：飘动画播放与飘计数提示；被限制时对应按钮不出现；暗杠时播放 AN_GANG 音效与暗杠动画，不与飘动画互斥。
  - 客户端实现：暗杠后若服务端下发 MsgPlayLmts（hands 禁打手牌、dang_fang 禁打单放），客户端缓存限制并在出牌权刷新时灰化被禁牌面；出牌前 canPlayMahCheck 会拦截被禁牌并提示“该牌被禁打”，因此可强制只剩补进的那张可出（source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:45, source-code/client/Code/layer/BoxHzmjMainView.ts:1277, source-code/client/Code/layer/BoxHzmjMainView.ts:1432）。
  - UI 交互：被禁手牌置灰、不可拾起；点击被禁牌提示“该牌被禁打”。

### 杠后补牌

每次杠从牌墙尾部补 1 张，余牌减 1。
  - 客户端实现：客户端不自判取牌方向，GameTakeCmd 收到 MsgTake 后调用 GameData.takeWalls(data.dir, data.tcnt)，dir=2 走反向抓牌分支，从 desc 索引（牌墙尾部）逐张取牌，并把被取走的墙位 missWallAll 交给 setTakeMah 播放摸牌；补牌后余牌同步扣减，takeWalls 按本次抓取张数扣减 _wallLeftNum，GameTakeCmd 抓牌后派发 onUpdateMahCnt(GameData.getLeftCard()) 驱动剩余张数展示刷新（source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:90、source-code/client/Code/data/GameData.ts:729-731、source-code/client/Code/lib/proto_game_hzmj.d.ts:1127、source-code/client/Code/lib/proto_game_hzmj.d.ts:1130、source-code/client/Code/layer/BoxHzmjMah2DView.ts:804、source-code/client/Code/data/GameData.ts:738、source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:289、source-code/client/Code/layer/comp/BoxHzmjMahRightComp.ts:27-28、source-code/client/Code/layer/BoxHzmjMah2DView.ts:353）
  - UI 交互：摸牌表现由 BoxHzmjMah2DView 的 setTakeMah 处理，自己走 setSelfTakeMah 与 showSpecialMah，其他座位调用 hands[localSeat].moMah 摆牌；右侧剩余张数组件（KW_RIGHT_MAHS / BoxHzmjMahRightComp）把 title 设为剩余张数并显示，BoxHzmjMah2DView 在绑定完成后也会补刷该数值
牌墙少于 21 张不能杠。
  - 客户端实现：客户端不做 21 张牌墙校验，杠按钮是否出现只取服务端 MsgPower 的 POWER_ID_KONG 位；点击后由 GameController.sendKong 组装 MsgKongC 上送，未找到任何本地余量门槛代码（source-code/client/Code/layer/BoxHzmjMainView.ts:554、source-code/client/Code/layer/BoxHzmjMainView.ts:580、source-code/client/Code/config/BoxMahDefine.ts:208、source-code/client/Code/controller/gameController.ts:540-541）
  - UI 交互：杠按钮 KW_BTN_Gang.visible 由 showGang 控制，按钮态切到 C_BtnState 的“碰杠胡”页；多个可选杠时再切到“选择多杠”页展示 KW_GangGrps 列表
剩 20 张及以下时，下一次摸牌前黄庄。
  - 客户端实现：客户端无本地黄庄/流局时机判定，流局落在结算链路，MsgResultHu 的 end_type=ET_DRAWN 时小结算按流局处理（自己行记为输/平），协议层另有 MsgDrawn 与 GP_DRAWN→CMD_DRAWN 映射，但未找到 CMD_DRAWN 的命令实现类（source-code/client/Code/config/MatchTipConfig.ts:39、source-code/client/Code/util/BoxHzmjResultUtil.ts:37-38、source-code/client/Code/config/GameDefine.ts:441、source-code/client/Code/protocol/GameGlcProtocol.ts:285、source-code/client/Code/controller/gameController.ts:74）
  - UI 交互：小结算按流局展示输赢行；房间提示文案含“剩余20张牌前无人胡牌则流局”；tipAni 包内有 txt_liuju.png 流局字效资源

杠后可以继续杠，每次重新检查牌墙不少于 21 张。
  - 客户端实现：每次 MsgKongS 都走同一条 GameKongCmd，置 MAH_STATE_KONG、更新副露、清除复盘权限并关闭操作栏；代码中无已杠次数记录，也无禁止再次杠的分支，后续动作完全由下一条服务端消息驱动（source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:33、source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:46-47、source-code/client/Code/layer/BoxHzmjMainView.ts:605-607、source-code/client/Code/layer/BoxHzmjMainView.ts:639-642）
  - UI 交互：杠成功后收起吃碰杠胡操作区（onCloseOperate、onHidePutCardUi），并播放碰杠 Spine 动画；下一轮 power 若仍含 POWER_ID_KONG 再次显示杠按钮，多杠时展示 KW_GangGrps 选择列表
  - 待确认：客户端代码未找到对应实现（每次重新检查牌墙不少于 21 张）
补牌可以自摸；不胡则继续杠或打出 1 张。
  - 客户端实现：补牌后若服务端 MsgPower 带 POWER_ID_HU，客户端显示胡按钮并可 sendHu 上送 MsgHuC，胡按钮动画按 hu_type 选皮肤，非点炮/抢杠（即 HT_SELF 自摸）用 zimo 皮肤，番型侧另有杠上开花 2406（杠牌后自摸 2 倍）定义；客户端不区分“补牌后”与普通回合，胡按钮与杠按钮可同时由 power 位置亮，玩家点杠则 GameData.getKongCombInfo 取组合后 sendKong 上送，点胡则 sendHu，没有“必须放弃胡才能杠”的本地约束；power 含 POWER_ID_PLAY 时 canPutCard 置真、手牌可点击，点击经 canPlayMahCheck 校验（禁打、可听牌单击拦截、有吃碰杠胡按钮须先过）后由 onPlayMah 调 sendPlay 发送 MsgPlayC，服务端回 MsgPlayS 播落牌（source-code/client/Code/layer/BoxHzmjMainView.ts:665、source-code/client/Code/layer/BoxHzmjMainView.ts:675、source-code/client/Code/layer/BoxHzmjMainView.ts:555、source-code/client/Code/config/FanDefine.ts:25-26、source-code/client/Code/layer/BoxHzmjMainView.ts:583、source-code/client/Code/layer/BoxHzmjMainView.ts:1149-1154、source-code/client/Code/layer/BoxHzmjMainView.ts:580、source-code/client/Code/layer/BoxHzmjMainView.ts:536、source-code/client/Code/layer/BoxHzmjMainView.ts:556、source-code/client/Code/layer/BoxHzmjMainView.ts:1482、source-code/client/Code/layer/BoxHzmjMainView.ts:1455）
  - UI 交互：胡按钮 KW_BTN_Hu 显示并带光效，胡牌动画区分自摸 zimo 与点炮/抢杠 hu，番型结算可命中“杠上开花”名称；碰杠胡页同时显示杠与胡按钮，多杠时进入“选择多杠”页，选择后收起操作区等待服务端回应；手牌可点出牌，存在杠/胡按钮且未点“过”时弹提示“点‘过’才能出牌”，与摸牌无关的杠（_isGangOffMoCard）不置灰、可直接出牌
明杠、暗杠、加杠都使杠链加 1。
  - 客户端实现：客户端不维护杠链计数字段，GameKongCmd 仅按 MsgKongS 的 comb.flag 区分 CMF_MKONG / CMF_CKONG / CMF_TKONG 并映射为三种动作类型，结算侧按服务端 fan_ids 渲染 2406~2409 连杠档位番名（source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:50-59、source-code/client/Code/layer/BoxHzmjTipAniView.ts:509-511、source-code/client/Code/config/FanDefine.ts:27-28）
  - UI 交互：三类杠共用 gang Spine 皮肤，音效分别播 GANG（明杠）、AN_GANG（暗杠）、BU_GANG（补杠）；连杠档位最终以结算番名（杠上开花/二连杠/三连杠/四连杠）体现
吃、碰，或打出非财神，或打出财神但打出后不再敲响，杠链归零。
  - 待确认：客户端代码未找到对应实现（杠链归零逻辑）

### 自摸、放铳、抢杠胡

- **自摸**：常规摸牌、杠后补牌，或庄家起手第 14 张，在出牌前胡牌。常规结构是 4 组面子加 1 组对子。
  - 客户端实现：常规摸牌由 GameTakeCmd 处理 MsgTake 时把桌面状态置为 MAH_STATE_TAKE 并记录摸牌，随后 MsgPower 到达，客户端按 POWER_ID_HU 位显示胡按钮（胡张取 power.hu_mah、倍数取 power.hu_point），点击后 GameController.sendHu 携带 askid 发 MsgHuC；杠后补牌由 GameKongCmd 按 comb.flag 区分明杠/暗杠/补杠并播放对应杠动画，补牌走通用 MsgTake 路径，杠上开花作为番型由服务端下发 fan_ids，客户端仅按番型选动画与音效，无独立的杠后补牌自摸判定；庄家起手发牌由 GameTakeFirstCmd 置为 MAH_STATE_TAKEFIRST，重连场景表把 kHzmjStateFirstWait(503) 映射到场景动作命令，存在首摸后动作等待阶段，但客户端无庄家起手第 14 张可胡的专门判定，仍由 MsgPower 授予胡权限；客户端不计算手牌是否 4 组面子加 1 组对子，只按服务端下发的 hu_items/player_hands 渲染副露组合与手牌，番型表以平胡（四面子一将）标识该结构，无结构校验逻辑（source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:63；source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:58；source-code/client/Code/config/FanDefine.ts:26；source-code/client/Code/protocol/GameGlcProtocol.ts:78；source-code/client/Code/controller/gameController.ts:50；source-code/client/Code/controller/cmd/gameCmd/GameTakeFirstCmd.ts:32；source-code/client/Code/config/FanDefine.ts:16）
  - UI 交互：胡按钮 KW_BTN_Hu 显隐由权限位控制，KW_Ani 皮肤按 hu_type 切换（自摸为 zimo），按钮以 Spine 动效与高亮呈现，胡张与“N倍”文字同步刷新；杠上开花命中时播放 KW_Ani_Hu_Type 的 gangkai 文字动效并播放 hu_7_gangkai 音效，默认无番型时按自摸播 zimo 动效；首出阶段由 GamePowerCmd 显示庄/闲首出提示并隐藏骰子，获胡权限后照常显示胡按钮；结算行按 Comb 模式渲染副露槽位并把单放组移到最后，或按 Hand 模式渲染手牌与 KW_Mah_Hu 胡张，无番型时按 pinghu 动效展示（source-code/client/Code/layer/BoxHzmjMainView.ts:583；source-code/client/Code/layer/BoxHzmjMainView.ts:1183；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1094；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1075；source-code/client/Code/config/GameSoundConfig.ts:431；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:176；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1062）
- **放铳**：本期固定庄闲放铳。当局是三牢，且出牌者与胡牌者正好一边是庄、一边是闲，同时牌型合法，才能点炮胡。庄家打出的牌只有闲家可胡，闲家打出的牌只有庄家可胡。未形成这个关系时只能自摸。只由放铳者赔付。
  - 客户端实现：客户端没有庄闲放铳的开关或房间配置项，MsgGameConfig 仅包含 must_bao_tou_with_cai、enable_three_tan_bao、round_id、simple_mode 等字段，与固定开启、不可配置一致；客户端保存 bankerLevel（1=平庄/2=二牢/3=三牢）并提供 getZhuangXianMult 计算 1<<level（三牢=8），但该倍数不参与点炮资格判定，胡按钮上的倍数是服务端 hu_point 直接下发；胡入口完全由服务端权限决定，只有 POWER_ID_HU 置位才显示胡按钮，否则自己回合只保留出牌操作，因此“不能点炮”时自然退化为仅能自摸；客户端不计算赔付，只渲染服务端 win_losts 与 extra_score，流水类型把点炮胡（K_LT_DIAN_PAO）与放炮（K_LT_FANG_PAO，负分）成对处理，结算行对被胡座位判定为放铳者时把 C_HuType 置为“点炮”页（source-code/client/Code/lib/proto_game_hzmj.d.ts:3985；source-code/client/Code/lib/proto_game_hzmj.d.ts:3988；source-code/client/Code/data/GameData.ts:1664；source-code/client/Code/data/GameData.ts:1665；source-code/client/Code/layer/BoxHzmjMainView.ts:555；source-code/client/Code/layer/BoxHzmjMainView.ts:557；source-code/client/Code/config/FanDefine.ts:555；source-code/client/Code/util/BoxHzmjFlowUtil.ts:120；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:736）
  - UI 交互：KW_BTN_Hu 内 KW_HuPaiBeiShu 文本显示“{hu_point}倍”，封顶标记固定隐藏；胡/过按钮按权限位显隐，未获胡权限时不出现胡按钮（吃碰杠按各自权限位显示）；结算行胡牌类型页中胡牌者按 HT_SELF 显示自摸、其余显示吃胡，非胡牌座位若被某胡牌项的 df_from 指向则显示“点炮”标识（source-code/client/Code/layer/BoxHzmjMainView.ts:666；source-code/client/Code/layer/BoxHzmjMainView.ts:555；source-code/client/Code/layer/BoxHzmjMainView.ts:557；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:736）
  - 待确认：出牌者与胡牌者正好一边是庄、一边是闲且牌型合法才能点炮胡——客户端代码未找到对应实现
  - 待确认：庄家打出的牌只有闲家可胡——客户端代码未找到对应实现
  - 待确认：闲家打出的牌只有庄家可胡——客户端代码未找到对应实现
- **抢杠胡**：与放铳相同，只有三牢的庄闲之间可以抢。所加的第 4 张须使响应者合法胡牌。只由被抢的加杠者按放铳赔付，其他人不付。
  - 客户端实现：客户端把抢杠胡作为 hu_type=HT_ROBKONG 处理，在动画皮肤、点炮判定、结算胡牌类型上都与点炮（HT_DISCARD）同分支，即表现层按与放铳相同处理，但三牢庄闲的门槛在客户端无校验；被抢杠时 PlayerCardsData 提供 revertRobbedKong，把被抢张从摸牌/手牌移除并把补杠组标志改回碰（CMF_PONG），胡张经 MsgHuItem.dan_fang 下发后在桌面拼入胡牌者手牌，合法性判断在服务端，客户端只做还原与展示；流水类型表定义抢杠胡（K_LT_QIANG_GANG）与被抢杠（K_LT_BEI_QIANG_GANG）成对，客户端在胡牌流水归集中把抢杠与点炮并列处理，结算行按 hu_type!==HT_SELF 判为吃胡/点炮页，赔付金额完全取服务端结果（source-code/client/Code/config/BoxMahDefine.ts:897；source-code/client/Code/layer/BoxHzmjMainView.ts:671；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:339；source-code/client/Code/data/PlayerCardsData.ts:444；source-code/client/Code/data/PlayerCardsData.ts:465；source-code/client/Code/layer/BoxHzmjMah2DView.ts:984；source-code/client/Code/config/FanDefine.ts:557；source-code/client/Code/util/BoxHzmjFlowUtil.ts:119；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:731）
  - UI 交互：抢杠胡与点炮共用胡按钮的“hu”动作皮肤并播放点炮动画，无独立“抢杠”按钮或字效；桌面把被抢的第 4 张拼到胡牌者手牌末位并打胡牌高亮，杠者副露从 4 张杠退回 3 张碰；结算行胡牌类型只区分不参与胡牌/点炮/吃胡/自摸四页，抢杠赢家显示“吃胡”、被抢者显示“点炮”，无“抢杠”独立标识（source-code/client/Code/layer/BoxHzmjMainView.ts:671；source-code/client/Code/layer/BoxHzmjMah2DView.ts:984；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:731）
  - 待确认：抢杠胡除被抢的加杠者外其他人不付——客户端代码未找到对应实现

### 飘财

全场同时只有一个飘财窗口。打出财神的玩家成为所有者，限制另外三家。之后再有人打出财神，窗口直接换到这个人，不叠加。受限玩家若被逼打出刚摸到的财神，窗口就转到他身上。
  - 客户端实现：服务端通过 MsgPlayLmts 下发禁打手牌 hands 与禁打单放 dang_fang，GamePlayLmtsCmd 写入 GameData 后由 BoxHzmjMainView.onPlayLmtsUpdate 对本地座位手牌做禁打灰化；客户端不判断打出者是否为飘财所有者，也不标记所有者（source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:10；source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:45；source-code/client/Code/layer/BoxHzmjMainView.ts:1274）
  - UI 交互：仅对本地受限玩家做手牌禁打灰化与点击拦截，其它三家界面无所有者标识。
  - 待确认：全场同时只有一个飘财窗口——客户端代码未找到对应实现
  - 待确认：之后再有人打出财神，窗口直接换到这个人，不叠加——客户端代码未找到对应实现
  - 待确认：受限玩家若被逼打出刚摸到的财神，窗口就转到他身上——客户端代码未找到对应实现

- 受限时可以胡牌和暗杠，不能吃、碰、直杠、加杠。只能打刚摸进或最新补进的那一张，其余手牌压暗，只在自己界面显示。这份限制盖过吃碰禁手。
  - 客户端实现：胡、杠按钮的显隐完全由 MsgPower 的 POWER_ID_HU / POWER_ID_KONG 位驱动，BoxHzmjMainView 只按位渲染，客户端没有针对飘财受限场景单独开放「只允许暗杠」的判断；吃、碰、杠按钮同样由 MsgPower 的 POWER_ID_CHOW / POWER_ID_PONG / POWER_ID_KONG 位控制显隐，客户端不解析杠的子类型（明杠/暗杠/加杠）权限，遇到底座多杠时由 KW_GangGrps 展示可选杠列表（source-code/client/Code/layer/BoxHzmjMainView.ts:549；source-code/client/Code/layer/BoxHzmjMainView.ts:583；source-code/client/Code/config/BoxMahDefine.ts:207；source-code/client/Code/layer/BoxHzmjMainView.ts:577；source-code/client/Code/layer/BoxHzmjMainView.ts:601；source-code/client/Code/config/BoxMahDefine.ts:205）
  - UI 交互：受限时是否出现胡/杠按钮取决于服务端权限位，客户端不做额外过滤或置灰；受限时服务端若不下发对应权限位，吃/碰/杠按钮即整体隐藏，客户端没有独立的禁用态表现。
  - 客户端实现：出牌前由 BoxHzmjMainView.canPlayMahCheck 调用 GameData.canPlayCard 校验，禁打牌值来自 MsgPlayLmts.hands（禁手牌）与 dang_fang（禁单放）两组，受限出牌被服务端拦截时通过 MsgNotifyInfo 的 NIF_EX_MUST_BAO_TOU_WITH_CAI 下发提示；BoxHzmjPlayerHandCards.applyPlayLmtsGray 遍历手牌，命中禁打牌值的手牌把 touchable 置 false 并调用 Mah2DBase.setMahColor(item, MahColor.gray) 置灰，该逻辑只在 hasPlayLimit（_playLimitSeat === SELF_LOCAL_SEAT）成立时执行，因此仅作用于本机玩家手牌（source-code/client/Code/config/GameDefine.ts:471；source-code/client/Code/controller/cmd/gameCmd/GameNotifyInfoCmd.ts:61；source-code/client/Code/layer/BoxHzmjMainView.ts:1432；source-code/client/Code/data/GameData.ts:1789；source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:84；source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:108；source-code/client/Code/data/GameData.ts:1779）
  - UI 交互：打出被禁的牌时 toast「该牌被禁打」，权限被拦截时 toast「有财必拷响规则生效中」；被禁的手牌显示为灰色且不可点击，摸牌位（末张）与手牌的判断以 GameData 的 moCard 为准，避免吃碰后末张被误判为单放。
  - 待确认：这份限制盖过吃碰禁手——客户端代码未找到对应实现

- 所有者自己下一次出牌时先关掉窗口。这张若又是财神，立刻重开。
  - 待确认：所有者自己下一次出牌时先关掉窗口——客户端代码未找到对应实现
  - 待确认：这张若又是财神，立刻重开——客户端代码未找到对应实现

- 飘档只在打出财神、且打出后手牌仍然敲响时加 1。没敲响就打财神，飘档和杠链都归零。打出普通牌同样归零。各家飘档独立。吃、碰、杠不清飘档，吃和碰会清杠链。
  - 客户端实现：GamePiaoCmd 接收 MsgPiao 后调用 GameData.updatePiaoState(seat, piao_count) 覆盖写入对应座位计数，并派发 onPiaoState 通知 UI；「是否打出财神、打出后是否仍敲响」的判定在服务端，客户端只同步结果（source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts:9；source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts:21；source-code/client/Code/lib/proto_game_hzmj.d.ts:3916）
  - UI 交互：计数增加时触发对应座位碰杠位的「飘」字动效；无计数数值展示。
  - 客户端实现：客户端可把服务端下发的 0 写入 _piaoCounts[seat]，此时 onPiaoState 因 piaoCount<=0 直接 return，不做任何界面反馈；杠链在客户端无对应字段与归零逻辑（source-code/client/Code/data/GameData.ts:1699；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1675）
  - UI 交互：归零时不播放任何「飘」字动效，也无提示。
  - 客户端实现：打出普通牌导致归零时由服务端下发 MsgPiao（piao_count=0），客户端 updatePiaoState 将对应座位计数覆盖为 0；本地不主动判定普通牌清零点（source-code/client/Code/data/GameData.ts:1700；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1673）
  - UI 交互：计数归零后不再出现「飘」字动效，界面无清零提示。
  - 客户端实现：GameData 用长度 4 的 _piaoCounts 数组按座位下标分别存储，updatePiaoState 只写单个座位，getPiaoCount(seat) 按座位读取，互不影响（source-code/client/Code/data/GameData.ts:1601；source-code/client/Code/data/GameData.ts:1699；source-code/client/Code/data/GameData.ts:1714）
  - UI 交互：飘字动效按座位独立播放（seatToLocal 后取该座位的碰杠动画节点），界面无汇总展示。
  - 客户端实现：GameChowCmd 与 GamePungCmd 只更新牌桌状态、副露组合与手牌计数，未读取或修改 _piaoCounts，行为与「不清飘档」一致；杠链在客户端无对应字段（source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:32；source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:32）
  - UI 交互：吃碰杠动效（chi/peng/gang skin）播放时不改变飘计数展示。

- 飘次数本局累加，小局重置时清掉。次数大于 0 时，在该座位碰杠位播放「飘」字，没有常驻标签。
  - 客户端实现：GameData.clearHzmjData() 将 _piaoCounts 重置为 [0,0,0,0]，clearData() 内调用 clearHzmjData()，小局重置由 onResetUI 事件触发 BoxHzmjMainView.resetUI() 中的 GameData.clearData()；局内累加由 MsgPiao 的 piao_count 直接覆盖体现（source-code/client/Code/data/GameData.ts:2015；source-code/client/Code/data/GameData.ts:230；source-code/client/Code/layer/BoxHzmjMainView.ts:399）
  - UI 交互：小局重置后各座位飘计数归零，碰杠位不再有飘字动效。
  - 客户端实现：BoxHzmjTipAniView.onPiaoState 监听 onPiaoState，piaoCount>0 时用 TableData.seatToLocal 定位座位，调用 onMsgPlayPengGang(TYPE_PIAO, localSeat)；后者把该座位 KW_Ani_PengGang_{uiIdx} 节点的 skinName 设为 piao、url 设为 Paixing_wz03 并播放 animation，播完置 visible=false；复盘模式下直接跳过（source-code/client/Code/layer/BoxHzmjTipAniView.ts:1672；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1680；source-code/client/Code/layer/BoxHzmjTipAniView.ts:517；source-code/client/Code/layer/BoxHzmjTipAniView.ts:183；source-code/client/Fgui/assets/box_hzmj_tipAni/component/HzmjTipAniComponent.xml:44）
  - UI 交互：在对应座位碰杠位播放一次「飘」字 Spine 动画（skin=piao），动画结束即隐藏，界面无数字或常驻飘标签。

### 杠开、杠飘、飘杠

- **杠上开花 / 二连杠 / 三连杠 / 四连杠**：自摸且杠链为 1 / 2 / 3 / 4 及以上，倍数 2 / 4 / 8 / 16。四连杠及以上都记 16 倍。杠链已断后再胡，不是杠开。
  - 客户端实现：客户端不自判杠开，仅从 MsgResultHu.hu_items[].hu_type 推断是否自摸（点炮/抢杠/点杠花之外视为自摸），据此选择音效；杠开番型完全以服务端 fan_ids 为准（source-code/client/Code/layer/BoxHzmjTipAniView.ts:929、source-code/client/Code/config/GameDefine.ts:424、source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:339、source-code/client/Code/config/FanDefine.ts:25）
  - 客户端实现：FanDefine 注册 2406=杠上开花（2x）、2407=二连杠（4x），GetHzmjGangLevel 对应返回杠链 1、2；萧山倍率表 2406=2、2407=4，仅用于动画候选比较，实际番点取服务端 fan_point（source-code/client/Code/config/FanDefine.ts:26、source-code/client/Code/config/FanDefine.ts:27、source-code/client/Code/config/FanDefine.ts:295、source-code/client/Code/config/FanDefine.ts:296、source-code/client/Code/config/XsmjFanConfig.ts:11、source-code/client/Code/config/XsmjFanConfig.ts:12、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1075、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1135、source-code/client/Code/config/GameSoundConfig.ts:431、source-code/client/Code/config/GameSoundConfig.ts:432）
  - 客户端实现：FanDefine 注册 2408=三连杠（8x）、2409=四连杠（16x），GetHzmjGangLevel 对应返回 3、4；萧山倍率表 2408=8、2409=16，仅用于动画候选比较，实际番点取服务端 fan_point；不存在 5 连及以上档位，更长的杠链由服务端统一压缩为 2409 下发，客户端按 16 倍展示（source-code/client/Code/config/FanDefine.ts:29、source-code/client/Code/config/FanDefine.ts:31、source-code/client/Code/config/FanDefine.ts:297、source-code/client/Code/config/FanDefine.ts:298、source-code/client/Code/config/XsmjFanConfig.ts:13、source-code/client/Code/config/XsmjFanConfig.ts:14、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1137、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1139、source-code/client/Code/config/GameSoundConfig.ts:433、source-code/client/Code/config/GameSoundConfig.ts:434）
  - UI 交互：自摸时播自摸音效，点炮/抢杠时播点炮音效，不改变番型字效节点；2406 走文字类节点 KW_Ani_Hu_Type（Paixing_wz01）skin=gangkai，好友房结算文案「杠上开花」，匹配场第二行简写「杠开」，音效 hu_7_gangkai；2407/2408/2409 走动效节点 KW_Ani_Hu，skin 分别为 2lgk/3lgk/4lgk，结算文案「二连杠」「三连杠」「四连杠」，音效分别为 hu_8_2gangkai/hu_9_3gangkai/hu_10_4gangkai
  - 待确认：杠链已断后再胡，不是杠开——客户端代码未找到对应实现
- **杠飘、飘杠**：只在同时命中杠上开花和财飘时拆出，倍数 8，再乘上基础番。杠发生时飘档已经大于 0，记飘杠；否则记杠飘。二连杠、双财飘及更高档不拆，仍按各组连乘。没有单独的杠爆、七客。
  - 客户端实现：ResolveHzmjHuFanComboAni 对 2419/2420 组合 ID 直接判 GANG_PIAO，否则在杠开系（2406 起）与财飘系（2403 起）同时出现时判 GANG_PIAO，用于选择组合表现；FanDefine 定义 2419=杠飘、2420=飘杠并注明 8x，萧山倍率表两者均为 8，用于动画候选比较，实际番点仍取服务端 fan_point（source-code/client/Code/config/FanDefine.ts:51、source-code/client/Code/config/FanDefine.ts:52、source-code/client/Code/config/FanDefine.ts:53、source-code/client/Code/config/FanDefine.ts:54、source-code/client/Code/config/FanDefine.ts:257、source-code/client/Code/config/FanDefine.ts:258、source-code/client/Code/config/XsmjFanConfig.ts:24、source-code/client/Code/config/XsmjFanConfig.ts:25、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1097）
  - 客户端实现：客户端不读飘档、不判断飘/杠先后，仅按服务端下发的组合 ID 区分：fan_ids 含 2419 判杠飘，含 2420 判飘杠，飘计数 MsgPiao 只用于数据缓存与碰杠位飘字动画；客户端不做连乘计算，FanDefine 只把杠开组/财神组/基础组声明为「三组最高档连乘」的说明，结算文案函数明确不使用 fan_point 计算，最终倍数完全取服务端下发的 fan_point（source-code/client/Code/layer/BoxHzmjTipAniView.ts:1101、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1102、source-code/client/Code/config/FanDefine.ts:362、source-code/client/Code/config/GameSoundConfig.ts:505、source-code/client/Code/config/GameSoundConfig.ts:506、source-code/client/Code/config/FanDefine.ts:12、source-code/client/Code/config/XsmjFanConfig.ts:4、source-code/client/Code/config/FanDefine.ts:353、source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:765）
  - 客户端实现：组合判定覆盖任意杠开档×财飘档，ResolveHzmjHuFanComboAni 对 2407+2404 等高阶组合同样返回 GANG_PIAO，FormatHzmjWinnerFanFlowText 在无 2419/2420 时把高档写成「杠飘（二连杠，双财飘）」形式的明细；客户端未定义杠爆/七客的独立番型 ID（HzmjFanType 中无对应枚举），符合不单列番型，但仍保留组合层表现：GANG_BAO（杠开×爆头）枚举、七客名称改写与七客文案分支（source-code/client/Code/config/FanDefine.ts:256、source-code/client/Code/config/FanDefine.ts:351、source-code/client/Code/config/FanDefine.ts:389、source-code/client/Code/layer/BoxHzmjTestView.ts:1400、source-code/client/Code/layer/BoxHzmjTestView.ts:1407、source-code/client/Code/config/FanDefine.ts:136、source-code/client/Code/config/FanDefine.ts:261、source-code/client/Code/config/FanDefine.ts:341、source-code/client/Code/config/FanDefine.ts:424、source-code/client/Code/config/GameSoundConfig.ts:443）
  - UI 交互：命中组合时胡牌走 KW_Ani_Hu 组合 skin（杠飘为 gp、飘杠为 pg），优先于单番节点，结算文案直接写「杠飘」或「飘杠」，对应音效 hu_20_gangpiao 与 hu_21_piaogang；高档组合仍播 gp/pg 组合动效与组合音效，结算文案为「杠飘（二连杠，双财飘）」
  - UI 交互：结算不单独显示 8 倍，只输出番型名与得分，匹配场才在流水后追加总倍数；好友房小结算只展示番型文案与输赢分，不展示连乘过程与分项倍数；若服务端下发杠开×爆头，客户端播 KW_Ani_Hu skin=gb 与音效 hu_11_gangbao；七对系×爆头/财飘则显示七客/豪华七客文案并走 qk/hhqk 等 skin

### 吃碰禁手

吃或碰成立后，同牌面的手牌全部禁打，直到本次限制解除。
  - 客户端实现：GamePlayLmtsCmd 缓存 MsgPlayLmts.hands，BoxHzmjPlayerHandCards.applyPlayLmtsGray 遍历全部手牌位，按牌值 indexOf 命中即禁打，同牌值的多张手牌会一起被禁；GameData 长期缓存 _playLimitMahs/_playLimitDanFang，GamePowerCmd 每次本家获得出牌权（POWER_ID_PLAY）时重新下发 onPlayLmtsUpdate 重刷灰态，直到收到空包才 clearPlayLimitMahs（source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:105、source-code/client/Code/data/GameData.ts:1603、source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:37、source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:99）
  - UI 交互：被禁牌以灰色显示并置为不可点击；每次进入本家出牌阶段都会重新把禁张牌压暗。

- 用间隔一张的两张吃中间张：只禁被吃的那一张。用 1、3 吃 2，禁打 2。
  - 待确认：客户端代码未找到对应实现
- 用相邻两张吃一端：禁打这两张在 1 至 9 内两端能接成顺子的牌。用 2、3 吃 1 或吃 4，都禁 1 和 4。用 1、2 吃 3，只禁 3。
  - 待确认：客户端代码未找到对应实现
- 碰成立后，禁打与被碰牌相同的牌。
  - 待确认：客户端代码未找到对应实现

手上两张相差 1 时，禁吃进的那张和另一侧延伸的那张。1、9 外侧不是牌，实际只禁吃进的一张。相差不是 1 时，只禁吃进的那张。只按最终选定的一组写禁张。吃完后剩余手牌全部落在禁张里的吃法不能吃，本家提示「吃禁手规则生效中」。禁张不含财神，吃完仍可打财神。
  - 客户端实现：多吃时客户端弹组合选择池，_chooseChi 记录最终选中的一组，onBtnChooseChi 只取该组 GameData.getChowCombInfo(this._chooseChi) 并通过 sendChow 提交 MsgChowC，不提交其他候选组（source-code/client/Code/layer/BoxHzmjMainView.ts:1098、source-code/client/Code/controller/gameController.ts:491）
  - UI 交互：存在多组吃法时显示 ChooseGang 组合选择池，点击某一组才提交。
  - 客户端实现：客户端不做吃法过滤，吃按钮与吃组合数量全部统计服务端下发的 power.combs 中 CMF_CHOW 项（_updateChiPower），服务端不给该吃法时客户端不会出现对应入口；GameNotifyInfoCmd 收到 NIF_EX_CHOW_FORBID_NO_PLAY(9) 且座位为本家时，派发 onShowTextTimeTips 显示固定文案，时长 1.3 秒（source-code/client/Code/layer/BoxHzmjMainView.ts:626、source-code/client/Code/controller/cmd/gameCmd/GameNotifyInfoCmd.ts:58、source-code/client/Code/config/GameDefine.ts:469、source-code/client/Code/layer/BoxHzmjTipAniView.ts:852）
  - UI 交互：吃法被拦截时【吃】按钮与组合池不出现；本家界面中部显示文字提示 1.3 秒后自动收起，简洁模式与复盘模式下不显示。
  - 待确认：客户端代码未找到对应实现

禁打牌压暗，牌面仍可辨认，只在本家界面显示。这些牌仍能提起，也能横滑出虚影。单击、双击或松手打出时弹出「该牌被禁打」，牌不进牌河。其他家只看到牌背。
  - 客户端实现：BoxHzmjPlayerHandCards.applyPlayLmtsGray 对命中禁张的手牌调用 Mah2DBase.setMahColor(item, MahColor.gray) 改色，未遮挡牌面，未命中的牌恢复 _resolveMahColor 原色；GameData.hasPlayLimit 要求 _playLimitSeat === SELF_LOCAL_SEAT 才成立，GamePlayLmtsCmd 也只在 localSeat 为本家时派发 onPlayLmtsUpdate，GamePowerCmd 对他人座位直接派发 onClearGray，不做限制灰化（source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:109、source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:77、source-code/client/Code/data/GameData.ts:1779、source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:101、source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:46）
  - UI 交互：禁张手牌整体呈灰色，图案与数字仍可见；他家手牌保持牌背显示，无灰化差异。
  - 客户端实现：手牌控件构造时传入 KW_Ghost_Hand 作为拖拽虚影节点，具备横滑虚影能力；但 applyPlayLmtsGray 对禁打牌直接设置 item.touchable = false，触摸被整体禁用（source-code/client/Code/layer/BoxHzmjMah2DView.ts:137、source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:108）
  - UI 交互：禁打牌无触摸响应，无法提起，也无法横滑出虚影。
  - 客户端实现：canPlayMahCheck 在 playCard 前调用 GameData.canPlayCard 校验并提示，onPlayMah 在落牌回调中再校验一次并提示，覆盖单击、双击与松手三种触发出牌路径；校验失败后立即 return，不派发 addPlayMah、不调用 GameController.sendPlay，resetCards 将手牌拉回原位、恢复 canPutCard 并重刷禁张灰态（source-code/client/Code/layer/BoxHzmjMainView.ts:1430、source-code/client/Code/layer/BoxHzmjMainView.ts:1432、source-code/client/Code/layer/BoxHzmjMainView.ts:1472、source-code/client/Code/layer/BoxHzmjMainView.ts:1474、source-code/client/Code/layer/BoxHzmjMainView.ts:1481）
  - UI 交互：本家界面显示「该牌被禁打」文字提示 1.3 秒；手牌回弹复位，牌河与出牌放大区均无该牌。

打出一张合法牌后，服务端清空禁张。同一回合再杠不清空。补进的牌若牌值仍在禁张里，也不能打。
  - 客户端实现：GamePlayCmd 出牌处理后不清本地禁张数据（注释明确由服务端空包/新包维护），只在画面侧派发 onClearGray；数据清空仍走 GamePlayLmtsCmd 的空包分支（source-code/client/Code/controller/cmd/gameCmd/GamePlayCmd.ts:72、source-code/client/Code/controller/cmd/gameCmd/GamePlayCmd.ts:122）
  - UI 交互：本家出牌后手牌灰态立即恢复常色。
  - 客户端实现：GameKongCmd 处理杠成立时只切牌桌状态、更新副露与播动画，全流程无任何出牌限制清理或灰态重置代码，禁张因此被保留（source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:33）
  - 客户端实现：applyPlayLmtsGray 把摸牌位（moCard 位置）视为单放，只用 dang_fang 判定禁打，其余手牌位才用 hands 判定；GameData.canPlayCard 同样按 isDanFang 分流校验（source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:100、source-code/client/Code/data/GameData.ts:1794）
  - UI 交互：补进的牌只有在 dang_fang 命中时才被压暗并不可点击。

### 出牌与响应

只有当前拿到出牌权、且目标牌可打的玩家能出牌。等待他人响应、正在选择组合、杠后尚未补牌或本小局已经结束时，不能出牌。
  - 客户端实现：摸牌命令给其他座位直接写入 POWER_ID_PLAY 权限；MainView 按 power 中的 PLAY 位置置 canPutCard，手牌触摸才可提起出牌（source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:70、source-code/client/Code/layer/BoxHzmjMainView.ts:536、source-code/client/Code/layer/BoxHzmjMainView.ts:556）
  - UI 交互：出牌权者手牌 canTouch/canPutCard 打开，可提牌、横滑、点击出牌；无出牌权时不能操作。
  - 客户端实现：canPlayMahCheck 在有吃碰杠胡按钮（C_BtnState 为 PENG_GANG_HU）时拦下出牌并弹提示；托管/权限为 NONE 时 canPutCard 直接置 false。杠后未补牌、小局结束没有独立的客户端守卫，依赖服务端不下发 PLAY 权限（source-code/client/Code/layer/BoxHzmjMainView.ts:1453、source-code/client/Code/layer/BoxHzmjMainView.ts:1643）
  - UI 交互：出牌被拦截时弹 MessageSimpleBoxListView 文本提示；托管时收起操作区。

- 弃牌可被吃、碰、直杠或点炮胡时，先裁决。成立后各端从牌河取走该牌，并清除它的浮标和放大显示。全部放弃则牌留在牌河，再轮到下家摸牌。
  - 客户端实现：客户端在收到吃/碰/杠/胡下行命令后才切表状态并播动作，无本地优先级裁决逻辑；等待期间保持对方弃牌状态（source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:32、source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:32）
  - UI 交互：裁决期间各端仅看到弃牌与响应按钮，动作成立后才播字效与牌组变化。
  - 客户端实现：setCombo 在副露带进牌时调用 outs[进牌座位].removeLastMah() 移除河牌；点炮胡在 setHu 中按 dfFrom 移除河牌最后一张；吃碰杠命令同时派发 onHidePutCardUi 收起出牌放大（source-code/client/Code/layer/BoxHzmjMah2DView.ts:892、source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:42、source-code/client/Code/layer/BoxHzmjMah2DView.ts:997）
  - UI 交互：牌河中该张消失，其他方位的出牌放大图（KW_ShowCard）同时隐藏。
  - 客户端实现：客户端不保留弃牌回收逻辑，弃牌持续留在 outs 牌河中；随后收到 MsgTake 由下家摸牌并写入 PLAY 权限（source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:70）
  - UI 交互：牌河保持该张，下家摸牌动画后出牌权转移。
- 【自摸】还在，或本次杠提示必须先过时，双击或滑动出牌会被拦住，只在本家显示「点“过”才能出牌」。须先点【过】。例外：可杠的只是摸牌或补牌之前已经拿在手里的暗杠，可以直接出牌。碰之后又能杠的，仍须先过。
  - 客户端实现：canPlayMahCheck 检测 power 含 HU/KONG/PONG/CHOW 且按钮态为 PENG_GANG_HU 时返回 false，并弹出文本提示；只有本家会走到该分支（source-code/client/Code/layer/BoxHzmjMainView.ts:1453、source-code/client/Code/layer/BoxHzmjMainView.ts:1455）
  - UI 交互：本家弹出 MessageSimpleBoxListView 提示「点“过”才能出牌」，最长显示 3 秒，牌不落河。
  - 客户端实现：_updateGangOffMoCard 判定：有杠权限、无胡权限、存在摸牌位牌且所有可杠组合都不含该摸牌值时，_isGangOffMoCard 置真；随后 _updatePowerGray 直接清灰并允许出牌（source-code/client/Code/layer/BoxHzmjMainView.ts:697、source-code/client/Code/layer/BoxHzmjMainView.ts:713）
  - UI 交互：手牌不做压暗，不点【过】也能提牌出牌。
  - 客户端实现：碰后摸牌位为空（moCard=0），_updateGangOffMoCard 直接 return 使 _isGangOffMoCard 保持 false，因此仍走「必须先点过」的拦截分支（source-code/client/Code/layer/BoxHzmjMainView.ts:696）
  - UI 交互：与自摸提示一致，本家弹「点“过”才能出牌」。
- 点【过】只放弃这一次提示，收起本次按钮和预览。之后别人再打出相同牌，按新弃牌重新判断。放弃杠后，同一次操作机会内不再出现【杠】；下一次拿到操作机会再判断。
  - 客户端实现：onBtnGuo 发 MsgCancel，按钮态置 EMPTY，隐藏多组选择面板，清 selectChiCb 与权限压暗后按禁手重压（source-code/client/Code/layer/BoxHzmjMainView.ts:1236）
  - UI 交互：吃碰杠胡按钮整组退场，候选牌面板收起，手牌恢复可触摸但保留禁手灰。
  - 客户端实现：每次弃牌后服务端重新下发 MsgPower，客户端 setPower 全量重算按钮与压暗，不复用上一次的放弃结果（source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:71）
  - UI 交互：新一轮按钮与压暗按新权限重新出现。
  - 待确认：客户端代码未找到对应实现
- 有操作资格的玩家在自己手牌右上方看到对应按钮和【过】。按钮从左到右为【吃】【碰】【杠】【胡】，蓝色【过】固定在最右，只显示本次可做的项。【胡】或【自摸】左侧显示胡牌张和预览倍数。各端使用同一个响应倒计时，归零后按钮仍可点。
  - 客户端实现：每位玩家各有一组 KW_BTN_PGs_N 按钮容器，本家为 KW_BTN_PGs_0，仅本家有吃/碰/杠/胡/过/取消按钮，其他座位容器默认不可见（source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:70）
  - UI 交互：本家手牌上沿偏右出现按钮组，其他玩家只播字效不显示按钮。
  - 客户端实现：setPower 按 power 位分别为 Chi/Peng/Gang/Hu/Guo/Guo2 设 visible，只显示本次可做的项；Handler 中同组按水平顺序布局（source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:21、source-code/client/Code/layer/BoxHzmjMainView.ts:578）
  - UI 交互：按钮自左向右依次为吃(1250)、碰(1440)、杠(1630)、胡(1820)、过(2338)、过2(2528)，隐藏项不占位。
  - 客户端实现：_updateHuPower 用 PowerData.hu_mah 填胡牌张牌面、hu_point 拼「N倍」写到倍数文本；胡牌张与倍数节点在按钮左侧（source-code/client/Code/layer/BoxHzmjMainView.ts:664、source-code/client/Fgui/assets/box_hzmj_main/component/HuActionBtn.xml:6）
  - UI 交互：胡按钮左侧显示一张牌面与「N倍」文本，封顶标记默认隐藏。
  - 客户端实现：倒计时数值取自服务端下发权限时的剩余秒数，客户端本地递减显示；归零分支只把数字写成「00」并停表，不禁用按钮也不收起按钮（source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:83、source-code/client/Code/layer/BoxHzmjMah2DView.ts:711）
  - UI 交互：桌面中央倒计时归零显示「00」，按钮保持可点，客户端无超时自动过或自动出牌。
- 能胡时整手保持正常亮度。不能胡时，只有参与当前吃、碰、直杠的牌保持亮度，其余压暗。压暗只在该玩家本端显示。本次新摸入或补入的牌能组成暗杠或加杠，且同次无胡时，参与任一合法杠的手牌保持亮度，其余压暗。可杠组只由原有的牌组成时，手牌保持当前亮度。
  - 客户端实现：_updatePowerGray 在 powerState.showHu 为真时直接 onClearGray，清空灰度并恢复全部牌可触摸（source-code/client/Code/layer/BoxHzmjMainView.ts:718）
  - UI 交互：手牌不压暗，全部牌面正常亮度。
  - 客户端实现：_collectPowerBrightMahs 汇总 CHOW 的全组牌值与 PONG/MKONG/CKONG/TKONG 的牌值，_setHandGrayExceptGroup 把这些牌之外的牌值置灰；其他座位在 GamePowerCmd 中直接 onClearGray（source-code/client/Code/layer/BoxHzmjMainView.ts:752、source-code/client/Code/layer/BoxHzmjMainView.ts:783、source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:102）
  - UI 交互：本家参与操作的牌面正常，其余手牌变灰（MahColor.gray）；别家手牌不受影响。
  - 客户端实现：_collectPowerBrightMahs 的杠分支把每个杠组合的 mahs[0] 加入亮牌值，_setHandGrayExceptGroup 保留该牌值全部张数亮起；走该分支的前提是 showHu 为假（source-code/client/Code/layer/BoxHzmjMainView.ts:757）
  - UI 交互：杠牌对应的四张同值手牌保持亮度，其他手牌压暗。
  - 客户端实现：_isGangOffMoCard 命中（摸牌位牌不参与任何杠）时 _updatePowerGray 早退 onClearGray 并清 selectChiCb，不做任何压暗（source-code/client/Code/layer/BoxHzmjMainView.ts:713）
  - UI 交互：手牌保持原有亮度，不吃碰杠候选压暗。
- 较低优先级先提交时，本端收起自己的按钮并等待。更高优先级成立后，结束等待并取消该请求。更高优先级都放弃后，再执行已经提交的较低优先级请求。
  - 客户端实现：发送吃/碰/杠请求后立即把 C_BtnState 置 EMPTY 并清压暗，进入等待服务端结果状态，无专门等待面板（source-code/client/Code/layer/BoxHzmjMainView.ts:1102）
  - UI 交互：请求提交后按钮组与候选面板立即收起，手牌恢复常态。
  - 待确认：客户端代码未找到对应实现
  - 待确认：客户端代码未找到对应实现
- 多种吃法：点【吃】后，在手牌上方展开可选顺子，每组三张正面、按牌面从小到大，右侧为【取消】。原【吃】【过】退场，手牌恢复常态亮度。倒计时归零后面板仍可操作。点【取消】等于放弃自己对这张弃牌的全部操作，包括同时存在的胡。选中一组即提交。
  - 客户端实现：showMoreChiComb 在 KW_GangGrps 内动态创建 ChooseGang 选项并补足三张牌槽，_fillChiChooseMahs 逐槽填牌面；组合顺序直接用服务端 comb.mahs，未在本地按牌面排序；【取消】是独立按钮节点，不在选项池内（source-code/client/Code/layer/BoxHzmjMainView.ts:865、source-code/client/Code/layer/BoxHzmjMainView.ts:1031、source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:30）
  - UI 交互：手牌上方横向排布多组三张顺子，选项外另有【取消】按钮。
  - 客户端实现：showChooseChi(true) 把 C_BtnState 切到「选择多杠」页并清空手牌灰度；吃/过按钮只在「碰杠胡」页显示，因此退场（source-code/client/Code/layer/BoxHzmjMainView.ts:1119、source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:31）
  - UI 交互：吃、过按钮消失，改为候选顺子与【取消】，手牌回到常态亮度。
  - 客户端实现：倒计时归零只停表并显示「00」，选择面板的 touchable 与点击回调不受时间限制，客户端无超时收起逻辑（source-code/client/Code/layer/BoxHzmjMah2DView.ts:710）
  - UI 交互：倒计时为「00」时顺子选项与【取消】仍可点。
  - 客户端实现：onBtnCancel 收起吃/杠面板后调用 onBtnGuo，统一上行 MsgCancel，等于放弃本次弃牌的全部操作（含胡）（source-code/client/Code/layer/BoxHzmjMainView.ts:1177）
  - UI 交互：面板收起、按钮退场。
  - 客户端实现：选项点击回调把当前索引写入 _chooseComb，转成 _chooseChi 后调用 onBtnChooseChi，取 GameData.getChowCombInfo 并 sendChow 提交（source-code/client/Code/layer/BoxHzmjMainView.ts:1113、source-code/client/Code/layer/BoxHzmjMainView.ts:1102）
  - UI 交互：点一组顺子立即提交，面板与按钮收起。
- 多种暗杠或加杠：点【杠】后收起【杠】【过】，横向排列候选牌，最右为【取消】。暗杠与加杠混排，顺序为万、条、筒、东、南、西、北、中、发、白，同花色按点数升序。倒计时归零后仍可选择。点【取消】等于放弃本次行牌机会里的全部操作，包括同时存在的自摸。点一张候选牌只提交对应的一组。只有 1 组时，点【杠】直接提交。
  - 客户端实现：showChooseGang 切到「选择多杠」页使杠/过按钮退场，showMoreGang 用 KW_GangGrpList 横向列表渲染候选牌并绑定点击；列表 align=right 贴右排布，【取消】为独立按钮（source-code/client/Fgui/assets/box_hzmj_main/component/GangGrps.xml:4、source-code/client/Code/layer/BoxHzmjMainView.ts:1170）
  - UI 交互：候选牌横向排列，另有【取消】按钮。
  - 待确认：客户端代码未找到对应实现（showMoreGang 直接按 MsgPower.combs 顺序渲染，客户端未做花色/点数排序）
  - 客户端实现：倒计时归零仅停表显示「00」，候选列表保持 touchable，无超时关闭逻辑（source-code/client/Code/layer/BoxHzmjMah2DView.ts:710）
  - UI 交互：「00」状态下候选项仍可点。
  - 客户端实现：onBtnCancel 关闭杠面板后调用 onBtnGuo 上行 MsgCancel，放弃本次全部操作（source-code/client/Code/layer/BoxHzmjMainView.ts:1176）
  - UI 交互：面板收起、按钮退场。
  - 客户端实现：列表 CLICK_ITEM 回调把点击索引写入 _chooseGang 后调用 onBtnChooseGang，取 GameData.getKongCombInfo(_chooseGang) 精确提交该组（source-code/client/Code/layer/BoxHzmjMainView.ts:851、source-code/client/Code/layer/BoxHzmjMainView.ts:1150）
  - UI 交互：点某张候选即提交该组杠并收起面板。
  - 客户端实现：onBtnGang 在 _chooseGangLength > 1 时才展开候选面板，否则直接 onBtnChooseGang 提交第 0 组（source-code/client/Code/layer/BoxHzmjMainView.ts:1140）
  - UI 交互：单击【杠】立即生效，不出现候选面板。
- 点炮、抢杠的按钮文案是「胡」，自摸是「自摸」。没有单独的抢杠按钮。过和过2都显示「过」。过上行放弃；过2只在本地收起按钮并清掉本次压暗，再按禁手重新压暗，不上行。多组吃、杠的取消等于上行过。
  - 客户端实现：_getHuActionSkinName 按 hu_type 选皮肤：HT_DISCARD、HT_ROBKONG 用 "hu"，其余用 "zimo"（source-code/client/Code/layer/BoxHzmjMainView.ts:670、source-code/client/Code/config/GameDefine.ts:427）
  - UI 交互：胡牌按钮上播放「胡」或「自摸」字效 skin。
  - 客户端实现：按钮容器只有 Chi/Peng/Gang/Hu/Guo/Guo2/Cancel/Bao_Ting，抢杠胡复用同一个【胡】按钮并通过 hu_type 区分文案（source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:15）
  - UI 交互：界面不存在抢杠专用按钮。
  - 客户端实现：initSkin 把 KW_BTN_Guo 与 KW_BTN_Guo2 的 KW_Ani.skinName 都设为 "guo"（source-code/client/Code/layer/BoxHzmjMainView.ts:319）
  - UI 交互：两个按钮外观完全一致，均显示「过」。
  - 客户端实现：onBtnGuo 调 sendCancel 上行；onBtnGuo2 注释标明「CANCEL_C：本地取消操作按钮，无需回包」，只切按钮态、收起面板并 _clearPowerHandGray（先清权限灰再按禁手重压）（source-code/client/Code/layer/BoxHzmjMainView.ts:1245、source-code/client/Code/layer/BoxHzmjMainView.ts:1262）
  - UI 交互：过2 点下按钮组收起、手牌恢复常态/禁手灰，服务端无请求。
  - 客户端实现：onBtnCancel 依次关闭吃/杠选择面板后直接调用 onBtnGuo，走与【过】相同的上行 MsgCancel 流程（source-code/client/Code/layer/BoxHzmjMainView.ts:1174）
  - UI 交互：【取消】点下后面板收起并发送过，按钮整组退场。
- 有杠、没有胡，且所有可杠牌都不是刚摸的那张时，手牌不压暗，不点过也能出牌。
  - 客户端实现：_isGangOffMoCard 命中后 _updatePowerGray 走 onClearGray 清掉权限压暗，canPlayMahCheck 因 _isGangOffMoCard 跳过拦截（source-code/client/Code/layer/BoxHzmjMainView.ts:701、source-code/client/Code/layer/BoxHzmjMainView.ts:714）
  - UI 交互：手牌保持常态亮度，【杠】【过】按钮仍显示，可直接提牌出牌。
- 打出后听任意一张时，听牌详情固定为「爆头2番」「摸任意一张可胡」。候选牌是财神时听牌标为飘，否则为爆。同一手只要有一张这样，其余可听牌只留箭头。
  - 客户端实现：TingPaiView 检测到任意牌哨兵（0x7F/0xFF）即切到爆头页，只渲染一张爆头卡并把胡数文本改为「胡」；爆头卡两行文案由 TingCard 预设（source-code/client/Fgui/assets/box_hzmj_tingPai/component/TingCard.xml:24、source-code/client/Fgui/assets/box_hzmj_tingPai/component/TingCard.xml:27、source-code/client/Code/layer/BoxHzmjTingPaiView.ts:50）
  - UI 交互：听牌列表切为单张「爆头」卡，显示「爆头2番」「摸任意一张可胡」。
  - 客户端实现：showTingArrow 判断该牌打出后是否万能听；是则按该牌值是否等于 jokerMah 选 TingType.TYPE_PIAO 或 TYPE_BAO（source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:193）
  - UI 交互：手牌上打出财神（听任意牌）显示「飘」标记，其他万能听显示「爆」标记。
  - 客户端实现：showTingArrow 先扫描是否存在任意牌听（hasBaoOrPiao），存在时其余可听牌统一用 TingType.TYPE_COMMON 普通箭头（source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:176、source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:200）
  - UI 交互：有飘/爆的手牌只显示普通听牌箭头，不再显示大/多/优等强化箭头。
- 吃成立后，碰杠区新增一组正面顺子，按点数从小到大摆放。以吃牌者视角，来源箭头「←」叠在吃到的那张牌上。
  - 客户端实现：GameChowCmd 调用 PlayerCardsData.setCombo 生成副露数据并派发 setCombo，Mah2DView 在对应座位 combo 区 addCombo；牌面朝向与组内排序由 Mah2DCombo_Box 组件处理，仓库内无排序代码（source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:48、source-code/client/Code/layer/BoxHzmjMah2DView.ts:895）
  - UI 交互：碰杠区多出一组三张正面顺子。
  - 客户端实现：_refreshComboArrows 取副露项内 n4/n5 箭头节点，按进牌在展示序中的实际槽位（_resolveInMahSlot）相对中间槽位移位，使箭头指向吃到的那张（source-code/client/Code/layer/BoxHzmjMah2DView.ts:938、source-code/client/Code/layer/BoxHzmjMah2DView.ts:947）
  - UI 交互：副露顺子上方的箭头偏移到被吃牌那张的正上方。
- 碰成立后，碰牌组三张都正面展示。以来源视角，箭头叠在中间一张：上家←、对家↑、下家→。吃、碰、直杠、暗杠的新牌组按成立顺序从左往右追加。
  - 客户端实现：GamePungCmd 生成副露数据后派发 setCombo，Mah2DView 调 addCombo 并重刷箭头；三张正面由副露组件按组合类型渲染（source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:48）
  - UI 交互：碰杠区出现三张正面同值牌。
  - 客户端实现：_resolveInMahSlot 在碰（无进牌槽位或进牌即中间槽）时返回 1，箭头保持落在中间那张；箭头图形本身随座位副露组件资源不同（n4/n5），方向由资源包决定（source-code/client/Code/layer/BoxHzmjMah2DView.ts:960、source-code/client/Code/layer/BoxHzmjMah2DView.ts:935）
  - UI 交互：碰牌组箭头始终叠在中间张，不同来源座位使用不同朝向箭头。
  - 客户端实现：新组合统一走 addCombo 追加，组合数组顺序来自服务端 combs/结算数据；左右排列由副露组件的列表布局决定（source-code/client/Code/layer/BoxHzmjMah2DView.ts:878）
  - UI 交互：碰杠区按先后顺序依次增加牌组。
- 直杠用来源箭头，加杠标记为【补】，暗杠用手掌标记。标记都叠在杠牌组最上方居中的第 4 张。直杠、暗杠在碰杠区新增一组；加杠补入原碰牌组，沿用原位置。补牌落入最右分隔位，可与「杠」字同时出现。连续杠时，新的「杠」字覆盖仍在播放的上一个。
  - 客户端实现：杠类型由 MsgKongS 的 comb.flag（MKONG/CKONG/TKONG）区分并驱动牌组更新，标记图形与第 4 张叠放位置由 Mah2DCombo_Box 组件实现（source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:63、source-code/client/Code/layer/BoxHzmjMah2DView.ts:910）
  - UI 交互：杠组上方居中出现来源箭头/【补】/手掌标记。
  - 客户端实现：GameKongCmd 对 TKONG 派发 setComboBuGang（携带 comboData.nIdx 原组索引）走补入原组；MKONG/CKONG 派发 setCombo 走新增一组（source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:64、source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:72）
  - UI 交互：补杠时原碰牌组变为四张杠组位置不变；直杠/暗杠在末尾新增一组。
  - 客户端实现：摸牌/补牌统一走 setTakeMah → moMah，末张以「单放」位渲染；isTouchDanFang 用 moCard 判定该末张是否为真单放，说明补牌固定落在手牌最右的独立分隔槽（source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:123）
  - UI 交互：补牌出现在手牌最右侧分隔位置；与「杠」字同屏显示未单独判断。
  - 客户端实现：字效按座位单节点复用，每次动作直接改写同一节点的 skinName/url 并置 visible，再播 Spine 动画，因此新杠字共用节点覆盖旧表现（source-code/client/Code/layer/BoxHzmjTipAniView.ts:524）
  - UI 交互：同一方位不会叠加两个「杠」字。
- 吃、碰、杠、胡成立时，在操作者对应方位播放对应字效。自摸确认后显示「对局结束」并亮出各家手牌，胡牌张单独摆在胡牌者手牌右侧。点炮胡、抢杠胡同样显示「对局结束」和亮牌；胡牌张在胡牌者手牌尾端，带浅绿描边和来源箭头。赢家方位显示番型，放铳者方位显示「点炮」。随后按座位飘分，正分黄色，负分灰色。
  - 客户端实现：onMsgPlayPengGang 按 ActionAniType 选 chi/peng/gang/piao 皮肤在 _pengGangAni[座位] 节点播放；胡牌走 onMsgPlayHuNew/KW_Ani_Hu 按番型选 hu/zimo 皮肤（source-code/client/Code/layer/BoxHzmjTipAniView.ts:496、source-code/client/Code/layer/BoxHzmjTipAniView.ts:984）
  - UI 交互：字效出现在操作者座位对应方位的节点上，带对应音效。
  - 客户端实现：MsgResultHu 时派发 onShowGameEndType 显示结束标识，并派发 playHuEnd 把手牌全部翻开、胡牌张 push 到手牌末尾展示；本家手牌缩小靠左（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:303、source-code/client/Code/layer/BoxHzmjMah2DView.ts:1057、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1186）
  - UI 交互：各座位亮牌，本家手牌缩放让位；结束标识在桌面中央播一次。
  - 客户端实现：setHu 把手牌与胡牌张合并重置并设置胡牌来源座位 setHuFromSeat；点炮时移除放铳方河牌最后一张，牌河浮标由 outs 组件管理（source-code/client/Code/layer/BoxHzmjMah2DView.ts:984、source-code/client/Code/layer/BoxHzmjMah2DView.ts:987）
  - UI 交互：胡牌张显示在手牌尾端并标记来源方位；浅绿描边属牌面组件资源，仓库内无对应常量。
  - 客户端实现：桌面方位标识由 onShowResultTableSign 按 ResultTableSign（未叫嘴/叫嘴/点炮/吃胡/自摸）切 HuIndex 控制器页；番型文案在小结算流水与 CPS 动画里展示（source-code/client/Code/layer/BoxHzmjMainView.ts:1667、source-code/client/Fgui/assets/box_hzmj_main/component/HuIndex.xml:3、source-code/client/Code/config/GameDefine.ts:413）
  - UI 交互：胡牌者方位显示自摸/吃胡图，放铳者方位显示「点炮」图标。
  - 客户端实现：onShowScore 按分数正负切换数字字体：score>=0 用 fnt_win，否则用 fnt_lose；正分在完整动画时补「+」号，逐座位在 _resultScoreNode 上播放（source-code/client/Code/layer/BoxHzmjTipAniView.ts:567、source-code/client/Code/layer/BoxHzmjTipAniView.ts:565）
  - UI 交互：各座位飘分数字正分为黄色字效、负分为灰色字效，带飘出动画。

## 三摊承包

只统计吃牌。A 吃 B 的牌，A 对 B 加 1 摊。
  - 客户端实现：客户端不在本地统计摊：吃牌由 GameChowCmd 处理副露、手牌扣减与动作动画，摊数完全由服务端 MsgTanUpdate 下发后整体写入 GameData._tanItems（source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:43；source-code/client/Code/controller/cmd/gameCmd/GameTanUpdateCmd.ts:20；source-code/client/Code/config/MatchTipConfig.ts:23）
  - UI 交互：吃牌时在吃牌方播放 TYPE_CHOW 动作动效；桌面无摊数展示
  - 客户端实现：客户端以有向摊项（from_seat 被吃方 → to_seat 吃牌方，tan_count）存储服务端下发结果，自身不执行 +1 计算（source-code/client/Code/controller/cmd/gameCmd/GameTanUpdateCmd.ts:15；source-code/client/Code/lib/proto_game_hzmj.d.ts:3785；source-code/client/Code/data/GameData.ts:1670）

- 只有庄家和闲家之间能承包。两名闲家之间，同一方向最多 2 摊，吃一成立就加 1。已经有 2 摊时，再吃这一家的牌不成立，不给出【吃】。与飘财无关。两个方向分开计。
  - 客户端实现：客户端不做庄闲过滤，结算时直接遍历 bao_settles 并按 from_seat 挂角标；是否庄闲由服务端筛选（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:206；source-code/client/Code/lib/proto_game_hzmj.d.ts:5222）
  - 客户端实现：客户端无本地 2 摊上限判断；吃牌权限来自 MsgPower，客户端只按权限位渲染按钮（source-code/client/Code/layer/BoxHzmjMainView.ts:552；source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:71）
  - UI 交互：【吃】按钮显隐由 POWER_ID_CHOW 位决定
  - 客户端实现：客户端没有基于摊数过滤【吃】的逻辑，只按 MsgPower 的 CHOW 位显示/隐藏 KW_BTN_Chi（source-code/client/Code/layer/BoxHzmjMainView.ts:578；source-code/client/Code/layer/BoxHzmjMainView.ts:549）
  - UI 交互：服务端不下发 CHOW 位时，吃按钮不显示
  - 客户端实现：摊与飘是两条独立链路：MsgTanUpdate 写 GameData._tanItems，MsgPiao 写 GameData._piaoCounts，互不读取（source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts:21；source-code/client/Code/data/GameData.ts:1600；source-code/client/Code/controller/cmd/gameCmd/GameTanUpdateCmd.ts:21）
  - UI 交互：飘计数走 onPiaoState 播飘动作；摊更新不触发任何飘表现
  - 客户端实现：TanItem 以 from_seat/to_seat 有向对表达摊数，同一对玩家的两个方向各自独立成项；结算角标同样按 from_seat 单向判定（source-code/client/Code/lib/proto_game_hzmj.d.ts:3787；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:212）
  - UI 交互：结算行承包角标只挂在 from_seat（承包方）所在座位

- 某一方向计到第 3 摊时记承包，四端播放「三摊落地」，可与吃牌字效同时显示。不等到结算，当时没有承包角标。提示期间，获权玩家可以继续提牌、出牌。
  - 客户端实现：GameTanUpdateCmd 遍历下发摊项，tan_count === 3 时派发 onSanTanLuoDi 事件触发落地动画；承包关系字段 bao_relation 在客户端未被读取使用（source-code/client/Code/controller/cmd/gameCmd/GameTanUpdateCmd.ts:24；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1654）
  - UI 交互：达到 3 摊时播放三摊落地 Spine（受简洁模式/复盘抑制）
  - 客户端实现：onSanTanLuoDi 计算了 localSeat（toSeat 的本地座位）但未使用，只把固定中央节点 KW_Ani_Stld 置可见并播放 spine，播完隐藏（source-code/client/Code/layer/BoxHzmjTipAniView.ts:1660；source-code/client/Fgui/assets/box_hzmj_tipAni/component/HzmjTipAniComponent.xml:118）
  - UI 交互：三摊落地 Spine 在屏幕中央单点播放，非四端；simpleMode 或复盘模式直接跳过
  - 客户端实现：三摊落地由 MsgTanUpdate 独立驱动，吃牌字效由 CPG 动画节点驱动，两者互不关闭（source-code/client/Code/layer/BoxHzmjTipAniView.ts:1662；source-code/client/Fgui/assets/box_hzmj_tipAni/component/HzmjTipAniComponent.xml:8）
  - UI 交互：KW_Ani_Stld 与 KW_Ani_CPG_0 至 KW_Ani_CPG_3 为并列节点，可同时可见
  - 客户端实现：onTanUpdate 只打日志，不刷新任何桌面 UI；承包角标 C_ChengBao 只存在于小结算 ResultItem，由 bao_settles 驱动（source-code/client/Code/layer/BoxHzmjTipAniView.ts:1790；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:195）
  - UI 交互：桌面阶段无摊数/承包角标；结算行才出现承包或反承包角标
  - 客户端实现：三摊落地播放期间没有任何输入锁或禁用逻辑，动画结束回调只隐藏节点（source-code/client/Code/layer/BoxHzmjTipAniView.ts:1654）
  - UI 交互：提示为纯表现层 Spine，不遮挡操作区，也不压暗按钮

自摸只结算胡牌方自己参与的承包对。摊方胡，对方付三家输分合计；被摊方胡，摊方付该合计的 2 倍。双向都满 3 摊时只按倒承包的 2 倍，不两笔叠加。
  - 客户端实现：客户端不筛选参与方，直接把 bao_settles 全部渲染，涉及哪些座位完全取决于服务端下发条目（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:206；source-code/client/Code/util/BoxHzmjFlowUtil.ts:427）
  - UI 交互：每座位最多一个承包角标；赢家流水追加承包文案
  - 客户端实现：结算按 BaoSettleItem.relation=1 在 from_seat（付款方）挂承包角标，金额取服务端 score；客户端不计算合计（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:212；source-code/client/Code/util/BoxHzmjFlowUtil.ts:432；source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:92）
  - UI 交互：结算行显示 tip_chengbao 角标，赢家行流水文案为“承包”
  - 客户端实现：relation=2 时同一 from_seat 显示反承包角标，流水文案为“反承包”，金额取服务端 score（已含 2 倍）（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:212；source-code/client/Code/util/BoxHzmjFlowUtil.ts:429；source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:17）
  - UI 交互：显示 tip_fanchengbao 角标与“反承包”流水文案
  - 客户端实现：无本地优先级判断；结算角标为单控制器单索引，只显示首个匹配关系（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:207；source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:17）
  - UI 交互：同一座位只出现一个角标（承包或反承包），不会同时显示两个

点炮只在放铳者本人是承包对方时改写，基数是原来那一笔点炮分，不是三家之和。别人的承包关系不赔，放铳者仍按原点炮付。抢杠胡不替换杠牌者的赔付，承包额再叠加。杠牌者若同时是承包方，两笔都付。
  - 客户端实现：客户端结算展示不区分自摸与点炮，统一按 bao_settles 的 from_seat 挂角标、按 win_lost 显示分数（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:195；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:66）
  - UI 交互：点炮与自摸使用同一套承包角标与流水展示
  - 待确认：客户端代码未找到对应实现
  - 客户端实现：流水拼装时先把承包分从赢家 win_lost 总分中剔除再生成胡分条目，随后单独追加承包流水，形成“胡分 + 承包分”叠加展示（source-code/client/Code/util/BoxHzmjFlowUtil.ts:373；source-code/client/Code/util/BoxHzmjFlowUtil.ts:47）
  - UI 交互：赢家流水同时出现番型文案与“承包/反承包”文案
  - 客户端实现：同一座位可同时有胡分流水与承包流水；扣分总额只体现在 win_lost 一个数上，客户端不拆分（source-code/client/Code/util/BoxHzmjFlowUtil.ts:373；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:152）
  - UI 交互：该座位结算行只显示一个承包角标与合并后的得分

- **承包**：A 对 B 已成立，A 自摸。B 支付三家原应赔分的合计 S，另外两家本局 0 分。
  - 客户端实现：BaoSettleItem 的 from_seat/to_seat/score 直接映射到结算行角标与赢家流水，S 由服务端给出（source-code/client/Code/lib/proto_game_hzmj.d.ts:5222；source-code/client/Code/util/BoxHzmjFlowUtil.ts:443）
  - UI 交互：from_seat 行显示承包角标，赢家行流水显示“承包”金额
- **反承包**：同一关系下 B 自摸。A 支付 2 × S。S 是 B 这次自摸原本向三家应收的合计。
  - 客户端实现：relation=2 映射为 tip_fanchengbao 角标与“反承包”流水，扣分数值取服务端 score（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:212；source-code/client/Code/util/BoxHzmjFlowUtil.ts:429）
  - UI 交互：反承包角标与“反承包”流水文案
- **链式**：A 对 B 成立，同时 C 对 A 成立，A 自摸。B 付 S，C 付 2 × S，A 实收 3 × S，第四家 0 分。
  - 客户端实现：流水对 bao_settles 每条关系都生成一条记录并挂到赢家（优先 to_seat，缺省挂所有赢家），多条可同时存在；角标按 from_seat 各自显示（source-code/client/Code/util/BoxHzmjFlowUtil.ts:434；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:212）
  - UI 交互：赢家流水可同时出现“承包”和“反承包”两行，付款两家各挂对应角标

例：庄家平胡自摸，三名闲家各应赔 8，S = 24。承包方付 24。若同时存在上家对庄家的承包，上家再付 48，庄家得 72。
  - 待确认：客户端代码未找到对应实现

例：庄家对闲家成立承包，闲家平胡自摸，三家原应赔 8、1、1。庄家按反承包付 20。
  - 待确认：客户端代码未找到对应实现

## 算分

原应赔分 = 底分 × 番型倍数 × 这一笔的庄闲倍数。底分为 1。赢家和这一笔的赔付者有一方是庄家，庄闲倍数为 8；两边都是闲家，为 1。无封顶。番型倍数取三组连乘后的结果。杠飘、飘杠的 8 倍已经替换掉杠上开花和财飘，再乘基础番。
  - 客户端实现：不计算原应赔分，单局得失分直接取 MsgResultHu.win_losts[].score，GameResultHuCmd 将其按本地座位写入桌面飘分数据；仅在听牌收益预估中用 totalScore += cnt × baseScore × fan 近似底分乘番型（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:198、source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:209、source-code/client/Code/data/GameData.ts:480、source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:365）
  - UI 交互：结算行 KW_Score 显示服务端下发的 ±分数，正分用 win 字效、负分用 lose 字效；桌面按座位逐个弹飘分。
  - 客户端实现：听牌收益预估把底分硬编码为 1；结算底分则取自 MsgStartGame.base_score（仅比赛场写入 TableData）与 MsgVsPlayerInfo.base_score，用于底分牌展示（source-code/client/Code/data/GameData.ts:463、source-code/client/Code/controller/cmd/gameCmd/GameStartGameCmd.ts:34、source-code/client/Code/layer/BoxHzmjBackView.ts:87）
  - UI 交互：底分牌 KW_BASE_SCORE 显示「底分:1」。
  - 客户端实现：接收庄家座位与牢庄档位（MsgJuData.banker_level、MsgResultHu.banker_level），仅用于界面标识与番型流水展示，不做庄闲 8 倍换算（source-code/client/Code/controller/cmd/gameCmd/GameJuDataCmd.ts:34、source-code/client/Code/interface/BoxHzmjResultTypes.ts:12、source-code/client/Code/layer/BoxHzmjMainView.ts:666）
  - UI 交互：结算行 C_IsBank 按连庄档位显示庄/庄×2/庄×3 角标；胡按钮按服务端 hu_point 显示「N倍」。
  - 待确认：客户端代码未找到对应实现
  - 客户端实现：听牌面板按房间 max_mult 判定封顶，max_mult 为 0 或 -1 时标为无封顶且不对每张听牌倍数做钳制，仅 max_mult>0 时按封顶值取小（source-code/client/Code/layer/BoxHzmjTingPaiView.ts:95、source-code/client/Code/layer/BoxHzmjTingPaiView.ts:96、source-code/client/Code/layer/BoxHzmjTingPaiView.ts:138、source-code/client/Fgui/assets/box_hzmj_tingPai/component/TingPai.xml:10）
  - UI 交互：听牌面板 KW_FengDing 文本显示「无封顶」；听牌倍数原样显示、不被截断。
  - 客户端实现：在 FanDefine 中记录番型分三组互斥、最终倍数取三组最高档连乘的口径，并缓存 MsgResultHu.fan_details[].mult（服务端已算好的倍数）用于展示（source-code/client/Code/config/FanDefine.ts:12、source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:120、source-code/client/Code/util/BoxHzmjFlowUtil.ts:315）
  - UI 交互：胡牌字效按番型播放，流水标题拼接番型名与得分（如「平胡，+9分」）。
  - 客户端实现：FanDefine 把杠飘(2419)、飘杠(2420)登记为独立番型并注明 8x；组合动效解析优先直接命中组合 ID，否则按杠开系×财飘系拆分，作为替换杠上开花与财飘的表现口径（source-code/client/Code/config/FanDefine.ts:51、source-code/client/Code/config/FanDefine.ts:53、source-code/client/Code/config/FanDefine.ts:235、source-code/client/Code/config/FanDefine.ts:256）
  - UI 交互：播放杠飘/飘杠专属组合字效与音效，流水文案显示「杠飘」「飘杠」。

- **自摸**：三家各算一笔。庄家自摸，三笔都乘 8。闲家自摸，庄家那一笔乘 8，另两名闲家各乘 1。没有承包时，各付各的，赢家收合计。
  - 客户端实现：结算按 win_losts 逐座位写入桌面分，自摸流水使用 K_LT_ZI_MO/K_LT_BEI_ZI_MO 成对展示三家各自的一笔赔付（source-code/client/Code/util/BoxHzmjFlowUtil.ts:118、source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:199、source-code/client/Code/layer/BoxHzmjTipAniView.ts:701）
  - UI 交互：胡牌番型动画结束后逐座位播放飘分，三家分别弹分。
  - 待确认：客户端代码未找到对应实现
  - 客户端实现：结算按 win_losts 逐座位展示各自应付，赢家流水分数用「win_losts 分数 − bao_settles 汇总」倒推主胡部分，合计由服务端给出（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:209、source-code/client/Code/util/BoxHzmjFlowUtil.ts:360、source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:152）
  - UI 交互：飘分与流水逐座位展示，赢家结算行显示最终合计分。
- **点炮胡、抢杠胡**：没有承包时只算赢家和赔付者一笔，这一笔按庄闲 8 倍，另两家 0 分。有承包时按上一节改写。
  - 客户端实现：用 hu_type=HT_DISCARD/HT_ROBKONG 识别炮胡并记录点炮来源 df_from，流水只生成赢家（K_LT_DIAN_PAO/K_LT_QIANG_GANG）与放铳者（K_LT_FANG_PAO/K_LT_BEI_QIANG_GANG）成对的一条（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:338、source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:339、source-code/client/Code/util/BoxHzmjFlowUtil.ts:120、source-code/client/Code/util/BoxHzmjFlowUtil.ts:237）
  - UI 交互：点炮、抢杠播放点炮动画；结算行赢家标「点炮」，放铳者行显示负分。
  - 待确认：客户端代码未找到对应实现
  - 客户端实现：score 为 0 的座位不写入桌面飘分数据（直接跳过），结算行仍按 win_lost 逐座显示，另两家分数为 0（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:206、source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:365）
  - UI 交互：另两家不弹飘分，结算行分数显示 0（不加正号）。
  - 客户端实现：消费 MsgResultHu.bao_settles，结算行按 from_seat 打 C_ChengBao 角标（承包/反承包），流水追加「承包/反承包」并从赢家分中扣除承包额还原主胡分（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:66、source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:196、source-code/client/Code/util/BoxHzmjFlowUtil.ts:432）
  - UI 交互：结算行显示承包或反承包角标，流水中出现「承包」「反承包」条目，桌面另有「三摊承包」提示。
- **承包**：自摸先算出三笔再求和为 S，然后按上一节改写出实际赔付。
  - 待确认：客户端代码未找到对应实现
  - 客户端实现：实际赔付额取自 bao_settles[].score，客户端用 from_seat/to_seat 汇总承包进出分、从赢家 win_lost 中扣除承包额以还原主胡分，不做 1 倍/2 倍规则校验（source-code/client/Code/util/BoxHzmjFlowUtil.ts:427、source-code/client/Code/util/BoxHzmjFlowUtil.ts:456、source-code/client/Code/lib/proto_game_hzmj.d.ts:5564）
  - UI 交互：结算行承包角标与流水「承包/反承包」金额按服务端分数展示。
- **黄庄**：四家本局都是 0。
  - 客户端实现：end_type=ET_DRAWN 时不生成任何流水项，自己行按流局算输（selfWinLost=2）；四家 0 分依赖服务端 win_losts 全 0，且 score 为 0 的座位不写入桌面飘分数据（source-code/client/Code/util/BoxHzmjFlowUtil.ts:29、source-code/client/Code/util/BoxHzmjResultUtil.ts:37、source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:206）
  - UI 交互：流局不展示流水与飘分，结算行分数均显示 0，桌面背景走失败态。

闲家以 2 倍番型自摸：庄家付 16，两名闲家各付 2，赢家得 20。平胡点炮：赢家 +8，放铳者 −8，另两家 0。
  - 待确认：客户端代码未找到对应实现

本场积分从 0 起，每小局加上实际净得分。赢家加实收，赔付者扣实付。
  - 客户端实现：每小局结算后用 MsgResultHu.player_score.scores 覆盖写 player.sr，MsgPlayerScore 同样整体覆盖，客户端不做本地累加；大结算按 user_results.score 汇总本场总分（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:223、source-code/client/Code/controller/cmd/gameCmd/GamePlayerScoreCmd.ts:31、source-code/client/Code/controller/cmd/helperCmd/TotalResultCmd.ts:33、source-code/client/Code/layer/BoxHzmjPlayerView.ts:514）
  - UI 交互：桌面头像分数经 onUpdateScore 刷新；大结算展示各玩家本场总分。
  - 客户端实现：赢家本场累计分与单局实收均取服务端下发值，客户端不单独做加法，仅以 win_losts.score 与 player.sr 展示（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:229、source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:366）
  - UI 交互：赢家分数用 win 字效显示带正号数值。
  - 客户端实现：赔付者单局与累计负分同样取服务端 win_losts.score 与 player.scores，客户端不做扣减运算（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:227、source-code/client/Code/layer/BoxHzmjTipAniView.ts:567）
  - UI 交互：赔付者行显示负分并使用 lose 字效，桌面飘分显示负数。

## 番型

先确认牌型，再确认这次是自摸、点炮胡还是抢杠胡。番型分三组，组内只取最高一档，组间连乘。点炮和抢杠不算爆头、财飘、杠开、十风。
  - 客户端实现：胡法识别由 GameResultHuCmd 依据 hu_items.hu_type 完成：HT_DISCARD / HT_DIAN_GANG_HUA / HT_ROBKONG 视为点炮类并读取 df_from，TipAni 用同一判据生成 isZimo，牌型判定本身不在客户端（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:339、source-code/client/Code/layer/BoxHzmjTipAniView.ts:929、source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:95）；组内取最高档由 FanDefine 的 HzmjFanType 2401-2420 定义，注释声明“分3组互斥：基础/七对组、杠开组、财神组，最终倍数 = 三组最高档连乘”，PickHzmjPrimaryFanId 按 HzmjFanAniSortingMap 从 fan_ids 选单个主番型用于动效（source-code/client/Code/config/FanDefine.ts:12、source-code/client/Code/config/FanDefine.ts:277、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1036）；组间连乘客户端不计算番点，总倍率直接取服务端 fan_point / hu_point：胡按钮显示 MsgPower.hu_point，听牌列表显示服务端 point（source-code/client/Code/config/XsmjFanConfig.ts:4、source-code/client/Code/layer/BoxHzmjMainView.ts:666、source-code/client/Code/interface/GameInterface.ts:47、source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:765）；点炮和抢杠不算自摸类番型的排除逻辑不在客户端：客户端能识别点炮/抢杠胡法，但不对 fan_ids 做任何剔除，服务端下发的番型列表原样进入动效、语音与文案（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:339、source-code/client/Code/layer/BoxHzmjTipAniView.ts:934）
  - UI 交互：点炮走点炮动效（dianpao / yipaoduoxiang）与“胡”音，自摸走 zimo 音与自摸动画，小结算行以 C_HuType 角标区分点炮/自摸；胡牌只播一档主番型动画，基础档走 KW_Ani_Hu_Type 文字动效，其余走 KW_Ani_Hu 动效，同组不会并播多档；胡按钮 KW_HuPaiBeiShu 显示“N倍”，听牌卡 KW_BeiShuNum 显示每张牌的倍数，好友房小结算只显示番型名不显示倍数；点炮与抢杠仍会按服务端 fan_ids 播放对应番型动效与语音，不会因“非自摸”降级为平胡

| 组 | 番型 | 倍数 | 成立条件 |
| --- | --- | --- | --- |
| 基础 | 平胡 | 1 | 4 组面子加 1 对。财神可参与面子或对子。 |
| 基础 | 七对 / 豪华 / 双豪华 / 三豪华 | 2 / 4 / 8 / 16 | 14 张组成 7 对，且手里至少有 1 张财神。某种非财神牌面有 4 张实牌，计 1 组豪华。白板不计豪华。 |
| 基础 | 清七对 / 豪华 / 双豪华 / 三豪华 | 4 / 8 / 16 / 32 | 同样是 7 对，但手里没有财神。 |
| 杠开 | 杠上开花 / 二连杠 / 三连杠 / 四连杠 | 2 / 4 / 8 / 16 | 自摸，杠链为 1 / 2 / 3 / 4 及以上。 |
| 财神 | 爆头 | 2 | 自摸，飘档为 0，单放与财神成将。听任意牌时，改看进张前是否敲响。 |
| 财神 | 财飘 / 双财飘 / 三财飘 | 4 / 8 / 16 | 自摸，飘档正好为 1 / 2 / 3 及以上，且单放与财神成将。3 档及以上都是三财飘。 |

  - 客户端实现：平胡由 HzmjFanType 定义 K_FTG_HZMJ_PING_HU=2401，FanDefine 注释“平胡（四面子一将），1x”，在名称表、结算两行文案与流水文案中输出“平胡”，平胡被视作“素胡”不触发震动（source-code/client/Code/config/FanDefine.ts:15、source-code/client/Code/config/FanDefine.ts:74、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1081、source-code/client/Code/controller/cmd/helperCmd/ResultCmd.ts:21）
  - UI 交互：平胡单番走 KW_Ani_Hu_Type 的 pinghu 文字动效；平胡语音按自摸/点炮分别取各方言的胡音与自摸音
  - 待确认：客户端代码未找到对应实现（财神可参与面子或对子）

  - 客户端实现：七对 FanDefine 定义 2410-2413 与名称/倍数注释，TipAni 映射七对系 skin（hhqd/2hhqd/3hhqd），GameSoundConfig 配置七对族语音，客户端不校验“14 张 7 对”与“至少 1 张财神”（source-code/client/Code/config/FanDefine.ts:33、source-code/client/Code/config/FanDefine.ts:35、source-code/client/Code/config/FanDefine.ts:252、source-code/client/Code/config/FanDefine.ts:341、source-code/client/Code/config/GameSoundConfig.ts:435）；豪华档 FanDefine 以注释方式记录“含 1 组四张相同”，名称表输出豪华/双豪华/三豪华七对，客户端无四张实牌统计逻辑（source-code/client/Code/config/FanDefine.ts:37、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1145）
  - UI 交互：七对单番走文字动效 qiduizi，带财七对叠加爆头/财飘时改走组合动效 qk/hhqk/2hhqk/3hhqk，文案显示为“七客/豪华七客”等；豪华及以上档位分别播 2hhqd/3hhqd 等动效，普通七对与豪华单番共用 hhqd
  - 待确认：客户端代码未找到对应实现（白板不计豪华）

  - 客户端实现：清七对 FanDefine 定义 2414-2417 与“清七对（无财神）4x”注释及豪华清七对档位，TipAni 映射 qqd/hhqqd/2hhqqd/3hhqqd，语音单独配置清七对族（source-code/client/Code/config/FanDefine.ts:41、source-code/client/Code/config/FanDefine.ts:47、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1150、source-code/client/Code/config/GameSoundConfig.ts:439）
  - UI 交互：清七对单番播 qqd 动效，豪华档播 hhqqd/2hhqqd/3hhqqd

  - 客户端实现：杠上开花 FanDefine 定义 2406 注释“杠上开花：杠牌后自摸，2x”，GetHzmjGangLevel 将 2406 映射为杠开 1 档，GameData.checkCanGangBao 在本地预判“手牌模 3 余 2 + 有听 + 只有一组杠牌”（source-code/client/Code/config/FanDefine.ts:25、source-code/client/Code/config/FanDefine.ts:295、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1133、source-code/client/Code/data/GameData.ts:418）；二连杠 FanDefine 定义 2407 注释“连续杠二次后自摸，4x”，GetHzmjGangLevel 映射为 2 档（source-code/client/Code/config/FanDefine.ts:27、source-code/client/Code/config/FanDefine.ts:296、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1135）；三连杠 FanDefine 定义 2408 注释“连续杠三次后自摸，8x”，GetHzmjGangLevel 映射为 3 档（source-code/client/Code/config/FanDefine.ts:29、source-code/client/Code/config/FanDefine.ts:297、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1137）；四连杠 FanDefine 定义 2409 注释“连续杠四次后自摸，16x”，GetHzmjGangLevel 映射为 4 档，没有再高的档位（source-code/client/Code/config/FanDefine.ts:31、source-code/client/Code/config/FanDefine.ts:298、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1139）
  - UI 交互：杠上开花播 gk 动效与“杠开”语音，小结算匹配场文案把 2406 显示为“杠开”；二连杠播 2lgk 动效，语音取 hu_8_2gangkai；三连杠播 3lgk 动效，语音取 hu_9_3gangkai；四连杠播 4lgk 动效，语音取 hu_10_4gangkai

  - 客户端实现：爆头 FanDefine 定义 2402 注释“爆头：自摸+财神对+无飘，2x”，ListenData/GameData.isSelfBaoTouTing 判定自己是否任意牌听，结算时 _moveHuCombToLast 依据 fan_ids 含 2402 优先把“2 张对子且含单放”的组挪到最后（source-code/client/Code/config/FanDefine.ts:17、source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:455、source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:464、source-code/client/Fgui/assets/box_hzmj_tingPai/component/TingCard.xml:24、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1124）；听任意牌时客户端把服务端任意牌哨兵（255）归一为 MAH_VALUE_ALL 识别为爆头听，听牌界面切 C_BaoTou 页并渲染 KW_BaoTou，手牌上把“打出后万能听”的牌标成爆/飘标签（source-code/client/Code/layer/BoxHzmjTingPaiView.ts:49、source-code/client/Code/layer/BoxHzmjTingPaiView.ts:57、source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:193、source-code/client/Code/layer/BoxHzmjMainView.ts:1195）
  - UI 交互：爆头听牌卡切 C_BaoTou 页，显示“爆头2番”“摸任意一张可胡”，倍数位隐藏，胡牌播 bt 动效与爆头语音；听任意牌时听牌界面整块切到爆头页，KW_HuNum 显示“胡”，手牌上财神牌标飘、其他万能听牌标爆，报听按钮已移除

  - 客户端实现：财飘 FanDefine 定义 2403-2405 与飘档注释，GetHzmjCaiPiaoLevel 返回 1/2/3 档，GameData/TingType 用 TYPE_PIAO 标识“打出财神且听任意牌”（source-code/client/Code/config/FanDefine.ts:19、source-code/client/Code/config/FanDefine.ts:21、source-code/client/Code/config/FanDefine.ts:309、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1126）；3 档及以上 FanDefine 注释写明 2405 对应 piao_level>=3、16x，GetHzmjCaiPiaoLevel 对 2405 固定返回 3，不再分更高档（source-code/client/Code/config/FanDefine.ts:23、source-code/client/Code/config/FanDefine.ts:311）
  - UI 交互：财飘/双财飘/三财飘分别播 cp / 2cp / 3cp 动效与 hu_4_caipiao / hu_5_2caipiao / hu_6_3caipiao 语音，手牌财神牌打标显示“飘”；3 档及以上统一播 3cp 动效与三财飘语音，不存在第 4 档表现

同时命中杠上开花和财飘时，去掉这两条，改记杠飘或飘杠，倍数 8，再乘基础番。例如平胡加这一档是 8 倍，七对加这一档是 16 倍。
  - 客户端实现：FanDefine 定义组合 ID 2419 杠飘、2420 飘杠，并区分 2419/2420；ResolveHzmjHuFanComboAni 在“命中 2419/2420”或“杠开系 × 财飘系”拆分命中时返回 GANG_PIAO，FormatHzmjWinnerFanFlowText 据此输出“杠飘/飘杠”（source-code/client/Code/config/FanDefine.ts:236、source-code/client/Code/config/FanDefine.ts:257、source-code/client/Code/config/FanDefine.ts:360、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1101、source-code/client/Code/config/GameSoundConfig.ts:512）；倍数 8 由 FanDefine 在枚举注释中标注 2419/2420 为 8x，XsmjFanConfig 的单项倍率表同样把两值设为 8，该表注释声明仅用于动画候选比较，实际总倍率仍取服务端 fan_point（source-code/client/Code/config/FanDefine.ts:51、source-code/client/Code/config/FanDefine.ts:53、source-code/client/Code/config/XsmjFanConfig.ts:24）
  - UI 交互：组合动效只播 gp（杠飘）或 pg（飘杠），不再分别播杠开与财飘，语音走组合音 hu_20_gangpiao / hu_21_piaogang；界面上不单独显示“8 倍”，只显示组合番型名与（匹配场的）总计倍数
  - 待确认：客户端代码未找到对应实现（再乘基础番，例如平胡加这一档是 8 倍，七对加这一档是 16 倍）

十风：从第一张出牌起连续打字牌。中途打出非字牌，或吃、碰、杠，本局作废，不能再重新累计。满 10 张后任意自摸都能胡，不要求成牌。只记十风，不与平胡、杠开、财飘、七对相乘。10 张为 2 倍，每多一张再乘 2。
  - 客户端实现：FanDefine 定义 2418“十风（独占番型）：连续打出≥10张字牌后自摸，2x（11张=4x，12张=8x…）”，客户端无连续字牌计数与资格状态（source-code/client/Code/config/FanDefine.ts:49、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1160）；满 10 张后的授胡资格由服务端判定，FanDefine 的 IsHzmjTenWindFan 注释指出“十风亮牌走牌河，hu_items.hands/combs 不能当剩余手牌用”，说明客户端已知十风结算手牌来自出牌区（source-code/client/Code/config/FanDefine.ts:175、source-code/client/Code/config/FanDefine.ts:180）；独占由 XsmjFanConfig 把 2418 列入 XSMJ_EXCLUSIVE_FANS，注释“独占番直接按服务端单条结果展示，不在客户端重新判胡”，主番型选择一次只取一个 ID（source-code/client/Code/config/XsmjFanConfig.ts:36、source-code/client/Code/config/XsmjFanConfig.ts:38、source-code/client/Code/config/FanDefine.ts:272）；倍数递增 FanDefine 注释与规则一致“2x（11张=4x，12张=8x…）”，客户端无该指数计算（source-code/client/Code/config/FanDefine.ts:49）
  - UI 交互：十风走 Paixing_wz04 的 sf 动效，番型名表输出“十风”；结算按服务端 hu_items.hands 原序展示十风手牌（取自出牌区），不自行排序；十风时只播 sf 单番动效，不并播其它番型动画；无独立倍率文案，倍数只体现在服务端 fan_point 与胡按钮显示
  - 待确认：客户端代码未找到对应实现（中途打出非字牌，或吃、碰、杠，本局作废，不能再重新累计）

财神牌面染红，可点击，没有角标。打出后牌河仍是原牌面，只保留这层红色。
  - 客户端实现：财神牌面染红由 applyJokerMahColor 按 GameData.getJokerColorValues() 命中的牌值调用 setMahColor(node, MahColor_Box.red, true) 实现，手牌、听牌列表与小结算财神牌均调用该逻辑（source-code/client/Code/util/BoxHzmjMahColorUtil.ts:29、source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:68、source-code/client/Code/layer/comp/BoxHzmjResultLeft.ts:39）；可点击未见财神专属点击分支，仅代码注释多处声明财神色“可点击”，手牌 touchable 只在禁打时被置灰/不可点（applyPlayLmtsGray）（source-code/client/Code/data/GameData.ts:52、source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:69）；没有角标由 updateJokerColor 在刷财神色后显式清空角标与赖子标记实现：setLaiziValues({})、setCornerValues({})，并清空黄色蒙版缓存（source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:70、source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:73）；打出后牌河保留原牌面由 BoxHzmjMah2DView._applyJokerColorToTable 对所有座位的出牌区、胡牌列表与副露调用 applyJokerColorToMahList / applyJokerColorToCombo 实现，工具只调用 setMahColor 改色，不替换牌面资源（source-code/client/Code/layer/BoxHzmjMah2DView.ts:1130、source-code/client/Code/layer/BoxHzmjMah2DView.ts:1132、source-code/client/Code/util/BoxHzmjMahColorUtil.ts:36）
  - UI 交互：财神牌在手牌/听牌列表/牌河/副露/小结算左下财神位上显示红色牌面，同牌高亮（绿/蓝）优先不覆盖；财神牌与普通手牌一样可点选/出牌，财神牌出牌另有专属财神音效；财神牌只显示红色牌面，不叠加任何角标图标；牌河中的财神牌仍是原牌值牌面，仅叠加红色，同牌高亮存在时保留高亮色

## 结算

胡牌确认后停止行牌，每小局只结算一次。自摸的胡张是本次摸入或补入的牌，点炮胡的胡张是弃牌，抢杠胡的胡张是被抢的第 4 张。
  - 客户端实现：GameResultHuCmd 收到 MsgResultHu 后立刻派发 onCloseOperate 与 onHidePutCardUi 关闭操作区，本家胡牌时把出牌步进置为 false（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:241；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:185）
  - UI 交互：操作按钮控制器切到空态，手牌不可再出牌
  - 待确认：客户端代码未找到对应实现
  - 客户端实现：结算亮牌时以 PlayerCardsData.moCard 作为胡张传给桌面胡牌表现，桌面把胡张拼到本家手牌末尾展示；桌面胡牌表现中，若放铳座位河牌最后一张等于胡张，则把该弃牌从牌河移除，说明胡张取自弃牌；客户端把点炮、点杠花、抢杠胡统一按放铳类型处理，用协议 df_from 作放铳方、dan_fang 作胡张，没有针对「第 4 张」的独立判断（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:250；source-code/client/Code/layer/BoxHzmjMah2DView.ts:984；source-code/client/Code/layer/BoxHzmjMah2DView.ts:997；source-code/client/Code/layer/BoxHzmjMah2DView.ts:998；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:339；source-code/client/Code/data/PlayerCardsData.ts:284）
  - UI 交互：胡张在本家手牌末位亮出并参与胡牌落地表现；放铳方牌河最后一张被移入胡牌手牌；抢杠胡与点炮共用点炮表现与胡张展示

- 各端停止操作按钮、胡牌预览和放大弃牌，方位盘停止倒计时。在原牌桌亮出四家手牌，桌面中央显示「对局结束」。保留终局牌河、财神和余牌数。
  - 客户端实现：收到 onCloseOperate 后把 KW_Handler 的按钮状态控制器置空，并关闭更多选择、复盘操作与出牌权限；本家胡牌时结算流程直接隐藏听牌/胡牌预览界面并清空听牌信息；收到游戏结束还会关闭听牌按钮；结算流程派发 onHidePutCardUi，出牌放大节点统一置为不可见；收到 onGameEnd 时调用 setClockHide，停止倒计时计时器并清空方位盘数字（source-code/client/Code/layer/BoxHzmjMainView.ts:494；source-code/client/Code/layer/BoxHzmjMainView.ts:497；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:258；source-code/client/Code/layer/BoxHzmjMainView.ts:446；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:242；source-code/client/Code/layer/BoxHzmjMainView.ts:1061；source-code/client/Code/layer/BoxHzmjMah2DView.ts:390；source-code/client/Code/layer/BoxHzmjMah2DView.ts:721）
  - UI 交互：吃碰杠胡过等操作按钮全部隐藏，手牌不可出；本家胡牌时解除压暗；听牌预览面板关闭，听牌按钮隐藏；桌面放大弃牌图立即消失；方位盘中央倒计时数字清空，倒计时灯隐藏
  - 客户端实现：先用 player_hands 覆盖各座手牌与副露，再由 playHuEnd 遍历全部座位把手牌状态置为亮面，胡牌家把胡张拼进手牌；结算消息 end_type 不为 NONE 时派发 onShowGameEndType，动画视图把 KW_GameEnd 的 C_GameEnd 控制器切到对应页（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:109；source-code/client/Code/layer/BoxHzmjMah2DView.ts:1059；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:84；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1186；source-code/client/Fgui/assets/box_hzmj_tipAni/component/HzmjTipAniComponent.xml:3；source-code/client/Fgui/assets/box_hzmj_tipAni/component/HzmjTipAniComponent.xml:69）
  - UI 交互：四家手牌在牌桌上翻开，本家手牌缩小 0.8 倍让位；桌面中央（667,302）出现结束标记图，1 秒后自动复位
  - 客户端实现：结算流程只覆盖手牌与副露，不清理牌河；桌面仅在下一局 onResetUI 时统一清空四方位手牌、河牌、胡牌与副露；财神与剩余张数由桌面侧栏组件 KW_LEFT_MAHS / KW_RIGHT_MAHS 常驻显示，结算期间不重置，只有下一局 onResetUI 才隐藏（source-code/client/Code/layer/BoxHzmjMah2DView.ts:528；source-code/client/Code/layer/BoxHzmjMah2DView.ts:525；source-code/client/Code/layer/BoxHzmjMah2DView.ts:546；source-code/client/Code/layer/BoxHzmjMah2DView.ts:353）
  - UI 交互：结算与黄庄期间四家河牌保持终局状态，继续游戏后才清空；桌面左侧财神牌与右侧剩余张数在终局继续可见
- 「对局结束」仍在时，胡牌者方位播放番型字效。点炮胡和抢杠胡同时在放铳方位显示「点炮」，抢杠胡的放铳者是加杠者。
  - 客户端实现：结算按胡牌座位逐个派发 onMsgPlayHuNew，动画视图取该座位 KW_Ani_CPG 节点，按番型选 skin 播放文字或动效类字效（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:283；source-code/client/Code/layer/BoxHzmjTipAniView.ts:941；source-code/client/Fgui/assets/box_hzmj_tipAni/component/HzmjTipAniComponent.xml:8）
  - UI 交互：胡牌者方位（KW_Ani_CPG_0~3）播放番型 Spine，基础番走文字节点、组合番走动效节点
  - 客户端实现：结算判断为放铳类型且存在 df_from 时派发点炮动画，动画视图取放铳座位对应的 KW_Ani_DP 节点播放 dianpao skin；抢杠胡被并入放铳类型，放铳方位直接取协议的 df_from；加杠者身份由服务端给出，客户端无校验或专门字段（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:266；source-code/client/Code/layer/BoxHzmjTipAniView.ts:881；source-code/client/Fgui/assets/box_hzmj_tipAni/component/HzmjTipAniComponent.xml:32；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:339；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:171）
  - UI 交互：放铳方方位播放「点炮」Spine；一炮多响播 yipaoduoxiang；抢杠胡在 df_from 座位播放点炮表现
- 先刷新头像旁的累计积分。番型字效退场后，只在本局得分不为 0 的座位内侧飘分。正分金黄色，负分浅蓝灰色并带减号。飘分淡出后短暂保留终局牌桌，再打开小结算。
  - 客户端实现：结算先把 player_score.scores 写入各座 player.sr，再播动画；玩家视图收到 onUpdateScore 后刷新头像旁分数，独立协议 MsgPlayerScore 也走同一入口（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:88；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:231；source-code/client/Code/layer/BoxHzmjPlayerView.ts:514）
  - UI 交互：头像旁累计积分在字效/飘分前更新，正分为金黄色
  - 客户端实现：第一个座位番型动画完成回调里触发 onShowResultScore，动画视图遍历桌面飘分数据逐座位播放飘分动画；写桌面飘分数据时 score 为 0 的座位直接跳过，飘分阶段只对存在飘分数据的座位播放；无座位时立即结束本阶段（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:288；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:276；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:206；source-code/client/Code/layer/BoxHzmjTipAniView.ts:704）
  - UI 交互：番型字效结束后，各座位同时出现飘分数字；0 分座位不出现飘分数字
  - 客户端实现：飘分数字 score>=0 时使用 fnt_win 位图字体，颜色由字体图集决定，代码未设置文本颜色；score<0 时切换 fnt_lose 位图字体，负号由字体图集的减号字模提供（source-code/client/Code/layer/BoxHzmjTipAniView.ts:567；source-code/client/Fgui/assets/box_hzmj_tipAni/component/ResultScoreCom.xml:13；source-code/client/Code/layer/BoxHzmjTipAniView.ts:570）
  - UI 交互：正飘分以金色数字字效滑入并淡出；负飘分以浅蓝灰色数字带减号滑入并淡出
  - 客户端实现：飘分节点自身在 time=29 开始 Alpha 淡出；结算命令用固定 3 秒延时执行 CMD_GAME_RESULT 打开小结算，不依赖飘分回调（source-code/client/Fgui/assets/box_hzmj_tipAni/component/ShowResultScore.xml:10；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:306；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:309）
  - UI 交互：飘分淡出后终局牌桌短暂停留，随后小结算覆盖
- 黄庄：亮出四家手牌，桌面中央显示「黄庄」，保留终局牌河、财神和余牌数 20。不飘分。四家本局都是 0，随后打开小结算，标题为「黄庄」。
  - 客户端实现：亮牌逻辑 playHuEnd 无条件遍历全部座位并置为亮面，不区分胡牌与流局；end_type=ET_DRAWN 派发 onShowGameEndType，C_GameEnd 切到 drawn 页，KW_GameEnd 使用该页对应图片；牌河、财神、余牌数沿用桌面常驻显示，结算流程不清空；余牌数取最后一次牌墙刷新值，结算不写死 20（source-code/client/Code/layer/BoxHzmjMah2DView.ts:1047；source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:303；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1186；source-code/client/Fgui/assets/box_hzmj_tipAni/component/HzmjTipAniComponent.xml:70；source-code/client/Code/config/GameDefine.ts:441；source-code/client/Code/controller/cmd/helperCmd/ResultCmd.ts:67；source-code/client/Code/layer/BoxHzmjMah2DView.ts:546）
  - UI 交互：黄庄时四家手牌同样翻开在牌桌上；桌面中央显示黄庄标记图（与胡牌结束使用不同图片）；黄庄时右侧仍显示剩余的 20 张，左侧仍显示本局财神
  - 客户端实现：飘分数据写入时跳过所有 score=0 的座位，飘分阶段总数为 0 时立即走完成分支，不发任何飘分动画；组装小结算数据时 end_type=ET_DRAWN 时把 selfWinLost 置为 2（流局），交由公共壳按此渲染标题（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:206；source-code/client/Code/layer/BoxHzmjTipAniView.ts:649；source-code/client/Code/util/BoxHzmjResultUtil.ts:37；source-code/client/Code/util/BoxHzmjResultUtil.ts:38）
  - UI 交互：黄庄不出现飘分数字，直接进入小结算流程；小结算标题显示黄庄

小结算盖在终局牌桌上。各端以本家为第一行，向下依次为下家、对家、上家。本家行置顶并高亮。胡牌局按本端本局净得分切换主题：大于或等于 0 为「恭喜获胜」，小于 0 为「遗憾失败」。黄庄四端都是「黄庄」。
  - 客户端实现：小结算视图使用公共结算壳，排序层为 Result，高于牌桌主视图的 Main 层，从而覆盖终局牌桌（source-code/client/Code/layer/BoxHzmjResultView.ts:39；source-code/client/Code/layer/BoxHzmjMainView.ts:129）
  - UI 交互：小结算面板整体压在牌桌上方，牌桌仍在背后可见
  - 客户端实现：中间区列表按玩家列表顺序渲染，每行方位文案由本地座位计算：本家、下家、对家、上家（多人时按座位号推导）（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:965；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:976；source-code/client/Fgui/assets/box_hzmj_result/BoxHzmjResultMid.xml:4）
  - UI 交互：行首竖排显示 本家/下家/对家/上家
  - 客户端实现：本家行打开 C_IsSelf 页、显示金币角标、按输赢切换行底图与分隔线，实现高亮；置顶未在行内代码中实现（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:367；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:369；source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:26）
  - UI 交互：本家行背景切换为高亮底图，带金币图标与专属赢/输底图
  - 客户端实现：组装结算数据时按本家 win_losts 分数计算 selfWinLost（>=0 记 0，<0 记 1），交给公共壳决定标题主题（source-code/client/Code/util/BoxHzmjResultUtil.ts:36；source-code/client/Code/layer/BoxHzmjResultView.ts:50）
  - UI 交互：小结算标题随本家净得分切换获胜/失败主题
  - 客户端实现：四端收到的 end_type 都是 ET_DRAWN，各自把小结算主题入参置为流局值 2，因此标题一致（source-code/client/Code/util/BoxHzmjResultUtil.ts:37；source-code/client/Code/controller/cmd/helperCmd/ResultCmd.ts:65）
  - UI 交互：四端小结算标题都显示黄庄

- 每行左侧为座位、头像和昵称。庄家行显示「庄×3」。中间从左到右是碰杠区和手牌，杠的第 4 张垒在上方，暗杠顶张正面。胡牌者其余手牌按胡牌组合分组，未胡牌者连续摆放。胡入的那一张在所属组合内标绿色「胡」。
  - 客户端实现：每行写入竖排方位文案、昵称，并使用头像组件展示玩家头像，点击头像可打开用户信息弹窗（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:150；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:306；source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:30）
  - UI 交互：行左显示 本家/下家/对家/上家 竖排文字与头像、昵称，头像可点击
  - 客户端实现：庄家行按连庄次数设置 C_IsBank 页（1/2/3 对应庄、庄×2、庄×3），数据取 GameData.getLianZhuangCount()，与桌面头像 C_Bank 同源（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:402；source-code/client/Code/controller/cmd/helperCmd/ResultCmd.ts:61；source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:10）
  - UI 交互：庄家行头像位置显示庄/庄×2/庄×3 图标
  - 客户端实现：渲染时先按 C_ShowComp 页展示 KW_Comp0~7 副露，再渲染 KW_Mah_List / KW_Mah_Hu 手牌，最后由 n10 水平布局组统一重排；副露宽度改变会重建行布局；杠组切换 comboSefl 的 4mah 页，第 4 张牌节点 mah3 单独放在上方一行；暗杠组打开 C_IsAnGan 页，前 3 张牌状态置为暗面（C_IsAnGan=1 且 i<3 时 state=1），第 4 张用非暗状态渲染牌面（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:527；source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:68；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:557；source-code/client/Fgui/assets/box_hzmj_result/component/comboSefl.xml:21；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:583；source-code/client/Fgui/assets/box_hzmj_result/component/mahHandSelf.xml:3）
  - UI 交互：行内左侧依次排开碰杠组，右侧接连续手牌；杠牌展示为下方 3 张、上方叠 1 张；暗杠显示 3 张暗牌 + 1 张正面牌
  - 客户端实现：解析亮牌时优先用 hu_items，若胡项带 combs 则按 Comb 模式逐组渲染，并把含胡张的非吃碰杠组挪到最后一组；未胡座位走 Hand 模式，取 player_hands 的手牌写入 KW_Mah_List 连续列表，不下发胡项分组（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:249；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:175；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:273；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:276；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:677）
  - UI 交互：胡牌家手牌按顺子/刻子/对子等分组间距展示；未胡家手牌一张接一张连续排开
  - 客户端实现：在所属组合内定位胡张下标，打开该牌节点的 C_Hu 页显示「胡」角标；同值多张时取最后一张（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:588；source-code/client/Fgui/assets/box_hzmj_result/component/mahHandSelf.xml:30；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:573）
  - UI 交互：胡张牌角上出现绿色「胡」图标
- 右侧为本局净得分。正分带加号，0 分显示「0」，负分带减号。
  - 客户端实现：按服务端座位在 win_losts 中取本局分数，经大数缩写后写入行右侧 KW_Score 文本（source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:75；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:152）
  - UI 交互：每行最右侧显示本局净得分数字
  - 客户端实现：分数大于 0 时在文本前拼接「+」；分数为 0 时不加任何符号，直接写入缩写后的数值字符串；负分直接把带负号的数字交给大数缩写函数，并切换到 lose 位图字体，减号由字体图集提供（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:365；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:364；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:366）
  - UI 交互：正分显示为 +N；0 分行显示 0；负分显示为 -N，使用失败字效
- 赢家牌组上方写实际命中的番型名称。同时命中多组时都写上，例如「七对」「杠飘」。双财飘、双豪华七对、二连杠直接写全名。最右侧标胡牌方式：自摸、点炮胡或抢杠胡。点炮胡、抢杠胡的赔付者标「点炮」。
  - 客户端实现：按座位过滤流水文案，无流水时用 hu_items.fan_ids 生成番型文案，写入牌组上方的 KW_Flow，并打开 C_LiuShui 页（source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:72；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:759）
  - UI 交互：赢家手牌组正上方显示一行番型文案，可点击展开完整流水
  - 客户端实现：番型文案按命中分组拼装：单番直接取名称，组合番用「组合名（非 1 侧明细）」形式，多片段以「，」连接（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:766；source-code/client/Code/config/FanDefine.ts:467）
  - UI 交互：KW_Flow 一行内展示全部命中番型
  - 客户端实现：番型名称表内置「双财飘」「双豪华七对」「二连杠」等全名，组合展开时直接取该名称（source-code/client/Code/config/FanDefine.ts:77；source-code/client/Code/config/FanDefine.ts:85；source-code/client/Code/config/FanDefine.ts:80）
  - UI 交互：对应番型在牌组上方显示完整名称，不缩写档位
  - 客户端实现：胡牌家按 hu_type 是否为自摸切 C_HuType 页（自摸=3，其余=2），胡牌方式角标放在行最右的竖向组里（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:731；source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:94）
  - UI 交互：行最右侧显示自摸/吃胡角标
  - 客户端实现：非自摸的胡项中，若 df_from 等于当前行座位，则把该行 C_HuType 置为点炮页（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:734；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:736）
  - UI 交互：放铳者行右侧显示点炮角标
- 三摊承包：赢家标黄色「承包」，赔付者得分右侧标「三摊承包」。反承包：赢家标「反承包」，赔付者标「反承包」。链式承包：赢家同时标「承包」和「反承包」，番型只写一次；付 S 的一方标「三摊承包」，付 2 × S 的一方标「反承包」。
  - 客户端实现：好友房小结算只在承包方（from_seat）行挂 C_ChengBao=1 角标（图标文案「承包」，位于得分右侧），赢家行不挂承包角标；匹配场额外在桌面按座位显示「三摊承包」文字（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:212；source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:90；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1750）
  - UI 交互：赔付者行得分右侧出现承包角标；该行桌面 KW_RESULT 显示「三摊承包」
  - 客户端实现：relation=2 时给 from_seat（承包方）行挂 C_ChengBao=2 角标，赢家流水追加「反承包」文案；赢家行本身不挂角标（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:209；source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:17；source-code/client/Code/util/BoxHzmjFlowUtil.ts:445）
  - UI 交互：承包方行得分右侧显示反承包角标，赢家牌组上方流水出现「反承包」
  - 客户端实现：赢家流水先写一次番型文案，再按 bao_settles 逐条追加「承包」「反承包」项，最终以「，」连接为一行；赢家行不挂两种角标；客户端按 bao_settles.relation 区分文案（1→三摊承包，2→反承包），不区分 S 与 2×S 的倍数关系；金额仅用于汇总各座承包分（source-code/client/Code/util/BoxHzmjFlowUtil.ts:377；source-code/client/Code/util/BoxHzmjFlowUtil.ts:444；source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:766；source-code/client/Code/layer/BoxHzmjTipAniView.ts:1750；source-code/client/Code/util/BoxHzmjFlowUtil.ts:456）
  - UI 交互：赢家牌组上方一行流水同时出现番型与「承包」「反承包」；匹配场桌面按座位显示三摊承包或反承包，好友房结算行使用承包/反承包角标
- 左下展示本局财神正面，即白板。右下为「长按查看牌桌」：在底部栏扣除中央主按钮后的区域按住 500 毫秒，临时收起小结算，按本家视角查看终局牌桌；松手恢复同一张小结算。
  - 客户端实现：小结算左下角组件取 GameData.jokerMah，以正面状态渲染该牌并施加红色财神色；无财神时整块隐藏（source-code/client/Code/layer/comp/BoxHzmjResultLeft.ts:37；source-code/client/Code/layer/comp/BoxHzmjResultLeft.ts:39；source-code/client/Fgui/assets/box_hzmj_result/BoxHzmjResultLeft.xml:4）
  - UI 交互：左下显示财神牌图与财神牌位，财神数字为红色
  - 客户端实现：游戏侧在公共壳的按压回调里派发 onResultShowTable / onResultHideTable：显示时高亮桌上财神，恢复时清除高亮并保留同一份结算数据（source-code/client/Code/layer/BoxHzmjResultView.ts:99；source-code/client/Code/layer/BoxHzmjMah2DView.ts:1155；source-code/client/Code/config/FguiViewDefine.ts:358）
  - UI 交互：按住期间小结算收起、终局牌桌可见且财神高亮；松手恢复原小结算
- 非末局底部中央为【继续游戏】。点击后本端收起小结算，清除上一局手牌、碰杠区和牌河，保留座位和累计积分，本家显示「已准备」。四人均准备后自动开下一小局。第 8 局按钮为【返回大厅】，点击后退出房间。
  - 客户端实现：配置中保留了「小结算继续游戏（KW_BTN_GOON，非最后一局）」事件定义，但 BoxHzmjResultView 的 onContinueResult 实现被整体注释，游戏侧没有继续游戏的点击处理（source-code/client/Code/config/FguiViewDefine.ts:364；source-code/client/Code/layer/BoxHzmjResultView.ts:119）
  - UI 交互：底部中央按钮由公共壳渲染并显示继续游戏文案
  - 客户端实现：准备成功后派发 onResetUI 清空四方位手牌/河牌/胡牌/副露并隐藏侧栏财神与余牌数，同时给本家头像显示准备标记；座位与累计积分不清（source-code/client/Code/controller/gameController.ts:180；source-code/client/Code/controller/gameController.ts:181；source-code/client/Code/layer/BoxHzmjPlayerView.ts:563；source-code/client/Code/layer/BoxHzmjMah2DView.ts:528）
  - UI 交互：小结算关闭后牌桌清空，本家头像出现「已准备」标记，积分保留
  - 客户端实现：客户端只上报自身准备并在收到开局消息时重置界面与玩家状态；四人齐备后的开局判定由服务端完成（source-code/client/Code/controller/gameController.ts:181；source-code/client/Code/layer/BoxHzmjPlayerView.ts:222；source-code/client/Code/protocol/GameGlcProtocol.ts:106）
  - UI 交互：四人准备后自动进入下一小局，界面按开局消息重置
  - 客户端实现：公共壳收到总结算事件后按 C_IsLastRound 切换末局按钮，但仓库内未找到「返回大厅」文案或退出房间的游戏侧实现（source-code/client/Code/layer/BoxHzmjResultView.ts:147；source-code/client/Code/layer/BoxHzmjResultView.ts:149）
  - UI 交互：末局时底部中央按钮切换为离场类按钮（基类注释称为「查看总结算」）
