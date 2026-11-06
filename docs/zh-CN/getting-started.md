# 快速开始

## 前置要求

- Git（克隆仓库与提交文档）
- 任意 Markdown 编辑器（VS Code、Typora、Obsidian 均可）
- 无需安装任何运行时依赖——本仓库是纯文档/技能库

## 安装

```bash
git clone https://github.com/mickorz/PrdGameSkill.git
cd PrdGameSkill
```

## 验证

检查目录结构是否完整：

```bash
ls dev-docs/
```

应看到恰好 10 个子目录：`design`、`meeting`、`todos`、`troubleshooting`、`research`、`planning`、`progress`、`progress-result`、`guides`、`experience`。

## 第一次使用

用本仓库的规范记录你的第一篇开发文档：

1. 阅读 [CLAUDE.md](../../CLAUDE.md) 了解文档分类规则
2. 在 `dev-docs/` 下按类型新建一篇 Markdown 文档，例如
   `dev-docs/research/2026-01-01-某主题调研.md`
3. 提交：`git add . && git commit -m "docs: 新增调研笔记"`

## 下一步

- [操作指南](how-to-guides.md)：常见任务的分步操作
- [贡献者指南](development.md)：参与贡献前必读
