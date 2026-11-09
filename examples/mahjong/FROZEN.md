# Golden Sample 冻结记录（卡五星）

- 冻结对象：`examples/mahjong/game-spec/`（卡五星（好友房）真实 Golden Sample）
- 冻结日期：2026-11-09
- validate-ir 结果：PASS（errors=0 warnings=0）
- 冻结 SHA-256（game-spec 目录内容清单）：

```
8743a081b7fe564a2bf0ed7b1975a095093981e4b7e6902f923de2ec40659b1e

sha256 结算方式：对 game-spec 下全部文件（排除 source/_map_*.json 抽取中间片段）
按相对路径排序后拼接路径+内容计算整体哈希。
用途：P3/P4 阶段启动时复核 IR 未被改动。
```

- 规模：131 需求条目（RULE 124 + FR 15，另含 STATE 3 与 CFG 28）/ 5 页面 / 20 组件 / 19 事件 / 10 测试用例 / 2 场景 / 201 source-map 锚点
- 说明：
  1. **本冻结为抽取基线冻结**：全部条目 status=proposed，核心规则人工确认尚未完成（确认清单见 `game-spec/reviews/confirmation-checklist.md`，31 项）。
  2. 人工确认后按 Update 流程升级 approved / rejected 并追加 decision-log，届时重新计算冻结哈希。
  3. 冻结后修改本目录必须走 Update 流程。
  4. 原始 PRD（`game-spec/source/01~08`）与用户提供的 `source-prd/` 逐字节一致，永不改写。
