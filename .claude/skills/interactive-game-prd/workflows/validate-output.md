# Workflow: validate-output

> 模式：Validate / Export 质量门。目的：串联全部确定性校验，输出机器可读一致性报告。

## 触发方式

Generate 完成后；Export 前（必须）；用户主动 Validate。

## 输入

- `examples/<game>/` 全量

## 步骤

1. 一键执行：`node scripts/validate-output.mjs examples/<game> [--json]`，串联：
   - validate-ir（IR 结构 / ID / 引用 / 来源 / 状态流转 / source-map）
   - validate-html（模板变量 / 外链 / 数据内嵌 / 组件覆盖）
   - 模拟器测试（simulator.test.mjs 存在时）
2. 检查报告指标（需求文档 9.4）：需求覆盖率、UI 覆盖率、测试覆盖率分开计算，不合并总分。
3. result 判定：
   - `pass`：errors=0 且无未豁免 blocking；
   - `needs_review`：仅 warnings 或已豁免的 blocking；
   - `fail`：存在未豁免 errors。

## 质量门

- Export 必须在 result=pass（或人工豁免记录在案）后执行。

## 输出

- 机器可读 JSON 报告（blocking_issues / warnings / 各覆盖率）。

## 禁止事项

- 校验失败不得打 ZIP。
- 不得用 AI 阅读方式替代脚本判定（三层职责红线）。
