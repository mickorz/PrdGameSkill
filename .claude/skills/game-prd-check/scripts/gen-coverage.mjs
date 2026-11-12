// 生成 PRD 功能规则检查的「检查覆盖清单」（rule-checklist）
//
// 用途：给 game-prd-check 的报告补一个「检查了多少、哪些文件未发现问题」的覆盖视角，
// 供 full-check-suite 在 PRD 路完成后调用，并把结果写入 report.md 与 coverage.json。
//
// 用法：
//   node .claude/skills/game-prd-check/scripts/gen-coverage.mjs \
//     --report <report.md> --report-json <report.json> --rules-dir <规则目录> \
//     [--out <coverage.json>] [--date YYYY-MM-DD]
//
// 口径：
//   game-prd-check 的 issue 没有 ruleRef，无法反推命中条款；本脚本按
//   「issue.module + 主题关键词」把问题映射到规则文件，得到文件级覆盖。
//   有关联问题 = 该文件覆盖范围内发现问题；无关联问题 = 未发现问题，
//   不等同于逐条确认通过。UI 交互路有条款级 ruleRef，可另做条款级覆盖。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RULE_MAP = [
  { file: '01-开局.md', modules: ['开局', '总览与文档'], kw: /开局|首局|开场|云检测|放行/ },
  { file: '02-局数据-庄家与方位.md', modules: ['开局', '牌桌区域', '房间配置'], kw: /庄家|定庄|庄标|方位|座位|座次|东南西北|人数|玩家信息区/ },
  { file: '03-掷骰子.md', modules: ['开局'], kw: /骰子|点数|开牌位置|重扔|重掷/ },
  { file: '04-洗牌.md', modules: ['开局'], kw: /洗牌|洗牌道具|预约洗牌/ },
  { file: '05-牌墙.md', modules: ['开局', '牌桌区域'], kw: /牌墙|剩余牌|牌墩|余牌/ },
  { file: '06-发牌.md', modules: ['开局'], kw: /发牌|起手牌|手牌张数|首摸/ },
  { file: '07-财神-翻财神.md', modules: ['开局', '牌桌区域', '特殊规则'], kw: /财神|白板|翻财神|财神指示/ },
  { file: '08-摸牌.md', modules: ['开局', '行牌循环'], kw: /摸牌|摸进|摸到|首摸/ },
  { file: '09-出牌.md', modules: ['行牌循环', '牌桌区域'], kw: /出牌|打牌|出牌动画|出牌放大|单击|双击|滑动|理牌/ },
  { file: '10-吃.md', modules: ['行牌循环', '响应动作'], kw: /吃/ },
  { file: '11-碰.md', modules: ['行牌循环', '响应动作'], kw: /碰/ },
  { file: '12-杠.md', modules: ['行牌循环', '响应动作', '特殊规则'], kw: /杠|加杠|暗杠|补杠|明杠|杠链|抢杠/ },
  { file: '13-权限.md', modules: ['行牌循环', '响应动作', '开局'], kw: /权限|操作按钮|响应按钮|操作区|可操作|「过」|过按钮|多操作|托管|超时/ },
  { file: '14-出牌限制-禁打.md', modules: ['行牌循环', '响应动作', '特殊规则'], kw: /禁打|单放|出牌限制|不能打|不可打|禁出|禁手/ },
  { file: '15-听牌信息.md', modules: ['行牌循环', '响应动作', '牌桌区域'], kw: /听牌|查听|听牌箭头|剩余张数|记牌器/ },
  { file: '16-胡牌与流局结算.md', modules: ['结算与结束', '番型与倍数', '行牌循环', '响应动作'], kw: /胡牌|流局|番型|番数|自摸|点炮|抢杠|十风|缺一色|明牌|打片/ },
  { file: '17-游戏结束.md', modules: ['结算与结束'], kw: /游戏结束|8局|八局|结束本场|本场结束|大结算|结束整场/ },
  { file: '18-等待结束.md', modules: ['结算与结束'], kw: /等待结束|end_wait|等待确认|下一小局|下局|继续下一局/ },
  { file: '19-玩家分数.md', modules: ['结算与结束', '番型与倍数', '牌桌区域'], kw: /分数|输赢|赔付|计分|倍数|底分|分数刷新/ },
  { file: '20-通知信息.md', modules: ['牌桌区域', '总览与文档'], kw: /通知|提示|toast|广播|播报/ },
  { file: '21-游戏配置.md', modules: ['房间配置', '开局', '特殊规则'], kw: /配置|开关|可选规则|勾选|房间设置/ },
  { file: '22-做牌权限.md', modules: ['开局', '特殊规则'], kw: /做牌权限|做牌/ },
  { file: '23-做牌数据.md', modules: ['开局'], kw: /做牌数据|做牌/ },
  { file: '24-三摊更新.md', modules: ['特殊规则', '行牌循环', '结算与结束'], kw: /三摊|摊数|算摊|承包/ },
  { file: '25-飘.md', modules: ['特殊规则', '行牌循环', '结算与结束', '番型与倍数'], kw: /飘财|飘分|飘/ },
  { file: '26-加倍阶段.md', modules: ['开局', '特殊规则'], kw: /加倍/ },
  { file: '27-跟庄重扔骰子.md', modules: ['开局', '房间配置'], kw: /跟庄|重扔|重掷/ },
  { file: '28-升庄广播.md', modules: ['开局', '房间配置'], kw: /升庄/ },
  { file: '29-匹配场底分.md', modules: ['房间配置', '番型与倍数', '开局'], kw: /匹配场|底分/ },
  { file: '30-重连-开局阶段.md', modules: ['断线重连'], kw: /重连|断线/ },
  { file: '31-重连-场景开始旧协议.md', modules: ['断线重连'], kw: /旧协议|场景开始/ },
  { file: '32-重连-场景做牌.md', modules: ['断线重连'], kw: /做牌/ },
  { file: '33-重连-场景发牌旧协议.md', modules: ['断线重连'], kw: /旧协议|场景发牌/ },
  { file: '34-重连-场景动作.md', modules: ['断线重连'], kw: /场景动作|行牌阶段|动作阶段/ },
  { file: '35-重连-场景结算.md', modules: ['断线重连', '结算与结束'], kw: /结算阶段|场景结算/ },
  { file: '36-重连-场景加倍.md', modules: ['断线重连'], kw: /加倍阶段|场景加倍/ },
  { file: '37-重连-场景洗牌.md', modules: ['断线重连'], kw: /洗牌阶段|场景洗牌/ },
  { file: '38-小结算.md', modules: ['结算与结束'], kw: /小结算|结算界面|结算弹层|结算页/ },
  { file: '39-总战绩.md', modules: ['结算与结束'], kw: /总战绩|战绩/ },
  { file: '40-玩家头像的外部触发.md', modules: ['牌桌区域', '房间配置', '特殊规则'], kw: /头像|昵称|离线|托管图标|外部通知/ },
  { file: '总览.md', modules: ['总览与文档'], kw: /非功能|依赖|接口|验收场景|现状差异|待确认|风险与假设|术语|文档信息|老包|优先级分级/ },
];

const MODULE_FALLBACK = {
  开局: '01-开局.md',
  行牌循环: '09-出牌.md',
  响应动作: '13-权限.md',
  结算与结束: '16-胡牌与流局结算.md',
  番型与倍数: '16-胡牌与流局结算.md',
  断线重连: '30-重连-开局阶段.md',
  牌桌区域: '20-通知信息.md',
  特殊规则: '24-三摊更新.md',
  房间配置: '21-游戏配置.md',
  总览与文档: '总览.md',
};

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function collectRuleFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile() && ent.name.endsWith('.md')) out.push(full);
    }
  };
  walk(dir);
  return out.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
}

function issueText(it) {
  return [it.title, it.source_location, it.original_text, it.problem, it.suggestion]
    .filter(Boolean)
    .join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const reportPath = args.report && path.resolve(args.report);
  const reportJsonPath = args['report-json'] && path.resolve(args['report-json']);
  const rulesDir = args['rules-dir'] && path.resolve(args['rules-dir']);
  if (!reportPath || !reportJsonPath || !rulesDir) {
    console.error('用法：node gen-coverage.mjs --report <report.md> --report-json <report.json> --rules-dir <规则目录> [--out coverage.json] [--date YYYY-MM-DD]');
    process.exit(2);
  }
  if (!fs.existsSync(reportPath)) throw new Error('report.md 不存在：' + reportPath);
  if (!fs.existsSync(reportJsonPath)) throw new Error('report.json 不存在：' + reportJsonPath);
  if (!fs.existsSync(rulesDir)) throw new Error('规则目录不存在：' + rulesDir);

  const report = JSON.parse(fs.readFileSync(reportJsonPath, 'utf8'));
  const rulePaths = collectRuleFiles(rulesDir);
  if (rulePaths.length === 0) throw new Error('规则目录下没有 .md 文件：' + rulesDir);

  const ruleFiles = rulePaths.map((full) => {
    const name = path.basename(full);
    const text = fs.readFileSync(full, 'utf8');
    const titleMatch = text.match(/^#\s+(.+)$/m);
    return {
      file: name,
      title: titleMatch ? titleMatch[1].trim() : name.replace(/\.md$/, ''),
      sections: (text.match(/^##\s+/gm) || []).length,
    };
  });

  const byFile = new Map(ruleFiles.map((r) => [r.file, { ...r, issueIds: new Set() }]));
  const unmapped = [];
  const fallbackHits = [];

  for (const it of report.issues || []) {
    const modules = Array.isArray(it.module) ? it.module : [];
    const title = String(it.title || '');
    const text = issueText(it);

    // 先按标题命中具体主题（最多 2 个文件），标题不命中再退回全文关键词，
    // 避免正文里顺带提到的词把几乎所有规则文件都算成「发现问题」。
    const titleHits = [];
    for (const m of RULE_MAP) {
      if (!byFile.has(m.file)) continue;
      if (m.modules && !m.modules.some((x) => modules.includes(x))) continue;
      if (m.kw.test(title)) titleHits.push(m.file);
    }
    let hits = [...new Set(titleHits)].slice(0, 2);
    if (hits.length === 0) {
      const textHits = [];
      for (const m of RULE_MAP) {
        if (!byFile.has(m.file)) continue;
        if (m.modules && !m.modules.some((x) => modules.includes(x))) continue;
        if (m.kw.test(text)) textHits.push(m.file);
      }
      hits = [...new Set(textHits)].slice(0, 2);
    }

    if (hits.length > 0) {
      for (const f of hits) byFile.get(f).issueIds.add(it.id);
    } else {
      unmapped.push({ id: it.id, module: modules.join('/'), title: it.title });
      const fallbackFile = MODULE_FALLBACK[modules[0]];
      if (fallbackFile && byFile.has(fallbackFile)) {
        byFile.get(fallbackFile).issueIds.add(it.id);
        fallbackHits.push({ id: it.id, file: fallbackFile });
      }
    }
  }

  const items = ruleFiles.map((r) => {
    const entry = byFile.get(r.file);
    const issueIds = [...entry.issueIds].sort((a, b) => a.localeCompare(b));
    return {
      file: r.file,
      title: r.title,
      sections: r.sections,
      issueIds: issueIds,
      status: issueIds.length > 0 ? 'hit' : 'clean',
    };
  });

  const totalFiles = items.length;
  const totalSections = items.reduce((s, x) => s + x.sections, 0);
  const hitFiles = items.filter((x) => x.status === 'hit').length;
  const cleanFiles = totalFiles - hitFiles;
  const cleanRate = totalFiles ? (cleanFiles / totalFiles) * 100 : 0;

  const coverage = {
    generated_at: args.date || '',
    mapping: 'issue.module + 主题关键词，文件级近似；无关联问题 = 未发现问题，不等同逐条确认通过',
    totalFiles,
    totalSections,
    hitFiles,
    cleanFiles,
    cleanRate: Number(cleanRate.toFixed(1)),
    passRateText: cleanFiles + '/' + totalFiles + ' 文件未发现问题',
    unmatchedCount: unmapped.length,
    fallbackCount: fallbackHits.length,
    unmappedIssues: unmapped,
    items,
  };

  const outPath = args.out ? path.resolve(args.out) : path.join(path.dirname(reportPath), 'coverage.json');
  fs.writeFileSync(outPath, JSON.stringify(coverage, null, 2), 'utf8');

  const sectionLines = [];
  sectionLines.push('');
  sectionLines.push('## 5. 检查覆盖清单');
  sectionLines.push('');
  sectionLines.push(
    '口径：规则基准共 ' +
      totalFiles +
      ' 个文件、' +
      totalSections +
      ' 个章节；按问题 module 与主题关键词映射到规则文件，文件无关联问题即视为「未发现问题」，不等同于逐条确认通过。'
  );
  sectionLines.push('');
  sectionLines.push('| 指标 | 数值 |');
  sectionLines.push('|---|---|');
  sectionLines.push('| 规则文件 | ' + totalFiles + ' |');
  sectionLines.push('| 章节数 | ' + totalSections + ' |');
  sectionLines.push('| 关联问题的文件 | ' + hitFiles + ' |');
  sectionLines.push('| 未发现问题的文件 | ' + cleanFiles + ' |');
  sectionLines.push('| 文件级未发现问题率 | ' + cleanRate.toFixed(1) + '% |');
  sectionLines.push('');
  sectionLines.push('| 规则文件 | 章节数 | 关联问题 | 状态 |');
  sectionLines.push('|---|---|---|---|');
  for (const x of items) {
    sectionLines.push(
      '| ' + x.file + ' | ' + x.sections + ' | ' + (x.issueIds.length ? x.issueIds.join('、') : '-') + ' | ' +
        (x.status === 'hit' ? '发现问题' : '未发现问题') + ' |'
    );
  }
  sectionLines.push('');

  let md = fs.readFileSync(reportPath, 'utf8');
  const marker = '\n## 5. 检查覆盖清单';
  const idx = md.indexOf(marker);
  if (idx >= 0) md = md.slice(0, idx).replace(/\s+$/, '') + '\n';
  md = md.replace(/\s+$/, '') + '\n' + sectionLines.join('\n');
  fs.writeFileSync(reportPath, md, 'utf8');

  console.log('[成功] 覆盖清单已生成');
  console.log('  规则文件 ' + totalFiles + '，章节 ' + totalSections + '，关联问题文件 ' + hitFiles + '，未发现问题文件 ' + cleanFiles);
  console.log('  未匹配问题 ' + unmapped.length + ' 条，走模块兜底 ' + fallbackHits.length + ' 条');
  console.log('  coverage.json -> ' + outPath);
  console.log('  report.md     -> ' + reportPath);
}

main();
