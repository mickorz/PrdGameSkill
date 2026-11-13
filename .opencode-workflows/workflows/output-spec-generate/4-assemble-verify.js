// Output-Spec Generate 子流程 4/4：装配与校验
//
// 从主 workflow output-spec-generate.js 拆分而来（2026-11-13，拆分方案见主文件头注释）。
// 职责：确定性命令收尾——build-output-spec.mjs 一步完成合并补充版、装配索引、机械校验
//       （无 LLM 转述；中文路径全经 runtime/build-config.json 传递，CLI 参数保持 ASCII，
//        规避中文路径经命令行的编码风险，见 dev-docs/experience/workflow扫描agent全量转述超时-确定性扫描替代.md），
//       然后逐项确认产物文件存在。
//
// 由主 workflow 经显式路径调用（本目录不在注册表扫描范围）：
//   await workflow({ scriptPath: './.opencode-workflows/workflows/output-spec-generate/4-assemble-verify.js', label: '装配与校验' }, childArgs)
// args：
//   specDir        1-spec 产出目录，默认 spec-workflow/output-spec/2026-11-13/1-spec
//   supplementPath 补充版文档输出路径，默认 spec-workflow/output-spec/核心流程杭州麻将好友房AI-补充版本.md
//
// 返回（供主 workflow 汇总）：
//   { specDir, supplementPath, featureIndexPath, stageManifestPath, verifyReportPath }

export const meta = {
  id: 'output-spec-assemble-verify',
  name: 'output_spec_assemble_verify',
  description: '确定性装配 1-spec 产物并机械校验（合并补充版、装配索引、校验报告）',
  phases: [{ title: '装配与校验' }],
}

const A = args || {}

const specDir = A.specDir || 'spec-workflow/output-spec/2026-11-13/1-spec'
const supplementPath =
  A.supplementPath || 'spec-workflow/output-spec/核心流程杭州麻将好友房AI-补充版本.md'

setConcurrency(A.concurrency || 16)

// ============================================================
// 装配与校验（确定性命令，无 LLM 转述；CLI 参数保持 ASCII）
// ============================================================

phase('装配与校验')

// build-output-spec.mjs 一步完成：合并补充版分片 -> 装配 feature_index/stage_manifest -> 机械校验
// （中文路径全经 runtime/build-config.json 传递，规避中文路径经命令行的编码风险）
const buildCmd =
  'node ".opencode-workflows/scripts/build-output-spec.mjs" "' + specDir + '/runtime/build-config.json"'
const buildOk = await commandSuccess(buildCmd)
if (!buildOk) {
  throw new Error(
    '产出装配与校验失败（合并补充版/装配索引/机械校验某步失败，见上方命令日志；校验明细见 ' +
      specDir + '/runtime/spec_check/verify-report.md），请重跑 workflow'
  )
}

await check(() => fileExists(specDir + '/feature_index.json'), 'feature_index.json 未生成')
await check(() => fileExists(specDir + '/stage_manifest.md'), 'stage_manifest.md 未生成')
await check(() => fileExists(supplementPath), '补充版文档未生成')

log('装配与校验完成：' + specDir + ' 与 ' + supplementPath)

return {
  specDir: specDir,
  supplementPath: supplementPath,
  featureIndexPath: specDir + '/feature_index.json',
  stageManifestPath: specDir + '/stage_manifest.md',
  verifyReportPath: specDir + '/runtime/spec_check/verify-report.md',
}
