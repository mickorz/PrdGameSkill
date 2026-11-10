# TODO：裁决后续演进方向（P2/P3，评审登记）

- 日期：2026-11-10
- 来源：人工评审（2026-11-10 12:17，对 P0-P3 + UI 浏览增强的评审结论）
- 状态：已完成（2026-11-10 当日执行，P2 影响清单 + P3 双向关联链路均已落地，见下）

## 评审确认结论

- P0 工作空间拆分、P1 五类独立渲染、P2/P3 裁决卡片交互与数据兼容、UI 组件浏览增强均验收通过。
- 多选同结论合并单记录未破坏 apply-decisions 一问一裁契约，被认可。
- 总体方向：从 PRD 转换工具演进为「规格浏览 + 人工裁决 + UI 演示 + 测试验证」一体化工作台。

## P2：裁决影响分析与规格联动（已实现）

裁决链路 `OQ → 人工裁决 → decisions.json → apply-decisions` 已通，后续需覆盖：

`人工裁决 → GAME-SPEC 更新 → GDD / PRD / Interaction 更新 → 测试用例更新`

需验证的影响维度（已在影响清单中落地）：

- 规则修改后，关联测试是否需要更新：清单每项列出需复核测试（需求 test_refs ∪ 用例 related_requirements 反查）
- 配置修改后，关联数值是否需要更新：清单列出关联需求与状态迁移/依赖
- 状态机修改后，相关状态迁移是否需要重新验证：清单列出 state_transitions 与 dependencies
- 新裁决是否正确 supersedes 旧裁决：清单保留 supersedes 字段可见

实施原则（评审明确要求）：**不自动修改规格文件，先生成影响清单，再由人工确认执行。** 已落地：裁决工作台顶部「生成影响清单」按钮 → 基于已正式裁决（内存 + decision-log）汇总 → 表格展示（待同步需求/需复核测试/需复核 UI 与事件/状态迁移与依赖/模拟器回归）→ 可导出 impact-checklist.json（human_review.confirmed 默认 false，声明不自动修改任何规格文件）。

## P3：UI 页面与组件的双向关联（已实现）

目标链路：

`GAME-FR → GAME-UI 页面 → UI Component → Events → Interaction Contract → Tests`

已落地（2026-11-10）：

- 页面 → 组件 → 事件：GAME-UI 分类组件行下直接列出事件行（事件名 + 触发方式），点击进事件详情
- 事件 → 需求 → 测试：事件详情含触发组件反查、服务需求（可点击跳规格工作台）、覆盖测试反查（需求 test_refs ∪ 用例 related_requirements）
- 需求 → 测试：需求详情新增「覆盖测试（反查）」字段
- 测试 → 需求：Tests Tab 用例行关联需求改为可点击链接，跳规格工作台对应分类
- Interaction Contract：CT 条目不在 IR 数据内（GSG spec-generation 链路产物），事件详情中明示指引到 examples/mahjong/spec-generation/Interaction-Contract.yaml，不展示不推断
- 修复两个附带问题：切分类自动重置残留筛选（避免 FR 分类搜索关键词过滤后续分类）；rAF 改 setTimeout（后台标签页 rAF 暂停，见 dev-docs/experience/2026-11-10-chrome-background-tab-raf-pause.md）

验证：mahjong-smoke 69 项全绿（P3 事件链路 7 项 + P2 影响清单 4 项新增断言）；Chrome file:// 实测全链路通过。

## 优先级

1. P1 裁决草稿持久化（同日已执行，见 dev-docs/todos/2026-11-10-decision-draft-persistence.md）
2. P2 裁决影响分析与规格联动（本文件）
3. P3 UI 交互关系完善（本文件）
