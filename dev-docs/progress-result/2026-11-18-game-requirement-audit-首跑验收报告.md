# game-requirement-audit 首跑验收报告（GRA-FIRST-RUN，run-001）

- 日期：2026-11-18
- 里程碑：GRA-FIRST-RUN（`dev-docs/progress/执行进度.md`）
- 结论：**验收通过**——S1~S11 全 11 阶段执行完毕并落档，产物不可变终检绿。

## 首跑配置

| 项 | 值 |
|---|---|
| 模板 | `templates/【杭州麻将】核心流程杭州麻将好友房AI-核心策划补齐版.md`（319 行） |
| 收窄 | `stageIds=ST-C01`（房间参数·单选，29 原子） |
| run | `spec-workflow/requirement-audit/2026-11-17/runs/run-001/`（200 文件） |
| journal | `run-mwkpasup-2`（8 次续跑收口，最终 147 agent / status=completed） |
| 模型 | deepseek-v4.1-flash-official（分析链） |

## 执行轨迹

- 首跑暴露集成缺陷 **I4~I14 共 11 项**，逐一修复后经 journal 续跑收口（详见执行文档 §21.8 与 `dev-docs/experience/` 8 篇）。
- 关键修复：I6 D-REFNORM 引用归一化（merge 重编号 vs agent 引用错位，13/9 项假故障）；I11 证据 ID 内嵌子串误判串阶段（18 项假故障）；I12 merge-evidence resume 幂等（analysisRunId 漂移作废 S7 重放分片 439 项）；I13 record-stage glob 尾泛化；I14 specs 幻影产物对齐。
- 中断副作用均已清理：孤儿 run-003~009 删除、`latest.json` 复原 → run-001；run-002（I7 越界产物）按真数据保留。

## 交付清单（run-001 产物树）

| 目录/产物 | 内容 |
|---|---|
| `1-registry/` | 需求扫描（23 阶段/319 行）+ 原子拆解（23 分片 / 109 功能 / 416 原子：client 98 / server 166 / both 152）+ 注册表定稿（requirement-registry + identity-map） |
| `2-client/` | 客户端查证：29 条目 / **12 CLE 证据**（判定 partial 8 / not_found 21 项分布见查证记录）+ source-manifest（含 4 个 FGUI 包引用） |
| `3-server/` | 服务端查证：29 条目 / **60 SVE 证据**（conditional 17 / active 6 / unknown 2 / inactive 4）+ scope-index（src/game_hzmj + src 双根） |
| `4-analysis/` | `unified-atoms.json`（**ar-2026-11-17-001**，416 原子 full 416 / conflict 0 / blocked 0 / upgraded 0）+ `business-behavior.json`（23 分片 / partial 8 / unverified 408）+ `difference-review.json`（69 复核条目：**approved 5** / stale-hold 64）+ `l7-classify.json`（verified 0 / 待验证 412 / not_applicable 4）+ analysis-history + 23 行为分片 |
| `5-specs/` | **23 份阶段规格文档** + `feature_index.json` + `trace_index.json` + `pending-list.md`（412 待补证据清单）+ `stage_manifest.md` + `策划版.md`（**416 条规则**全量策划视图）+ spec_check 闸门报告（覆盖校验绿：23 阶段 / 23 文档 / 416 原子 / blocked 0） |
| `6-review/` | `decisions.json`（**69 条人工决议**：ST-C01 5 条 approve + 64 条 hold）+ impact-set + decision-applicability + previous-evidence-index + retry-input |
| `runtime/` | stage-manifest（**11 阶段全落档**）+ run-state（completed）+ stage-args S1~S11 |

## 质量验证

| 验证项 | 结果 |
|---|---|
| verify-immutable | ✅ 11 阶段 / **72 产物** hash 逐字节一致 |
| S10 覆盖校验 | ✅ 23 阶段 / 23 文档 / 416 原子（blocked 0） |
| 策划版泄漏扫描 | ✅ 416 规则全量、无程序信息泄漏 |
| 确定性回归 | ✅ 11 套 **187 断言全绿**（I11 C5 / I12 J2~J4 / I13 B3 新增） |
| journal 终态 | ✅ 147 agent / status=completed（末次全缓存回放 0 tokens） |

## S4/S5 查证结论（ST-C01 收窄范围）

详见 `dev-docs/troubleshooting/2026-11-18-game-requirement-audit-S4S5查证问题记录.md`。要点：客户端可读源码**不含创房面板**（not_found 系统性缺口 21 项）；服务端**局数档实现缺失**（注释与实现不符）；「连庄不占局数」「碰算摊」客户端零命中；MsgGameConfig 缺档位字段；004 服务端兜底默认（平庄起）≠ 需求默认（笃三老庄）——S8 维持 partial 不升级 conflict。

## 遗留问题与后续批次

| 项 | 说明 |
|---|---|
| 387 原子未查证 | 收窄跑仅覆盖 ST-C01；其余 22 阶段待按批次补证（`mode=retry` / from-stage 链路已就绪） |
| 64 条 hold 决议 stale | 无证据指纹（按设计）；后续批次补证后须重新人工确认（不自动沿用） |
| L7 待验证 412 | 补证批次后按证据升级（verified/decision_required） |
| 64 条复核建议 pending | 随补证批次逐阶段裁决 |

## commit 索引

- 首跑与修复链：9bcae61 / 25a2645 / ad55bc1 / 715dfb9 / c986367 / ffcbaae（I6~I9）/ 59a9d7d（S4/S5 查证记录）/ 0835d96（I11）/ a033f8a（I12 + 4-analysis 产物）/ e0c99fb（I13）/ 本次（I14 + 全量产物 + 验收文档）
