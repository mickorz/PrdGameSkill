// Interactive HTML PRD 冒烟测试（P3 验收：核心导航和交互可运行）
// 用法: node scripts/html-smoke.test.mjs <output 目录>
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] || path.resolve(SCRIPT_DIR, "../../../../examples/mini-game/output/interactive-game-prd");
const html = fs.readFileSync(path.join(outDir, "index.html"), "utf8");

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log("PASS: " + name); }
  else { failed++; console.log("FAIL: " + name); }
}

const dom = new JSDOM(html, { runScripts: "dangerously", url: "file://" + path.resolve(outDir, "index.html") });
const { window } = dom;
const { document } = window;
// jsdom 未实现 scrollIntoView
window.Element.prototype.scrollIntoView = function () {};
window.requestAnimationFrame = window.requestAnimationFrame || ((fn) => setTimeout(fn, 0));

// 等同步脚本执行完成
await new Promise((r) => setTimeout(r, 100));

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

check("游戏标题渲染", document.getElementById("game-title").textContent === "记忆翻牌");
check("五个工作区 Tab 存在", ["spec", "decision", "ui", "flow", "tests"].every((t) => $(`#tabs button[data-tab="${t}"]`)));
check("左侧分类导航渲染（概述 + 五类）", $$("#nav .cat-nav[data-cat]").length === 6);
check("概述视图默认渲染（未决问题区）", !!document.querySelector('[data-anchor="__openq__"]'));

// 规格工作台：分类切换渲染
const ruleCat = $$("#nav .cat-nav[data-cat]").find((a) => a.dataset.cat === "GAME-RULE");
if (ruleCat) ruleCat.click();
await new Promise((r) => setTimeout(r, 50));
check("点击分类渲染需求卡片（GAME-RULE）", $$("#view .req-card").length >= 2 && $("#view").textContent.includes("GAME-RULE-001"));
check("状态徽标渲染（proposed）", !!document.querySelector("#view .st-proposed"));
check("权限徽标渲染（authority）", !!document.querySelector('#view .req-card span[class*="au-"]'));

// Tab 切换：UI Demo
document.querySelector('#tabs button[data-tab="ui"]').click();
check("UI Demo 视图渲染模拟器牌桌", document.querySelectorAll("#view .card-el").length === 8);
check("UI 组件带 data-component-id", !!document.querySelector('[data-component-id="GAME-COMP-001"]'));
check("模拟器判定日志面板开启", document.getElementById("log").style.display === "block");

// 模拟器交互：点击一张牌（RULE-001 翻开）
document.querySelector("#view .card-el").click();
const newCards = document.querySelectorAll("#view .card-el");
check("点击牌后翻面（face-up）", newCards[0].className.includes("face-up"));
check("判定日志输出 RULE 引用", document.getElementById("log-body").textContent.includes("GAME-RULE"));

// 非法操作：再点同一张（RULE-006 拒绝）
newCards[0].click();
check("重复点击被 RULE-006 拒绝提示", document.getElementById("ui-msg").textContent.includes("RULE-006"));

// Tab 切换：Flow
document.querySelector('#tabs button[data-tab="flow"]').click();
check("Flow 视图渲染状态机 SVG", !!document.querySelector("#view svg ellipse"));
check("状态机节点文本（idle/playing/won）", document.querySelector("#view svg").textContent.includes("idle"));

// Tab 切换：Tests
document.querySelector('#tabs button[data-tab="tests"]').click();
check("Tests 视图四类用例分组渲染", document.querySelectorAll("#view table").length === 4);
check("预设场景卡片渲染", document.querySelectorAll("#view .req-card").length >= 2);

// 双向定位：规格工作台 -> UI（定位按钮在分类渲染的需求卡片上）
document.querySelector('#tabs button[data-tab="spec"]').click();
await new Promise((r) => setTimeout(r, 50));
let gotoBtn = document.querySelector("[data-goto-ui]");
if (!gotoBtn) {
  // 当前分类（GAME-RULE）无带 UI 关联的卡片时依次切其他分类查找
  for (const cat of ["GAME-FR", "GAME-STATE", "GAME-CFG"]) {
    const a = $$("#nav .cat-nav[data-cat]").find((x) => x.dataset.cat === cat);
    if (!a) continue;
    a.click();
    await new Promise((r) => setTimeout(r, 50));
    gotoBtn = document.querySelector("[data-goto-ui]");
    if (gotoBtn) break;
  }
}
check("需求卡片带「查看 UI」定位按钮", !!gotoBtn);
if (gotoBtn) {
  gotoBtn.click();
  await new Promise((r) => setTimeout(r, 30));
  check("点击定位后切到 UI Demo 并显示定位信息", document.querySelector('#tabs button[data-tab="ui"]').className.includes("active") && document.getElementById("ui-msg").textContent.includes("定位"));
}

// UI -> 规格工作台反向定位（右键）
document.querySelector('#tabs button[data-tab="ui"]').click();
const comp = document.querySelector('[data-component-id="GAME-COMP-002"]');
if (comp) comp.dispatchEvent(new window.MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
await new Promise((r) => setTimeout(r, 50));
check("点击 UI 组件切回规格工作台并高亮关联需求", !!document.querySelector("#view .req-card.highlight"));
check("详情面板展示关联需求", document.getElementById("detail").textContent.includes("GAME-"));

console.log("\n结果: " + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
