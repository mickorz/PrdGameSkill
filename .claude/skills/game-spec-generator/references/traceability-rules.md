# 追溯规则（Traceability Rules）

> 产物：`traceability-matrix.yaml`；模板：`templates/Traceability-Matrix.template.yaml`

## 链路方向

```
Source(SRC-xxx) -> GDD(GDD-Rxxx) -> PRD(PRD-xxx) -> Interaction(INT-xxx) -> Contract(CT-xxx) -> Test(TC-xxx)
```

## 关联类型

| 类型 | 含义 | 登记 |
|---|---|---|
| 一对多 | 一个源事实衍生多份文档条目 | 目标 ID 列表写多个 |
| 多对一 | 多个源事实汇聚一个条目 | 多行 link 指向同一目标 ID |
| 缺失关联 | 某层缺条目 | gaps: missing-gdd / missing-prd / missing-interaction / missing-contract |
| 孤立需求 | 目标条目没有任何源事实 | gaps: orphan |
| 待确认依赖 | 链路上存在 UNKNOWN/CONFLICT/pending | gaps: pending-confirmation |

## 硬性规则

1. 每个 SRC 事实必须出现在矩阵中；每条 GDD 规则必须能回溯到至少一个 SRC。
2. gaps 只登记不修复——修复属后续步骤，禁止为了消 gap 而编造内容。
3. summary 统计（total_sources / fully_traced / with_gaps）必须与 links 一致（validate_docs.py 会核对）。
4. 关键内容（结算公式、番型全量、操作优先级）允许一对多，不允许断链。
