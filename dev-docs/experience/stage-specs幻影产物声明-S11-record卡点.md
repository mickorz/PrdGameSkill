# stage-specs 幻影产物声明——S11 record 首次执行即炸（I14）

- 日期：2026-11-18
- 关联：执行文档 §21.8 I14
- 组件：`.opencode-workflows/scripts/stage-specs.game-requirement-audit.json`（S11 outputFiles）× `apply-decisions.mjs`（产物清单）

## 问题现象

第七次续跑推进到 record-stage S11 失败：`outputHash 解析失败（S11）：run: 文件不存在：run:6-review/runtime/decision-apply.json`——此前 S11 的三条命令（decision-fingerprint bind / check / apply-decisions）均已手动预验证绿，唯独阶段指纹落档失败。

## 根因

`stage-specs.game-requirement-audit.json` 的 S11 `outputFiles` 声明了 `decision-apply.json`，但 `apply-decisions.mjs` **从不产出该文件**——真实产物为 `impact-set.json`、`decision-applicability.json`、`previous-evidence-index.json`、`retry-input/*.json`、`difference-review.json`（后两者回写）。specs 与脚本的产物清单脱节（**幻影声明**：声明了从未实现的产物）；且 `previous-evidence-index.json` 在执行文档 P1-2/D55 有档却漏声明。record-stage S11 前七次运行从未执行到（每次死在更早闸门），首次执行即暴露。

## 解决方案

specs 对齐真实产物：删幻影 `decision-apply.json`，补 `decision-applicability.json` + `previous-evidence-index.json`。record-stage S11 手动 record 成功（6 产物指纹落档）；11 套 187 复归全绿。

## 预防/注意事项

- **specs 的产物清单是「契约」而非「愿望」**：outputFiles 每一条都必须对应脚本的真实 writeFileSync 落点。可行防呆：对 specs 产物清单做静态扫描（每条能对应脚本写入点）或首跑 record 前做存在性预检。
- **每个阶段的首次 record 命令，续跑前必须手动预跑**：I13 学过一次（S10 record 未预跑直接续跑炸在 glob），I14 又被咬（S11 的三条 apply 命令预验证了，但 record 本身没预跑）。教训泛化：**修复链路上任何「从未执行过的命令」都应在续跑前单独手动执行一遍**，而不是把首次执行留给整跑。
