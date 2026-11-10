// 左栏：待裁决问题列表（筛选 / 搜索 / 进度）
import { useWorkbench } from "../stores/workbench";
import type { Severity } from "../types";

const SEVERITY_LABEL: Record<Severity, string> = { high: "HIGH", medium: "MED", low: "LOW" };

export function QuestionList() {
  const { state, filters, setFilters, filteredQuestions, selectedId, select } = useWorkbench();
  const p = state?.progress;
  const draftCount = Object.keys(state?.approvalState?.drafts || {}).length;

  return (
    <aside className="col-list">
      <div className="progress-box">
        <div className="game-name">{state?.game || "加载中"}</div>
        <div className="progress-num">
          <b>{p ? p.total - p.open : "-"}</b> / {p?.total ?? "-"} 已处理
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${p && p.total ? Math.round(((p.total - p.open) / p.total) * 100) : 0}%` }}
          />
        </div>
        <div className="progress-legend">
          <span className="tag st-approved">已确认 {p?.approved ?? 0}</span>
          <span className="tag st-rejected">否决 {p?.rejected ?? 0}</span>
          <span className="tag st-deferred">挂起 {p?.deferred ?? 0}</span>
          <span className="tag st-open">待处理 {p?.open ?? 0}</span>
          {draftCount > 0 && <span className="tag tag-draft">草稿 {draftCount}</span>}
        </div>
      </div>

      <div className="filters">
        <input
          className="search"
          placeholder="搜索 OQ ID 或关键词"
          value={filters.query}
          onChange={(e) => setFilters({ query: e.target.value })}
        />
        <div className="filter-row">
          <select value={filters.severity} onChange={(e) => setFilters({ severity: e.target.value as typeof filters.severity })}>
            <option value="all">全部优先级</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select value={filters.status} onChange={(e) => setFilters({ status: e.target.value as typeof filters.status })}>
            <option value="open">待裁决</option>
            <option value="approved">已确认</option>
            <option value="rejected">已否决</option>
            <option value="deferred">已挂起</option>
            <option value="all">全部状态</option>
          </select>
        </div>
      </div>

      <div className="q-items">
        {filteredQuestions.map((q) => (
          <button
            key={q.id}
            className={`q-item ${q.id === selectedId ? "active" : ""}`}
            onClick={() => select(q.id)}
          >
            <span className={`sev sev-${q.severity}`}>{SEVERITY_LABEL[q.severity]}</span>
            <span className="q-id">{q.id}</span>
            <span className="q-text">{q.question}</span>
            {state?.approvalState?.drafts?.[q.id] && <span className="draft-dot" title="有未提交草稿" />}
            {q.status !== "open" && <span className={`tag st-${q.status}`}>{statusLabel(q.status)}</span>}
          </button>
        ))}
        {filteredQuestions.length === 0 && <div className="empty">无匹配问题</div>}
      </div>
    </aside>
  );
}

function statusLabel(s: string): string {
  if (s === "approved") return "已确认";
  if (s === "rejected") return "已否决";
  if (s === "deferred") return "已挂起";
  return s;
}
