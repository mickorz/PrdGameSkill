# output-spec-generate 优化台账

> 每版一行的流水索引（schema 见 workflow-optimize skill reference/ledger-schema.md）。台账行一旦写入历史版本不再改写。

| 版本 | 日期 | 主题标记 | 备份文件 | runId | 耗时s | token | 轮次 | 结果 | 自评 | 奖牌 | 报告路径 | 遗留数 |
|------|------|----------|----------|-------|-------|-------|------|------|------|------|----------|--------|
| v1 | 2026-11-13 | org 原始版（单 agent 写整份阶段文档） | 3-produce-outputs.v1-org-20261113.js / 2-verify-stages.v1-org-20261113.js | run-mwep59gd-1（主 run+3 次 resume） | 23220+6300（回溯补录：首跑+续跑 08:10~14:37Z 跨 23220s + 修复脚本 3 次 ≈6300s，含失败重试损耗） | 480380 in / 142553 out（journal 顶层口径）+ 修复脚本 ≈78K | 首跑失败+3 次续跑+3 次独立修复（回溯补录） | passed（经手工修复后放行；首跑与两次续跑均失败） | 27 次失败 attempt（agent超时 18 / schema 降级 2 / provider_timeout 5 / 输出中断 2） | -（回溯补录，无多版产物对比） | dev-docs/progress-result/output-spec-generate-演进报告-v2.md | 6 |
| v2 | 2026-11-13 | FP 产出分片写盘+落盘闸门（已验证方案回填 3-produce-outputs.js） | （v1 备份见上行） | run-mwf3k0na / run-mwf40sdo（分片机制以修复脚本形态真实执行验证；主流程全量重跑未执行） | 2126（修复 v2 三片 670+639+291+重试）+815（修复 v3 补片） | ≈47K in / ≈378 out + 991（快照口径） | 1 轮（分片 3/4 片一次成功，1 片重试一次） | 分片产物 passed（spec_stage_ST-C11.md 100907B + 机械校验放行） | 分片 4/5 次落盘成功；输出中断 1 次（重试成功） | -（单版机制验证，无多版产物对比） | dev-docs/progress-result/output-spec-generate-演进报告-v2.md | - |
| v3 | 2026-11-13 | VT 查证墙钟加固（timeoutMs 3600s→7200s，retries 1→2） | （v1 备份见 v1 行） | 未执行（机制落地，待下次真实运行观察） | - | - | - | 待观察 | 待观察 | - | dev-docs/progress-result/output-spec-generate-演进报告-v2.md | - |

## 备注

- v1 回溯补录：数据从 journal/run-mwep59gd-1.json 与修复 runs 复算回填（2026-11-13 首跑复盘），产物无快照（ST-C11 缺失失败态已被修复覆盖）。
- v2 执行形态说明：分片方案先以一次性修复脚本（fix-st-c11-doc-2/3.js，temp 目录未入库）真实执行验证有效，再回填 3-produce-outputs.js；主流程全量重跑未执行（产物已交付，重跑成本高），机制验证走 splitDocParts 15/15 + merge example 20/20 + wf-syntax-check。
- v3 效果结论待下次真实执行补充，不冒充已验证。
