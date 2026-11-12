# 杭州麻将 Dashboard RTM 方案——执行记录（P0 数据贯通）

> 对应方案：[杭州麻将Dashboard-RTM覆盖清单与规则映射修改方案.md](./杭州麻将Dashboard-RTM覆盖清单与规则映射修改方案.md)
> 执行时间：2026-11-12
> 提交记录：62b4cb6（P0 数据贯通）、26c8e2d/f76e8c6（统计口径修复）

## 一、方案评审结论

外部方案基于 20261112-02 HTML 实测（非纸面推断），核心判断全部成立：

- 旧 `coverage.json` 是"issue.module + 主题关键词"的文件级近似，`cleanRate=11/41` 不是规则通过率
- 本次运行 185 条问题实体的 `rule_ref` 全为空 → **纯 UI 改动（加表格列/CSS）无法展示需求-Rule 映射**，必须数据先行
- 方案的数据源决策（以 rtm-assemble 输出为唯一事实源、禁止旧 coverage 静默替代）与 v4 需求一致

评审结论：**方案可执行，P0~P3 分阶段合理**。

## 二、复用性验证结论（用户核心问题：能否复用之前的结果）

**结论：全部可复用，零重跑。** run-20261112 快照产物完备性核验：

| 前阶段产物 | 状态 | 复用方式 |
|---|---|---|
| 需求原子化（363 条 requirements.json + identity-map） | ✅ 完整 | 稳定 ID 直接供 Dashboard 消费 |
| 规则原子化（1455 条 rule-catalog.json，23 组分片） | ✅ 完整 | Rule 覆盖矩阵数据源 |
| 规则检查结果（23 个 checks/group-NN.json，1486 条 coverage） | ✅ 完整 | 需求×Rule 映射 + 证据 |
| 一致性检查结果（issues-raw 185 条） | ✅ 完整 | 174 条带 requirementRefs；11 条空 refs 为一致性问题（无需求定位），符合预期 |
| 矩阵组装（requirements-matrix.json） | ✅ 已组装（含口径修复） | Dashboard 投影数据源 |

## 三、P0 实施内容（已提交 62b4cb6）

**改动**：`build-dashboard.mjs` 新增 `--rtm <runDir>` 参数与 `buildRtmView()`：

- 读取运行快照的 `requirements-matrix.json` + `issues.json`
- 组装 Dashboard 视图模型（schemaVersion 2）：`statistics`（双指标 + na 计数）、`requirements[].ruleLinks`（需求→Rule 含证据/执行状态/判定）、`rules[]`（Rule→requirementIds/issueIds 反向索引）、`issues[]`（问题→requirementIds/ruleIds 反向映射）
- 注入 `data.rtm` 随 `__REPORT_JSON__` 内嵌单文件 HTML——满足验收条件 9（file:// 离线可用，不依赖运行时 fetch）
- **缺失 RTM 快照直接报错**，禁止旧 coverage.json 静默替代（方案执行原则）

**验证（run-20261112 实测）**：

- 三向追溯全通：REQ-001 → 21 条 ruleLinks + 13 个 issueIds；R09-005 反向 → requirementIds 含 REQ-001 且 issueIds 一致；PRD-005 反向 → 4 个 requirementIds + 31 个 ruleIds
- 无规则关联需求 148 条如实保留（见遗留 3）

## 四、执行中发现并处理的问题

1. **`buildRtmView` 内 `const issues = issues.map(...)` 自引用声明错误**——编译期报重复声明，改名 `issuesView` 修复
2. **完成率 104.93% 超 100%**（见 f76e8c6）——na 状态（agent 确认不适用，468 条）被计入适用分母；修复：适用口径 = 非 na，完成率 = 非 unverified / 非 na → 99.3%
3. **枚举外状态 ambiguous（3 条）**——检查 agent 输出规范外状态；修复：normStatus 归一化为 incomplete
4. mock 断言同步新口径（26c8e2d），assemble 15 断言 + requirements-build 16 断言全过

## 五、遗留待办

| # | 事项 | 说明 |
|---|---|---|
| 1 | **P1~P3 UI 改造**（方案 3.2/3.3/3.4） | template.html 4 Tab 导航、需求检查矩阵页、Rule 文件折叠/条款明细、详情抽屉三向跳转；数据已就绪（data.rtm 已内嵌） |
| 2 | **矩阵章节追加静默失败** | 本次运行 report.md 尾部无矩阵章节（runDir/matrix-report.md 已生成但合并 agent 降级无日志）；workflow 中矩阵合并失败需补日志；正式报告交付前须修复 |
| 3 | **术语表提取补丁** | 363 需求点未覆盖术语表中 ~10 行规则性定义（【承包】【倒承包】【听牌】等）；提取 prompt 补一句口径，下轮生效 |
| 4 | **unverified 需求点 148 条的边界** | 主体为"游戏规则概述"章节摘要性需求点（检查 coverage 未回链概述需求点）；如实展示为未验证，符合"不虚假标通过"；映射增强列后续迭代 |
| 5 | Dashboard 交互测试（方案第 4 节最后一条） | 随 P1~P3 一并做：离线加载/Tab 切换/跳转/长列表/移动端 |

## 六、验收对照（方案第 6 节）

| 验收项 | 状态 |
|---|---|
| 7. 从同一 runId 产物构建；指纹不匹配报警 | ✅ P0 已实现（--rtm 指定 runDir，缺文件报错） |
| 9. 单文件 HTML file:// 完整可用 | ✅ rtm 数据内嵌 report-data |
| 10. 不破坏旧 Dashboard | ✅ 无 --rtm 时行为与旧版一致（已回归） |
| 1/2. 需求/规则全量出现在矩阵 | ✅ 数据层满足（363/1455 全量），UI 呈现待 P1/P2 |
| 3. 三向追溯 | ✅ 数据层验证通过，UI 交互待 P1/P3 |
| 4/5/6/8. 分母准确/失败可见/不猜测映射/旧报告降级提示 | ⏳ 随 P1~P3 UI 实施 |
