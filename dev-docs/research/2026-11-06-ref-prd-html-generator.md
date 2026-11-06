# prd-html-generator 只读研究笔记

> 研究对象：`thirdparties/prd-html-generator`（REF-002，Apache-2.0，Submodule 固定 commit `5b40d5a`）
> 研究日期：2026-11-06
> 研究方式：只读，未修改该目录任何文件
> 固定研究问题：1) PRD 抽屉如何组织内容；2) 锚点定位用什么机制；3) HTML 模板结构如何

## 一、项目概况

prd-html-generator 是一个面向后台产品的 Claude Skill / Codex Skill，定位为"交互原型生成器"：输入一句页面需求、截图或页面描述，一次性产出两份对齐的交付物——单文件 HTML 交互原型 + 结构化 Markdown PRD，并在原型内内置 PRD 预览抽屉与"PRD 条目点击定位页面区域"能力。

关键事实：**该仓库不含任何可执行程序代码**。整个"生成器"由三份纯文本资产构成，生成动作完全由 AI 按 SKILL.md 指令执行：

| 文件 | 作用 |
| --- | --- |
| `SKILL.md` | Skill 核心指令：触发条件、生成流程、动态布局规则、锚点定位规则、质量 Checklist（约 250 行） |
| `assets/style04_template.html` | 单文件 HTML 模板：内联 CSS + 内联 JS，含完整抽屉与定位交互实现，内容用 `{{占位符}}` 标注 |
| `references/prd_template.md` | Markdown PRD 模板：固定章节 + 动态章节，含"PRD 定位 ID"列 |
| `agents/openai.yaml` | 工具界面展示信息（display_name / default_prompt） |

输出约定（`SKILL.md`、`README.md`）：默认输出到 `prd-html-output/YYYYMMDD/html/YYYYMMDD-<page-slug>.html` 与 `prd-html-output/YYYYMMDD/prd/YYYYMMDD-<page-slug>-prd.md`，两份文件同步生成。

视觉规范 style04：渐变 Header、`#ff6b6b` 主按钮、`#f8f9fa` 筛选区、胶囊状态标签、右侧滑入 PRD 抽屉、虚线描边 + 呼吸高亮。

## 二、固定问题逐条回答

### 问题 1：PRD 抽屉（drawer）如何组织内容

实现位置：`assets/style04_template.html`（DOM 结构 + CSS + JS），规范来源：`SKILL.md` 的 "Required PRD preview interaction" 一节。

**DOM 结构**（`style04_template.html` body 末尾）：

- `#prd-overlay`：全屏半透明遮罩（`rgba(0,0,0,0.42)`），点击即关闭抽屉。
- `aside#prd-drawer`（class `prd-drawer`）：右侧抽屉本体，`position: fixed; top: 0; right: 0`，宽度 `min(600px, 100vw)`，通过 `transform: translateX(100%)` 隐藏、加 `.open` 类后 `translateX(0)` 滑入（transition 0.26s）。抽屉自身也带 `data-prd-target="prd-drawer"`，即抽屉自身也是一个可定位区域。
- 抽屉内部三段：
  1. `.prd-drawer-header`：渐变头部（135deg，`#5352ed` 到 `#ff6b6b`），标题"PRD 需求说明文档"，副标题 `{{页面名称}} · {{版本号}} · {{创建日期}}`，右上角圆形关闭按钮。
  2. `.prd-drawer-tools`：sticky 吸顶工具条（`position: sticky; top: -22px` + 毛玻璃背景），预置三个操作按钮："高亮全部交互区"、"关闭高亮"、"定位页面标题"。
  3. `.prd-content#prd-content`：内容区，`flex: 1; overflow-y: auto` 独立滚动，不影响底层页面；内有 h1/h2/h3/表格/code/pre 的专属排版样式（h2 带左侧 4px 紫色竖条）。

**内容组织方式——每次打开时动态注入，而非预渲染**：

- `openPrdDrawer()` 在每次打开时执行 `document.getElementById("prd-content").innerHTML = 工具条 + generatePrdContent()`，即抽屉内容由 JS 模板字符串函数生成。
- `generatePrdContent()` 模板体只含 `{{PRD_HTML内容}}` 占位符，另附 HTML 注释示例说明"PRD 章节中的功能说明可插入定位按钮"。也就是说：**AI 在生成 HTML 时，需把 Markdown PRD 的章节手工转成 HTML 片段填进该函数**，抽屉内容与落盘的 `.md` PRD 是同一内容的两种渲染形态，靠人工（AI）保证一致，而非程序化转换。
- 定位按钮以行内 onclick 混排在 PRD 内容里，例如：`<button class="prd-region-link" type="button" onclick="focusPrdTarget('filter-section')">定位筛选区</button>`（`prd-region-link` 为胶囊链接样式，`#5352ed` 文字 + 淡紫底）。

**关闭三通道**：右上角关闭按钮、点击遮罩、`document` 级 `keydown` 监听 `Escape`（ESC 同时会关闭所有打开的 modal）。打开时 `body.style.overflow = "hidden"` 锁背景滚动，关闭时恢复。

**PRD 侧约束**（`SKILL.md`）：抽屉内容必须与落盘 PRD 逐章一致；每个有对应页面区域的 PRD 条目都要渲染一个定位按钮；没有对应页面区域的 PRD 章节不得加定位链接。`references/prd_template.md` 的 3.N 节也以表格形式描述抽屉的入口、展示方式、内容来源、关闭方式、滚动规则、区域定位。

### 问题 2：锚点定位用什么机制

实现位置：`assets/style04_template.html`（CSS 约 `[data-prd-target]` 相关规则 + `focusPrdTarget` 等三个函数）；规范来源：`SKILL.md` 的 "Required PRD-to-prototype navigation" 一节。

**ID 命名规则——不是 DOM id，而是 data 属性**：

- 页面上每个有意义的可交互区域挂两个属性：`data-prd-target="<stable-id>"` 和 `data-prd-label="<中文区域名>"`。定位查找用 `document.querySelector('[data-prd-target="..."]')`，不依赖元素 id，与 DOM 结构解耦。
- stable-id 用稳定 kebab-case，模板内置示例：`page-header`、`action-bar`、`filter-section`、`table-list`、`pagination`、`create-edit-modal`、`detail-modal-target`、`delete-confirm-modal`、`prd-drawer`。SKILL.md 另给出 `metric-cards`、`approval-actions`、`step-basic-info` 等示例。
- 弹窗外层遮罩额外挂 `data-prd-container="<id>"`（与元素 id 一致，如 `form-modal`），用于"先开容器再定位"逻辑。
- PRD 文档侧：`references/prd_template.md` 第二章 2.1"页面区域说明"表有固定列"**PRD 定位 ID**"，取值即 `data-prd-target` 的值；第三章每个功能小节都有"页面定位"表，再次写明 PRD 定位 ID 与快速定位行为。**PRD 与原型共享同一套 ID 词表，这是双向定位的契约**。

**滚动定位实现——`focusPrdTarget(targetId)` 的完整流程**：

```text
点击 PRD 内定位按钮 onclick=focusPrdTarget(目标ID)
  -> querySelector 按 data-prd-target 查找目标元素
  -> 找不到: toast 提示"当前原型中未找到该功能区域"并返回
  -> 找到: 若 target 位于未打开的弹窗内(closest('.modal-overlay'))
       则先给该遮罩加 .open 并临时提高 z-index(96) 打开容器
  -> clearPrdTargetHighlight() 清除旧高亮
  -> body 加 show-interactive 类(所有目标显示虚线描边)
  -> requestAnimationFrame 内:
       scrollIntoView({ behavior: "smooth", block: "center" })
       目标加 .prd-target-highlight(呼吸高亮)
       toast 显示"已定位:" + data-prd-label(中文区域名)
       setTimeout 3200ms 后自动移除呼吸高亮
```

配套 CSS 细节：

- `[data-prd-target] { scroll-margin: 96px; }`：用 CSS `scroll-margin` 留出顶部空间，避免渐变 Header 盖住目标，省掉 JS 手工计算偏移。
- `body.show-interactive [data-prd-target]`：全局虚线描边态（2px dashed `#5352ed`），由 `toggleInteractiveHighlights(force)` 切换 body 类实现"高亮交互区"总开关（Header 与抽屉工具条都有入口，支持强制开/关）。
- `.prd-target-highlight`：3px `#ff6b6b` 实线描边 + `@keyframes prdBreathingGlow` 双色 box-shadow 呼吸动画（1.1s 无限循环），约 3.2 秒后由定时器移除。
- `clearPrdTargetHighlight()`：遍历移除所有 `.prd-target-highlight` 类，保证任意时刻只有一个目标处于呼吸高亮态。

**失败兜底**：目标不存在时 toast 提示而非静默失败；SKILL.md 还规定"若目标在隐藏的弹窗/抽屉/tab/步骤中，先打开或切换容器再高亮"（模板 JS 已示范弹窗情形）。

### 问题 3：HTML 模板结构如何

实现位置：`assets/style04_template.html`（全文）；约定来源：`SKILL.md` 的 "HTML Prototype Rules" 与 "Dynamic Layout Rules"。

**单文件**：模板是一个完整 `<!DOCTYPE html>` 单文件，`<html lang="zh-CN">` + UTF-8 meta + viewport，`<style>` 与 `<script>` 全部内联，零外部依赖、零构建工具，可离线双击打开。生成产物也是同样的单文件形态。

**文件内部分区**：

1. `<style>`：`:root` CSS 设计变量（`--primary: #ff6b6b`、状态色五组等）+ 组件类（page-header / action-bar / filter-section / table / status-badge / pagination / modal / toast / prd-drawer / 定位高亮）+ 两档响应式断点（920px、640px）。
2. `<body>`：一个通用 CRUD 页面骨架示例——渐变 Header（含"高亮交互区"与"PRD 说明"两个按钮）、操作区、筛选区、表格 + 分页 + 空状态、三个弹窗（新增编辑/详情/删除确认）、PRD 抽屉、toast。每个区域都挂好 `data-prd-target` / `data-prd-label`。
3. `<script>`：顶部 `const rawData = [...]` 内嵌 5 条样例数据（含 `{{示例编号1}}` 等占位符）；其余为纯渲染与交互函数（renderTable / applyFilters / goPage / 各弹窗开关 / toast / 定位三函数 / generatePrdContent），页面加载即 `renderTable()` 渲染。

**数据嵌入方式——`{{占位符}}` + 生成时替换**：

- 模板内容（页面名称、字段名、筛选项、表头、按钮文案等）全部写成 `{{中文占位符}}`，由 AI 在生成时替换为真实内容；SKILL.md 与 PRD 附录 Checklist 都要求"没有未替换的 `{{placeholder}}`"。
- 业务样例数据不写在 HTML 标签里，而是嵌在 JS 顶部的 `rawData` 数组，由 `renderTable()` 动态渲染进表格，筛选/分页是对该数组做内存过滤与切片——即数据层与视图层分离的极简版。
- `generatePrdContent()` 中的 `{{PRD_HTML内容}}` 是特殊占位符：填入的是 Markdown PRD 转写成的 HTML 片段（含定位按钮），实现"PRD 嵌入原型"。

**模板定位与使用规则**（SKILL.md 明文）：该模板是"style04 组件库与视觉基线"，AI 生成时复用其 CSS 变量、间距、按钮、表格、卡片、弹窗、抽屉行为与交互模式，但**按页面类型动态裁剪**——页面没有的模块（筛选、表格、分页、弹窗等）直接删除，PRD 也不写"无"；不做静态 CRUD 的强行套用。支持页面类型包括列表管理、表单、详情、仪表盘、配置、审批流、步骤流程等。

## 三、对 Interactive Game PRD 项目的可借鉴点

本项目最有价值的资产不是 style04 视觉，而是**"需求文档与可交互原型共享同一套定位 ID 词表"的双向定位体系**，这正是 Interactive Game PRD 需要的核心能力（在游戏 PRD 条目与原型场景/UI 区域之间互相跳转）：

1. **属性化锚点契约（最值得借鉴）**：用 `data-prd-target` + `data-prd-label` 双属性而非 DOM id 做锚点，ID 与 DOM 结构解耦；PRD 模板的"页面区域说明"表和每个功能小节的"页面定位"表把 ID 写进文档。游戏 PRD 可平移为：需求条目（玩法系统/场景/界面）挂 `data-req-target`，PRD 章节表中登记同一 ID，实现"PRD 条目 -> 原型区域"与"原型区域 -> PRD 条目"的双向跳转。
2. **隐藏容器先开后定位**：`focusPrdTarget` 中 `closest('.modal-overlay')` 先打开再高亮的模式，可直接推广到 tab/步骤/场景切换——游戏原型中目标常在未激活的场景或 tab 内，该模式是必需品。
3. **`scroll-margin` 代替 JS 偏移计算**：一行 CSS 解决 Header 遮挡，成本低、健壮性好。
4. **三态视觉反馈组合**：全局虚线描边（总览校验用）、单目标呼吸高亮（定位反馈用）、toast 显示中文区域名（确认定位成功），三层反馈让评审时"点一下就知道对不对"。游戏 PRD 评审演示可直接复用这套交互语言。
5. **双交付物 + Checklist 保证一致**：Markdown PRD 与原型内嵌 PRD 是同一内容的两种形态，靠 SKILL.md 与 PRD 附录 Checklist（"PRD 定位 ID 与 HTML data-prd-target 完全一致"等约 16 条）约束 AI 生成质量。这套"指令 + Checklist 驱动 AI 保一致"的做法适用于本项目游戏 PRD 技能的 Skill 设计。
6. **动态章节不写"无"**：PRD 章节按页面真实区域动态生成，缺失模块直接不写，避免文档噪音。游戏 PRD 模板（系统设计/关卡设计/数值等章节）可借鉴同一原则。
7. **无运行时的纯资产架构**：仓库只有指令 + 模板，无构建链路。这提示我们的 HTML 原型技能同样可以走"模板文件 + SKILL 指令"路线，无需引入框架或打包。

局限提示：抽屉内容与落盘 PRD 的一致性完全靠 AI 转写保证，没有程序化校验；若我们要做"需求与 UI 双向定位"的产品化能力，需要考虑 ID 一致性的自动校验（例如生成后脚本扫描 `data-*-target` 与 PRD 中的 ID 做差集比对），这是本项目没做而我们可以补强的点。

## 四、三档结论

| 档位 | 结论 | 理由 |
| --- | --- | --- |
| 复用代码 | 有限复用 | License 为 Apache-2.0，允许复用（需保留版权与 NOTICE）。可直接复用的是 `style04_template.html` 中自包含的小块代码：`focusPrdTarget` / `clearPrdTargetHighlight` / `toggleInteractiveHighlights` 三个 JS 函数、PRD 抽屉 CSS 与滑入动画、`prdBreathingGlow` 关键帧、`scroll-margin` 规则、`prd-region-link` 样式。这些函数彼此独立、无外部依赖，拷入我们的 HTML 模板成本极低。整文件直接复用则不建议：模板绑定 style04 CRUD 骨架，与游戏原型形态不符。 |
| 借鉴思想 | 重点借鉴 | (a) `data-prd-target`/`data-prd-label` 属性化锚点与 kebab-case ID 词表，以及 PRD 表格登记 ID 的契约式做法——这是"需求与 UI 双向定位"的骨架；(b) 隐藏容器先打开再高亮的流程；(c) 三层视觉反馈（全局描边/呼吸高亮/toast）；(d) 双交付物（Markdown PRD + 原型内嵌 PRD）与 Checklist 驱动一致性；(e) PRD 章节按真实页面动态生成、缺失模块不写"无"；(f) 指令 + 模板的纯资产 Skill 架构。 |
| 不采用 | 三项 | (1) style04 视觉主题（红黄渐变、后台管理风）：与游戏 PRD 产品的视觉定位不符，仅参考其"设计变量集中在 `:root`"的写法；(2) 内置通用 CRUD 骨架及 `rawData`/`renderTable` 示例逻辑：是硬编码的列表页样板，游戏原型需要场景/画布/交互形态，照搬会造成强行套模板（本项目自己也反对这一点，只是模板示例本身就是 CRUD）；(3) 抽屉内容靠 AI 手工转写保证一致性且无校验的机制：直接沿用会在长文档场景下漂移，我们应补程序化 ID 一致性校验。 |

## 引用说明

- 本地源码（只读）：`thirdparties/prd-html-generator/SKILL.md`、`assets/style04_template.html`、`references/prd_template.md`、`README.md`、`agents/openai.yaml`
- 上游仓库：https://github.com/XiaoYongV5/prd-html-generator.git（固定 commit `5b40d5a6df9c090fe2ed1fd31367e6793f4379d3`，Apache-2.0）
- 登记表：`thirdparties/REFERENCES.md`（REF-002）
