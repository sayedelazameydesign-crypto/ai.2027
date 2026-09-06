// src/core/types.ts
// ai.2027 — core domain contract (vendor-neutral), v1.
// No dependency on any specific LLM/runtime provider (Arena, Claude, Codex, etc).
// Agent and Tool are built on top of this contract in a later pass.

export type TaskId = string;
export type ExecutionId = string;
export type ApprovalId = string;

// ---------- Task ----------

export type TaskStatus =
  | "created"
  | "planning"
  | "awaiting_approval"
  | "executing"
  | "verifying"
  | "completed"
  | "failed"
  | "rejected";

export interface Task {
  id: TaskId;
  goal: string;
  createdAt: string; // ISO 8601
  status: TaskStatus;
  requiresApproval: boolean;
  rejectionReason?: string;
  /** Present when this task was created to re-open a rejected/failed task,
   *  instead of mutating the original task's status backward. */
  parentTaskId?: TaskId;
  /** Optimistic-concurrency counter, incremented by transition() on every
   *  successful transition. The real atomic check belongs at the storage
   *  layer (e.g. `WHERE id = ? AND version = ?`); this field only lets the
   *  in-memory helper detect a stale read before hitting storage. */
  version: number;
}

// ---------- Plan ----------

export interface PlanStep {
  id: string;
  description: string;
  toolName?: string; // intended tool for this step, if known
  requiresApproval: boolean;
}

export interface Plan {
  taskId: TaskId;
  steps: PlanStep[];
  createdAt: string;
}

// ---------- Execution ----------

export type ExecutionStatus = "pending" | "running" | "succeeded" | "failed";

export interface Execution {
  id: ExecutionId;
  taskId: TaskId;
  planStepId: string;
  toolName: string;
  input: unknown;
  output?: unknown;
  status: ExecutionStatus;
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

// ---------- Approval (human checkpoint) ----------

export type ApprovalDecision = "approved" | "rejected";

export interface Approval {
  id: ApprovalId;
  taskId: TaskId;
  planStepId?: string;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string; // human identifier
  decision?: ApprovalDecision;
  reason?: string;
}

// ---------- Verification ----------

export interface Verification {
  taskId: TaskId;
  executionIds: ExecutionId[];
  method: string; // e.g. "test-run" | "diff-review" | "manual"
  passed: boolean;
  details?: string;
  verifiedAt: string;
}

// ---------- Result & Evidence ----------

export type ResultStatus = "success" | "failure";

export interface Result {
  taskId: TaskId;
  status: ResultStatus;
  summary: string;
  producedAt: string;
}

export type EvidenceArtifactKind =
  | "diff"
  | "log"
  | "screenshot"
  | "test-report"
  | "other";

export interface EvidenceArtifact {
  kind: EvidenceArtifactKind;
  uri: string; // repo path, URL, or storage pointer
  description?: string;
}

export interface Evidence {
  taskId: TaskId;
  executionIds: ExecutionId[];
  whatChanged: string;
  howVerified: string; // references Verification.method / details
  artifacts?: EvidenceArtifact[];
  createdAt: string;
}

// ---------- Per-task working state ----------
// Not cross-task memory — that lives in the separate Memory Service.

export interface TaskState {
  taskId: TaskId;
  data: Record<string, unknown>;
  updatedAt: string;
}
