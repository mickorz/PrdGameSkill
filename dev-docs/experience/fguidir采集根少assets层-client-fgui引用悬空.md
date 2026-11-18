# fguiDir 采集根少 assets 层——client-fgui 引用悬空

- 日期：2026-11-18
- 关联：执行文档 §21.8 I9
- 组件：`game-requirement-audit.js`、`4-client-verify.js`、`collect-source-manifest.mjs`

## 问题现象

客户端采集闸门失败：`client-fgui:box_hzmj_back/BoxHzmjBackView.xml` 等 4 条报「证据文件在声明的源码根下均不存在」，但文件真实存在（`Fgui/assets/box_hzmj_back/…`）。run-001 客户端却通过——因为那轮 agent 恰好没引用任何 FGUI 文件。

## 排查过程

1. 全盘搜 `BoxHzmjBackView.xml`：实际路径 `source-code/client/Fgui/assets/box_hzmj_back/BoxHzmjBackView.xml`。
2. agent 引用形态：`client-fgui:box_hzmj_back/…`——**assets 相对路径**（组件包根 = `Fgui/assets`）。
3. 配置根：`fguiDir` 默认 `source-code/client/Fgui`（旧 output-spec-generate 时代的工程根），多了一层 → 解析必然失败。

## 根因

**配置根与引用约定错位**：FGUI 的证据引用约定是「组件包根相对」（`box_hzmj_*/…`），而 `fguiDir` 沿用了旧工作流的「工程根」（`Fgui/`，其下才是 `assets/`）。旧工作流 agent 只是拿 Fgui/ 当探索目录用、没把它当采集根，所以问题从未暴露；新工作流把 fguiDir 直接接到 `--roots` 采集上，错位立即显形。

## 解决方案

`fguiDir` 默认改为 `source-code/client/Fgui/assets`（主编排 + `4-client-verify.js` 回退值与 Prompt 描述 + 手册默认值表）；既有 run 的 `runtime/stage-args-S4.json` 同步（保持 configArgs 快照与实际执行一致）。验证：run-002 真实 evidence-files（22 文件含 4 个 fgui 引用）采集绿。

## 预防/注意事项

- 「探索根」与「采集根」语义不同：agent 可以从工程根自由探索，但采集解析根必须与**引用约定的相对基准**一致。
- 换用旧参数时先做一次真实样本采集（拿 agent 实际引用的文件清单跑 collect），别只跑目录存在性检查（主编排的 `fileExists(fguiDir)` 对 `Fgui/` 也通过，掩盖错位）。
