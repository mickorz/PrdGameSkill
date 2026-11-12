# PrdGameSkill 共享 RTM 增量改造执行计划

> 基线：`9426d9305fff830bab0e8d57c1a0671cc71689c7`（2026-11-12 核验当时 main 与此提交一致）
> 原则：保留已有 `game-prd-check` RTM T1~T3 成果，禁止从旧版覆盖；逐阶段提交、逐阶段验证。
> 本文为执行方案，不代表改造代码已提交。

## 1. 基线已实现能力（必须保留）

- `.opencode-workflows/workflows/game-prd-check.js`：需求/规则原子化、分片检查、RTM 汇总入口、原有问题清单与 Dashboard 流程。
- `.opencode-workflows/scripts/rtm-assemble.mjs`：分片组装、identity-map、证据校验、双指标、矩阵报告。
- `.claude/skills/game-prd-check/scripts/build-dashboard.mjs` 与 `dashboard/template.html`：兼容旧报告与 RTM 指标展示。
- `examples/game-prd-check-workflow/verify-rtm-assemble.js`：现有 Mock 验证（保持通过）。

## 2. 优先修复的基线问题

**P0：变量作用域。** `game-prd-check.js` 的 `reqResults` 和 `catalogResults` 在 `if (rtmEnabled)` 的块作用域内声明，而块外继续引用。修复办法：在条件块前声明 `let reqResults=[]; let catalogResults=[];`，在块内赋值（而不是再声明 `const`）。新增 RTM on/off 两条分支执行测试。

**P0：需求身份冲突。** 当前 `rtm-assemble.mjs` 依据“源文件 + 规范化原文哈希”分配稳定 ID，行号变化不影响，但需求原文轻微修改仍会生成新 ID。共享提取阶段需保留 exact-match，增加“来源锚点 + 历史候选匹配 + 冲突待确认”的持久化映射；不确定时不自动合并。

**P0：不以问题数量代替覆盖。** 所有扫描到的原子需求与适用 Rule / Bug 必须进入审计目录；任务未完成不得映射为 `pass` 或 `INSUFFICIENT`。

## 3. 最终架构

```
.opencode-workflows/
  workflows/
    prd-requirements-extract.js          # 新增：仅负责 PRD 扫描、原子需求提取、持久化身份和验收
    game-prd-check.js                   # 改造：消费公共需求资产，专注 game rule 检查
    ui-interaction-prd-extract.js       # 改造：消费公共需求资产，专注 UI baseline 检查
    bug-coverage-check.js              # 改造：消费公共需求资产，专注历史 bug 覆盖检查
    ui-interaction-baseline-extract.js  # 保留现有基准预处理能力
  scripts/
    rtm-assemble.mjs                    # 保留，抽取共用纯逻辑后变为 checker RTM 组装器
    requirements-build.mjs             # 新增：需求分片合并、ID 维护、校验、manifest
    validate-rtm.mjs                   # 新增：一致性/引用校验
  shared/rtm-core/
    schemas/                           # requirement、rule、bug、check、issue、manifest
    identity/                          # ID 映射库
    validators/                        # 路径、行号、引文、映射、范围校验
    report/                            # 确定性模板/统计

output/projects/{projectKey}/
  identity-map.json                    # 持久化身份，原子更新
  extractions/{extractionRunId}/
    requirements/parts/*.json
    requirements.json
    source-manifest.json
    validation.json
    manifest.json
  checks/{checkerId}/{checkRunId}/
    catalog/parts/*.json
    checks/*.json
    requirements-matrix.json
    issues.json
    report.md
    manifest.json
```

注意：路径仅为建议标准；若旧产物路径已经被用户/脚本依赖，应继续支持旧 `runsDir/outPath`，采用适配层迁移，不能静默破坏旧产物。

## 4. 共享契约

### Extraction Manifest
- `schemaVersion`、`projectKey`、`extractionRunId`、`sourceFiles[]`（相对路径 + SHA256）、`requirementsPath`、`identityMapVersion`、`validationStatus`。
- 验证源文件哈希不一致时不得继续沿用旧提取快照；可以显式重新提取。
- 提取器不读取 game/ui Rule 和 Bug，不判定需求是否正确或完整。

### Requirement
- `requirementId` 稳定跨运行；`reqKey` 可作为本轮提取临时键，不作为持久引用。
- `title`、`text`、`source:{file,section,fromLine,toLine}`、`sourceEvidence`、`identityStatus`。
- 保留已发现原子需求，即使该需求没有匹配任何规则；不能把规则不存在当作错误。

### Checker Contract
- 三个 Checker 统一通过 `requirementsPath` 和 `extractionRunId` 引用同一份提取快照。
- 无需重复提取需求；过渡期保留旧模式：未显式传共享需求路径时可使用旧路径，但必须标明 legacyMode。
- 映射关系、执行状态（completed/failed/skipped）、判定状态（pass/incomplete/conflict/missing/unverified/na/pending-confirm）分别保存。
- 规则身份带命名空间，例如 `game:...`、`ui:hzmj_ui_interaction:01#3`；原 UI `displayId=01#3` 保留。
- Bug 使用原始 Bug ID，不把历史 Bug 伪装为规则约束。

## 5. 逐阶段实施

### T0：基线修复与回归
- 修复 game `reqResults/catalogResults` 作用域。
- 跑 `verify-rtm-assemble.js`；新增 game workflow RTM 开/关烟雾测试。
- 输出基线测试日志；禁止任何数据契约重构。

### T1：独立共享需求提取 Workflow
- 从 `game-prd-check.js` 中抽出需求扫描、每文件分片提取 Prompt、身份匹配、引用校验；保留 Rule 扫描/Rule 原子化在 game Checker。
- `prd-requirements-extract.js` 产出 manifest、requirements、validation 和持久化 identity-map。
- 提取失败时明确列出文件/章节/未验证段，不以 partial 结果伪装成功。
- 可对同一提取快照做两次构建，验证稳定 ID 和覆盖情况。

### T2：game Checker 接入
- 在 `game-prd-check.js` 新增 `requirementsPath` / `extractionRunId`，删除内部重复需求提取的默认执行路径。
- Rule 原子化、检查分片、证据校验、矩阵报告和 Dashboard 逻辑保留。
- 修改 `rtm-assemble.mjs` 支持从共享 `requirements.json` 读取需求；保留旧 `requirements/parts` 模式用于兼容。
- 对比 `9426d93` Mock：问题类型/优先级、Rule 覆盖、统计、报告不应无依据变化。

### T3：UI Checker 接入
- 保持 `.opencode-workflows/workflows/ui-interaction-baseline-extract.js` 与已有基准文件不重生成。
- `ui-interaction-prd-extract.js` 使用共享 requirements；生成自身 Rule Catalog（支持 `01#N`、源码锚点、dead-code、现网差异）。
- 每条 Rule 输出检查结果，包括 pass / na / unverified；保留 scope=out 附录口径。
- 不混淆“客户端实现事实”与“产品必须遵循的要求”。
- 保留旧 Q01 展示编号和 Dashboard 解析兼容。

### T4：Bug Checker 接入
- `bug-coverage-check.js` 读取共享 requirements，建立 `bug-catalog.json` 与独立 `bug-coverage.json`。
- 保留历史 Bug ID 与每条 Bug 原始证据；支持一个 Bug 对多需求、多 Bug 对一需求。
- `NOT_APPLICABLE` 不计为 PASS；`INSUFFICIENT` 是证据不足而非通过；审核缺失/失败标 executionStatus=failed 且 verdict=null。
- 核对扫描 Bug ID 与返回 Bug ID 的差集、重复项、非法项；分批结果可重试。

### T5：统一报告与跨 Checker 组合
- 允许独立运行三个 Checker；统一报告引用同一 extractionRunId。
- 同一需求按 game/UI/Bug 维度展示各自结果；不能以一个维度的 pass 覆盖另一个维度的 missing。
- 保留原 Dashboard 与报告路径，可另建聚合入口；聚合时对三个维度分别展示完成率、失败组和未验证。

## 6. 验收门槛

1. 同一 PRD 提取快照在三个 Checker 中的 `requirementId` 一致。
2. 每个源 PRD 文件/被识别需求都存在，来源可追踪；未识别/未验证范围显式列出。
3. game Rule 全量、UI Rule 全量、Bug 清单全量，不因并发失败而标通过。
4. 跨运行 exact-match ID 不变化；轻微改写只在可确定匹配时复用，冲突留待人工确认。
5. 已有 RTM Mock 通过，新增三个 Checker fixture、出错分片、错误引用、文本变更、重跑、旧 Dashboard 回归通过。
6. 统计仅使用规范化且已验证事实；三种检查维度互不污染。
7. 不覆盖 `9426d93` 的既有运行数据；旧参数有兼容或明确迁移公告。

## 7. 推荐提交顺序

- `fix(rtm): scope and baseline smoke tests`
- `feat(rtm): shared requirements extraction workflow`
- `refactor(rtm): game checker consumes extraction snapshot`
- `feat(rtm): ui checker coverage matrix`
- `feat(rtm): bug checker traceability`
- `feat(rtm): cross-checker report` 

每次提交要有对应测试结果；如果无法跑真实 PRD，则标记为仅 mock 验证，不得宣称真实运行通过。
