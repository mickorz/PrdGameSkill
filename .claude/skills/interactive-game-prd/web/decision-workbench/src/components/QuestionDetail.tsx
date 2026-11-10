// 中栏：按裁决动线三步式布局（问题是什么 → 依据是什么 → 怎么裁）+ 裁决历史
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useWorkbench } from "../stores/workbench";
import { ACTION_LABELS, outcomeLabel, type ActionKind } from "../types";

const ACTIONS: { key: ActionKind; desc: string }[] = [
  { key: "adopt", desc: "规则保持不变，关联条目转 approved" },
  { key: "modify", desc: "规则内容以你填写的新规则为准" },
  { key: "reject", desc: "关联条目转 rejected，对应推导作废" },
  { key: "defer", desc: "保留问题，不阻塞其他工作" },
];

function statusLabel(s: string): string {
  if (s === "approved") return "已确认";
  if (s === "rejected") return "已否决";
  if (s === "deferred") return "已挂起";
  return "待裁决";
}

function StepTitle({ no, text, extra }: { no: number; text: string; extra?: ReactNode }) {
  return (
    <div className="step-title">
      <span className="step-no">第 {no} 步</span>
      <span>{text}</span>
      {extra && <span className="step-extra">{extra}</span>}
    </div>
  );
}

export function QuestionDetail() {
  const {
    state, selected, selectedEvidence, evidenceLoading,
    draft, setDraft, draftSavedAt, submitting, submitErrors, submit,
    decisionsCovering,
  } = useWorkbench();
  const [expandedAnchors, setExpandedAnchors] = useState<number[]>([0]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // 切换问题时重置锚点折叠（默认只展开第 1 个）
  useEffect(() => {
    setExpandedAnchors([0]);
  }, [selectedEvidence]);

  if (!state) return <section className="col-main"><div className="empty">加载中…</div></section>;
  if (!selected) return <section className="col-main"><div className="empty">从左侧选择一个问题开始裁决</div></section>;

  const history = decisionsCovering(selected.id);
  const effective = history.length > 0 ? history[history.length - 1] : null;
  const anchors = selectedEvidence?.anchors || [];
  const rid = selected.requirement_id;
  const req = selectedEvidence?.requirement;

  const toggleAnchor = (i: number) =>
    setExpandedAnchors((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  const allOpen = anchors.length > 0 && anchors.every((_, i) => expandedAnchors.includes(i));
  const toggleAll = () => setExpandedAnchors(allOpen ? [] : anchors.map((_, i) => i));

  // 提交禁用原因实时提示（替代"置灰不给理由"）
  const disabledReason = !draft.action
    ? "请选择裁决动作"
    : draft.action === "modify" && !draft.finalText.trim()
      ? "请填写补充的新规则"
      : !draft.rationale.trim()
        ? "请填写裁决理由"
        : null;

  return (
    <section className="col-main">
      {/* 头部单行：severity + id + 中文状态 + 关联条目 chip */}
      <div className="detail-head">
        <span className={`sev sev-${selected.severity}`}>{selected.severity.toUpperCase()}</span>
        <span className="q-id-lg">{selected.id}</span>
        <span className={`tag st-${selected.status}`}>{statusLabel(selected.status)}</span>
        {rid && (
          <span className="req-chip mono" title={req?.name || ""}>
            关联条目: {rid}
          </span>
        )}
      </div>

      {/* 第 1 步 · 问题是什么（question 全文只渲染这一次） */}
      <StepTitle no={1} text="问题是什么" />
      <h2 className="q-title">{selected.question}</h2>

      {/* 第 2 步 · 依据是什么 */}
      <div className="block">
        <StepTitle
          no={2}
          text="依据是什么"
          extra={anchors.length > 1 && (
            <button className="link-btn" onClick={toggleAll}>{allOpen ? "全部收起" : "全部展开"}</button>
          )}
        />
        {evidenceLoading && <div className="empty">加载证据…</div>}
        {!evidenceLoading && !rid && <div className="empty">该问题未关联具体需求条目，请结合上下文直接裁决</div>}

        {rid && (
          <>
            {/* (1) IR 现行规则 = 「确认通过」的确认对象 */}
            <div className="sub-title">(1) IR 现行规则（「确认通过」动作的确认对象）</div>
            {req ? (
              <div className="ir-card">
                <div className="mono">{req.id}{req.name ? ` · ${req.name}` : ""}</div>
                <div className="meta-line">
                  status: <b>{req.status}</b>
                  {req.authority ? ` · authority: ${req.authority}` : ""}
                </div>
                {req.description ? (
                  <div className="req-desc">{req.description}</div>
                ) : (
                  <div className="warn-line">该条目 IR 未登记规则描述，建议改用「修改后通过」补齐内容后再确认</div>
                )}
              </div>
            ) : (
              <div className="warn-line">IR 中未找到条目 {rid}，确认前请先核对</div>
            )}

            {/* (2) 原始 PRD 引用（锚点可折叠） */}
            <div className="sub-title">(2) 原始 PRD 引用</div>
            {!evidenceLoading && anchors.length === 0 && <div className="empty">未找到该条目的原文锚点</div>}
            {anchors.map((a, i) => (
              <div key={i} className="anchor-box">
                <button className="anchor-toggle" onClick={() => toggleAnchor(i)}>
                  <span className="anchor-caret">{expandedAnchors.includes(i) ? "v" : ">"}</span>
                  {a.file} · {a.heading} · L{a.line_start}-{a.line_end}
                </button>
                {expandedAnchors.includes(i) && <pre className="quote-text">{a.quote}</pre>}
              </div>
            ))}

            {/* (3) 需求附图（截图依据）：AI 无法读取截图数值，人工对照后以文本补充 */}
            {(selectedEvidence?.images?.length ?? 0) > 0 && (
              <>
                <div className="sub-title">(3) 需求附图（截图依据）</div>
                <div className="notice-line">截图仅作为人工对照依据：AI 无法读取截图中的数值，确认前请把口径以文本形式补充在裁决理由或新规则中。</div>
                {selectedEvidence!.images.map((img) =>
                  img.exists ? (
                    <div key={img.name} className="img-box">
                      <img src={img.url} alt={img.name} />
                      <div className="img-caption mono">{img.name}</div>
                    </div>
                  ) : (
                    <div key={img.name} className="warn-line">
                      截图缺失：{img.name}。请把该截图放入 examples/mahjong/game-spec/source/images/ 目录（按此文件名），刷新页面后展示。
                      在截图到位前，请人工对照原始聊天/文档，把数值以文本形式补充后裁决。
                    </div>
                  ),
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* 第 3 步 · 人工裁决 */}
      <div className="block">
        <StepTitle no={3} text="人工裁决" />
        <div className="action-list">
          {ACTIONS.map((a) => (
            <label key={a.key} className={`action-row ${draft.action === a.key ? "active" : ""}`}>
              <input
                type="radio"
                name="decision-action"
                checked={draft.action === a.key}
                onChange={() => setDraft({ action: a.key })}
              />
              <span className="action-name">{ACTION_LABELS[a.key]}</span>
              <span className="action-desc">{a.desc}</span>
            </label>
          ))}
        </div>

        {draft.action === "modify" && (
          <label className="field">
            <span>补充新的规则（人工确认，提交后写入 decision-log，必填）</span>
            <textarea
              rows={3}
              value={draft.finalText}
              placeholder="例如：字分参与结算，公式为 ..."
              onChange={(e) => setDraft({ finalText: e.target.value })}
            />
          </label>
        )}
        <label className="field">
          <span>裁决理由（必填{draft.action === "adopt" ? "，已预填默认，可改写" : ""}）</span>
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
            disabled={submitting || disabledReason !== null}
            onClick={() => void submit()}
          >
            {submitting ? "提交中…" : "提交正式裁决"}
          </button>
          {disabledReason && <span className="disabled-reason">无法提交：{disabledReason}</span>}
          {disabledReason === null && draftSavedAt && <span className="draft-hint">草稿已自动保存 {draftSavedAt}</span>}
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

      {/* 裁决历史：默认折叠，一行摘要 */}
      {history.length > 0 && effective && (
        <div className="block">
          <button className="history-toggle" onClick={() => setHistoryOpen(!historyOpen)}>
            <span className="anchor-caret">{historyOpen ? "v" : ">"}</span>
            裁决历史（{history.length}）· 当前有效：{effective.decision_id} {outcomeLabel(effective.outcome)}
          </button>
          {historyOpen && (
            <div className="history-list">
              {[...history].reverse().map((d) => (
                <div key={d.decision_id} className={`history-item ${d === effective ? "effective" : ""}`}>
                  <span className="mono">{d.decision_id}</span>
                  <span className={`tag st-${d.decision_status}`}>{outcomeLabel(d.outcome)}</span>
                  <span className="history-meta">
                    {d.decided_at}
                    {d === effective ? " · 当前有效" : " · 已被替代"}
                    {d.supersedes ? ` · 翻案自 ${d.supersedes}` : ""}
                  </span>
                  <div className="history-rationale">{d.rationale}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
