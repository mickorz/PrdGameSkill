#!/usr/bin/env node
// validate-output: Validate 模式一键串联（需求文档 9.2 确定性检查 + 覆盖率指标）
// 用法: node scripts/validate-output.mjs examples/<game> [--json]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

function run(cmd, args) {
  try {
    const out = execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: e.stdout || "", err: e.stderr || "" };
  }
}

function coverage(gameDir) {
  const spec = path.join(gameDir, "game-spec");
  const readYamlFiles = (dir) => {
    const out = [];
    if (!fs.existsSync(dir)) return out;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) out.push(...readYamlFiles(p));
      else if (/\.ya?ml$/.test(e.name)) out.push(p);
    }
    return out;
  };
  const reqTexts = readYamlFiles(path.join(spec, "requirements")).map((f) => fs.readFileSync(f, "utf8"));
  const cfgTexts = readYamlFiles(path.join(spec, "data", "configs")).map((f) => fs.readFileSync(f, "utf8"));
  const stateTexts = readYamlFiles(path.join(spec, "requirements", "states")).map((f) => fs.readFileSync(f, "utf8"));
  const all = [...reqTexts, ...cfgTexts, ...stateTexts];
  const total = all.length;
  const approved = all.filter((t) => /status:\s*approved/.test(t)).length;
  const withSource = all.filter((t) => /kind:\s*(original|human_decision|derived)/.test(t)).length;
  const uiPages = readYamlFiles(path.join(spec, "ui", "pages")).length;
  const cases = readYamlFiles(path.join(spec, "tests", "cases"));
  const caseReqRefs = new Set();
  for (const c of cases) {
    for (const m of fs.readFileSync(c, "utf8").matchAll(/GAME-[A-Z]+-\d+/g)) caseReqRefs.add(m[0]);
  }
  const uiRelated = all.filter((t) => /ui_refs:/.test(t) && !/\[\s*\]/.test(t.split("ui_refs:")[1].split(/\n\s*\w+:/)[0])).length;
  return {
    requirement_total: total,
    rule_confirm_ratio: total ? Number((approved / total).toFixed(2)) : 0,
    source_trace_ratio: total ? Number((withSource / total).toFixed(2)) : 0,
    test_coverage_ratio: total ? Number(([...caseReqRefs].filter((id) => all.some((t) => t.includes(`id: ${id}`))).length / total).toFixed(2)) : 0,
    ui_pages: uiPages,
    ui_related_reqs: uiRelated,
  };
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const gameDir = args.find((a) => !a.startsWith("--"));
  if (!gameDir) {
    console.error("用法: node scripts/validate-output.mjs examples/<game> [--json]");
    process.exit(2);
  }
  const specDir = path.join(gameDir, "game-spec");
  const outDir = path.join(gameDir, "output", "interactive-game-prd");
  const blocking = [];
  const warnings = [];

  // 1. IR 校验
  const ir = run("node", [path.join(SCRIPT_DIR, "validate-ir"), specDir, "--json"]);
  let irReport = null;
  try { irReport = JSON.parse(ir.out); } catch { /* 忽略解析失败 */ }
  if (ir.code !== 0 || (irReport && irReport.result !== "pass")) {
    blocking.push({ gate: "ir", detail: (irReport && irReport.errors) || ir.err || "validate-ir 失败" });
  } else if (irReport && irReport.warnings.length) {
    warnings.push({ gate: "ir", detail: irReport.warnings });
  }

  // 2. HTML 校验（产物存在时）
  if (fs.existsSync(path.join(outDir, "index.html"))) {
    const html = run("node", [path.join(SCRIPT_DIR, "validate-html.mjs"), outDir, specDir, "--json"]);
    let htmlReport = null;
    try { htmlReport = JSON.parse(html.out); } catch { /* 忽略 */ }
    if (html.code !== 0) blocking.push({ gate: "html", detail: (htmlReport && htmlReport.errors) || html.err || "validate-html 失败" });
    else if (htmlReport && htmlReport.warnings.length) warnings.push({ gate: "html", detail: htmlReport.warnings });
  } else {
    warnings.push({ gate: "html", detail: "尚未构建 HTML 产物（运行 generate-html）" });
  }

  // 3. 模拟器测试（迷你样例有专用测试；通用项目按约定提供 scripts）
  const simTest = path.join(gameDir, "simulator");
  if (fs.existsSync(simTest) && gameDir.includes("mini-game")) {
    const sim = run("node", [path.join(SCRIPT_DIR, "simulator.test.mjs")]);
    if (sim.code !== 0) blocking.push({ gate: "simulator", detail: sim.out + sim.err });
  }

  const cov = coverage(gameDir);
  const result = blocking.length === 0 ? "pass" : "fail";
  const report = {
    result,
    game: path.resolve(gameDir),
    checked_at: new Date().toISOString().slice(0, 10),
    blocking_issues: blocking,
    warnings,
    coverage: cov,
    gates: { ir: ir.code === 0, html: !warnings.some((w) => w.gate === "html" && w.detail.includes("尚未构建")), simulator: !blocking.some((b) => b.gate === "simulator") },
  };
  if (asJson) console.log(JSON.stringify(report, null, 2));
  else {
    console.log("Validate 结果: " + result.toUpperCase());
    console.log("覆盖率: 规则确认率 " + cov.rule_confirm_ratio + " / 来源追溯率 " + cov.source_trace_ratio + " / 测试覆盖 " + cov.test_coverage_ratio + "（指标分开计算，不合并总分）");
    for (const b of blocking) console.log("[BLOCKING] " + b.gate);
    for (const w of warnings) console.log("[WARN] " + w.gate + " " + (typeof w.detail === "string" ? w.detail : ""));
  }
  const outFile = path.join(gameDir, "output", "reports");
  fs.mkdirSync(outFile, { recursive: true });
  fs.writeFileSync(path.join(outFile, "validate-report.json"), JSON.stringify(report, null, 2));
  process.exit(result === "pass" ? 0 : 1);
}

main();
