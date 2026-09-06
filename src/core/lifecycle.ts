// src/core/lifecycle.ts
// ai.2027 — task lifecycle state machine.
// Pure, side-effect-free: given a Task and a target status, either returns
// a new Task with the updated status, or throws InvalidTransitionError.

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

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isTerminal(status: TaskStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0;
}

// Returns a new Task with the updated status; never mutates the input.
export function transition(task: Task, to: TaskStatus): Task {
  const allowed = ALLOWED_TRANSITIONS[task.status];
  if (!allowed.includes(to)) {
    throw new InvalidTransitionError(task.status, to, allowed);
  }
  return { ...task, status: to };
}
