#!/usr/bin/env node
// 合并多份同模板 PRD Dashboard HTML 为单文件（Tab 切换）
//
// 输入文件必须是本仓库 PRD 检查 Dashboard 模板产物：
//   静态骨架 + <script type="application/json" id="report-data"> + 渲染 IIFE
//
// 用法:
//   node merge-dashboard.mjs <file1> <file2> [fileN...] [--out <path>] [--out-dir <dir>] [--label <序号>=<文字>]...
//
// 参数:
//   file1..fileN          输入 Dashboard HTML（至少 2 份，顺序即 Tab 顺序）
//   --out <path>          输出文件路径（缺省时自动命名，见下）
//   --out-dir <dir>       输出目录（缺省 = 第一份输入所在目录）
//   --label <i>=<text>    第 i 份（1 起）的 Tab 文字（缺省从文件名推断）
//
// 自动命名: 合并-Dashboard-<标签1>+<标签2>[-<标签3>...]-<YYYYMMDD>-<NN>.html
//           同目录同日前缀已存在时序号递增，不覆盖。
// 输出: [成功] <路径> (<大小>KB) 或 [失败] <原因清单>；退出码 0/1

'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- 参数解析 ----------
function parseArgs(argv) {
  const files = [];
  const labels = {};
  let out = null;
  let outDir = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') { out = argv[++i]; continue; }
    if (a === '--out-dir') { outDir = argv[++i]; continue; }
    if (a === '--label') {
      const kv = argv[++i];
      const m = kv.match(/^(\d+)=(.+)$/);
      if (!m) fail('label 参数格式应为 --label <序号>=<文字>，收到: ' + kv);
      labels[parseInt(m[1], 10)] = m[2];
      continue;
    }
    files.push(a);
  }
  return { files, labels, out, outDir };
}

const errors = [];
function fail(msg) { errors.push(msg); }

// ---------- 输入提取 ----------
// 从 dashboard HTML 提取 report-data JSON 并校验
function extractReport(file) {
  const s = fs.readFileSync(file, 'utf8');
  const TAG = '<script type="application/json" id="report-data">';
  const start = s.indexOf(TAG);
  if (start < 0) { fail('未找到 report-data JSON 标签（不是本仓库 Dashboard 模板产物）: ' + file); return null; }
  const end = s.indexOf('</script>', start);
  if (end < 0) { fail('report-data 标签未闭合: ' + file); return null; }
  const jsonText = s.slice(start + TAG.length, end).trim();
  let data;
  try { data = JSON.parse(jsonText); } catch (e) { fail('report-data JSON 解析失败: ' + file + ' -> ' + e.message); return null; }
  const total = data.statistics && data.statistics.total;
  if (typeof total !== 'number') { fail('statistics.total 缺失: ' + file); return null; }
  return { file, jsonText, data, total };
}

// 从文件名推断 Tab 标签：去掉 "-Dashboard-" 及其后部分（如 杭州麻将分析-Dashboard-20261110-11.html -> 杭州麻将分析）
function inferLabel(file) {
  const base = path.basename(file).replace(/\.html?$/i, '');
  const idx = base.indexOf('-Dashboard-');
  return idx > 0 ? base.slice(0, idx) : base;
}

// ---------- 骨架切分 ----------
// 骨架 = 最后一份输入（约定最新版本为功能超集，如含维度筛选）
// 切为 head（JSON 标签前）、tail（JSON 标签后，含旧渲染脚本）
function splitSkeleton(file) {
  const s = fs.readFileSync(file, 'utf8');
  const TAG = '<script type="application/json" id="report-data">';
  const start = s.indexOf(TAG);
  if (start < 0) { fail('骨架缺少 report-data 标签: ' + file); return null; }
  const jsonEnd = s.indexOf('</script>', start) + '</script>'.length;
  // head 取 JSON 标签之前的部分，tail 取 JSON 标签之后的部分
  const head = s.slice(0, start);
  let tail = s.slice(jsonEnd);
  // 清掉旧渲染脚本与结尾标签（贪婪匹配到文件尾），后续拼接新脚本
  tail = tail.replace(/<script>\s*\n\(function \(\)[\s\S]*$/, '');
  if (tail === s.slice(jsonEnd)) { fail('骨架旧渲染脚本清理失败（未匹配 <script>(function 模式）: ' + file); return null; }
  // 锚点检查
  if (!head.includes('<div class="page">')) { fail('骨架缺少 <div class="page"> 锚点: ' + file); return null; }
  if (!head.includes('</style>')) { fail('骨架缺少 </style> 锚点: ' + file); return null; }
  return { head, tail };
}

// ---------- head 改造 ----------
function transformHead(head, labels) {
  // 1. title
  head = head.replace(
    '<title>PRD 质量分析报告</title>',
    '<title>PRD 质量分析报告 · 合并（' + labels.join(' + ') + '）</title>'
  );
  // 2. Tab CSS（插在响应式注释前，兜底插在 </style> 前）
  const tabCss = [
    '',
    '  /* 报告切换 Tab */',
    '  .tabs { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }',
    '  .tab {',
    '    padding: 10px 22px; border: 1px solid var(--border); background: var(--card);',
    '    border-radius: 10px; font-size: 14px; font-weight: 600; color: var(--muted); cursor: pointer;',
    '    font-family: inherit; transition: background .15s, color .15s;',
    '  }',
    '  .tab:hover { border-color: var(--primary); color: var(--primary); }',
    '  .tab.active { background: var(--primary); border-color: var(--primary); color: #fff; }',
    ''
  ].join('\n');
  if (head.includes('\n  /* 响应式 */')) {
    head = head.replace('\n  /* 响应式 */', tabCss + '\n  /* 响应式 */');
  } else {
    head = head.replace('</style>', tabCss + '</style>');
  }
  // 3. Tab 栏（插在 .page 开头）
  const tabs = labels.map(function (l, i) {
    const active = i === 0 ? ' active' : '';
    return '    <button class="tab' + active + '" data-tab="' + i + '">' + l + '</button>';
  }).join('\n');
  const nav = '\n\n  <!-- 报告切换 -->\n  <nav class="tabs" id="tabs">\n' + tabs + '\n  </nav>\n';
  head = head.replace('<div class="page">\n', '<div class="page">' + nav);
  return head;
}

// ---------- 渲染脚本模板 ----------
function buildRenderScript(labels, totals, skillDir) {
  const tmplPath = path.join(skillDir, 'templates', 'render-script.js.tmpl');
  let tmpl;
  try { tmpl = fs.readFileSync(tmplPath, 'utf8'); } catch (e) { fail('渲染脚本模板缺失: ' + tmplPath); return null; }
  const reports = labels.map(function (l, i) {
    return { label: l, jsonId: 'report-data-' + i, total: totals[i] };
  });
  if (!tmpl.includes('__REPORTS_JSON__')) { fail('模板缺少 __REPORTS_JSON__ 占位符'); return null; }
  return tmpl.replace('__REPORTS_JSON__', JSON.stringify(reports, null, 2));
}

// ---------- 输出命名 ----------
function resolveOutPath(outArg, outDirArg, firstFile, labels) {
  if (outArg) return outArg;
  const dir = outDirArg || path.dirname(firstFile);
  // 标签含 / 等文件名非法字符时替换
  const safe = labels.map(function (l) { return l.replace(/[\\/:*?"<>|]/g, ''); });
  const date = new Date();
  const ymd = date.getFullYear() +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0');
  const prefix = '合并-Dashboard-' + safe.slice(0, 2).join('+') +
    (safe.length > 2 ? '+' + (safe.length - 2) + '份' : '') + '-' + ymd + '-';
  let n = 1;
  while (fs.existsSync(path.join(dir, prefix + String(n).padStart(2, '0') + '.html'))) n++;
  return path.join(dir, prefix + String(n).padStart(2, '0') + '.html');
}

// ---------- 产物自检 ----------
function verify(outText, n) {
  const checks = [];
  const scriptBlocks = (outText.match(/<script/g) || []).length;
  checks.push(['script 块数 = ' + (n + 1), scriptBlocks === n + 1]);
  checks.push(['渲染入口 mount(0) 存在', outText.includes('mount(0);')]);
  checks.push(['尾部 html 标签完整', outText.trimEnd().endsWith('</html>')]);
  checks.push(['旧 report-data id 不残留', !/id="report-data"/.test(outText)]);
  for (let i = 0; i < n; i++) {
    checks.push(['report-data-' + i + ' 存在', outText.includes('id="report-data-' + i + '"')]);
  }
  checks.push(['Tab 栏存在', outText.includes('id="tabs"')]);
  return checks;
}

// ---------- 主流程 ----------
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.files.length < 2) {
    fail('至少需要 2 份输入 Dashboard HTML');
  }
  if (errors.length) { printFail(); return; }

  // 1. 提取每份输入
  const reports = args.files.map(extractReport);
  if (reports.some(function (r) { return r === null; })) { printFail(); return; }

  // 2. 标签：--label i=文字 覆盖 > 文件名推断
  const labels = reports.map(function (r, i) {
    return args.labels[i + 1] || inferLabel(r.file);
  });
  const totals = reports.map(function (r) { return r.total; });

  // 3. 骨架 = 最后一份输入
  const skel = splitSkeleton(reports[reports.length - 1].file);
  if (skel === null) { printFail(); return; }

  // 4. head 改造（title + Tab CSS + Tab 栏，Tab 文字附条数）
  const tabLabels = labels.map(function (l, i) { return l + '（' + totals[i] + ' 项）'; });
  const head = transformHead(skel.head, tabLabels);

  // 5. 渲染脚本（模板 + REPORTS 注入）
  const skillDir = path.resolve(__dirname, '..');
  const renderJs = buildRenderScript(tabLabels, totals, skillDir);
  if (renderJs === null) { printFail(); return; }

  // 6. 拼接
  const jsonBlocks = reports.map(function (r, i) {
    return '<script type="application/json" id="report-data-' + i + '">' + r.jsonText + '</script>';
  }).join('\n');
  const outText = head + jsonBlocks + '\n' + renderJs;

  // 7. 产物自检
  const checks = verify(outText, reports.length);
  const bad = checks.filter(function (c) { return !c[1]; });
  if (bad.length) {
    bad.forEach(function (c) { fail('产物自检失败: ' + c[0]); });
    printFail();
    return;
  }

  // 8. 写出（utf-8）
  const outPath = resolveOutPath(args.out, args.outDir, reports[0].file, labels);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, outText, 'utf8');
  const kb = (Buffer.byteLength(outText, 'utf8') / 1024).toFixed(1);
  console.log('[成功] ' + outPath + ' (' + kb + 'KB)');
  console.log('合并了 ' + reports.length + ' 份报告: ' + labels.map(function (l, i) { return l + '=' + totals[i] + '项'; }).join(', '));
}

function printFail() {
  console.log('[失败]');
  errors.forEach(function (e) { console.log('  - ' + e); });
  process.exitCode = 1;
}

main();
