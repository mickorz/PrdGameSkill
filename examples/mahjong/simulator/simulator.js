// 卡五星（好友房）规则模拟器（P4 子集）
// 逻辑核心 createGame：纯逻辑，Node 可测；DOM 适配 create：浏览器接入。
// 实现的规则以 RULE_TABLE 声明（与 game-spec/requirements/rules IR 一致）：
//   authority=open 的规则（如 S0 结算总公式）由守卫拒绝执行，输出 RULE_NOT_CONFIRMED。
// 未实现的规则不在 RULE_TABLE 中，守卫同样拒绝（不编造判定）。
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.MiniGameFactory = factory();
})(typeof self !== "undefined" ? self : this, function () {
  // 规则声明表：与 examples/mahjong/game-spec 冻结 IR 对应（子集）
  const RULE_TABLE = {
    "GAME-RULE-033": { name: "危牌禁打", authority: "fixed", status: "proposed" },
    "GAME-RULE-038": { name: "碰牌规则", authority: "fixed", status: "proposed" },
    "GAME-RULE-039": { name: "操作优先级", authority: "fixed", status: "proposed" },
    "GAME-RULE-040": { name: "杠类型", authority: "fixed", status: "proposed" },
    "GAME-RULE-041": { name: "杠分结算", authority: "fixed", status: "proposed" },
    "GAME-RULE-042": { name: "杠上杠连杠", authority: "fixed", status: "proposed" },
    "GAME-RULE-049": { name: "漏胡规则", authority: "fixed", status: "proposed" },
    "GAME-RULE-050": { name: "按钮优先级顺序", authority: "fixed", status: "proposed" },
    "GAME-RULE-071": { name: "平胡 F01", authority: "fixed", status: "proposed" },
    "GAME-RULE-072": { name: "碰碰胡 F02", authority: "fixed", status: "proposed" },
    "GAME-RULE-081": { name: "亮倒加倍 J01", authority: "fixed", status: "proposed" },
    "GAME-RULE-086": { name: "上楼加倍 J08", authority: "fixed", status: "proposed" },
    "GAME-RULE-116": { name: "结算总公式 S0", authority: "open", status: "proposed" },
    "GAME-RULE-121": { name: "封顶截断 S4", authority: "fixed", status: "proposed" },
  };

  function guard(ruleId) {
    const rule = RULE_TABLE[ruleId];
    if (!rule) throw { code: "RULE_NOT_CONFIRMED", ruleId: ruleId, message: "规则未定义，模拟器拒绝判定" };
    if (rule.authority === "open") throw { code: "RULE_NOT_CONFIRMED", ruleId: ruleId, message: "规则未确认（authority=open），禁止作为确定规则执行" };
    return rule;
  }

  // ---------- 工具 ----------
  const SUITS = ["万", "条", "筒"];
  const tileIndex = (t) => SUITS.indexOf(t.slice(1)) * 9 + (parseInt(t, 10) - 1);
  const tileName = (i) => (i % 9 + 1) + SUITS[Math.floor(i / 9)];
  const countsOf = (tiles) => {
    const c = new Array(27).fill(0);
    for (const t of tiles) c[tileIndex(t)]++;
    return c;
  };
  // 确定性发牌器（LCG）：无外部配置时自动生成 108 张牌序列
  function buildDeck(seed) {
    const pool = [];
    for (let i = 0; i < 27; i++) for (let k = 0; k < 4; k++) pool.push(tileName(i));
    let s = seed >>> 0;
    for (let i = pool.length - 1; i > 0; i--) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const j = s % (i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
  }
  const snapshotOf = (s) => JSON.parse(JSON.stringify(s));

  // 胡牌判定：counts 可拆为 needSets 副面子 + 1 对将
  // 取高原则（F01/F02）：优先全刻分解（碰碰胡 2 倍），仅当全刻不成立才允许顺子（平胡 1 倍）
  function decompose(counts, needSets) {
    const trySolve = (c, sets, chowsAllowed) => {
      let first = -1;
      for (let i = 0; i < 27; i++) if (c[i] > 0) { first = i; break; }
      if (first === -1) return sets === 0;
      if (sets === 0) return false;
      // 刻子优先
      if (c[first] >= 3) {
        c[first] -= 3;
        const ok = trySolve(c, sets - 1, chowsAllowed);
        c[first] += 3;
        if (ok) return true;
      }
      // 顺子（同花色内 rank 相邻；仅平胡模式允许）
      if (chowsAllowed) {
        const sameSuit = Math.floor(first / 9) === Math.floor((first + 2) / 9);
        if (sameSuit && first % 9 <= 6 && c[first + 1] > 0 && c[first + 2] > 0) {
          c[first]--; c[first + 1]--; c[first + 2]--;
          const ok = trySolve(c, sets - 1, chowsAllowed);
          c[first]++; c[first + 1]++; c[first + 2]++;
          if (ok) return true;
        }
      }
      return false;
    };
    const solve = (chowsAllowed) => {
      const c = counts.slice();
      for (let p = 0; p < 27; p++) {
        if (c[p] >= 2) {
          c[p] -= 2;
          const ok = trySolve(c, needSets, chowsAllowed);
          c[p] += 2;
          if (ok) return true;
        }
      }
      return false;
    };
    // 取高：全刻分解成立 => 碰碰胡；否则顺子分解成立 => 平胡
    if (solve(false)) return { win: true, hasChow: false };
    if (solve(true)) return { win: true, hasChow: true };
    return { win: false, hasChow: false };
  }

  // ---------- 逻辑核心（无 DOM） ----------
  function createGame(config, logger) {
    const cfg = Object.assign({ playerCount: 3, baseScore: 1, cap: 8, seed: 20261109, dangerTiles: {} }, config || {});
    const log = (ruleId, verdict, detail) => logger && logger.log(ruleId, verdict, detail);
    let state = null;

    function initial() {
      const deck = Array.isArray(cfg.deck) ? cfg.deck.slice() : buildDeck(cfg.seed);
      const players = [];
      for (let i = 0; i < cfg.playerCount; i++) {
        players.push({ name: "P" + (i + 1), hand: [], melds: [], liang: false, upstairs: false, missed: false, score: 0, isDealer: i === 0 });
      }
      // 发 13 张起手（庄家 14：含首摸）；测试可用 hands 直接给定受控手牌
      if (Array.isArray(cfg.hands)) {
        for (let i = 0; i < cfg.playerCount; i++) {
          players[i].hand = (cfg.hands[i] || []).slice().sort((a, b) => tileIndex(a) - tileIndex(b));
        }
      } else {
        for (let r = 0; r < 13; r++) for (const p of players) p.hand.push(deck.pop());
        players[0].hand.push(deck.pop());
      }
      return {
        phase: "playing",
        turn: 0,
        players,
        deck,
        discardRiver: [],
        lastDiscard: null,
        gangChain: 0, // 连杠次数（RULE-042）
        chainEligibleDiscard: false, // 最近出牌是否为杠后补牌的出牌（可延续连杠）
        pendingGangReplenish: null, // 刚杠完待补牌打出的玩家
        logSeq: 0,
      };
    }

    function cur() { return state.players[state.turn]; }

    function dangerCheck(player, tile) {
      guard("GAME-RULE-033");
      const danger = (cfg.dangerTiles && cfg.dangerTiles[player.name]) || [];
      if (!danger.includes(tile)) return null;
      // 全危牌例外：手中全是危牌时允许打出
      const allDanger = player.hand.every((t) => danger.includes(t));
      if (allDanger) {
        log("GAME-RULE-033", "applied", "全危牌例外，允许打出 " + tile);
        return null;
      }
      log("GAME-RULE-033", "rejected", "危牌 " + tile + " 禁止打出（打出该牌将会放炮）");
      return { ok: false, reason: "danger_tile" };
    }

    // 摸牌（同时按 RULE-049 解除漏胡）
    function draw() {
      if (state.phase !== "playing") return { ok: false, reason: "round_over" };
      if (!state.deck.length) {
        state.phase = "round_over";
        return { ok: false, reason: "wall_empty" };
      }
      const tile = state.deck.pop();
      cur().hand.push(tile);
      cur().hand.sort((a, b) => tileIndex(a) - tileIndex(b));
      if (cur().missed) {
        guard("GAME-RULE-049");
        cur().missed = false;
        log("GAME-RULE-049", "applied", cur().name + " 摸牌，漏胡解除");
      }
      return { ok: true, tile };
    }

    // 出牌
    function discard(tile) {
      if (state.phase !== "playing") return { ok: false, reason: "round_over" };
      const p = cur();
      if (!p.hand.includes(tile)) return { ok: false, reason: "no_tile" };
      const blocked = dangerCheck(p, tile);
      if (blocked) return blocked;
      p.hand.splice(p.hand.indexOf(tile), 1);
      state.lastDiscard = { player: state.turn, tile };
      state.discardRiver.push({ player: state.turn, tile });
      // RULE-042 连杠链：杠后补牌打出的牌被杠才连续；其余出牌中断连杠
      if (state.pendingGangReplenish === state.turn) {
        state.chainEligibleDiscard = true; // 本张为杠后补牌的出牌，可延续连杠
      } else {
        state.chainEligibleDiscard = false;
        state.gangChain = 0; // 非杠后补牌的出牌且无人杠，连杠结束
      }
      state.pendingGangReplenish = null;
      state.turn = (state.turn + 1) % state.players.length;
      log(null, "applied", p.name + " 打出 " + tile);
      return { ok: true, tile };
    }

    // 碰（RULE-038）：对 lastDiscard 声明碰的玩家
    function peng(playerIdx) {
      if (state.phase !== "playing") return { ok: false, reason: "round_over" };
      guard("GAME-RULE-038");
      if (!state.lastDiscard) return { ok: false, reason: "no_discard" };
      const tile = state.lastDiscard.tile;
      const p = state.players[playerIdx];
      const held = p.hand.filter((t) => t === tile).length;
      if (held < 2) {
        log("GAME-RULE-038", "rejected", p.name + " 手中 " + tile + " 不足 2 张，碰不成立");
        return { ok: false, reason: "peng_fail" };
      }
      // 移除两张
      let removed = 0;
      p.hand = p.hand.filter((t) => { if (t === tile && removed < 2) { removed++; return false; } return true; });
      p.melds.push({ type: "peng", tile });
      state.turn = playerIdx;
      state.lastDiscard = null;
      log("GAME-RULE-038", "applied", p.name + " 碰 " + tile + "，取得出牌权");
      return { ok: true };
    }

    // 连杠次数判定（RULE-042）：直杠看牌河是否为杠后补牌的出牌；暗杠/补杠看自己是否刚杠完补牌
    function chainCount(playerIdx, type) {
      if (type === "direct") return state.chainEligibleDiscard ? state.gangChain + 1 : 1;
      return state.pendingGangReplenish === playerIdx ? state.gangChain + 1 : 1;
    }

    // 杠分结算（RULE-041 基数 x RULE-042 连杠倍数 2^(n-1)）
    function settleGang(gangPlayer, type, fromPlayer, n) {
      guard("GAME-RULE-041");
      guard("GAME-RULE-042");
      const basePerSource = type === "bu" ? 1 * cfg.baseScore : 2 * cfg.baseScore; // 直杠 2 倍 / 补杠 1 倍 / 暗杠 2 倍
      const amount = basePerSource * Math.pow(2, n - 1);
      let total = 0;
      if (type === "direct") {
        state.players[fromPlayer].score -= amount;
        total = amount;
      } else {
        for (let i = 0; i < state.players.length; i++) {
          if (i === gangPlayer) continue;
          state.players[i].score -= amount;
        }
        total = amount * (state.players.length - 1);
      }
      state.players[gangPlayer].score += total;
      log("GAME-RULE-041", "applied", (type === "direct" ? "直杠" : type === "bu" ? "补杠" : "暗杠") + " 实时结算，" + state.players[gangPlayer].name + " 收 " + total + " 分");
      if (n > 1) log("GAME-RULE-042", "applied", "第 " + n + " 次连杠，杠分 = " + basePerSource + " x 2^" + (n - 1) + " = " + amount + "/家");
      return total;
    }

    // 杠（RULE-040）：type = direct(直杠) | an(暗杠) | bu(补杠)
    function gang(playerIdx, tile, type) {
      if (state.phase !== "playing") return { ok: false, reason: "round_over" };
      guard("GAME-RULE-040");
      const p = state.players[playerIdx];
      const n = chainCount(playerIdx, type);
      if (type === "direct") {
        if (!state.lastDiscard || state.lastDiscard.tile !== tile) return { ok: false, reason: "no_discard" };
        if (p.hand.filter((t) => t === tile).length < 3) {
          log("GAME-RULE-040", "rejected", "手中 " + tile + " 不足 3 张，直杠不成立");
          return { ok: false, reason: "gang_fail" };
        }
        let removed = 0;
        p.hand = p.hand.filter((t) => { if (t === tile && removed < 3) { removed++; return false; } return true; });
        const from = state.lastDiscard.player;
        p.melds.push({ type: "gang", tile, gangType: "direct" });
        state.lastDiscard = null;
        state.turn = playerIdx;
        settleGang(playerIdx, "direct", from, n);
      } else if (type === "an") {
        if (p.hand.filter((t) => t === tile).length < 4) {
          log("GAME-RULE-040", "rejected", "手中 " + tile + " 不足 4 张，暗杠不成立");
          return { ok: false, reason: "gang_fail" };
        }
        p.hand = p.hand.filter((t) => t !== tile);
        p.melds.push({ type: "gang", tile, gangType: "an" });
        settleGang(playerIdx, "an", null, n);
      } else {
        const meld = p.melds.find((m) => m.type === "peng" && m.tile === tile);
        if (!meld) {
          log("GAME-RULE-040", "rejected", "无 " + tile + " 的碰副露，补杠不成立");
          return { ok: false, reason: "gang_fail" };
        }
        if (!p.hand.includes(tile)) return { ok: false, reason: "no_tile" };
        p.hand.splice(p.hand.indexOf(tile), 1);
        meld.type = "gang";
        meld.gangType = "bu";
        settleGang(playerIdx, "bu", null, n);
      }
      state.gangChain = n;
      state.chainEligibleDiscard = false;
      state.pendingGangReplenish = playerIdx; // 杠后补牌，补牌打出的牌可延续连杠
      // 杠后补牌（补牌同样解除漏胡）
      const dr = draw();
      return { ok: true, chain: n, replenish: dr };
    }

    // 胡（RULE-071 平胡 / RULE-072 碰碰胡 / RULE-049 漏胡 / RULE-081 亮倒 / RULE-086 上楼 / RULE-121 封顶）
    function hu(playerIdx, kind) {
      if (state.phase !== "playing") return { ok: false, reason: "round_over" };
      const p = state.players[playerIdx];
      // RULE-049：漏胡期间不可胡
      if (p.missed) {
        guard("GAME-RULE-049");
        log("GAME-RULE-049", "rejected", p.name + " 漏胡期间不可胡（摸牌后解除）");
        return { ok: false, reason: "missed_hu" };
      }
      const tiles = kind === "zimo" ? p.hand.slice() : p.hand.concat(state.lastDiscard ? [state.lastDiscard.tile] : []);
      const needSets = 4 - p.melds.length;
      const expectedLen = needSets * 3 + 2;
      if (tiles.length !== expectedLen) return { ok: false, reason: "tile_count" };
      const res = decompose(countsOf(tiles), needSets);
      if (!res.win) {
        log(kind === "zimo" ? "GAME-RULE-071" : "GAME-RULE-072", "rejected", p.name + " 牌型不成立，不可胡");
        return { ok: false, reason: "no_win" };
      }
      // 番型判定：F01 平胡（含顺子）1 倍 / F02 碰碰胡（全刻）2 倍
      let patternId, patternName, patternScore;
      if (res.hasChow) { guard("GAME-RULE-071"); patternId = "GAME-RULE-071"; patternName = "平胡（F01）"; patternScore = 1; }
      else { guard("GAME-RULE-072"); patternId = "GAME-RULE-072"; patternName = "碰碰胡（F02）"; patternScore = 2; }
      log(patternId, "applied", p.name + " " + patternName + " 成立，牌型分 " + patternScore + " 倍");
      // 加倍项：亮倒 J01 x2 / 上楼 J08 x2 或 x4
      let mult = 1;
      if (p.liang) { guard("GAME-RULE-081"); mult *= 2; log("GAME-RULE-081", "applied", "亮倒 J01 加倍 x2"); }
      if (p.upstairs) { guard("GAME-RULE-086"); mult *= 2; log("GAME-RULE-086", "applied", "上楼 J08 加倍 x2"); }
      let value = patternScore * mult;
      // 封顶截断（RULE-121）：仅截断番型 x 加倍项
      guard("GAME-RULE-121");
      const capped = cfg.cap && cfg.cap > 0 ? Math.min(value, cfg.cap) : value;
      if (capped !== value) log("GAME-RULE-121", "applied", "番型x加倍项 " + value + " 超封顶 " + cfg.cap + "，截断为 " + capped);
      else log("GAME-RULE-121", "applied", "番型x加倍项 " + value + " 未超封顶 " + cfg.cap + "，不截断");
      state.phase = "round_over";
      return { ok: true, pattern: patternId, patternName, patternScore, multiplier: mult, cappedValue: capped };
    }

    // 过（RULE-049：过胡进入漏胡）
    function pass(playerIdx, chance) {
      const p = state.players[playerIdx];
      if (chance === "hu") {
        guard("GAME-RULE-049");
        p.missed = true;
        log("GAME-RULE-049", "applied", p.name + " 可胡不胡，进入漏胡状态（摸牌后解除）");
        return { ok: true };
      }
      log(null, "applied", p.name + " 过 " + (chance || "操作"));
      return { ok: true };
    }

    // 亮倒（J01 前置开关）
    function liang(playerIdx) {
      const p = state.players[playerIdx];
      p.liang = !p.liang;
      log(p.liang ? "GAME-RULE-081" : null, "applied", p.name + (p.liang ? " 亮倒（J01 x2）" : " 取消亮倒"));
      return { ok: true, liang: p.liang };
    }

    // 上楼（J08 前置开关）
    function upstairs(playerIdx) {
      const p = state.players[playerIdx];
      p.upstairs = !p.upstairs;
      log("GAME-RULE-086", "applied", p.name + (p.upstairs ? " 上楼（J08 x2）" : " 取消上楼"));
      return { ok: true, upstairs: p.upstairs };
    }

    // 总结算（S0）：authority=open，守卫拒绝 —— 完整结算需人工确认 S0 口径后实现
    function settle() {
      guard("GAME-RULE-116"); // 此处必然抛出 RULE_NOT_CONFIRMED
    }

    function dispatch(action, args) {
      args = args || {};
      switch (action) {
        case "draw": return draw();
        case "discard": return discard(args.tile);
        case "peng": return peng(args.player);
        case "gang": return gang(args.player, args.tile, args.type);
        case "hu": return hu(args.player, args.kind || "zimo");
        case "pass": return pass(args.player, args.chance);
        case "liang": return liang(args.player);
        case "upstairs": return upstairs(args.player);
        case "settle": return settle();
        default: log(null, "rejected", "未知动作 " + action); return { ok: false, reason: "unknown_action" };
      }
    }

    function getState() { return snapshotOf(state); }
    function reset(config2) {
      if (config2) Object.assign(cfg, config2);
      state = initial();
    }
    reset();
    return { dispatch, getState, reset, snapshot: () => snapshotOf(state), restore: (s) => { state = snapshotOf(s); } };
  }

  // ---------- DOM 适配（浏览器） ----------
  function create(area, onLog) {
    const logger = { entries: [], log: function (r, v, d) { this.entries.push("[" + (r || "SYS") + "] " + v + " " + (d || "")); if (onLog) onLog("[" + (r || "SYS") + "] " + (d || "")); } };
    let game = null;

    function el(tag, cls, text) {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    }

    function render() {
      const st = game.getState();
      area.innerHTML = "";
      // 玩家面板（手牌区 GAME-COMP-003）
      st.players.forEach((p, i) => {
        const panel = el("div", "mj-player" + (i === st.turn && st.phase === "playing" ? " active" : ""));
        panel.dataset.componentId = "GAME-COMP-003";
        const head = el("div", "mj-head", p.name + (p.isDealer ? "（庄）" : "") + " 分：" + p.score + (p.liang ? " [亮倒]" : "") + (p.upstairs ? " [上楼]" : "") + (p.missed ? " [漏胡]" : ""));
        panel.appendChild(head);
        const hand = el("div", "mj-hand");
        p.hand.forEach((t) => {
          const tile = el("span", "mj-tile" + (i === st.turn ? " clickable" : ""), t);
          tile.dataset.componentId = "GAME-COMP-003";
          if (i === st.turn) {
            tile.addEventListener("click", function () {
              game.dispatch("discard", { tile: t });
              render();
            });
          }
          hand.appendChild(tile);
        });
        panel.appendChild(hand);
        const melds = el("div", "mj-melds", p.melds.map((m) => (m.type === "peng" ? "碰" + m.tile : "杠" + m.tile)).join("  ") || "");
        panel.appendChild(melds);
        area.appendChild(panel);
      });
      // 牌河（GAME-COMP-004）
      const river = el("div", "mj-river", "牌河：" + st.discardRiver.map((d) => st.players[d.player].name + ">" + d.tile).join(" "));
      river.dataset.componentId = "GAME-COMP-004";
      area.appendChild(river);
      // 操作按钮组（GAME-COMP-005，顺序按 RULE-050：碰 -> 杠 -> 亮 -> 胡 -> 过）
      const btns = el("div", "mj-actions");
      btns.dataset.componentId = "GAME-COMP-005";
      const mk = (label, fn) => {
        const b = el("button", "mj-btn", label);
        b.addEventListener("click", function () {
          try { game.dispatch.apply(game, fn()); }
          catch (e) { if (onLog) onLog("[" + (e.code || "ERROR") + "] " + e.message); }
          render();
        });
        btns.appendChild(b);
      };
      mk("摸牌", () => ["draw", {}]);
      mk("碰", () => ["peng", { player: st.turn }]);
      mk("杠(直杠)", () => ["gang", { player: st.turn, tile: st.lastDiscard && st.lastDiscard.tile, type: "direct" }]);
      mk("亮倒", () => ["liang", { player: st.turn }]);
      mk("胡(自摸)", () => ["hu", { player: st.turn, kind: "zimo" }]);
      mk("过(胡)", () => ["pass", { player: st.turn, chance: "hu" }]);
      mk("总结算", () => ["settle", {}]);
      area.appendChild(btns);
      if (st.phase === "round_over") {
        const over = el("div", "mj-over", "本局结束（胡牌或流局）");
        area.appendChild(over);
      }
    }

    (function newGame() {
      game = createGame(null, logger);
      render();
    })();
    return { getLog: function () { return logger.entries; } };
  }

  return { RULE_TABLE: RULE_TABLE, createGame: createGame, create: create };
});
