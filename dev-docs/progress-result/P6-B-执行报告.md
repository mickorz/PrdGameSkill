# P6-B 执行报告：三栏式 Decision Workbench 页面

> 完成时间：2026-11-09 | 设计输入：dev-docs/design/2026-11-09-game-decision-workbench-design.md
> 验收重点（设计文档）：31 项可以完整处理

## 技术栈说明

按设计文档推荐采用 **React 18 + Vite 5 + TypeScript** 前端；服务端为 Node 内置 http 的轻量本地服务（零新增运行依赖），复用 P6-A 的 decision-lib 做全部裁决校验。与设计文档的偏离：Playwright 端到端自动化未引入（属 P6-C/后续），当前以服务端 API 测试替代。

## 交付清单

| 交付物 | 路径 | 说明 |
|---|---|---|
| Vite 工程 | `.claude/skills/interactive-game-prd/web/decision-workbench/` | pages/ components/ stores/ services/ 四层目录，与设计文档目录约定一致 |
| 服务端 | `.claude/skills/interactive-game-prd/scripts/decision-workbench.mjs` | 页面静态服务 + 4 个 API；只读写指定 game-spec 内 reviews 与 source |
| 构建产物 | `.claude/skills/interactive-game-prd/web/decision-workbench/dist/` | 随仓库入库，运行时不要求构建环境 |
| API 测试 | `.claude/skills/interactive-game-prd/scripts/decision-workbench.test.mjs` | 19/19 PASS |

## 功能与验收对照（设计文档 12 条中与 P6-B 相关项）

| 验收项 | 状态 | 实现方式 |
|---|---|---|
| 1. 31 个 OQ 全部可浏览 | 已支持 | 左栏列表，优先级排序，HIGH/MED/LOW 徽标 |
| 2. 每条问题可查看原文证据 | 已支持 | /api/evidence 经 source-map 锚点读取 source/ 原文行，展示文件+章节+行号 |
| 3. 支持采纳、修改、否决、挂起 | 已支持 | 中栏四动作表单；修改口径有专用的最终口径输入 |
| 4. 支持草稿和自动保存 | 已支持 | 800ms 防抖 POST /api/drafts 落盘 approval-state.json；列表草稿标记 |
| 5. 提交后不可丢失的历史 | 已支持（P6-A） | decision-log 只追加，页面展示裁决历史与当前有效标记 |
| 6. 可查看关联需求和影响范围 | 部分支持 | 右栏：关联条目+状态、预期 IR 流转预览、同条目其他问题、条目裁决历史；模拟器/测试影响属 P6-C |
| 7. 刷新关闭后可恢复 | 已支持 | 状态全部来自服务端；location.hash 定位 + last_position 中断恢复 + 草稿恢复 |
| 8. 裁决结果写回 JSON | 已支持 | POST /api/decisions → applyDecisions → 三文件落盘 |
| 11. AI 不能代替人工提交 | 已强制 | 服务端校验 reviewer=human，AI 代提交返回 400 |

## 交互流程

1. 左栏筛选（默认只看待裁决，按优先级排序）→ 点击问题
2. 中栏查看原文引用 → 选择四动作之一（修改需填最终口径，否决/挂起需填理由）→ 表单自动存草稿 → 提交正式裁决
3. 提交成功后自动写入三文件并清除草稿，自动定位下一条待裁决问题
4. 右栏全程展示影响：预期 IR 流转（如 GAME-RULE-003: status proposed → approved）、同条目问题、条目历史

## 测试结果

- decision-workbench.test.mjs：19 PASS / 0 FAIL（页面、state、证据链含路径逃逸防护、草稿保存与非法拒绝、正式提交、decision_id 自动分配、IR 流转自动生成、问题状态回链、草稿清除、AI 代裁决拒绝、未知问题 400、重裁决 supersedes 校验、翻案成功）
- 全量回归：simulator 10/10、decision 25/25、workbench 19/19、e2e 7/7

## 使用方式

```bash
node .claude/skills/interactive-game-prd/scripts/decision-workbench.mjs examples/mahjong/game-spec --port 8434
# 浏览器打开 http://127.0.0.1:8434/
# 前端改动后：npm --prefix .claude/skills/interactive-game-prd/web/decision-workbench run build
# 开发模式（热更）：npm run workbench:dev（vite 5173 代理 /api 到 8434）
```

## 遗留问题

1. P6-C：IR 文件自动写回（当前只写 reviews 三文件，IR 流转暂以 requirement_updates 记录在 decision-log）、影响分析扩展到模拟器/测试用例、审批 Gate 判定、Playwright 自动化。
2. 31 项 OQ 待人工在页面上逐条裁决（页面已就绪）。
3. 131 vs 162 统计口径前置修复仍未处理。

## Commit 记录

- 本次交付：见 git log（feat: 卡五星 P6-B 三栏式 Decision Workbench）
