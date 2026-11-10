# 【杭州麻将】核心流程杭州麻将好友房AI

修订历史记录

注：改版说明中填写C\-创建, A\-追加,M\-修改,D\-删除,R\-评审\(如果是评审，请在备注栏注明，是否批准发布\)

|版本|改版日期|改版说明\*||作者|备注（是否批准）|
|---|---|---|---|---|---|
|V1\.0|2026\-11\-09|C\-创建|初稿|周寅| |
|||||||

# 本期开发范围

四人、8局、底分1、白板财神、笃三老庄、庄闲放铳、三摊承包、无封顶，并启用吃碰禁手。首局随机坐庄，之后沿用赢家坐庄，流局由原庄连庄。每小局保留小结算，未满8局则继续下一小局，满8局结束本场。

本期只做游戏内核心流程。原文中的创房面板、其他玩法选项、大结算和非核心桌面功能，如在核心段落中被引用，仅作原文上下文。本核心流程全程按无托管处理。文中保留的托管条目仅供原方案对照。

主方案　[规则概述](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcnufWdO8j9mSvlBL2PGirKxc)　｜　[基础操作及规则](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcn4dmjM7oGhLp8TUwkrpnMBg)　｜　[玩法规则](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcnY88H7D7OsBEvaBfvFMojNg)　｜　[算分规则](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcnN85S7FSU9PqPjSG505KRSh)　｜　[胡牌番型介绍](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcnPuNSme00EeDqzxphhddMUf)　｜　[局内流程](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcnRuH7XCHVrGs8HOFCSY8fod)　｜　[结算流程](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcnqB8JesLUSpapAvUxWcd8sc)　｜　[小结算界面](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcn6PO2pfB3S48gS2P3VmtBbc)

# 默认规则

**本期固定生效**

- **人数与局数。**固定四人、8局。坐满4人且全部已准备后由房主开始游戏，流局也计1局。

- **牌组与财神。**使用136张牌，白板固定为财神。

- **定庄与轮庄。**首局随机坐庄。后续由上一局胡牌者坐庄，流局由原庄连庄。

- **连庄数。**固定笃三老庄，庄家按三牢、8倍计算。

- **胡牌玩法。**固定庄闲放铳（庄三）。保留自摸，点炮和抢杠胡按庄闲放铳的适用条件判定。

- **承包与行牌。**启用三摊承包和吃碰禁手，碰算摊关闭。

- **计分与结算。**底分1，分数无封顶。每小局进入小结算，满8局结束本场。

**本期可选规则**

无。进入房间后直接使用以上固定配置。

**原方案中的后续可选项**

翻财神、平庄起、笃二老庄、仅自摸、两摊封顶，以及其他人数、局数、底分、封顶值和额外游戏规则，留待后续版本。[查看原方案创房选项](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcnNtwZ66lFuVbCTaZ2KHmi80)

# 二、功能详情

## 游戏规则概述

[查看主方案原文](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcnufWdO8j9mSvlBL2PGirKxc)

|**游戏品类**|**麻将**|
|---|---|
|对局人数|- 支持2人、3人、4人三种对局人数，由创建房间时在创房面板中选择。|
|牌数<br>|- 2人、3人、4人模式的基础牌组均为136张，由数牌、风牌、箭牌组成。实际用牌种类和总张数受创房面板选项影响，详见「无风牌」「缺一色」等对应规则模块。<br>    - 数牌：万、筒、条三种花色，每种花色均有1至9共9种牌面，每种牌面4张；每种花色36张，三种花色合计108张。<br>    - 风牌：东、南、西、北四种牌面，每种牌面4张，合计16张。<br>    - 箭牌：中、发、白三种牌面，每种牌面4张，合计12张。|
|规则概述|- 胡牌判定：玩家符合本方案规定的胡牌番型及胡牌判定条件时，可以胡牌；具体条件见胡牌相关模块。<br>- 吃、碰、杠：玩家满足对应操作条件时，可以执行吃、碰、杠；具体条件及特殊限制见对应模块。操作优先级：针对同一张弃牌，多名玩家存在操作竞争时，碰、杠优先于吃。其他优先级关系及具体响应处理方式在对应模块中说明。<br>    - 吃牌对象：玩家仅可吃上家刚打出的牌；上家的定义及不同人数下的座位关系见对应模块。<br>    - 风牌、箭牌：不能组成顺子，不可吃；满足条件时可以碰或杠。被指定为财神等特殊情况的处理见对应模块。<br>- 胡牌方式：包括自摸胡和点炮胡；他人打出牌使玩家胡牌的行为称为放铳（点炮）。各胡牌方式的适用条件和限制见对应模块，并非在所有局面下均可点炮胡。|

## 基础名词和概念解释

[查看主方案原文](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcnb8vh3nTDpIAuhUAzhyOM0b)

### 操作名词

|名词|说明|
|---|---|
|摸|- 常规摸牌时，按牌堆正序从牌堆头部取1张牌，加入自己的手牌。杠后补牌的取牌方向见“杠”的说明。|
|打|- 在允许自己出牌的阶段，从自己的手牌中选择1张牌打出。|
|吃|- 上家刚打出的1张牌，与自己手中的2张数牌能组成同花色、点数连续的3张牌（顺子），且满足本方案的吃牌条件时，可选择吃牌。例如：自己有2筒、3筒，上家打出1筒或4筒时，可以组成顺子。上家的定义和特殊限制见对应模块。|
|碰|- 其他玩家刚打出的1张牌，与自己手中的2张相同牌能组成3张相同牌（刻子），且满足本方案的碰牌条件时，可选择碰牌。不能碰自己打出的牌；特殊限制见对应模块。|
|杠|- 以他人弃牌形成明杠为例：其他玩家刚打出的1张牌，与自己手中的3张相同牌组成4张相同牌的杠子，满足对应条件时可杠牌。杠牌成立后，由杠牌玩家从牌堆尾部（倒序）补摸1张牌。其他杠牌类型及限制见杠牌模块。|
|胡|- 玩家通过自己摸牌（含杠后补牌）或其他玩家打出的牌，使牌满足本方案规定的胡牌番型及胡牌判定条件时，可选择胡牌。前者为自摸胡，后者为点炮胡；自摸胡与点炮胡各自的适用条件及特殊限制见胡牌相关模块。|

### 名词介绍

|名词|说明|
|---|---|
|【对子】（可简称对）|- 由2张相同牌面的牌组成，即一对，适用于数牌、风牌和箭牌。例如2张1筒或2张东风均为对子。<br>- 胡牌组合判定时，也可以用1张财神＋任意1张牌组成对子，由财神替代与另一张牌相同的牌面。例如财神＋1筒，可按2张1筒这一对子判定。|
|【顺子】（可简称顺）<br>|- 由同一花色、点数连续的3张数牌组成，1与9不可首尾相连。例如1筒、2筒、3筒是顺子；9筒、1筒、2筒不是顺子；<br>- 胡牌组合判定时，财神可替代顺子中任意位置的牌。例如：财神＋2筒＋3筒、1筒＋财神＋3筒、1筒＋2筒＋财神，均可按1筒、2筒、3筒这一顺子判定。该替代不能用于执行吃牌操作：不能拿财神代替缺少的牌去吃他人的弃牌。|
|【刻子】（可简称刻）|- 由3张相同牌面组成，适用于数牌、风牌和箭牌。例如3张1筒或3张东风均为刻子；<br>- 胡牌组合判定时，财神可按财神规则替代刻子中缺少的牌；但执行碰牌操作时，不能用财神替代缺少的同牌。例如手中只有1张东风和1张财神，不能用它们去碰他人打出的东风。|
|【杠子】（可简称杠）<br>|- 由4张相同牌面组成，适用于数牌、风牌和箭牌。例如4张1筒或4张东风均为杠子。能否执行杠牌操作仍须满足杠牌模块的操作条件；不能用财神替代缺少的牌来开杠。|
|【面子】<br>|- 面子是完整的顺子、刻子或杠子的统称。每一组顺子、刻子或杠子均计为1组面子；杠子虽然包含4张牌，仍只计1组面子。对子不属于面子。<br>- 胡牌组合判定时，面子既包括手牌中按规则组成的完整组合，也包括碰杠区中已完成的吃、碰、杠组合；涉及财神替代时，按财神规则判定。例如1筒＋2筒＋3筒、3张东风、已完成开杠的4张1筒，各为1组面子。|
|【副露】<br>|- 玩家通过吃、碰或明杠形成完整牌组，将对应牌张从手牌中单独列出，放入碰杠区并公开展示，这类牌组称为副露。明杠包括直杠和加杠。副露的牌组仍属于该玩家的面子，参与胡牌组合判定。<br>- 本方案的副露不包含暗杠。暗杠虽然也放在碰杠区，但不计为副露；判断是否副露应依据操作类型，不能仅依据牌组所在区域。暗杠及其他牌组的具体展示样式见对应交互模块。|
|【财神】<br>|- 财神的替代能力仅用于胡牌组合判定：可按本方案胡牌规则替代顺子、刻子或对子中所需的牌，其中顺子中的任意位置均可替代。执行吃、碰、杠操作时，均不得用财神替代缺少的牌；必须持有对应操作要求的实际牌张。本方案支持以下2种财神确定方式；特殊胡牌条件见对应模块。<br>- 白板财神：固定以白板作为财神，胡牌组合判定时可按规则替代所需牌面。<br>- 翻财神：开局随机翻出1张牌，以该牌的牌面确定本局财神牌面。翻出的1张不进入玩家可摸牌范围，当局可摸到的该牌面财神共3张；白板按被翻出牌的原牌面使用。具体翻牌流程及特殊情况见对应模块。<br>- 玩家在轮到自己且允许出牌时，可以主动打出手中的财神，无需处于爆头状态或额外满足其他条件；此处不表示可以在其他玩家的出牌阶段插入出牌。<br>    - 白板财神模式下：财神牌打出后失去万能牌功能，按普通白板牌处理；其他玩家不能吃、碰或杠该弃牌。<br>    - 翻财神模式下：财神牌打出后失去万能牌功能，按本方案规定作为普通白板牌处理；其他玩家不能吃、碰或杠该弃牌。<br>- 不能用财神替代其他牌来组成吃、碰、杠。例如上家打出2筒，自己不能用1筒加1张财神（替代3筒）去吃该2筒；同理，不能用财神替代缺少的相同牌进行碰或杠。财神牌本身涉及的其他操作条件见对应模块。|
|【牢庄】（可称连庄数）<br>|- 牢数分为一牢、二牢、三牢，表示当局庄家的连庄数。首次坐庄的起始牢数由创房面板“连庄数”配置决定，不固定为一牢；具体选项见后续创房模块。<br>    - 一牢：当局牢数为1，也称平庄。不能仅凭“首次坐庄”判定为一牢，须读取创房配置。<br>    - 二牢：当局牢数为2，也称笃二牢庄。若当前为一牢，庄家胡牌或流局后继续连庄，则庄家下一局进入二牢；首次坐庄的牢数仍以创房配置为准。<br>    - 三牢：当局牢数为3，也称笃三牢庄。若当前为二牢，庄家胡牌或流局后继续连庄，则庄家下一局进入三牢；达到三牢后继续连庄，下一局仍为三牢。<br>- 胡牌权限按当局牢数判断：一牢、二牢时，各家只能自摸胡牌；三牢时，除自摸胡牌外，庄家打出的牌可由闲家点炮胡，闲家打出的牌可由庄家点炮胡，闲家之间不能点炮胡。相关创房面板的具体说明见后续对应模块。<br>- 庄家胡牌或流局（黄庄）后，由同一玩家继续坐庄，下一局牢数＝当前牢数＋1，最高为3。流局既不换庄，也会使下一局加一牢，已达三牢则保持三牢。例如按一牢起时，连续坐庄各局的牢数为：一牢→二牢→三牢→三牢……。换庄顺序及相关创房面板见后续对应模块。|
|【摊】|- 玩家A使用玩家B打出的牌完成1次吃、碰或明杠，按本局创房配置计入A从B取得的摊数。<br>    - 摊数按取牌方向分别记录：A从B取得的摊数，与B从A取得的摊数互相独立。<br>- 吃、碰、明杠是否计摊，由创房面板的对应配置决定，例如“碰算摊”；具体判定见对应模块。|
|【片】|- 片数表示玩家在片数模式下的剩余额度。创房选择片数后，创房面板无法选择底分，对局底分固定为1分；每局仍按本方案的计分规则计算输赢，并据此增减片数。片数的具体创房面板见对应模块。<br>- 小局结算时按应扣片数全额扣除，结算后剩余片数可以为负数。例如结算前剩余40片，本局应扣50片，结算后剩余−10片。任一玩家结算后剩余片数小于或等于0片时，进入大结算。|
|【承包】|- 仅在启用“三摊承包”规则，且玩家A从玩家B打出的牌中取得的摊数按本局配置累计达到3摊时，才满足A对B的三摊承包条件。在该条件已满足的情况下，之后A胡牌，由B承包A本次胡牌原本应赢的全部分数，其他玩家不出分；若之后B胡牌，则由A承担倒承包，见“倒承包”说明。未启用该规则或未达到上述3摊条件时，不按此关系触发承包或倒承包。具体计分见结算模块。<br>- 3摊是触发承包的门槛，不是吃碰次数上限。达到3摊后，满足对应操作条件时仍可继续吃碰。|
|【倒承包】|- 倒承包没有独立开关。仅在同时满足以下前置条件时，才判断是否触发倒承包：①已启用“三摊承包”规则；②玩家A从玩家B打出的牌中取得的摊数按本局配置累计达到3摊，已满足A对B的三摊承包条件。在同一组三摊关系下，A胡牌由B承包；B胡牌则由A倒承包，不要求B再从A取得3摊。倒承包时，由A承担B本次胡牌原本应赢的全部分数，并在此基础上再额外支付同等分数，其他玩家仍不出分。例如B原本应赢的全部分数合计为10分，则A支付原有10分，再额外支付10分，合计支付20分，其他玩家支付0分。具体计分见结算模块。|
|【爆头】|- 爆头包括两种结构：①常规爆头：4组完整面子（含副露和已完成的暗杠，每组杠计1组面子）＋1张财神；②七对爆头（又称“七客”）：6组对子＋1张财神。下一次摸到任意1张牌，均可与该财神组成对子胡牌，其中七对爆头由此组成第7组对子。<br>- 爆头只能自摸胡。|
|【飘】<br>|- 玩家在自己的出牌阶段打出1张财神后，无论此前是否处于爆头状态，均触发该玩家的一次“飘财”。<br>    - 该次飘财限制其他所有参战玩家：除可按规则胡牌、暗杠外，只能摸打，即摸到什么牌就打出什么牌，不得改打原手牌；禁止吃、碰、明杠（包括直杠、加杠）。<br>    - 允许多名玩家先后飘财，并分别记录每次飘财的限制。例如A飘后B又飘，则A也受到B的飘财限制。玩家下一次摸牌后若未胡，继续行牌；仍须遵守其他尚未结束的飘财限制。<br>    - 当该次飘财的发起玩家下一次摸牌时，解除由该次飘财产生的限制；其他玩家发起且尚未结束的飘财限制继续生效。|
|【自摸】|- 玩家用自己常规摸牌或杠后补牌取得的牌完成胡牌，称为自摸胡；杠后补牌胡牌也称杠上开花。常规胡牌结构为4组完整面子（含副露和已完成的暗杠，每组杠计1组面子）＋1组对子；七对等特殊牌型的结构及创房面板的胡牌限制，见对应规则模块。|
|【放铳】|- 玩家打出的牌被另一名玩家用于胡牌，称该出牌玩家“放铳”（点炮）；对于胡牌玩家，该次胡牌称为点炮胡。点炮胡的适用范围及限制见对应模块。|
|【庄家】|- 每局一名庄家，由庄家先出牌。|
|【闲家】|- 每局除庄家以外的其他参战玩家均为闲家。闲家人数=对局人数−1：2人局有1名闲家，3人局有2名闲家，4人局有3名闲家。|
|【听牌】|- 玩家当前的牌只需再获得1张合适的牌，即可组成胡牌型，称为“听牌”（0向听）。可使其成牌的牌面可能有一种或多种；是否允许胡牌，仍须遵循本方案的胡牌限制。|
|【流局】|- 当牌墙剩余可摸牌数为21张时，允许当前玩家再摸1张，使剩余可摸牌数变为20张。先处理该次摸牌、出牌以及其他玩家对弃牌的响应；若无人胡牌且响应处理结束，在下一次应摸牌时停止摸牌，并判定流局，不在剩余牌数刚变为20时立即结束。|
|【向听数】|- 仅按成牌结构，计算当前牌型达到听牌所需的最少有效进张次数。0向听表示牌型已听牌；1向听表示最少再进1张有效牌并打出多余牌即可听牌，依此类推；已组成胡牌型记为−1向听。向听数不代表实际还需摸牌的次数。<br>- 计入财神的替代能力，分别按本方案允许的常规牌型和七对子计算，取最小值；已完成的吃、碰、杠组合保持不变。<br>- 向听数与胡牌资格分别判断。开启“有财必拷响”时，即使已达0向听或已组成胡牌型，仍须满足该规则要求的爆头条件才能胡牌。|
|【本家】|- 当前描述所指的玩家，即该玩家自己。上家、下家、对家均以本家为参照，按各玩家自己的视角确定。|
|【上家】|- 3人、4人局中，位于本家左侧、正常行牌顺序在本家之前的相邻参战玩家。上家关系不随吃、碰、杠造成的临时轮次变化而改变；2人局不设上家。|
|【下家】|- 3人、4人局中，位于本家右侧、正常行牌顺序在本家之后的相邻参战玩家。下家关系不随吃、碰、杠造成的临时轮次变化而改变；2人局不设下家。|
|【对家】|- 2人局中，唯一的另一名参战玩家称为对家，不使用上家、下家称谓；4人局中，对家是与本家座位相对、相隔两个座次的玩家；3人局不设对家。|

### 规则详情

#### 基础操作及规则

[查看主方案原文](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcn4dmjM7oGhLp8TUwkrpnMBg)

##### 【操作优先级】

|操作优先级|说明|
|---|---|
|【操作优先级】|- 对他人同一张弃牌，先按本局规则判定各玩家可执行的操作，再按以下优先级处理：点炮胡 \> 碰／明杠（直杠） \> 吃；碰与直杠同级。<br>- 多人可胡同一张弃牌时，从出牌者起按逆时针顺序，最近的一名可胡玩家优先；该玩家放弃后，顺延至下一名可胡玩家。每张弃牌只允许一人胡，不允许一炮多响。<br>- 操作结果与按钮点击先后无关。低优先级操作即使先被选择，也须等待相关高优先级玩家放弃或按超时规则处理后，才能执行；高优先级操作一旦执行，同一弃牌的其余响应取消。多人可胡时，也须遵循上述胡牌顺序。<br>- 吃牌仅能使用自己上家打出的牌。此处排序针对弃牌响应；自摸、暗杠、加杠等本人操作阶段的规则，见对应模块。|

##### 【吃】

|吃|说明|
|---|---|
|【吃】|- 上家刚打出的1张非财神牌，与玩家手中的2张非财神牌可组成同花色、点数连续的顺子时，玩家可以选择吃；存在多种合法组合时，选择其中1组。<br>- 吃牌是否执行，按“操作优先级”裁决；不能因先点击吃而越过点炮胡、碰或直杠。<br>- 吃成功后，将该弃牌与选定的2张手牌组成1组副露，不进行常规摸牌，进入本人出牌阶段。当前回合满足条件时即可加杠或暗杠；未选择杠时打出1张牌，杠后的流程见“杠”。<br>- 财神不能按自身牌面或替代其他牌参与吃；受尚未解除的飘财限制时禁止吃。|

##### 【碰】

|碰|说明|
|---|---|
|【碰】|- 其他任意一名玩家刚打出的1张非财神牌，与自己手中至少2张相同牌面的非财神牌，可组成刻子时，玩家可以选择碰。实际从手中取出2张；即使手中有3张，也只用其中2张完成碰。<br>- 碰牌是否执行，按“操作优先级”裁决；点炮胡优先于碰，碰优先于吃。<br>- 碰成功后，将该弃牌与2张手牌组成1组副露，不进行常规摸牌，进入本人出牌阶段。当前回合满足条件时即可加杠或暗杠；未选择杠时打出1张牌，杠后的流程见“杠”。<br>- 财神不能按自身牌面或替代其他牌参与碰；受尚未解除的飘财限制时禁止碰。|

##### 【杠】

|杠|模块说明|说明|
|---|---|---|
|【杠】|逻辑|- 执行直杠、加杠或暗杠前，剩余可摸牌数须≥22。每次杠从牌墙最后一墩按从上到下顺序补1张，另有1张退出可摸范围、不允许摸取，剩余可摸牌数合计减2，例如30→28。剩余20张须完整保留；剩21张或20张时禁止任何杠。<br>- 本人出牌阶段可以选择加杠、暗杠，包括刚吃或碰成功的当前回合。杠后补牌可按规则胡牌；未胡时可继续杠或打出1张牌。允许连续杠，每次均须重新检查剩余可摸牌数≥22及对应杠牌条件。<br>- 财神不能按自身牌面或替代其他牌参与任何杠。受尚未解除的飘财限制时，禁止直杠和加杠，仍允许满足条件的暗杠。七对胡牌结构不包含已开出的杠；开杠后不能再按七对胡牌。|
||明杠（直杠）|- 其他玩家刚打出的1张非财神牌，与自己手中的3张相同牌面的非财神牌可组成杠子时，可以选择直杠。按“操作优先级”裁决后执行；完成后按本表“逻辑”补牌。|
||明杠（加杠）|- 本人出牌阶段，已有碰出的刻子，且手中有第4张相同牌面的非财神牌时，可以选择加杠；吃或碰成功的当前回合也允许。<br>- 先处理其他玩家的抢杠胡响应；有人抢杠胡时不完成加杠，也不补牌；无人胡牌后完成加杠，再按本表“逻辑”补牌。|
||暗杠|- 本人出牌阶段，手中有4张相同牌面的非财神牌时，可以选择暗杠；吃或碰成功的当前回合也允许。完成后按本表“逻辑”补牌。<br>- 暗杠以3张背面、顶部1张正面的方式展示，其他玩家可通过正面牌识别该暗杠的牌面。|
||杠开（杠上开花）<br>|- 完成直杠、加杠或暗杠后，使用杠后补到的牌立即自摸胡牌，称为杠开（杠上开花）。允许连续杠：若杠后补牌未胡，而在未出牌的情况下继续合法开杠，使用最后一次杠后补到的牌立即自摸胡牌，同样算杠开。例如：杠→补牌→再杠→补牌→立即自摸胡，成立杠开。同时符合爆头条件时，按“杠爆”判断。杠后补牌未胡而打出任何一张牌（包括财神），则此前的杠不能再用于判定杠开；之后再次轮到自己摸牌时的胡牌，不能追溯为此前杠的杠开。|
||杠爆|- 完成杠后、补牌前，牌已由4组完整面子（含副露和已完成的暗杠，每组杠计1组面子）＋1张财神组成，再以补牌完成爆头自摸胡，称为杠爆。<br>- 七对牌型不允许开杠，不成立七对杠爆。|
||杠飘|- 完成杠后补牌，无论当时是否已满足胡牌条件，若未胡牌而紧接着打出1张财神，该打财行为按“飘财”处理，相关操作限制及解除条件见“飘”规则。飘财是打出财神的行为，不以之后是否胡牌作为成立条件。<br>- 在上述飘财后，轮到自己下一次摸牌时，使用该次摸到的牌完成爆头自摸胡牌，则该次胡牌判定为“杠飘”。若该次摸牌后未胡牌，或自摸胡牌但不满足爆头条件，则不成立杠飘，也不能按前一次杠的杠开处理；上述杠飘判定仅适用于飘财后的下一次摸牌，不能延续至更后的回合。|
||抢杠胡|- 他人加杠时，须在创房面板开启“庄闲放铳\(庄三\)”，并满足该选项的放铳条件，才可抢杠胡。具体判定见该创房面板对应模块。仍须满足本方案其他胡牌限制，不能仅凭0向听判断。<br>- 所加的第4张牌可使自己合法胡牌时，可以选择抢杠胡。多人可胡时，按已确认的逆时针就近顺序处理，只允许一人胡。<br>- 赔付方式同放铳，仅被抢杠的加杠者按放铳规则赔付，其他玩家不出分；不表示由其承担所有玩家原本应付分数的总和。具体分数见放铳及结算模块。|

##### 【自摸】

|自摸|说明|
|---|---|
|【自摸】<br>|- 本人通过常规摸牌或杠后补牌取得胡牌所需的牌，满足本局牌型及胡牌限制，并在该次摸牌后、出牌前胡牌，称为自摸。<br>- 常规胡牌结构为4组完整面子＋1组对子。已完成的副露和暗杠计入面子，每组杠计1组。七对等特殊牌型及“有财必拷响”等创房限制按对应规则判定。<br>- 杠后使用补牌立即自摸时，杠开、杠爆按“杠”模块判定。杠后补牌未胡而打出财神，下一次摸牌时以爆头自摸胡牌，按“杠飘”判定。|

##### 【放铳】

|放铳|说明|
|---|---|
|【放铳】|- 玩家打出的牌被另一名玩家用于合法胡牌时，出牌者称为放铳（点炮），胡牌者称为点炮胡（吃胡）。<br>    - 开启创房面板“庄闲放铳\(庄三\)”后，按该选项的条件判断点炮胡资格。当局为三牢庄，且出牌者与胡牌者一方为庄家、另一方为闲家时，才可点炮胡。未开启该选项时，仅允许自摸。<br>    - 同一张弃牌有多人符合胡牌条件时，从出牌者起按逆时针就近顺序裁决。优先者放弃后顺延给下一位，最多一人胡牌。详见 2\.3\.1\.1 操作优先级。<br>    - 按放铳方式结算时，仅由放铳者按结算规则支付。|

#### 玩法规则

[查看主方案原文](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcnY88H7D7OsBEvaBfvFMojNg)

##### 【局数】

|局数|说明|
|---|---|
|【局数】|- 创房时在固定局数和片数中选择一种。选择固定局数后，每完成一小局，已完成局数加1，流局也计1局。达到所选局数时进入大结算。|

##### 【人数】

|人数|说明|
|---|---|
|【人数】|- 创房人数可选2人、3人或4人。允许未满开局，开局时的参战人数按实际到桌人数确定。<br>    - 不同人数下的选项显示和开房后的规则处理，见「创房面板」模块。|

##### 【定庄】

|定庄|配置项|说明|
|---|---|---|
|【定庄】|随机坐庄|- 每场的第一个小局，从本场参战玩家中**随机确定庄家**。同桌大结算后再开一场时，沿用原房间的定庄配置，重新确定首庄。<br>- 同一场内，从第二个小局起，按2\.3\.2\.4「轮庄」确定庄家。|

##### **【轮庄】——默认赢家庄**

|轮庄|配置项|说明|
|---|---|---|
|【轮庄】|赢家坐庄|- 同一场内，当前小局有人胡牌且继续下一小局时，由胡牌者担任下一小局庄家。当局庄家胡牌时，视为连庄。<br>- 当前小局流局且继续下一小局时，由当局庄家连庄。连庄后的牢数按2\.2「牢庄」处理。<br>- 每场首局的庄家按2\.3\.2\.3「定庄」确定。|

##### 【财神】

|财神|配置项|说明|
|---|---|---|
|【财神】|白板财神|- 白板固定为财神，当局所有白板按本方案的财神规则使用。|

##### 【笃三老庄】

|笃三老庄|说明|
|---|---|
|【笃三老庄】|- 创房选择“笃三老庄”时，首局庄家及每次换庄后的新庄家均从三牢开始，庄家倍率为8倍。<br>    - 庄家胡牌或流局时继续坐庄，下一局保持三牢，庄家倍率仍为8倍。<br>    - 闲家胡牌时，按“轮庄”由胡牌者接任庄家。新庄家在下一局按三牢、8倍结算。<br>    - 三牢为最高牢数。该选项下，每局均按三牢的庄家倍率结算。|

##### 【庄闲放铳（庄3）】

|庄闲放铳|说明|
|---|---|
|【庄闲放铳】|- 创房时须在“胡牌”玩法中单独选择“庄闲放铳\(庄三\)”。当局为三牢且双方为庄闲关系时，符合本局胡牌条件的玩家可点炮胡。选择“笃三老庄”并开启此选项时，从首局起即可按本规则判定庄闲放铳。<br>    - 庄家出牌时，符合条件的闲家可点炮胡。闲家出牌时，仅庄家可按条件点炮胡。<br>    - 多人可胡同一张弃牌时，按2\.3\.1\.1“操作优先级”裁决，最多一人胡牌。结算按2\.3\.1\.6“放铳”处理。|

##### 【三摊承包】

|三摊承包|说明|
|---|---|
|【三摊承包】|- 当玩家A对玩家B累计达到**3摊**时，触发“承包机制”<br>    - 承包：A对B累计3摊后，A胡牌，B需**承包所有输分**（支付其他三家的赔付）<br>        - 示例：B赔付 = 胡牌分 × 3（如庄家自摸8分×3=24）<br>    - 被承包：A对B累计3摊后，B胡牌，A需**承包所有输分×2**（支付三家总和×2）<br>        - 示例：A赔付 = 胡牌分 × 3 × 2（如闲家自摸4分×6=24元）<br>    - 链式承包：A（庄）对B累计3摊 → C对A累计3摊 → A胡牌，B付三家分，C付三家分×2<br>        - 示例：B付12元，C付24元（基础分4分）<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YzRkYzQwZmUyNGRkODhjODcyOTBiMTUzNzk5YzkwZjRfYjE4N2Q5NzczNDQ1Yjk3NGY0Y2E5YTVmNWVhNzU4YThfSUQ6NzcwNjExOTU0OTkxNzMzNDUyN18xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>- 仅限**庄家与闲家之间**可形成3摊<br>- 闲家与闲家之间最多2摊（无法触发承包）<br>- 飘财的玩家飘财时的一圈，当其他玩家抓打的牌导致飘财者吃碰达到三摊时，不触发承包机制，需要第4摊时才触发|

##### 【吃碰禁手】

[查看主方案原文](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcnVvBZbSRAZ9lkqLS10TcC7f)

|吃碰禁手|说明|
|---|---|
|【吃禁手】|- 吃以后下一次摸牌前禁止打出特定牌：吃中间禁打中间，吃两边禁打两边<br>    - 示例：1、3条吃2条，则禁打2条；2、3条吃4条，禁打1、4条<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NTU0NjMxNWI5NjJkNjc5OTQyMzNkYzYyMzM0MTE3ZjZfZTBkNTQ0NDRjODljYmNiZDNjODA4Mzg3Y2MwYTU1ZDRfSUQ6NzcwNjEyMzI0NjQyMDU2MTE2NV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
|【碰禁手】|- 碰哪张就禁打哪张<br>    - 示例：碰2筒后禁打2筒|

##### 【底分】

|底分|说明|
|---|---|
|底分|- 在小局结算的时候用倍数乘算底分|

#### 算分规则

[查看主方案原文](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcnN85S7FSU9PqPjSG505KRSh)

|功能模块|模块分类|说明|
|---|---|---|
|结算<br>|结算算分|- 最终得分=底分×倍数×庄闲倍数<br>- 庄闲倍数：如果庄家胡则所有闲家给予庄家倍数为N倍，若闲家胡，则其他2个闲家给予1倍，庄家给予N倍<br>    - N的数值由连庄次数决定，一牢（平庄）为2倍，二牢（二连庄）为4倍，三牢（三连庄）为8倍，8倍封顶<br>    - 【笃三老庄】直接8倍起算（即所有人首局都是三连庄状态），即不计连庄次数，所有人都按8倍计算<br>- 自摸<br>    - 庄家自摸：最终得分=3闲家的底分×牌型倍数×牢数番<br>    - 闲家自摸：最终得分=【1庄家的底分×牌型倍数×牢数番】\+【2闲家的底分×牌型倍数】<br>- 放铳<br>    - 最终得分=底分×牌型倍数×牢数番|

#### 胡牌番型介绍

[查看主方案原文](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcnPuNSme00EeDqzxphhddMUf)

##### 番型分类

|类型|说明|
|---|---|
|【基础番型】|- 满足胡牌规则的最基础的胡牌番型|
|【财神番型】|- 带财神的番型|
|【杠开番型】|- 开杠后的番型|
|【七对番型】|- 七对子相关番型|
|【组合番型】|- 可进行叠加的特殊番型|

##### 番型介绍

|序号|胡牌类型|番型|倍数|番型释义|番型图例|
|---|---|---|---|---|---|
|1|基础番型|平胡|1倍|4副顺子/刻子\+1副对子||
|2|财神番型<br>|爆头|2倍|手上财神，摸任意牌都能自摸胡||
|3||财飘|4倍|打出1张财神下一圈爆头||
|4||双财飘|8倍|连续打出2张财神下一圈爆头||
|5||三财飘|16倍|连续打出3张财神下一圈爆头||
|6|杠开番型|杠上开花|2倍|杠牌后接着自摸||
|7||二连杠|4倍|连杠二次接着自摸||
|8||三连杠|8倍|连杠三次接着自摸||
|9||四连杠|16倍|连杠四次接着自摸||
|10|七对番型|七对|2倍|七对不同的牌带财神|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NmEyYzkzMzJjOTQ4MGRmNWQ0NWY4ZGExZTkwZTgyZThfNDIxZWZlNzMzMmQzZWM0ZjY0ZmUxYTU2NjUyNDE4MDhfSUQ6NzcwNjExOTU3MTQ1OTM5NDg1OV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
|11||豪华七对<br>|4倍|七对中有2对相同|<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=OWYzYWZlMTQwZWE4MWNhNDE3YTU2YTU4M2Y5ODFkMWVfODJlZjNmNDRmZGJmMzkzZDdhOTBjMzc3NzEwZTJjZThfSUQ6NzcwNjExOTU2ODI2NDAwNjY3Nl8xNzk0MjkwMDI4OjE3OTQzNzY0MjhfVjM)|
|12||双豪华七对|8倍|七对中有2组相同的2对|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YWUwMmFkYjIxNWY5MzZmNDM4MzUwN2VkY2IxMWVkYmFfMzg4ODNkYzYxMmI4MTkyZDI5ZmUxYzEwNjJlYjhkNGZfSUQ6NzcwNjExOTU2ODYxNjE0ODI0NV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
|13||三豪华七对|16倍|七对中有3组相同的2对|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YWEyZDJlMjI0ZTVjNTcxZDIzMjNkNzY5NWQzZmQ1NzJfYTNmYzRkZDI1ZmJkZDQ1OGI5ZmIxZWM0NmFjZGUyZmRfSUQ6NzcwNjExOTU3MTE1MzA5NTYxMF8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
|14||清七对|4倍|无财神的七对|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MDljYWJiYzRlMWFkMDUyYmNjM2JjY2Q5NjlkMDI5NjZfMDgzNGIwNjBhMTA0NzIwYjY4ZmI3OWVmMzMyNjBlMmRfSUQ6NzcwNjExOTU2ODM4OTY3MTk2N18xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
|15||豪华清七对|8倍|清七对中有2对相同|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=Mjk3YmUzZDdmZDA0YzYyZmM4MGEwNjgzNWU3NGI0OGVfYTQ0MTIyYTNhMGVlNTYxMDVkNzEwMjJiOTVlMzc0NjlfSUQ6NzcwNjExOTU3MjA5MjUzNzg0OF8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
|16||双豪华清七对|16倍|清七对中有2组相同的2对|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=OWZmNTQ0OWViM2MyOWI0ZDRiZmFjMTEwMTA2ZTgwNDdfMzg3ZDUzNTY4OTQyM2E0OWZkOWU0OWZlOGI5NDZkN2NfSUQ6NzcwNjExOTU3MDg1NTM0OTI2NV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
|17||三豪华清七对|32倍|清七对中有3组相同的2对|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MjA3ZmE3Y2RiNjA4NGJhZDViYzU2MTA5MzQ5MDI2MmFfYzYwYjc0MDA5ZDI3MzllNTQ4ZWRiZDc5NmIwODIzMGJfSUQ6NzcwNjExOTU3MTIzNjkxNjQ4NF8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
|18|组合番型<br>|杠爆<br>|4倍|杠开后爆头||
|19|||8倍|二连杠后爆头||
|20|||16倍|三连杠后爆头||
|21|||32倍|四连杠后爆头||
|22||杠飘<br>|8倍|杠开后财飘||
|23|||16倍|杠开后双财飘||
|24|||32倍|杠开后三财飘||
|25|||16倍|二连杠后财飘||
|26|||32倍|二连杠后双财飘||
|27|||64倍|二连杠后三财飘||
|28|||32倍|三连杠后财飘||
|29|||64倍|三连杠后双财飘||
|30|||128倍|三连杠后三财飘||
|31|||64倍|四连杠后财飘||
|32|||128倍|四连杠后双财飘||
|33|||256倍|四连杠后三财飘||
|34||飘杠|8\~256倍|财飘后杠开，倍率与杠飘对应||
|35||七客<br>|4倍|七对加爆头||
|36|||8倍|豪华七对加爆头||
|37|||16倍|双豪华七对加爆头||
|38|||32倍|三豪华七对加爆头||
|39|||8倍|七对加财飘||
|40|||16倍|豪华七对加财飘||
|41|||32倍|双豪华七对加财飘||
|42|||64倍|三豪华七对加财飘||
|43|||16倍|七对加双财飘||
|44|||32倍|豪华七对加双财飘||
|45|||64倍|双豪华七对加双财飘||
|46|||128倍|三豪华七对加双财飘||
|47|||32倍|七对加三财飘||
|48|||64倍|豪华七对加三财飘||
|49|||128倍|双豪华七对加三财飘||
|50|||256倍|三豪华七对加三财飘||

# 三\.对局流程

## 桌面布局

### 对局前

|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=OWQ2ZGM3YjQxMTkxZDJkY2U0MmI5MzRlY2JmZDE1YjhfZGY1OWZkMDQxY2U3MDI5MDQ0ZTZjNDQ3ZWYwMTZlNjlfSUQ6NzcwNjE0OTgyNTQ0ODIzNDAxNl8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|||
|---|---|---|
|编号|内容|显示说明|
|1|菜单|- 等待阶段在桌面左上角常驻菜单图标。具体查看按8\.1「菜单」。|
|2|玩法/房间号|- 等待阶段在左上显示「房间玩法」与当前房间号。<br>- 开局后，同一区域切换为「当前局数／总局数」，本期首局显示「1/8局」。|
|3|玩家信息<br>|- 头像<br>- 分数：局数模式下，默认0<br>- 昵称<br>- 状态<br>    - 空座显示「＋」占位。<br>    - 玩家入座后，在对应座位显示该玩家的信息。<br>- 标签：房主标签|
|4|准备信息|- 未准备时显示“未准备”；<br>- 准备后显示“已准备”；<br>- 房主默认准备；首次进入房间的其他玩家默认准备。<br>- 已入座的玩家显示准备状态，空座显示「＋」占位。<br>- 本期须坐满4人且4人均为「已准备」，此时仅房主显示并可点击「开始游戏」，其他玩家等待房主开局。<br>- 房主点击「开始游戏」后进入4\.1「对局开始」，等待阶段的准备标记和操作入口随开局过渡收起。|
|5|合规信息|- 健康游戏，禁止赌博|
|6|座位|- 房主创建房间后，其他玩家按加入顺序依次沿逆时针入座。<br>- 自己永远显示在下方。<br>- 等待阶段以各自客户端视角显示座位。右侧为下家，上方为对家，左侧为上家。开局保持4人的相对座次，按4\.1「对局开始」切换至四人桌面。|

### 局中信息

[查看主方案原文](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcnevnO0Yk4drT7V3qL9nDVuf)

#### 方位信息

|\[方位盘\.mp4\]||||
|---|---|---|---|
|**功能模块**|**模块类型**|**说明**|**状态图示**|
|方位信息|骰子|- 开局摇骰阶段，盘面中央显示两颗白色骰子。骰子翻滚后停稳，展示本次点数，各家看到同一结果。骰子停稳后可以和发牌画面并行展示。<br>- 骰子退场后中央先留空。发牌和理牌完成、首庄进入可出牌阶段时，中央切换为倒计时，首庄对应方向开始闪烁。|录屏约00:06\.33可见摇骰，00:07\.33可见骰子已停稳。约00:08\.57骰子退场，约00:09\.67–00:09\.70各家开始显示10。|
||无方位／未操作|- 房间准备阶段沿用准备界面。进入开局过场并显示方位盘底座后，未分配风位时只显示暗色底座，中央留空，四侧无风位字和高亮。<br>- 已分配风位、尚未进入可操作阶段时，四侧风位字保持灰暗。中央按当前阶段展示骰子或留空。|录屏约00:05\.33，开局过场前可见暗底座，中央和四侧未点亮。约00:09\.50，四侧已有风位字，中央仍为空。|
||有方位（东南西北）|- 本核心流程按四人好友房。房主建房后，玩家按加入顺序沿房主逆时针入座，开局保留四人的相对座位顺序。首庄为东，其余玩家从首庄起逆时针依次为南、西、北。<br>- 每个玩家界面都以自己为下、上家为左、对家为上、下家为右。将各玩家的实际风位写在对应边。本小局内风位字固定，轮到不同玩家时切换亮灯。换庄进入下一小局时风位重排，仍然以庄家为东，其余玩家从首庄起逆时针依次为南、西、北。|录屏约00:14\.00，庄家东在右下视角的底边，在左上、右上、左下视角分别落在左边、顶边、右边。<br>|
||操作指示|- 常规摸打轮次以当前实际可操作玩家为准。该玩家开始操作时，在方位盘对应边循环闪烁高亮。每个视角同一时刻最多高亮一边。底边红、左边绿、顶边蓝、右边黄。颜色按当前屏幕位置分配。<br>- 本家操作时，自己的方位盘亮底边红色。其他三家按本家在其画面中的座位方向亮对应边。其他家操作时，本家同样按对方所在方位亮左、上或右边。轮次交接后清除上一边的高亮，切到新的操作者对应边。|录屏约00:14\.00，同一庄家东，右下视角底边红，左上左边绿，右上顶边蓝，左下右边黄。<br>|
||弃牌响应|- 本家出现吃、碰、杠、胡等可响应按钮时，本家界面临时亮底边红色，并显示自己的响应倒计时。其他没有响应按钮的视角，等待裁决期间仍亮原出牌者对应边。多人同时收到按钮时，各自界面都可亮本家底边。<br>- 响应阶段的显示不参与动作优先级判定。裁决完成后，各视角按实际获得下一步操作权的玩家切换亮灯。吃碰成立后切到对应操作者，继续摸打时切到下一实际行牌玩家。|录屏约00:44\.60，左上南家可吃，自己的盘亮底边，其他三家仍亮东家。约02:24\.00，西家可吃、东家可胡，两人的各自界面都亮底边，南、北视角仍亮原出牌者南。|
||倒计时|- 中央用两位数字显示当前阶段剩余秒数，按秒递减，普通数字为蓝青色，03、02、01、00为黄色。阶段开始时按该阶段配置的时间起始秒数刷新<br>- 弃牌进入吃、碰、杠、胡的响应阶段时，所有视角的中央数字一起切到该响应阶段的倒计时，包括没有收到响应按钮的玩家。未获按钮的视角仍按「弃牌响应」显示原出牌者的高亮。<br>- 出牌倒计时归零后显示00，按4\.5无托管规则继续等待本家手动出牌。吃碰杠胡的响应裁决按对应模块执行。|录屏00:51\.17显示蓝青色04，约00:51\.67显示黄色03，随后到00。约00:44\.07–00:44\.17四个画面的数字先后切到10。<br>|
||小局结束|- 收到小局结束结果并进入结算时，各视角结束本次操作倒计时及方向高亮|录屏约02:29\.97进入小局结束演出，随后出现小结算。|

#### 玩法信息

|功能模块|模块类型|显示说明|状态图例|
|---|---|---|---|
|玩法信息|剩余张数<br>|- **显示位置。**余牌数显示在中央骰盘右侧。骰盘切换为行牌倒计时后，余牌数继续显示在右侧。<br>- **开局与发牌。**本期初始显示136。首批起手牌背出现时一次更新为83，发牌翻牌和理牌期间保持83。<br>- **行牌更新。**正常摸牌每张减1。开杠成功后，尾部补摸1张并跳过另1张，余牌数减2，例如30张更新为28张。出牌、吃、碰本身沿用当前张数。<br>- **流局保留。**显示的余牌数包含尾部保留的20张。剩22张时开杠补牌后显示20，末20张完整保留，流局时机按流局规则执行。|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YjgxNDljODJhYzg4OGFlY2FmNTZiOTgxYWMxODUyN2JfZTVkOTYzMGMyOGNlY2E4MTkxMDQyZWI2MDcwNzdiZmJfSUQ6NzcwNjQxNDc2MTkzMTgyMDAxN18xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MjI0ZDVmNDExZWRhOTYzZDE1OTc4MmM4MzQyZjllNDVfYzFjNTk3MzhmNjMyNzFmODBmNWY4MTkyMTJiNDQ3ZDVfSUQ6NzcwNjQxNDg2MDA1MzY3OTEzN18xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>|
||财神|- **本期白板财神。**每小局掷骰动画开始时，在中央骰盘左侧直接显示白板指示牌，样式沿用4\.3「定财神」。<br>- **持续展示。**发牌、理牌和行牌期间，白板指示牌保持在左侧原位，直到本小局结束。该指示牌仅作界面展示，四张白板均按财神规则使用。|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YTlhZmU4MTA0NzEzYjA0NjlmYjA4ZmM1YWQ4ZjY4OTJfYjUyMTcyMDQ1MzkwN2JkYjJiNWM2ODIyZTQ1OWEwZjJfSUQ6NzcwNjQxNDgxODAwOTk1OTM1NF8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=OTRmZmNiZWI4Yjg2YmNkNmUxYjQ5NTgyYmRiZjU5MDFfYjQ3N2E4NTI0NjE4N2M4NWI1YWIwNzVhNDEyZmUyZWFfSUQ6NzcwNjQxNDcxNDYwNzk3OTgxOV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>|

#### 玩家头像信息

[查看主方案原文](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcn7d9BMe7pDErB6sDWioLLpg)

|编号|内容|显示说明|状态图例|
|---|---|---|---|
|1|玩家头像|第三方或随机生成头像展示|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NGJlZTk0ZTY0OGI4OTQxZGZiYTM2NjcxMjA2MmQzZGJfOTlmYzYxNmNkMzJkMTI4NzViZTVmNDM0MWUzYjc5NzVfSUQ6NzcwNjE1NTUzODkwMzYwMDM4Nl8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
|2|庄家标签|- 庄家图标显示在头像右上方<br>- 根据规则庄有3种样式<br>    - 平庄：显示【庄】<br>    - 庄二：显示【庄×2】<br>    - 庄三：显示【庄×3】<br>|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ODFlMWZhNmJmZmQ1N2M2NjJmNzZkNzc3ZTJlNzg4MGJfZDM4YmM1NzI0MjVmY2FiMWVhYTQ4ZDdjNzA3YWZlNjNfSUQ6NzcwNjQxNTYwNzk2MTE0NDU4M18xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=OGYzNDVhOTBkY2QyYjAwOWJlODM1MTk5ZDNiNTQwNThfYjlmZDc0ZTcwMDI4OWM5ZWRhZjY0ZDMzMDgwNGVmZmFfSUQ6NzcwNjQxNTY1MDk2NDc4NjQzOV8xNzk0MjkwMDI4OjE3OTQzNzY0MjhfVjM)<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MjRlMDFiZWVlZGI0NDNjZWQ4Njk0MGM3YzEwMGVlMzRfZDc2YzY5ZTM5YTM5M2RmNDcxMjA2ZWZiMzdkNzFkYjdfSUQ6NzcwNjQxNTY5NjAyNDcxODYwNV8xNzk0MjkwMDI4OjE3OTQzNzY0MjhfVjM)|
|||||
|3|房主标记|房主头像上需显示房主标记|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MmJiZDQ0OTU4N2ZhYTVkZWM3NmM3Yjk2YjVkNTM3MWVfNmVlYjQ4ZTEzNzc5MTEwMTQ0NTNlZTE1Y2Q4MzE3ZDZfSUQ6NzcwNjE1NTUzNzI4MDY4MzIzNV8xNzk0MjkwMDI4OjE3OTQzNzY0MjhfVjM)|
|4|当前积分|显示规则：5位数以个为显示单位，6位数以万为显示单位<br>根据玩法规则展示当前积分，可为负数|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MDZiNDE0Njk2ZGYyOWU0Y2JiMDIxZmRmYzM3MDExYTJfOTg2OTFjYThhMDdkMDY1ZDNiNzU3ZTRiODM1NzhkNjBfSUQ6NzcwNjE1NTUzOTE3NjIyOTkxNF8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
|5|玩家昵称|游戏中常显，最多显示10个字符（中文占2字符，英文/符号/数字占1字符），超出第78个字符显示“\.\.”|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=OTIwMWZhZGFlODc5OGY3YjFmODQzMzY0Mjk1NDNjYTZfNzk4Nzk2OTAwNmVkYjAyNGE2MzNmMmM5MjM4ZGNmMTJfSUQ6NzcwNjE1NTUzODE4NjUyMTYyMF8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
|6|玩家状态|操作状态：头像处流光动效|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YTdkMTdjNTdkZDFmOGU1MmJkNDViNDI0MmZhMmE4NjZfN2MyZDY3MjRkYzg1YzBhZmE2MDIyNDQ3ODNkNGZjZDlfSUQ6NzcwNjE1NTUzNjk5NzI1NjIyNV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
|||离线状态：头像处覆盖断线图标，且显示断线计时，格式为分秒“00:00”，每次断线重新计时<br>备注：在当前动画播放过程中有玩家离线切后台等，不会因此中断原本的动画流程|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=OGQ2NjYyNjc5Yjk5MWMxNzgwYzk1ZWYxN2U2ZThmZDFfYmZiOWMyMzQ2ZTNjZWUxOGJiNjkwNjRkYzA5OWM3MDdfSUQ6NzcwNjE1NTUzNjQ5NjQ3OTUzMV8xNzk0MjkwMDI4OjE3OTQzNzY0MjhfVjM)|
|||托管状态：头像处覆盖托管图标（自动摸打的托管不需要显示）（本核心流程按无托管处理，头像不显示托管图标。）|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MTFhNzFlYmYxYjE2OWI3ZGNiZWJkZDkwYmJjNWFjN2VfODk3NTFiMDA1Yzk2NTgzMjQ5MWIzNTFlNzY0MjZkOGFfSUQ6NzcwNjE1NTUzODk5NTk0MDYxMF8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|

#### 牌河信息

|功能模块|模块类型|显示说明|状态图例|
|---|---|---|---|
|牌河|牌河摆放|- 牌河根据玩家出牌顺序从左至右依次摆放，不同人数布局不同（美术可根据摆放效果调整每排数量，具体看效果）：<br>- 4人：每排放置7\-8张，共放置2排，超过时从第一排第一张上开始叠加，摆放效果如右图2，四个玩家牌最好紧贴方位指示器。<br>- 3人：自己居中每排放置12\-13张，左右两个玩家每排7张。共放置2排，超过时从第一排第一张上开始叠加，效果如右图3。<br>- 2人：自己和对家都居中每排放置13\-14张，共放置2排，超过时从第一排第一张上开始叠加，效果如右图4。|<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YmJhY2QwYTU1ZTM0NjVjMzNmMWY1ZWZhODU5ZWVjNDNfYjU5ZTM1NWNmNDY3NWEyMjYwZDlkODBhY2NlYzljZTFfSUQ6NzcwNjExOTYxNTgzMDg3MTMzNF8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MDUxZTRkMmZmYmE2YWZhODM5NDIxYzEzZjYzZDY0N2ZfZDIzMTMwMDlkNmU2YWRjYjNiZWY2ZDMxMWJiYmQ5MTBfSUQ6NzcwNjExOTYxNDY0Mzk5Nzk0NV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MzJlNzcxYTA5MDAzMzEzNzY3OTk4MmRkZTVlYmU3YWFfNmE0NzVjNGMxM2U5NmEwM2JkYWMzYTFhMzg4YmZhZDNfSUQ6NzcwNjExOTYxNDY0ODM4ODYyOF8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MmZkNTk0NzdlYmQ4NmQ2OTcwMGU0YzA5MWExMTYxZTJfZDc2NDYxYjc2MzVjZTcwMDNkZTdkNzA5YTNhZjhhN2VfSUQ6NzcwNjExOTYxNjUxMDQ0Njg0Ml8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>|
||打出牌|- 打出牌若被其他玩家碰、杠、胡，则不在牌堆中展示。|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MGI3NWMxNmM2NGFlZDFmNDY4YzRiMjZkNGIxNzY4YzZfZjM0MmRlMTBhMGJlNjg5MzYwMjE4YmViYmRmMDJjMWNfSUQ6NzcwNjExOTYxNjUxODczNzE2N18xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
||同牌面提醒|- 新摸到的牌或提起单张牌，若出牌河和碰牌区域存在同样的牌，则高亮显示。|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZjJkNGU0NjBiOTc2NjFlNDJkYThlMWRkZmZmZGQ3Y2JfMzFkMTdlMWNjMGNiZmM2ZDE4MzhlMWM5NDhhYTU1NjNfSUQ6NzcwNjExOTYxNjUxODcyMDc4M18xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YTAwN2VmZDJkYjZmYmM4MGMxNjA3MmJiYTBkMWEzODBfM2E1ODI4NjI0ZmFjNWViYTI4ZDNkMDUzMzNlMjhjNDhfSUQ6NzcwNjExOTYxNDEwMzM1ODQ2Nl8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
||最近打出牌|- 最近打出的牌有菱形光柱漂浮动画。|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=N2JkYWI2MDY0NmUxYTA4MzIxZjY1NTViNDYwYTE5ZmRfZTU4MWNiYTZiNDFjZWNiODgxZDdiNzkyOWY2MmIzNTJfSUQ6NzcwNjExOTYxNDY0ODQzNzc4MF8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|

#### 手牌信息

|内容|显示说明|样式图例|
|---|---|---|
|麻将子|所有麻将子都需要重新设计，底色不要太白，做成玉质的，右图仅供参考大致色值，但需要更有质|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=OWUwM2M3ZGJkZDU0MmU2NDM5MjMyMGEwNGQ1NzAwN2JfZDE1Njk2ZTU5NjFjNDg4NGY1MTg5NDA5MmY3MjA2NzdfSUQ6NzcwNjExOTYxNDMzMzczNDE0Ml8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
|庄家手牌|14张牌，从左至右，花色依次为万\-条\-筒\~风；从左至右大小为1\~9，最后一张牌至于手牌最右侧，且与手牌保持距离<br>风牌从左到右是东南西北中发白|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=OWMyYzA3MzhjNzYzNjZhZjY2MWRiYzBlYTlhNGYwZWJfOWFlNmRjZDFlNGM2ZWYyN2ZkYTBjOTFiMzRmOGMxYmZfSUQ6NzcwNjExOTYxNjQxMzk2MTIzMV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
||其他玩家手牌按13张摆放|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=Mjk3YWY2NDM2YzYzZTUxOTczZDM3ZDdkZmZjZjczODdfYTIzMTFiYzVkYTI4Mzk2MDNmMzFjNjE5N2E3MGY4YjJfSUQ6NzcwNjExOTYxNjcyODM3MDQyNl8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
|闲家手牌|14张牌，从左至右，花色依次为万\-条\-筒\~风；从左至右大小为1\~9，最后一张牌至于手牌最右侧，且与手牌保持距离<br>风牌从左到右是东南西北中发白|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MGUwZDIxMTE2ODA5MmEzMTJhZWNiODRkMzhiY2NkNWZfYWRmOGIyYzQxNTRkYWY0MGI3ZDYxNmUxYTE2OWJhMWFfSUQ6NzcwNjExOTYxNDYxNDkzMjc3MV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
||庄家手牌按14张样式摆放，最后一张牌至于手牌最右侧，且与手牌保持距离。|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NzEzNmEwYmM3NzA5ZDZlOGFlZDliNjE1ZDIyNGIwMGRfMmNkZTRhNzdmMjQ0NTJjNzNjOTgxMWM2N2QwOTE0MGVfSUQ6NzcwNjExOTYxNjY3ODE1MzIzOV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
||||
|听牌标签|向听数为1时，打出可听牌上方展示听牌提示标签：【箭头】、【多】、【优】、【大】。若有多张满足（牌点不同）则将其中一个箭头按照优＞大＞多＞箭头的判定条件顺序显示成对应的图标，且“优”、“大”、“多”只显示一种。<br>杭州麻将特有：<br>打出去后能够爆头的牌：爆<br>打出去后能够财飘的牌：飘<br>注：当听牌提示满足”爆“/”飘“中任意条件是，隐藏”多“/”优“/”大“|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NTg2OWMyYmIyNzkzYTk3YWFjZmEwNDFmZjI3NzFjMmNfMzgwNmZkNGE4NDRjODk5ZTU3YmM4NWMxZjg1YzJiYTdfSUQ6NzcwNjExOTYxNzk1Mjk0MzM2Ml8xNzk0MjkwMDI4OjE3OTQzNzY0MjhfVjM)|
|杭麻特殊听牌标签|当玩家处于胡任何牌张的情况下（爆头，财飘），此时听牌提示不会显示具体的牌，而是直接显示一张“胡”的麻将牌，tips写：“摸任意一张牌可胡”|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=OTg1ZWZlMDA2YWNmODczNjg4ODRjYWI2Yjc0ZmVlMGZfNDI3ODJhMTlhM2ZkODkzNzJjZjNkMzVlNjhkZjZlZDdfSUQ6NzcwNjExOTYxNDYxNDkzMjUwN18xNzk0MjkwMDI4OjE3OTQzNzY0MjhfVjM)|

- 交互说明

|操作|交互|说明|动画拆解|
|---|---|---|---|
|每个打牌回合结束（出牌后）重新理牌，将刚摸进且未打出的牌插入至手牌中。|插入式：打出牌后，若有牌需要插入原手牌第1张至倒数第2张位置，进行插入动画。<br>|手牌长度不变的情况下，打出去的牌位置空出后，要插入的牌变斜提起，同时手牌中的牌自动往打出去的牌的空位对齐移动并且空出要插入的位置，变斜的牌在提起后平移到要插入的位置上方，随后变竖落下。<br>|<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=Nzg1OTkyMTdhYjA5OWQ1N2M4OWNiMTlkNmQzZmQ2NjFfYjIyNzliZTNjN2FhYjBlZGU1Yzk4NDcyNTRlNzYzOGNfSUQ6NzcwNjExOTYxNjY1NzE4MTkzNF8xNzk0MjkwMDI4OjE3OTQzNzY0MjhfVjM)<br>东风打出五条变斜提起，由于要插入的是4条和6条之间，因此在保证手牌长度不变的情况下，6条及右侧的一堆牌往右靠空出5条的位置）|
||||![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YTVlZGRjZGU2Mzk1ZmRiYzc2MThjYWFhYjllMzA5MzBfYWQxMDg0ZTdjNzEzMjVkMzgxZDgyNWU1NDM0YjNjYzJfSUQ6NzcwNjExOTYxNTA5NzMxMDIzM18xNzk0MjkwMDI4OjE3OTQzNzY0MjhfVjM)<br>五条变斜完全提起，6699条继续往右靠填补东风的空缺。|
||||![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YzUyNWY2NzkyNTU2NTQ0YmRmODhkMDZmZDExZWU0NDJfYThjZjk2NDJjMGI5NDBiMmE3N2RmNmJmYjliZTYyOGVfSUQ6NzcwNjExOTYxNDQ0NzM0MDU3NV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>五条斜着提起后水平移动到空出的位置。|
||||![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=Y2VlNjI4NTU4YTE3YThlZGMxNTEwN2JmOGU2YzY2MDhfMGYyMjA5MzRjODFhNmVjNTZiYTg2MjIxOGE4NTQzNGNfSUQ6NzcwNjExOTYxNTA4MDY0Nzk3OV8xNzk0MjkwMDI4OjE3OTQzNzY0MjhfVjM)<br>一边变竖一边落下，并完成理牌。|
|||插入的牌已有多张，则随机插入位置。|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ODg3MzI3OWE3MTUzZjA4MWNkYTY3ZjZhMmE4NDNhZDlfMGFjZjYwNWRkZTBlNDk4ZmNkNWU4ZWVjYThhYWRlOTRfSUQ6NzcwNjExOTYxNjg4MzQ5Mzg5NF8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
|||插入的牌仅有一张时，则根据牌的排序顺序插入。|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YzZiN2RhMTcxNThmOTY4NGMwNDNlMDk2NTc0Njk4N2ZfYzcwYjU4MTJmNzcyMTRlODA5ZTc2YTZlNDIwYmYyMTRfSUQ6NzcwNjExOTYxNzgxNDU4MDIzNV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
||平移式：打出牌非最右侧隔开的牌，且其他牌无需改变排序的情况下，进行平移动画。|打出去牌的空位由右侧的牌往左边平移，最右侧隔开的牌也以同样的速度往左靠，最终排靠在一起。|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NzhiMWNmMjkwYzAxYWJkNjRlNGJmODBjNDIyOTFiMDBfNTJhMGU3ZjQzZWUzMTI2NWRhMTM2ZWNiNjlmZWM4ZjRfSUQ6NzcwNjExOTYxNDE0NTQ4MTcyOV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
||||![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZGMzNDk3NmY1OTFhZWFhMTQ2OTIyMjllZTc2YjUxNDBfODI2ZWNhNjY2ZThlZThiNTljZjBlYmQ2ODBlOWUwZGRfSUQ6NzcwNjExOTYxNjAwMzA5OTg1Ml8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
||||![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YzU4Yjc1OTMyZDY0MmI2Nzc2M2NiMTZlNmVhNDZkNjhfY2U4MzgyNzBhZjZhYWZhZWI4M2U3ZmJmMjAzM2RiMGJfSUQ6NzcwNjExOTYxNDE1Mzc4ODQyN18xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
||||![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MGMzN2E3ZmYyYjVlZTdmMWQ1YTJkNTc3ZWVmMjEzODdfYzU5NmFiOGY2NjEwN2ZhYTIyNDMzMmViNDEwNDNjYTVfSUQ6NzcwNjExOTYxNTk3ODgzNDkyOV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
|听牌标签显示规则|听牌标签|- 向听数为1时（打出成听），打出可听牌上方展示听牌提示标签：【箭头】、【多】、【优】、【大】。<br>- 若同一个牌点同时满足，则按照优＞大＞多＞箭头的优先级显示成对应的图标<br>    - 举例：打5筒同时满足大和优，则仅显示优<br>- 听牌标签会根据可胡牌的张数和倍数实时变化，张数最少按0张，倍数最少按1倍。<br>    - 举例：如右图原本1条胡2倍，其他牌都胡1倍，原本1条应该显示“大”标记，但由于牌都被打完了，因此1条仅显示箭头（按1倍算）|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NGVhMGQ1MWNlMmZhNGNjNzY3ODgyOThjODQxNTE5MjJfOWI0MDNjMGJjNzhhNWIyMjBjMWIyMGI4MTRmMTM0MzZfSUQ6NzcwNjExOTYxNjMyNTkxMzg2Ml8xNzk0MjkwMDI4OjE3OTQzNzY0MjhfVjM)<br><br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=OWViMDlkMWVlNjU3ZTdkZTBmNzAwMmYxYmFmZTk0NTdfZTljZTVkNDc3ZDhmNTU2NTE1NmZhZmVjODUwNTg3NzNfSUQ6NzcwNjExOTYxNDMxNzQ0ODQ0M18xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
||箭头|- 打出成听只有1张时仅显示箭头，若有多个牌点，且张数、倍数都相同则都显示箭头。<br>    - 举例：打1筒满足1个2倍3张；打2筒满足1个2倍3张，则都显示箭头|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=OWNlNzE5MDc5ZGJlMDAwYzlhZjAxZWI0OGRhZTU5ZGVfMTVhNjZiZjZjYzZjMGRkNThmNzdkNWQ2NDYwMzUzMDRfSUQ6NzcwNjExOTYxNzM2NTk1MzgwMF8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
||多|- 多张牌点满足打出成听，胡牌张数最多的牌点，且至少比最少的多2张及以上，则胡牌张数最多的牌点显示“多”，若有多张牌点同时满足，则都显示“多”。同一个牌点有多张，则最右侧的牌显示“多”。<br>- 举例：<br>    - 打1筒可胡3张；<br>    - 打2筒可胡5张；<br>    - 打3筒可胡6张；<br>    - 则仅3筒显示“多”|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZjFmNTMxODIyYTRhNGZiMDc4NWU2NDVlOTIzZjRkM2VfNjVlYTBhMjBlZmFhMGNiNWMzZjA1YjA5ZmJiNDA0MWRfSUQ6NzcwNjExOTYxNjYyNzc1NjMyMV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
||大|- 多张牌点满足打出成听，胡牌倍数最大的牌点（可胡多张只要有一张满足即可），需显示“大”，若有多张牌点同时满足，则都显示“大”。同一个牌点有多张，则最右侧的牌显示“大”。<br>- 举例：<br>    - 打1万胡4倍1张；<br>    - 打2万胡2倍2张；<br>    - 打3万胡4倍1张；<br>    - 则1万和3万显示“大”|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NzMwNTM0ZDUwNDZiNzMxMDc3N2FhODc5NDJmZjczNTZfYTllYThjMDVmZWRjMzA5N2JhZDQ2NTQxZjJjY2EwZDdfSUQ6NzcwNjExOTYxNDkxNjc5MTU2MF8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
||优|- 多张牌点满足打出成听，且有多张满足“大”的条件，则符合“大”又符合“多”标记的牌将显示“优”<br>- 举例：<br>    - 打1条胡4倍3张、4倍4张、2倍3张<br>    - 打2条胡2倍1张<br>    - 打3条胡2倍3张<br>    - 打4条胡2倍3张、2倍4张<br>    - 打5条胡4倍2张<br>    - 打6条胡2倍3张<br>    - 打2筒胡4倍1张、2倍1张<br>    - 打3筒胡2倍3张、2倍3张<br>    - 打4筒胡2倍1张、2倍0张<br>    - 打5筒胡4倍1张、2倍1张<br>    - 打6筒胡2倍3张、2倍3张<br>    - 则1条显示“优”（倍数最高4倍，张数最多10张）|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NjZjMDI2MWY5NzNmOTI2ZmVmMmVmNTk2YTUzNGIxZGRfNDA5MGUzMGY0NzcxODE5NGRkNDkzYjkwY2Y5YmY3ZTFfSUQ6NzcwNjExOTYxNDE1MzgwNDgxMV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
||混合举例|- 如右上图：<br>    - 打4条胡2倍4张；<br>    - 打8条胡4倍2张；<br>    - 打1条胡4倍4张；<br>    - 则4条显示多（因为4张＞2张）；8条显示大（因为4倍最大）；1条显示优（因为倍数最大且张数最多）<br><br>- 如右下图：<br>    - 打1条胡4倍1张；<br>    - 打4条胡2倍1张；<br>    - 打6条胡2倍2张、2倍3张；<br>    - 打2筒胡4倍2张；<br>    - 打5筒胡4倍2张 ；<br>    - 则1条显示大（因为4倍最大）；4条显示箭头；6条显示多（因为胡5张最多）；最右侧2筒显示大，其他2筒显示箭头（因为4倍最大，且2筒有多张）；最右侧5筒显示大，其他5筒显示箭头（因为4倍最大，且5筒有多张）|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NjhhNTU2ZGU1OGU0NjE1MjRkYTg3MmU3ZDc0OWUyZDlfZjhhOGZmMmViNGIwNWM2ZTIxMzhlNGEzZTQ0ZDJmYTVfSUQ6NzcwNjExOTYxNDkwMDQ1NjQ1N18xNzk0MjkwMDI4OjE3OTQzNzY0MjhfVjM)<br><br><br><br><br><br><br><br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NDUwOGMxYTQxYjI3MTkxNmVkNzljMjMwNmM0OWRhZjhfZWYzNjgzZjg4OWRiYjU5ODc2MmE5MzczNGU0MDk4ZTRfSUQ6NzcwNjExOTYxNDMxNzM5OTI5MV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|

## 局内流程

### 对局开始

[查看主方案原文](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcnk239IiTScFQjHPjM8v7Y2f)

|时序取下方四开录屏的左上客户端。常驻玩家信息首次隐藏为 T=0（录屏约 5\.13 秒）。<br>\[对局开始\.mp4\]|||
|---|---|---|
|功能模块|模块类型|显示|
|对局开始|触发逻辑|- 仅在开房后的首次开局播放「对局开始」动画。<br>    - 首次开局时，先等待云检测流程结束后再播放。云检测流程可查看后续对应模块。<br>- 常驻玩家信息区开始隐藏记为 T=0。以下时点均相对 T=0 计算。同一场内，后续小局直接进入摇骰发牌。|
||显示|- 按开局时的实际参战人数显示2、3或4个玩家信息区。每个信息区绑定对应座位的玩家，显示头像、昵称和显示分。<br>    - 头像按3\.3\.3「玩家头像信息」显示。昵称按3\.3\.3「玩家头像信息」显示。<br>    - 每场首局开局时，固定局数模式显示0分。片数模式显示创房所选初始片数，例如选40片时，各玩家均显示40。后续小局显示上一小局结算后的累计分或剩余片数。<br>- 房主创建房间后，其他玩家按加入顺序依次沿逆时针入座。开局时保留实际参战玩家的相对座次，再按实际参战人数选择桌面布局。以下座位均从本机玩家视角描述。<br>    - 开局前按入房时的座位显示。以房主A和依次加入的B、C为例，房主A视角下，A在下方本家位，B在右侧下家位，C在上方对家位，左侧为空。<br>        - 实际3人开局后，保留A→B→C→A的逆时针座次，改用三人桌面布局。各客户端均以自己为本家，右侧为下家，左侧为上家，上方无对家。A看B在右、C在左。B看C在右、A在左。C看A在右、B在左。<br>    - 2人局中，本家在下，对家在上。<br>    - 3人局中，本家在下，上家在左，下家在右。<br>    - 4人局中，本家在下，上家在左，下家在右，对家在上。<br>    - 常驻信息区和动画介绍卡绑定同一名玩家。常驻信息区按局内桌面布局定位，介绍卡按「动画展示及流程」中的布局定位。<br>- 中央方位的显示时机见3\.3\.1「方位信息」。首局庄家为东。2人局只显示东、南，庄家的对家为南。3人局由庄家起沿逆时针依次为东、南、西，4人局依次为东、南、西、北。|
||动画展示及流程<br>|- 以单个客户端的游戏可视区为画布。左上为原点，横纵坐标按画面宽、高的百分比计算。桌面、骰盅和骰子在底层。色块、介绍卡、光圈和光粒位于动画层，中央字样与其光带位于动画层上方。<br>- 上方为青蓝色块，左右为蓝色块，下方为金黄色块。2人、3人和4人局均保留四色块。介绍卡按实际参战座位方向显示。2人局显示本家下方、对家上方两张卡。3人局显示本家下方、上家左侧、下家右侧三张卡。4人局四个方向各显示一张。空位方向只展示色块。<br>- 建议视觉参数。以对应屏幕边的两个端点与画面中心组成每块的斜边区域，四块半透明叠在桌面上。上、下、左、右介绍卡的中心锚点依次为（50%，15%）、（50%，85%）、（17%，50%）、（83%，50%）。介绍卡宽约画面宽的5%，头像、显示分、昵称从上到下居中排布。<br>- 中央字样横排居中，宽约画面宽的20%，用金白色粗斜字配橙金外发光。字样背后铺半透明金色横向光带，光带宽约字样宽的1\.5倍。介绍卡和常驻信息分别使用各自布局，本家介绍卡在下方中央，局内常驻头像在左下方。<br>- T=0～约130 ms。先隐藏实际参战玩家的常驻信息区，桌面底图保持显示。约35 ms 时，四色块分别从各自的屏幕外侧向中央滑入，斜边逐渐形成交界。约65 ms 时，中央「对局开始」开始从透明淡入。<br>- T\+约130～570 ms。介绍卡沿对应座位方向从画面外进入，滑到各自锚点后停留。字样显亮时，中心闪出蓝白亮光，左右出现细横向扫光。青白色圆环以字样为中心向外扩张，点状和短线状光粒在周围闪现。约230 ms 起，扫光、光粒和光圈逐步变淡，字样和金色光带继续显示。<br>- T\+约570～700 ms。介绍卡逐渐淡出，四色块分别向各自入场的边缘退回，直至离开画面。约630 ms 时，光圈只剩淡轮廓。约670 ms 时，骰子在桌面层的骰盅内开始滚动。约700 ms 时，常驻信息区按局内布局恢复显示。<br>- T\+约700～865 ms。中央字样与金色光带一起淡出，与摇骰短暂重叠。约865 ms 时，字样和光带完全消失，开局动画结束。桌面、常驻信息区及正在播放的摇骰继续显示。|

### 定庄

[查看主方案原文](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcnzmrXQL0G9zX9aVxBFx4Mje)

|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ODY4YjdkN2ZjNjc5ZTczOTY2OTZhMTBhMmI2MTM5OGFfNzkwYjI1ZDVhYWYzZDdiNDg5NGVjNTdmMjNiZTBiODZfSUQ6NzcwNjExOTY4Njk3ODc2NzkwNV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NGMyMjE3NmI0YjJiOWU0ZWIwYmQyODg1MjFkNjQ4MjVfMGQ5NzdlNWIxYjMwYWYwNThhNDg3YjMyMWMzMjBjZTlfSUQ6NzcwNjExOTY4NjI0MDcxODEyOF8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MWJkYTNkZTczNDc5YTRjNGI2MTI1OWIxYTc4ZmM0NjlfZTBhZDRhNTAzNDE3NzRiZmIwZWZlODFkMDQwMjA3MmFfSUQ6NzcwNjExOTY4NTg5MjY0MDAzM18xNzk0MjkwMDI4OjE3OTQzNzY0MjhfVjM)<br><br>\[对局开始\.mp4\]||||
|---|---|---|---|
|功能模块|模块类型|规则|说明|
|定庄|开局定庄|- 随机庄|- 首小局从本场实际参战玩家中随机确定庄家。选择条件见 2\.3\.2\.3「定庄」。|
||后续轮庄|- 赢家庄|- 同一场内，自第 2 小局起按上一小局结果轮庄。上一局胡牌者接任庄家。上一局流局时，原庄家连庄。<br>- 本小局庄家的起始牢数和连庄变化，按创房选项及 2\.3\.2\.6 至 2\.3\.2\.8 判定。|
||UI及动画|- **触发前提。**掷骰前已确定本小局的庄家和牢数，客户端按该结果展示庄标。<br>- **显示时机。**每个小局在开局掷骰动画开始的同时展示庄标。<br>- **显示对象**。在本小局庄家的常驻头像旁显示庄标。各客户端按自己的座位视角定位同一名庄家。<br>|- **与 4\.1 的衔接。**首次开局从 4\.1 开局动画过渡到掷骰时，掷骰动画开始的同一帧，在庄家的常驻头像旁直接显示庄标。<br>- **动画表现。**庄标直接以最终位置和大小显示。掷骰过程中，庄标随常驻头像持续显示，可与中央「对局开始」字样的淡出短暂重叠。<br>- **位置与外观**。使用参考图里的蓝底庄标，白色「庄」字配较小的「×N」，贴在常驻头像上沿一侧。以录屏左上客户端为例，庄家位于画面右侧，庄标贴在头像左上侧。庄家在画面左侧时，庄标贴在头像右上侧。2、3、4 人局均按实际参战玩家的头像位置挂标。<br>- **三档样式**。平庄（一牢）显示「庄×1」，庄二（二牢）显示「庄×2」，庄三（三牢）显示「庄×3」。角标数字表示当前牢数，结算倍率见 2\.3\.2\.6 至 2\.3\.2\.8。<br>- **持续与刷新。**庄标在掷骰、定财神、发牌及行牌时持续显示。下一小局也在掷骰动画开始时按本局庄家和牢数刷新。换庄时庄标切换至新庄家头像，连庄时在同一头像旁更新样式。<br>- **录屏对照。**约 5\.90 秒已可看到庄标与正在淡出的「对局开始」字样同时显示。约 7\.90 秒发牌时，庄标仍在原位。|

### 定财神

[查看主方案原文](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcnagAyAaEre7uGXYs5erL1kb)

|\[对局开始\.mp4\]||||
|---|---|---|---|
|功能模块|模块类型|配置项|显示|
|定财神|显示<br>|白板财神|- **出现时机**。掷骰动画开始时，在桌面中央骰盘左侧直接显示白板指示牌。以《对局开始》录屏的左上客户端为准，约 5\.82 秒已看到白板，骰子还在转动。<br>- **位置与外观**。指示牌为竖向小牌，粉色牌面，正面显示白板边框。直接以最终尺寸和位置显示。此配置沿用常规掷骰、发牌画面。<br>- **持续显示**。发牌时保持指示牌的位置和牌面。骰盘切换至行牌倒计时后，白板指示牌仍在左侧，直到本小局结束。|

### 发牌

[查看主方案原文](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcnWswqiM61cpdSfl9O90eyXb)

|\[对局开始\.mp4\]|||
|---|---|---|
|发牌逻辑|||
|- **四人牌组。**本期使用136张牌。以庄家为起点，按逆时针依次从牌序头部给每人同时发4张，重复3轮，每人先得12张。<br>- **补齐13张。**再从庄家起按同一顺序给每人发1张，四家各有13张。<br>- **庄家额外一张。**最后从同一牌序给庄家再发1张。发完庄家14张，三名闲家各13张，共发53张，牌墙余83张。<br>- **首个操作。**庄家直接进入首个操作阶段，首轮出牌前无需再摸1张。|||
|发牌UI以及动画表现|||
|详细说明|动画表现|音效|
|- **开局衔接。**4\.2已定庄，4\.3白板指示牌已显示。掷骰展示后开始发牌，庄标和白板指示牌持续显示。<br>- **发牌批次。**四家先按4＋4＋4＋1的节奏分批展示，庄家最后单独展示额外1张。<br>- **余牌数。**发牌前显示136。首批牌背入场时刷新为83，各批翻开及理牌期间保持83。<br>- **切入行牌。**理牌完成后，骰盘区域切换为庄家出牌倒计时。庄家收到优先出牌提示，闲家收到等待提示，首个操作阶段按4\.5、4\.6处理。|- **约7\.5秒｜首批入场。**以上方《对局开始》四视角录屏为准。自己的前4张牌先以背面出现在手牌区左侧，四个客户端按同一批次播放。<br>- **约7\.7–8\.1秒｜分批翻开。**自己的牌按乱序发牌的先后，从左到右分批进入手牌区，倒下理牌前保持发入顺序。前一批翻开时，后一批可先以背面入场。其他玩家的手牌分批出现后保持背面。<br>- **约8\.3–8\.6秒｜补齐起手牌。**四家补齐第13张。倒下前，庄家按乱序发入的先后展示13＋1，最右侧独立位也先显示乱序发牌中的牌。如录屏中此时显示「发」。<br>- **约8\.8–9\.4秒｜倒下立起与理牌。**发完牌后，仅本家手牌在自己的客户端播放倒下、理牌、立起。其他三家的手牌保持立起的牌背状态。本家立起时，13张主体手牌从左到右依次排列为万、条、筒、东、南、西、北、中、发、白。若本家是庄家，最右侧独立位在立起时刷新为服务端单独下发的第14张。录屏中该位置由「发」变为「南」。<br>- **首打提示。**理牌完成后，骰盘区域显示庄家出牌倒计时。庄家可开始操作，闲家等待。|- **待确认。**发牌与理牌的音效资源及触发时点本方案不添加。<br>|

### 行牌操作

[查看主方案原文](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcnUg9VgfnLJIeq11H8xHhQ3b)

|内容|显示说明|交互说明|样式图例|
|---|---|---|---|
|摸牌|牌墙中顺时针发牌，每次发1张，与一般手牌间隔4分之1牌距离。|从手牌最右侧从上往下缓冲落下，1帧效果。| <br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NjMyM2E3MDk3M2Q4Mjc0ZmE5YTA4MTFiODI2MjdmNjFfMWMwN2NmNzFkMDU3NDdkMGI1ZDU3MjJjNzY4ZDcwZTlfSUQ6NzcwNjExODI2NzM0OTc0OTAxN18xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NGUxNzc2OTQwOGQ5NDgwNzc1N2I5NzE3YTNhZjMwMGVfNWJmN2FhZmE4OTAzOWU4ZjgwYTY0NmZmMWQzODE1OWZfSUQ6NzcwNjExODI2NjI5NzA5MzM5Ml8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
||摸牌需在上一家打出牌的同时摸牌（抖小是上一家的牌打到桌面后才开始摸牌）|肉眼可见上家打出牌的瞬间下家摸牌，如右图1|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=Yjc1NDNhM2E1OWY2ZTJmMzU2MDM5MDQwM2NlOGIyMTVfNjQ4NThkZTgwOTJiMDY4MzE5MmU1MTVjYmM2NTc5MjlfSUQ6NzcwNjExODI2Nzg3Mzg0MDM5Ml8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MGQzZjYxNDM5YjA4Y2ExMTA4YWIwOGE4MmZkZDNlN2RfY2QxYmI3NDBiYmEwNTkzZjNhOTY1NTUyNDE4Njg1MjdfSUQ6NzcwNjExODI2NjQyMjk3MTM4NV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
|补牌|根据配置从牌墙正序或逆序抓牌，与一般手牌间隔4分之1牌距离|从手牌最右侧从上往下缓冲落下，1帧效果。||
|提牌|单击选中后，提起手牌中对应牌。提起高度约为牌高度的四分之一<br>|单击牌面将牌提起，对应牌提起，提起高度约为牌高度的四分之一，且玩家每次只能提起1张牌。|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NDYwOGY2M2UxMGYwNjJiZTQzYTc5MzFkNzRlMjgyNmJfMDZkZjI4ZmM4ZGUwMzZhMzcyNTFkZDA1YjQzYzUxNGFfSUQ6NzcwNjExODI2ODQ5ODg4OTczMl8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
|||玩家点击非牌面空白处可将被提起牌放下，点击该牌牌面不能将其放下。||
|||可滑动选择多张牌，手牌依次提起，每次只会提起1张牌，手指离开手牌，则最终手指离开的对应牌提起，滑动选中的牌逐张提起放下。||
|||提起【打出可听牌】时，弹出听牌提示页面。|详见听牌提示|
|||||
|出牌|打出去的牌可见牌的移动过程，2帧的肉眼表现效果|- 出牌共有双击出牌、单击出牌、滑动出牌三种，其中双击出牌和单机出牌互斥，滑动出牌不互斥。可根据设置开关：<br>    - 双击出牌（默认）：出牌阶段点击已提起的牌可将该牌打出。<br>    - 单击出牌：出牌阶段点击打出不可听牌的牌，则直接将其打出，无需提起。单机出牌开启时，若轮到自己出牌前有牌提起，则自动下落。<br>    - 滑动出牌（默认开）：出牌阶段向上滑动手牌超过提起高度可显示该牌透明状态牌，并且随手指移动，手指松开可将该牌打出，如将牌移回提起高度水平线则透明牌消失撤回打出。<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZWQ5ZWQxMGVmMGZhMGVmOGZmM2MyYWI4NWI4ZmMxMDhfOTU4ZTcxOTU4MDkwNWZiNDM3NjhjMTI5ZGZmYWQ5ZTBfSUQ6NzcwNjExODI2NjY2MTg5OTQ1MV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br><br>- 超时则判断是否有提起的牌（以下是原方案的托管出牌分支。）<br>    - 有：走托管逻辑——打新摸进来的牌。（本核心流程按无托管处理，此条规则不执行。）<br>    - 无：走托管逻辑——打新摸进来的牌。（本核心流程按无托管处理，此条规则不执行。）|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MjZmYzk1ZGYyNDA0YzIyMjc3OWYzM2Q3YWZjOTdlZmZfY2FjZmZkYjJhZWI5ODJhMDQ2MDJkMTUyNGIxZGEzMTJfSUQ6NzcwNjExODI2NzEwMzk1NTk2Nl8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
||<br>||![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YmYyMmI1YTY0MTdkOTI0ZDE2ZTBiMjE5MTAwOTNhOWZfNGY4N2ViZDY4ZTUwYTM0OWQxMmQ0NmU0Yjk4YWE1ZjNfSUQ6NzcwNjExODI2OTE0NDQ2ODQ5NF8xNzk0MjkwMDI4OjE3OTQzNzY0MjhfVjM)|
||本家：打出牌放置于该玩家面前牌堆中||![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MmE3NTQzMDFkMDJkMTYzNTZlYjY5YTAyZDY4ODMyNjJfNDVlZWM1Y2VjYmY4NDNlZmNjNGM1ZDFkYzVhOGNlNzNfSUQ6NzcwNjExODI2NzkyODM0OTk2MF8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
||出牌时玩家头像处增加流光提示||![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=Y2U3Njc1MTFmMjdiODAxMDI0OTQ4OTY4MTlmNjUwODVfMDQxODk5MGYyMzE3MGMzYmY2MDJlMWVjODNhN2VjOGRfSUQ6NzcwNjExODI2NjQ2MDc1MjkwN18xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
||玩家出牌时方位处增加闪烁提醒||![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZDYyNTljMmI3NzljNTg1MmFkMTlmZjEwNjNhMTc3ZjhfZTk1MDg5MTg3YzYwNTNkZWViNzNkMzcxOTQzNmUwNzdfSUQ6NzcwNjExODI2NzgxMDk1ODU3NV8xNzk0MjkwMDI4OjE3OTQzNzY0MjhfVjM)|
||其他家：开启放大出牌（默认开）：出牌时放大展示，并打出放置于该玩家面前牌堆中，下一个玩家有操作行为后消失||![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=OGNhMDdlMDk4YzQwNGYwMzE0YWIzMjc4NTI1ZmQ5MGNfMGYzNTVmOTllYjFiYjJjZGFiZjk2NTgzZDAzMmY0MzJfSUQ6NzcwNjExODI2NTU1NDcxNzY5NF8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>|
||其他家：不开启放大出牌：直接放置于该玩家面前牌堆中，打出去的牌可见牌的移动过程，0\.5s左右|||
||其他家：打出的牌始终是摸到的那张牌|如右图摸到红框的牌，不管该玩家打出手牌哪一张，均打出红框的牌|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MzEwNWM4MmY5OGU0NGZjM2JmOTRiYTdjMzBiZDRlZGJfZTlkOGZmYjFkNDFjYzk5NTBlY2Q5ODc1MmVlMDBjZTNfSUQ6NzcwNjExODI2NTY0NzE4OTI5NF8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
|||||

行牌操作｜修改对比版

|\[行牌（含禁手）\.mp4\]||||
|---|---|---|---|
|内容|显示说明|交互说明|样式图例|
|摸牌|- 本家视角。每次摸1张。新牌正面从手牌右端上方快速落下，停在最右分隔位，落稳后与主体手牌同高，并留出间距。<br>- 其他家视角。新摸的牌以牌背显示，从摸牌玩家手牌尾端的分隔位上方快速下落，停稳后与其余牌背留出间距。该位置随摸牌玩家的座位方向摆放。新牌牌面仅摸牌玩家可见。<br>- 吃碰后的分隔位。吃或碰成立后直接进入出牌阶段，尾端分隔位显示剩余手牌中的最后一张。本家显示正面，其他家显示牌背。这次只调整手牌位置，牌墙与余牌数保持原样。|- 常规摸牌。上一张弃牌完成响应裁决且对局可以继续摸牌时，按行牌顺序轮到的玩家从牌墙顺时针取1张。取牌后刷新各视角的牌墙与余牌数。胡牌或流局已经成立时，结束本小局。<br>- 摸牌与出牌动效的顺序。若没有玩家可响应上一张弃牌，下一家可以在该弃牌飞向牌河时开始展示新摸牌。若有玩家可响应，先按胡、碰／直杠、吃的优先级裁决。只有裁决结果要求常规摸牌时才取牌。吃、碰成功后由操作者直接出牌，杠成功后按补牌处理。<br>|- 录屏约 00:06\.88–00:07\.05，同一次摸牌。左下视角看到四万正面落到自己手牌最右侧，上一家的西仍放大显示。右下视角看到左侧玩家新摸牌的绿色牌背从上方快速落入手牌尾端的分隔位。<br>- 录屏 00:24\.78，碰发后，原手牌里的北单独排到最右分隔位。录屏 00:27\.72–00:27\.82，北尚未落稳时，下一家已开始展示新摸的南。<br>|
|补牌|- 杠后补牌沿用摸牌的视角规则。本家看到补到的牌正面从上方落入最右分隔位，与其余手牌留出间距。其他家在补牌玩家手牌尾端的分隔位只看到一张牌背。<br>|- 杠成立且需要补牌时，按本局杠规则从牌墙指定位置与顺序取1张。补牌结果确认后即可展示，可以和「杠」字动效并行。加杠被抢杠胡时，本次不补牌。补牌后的操作判定见「吃碰杠胡操作」。余牌数随杠后补牌结果刷新。本方案示例中，杠前显示75，补牌后显示73。|- 录屏约 00:57\.72，右上视角。播放「杠」字动效时，补牌正落入手牌最右分隔位。<br>|
|提牌|- 本家视角。选中一张可提牌时，该牌从原位竖直向上抬起，保持原牌面和左右位置，其余手牌保持原位。同一时刻最多提起1张。吃碰禁手牌压暗并保持原位。<br>- 听牌提示仅在本家界面显示。打出后可听的候选牌上方显示黄色小箭头等提示。提起候选牌时，面板显示该牌打出后可胡的牌面及各自剩余张数。改提另一张候选牌时更新面板。取消提牌、改选非候选牌或实际出牌后收起面板。其他关闭条件和详情见「听牌提示」。<br>- 其他家视角。操作玩家点选手牌、横滑换牌或取消提牌时，其他家看到的该玩家手牌仍按原位置显示牌背，数量保持原样。提起、落回和听牌提示只在操作玩家自己的界面显示。该玩家实际出牌后，其他家按「出牌」的对应规则看到弃牌飞入牌河。|- 第一次点击未提起且可提的手牌时，先放下旧提牌，再提起点击的牌。点击禁打牌时，该牌不提起。点击非牌面空白处放下提牌。再次点击同一张已提起的牌时，符合出牌条件则出牌，否则保持提起。<br>- 沿手牌横向滑动时，滑到可提牌才切换提牌，上一张落回，新选中的牌抬起。经过禁打牌时，该牌保持压暗和原位，当前选择保持原样。松手后保留最后成功提起的牌。横滑选牌仅更新本家的提牌状态，出牌按下方规则提交。|- 录屏约 00:26\.92，选中最右侧的北时，北向上抬起，其余手牌保持原位。<br>- 文字示例。玩家A先提起五万，再改点七万。A画面里五万落回原位，七万抬起。其余三家看到A的手牌仍在原位，保持牌背。A再次点击七万并成功出牌后，其他家才看到七万飞入牌河。<br>- 录屏 00:17\.5–00:18\.4，右下视角。玩家从手牌左端的五万起，按住鼠标向右横拖，模拟手指沿牌面滑动。每滑到一张牌，该牌提起，上一张落回，同一时刻只提起一张。滑到「发」后，「发」保持提起，之后滑到最右分隔位的「八万」后，「八万」保持提起。整个横滑过程只切换提牌。<br>- 录屏 00:43\.38–00:47\.38，左下视角。本家用7条、8条吃9条后，手里的6条压暗。点按6条或横滑经过6条时，该牌保持原位，无法提起或打出。本家打出9筒后，6条恢复正常亮度。<br>- 录屏 04:14\.57–04:16\.07，切换两张可听候选牌时，提示总数在5张和6张之间切换。|
|出牌|- 本家处于出牌阶段且目标牌允许打出时，才可提交出牌。当前小局启用吃碰禁手。吃或碰成立并进入本家出牌阶段时，按「吃碰禁手」判定本次禁打牌，禁打牌压暗且不可提起。任何出牌手势都不能打出禁打牌。本家完成出牌后，清除本次禁手压暗。等待选择吃碰时的压暗按响应阶段单独处理。<br>- 出牌前预览。点击提牌及拖动中的半透明虚影只在本家界面显示，虚影显示所拖牌的牌面并随手指移动。提交有效出牌前，各家手牌张数和牌河保持原样，其他家仍看到出牌者手牌的原位牌背。|- 本方案默认双击出牌。滑动出牌默认开。单击出牌归设置模块，本方案不包含该模式。<br>- 双击出牌。第一次点击手牌只提起该牌。若该牌打出后可听，同时显示听牌提示。第二次点击同一张已提起且可打的牌时出牌。<br>- 滑动出牌。从一张可打牌按住拖动。向上、向左或向右移动都按该牌的提牌高度线判定。拖动位置高于该线时显示半透明虚影，回到线或以下时收起虚影。虚影显示且该牌仍可打时，松手提交出牌。松手时任一条件不满足，则收起虚影并取消本次出牌。<br>- 出牌倒计时归零时显示00，继续等待本家手动出牌。本核心流程按无托管处理，超时不触发自动出牌。|- 录屏 03:02\.23–03:09\.73，左上视角。对照拖动5筒时半透明虚影的出现、跟手移动，以及松手后实牌从虚影位置飞入牌河的画面。03:09\.63–03:09\.73，从松手前最后一帧虚影到5筒落稳约100毫秒，为录屏样本。<br>- 浮标画面见录屏左上视角 03:09\.73（5筒）和 03:11\.53（东）。<br>|
||- 本家出牌。确认本次出牌有效时，显示实际弃牌的正面。双击出牌从该牌提起时的位置飞出。滑动出牌先收起虚影，实牌从松手时虚影所在的位置飞出。两种方式都飞向本家牌河的下一个空位，落稳后加入牌河。<br>- 本家手牌更新。有效出牌后，从手牌移除实际打出的那张牌，其余手牌按牌序靠拢。若分隔位的牌还留在手中，将它按牌序插回主体手牌，再清空分隔位。若打出分隔位的牌，直接清空该位。理牌可与弃牌飞行并行。<br>- 最新弃牌浮标。每个视角同时最多显示1个。弃牌落稳后，在牌河里这张实牌的正上方显示橙色倒三角浮标，尖端朝下指向牌面。下一家摸牌时浮标保留。下一张弃牌开始飞行时，旧浮标消失，新弃牌落稳后浮标指向新牌。被指示的牌从牌河取走时，清除该浮标。<br>- 出牌放大（本方案默认开启）。仅出牌者以外的玩家可见。实牌开始飞行时，在出牌者所在方位的牌河中段单独显示同牌面的放大牌。放大牌正向朝观看者，边缘带浅绿色描边。每个视角最多1张。关闭出牌放大时，实牌飞行、牌河落位和浮标照常显示。<br>- 操作方位提示。轮到玩家操作时，该玩家头像处显示流光，桌面中央的对应方位闪烁。有效出牌后，提示随裁决后实际获得操作权的玩家切换。无人可响应且继续摸牌时，提示可以在弃牌飞行期间随下家摸牌切换。等待响应时按对应响应阶段展示。具体样式见「方位信息」。|- 其他家出牌显示。确认本次出牌有效时，从出牌者手牌尾端的独立牌背位飞出实际弃牌的牌面，同时从该处分隔位移除一张牌背。无论出牌者选的是手牌中哪一张，起点均为该分隔位。摸牌或补牌后，该位显示新牌的牌背。吃碰后，该位显示剩余手牌尾端的牌背。飞行结束后，实牌落在出牌者牌河的下一个空位，按该座位的朝向摆放。<br>- 放大弃牌的退场。选择「过」及随后摸牌时，继续显示当前放大牌。下一张有效弃牌开始飞行时，清除上一张放大牌，并按放大规则显示新牌。当前弃牌因吃、碰、直杠或吃胡从牌河被取走时，在该牌移出牌河的同一时点清除放大牌和浮标。<br>|- 录屏 00:27\.75–00:27\.82，右下视角。对照放大「北」与飞行中的小牌同时显示，以及小牌随后落入牌河的画面。<br>- 录屏 00:06\.92–00:09\.85，左下玩家摸到四万，随后打出原来就有的西。左下视角里，西从手牌原位置飞入牌河，四万移回万字牌中。右下视角里，西从左侧玩家手牌尾端的独立牌背位飞入牌河，飞行牌和放大牌均显示西。录屏 02:35\.47，点「过」并摸到东后，上一张四筒仍放大显示。<br>|

### 吃碰杠胡操作

[查看主方案原文](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcnJU9nEyNSHabqQiJ1nvL0cd)

- 碰牌\-复用

|显示说明|样式图例||
|---|---|---|
|玩家手牌右上方显示操作按钮：【碰】\+【过】<br>- 手牌中可碰牌高亮其他暗置，如果有胡则不需要暗置|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NTdkNDdiMmE0YTQwNWE4OTYxZDdkMTMxYjE2YTAzMDNfYzMxMGVmMzNkOGNkZmQyZTdlZDM4MmRjZTVkYTRkNThfSUQ6NzcwNjExODI3NzY1ODk3MTQ0MV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)||
|交互说明|动画效果|摆放效果|
|- 点击【碰】按钮完成对应操作，点击【过】则放弃此次操作<br>- 配置开启托管，超时默认【过】（本核心流程按无托管处理，此条规则不执行。）<br>- 从左往右根据本局操作顺序放置，放于手牌左侧<br>- 展示牌面，碰牌上方显示【箭头】，指向对应碰牌方位<br>    - 碰对家：↑<br>    - 碰上家：←<br>    - 碰下家：→|<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=Y2E5MjNmYmFmNTkwYjJjMGFkMDEyMzBkZjU3M2NiM2FfNjM5MWY4OWY3NTZlZGE1NDIyZTEwNWE1MzUyOTI2MDBfSUQ6NzcwNjExODI3NTU3NDg5MzU1OV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>对应碰牌玩家手牌面前播放<br>|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NWU0MWJmZWNlY2M2ODI0MjkwYmYwZmNhMGZkMjhiYjRfYWE1YzU0NTkwNWExNzVhYmRjYjgwNzllNzMxYTE3ZGJfSUQ6NzcwNjExODI3Njc5MDk0Njg0OV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>手牌左侧平移放置碰牌|
|||![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MTFlODVmZmZiOTlkYjAzOGM2ZTgyZjljODQ5MWI0ZTZfYWU1MjRjNThiNDY2ZTYzYzAwNzM5NmM3MjQ3ZTM3OGNfSUQ6NzcwNjExODI3NDM0NjExMDIyN18xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|

- 杠牌\-复用现有血战杠的特效，主要区别删除刮风下雨，无论什么杠，统一使用杠字即可

- 胡牌\-复用

|胡牌类型|显示说明||图例样式|
|---|---|---|---|
|自摸|- 自摸：<br>- 玩家手牌右上方显示操作按钮：【自摸】\+【过】。<br>- 在【自摸】选项左侧显示本次胡的牌和**本次胡牌的倍数**（自摸按自摸显示）。<br>- 点炮：<br>    - 玩家手牌右上方显示操作按钮：【胡】\+【过】。<br>    - 在【胡】选项上显示本次胡的牌和本次胡牌的倍数（非自摸不含自摸）。<br>||![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MjhkYTZmODhmZTY0ZjI2MjY2OGM2NDhlMjY2YTBiNWZfNDMzNjI0ZjhiOTUxNGU2MDc2ZmM5YzMyNTk0MjExOTZfSUQ6NzcwNjExODI3NjQ4OTEwNDY0OF8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
|点炮|||![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZmI1ZThkYWQwMTdlODFjOWQ4NjRhZTRjMTQzYzBjOGZfZjQ3ODM4NDdmNjdkMzFjMDRhYjU3NjEwYmU2OWM4M2RfSUQ6NzcwNjExODI3NTgzOTkyMTE0NV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
|交互说明|动画效果|动画展示|摆放效果|
|自摸：点击【自摸】按钮完成对应操作，点击【过】则放弃此次操作。<br>配置开启托管，超时则默认胡（本核心流程按无托管处理，此条规则不执行。）|- 光柱动效\-番型动画（对应方位玩家手牌前播放）\+飘分（正分为黄色，负分为灰色）<br>- 此环节不可直接出牌|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MjQxZjdiNDMwZjU4ZmY5OWY4ZGNlNjc2YzY1ODMyM2ZfY2I0ZDE3MTA3YTU4OTRjNDVkZDQ4YjFjNTFkODczYTdfSUQ6NzcwNjExODI3NjMzMzk0ODE1Nl8xNzk0MjkwMDI4OjE3OTQzNzY0MjhfVjM)<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YjBlZmMyMDBkZmNhMTVjMTE5MzhjMTg5ZjllMzJkOTlfZjY5YzM0YmZlYzVmOTA5NTg0ZGYxYzU2YmRhNDA1ZjVfSUQ6NzcwNjExODI3NjU2NTMzOTE0OV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZGI5OGU3YzczNmM4OGFkMGEzNDhkYzQzYWNjNTc4YzlfNmY4NjNiMDRhMTg4NmEyZTAxN2EyOTJkMWRhYzgwMzVfSUQ6NzcwNjExODI3NDYyMjk2NjgxMF8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|摊开摆放在自己手牌右侧的间隔4分之1牌距离，显示手掌标记<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YWNkMWMzYTY2NjFjODc5ZjQwNjZlOGZhNmJiNmI3NDlfMmY4ZGRlMGYyM2E3YWM0NjIyODJiNWVjNWExNmIwODhfSUQ6NzcwNjExODI3NDg5NTY0NTcwOV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
|点炮、抢杠胡：点击【胡】按钮完成对应操作，点击【过】则放弃此次操作。<br>配置开启托管，超时则默认胡（本核心流程按无托管处理，此条规则不执行。）|点炮动画\-光柱动画\-番型动画（对应方位玩家手牌前播放）\+飘分（正分为黄色，负分为灰色）|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=Nzk5YWUxMmZkNmU4MjU4OWQyZjQwNjY2NWRlM2FkZTdfMGZkNDFiZTk5NGI5MGE0MjUxOTg0NDVhZDYzMDc4ZDRfSUQ6NzcwNjExODI3NjQ2Mzg1Njg3NV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NDUwOTQxNGRlMGZhMGRhN2RjMzE3MmMzMDgyNjc2OWFfYzg0ZTVlYjk5MThjZTA5MmFkYWI5YTc5YTUyZDEyMTJfSUQ6NzcwNjExODI3NzQ5MTI0ODQxOV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MjE1YTU5MzhhM2M3NzQ5YjlkZmE1Zjk0NDhkNTM2MzJfYTI4YzdiMDg4YjliZjAwZTIyODZiZDE5YjM3ZmQ2MDhfSUQ6NzcwNjExODI3NDA3MzY3Njc5MV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|摊开摆放在自己手牌右侧的间隔4分之1牌距离，自己角度显示对应点牌玩家的方位箭头<br>- 胡对家：↑<br>- 胡上家：←<br>- 胡下家：→<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NGQ4ZGU1Mzk0YzdlNDZiOTU3NDE5NWM4NzM0NDA0OWJfNGEzMTYxODI4NzEzMWM1MzYzMTI4Y2RjYWQ2MzIzNzdfSUQ6NzcwNjExODI3NzkyNzUwNTEzN18xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NWYzYjRjMzJjOWU0OWQxNDdkYmU4ZTMyNzBjMmZjYjFfMTQ5OWE3YTBlNGY1MmZkM2Y0YmExMDJkMmM3M2Q0YWRfSUQ6NzcwNjExODI3NjM2NzQ4NTk2NF8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)|
|||||
|特殊显示|说明||效果|
|||||

- 吃牌

|显示说明|样式图例||
|---|---|---|
|玩家手牌右上方显示操作按钮：【吃】\+【过】<br>- 手牌中**所有可吃牌高亮**其他暗置，如果有胡则不需要暗置<br>- 举例：上家出五条，手上有三条，四条，六条，七条。则这四张牌全部都要高亮|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=ZGE2ZmYyNzY4NzhmYjdmMTVmYzc2MmFlZTFjNTFjOTFfMTUyODlkMWM1YmNjNzBiMzhjN2U3YzZjN2VhNDk0YjdfSUQ6NzcwNjExODI3NzYwMTkyMjIzNV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>||
|交互说明|动画效果|摆放效果|
|- 点击【吃】按钮完成对应操作，点击【过】则放弃此次操作<br>- 配置开启托管，超时默认【过】（本核心流程按无托管处理，此条规则不执行。）<br>- 从左往右根据本局操作顺序放置，放于手牌左侧<br>- 展示牌面。|<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MjM0OTc4ZWMwNWMwZDZlMTA0YmIwYWRjNDU1NTQxY2NfODU1Yjk3YjQ4Mzk1NjI4OWQwNDZiYmU4MWVlZDMyMmFfSUQ6NzcwNjExODI3NzEzOTEwNzA1MV8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>对应吃牌玩家手牌面前播放|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MThmNTk5NTE0ZDRmNmEwNGU4YWM5OWNhZjJlY2RmZDFfOTlhMjZiZjMzNTYxNjgxZmFkNmFiNTM3NDBkMjY5MjVfSUQ6NzcwNjExODI3ODI3MTI0MTQ2OF8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>手牌左侧平移放置碰牌|
|||![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NmNkZTEzNzNkZDM2NDFjNTFjNjc0OTU3ZTUyYjQ4YTZfMjg0Y2U5MTdlMTU4MTE4NDQxYzk5NzdhNmQ5ZTgyMjNfSUQ6NzcwNjExODI3ODAxNTM3MjU5Ml8xNzk0MjkwMDI4OjE3OTQzNzY0MjhfVjM)|

### 多操作状态\-复用功夫川麻

[查看主方案原文](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcnPvOf2dv7VPpMSsNIe2mx9e)

### 对局内通用提示

[查看主方案原文](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcnZIHhJWNQlF0UjKk05uRihb)　｜　本期「三摊落地」按三摊承包规则触发，其余提示供查阅原方案。

|内容|触发方式|涉及模块|具体展示效果|
|---|---|---|---|
|只碰不吃|- 前置条件：勾选只碰不吃规则<br>- 触发场景：上家打出能吃的牌<br>- 结果表现：<br>    - 不会弹出吃牌的按钮<br>    - 客户端展示toast“只碰不吃规则生效中”|对局内吃碰操作|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NWU0YmNmODUwMGY4YmI0YzhkYTg2MDg4ZWM3ZDNkYWFfNDhhOWY3NjJjODJkNmEwNzdhZWZjOGQ0ZTJjNjJmZWRfSUQ6NzcwNjEzNzY5OTU4MDgwODE5M18xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>|
|有财必拷响|- 前置条件：<br>    - 勾选有财必拷响规则<br>    - 该玩家有财神<br>- 触发场景：玩家满足了自摸的条件<br>- 结果表现：<br>    - 不会弹出胡牌的按钮<br>    - 客户端展示toast“有财必拷响规则生效中”|对局胡牌相关<br>|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YzZjYzc0Y2ZkMmU2MDIxNDEyM2RlOWNmY2JkZGJjOTdfNDFhMzliMmI3ZDhlZmZiMDY1YWQxNmJiYTBlYTJhNTlfSUQ6NzcwNjEzNzY5OTU4NTEzMzUwNl8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>|
|三摊落地|- 触发场景：玩家A对玩家B的吃碰次数达到三次<br>- 结果表现：<br>    - 客户端展示“三摊落地”的艺术字动画|对局内吃碰操作|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=OWVlZjczNTkyNzU0MzMwN2E3MDcwMDQwMjA1NDZlYzJfZDNhNTIyODIwNGZlNjgxYmU1YjUzZjVmYmE3OGRkNjFfSUQ6NzcwNjEzNzcwMDIwOTk1Mzc3N18xNzk0MjkwMDI4OjE3OTQzNzY0MjhfVjM)|
|守庄|- 前置条件：<br>    - 勾选守庄规则<br>    - 庄家的上家没有财神<br>- 触发场景：<br>    - 能碰：庄家，庄家下家打出的牌<br>    - 能吃：庄家打出的牌<br>    - 能明杠：庄家，庄家下家打出的牌<br>- 结果表现：<br>    - 不会弹出吃/碰/杠的按钮<br>    - 客户端展示toast"守庄规则生效中"|对局内吃碰操作<br>||
|跟庄|- 前置条件：<br>    - 跟庄规则勾选<br>    - 跟庄规则流程触发<br>- 触发场景：<br>    - 最后一个玩家出牌完成跟庄<br>- 结果表现：<br>    - 客户端展示“跟庄”的艺术字动画||![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YWYyNDgyNGJhNjE2MTNhM2E4NzZkYjRjZDI2OGRmYTVfODUzMGFmNjYyYzliZjZiMWZlYjVhYWM2Y2VhY2M3YTJfSUQ6NzcwNjEzNzY5Nzg4NjcwMjc3Nl8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>|

## 结算流程

### 流程明细

[查看主方案原文](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcnqB8JesLUSpapAvUxWcd8sc)

|内容|所属阶段|触发方式|涉及模块|具体展示效果|备注|
|---|---|---|---|---|---|
|结算流程<br>|胡牌场景|- 触发操作：对局中有玩家胡牌，根据玩家的番型播放对应番型特效<br>- 参考功夫川麻的胡牌流程即可<br>|胡牌阶段<br>|![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=YjY1Y2MwMTIwNjkxZTI0MzdjYzk5M2NiZGUyM2YxMTBfYzlkNTdjOWNiMDU3MjFlN2RjNjllYWExYmQzYzAzYTJfSUQ6NzcwNjExOTc1OTcwNzg1MjAzMl8xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MDcwMzEzNjBiOGRlOWI2ZjZlMmVkZDUzNDAwODEwYTFfOWU4MGQ0NzdjZTg0OGQ2MWFiOWMzYTJmZWEzZDNjZjJfSUQ6NzcwNjExOTc1NjA5NzMwOTk0N18xNzk0MjkwMDI5OjE3OTQzNzY0MjlfVjM)<br>|与功夫川麻保持一致<br>|
||对局结果阶段展示|- 前置条件：对局结束后<br>    - 可以是出现流局，对局结束<br>    - 也可以是播放完胡牌番型后<br>- 展示本局所有玩家的分数|对局结果阶段展示<br>||同步老包<br>|
|||||||
|||||||

## 结算界面

### 小结算界面（好友房）

[查看主方案原文](https://rcn6u2y4zn7a.feishu.cn/docx/FNQ1dwzvEoe9oVxp5k0cvihnnle#doxcn6PO2pfB3S48gS2P3VmtBbc)

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MTczZTBiMzM4MGY2NmY0MjM5Y2RiMWJmODY0ZjA2MmNfZmQ4Y2Q1NjJhY2NlMWY4MzgyODg0OWEzN2QzNzM5MGRfSUQ6NzcwNjExOTc3MzUyMDI4NDkyMl8xNzk0MjkwMDI4OjE3OTQzNzY0MjhfVjM)

#### 触发逻辑

|功能模块|模块分类|说明|
|---|---|---|
|小结算|触发条件|**播完胡牌结算流程****，进入结算界面**<br>|

#### UI交互以及说明

|功能模块|编号|内容|说明|
|---|---|---|---|
||1|玩家信息|- 玩家头像<br>- 庄家标识以及牢庄标识<br>- 房主标识<br>- 玩家昵称<br>- 和本玩家的相对座位位置|
||2|手牌摆布<br>|- 杠牌要垒起来<br>- 胡牌的玩家按照玩家胡牌的摆法分割手牌<br>- 未胡牌的玩家仅碰/杠/吃的牌会分割，其余的手牌不分割<br>- 手牌里的财神也有需要染色|
||3|输赢显示|- 赢了显示“恭喜获胜”<br>- 输了显示“遗憾失败”|
||4|分数结算|- 分数\>=0用黄色<br>- 分数\<0用蓝色|
||5|承包的标识|- 用来展示本局承包和反承包的情况|
||6|赢家结算<br>|- **展示本局胡牌番型****~~和倍数~~**<br>- **番型结算要求：**<br>    - **杠爆/杠飘/七客等复合牌型情况下，统计两侧的数量，如果数量是1，则只展示对应的名称，如果数量不是1，则展示名称后单独列出来。**<br>        - **比如：二连杠二财飘，在结算上显示的是：杠飘\*32（二连杠，双财飘）**<br>    - **承包有单独的样式，但是文字结算也要体现出来**<br>    - **牢庄不需要展示**|
||7|麻将牌标识|- 胡的对应的牌要有“胡”的标记<br>- 财神牌左上角有财神的标记|
||8|财神牌|- 展示本小局的财神牌|

## 辅助功能

### 菜单

|\[通用退出\.mp4\]||||
|---|---|---|---|
|功能模块|模块类型|说明|图示|
|菜单|退出|- **入口与范围。**开局前与开局后使用同一套菜单。点击牌桌左上角的菜单图标，展开左侧面板，面板内仅显示「退出」图标和文字。<br>- **退出确认。**点击「退出」后，桌面压暗，居中显示「提示」弹窗，文案为「确定要解散房间吗？」。左侧为蓝色「取消」，右侧为黄色「确定」，右上角为关闭「×」。<br>- **取消或关闭。**点击「取消」或右上角「×」，关闭确认框并回到弹窗前的房间界面。<br>- **确认解散。**点击「确定」后直接解散当前房间，发起退出的玩家返回大厅。已开始的对局随房间解散而结束。|- **约4\.6秒。**左侧菜单展开。<br>- **约7秒。**显示解散房间确认框。<br>- **约13\.5秒。**确认后返回大厅。|



