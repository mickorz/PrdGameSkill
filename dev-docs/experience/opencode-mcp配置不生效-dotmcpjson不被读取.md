# opencode 读不到 MCP 配置：`.mcp.json` 不是 opencode 的配置文件

- 日期：2026-11-16
- 环境：Windows，opencode V2，项目 PrdGameSkill

## 问题现象

在项目根目录配置了 `.mcp.json`（内含 5 个 MCP server：chrome-devtools、zai-mcp-server、web-search-prime、web-reader、zread），重启 opencode 后这些 MCP 依然没有加载，`/mcps` 里看不到。

## 排查过程

1. 检查 `.mcp.json` 内容：格式本身没问题，甚至带了 `"https://opencode.ai/config.json"` 的 `$schema`，server 定义（`type`/`command`/`environment`/`url`/`headers`）字段都合法——排除 JSON 写错。
2. 检查 opencode 实际读取的配置路径（官方文档 https://opencode.ai/docs/mcp-servers 与 config schema https://opencode.ai/config.json）：
   - 项目级：`opencode.json` / `opencode.jsonc` / `.opencode/opencode.json`
   - 全局级：`~/.config/opencode/opencode.json`
   - **文件列表里根本没有 `.mcp.json`**。
3. 对比全局配置 `~/.config/opencode/opencode.json`：其中 codegraph MCP 写在 `mcp.servers.codegraph` 下且工作正常，确认 V2 的正确结构是 `mcp.servers.<名字>`。

## 根因

两层原因，文件名是主因：

1. **`.mcp.json` 是 Claude Code / Cursor 的约定文件名，opencode 完全不读取它**。配置再正确、重启多少次都不会生效。
2. 即使换成 opencode 的文件名，还有结构差异：opencode V2 要求 server 定义放在 `mcp.servers.<名字>` 下，不能直接放 `mcp.<名字>`（V1 写法，schema 里已标 deprecated）；且控制启停用 `disabled`，没有 `enabled` 字段。

## 解决方案

把 5 个 server 迁移到全局配置 `~/.config/opencode/opencode.json`（选全局而不是项目 `opencode.json` 的原因：本仓库按 CLAUDE.md 会自动 commit+push，`opencode.json` 被 git 跟踪，MCP 配置里的 API key 会泄露；`.opencode/` 也未被 gitignore）：

```json
{
  "mcp": {
    "servers": {
      "chrome-devtools": {
        "type": "local",
        "command": ["npx", "-y", "chrome-devtools-mcp@1.6.0"],
        "codemode": false
      },
      "zai-mcp-server": {
        "type": "local",
        "command": ["npx", "-y", "@z_ai/mcp-server"],
        "environment": { "Z_AI_API_KEY": "...", "Z_AI_MODE": "ZHIPU" },
        "codemode": false
      },
      "web-search-prime": {
        "type": "remote",
        "url": "https://open.bigmodel.cn/api/mcp/web_search_prime/mcp",
        "headers": { "Authorization": "Bearer ..." },
        "oauth": false,
        "codemode": false
      }
      // web-reader、zread 同构，略
    }
  }
}
```

要点：

- V2 结构：`mcp.servers.<名字>`；`command` 是字符串数组。
- 远程 server 若用 Bearer API key 认证（如 bigmodel 的 MCP 端点），加 `"oauth": false`，否则 opencode 默认尝试 OAuth 发现/登录流程。
- 沿用已有 codegraph 的 `"codemode": false`，工具直接暴露而不是 Code Mode 分组。
- 改完必须**重启 opencode**（配置启动时加载一次，不热加载），用 `/mcps` 或 `opencode mcp list` 验证。
- 迁移后项目根目录的 `.mcp.json` 成了死配置（对 opencode 和 Claude Code 都无效，后者要求顶层 `mcpServers`），可删除。

## 预防/注意事项

- 给 opencode 配 MCP，认准 `opencode.json`（项目）或 `~/.config/opencode/opencode.json`（全局），server 放 `mcp.servers` 下；或直接用 CLI：`opencode mcp add <名字> --url <url>` / `opencode mcp add <名字> -- <command...>`（写项目配置，`--global` 写全局）。
- 从 Claude Code 迁移配置时注意三处不兼容：文件名（`.mcp.json` → `opencode.json`）、结构（`mcpServers` → `mcp.servers`）、`command`（字符串 → 字符串数组）。
- 含 API key 的 MCP 配置不要放会入库的项目配置里（本仓库自动推送）；放全局配置或用 `{env:VAR}` 占位符。
- 配置不生效时先确认文件名/位置，再查结构：`https://opencode.ai/config.json` 是权威 schema，opencode 对非法字段会硬报错拒绝启动。
