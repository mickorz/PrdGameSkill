# ui-interaction-prd-extract 优化台账

每版一行的流水索引，闭环各步陆续补列。口径见 `遗留问题清单` 同目录的指标对比文档。台账行一旦写入历史版本不再改写。

## 台账

| 版本 | 日期 | 主题标记 | 备份文件 | runId | 耗时s | token | 轮次 | 结果 | 自评 | 奖牌 | 报告路径 | 遗留数 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| v1 | 2026-11-13 | 原始版（回溯补录） | ui-interaction-prd-extract.v1.js.bak | run-mwee0k70-1 | 6098.5 | 248703 | 1 | passed | RED | - | （无独立报告，耗时分析见 dev-docs/design/2026-11-13-ui-prd-check修正报告耗时分析与优化方案.md） | 6 |
| v2 | 2026-11-13 | FX 修正闭环提速（A1+B1+B4） | ui-interaction-prd-extract.v2-FX-20261113.js（完成后备份） | | | | | | | | | |

## 版本备注

- v1 为回溯补录：当前脚本在 2026-11-13 执行的完整 run（run-mwee0k70-1，消费共享快照 ext-20261112-01）。产物快照 `examples/ui-interaction-prd-extract-workflow/quality-compare/v1/`。
- 历史背景：`examples/ui-interaction-prd-extract-workflow/dashboard/` 下另有 2026-11-11 的历史 Dashboard（台账建立前的早期执行，不单独设版本行）。
- v1 自评 RED 依据（对账见指标对比）：报告硬缺陷 = 非法基准条款号 9 + U+FFFD 乱码 2 + 审核质检未通过项 14（其中 10 项由修正 agent 手工修复，条款号项修复链路缺失未修）。
- 版本规划（依据 2026-11-13 优化方案落地清单，含合理调整）：方案原列 3 个改动步，实际收敛为 2 版——A2（校验）不配 A3（修正链路）会让 run 直接失败、A3 不配 A2 无触发条件，二者必须同版落地（v3）；A4 与 C 同属条款号闸门主题。B2/B3 在 A1+B1 落地后失去必要性，记入演进报告决策，不单独设版。
