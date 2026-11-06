// 端到端测试（P5-07）：从迷你样例 PRD 输入到 Validate 全链路
// 用法: node scripts/e2e.mjs
// 断言: IR 校验通过 -> 模拟器场景回放通过 -> HTML 构建成功且质量检查通过 -> Validate 报告 result=pass
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../../..");
const GAME = path.join(ROOT, "examples", "mini-game");

let passed = 0;
let failed = 0;
function step(name, fn) {
  try {
    fn();
    passed++;
    console.log("PASS: " + name);
  } catch (e) {
    failed++;
    console.log("FAIL: " + name + " -> " + e.message);
  }
}
function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], cwd: ROOT });
}

// 0. 前置：原始 PRD 存在（Create 不覆盖原始 PRD 的前提下全链可用）
step("原始 PRD 在位且未被产物污染", () => {
  if (!fs.existsSync(path.join(GAME, "game-spec", "source", "original-prd.md"))) throw new Error("缺少 original-prd.md");
  if (fs.readFileSync(path.join(GAME, "game-spec", "source", "original-prd.md"), "utf8").includes("APP_DATA")) throw new Error("原始 PRD 被产物污染");
});

// 1. IR 校验
step("validate-ir PASS", () => {
  run("node", [path.join(SCRIPT_DIR, "validate-ir"), path.join(GAME, "game-spec")]);
});

// 2. 模拟器场景回放
step("模拟器场景回放全部通过", () => {
  run("node", [path.join(SCRIPT_DIR, "simulator.test.mjs")]);
});

// 3. HTML 构建（含模拟器注入）
const outDir = path.join(GAME, "output", "interactive-game-prd");
step("build-html 构建成功且模拟器已注入", () => {
  run("node", [path.join(SCRIPT_DIR, "build-html.mjs"), path.join(GAME, "game-spec"), outDir, path.join(GAME, "simulator")]);
  const html = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
  if (!html.includes("MiniGameFactory") || html.includes("const APP_DATA = null")) throw new Error("模拟器或数据未注入");
});

// 4. HTML 质量检查
step("validate-html PASS", () => {
  run("node", [path.join(SCRIPT_DIR, "validate-html.mjs"), outDir, path.join(GAME, "game-spec")]);
});

// 5. HTML 冒烟（核心导航与交互可运行）
step("HTML 冒烟测试通过", () => {
  const out = run("node", [path.join(SCRIPT_DIR, "html-smoke.test.mjs"), outDir]);
  if (!/0 failed/.test(out)) throw new Error(out.split("\n").filter((l) => l.startsWith("FAIL")).join(" | "));
});

// 6. Validate 汇总报告
step("validate-output result=pass 且报告落盘", () => {
  run("node", [path.join(SCRIPT_DIR, "validate-output.mjs"), GAME, "--json"]);
  const report = JSON.parse(fs.readFileSync(path.join(GAME, "output", "reports", "validate-report.json"), "utf8"));
  if (report.result !== "pass") throw new Error("result=" + report.result);
  if (report.coverage.source_trace_ratio !== 1) throw new Error("来源追溯率不足 100%");
});

console.log("\n端到端结果: " + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
