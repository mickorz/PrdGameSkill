// 卡五星 HTML 通用冒烟测试（jsdom，不依赖游戏专用交互）
// 用法: node scripts/mahjong-smoke.test.mjs <输出目录>
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outDir = process.argv[2] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../examples/mahjong/output/interactive-game-prd");
const html = fs.readFileSync(path.join(outDir, "index.html"), "utf8");

let passed = 0;
let failed = 0;
function check(name, ok) {
  if (ok) { passed++; console.log("PASS: " + name); }
  else { failed++; console.log("FAIL: " + name); }
}

const dom = new JSDOM(html, { runScripts: "dangerously", url: "file://" + path.join(outDir, "index.html").split(path.sep).join("/") });
const { window } = dom;
const { document } = window;
window.Element.prototype.scrollIntoView = function () {};
window.requestAnimationFrame = window.requestAnimationFrame || ((fn) => setTimeout(fn, 0));
await new Promise((r) => setTimeout(r, 200));

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

check("标题渲染游戏名", /卡五星/.test(document.title + $("body").textContent.slice(0, 3000)));
check("五个工作区 Tab 存在（spec/decision/ui/flow/tests）", ["spec", "decision", "ui", "flow", "tests"].every((t) => $(`#tabs button[data-tab="${t}"]`)));

// ---------- 规格工作台（P0：分类导航，不再展开全部需求） ----------
check("规格工作台默认概述视图", $("#view").textContent.includes("游戏概述") && document.body.textContent.includes("OQ-001"));
check("分类导航渲染（五类 + 概述）", $$("#nav .cat-nav[data-cat]").length === 6);
check("分类数量动态统计（GAME-RULE 116 / GAME-UI 5）", (() => {
  const rule = $$("#nav .cat-nav[data-cat]").find((a) => a.dataset.cat === "GAME-RULE");
  const ui = $$("#nav .cat-nav[data-cat]").find((a) => a.dataset.cat === "GAME-UI");
  return rule && rule.textContent.includes("116") && ui && ui.textContent.includes("5");
})());
check("左侧不展开全部需求长列表", $$("#nav .cat-nav[data-cat]").every((a) => a.textContent.length < 40));
const ruleCat = $$("#nav .cat-nav[data-cat]").find((a) => a.dataset.cat === "GAME-RULE");
ruleCat.click();
await new Promise((r) => setTimeout(r, 50));
check("点击分类渲染该类需求（GAME-RULE 116 条）", $$(".req-card").length >= 116 && $("#view").textContent.includes("GAME-RULE-001"));
check("状态徽标渲染（proposed）", $$(".badge.st-proposed").length >= 50);
check("授权徽标渲染（fixed/open）", $$(".badge.au-fixed").length > 20 && $$(".badge.au-open").length > 0);
const firstCard = $$(".req-card[data-anchor^='GAME-']").find((c) => c.dataset.anchor === "GAME-RULE-003");
if (firstCard) firstCard.click();
await new Promise((r) => setTimeout(r, 30));
check("点击需求卡片右侧详情渲染", $("#detail").textContent.includes("GAME-RULE-003"));
check("配置分类渲染（GAME-CFG-001）", (() => {
  const cfg = $$("#nav .cat-nav[data-cat]").find((a) => a.dataset.cat === "GAME-CFG");
  if (!cfg) return false;
  cfg.click();
  return true;
})());
await new Promise((r) => setTimeout(r, 50));
check("点击配置分类渲染 28 条配置", $$(".req-card").length >= 28 && $("#view").textContent.includes("GAME-CFG-001"));
check("数据内嵌无外链 fetch", !/fetch\(|XMLHttpRequest/.test(html.replace(/simulator\.code/, "")) || !window.__anyFetch);
check("页面无致命脚本错误", !(window.__jsErrorCount > 0));

// 标签页切换后验证 UI 懒渲染
$(`#tabs button[data-tab="ui"]`).click();
await new Promise((r) => setTimeout(r, 50));
check("切到 UI Demo 标签页", $("#view").textContent.length > 0 && $("#view").style.display !== "none");
check("UI 页面渲染（5 页 20 组件）", $$('[data-component-id]').length >= 20 && document.body.textContent.includes("对局桌面"));

// 模拟器注入与交互（Level 2 规则驱动）
check("模拟器已注入（MiniGameFactory）", typeof window.MiniGameFactory === "object" || typeof window.MiniGameFactory === "function");
const simArea = $("#ui-area");
if (simArea) {
  const btns = [...simArea.querySelectorAll("button")];
  check("模拟器操作按钮渲染（碰杠亮胡过）", btns.length >= 5);
  const drawBtn = btns.find((b) => b.textContent.includes("摸牌"));
  const settleBtn = btns.find((b) => b.textContent.includes("总结算"));
  if (drawBtn) { drawBtn.click(); await new Promise((r) => setTimeout(r, 30)); }
  check("模拟器摸牌交互生效", simArea.innerHTML !== "" && simArea.textContent.includes("P1"));
  if (settleBtn) {
    settleBtn.click();
    await new Promise((r) => setTimeout(r, 30));
    check("未确认规则触发 RULE_NOT_CONFIRMED 提示", document.body.textContent.includes("RULE_NOT_CONFIRMED"));
  }
} else {
  check("模拟器区域存在", false);
}

// ---------- 裁决工作台（P0：独立布局，统计+筛选+三栏+底部操作栏） ----------
document.querySelector('#tabs button[data-tab="decision"]').click();
await new Promise((r) => setTimeout(r, 50));
check("裁决工作台独立布局（隐藏规格导航）", document.body.classList.contains("ws-decision") && /body\.ws-decision nav,\s*body\.ws-decision aside\s*\{\s*display:\s*none/.test(html));
check("裁决统计渲染（合并三来源：待裁决 28 草稿 3）", (() => {
  const s = $(".dec-stats");
  return s && s.textContent.includes("全部 31") && s.textContent.includes("待裁决 28") && s.textContent.includes("草稿 3") && s.textContent.includes("已确认 0");
})());
check("裁决筛选器渲染（状态/严重度/关键词）", $("#df-status-filter") && $("#df-severity-filter") && $("#df-keyword"));
check("裁决 Tab 渲染 31 项 OQ", $$(".dec-item").length === 31);
check("OQ-002 草稿预填与影响预览（GAME-RULE-005）", (() => {
  const a = $$(".dec-item").find((x) => x.dataset.oq === "OQ-002");
  if (!a) return false;
  a.click();
  return true;
})() && $("#dec-impact").textContent.includes("GAME-RULE-005"));
$$(".dec-item")[0].click();
await new Promise((r) => setTimeout(r, 30));
check("OQ 详情与关联需求渲染（GAME-RULE-003）", $("#dec-main").textContent.includes("GAME-RULE-003") && $("#df-rationale") !== null);
check("底部操作栏渲染（上/下/暂存/正式）", ["dec-prev", "dec-next", "dec-draft", "dec-confirm"].every((id) => $("#" + id)));
$("#df-rationale").value = "人工确认测试裁决口径";
$("#dec-confirm").click();
await new Promise((r) => setTimeout(r, 50));
check("正式裁决内存生效（已确认 1）", $(".dec-stats").textContent.includes("已确认 1") && $$(".dv-approved").length >= 1);
check("正式裁决后自动定位下一个待裁决", !$("#dec-main h3").textContent.startsWith("OQ-001"));
const exported = window.__exportDecisionsData();
check("导出数据为 apply-decisions 输入格式", Array.isArray(exported) && exported.length === 1 &&
  exported[0].question_id === "OQ-001" && exported[0].reviewer === "human" &&
  exported[0].decision_status === "approved" && exported[0].outcome === "modified" &&
  /^DEC-\d{3}$/.test(exported[0].decision_id) && typeof exported[0].decided_at === "string" &&
  exported[0].rationale.length > 0 && Array.isArray(exported[0].requirement_updates) &&
  exported[0].affected.requirements.includes("GAME-RULE-003"));
// 筛选只重渲染列表，不清空中栏
$("#df-keyword").value = "OQ-002";
$("#df-keyword").dispatchEvent(new window.Event("input", { bubbles: true }));
await new Promise((r) => setTimeout(r, 30));
check("关键词筛选生效（列表收窄）", $$(".dec-item").length < 31 && $$(".dec-item").every((a) => a.dataset.oq.includes("OQ-002")));
check("切回规格工作台恢复导航", (() => {
  document.querySelector('#tabs button[data-tab="spec"]').click();
  return true;
})() && !document.body.classList.contains("ws-decision") && $$("#nav .cat-nav[data-cat]").length === 6);

console.log("\n结果: " + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
