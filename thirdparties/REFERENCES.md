# 第三方参考项目清单（REFERENCES.md）

> 维护规则（见根目录 CLAUDE.md「第三方依赖目录」）：所有项目只读，不修改源码；复用代码前必须核对 License；本文件随仓库入库。
> 引入日期：2026-11-06。全部以 Git Submodule 引入，固定到下表所列 commit。

| ID | 项目 | 仓库 | 本地路径 | 固定 commit | License | 复用策略 | 研究目的 |
|---|---|---|---|---|---|---|---|
| REF-001 | PRD Pilot | https://github.com/156181679-dev/prd-pilot.git | `thirdparties/prd-pilot` | `ac3668967083e8a67a8b9ddc13a1104fc8c3aa05` | MIT | 可借鉴思想，复用代码需保留版权声明 | Requirement Spec、生成链路、质量检查、定点修改 |
| REF-002 | PRD HTML Generator | https://github.com/XiaoYongV5/prd-html-generator.git | `thirdparties/prd-html-generator` | `5b40d5a6df9c090fe2ed1fd31367e6793f4379d3` | Apache-2.0 | 可借鉴思想，复用代码需保留版权与 NOTICE | PRD 抽屉、锚点定位、HTML 模板 |
| REF-003 | PRD Writer | https://github.com/cnhx/prd-writer.git | `thirdparties/prd-writer` | `45ab5a8221877644c74cb252014354f4746d4744` | MIT | 可借鉴思想，复用代码需保留版权声明 | 游戏 PRD 结构、HTML 导出、交互原型 |
| REF-004 | Arrow | https://github.com/mhgolkar/Arrow.git | `thirdparties/Arrow` | `5c0291c72e0fe1c1ac3024cb68826caa213532ee` | MIT | 可借鉴思想，复用代码需保留版权声明 | 游戏逻辑节点、变量/状态、可玩 HTML 导出 |
| REF-005 | GDD-Forge | https://github.com/miventech/GDD-Forge.git | `thirdparties/GDD-Forge` | `75f41412d3699fbc3a0e406af277431ba0b0faa1` | 未发现 LICENSE 文件 | **只读研究，禁止复制任何代码** | GDD 数据结构（Manifest/Feature/Segment/Decision） |
| REF-006 | Game Doc Forge | https://github.com/MisterVitoPro/gdd.git | `thirdparties/game-doc-forge` | `630ae23103cf722be209708c0a1b5f01af25b73c` | MIT | 可借鉴思想，复用代码需保留版权声明 | 游戏设计访谈、决策账本、Open Questions、审查 |
| REF-007 | Game UI Design Workflow | https://github.com/mickorz/game-ui-design-workflow.git | `thirdparties/game-ui-design-workflow` | `1ec604638dd1a27198576206eb3e47632725a078` | MIT | 可借鉴思想，复用代码需保留版权声明；2026-11-09 已复制/改编 templates 与 init_project.py 至 `.claude/skills/game-spec-generator/`（保留 MIT 标注），调研见 dev-docs/research/2026-11-09-game-ui-design-workflow-research.md | GDD/PRD/Interaction/Contract 四文档模板、Spec-Kit 门禁机制、init/validate 脚本、完整实例；对应 GSG-V1 与 P9 UI 工作流参考 |

## 说明

1. Submodule 只作为源码研究与方法论参考，不代表全部集成进最终产品；集成决策见 `dev-docs/research/2026-11-06-interactive-game-prd-reference-research.md` 的复用决策表。
2. GDD-Forge 仓库未附 LICENSE 文件（README 亦无仓库级授权声明），按版权默认规则处理：仅阅读研究，不复制、不改造其任何源码。
3. 更新方式：`git submodule update --remote <path>` 后固定新 commit 并更新本表。
