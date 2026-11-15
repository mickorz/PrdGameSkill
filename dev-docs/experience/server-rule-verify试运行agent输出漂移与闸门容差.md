# server-rule-verify 试运行三轮卡点：agent 输出漂移与确定性闸门容差设计

- 日期：2026-11-14
- 上下文：OSG-W4 S2.3 试运行 ST-C01（`.opencode-workflows/workflows/server-rule-verify/` 四子流程链路）
- 涉及文件：`2-match-atoms.js` / `3-verify-scope.js` / `4-review-difference.js`（prompt + 校验）、`merge-verify-output.mjs`（SVE 闸门）

## 问题现象

试运行经三轮失败才贯通，每轮卡点不同：

1. **第一轮**：匹配子流程校验失败——`匹配摘要 partFile 不符：期望 ST-C01-p01.json 实际 spec-workflow/output-spec/server-rule-verify/runtime/match-output/ST-C01-p01.json`（agent 把自己写的完整路径当 partFile 返回）。
2. **第二轮**：merge 闸门拦截——`SVE file 与 layer 前缀不符：SVE-ST-C01-P01-28 -> xiaoshanmj_server/com_game/xiaoshanmj_com_banker_level.cpp`（落判 agent 引用了杭州麻将三根目录之外的萧山麻将变体文件做证据）。
3. **第三轮**：merge 闸门拦截——`本轮 SVE id 重复：SVE-ST-C01-P01-23`；细查是同一条 `banker_level_type` 证据（game_logic.cpp:56）被 AT-ST-C01-006/007 两个原子各复制了一条同 id SVE，且两份摘录截断不同（一份多一行 if 语句）。

## 排查过程

- 每轮失败先手动重跑对应确定性脚本（`node merge-verify-output.mjs ...`）复现问题明细（workflow 内 commandSuccess 不回显输出，前台续跑只给一行错误）。
- 第三轮用 node 内联脚本 dump 两条同 id SVE 全字段，逐字段 diff 发现：`layer/file/location/symbol/configKeys` 完全一致，仅 `atomId` 与 `excerpt` 漂移——这是「共享证据跨原子复制」合法模式，不是 id 冲突。

## 根因

1. **标识类字段格式未在 prompt/schema 写明**：`partFile` 在 schema 里只有类型没有格式说明，agent 自然回了完整路径；workflow 校验用了严格全等。
2. **证据目录范围未约束**：服务端源码根 `mahjong_server/src` 下除 `game_hzmj/{common_game,hzmj_server}` 与 `mah_frame` 外，还有 `game_hzmj/{chunanmj_server,hzmj2r_server,tonglumj_server,xiaoshanmj_server}` 四个变体目录和 `game_gzmj/game_scmj/game_simple/ai_model` 等其他玩法目录；prompt 只说「读源码行段」，agent 自由探索后把变体实现当成了本玩法证据。
3. **共享证据模式未被闸门建模**：一条 file:line 证据服务多个原子时，正确写法是 SVE 只写一条、其余原子 evidenceIds 引用同一 id；但 agent 会把同 id 条目复制到多个原子下，且复制时摘录截断会漂移。闸门初版「同 id 同原子才放行」把合法共享判成了冲突，「同 id 重复」也一律 fail。

## 解决方案

1. partFile：schema description 写明「不含目录路径，与输入分片同名」+ prompt 同步；三处校验归一化（`partFileMatches`：全等或以 `/文件名` 结尾都放行）。
2. 证据范围：3-verify-scope prompt 加硬约束段「仅限三根目录：game_hzmj/common_game/、game_hzmj/hzmj_server/、mah_frame/；变体目录（chunanmj_server/hzmj2r_server/tonglumj_server/xiaoshanmj_server）与其他玩法目录（game_gzmj/game_scmj/game_simple/ai_model 等）禁止引用」。
3. 共享证据：merge 的 SVE 同 id 判等基准从「全部字段」收窄为**证据指针**（`coreOf` = layer/file/location/symbol/configKeys，摘录是可更新引文不计入，与「摘录可更新」语义一致）：
   - 本轮内同 id 同指针 → 去重放行（保留首个，摘录漂移容忍）；
   - 本轮内同 id 指针不同 → fail（真重复）；
   - 与正式既有同 id 同指针 → 原位替换（幂等重跑/摘录更新/共享证据）；
   - 同 id 指针不同 → fail（id 劫持）。
   prompt 同步：「共享证据只写一条（放首个引用原子下），其余原子 evidenceIds 引用同一 id，禁止复制同 id 条目」。
4. 回归：merge-verify-output.example 补用例 C2（同对象复制去重/同 id 指针不同 fail/摘录漂移去重保留首个），66 项全绿。

## 预防/注意事项

- **agent 输出的标识类字段必须在 schema description 里写明格式**（文件名 vs 路径、编号规则、是否含扩展名），校验侧同时做归一化容差——严格全等对 LLM 输出过于脆弱。
- **涉及源码引用的 prompt 必须写死目录白名单**，尤其源码树里混着玩法变体/其他游戏时（变体目录名几乎相同，agent 极易误引）；确定性闸门（merge 的 layer 前缀校验）做最后防线。
- **结构性重复模式（共享引用/复用）要在闸门里显式建模**：判等基准用「指针」而非「全文」，可变字段（摘录/说明文字）不计入。
- **多阶段累积运行必须按分片 stageId 过滤消费**（2026-11-14 S3.2 追加坑）：分阶段跑 server-rule-verify（ST-C01 → ST-C02,ST-C04）时，`runtime/verify-output/`、`runtime/review-output/` 里会留下上次运行的非目标阶段分片；merge 初版扫描目录内全部分片并对非目标阶段条目报「原子阶段不在目标范围」fail。修复：merge 按分片 `stageId` 过滤（非目标阶段分片=上次运行遗留，跳过不消费，`summary.skippedVerifyParts` 记录；正式条目已在正式产物中）；保留跨阶段混入闸门（分片声称目标阶段却含其他阶段原子仍 fail）；新增「目标阶段一条落判条目都没有」fail 兜底。分阶段批跑（S4）前必须验证此语义。
- **失败定位顺序**：workflow 前台续跑只报一行错 → 手动重跑对应确定性脚本拿问题明细 → node 内联 dump 全字段 diff。
- **续跑省成本**：`resumeFromRunId` 对未变 agent() 调用直接回放 journal（S3.2 续跑 12 agent 里 11 个回放、仅 1 个新跑、21s 完成），只有 prompt 变过的子流程重跑；改闸门逻辑（非 agent 调用）不影响回放。
- **网关怪癖**：thinking 模式不支持 `json_schema` tool_choice，运行时会自动降级为 prompt JSON 模式（日志有提示，无需处理）。
- 试运行最终结果与对照结论见 `spec-workflow/output-spec/server-rule-verify/README.md` S2.3 节；S3.2 批跑（ST-C02/ST-C04）对照结论见同文件 S3.2 节。

## 坑 5：SVE file 字段丢中间目录段（location 正确、file 漏写）

**问题现象**：S4.1 第一批（ST-C13/14/15，run-mwg6o42u-14）merge 闸门报「SVE location 与 file 不一致」3 条：agent 的 location 写对了完整路径（`common_game/com_game/common_game_com_play.cpp:63`），file 却漏掉中间目录段写成 `common_game/common_game_com_play.cpp`；连坐 3 条「evidenceIds 不在 server-evidence」（同 3 条 SVE 被拒）。

**排查过程**：dump 分片 JSON 逐字段对比 file/location；到 symbol-index 查真实路径确认 location 口径正确（方法符号 CheckPlay:53/MakePower:18/Execute:87 均命中，引用行在方法体内合理）；file 是转写手误。

**根因**：3-verify-scope prompt 只要求「location 以 file 开头」，没要求反向一致（file 与 location 路径部分逐字符一致）；agent 从符号索引转写 file 时漏复制中间目录段，location 另按读文件路径写、反而正确。

**解决方案**：① 机械修复（已核验 ground truth 后）：file = location 冒号前路径部分，直接改分片 JSON，resume 续跑全回放 20s 收口（不改 prompt 保证 journal 回放）；② prompt 加固（防复发）：3-verify-scope.js 规则块补「file 必须与 location 冒号前路径逐字符一致（含 com_game 等中间目录），闸门逐条比对，漏写整轮合并失败」，后续批次生效。

**预防/注意**：修复 agent 产物前必须先到 symbol-index/源码核验正确值，机械修复仅限「字段间可互相推导且闸门只查内部一致性」的场景；prompt 修复与续跑回放互斥——改了 prompt 该类 agent 全部重跑，赶时间先机械修复续跑收口、prompt 加固留给下一批。

## 坑 6：agent 返回的结构化摘要计数手误（分片文件正确，摘要报错）

**问题现象**：S4.1 第三批（ST-C03/11/12，run-mwgbqusi-2 首轮）在子流程 3 的摘要闸门失败：「落判摘要计数不自洽：ST-C11-p06.json 四类合计=9 atomCount=8」。dump 分片文件核对：条目数 8、分布 6/1/1/0、atomId 无重复全覆盖——**分片文件本身完全正确**，错在 agent 返回的结构化摘要（四类合计手误报 9）。

**排查过程**：读 `runtime/verify-output/ST-C11-p06.json` 逐项核对（条目数/atomId 清单/分布/重复检查）；再读 `runtime/verify-input/ST-C11-p06.json` 的 atomCount=8 与 featureGroups 展开一致，确认文件侧无任何问题。

**根因**：闸门信任 agent 返回的摘要计数（`r.active+r.conditional+r.unknown+r.inactive === r.atomCount`），而 agent 摘要是「转写产物」——LLM 对自己刚写的文件做算术汇总时会手误；文件才是权威产物。且该闸门失败发生在 agent 调用之后，resume 会原样回放失败的返回，不改闸门就永远卡死。

**解决方案**：新增确定性重算闸门 `.opencode-workflows/scripts/recount-verify-parts.mjs`（example 16 断言）：以落判分片文件为准，对照 verify-input 期望原子清单重算——全覆盖（缺失/混入外来原子均 fail）、atomId 不重复、applicability 枚举合法、四类分布与 sveCount 重算，成功写 `runtime/verify-recount.json`；子流程 3 用 `commandSuccess` 跑该脚本做闸门 + 新增「回读落判重算」agent 聚合 scopeStats（agent 摘要计数只 log 告警不再 fail）。改闸门属非 agent 调用逻辑，不影响 journal 回放——续跑 24 agent 全回放 253s 收口。

**预防/注意**：凡「agent 返回值只用于校验/统计」的闸门，都要能退到「以落盘文件确定性重算」的口径——agent 摘要最多做告警与交叉提示；分片文件与期望清单（verify-input）的对照交给纯代码闸门。新增 agent 调用（回读重算）追加在既有调用之后，resume 时既有调用照常回放、新调用正常新跑，位置不要插到既有调用前面（会改变调用序列导致回放错位）。

## 坑 7：投影 agent 把「verified→不写差异行」执行成整原子漏写（S4.2，output-spec-generate 链路）

**问题现象**：S4.2 策划版 v3 全量投影（plannerOnly）在 4-assemble 的 AT-ID 覆盖闸门失败：「策划版 AT-ID 覆盖缺失 22 个（AI 漏写补充内容）」。核对 22 个原子（C03-011、C04-006/009、C05-022、C06-003/006、C07-013、C08-001/004/011/017、C09-005、C10-001~006、C11-006/017/028/029）**全部 l7=verified** 且全部有 uiInteraction/notes/businessBehavior 界面内容——规则要求 verified 原子「差异行不写、界面表现行照写」，agent 只写了前半句。

**排查过程**：按缺失 ID 逐个到 planner-parts 分片 grep（0 命中，分片层就漏了）→ 查 planner-evidence 确认 22 个原子全有界面内容（排除「全空原子不硬凑行」的合法省略）→ 定位为 prompt 措辞歧义：「l7=verified：不写差异行（原文照常保留）」没有显式接上「界面表现行照常适用下一条」。

**根因**：plannerDocRules 的 l7 四口径分支与界面表现行规则是两条并列规则，verified/not_applicable 分支只说「不写差异行」，agent 把整条补充行都省了；投影链路没有逐原子的行级覆盖校验（4-assemble 的 AT-ID 覆盖检查是事后闸门，分片已 merge 并删除，无法只补分片）。

**解决方案**：① plannerDocRules 加固：verified/not_applicable 分支显式补「界面表现行照常适用下一条」「差异行不写≠原子项不写」；转写硬规则新增第 6 条覆盖硬规则（本章每个原子 id 必须至少出现在一条补充行，一条语句多原子可合并多 id 一行，全空原子例外；最终装配逐 AT-ID 校验，漏写任一 id 整个装配失败）。② 分片已删只能补最终文档：一次性补写 workflow（单 agent，按 evidence 的 rule 字段定位原文语句锚点，insert 22 条「  - 界面表现：…（id）」子列表行），重跑 build-output-spec 全套闸门（泄漏/覆盖/乱码）确认全过。锚点可定位性：原文规则语句按 prompt 规则 2 逐字保留在文档中，用 rule 文本前缀 grep 即可命中。

**预防/注意**：「分支规则说『不写 X』时必须显式说明同位置其他行类是否照写」——LLM 对否定分支的执行范围容易扩大化；「按类省略」的规则必须配「按实例校验」的闸门（逐 AT-ID 覆盖），且闸门要能在产物合并后兜底修复（merge 删除分片后，补写目标只剩最终文档，锚点靠逐字保留的原文语句）。

## 坑 8：retry 分片 partNo 命名空间复用——agent 新增 SVE 占原分片 id 段（S7，id 劫持闸门整轮拦截）

**问题现象**：S7 待补证 72 条第二轮重跑（retryMode），`4-review-difference.js` 在 merge 闸门失败：「SVE id 与正式既有冲突且内容不同」16 条（SVE-ST-C01-P01-27/28/29、SVE-ST-C03-P01-06~12、SVE-ST-C08-P01-01~05、SVE-ST-C09-P01-24）——同 id、不同原子、不同证据指针（id 劫持），整轮装配拦截、产物未写。

**排查过程**：对撞 id 逐条对比正式 server-evidence 与 retry 分片（如 SVE-ST-C01-P01-27 正式属 AT-ST-C01-008 / common_game_com_result.cpp:369，retry 分片里挂在 AT-ST-C01-003 / common_game_logic.cpp:68）→ 不是 agent 抄错，是编号空间撞车：`prepare-retry-input.mjs` 生成的 retry 分片 `partNo` 沿用 `'01'`（与原 `ST-C01-p01` 同段），agent 按模板 `SVE-<stageId>-P<partNo>-NN` 给**新增**证据编号时落进原分片已占用的 id 段（原 p01 的 27/28/29 已被 AT-ST-C01-008 的证据占用）。

**根因**：retry 分片的**文件名**用了 `-r01` 隔离，但 `partNo` **字段**仍是 `'01'`——SVE 编号模板只吃 partNo，命名空间没跟着隔离；merge 的 id 劫持闸门（同 id 不同原子且不同证据指针 → fail）按设计正确拦截。

**解决方案**：① 机械改号：按 merge 闸门同口径识别 16 条劫持 id → 改号 `SVE-<stageId>-PR<partNo>-NN`（PR 前缀隔离），同条目 evidenceIds/evidenceScopes/文本字段引用 + review-output 的 reviewReason 文本引用同步替换（临时 node 脚本一次性）；② prompt 规则覆盖：`3-verify-scope.js` retryLines 增补「本轮专用编号规则——新增 SVE 一律 `SVE-<stageId>-PR<partNo>-NN`，复用既有 id 仅限同一原子的既有条目」；③ 剩余确定性链（merge/classify/check-l7/报告）手动顺序执行（失败的 4 号 workflow 不 resume，规避 journal 回放对已改号分片的不确定性）。

**预防/注意**：**分片重跑（retry/增量轮）必须给编号命名空间做代际隔离**——文件名隔离不够，凡进 agent 编号模板的字段（partNo）都要带代际前缀；「同 id 不同主体」类闸门被触发时，先对比新旧条目的归属与指针再定性（agent 抄错 vs 编号空间撞车），后者是构造方（输入生成器）的 bug，不是 agent 的。

## 坑 9：补写 agent 自跑装配命令——merge 删分片 + 幂等跳过误导；裁决注记转写失真（S7 重投影）

**问题现象**：S7 v3-planner 重投影批跑（run-mwi2rvx1-8）落盘闸门失败：「策划版分片未生成（agent 返回但未写盘）：part-16.md」（ST-C14，17/17 唯一缺口）。定点补写 mini workflow（同构 prompt 单 agent）成功落盘后，手动跑 build-output-spec 装配，日志显示「[跳过] [合并策划版] 分片已在上次运行合并（全缺且目标存在，幂等跳过）」——但 17 个分片明明刚写齐。另：重投影后两条已裁决行（C02-008/C15-018）被 agent 写回「待策划裁决」前缀，C02-008 行还把已裁决记录转写成「已有初裁记录……待正式裁决」。

**排查过程**：查 planner-parts 目录 → 0 文件（刚写齐的 17 个分片全没了）→ 对照 build-config（17 分片在列）→ 核对最终文档 mtime（补写 agent 完成时刻）与内容（含 part-16 新内容、ST-C14 9 条待验证行）→ 定位：补写 agent 写完分片后**自行执行了 build-output-spec.mjs 装配命令**（merge 17 分片 → 写最终文档 → **按合并语义删除全部分片** → 重建追溯索引 + 泄漏/覆盖校验全过）。我随后的手动 build 命中「全缺且目标存在」幂等跳过分支（语义正确但日志具误导性，实际装配已完成）。裁决行失真：DR reviewReason 尾部明明带「｜策划裁决（2026-11-14）：B 改需求」后缀，投影 agent 转写 l7Reason 时把它弱化成「已有初裁记录」「已有裁决记录……」并保留「待策划裁决」前缀——plannerDocRules 的 decision_required 分支只教了「待策划裁决」行式样，没有「已裁决」变体。

**根因**：① 补写 prompt 只禁了「git 命令」，没禁装配/构建类命令——agent 为「校验」自己跑 build 属越权副作用（merge 删分片是链路设计，agent 不知道）；② l7Reason 转写规则缺「已裁决」出口：reviewReason 里的裁决后缀应提升为行前缀「已裁决（日期，方向）」，而不是当普通注释弱化。

**解决方案**：① 越权副作用事后无害（装配结果与手动链路一致、闸门全过），补两层防护——补写类 agent prompt 显式加「不要执行任何 node/构建/装配命令，只写目标分片文件」；l7 四口径的 decision_required 分支增补「reviewReason 含策划裁决记录时行前缀写『已裁决（日期，方向）』而非『待策划裁决』」。② 本轮两行外科手术式改前缀（已裁决（2026-11-14，B 改需求）+ 裁决口径尾部），复跑 planner-only 校验（trace 319 / 泄漏零 / 覆盖 100%）全过。

**预防/注意**：**给 agent 的禁令要按「副作用类别」列全**（git / 构建 / 装配 / 删除），只禁 git 不够——越权跑装配命令会触发链路后段副作用（删分片），且其产物会被幂等跳过分支掩盖成「误导性正常」；**裁决记录跨轮再生时必须有确定性行式样**（前缀级），依赖 agent 自由转写会失真降级。
