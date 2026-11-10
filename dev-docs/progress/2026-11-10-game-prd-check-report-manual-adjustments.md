# 杭州麻将 PRD 检查报告手动调整记录

- 建立日期：2026-11-10
- 调整对象：`examples/game-prd-check-workflow/report.md`
- 约定：workflow 脚本（`.opencode-workflows/workflows/game-prd-check.js`）暂停改动，报告调整直接手工编辑，本文件只做记录

## 一、当前基线

| 项目 | 内容 |
| --- | --- |
| 报告文件 | examples/game-prd-check-workflow/report.md |
| 生成方式 | game_prd_check workflow（fast 档 + 质检），commit 44b8f0d |
| 检查对象 | input\【杭州麻将】核心流程杭州麻将好友房AI.md |
| 检查范围 | 排除金币场（本期不检查） |
| 问题总数 | 144（P0 15 / P1 66 / P2 56 / P3 7） |
| 主题数量 | 22 |
| 检查日期 | 2026-11-10 |

主题前五：文档规范要素缺失 14、发牌与开局流程缺陷 13、重连恢复细节缺失 11、禁手与特殊规则缺陷 11、三摊承包口径冲突 11。

## 二、调整记录

| 序号 | 日期 | 调整内容 | 涉及问题或章节 | 调整原因 | 复核人 |
| --- | --- | --- | --- | --- | --- |
| - | - | 暂无，等待手动调整 | - | - | - |

## 三、记录规范

1. 每次手动调整后，在“调整记录”表追加一行，写明改了什么、涉及哪些问题 ID 或章节、为什么改。
2. 涉及问题条目删除、合并、改优先级时，同时登记调整后的总数与优先级分布，便于与基线对比。
3. 涉及原始引文修改时必须注明“引文已人工核对”，避免与检查证据混淆。
4. 只记录对 report.md 的手工变更；workflow 脚本变更不记入本文件。

## 四、引用说明

- 报告基线：`examples/game-prd-check-workflow/report.md`
- 检查规范：`.claude/skills/game-prd-check/SKILL.md`
- 报告模板：`.claude/skills/game-prd-check/references/templates/report.template.md`
- workflow 优化记录：`dev-docs/design/2026-11-10-game-prd-check-workflow-optimization.md`
