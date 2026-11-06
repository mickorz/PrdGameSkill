# IR 与 HTML 展示可行性验证结论（P1-09）

> 日期：2026-11-06  
> 验证对象：`skills/interactive-game-prd/assets/html-template/index.html`（最小 Demo）  
> 数据：手写迷你 IR（与 `scripts/validate-ir.example/valid` 同源：6 条需求 + 1 个麻将式翻牌 UI 页面 + 4 组件 + 3 事件）

## 1. 验证方式

浏览器实机验证环境本次不可用（自动化浏览器未连接且 setup 需人工介入），采用两级替代验证：

1. Node 提取内嵌 script 做语法检查（new Function 编译）：通过。
2. 七项关键结构断言：定位锚点（dataset.componentId 赋值 + querySelector 读取）、status 徽标、authority 徽标、来源三分类数据、非法操作拒绝（RULE-006）、规则判定日志（[RULE-xxx] 输出）、呼吸高亮动画：全部通过。

浏览器 file:// 实机交互验证在 P3 由 validate-html 与人工打开验收补做（P3 验收清单已含「HTML 独立打开」）。

## 2. IR 字段支撑度核对结论

### 2.1 现有字段足够支撑的能力

| HTML 能力 | 使用的 IR 字段 | 结论 |
|---|---|---|
| 需求导航 + 双徽标 | id、name、status、authority | 足够；status 与 authority 分开展示正确 |
| 详情面板来源区 | source.kind/section/quote | original 与 human_decision 足够 |
| 业务规则展示 | business_rules | 足够 |
| PRD 到 UI 定位 | ui_refs + 组件 id | 足够：需求 -> ui_refs -> GAME-COMP -> data-component-id |
| UI 演示（翻牌页） | page.states/components/interactions + 组件 props | 足够：loading/idle/playing/won 状态与事件绑定可行 |
| 模拟判定日志 | RULE ID 即日志标签 | 足够：[RULE-xxx] 直接引用需求 ID，可反向跳转 |

### 2.2 验证中发现的字段问题与处置

1. **组件缺"页面内布局提示"字段**：Demo 中牌格布局（4x2 网格位置）写死在 CSS；IR 无法表达"第几张牌在哪"。处置：P3 阶段 UI Intermediate Model 增加 `layout_hint`（grid 位置等），属于渲染层字段，不进 IR——IR 保持需求语义，布局归渲染模板。已确认无需改 requirement/ui Schema。
2. **derived 来源详情展示**：Demo 详情面板对 derived 只显示 basis 一行；未来 PRD 文档视图需同时显示 related_requirements 跳转。处置：Schema 不变，P3 渲染时处理。
3. **验证过程中修正的实现缺陷（非 IR 问题）**：validate-ir 最初未扫描 `data/configs/`（GAME-CFG 同为需求条目），已修复并纳入校验；requirement.schema.json 补充 config 的 `value` 字段。

### 2.3 结论

**现有 IR Schema（v1.0，requirement/ui/test/manifest 四份）可以支撑 HTML PRD 的导航、详情、来源溯源、双向定位、UI 演示五大核心能力，无需结构性返工。** 渲染层补充字段（layout_hint 等）归 UI Intermediate Model，P3 处理。
