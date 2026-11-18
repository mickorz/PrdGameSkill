# 服务端采集单根 vs 分层引用——collect-source-manifest 支持同 repoId 多根

- 日期：2026-11-17
- 关联：执行文档 §21.8 I5；commit 715dfb9
- 组件：`.opencode-workflows/scripts/collect-source-manifest.mjs`、`5-server-verify.js`

## 问题现象

S5 服务端查证：agent 分片全部落盘成功，`collect-source-manifest` 采集闸门失败，报多条「证据文件在声明的源码根下均不存在」——agent 引用的 `common_game/xxx.cpp`、`hzmj_server/xxx.cpp`、`mah_frame/xxx.h` 都找不到，但文件真实存在。

## 排查过程

1. 核对文件系统：服务端源码根 `…/mahjong_server/src` 下是**多套玩法目录**（game_hzmj / game_gzmj / game_scmj / game_simple / mah_frame / ai_model），`game_hzmj/` 内才是 `hzmj_server/`、`common_game/`、`chunanmj_server/` 等层目录。
2. agent 的引用约定（Prompt 冻结契约）：repoId 固定 `server`，`file` 按**层相对路径**写（`common_game/…`、`hzmj_server/…`、`mah_frame/…`），即 hzmj_server/common_game 相对 `game_hzmj/`、mah_frame 相对 `src/`——单根（只有 `src`）不可能同时命中两类前缀。
3. `collect-source-manifest.mjs` 原实现假设 `--roots` 与 `--repo-ids` 严格 1:1，且同 repoId 不允许出现两次（line ~108 显式 fail「repoId 重复」）。

## 根因

**契约与实现错位**：证据引用约定是「按层相对」，而采集实现是「单 repoId 单根」。杭州麻将的服务端证据天然跨两个根（`src/game_hzmj` + `src`）。

## 解决方案

1. `collect-source-manifest.mjs`：放开同 repoId 多根——`--repo-ids "server,server"` 与 `--roots "<game_hzmj>,<src>"` 并行，允许重复 repoId；manifest 合并为**单仓条目**（repoRoot 取首根，文件列表按各根解析结果合并去重）。
2. `5-server-verify.js`：派生 `serverSrcRoots = serverSrcRoot + '/game_hzmj,' + serverSrcRoot`，collect 命令用双根 + `--repo-ids "server,server"`（spec configArgs 只含 `serverSrcRoot`，configHash 稳定）。
3. gold-set 增补「双根同 repoId」回归用例。

手动验证：run-001 采集 13 文件、run-002 采集 16 文件，`server@bf85ebee` 全绿。

## 预防/注意事项

- 「repoId ↔ 根」不要假设 1:1；引用约定（层相对）与解析根（物理目录）可能需要多对一。
- 多根同 repoId 时 manifest 必须仍输出单仓条目，否则 merge 端 (repoId,file) 联合匹配会看到两个仓。
