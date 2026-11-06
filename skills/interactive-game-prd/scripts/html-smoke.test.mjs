// Interactive HTML PRD 冒烟测试（P3 验收：核心导航和交互可运行）
// 用法: node scripts/html-smoke.test.mjs <output 目录>
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] || path.resolve(SCRIPT_DIR, "../../../examples/mini-game/output/interactive-game-prd");
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

check("游戏标题渲染", document.getElementById("game-title").textContent === "记忆翻牌");
check("左侧导航渲染（含规则分组）", document.querySelectorAll("#nav a.req").length >= 8);
check("PRD 视图默认渲染需求卡片", document.querySelectorAll("#view .req-card").length >= 8);
check("状态徽标与权限徽标同时展示", document.querySelector("#view .st-proposed") && document.querySelector("#view .au-fixed"));
check("未决问题区渲染", document.querySelector('[data-anchor="__openq__"]'));

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

// 双向定位：PRD -> UI
document.querySelector('#tabs button[data-tab="prd"]').click();
const gotoBtn = document.querySelector("[data-goto-ui]");
check("PRD 卡片带「查看 UI」定位按钮", !!gotoBtn);
if (gotoBtn) {
  gotoBtn.click();
  await new Promise((r) => setTimeout(r, 30));
  check("点击定位后切到 UI Demo 并显示定位信息", document.querySelector('#tabs button[data-tab="ui"]').className.includes("active") && document.getElementById("ui-msg").textContent.includes("定位"));
}

// UI -> PRD 反向定位（右键）
document.querySelector('#tabs button[data-tab="ui"]').click();
const comp = document.querySelector('[data-component-id="GAME-COMP-002"]');
if (comp) comp.dispatchEvent(new window.MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
await new Promise((r) => setTimeout(r, 50));
check("点击 UI 组件切回 PRD 并高亮关联需求", !!document.querySelector("#view .req-card.highlight"));
check("详情面板展示关联需求", document.getElementById("detail").textContent.includes("GAME-"));

console.log("\n结果: " + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
