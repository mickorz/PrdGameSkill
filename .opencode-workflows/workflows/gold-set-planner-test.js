export const meta = {
  id: 'gold-set-planner-test',
  name: 'gold_set_planner_test',
  description: 'Gold Set v1.0 盲测：策划版为唯一事实源盲答 10 题，对照 Gold 逐题评分并汇总缺陷清单',
}

// —— 生成前问询落档（用户既定口径）——
// 档位：质量优先（正式 benchmark）
// 模型：盲答与评分均用会话默认模型（被测对象即本 AI 的规则理解）；args.answerModel / args.judgeModel 可覆盖
// 并发：8（网关限流稳妥值，10 题两波跑完）
// 形态：单文件三阶段（盲答 → 评分 → 确定性汇总），注册在 workflows/ 一级目录可按名复跑
const DOC = 'E:/WorkProjects/PrdGameSkill/spec-workflow/output-spec/核心流程杭州麻将好友房AI-策划版.md'
const CONCURRENCY = 8
const AGENT_TIMEOUT_MS = 1200000

const GOLD_SET = [
  {
    id: 'G01', title: '房间配置完整性', type: '配置还原',
    input: '请描述这个杭州麻将四人好友房的完整配置。',
    gold: '必须准确提取：房间人数=4人；局数=固定8局；底分=1；财神=白板财神；起庄模式=笃三老庄；放铳=庄闲放铳；承包=三摊承包；特殊规则=吃碰禁手；封顶=无封顶；碰算摊=关闭；托管=关闭。',
    assertions: ['10项配置全部识别', '不得将碰算摊识别为开启', '不得将白板财神识别成翻财神', '不得将固定8局识别成40片'],
  },
  {
    id: 'G02', title: '首次开局条件', type: '房间生命周期',
    input: '房间已经创建，目前只有3名玩家入座。\n其中2名玩家已经准备。\n房主能否开始第一局？\n\n后来第四名玩家进入并准备，\n此时是否可以开始？',
    gold: '第一种情况不能开始。必须同时满足：1. 房间坐满4人；2. 4名玩家全部准备；3. 由房主开始首局。第四名玩家进入并完成准备后，满足条件，房主可以开始首局。',
    assertions: ['不能将3人房间视为可开始', '不能将部分玩家准备视为全部准备', '不能将首局开始权限交给任意玩家'],
  },
  {
    id: 'G03', title: '后续小局自动开始', type: '房间生命周期',
    input: '第一局已经结束，四名玩家都返回好友房。\n\nA、B、C已经准备，D尚未准备。\n此时是否自动开始第二局？\n\nD随后完成准备，是否还需要房主再次点击开始？',
    gold: 'A、B、C准备、D未准备：不能自动开始。D完成准备、四人全部准备：自动开始第二局。后续小局不需要房主再次点击开始。',
    assertions: ['必须区分首局：房主手动开始', '必须区分后续局：四人准备完成后自动开始'],
  },
  {
    id: 'G04', title: '庄家与闲家身份', type: '对局身份',
    input: '当前小局有四名玩家：\nA、B、C、D。\n\n系统确定A为本局庄家。\n\n请说明庄家和闲家的身份，以及谁先出牌。',
    gold: 'A：庄家；B、C、D：闲家。每小局只有一名庄家。庄家先出牌。',
    assertions: ['不得出现多个庄家', '不得将庄家身份与房主身份混淆', '不得认为房主必然是庄家'],
  },
  {
    id: 'G05', title: '上家定义与吃牌限制', type: '牌局操作',
    input: '当前玩家A准备吃牌。\n\nB是A的上家。\nC是A的对家。\nD是A的下家。\n\n分别讨论：\n\n1. B刚打出一张可以组成顺子的牌。\n2. C打出一张可以组成顺子的牌。\n3. D打出一张可以组成顺子的牌。\n\nA分别能否吃牌？',
    gold: 'B（上家）：可以，前提是满足吃牌条件；C（对家）：不可以；D（下家）：不可以。并且：上家定义为本家逆时针方向的上一家；吃牌只能使用上家刚刚打出的牌；不能拿之前打出的牌进行吃牌。',
    assertions: ['重点检查有没有把吃牌理解为可以吃任意玩家的牌（对家/下家打出的牌均不可吃）'],
  },
  {
    id: 'G06', title: '无托管与倒计时结束', type: '操作时序',
    input: '当前玩家需要出牌，操作倒计时已经归零。\n\n玩家没有点击任何按钮。\n\n系统应该如何处理？\n\n如果当前玩家正在响应其他玩家的吃、碰等操作，\n倒计时结束后又应该如何处理？',
    gold: '倒计时结束不代表自动出牌。系统不能自动选择一张牌打出。系统不能自动执行过牌。系统继续等待玩家手动出牌或响应。无托管，不存在超时自动操作。',
    assertions: ['自动打出默认牌属于错误', '自动打出最左侧的牌属于错误', '自动过牌属于错误', '自动选择吃碰杠属于错误', '倒计时归零直接改变玩家操作结果属于错误'],
  },
  {
    id: 'G07', title: '流局计数与小结算', type: '结算流程',
    input: '当前进行到第3局。\n\n这一局没有玩家胡牌，最终流局。\n\n请说明：\n1. 本局是否计入总局数？\n2. 是否需要进行小结算？\n3. 下一局的编号是多少？',
    gold: '流局计为1局。当前第3局完成后，总完成局数变为3。每小局均进行小结算。如果尚未达到8局，继续下一局。下一局为第4局。',
    assertions: ['不得将流局当成不计局数的无效局'],
  },
  {
    id: 'G08', title: '8局结束条件', type: '整场生命周期',
    input: '场次已经完成7局。\n\n第8局正常胡牌，完成小结算后，\n系统应该继续下一局，还是结束整场游戏？\n\n如果第8局是流局，结论是否变化？',
    gold: '两种情况都结束整场游戏。因为：固定8局；胡牌和流局都计入局数；第8局完成后进行小结算；满8局结束本场；不再开始第9局。',
    assertions: ['不得要求必须胡牌才计入8局', '不得将流局排除在8局之外', '不得在第8局结算后自动开启第9局'],
  },
  {
    id: 'G09', title: '三摊承包与碰算摊配置', type: '特殊规则',
    input: '当前好友房开启三摊承包，\n但碰算摊关闭。\n\n请说明这两个配置的关系。',
    gold: '三摊承包功能开启。碰算摊功能关闭。不能因为开启三摊承包，就认为碰牌也参与摊数计算。碰算摊关闭意味着碰牌不计入摊数。目前给出的规则没有完整说明吃、明杠、加杠、暗杠的具体计摊口径，也没有给出承包与反承包的完整赔付公式，因此不应自行补充这些细节。',
    assertions: ['是否区分承包开关和碰算摊开关', '是否将碰牌错误地计入摊数', '是否编造承包赔付公式'],
  },
  {
    id: 'G10', title: '综合场景与规则边界', type: '综合推理',
    input: '当前是第8局。\n\n四名玩家已经完成准备，系统自动开始本局。\n\nA是庄家，B、C、D是闲家。\n\n庄家A先出牌。\nB是C的上家，D是C的下家。\n\nB打出一张牌，C可以吃。\nC没有立即响应，倒计时结束。\n\n随后C手动吃牌并继续完成对局。\n本局最终流局。\n\n请完整描述这段流程，并说明场次是否结束。',
    gold: '1. 当前是第8局，四人准备完成后自动开始。2. A是本局庄家，B、C、D是闲家。3. A先出牌。4. B是C的上家，B打出的牌符合条件时，C可以吃。5. C没有及时操作，倒计时结束后系统不能自动过牌。6. C手动响应，系统按玩家操作继续。7. 本局最终流局。8. 流局计入1局。9. 第8局完成小结算后，整场结束。10. 不开启第9局。',
    assertions: ['验证准备流程', '验证庄家身份', '验证上家关系', '验证吃牌限制', '验证无托管', '验证流局计数', '验证小结算', '验证整场结束'],
  },
]

function parseAgentJson(text, label) {
  if (text == null || typeof text !== 'string' || !text.trim()) throw new Error(label + '：agent 返回为空')
  let t = text.trim()
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) t = fenced[1].trim()
  const first = t.indexOf('{')
  const last = t.lastIndexOf('}')
  if (first < 0 || last <= first) throw new Error(label + '：返回中未找到 JSON 对象')
  try {
    return JSON.parse(t.slice(first, last + 1))
  } catch (e) {
    throw new Error(label + '：JSON 解析失败——' + e.message)
  }
}

function answerPrompt(q) {
  return [
    '你是「杭州麻将四人好友房」规则基准测试的被测 AI，正在接受盲测。',
    '',
    '唯一事实源（先用 read 工具完整读取这份文档，再作答）：',
    DOC,
    '',
    '本题（' + q.id + ' · ' + q.title + '）：',
    q.input,
    '',
    '答题纪律（违反即判失败）：',
    '1. 只依据上述文档作答，文档怎么写就怎么答；禁止用常识、其他平台杭州麻将规则、通用麻将知识或推测补齐。',
    '2. 关键论断必须标注文档行号（格式「行NNN」）；无行号支撑的论断会被判为编造。',
    '3. 题目涉及但文档没有定义或说明的点：在 answer 中明确写「文档未定义」，并逐条列入 undefinedPoints——这是边界意识得分项，不是缺陷。',
    '4. 不臆造开关状态、流程步骤、计摊口径或赔付公式。',
    '',
    '只返回严格 JSON（不要代码围栏、不要任何其他文字）：',
    '{"qid":"' + q.id + '","answer":"完整回答（markdown，论断带行号引用）","undefinedPoints":["文档未定义且本题涉及的点"],"citedLines":[行号数组]}',
  ].join('\n')
}

function judgePrompt(q, blind) {
  return [
    '你是 Gold Set 基准测试的评分官，对一道题的盲答逐项评分。',
    '',
    '事实源文档（判定「编造」时必须用 read 工具核对）：',
    DOC,
    '',
    '本题（' + q.id + ' · ' + q.title + '）：',
    q.input,
    '',
    'Gold 标准答案：',
    q.gold,
    '',
    'Gold 评分断言（逐条判 pass/fail）：',
    q.assertions.map(function (a, i) { return (i + 1) + '. ' + a }).join('\n'),
    '',
    '盲答（被测 AI 仅依据文档作答的返回）：',
    JSON.stringify(blind, null, 1),
    '',
    '评分维度（本题满分 10 = 5 + 3 + 2）：',
    '- correctness（正确性，0~5 整数）：规则有没有说错，对照 Gold 标准答案逐项核对。',
    '- completeness（完整性，0~3 整数）：Gold 关键条件有没有遗漏。',
    '- boundary（边界意识，0~2 整数）：文档未定义的点有没有明确标注「文档未定义」，而不是猜测或用通识补齐。',
    '',
    '扣分项（每次扣 2 分，在本题得分内扣、扣到 0 为止，逐次记录）：',
    '- type=编造规则：答案断言了文档中不存在的规则/口径/公式。判定前必须核对文档——若答案给出的细节在文档中有依据（答案标注的行号内容确实支持该论断），即使 Gold 认为该细节「未定义、不应补充」，也不算编造，记入 docSuperset 观察项、不扣分；文档中找不到依据（或引用行号内容不符）才判编造。',
    '- type=开关状态错误：把关闭的开关说成开启（或反之），以 Gold 配置口径为准。',
    '- type=生命周期混淆：把不同生命周期阶段混淆（如首局/后续局开始条件、小结算/整场结束、庄家/房主身份）。',
    '',
    '只返回严格 JSON（不要代码围栏、不要任何其他文字）：',
    '{"qid":"' + q.id + '","correctness":0,"completeness":0,"boundary":0,"penalties":[{"type":"编造规则|开关状态错误|生命周期混淆","detail":"依据"}],"assertions":[{"text":"断言原文","pass":true,"note":"一句话依据"}],"docSuperset":["文档有据但 Gold 未覆盖的点"],"comment":"一句话总评"}',
  ].join('\n')
}

setConcurrency(CONCURRENCY)

phase('盲答（10 题并行，不接触 Gold）')
const answerOpts = { timeoutMs: AGENT_TIMEOUT_MS, retries: 2 }
if (args && args.answerModel) answerOpts.model = args.answerModel
const rawAnswers = await parallel(
  GOLD_SET.map(function (q) {
    return function () {
      return agent(answerPrompt(q), Object.assign({ label: '盲答-' + q.id }, answerOpts))
    }
  })
)
if (rawAnswers.length !== GOLD_SET.length) throw new Error('盲答数量不符：' + rawAnswers.length + '/' + GOLD_SET.length)
const blindAnswers = rawAnswers.map(function (t, i) {
  const q = GOLD_SET[i]
  const a = parseAgentJson(t, '盲答-' + q.id)
  if (a.qid !== q.id) throw new Error('盲答 qid 不符：期望 ' + q.id + '，实际 ' + a.qid)
  if (!a.answer || String(a.answer).trim().length < 10) throw new Error('盲答-' + q.id + '：answer 过短或为空')
  return {
    qid: q.id,
    answer: String(a.answer),
    undefinedPoints: Array.isArray(a.undefinedPoints) ? a.undefinedPoints.map(String) : [],
    citedLines: Array.isArray(a.citedLines) ? a.citedLines : [],
  }
})
const undefTotal = blindAnswers.reduce(function (n, a) { return n + a.undefinedPoints.length }, 0)
log('盲答完成 10/10，共识别文档未定义点 ' + undefTotal + ' 条')

phase('评分（10 题并行，逐项对照 Gold）')
const judgeOpts = { timeoutMs: AGENT_TIMEOUT_MS, retries: 2 }
if (args && args.judgeModel) judgeOpts.model = args.judgeModel
const rawScores = await parallel(
  GOLD_SET.map(function (q, i) {
    return function () {
      return agent(judgePrompt(q, blindAnswers[i]), Object.assign({ label: '评分-' + q.id }, judgeOpts))
    }
  })
)
if (rawScores.length !== GOLD_SET.length) throw new Error('评分数量不符：' + rawScores.length + '/' + GOLD_SET.length)
const anomalies = []
const judged = rawScores.map(function (t, i) {
  const q = GOLD_SET[i]
  const raw = parseAgentJson(t, '评分-' + q.id)
  if (raw.qid !== q.id) anomalies.push(q.id + '：评分返回 qid=' + raw.qid + ' 与题号不符，已按序对齐')
  function clamp(v, max, name) {
    const n = Number(v)
    if (!Number.isInteger(n) || n < 0 || n > max) {
      const fixed = Math.max(0, Math.min(max, Number.isFinite(n) ? Math.round(n) : 0))
      anomalies.push(q.id + '.' + name + ' 非法值 ' + JSON.stringify(v) + '，钳为 ' + fixed)
      return fixed
    }
    return n
  }
  return {
    qid: q.id,
    correctness: clamp(raw.correctness, 5, 'correctness'),
    completeness: clamp(raw.completeness, 3, 'completeness'),
    boundary: clamp(raw.boundary, 2, 'boundary'),
    penalties: (Array.isArray(raw.penalties) ? raw.penalties : [])
      .filter(function (p) { return p && (p.type || p.detail) })
      .map(function (p) { return { type: String(p.type || '编造规则'), detail: String(p.detail || '') } }),
    assertions: (Array.isArray(raw.assertions) ? raw.assertions : [])
      .map(function (a) { return { text: String((a && a.text) || ''), pass: !!(a && a.pass), note: String((a && a.note) || '') } }),
    docSuperset: Array.isArray(raw.docSuperset) ? raw.docSuperset.map(String) : [],
    comment: String(raw.comment || ''),
  }
})
log('评分完成 10/10' + (anomalies.length ? '（含 ' + anomalies.length + ' 条规范化记录）' : ''))

phase('汇总（确定性计分）')
const rows = GOLD_SET.map(function (q, i) {
  const j = judged[i]
  const gross = j.correctness + j.completeness + j.boundary
  const penaltyDeduct = 2 * j.penalties.length
  const score = Math.max(0, gross - penaltyDeduct)
  const passCount = j.assertions.filter(function (a) { return a.pass }).length
  return { id: q.id, title: q.title, type: q.type, gross: gross, penaltyDeduct: penaltyDeduct, score: score, passCount: passCount, assertTotal: j.assertions.length, judged: j, blind: blindAnswers[i] }
})
const total = rows.reduce(function (s, r) { return s + r.score }, 0)
const grade = total >= 90 ? '规则还原优秀' : total >= 80 ? '基本命中' : total >= 60 ? '需要补充' : '反推失败'

const lines = []
lines.push('# Gold Set v1.0 · 策划版盲测报告')
lines.push('')
lines.push('- 被测对象：`spec-workflow/output-spec/核心流程杭州麻将好友房AI-策划版.md`（盲答唯一事实源）')
lines.push('- 测试形态：盲答（10 题并行，仅依据策划版）→ 逐项对照 Gold 评分 → 确定性汇总')
lines.push('- 运行日期：' + ((args && args.runDate) || '未标注'))
lines.push('- **总分：' + total + ' / 100 —— ' + grade + '**')
lines.push('')
lines.push('## 一、成绩总表')
lines.push('')
lines.push('| 题号 | 主题 | 正确性/5 | 完整性/3 | 边界意识/2 | 扣分 | 得分/10 | 断言通过 |')
lines.push('|---|---|---|---|---|---|---|---|')
rows.forEach(function (r) {
  lines.push('| ' + r.id + ' | ' + r.title + ' | ' + r.judged.correctness + ' | ' + r.judged.completeness + ' | ' + r.judged.boundary + ' | ' + (r.penaltyDeduct ? ('-' + r.penaltyDeduct + '（' + r.judged.penalties.length + '次）') : '0') + ' | ' + r.score + ' | ' + r.passCount + '/' + r.assertTotal + ' |')
})
lines.push('| **合计** | | | | | | **' + total + '/100** | |')
lines.push('')
lines.push('## 二、逐题明细')
rows.forEach(function (r) {
  const j = r.judged
  lines.push('')
  lines.push('### ' + r.id + ' ' + r.title + '（' + r.type + '）—— 得分 ' + r.score + '/10' + (r.penaltyDeduct ? '（维度 ' + r.gross + '，扣 ' + r.penaltyDeduct + '）' : ''))
  lines.push('')
  lines.push('- 维度：正确性 ' + j.correctness + '/5 · 完整性 ' + j.completeness + '/3 · 边界意识 ' + j.boundary + '/2')
  if (r.blind.undefinedPoints.length) {
    lines.push('- 盲答标注的文档未定义点：')
    r.blind.undefinedPoints.forEach(function (p) { lines.push('  - ' + p) })
  } else {
    lines.push('- 盲答未标注任何文档未定义点')
  }
  lines.push('- 评分断言：')
  j.assertions.forEach(function (a, k) {
    lines.push('  - ' + (a.pass ? '✓' : '✗') + ' ' + (a.text || ('断言' + (k + 1))) + (a.note ? '——' + a.note : ''))
  })
  if (j.penalties.length) {
    lines.push('- 扣分项（每次 -2）：')
    j.penalties.forEach(function (p) { lines.push('  - [' + p.type + '] ' + p.detail) })
  }
  if (j.docSuperset.length) {
    lines.push('- 文档超集观察（文档有据、Gold 未覆盖，不扣分）：')
    j.docSuperset.forEach(function (d) { lines.push('  - ' + d) })
  }
  if (j.comment) lines.push('- 点评：' + j.comment)
})
const defects = []
rows.forEach(function (r) {
  r.judged.assertions.forEach(function (a) {
    if (!a.pass) defects.push(r.id + '：断言未过——' + a.text + (a.note ? '（' + a.note + '）' : ''))
  })
  r.judged.penalties.forEach(function (p) {
    defects.push(r.id + '：扣分[' + p.type + ']——' + p.detail)
  })
})
lines.push('')
lines.push('## 三、缺陷清单（失败断言 + 扣分项）')
lines.push('')
if (defects.length) defects.forEach(function (d) { lines.push('- ' + d) })
else lines.push('- 无：全部断言通过、无扣分项')
if (rows.some(function (r) { return r.judged.docSuperset.length })) {
  lines.push('')
  lines.push('## 四、Gold 与策划版的边界差异观察')
  lines.push('')
  lines.push('以下点策划版文档有明确定义（盲答有行号依据），但 Gold Set v1.0 按「未定义、不应补充」口径设定——供第二轮评审裁决是 Gold 需要扩充还是策划版需要收敛：')
  rows.forEach(function (r) {
    r.judged.docSuperset.forEach(function (d) { lines.push('- ' + r.id + '：' + d) })
  })
}
if (anomalies.length) {
  lines.push('')
  lines.push('## 五、评分过程规范化记录')
  anomalies.forEach(function (a) { lines.push('- ' + a) })
}
lines.push('')
lines.push('## 附录：10 道盲答原文（供第二轮评审）')
rows.forEach(function (r) {
  lines.push('')
  lines.push('### ' + r.id + ' ' + r.title)
  lines.push('')
  lines.push(r.blind.answer)
})
const report = lines.join('\n')

return {
  total: total,
  grade: grade,
  totalQuestions: rows.length,
  report: report,
  questions: rows.map(function (r) {
    return {
      id: r.id,
      title: r.title,
      score: r.score,
      dims: { correctness: r.judged.correctness, completeness: r.judged.completeness, boundary: r.judged.boundary },
      penalties: r.judged.penalties,
      assertions: r.judged.assertions,
      docSuperset: r.judged.docSuperset,
      undefinedPoints: r.blind.undefinedPoints,
      blindAnswer: r.blind.answer,
    }
  }),
}
