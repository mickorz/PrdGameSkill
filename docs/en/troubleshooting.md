# Troubleshooting

## Installation

### thirdparties/ 目录不存在

正常现象：该目录不进 git，克隆后本地为空。需要参考时重新下载/克隆 BMad Game Dev Studio 到 `thirdparties/bmad-module-game-dev-studio/`。

### dev-docs/ 子目录不全

初始化遗漏或历史原因导致。按 CLAUDE.md 类型表补建缺失子目录，并在 CLAUDE.md 表格登记新类型。

## Runtime

### 文档不知道该放哪

对照 `CLAUDE.md` 类型表；都不适用时新建类型子文件夹（kebab-case）并在表格中登记，不要散落在仓库根目录。

### 中文文件名在部分环境显示异常

Git 默认对非 ASCII 文件名转义显示。执行 `git config core.quotepath false` 可恢复正常显示；文件名本身建议在"需要时间线检索"时才用日期前缀，其余用内容关键词命名。

### docs/ 英文版与中文版内容不一致

两语言版本必须同名同结构同步维护。发现漂移时以最新改动为准，把另一语言补齐后再提交。

## Still Stuck

- 先查 `dev-docs/experience/` 是否已有同类问题的解决记录
- 仍未解决：在 `dev-docs/troubleshooting/` 新建排查文档，或在 GitHub 提 issue：<https://github.com/mickorz/PrdGameSkill/issues>
