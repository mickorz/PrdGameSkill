# node --check 对含 export 的 js 文件静默通过（掩盖 workflow 脚本真实语法错误）

## 问题现象

- 执行 workflow 工具启动 `.opencode-workflows/workflows/bug-coverage-check.js` 时，插件报错：`后台工作流启动失败（脚本校验）：Unexpected token (383:0)`。
- 但用 `node --check` 校验同一文件却返回 exit 0（通过），让人误以为脚本无语法错误、问题出在插件解析器。
- 实际上脚本第 336-381 行的 `parallel(...)` 调用缺少一个右括号（380 行 `}` 只闭合箭头函数块，381 行 `)` 只闭合 `map(`，`parallel(` 未闭合），是真实的语法错误。

## 排查过程

1. `node --check bug-coverage-check.js` → exit 0，看似无语法错误。
2. 用 skill 自带的 `wf-syntax-check.cjs` 校验 → 报 `missing ) after argument list`（无行号）。
3. 自写诊断脚本：把 `export const meta` 降级为 `const meta` 后包进 async IIFE，用 `vm.Script` 编译 → 定位到 381 行附近。
4. 逐行做括号深度扫描 → 381 行之后深度恒为 1，确认 `parallel(` 缺闭合括号。
5. 复制为 `.mjs` 后 `node --check` → 同样报 `missing ) after argument list`，与 `.js` 结果矛盾。
6. 最小实验：构造「`export const meta` + 缺括号 + 顶层 `await`」的测试文件，`.js` 过检、`.mjs` 报错，复现矛盾；而纯语法错误（无 export）的 `.js` 能正常报错。

## 根因

两层原因叠加：

1. **脚本本身缺括号**：重构 `parallel(batches.map(...))` 时漏写一层闭合。
2. **`node --check` 的检测机制缺陷**：Node 24 对无 package.json `type` 声明的 `.js` 文件，CJS 解析失败且探测到 `export` 等 ESM 语法特征时，会走模块语法检测路径重新判定；在 `--check` 模式下该路径对含 `export` 的文件即使存在真实语法错误也静默返回 0。导致 `.js` 校验给出假阴性，掩盖真实错误。

另外插件解析器（acorn 风格）报错位置 `Unexpected token (383:0)` 指向的是「语句无法继续的位置」（下一个语句开头），而不是缺括号的真实位置（381 行），定位时不要只盯着报错行看。

## 解决方案

1. 补上 `parallel(` 的闭合括号：

```javascript
// 修复前（380-381 行）
  }
)

// 修复后
  })
)
```

2. 校验 workflow 脚本一律用 skill 自带的语法检查（模拟沙箱：降级 export + 包 async IIFE，支持顶层 await/return）：

```bash
node .agents/skills/workflow-authoring/scripts/wf-syntax-check.cjs <脚本路径>
```

## 预防/注意事项

- **不要用 `node --check` 校验 workflow 的 `.js` 脚本**：含 `export` 时会静默通过（假阴性）；`.mjs` 又会误报顶层 `return` 非法（沙箱合法）。唯一可靠口径是 `wf-syntax-check.cjs`。
- 插件报 `Unexpected token (行:列)` 时，真实错误通常在报错位置**之前**——向上找最近一层未闭合的 `(`/`[`/`{`。
- 多层嵌套回调（`parallel(array.map(x => { return agent(...) }))`）改完括号后，可先跑括号深度扫描快速自检：

```javascript
// depth 最终必须为 0 且中途不为负
```

- 交付前自检已写入 workflow-authoring skill 的规范（「交付前语法自检（必做）」），严格执行即可避免此类问题。
