# ui-interaction-prd-extract 输出文档模板与结构设计

- 日期：2026-11-11
- 需求：`dev-docs/design/ui-interaction-prd-extract.md`
- 模板交付位置：`.claude/skills/ui-interaction-prd-extract/templates/`

## 1. 已确认的决策

| 决策点 | 结论 |
|---|---|
| 组件文档粒度 | 仅交互组件（有输入交互 / 独立状态 / 事件收发）单独成文；纯静态组件在界面文档组件清单表中列一行 |
| 模板形式 | 模板骨架 + 真实数据样例（BoxKaWuXingMahMainView） |
| 事件详细度 | 界面/组件文档只写 Cmd 名 + 方向 + 触发时机；协议字段明细汇总在模块分析.md 附录协议索引 |

## 2. 输入数据摸底

- FGUI 工程 `input-ui/kawuxing-fgui`：15 个包，约 72 个 component
- Cocos 工程 `input-ui/xuanwulobby/assets/42324`：60 个 TS 文件
  - `layer/` 14 个界面 View/Layer、`layer/comp/` 界面子组件
  - `component/` 3 个公共组件（手牌、角标、亮牌排序）
  - `protocol/` gameCmd 14 个 + recoverCmd 14 个 + 协议定义
  - `control/` 3 个 Controller、`data/`、`config/`

### 数据源映射（模板字段的提取依据）

| 文档字段 | 提取来源 |
|---|---|
| 界面清单、包依赖、层级 | 代码 `@FguiView({name, layer, packages, sortingOrder})` 装饰器 |
| 界面/组件结构 | FGUI `package.xml` + 组件 XML 的 KW_ 前缀节点 |
| 按钮交互 | `addClick(btn, handler)` |
| 内部事件监听/派发 | `@gf.listen(Event)` / `dispatch(Event)` |
| 界面跳转 | `pfbm.uiFgui("Xxx").showFgui()/hideFgui()` |
| 网络收 | `protocol/gameCmd/` 各 Cmd 的 `dealData`（含 dispatch 到的 GameEvent） |
| 网络发 | Controller 的 `sendXxx()`（BaseMahController 11 个 + BoxKaWuXingController 2 个） |
| 断线重连 | `protocol/recoverCmd/` 的 RelinkOnXxxCmd |
| 交互边界规则 | 代码注释（该工程注释密度高，注释即规则） |

## 3. 输出结构与五类文档职责

```
examples/ui-interaction-prd-extract/
  模块分析.md     # 总入口：模块概述 + 流程 loop 概览 + 界面/组件/事件/协议索引
  界面分析.md     # 界面总表：类型、分层、打开方式、层级关系图、生命周期
  流程分析.md     # 按一局流程串阶段：参与界面 + sequenceDiagram 时序 + 状态变化 + 边界
  界面/Xxx.md     # 每界面一份（10 个固定小节，见模板）
  组件/Xxx.md     # 仅交互组件（8 个固定小节，见模板）
```

五类文档对应需求的 5 层维度：

| 需求维度 | 承载文档 |
|---|---|
| 1. 模块 | 模块分析.md |
| 2. 流程 loop | 流程分析.md（+ 模块分析.md 第 2 节概览） |
| 3. 界面 | 界面分析.md（总表）+ 界面/Xxx.md（明细） |
| 4. 组件/交互/状态 | 界面/Xxx.md 第 4~6 节 + 组件/Xxx.md |
| 5. 事件 | 各文档事件小节 + 模块分析.md 附录协议索引 |

## 4. 关键规范

- 命名：界面/组件文档文件名 = 代码类名（与 FGUI 组件名一致）；标题用中文名 + 类名
- 交叉引用双向可达：模块分析 → 界面/组件 → 回模块分析；界面 ↔ 组件相对链接
- 界面类型三分类：全屏（Base 常驻）/ 弹层（按需 showFgui）/ 提示层（最高层短提示）
- 每个界面文档固定 10 节：基本信息 / 职责 / 布局结构 / 组件清单 / 用户交互 / 内部状态 / 监听事件 / 网络事件 / 界面跳转 / 边界规则

## 5. 模板清单（已交付）

| 文件 | 用途 |
|---|---|
| `templates/00-输出结构说明.md` | 目录结构、划分标准、命名与交叉引用规范、数据源映射 |
| `templates/模块分析-模板.md` | 总入口骨架 |
| `templates/界面分析-模板.md` | 界面总表骨架 |
| `templates/流程分析-模板.md` | 流程阶段骨架（含 sequenceDiagram 模式） |
| `templates/界面文档-模板.md` | 单界面 10 节骨架 |
| `templates/组件文档-模板.md` | 单组件 8 节骨架 |
| `templates/样例-界面文档-BoxKaWuXingMahMainView.md` | 真实数据填充的界面文档标杆样例 |

## 6. 后续待办

1. 按模板产出正式输出到 `examples/ui-interaction-prd-extract/`（可拆：先汇总三文档，再逐界面/组件）
2. 将 templates 内容整合成 SKILL.md 正式技能定义（分析流程步骤化）
