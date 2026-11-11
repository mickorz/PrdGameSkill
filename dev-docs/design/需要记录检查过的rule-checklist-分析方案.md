# 需求分析：检查覆盖清单（rule-checklist）展示

> 需求来源：[需要记录检查过的rule-checklist.md](./需要记录检查过的rule-checklist.md)
> 分析日期：2026-11-11

## 一、需求解读

**原话要点**：当前检查报告 HTML 只有"有问题"视角（PRD 遗漏了什么），没有"检查了什么、哪些通过了"的记录。需要补充展示：一共做了多少项 rule 检查、哪些 rule 通过、通过率多少，用于向上级汇报。范围约束：先改 report.md 和 html 模板，不动 workflow js 和 skill。

**本质**：报告缺"工作量与覆盖面"视角。现有报告回答的是"PRD 有什么问题"，汇报需要回答的是"我们对照基准查了多少条规则、查得多全面"。两者互补，缺后者则 154 个问题没有分母衬托，无法体现检查工作的完整度。

## 二、现状数据流与缺口

```text
workflow 检查逻辑 → report.md → report.json → build-dashboard.mjs + template.html → Dashboard HTML
（本次不动）        （要改）      （要加数据）    （要改：装配 + 模板区块）
```

现状各产物只有问题视角：

| 产物 | 现有内容 | 缺口 |
|---|---|---|
| report.md | 检查概览（问题数）、主题分布、问题清单、重点详情 | 无检查覆盖章节 |
| report.json | issues/statistics/risk_groups 等 | 无 coverage 字段 |
| template.html | KPI（问题数）、分布图、清单 | 无"检查项/通过率"展示 |

## 三、数据可得性盘点（可行性核心）

三路检查的规则基准格式与 issue 引用完备度不同，直接决定"通过率"能算到什么粒度：

| 检查路 | 分母（检查项） | 分子（命中问题的项） | 结论 |
|---|---|---|---|
| UI 交互（ui-interaction-prd-extract） | 9 个基准文件，条款为编号列表（`1. 2. 3.`），可精确计数 | `issues[].rule_ref` 精确到条款号（如 `01#3`），现有 report.json 已有 33 个唯一引用 | **条款级精确通过率可做** |
| PRD 功能规则（game-prd-check-workflow） | `rules/hzmj_game_flow_handler/` 41 个规则文件，格式为章节（`## 一、`）+ 列表项混合 | **issues 无 ruleRef 字段**，详情块为散文式描述，无法反推命中条款 | 只能做**文件级近似**：issue 按 module/主题映射到规则文件 |
| Bug 覆盖（bug-coverage-check） | 分母口径不同（35 条历史缺陷复核，非规则条款） | `rule_ref` 全为空 | 口径不同，建议不混入本次通过率，单独展示 |

**PRD 版"通过"的口径问题（关键）**：检查流程按规则分组对照进行，agent 发现问题才报告，"未被问题引用"严格说是"未发现问题"而非"确认逐条核对通过"。汇报口径建议用**"未发现问题"**，避免上级追问"你怎么证明这条检查过"时无法自证。UI 版因有条款级引用，可以宣称"条款级核对"。

## 四、需求文档中的两个矛盾点（需确认）

1. **"修改 html 模板" vs "先不要动 skill"**：html 模板物理上在 `.claude/skills/game-prd-check/dashboard/template.html`，数据装配在 `.claude/skills/game-prd-check/scripts/build-dashboard.mjs`。合理解读：不动的是**检查流程逻辑**（workflow js、SKILL.md 检查流程、rules 基准文件），展示层工具（template.html + build-dashboard.mjs）属于"html 模板"范畴可以改。**本分析按此解读，若不符请指出。**
2. **"当前检查报告 html" 指哪份**：从"prd 遗漏"上下文判断为 PRD 功能规则版（game-prd-check-workflow）。建议本次以 PRD 版为主，UI 版数据现成可顺带支持，Bug 版单独口径不混入。

## 五、方案设计（按范围约束：不动 workflow js / SKILL.md / rules）

### 5.1 数据生成（一次性脚本，不属于检查流程）

新建 `examples/game-prd-check-workflow/gen-coverage.mjs`（临时工具脚本）：

- 解析 41 个规则文件 → 每文件章节清单（`## ` 标题），得到分母
- 154 个 issue 按 `module` 字段映射到规则文件（module 命名与规则文件主题的映射表硬编码在脚本里），得到文件级命中
- 输出 `coverage.json`：

```json
{
  "totalFiles": 41,
  "totalSections": 158,
  "hitFiles": 12,
  "cleanFiles": 29,
  "passRateText": "29/41 文件未发现问题",
  "items": [
    { "file": "01-开局", "sections": 4, "issueIds": ["PRD-010"], "status": "hit" },
    { "file": "05-牌墙", "sections": 3, "issueIds": [], "status": "clean" }
  ]
}
```

### 5.2 report.md 增加章节

末尾追加 `## 4. 检查覆盖清单`：汇总表（41 文件 / 158 章节 / 12 文件关联问题 / 通过率口径）+ 逐文件表格（文件 | 章节数 | 关联问题 | 状态）。

### 5.3 template.html + build-dashboard.mjs（展示层）

- **KPI 行扩展**：加一张"检查覆盖"卡（检查项总数 + 未发现问题率），与现有 4 张问题视角 KPI 并列
- **新增 `sec-coverage` 卡片**（插在检查结论之后）：覆盖率进度条/环形图 + 逐规则文件覆盖表，`hit` 状态可点击跳到问题清单（复用现有筛选交互）
- **build-dashboard.mjs**：读取 `coverage.json`（与 report.json 同目录），注入 `__REPORT_JSON__` 时合并 `coverage` 字段；模板渲染脚本对无 coverage 的旧报告做兼容（区块隐藏）

### 5.4 验证

重跑 build-dashboard.mjs 生成新 HTML，浏览器验证 KPI、覆盖表、点击筛选、console 无报错。

## 六、工作量与顺序

| 步骤 | 内容 | 预估 |
|---|---|---|
| 1 | gen-coverage.mjs + 跑出 coverage.json | 1~2h（module→文件映射表是主要工作量） |
| 2 | report.md 手工补章节 | 0.5h |
| 3 | template.html 加 KPI 卡 + sec-coverage 区块 | 1~2h |
| 4 | build-dashboard.mjs 装配 + 兼容旧报告 | 0.5h |
| 5 | 浏览器验证 + 提交 | 0.5h |

## 七、遗留与后续（本次不做）

1. **workflow 侧根治**：game-prd-check.js 的 issue 增加 `ruleRefs` 字段（检查时记录命中条款号），后续重跑即可得条款级精确覆盖——本次按约束不动
2. **UI 版条款级覆盖**：数据现成（9 基准文件编号条款 + rule_ref 精确引用），可作为第二步把三份 dashboard 的合并版统一加覆盖视图
3. **Bug 覆盖率**：口径是"缺陷复核率"（PASS/PARTIAL/MISSING），建议单独一张卡，不与规则通过率混合
