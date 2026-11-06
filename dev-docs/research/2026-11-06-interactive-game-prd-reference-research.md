# Interactive Game PRD 参考项目调研报告（P0-09）

> 日期：2026-11-06  
> 依据：六篇单项目研究笔记（同目录 `2026-11-06-ref-*.md`）+ 需求文档 v1.1  
> 结论先行：六个项目均**不集成运行时**进本仓库（需求文档 11.2 原则 7）；可复用代码仅限两处小函数（定位、HTML 渲染器待评估）；核心收获是 8 项可借鉴思想与 2 个反面教训。

## 1. 六项目能力对比

| 能力维度 | PRD Pilot | PRD HTML Generator | PRD Writer | Arrow | GDD-Forge | Game Doc Forge |
|---|---|---|---|---|---|---|
| 结构化需求模型 | 强（共享 Spec 单一事实源） | 无 | 中（14 章节 + 元数据头） | 中（节点图 JSON） | 强（Manifest/Feature/Segment） | 中（账本行） |
| 需求 ID 体系 | 无显式 ID | data-prd-target 稳定 ID | 有（GDD-4-001 式） | 无 | 有（Feature id） | 有（行 ID） |
| HTML 生成 | 有（Web 服务） | 强（单文件离线模板） | 强（自包含 HTML 导出） | 强（单文件离线可玩） | 无（Web 应用） | 无 |
| PRD 与 UI 定位 | 无 | 强（锚点 + 高亮） | 中（tag + src 标注） | 无 | 无 | 无 |
| 质量检查 | 强（纯规则门禁 + 一致性 6 项） | 无程序化校验 | 有 QA 脚本 | 无 | 无 schema 校验 | 强（审计五遍扫描） |
| 决策/审查机制 | issue 即 action | Checklist 人工 | 元数据声明 | 无 | Decision 三态 | 强（账本五状态 + 审计） |
| 离线运行 | 否（API 服务） | 是 | 基本是（mermaid 走 CDN） | 是 | 否 | 不适用 |

## 2. 复用决策表

| 能力项 | 结论 | 来源 | 理由 |
|---|---|---|---|
| 属性化锚点定位契约（data-* + querySelector） | 复用代码（focusPrdTarget 等定位函数改写） | REF-002（Apache-2.0） | 与本项目的 data-component-id / data-requirements 契约同构，含隐藏容器先开后定位、scroll-margin 防遮挡等已踩坑细节 |
| 单文件离线导出（数据内嵌 const DATA） | 借鉴思想 | REF-002 + REF-004 | 两家独立验证同一方案，契合 file:// 硬约束；实现自行编写 |
| 导出净化（剥离开发期字段） | 借鉴思想 | REF-004 的 revise_play_ready | HTML 产物不应携带 open_questions 内部备注 |
| 共享 Spec 单一事实源 + normalize 兜底 | 借鉴思想 | REF-001 | 构建前对 IR 做归一化兜底，validate-ir 保持纯校验不混杂修复 |
| 生成-门禁-修复管道 + issue 即 action | 借鉴思想 | REF-001 | validate 输出的问题直接映射修复动作，供 P5 Update 工作流使用 |
| change_type 枚举 + 影响范围元数据 | 借鉴思想 | REF-001 | Update 工作流变更记录的字段设计参考 |
| Decision 三态（open/taken/reverted）与账本五状态 | 借鉴思想 | REF-005 + REF-006 | 融入 IR 的 status/authority 与 decision-log.json 设计；assumed 状态对应我们的 delegated |
| 审计五遍扫描 + Blocking 打回 | 借鉴思想 | REF-006 | review-requirements 工作流的检查结构模板 |
| 节点解释器表驱动求值（无 eval） | 借鉴思想 | REF-004 | P4 规则引擎的动作分发表设计 |
| 场景回放状态快照 | 自研（反面教训） | REF-004 | Arrow 回溯不回滚变量导致状态漂移；P4 场景加载必须做状态深拷贝快照 |
| Schema 强校验 | 自研（反面教训） | REF-005 | GDD-Forge 的 Segment data 按 any 处理、无校验，恰是我们 IR 的核心诉求 |
| 需求条目级追溯（非章节级） | 自研强化 | REF-003 | PRD Writer 只追溯到章节；我们用 GAME-XXX ID + source-map 追溯到行 |
| PRD Writer 的 prd-to-html.py 渲染器 | 暂不复用（待评估） | REF-003（MIT） | Python 栈与 Node 不匹配；若 P3 Markdown 渲染需求复杂再评估移植 |

## 3. 明确不采用与不集成

- 六个项目的运行时/服务均不集成进本仓库（PRD Pilot 的 Python Web 服务、GDD-Forge 的 Next.js 应用、Arrow 的 Godot 工程、PRD Writer 的 Python 脚本链）。
- GDD-Forge 无 LICENSE 文件（README 仅口头提及），**禁止复制任何代码**，仅可借鉴思想。
- 不采用：叙事向节点全集与 BBCode（Arrow）、style04 视觉主题与内置 CRUD 骨架（REF-002）、无校验的 AI 转写一致性机制（REF-002，我们改用程序化 ID 一致性校验）、Mermaid CDN 方案（REF-003，破坏离线约束）、关键词命中式检查作最终判据（REF-001）。

## 4. 对 IR 设计的直接输入（供 P1 引用）

1. IR 顶层 manifest 采用自描述头（格式 magic + version），参考 GDD-Forge 的迁移友好性。
2. 引用数组字段（ui_refs/test_refs/dependencies）删除时必须反查清理引用，参考 GDD-Forge Feature 的做法，validate-ir 增加悬空引用检查。
3. decision-log.json 记录结构参考账本五状态 + Decision 三态合并：每条决策含 id、type、状态、rationale、影响需求 ID、decided_by、时间戳。
4. validate-ir 的检查结构参考 PRD Pilot 门禁（每项检查有结构化错误码），问题报告直接携带修复建议（issue 即 action）。
5. HTML 定位沿用 data-* 属性契约 + 「隐藏容器先开再定位」+ scroll-margin，直接改写 REF-002 的三个定位函数（保留 Apache-2.0 版权注释）。
6. 模拟器规则引擎用表驱动（动作类型 → 处理函数），状态变更前做快照以支持场景重放。

## 5. 遗留

- P0-10（原始卡五星 PRD）外部依赖未到位，挂起；结构分析将在文档到手后补做，结论追加至本报告第 4 节。
