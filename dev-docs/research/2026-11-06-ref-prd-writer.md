# 参考项目研究笔记：prd-writer

- 研究日期：2026-11-06
- 研究对象：`thirdparties/prd-writer`（只读，未修改任何文件）
- 固定 commit：`45ab5a8221877644c74cb252014354f4746d4744`（2026-10-23，与 `thirdparties/REFERENCES.md` REF-003 登记一致）
- License：MIT
- 项目地址：https://github.com/cnhx/prd-writer.git

## 一、项目概况

prd-writer 是一个面向多产品类型的 PRD 写作技能包（Claude Code Skill 形式，纯 Prompt + Python 辅助脚本，无运行时服务）。核心由 6 个子技能组成：

| 子技能 | 位置 | 职责 |
|---|---|---|
| `/write-prd` | `write-prd/SKILL.md` | 主工作流：5 阶段（上下文加载 -> 产品类型路由 -> 追问 -> 起草 -> 审查发布），含 HTML 导出与交互原型生成 |
| `/prd-split` | `prd-split/SKILL.md` | 把统一 PRD 按受众拆分为 GDD/TDD/Art/BD 等文档，带结构化需求表 |
| `/prd-score` | `prd-score/SKILL.md` | 对 PRD 做 Ready-to-Dev 量化评分 |
| `/grill-me` | `grill-me/SKILL.md` | 对想法/草稿做高强度质询 |
| `/prd-refine`、`/opus-prd-polish` | 同名目录 | 快速修订与终稿润色 |

产品类型路由支持 7 种（`game_interactive`、`ai_agent`、`b2b_saas_ops` 等），每种类型有不同的默认章节侧重、追问清单、拆分文档包和图示建议。Markdown 是唯一事实源，HTML/交互原型均为导出产物。

与游戏直接相关的特性：`game_interactive` 类型专属的 GDD/TDD/Art & Audio/BD & Marketing 拆分包、状态机图与线框图（Mermaid）生成、以及单帧交互原型（HTML Mockup）导出。

## 二、固定问题逐条回答

### 问题 1：游戏 PRD 的章节结构是什么？

**结论：固定的 14 章节骨架 + 文档头部元数据 YAML 块。**

14 个必需章节定义在 `write-prd/SKILL.md` 的 Phase 3 "Required sections"：

| 序号 | 章节 | 游戏语境含义 |
|---|---|---|
| 1 | Summary | 摘要 |
| 2 | Project positioning | 项目定位 |
| 3 | Market strategy | 市场策略 |
| 4 | Gameplay or product flow | 玩法/产品流程（核心章节） |
| 5 | Functional requirements | 功能需求（变量/状态/事件定义） |
| 6 | Art and design requirements | 美术与设计需求（含线框图） |
| 7 | Math or business model | 数学模型/商业模式（如 RTP、赔付结构） |
| 8 | Compliance and risk | 合规与风险 |
| 9 | Technical considerations | 技术考量（只写产品侧约束与工程待确认问题） |
| 10 | KPI and success metrics | KPI 与成功指标 |
| 11 | Milestones | 里程碑 |
| 12 | Assumptions | 假设（主动 stance，48h 内确认） |
| 13 | Non-goals | 非目标（防范围蔓延） |
| 14 | Sources | 信息来源 |

关键证据：

- `write-prd/SKILL.md` Phase 3：章节命名可按产品类型适配（如非游戏产品第 4 章可改为 "Product Flow"），但"保持 14 章节形状"以便 `/prd-score` 评分。
- 文档头部（H1 之后、正文之前）是多个独立 YAML 围栏块，示例见 `examples/sample-output-prd.md` 第 5-33 行：`product_type`、`output_profile`、`research_pack`（证据表）、`out_of_scope`（范围外清单）、`diagrams_generated`（已生成图示索引）。这些元数据供 `/prd-score` 与 `/prd-split` 机器读取，不面向读者。
- 拆分映射：`prd-split/SKILL.md` 的 "Game Section Mapping" 表定义了 14 章节到 4 份受众文档的归属（primary 全文 + 需求表 / secondary 一段摘要 + 回链 / crosscutting 原样复制），例如第 4/5/7 章归 GDD primary，第 9 章归 TDD primary，第 6 章归 Art & Audio primary。
- 强制写作规则（`write-prd/SKILL.md` Phase 3.1.x）：复杂条件收敛为决策表（3.1.6）、每个核心流程必须有正常/异常路径覆盖（3.1.7）、自造术语必须配失败示例（3.2）、实现细节降级为产品契约（3.1.5）。

### 问题 2：HTML 导出是单文件还是多文件，数据如何嵌入？

**结论：按文档粒度"一份 Markdown 对应一个自包含 HTML"，多文档时用相对链接互跳；单个 HTML 内部数据以"转换后的 HTML 标记 + Mermaid 源文本"直接内联，无 JSON 数据层。**

单文件性证据：

- 主路径是随技能附带的确定性 Python 渲染器：`scripts/prd-to-html.py`（入口，185 行）调用 `scripts/prd_html_theme.py` 的 `build_html()`（1856 行，主题与排版全部在此）。
- CSS 全量内联：`prd_html_theme.py` 第 1805 行 `<style>{CSS}</style>`，无任何外部 CSS 文件。
- 仅有两类外部 CDN 依赖：Google Fonts 字体（第 889-891 行）与 pinned `mermaid@11` JS（第 898 行，仅当文档含 Mermaid 图时注入）。离线时字体回退系统字体、Mermaid 图不渲染，正文仍完整可读。
- 多文件场景：若执行了受众拆分（Phase 5.5），则主 PRD 与每个拆分文档各生成一个 HTML，放在同一目录，通过 `--cross-doc` 参数传入 JSON 数组 `[{title, href, active}]` 生成顶部跨文档导航条（`prd-to-html.py` 第 92 行参数定义、第 131-141 行校验；`write-prd/SKILL.md` Phase 5.6 第 4 步给出双向互链的调用示例）。文件之间是超链接关系，不是单文件聚合。

数据嵌入方式证据：

- Markdown 正文经 python-markdown 转成 HTML 标记内联进页面；Mermaid 围栏在预处理阶段被抽为数组占位符（`prd_html_theme.py` 第 1164、1255-1260 行），后处理时 `html.escape` 后回填为 `<pre class="mermaid">` 文本块（第 1454-1459 行），由浏览器端 CDN JS 读取 textContent 渲染成 SVG。即：图是"源码文本 + 运行时渲染"，不是预渲染图片，也不是 JSON 数据。
- 工具链元数据（frontmatter 与首个 H2 前的 YAML 块）默认从 HTML 中剔除，`--show-meta` 才渲染为卡片（`prd-to-html.py` 第 83-84 行、`prd_html_theme.py` 的 `--show-meta` 逻辑）。Markdown 源文件永远不为导出而修改。
- 有一个兜底：`write-prd/SKILL.md` Phase 5.6 "Fallback path" 规定 Python 依赖不可用时由 Agent 手写 HTML，规则同样要求 CSS 内联、Mermaid 走 CDN、file:// 可直接打开。
- 附带 QA 自检回路：`scripts/prd-html-qa.mjs`（零 npm 依赖，Node 22 + 本地 Chrome CDP）对每份导出 HTML 做 4 种视口截图与布局/对比度/交互检查，按 `references/html-visual-rubric.md` 八维度打分，最多修补 3 轮（`write-prd/SKILL.md` Phase 5.6 第 7 步）。

交互原型（Mockup）的文件形态见问题 3，同样是零外部引用的单文件（实测 `examples/sample-output-prd-mockup.html` 中外部 http 引用数为 0，441 行，CSS/JS 全内联）。

### 问题 3：交互原型如何与需求绑定？

**结论：不是数据驱动绑定，而是"从 PRD 第 4/5/6 章人工（Agent）派生 + 页面内双向标注"的轻量追溯：状态徽章显示 PRD 定义的变量枚举值，来源面板直接引用 PRD 章节号。**

绑定链路证据：

1. 触发前置条件：`write-prd/SKILL.md` Phase 5.7 规定只在 PRD 的第 4 章（流程）、第 5 章（功能需求）、第 6 章（设计需求）描述了多屏/多状态时才提供 Mockup 生成；生成前先从这三章提取"屏幕/状态清单"给用户确认。
2. 原型结构：单设备框（手机 340x600 或桌面 960x600）+ 每个状态一个绝对定位图层，点击交互元素调用 `go(stateName)` 切换（`write-prd/SKILL.md` Phase 5.7 "Core principle" 表格）。示例实现见 `examples/sample-output-prd-mockup.html`：7 个状态（idle/betting/countdown/climbing/cashedout/crashed/settling）对应 PRD 第 4 章 stateDiagram 的状态机。
3. 显式追溯标注（核心绑定机制），`examples/sample-output-prd-mockup.html` 第 392-398 行的 `stInfo` 表：
   - 每个状态携带 `tag` 字段，显示的正是 PRD 第 5 章 Functional Requirements 定义的变量枚举值，如 `round_state: idle`、`cashout_state: failed`（变量名与枚举值一一对应，状态徽章随点击切换实时更新）；
   - 每个状态携带 `src` 字段，直接写 PRD 章节引用字符串，如 `'PRD §4 — Gameplay Flow'`、`'PRD §4 + §6 — Main Screen'`，渲染在原型下方的来源面板（info panel）中；
   - 原型副标题也标注整体来源：`Source: PRD §4, §5, §6`（第 157 行）。
4. 流程条（flow bar）按 PRD 状态机顺序排列全部状态节点，支持任意跳转，供评审对照；All Screens Overview 视图以缩略图网格总览全部状态。
5. 绑定的边界：原型中的余额、倍率爬升等数值是 JS 随机模拟（第 421-435 行 `startClb()`），仅演示体验节奏，不承载 PRD 第 7 章数学模型的真实参数；需求表 ID（如 `GDD-4-001`）并未出现在 Mockup 中，追溯到章节粒度而非条目粒度。

另一条相关链路：`prd-split/SKILL.md` Phase 2 把 PRD 章节文本抽取为结构化需求表，ID 规则 `{PREFIX}-{SECTION}-{SEQ}`（如 `GDD-4-001`），Priority 从 must/必须/should 等语言信号推断，这使 PRD -> 受众文档之间是条目级可追溯的（source_prd 章节号编码在 ID 里）；而 PRD -> Mockup 之间是章节级可追溯的。两者共同构成需求追溯体系。

## 三、对 Interactive Game PRD 项目的可借鉴点

1. **14 章节骨架 + 元数据与正文分离**。固定章节让评分与拆分有稳定锚点；工具链元数据（product_type、out_of_scope、diagrams_generated 等）用 YAML 块写在文档头部、机器可读但读者默认不可见，这个模式直接适用于我们的 PRD 模板设计。
2. **章节到受众文档的映射表**（`prd-split/SKILL.md` Game Section Mapping）。用 primary/secondary/crosscutting 三种处理方式声明每章节在 GDD/TDD/Art/BD 中的归属，避免每份受众文档重复全文，是"一份事实源、多视角输出"的干净实现。
3. **需求 ID 体系** `{PREFIX}-{SECTION}-{SEQ}` + 语言信号推断 Priority。章节号编码进 ID，天然可追溯；配合"抽取规则"（祈使句/状态声明/量化阈值算一条需求）可把叙述性 PRD 收敛为验收可用的需求表。
4. **Mockup 的追溯标注方式**。状态徽章复用 PRD 第 5 章的变量名与枚举值、info panel 标注来源章节，成本低但让原型始终可回溯到需求；"从第 4/5/6 章提取状态清单 -> 用户确认 -> 再生成"的两步流程值得沿用。
5. **范围边界元数据**：`out_of_scope`（引擎选型、支付通道等 8 类可勾选项）与 `implementation_detail_level: semantic_contract_only`（禁止 PRD 预设技术栈/表结构/部署拓扑，只写产品契约），并把违反边界的句子降级改写的规则表（Phase 3.1.5）。对游戏 PRD 尤其有用——美术需求隔离在第 6 章、数学模型隔离在第 7 章的纪律。
6. **导出产物的自检回路**：截图 QA 脚本 + 八维度 rubric + 最多 3 轮修补，把"生成后人眼看一眼"变成结构化闭环。
7. **异常路径覆盖清单**（Phase 3.1.7：权限拒绝/重复提交/超时/部分成功/回滚等 10 类）可直接改造为游戏流程（断线重连、重复领奖、局中退出）的异常覆盖清单。

## 四、三档结论及理由

### 复用代码（可少量、需保留 MIT 版权声明）

- `scripts/prd-to-html.py` + `prd_html_theme.py`（Python Markdown -> 自包含 HTML 渲染器）：如果我们需要"PRD Markdown 导出可读 HTML"能力，这是现成的确定性渲染器，依赖仅 markdown+pyyaml，MIT 允许复用。但注意它偏通用文档排版（三栏 editorial 风），不是游戏特化，且 Mermaid 依赖 CDN，离线场景图不渲染。
- `scripts/prd-html-qa.mjs`：零依赖的 HTML 视觉 QA 脚本，若我们做 HTML 导出可直接配套复用。
- 结论理由：这两块工程质量较高（BOM 处理、锚点兼容中文、元数据防误读等细节见 CHANGELOG 0.14.0/0.15.x），重写不划算；但引入时机应等我们的 HTML 导出需求明确后再定，当前阶段不动。

### 借鉴思想（重点吸收，按我们的技能形态重写 Prompt）

- 14 章节骨架、章节映射表、需求 ID 体系、Mockup 状态清单两步确认 + 章节/变量追溯标注、out_of_scope 与 implementation_detail_level 边界控制、异常覆盖清单、术语必须配失败示例、假设与开放问题分离、拒稿信（Rejection Letter）预演。
- 结论理由：prd-writer 的本体是 Prompt 方法论（SKILL.md），这部分无法也不必直接"复用代码"——我们需要按 Interactive Game PRD 的定位（游戏特化、中文语境、与 BMad Game Dev Studio 方法论对齐）重写；但其结构化追溯与范围纪律是通用最优实践，直接吸收。

### 不采用

- **7 产品类型路由中的 6 种非游戏类型**（ai_agent/b2b_saas_ops 等）：与本项目"面向游戏开发"的定位无关，引入只增加 Prompt 体积与路由歧义。
- **Mockup 的"数据模拟"部分**（随机倍率、假余额）：仅作演示观感，与我们后续可能采用的 Arrow 式"真实逻辑可玩原型"（见 REF-004 研究方向）定位冲突，不值得跟进。
- **Mermaid CDN 运行时渲染**作为最终方案：离线不可用、版本钉死在 mermaid@11 有供应链面；若我们做 HTML 导出，应评估预渲染或本地化资源，而不是照搬。
- **受众拆分默认开启**（Phase 0.4 默认 ON）：对小型游戏项目产生 4 份文档 + INDEX 的维护负担，应改为显式 opt-in。

## 引用文件清单（证据路径汇总）

| 证据 | 路径（相对 `thirdparties/prd-writer/`） |
|---|---|
| 14 章节定义、元数据块、Mockup 规则、HTML 导出流程 | `write-prd/SKILL.md`（Phase 3 / 3.1.x / 5.6 / 5.7） |
| 游戏章节映射、需求 ID 与抽取规则 | `prd-split/SKILL.md`（Game Section Mapping / Phase 2） |
| HTML 渲染入口与跨文档导航参数 | `scripts/prd-to-html.py` |
| CSS 内联、Mermaid 抽取与回填、CDN 引用 | `scripts/prd_html_theme.py`（第 889-898、1164、1255-1260、1454-1459、1805 行附近） |
| 游戏 PRD 示例（元数据块 + 14 章节实例） | `examples/sample-output-prd.md` |
| 交互原型示例（stInfo 追溯表、零外部引用） | `examples/sample-output-prd-mockup.html`（第 157、392-398 行） |
| GDD 拆分示例（GDD-4-001 需求表） | `examples/sample-split-gdd.md` |
| 渲染器演进与 QA 回路说明 | `CHANGELOG.md`（0.14.0 / 0.15.0 / 0.15.1） |
| 登记信息与固定 commit | `thirdparties/REFERENCES.md`（REF-003） |
