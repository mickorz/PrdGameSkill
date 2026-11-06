# PrdGameSkill

面向游戏开发的 PRD（产品需求文档）技能库，方法论参考 [BMad Game Dev Studio](https://github.com/bmadcode/BMAD-METHOD)（`thirdparties/bmad-module-game-dev-studio`，只读参考）。核心能力：**Interactive Game PRD**——把原始游戏 PRD 转化为结构化 Game Requirement IR、可离线运行的交互式 HTML 需求文档与规则模拟器。

## 概述

- **Game Requirement IR**：结构化需求中间表示（JSON Schema 校验、需求 ID 体系、来源三分类溯源、状态与授权机制），是全部产物的唯一事实源
- **Interactive HTML PRD**：从 IR 构建的单文件离线网页——需求导航、PRD 视图、可操作 UI Demo、状态机图、测试用例、PRD 与 UI 双向定位
- **规则模拟器**：按已确认（approved）规则驱动的可玩演示，规则缺失时输出 `RULE_NOT_CONFIRMED` 而非编造判定
- **一致性质量门**：`validate-ir` / `validate-html` / 模拟器场景回放 / `validate-output` 串联报告，全部脚本化确定性检查
- **文档管理规范**：开发过程文档（需求 / 设计 / 计划 / 进度 / 经验）的分类与入库规则（见 `CLAUDE.md`）

## 快速开始

```bash
git clone https://github.com/mickorz/PrdGameSkill.git
cd PrdGameSkill
cd skills/interactive-game-prd && npm install

# 用仓库自带的迷你样例一键验证全链路
npm run test:e2e
```

打开 `examples/mini-game/output/interactive-game-prd/index.html` 即可体验交互式 HTML PRD（双击离线运行）。完整使用说明见 [docs/zh-CN/interactive-prd.md](docs/zh-CN/interactive-prd.md)。

## 目录结构

```text
skills/interactive-game-prd/   核心技能（Schema / 模板 / 工作流 / 脚本 / 资产）
examples/                      游戏样例（mini-game 为管线验证样例）
docs/                          读者向文档（英文 + zh-CN 中文版）
dev-docs/                      开发过程文档（需求 / 设计 / 计划 / 进度 / 经验，随仓库入库）
thirdparties/                  外部参考项目（bmad 为本地只读；六个参考项目为 Git Submodule）
dev-examples/                  开发期沙盒（不进 git）
```

文档管理规范详见 [CLAUDE.md](CLAUDE.md)。
