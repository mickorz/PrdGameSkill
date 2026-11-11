# 对比分析：game-ui-design-workflow / spec-generation / ui-interaction-prd-extract

- 日期：2026-11-11
- 对比对象：
  1. `thirdparties/game-ui-design-workflow`（第三方，只读参考）
  2. `examples/mahjong/spec-generation/`（本仓库 game-spec-generator 七步流水线的产物）
  3. `.claude/skills/ui-interaction-prd-extract/templates/`（本次新设计的逆向提取模板）

## 1. 对象澄清与血缘关系

**前提纠正**：`spec-generation` 不是 `game-ui-design-workflow` 的产出。证据：

- `spec-generation/evaluation-report.md` 开头标注"GSG 第 7 步产物"，校验走 `validate_docs.py`，输入隔离声明读取本仓库 `game-spec/manifest.yaml` 的 IR
- 它的输入是 `input/` 下的人工需求文档（source-prd/08-UI交互.md 等），不是 game-ui-design-workflow 的 specs 工作区

但两者**结构同源**：spec-generation 的 `Interaction.md` 章节骨架（文档状态 / 全局交互原则 / 全局导航 / 全局状态 / 分页面交互【目的、进入离开、主流程、控件与行为、状态机、弹窗二次确认】）与 `game-ui-design-workflow/templates/spec-kit/interaction.md` 完全一致，前者是后者经 game-spec-generator 加强后的本仓库实现。

三者定位：

| | game-ui-design-workflow | spec-generation | ui-interaction-prd-extract |
|---|---|---|---|
| 方向 | **正向**：概念 → UI 资产 | **正向**：需求文本 → 四层 spec | **逆向**：代码 + FGUI 工程 → PRD |
| 终点 | 生图 / 切图 / Atlas 引擎交付 | GDD/PRD/Interaction/Contract 可评审文档 | 逆向还原的 UI 交互 PRD |
| 事实源 | 策划概念 + 参考图 | 人工写的原始需求文档 | Cocos 代码 + FairyGUI XML |
| 主要消费者 | AI 生图提示词、设计师 | 产品/策划/程序评审 | 策划复盘、PRD 重建、新项目复用 |

## 2. spec-generation 产出体系拆解（对比重点）

### 2.1 四层文档分工

| 文档 | 职责 | 规模 |
|---|---|---|
| GDD.md | 玩法判定（何时可碰杠胡、番型、算分、封顶公式） | 635 行 |
| PRD.md | 功能需求与验收（P0/P1/P2 分级 65 条） | 277 行 |
| Interaction.md | 界面表现、操作与反馈（13 页面 / 53 个 INT 交互） | 1000 行 |
| Interaction-Contract.yaml | 平台无关业务行为契约（48 条 CT，每条 14 字段） | 1034 行 |

分工纪律严格：玩法细节以引用指向 GDD 不重复展开；Contract 不出现引擎 API 名。

### 2.2 交互限制的结构化表达（Interaction-Contract.yaml 14 字段）

每条 CT-xxx 契约：

```yaml
trigger: 触发（用户操作或系统事件）
preconditions: [前置条件]
guards: [守卫/限制 —— 置灰、禁用条件、资格检查]
state_transition: {from, to}
data_effects: [数据变化]
ui_effects: [界面表现]
failure_handling: [失败/异常处理]
timeout_handling: 超时行为（含托管默认动作）
mutual_exclusion: [互斥约束]
test_scenarios: [可验收断言 3~4 条]
source_references: [SRC-xxx 溯源]
confirmation_status: draft / pending-human / confirmed-human
```

**这就是"交互限制文档"的本体**：限制不是散文，而是 guards / mutual_exclusion / timeout_handling / failure_handling 四类结构化字段。

### 2.3 溯源与质检闭环

- 事实分级：SRC-xxx（原文事实 999 条）/ DERIVED（推导，必须带依据）/ UNKNOWN / CONFLICT（冲突裁决留痕）
- 每篇文档头部：事实溯源汇总 + **待确认清单（AMB-xxx）**——原文未定义的交互标待确认，禁止按竞品惯例补全
- INT-xxx 交互编号（按页面分段 001~099）供 Contract 引用
- `validate_docs.py` 机检（109 PASS：七工件齐全、48 条契约 14 字段完整）+ 人工评分报告
- traceability-matrix.yaml（10449 行）：需求 ↔ 四层文档双向追溯

### 2.4 Interaction.md 分页面小节结构

每页面 = 信息块（目的/进入来源/离开去向/关联 PRD）+ 四小节：

1. **主流程**：文本流程图（缩进树表达分支，含 UI 细节如遮罩、按钮文案）
2. **控件与行为表**：`INT | 操作 | 前置条件 | 成功结果 | 失败/空态 | 来源` 六列
3. **状态机表**：`当前状态 | 事件/触发 | 下一状态 | 来源` 四列
4. **弹窗/二次确认**：模态性、确认层级、阻断提示归类

外加全局三件套：交互原则（反馈三分：动画/文字/状态反馈）、导航表、全局状态表（断线/托管/标记类）。

## 3. 逐维度三方对比

| 维度 | game-ui-design-workflow | spec-generation | ui-interaction-prd-extract 模板 |
|---|---|---|---|
| 组织形式 | 分文档（specs/ 工作区 + yaml contract 体系） | 单文档四层 + 2 个 yaml | **分文档**（模块/界面分析/流程/界面×N/组件×N） |
| 页面粒度 | screen contract | 页面（13 个） | 界面（14 个 layer）**+ 组件明细（独有）** |
| 交互限制 | 契约 yaml | **四类结构化字段**（guards 等） | 纯文本"边界规则"列表（弱） |
| 状态表达 | — | 状态机表 per 页面 | 状态字段表（无状态机流转） |
| 溯源 | contract 引用链 | SRC/AMB 编号 + confirmation_status | 无编号（代码路径即来源） |
| 事件/协议 | 无（生图不需要） | 平台无关，**刻意不含**引擎协议 | **Cmd/xyid/方向/时机/内部事件（独有强项）** |
| 测试场景 | — | test_scenarios per 契约 | 无 |
| 机器可读 | yaml contract 全套 | Contract yaml + traceability | 无（纯 markdown 表格） |
| 质量闭环 | GitHub Actions 校验 | validate_docs.py + 人工评分报告 | 无 |
| 未定义项处理 | — | 待确认清单（AMB），禁止臆补 | 无显式机制 |

## 4. 对 ui-interaction-prd-extract 的借鉴建议

### 4.1 建议采纳（按价值排序）

1. **交互限制四分类结构化**（来自 Contract 的 guards/mutual_exclusion/timeout/failure）：界面文档"交互细节与边界规则"由散文列表改为四类小节。逆向场景下四类在代码中有明确对应物，提取成本低：
   - 前置/守卫 → 权限位检查（curPower 位与、canPlayMahCheck）
   - 互斥 → 按钮互斥显隐（亮倒后吃碰隐藏）
   - 超时 → 托管默认动作、DelayCall 兜底
   - 失败/恢复 → 失败提示、recoverCmd 重连恢复
2. **控件与行为表增加"前置条件""失败/空态"两列**： ours 的用户交互表（操作/组件/响应/后续）缺"什么情况下点了没用"，这正是交互限制的核心载体
3. **每界面加状态机小节**（表格式：当前状态/事件/下一状态）：从状态字段 + 事件处理函数重建，亮倒流程是典型（正常行牌→亮倒按钮态→扣牌弹窗态→亮倒打牌态→持续亮倒行牌）
4. **每界面/组件末尾加 2~4 条 test_scenarios**：让逆向提取的 PRD 可验收
5. **模块分析.md 头部加文档状态块**：status / 覆盖范围（哪些界面已分析）/ 代码版本（commit）/ 生成日期
6. **待确认清单机制**：逆向场景的"待确认"= 代码中的存疑点（注释提到的口径冲突、疑似 dead code、占位实现），集中登记到模块分析.md，不臆补

### 4.2 明确不采纳（及理由）

| 不采纳项 | 理由 |
|---|---|
| SRC/INT/CT 编号体系 | 逆向场景代码类名/函数名是天然 ID（`_onLiang`、`BoxKaWuXingPiaoSCmd`），再编一套号是重复劳动 |
| traceability-matrix（万行） | 正向"需求→文档"追溯才需要；逆向时代码本身就是全量事实源 |
| Contract yaml 全套 | YAGNI：模块分析.md 的协议索引表格已覆盖信息；确需机器可读时再从 markdown 表格生成 |
| 平台无关约定 | 方向相反：我们恰恰要提取引擎实现细节（FGUI 包、事件名、xyid） |
| 单文档聚合 | 组件 70+ 时单文档不可维护，分文档 + 双向链接更优 |
| 人工门禁 approved 流程 | 逆向提取以代码为唯一事实源，不存在"策划意图待批准"；用"与代码不一致待复核"标记替代 |

### 4.3 与 game-ui-design-workflow 的关系结论

该工具对本次任务的可借鉴度低：它的核心价值在下游（生图/切图/Atlas 交付），交互文档只是"页面提示词的引用源"。真正值得吸收的是 **spec-generation 对同一套模板的加强层**（溯源、限制结构化、质检）。若将来 PrdGameSkill 需要"从 PRD 反向生成 UI 原型图"，game-ui-design-workflow 的 spec-kit → 生图链路可直接参考（其 LICENSE 允许，见 REFERENCES.md 登记）。

## 5. 建议的模板修订清单（待确认后落地）

| # | 修订 | 落点 |
|---|---|---|
| 1 | 用户交互表加"前置条件""失败/空态"两列 | 界面文档-模板.md 第 5 节 |
| 2 | "交互细节与边界规则"改为四类：前置守卫/互斥/超时/失败与恢复 | 界面文档-模板.md 第 10 节；组件文档-模板.md 第 8 节 |
| 3 | 新增"状态机"小节（表格式） | 界面文档-模板.md 第 6.5 节 |
| 4 | 新增"测试场景"小节（2~4 条断言） | 界面文档-模板.md 第 11 节；组件文档-模板.md 第 9 节 |
| 5 | 头部加文档状态块（status/覆盖范围/代码 commit/日期） | 模块分析-模板.md、界面文档-模板.md |
| 6 | 新增"待确认清单"小节 | 模块分析-模板.md |
| 7 | 样例 BoxKaWuXingMahMainView 同步按新结构更新 | 样例文档 |

## 引用

- `thirdparties/game-ui-design-workflow/README.md`、`docs/GAME_UI_FACTORY_V2.zh-CN.md`、`templates/spec-kit/interaction.md`
- `examples/mahjong/spec-generation/Interaction.md`、`Interaction-Contract.yaml`、`evaluation-report.md`
- `.claude/skills/ui-interaction-prd-extract/templates/00-输出结构说明.md`
- `dev-docs/design/2026-11-11-ui-interaction-prd-extract-输出模板设计.md`
