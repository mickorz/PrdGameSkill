# ui-interaction-prd-extract workflow 流程分析

> 分析对象：[.opencode-workflows/workflows/ui-interaction-prd-extract.js](../../.opencode-workflows/workflows/ui-interaction-prd-extract.js)（1184 行）
> 分析日期：2026-11-11
> 附带实证脚本：[analyze-rule-coverage.js](../../examples/ui-interaction-prd-extract-workflow/analyze-rule-coverage.js)（基准覆盖度核对，可重跑）

## 一、流程全景

三种模式（`args.mode`）：

```text
full    = extract + check 串联（默认，一条龙）
extract = 只做基准提取：扫描代码与FGUI → 逆向提取 → 基准说明
check   = 只做对照检查：扫描规则与需求 → 规则检查 → 一致性检查 → 汇总去重 → 报告 → 审核 → Dashboard
```

### extract 段（3 阶段）

| 阶段 | 执行体 | 做什么 | 产物 |
|---|---|---|---|
| 扫描代码与FGUI | 1 个分析 agent（schema 结构化） | 从 GameDefine.ts 确认玩法 ID；列 42319 全部 .ts；按 **8 个预置主题**（DEFAULT_THEMES）把代码文件分组 | themes[].codeFiles 分组（不落盘） |
| 逆向提取 | 8 个 general agent 并行（每主题 1 个） | 逐个读完该主题代码文件，提炼"UI 事实 + 代码锚点"，写入 `01-08.md`；死代码显式标注；条款文件内从 1 连续编号 | `{outDir}/rules/{rulesName}/01~08.md` |
| 基准说明 | 1 个 general agent | 汇总文件清单、基准性质、检查口径 → `00-基准说明.md` | 00-基准说明.md |

8 个预置主题：操作按钮与权限 / 听牌提示 / 结算链与胡牌展示 / 断线重连与场景恢复 / 托管与超时 / 界面清单与弹层生命周期 / 桌面常驻元素 / 开局流程。可用 `args.themes` 覆盖。

### check 段（7 阶段）

| 阶段 | 执行体 | 做什么 |
|---|---|---|
| 扫描规则与需求 | 1 个分析 agent | 需求文档清单 + 规则文件分组（>20KB 按章节拆行范围片段），组数上限质量档 24 / fast 档 16 |
| 规则检查 | N 个分析 agent 并行（每组 1 个） | 每组"逐条基准条款对照需求全文"，schema 强约束五种类型 / 四级优先 / scope(ui/out) / ruleRef 条款号 |
| 一致性检查 | 1 个分析 agent（与规则检查并行） | 只查需求文档内部矛盾（CONFLICT/AMBIGUOUS/INCOMPLETE），与基准对照解耦 |
| 汇总去重 | 确定性 + 1 个 agent | >15 条走 agent 归并（同根因标记），≤15 条走 exactDedup；scope=out 移附录不计统计 |
| 生成报告 | 确定性组装 + general agent 分片写 | head/详情分片(7000 字预算，最多 5 条)/tail 并行写，node 确定性拼接 |
| 报告审核 | 1 个审核 agent（fast 档跳过） | 不通过则 1 个修正 agent，硬约束"保持统计与 ID 不变" |
| 生成Dashboard | 1 个 general agent | 执行 build-dashboard.mjs 生成 HTML |

模型策略：提取/检查/归类用 `biangfeng-gateway/deepseek-v4.1-flash-official`（快模型），写盘/合并用 general 会话默认，并发默认 16。

### 产物隔离设计（重要）

- extract/full 的基准写 `{outDir}/rules/{rulesName}/`（workflow 产物目录）
- check 默认读 **skill 固化基准** `.claude/skills/ui-interaction-prd-extract/references/rules/hzmj_ui_interaction`
- check 可传 `args.rulesDir` 指向任意基准目录（包括上次 full 的产物）

## 二、问题 1：为什么每次 full 都要重新分析代码和 FGUI？

**设计动机（从代码读出）**：

1. **基准是代码快照**。客户端代码（input-ui/）会随版本更新，full 每次重提保证"标尺 = 当前代码事实"；check 复用的固化基准是上次快照，代码变了标尺就过期
2. **标尺稳定性**。extract 产物与 skill 固化基准隔离，重跑不会静默改标尺——否则两次 check 的对照基准不同，报告之间不可比
3. **幂等一条龙**。full 不依赖上次 extract 产物是否存在，单命令可重复运行

**代价**：代码没变时，重提 = 8 个 general agent 重读 149 个代码文件，纯浪费 token 与墙钟。

**现有缓解手段（已内置，不用改代码）**：

```bash
# 代码没变时，不要跑 full：
# 方式一：复用 skill 固化基准
/workflow ui-interaction-prd-extract { "mode": "check", "fast": false }
# 方式二：复用上次 full 的产物基准
/workflow ui-interaction-prd-extract { "mode": "check", "rulesDir": "examples/ui-interaction-prd-extract-workflow/rules/hzmj_ui_interaction" }
```

**根治方向（需改 workflow，当前不动）**：给 extract 加"新鲜度门"——每次提取时把代码指纹（文件清单 + 大小）写进基准说明或独立 manifest，full 先对比指纹，一致则跳过提取直接复用已有基准。

## 三、问题 2：rule 感觉不全（实证成立）

用 analyze-rule-coverage.js 核对：基准文本（锚点 + 正文）提及的代码文件 vs 42319 全集：

| 指标 | 数值 |
|---|---|
| 42319 代码 .ts 文件总数 | 149 |
| 基准提及的文件数 | 40（27%） |
| 其中 FGUI 自动生成声明 `fgui_uideclare/*.d.ts` | 85 个（无行为逻辑，合理排除） |
| 逻辑文件（剔除 .d.ts）约 | 64 个，覆盖 40/64 ≈ **62%** |
| 基准条款总数 | 146 条 |

**未覆盖的逻辑文件集中在**：

1. `controller/cmd/gameCmd` 16 个命令处理器：GameChowCmd（吃）/ GamePungCmd（碰）/ GameKongCmd（杠）/ GameReplaceCmd / GameSpecf*Cmd 等——多数是数据搬运，UI 事实密度低，但吃碰杠命令里可能藏"发协议后的界面预期"
2. **音效系统**：gameSoundController.ts、GameSoundConfig.ts——8 个主题里没有音效主题，基准仅 3 处顺带提及音效（倒计时/发牌）
3. **埋点统计**：GameThinkDataAnalyticsConfig.ts——基准 0 提及
4. **聊天/语音/表情**：player 包 Chat*/Voice*/Micro* 组件——基准 0 提及
5. 其他：PlayerCardsData、BoxHzmjCardDownView（出牌区视图）、GameGlcProtocol 等

### 根因（按证据强度排序）

1. **主题清单是写死的 8 个**（DEFAULT_THEMES），横向系统（音效/埋点/聊天/设置）没有主题；扫描器按语义归组，主题外的文件自然落榜
2. **FGUI 工程实际没被利用**：fguiDir 参数、扫描要求返回 fguiPackages 都在，但基准文本 0 次提及任何 XML/包——FGUI 的界面结构信息（组件树、按钮清单、文本内容）完全没进基准
3. **无"文件认领完整性"校验**：扫描返回了 clientFiles 全集，但没有任何环节验证"每个文件都被某主题认领"；未认领文件静默丢失
4. cmd 类文件部分是主动取舍（数据搬运 UI 事实少），但缺一个显式的"排除清单"，无法区分"有意排除"与"遗漏"

**影响链**：基准盲区 → 检查时无标尺 → 对应交互的 PRD 问题变成**假阴性**（查不出）。实证：PRD 版报告的 P0"缺埋点"（PRD-006）在 UI 交互路就没有对应基准条款支撑，靠一致性检查与 PRD 版兜底。

## 四、改进建议（按优先级，本次均不动代码）

| 优先级 | 改进 | 改哪里 | 效果 |
|---|---|---|---|
| P1 | 扩充主题清单补齐横向系统 | 先用 `args.themes` 传音效/埋点/聊天主题跑一次 extract（不改代码即可验证） | 基准盲区收敛 |
| P1 | extract 后加文件认领校验 | workflow js：对照 clientFiles 与主题 codeFiles 并集，未认领文件 log 警告 | 遗漏从"静默"变"可见" |
| P2 | FGUI 改读 package.xml + 组件 XML | workflow js：提取 prompt 的 fguiFiles 给真实 XML 路径 | 界面结构进基准 |
| P2 | 基准新鲜度门（问题 1 根治） | workflow js：代码指纹对比，一致跳过提取 | full 不再重复提取 |
| P3 | 基准说明带覆盖统计 | workflow js：00-基准说明 自动带 clientFiles 认领率 | 覆盖度可审计 |

**与 rule-checklist 需求的联动**：本次覆盖度分析正是 rule-checklist 需求（检查覆盖汇报）的延伸——覆盖清单不仅要报"查了多少"，也要暴露"基准本身漏了什么"，否则通过率会被基准盲区虚高。
