// Decision Workbench 数据层测试（P6-A）：校验、应用、重裁决、审计、validate-ir 联动
// 用法: node scripts/decision.test.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { applyDecisions, auditDecisionLog, loadDecisionLog, loadOpenQuestions } from "./decision-lib.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
let passed = 0;
let failed = 0;
function check(name, ok) {
  if (ok) { passed++; console.log("PASS: " + name); }
  else { failed++; console.log("FAIL: " + name); }
}

// ---------- 夹具：临时 game-spec ----------
const specDir = fs.mkdtempSync(path.join(os.tmpdir(), "decision-test-"));
fs.mkdirSync(path.join(specDir, "reviews"), { recursive: true });
fs.mkdirSync(path.join(specDir, "requirements", "rules"), { recursive: true });
fs.writeFileSync(path.join(specDir, "manifest.yaml"), 'format: GAME-SPEC/1\ngame_name: 测试游戏\n');
fs.writeFileSync(path.join(specDir, "requirements", "rules", "rule-003.yaml"), "id: GAME-RULE-003\nstatus: proposed\n");
const NOW = "2026-11-09T12:00:00+08:00";
fs.writeFileSync(path.join(specDir, "reviews", "open-questions.json"), JSON.stringify([
  { id: "OQ-001", requirement_id: "GAME-RULE-003", question: "测试问题一", severity: "high", status: "open" },
  { id: "OQ-002", requirement_id: null, question: "测试问题二（无关联条目）", severity: "medium", status: "open" },
  { id: "OQ-003", requirement_id: "GAME-RULE-003", question: "测试问题三", severity: "low", status: "open" },
], null, 2));

const readLog = () => loadDecisionLog(specDir).decisions;
const readQ = (id) => loadOpenQuestions(specDir).questions.find((q) => q.id === id);

// ---------- 1. dry-run 不落盘 ----------
const dec1 = {
  decision_id: "DEC-001", question_id: "OQ-001", decision_status: "approved", outcome: "adopted",
  final_decision: { hosts_is_dealer: true }, rationale: "人工确认", reviewer: "human", decided_at: NOW,
  requirement_updates: [{ requirement_id: "GAME-RULE-003", field: "status", from: "proposed", to: "approved" }],
};
const dry = applyDecisions(specDir, [dec1], { dryRun: true });
check("dry-run 校验通过", dry.errors.length === 0);
check("dry-run 未写入 decision-log", readLog().length === 0);

// ---------- 2. 正式应用 ----------
const ok = applyDecisions(specDir, [dec1]);
check("正式应用成功", ok.errors.length === 0);
check("decision-log 追加 1 条", readLog().length === 1);
check("问题状态升级 approved 并回链 decision_id", readQ("OQ-001").status === "approved" && readQ("OQ-001").decision_id === "DEC-001");
const state1 = JSON.parse(fs.readFileSync(path.join(specDir, "reviews", "approval-state.json"), "utf8"));
check("进度统计正确 1/3", state1.progress.approved === 1 && state1.progress.open === 2 && state1.progress.total === 3);
check("last_position 指向 OQ-001", state1.last_position.question_id === "OQ-001");

// ---------- 3. 非法裁决整体拒绝 ----------
const badBatch = [
  { ...dec1, decision_id: "DEC-002", question_id: "OQ-002", requirement_updates: [] }, // 重复 id
  { ...dec1, decision_id: "DEC-003", question_id: "OQ-002", reviewer: "ai", requirement_updates: [] }, // AI 提交
  { ...dec1, decision_id: "DEC-004", question_id: "OQ-999", requirement_updates: [] }, // 问题不存在
  { ...dec1, decision_id: "DEC-005", question_id: "OQ-002", decision_status: "approved", outcome: "rejected", requirement_updates: [] }, // 状态/结果不匹配
  { ...dec1, decision_id: "DEC-006", question_id: "OQ-001", requirement_updates: [{ requirement_id: "GAME-RULE-003", field: "status", from: "approved", to: "proposed" }] }, // 非法流转 + 重复裁决未声明 supersedes
  { ...dec1, decision_id: "DEC-007", question_id: "OQ-002", requirement_updates: [{ requirement_id: "GAME-RULE-999", field: "status", from: "proposed", to: "approved" }] }, // 条目不存在
  { ...dec1, decision_id: "DEC-008", question_id: "OQ-003", decision_status: "draft", outcome: "adopted", requirement_updates: [] }, // draft 落盘
];
const bad = applyDecisions(specDir, badBatch);
check("非法批次整体失败", bad.errors.length >= badBatch.length - 1); // 至少覆盖各类错误
check("非法批次未落盘", readLog().length === 1 && readQ("OQ-003").status === "open");
const errText = bad.errors.join("\n");
check("识别 AI 代裁决", errText.includes("Schema") || /reviewer/i.test(errText) || errText.includes("reviewer"));
check("识别非法流转", errText.includes("非法状态流转 approved->proposed"));
check("识别重复裁决未声明 supersedes", errText.includes("supersedes"));
check("识别不存在的条目引用", errText.includes("GAME-RULE-999"));
check("识别 draft 落盘", errText.includes("draft"));

// ---------- 4. 重裁决（supersedes 链） ----------
const dec2 = {
  decision_id: "DEC-002", question_id: "OQ-001", decision_status: "rejected", outcome: "rejected",
  final_decision: null, rationale: "产品推翻原口径", reviewer: "human", decided_at: "2026-11-09T13:00:00+08:00",
  supersedes: "DEC-001", requirement_updates: [{ requirement_id: "GAME-RULE-003", field: "status", from: "approved", to: "rejected" }],
};
const ok2 = applyDecisions(specDir, [dec2]);
check("重裁决成功", ok2.errors.length === 0);
check("历史保留 2 条", readLog().length === 2);
check("有效版本为最新（rejected）", readQ("OQ-001").status === "rejected" && readQ("OQ-001").decision_id === "DEC-002");

// ---------- 5. 合并裁决（一次裁决覆盖关联问题） ----------
const dec3 = {
  decision_id: "DEC-003", question_id: "OQ-002", decision_status: "deferred", outcome: "deferred",
  final_decision: null, rationale: "挂起待后续", reviewer: "human", decided_at: "2026-11-09T14:00:00+08:00",
  related_question_ids: ["OQ-003"], requirement_updates: [],
};
const ok3 = applyDecisions(specDir, [dec3]);
check("合并裁决成功", ok3.errors.length === 0);
check("关联问题同步挂起", readQ("OQ-003").status === "deferred" && readQ("OQ-003").decision_id === "DEC-003");

// ---------- 6. 审计通过 ----------
const audit1 = auditDecisionLog(specDir);
check("审计通过", audit1.result === "pass");
check("审计进度 0 确认 1 否决 2 挂起", audit1.progress.approved === 0 && audit1.progress.rejected === 1 && audit1.progress.deferred === 2 && audit1.progress.open === 0);

// ---------- 7. 篡改 approval-state 被审计发现 ----------
const stateFile = path.join(specDir, "reviews", "approval-state.json");
const stateObj = JSON.parse(fs.readFileSync(stateFile, "utf8"));
stateObj.progress.approved = 3; // 篡改
fs.writeFileSync(stateFile, JSON.stringify(stateObj, null, 2));
const audit2 = auditDecisionLog(specDir);
check("篡改进度被审计发现", audit2.result === "fail" && audit2.errors.some((e) => e.includes("approval-state.progress")));

// ---------- 8. CLI: validate-decisions 退出码 ----------
let cliCode = 0;
try {
  execFileSync("node", [path.join(scriptDir, "validate-decisions.mjs"), specDir], { stdio: "pipe" });
} catch (e) { cliCode = e.status; }
check("CLI 审计失败返回非零", cliCode !== 0);
// 恢复后应为零
fs.writeFileSync(stateFile, JSON.stringify(state1Like(), null, 2));
function state1Like() {
  const qs = loadOpenQuestions(specDir).questions;
  const p = { total: qs.length, approved: 0, rejected: 0, deferred: 0, open: 0 };
  for (const q of qs) { if (q.status === "approved" || q.status === "modified") p.approved++; else if (q.status === "rejected") p.rejected++; else if (q.status === "deferred") p.deferred++; else p.open++; }
  return { game: "测试游戏", updated_at: "2026-11-09T15:00:00+08:00", progress: p, last_position: null, drafts: {} };
}
cliCode = 0;
try {
  execFileSync("node", [path.join(scriptDir, "validate-decisions.mjs"), specDir], { stdio: "pipe" });
} catch (e) { cliCode = e.status; }
check("恢复后 CLI 审计通过返回零", cliCode === 0);

// ---------- 9. validate-ir 联动：新格式非法流转被抓 ----------
const specDir2 = fs.mkdtempSync(path.join(os.tmpdir(), "decision-test-ir-"));
fs.mkdirSync(path.join(specDir2, "reviews"), { recursive: true });
fs.writeFileSync(path.join(specDir2, "reviews", "open-questions.json"), "[]");
fs.writeFileSync(path.join(specDir2, "reviews", "decision-log.json"), JSON.stringify({
  decisions: [{
    decision_id: "DEC-001", question_id: "OQ-001", decision_status: "approved", outcome: "modified",
    rationale: "x", reviewer: "human", decided_at: NOW,
    requirement_updates: [{ requirement_id: "GAME-RULE-003", field: "status", from: "approved", to: "proposed" }],
  }],
}, null, 2));
let irCode = 0, irOut = "";
try {
  irOut = execFileSync("node", [path.join(scriptDir, "validate-ir"), specDir2], { stdio: "pipe" }).toString();
} catch (e) { irCode = e.status; irOut = (e.stdout || "").toString() + (e.stderr || "").toString(); }
check("validate-ir 抓到新格式非法流转", irCode !== 0 && irOut.includes("ILLEGAL_TRANSITION") && irOut.includes("approved->proposed"));

// ---------- 汇总 ----------
fs.rmSync(specDir, { recursive: true, force: true });
fs.rmSync(specDir2, { recursive: true, force: true });
console.log(`\n结果: ${passed} PASS, ${failed} FAIL`);
process.exit(failed > 0 ? 1 : 0);
