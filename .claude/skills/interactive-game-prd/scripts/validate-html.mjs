#!/usr/bin/env node
// validate-html: Interactive HTML PRD 产物质量检查（需求文档 9.2 确定性检查 + 6.4 约束）
// 用法: node scripts/validate-html.mjs <output 目录> [game-spec 目录] [--json]
import fs from "node:fs";
import path from "node:path";

const errors = [];
const warnings = [];

function check(outputDir, specDir) {
  const indexFile = path.join(outputDir, "index.html");
  if (!fs.existsSync(indexFile)) {
    errors.push({ code: "NO_INDEX", message: "缺少 index.html" });
    return;
  }
  const html = fs.readFileSync(indexFile, "utf8");

  // 1. 无未替换模板变量
  if (/\{\{[^}]+\}\}/.test(html) || html.includes("__APP_DATA_JSON__")) {
    errors.push({ code: "TEMPLATE_LEFTOVER", message: "存在未替换的模板变量" });
  }

  // 2. 无外链资源（script/link/img 的 src/href 指向 http）
  const extRefs = html.match(/(?:src|href)\s*=\s*["']https?:\/\/[^"']+["']/g) || [];
  if (extRefs.length) {
    errors.push({ code: "EXTERNAL_REF", message: `存在外链资源 ${extRefs.length} 处，破坏离线约束` });
  }

  // 3. 数据内嵌
  if (!html.includes("const APP_DATA = ") || html.includes("const APP_DATA = null")) {
    errors.push({ code: "NO_EMBEDDED_DATA", message: "APP_DATA 未内嵌" });
  }

  // 4. 组件 ID 覆盖：UI Spec 全部组件在 HTML 中有对应 data-component-id
  if (specDir) {
    const dataMatch = html.match(/const APP_DATA = (\{.*?\});\n/s);
    if (!dataMatch) {
      errors.push({ code: "NO_EMBEDDED_DATA", message: "无法解析内嵌 APP_DATA" });
    } else {
      let data;
      try {
        data = JSON.parse(dataMatch[1].replace(/<\/script/g, "<\\/script").replace(/\\<\/script/g, "</script"));
      } catch {
        // JSON.parse 对 <\/script 已由 build 处理，直接解析原串
        data = JSON.parse(dataMatch[1].replace(/\\n/g, "\\n"));
      }
      // 组件覆盖检查
      const rendered = new Set((html.match(/data-component-id\\?"?\s*[:=]\s*\\?"?(GAME-COMP-\d+)/g) || []).map((m) => m.match(/GAME-COMP-\d+/)[0]));
      const specIds = data.ui.components.map((c) => c.id);
      for (const id of specIds) {
        if (!rendered.has(id) && !html.includes(`"${id}"`) && !html.includes(`'${id}'`) && !html.includes(id)) {
          errors.push({ code: "COMP_MISSING", message: `UI Spec 组件 ${id} 未在 HTML 中渲染` });
        }
      }
      // 需求数量核对
      const total = data.requirements.length + data.configs.length + data.states.length;
      if (total === 0) warnings.push({ code: "EMPTY_REQ", message: "内嵌需求数量为 0" });
      // 判定日志与模拟器一致性
      if (data.simulator && data.simulator.enabled && !html.includes("MiniGameFactory") && !html.includes("createGame")) {
        warnings.push({ code: "SIM_MARKED_BUT_NO_ENGINE", message: "simulator.enabled=true 但未检测到引擎代码" });
      }
    }
  }

  // 5. 基本体量
  if (html.length < 10 * 1024) {
    warnings.push({ code: "SMALL", message: `HTML 仅 ${(html.length / 1024).toFixed(1)}KB，可能数据未完整嵌入` });
  }
}

function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const asJson = process.argv.includes("--json");
  if (args.length < 1) {
    console.error("用法: node scripts/validate-html.mjs <output 目录> [game-spec 目录] [--json]");
    process.exit(2);
  }
  check(args[0], args[1]);
  const report = { result: errors.length === 0 ? "pass" : "fail", errors, warnings };
  if (asJson) console.log(JSON.stringify(report, null, 2));
  else {
    console.log("结果: " + report.result.toUpperCase());
    for (const e of errors) console.log(`[ERROR] ${e.code} ${e.message}`);
    for (const w of warnings) console.log(`[WARN ] ${w.code} ${w.message}`);
    console.log(`errors=${errors.length} warnings=${warnings.length}`);
  }
  process.exit(errors.length ? 1 : 0);
}

main();
