// 工作台全局状态（Context + hooks，无第三方状态库）
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import * as api from "../services/api";
import {
  ACTION_TO_OUTCOME, OUTCOME_TO_STATUS, SEVERITY_RANK,
  type Decision, type DraftForm, type Evidence, type OpenQuestion, type WorkbenchState,
} from "../types";

interface Filters {
  severity: "all" | "high" | "medium" | "low";
  status: "all" | "open" | "approved" | "rejected" | "deferred";
  query: string;
}

interface WorkbenchStore {
  state: WorkbenchState | null;
  loadError: string | null;
  filters: Filters;
  setFilters: (patch: Partial<Filters>) => void;
  filteredQuestions: OpenQuestion[];
  selectedId: string | null;
  select: (id: string) => void;
  selected: OpenQuestion | null;
  selectedEvidence: Evidence | null;
  evidenceLoading: boolean;
  draft: DraftForm;
  setDraft: (patch: Partial<DraftForm>) => void;
  draftSavedAt: string | null;
  submitting: boolean;
  submitErrors: string[];
  submit: () => Promise<void>;
  effectiveDecisionFor: (qid: string) => Decision | null;
  decisionsCovering: (qid: string) => Decision[];
}

const Ctx = createContext<WorkbenchStore | null>(null);

// 「确认通过」动作的默认理由（可编辑，避免为「同意」而打字的摩擦，同时保留非空留痕）
const ADOPT_DEFAULT_RATIONALE = "确认现行规则无误，与原文依据一致";

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkbenchState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<Filters>({ severity: "all", status: "open", query: "" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [draft, setDraftState] = useState<DraftForm>({ action: null, finalText: "", rationale: "" });
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftDirty = useRef(false);

  const reload = useCallback(async () => {
    try {
      const s = await api.getState();
      setState(s);
      setLoadError(null);
      return s;
    } catch (e) {
      setLoadError((e as Error).message);
      return null;
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const s = await reload();
      // 中断恢复：定位上次处理位置（hash 优先，其次 last_position，最后第一条 open）
      const fromHash = /^#OQ-\d+/.exec(location.hash);
      if (fromHash) setSelectedId(fromHash[0].slice(1));
      else if (s?.approvalState?.last_position) setSelectedId(s.approvalState.last_position.question_id);
      else if (s) {
        const first = sortedQuestions(s.questions, filters)[0];
        if (first) setSelectedId(first.id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setFilters = useCallback((patch: Partial<Filters>) => {
    setFiltersState((f) => ({ ...f, ...patch }));
  }, []);

  const sortedQuestions = useCallback(
    (questions: OpenQuestion[], f: Filters) => {
      const q = f.query.trim().toLowerCase();
      return questions
        .filter((item) => (f.severity === "all" ? true : item.severity === f.severity))
        .filter((item) => (f.status === "all" ? true : item.status === f.status))
        .filter((item) => (!q ? true : item.id.toLowerCase().includes(q) || item.question.toLowerCase().includes(q)))
        .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.id.localeCompare(b.id));
    },
    [],
  );

  const filteredQuestions = useMemo(
    () => (state ? sortedQuestions(state.questions, filters) : []),
    [state, filters, sortedQuestions],
  );

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setSubmitErrors([]);
    history.replaceState(null, "", `#${id}`);
  }, []);

  // 选中问题后加载证据，并恢复草稿
  useEffect(() => {
    if (!selectedId || !state) return;
    setEvidenceLoading(true);
    api
      .getEvidence(selectedId)
      .then((e) => setSelectedEvidence(e))
      .catch(() => setSelectedEvidence(null))
      .finally(() => setEvidenceLoading(false));
    const d = state.approvalState?.drafts?.[selectedId];
    if (d) {
      const action = (Object.keys(ACTION_TO_OUTCOME) as Array<keyof typeof ACTION_TO_OUTCOME>).find(
        (k) => ACTION_TO_OUTCOME[k] === d.outcome,
      );
      setDraftState({ action: action ?? null, finalText: textOf(d.final_decision), rationale: d.rationale || "" });
      setDraftSavedAt("已恢复草稿");
    } else {
      setDraftState({ action: null, finalText: "", rationale: "" });
      setDraftSavedAt(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const setDraft = useCallback((patch: Partial<DraftForm>) => {
    setDraftState((d) => {
      const next = { ...d, ...patch };
      // 切换动作时维护默认理由：采纳预填默认，切走且未被人工改过则清空
      if (patch.action && patch.action !== d.action) {
        if (patch.action === "adopt" && (!d.rationale.trim() || d.rationale === ADOPT_DEFAULT_RATIONALE)) {
          next.rationale = ADOPT_DEFAULT_RATIONALE;
        } else if (patch.action !== "adopt" && d.rationale === ADOPT_DEFAULT_RATIONALE) {
          next.rationale = "";
        }
      }
      return next;
    });
    draftDirty.current = true;
  }, []);

  // 草稿自动保存（防抖 800ms）
  useEffect(() => {
    if (!selectedId || !draftDirty.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const outcome = draft.action ? ACTION_TO_OUTCOME[draft.action] : undefined;
        await api.saveDraft(selectedId, {
          outcome,
          final_decision: draft.finalText ? { text: draft.finalText } : null,
          rationale: draft.rationale,
        });
        setDraftSavedAt(new Date().toLocaleTimeString("zh-CN", { hour12: false }));
        draftDirty.current = false;
      } catch {
        setDraftSavedAt(null);
      }
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [draft, selectedId]);

  const effectiveDecisionFor = useCallback(
    (qid: string) => {
      let found: Decision | null = null;
      for (const d of state?.decisions || []) {
        if (d.question_id === qid || (d.related_question_ids || []).includes(qid)) found = d;
      }
      return found;
    },
    [state],
  );

  const decisionsCovering = useCallback(
    (qid: string) => (state?.decisions || []).filter((d) => d.question_id === qid || (d.related_question_ids || []).includes(qid)),
    [state],
  );

  const submit = useCallback(async () => {
    if (!state || !selectedId || !draft.action) return;
    const q = state.questions.find((x) => x.id === selectedId);
    if (!q) return;
    const outcome = ACTION_TO_OUTCOME[draft.action];
    const effective = effectiveDecisionFor(selectedId);
    setSubmitting(true);
    setSubmitErrors([]);
    try {
      await api.submitDecisions([
        {
          question_id: selectedId,
          decision_status: OUTCOME_TO_STATUS[outcome],
          outcome,
          final_decision: draft.action === "modify" && draft.finalText ? { text: draft.finalText } : null,
          rationale: draft.rationale,
          supersedes: effective ? effective.decision_id : null,
        },
      ]);
      draftDirty.current = false;
      const s = await reload();
      setDraftState({ action: null, finalText: "", rationale: "" });
      setDraftSavedAt(null);
      // 自动定位下一条待裁决
      if (s) {
        const remaining = sortedQuestions(s.questions, { severity: "all", status: "open", query: "" });
        if (remaining.length > 0) {
          setSelectedId(remaining[0].id);
          history.replaceState(null, "", `#${remaining[0].id}`);
        }
      }
    } catch (e) {
      setSubmitErrors(((e as Error).message || "").split("\n"));
    } finally {
      setSubmitting(false);
    }
  }, [state, selectedId, draft, effectiveDecisionFor, reload, sortedQuestions]);

  const store: WorkbenchStore = {
    state, loadError, filters, setFilters, filteredQuestions,
    selectedId, select, selected: state?.questions.find((x) => x.id === selectedId) || null,
    selectedEvidence, evidenceLoading,
    draft, setDraft, draftSavedAt, submitting, submitErrors, submit,
    effectiveDecisionFor, decisionsCovering,
  };
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

function textOf(final: unknown): string {
  if (final && typeof final === "object" && "text" in (final as Record<string, unknown>)) {
    return String((final as Record<string, unknown>).text);
  }
  return final ? JSON.stringify(final) : "";
}

export function useWorkbench(): WorkbenchStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkbench 必须在 WorkbenchProvider 内使用");
  return ctx;
}
