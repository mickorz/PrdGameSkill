# 需求提取 agent 反复生成临时切片脚本文档

## 问题现象

共享需求提取（`prd-requirements-extract`）每次运行，需求原子化 subagent 都会在
`%TEMP%\opencode\` 下现场生成一个临时脚本（如 `gen_part01.py`、`build-part-01.js`、`gen_group05.py`），
逻辑几乎完全相同：读源 PRD → 按行号/单元格锚点截取原文 → 拼 `part-01.json`。

- `opencode.log` 中 `Temp\opencode\gen_*` 相关记录 300+ 条，说明每次运行都在重复生成
- 一个 540 行的 PRD 对应约 35KB 的 python 脚本，其中 90% 是硬编码的行号与锚点表
- 不同次运行生成的脚本细节不一致（切格方式、标题校验、编码写法各不相同），产物不可复现

## 排查过程

1. 从 journal `run-mwdbr58e` 定位到提取 agent 会话，再在 `opencode.log` 检索 `gen_part01`，
   确认 agent 是先用 `write` 工具写脚本、再用 shell 执行 python
2. 打开 `%TEMP%\opencode\gen_part01.py` 对比多次产物：脚本骨架一致，只有 specs 表（行号 + 起止锚点 + 标题 + 章节）不同
3. 检查 `requirements-build.mjs` 的引文一致性校验：`text` 只需是声明行范围内容的**子串**（忽略空白），
   因此"机械截取"完全可以由确定性脚本完成，不需要 agent 参与

## 根因

提任务提示只要求"写 part JSON"，没有提供截取原文的工具。模型为了满足"text 必须照抄原文"，
只能自己造工具；而每次都是新会话，无法复用上一次的临时脚本，于是重复生成。

## 解决方案

把"读源文件 + 截取原文 + 拼分片 + 校验"收口为仓库脚本，agent 只写**提取计划**：

1. `.opencode-workflows/scripts/slice-part.mjs`（确定性）
   - 输入 `plan.json`：`{ sourceFile, outFile, reqKeyPrefix?, items: [{ reqKey?, title, section?, fromLine, toLine?, startText?, endText? }] }`
   - `startText/endText` 支持片段级截取（PRD 大量是 Markdown 表格，只取某一格，避免整行 `| ... |` 进入需求原文）
   - `section` 缺省或含 `{{IP_xxx}}` 图片占位符时，自动回填 `fromLine` 之前最近的 Markdown 标题
   - 输出章节覆盖率报告并列出未覆盖章节，把"漏章节"暴露在 agent 的命令输出里
2. `prd-requirements-extract.js` 提示改造：明确禁止生成任何临时脚本；要求按 `[覆盖]` 输出补齐漏提章节
3. `slice-part.example.mjs`：18 个场景覆盖截取、锚点、越界、重复键、章节回填、覆盖率、CLI 全链路

效果（同一 PRD，一次真实运行）：

| 指标 | 改造前（python 临时脚本） | 改造后（plan + slice-part） |
|------|--------------------------|------------------------------|
| 临时脚本 | 每次 1 个 35KB | 0 |
| 需求点 | 282（单次） | 380 |
| 章节覆盖 | 未度量 | 187/242 需求行（77%），未覆盖仅文首/附录 A/B |
| section 质量 | 混入 `{{IP_xxx}}` 占位符 | 0 条占位符 |
| 引文校验 | 需人工比对 | validation passed（脚本机械切原文） |

## 预防 / 注意事项

- 提取类 workflow 的提示里，只要出现"照抄原文/写大量结构化正文"，就要先问：这段是否能用确定性脚本生成？
- 计划文件是"可复现输入"，产物是"确定性输出"；两者分开后，重跑与 diff 才有意义
- 覆盖率高不代表提得对（拆分粒度仍需人工/规则侧校验），覆盖率只解决"静默漏章节"
- 覆盖率口径：非空、非标题、非表格分隔行/表头行算需求行；文首、附录、目录类章节可合理为 0
- 本地临时脚本产物（`%TEMP%\opencode\gen_*.py`）属于一次性垃圾，不需要清理入库

## 相关产物

- `.opencode-workflows/scripts/slice-part.mjs` / `slice-part.example.mjs`
- `.opencode-workflows/workflows/prd-requirements-extract.js`
- `output/projects/hzmj/extractions/ext-20261112-01/`（plans/part-01.plan.json + requirements/parts/part-01.json）
