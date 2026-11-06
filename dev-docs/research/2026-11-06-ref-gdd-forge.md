# 调研笔记：GDD-Forge 参考项目研究

- 日期：2026-11-06
- 对象：`thirdparties/GDD-Forge`（只读调研，未修改该目录任何文件）
- 研究问题：Manifest/Feature/Segment 数据结构是什么？设计决策（Decision）如何记录与追溯？
- 关联项目：Interactive Game PRD（本仓库），为 P1「Game Requirement IR」设计提供参考
- 关联任务：P0-07（见 `dev-docs/planning/2026-11-06-interactive-game-prd-execution-plan.md`）
- 许可证状态：该仓库目录下没有任何 LICENSE / COPYING 文件（已用文件搜索确认）。README 末尾仅一行文字自称 "MIT"，但缺少正式许可证文本。在获得明确许可文本之前，本笔记所有结论仅限思想与结构借鉴，禁止复制其任何源代码。

---

## 一、项目概况

### 1.1 定位

GDD-Forge 是一个 100% 本地运行（纯浏览器端）的游戏设计文档（GDD）写作与维护工具：分段编辑器、任务清单、设计决策登记、Feature 依赖映射、头脑风暴画布，全部打包成一个可离线传阅的 `.GDD` 文件。没有服务器、没有账号、没有数据库，文件即事实源。

### 1.2 技术栈

| 层 | 技术 |
| --- | --- |
| 框架 | Next.js 15（App Router，静态导出）+ React 19 + TypeScript 5.7 |
| 样式 | Tailwind CSS 3 + Lucide 图标（ISC） |
| 文件格式 | fflate（MIT）做 ZIP 打包/解包，SHA-256（Web Crypto）做资源去重 |
| 持久化 | IndexedDB（库名 `gddml`），无任何后端 |
| 状态管理 | 手写 `useSyncExternalStore` + 事件发射器（单文档全局 store，刻意不引 Zustand/Redux） |

### 1.3 规模

- 核心数据层集中在 `src/lib/` 四个文件：`gdd-file.ts`（420 行，类型与序列化）、`segment-types.ts`（405 行，Segment 类型与默认值）、`gdd-manifest.ts`（404 行，v2 ZIP manifest 与资源引用）、`gdd-store.ts`（318 行，运行时 store）。
- 决策与 Feature 各一个 UI 组件：`DecisionsClient.tsx`（290 行）、`FeaturesClient.tsx`（354 行）。
- 整体是小型前端项目，数据结构即产品本体。

### 1.4 关键架构决策

1. **文件即事实源**：编辑期间自动存 IndexedDB，`.GDD` 文件是唯一权威数据，浏览器数据丢了只丢未保存的增量。
2. **格式自描述 + 宽松校验**：`magic: "GDDFORGE/2"` + `version: 2` 标识格式；校验只做形状检查（magic/version/project 必须在，数组缺省补空），不引入 zod 等校验依赖；读入内存时统一规范化为 v2，保存时自动完成 v1 到 v2 的迁移。
3. **内容与引用分离**：图片以 SHA-256 内容寻址去重存储，文档内只放短引用（`gdd-asset://<hash>.<ext>`），内存 ref 与磁盘路径（`assets/<hash>.<ext>`）双向转换。
4. **实体间用稳定 id 数组关联**：Decision 与 Feature 都持有 `segmentIds: string[]`，Feature 另有 `dependsOn: string[]`。

---

## 二、固定问题逐条回答

### 问题 1：Manifest/Feature/Segment 数据结构是什么？

#### 1a. Manifest（`.GDD` 文件的根结构）

**结论：Manifest 就是整个 GDD 的 JSON 根对象（`GddFile`），v2 格式下它作为 ZIP 包内的 `manifest.json` 存在，旁边挂一个按内容哈希命名的 `assets/` 目录。**

`.GDD` 文件物理结构（README「Formato del archivo .GDD」节 + `src/lib/gdd-manifest.ts` 的 `packZip`/`unpackZip`）：

```text
mi-gdd-v0.1.gdd            （实为 ZIP）
  manifest.json            （GddFile 全量 JSON）
  assets/
    <sha256>.png           （一张图一个文件，SHA-256 去重）
    <sha256>.svg
```

`GddFile` 类型定义见 `src/lib/gdd-file.ts`（`export type GddFile`）：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `magic` | `"GDDFORGE/2"` 字面量 | 格式标识，v1 为 `"GDDFORGE/1"`，读入时兼容两者并统一升级 |
| `version` | `2` | 格式版本 |
| `createdAt` / `updatedAt` | ISO 字符串 | 时间戳 |
| `author` | string 或 null | 作者 |
| `project` | `Project` | 项目元信息：id、title、subtitle、eyebrow、version、status（draft / in-progress / completed）、accent 主题色 |
| `segments` | `Segment[]` | 文档正文分段，见 1c |
| `taskGroups` | `TaskGroup[]` | 任务清单（Task：id、title、status、priority、order、groupId） |
| `decisions` | `Decision[]` | 设计决策，见问题 2 |
| `features` | `Feature[]` | 功能映射，见 1b |
| `brainstorm` | `BrainstormData` | 头脑风暴画布（nodes / edges / shapes） |

校验逻辑在 `src/lib/gdd-file.ts` 的 `validateGdd`：只检查 magic、version、project 块存在，四个数组缺省补 `[]`，然后强制把 magic/version 规范化为 v2 —— 读取即迁移，不设显式迁移步骤。

资源引用的双形态转换是 Manifest 层的核心机制（`src/lib/gdd-manifest.ts`）：

- 内存态：字段值为 `gdd-asset://<hash>.<ext>`（`REF_SCHEME`）。
- 磁盘态（manifest 内）：同一字段值为 `assets/<hash>.<ext>`。
- `buildManifest(file)` 保存时：遍历所有 Segment，找到承载资源的字段（`getAssetField` 按 Segment 类型分派：image 取 `url`、character/enemy/boss 取 `avatarUrl`、note 取 `drawing`），把 ref 经 IndexedDB 取出字节写入 ZIP；孤儿引用（IDB 里已无对应 blob）清空字段而不是报错。
- `hydrateFile(manifest, assets)` 加载时：反向操作，先把所有资源字节写入 IndexedDB，再把磁盘路径改写回内存 ref。
- 上传走 `uploadAsset`：算 SHA-256，以哈希为键入库，返回 ref。同一张图在 N 个 Segment 出现只存一份。

#### 1b. Feature

**结论：Feature 是"游戏功能"到"实现它的文档分段"的映射节点，带功能间依赖。**

类型定义见 `src/lib/gdd-file.ts`（`export type Feature`）：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | `newId()` 生成（`crypto.randomUUID()`，见同文件） |
| `name` | string | 功能名 |
| `description` | string 或 null | 描述 |
| `status` | `"planned" | "in-progress" | "done" | "cut"` | 四态生命周期，`cut` 表示砍掉 |
| `dependsOn` | `string[]` | 依赖的其他 Feature 的 id 数组 |
| `segmentIds` | `string[]` | 实现该功能的文档 Segment id 数组 |

交互细节（`src/components/FeaturesClient.tsx`）：

- 新建时草稿直接带 `dependsOn` / `segmentIds` 多选（分别从现有 Feature 列表、现有 Segment 列表勾选）。
- 删除某个 Feature 时（`onDelete`），会遍历其余 Feature 把它的 id 从对方的 `dependsOn` 中剔除、把它自己的 id 从所有 `segmentIds` 中剔除（第 94-95 行附近），即**删除时维护引用完整性**。
- 状态切换只改 `status` 字段，无时间戳记录（与 Decision 不同）。

#### 1c. Segment

**结论：Segment = 稳定 id + 类型字面量 + 顺序号 + 按类型的载荷（discriminated union），是整个文档的最小组织单元，也是 Decision / Feature / 交叉链接的追溯锚点。**

类型定义见 `src/lib/segment-types.ts`（`export type Segment`）：

```ts
type Segment = {
  id: string;      // crypto.randomUUID()
  type: SegmentType; // 12 种字面量之一
  order: number;   // 文档内排序
  data: any;       // 按 type 取 SegmentDataByType 中对应形状；运行时不强校验
};
```

12 种 `SEGMENT_TYPES`（同文件）：`hero`（封面）、`text`、`image`、`grid`（卡片网格）、`callout`（高亮框）、`character`（角色卡）、`enemy`（敌人卡，含 stats 与可选公式）、`boss`（首领卡，含 phases）、`loop`（核心循环有向图）、`dialogue`（NPC 分支对话树）、`note`（自由画布）、`tension`（张力曲线，0-100 x 0-100 节点 + Catmull-Rom 平滑）。

三类典型载荷（同文件 `SegmentDataByType`）：

- 游戏领域卡：`EnemyData` = name + tier（common/elite）+ behaviors（trigger/action 对数组）+ stats（health/damage/speed）+ 可选 `formulas`（用 `level`、`base` 变量覆盖静态数值的公式字符串）；`BossData` 额外有 phases（name/trigger/description/attacks）与 weakness。
- 图结构：`LoopData` = nodes（id/label/description/可选坐标）+ edges（from/to/label）；`DialogueData` = startNodeId + nodes（speaker/text/choices 数组，choice 是 label + nextNodeId）。
- 每种载荷都可混入 `Taggable = { tags?: string[] }` 用于搜索过滤（hero 因视觉标签撞名，搜索标签改用 `metaTags`）。

配套的两个小机制：

- 每种类型配一份图标（`SEGMENT_ICONS`）与标签 i18n key（`SEGMENT_LABEL_KEYS`）。
- `src/lib/segment-titles.ts` 的 `getSegmentTitle(type, data)`：为每种类型定义"短标题提取规则"（text 取 heading 或截断 body、enemy 取 name……），供 Decision / Feature 的关联列表和交叉链接显示人话而非 uuid。

### 问题 2：设计决策（Decision）如何记录与追溯？

#### 2a. 记录：五字段扁平记录，三态生命周期

类型定义见 `src/lib/gdd-file.ts`（`export type Decision`）：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | uuid |
| `title` | string | 决策标题（必填，UI 校验非空，`DecisionsClient.tsx` 的 `onAdd`） |
| `description` | string 或 null | 决策背景/内容 |
| `status` | `"open" | "taken" | "reverted"` | open = 待定，taken = 已采纳，reverted = 已回退 |
| `segmentIds` | `string[]` | 受该决策影响的 Segment id 列表 |
| `decidedAt` | string（ISO）或 null | 决定时间；状态离开 open 时写入 |
| `createdAt` | string（ISO） | 创建时间 |

记录流程（`src/components/DecisionsClient.tsx`）：

1. 新建：填标题 + 背景，从 Segment 多选列表勾选"影响哪些分段"（`segmentIds`），初始 `status: "open"`、`decidedAt: null`。
2. 状态流转：`onSetStatus` 改 status 的同时维护 `decidedAt` —— 置为 taken/reverted 时写当前时间戳，重新开回 open 时清空。三种状态都可互相切换（重新打开 / 标记采纳 / 标记回退），即**决策可以反悔并回到待定态**。
3. 顶部常驻三种状态的计数徽章（open/taken/reverted 各多少条）。
4. 模板初始化时（`src/lib/gdd-file.ts` 的 `newGddFromTemplate`），模板预设的决策以 `status: "open"`、`segmentIds: []` 批量入库，作为待讨论清单。

#### 2b. 追溯：Decision 单向指向 Segment + 正文 wiki 链接辅助

**结论：追溯是"决策到分段"的单向 id 引用，配合短标题提取器在 UI 上可读；另有一套正文内 `[[标题]]` wiki 链接作为补充，但没有反向索引，也没有决策历史账本。**

具体机制与证据：

1. **id 引用解析**：`DecisionsClient.tsx` 渲染每条决策时，把 `segmentIds` 逐个在 `segById` 映射（`new Map(segments.map(s => [s.id, s]))`）中查回 Segment 对象，用 `titleOf`（组件内局部版，逻辑同 `segment-titles.ts`）显示"影响：龙王、哥布林"这样的人话标签；查不到的 id 被 `filter(Boolean)` 静默丢弃。
2. **时间戳锚点**：`decidedAt` 只记最后一次状态变更时间，配合 `createdAt` 可看出决策何时提出、何时拍板。但**没有历史记录数组**——回退再采纳会覆盖旧时间戳，"何时回退过"无从考证。
3. **正文内交叉链接**：`src/lib/cross-links.tsx` 的 `renderTextWithLinks` 解析 `[[Dragon King]]` 或 `[[seg-id]]` 语法，优先按 id 精确匹配、其次按 Segment 短标题大小写不敏感匹配，渲染成带图标的链接；匹配失败渲染红色警示标签提示"目标不存在"。这使任意 Segment 正文都能引用其他 Segment，是轻量的双向追溯入口（视觉上双向，数据上仍是渲染时解析，无持久化边）。
4. **与 Feature 的对照**：Feature 用完全相同的 `segmentIds` 模式关联分段，并用 `dependsOn` 建立功能依赖图，删除时清理引用；Decision 的 `segmentIds` **不做**反向清理——删除 Segment 后决策里的悬挂 id 只是不显示。

局限（对照本项目 IR 需求）：

- Decision 无 rationale/备选方案/影响分析等结构化字段，只有一个自由文本 description。
- 无决策历史（decision log 时间线），`reverted` 之后回退原因只能靠人肉读 description。
- 无反向查询：从 Segment 出发看不到"哪些决策影响我"。
- Segment 删除不触发 Decision 引用清理，追溯链接可能静默失效。

---

## 三、对 Interactive Game PRD（Game Requirement IR）的可借鉴点

对照 `dev-docs/requirements/2026-11-06-interactive-game-prd.md` 第 4 节的 IR 设计（manifest.yaml、requirements 条目、source 追溯、status/authority、ui_refs/test_refs/dependencies）：

| 序号 | 借鉴点 | GDD-Forge 做法（证据） | 对 IR 的落地建议 |
| --- | --- | --- | --- |
| 1 | 格式自描述 + 读入即迁移 | `GddFile.magic` + `version`，`validateGdd` 宽松形状校验后强制规范化为当前版（`src/lib/gdd-file.ts`） | IR 的 manifest.yaml 采用同样的 `format/name + version` 双字段；校验器读取旧版本时自动升级到当前版并在报告中注明，不做多版本并存 |
| 2 | 稳定 id + 引用数组 + 删除时清理引用 | Feature 的 `dependsOn` / `segmentIds`，`FeaturesClient.tsx` 删除时反查清理所有引用 | IR 条目的 `dependencies` / `ui_refs` / `test_refs` 同为 id 数组；校验工具应包含"引用完整性检查 + 悬挂引用报告"，避免 GDD-Forge 中 Decision 悬挂 id 静默失效的问题 |
| 3 | 内容与引用分离、内容寻址去重 | SHA-256 内容寻址 + `gdd-asset://` ref，保存/加载时双向转换（`src/lib/gdd-manifest.ts`） | IR 若承载图片/附件，采用"文件按哈希存放 + 文档内短引用"的思路；本项目 IR 主文本为 YAML，可仅借鉴"引用不内嵌大内容"的原则 |
| 4 | 每类型一个短标题提取器 | `segment-titles.ts` 的 `getSegmentTitle`，让关联列表显示标题而非 uuid | IR 条目已有 `name` 字段，等价能力天然具备；借鉴点在于**所有引用处统一经同一个提取函数渲染**，保证追溯 UI 一致 |
| 5 | 决策三态 + 影响范围 id 列表 | Decision 的 open/taken/reverted + `segmentIds` + `decidedAt` | 与 IR 的 `status`（proposed/approved/rejected/deprecated）和 `source.human_decision` 呼应；GDD-Forge 验证了"三态 + 时间戳 + 关联对象"是可用最小集 |
| 6 | 正文 wiki 链接做零成本追溯入口 | `cross-links.tsx` 的 `[[标题]]` 语法，id 优先、标题兜底、断链红色警示 | 生成的 HTML PRD 页内可借鉴此交互；但 IR 事实源内部坚持用 id 引用，不用标题匹配（GDD-Forge 的标题兜底在改名后即断链） |
| 7 | 单文件打包交付 | `.GDD` = ZIP（manifest.json + assets），fflate 打包，任何解压工具可检视 | IR 的交付形态（目录树 or 单文件导出）设计时可参考"manifest + 资产目录 + 可被通用工具检视"三原则 |

需明确**不借鉴**的点：

- `segment.data` 运行时按 `any` 处理、无 schema 校验 —— IR 必须走严格 JSON Schema 校验（P1-08 已规划），不能学这个省事做法。
- Decision 无历史账本、无 rationale 字段 —— IR 的 `source.human_decision` + `decision_log_ref` 设计比它完整，保持本项目方案。
- 单向引用无反向索引 —— IR 的一致性检查阶段应从引用数组派生反向索引，而不是像 GDD-Forge 那样放弃反向查询。

---

## 四、三档结论及理由

> 前提：该仓库无 LICENSE / COPYING 文件，README 仅有单行口头声明 "MIT"。缺少正式许可文本时，默认版权保留，不具备安全复用代码的条件。

| 档位 | 结论 | 覆盖范围 | 理由 |
| --- | --- | --- | --- |
| 复用代码 | 不采用 | 全部 | 仓库无正式 LICENSE 文件，法律上默认保留所有权利，禁止复制其任何源代码；且技术栈为 TypeScript/React 浏览器端应用，与本项目 Python/YAML 的 IR 工具链不匹配，即使有许可也无复用价值 |
| 借鉴思想 | 采用 | 格式自描述（magic/version + 读入即迁移）；内容引用分离与内容寻址去重；稳定 id 引用数组 + 删除时清理；短标题提取器统一渲染关联；决策三态 + 时间戳 + 影响范围记录；正文 wiki 链接交互；单文件打包交付三原则 | 这些是纯数据模型与交互层面的设计模式，思想借鉴不涉及代码复制；且与已有研究（prd-pilot 的扁平 Spec、Arrow 的状态机）互补——GDD-Forge 补上了"文档内实体关联与决策登记"这一维度 |
| 自研 | 采用 | IR 严格 Schema 与校验工具（GDD-Forge 无校验可参考）；决策历史账本与 rationale 结构（GDD-Forge 只有单条记录）；引用反向索引与悬挂引用检查（GDD-Forge 无此能力）；source 三分类追溯（GDD-Forge 无原文溯源概念） | 本项目的核心诉求（每条需求可追溯原始文档、AI 决策权限分级、确定性校验）在 GDD-Forge 中完全缺失，必须按需求文档第 4 节自研 |

一句话总结：GDD-Forge 的价值在于验证了一套"单文档 + 稳定 id + 引用数组 + 资产引用分离 + 决策登记"的轻量数据模型可以撑起一个完整的 GDD 工具；其结构思想可安全吸收进 Game Requirement IR 设计，其代码因无许可证文件一律禁止复制。

---

## 附：本次研究方法

- 全程只读：`find`/`grep`/`cat`/`read`，未向 `thirdparties/GDD-Forge` 写入任何内容。
- 证据文件清单：`README.md`、`package.json`、`src/lib/gdd-file.ts`、`src/lib/segment-types.ts`、`src/lib/gdd-manifest.ts`、`src/lib/segment-titles.ts`、`src/lib/cross-links.tsx`、`src/lib/gdd-store.ts`、`src/components/DecisionsClient.tsx`、`src/components/FeaturesClient.tsx`（grep 摘要）。
- 许可证核查：`find <repo> -iname "*license*" -o -iname "*copying*" -o -iname "*notice*"` 返回空（exit 1）。
