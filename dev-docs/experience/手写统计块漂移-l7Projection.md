# 手写统计块与条目数据漂移（l7Projection 踩坑）

- **日期**：2026-11-14
- **阶段**：OSG-W4 S1.1（classify-l7.mjs 实现过程中发现）
- **同类前科**：二审意见 1（afterReviewProjection 手写预测值，已修）——本坑是同一类问题的漏网实例

## 问题现象

`spec-workflow/output-spec/server-rule-verify/difference-review_sample.json` 顶层 `l7Projection` 手写为：

```json
"l7Projection": { "verified": 2, "verification_required": 10, "decision_required": 2, "not_applicable": 0 }
```

但逐条按设计 4.1 矩阵重算 14 条 entries 的 `l7`，实际分布为 `verified 1 / verification_required 11 / decision_required 2 / not_applicable 0`。统计块与条目数据自相矛盾。

## 排查过程

1. S1.1 预检：写脚本前先用 node 对四件套做一致性预检（previousDifference 对齐基线、evidenceIds 存在、逐条 l7 按矩阵重算），发现**逐条字段全部自洽**（bad=0），但顶层 `l7Projection` 汇总与重算不符。
2. 定位根因：二审修订撤销了 AT-ST-C01-002 的升级建议（active 降 unknown、l7 由 verified 类建议改为维持 verification_required），当时同步重算了 `afterReviewProjection`（迁移统计），但 `l7Projection` 统计块**没有一起重算**，残留撤销前的口径（verified 2 多算了 C01-002）。
3. 佐证：`afterReviewProjection.transitions` 只剩 AT-ST-C04-013 一条迁移，若 C01-002 升级建议仍在则应有两条——l7Projection 的 verified 2 与之矛盾，确认为残留旧值。

## 根因

1. **统计块是手工维护的汇总**，条目数据变更时没有任何机制强制同步重算，靠人记忆逐块更新，漏一块就漂移。
2. 二审修复是「按意见逐项修」，意见 1 只点名了 `afterReviewProjection`，同文件里语义同源（均为预测统计）的 `l7Projection` 不在意见清单里，跟着条目一起被改了数据却没被重算。
3. 漂移后无人发现：样本交付时没有确定性重算比对，肉眼看 14 条条目和两个统计块不会去数数。

## 解决方案

1. `classify-l7.mjs`（`.opencode-workflows/scripts/`）内置**手写统计交叉校验**：条目级 `l7` / `effectiveDifference` / `l7Basis` 与矩阵重算不符即 fail；顶层 `baseline.differenceStats` / `afterReviewProjection` / `l7Projection` / `scope-index.stats` / `feature_index.difference_stats` / `atom_count` 全部按确定性重算比对，任一不符 fail 且不写输出。
2. 样本 `l7Projection` 已按重算修正为 1/11/2/0，并在 `sampleNote` 与块内 `note` 登记修正原因。
3. example（classify-l7.example.mjs）断言「重算分布 === 条目推算分布 === 样本 l7Projection」，把该约束固化为回归闸门。

## 预防/注意事项

1. **一切统计块必须由脚本确定性计算，禁止手工填写**——包括「预测/投影」类统计（afterReviewProjection、l7Projection），它们同样可以由 previousDifference→reviewedDifference 与矩阵确定性推出，没有理由手写。
2. **修订数据时先列出全部受影响的派生统计**再动手：条目字段一变，同文件所有汇总块（baseline/afterReviewProjection/l7Projection/stats）都在影响面上，逐块重算或删掉手写块改为脚本生成。
3. **评审意见按「问题类」而不是「点名实例」落实**：意见 1 的本质是「预测统计禁止手写」，落实时应扫描同类统计块，而不是只修被点名的那一个。
4. 交叉校验放进消费方脚本（classify-l7）而不是只放在独立 verify 里：消费数据前先验数据，漂移数据在入口即被拦截，不会流入下游产物（l7-classify.json / 后续策划版投影）。
5. 本坑也验证了「先预检后写码」的价值：写实现前先对真实样本做独立重算，漂移在预检阶段就暴露，而不是实现完跑 example 才炸。
