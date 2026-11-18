# game-requirement-audit 手动运行指南

- 文档类型：使用指南
- 适用版本：执行文档 v3.2 冻结 + §21 评审整改 + 首跑集成修复（§21.8 I4~I10，183 断言全绿，口径=各套 test 用例数）
- 前置阅读：`dev-docs/planning/2026-11-17-game-requirement-audit-执行文档.md` §2（步骤总览）、§3（产物目录）、§21（状态三态）

> **一句话**：这个 Workflow 用 11 个阶段把「需求模板 + 双端源码」变成「技术实现视图 + 策划业务视图 + 待处理清单」。
> 前三阶段（S1~S3）只读模板，中间双端查证（S4/S5）最耗 token，最后由人工裁决（S11）。

---

## 0. 开始之前：3 个必须知道的事实

### 0.1 这不是一条命令跑完就完事

| 事实 | 影响 |
|---|---|
| 主 Workflow 有 **7 个 agent 阶段**（S1/S2/S4/S5/S7/S8/S10） | 真实跑批耗时与费用主要在这里；S4/S5 单分片超时上限 2 小时 |
| S11 需要**你手写** `decisions.json` | 不写也能跑完 S1~S10，S11 会返回「待人工输入」 |
| `stageIds` **只作用于 S4/S5** | 想先试一个阶段，S1~S3 仍会全量拆解（快，但 Registry 是全量） |

### 0.2 三类「停止」不要混淆

| 现象 | 含义 | 该怎么办 |
|---|---|---|
| `checkpoint` 被拒绝 | 你在 step/planOnly 模式主动停止 | 产物已保留，用 `mode=resume` 继续 |
| 阶段抛错（fail fast） | 闸门拦截（数据不自洽） | 看日志修正后 `mode=from-stage` 重跑该阶段 |
| 返回 `awaiting-human-input` | S11 缺 decisions.json | 写决议后 `mode=from-stage startStage=S11` |

### 0.3 开工前自检（1 分钟）

在工作流跑之前，先确认确定性层健康（不花 token）：

```bash
cd E:/WorkProjects/PrdGameSkill

# 全量回归：应输出 TOTAL=180 FAIL=0，或逐条 [通过]
for f in build-requirement-registry stage-reuse prepare-verify-input merge-branch-evidence \
         merge-evidence difference-review-l7 spec-decisions gold-set-audit \
         run-state decision-fingerprint orchestration; do
  echo "--- $f ---"; node .opencode-workflows/scripts/$f.example.mjs 2>&1 | tail -1
done
```

**只要有一条 `[失败]`，先别跑真实批次** —— 那是确定性问题，agent 跑再多也救不回来。

再确认输入路径存在：

```bash
ls "templates/【杭州麻将】核心流程杭州麻将好友房AI-核心策划补齐版.md"   # 需求模板
ls source-code/client/Code                                          # 客户端代码工程
ls source-code/client/Fgui                                          # FairyGUI 工程
ls E:/WorkProjects/xc-flow/.xflow/xc/xcodeDev/game-mahjong/server/Logic/mahjong_server/src  # 服务端源码根
```

---

## 1. 第一次跑：建议这么来（4 步）

> 目标：用最小代价走通全链，先暴露流程问题，再谈质量。
> 关键取舍：**S1~S3 全量（便宜）**，**S4/S5 只查一个阶段（省 token）**。

### 第 1 步：跑 S1~S3，只验证 Registry

第一次先 **不查证**，只确认模板能被正确拆解成原子。

用 workflow 工具触发（`scriptPath` 相对项目根）：

```text
scriptPath: ./.opencode-workflows/workflows/game-requirement-audit/game-requirement-audit.js

args: {
  "date": "2026-11-17",
  "mode": "all",
  "step": true,          // 每阶段后停下让你看产物
  "stageIds": "ST-C01"   // 收窄查证范围；S1~S3 仍全量
}
```

`step: true` 会在每个阶段后停一次，检查点提示会告诉你该看哪个文件。前三个检查点看这些：

| 检查点 | 看什么 | 判据 |
|---|---|---|
| S1 后 | `spec-workflow/requirement-audit/2026-11-17/runs/run-001/1-registry/runtime/state/scan.json` | `sections` 覆盖全文、`stageId` 从 ST-C01 连续 |
| S2 后 | 同目录 `runtime/atom-parts/ST-C01-ap01.json` | `verificationScope` 有值、`source.fromLine/toLine` 落在本章节内 |
| S3 后 | `1-registry/requirement-registry.json` | `stats.scopeStats` 三值合计 = `atomCount` |

S3 之后的检查点会出现 S4（真正开始查证，耗时）。**第一次建议在这里停止**：
在 S3 检查点选「拒绝」，Run 正常收尾，产物保留。

### 第 2 步：只查 ST-C01（最小真实查证）

```text
args: {
  "date": "2026-11-17",
  "mode": "resume",     // 从首个未完成阶段继续（S4）
  "step": true,
  "stageIds": "ST-C01"
}
```

`resume` 会读 `stage-manifest.json`，自动从 S4 开始，**不会重跑 S1~S3**。

这一步是第一次真正调用 agent 读源码。重点看：

| 检查点 | 看什么 |
|---|---|
| S4 后 | `2-client/client-evidence.json` 的 `entries[].verdict` 分布、`evidence[]` 是否带真实 `file:line` |
| S5 后 | `3-server/scope-index.json` 的 `applicability` 四值分布、`conditional` 是否都有 `configCondition` |
| S6 后 | `4-analysis/unified-atoms.json` 的 `analysisPath` 分布（conflict-fast / full / blocked） |

**健康信号**：`coverage.pendingAtomIds` 里的原子 = 非 ST-C01 阶段（因为 stageIds 收窄），ST-C01 的原子不应出现在 pending。
**异常信号**：`evidence[].excerpt` 是空泛描述、`location` 缺行号、大量 `partial` —— 说明 Prompt 需要调，先看几十条抽样再继续。

### 第 3 步：跑完分析链（S7~S10）

```text
args: {
  "date": "2026-11-17",
  "mode": "resume",
  "step": true,
  "stageIds": "ST-C01"
}
```

继续走 S7（业务行为还原）→ S8（差异复核）→ S9（L7 分类）→ S10（规格生成）。

| 检查点 | 看什么 | 判据 |
|---|---|---|
| S7 后 | `4-analysis/business-behavior.json` | conflict 条目都有 `baselineDetail`；conflict-fast 条目四元组可空（正常） |
| S7 后 | `4-analysis/analysis-history.json` | 首次出现 1 条 run 记录（append-only 起点） |
| S8 后 | `4-analysis/difference-review.json` | `reviewStatus` 全是 `pending`（agent 不得自批） |
| S9 后 | `4-analysis/l7-classify.json` | blocked 原子只在 `blockedAtoms`，不在 `entries` |
| S10 后 | `5-specs/stages/spec_stage_ST-C01.md` | 每个原子 ID 都在；blocked 原子写「查证未完成」 |
| S10 后 | `5-specs/策划版.md` | 无类名/文件名/MsgXxx/CLE-/SVE-（泄漏闸门会拦） |

### 第 4 步：人工裁决（S11）

S10 跑完后先读清单：

```
spec-workflow/requirement-audit/2026-11-17/runs/run-001/5-specs/pending-list.md
```

里面分四类：查证未完成 / 需策划裁决 / 规则待验证 / 待审批复核建议。

按清单写 `decisions.json`：

```
spec-workflow/requirement-audit/2026-11-17/runs/run-001/6-review/decisions.json
```

```json
{
  "schemaVersion": 1,
  "date": "2026-11-17",
  "decisions": [
    {
      "atomId": "AT-ST-C01-001",
      "action": "approve",
      "target": "difference-review",
      "reason": "双端证据一致，确认采纳复核建议"
    },
    {
      "atomId": "AT-ST-C01-002",
      "action": "reject",
      "target": "difference-review",
      "reason": "复核理由不成立，维持原冲突判断"
    },
    {
      "atomId": "AT-ST-C01-003",
      "action": "modify",
      "target": "difference-review",
      "modifiedValue": "partial",
      "reason": "人工判断为部分符合"
    },
    {
      "atomId": "AT-ST-C01-004",
      "action": "re-verify",
      "target": "pending",
      "retryScope": "server",
      "reason": "服务端证据不足，补证后重判"
    }
  ]
}
```

**动作含义**（不要用错）：

| action | 效果 | target 约束 |
|---|---|---|
| `approve` | 复核建议生效（升级原子降级在此生效） | 该原子必须有复核条目 |
| `modify` | 改写结论并生效，必须给 `modifiedValue`（consistent/partial/conflict/unverified） | 同上 |
| `reject` | 建议否决，**回退到 S7 基线**（rejected ≠ 需求没问题） | 同上 |
| `hold` | 挂起，保持 pending，不生效 | 同上 |
| `re-verify` | 端级补证，必须给 `retryScope`（client/server/both）且与需求验证范围不矛盾 | target 用 `pending` |

然后：

```text
args: {
  "date": "2026-11-17",
  "mode": "from-stage",
  "startStage": "S11",
  "sourceRunId": "run-001",
  "planOnly": true        // 先看计划，确认后去掉此项再跑一次
}
```

`planOnly` 先给你看「复用哪些阶段 / 重跑哪些阶段」，确认后去掉 `planOnly` 真执行。

S11 会依次做：绑证据指纹 → 检查决议适用性 → 应用审批 → 算影响集合 → 出补证分片。

**注意**：S11 之后 `l7-classify.json` 还是旧值（审批刚改的是 `difference-review.json`）。
要让审批结果反映到索引和文档，需要重跑 S9 + S10：

```text
args: {
  "date": "2026-11-17",
  "mode": "from-stage",
  "startStage": "S9",
  "sourceRunId": "run-001"
}
```

---

## 2. 检查产物：去哪看什么

Run 根：`spec-workflow/requirement-audit/<date>/runs/<runId>/`

| 想看什么 | 打开 |
|---|---|
| 需求事实源（原子/验证范围/业务语义） | `1-registry/requirement-registry.json` |
| 术语与章节映射 | `1-registry/identity-map.json` |
| 客户端证据（verdict + 证据） | `2-client/client-evidence.json` |
| 客户端执行状态（pending 唯一事实源） | `2-client/runtime/run-status.json` |
| 服务端作用域（四值）+ 证据 | `3-server/scope-index.json` / `3-server/server-evidence.json` |
| 双端证据汇总与分析路径 | `4-analysis/unified-atoms.json` |
| 业务行为与差异初判 | `4-analysis/business-behavior.json` |
| 分析历史（append-only） | `4-analysis/analysis-history.json` |
| 复核建议与审批状态 | `4-analysis/difference-review.json` |
| L7 分类 | `4-analysis/l7-classify.json` |
| 技术规格（分阶段） | `5-specs/stages/spec_stage_ST-Cxx.md` |
| 统一索引 / 追溯 / 待办 | `5-specs/feature_index.json` / `trace_index.json` / `pending-list.md` |
| 阶段速查表（双端分布 + L7） | `5-specs/stage_manifest.md` |
| 策划业务视图 | `5-specs/策划版.md` |
| 机械校验报告 | `5-specs/runtime/spec_check/verify-report.md` |
| 人工决议与影响集合 | `6-review/decisions.json` / `6-review/runtime/impact-set.json` |
| 阶段指纹与复用记录 | `runtime/stage-manifest.json` |
| 失败历史与可恢复性 | `runtime/run-state.json` |

**先看这 3 个就够判断质量**：
1. `1-registry/requirement-registry.json` 的 `stats.scopeStats`（拆解对不对）
2. `4-analysis/l7-classify.json` 的 `stats.l7`（结论分布）
3. `5-specs/策划版.md`（业务可读性）

---

## 3. 状态查询与恢复

### 3.1 任何时候都可以问「我跑到哪了」

```bash
node .opencode-workflows/scripts/run-state.mjs check \
  --run-dir spec-workflow/requirement-audit/2026-11-17/runs/run-001
```

输出包含：已完成到哪个阶段、建议 mode + startStage、失败分片计数、警告（如某端 run-status 有但正式产物缺失）。

### 3.2 三种恢复场景

| 场景 | 怎么做 |
|---|---|
| 中途手动停止 / 进程中断 | `mode=resume`（自动从首个未完成阶段继续） |
| 某阶段数据不自洽（闸门拦截） | 修数据后 `mode=from-stage, startStage=Sx, sourceRunId=run-00N` |
| 补证后重判 | 先 S11 写 `re-verify` 决议 → `mode=retry, startStage=S4/S5, retryScope=...` |

### 3.3 `from-stage` 的 strict 语义（重要）

- **复用阶段**（startStage 之前）：四指纹（input/config/output/stageVersion）任一不匹配 → **直接拒绝复用，fail fast**。
- **startStage 及下游**：按计划重跑，**不检查**旧指纹（你本来就改了东西）。
- 想先看计划：加 `planOnly: true`，会写 `runtime/reuse-plan.json` 并停下来确认。

常见拒绝原因与处理：

| 报错 | 原因 | 处理 |
|---|---|---|
| `inputHash 不匹配` | 上游输入变了（如模板改了） | 从更早阶段重跑 |
| `configHash 不匹配` | 阶段脚本改了（含 Prompt 改动） | 正常：这正是你要重跑的阶段，从它开始 |
| `outputHash 不匹配` | 来源 Run 产物被改动 | 换 `sourceRunId` 或从该阶段重跑 |
| `stageVersion 不匹配` | specs 版本号递增了 | 从该阶段重跑 |
| `来源 run 不存在` | runId 拼错 | `run-state check` 确认 |

---

## 4. 全量跑（第一次最小验证通过后）

确认 ST-C01 结果可接受后，再跑全量：

```text
args: {
  "date": "2026-11-18",   // 换新日期，避免污染最小验证的 Run
  "mode": "all",
  "stageIds": "ALL",
  "concurrency": 16
}
```

建议 **不加 `step`**（全量阶段多，逐阶段确认太累）。跑完后：

```bash
node .opencode-workflows/scripts/run-state.mjs check \
  --run-dir spec-workflow/requirement-audit/2026-11-18/runs/run-001
```

**全量跑的耗时预期**：S4/S5 是主要成本（分片数 ≈ 阶段数，单片最多 2 小时上限，实际取决于源码规模与模型速度）。建议先跑 ST-C01 估算单阶段成本，再乘阶段数做预算。

---

## 5. 参数速查

| 参数 | 必填 | 默认 | 说明 |
|---|---|---|---|
| `date` | ✔ | — | `YYYY-MM-DD`，产物根目录名。**脚本内不取当前时间** |
| `mode` | | `all` | `all` / `resume` / `from-stage` / `retry` |
| `startStage` | from-stage/retry | — | `S1`~`S11` |
| `sourceRunId` | from-stage | — | 如 `run-001` |
| `retryScope` | retry | — | `client` / `server` / `both` |
| `planOnly` | | `false` | 只出复用计划 + checkpoint |
| `step` | | `false` | 每阶段后 checkpoint |
| `stageIds` | | `ALL` | **只作用于 S4/S5**：CSV 或 ALL |
| `templatePath` | | 杭州麻将核心策划补齐版 | 需求模板 |
| `codeDir` | | `source-code/client/Code` | 客户端代码工程 |
| `fguiDir` | | `source-code/client/Fgui/assets` | FairyGUI 组件包根（client-fgui 仓根，证据 file 相对该根） |
| `serverSrcRoot` | | 外部服务端根 | 服务端三目录父目录 |
| `analysisModel` | | `biangfeng-gateway/deepseek-v4.1-flash-official` | 分析类模型 |
| `writeModel` | | 会话默认 | 写作类模型（S10） |
| `concurrency` | | 16 | 上限 16，S4/S5 共享 |

---

## 6. 常见问题

### Q1：跑完发现某个原子拆错了

原子与 `verificationScope` 由 S2 产生、S3 定稿，**下游不可改**（原则 1）。正确做法：
改 S2 的拆解（或模板），然后 `mode=from-stage, startStage=S2` 重跑全链（S2 下游都会失效）。

### Q2：为什么 pending 那么多？

先看是谁的 pending：

| 现象 | 原因 | 处理 |
|---|---|---|
| 非目标阶段原子全在 pending | 你用了 `stageIds` 收窄 | 正常；merge 会记「本轮未调度原子」告警 |
| 某端分片 `timeout`/`failed` | agent 超时或落盘失败 | `mode=from-stage, startStage=S4/S5` 重跑该端 |
| 单个原子 `unknown` | 服务端查了但证据不足（业务结论） | 写 `re-verify` 决议补证，或人工裁决 |

### Q3：S11 说决议 stale，不让生效

这是**故意的**：决议绑定了证据指纹，证据或判断依据变了就必须重新确认。

```bash
# 看哪条、为什么
node .opencode-workflows/scripts/decision-fingerprint.mjs check \
  --run-dir spec-workflow/requirement-audit/2026-11-17/runs/run-001
```

处理：确认新证据后**重新写这条决议**（会重新绑定当前指纹），再跑 S11。

### Q4：策划版被泄漏闸门拦了

`check-planner-leak.mjs` 抓的是类名/文件名/MsgXxx/CLE-/SVE-/技术枚举名/蛇形配置 key。
让 agent 重写 S10 的策划版，或手工改文案（用业务语言，如 `banker_level_type` → 「庄家倍数档位」），再 `from-stage S10`。

### Q5：想只重跑一个确定性阶段（不花 token）

S3/S6/S9/S11 是纯确定性，可直接用脚本 + `record-stage`：

```bash
RUN=spec-workflow/requirement-audit/2026-11-17/runs/run-001

node .opencode-workflows/scripts/classify-l7-audit.mjs --run-dir "$RUN" --date 2026-11-17

# 记录指纹（可选，便于后续 from-stage 复用）
cat > /tmp/args-s9.json <<'EOF'
{"configArgs":{"date":"2026-11-17"},"profile":{}}
EOF
node .opencode-workflows/scripts/stage-reuse.mjs record-stage 2026-11-17 run-001 S9 --args-file /tmp/args-s9.json
```

但**建议还是用 `mode=from-stage`**——它会同时处理 run-state 与指纹，不容易漏。

### Q6：一次跑批大概要多少钱/多久？

不要试算，直接**小步测量**：先按第 1 节跑 ST-C01 一个阶段，记录耗时与 token，再乘阶段数。
S4/S5 是双端并行查证，成本约为单端的两倍。

---

## 7. 验收清单（跑完后逐条打勾）

全量跑完后，按这张表判断「能不能交付」：

- [ ] `run-state.mjs check` 显示 S1~S11 全 completed
- [ ] `requirement-registry.json` 的 `stats.scopeStats` 三值合计 = `atomCount`
- [ ] `client-evidence.json` 与 `scope-index.json` 无 `pendingAtomIds`（或已说明为何 pending）
- [ ] `unified-atoms.json` 无意外 blocked（blocked 应能对应到执行状态）
- [ ] `analysis-history.json` 每轮记录只增不改
- [ ] 所有 `difference-review.json` 的 `reviewStatus` 在 S11 前都是 `pending`
- [ ] `l7-classify.json` 的 `blockedAtoms` 与 `entries` 无交集
- [ ] `pending-list.md` 四类分组都有内容或明确「无」
- [ ] 每个 `spec_stage_ST-Cxx.md` 覆盖本阶段全部原子 ID
- [ ] `策划版.md` 无技术字段泄漏
- [ ] `stage_manifest.md` 合计行与 `feature_index.json` 统计一致
- [ ] 影响集合里的共享证据牵连已人工确认（`6-review/runtime/impact-set.json`）

---

## 8. 出问题时的定位顺序

1. **先跑确定性回归**（第 0.3 节）——排除脚本层问题
2. **`run-state.mjs check`** —— 看阶段/分片状态与建议恢复点
3. **看闸门报错原文** —— 每个脚本 fail 时都会打印 `[失败]` + 逐条问题，几乎都写清了修法
4. **看 `runtime/branch-recount.json`** —— 双端合并的重算摘要（不看 agent 自报数字）
5. **看 `5-specs/runtime/spec_check/verify-report.md`** —— 机械校验结果

---

## 附：本指南对应的实现位置

| 内容 | 位置 |
|---|---|
| 主编排与参数校验 | `.opencode-workflows/workflows/game-requirement-audit/game-requirement-audit.js` |
| 11 个子流程 | 同目录 `1-scan-template.js` ~ `11-human-review.js` |
| 阶段指纹规格 | `.opencode-workflows/scripts/stage-specs.game-requirement-audit.json` |
| 阶段复用 | `.opencode-workflows/scripts/stage-reuse.mjs` |
| 状态机与恢复建议 | `.opencode-workflows/scripts/run-state.mjs` |
| 决议指纹与 stale 保护 | `.opencode-workflows/scripts/decision-fingerprint.mjs` |
| 全量回归 | `.opencode-workflows/scripts/*.example.mjs`（11 套 / 183 断言） |
| 详细设计 | `dev-docs/planning/2026-11-17-game-requirement-audit-执行文档.md` |
| 评审与整改 | `dev-docs/progress-result/2026-11-17-game-requirement-audit-执行评审.md` |
