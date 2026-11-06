# Interactive Game PRD：交互式游戏需求生成系统

> 项目：PrdGameSkill  
> 日期：2026-11-06  
> 版本：v1.0  
> 状态：待评审  
> 优先级：P0  
> 试点项目：卡五星麻将  
> 目标产物：AI-Readable Game Spec + Interactive HTML PRD

---

## 1. 项目背景

### 1.1 当前问题

传统游戏 PRD 通常采用 Word、Excel、Markdown 等格式，主要面向产品、策划、程序、美术和测试人员阅读。

但是在 AI Agent 参与游戏开发后，传统 PRD 存在几个问题：

1. 需求内容大量采用自然语言，AI 难以准确识别需求边界。
2. 玩法规则、UI 交互、数值配置、异常流程分散在不同章节。
3. 需求缺少稳定 ID，难以建立需求与 UI、代码、测试之间的关联。
4. AI 容易自行补充原始需求没有定义的业务规则。
5. 静态文档无法直观演示实际游戏操作。
6. 产品、程序、测试人员需要反复阅读文档才能理解一个完整的功能流程。
7. 原始 PRD 与后续 UI 原型容易发生不一致。

### 1.2 项目目标

建立一套 Interactive Game PRD 生成能力。

输入原始游戏需求文档，通过 AI 进行需求解析、结构化、完整性审查，最终生成：

- 结构化 Game Requirement IR。
- AI 可读取的 Game Feature Specs。
- 可独立运行的 HTML PRD。
- 可交互的游戏 UI 原型。
- 游戏玩法模拟器。
- 需求与 UI、规则、测试之间的追踪关系。
- 需求完整性与一致性检查报告。

核心原则：

**结构化需求是唯一事实源，Markdown 和 HTML 都是它的展示或消费形式，不能让 HTML 成为唯一的需求数据源。**

### 1.3 产品定位

本项目是 PrdGameSkill 的一项新能力，不是独立的通用网页原型生成器。

主要服务对象：

| 角色 | 使用目的 |
|---|---|
| 游戏策划 | 编写、整理和确认游戏规则 |
| 产品经理 | 审查需求完整性和业务流程 |
| UI 设计师 | 查看页面结构、交互和状态 |
| 游戏程序 | 读取结构化规格进行开发 |
| 测试人员 | 查看验收条件和执行测试 |
| AI Agent | 读取规格、生成 UI、开发和验证 |

---

## 2. 产品总体流程

```text
原始游戏 PRD
    |
    v
文档解析
    |
    v
AI 需求抽取
    |
    +---- 游戏概述
    +---- 玩法规则
    +---- 功能需求
    +---- 状态机
    +---- 数值配置
    +---- UI 页面
    +---- 交互流程
    +---- 验收条件
    |
    v
Game Requirement IR
    |
    v
需求质量审查
    |
    +---- 完整性检查
    +---- 规则冲突检查
    +---- 歧义检查
    +---- 缺失信息检查
    +---- 需求溯源检查
    |
    v
人工确认
    |
    v
生成 Interactive HTML PRD
    |
    +---- 需求文档视图
    +---- 游戏 UI 演示
    +---- 玩法模拟
    +---- 状态机展示
    +---- 测试用例
    |
    v
HTML / Spec 一致性检查
    |
    v
正式发布
    |
    v
后续 AI 开发工作流
```

### 2.1 核心原则

1. 原始 PRD 永远保留，不允许被生成结果覆盖。
2. 每条需求都必须具有唯一 ID。
3. 每条结构化需求都必须能够追溯原始文档及章节。
4. 未确认的规则不能被当成正式规则。
5. HTML 原型只能演示已经定义的需求，不能用演示效果反向伪造业务规则。
6. 结构化规格修改后，必须检查关联的 HTML、流程和测试是否需要更新。

---

## 3. 项目目录与参考项目

### 3.1 现有项目约束

项目地址：

https://github.com/mickorz/PrdGameSkill

保留现有目录及文档规范。

现有参考项目：

`thirdparties/bmad-module-game-dev-studio`

处理原则：

- 继续作为只读参考。
- 不重复添加。
- 不直接修改其代码。
- 提取的方法论必须保留来源信息。

### 3.2 新增 Git Submodules

新增以下六个参考项目。

| ID | 仓库 | 本地路径 | 主要研究内容 |
|---|---|---|---|
| REF-001 | prd-pilot | thirdparties/prd-pilot | Requirement Spec、Demo、Consistency |
| REF-002 | prd-html-generator | thirdparties/prd-html-generator | PRD 抽屉、UI 定位、HTML 生成 |
| REF-003 | prd-writer | thirdparties/prd-writer | 游戏 PRD、HTML 导出、交互原型 |
| REF-004 | Arrow | thirdparties/Arrow | 游戏逻辑节点、可玩 HTML 导出 |
| REF-005 | GDD-Forge | thirdparties/GDD-Forge | GDD 数据结构、Feature、设计决策 |
| REF-006 | Game Doc Forge | thirdparties/game-doc-forge | 游戏设计访谈、决策账本、审查 |

仓库地址：

- REF-001：https://github.com/156181679-dev/prd-pilot.git
- REF-002：https://github.com/XiaoYongV5/prd-html-generator.git
- REF-003：https://github.com/cnhx/prd-writer.git
- REF-004：https://github.com/mhgolkar/Arrow.git
- REF-005：https://github.com/miventech/GDD-Forge.git
- REF-006：https://github.com/MisterVitoPro/gdd.git

### 3.3 Submodule 初始化命令

在 PrdGameSkill 仓库根目录执行：

```bash
git submodule add \
  https://github.com/156181679-dev/prd-pilot.git \
  thirdparties/prd-pilot

git submodule add \
  https://github.com/XiaoYongV5/prd-html-generator.git \
  thirdparties/prd-html-generator

git submodule add \
  https://github.com/cnhx/prd-writer.git \
  thirdparties/prd-writer

git submodule add \
  https://github.com/mhgolkar/Arrow.git \
  thirdparties/Arrow

git submodule add \
  https://github.com/miventech/GDD-Forge.git \
  thirdparties/GDD-Forge

git submodule add \
  https://github.com/MisterVitoPro/gdd.git \
  thirdparties/game-doc-forge
```

初始化及检查：

```bash
git submodule update --init --recursive
git submodule status
```

Windows 环境建议：

```powershell
git -c core.longpaths=true submodule update --init --recursive
```

### 3.4 第三方代码管理规范

所有参考项目必须：

1. 通过 Git Submodule 引入。
2. 固定到明确的 commit。
3. 记录仓库地址、License、commit SHA、研究目的。
4. 不直接修改第三方源码。
5. 不将第三方运行时作为本项目的强制依赖。
6. 不直接复制整套项目架构。
7. 提取的方法论、模板和代码必须标注来源。
8. 对第三方代码进行复用前检查实际 License 和版权声明。

新增：

`thirdparties/REFERENCES.md`

记录参考项目清单、研究范围、版本和复用情况。

注意：Submodule 只作为源码研究和方法论参考，不意味着六个项目全部需要集成到最终产品中。

### 3.5 参考项目研究任务

| 项目 | 必须研究的内容 | 预期产出 |
|---|---|---|
| PRD Pilot | Requirement Spec、生成链路、质量检查、定点修改 | requirement-spec 设计 |
| PRD HTML Generator | PRD 抽屉、锚点定位、HTML 模板 | HTML PRD 交互规范 |
| PRD Writer | 游戏 PRD 结构、HTML 导出、交互原型 | Game PRD 模板参考 |
| Arrow | Node Runtime、变量、状态、HTML Export | 游戏演示能力分析 |
| GDD-Forge | Manifest、Feature、Segment、Decision | Game IR 数据结构参考 |
| Game Doc Forge | Interview Ledger、Decision、Open Questions、Audit | 需求抽取与审查规范 |

研究原则：先完成代码阅读和能力盘点，再决定是否复用具体代码。

---

## 4. Game Requirement IR 设计

这是整个系统最核心的部分。

### 4.1 定义

Game Requirement IR（Intermediate Representation）是原始游戏需求经过结构化处理后形成的统一中间数据模型。

它是以下产物的共同数据源：

- Markdown PRD。
- HTML PRD。
- UI Prototype。
- Game Simulator。
- State Machine。
- Test Spec。
- AI 开发任务。

### 4.2 目录结构

```text
game-spec/
│
├── manifest.yaml
│
├── source/
│   ├── original-prd.md
│   └── source-map.json
│
├── game/
│   ├── overview.yaml
│   ├── core-loop.yaml
│   └── glossary.yaml
│
├── requirements/
│   ├── features/
│   ├── rules/
│   ├── states/
│   └── constraints/
│
├── ui/
│   ├── navigation.yaml
│   ├── pages/
│   ├── components/
│   └── interactions/
│
├── data/
│   ├── entities.yaml
│   ├── configs/
│   └── enums.yaml
│
├── flows/
│   └── *.yaml
│
├── tests/
│   ├── scenarios/
│   └── cases/
│
├── reviews/
│   ├── completeness.json
│   ├── consistency.json
│   └── open-questions.json
│
└── output/
    ├── html/
    └── reports/
```

### 4.3 需求状态

每条需求必须记录其确认状态：

| 状态 | 含义 | AI 行为 |
|---|---|---|
| proposed | AI 提取或建议，尚未确认 | 可以展示，不得作为确定规则 |
| approved | 人工确认 | 可以作为正式规格 |
| rejected | 人工否决 | 不得继续进入正式规格 |
| deprecated | 已废弃 | 保留历史记录，不再生效 |

另设规则授权字段：

| authority | 含义 |
|---|---|
| fixed | 必须遵循的固定规则 |
| delegated | 可以在约束内由 AI 决定 |
| open | 需要人工补充确认 |

### 4.4 每条需求的标准字段

```yaml
id: GAME-RULE-001

type: game_rule
name: 出牌规则

status: proposed
authority: open

description: ""

source:
  document: original-prd.md
  section: ""
  page: null
  quote: ""

preconditions: []
inputs: []
outputs: []

business_rules: []
normal_flow: []
exception_flow: []
state_transitions: []

ui_refs: []
test_refs: []
dependencies: []

open_questions: []
```

字段要求：

- `id`：全局唯一，不因文档调整而改变。
- `source`：必须能追溯原始需求。
- `status`：明确需求确认情况。
- `authority`：明确 AI 的决策权限。
- `preconditions`：执行前提。
- `business_rules`：明确业务规则。
- `exception_flow`：异常流程。
- `state_transitions`：状态变化。
- `ui_refs`：关联 UI。
- `test_refs`：关联验收用例。

### 4.5 ID 规范

| 类型 | ID 前缀 | 示例 |
|---|---|---|
| 功能需求 | GAME-FR | GAME-FR-001 |
| 业务规则 | GAME-RULE | GAME-RULE-001 |
| 非功能需求 | GAME-NFR | GAME-NFR-001 |
| 状态机 | GAME-STATE | GAME-STATE-001 |
| UI 页面 | GAME-UI | GAME-UI-001 |
| UI 组件 | GAME-COMP | GAME-COMP-001 |
| 交互事件 | GAME-EVENT | GAME-EVENT-001 |
| 配置项 | GAME-CFG | GAME-CFG-001 |
| 测试用例 | GAME-TC | GAME-TC-001 |
| 开发任务 | GAME-TASK | GAME-TASK-001 |

所有引用必须使用 ID，不允许依赖文档标题作为唯一关联方式。

### 4.6 单一事实源

一个业务事实只能在一个地方定义。

例如：

胡牌条件在 Game Rule 中定义，UI Spec 只引用对应规则，Test Spec 只引用对应规则和验收条件。

禁止出现：

- UI Spec 自己定义一套胡牌条件。
- Test Spec 使用与 Rule 不同的条件。
- HTML Demo 自己推断新的游戏规则。

---

## 5. 原始 PRD 解析与需求审查

### 5.1 输入类型

第一版支持：

- Markdown。
- Word / DOCX。
- PDF。
- Excel / XLSX。

图片、扫描文档及流程图作为后续增强能力，第一版不要求完整 OCR 流程。

### 5.2 解析阶段

拆分成五个步骤：

**Step 1：原始材料解析**

提取：

- 文档章节。
- 标题层级。
- 表格。
- 图片及附件引用。
- 流程描述。
- 数值配置。
- 规则定义。

**Step 2：需求抽取**

按领域抽取：

- 游戏功能。
- 玩法规则。
- 游戏状态。
- 操作行为。
- 数值及概率。
- UI 页面。
- 页面交互。
- 异常流程。
- 验收条件。

**Step 3：需求分类**

区分：

- 明确需求。
- 隐含需求。
- AI 建议。
- 待确认问题。
- 冲突需求。

不得把 AI 推测的内容混入原始需求。

**Step 4：结构化转换**

生成 Game Requirement IR，并分配稳定 ID。

**Step 5：需求审查**

检查：

| 检查维度 | 检查内容 |
|---|---|
| 完整性 | 是否缺少必要需求 |
| 一致性 | 规则之间是否矛盾 |
| 可测试性 | 是否能建立验收条件 |
| 可实现性 | 是否存在无法执行的描述 |
| 边界条件 | 是否覆盖异常和极端情况 |
| 可追溯性 | 是否能够回到原始文档 |
| 可视化覆盖 | 是否有对应的页面和演示 |

### 5.3 问题报告

每个问题包含：

```yaml
id: REVIEW-001
type: missing_requirement
severity: high

related_requirements:
  - GAME-RULE-001

description: ""

evidence:
  source: original-prd.md
  section: ""

suggestion: ""

resolution:
  status: open
  decision: null
```

严重程度：

- critical：阻塞正式规格生成。
- high：重要规则缺失或存在严重冲突。
- medium：需要产品确认。
- low：文档优化建议。

### 5.4 审批 Gate

以下情况不得自动进入正式规格：

1. 核心玩法规则存在冲突。
2. 关键规则仍为 open。
3. 重要需求没有来源。
4. 状态转换存在无法解释的情况。
5. 核心流程缺少验收条件。

允许生成预览，但必须显示未确认标识。

---

## 6. Interactive HTML PRD

### 6.1 目标

将 Game Requirement IR 渲染成一个独立运行的 HTML 游戏需求网页。

网页必须同时包含：

1. 游戏需求文档。
2. 游戏 UI 原型。
3. 游戏交互演示。
4. 游戏规则说明。
5. 流程图和状态机。
6. 测试场景。
7. 需求追踪关系。

### 6.2 HTML 整体布局

采用三栏式设计。

**左侧：需求导航**

- 游戏概述。
- 核心玩法。
- 游戏规则。
- 功能需求。
- UI 页面。
- 状态机。
- 数值配置。
- 测试用例。
- 未决问题。

**中间：主要展示区**

提供四种模式：

| 模式 | 展示内容 |
|---|---|
| PRD | 结构化游戏需求文档 |
| UI Demo | 可操作游戏 UI |
| Flow | 游戏流程和状态机 |
| Tests | 验收场景和测试结果 |

**右侧：详情面板**

- 当前需求 ID。
- 需求来源。
- 业务规则。
- 前置条件。
- 关联 UI。
- 关联测试。
- 需求状态。
- AI 解释。

### 6.3 PRD 与 UI 双向定位

必须实现：

PRD → UI：

1. 点击某条需求。
2. 自动切换到对应 UI 页面。
3. 定位对应 UI 组件。
4. 高亮对应区域。
5. 展示关联业务规则。

UI → PRD：

1. 点击 UI 组件。
2. 找到对应 Component ID。
3. 显示关联需求。
4. 显示对应规则。
5. 显示对应测试用例。

HTML 中通过稳定标识实现：

```html
<button
  data-component-id="GAME-COMP-001"
  data-requirements="GAME-FR-001"
>
  开始游戏
</button>
```

### 6.4 HTML 输出结构

```text
output/
└── interactive-game-prd/
    ├── index.html
    ├── assets/
    ├── styles/
    ├── scripts/
    ├── data/
    │   ├── manifest.json
    │   ├── requirements.json
    │   ├── ui-spec.json
    │   └── test-cases.json
    └── simulator/
        ├── engine.js
        └── scenarios.js
```

第一版支持本地运行，不依赖在线 API。

HTML 生成时必须保证：

- 无后端依赖。
- 资源使用相对路径。
- 无未替换模板变量。
- 需求数据完整嵌入或本地加载。
- 所有核心导航和交互可运行。
- 能够在现代 Chrome 浏览器中运行。

最终支持将整个目录打包为 ZIP 分享。

---

## 7. 游戏 UI Demo

### 7.1 目标

让原始游戏需求能够被可视化体验。

不是简单的页面截图，也不是只有按钮响应的假交互。

第一版分两个层级：

**Level 1：UI Prototype**

用于演示：

- 页面布局。
- 控件位置。
- 页面跳转。
- 弹窗。
- Loading。
- Error。
- Disabled。
- Success。
- 典型用户操作。

使用模拟数据，不要求实现完整游戏规则。

**Level 2：Rule Simulator**

用于演示：

- 游戏状态。
- 玩家操作。
- 业务规则判定。
- 状态转换。
- 操作结果。
- 异常情况。

必须使用经过确认的规则实现。

### 7.2 UI 页面规格

每个页面必须具备：

```yaml
page:
  id: GAME-UI-001
  name: 游戏大厅
  resolution:
    width: 1280
    height: 720

  components: []

  states:
    - loading
    - normal
    - error

  interactions: []

  requirements: []
  test_refs: []
```

### 7.3 UI 原型生成方式

采用：

Game Requirement IR → UI Intermediate Model → HTML / React。

不允许直接让 AI 从自然语言 PRD 生成最终 HTML 并跳过中间结构。

UI Intermediate Model 负责：

- 页面结构。
- 组件树。
- 组件 ID。
- 属性。
- 事件。
- 页面状态。
- 需求关联。
- 资源引用。

HTML / React 是中间模型的渲染结果。

### 7.4 视觉标注

后续支持：

- 鼠标选中 UI 组件。
- 查看组件 ID。
- 查看当前属性。
- 输入修改要求。
- AI 局部修改组件。
- 保留原有交互事件。
- 更新 UI Spec。
- 生成变更记录。

例如：

将开始游戏按钮向下移动 20px，改成金色。

AI 只修改目标组件，不重新生成整个页面。

视觉修改与业务需求修改必须区分。

---

## 8. 游戏玩法模拟器

### 8.1 模拟器设计

游戏模拟器必须独立于 HTML 展示层。

建议结构：

```text
simulator/
├── core/
│   ├── game-state.ts
│   ├── player-state.ts
│   ├── event-system.ts
│   └── rule-engine.ts
│
├── adapters/
│   └── html-ui-adapter.ts
│
├── scenarios/
│   ├── normal-flow/
│   ├── exception-flow/
│   └── edge-cases/
│
└── tests/
```

核心原则：

- 游戏状态与 UI 分离。
- 规则逻辑与展示逻辑分离。
- 规则由结构化规格约束。
- 每次操作产生可追踪事件。
- 可以加载预设场景。
- 可以重置场景。
- 可以查看规则判定过程。

### 8.2 卡五星麻将 Golden Sample

第一版只做以下三个主要场景：

1. 游戏大厅。
2. 麻将对局。
3. 结算页面。

对局操作：

- 摸牌。
- 出牌。
- 碰。
- 杠。
- 胡。

但这些操作是否适用、操作优先级、牌型判定和具体结算方式，全部以原始卡五星 PRD 确认后的规则为准。

不得根据其他麻将玩法自行推断卡五星规则。

### 8.3 场景测试

每个规则至少建立：

- 正常操作场景。
- 非法操作场景。
- 边界场景。
- 状态异常场景。

每个场景记录：

- 初始游戏状态。
- 玩家操作。
- 预期结果。
- 实际结果。
- 规则判定日志。

---

## 9. 需求一致性检查

这是本系统的重要质量 Gate。

### 9.1 检查对象

需要检查：

- 原始 PRD 与 Game Requirement IR。
- Game Requirement IR 与 Feature Specs。
- Game Requirement IR 与 UI Spec。
- UI Spec 与 HTML Demo。
- Game Rules 与 Simulator。
- Requirement 与 Test Cases。

### 9.2 确定性检查

由代码脚本执行：

1. ID 是否重复。
2. 引用的 ID 是否存在。
3. 每条 approved 需求是否有来源。
4. 每个核心需求是否有验收用例。
5. UI 组件引用是否存在。
6. HTML 组件是否具有对应 ID。
7. 需求与测试关联是否完整。
8. 是否存在未处理的关键问题。
9. 状态机是否存在非法转换。
10. HTML 是否存在无响应的交互控件。

### 9.3 AI 语义检查

由 AI 执行：

1. HTML 是否遗漏原始需求中的关键页面。
2. Demo 是否违背业务规则。
3. 不同需求之间是否存在隐性冲突。
4. 模拟器是否错误解释规则。
5. 页面交互是否符合游戏体验要求。
6. 异常流程是否覆盖。
7. AI 是否擅自补充未经确认的规则。

### 9.4 检查报告

```yaml
report:
  requirement_coverage: 0.95
  ui_coverage: 0.90
  test_coverage: 0.85

  blocking_issues: []
  warnings: []

  result: needs_review
```

指标定义必须区分：

- 提取覆盖率。
- UI 演示覆盖率。
- 测试覆盖率。
- 规则确认率。

不能把这些指标混成一个总分。

---

## 10. Skill 工作流设计

本项目属于 PrdGameSkill 技能库，第一版优先通过 Skill 和脚本完成，不引入独立的 Agent Runtime。

建议新增：

```text
skills/
└── interactive-game-prd/
    ├── SKILL.md
    │
    ├── workflows/
    │   ├── parse-prd.md
    │   ├── extract-requirements.md
    │   ├── review-requirements.md
    │   ├── generate-ir.md
    │   ├── generate-html.md
    │   ├── generate-simulator.md
    │   └── validate-output.md
    │
    ├── templates/
    │   ├── game-manifest.yaml
    │   ├── requirement.yaml
    │   ├── ui-page.yaml
    │   └── test-case.yaml
    │
    ├── schemas/
    │   ├── manifest.schema.json
    │   ├── requirement.schema.json
    │   ├── ui.schema.json
    │   └── test.schema.json
    │
    ├── assets/
    │   ├── html-template/
    │   └── simulator-template/
    │
    ├── scripts/
    │   ├── validate-ir
    │   ├── check-traceability
    │   └── validate-html
    │
    └── references/
        ├── game-prd-format.md
        ├── interactive-html.md
        └── simulator-contract.md
```

### 10.1 Skill 入口

支持以下操作：

| 模式 | 功能 |
|---|---|
| Create | 从原始 PRD 创建交互式 Game PRD |
| Update | 根据新需求更新现有规格 |
| Review | 检查需求完整性和冲突 |
| Generate | 重新生成 HTML 和 Demo |
| Validate | 检查 IR、HTML、Simulator、Test 一致性 |
| Export | 导出 HTML PRD 和 ZIP |

### 10.2 工作流约束

- Create 不得覆盖原始 PRD。
- Update 必须生成变更记录。
- Review 不得直接修改原始需求。
- Generate 不得擅自修改 approved 规则。
- Validate 必须输出机器可读报告。
- Export 必须通过必要的质量检查。

---

## 11. 技术架构约束

### 11.1 基础架构

```text
PrdGameSkill
    |
    +-- Game PRD Parser
    |
    +-- Game Requirement IR
    |      |
    |      +-- Schema Validator
    |      +-- Traceability
    |      +-- Requirement Review
    |
    +-- UI Intermediate Model
    |      |
    |      +-- HTML Renderer
    |      +-- React Renderer
    |
    +-- Game Simulator
    |      |
    |      +-- State Machine
    |      +-- Rule Engine
    |      +-- Scenario Runner
    |
    +-- Quality Gate
           |
           +-- IR Check
           +-- HTML Check
           +-- UI Coverage
           +-- Rule Consistency
           +-- Test Coverage
```

### 11.2 技术原则

1. 优先复用现有 PrdGameSkill 的 Skill 体系。
2. IR 使用 JSON/YAML，文档说明使用 Markdown。
3. 使用 JSON Schema 做结构校验。
4. HTML 作为独立发布产物。
5. Simulator 使用独立领域逻辑。
6. 不依赖外部在线服务才能浏览已生成的 HTML。
7. 不把第三方项目的运行时直接引入核心架构。
8. 通过接口隔离不同的 HTML/React Renderer。
9. 保留未来 FairyGUI 导出能力。
10. 不在第一版开发完整的游戏引擎或通用 UI 编辑器。

---

## 12. 实施计划

采用 Golden Sample 先行，分阶段交付。

### P0：参考项目调研与基准建立

目标：完成第三方项目引入和技术能力盘点。

任务：

- P0-01：新增六个 Git Submodule。
- P0-02：记录第三方项目版本、License 和 Commit SHA。
- P0-03：研究 PRD Pilot 的 Requirement Spec 和生成流程。
- P0-04：研究 PRD HTML Generator 的 PRD 定位能力。
- P0-05：研究 PRD Writer 的 HTML 导出和交互原型。
- P0-06：研究 Arrow 的可玩 HTML 导出机制。
- P0-07：研究 GDD-Forge 的数据结构。
- P0-08：研究 Game Doc Forge 的决策账本和审查流程。
- P0-09：输出技术调研报告及复用决策表。

交付物：

`dev-docs/research/2026-11-06-interactive-game-prd-reference-research.md`

验收：

- 六个 Submodule 正常初始化。
- 研究报告覆盖六个项目。
- 明确复用、借鉴和不采用的内容。
- 不修改第三方源码。

### P1：Game Requirement IR

目标：定义一套 AI 可读取、可校验的游戏需求格式。

任务：

- P1-01：确定 IR 顶层结构。
- P1-02：确定需求 ID 规范。
- P1-03：确定 Requirement Schema。
- P1-04：确定 UI Spec Schema。
- P1-05：确定 Test Spec Schema。
- P1-06：建立 source-map 溯源机制。
- P1-07：建立需求状态和授权机制。
- P1-08：建立 IR 确定性校验工具。

交付物：

`skills/interactive-game-prd/schemas/`

`skills/interactive-game-prd/templates/`

验收：

- Schema 能验证合法 IR。
- 重复 ID 能被发现。
- 无效引用能被发现。
- 每条需求都可以追溯原始来源。
- 未确认需求可以明确标记。

### P2：卡五星麻将需求解析

目标：将真实麻将原始 PRD 转换成结构化规格。

任务：

- P2-01：导入原始麻将 PRD。
- P2-02：提取游戏系统和功能清单。
- P2-03：提取麻将玩法规则。
- P2-04：提取状态机和操作流程。
- P2-05：提取 UI 页面和组件。
- P2-06：提取数值及配置。
- P2-07：生成需求追踪关系。
- P2-08：生成完整性和一致性审查报告。
- P2-09：人工确认核心规则。
- P2-10：冻结 Golden Sample。

交付物：

`examples/mahjong/`

验收：

- 所有已抽取需求都有来源。
- 不允许虚构原始 PRD 没有定义的规则。
- 关键未决问题能够单独列出。
- 通过人工确认的规则可以标记为 approved。
- 每条核心需求都可以找到对应验收场景。

### P3：Interactive HTML PRD Renderer

目标：从 IR 生成可独立运行的 HTML PRD。

任务：

- P3-01：设计 HTML 页面结构。
- P3-02：实现需求导航。
- P3-03：实现 PRD 文档展示。
- P3-04：实现规则详情面板。
- P3-05：实现 UI Demo 视图。
- P3-06：实现 Flow 和 State Machine 视图。
- P3-07：实现测试用例视图。
- P3-08：实现 PRD 到 UI 定位。
- P3-09：实现 UI 到 PRD 反向定位。
- P3-10：实现离线 HTML 导出。

交付物：

`examples/mahjong/output/interactive-game-prd/`

验收：

- HTML 能独立打开。
- 需求导航完整。
- PRD 条目能定位 UI。
- UI 能定位需求。
- 关联关系正确。
- 核心功能不依赖在线 API。

### P4：麻将 Rule Simulator

目标：将需求中的规则转换为可运行的交互演示。

任务：

- P4-01：设计模拟器接口。
- P4-02：实现牌桌状态。
- P4-03：实现玩家手牌和弃牌区。
- P4-04：实现摸牌和出牌交互。
- P4-05：根据已确认规则实现碰、杠、胡。
- P4-06：实现预设场景加载。
- P4-07：实现规则判定日志。
- P4-08：将模拟器接入 HTML。
- P4-09：建立模拟器测试。

交付物：

`skills/interactive-game-prd/assets/simulator-template/`

`examples/mahjong/`

验收：

- 预设场景可以重复加载。
- 玩家操作符合 approved 规则。
- 非法操作被拒绝。
- 状态转换正确。
- 模拟器输出可追踪。
- 规则缺失时不得自动生成虚假的正确结果。

### P5：一致性验证与 Skill 闭环

目标：将整个过程封装成可复用的 Skill。

任务：

- P5-01：集成 Create。
- P5-02：集成 Update。
- P5-03：集成 Review。
- P5-04：集成 Generate。
- P5-05：集成 Validate。
- P5-06：集成 Export。
- P5-07：建立端到端测试。
- P5-08：完善 README 和使用示例。

交付物：

完整 `interactive-game-prd` Skill。

验收：

从原始 PRD 输入开始，可以自动完成需求解析、结构化、审查、HTML 生成和一致性检查。

---

## 13. 测试与验收标准

### 13.1 固定 Benchmark

使用卡五星麻将真实原始 PRD 建立固定 Benchmark。

至少包含：

- 完整需求输入。
- 已确认需求清单。
- 关键规则清单。
- UI 页面清单。
- 状态转换清单。
- 测试用例清单。
- 人工标注的遗漏和冲突案例。

### 13.2 核心指标

| 指标 | 定义 |
|---|---|
| 需求抽取覆盖率 | 已正确抽取需求 / 人工标注的原始需求 |
| 来源追溯率 | 有有效来源的需求 / 已抽取需求 |
| 规则确认率 | 已确认规则 / 全部已识别规则 |
| UI 覆盖率 | 有对应 UI 设计的 UI 相关需求 / UI 相关需求 |
| 测试覆盖率 | 有验收用例的需求 / 应测试需求 |
| 一致性问题召回率 | 被发现的问题 / 人工标注问题 |
| Demo 交互通过率 | 通过的核心交互 / 全部核心交互 |

### 13.3 发布 Gate

必须同时满足：

1. 没有 Critical 级别的问题。
2. 核心玩法规则已人工确认。
3. IR Schema 校验通过。
4. 需求来源引用有效。
5. UI 与需求引用有效。
6. 核心交互可运行。
7. Simulator 测试通过。
8. HTML 质量检查通过。
9. 一致性检查通过或剩余问题经过人工豁免。
10. 输出完整审查报告。

---

## 14. 明确不在第一版范围内的内容

为了避免项目范围膨胀，以下内容不纳入 P0-P5：

1. 完整的游戏编辑器。
2. 完整的游戏运行时。
3. 完整的 FairyGUI 编辑器。
4. 通用的 2D/3D 游戏模拟引擎。
5. 多人实时联网对局。
6. 真实服务器和账号系统。
7. 完整的自动美术资产生成系统。
8. 在线多人协作编辑。
9. 复杂的多人审批平台。
10. HTML Demo 直接导出可发布游戏包。

未来可以在现有能力成熟后扩展。

---

## 15. 最终交付目录

```text
PrdGameSkill/
│
├── thirdparties/
│   ├── bmad-module-game-dev-studio/
│   ├── prd-pilot/
│   ├── prd-html-generator/
│   ├── prd-writer/
│   ├── Arrow/
│   ├── GDD-Forge/
│   ├── game-doc-forge/
│   └── REFERENCES.md
│
├── skills/
│   └── interactive-game-prd/
│       ├── SKILL.md
│       ├── workflows/
│       ├── templates/
│       ├── schemas/
│       ├── assets/
│       ├── scripts/
│       └── references/
│
├── examples/
│   └── mahjong/
│       ├── source/
│       ├── game-spec/
│       ├── reviews/
│       ├── tests/
│       └── output/
│
├── dev-docs/
│   ├── research/
│   ├── design/
│   ├── planning/
│   └── progress/
│
└── README.md
```

---

## 16. 项目完成标准

最终不是以生成了多少份 Markdown 或 HTML 文件作为项目完成标准。

而是必须证明以下完整流程可用：

```text
真实游戏原始 PRD
      |
      v
AI 正确提取游戏需求
      |
      v
形成结构化 Game Spec
      |
      v
识别原始需求遗漏和冲突
      |
      v
人工确认游戏规则
      |
      v
生成 Interactive HTML PRD
      |
      v
在浏览器中体验游戏流程
      |
      v
查看需求与 UI 的关联
      |
      v
执行规则模拟与验收测试
      |
      v
检查需求、演示和测试一致性
```

**最终目标：让一个没有参与过需求讨论的 AI Agent，仅通过 Game Requirement IR 和相关规格，就能准确理解游戏规则；让一个没有参与过需求讨论的人，仅通过 HTML PRD，就能理解并体验游戏的核心流程。**

这是本项目的最终验收标准。
