# Contributor Guide

## Environment & Common Commands

无构建系统、无依赖安装，只需 Git 与 Markdown 编辑器：

```bash
git status                     # 查看改动
git add <file> && git commit   # 提交文档
git pull --rebase              # 同步远端
```

## Architecture at a Glance

- `CLAUDE.md`：文档管理规范（本仓库的"宪法"，改动需谨慎并说明理由）
- `docs/`：读者向文档，英文与 `zh-CN/` 中文版同名同结构，改动须两语言同步
- `dev-docs/`：开发过程文档，随仓库入库，10 类子目录分类规则见 CLAUDE.md
- `dev-examples/`：开发期沙盒，不进 git
- `thirdparties/`：外部参考项目，不进 git，只读

## Tests

文档项目的"测试"是结构与规范检查：

```bash
ls dev-docs/ | wc -l                                # 10 个子目录齐全
git check-ignore thirdparties dev-examples          # 忽略规则生效
grep -c "dev-docs" .gitignore CLAUDE.md             # 规范与忽略规则一致
```

## Local Development Loop

1. 改动前先读 `CLAUDE.md` 对应章节
2. 新文档放入 `dev-docs/` 对应类型子目录，命名体现内容与日期
3. 读者向文档改动需同步 `docs/` 与 `docs/zh-CN/`
4. 阶段完成时更新 `dev-docs/progress/执行进度.md`

## Release

本仓库随改随发布：push 到 `main` 即生效，无版本发布流程。
