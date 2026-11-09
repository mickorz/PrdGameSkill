// 右栏：影响分析（关联条目 / 同条目问题 / 条目裁决历史 / 预期流转）
import { useWorkbench } from "../stores/workbench";
import { ACTION_TO_OUTCOME, OUTCOME_TO_STATUS, outcomeLabel } from "../types";

export function ImpactPanel() {
  const { state, selected, selectedEvidence, select, draft, effectiveDecisionFor } = useWorkbench();
  if (!state || !selected) return <aside className="col-impact"><div className="empty">选择问题后展示影响分析</div></aside>;

  const rid = selected.requirement_id;
  const siblings = rid ? state.questions.filter((q) => q.requirement_id === rid && q.id !== selected.id) : [];
  const ridDecisions = rid ? state.decisions.filter((d) => (d.requirement_updates || []).some((u) => u.requirement_id === rid)) : [];
  const effective = effectiveDecisionFor(selected.id);
  const reqStatus = selectedEvidence?.requirement?.status || "";
  const previewTarget = draft.action ? OUTCOME_TO_STATUS[ACTION_TO_OUTCOME[draft.action]] : null;

  return (
    <aside className="col-impact">
      <h3>影响分析</h3>

      <div className="impact-block">
        <h4>关联需求条目</h4>
        {!rid && <div className="empty">该问题未关联具体条目</div>}
        {rid && (
          <div className="req-card-mini">
            <div className="mono">{rid}</div>
            <div>{selectedEvidence?.requirement?.name || "（无名称）"}</div>
            <div className="meta-line">
              当前状态：<b>{reqStatus || "未知"}</b>
              {selectedEvidence?.requirement?.authority ? ` · authority: ${selectedEvidence.requirement.authority}` : ""}
            </div>
            {selectedEvidence?.requirement?.description && (
              <div className="req-desc">{selectedEvidence.requirement.description}</div>
            )}
          </div>
        )}
      </div>

      <div className="impact-block">
        <h4>本次裁决预期流转</h4>
        {!draft.action && <div className="empty">先在中间栏选择裁决动作</div>}
        {draft.action && rid && previewTarget && reqStatus !== previewTarget && (
          <div className="transition-box mono">
            {rid}: status {reqStatus || "proposed"} → {previewTarget}
          </div>
        )}
        {draft.action && (!rid || reqStatus === previewTarget) && (
          <div className="empty">无 IR 状态变更（挂起或状态已一致）</div>
        )}
        <div className="fine-print">IR 文件更新与关联测试/模拟器重新校验由 P6-C 自动执行；当前版本提交后请运行 validate-ir 与 validate-output 复核。</div>
      </div>

      <div className="impact-block">
        <h4>同条目的其他问题（{siblings.length}）</h4>
        {siblings.length === 0 && <div className="empty">无</div>}
        {siblings.map((q) => (
          <button key={q.id} className="sibling-item" onClick={() => select(q.id)}>
            <span className={`sev sev-${q.severity}`}>{q.severity.toUpperCase()}</span>
            <span className="mono">{q.id}</span>
            <span className="q-text">{q.question}</span>
          </button>
        ))}
      </div>

      <div className="impact-block">
        <h4>该条目的裁决历史（{ridDecisions.length}）</h4>
        {ridDecisions.length === 0 && <div className="empty">无</div>}
        {ridDecisions.map((d) => (
          <div key={d.decision_id} className={`history-item ${effective?.decision_id === d.decision_id ? "effective" : ""}`}>
            <span className="mono">{d.decision_id}</span>
            <span className="mono small">{d.question_id}</span>
            <span className={`tag st-${d.decision_status}`}>{outcomeLabel(d.outcome)}</span>
            {(d.requirement_updates || []).map((u) => (
              <div key={u.requirement_id + u.field} className="mono small">
                {u.requirement_id}: {u.field} {u.from} → {u.to}
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}
