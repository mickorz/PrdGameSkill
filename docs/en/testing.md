# Install & Run Acceptance Checklist

## Overview

本仓库为纯文档/技能库，验收即检查结构完整性与规范符合性。以下清单适用于初始化或大改动后的自检。

## Installation Checks

- [ ] `dev-docs/` 下恰好 10 个子目录：design、meeting、todos、troubleshooting、research、planning、progress、progress-result、guides、experience
- [ ] `docs/` 下 6 篇英文文档与 `zh-CN/` 6 篇中文版同名同结构
- [ ] `.gitignore` 忽略 `thirdparties/` 与 `dev-examples/`
- [ ] `dev-docs/` 未被忽略（本项目约定随仓库入库）
- [ ] `CLAUDE.md` 的类型表与 `dev-docs/` 实际子目录一致

## Smoke Test

- [ ] `ls dev-docs/ | wc -l` 输出 `10`
- [ ] `git check-ignore thirdparties dev-examples` 两条路径均命中
- [ ] `git check-ignore dev-docs` 无输出（不应被忽略）
- [ ] 新建一篇测试文档能正常提交并推送

## Final Checklist

- [ ] README.md 的目录结构描述与实际一致
- [ ] docs/ 英文与中文版本内容同步
- [ ] dev-docs/progress/执行进度.md 为最新状态
