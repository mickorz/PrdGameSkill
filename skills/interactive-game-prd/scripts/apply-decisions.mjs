// 应用人工裁决：把人工确认的裁决记录写入 game-spec/reviews/（P6-A）
// 用法: node scripts/apply-decisions.mjs <game-spec 目录> <decisions.json> [--dry-run] [--json]
// decisions.json 为裁决记录数组或 {decisions:[...]}。校验失败整体不落盘。
// 红线：reviewer 必须为 human（Schema 强制），AI 不允许代人工提交正式裁决。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyDecisions } from "./decision-lib.mjs";

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const asJson = args.includes("--json");
  const positional = args.filter((a) => !a.startsWith("--"));
  if (positional.length !== 2) {
    console.error("用法: node scripts/apply-decisions.mjs <game-spec 目录> <decisions.json> [--dry-run] [--json]");
    process.exit(2);
  }
  const [specDir, decisionsFile] = positional.map((p) => path.resolve(p));
  if (!fs.existsSync(specDir)) {
    console.error(`game-spec 目录不存在: ${specDir}`);
    process.exit(2);
  }
  let incoming;
  try {
    const data = JSON.parse(fs.readFileSync(decisionsFile, "utf8"));
    incoming = Array.isArray(data) ? data : data.decisions;
    if (!Array.isArray(incoming)) throw new Error("decisions.json 应为数组或 {decisions:[...]}");
  } catch (e) {
    console.error(`decisions.json 解析失败: ${e.message}`);
    process.exit(2);
  }

  const { errors, changes, progress } = applyDecisions(specDir, incoming, { dryRun });
  if (errors.length > 0) {
    const report = { result: "fail", applied: 0, errors };
    if (asJson) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`应用裁决: 失败（${errors.length} 个错误，未写入任何文件）`);
      for (const e of errors) console.log(`[ERROR] ${e}`);
    }
    process.exit(1);
  }

  const report = { result: dryRun ? "dry-run" : "ok", applied: incoming.length, changes, progress };
  if (asJson) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`应用裁决: ${dryRun ? "dry-run 预演（未写入）" : "成功"}`);
    for (const c of changes) console.log(`  ${c.action}: ${c.file}`);
    console.log(`  进度: ${progress.approved} 已确认 / ${progress.rejected} 否决 / ${progress.deferred} 挂起 / ${progress.open} 待处理（共 ${progress.total}）`);
  }
  process.exit(0);
}

main();
