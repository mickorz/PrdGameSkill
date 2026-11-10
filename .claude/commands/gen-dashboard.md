---
description: "快速生成新的 PRD 检查 Dashboard HTML 报告：/gen-dashboard [report.md路径]，不带参数默认 workflow 版报告；同日多次生成序号自动递增不覆盖"
---

# gen-dashboard

用户输入：$ARGUMENTS

按以下步骤执行（不要询问用户，直接执行）：

## 1. 确定 report.md 路径

- 若 $ARGUMENTS 给出了路径（相对仓库根），使用该路径
- 未给参数时，默认使用 `examples/game-prd-check-workflow/report.md`
- 若路径不存在，检查 `examples/game-prd-check/report.md`（skill 版），都不存在则列出 `examples/*/report.md` 让用户选择

## 2. 运行转换工具

```bash
node .claude/skills/game-prd-check/scripts/build-dashboard.mjs <report路径>
```

兼容 skill 版与 workflow 版两种报告格式（自动识别）。

## 3. 处理结果

- **校验失败**（输出含 `[失败]`）：不要生成产物，向用户展示错误清单（统计与明细不一致、字段丢失等），等待修复 report.md 后重跑
- **成功**（输出含 `[成功]`）：从输出中取新产物 HTML 路径（文件名格式 `{项目名}分析-Dashboard-{YYYYMMDD}-{序号}.html`，序号自动递增）

## 4. 收尾

- 用 pi-cite-wslpath 把新 HTML 路径转成可点击链接给用户（直接双击可离线打开）
- Dashboard 产物目录已 gitignore（本地保留）：workflow 版 `examples/game-prd-check-workflow/dashboard/` 不入库；若 report.json 有变更则提交推送，提交信息用 `chore: 重新生成 Dashboard（{文件名}）`
- 不删除历史序号产物（-01/-02/... 保留用于版本对比）
