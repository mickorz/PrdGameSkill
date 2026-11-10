# workflow 版 report.md 转 Dashboard 可行性分析

日期：2026-11-10
分析对象：examples/game-prd-check-workflow/report.md（opencode workflow 路线产物，144 条问题）
参照实现：.claude/skills/game-prd-check/scripts/build-dashboard.mjs + dashboard/template.html（GPC-D1，skill 路线 Dashboard）

## 一、结论先行

**可行，且工作量小（预计半天内）。Dashboard 模板零改动，核心工作是解析器（parseReport）升级为双格式自适应。** 不建议新建独立转换工具。

两条路线的报告四段骨架（概览 / 问题清单 / 详情 / 总体建议）完全一致——workflow 路线本就是按同一套 SKILL.md 口径生成的，差异都在字段层。

## 二、类比理解

现有 build-dashboard.mjs 像一个「只会读一种方言的誊写员」：skill 版 report.md 是它认识的方言。workflow 版 report.md 说的是「同一门语言的另一种口音」——句子结构相同（四段骨架、优先级、处理状态、结论词），个别词汇不同（第二列从「类型」换成「主题」、「类型」字段改叫「问题性质」）。要做的不是雇第二个誊写员（独立转换工具），而是教现有誊写员听懂第二种口音（parser 自适应），后面排版车间（template.html + 校验）完全复用。

## 三、格式差异清单（已逐项核对原文）

| # | 差异点 | skill 版 | workflow 版 | 影响 | 对策 |
|---|---|---|---|---|---|
| 1 | **详情块覆盖** | 45 条全有详情 | 144 条清单，仅 84 块详情（60 条 P2/P3 只进清单） | 当前 parser 以详情块为全集，直接跑会丢 60 条 | 解析改为「清单表为全集，详情按 ID 合并」；对 skill 版也更稳健 |
| 2 | **清单第二列语义** | 类型（MISSING 等英文枚举） | 主题（22 个中文主题名） | 类型无法从清单取 | 类型改从详情块取；无详情条目类型允许空 |
| 3 | **详情块字段名** | `- 类型：MISSING` | `- 主题：xxx` + `- 问题性质：需求缺失` | 字段名不同 | 双字段名兼容；「问题性质」的中文值域与 skill 版 TYPE_ZH 值完全一致（需求缺失/内容冲突/逻辑错误/定义歧义/描述不完整），类型图表数据直接可用 |
| 4 | **规则基准格式** | `- ` 列表多行 | 单行内联 `规则基准：xxx` | baselines 取空 | 兼容：先找列表，无则取冒号后内联值 |
| 5 | **类型分布数据源** | 「类型分布：MISSING 18、...」行 | 无此行，改为「### 主题分布」表（22 主题×数量） | 类型交叉校验缺失（statistics 本就由 issues 计算，不受影响） | typeDist 为空时跳过校验（现有逻辑已兼容）；主题直接成为 modules 数据源 |
| 6 | **风险组关键词** | 「属资损风险」 | 「直接导致金额算错的规则冲突」 | 启发式提不出资损组 | 关键词扩展（资损/金额/赔付/计分）或资损组缺失时隐藏（模板已支持） |

兼容无压力的部分：概览表五行指标、优先级体系（P0-P3）、详情块标题（`### PRD-XXX：标题`）、原文引用行（`> `）、问题/影响/建议/处理状态字段、总体建议三要点结构、结论判定词（「暂缓」）均一致。

## 四、方案比选

| 方案 | 说明 | 评价 |
|---|---|---|
| A. parser 自适应（推荐） | 清单驱动 + 详情合并 + 字段名双兼容，一套脚本吃两种格式 | 改动集中在一处；产物 report.json 结构不变，模板零改动；CLI 已支持任意路径 `node build-dashboard.mjs examples/game-prd-check-workflow/report.md` |
| B. 独立转换工具 | workflow report.md -> 转成 skill 版格式 -> 走现有管线 | 多一层中转、多一份维护；且 skill 格式无「主题」列，转译会丢主题信息（而主题正是 workflow 版更有价值的数据） |
| C. workflow 路线改造自己的输出 | 让 workflow 脚本直接产出 skill 格式 | 治本但跨会话协调成本高，且两条路线收敛问题尚未裁决（见执行进度遗留） |

## 五、额外收益

workflow 版的主题数据比 skill 版的模块数据**更完整**：每条问题都有主题归属（22 类全覆盖），而 skill 版仅 32/45 条挂了 3 个模块、13 条无归属。升级后 Dashboard 的模块图表/筛选在 workflow 版上体验更好（22 行柱状图纵向排列可接受，或取 TOP N + 其余归「其他」）。

## 六、需同步调整项（方案 A 落地时的改动清单）

1. parseReport：清单表为全集、详情按 ID 合并；`问题性质`/`类型` 双字段名；基准单行兼容；主题列写入 issue.module（skill 版保持现状：总体建议 ID 列表提取）。
2. validateReport：详情字段完整性校验放宽为「有详情块的条目必须完整」，清单-only 条目允许 original_text/problem/impact 为空。
3. template.html：抽屉对空详情字段容错（显示「清单条目，无详情块」占位），其余零改动。
4. build-dashboard.example.mjs：补 workflow 格式 mini 样例断言（清单多于详情、问题性质取类型、主题挂模块、基准单行）。

## 七、风险

1. workflow 路线的 report.md 由其脚本生成，仍在迭代（14:34-14:45 有 7 个优化提交），格式可能再变；本次适配以当前两份实样为准，格式再变需再调（解析器是启发式，无 schema 保证）。
2. 60 条无详情条目在 Dashboard 里只有标题/位置/建议（清单三列），详情抽屉信息量低——这是源报告本身的信息密度，不是转换问题。
3. 若两条路线未来统一（收敛遗留项），本适配可平滑退役（统一格式后走单格式分支）。

## 八、验证方式（落地后）

- Example 脚本双格式断言全过。
- `node build-dashboard.mjs examples/game-prd-check-workflow/report.md` 产出 144 条（P0×15/P1×66/P2×56/P3×7），概览 144 与明细 144 一致，主题图表 22 类可点击筛选。
- Chrome 实测抽屉（清单-only 条目容错显示）与打印。

## 引用说明

- 参照实现：.claude/skills/game-prd-check/scripts/build-dashboard.mjs、dashboard/template.html、dashboard/schema/report.schema.json
- 数据实样：examples/game-prd-check/report.md（skill 路线，45 条）、examples/game-prd-check-workflow/report.md（workflow 路线，144 条）
- 设计基线：dev-docs/design/PRD-Quality-Dashboard-Design-v1.0.md
- 相关进度：dev-docs/progress/执行进度.md（GPC-D1 记录）、dev-docs/progress-result/2026-11-10-game-prd-check-第一阶段执行报告.md
