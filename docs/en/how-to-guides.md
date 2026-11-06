# How-To Guides

## Record a Development Doc

场景：开发过程中产生了一篇设计/调研/排查文档。

1. 判断文档类型，对照 `CLAUDE.md` 的类型表选择子目录
2. 命名体现内容，需要时间线时加日期前缀：`2026-01-01-prd-template-design.md`
3. 写入并提交，无需询问归类（规范允许自动归类）

Expected result：文档出现在正确的子目录，`git status` 干净。

## Record a Lesson Learned

场景：踩了一个坑并已解决。

1. 先到 `dev-docs/experience/` 搜索是否有类似记录；有则更新原文档
2. 没有则新建一篇，结构：问题现象 → 排查过程 → 根因 → 解决方案 → 预防/注意事项
3. 文件名体现问题关键词，如 `bmad-module-install.md`

Expected result：下次遇到同类问题可先查经验库复用解法。

## Update the Third-Party Reference

场景：需要更新 `thirdparties/bmad-module-game-dev-studio` 版本。

1. 重新下载/克隆新版，覆盖 `thirdparties/bmad-module-game-dev-studio/`
2. 不要手工修改其中文件；需要引用时把提炼内容写进本仓库自己的文档
3. `thirdparties/` 不进 git，此操作不影响提交状态

Expected result：本地参考更新完毕，仓库无新增改动。

## Record Stage Progress

场景：完成了一个阶段/里程碑。

1. 更新 `dev-docs/progress/执行进度.md` 的里程碑状态表
2. 视情况在 `dev-docs/progress-result/` 新建该阶段的验收/交付报告
3. 记录内容：完成时间、交付清单、commit 记录、经验索引、遗留问题

Expected result：进度文档与仓库实际状态一致，不得只提交内容不更新进度。
