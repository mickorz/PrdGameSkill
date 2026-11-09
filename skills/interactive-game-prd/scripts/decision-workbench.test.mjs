// Decision Workbench 服务端 API 测试（P6-B）：state / evidence / drafts / decisions
// 用法: node scripts/decision-workbench.test.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "./decision-workbench.mjs";

let passed = 0;
let failed = 0;
function check(name, ok) {
  if (ok) { passed++; console.log("PASS: " + name); }
  else { failed++; console.log("FAIL: " + name); }
}

// ---------- 夹具：临时 game-spec ----------
const specDir = fs.mkdtempSync(path.join(os.tmpdir(), "workbench-test-"));
fs.mkdirSync(path.join(specDir, "reviews"), { recursive: true });
fs.mkdirSync(path.join(specDir, "requirements", "rules"), { recursive: true });
fs.mkdirSync(path.join(specDir, "source"), { recursive: true });
fs.writeFileSync(path.join(specDir, "manifest.yaml"), 'format: GAME-SPEC/1\ngame_name: 测试游戏\n');
fs.writeFileSync(path.join(specDir, "requirements", "rules", "rule-003.yaml"), "id: GAME-RULE-003\nname: 房主庄\nstatus: proposed\nauthority: fixed\n");
fs.writeFileSync(path.join(specDir, "source", "01-基础规则.md"), "line1 占位\nline2 房主为庄家\nline3 占位\n");
fs.writeFileSync(path.join(specDir, "source", "source-map.json"), JSON.stringify([
  { requirement_id: "GAME-RULE-003", anchors: [{ file: "source/01-基础规则.md", heading: "1.2 庄家", line_start: 2, line_end: 2 }] },
]));
const NOW = "2026-11-09T12:00:00+08:00";
fs.writeFileSync(path.join(specDir, "reviews", "open-questions.json"), JSON.stringify([
  { id: "OQ-001", requirement_id: "GAME-RULE-003", question: "默认庄家口径待确认", severity: "high", status: "open" },
  { id: "OQ-002", requirement_id: null, question: "独立问题", severity: "low", status: "open" },
], null, 2));
fs.writeFileSync(path.join(specDir, "reviews", "decision-log.json"), JSON.stringify({ decisions: [] }, null, 2));
fs.writeFileSync(path.join(specDir, "reviews", "approval-state.json"), JSON.stringify({
  game: "测试游戏", updated_at: NOW,
  progress: { total: 2, approved: 0, rejected: 0, deferred: 0, open: 2 },
  last_position: null, drafts: {},
}, null, 2));

// ---------- 起服务（随机端口） ----------
const server = createServer(specDir);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const getJson = async (p, init) => {
  const res = await fetch(base + p, init);
  return { code: res.status, body: await res.json() };
};

// ---------- 1. 页面与状态 ----------
const index = await fetch(base + "/").then((r) => r.text());
check("GET / 返回工作台页面", index.includes("Decision Workbench") || index.includes("root"));
const s0 = await getJson("/api/state");
check("GET /api/state 返回 2 个问题", s0.code === 200 && s0.body.questions.length === 2);
check("state 带 progress 与 approvalState", s0.body.progress.open === 2 && s0.body.approvalState.game === "测试游戏");

// ---------- 2. 证据链 ----------
const ev = await getJson("/api/evidence/OQ-001");
check("证据返回关联条目", ev.code === 200 && ev.body.requirement?.id === "GAME-RULE-003" && ev.body.requirement?.status === "proposed");
check("证据返回原文引用行", ev.body.anchors[0]?.quote === "line2 房主为庄家" && ev.body.anchors[0].heading === "1.2 庄家");
const ev404 = await getJson("/api/evidence/OQ-999");
check("不存在的问题证据返回 404", ev404.code === 404);

// ---------- 3. 草稿自动保存 ----------
const d1 = await getJson("/api/drafts", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ question_id: "OQ-001", draft: { outcome: "modified", final_decision: { text: "房主庄" }, rationale: "待确认" } }),
});
check("草稿保存成功", d1.code === 200 && !!d1.body.drafts["OQ-001"]);
const badDraft = await getJson("/api/drafts", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ question_id: "OQ-001", draft: { outcome: "haha" } }),
});
check("非法 outcome 草稿被拒绝", badDraft.code === 400);

// ---------- 4. 提交正式裁决 ----------
const post = async (body) => getJson("/api/decisions", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const ok1 = await post({ decisions: [{ question_id: "OQ-001", decision_status: "approved", outcome: "modified", final_decision: { text: "房主庄" }, rationale: "产品确认" }] });
check("提交裁决成功", ok1.code === 200 && ok1.body.applied === 1 && ok1.body.audit === "pass");
check("进度更新 1 确认 1 待处理", ok1.body.progress.approved === 1 && ok1.body.progress.open === 1);
const after = JSON.parse(fs.readFileSync(path.join(specDir, "reviews", "decision-log.json"), "utf8"));
check("decision-log 写入且 decision_id 自动分配 DEC-001", after.decisions[0].decision_id === "DEC-001" && after.decisions[0].reviewer === "human");
check("IR 流转自动生成 proposed->approved", after.decisions[0].requirement_updates?.[0]?.from === "proposed" && after.decisions[0].requirement_updates?.[0]?.to === "approved");
const oqAfter = JSON.parse(fs.readFileSync(path.join(specDir, "reviews", "open-questions.json"), "utf8"));
check("问题状态升级并回链", oqAfter[0].status === "approved" && oqAfter[0].decision_id === "DEC-001");
check("提交后草稿被清除", !after.decisions.drafts && !JSON.parse(fs.readFileSync(path.join(specDir, "reviews", "approval-state.json"), "utf8")).drafts["OQ-001"]);

// ---------- 5. 红线与非法输入 ----------
const aiPost = await post({ decisions: [{ question_id: "OQ-002", decision_status: "approved", outcome: "adopted", rationale: "x", reviewer: "ai" }] });
check("AI 代裁决被拒绝", aiPost.code === 400 && aiPost.body.error.includes("human"));
const badQ = await post({ decisions: [{ question_id: "OQ-999", decision_status: "approved", outcome: "adopted", rationale: "x" }] });
check("未知问题返回 400", badQ.code === 400);
const reDecide = await post({ decisions: [{ question_id: "OQ-001", decision_status: "rejected", outcome: "rejected", rationale: "翻案" }] });
check("重裁决未声明 supersedes 被拒绝", reDecide.code === 400 && reDecide.body.errors.join().includes("supersedes"));
const reDecideOk = await post({ decisions: [{ question_id: "OQ-001", decision_status: "rejected", outcome: "rejected", rationale: "翻案", supersedes: "DEC-001" }] });
check("声明 supersedes 后翻案成功", reDecideOk.code === 200 && reDecideOk.body.applied === 1);

// ---------- 6. 首页未构建提示（无 dist 时不 500） ----------
check("页面始终 200", (await fetch(base + "/")).status === 200);

server.close();
fs.rmSync(specDir, { recursive: true, force: true });
console.log(`\n结果: ${passed} PASS, ${failed} FAIL`);
process.exit(failed > 0 ? 1 : 0);
