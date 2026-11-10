# Chrome 后台标签页 rAF 暂停导致页面点击「失效」

## 问题现象

单文件 index.html（file:// 打开）在 Chrome 自动化实测时：`browser_execute_js` 里执行 `element.click()` 点击导航分类、切换按钮等，事件正常派发（在 nav 上追加的记录 listener 能收到 capture/bubble），但页面内容不更新——`switchTab(tab, after)` 的 `after` 回调永远不执行。

而在 jsdom 冒烟测试中同样流程全部通过；真实用户前台手动点击也正常。

## 排查过程

1. 排查事件派发：在 `#nav` 上临时追加 capture/bubble 两个记录 listener，`cat.click()` 后两者都收到——事件派发与冒泡正常。
2. 排查页面 JS 错误：`browser_console` 无任何 error 记录。
3. 直接调用页面函数 `setSpecCategory("GAME-UI")`——立即生效（说明函数本身正常，且 execute_js 在 main world）。
4. 检查 `document.visibilityState`——返回 `hidden`（自动化控制的 Chrome 窗口处于后台/不可见状态）。
5. 验证 rAF：`requestAnimationFrame(cb)` 的回调不执行，`setTimeout(fn, 0)` 正常执行。

## 根因

模板中 `const raf = window.requestAnimationFrame || ((fn) => setTimeout(fn, 0));`——Chrome 在**隐藏（visibility=hidden）标签页中会暂停 requestAnimationFrame 回调**（渲染帧不产生，rAF 队列挂起）。`switchTab(tab, after)` 的 `after`（含分类切换、滚动定位、详情渲染二次更新）通过 raf 延迟执行，在后台标签页中永不触发；`setTimeout` 不受影响。

jsdom 测试中 `window.requestAnimationFrame` 未定义或立即执行，所以冒烟测试暴露不了此问题。

## 解决方案

模板中 rAF 改为纯 setTimeout（滚动定位 0ms 延迟无感知差异，前后台均可执行）：

```js
// 注意：不用 requestAnimationFrame（后台隐藏标签页中 rAF 会被 Chrome 暂停，导致切换/跳转不生效）；setTimeout 在前后台均可执行
const raf = (fn) => setTimeout(fn, 0);
```

## 预防/注意事项

- 浏览器自动化实测（CDP / headless / 后台窗口）验证「点击后页面没反应」时，先查 `document.visibilityState` 与 rAF 暂停，再怀疑事件绑定。
- 前端代码中用 rAF 做「下一帧再执行」的逻辑（延迟渲染、滚动定位），若需要在后台标签页/自动化环境工作，统一用 `setTimeout(fn, 0)`。
- 相关文件：`.claude/skills/interactive-game-prd/assets/html-template/index.html`（raf 定义与 switchTab）。
