// src/core/events.ts
// ai.2027 — minimal event contract for task status changes, v1.
//
// This file defines the *shape* only. lifecycle.ts never constructs one of
// these — it stays pure. The application/storage layer builds a
// TaskStatusChangedEvent after a successful transition() call and is
// responsible for persisting the Task update and this event atomically
// (single transaction, or an outbox table). Full event sourcing, replay,
// and a richer event taxonomy are deferred past v1.

import { TaskId, TaskStatus } from "./types";

export interface TaskStatusChangedEvent {
  taskId: TaskId;
  from: TaskStatus;
  to: TaskStatus;
  /** Resulting Task.version immediately after this transition. */
  version: number;
  /** Set by the layer that persists the event, not by lifecycle.ts. */
  occurredAt: string;
}
