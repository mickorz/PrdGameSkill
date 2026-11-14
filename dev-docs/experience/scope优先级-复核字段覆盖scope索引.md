# scope 优先级：difference-review 复核字段覆盖 scope-index Atom 级判定

## 问题现象

OSG-W4 S2.1 深查落判时，23 条 unknown 原子的服务端证据已集齐，用临时脚本把 `scope-index_sample.json` 全部条目升级为 active/conditional（stats active 14 / conditional 20 / unknown 0），随后用 classify-l7.mjs CLI 重生成 `l7-classify_sample.json`：

- l7 分布正确不变（verified 1 / verification_required 11 / decision_required 2）
- **但 6 条 reviewed 原子（C01-002/C02-006/C02-007/C02-009/C04-001/C04-012）的 `scopeApplicability` 仍是 `unknown`**，scope-index 里明明已写成 active/conditional

## 排查过程

1. 先怀疑 CLI 没吃到新 scope-index：直接读盘确认 scope-index 已更新（C01-002 applicability=active，stats 正确），排除写盘失败
2. 再怀疑 CLI 参数顺序错：核对 `<featureIndex> <scopeIndex> <serverEvidence> <differenceReview> <outputJson>` 顺序无误
3. 读 classify-l7.mjs 的 `resolveScope(reviewEntry, scopeEntry)`（约 L83-90）：

```js
const reviewScope = typeof reviewEntry.scopeApplicability === 'string' && reviewScope !== '' ? reviewEntry.scopeApplicability : ''
const atomScope = scopeEntry && typeof scopeEntry.applicability === 'string' && ... ? scopeEntry.applicability : ''
const candidateSource = reviewScope !== '' ? 'review-field' : atomScope !== '' ? 'scope-index-atom' : 'missing-unknown'
```

4. 查 `difference-review_sample.json`：6 条原子的 DR 条目里**手写着 `scopeApplicability: "unknown"`**（T0.4 复核时写的结论）——review 字段非空且优先级最高，scope-index 的新值被覆盖

## 根因

scope 解析优先级（设计 3.1）：**difference-review 复核字段 > scope-index Atom 级 applicability > unknown**。scope-index 是判定底稿，DR 复核字段是复核员结论；只要 DR 条目写了非空 `scopeApplicability`，classify 一律采信复核字段。首轮只更新了底稿没更新复核结论，复核员旧结论继续生效。

## 解决方案

S2.1 深查本质是复核的延续：把 6 条 DR 条目的复核字段同步升级（unknown → active×5 / conditional×1，附 scopeNote 引 SVE 编号），再重生成 l7-classify——6 条 scope 正确变为 active/conditional 且 `scopeSource='review-field'`，l7 分布保持 1/11/2/0（矩阵上 unverified/partial × 非 inactive → verification_required，scope 变化不改 l7）。

## 预防/注意事项

1. **改作用域要写两处**：scope-index 条目（底稿 + stats 重算）+ difference-review 复核字段（结论），只写一处会被优先级规则挡住；差异结论（previousDifference/reviewedDifference）与 scope 结论是两个独立字段，不要混改
2. `AT-ST-C15-018` 例外：conflict 原子走证据级 scope（evidenceScopes 优先于复核字段），补据写 scope-index 的 evidenceScopes 即可，**不要**动 DR 复核字段（否则 scopeSource 从 evidence-level-client-visual 变 review-field，会打破 classify-l7.example 的 S1.4 回归锚点）
3. S2.3 workflow 化时，3-verify-scope 子流程的落盘步骤必须包含「双写」：scope-index 条目 + DR 复核字段，并在自检里加「scope-index 与 DR 复核字段不一致即报 problem」的闸门
4. 手写统计块（如 l7Projection）与派生统计（stats）一样有漂移风险，改条目后必跑 classify-l7 CLI 重生成 + example 回归（classify-l7.example A 段有真实样本重跑一致性断言）
