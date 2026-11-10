# Workflow: parse-prd 输入预处理 / Export 打包

> 本文件是 Export 的落地说明（validate-output 通过后的打包动作）。

## 触发方式

validate-output result=pass 后。

## 步骤（PowerShell / 通用）

1. 确认 output 目录只包含：`index.html`（+ 未来资产）。
2. 打包：
   ```powershell
   Compress-Archive -Path '<output>/interactive-game-prd/*' -DestinationPath '<output>/interactive-game-prd.zip' -Force
   ```
3. 抽样验收：解压 ZIP 到全新目录，双击 index.html，核对：
   - 需求导航完整；
   - PRD 条目能定位 UI、UI 能定位需求；
   - 模拟器可玩、判定日志可见；
   - 全程无网络请求（DevTools Network 面板无条目）。

## 质量门

- ZIP 内 index.html 与 output 内一致（大小一致）。
- 解压后全功能可用。

## 输出

- `output/interactive-game-prd.zip`

## 禁止事项

- 未过 validate-output 不得打包。
- 不得在 ZIP 中加入原始 PRD（除非用户明确要求）。
