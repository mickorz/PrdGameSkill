# 合并 PRD Dashboard 执行流程

把两份及以上同模板生成的 PRD 检查 Dashboard HTML 合并为单文件 Tab 切换版。

## 背景：Dashboard 文件结构与适用报告类型

本仓库的 Dashboard 由 `build-dashboard.mjs` / `/gen-dashboard` 生成，统一结构为三段：

```text
1. 静态骨架（CSS + section 容器 + 筛选工具栏 + 抽屉 + 浮动按钮）
2. <script type="application/json" id="report-data"> 数据（schema_version/report/statistics/...）
3. 渲染脚本 IIFE（读 report-data，一次性渲染各 section）
```

已知同模板的报告类型（均可直接合并，无需改代码）：

| 来源 | dashboard 目录 | 说明 |
|---|---|---|
| game-prd-check-workflow | `examples/game-prd-check-workflow/dashboard/` | PRD 功能规则检查（旧版骨架，无维度筛选） |
| ui-interaction-prd-extract | `examples/ui-interaction-prd-extract/dashboard/` | UI 交互检查（新版骨架，含维度筛选） |
| bug-check-workflow | `examples/bug-check-workflow/dashboard/` | Bug 检查（与 UI 版骨架完全一致） |

不要求两份 schema 完全一致：新版模板对旧数据字段全部做了兼容（如无 `dimension` 字段时清单维度列显示“功能规则”兜底、`statistics.dimensions` 缺失时维度下拉为空）。新报告类型只要含 `report-data` 标签即可合并；若骨架与已知模板差异大（section id 不一致），先人工确认再合。

合并原理：骨架保留一份（最后一份输入），数据全部嵌入（改名为 `report-data-0/1/...`），渲染脚本函数化为 `mount(idx)`，顶部 Tab 切换时全量重建。渲染脚本模板在 `templates/render-script.js.tmpl`，合并由 `scripts/merge-dashboard.mjs` 一次完成。

## 执行步骤

### 1. 输入确认

- 确认输入 ≥ 2 份、都是 Dashboard 模板产物（含 `report-data` JSON）。grep 一下 `id="report-data"` 即可判断。

### 2. 骨架选择

脚本固定用**最后一份输入**做骨架（约定输入按时间顺序排列，最新版功能最全，如 UI 交互版/bug 版含维度筛选）。

若拿不准哪份是超集，检查两点后自行排序：
- 骨架是否含 `f-dimension`（维度筛选下拉）
- 渲染脚本是否含 `renderRich`（抽屉富文本渲染）

### 3. Tab 标签

- 默认从文件名推断（去掉 `-Dashboard-` 及其后部分）
- Tab 文字自动附加条数（从 `statistics.total` 读取）
- **不同来源的 dashboard 文件名可能重名**（如 PRD 版和 bug 版都叫“杭州麻将分析”），默认推断会产生重复 Tab 文字，此时必须用 `--label` 逐份指定

### 4. 执行合并

```bash
# 最简用法：顺序即 Tab 顺序，产物落在第一份输入所在目录
node .claude/skills/merge-prd-dashboard/scripts/merge-dashboard.mjs \
  examples/game-prd-check-workflow/dashboard/杭州麻将分析-Dashboard-20261110-11.html \
  examples/ui-interaction-prd-extract/dashboard/UI交互-PRD分析-Dashboard-20261111-05.html

# 三份不同类型合并（PRD + UI交互 + Bug），指定输出与标签（文件名重名时必须）
node .claude/skills/merge-prd-dashboard/scripts/merge-dashboard.mjs \
  examples/game-prd-check-workflow/dashboard/杭州麻将分析-Dashboard-20261110-11.html \
  examples/ui-interaction-prd-extract/dashboard/UI交互-PRD分析-Dashboard-20261111-05.html \
  examples/bug-check-workflow/dashboard/杭州麻将分析-Dashboard-20261111-03.html \
  --out-dir examples/dashboard \
  --label 1=杭州麻将PRD分析 --label 2=UI交互分析 --label 3=Bug分析

# 指定输出与标签
node ... merge-dashboard.mjs <file1> <file2> \
  --out-dir examples/dashboard \
  --label 1=杭州麻将分析 --label 2=UI交互 PRD 分析
```

自动命名：`合并-Dashboard-<标签1>+<标签2>-<YYYYMMDD>-<NN>.html`，同目录同日前缀已存在时序号递增不覆盖（与 /gen-dashboard 约定一致）。指定 `--out` 则直接使用。

脚本内置校验（任一失败输出 `[失败]` + 原因清单，退出码 1，不产出半成品）：
- 每份输入 `report-data` 可提取且 JSON.parse 通过、`statistics.total` 存在
- 骨架锚点齐全（`<div class="page">`、`</style>`、旧渲染脚本模式）
- 产物自检：script 块数 = N+1、`mount(0)` 存在、尾部 `</html>` 完整、旧 `report-data` id 不残留、各 `report-data-<i>` 存在、Tab 栏存在

### 5. 浏览器验证（必须做，结构自检通过不代表渲染正确）

用 browser_* 工具打开产物，按清单检查：

1. `browser_console` 无 error/warn
2. 默认 Tab（第 1 份）渲染：清单行数 = 第 1 份 total、KPI 4 个
3. 点击第 2 个 Tab：清单行数 = 第 2 份 total、下拉框重置且重新填充
4. 点击清单行：抽屉打开、ID/标题正确、关得掉
5. 筛选（如选 P0）：计数变化正确；`btn-clear` 后恢复全量
6. 切回第 1 个 Tab：条数与下拉状态正确（无跨报告筛选残留）
7. 可用 `browser_execute_js` 一次性批量断言（参考写法：`(function(){ ...document.getElementById(...)...; return {...};})()`）

### 6. 收尾

- 用 pi-cite-wslpath 把产物路径转成可点击链接给用户
- 合并产物默认落在输入文件所在 dashboard 目录或 `examples/dashboard/`（该目录不在 .gitignore 内，随仓库提交）；按仓库规则完成验证后直接 `git commit` + `git push`，提交信息示例：`feat: 合并X与Y两份PRD Dashboard为单文件Tab切换版`
- 不删除历史单份 Dashboard 产物

## 坑与注意事项（历史踩坑记录）

1. **write 工具的 /tmp 与 bash 的 /tmp 不互通**：临时脚本要写到项目内或确认过的真实路径，写完用 bash 验证文件存在再执行。
2. **拼接脚本容易漏"最后拼接行"**（历史上漏过 `tail += renderJs` 导致产物没有渲染脚本）：脚本必须内置产物自检，`mount(0)` 不存在直接 `[失败]`，不能只看"written: xxx KB"。
3. **tail 清理旧渲染脚本用贪婪正则一次清到文件尾**（`/<script>\s*\(function \(\)[\s\S]*$/`），再拼新脚本；不能用非贪婪，否则残留旧 `</body></html>`。
4. **渲染脚本里的正则含 `**` 与反斜杠转义**：模板文件 `templates/render-script.js.tmpl` 存的是纯 JS 源码（`.replace(/\*\*/g, ...)`），由脚本读入后字符串替换占位符注入，不要把模板内容嵌进 JS 模板字符串再双重转义。
5. **UI 交互版源数据头部元信息为空**（project_name/document_name/source_file/inspection_date）：合并后头部显示空白是源数据如此，不是合并缺陷，不要"顺手修"。
6. **document 级监听只绑一次**：Tab 切换、图表点击筛选、键盘导航都是事件委托，写在 mount 外；mount 内只给新生成的 KPI 卡绑事件（旧元素随 innerHTML 替换销毁，不会累积）。

## 边界

- 本 skill 只做**结构与呈现层合并**，不修改任何一份报告的问题内容、不做跨报告的去重或统计合并（两份报告的问题清单保持独立，Tab 隔离）。
- 不负责单份 Dashboard 的生成（那是 `build-dashboard.mjs` / `/gen-dashboard` 的事）。
- 仅适用于本仓库 Dashboard 模板产物；其他结构的 HTML 报告页不在能力范围内（脚本会在缺 `report-data` 标签时 `[失败]`）。
