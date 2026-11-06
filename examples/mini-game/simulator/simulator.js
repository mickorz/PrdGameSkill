// 迷你游戏「记忆翻牌」模拟器（P4）
// 逻辑核心 MiniGameCore：纯逻辑，Node 可测；DOM 适配 MiniGameSimulator：浏览器接入。
// 实现的规则以 RULE_TABLE 声明，rule_ref 全部指向 GAME-RULE ID。
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.MiniGameFactory = factory();
})(typeof self !== "undefined" ? self : this, function () {
  // 规则声明表：与 game-spec/requirements/rules 冻结 IR 对应
  // status/authority 与 IR 一致；authority=open 的规则会被守卫拒绝执行
  const RULE_TABLE = {
    "GAME-RULE-001": { name: "翻牌规则", authority: "fixed", status: "proposed" },
    "GAME-RULE-002": { name: "配对判定规则", authority: "fixed", status: "proposed" },
    "GAME-RULE-003": { name: "配对失败盖回规则", authority: "fixed", status: "approved" },
    "GAME-RULE-004": { name: "胜利判定规则", authority: "fixed", status: "proposed" },
    "GAME-RULE-005": { name: "步数统计规则", authority: "delegated", status: "proposed" },
    "GAME-RULE-006": { name: "重复翻牌禁止规则", authority: "delegated", status: "proposed" },
  };

  function guard(ruleId) {
    const rule = RULE_TABLE[ruleId];
    if (!rule) throw { code: "RULE_NOT_CONFIRMED", ruleId, message: "规则未定义，模拟器拒绝判定" };
    if (rule.authority === "open") throw { code: "RULE_NOT_CONFIRMED", ruleId, message: "规则未确认，禁止作为确定规则执行" };
    return rule;
  }

  // ---------- 逻辑核心（无 DOM） ----------
  const snapshotOf = (s) => JSON.parse(JSON.stringify(s));

  function createGame(config, logger) {
    const cfg = Object.assign({ pairCount: 4, flipBackMs: 1000 }, config || {});
    const log = (ruleId, verdict, detail) => logger && logger.log(ruleId, verdict, detail);
    let state = null;

    function initial() {
      const cards = [];
      for (let p = 1; p <= cfg.pairCount; p++) {
        cards.push({ id: cards.length, pairId: p, faceUp: false, matched: false });
        cards.push({ id: cards.length, pairId: p, faceUp: false, matched: false });
      }
      return { phase: "playing", cards, flipped: [], matchedPairs: 0, moves: 0, won: false };
    }

    function findCard(id) {
      return state.cards.find((c) => c.id === id);
    }

    // 动作：flip(cardId)
    function dispatch(action, args) {
      args = args || {};
      if (action !== "flip") {
        log("GAME-RULE-001", "rejected", "未知动作 " + action);
        return { ok: false, reason: "unknown_action" };
      }
      guard("GAME-RULE-001");
      const card = findCard(args.cardId);
      if (!card) return { ok: false, reason: "no_card" };
      // GAME-RULE-006：已翻开或已配对的牌点击无效
      if (card.faceUp || card.matched) {
        guard("GAME-RULE-006");
        log("GAME-RULE-006", "rejected", "card=" + card.id + " 已翻开/已配对，操作被忽略");
        return { ok: false, reason: "illegal_reclick" };
      }
      // GAME-RULE-001：翻开
      card.faceUp = true;
      state.flipped.push(card);
      log("GAME-RULE-001", "applied", "card=" + card.id + " 翻开");
      if (state.flipped.length < 2) return { ok: true, effect: "flip" };

      // 第二张：GAME-RULE-005 计步
      guard("GAME-RULE-005");
      state.moves += 1;
      log("GAME-RULE-005", "applied", "moves=" + state.moves);
      const [a, b] = state.flipped;
      // GAME-RULE-002：配对判定
      guard("GAME-RULE-002");
      if (a.pairId === b.pairId) {
        a.matched = b.matched = true;
        state.matchedPairs += 1;
        state.flipped = [];
        log("GAME-RULE-002", "applied", "配对成功 pair=" + a.pairId + " " + state.matchedPairs + "/" + cfg.pairCount);
        // GAME-RULE-004：胜利判定
        guard("GAME-RULE-004");
        if (state.matchedPairs === cfg.pairCount) {
          state.won = true;
          state.phase = "won";
          log("GAME-RULE-004", "applied", "全部配对完成，进入 won");
        }
        return { ok: true, effect: "matched" };
      }
      // GAME-RULE-003：配对失败盖回（同步模型：立即盖回并记录延时参数）
      guard("GAME-RULE-003");
      a.faceUp = b.faceUp = false;
      state.flipped = [];
      log("GAME-RULE-003", "applied", "配对失败，" + cfg.flipBackMs + "ms 后盖回（同步模拟）");
      return { ok: true, effect: "flipback", flipBackMs: cfg.flipBackMs };
    }

    function getState() { return snapshotOf(state); }
    function reset(config2) {
      if (config2) cfg = Object.assign(cfg, config2);
      state = initial();
    }
    reset();
    return { dispatch, getState, reset, snapshot: () => snapshotOf(state), restore: (s) => { state = snapshotOf(s); } };
  }

  // ---------- DOM 适配（浏览器） ----------
  function create(area, onLog) {
    const logger = { entries: [], log: function (r, v, d) { this.entries.push("[" + r + "] " + v + " " + (d || "")); if (onLog) onLog("[" + r + "] " + (d || "")); } };
    const FACES = ["A", "B", "C", "D"];
    let game = null;
    let lock = false;

    function render() {
      area.innerHTML = "";
      const st = game.getState();
      const board = document.createElement("div");
      board.className = "board";
      st.cards.forEach((c) => {
        const el = document.createElement("div");
        el.className = "card-el" + (c.matched ? " matched" : c.faceUp ? " face-up" : "");
        el.dataset.componentId = "GAME-COMP-001";
        el.textContent = c.faceUp || c.matched ? FACES[(c.pairId - 1) % FACES.length] : "?";
        el.addEventListener("click", function () {
          if (lock) return;
          const before = game.snapshot();
          let result;
          try { result = game.dispatch("flip", { cardId: c.id }); }
          catch (e) { if (onLog) onLog("[" + (e.code || "ERROR") + "] " + e.message); return; }
          if (result.effect === "flipback") {
            lock = true;
            setTimeout(function () { lock = false; render(); }, result.flipBackMs);
          }
          void before;
          render();
        });
        board.appendChild(el);
      });
      const moves = document.createElement("div");
      moves.className = "moves";
      moves.dataset.componentId = "GAME-COMP-002";
      moves.textContent = "步数：" + game.getState().moves;
      area.appendChild(moves);
      area.appendChild(board);
      if (game.getState().won) {
        const win = document.createElement("div");
        win.className = "comp-generic";
        win.dataset.componentId = "GAME-COMP-004";
        win.textContent = "胜利！再来一局";
        win.addEventListener("click", function () { newGame(); });
        area.appendChild(win);
      }
    }

    function newGame() {
      game = createGame({ pairCount: 4, flipBackMs: 1000 }, logger);
      lock = false;
      render();
    }
    newGame();
    return { getLog: function () { return logger.entries; }, reset: newGame };
  }

  return { RULE_TABLE: RULE_TABLE, createGame: createGame, create: create };
});
