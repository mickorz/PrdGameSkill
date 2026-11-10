# Workflow: generate-html

> 模式：Generate。目的：从 IR 构建离线 Interactive HTML PRD。

## 触发方式

generate-ir 冻结后；或用户要求重新生成。

## 输入

- 冻结的 `game-spec/`
- （可选）`simulator/simulator.js` —— 存在则注入 Level 2 模拟器

## 步骤

1. 确认 game-spec 未被冻结后修改（比对 FROZEN.md 的 SHA-256）。
2. 构建：`node scripts/build-html.mjs <game-spec> <output> [simulator]`。
   - 数据内嵌为 APP_DATA 常量（file:// 无法 fetch，硬约束）。
   - 模拟器代码作为 simulator.enabled + simulator.code 注入。
3. 质量检查：`node scripts/validate-html.mjs <output> <game-spec>`。
4. 冒烟测试（开发环境）：`node scripts/html-smoke.test.mjs <output>`。
5. UI Demo 两层级说明：
   - 无模拟器：Level 1 静态原型 + 状态切换假交互；
   - 有模拟器：Level 2 规则驱动，判定日志实时可见。

## 质量门

- validate-html PASS（无未替换变量、无外链、组件覆盖完整）。
- html-smoke 全部通过（开发环境执行）。

## 输出

- `output/interactive-game-prd/index.html`（单文件）

## 禁止事项

- 不修改 IR 或 approved 规则（Generate 只读 IR）。
- 不引入外链资源（CDN、在线 API）。
