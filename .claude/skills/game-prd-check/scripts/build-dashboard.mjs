#!/usr/bin/env node
// build-dashboard.mjs
// 作用：解析 game-prd-check 生成的 report.md -> report.json（含校验）-> 注入模板生成离线单文件 dashboard HTML
// 用法：node build-dashboard.mjs [report.md路径] [输出目录]
//       默认：<skill根>/../../../../examples/game-prd-check/report.md 与同名输出目录
// 格式：自适应三种报告格式——
//   skill 版：清单第二列为类型英文枚举（MISSING 等），详情块 `- 类型：`，45 条全有详情
//   workflow 版：清单第二列为中文主题，详情块 `- 主题：` + `- 问题性质：`（中文类型），
//               详情块可能少于清单条目（清单为全集，详情按 ID 合并，缺详情条目 type=未分类）
//   UI 交互基准版（ui-interaction-prd-extract）：ID 为 Q01 形式，清单 7 列（ID|优先级|类型|模块|问题|原文位置|基准依据），
//               详情块 `### Q01【P0 / MISSING】标题`，字段为 `- **字段名**：` 形式；
//               概览统计为优先级×类型矩阵表，交叉校验按矩阵合计
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

// 展开文本中出现的问题 ID 引用：
// 支持 PRD-001、PRD-001/002/003、PRD-001~004 三种写法；Q 版报告同格式（Q01、Q01/02、Q01~04）
function makeIdExtractRe(prefix) {
  return (text) => {
    const ids = new Set();
    for (const m of text.matchAll(new RegExp(`${prefix}-(\\d{2,3})~(\\d{2,3})`, 'g'))) {
      const lo = parseInt(m[1], 10);
      const hi = parseInt(m[2], 10);
      const width = m[1].length;
      if (lo <= hi && hi - lo < 100) {
        for (let i = lo; i <= hi; i++) ids.add(`${prefix}-${String(i).padStart(width, '0')}`);
      }
    }
    for (const m of text.matchAll(new RegExp(`${prefix}-(\\d{2,3})(?:/(\\d{2,3}))*`, 'g'))) {
      ids.add(`${prefix}-${m[1]}`);
      for (const seg of m[0].split('/').slice(1)) {
        ids.add(`${prefix}-${seg}`);
      }
    }
    return [...ids];
  };
}
const extractIds = makeIdExtractRe('PRD'); // 兼容 skill/workflow 版（PRD-001）
const extractQIds = makeIdExtractRe('Q'); // UI 交互基准版（Q01）

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
    statistics: { total: 0, priority: { P0: 0, P1: 0, P2: 0, P3: 0 }, types: {}, dimensions: {} },
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

  // 类型分布（交叉校验用）：skill 版由「类型分布：」行解析；Q 版由概览矩阵表合计行填充
  let typeDist = {};
  // --- 概览表（用于交叉校验） ---
  const overview = {};
  for (const m of md.matchAll(/\|\s*(发现问题总数|严重问题 P0|高优先级 P1|一般问题 P2|优化建议 P3)\s*\|\s*(\d+)\s*\|/g)) {
    overview[m[1]] = parseInt(m[2], 10);
  }
  // Q 版概览：优先级×类型矩阵表，末行「合计」提供类型总数，末列「小计」提供优先级总数
  const matrixRowRe = /^\|\s*(P[0-3])（[^）]*）\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*\*\*(\d+)\*\*\s*\|\s*$/gm;
  const matrixTotalRe = /^\|\s*\*\*合计\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*$/gm;
  const matrixPrioNames = { P0: '严重问题 P0', P1: '高优先级 P1', P2: '一般问题 P2', P3: '优化建议 P3' };
  const matrixTypeNames = ['MISSING', 'CONFLICT', 'LOGIC', 'AMBIGUOUS', 'INCOMPLETE'];
  let matrixTotal = null;
  for (const m of md.matchAll(matrixTotalRe)) {
    matrixTotal = { types: matrixTypeNames.map((_, i) => parseInt(m[i + 1], 10)), total: parseInt(m[6], 10) };
  }
  if (matrixTotal) {
    overview['发现问题总数'] = matrixTotal.total;
    for (const m of md.matchAll(matrixRowRe)) {
      const p = m[1];
      overview[matrixPrioNames[p]] = parseInt(m[7], 10);
    }
    for (let i = 0; i < matrixTypeNames.length; i++) {
      if (matrixTotal.types[i]) typeDist[matrixTypeNames[i]] = matrixTotal.types[i];
    }
  }
  // 类型分布行（skill 版专有，用于交叉校验）：类型分布：MISSING 18、CONFLICT 8、...
  // Q 版已在上方矩阵分支填充 typeDist，这里仅补充 skill 版解析
  const typeDistLine = md.match(/类型分布：(.+)。/)?.[1] || '';
  for (const m of typeDistLine.matchAll(/(MISSING|CONFLICT|LOGIC|AMBIGUOUS|INCOMPLETE)\s*(\d+)/g)) {
    typeDist[m[1]] = parseInt(m[2], 10);
  }

  // --- 问题清单表（全集索引）---
  // 自适应两种列布局：
  //   PRD 版：| PRD-001 | 类型或主题 | P0 | 问题 | 位置 | 建议 |（6 列，第二列自适应类型/主题）
  //   Q 版（UI 交互基准）：| Q01 | P0 | MISSING | 模块 | 问题 | 位置 | 基准依据 |（7 列）
  const listRows = {};
  const PRD_ROW_RE = /^\|\s*(PRD-\d{3})\s*\|\s*(\S+)\s*\|\s*(P[0-3])\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$/gm;
  // Q 版 8 列：ID | 问题维度 | 优先级 | 类型 | 模块 | 问题 | 原文位置 | 基准依据；问题维度列可选（兼容旧 7 列格式）
  const Q_ROW_RE = /^\|\s*(Q\d{2,3})\s*\|\s*(?:(UI 交互|功能规则)\s*\|\s*)?(P[0-3])\s*\|\s*(\S+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$/gm;
  for (const m of md.matchAll(PRD_ROW_RE)) {
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
  for (const m of md.matchAll(Q_ROW_RE)) {
    listRows[m[1]] = {
      id: m[1],
      dimension: m[2] || undefined,
      second: m[4].trim(),
      isTypeCol: TYPE_EN_RE.test(m[4].trim()),
      priority: m[3],
      title: m[6].trim(),
      source_location: m[7].trim(),
      // 第 8 列是基准依据（非 PRD 格式的建议列），挂独立字段，不进 suggestion
      rule_ref: m[8].trim(),
      moduleCol: m[5].trim(),
    };
  }

  // --- 详情块：### PRD-001：标题 或 ### Q01【P0 / MISSING】标题（可能少于清单条目） ---
  const detailRe = /^### (PRD-\d{3}|Q\d{2,3})(?:：(.*))?|【?(?=[\s\S])$/gm;
  const details = [];
  {
    // PRD 版：### PRD-001：标题；Q 版：### Q01【P0 / MISSING】标题
    const re = /^### (PRD-\d{3}|Q\d{2,3})[：:\s]*(.*)$/gm;
    let m;
    while ((m = re.exec(md)) !== null) {
      details.push({
        id: m[1],
        title: m[2].replace(/^【[^】]*】\s*/, '').trim(),
        headRaw: m[2].trim(),
        start: m.index + m[0].length,
        headStart: m.index,
      });
    }
  }

  // --- 组装 issues：清单为全集，详情按 ID 合并 ---
  const allIds = [...Object.keys(listRows)];
  for (const d of details) if (!allIds.includes(d.id)) allIds.push(d.id); // 详情有清单无的兜底
  allIds.sort();

  const reportDim = out.report.rule_baselines.some((b) => /ui_interaction/i.test(b)) ? 'UI 交互' : '功能规则';
  for (const id of allIds) {
    const row = listRows[id];
    const d = details.find((x) => x.id === id);
    // module 初始值：PRD workflow 版第二列挂 module；Q 版第 4 列 moduleCol 单独挂
    const initModules = row && !row.isTypeCol && row.second && !row.moduleCol ? [row.second] : [];
    if (row?.moduleCol && !initModules.includes(row.moduleCol)) initModules.push(row.moduleCol);
    let issue = {
      id,
      title: row?.title || d?.title || '',
      priority: row?.priority || '',
      type: row?.isTypeCol ? TYPE_ZH[row.second] : '',
      module: initModules,
      dimension: row?.dimension || reportDim,
      source_location: row?.source_location || '',
      rule_ref: row?.rule_ref || '',
      original_text: '',
      problem: '',
      impact: '',
      suggestion: row?.suggestion || '',
      status: '待确认',
      has_detail: false,
    };
    if (d) {
      // body 边界取下一个详情标题的行首，避免把下一条的标题行包进本条块内容
      const end = details[details.indexOf(d) + 1]?.headStart ?? md.indexOf('\n## 4. 总体建议', d.start);
      const body = md.slice(d.start, end > 0 ? end : undefined);

      // --- 通用 **字段** 块切分 ---
      // 标题行形如：**原文**（位置括注）：、**范例（需求必须按此格式写）**：、**处理状态**：待确认（同行内容）
      // 未来源报告新增任何 **字段** 块都会被捕获，未知字段按出现顺序并入 suggestion，不再截断丢失
      // 头部匹配分三种形式（顺序敏感）：B **名称（括注）**： / A **名称**（贪婪括注，支持嵌套括号）： / 基础 **名称**：
      // Q 版（UI 交互基准）字段为 `- **字段名**：内容` 列表形式，允许行首 `- ` 前缀
      const matchFieldHeader = (line) => {
        const l = line.replace(/^\s*-\s+/, '');
        let m = l.match(/^\*\*([^*\n（]+(?:（[^）]*）)?)\*\*[：:](.*)$/);
        if (m) return { name: m[1].trim(), paren: '', first: m[2].trim() };
        m = l.match(/^\*\*([^*\n]+)\*\*（(.+)）[：:](.*)$/);
        if (m) return { name: m[1].trim(), paren: m[2].trim(), first: m[3].trim() };
        m = l.match(/^\*\*([^*\n]+)\*\*[：:](.*)$/);
        if (m) return { name: m[1].trim(), paren: '', first: m[2].trim() };
        return null;
      };
      const KNOWN_BLOCKS = new Set(['原文', '问题', '影响', '建议', '处理状态', '问题性质', '基准依据', '验收口径']);
      const blocks = [];
      let curBlock = null;
      for (const line of body.split(/\r?\n/)) {
        const fh = matchFieldHeader(line);
        if (fh) {
          curBlock = { name: fh.name, paren: fh.paren, first: fh.first, lines: [] };
          blocks.push(curBlock);
        } else if (curBlock) {
          curBlock.lines.push(line);
        }
      }
      const blockText = (name) => {
        const b = blocks.find((x) => x.name === name);
        return b ? [...(b.first ? [b.first] : []), ...b.lines].join('\n').trim() : '';
      };
      // 原文位置：原文块标题的括注；原文引用：原文块的 > 引用行合并；
      // Q 版原文块无 > 引用行，位置写在正文内（位置"…"）——整块内容并入 original_text
      const origBlock = blocks.find((x) => x.name === '原文');
      const quoteLoc = origBlock?.paren || '';
      const origQuoteLines = origBlock
        ? origBlock.lines.filter((l) => l.trim().startsWith('>')).map((l) => l.replace(/^>\s?/, '').trim())
        : [];
      const originalText = origQuoteLines.length
        ? origQuoteLines.join('\n').trim()
        : origBlock
          ? [...(origBlock.first ? [origBlock.first] : []), ...origBlock.lines].join('\n').trim()
          : '';
      // 优先级 / 类型：skill 版 "- 类型：MISSING"；workflow 版 "- 问题性质：需求缺失"；
      // Q 版：标题行 ### Q01【P0 / MISSING】内嵌优先级与类型，详情块字段只有 **问题性质**（中文）
      const headMeta = d.title.match(/^(?:【([^】]*)】)?/) && (d.headRaw || '').match(/【(P[0-3])\s*\/\s*([A-Z]+)】/);
      const priority = (body.match(/-\s*优先级：\s*(P[0-3])/) || [])[1] || (headMeta ? headMeta[1] : '') || issue.priority;
      const typeRaw = (body.match(/-\s*(?:类型|问题性质)：\s*(\S+)/) || [])[1] || (headMeta ? headMeta[2] : '') || '';
      // 主题（workflow 版详情块）：挂 module
      const themeRaw = (body.match(/-\s*主题：\s*(.+)$/m) || [])[1]?.trim() || '';
      // suggestion：建议块 + 未知字段块（需要补的内容与必填格式、范例、验收口径等）按原顺序并入
      let suggestion = blockText('建议');
      // Q 版详情字段：基准依据挂 rule_ref，验收口径挂 acceptance（不并入建议）
      const ruleRefDetail = blockText('基准依据');
      const acceptance = blockText('验收口径');
      for (const b of blocks) {
        if (KNOWN_BLOCKS.has(b.name)) continue;
        const content = [...(b.first ? [b.first] : []), ...b.lines].join('\n').trim();
        if (!content) continue;
        suggestion += (suggestion ? '\n\n' : '') + '**' + b.name + '**' + (b.paren ? '（' + b.paren + '）' : '') + '：\n' + content;
      }

      issue = {
        ...issue,
        title: d.title || issue.title,
        priority: priority || issue.priority,
        type: normalizeType(typeRaw) || issue.type,
        module: themeRaw && !issue.module.includes(themeRaw) ? [...issue.module, themeRaw] : issue.module,
        source_location: quoteLoc || issue.source_location,
        original_text: originalText,
        problem: blockText('问题'),
        impact: blockText('影响'),
        suggestion: suggestion || issue.suggestion,
        rule_ref: ruleRefDetail || issue.rule_ref,
        acceptance,
        status: blockText('处理状态') || '待确认',
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

  // --- RTM 追踪矩阵统计（可选：report.md 尾部 RTM 章节，v4 需求 T3）---
  const rtmIdx = md.indexOf('需求全量检查矩阵（RTM）');
  if (rtmIdx >= 0) {
    const rtmSection = md.slice(rtmIdx);
    const cov = {};
    const reqTotal = rtmSection.match(/需求点总数 \|( (\d+))/);
    const ruleTotal = rtmSection.match(/规则原子检查点总数 \| (\d+)（适用 (\d+)）/);
    const checked = rtmSection.match(/已完成检查 \| (\d+)（检查完成率 ([\d.]+)%/);
    const passed = rtmSection.match(/已通过 \| (\d+)（规则通过率 ([\d.]+)%/);
    if (reqTotal) cov.requirementTotal = parseInt(reqTotal[2], 10);
    if (ruleTotal) { cov.rulePointTotal = parseInt(ruleTotal[1], 10); cov.applicableRulePoints = parseInt(ruleTotal[2], 10); }
    if (checked) { cov.checkedRulePoints = parseInt(checked[1], 10); cov.completeRatePct = parseFloat(checked[2]); }
    if (passed) { cov.passedRulePoints = parseInt(passed[1], 10); cov.passRatePct = parseFloat(passed[2]); }
    if (cov.requirementTotal !== undefined) out.coverageStats = cov;
  }

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
  for (const it of out.issues) {
    out.statistics.dimensions[it.dimension] = (out.statistics.dimensions[it.dimension] || 0) + 1;
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
  const dSum = Object.values(data.statistics.dimensions || {}).reduce((a, b) => a + b, 0);
  if (dSum && dSum !== data.statistics.total) errors.push(`维度统计总和 ${dSum} != 总数 ${data.statistics.total}`);
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
  //    所有条目：标题、优先级、类型必须有；建议与基准依据至少一项非空
  //    （Q 版清单条目无独立建议，rule_ref 条款号即证据；PRD 版建议在清单末列）
  //    有详情块条目（has_detail）：原文/问题/影响必须完整保留
  for (const it of data.issues) {
    for (const f of ['title', 'priority', 'type']) {
      if (!it[f] || !String(it[f]).trim()) errors.push(`${it.id} 字段 ${f} 为空，原始信息丢失`);
    }
    if ((!it.suggestion || !String(it.suggestion).trim()) && (!it.rule_ref || !String(it.rule_ref).trim())) {
      errors.push(`${it.id} 字段 suggestion 与 rule_ref 均为空，原始信息丢失`);
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

// RTM 视图投影（v4 Dashboard 方案 P0 数据贯通）：
// 从某次运行的 RTM 快照（requirements-matrix.json + issues.json）构建 Dashboard 视图模型，
// 注入 data.rtm 随 report-data 内嵌进单文件 HTML（file:// 离线可用，不依赖运行时 fetch）。
// 缺失产物时抛错，由调用方决定回退——禁止用旧 coverage.json 静默替代。
function buildRtmView(runDir) {
  const matrixPath = path.join(runDir, 'requirements-matrix.json');
  if (!fs.existsSync(matrixPath)) {
    throw new Error('RTM 快照缺少 requirements-matrix.json: ' + runDir);
  }
  const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
  let issues = [];
  const issuesPath = path.join(runDir, 'issues.json');
  if (fs.existsSync(issuesPath)) {
    try { issues = JSON.parse(fs.readFileSync(issuesPath, 'utf8')); } catch (e) {
      throw new Error('issues.json 解析失败: ' + e.message);
    }
  }
  const reqByKey = new Map((matrix.requirements || []).map((r) => [r.reqKey, r]));
  // 双向索引：需求 -> ruleLinks；规则 -> requirementIds + issueIds
  const rules = (matrix.ruleCoverage || []).map((c) => ({
    ruleId: c.ruleId,
    file: c.file,
    section: c.section || null,
    text: c.text || '',
    mandatory: c.mandatory !== false,
    requirementIds: c.linkedRequirementIds || [],
    executionStatus: c.status === 'unverified' ? 'unverified' : 'completed',
    verdict: c.status,
    sourceType: c.sourceType || 'unknown',
    authority: c.authority || 'pending-confirm',
    sourceNote: c.sourceNote || '',
    issueIds: [...new Set((matrix.requirements || [])
      .filter((r) => (r.ruleRefs || []).some((x) => x.ruleId === c.ruleId))
      .flatMap((r) => r.issueIds || []))],
  }));
  const ruleIssueIndex = new Map(rules.map((r) => [r.ruleId, r.issueIds]));
  const requirements = (matrix.requirements || []).map((r) => ({
    requirementId: r.requirementId,
    title: r.title,
    source: r.source || null,
    text: r.text || '',
    ruleLinks: (r.ruleRefs || []).map((x) => ({
      ruleId: x.ruleId,
      executionStatus: x.status === 'unverified' ? 'unverified' : 'completed',
      verdict: x.status,
      evidence: x.evidence || '',
      issueIds: x.evidenceInvalid ? [] : (r.issueIds || []),
    })),
    overallStatus: r.overallStatus,
    issueIds: r.issueIds || [],
    fullyPassed: r.fullyPassed === true,
    coverageDimensions: r.coverageDimensions || ['game'],
    verificationStatus: r.verificationStatus || (r.overallStatus === 'unverified' ? 'unverified' : 'verified'),
    unverifiedReason: r.unverifiedReason || null,
  }));
  const issuesView = issues.map((i) => ({
    id: i.id,
    type: i.type,
    priority: i.priority,
    title: i.title,
    requirementIds: (i.requirementRefs || [])
      .map((k) => (reqByKey.get(k) || {}).requirementId)
      .filter(Boolean),
    ruleIds: [...new Set((i.requirementRefs || [])
      .flatMap((k) => { const r = reqByKey.get(k); return r ? (r.ruleRefs || []).map((x) => x.ruleId) : []; }))],
  }));
  return {
    schemaVersion: 2,
    runId: path.basename(runDir),
    statistics: matrix.stats,
    requirements,
    rules,
    issues: issuesView,
  };
}

function main() {
  const argv = process.argv.slice(2);
  const rtmFlag = argv.indexOf('--rtm');
  const positional = argv.filter((a, i) => a !== '--rtm' && argv[i - 1] !== '--rtm');
  const [reportArg, outDirArg] = positional;
  const rtmRunDir = rtmFlag >= 0 ? argv[rtmFlag + 1] : null;
  const reportPath = path.resolve(reportArg || path.join(SKILL_ROOT, '..', '..', '..', 'examples', 'game-prd-check', 'report.md'));
  const outDir = path.resolve(outDirArg || path.dirname(reportPath));

  const md = fs.readFileSync(reportPath, 'utf8');
  const data = parseReport(md);
  // RTM 视图投影（--rtm <runDir>）：缺失产物直接报错，不用旧 coverage 静默替代
  if (rtmRunDir) {
    data.rtm = buildRtmView(rtmRunDir);
  }
  const errors = validateReport(data);
  if (errors.length) {
    console.error('[失败] report.md 校验未通过：');
    for (const e of errors) console.error('  - ' + e);
    process.exit(1);
  }
  delete data._checks; // 校验用临时数据不进入产物

  // 检查覆盖清单（可选）：gen-coverage.mjs 与 report.json 同目录产出 coverage.json
  const coveragePath = path.join(outDir, 'coverage.json');
  if (fs.existsSync(coveragePath)) {
    try {
      data.coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
    } catch (e) {
      console.error('[警告] coverage.json 解析失败，已跳过覆盖清单：' + e.message);
    }
  }

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
