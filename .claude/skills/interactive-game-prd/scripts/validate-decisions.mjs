// 审计裁决数据一致性：核对 decision-log / open-questions / approval-state 三方（P6-A）
// 用法: node scripts/validate-decisions.mjs <game-spec 目录> [--json]
// 检查项：记录 Schema、状态/结果匹配、问题与 IR 引用存在、supersedes 链、
//         问题状态与有效裁决一致、approval-state 进度与重算一致。
import path from "node:path";
import fs from "node:fs";
import { auditDecisionLog } from "./decision-lib.mjs";

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const positional = args.filter((a) => !a.startsWith("--"));
  if (positional.length !== 1) {
    console.error("用法: node scripts/validate-decisions.mjs <game-spec 目录> [--json]");
    process.exit(2);
  }
  const specDir = path.resolve(positional[0]);
  if (!fs.existsSync(specDir)) {
    console.error(`game-spec 目录不存在: ${specDir}`);
    process.exit(2);
  }

  const report = auditDecisionLog(specDir);
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const p = report.progress;
    console.log(`裁决审计: ${specDir}`);
    console.log(`结果: ${report.result.toUpperCase()}`);
    console.log(`进度: ${p.approved} 已确认 / ${p.rejected} 否决 / ${p.deferred} 挂起 / ${p.open} 待处理（共 ${p.total}，完成率 ${p.total ? Math.round(((p.total - p.open) / p.total) * 100) : 0}%）`);
    for (const e of report.errors) console.log(`[ERROR] ${e}`);
    for (const w of report.warnings) console.log(`[WARN] ${w}`);
  }
  process.exit(report.result === "pass" ? 0 : 1);
}

main();
