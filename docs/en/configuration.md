# Configuration Reference

本仓库没有运行时配置文件，本篇描述的是仓库的结构约定（相当于项目的"配置面"）。

## Configuration Fields

| 约定项 | 位置 | 默认值 | 说明 |
|--------|------|--------|------|
| 文档管理规范 | `CLAUDE.md` | 已内置 | 开发过程文档的分类与入库规则，新增目录类型需在此登记 |
| 开发过程文档 | `dev-docs/` | 10 个子目录 | 随仓库入库，分类见 CLAUDE.md 表格 |
| 读者向文档 | `docs/` | 6 篇 + `zh-CN/` | 面向使用者，双语同名同结构 |
| 开发期沙盒 | `dev-examples/` | 空 | 不进 git，试验脚本与临时输出 |
| 外部参考项目 | `thirdparties/` | `bmad-module-game-dev-studio` | 不进 git，只读 |

## Taking Effect & Verification

约定通过 `CLAUDE.md` 与 `.gitignore` 生效。验证方式：

```bash
git check-ignore thirdparties dev-examples   # 两者都应被忽略
ls dev-docs/ | wc -l                          # 应输出 10
```

## Upgrade

更新第三方参考项目：重新下载/克隆覆盖 `thirdparties/bmad-module-game-dev-studio` 对应子目录即可，不要手工改动其中的文件。

## Uninstall

删除 `thirdparties/` 或 `dev-examples/` 目录即可，不影响仓库其余内容；`thirdparties/` 的方法论已提炼进本仓库自己的文档。
