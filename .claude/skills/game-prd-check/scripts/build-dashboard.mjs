#!/usr/bin/env node
// build-dashboard.mjs
// 作用：解析 game-prd-check 生成的 report.md -> report.json（含校验）-> 注入模板生成离线单文件 dashboard HTML
// 用法：node build-dashboard.mjs [report.md路径] [输出目录]
//       默认：<skill根>/../../../../examples/game-prd-check/report.md 与同名输出目录
// 格式：自适应两种报告格式——
//   skill 版：清单第二列为类型英文枚举（MISSING 等），详情块 `- 类型：`，45 条全有详情
//   workflow 版：清单第二列为中文主题，详情块 `- 主题：` + `- 问题性质：`（中文类型），
//               详情块可能少于清单条目（清单为全集，详情按 ID 合并，缺详情条目 type=未分类）
// 说明：设计文档原建议 python 实现，因本仓库运行环境无 python3，统一使用 node（零依赖）。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(SCRIPT_DIR, '..');

// 类型中文映射（与 report.template.md 的五种类型一一对应；值域同时是 workflow 版「问题性质」的取值）
const TYPE_ZH = {
  MISSING: '需求缺失',
  CONFLICT: '内容冲突',
  LOGIC: '逻辑错误',
  AMBIGUOUS: '定义歧义',
  INCOMPLETE: '描述不完整',
};
const TYPE_UNCLASSIFIED = '未分类';
const TYPE_EN_RE = /^(MISSING|CONFLICT|LOGIC|AMBIGUOUS|INCOMPLETE)$/;

// ---------- 工具函数 ----------

// 展开文本中出现的 PRD ID 引用：
// 支持 PRD-001、PRD-001/002/003、PRD-001~004 三种写法
function extractIds(text) {
  const ids = new Set();
  for (const m of text.matchAll(/PRD-(\d{3})~(\d{3})/g)) {
    const lo = parseInt(m[1], 10);
    const hi = parseInt(m[2], 10);
    if (lo <= hi && hi - lo < 100) {
      for (let i = lo; i <= hi; i++) ids.add(`PRD-${String(i).padStart(3, '0')}`);
    }
  }
  for (const m of text.matchAll(/PRD-(\d{3})(?:\/(\d{3}))*/g)) {
    ids.add(`PRD-${m[1]}`);
    for (const seg of m[0].split('/').slice(1)) {
      ids.add(`PRD-${seg}`);
    }
  }
  return [...ids];
}

function splitSentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[。；])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function stripBold(s) {
  return String(s || '').replace(/\*\*/g, '');
}

// 类型值归一化：英文枚举映射中文，中文原样，未知给未分类
function normalizeType(v) {
  if (!v) return '';
  const t = v.trim();
  return TYPE_ZH[t] || (Object.values(TYPE_ZH).includes(t) ? t : '');
}

// ---------- report.md 解析 ----------

export function parseReport(md) {
  const lines = md.split(/\r?\n/);
  const out = {
    schema_version: 1,
    report: {
      title: 'PRD 质量分析报告',
      project_name: '',
      document_name: '',
      inspection_date: '',
      source_file: '',
      rule_baselines: [],
      overall_conclusion: { status: 'NA', summary: '', reasons: [] },
    },
    statistics: { total: 0, priority: { P0: 0, P1: 0, P2: 0, P3: 0 }, types: {} },
    risk_groups: [],
    modules: [],
    featured_issues: [],
    issues: [],
    overall_recommendations: [],
  };

  // --- 头部元信息 ---
  out.report.source_file = (md.match(/检查对象：(.+)/) || [])[1]?.trim() || '';
  out.report.inspection_date = (md.match(/检查日期：(.+)/) || [])[1]?.trim() || '';
  // 检查范围（workflow 版专有，可无）
  const checkScope = (md.match(/检查范围：(.+)/) || [])[1]?.trim() || '';
  // 项目名/文档名从 source_file 推导：【游戏名】xxx.md -> 项目=游戏名，文档=去扩展名（兼容反斜杠路径）
  const base = path.basename(out.report.source_file.replace(/\\/g, '/') || '');
  const proj = base.match(/^【(.+?)】/);
  if (proj) {
    out.report.project_name = proj[1];
    out.report.document_name = base.replace(/^【.+?】/, '').replace(/\.md$/i, '');
  } else {
    out.report.document_name = base.replace(/\.md$/i, '');
  }
  // 规则基准：优先「规则基准：」之后的 "- " 列表（skill 版）；
  // 列表为空则取「规则基准：」行内冒号后的内联值（workflow 版单行）
  {
    const idx = lines.findIndex((l) => l.trim().startsWith('规则基准'));
    if (idx >= 0) {
      for (let i = idx + 1; i < lines.length && lines[i].startsWith('- '); i++) {
        out.report.rule_baselines.push(lines[i].replace(/^-\s*/, '').trim());
      }
      if (!out.report.rule_baselines.length) {
        const inline = (lines[idx].match(/规则基准[：:]\s*(.+)/) || [])[1]?.trim();
        if (inline) out.report.rule_baselines.push(inline);
      }
    }
  }
  if (checkScope) out.report.rule_baselines.push(`检查范围：${checkScope}`);

  // --- 概览表（用于交叉校验） ---
  const overview = {};
  for (const m of md.matchAll(/\|\s*(发现问题总数|严重问题 P0|高优先级 P1|一般问题 P2|优化建议 P3)\s*\|\s*(\d+)\s*\|/g)) {
    overview[m[1]] = parseInt(m[2], 10);
  }
  // 类型分布行（skill 版专有，用于交叉校验）：类型分布：MISSING 18、CONFLICT 8、...
  const typeDistLine = md.match(/类型分布：(.+)。/)?.[1] || '';
  const typeDist = {};
  for (const m of typeDistLine.matchAll(/(MISSING|CONFLICT|LOGIC|AMBIGUOUS|INCOMPLETE)\s*(\d+)/g)) {
    typeDist[m[1]] = parseInt(m[2], 10);
  }

  // --- 问题清单表（全集索引）---
  // 第二列自适应：英文类型枚举（skill 版）或中文主题（workflow 版）
  const listRows = {};
  for (const m of md.matchAll(/^\|\s*(PRD-\d{3})\s*\|\s*(\S+)\s*\|\s*(P[0-3])\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$/gm)) {
    const second = m[2].trim();
    listRows[m[1]] = {
      id: m[1],
      second,
      isTypeCol: TYPE_EN_RE.test(second),
      priority: m[3],
      title: m[4].trim(),
      source_location: m[5].trim(),
      suggestion: m[6].trim(),
    };
  }

  // --- 详情块：### PRD-001：标题 ...（可能少于清单条目） ---
  const detailRe = /^### (PRD-\d{3})：(.+)$/gm;
  const details = [];
  {
    let m;
    while ((m = detailRe.exec(md)) !== null) details.push({ id: m[1], title: m[2].trim(), start: m.index + m[0].length });
  }

  // --- 组装 issues：清单为全集，详情按 ID 合并 ---
  const allIds = [...Object.keys(listRows)];
  for (const d of details) if (!allIds.includes(d.id)) allIds.push(d.id); // 详情有清单无的兜底
  allIds.sort();

  for (const id of allIds) {
    const row = listRows[id];
    const d = details.find((x) => x.id === id);
    let issue = {
      id,
      title: row?.title || d?.title || '',
      priority: row?.priority || '',
      type: row?.isTypeCol ? TYPE_ZH[row.second] : '',
      module: row && !row.isTypeCol ? [row.second] : [],
      source_location: row?.source_location || '',
      original_text: '',
      problem: '',
      impact: '',
      suggestion: row?.suggestion || '',
      status: '待确认',
      has_detail: false,
    };
    if (d) {
      const end = details[details.indexOf(d) + 1]?.start ?? md.indexOf('\n## 4. 总体建议', d.start);
      const body = md.slice(d.start, end > 0 ? end : undefined);

      const field = (name) => {
        const fm = body.match(new RegExp(`\\*\\*${name}\\*\\*[：:]\\s*([\\s\\S]*?)(?=\\n\\*\\*|\\n- \\*\\*|\\n---|$)`));
        return fm ? fm[1].trim() : '';
      };
      // 建议字段特殊处理：「建议」之后可能跟随「范例」等附加小节（如 workflow 版 PRD-005 的可照抄范例表），
      // 需一路取到「处理状态」前，不能在下一个 **小节** 处截断，否则范例内容丢失
      const fieldSuggestion = () => {
        const fm = body.match(/\*\*建议\*\*[：:]\s*([\s\S]*?)(?=\n\*\*处理状态\*\*|$)/);
        return fm ? fm[1].trim() : '';
      };
      // 优先级 / 类型：skill 版 `- 类型：MISSING`；workflow 版 `- 问题性质：需求缺失`
      const priority = (body.match(/-\s*优先级：\s*(P[0-3])/) || [])[1] || issue.priority;
      const typeRaw = (body.match(/-\s*(?:类型|问题性质)：\s*(\S+)/) || [])[1] || '';
      // 主题（workflow 版详情块）：挂 module
      const themeRaw = (body.match(/-\s*主题：\s*(.+)$/m) || [])[1]?.trim() || '';
      // 原文位置：workflow 版 `**原文**（位置）：` 括号内；嵌套括号用行级贪婪匹配
      const quoteLoc = (body.match(/^\*\*原文\*\*（(.+)）：\s*$/m) || [])[1]?.trim() || '';
      // 原文引用：**原文**...： 之后的 > 引用行合并
      const quoteBlock = body.match(/\*\*原文\*\*(?:（.+?）)?[：:]\s*\n([\s\S]*?)(?=\n\*\*问题\*\*)/);
      const originalText = quoteBlock
        ? quoteBlock[1].split(/\r?\n/).filter((l) => l.trim().startsWith('>')).map((l) => l.replace(/^>\s?/, '').trim()).join('\n')
        : field('原文');

      issue = {
        ...issue,
        title: d.title || issue.title,
        priority: priority || issue.priority,
        type: normalizeType(typeRaw) || issue.type,
        module: themeRaw && !issue.module.includes(themeRaw) ? [...issue.module, themeRaw] : issue.module,
        source_location: quoteLoc || issue.source_location,
        original_text: originalText,
        problem: field('问题'),
        impact: field('影响'),
        suggestion: fieldSuggestion() || field('建议') || issue.suggestion,
        status: (body.match(/\*\*处理状态\*\*[：:]\s*(.+)/) || [])[1]?.trim() || '待确认',
        has_detail: true,
      };
    }
    out.issues.push(issue);
  }

  // --- 总体建议章节 ---
  const recSection = md.slice(md.indexOf('## 4. 总体建议'));
  const recLines = [];
  let curRec = null;
  {
    // 顶层要点行；冒号结尾的要点把缩进子列表行拼入（保留原文，不做推断，避免内容丢失）
    for (const line of recSection.split(/\r?\n/)) {
      if (/^-\s+\*\*.+\*\*/.test(line)) {
        if (curRec) recLines.push(curRec);
        curRec = line.replace(/^\s*-\s+/, '').trim();
      } else if (/^\s+-\s+/.test(line) && curRec !== null) {
        curRec += (/[：:]$/.test(curRec) ? '' : '；') + line.replace(/^\s*-\s+/, '').trim();
      }
    }
    if (curRec) recLines.push(curRec);
  }
  out.overall_recommendations = recLines;

  // --- 模块归属 ---
  // workflow 版：清单主题列已挂到 issue.module，这里聚合为 modules；
  // skill 版：总体建议中 "模块名（PRD-xxx/yyy）：N 条" 形式补充（以「：N 条」为特征）
  const moduleSet = new Map();
  for (const it of out.issues) {
    for (const mname of it.module) {
      if (!moduleSet.has(mname)) moduleSet.set(mname, []);
      moduleSet.get(mname).push(it.id);
    }
  }
  // skill 版：总体建议中 "模块名（PRD-xxx/yyy）：N 条" 形式补充（以「：N 条」为特征）
  for (const m of recSection.matchAll(/([^（()：:\s]{2,12})（(PRD-[\d~/]+)）[：:]\s*\d+\s*条/g)) {
    const name = m[1].trim();
    const ids = extractIds(m[2]);
    if (!name || !ids.length) continue;
    if (!moduleSet.has(name)) moduleSet.set(name, ids);
    else {
      const cur = moduleSet.get(name);
      for (const id of ids) if (!cur.includes(id)) cur.push(id);
    }
    for (const id of ids) {
      const issue = out.issues.find((x) => x.id === id);
      if (issue && !issue.module.includes(name)) issue.module.push(name);
    }
  }
  out.modules = [...moduleSet.entries()].map(([name, issue_ids]) => ({ name, issue_ids }));

  // 结论状态：总体建议中 "是否建议进入下一阶段规格生成"
  const conclLine = recLines.find((l) => l.includes('是否建议进入下一阶段'));
  if (conclLine) {
    const verdict = conclLine.includes('暂缓') ? 'BLOCKED' : conclLine.includes('建议') && conclLine.match(/[:：].*(建议|可以|可)/) ? 'ALLOWED' : 'NA';
    out.report.overall_conclusion.status = verdict;
    const text = stripBold(conclLine.replace(/^\*\*[^*]+\*\*[：:]\s*/, ''));
    const sentences = splitSentences(text);
    out.report.overall_conclusion.summary = sentences[0] || text;
    out.report.overall_conclusion.reasons = sentences.slice(1, 5);
  }

  // --- 风险组（启发式提取，报告作者的分析结论，不是机械统计） ---
  // A. 开发阻塞 = 全部 P0；B. 资损 = "可能影响开发"要点中含资损类关键词子句引用的 ID
  const p0Ids = out.issues.filter((it) => it.priority === 'P0').map((it) => it.id);
  if (p0Ids.length) {
    out.risk_groups.push({ key: 'blocker', name: '开发阻塞风险', description: '关键流程/规则缺失或矛盾，直接阻塞开发或验收', issue_ids: p0Ids });
  }
  const devLine = recLines.find((l) => l.includes('可能影响开发'));
  if (devLine) {
    const lossIds = new Set();
    for (const clause of splitSentences(devLine)) {
      // 资损类关键词：skill 版用「资损」，workflow 版用「金额算错」
      if (/资损|金额|赔付|计分/.test(clause)) for (const id of extractIds(clause)) lossIds.add(id);
    }
    if (lossIds.size) {
      out.risk_groups.push({ key: 'financial', name: '资损风险', description: '影响赔付/计分正确性，可能导致结算金额错误', issue_ids: [...lossIds] });
    }
  }

  // TOP 5（featured）：P0 全部（ID 升序）+ 资损组剩余按优先级/ID 补足（P0 超过 5 条时取前 5）
  {
    const fin = out.risk_groups.find((g) => g.key === 'financial')?.issue_ids || [];
    const rest = out.issues
      .filter((it) => fin.includes(it.id) && it.priority !== 'P0')
      .sort((a, b) => a.priority.localeCompare(b.priority) || a.id.localeCompare(b.id));
    out.featured_issues = [...out.issues.filter((it) => it.priority === 'P0').sort((a, b) => a.id.localeCompare(b.id)), ...rest]
      .slice(0, 5)
      .map((it) => it.id);
  }

  // --- 统计（一律由 issues 计算） ---
  out.statistics.total = out.issues.length;
  for (const it of out.issues) {
    out.statistics.priority[it.priority] = (out.statistics.priority[it.priority] || 0) + 1;
    const t = it.type || TYPE_UNCLASSIFIED;
    it.type = t;
    out.statistics.types[t] = (out.statistics.types[t] || 0) + 1;
  }

  // --- 交叉校验数据（不进入 JSON，仅校验用） ---
  out._checks = { overview, typeDist };
  return out;
}

// ---------- 校验（设计 6.4，含双格式放宽） ----------

export function validateReport(data) {
  const errors = [];
  const ids = data.issues.map((it) => it.id);
  // 1. ID 唯一
  if (new Set(ids).size !== ids.length) errors.push('存在重复的问题 ID');
  // 2. 总数一致（与报告概览表交叉校验）
  if (data._checks.overview['发现问题总数'] !== undefined && data._checks.overview['发现问题总数'] !== data.statistics.total) {
    errors.push(`问题总数与概览表不一致：概览 ${data._checks.overview['发现问题总数']} vs 明细 ${data.statistics.total}`);
  }
  // 3. 优先级总和
  const pSum = Object.values(data.statistics.priority).reduce((a, b) => a + b, 0);
  if (pSum !== data.statistics.total) errors.push(`优先级统计总和 ${pSum} != 总数 ${data.statistics.total}`);
  // 4. 类型总和（含未分类）
  const tSum = Object.values(data.statistics.types).reduce((a, b) => a + b, 0);
  if (tSum !== data.statistics.total) errors.push(`类型统计总和 ${tSum} != 总数 ${data.statistics.total}`);
  // skill 版类型分布行交叉校验（workflow 版无此行，跳过）
  for (const [en, n] of Object.entries(data._checks.typeDist)) {
    const zh = TYPE_ZH[en];
    if (zh && data.statistics.types[zh] !== undefined && data.statistics.types[zh] !== n) {
      errors.push(`类型 ${zh} 数量与报告类型分布行不一致：${data.statistics.types[zh]} vs ${n}`);
    }
  }
  // 5. 风险组引用存在
  for (const g of data.risk_groups) {
    for (const id of g.issue_ids) if (!ids.includes(id)) errors.push(`风险组 ${g.name} 引用了不存在的问题 ${id}`);
  }
  // 6. TOP5 引用存在
  for (const id of data.featured_issues) if (!ids.includes(id)) errors.push(`TOP5 引用了不存在的问题 ${id}`);
  // 7. 字段完整性：
  //    所有条目：标题、优先级、类型、建议必须有（清单三列 + 类型兜底）
  //    有详情块条目（has_detail）：原文/问题/影响必须完整保留
  for (const it of data.issues) {
    for (const f of ['title', 'priority', 'type', 'suggestion']) {
      if (!it[f] || !String(it[f]).trim()) errors.push(`${it.id} 字段 ${f} 为空，原始信息丢失`);
    }
    if (it.has_detail) {
      for (const f of ['original_text', 'problem', 'impact']) {
        if (!it[f] || !it[f].trim()) errors.push(`${it.id} 详情字段 ${f} 为空，原始信息丢失`);
      }
    }
  }
  return errors;
}

// ---------- 主流程 ----------

export function buildDashboardHtml(data, templateHtml) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  if (!templateHtml.includes('__REPORT_JSON__')) throw new Error('模板缺少 __REPORT_JSON__ 注入点');
  return templateHtml.replace('__REPORT_JSON__', json);
}

// 生成带日期序号的 Dashboard 文件名：{项目名}分析-Dashboard-{YYYYMMDD}-{NN}.html
// 同日前缀已存在时序号递增，避免多次生成互相覆盖；跨日重新从 01 起
export function nextDashboardName(dir, projectName, now = new Date()) {
  const safe = String(projectName || 'PRD').replace(/[\\/:*?"<>|]/g, '').trim() || 'PRD';
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const prefix = `${safe}分析-Dashboard-${ymd}-`;
  const prefixRe = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d{2})\\.html$');
  let seq = 1;
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      const m = f.match(prefixRe);
      if (m) seq = Math.max(seq, parseInt(m[1], 10) + 1);
    }
  }
  return `${prefix}${pad(seq)}.html`;
}

function main() {
  const [reportArg, outDirArg] = process.argv.slice(2);
  const reportPath = path.resolve(reportArg || path.join(SKILL_ROOT, '..', '..', '..', 'examples', 'game-prd-check', 'report.md'));
  const outDir = path.resolve(outDirArg || path.dirname(reportPath));

  const md = fs.readFileSync(reportPath, 'utf8');
  const data = parseReport(md);
  const errors = validateReport(data);
  if (errors.length) {
    console.error('[失败] report.md 校验未通过：');
    for (const e of errors) console.error('  - ' + e);
    process.exit(1);
  }
  delete data._checks; // 校验用临时数据不进入产物

  const template = fs.readFileSync(path.join(SKILL_ROOT, 'dashboard', 'template.html'), 'utf8');
  const html = buildDashboardHtml(data, template);

  fs.mkdirSync(path.join(outDir, 'dashboard'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(data, null, 2), 'utf8');
  const htmlName = nextDashboardName(path.join(outDir, 'dashboard'), data.report.project_name || data.report.document_name);
  fs.writeFileSync(path.join(outDir, 'dashboard', htmlName), html, 'utf8');

  const p = data.statistics.priority;
  const detailCount = data.issues.filter((it) => it.has_detail).length;
  console.log(`[成功] 共 ${data.statistics.total} 条问题（P0×${p.P0} P1×${p.P1} P2×${p.P2} P3×${p.P3}），其中 ${detailCount} 条含详情块`);
  console.log(`  report.json -> ${path.join(outDir, 'report.json')}`);
  console.log(`  dashboard   -> ${path.join(outDir, 'dashboard', htmlName)}`);
}

// 直接执行时跑主流程（作为模块被 example 引入时不执行）
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
