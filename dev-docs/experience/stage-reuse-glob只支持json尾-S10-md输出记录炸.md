# stage-reuse record-stage 只支持 *.json 尾 glob——S10 *.md 输出首次记录即炸（I13）

- 日期：2026-11-18
- 关联：执行文档 §21.8 I13
- 组件：`.opencode-workflows/scripts/stage-reuse.mjs`（resolveSpecEntry）

## 问题现象

第四次 journal 续跑推进到 record-stage S10 失败：`outputHash 解析失败（S10）：run: 文件不存在：run:5-specs/stages/*.md`——此前 S7/S8/S9/S10 全部通过（含 I11 修复后的 S10 覆盖校验），唯独阶段指纹落档失败。

## 根因

`resolveSpecEntry` 的 run: 路径解析只支持 **`/*.json` 尾 glob**（`rel.endsWith('/*.json')`），其他后缀走「字面文件存在性检查」分支。而 stage-specs 里 S10 的 `outputFiles` 声明了 `run:5-specs/stages/*.md`（23 份阶段规格文档）——S1~S9 的产物恰好都是 `.json`（atom-parts glob 也是 `*.json`），**S10 是首个非 json glob 输出的阶段，且 record-stage S10 在前三次运行中从未执行到**（每次都死在更早的闸门），因此该缺陷直到第四次续跑才暴露。

## 解决方案

glob 尾泛化：`rel.match(/\/\*\.([A-Za-z0-9]+)$/)` 命中即按 `*.<ext>` 展开（目录列举 + 后缀过滤 + 码元序排序），`*.json` 行为不变（子集）。回归：`stage-reuse.example.mjs` 新增 B3（独立 specs fixture + 新 init run 记录 `*.md` glob，断言 outputList 展开；不复用 run-001/002 避免污染 A~I 组用例与 run 编号断言）。11 套 187 全绿；真实 run-001 S10 手动 record 成功（28 产物指纹落档）。

## 预防/注意事项

- **通用工具的「特例命名」**：glob 支持只写了 `*.json` 是把「当时的用例」当成了「通用语义」；凡是按模式匹配的解析器，模式应参数化（后缀/前缀），不要为单一后缀写死分支。
- **未执行过的代码路径里藏着未测的集成点**：record-stage S10 前四次都没执行到——闸门修复后第一次走到就踩新雷。修复链路上的闸门后，应尽快把该阶段 record 命令手动跑一遍预验证，而不是直接续跑全流程（本次 S10 record 已手动预验证，S11 若有类似首次路径也应照做）。
