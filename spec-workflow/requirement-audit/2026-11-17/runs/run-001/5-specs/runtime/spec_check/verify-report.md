# 规格机械校验报告

- 日期：2026-11-17
- 分析轮次：ar-2026-11-17-001

## 统计

| 项 | 值 |
|---|---|
| 原子总数 | 416 |
| verified | 0 |
| verification_required | 412 |
| decision_required | 0 |
| not_applicable | 4 |
| blocked（派生 verification_required） | 0 |

## 机械校验

| 校验项 | 结果 | 详情 |
|---|---|---|
| 计数自洽（feature_index.stats.atomCount = 原子总数） | 通过 | 416 vs 416 |
| 原子 ID 一致（feature_index 原子 ⊆ Registry 原子） | 通过 | 416 vs Registry 原子数 |
| blocked 原子 difference 留空 | 通过 | blocked 原子 difference 必须为空 |
| blocked 原子 l7Basis=pending-blocked | 通过 | blocked 派生口径 |
| 所有原子 l7 非空 | 通过 | l7 必须全部有值 |

