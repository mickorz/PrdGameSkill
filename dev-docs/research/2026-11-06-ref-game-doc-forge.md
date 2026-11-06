# 调研笔记：game-doc-forge 的 Interview Ledger、Open Questions 与 Audit 机制

- 调研日期：2026-11-06
- 调研对象：`E:/WorkProjects/PrdGameSkill/thirdparties/game-doc-forge`（只读，未修改任何文件）
- 调研目的：为 Interactive Game PRD 项目（需求抽取与人工审查机制）寻找可借鉴的设计
- 项目性质：纯 Markdown 提示词工程（Claude Code / Codex 插件），无可执行运行时代码

---

## 一、项目概况

game-doc-forge（命令名 `gdd`）是一个把游戏点子变成 Game Design Document（GDD）的多阶段流水线插件。整条流水线由 Claude Code / Codex 的编排提示词驱动：

```
概念访谈（决定游戏家族分叉）
  -> 分叉深访（电子游戏 14 模块 / 桌游 16 模块，quick/standard/comprehensive 三档深度）
  -> 可选的网络调研（瞄准账本中的 open 项）
  -> 按家族模板写 GDD
  -> 审计（追溯性与完整性）
  -> 人工审查 checkpoint
  -> 补充文档、索引、HTML 阅读版
```

关键设计哲学（README.md 原文）："A ledger, not a transcript"——不是保存对话记录，而是把每个问题变成一条带状态的账本行。GDD writer 不得写账本不支持的内容，auditor 负责核查。

目录结构与角色分工：

| 路径 | 作用 |
|------|------|
| `skills/create/SKILL.md` | 总编排：17 个 stage、6 个人工 checkpoint、角色分发规则 |
| `skills/resume/SKILL.md` | 会话恢复、回答 open questions、修订、扩展访谈 |
| `skills/status/SKILL.md` | 只读进度报告 |
| `templates/interview_protocol.md` | 三个交互角色共用的访谈方法论（问法、答题处理、账本格式） |
| `templates/state_template.json` | `state.json` 的 schema（阶段、checkpoint 决策、访谈计数） |
| `agents/interview-video-game.md` 等 15 个角色文件 | 各阶段的角色提示词 |
| `docs/commands.md` | 命令与 checkpoint 参考 |

运行时产物落在 `.gdd/sessions/<project>/` 下：`state.json`、`interview-ledger.md`、`concept.md`、`details.md`、`GDD.md`、`gdd-audit.md` 等。访谈类角色（要与用户对话）在主会话 inline 运行；其余角色作为 subagent 分发，且分发时被明令禁止向用户提问——无法决定的事项写进返回摘要，由编排者在下一个 checkpoint 提给用户。

交互角色全部遵守同一份 `templates/interview_protocol.md`，其 8 条原则中与本调研直接相关的有：

1. 一题一决策，绝不捆绑两个不相关决策；
2. Ask, do not assume——设计者没说过的就不是已决定的，必须补洞时记为带理由的 assumption，绝不记为事实；
3. 已回答过的问题绝不重问；每 2-3 个模块向用户回放摘要并问"有错吗"。

---

## 二、固定问题逐条回答

### 问题 1：Interview Ledger（决策账本）记录什么、结构如何？

#### 1.1 记录什么

Interview Ledger 是概念访谈与深度访谈两个阶段所有问题-答案的**单一事实源**（single source of truth），落盘为 `.gdd/sessions/<project>/interview-ledger.md`。它不是对话转录，而是决策账本：每一行代表一个决策点，且每行必须有一个明确状态。

证据：`templates/interview_protocol.md` 第 5 节 "The ledger"（"Maintain `interview-ledger.md` in the session directory... The ledger is the single source of truth that the GDD writer and auditor trace against"）；`docs/commands.md` "The Interview Ledger" 一节（列出了每列的含义）。

#### 1.2 五种行状态

`templates/interview_protocol.md` 第 3 节 "Answer handling" 定义了每题除真实答案外允许的元答案及其状态映射：

| 设计者说 | 账本状态 | 处理方式 |
|---------|---------|---------|
| 真实回答 | `decided` | 逐字记录（轻度清理）；回答含糊时先追问一次再接受 |
| "你来定" / "挑个合理的" | `assumed` | AI 提出具体选择并附一行 rationale（挂钩设计支柱或同类游戏），当面复述后记为 assumed；设计者此后任何时刻可推翻 |
| "跳过" / "不相关" | `skipped` | 记录不适用的原因，不再问 |
| "以后再说" / "还不知道" / "要试玩才知道" | `open` | 记录问题及已有部分想法；open 项在访谈结尾集中浮出，喂给调研计划，并进入 GDD 的 Open Questions 附录 |
| 改变早前决定的答案 | 新 `decided` 行 | 旧行状态改为 `superseded`，指向新行，并当面说明变化 |

两条硬纪律（同节原文）："Never leave a question with no status. Never silently invent an answer."——不允许任何问题没有状态；不允许静默编造答案。

#### 1.3 文件结构

`templates/interview_protocol.md` 第 5 节给出了完整 Markdown 格式模板：

- **头部元信息**：Role（VG / TT）、Depth（quick / standard / comprehensive）、开始与最后更新时间戳；
- **Summary 表**：五种状态的行数统计；
- **Rows 表**：`| ID | Module | Question | Answer | Status | Notes |` 六列；
- **ID 规则**：`<前缀>-<模块号>-<题号>`，前缀 `CG`（概念访谈）/ `VG`（电子游戏访谈）/ `TT`（桌游访谈），编号两位零填充；已有行永不重编号；superseded 行保留原答案并在 Notes 写 `Superseded by <ID>`；
- **Answer 列**放设计者原话的精简版，长答案挪到 Notes 列或以行 ID 为锚点的表格下方子弹列表。

示例行（protocol 第 5 节原文示例）：

```
| VG-01-02 | 01 Platform and Business | Business model? | Premium, USD 19.99 | assumed | Designer said "you decide"; premium fits the 8-hour narrative scope and comparables (...) |
| VG-04-03 | 04 Difficulty and Onboarding | Difficulty options? | | open | Designer wants to playtest before committing; leaning toward three presets |
```

#### 1.4 写入时机与一致性保障

- **增量写入**：每完成一个模块（或每 10 题，以先到者为准）就把该模块的行追加落盘——中断最多丢失一个模块的进度（`templates/interview_protocol.md` 第 5 节；`skills/create/SKILL.md` Key behaviors 第 2 条）；
- **模块出口检查**：每个模块结束前跑该模块的 Exit check，未满足且未被跳过的出口项补问一题，然后把行追加进账本、把模块记入 `state.json` 的 `interview.modulesCompleted`（protocol 第 6 节）；
- **计数镜像**：Summary 表更新时同步镜像到 `state.json` 的 `interview.counts`（decided/assumed/open/skipped 四项），`/gdd:status` 直接读这组数；若全为零但账本文件存在，则现场按 Status 列重新数行（`skills/status/SKILL.md` 第 3 步）；
- **访谈收尾**：呈现覆盖率总结（已完成模块、各状态计数、open 与 assumed 全量清单两列），主动问"哪些假设要推翻？哪些 open 现在能答？"，再以三个固定收尾问题结束（"这份文档最必须答对的一件事是什么？""你对这个设计最担心什么？""有什么我没问到的但很重要？"），全部记入 `99 Closing` 模块；随后生成的 `details.md` 中每条叙述都必须能追溯到账本行（protocol 第 7 节）。

#### 1.5 账本的两个消费方

- **gdd-writer**（`agents/gdd-writer.md` Traceability rules 第 1、8 条）：每条规范性主张（游戏"是什么/做什么/有什么/将要做什么"）必须追溯到 decided 或 assumed 行；极端情况下必须补洞时，写最小陈述、打 `[Assumption: writer]` 标签、加入附录 B，并在返回摘要中上报让编排者提给设计者；
- **gdd-auditor**（`agents/gdd-auditor.md` Inputs）：以账本为事实源做双向追溯审计（详见问题 3）。

### 问题 2：Open Questions 如何管理？

Open Questions 不是一份静态待办清单，而是一条贯穿全流水线的**生命周期管理**：产生 -> 集中回放 -> 调研定向解决 -> 带置信度回写 -> 进文档附录带 owner -> 人工审查时回答 -> 完成后仍可续答。

#### 2.1 产生：显式化，不隐藏

- 访谈中的"以后再说/不知道"记为 `open` 行（`templates/interview_protocol.md` 第 3 节）；
- 因深度选择未问到的问题也显式成为 open question 而不是悄悄略过（`README.md`："everything not asked becomes an explicit open question"；quick 档定义"everything else assumed and flagged"）；
- writer 修订时若审计修复需要账本里不存在的设计决策，不发明答案，而是造 `WR-nn` 新 ID 转为 `[Open: ID]`，列入返回摘要让编排者补进账本并提给设计者（`agents/gdd-writer.md` Revision mode 第 2 条）。

#### 2.2 集中回放：访谈结尾的强制环节

访谈结束流程第 1、2 步（`templates/interview_protocol.md` 第 7 节）：呈现完整 open 与 assumed 清单，明确问设计者要推翻哪些假设、能现场回答哪些 open——在进调研和写作之前先收割一轮。

#### 2.3 调研定向：open 项是调研的最高价值目标

- `agents/research-planner.md`（第 22 行、第 82 行）："research that can close an open question or validate an assumption is the highest-value research this pipeline can do"。规划时先列出全部 open 行和 rationale 依赖事实性断言（市场规模、平台能力、历史准确性、同类游戏数字）的 assumed 行，逐条判断网络调研能否解决；能解决的做成调研 topic 并把账本 ID 记入 topic 的 **Resolves** 字段；需要试玩而非调研才能解决的，标注 "Cannot be resolved by research"；
- 优先级定义（同文件第 84-88 行）：能解决 open 账本行的调研直接为 HIGH。

#### 2.4 研究结果带置信度回写账本

`agents/research-vetter.md` 第 102-108 行定义 **Ledger Items Addressed** 表：

```
| Ledger ID | Question | Research answer | Confidence | Recommended status |
| [ID] | [open or assumed question] | [what research found] | High / Medium / Low | resolve as decided / keep assumed with better rationale / still open |
```

由编排者（而非 vetter 自己）在 GDD 写作前应用到账本：High 置信度的答案可记为 `decided` 并在 Notes 标 `Source: research`；置信度更低的保持 `assumed` 或 `open`。writer 被要求按编排者记录的结果精确执行，且永远不得把 Low 置信度结论当事实陈述（`agents/gdd-writer.md` Traceability rule 6）。

#### 2.5 进入 GDD 附录：带 Owner 与 Resolver

- GDD 模板附录 C "Open questions" 是一张五列表：`| Ledger ID | Question | Why it matters | Resolved by | Owner |`（`templates/gdd_template_video.md` 第 453-455 行）；
- writer 的规则（`agents/gdd-writer.md` Traceability rule 3）：open 行永远不得写成已决定；正文中相关位置打 `[Open: ID]` 标签；owner 未给时缺省为设计者本人；resolver 是解决途径的类型（playtest / research / prototype / decision）；
- 正文引用账本 ID 做交叉引用："cite ledger IDs in parentheses wherever a reader might want to check the source"（rule 7）——读者不需要账本也能读懂文档，但想核查来源时能查到。

#### 2.6 人工审查与完成后续答

- GDD_REVIEW checkpoint 提供专用选项 3 "Answer open questions now"：用访谈协议逐个走 open 账本行，更新账本与 `details.md`，然后像修订一样只改受影响章节（`skills/create/SKILL.md` stage 10）；
- 会话 COMPLETED 之后，`/gdd:resume` 仍提供 "Resolve open questions"：读出全部 open 行、按访谈协议逐个提问、更新账本和 details、以修订模式只重写受影响章节，再重跑审计与审查（`skills/resume/SKILL.md` "If `currentStage` is already `COMPLETED`" 分支）；
- `/gdd:status` 第 4 步：报告末尾简列 open items——"they are the design decisions still owed"，让用户知道 resume 会提出哪些问题。

### 问题 3：Audit（审查）流程是怎样的？

#### 3.1 在流水线中的位置与角色边界

审计是 Stage 9（`GDD_AUDIT`），紧跟写作（Stage 8），后接人工审查 checkpoint（Stage 10 `GDD_REVIEW`）。核心边界（`agents/gdd-auditor.md` Purpose）：

- 审计员**永不编辑 GDD.md**，只写 `gdd-audit.md` 报告，由编排者决定是否把 writer 打回；
- 角色定位是"做文档评审的怀疑论主设计师"："Assume the draft is wrong until each claim is shown to come from the designer"——假设草稿是错的，直到每条主张被证明来自设计者；
- 目的是在设计者评审草稿**之前**先拦截让人失去信任的失败模式：发明的决定、被静默丢弃的决定、与支柱矛盾的章节、套话填充、缺失覆盖。

#### 3.2 五遍扫描（Passes）

`agents/gdd-auditor.md` "Audit passes" 一节，五遍全跑：

**Pass 1 - Traceability（正向追溯）**：对 GDD 中每条规范性主张找来源，按账本行状态分档判定——

| 账本状态 | 判定 |
|---------|------|
| decided | 通过 |
| assumed | 仅当 GDD 标注（内联 `[Assumption]` 标签或附录 B 行）才通过，未标注即 finding |
| open | GDD 不得陈述决定，必须声明该问题开放并指向附录；写成已决定即 **Blocking** |
| skipped | GDD 应省略或明确排除该主题；出现编造内容即 finding |
| superseded | GDD 必须采用取代行的新答案；沿用旧答案即 **Blocking** |
| 无对应行 | writer 发明的；落在 Core 章节、支柱、机制、商业决策或平台相关内容即 **Blocking** |

采样策略：Core 章节全读；较长的 Optional 章节读每段首尾句加全部表格。

**Pass 2 - Reverse traceability（反向追溯）**：反过来走账本——每个 decided 行必须出现在 GDD 某处；每个 assumed 行必须出现在 Assumptions 附录；每个 open 行必须出现在 Open Questions 附录且带 owner 或解决触发条件；concept.md 中每条支柱必须逐字出现在 Design Pillars 章节。遗漏即 finding，并注明行 ID 和应归属的章节。

**Pass 3 - Completeness（完整性）**：对照家族模板的三档章节分级——Core 章节缺失/为空/残留模板占位符即 finding；Recommended 章节缺失而无一行"不适用的原因"即 finding；Optional 可静默缺席。再套用 `docs/gdd-best-practices.md` 的 coverage checklist，每个未勾选项都是 finding，除非账本显示该项被 `skipped` 且有理由。

**Pass 4 - Consistency and pillar alignment（一致性与支柱对齐）**：数字、名字、术语跨章节一致（玩家数、局时长、价格、资源名、单位名、阶段名）；每个主要系统指名它服务的支柱，与支柱相悖而无"张力"说明即 finding；"这个游戏不是什么"清单不得被文中任何地方违反；Scope/MVP 必须与 concept.md 的约束（团队、预算、时间线）一致；引用调研的陈述必须匹配综合报告的置信度（不得把 Low 置信度结论说成事实）。

**Pass 5 - Anti-patterns（反模式）**：带原文引用地标记——营销语言替代规格说明（"stunning visuals"）；账本有数字却写模糊量词（账本说 12 种敌人却写"大量敌人"）；账本已决定却写选项列表（"可以是 X 或 Y"）；填充性段落；设计章节混入制作任务（或反之）；重大决策缺 rationale（变现、平台、玩家数、核心判定机制、难度模型）。

#### 3.3 严重度分级与机器回流

三级严重度（`agents/gdd-auditor.md` "Severity" 一节）：

- **Blocking**：open 被写成已决定；使用了被取代的决定；Core 章节出现发明的规范性主张；缺失 Core 章节；支柱被直接矛盾；
- **Major**：未标注的 assumption；decided 行在 GDD 中缺失；跨章节的数字或名称不一致；checklist 缺口且无跳过理由；
- **Minor**：反模式文风、填充、非核心决策缺 rationale、格式问题。

回流机制（同节 + `skills/create/SKILL.md` stage 9）：出现至少一条 Blocking finding 时，编排者以修订模式重新分发 gdd-writer（附上审计文件），然后**再审计一次**；第二次审计后无论结果如何都进入 GDD_REVIEW，并把残留问题呈给设计者。人工审查 checkpoint 上修订轮次另有上限 3 轮，超限则建议批准后手工修改。复审报告要求列出哪些旧 finding 已修复、哪些仍在、有哪些新增，沿用原 finding ID。

#### 3.4 审计报告格式与审计员行为纪律

`gdd-audit.md` 的固定结构（gdd-auditor.md "Output format"）：头部含草稿字数/章节数、账本五状态计数、一句话结论（PASS 或 REVISE）；Summary 严重度计数表；按 B1/M1/N1 编号的 finding 列表，每条固定五要素——Section（所在章节）、Quote（**原文引用，禁止转述**）、Problem（违反哪一遍扫描的哪条规则）、Ledger（相关行 ID 或 none）、Fix（给 writer 的精确修改指令）；coverage checklist 表；反向追溯缺口表；Strengths 一节（2-5 条具体优点，让设计者知道什么该保留）。

行为纪律（"Behaviors" 一节）：引用不转述；一个问题一条 finding，不捆绑；**绝不提出新设计内容**——缺什么就说什么缺、该由设计者在哪决定；草稿够好就明确说 PASS 并保持报告简短，"不为显得彻底而制造 finding"。

#### 3.5 人机分工：机器初审 + 人终审

机器审计只解决"文档是否忠实于账本"，GDD_REVIEW checkpoint（`skills/create/SKILL.md` stage 10）解决"设计本身是否被认可"：呈现章节完成度、字数、成文支柱、3-5 个最重大的设计决策、带入附录的 assumption 与 open 计数、审计残留 finding（逐字、简短），给设计者四个选项——批准 / 要求修订（指定章节与改法）/ 现在回答 open questions / 暂停保存。此外 writer 在写文件前有 13 项 self-check 清单（`agents/gdd-writer.md` "Self-check"），构成"生产者前置自检 + 审计者独立验证 + 设计者终审"的三层质量闸门。

---

## 三、对 Interactive Game PRD 项目（需求抽取与人工审查机制）的可借鉴点

本项目要解决的核心问题与 game-doc-forge 高度同构：AI 通过多轮访谈从用户抽取需求，产出结构化需求文档，且必须保证"AI 不发明需求、文档可追溯到提问、人保留最终审查权"。以下按价值排序：

### 3.1 决策账本（最高价值）

把需求抽取的每一次问答落成带状态的账本行（ID / 问题 / 答案 / 状态 / 备注），五种状态（decided / assumed / open / skipped / superseded）精确区分"用户决定的、AI 代答的、待定的、不适用的、被取代的"。配合两条纪律：每题必有状态、绝不静默发明答案。这直接回应了 PRD 生成中最危险的失败模式——AI 把自己的默认选择混进用户需求里无法分辨。`[Assumption: ID]` / `[Open: ID]` 的内联标签 + 附录镜像的写法也值得照搬：读者在正文遇到任何存疑陈述都能立刻定位其来源行。

### 3.2 双向追溯审计

正向（文档每条规范性主张必须找到账本行）+ 反向（账本每行必须出现在文档某处）构成闭环，保证文档与账本互为镜像、无单向漂移。审计员角色三条纪律对 PRD 审查同样适用：只报告不修改；引用原文不转述；绝不提出新需求内容。PRD 项目的"人工审查"环节可以此为骨架：机器先按严重度分级初审，Blocking 自动回流（限次），Major/Minor 留给人做判断输入。

### 3.3 Open Question 的结构化管理

open 行不是模糊 TODO，而是五元组：问题本身 + 为什么重要 + 谁负责（owner，缺省即用户）+ 用什么方式解决（resolver：原型/调研/决策）+ 唯一 ID。调研阶段以"能否关闭一个 open 行"为最高优先级定向投放；调研结果带置信度回写（High 才允许转 decided），避免低质量网络结论污染需求。这个"调研瞄准 open items"的思路对 PRD 项目的市场/技术调研环节是现成的模板。

### 3.4 假设的显式化协议

用户说"你决定"时，AI 的正确动作是：提出具体选择 + 一行挂靠既有支柱/同类品的 rationale + 当面复述 + 记为 assumed + 声明可随时推翻。既不把负担甩回给用户，也不静默代劳。修订阶段产生的 writer 自创假设走独立命名空间（`WR-nn`）并强制上报，保证任何非用户来源的内容都有迹可查。

### 3.5 增量持久化与可靠恢复

账本按模块增量落盘（中断最多丢一个模块）、计数镜像到 state.json、resume 精确到"从第一个未完成模块继续且复用已有账本行"。PRD 访谈同样可能跨会话中断，这套"状态文件 + 增量账本 + 从断点续问"的组合是现成方案。

### 3.6 收尾三问

每次访谈固定以三问收束："这份文档最必须答对的一件事？""你最担心什么？""有什么我没问到的但很重要？"——低成本地兜住问题集覆盖不到的盲区，并天然把最大风险暴露为文档里的显式条目。PRD 访谈可直接复用（改为"这份 PRD 最必须写对的一件事"等）。

### 3.7 值得注意的一个反面经验

README 的升级章节提到：1.0 版会话没有账本，导致 2.0 的审计无账本可追溯，只能警告用户并建议补跑访谈。这说明账本必须从第一个问题就开始记，中途引入追溯机制会留下无法弥补的空洞——PRD 项目的账本设计应从 day one 覆盖全部问答。

---

## 四、三档结论

### 复用代码：无（可直接复用其文档模板）

game-doc-forge 是纯提示词插件（Markdown 角色文件 + 模板 + JSON schema），没有任何可执行运行时代码，不存在"复用代码"意义上的移植对象。可直接搬运的是**格式约定**：账本 Markdown 表格格式、`gdd-audit.md` 报告格式（finding 五要素、严重度分级）、`state_template.json` 的 schema 思路（阶段 + checkpoint 决策 + 计数镜像）。这些是抄格式即用，成本极低。

### 借鉴思想：核心采纳

以下思想应融入 Interactive Game PRD 的需求抽取与人工审查机制设计：

1. 决策账本五状态模型 + "每题必有状态、绝不静默发明答案"两条纪律；
2. 文档-账本双向追溯 + 独立只读审计角色 + Blocking/Major/Minor 分级回流（限次）；
3. 假设显式化协议（"你决定"的标准化处理 + rationale + 可推翻声明）；
4. Open Question 五元组（ID / 问题 / 重要性 / owner / resolver）+ 调研以关闭 open 项为最高优先 + 置信度门槛回写；
5. 增量落盘 + 状态镜像 + 断点续问；
6. 收尾三问；
7. 内联 `[Assumption: ID]` / `[Open: ID]` 标签 + 附录镜像的文档写法。

理由：这些机制与本项目"需求抽取 + 人工审查"的目标一一对应，且全部经过 game-doc-forge 2.0 的设计推敲（其 best-practices 文档表明每条机制都有 UX/文档工程文献支撑），移植的是经过验证的结构而非猜测。

### 不采用

1. **游戏领域特定内容**：14/16 个访谈模块、genre probes、电子游戏/桌游分叉、GDD 章节模板——与 PRD 需求域无关，只借鉴其"模块 + Exit check + [Q]/[S]/[C] 深度标签"的问题组织形式，不搬内容；
2. **家族分叉模板体系**：PRD 项目暂无"按产品家族选模板"的需求，YAGNI；若未来出现多产品类型再借鉴其 fork 思想；
3. **HTML 阅读版管线与补充文档体系**（supplements、index、html 三个 stage 及 5 个相关角色）：PRD 输出形态不同，暂无此需求；
4. **CG/VG/TT 三前缀 ID 体系**：PRD 有自己的阶段划分，账本 ID 前缀需按 PRD 阶段重新设计（如按抽取阶段而非游戏访谈模块编号）；
5. **research 三路并行子代理的完整管线**：PRD 项目若需调研，规模通常小于 GDD 全量调研，三路分工（历史/市场/技术）可简化。

理由：以上均为游戏文档生产这一具体场景的形态，直接搬入会造成与 PRD 域不匹配的结构负担；其底层思想已由"借鉴思想"一档覆盖。

---

## 引用说明

本笔记所有结论均来自对以下源文件的直接阅读（路径相对 `E:/WorkProjects/PrdGameSkill/thirdparties/game-doc-forge/`）：

- `README.md`（流水线总览、"A ledger, not a transcript" 哲学、1.0 升级经验）
- `templates/interview_protocol.md`（访谈原则、三档深度、答题状态映射、账本格式与写入时机、访谈收尾）
- `templates/state_template.json`（state.json schema、checkpoint 结构、interview.counts）
- `templates/gdd_template_video.md`（附录 A-F 结构，尤其附录 B Assumptions、附录 C Open questions 五列表）
- `agents/gdd-auditor.md`（五遍扫描、三级严重度、报告格式、审计员行为纪律）
- `agents/gdd-writer.md`（Traceability rules 1-8、self-check 清单、revision 模式与 WR-nn 机制）
- `agents/interview-video-game.md`（模块表、Exit check、[Q]/[S]/[C] 标签体系）
- `agents/research-planner.md`（open/assumed 行驱动的调研规划、Resolves 字段、优先级定义）
- `agents/research-vetter.md`（Ledger Items Addressed 表、置信度回写规则）
- `skills/create/SKILL.md`（17 stage 编排、GDD_REVIEW checkpoint 四选项、修订轮次上限、分发角色禁止向用户提问）
- `skills/resume/SKILL.md`（断点恢复、COMPLETED 后的 Resolve open questions）
- `skills/status/SKILL.md`（进度报告格式、open items 提示）
- `docs/commands.md`（账本列定义）

上游项目地址：`github.com/MisterVitoPro/gdd`（game-dev-2d marketplace 的一部分，MIT License，已登记于仓库 `thirdparties/REFERENCES.md` 管理体系）。
