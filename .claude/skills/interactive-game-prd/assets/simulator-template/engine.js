// simulator-template/engine.js —— 模拟器框架契约（P4-01）
// 核心原则（需求文档 8.1）：状态与 UI 分离；规则由结构化规格约束；
// 每次操作产生可追踪事件（rule_ref 指向 GAME-RULE ID）；规则缺失时报 RULE_NOT_CONFIRMED，不编造行为。
//
// 游戏实现方（如 examples/mini-game/simulator/simulator.js）按此契约提供：
//   createGame(config, logger) -> { dispatch, getState, snapshot, restore }
//   dispatch(action, args) 内部每个判定分支必须调用 logger(ruleId, verdict, detail)
//
// 规则守卫：RULE_TABLE 声明游戏实现的规则与其 IR 状态；查表不存在或 authority=open 时
// 抛出 RULE_NOT_CONFIRMED，禁止编造判定结果。

export const RULE_GUARD = {
  assertUsable(ruleTable, ruleId) {
    const rule = ruleTable[ruleId];
    if (!rule) throw { code: "RULE_NOT_CONFIRMED", ruleId, message: "规则未定义，模拟器拒绝判定" };
    if (rule.authority === "open") throw { code: "RULE_NOT_CONFIRMED", ruleId, message: "规则未确认（authority=open），禁止作为确定规则执行" };
    return rule;
  },
};

export function createLogger() {
  const entries = [];
  let seq = 0;
  return {
    log(ruleRef, verdict, detail) {
      entries.push({ seq: ++seq, rule_ref: ruleRef, verdict, detail: detail || "" });
    },
    entries() {
      return entries.slice();
    },
  };
}

export function snapshotOf(state) {
  return JSON.parse(JSON.stringify(state));
}
