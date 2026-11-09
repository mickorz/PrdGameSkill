// 中栏：问题详情 + 人工裁决表单 + 裁决历史
import { useWorkbench } from "../stores/workbench";
import { ACTION_LABELS, type ActionKind } from "../types";

const ACTIONS: ActionKind[] = ["adopt", "modify", "reject", "defer"];

export function QuestionDetail() {
  const {
    state, selected, selectedEvidence, evidenceLoading,
    draft, setDraft, draftSavedAt, submitting, submitErrors, submit,
    decisionsCovering,
  } = useWorkbench();

  if (!state) return <section className="col-main"><div className="empty">{loadMsg()}</div></section>;
  if (!selected) return <section className="col-main"><div className="empty">从左侧选择一个问题开始裁决</div></section>;

  const history = decisionsCovering(selected.id);
  const needFinalText = draft.action === "modify";
  const needRationale = draft.action === "reject" || draft.action === "defer" || draft.action === "modify";

  return (
    <section className="col-main">
      <div className="detail-head">
        <span className={`sev sev-${selected.severity}`}>{selected.severity.toUpperCase()}</span>
        <span className="q-id-lg">{selected.id}</span>
        {selected.status !== "open" && (
          <span className={`tag st-${selected.status}`}>已裁决：{selected.status}</span>
        )}
      </div>
      <h2 className="q-title">{selected.question}</h2>
      {selected.requirement_id && <div className="meta-line">关联：{selected.requirement_id}{selectedEvidence?.requirement?.name ? ` · ${selectedEvidence.requirement.name}` : ""}</div>}

      <div className="block">
        <h4>问题描述（AI 发现）</h4>
        <p className="q-desc">{selected.question}</p>
      </div>

      <div className="block">
        <h4>原始需求依据</h4>
        {evidenceLoading && <div className="empty">加载原文引用…</div>}
        {!evidenceLoading && !selectedEvidence?.anchors.length && (
          <div className="empty">{selected.requirement_id ? "未找到该条目的原文锚点" : "该问题未关联具体需求条目"}</div>
        )}
        {selectedEvidence?.anchors.map((a, i) => (
          <div key={i} className="quote-box">
            <div className="quote-meta">{a.file} · {a.heading} · L{a.line_start}-{a.line_end}</div>
            <pre className="quote-text">{a.quote}</pre>
          </div>
        ))}
      </div>

      <div className="block">
        <h4>请选择人工裁决</h4>
        <div className="action-grid">
          {ACTIONS.map((a) => (
            <button
              key={a}
              className={`action-btn ${draft.action === a ? "active" : ""} act-${a}`}
              onClick={() => setDraft({ action: a })}
            >
              {ACTION_LABELS[a]}
            </button>
          ))}
        </div>

        {needFinalText && (
          <label className="field">
            <span>最终口径（人工确认，提交后写入 decision-log）</span>
            <textarea
              rows={3}
              value={draft.finalText}
              placeholder="例如：字分参与结算，公式为 ..."
              onChange={(e) => setDraft({ finalText: e.target.value })}
            />
          </label>
        )}
        <label className="field">
          <span>裁决理由{needRationale ? "（必填）" : "（可选）"}</span>
          <textarea
            rows={2}
            value={draft.rationale}
            placeholder="裁决依据或说明"
            onChange={(e) => setDraft({ rationale: e.target.value })}
          />
        </label>

        <div className="submit-row">
          <button
            className="submit-btn"
            disabled={!draft.action || submitting || (needRationale && !draft.rationale.trim())}
            onClick={() => void submit()}
          >
            {submitting ? "提交中…" : "提交正式裁决"}
          </button>
          <span className="draft-hint">{draftSavedAt ? `草稿已自动保存 ${draftSavedAt}` : "表单内容会自动保存为草稿"}</span>
        </div>
        {submitErrors.length > 0 && (
          <div className="error-box">
            {submitErrors.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        )}
        <div className="fine-print">提交即写入 reviews/decision-log.json（reviewer=human，历史只追加）。涉及结算、番型、赔付的口径请以产品/策划确认为准。</div>
      </div>

      {history.length > 0 && (
        <div className="block">
          <h4>裁决历史（{history.length}）</h4>
          {history.map((d, i) => (
            <div key={d.decision_id} className={`history-item ${i === history.length - 1 ? "effective" : ""}`}>
              <span className="mono">{d.decision_id}</span>
              <span className={`tag st-${d.decision_status}`}>{d.outcome}</span>
              <span className="history-meta">{d.decided_at}{i === history.length - 1 ? " · 当前有效" : " · 已被替代"}</span>
              <div className="history-rationale">{d.rationale}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function loadMsg(): string {
  return "加载中…";
}
