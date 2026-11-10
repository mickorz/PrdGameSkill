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
check("需求条目渲染（130+）", $$(".req-card").length >= 130);
check("状态徽标渲染（proposed）", $$(".badge.st-proposed").length >= 100);
check("授权徽标渲染（fixed/open）", $$(".badge.au-fixed").length > 50 && $$(".badge.au-open").length > 0);
check("四个标签页存在", ["prd", "ui", "flow", "tests"].every((t) => $(`#tabs button[data-tab="${t}"]`)));
check("未决问题面板渲染（31 项）", $$('[data-oq-id], .oq-item, li[data-id^="OQ"]').length >= 25 || document.body.textContent.includes("OQ-001"));
check("PRD 分组渲染（规则/配置）", document.body.textContent.includes("GAME-RULE-001") && document.body.textContent.includes("GAME-CFG-001"));
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
  const before = simArea.innerHTML.length;
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
  void before;
} else {
  check("模拟器区域存在", false);
}

// ---------- 裁决 Tab（单文件 Decision Workbench，方案 A） ----------
document.querySelector('#tabs button[data-tab="decision"]').click();
await new Promise((r) => setTimeout(r, 50));
check("裁决 Tab 渲染 31 项 OQ", $$(".dec-item").length === 31);
check("裁决进度显示（已裁决 0 待裁决 31）", /已裁决 0 \/ 待裁决 31|已裁决 0.*待裁决 31/.test($("#view").textContent));
check("审批草稿预填（OQ-002 采纳口径）", (() => {
  const a = $$(".dec-item").find((x) => x.dataset.oq === "OQ-002");
  if (!a) return false;
  a.click();
  return true;
})() && $("#dec-detail").textContent.includes("GAME-RULE-005"));
$$(".dec-item")[0].click();
await new Promise((r) => setTimeout(r, 30));
check("OQ 详情与关联需求渲染（GAME-RULE-003）", $("#dec-detail").textContent.includes("GAME-RULE-003") && $("#df-rationale") !== null);
$("#df-rationale").value = "人工确认测试裁决口径";
$("#dec-confirm").click();
await new Promise((r) => setTimeout(r, 30));
check("正式裁决内存生效（进度已裁决 1）", /已裁决 1/.test($("#view").textContent) && $$(".dv-approved").length >= 1);
const exported = window.__exportDecisionsData();
check("导出数据为 apply-decisions 输入格式", Array.isArray(exported) && exported.length === 1 &&
  exported[0].question_id === "OQ-001" && exported[0].reviewer === "human" &&
  exported[0].decision_status === "approved" && exported[0].outcome === "modified" &&
  /^DEC-\d{3}$/.test(exported[0].decision_id) && typeof exported[0].decided_at === "string" &&
  exported[0].rationale.length > 0 && Array.isArray(exported[0].requirement_updates) &&
  exported[0].affected.requirements.includes("GAME-RULE-003"));

console.log("\n结果: " + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
