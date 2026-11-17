// Game-Requirement-Audit 子流程 S10：统一规格生成（agent 写作 + 确定性索引，评审 P1-1 整改）
//
// 执行文档 §5 S10、§16.1、§19.2。**Prompt 全文在本文件**。
//
// 职责链：
//   1. build-unified-index.mjs → feature_index.json / trace_index.json / pending-list.md / verify-report.md
//      （确定性索引与清单；agent 不产这些）
//   2. 按阶段并行 agent 写阶段规格文档 stages/spec_stage_ST-Cxx.md（技术实现视图）
//   3. stage_manifest.md（阶段速查表）确定性生成
//   4. 策划业务视图（策划版.md）单独 agent：只消费 business-behavior + l7，技术字段结构性隔离
//
// 铁律（§5 S10）：技术视图与策划视图分离；策划版不得出现类名/方法名/协议名/文件路径/证据 ID。
//
// stageVersion：S10@1

export const meta = {
  id: 'game-requirement-audit-unified-spec',
  name: 'game_requirement_audit_unified_spec',
  description: 'S10 统一规格生成：确定性索引/清单 + 按阶段 agent 写技术规格 + 策划版业务视图（技术字段隔离）',
  phases: [{ title: '生成统一索引' }, { title: '并行阶段规格写作' }, { title: '策划视图与校验' }],
}

const A = args || {}

const runDir = String(A.runDir || '').trim()
if (!runDir) throw new Error('runDir 必填（run 根目录，由主编排创建）')
const date = String(A.date || '').trim()
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date 必填 YYYY-MM-DD')
const analysisModel =
  A.analysisModel === undefined ? 'biangfeng-gateway/deepseek-v4.1-flash-official' : A.analysisModel
const writeModel = A.writeModel === undefined ? '' : A.writeModel // 写作类默认会话模型
const plannerPath = String(A.plannerPath || runDir + '/5-specs/策划版.md')

setConcurrency(A.concurrency || 16)
function withModel(opts) {
  return analysisModel ? { model: analysisModel, ...opts } : opts
}
function withWriteModel(opts) {
  return writeModel ? { model: writeModel, ...opts } : opts
}

const SPEC_DIR = runDir + '/5-specs'
const FEATURE_INDEX = SPEC_DIR + '/feature_index.json'

// ============================================================
// 1. 确定性索引（feature_index / trace_index / pending-list / verify-report）
// ============================================================

phase('生成统一索引')

const idxOk = await commandSuccess(
  'node ".opencode-workflows/scripts/build-unified-index.mjs" --run-dir "' + runDir + '" --date "' + date + '"',
  300000
)
if (!idxOk) throw new Error('S10 统一索引生成失败（机械校验未通过，见上方命令日志）')

// 读取阶段与原子摘要（写作输入；不返回全文，避免上下文爆炸）
const structure = await agent(
  [
    '你是规格结构读取器，工作目录为项目根目录。只做读取与转写，不做解读。',
    '',
    '任务：read ' + FEATURE_INDEX + '（可能较大，可分段读），返回：',
    '1. stages：每个阶段的 stageId 与 name（来自 stages[]）；',
    '2. 每个阶段的原子清单：atomId / name / l7 / difference / analysisPath / verificationScope（不要 rule 全文）。',
    '只输出结构化结果。',
  ].join('\n'),
  withModel({
    label: '读取规格结构',
    schema: {
      type: 'object',
      properties: {
        stages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              stageId: { type: 'string' },
              name: { type: 'string' },
              atoms: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    atomId: { type: 'string' },
                    name: { type: 'string' },
                    l7: { type: 'string' },
                    difference: { type: 'string' },
                    analysisPath: { type: 'string' },
                    verificationScope: { type: 'string' },
                  },
                  required: ['atomId'],
                },
              },
            },
            required: ['stageId', 'atoms'],
          },
        },
      },
      required: ['stages'],
    },
    timeoutMs: 1800000,
    retries: 2,
  })
)
if (!structure || !Array.isArray(structure.stages) || structure.stages.length === 0) {
  throw new Error('规格结构回读异常：' + JSON.stringify(structure && structure.stages && structure.stages.length))
}

// ============================================================
// 2. 并行阶段规格写作（每阶段一个 agent）
// ============================================================

phase('并行阶段规格写作')

const STAGE_DOC_SCHEMA = {
  type: 'object',
  properties: {
    stageId: { type: 'string' },
    path: { type: 'string' },
    atomCount: { type: 'number' },
    lineCount: { type: 'number' },
  },
  required: ['stageId', 'path', 'atomCount'],
}

// ---- Prompt 全文（S10 技术视图） ----
function stageDocPrompt(s) {
  const outPath = SPEC_DIR + '/stages/spec_stage_' + s.stageId + '.md'
  return [
    '你是杭州麻将好友房需求的**技术实现视图**规格写作员。工作目录为项目根目录。',
    '产出：阶段 ' + s.stageId + '（' + (s.name || s.stageId) + '）的技术规格文档。',
    '',
    '## 一、输入（只读，不得改）',
    '- 统一索引：' + FEATURE_INDEX + '（本阶段原子含双端字段与 l7）',
    '- 业务行为：' + runDir + '/4-analysis/business-behavior.json（本阶段条目的四元组与初判）',
    '- 复核：' + runDir + '/4-analysis/difference-review.json（若有本阶段条目）',
    '- L7：' + runDir + '/4-analysis/l7-classify.json（本阶段条目）',
    '- 证据原文（按需）：' + runDir + '/2-client/client-evidence.json、' + runDir + '/3-server/server-evidence.json',
    '- 待处理清单：' + SPEC_DIR + '/pending-list.md（本阶段相关项）',
    '本阶段原子清单（共 ' + s.atoms.length + ' 个）：' + s.atoms.map((a) => a.atomId).join(', '),
    '',
    '## 二、文档结构（Markdown，必须包含以下章节）',
    '1. `# ' + s.stageId + ' ' + (s.name || '') + '`',
    '2. `## 阶段概述`：一句话职责 + 本阶段原子数 + L7 分布（verified/verification_required/decision_required/not_applicable 各几个）',
    '3. `## 需求条目`：按原子逐个展开，每个原子一个小节 `### <atomId> <name>`，内容必须含：',
    '   - **需求规则**：rule 原文语义（忠实转述，不得改需求）',
    '   - **验证范围**：verificationScope（client/server/both）',
    '   - **客户端职责**：clientVerification.verdict + 实现要点（来自 CLE 证据）+ 证据定位（CLE-id 与 file:line）',
    '   - **服务端职责**：serverVerification.applicability + 规则说明（含配置生效条件 configCondition）+ 证据定位（SVE-id 与 file:line）',
    '   - **双端协作**：collaboration（消息流行为描述）',
    '   - **业务行为**：trigger / condition / action / result 四元组（玩家语言）',
    '   - **实际实现差异**：difference 与 baselineDetail（若 conflict 必须写清需求 vs 实际）',
    '   - **验证结论（L7）**：l7 值 + l7Basis（若 l7Basis=pending-blocked 注明「查证未完成」）',
    '4. `## 证据索引`：本阶段 CLE / SVE 证据列表（id + layer + file:line + claimKey）',
    '5. `## 待处理事项`：本阶段在 pending-list 中的条目（blocked / verification_required / decision_required / 待审批）',
    '',
    '## 三、特殊情形处理（必须准确，不得含糊）',
    '- **analysisPath=blocked**：写「**查证未完成**（哪一端 + 执行状态 pending/timeout/failed），差异未判定」，',
    '  l7 填 verification_required 并注明 basis=pending-blocked；**不要**编造实现差异。',
    '- **analysisPath=conflict-fast**：写明冲突结论 + baselineDetail + 另一端查证状态（pending 就写 pending，不要臆测）。',
    '- **升级原子（有 candidateDifference）**：呈现「历史基线 + 本轮候选 + 候选待审批」，明确标注候选**尚未生效**。',
    '- **reviewStatus=pending 的复核建议**：写「待审批建议：<reviewedDifference>（<reviewRule>）」，标注未生效。',
    '',
    '## 四、写作纪律',
    '- 技术视图**允许**出现类名、方法名、协议名、文件路径（这是技术版职责）',
    '- 但需求规则必须忠实原文，不得因实现情况修改需求表述',
    '- 不得编造证据：所有 file:line / CLE-id / SVE-id 必须来自输入数据',
    '- 不判定需求对错（那是策划裁决的事），只陈述差异',
    '- 中文写作，术语准确，不使用 Emoji',
    '',
    '## 五、输出',
    '用 write 写文件：' + outPath + '（UTF-8 Markdown）。只写这一个文件，不写其他文件，不执行 git。',
    '写完后返回 stageId / path / atomCount / lineCount。',
  ].join('\n')
}

const stageResults = await parallel(
  structure.stages.map((s) => () =>
    agent(
      stageDocPrompt(s),
      withWriteModel({
        label: '写阶段规格 ' + s.stageId,
        agentType: 'general',
        schema: STAGE_DOC_SCHEMA,
        timeoutMs: 3600000,
        retries: 2,
      })
    )
  )
)

// 落盘闸门 + AT-ID 覆盖校验（确定性：文档必须覆盖本阶段全部原子 ID）
const stageDocProblems = []
for (let i = 0; i < structure.stages.length; i++) {
  const s = structure.stages[i]
  const outPath = SPEC_DIR + '/stages/spec_stage_' + s.stageId + '.md'
  const ok = await check(() => fileExists(outPath), '落盘闸门：' + outPath)
  if (!ok) {
    stageDocProblems.push('阶段文档未写盘：' + s.stageId)
    continue
  }
}
if (stageDocProblems.length > 0) {
  throw new Error('S10 阶段文档落盘闸门失败：' + stageDocProblems.join('；'))
}

// AT-ID 覆盖检查（agent 自算行号不可靠，改确定性扫描）
const coverageCmd =
  'node ".opencode-workflows/scripts/check-spec-coverage.mjs" --run-dir "' + runDir + '" --date "' + date + '"'
const coverageOk = await commandSuccess(coverageCmd, 300000)
if (!coverageOk) {
  throw new Error('S10 阶段文档 AT-ID 覆盖校验失败（缺原子或乱码，见上方命令日志；修文档可重跑 S10）')
}

// ============================================================
// 3. 策划业务视图（技术字段结构性隔离）+ 阶段速查表
// ============================================================

phase('策划视图与校验')

// 策划版输入准备：确定性投影（只留业务行为 + L7，剥离技术字段）
const plannerInputOk = await commandSuccess(
  'node ".opencode-workflows/scripts/prepare-planner-input.mjs" --run-dir "' + runDir +
    '" --date "' + date + '"',
  300000
)
if (!plannerInputOk) throw new Error('S10 策划版输入投影失败（见上方命令日志）')

const PLANNER_INPUT = runDir + '/5-specs/runtime/planner-input/business-view.json'

// ---- Prompt 全文（S10 策划视图） ----
const plannerPrompt = [
  '你是杭州麻将好友房需求的**策划业务视图**写作员。工作目录为项目根目录。',
  '产出：纯业务语言的策划版文档，给策划/运营阅读。',
  '',
  '## 一、输入（唯一事实源）',
  '只读这一个文件：' + PLANNER_INPUT,
  '它已由确定性脚本投影，只含业务字段（需求规则、业务行为四元组、差异、L7 结论）。',
  '**不要**去读 client-evidence.json / server-evidence.json / unified-atoms.json / 任何源码 —— 那些是技术视图的事。',
  '',
  '## 二、绝对禁止出现的内容（泄漏即验收失败）',
  '- 类名、方法名、函数名（如 GameMahView、applyPlayLmtsGray）',
  '- 协议消息名（MsgXxx）',
  '- 文件路径、行号（如 layer/GameMahView.ts:123）',
  '- 证据 ID（CLE-xxx / SVE-xxx）',
  '- 技术术语：verdict / applicability / analysisPath / conflict-fast / l7Basis / pending-blocked 等枚举名',
  '- 代码片段、XML、配置 key 原名（banker_level_type 这类要写成「庄家倍数档位」等业务说法）',
  '',
  '## 三、文档结构',
    '1. `# 杭州麻将好友房 — 规则说明（策划版）`',
    '2. `## 规则总览`：按玩法阶段分组，每阶段一句话概述 + 该阶段待确认/需裁决条数',
    '3. `## 逐条规则`：按阶段分节，每条规则一个条目，包含：',
    '   - 规则说明（需求原文的业务表述）',
    '   - 实际表现（玩家视角能看到的行为；若与规则一致写「与规则一致」）',
    '   - 结论标签（用纯业务语言）：',
    '     - 已验证：规则与游戏表现一致',
    '     - 规则待验证：还缺证据确认（缺什么用业务语言说明，如「需要在对局中确认吃牌后是否立刻刷新」）',
    '     - 待策划裁决：规则与游戏表现不一致，需要决定改规则还是改实现',
    '     - 不适用：该规则在本玩法中不生效',
    '     - 查证未完成：还没查完，暂无法判断',
    '4. `## 待确认与待裁决汇总`：把所有 规则待验证 / 待策划裁决 / 查证未完成 的条目汇总成表（规则 + 现状 + 需要谁处理）',
    '',
    '## 四、写作纪律',
    '- 全程玩家语言：用「玩家」「牌桌」「手牌」「出牌」「结算」这类词',
    '- 不解释技术实现原因，只陈述「规则要求什么 / 实际是什么 / 需要谁决定」',
    '- 不臆测：输入里没有的信息不要写；不确定就归入「查证未完成」',
    '- 中文写作，不使用 Emoji',
    '',
    '## 五、输出',
    '用 write 写文件：' + plannerPath + '（UTF-8 Markdown）。只写这一个文件，不执行 git。',
    '写完后返回 path / ruleCount / pendingCount / decisionCount。',
  ].join('\n')

const plannerResult = await agent(
  plannerPrompt,
  withWriteModel({
    label: '写策划版文档',
    agentType: 'general',
    schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        ruleCount: { type: 'number' },
        pendingCount: { type: 'number' },
        decisionCount: { type: 'number' },
      },
      required: ['path', 'ruleCount'],
    },
    timeoutMs: 3600000,
    retries: 2,
  })
)
if (!plannerResult || !plannerResult.path) throw new Error('策划版写作返回异常：' + JSON.stringify(plannerResult))

// 策划版泄漏扫描 + AT-ID 覆盖（确定性闸门）
const plannerCheckOk = await commandSuccess(
  'node ".opencode-workflows/scripts/check-planner-leak.mjs" --run-dir "' + runDir +
    '" --planner "' + plannerPath + '" --date "' + date + '"',
  300000
)
if (!plannerCheckOk) {
  throw new Error('S10 策划版泄漏扫描未通过（出现技术字段，见上方命令日志；修文档可重跑 S10）')
}

// 阶段速查表（确定性）
const manifestOk = await commandSuccess(
  'node ".opencode-workflows/scripts/build-stage-manifest.mjs" --run-dir "' + runDir + '" --date "' + date + '"',
  300000
)
if (!manifestOk) throw new Error('S10 阶段速查表生成失败（见上方命令日志）')

const finalStats = await agent(
  [
    '你是规格统计回读器，工作目录为项目根目录。只做读取与转写。',
    '',
    '任务：read ' + SPEC_DIR + '/runtime/spec_check/verify-report.md（小文件），返回其「统计」表中的数字：',
    'atomCount / verified / verificationRequired / decisionRequired / notApplicable / blocked。',
    '只输出结构化结果。',
  ].join('\n'),
  withModel({
    label: '回读规格统计',
    schema: {
      type: 'object',
      properties: {
        atomCount: { type: 'number' },
        verified: { type: 'number' },
        verificationRequired: { type: 'number' },
        decisionRequired: { type: 'number' },
        notApplicable: { type: 'number' },
        blocked: { type: 'number' },
      },
      required: ['atomCount'],
    },
    timeoutMs: 900000,
    retries: 2,
  })
)
if (!finalStats || !Number.isInteger(finalStats.atomCount)) throw new Error('规格统计回读异常：' + JSON.stringify(finalStats))

log(
  'S10 规格生成完成：阶段文档 ' + structure.stages.length + ' 份 / 原子 ' + finalStats.atomCount +
    '（verified ' + (finalStats.verified || 0) + ' / verification_required ' + (finalStats.verificationRequired || 0) +
    ' / decision_required ' + (finalStats.decisionRequired || 0) + ' / not_applicable ' + (finalStats.notApplicable || 0) +
    ' / blocked ' + (finalStats.blocked || 0) + '）/ 策划版 ' + plannerResult.ruleCount + ' 条规则' +
    ' -> ' + SPEC_DIR
)

return {
  specDir: SPEC_DIR,
  stageDocCount: structure.stages.length,
  featureIndexPath: FEATURE_INDEX,
  traceIndexPath: SPEC_DIR + '/trace_index.json',
  pendingListPath: SPEC_DIR + '/pending-list.md',
  verifyReportPath: SPEC_DIR + '/runtime/spec_check/verify-report.md',
  stageManifestPath: SPEC_DIR + '/stage_manifest.md',
  plannerPath: plannerPath,
  stats: {
    atomCount: finalStats.atomCount,
    verified: finalStats.verified || 0,
    verificationRequired: finalStats.verificationRequired || 0,
    decisionRequired: finalStats.decisionRequired || 0,
    notApplicable: finalStats.notApplicable || 0,
    blocked: finalStats.blocked || 0,
    plannerRuleCount: plannerResult.ruleCount,
  },
}
