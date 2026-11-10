// 卡五星 HTML 通用冒烟测试（jsdom，不依赖游戏专用交互）
// 用法: node scripts/mahjong-smoke.test.mjs <输出目录>
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outDir = process.argv[2] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../examples/mahjong/output/interactive-game-prd");
let html = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
// P2 多选模式测试：仅测试内存中给 OQ-003 注入 decision_options（不改真实 game-spec 数据）
const MULTI_INJECT = '"decision_options":{"selection_mode":"multi","min_selections":1,"max_selections":2,"options":[' +
  '{"id":"keep_cfg","label":"保留配置开关","description":"按需求原文保留可配置开关","action":"adopted"},' +
  '{"id":"add_cfg","label":"补充开关默认值","description":"人工补充开关名与默认值","action":"adopted","requires_input":true,"input_label":"开关名与默认值"},' +
  '{"id":"drop_cfg","label":"取消该配置项","description":"删除该规则约束","action":"rejected","requires_input":true,"input_label":"删除原因"}]}';
if (html.includes('"id":"OQ-003","requirement_id"')) {
  html = html.replace('"id":"OQ-003","requirement_id"', '"id":"OQ-003",' + MULTI_INJECT + ',"requirement_id"');
}

let passed = 0;
let failed = 0;
function check(name, ok) {
  if (ok) { passed++; console.log("PASS: " + name); }
  else { failed++; console.log("FAIL: " + name); }
}

// 注：url 用 https（jsdom 对 file:// 视为 opaque origin 禁 localStorage；真实 Chrome file:// 下 localStorage 可用，页面侧已有降级处理）
const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://localhost/index.html" });
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
check("规则分组头渲染（按来源文档）", $$("#view .group-head").length >= 5);
const firstCard = $$(".req-card[data-anchor^='GAME-']").find((c) => c.dataset.anchor === "GAME-RULE-003");
if (firstCard) firstCard.click();
await new Promise((r) => setTimeout(r, 30));
check("点击需求卡片右侧详情渲染", $("#detail").textContent.includes("GAME-RULE-003"));
// 功能需求分类：搜索与筛选工具条
const frCat = $$("#nav .cat-nav[data-cat]").find((a) => a.dataset.cat === "GAME-FR");
if (frCat) frCat.click();
await new Promise((r) => setTimeout(r, 50));
check("功能需求分类渲染（15 条 + 工具条）", $$("#view .req-card").length >= 15 && !!$("#spec-kw") && !!$("#spec-status") && !!$("#spec-authority"));
$("#spec-kw").value = "亮牌";
$("#spec-kw").dispatchEvent(new window.Event("input", { bubbles: true }));
await new Promise((r) => setTimeout(r, 30));
check("搜索筛选生效（列表收窄）", $$("#spec-body .req-card").length < 15 && $("#spec-count").textContent.includes("/ 15"));
$("#spec-status").value = "proposed";
$("#spec-status").dispatchEvent(new window.Event("change", { bubbles: true }));
await new Promise((r) => setTimeout(r, 30));
check("状态筛选不报错（与搜索叠加）", !!$("#spec-count"));
const stateCat = $$("#nav .cat-nav[data-cat]").find((a) => a.dataset.cat === "GAME-STATE");
if (stateCat) stateCat.click();
await new Promise((r) => setTimeout(r, 50));
check("状态机分类渲染（3 台 + 跳 Flow 按钮）", $$("#view .req-card").length >= 3 && !!$("#view [data-goto-flow]"));
const uiCat = $$("#nav .cat-nav[data-cat]").find((a) => a.dataset.cat === "GAME-UI");
if (uiCat) uiCat.click();
await new Promise((r) => setTimeout(r, 50));
check("UI 分类页面分组与组件行渲染", $$("#view [data-page]").length >= 5 && $$("#view .comp-row").length >= 15);
check("组件行含类型徽标与关联需求数", $$("#view .comp-row .badge").length >= 15 && $("#view .comp-row").textContent.includes("关联需求"));
const compRow = $$("#view .comp-row")[0];
if (compRow) compRow.click();
await new Promise((r) => setTimeout(r, 30));
check("点击组件行右侧详情（含关联需求）", $("#detail").textContent.includes("GAME-"));
check("组件详情含所属页面与事件字段", $("#detail").textContent.includes("所属页面") && $("#detail").textContent.includes("GAME-UI-"));
check("配置分类渲染（GAME-CFG-001）", (() => {
  const cfg = $$("#nav .cat-nav[data-cat]").find((a) => a.dataset.cat === "GAME-CFG");
  if (!cfg) return false;
  cfg.click();
  return true;
})());
await new Promise((r) => setTimeout(r, 50));
check("点击配置分类渲染配置表格（28 行）", $$(".cfg-table tr[data-req-row]").length >= 28 && $("#view").textContent.includes("GAME-CFG-001"));
const cfgRow = $$(".cfg-table tr[data-req-row]").find((tr) => tr.dataset.reqRow === "GAME-CFG-001");
if (cfgRow) cfgRow.click();
await new Promise((r) => setTimeout(r, 30));
check("点击配置行右侧详情渲染", $("#detail").textContent.includes("GAME-CFG-001"));
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

// ---------- UI Demo 页面切换与组件清单（todo: UI 组件浏览增强） ----------
check("UI Demo 页面切换器渲染（5 页）", $$("[data-ui-page]").length === 5);
check("UI Demo 当前页组件清单渲染（chips）", $$("[data-comp-focus]").length >= 3);
const page2Btn = $$("[data-ui-page]")[1];
if (page2Btn) page2Btn.click();
await new Promise((r) => setTimeout(r, 50));
check("切换页面渲染对应静态原型（GAME-UI-002）", $("#view h3").textContent.includes("GAME-UI-002") && !!$("#ui-area [data-component-id]"));
const chip = $$("[data-comp-focus]")[0];
if (chip) chip.click();
await new Promise((r) => setTimeout(r, 30));
check("点击组件 chip 定位原型元素", !!document.querySelector("#ui-area .comp-focus-highlight") || $("#ui-msg").textContent.includes("已定位"));
// 切回第一页恢复模拟器
const page1Btn = $$("[data-ui-page]")[0];
if (page1Btn) page1Btn.click();
await new Promise((r) => setTimeout(r, 50));
check("切回对局主页面恢复模拟器", $$("#ui-area button").length >= 5);

// ---------- 裁决工作台（P2：候选方案卡片 + 单选/多选 + 草稿自动暂存） ----------
document.querySelector('#tabs button[data-tab="decision"]').click();
await new Promise((r) => setTimeout(r, 50));
check("裁决工作台独立布局（隐藏规格导航）", document.body.classList.contains("ws-decision") && /body\.ws-decision nav,\s*body\.ws-decision aside\s*\{\s*display:\s*none/.test(html));
// 裁决草稿浏览器本地持久化读取（P1：localStorage 键按游戏维度隔离）
const lsDrafts = () => JSON.parse(window.localStorage.getItem("igp-decision-drafts:卡五星（好友房）") || "{}");
check("裁决统计渲染（合并三来源：待裁决 28 草稿 3）", (() => {
  const s = $(".dec-stats");
  return s && s.textContent.includes("全部 31") && s.textContent.includes("待裁决 28") && s.textContent.includes("草稿 3") && s.textContent.includes("已确认 0");
})());
check("裁决筛选器渲染（状态/严重度/关键词）", $("#df-status-filter") && $("#df-severity-filter") && $("#df-keyword"));
check("裁决 Tab 渲染 31 项 OQ", $$(".dec-item").length === 31);
check("OQ-002 草稿预填（通用选项采纳预选）与影响预览", (() => {
  const a = $$(".dec-item").find((x) => x.dataset.oq === "OQ-002");
  if (!a) return false;
  a.click();
  return true;
})() && !!$("#dec-main .opt-card.selected") && $("#dec-impact").textContent.includes("GAME-RULE-005"));
$$(".dec-item")[0].click();
await new Promise((r) => setTimeout(r, 30));
check("OQ-001 草稿预填（修改选项预选 + 口径输入区）", !!$("#dec-main .opt-card[data-opt='modify'].selected") && !!$("#dec-main [data-opt-input='modify']"));
check("底部操作栏渲染（上/下/暂存/正式）", ["dec-prev", "dec-next", "dec-draft", "dec-confirm"].every((id) => $("#" + id)));
// 未填口径时正式裁决被拦截
$("#dec-confirm").click();
await new Promise((r) => setTimeout(r, 30));
check("正式裁决校验（修改方案需填口径）", $("#dec-msg").textContent.includes("需填写"));
$("#dec-main [data-opt-input='modify']").value = "最终口径人工确认";
$("#dec-confirm").click();
await new Promise((r) => setTimeout(r, 30));
check("正式裁决校验（必须填写理由）", $("#dec-msg").textContent.includes("理由"));
$("#df-rationale").value = "人工确认测试裁决口径";
$("#dec-confirm").click();
await new Promise((r) => setTimeout(r, 50));
check("正式裁决内存生效（已确认 1）", $(".dec-stats").textContent.includes("已确认 1") && $$(".dv-approved").length >= 1);
check("正式裁决后自动定位下一个待裁决", !$("#dec-main h3").textContent.startsWith("OQ-001"));
check("正式裁决后本地草稿已清理", !((lsDrafts && lsDrafts()["OQ-001"]) || null));
// 切换问题草稿不丢：OQ-004 填一半 -> 切 OQ-005 -> 回 OQ-004 恢复
const oq4 = $$(".dec-item").find((x) => x.dataset.oq === "OQ-004");
if (oq4) oq4.click();
await new Promise((r) => setTimeout(r, 30));
$("#df-rationale").value = "切换暂存的草稿理由";
const oq5 = $$(".dec-item").find((x) => x.dataset.oq === "OQ-005");
if (oq5) oq5.click();
await new Promise((r) => setTimeout(r, 30));
if (oq4) oq4.click();
await new Promise((r) => setTimeout(r, 30));
check("切换问题不丢草稿（自动暂存恢复）", $("#df-rationale").value === "切换暂存的草稿理由");
// 草稿已自动保存到浏览器本地（localStorage；草稿永不进导出）
check("草稿已自动保存到浏览器本地（localStorage）", (() => {
  const all = lsDrafts();
  return !!all["OQ-004"] && all["OQ-004"].form.rationale === "切换暂存的草稿理由" && !!all["OQ-004"].savedAt;
})());
// 模拟刷新（内存 stash 与选中清空），验证从 localStorage 恢复
window.eval("decisionState.stash = {}; decisionState.selectedOqId = null;");
const oq4b = $$(".dec-item").find((x) => x.dataset.oq === "OQ-004");
if (oq4b) oq4b.click();
await new Promise((r) => setTimeout(r, 30));
check("刷新后从浏览器本地恢复草稿", $("#df-rationale").value === "切换暂存的草稿理由" && $("#dec-draft-status").textContent.includes("已恢复"));
// 多选模式（OQ-003 注入 decision_options）
const oq3 = $$(".dec-item").find((x) => x.dataset.oq === "OQ-003");
if (oq3) oq3.click();
await new Promise((r) => setTimeout(r, 30));
check("OQ 专属候选方案渲染（多选三方案）", $$("#dec-main .opt-card").length === 3 && $("#dec-main").textContent.includes("多选"));
const cb1 = $("#dec-main .opt-card[data-opt='keep_cfg'] input");
const cb2 = $("#dec-main .opt-card[data-opt='add_cfg'] input");
const cb3 = $("#dec-main .opt-card[data-opt='drop_cfg'] input");
if (cb1) cb1.click();
if (cb2) cb2.click();
await new Promise((r) => setTimeout(r, 30));
check("多选可选多项（两项选中）", $$("#dec-main .opt-card.selected").length === 2 && !!$("#dec-main [data-opt-input='add_cfg']"));
if (cb3) cb3.click();
await new Promise((r) => setTimeout(r, 30));
check("多选上限约束（第三项被拒绝）", !cb3.checked && $("#dec-msg").textContent.includes("最多选择 2 项"));
// 混合结论拦截（采纳 + 取消 组合不被一问一裁契约接受）
if (cb1) cb1.click();
if (cb3) cb3.click();
await new Promise((r) => setTimeout(r, 30));
$("#df-rationale").value = "混合结论测试";
$("#dec-confirm").click();
await new Promise((r) => setTimeout(r, 30));
check("多选混合结论被拦截（需同结论）", $("#dec-msg").textContent.includes("同结论"));
if (cb3) cb3.click();
if (cb1) cb1.click();
await new Promise((r) => setTimeout(r, 30));
$("#df-rationale").value = "多选裁决测试";
$("#dec-confirm").click();
await new Promise((r) => setTimeout(r, 30));
check("多选正式裁决校验（需填口径的选项拦截）", $("#dec-msg").textContent.includes("需填写"));
$("#dec-main [data-opt-input='add_cfg']").value = "开关名 = hand_return_gang，默认关";
$("#dec-confirm").click();
await new Promise((r) => setTimeout(r, 50));
const exported = window.__exportDecisionsData();
check("导出数据为 apply-decisions 输入格式（多选同结论合并单记录）", Array.isArray(exported) && exported.length === 2 &&
  exported[0].question_id === "OQ-001" && exported[0].reviewer === "human" &&
  exported[0].decision_status === "approved" && exported[0].outcome === "modified" &&
  exported[0].final_decision && exported[0].final_decision.text === "最终口径人工确认" &&
  !("selected_option_ids" in exported[0]) && !("selection_mode" in exported[0]) &&
  /^DEC-\d{3}$/.test(exported[0].decision_id) && typeof exported[0].decided_at === "string" &&
  exported[0].rationale.length > 0 && Array.isArray(exported[0].requirement_updates) &&
  exported[0].affected.requirements.includes("GAME-RULE-003") &&
  exported[1].question_id === "OQ-003" && exported[1].outcome === "adopted" &&
  exported[1].final_decision && exported[1].final_decision.text.includes("保留配置开关") && exported[1].final_decision.text.includes("开关名 = hand_return_gang"));
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
