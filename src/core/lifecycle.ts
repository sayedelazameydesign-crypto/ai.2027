// src/core/lifecycle.ts
// ai.2027 — task lifecycle state machine, v1.
//
// Stays pure and structural on purpose:
//   - answers only "is this transition allowed?" and, optimistically,
//     "is the caller looking at the current version?"
//   - never decides business rules (e.g. whether an approval is required
//     before planning -> executing) — that belongs to the orchestrator.
//   - never creates timestamps, IDs, or events — the application/storage
//     layer persists the Task update and any TaskStatusChangedEvent
//     (see events.ts) atomically after a successful transition().
//   - the real concurrency guarantee lives at the storage layer, e.g.:
//       UPDATE tasks SET status = ?, version = version + 1
//       WHERE id = ? AND version = ?
//     the check here only catches stale in-memory reads early.

import { Task, TaskStatus } from "./types";

export const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  created: ["planning"],
  planning: ["awaiting_approval", "executing"],
  awaiting_approval: ["executing", "rejected"],
  executing: ["verifying", "failed"],
  verifying: ["completed", "failed"],
  completed: [], // terminal
  failed: [], // terminal
  rejected: [], // terminal
};

export class InvalidTransitionError extends Error {
  readonly from: TaskStatus;
  readonly to: TaskStatus;
  readonly allowed: TaskStatus[];

  constructor(from: TaskStatus, to: TaskStatus, allowed: TaskStatus[]) {
    super(
      `Invalid transition: "${from}" -> "${to}". Allowed: ${
        allowed.length ? allowed.join(", ") : "none (terminal state)"
      }.`
    );
    this.name = "InvalidTransitionError";
    this.from = from;
    this.to = to;
    this.allowed = allowed;
  }
}

export class VersionConflictError extends Error {
  readonly taskId: Task["id"];
  readonly expectedVersion: number;
  readonly actualVersion: number;

  constructor(taskId: Task["id"], expectedVersion: number, actualVersion: number) {
    super(
      `Version conflict on task "${taskId}": expected version ${expectedVersion}, ` +
        `but task is at version ${actualVersion}. The task was likely modified concurrently.`
    );
    this.name = "VersionConflictError";
    this.taskId = taskId;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isTerminal(status: TaskStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0;
}

export interface TransitionOptions {
  /** If provided, must match task.version or a VersionConflictError is thrown. */
  expectedVersion?: number;
}

// Returns a new Task with the updated status and incremented version;
// never mutates the input. Throws VersionConflictError before checking
// transition validity — a stale caller should learn about the conflict
// first, regardless of which transition it was attempting.
export function transition(
  task: Readonly<Task>,
  to: TaskStatus,
  options?: TransitionOptions
): Task {
  if (
    options?.expectedVersion !== undefined &&
    options.expectedVersion !== task.version
  ) {
    throw new VersionConflictError(task.id, options.expectedVersion, task.version);
  }

  const allowed = ALLOWED_TRANSITIONS[task.status];
  if (!allowed.includes(to)) {
    throw new InvalidTransitionError(task.status, to, allowed);
  }

  return {
    ...task,
    status: to,
    version: task.version + 1,
  };
}
