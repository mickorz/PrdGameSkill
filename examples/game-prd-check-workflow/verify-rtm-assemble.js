// rtm-assemble.mjs 的 mock 验证：构造分片数据，跑通组装/校验/统计全链路
// 用法: node verify-rtm-assemble.js （在 examples/game-prd-check-workflow/rtm-mock 下生成并执行）
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const ASSEMBLE = path.join(ROOT, '.opencode-workflows', 'scripts', 'rtm-assemble.mjs');
const MOCK = path.join(__dirname, 'rtm-mock');

// 清理旧 mock
fs.rmSync(MOCK, { recursive: true, force: true });

// runDir = runs/run-mock-001（identity-map 应落在 runs/ 上级）
const runDir = path.join(MOCK, 'runs', 'run-mock-001');
for (const d of ['requirements/parts', 'catalog/parts', 'checks']) {
  fs.mkdirSync(path.join(runDir, d), { recursive: true });
}

// mock 源 PRD（供证据校验 1/2/3 使用）
const prdLines = [
  '# 测试 PRD',
  '## 2.1 开局发牌',
  '庄家发放 13 张牌，闲家 13 张。',
  '发牌后刷新牌墙剩余数量。',
  '## 2.2 碰牌',
  '玩家满足条件时可以碰牌。',
  '碰牌成功后向其他玩家广播。',
];
fs.mkdirSync(path.join(MOCK, 'input'), { recursive: true });
fs.writeFileSync(path.join(MOCK, 'input', 'mock-prd.md'), prdLines.join('\n'), 'utf8');
const PRD = path.join(MOCK, 'input', 'mock-prd.md').split(path.sep).join('/');

// mock 规则源文件（rule-catalog 校验 file 存在性）
const ruleFile = path.join(MOCK, 'rules', 'mock-rule.md');
fs.mkdirSync(path.dirname(ruleFile), { recursive: true });
fs.writeFileSync(ruleFile, '# mock 规则\n1. 发牌规则\n2. 碰牌规则\n', 'utf8');
const RULE = ruleFile.split(path.sep).join('/');

// 1. requirements 分片：3 个需求点（一个文本与源文件不一致 → 校验降级）
const reqPart1 = [
  {
    reqKey: 'REQK-A1', title: '开局发牌',
    source: { file: PRD, section: '2.1', fromLine: 3, toLine: 4 },
    text: '庄家发放 13 张牌，闲家 13 张。发牌后刷新牌墙剩余数量。',
  },
  {
    reqKey: 'REQK-A2', title: '碰牌条件',
    source: { file: PRD, section: '2.2', fromLine: 6, toLine: 6 },
    text: '玩家满足条件时可以碰牌。',
  },
];
const reqPart2 = [
  {
    reqKey: 'REQK-B1', title: '碰牌广播（文本不一致样例）',
    source: { file: PRD, section: '2.2', fromLine: 7, toLine: 7 },
    text: '碰牌成功后向全场玩家广播。', // 实际源文件是“向其他玩家广播” → 校验3 不一致
  },
  {
    reqKey: 'REQK-B2', title: '无效行号样例',
    source: { file: PRD, fromLine: 100, toLine: 200 }, // 超出行数 → 校验2 失败
    text: '不存在的内容',
  },
];
fs.writeFileSync(path.join(runDir, 'requirements/parts/part-1.json'), JSON.stringify(reqPart1), 'utf8');
fs.writeFileSync(path.join(runDir, 'requirements/parts/part-2.json'), JSON.stringify(reqPart2), 'utf8');

// 2. catalog 分片：4 个规则点（其中 R02-003 无对应需求 → orphan）
const catalog = [
  { ruleId: 'R01-001', file: RULE, section: '1', fromLine: 2, toLine: 2, text: '发牌规则', mandatory: true },
  { ruleId: 'R01-002', file: RULE, section: '2', fromLine: 3, toLine: 3, text: '碰牌规则', mandatory: true },
  { ruleId: 'R02-003', file: RULE, section: '2', fromLine: 3, toLine: 3, text: '不适用规则样例', mandatory: false },
  { ruleId: 'R02-404', file: RULE, section: '2', fromLine: 3, toLine: 3, text: '检查组失败的规则点', mandatory: true },
];
fs.writeFileSync(path.join(runDir, 'catalog/parts/group-1.json'), JSON.stringify(catalog.slice(0, 2)), 'utf8');
fs.writeFileSync(path.join(runDir, 'catalog/parts/group-2.json'), JSON.stringify(catalog.slice(2)), 'utf8');

// 3. checks 分片：组1 完成；组2 失败（其 coverage 全部降级 unverified）
const check1 = {
  groupId: 'group-1', status: 'completed', inputFingerprint: 'sha:abc', ruleFingerprint: 'sha:def', checkVersion: 'v1',
  coverage: [
    { ruleId: 'R01-001', reqKey: 'REQK-A1', status: 'pass', evidence: 'PRD 2.1 与规则 1 一致' },
    { ruleId: 'R01-002', reqKey: 'REQK-A2', status: 'pass', evidence: 'PRD 2.2 与规则 2 一致' },
    { ruleId: 'R01-999', reqKey: 'REQK-A1', status: 'pass', evidence: 'ruleId 不存在样例' }, // 校验4 失败
    { ruleId: 'R01-002', reqKey: 'REQK-B1', status: 'conflict', evidence: '文本不一致样例' }, // 校验3 失败（源文本不一致）
  ],
};
const check2 = {
  groupId: 'group-2', status: 'failed', checkVersion: 'v1',
  coverage: [{ ruleId: 'R02-404', reqKey: 'REQK-B2', status: 'pass', evidence: '组失败样例' }],
};
fs.writeFileSync(path.join(runDir, 'checks/group-1.json'), JSON.stringify(check1), 'utf8');
fs.writeFileSync(path.join(runDir, 'checks/group-2.json'), JSON.stringify(check2), 'utf8');

// 4. issues-raw：一个 MISSING 问题关联 REQK-B1（映射 missing），一个 P3 建议
const issuesRaw = [
  { id: 'PRD-001', type: 'MISSING', priority: 'P1', title: '缺广播细节', requirementRefs: ['REQK-B1'] },
  { id: 'PRD-002', type: 'INCOMPLETE', priority: 'P3', title: '可补充示例', requirementRefs: ['REQK-A2'] },
];
fs.writeFileSync(path.join(runDir, 'issues-raw.json'), JSON.stringify(issuesRaw), 'utf8');

// 5. meta：failedGroups
fs.writeFileSync(path.join(runDir, 'meta.json'), JSON.stringify({ checkDate: '2026-11-12', failedGroups: ['group-2（Bug覆盖）'] }), 'utf8');

// 执行组装
const { execSync } = require('child_process');
const cmd = ['node', ASSEMBLE, runDir, '--issues-raw', path.join(runDir, 'issues-raw.json'), '--meta', path.join(runDir, 'meta.json'), '--identity-map', path.join(MOCK, 'identity-map.json')].map((x) => '"' + x + '"').join(' ');
let out;
try {
  out = execSync(cmd, { encoding: 'utf8', cwd: ROOT });
  console.log(out);
} catch (e) {
  console.log('STDOUT:', e.stdout);
  console.log('STDERR:', e.stderr);
  process.exit(1);
}

// 断言
const matrix = JSON.parse(fs.readFileSync(path.join(runDir, 'requirements-matrix.json'), 'utf8'));
const idMap = JSON.parse(fs.readFileSync(path.join(MOCK, 'identity-map.json'), 'utf8'));
const assert = (cond, msg) => { if (!cond) { console.error('[断言失败] ' + msg); process.exitCode = 1; } else console.log('[通过] ' + msg); };

assert(matrix.stats.requirementTotal === 4, '需求点总数 = 4');
assert(matrix.stats.rulePointTotal === 4 && matrix.stats.applicableRulePoints === 4, '规则点 4 / 适用 4（v4 新口径：适用=非na，mandatory 不再决定分母）');
// 完成率：适用 3（R01-001,R01-002,R02-404）中 unverified 的有 R02-404(组失败) → checked=2 → 2/3
assert(Math.abs(matrix.stats.checkCompleteRate - 0.5) < 1e-3, '完成率 = 2/4（R02-003 无覆盖、R02-404 组失败 → unverified 不计入完成分子）');
// 通过率：pass 的 R01-001,R01-002 → 2/2 = 1（R01-999 不存在于 catalog 不计入 catalog 侧统计）
assert(matrix.stats.rulePassRate === 0.5, '通过率 = 1/2（R01-002 对 B1 的判定因证据失效降 unverified，保守正确）');
assert(matrix.requirements.every((r) => r.requirementId && r.requirementId.startsWith('REQ-')), '全部需求点有稳定 REQ ID');
const byKey = Object.fromEntries(matrix.requirements.map((r) => [r.reqKey, r]));
assert(byKey['REQK-B1'].overallStatus === 'unverified' && byKey['REQK-B1'].ruleRefs.some((x) => x.evidenceInvalid), '文本不一致样例 → unverified（校验3 失败强制不可被语义状态覆盖）');
assert(byKey['REQK-B2'].overallStatus === 'unverified', '无效行号样例 → unverified（校验2 + 组失败）');
assert(byKey['REQK-B1'].issueIds.includes('PRD-001'), 'MISSING 问题已关联 REQK-B1');
assert(byKey['REQK-A1'].overallStatus === 'unverified' && byKey['REQK-A1'].ruleRefs.find((x) => x.ruleId === 'R01-999').evidenceInvalid === true, 'ruleId 不存在样例 → evidenceInvalid 强制 unverified');
assert(byKey['REQK-A2'].overallStatus === 'pass' && byKey['REQK-A2'].issueIds.includes('PRD-002'), 'P3 建议不降级状态（A2 保持 pass）');
assert(matrix.ruleCoverage.find((r) => r.ruleId === 'R02-003').orphan === true, '非强制且无对应需求 → orphan 标记');
assert(matrix.ruleCoverage.find((r) => r.ruleId === 'R02-404').status === 'unverified', '失败组规则点 → unverified');
assert(idMap.next === 5, 'identity-map next = 5（4 个需求点分配 REQ-001~004）');
assert(fs.existsSync(path.join(runDir, 'matrix-report.md')) && fs.existsSync(path.join(runDir, 'manifest.json')), 'matrix-report.md 与 manifest.json 已生成');
// 二次运行：复用 identity-map（REQ ID 不变），同样带齐输入（issues-raw/meta）
const rerunCmd = ['node', ASSEMBLE, runDir, '--issues-raw', path.join(runDir, 'issues-raw.json'), '--meta', path.join(runDir, 'meta.json'), '--identity-map', path.join(MOCK, 'identity-map.json')].map((x) => '"' + x + '"').join(' ');
execSync(rerunCmd, { encoding: 'utf8', cwd: ROOT, stdio: 'pipe' });
const matrix2 = JSON.parse(fs.readFileSync(path.join(runDir, 'requirements-matrix.json'), 'utf8'));
assert(JSON.stringify(matrix2.requirements.map((r) => r.requirementId)) === JSON.stringify(matrix.requirements.map((r) => r.requirementId)), '二次运行 REQ ID 稳定不漂移');
// 规则七状态聚合恒等式（v4 领导视图调整新增）
const agg = matrix.stats.ruleCoverageAgg;
const aggSum = agg.fullyPassed + agg.partial + agg.conflict + agg.missing + agg.unverified + agg.pendingConfirm + agg.notApplicable;
assert(aggSum === agg.total && agg.total === 4, '规则七状态恒等式成立（4 = ' + aggSum + '）');
assert(matrix.stats.fullPassRate !== undefined, '规则完整通过率字段已输出');
assert(agg.fullyPassed === 1 && agg.unverified === 3, '聚合判定正确：R01-001 完整通过；R01-002（证据失效强制）、R02-003（无覆盖）、R02-404（组失败）均 unverified');
console.log('\nmock 验证完成，产物目录: ' + MOCK);
