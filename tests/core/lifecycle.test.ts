// tests/core/lifecycle.test.ts
// Assumes a Jest/Vitest-compatible runner (describe/it/expect).
// Swap the import below to "@jest/globals" if this project uses Jest.
import { describe, it, expect } from "vitest";

import { Task, TaskStatus } from "../../src/core/types";
import {
  ALLOWED_TRANSITIONS,
  InvalidTransitionError,
  VersionConflictError,
  canTransition,
  isTerminal,
  transition,
} from "../../src/core/lifecycle";

function makeTask(status: TaskStatus, overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    goal: "test goal",
    createdAt: new Date().toISOString(),
    status,
    requiresApproval: false,
    version: 0,
    ...overrides,
  };
}

describe("lifecycle: valid transitions", () => {
  const cases: [TaskStatus, TaskStatus][] = [
    ["created", "planning"],
    ["planning", "awaiting_approval"],
    ["planning", "executing"],
    ["awaiting_approval", "executing"],
    ["awaiting_approval", "rejected"],
    ["executing", "verifying"],
    ["executing", "failed"],
    ["verifying", "completed"],
    ["verifying", "failed"],
  ];

  it.each(cases)("allows %s -> %s", (from, to) => {
    const next = transition(makeTask(from), to);
    expect(next.status).toBe(to);
  });

  it("does not mutate the input task", () => {
    const task = makeTask("created");
    const next = transition(task, "planning");
    expect(task.status).toBe("created");
    expect(task.version).toBe(0);
    expect(next).not.toBe(task);
  });

  it("increments version on every successful transition", () => {
    const task = makeTask("created", { version: 5 });
    const next = transition(task, "planning");
    expect(next.version).toBe(6);
  });
});

describe("lifecycle: invalid transitions", () => {
  it("rejects skipping states (created -> executing)", () => {
    expect(() => transition(makeTask("created"), "executing")).toThrow(
      InvalidTransitionError
    );
  });

  it("rejects moving backward (verifying -> planning)", () => {
    expect(() => transition(makeTask("verifying"), "planning")).toThrow(
      InvalidTransitionError
    );
  });

  it("error carries from/to/allowed for debugging", () => {
    try {
      transition(makeTask("created"), "completed");
      throw new Error("expected transition to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidTransitionError);
      const e = err as InvalidTransitionError;
      expect(e.from).toBe("created");
      expect(e.to).toBe("completed");
      expect(e.allowed).toEqual(["planning"]);
    }
  });
});

describe("lifecycle: terminal states", () => {
  const terminal: TaskStatus[] = ["completed", "failed", "rejected"];

  it.each(terminal)("%s is terminal — no transitions allowed", (status) => {
    expect(isTerminal(status)).toBe(true);
    expect(ALLOWED_TRANSITIONS[status]).toHaveLength(0);
    expect(() => transition(makeTask(status), "planning")).toThrow(
      InvalidTransitionError
    );
  });
});

describe("canTransition", () => {
  it("agrees with ALLOWED_TRANSITIONS for every status pair", () => {
    const statuses = Object.keys(ALLOWED_TRANSITIONS) as TaskStatus[];
    for (const from of statuses) {
      for (const to of statuses) {
        expect(canTransition(from, to)).toBe(
          ALLOWED_TRANSITIONS[from].includes(to)
        );
      }
    }
  });
});

describe("optimistic concurrency", () => {
  it("succeeds when expectedVersion matches", () => {
    const task = makeTask("created", { version: 3 });
    const next = transition(task, "planning", { expectedVersion: 3 });
    expect(next.version).toBe(4);
  });

  it("throws VersionConflictError when expectedVersion does not match", () => {
    const task = makeTask("created", { version: 3 });
    expect(() =>
      transition(task, "planning", { expectedVersion: 2 })
    ).toThrow(VersionConflictError);
  });

  it("VersionConflictError carries taskId/expectedVersion/actualVersion", () => {
    const task = makeTask("created", { version: 3 });
    try {
      transition(task, "planning", { expectedVersion: 2 });
      throw new Error("expected transition to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(VersionConflictError);
      const e = err as VersionConflictError;
      expect(e.taskId).toBe(task.id);
      expect(e.expectedVersion).toBe(2);
      expect(e.actualVersion).toBe(3);
    }
  });

  it("surfaces the version conflict before checking transition validity", () => {
    // Task is terminal (so the transition itself would also be invalid),
    // but a stale caller should learn about the conflict first.
    const task = makeTask("completed", { version: 3 });
    expect(() =>
      transition(task, "planning", { expectedVersion: 2 })
    ).toThrow(VersionConflictError);
  });

  it("expectedVersion is optional — plain in-memory usage still works", () => {
    const task = makeTask("created", { version: 0 });
    const next = transition(task, "planning");
    expect(next.status).toBe("planning");
  });
});
