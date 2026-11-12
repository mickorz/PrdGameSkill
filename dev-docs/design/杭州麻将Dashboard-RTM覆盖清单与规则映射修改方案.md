# 杭州麻将 Dashboard：RTM 覆盖清单与需求-Rule 映射修改方案

## 0. 基线与审查证据

- 基线：`mickorz/PrdGameSkill` 的 `9426d93`，**增量调整、不推倒已有 RTM**。
- 实际审查文件：`杭州麻将分析-Dashboard-20261112-02.html`，不是仅凭设计稿推断。
- 成品数据：`statistics.total=185`；旧版 `coverage` 共 41 个规则文件、166 个章节、30 个文件关联问题、11 个文件未发现问题。`coverage.generated_at=2026-11-11`。
- 旧 `coverage.mapping` 明确写着“issue.module + 主题关键词，文件级近似；无关联问题 = 未发现问题，不等同逐条确认通过”。有 `unmappedIssues` 6 项。
- 185 条 `issues` 中 `rule_ref` 均为空；成品 JSON **没有** `coverageStats`、`requirements-matrix`、`rule-catalog`。因此**不能通过纯 CSS 或增加表格列**展示真正的需求-Rule 关系。
- 当前 UI 使用 `sec-coverage` 纵向长表，列为规则文件、章节数、关联问题、状态。点击文件行只筛选关联问题，无法打开规则条款/需求原文；`cleanRate=11/41` 不是 Rule 通过率。

## 1. 目标与边界

**目标 A：检查覆盖视图可读**：区分“完成检查”“通过检查”“未发现关联问题”“未验证”，按规则文件折叠到原子条款，支持筛选、搜索、聚合统计。

**目标 B：每一条 PRD 原子需求都能看到对应的 Rule 和本次检查结论**；没有对应 Rule、一个 Rule 对多个需求、多 Rule 对一需求、完全漏写 PRD 的预期需求均能显示。

**目标 C：三向可追溯**：需求详情→规则详情→对应问题；规则详情→关联需求→证据；问题详情→需求/规则。

保留已有问题清单、风险卡片和 P0~P3 详情体验。不要因 UI 重构损坏老报告；没有 RTM 数据时要显示“旧版文件级近似覆盖”及无法显示原子映射的原因。

## 2. 数据优先：统一唯一事实源

不再用 `coverage.json` 的模块关键词匹配结果推导 Rule 检查通过；新 RTM 的来源必须是 `rtm-assemble.mjs` 输出：

- `requirements.json`：全部实际提取需求（稳定 `requirementId`、title、source、text）。
- `rule-catalog.json`：完整 Rule 原子条款（`ruleId`、file、section、text、mandatory、scope/适用性）。
- `requirements-matrix.json`：需求与 Rule 的多对多链接；每个链接包含 `executionStatus`、`verdict`、`evidence`、`issueIds`。
- `issues.json`：问题实体，至少带 `requirementIds[]`、`ruleIds[]`（可为空，且必须解释原因）。
- `manifest.json`：`runId`、`extractionRunId`、源 PRD/Rule 指纹、检查器版本、失败组、警告、输出状态。

**约束**：旧版组装器的状态字段如 `status` 可继续兼容，但正式结构需分开存储：关联是否存在（mapped/unmapped）、执行状态（completed/failed/skipped）、检查判断（pass/incomplete/conflict/missing/na/pending-confirm/unverified）。不得将缺少记录视为 pass。

### 2.1 增加适合 Dashboard 的视图模型

在 `.opencode-workflows/scripts/rtm-assemble.mjs` 或独立投影脚本生成 `dashboard-rtm.json`（可以打包进单文件 HTML 的 `report-data`，避免浏览器访问本地 JSON 的 file:// 限制），示意：

```json
{
  "schema_version": 2,
  "rtm": {
    "runId": "20261112-001",
    "statistics": {
      "requirementTotal": 0,
      "rulePointTotal": 0,
      "applicableRulePoints": 0,
      "checkedRulePoints": 0,
      "passedRulePoints": 0,
      "unverifiedRulePoints": 0
    },
    "requirements": [{
      "requirementId": "REQ-001",
      "title": "示例需求",
      "source": {"file":"input/xxx.md","section":"2.1","fromLine":10,"toLine":15},
      "text":"原文",
      "ruleLinks": [{
        "ruleId":"game:flow:R01-001",
        "executionStatus":"completed",
        "verdict":"pass",
        "evidence":"原文与判断依据",
        "issueIds":[]
      }],
      "overallStatus":"pass"
    }],
    "rules": [{
      "ruleId":"game:flow:R01-001",
      "file":"01-开局.md",
      "section":"发牌",
      "text":"原始 Rule 条款",
      "requirementIds":["REQ-001"],
      "executionStatus":"completed",
      "verdict":"pass",
      "issueIds":[]
    }]
  }
}
```

示例值仅用于约定结构；禁止直接填入当前真实报告。

### 2.2 特殊情况

- **Rule 没有匹配 PRD**：显示独立规则行，范围/强制性已确认时允许判 `missing`；未确认时标“待确认”，不得直接判需求缺失。
- **PRD 没有匹配 Rule**：仍显示需求行，标“无规则对应／待确认”，不是“正常”。
- **检查组失败/证据无效**：即使 AI 返回 pass 也显示“未验证”。
- **同一需求多规则**：汇总状态用于快速排序；详情逐个展示，不用单一总状态掩盖混合结果。
- **相同规则多需求**：对应多个关联行，不可将多条记录硬压成一个 verdict。
- **旧字段 `rule_ref` 全空**：不得推测补全；只有组装器中的真实 ruleLinks 才能回填关联。

## 3. Dashboard 页面改造

### 3.1 一级导航

建议 4 个 Tab：**总览**（沿用已有 KPI、风险分析）、**需求检查矩阵**（新重点）、**Rule 覆盖矩阵**（替换旧覆盖长表）、**问题清单**（沿用）。兼容单文件离线运行。搜索、状态、模块、规则文件等筛选在各自 Tab 内独立保留。

### 3.2 需求检查矩阵（新增，最重要）

主表列：`需求 ID | 需求点标题 | PRD 来源 | 对应 Rule（数量+编号） | 检查状态 | 关联问题`。

- 按模块/章节分组，支持折叠；默认显示全部需求而不仅是问题项。
- Rule 列展示前 2~3 个真实 Rule ID、更多数量；点击直接打开条款详情。
- 点击需求行打开右侧详情抽屉：完整 PRD 原文、源文件+章节+行号、逐条 Rule 原文与编号、每条检查证据/执行状态/判断、关联问题及跳转。
- 筛选：全部/通过/不完整/冲突/缺失/未验证/待确认/无对应 Rule；支持需求 ID、标题、Rule ID 文本搜索。
- 顶部附需求总数、已映射需求数、未映射数、未验证数。不要和 Rule 检查完成率混为一谈。

### 3.3 Rule 覆盖矩阵（重构现有“检查覆盖清单”）

第一层规则文件折叠行：`文件名 | Rule 总数 | 已检查数 | 通过数 | 不通过数 | 未验证数 | 完成率`。

展开后是 Rule 原子条款表：`Rule ID | 规则摘要 | 对应需求（ID+数量） | 执行状态 | 符合性判断 | 问题数`。

- 点击 Rule 显示完整 Rule 原文、原文锚点、关联需求及证据、相关问题。
- 筛选：规则文件、状态、无对应需求、有问题、未验证；默认按“问题/未验证在前”。
- 禁止把“关联问题为空”渲染成“检查通过”。
- 总览 KPI 使用明确公式：`完成率=已完成的适用 Rule 点数/全部适用 Rule 点数`；`通过率=已通过的适用 Rule 点数/已完成的适用 Rule 点数`；适用性未确认需单列。
- 为旧文件级覆盖提供折叠的“历史近似统计”区，不再作为首要 KPI，也不称为通过率。

### 3.4 问题详情增加反向链接

旧 `PRD-xxx` 问题详情抽屉新增 `关联需求` 和 `检查规则` 区域。真实关联存在才显示可点击 ID；旧数据没有 `rule_ref` 时显示“缺少 RTM 映射数据”，禁止猜测。

## 4. 需要修改的代码位置

| 路径 | 修改事项 |
|---|---|
| `.opencode-workflows/scripts/rtm-assemble.mjs` | 保持现有组装和验证；增加可视化投影数据、双向 ID 索引、分离执行状态与判定；补齐来源/映射字段 |
| `.opencode-workflows/workflows/game-prd-check.js` | 将 RTM 的 JSON 产物路径传给 Dashboard 构建阶段；保证输出同一次运行的快照；修复已知 `reqResults/catalogResults` 块作用域问题（若仍存在） |
| `.claude/skills/game-prd-check/scripts/build-dashboard.mjs` | 新增 `--rtm <path>` 或等价明确参数；优先读取 RTM JSON，生成含 rtm 的内嵌单文件 HTML；旧报告回退旧模式并给准确警示 |
| `.claude/skills/game-prd-check/dashboard/template.html` | 导航 Tab、需求矩阵、Rule 文件折叠/条款明细、Rule/需求详情抽屉、问题反向跳转、筛选 |
| `examples/game-prd-check-workflow/verify-rtm-assemble.js` | 补充同一需求多规则、单规则多需求、无匹配、失败降级、ID 双向索引、统计一致性测试 |
| 新增 Dashboard 交互测试 | 验证本地离线加载、Tab 切换、Rule↔REQ↔Issue 跳转、长列表滚动、移动端展示 |

## 5. 分阶段实施

- **P0-数据贯通**：确认当前报告实际 runDir；读取本次 `requirements-matrix.json`、`rule-catalog.json`、`issues.json`，构建 Dashboard RTM 数据投影；缺失产物要明确失败而不是用旧 `coverage.json` 静默替代。若这份 HTML 所属运行没有 RTM 数据，只能重跑对应 RTM 检查，不能由关键词猜测映射。
- **P1-需求视图**：增加“需求检查矩阵”和需求抽屉，能显示真实多对多 Rule、原文及每条检查结论。
- **P2-Rule 视图**：替换现有文件级覆盖表为文件→条款两层结构；将完成率/通过率放入总览，并准确处理 NA/未验证。
- **P3-联动与兼容**：问题详情双向跳转、旧报告兼容显示、离线/响应式体验和回归测试。

## 6. 必须通过的验收

1. 本次 RTM 中的每一个提取需求都出现在“需求检查矩阵”；正常需求也可见。
2. 每个适用的原子 Rule 都出现在“Rule 覆盖矩阵”；没有对应 PRD 的 Rule 仍可见。
3. 任意 REQ 能打开对应的所有 Rule 原文、检查状态与证据；反向 Rule 能定位 REQ 和 Issue。
4. 完成率、通过率的分母准确，且不等于旧版“未发现问题文件率”。
5. 失败组、无效证据、缺失映射分别可见；不会被误判为 pass。
6. `rule_ref` 为空时显示缺数据提示，不会推断并制造虚假映射。
7. 从同一 `runId` 的产物构建；版本或指纹不匹配直接报警。
8. 41 文件、166 章节、185 问题这类旧报告依旧可打开，但明确显示“旧版文件级近似覆盖”，且不显示虚假 RTM 完成率。
9. 单文件 HTML 在 `file://` 下完整可用，不依赖运行时 fetch 本地 JSON。
10. 保留现有问题详情/打印能力，增量改造不能破坏旧 Dashboard。

## 7. 执行原则

以提交 `9426d93` 为已完成 RTM 基线，不重写提取器。先确保真实结构化 RTM 结果被正确传到 Dashboard，再做 UI 改版。没有真实映射数据时，增加表格列也解决不了问题。
