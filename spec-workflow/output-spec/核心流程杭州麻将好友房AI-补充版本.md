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
  - 客户端实现：局数据到达后把服务端下发的庄家座位转成本地座位保存，并触发庄家标记刷新，客户端不参与随机抽取，也没有候选玩家筛选逻辑；协议状态枚举把定庄排在骰子、发牌之前，断线重连在发牌初始帧依次还原牌墙、骰子、手牌、庄家标记，未见客户端对消息到达顺序做校验或强制（GameJuDataCmd.ts:31-33；BoxHzmjPlayerView.ts:808；PlayerPanel.xml:8；proto_game_hzmj.d.ts:3684-3685；GameGlcProtocol.ts:15-19；RecoverGameSceneCmd.ts:33；RecoverGameSceneCmd.ts:35-38；GameJuDataCmd.ts:51）
  - UI 交互：庄家玩家头像左上角出现"庄"字标记，头像庄标志控制器切到对应档位页；正常开局时庄家标记随局数据刷新，断线重连进入发牌帧时骰子、四家手牌与庄家标记同时呈现。
- 有人胡牌时，下一小局由胡牌者坐庄。庄家自己胡牌为连庄。
  - 客户端实现：下一小局由局数据重新下发庄家座位，客户端转成本地座位后刷新庄家标记，不判断上一局谁胡牌，也没有胡牌者与庄家的映射逻辑；客户端保存服务端下发的牢庄档位并据此显示庄标志，结算阶段按流水类型展示"连庄"条目，不判断胡牌者是否为庄家（GameJuDataCmd.ts:31-33；BoxHzmjPlayerView.ts:808；BoxHzmjResultMid.ts:402；FanDefine.ts:572-573；FanDefine.ts:648；BoxHzmjFlowUtil.ts:228-230；GameResultHuCmd.ts:62-64；ResultCmd.ts:57-61）
  - UI 交互：新一局开局时庄家标记移到上一局胡牌者头像上，结算界面也按庄家座位给对应行显示庄标志；结算流水出现"连庄"条目，庄家头像与结算行的庄标志保持档位图标不消失。
- 流局时原庄连庄。
  - 客户端实现：流局消息已定义并映射到流局命令，但仓库内未找到该命令的本地实现；流局在结算层按结束类型区分显示，流局行按输/平处理，未见原庄连庄相关逻辑（GameGlcProtocol.ts:114；gameController.ts:74；CmdDefine.ts:34；BoxHzmjResultMid.ts:371；BoxHzmjResultUtil.ts:37-39）
  - UI 交互：结算界面流局行按输/平样式显示，不展示胡牌信息。
- 首庄、新庄、连庄都是三牢，庄闲倍数固定 8 倍。三牢不再增加。
  - 客户端实现：客户端保存局数据与结算消息下发的牢庄档位（1/2/3）并把它作为庄标志档位显示，没有把档位固定赋值为三牢的逻辑，升庄广播会直接采用新档位；客户端提供按牢庄档位换算庄闲倍数的能力（1 档 2 倍、2 档 4 倍、3 档 8 倍）但未见调用，结算分数直接采用服务端下发的得失分，未单独展示倍数；庄字图标与结算庄标志只提供三档页面，结算显示处把档位钳制到 0~3，数字庄标志组件对档位只做下限保护、没有上限封顶，直接显示系统下发的档位（GameData.ts:1593-1594；GameJuDataCmd.ts:34-36；GameBankerLevelUpCmd.ts:23-24；GameResultHuCmd.ts:117-119；PlayerPanel.xml:8；GameData.ts:1661-1666；BoxHzmjResultTypes.ts:11；MatchTipConfig.ts:24；BoxHzmjResultUtil.ts:10-11；ResultItem.xml:12；BoxHzmjResultMid.ts:402；XsmjZhuangComp.ts:30-32；XsmjZhuangComp.ts:75）
  - UI 交互：庄家头像庄字标记按档位切换不同图标（1/2/3 档），升庄时播放加庄动画并刷新档位；结算界面直接显示各家得分，没有单列"8倍"倍数文案；杭州房头像庄字图标最多显示三档，萧山数字庄标志按档位显示 xN，档位更大时也不截断。

### 财神与牌组

- 136 张：万、条、筒各 36 张，东南西北 16 张，中发白 12 张。
  - 客户端实现：配置层定义万、条、筒三门各 9 个牌值、东南西北四个牌值与中、发、白三个牌值，数据层按每种牌值 4 张初始化记牌器，白板 4 张进入牌组，牌墙总张数取服务端开局下发值（BoxMahDefine.ts:320-386；BoxMahDefine.ts:590-593；BoxMahDefine.ts:661-667；GameData.ts:1470-1482）
  - UI 交互：记牌器按每种牌初始 4 张显示剩余张数，随出牌与副露递减；白板随财神身份另有染色表现。
- 四张白板都是财神。
  - 客户端实现：收到财神数据后记录本局财神牌值（优先取财神列表首项，其次取翻出牌）与财神类型标记，白板财神模式下桌面财神牌直接以白板牌面展示、不播翻牌动效；财神判定只比较牌值是否等于本局财神牌值，牌值相同的四张白板全部被认定，手牌、牌河、副露、胡牌列表统一按该牌值刷财神颜色（GameData.ts:46-51；GameJokerCmd.ts:40；GameJokerCmd.ts:77-79；GameData.ts:1831-1836；BoxHzmjMahColorUtil.ts:17-29）
  - UI 交互：桌面财神牌位展示白板牌面，白板财神模式无翻牌动画，翻财神模式先隐藏桌面财神牌、待翻牌动画结束后再显示；手中任意一张白板都带财神红色标记（灰化的禁打优先于红色），财神牌可点击、无角标。
- 轮到自己出牌时可以打出财神，不要求已经爆头。打出后按普通白板留在牌河，其他人不能吃、碰、杠，也不能用它点炮胡。
  - 客户端实现：出牌校验只依据服务端下发的禁打列表判断该牌是否被禁，校验链路中不存在爆头状态前置判断，爆头状态仅作为胡牌相关标记记录，点击后直接以牌值上行出牌并播放财神专属出牌语音；出牌消息中的原始牌值直接追加到该玩家的牌河列表，追加后统一刷新财神染色与出牌放大牌面；吃、碰、杠、胡按钮是否出现均取决于服务端下发的操作权限位，吃碰杠与胡牌结果由服务端消息驱动并区分明杠、暗杠、补杠，客户端没有针对"弃牌是财神"的吃碰杠胡过滤逻辑（BoxHzmjMainView.ts:1428-1435；GameData.ts:1789-1804；gameSoundController.ts:105-110；BoxHzmjMah2DView.ts:851-857；BoxHzmjMahColorUtil.ts:32-53；BoxHzmjMainView.ts:549-585；Handler.xml:6-17；GameChowCmd.ts:26-34；GamePungCmd.ts:26-34；GameKongCmd.ts:26-36；GameResultHuCmd.ts:263-326）
  - UI 交互：财神在手牌中可点击抬起与打出，被服务端禁打时灰化并提示"该牌被禁打"，打出时播放财神专属语音与飘计数动效；打出的白板进入牌河后仍被刷上财神红色高亮，其他玩家方向的出牌放大牌面同样带财神红色；有吃、碰、杠、胡权限时显示对应操作按钮，无权限时隐藏，杠时另有单杠多杠选择面板，胡牌后依据服务端给出的放炮座位播放点炮动画、胡牌特效与番型文字。

### 发牌

从牌墙头部、庄家起、按逆时针：

  - 客户端实现：首次抓牌（flag=0）时按正向方向从牌墙头部连续取走“每家手牌数×人数+1”张，并记录需隐藏的牌墙索引；牌墙正反向待抓索引与骰子结果由服务端下发。（source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:94、source-code/client/Code/data/GameData.ts:696、source-code/client/Code/controller/cmd/gameCmd/GameWallMahCmd.ts:33、source-code/client/Code/controller/cmd/gameCmd/GameThrowChipCmd.ts:10、source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:303）
  - UI 交互：掷骰动画后，四个座位按本地座位索引 0~3 依次播放发牌动画。

1. 每人 4 张，发 3 轮，各 12 张。
  - 客户端实现：发牌时取回该座位整手牌，把牌序随机打乱后交给手牌控件整体播放发牌动作，发完再排序；没有按“四张一轮、共三轮”分组处理。（source-code/client/Code/layer/BoxHzmjMainView.ts:1346、source-code/client/Code/layer/BoxHzmjMainView.ts:1350、source-code/client/Code/layer/BoxHzmjMah2DView.ts:770、source-code/client/Code/config/BoxMahDefine.ts:417）
  - UI 交互：自己的手牌以随机顺序逐张落位，落位结束后自动理成有序手牌；其他座位显示整手牌背面。

2. 再每人 1 张，各 13 张。
  - 客户端实现：按服务端下发的座位与手牌数据直接把整手牌写入对应座位，不做张数校验；随后首次抓牌按“该手牌张数×人数+1”推算要取走的牌数，间接依赖每人为13张。（source-code/client/Code/controller/cmd/gameCmd/GameTakeFirstCmd.ts:31、source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:93、source-code/client/Code/data/GameData.ts:69）
  - UI 交互：四家手牌数量一致地铺开，自己为明牌、其他家为牌背。

3. 再给庄家 1 张。庄家 14 张，三名闲家各 13 张，共发出 53 张，余 83 张。
  - 客户端实现：开局第一次抓牌时把抓牌消息中的那张牌追加到抓牌者手牌数据上，最终该座位手牌为整手牌加这一张；同一次抓牌按“每人手牌数×人数+1”计算取牌数量并从牌墙一次性扣除，得到需隐藏的牌墙索引列表，数值由公式推算而非硬编码 53；牌墙剩余数初值取服务端下发的牌墙总数，扣掉发牌取走的张数后作为剩余张数，首出阶段以“牌墙总数－每家起手13张×人数－1”（即83）作为是否进入首出阶段的判定值。（source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:73、source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:94、source-code/client/Code/layer/BoxHzmjMah2DView.ts:806、source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:88、source-code/client/Code/data/GameData.ts:738、source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:142、source-code/client/Code/data/GameData.ts:188、source-code/client/Code/layer/comp/BoxHzmjMahRightComp.ts:28、source-code/client/Code/layer/BoxHzmjMah2DView.ts:353、source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:289）
  - UI 交互：自己的手牌发完后为多一张的整手牌，其他座位仍是牌背，看不出具体张数差异；发牌动画期间牌墙靠前一段牌被取走并隐藏；桌面右侧剩余张数面板显示当前剩余张数，剩余数到达首出判定值时显示庄家/闲家首出提示并收起骰子。

庄家用这 14 张直接进入首轮，不再摸牌。理牌后若已满足自摸，立即给出【自摸】【过】。爆头、七客按其余 13 张判断。
  - 客户端实现：发牌动画结束后把牌桌状态切回“开始”、清除重连标记并上行等待结束，首出阶段由剩余张数识别并按自己是否庄家显示不同提示，出牌权限由服务端下发；开局第一次抓牌同时承担整体发牌动画，抓到的牌直接并入整手牌，不产生单独的摸牌表现，后续抓牌只在 flag 非首次时按正常摸牌流程处理；发牌动画结束后自动排序手牌并回到可行动状态，胡按钮是否出现、按自摸还是点炮样式显示取决于服务端下发的胡权限与胡牌类型，客户端不自行计算自摸；过按钮的显隐由权限中的放弃位决定，与其他操作按钮同组显示，点击后上行取消并收起操作区。（source-code/client/Code/layer/BoxHzmjMainView.ts:1352、source-code/client/Code/layer/BoxHzmjMainView.ts:1354、source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:138、source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:146、source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:66、source-code/client/Code/layer/BoxHzmjMah2DView.ts:805、source-code/client/Code/layer/BoxHzmjMah2DView.ts:806、source-code/client/Code/layer/BoxHzmjMainView.ts:1351、source-code/client/Code/layer/BoxHzmjMainView.ts:583、source-code/client/Code/layer/BoxHzmjMainView.ts:665、source-code/client/Code/layer/BoxHzmjMainView.ts:675、source-code/client/Code/layer/BoxHzmjMainView.ts:1190、source-code/client/Code/layer/BoxHzmjMainView.ts:581、source-code/client/Code/layer/BoxHzmjMainView.ts:557、source-code/client/Code/layer/BoxHzmjMainView.ts:1237）
  - UI 交互：发牌结束立即出现首出提示（庄家/闲家两种文案）与出牌按钮，玩家可直接点牌打出；庄家发牌结束后没有额外的摸牌动画与摸牌位牌张；胡按钮出现时按胡牌类型切换表现，自摸类型显示为自摸样式，并在按钮上展示胡的牌与倍数；过按钮与胡按钮同时出现在操作按钮组中，点击过按钮后按钮收起、手牌灰态清除。
  - 待确认：爆头、七客按其余 13 张判断，客户端代码未找到对应实现

## 行牌

常规摸牌从牌墙头部取 1 张。出牌、吃、碰不减少余牌。胡牌或黄庄成立后，本小局结束。

### 操作优先级

对同一张弃牌：点炮胡 > 碰 / 直杠 > 吃。碰与直杠同级，同时能碰和直杠时不区分先后，按座位号小的先裁决。碰、直杠只发给当前能成立、且座位号最小的那一家。多人可胡时每家都收到胡，近者胡则远者不成立，近者放弃后远者仍可胡。

  - 客户端实现：客户端不计算优先级，只按服务端权限位分别置显胡、碰、杠、吃按钮，同一轮权限可同时打开多个按钮，界面不体现先后关系；碰与杠共用同一操作面板页与同一权限消息，杠按钮不区分明杠、暗杠、补杠，按钮层未设优先级（source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:3、source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:12、source-code/client/Code/layer/BoxHzmjMainView.ts:555）
  - 客户端实现：权限消息按座位下发，客户端换算成本地座位后只为收到该条消息的那一家渲染操作按钮，非本家的权限在常规对局中只触发收起操作面板，不展示他人碰、杠按钮；胡的资格同样以权限位按座位下发，客户端据胡权限位显示胡按钮，接口层保留「是否等待并发」标记，说明存在多人同时待胡的协议结构（source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:53、source-code/client/Code/layer/BoxHzmjMainView.ts:529、source-code/client/Code/interface/GameInterface.ts:15）
  - 客户端实现：玩家点「过」时客户端把放弃请求（带同一轮 askid）发给服务端并收起操作面板，之后是否轮到更远一家由服务端重新下发权限（source-code/client/Code/controller/gameController.ts:462）
  - UI 交互：操作面板切到「碰杠胡」页，吃、碰、杠、胡按钮同屏按水平排布自左向右显示，按钮带闪烁高亮动效，胡按钮额外显示所胡牌面与倍数；碰按钮与杠按钮在「碰杠胡」页同级并列显示，各自独立高亮，有多个杠可选时展开多杠选择列表
  - UI 交互：只有轮到自己那一条权限消息才会弹出碰或杠按钮，他人可操作时不出现其按钮，复盘模式例外，按座位逐家还原；点「过」后胡、碰按钮收起，手牌恢复可操作，放弃有需回包与仅本地收起两种按钮
  - 待确认：碰与直杠并存时按座位号小者先裁决，客户端代码未找到对应实现
  - 待确认：近者胡则远者不成立，客户端代码未找到对应实现

- 只允许一人胡，不一炮多响。多人可胡时，从出牌者起按逆时针，最近的可胡者优先；放弃后顺延。
  - 客户端实现：中局胡牌与结算按服务端胡牌明细处理，客户端以胡牌项条数大于一判定为一炮多响并播放对应动效，未在客户端做只允许一人胡的过滤（source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:144、source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:323）；玩家放弃后客户端上报过牌请求并收起操作面板，不本地决定谁胡，续位由服务端重新下发权限或直接下发结算（source-code/client/Code/layer/BoxHzmjMainView.ts:1237）
  - UI 交互：结算时若收到多条胡牌项，在放炮方位置播放「一炮多响」字效动画，只有一条时播放「点炮」动画；点「过」后操作按钮收起、手牌恢复可点，需回包的过会发请求，仅本地收起的过2 不发请求
  - 待确认：多人可胡时从出牌者起按逆时针最近的可胡者优先，客户端代码未找到对应实现
- 低优先级先提交时，先等全部更高优先级的玩家手动放弃，再执行。更高优先级一旦成立，其余响应取消。
  - 客户端实现：点吃、碰、杠、胡后客户端只发送请求并收起面板，不本地执行动作，副露表现要等服务端动作广播到达后才出现（source-code/client/Code/layer/BoxHzmjMainView.ts:1102、source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:48）；收到吃、碰、杠、胡等动作成立的服务端广播后，客户端统一派发关闭操作事件，把操作面板复位、清空多选列表并撤销可出牌状态（source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:44、source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:44、source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:46、source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:241、source-code/client/Code/layer/BoxHzmjMainView.ts:494）
  - UI 交互：点击吃、碰、杠后按钮收起、手牌置灰恢复，真正的副露摆放要等服务端广播回来才出现；他人的吃、碰、杠、胡一旦成立，自己面板上的吃碰杠胡按钮立即消失，手牌恢复为不可直接出牌状态，同时播放对应的动作动画
- 吃只能吃上家。
  - 客户端实现：吃牌组合由服务端在权限消息中下发，客户端只按组合展示与上报；副露记录时按组合的进牌来源座位把进张从该家牌河移除，代码内未见来源必须是上家的校验（source-code/client/Code/layer/BoxHzmjMainView.ts:1088、source-code/client/Code/data/GameData.ts:779、source-code/client/Code/data/PlayerCardsData.ts:87）
  - UI 交互：可吃时出现吃按钮；存在多种吃法时弹出三张一组的吃法选择列表，选中后立即上报

### 吃、碰、杠

风牌、箭牌不能做顺子，不能吃；不是财神时可以碰、杠。
  - 客户端实现：吃牌组合完全由服务端下发，客户端不做花色与连续性校验，只按组合牌面排序并渲染，仅摸牌凑顺动画限定万、条、筒（source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:34、source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:224）；碰、杠组合同样按服务端下发的组合渲染，客户端不按花色过滤，展示层对组合牌只做牌值排序与财神插位，不区分万条筒与风箭（source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:34、source-code/client/Code/data/PlayerCardsData.ts:819）
  - UI 交互：吃按钮与吃选项只按服务端给出的组合展示，客户端不额外过滤风牌、箭牌；风牌、箭牌的碰杠组合可在副露区正常显示，牌面资源表包含东南西北中发白

- **吃**：上家刚打出的 1 张非财神，与手中 2 张非财神组成同花色连续顺子。多种合法组合时选 1 组。成功后不摸牌，进入出牌。当前回合可以加杠或暗杠。
  - 客户端实现：收到吃牌消息后按服务端组合生成副露，从出牌者牌河移除最后一张进牌，手牌扣两张，副露区新增一组三张顺子，并按进牌实际槽位刷新来源箭头（source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:34、source-code/client/Code/data/PlayerCardsData.ts:91、source-code/client/Code/data/PlayerCardsData.ts:789、source-code/client/Code/layer/BoxHzmjMah2DView.ts:938）；吃牌组合数量大于 1 时点击吃按钮进入选择态，展示每组完整三张的选项池，点选某组后按该组索引取出组合并发送吃牌请求，只发送一组（source-code/client/Code/layer/BoxHzmjMainView.ts:1089、source-code/client/Code/layer/BoxHzmjMainView.ts:1113、source-code/client/Fgui/assets/box_hzmj_main/component/ChooseGang.xml:5）；吃牌消息处理只更新副露与手牌、收起操作按钮，不触发抓牌流程，出牌能力由随后下发的操作权限中的出牌位开启（source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:44、source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:79、source-code/client/Code/layer/BoxHzmjMainView.ts:536）；同一回合若操作权限同时给出杠位，客户端显示杠按钮并按组合类型列出暗杠、加杠选项，与摸牌无关的杠不置灰手牌且不必先点过（source-code/client/Code/layer/BoxHzmjMainView.ts:554、source-code/client/Code/layer/BoxHzmjMainView.ts:609）
  - UI 交互：副露区新增一组顺子，来源箭头指向被吃进的那张牌所在槽位；多种合法组合时点击吃按钮弹出多吃选项池，每组并列展示完整三张牌并支持换行，同时出现取消按钮，点选一组立即发送吃牌并收起选项；吃完牌后操作按钮收起，手牌进入可出牌状态，此时待出末张按普通手牌布局，不占摸牌单放位；吃完后仍出现杠按钮，点杠弹出可杠牌列表，选中即发送杠，对应手牌保持可点击

- **碰**：任意他人刚打出的 1 张非财神，与手中 2 张相同非财神组成刻子。手中有 3 张也只用 2 张。成功后不摸牌，进入出牌。当前回合可以加杠或暗杠。
  - 客户端实现：收到碰牌消息后按服务端组合生成副露，从出牌者牌河移除最后一张进牌，手牌扣两张，副露区新增一组三张刻子（source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:34、source-code/client/Code/data/PlayerCardsData.ts:789、source-code/client/Code/layer/BoxHzmjMah2DView.ts:895）；碰牌扣牌固定取组合中的两张，组合数据结构会先剔除进牌，因此手牌只减两张，第三张留在手中，其他座位的记牌器也只加两张（source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:36、source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:37、source-code/client/Code/data/PlayerCardsData.ts:786）；碰牌消息处理只更新副露与手牌并收起操作按钮，不触发抓牌流程，出牌能力由随后下发的操作权限中的出牌位开启（source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:44、source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:119、source-code/client/Code/layer/BoxHzmjMainView.ts:536）；同一回合若操作权限同时给出杠位，客户端显示杠按钮并按组合类型列出暗杠、加杠选项，与摸牌无关的杠不置灰手牌（source-code/client/Code/layer/BoxHzmjMainView.ts:554、source-code/client/Code/layer/BoxHzmjMainView.ts:697）
  - UI 交互：副露区新增一组刻子，并刷新进牌来源箭头；碰后副露显示三张，自己的手牌只少两张，手里仍剩一张同牌；碰完牌后操作按钮收起，手牌进入可出牌状态，待出末张不占摸牌单放位；碰完后同一回合仍出现杠按钮与可杠牌列表

- **直杠**：他人刚打出的 1 张非财神，与手中 3 张相同非财神。按优先级裁决后，从牌墙尾部补牌。
  - 客户端实现：收到明杠消息后生成四张副露，清空出牌放大展示，手牌扣三张（四张组合剔除进牌），并播放明杠动效与杠音效（source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:37、source-code/client/Code/data/PlayerCardsData.ts:789、source-code/client/Code/layer/BoxHzmjTipAniView.ts:504）；杠本身不发起摸牌，补牌由服务端下发抓牌消息，客户端按消息中的抓牌方向让牌墙对应位置的牌消失并播放摸牌动画，方向为反向时从牌墙另一端取牌（source-code/client/Code/data/GameData.ts:687、source-code/client/Code/data/GameData.ts:723、source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:45）
  - UI 交互：副露区出现一组四张明杠，播放杠动画与杠音效，其他座位记牌器同步减少；杠后牌墙从另一端少一张，玩家补进一张牌并播放摸牌动画
  - 待确认：直杠按优先级裁决后成立，客户端代码未找到对应实现

- **加杠**：出牌阶段，已碰出的刻子手里有第 4 张非财神。先征求抢杠胡。有人抢杠胡则加杠不成立、不补牌。无人胡再完成加杠并补牌。
  - 客户端实现：收到补杠消息后在已有副露中查找同牌值的碰组合，把该组原位替换为杠（不新增副露组），手牌扣一张，并重算该组相关的听牌信息（source-code/client/Code/data/PlayerCardsData.ts:99、source-code/client/Code/data/PlayerCardsData.ts:106、source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:64、source-code/client/Code/layer/BoxHzmjMah2DView.ts:910）；客户端有抢杠胡类型与「抢杠/被抢杠」文案，胡牌结果按抢杠胡走点炮式展示，另存在把补杠副露拆回碰的本地回滚函数，但当前代码中未被调用（source-code/client/Code/config/GameDefine.ts:149、source-code/client/Code/data/PlayerCardsData.ts:444、source-code/client/Code/util/BoxHzmjFlowUtil.ts:119、source-code/client/Code/layer/BoxHzmjMainView.ts:671）；无人抢杠时由服务端下发补杠消息，客户端完成碰升级为杠，随后的补牌同样由服务端下发抓牌消息，客户端只播动画（source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:63、source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:288）
  - UI 交互：原来位于副露区的碰变成四张的杠，副露组数不变；抢杠胡时胡牌动效按点炮式播放，结算流水显示「抢杠胡/被抢杠」；碰变杠后从牌墙补进一张牌

- **暗杠**：出牌阶段手中 4 张相同非财神。完成后补牌。暗杠下层 3 张牌背、顶张正面，四家都能认出牌面。暗杠放在碰杠区，但不计副露。
  - 客户端实现：收到暗杠消息后手牌扣四张、副露区新增一组暗杠，并按暗杠类型播放暗杠动效与暗杠音效，补牌由随后的抓牌消息驱动（source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:55、source-code/client/Code/layer/BoxHzmjTipAniView.ts:509、source-code/client/Code/data/PlayerCardsData.ts:789）；杠组合按原始顺序展示，暗杠牌背按原位处理，组合区在切换牌背皮肤时会统一刷新牌背（source-code/client/Code/config/BoxMahDefine.ts:799、source-code/client/Code/layer/BoxHzmjMah2DView.ts:1293）；暗杠与其他杠一样加入座位旁的组合牌区，「是否计副露/摊」完全按服务端下发的摊数据刷新，客户端不自行累计（source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:72、source-code/client/Code/controller/cmd/gameCmd/GameTanUpdateCmd.ts:21、source-code/client/Code/controller/cmd/gameCmd/GameTanUpdateCmd.ts:27）
  - UI 交互：副露区出现一组暗杠，播放暗杠动效与暗杠音效，随后补进一张牌；暗杠在副露区显示为一组牌，底层为牌背、最上一张为正面；暗杠显示在碰杠区，摊计数与三摊提示按服务端消息刷新

- 吃或碰刚成立的当前回合，同样可以加杠、暗杠。四张相同就可以杠，杠完这条就不再按七对结算。
  - 客户端实现：与吃、碰条目共用同一机制，同一回合操作权限给出杠位即显示杠按钮并列出可杠牌，与摸牌无关的杠不置灰手牌且不必先点过（source-code/client/Code/layer/BoxHzmjMainView.ts:1445、source-code/client/Code/layer/BoxHzmjMainView.ts:701）；客户端按服务端给出的杠组合收集可杠牌值，暗杠、明杠、补杠统一进入可杠列表，多个可杠项时展示多杠列表供选择（source-code/client/Code/layer/BoxHzmjMainView.ts:639、source-code/client/Code/layer/BoxHzmjMainView.ts:835、source-code/client/Fgui/assets/box_hzmj_main/component/GangGrps.xml:4）
  - UI 交互：吃碰后同一回合出现杠按钮与多杠选项，相关手牌保持可点击；出现杠按钮时按可杠牌值展示单张或列表，点选某项即发送杠
  - 待确认：杠完这条就不再按七对结算，客户端代码未找到对应实现

- 受尚未解除的飘财限制时，不能吃、碰、直杠、加杠，仍可暗杠。暗杠后只能打尾墩刚补进的那一张。
  - 客户端实现：吃按钮是否出现完全由服务端操作权限的吃位决定，客户端只记录飘计数并驱动飘动效，没有基于飘状态隐藏吃按钮的逻辑（source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts:21、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1680、source-code/client/Code/layer/BoxHzmjMainView.ts:552）；碰按钮是否出现由服务端操作权限的碰位决定，客户端没有根据飘状态屏蔽碰按钮的逻辑（source-code/client/Code/layer/BoxHzmjMainView.ts:553、source-code/client/Code/layer/BoxHzmjMainView.ts:579）；杠按钮由服务端操作权限的杠位统一控制，可杠项按组合类型收集，客户端不按飘状态过滤明杠、补杠（source-code/client/Code/layer/BoxHzmjMainView.ts:639、source-code/client/Code/config/BoxMahDefine.ts:208、source-code/client/Code/layer/BoxHzmjMainView.ts:652、source-code/client/Code/layer/BoxHzmjMainView.ts:611）；可杠列表按服务端下发的杠组合类型生成，暗杠与明杠、补杠共用同一个入口，若服务端只给暗杠组合，客户端只列出暗杠项（source-code/client/Code/layer/BoxHzmjMainView.ts:636、source-code/client/Code/layer/BoxHzmjMainView.ts:654、source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:55）；客户端按出牌限制消息区分禁打手牌与禁打单放，被禁的牌置灰且不可点击，点击被禁的牌会提示「该牌被禁打」（source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:33、source-code/client/Code/data/GameData.ts:1799、source-code/client/Code/layer/BoxHzmjMainView.ts:1432）
  - UI 交互：飘计数增加时播放飘动效，吃、碰、杠按钮是否可见取决于服务端权限位，飘财限制期间若服务端不给碰位则碰按钮不出现；飘财限制期间若服务端不给杠位或只给暗杠组合，杠按钮不出现或点开只列出可暗杠的牌；暗杠补牌后若服务端下发禁打列表，只有刚补进的那张可点，其余置灰

### 杠后补牌

每次杠从牌墙尾部补 1 张，余牌减 1。牌墙少于 21 张不能杠。剩 20 张及以下时，下一次摸牌前黄庄。
  - 客户端实现：杠后补牌没有独立事件，统一由抓牌通知驱动：抓牌命令使用通知中的方向与张数调用牌墙取牌，牌墙取牌方法区分正向抓牌与反向（尾部）抓牌两个分支，反向分支从尾部索引逐张取牌，并按本次取牌张数扣减剩余张数；抓牌命令随后广播牌墙剩余张数，牌墙右侧组件把新数值写入标题文本；客户端不判断黄庄时机，只在收到流局结局时按流局类型处理：小结算把自己标记为流局状态，结算流水不生成赢家明细。（source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:88-91、source-code/client/Code/data/GameData.ts:723-726、source-code/client/Code/lib/proto_game_hzmj.d.ts:1151-1155、source-code/client/Code/data/GameData.ts:738、source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:289、source-code/client/Code/layer/comp/BoxHzmjMahRightComp.ts:26-28、source-code/client/Code/controller/cmd/gameCmd/GameWallMahCmd.ts:43-44、source-code/client/Code/config/MatchTipConfig.ts:39、source-code/client/Code/util/BoxHzmjResultUtil.ts:35-39、source-code/client/Code/util/BoxHzmjFlowUtil.ts:29-31、source-code/client/Code/protocol/GameGlcProtocol.ts:114、source-code/client/Fgui/assets/box_hzmj_tipAni/package.xml:79）
  - UI 交互：取到的牌插入该家手牌并亮出，非自己时按手牌计数更新，同时刷新牌墙剩余张数；牌墙右侧数字在每次抓牌与补牌后刷新，重连恢复时也按剩余张数重刷，牌墙显示受对局内牌墙开关控制；匹配界面提示文案出现「剩余20张牌前无人胡牌则流局」，小结算按流局展示自己的输赢状态，提示动画包内打包了流局文字图。
  - 待确认：牌墙少于 21 张不能杠，客户端代码未找到对应实现

杠后可以继续杠，每次重新检查牌墙不少于 21 张。补牌可以自摸；不胡则继续杠或打出 1 张。明杠、暗杠、加杠都使杠链加 1。吃、碰，或打出非财神，或打出财神但打出后不再敲响，杠链归零。
  - 客户端实现：客户端不记录本回合是否已杠过，每次收到权限都按服务端给的可杠牌组重建可杠列表并据此显示杠按钮，杠后再次收到杠权限时照常给出杠入口，选中后发送杠请求；胡按钮按权限显示，胡牌类型为自摸时把胡按钮动画切成自摸字效，点胡后发送胡请求，胡牌类型枚举区分自摸、点炮、抢杠，杠后自摸另有专属番型字效；自己摸牌后客户端开启出牌任务与听牌按钮检查，点击手牌即按单张出牌发送出牌请求，同时保留杠入口供选择继续杠；客户端不维护杠链计数，收到明杠消息时按杠类型播明杠动作动画与明杠音效、清理出牌操作区并把杠组作为副露渲染，收到暗杠消息时按暗杠类型播暗杠动作与暗杠音效，并把暗杠按原有牌序作为副露渲染（牌背按原位），收到补杠消息时按补杠类型播补杠动作与补杠音效，并走独立的补杠渲染通道把第 4 张加到已有碰组上，杠链的实际效果只体现在杠后自摸时服务端下发的番型上；吃牌与碰牌处理只做副露渲染、动作动画与操作区关闭，没有任何杠链计数或连杠档位重置逻辑；出牌处理只更新牌河与手牌、刷新听牌提示并收起操作区，不区分财神与非财神的杠链效果，也没有杠链清零逻辑；对打出财神只有飘状态处理：收到飘状态通知后更新该座位的飘计数并重绘飘表现，客户端没有敲响判定，也没有杠链计数或清零逻辑。（source-code/client/Code/layer/BoxHzmjMainView.ts:601-611、source-code/client/Code/layer/BoxHzmjMainView.ts:1140-1154、source-code/client/Code/data/GameData.ts:881-884、source-code/client/Code/layer/BoxHzmjMainView.ts:663-666、source-code/client/Code/layer/BoxHzmjMainView.ts:670-675、source-code/client/Code/config/GameDefine.ts:421-431、source-code/client/Code/config/FanDefine.ts:25-29、source-code/client/Code/layer/BoxHzmjMainView.ts:1481-1482、source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:290-294、source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:51-52、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1132-1135、source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:54-55、source-code/client/Code/layer/BoxHzmjTipAniView.ts:509-512、source-code/client/Code/config/BoxMahDefine.ts:804-809、source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:57-58、source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:63-65、source-code/client/Code/layer/BoxHzmjMah2DView.ts:907-910、source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:43、source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:43、source-code/client/Code/controller/cmd/gameCmd/GamePlayCmd.ts:67、source-code/client/Code/controller/cmd/gameCmd/GamePlayCmd.ts:89-96、source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts:21-24、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1675-1680）
  - UI 交互：杠按钮按权限显示并循环发光，存在多个可杠选项时弹出可杠牌列表供点选，选中后收起操作区并置灰手牌；胡按钮展示本次胡的牌与倍数，字效按胡牌类型切换（自摸显示自摸样式，点炮与抢杠显示胡样式）并循环发光，杠后自摸按番型播放杠上开花、二连杠、三连杠、四连杠等杠开系档位字效；点手牌出牌后收起操作区并清灰，杠按钮仍按权限显示，玩家可选择杠而非出牌；明杠、暗杠、补杠分别播放对应的动作动画与音效，桌面新增杠副露，补杠把已碰组的副露替换为杠组；吃、碰分别播放对应动作动画与音效，桌面新增副露组，操作区收起；出牌播放出牌动画与出牌音效，牌进入牌河，本回合操作区关闭；打出财神后播放飘的动作字效，飘计数按服务端下发值刷新。
  - 待确认：杠后继续杠时，每次重新检查牌墙不少于 21 张，客户端代码未找到对应实现

### 自摸、放铳、抢杠胡

- **自摸**：常规摸牌、杠后补牌，或庄家起手第 14 张，在出牌前胡牌。常规结构是 4 组面子加 1 组对子。
  - 客户端实现：常规摸牌由抓牌消息把摸到的牌加入自己手牌并刷新摸牌动效，胡权限消息到达后主界面把胡按钮置为可见，并用所胡的牌值、倍数、胡类型刷新按钮贴图，点胡按钮只发送一条单人和请求，客户端不做合法性判断；杠后补牌时杠消息只做副露合成与杠动画，补杠把第 4 张合入已亮出的刻子，客户端没有独立的补牌下行命令处理器，补牌协议只做了定义与解码，杠后补牌只能靠服务端改用通用抓牌消息驱动，再按胡权限弹按钮；庄家起手第 14 张没有专门分支，发牌消息把整副起手牌写入手牌并刷新牌墙与牌数，能否胡仍取决于权限消息，只要胡权限到就亮胡按钮（source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:73、source-code/client/Code/layer/BoxHzmjMainView.ts:583、source-code/client/Code/layer/BoxHzmjMainView.ts:666、source-code/client/Code/layer/BoxHzmjMainView.ts:1183、source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:731、source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:63、source-code/client/Code/controller/cmd/CmdDefine.ts:38、source-code/client/Code/protocol/GameGlcProtocol.ts:116、source-code/client/Code/controller/gameController.ts:77、source-code/client/Code/controller/cmd/gameCmd/GameTakeFirstCmd.ts:31、source-code/client/Code/data/GameData.ts:69、source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:142）
  - UI 交互：摸牌后操作区出现胡按钮，自摸用 zimo 贴图，按钮上显示所胡的牌面与倍数，按钮播放高亮动画并切到碰杠胡按钮态，点下后按钮收起，进入胡牌流程；补杠时已亮出的三张牌变为四张，补摸到牌后与其他摸牌一致，出现胡按钮与牌面、倍数；发牌后手牌摊开，若有胡权限立即在操作区出现胡按钮，首出阶段另有庄家提示文案与听牌动画，与是否可胡无关。
  - 客户端实现：胡牌后客户端按服务端下发的亮牌数据把手牌摊成若干副露组合加一张单放牌并渲染，副露展示上限按 4 组配置；客户端没有对「4 组面子加 1 组对子」的结构校验（source-code/client/Code/config/BoxMahDefine.ts:60、source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:176、source-code/client/Code/layer/BoxHzmjMah2DView.ts:984）
  - UI 交互：胡牌时摊开手牌，副露按组依次排列，最后单列胡的那张牌；结算行里也按组还原牌型。
- **放铳**：本期固定庄闲放铳。当局是三牢，且出牌者与胡牌者正好一边是庄、一边是闲，同时牌型合法，才能点炮胡。庄家打出的牌只有闲家可胡，闲家打出的牌只有庄家可胡。未形成这个关系时只能自摸。只由放铳者赔付。
  - 客户端实现：客户端具备点炮胡的完整表现链路，胡类型含点炮、放炮动画按点炮者座位播放、结算行能把被胡的座位标成点炮、流水同时有点炮胡与放炮两类文案；但没有读取或开关「庄闲放铳」这一玩法模式（source-code/client/Code/config/FanDefine.ts:553、source-code/client/Code/config/FanDefine.ts:637、source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:734、source-code/client/Code/layer/BoxHzmjTipAniView.ts:891）
  - UI 交互：胡牌时在被放炮的玩家位置播点炮或一炮多响动画，结算里胡牌者显示点炮胡、放铳者显示点炮标记。
  - 客户端实现：客户端保存牢庄等级（1 一牢、2 二牢、3 三牢），并据此提供庄闲倍数（2、4、8）的计算入口，该值由对局数据与结算数据更新；未见用牢庄等级判定是否允许点炮胡（source-code/client/Code/data/GameData.ts:1593、source-code/client/Code/data/GameData.ts:1664、source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:118）
  - UI 交互：结算与桌面能体现庄家牢庄档位信息；未见针对「三牢」变化的点炮资格提示。
  - 待确认：客户端代码未找到对应实现（出牌者与胡牌者正好一边是庄、一边是闲且牌型合法才能点炮胡的判定）
  - 待确认：客户端代码未找到对应实现（庄家打出的牌只有闲家可胡、闲家打出的牌只有庄家可胡）
  - 待确认：客户端代码未找到对应实现（未形成庄闲关系时只能自摸）
  - 客户端实现：结算按服务端下发的座位得失分逐座位写入桌面分数，只对分数不为 0 的座位刷新并飘分；点炮场景下胡牌者得到点炮胡流水、放铳者得到放炮流水，其余两家没有胡相关流水，赔付主体与金额均由服务端计算（source-code/client/Code/config/FanDefine.ts:555、source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:206、source-code/client/Code/layer/BoxHzmjTipAniView.ts:703、source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:734）
  - UI 交互：结算时各座位依次飘出得分或失分，只有分数有变化的座位才飘；结算行里胡牌者显点炮胡、放铳者显放炮，其余两家无该流水。
- **抢杠胡**：与放铳相同，只有三牢的庄闲之间可以抢。所加的第 4 张须使响应者合法胡牌。只由被抢的加杠者按放铳赔付，其他人不付。
  - 客户端实现：协议与枚举里存在独立的抢杠胡类型（自摸 1、点炮 2、抢杠 3），结算里会把抢杠识别为点炮类胡牌并把胡牌来源指向被抢者；客户端胡按钮对点炮与抢杠统一用「胡」贴图，自摸才用「自摸」贴图；仅限三牢庄闲的资格判断无客户端实现（source-code/client/Code/config/BoxMahDefine.ts:897、source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:339、source-code/client/Code/layer/BoxHzmjMainView.ts:671、source-code/client/Code/layer/BoxHzmjTipAniView.ts:929）
  - UI 交互：可以抢杠时与点炮一致，出现带「胡」贴图的按钮与牌面、倍数；胡牌后播点炮类动画，结算行显示吃胡。
  - 待确认：客户端代码未找到对应实现（所加的第 4 张须使响应者合法胡牌）
  - 客户端实现：结算流水区分抢杠胡与被抢杠两类成对文案，抢杠被当作点炮类胡牌，胡牌来源座位指向被抢的加杠者，被抢者牌河里没有对应牌因此不做移除；结算会跳过被自摸、放炮、被抢杠这类输家流水类型，只为有分数变化的座位飘分与显示流水，因此抢杠场景下其余两家不会出现抢杠相关流水（source-code/client/Code/config/FanDefine.ts:557、source-code/client/Code/config/FanDefine.ts:639、source-code/client/Code/util/BoxHzmjFlowUtil.ts:119、source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:171、source-code/client/Code/layer/BoxHzmjMah2DView.ts:997、source-code/client/Code/config/FanDefine.ts:559、source-code/client/Code/util/BoxHzmjFlowUtil.ts:241、source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:206）
  - UI 交互：结算行里胡牌者显抢杠胡、被抢者显被抢杠，金额按点炮口径显示，桌面按座位飘分；抢杠结算时只有胡牌者与被抢者两个座位有分数浮动和胡相关流水，其余两家结算行不显示抢杠内容。

### 飘财

全场同时只有一个飘财窗口。打出财神的玩家成为所有者，限制另外三家。之后再有人打出财神，窗口直接换到这个人，不叠加。受限玩家若被逼打出刚摸到的财神，窗口就转到他身上。

  - 待确认：客户端代码未找到对应实现
  - 客户端实现：收到针对某座位的出牌限制后，按该座位缓存禁打手牌与禁打单放牌值，只有受限座位是自己时才驱动界面刷新（GamePlayLmtsCmd.ts:31；GamePlayLmtsCmd.ts:45；GameData.ts:1738-1741；GamePlayLmtsCmd.ts:10）
  - UI 交互：自己受限时手牌灰化并被拦截出牌，其他座位没有专属表现。
  - 客户端实现：新的限制内容整体覆盖上一份受限座位与禁打列表，不做累加；限制被清空时调用清空接口把座位重置为空（GameData.ts:1739-1741；GamePlayLmtsCmd.ts:37-38；GamePlayCmd.ts:72）
  - UI 交互：灰态按最新一份限制重算；限制包为空时解除缓存。
  - 待确认：客户端代码未找到对应实现

- 受限时可以胡牌和暗杠，不能吃、碰、直杠、加杠。只能打刚摸进或最新补进的那一张，其余手牌压暗，只在自己界面显示。这份限制盖过吃碰禁手。
  - 客户端实现：胡与杠按钮只按服务端下发的权限位与可选组合显示，客户端没有飘财态下额外放开胡或暗杠的判断；吃、碰、杠按钮完全由服务端权限位与可选组合列表决定，客户端不自行做飘财相关的禁用判断（BoxHzmjMainView.ts:552-559；BoxHzmjMainView.ts:583；MatchTipConfig.ts:41；GamePowerCmd.ts:53；BoxHzmjMainView.ts:578-580；BoxHzmjMainView.ts:636-650）
  - UI 交互：受限时只要服务端给了权限，操作区仍出现胡按钮与杠按钮，暗杠并入杠按钮的多杠选择；若服务端未下发吃碰杠权限，对应按钮不出现，一旦下发则正常显示。
  - 客户端实现：服务端下发禁打手牌与禁打单放牌值，客户端按摸牌标记区分手牌位与单放位并拦截被禁的牌（GamePlayLmtsCmd.ts:33-35；GameData.ts:1789-1803；BoxHzmjMainView.ts:1432-1434；MatchTipConfig.ts:41）
  - UI 交互：被禁的牌不可触摸，强行出牌会被拦下并弹出「该牌被禁打」。
  - 客户端实现：按禁打列表逐张把被禁手牌染灰并设为不可触摸，界面刷新只作用于自己手牌区（BoxHzmjPlayerHandCards.ts:108-113；BoxHzmjMainView.ts:1272-1278；GameData.ts:1779-1781）
  - UI 交互：受限时被禁手牌变灰、不可点，只有自己手牌区发生变化。
  - 客户端实现：客户端对吃碰禁手被拦、财飘出牌限制被拦、只碰不吃三类拦截分别弹不同文字提示，没有优先级合并逻辑（GameDefine.ts:471-472；GameNotifyInfoCmd.ts:61-63；GameDefine.ts:469-470）
  - UI 交互：命中不同拦截原因时分别弹出「吃禁手规则生效中」「有财必拷响规则生效中」「只碰不吃规则生效中」。
- 所有者自己下一次出牌时先关掉窗口。这张若又是财神，立刻重开。
  - 客户端实现：出牌处理中明确不清除禁打列表，只在本回合结束时清掉手牌灰态，真正解除依赖服务端新包或空包（GamePlayCmd.ts:72；GamePlayCmd.ts:123；BoxHzmjMainView.ts:1628-1636）
  - UI 交互：自己出牌后手牌恢复亮色，禁打数据仍保留，等待下一次限制内容刷新。
  - 待确认：客户端代码未找到对应实现
- 飘档只在打出财神、且打出后手牌仍然敲响时加 1。没敲响就打财神，飘档和杠链都归零。打出普通牌同样归零。各家飘档独立。吃、碰、杠不清飘档，吃和碰会清杠链。
  - 客户端实现：客户端不计算飘档，只保存服务端下发的飘次数，结算档位靠服务端下发的番型编号映射名称（GamePiaoCmd.ts:8-10；GamePiaoCmd.ts:21；FanDefine.ts:308-314）
  - UI 交互：次数大于 0 时播放飘字；结算时按档位显示财飘、双财飘、三财飘名称。
  - 客户端实现：客户端没有杠链数据，也没有飘档归零计算；只在收到次数为 0 或负数时跳过飘字表现（BoxHzmjTipAniView.ts:1675-1677）
  - UI 交互：次数为 0 时不播放飘字，界面无其他反馈。
  - 客户端实现：出牌处理流程中没有飘次数归零动作，计数变化完全由服务端下发的飘状态决定（BoxHzmjTipAniView.ts:1675-1677；GamePlayCmd.ts:59-75）
  - UI 交互：计数归零后不再播放飘字。
  - 客户端实现：按座位数组分别保存四个座位的飘次数，飘状态按座位写入，不聚合成共享计数（GameData.ts:1601；GamePiaoCmd.ts:21；GameData.ts:1699-1700）
  - UI 交互：飘字动画按座位对应的碰杠节点播放，各家互不影响。
  - 客户端实现：飘次数的写入与清零只出现在飘状态处理与小局重置两个位置，吃碰杠处理流程不修改飘次数（GameData.ts:2019；GameData.ts:1699-1707；GameChowCmd.ts:32-34）
  - UI 交互：吃碰杠后飘字与飘次数保持不变。
  - 待确认：客户端代码未找到对应实现
- 飘次数本局累加，小局重置时清掉。次数大于 0 时，在该座位碰杠位播放「飘」字，没有常驻标签。
  - 客户端实现：保存服务端下发的累计飘次数，重连时用重连包中的数组恢复；小局重置（重置界面）时把四个座位计数一起清零（GamePiaoCmd.ts:21；GameData.ts:2015-2019；BoxHzmjMainView.ts:401；SceneActionCmd.ts:77-78）
  - UI 交互：新一局开始后不残留上一局的飘字与计数。
  - 客户端实现：收到飘状态后把服务端座位换算成本地座位，复用该座位的碰杠动作节点，切换到飘皮肤后播放骨骼动画；飘状态处理只触发一次性动画，动画结束回调把节点隐藏，不写入任何文本或角标，飘次数取值接口在界面层没有调用方（BoxHzmjTipAniView.ts:1672-1681；BoxHzmjTipAniView.ts:517-524；BoxHzmjTipAniView.ts:183；HzmjTipAniComponent.xml:44-55；Paixing_wz03.json:1；BoxHzmjTipAniView.ts:531-533）
  - UI 交互：在该玩家碰杠位置闪出「飘」字动画并自动消失，之后不残留任何飘相关标签或数字。

### 杠开、杠飘、飘杠

- **杠上开花 / 二连杠 / 三连杠 / 四连杠**：自摸且杠链为 1 / 2 / 3 / 4 及以上，倍数 2 / 4 / 8 / 16。四连杠及以上都记 16 倍。杠链已断后再胡，不是杠开。
  - 客户端实现：番型层定义 2406~2409 四个杠开番型 ID 与中文名（杠上开花/二连杠/三连杠/四连杠），结算/动效层按主番型选择皮肤 gk/2lgk/3lgk/4lgk，客户端不自行统计杠链；杠开档位解析最多返回 4、只有到四连杠 2409 的档位，未见 5 次及以上连杠的额外档位或映射；是否自摸按 hu_type 判定（非点炮/抢杠/点杠花即自摸），据此选择胡牌表现与语音，另有“有杠牌且已有听牌”的杠开可行性辅助判断用于提示；客户端不参与倍数计算，倍数 2/4/8/16 只以番型代码注释与萧山动画候选比较表形式存在，实际总倍数取服务端下发的 fan_point（source-code/client/Code/config/FanDefine.ts:25、source-code/client/Code/config/FanDefine.ts:26、source-code/client/Code/config/FanDefine.ts:28、source-code/client/Code/config/FanDefine.ts:30、source-code/client/Code/config/FanDefine.ts:31、source-code/client/Code/config/FanDefine.ts:32、source-code/client/Code/config/FanDefine.ts:80、source-code/client/Code/config/FanDefine.ts:298、source-code/client/Code/config/XsmjFanConfig.ts:4、source-code/client/Code/layer/BoxHzmjTipAniView.ts:929、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1132、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1139、source-code/client/Code/config/GameSoundConfig.ts:432、source-code/client/Fgui/assets/box_hzmj_tipAni/effect/Paixing_wz04.json:1、source-code/client/Code/data/GameData.ts:411、source-code/client/Code/controller/cmd/gameCmd/GameWaitInfoCmd.ts:83、source-code/client/Code/config/GameDefine.ts:425）
  - UI 交互：胡牌后在胡牌座位播放牌型 Spine 动效（杠开系走 KW_Ani_Hu 特效节点）并播放对应番型语音，桌面与流水文案显示番型名，四连杠播放 4lgk 特效与四连杠语音，更高连杠没有独立动效资源、归到四连杠表现；自摸与点炮播放不同语音与表现，有杠权限且存在杠开可能时弹出提示气泡（气泡文案在外部平台模块）；好友房流水只显示番型名、不拼倍数，匹配场在流水文案后追加“N倍”，玩家最终看到的是结算分数。
  - 待确认：杠链已断后再胡不是杠开，客户端代码未找到对应实现
- **杠飘、飘杠**：只在同时命中杠上开花和财飘时拆出，倍数 8，再乘上基础番。杠发生时飘档已经大于 0，记飘杠；否则记杠飘。二连杠、双财飘及更高档不拆，仍按各组连乘。没有单独的杠爆、七客。
  - 客户端实现：番型判定函数把 2406-2409 与 2419/2420 视为杠系、2403-2405 与 2419/2420 视为财飘系，“杠系且财飘系”同时命中或直接命中 2419/2420 时归为杠飘组合档；2419 注释“先杠后飘”（杠时飘档为 0）、2420 注释“先飘后杠（财飘后杠开）”（杠时飘档已大于 0），结算时含 2419 不含 2420 按杠飘解析（皮肤 gp），只下发拆分番型（杠开+财飘）时也默认按杠飘解析，含 2420 不含 2419 按飘杠输出专属皮肤 pg 与专属语音；2407+2404 等高档组合仍归并为同一个杠飘组合动效档、不做分档拆分；2419/2420 在番型注释中标注 8 倍并出现在动画倍率比较表，代码注释说明最终倍数由基础/七对组、杠开组、财神组三组最高档连乘，但客户端不做倍数与连乘计算，只按下发番型拼文案、按下发分数展示；番型表没有杠爆、七客的独立番型 ID，只在“杠开×爆头”“七对×爆头/财飘”组合时以组合名选择动效与文案，不额外生成独立加分番型（source-code/client/Code/config/FanDefine.ts:12、source-code/client/Code/config/FanDefine.ts:51、source-code/client/Code/config/FanDefine.ts:52、source-code/client/Code/config/FanDefine.ts:53、source-code/client/Code/config/FanDefine.ts:54、source-code/client/Code/config/FanDefine.ts:136、source-code/client/Code/config/FanDefine.ts:146、source-code/client/Code/config/FanDefine.ts:158、source-code/client/Code/config/FanDefine.ts:256、source-code/client/Code/config/FanDefine.ts:257、source-code/client/Code/config/FanDefine.ts:350、source-code/client/Code/config/FanDefine.ts:351、source-code/client/Code/config/FanDefine.ts:364、source-code/client/Code/config/FanDefine.ts:367、source-code/client/Code/config/FanDefine.ts:389、source-code/client/Code/config/FanDefine.ts:404、source-code/client/Code/config/FanDefine.ts:424、source-code/client/Code/config/XsmjFanConfig.ts:24、source-code/client/Code/config/XsmjFanConfig.ts:25、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1096、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1097、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1101、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1102、source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:765、source-code/client/Code/config/GameSoundConfig.ts:444、source-code/client/Code/config/GameSoundConfig.ts:445、source-code/client/Fgui/assets/box_hzmj_tipAni/effect/Paixing_wz04.json:1）
  - UI 交互：胡牌时按组合档播放“杠飘”或“飘杠”特效动效与专属语音，结算流水显示组合名（不是杠开名与财飘名并列）；组合文案后用括号提示高档明细（如“杠飘（二连杠，双财飘）”），玩家只看到一个组合动效与一条组合文案，没有分档倍数展示，也不单独显示“8 倍”文字，最终看到的是结算分数与组合番型名；命中“杠开×爆头”“七对×爆头/财飘”时播放“杠爆”“七客”组合动效与语音，结算流水显示组合名，但没有独立的杠爆/七客番型项与倍数条目。

### 吃碰禁手

吃或碰成立后，同牌面的手牌全部禁打，直到本次限制解除。

  - 客户端实现：收到出牌限制后缓存禁打牌值，自己拥有出牌权时遍历手牌按牌值比对置灰并禁止点击，收到空限制时清除缓存（source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:45、source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:105、source-code/client/Code/data/GameData.ts:1800、source-code/client/Code/layer/BoxHzmjMainView.ts:1432、source-code/client/Code/layer/BoxHzmjMainView.ts:1433）
  - UI 交互：与禁打牌值相同的所有手牌压暗且不可点击，点击出牌弹出「该牌被禁打」

- 用间隔一张的两张吃中间张：只禁被吃的那一张。用 1、3 吃 2，禁打 2。
  - 待确认：客户端代码未找到对应实现
- 用相邻两张吃一端：禁打这两张在 1 至 9 内两端能接成顺子的牌。用 2、3 吃 1 或吃 4，都禁 1 和 4。用 1、2 吃 3，只禁 3。
  - 待确认：客户端代码未找到对应实现
- 碰成立后，禁打与被碰牌相同的牌。
  - 客户端实现：仅有通用的禁打名单处理，把名单内牌值的手牌置灰并禁止出牌，未见碰专属的禁张写入判断（source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:33、source-code/client/Code/data/GameData.ts:1738）
  - UI 交互：与被碰牌相同牌值的手牌压暗，点击出牌被拦截并提示「该牌被禁打」

手上两张相差 1 时，禁吃进的那张和另一侧延伸的那张。1、9 外侧不是牌，实际只禁吃进的一张。相差不是 1 时，只禁吃进的那张。只按最终选定的一组写禁张。吃完后剩余手牌全部落在禁张里的吃法不能吃，本家提示「吃禁手规则生效中」。禁张不含财神，吃完仍可打财神。

  - 待确认：客户端代码未找到对应实现
  - 待确认：客户端代码未找到对应实现
  - 待确认：客户端代码未找到对应实现
  - 客户端实现：存在多组吃法时展示顺子选项池，玩家选定后只把选中的一组吃法上报，服务端据此计算禁张（source-code/client/Code/layer/BoxHzmjMainView.ts:1098、source-code/client/Code/layer/BoxHzmjMainView.ts:1102、source-code/client/Code/controller/gameController.ts:498）
  - UI 交互：弹出多组顺子供玩家选择，选定后其余选项收起，操作区回到空状态
  - 客户端实现：吃选项完全按服务端下发的吃组合展示，客户端不做吃法过滤，被拦下的吃法由服务端不授予，客户端接收专属通知；收到吃禁手专属通知后，仅当通知座位是本家时派发文字提示事件（source-code/client/Code/config/GameDefine.ts:469、source-code/client/Code/controller/cmd/gameCmd/GameNotifyInfoCmd.ts:58、source-code/client/Code/layer/BoxHzmjMainView.ts:1020、source-code/client/Code/controller/cmd/gameCmd/GameNotifyInfoCmd.ts:59、source-code/client/Code/layer/BoxHzmjTipAniView.ts:857、source-code/client/Code/config/GameDefine.ts:470）
  - UI 交互：不出现该吃法的吃牌选项，同时显示一行规则提示文字；本家界面出现「吃禁手规则生效中」文字提示，短暂显示后消失，复盘与简洁模式下不显示
  - 客户端实现：按服务端下发的禁打名单逐张比对牌值置灰，未对财神牌做豁免判断，财神着色说明中灰色优先于财神红色（source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:64、source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:105、source-code/client/Code/data/GameData.ts:1800）
  - UI 交互：若禁打名单中含财神牌值，财神手牌同样会被压暗，界面没有额外的财神豁免表现

禁打牌压暗，牌面仍可辨认，只在本家界面显示。这些牌仍能提起，也能横滑出虚影。单击、双击或松手打出时弹出「该牌被禁打」，牌不进牌河。其他家只看到牌背。

  - 客户端实现：按禁打名单逐张比较手牌牌值，命中后把该手牌着色为灰色，未命中的牌恢复普通或财神配色；出牌限制只在本家座位时写缓存并派发界面刷新，手牌灰化只作用于本家手牌组件，受限制座位不是本家时缓存不生效（source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:110、source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:112、source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:46、source-code/client/Code/data/GameData.ts:1780、source-code/client/Code/layer/BoxHzmjMainView.ts:1277）
  - UI 交互：被禁打的手牌整体变暗，仍显示原牌面图案；只有本家手牌出现压暗效果，其他玩家界面没有任何禁打标记
  - 客户端实现：禁打灰化时把对应手牌项的触摸属性置为不可触摸，本家手牌组件在构建时接入了虚影节点用于横滑表现（source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:108、source-code/client/Code/layer/BoxHzmjMah2DView.ts:139）
  - UI 交互：禁打牌显示为压暗状态，能否提起与横滑出虚影取决于手牌基类的命中判定，本仓库无法直接观察
  - 客户端实现：手牌组件的出牌前校验与出牌回调都先判断该牌能否打出，命中禁打则派发文字提示事件并中止本次出牌，提示统一由提示视图展示；出牌回调在通过禁打校验之前不会把牌加入牌河也不会发送出牌请求，被拦下后重新按手牌数据还原手牌并恢复禁打灰化（source-code/client/Code/layer/BoxHzmjMainView.ts:1432、source-code/client/Code/layer/BoxHzmjMainView.ts:1473、source-code/client/Code/layer/BoxHzmjMainView.ts:339、source-code/client/Code/layer/BoxHzmjTipAniView.ts:856、source-code/client/Code/layer/BoxHzmjMainView.ts:1479、source-code/client/Code/layer/BoxHzmjMainView.ts:1481、source-code/client/Code/layer/BoxHzmjMainView.ts:1482）
  - UI 交互：弹出「该牌被禁打」文字提示，约 1.3 秒后消失，手牌保留原位；牌河不出现这张牌，手牌回到原位并保持压暗状态
  - 客户端实现：对家、上家、下家的手牌统一用牌背资源构建手牌组件，仅本家手牌组件挂虚影节点并参与禁打灰化（source-code/client/Code/layer/BoxHzmjMah2DView.ts:114、source-code/client/Code/layer/BoxHzmjMah2DView.ts:137）
  - UI 交互：其他三个座位的手牌始终显示为牌背，看不到牌面，也没有压暗效果

打出一张合法牌后，服务端清空禁张。同一回合再杠不清空。补进的牌若牌值仍在禁张里，也不能打。

  - 客户端实现：出牌处理不本地清空禁打名单，明确由服务端空名单或新名单维护，收到空名单时清空缓存并在自己有出牌权时触发界面刷新（source-code/client/Code/controller/cmd/gameCmd/GamePlayCmd.ts:72、source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:37、source-code/client/Code/controller/cmd/gameCmd/GamePlayLmtsCmd.ts:38）
  - UI 交互：下一手本家手牌恢复正常配色，不再有压暗的禁打牌
  - 客户端实现：杠牌处理只做副露与动画更新，没有触发出牌限制清空，出牌限制只在收到服务端名单时变化（source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:34、source-code/client/Code/controller/cmd/gameCmd/GamePlayCmd.ts:72）
  - UI 交互：杠牌后禁打灰化保持原样，直到服务端下发新的出牌限制
  - 客户端实现：摸牌位的牌单独按单放禁打值判断，末张摸牌命中单放禁打值时置灰且不可点，其余手牌按禁打名单判断，补进的牌由摸牌逻辑写入摸牌位（source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:102、source-code/client/Code/data/GameData.ts:1796、source-code/client/Code/controller/cmd/gameCmd/GameTakeCmd.ts:73）
  - UI 交互：摸进的牌若命中禁打值会被压暗，点击出牌被拦下并提示「该牌被禁打」

### 出牌与响应

只有当前拿到出牌权、且目标牌可打的玩家能出牌。等待他人响应、正在选择组合、杠后尚未补牌或本小局已经结束时，不能出牌。

  - 客户端实现：收到可操作项后按出牌位设置本家手牌可出状态，出牌前再校验该牌是否被禁打，禁用牌拦截并把手牌拉回；非本家收到可操作项时直接关闭本家操作区，本家手牌退出可出状态；进入吃/杠选择面板时切换操作区页签并清空选牌回调，选择面板接管操作区，未见显式关闭出牌入口的代码；提交杠请求后立即关闭本家出牌入口，杠成立消息到达时再次关闭操作区，直到下一次摸牌后重新获得可操作项；胡牌/流局结算处理时关闭操作区，本家手牌退出可出状态，结束游戏消息到达时也收起听牌相关按钮（source-code/client/Code/layer/BoxHzmjMainView.ts:536、source-code/client/Code/layer/BoxHzmjMainView.ts:556、source-code/client/Code/layer/BoxHzmjMainView.ts:1432、source-code/client/Code/data/GameData.ts:1789、source-code/client/Code/layer/BoxHzmjMainView.ts:528、source-code/client/Code/layer/BoxHzmjMainView.ts:497、source-code/client/Code/layer/BoxHzmjMainView.ts:1124、source-code/client/Code/layer/BoxHzmjMainView.ts:1118、source-code/client/Code/layer/BoxHzmjMainView.ts:1155、source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:46、source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:241、source-code/client/Code/controller/cmd/gameCmd/GameEndCmd.ts:33）
  - UI 交互：无出牌权时手牌不可出，点到禁打牌弹出“该牌被禁打”提示并回退手牌显示；本家操作按钮收起，手牌不再响应出牌点击；操作区切换为选择面板，原吃/碰/杠/胡按钮退出显示；杠成功后操作按钮与手牌出牌入口收起，等待补牌；小局结算时操作按钮全部收起，手牌不再响应出牌点击

- 弃牌可被吃、碰、直杠或点炮胡时，先裁决。成立后各端从牌河取走该牌，并清除它的浮标和放大显示。全部放弃则牌留在牌河，再轮到下家摸牌。
  - 客户端实现：吃/碰/杠成立时把组合中的进牌从来源玩家的牌河弹出，并同步移除桌面牌河最后一张，胡牌成立时同样移除放铳者牌河最后一张；吃/碰/杠/胡消息到达时统一隐藏其他玩家出牌的放大牌面，指向最后打出牌的浮标由牌桌组件负责（source-code/client/Code/data/PlayerCardsData.ts:92、source-code/client/Code/layer/BoxHzmjMah2DView.ts:893、source-code/client/Code/layer/BoxHzmjMah2DView.ts:997、source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:42、source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:42、source-code/client/Code/layer/BoxHzmjMainView.ts:1059）
  - UI 交互：牌河中被响应的那张牌消失，牌面并入副露或胡牌；被响应牌的放大牌卡消失
  - 待确认：弃牌可被吃、碰、直杠或点炮胡时先裁决，客户端代码未找到对应实现
  - 待确认：全部放弃则牌留在牌河、再轮到下家摸牌，客户端代码未找到对应实现
- 【自摸】还在，或本次杠提示必须先过时，双击或滑动出牌会被拦住，只在本家显示「点“过”才能出牌」。须先点【过】。例外：可杠的只是摸牌或补牌之前已经拿在手里的暗杠，可以直接出牌。碰之后又能杠的，仍须先过。
  - 客户端实现：出牌前检查当前可操作项是否含胡、杠、碰、吃，且操作区仍处于吃碰杠胡页签，则直接拦截本次出牌；拦截出牌时只向本家弹出通用提示框，文案为点“过”才能出牌；点击过后上送放弃请求并退出吃碰杠胡页签，操作区关闭后才允许再次出牌；若存在杠提示但无胡提示，且所有可杠组合的牌值都不等于刚摸的牌，则标记为与摸牌无关的杠，不压暗手牌且不要求点过；碰后手牌没有刚摸牌（摸牌值为 0），与摸牌无关的杠判定不成立，因此仍走必须先过的分支（source-code/client/Code/layer/BoxHzmjMainView.ts:1447、source-code/client/Code/layer/BoxHzmjMainView.ts:1453、source-code/client/Code/layer/BoxHzmjMainView.ts:1454、source-code/client/Code/layer/BoxHzmjMainView.ts:1236、source-code/client/Code/layer/BoxHzmjMainView.ts:697、source-code/client/Code/layer/BoxHzmjMainView.ts:701、source-code/client/Code/layer/BoxHzmjMainView.ts:713、source-code/client/Code/layer/BoxHzmjMainView.ts:695、source-code/client/Code/layer/BoxHzmjMainView.ts:696）
  - UI 交互：双击或滑动出的牌被拦下，手牌回到原位；本家屏幕中部弹出提示条，3 秒后消失，其他玩家不显示；点【过】后按钮收起，手牌恢复可按压；可杠的只是手中原有暗杠时，手牌保持正常亮度，可直接打出；碰之后又能杠时，手牌参与杠的牌保持亮度、其余压暗，出牌前需先点过
- 点【过】只放弃这一次提示，收起本次按钮和预览。之后别人再打出相同牌，按新弃牌重新判断。放弃杠后，同一次操作机会内不再出现【杠】；下一次拿到操作机会再判断。
  - 客户端实现：点过时上送放弃请求、退出吃碰杠胡页签、隐藏多吃/多杠面板并清空选牌回调与压暗；点过后本地不保留本次提示状态，仅清空选择与压暗，后续是否再次提示完全由新的可操作项决定（source-code/client/Code/layer/BoxHzmjMainView.ts:1237、source-code/client/Code/layer/BoxHzmjMainView.ts:1239、source-code/client/Code/layer/BoxHzmjMainView.ts:1240）
  - UI 交互：操作按钮与候选面板收起，手牌恢复常态；下次同牌出现时按钮按新可操作项重新显示
  - 待确认：放弃杠后同一次操作机会内不再出现【杠】、下一次拿到操作机会再判断，客户端代码未找到对应实现
- 有操作资格的玩家在自己手牌右上方看到对应按钮和【过】。按钮从左到右为【吃】【碰】【杠】【胡】，蓝色【过】固定在最右，只显示本次可做的项。【胡】或【自摸】左侧显示胡牌张和预览倍数。各端使用同一个响应倒计时，归零后按钮仍可点。
  - 客户端实现：本家收到可操作项时按位显示吃、碰、杠、胡、过按钮，其他玩家到达时关闭本家操作区；按可操作项位逐个设置吃、碰、杠、胡、过按钮显隐，按钮在同一横向组内右对齐排列；具备胡权限时把胡牌张图片与倍数文案写入胡按钮内的左侧节点，并按胡牌类型切换胡或自摸皮肤；可操作项到达时按统一时钟值启动座位倒计时显示，倒计时结束仅把数字置为 00，不对按钮做禁用处理（source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:33、source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:35、source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:6、source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:15、source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:21、source-code/client/Code/layer/BoxHzmjMainView.ts:577、source-code/client/Code/layer/BoxHzmjMainView.ts:578、source-code/client/Code/layer/BoxHzmjMainView.ts:664、source-code/client/Code/layer/BoxHzmjMainView.ts:666、source-code/client/Fgui/assets/box_hzmj_main/component/HuActionBtn.xml:6、source-code/client/Fgui/assets/box_hzmj_main/component/HuActionBtn.xml:7、source-code/client/Code/controller/cmd/gameCmd/GamePowerCmd.ts:78、source-code/client/Code/layer/BoxHzmjMah2DView.ts:696、source-code/client/Code/layer/BoxHzmjMah2DView.ts:710）
  - UI 交互：按钮组出现在屏幕右侧靠本家手牌上方，按右侧对齐排布；按钮按吃、碰、杠、胡、过从左到右出现，未具备的项不显示；胡按钮左边显示具体胡牌张与“N倍”文本；中央倒计时统一显示秒数，最后 3 秒换字体并播提示音，归零显示 00
- 能胡时整手保持正常亮度。不能胡时，只有参与当前吃、碰、直杠的牌保持亮度，其余压暗。压暗只在该玩家本端显示。本次新摸入或补入的牌能组成暗杠或加杠，且同次无胡时，参与任一合法杠的手牌保持亮度，其余压暗。可杠组只由原有的牌组成时，手牌保持当前亮度。
  - 客户端实现：可操作项含胡时直接清除手牌压暗并恢复可按压；按候选组合收集吃/碰/杠涉及的牌值，把这些牌值以外的牌统一置灰；置灰只作用于本家手牌控件，其他玩家获得操作资格时直接关闭本家操作区，不对其他座位手牌做置灰；有杠提示且无胡、且杠涉及刚摸牌时，按所有合法杠收集牌值保留亮度，其余置灰；判定为与摸牌无关的杠时跳过压暗分支，直接清除灰态（source-code/client/Code/layer/BoxHzmjMainView.ts:718、source-code/client/Code/layer/BoxHzmjMainView.ts:1628、source-code/client/Code/layer/BoxHzmjMainView.ts:748、source-code/client/Code/layer/BoxHzmjMainView.ts:775、source-code/client/Code/layer/BoxHzmjMainView.ts:772、source-code/client/Code/layer/BoxHzmjMainView.ts:528、source-code/client/Code/layer/BoxHzmjMainView.ts:694、source-code/client/Code/layer/BoxHzmjMainView.ts:757、source-code/client/Code/layer/BoxHzmjMainView.ts:713）
  - UI 交互：能胡时所有手牌正常显示、可点；不能胡时参与组牌的牌亮起，其余手牌变灰；压暗只出现在自己的手牌，他人手牌外观不变；新摸入或补入牌可杠且同次无胡时，杠相关手牌亮、其余灰，需先点过才能出牌；可杠组只由原有牌组成时手牌维持原亮度，不出现压暗
- 较低优先级先提交时，本端收起自己的按钮并等待。更高优先级成立后，结束等待并取消该请求。更高优先级都放弃后，再执行已经提交的较低优先级请求。
  - 客户端实现：提交吃、碰、杠、胡后立即把操作区切回空白页签，本家不再显示可点按钮（source-code/client/Code/layer/BoxHzmjMainView.ts:1103、source-code/client/Code/layer/BoxHzmjMainView.ts:1134）
  - UI 交互：按钮收起，界面进入等待他人裁决的状态
  - 待确认：更高优先级成立后结束等待并取消该请求，客户端代码未找到对应实现
  - 待确认：更高优先级都放弃后再执行已经提交的较低优先级请求，客户端代码未找到对应实现
- 多种吃法：点【吃】后，在手牌上方展开可选顺子，每组三张正面、按牌面从小到大，右侧为【取消】。原【吃】【过】退场，手牌恢复常态亮度。倒计时归零后面板仍可操作。点【取消】等于放弃自己对这张弃牌的全部操作，包括同时存在的胡。选中一组即提交。
  - 客户端实现：吃组合多于一组时打开候选面板，按每组完整顺子动态生成选项；每个选项固定填充三个牌槽，逐张设置牌面图与牌背状态；取消按钮与候选面板同属操作组，候选面板之后放置取消，取消在该页签可见；打开候选面板时切换操作区页签，使吃、过按钮不再显示，同时清空手牌置灰；候选面板的点击回调不绑定倒计时，倒计时结束只改变中央读秒显示；点取消时同时关闭吃与杠面板并执行点过逻辑，上送放弃请求；点击某个候选选项记录其下标，并立即上送该组吃牌组合并关闭操作区（source-code/client/Code/layer/BoxHzmjMainView.ts:1089、source-code/client/Code/layer/BoxHzmjMainView.ts:865、source-code/client/Code/layer/BoxHzmjMainView.ts:944、source-code/client/Code/layer/BoxHzmjMainView.ts:953、source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:30、source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:31、source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:7、source-code/client/Code/layer/BoxHzmjMainView.ts:1119、source-code/client/Code/layer/BoxHzmjMainView.ts:907、source-code/client/Code/layer/BoxHzmjMainView.ts:1174、source-code/client/Code/layer/BoxHzmjMainView.ts:158、source-code/client/Code/layer/BoxHzmjMainView.ts:1113）
  - UI 交互：操作区出现多组顺子候选项，每组显示三张正面牌；候选面板右侧出现取消按钮；吃、过按钮消失，手牌恢复常态；读秒到 00 时候选牌仍可点；点取消后面板收起，本次所有可用操作一并作废；点击候选项后立即发出吃牌，面板消失
- 多种暗杠或加杠：点【杠】后收起【杠】【过】，横向排列候选牌，最右为【取消】。暗杠与加杠混排，顺序为万、条、筒、东、南、西、北、中、发、白，同花色按点数升序。倒计时归零后仍可选择。点【取消】等于放弃本次行牌机会里的全部操作，包括同时存在的自摸。点一张候选牌只提交对应的一组。只有 1 组时，点【杠】直接提交。
  - 客户端实现：杠组合多于一组时打开候选列表，把可杠牌值逐张填入横向列表，并切到选择页签隐藏杠、过按钮；候选牌从服务端下发的杠组合中按顺序取首张牌生成列表，暗杠与加杠共用同一列表；候选列表点击回调不绑定倒计时，读秒归零只更新中央数字；点取消时关闭杠与吃面板并执行点过逻辑，上送放弃请求；点击候选记录下标，按该下标取出对应杠组合后上送；杠组合只有一组时不展开候选，直接按第一组上送杠请求（source-code/client/Code/layer/BoxHzmjMainView.ts:1141、source-code/client/Fgui/assets/box_hzmj_main/component/GangGrps.xml:4、source-code/client/Code/layer/BoxHzmjMainView.ts:639、source-code/client/Code/layer/BoxHzmjMainView.ts:844、source-code/client/Code/layer/BoxHzmjMainView.ts:848、source-code/client/Code/layer/BoxHzmjMainView.ts:1176、source-code/client/Code/layer/BoxHzmjMainView.ts:851、source-code/client/Code/layer/BoxHzmjMainView.ts:1150、source-code/client/Code/layer/BoxHzmjMainView.ts:1145）
  - UI 交互：杠、过按钮消失，出现横向候选牌列表与取消按钮；候选牌混排展示，顺序沿用下发顺序；读秒为 00 时仍可点候选牌；点取消后候选面板关闭，本次可行操作全部作废；点击哪张候选就只执行那一组杠；只有 1 组时点杠后不弹候选面板，直接完成杠
- 点炮、抢杠的按钮文案是「胡」，自摸是「自摸」。没有单独的抢杠按钮。过和过2都显示「过」。过上行放弃；过2只在本地收起按钮并清掉本次压暗，再按禁手重新压暗，不上行。多组吃、杠的取消等于上行过。
  - 客户端实现：按胡牌类型选择按钮皮肤，点炮与抢杠用胡皮肤，其余（含自摸）用自摸皮肤，界面只定义了一个胡按钮；初始化时把过与过2两个按钮的动作皮肤都设为过；点过时带当前操作序号上送放弃请求，然后关闭本家操作区；点过2不发上行消息，只关闭操作区、清空选择并清除压暗，随后按禁打配置重新上手牌灰态；候选面板取消时统一调用过的处理，包含上送放弃（source-code/client/Code/layer/BoxHzmjMainView.ts:671、source-code/client/Fgui/assets/box_hzmj_main/component/Handler.xml:15、source-code/client/Code/layer/BoxHzmjMainView.ts:319、source-code/client/Code/layer/BoxHzmjMainView.ts:320、source-code/client/Code/layer/BoxHzmjMainView.ts:1237、source-code/client/Code/controller/gameController.ts:461、source-code/client/Code/layer/BoxHzmjMainView.ts:1246、source-code/client/Code/layer/BoxHzmjMainView.ts:1262、source-code/client/Code/layer/BoxHzmjMainView.ts:1277、source-code/client/Code/layer/BoxHzmjMainView.ts:1174）
  - UI 交互：点炮与抢杠时按钮显示胡，自摸时显示自摸；过与过2两个按钮外观一致，都显示过；点过后按钮收起，放弃结果由服务端确认；点过2后按钮收起，手牌先恢复亮度再按禁手规则重新置灰；多组吃、杠点取消后按钮收起，并完成一次上行放弃
- 有杠、没有胡，且所有可杠牌都不是刚摸的那张时，手牌不压暗，不点过也能出牌。
  - 客户端实现：识别与摸牌无关的杠后，跳过压暗并在出牌拦截判定中放行，不弹必须先过提示（source-code/client/Code/layer/BoxHzmjMainView.ts:692、source-code/client/Code/layer/BoxHzmjMainView.ts:713、source-code/client/Code/layer/BoxHzmjMainView.ts:1453）
  - UI 交互：手牌保持正常亮度，可直接打出
- 打出后听任意一张时，听牌详情固定为「爆头2番」「摸任意一张可胡」。候选牌是财神时听牌标为飘，否则为爆。同一手只要有一张这样，其余可听牌只留箭头。
  - 客户端实现：听牌数据含任意牌哨兵时切换到爆头展示页，隐藏牌组列表并固定显示两句详情；判断某张手牌打出后是否万能听，若是则按该牌是否为财神在牌面上打飘或爆标记；先扫描是否存在万能听，若有则把其余可听牌的标注降为普通箭头样式（source-code/client/Code/layer/BoxHzmjTingPaiView.ts:49、source-code/client/Fgui/assets/box_hzmj_tingPai/component/TingCard.xml:24、source-code/client/Fgui/assets/box_hzmj_tingPai/component/TingCard.xml:27、source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:192、source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:193、source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:176、source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:200）
  - UI 交互：弹窗显示爆头2番与摸任意一张可胡两行固定文案，胡张数显示为胡；万能听的候选手牌出现飘或爆的听牌标记；同一手存在爆或飘时，只有该牌带特殊标注，其余可听牌仅显示箭头
- 吃成立后，碰杠区新增一组正面顺子，按点数从小到大摆放。以吃牌者视角，来源箭头「←」叠在吃到的那张牌上。
  - 客户端实现：吃消息生成副露数据并按牌值升序构造展示牌序，然后追加到该玩家副露区；副露生成后按进牌在展示牌序中的实际槽位移动来源箭头，无法定位时回落到中间张（source-code/client/Code/layer/BoxHzmjMah2DView.ts:895、source-code/client/Code/config/BoxMahDefine.ts:819、source-code/client/Code/config/BoxMahDefine.ts:458、source-code/client/Code/layer/BoxHzmjMah2DView.ts:938、source-code/client/Code/layer/BoxHzmjMah2DView.ts:947）
  - UI 交互：碰杠区出现一组三张正面顺子；来源箭头叠在吃到的那张牌上
- 碰成立后，碰牌组三张都正面展示。以来源视角，箭头叠在中间一张：上家←、对家↑、下家→。吃、碰、直杠、暗杠的新牌组按成立顺序从左往右追加。
  - 客户端实现：碰消息生成三张刻子副露数据并追加到副露区，牌面按真实牌值展示；碰牌进牌位于展示序中间时箭头回落到中间张，来源方向由来源座位换算后决定；每次成立都把新副露追加到该玩家副露列表末尾，数据层保持成立先后顺序（source-code/client/Code/controller/cmd/gameCmd/GamePungCmd.ts:34、source-code/client/Code/layer/BoxHzmjMah2DView.ts:892、source-code/client/Code/layer/BoxHzmjMah2DView.ts:960、source-code/client/Code/data/PlayerCardsData.ts:152、source-code/client/Code/layer/BoxHzmjMah2DView.ts:895、source-code/client/Code/data/PlayerCardsData.ts:134）
  - UI 交互：碰牌组三张牌正面可见；方向箭头叠在碰牌组中间那张牌上；新副露出现在已有副露之后
- 直杠用来源箭头，加杠标记为【补】，暗杠用手掌标记。标记都叠在杠牌组最上方居中的第 4 张。直杠、暗杠在碰杠区新增一组；加杠补入原碰牌组，沿用原位置。补牌落入最右分隔位，可与「杠」字同时出现。连续杠时，新的「杠」字覆盖仍在播放的上一个。
  - 客户端实现：按杠组合类型分派，明杠、暗杠走新增副露，补杠走补入原碰牌组，并分别播放对应动作；补杠时找到同牌值的原碰牌组，用新组合替换该位置，其余杠类型直接追加新组；每个座位只有一个杠字效节点，新一次杠直接复用该节点重置皮肤并重新播放（source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:50、source-code/client/Code/controller/cmd/gameCmd/GameKongCmd.ts:63、source-code/client/Code/data/PlayerCardsData.ts:106、source-code/client/Code/layer/BoxHzmjMah2DView.ts:910、source-code/client/Code/layer/BoxHzmjTipAniView.ts:486、source-code/client/Code/layer/BoxHzmjTipAniView.ts:524）
  - UI 交互：直杠、补杠、暗杠三类杠在副露上呈现不同标记；加杠后原碰牌组就地变为杠组，不新增位置；连续杠时新的杠字立即顶替上一个仍在播放的杠字
  - 待确认：标记都叠在杠牌组最上方居中的第 4 张，客户端代码未找到对应实现
  - 待确认：补牌落入最右分隔位、可与「杠」字同时出现，客户端代码未找到对应实现
- 吃、碰、杠、胡成立时，在操作者对应方位播放对应字效。自摸确认后显示「对局结束」并亮出各家手牌，胡牌张单独摆在胡牌者手牌右侧。点炮胡、抢杠胡同样显示「对局结束」和亮牌；胡牌张在胡牌者手牌尾端，带浅绿描边和来源箭头。赢家方位显示番型，放铳者方位显示「点炮」。随后按座位飘分，正分黄色，负分灰色。
  - 客户端实现：吃、碰、杠按操作者座位取对应字效节点并按类型切换皮肤播放，胡按座位播放番型动画；结算消息到达时按结束类型切到对局结束页，并把所有玩家手牌翻到正面；摊牌时把胡牌张拼接在手牌末尾一并展示，并把本家手牌整体缩小；结束类型为胡牌时统一走对局结束与全桌亮牌流程，不区分自摸或点炮；胡牌张拼在手牌末尾，并按胡牌来源座位设置手牌的方向箭头来源；胡牌方按番型在本人方位播番型动画，放铳方按点炮或一炮多响类型在放铳者方位播点炮动画；番型动画完成后按座位逐个显示得失分，并按分数正负选择胜利或失败字体（source-code/client/Code/controller/cmd/gameCmd/GameChowCmd.ts:43、source-code/client/Code/layer/BoxHzmjTipAniView.ts:484、source-code/client/Fgui/assets/box_hzmj_tipAni/component/HzmjTipAniComponent.xml:44、source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:84、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1186、source-code/client/Code/layer/BoxHzmjMah2DView.ts:1059、source-code/client/Fgui/assets/box_hzmj_tipAni/component/HzmjTipAniComponent.xml:3、source-code/client/Code/layer/BoxHzmjMah2DView.ts:984、source-code/client/Code/layer/BoxHzmjMah2DView.ts:1057、source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:83、source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:303、source-code/client/Code/layer/BoxHzmjMah2DView.ts:987、source-code/client/Code/layer/BoxHzmjMah2DView.ts:1062、source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:266、source-code/client/Code/layer/BoxHzmjTipAniView.ts:891、source-code/client/Code/layer/BoxHzmjTipAniView.ts:966、source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:276、source-code/client/Code/layer/BoxHzmjTipAniView.ts:567）
  - UI 交互：操作者所在方位弹出吃/碰/杠/胡字效；屏幕中央出现对局结束提示，四家手牌同时亮出；胡牌张出现在手牌最右侧；点炮或抢杠胡后同样出现对局结束并亮出各家手牌；尾端胡牌张上方出现来源方向箭头；赢家一侧显示番型字效，放铳者一侧显示点炮字效；各座位依次飘出分数，正分与负分使用不同字体表现

## 三摊承包

只统计吃牌。A 吃 B 的牌，A 对 B 加 1 摊。

  - 客户端实现：客户端不累计摊数，收到摊列表后整表覆盖存入数据层，只用于驱动提示与结算展示（source-code/client/Code/controller/cmd/gameCmd/GameTanUpdateCmd.ts:9、source-code/client/Code/data/GameData.ts:1596、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1793）；摊信息按「被吃方—吃方」成对携带摊数存储，提示按该对座位触发（source-code/client/Code/controller/cmd/gameCmd/GameTanUpdateCmd.ts:26、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1651、source-code/client/Code/layer/BoxHzmjTestView.ts:948）
  - UI 交互：对局桌面没有摊计数展示，摊更新事件仅写调试日志；该对摊数达到 3 时播放三摊落地动效

- 只有庄家和闲家之间能承包。两名闲家之间，同一方向最多 2 摊，吃一成立就加 1。已经有 2 摊时，再吃这一家的牌不成立，不给出【吃】。与飘财无关。两个方向分开计。
  - 客户端实现：客户端不判断吃牌双方的庄闲身份与已有摊数，也没有按摊数拦截吃的代码，「吃」按钮显隐完全跟随系统下发的吃权限（source-code/client/Code/layer/BoxHzmjMainView.ts:552、source-code/client/Code/layer/BoxHzmjMainView.ts:578、source-code/client/Code/layer/BoxHzmjMainView.ts:752）；摊信息与飘计数分别存储，分别由摊更新与飘消息驱动，互不读取（source-code/client/Code/data/GameData.ts:1600、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1673、source-code/client/Code/controller/cmd/gameCmd/GameTanUpdateCmd.ts:21）；摊信息以玩家对为单位列成列表存储，同一玩家可同时存在多条不同对手的记录（source-code/client/Code/data/GameData.ts:1597、source-code/client/Code/layer/BoxHzmjTestView.ts:947、source-code/client/Code/layer/BoxHzmjTestView.ts:949）
  - UI 交互：有吃权限时显示「吃」按钮并高亮可吃组合手牌，无吃权限时按钮不出现、手牌不出现可吃组合高亮；飘状态更新走独立的碰杠类动效与计数提示，不改变摊提示表现
  - 待确认：只有庄家和闲家之间能承包，客户端代码未找到对应实现
- 某一方向计到第 3 摊时记承包，四端播放「三摊落地」，可与吃牌字效同时显示。不等到结算，当时没有承包角标。提示期间，获权玩家可以继续提牌、出牌。
  - 客户端实现：收到摊列表后逐条检查摊数，摊数为 3 时派发「三摊落地」事件并通知界面（source-code/client/Code/controller/cmd/gameCmd/GameTanUpdateCmd.ts:24、source-code/client/Code/controller/cmd/gameCmd/GameTanUpdateCmd.ts:25、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1650）；摊更新命令派发落地事件后，界面层播放独立的三摊落地 Spine 动效，吃牌动效在另一组按座位区分的节点上播放，二者互不抢占（source-code/client/Code/layer/BoxHzmjTipAniView.ts:1662、source-code/client/Fgui/assets/box_hzmj_tipAni/component/HzmjTipAniComponent.xml:118、source-code/client/Code/layer/BoxHzmjTipAniView.ts:498、source-code/client/Code/controller/cmd/CmdDefine.ts:100）；对局中不渲染摊数或承包角标，承包角标只在小结算行内按承包关系设置（source-code/client/Code/layer/BoxHzmjTipAniView.ts:1793、source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:196、source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:17）；三摊落地动效为不可点击的展示节点，播放时不加输入锁，也没有暂停或排队等待逻辑（source-code/client/Code/layer/BoxHzmjTipAniView.ts:1663、source-code/client/Fgui/assets/box_hzmj_tipAni/component/HzmjTipAniComponent.xml:118、source-code/client/Code/config/FguiViewDefine.ts:404）
  - UI 交互：达到 3 摊时在屏幕中央播放三摊落地动效，可与吃牌字效同时出现，简洁模式下不播放；对局桌面无承包角标，小结算在出承包方座位行显示「承包」或「反承包」图标；动效只覆盖显示层，播放期间玩家仍可继续点选并操作出牌与响应按钮

自摸只结算胡牌方自己参与的承包对。摊方胡，对方付三家输分合计；被摊方胡，摊方付该合计的 2 倍。双向都满 3 摊时只按倒承包的 2 倍，不两笔叠加。

  - 客户端实现：结算按系统下发的承包列表展示，承包文案只追加到胡牌座位，非胡牌座位不追加承包文案（source-code/client/Code/util/BoxHzmjFlowUtil.ts:444、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1746、source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:212）；承包记录携带付款方、收款方与分值，客户端在小结算给付款方打角标、给收款方追加承包文案（source-code/client/Code/util/BoxHzmjFlowUtil.ts:445、source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:206、source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:91）；承包关系值为 2 时客户端按「反承包」展示，关系值为 1 时按「承包」展示（source-code/client/Code/util/BoxHzmjFlowUtil.ts:432、source-code/client/Code/util/BoxHzmjFlowUtil.ts:9、source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:20）；结算逐条处理承包记录，客户端不做双向合并去重，按座位汇总时同一座位多条记录会被累加（source-code/client/Code/util/BoxHzmjFlowUtil.ts:467、source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:212）
  - UI 交互：结算流水中承包文案只出现在赢家行，承包角标挂在出承包方座位行；出承包方行显示承包角标，赢家行流水出现「承包」文案；反承包时结算行角标切到反承包图标，文案显示「反承包」；同一座位只显示一个承包角标，取第一条有效关系

点炮只在放铳者本人是承包对方时改写，基数是原来那一笔点炮分，不是三家之和。别人的承包关系不赔，放铳者仍按原点炮付。抢杠胡不替换杠牌者的赔付，承包额再叠加。杠牌者若同时是承包方，两笔都付。

  - 客户端实现：结算流水对抢杠胡有独立类型文案，承包记录作为独立流水追加，二者互不覆盖（source-code/client/Code/util/BoxHzmjFlowUtil.ts:119、source-code/client/Code/util/BoxHzmjFlowUtil.ts:47、source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:339）
  - UI 交互：结算流水可同时出现抢杠胡文案与承包文案
  - 待确认：点炮只在放铳者本人是承包对方时改写，客户端代码未找到对应实现
  - 待确认：别人的承包关系不赔、放铳者仍按原点炮付，客户端代码未找到对应实现
  - 待确认：杠牌者若同时是承包方两笔都付，客户端代码未找到对应实现

- **承包**：A 对 B 已成立，A 自摸。B 支付三家原应赔分的合计 S，另外两家本局 0 分。
  - 客户端实现：客户端按承包记录在出承包方座位打角标、在赢家流水追加「承包」文案（source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:195、source-code/client/Code/util/BoxHzmjFlowUtil.ts:48、source-code/client/Code/util/BoxHzmjFlowUtil.ts:373）
  - UI 交互：承包方行显示承包图标，赢家行流水显示「承包」
- **反承包**：同一关系下 B 自摸。A 支付 2 × S。S 是 B 这次自摸原本向三家应收的合计。
  - 客户端实现：关系值为 2 时按「反承包」展示，匹配场结算文案也按关系值输出「反承包」（source-code/client/Code/util/BoxHzmjFlowUtil.ts:429、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1750、source-code/client/Fgui/assets/box_hzmj_result/component/ResultItem.xml:92）
  - UI 交互：结算行显示反承包图标与「反承包」文字
- **链式**：A 对 B 成立，同时 C 对 A 成立，A 自摸。B 付 S，C 付 2 × S，A 实收 3 × S，第四家 0 分。
  - 客户端实现：结算遍历承包列表，每条记录都可追加到赢家流水，同一赢家可累计多条承包记录（source-code/client/Code/util/BoxHzmjFlowUtil.ts:427、source-code/client/Code/util/BoxHzmjFlowUtil.ts:468、source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:207）
  - UI 交互：赢家流水可同时出现多条承包相关文案，各付款方行分别显示角标

例：庄家平胡自摸，三名闲家各应赔 8，S = 24。承包方付 24。若同时存在上家对庄家的承包，上家再付 48，庄家得 72。

  - 待确认：客户端代码未找到对应实现

例：庄家对闲家成立承包，闲家平胡自摸，三家原应赔 8、1、1。庄家按反承包付 20。

  - 待确认：客户端代码未找到对应实现

## 算分

原应赔分 = 底分 × 番型倍数 × 这一笔的庄闲倍数。底分为 1。赢家和这一笔的赔付者有一方是庄家，庄闲倍数为 8；两边都是闲家，为 1。无封顶。番型倍数取三组连乘后的结果。杠飘、飘杠的 8 倍已经替换掉杠上开花和财飘，再乘基础番。
  - 客户端实现：结算分数直接取服务端下发的每局输赢结果，客户端只保存和显示；工程内虽定义了一个庄闲倍数换算方法（按牢庄档位左移），但结算路径没有任何乘算调用（GameResultHuCmd.ts:202、BoxHzmjResultMid.ts:365、GameData.ts:1665）。底分来自房间配置/开局数据，仅被格式化为界面文案展示，未参与任何结算乘算（BoxHzmjBackView.ts:87）。客户端保存服务端下发的牢庄等级，并提供一个按牢庄等级换算庄闲倍数的方法（1牢=2、2牢=4、3牢=8），但结算不做乘算；结算行只负责标出谁是庄家及牢庄档位（GameResultHuCmd.ts:118、BoxHzmjResultMid.ts:402、GameData.ts:1665）。客户端从房间规则/开局数据读封顶倍数，为0或-1时把听牌面板文案写成“无封顶”，否则写成“封顶N倍”，并在听牌提示里按封顶值压缩显示的番数；结算行还保留了封顶/破产角标分支，由服务端状态决定是否显示（BoxHzmjTingPaiView.ts:96、BoxHzmjTingPaiView.ts:139、BoxHzmjResultMid.ts:383）。客户端配置注明番型分为基础/七对组、杠开组、财神组三组互斥、最终倍数三组最高档连乘，并另有一份单项倍率表但注明只用于动画比较、实际总倍率始终取服务端下发的数值；结算界面不显示倍数、也不做连乘（FanDefine.ts:12、XsmjFanConfig.ts:4、BoxHzmjResultMid.ts:765）。客户端番型表把杠飘（先杠后飘）与飘杠（先飘后杠）都定义为 8 倍组合番，并在组合动效解析中把它们当作“杠开系×财飘系”的组合项处理；不做“替换后乘基础番”的运算（FanDefine.ts:51、FanDefine.ts:53、FanDefine.ts:134、XsmjFanConfig.ts:24）
  - UI 交互：小结算每一行显示该家本局分数，正数前加“+”，正分用赢家数字字体、负分用输家数字字体。房间信息区域显示“底分:N”文案（由底分更新事件刷新）。结算行头像下方显示庄家角标（1庄/2庄/3庄），庄家行才有该角标。听牌面板显示“无封顶”文案；若房间配置了封顶则显示“封顶N倍”，听牌番数会被压到封顶值；结算行可显示封顶或破产角标。结算流水只显示番型名称；好友房不显示倍数，匹配场才在流水后追加“N倍”。结算流水显示“杠飘”或“飘杠”组合名，不显示替换关系，也不显示乘算过程。

- **自摸**：三家各算一笔。庄家自摸，三笔都乘 8。闲家自摸，庄家那一笔乘 8，另两名闲家各乘 1。没有承包时，各付各的，赢家收合计。
  - 客户端实现：结算按服务端下发的每家输赢逐座位写入桌面飘分数据，并为每个有分的座位各播一次数值动画；客户端不区分这三笔的来源与倍数（GameResultHuCmd.ts:199、BoxHzmjTipAniView.ts:702、BoxHzmjTipAniView.ts:563）。客户端在结算行能给庄家打上牢庄档位角标，并能读取每笔赔分结果，但不做倍数判定与乘算，也不展示单笔倍数来源（GameResultHuCmd.ts:209、BoxHzmjResultMid.ts:402）。结算按服务端下发的每家分数分别显示，客户端不判断谁是庄、不换算倍数；只能看出庄家那一笔明显大于另两名闲家（BoxHzmjTipAniView.ts:702、BoxHzmjResultMid.ts:365）。结算行按座位显示各自净分，赢家行显示的是汇总后的一个总数，各输家行显示各自被扣的金额；客户端不做求和校验（BoxHzmjResultMid.ts:152、BoxHzmjFlowUtil.ts:468）
  - UI 交互：桌面每个座位头上飘出本人分数（正分用赢家数字字体、负分用输家数字字体），小结算每行显示各自分数。庄家行显示庄家角标；桌面飘分只显示最终金额，不显示“×8”标记。四个座位各自飘出/显示自己的分数，金额大小不同，但界面不标注哪一笔按8倍。赢家结算行只有一个总分数字，输家各自一行负数，没有逐笔来源明细。
- **点炮胡、抢杠胡**：没有承包时只算赢家和赔付者一笔，这一笔按庄闲 8 倍，另两家 0 分。有承包时按上一节改写。
  - 客户端实现：结算按胡牌类型区分：自摸行显示“自摸”，非自摸的胡家行显示“吃胡”，被点炮的一家（点炮来源命中自身）显示“点炮”；抢杠与点炮在判定与动效层被归为同一类非自摸胡；未参与的座位没有输赢记录，按0分显示（BoxHzmjResultMid.ts:731、BoxHzmjResultMid.ts:734、GameResultHuCmd.ts:339、ResultItem.xml:5）。结算读取承包结算列表中的承包/反承包关系，只在承包方所在行显示角标，并在赢家流水后追加“承包/反承包”加分数；赢家实际净分仍直接取服务端下发值（BoxHzmjResultMid.ts:196、BoxHzmjFlowUtil.ts:432、BoxHzmjFlowUtil.ts:445）
  - UI 交互：结算行右上角按胡牌类型显示图标（不参与胡牌/点炮/吃胡/自摸）；桌面播放点炮动效；未参与的座位显示0分且不飘分。承包方结算行显示承包或反承包角标图标；赢家流水新增“承包/反承包 +N分”项，可点击展开完整流水气泡。
- **承包**：自摸先算出三笔再求和为 S，然后按上一节改写出实际赔付。
  - 客户端实现：客户端把承包结算明细汇总到具体座位，并在兜底流水里从赢家总净分中扣掉承包分，得出番型部分的分数；三笔求和与改写运算本身不做（BoxHzmjFlowUtil.ts:429、BoxHzmjFlowUtil.ts:443、BoxHzmjResultMid.ts:153）
  - UI 交互：赢家流水把承包分单列成一项，结算行总分仍是改写后的净分；输家行显示各自实际扣除金额。
- **黄庄**：四家本局都是 0。
  - 客户端实现：流局时结算流水直接返回空；结算行的分数取不到对应记录时按0显示；桌面飘分遇到0分座位直接跳过，不播数值动画（BoxHzmjFlowUtil.ts:29、BoxHzmjResultMid.ts:371、GameResultHuCmd.ts:206）
  - UI 交互：黄庄结算每行显示0分、不飘分；自己所在行按“输/平局”暗色底样式显示。

闲家以 2 倍番型自摸：庄家付 16，两名闲家各付 2，赢家得 20。平胡点炮：赢家 +8，放铳者 −8，另两家 0。
  - 待确认：客户端代码未找到对应实现

本场积分从 0 起，每小局加上实际净得分。赢家加实收，赔付者扣实付。
  - 客户端实现：本场累计分直接用服务端下发的每家累计分数覆盖写入玩家数据，玩家头像按该值刷新；客户端不做加总，也不负责起始归零（GameResultHuCmd.ts:230、GamePlayerScoreCmd.ts:31、BoxHzmjPlayerView.ts:514）
  - UI 交互：玩家头像旁分数在每小局结算后刷新；小结算面板只显示本局分数，不显示本场累计；小结算后再延迟弹出总战绩界面。

## 番型

先确认牌型，再确认这次是自摸、点炮胡还是抢杠胡。番型分三组，组内只取最高一档，组间连乘。点炮和抢杠不算爆头、财飘、杠开、十风。
  - 客户端实现：结算时同时读取服务端下发的番型列表与胡牌类型，番型列表用于选番型字效与音效，胡牌类型用于判断是否自摸并选择动作皮肤，客户端不做判定顺序运算（source-code/client/Code/layer/BoxHzmjTipAniView.ts:929、source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:164、source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:181、source-code/client/Code/layer/BoxHzmjMainView.ts:671）；番型 ID 表按基础（含七对）、杠开、财神三组归类，播字效时用动画优先级表在全部命中的番型里取最高一档作为主番型（source-code/client/Code/config/FanDefine.ts:12、source-code/client/Code/config/FanDefine.ts:282、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1034）；组间连乘客户端不重算，直接展示服务端下发的总倍数，胡牌按钮显示胡牌倍数，结算流水行与听牌面板显示服务端点数（source-code/client/Code/config/FanDefine.ts:12、source-code/client/Code/layer/BoxHzmjMainView.ts:666、source-code/client/Code/layer/comp/BoxHzmjResultMid.ts:772、source-code/client/Code/layer/BoxHzmjTingPaiView.ts:141）；客户端只在表现层区分自摸与点炮、抢杠（动作皮肤、点炮字效、番型音效），未见对番型列表做剔除或改判的逻辑（source-code/client/Code/layer/BoxHzmjTipAniView.ts:929、source-code/client/Code/controller/cmd/gameCmd/GameResultHuCmd.ts:339、source-code/client/Code/layer/BoxHzmjTipAniView.ts:892）
  - UI 交互：胡牌按钮按胡牌类型切换自摸、胡两种动作皮肤，胡牌者方位播放番型字效，点炮时由放铳方位另播点炮字效；同一手牌只播一个主番型字效，杠飘、杠爆、七客这类组合另走组合字效节点；胡牌按钮显示“N倍”，结算流水行显示“N倍”，听牌面板每张听牌显示服务端下发的倍数并按房间封顶值截断；点炮或抢杠时胡牌按钮用“胡”皮肤而非“自摸”皮肤，放铳方位播放点炮字效

| 组 | 番型 | 倍数 | 成立条件 |
| --- | --- | --- | --- |
| 基础 | 平胡 | 1 | 4 组面子加 1 对。财神可参与面子或对子。 |
| 基础 | 七对 / 豪华 / 双豪华 / 三豪华 | 2 / 4 / 8 / 16 | 14 张组成 7 对，且手里至少有 1 张财神。某种非财神牌面有 4 张实牌，计 1 组豪华。白板不计豪华。 |
| 基础 | 清七对 / 豪华 / 双豪华 / 三豪华 | 4 / 8 / 16 / 32 | 同样是 7 对，但手里没有财神。 |
| 杠开 | 杠上开花 / 二连杠 / 三连杠 / 四连杠 | 2 / 4 / 8 / 16 | 自摸，杠链为 1 / 2 / 3 / 4 及以上。 |
| 财神 | 爆头 | 2 | 自摸，飘档为 0，单放与财神成将。听任意牌时，改看进张前是否敲响。 |
| 财神 | 财飘 / 双财飘 / 三财飘 | 4 / 8 / 16 | 自摸，飘档正好为 1 / 2 / 3 及以上，且单放与财神成将。3 档及以上都是三财飘。 |

  - 客户端实现：平胡只定义番型 ID 与名称，并在番型列表为空时按平胡兜底命名，不判定面子与将的成型（source-code/client/Code/config/FanDefine.ts:15、source-code/client/Code/config/FanDefine.ts:274、source-code/client/Code/config/FanDefine.ts:516）；财神可参与面子或对子体现为副露与顺子展示时把财神按缺口推断替代牌值插入，胡牌组合标志里定义了“财神面（组）”与“财神将”，实际成型判定不在客户端（source-code/client/Code/config/BoxMahDefine.ts:434、source-code/client/Code/config/GameDefine.ts:253、source-code/client/Code/config/GameDefine.ts:255）；平胡倍数在番型表标注为 1 倍，实际展示的倍数取服务端下发的点数（source-code/client/Code/config/FanDefine.ts:15、source-code/client/Code/layer/BoxHzmjMainView.ts:666）
  - UI 交互：番型列表缺失或全部为平胡时，桌面结算文案显示“平胡”；副露与顺子按牌值升序摆放，财神被插到它所补的缺口位置；胡牌按钮与结算流水按服务端点数显示“N倍”

  - 客户端实现：七对系有七对与各豪华档位的番型 ID 与名称，并把七对系叠加爆头或财飘时改名为七客，未见“至少一张财神”的判定（source-code/client/Code/config/FanDefine.ts:34、source-code/client/Code/config/FanDefine.ts:83、source-code/client/Code/config/FanDefine.ts:420）；四档七对分别有番型 ID、名称与字效皮肤，倍数只在注释中标注，展示取服务端倍数（source-code/client/Code/config/FanDefine.ts:35、source-code/client/Code/config/FanDefine.ts:39、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1143、source-code/client/Code/config/FanDefine.ts:104）；豪华只有豪华、双豪华、三豪华三档名称与档位字效，没有按四张实牌统计豪华组数的逻辑（source-code/client/Code/config/FanDefine.ts:36、source-code/client/Code/config/FanDefine.ts:437、source-code/client/Code/config/FanDefine.ts:441）
  - UI 交互：结算文案显示七对、豪华七对、双豪华七对、三豪华七对，叠加爆头时显示七客系名称；四档七对分别播不同的番型字效（七对、豪华、双豪华、三豪华），七客档位另用 hhqk、2hhqk、3hhqk 等皮肤；命中的豪华档位在结算文案与字效中体现
  - 待确认：客户端代码未找到对应实现

  - 客户端实现：清七对及三档豪华清七对有番型 ID 与名称，未见“手里没有财神”的判定（source-code/client/Code/config/FanDefine.ts:41、source-code/client/Code/config/FanDefine.ts:87、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1151）；四档清七对的 ID、名称与字效齐全，倍数值只写在注释里，展示取服务端倍数（source-code/client/Code/config/FanDefine.ts:41、source-code/client/Code/config/FanDefine.ts:47、source-code/client/Code/config/FanDefine.ts:89）
  - UI 交互：清七对四档各有独立字效皮肤（qqd、hhqqd、2hhqqd、3hhqqd），分别播不同字效；结算文案显示对应档位名称

  - 客户端实现：杠开有提示检测，手牌张数模 3 余 2、存在听牌、手里恰有一组可杠牌时提示可杠开，结算时按是否自摸选择动作皮肤（source-code/client/Code/config/FanDefine.ts:25、source-code/client/Code/data/GameData.ts:411、source-code/client/Code/data/GameData.ts:418、source-code/client/Code/layer/BoxHzmjTipAniView.ts:929）；杠链 1 至 4 分别定义四个番型 ID 与名称，并提供把番型 ID 换算成档位序号的函数，档位用于组合文案与字效选择（source-code/client/Code/config/FanDefine.ts:28、source-code/client/Code/config/FanDefine.ts:296、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1135、source-code/client/Code/config/FanDefine.ts:80）；四档倍数只在番型表注释中标注，实际展示取服务端下发的点数（source-code/client/Code/config/FanDefine.ts:26、source-code/client/Code/config/FanDefine.ts:31、source-code/client/Code/layer/BoxHzmjMainView.ts:666）
  - UI 交互：摸牌后若满足杠开条件给出杠开相关提示，胡牌按钮按自摸显示“自摸”动作而非“胡”；四个档位分别播 gk、2lgk、3lgk、4lgk 字效，组合成杠飘时按档位拼出“杠飘（二连杠）”这类文案；胡牌按钮与结算流水按服务端点数显示倍数

  - 客户端实现：番型表把爆头描述为自摸加财神对且无飘，另有万能听（任意牌）识别与财神将标志定义，但没有飘档与单放的结算判定（source-code/client/Code/config/FanDefine.ts:17、source-code/client/Code/config/BoxMahDefine.ts:883、source-code/client/Code/data/GameData.ts:1987、source-code/client/Code/config/GameDefine.ts:254）；爆头倍数在番型表标注为 2 倍，实际展示取服务端点数（source-code/client/Code/config/FanDefine.ts:17、source-code/client/Code/layer/BoxHzmjMainView.ts:666）；万能听识别不按“敲响”判断，打出财神且听任意牌标记为飘，其余万能听标记为爆，代码中未见敲响这一概念（source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:193、source-code/client/Code/layer/BoxHzmjTingPaiView.ts:41、source-code/client/Code/data/GameData.ts:1987）
  - UI 交互：万能听时在该张牌上显示爆的听牌标签，听牌面板对任意牌显示“胡”；胡牌按钮与结算流水显示服务端给的倍数；打出某张牌后若构成万能听，在该牌上显示爆或飘的听牌标签

  - 客户端实现：接收飘计数消息并写入各座位飘状态，另把打出财神后听任意牌标为飘，番型表把财飘描述为自摸加财神对加飘档（source-code/client/Code/config/FanDefine.ts:19、source-code/client/Code/controller/cmd/gameCmd/GamePiaoCmd.ts:21、source-code/client/Code/config/BoxMahDefine.ts:885、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1680）；三档财飘分别定义番型 ID 与名称，并提供把番型 ID 换算成飘档序号的函数，第 3 档作为封顶档使用（source-code/client/Code/config/FanDefine.ts:23、source-code/client/Code/config/FanDefine.ts:311、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1129、source-code/client/Code/config/FanDefine.ts:78）
  - UI 交互：有人飘时在该座位播 piao 动作字效，打出财神构成万能听时在牌上显示飘标签；三档分别播 cp、2cp、3cp 字效，文案显示财飘、双财飘、三财飘

同时命中杠上开花和财飘时，去掉这两条，改记杠飘或飘杠，倍数 8，再乘基础番。例如平胡加这一档是 8 倍，七对加这一档是 16 倍。
  - 客户端实现：组合解析在同时出现杠开系与财飘系、或直接收到杠飘、飘杠组合番型时，归并为杠飘或飘杠，文案只写组合名并附非 1 档的明细（source-code/client/Code/config/FanDefine.ts:257、source-code/client/Code/config/FanDefine.ts:365、source-code/client/Code/config/FanDefine.ts:368、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1101、source-code/client/Code/config/FanDefine.ts:52）；番型表标注杠飘与飘杠均为 8 倍并附组合文案示例，最终倍数取服务端下发的总点数，客户端不做 8 乘基础番的运算（source-code/client/Code/config/FanDefine.ts:52、source-code/client/Code/config/FanDefine.ts:351、source-code/client/Code/config/FanDefine.ts:389、source-code/client/Code/layer/BoxHzmjMainView.ts:666）
  - UI 交互：组合字效播 gp 或 pg；赢家流水文案与桌面结算文案写成杠飘或飘杠，不再并列显示杠上开花与财飘；胡牌按钮与结算流水按服务端点数显示倍数，桌面文案显示“杠飘（二连杠，双财飘）”这类组合明细

十风：从第一张出牌起连续打字牌。中途打出非字牌，或吃、碰、杠，本局作废，不能再重新累计。满 10 张后任意自摸都能胡，不要求成牌。只记十风，不与平胡、杠开、财飘、七对相乘。10 张为 2 倍，每多一张再乘 2。
  - 客户端实现：十风被当独占番型识别，代码注释说明十风亮牌走牌河、胡牌明细里的手牌与组合不能当剩余手牌使用，未见“不要求成牌”的判定（source-code/client/Code/config/FanDefine.ts:49、source-code/client/Code/config/FanDefine.ts:176、source-code/client/Code/layer/BoxHzmjTipAniView.ts:1160）；萧山侧的独占番名单中列入十风，独占番直接按服务端单条结果展示，不做叠加拆分（source-code/client/Code/config/FanDefine.ts:49、source-code/client/Code/config/XsmjFanConfig.ts:36、source-code/client/Code/config/XsmjFanConfig.ts:38）；番型表注释记录十风 2 倍起、每多一张翻倍的口径，客户端不计算，展示取服务端点数（source-code/client/Code/config/FanDefine.ts:49、source-code/client/Code/config/XsmjFanConfig.ts:23、source-code/client/Code/layer/BoxHzmjMainView.ts:666）
  - UI 交互：十风播放专属番型字效（sf），结算亮牌按十风特例处理；十风单独播一段字效，不与其它番型拼组合文案；胡牌按钮与结算流水显示服务端给的倍数
  - 待确认：客户端代码未找到对应实现
  - 待确认：客户端代码未找到对应实现

财神牌面染红，可点击，没有角标。打出后牌河仍是原牌面，只保留这层红色。
  - 客户端实现：按本局财神牌值维护全局染色映射，手牌刷新时把财神牌值交给牌组件染色，同时清空癞子标记与角标标记，牌的可点性由禁打数据单独维护、不被染色流程改动（source-code/client/Code/data/GameData.ts:52、source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:68、source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:70、source-code/client/Code/layer/BoxHzmjPlayerHandCards.ts:73、source-code/client/Code/util/BoxHzmjMahColorUtil.ts:29）；出牌后刷新对应座位牌河时，重新把牌河、胡牌列表、副露整体刷一遍财神色，染色只改颜色标记，不改牌面资源（source-code/client/Code/layer/BoxHzmjMah2DView.ts:1093、source-code/client/Code/layer/BoxHzmjMah2DView.ts:1130、source-code/client/Code/util/BoxHzmjMahColorUtil.ts:51、source-code/client/Code/util/BoxHzmjMahColorUtil.ts:29）
  - UI 交互：手牌中的财神显示为红色牌面，没有角标，未被禁打的财神仍可点击出牌；牌河里打出的财神显示原来的白板牌面，仅叠加一层红色，同牌处于高亮状态时不覆盖高亮色

## 结算

胡牌确认后停止行牌，每小局只结算一次。自摸的胡张是本次摸入或补入的牌，点炮胡的胡张是弃牌，抢杠胡的胡张是被抢的第 4 张。

  - 客户端实现：注册结算命令处理 MsgResultHu（GP_HZMJ_RESULT_HU），一次性落库并启动摊牌、番型、飘分与小结算流程；结算行按 hu_items 的 dan_fang 取胡张，胡牌行以单放牌节点展示该张并按胡牌组合归属打胡角标（GameResultHuCmd.ts:44；GameGlcProtocol.ts:142；GameResultHuCmd.ts:303；BoxHzmjResultMid.ts:255；BoxHzmjResultMid.ts:434；proto_game_hzmj.d.ts:1576）
  - UI 交互：结算消息到达后进入固定结算演出序列，不再回到出牌流程；胡牌者行内单放一张牌，并在所属组合内打「胡」角标。

- 各端停止操作按钮、胡牌预览和放大弃牌，方位盘停止倒计时。在原牌桌亮出四家手牌，桌面中央显示「对局结束」。保留终局牌河、财神和余牌数。
  - 客户端实现：胡牌动画阶段派发关闭操作与隐藏放大弃牌事件，并隐藏听牌（胡牌预览）面板、清空听牌信息；方位盘倒计时由权限/动作消息驱动的计时器控制，提供清空倒计时与停止计时的入口；摊牌流程按座位重置手牌为正面并拼接胡张，同时把副露刷新到桌面，结束类型非空时派发结束字样事件由提示层切到对应页面（GameResultHuCmd.ts:241；GameResultHuCmd.ts:258；BoxHzmjMainView.ts:494；BoxHzmjMainView.ts:1059；BoxHzmjMah2DView.ts:718；BoxHzmjMah2DView.ts:388；BoxHzmjMah2DView.ts:1045；BoxHzmjMah2DView.ts:1059；BoxHzmjTipAniView.ts:1186；HzmjTipAniComponent.xml:69）
  - UI 交互：操作按钮区切回空状态，听牌面板关闭，出牌放大层整体隐藏；倒计时数字清空、方位闪烁灯隐藏；四家手牌全部翻开，桌面中央加载「对局结束」图。

- 「对局结束」仍在时，胡牌者方位播放番型字效。点炮胡和抢杠胡同时在放铳方位显示「点炮」，抢杠胡的放铳者是加杠者。
  - 客户端实现：结算按胡牌座位逐个派发番型演出，提示层按座位取对应动画节点，按命中的番型选择字效资源并播放，播完回调推进飘分；结算按胡牌的放铳来源座位派发点炮动画（一炮多响用另一套资源），提示层在对应座位节点播放点炮表现（GameResultHuCmd.ts:282；BoxHzmjTipAniView.ts:964；HzmjTipAniComponent.xml:8；GameResultHuCmd.ts:264；BoxHzmjTipAniView.ts:891；GameResultHuCmd.ts:171）
  - UI 交互：对应座位方位出现番型字效，播完自动隐藏；放铳者方位出现「点炮」/一炮多响字效，播完隐藏。

- 先刷新头像旁的累计积分。番型字效退场后，只在本局得分不为 0 的座位内侧飘分。正分金黄色，负分浅蓝灰色并带减号。飘分淡出后短暂保留终局牌桌，再打开小结算。
  - 客户端实现：结算消息里的玩家总分被写入各玩家的累计分字段，玩家视图收到分数刷新事件后用该值更新头像区分数；桌面飘分数据只写入非 0 分数的座位，番型字效首个座位播完后按座位遍历飘分，飘分文本按分数正负切换不同字图、正分补加号；结算消息处理后执行摊牌，并以固定 3 秒延迟执行打开小结算的命令，随后再派发总结算事件（GameResultHuCmd.ts:229；BoxHzmjPlayerView.ts:509；BoxHzmjTipAniView.ts:726；GamePlayerScoreCmd.ts:42；GameResultHuCmd.ts:206；GameResultHuCmd.ts:276；BoxHzmjTipAniView.ts:567；HzmjTipAniComponent.xml:56；GameResultHuCmd.ts:306；GameResultHuCmd.ts:309；BoxHzmjFlowUtil.ts:25）
  - UI 交互：各玩家头像旁累计积分刷新为新数值；座位内侧出现飘分数字，按正负切换字图，动画结束后淡出隐藏；终局牌桌停留数秒后弹出小结算面板。

- 黄庄：亮出四家手牌，桌面中央显示「黄庄」，保留终局牌河、财神和余牌数 20。不飘分。四家本局都是 0，随后打开小结算，标题为「黄庄」。
  - 客户端实现：结束类型为流局时同样走摊牌流程，并把结束字样控制器切到 drawn 页；财神与余牌数沿用当局数据刷新，不在结算时清空（GameResultHuCmd.ts:84；HzmjTipAniComponent.xml:3；BoxHzmjMah2DView.ts:378；BoxHzmjMah2DView.ts:365）
  - UI 交互：中央加载黄庄提示图，桌面仍显示牌河、财神与右侧余牌数。

小结算盖在终局牌桌上。各端以本家为第一行，向下依次为下家、对家、上家。本家行置顶并高亮。胡牌局按本端本局净得分切换主题：大于或等于 0 为「恭喜获胜」，小于 0 为「遗憾失败」。黄庄四端都是「黄庄」。

  - 客户端实现：小结算视图在基础层以结算排序打开，中间区按玩家列表顺序逐行渲染，座位方向文案把本地 0 号位判为本家、1 号为下家、末位为上家，本家行切到高亮页并显示金币图标；组装结算数据时按本家净得分产出胜负标记（0 及以上记胜、负分记负），黄庄统一记为流局，中间区据此切换行的高亮页与背景页（BoxHzmjResultView.ts:29；BoxHzmjResultMid.ts:110；BoxHzmjResultMid.ts:965；BoxHzmjResultMid.ts:368；ResultItem.xml:25；BoxHzmjResultUtil.ts:36；BoxHzmjResultMid.ts:371；BoxHzmjResultMid.ts:374）
  - UI 交互：面板覆盖牌桌，第一行为本家并高亮，其后依次为下家、对家、上家；本家行主题按胜负切页，黄庄局走流局页。

- 每行左侧为座位、头像和昵称。庄家行显示「庄×3」。中间从左到右是碰杠区和手牌，杠的第 4 张垒在上方，暗杠顶张正面。胡牌者其余手牌按胡牌组合分组，未胡牌者连续摆放。胡入的那一张在所属组合内标绿色「胡」。
  - 客户端实现：逐行写入座位方向文案、玩家昵称与头像并支持点头像看资料，庄家行按服务端下发的牢庄档位切庄倍数角标；胡牌且有组合时按组合渲染，否则按副露加连续手牌渲染，杠组用四张页把第 4 张垒到上方，暗杠把前三张置为背面、顶部一张保持正面，胡张所在组最后一组内打胡角标（BoxHzmjResultMid.ts:150；BoxHzmjResultMid.ts:306；BoxHzmjResultMid.ts:399；BoxHzmjResultMid.ts:402；GameJuDataCmd.ts:34；BoxHzmjResultMid.ts:557；BoxHzmjResultMid.ts:583；BoxHzmjResultMid.ts:588；comboSefl.xml:21；mahHandSelf.xml:30）
  - UI 交互：左侧竖排座位名、头像与昵称，庄家位置出现庄倍数角标；从左侧碰杠组到右侧手牌依次排布，杠组顶部多出一张，暗杠只露顶张，胡入牌带角标。

- 右侧为本局净得分。正分带加号，0 分显示「0」，负分带减号。
  - 客户端实现：逐行取服务端下发的本局净得分，正分补加号后显示，并按正负切换胜负字图；0 分按原样显示（BoxHzmjResultMid.ts:365；BoxHzmjResultMid.ts:366；ResultItem.xml:75）
  - UI 交互：每行右侧分数按正负显示不同字图与符号。

- 赢家牌组上方写实际命中的番型名称。同时命中多组时都写上，例如「七对」「杠飘」。双财飘、双豪华七对、二连杠直接写全名。最右侧标胡牌方式：自摸、点炮胡或抢杠胡。点炮胡、抢杠胡的赔付者标「点炮」。
  - 客户端实现：按服务端下发的番型 ID 生成文案，无流水时从胡牌番型兜底生成，文本写在牌组上方的流水文本上，组合番按名称规则拼接档位明细；胡牌行按胡牌类型切标签页，自摸走自摸页，其余统一走吃胡页，该标签与承包角标同组竖排；非胡牌座位若为某条非自摸胡牌项的放铳来源，则该行切到点炮页显示标签（BoxHzmjResultMid.ts:759；BoxHzmjResultMid.ts:766；FanDefine.ts:389；BoxHzmjResultMid.ts:777；ResultItem.xml:72；BoxHzmjResultMid.ts:729；ResultItem.xml:5；ResultItem.xml:94；BoxHzmjResultMid.ts:734）
  - UI 交互：赢家行牌组上方出现番型文字，命中多组时连续展示，超长时截断；赢家行右侧显示胡牌方式标签；放铳者行右侧出现「点炮」标签。

- 三摊承包：赢家标黄色「承包」，赔付者得分右侧标「三摊承包」。反承包：赢家标「反承包」，赔付者标「反承包」。链式承包：赢家同时标「承包」和「反承包」，番型只写一次；付 S 的一方标「三摊承包」，付 2 × S 的一方标「反承包」。
  - 客户端实现：承包明细中关系为承包时赢家行流水追加「承包」文案，承包方（出承包的一方）行切承包角标页；关系为反承包时赢家行流水追加「反承包」，出承包的一方行切反承包角标页；承包明细逐条遍历，同一赢家存在两条关系时两条文案都会追加到流水，番型文案由番型兜底单独生成不随关系重复，角标对每个座位只取首条命中关系（BoxHzmjFlowUtil.ts:432；BoxHzmjFlowUtil.ts:445；BoxHzmjResultMid.ts:212；ResultItem.xml:17；BoxHzmjFlowUtil.ts:429；BoxHzmjResultMid.ts:209；ResultItem.xml:20；BoxHzmjFlowUtil.ts:427；BoxHzmjFlowUtil.ts:444；BoxHzmjResultMid.ts:207；BoxHzmjResultMid.ts:766）
  - UI 交互：赢家行出现承包文案、承包方行右侧出现承包角标图；反承包时赢家行出现反承包文案、赔付方行出现反承包角标；链式承包时赢家行文本同时出现承包与反承包，番型只出现一次。

- 左下展示本局财神正面，即白板。右下为「长按查看牌桌」：在底部栏扣除中央主按钮后的区域按住 500 毫秒，临时收起小结算，按本家视角查看终局牌桌；松手恢复同一张小结算。
  - 客户端实现：左下区按当局财神值取牌面并以正面状态显示，同时打财神专用颜色，无财神时整块隐藏；结算视图在长按开始/结束时向游戏内派发查桌与恢复事件，桌面视图收到后高亮/取消高亮桌上财神（BoxHzmjResultLeft.ts:30；BoxHzmjResultLeft.ts:37；BoxHzmjResultLeft.xml:4；BoxHzmjResultView.ts:98；BoxHzmjResultView.ts:103；BoxHzmjMah2DView.ts:1152）
  - UI 交互：左下角出现一张财神牌正面并带财神配色；长按后小结算收起、牌桌可见并高亮财神，松手恢复小结算。

- 非末局底部中央为【继续游戏】。点击后本端收起小结算，清除上一局手牌、碰杠区和牌河，保留座位和累计积分，本家显示「已准备」。四人均准备后自动开下一小局。第 8 局按钮为【返回大厅】，点击后退出房间。
  - 客户端实现：继续游戏的回调在本类为空实现；重新开局时由重开事件触发重置流程，清空当局手牌、副露、牌河与操作状态并隐藏小结算，玩家累计分字段保留；准备角标由房间层下发的动作状态驱动（BoxHzmjResultView.ts:119；BoxHzmjMainView.ts:372；BoxHzmjMainView.ts:426；GameData.ts:176；PlayerSelfBase.xml:5）
  - UI 交互：点击后小结算收起、牌桌清空回到等待，本家头像出现准备角标。
