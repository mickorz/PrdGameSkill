# game-requirement-audit 执行评审报告

- 评审日期：2026-11-17
- 评审对象：`dev-docs/planning/2026-11-17-game-requirement-audit-执行文档.md`
- 评审范围：执行文档承诺、已实现脚本、主 Workflow 编排、Stage Reuse、Gold Set/Example 测试、真实产物。
- 评审方法：静态代码审阅 + 结构核对 + 全量 Example 回归结果复核；**未触发 agent 链路**（遵循项目约束）。
- 结论等级：**不通过（文档完整，工作流执行闭环未完成）**。

---

## 1. 结论摘要

执行文档的**设计与确定性脚本资产较完整**，但不能把当前状态称为「统一工作流已执行完成」或「S1~S11 已落地可执行」。

核心问题不在规则脚本本身，而在**编排闭环没有接上**：可调用主 Workflow 只执行 S1~S3；S4~S11 虽存在单独的确定性脚本和 fixture 测试，却没有进入主 Workflow、没有 stage-manifest 指纹登记、没有真实 Run 产物，也没有 agent 查证/分析/写作链路。

| 维度 | 评审结论 | 证据 |
|---|---|---|
| 执行文档章节 | 完整 | 1640 行、§0~§20；§10 待写章节均有说明 |
| 确定性脚本 | 大部分存在 | S3、S4/S5、S6~S11 均有独立 `.mjs` |
| 主 Workflow 可执行链 | **仅 S1~S3** | `game-requirement-audit.js` 的 `STEPS` 仅 S1/S2/S3；文件头明确「S4~S11 未接入」 |
| Stage Reuse | **仅 S1~S3** | `stage-specs.game-requirement-audit.json` 只有 S1/S2/S3 |
| Gold Set | fixture 级通过 | `gold-set-audit.example.mjs` 用 fixture 直接调用脚本；不是主 Workflow / agent 端到端 |
| 真实审计产物 | 未发现 | `spec-workflow/requirement-audit/` 当前没有实际产物文件 |
| Agent Prompt/查证链 | 未接入 | §19 仅列 Prompt 要点；无 S4/S5/S7/S8/S10 子 Workflow 实现 |

**判定口径**：

- 若目标是「把执行文档的详细设计和确定性脚本写完」，结论可视为**基本完成**；
- 若目标是「可执行的统一 S1~S11 工作流」，结论为**未完成**；
- 若目标是「对真实模板与真实客户端/服务端源码完成一次审计」，结论为**尚未开始真实运行**。

---

## 2. 通过项

### 2.1 需求事实源与早期链路（S1~S3）具备可执行骨架

已存在并由主 Workflow 调度：

1. `1-scan-template.js`：模板扫描、章节覆盖、阶段编号连续校验；
2. `2-atomize-requirements.js`：按阶段拆原子、verificationScope、来源行号、分片落盘；
3. `3-build-registry.js` + `build-requirement-registry.mjs`：Registry 合并、ID/行号/枚举/覆盖/统计闸门；
4. `stage-reuse.mjs`：S1~S3 的 `init-run / record-stage / prepare-from-stage / verify-immutable`。

这部分与文档原则 1（唯一需求事实源）和 §11.9 最小实验目标基本一致。

### 2.2 双端证据确定性契约已被独立脚本覆盖

`prepare-verify-input.mjs`、`collect-source-manifest.mjs`、`merge-branch-evidence.mjs` 已覆盖：

- Registry 投影到客户端/服务端分片；
- run-status 的 pending 唯一事实源；
- §5.0 A `entryCount + pendingAtomIds.length === expectedAtomCount`；
- §5.0 B M1~M8 的大部分要求：分片码元序、合并键、claimKey 语义边界、共享证据 atomIds、多原子引用、归属原子、引用一致性、版本字段回填；
- Source Manifest 的 repoId + file 联合匹配。

评审时看到先前实现中「timeout/failed 分片无输出文件会漏入统计」的问题已修成「实际文件 ∪ run-status 声明分片」，这是正确的根因修复。

### 2.3 S6~S11 的确定性规则已有可测试实现

| 阶段 | 已有能力 |
|---|---|
| S6 | pending 派生、conflict-fast/full/blocked、逐原子升级识别 |
| S7 | analysis-history append-only、同 run 幂等、升级锚点校验 |
| S8 | reviewRule 白名单、审批状态保全、升级降级建议检查 |
| S9 | Registry scope 五级回落、client verified 六前置、候选隔离、blocked 派生 |
| S10 | schema v3 索引、trace、pending-list、stale/依赖链提示、文件级依赖清单 |
| S11 | 审批动作、retryScope 校验、共享证据影响集合、端级 retry 分片 |

这些脚本是后续接入 Workflow 的有效基础，不需要推倒重写。

### 2.4 Example / Gold Set 回归目前全绿

本轮复核命令结果：**144 断言通过，0 失败**。

九套 Example 覆盖了：Registry、Stage Reuse、查证输入、证据合并、S6~S9、S10~S11、Gold Set G01~G09、run-state。

这证明 fixture 所覆盖的**确定性函数行为**当前可重复，不等价于真实工作流闭环已验证。

---

## 3. 阻断问题（P0）

### P0-1：主 Workflow 与文档的「全部交付」表述冲突

**现象**

执行文档 §10 声明「状态：全部已交付」，§20 也写「文档完成状态」。但实际主编排文件：

- `game-requirement-audit.js` 文件头明确写：`S4~S11 未接入`；
- `STEPS` 只有 S1、S2、S3；
- `mode` 只支持 `all` / `from-stage`；注释明确 `resume/retry 待 S4~S11 接入`；
- `from-stage` 只接受 S1/S2/S3。

**影响**

用户按文档理解触发一次 `game-requirement-audit`，只能得到 Registry；不会产生 CLE/SVE、unified-atoms、business-behavior、difference-review、l7、规格、决议等承诺产物。

**建议**

先修正文档状态：

> 「详细设计与确定性脚本已交付；主 Workflow 当前仅接入 S1~S3；S4~S11 编排和 agent 链路待接入。」

在 S4~S11 接入并跑通真实 Run 前，不应使用「统一工作流全部完成」「S1~S11 已执行完成」等表述。

---

### P0-2：Stage Reuse 只支持 S1~S3，却被文档描述为 S1~S10 的后续能力已交付

**现象**

`stage-specs.game-requirement-audit.json` 只声明 S1/S2/S3。故：

- `stage-reuse.mjs` 不知道 S4~S11 的 input/output/config/stageVersion；
- `from-stage=S4...S10` 没有实现；
- S10 的 12 文件级输入（D34）没有进入任何实际 stage-manifest inputHash；
- §11.8 要求的 S11 `evidenceFingerprint` / stale 决议适用性检查没有代码实现。

检索 `stage-reuse.mjs`、`apply-decisions.mjs`、主 Workflow 未找到 `evidenceFingerprint` 或决议 stale 检查实现。

**影响**

文档强调的可重复实验、严格复用、防静默过期审批，在 S4~S11 上无法成立。尤其审核结论可能在新证据下被静默沿用。

**建议**

分两步完成：

1. **P0 先补 S4~S11 stage specs + 主编排 record-stage**：每阶段输入、输出、configArgs、stageVersion 写入 specs；支持 `from-stage=S4...S10`。
2. **再补 S11 evidenceFingerprint**：决议存 `atomId + analysisRunId + approvedConclusion + evidenceFingerprint`，from-stage 后比较并标 stale，禁止自动沿用。

---

### P0-3：Gold Set 是脚本 fixture 集成测试，不是主 Workflow / agent 端到端验收

**现象**

`gold-set-audit.example.mjs` 直接构造 Registry、verify-output、run-status、business-behavior、review 分片等 fixture，并直接调用函数。

它没有：

- 调用 `game-requirement-audit.js`；
- 调度 S4/S5 agent；
- 使用真实 `source-code/client` 或真实服务端根；
- 验证 S2 拆解出的真实 Atom 到 S10 文档的真实传播。

**影响**

Gold Set 能证明规则函数的 fixture 行为，不能证明实际编排、agent Prompt、文件落盘、参数传递、模型输出质量和真实源码定位正确。

**建议**

保留现有 fixture Gold Set（快、稳定），另加两层：

1. **Workflow smoke**：真实模板的最小阶段（如 ST-C01），执行 S1~S11 的主编排，断言文件树、stage-manifest、run-status、每阶段输出存在；
2. **Agent Gold Set**：使用固定小源码 fixture，由真实 S4/S5 agent Prompt 输出分片；只对稳定结构字段和确定性结果断言，不对自由文本逐字节断言。

---

## 4. 高优先级问题（P1）

### P1-1：S4/S5/S7/S8/S10 agent 链路只是 Prompt 要点，不是可调度实现

文档 §19 仅给了 Prompt 核心约束。没有对应的新子 Workflow：

- 无 S4 client verify agent workflow；
- 无 S5 以 Registry 为基线的 server 三步编排适配；
- 无 S7 business behavior agent 分片 workflow；
- 无 S8 review agent 分片 workflow；
- 无 S10 技术/策划文档 agent 写作 workflow。

**影响**：最需要模型语义判断的部分仍停留在设计文本；当前 `all` 并不能调用它们。

**建议**：以最小 ST-C01 为目标，先接 S4 + S5 + S6，不要一次把所有写作链塞入主编排。完成真实双端证据闭环后再接 S7/S8/S9，最后 S10/S11。

### P1-2：S11 影响集合没有比较「本轮新增/更新证据」，可能漏影响或错误扩大

文档 §5 S11 规定：定位本轮**更新/新增** CLE/SVE（包括同 id 摘录或指针变化），反查其 `atomIds`。

当前 `apply-decisions.mjs` 只从 retry 目标原子在 unified-atoms 上的**当前 evidenceIds**开始反查，不与前轮证据快照对比，也不检测：

- 同 id 的 excerpt / pointer / contentHash 是否变化；
- 新增证据是否服务于非 retry target；
- 被移除证据造成的影响。

**影响**：共享证据变更的真实影响集合不保证完整；这与 D20/D24 的核心目标不一致。

**建议**：在 S11 决议或 retry merge 中保留 `previousEvidenceIndex`，按 `{id, mergeKey, contentHash, excerpt}` 比较，得到 changedEvidenceIds，再取 `old.atomIds ∪ new.atomIds`。目标集合 T 只作为额外并集。

### P1-3：真实 Source Manifest 与 merge 的调用链未接通

`collect-source-manifest.mjs` 已实现，但没有任何 Workflow 调用它；同样 `prepare-verify-input`、`merge-branch-evidence` 也未被主 Workflow 调度。

**影响**：hash 优先 stale、dependencyFiles 复核等现有逻辑无法在真实运行中发生。

**建议**：S4/S5 接入时固定顺序：

```text
prepare verify input
  → agent 写 verify output
  → 更新 run status
  → collect source manifest
  → merge branch evidence
```

其中 collect 必须读取 agent 输出的 evidence/dependencyFiles，而不是依赖测试 fixture 手工写入。

### P1-4：文档称「Prompt 全文」，实际只有 Prompt 要点

§10 原承诺包括「Prompt 全文」。§19 目前列的是提示约束摘要，不足以让新开发者无歧义实现或审查模型行为。

**建议**：要么补每个 agent 阶段实际模板全文（含输入路径、输出 JSON Schema、负例、禁止项、落盘路径），要么把文档改成「Prompt 设计要点」，避免把要点误称全文。

---

## 5. 中优先级问题（P2）

### P2-1：真实产物目录为空，尚无可复盘 Run

评审时 `spec-workflow/requirement-audit/` 未发现实际产物文件。当前没有：

- run-001；
- latest.json；
- stage-manifest；
- Registry 真实快照；
- 双端证据与 L7 真实快照。

建议在接入后首跑 ST-C01，提交一个可复盘的最小真实 Run（或把产物明确列入 gitignore，但保留验收摘要和 hash）。

### P2-2：文档表述把「脚本存在」与「工程接入」混淆

例如 §18.1 表把 S4~S11 脚本列为「已实现」，§20 的完成表也容易被解读为阶段已完成。实际它们是「可调用的独立函数」，不是「已由 workflow 可执行的阶段」。

建议三态标注：

| 状态 | 含义 |
|---|---|
| 已实现并编排 | 主 Workflow 已调度，能进 stage-manifest |
| 已实现未编排 | 独立脚本/fixture 已存在，不能通过主 Workflow 运行 |
| 设计完成 | 文档/Prompt 契约存在，代码未实现 |

### P2-3：`run-state.mjs` 是诊断工具，未驱动 resume/retry

当前它能检查和记录状态，但不被主 Workflow 使用；`resume`、`retry` 也没有被主 Workflow 接受。

建议不要把它记作「失败恢复已完成」，应记为「失败恢复状态模型与诊断工具已完成」。真正恢复要在主编排中消费诊断，选择已完成分片、重建 pending 输入、重新执行受影响阶段。

### P2-4：文档数字与执行成熟度需要分开汇报

「1640 行 / 20 章 / 144 断言」是文档与 fixture 成熟度，不是业务审计结果或 workflow 验收指标。建议进度报告增加：

- 文档成熟度；
- 确定性脚本成熟度；
- 编排成熟度；
- Agent 实跑成熟度；
- 真实样本验收成熟度。

---

## 6. 风险矩阵

| ID | 严重度 | 风险 | 当前规避 | 建议验收门 |
|---|---|---|---|---|
| R1 | P0 | 用户触发主 Workflow 却只执行 S1~S3 | 无；文档反而写「全部交付」 | S4~S11 全部进入 STEPS + stage-manifest |
| R2 | P0 | S4~S11 from-stage/strict/stale 承诺不可用 | S1~S3 fixture 可用 | stage specs 覆盖 S1~S11 + G09 真实工作流 |
| R3 | P0 | fixture Gold Set 掩盖 agent/编排失败 | 144 断言全绿 | workflow smoke + agent Gold Set |
| R4 | P1 | 共享证据更新的影响集合不完整 | 当前只反查当前 evidenceIds | 新旧证据索引 diff + old/new atomIds 并集 |
| R5 | P1 | 审批结果在证据变化后自动沿用 | 无 evidenceFingerprint | S11 stale 决议门 |
| R6 | P1 | Source Manifest/stale 链路没有真实调用 | fixture 直接调用 | S4/S5 编排闭环实跑 |
| R7 | P2 | 恢复工具不驱动恢复 | 仅 run-state check/advance | 主编排实现 resume/retry |

---

## 7. 建议的纠正顺序

不要继续扩写文档或增加抽象；先把已有资产接成最小真实闭环。

1. **纠正文档状态（立即）**：把「全部已交付」改为「确定性设计与脚本完成，S4~S11 未编排」；避免误导。
2. **接 S4/S5 + S6 到主 Workflow（P0）**：先只跑 ST-C01；每阶段 `record-stage`；stage-specs 补 S4~S6；确保 `from-stage=S4/S6` 可用。
3. **跑 §11.9 六步真实实验（P0）**：形成 run-001/run-002 和不可变产物证据。
4. **接 S7~S9（P0）**：补 agent 分片 workflow；跑 G01~G04 的真实 agent smoke。
5. **补 S11 evidenceFingerprint + 新旧证据 diff（P1）**：再谈审批可复用与增量影响集合。
6. **接 S10/S11（P1）**：最后做文档写作和人工裁决入口；避免在无真实证据闭环时先写规格。
7. **真实样本验收（P1）**：至少 ST-C01，随后 ALL；将验收结果写入 `dev-docs/progress-result/`。

---

## 8. 验收结论

- **执行文档完整性**：通过。
- **确定性脚本 fixture 回归**：通过（144/144）。
- **统一主 Workflow S1~S11 编排**：不通过（仅 S1~S3）。
- **Stage Reuse S1~S10 / S11 stale 保护**：不通过（仅 S1~S3）。
- **真实源码与 agent 端到端审计**：未执行。
- **总体结论**：**不通过，阻断于 P0-1 / P0-2 / P0-3。**

本评审不建议删除现有脚本；它们是可复用的确定性基础。应以「先接最小真实链路、再扩展阶段」收敛，而不是继续增加 fixture 或文档篇幅。
