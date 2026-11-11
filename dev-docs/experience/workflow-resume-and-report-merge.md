# workflow 续跑与报告合并踩坑

记录整理 bug-coverage-check workflow 首次执行与迭代时的四个问题，供后续 workflow 脚本复用。

## 1. 优先级排序 `|| 兜底` 把 P0 排到最后

**问题现象**：报告问题清单里 P0 条目排在 PRD-035，P1 反而占了 PRD-001。

**根因**：`PRIORITY_ORDER = { P0: 0 }`，排序写成 `(PRIORITY_ORDER[p] || 9)`，P0 的 0 是假值被替换成 9，于是 P0 排到末尾。

**解决方案**：改用显式判断，禁止对可能为 0 的映射值用 `||` 兜底：

```js
function priorityIndex(p) {
  return PRIORITY_ORDER[p] === undefined ? 9 : PRIORITY_ORDER[p]
}
```

**预防**：枚举序号从 0 开始时，排序、取最小值一律用 `=== undefined` 判断。

## 2. 续跑时“分片存在性检查”误判失败

**问题现象**：修改合并步骤后用 `resumeFromRunId` 续跑，直接报“报告分片未生成：report.md.part1.md”。

**根因**：写作 agent 被 journal 缓存回放，不再真正写分片文件；上一次运行的合并步骤已把分片删除，而脚本在合并前有 `check(() => fileExists(part))`。

**解决方案**：删掉合并前的分片存在性检查，只保留最终 `report.md` 的存在检查；合并步骤对续跑幂等：

- 三个分片都不存在且目标文件已存在时，保留目标文件，直接进入乱码检查；
- 分片存在时才执行合并。

**预防**：凡是被 journal 回放的写文件 agent，其产物不可假设仍然存在；校验只放在最终交付物上。

## 3. PowerShell 5.1 合并写入 BOM

**问题现象**：`Get-Content ... | Set-Content -Encoding UTF8` 合并后文件头多出 3 字节 BOM（EF BB BF），部分解析器与 diff 视为异常。

**解决方案**：改用 node 合并，天然无 BOM：

```bash
node -e "const fs=require('fs');const ps=['a.md','b.md'];fs.writeFileSync('out.md',ps.map(p=>fs.readFileSync(p,'utf8')).join('\n\n'),'utf8');ps.forEach(p=>fs.unlinkSync(p))"
```

**预防**：Windows 环境统一用 node 做文本合并；需要 PowerShell 时显式检查并剥离 BOM。

## 4. 报告出现 U+FFFD 替换字符

**问题现象**：附录里“好友房”变成“���友房”。

**根因**：模型结构化输出经网关返回时个别汉字编码损坏，写入报告后留下 U+FFFD；合并阶段按 UTF-8 解码无法恢复。

**解决方案**：合并步骤增加乱码自检：扫描 U+FFFD，按上下文用 edit 只修这几个字，不重写整篇，最后确认数量为 0。

**预防**：长中文报告在合并后做一次 U+FFFD 计数检查；为 0 才算交付完成。

## 相关文件

- 脚本：`.opencode-workflows/workflows/bug-coverage-check.js`
- 产物：`examples/bug-check-workflow/report.md`、`report.json`、`dashboard/`
