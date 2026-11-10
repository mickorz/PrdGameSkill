// Decision Workbench 核心库：裁决记录的校验、应用与审计（P6-A）
// 被 apply-decisions.mjs / validate-decisions.mjs / decision.test.mjs 共用。
// 职责边界：只操作 game-spec/reviews/ 下的三个文件，不写 IR（IR 写回属 P6-C）。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const SCHEMAS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "schemas");

// 与 validate-ir 保持一致的合法 IR 状态流转（approved->rejected 与 rejected->approved 支持人工重裁决翻案）
export const LEGAL_TRANSITIONS = new Set([
  "proposed->approved", "proposed->rejected", "rejected->proposed",
  "approved->deprecated", "rejected->deprecated",
  "approved->rejected", "rejected->approved",
]);

const OUTCOME_BY_STATUS = {
  approved: new Set(["adopted", "modified"]),
  rejected: new Set(["rejected"]),
  deferred: new Set(["deferred"]),
};

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function makeAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  for (const name of ["decision.schema.json", "approval-state.schema.json"]) {
    ajv.addSchema(loadJson(path.join(SCHEMAS_DIR, name)), name);
  }
  return ajv;
}

// ---------- 读取与归一化 ----------

// open-questions.json 是数组：[{id, requirement_id|null, question, severity, status}]
export function loadOpenQuestions(specDir) {
  const file = path.join(specDir, "reviews", "open-questions.json");
  const data = loadJson(file);
  if (!Array.isArray(data)) throw new Error(`open-questions.json 应为数组: ${file}`);
  return { file, questions: data };
}

// decision-log.json 兼容两种形态：裸数组（旧）与 {decisions:[...]} 包装（新）
export function loadDecisionLog(specDir) {
  const file = path.join(specDir, "reviews", "decision-log.json");
  let data = [];
  if (fs.existsSync(file)) data = loadJson(file);
  const decisions = Array.isArray(data) ? data : data.decisions || [];
  return { file, decisions };
}

export function loadApprovalState(specDir) {
  const file = path.join(specDir, "reviews", "approval-state.json");
  return { file, state: fs.existsSync(file) ? loadJson(file) : null };
}

// 扫描 IR yaml 中的条目 id（正则粗扫，避免完整解析）
export function loadRequirementIds(specDir) {
  const ids = new Set();
  const roots = ["requirements", "ui", "data", "tests", "game"]
    .map((d) => path.join(specDir, d))
    .filter((d) => fs.existsSync(d));
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(yaml|yml)$/.test(name)) {
        const text = fs.readFileSync(p, "utf8");
        for (const m of text.matchAll(/^\s*id:\s*(GAME-[A-Z]+-[0-9]{3,4})\s*$/gm)) ids.add(m[1]);
      }
    }
  };
  for (const root of roots) walk(root);
  return ids;
}

// 从 open-questions 计算 progress
export function computeProgress(questions) {
  const p = { total: questions.length, approved: 0, rejected: 0, deferred: 0, open: 0 };
  for (const q of questions) {
    if (q.status === "approved" || q.status === "modified") p.approved++;
    else if (q.status === "rejected") p.rejected++;
    else if (q.status === "deferred") p.deferred++;
    else p.open++;
  }
  return p;
}

// 某问题的当前有效裁决 = 列表中最后一条覆盖它的记录（历史只追加，末尾即最新）
export function effectiveDecisionFor(decisions, questionId) {
  let found = null;
  for (const d of decisions) {
    const covers = d.question_id === questionId || (d.related_question_ids || []).includes(questionId);
    if (covers) found = d;
  }
  return found;
}

// ---------- 单条裁决校验（应用时序：针对"即将追加"的记录） ----------
// ctx: {questionsById, decisions(已存在的日志), requirementIds}
export function validateIncomingDecision(decision, ajv, ctx) {
  const errors = [];
  const validate = ajv.getSchema("decision.schema.json");
  if (!validate(decision)) {
    for (const e of validate.errors) errors.push(`Schema: ${e.instancePath || "/"} ${e.message}`);
    return errors; // 结构不合法时不再做语义检查
  }
  const { questionsById, decisions, requirementIds } = ctx;

  if (decision.decision_status === "draft") errors.push("draft 草稿不允许写入 decision-log（草稿只存 approval-state.json）");

  const allowed = OUTCOME_BY_STATUS[decision.decision_status];
  if (allowed && !allowed.has(decision.outcome)) {
    errors.push(`decision_status=${decision.decision_status} 与 outcome=${decision.outcome} 不匹配`);
  }

  if (!questionsById.has(decision.question_id)) errors.push(`问题不存在: ${decision.question_id}`);

  // 重复裁决必须声明 supersedes 指向当前有效记录
  const effective = effectiveDecisionFor(decisions, decision.question_id);
  if (effective) {
    if (!decision.supersedes) {
      errors.push(`${decision.question_id} 已有有效裁决 ${effective.decision_id}，重新裁决必须在 supersedes 中声明`);
    } else if (decision.supersedes !== effective.decision_id) {
      errors.push(`supersedes=${decision.supersedes} 不是 ${decision.question_id} 的当前有效裁决 ${effective.decision_id}`);
    }
  } else if (decision.supersedes) {
    errors.push(`${decision.question_id} 尚无历史裁决，不允许声明 supersedes`);
  }

  if (decisions.some((d) => d.decision_id === decision.decision_id)) {
    errors.push(`decision_id 重复: ${decision.decision_id}`);
  }

  for (const rid of decision.related_question_ids || []) {
    if (!questionsById.has(rid)) errors.push(`关联问题不存在: ${rid}`);
  }

  for (const u of decision.requirement_updates || []) {
    const key = `${u.from}->${u.to}`;
    if (u.field === "status" && !LEGAL_TRANSITIONS.has(key)) {
      errors.push(`非法状态流转 ${key}（${u.requirement_id}）`);
    }
    if (requirementIds.size > 0 && !requirementIds.has(u.requirement_id)) {
      errors.push(`requirement_updates 引用的条目不存在: ${u.requirement_id}`);
    }
  }

  return errors;
}

// ---------- 应用裁决 ----------
// incoming: 裁决记录数组（人工确认过的），按序追加。同批内重复裁决会按追加后的日志逐条校验。
// 返回 {errors, changes, progress}；errors 非空时不落盘。
export function applyDecisions(specDir, incoming, { dryRun = false, now = new Date() } = {}) {
  const ajv = makeAjv();
  const { file: oqFile, questions } = loadOpenQuestions(specDir);
  const { file: logFile, decisions: existing } = loadDecisionLog(specDir);
  const questionsById = new Map(questions.map((q) => [q.id, q]));
  const requirementIds = loadRequirementIds(specDir);

  const errors = [];
  const pending = [...existing];
  for (const d of incoming) {
    const errs = validateIncomingDecision(d, ajv, { questionsById, decisions: pending, requirementIds });
    errors.push(...errs.map((msg) => `${d.decision_id || "(无 id)"}: ${msg}`));
    if (errs.length === 0) pending.push(d); // 同批内链式重裁决：前一条通过后即可被 supersedes 引用
  }
  if (errors.length > 0) return { errors, changes: [] };

  // 计划写入内容
  const touchedIds = new Set();
  for (const d of incoming) {
    touchedIds.add(d.question_id);
    for (const rid of d.related_question_ids || []) touchedIds.add(rid);
  }
  const newQuestions = questions.map((q) => {
    if (!touchedIds.has(q.id)) return q;
    const eff = effectiveDecisionFor(pending, q.id);
    return { ...q, status: eff.decision_status, decision_id: eff.decision_id };
  });
  const nextState = {
    game: existingGameName(specDir),
    updated_at: now.toISOString(),
    progress: computeProgress(newQuestions),
    last_position: { question_id: [...touchedIds].at(-1), updated_at: now.toISOString() },
    drafts: loadApprovalState(specDir).state?.drafts || {},
  };

  const changes = [
    { file: logFile, action: `追加裁决记录 x${incoming.length}` },
    { file: oqFile, action: `更新问题状态 x${touchedIds.size}` },
    { file: path.join(specDir, "reviews", "approval-state.json"), action: "刷新进度与位置" },
  ];

  if (!dryRun) {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.writeFileSync(logFile, JSON.stringify({ decisions: pending }, null, 2) + "\n", "utf8");
    fs.writeFileSync(oqFile, JSON.stringify(newQuestions, null, 2) + "\n", "utf8");
    fs.writeFileSync(path.join(specDir, "reviews", "approval-state.json"), JSON.stringify(nextState, null, 2) + "\n", "utf8");
  }
  return { errors: [], changes, progress: nextState.progress };
}

function existingGameName(specDir) {
  try {
    const manifest = fs.readFileSync(path.join(specDir, "manifest.yaml"), "utf8");
    const m = manifest.match(/^game_name:\s*["']?([^"'\n]+)["']?\s*$/m);
    return m ? m[1].trim() : "未知游戏";
  } catch {
    return "未知游戏";
  }
}

// ---------- 审计（对已落盘数据做一致性核对） ----------

export function auditDecisionLog(specDir) {
  const ajv = makeAjv();
  const errors = [];
  const warnings = [];
  const { questions } = loadOpenQuestions(specDir);
  const { decisions } = loadDecisionLog(specDir);
  const { state } = loadApprovalState(specDir);
  const questionsById = new Map(questions.map((q) => [q.id, q]));
  const requirementIds = loadRequirementIds(specDir);

  const validate = ajv.getSchema("decision.schema.json");
  const seenIds = new Set();
  const logIndexById = new Map();
  let prevAt = null;
  for (const [idx, d] of decisions.entries()) {
    if (!validate(d)) {
      for (const e of validate.errors) errors.push(`${d.decision_id || "(无 id)"}: Schema: ${e.instancePath || "/"} ${e.message}`);
    } else {
      const allowed = OUTCOME_BY_STATUS[d.decision_status];
      if (!allowed.has(d.outcome)) errors.push(`${d.decision_id}: decision_status=${d.decision_status} 与 outcome=${d.outcome} 不匹配`);
      if (d.decision_status === "draft") errors.push(`${d.decision_id}: draft 不允许出现在 decision-log`);
      if (!questionsById.has(d.question_id)) errors.push(`${d.decision_id}: 问题不存在: ${d.question_id}`);
      for (const rid of d.related_question_ids || []) {
        if (!questionsById.has(rid)) errors.push(`${d.decision_id}: 关联问题不存在: ${rid}`);
      }
      for (const u of d.requirement_updates || []) {
        const key = `${u.from}->${u.to}`;
        if (u.field === "status" && !LEGAL_TRANSITIONS.has(key)) errors.push(`${d.decision_id}: 非法状态流转 ${key}（${u.requirement_id}）`);
        if (requirementIds.size > 0 && !requirementIds.has(u.requirement_id)) errors.push(`${d.decision_id}: requirement_updates 引用的条目不存在: ${u.requirement_id}`);
      }
      if (d.supersedes && !logIndexById.has(d.supersedes)) errors.push(`${d.decision_id}: supersedes 指向不存在的记录 ${d.supersedes}`);
    }
    if (seenIds.has(d.decision_id)) errors.push(`${d.decision_id}: decision_id 重复`);
    seenIds.add(d.decision_id);
    logIndexById.set(d.decision_id, idx);
    if (prevAt && d.decided_at < prevAt) warnings.push(`${d.decision_id}: decided_at 早于上一条记录，追加顺序与时间顺序不一致`);
    prevAt = d.decided_at;
  }

  // 同一问题的多次裁决：后一条必须 supersedes 前一条
  const coverage = new Map();
  for (const d of decisions) {
    for (const qid of [d.question_id, ...(d.related_question_ids || [])]) {
      const prev = coverage.get(qid);
      if (prev && d.supersedes !== prev.decision_id) {
        errors.push(`${d.decision_id}: ${qid} 第 ${coverage.size} 次裁决未正确声明 supersedes=${prev.decision_id}`);
      }
      coverage.set(qid, d);
    }
  }

  // 问题状态与有效裁决一致
  for (const q of questions) {
    const eff = effectiveDecisionFor(decisions, q.id);
    if (eff && q.status !== eff.decision_status) {
      errors.push(`${q.id}: status=${q.status} 与有效裁决 ${eff.decision_id}(${eff.decision_status}) 不一致`);
    }
    if (q.decision_id && !seenIds.has(q.decision_id)) {
      errors.push(`${q.id}: decision_id=${q.decision_id} 在 decision-log 中不存在`);
    }
  }

  // approval-state 与重算 progress 一致
  const progress = computeProgress(questions);
  if (state) {
    for (const k of Object.keys(progress)) {
      if (state.progress?.[k] !== progress[k]) {
        errors.push(`approval-state.progress.${k}=${state.progress?.[k]} 与实际 ${progress[k]} 不一致`);
      }
    }
  }

  return { result: errors.length === 0 ? "pass" : "fail", progress, errors, warnings };
}
