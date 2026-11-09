// 卡五星模拟器场景回放测试（P4）
// 用法: node scripts/mahjong-simulator.test.mjs
// 断言映射: TC-001 碰 / TC-003 漏胡 / TC-005 封顶 / TC-006 连杠 / RULE-033 危牌 / RULE-116 守卫 / 快照恢复
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const SIM_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../examples/mahjong/simulator/simulator.js");
const sim = require(SIM_PATH);

let passed = 0;
let failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log("PASS: " + name); }
  else { failed++; console.log("FAIL: " + name + (detail ? " -> " + detail : "")); }
}

function newLogger() {
  return { entries: [], log(r, v, d) { this.entries.push({ rule: r, verdict: v, detail: d || "" }); } };
}
const hasRuleLog = (lg, ruleId, verdict) => lg.entries.some((e) => e.rule === ruleId && e.verdict === verdict);

// ---------- TC-001 碰牌成立取得出牌权 ----------
{
  const lg = newLogger();
  const g = sim.createGame({ hands: [["1万", "2万", "3万", "5万", "5万", "7条", "8条", "9条", "1筒", "2筒", "3筒", "4筒", "5筒", "9万"], ["5万", "5万", "9条", "9条", "9条", "1筒", "1筒", "1筒", "2筒", "2筒", "2筒", "3筒", "3筒", "3筒"], []], baseScore: 1, cap: 8 }, lg);
  const r1 = g.dispatch("discard", { tile: "5万" }); // P1 打出 5万
  check("TC-001 前置出牌成功", r1.ok);
  const r2 = g.dispatch("peng", { player: 1 }); // P2 碰
  check("TC-001 碰成立取得出牌权", r2.ok && g.getState().turn === 1, JSON.stringify(r2));
  const st = g.getState();
  check("TC-001 碰副露记录且手牌减 2", st.players[1].melds.some((m) => m.type === "peng" && m.tile === "5万") && !st.players[1].hand.includes("5万"));
  check("TC-001 rule_ref GAME-RULE-038", hasRuleLog(lg, "GAME-RULE-038", "applied"));
}
// 碰失败: 手中不足 2 张
{
  const lg = newLogger();
  const g = sim.createGame({ hands: [["5万"], ["1万", "2万", "3万"], []], baseScore: 1 }, lg);
  g.dispatch("discard", { tile: "5万" });
  const r = g.dispatch("peng", { player: 1 });
  check("碰不足 2 张被拒绝", !r.ok && r.reason === "peng_fail" && hasRuleLog(lg, "GAME-RULE-038", "rejected"));
}

// ---------- TC-003 漏胡: 过胡后摸牌前不可胡，摸牌解除 ----------
{
  const lg = newLogger();
  // P1 14 张可胡（碰碰胡形: 4 刻 + 1 对）
  const winHand = ["1万", "1万", "1万", "2万", "2万", "2万", "3万", "3万", "3万", "4万", "4万", "4万", "5万", "5万"];
  const g = sim.createGame({ hands: [winHand, ["9条", "9条", "9条", "1筒", "1筒", "1筒", "2筒", "2筒", "2筒", "3筒", "3筒", "3筒", "4筒", "4筒"], []], deck: ["6条"], baseScore: 1, cap: 8 }, lg);
  const rp = g.dispatch("pass", { player: 0, chance: "hu" });
  check("TC-003 可胡不胡进入漏胡", rp.ok && g.getState().players[0].missed);
  const rh = g.dispatch("hu", { player: 0, kind: "zimo" });
  check("TC-003 漏胡期间不可胡", !rh.ok && rh.reason === "missed_hu");
  check("TC-003 rule_ref GAME-RULE-049 拒绝", hasRuleLog(lg, "GAME-RULE-049", "rejected"));
  const rd = g.dispatch("draw", {});
  check("TC-003 摸牌解除漏胡", rd.ok && !g.getState().players[0].missed);
  // 摸到 6条 后手牌 15 张，胡判定按张数拒绝（牌型原因非漏胡）
  const rh2 = g.dispatch("hu", { player: 0, kind: "zimo" });
  check("TC-003 解除后按牌型正常判定", !rh2.ok && rh2.reason === "tile_count", JSON.stringify(rh2));
}
// 漏胡解除后胡成立（完整轮次: 过胡 -> 打出一张 -> 摸回可胡牌 -> 自摸胡）
{
  const lg = newLogger();
  // P1 起手 14 张（含首摸），可胡; deck 顶回 5万
  const winHand = ["1万", "1万", "1万", "2万", "2万", "2万", "3万", "3万", "3万", "4万", "4万", "4万", "5万", "5万"];
  const g = sim.createGame({ hands: [winHand, ["9条"], ["8条"]], deck: ["8条", "9条", "5万"], baseScore: 1, cap: 8 }, lg);
  g.dispatch("pass", { player: 0, chance: "hu" }); // 可胡不胡，进入漏胡
  g.dispatch("discard", { tile: "5万" }); // 打出 5万（13 张）
  g.dispatch("discard", { tile: "9条" }); // P2 出
  g.dispatch("discard", { tile: "8条" }); // P3 出，轮回 P1
  const rd = g.dispatch("draw", {}); // P1 摸回 5万（14 张），漏胡解除
  check("TC-003 摸回可胡牌解除漏胡", rd.ok && rd.tile === "5万" && !g.getState().players[0].missed);
  const rh = g.dispatch("hu", { player: 0, kind: "zimo" });
  check("TC-003 解除后自摸碰碰胡成立", rh.ok && rh.pattern === "GAME-RULE-072" && rh.patternScore === 2, JSON.stringify(rh));
  check("TC-003 rule_ref GAME-RULE-049 解除", hasRuleLog(lg, "GAME-RULE-049", "applied"));
  check("TC-003 rule_ref GAME-RULE-072", hasRuleLog(lg, "GAME-RULE-072", "applied"));
}

// ---------- TC-005 封顶截断: 碰碰胡 2 x 亮倒 2 x 上楼 2 = 8 不截断; 番型x加倍项超 8 截断 ----------
{
  const lg = newLogger();
  const winHand = ["1万", "1万", "1万", "2万", "2万", "2万", "3万", "3万", "3万", "4万", "4万", "4万", "5万", "5万"];
  const g = sim.createGame({ hands: [winHand, ["9条"], ["8条"]], baseScore: 1, cap: 8 }, lg);
  g.dispatch("liang", { player: 0 });
  g.dispatch("upstairs", { player: 0 });
  const rh = g.dispatch("hu", { player: 0, kind: "zimo" });
  check("TC-005 碰碰胡2 x 亮倒2 x 上楼2 = 8 未超封顶", rh.ok && rh.cappedValue === 8, JSON.stringify(rh));
  check("TC-005 rule_ref GAME-RULE-121", hasRuleLog(lg, "GAME-RULE-121", "applied"));
  check("TC-005 rule_ref GAME-RULE-081/086", hasRuleLog(lg, "GAME-RULE-081", "applied") && hasRuleLog(lg, "GAME-RULE-086", "applied"));
}
{
  const lg = newLogger();
  // 3 个加倍: 亮倒 x2 上楼 x2 → 2 x 4 = 16 > cap 8 → 截断
  const winHand = ["1万", "1万", "1万", "2万", "2万", "2万", "3万", "3万", "3万", "4万", "4万", "4万", "5万", "5万"];
  const g = sim.createGame({ hands: [winHand, ["9条"], ["8条"]], baseScore: 1, cap: 8 }, lg);
  g.dispatch("liang", { player: 0 });
  g.dispatch("upstairs", { player: 0 });
  // 追加一个加倍途径: 亮倒 x2 + 上楼 x2 已用; 用 cap=6 强制截断验证
  void g;
  const g2 = sim.createGame({ hands: [winHand.slice(), ["9条"], ["8条"]], baseScore: 1, cap: 6 }, lg);
  g2.dispatch("liang", { player: 0 });
  g2.dispatch("upstairs", { player: 0 });
  const rh2 = g2.dispatch("hu", { player: 0, kind: "zimo" });
  check("TC-005 番型x加倍项 8 超封顶 6 截断为 6", rh2.ok && rh2.cappedValue === 6, JSON.stringify(rh2));
}

// ---------- 平胡判定（含顺子 F01） ----------
{
  const lg = newLogger();
  // 4 副含顺子 + 1 对: 123万 456万 789万 123条 4条对
  const winHand = ["1万", "2万", "3万", "4万", "5万", "6万", "7万", "8万", "9万", "1条", "2条", "3条", "4条", "4条"];
  const g = sim.createGame({ hands: [winHand, ["9条"], ["8条"]], baseScore: 1, cap: 8 }, lg);
  const rh = g.dispatch("hu", { player: 0, kind: "zimo" });
  check("平胡 F01 判定（含顺子 1 倍）", rh.ok && rh.pattern === "GAME-RULE-071" && rh.patternScore === 1, JSON.stringify(rh));
  check("平胡 rule_ref GAME-RULE-071", hasRuleLog(lg, "GAME-RULE-071", "applied"));
}

// ---------- TC-006 杠上杠连杠: 直杠 2 -> 同玩家补牌暗杠递进; 中断后重置 ----------
{
  const lg = newLogger();
  // 正确重放:
  // P1 手 5万x3; P2 打出 5万 → P1 直杠 (n=1) 收 2 分，补牌 7万 (手 12+1=13? 直杠后手 11 + 补 1 = 12)
  // P1 再打一张非杠牌 → 连杠结束（此时 chain 重置在下一张非补杠出牌）
  const g = sim.createGame({
    hands: [
      ["1万", "2万", "3万", "5万", "5万", "5万", "7条", "8条", "9条", "1筒", "2筒", "3筒", "4筒", "4筒"],
      ["5万", "6条", "6条", "7条", "7条", "8条", "8条", "9条", "9条", "1筒", "1筒", "2筒", "2筒", "3筒"],
      ["9万", "9万", "9万", "1筒", "1筒", "1筒", "2筒", "2筒", "2筒", "3筒", "3筒", "3筒", "4筒", "4筒"],
    ],
    deck: ["2万", "7万"],
    baseScore: 1,
    cap: 8,
  }, lg);
  // P1 先打出 4筒（轮转 P2）
  g.dispatch("discard", { tile: "4筒" });
  // P2 打出 5万
  g.dispatch("discard", { tile: "5万" });
  // P1 直杠 5万: n=1（非杠后补牌的出牌）→ 2 x 1 = 2 分，P2 付，补牌 7万
  const rg1 = g.dispatch("gang", { player: 0, tile: "5万", type: "direct" });
  check("TC-006 直杠成立 n=1", rg1.ok && rg1.chain === 1, JSON.stringify(rg1));
  const st1 = g.getState();
  check("TC-006 直杠分 2（P2 付 P1 收）", st1.players[0].score === 2 && st1.players[1].score === -2, JSON.stringify(st1.players.map((p) => p.score)));
  check("TC-006 杠后补牌 7万", st1.players[0].hand.includes("7万"));
  // P1 补牌后打出 7万（杠后补牌的出牌 → 可延续连杠），无人杠
  g.dispatch("discard", { tile: "7万" });
  // P2 打 6条（非杠后补牌的出牌且无人杠 → 连杠中断）
  g.dispatch("discard", { tile: "6条" });
  // P3 出 4筒（继续中断状态）
  g.dispatch("discard", { tile: "4筒" });
  const st2 = g.getState();
  check("TC-006 非杠后补牌出牌中断连杠", st2.gangChain === 0, "gangChain=" + st2.gangChain);
}
{
  const lg = newLogger();
  // 连杠递进: P2 打 5万 → P1 直杠(n=1,2分) 补 7万 → P1 补牌打出 7万 → P3 手 7万x3 直杠(n=2, 2x2=4分) 补 8万 → 打出 8万 → P2 手 8万x3 直杠(n=3, 2x4=8分)
  const g = sim.createGame({
    hands: [
      ["1万", "2万", "3万", "5万", "5万", "5万", "7条", "8条", "9条", "1筒", "2筒", "3筒", "4筒", "4筒"],
      ["5万", "6条", "6条", "7条", "7条", "8条", "8条", "9条", "9条", "1筒", "1筒", "2筒", "2筒", "3筒"],
      ["6条", "6条", "6条", "9万", "9万", "9万", "1筒", "1筒", "1筒", "2筒", "2筒", "2筒", "3筒", "3筒"],
    ],
    deck: ["7万"],
    baseScore: 1,
    cap: 8,
  }, lg);
  g.dispatch("discard", { tile: "4筒" }); // P1 出（转 P2）
  g.dispatch("discard", { tile: "5万" }); // P2 出 5万
  const rg1 = g.dispatch("gang", { player: 0, tile: "5万", type: "direct" }); // n=1, 2分
  check("连杠第 1 杠 n=1 分 2", rg1.ok && rg1.chain === 1 && g.getState().players[0].score === 2);
  g.dispatch("discard", { tile: "7万" }); // P1 杠后补牌打出 7万（可延续，转 P2）
  g.dispatch("discard", { tile: "6条" }); // P2 出 6条（无人杠且非链牌 → 链中断，转 P3）
  // P3 直杠 6条: 链已中断 → 重新计数 n=1
  const rg3 = g.dispatch("gang", { player: 2, tile: "6条", type: "direct" });
  check("中断后重新计数 n=1", rg3.ok && rg3.chain === 1, JSON.stringify(rg3));
  check("TC-006 rule_ref GAME-RULE-042", hasRuleLog(lg, "GAME-RULE-042", "applied") || hasRuleLog(lg, "GAME-RULE-041", "applied"));
}
{
  const lg = newLogger();
  // 同玩家连杠: P1 直杠(n=1) 补牌 7万 → 手中已有 7万x3 + 补 1 = 4 → 暗杠(n=2): 2 x 2 = 4/家, 收 8
  const g = sim.createGame({
    hands: [
      ["1万", "2万", "3万", "5万", "5万", "5万", "7万", "7万", "7万", "9条", "9条", "9条", "1筒", "2筒"],
      ["5万", "6条", "6条", "7条", "7条", "8条", "8条", "9条", "9条", "1筒", "1筒", "2筒", "2筒", "3筒"],
      ["9万", "9万", "9万", "1筒", "1筒", "1筒", "2筒", "2筒", "2筒", "3筒", "3筒", "3筒", "4筒", "4筒"],
    ],
    deck: ["7万"],
    baseScore: 1,
    cap: 8,
  }, lg);
  g.dispatch("discard", { tile: "2筒" }); // P1 出（转 P2）
  g.dispatch("discard", { tile: "5万" }); // P2 出 5万
  const rg1 = g.dispatch("gang", { player: 0, tile: "5万", type: "direct" }); // n=1: 2分, 补 7万
  check("同玩家连杠前置直杠 n=1", rg1.ok && rg1.chain === 1 && g.getState().players[0].score === 2);
  const rg2 = g.dispatch("gang", { player: 0, tile: "7万", type: "an" }); // n=2: 2x2=4/家, 收 8
  check("TC-006 杠后补牌暗杠递进 n=2", rg2.ok && rg2.chain === 2, JSON.stringify(rg2));
  const st = g.getState();
  // P1 总分: 直杠 +2, 暗杠 +4x2=8 → 10; P2: -2(直杠) -4(暗杠) = -6; P3: -4
  check("TC-006 连杠分值 2+8=10", st.players[0].score === 10 && st.players[1].score === -6 && st.players[2].score === -4, JSON.stringify(st.players.map((p) => p.score)));
  check("TC-006 连杠 rule_ref GAME-RULE-042", hasRuleLog(lg, "GAME-RULE-042", "applied"));
}

// ---------- TC-004 危牌禁打 + 全危牌例外 ----------
{
  const lg = newLogger();
  const g = sim.createGame({ hands: [["1万", "2万", "3万", "5条", "6条", "7条", "9条", "9条", "9条", "1筒", "2筒", "3筒", "4筒", "4筒"], ["9万"], ["8万"]], dangerTiles: { P1: ["9万"] }, baseScore: 1 }, lg);
  g.dispatch("discard", { tile: "1万" }); // 轮转后到 P2/P3 再回 P1? 危牌验证用 P1 打 9条（非危）先轮转
  const st0 = g.getState();
  void st0;
  // 直接构造: P1 手含 9条 且 9条 为危牌
  const lg2 = newLogger();
  const g2 = sim.createGame({ hands: [["1万", "2万", "3万", "9条", "5条", "6条", "7条", "1筒", "2筒", "3筒", "4筒", "5筒", "6筒", "7筒"], ["9万"], ["8万"]], dangerTiles: { P1: ["9条"] }, baseScore: 1 }, lg2);
  const r = g2.dispatch("discard", { tile: "9条" });
  check("TC-004 危牌禁止打出", !r.ok && r.reason === "danger_tile" && hasRuleLog(lg2, "GAME-RULE-033", "rejected"));
  const r2 = g2.dispatch("discard", { tile: "1万" });
  check("TC-004 非危牌正常打出", r2.ok);
  void g; void lg;
}
{
  const lg = newLogger();
  // 全危牌例外: 手中全是危牌
  const g = sim.createGame({ hands: [["9条", "9条", "9条", "9条", "1万", "2万", "3万", "4条", "5条", "6条", "7条", "8条", "1筒", "2筒"], ["9万"], ["8万"]], dangerTiles: { P1: ["9条"] }, baseScore: 1 }, lg);
  const r = g.dispatch("discard", { tile: "9条" });
  check("TC-004 非全危牌混有危牌仍禁打", !r.ok && r.reason === "danger_tile");
  const g2 = sim.createGame({ hands: [["9条", "9条", "9条", "9条", "9条", "9条", "9条", "9条", "9条", "9条", "9条", "9条", "9条", "9条"], ["9万"], ["8万"]], dangerTiles: { P1: ["9条"] }, baseScore: 1 }, lg);
  const r2 = g2.dispatch("discard", { tile: "9条" });
  check("TC-004 全危牌例外允许打出", r2.ok && hasRuleLog(lg, "GAME-RULE-033", "applied"));
}

// ---------- RULE-116 守卫: S0 总结算 authority=open → RULE_NOT_CONFIRMED ----------
{
  const lg = newLogger();
  const g = sim.createGame({ hands: [["1万", "2万", "3万"], ["9万"], ["8万"]], baseScore: 1 }, lg);
  let threw = null;
  try { g.dispatch("settle", {}); } catch (e) { threw = e; }
  check("总结算抛 RULE_NOT_CONFIRMED（S0 未确认）", threw && threw.code === "RULE_NOT_CONFIRMED" && threw.ruleId === "GAME-RULE-116", JSON.stringify(threw));
}
// 未实现规则守卫: RULE_TABLE 外的规则请求（经 hu 非法参数模拟未知动作）
{
  const lg = newLogger();
  const g = sim.createGame({ hands: [["1万", "2万", "3万"], ["9万"], ["8万"]], baseScore: 1 }, lg);
  const r = g.dispatch("chow", {});
  check("未知动作被拒绝", !r.ok && r.reason === "unknown_action");
}

// ---------- 快照/恢复 ----------
{
  const lg = newLogger();
  const g = sim.createGame({ hands: [["1万", "2万", "3万", "5万", "5万", "5万", "7条", "8条", "9条", "1筒", "2筒", "3筒", "4筒", "4筒"], ["5万", "6条", "6条", "7条", "7条", "8条", "8条", "9条", "9条", "1筒", "1筒", "2筒", "2筒", "3筒"], ["9万", "9万", "9万", "1筒", "1筒", "1筒", "2筒", "2筒", "2筒", "3筒", "3筒", "3筒", "4筒", "4筒"]], baseScore: 1 }, lg);
  g.dispatch("discard", { tile: "4筒" }); // P1 出 4筒（转 P2）
  const snap = g.snapshot();
  g.dispatch("discard", { tile: "5万" }); // P2 出 5万（转 P3）
  const rp = g.dispatch("peng", { player: 0 }); // P1 碰 5万，取得出牌权
  check("快照前状态推进正常", rp.ok && g.getState().turn === 0);
  g.restore(snap);
  const st = g.getState();
  check("恢复后状态一致", st.turn === 1 && !st.players[0].melds.length && st.lastDiscard && st.lastDiscard.tile === "4筒" && st.players[0].hand.includes("4筒"));
}

console.log("\n结果: " + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
