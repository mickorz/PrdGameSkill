# Workflow: parse-prd

> 模式：Create 第一步。目的：解析原始 PRD 的结构，产出章节清单与材料盘点。

## 触发方式

Create 模式启动时；输入为 `examples/<game>/source/original-prd.md`。

## 输入

- 原始 PRD 文件（Markdown；DOCX/PDF 需先人工转 Markdown）
- 目标游戏名 `<game>`

## 步骤

1. 校验文件存在且未改写（与用户提供版本 hash 一致，写入 manifest.source_files）。
2. 提取章节清单与标题层级。
3. 标记内容类型分布：规则定义 / 流程描述 / 数值配置表格 / UI 描述 / 验收条件 / 图片与附件引用。
4. 记录明显缺失的章节（如结算公式、异常流程），登记为候选 open question。
5. 产出结构盘点笔记（`dev-docs/research/` 或游戏目录内），供 generate-ir 使用。

## 质量门

- 文档可解析、章节清单完整。
- 缺失章节清单已产出。

## 输出

- 结构盘点记录 + manifest.source_files 更新。

## 禁止事项

- 禁止改写原始 PRD 任何内容。
- 禁止在本步直接产出需求条目（那是 extract-requirements 的事）。
