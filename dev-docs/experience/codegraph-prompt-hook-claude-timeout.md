# CodeGraph prompt-hook 在 Claude Code 超时 60s 排查

- **日期**：2026-11-17
- **现象级别**：阻断（每次提交 prompt 都弹错，阻塞对话 60s）
- **影响范围**：Claude Code（非 pi agent），凡在 `E:\WorkProjects\Lobby\xuanwulobby`（有 CodeGraph 索引）目录下发起结构性 prompt

## 问题现象

Claude Code 每次提交 prompt 报错：

```
Error: Hook timed out after 60000ms: codegraph.cmd prompt-hook
```

该 hook 由 CodeGraph 安装器自动写入 `~/.claude/settings.json` 的 `UserPromptSubmit`（源码注释明确 "Installed by the installer into Claude's settings.json"），**不是 pi 插件**（pi bundle 中无此错误字符串）。

## 排查过程

1. **定位 hook**：`~/.claude/settings.json` L86 `"command": "codegraph.cmd prompt-hook"`，无 `timeout` 字段 → 默认 60s。
2. **双安装混淆**：`where.exe codegraph` 显示 PATH 先命中 `E:\WorkProjects\Tools\codegraph\codegraph-win32-x64\bin\codegraph.cmd`（standalone，10-03），npm shim 在 `D:\DevTools\npm-global`（11-14）。两份 dist **字节级一致**（1.6.2），排除版本漂移。
3. **误导性测试（坑）**：在 `PrdGameSkill` 等无索引目录测 prompt-hook 全部 0.3s 秒退（noop-no-index 路径），MSYS 管道下 standalone .cmd 还出现假挂起（stdio 双管道 + cmd wrapper 组合，与本案无关但严重干扰判断）。
4. **决定性发现**：全盘搜索发现 `E:\WorkProjects\Lobby\xuanwulobby\.codegraph\codegraph.db` = **675MB** 索引库。
5. **索引目录实测**（Node 模拟 Claude 的 `cmd /c` + 管道 stdio）：
   - 短结构性 prompt：**33.1s**（冷，注入 9.2KB 上下文）
   - 同样冷启动第二次：33.0s
   - 4095 字符 prompt（页缓存已热）：**5.8s**
   - 无索引目录对照组：0.3s

## 根因

三因叠加：

1. xuanwulobby 的 **675MB 索引冷打开** ≈ +27s（热后 explore 本体 ~6s）；
2. 上游 [#3284](https://github.com/colbymchenry/codegraph/issues/3284)：prompt-hook 把**完整 prompt** 传给 `codegraph_explore`，耗随长度暴涨（官方实测 3000 字符 → 173s，6000 字符 → 314s）；用户习惯贴长设计文档分析代码，正中该问题；
3. hook 配置**无显式 timeout** → Claude Code 默认 60s → 冷启动+长 prompt 场景必然被杀。

## 解决方案

`~/.claude/settings.json` 该 hook 补充显式短超时（不扩超时、不卸载、不动架构）：

```json
{
  "type": "command",
  "command": "codegraph.cmd prompt-hook",
  "timeout": 15
}
```

效果：热路径（~6s）仍能注入上下文；冷/长 prompt 路径 15s 即跳过，对话不再被阻塞 60s。

备选：彻底关闭自动注入 → 设环境变量 `CODEGRAPH_NO_PROMPT_HOOK=1` 或删除该 hook 块；手动调用能力不受影响（opencode/codex 里的 codegraph MCP server 独立存在）。

## 预防/注意事项

- **测 prompt-hook 必须在真实索引项目目录测**，无索引目录永远 noop 秒退，测不出任何问题。
- 大仓库建索引后，给 `UserPromptSubmit` hook 配显式 `timeout` 是必选项而非可选项。
- 关注上游 #3284 的修复（explore 查询应截断 prompt）；若升级 CodeGraph 版本，重测索引目录耗时。
- MSYS bash 管道下 standalone `.cmd` 有假挂起现象（stdin/stdout 双管道 + cmd wrapper），排查时勿被带偏；模拟 Claude 生成环境用 `spawn('cmd.exe', ['/c', cmd], {shell:true})` + 管道 stdio 最接近。
