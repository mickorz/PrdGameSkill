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
