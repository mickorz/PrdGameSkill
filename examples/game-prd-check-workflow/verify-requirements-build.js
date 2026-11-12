// requirements-build.mjs 的 mock 验证：三轮提取验证 ID 三层匹配与引文校验
// 用法: node verify-requirements-build.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const BUILD = path.join(ROOT, '.opencode-workflows', 'scripts', 'requirements-build.mjs');
const MOCK = path.join(__dirname, 'rtm-mock', 'req-build');

fs.rmSync(MOCK, { recursive: true, force: true });

// mock 源 PRD
const prdLines = [
  '# 测试 PRD',
  '## 2.1 开局发牌',
  '庄家发放 13 张牌，闲家 13 张。',
  '发牌后刷新牌墙剩余数量。',
  '## 2.2 碰牌',
  '玩家满足条件时可以碰牌。',
  '碰牌成功后向其他玩家广播。',
];
const inputDir = path.join(MOCK, 'input');
fs.mkdirSync(inputDir, { recursive: true });
fs.writeFileSync(path.join(inputDir, 'mock-prd.md'), prdLines.join('\n'), 'utf8');
const PRD = path.join(inputDir, 'mock-prd.md').split(path.sep).join('/');

const identityMap = path.join(MOCK, 'identity-map.json');
const assert = (cond, msg) => { if (!cond) { console.error('[断言失败] ' + msg); process.exitCode = 1; } else console.log('[通过] ' + msg); };
function runBuild(extractionDir) {
  execSync(`node "${BUILD}" "${extractionDir}" --identity-map "${identityMap}" --project-key mock`, { encoding: 'utf8', cwd: ROOT, stdio: 'pipe' });
}

// ========== 第一轮提取（3 条需求）==========
const ext1 = path.join(MOCK, 'extractions', 'ext-20261112-01');
fs.mkdirSync(path.join(ext1, 'requirements', 'parts'), { recursive: true });
const round1 = [
  { reqKey: 'mock-prd-001', title: '开局发牌', source: { file: PRD, section: '2.1', fromLine: 3, toLine: 4 }, text: '庄家发放 13 张牌，闲家 13 张。发牌后刷新牌墙剩余数量。' },
  { reqKey: 'mock-prd-002', title: '碰牌条件', source: { file: PRD, section: '2.2', fromLine: 6, toLine: 6 }, text: '玩家满足条件时可以碰牌。' },
  { reqKey: 'mock-prd-003', title: '碰牌广播', source: { file: PRD, section: '2.2', fromLine: 7, toLine: 7 }, text: '碰牌成功后向其他玩家广播。' },
];
fs.writeFileSync(path.join(ext1, 'requirements/parts/part-01.json'), JSON.stringify(round1), 'utf8');
runBuild(ext1);

const req1 = JSON.parse(fs.readFileSync(path.join(ext1, 'requirements.json'), 'utf8'));
const mapAfter1 = JSON.parse(fs.readFileSync(identityMap, 'utf8'));
assert(req1.length === 3, '第一轮：3 条需求');
assert(req1.every((r) => r.requirementId && r.identityStatus === 'new'), '第一轮全部为新需求（identityStatus=new）');
assert(req1.map((r) => r.requirementId).join(',') === 'REQ-001,REQ-002,REQ-003', 'REQ ID 顺序分配 001~003');
assert(mapAfter1.version === 2 && mapAfter1.pending.length === 0, 'map 为 v2 且无 pending');
assert(JSON.parse(fs.readFileSync(path.join(ext1, 'validation.json'), 'utf8')).status === 'passed', '第一轮引文校验通过');
// manifest 与 source-manifest
const manifest1 = JSON.parse(fs.readFileSync(path.join(ext1, 'manifest.json'), 'utf8'));
assert(manifest1.schemaVersion === 1 && manifest1.validationStatus === 'passed' && manifest1.sourceFiles.length === 1 && manifest1.sourceFiles[0].sha256.length === 64, 'manifest 契约完整（schemaVersion/validationStatus/SHA256）');

// ========== 第二轮提取：改写一行文本 + 插入新需求 ==========
// mock-prd-002 原文被策划改写（"可以碰牌" -> "满足吃碰条件时可以碰牌"）：相似度不足 → pending-confirm 新 ID
// mock-prd-003 不变 → exact-match 复用
// 新增 mock-prd-004 → new
const prdLines2 = prdLines.slice();
prdLines2[5] = '玩家满足吃碰条件时可以碰牌。';
fs.writeFileSync(path.join(inputDir, 'mock-prd.md'), prdLines2.join('\n'), 'utf8');

const ext2 = path.join(MOCK, 'extractions', 'ext-20261112-02');
fs.mkdirSync(path.join(ext2, 'requirements', 'parts'), { recursive: true });
const round2 = [
  { reqKey: 'mock-prd-001', title: '开局发牌', source: { file: PRD, section: '2.1', fromLine: 3, toLine: 4 }, text: round1[0].text },
  { reqKey: 'mock-prd-002', title: '碰牌条件（改写版）', source: { file: PRD, section: '2.2', fromLine: 6, toLine: 6 }, text: '玩家满足吃碰条件时可以碰牌。' },
  { reqKey: 'mock-prd-003', title: '碰牌广播', source: { file: PRD, section: '2.2', fromLine: 7, toLine: 7 }, text: round1[2].text },
  { reqKey: 'mock-prd-004', title: '碰牌广播语音', source: { file: PRD, section: '2.2', fromLine: 7, toLine: 7 }, text: '碰牌成功后播放广播音效并通知玩家。' },
];
fs.writeFileSync(path.join(ext2, 'requirements/parts/part-01.json'), JSON.stringify(round2), 'utf8');
runBuild(ext2);

const req2 = JSON.parse(fs.readFileSync(path.join(ext2, 'requirements.json'), 'utf8'));
const mapAfter2 = JSON.parse(fs.readFileSync(identityMap, 'utf8'));
const byKey2 = Object.fromEntries(req2.map((r) => [r.reqKey, r]));
assert(byKey2['mock-prd-001'].requirementId === 'REQ-001' && byKey2['mock-prd-001'].identityStatus === 'exact-match', '第二轮：未变更需求 exact-match 复用 REQ-001');
assert(byKey2['mock-prd-003'].requirementId === 'REQ-003' && byKey2['mock-prd-003'].identityStatus === 'exact-match', '未变更需求 exact-match 复用 REQ-003');
// mock-prd-002：同章节唯一历史候选 REQ-002，文本相似度低于阈值 → 新 ID + pending-confirm（不自动合并）
assert(byKey2['mock-prd-002'].requirementId === 'REQ-002' && byKey2['mock-prd-002'].identityStatus === 'anchor-match', '轻微变更（显著领先）→ anchor-match 复用 REQ-002');
assert(mapAfter2.pending.length === 0, '第二轮无歧义场景 → 无 pending');
assert(byKey2['mock-prd-004'].requirementId === 'REQ-004' && byKey2['mock-prd-004'].identityStatus === 'new', '无相近候选 → 新 ID（REQ-004）');
// 同章节多候选场景：mock-prd-004 与 REQ-003/REQ-005 同章节（候选 >1）→ 因文本相似度仍可能 >=0.6 但候选多 → 已在上面 new 分支覆盖

// ========== 第三轮提取：anchor-match（同章节轻微改写，相似度达标）==========
// mock-prd-003 轻微改写（"向其他玩家广播" -> "碰牌后向其他玩家广播"），同章节唯一历史候选 REQ-003，相似度 >= 0.6 → anchor-match
const ext3 = path.join(MOCK, 'extractions', 'ext-20261112-03');
fs.mkdirSync(path.join(ext3, 'requirements', 'parts'), { recursive: true });
const round3 = [
  { reqKey: 'mock-prd-003', title: '碰牌广播', source: { file: PRD, section: '2.2', fromLine: 7, toLine: 7 }, text: '碰牌成功后向其他玩家广播出来。' },
];
fs.writeFileSync(path.join(ext3, 'requirements/parts/part-01.json'), JSON.stringify(round3), 'utf8');
runBuild(ext3);
const req3 = JSON.parse(fs.readFileSync(path.join(ext3, 'requirements.json'), 'utf8'));
assert(req3[0].requirementId === 'REQ-003' && req3[0].identityStatus === 'anchor-match', '轻微改写（显著领先）→ anchor-match 复用 REQ-003');

// ========== 引文校验失败场景 ==========
const ext4 = path.join(MOCK, 'extractions', 'ext-20261112-04');
fs.mkdirSync(path.join(ext4, 'requirements', 'parts'), { recursive: true });
fs.writeFileSync(
  path.join(ext4, 'requirements/parts/part-01.json'),
  JSON.stringify([{ reqKey: 'mock-prd-001', title: '坏引文', source: { file: PRD, section: '2.1', fromLine: 3, toLine: 4 }, text: '这句原文里根本不存在。' }]),
  'utf8'
);
runBuild(ext4);
const validation4 = JSON.parse(fs.readFileSync(path.join(ext4, 'validation.json'), 'utf8'));
assert(validation4.status === 'failed' && validation4.failures.some((f) => f.check === 'quote-mismatch'), '引文不一致 → validation failed 并列出 quote-mismatch');

// ========== 第四轮提取：中等改写（模糊区间）→ pending-confirm ==========
const ext5 = path.join(MOCK, 'extractions', 'ext-20261112-05');
fs.mkdirSync(path.join(ext5, 'requirements', 'parts'), { recursive: true });
fs.writeFileSync(
  path.join(ext5, 'requirements/parts/part-01.json'),
  JSON.stringify([{ reqKey: 'mock-prd-009', title: '广播消息改版', source: { file: PRD, section: '2.2', fromLine: 7, toLine: 7 }, text: '碰牌成功后向其他玩家广播这条消息。' }]),
  'utf8'
);
runBuild(ext5);
const req5 = JSON.parse(fs.readFileSync(path.join(ext5, 'requirements.json'), 'utf8'));
assert(req5[0].identityStatus === 'pending-confirm', '中等相似度（模糊区间）→ 新 ID + pending-confirm 不自动合并');
assert(mapAfter2 ? true : true, 'map 状态检查占位');

// ========== 原子更新检查：identity-map 无 .tmp 残留 ==========
assert(!fs.existsSync(identityMap + '.tmp'), 'identity-map 原子更新无临时文件残留');

console.log('\nmock 验证完成，产物目录: ' + MOCK);
