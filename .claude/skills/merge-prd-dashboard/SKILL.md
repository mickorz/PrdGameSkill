---
name: merge-prd-dashboard
description: >
  将两份及以上本仓库生成的 PRD 检查/Bug 检查 Dashboard HTML（含 report-data JSON 的
  报告页）合并为单个带 Tab 切换的离线 Dashboard 文件，并完成浏览器渲染验证。
  当用户要求合并 dashboard、把多份分析报告合成一个页面、合并 PRD 检查/Bug 检查
  报告页时使用。
---

# Merge PRD Dashboard Skill

把多份同模板 PRD 检查 Dashboard（静态骨架 + `report-data` JSON + 渲染脚本三段结构）合并为一个单文件 Tab 切换版 Dashboard，产物离线可开。

## 何时使用

- 用户给出 2 份及以上 `*-Dashboard-*.html`，要求合并到一起 / 合成一个页面
- 用户要求对比查看多份 PRD 检查结果，且希望是单文件离线产物

## 能力边界

- 只做结构与呈现层合并；不改报告内容、不做跨报告去重或统计合并（各报告问题清单 Tab 隔离）
- 不负责单份 Dashboard 生成（`build-dashboard.mjs` / `/gen-dashboard` 的职责）
- 仅适用于本仓库 Dashboard 模板产物（无 `report-data` 标签的 HTML 会校验失败）

## 输入输出

| 项 | 说明 |
|---|---|
| 输入 | ≥2 份 Dashboard HTML 路径（顺序即 Tab 顺序，最后一份为骨架来源） |
| 可选 | `--out` / `--out-dir` / `--label <序号>=<文字>` |
| 输出 | 单文件 `合并-Dashboard-<标签>+<标签>-<YYYYMMDD>-<NN>.html`（序号自动递增不覆盖），脚本输出 `[成功]` / `[失败]` |

## 执行

按 `references/merge-flow.md` 流程执行，核心步骤：

1. 确认输入为模板产物（grep `id="report-data"`）
2. 运行合并脚本：`node .claude/skills/merge-prd-dashboard/scripts/merge-dashboard.mjs <file1> <file2> ...`
3. 脚本内置结构自检，`[失败]` 时按原因修复后重跑，不要产出半成品
4. **必须浏览器验证**（console 无报错、双 Tab 渲染条数、抽屉、筛选、切换重置），清单见 flow 第 5 步——结构自检通过不代表渲染正确
5. 用 pi-cite-wslpath 给出产物链接，按仓库规则 commit + push

## 完成标准

- 脚本 `[成功]` 且产物自检全过
- 浏览器验证清单全过（每份报告条数正确、切换无状态残留、console 干净）
- 产物链接已给用户，变更已提交推送
