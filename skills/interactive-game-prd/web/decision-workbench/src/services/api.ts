// 后端 API 封装（decision-workbench.mjs 本地服务）
import type { Decision, Evidence, WorkbenchState } from "../types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errors = (body as { errors?: string[] }).errors;
    throw new Error(errors?.length ? errors.join("\n") : (body as { error?: string }).error || `HTTP ${res.status}`);
  }
  return body as T;
}

export function getState(): Promise<WorkbenchState> {
  return request<WorkbenchState>("/api/state");
}

export function getEvidence(questionId: string): Promise<Evidence> {
  return request<Evidence>(`/api/evidence/${questionId}`);
}

export function saveDraft(questionId: string, draft: Partial<Decision> | null, remove = false): Promise<void> {
  return request<void>("/api/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question_id: questionId, draft, remove }),
  });
}

export function submitDecisions(decisions: Partial<Decision>[]): Promise<{ ok: boolean; applied: number }> {
  return request<{ ok: boolean; applied: number }>("/api/decisions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decisions }),
  });
}
