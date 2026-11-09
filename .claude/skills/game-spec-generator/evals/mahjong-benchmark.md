# 卡五星 Benchmark（mahjong-benchmark）

## 输入数据（全部只读）

| 文件 | 测试点 |
| --- | --- |
| `examples/mahjong/game-spec/source/01-基础规则.md` | GDD：84 张牌、人数、庄家、行牌 |
| `02-游戏流程.md` | 游戏生命周期（开局/亮倒/荒庄/流局） |
| `03-打牌操作.md` | 操作规则与 Contract（摸打碰杠胡、优先级） |
| `04-番型.md` | 复杂规则与互斥关系（十四种番型） |
| `05-胡牌类型.md` | 条件判定与状态约束 |
| `06-结算.md` | 复杂计算规则（公式、封顶、包牌） |
| `07-配置.md` | 配置与规则联动（创房开关与默认值） |
| `08-UI交互.md` | Interaction（页面/控件/反馈） |
| `source-map.json`、`_map_base.json`、`_map_fan.json`、`_map_husettle.json`、`_map_ops.json` | 来源追溯锚点 |

需求附图及说明一并读取；不能读取的图片或缺失资料必须明确标记（登记进 source-analysis.md 附图表），不得推测。

## 输出位置

`examples/mahjong/spec-generation/`（由 `scripts/init_project.py mahjong` 脚手架生成）。不得覆盖现有 `game-spec/` 与 `source/`。

## 输入隔离约束（最重要）

- 第一轮生成**禁止读取**：现有 131 条 IR（`game-spec/manifest.yaml`、`requirements/` 等）、`open-questions.json`、`decision-log.json`、Decision Workbench 数据。
- 以上文件仅在 Step 7 评测时作为**独立对照**：GSG 独立发现的待确认项与现有 31 项 OQ 的重合率、差异项。

## 重点检查项（来自三轮评测要求）

1. **需求丢失**：84 张牌、三种杠（点杠/回手杠/直杠）、十四种番型、完整结算公式在四份文档中是否都能找到对应章节。
2. **AI 擅自决定**：OQ-013（字分是否参与结算）、OQ-014（杠开叠加）、OQ-015（首亮荒庄赔付对象）、OQ-016（第二家亮倒包牌）等口径，GSG 必须自行识别并保留未决，不允许擅自给结论。
3. **Contract 可开发性**：碰/杠/胡操作优先级、超时托管、抢杠胡、多人同时操作是否有状态、守卫、超时与互斥定义。

## 评测流程

1. 生成完成后运行 `python scripts/validate_docs.py examples/mahjong/spec-generation`。
2. 按 `evaluation-criteria.md` 人工评分（AI 只产出覆盖率明细与对照表）。
3. 与现有 IR + 31 项 OQ 独立对照，结果写入 `evaluation-report.md`。
