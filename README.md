# PrdGameSkill

面向游戏开发的 PRD（产品需求文档）技能库，方法论参考 [BMad Game Dev Studio](https://github.com/bmadcode/BMAD-METHOD)（`thirdparties/bmad-module-game-dev-studio`，只读参考，不入库）。

## 概述

本仓库沉淀一套游戏开发场景下的 PRD 工作流与文档模板，目标是让游戏项目从立项到验收的过程有据可依：

- PRD 编写规范与模板（游戏设计文档 GDD、需求拆解、验收标准）
- 文档驱动的开发流程：规划 → 执行 → 进度 → 验收的闭环
- 开发过程文档管理规范（见 `CLAUDE.md`）
- 踩坑经验与解决方案的沉淀机制

## 快速开始

本仓库是纯文档/技能库，无需安装依赖：

1. 克隆本仓库：`git clone https://github.com/mickorz/PrdGameSkill.git`
2. 阅读 `CLAUDE.md` 了解文档管理规范
3. 阅读 `docs/getting-started.md` 了解技能库的使用方式
4. 在你自己的游戏项目中按模板与流程应用 PRD 方法论

## 目录结构

```text
docs/          读者向文档（快速开始、配置、贡献、测试、排查）
dev-docs/      开发过程文档（随仓库入库，含 10 类子目录）
dev-examples/  开发期沙盒（不进 git）
thirdparties/  外部参考项目（不进 git，只读）
```

文档管理规范详见 [CLAUDE.md](CLAUDE.md)。
