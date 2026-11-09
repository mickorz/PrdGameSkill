// Game Decision Workbench 数据类型（与 skills/interactive-game-prd/schemas/*.json 对应）

export type Severity = "high" | "medium" | "low";
export type OQStatus = "open" | "approved" | "rejected" | "deferred";
export type DecisionStatus = "approved" | "rejected" | "deferred" | "draft";
export type Outcome = "adopted" | "modified" | "rejected" | "deferred";

export interface OpenQuestion {
  id: string; // OQ-xxx
  requirement_id: string | null;
  question: string;
  severity: Severity;
  status: OQStatus;
  decision_id?: string;
}

export interface RequirementUpdate {
  requirement_id: string;
  field: string;
  from: string;
  to: string;
  note?: string;
}

export interface Decision {
  decision_id: string; // DEC-xxx
  question_id: string;
  decision_status: DecisionStatus;
  outcome: Outcome;
  final_decision: unknown;
  rationale: string;
  reviewer: "human";
  decided_at: string;
  requirement_updates?: RequirementUpdate[];
  related_question_ids?: string[];
  supersedes?: string | null;
}

export interface Progress {
  total: number;
  approved: number;
  rejected: number;
  deferred: number;
  open: number;
}

export interface ApprovalState {
  game: string;
  updated_at: string;
  progress: Progress;
  last_position: { question_id: string; updated_at: string } | null;
  drafts: Record<string, Decision>;
}

export interface WorkbenchState {
  game: string;
  questions: OpenQuestion[];
  decisions: Decision[];
  approvalState: ApprovalState | null;
  progress: Progress;
}

export interface EvidenceAnchor {
  file: string;
  heading: string;
  line_start: number;
  line_end: number;
  quote: string;
}

export interface Evidence {
  requirement: { id: string; name: string; status: string; authority: string; description: string } | null;
  anchors: EvidenceAnchor[];
}

export type ActionKind = "adopt" | "modify" | "reject" | "defer";

export interface DraftForm {
  action: ActionKind | null;
  finalText: string;
  rationale: string;
}

export const ACTION_TO_OUTCOME: Record<Exclude<ActionKind, null>, Outcome> = {
  adopt: "adopted",
  modify: "modified",
  reject: "rejected",
  defer: "deferred",
};

export const OUTCOME_TO_STATUS: Record<Outcome, DecisionStatus> = {
  adopted: "approved",
  modified: "approved",
  rejected: "rejected",
  deferred: "deferred",
};

export const ACTION_LABELS: Record<Exclude<ActionKind, null>, string> = {
  adopt: "采纳当前口径",
  modify: "修改为其他口径",
  reject: "否决该需求或推导",
  defer: "暂时挂起，后续处理",
};

export const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
