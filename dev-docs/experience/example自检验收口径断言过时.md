# example 自检脚本验收口径断言过时（提交前未跑全量自检）

## 问题现象

`node build-dashboard.example.mjs` 稳定失败在最后一节「模板新字段自检」：

```
AssertionError [ERR_ASSERTION]: 建议后的验收口径块应保留
```

且该失败在 HEAD 原版（本次改动前）即存在——不是新改动引入的回归。

## 排查过程

1. 怀疑本次 PRD_ROW_RE 改动引入 → 用 `git show HEAD:` 取原版两个脚本放临时目录重跑 → 原版同样失败，排除。
2. 注意到一个坑：`node -e "import(...)"` 动态 import 跑自检时，assert 抛错走 Promise `.catch`，`2>/dev/null` 把 stderr 吞掉后表面上"全部通过"（stdout 只打了前 4 节成功）。**验证脚本必须直接 `node xx.example.mjs` 跑并保留 stderr**，否则会误判通过。
3. 直接解析 nfReport 打印 suggestion → 内容只到范例表格为止，无验收口径。
4. 用真实 report.md 验证：75 条有详情块的问题全部解析出独立 `acceptance` 字段，suggestion 中含"验收口径"的为 0 条。

## 根因

解析器早已把详情块 `**验收口径**` 解析到独立 `it.acceptance` 字段（Dashboard 抽屉单独渲染），但 example 脚本最后一节的断言还按旧口径断言 `suggestion` 里包含 `**验收口径**`。**字段重构时只改了解析器和模板，漏改了自检断言**，且该断言坏着被提交过多次——说明提交前没有跑全量自检。

## 解决方案

断言改为对齐现状：验收口径断独立 `acceptance` 字段，且断言 `suggestion` 不含验收口径（防回归）。

## 预防/注意事项

- 任何改 build-dashboard.mjs 字段解析的提交，提交前必须跑 `node .claude/skills/game-prd-check/scripts/build-dashboard.example.mjs` 且不吞 stderr。
- 验证异步执行的自检不要用 `import() + 2>/dev/null` 组合，失败会被静默吞掉。
- 解析字段重构（拆独立字段）时，同步检查：模板 report.template.md、SKILL.md、example 断言三处口径是否一致。
