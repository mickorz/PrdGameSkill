// Output-Spec Generate 策划版对照实验（T0.1b，阶段 0 / 需求 R8）
//
// 位置与调用：本目录不在注册表扫描范围，经 workflow 工具显式 scriptPath 调用：
//   ./.opencode-workflows/workflows/output-spec-generate/experiment-planner-projection.js
//
// 两步依赖（先跑 prepare 再跑本脚本，2026-11-14）：
//   第一步（已完成，确定性脚本可自行运行）：
//     node .opencode-workflows/scripts/prepare-planner-experiment.mjs \
//       spec-workflow/output-spec/2026-11-13/1-spec \
//       spec-workflow/output-spec/quality-compare/planner-experiment
//     产出 outDir/source/{meta.json, planner-evidence_<stageId>.json}
//   第二步（本脚本，由用户手动触发）：每阶段一个 agent 投影策划版章节。
//
// 为什么 agent 要自己 read 证据文件（而非脚本内嵌 JSON）：
//   workflow 沙箱无 readFile（见 4-assemble-verify.js 同款经验），证据文件由
//   prepare 脚本确定性落盘（已剔除 client_logic/evidence/路径等技术字段，单文件 < 14KB），
//   agent read 小文件即为唯一事实来源，符合「结构化字段隔离」第一级（需求 6.2）。
//
// 实验目的（验收边界，需求 7.2）：只验证 Prompt 投影可行性——
//   旧证据能否转成策划可读语言 / UI 行为是否保留 / Atom ID 是否可追溯。
//   本实验不验证 businessBehavior/difference 新 Schema（归阶段 2 T2.6）。
//
// 评审补充的硬规则（2026-11-14 二审，用户强调）：
//   uiInteraction/notes 字段本身残留技术词（实测 578 字段中 127 个含技术词，
//   如 BoxHzmjMah2DView.showDice / C_Bank / MsgJuData / KW_RESULT / onShowZhuang），
//   Prompt 必须要求转写成玩家语言，禁止原样复制；没有证据宁可标未验证，禁止编造业务规则。
//
// args：
//   outDir  实验产物目录（可写），默认 spec-workflow/output-spec/quality-compare/planner-experiment
//   stages  目标阶段数组，默认 ['ST-C01','ST-C05','ST-C02']（定庄/吃碰杠/财神表现，需求 R8）
//
// 返回：{ outDir, products: [策划版文件路径], atomTotals }
//
// 运行前核对闸门（T0.3 人工评审三检查点，不设机械校验——本阶段是实验不是正式链路）：
//   1. 无技术泄漏（可用 .opencode-workflows/scripts 泄漏正则临时 grep）
//   2. 信息不丢失（对照技术补充版同章节，白板财神高亮等差异仍在）
//   3. Atom ID 可追溯（每条补充行带 AT-ID）

export const meta = {
  id: 'output-spec-planner-experiment',
  name: 'output_spec_planner_experiment',
  description: '策划版对照实验：复用首跑查证索引对三目标阶段投影策划可读章节文档',
  phases: [{ title: '策划版投影实验' }],
}

const A = args || {}

const outDir = A.outDir || 'spec-workflow/output-spec/quality-compare/planner-experiment'
const stages = Array.isArray(A.stages) && A.stages.length > 0 ? A.stages : ['ST-C01', 'ST-C05', 'ST-C02']

function evidencePath(stageId) {
  return outDir + '/source/planner-evidence_' + stageId + '.json'
}

function plannerPath(stageId) {
  return outDir + '/策划版_' + stageId + '.md'
}

// 策划版投影 Prompt（T0.2 定稿草案，阶段 1 正式实现的蓝本；结构化隔离：输入只含业务字段）
function plannerPrompt(stageId) {
  return [
    '你是需求文档整理员，面向策划输出。任务：把一个游戏需求章节增强成「策划版」文档——原文规则全部保留，补充玩家可理解的界面表现与待确认差异。工作目录为项目根目录。',
    '',
    '本阶段：' + stageId + '。',
    '',
    '第一步，读证据文件（唯一事实依据，read 工具）：' + evidencePath(stageId),
    '该文件内含：章节标题（title）、来源章节（sourceTitle）、模板文件路径（templatePath）、模板章节行号（fromLine/toLine）、名词章节行号（termsFromLine/termsToLine）、瘦身原子项列表（atoms，每条含 id/name/rule/uiRequirement/uiInteraction/notes/verdict）。',
    '',
    '第二步，读模板章节原文：用 read 工具打开证据文件中的 templatePath，offset=fromLine，limit=toLine-fromLine+1（覆盖第 fromLine~toLine 行）；名词术语可另读 termsFromLine~termsToLine 行帮助理解。',
    '',
    '第三步，写目标文件（write 工具，UTF-8）：' + plannerPath(stageId),
    '',
    '文档结构：',
    '1. 首行为「# 」+ 章节标题（title），随后一行引语：> 来源：模板「sourceTitle」章节（策划版投影实验）。',
    '2. 章节原文逐条保留：标题行与规则语句的顺序、语义不得删改，可修明显笔误但不改规则含义。',
    '3. 在每条规则语句（列表项/段落）之后补充缩进两个空格的子列表项（没有原子项对应的原文语句不补充，保留原样；一条原文语句对应多个原子项时合并成一条补充行）：',
    '   - 该语句对应的原子项 verdict=confirmed/partial 且 uiInteraction 或 notes 有内容：写「  - 界面表现：{玩家可理解的行为描述}（{原子项id}）」',
    '   - 原子项 notes 描述了实现与需求不一致（如需求说按普通白板展示、实际牌河中仍高亮）：另起一条「  - 待确认：需求为「{原文规则}」，实际表现为「{实际行为}」（{原子项id}）」',
    '   - 原子项 verdict=not_found：写「  - 待确认：客户端未查到对应实现（{原子项id}）」',
    '   - 原子项 uiInteraction 与 notes 均为空且 verdict=confirmed：不硬凑补充行，只保留原文。',
    '',
    '转写硬规则（最重要）：',
    '1. uiInteraction 与 notes 是工程师写的查证记录，其中残留大量技术词（实测如此），禁止原样复制进策划版：出现类名（如 GameJuDataCmd、GameData、BoxHzmjMah2DView）、方法名（如 onShowZhuang、showDice、setZhuangSeat）、协议名（MsgJuData、CMD_xxx、GP_xxx）、常量（C_Bank、KW_RESULT、POWER_ID_HU）、UI 组件名（box_hzmj_xxx）、文件路径（source-code/...、xxx.ts:31）时，必须转写成玩家能看见、能操作的行为描述（例：「BoxHzmjMah2DView.showDice」转写为「牌桌播放骰子动画」；「C_Bank 的 zhuang1~3 页」转写为「庄家标志按牢庄等级分三档点亮」）。',
    '2. 无法转写成玩家行为的技术细节直接丢弃，不写进策划版；转写不得改变该行为的事实本身。',
    '3. 没有证据支撑的规则宁可标注「待确认」，严禁为了让文档完整而编造业务规则或编造界面表现。',
    '4. 每条补充行末尾用括号附原子项 id（AT-ST-Cxx-nnn 形式），供追溯。',
    '5. 全文不得出现：类名、方法名、Msg/CMD/GP 前缀协议名、C_/KW_/ET_ 前缀常量、box_ 组件名、source-code 路径、任何 .ts/.xml 文件名与 file:line。',
    '6. 中文书写，无 Emoji，不要用代码围栏包裹整份文档；直接逐条边写边落盘，不要先整理全部再写盘。',
    '',
    '写完只返回目标文件路径与一句话摘要，不要输出文档全文，不要执行 git 命令。',
  ].join('\n')
}

phase('策划版投影实验')

// 证据文件就位检查（fail fast：prepare 脚本未跑或路径不对时立即报错，不浪费 agent）
for (const stageId of stages) {
  const p = evidencePath(stageId)
  await check(() => fileExists(p), '证据文件不存在，请先运行 prepare-planner-experiment.mjs：' + p)
}

log('策划版对照实验：目标 ' + stages.length + ' 阶段（' + stages.join('、') + '），产物目录 ' + outDir)

const results = await parallel(
  stages.map((stageId) => () =>
    agent(plannerPrompt(stageId), {
      label: '策划版 ' + stageId,
      agentType: 'general',
      timeoutMs: 3600000,
      retries: 2,
    })
  )
)

// 落盘闸门：agent 返回但未写盘当场拦截（沿用 3-produce-outputs v2 闸门经验）
const products = []
for (let i = 0; i < stages.length; i++) {
  const stageId = stages[i]
  const target = plannerPath(stageId)
  await check(() => fileExists(target), '阶段 ' + stageId + ' 策划版未生成（agent 返回但未写盘）：' + target)
  products.push(target)
}

log('策划版投影实验完成：' + products.length + ' 份产物（' + products.join('、') + '）')

return {
  outDir: outDir,
  stages: stages,
  products: products,
  note: '验收走 T0.3 三检查点（无技术泄漏/信息不丢失/AT-ID 可追溯），由人工评审；本实验不验证新 Schema',
}
