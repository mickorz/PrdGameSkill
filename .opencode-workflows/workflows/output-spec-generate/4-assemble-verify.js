// Output-Spec Generate 子流程 4/4：装配与校验
//
// 从主 workflow output-spec-generate.js 拆分而来（2026-11-13，拆分方案见主文件头注释）。
// 职责：确定性命令收尾——build-output-spec.mjs 一步完成合并文档分片、装配索引、机械校验
//       （无 LLM 转述；中文路径全经 runtime/build-config.json 传递，CLI 参数保持 ASCII，
//        规避中文路径经命令行的编码风险，见 dev-docs/experience/workflow扫描agent全量转述超时-确定性扫描替代.md），
//       然后逐项确认产物文件存在。
//
// v3 策划版扩展（2026-11-14，需求 R7/R10，T3.5）：
//   - plannerOnly=true 时走策划版分支：build-output-spec.mjs（mode=planner-only，由
//     build-config.json 传递）只装配策划版链路（合并分片 -> 追溯索引 -> 泄漏检查 ->
//     AT-ID 覆盖检查），不重跑 assembleIndex/verifyOutputSpec 全套；产物检查只查
//     plannerPath 与 verify-report，不查 feature_index/stage_manifest/supplementPath。
//   - skipPlanner=true 时不检查 plannerPath（legacy 行为等同 v2）。
//   - 返回值增加 plannerPath。
//
// 由主 workflow 经显式路径调用（本目录不在注册表扫描范围）：
//   await workflow({ scriptPath: './.opencode-workflows/workflows/output-spec-generate/4-assemble-verify.js', label: '装配与校验' }, childArgs)
// args：
//   specDir        1-spec 产出目录，默认 spec-workflow/output-spec/2026-11-13/1-spec
//   supplementPath 补充版文档输出路径，默认 spec-workflow/output-spec/核心流程杭州麻将好友房AI-补充版本.md
//   plannerPath    策划版文档输出路径（v3），默认 spec-workflow/output-spec/核心流程杭州麻将好友房AI-策划版.md
//   plannerOnly    true 时只装配策划版链路（v3），默认 false
//   skipPlanner    true 时不检查策划版产物（legacy），默认 false
//
// 返回（供主 workflow 汇总）：
//   { specDir, supplementPath, plannerPath, featureIndexPath, stageManifestPath,
//     verifyReportPath, traceIndexPath, plannerOnly, skipPlanner }

export const meta = {
  id: 'output-spec-assemble-verify',
  name: 'output_spec_assemble_verify',
  description: '确定性装配 1-spec 产物并机械校验（合并文档分片、装配索引、校验报告；planner-only 时只装配策划版链路）',
  phases: [{ title: '装配与校验' }],
}

const A = args || {}

const specDir = A.specDir || 'spec-workflow/output-spec/2026-11-13/1-spec'
const supplementPath =
  A.supplementPath || 'spec-workflow/output-spec/核心流程杭州麻将好友房AI-补充版本.md'
const plannerPath =
  A.plannerPath || 'spec-workflow/output-spec/核心流程杭州麻将好友房AI-策划版.md'
const plannerOnly = A.plannerOnly === true
const skipPlanner = A.skipPlanner === true

setConcurrency(A.concurrency || 16)

// ============================================================
// 装配与校验（确定性命令，无 LLM 转述；CLI 参数保持 ASCII）
// ============================================================

phase('装配与校验')

// build-output-spec.mjs 一步完成（mode 经 build-config.json 传递，本脚本无需分支传参）：
//   full：合并补充版 + 合并策划版 -> 装配 feature_index/stage_manifest -> 追溯索引 -> 机械校验
//   planner-only：合并策划版 -> 追溯索引 -> 泄漏检查 -> AT-ID 覆盖检查（不触碰 sourceSpecDir）
// （中文路径全经 runtime/build-config.json 传递，规避中文路径经命令行的编码风险）
const buildCmd =
  'node ".opencode-workflows/scripts/build-output-spec.mjs" "' + specDir + '/runtime/build-config.json"'
const buildOk = await commandSuccess(buildCmd)
if (!buildOk) {
  throw new Error(
    '产出装配与校验失败（合并文档分片/装配索引/机械校验某步失败，见上方命令日志；校验明细见 ' +
      specDir + '/runtime/spec_check/verify-report.md），请重跑 workflow'
  )
}

if (plannerOnly) {
  // 策划版分支：只确认策划版链路产物（不查技术产物）
  await check(() => fileExists(plannerPath), '策划版文档未生成：' + plannerPath)
  await check(
    () => fileExists(specDir + '/trace_index.json'),
    'trace_index.json 未生成（追溯索引装配失败）'
  )
  log('装配与校验完成（planner-only）：策划版 ' + plannerPath + '，追溯索引 ' + specDir + '/trace_index.json')
} else {
  await check(() => fileExists(specDir + '/feature_index.json'), 'feature_index.json 未生成')
  await check(() => fileExists(specDir + '/stage_manifest.md'), 'stage_manifest.md 未生成')
  await check(() => fileExists(supplementPath), '补充版文档未生成')
  if (!skipPlanner) {
    await check(() => fileExists(plannerPath), '策划版文档未生成：' + plannerPath)
    await check(
      () => fileExists(specDir + '/trace_index.json'),
      'trace_index.json 未生成（追溯索引装配失败）'
    )
  }
  log(
    '装配与校验完成：' + specDir + ' 与 ' + supplementPath +
      (skipPlanner ? '' : ' 与策划版 ' + plannerPath)
  )
}

return {
  specDir: specDir,
  supplementPath: plannerOnly ? '' : supplementPath,
  plannerPath: plannerPath,
  featureIndexPath: plannerOnly ? null : specDir + '/feature_index.json',
  stageManifestPath: plannerOnly ? null : specDir + '/stage_manifest.md',
  verifyReportPath: specDir + '/runtime/spec_check/verify-report.md',
  traceIndexPath: skipPlanner && !plannerOnly ? null : specDir + '/trace_index.json',
  plannerOnly: plannerOnly,
  skipPlanner: skipPlanner,
}
