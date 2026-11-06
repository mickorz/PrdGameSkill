# Golden Sample 冻结记录（迷你样例）

- 冻结对象：`examples/mini-game/game-spec/`（迷你游戏「记忆翻牌」，管线验证样例）
- 冻结日期：2026-11-06
- validate-ir 结果：PASS（errors=0 warnings=0）
- 冻结 SHA-256（game-spec 目录内容清单）：

```
e854f9079882c171375347a1eb946fe0a68ff9cd30cdc93e9852d5c39007889f

sha256 结算方式：对 game-spec 下全部文件按相对路径排序后拼接路径+内容计算整体哈希。
用途：P3/P4 阶段启动时复核 IR 未被改动。
```

- 说明：
  1. 本样例仅用于验证解析 -> IR -> 审查 -> 冻结 -> HTML -> 模拟器全管线，**不是**卡五星 Golden Sample。
  2. 真实卡五星 Golden Sample 等待原始卡五星 PRD（P0-10）到位后按执行计划 P2-01~P2-10 流程在 `examples/mahjong/` 下重建。
  3. 冻结后修改本目录必须走 Update 流程并追加 decision-log。
