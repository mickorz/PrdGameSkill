# 裁决草稿持久化（评审 P1）执行记录

- 日期：2026-11-10
- 来源：人工评审（2026-11-10 12:17）建议优先项
- 状态：已完成

## 问题

裁决数据保存在页面内存，刷新页面时尚未导出的裁决草稿丢失。31 项待裁决问题大概率分多天处理，跨会话草稿无法保留。

## 实施内容（commit 见 git log）

草稿自动持久化到浏览器 localStorage（仅表单态），与 decisions.json 正式管线完全隔离：

| 项 | 实现 |
|---|---|
| 存储键 | `igp-decision-drafts:<manifest.game_name>`（按游戏维度隔离，不同游戏不串数据） |
| 数据结构 | `{ <OQ id>: { form: { optionIds, inputs, rationale }, savedAt } }`（仅表单态，无 decision record 字段） |
| 自动保存 | 表单变化防抖 600ms 自动写入（选项 change + 理由 input；切换问题时 autoStashDraft 立即写入） |
| 刷新恢复 | draftToForm 优先级：内存 stash > localStorage > 内存裁决记录反推 > approval-state 旧草稿 |
| 保存提示 | 中栏底部状态行：自动保存时间 / 已恢复本地草稿（含保存时间） |
| 正式裁决清理 | 正式裁决成功后清除对应 OQ 的本地草稿（草稿不残留） |
| 管线隔离 | 草稿永不进导出（exportDecisions 只取非 draft records，本地草稿不参与）；localStorage 键与 decisions.json 完全分离 |
| 降级 | localStorage 不可用（隐私模式等）console.warn 并降级为内存暂存，不阻塞裁决 |

## 验证

- mahjong-smoke 55->58 项：自动保存到 localStorage（含 savedAt）/ 模拟刷新（清内存 stash）后从本地恢复 / 正式裁决后本地草稿清理。
- 全量 10+25+21+7 通过；双 validate-html PASS。
- jsdom 限制说明：jsdom 对 file:// 视为 opaque origin 禁 localStorage，测试 url 改用 https://localhost；真实 Chrome file:// 下 localStorage 可用，页面侧已有降级处理。

## 红线保留

- 草稿是表单态（未定案），不生成 decision record，不进 decisions.json。
- 正式裁决仍需人工点「正式裁决」与「导出」，reviewer 固定 human，AI 不代提交。
