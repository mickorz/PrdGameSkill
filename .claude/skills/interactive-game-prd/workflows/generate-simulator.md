# Workflow: generate-simulator

> 模式：Create / Generate。目的：将已确认规则转换为可回放的游戏模拟器。

## 触发方式

generate-ir 冻结后（P4 阶段）。

## 输入

- 冻结 IR 中 approved 的规则（RULE_TABLE 依据）
- `assets/simulator-template/engine.js` 框架契约

## 步骤

1. 写 `examples/<game>/simulator/simulator.js`：
   - UMD 结构（Node 测试 require / 浏览器内嵌双用途）；
   - `RULE_TABLE` 声明实现的规则 ID 与 IR 中的 authority；
   - 逻辑核心（createGame：dispatch/getState/snapshot/restore）与 DOM 适配（create）分离；
   - 每个判定分支输出 `rule_ref` 日志。
2. 规则守卫：查表不存在或 authority=open 时抛 `RULE_NOT_CONFIRMED`，禁止编造判定。
3. 场景回放：初始状态 + 操作序列（JSON），预期结果引用 GAME-TC ID。
4. 测试：`node scripts/simulator.test.mjs` 覆盖正常 / 非法 / 边界 / 状态异常四类场景。
5. 重新构建 HTML 注入模拟器（generate-html 步骤 2）。

## 质量门

- 全部场景回放通过。
- 故意改错一条规则能让对应场景失败（测试有效性验证，首次建立时做一次）。
- 每个实现的规则函数头部注释标明 GAME-RULE ID。

## 输出

- `examples/<game>/simulator/simulator.js` + 更新后的 HTML 产物。

## 禁止事项

- 只实现 approved 规则；规则缺失输出 RULE_NOT_CONFIRMED，不参照其他游戏补全。
- 逻辑核心禁止 import DOM（保证 Node 可测）。
