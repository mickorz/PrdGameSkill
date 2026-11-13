# workflow 扫描 agent 全量清单转述超时（确定性扫描替代）

## 问题现象

- 执行 `bug-coverage-check.js` workflow 时扫描阶段失败：`扫描阶段失败：未取得缺陷清单，请检查目录 bugs/buglist`。
- journal 显示扫描 agent「扫描缺陷与 PRD 大纲」在 900000ms（15 分钟）超时，重试 2 次均超时。
- `bugs/buglist` 目录实际存在且有 223 个 .md 缺陷文件，目录本身没有问题。

## 排查过程

1. journal：`agent "扫描缺陷与 PRD 大纲" 超时 (900000ms)`，attempt 2/2。
2. 用 sessions-search 查扫描 agent 的 session 记录（`ses_e2d094b77ffe6uGR6srWDgit27`）：
   - 前 4 分钟就完成了全部调查（列出 223 个文件、提取 PRD 大纲 31 个标题、提取第二层【】标签）；
   - 剩余 11 分钟全部耗在对 108 个无第二层标签文件的**逐条冗长推理分类**上（每个文件写一大段「听牌属于行牌还是桌面」式的纠结），还没开始输出结构化结果就超时；第二轮重试同样卡死。
3. 顺带发现两个连带问题：
   - 默认 `prdPath`（`input/【杭州麻将】核心流程杭州麻将好友房AI.md`）实际不存在（真实文件名带 `-11-12-2` 后缀），旧扫描 agent 自行「适配」了相近文件名，但适配结果不会回流 workflow 的 `prdFiles`，批次 prompt 里仍是错误路径；
   - 收集阶段的 `bug-verdicts-input.json` 也是让收集 agent 从 prompt 里转述 223 条清单再写盘——同样的全量转述模式。

## 根因

- 让 LLM agent 做纯机械工作（枚举目录、从文件名解析标签、grep 标题、按模块分桶切批），且要求把 223 条清单经 schema 全量转述回 workflow——与本 workflow 自己在后半程确立的「判定不经模型 schema 返回、直接写盘」原则相悖（扫描阶段是历史遗留的反模式）。
- 逐条推理分类放大了耗时：模型对每条无标签缺陷写长推理，15 分钟超时是必然。
- 期间另一会话曾尝试「扫描固定 bf-flash 模型」（commit 79cfd9d）缓解，但只要仍是全量转述+逐条推理，换模型只是降低概率不是消除。

## 解决方案

确定性脚本 `bug-scan-plan.mjs` 一次落盘全部扫描产物，模型只转发小摘要：

1. **清单抽取**：复用 `bug-catalog.mjs` 的 `buildCatalog()`（第二层【】标签 + 关键词回退，与原扫描提示词同语义）。
2. **PRD 路径**：共享快照模式下从快照 `manifest.sourceFiles` 权威获取（`--prd-from-snapshot`，全程 ASCII 参数，规避中文路径经命令行的编码风险）；否则显式 `--prd` 传入，缺失即大声失败，不静默适配相近文件名。
3. **落盘产物**（outDir）：`bug-catalog.json`（Bug 资产）、`prd-outline.txt`（大纲）、`batches.json`（批次定义，批次 agent 读盘取本批清单）、`scan-summary.json`（小摘要）、`bug-verdicts-input.json`（收集输入预生成，收集 agent prompt 缩为一条命令）。
4. **workflow 改造**：扫描阶段 = `commandSuccess(node bug-scan-plan.mjs ...)` + 一个只读转发小摘要的 agent（retries 2）；批次 prompt 引用 batches.json/prd-outline.txt 读盘；批次 prompt 附带「title/条数与定义不符即 ok=false」的转发失真防线；收集 agent 只跑 collect 命令。
5. 实测：223 条 / 38 模块 → 18 批，脚本秒级完成，自检全过（批次全覆盖一条不漏、收集输入契约、大纲格式、autoPass 过滤、小批合并、失败路径）。

## 踩坑附记（实现过程中额外踩到的）

- **import 副作用坑**：`bug-catalog.mjs` 重构导出函数后仍保留顶层 CLI 代码，`bug-scan-plan.mjs` import 它时 CLI 被触发，把 catalog 内容写到了 outFile（恰好是输出目录路径），占用目录名导致后续 `mkdir EEXIST`。修复：CLI 段加 `invokedDirectly` 守卫（`path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)` 才执行）。**给 .mjs 加导出时必须检查顶层副作用**。
- **字段名契约坑**：batches.json 的 files 条目最初直接用 catalog 对象（`sourceFile` 字段），与消费方期望的 `path` 不一致，自检断言当场拦下。落盘产物字段名要与 prompt 里写的字段一一对应。

## 预防/注意事项

- **机械工作不进 LLM**：枚举/解析/分桶/投影类工作一律确定性脚本落盘，agent 只做需要判断的事（审核判定）或小摘要转发；大数组永远不经模型 schema 转述（本 workflow 判定分片模式同理）。
- **路径参数要存在性硬校验**：默认路径失效时宁可直接失败也不让 agent 自行适配（适配结果不回流，等于把错误推迟到下游）；共享快照模式下 PRD 路径以快照 manifest 为权威来源。
- **中文路径经命令行有编码风险**（Windows codepage）：能从文件（manifest.json）确定性取就别经 CLI 参数传中文。
- 脚本自检（`*.example.mjs`）必须覆盖真实目录全量 + 字段契约 + 失败路径三类场景，这次两次断言拦截（EEXIST、字段名）都证明其价值。
