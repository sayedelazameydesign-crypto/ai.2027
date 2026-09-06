// tests/core/lifecycle.test.ts
// Assumes a Jest/Vitest-compatible runner (describe/it/expect).
// Swap the import below to "@jest/globals" if this project uses Jest.
import { describe, it, expect } from "vitest";

import { Task, TaskStatus } from "../../src/core/types";
import {
  ALLOWED_TRANSITIONS,
  InvalidTransitionError,
  canTransition,
  isTerminal,
  transition,
} from "../../src/core/lifecycle";

function makeTask(status: TaskStatus): Task {
  return {
    id: "task-1",
    goal: "test goal",
    createdAt: new Date().toISOString(),
    status,
    requiresApproval: false,
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
    expect(next).not.toBe(task);
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
