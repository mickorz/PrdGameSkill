# MSYS Git Bash 环境坑：ln -s 深拷贝与 write/bash 的 /tmp 不一致

## 问题现象

在执行 workflow 脚本校验任务时，为让 node 能解析 npm 全局包，执行了
`ln -sfn "D:\DevTools\npm-global\node_modules" node_modules`，命令长时间无响应被中止；
随后 `node /tmp/wfcheck/validate.mjs` 又报 `Cannot find module ...validate.mjs`（文件明明刚写入成功）。

## 排查过程

1. 观察被中止命令的残留：`/tmp/wfcheck/node_modules` 下已出现 `@deepseek-ai`、`@opencode-ai` 等大量包目录——说明 `ln -s` 在做**递归复制**而非建符号链接。
2. 对比路径：bash 里 `/tmp` 实际映射 `C:\Users\<user>\AppData\Local\Temp`（node 报错路径可证），而 `write` 工具写入的 `/tmp/wfcheck/validate.mjs` 落在了另一个文件系统（write 工具侧是 WSL 的 `/tmp`），两边 `/tmp` 不是同一目录。
3. 结论：当前会话的 bash 是 **Windows MSYS/Git Bash**（不是 WSL；所以 `ls "D:\DevTools\..."` 这类 Windows 反斜杠路径能直接用），而部分工具进程在 WSL 侧。

## 根因

1. **MSYS 的 `ln -s` 默认语义是复制**：MSYS 环境下符号链接默认退化为深拷贝（除非设置 `MSYS=winsymlinks:nativestrict` 且具备开发者模式/管理员权限）。对几十个全局包、数万文件的 node_modules 执行等于全量复制，耗时极长。
2. **工具进程分属两套文件系统视图**：bash（MSYS，`/tmp` = Windows Temp）与 write 工具（WSL，`/tmp` = Linux /tmp）对 `/tmp` 的映射不一致，bash 侧看不到 write 侧写的文件。

## 解决方案

1. 不建 node_modules 链接：ESM 导入改用 `file://` URL 直连包内文件（bare import 的依赖会从该文件所在位置向上正常解析），例如：
   `import { parseWorkflowScript } from 'file:///D:/DevTools/npm-global/node_modules/<pkg>/dist/runtime/vm.js'`
2. 需要在 bash 里用的临时脚本，用 bash heredoc（`cat > /tmp/xx <<'EOF'`）直接在 bash 侧落盘，不走 write 工具；或把文件放到双方视图一致的仓库目录内。

## 预防/注意事项

- 本仓库会话中的 bash 命令按 **MSYS/Git Bash 语义**理解：`ln -s` = 复制、`/tmp` = Windows Temp、Windows 盘符路径（`D:\...` 与 `E:/...`）可直接使用。
- 给 node 传脚本路径时，让 bash 自己写脚本自己跑，避免跨工具的 `/tmp` 错位。
- 清理深拷贝残留用 `rm -rf`（首次可能因目录非空报错，重跑一次即可删净）。
