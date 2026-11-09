# GDD 格式规范

> 模板：`templates/GDD.template.md`（改编自 game-ui-design-workflow spec-kit，MIT）

## 职责

回答「游戏怎么玩」。承载玩法、规则、数值、结算——**不含产品功能与 UI**（那些属于 PRD / Interaction）。

## 必须覆盖的章节

1. 文档状态（draft / pending-human / approved）
2. 事实溯源汇总（引用 SRC-xxx；DERIVED 列表；UNKNOWN/CONFLICT 列表）
3. 一句话定位、目标用户与卖点
4. 核心循环表（每行带来源事实）
5. 系统清单（must-have / genre-specific / optional）
6. 基础规则（逐条，牌张/人数/庄家/行牌/胡牌条件等）
7. 操作规则（每类操作的前置条件、优先级、限制）
8. 番型与胡牌条件（全量番型表，含互斥/叠加关系）
9. 结算规则（公式逐条照录，禁止改写省略）
10. 数值与配置（默认值依据是截图的必须标注「需人工提供文本」）
11. 特殊规则与规则优先级

## 硬性规则

- 每条规则必须带来源事实 ID（SRC-xxx）；原文未定义的写「待确认」，不得编造
- 结算公式与原文逐字一致
- DERIVED 事实必须写推导依据
- 默认值依据为截图的，必须注明「AI 无法读取截图数值，需人工提供文本补充」
