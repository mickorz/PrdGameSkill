# P1 Dashboard UI 改造：需求覆盖/规则覆盖 Tab 渲染中断问题记录

> 发生时间：2026-11-12
> 影响范围：[杭州麻将Dashboard-RTM覆盖清单与规则映射修改方案](./杭州麻将Dashboard-RTM覆盖清单与规则映射修改方案.md) P1 UI 改造
> 状态：已修复并全量验证通过（本文按 CLAUDE.md 经验沉淀规则记录排查全程）

## 问题现象

P1 改造后的 Dashboard（RTM 模式）出现诡异的部分渲染：

- 审计总览 header / KPI / 检查结论**正常**（363/1455/99.3%/44.3%/185 五卡齐全）
- 但**风险分析、图表、TOP、综合分析全空**
- 切到"需求覆盖"Tab：筛选 chips 显示（全部 363 / 完整通过 55 / 存在问题 184 / 未验证 116）但**表格永远 0 行**
- 规则覆盖 Tab 同样空表
- 浏览器 console 有 `Uncaught TypeError: Cannot read properties of undefined (reading 'missing')`（行号指向函数定义行，误导性强）

## 排查过程（走了弯路，按时间序）

1. **误判为投影缺字段**：第一轮以为是 `buildRtmView` 没投影 `fullyPassed` —— 属实（当时确实缺），补上后问题依旧
2. **误判为构建缓存/时序**：`nextDashboardName` 序号递增导致多个版本 HTML 并存，浏览器（chrome-use tab 组）反复命中旧版页面，产生"修好了又坏"的假象；还出现过 server 返回 404 页面被当成功加载
3. **注入探针**：给 `renderReqRows` 加 `window.__reqDebug` 行级探针，证明函数被调用、`RTM.requirements.length=363`、filter 正常、`visible=363`，但 tbody 写入不生效且**无任何异常冒泡**——疑似"静默失败"
4. **换用 chrome-use skill**（用户建议，替代 browser_* 内建工具）：`eval` 可拿完整返回对象、错误信息更完整，`session last` 可查命令历史，效率明显高于之前的零散 execute_js
5. **决定性实验**：检查各 section 渲染状态——`sec-risks/sec-charts/sec-top/sec-analysis` 全空，而它们之前的 `sec-header/kpis/conclusion` 正常 → **IIFE 在 03 conclusion 之后某处中断**
6. **定位中断行**：03 conclusion 与 04 风险之间是 03b 检查覆盖段，其第一行 `$('sec-coverage')` —— 本次 P1 骨架重排时 `sec-coverage` 节点已从 HTML 删除 → `null.style.display = 'none'` TypeError → 整个 IIFE 中断

## 根因

三层叠加：

1. **直接原因**：P1 骨架重排删除了 `<section id="sec-coverage">`，但渲染脚本 03b 段仍引用它；RTM 分支 `if (RTM) { $('sec-coverage').style.display = 'none'; return }` 对 null 取 `.style` 抛 TypeError
2. **放大原因**：Dashboard 渲染是一个大 IIFE，03b 之后的 04~08 段与 RTM 视图段全部未执行；但 `renderRequirementsView` 是函数声明（提升），Tab 事件绑定在 IIFE 顶部已完成 → Tab 能点、函数能进，而其依赖的 `ST_TEXT/stTag/reqFilter` 等 var/函数表达式**尚未初始化**（undefined）→ 表格 0 行且无可见报错
3. **误导原因**：错误行号指向函数定义行（提升后定义行的引用报错），console 报错被 Tab 事件链吞掉，多版本构建产物并存加大了排查噪声

## 解决方案

```javascript
// 03b 段改为安全跳过（节点不存在直接 return，不再假设骨架）
var covEl = document.getElementById('sec-coverage');
if (!covEl) return;
if (RTM || !cov || !cov.items || !cov.items.length) { covEl.style.display = 'none'; return; }
```

顺带修复同类隐患：KPI 卡跳转 `scrollTo(0, $('sec-coverage').offsetTop)` 改为判空后跳转。

## 修复后全量验证（chrome-use 实测通过）

| 验收项 | 结果 |
|---|---|
| 总览：4 Tab / 5 指标卡（363/1455/99.3%/44.3%/185）/ 来源 chips（逆向 578 + PRD 基准 877 待确认） | ✅ |
| 风险分析 / 图表 / TOP / 综合分析恢复渲染 | ✅ |
| 需求覆盖：全部 363 行、完整通过筛选 55 行 | ✅ |
| 需求抽屉：原文/关联规则表/检查维度标注 | ✅ |
| 需求→规则抽屉跳转（含 pending-confirm 权威性展示） | ✅ |
| 未验证归因展示（no-coverage-record） | ✅ |
| 规则覆盖：8 业务模块折叠、展开后 1455 行、抽屉跳回需求 | ✅ |
| 问题明细抽屉 RTM 反向链接 | ✅ |

## 经验教训

1. **单 IIFE 大脚本的任何一处未捕获异常会静默截断其后所有段**——渲染段的 DOM 引用必须全部判空；考虑后续把各 section 渲染拆成独立 try-catch
2. **删骨架节点必须同步清理渲染脚本引用**——本次只删了 `<section>` 没删对应渲染段
3. **多版本构建产物（-01/-02/...序号递增）+ 浏览器 tab 组复用会制造"修复无效"假象**——调试期应清空产物目录再构建，或用唯一 URL 参数强制刷新
4. **函数声明提升 + var 未初始化的组合故障极难从表象定位**（Tab 能点、函数能进、报错行号误导）——探针 + section 渲染状态二分法是有效手段
5. **chrome-use skill 的 `eval`/`session last`/结构化输出比内建 browser 工具链更适合这类深度调试**（用户在此环节指正，采纳）
