// Decision Workbench 本地服务（P6-B）：三栏式裁决页面 + 读写 reviews 数据的 API
// 用法: node scripts/decision-workbench.mjs <game-spec 目录> [--port 8434]
// 安全边界：只读写指定 game-spec 内的 reviews/*.json 与 source/*，不触碰仓库其他路径。
// 正式裁决只来自页面人工提交（reviewer 恒为 human，AI 不得代提交）。
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { applyDecisions, auditDecisionLog, loadOpenQuestions, loadDecisionLog, loadApprovalState, computeProgress } from "./decision-lib.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
// React 构建产物（.claude/skills/interactive-game-prd/web/decision-workbench/dist），随仓库入库，运行时不要求构建环境
const DIST = path.join(scriptDir, "..", "web", "decision-workbench", "dist");

function parseArgs(argv) {
  const positional = [];
  let port = 8434;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--port") port = Number(argv[++i]);
    else positional.push(argv[i]);
  }
  return { positional, port };
}

// ---------- IR / 证据解析（只读） ----------

// 扫描 requirements/ui/data/tests/game 下的 yaml，返回 id -> {file, doc}
function loadIrIndex(specDir) {
  const index = new Map();
  const roots = ["requirements", "ui", "data", "tests", "game"].map((d) => path.join(specDir, d)).filter((d) => fs.existsSync(d));
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (/\.(yaml|yml)$/.test(name)) {
        try {
          const doc = yaml.load(fs.readFileSync(p, "utf8"));
          if (doc && typeof doc.id === "string" && /^GAME-/.test(doc.id)) index.set(doc.id, { file: p, doc });
        } catch { /* 单文件解析失败不阻塞服务 */ }
      }
    }
  };
  for (const root of roots) walk(root);
  return index;
}

function loadSourceMap(specDir) {
  const file = path.join(specDir, "source", "source-map.json");
  if (!fs.existsSync(file)) return new Map();
  const entries = JSON.parse(fs.readFileSync(file, "utf8"));
  return new Map(entries.map((e) => [e.requirement_id, e.anchors || []]));
}

// 读取原文引用行
function readQuote(specDir, anchor) {
  const file = path.join(specDir, anchor.file);
  if (!file.startsWith(path.join(specDir, "source"))) return null; // 路径逃逸防护
  if (!fs.existsSync(file)) return null;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  return {
    file: anchor.file,
    heading: anchor.heading,
    line_start: anchor.line_start,
    line_end: anchor.line_end,
    quote: lines.slice((anchor.line_start || 1) - 1, anchor.line_end || anchor.line_start).join("\n"),
  };
}

// ---------- API 处理 ----------

function createServer(specDir, port) {
  const irIndex = loadIrIndex(specDir); // 静态扫描一次；裁决后 IR 不变（P6-C 才写 IR）
  const sourceMap = loadSourceMap(specDir);

  const json = (res, code, body) => {
    const data = JSON.stringify(body, null, 2);
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
    res.end(data);
  };
  const readBody = (req) => new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => { raw += c; if (raw.length > 2 * 1024 * 1024) reject(new Error("body too large")); });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });

  // 组装完整状态
  const buildState = () => {
    const { questions } = loadOpenQuestions(specDir);
    const { decisions } = loadDecisionLog(specDir);
    const { state } = loadApprovalState(specDir);
    return { game: state?.game || "未知游戏", questions, decisions, approvalState: state, progress: state?.progress || computeProgress(questions) };
  };

  // 生成下一个 decision_id
  const nextDecisionId = (decisions) => {
    let max = 0;
    for (const d of decisions) {
      const m = /^DEC-(\d+)$/.exec(d.decision_id || "");
      if (m) max = Math.max(max, Number(m[1]));
    }
    return `DEC-${String(max + 1).padStart(3, "0")}`;
  };

  // 依据问题与结果自动生成 IR 状态流转（人工可在页面关闭同步开关）
  const buildRequirementUpdates = (question, outcome, includeSync) => {
    if (!includeSync) return [];
    const rid = question.requirement_id;
    if (!rid || outcome === "deferred") return [];
    const entry = irIndex.get(rid);
    const from = entry?.doc?.status || "proposed";
    const to = outcome === "rejected" ? "rejected" : "approved";
    if (from === to) return [];
    return [{ requirement_id: rid, field: "status", from, to, note: "由裁决自动同步（页面提交）" }];
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    try {
      // 页面与静态资源（React 构建产物）
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        const index = path.join(DIST, "index.html");
        if (!fs.existsSync(index)) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end("<h1>Decision Workbench 未构建</h1><p>先执行: npm --prefix .claude/skills/interactive-game-prd/web/decision-workbench run build</p>");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(fs.readFileSync(index, "utf8"));
        return;
      }
      const assetMatch = /^\/assets\/(.+)$/.exec(url.pathname);
      if (req.method === "GET" && assetMatch) {
        const file = path.join(DIST, "assets", path.basename(assetMatch[1]));
        if (!fs.existsSync(file)) return json(res, 404, { error: "asset not found" });
        const type = file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : file.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream";
        res.writeHead(200, { "Content-Type": `${type}; charset=utf-8` });
        res.end(fs.readFileSync(file));
        return;
      }
      // 全量状态
      if (req.method === "GET" && url.pathname === "/api/state") {
        return json(res, 200, buildState());
      }
      // 证据：问题 -> 关联条目 -> 原文引用 + 需求附图
      const evMatch = /^\/api\/evidence\/(OQ-\d+)$/.exec(url.pathname);
      if (req.method === "GET" && evMatch) {
        const { questions } = loadOpenQuestions(specDir);
        const q = questions.find((x) => x.id === evMatch[1]);
        if (!q) return json(res, 404, { error: "问题不存在" });
        const rid = q.requirement_id;
        const entry = rid ? irIndex.get(rid) : null;
        const anchors = (rid ? sourceMap.get(rid) : []) || [];
        const images = (q.images || []).map((name) => {
          const file = path.join(specDir, "source", "images", path.basename(name));
          return { name, exists: fs.existsSync(file), url: `/images/${encodeURIComponent(path.basename(name))}` };
        });
        return json(res, 200, {
          requirement: entry ? {
            id: entry.doc.id, name: entry.doc.name || "", status: entry.doc.status || "proposed",
            authority: entry.doc.authority || "", description: entry.doc.description || "",
          } : rid ? { id: rid, name: "", status: "（IR 中未找到条目）", authority: "", description: "" } : null,
          anchors: anchors.map((a) => readQuote(specDir, a)).filter(Boolean),
          images,
        });
      }
      // 需求附图（仅允许 source/images 下的图片文件）
      const imgMatch = /^\/images\/([\w.-]+\.(?:png|jpg|jpeg|gif|webp))$/.exec(decodeURIComponent(url.pathname));
      if (req.method === "GET" && imgMatch) {
        const file = path.join(specDir, "source", "images", imgMatch[1]);
        if (!fs.existsSync(file)) return json(res, 404, { error: "image not found" });
        const type = imgMatch[1].endsWith(".png") ? "image/png" : imgMatch[1].endsWith(".gif") ? "image/gif" : imgMatch[1].endsWith(".webp") ? "image/webp" : "image/jpeg";
        res.writeHead(200, { "Content-Type": type });
        res.end(fs.readFileSync(file));
        return;
      }
      // 草稿自动保存（decision_status 必须为 draft）
      if (req.method === "POST" && url.pathname === "/api/drafts") {
        const body = JSON.parse(await readBody(req));
        const stateFile = path.join(specDir, "reviews", "approval-state.json");
        const { state } = loadApprovalState(specDir);
        if (!state) return json(res, 500, { error: "approval-state.json 不存在，先运行 validate-decisions 或手工初始化" });
        state.drafts = state.drafts || {};
        if (body.remove) delete state.drafts[body.question_id];
        else {
          const draft = { ...body.draft, question_id: body.question_id, decision_status: "draft", reviewer: "human" };
          // 草稿是未定稿内容，只做轻校验（结构定稿在提交时全量校验）
          const outcomes = ["adopted", "modified", "rejected", "deferred"];
          if (draft.outcome && !outcomes.includes(draft.outcome)) {
            return json(res, 400, { error: `草稿 outcome 非法: ${draft.outcome}` });
          }
          state.drafts[body.question_id] = draft;
        }
        state.updated_at = new Date().toISOString();
        fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + "\n", "utf8");
        return json(res, 200, { ok: true, drafts: state.drafts });
      }
      // 提交正式裁决
      if (req.method === "POST" && url.pathname === "/api/decisions") {
        const body = JSON.parse(await readBody(req));
        const incoming = Array.isArray(body) ? body : body.decisions;
        if (!Array.isArray(incoming) || incoming.length === 0) return json(res, 400, { error: "缺少裁决记录" });
        const { questions } = loadOpenQuestions(specDir);
        const { decisions: existing } = loadDecisionLog(specDir);
        const now = new Date();
        const prepared = [];
        for (const d of incoming) {
          const q = questions.find((x) => x.id === d.question_id);
          if (!q) return json(res, 400, { error: `问题不存在: ${d.question_id}` });
          if (d.reviewer && d.reviewer !== "human") return json(res, 400, { error: "reviewer 必须为 human：AI 不允许代人工提交正式裁决" });
          prepared.push({
            decision_id: nextDecisionId(existing.concat(prepared)),
            question_id: d.question_id,
            decision_status: d.decision_status,
            outcome: d.outcome,
            final_decision: d.final_decision ?? null,
            rationale: d.rationale || "",
            reviewer: "human",
            decided_at: now.toISOString(),
            requirement_updates: d.requirement_updates ?? buildRequirementUpdates(q, d.outcome, d.sync_requirement !== false),
            related_question_ids: d.related_question_ids || [],
            supersedes: d.supersedes || null,
          });
        }
        const result = applyDecisions(specDir, prepared, { now });
        if (result.errors.length > 0) return json(res, 400, { error: "裁决未通过校验，未写入任何文件", errors: result.errors });
        // 成功后清除相关草稿
        const stateFile = path.join(specDir, "reviews", "approval-state.json");
        const { state } = loadApprovalState(specDir);
        if (state?.drafts) {
          const touched = new Set(prepared.flatMap((p) => [p.question_id, ...(p.related_question_ids || [])]));
          for (const qid of touched) delete state.drafts[qid];
          fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + "\n", "utf8");
        }
        const audit = auditDecisionLog(specDir);
        return json(res, 200, { ok: true, applied: prepared.length, progress: result.progress, audit: audit.result });
      }
      json(res, 404, { error: "not found" });
    } catch (e) {
      json(res, 500, { error: e.message });
    }
  });
  return server;
}

function main() {
  const { positional, port } = parseArgs(process.argv.slice(2));
  if (positional.length !== 1) {
    console.error("用法: node scripts/decision-workbench.mjs <game-spec 目录> [--port 8434]");
    process.exit(2);
  }
  const specDir = path.resolve(positional[0]);
  if (!fs.existsSync(path.join(specDir, "reviews", "open-questions.json"))) {
    console.error(`缺少 ${path.join(specDir, "reviews", "open-questions.json")}，先运行 review-requirements 产出未决问题`);
    process.exit(2);
  }
  const server = createServer(specDir, port);
  server.listen(port, "127.0.0.1", () => {
    console.log(`Decision Workbench: http://127.0.0.1:${port}/  (game-spec: ${specDir})`);
  });
}

// 测试与编程调用导出
export { createServer };
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
