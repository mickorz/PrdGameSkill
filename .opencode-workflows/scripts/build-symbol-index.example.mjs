// build-symbol-index.example.mjs —— build-symbol-index.mjs 自检（断言式，跑完打印结果退出）
// 覆盖：
//   A. CLI build 真实源码（srcRoot 见 T0 调查报告 §5，只读）：退出码 0、落盘 symbol-index.json；
//      stats.files 与 example 自行递归重数一致；四类计数之和 = symbols 长度 = stats.symbols；
//      全部符号 file 前缀属于三目录（xiaoshanmj 等 4 个变体不扫）；date/srcRoot/roots 记录正确
//   B. 已知锚点（file:line 与 T0 调查报告人工核对过）：
//      方法 13 个（BoxZhuangStep::JudgeDingZhuang/JudgeHuanZhuang/GetConfiguredBankerLevel、
//      BoxChowStep::Judge/CalcChowForbidMahs、BoxHuStep::Judge/JudgeRobKong、
//      BoxResultStep::UpdateBankerLevel、GameLogic::LoadBoxJsonConfig/LoadGoldJsonConfig/
//      IsSubgameMessage、ActionStep::HandleMessage/OnMsgHuC）；类 4 个（BoxStartStep、GoldStartStep、
//      GameLogic、ActionStep）；自由函数 1 个（Gbk2Utf8Impl）
//   C. 排除规则：列首调用（com_result.cpp L18 的 Step::Execute()）不记方法；
//      头文件声明（game_logic.h L23/24 的 override 声明）不记定义（LoadBoxJsonConfig 全索引仅 1 条）
//   D. 配置项 35 条全部在 game_logic.cpp：好友房 30 条（L24~L199，含 bot）+ 金币场 5 条
//      （game_rule/make_card/is_open_card/gan_yu/max_mult，L209~L339）；make_card 与 is_open_card
//      好友房/金币场各一条共 2 条；meta 元数据（base_score 默认 1、first_banker_type/cai_shen_type/
//      banker_level_type 默认 0、enable_three_tan_bao/bot 默认 false、draw_continue_banker 默认 true）
//      与 in 所在函数正确
//   E. query 子命令：符号命中（含 file:line 与 meta 默认值）、kind 过滤（class 只出类）、无匹配退出码 1
//   F. 确定性：同参数连跑两次输出逐字节一致
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildSymbolIndex, querySymbols } from './build-symbol-index.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = path.join(REPO_ROOT, '.opencode-workflows/scripts/build-symbol-index.mjs')
// 服务端源码根（T0 调查报告 §5 记录的只读路径）：下含 game_hzmj/ 与 mah_frame/
const SRC_ROOT = 'E:/WorkProjects/xc-flow/.xflow/xc/xcodeDev/game-mahjong/server/Logic/mahjong_server/src'
const OUT = path.join(REPO_ROOT, 'spec-workflow/output-spec/server-rule-verify/symbol-index.json')
const OUT2 = path.join(REPO_ROOT, '.opencode-workflows/scripts/tmp-symbol-index/symbol-index-2.json')
const TMP_DIR = path.join(REPO_ROOT, '.opencode-workflows/scripts/tmp-symbol-index')

const runCli = (args) => {
  try {
    const out = execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }
  }
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))

// ============================================================
// A. CLI build 真实源码 + 总量与范围自洽
// ============================================================
{
  const r = runCli(['build', SRC_ROOT, OUT, '2026-11-14'])
  assert.equal(r.code, 0, '真实源码 CLI 运行应成功：\n' + r.out)

  const idx = readJson(OUT)
  assert.equal(idx.date, '2026-11-14')
  assert.equal(idx.srcRoot, path.resolve(SRC_ROOT).split(path.sep).join('/'))
  assert.deepEqual(idx.roots, ['game_hzmj/common_game', 'game_hzmj/hzmj_server', 'mah_frame'])

  // example 自行重数文件（与扫描器同规则递归；pb 生成文件排除）
  const exts = new Set(['.h', '.cpp', '.cc', '.cxx'])
  const generatedRe = /\.pb\.(h|cpp|cc|cxx)$/
  const countFiles = (rel) => {
    let n = 0
    const walk = (dir) => {
      for (const ent of fs.readdirSync(path.join(SRC_ROOT, dir), { withFileTypes: true })) {
        if (ent.isDirectory()) walk(dir + '/' + ent.name)
        else if (exts.has(path.extname(ent.name)) && !generatedRe.test(ent.name)) n++
      }
    }
    walk(rel)
    return n
  }
  const expectFiles = countFiles('game_hzmj/common_game') + countFiles('game_hzmj/hzmj_server') + countFiles('mah_frame')
  assert.equal(idx.stats.files, expectFiles, 'stats.files 应与重数一致')
  assert.ok(idx.stats.excludedGenerated >= 1, 'pb 生成文件应被排除并计数')
  assert.ok(idx.symbols.every((sym) => !/\.pb\./.test(sym.file)), '索引不应含 pb 生成文件符号')

  // 四类计数之和 = symbols 长度 = stats.symbols
  const s = idx.stats
  assert.equal(s.classes + s.methods + s.functions + s.configKeys, s.symbols)
  assert.equal(idx.symbols.length, s.symbols)

  // 全部符号在三目录内，字段完整
  for (const sym of idx.symbols) {
    assert.ok(
      sym.file.startsWith('game_hzmj/common_game/') || sym.file.startsWith('game_hzmj/hzmj_server/') || sym.file.startsWith('mah_frame/'),
      '符号应落在三目录内：' + sym.file,
    )
    assert.ok(sym.name, '符号应有 name')
    assert.ok(sym.line >= 1, '符号 line 应 ≥ 1')
    assert.ok(['class', 'method', 'function', 'config-key'].includes(sym.kind), 'kind 合法：' + sym.kind)
  }

  // finders
  const findMethod = (qual, name, file) => idx.symbols.filter((x) => x.kind === 'method' && x.qualifier === qual && x.name === name && (!file || x.file === file))
  const findClass = (name, file) => idx.symbols.filter((x) => x.kind === 'class' && x.name === name && (!file || x.file === file))
  const findFn = (name, file) => idx.symbols.filter((x) => x.kind === 'function' && x.name === name && (!file || x.file === file))
  const findCfg = (name, inFn) => idx.symbols.filter((x) => x.kind === 'config-key' && x.name === name && (!inFn || x.in === inFn))

  // ============================================================
  // B. 已知锚点（与 T0 调查报告人工核对过的 file:line）
  // ============================================================
  const JU = 'game_hzmj/common_game/com_game/common_game_com_ju.cpp'
  const ACT = 'game_hzmj/common_game/com_game/common_game_com_action.cpp'
  const RES = 'game_hzmj/common_game/com_game/common_game_com_result.cpp'
  const GL = 'game_hzmj/hzmj_server/game_logic.cpp'
  const MF_ACT = 'mah_frame/com_basic/com_action.cpp'

  const methodAnchors = [
    ['BoxZhuangStep', 'JudgeDingZhuang', JU, 124],
    ['BoxZhuangStep', 'JudgeHuanZhuang', JU, 139],
    ['BoxZhuangStep', 'GetConfiguredBankerLevel', JU, 191],
    ['BoxChowStep', 'Judge', ACT, 54],
    ['BoxChowStep', 'CalcChowForbidMahs', ACT, 162],
    ['BoxHuStep', 'Judge', ACT, 259],
    ['BoxHuStep', 'JudgeRobKong', ACT, 383],
    ['BoxResultStep', 'UpdateBankerLevel', RES, 358],
    ['GameLogic', 'LoadBoxJsonConfig', GL, 18],
    ['GameLogic', 'LoadGoldJsonConfig', GL, 208],
    ['GameLogic', 'IsSubgameMessage', GL, 357],
    ['ActionStep', 'HandleMessage', MF_ACT, 117],
    ['ActionStep', 'OnMsgHuC', MF_ACT, 282],
  ]
  for (const [qual, name, file, line] of methodAnchors) {
    const hits = findMethod(qual, name, file)
    assert.equal(hits.length, 1, qual + '::' + name + ' 应恰有 1 条：' + file)
    assert.equal(hits[0].line, line, qual + '::' + name + ' 行号应为 ' + line)
  }

  const classAnchors = [
    ['BoxStartStep', 'game_hzmj/common_game/com_game/common_game_com_ju.h', 25],
    ['GoldStartStep', 'game_hzmj/common_game/com_game/common_game_com_ju.h', 42],
    ['GameLogic', 'game_hzmj/hzmj_server/game_logic.h', 17],
    ['ActionStep', 'mah_frame/com_basic/com_action.h', 16],
  ]
  for (const [name, file, line] of classAnchors) {
    const hits = findClass(name, file)
    assert.equal(hits.length, 1, 'class ' + name + ' 应恰有 1 条：' + file)
    assert.equal(hits[0].line, line, 'class ' + name + ' 行号应为 ' + line)
  }

  const gbk = findFn('Gbk2Utf8Impl', 'mah_frame/base/common_utils.cpp')
  assert.equal(gbk.length, 1, '自由函数 Gbk2Utf8Impl 应被收录')
  assert.equal(gbk[0].line, 397)

  // ============================================================
  // C. 排除规则
  // ============================================================
  // 列首调用不算定义：com_result.cpp L18 是 Step::Execute() 调用
  assert.equal(findMethod('Step', 'Execute', RES).length, 0, '列首调用不应记为方法')
  // 头文件 override 声明不算定义：LoadBoxJsonConfig 全索引仅 .cpp 定义 1 条
  assert.equal(findMethod('GameLogic', 'LoadBoxJsonConfig').length, 1, '声明被排除，仅 1 条定义')

  // ============================================================
  // D. 配置项（35 条全部在 game_logic.cpp）
  // ============================================================
  const cfgs = idx.symbols.filter((x) => x.kind === 'config-key')
  assert.equal(cfgs.length, 35, '配置项应为 35 条（好友房 30 + 金币场 5）')
  assert.ok(cfgs.every((x) => x.file === GL), 'config.contains 全索引仅出现在 game_logic.cpp')

  const boxKeys = [
    'base_score', 'first_banker_type', 'rotate_banker_type', 'draw_continue_banker',
    'cai_shen_type', 'banker_level_type', 'enable_banker_discard_hu', 'enable_three_tan_bao',
    'pung_as_tan', 'must_bao_tou_with_cai', 'enable_three_cai_double', 'enable_four_cai_double',
    'cai_for_hao_qi', 'enable_ten_wind', 'only_pung_no_chow', 'rule_chi_peng', 'enable_two_suit',
    'del_feng', 'enable_chow_forbid', 'enable_pung_forbid', 'follow_banker', 'follow_pay_type',
    'guard_dealer', 'simple_mode', 'score_limit', 'play_score', 'lian_zhuang_bu_zhan',
    'make_card', 'is_open_card', 'bot',
  ]
  assert.equal(boxKeys.length, 30)
  for (const k of boxKeys) {
    const hits = findCfg(k, 'GameLogic::LoadBoxJsonConfig')
    assert.equal(hits.length, 1, '好友房配置项应恰有 1 条：' + k)
  }

  // meta 元数据（默认值/类型/取值范围人工核对）
  const metaAnchors = [
    ['base_score', 24, { type: 'int64', range: '>0', default: '1' }],
    ['first_banker_type', 38, { type: 'int8', range: '0随机/1房主', default: '0' }],
    ['draw_continue_banker', 47, { type: 'bool', default: 'true' }],
    ['cai_shen_type', 53, { type: 'int8', range: '0白板财神/1翻财神', default: '0' }],
    ['banker_level_type', 57, { type: 'int8', range: '0平庄起/1笃二老庄/2笃三老庄', default: '0' }],
    ['enable_banker_discard_hu', 61, { type: 'bool', default: 'true' }],
    ['enable_three_tan_bao', 67, { type: 'bool', default: 'false' }],
    ['must_bao_tou_with_cai', 91, { type: 'bool', default: 'false' }],
    ['bot', 199, { type: 'bool', default: 'false' }],
  ]
  for (const [key, line, meta] of metaAnchors) {
    const hits = findCfg(key, 'GameLogic::LoadBoxJsonConfig')
    assert.equal(hits[0].line, line, key + ' 行号应为 ' + line)
    assert.ok(hits[0].meta, key + ' 应带 meta')
    for (const [k, v] of Object.entries(meta)) assert.equal(hits[0].meta[k], v, key + ' meta.' + k)
  }

  // 金币场 5 条
  const goldKeys = ['game_rule', 'make_card', 'is_open_card', 'gan_yu', 'max_mult']
  for (const k of goldKeys) {
    const hits = findCfg(k, 'GameLogic::LoadGoldJsonConfig')
    assert.equal(hits.length, 1, '金币场配置项应恰有 1 条：' + k)
  }
  assert.equal(findCfg('game_rule')[0].line, 209)
  assert.equal(findCfg('max_mult')[0].line, 339)
  // make_card / is_open_card 好友房与金币场各 1 条
  assert.equal(findCfg('make_card').length, 2, 'make_card 应有好友房+金币场 2 条')
  assert.equal(findCfg('is_open_card').length, 2, 'is_open_card 应有好友房+金币场 2 条')

  // ============================================================
  // E. query 子命令（CLI + 导入函数）
  // ============================================================
  const q1 = runCli(['query', OUT, 'JudgeDingZhuang'])
  assert.equal(q1.code, 0)
  assert.ok(q1.out.includes('[method] BoxZhuangStep::JudgeDingZhuang'), 'query 应打印符号')
  assert.ok(q1.out.includes(JU + ':124'), 'query 应打印 file:line')

  const q2 = runCli(['query', OUT, 'first_banker_type'])
  assert.equal(q2.code, 0)
  assert.ok(q2.out.includes('default=0'), 'query 应打印默认值')
  assert.ok(q2.out.includes('in=GameLogic::LoadBoxJsonConfig'), 'query 应打印所在函数')

  const q3 = runCli(['query', OUT, 'Box', 'class'])
  assert.equal(q3.code, 0)
  assert.ok(q3.out.includes('[class] BoxStartStep'), 'kind 过滤应只出类')
  assert.ok(!q3.out.includes('[method]'), 'kind=class 不应出方法')

  const q4 = runCli(['query', OUT, 'zzz_no_match_term'])
  assert.equal(q4.code, 1, '无匹配应退出码 1')

  // 导入函数直查（与 CLI 同源）
  assert.equal(querySymbols(idx, 'JudgeDingZhuang').length, 1)
  assert.equal(querySymbols(idx, 'Box', 'class').length, querySymbols(idx, 'Box', 'class').length)
  assert.ok(querySymbols(idx, 'zzz').length === 0)

  // ============================================================
  // F. 确定性：同参数连跑两次逐字节一致
  // ============================================================
  const r2 = runCli(['build', SRC_ROOT, OUT2, '2026-11-14'])
  assert.equal(r2.code, 0)
  assert.equal(Buffer.compare(fs.readFileSync(OUT), fs.readFileSync(OUT2)), 0, '两次构建输出应逐字节一致')
}

fs.rmSync(TMP_DIR, { recursive: true, force: true })
console.log('[成功] build-symbol-index.example 全部断言通过（真实源码构建/锚点核对/排除规则/配置项35条/query/确定性）')
